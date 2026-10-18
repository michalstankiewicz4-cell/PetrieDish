/**
 * Right panel: mechanic on/off switches and their parameter sliders.
 *
 * To add a mechanic: add a flag to PD.sim.enabled, a checkbox + options block in
 * index.html, an entry in MECHANICS and its sliders in SLIDERS below.
 */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const { $, show, bindSlider, setSlider } = PD.dom;

    const pct = (v) => v + '%';
    const px = (v) => v + 'px';

    /** key = flag in sim.enabled; onChange runs after the flag was updated. */
    const MECHANICS = [
        { key: 'attraction', checkbox: 'attractionCheckbox', options: 'attractionOptions' },
        { key: 'charges', checkbox: 'chargesCheckbox', options: 'chargesOptions' },
        { key: 'mass', checkbox: 'massCheckbox', options: 'massOptions' },
        { key: 'mixing', checkbox: 'mixingCheckbox', options: 'mixingOptions' },
        { key: 'vortex', checkbox: 'vortexCheckbox', options: 'vortexOptions' },
        { key: 'swarm', checkbox: 'swarmCheckbox', options: 'swarmOptions' },
        { key: 'massTransfer', checkbox: 'massTransferCheckbox', options: 'massTransferOptions' },
        { key: 'massHierarchy', checkbox: 'massHierarchyCheckbox', options: 'massHierarchyOptions' },
        { key: 'viscosity', checkbox: 'viscosityCheckbox', options: 'viscosityOptions' },
        { key: 'initialSpeed', checkbox: 'initialSpeedCheckbox', options: 'initialSpeedOptions' },
        {
            key: 'intelligent', checkbox: 'intelligentCheckbox', options: 'intelligentOptions',
            onChange(enabled) {
                if (enabled) return;
                PD.world.removeIntelligentParticles();
                PD.hud.updateIntelligentCount();
            }
        },
        {
            key: 'bonds', checkbox: 'bondsCheckbox', options: 'bondsOptions',
            onChange(enabled) {
                if (enabled) return;
                PD.bonds.clearFromParticles(sim.particles);
                PD.hud.setCounter('bonds', 0);
            }
        }
    ];

    /** Slider -> state mapping. Values are the raw integer slider positions. */
    const SLIDERS = [
        { id: 'attractionStrength', out: 'attractionStrengthValue', format: pct, apply: (v) => { sim.attractionStrength = v / 100; } },
        { id: 'chargeForce', out: 'chargeForceValue', format: pct, apply: (v) => { sim.chargeForce = v / 100; } },
        { id: 'massEffect', out: 'massEffectValue', format: pct, apply: (v) => { sim.massEffect = v / 100; } },
        { id: 'blendRate', out: 'blendRateValue', format: pct, apply: (v) => { sim.blendRate = v / 1000; } },          // 0-100 -> 0.00-0.10
        { id: 'vorticnessSlider', out: 'vorticnessValue', format: pct, apply: (v) => { sim.vorticness = v / 2000; } }, // 0-100 -> 0.00-0.05
        { id: 'swarmStrength', out: 'swarmStrengthValue', format: pct, apply: (v) => { sim.swarmStrength = v / 1000; } },
        { id: 'swarmRange', out: 'swarmRangeValue', format: px, apply: (v) => { sim.swarmRange = v; } },
        { id: 'transferRate', out: 'transferRateValue', format: pct, apply: (v) => { sim.transferRate = v / 10000; } }, // 0-100 -> 0.000-0.010
        { id: 'hierarchyStrength', out: 'hierarchyStrengthValue', format: pct, apply: (v) => { sim.hierarchyStrength = v / 100; } },
        { id: 'viscosityInput', out: 'viscosityValueSpan', format: (v) => (v / 100).toFixed(2), apply: (v) => { sim.viscosity = v / 100; } },
        { id: 'futureFramesInput', out: 'futureValue', apply: (v) => { sim.intelligent.futureFrames = v; } },
        { id: 'bondFormationTime', out: 'bondFormationTimeValue', format: (v) => v + 's', apply: (v) => { sim.bonds.formationTime = v; } },
        { id: 'bondMaxDistance', out: 'bondMaxDistanceValue', format: px, apply: (v) => { sim.bonds.maxDistance = v; } },
        { id: 'bondMaxBonds', out: 'bondMaxBondsValue', apply: (v) => { sim.bonds.maxPerParticle = v; } },
        { id: 'bondLength', out: 'bondLengthValue', format: px, apply: (v) => { sim.bonds.length = v; } }
    ];

    /** Shows/hides the options block and (dis)ables its sliders. */
    function showOptions(m, enabled) {
        const options = $(m.options);
        show(options, enabled);
        options.querySelectorAll('input[type="range"]').forEach((input) => { input.disabled = !enabled; });
    }

    MECHANICS.forEach((m) => {
        m.box = $(m.checkbox);
        m.box.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            sim.enabled[m.key] = enabled;
            showOptions(m, enabled);
            if (m.onChange) m.onChange(enabled);
        });
    });

    SLIDERS.forEach(bindSlider);

    $('showGhostCheckbox').addEventListener('change', (e) => {
        sim.intelligent.showGhost = e.target.checked;
    });

    /**
     * Reflects sim.enabled in the checkboxes after a sample/defaults were applied.
     * @param {{viscosity?:number, vorticnessPercent?:number}} [sliders] slider positions to show
     */
    function syncFromState(sliders = {}) {
        MECHANICS.forEach((m) => {
            const enabled = !!sim.enabled[m.key];
            m.box.checked = enabled;
            showOptions(m, enabled);
        });
        if (sliders.viscosity !== undefined) setSlider('viscosityInput', sliders.viscosity);
        if (sliders.vorticnessPercent !== undefined) setSlider('vorticnessSlider', sliders.vorticnessPercent);
    }

    PD.ui.mechanics = { syncFromState };
})(window.PD);
