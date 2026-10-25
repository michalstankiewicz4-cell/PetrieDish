/**
 * Genome of a world = the physical laws, as plain JSON (save, share, mutate
 * by the ML lab). compile() turns it into the typed arrays the physics reads.
 *
 * Photon model (format 2, since v0.7):
 *  - every photon is the same particle with the same radius; photons differ
 *    only by their STATE: charge (-2..+2), and with it mass, plus energy.
 *    The physics groups photons by charge, so `type` = charge + 2 (T = 5).
 *  - hard boundary: centres never closer than dmin = 2 r (1 + 0.5 (1 - pressure));
 *    at pressure 1 photons just touch.
 *  - strong interaction: very short range, saturating (at most `valence`
 *    partners) - holds touching photons together (bonds at contact distance).
 *  - electromagnetic interaction: the Gravitation wave
 *    f = sign * |q|avg * (sin(2 pi (periods d / R + phaseShift)) + offset) / (1 + offset) * (1 - d/R)
 *    sign: opposite charges attract (+), like / neutral repel (-).
 *  - energy: hot photons get stronger random kicks (agitation x e) and may
 *    hold fewer strong bonds (valence - floor(e x valence x energyValence));
 *    bonds above that limit break (chance 1/4 per step).
 *  - weak interaction (changes of charge): planned.
 *
 * IMPORTANT: random() draws values in the order of SPECS - append new specs
 * at the end, otherwise every existing seed changes.
 */
