/**
 * Deterministic random numbers. The whole world (laws + starting positions +
 * thermal noise + bond chance) is driven by EM.Rng, so a seed reproduces a run.
 * Math.random is used only by the UI (e.g. picking a new seed).
 */
(function (EM) {
    'use strict';

    /** mulberry32 - small, fast, good enough for simulations. Do not change: seeds depend on it. */
    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    class Rng {
        constructor(seed) {
            this.seed = seed >>> 0;
            this._next = mulberry32(this.seed);
        }

        /** [0, 1) */
        next() {
            return this._next();
        }

        range(min, max) {
            return min + (max - min) * this._next();
        }

        /** integer in [min, max] */
        int(min, max) {
            return min + Math.floor(this._next() * (max - min + 1));
        }

        bool(p = 0.5) {
            return this._next() < p;
        }

        /** standard normal (Box-Muller) */
        normal() {
            let u = 0;
            while (u === 0) u = this._next();
            return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this._next());
        }
    }

    /** FNV-1a over a list of 32-bit integers -> uint32. Used for fingerprints and names. */
    function hashInts(values) {
        let h = 0x811c9dc5;
        for (let i = 0; i < values.length; i++) {
            let v = values[i] | 0;
            for (let b = 0; b < 4; b++) {
                h ^= v & 0xff;
                h = Math.imul(h, 0x01000193);
                v >>>= 8;
            }
        }
        return h >>> 0;
    }

    function hashString(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    EM.Rng = Rng;
    EM.hash = { ints: hashInts, string: hashString };
})(EM);
