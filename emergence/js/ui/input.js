/**
 * Mouse and keyboard on the canvas:
 * wheel = zoom at cursor, drag = pan, click = inspect photon,
 * Space = play/pause, F = fit, N = new laws, M = mutate.
 */
(function (EM) {
    'use strict';

    const canvas = EM.renderer.canvas;
    const cam = EM.renderer.camera;
    let drag = null;

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        cam.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    canvas.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, moved: 0 };
        canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.x = e.clientX;
        drag.y = e.clientY;
        cam.pan(dx, dy);
    });

    canvas.addEventListener('pointerup', (e) => {
        if (drag && drag.moved < 4 && EM.app.world) {
            EM.ui.inspectPhoton(EM.renderer.pick(EM.app.world, e.offsetX, e.offsetY));
        }
        drag = null;
    });

    window.addEventListener('keydown', (e) => {
        if (e.target.matches('input, select, textarea')) return;
        const app = EM.app;
        if (e.code === 'Space') { e.preventDefault(); app.togglePlay(); }
        else if (e.key === 'f' || e.key === 'F') cam.fit(app.world.width, app.world.height);
        else if (e.key === 'n' || e.key === 'N') app.newLaws();
        else if (e.key === 'm' || e.key === 'M') app.mutate();
    });

    window.addEventListener('resize', () => EM.renderer.resize());
})(EM);
