/**
 * Genome of a world = all parameters of its physical laws.
 *
 * The genome is plain JSON (easy to save, share, mutate by the ML lab).
 * compile() turns it into typed arrays used by the physics ("laws").
 *
 * IMPORTANT: random() draws values in the order of the SPECS lists below.
 * Changing that order changes every existing seed - append new specs at the end.
 */
(function (EM) {
    'use strict';

    const TAU = Math.PI * 2;
    const FORMAT = 1;

    /** Global parameters. */
    const GLOBAL_SPECS = [
        { key: 'range', min: 20, max: 48 },           // interaction range R (px)
        { key: 'coreRadius', min: 3, max: 6 },        // hard-core repulsion radius (px)
        { key: 'coreStrength', min: 0.5, max: 2 },
        { key: 'forceScale', min: 0.05, max: 0.4 },   // amplitude of the wave force
        { key: 'friction', min: 0.03, max: 0.2 },     // velocity loss per step
        { key: 'temperature', min: 0, max: 0.2 },     // thermal noise
        { key: 'symmetry', min: 0, max: 1 },          // 1 = action equals reaction, 0 = fully one-sided
        { key: 'bondFormRate', min: 0.005, max: 0.1 }, // chance per contact step (x affinity)
        // --- energy & environment (v0.1) ---
        { key: 'lightAmbient', min: 0, max: 0.3 },    // light everywhere
        { key: 'sunCount', min: 0, max: 3, int: true },
        { key: 'sunRadius', min: 0.1, max: 0.4 },     // x min(world width, height)
        { key: 'sunDrift', min: 0, max: 0.3 },        // px per step
        { key: 'dayPeriod', min: 0, max: 6000 },      // steps; < 500 = no day/night
        { key: 'energyShare', min: 0, max: 0.2 },     // energy flowing along a bond per step
        { key: 'reactionRate', min: 0, max: 0.05 },   // chance per bond per step that a reaction fires
        { key: 'spin', min: 0, max: 0.2 }             // rotational noise of orientations
    ];

    /** Directional pair parameters: [i][j] = how type i reacts to type j. */
    const PAIR_SPECS = [
        { key: 'amp', min: -1, max: 1 },              // + attracts, - repels (sign of the first ring)
        { key: 'phase', min: 0, max: TAU, wrap: true },
        { key: 'waves', min: 0.5, max: 3 },           // number of attract/repel rings within R
        // --- orientation (v0.1): |value| < 0.5 compiles to 0, so most pairs ignore it ---
        { key: 'polar', min: -1, max: 1 },            // force x (1 + polar * cos(angle between i's heading and j))
        { key: 'torque', min: -1, max: 1 },           // + turns i's heading towards j, - away
        // --- reactions (v0.1): i bonded to j may turn into another type ---
        { key: 'rxChance', min: 0, max: 1 },          // < 0.75 compiles to "no reaction"
        { key: 'rxTarget', min: 0, max: 7, int: true }, // new type of i (mod types)
        { key: 'rxThreshold', min: 0.2, max: 0.9 }    // energy of i needed (and spent)
    ];

    /** Symmetric bond parameters: [i][j] == [j][i]. */
    const BOND_SPECS = [
        { key: 'bondAffinity', min: 0, max: 1 },      // < 0.4 means "never bonds" (see compile)
        { key: 'bondLength', min: 1.1, max: 3 },      // x coreRadius
        { key: 'bondStiffness', min: 0.02, max: 0.4 },
        { key: 'bindEnergy', min: 0.05, max: 2 },     // max squared relative speed allowing a bond
        { key: 'breakStretch', min: 1.4, max: 3 },    // bond breaks beyond length x this
        // --- energy (v0.1) ---
        { key: 'activation', min: 0, max: 1 },        // < 0.3 compiles to 0; energy (sum of both) spent to form
        { key: 'decay', min: 0, max: 1 }              // < 0.6 compiles to 0; spontaneous break chance
    ];

    /** Per-type parameters. */
    const TYPE_SPECS = [
        { key: 'valence', min: 0, max: 4, int: true }, // max bonds of this type
        { key: 'hue', min: 0, max: 360, wrap: true },
        // --- energy & motion (v0.1) ---
        { key: 'mass', min: 0.5, max: 2 },
        { key: 'absorb', min: 0, max: 0.03 },         // light -> energy per step; < 0.01 compiles to 0
        { key: 'leak', min: 0.002, max: 0.03 },       // energy lost per step (fraction)
        { key: 'thrust', min: 0, max: 0.08 }          // push along heading x energy; < 0.03 compiles to 0
    ];

    const AFFINITY_THRESHOLD = 0.4;
    /** Specs a genome saved before they existed gets (neutral = "off"). */
    const NEUTRAL = {
        global: { lightAmbient: 0.1, sunCount: 1, sunRadius: 0.25, sunDrift: 0, dayPeriod: 0, energyShare: 0, reactionRate: 0, spin: 0.02 },
        pair: { polar: 0, torque: 0, rxChance: 0, rxTarget: 0, rxThreshold: 0.5 },
        bond: { activation: 0, decay: 0 },
        type: { mass: 1, absorb: 0, leak: 0.01, thrust: 0 }
    };
    const gate = (v, threshold) => (Math.abs(v) < threshold ? 0 : v);

    function draw(rng, spec) {
        if (spec.int) return Math.min(spec.max, spec.min + Math.floor(rng.next() * (spec.max - spec.min + 1)));
        return spec.min + rng.next() * (spec.max - spec.min);
    }

    function clampSpec(spec, v) {
        if (spec.wrap) {
            const span = spec.max - spec.min;
            v = ((v - spec.min) % span + span) % span + spec.min;
        } else {
            v = Math.max(spec.min, Math.min(spec.max, v));
        }
        return spec.int ? Math.round(v) : v;
    }

    /** New random genome. Same (seed, types) always gives the same genome. */
    function random(seed, types) {
        const T = Math.max(1, Math.min(EM.config.MAX_TYPES, types | 0));
        const rng = new EM.Rng(seed);
        const g = { format: FORMAT, seed: seed >>> 0, types: T, global: {}, pair: {}, bond: {}, type: {} };

        GLOBAL_SPECS.forEach((s) => { g.global[s.key] = draw(rng, s); });

        PAIR_SPECS.forEach((s) => {
            const arr = new Array(T * T);
            for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) arr[i * T + j] = draw(rng, s);
            g.pair[s.key] = arr;
        });

        BOND_SPECS.forEach((s) => {
            const arr = new Array(T * T);
            for (let i = 0; i < T; i++) {
                for (let j = i; j < T; j++) {
                    const v = draw(rng, s);
                    arr[i * T + j] = v;
                    arr[j * T + i] = v;
                }
            }
            g.bond[s.key] = arr;
        });

        TYPE_SPECS.forEach((s) => {
            g.type[s.key] = Array.from({ length: T }, () => draw(rng, s));
        });
        // spread colours around the wheel, the drawn hue only jitters it
        g.type.hue = g.type.hue.map((h, i) => clampSpec(TYPE_SPECS[1], i * 360 / T + (h - 180) * 0.15));

        return g;
    }

    /**
     * Returns a mutated copy. Each value changes with probability `rate` by a
     * normal step of `sigma` x (its range). Symmetric bond values stay symmetric.
     */
    function mutate(genome, rng, { rate = 0.15, sigma = 0.12 } = {}) {
        const g = JSON.parse(JSON.stringify(genome));
        const T = g.types;
        const step = (s, v) => (rng.next() < rate ? clampSpec(s, v + rng.normal() * sigma * (s.max - s.min)) : v);

        GLOBAL_SPECS.forEach((s) => { g.global[s.key] = step(s, g.global[s.key]); });
        PAIR_SPECS.forEach((s) => { g.pair[s.key] = g.pair[s.key].map((v) => step(s, v)); });
        BOND_SPECS.forEach((s) => {
            const arr = g.bond[s.key];
            for (let i = 0; i < T; i++) {
                for (let j = i; j < T; j++) {
                    const v = step(s, arr[i * T + j]);
                    arr[i * T + j] = v;
                    arr[j * T + i] = v;
                }
            }
        });
        TYPE_SPECS.forEach((s) => { g.type[s.key] = g.type[s.key].map((v) => step(s, v)); });
        return g;
    }

    /** Typed arrays and derived values used by the physics. */
    function compile(g) {
        const T = g.types;
        const G = g.global;
        const s = G.symmetry;
        const P = g.pair, B = g.bond;
        const n = T * T;

        const amp = new Float32Array(n), phase = new Float32Array(n), k = new Float32Array(n);
        const bondAff = new Float32Array(n), bondLen = new Float32Array(n), bondFormDist = new Float32Array(n);
        const bondBreak = new Float32Array(n), bondK = new Float32Array(n), bindE = new Float32Array(n);
        const polar = new Float32Array(n), torque = new Float32Array(n);
        const activation = new Float32Array(n), decay = new Float32Array(n);
        const rxTo = new Int8Array(n).fill(-1), rxThr = new Float32Array(n);
        let hasOrientation = false, hasReactions = false;

        for (let i = 0; i < T; i++) {
            for (let j = 0; j < T; j++) {
                const p = i * T + j, q = j * T + i;
                // symmetry blends each directional value with its mirror
                amp[p] = s * (P.amp[p] + P.amp[q]) / 2 + (1 - s) * P.amp[p];
                phase[p] = s * (P.phase[p] + P.phase[q]) / 2 + (1 - s) * P.phase[p];
                const waves = s * (P.waves[p] + P.waves[q]) / 2 + (1 - s) * P.waves[p];
                k[p] = TAU * waves / G.range;

                bondAff[p] = Math.max(0, (B.bondAffinity[p] - AFFINITY_THRESHOLD) / (1 - AFFINITY_THRESHOLD));
                bondLen[p] = B.bondLength[p] * G.coreRadius;
                bondFormDist[p] = bondLen[p] * 1.25;
                bondBreak[p] = bondLen[p] * B.breakStretch[p];
                bondK[p] = B.bondStiffness[p];
                bindE[p] = B.bindEnergy[p];

                polar[p] = gate(P.polar[p], 0.5);
                torque[p] = gate(P.torque[p], 0.5) * 0.05;
                if (polar[p] || torque[p]) hasOrientation = true;
                activation[p] = B.activation[p] < 0.3 ? 0 : B.activation[p];
                decay[p] = B.decay[p] < 0.6 ? 0 : (B.decay[p] - 0.6) * 0.005;
                const target = P.rxTarget[p] % T;
                if (P.rxChance[p] >= 0.75 && target !== i) {
                    rxTo[p] = target;
                    rxThr[p] = P.rxThreshold[p];
                    hasReactions = true;
                }
            }
        }

        const valence = new Uint8Array(T);
        const invMass = new Float32Array(T), absorb = new Float32Array(T), leak = new Float32Array(T), thrust = new Float32Array(T);
        const color = [];
        const Ty = g.type;
        for (let t = 0; t < T; t++) {
            valence[t] = Math.min(EM.config.MAX_VALENCE, Ty.valence[t]);
            invMass[t] = 1 / Ty.mass[t];
            absorb[t] = Ty.absorb[t] < 0.01 ? 0 : Ty.absorb[t];
            leak[t] = Ty.leak[t];
            thrust[t] = Ty.thrust[t] < 0.03 ? 0 : Ty.thrust[t];
            color.push(`hsl(${Ty.hue[t].toFixed(0)}, 80%, 62%)`);
        }

        return {
            T,
            R: G.range,
            coreR: G.coreRadius,
            coreK: G.coreStrength,
            forceScale: G.forceScale,
            friction: G.friction,
            temperature: G.temperature,
            bondFormRate: G.bondFormRate,
            maxSpeed: EM.config.MAX_SPEED,
            amp, phase, k,
            bondAff, bondLen, bondFormDist, bondBreak, bondK, bindE,
            valence, color,
            // orientation
            polar, torque, hasOrientation, spin: G.spin,
            // energy
            invMass, absorb, leak, thrust, activation, decay, energyShare: G.energyShare,
            light: {
                ambient: G.lightAmbient,
                suns: G.sunCount,
                radius: G.sunRadius,
                drift: G.sunDrift,
                dayPeriod: G.dayPeriod < 500 ? 0 : G.dayPeriod
            },
            // reactions
            rxTo, rxThr, hasReactions, reactionRate: G.reactionRate
        };
    }

    /**
     * Force of type `j` on type `i` at distance d (positive = attraction).
     * Same formula as the physics; used by the UI to draw force curves.
     */
    function forceAt(laws, i, j, d) {
        if (d < laws.coreR) return laws.coreK * (d / laws.coreR - 1);
        if (d >= laws.R) return 0;
        const p = i * laws.T + j;
        return laws.forceScale * laws.amp[p] * Math.sin(laws.k[p] * d + laws.phase[p]) * (1 - d / laws.R);
    }

    /** Adds parameters introduced after the genome was saved, with neutral values. */
    function fillMissing(g) {
        const n = g.types * g.types;
        Object.entries(NEUTRAL.global).forEach(([k, v]) => { if (typeof g.global[k] !== 'number') g.global[k] = v; });
        Object.entries(NEUTRAL.pair).forEach(([k, v]) => { if (!Array.isArray(g.pair[k])) g.pair[k] = new Array(n).fill(v); });
        Object.entries(NEUTRAL.bond).forEach(([k, v]) => { if (!Array.isArray(g.bond[k])) g.bond[k] = new Array(n).fill(v); });
        Object.entries(NEUTRAL.type).forEach(([k, v]) => { if (!Array.isArray(g.type[k])) g.type[k] = new Array(g.types).fill(v); });
        return g;
    }

    function toJSON(g) {
        return JSON.stringify(g, null, 1);
    }

    function fromJSON(text) {
        const g = JSON.parse(text);
        if (!g || g.format !== FORMAT || !(g.types >= 1 && g.types <= EM.config.MAX_TYPES)) {
            throw new Error('Unsupported genome file');
        }
        const n = g.types * g.types;
        fillMissing(g);
        PAIR_SPECS.concat(BOND_SPECS).forEach((s) => {
            const src = PAIR_SPECS.includes(s) ? g.pair : g.bond;
            if (!Array.isArray(src[s.key]) || src[s.key].length !== n) throw new Error(`Genome: bad ${s.key}`);
        });
        return g;
    }

    EM.genome = {
        FORMAT,
        SPECS: { GLOBAL_SPECS, PAIR_SPECS, BOND_SPECS, TYPE_SPECS },
        random, mutate, compile, forceAt, toJSON, fromJSON, fillMissing
    };
})(EM);
