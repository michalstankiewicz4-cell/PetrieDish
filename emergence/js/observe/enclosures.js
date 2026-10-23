/**
 * Enclosures: empty regions completely surrounded by bonded matter - the
 * observable signature of a membrane / vesicle / cell. Nothing in the physics
 * knows about them.
 *
 * Method: rasterise bonded photons (and their bonds) into a coarse occupancy
 * grid, flood-fill the empty cells (torus), and treat every empty region except
 * the biggest one ("outside") as an enclosure if its area is in a sane range.
 * Observer code: reads the world, never changes it.
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;
    const MIN_CELLS = 2;          // smaller holes are just gaps between neighbours
    const MAX_AREA_FRACTION = 0.05;

    function cellSize(world) {
        // about one bond length: a closed chain of bonds then reliably seals the inside
        let sum = 0, cnt = 0;
        const L = world.laws, T = L.T;
        for (let p = 0; p < T * T; p++) if (L.bondAff[p] > 0) { sum += L.bondLen[p]; cnt++; }
        return Math.max(4, cnt ? sum / cnt : L.coreR * 2);
    }

    /**
     * @returns {{count:number, cells:number, regions:Array<{cells:number[], cx:number, cy:number, area:number}>, cell:number, cols:number, rows:number}}
     */
    function find(world) {
        const cell = cellSize(world);
        const cols = Math.max(3, Math.floor(world.width / cell));
        const rows = Math.max(3, Math.floor(world.height / cell));
        const cw = world.width / cols, ch = world.height / rows;
        const occ = new Uint8Array(cols * rows);
        const n = world.n, deg = world.deg, partner = world.partner, x = world.x, y = world.y;
        const W = world.width, H = world.height, hw = W / 2, hh = H / 2;

        const mark = (px, py) => {
            let cx = Math.floor(px / cw), cy = Math.floor(py / ch);
            cx = ((cx % cols) + cols) % cols;
            cy = ((cy % rows) + rows) % rows;
            occ[cy * cols + cx] = 1;
        };

        for (let i = 0; i < n; i++) {
            if (deg[i] === 0) continue;
            mark(x[i], y[i]);
            // walls are made of bonds: sample points along each bond so no gap leaks
            for (let s = 0; s < deg[i]; s++) {
                const j = partner[i * MV + s];
                if (j < i) continue;
                let dx = x[j] - x[i];
                if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
                let dy = y[j] - y[i];
                if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
                const steps = Math.ceil(Math.hypot(dx, dy) / (Math.min(cw, ch) * 0.5));
                for (let k = 1; k < steps; k++) mark(x[i] + (dx * k) / steps, y[i] + (dy * k) / steps);
            }
        }

        // flood fill empty cells (4-neighbourhood, so a diagonal gap does not count as sealed)
        const label = new Int32Array(cols * rows).fill(-1);
        const regions = [];
        const stack = [];
        for (let start = 0; start < occ.length; start++) {
            if (occ[start] || label[start] >= 0) continue;
            const id = regions.length;
            const cells = [];
            label[start] = id;
            stack.push(start);
            while (stack.length) {
                const c = stack.pop();
                cells.push(c);
                const cx = c % cols, cy = (c / cols) | 0;
                const nb = [
                    cy * cols + (cx + 1) % cols,
                    cy * cols + (cx - 1 + cols) % cols,
                    ((cy + 1) % rows) * cols + cx,
                    ((cy - 1 + rows) % rows) * cols + cx
                ];
                for (const q of nb) {
                    if (!occ[q] && label[q] < 0) {
                        label[q] = id;
                        stack.push(q);
                    }
                }
            }
            regions.push(cells);
        }

        // biggest empty region = outside
        let outside = -1, biggest = -1;
        regions.forEach((r, id) => { if (r.length > biggest) { biggest = r.length; outside = id; } });

        const maxCells = MAX_AREA_FRACTION * cols * rows;
        const out = [];
        let total = 0;
        regions.forEach((r, id) => {
            if (id === outside || r.length < MIN_CELLS || r.length > maxCells) return;
            // centre (unwrapped around the first cell)
            const fx = r[0] % cols, fy = (r[0] / cols) | 0;
            let sx = 0, sy = 0;
            for (const c of r) {
                let dx = (c % cols) - fx, dy = ((c / cols) | 0) - fy;
                if (dx > cols / 2) dx -= cols; else if (dx < -cols / 2) dx += cols;
                if (dy > rows / 2) dy -= rows; else if (dy < -rows / 2) dy += rows;
                sx += dx;
                sy += dy;
            }
            const cx = (((fx + sx / r.length + 0.5) * cw) % W + W) % W;
            const cy = (((fy + sy / r.length + 0.5) * ch) % H + H) % H;
            out.push({ cells: r, cx, cy, area: r.length * cw * ch });
            total += r.length;
        });

        return { count: out.length, cells: total, regions: out, cellW: cw, cellH: ch, cols, rows };
    }

    EM.enclosures = { find };
})(EM);
