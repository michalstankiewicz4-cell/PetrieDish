/**
 * Seeds ("samples"): turn one integer into a complete simulation setup.
 *
 * The order of rng calls below defines what every sample number looks like.
 * Changing it (or adding calls in the middle) changes all existing samples,
 * so append new randomised properties at the END only.
 */
(function (PD) {
    'use strict';

    const { SeededRandom } = PD.math;
    const { DEFAULT_COLORS } = PD.config;

    const BOUNDARY_MODES = ['warp', 'wall', 'endless'];
    const INIT_MODES = ['random', 'bigbang', 'gradient'];

    function generate(seed) {
        const rng = new SeededRandom(seed);

        const mechanics = {
            attraction: rng.bool(),
            charges: rng.bool(),
            mass: rng.bool(),
            mixing: rng.bool(),
            vortex: rng.bool(),
            swarm: rng.bool(),
            massTransfer: rng.bool(),
            massHierarchy: rng.bool(),
            initialSpeed: rng.bool()
            // bonds: never from a seed - manual only (performance)
        };

        const settings = {
            ...mechanics,
            // NOTE: boundaryMode is generated but the loader always uses 'warp'
            boundaryMode: BOUNDARY_MODES[Math.floor(rng.next() * 3)],
            initMode: INIT_MODES[Math.floor(rng.next() * 3)],
            particleCount: rng.int(75, 3000),
            speciesCount: rng.int(1, 15),
            speed: rng.int(0, 200),
            viscosity: rng.int(90, 99),
            vorticness: Math.round(rng.range(0, 5) * 10) / 10
        };

        const colors = DEFAULT_COLORS.slice(0, settings.speciesCount).map((color) => ({
            hex: color.hex,
            name: color.name,
            charge: settings.charges ? (rng.bool() ? 1 : -1) : 0,
            mass: settings.mass ? rng.range(0.5, 1.5) : 1.0,
            interactionRange: rng.int(30, 150),
            vorticness: settings.vortex ? rng.range(0.0, 1.0) : 0,
            initialSpeed: settings.initialSpeed ? rng.range(0.2, 1.5) : 1.0
        }));

        const names = colors.map(c => c.name);
        const matrix = {};
        names.forEach(from => {
            matrix[from] = {};
            names.forEach(to => {
                if (!settings.attraction) {
                    matrix[from][to] = 0;
                } else if (from === 'white' && to === 'white') {
                    matrix[from][to] = rng.range(-0.6, -0.3);
                } else if (from === 'black' && to === 'black') {
                    matrix[from][to] = rng.range(0.3, 0.6);
                } else {
                    matrix[from][to] = rng.range(-0.6, 0.6);
                }
            });
        });

        PD.log(`🌱 seed ${seed}`, settings);
        return { settings, colors, matrix };
    }

    /** Hand-tuned, deterministic matrix used for the "Default" (seedless) setup. */
    function defaultMatrix(colors) {
        const matrix = {};
        const names = colors.map(c => c.name);

        names.forEach((from, i) => {
            matrix[from] = {};
            names.forEach((to, j) => {
                if (from === 'white' && to === 'white') {
                    matrix[from][to] = -0.5;
                } else if (from === 'black' && to === 'black') {
                    matrix[from][to] = 0.5;
                } else {
                    const value = (((i * 7 + j * 13) % 37) / 37) * 1.2 - 0.6;
                    matrix[from][to] = Math.round(value * 10) / 10;
                }
            });
        });
        return matrix;
    }

    const DEFAULT_MATRIX = defaultMatrix(DEFAULT_COLORS);

    const clone = (obj) => JSON.parse(JSON.stringify(obj));

    PD.seed = {
        generate,
        defaultColors: () => clone(DEFAULT_COLORS),
        defaultMatrix: () => clone(DEFAULT_MATRIX)
    };
})(window.PD);
