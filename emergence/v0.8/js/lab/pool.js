/**
 * Runs lab evaluations: in Web Workers when the page is served over http(s),
 * otherwise (file://) in the page itself in small time slices.
 */
(function (EM) {
    'use strict';

    const SLICE_MS = 12;

    class Pool {
        constructor(size) {
            this.size = Math.max(1, size);
            this.workers = [];
            this.mode = 'workers';
            this.nextId = 1;
            this.pending = new Map();
            this.startWorkers();
        }

        startWorkers() {
            try {
                if (location.protocol === 'file:') throw new Error('workers need http(s)');
                for (let i = 0; i < this.size; i++) {
                    const w = new Worker('js/lab/worker.js');
                    w.onmessage = (ev) => this.finish(ev.data);
                    w.onerror = (ev) => this.fail(w, ev);
                    w.busy = false;
                    this.workers.push(w);
                }
            } catch (e) {
                this.terminate();
                this.mode = 'page';
                this.size = 1;
            }
        }

        get busy() {
            return this.pending.size;
        }

        get free() {
            return this.mode === 'page' ? (this.pending.size === 0 ? 1 : 0) : this.workers.filter((w) => !w.busy).length;
        }

        /** Evaluates a genome; resolves with { descriptor, top }. */
        run(genome, opts) {
            const id = this.nextId++;
            return new Promise((resolve, reject) => {
                if (this.mode === 'page') {
                    this.pending.set(id, { resolve, reject });
                    this.runInPage(id, genome, opts);
                    return;
                }
                const w = this.workers.find((x) => !x.busy);
                if (!w) {
                    reject(new Error('no free worker'));
                    return;
                }
                w.busy = true;
                this.pending.set(id, { resolve, reject, worker: w });
                w.postMessage({ id, genome, opts });
            });
        }

        runInPage(id, genome, opts) {
            let run;
            try {
                run = new EM.lab.Run(genome, opts);
            } catch (e) {
                this.finish({ id, ok: false, error: e.message });
                return;
            }
            const tick = () => {
                if (!this.pending.has(id)) return; // cancelled
                const t0 = performance.now();
                while (performance.now() - t0 < SLICE_MS) {
                    if (run.advance(20)) {
                        this.finish({ id, ok: true, result: run.result() });
                        return;
                    }
                }
                setTimeout(tick, 0);
            };
            setTimeout(tick, 0);
        }

        finish(msg) {
            const p = this.pending.get(msg.id);
            if (!p) return;
            this.pending.delete(msg.id);
            if (p.worker) p.worker.busy = false;
            if (msg.ok) p.resolve(msg.result);
            else p.reject(new Error(msg.error));
        }

        fail(worker, ev) {
            for (const [id, p] of this.pending) {
                if (p.worker === worker) {
                    this.pending.delete(id);
                    worker.busy = false;
                    p.reject(new Error(ev.message || 'worker error'));
                }
            }
        }

        /** Stops everything in flight. */
        cancel() {
            this.pending.forEach((p) => p.reject(new Error('cancelled')));
            this.pending.clear();
            if (this.mode === 'workers') {
                // fresh workers, so an evaluation in progress does not keep burning CPU
                this.terminate();
                this.startWorkers();
            }
        }

        terminate() {
            this.workers.forEach((w) => w.terminate());
            this.workers = [];
        }
    }

    EM.lab = EM.lab || {};
    EM.lab.Pool = Pool;
})(EM);
