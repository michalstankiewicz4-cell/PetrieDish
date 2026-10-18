/**
 * Global namespace + static configuration.
 *
 * Every script attaches its public API to `window.PD`, so files can be loaded as
 * plain <script defer> tags (works from file:// and on GitHub Pages, no build).
 * Load order is defined in index.html.
 */
window.PD = window.PD || {};

(function (PD) {
    'use strict';

    PD.VERSION = '3.1.0';

    /** Set to true (or call PD.setDebug(true) in the console) to enable PD.log output. */
    PD.debug = false;
    PD.setDebug = (on) => { PD.debug = !!on; };
    PD.log = (...args) => { if (PD.debug) console.log(...args); };

    const DEFAULT_COLORS = [
        { hex: '#FFFFFF', charge: -1, mass: 1.05, interactionRange: 50, vorticness: 0.25, initialSpeed: 1.0, name: 'white' },
        { hex: '#000000', charge: 1, mass: 0.95, interactionRange: 50, vorticness: 0.35, initialSpeed: 1.0, name: 'black' },
        { hex: '#FF0000', charge: 1, mass: 1.0, interactionRange: 50, vorticness: 0.3, initialSpeed: 1.0, name: 'red' },
        { hex: '#00FF00', charge: -1, mass: 0.8, interactionRange: 50, vorticness: 0.2, initialSpeed: 1.0, name: 'green' },
        { hex: '#0000FF', charge: 1, mass: 1.2, interactionRange: 50, vorticness: 0.5, initialSpeed: 1.0, name: 'blue' },
        { hex: '#00FFFF', charge: -1, mass: 0.9, interactionRange: 50, vorticness: 0.1, initialSpeed: 1.0, name: 'cyan' },
        { hex: '#FF00FF', charge: 1, mass: 1.1, interactionRange: 50, vorticness: 0.4, initialSpeed: 1.0, name: 'magenta' },
        { hex: '#FFFF00', charge: -1, mass: 0.7, interactionRange: 50, vorticness: 0.6, initialSpeed: 1.0, name: 'yellow' },
        { hex: '#FFBF00', charge: 1, mass: 0.85, interactionRange: 50, vorticness: 0.45, initialSpeed: 1.0, name: 'amber' },
        { hex: '#8000FF', charge: -1, mass: 1.15, interactionRange: 50, vorticness: 0.15, initialSpeed: 1.0, name: 'purple' },
        { hex: '#FF6600', charge: 1, mass: 0.75, interactionRange: 50, vorticness: 0.55, initialSpeed: 1.0, name: 'orange' },
        { hex: '#FF69B4', charge: -1, mass: 1.25, interactionRange: 50, vorticness: 0.2, initialSpeed: 1.0, name: 'pink' },
        { hex: '#00FF88', charge: 1, mass: 0.9, interactionRange: 50, vorticness: 0.4, name: 'lime' },
        { hex: '#00CED1', charge: -1, mass: 1.1, interactionRange: 50, vorticness: 0.3, name: 'turquoise' },
        { hex: '#FF1493', charge: 1, mass: 0.8, interactionRange: 50, vorticness: 0.5, name: 'deeppink' }
    ];

    /**
     * Named samples for the "Sample" dropdown, e.g. { seed: 42, name: 'The Answer' }.
     * Empty for now - the new list will be added here.
     */
    const SAMPLES = [];

    PD.config = {
        DEFAULT_COLORS,
        SAMPLES,
        MAX_SPECIES: DEFAULT_COLORS.length,

        /** Canvas fill used when the world is (re)initialised. */
        CLEAR_COLOR: '#0a0a14',

        /** Spatial grid cell size; must be >= the largest interaction range in normal use. */
        GRID_CELL_SIZE: 150,

        MAX_SPEED: 3,
        MOUSE_RANGE: 100,
        MOUSE_FORCE: 0.6,

        /** Safety cap so a slow frame does not trigger a burst of catch-up physics steps. */
        MAX_PHYSICS_STEPS_PER_FRAME: 2,

        /** Bond formation counts frames assuming this rate. */
        BOND_TARGET_FPS: 60,

        /** Life detection runs every N-th physics step. */
        LIFE_DETECT_EVERY: 3,

        CANVAS_SIZE_LIMITS: { minW: 200, maxW: 5000, minH: 150, maxH: 5000 },

        /** localStorage keys (unchanged from v2 so saved settings survive the refactor). */
        STORAGE_KEYS: {
            fpsBooster: 'fpsBoosterValue',
            fpsDisplay: 'fpsDisplayEnabled',
            seedDisplay: 'seedDisplayEnabled',
            lifeScannerDisplay: 'lifeScannerDisplayEnabled',
            autoHide: 'autoHideButtonsEnabled'
        }
    };
})(window.PD);
