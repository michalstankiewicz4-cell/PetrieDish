/**
 * Pair forces between photons (each pair visited once):
 *  - hard core: d < coreR -> repulsion (photons do not overlap)
 *  - wave (as in Gravitation): forceScale * amp * sin(k*d + phase) * (1 - d/R)
 *    alternating attract/repel rings -> natural "shells" and stable distances.
 *    amp/k/phase are directional ([i][j] != [j][i] unless symmetry = 1).
 *  - orientation: the wave is scaled by (1 + polar * cos(heading of i, direction to j))
 *    ("head" and "tail" behave differently) and `torque` turns the heading
 *    towards (+) or away from (-) the neighbour.
 * Close pairs are also offered to EM.bonds as bond candidates.
 */
(function (EM) {
    'use strict';

    // sine lookup table (the force is evaluated for every close pair, every step)
    const SIN_N = 4096, SIN_MASK = SIN_N - 1, TAU = Math.PI * 2, SIN_K = SIN_N / TAU;
    const SIN = new Float32Array(SIN_N + 1);
    for (let i = 0; i <= SIN_N; i++) SIN[i] = Math.sin((i / SIN_N) * TAU);
    function fsin(a) {
        let u = (a * SIN_K) % SIN_N;
        if (u < 0) u += SIN_N;
        const i = u | 0, f = u - i;
        return SIN[i] + (SIN[i + 1] - SIN[i]) * f;
    }

    // half-shell stencil: the cell itself (pairs a<b) + 4 forward neighbours,
    // so every unordered pair of neighbouring cells is visited exactly once
    const FORWARD = [[1, 0], [-1, 1], [0, 1], [1, 1]];

    function applyPairs(world) {
        const L = world.laws;
        const T = L.T;
        const x = world.x, y = world.y, fx = world.fx, fy = world.fy, type = world.type;
        const W = world.width, H = world.height, hw = W / 2, hh = H / 2;
        const R = L.R, R2 = R * R, invR = 1 / R, coreR = L.coreR, coreK = L.coreK, fs = L.forceScale;
        const amp = L.amp, kk = L.k, ph = L.phase, off = L.offset, formDist = L.bondFormDist;
        // pairs closer than this may overlap after moving: the hard boundary checks them (World.contacts)
        const nearR = L.dmin + 2 * L.maxSpeed, near2 = nearR * nearR;
        world.nearCount = 0;
        const orient = L.hasOrientation, polar = L.polar, torque = L.torque;
        const hx = world.hx, hy = world.hy, turn = world.turn;
        const bonding = world.bondsEnabled, tryForm = EM.bonds.tryForm;
        const grid = world.grid, cols = grid.cols, rows = grid.rows, start = grid.cellStart, items = grid.items;
        const SINT = SIN;

        for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
                const c = cy * cols + cx;
                const s0 = start[c], s1 = start[c + 1];
                if (s0 === s1) continue;

                // f = -1: the cell itself (pairs a < b); f = 0..3: forward neighbours
                for (let f = -1; f < 4; f++) {
                    let t0, t1;
                    if (f < 0) {
                        t0 = s0; t1 = s1;
                    } else {
                        const nc = ((cy + FORWARD[f][1]) % rows) * cols + (cx + FORWARD[f][0] + cols) % cols;
                        t0 = start[nc]; t1 = start[nc + 1];
                        if (t0 === t1) continue;
                    }

                    for (let a = s0; a < s1; a++) {
                        const i = items[a];
                        const xi = x[i], yi = y[i], ti = type[i], rowI = ti * T;
                        const bStart = f < 0 ? a + 1 : t0;

                        for (let b = bStart; b < t1; b++) {
                            const j = items[b];
                            let dx = x[j] - xi;
                            if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
                            let dy = y[j] - yi;
                            if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
                            const d2 = dx * dx + dy * dy;
                            if (d2 >= R2) continue;
                            if (d2 < near2) world.addNear(i, j);
                            if (d2 === 0) continue;

                            const d = Math.sqrt(d2);
                            const nx = dx / d, ny = dy / d;
                            const tj = type[j];
                            const pij = rowI + tj;
                            let fij, fji;

                            if (d < coreR) {
                                fij = fji = coreK * (d / coreR - 1);
                            } else {
                                const fall = fs * (1 - d * invR);
                                // inline sine lookup (see fsin)
                                // argument is >= 0 (k, d, phase >= 0), so a bit mask wraps the index
                                let u = (kk[pij] * d + ph[pij]) * SIN_K;
                                let k0 = u | 0;
                                let fr = u - k0;
                                k0 &= SIN_MASK;
                                fij = amp[pij] * (SINT[k0] + (SINT[k0 + 1] - SINT[k0]) * fr + off[pij]) / (1 + off[pij]) * fall;
                                const pji = tj * T + ti;
                                if (pji === pij) {
                                    fji = fij;
                                } else {
                                    u = (kk[pji] * d + ph[pji]) * SIN_K;
                                    k0 = u | 0;
                                    fr = u - k0;
                                    k0 &= SIN_MASK;
                                    fji = amp[pji] * (SINT[k0] + (SINT[k0 + 1] - SINT[k0]) * fr + off[pji]) / (1 + off[pji]) * fall;
                                }

                                if (orient) {
                                    const ci = hx[i] * nx + hy[i] * ny;      // cos(heading i, i->j)
                                    const cj = -(hx[j] * nx + hy[j] * ny);   // cos(heading j, j->i)
                                    if (polar[pij]) fij *= 1 + polar[pij] * ci;
                                    if (polar[pji]) fji *= 1 + polar[pji] * cj;
                                    const near = 1 - d * invR;
                                    // cross(heading, direction) > 0 -> the neighbour is to the left -> turn left
                                    if (torque[pij]) turn[i] += torque[pij] * (hx[i] * ny - hy[i] * nx) * near;
                                    if (torque[pji]) turn[j] += torque[pji] * (hy[j] * nx - hx[j] * ny) * near;
                                }
                            }

                            // positive force pulls the photon towards the other one
                            fx[i] += fij * nx;
                            fy[i] += fij * ny;
                            fx[j] -= fji * nx;
                            fy[j] -= fji * ny;

                            if (bonding && d < formDist[pij]) tryForm(world, i, j, pij);
                        }
                    }
                }
            }
        }
    }

    EM.forces = { applyPairs, fsin };
})(EM);
