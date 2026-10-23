# CONTEXT – Emergence – START TUTAJ

> Plik do wznowienia pracy po utracie kontekstu. Przeczytaj w całości przed
> zmianą; na koniec sesji zaktualizuj **Stan** i **Historię sesji**.

## Projekt w skrócie

- **Co:** świat 2D, w którym z „fotonów” mają same wyłaniać się atomy → molekuły →
  błony/komórki → organizmy. Nic z tych poziomów nie jest zaprogramowane;
  uczenie maszynowe (Lab) szuka **praw fizyki**, przy których to się dzieje.
- **Gdzie:** folder `emergence/` w repo https://github.com/michalstankiewicz4-cell/PetrieDish
  (gałąź `main`). Strona: https://michalstankiewicz4-cell.github.io/PetrieDish/emergence/
- **Inspiracje w kodzie:** siła z pierścieniami i katalog jak „Elements” z Gravitation,
  pole światła jak siatka substancji z CellsEvolution, struktura/wersjonowanie z PetrieDish.
- **Technologia:** czysty JS, bez bundlera, `<script defer>`, namespace `EM`
  (`globalThis.EM` – ten sam kod działa w Web Workerze i w Node).
- Język UI: angielski; dokumentacja i rozmowa: polski.

## Stan

- **Wersja:** 0.3.0 (2026-10-23) – etap **M0** gotowy w 2D i 3D (CPU i GPU), detektory **M1/M2** gotowe.
- **Działa:** genom praw z ziarna, ~6 tys. fotonów w czasie rzeczywistym, siła z
  pierścieniami, orientacja, wiązania z energią aktywacji, światło, reakcje, napęd,
  katalog struktur (odcisk Weisfeiler-Lehman), detektor zamknięć, Lab (novelty search
  w workerach; z `file://` liczy w stronie), eksport/import praw, link z ziarnem.
  **3D** (v0.2): te same prawa w sześcianie, renderer WebGL2 z kulkami, ~2 tys. fotonów na CPU.
  **GPU** (v0.3): fizyka w WebGPU, do 200 tys. fotonów; stan wraca asynchronicznie do
  `World` (lustro), więc render/obserwatorzy bez zmian. Nie bit w bit jak CPU – szczegóły
  w PHYSICS.md. Wydajności na prawdziwej karcie jeszcze nie zmierzono (test tylko na
  programowym SwiftShaderze) – do sprawdzenia u użytkownika.
- **Następne kroki:**
  1. Puścić Lab na dłużej i obejrzeć najlepsze wszechświaty → czy pojawiają się
     trwałe zamknięcia (M2). Jeśli nie: rozszerzyć przestrzeń praw (np. więcej
     typów z biegunowością, kąty wiązań).
  2. Miary M3 (metabolizm): porównanie trwałości struktur w świetle i w cieniu.
  3. Wydajność: zmierzyć GPU na prawdziwej karcie; przy >50 tys. fotonów wąskim gardłem
     będzie rysowanie 2D (Canvas) i obserwatorzy – ew. renderer 2D w WebGL, obserwatorzy w workerze.
  4. Detektor „poziomów”: skupiska zamknięć (M6) i drzewo pochodzenia struktur (M5).

## Mapa plików

| Plik | Po co |
| --- | --- |
| `CONTEXT.md` | ten plik |
| `CHANGELOG.md` | historia wersji |
| `docs/PLAN.md` | cele, zasady, etapy M0–M6, architektura, ryzyka |
| `docs/PHYSICS.md` | wszystkie wzory fizyki i zakresy parametrów |
| `README.md` | krótki opis i obsługa |
| `js/core/genome.js` | **prawa**: listy SPECS, losowanie, mutacja, kompilacja do typed arrays |
| `js/physics/*` | dynamika (bez DOM, bez pojęć wyższego poziomu) |
| `js/observe/*` | detektory – tylko czytają świat |
| `js/lab/*` | wyszukiwanie praw (runner, search, pool, worker) |
| `js/gpu/*` | backend WebGPU: `kernels.js` (shadery WGSL), `gpu-world.js` (`EM.gpu.init`, `EM.GpuWorld`) |
| `js/render/*`, `js/ui/*`, `js/app/*` | rysowanie (renderer2d Canvas, renderer3d WebGL2, fasada `EM.renderer` w app/setup.js), panele, pętla |
| `tools/smoke.js` | `node tools/smoke.js` – test determinizmu i niezmienników |
| `tools/gpu-check.html` | porównanie GPU z CPU w przeglądarce (z serwera lokalnego) |

## Zasady pracy (twarde)

0. 2D i 3D dzielą genom i kod wiązań/obserwatorów (oś z = 0 w 2D). Gorące pętle
   (siły, całkowanie, siatka) są osobne dla 2D i 3D. Zmiana w 2D nie może zmienić
   wyników 2D bez wpisu w CHANGELOG – sprawdzaj sumy kontrolne (`tools/smoke.js`).

1. W `js/physics/` nie ma pojęć atom/molekuła/komórka – tylko w `js/observe/`.
2. Obserwatorzy nigdy nie zmieniają świata.
3. Lab zmienia tylko genom praw, nigdy stan cząstek. Nagroda: nowość × żywotność
   (+ mały bonus za trwałość/zamknięcia), nigdy „podobieństwo do kształtu”.
4. Materia zachowana: liczba fotonów stała, zmieniają się tylko typy i wiązania.
5. Determinizm: fizyka używa wyłącznie `EM.Rng`. Po każdej zmianie `node tools/smoke.js`.
6. Nowe parametry praw dopisywać na **końcu** list SPECS (inaczej zmienią się wszystkie ziarna).
7. Każda zmiana fizyki → `docs/PHYSICS.md` + wpis w `CHANGELOG.md`.
8. Zmiana wzoru w `js/physics/` → ta sama zmiana w `js/gpu/kernels.js` i `tools/gpu-check.html`
   (CPU to wzorzec; GPU ma się zgadzać statystycznie).

## Wersjonowanie

SemVer od 0.x (prototyp): **MINOR** = nowy etap/funkcja albo zmiana fizyki lub
generatora praw (te same ziarna dają inny świat), **PATCH** = poprawki bez zmiany
wyników. Od 1.0: zmiana generatora praw = MAJOR.

Wydanie: `CHANGELOG.md` (`[Unreleased]` → `[X.Y.Z] – data`), `EM.VERSION` w
`js/core/config.js` (widać w tytule karty), sekcja **Stan** tutaj, commit
`emergence: release vX.Y.Z – …`, tag `emergence-vX.Y.Z` (sesja w chmurze nie wypycha
tagów – podać użytkownikowi polecenia do uruchomienia lokalnie).

## Historia sesji

- **2026-10-23 – v0.3.0:** backend WebGPU (5 shaderów na krok, wzajemne propozycje
  wiązań, losowość z funkcji skrótu), przełącznik CPU/GPU, do 200 tys. fotonów,
  `tools/gpu-check.html`. CPU bez zmian (sumy kontrolne 2D identyczne).

- **2026-10-23 – v0.2.0:** świat 3D (fizyka, siatka 3D, światło, zamknięcia 3D),
  renderer WebGL2 z kulkami, kulki w 2D, Lab per wymiar. 2D bit w bit jak w 0.1.0.

- **2026-10-20 / 2026-10-23 – v0.1.0:** plan (PLAN.md), silnik M0, detektory M1/M2,
  Lab z novelty search, UI, test smoke, dokumentacja. Wydajność na wolnym serwerze
  testowym: ~5 ms/krok przy 4000 fotonach.
