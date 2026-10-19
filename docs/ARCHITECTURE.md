# Architektura – Petrie Dish

Dokument techniczny dla dewelopera. Fizyka mechanik (wzory) jest w
[`MECHANICS.md`](MECHANICS.md), znane problemy w [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md).

## 1. Zasady ogólne

- **Bez kroku budowania.** Zwykłe `<script defer>` w `index.html`; działa z `file://`
  i z GitHub Pages. Nie używamy ES modules (`import`), bo blokują `file://`.
- **Jeden namespace:** każdy plik JS to IIFE `(function (PD) { ... })(window.PD)`,
  które dopisuje swoje API do `window.PD`. W plikach obowiązuje `'use strict'`.
- **Kolejność skryptów = kolejność zależności.** Na górnym poziomie pliku wolno
  używać tylko tego, co załadowano wcześniej; wewnątrz funkcji – wszystkiego.
- **Kolejność CSS = kaskada.** `overrides/compact.css` musi być ostatni.
- **Stan w jednym miejscu:** `PD.sim` (`js/core/state.js`). UI zapisuje do stanu,
  fizyka nie dotyka DOM, renderer tylko czyta.

## 2. Struktura plików

```
index.html                  znaczniki: panele, modale, HUD, lista CSS/JS
css/base/                   variables.css (tokeny), reset.css
css/layout/                 overlay.css (HUD, przyciski, hamburgery), side-panels.css, panel-content.css
css/components/             inputs, controls, legend, mechanics, modals, life-scanner, vfx
css/overrides/compact.css   tryb kompaktowy (!important) – ładowany ostatni
js/core/config.js           PD (namespace), PD.VERSION, PD.config, PD.log
js/core/math.js             torusDelta, delta, clamp, SeededRandom
js/core/spatial-grid.js     PD.SpatialGrid – siatka do szukania sąsiadów
js/sim/seed.js              PD.seed – seed → ustawienia, kolory, macierz
js/core/state.js            PD.sim (stan symulacji), PD.ui (flagi wyświetlania)
js/sim/particle.js          PD.Particle – siły, ruch, granice, mieszanie
js/sim/intelligent-particle.js  PD.IntelligentParticle
js/sim/bonds.js             PD.bonds – wiązania molekularne
js/sim/life-detection.js    PD.life – Life Scanner (BFS)
js/sim/donate.js            PD.donate – napis z cząstek
js/sim/world.js             PD.world – spawn, krok fizyki, per-frame
js/render/vfx.js            PD.vfx – stan efektów wizualnych
js/render/renderer.js       PD.render – rysowanie
js/render/hud.js            PD.hud – liczniki DOM
js/app/loop.js              PD.loop – requestAnimationFrame, FPS
js/app/controller.js        PD.controller – akcje: play/pause/reset/seed/size
js/ui/dom.js                PD.dom – helpery: bindSlider, bindRangePair, modal
js/ui/storage.js            PD.storage – localStorage
js/ui/panels.js             panele boczne (hamburgery, Lock)
js/ui/settings-panel.js     lewy panel
js/ui/mechanics-panel.js    prawy panel – tabele MECHANICS i SLIDERS
js/ui/color-editors.js      okna per kolor, macierz, właściwości kolorów
js/ui/life-scanner.js       panel Life Scanner
js/ui/vfx-panel.js          panel VFX
js/ui/canvas-input.js       mysz na planszy
js/ui/auto-hide.js          chowanie przycisków
js/main.js                  start aplikacji
tools/regression.py         deterministyczny test regresji
```

## 3. Przepływ klatki

```
PD.loop.frame()                                     (requestAnimationFrame)
├─ PD.render.beginFrame        czyści canvas kolorem tła VFX (alfa < 1 = smugi)
├─ jeśli running && speed > 0:
│   ├─ PD.world.advance        akumulator += timescale; wykonuje 0–2 kroki:
│   │    └─ PD.world.step
│   │         ├─ grid.rebuild
│   │         ├─ particle.update()  ×N   (mysz, rój, siły parami, ruch, granice)
│   │         ├─ PD.donate.applyForces
│   │         ├─ PD.bonds.detectAndCreate + applyConstraints
│   │         └─ PD.life.detect           (co 3. krok)
│   ├─ PD.render.drawWorld      wiązania → cząstki (biały, czarny, reszta) → ramki życia
│   └─ PD.world.afterFrame      Endless: usuwa martwe · Mass Hierarchy
├─ jeśli running && speed == 0: PD.render.drawFrozen
├─ PD.hud.update, PD.bonds.endFrame, PD.render.endFrame (nakładka VFX, kursor myszy)
└─ PD.hud.updateCounters, następna klatka jeśli running
```

`PD.loop.start()` zawsze anuluje oczekującą klatkę – istnieje dokładnie jedna pętla.

## 4. Stan – `PD.sim`

