/** Animation loop: physics steps, observer passes, drawing, HUD. */
(function (EM) {
    'use strict';

    const loop = {
        fps: 0,
        stepsPerSecond: 0,
        msPerStep: 0,
        _frames: 0,
        _steps: 0,
        _physMs: 0,
        _last: performance.now(),
        _uiTimer: 0,

        frame(now) {
            const app = EM.app, world = app.world;
            if (world) {
                if (app.settings.running) {
                    const t0 = performance.now();
                    const every = EM.config.OBSERVE_EVERY;
                    for (let s = 0; s < app.settings.stepsPerFrame; s++) {
                        world.step();
                        if (world.steps % every === 0) app.observer.observe();
                    }
                    loop._physMs += performance.now() - t0;
                    loop._steps += app.settings.stepsPerFrame;
                }
                EM.renderer.draw(world, app.observer);
            }

            loop._frames++;
            if (now - loop._last >= 1000) {
                const dt = (now - loop._last) / 1000;
                loop.fps = Math.round(loop._frames / dt);
                loop.stepsPerSecond = Math.round(loop._steps / dt);
                loop.msPerStep = loop._steps ? loop._physMs / loop._steps : 0;
                loop._frames = loop._steps = loop._physMs = 0;
                loop._last = now;
            }
            if (now - loop._uiTimer > 250) {
                loop._uiTimer = now;
                EM.ui.refresh();
            }
            requestAnimationFrame(loop.frame);
        },

        start() {
            requestAnimationFrame(loop.frame);
        }
    };

    EM.loop = loop;
})(EM);
