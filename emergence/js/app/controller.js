/**
 * Owns the current world, its observer and the settings. UI modules call these
 * actions instead of touching the world directly.
 */
(function (EM) {
    'use strict';

    const AREA_PER_PHOTON = 220; // px^2 - keeps density constant when the count changes

    const settings = {
        lawsSeed: 1,
        worldSeed: 1,
        types: EM.config.DEFAULT_TYPES,
        count: EM.config.DEFAULT_COUNT,
        stepsPerFrame: 2,
        running: true
    };

    const app = {
        settings,
        genome: null,
        world: null,
        observer: null,
        /** where the current laws came from: 'seed' | 'mutation' | 'lab' | 'file' */
        origin: 'seed',
        listeners: new Set(),

        /** Called after every new world (UI refresh). */
        onChange(fn) {
            app.listeners.add(fn);
        },

        emit() {
            app.listeners.forEach((fn) => fn(app));
        },

        worldSize(count) {
            const aspect = Math.max(1, window.innerWidth / Math.max(1, window.innerHeight));
            const area = count * AREA_PER_PHOTON;
            const width = Math.round(Math.sqrt(area * aspect));
            return { width, height: Math.round(area / width) };
        },

        /** Builds a world from the current genome and settings. */
        rebuild() {
            const { width, height } = app.worldSize(settings.count);
            app.world = new EM.World({ width, height, count: settings.count, genome: app.genome, seed: settings.worldSeed });
            app.observer = new EM.Observer(app.world);
            app.observer.observe();
            EM.renderer.selection = null;
            EM.renderer.camera.fit(width, height);
            app.writeHash();
            app.emit();
        },

        /** New laws from a seed. */
        newLaws(seed = Math.floor(Math.random() * 1e9), types = settings.types) {
            settings.lawsSeed = seed >>> 0;
            settings.types = types;
            app.genome = EM.genome.random(settings.lawsSeed, settings.types);
            app.origin = 'seed';
            app.rebuild();
        },

        /** Small random change of the current laws. */
        mutate() {
            const rng = new EM.Rng(Math.floor(Math.random() * 1e9));
            app.genome = EM.genome.mutate(app.genome, rng, { rate: 0.2, sigma: 0.15 });
            app.origin = 'mutation';
            app.rebuild();
        },

        /** Same laws, new starting positions. */
        restart(newWorldSeed = false) {
            if (newWorldSeed) settings.worldSeed = Math.floor(Math.random() * 1e9);
            app.rebuild();
        },

        loadGenome(genome, origin = 'file') {
            app.genome = EM.genome.fillMissing(JSON.parse(JSON.stringify(genome)));
            settings.types = app.genome.types;
            settings.lawsSeed = app.genome.seed >>> 0;
            app.origin = origin;
            app.rebuild();
        },

        setCount(count) {
            const L = EM.config.COUNT_LIMITS;
            settings.count = Math.max(L.min, Math.min(L.max, count | 0));
            app.rebuild();
        },

        togglePlay() {
            settings.running = !settings.running;
            app.emit();
        },

        exportGenome() {
            return EM.genome.toJSON(app.genome);
        },

        /** Laws from a seed are shareable as a link; mutated / lab laws need the JSON file. */
        writeHash() {
            if (app.origin !== 'seed') {
                history.replaceState(null, '', location.pathname + location.search);
                return;
            }
            const h = `#laws=${settings.lawsSeed}&types=${settings.types}&n=${settings.count}&world=${settings.worldSeed}`;
            history.replaceState(null, '', h);
        },

        readHash() {
            const params = new URLSearchParams(location.hash.slice(1));
            const num = (k) => (params.has(k) && isFinite(+params.get(k)) ? +params.get(k) : null);
            if (num('laws') !== null) settings.lawsSeed = num('laws') >>> 0;
            if (num('types') !== null) settings.types = Math.max(1, Math.min(EM.config.MAX_TYPES, num('types')));
            if (num('n') !== null) settings.count = Math.max(EM.config.COUNT_LIMITS.min, Math.min(EM.config.COUNT_LIMITS.max, num('n')));
            if (num('world') !== null) settings.worldSeed = num('world') >>> 0;
            return params.has('laws');
        }
    };

    EM.app = app;
})(EM);
