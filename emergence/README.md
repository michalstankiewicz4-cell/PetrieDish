# Emergence

Run → https://michalstankiewicz4-cell.github.io/PetrieDish/emergence/

A 3D (or 2D) world of identical "photons" – same radius, different charge and energy –
with seeded physical laws: a hard boundary set by the pressure, a short saturating strong
interaction (bonds; hot photons hold fewer), the electromagnetic wave from Gravitation and
light as the energy source. The previous model (photon types, orientation, reactions) lives
on at [v0.6/](https://michalstankiewicz4-cell.github.io/PetrieDish/emergence/v0.6/). Nothing above the photon level is
programmed – molecules, membranes and (one day) cells have to emerge. The
**Lab** searches the space of laws for worlds where something new and lasting
appears; it only picks laws, it never touches a running world.

## Use

- **Top bar** – main menu: World / Observe panels, Elements, Machine learning,
  play, fast forward, new laws, 2D/3D, CPU/GPU, live stats, Help (keys and links).
- **Photon editor** (top bar → Photon, or E): every law as a slider – most act live –
  with a picture of the photon and the force curves.
- **World panel** (left): new / mutated laws, **Pressure** (live), Space 3D / 2D, photon count,
  restart, speed, view options (*Free bonds on photons*: a number on every ball, zoom in to see it).
- **Observe panel** (right): metrics, history chart, the catalogue of stable structures
  (click to highlight), and the **Lab** (start the search, then *Load* a result).
- **Tab** (or the *Elements & ML* button): periodic table of the elements this universe has
  formed (Z = photons in a stable structure) and a live view of the machine learning.
- **Fast forward** (Time panel or T): computes without drawing until you press Stop.
- 2D: wheel = zoom, drag = move. 3D: drag = rotate, right-drag = move, wheel = zoom.
  Click = inspect a photon, Space = pause, F = fit, N = new laws, M = mutate, 3 = switch 2D/3D.
- 3D needs WebGL2 (any current browser) and runs ~2000 photons smoothly on a CPU.
- **Compute: GPU** (or key G) runs the physics with WebGPU (Chrome, Edge; Firefox/Safari
  newer versions) – up to 200 000 photons. Same laws, but not bit-exact like the CPU.
  Check: `tools/gpu-check.html` on a local server.
- The address bar keeps the laws seed – copy it to share a world.
- Opened as a file (double click) everything works, but the Lab runs in the page
  instead of Web Workers (slower). On GitHub Pages or any local server it uses workers.

## Docs (Polish)

| | |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | state, working rules, versioning – read first |
| [docs/PLAN.md](docs/PLAN.md) | goals, principles, milestones M0–M6, architecture |
| [docs/PHYSICS.md](docs/PHYSICS.md) | every formula and parameter range |
| [CHANGELOG.md](CHANGELOG.md) | versions |

## Test

```
node tools/smoke.js
```
