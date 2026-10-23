/**
 * Mouse and keyboard on the world view (both 2D and 3D canvases):
 * 2D: wheel = zoom at cursor, drag = pan.
 * 3D: drag = rotate, right-drag / shift-drag = pan, wheel = zoom.
 * Click (without dragging) = inspect a photon.
 * Keys: Space = play/pause, F = fit, N = new laws, M = mutate, 3 = 2D/3D, G = CPU/GPU.
 */
(function (EM) {
    'use strict';

    const stage = document.getElementById('stage');
    let drag = null;

    stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        EM.renderer.onWheel(e);
    }, { passive: false });

    stage.addEventListener('contextmenu', (e) => e.preventDefault());

    stage.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, moved: 0 };
        stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.x = e.clientX;
        drag.y = e.clientY;
        EM.renderer.onDrag(dx, dy, e);
    });

    stage.addEventListener('pointerup', (e) => {
        if (drag && drag.moved < 4 && e.button === 0 && EM.app.world) {
            EM.ui.inspectPhoton(EM.renderer.pick(EM.app.world, e.offsetX, e.offsetY));
        }
        drag = null;
    });

    window.addEventListener('keydown', (e) => {
        if (e.target.matches('input, select, textarea')) return;
        const app = EM.app;
        if (e.code === 'Space') { e.preventDefault(); app.togglePlay(); }
        else if (e.key === 'f' || e.key === 'F') EM.renderer.fit(app.world);
        else if (e.key === 'n' || e.key === 'N') app.newLaws();
        else if (e.key === 'm' || e.key === 'M') app.mutate();
        else if (e.key === '3') app.setDim(app.settings.dim === 3 ? 2 : 3);
        else if (e.key === 'g' || e.key === 'G') app.setBackend(app.settings.backend === 'gpu' ? 'cpu' : 'gpu');
    });

    window.addEventListener('resize', () => EM.renderer.resize());
})(EM);
