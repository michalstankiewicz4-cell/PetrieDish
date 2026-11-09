/**
 * World (since v0.9): Gravitation's photons on a torus (2D) or 3-torus (3D),
 * plus pressure, temperature and bonds with angles.
 *
 * Every photon gets its own properties from the formulas (js/core/formulas.js):
 * charge, mass, speed, energy, force, forceRange, periods, waveOffset,
 * phaseShift, valence, bondAngle.
 *
 * One step (dt = 1/60 s):
 *  1. grid (cells >= the largest reach)
 *  2. pairs: Gravitation's force, averaged over both photons:
 *       range = (ri + rj)/2, amp = (Fi + Fj)/2, periods / offset / phase averaged
 *       f = sign * amp * (sin(2 pi (periods d / range + phase)) + offset) / (1 + offset) * (1 - d / range)
 *       sign = +1 (attract) for opposite charges, -1 otherwise; times (1 - temperature)
 *     + new bonds: touching photons (d < 1.3 bond length) with free valence, angle allowed, chance
 *  3. bonds: springs to the bond length (set by pressure), break when stretched,
 *     bonds of one photon closer than its bondAngle are pushed apart
 *  4. move: v += F / m * dt, then |v| is set back to the photon's speed (Gravitation:
 *     only the direction changes), position += v * dt, torus wrap
 *  5. hard boundary: photons never overlap (centres >= 2 r)
 * Deterministic: positions from `seed`, photon properties from the laws' seed.
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;
    const MAX_CELLS = 1 << 18;

    class World {
        constructor({ width, height, depth = 0, count, genome, seed }) {
            this.width = width;
            this.height = height;
            this.depth = depth > 0 ? depth : 0;
            this.dim = this.depth > 0 ? 3 : 2;
            this.genome = genome;
            this.laws = EM.genome.compile(genome);
            this.seed = seed >>> 0;
            this.rng = new EM.Rng((this.seed ^ 0x9E3779B9) >>> 0);
            this.propRng = new EM.Rng(genome.seed >>> 0);
            this.bondsEnabled = true;

            const n = this.n = count;
            const F = () => new Float32Array(n);
            this.x = F(); this.y = F(); this.z = F();
            this.vx = F(); this.vy = F(); this.vz = F();
            this.fx = F(); this.fy = F(); this.fz = F();
            this.type = new Uint8Array(n);
            // photon properties (from the formulas)
            this.charge = F(); this.mass = F(); this.invMass = F(); this.speed = F();
            this.energyRaw = F(); this.force = F(); this.range = F();
            this.periods = F(); this.offsetW = F(); this.phase = F();
            this.valence = new Uint8Array(n);
            this.cosAngle = F();        // cos(bondAngle): bonds of a photon must have cos <= this
            this.bondAngle = F();
            /** energy scaled to 0..1 (for colouring) */
            this.energy = F();
            // kept for shared code (renderers, observers): no orientation in this model
            this.theta = F(); this.hx = F(); this.hy = F(); this.hz = F();

            this.deg = new Uint8Array(n);
            this.partner = new Int32Array(n * MV).fill(-1);
            this.bondCount = 0;

            this.near = new Int32Array(Math.max(1024, n * 8));
            this.nearCount = 0;
            this.cellOf = new Int32Array(n);
            this.sorted = new Int32Array(n);
            this.cellStart = new Int32Array(2);

            this.steps = 0;
            this.reactions = 0;
            this.bondsFormed = 0;
            this.bondsBroken = 0;
            this.maxRange = 0;
            this.maxSpeedNow = 0;

            this.light = new EM.Light(this);
            this.spawn();
        }

        /** Random positions, properties from the formulas, velocity = speed in a random direction. */
        spawn() {
            const rng = this.rng;
            for (let i = 0; i < this.n; i++) {
                this.x[i] = rng.next() * this.width;
                this.y[i] = rng.next() * this.height;
                this.z[i] = this.dim === 3 ? rng.next() * this.depth : 0;
                this.assign(i, null);
                this.randomDirection(i, this.speed[i]);
            }
            this.afterProps();
        }

        /** Evaluates the formulas for photon i (overrides keep part of its identity). */
        assign(i, overrides) {
            const v = EM.formulas.run(this.laws.compiled, this.propRng, overrides).values;
            this.charge[i] = v.charge;
            this.mass[i] = v.mass;
            this.invMass[i] = 1 / v.mass;
            this.speed[i] = v.speed;
            this.energyRaw[i] = v.energy;
            this.force[i] = v.force;
            this.range[i] = v.forceRange;
            this.periods[i] = v.periods;
            this.offsetW[i] = v.waveOffset;
            this.phase[i] = v.phaseShift;
            this.valence[i] = v.valence;
            this.bondAngle[i] = v.bondAngle;
            this.cosAngle[i] = Math.cos(v.bondAngle * Math.PI / 180);
            this.type[i] = v.charge < 0 ? 0 : v.charge > 0 ? 2 : 1;
        }

        /** Cached maxima and the 0..1 energy used for colouring. */
        afterProps() {
            let maxR = 0, maxS = 0, maxV = 0, eMin = Infinity, eMax = -Infinity;
            for (let i = 0; i < this.n; i++) {
                if (this.valence[i] > maxV) maxV = this.valence[i];
                if (this.range[i] > maxR) maxR = this.range[i];
                if (this.speed[i] > maxS) maxS = this.speed[i];
                if (this.energyRaw[i] < eMin) eMin = this.energyRaw[i];
                if (this.energyRaw[i] > eMax) eMax = this.energyRaw[i];
            }
            this.maxRange = maxR;
            this.maxValence = maxV;
            this.maxSpeedNow = maxS;
            const span = eMax - eMin;
            for (let i = 0; i < this.n; i++) this.energy[i] = span > 1e-9 ? (this.energyRaw[i] - eMin) / span : 0.5;
        }

        randomDirection(i, s) {
            const rng = this.rng;
            if (this.dim === 3) {
                const z = rng.next() * 2 - 1, a = rng.next() * Math.PI * 2, r = Math.sqrt(1 - z * z);
                this.vx[i] = Math.cos(a) * r * s; this.vy[i] = Math.sin(a) * r * s; this.vz[i] = z * s;
            } else {
                const a = rng.next() * Math.PI * 2;
                this.vx[i] = Math.cos(a) * s; this.vy[i] = Math.sin(a) * s; this.vz[i] = 0;
            }
        }

        /**
         * New laws for the running world (editor). Like Gravitation: every photon
         * keeps its charge, mass and energy; everything derived from them is
         * recomputed with the new formulas.
         */
        setLaws(laws) {
            this.laws = laws;
            this.light.params = laws.light;
            for (let i = 0; i < this.n; i++) {
                this.assign(i, { charge: this.charge[i], mass: this.mass[i], energy: this.energyRaw[i] });
            }
            this.afterProps();
        }

        /** Environment change (pressure, temperature, bonds) - no photon changes. */
        setEnv() {
            EM.genome.applyEnv(this.laws);
        }

        setPressure(p) {
            this.laws.env.pressure = p;
            this.setEnv();
        }

        step() {
            const L = this.laws, dt = L.dt;
            this.fx.fill(0); this.fy.fill(0); this.fz.fill(0);
            // a pair closer than this may overlap after moving -> checked by contacts()
            this.nearR = L.dmin + 2 * this.maxSpeedNow * dt + 0.5;
            this.buildGrid(Math.max(this.maxRange, L.formDist, this.nearR));
            this.pairs();
            this.springs();
            this.move();
            this.contacts();
            this.steps++;
        }

        // ---------- grid: counting sort into cells >= reach ----------
        buildGrid(reach) {
            const W = this.width, H = this.height, D = this.depth;
            let cols = Math.max(1, Math.floor(W / reach));
            let rows = Math.max(1, Math.floor(H / reach));
            let layers = this.dim === 3 ? Math.max(1, Math.floor(D / reach)) : 1;
            while (cols * rows * layers > MAX_CELLS) {
                cols = Math.max(1, cols >> 1); rows = Math.max(1, rows >> 1);
                if (layers > 1) layers = Math.max(1, layers >> 1);
            }
            const cells = cols * rows * layers;
            if (this.cellStart.length < cells + 1) this.cellStart = new Int32Array(cells + 1);
            const start = this.cellStart, cellOf = this.cellOf, sorted = this.sorted;
            start.fill(0, 0, cells + 1);
            const cw = W / cols, ch = H / rows, cd = this.dim === 3 ? D / layers : 1;
            for (let i = 0; i < this.n; i++) {
                const cx = Math.min(cols - 1, (this.x[i] / cw) | 0);
                const cy = Math.min(rows - 1, (this.y[i] / ch) | 0);
                const cz = this.dim === 3 ? Math.min(layers - 1, (this.z[i] / cd) | 0) : 0;
                const c = (cz * rows + cy) * cols + cx;
                cellOf[i] = c;
                start[c + 1]++;
            }
            for (let c = 0; c < cells; c++) start[c + 1] += start[c];
            const fill = this._fill && this._fill.length >= cells ? this._fill : (this._fill = new Int32Array(cells));
            fill.set(start.subarray(0, cells));
            for (let i = 0; i < this.n; i++) sorted[fill[cellOf[i]]++] = i;
            this.grid = { cols, rows, layers, cw, ch, cd };
        }

        // ---------- pairs: Gravitation's force + new bonds ----------
        pairs() {
            const L = this.laws, g = this.grid;
            const { cols, rows, layers } = g;
            const x = this.x, y = this.y, z = this.z, fx = this.fx, fy = this.fy, fz = this.fz;
            const charge = this.charge, force = this.force, range = this.range, periods = this.periods;
            const off = this.offsetW, phase = this.phase;
            const start = this.cellStart, sorted = this.sorted;
            const W = this.width, H = this.height, D = this.depth, hw = W / 2, hh = H / 2, hd = D / 2;
            const factor = L.forceFactor, TAU = Math.PI * 2;
            const near2 = this.nearR * this.nearR, form2 = L.formDist * L.formDist;
            const bonding = this.bondsEnabled && L.env.bondChance > 0;
            this.nearCount = 0;
            // each neighbour cell once, even when an axis has fewer than 3 cells
            const lx = cols >= 3 ? -1 : 0, hx = cols >= 2 ? 1 : 0;
            const ly = rows >= 3 ? -1 : 0, hy = rows >= 2 ? 1 : 0;
            const lz = layers >= 3 ? -1 : 0, hz = layers >= 2 ? 1 : 0;

            for (let i = 0; i < this.n; i++) {
                const c = this.cellOf[i];
                const cx = c % cols, cy = ((c / cols) | 0) % rows, cz = (c / (cols * rows)) | 0;
                const xi = x[i], yi = y[i], zi = z[i];
                for (let oz = lz; oz <= hz; oz++) {
                    const nz = (cz + oz + layers) % layers;
                    for (let oy = ly; oy <= hy; oy++) {
                        const ny = (cy + oy + rows) % rows;
                        for (let ox = lx; ox <= hx; ox++) {
                            const nc = (nz * rows + ny) * cols + (cx + ox + cols) % cols;
                            for (let b = start[nc], e = start[nc + 1]; b < e; b++) {
                                const j = sorted[b];
                                if (j <= i) continue;
                                let dx = x[j] - xi;
                                if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
                                let dy = y[j] - yi;
                                if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
                                let dz = 0;
                                if (D) { dz = z[j] - zi; if (dz > hd) dz -= D; else if (dz < -hd) dz += D; }
                                const d2 = dx * dx + dy * dy + dz * dz;
                                if (d2 < near2) this.addNear(i, j);
                                const rg = (range[i] + range[j]) * 0.5;
                                const inForce = d2 < rg * rg && d2 > 0;
                                const inBond = bonding && d2 < form2;
                                if (!inForce && !inBond) continue;
                                const d = Math.sqrt(d2) || 1e-6;
                                const nx = dx / d, ny = dy / d, nz = dz / d;
                                if (inForce) {
                                    const o = (off[i] + off[j]) * 0.5;
                                    const wave = (Math.sin(TAU * ((periods[i] + periods[j]) * 0.5 * d / rg + (phase[i] + phase[j]) * 0.5)) + o) / (1 + o);
                                    const sign = charge[i] * charge[j] < 0 ? 1 : -1;
                                    const f = sign * (force[i] + force[j]) * 0.5 * wave * (1 - d / rg) * factor;
                                    fx[i] += f * nx; fy[i] += f * ny; fz[i] += f * nz;
                                    fx[j] -= f * nx; fy[j] -= f * ny; fz[j] -= f * nz;
                                }
                                if (inBond) this.tryBond(i, j, nx, ny, nz);
                            }
                        }
                    }
                }
            }
        }

        /** A new bond i-j if both have room and the angles to their other bonds are wide enough. */
        tryBond(i, j, nx, ny, nz) {
            const deg = this.deg;
            if (deg[i] >= this.valence[i] || deg[j] >= this.valence[j]) return;
            if (EM.bonds.isBonded(this, i, j)) return;
            if (!this.angleOk(i, nx, ny, nz) || !this.angleOk(j, -nx, -ny, -nz)) return;
            if (this.rng.next() >= this.laws.env.bondChance) return;
            EM.bonds.add(this, i, j);
            this.bondsFormed++;
        }

        /** Direction (unit) from i to a new partner keeps >= bondAngle_i to every bond i already has. */
        angleOk(i, nx, ny, nz) {
            const lim = this.cosAngle[i], base = i * MV;
            for (let s = 0; s < this.deg[i]; s++) {
                const [ax, ay, az] = this.offset(i, this.partner[base + s]);
                const len = Math.hypot(ax, ay, az) || 1;
                if ((ax * nx + ay * ny + az * nz) / len > lim + 1e-6) return false;
            }
            return true;
        }

        // ---------- bonds: springs, breaking, angles ----------
        springs() {
            const L = this.laws, K = L.env.bondStrength, len = L.bondLen, brk = L.breakDist;
            const A = L.env.angleStiffness;
            const fx = this.fx, fy = this.fy, fz = this.fz, deg = this.deg, partner = this.partner;
            for (let i = 0; i < this.n; i++) {
                // bonds above the (possibly edited) valence break
                while (deg[i] > this.valence[i]) {
                    EM.bonds.remove(this, i, partner[i * MV + deg[i] - 1]);
                }
                for (let s = 0; s < deg[i]; s++) {
                    const j = partner[i * MV + s];
                    if (j < i) continue; // each bond once
                    const [dx, dy, dz] = this.offset(i, j);
                    const d = Math.hypot(dx, dy, dz) || 1e-6;
                    if (d > brk) {
                        EM.bonds.remove(this, i, j);
                        s--;
                        continue;
                    }
                    const f = K * (d - len) / d;
                    fx[i] += f * dx; fy[i] += f * dy; fz[i] += f * dz;
                    fx[j] -= f * dx; fy[j] -= f * dy; fz[j] -= f * dz;
                }
            }
            if (A <= 0) return;
            // two bonds of one photon closer than its bondAngle: push their ends apart
            for (let i = 0; i < this.n; i++) {
                const k = deg[i];
                if (k < 2) continue;
                const lim = this.cosAngle[i], base = i * MV;
                for (let a = 0; a < k; a++) {
                    const ja = partner[base + a];
                    const [ax, ay, az] = this.offset(i, ja);
                    const la = Math.hypot(ax, ay, az) || 1;
                    for (let b = a + 1; b < k; b++) {
                        const jb = partner[base + b];
                        const [bx, by, bz] = this.offset(i, jb);
                        const lb = Math.hypot(bx, by, bz) || 1;
                        const cos = (ax * bx + ay * by + az * bz) / (la * lb);
                        if (cos <= lim) continue;
                        // from ja to jb
                        let wx = bx - ax, wy = by - ay, wz = bz - az;
                        const wl = Math.hypot(wx, wy, wz) || 1;
                        const m = A * (cos - lim) / wl;
                        wx *= m; wy *= m; wz *= m;
                        fx[ja] -= wx; fy[ja] -= wy; fz[ja] -= wz;
                        fx[jb] += wx; fy[jb] += wy; fz[jb] += wz;
                    }
                }
            }
        }

        // ---------- motion (Gravitation: speed is kept, only the direction changes) ----------
        move() {
            const dt = this.laws.dt, W = this.width, H = this.height, D = this.depth;
            const x = this.x, y = this.y, z = this.z, vx = this.vx, vy = this.vy, vz = this.vz;
            for (let i = 0; i < this.n; i++) {
                const im = this.invMass[i] * dt;
                vx[i] += this.fx[i] * im;
                vy[i] += this.fy[i] * im;
                if (D) vz[i] += this.fz[i] * im;
                const target = this.speed[i];
                const s = Math.hypot(vx[i], vy[i], vz[i]);
                if (s > 1e-6) {
                    const k = target / s;
                    vx[i] *= k; vy[i] *= k; vz[i] *= k;
                } else if (target > 0) {
                    this.randomDirection(i, target);
                }
                x[i] += vx[i] * dt; y[i] += vy[i] * dt;
                if (x[i] < 0) x[i] += W; else if (x[i] >= W) x[i] -= W;
                if (y[i] < 0) y[i] += H; else if (y[i] >= H) y[i] -= H;
                if (D) {
                    z[i] += vz[i] * dt;
                    if (z[i] < 0) z[i] += D; else if (z[i] >= D) z[i] -= D;
                }
            }
        }

        // ---------- hard boundary: photons never overlap ----------
        contacts() {
            for (let it = 0; it < World.CONTACT_SWEEPS; it++) {
                if (this.contactSweep(it === 0) === 0) break;
            }
        }

        contactSweep(firstSweep) {
            const dmin = this.laws.dmin, d2min = dmin * dmin;
            const near = this.near, m = this.nearCount;
            const x = this.x, y = this.y, z = this.z, vx = this.vx, vy = this.vy, vz = this.vz;
            const D = this.depth;
            let overlaps = 0;
            for (let k = 0; k < m; k += 2) {
                const i = near[k], j = near[k + 1];
                const [dx, dy, dz] = this.offset(i, j);
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 >= d2min) continue;
                overlaps++;
                let d = Math.sqrt(d2), nx, ny, nz;
                if (d > 1e-6) { nx = dx / d; ny = dy / d; nz = dz / d; } else { nx = 1; ny = 0; nz = 0; d = 0; }
                const wi = this.invMass[i], wj = this.invMass[j], ws = wi + wj;
                const push = (dmin - d) / ws;
                x[i] -= nx * push * wi; y[i] -= ny * push * wi;
                x[j] += nx * push * wj; y[j] += ny * push * wj;
                if (D) { z[i] -= nz * push * wi; z[j] += nz * push * wj; }
                if (firstSweep) {
                    // no approaching through each other (the speed is restored next step)
                    const vn = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny + (vz[j] - vz[i]) * nz;
                    if (vn < 0) {
                        const imp = -vn / ws;
                        vx[i] -= nx * imp * wi; vy[i] -= ny * imp * wi;
                        vx[j] += nx * imp * wj; vy[j] += ny * imp * wj;
                        if (D) { vz[i] -= nz * imp * wi; vz[j] += nz * imp * wj; }
                    }
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

        addNear(i, j) {
            if (this.nearCount + 2 > this.near.length) {
                const bigger = new Int32Array(this.near.length * 2);
                bigger.set(this.near);
                this.near = bigger;
            }
            this.near[this.nearCount++] = i;
            this.near[this.nearCount++] = j;
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

        /** Sum of speeds (px/s) - a cheap motion readout. */
        kineticEnergy() {
            let e = 0;
            for (let i = 0; i < this.n; i++) e += Math.hypot(this.vx[i], this.vy[i], this.vz[i]);
            return e;
        }

        /** Sum of the photons' energy property. */
        internalEnergy() {
            let e = 0;
            for (let i = 0; i < this.n; i++) e += this.energyRaw[i];
            return e;
        }
    }

    /** max passes of the hard boundary per step (stops early when nothing overlaps) */
    World.CONTACT_SWEEPS = 4;
    EM.World = World;
})(EM);
