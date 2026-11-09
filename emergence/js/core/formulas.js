/**
 * Photon formulas - the same idea (and default data) as the photon editor of
 * Gravitation: an ordered list of rows { role, name, expr }. A row with a
 * role feeds that property of every photon; a helper row (role null) only
 * exists so later rows can use its name. Rows are evaluated top to bottom
 * per photon, so rand() gives every photon its own values.
 *
 * Functions inside expressions: rand, abs, min, max, sqrt, pow, round, floor, ceil.
 * rand() uses the world's seeded generator - the same seed gives the same photons.
 */
(function (EM) {
    'use strict';

    /** Roles every formula list must have, and the range each value is clamped to. */
    const ROLES = {
        charge: { min: -10, max: 10, fallback: 0, label: 'charge (sign: − blue, 0 white, + orange)' },
        mass: { min: 0.05, max: 1000, fallback: 1, label: 'mass (inertia)' },
        speed: { min: 0, max: 5000, fallback: 50, label: 'speed px/s (always kept – only direction changes)' },
        energy: { min: -1000, max: 1000, fallback: 10, label: 'energy (use it in other formulas)' },
        force: { min: 0, max: 1e6, fallback: 1000, label: 'force amplitude' },
        forceRange: { min: 0, max: 400, fallback: 50, label: 'force range px' },
        periods: { min: -50, max: 50, fallback: 2, label: 'wave periods inside the range' },
        waveOffset: { min: 0, max: 1, fallback: 0, label: '0 = classic wave, 1 = sign never flips' },
        phaseShift: { min: -1000, max: 1000, fallback: 0, label: 'slides the wave (in periods)' },
        valence: { min: 0, max: 4, fallback: 2, label: 'bonds a photon may hold (0–4)', int: true },
        bondAngle: { min: 0, max: 180, fallback: 60, label: 'minimal angle between two bonds of a photon (°)' }
    };
    const ROLE_NAMES = Object.keys(ROLES);

    /** Gravitation's defaults + our two bond rows. */
    const DEFAULT_VARS = [
        { role: 'charge', name: 'charge', expr: 'rand(-1, 1)' },
        { role: 'mass', name: 'mass', expr: 'rand(0.5, 3)' },
        { role: 'speed', name: 'speed', expr: '100 / mass' },
        { role: 'energy', name: 'energy', expr: '9' },
        { role: 'force', name: 'force', expr: 'abs(charge) * 5000' },
        { role: 'forceRange', name: 'forceRange', expr: 'abs(charge) * 50' },
        { role: null, name: 'pcount', expr: '3' },
        { role: 'periods', name: 'periods', expr: 'energy / pcount' },
        { role: 'waveOffset', name: 'waveOffset', expr: '1' },
        { role: 'phaseShift', name: 'phaseShift', expr: '0' },
        { role: 'valence', name: 'valence', expr: '3' },
        { role: 'bondAngle', name: 'bondAngle', expr: '60' }
    ];

    const HELPER_NAMES = ['rand', 'abs', 'min', 'max', 'sqrt', 'pow', 'round', 'floor', 'ceil'];

    function sanitize(name) {
        let s = String(name || '').trim().replace(/[^a-zA-Z0-9_]/g, '_');
        if (!s) return null;
        if (/^[0-9]/.test(s)) s = '_' + s;
        return s;
    }

    /** Valid list of rows (exactly one row per role); anything broken -> defaults. */
    function normalize(vars) {
        const ok = Array.isArray(vars) &&
            ROLE_NAMES.every((r) => vars.filter((v) => v && v.role === r).length === 1) &&
            vars.every((v) => v && typeof v.name === 'string' && typeof v.expr === 'string' && (v.role == null || ROLES[v.role]));
        const src = ok ? vars : DEFAULT_VARS;
        return src.map((v) => ({ role: v.role || null, name: v.name, expr: v.expr }));
    }

    /** Compiles every row once. Returns { rows, errors } - errors[i] is a message or null. */
    function compile(vars) {
        const names = [];
        const used = new Set(HELPER_NAMES);
        const rows = vars.map((row, i) => {
            let safe = sanitize(row.name) || 'v' + i;
            let fn = null, error = null;
            if (used.has(safe)) {
                error = `name "${row.name}" is already used (or is a function: ${HELPER_NAMES.join(', ')})`;
                safe = safe + '_' + i;
            } else {
                try {
                    // eslint-disable-next-line no-new-func
                    fn = new Function(...names, ...HELPER_NAMES,
                        '"use strict"; const v = (' + row.expr + '); ' +
                        'if (typeof v !== "number" || !isFinite(v)) throw new Error("result is not a number"); return v;');
                } catch (e) {
                    error = e.message || 'syntax error';
                }
            }
            used.add(safe);
            const out = { row, safe, fn, error, args: names.slice() };
            names.push(safe);
            return out;
        });
        return { rows, errors: rows.map((r) => r.error) };
    }

    function clampRole(role, v) {
        const R = ROLES[role];
        if (typeof v !== 'number' || !isFinite(v)) return R.fallback;
        v = Math.max(R.min, Math.min(R.max, v));
        return R.int ? Math.round(v) : v;
    }

    /**
     * Runs the compiled rows for one photon.
     * @param compiled  result of compile()
     * @param rng       EM.Rng for rand()
     * @param overrides { role: value } kept instead of evaluated (a photon keeps its identity)
     * @returns {{ values: Object, errors: Array }} values per role (clamped)
     */
    function run(compiled, rng, overrides) {
        const rand = (a = 0, b = 1) => a + rng.next() * (b - a);
        const fns = [rand, Math.abs, Math.min, Math.max, Math.sqrt, Math.pow, Math.round, Math.floor, Math.ceil];
        const scope = {}, values = {}, errors = [];
        compiled.rows.forEach((c, i) => {
            let v, err = c.error;
            if (overrides && c.row.role && Object.prototype.hasOwnProperty.call(overrides, c.row.role)) {
                v = overrides[c.row.role];
            } else if (c.fn) {
                try {
                    v = c.fn(...c.args.map((n) => scope[n]), ...fns);
                } catch (e) {
                    v = c.row.role ? ROLES[c.row.role].fallback : 0;
                    err = e.message || 'expression error';
                }
            } else {
                v = c.row.role ? ROLES[c.row.role].fallback : 0;
            }
            scope[c.safe] = v;
            if (c.row.role) values[c.row.role] = clampRole(c.row.role, v);
            errors[i] = err;
        });
        return { values, errors };
    }

    EM.formulas = { ROLES, ROLE_NAMES, DEFAULT_VARS, HELPER_NAMES, normalize, compile, run };
})(EM);
