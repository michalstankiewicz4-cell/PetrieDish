/**
 * 3D version of EM.SpatialHash: uniform grid over a 3-torus (cube that wraps on
 * every face), built with a counting sort. Cells are at least `range / 2`
 * wide, so all neighbours within `range` are within 2 cells on every axis
 * (5x5x5 block). Half cells check ~2x less empty space than full-range cells.
 *
 * After build(): photons of cell c are items[cellStart[c] .. cellStart[c+1]).
 */
(function (EM) {
    'use strict';

    const REACH = 2; // cells per axis on each side
    /** Half of the 124 neighbour offsets: each pair of neighbouring cells is visited once. */
    const FORWARD = [];
    for (let dz = -REACH; dz <= REACH; dz++) {
        for (let dy = -REACH; dy <= REACH; dy++) {
            for (let dx = -REACH; dx <= REACH; dx++) {
                if (dz > 0 || (dz === 0 && dy > 0) || (dz === 0 && dy === 0 && dx > 0)) FORWARD.push([dx, dy, dz]);
            }
        }
    }

    class SpatialHash3 {
        constructor(width, height, depth, range) {
            this.width = width;
            this.height = height;
            this.depth = depth;
            const minCell = range / REACH;
            // >= 2*REACH+1 cells per axis so the 5x5x5 block never visits a cell twice
            const MIN = 2 * REACH + 1;
            this.cols = Math.max(MIN, Math.floor(width / minCell));
            this.rows = Math.max(MIN, Math.floor(height / minCell));
            this.layers = Math.max(MIN, Math.floor(depth / minCell));
            this.cellW = width / this.cols;
            this.cellH = height / this.rows;
            this.cellD = depth / this.layers;

            const cells = this.cols * this.rows * this.layers;
            this.cellStart = new Int32Array(cells + 1);
            this.cellCursor = new Int32Array(cells);
            this.cellOf = new Int32Array(0);
            this.items = new Int32Array(0);

            // neighbour cell index for every cell and forward offset (13 per cell), precomputed
            this.forward = new Int32Array(cells * FORWARD.length);
            for (let cz = 0; cz < this.layers; cz++) {
                for (let cy = 0; cy < this.rows; cy++) {
                    for (let cx = 0; cx < this.cols; cx++) {
                        const c = this.index(cx, cy, cz);
                        FORWARD.forEach(([dx, dy, dz], k) => {
                            this.forward[c * FORWARD.length + k] = this.index(
                                (cx + dx + this.cols) % this.cols,
                                (cy + dy + this.rows) % this.rows,
                                (cz + dz + this.layers) % this.layers);
                        });
                    }
                }
            }
        }

        index(cx, cy, cz) {
            return (cz * this.rows + cy) * this.cols + cx;
        }

        build(x, y, z, n) {
            if (this.items.length < n) {
                this.items = new Int32Array(n);
                this.cellOf = new Int32Array(n);
            }
            const cols = this.cols, rows = this.rows, layers = this.layers;
            const invW = 1 / this.cellW, invH = 1 / this.cellH, invD = 1 / this.cellD;
            const start = this.cellStart, cursor = this.cellCursor, cellOf = this.cellOf, items = this.items;
            const cells = cols * rows * layers;

            cursor.fill(0);
            for (let i = 0; i < n; i++) {
                let cx = (x[i] * invW) | 0, cy = (y[i] * invH) | 0, cz = (z[i] * invD) | 0;
                if (cx >= cols) cx = cols - 1; else if (cx < 0) cx = 0;
                if (cy >= rows) cy = rows - 1; else if (cy < 0) cy = 0;
                if (cz >= layers) cz = layers - 1; else if (cz < 0) cz = 0;
                const c = (cz * rows + cy) * cols + cx;
                cellOf[i] = c;
                cursor[c]++;
            }

            let acc = 0;
            for (let c = 0; c < cells; c++) {
                start[c] = acc;
                acc += cursor[c];
                cursor[c] = start[c];
            }
            start[cells] = acc;

            for (let i = 0; i < n; i++) items[cursor[cellOf[i]]++] = i;
        }
    }

    SpatialHash3.FORWARD_COUNT = FORWARD.length;
    EM.SpatialHash3 = SpatialHash3;
})(EM);
