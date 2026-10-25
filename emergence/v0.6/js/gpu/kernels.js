/**
 * WGSL compute kernels of the GPU backend. Same laws and formulas as
 * js/physics/*, rewritten "one thread per photon" (gather instead of the
 * CPU half-shell scatter, so no float atomics are needed).
 *
 * One step = 5 dispatches:
 *   count   -> cell of every photon + its rank inside the cell (atomicAdd)
 *   scan    -> cellStart = prefix sum of cell counts (one workgroup), counts reset to 0
 *   scatter -> sorted[cellStart[cell] + rank] = photon
 *   pairs   -> pair forces, torque, bond proposal (best candidate per photon)
 *   update  -> bond springs / breaks / energy flow, mutual proposals become bonds,
 *              reactions, integration (light, leak, thrust, friction, noise, wrap)
 *
 * Data per photon (state buffer, 3 x vec4):
 *   [3i]   = (x, y, z, energy)
 *   [3i+1] = (vx, vy, vz, bitcast type)
 *   [3i+2] = (hx, hy, hz, theta)       2D: h = (cos theta, sin theta, 0)
 * partner[i] = vec4<i32> bond slots (-1 = empty, holes allowed)
 * acc[2i] = (fx, fy, fz, turn2d), acc[2i+1] = (tx, ty, tz, bitcast proposal)
 *
 * Randomness: a counter-based hash of (photon ids, step, purpose) - both ends
 * of a bond compute the same number, so decisions about a bond are symmetric
 * without communication.
 */
