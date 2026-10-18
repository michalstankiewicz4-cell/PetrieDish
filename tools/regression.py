"""Deterministic regression test for Petrie Dish.

Runs a fixed set of scenarios headlessly (seeded Math.random, frames stepped
manually), drives the app through its UI (DOM ids), and stores the final
particle state + a canvas hash. Compare two runs to prove that a refactor did
not change the simulation.

Setup (once):
    py -m pip install playwright
    py -m playwright install chromium

Usage:
    py tools/regression.py run index.html before.json      # on the old version
    py tools/regression.py run index.html after.json       # after your change
    py tools/regression.py compare before.json after.json

Tip: to get the "before" version without stashing, use a second checkout:
    git worktree add ../PetrieDish-main main
"""
import hashlib, json, os, sys
from playwright.sync_api import sync_playwright

INIT = r"""
(() => {
  let s = 12345 >>> 0;
  function mulberry() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  Math.random = mulberry;
  window.__rngReset = (seed) => { s = seed >>> 0; };
  let rafId = 0;
  window.requestAnimationFrame = () => ++rafId;
  window.cancelAnimationFrame = () => {};
  let t = 0;
  performance.now = () => (t += 16.6667);
  window.alert = (m) => { window.__alerts = (window.__alerts || []).concat([m]); };
  console.log = () => {};
})();
"""

# How the test reaches into the app. Change here if the internal API moves.
API = {"frame": "PD.loop.frame()", "particles": "PD.sim.particles", "bonds": "PD.sim.bonds.active", "life": "PD.sim.life.forms"}

SCENARIOS = [
    {"name": "seed42", "seed": 42, "frames": 150},
    {"name": "swarms", "seed": 882183331, "frames": 150},
    {"name": "vortex", "seed": 387363571, "frames": 150},
    {"name": "medusa", "seed": 204301394, "frames": 120},
    {"name": "random_seed", "seed": 555123987, "frames": 120},
    {"name": "all_mech_wall", "seed": 42, "frames": 160,
     "checks": {"chargesCheckbox": True, "mixingCheckbox": True, "vortexCheckbox": True, "swarmCheckbox": True,
                "massTransferCheckbox": True, "massHierarchyCheckbox": True, "initialSpeedCheckbox": True},
     "selects": {"boundaryModeSelect": "wall", "initModeSelect": "bigbang"},
     "sliders": {"densityInput": 600, "speciesInput": 9, "blendRate": 80, "transferRate": 60, "swarmStrength": 70,
                 "swarmRange": 150, "vorticnessSlider": 90, "chargeForce": 150, "attractionStrength": 140,
                 "massEffect": 120, "viscosityInput": 95}},
    {"name": "endless_gradient", "seed": 99141546, "frames": 150,
     "selects": {"boundaryModeSelect": "endless", "initModeSelect": "gradient"}},
    {"name": "bonds_life", "seed": 820390980, "frames": 200,
     "checks": {"bondsCheckbox": True},
     "sliders": {"bondFormationTime": 1, "bondMaxDistance": 25, "bondLength": 8, "bondMaxBonds": 4,
                 "lifeMinParticlesFrom": 3, "lifeMinParticlesTo": 60, "lifeMaxDistanceFrom": 5, "lifeMaxDistanceTo": 40,
                 "lifeMinColorsFrom": 1, "lifeMaxSpeedDiffFrom": 1, "lifeMaxSpeedDiffTo": 10},
     "scanner": True},
    {"name": "intelligent", "seed": 42, "frames": 120,
     "checks": {"intelligentCheckbox": True}, "sliders": {"futureFramesInput": 15},
     "rightclicks": [[300, 200], [640, 360], [900, 500]]},
    {"name": "vfx_star_trails", "seed": 143757039, "frames": 80,
     "vfx": [["style", "star"], ["trail", "long"], ["overlay", "vignette"], ["bg", "matrix"]]},
    {"name": "vfx_glow_scan", "seed": 377343605, "frames": 80,
     "vfx": [["style", "glow"], ["overlay", "scanlines"], ["trail", "normal"]]},
    {"name": "vfx_ring_rainbow", "seed": 69129389, "frames": 80,
     "vfx": [["style", "ring"], ["overlay", "rainbow"], ["filter", "sepia"]]},
    {"name": "slowdown", "seed": 42, "frames": 120, "sliders": {"timescaleInput": 70}},
    {"name": "speed_mouse", "seed": 18731596, "frames": 120, "sliders": {"speedInput": 170}, "mouse": [500, 300]},
    {"name": "donate", "seed": 42, "frames": 100, "donate": True},
    {"name": "matrix_edit", "seed": 42, "frames": 100, "matrix": "gradientMatrixBtn",
     "buttons": ["massGradientBtn", "chargeGradientBtn", "speedGradientBtn"]},
]

