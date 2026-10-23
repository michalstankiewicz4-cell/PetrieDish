# Changelog – Emergence

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje SemVer
(zasady w `CONTEXT.md`). Wersja aplikacji: `EM.VERSION` w `js/core/config.js`.

## [Unreleased]

## [0.1.0] – 2026-10-23
Pierwszy prototyp (etap M0 + detektory M1/M2).
### Dodane
- Plan projektu (`docs/PLAN.md`) i wzory fizyki (`docs/PHYSICS.md`).
- Genom praw z ziarna: siła z pierścieniami (jak Gravitation), twardy rdzeń,
  orientacja (biegunowość, moment), wiązania z energią aktywacji i rozpadem,
  energia wewnętrzna, światło (słońca, dzień/noc), reakcje zmieniające typ, napęd.
  Mutacja i eksport/import JSON.
- Silnik: fotony w typed arrays, siatka przez sortowanie przez zliczanie,
  stencil „half-shell”, sinus z tablicy; świat toroidalny; pełny determinizm.
- Obserwatorzy: struktury (graf wiązań, odcisk Weisfeiler-Lehman), katalog
  stabilnych struktur z nazwami, detektor zamknięć (błony/pęcherzyki), metryki
  i historia.
- Lab: novelty search po prawach, ocena w Web Workerach (lub w stronie z `file://`),
  archiwum w localStorage, lista najlepszych z „Load” i eksportem.
- UI: panele World / Observe / Lab, wykres historii, kafelki katalogu, inspektor
  fotonu, zoom/przesuwanie, link z ziarnem praw (`#laws=…&types=…&n=…&world=…`).
- `tools/smoke.js` – determinizm, zachowanie materii, spójność wiązań, brak NaN, wydajność.
