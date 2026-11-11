/**
 * WGSL compute kernels of the GPU backend - Gravitation photon model (v0.9+).
 * Same formulas as js/physics/world.js, "one thread per photon" (forces are
 * gathered, so no float atomics).
 *
 * Buffers per photon:
 *   state[2i]   = (x, y, z, 0)       state[2i+1] = (vx, vy, vz, 0)      (ping-pong)
 *   props[3i]   = (charge, invMass, speed, force)
 *   props[3i+1] = (forceRange, periods, waveOffset, phaseShift)
 *   props[3i+2] = (valence, cos(bondAngle), 0, 0)                      (from the formulas, CPU)
 *   partner[i]  = vec4<i32> bond slots (-1 = empty, holes allowed)
 *   acc[2i]     = (fx, fy, fz, over)  over = 1 when it holds more bonds than its valence
 *   acc[2i+1].w = bitcast proposal (photon i wants to bond with)
 *
 * One step = count -> scan -> scatter (grid) -> pairs -> update -> contact x5.
 *  pairs:  Gravitation's force (averaged over both photons) x (1 - temperature),
 *          bond springs, angle pushes, best bond proposal
 *  update: breaks (too long / over valence), mutual proposals become bonds,
 *          v += F/m dt, |v| = speed, move, wrap
 *  contact: hard boundary, Jacobi passes
 * Random numbers: a hash of (photon ids, step, purpose) - both ends of a bond
 * compute the same value, so bond decisions agree without communication.
 */
