/**
 * Mutable simulation state - the single source of truth read by the physics,
 * the renderer and the UI. UI code writes here; the simulation only reads
 * parameters and writes particle data.
 */
(function (PD) {
    'use strict';

    PD.sim = {
        // World
        width: window.innerWidth,
        height: window.innerHeight,
        particles: [],
        /** @type {PD.SpatialGrid|null} */
        grid: null,
        nextParticleId: 0,

        // Setup
        particleCount: 1000,
        speciesCount: 6,
        seed: null,              // null = "Default" setup
        initMode: 'random',      // 'random' | 'bigbang' | 'gradient'
        boundaryMode: 'warp',    // 'warp' | 'wall' | 'endless'
        colors: PD.seed.defaultColors(),
        matrix: PD.seed.defaultMatrix(),

        // Time
        speed: 1.0,              // movement multiplier (Speed slider), 0 = frozen
        speedBeforePause: 1.0,
        timescale: 1.0,          // physics steps per rendered frame (FPS Booster), < 1 slows down
        physicsAccumulator: 0,

        // Mechanic parameters (slider values mapped to physics units)
        viscosity: 0.98,
        vorticness: 0.025,
        attractionStrength: 1.0,
        chargeForce: 1.0,
        massEffect: 1.0,
        blendRate: 0.02,
        swarmStrength: 0.05,
        swarmRange: 100,
        transferRate: 0.01,
        hierarchyStrength: 1.0,  // NOTE: not used by the physics yet

        enabled: {
            attraction: true,
            charges: false,
            mass: true,
            mixing: false,
            vortex: false,
            swarm: false,
            massTransfer: false,
            massHierarchy: false,
            viscosity: true,
            bonds: false,
            initialSpeed: false,
            intelligent: false,  // right click adds time-loop particles
            lifeDetection: false
        },

        mouse: { pressed: false, x: 0, y: 0 },

        intelligent: {
            futureFrames: 10,
            showGhost: true,
            list: [],
            nextColor: 0
        },

        bonds: {
            formationTime: 10,   // seconds
            maxDistance: 15,     // px, detection range
            maxPerParticle: 5,
            length: 10,          // px, enforced bond length
            candidates: new Map(),
            active: []           // { p1: id, p2: id, distance }
        },

        life: {
            particles: { from: 5, to: 20 },
            colors: { from: 2, to: 6 },
            distance: { from: 20, to: 50 },
            speedDiff: { from: 1, to: 5 },
            forms: []            // array of clusters (arrays of particles)
        },

        donate: {
            active: false,
            targets: []          // { particle, tx, ty }
        }
    };

    /** Display toggles that do not affect the simulation. */
    PD.ui = {
        showFps: true,
        showSeed: true
    };
})(window.PD);