(function (EM) {
    'use strict';

    const TAU = Math.PI * 2;
    const FORMAT = 2;
    /** charge classes: type t has charge t - 2 */
    const CHARGES = [-2, -1, 0, 1, 2];
    const T = CHARGES.length;

    const SPECS = [
        // --- environment ---
        { key: 'pressure', min: 0.3, max: 1 },        // 1 = photons may touch; lower keeps them further apart
        { key: 'friction', min: 0.03, max: 0.2 },     // velocity loss per step
        { key: 'temperature', min: 0, max: 0.2 },     // thermal noise
        { key: 'restitution', min: 0, max: 0.6 },     // bounce at the hard boundary (0 = no bounce)
        // --- photon recipe: charges and mass ---
        { key: 'neutralShare', min: 0, max: 0.5 },    // share of photons with charge 0
        { key: 'doubleShare', min: 0, max: 0.35 },    // share of charged photons with |q| = 2
        { key: 'positiveShare', min: 0.3, max: 0.7 }, // share of charged photons with q > 0
        { key: 'massBase', min: 0.5, max: 2 },        // mass of a neutral photon
        { key: 'massPerCharge', min: 0, max: 1 },     // + this x |q|
        // --- electromagnetic interaction (Gravitation wave) ---
        { key: 'range', min: 20, max: 48 },           // R (px)
        { key: 'forceScale', min: 0.05, max: 0.3 },
        { key: 'periods', min: 0.5, max: 3 },         // attract/repel shells inside R
        { key: 'waveOffset', min: 0, max: 1 },        // 1 = sign never flips (pure Coulomb-like)
        { key: 'phaseShift', min: 0, max: 1, wrap: true },
        // --- strong interaction ---
        { key: 'valence', min: 0, max: 4, int: true }, // saturation: max strong partners
        { key: 'strongReach', min: 0.1, max: 0.6 },   // forms within dmin x (1 + reach)
        { key: 'strongRate', min: 0.005, max: 0.1 },  // chance per contact step
        { key: 'strongK', min: 0.05, max: 0.5 },      // stiffness
        { key: 'breakStretch', min: 1.3, max: 2.5 },  // breaks beyond dmin x this
        { key: 'bindEnergy', min: 0.05, max: 2 },     // max squared relative speed that still binds
        { key: 'activation', min: 0, max: 1 },        // < 0.3 = 0; energy spent to bind (released on break)
        { key: 'decay', min: 0, max: 1 },             // < 0.6 = 0; spontaneous break, faster with energy
        // --- energy ---
        { key: 'absorb', min: 0, max: 0.03 },         // light -> energy per step; < 0.01 = 0
        { key: 'leak', min: 0.002, max: 0.03 },
        { key: 'energyShare', min: 0, max: 0.2 },     // energy flow along strong bonds
        { key: 'lightAmbient', min: 0, max: 0.3 },
        { key: 'sunCount', min: 0, max: 3, int: true },
        { key: 'sunRadius', min: 0.1, max: 0.4 },
        { key: 'sunDrift', min: 0, max: 0.3 },
        { key: 'dayPeriod', min: 0, max: 6000 },      // < 500 = no day/night
        // --- energy and motion / bonding ---
        { key: 'agitation', min: 0, max: 0.4 },       // random kick x energy: hot photons move faster
        { key: 'energyValence', min: 0, max: 1 }      // allowed bonds = valence - floor(e x valence x this)
    ];

    /** Values a genome saved before a spec existed gets. */
    const NEUTRAL = {};

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

    /** New random laws. The same seed always gives the same laws. */
    function random(seed) {
        const rng = new EM.Rng(seed);
        const g = { format: FORMAT, seed: seed >>> 0, types: T, global: {} };
        SPECS.forEach((s) => { g.global[s.key] = draw(rng, s); });
        return g;
    }

    /** Mutated copy: each value changes with probability `rate` by sigma x its range. */
    function mutate(genome, rng, { rate = 0.15, sigma = 0.12 } = {}) {
        const g = JSON.parse(JSON.stringify(genome));
        SPECS.forEach((s) => {
            if (rng.next() < rate) g.global[s.key] = clampSpec(s, g.global[s.key] + rng.normal() * sigma * (s.max - s.min));
        });
        return g;
    }

    /** Minimal distance of two photon centres at a given pressure. */
    function contactDistance(pressure) {
        const p = Math.max(0, Math.min(1, pressure));
        return 2 * EM.config.PHOTON_RADIUS * (1 + 0.5 * (1 - p));
    }

    /**
     * Fills everything that depends on the pressure (hard boundary, strong
     * interaction distances). Used by compile() and when the pressure changes live.
     */
    function applyPressure(L, pressure) {
        const G = L.genes;
        L.pressure = Math.max(0, Math.min(1, pressure));
        const dmin = L.dmin = contactDistance(L.pressure);
        L.coreR = dmin;
        for (let p = 0; p < T * T; p++) {
            L.bondLen[p] = dmin;
            L.bondFormDist[p] = dmin * (1 + G.strongReach);
            L.bondBreak[p] = dmin * G.breakStretch;
        }
        return L;
    }

    /** Typed arrays (per charge pair / charge class) used by the physics. */
    function compile(g) {
        const G = g.global;
        const n = T * T;
        const amp = new Float32Array(n), phase = new Float32Array(n), k = new Float32Array(n), offset = new Float32Array(n);
        const bondAff = new Float32Array(n), bondLen = new Float32Array(n), bondFormDist = new Float32Array(n);
        const bondBreak = new Float32Array(n), bondK = new Float32Array(n), bindE = new Float32Array(n);
        const activation = new Float32Array(n), decay = new Float32Array(n);
        const polar = new Float32Array(n), torque = new Float32Array(n);
        const rxTo = new Int8Array(n).fill(-1), rxThr = new Float32Array(n);

        const act = G.activation < 0.3 ? 0 : G.activation;
        const dec = G.decay < 0.6 ? 0 : (G.decay - 0.6) * 0.005;
        for (let i = 0; i < T; i++) {
            for (let j = 0; j < T; j++) {
                const p = i * T + j, qi = CHARGES[i], qj = CHARGES[j];
                // Gravitation: opposite charges attract, like (and neutral) repel
                const sign = qi * qj < 0 ? 1 : -1;
                amp[p] = sign * (Math.abs(qi) + Math.abs(qj)) / 2;
                k[p] = TAU * G.periods / G.range;
                phase[p] = TAU * G.phaseShift;
                offset[p] = G.waveOffset;
                bondAff[p] = G.valence > 0 ? 1 : 0;
                bondK[p] = G.strongK;
                bindE[p] = G.bindEnergy;
                activation[p] = act;
                decay[p] = dec;
            }
        }

        const valence = new Uint8Array(T), invMass = new Float32Array(T);
        const absorb = new Float32Array(T), leak = new Float32Array(T), thrust = new Float32Array(T);
        const weights = new Float32Array(T);
        const charged = 1 - G.neutralShare;
        for (let t = 0; t < T; t++) {
            const q = CHARGES[t], aq = Math.abs(q);
            valence[t] = Math.min(EM.config.MAX_VALENCE, G.valence);
            invMass[t] = 1 / (G.massBase + G.massPerCharge * aq);
            absorb[t] = G.absorb < 0.01 ? 0 : G.absorb;
            leak[t] = G.leak;
            if (q === 0) weights[t] = G.neutralShare;
            else weights[t] = charged * (aq === 2 ? G.doubleShare : 1 - G.doubleShare) * (q > 0 ? G.positiveShare : 1 - G.positiveShare);
        }

        const L = {
            format: FORMAT,
            genes: G,
            T,
            charge: Int8Array.from(CHARGES),
            /** share of each charge class at spawn */
            typeWeights: weights,
            radius: EM.config.PHOTON_RADIUS,
            R: G.range,
            coreR: 0, // = dmin, set by applyPressure
            coreK: 1,
            forceScale: G.forceScale,
            friction: G.friction,
            temperature: G.temperature,
            restitution: G.restitution,
            agitation: G.agitation,
            energyValence: G.energyValence,
            bondFormRate: G.strongRate,
            maxSpeed: EM.config.MAX_SPEED,
            amp, phase, k, offset,
            bondAff, bondLen, bondFormDist, bondBreak, bondK, bindE,
            valence,
            color: EM.config.CHARGE_COLORS.slice(),
            // orientation is not part of this model (kept for shared code)
            polar, torque, hasOrientation: false, spin: 0,
            invMass, absorb, leak, thrust, activation, decay, energyShare: G.energyShare,
            light: {
                ambient: G.lightAmbient,
                suns: G.sunCount,
                radius: G.sunRadius,
                drift: G.sunDrift,
                dayPeriod: G.dayPeriod < 500 ? 0 : G.dayPeriod
            },
            // weak interaction (charge changes) - planned
            rxTo, rxThr, hasReactions: false, reactionRate: 0
        };
        return applyPressure(L, G.pressure);
    }

    /**
     * Force of class j on class i at distance d (positive = attraction),
     * electromagnetic + hard core. Used by the UI for force curves.
     */
    function forceAt(laws, i, j, d) {
        if (d < laws.coreR) return laws.coreK * (d / laws.coreR - 1);
        if (d >= laws.R) return 0;
        const p = i * laws.T + j, off = laws.offset[p];
        return laws.forceScale * laws.amp[p] * (Math.sin(laws.k[p] * d + laws.phase[p]) + off) / (1 + off) * (1 - d / laws.R);
    }

    function fillMissing(g) {
        Object.entries(NEUTRAL).forEach(([key, v]) => { if (typeof g.global[key] !== 'number') g.global[key] = v; });
        return g;
    }

    function toJSON(g) {
        return JSON.stringify(g, null, 1);
    }

    function fromJSON(text) {
        const g = JSON.parse(text);
        if (g && g.format === 1) throw new Error('these laws are from Emergence v0.6 or older (classic physics) – open them in the v0.6 version');
        if (!g || g.format !== FORMAT || !g.global) throw new Error('Unsupported genome file');
        fillMissing(g);
        SPECS.forEach((s) => {
            if (typeof g.global[s.key] !== 'number') throw new Error(`Genome: bad ${s.key}`);
        });
        g.types = T;
        return g;
    }

    /**
     * Laws that only take effect in a new world: the charge mix (decided at
     * spawn), the range (sets the spatial grid) and the suns (created with the light).
     */
    const RESTART_KEYS = ['neutralShare', 'doubleShare', 'positiveShare', 'range', 'sunCount', 'sunRadius', 'sunDrift'];

    EM.genome = {
        FORMAT,
        RESTART_KEYS,
        CHARGES,
        SPECS,
        random, mutate, compile, applyPressure, contactDistance, forceAt, toJSON, fromJSON, fillMissing
    };
})(EM);
