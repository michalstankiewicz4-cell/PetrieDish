/**
 * Uniform grid for neighbour queries. Cells wrap around the edges (torus), so
 * neighbours across the border are found in every boundary mode.
 *
 * getNearby() is allocation-free: it fills an internal buffer and returns it.
 * Only the first `grid.nearbyLen` entries are valid, and the buffer is reused by
 * the next query - copy it if you need to keep the result.
 */
(function (PD) {
    'use strict';

    class SpatialGrid {
        constructor(width, height, cellSize) {
            this.width = width;
            this.height = height;
            this.cellSize = cellSize;
            this.cols = Math.ceil(width / cellSize);
            this.rows = Math.ceil(height / cellSize);
            this.cells = new Array(this.cols * this.rows);
            for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
            this._usedCells = [];
            this.nearbyBuf = new Array(256);
            this.nearbyLen = 0;
        }

        clear() {
            // Only clear the cells that were actually filled
            for (let i = 0; i < this._usedCells.length; i++) {
                this.cells[this._usedCells[i]].length = 0;
            }
            this._usedCells.length = 0;
        }

        insert(particle) {
            const x = particle.x;
            const y = particle.y;
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
            const idx = ((y / this.cellSize) | 0) * this.cols + ((x / this.cellSize) | 0);
            if (this.cells[idx].length === 0) this._usedCells.push(idx);
            this.cells[idx].push(particle);
        }

        /** Rebuilds the grid from a particle list. */
        rebuild(particles) {
            this.clear();
            for (let i = 0; i < particles.length; i++) {
                this.insert(particles[i]);
            }
        }

        /** @param {{x:number, y:number}} point */
        getNearby(point, range) {
            const buf = this.nearbyBuf;
            let len = 0;
            const col = (point.x / this.cellSize) | 0;
            const row = (point.y / this.cellSize) | 0;
            const cellRadius = Math.ceil(range / this.cellSize);
            const cols = this.cols, rows = this.rows;

            for (let i = -cellRadius; i <= cellRadius; i++) {
                for (let j = -cellRadius; j <= cellRadius; j++) {
                    const wCol = (col + i + cols) % cols;
                    const wRow = (row + j + rows) % rows;
                    const cell = this.cells[wRow * cols + wCol];
                    for (let k = 0; k < cell.length; k++) {
                        if (len >= buf.length) buf.length = buf.length * 2;
                        buf[len++] = cell[k];
                    }
                }
            }
            this.nearbyLen = len;
            return buf;
        }
    }

    PD.SpatialGrid = SpatialGrid;
})(window.PD);