| Pole | Typ / zakres | Opis |
| --- | --- | --- |
| `width`, `height` | px | rozmiar świata = canvasu |
| `particles` | Particle[] | wszystkie cząstki (też inteligentne) |
| `grid` | SpatialGrid | przebudowywana co krok |
| `particleCount`, `speciesCount` | int | ustawienia dla następnego spawnu |
| `seed` | int \| null | wczytana próbka (null = Default) |
| `initMode` | random / bigbang / gradient | rozmieszczenie przy spawnie |
| `boundaryMode` | warp / wall / endless | krawędzie |
| `colors` | 15 obiektów `{hex,name,charge,mass,interactionRange,vorticness,initialSpeed}` | gatunki; pierwsze `speciesCount` są aktywne |
| `matrix` | `matrix[from][to]` ∈ [−1, 1] | oddziaływania kolorów |
| `speed`, `speedBeforePause` | 0–2 | mnożnik kroku ruchu |
| `timescale`, `physicsAccumulator` | 0.001–1 | FPS Booster |
| `viscosity` | 0.90–0.99 | mnożnik prędkości co krok |
| `vorticness` | 0–0.05 | globalna siła wiru |
| `attractionStrength`, `chargeForce`, `massEffect`, `hierarchyStrength` | 0–2 | mnożniki |
| `blendRate` | 0–0.1 | szybkość mieszania kolorów |
| `swarmStrength`, `swarmRange` | 0–0.1, 50–200 px | rój |
| `transferRate` | 0–0.01 | wymiana masy |
| `enabled.*` | bool | włączone mechaniki |
| `mouse` | `{pressed,x,y}` | przyciąganie myszą |
| `intelligent` | `{futureFrames, showGhost, list, nextColor}` | |
| `bonds` | `{formationTime, maxDistance, maxPerParticle, length, candidates, active}` | |
| `life` | `{particles, colors, distance, speedDiff: {from,to}, forms}` | Life Scanner |
| `donate` | `{active, targets}` | |

### Cząstka (`PD.Particle`)
`id, x, y, vx, vy, radius, alpha, dead, bonds[], bondSlots[], species, colorData` oraz cache:
`_name, _mass, _range, _rangeSq, _charge, _vorticness`.
- `species` – obiekt gatunku w `sim.colors`; nigdy się nie zmienia. Edytory per kolor
  szukają cząstek po `p.species`.
- `colorData` – to, co się rysuje; ten sam obiekt co `species`, dopóki mieszanie kolorów
  nie da cząstce kopii z innym `hex`.
- `_mass` – własna masa cząstki. Symulacja (transfer, hierarchia, ściany) zmienia tylko
  `_mass`, nigdy `species.mass` – tę zmieniają wyłącznie seed i edytor Mass.
- Po zmianie gatunku wywołaj `p.syncCache()`. Kolory zawsze jako `#rrggbb`
  (mieszanie je parsuje) – do HSL jest `PD.math.hslToHex`.

## 5. API dla UI – `PD.controller`

`play()`, `pause()`, `toggleRunning()`, `reset()`, `rebuildWorld()`, `randomize()`,
`quickRandom()`, `applySeed(n)` (bez spawnu), `loadSeed(n)` (ze spawnem),
`applySize()`, `fitToWindow()`, `setSpeed(percent)`, `toggleDonate()`,
`updateButtonState()`.

Konsola przeglądarki: `PD.sim` (podgląd stanu), `PD.setDebug(true)` (logi),
`PD.controller.loadSeed(42)`.

## 6. Jak dodać…

### …nową mechanikę
1. `js/core/state.js`: flaga w `enabled` + parametry.
2. `index.html`: `.legend-item` z checkboxem `xxxCheckbox` i blokiem `xxxOptions` (prawy panel).
3. `js/ui/mechanics-panel.js`: wpis w `MECHANICS` i suwaki w `SLIDERS`.
4. Fizyka: siła parami → `Particle.update()`; osobny proces → nowy plik w `js/sim/`,
   wywołany z `PD.world.step()`; dodaj `<script>` w `index.html` przed `world.js`.
5. Jeśli seed ma ją losować – dopisz **na końcu** `generate()` w `seed.js`.
6. Opis w `docs/USER_GUIDE.md` i `docs/MECHANICS.md`, wpis w `CHANGELOG.md`.

### …suwak do istniejącej mechaniki
Jeden wpis w `SLIDERS` (`id`, `out`, `format`, `apply`) + znaczniki w `index.html`.
Wartość startowa w HTML musi dawać tę samą wartość co domyślna w `state.js`.

### …nazwaną próbkę
`js/core/config.js` → `SAMPLES.push({ seed: 123, name: 'Nazwa' })`. Lista rozwijana
buduje się sama.

### …efekt VFX
Przycisk `.vfx-effect-btn` z `data-effect` / `data-value` w `index.html`,
obsługa w `js/render/renderer.js` (`drawParticle` lub `drawVfxOverlay`).

## 7. Determinizm i seedy

- `SeededRandom` (LCG 9301/49297/233280) – stałych **nie zmieniać**.
- Kolejność wywołań `rng` w `PD.seed.generate()` definiuje wygląd każdego numeru.
  Nowe losowane rzeczy tylko na końcu, inaczej zmienią się wszystkie próbki.
- Fizyka i spawn używają `Math.random` (mieszanie kolorów, pozycje startowe) –
  ten sam seed daje te same *ustawienia*, ale nie identyczny przebieg.

## 8. Testy

`tools/regression.py` – 16 scenariuszy uruchamianych bez okna, z podmienionym
`Math.random`, `requestAnimationFrame` i `performance.now`. Porównuje końcowy stan
cząstek i obraz canvasu. Instrukcja w `README.md`. Zasada: refaktor = wynik
identyczny; zmiana fizyki = świadoma różnica opisana w `CHANGELOG.md`.
