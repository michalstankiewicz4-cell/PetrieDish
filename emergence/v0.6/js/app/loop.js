/**
 * Animation loop: physics steps, observer passes, drawing, HUD.
 * CPU backend: steps run here, synchronously. GPU backend: steps are queued
 * on the GPU and the state comes back asynchronously (EM.GpuWorld.sync) -
 * the picture is then a frame or two behind the GPU, which nobody can see.
 *
 * Fast forward (app.fast): nothing is drawn; each frame spends ~FAST_BUDGET_MS
 * on physics (CPU) or keeps the GPU queue full, then yields so the page stays
 * responsive and the Stop button works. Observers keep their usual rhythm.
 */
(function (EM) {
    'use strict';

    const FAST_BUDGET_MS = 40;   // CPU time per frame for physics in fast forward
    const FAST_SYNC_MS = 250;    // GPU fast forward: how often the state is read back
    const overlay = document.getElementById('fastOverlay');
    const fastStats = document.getElementById('fastStats');

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
        _lastSync: 0,
        _fastFrom: 0,

        frame(now) {
            const app = EM.app, world = app.world;
            if (world && app.gpu) {
                loop.gpuFrame(app, now);
            } else if (world && app.settings.running) {
                const t0 = performance.now();
                const every = EM.config.OBSERVE_EVERY;
                let done = 0;
                // normal: stepsPerFrame steps; fast forward: as many as fit in the budget
                while (app.fast ? performance.now() - t0 < FAST_BUDGET_MS : done < app.settings.stepsPerFrame) {
                    world.step();
                    if (world.steps % every === 0) app.observer.observe();
                    done++;
                }
                loop._physMs += performance.now() - t0;
                loop._steps += done;
            }
            if (world && !app.fast) EM.renderer.draw(world, app.observer);

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
                if (app.fast && world) {
                    const fmt = EM.ui.fmt;
                    fastStats.textContent = `step ${fmt(world.steps)} · +${fmt(world.steps - loop._fastFrom)} · ${fmt(loop.stepsPerSecond)} steps/s`;
                }
            }
            requestAnimationFrame(loop.frame);
        },

        gpuFrame(app, now) {
            const g = app.gpu;
            if (app.fast) {
                // keep the GPU queue full with the biggest batches
                while (g.advance(EM.GpuWorld.MAX_BATCH)) loop._steps += EM.GpuWorld.MAX_BATCH;
            } else if (app.settings.running && g.advance(app.settings.stepsPerFrame)) {
                loop._steps += app.settings.stepsPerFrame;
            }
            if (loop._syncing || (!app.settings.running && g.synced === g.steps)) return;
            if (app.fast && now - loop._lastSync < FAST_SYNC_MS) return;
            loop._lastSync = now;
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

        /** Shows / hides the fast-forward overlay (called by app.setFast). */
        onFast(on) {
            overlay.hidden = !on;
            if (on && EM.app.world) loop._fastFrom = EM.app.world.steps;
            fastStats.textContent = '';
        },

        start() {
            requestAnimationFrame(loop.frame);
        }
    };

    EM.loop = loop;
})(EM);
