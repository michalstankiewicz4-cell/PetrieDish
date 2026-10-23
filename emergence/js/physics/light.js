/**
 * Light: the energy source of the world (environment, like the substance grid
 * in CellsEvolution). A coarse scalar field = ambient + drifting "suns"
 * (gaussian spots), optionally pulsing with a day/night cycle.
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
            this.cols = Math.max(1, Math.ceil(world.width / CELL));
            this.rows = Math.max(1, Math.ceil(world.height / CELL));
            this.field = new Float32Array(this.cols * this.rows);
            this.day = 1;

            const rng = world.rng;
            const minDim = Math.min(world.width, world.height);
            this.suns = [];
            for (let s = 0; s < L.suns; s++) {
                const angle = rng.next() * Math.PI * 2;
                this.suns.push({
                    x: rng.next() * world.width,
                    y: rng.next() * world.height,
                    vx: Math.cos(angle) * L.drift,
                    vy: Math.sin(angle) * L.drift,
                    r: L.radius * minDim * (0.7 + 0.6 * rng.next())
                });
            }
            this.update(0, true);
        }

        /** Moves suns and recomputes the field (every UPDATE_EVERY steps). */
        update(step, force) {
            const L = this.params, W = this.width, H = this.height;
            for (const s of this.suns) {
                s.x = (s.x + s.vx + W) % W;
                s.y = (s.y + s.vy + H) % H;
            }
            if (!force && step % UPDATE_EVERY !== 0) return;

            this.day = L.dayPeriod ? 0.5 + 0.5 * Math.sin((2 * Math.PI * step) / L.dayPeriod) : 1;
            const f = this.field, cols = this.cols, rows = this.rows;
            const hw = W / 2, hh = H / 2;
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
                        v += Math.exp(-(dx * dx + dy * dy) / (2 * s.r * s.r));
                    }
                    f[cy * cols + cx] = Math.min(1.5, v) * this.day;
                }
            }
        }

        at(x, y) {
            let cx = (x / CELL) | 0, cy = (y / CELL) | 0;
            if (cx >= this.cols) cx = this.cols - 1;
            if (cy >= this.rows) cy = this.rows - 1;
            return this.field[cy * this.cols + cx];
        }
    }

    Light.CELL = CELL;
    EM.Light = Light;
})(EM);
