/**
 * High-level actions shared by several UI elements: start/stop, reset,
 * loading samples, randomising, resizing. UI modules call these instead of
 * poking at the loop and the world directly.
 */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const loop = PD.loop;
    const cfg = PD.config;
    const $ = (id) => document.getElementById(id);

    const el = {
        startStop: $('startStopBtn'),
        speedInput: $('speedInput'),
        speedValue: $('speedValue'),
        currentSeed: $('currentSeedDisplay'),
        widthInput: $('widthInput'),
        heightInput: $('heightInput'),
        donateBtn: $('donateBtn'),
        matrixModal: $('matrixModal'),
        propertiesModal: $('propertiesModal')
    };

    function updateButtonState() {
        el.startStop.textContent = loop.running ? '⏹️ Stop' : '▶️ Start';
        el.startStop.classList.toggle('running', loop.running);
    }

    function showSpeed(percent) {
        el.speedInput.value = percent;
        el.speedValue.textContent = percent + '%';
    }

    /** Speed slider handler (0-200 %). */
    function setSpeed(percent) {
        const oldSpeed = sim.speed;
        sim.speed = percent / 100;
        el.speedValue.textContent = percent + '%';
        if (oldSpeed > 0 && percent === 0) sim.speedBeforePause = oldSpeed;
        if (loop.running) PD.hud.update();
    }

    /** Starts the simulation, restoring the speed it had before a pause. */
    function play() {
        if (sim.speed === 0) {
            sim.speed = sim.speedBeforePause > 0 ? sim.speedBeforePause : 1.0;
            showSpeed(Math.round(sim.speed * 100));
        }
        loop.start();
        updateButtonState();
    }

    function pause() {
        sim.speedBeforePause = sim.speed;
        sim.speed = 0;
        showSpeed(0);
        loop.stop();
        PD.hud.update();
        updateButtonState();
    }

    function toggleRunning() {
        if (loop.running) pause(); else play();
    }

    function stopDonate() {
        if (!sim.donate.active) return;
        PD.donate.deactivate();
        el.donateBtn.classList.remove('active');
    }

    function toggleDonate() {
        if (sim.donate.active) {
            stopDonate();
            return;
        }
        if (!loop.running) play();
        el.donateBtn.classList.add('active');
        PD.donate.activate();
    }

    /** Spawns a fresh population with the current settings, keeping the run state. */
    function rebuildWorld() {
        const wasRunning = loop.running;
        loop.stop();

        PD.world.init();
        PD.hud.updateIntelligentCount();
        PD.render.clear(loop.ctx);

        updateButtonState();
        if (wasRunning) {
            loop.start();
        } else {
            PD.hud.update();
        }
    }

    /** "Reset" / "Apply" buttons. */
    function reset() {
        stopDonate();
        rebuildWorld();
    }

    function refreshOpenEditors() {
        if (el.matrixModal.classList.contains('active')) PD.ui.colorEditors.renderMatrix();
        if (el.propertiesModal.classList.contains('active')) PD.ui.colorEditors.renderProperties();
    }

    /**
     * Applies a sample number to the settings (does not respawn particles).
     * @returns {boolean} false when the value is not an integer
     */
    function applySeed(value) {
        const seed = parseInt(value);
        if (isNaN(seed)) {
            alert('Sample must be an integer');
            return false;
        }

        const { settings, colors, matrix } = PD.seed.generate(seed);
        sim.seed = seed;
        const name = cfg.SAMPLE_NAMES[String(seed)];
        el.currentSeed.textContent = name ? `${name} (${seed})` : seed;

        const en = sim.enabled;
        en.attraction = settings.attraction;
        en.charges = settings.charges;
        en.mass = settings.mass;
        en.mixing = settings.mixing;
        en.vortex = settings.vortex;
        en.swarm = settings.swarm;
        en.massTransfer = settings.massTransfer;
        en.massHierarchy = settings.massHierarchy;
        en.initialSpeed = settings.initialSpeed;
        en.bonds = false; // never from a seed - manual only (performance)

        sim.boundaryMode = 'warp';
        sim.initMode = settings.initMode;
        sim.particleCount = settings.particleCount;
        sim.speciesCount = settings.speciesCount;
        setSpeed(100);
        sim.viscosity = settings.viscosity / 100;
        sim.vorticness = settings.vorticness / 100;

        // Keep 15 colour slots so the species slider can still add colours
        sim.colors = [...colors];
        while (sim.colors.length < cfg.MAX_SPECIES) {
            sim.colors.push(JSON.parse(JSON.stringify(cfg.DEFAULT_COLORS[sim.colors.length])));
        }
        sim.matrix = matrix;

        PD.ui.settings.syncFromState();
        PD.ui.mechanics.syncFromState({
            viscosity: settings.viscosity,
            vorticnessPercent: Math.round((settings.vorticness / 5.0) * 100)
        });
        refreshOpenEditors();

        PD.log('🎲 sample loaded', seed);
        return true;
    }

    /** Applies a sample and respawns the world. */
    function loadSeed(value) {
        if (!applySeed(value)) return false;
        rebuildWorld();
        return true;
    }

    /** The hand-tuned "Default" setup (no sample number). */
    function applyDefaults() {
        sim.colors = PD.seed.defaultColors();
        sim.matrix = PD.seed.defaultMatrix();
        sim.seed = null;
        el.currentSeed.textContent = 'Default';

        Object.assign(sim.enabled, {
            attraction: true, charges: false, mass: true, mixing: false, vortex: false,
            swarm: false, massTransfer: false, massHierarchy: false, initialSpeed: false
        });
        sim.particleCount = 300;
        sim.speciesCount = 6;
        sim.speed = 1.0;
        showSpeed(100);
        sim.viscosity = 0.98;
        sim.boundaryMode = 'warp';
        sim.initMode = 'random';

        PD.ui.settings.syncFromState();
        PD.ui.mechanics.syncFromState({ viscosity: 98 });
    }

    /** 85 %: a random sample number, 15 %: the Default setup. Keeps the current speed. */
    function randomize() {
        const keepSpeed = sim.speed;
        stopDonate();

        if (Math.random() < 0.15) {
            applyDefaults();
        } else {
            applySeed(Math.floor(Math.random() * 1000000000));
        }

        sim.speed = keepSpeed;
        showSpeed(Math.round(keepSpeed * 100));
        rebuildWorld();
    }

    /** Top "Random Sample" button: randomise and make sure it is running. */
    function quickRandom() {
        randomize();
        if (!loop.running) play();
    }

    function setCanvasSize(w, h) {
        sim.width = w;
        sim.height = h;
        loop.canvas.width = w;
        loop.canvas.height = h;
    }

    /** Width/Height inputs (Enter). */
    function applySize() {
        const w = parseInt(el.widthInput.value);
        const h = parseInt(el.heightInput.value);
        const L = cfg.CANVAS_SIZE_LIMITS;
        if (w < L.minW || w > L.maxW || h < L.minH || h > L.maxH) {
            alert(`Width: ${L.minW}-${L.maxW}, Height: ${L.minH}-${L.maxH}`);
            return;
        }
        setCanvasSize(w, h);
        rebuildWorld();
    }

    /** Window resize: canvas follows the viewport. */
    function fitToWindow() {
        setCanvasSize(window.innerWidth, window.innerHeight);
        el.widthInput.value = sim.width;
        el.heightInput.value = sim.height;
    }

    PD.controller = {
        updateButtonState,
        setSpeed,
        play,
        pause,
        toggleRunning,
        toggleDonate,
        rebuildWorld,
        reset,
        applySeed,
        loadSeed,
        randomize,
        quickRandom,
        applySize,
        fitToWindow,
        setCanvasSize
    };
})(window.PD);
