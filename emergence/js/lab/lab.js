/** Lab controller: keeps every free worker busy with proposals from the search. */
(function (EM) {
    'use strict';

    const lab = {
        search: null,
        pool: null,
        running: false,
        opts: { count: 1500, steps: 3000, workers: Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) },
        last: null,
        error: null,
        listeners: new Set(),

        init() {
            lab.search = new EM.lab.Search();
        },

        onUpdate(fn) {
            lab.listeners.add(fn);
        },

        emit() {
            lab.listeners.forEach((fn) => fn(lab));
        },

        start() {
            if (lab.running) return;
            if (!lab.pool || lab.pool.size !== lab.opts.workers) {
                if (lab.pool) lab.pool.terminate();
                lab.pool = new EM.lab.Pool(lab.opts.workers);
            }
            lab.running = true;
            lab.error = null;
            lab.fill();
            lab.emit();
        },

        stop() {
            lab.running = false;
            if (lab.pool) lab.pool.cancel();
            lab.emit();
        },

        /** Starts evaluations on all free slots. */
        fill() {
            while (lab.running && lab.pool.free > 0) {
                const proposal = lab.search.propose();
                const opts = { count: lab.opts.count, steps: lab.opts.steps, worldSeed: 1 };
                lab.pool.run(proposal.genome, opts).then((result) => {
                    if (!lab.running) return;
                    lab.last = lab.search.add(proposal, result);
                    lab.emit();
                    lab.fill();
                }).catch((err) => {
                    if (!lab.running || err.message === 'cancelled') return;
                    lab.error = err.message;
                    lab.emit();
                    setTimeout(lab.fill, 500);
                });
            }
        }
    };

    EM.lab = EM.lab || {};
    EM.lab.controller = lab;
})(EM);
