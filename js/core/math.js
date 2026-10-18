/** Small math helpers shared by the simulation. */
(function (PD) {
    'use strict';

    /**
     * Shortest signed distance from a to b on a wrapped axis of length `size`
     * (torus topology used by the "warp" boundary mode).
     */
    function torusDelta(a, b, size) {
        let d = b - a;
        if (Math.abs(d) > size / 2) {
            d -= Math.sign(d) * size;
        }
        return d;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Deterministic LCG used to expand a seed into a full simulation setup.
     * Do not change the constants: every saved/shared sample number depends on them.
     */
    class SeededRandom {
        constructor(seed) {
            this.seed = seed;
        }

        next() {
            this.seed = (this.seed * 9301 + 49297) % 233280;
            return this.seed / 233280;
        }

        range(min, max) {
            return min + this.next() * (max - min);
        }

        int(min, max) {
            return Math.floor(this.range(min, max + 1));
        }

        bool() {
            return this.next() < 0.5;
        }
    }

    PD.math = { torusDelta, clamp, SeededRandom };
})(window.PD);
