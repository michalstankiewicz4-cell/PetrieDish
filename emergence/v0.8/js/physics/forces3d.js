/**
 * Pair forces in 3D - the same laws as forces.js (hard core, ring-shaped wave,
 * orientation, bond candidates), on a 3-torus. Kept as a separate kernel so
 * the hot loop of each dimension stays simple and fast.
 *
 * Orientation in 3D: every photon has a unit heading vector h.
 *  - polar:  the wave is scaled by (1 + polar * (h_i . n))
 *  - torque: h_i turns towards (+) / away from (-) the neighbour:
 *            turn_i += torque * (n - (h_i . n) h_i) * (1 - d/R)
 *            (the component of n perpendicular to h; applied in integrate3d)
 */
(function (EM) {
    'use strict';

    const SIN_N = 4096, SIN_MASK = SIN_N - 1, SIN_K = SIN_N / (Math.PI * 2);
    const SIN = new Float32Array(SIN_N + 1);
    for (let i = 0; i <= SIN_N; i++) SIN[i] = Math.sin((i / SIN_N) * Math.PI * 2);

    function applyPairs(world) {
        const L = world.laws;
        const T = L.T;
        const x = world.x, y = world.y, z = world.z, fx = world.fx, fy = world.fy, fz = world.fz, type = world.type;
        const W = world.width, H = world.height, D = world.depth, hw = W / 2, hh = H / 2, hd = D / 2;
        const R = L.R, R2 = R * R, invR = 1 / R, coreR = L.coreR, coreK = L.coreK, fs = L.forceScale;
        const amp = L.amp, kk = L.k, ph = L.phase, off = L.offset, formDist = L.bondFormDist;
        // pairs closer than this may overlap after moving: the hard boundary checks them (World.contacts)
        const nearR = L.dmin + 2 * L.maxSpeed, near2 = nearR * nearR;
        world.nearCount = 0;
        const orient = L.hasOrientation, polar = L.polar, torque = L.torque;
        const hx = world.hx, hy = world.hy, hz = world.hz, tx = world.tx, ty = world.ty, tz = world.tz;
        const bonding = world.bondsEnabled, tryForm = EM.bonds.tryForm;
        const grid = world.grid, start = grid.cellStart, items = grid.items, fwd = grid.forward;
        const FN = EM.SpatialHash3.FORWARD_COUNT;
        const cells = grid.cols * grid.rows * grid.layers;

        for (let c = 0; c < cells; c++) {
            const s0 = start[c], s1 = start[c + 1];
            if (s0 === s1) continue;

            // f = -1: the cell itself (pairs a < b); f = 0..12: forward neighbours
            for (let f = -1; f < FN; f++) {
                let t0, t1;
                if (f < 0) {
                    t0 = s0; t1 = s1;
                } else {
                    const nc = fwd[c * FN + f];
                    t0 = start[nc]; t1 = start[nc + 1];
                    if (t0 === t1) continue;
                }

                for (let a = s0; a < s1; a++) {
                    const i = items[a];
                    const xi = x[i], yi = y[i], zi = z[i], ti = type[i], rowI = ti * T;
                    const bStart = f < 0 ? a + 1 : t0;

                    for (let b = bStart; b < t1; b++) {
                        const j = items[b];
                        let dx = x[j] - xi;
                        if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
                        let dy = y[j] - yi;
                        if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
                        let dz = z[j] - zi;
                        if (dz > hd) dz -= D; else if (dz < -hd) dz += D;
                        const d2 = dx * dx + dy * dy + dz * dz;
                        if (d2 >= R2) continue;
                        if (d2 < near2) world.addNear(i, j);
                        if (d2 === 0) continue;

                        const d = Math.sqrt(d2);
                        const nx = dx / d, ny = dy / d, nz = dz / d;
                        const tj = type[j];
                        const pij = rowI + tj;
                        let fij, fji;

                        if (d < coreR) {
                            fij = fji = coreK * (d / coreR - 1);
                        } else {
                            const fall = fs * (1 - d * invR);
                            let u = (kk[pij] * d + ph[pij]) * SIN_K;
                            let k0 = u | 0;
                            let fr = u - k0;
                            k0 &= SIN_MASK;
                            fij = amp[pij] * (SIN[k0] + (SIN[k0 + 1] - SIN[k0]) * fr + off[pij]) / (1 + off[pij]) * fall;
                            const pji = tj * T + ti;
                            if (pji === pij) {
                                fji = fij;
                            } else {
                                u = (kk[pji] * d + ph[pji]) * SIN_K;
                                k0 = u | 0;
                                fr = u - k0;
                                k0 &= SIN_MASK;
                                fji = amp[pji] * (SIN[k0] + (SIN[k0 + 1] - SIN[k0]) * fr + off[pji]) / (1 + off[pji]) * fall;
                            }

                            if (orient) {
                                const ci = hx[i] * nx + hy[i] * ny + hz[i] * nz;       // cos(h_i, i->j)
                                const cj = -(hx[j] * nx + hy[j] * ny + hz[j] * nz);    // cos(h_j, j->i)
                                if (polar[pij]) fij *= 1 + polar[pij] * ci;
                                if (polar[pji]) fji *= 1 + polar[pji] * cj;
                                const near = 1 - d * invR;
                                if (torque[pij]) {
                                    const k = torque[pij] * near;
                                    tx[i] += k * (nx - ci * hx[i]);
                                    ty[i] += k * (ny - ci * hy[i]);
                                    tz[i] += k * (nz - ci * hz[i]);
                                }
                                if (torque[pji]) {
                                    // direction j->i is -n, its cosine with h_j is cj
                                    const k = torque[pji] * near;
                                    tx[j] += k * (-nx - cj * hx[j]);
                                    ty[j] += k * (-ny - cj * hy[j]);
                                    tz[j] += k * (-nz - cj * hz[j]);
                                }
                            }
                        }

                        fx[i] += fij * nx;
                        fy[i] += fij * ny;
                        fz[i] += fij * nz;
                        fx[j] -= fji * nx;
                        fy[j] -= fji * ny;
                        fz[j] -= fji * nz;

                        if (bonding && d < formDist[pij]) tryForm(world, i, j, pij);
                    }
                }
            }
        }
    }

    EM.forces3d = { applyPairs };
})(EM);
