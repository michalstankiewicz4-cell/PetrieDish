# Emergence

Run → https://michalstankiewicz4-cell.github.io/PetrieDish/emergence/

A 2D or 3D world of simple "photons" with seeded physical laws: ring-shaped attraction
and repulsion, orientation, bonds that cost energy, light as an energy source,
reactions that change photon types. Nothing above the photon level is
programmed – molecules, membranes and (one day) cells have to emerge. The
**Lab** searches the space of laws for worlds where something new and lasting
appears; it only picks laws, it never touches a running world.

## Use

- **World panel** (left): new / mutated laws, **Space 2D / 3D**, photon count, restart, speed, view options.
- **Observe panel** (right): metrics, history chart, the catalogue of stable structures
  (click to highlight), and the **Lab** (start the search, then *Load* a result).
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
