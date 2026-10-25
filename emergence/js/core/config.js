/**
 * Global namespace + static configuration for Emergence.
 *
 * Every file is an IIFE that adds its API to `window.EM`, loaded with plain
 * <script defer> (no build step, works from file:// and GitHub Pages).
 * Physics files never touch the DOM, so they also run in Node and Web Workers.
 */
var EM = (typeof window !== 'undefined' ? window : globalThis).EM =
    (typeof window !== 'undefined' ? window : globalThis).EM || {};

(function (EM) {
    'use strict';

    EM.VERSION = '0.8.0';

    EM.debug = false;
    EM.log = (...args) => { if (EM.debug) console.log(...args); };

    EM.config = {
        MAX_TYPES: 8,
        /** Max bonds per photon (slots reserved in the bond table). Per-type valence is <= this. */
        MAX_VALENCE: 4,
        MAX_SPEED: 4,
        /** Every photon has the same radius (px). Closest approach of two centres: 2 r at pressure 1. */
        PHOTON_RADIUS: 3,
        /** Colour per charge class (type = charge + 2): -2, -1, 0, +1, +2. */
        CHARGE_COLORS: ['hsl(222, 85%, 60%)', 'hsl(192, 85%, 62%)', 'hsl(230, 12%, 74%)', 'hsl(32, 92%, 60%)', 'hsl(356, 85%, 62%)'],

        DEFAULT_COUNT: 6000,
        DEFAULT_COUNT_3D: 2000,
        DEFAULT_TYPES: 5,
        COUNT_LIMITS: { min: 500, max: 30000 },
        /** GPU backend (WebGPU): many more photons. */
        DEFAULT_COUNT_GPU: 40000,
        COUNT_LIMITS_GPU: { min: 500, max: 200000 },
        /** GPU backend: observers are expensive with many photons - run them at most this often (ms). */
        OBSERVE_MS_GPU: 400,

        /** Physics steps between two observer passes. */
        OBSERVE_EVERY: 20,
        /** A structure must exist for this many consecutive observer passes to count as stable. */
        STABLE_PASSES: 10,

        MAX_STEPS_PER_FRAME: 10,
        /** Max catalog tiles drawn in the panel. */
        CATALOG_TILES: 48
    };
})(EM);
