/** Left panel: run controls, samples, world setup, speed and display options. */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const ctl = PD.controller;
    const { $, on, show, bindSlider, setSlider } = PD.dom;
    const KEYS = PD.config.STORAGE_KEYS;

    // ---------- run controls ----------
    on('startStopBtn', 'click', ctl.toggleRunning);
    on('resetBtn', 'click', ctl.reset);
    on('applySpeciesBtn', 'click', ctl.reset);
    on('randomizeBtn', 'click', ctl.randomize);
    on('quickRandomBtn', 'click', ctl.quickRandom);
    on('donateBtn', 'click', ctl.toggleDonate);

    // ---------- samples ----------
    const seedSelect = $('seedSelect');
    const seedInput = $('seedInput');
    const loadSeedBtn = $('loadSeedBtn');

    // Named samples come from PD.config.SAMPLES
    PD.config.SAMPLES.forEach(({ seed, name }) => {
        seedSelect.add(new Option(`${name} (${seed})`, String(seed)));
    });

    function showCustomSeedInput(visible) {
        show(seedInput, visible, 'inline-block');
        show(loadSeedBtn, visible, 'inline-block');
    }

    function loadSeedFromInput() {
        const value = seedInput.value.trim();
        if (!value) {
            alert('Please enter a sample number');
            return;
        }
        if (!ctl.loadSeed(value)) return;
        seedInput.value = '';
        showCustomSeedInput(false);
        seedSelect.value = '';
    }

    seedSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'custom') {
            showCustomSeedInput(true);
            seedInput.focus();
        } else {
            showCustomSeedInput(false);
            if (value !== '') ctl.loadSeed(value);
        }
    });
    loadSeedBtn.addEventListener('click', loadSeedFromInput);
    seedInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadSeedFromInput(); });

    // ---------- world setup ----------
    on('initModeSelect', 'change', (e) => { sim.initMode = e.target.value; });
    on('boundaryModeSelect', 'change', (e) => { sim.boundaryMode = e.target.value; });

    const onEnter = (e) => { if (e.key === 'Enter') ctl.applySize(); };
    on('widthInput', 'keypress', onEnter);
    on('heightInput', 'keypress', onEnter);

    bindSlider({ id: 'densityInput', out: 'densityValue', apply: (v) => { sim.particleCount = v; } });
    bindSlider({ id: 'speciesInput', out: 'speciesValue', apply: (v) => { sim.speciesCount = v; } });

    // ---------- time ----------
    on('speedInput', 'input', (e) => ctl.setSpeed(parseInt(e.target.value)));

    // FPS Booster: moving right slows the physics down (1.000x -> 0.001x)
    const timescaleInput = $('timescaleInput');
    const timescaleValue = $('timescaleValue');

    function applyTimescale(sliderValue) {
        sim.timescale = 1 - (parseInt(sliderValue, 10) / 100 * 0.999);
        timescaleValue.textContent = sim.timescale.toFixed(sim.timescale < 0.1 ? 3 : 2) + 'x';
        sim.physicsAccumulator = 0;
    }

    if (timescaleInput) {
        const saved = PD.storage.get(KEYS.fpsBooster);
        if (saved !== null) {
            timescaleInput.value = saved;
            applyTimescale(saved);
        }
        timescaleInput.addEventListener('input', (e) => {
            applyTimescale(e.target.value);
            PD.storage.set(KEYS.fpsBooster, e.target.value);
        });
    }

    // ---------- display toggles ----------
    PD.storage.bindCheckbox('fpsDisplayCheckbox', KEYS.fpsDisplay, (on) => { PD.ui.showFps = on; });
    PD.storage.bindCheckbox('seedDisplayCheckbox', KEYS.seedDisplay, (on) => { PD.ui.showSeed = on; });

    /** Updates the controls after the state was changed from code (sample loaded, defaults...). */
    function syncFromState() {
        $('boundaryModeSelect').value = sim.boundaryMode;
        $('initModeSelect').value = sim.initMode;
        setSlider('densityInput', sim.particleCount);
        setSlider('speciesInput', sim.speciesCount);
    }

    PD.ui.settings = { syncFromState };
})(window.PD);
