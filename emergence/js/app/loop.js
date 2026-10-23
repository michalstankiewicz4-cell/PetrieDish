/**
 * Animation loop: physics steps, observer passes, drawing, HUD.
 * CPU backend: steps run here, synchronously. GPU backend: steps are queued
 * on the GPU and the state comes back asynchronously (EM.GpuWorld.sync) -
 * the picture is then a frame or two behind the GPU, which nobody can see.
 */
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
        _syncing: false,
        _lastObserved: 0,
        _lastObserveTime: 0,

        frame(now) {
            const app = EM.app, world = app.world;
            if (world && app.gpu) {
                loop.gpuFrame(app, now);
            } else if (world && app.settings.running) {
                const t0 = performance.now();
                const every = EM.config.OBSERVE_EVERY;
                for (let s = 0; s < app.settings.stepsPerFrame; s++) {
                    world.step();
                    if (world.steps % every === 0) app.observer.observe();
                }
                loop._physMs += performance.now() - t0;
                loop._steps += app.settings.stepsPerFrame;
            }
            if (world) EM.renderer.draw(world, app.observer);

            loop._frames++;
            if (now - loop._last >= 1000) {
                const dt = (now - loop._last) / 1000;
                loop.fps = Math.round(loop._frames / dt);
                loop.stepsPerSecond = Math.round(loop._steps / dt);
                // GPU: the time per step is not measured, only the throughput
                loop.msPerStep = app.gpu ? (loop._steps ? (dt * 1000) / loop._steps : 0) : (loop._steps ? loop._physMs / loop._steps : 0);
                loop._frames = loop._steps = loop._physMs = 0;
                loop._last = now;
            }
            if (now - loop._uiTimer > 250) {
                loop._uiTimer = now;
                EM.ui.refresh();
            }
            requestAnimationFrame(loop.frame);
        },

        gpuFrame(app, now) {
            const g = app.gpu;
            if (app.settings.running && g.advance(app.settings.stepsPerFrame)) {
                loop._steps += app.settings.stepsPerFrame;
            }
            if (loop._syncing || (!app.settings.running && g.synced === g.steps)) return;
            loop._syncing = true;
            g.sync().then((updated) => {
                loop._syncing = false;
                if (!updated || app.gpu !== g) return;
                const w = g.world;
                if (w.steps < loop._lastObserved) loop._lastObserved = 0; // new world
                const t = performance.now();
                if (w.steps - loop._lastObserved >= EM.config.OBSERVE_EVERY && t - loop._lastObserveTime >= EM.config.OBSERVE_MS_GPU) {
                    loop._lastObserved = w.steps;
                    loop._lastObserveTime = t;
                    app.observer.observe();
                }
            });
        },

        start() {
            requestAnimationFrame(loop.frame);
        }
    };

    EM.loop = loop;
})(EM);
