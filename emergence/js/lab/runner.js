/**
 * Runs a world without drawing and returns its descriptor - the same code is
 * used inside a Web Worker and, as a fallback, in the page in small chunks.
 * No DOM here.
 */
(function (EM) {
    'use strict';

    const DEFAULTS = { count: 1500, steps: 3000, worldSeed: 1, areaPerPhoton: 220, aspect: 1.6 };

    class Run {
        constructor(genome, opts = {}) {
            const o = this.opts = Object.assign({}, DEFAULTS, opts);
            const area = o.count * o.areaPerPhoton;
            const width = Math.round(Math.sqrt(area * o.aspect));
            this.world = new EM.World({ width, height: Math.round(area / width), count: o.count, genome, seed: o.worldSeed });
            this.observer = new EM.Observer(this.world);
            this.done = false;
            this.t0 = Date.now();
        }

        /** Advances up to `budget` steps. Returns true when finished. */
        advance(budget) {
            const w = this.world, every = EM.config.OBSERVE_EVERY, total = this.opts.steps;
            for (let k = 0; k < budget && w.steps < total; k++) {
                w.step();
                if (w.steps % every === 0) this.observer.observe();
            }
            this.done = w.steps >= total;
            return this.done;
        }

        get progress() {
            return this.world.steps / this.opts.steps;
        }

        /** Descriptor averaged over the second half of the run (after the start-up transient). */
        result() {
            const h = this.observer.history;
            const late = h.slice(Math.floor(h.length / 2));
            const d = EM.descriptor(late);
            d.ms = Date.now() - this.t0;
            const cat = this.observer.catalog.sorted().slice(0, 6).map((e) => ({ name: e.name, size: e.size, peak: e.peak }));
            return { descriptor: d, top: cat };
        }
    }

    /** Runs to the end in one go (used by the worker). */
    function runAll(genome, opts) {
        const r = new Run(genome, opts);
        while (!r.advance(500)) { /* keep going */ }
        return r.result();
    }

    EM.lab = EM.lab || {};
    EM.lab.Run = Run;
    EM.lab.runAll = runAll;
})(EM);
