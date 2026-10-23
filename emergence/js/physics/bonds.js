/**
 * Bonds: springs between two photons.
 *  - form when two photons are close, both have free valence, their relative
 *    speed is low enough (bindEnergy), together they have the activation
 *    energy (spent - it is now stored in the bond) and a random draw succeeds
 *  - pull towards the rest length (bondLength) with stiffness + damping
 *  - share internal energy along the bond (energyShare)
 *  - break when stretched beyond bondBreak, or spontaneously (decay, more
 *    likely with more energy); a breaking bond releases half of its activation
 *    energy back to both photons
 * Storage: world.partner[i * MAX_VALENCE + slot], world.deg[i] = used slots.
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;
    const DAMPING = 0.15;

    function isBonded(world, i, j) {
        const base = i * MV, partner = world.partner;
        for (let s = 0; s < world.deg[i]; s++) if (partner[base + s] === j) return true;
        return false;
    }

    function add(world, i, j) {
        world.partner[i * MV + world.deg[i]++] = j;
        world.partner[j * MV + world.deg[j]++] = i;
        world.bondCount++;
    }

    function removeSlot(world, i, j) {
        const base = i * MV, partner = world.partner;
        const last = --world.deg[i];
        for (let s = 0; s <= last; s++) {
            if (partner[base + s] === j) {
                partner[base + s] = partner[base + last];
                partner[base + last] = -1;
                return;
            }
        }
    }

    function remove(world, i, j) {
        removeSlot(world, i, j);
        removeSlot(world, j, i);
        world.bondCount--;
        world.bondsBroken++;
    }

    /** Breaking releases half of the stored activation energy to each photon. */
    function release(world, i, j, p) {
        const back = world.laws.activation[p] * 0.5;
        if (back > 0) {
            const e = world.energy;
            e[i] = Math.min(1, e[i] + back);
            e[j] = Math.min(1, e[j] + back);
        }
        remove(world, i, j);
    }

    /** Called by the pair loop for close pairs. `p` = typeI * T + typeJ. */
    function tryForm(world, i, j, p) {
        const L = world.laws;
        const aff = L.bondAff[p];
        if (aff <= 0) return;
        const deg = world.deg, type = world.type;
        if (deg[i] >= L.valence[type[i]] || deg[j] >= L.valence[type[j]]) return;
        const dvx = world.vx[j] - world.vx[i];
        const dvy = world.vy[j] - world.vy[i];
        const dvz = world.vz[j] - world.vz[i]; // 0 in 2D
        if (dvx * dvx + dvy * dvy + dvz * dvz > L.bindE[p]) return;
        const act = L.activation[p];
        const e = world.energy;
        if (act > 0 && e[i] + e[j] < act) return;
        if (isBonded(world, i, j)) return;
        if (world.rng.next() >= aff * L.bondFormRate) return;
        if (act > 0) {
            // spend the activation energy proportionally to what each photon has
            const k = 1 - act / (e[i] + e[j]);
            e[i] *= k;
            e[j] *= k;
        }
        add(world, i, j);
        world.bondsFormed++;
    }

    /** Spring forces; breaks over-stretched bonds. Each bond handled once (from the lower index). */
    function applySprings(world) {
        if (world.bondCount === 0) return;
        const L = world.laws, T = L.T;
        const n = world.n, deg = world.deg, partner = world.partner, type = world.type;
        const x = world.x, y = world.y, vx = world.vx, vy = world.vy, fx = world.fx, fy = world.fy;
        const z = world.z, vz = world.vz, fz = world.fz; // all 0 in 2D
        const W = world.width, H = world.height, D = world.depth, hw = W / 2, hh = H / 2, hd = D / 2;
        const e = world.energy, share = L.energyShare, decay = L.decay, rng = world.rng;

        for (let i = 0; i < n; i++) {
            // backwards: removing a bond moves the last slot into the current one
            for (let s = deg[i] - 1; s >= 0; s--) {
                const j = partner[i * MV + s];
                if (j < i) continue;

                let dx = x[j] - x[i];
                if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
                let dy = y[j] - y[i];
                if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
                let dz = z[j] - z[i];
                if (D) { if (dz > hd) dz -= D; else if (dz < -hd) dz += D; }
                const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
                const p = type[i] * T + type[j];

                if (d > L.bondBreak[p] || (decay[p] > 0 && rng.next() < decay[p] * (1 + e[i] + e[j]))) {
                    release(world, i, j, p);
                    continue;
                }

                if (share > 0) {
                    const flow = (e[j] - e[i]) * share * 0.5;
                    e[i] += flow;
                    e[j] -= flow;
                }

                const nx = dx / d, ny = dy / d, nz = dz / d;
                const along = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny + (vz[j] - vz[i]) * nz;
                const f = L.bondK[p] * (d - L.bondLen[p]) + DAMPING * along;
                fx[i] += f * nx;
                fy[i] += f * ny;
                fx[j] -= f * nx;
                fy[j] -= f * ny;
                if (D) {
                    fz[i] += f * nz;
                    fz[j] -= f * nz;
                }
            }
        }
    }

    /** Calls fn(i, j) once for every bond. */
    function forEach(world, fn) {
        const n = world.n, deg = world.deg, partner = world.partner;
        for (let i = 0; i < n; i++) {
            for (let s = 0; s < deg[i]; s++) {
                const j = partner[i * MV + s];
                if (j > i) fn(i, j);
            }
        }
    }

    function clearAll(world) {
        world.partner.fill(-1);
        world.deg.fill(0);
        world.bondCount = 0;
    }

    EM.bonds = { tryForm, applySprings, forEach, isBonded, add, remove, clearAll };
})(EM);
