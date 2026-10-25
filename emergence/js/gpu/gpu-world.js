/**
 * GPU backend (WebGPU compute). Runs the physics of a World on the GPU and
 * mirrors the state back into that World's typed arrays (asynchronously), so
 * renderers, observers and the UI work unchanged.
 *
 *   EM.gpu.init()                  -> Promise<boolean> (device ready?)
 *   const g = new EM.GpuWorld(world)  uploads world (positions, bonds, ...)
 *   g.advance(k)                   queues k steps (one command buffer)
 *   g.sync()                       -> Promise: copies the newest state into `world`
 *   g.destroy()
 *
 * Same laws and formulas as the CPU, but not bit-identical and not
 * deterministic between runs (cell order depends on atomics, float rounding,
 * per-photon instead of sequential bond updates). The CPU stays the reference
 * and the Lab always uses the CPU.
 */
(function (EM) {
    'use strict';

    const K = EM.gpuKernels;
    const MV = EM.config.MAX_VALENCE;
    const MAX_BATCH = 32;           // steps in one command buffer
    const MAX_CELLS = 1 << 20;
    const CLOCK_STRIDE = 256;       // uniform offset alignment
    const CONTACT_PASSES = 5;       // must be odd (the result has to end in the current buffer)

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
                    gpu.device.lost.then((info) => {
                        gpu.error = 'GPU device lost: ' + info.message;
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

    /** Laws -> one float buffer (layout in kernels.js). */
    function packLaws(L) {
        const out = new Float32Array(K.LAWS.TYPE_BASE + EM.config.MAX_TYPES * K.LAWS.TYPE_STRIDE);
        const T = L.T, S = K.LAWS.PAIR_STRIDE;
        for (let p = 0; p < T * T; p++) {
            const o = p * S;
            out[o + K.LAWS.AMP] = L.amp[p];
            out[o + K.LAWS.K] = L.k[p];
            out[o + K.LAWS.PH] = L.phase[p];
            out[o + K.LAWS.POL] = L.polar[p];
            out[o + K.LAWS.TOR] = L.torque[p];
            out[o + K.LAWS.AFF] = L.bondAff[p];
            out[o + K.LAWS.BLEN] = L.bondLen[p];
            out[o + K.LAWS.BFORM] = L.bondFormDist[p];
            out[o + K.LAWS.BBRK] = L.bondBreak[p];
            out[o + K.LAWS.BK] = L.bondK[p];
            out[o + K.LAWS.BINDE] = L.bindE[p];
            out[o + K.LAWS.ACT] = L.activation[p];
            out[o + K.LAWS.DEC] = L.decay[p];
            out[o + K.LAWS.RXTO] = L.rxTo[p];
            out[o + K.LAWS.RXTHR] = L.rxThr[p];
            out[o + K.LAWS.OFF] = L.offset ? L.offset[p] : 0;
        }
        for (let t = 0; t < T; t++) {
            const o = K.LAWS.TYPE_BASE + t * K.LAWS.TYPE_STRIDE;
            out[o + K.LAWS.IM] = L.invMass[t];
            out[o + K.LAWS.ABS] = L.absorb[t];
            out[o + K.LAWS.LEAK] = L.leak[t];
            out[o + K.LAWS.THR] = L.thrust[t];
            out[o + K.LAWS.VAL] = L.valence[t];
        }
        return out;
    }

    /** Grid for the GPU: cells >= R on every axis (3 x 3 (x 3) neighbourhood). */
    function gridFor(world) {
        const R = world.laws.R;
        let cols = Math.max(1, Math.floor(world.width / R));
        let rows = Math.max(1, Math.floor(world.height / R));
        let layers = world.dim === 3 ? Math.max(1, Math.floor(world.depth / R)) : 1;
        while (cols * rows * layers > MAX_CELLS) {
            cols = Math.max(1, cols >> 1);
            rows = Math.max(1, rows >> 1);
            if (layers > 1) layers = Math.max(1, layers >> 1);
        }
        return { cols, rows, layers, cells: cols * rows * layers };
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
            this.inFlight = 0;             // command buffers not finished yet
            this.reading = false;
            this.base = { formed: world.bondsFormed, broken: world.bondsBroken, reactions: world.reactions };
            this.cur = 0;

            const n = this.n, L = world.laws;
            const grid = this.grid = gridFor(world);
            const light = world.light;
            const S = GPUBufferUsage.STORAGE, CD = GPUBufferUsage.COPY_DST, CS = GPUBufferUsage.COPY_SRC;
            const buf = (size, usage) => device.createBuffer({ size: Math.max(16, Math.ceil(size / 16) * 16), usage });

            this.params = buf(128, GPUBufferUsage.UNIFORM | CD);
            this.clock = buf(MAX_BATCH * CLOCK_STRIDE, GPUBufferUsage.UNIFORM | CD);
            this.state = [buf(n * 48, S | CD | CS), buf(n * 48, S | CD | CS)];
            this.partner = buf(n * 16, S | CD | CS);
            this.acc = buf(n * 32, S);
            this.laws = buf((K.LAWS.TYPE_BASE + EM.config.MAX_TYPES * K.LAWS.TYPE_STRIDE) * 4, S | CD);
            this.light = buf(light.field.length * 4, S | CD);
            this.counters = buf(16, S | CD | CS);
            this.cellCount = buf(grid.cells * 4, S | CD);
            this.cellStart = buf((grid.cells + 1) * 4, S);
            this.cellInfo = buf(n * 8, S);
            this.sorted = buf(n * 4, S);
            this.readSize = n * 64 + 16;
            this.staging = [0, 1].map(() => device.createBuffer({ size: this.readSize, usage: GPUBufferUsage.MAP_READ | CD }));
            this.stagingBusy = [false, false];

            this.writeParams();
            device.queue.writeBuffer(this.counters, 0, new Uint32Array(4));
            device.queue.writeBuffer(this.cellCount, 0, new Uint32Array(grid.cells));
            this.upload();
            this.uploadLight();

            this.makeBindGroups();
        }

        /** Uniform parameters + laws buffer from the world's (possibly changed) laws. */
        writeParams() {
            const world = this.world, L = world.laws, grid = this.grid, light = world.light, n = this.n;
            const pb = new ArrayBuffer(128), pf = new Float32Array(pb), pu = new Uint32Array(pb);
            const D = world.dim === 3 ? world.depth : 0;
            pf.set([world.width, world.height, D, L.R,
                L.coreR, L.coreK, L.forceScale, L.friction,
                L.temperature, L.bondFormRate, L.maxSpeed, L.spin,
                L.energyShare, L.hasReactions ? L.reactionRate : 0,
                world.width / grid.cols, world.height / grid.rows,
                world.dim === 3 ? world.depth / grid.layers : 1]);
            pu.set([n, L.T, grid.cols, grid.rows, grid.layers, grid.cells, world.dim,
                (L.hasOrientation ? 1 : 0) | (L.hasReactions ? 2 : 0) | (world.bondsEnabled ? 4 : 0),
                light.cols, light.rows, light.layers], 17);
            pf.set([L.restitution || 0, L.dmin || L.coreR, L.agitation || 0, L.energyValence || 0], 28);
            this.device.queue.writeBuffer(this.params, 0, pb);
            this.device.queue.writeBuffer(this.laws, 0, packLaws(L));
        }

        /** Call after the world's laws changed (e.g. pressure). */
        updateLaws() {
            if (gpu.device) this.writeParams();
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
            this.bg = {
                count: [0, 1].map((c) => bg(P.count, [this.params, this.state[c], this.cellCount, this.cellInfo])),
                scan: bg(P.scan, [this.params, this.cellCount, this.cellStart]),
                scatter: bg(P.scatter, [this.params, this.cellInfo, this.cellStart, this.sorted]),
                pairs: [0, 1].map((c) => bg(P.pairs, [this.params, this.state[c], this.partner, this.laws, this.cellStart, this.sorted, this.acc])),
                update: [0, 1].map((c) => bg(P.update, [this.params, this.state[c], this.state[1 - c], this.acc, this.partner, this.laws, this.light, this.counters])),
                // reads the updated state (1 - c), writes the corrected one back into c
                contact: [0, 1].map((c) => bg(P.contact, [this.params, this.state[1 - c], this.state[c], this.laws, this.cellStart, this.sorted])),
                contactBack: [0, 1].map((c) => bg(P.contact, [this.params, this.state[c], this.state[1 - c], this.laws, this.cellStart, this.sorted]))
            };
            this.clockBG = { pairs: clocks(P.pairs), update: clocks(P.update) };
        }

        /** Copies the CPU world (mirror) into the GPU buffers. */
        upload() {
            const w = this.world, n = this.n;
            const st = new Float32Array(n * 12), su = new Uint32Array(st.buffer);
            for (let i = 0; i < n; i++) {
                const o = i * 12;
                st[o] = w.x[i]; st[o + 1] = w.y[i]; st[o + 2] = w.z[i]; st[o + 3] = w.energy[i];
                st[o + 4] = w.vx[i]; st[o + 5] = w.vy[i]; st[o + 6] = w.vz[i]; su[o + 7] = w.type[i];
                if (w.dim === 3) {
                    st[o + 8] = w.hx[i]; st[o + 9] = w.hy[i]; st[o + 10] = w.hz[i];
                } else {
                    st[o + 8] = Math.cos(w.theta[i]); st[o + 9] = Math.sin(w.theta[i]); st[o + 11] = w.theta[i];
                }
            }
            this.device.queue.writeBuffer(this.state[this.cur], 0, st);
            const part = new Int32Array(n * 4).fill(-1);
            for (let i = 0; i < n; i++) for (let s = 0; s < w.deg[i]; s++) part[i * 4 + s] = w.partner[i * MV + s];
            this.device.queue.writeBuffer(this.partner, 0, part);
        }

        uploadLight() {
            this.device.queue.writeBuffer(this.light, 0, this.world.light.field);
        }

        /** Queues k physics steps. Returns false (and does nothing) when the GPU is still busy. */
        advance(k) {
            if (this.inFlight >= 2 || !gpu.device) return false;
            k = Math.max(1, Math.min(MAX_BATCH, k | 0));
            const device = this.device, P = gpu.pipelines, n = this.n;
            const light = this.world.light;

            const clock = new Uint32Array(MAX_BATCH * CLOCK_STRIDE / 4);
            for (let s = 0; s < k; s++) {
                clock[s * CLOCK_STRIDE / 4] = this.steps + s;
                // suns drift and the field changes on the CPU (cheap) - same rule as the CPU world
                light.update(this.steps + s);
            }
            device.queue.writeBuffer(this.clock, 0, clock, 0, k * CLOCK_STRIDE / 4);
            this.uploadLight();

            const enc = device.createCommandEncoder();
            const groups = Math.ceil(n / 64);
            for (let s = 0; s < k; s++) {
                const c = this.cur;
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
                // hard boundary: CONTACT_PASSES (odd) Jacobi passes 1-c -> c -> 1-c ... -> c;
                // dense clusters need more than one
                pass.setPipeline(P.contact);
                for (let k = 0; k < CONTACT_PASSES; k++) {
                    pass.setBindGroup(0, k % 2 === 0 ? this.bg.contact[c] : this.bg.contactBack[c]);
                    pass.dispatchWorkgroups(groups);
                }
                pass.end();
                // the corrected state is back in buffer c
            }
            device.queue.submit([enc.finish()]);
            this.steps += k;
            this.inFlight++;
            device.queue.onSubmittedWorkDone().then(() => { this.inFlight--; });
            return true;
        }

        /**
         * Copies the newest GPU state into the mirror world. Resolves to true when
         * the mirror was updated, false when a read is already running.
         */
        async sync() {
            if (!gpu.device) return false;
            const slot = this.stagingBusy[0] ? (this.stagingBusy[1] ? -1 : 1) : 0;
            if (slot < 0) return false;
            const n = this.n, staging = this.staging[slot];
            this.stagingBusy[slot] = true;
            const enc = this.device.createCommandEncoder();
            enc.copyBufferToBuffer(this.state[this.cur], 0, staging, 0, n * 48);
            enc.copyBufferToBuffer(this.partner, 0, staging, n * 48, n * 16);
            enc.copyBufferToBuffer(this.counters, 0, staging, n * 64, 16);
            this.device.queue.submit([enc.finish()]);
            const steps = this.steps;
            try {
                await staging.mapAsync(GPUMapMode.READ);
            } catch (e) {
                this.stagingBusy[slot] = false;
                return false;
            }
            if (this.destroyed) return false;
            const data = staging.getMappedRange();
            // an older read may finish after a newer one - keep the newest
            if (steps >= this.synced) this.unpack(data, steps);
            staging.unmap();
            this.stagingBusy[slot] = false;
            return true;
        }

        unpack(data, steps) {
            const w = this.world, n = this.n;
            const f = new Float32Array(data, 0, n * 12), u = new Uint32Array(data, 0, n * 12);
            const part = new Int32Array(data, n * 48, n * 4), cnt = new Uint32Array(data, n * 64, 4);
            const is3 = w.dim === 3;
            let bonds = 0;
            for (let i = 0; i < n; i++) {
                const o = i * 12;
                w.x[i] = f[o]; w.y[i] = f[o + 1]; w.z[i] = f[o + 2]; w.energy[i] = f[o + 3];
                w.vx[i] = f[o + 4]; w.vy[i] = f[o + 5]; w.vz[i] = f[o + 6]; w.type[i] = u[o + 7];
                w.hx[i] = f[o + 8]; w.hy[i] = f[o + 9];
                if (is3) w.hz[i] = f[o + 10]; else w.theta[i] = f[o + 11];
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
            w.reactions = this.base.reactions + cnt[2];
            w.steps = steps;
            this.synced = steps;
        }

        destroy() {
            this.destroyed = true;
            const all = [this.params, this.clock, ...this.state, this.partner, this.acc, this.laws, this.light,
                this.counters, this.cellCount, this.cellStart, this.cellInfo, this.sorted];
            all.forEach((b) => b.destroy());
            // staging buffers may still be mapped by a pending read
            this.staging.forEach((b, k) => { if (!this.stagingBusy[k]) b.destroy(); });
        }
    }

    GpuWorld.MAX_BATCH = MAX_BATCH;
    EM.gpu = gpu;
    EM.GpuWorld = GpuWorld;
})(EM);
