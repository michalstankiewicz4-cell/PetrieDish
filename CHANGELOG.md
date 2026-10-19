# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje:
[SemVer](https://semver.org/lang/pl/) – zasady w `CONTEXT.md` („Wersjonowanie”).
Wersja aplikacji: `PD.VERSION` w `js/core/config.js` (widać ją w tytule karty).

## [Unreleased]

## [3.2.0] – 2026-10-19
Zmiana zachowania symulacji (MINOR): te same ustawienia dają inny przebieg niż w 3.1.0
tam, gdzie działały naprawione kolizje (Wall, Transfer, Mixing, szybkie cząstki).
### Naprawione (audyt kolizji mechanik – `docs/KNOWN_ISSUES.md`)
- KI-05 Wall: siły, Swarm i mysz nie działają już przez ścianę.
- KI-06 Mass Transfer + Mass Hierarchy: koniec „rozkręcania” mas.
- KI-07 Masy z przebiegu nie przeciekają do gatunku – Reset przywraca masy startowe.
- KI-08 Mieszanie kolorów nie kasuje masy zebranej przez Transfer.
- KI-09 Edytory per kolor działają też na zmieszane cząstki (`p.species`).
- KI-10 Wiązania usuniętych cząstek są sprzątane, sloty zwalniane; nieudane wiązanie nie blokuje slotu.
- KI-11 Krok ruchu ograniczony do 8 px – zderzenia (mieszanie, transfer) nie są przeskakiwane.
- KI-17 Kolor inteligentnych cząstek jako hex (mieszanie dawało `#NaN…`).
- KI-18 Swarm w trybie Warp poprawnie liczy środek grupy na krawędzi.
### Dodane
- Dokumentacja: `docs/USER_GUIDE.md` (instrukcja), `docs/ARCHITECTURE.md`,
  `docs/MECHANICS.md` (wzory), `docs/KNOWN_ISSUES.md` (rejestr problemów KI-xx).
- `CONTEXT.md` – plik do wznowienia pracy po utracie kontekstu (zastępuje `NOTES.md`).
- `CHANGELOG.md`, zasady wersjonowania, tagi git `v2.22.0`, `v3.0.0`, `v3.1.0`, `v3.2.0`.
- Numer wersji w tytule karty przeglądarki; `PD.math.hslToHex`, `PD.bonds.prune`,
  `PD.config.MAX_STEP_PX`.

## [3.1.0] – 2026-10-19
### Naprawione
- Mass Gradient: cząstki dostają fizykę koloru swojego pasa (wcześniej ~84% miało
  masę, zasięg i ładunek losowego gatunku).
- Inteligentne cząstki: parametry zgodne z ich kolorem; brak wiersza w macierzy = siła neutralna.
- Suwak Hierarchy Strength działa (skaluje różnicę mas; 100% = jak dotąd).
- Wiązania i Life Scanner liczą odległość przez krawędź w trybie Warp; linie
  wiązań i ramki nie przecinają już ekranu.
- Startowe położenia suwaków zgodne ze stanem: Particle count 1000, Transfer Rate
  100% (= 0.01), FPS Booster 1.00x (suwak stał na 50, a działało 1.00x).
- Endless nie nadpisuje ustawienia liczby cząstek – Reset odtwarza pełną populację.
- Donate wyłącza się przy każdym przebudowaniu świata.
- Opisy w podpowiedziach (Mass Hierarchy, macierz).
### Usunięte
- Lista 17 nazwanych próbek (do zrobienia nowa w `PD.config.SAMPLES`).

## [3.0.0] – 2026-10-19
### Zmienione
- Podział jednego `index.html` (6600 linii) na `css/` (13 plików) i `js/`
  (27 modułów, namespace `window.PD`). Bez kroku budowania, działa z `file://`.
- Mechaniki, suwaki, zakresy Life Scannera i edytory per kolor opisane tabelami
  zamiast ~60 skopiowanych handlerów. Logi konsoli za `PD.setDebug(true)`.
- Zweryfikowane testem regresji: identyczny stan cząstek i obraz (16 scenariuszy)
  oraz identyczny wygląd UI (15 stanów) względem 2.22.0.
### Naprawione
- Zwiększenie liczby gatunków ponad liczbę z próbki zawieszało symulację.
- Reset / Random / Apply w trakcie działania dokładały kolejną pętlę animacji.
- Edytor Interaction Range aktualizował zasięg tylko częściowo.
- Po zmianie rozmiaru okna nowy obszar nie miał oddziaływań (stara siatka).
- HUD pokazuje „Seed: Default” od startu; suwak Speed podąża za próbką;
  błędna wartość w macierzy nie zapisuje NaN.
### Dodane
- `tools/regression.py`, `NOTES.md`, `.editorconfig`, `.gitattributes`, `.gitignore`.

## [2.22.0] – 2026-03-06
Ostatnia wersja jednoplikowa (tag `v2.22.0`). Najważniejsze z marca 2026:
Life Scanner z zakresami od–do, FPS Booster (zapamiętywany), osobne liczniki
Render/Physics FPS, edytory per kolor (Initial Speed, Mass, Charge, Range) z
Randomize/Gradient, gradienty macierzy, Visual FX, panele boczne z blokadą,
tryb kompaktowy, optymalizacje (siatka przestrzenna dla wiązań i Life Scannera,
cache DOM, single-pass mass hierarchy).

## Wcześniej
- 2026-01: osobna linia v5.x (wersja GPU / WebGPU, „v5.0-C1”, „v5.1-C2”),
  zastąpiona 2026-01-16 obecnym kodem v2.x. Numeracja 3.x kontynuuje linię v2.x.
