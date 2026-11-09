/** Small pictures of catalog entries (the "periodic table" of structures). */
(function (EM) {
    'use strict';

    /**
     * Draws a structure snapshot centred in a canvas.
     * @param {HTMLCanvasElement} canvas
     * @param {object} entry   catalog entry (shape, types, links)
     * @param {string[]} colors colour per type
     */
    function drawTile(canvas, entry, colors) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // 3D shapes: simple oblique projection (z goes up-right), so depth stays readable
        const shape = entry.shape.map(([px, py, pz = 0]) => [px + pz * 0.55, py - pz * 0.35]);
        entry = Object.assign({}, entry, { shape });

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [px, py] of entry.shape) {
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
        }
        const span = Math.max(maxX - minX, maxY - minY, 1);
        const pad = 6;
        const s = Math.min(4, (Math.min(w, h) - pad * 2) / span);
        const ox = w / 2 - ((minX + maxX) / 2) * s;
        const oy = h / 2 - ((minY + maxY) / 2) * s;

        ctx.strokeStyle = 'rgba(200, 215, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [a, b] of entry.links) {
            ctx.moveTo(ox + entry.shape[a][0] * s, oy + entry.shape[a][1] * s);
            ctx.lineTo(ox + entry.shape[b][0] * s, oy + entry.shape[b][1] * s);
        }
        ctx.stroke();

        const r = Math.max(1.5, Math.min(3, s * 0.9));
        entry.shape.forEach(([px, py], k) => {
            ctx.fillStyle = colors[entry.types[k]] || '#fff';
            ctx.beginPath();
            ctx.arc(ox + px * s, oy + py * s, r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    EM.tiles = { drawTile };
})(EM);
