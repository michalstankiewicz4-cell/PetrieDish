/**
 * HUD overlay (DOM, outside the canvas so VFX filters do not affect it) and
 * the small counters in the panels. DOM is touched only when a value changes.
 */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const el = {
        seed: document.getElementById('hudSeed'),
        fps: document.getElementById('hudFps'),
        fpsDot: document.getElementById('hudFpsDot'),
        fpsText: document.getElementById('hudFpsText'),
        bonds: document.getElementById('bondsCount'),
        life: document.getElementById('lifeFormsCount'),
        intelligent: document.getElementById('intelligentCount')
    };

    const prev = { render: -1, physics: -1, seed: undefined, bonds: -1, life: -1 };

    function fpsColor(fps) {
        if (fps <= 16) return '#FF006E';
        if (fps <= 23) return '#FFBE0B';
        return '#00FF00';
    }

    /** Seed + FPS badges. */
    function update() {
        if (el.seed) {
            if (PD.ui.showSeed) {
                if (sim.seed !== prev.seed) {
                    prev.seed = sim.seed;
                    el.seed.textContent = sim.seed !== null ? `Seed: ${sim.seed}` : 'Seed: Default';
                }
                el.seed.style.display = 'block';
            } else {
                el.seed.style.display = 'none';
            }
        }

        if (el.fps) {
            if (PD.ui.showFps) {
                const fps = PD.loop.fps;
                if (fps.render !== prev.render || fps.physics !== prev.physics) {
                    prev.render = fps.render;
                    prev.physics = fps.physics;
                    if (el.fpsDot) el.fpsDot.style.color = fpsColor(fps.render);
                    if (el.fpsText) el.fpsText.textContent = `Render: ${fps.render} | Physics: ${fps.physics}`;
                }
                el.fps.style.display = 'flex';
            } else {
                el.fps.style.display = 'none';
            }
        }
    }

    /** Bond / life-form counters in the panels. */
    function updateCounters() {
        const bc = sim.bonds.active.length;
        if (el.bonds && bc !== prev.bonds) {
            prev.bonds = bc;
            el.bonds.textContent = String(bc);
        }
        const lc = sim.life.forms.length;
        if (el.life && lc !== prev.life) {
            prev.life = lc;
            el.life.textContent = String(lc);
        }
    }

    /** Sets a counter directly (used when a mechanic is switched off). */
    function setCounter(name, value) {
        if (!el[name]) return;
        el[name].textContent = String(value);
        if (name in prev) prev[name] = value;
    }

    function updateIntelligentCount() {
        if (el.intelligent) el.intelligent.textContent = String(sim.intelligent.list.length);
    }

    PD.hud = { update, updateCounters, setCounter, updateIntelligentCount };
})(window.PD);
