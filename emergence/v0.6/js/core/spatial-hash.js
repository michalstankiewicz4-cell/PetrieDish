/**
 * Uniform grid over a torus world, built with a counting sort (no allocations
 * per step). Cells are at least `minCell` wide, so all neighbours within
 * `minCell` of a photon are in its cell or one of the 8 surrounding cells.
 *
 * After build(): photons of cell c are items[cellStart[c] .. cellStart[c+1]).
 */
(function (EM) {
    'use strict';

    class SpatialHash {
        constructor(width, height, minCell) {
            this.width = width;
            this.height = height;
            // >= 3 columns/rows so the 3x3 neighbourhood never visits a cell twice
            this.cols = Math.max(3, Math.floor(width / minCell));
            this.rows = Math.max(3, Math.floor(height / minCell));
            this.cellW = width / this.cols;
            this.cellH = height / this.rows;

            const cells = this.cols * this.rows;
            this.cellStart = new Int32Array(cells + 1);
            this.cellCursor = new Int32Array(cells);
            this.cellOf = new Int32Array(0);
            this.items = new Int32Array(0);
        }

        build(x, y, n) {
            if (this.items.length < n) {
                this.items = new Int32Array(n);
                this.cellOf = new Int32Array(n);
            }
            const cols = this.cols, rows = this.rows;
            const invW = 1 / this.cellW, invH = 1 / this.cellH;
            const start = this.cellStart, cursor = this.cellCursor, cellOf = this.cellOf, items = this.items;
            const cells = cols * rows;

            cursor.fill(0);
            for (let i = 0; i < n; i++) {
                let cx = (x[i] * invW) | 0;
                let cy = (y[i] * invH) | 0;
                if (cx >= cols) cx = cols - 1; else if (cx < 0) cx = 0;
                if (cy >= rows) cy = rows - 1; else if (cy < 0) cy = 0;
                const c = cy * cols + cx;
                cellOf[i] = c;
                cursor[c]++;
            }

            let acc = 0;
            for (let c = 0; c < cells; c++) {
                start[c] = acc;
                acc += cursor[c];
                cursor[c] = start[c]; // reuse as write position
            }
            start[cells] = acc;

            for (let i = 0; i < n; i++) {
                items[cursor[cellOf[i]]++] = i;
            }
        }
    }

    EM.SpatialHash = SpatialHash;
})(EM);
