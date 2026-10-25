/**
 * The world: photons stored as a structure of typed arrays (fast, ready for
 * Workers / WebGPU later). No DOM, no knowledge of atoms, molecules or cells -
 * only positions, velocities, headings, internal energy, types and bonds.
 *
 * One step: grid -> pair forces (electromagnetic wave + hard core, strong-bond
 * candidates, list of near pairs) -> strong bonds (springs, energy flow,
 * decay) -> integrate (light, leak, friction, noise, torus wrap) ->
 * hard boundary (near pairs closer than dmin are pushed apart, their approach
 * speed removed - see contacts()).
 *
 * Photons are identical particles; `type` is only their charge class
 * (charge = type - 2, see genome.js).
 *
 * Dimensions: depth = 0 -> 2D (heading = angle theta), depth > 0 -> 3D
 * (3-torus, heading = unit vector hx/hy/hz). The z arrays exist in 2D too but
 * stay 0, so shared code (bonds, observers) can always include z terms.
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;

    class World {
        /**
         * @param {object} o
         * @param {number} o.width  world size (px)
         * @param {number} o.height
         * @param {number} [o.depth] 0 = 2D world, > 0 = 3D world of this depth
         * @param {number} o.count  number of photons
         * @param {object} o.genome see EM.genome
         * @param {number} o.seed   seed for spawn positions and noise
         */
        constructor({ width, height, depth = 0, count, genome, seed }) {
            this.width = width;
            this.height = height;
            this.depth = depth > 0 ? depth : 0;
            this.dim = this.depth > 0 ? 3 : 2;
            this.genome = genome;
            this.laws = EM.genome.compile(genome);
            this.seed = seed >>> 0;
            this.rng = new EM.Rng((this.seed ^ 0x9E3779B9) >>> 0);
            this.bondsEnabled = true;

            const n = this.n = count;
            this.x = new Float32Array(n);
            this.y = new Float32Array(n);
            this.vx = new Float32Array(n);
            this.vy = new Float32Array(n);
            this.fx = new Float32Array(n);
            this.fy = new Float32Array(n);
            /** third axis (always 0 in 2D) */
            this.z = new Float32Array(n);
            this.vz = new Float32Array(n);
            this.fz = new Float32Array(n);
            this.hz = new Float32Array(n);
            this.type = new Uint8Array(n);
            /** heading angle and its unit vector (refreshed every step) */
            this.theta = new Float32Array(n);
            this.hx = new Float32Array(n);
            this.hy = new Float32Array(n);
            /** accumulated turning this step (2D: angle; 3D: vector tx/ty/tz) */
            this.turn = new Float32Array(n);
            if (this.dim === 3) {
                this.tx = new Float32Array(n);
                this.ty = new Float32Array(n);
                this.tz = new Float32Array(n);
            }
            /** internal energy 0..1 */
            this.energy = new Float32Array(n);
            /** number of bonds of each photon */
            this.deg = new Uint8Array(n);
            /** bond partners: partner[i * MAX_VALENCE + slot], -1 = empty */
            this.partner = new Int32Array(n * MV).fill(-1);
            this.bondCount = 0;

            /** near pairs [i, j, ...] found by the pair loop - checked by contacts() after moving */
            this.near = new Int32Array(Math.max(1024, n * 8));
            this.nearCount = 0;

            this.grid = this.dim === 3
                ? new EM.SpatialHash3(width, height, this.depth, this.laws.R)
                : new EM.SpatialHash(width, height, this.laws.R);
            this.steps = 0;
            /** counters for observers */
            this.reactions = 0;
            this.bondsFormed = 0;
            this.bondsBroken = 0;
            if (this.dim === 3) this.spawn3d(); else this.spawn();
            this.light = new EM.Light(this);
        }

        /** Charge class drawn from the laws' charge mix. */
        drawType(u) {
            const w = this.laws.typeWeights;
            let total = 0;
            for (let t = 0; t < w.length; t++) total += w[t];
            let acc = 0;
            for (let t = 0; t < w.length; t++) {
                acc += w[t] / total;
                if (u < acc) return t;
            }
            return w.length - 1;
        }

        /** Uniform random positions, small random velocities, charges from the laws. */
        spawn() {
            const rng = this.rng;
            for (let i = 0; i < this.n; i++) {
                this.x[i] = rng.next() * this.width;
                this.y[i] = rng.next() * this.height;
                this.vx[i] = (rng.next() - 0.5);
                this.vy[i] = (rng.next() - 0.5);
                this.type[i] = this.drawType(rng.next());
                this.theta[i] = rng.next() * Math.PI * 2;
            }
        }

        /** 3D: positions in the cube, random heading on the unit sphere. */
        spawn3d() {
            const rng = this.rng;
            for (let i = 0; i < this.n; i++) {
                this.x[i] = rng.next() * this.width;
                this.y[i] = rng.next() * this.height;
                this.z[i] = rng.next() * this.depth;
                this.vx[i] = (rng.next() - 0.5);
                this.vy[i] = (rng.next() - 0.5);
                this.vz[i] = (rng.next() - 0.5);
                this.type[i] = this.drawType(rng.next());
                const u = rng.next() * 2 - 1, phi = rng.next() * Math.PI * 2, s = Math.sqrt(1 - u * u);
                this.hx[i] = s * Math.cos(phi);
                this.hy[i] = s * Math.sin(phi);
                this.hz[i] = u;
            }
        }

        /** One physics step. */
        step() {
            if (this.dim === 3) {
                this.step3d();
                return;
            }
            this.grid.build(this.x, this.y, this.n);
            this.fx.fill(0);
            this.fy.fill(0);
            if (this.laws.hasOrientation) {
                this.turn.fill(0);
                for (let i = 0; i < this.n; i++) {
                    this.hx[i] = Math.cos(this.theta[i]);
                    this.hy[i] = Math.sin(this.theta[i]);
                }
            }
            this.light.update(this.steps);
            EM.forces.applyPairs(this);
            EM.bonds.applySprings(this);
            EM.reactions.apply(this);
            this.integrate();
            this.contacts();
            this.steps++;
        }

        step3d() {
            this.grid.build(this.x, this.y, this.z, this.n);
            this.fx.fill(0);
            this.fy.fill(0);
            this.fz.fill(0);
            if (this.laws.hasOrientation) {
                this.tx.fill(0);
                this.ty.fill(0);
                this.tz.fill(0);
            }
            this.light.update(this.steps);
            EM.forces3d.applyPairs(this);
            EM.bonds.applySprings(this);
            EM.reactions.apply(this);
            this.integrate3d();
            this.contacts();
            this.steps++;
        }

        /**
         * Hard boundary: two photon centres never stay closer than dmin (set by
         * the pressure). Overlapping near pairs are pushed apart (lighter photon
         * moves more) and their approach speed is removed, with a bounce of
         * `restitution`. Momentum is conserved.
         */
        contacts() {
            // a push can create a new overlap with a third photon: a few sweeps settle dense clusters
            for (let it = 0; it < World.CONTACT_SWEEPS; it++) {
                if (this.contactSweep(it === 0) === 0) break;
            }
        }

        /** One pass over the near pairs. Returns how many pairs overlapped. */
        contactSweep(firstSweep) {
            const L = this.laws, dmin = L.dmin, e1 = 1 + L.restitution;
            const near = this.near, m = this.nearCount;
            const x = this.x, y = this.y, z = this.z, vx = this.vx, vy = this.vy, vz = this.vz;
            const type = this.type, invMass = L.invMass;
            const W = this.width, H = this.height, D = this.depth, hw = W / 2, hh = H / 2, hd = D / 2;
            const d2min = dmin * dmin;
            let overlaps = 0;
            for (let k = 0; k < m; k += 2) {
                const i = near[k], j = near[k + 1];
                let dx = x[j] - x[i];
                if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
                let dy = y[j] - y[i];
                if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
                let dz = 0;
                if (D) {
                    dz = z[j] - z[i];
                    if (dz > hd) dz -= D; else if (dz < -hd) dz += D;
                }
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 >= d2min) continue;
                overlaps++;
                let d = Math.sqrt(d2), nx, ny, nz;
                if (d > 1e-6) {
                    nx = dx / d; ny = dy / d; nz = dz / d;
                } else {
                    // exactly on top of each other: separate along x
                    nx = 1; ny = 0; nz = 0; d = 0;
                }
                const wi = invMass[type[i]], wj = invMass[type[j]], ws = wi + wj;
                const push = (dmin - d) / ws;
                x[i] -= nx * push * wi; y[i] -= ny * push * wi;
                x[j] += nx * push * wj; y[j] += ny * push * wj;
                if (D) { z[i] -= nz * push * wi; z[j] += nz * push * wj; }
                // remove the approach speed (impulse along n)
                const vn = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny + (vz[j] - vz[i]) * nz;
                if (firstSweep && vn < 0) {
                    const imp = -e1 * vn / ws;
                    vx[i] -= nx * imp * wi; vy[i] -= ny * imp * wi;
                    vx[j] += nx * imp * wj; vy[j] += ny * imp * wj;
                    if (D) { vz[i] -= nz * imp * wi; vz[j] += nz * imp * wj; }
                }
                this.wrap(i);
                this.wrap(j);
            }
            return overlaps;
        }

        wrap(i) {
            const W = this.width, H = this.height, D = this.depth;
            if (this.x[i] < 0) this.x[i] += W; else if (this.x[i] >= W) this.x[i] -= W;
            if (this.y[i] < 0) this.y[i] += H; else if (this.y[i] >= H) this.y[i] -= H;
            if (D) { if (this.z[i] < 0) this.z[i] += D; else if (this.z[i] >= D) this.z[i] -= D; }
        }

        /** Changes the pressure (environment) of a running world. */
        setPressure(p) {
            EM.genome.applyPressure(this.laws, p);
        }

        /** Records a near pair for contacts() (called by the pair loops). */
        addNear(i, j) {
            if (this.nearCount + 2 > this.near.length) {
                const bigger = new Int32Array(this.near.length * 2);
                bigger.set(this.near);
                this.near = bigger;
            }
            this.near[this.nearCount++] = i;
            this.near[this.nearCount++] = j;
        }

        integrate3d() {
            const n = this.n, L = this.laws;
            const x = this.x, y = this.y, z = this.z, vx = this.vx, vy = this.vy, vz = this.vz;
            const fx = this.fx, fy = this.fy, fz = this.fz, hx = this.hx, hy = this.hy, hz = this.hz;
            const tx = this.tx, ty = this.ty, tz = this.tz;
            const type = this.type, e = this.energy;
            const invMass = L.invMass, absorb = L.absorb, leak = L.leak, thrust = L.thrust;
            const keep = 1 - L.friction, noise = L.temperature, agit = L.agitation || 0;
            const maxV = L.maxSpeed, maxV2 = maxV * maxV;
            const W = this.width, H = this.height, D = this.depth;
            const rng = this.rng, light = this.light;
            const orient = L.hasOrientation, spin = L.spin;

            for (let i = 0; i < n; i++) {
                const t = type[i];
                let en = e[i];
                if (absorb[t] > 0) en += absorb[t] * light.at3(x[i], y[i], z[i]);
                en -= leak[t] * en;

                const im = invMass[t];
                let ax = fx[i] * im, ay = fy[i] * im, az = fz[i] * im;

                // heading: turn + rotational noise, then back to unit length
                let px = hx[i], py = hy[i], pz = hz[i];
                if (orient) {
                    px += tx[i] + (rng.next() - 0.5) * spin;
                    py += ty[i] + (rng.next() - 0.5) * spin;
                    pz += tz[i] + (rng.next() - 0.5) * spin;
                    const len = Math.sqrt(px * px + py * py + pz * pz) || 1;
                    px /= len; py /= len; pz /= len;
                    hx[i] = px; hy[i] = py; hz[i] = pz;
                }
                if (thrust[t] > 0 && en > 0.05) {
                    const push = thrust[t] * en;
                    ax += px * push;
                    ay += py * push;
                    az += pz * push;
                    en -= push * 0.5;
                }
                e[i] = en > 1 ? 1 : (en < 0 ? 0 : en);

                let ux = (vx[i] + ax) * keep, uy = (vy[i] + ay) * keep, uz = (vz[i] + az) * keep;
                // thermal noise + agitation: the more energy, the harder the random kick
                const kick = noise + agit * e[i];
                if (kick > 0) {
                    ux += (rng.next() - 0.5) * kick;
                    uy += (rng.next() - 0.5) * kick;
                    uz += (rng.next() - 0.5) * kick;
                }
                const v2 = ux * ux + uy * uy + uz * uz;
                if (v2 > maxV2) {
                    const s = maxV / Math.sqrt(v2);
                    ux *= s; uy *= s; uz *= s;
                }
                vx[i] = ux; vy[i] = uy; vz[i] = uz;

                let qx = x[i] + ux, qy = y[i] + uy, qz = z[i] + uz;
                if (qx < 0) qx += W; else if (qx >= W) qx -= W;
                if (qy < 0) qy += H; else if (qy >= H) qy -= H;
                if (qz < 0) qz += D; else if (qz >= D) qz -= D;
                x[i] = qx; y[i] = qy; z[i] = qz;
            }
        }

        integrate() {
            const n = this.n, L = this.laws;
            const x = this.x, y = this.y, vx = this.vx, vy = this.vy, fx = this.fx, fy = this.fy;
            const type = this.type, e = this.energy, theta = this.theta, turn = this.turn;
            const invMass = L.invMass, absorb = L.absorb, leak = L.leak, thrust = L.thrust;
            const keep = 1 - L.friction;
            const noise = L.temperature, agit = L.agitation || 0;
            const maxV = L.maxSpeed, maxV2 = maxV * maxV;
            const W = this.width, H = this.height;
            const rng = this.rng, light = this.light;
            const orient = L.hasOrientation, spin = L.spin;

            for (let i = 0; i < n; i++) {
                const t = type[i];

                // energy: absorb light, leak a fraction
                let en = e[i];
                if (absorb[t] > 0) en += absorb[t] * light.at(x[i], y[i]);
                en -= leak[t] * en;

                const im = invMass[t];
                let ax = fx[i] * im, ay = fy[i] * im;

                // heading: turning from neighbours + rotational noise
                let th = theta[i];
                if (orient) th += turn[i] + (rng.next() - 0.5) * spin;
                // thrust: energy spent to push along the heading
                if (thrust[t] > 0 && en > 0.05) {
                    const push = thrust[t] * en;
                    ax += Math.cos(th) * push;
                    ay += Math.sin(th) * push;
                    en -= push * 0.5;
                }
                theta[i] = th;
                e[i] = en > 1 ? 1 : (en < 0 ? 0 : en);

                let ux = (vx[i] + ax) * keep;
                let uy = (vy[i] + ay) * keep;
                const kick = noise + agit * e[i];
                if (kick > 0) {
                    ux += (rng.next() - 0.5) * kick;
                    uy += (rng.next() - 0.5) * kick;
                }
                const v2 = ux * ux + uy * uy;
                if (v2 > maxV2) {
                    const s = maxV / Math.sqrt(v2);
                    ux *= s;
                    uy *= s;
                }
                vx[i] = ux;
                vy[i] = uy;

                let px = x[i] + ux, py = y[i] + uy;
                if (px < 0) px += W; else if (px >= W) px -= W;
                if (py < 0) py += H; else if (py >= H) py -= H;
                x[i] = px;
                y[i] = py;
            }
        }

        /** Shortest offset from photon i to photon j on the torus. */
        offset(i, j) {
            let dx = this.x[j] - this.x[i];
            let dy = this.y[j] - this.y[i];
            let dz = this.z[j] - this.z[i];
            const hw = this.width / 2, hh = this.height / 2, hd = this.depth / 2;
            if (dx > hw) dx -= this.width; else if (dx < -hw) dx += this.width;
            if (dy > hh) dy -= this.height; else if (dy < -hh) dy += this.height;
            if (this.depth) { if (dz > hd) dz -= this.depth; else if (dz < -hd) dz += this.depth; }
            return [dx, dy, dz];
        }

        /** Kinetic energy (sum of v^2 / 2) - a cheap "temperature" readout. */
        kineticEnergy() {
            let e = 0;
            for (let i = 0; i < this.n; i++) e += this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] + this.vz[i] * this.vz[i];
            return e / 2;
        }

        /** Sum of internal energy. */
        internalEnergy() {
            let e = 0;
            for (let i = 0; i < this.n; i++) e += this.energy[i];
            return e;
        }
    }

    /** max passes of the hard boundary per step (stops early when nothing overlaps) */
    World.CONTACT_SWEEPS = 4;
    EM.World = World;
})(EM);
