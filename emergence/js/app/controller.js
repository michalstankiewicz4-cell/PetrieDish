/**
 * Owns the current world, its observer and the settings. UI modules call these
 * actions instead of touching the world directly.
 */
(function (EM) {
    'use strict';

    const AREA_PER_PHOTON = 1500;    // px^2 per photon in 2D - density stays the same when the count changes
    const VOLUME_PER_PHOTON = 40000; // px^3 per photon in 3D (a bit sparser: in 3D every photon has many more neighbours)

    /** formulas + environment the user edited - kept between visits (like Gravitation) */
    const LS_LAWS = 'emergence.laws.v3';

    function loadSavedLaws() {
        try {
            const raw = localStorage.getItem(LS_LAWS);
            if (!raw) return null;
            const g = EM.genome.fromJSON(raw);
            return { vars: g.vars, env: g.env };
        } catch (e) {
            return null;
        }
    }

    const settings = {
        dim: 3,
        lawsSeed: 1,
        worldSeed: 1,
        types: EM.config.DEFAULT_TYPES,
        count: EM.config.DEFAULT_COUNT_3D,
        stepsPerFrame: 2,
        running: true,
        /** 'cpu' (reference, deterministic) | 'gpu' (WebGPU, many photons) */
        backend: 'cpu'
    };

    const app = {
        settings,
        genome: null,
        world: null,
        observer: null,
        /** EM.GpuWorld when the GPU backend runs the current world, else null */
        gpu: null,
        /** fast forward: physics as fast as possible, nothing drawn, until stopped */
        fast: false,
        /** where the current laws came from: 'seed' | 'mutation' | 'lab' | 'file' */
        origin: 'seed',
        listeners: new Set(),
        /** called after a law changed in the running world (editor, pressure) */
        lawListeners: new Set(),

        /** Called after every new world (UI refresh). */
        onChange(fn) {
            app.listeners.add(fn);
        },

        emit() {
            app.listeners.forEach((fn) => fn(app));
        },

        worldSize(count, dim = settings.dim) {
            if (dim === 3) {
                const side = Math.round(Math.cbrt(count * VOLUME_PER_PHOTON));
                return { width: side, height: side, depth: side };
            }
            const aspect = Math.max(1, window.innerWidth / Math.max(1, window.innerHeight));
            const area = count * AREA_PER_PHOTON;
            const width = Math.round(Math.sqrt(area * aspect));
            return { width, height: Math.round(area / width), depth: 0 };
        },

        /** Builds a world from the current genome and settings. */
        rebuild() {
            const size = app.worldSize(settings.count);
            if (app.fast) {
                app.fast = false;
                EM.loop.onFast(false);
            }
            if (app.gpu) {
                app.gpu.destroy();
                app.gpu = null;
            }
            // same size and space as before (restart, new laws): keep the camera where the user put it
            const prev = app.world;
            const sameView = prev && prev.dim === (size.depth > 0 ? 3 : 2) && prev.width === size.width && prev.height === size.height && prev.depth === size.depth;
            app.world = new EM.World(Object.assign(size, { count: settings.count, genome: app.genome, seed: settings.worldSeed }));
            app.pendingRestart = false;
            if (settings.backend === 'gpu') {
                try {
                    app.gpu = new EM.GpuWorld(app.world);
                } catch (e) {
                    console.warn('GPU backend failed, using CPU:', e);
                    settings.backend = 'cpu';
                    app.clampCount();
                    if (app.world.n !== settings.count) return app.rebuild();
                }
            }
            app.observer = new EM.Observer(app.world);
            app.observer.observe();
            EM.renderer.setDim(settings.dim);
            EM.renderer.selection = null;
            if (!sameView) EM.renderer.fit(app.world);
            app.writeHash();
            app.emit();
        },

        /**
         * New randomness for the formulas (the seed of rand()); the formulas and
         * the environment stay what the user set in the editor.
         */
        newLaws(seed = Math.floor(Math.random() * 1e9)) {
            settings.lawsSeed = seed >>> 0;
            const saved = app.genome ? { vars: app.genome.vars, env: app.genome.env } : loadSavedLaws();
            app.genome = EM.genome.random(settings.lawsSeed, saved && saved.vars);
            if (saved) app.genome.env = Object.assign(EM.genome.defaultEnv(), JSON.parse(JSON.stringify(saved.env)));
            app.origin = 'seed';
            app.rebuild();
        },

        /** The Lab is off in this model: "mutate" = new randomness of the same formulas. */
        mutate() {
            app.newLaws();
        },

        /** Back to Gravitation's formulas and the default environment. */
        resetLaws() {
            app.genome = EM.genome.random(settings.lawsSeed);
            app.saveLaws();
            app.origin = 'seed';
            app.rebuild();
        },

        saveLaws() {
            try {
                localStorage.setItem(LS_LAWS, EM.genome.toJSON(app.genome));
            } catch (e) { /* storage off */ }
        },

        /** Same laws, new starting positions. */
        restart(newWorldSeed = false) {
            if (newWorldSeed) settings.worldSeed = Math.floor(Math.random() * 1e9);
            app.rebuild();
        },

        loadGenome(genome, origin = 'file') {
            app.genome = EM.genome.fromJSON(JSON.stringify(genome));
            settings.lawsSeed = app.genome.seed >>> 0;
            app.saveLaws();
            app.origin = origin;
            app.rebuild();
        },

        /** Switches between a 2D and a 3D world (same laws). */
        setDim(dim) {
            if (dim === settings.dim) return;
            settings.dim = dim;
            // 3D is ~3x more expensive per photon: start from a count that stays fluid
            if (settings.backend === 'cpu') {
                settings.count = dim === 3 ? Math.min(settings.count, EM.config.DEFAULT_COUNT_3D) : EM.config.DEFAULT_COUNT;
            }
            app.rebuild();
        },

        /** Photon count limits of the current backend. */
        countLimits() {
            return settings.backend === 'gpu' ? EM.config.COUNT_LIMITS_GPU : EM.config.COUNT_LIMITS;
        },

        clampCount() {
            const L = app.countLimits();
            settings.count = Math.max(L.min, Math.min(L.max, settings.count | 0));
        },

        setCount(count) {
            settings.count = count;
            app.clampCount();
            app.rebuild();
        },

        /**
         * Switches the physics between CPU and GPU (same laws, same start).
         * Resolves to false when WebGPU is not available.
         */
        async setBackend(backend) {
            if (backend === settings.backend) return true;
            if (backend === 'gpu') {
                alert('The GPU backend does not support the Gravitation photon model (v0.9) yet – the physics runs on the CPU.');
                app.emit();
                return false;
            }
            if (backend === 'gpu' && !(await EM.gpu.init())) {
                alert('GPU backend needs WebGPU: ' + EM.gpu.error);
                app.emit();
                return false;
            }
            settings.backend = backend;
            if (backend === 'gpu') settings.count = Math.max(settings.count, EM.config.DEFAULT_COUNT_GPU);
            else settings.count = settings.dim === 3 ? Math.min(settings.count, EM.config.DEFAULT_COUNT_3D) : Math.min(settings.count, EM.config.DEFAULT_COUNT);
            app.clampCount();
            app.rebuild();
            return true;
        },

        /** Environment pressure (0..1), live: sets the bond length. */
        setPressure(p) {
            app.setEnv('pressure', p);
        },

        /** One environment number (pressure, temperature, bond settings), live. */
        setEnv(key, value) {
            if (!app.world) return;
            app.genome.env[key] = value;
            app.world.laws.env = app.genome.env;
            app.world.setEnv();
            app.saveLaws();
            app.lawListeners.forEach((fn) => fn(key, value, true));
        },

        /**
         * New formulas (editor), live: every photon keeps its charge, mass and
         * energy, everything else is recomputed (like Gravitation).
         * @returns {Array} errors per row (null = ok)
         */
        setFormulas(vars) {
            app.genome.vars = EM.formulas.normalize(vars);
            const laws = EM.genome.compile(app.genome);
            if (app.world) app.world.setLaws(laws);
            app.saveLaws();
            app.lawListeners.forEach((fn) => fn('formulas', null, true));
            // compile errors + errors while running (e.g. a name used before its row)
            return EM.formulas.run(laws.compiled, new EM.Rng(1)).errors;
        },

        togglePlay() {
            if (app.fast) {
                app.setFast(false); // Space during fast forward = stop it, keep running
                return;
            }
            settings.running = !settings.running;
            app.emit();
        },

        setFast(on) {
            app.fast = !!on;
            if (app.fast) settings.running = true;
            EM.loop.onFast(app.fast);
            app.emit();
        },

        exportGenome() {
            return EM.genome.toJSON(app.genome);
        },

        /** Laws from a seed are shareable as a link; mutated / lab laws need the JSON file. */
        writeHash() {
            const h = `#seed=${settings.lawsSeed}&n=${settings.count}&world=${settings.worldSeed}&d=${settings.dim}${settings.backend === 'gpu' ? '&gpu=1' : ''}`;
            history.replaceState(null, '', h);
        },

        readHash() {
            const params = new URLSearchParams(location.hash.slice(1));
            const num = (k) => (params.has(k) && isFinite(+params.get(k)) ? +params.get(k) : null);
            if (num('seed') !== null) settings.lawsSeed = num('seed') >>> 0;
            if (num('n') !== null) {
                const L = EM.config.COUNT_LIMITS;
                settings.count = Math.max(L.min, Math.min(L.max, num('n')));
            }
            if (num('world') !== null) settings.worldSeed = num('world') >>> 0;
            if (num('d') === 2) settings.dim = 2;
            else if (num('d') === 3) settings.dim = 3;
            return params.has('seed');
        }
    };

    EM.app = app;
})(EM);
