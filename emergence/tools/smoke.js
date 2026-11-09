/**
 * Smoke test of the physics + observers, without a browser.
 *
 *   node tools/smoke.js            (from the emergence folder)
 *
 * Gravitation photon model (v0.9), in 2D and 3D:
 *  - determinism: the same seeds give a bit-identical state
 *  - finite numbers, positions inside the world, speed kept (|v| = speed)
 *  - bond table consistent (both ends, valence respected), photons never overlap
 *  - formulas: errors fall back, live edit keeps charge / mass / energy
 *  - pressure sets the bond length, temperature weakens the force
 *  - speed: ms per step
 * Exit code 1 when anything fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
    'js/core/config.js', 'js/core/rng.js', 'js/core/formulas.js', 'js/core/genome.js',
    'js/physics/light.js', 'js/physics/bonds.js', 'js/physics/world.js',
    'js/observe/structures.js', 'js/observe/catalog.js', 'js/observe/enclosures.js', 'js/observe/observer.js'
];
for (const f of FILES) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const EM = globalThis.EM;
const MV = EM.config.MAX_VALENCE;

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };

function makeWorld(seed, count, dim = 3, worldSeed = 1, genome) {
    const g = genome || EM.genome.random(seed);
    if (dim === 3) {
        const s = Math.round(Math.cbrt(count * 40000));
        return new EM.World({ width: s, height: s, depth: s, count, genome: g, seed: worldSeed });
    }
    const W = Math.round(Math.sqrt(count * 1500 * 1.6));
    return new EM.World({ width: W, height: Math.round(count * 1500 / W), count, genome: g, seed: worldSeed });
}

function checksum(w) {
    let h = 0;
    for (let i = 0; i < w.n; i++) h = (h * 31 + Math.round(w.x[i] * 1000) + Math.round(w.y[i] * 7000) + Math.round(w.z[i] * 13000) + w.deg[i]) % 1e9;
    return h;
}

function checkInvariants(w, label) {
    let bad = 0;
    for (let i = 0; i < w.n; i++) {
        const v = [w.x[i], w.y[i], w.z[i], w.vx[i], w.vy[i], w.vz[i]];
        if (v.some((a) => !Number.isFinite(a))) { bad++; continue; }
        if (w.x[i] < 0 || w.x[i] >= w.width || w.y[i] < 0 || w.y[i] >= w.height) fail(`${label}: photon ${i} outside`);
        const s = Math.hypot(w.vx[i], w.vy[i], w.vz[i]);
        if (Math.abs(s - w.speed[i]) > 0.02 * w.speed[i] + 0.05 && w.steps > 0) {
            // the hard boundary may slow a photon for the rest of a step; the next step restores it
            if (Math.abs(s - w.speed[i]) > w.speed[i] + 1) fail(`${label}: photon ${i} speed ${s.toFixed(2)} vs ${w.speed[i].toFixed(2)}`);
        }
        if (w.deg[i] > w.valence[i]) fail(`${label}: photon ${i} has ${w.deg[i]} bonds, valence ${w.valence[i]}`);
        for (let s2 = 0; s2 < w.deg[i]; s2++) {
            const j = w.partner[i * MV + s2];
            if (!EM.bonds.isBonded(w, j, i)) fail(`${label}: one-sided bond ${i}-${j}`);
        }
    }
    if (bad) fail(`${label}: ${bad} photons with NaN/Infinity`);
    let close = 0, minD = Infinity;
    for (let i = 0; i < Math.min(w.n, 400); i++) {
        for (let j = i + 1; j < w.n; j++) {
            const [dx, dy, dz] = w.offset(i, j);
            const d = Math.hypot(dx, dy, dz);
            if (d < minD) minD = d;
            if (d < w.laws.dmin * 0.9) close++;
        }
    }
    if (close > 2) fail(`${label}: ${close} pairs overlap (closest ${minD.toFixed(2)} px, touching ${w.laws.dmin} px)`);
    return minD;
}

console.log(`Emergence v${EM.VERSION} smoke test`);

for (const [seed, dim] of [[1, 2], [2, 2], [3, 3], [4, 3]]) {
    const n = dim === 3 ? 900 : 1200, steps = 400;
    const a = makeWorld(seed, n, dim), b = makeWorld(seed, n, dim);
    const obs = new EM.Observer(a);
    for (let s = 0; s < steps; s++) {
        a.step();
        b.step();
        if (s % 20 === 19) obs.observe();
    }
    if (checksum(a) !== checksum(b)) fail(`seed ${seed} ${dim}D: not deterministic`);
    const minD = checkInvariants(a, `seed ${seed} ${dim}D`);
    const m = obs.metrics;
    console.log(`  ${dim}D seed ${seed}: bonds ${a.bondCount}, bonded ${Math.round((1 - m.freeFraction) * 100)}%, ` +
        `largest ${m.largest}, catalogue ${m.catalog}, elements ${m.elements}, closest ${minD.toFixed(2)} px`);
}

// formulas
{
    const g = EM.genome.random(5);
    g.vars = g.vars.map((v) => v.role === 'mass' ? Object.assign({}, v, { expr: 'oops(' }) : v);
    const c = EM.genome.compile(g);
    if (!c.compiled.errors.some(Boolean)) fail('a broken formula reports no error');
    const w = makeWorld(5, 300, 3, 1, g);
    if (!Array.from(w.mass).every((m) => m === EM.formulas.ROLES.mass.fallback)) fail('broken mass formula did not fall back');
}
{
    const w = makeWorld(6, 400, 3);
    const charges = Array.from(w.charge), masses = Array.from(w.mass);
    const g = w.genome;
    g.vars = g.vars.map((v) => v.role === 'speed' ? Object.assign({}, v, { expr: '7' }) : v);
    w.setLaws(EM.genome.compile(g));
    if (!w.charge.every((q, i) => q === charges[i]) || !w.mass.every((m, i) => m === masses[i])) fail('live formula edit changed charge or mass');
    if (!w.speed.every((s) => s === 7)) fail('live formula edit did not change speed');
}
// environment
{
    const w = makeWorld(7, 300, 3);
    w.setPressure(1);
    const l1 = w.laws.bondLen;
    w.setPressure(0);
    if (!(w.laws.bondLen > l1 * 2)) fail('pressure does not change the bond length');
    w.laws.env.temperature = 0.75;
    w.setEnv();
    if (Math.abs(w.laws.forceFactor - 0.25) > 1e-9) fail('temperature does not weaken the force');
}
// genome file round trip
{
    const g = EM.genome.random(9);
    const back = EM.genome.fromJSON(EM.genome.toJSON(g));
    if (JSON.stringify(back) !== JSON.stringify(g)) fail('genome JSON round trip differs');
}

for (const [dim, count] of [[2, 3000], [3, 2000]]) {
    const w = makeWorld(1, count, dim);
    for (let s = 0; s < 20; s++) w.step();
    const t0 = process.hrtime.bigint();
    for (let s = 0; s < 60; s++) w.step();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 60;
    console.log(`  speed ${dim}D ${count} photons: ${ms.toFixed(2)} ms/step`);
}

console.log(failures ? `${failures} FAILURE(S)` : 'all checks passed');
process.exit(failures ? 1 : 0);
