/**
 * GPU backend (WebGPU compute) for the Gravitation photon model. Runs the
 * physics of a World on the GPU and mirrors the state back into that World's
 * typed arrays (asynchronously), so renderers, observers and the UI work
 * unchanged.
 *
 *   EM.gpu.init()                     -> Promise<boolean> (device ready?)
 *   const g = new EM.GpuWorld(world)  uploads the world (spawned on the CPU)
 *   g.advance(k)                      queues k steps (one command buffer)
 *   g.sync()                          -> Promise: newest state into `world`
 *   g.uploadProps()                   after the formulas changed (world.setLaws)
 *   g.updateLaws()                    after the environment changed
 *   g.destroy()
 *
 * The photon properties come from the formulas, evaluated on the CPU (the
 * mirror world) and uploaded; the GPU only moves photons. Same formulas as
 * the CPU, but not bit-identical and not repeatable between runs (atomics
 * decide the order inside grid cells; bonds by mutual proposal, one new bond
 * per photon per step; an over-valence photon drops all its bonds at once).
 */
(function (EM) {
    'use strict';

    const K = EM.gpuKernels;
    const MV = EM.config.MAX_VALENCE;
    const MAX_BATCH = 32;           // steps in one command buffer
    const MAX_CELLS = 1 << 20;
    const CLOCK_STRIDE = 256;       // uniform offset alignment
    const CONTACT_PASSES = 5;       // odd: the result must end in the current buffer
    const PARAM_BYTES = 96;

    const gpu = {
        supported: typeof navigator !== 'undefined' && !!navigator.gpu,
        device: null,
        error: null,
        adapterInfo: '',
        _init: null,

        /** Requests an adapter and a device once. Resolves to true when the GPU backend can be used. */
        init() {
            if (gpu._init) return gpu._init;
            gpu._init = (async () => {
                if (!gpu.supported) {
                    gpu.error = 'WebGPU is not available in this browser';
                    return false;
                }
                try {
                    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
                    if (!adapter) throw new Error('no GPU adapter');
                    const info = adapter.info || {};
                    gpu.adapterInfo = [info.vendor, info.architecture || info.description].filter(Boolean).join(' ');
                    const lim = adapter.limits;
                    gpu.device = await adapter.requestDevice({
                        requiredLimits: {
                            maxStorageBufferBindingSize: lim.maxStorageBufferBindingSize,
                            maxBufferSize: lim.maxBufferSize
                        }
                    });
                    gpu.device.lost.then((i) => {
                        gpu.error = 'GPU device lost: ' + i.message;
                        gpu.device = null;
                        if (gpu.onLost) gpu.onLost(gpu.error);
                    });
                    gpu.pipelines = createPipelines(gpu.device);
                    return true;
                } catch (e) {
                    gpu.error = e.message;
                    gpu.device = null;
                    return false;
                }
            })();
            return gpu._init;
        },

        get ready() {
            return !!gpu.device;
        }
    };

    function createPipelines(device) {
        const make = (code) => device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code }), entryPoint: 'main' }
        });
        return {
            count: make(K.COUNT),
            scan: make(K.SCAN),
            scatter: make(K.SCATTER),
            pairs: make(K.PAIRS),
            update: make(K.UPDATE),
            contact: make(K.CONTACT)
        };
    }

    class GpuWorld {
        /** @param {EM.World} world built normally (spawned); it becomes the CPU mirror */
        constructor(world) {
            if (!gpu.device) throw new Error(gpu.error || 'GPU not initialised');
            const device = this.device = gpu.device;
            this.world = world;
            this.n = world.n;
            this.steps = world.steps;      // steps queued on the GPU
            this.synced = world.steps;     // steps the mirror shows
            this.inFlight = 0;
            this.base = { formed: world.bondsFormed, broken: world.bondsBroken };
            this.cur = 0;

            const n = this.n;
            const S = GPUBufferUsage.STORAGE, CD = GPUBufferUsage.COPY_DST, CS = GPUBufferUsage.COPY_SRC;
            this.buf = (size, usage) => device.createBuffer({ size: Math.max(16, Math.ceil(size / 16) * 16), usage });

            this.params = this.buf(PARAM_BYTES, GPUBufferUsage.UNIFORM | CD);
            this.clock = this.buf(MAX_BATCH * CLOCK_STRIDE, GPUBufferUsage.UNIFORM | CD);
            this.state = [this.buf(n * 32, S | CD | CS), this.buf(n * 32, S | CD | CS)];
            this.props = this.buf(n * 48, S | CD);
            this.partner = this.buf(n * 16, S | CD | CS);
            this.acc = this.buf(n * 32, S);
            this.counters = this.buf(16, S | CD | CS);
            this.cellInfo = this.buf(n * 8, S);
            this.sorted = this.buf(n * 4, S);
            this.readSize = n * 48 + 16;
            this.staging = [0, 1].map(() => device.createBuffer({ size: this.readSize, usage: GPUBufferUsage.MAP_READ | CD }));
            this.stagingBusy = [false, false];

            device.queue.writeBuffer(this.counters, 0, new Uint32Array(4));
            this.upload();
            this.uploadProps();       // also sets up the grid, params and bind groups
        }

        /** Cells >= everything a photon can reach in one step (largest force range, bonds, hard boundary). */
        gridFor() {
            const w = this.world, L = w.laws;
            const reach = Math.max(w.maxRange, L.formDist, L.dmin + 2 * w.maxSpeedNow * L.dt + 0.5, 1);
            let cols = Math.max(1, Math.floor(w.width / reach));
            let rows = Math.max(1, Math.floor(w.height / reach));
            let layers = w.dim === 3 ? Math.max(1, Math.floor(w.depth / reach)) : 1;
            while (cols * rows * layers > MAX_CELLS) {
                cols = Math.max(1, cols >> 1);
                rows = Math.max(1, rows >> 1);
                if (layers > 1) layers = Math.max(1, layers >> 1);
            }
            return { cols, rows, layers, cells: cols * rows * layers };
        }

        /** (Re)creates the grid buffers when the number of cells changes. */
        configureGrid() {
            const g = this.gridFor();
            const same = this.grid && this.grid.cells === g.cells && this.grid.cols === g.cols && this.grid.rows === g.rows;
            this.grid = g;
            if (same) return;
            const S = GPUBufferUsage.STORAGE, CD = GPUBufferUsage.COPY_DST;
            if (this.cellCount) { this.cellCount.destroy(); this.cellStart.destroy(); }
            this.cellCount = this.buf(g.cells * 4, S | CD);
            this.cellStart = this.buf((g.cells + 1) * 4, S);
            this.device.queue.writeBuffer(this.cellCount, 0, new Uint32Array(g.cells));
            this.makeBindGroups();
        }

        /** Uniform parameters from the world's laws (environment). */
        writeParams() {
            const w = this.world, L = w.laws, g = this.grid, env = L.env;
            const pb = new ArrayBuffer(PARAM_BYTES), pf = new Float32Array(pb), pu = new Uint32Array(pb);
            const D = w.dim === 3 ? w.depth : 0;
            pf.set([w.width, w.height, D, L.dt,
                L.dmin, L.bondLen, L.formDist, L.breakDist,
                L.forceFactor, env.bondStrength, env.bondChance, env.angleStiffness,
                w.width / g.cols, w.height / g.rows, w.dim === 3 ? w.depth / g.layers : 1, 0]);
            pu.set([this.n, g.cols, g.rows, g.layers, g.cells, w.dim, w.bondsEnabled ? 1 : 0, 0], 16);
            this.device.queue.writeBuffer(this.params, 0, pb);
        }

        /** Environment changed (pressure, temperature, bonds). */
        updateLaws() {
            if (!gpu.device) return;
            this.writeParams();
        }

        /** Photon properties (from the formulas, already evaluated in the mirror world). */
        uploadProps() {
            if (!gpu.device) return;
            const w = this.world, n = this.n;
            const p = new Float32Array(n * 12);
            for (let i = 0; i < n; i++) {
                const o = i * 12;
                p[o] = w.charge[i]; p[o + 1] = w.invMass[i]; p[o + 2] = w.speed[i]; p[o + 3] = w.force[i];
                p[o + 4] = w.range[i]; p[o + 5] = w.periods[i]; p[o + 6] = w.offsetW[i]; p[o + 7] = w.phase[i];
                p[o + 8] = w.valence[i]; p[o + 9] = w.cosAngle[i];
            }
            this.device.queue.writeBuffer(this.props, 0, p);
            this.configureGrid();
            this.writeParams();
        }

        /** Positions, velocities and bonds of the mirror world -> GPU. */
        upload() {
            const w = this.world, n = this.n;
            const st = new Float32Array(n * 8);
            for (let i = 0; i < n; i++) {
                const o = i * 8;
                st[o] = w.x[i]; st[o + 1] = w.y[i]; st[o + 2] = w.z[i];
                st[o + 4] = w.vx[i]; st[o + 5] = w.vy[i]; st[o + 6] = w.vz[i];
            }
            this.device.queue.writeBuffer(this.state[this.cur], 0, st);
            const part = new Int32Array(n * 4).fill(-1);
            for (let i = 0; i < n; i++) for (let s = 0; s < w.deg[i]; s++) part[i * 4 + s] = w.partner[i * MV + s];
            this.device.queue.writeBuffer(this.partner, 0, part);
        }

        makeBindGroups() {
            const device = this.device, P = gpu.pipelines;
            const bg = (pipe, entries) => device.createBindGroup({
                layout: pipe.getBindGroupLayout(0),
                entries: entries.map((b, i) => ({ binding: i, resource: { buffer: b } }))
            });
            const clocks = (pipe) => Array.from({ length: MAX_BATCH }, (_, k) => device.createBindGroup({
                layout: pipe.getBindGroupLayout(1),
                entries: [{ binding: 0, resource: { buffer: this.clock, offset: k * CLOCK_STRIDE, size: 16 } }]
            }));
            const s = this.state;
            this.bg = {
                count: [0, 1].map((c) => bg(P.count, [this.params, s[c], this.cellCount, this.cellInfo])),
                scan: bg(P.scan, [this.params, this.cellCount, this.cellStart]),
                scatter: bg(P.scatter, [this.params, this.cellInfo, this.cellStart, this.sorted]),
                pairs: [0, 1].map((c) => bg(P.pairs, [this.params, s[c], this.props, this.partner, this.cellStart, this.sorted, this.acc])),
                update: [0, 1].map((c) => bg(P.update, [this.params, s[c], s[1 - c], this.acc, this.partner, this.props, this.counters])),
                // update wrote 1 - c; contact passes go 1-c -> c -> 1-c ... -> c
                contact: [0, 1].map((c) => bg(P.contact, [this.params, s[1 - c], s[c], this.props, this.cellStart, this.sorted])),
                contactBack: [0, 1].map((c) => bg(P.contact, [this.params, s[c], s[1 - c], this.props, this.cellStart, this.sorted]))
            };
            if (!this.clockBG) this.clockBG = { pairs: clocks(P.pairs), update: clocks(P.update) };
        }

        /** Queues k physics steps. Returns false (and does nothing) when the GPU is still busy. */
        advance(k) {
            if (this.inFlight >= 2 || !gpu.device) return false;
            k = Math.max(1, Math.min(MAX_BATCH, k | 0));
            const device = this.device, P = gpu.pipelines;
            const clock = new Uint32Array(MAX_BATCH * CLOCK_STRIDE / 4);
            for (let s = 0; s < k; s++) clock[s * CLOCK_STRIDE / 4] = this.steps + s;
            device.queue.writeBuffer(this.clock, 0, clock, 0, k * CLOCK_STRIDE / 4);

            const enc = device.createCommandEncoder();
            const groups = Math.ceil(this.n / 64);
            const c = this.cur; // stays: every step ends in buffer c
            for (let s = 0; s < k; s++) {
                const pass = enc.beginComputePass();
                pass.setPipeline(P.count);
                pass.setBindGroup(0, this.bg.count[c]);
                pass.dispatchWorkgroups(groups);
                pass.setPipeline(P.scan);
                pass.setBindGroup(0, this.bg.scan);
                pass.dispatchWorkgroups(1);
                pass.setPipeline(P.scatter);
                pass.setBindGroup(0, this.bg.scatter);
                pass.dispatchWorkgroups(groups);
                pass.setPipeline(P.pairs);
                pass.setBindGroup(0, this.bg.pairs[c]);
                pass.setBindGroup(1, this.clockBG.pairs[s]);
                pass.dispatchWorkgroups(groups);
                pass.setPipeline(P.update);
                pass.setBindGroup(0, this.bg.update[c]);
                pass.setBindGroup(1, this.clockBG.update[s]);
                pass.dispatchWorkgroups(groups);
                pass.setPipeline(P.contact);
                for (let q = 0; q < CONTACT_PASSES; q++) {
                    pass.setBindGroup(0, q % 2 === 0 ? this.bg.contact[c] : this.bg.contactBack[c]);
                    pass.dispatchWorkgroups(groups);
                }
                pass.end();
            }
            device.queue.submit([enc.finish()]);
            this.steps += k;
            this.inFlight++;
            device.queue.onSubmittedWorkDone().then(() => { this.inFlight--; });
            return true;
        }

        /** Copies the newest GPU state into the mirror world. Resolves to true when it was updated. */
        async sync() {
            if (!gpu.device) return false;
            const slot = this.stagingBusy[0] ? (this.stagingBusy[1] ? -1 : 1) : 0;
            if (slot < 0) return false;
            const n = this.n, staging = this.staging[slot];
            this.stagingBusy[slot] = true;
            const enc = this.device.createCommandEncoder();
            enc.copyBufferToBuffer(this.state[this.cur], 0, staging, 0, n * 32);
            enc.copyBufferToBuffer(this.partner, 0, staging, n * 32, n * 16);
            enc.copyBufferToBuffer(this.counters, 0, staging, n * 48, 16);
            this.device.queue.submit([enc.finish()]);
            const steps = this.steps;
            try {
                await staging.mapAsync(GPUMapMode.READ);
            } catch (e) {
                this.stagingBusy[slot] = false;
                return false;
            }
            if (this.destroyed) return false;
            if (steps >= this.synced) this.unpack(staging.getMappedRange(), steps);
            staging.unmap();
            this.stagingBusy[slot] = false;
            return true;
        }

        unpack(data, steps) {
            const w = this.world, n = this.n;
            const f = new Float32Array(data, 0, n * 8);
            const part = new Int32Array(data, n * 32, n * 4), cnt = new Uint32Array(data, n * 48, 4);
            let bonds = 0;
            for (let i = 0; i < n; i++) {
                const o = i * 8;
                w.x[i] = f[o]; w.y[i] = f[o + 1]; w.z[i] = f[o + 2];
                w.vx[i] = f[o + 4]; w.vy[i] = f[o + 5]; w.vz[i] = f[o + 6];
                let d = 0;
                const b = i * MV;
                for (let s = 0; s < 4; s++) {
                    const j = part[i * 4 + s];
                    if (j >= 0) w.partner[b + d++] = j;
                }
                for (let s = d; s < MV; s++) w.partner[b + s] = -1;
                w.deg[i] = d;
                bonds += d;
            }
            w.bondCount = bonds / 2;
            w.bondsFormed = this.base.formed + cnt[0];
            w.bondsBroken = this.base.broken + cnt[1];
            w.steps = steps;
            this.synced = steps;
        }

        destroy() {
            this.destroyed = true;
            [this.params, this.clock, ...this.state, this.props, this.partner, this.acc, this.counters,
                this.cellInfo, this.sorted, this.cellCount, this.cellStart].forEach((b) => b && b.destroy());
            this.staging.forEach((b, k) => { if (!this.stagingBusy[k]) b.destroy(); });
        }
    }

    GpuWorld.MAX_BATCH = MAX_BATCH;
    EM.gpu = gpu;
    EM.GpuWorld = GpuWorld;
})(EM);