SCENARIO_JS = r"""
(args) => {
  const [sc, A] = args;
  const $ = (id) => document.getElementById(id);
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  __rngReset(1000 + sc.seed % 9973);
  $('seedInput').value = String(sc.seed);
  $('loadSeedBtn').click();
  for (const [id, v] of Object.entries(sc.checks || {})) {
    const el = $(id); if (el.checked !== v) { el.checked = v; fire(el, 'change'); }
  }
  for (const [id, v] of Object.entries(sc.selects || {})) { const el = $(id); el.value = v; fire(el, 'change'); }
  for (const [id, v] of Object.entries(sc.sliders || {})) { const el = $(id); el.value = String(v); fire(el, 'input'); }
  if (sc.scanner) $('scannerToggle').click();
  for (const [eff, val] of (sc.vfx || [])) document.querySelector(`.vfx-effect-btn[data-effect="${eff}"][data-value="${val}"]`).click();
  __rngReset(77 + sc.seed % 1013);
  $('resetBtn').click();
  if (sc.matrix) $(sc.matrix).click();
  for (const b of (sc.buttons || [])) $(b).click();
  $('startStopBtn').click();
  const canvas = $('canvas');
  for (const [x, y] of (sc.rightclicks || [])) {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, clientX: x, clientY: y, bubbles: true }));
  }
  if (sc.mouse) canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: sc.mouse[0], clientY: sc.mouse[1], bubbles: true }));
  if (sc.donate) $('donateBtn').click();
  const frame = new Function(A.frame);
  for (let i = 0; i < sc.frames; i++) frame();
  const ps = (new Function('return ' + A.particles))();
  const r = (v) => Math.round(v * 1e6) / 1e6;
  return {
    n: ps.length,
    particles: ps.map(p => [r(p.x), r(p.y), r(p.vx), r(p.vy), r(p._mass), p.colorData.hex, p._name]),
    bonds: (new Function('return ' + A.bonds))().length,
    life: (new Function('return ' + A.life))().length,
    canvas: canvas.toDataURL(),
    hud: $('hudFpsText').textContent + ' / ' + $('hudSeed').textContent,
    alerts: window.__alerts || [],
  };
}
"""


def run(path, out, only=None):
    path = os.path.abspath(path)
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for sc in SCENARIOS:
            if only and sc["name"] not in only:
                continue
            ctx = browser.new_context(viewport={"width": 1280, "height": 720})
            ctx.route("**/fonts.g*/**", lambda r: r.abort())  # offline + deterministic text
            ctx.add_init_script(INIT)
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto("file:///" + path.replace(os.sep, "/").lstrip("/"))
            page.wait_for_timeout(300)
            res = page.evaluate(SCENARIO_JS, [sc, API])
            res["canvas"] = hashlib.sha1(res["canvas"].encode()).hexdigest()
            res["errors"] = errors
            results[sc["name"]] = res
            print(f'{sc["name"]:<18} n={res["n"]:<5} bonds={res["bonds"]:<4} life={res["life"]:<3} errors={len(errors)}')
            ctx.close()
        browser.close()
    with open(out, "w") as f:
        json.dump(results, f)


def compare(a_path, b_path):
    a, b = json.load(open(a_path)), json.load(open(b_path))
    failed = 0
    for name in a:
        if name not in b:
            print(f"{name:<18} MISSING")
            failed += 1
            continue
        same_p = a[name]["particles"] == b[name]["particles"]
        same_c = a[name]["canvas"] == b[name]["canvas"]
        ok = same_p and same_c and not b[name]["errors"]
        failed += not ok
        detail = "" if ok else f'  particles={"same" if same_p else "DIFF"} canvas={"same" if same_c else "DIFF"} errors={b[name]["errors"][:1]}'
        print(f"{name:<18} {'OK' if ok else 'CHANGED'}{detail}")
    print(f"\n{len(a) - failed}/{len(a)} identical")
    return failed


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "run":
        run(sys.argv[2], sys.argv[3], sys.argv[4].split(",") if len(sys.argv) > 4 else None)
    elif len(sys.argv) == 4 and sys.argv[1] == "compare":
        sys.exit(1 if compare(sys.argv[2], sys.argv[3]) else 0)
    else:
        print(__doc__)
