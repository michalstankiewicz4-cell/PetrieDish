/**
 * Light: the energy source of the world (environment, like the substance grid
 * in CellsEvolution). A coarse scalar field = ambient + drifting "suns"
 * (gaussian spots / balls in 3D), optionally pulsing with a day/night cycle.
 * Photons of types that absorb light gain internal energy from it.
 */
(function (EM) {
    'use strict';

    const CELL = 32;           // px per light cell
    const UPDATE_EVERY = 10;   // steps between field updates

    class Light {
        constructor(world) {
            const L = world.laws.light;
            this.params = L;
            this.width = world.width;
            this.height = world.height;
            this.depth = world.depth;
            this.cols = Math.max(1, Math.ceil(world.width / CELL));
            this.rows = Math.max(1, Math.ceil(world.height / CELL));
            this.layers = world.depth ? Math.max(1, Math.ceil(world.depth / CELL)) : 1;
            this.field = new Float32Array(this.cols * this.rows * this.layers);
            this.day = 1;

            const rng = world.rng;
            const minDim = world.depth ? Math.min(world.width, world.height, world.depth) : Math.min(world.width, world.height);
            this.suns = [];
            for (let s = 0; s < L.suns; s++) {
                const angle = rng.next() * Math.PI * 2;
                const sun = {
                    x: rng.next() * world.width,
                    y: rng.next() * world.height,
                    z: 0,
                    vx: Math.cos(angle) * L.drift,
                    vy: Math.sin(angle) * L.drift,
                    vz: 0,
                    r: L.radius * minDim * (0.7 + 0.6 * rng.next())
                };
                if (world.depth) {
                    // extra draws only in 3D, so 2D worlds keep their exact random sequence
                    sun.z = rng.next() * world.depth;
                    const elev = (rng.next() - 0.5) * Math.PI;
                    sun.vx *= Math.cos(elev);
                    sun.vy *= Math.cos(elev);
                    sun.vz = Math.sin(elev) * L.drift;
                }
                this.suns.push(sun);
            }
            this.update(0, true);
        }

        /** Moves suns and recomputes the field (every UPDATE_EVERY steps). */
        update(step, force) {
            const L = this.params, W = this.width, H = this.height, D = this.depth;
            for (const s of this.suns) {
                s.x = (s.x + s.vx + W) % W;
                s.y = (s.y + s.vy + H) % H;
                if (D) s.z = (s.z + s.vz + D) % D;
            }
            if (!force && step % UPDATE_EVERY !== 0) return;

            this.day = L.dayPeriod ? 0.5 + 0.5 * Math.sin((2 * Math.PI * step) / L.dayPeriod) : 1;
            const f = this.field, cols = this.cols, rows = this.rows, layers = this.layers;
            const hw = W / 2, hh = H / 2, hd = D / 2;
            for (let cz = 0; cz < layers; cz++) {
                const pz = (cz + 0.5) * CELL;
                for (let cy = 0; cy < rows; cy++) {
                    const py = (cy + 0.5) * CELL;
                    for (let cx = 0; cx < cols; cx++) {
                        const px = (cx + 0.5) * CELL;
                        let v = L.ambient;
                        for (const s of this.suns) {
                            let dx = px - s.x;
                            if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
                            let dy = py - s.y;
                            if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
                            let d2 = dx * dx + dy * dy;
                            if (D) {
                                let dz = pz - s.z;
                                if (dz > hd) dz -= D; else if (dz < -hd) dz += D;
                                d2 += dz * dz;
                            }
                            v += Math.exp(-d2 / (2 * s.r * s.r));
                        }
                        f[(cz * rows + cy) * cols + cx] = Math.min(1.5, v) * this.day;
                    }
                }
            }
        }

        /** Light at a 2D position. */
        at(x, y) {
            let cx = (x / CELL) | 0, cy = (y / CELL) | 0;
            if (cx >= this.cols) cx = this.cols - 1;
            if (cy >= this.rows) cy = this.rows - 1;
            return this.field[cy * this.cols + cx];
        }

        /** Light at a 3D position. */
        at3(x, y, z) {
            let cx = (x / CELL) | 0, cy = (y / CELL) | 0, cz = (z / CELL) | 0;
            if (cx >= this.cols) cx = this.cols - 1;
            if (cy >= this.rows) cy = this.rows - 1;
            if (cz >= this.layers) cz = this.layers - 1;
            return this.field[(cz * this.rows + cy) * this.cols + cx];
        }
    }

    Light.CELL = CELL;
    EM.Light = Light;
})(EM);
