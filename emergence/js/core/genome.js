/**
 * Laws of a world (format 3, since v0.9): the photon formulas (Gravitation's
 * editor, js/core/formulas.js) + a few environment numbers.
 *
 *   { format: 3, seed, vars: [{ role, name, expr }], env: { pressure, temperature, ... } }
 *
 * seed = randomness of rand() in the formulas (which photon gets which values).
 * compile() turns this into `laws`, the object the physics reads.
 */
(function (EM) {
    'use strict';

    const FORMAT = 3;

    /** Environment: few numbers on purpose. */
    const ENV = [
        { key: 'pressure', label: 'Pressure', min: 0, max: 1, def: 0.8, help: 'Bond length: 1 = bonded photons touch, 0 = 2.5 x longer' },
        { key: 'temperature', label: 'Temperature', min: 0, max: 1, def: 0, help: 'Weakens the force between photons: force x (1 − temperature)' },
        { key: 'bondStrength', label: 'Bond strength', min: 0, max: 5000, def: 1500, help: 'Spring force of a bond per px of stretch' },
        { key: 'bondBreak', label: 'Bond breaks at', min: 1.1, max: 4, def: 2, help: 'A bond breaks beyond this x its length' },
        { key: 'bondChance', label: 'Bond chance', min: 0, max: 1, def: 0.2, help: 'Chance per step that two touching photons with free bonds bond' },
        { key: 'angleStiffness', label: 'Angle stiffness', min: 0, max: 5000, def: 1500, help: 'How hard bonds of one photon are pushed apart below its bondAngle' }
    ];

    /** charge classes for colours, observers and the catalogue: negative, neutral, positive */
    const COLORS = ['hsl(214, 90%, 64%)', 'hsl(220, 15%, 92%)', 'hsl(30, 95%, 60%)'];

    function defaultEnv() {
        const env = {};
        ENV.forEach((e) => { env[e.key] = e.def; });
        return env;
    }

    /** Laws with the given formulas (default: Gravitation's) and seed. */
    function random(seed, vars) {
        return {
            format: FORMAT,
            seed: seed >>> 0,
            vars: EM.formulas.normalize(vars || EM.formulas.DEFAULT_VARS),
            env: defaultEnv()
        };
    }

    /** Same laws, new seed (the Lab is off in this model; "mutate" = new randomness). */
    function mutate(genome, rng) {
        const g = JSON.parse(JSON.stringify(genome));
        g.seed = Math.floor(rng.next() * 4294967296) >>> 0;
        return g;
    }

    /** Distances that depend on the pressure. */
    function applyEnv(L) {
        const env = L.env, r = L.radius;
        L.pressure = env.pressure;
        L.temperature = env.temperature;
        L.dmin = 2 * r;                                        // hard boundary: surfaces touch
        L.coreR = L.dmin;
        L.bondLen = 2 * r * (1 + 1.5 * (1 - env.pressure));   // pressure -> bond length
        L.formDist = L.bondLen * 1.3;                          // bonds form within this
        L.breakDist = L.bondLen * env.bondBreak;
        L.forceFactor = Math.max(0, 1 - env.temperature);       // temperature weakens the force
        return L;
    }

    function compile(g) {
        const compiled = EM.formulas.compile(g.vars);
        const L = {
            format: FORMAT,
            genome: g,
            env: g.env,
            vars: g.vars,
            compiled,
            T: 3,
            color: COLORS.slice(),
            radius: EM.config.PHOTON_RADIUS,
            dt: 1 / 60,
            // no light / energy flow in this model (kept empty for shared code)
            light: { ambient: 0, suns: 0, radius: 0.2, drift: 0, dayPeriod: 0 },
            hasOrientation: false
        };
        return applyEnv(L);
    }

    function toJSON(g) {
        return JSON.stringify(g, null, 1);
    }

    function fromJSON(text) {
        const g = JSON.parse(text);
        if (g && (g.format === 1 || g.format === 2)) {
            throw new Error(`these laws are from an older Emergence (format ${g.format}) – open them in the v0.6 / v0.8 version`);
        }
        if (!g || g.format !== FORMAT || !Array.isArray(g.vars)) throw new Error('Unsupported laws file');
        g.vars = EM.formulas.normalize(g.vars);
        g.env = Object.assign(defaultEnv(), g.env || {});
        g.seed = (g.seed || 1) >>> 0;
        return g;
    }

    EM.genome = { FORMAT, ENV, COLORS, random, mutate, compile, applyEnv, defaultEnv, toJSON, fromJSON };
})(EM);
