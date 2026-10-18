/**
 * Main animation loop. Exactly one requestAnimationFrame chain may exist:
 * start() cancels a pending frame before running a new one.
 */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    const fps = { render: 0, physics: 0 };
    let renderFrames = 0, physicsSteps = 0;
    let lastRenderSample = performance.now();
    let lastPhysicsSample = performance.now();

    const loop = {
        canvas,
        ctx,
        fps,
        running: false,
        animationId: null,

        /** Renders one frame (and advances physics when running). */
        frame() {
            sampleFps();

            PD.render.beginFrame(ctx);

            if (loop.running && sim.speed > 0) {
                const steps = PD.world.advance();
                physicsSteps += steps;
                // In slow motion a frame may run no physics; then redraw everything
                PD.render.drawWorld(ctx, steps === 0 && sim.timescale < 1);
                PD.world.afterFrame();
            } else if (loop.running && sim.speed === 0) {
                PD.render.drawFrozen(ctx);
            }

            PD.hud.update();
            PD.bonds.endFrame();
            PD.render.endFrame(ctx);
            PD.hud.updateCounters();

            if (loop.running) {
                loop.animationId = requestAnimationFrame(loop.frame);
            }
        },

        /** Starts the loop (renders the first frame immediately). */
        start() {
            loop.cancel();
            loop.running = true;
            loop.frame();
        },

        /** Stops the loop; the last frame stays on screen. */
        stop() {
            loop.running = false;
            loop.cancel();
        },

        cancel() {
            if (loop.animationId) {
                cancelAnimationFrame(loop.animationId);
                loop.animationId = null;
            }
        }
    };

    function sampleFps() {
        renderFrames++;
        const now = performance.now();
        if (now - lastRenderSample >= 1000) {
            fps.render = Math.round(renderFrames * 1000 / (now - lastRenderSample));
            renderFrames = 0;
            lastRenderSample = now;
        }
        if (now - lastPhysicsSample >= 1000) {
            fps.physics = Math.round(physicsSteps * 1000 / (now - lastPhysicsSample));
            physicsSteps = 0;
            lastPhysicsSample = now;
        }
    }

    PD.loop = loop;
})(window.PD);
