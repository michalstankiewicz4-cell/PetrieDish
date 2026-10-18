/** "Donate" easter egg: particles fly into the shape of a text. */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const state = sim.donate;
    const TEXT = 'DONATE PLEASE';
    const SAMPLE_STEP = 6;

    /** Rasterises `text` off-screen and returns the filled pixel positions (every SAMPLE_STEP px). */
    function textPoints(text, w, h) {
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const octx = off.getContext('2d');
        const fontSize = Math.min(Math.floor(w / (text.length * 0.62)), Math.floor(h * 0.28));
        octx.fillStyle = '#ffffff';
        octx.font = `900 ${fontSize}px Orbitron, Arial Black, sans-serif`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText(text, w / 2, h / 2);
        const data = octx.getImageData(0, 0, w, h).data;
        const points = [];
        for (let y = 0; y < h; y += SAMPLE_STEP) {
            for (let x = 0; x < w; x += SAMPLE_STEP) {
                if (data[(y * w + x) * 4 + 3] > 128) points.push({ x, y });
            }
        }
        return points;
    }

    function activate() {
        state.active = true;
        const points = textPoints(TEXT, sim.width, sim.height);
        if (points.length === 0) return;
        // Fisher-Yates shuffle so particles get random letters
        for (let i = points.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [points[i], points[j]] = [points[j], points[i]];
        }
        state.targets = [];
        const count = Math.min(sim.particles.length, points.length);
        for (let i = 0; i < count; i++) {
            state.targets.push({ particle: sim.particles[i], tx: points[i].x, ty: points[i].y });
        }
    }

    function deactivate() {
        state.active = false;
        state.targets = [];
    }

    /** Physics step hook: spring each targeted particle towards its letter pixel. */
    function applyForces() {
        if (!state.active || state.targets.length === 0) return;
        const targets = state.targets;
        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            const p = t.particle;
            if (!p || p.dead) continue;
            const dx = t.tx - p.x;
            const dy = t.ty - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1) {
                const force = Math.min(dist * 0.012, 1.8);
                p.vx += (dx / dist) * force;
                p.vy += (dy / dist) * force;
                p.vx *= 0.78;
                p.vy *= 0.78;
            }
        }
    }

    PD.donate = { activate, deactivate, applyForces };
})(window.PD);