(function (EM) {
    'use strict';

    /** Layout of the laws buffer (floats). Keep in sync with gpu-world.js packLaws. */
    const LAWS = {
        PAIR_STRIDE: 16,
        AMP: 0, K: 1, PH: 2, POL: 3, TOR: 4, AFF: 5, BLEN: 6, BFORM: 7,
        BBRK: 8, BK: 9, BINDE: 10, ACT: 11, DEC: 12, RXTO: 13, RXTHR: 14,
        TYPE_BASE: 1024, TYPE_STRIDE: 8,
        IM: 0, ABS: 1, LEAK: 2, THR: 3, VAL: 4
    };

    const COMMON = /* wgsl */ `
struct Params {
  W: f32, H: f32, D: f32, R: f32,
  coreR: f32, coreK: f32, forceScale: f32, friction: f32,
  temperature: f32, bondFormRate: f32, maxSpeed: f32, spin: f32,
  energyShare: f32, reactionRate: f32, cellW: f32, cellH: f32,
  cellD: f32, n: u32, T: u32, cols: u32,
  rows: u32, layers: u32, cells: u32, dim: u32,
  flags: u32, lcols: u32, lrows: u32, llayers: u32,
};
struct Clock { step: u32, a: u32, b: u32, c: u32, };

const PS: u32 = ${LAWS.PAIR_STRIDE}u;
const AMP: u32 = ${LAWS.AMP}u; const KW: u32 = ${LAWS.K}u; const PH: u32 = ${LAWS.PH}u;
const POL: u32 = ${LAWS.POL}u; const TOR: u32 = ${LAWS.TOR}u; const AFF: u32 = ${LAWS.AFF}u;
const BLEN: u32 = ${LAWS.BLEN}u; const BFORM: u32 = ${LAWS.BFORM}u; const BBRK: u32 = ${LAWS.BBRK}u;
const BK: u32 = ${LAWS.BK}u; const BINDE: u32 = ${LAWS.BINDE}u; const ACT: u32 = ${LAWS.ACT}u;
const DEC: u32 = ${LAWS.DEC}u; const RXTO: u32 = ${LAWS.RXTO}u; const RXTHR: u32 = ${LAWS.RXTHR}u;
const TB: u32 = ${LAWS.TYPE_BASE}u; const TS: u32 = ${LAWS.TYPE_STRIDE}u;
const IM: u32 = ${LAWS.IM}u; const ABSO: u32 = ${LAWS.ABS}u; const LEAK: u32 = ${LAWS.LEAK}u;
const THR: u32 = ${LAWS.THR}u; const VAL: u32 = ${LAWS.VAL}u;
const F_ORIENT: u32 = 1u; const F_REACT: u32 = 2u; const F_BOND: u32 = 4u;

fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn hash3(a: u32, b: u32, c: u32) -> u32 { return pcg(a ^ pcg(b ^ pcg(c))); }
/** uniform 0 <= u < 1 */
fn rnd(a: u32, b: u32, c: u32) -> f32 { return f32(hash3(a, b, c) >> 8u) * (1.0 / 16777216.0); }

fn wrapd(d: f32, L: f32) -> f32 {
  var v = d;
  if (v > 0.5 * L) { v -= L; } else if (v < -0.5 * L) { v += L; }
  return v;
}
fn cellCoords(p: vec3f) -> vec3u {
  return vec3u(min(u32(p.x / P.cellW), P.cols - 1u),
               min(u32(p.y / P.cellH), P.rows - 1u),
               min(u32(p.z / P.cellD), P.layers - 1u));
}
fn deg4(s: vec4i) -> u32 { return u32(s.x >= 0) + u32(s.y >= 0) + u32(s.z >= 0) + u32(s.w >= 0); }
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
  let c3 = cellCoords(st[i * 3u].xyz);
  let c = (c3.z * P.rows + c3.y) * P.cols + c3.x;
  let r = atomicAdd(&cellCount[c], 1u);
  cellInfo[i] = vec2u(c, r);
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
@group(0) @binding(2) var<storage, read> partner: array<vec4i>;
@group(0) @binding(3) var<storage, read> laws: array<f32>;
@group(0) @binding(4) var<storage, read> cellStart: array<u32>;
@group(0) @binding(5) var<storage, read> sorted: array<u32>;
@group(0) @binding(6) var<storage, read_write> acc: array<vec4f>;
@group(1) @binding(0) var<uniform> clock: Clock;

fn typeOf(j: u32) -> u32 { return bitcast<u32>(st[j * 3u + 1u].w); }

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let pi = st[i * 3u];
  let vi = st[i * 3u + 1u];
  let hi = st[i * 3u + 2u].xyz;
  let ti = bitcast<u32>(vi.w);
  let T = P.T;
  let R2 = P.R * P.R;
  let invR = 1.0 / P.R;
  let mySlots = partner[i];
  let orient = (P.flags & F_ORIENT) != 0u;
  let bonding = (P.flags & F_BOND) != 0u && deg4(mySlots) < u32(laws[TB + ti * TS + VAL]);
  let stepSalt = clock.step * 8u;

  var f = vec3f(0.0);
  var turn2 = 0.0;
  var turn3 = vec3f(0.0);
  var best = -1;
  var bestScore = 0u;

  // neighbour cells; fewer than 3 cells on an axis -> visit each cell once
  let c3 = vec3i(cellCoords(pi.xyz));
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
        let s1 = cellStart[nc + 1u];
        for (var b = cellStart[nc]; b < s1; b++) {
          let j = sorted[b];
          if (j == i) { continue; }
          let pj = st[j * 3u];
          let d = vec3f(wrapd(pj.x - pi.x, P.W), wrapd(pj.y - pi.y, P.H), wrapd(pj.z - pi.z, P.D));
          let d2 = dot(d, d);
          if (d2 >= R2 || d2 == 0.0) { continue; }
          let dist = sqrt(d2);
          let n = d / dist;
          let tj = typeOf(j);
          let pij = (ti * T + tj) * PS;
          var fij: f32;
          if (dist < P.coreR) {
            fij = P.coreK * (dist / P.coreR - 1.0);
          } else {
            let near = 1.0 - dist * invR;
            fij = laws[pij + AMP] * sin(laws[pij + KW] * dist + laws[pij + PH]) * P.forceScale * near;
            if (orient) {
              let ci = dot(hi, n);
              fij *= 1.0 + laws[pij + POL] * ci;
              let tq = laws[pij + TOR] * near;
              if (P.dim == 3u) {
                turn3 += tq * (n - ci * hi);
              } else {
                turn2 += tq * (hi.x * n.y - hi.y * n.x);
              }
            }
          }
          f += fij * n;

          if (bonding) {
            // every bond decision uses the pair seen from the lower index -> symmetric
            let lo = min(i, j); let hiI = max(i, j);
            let pp = (typeOf(lo) * T + typeOf(hiI)) * PS;
            let aff = laws[pp + AFF];
            if (aff > 0.0 && dist < laws[pp + BFORM]) {
              let sj = partner[j];
              let dv = st[j * 3u + 1u].xyz - vi.xyz;
              let act = laws[pp + ACT];
              let esum = select(pj.w + pi.w, pi.w + pj.w, i < j);
              let bonded = any(mySlots == vec4i(i32(j)));
              if (!bonded && deg4(sj) < u32(laws[TB + tj * TS + VAL]) && dot(dv, dv) <= laws[pp + BINDE]
                  && !(act > 0.0 && esum < act)
                  && rnd(lo, hiI, stepSalt + 2u) < aff * P.bondFormRate) {
                let score = hash3(lo, hiI, stepSalt + 1u);
                if (best < 0 || score > bestScore) { best = i32(j); bestScore = score; }
              }
            }
          }
        }
      }
    }
  }
  acc[i * 2u] = vec4f(f, turn2);
  acc[i * 2u + 1u] = vec4f(turn3, bitcast<f32>(best));
}
`;

    const UPDATE = /* wgsl */ `
@group(0) @binding(0) var<uniform> P: Params;
${COMMON}
@group(0) @binding(1) var<storage, read> st: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> out: array<vec4f>;
@group(0) @binding(3) var<storage, read> acc: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> partner: array<vec4i>;
@group(0) @binding(5) var<storage, read> laws: array<f32>;
@group(0) @binding(6) var<storage, read> light: array<f32>;
@group(0) @binding(7) var<storage, read_write> counters: array<atomic<u32>>;
@group(1) @binding(0) var<uniform> clock: Clock;

const CELL: f32 = 32.0;

fn lightAt(p: vec3f) -> f32 {
  let cx = min(u32(p.x / CELL), P.lcols - 1u);
  let cy = min(u32(p.y / CELL), P.lrows - 1u);
  let cz = min(u32(p.z / CELL), P.llayers - 1u);
  return light[(cz * P.lrows + cy) * P.lcols + cx];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let T = P.T;
  let s0 = st[i * 3u];
  let s1 = st[i * 3u + 1u];
  let s2 = st[i * 3u + 2u];
  var pos = s0.xyz;
  let e0 = s0.w;
  var e = e0;
  var vel = s1.xyz;
  var t = bitcast<u32>(s1.w);
  var F = acc[i * 2u].xyz;
  let turn2 = acc[i * 2u].w;
  let a2 = acc[i * 2u + 1u];
  let prop = bitcast<i32>(a2.w);
  let stepSalt = clock.step * 8u;
  var slots = partner[i];

  // ---- bonds: break, share energy, spring ----
  for (var s = 0u; s < 4u; s++) {
    let jj = slots[s];
    if (jj < 0) { continue; }
    let j = u32(jj);
    let pj = st[j * 3u];
    let d = vec3f(wrapd(pj.x - pos.x, P.W), wrapd(pj.y - pos.y, P.H), wrapd(pj.z - pos.z, P.D));
    var dist = length(d);
    if (dist == 0.0) { dist = 1e-6; }
    let lo = min(i, j); let hiI = max(i, j);
    let tj = bitcast<u32>(st[j * 3u + 1u].w);
    let pp = select(tj * T + t, t * T + tj, i < j) * PS;
    let elo = select(pj.w, e0, i < j); let ehi = select(e0, pj.w, i < j);
    let dec = laws[pp + DEC];
    if (dist > laws[pp + BBRK] || (dec > 0.0 && rnd(lo, hiI, stepSalt + 3u) < dec * (1.0 + elo + ehi))) {
      slots[s] = -1;
      e += laws[pp + ACT] * 0.5;
      if (i < j) { atomicAdd(&counters[1], 1u); }
      continue;
    }
    if (P.energyShare > 0.0) { e += (pj.w - e0) * P.energyShare * 0.5; }
    let n = d / dist;
    let along = dot(st[j * 3u + 1u].xyz - vel, n);
    F += (laws[pp + BK] * (dist - laws[pp + BLEN]) + 0.15 * along) * n;
  }

  // ---- new bond: both photons proposed each other ----
  if (prop >= 0) {
    let j = u32(prop);
    if (bitcast<i32>(acc[j * 2u + 1u].w) == i32(i)) {
      let tj = bitcast<u32>(st[j * 3u + 1u].w);
      let pp = select(tj * T + t, t * T + tj, i < j) * PS;
      let act = laws[pp + ACT];
      if (act > 0.0) {
        let ej = st[j * 3u].w;
        let esum = select(ej + e0, e0 + ej, i < j);
        e -= e0 * act / esum;
      }
      if (slots.x < 0) { slots.x = i32(j); }
      else if (slots.y < 0) { slots.y = i32(j); }
      else if (slots.z < 0) { slots.z = i32(j); }
      else { slots.w = i32(j); }
      if (i < j) { atomicAdd(&counters[0], 1u); }
    }
  }
  e = min(e, 1.0);
  partner[i] = slots;

  // ---- reactions (only when the new type still has room for all bonds) ----
  if ((P.flags & F_REACT) != 0u && P.reactionRate > 0.0) {
    let deg = deg4(slots);
    for (var s = 0u; s < 4u; s++) {
      let jj = slots[s];
      if (jj < 0) { continue; }
      let p = (t * T + bitcast<u32>(st[u32(jj) * 3u + 1u].w)) * PS;
      let to = i32(laws[p + RXTO]);
      if (to < 0 || e < laws[p + RXTHR]) { continue; }
      if (rnd(i, stepSalt + 4u, s) >= P.reactionRate) { continue; }
      if (deg > u32(laws[TB + u32(to) * TS + VAL])) { continue; }
      e -= laws[p + RXTHR];
      t = u32(to);
      atomicAdd(&counters[2], 1u);
      break;
    }
  }

  // ---- integrate ----
  let tb = TB + t * TS;
  let ab = laws[tb + ABSO];
  if (ab > 0.0) { e += ab * lightAt(pos); }
  e -= laws[tb + LEAK] * e;
  var a = F * laws[tb + IM];

  var h = s2;
  if ((P.flags & F_ORIENT) != 0u) {
    if (P.dim == 3u) {
      var hv = s2.xyz + a2.xyz + (vec3f(rnd(i, stepSalt + 5u, 0u), rnd(i, stepSalt + 5u, 1u), rnd(i, stepSalt + 5u, 2u)) - 0.5) * P.spin;
      var len = length(hv);
      if (len == 0.0) { len = 1.0; }
      h = vec4f(hv / len, 0.0);
    } else {
      h.w = s2.w + turn2 + (rnd(i, stepSalt + 5u, 0u) - 0.5) * P.spin;
    }
  }
  if (P.dim != 3u) { h = vec4f(cos(h.w), sin(h.w), 0.0, h.w); }

  let th = laws[tb + THR];
  if (th > 0.0 && e > 0.05) {
    let push = th * e;
    a += h.xyz * push;
    e -= push * 0.5;
  }
  e = clamp(e, 0.0, 1.0);

  var u = (vel + a) * (1.0 - P.friction);
  if (P.temperature > 0.0) {
    var nz = vec3f(rnd(i, stepSalt + 6u, 0u), rnd(i, stepSalt + 6u, 1u), rnd(i, stepSalt + 6u, 2u)) - 0.5;
    if (P.dim != 3u) { nz.z = 0.0; }
    u += nz * P.temperature;
  }
  let v2 = dot(u, u);
  if (v2 > P.maxSpeed * P.maxSpeed) { u *= P.maxSpeed / sqrt(v2); }

  var q = pos + u;
  if (q.x < 0.0) { q.x += P.W; } else if (q.x >= P.W) { q.x -= P.W; }
  if (q.y < 0.0) { q.y += P.H; } else if (q.y >= P.H) { q.y -= P.H; }
  if (P.dim == 3u) {
    if (q.z < 0.0) { q.z += P.D; } else if (q.z >= P.D) { q.z -= P.D; }
  } else {
    q.z = 0.0;
  }
  // float rounding can land exactly on the far edge
  q = min(q, vec3f(P.W, P.H, max(P.D, 1.0)) - vec3f(0.001));
  q = max(q, vec3f(0.0));

  out[i * 3u] = vec4f(q, e);
  out[i * 3u + 1u] = vec4f(u, bitcast<f32>(t));
  out[i * 3u + 2u] = h;
}
`;

    EM.gpuKernels = { LAWS, COUNT, SCAN, SCATTER, PAIRS, UPDATE };
})(EM);
