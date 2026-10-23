# Petrie Dish

Run -> https://michalstankiewicz4-cell.github.io/PetrieDish/

**New:** [Emergence](https://michalstankiewicz4-cell.github.io/PetrieDish/emergence/) – photons → molecules → membranes, laws found by an ML lab (folder `emergence/`, separate versioning).

That's one of my first projects with vibecoding: it visualizes the physical and chemical relationships between particles in fluid.
Just run it and have fun. Feel free to use.

<img width="1916" height="944" alt="image" src="https://github.com/user-attachments/assets/5243612c-ebdc-418a-b24e-13eb4f4b31ca" />

<img width="1919" height="946" alt="image" src="https://github.com/user-attachments/assets/83adec1c-2dde-45bc-ac85-9283787daa48" />

<img width="1919" height="942" alt="image" src="https://github.com/user-attachments/assets/755e9d64-c894-4d2d-a32f-ddb9820a751d" />

## Documentation

| | |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | every button, slider and mechanic |
| [Architecture](docs/ARCHITECTURE.md) | files, frame pipeline, state, how to extend |
| [Mechanics](docs/MECHANICS.md) | exact formulas |
| [Known issues](docs/KNOWN_ISSUES.md) | open problems and design decisions (KI-xx) |
| [Context](CONTEXT.md) | current state + working rules (read first) |
| [Changelog](CHANGELOG.md) | versions (SemVer); current version is shown in the browser tab |

## Running locally

No build step and no server needed: open `index.html` in a browser (double click works).
All scripts are plain `<script defer>` files, so it also works from `file://`.

## Project structure

```
index.html              markup only (panels, modals, HUD) + list of CSS/JS files
css/
  base/                 design tokens, reset
  layout/               HUD/overlay buttons, side panels, panel content
  components/           sliders, buttons, legend, mechanics, modals, life scanner, VFX
  overrides/compact.css compact menu mode - loaded last on purpose
js/
  core/                 config (constants), math, spatial grid, state (PD.sim)
  sim/                  particles, mechanics, bonds, life detection, seeds, world step
  render/               canvas drawing, VFX state, HUD
  app/                  animation loop, controller (start/stop/reset/samples/resize)
  ui/                   one file per panel / widget
  main.js               bootstrap
docs/                   USER_GUIDE, ARCHITECTURE, MECHANICS, KNOWN_ISSUES (Polish)
tools/regression.py     deterministic regression test (see below)
CONTEXT.md              start here when resuming work (state, rules, versioning)
CHANGELOG.md            version history
```

Everything lives under one global namespace, `window.PD`:

| Object          | What it is                                                     |
| --------------- | -------------------------------------------------------------- |
| `PD.config`     | constants: default colours, named samples, limits, storage keys |
| `PD.sim`        | the whole mutable simulation state (parameters, particles, ...) |
| `PD.world`      | spawn / step / per-frame bookkeeping (no DOM)                   |
| `PD.loop`       | `requestAnimationFrame` loop, FPS counters                      |
| `PD.controller` | actions used by the UI: play, pause, reset, loadSeed, ...      |
| `PD.render`, `PD.vfx`, `PD.hud` | drawing                                         |
| `PD.ui.*`       | panels and widgets                                              |

Open the browser console and type `PD.sim` to inspect the live state, or `PD.setDebug(true)` for logs.

## Regression test

`tools/regression.py` runs 16 scenarios (samples, all mechanics, bonds, life scanner, intelligent
particles, VFX, donate...) with a seeded `Math.random` and compares the final particle state and the
canvas image. Use it before/after a refactor to prove the simulation did not change.

```
py -m pip install playwright
py -m playwright install chromium
py tools/regression.py run index.html before.json
# ... change code ...
py tools/regression.py run index.html after.json
py tools/regression.py compare before.json after.json
```
