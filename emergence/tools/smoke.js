/**
 * Smoke test of the physics + observers, without a browser.
 *
 *   node tools/smoke.js            (from the emergence folder)
 *
 * Checks for several law seeds:
 *  - determinism: the same laws + world seed give a bit-identical state
 *  - matter is conserved: photon count never changes, types stay valid
 *  - no NaN / Infinity in positions, velocities, energy
 *  - bond table is consistent (every bond is stored on both ends, valence respected)
 *  - speed: ms per step at 4000 photons
 * Exit code 1 when anything fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
    'js/core/config.js', 'js/core/rng.js', 'js/core/genome.js', 'js/core/spatial-hash.js',
    'js/physics/light.js', 'js/physics/bonds.js', 'js/physics/forces.js', 'js/physics/reactions.js', 'js/physics/world.js',
    'js/observe/structures.js', 'js/observe/catalog.js', 'js/observe/enclosures.js', 'js/observe/observer.js',
    'js/lab/runner.js', 'js/lab/search.js'
];
for (const f of FILES) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const EM = globalThis.EM;
const MV = EM.config.MAX_VALENCE;

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };

function makeWorld(lawsSeed, count, worldSeed = 1) {
    const area = count * 220, width = Math.round(Math.sqrt(area * 1.6));
    return new EM.World({ width, height: Math.round(area / width), count, genome: EM.genome.random(lawsSeed, 5), seed: worldSeed });
}

function checksum(w) {
    let h = 0;
    const mix = (v) => { h = (h * 31 + Math.round(v * 1e4)) | 0; };
    for (let i = 0; i < w.n; i++) { mix(w.x[i]); mix(w.y[i]); mix(w.energy[i]); mix(w.type[i]); mix(w.deg[i]); }
    return h;
}

function checkInvariants(w, label) {
    if (w.n !== w.x.length) fail(`${label}: photon count changed`);
    let bad = 0, bonds = 0;
    for (let i = 0; i < w.n; i++) {
        if (!isFinite(w.x[i]) || !isFinite(w.y[i]) || !isFinite(w.vx[i]) || !isFinite(w.energy[i])) bad++;
        if (w.type[i] >= w.laws.T) fail(`${label}: photon ${i} has invalid type ${w.type[i]}`);
        if (w.deg[i] > w.laws.valence[w.type[i]]) fail(`${label}: photon ${i} exceeds its valence`);
        for (let s = 0; s < w.deg[i]; s++) {
            const j = w.partner[i * MV + s];
            bonds++;
            let back = false;
            for (let q = 0; q < w.deg[j]; q++) if (w.partner[j * MV + q] === i) back = true;
            if (!back) fail(`${label}: bond ${i}-${j} stored on one end only`);
        }
    }
    if (bad) fail(`${label}: ${bad} photons with NaN/Infinity`);
    if (bonds / 2 !== w.bondCount) fail(`${label}: bondCount ${w.bondCount} != table ${bonds / 2}`);
}

console.log(`Emergence v${EM.VERSION} smoke test`);

for (const seed of [1, 2, 3, 42, 2026]) {
    const label = `laws ${seed}`;
    const a = makeWorld(seed, 2000), b = makeWorld(seed, 2000);
    const obs = new EM.Observer(a);
    for (let s = 1; s <= 600; s++) {
        a.step();
        b.step();
        if (s % 20 === 0) obs.observe();
    }
    if (checksum(a) !== checksum(b)) fail(`${label}: not deterministic`);
    checkInvariants(a, label);
    const m = obs.metrics;
    console.log(`  ${label}: bonded ${Math.round((1 - m.freeFraction) * 100)}%, shapes ${m.shapesNow}, catalogue ${m.catalog}, ` +
        `largest ${m.largest}, enclosures ${m.enclosures}, reactions ${a.reactions}`);
}

// genome round trip + mutation keeps the format valid
const g = EM.genome.random(7, 6);
const back = EM.genome.fromJSON(EM.genome.toJSON(g));
if (JSON.stringify(back) !== JSON.stringify(g)) fail('genome JSON round trip changed the genome');
const mutated = EM.genome.mutate(g, new EM.Rng(3));
try { EM.genome.compile(mutated); } catch (e) { fail('mutated genome does not compile: ' + e.message); }

// lab runner + search on a tiny budget
const run = EM.lab.runAll(EM.genome.random(5, 5), { count: 400, steps: 400 });
if (!run.descriptor || !isFinite(run.descriptor.freeFraction)) fail('lab runner returned no descriptor');

// speed
const w = makeWorld(4, 4000);
for (let s = 0; s < 100; s++) w.step();
const t0 = Date.now();
for (let s = 0; s < 200; s++) w.step();
console.log(`  speed: ${((Date.now() - t0) / 200).toFixed(2)} ms/step at 4000 photons`);

console.log(failures ? `${failures} FAILURE(S)` : 'all checks passed');
process.exit(failures ? 1 : 0);