(function (EM) {
    'use strict';

    const COMMON = /* wgsl */ `
struct Params {
  W: f32, H: f32, D: f32, dt: f32,
  dmin: f32, bondLen: f32, formDist: f32, breakDist: f32,
  forceFactor: f32, bondK: f32, bondChance: f32, angleK: f32,
  cellW: f32, cellH: f32, cellD: f32, pad0: f32,
  n: u32, cols: u32, rows: u32, layers: u32,
  cells: u32, dim: u32, bonding: u32, pad1: u32,
};
struct Clock { step: u32, a: u32, b: u32, c: u32, };

fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn hash3(a: u32, b: u32, c: u32) -> u32 { return pcg(a ^ pcg(b ^ pcg(c))); }
fn rnd(a: u32, b: u32, c: u32) -> f32 { return f32(hash3(a, b, c) >> 8u) * (1.0 / 16777216.0); }

fn wrapd(d: f32, L: f32) -> f32 {
  var v = d;
  if (v > 0.5 * L) { v -= L; } else if (v < -0.5 * L) { v += L; }
  return v;
}
fn delta(a: vec3f, b: vec3f) -> vec3f {
  return vec3f(wrapd(b.x - a.x, P.W), wrapd(b.y - a.y, P.H), wrapd(b.z - a.z, P.D));
}
fn wrapPos(p: vec3f) -> vec3f {
  var q = p;
  if (q.x < 0.0) { q.x += P.W; } else if (q.x >= P.W) { q.x -= P.W; }
  if (q.y < 0.0) { q.y += P.H; } else if (q.y >= P.H) { q.y -= P.H; }
  if (P.dim == 3u) {
    if (q.z < 0.0) { q.z += P.D; } else if (q.z >= P.D) { q.z -= P.D; }
  } else {
    q.z = 0.0;
  }
  q = min(q, vec3f(P.W, P.H, max(P.D, 1.0)) - vec3f(0.001));
  return max(q, vec3f(0.0));
}
fn cellCoords(p: vec3f) -> vec3u {
  return vec3u(min(u32(p.x / P.cellW), P.cols - 1u),
               min(u32(p.y / P.cellH), P.rows - 1u),
               min(u32(p.z / P.cellD), P.layers - 1u));
}
fn deg4(s: vec4i) -> u32 { return u32(s.x >= 0) + u32(s.y >= 0) + u32(s.z >= 0) + u32(s.w >= 0); }
`;

    /** neighbour-cell loop header shared by pairs and contact (each cell once even with < 3 cells) */
    const NEIGHBOURS = /* wgsl */ `
  let c3 = vec3i(cellCoords(pi));
  let cols = i32(P.cols); let rows = i32(P.rows); let layers = i32(P.layers);
  let lx = select(0, -1, cols >= 3); let hx = select(0, 1, cols >= 2);
  let ly = select(0, -1, rows >= 3); let hy = select(0, 1, rows >= 2);
  let lz = select(0, -1, layers >= 3); let hz = select(0, 1, layers >= 2);
  for (var oz = lz; oz <= hz; oz++) {
    let cz = (c3.z + oz + layers) % layers;
    for (var oy = ly; oy <= hy; oy++) {
      let cy = (c3.y + oy + rows) % rows;
      for (var ox = lx; ox <= hx; ox++) {
        let cx = (c3.x + ox + cols) % cols;
        let nc = u32((cz * rows + cy) * cols + cx);
        let cend = cellStart[nc + 1u];
        for (var b = cellStart[nc]; b < cend; b++) {
          let j = sorted[b];
          if (j == i) { continue; }
`;
    const NEIGHBOURS_END = `
        }
      }
    }
  }
`;

    const COUNT = /* wgsl */ `
@group(0) @binding(0) var<uniform> P: Params;
${COMMON}
@group(0) @binding(1) var<storage, read> st: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> cellCount: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> cellInfo: array<vec2u>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let c3 = cellCoords(st[i * 2u].xyz);
  let c = (c3.z * P.rows + c3.y) * P.cols + c3.x;
  cellInfo[i] = vec2u(c, atomicAdd(&cellCount[c], 1u));
}
`;

    const SCAN = /* wgsl */ `
@group(0) @binding(0) var<uniform> P: Params;
${COMMON}
@group(0) @binding(1) var<storage, read_write> cellCount: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> cellStart: array<u32>;
var<workgroup> sums: array<u32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_index) t: u32) {
  let C = P.cells;
  let chunk = (C + 255u) / 256u;
  let a = t * chunk;
  let b = min(a + chunk, C);
  var s = 0u;
  for (var c = a; c < b; c++) { s += atomicLoad(&cellCount[c]); }
  sums[t] = s;
  workgroupBarrier();
  for (var off = 1u; off < 256u; off = off << 1u) {
    var v = 0u;
    if (t >= off) { v = sums[t - off]; }
    workgroupBarrier();
    sums[t] += v;
    workgroupBarrier();
  }
  var run = sums[t] - s;
  for (var c = a; c < b; c++) {
    cellStart[c] = run;
    run += atomicLoad(&cellCount[c]);
    atomicStore(&cellCount[c], 0u);
  }
  if (t == 255u) { cellStart[C] = sums[255]; }
}
`;

    const SCATTER = /* wgsl */ `
@group(0) @binding(0) var<uniform> P: Params;
${COMMON}
@group(0) @binding(1) var<storage, read> cellInfo: array<vec2u>;
@group(0) @binding(2) var<storage, read> cellStart: array<u32>;
@group(0) @binding(3) var<storage, read_write> sorted: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let info = cellInfo[i];
  sorted[cellStart[info.x] + info.y] = i;
}
`;

    const PAIRS = /* wgsl */ `
@group(0) @binding(0) var<uniform> P: Params;
${COMMON}
@group(0) @binding(1) var<storage, read> st: array<vec4f>;
@group(0) @binding(2) var<storage, read> props: array<vec4f>;
@group(0) @binding(3) var<storage, read> partner: array<vec4i>;
@group(0) @binding(4) var<storage, read> cellStart: array<u32>;
@group(0) @binding(5) var<storage, read> sorted: array<u32>;
@group(0) @binding(6) var<storage, read_write> acc: array<vec4f>;
@group(1) @binding(0) var<uniform> clock: Clock;

fn posOf(j: u32) -> vec3f { return st[j * 2u].xyz; }

/** the direction n (unit, from photon k) keeps >= bondAngle_k to every bond k already has */
fn angleOk(k: u32, pk: vec3f, n: vec3f) -> bool {
  let lim = props[k * 3u + 2u].y;
  let s = partner[k];
  for (var q = 0u; q < 4u; q++) {
    if (s[q] < 0) { continue; }
    let a = delta(pk, posOf(u32(s[q])));
    let la = max(length(a), 1e-6);
    if (dot(a, n) / la > lim + 1e-6) { return false; }
  }
  return true;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let pi = posOf(i);
  let A0 = props[i * 3u];
  let A1 = props[i * 3u + 1u];
  let A2 = props[i * 3u + 2u];
  let mySlots = partner[i];
  let degI = deg4(mySlots);
  let valI = u32(A2.x);
  let bonding = P.bonding != 0u && P.bondChance > 0.0 && degI < valI;
  let form2 = P.formDist * P.formDist;
  let TAU = 6.283185307179586;
  let salt = clock.step * 8u;

  var f = vec3f(0.0);
  var best = -1;
  var bestScore = 0u;
${NEIGHBOURS}
          let pj = posOf(j);
          let d = delta(pi, pj);
          let d2 = dot(d, d);
          let B0 = props[j * 3u];
          let B1 = props[j * 3u + 1u];
          let rg = (A1.x + B1.x) * 0.5;
          let inForce = d2 < rg * rg && d2 > 0.0;
          let inBond = bonding && d2 < form2;
          if (!inForce && !inBond) { continue; }
          let dist = max(sqrt(d2), 1e-6);
          let n = d / dist;
          if (inForce) {
            let o = (A1.z + B1.z) * 0.5;
            let wave = (sin(TAU * ((A1.y + B1.y) * 0.5 * dist / rg + (A1.w + B1.w) * 0.5)) + o) / (1.0 + o);
            let sgn = select(-1.0, 1.0, A0.x * B0.x < 0.0);
            f += n * (sgn * (A0.w + B0.w) * 0.5 * wave * (1.0 - dist / rg) * P.forceFactor);
          }
          if (inBond) {
            let sj = partner[j];
            if (!any(mySlots == vec4i(i32(j))) && deg4(sj) < u32(props[j * 3u + 2u].x)
                && angleOk(i, pi, n) && angleOk(j, pj, -n)) {
              let lo = min(i, j); let hiI = max(i, j);
              if (rnd(lo, hiI, salt + 2u) < P.bondChance) {
                let score = hash3(lo, hiI, salt + 1u);
                if (best < 0 || score > bestScore) { best = i32(j); bestScore = score; }
              }
            }
          }
${NEIGHBOURS_END}

  // bond springs (to the bond length set by the pressure)
  for (var s = 0u; s < 4u; s++) {
    if (mySlots[s] < 0) { continue; }
    let d = delta(pi, posOf(u32(mySlots[s])));
    let dist = max(length(d), 1e-6);
    f += d * (P.bondK * (dist - P.bondLen) / dist);
  }

  // angles: as the end of a bond of partner k, pushed away from k's other bond ends
  if (P.angleK > 0.0) {
    for (var s = 0u; s < 4u; s++) {
      if (mySlots[s] < 0) { continue; }
      let k = u32(mySlots[s]);
      let pk = posOf(k);
      let lim = props[k * 3u + 2u].y;
      let a = delta(pk, pi);
      let la = max(length(a), 1e-6);
      let sk = partner[k];
      for (var q = 0u; q < 4u; q++) {
        if (sk[q] < 0 || u32(sk[q]) == i) { continue; }
        let bv = delta(pk, posOf(u32(sk[q])));
        let lb = max(length(bv), 1e-6);
        let c = dot(a, bv) / (la * lb);
        if (c <= lim) { continue; }
        let w = bv - a;
        let wl = max(length(w), 1e-6);
        f -= w * (P.angleK * (c - lim) / wl);
      }
    }
  }

  acc[i * 2u] = vec4f(f, select(0.0, 1.0, degI > valI));
  acc[i * 2u + 1u] = vec4f(0.0, 0.0, 0.0, bitcast<f32>(best));
}
`;

    const UPDATE = /* wgsl */ `
@group(0) @binding(0) var<uniform> P: Params;
${COMMON}
@group(0) @binding(1) var<storage, read> st: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> out: array<vec4f>;
@group(0) @binding(3) var<storage, read> acc: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> partner: array<vec4i>;
@group(0) @binding(5) var<storage, read> props: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> counters: array<atomic<u32>>;
@group(1) @binding(0) var<uniform> clock: Clock;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let pos = st[i * 2u].xyz;
  var vel = st[i * 2u + 1u].xyz;
  let F = acc[i * 2u];
  let prop = bitcast<i32>(acc[i * 2u + 1u].w);
  let A0 = props[i * 3u];
  var slots = partner[i];
  let salt = clock.step * 8u;

  // breaks: too long, or one end holds more bonds than its valence (both ends agree)
  for (var s = 0u; s < 4u; s++) {
    let jj = slots[s];
    if (jj < 0) { continue; }
    let j = u32(jj);
    let dist = length(delta(pos, st[j * 2u].xyz));
    if (dist > P.breakDist || F.w > 0.5 || acc[j * 2u].w > 0.5) {
      slots[s] = -1;
      if (i < j) { atomicAdd(&counters[1], 1u); }
    }
  }
  // new bond: both photons proposed each other
  if (prop >= 0) {
    let j = u32(prop);
    if (bitcast<i32>(acc[j * 2u + 1u].w) == i32(i)) {
      if (slots.x < 0) { slots.x = i32(j); }
      else if (slots.y < 0) { slots.y = i32(j); }
      else if (slots.z < 0) { slots.z = i32(j); }
      else { slots.w = i32(j); }
      if (i < j) { atomicAdd(&counters[0], 1u); }
    }
  }
  partner[i] = slots;

  // move: the force turns the photon, its speed stays (Gravitation)
  vel += F.xyz * (A0.y * P.dt);
  if (P.dim != 3u) { vel.z = 0.0; }
  let s = length(vel);
  if (s > 1e-6) {
    vel *= A0.z / s;
  } else if (A0.z > 0.0) {
    let a = rnd(i, salt + 5u, 0u) * 6.283185307179586;
    if (P.dim == 3u) {
      let z = rnd(i, salt + 5u, 1u) * 2.0 - 1.0;
      let r = sqrt(1.0 - z * z);
      vel = vec3f(cos(a) * r, sin(a) * r, z) * A0.z;
    } else {
      vel = vec3f(cos(a), sin(a), 0.0) * A0.z;
    }
  }
  out[i * 2u] = vec4f(wrapPos(pos + vel * P.dt), 0.0);
  out[i * 2u + 1u] = vec4f(vel, 0.0);
}
`;

    /** Hard boundary: each photon moves its own mass-weighted share out of overlaps (Jacobi). */
    const CONTACT = /* wgsl */ `
@group(0) @binding(0) var<uniform> P: Params;
${COMMON}
@group(0) @binding(1) var<storage, read> st: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> out: array<vec4f>;
@group(0) @binding(3) var<storage, read> props: array<vec4f>;
@group(0) @binding(4) var<storage, read> cellStart: array<u32>;
@group(0) @binding(5) var<storage, read> sorted: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let pi = st[i * 2u].xyz;
  let vel = st[i * 2u + 1u].xyz;
  let wi = props[i * 3u].y;
  let d2min = P.dmin * P.dmin;
  var dp = vec3f(0.0);
  var dv = vec3f(0.0);
${NEIGHBOURS}
          let d = delta(pi, st[j * 2u].xyz);
          let d2 = dot(d, d);
          if (d2 >= d2min) { continue; }
          var dist = sqrt(d2);
          var n = vec3f(select(-1.0, 1.0, i < j), 0.0, 0.0);
          if (dist > 1e-6) { n = d / dist; } else { dist = 0.0; }
          let wj = props[j * 3u].y;
          let ws = wi + wj;
          dp -= n * ((P.dmin - dist) / ws * wi);
          let vn = dot(st[j * 2u + 1u].xyz - vel, n);
          if (vn < 0.0) { dv -= n * (-vn / ws * wi); }
${NEIGHBOURS_END}
  out[i * 2u] = vec4f(wrapPos(pi + dp), 0.0);
  out[i * 2u + 1u] = vec4f(vel + dv, 0.0);
}
`;

    EM.gpuKernels = { COUNT, SCAN, SCATTER, PAIRS, UPDATE, CONTACT };
})(EM);
