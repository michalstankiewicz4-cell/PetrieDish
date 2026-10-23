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

- **Wersja:** 0.1.0 (2026-10-23) – etap **M0** gotowy, detektory **M1/M2** gotowe.
- **Działa:** genom praw z ziarna, ~6 tys. fotonów w czasie rzeczywistym, siła z
  pierścieniami, orientacja, wiązania z energią aktywacji, światło, reakcje, napęd,
  katalog struktur (odcisk Weisfeiler-Lehman), detektor zamknięć, Lab (novelty search
  w workerach; z `file://` liczy w stronie), eksport/import praw, link z ziarnem.
- **Następne kroki:**
  1. Puścić Lab na dłużej i obejrzeć najlepsze wszechświaty → czy pojawiają się
     trwałe zamknięcia (M2). Jeśli nie: rozszerzyć przestrzeń praw (np. więcej
     typów z biegunowością, kąty wiązań).
  2. Miary M3 (metabolizm): porównanie trwałości struktur w świetle i w cieniu.
  3. Wydajność: WebGPU dla sił (dane już są w typed arrays).
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
| `js/render/*`, `js/ui/*`, `js/app/*` | rysowanie, panele, pętla |
| `tools/smoke.js` | `node tools/smoke.js` – test determinizmu i niezmienników |

## Zasady pracy (twarde)

1. W `js/physics/` nie ma pojęć atom/molekuła/komórka – tylko w `js/observe/`.
2. Obserwatorzy nigdy nie zmieniają świata.
3. Lab zmienia tylko genom praw, nigdy stan cząstek. Nagroda: nowość × żywotność
   (+ mały bonus za trwałość/zamknięcia), nigdy „podobieństwo do kształtu”.
4. Materia zachowana: liczba fotonów stała, zmieniają się tylko typy i wiązania.
5. Determinizm: fizyka używa wyłącznie `EM.Rng`. Po każdej zmianie `node tools/smoke.js`.
6. Nowe parametry praw dopisywać na **końcu** list SPECS (inaczej zmienią się wszystkie ziarna).
7. Każda zmiana fizyki → `docs/PHYSICS.md` + wpis w `CHANGELOG.md`.

## Wersjonowanie

SemVer od 0.x (prototyp): **MINOR** = nowy etap/funkcja albo zmiana fizyki lub
generatora praw (te same ziarna dają inny świat), **PATCH** = poprawki bez zmiany
wyników. Od 1.0: zmiana generatora praw = MAJOR.

Wydanie: `CHANGELOG.md` (`[Unreleased]` → `[X.Y.Z] – data`), `EM.VERSION` w
`js/core/config.js` (widać w tytule karty), sekcja **Stan** tutaj, commit
`emergence: release vX.Y.Z – …`, tag `emergence-vX.Y.Z` (sesja w chmurze nie wypycha
tagów – podać użytkownikowi polecenia do uruchomienia lokalnie).

## Historia sesji

- **2026-10-20 / 2026-10-23 – v0.1.0:** plan (PLAN.md), silnik M0, detektory M1/M2,
  Lab z novelty search, UI, test smoke, dokumentacja. Wydajność na wolnym serwerze
  testowym: ~5 ms/krok przy 4000 fotonach.
