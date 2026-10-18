/** Entry point - runs after every other script (see the order in index.html). */
(function (PD) {
    'use strict';

    const ctl = PD.controller;

    ctl.setCanvasSize(PD.sim.width, PD.sim.height);
    window.addEventListener('resize', ctl.fitToWindow);

    async function init() {
        try {
            await document.fonts.ready; // Orbitron is used for canvas text
        } catch (e) { /* fonts are optional */ }

        PD.world.init();
        PD.render.clear(PD.loop.ctx);
        document.getElementById('currentSeedDisplay').textContent = 'Default';
        ctl.updateButtonState();
        PD.hud.update();

        PD.log(`✅ Petrie Dish v${PD.VERSION}`);
    }

    init();
})(window.PD);
