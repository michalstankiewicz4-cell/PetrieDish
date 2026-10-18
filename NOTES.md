# NOTES – Petrie Dish (dla dewelopera i dla AI)

Krótki opis architektury, konwencji i znanych problemów. Nowy czat o tym projekcie
zaczynaj od „przeczytaj NOTES.md”, a po większych zmianach aktualizuj ten plik.

## Jak to działa w jednym akapicie

`PD.loop.frame()` co klatkę: czyści canvas kolorem tła VFX → `PD.world.advance()`
wykonuje 0–2 kroków fizyki (akumulator `sim.timescale`, czyli „FPS Booster”) →
`PD.render.drawWorld()` rysuje wiązania, cząstki i ramki Life Scannera →
`PD.world.afterFrame()` (usuwanie martwych w trybie *endless*, Mass Hierarchy) →
HUD i nakładki VFX. Jeden krok fizyki (`PD.world.step()`): przebudowa siatki
przestrzennej → `particle.update()` dla każdej cząstki → siły „donate” → wiązania →
Life Scanner.

## Zasady

- **Stan w jednym miejscu**: wszystko, co zmienia symulację, siedzi w `PD.sim`
  (`js/core/state.js`). UI tylko zapisuje do `PD.sim` i czyta z niego; fizyka nie
  dotyka DOM.
- **Kolejność skryptów = kolejność zależności** (lista w `index.html`). Plik może
  używać na górnym poziomie tylko tego, co załadowano wcześniej; w funkcjach można
  używać wszystkiego.
- **Bez bundlera**: zwykłe `<script defer>`, każdy plik to IIFE dopisujące swoje API
  do `window.PD`. Działa z `file://` i na GitHub Pages.
- **Cache na cząstce**: `_name, _mass, _range, _rangeSq, _charge, _vorticness` są
  kopiami pól `colorData` dla szybkości. Po zmianie `colorData` → `p.syncCache()`.
- **`colorData` jest współdzielone** przez wszystkie cząstki danego gatunku (wskazuje
  na obiekt w `sim.colors`). Mieszanie kolorów (`mixColor`) daje cząstce własną kopię.
- **Seedy są święte**: kolejność wywołań `rng` w `js/sim/seed.js` definiuje wygląd
  każdej próbki. Nowe losowane właściwości dopisuj tylko na końcu.
- `Math.random` jest używany w fizyce (mieszanie kolorów), w spawnie i w UI – test
  regresji podmienia go na deterministyczny generator.

## Jak dodać nową mechanikę

1. Flaga w `PD.sim.enabled` + parametry w `PD.sim` (`js/core/state.js`).
2. Checkbox + blok opcji w `index.html` (prawy panel, `.legend-item`).
3. Wpis w `MECHANICS` i suwaki w `SLIDERS` w `js/ui/mechanics-panel.js`.
4. Fizyka: w `Particle.update()` (siły parami) albo osobny moduł w `js/sim/`
   wywoływany z `PD.world.step()`.
5. `py tools/regression.py run/compare` – przy wyłączonej nowej mechanice wynik
   musi być identyczny jak przed zmianą.

## Znane problemy / decyzje do podjęcia

- Generator seedów losuje też `boundaryMode` i `speed`, ale loader zawsze ustawia
  `warp` i 100% (celowo – *endless* potrafi wyczyścić ekran). Losowań nie usuwamy,
  bo zmieniłoby to wygląd każdego istniejącego numeru próbki.
- Spatial grid ma stały rozmiar komórki 150 px – zasięg interakcji > 150 px działa
  (sprawdzane są dalsze komórki), ale wolniej.
- Lista nazwanych próbek (`PD.config.SAMPLES`) jest pusta – do zrobienia nowa.
  Format: `{ seed: 42, name: 'Nazwa' }`, dropdown buduje się z niej sam.

## Pomysły na ML (z rozmowy)

- Automatyczne szukanie „ciekawych” seedów/parametrów (CMA-ES / novelty search),
  symulacja bez renderowania w Web Workerze – `PD.world.step()` jest już niezależny
  od DOM.
- Neural Cellular Automata / ocena klatek przez CLIP (transformers.js).

## Historia

- v3.1.0 – naprawione: tryb „Mass Gradient” (fizyka zgodna z kolorem), cache
  inteligentnych cząstek (neutralne w macierzy zamiast crasha), suwak Hierarchy
  Strength działa, wiązania i Life Scanner liczą odległość przez krawędź w trybie
  *warp*, domyślne położenia suwaków zgodne ze stanem (liczba cząstek 1000, Transfer
  Rate, FPS Booster), Reset po trybie *endless* odtwarza pełną liczbę cząstek,
  „Donate” wyłącza się przy każdym przebudowaniu świata. Usunięta stara lista
  nazwanych próbek.
- v3.0.0 – podział jednego `index.html` (6600 linii) na `css/` i `js/`; poprawki:
  crash po zwiększeniu liczby gatunków ponad próbkę, mnożenie pętli animacji przy
  Reset/Random, edytor zasięgu, siatka po zmianie rozmiaru okna.
- v2.22.0 – ostatnia wersja jednoplikowa (Life Scanner z zakresami).
