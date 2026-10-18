/**
 * Mouse on the canvas: hold the left button to attract particles,
 * right click to add an intelligent particle (when Intelligent Life is on).
 */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const mouse = sim.mouse;
    const canvas = PD.loop.canvas;

    function canvasPoint(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.addEventListener('mousedown', (e) => {
        const { x, y } = canvasPoint(e);

        if (e.button === 2) {
            e.preventDefault();
            if (!sim.enabled.intelligent) {
                PD.log('⚠️ Enable "Intelligent Life" to add intelligent particles');
                return;
            }
            PD.world.addIntelligentParticle(x, y);
            PD.hud.updateIntelligentCount();
            return;
        }

        mouse.pressed = true;
        mouse.x = x;
        mouse.y = y;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!mouse.pressed) return;
        const { x, y } = canvasPoint(e);
        mouse.x = x;
        mouse.y = y;
    });

    const release = () => { mouse.pressed = false; };
    canvas.addEventListener('mouseup', release);
    canvas.addEventListener('mouseleave', release);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
})(window.PD);
