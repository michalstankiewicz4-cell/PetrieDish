/* Web Worker: evaluates one genome at a time with the same physics code as the page. */
/* global importScripts, EM */
importScripts(
    '../core/config.js',
    '../core/rng.js',
    '../core/genome.js',
    '../core/spatial-hash.js',
    '../physics/light.js',
    '../physics/bonds.js',
    '../physics/forces.js',
    '../physics/reactions.js',
    '../physics/world.js',
    '../observe/structures.js',
    '../observe/catalog.js',
    '../observe/enclosures.js',
    '../observe/observer.js',
    './runner.js'
);

self.onmessage = (ev) => {
    const { id, genome, opts } = ev.data;
    try {
        const res = EM.lab.runAll(genome, opts);
        self.postMessage({ id, ok: true, result: res });
    } catch (err) {
        self.postMessage({ id, ok: false, error: String(err && err.message || err) });
    }
};
