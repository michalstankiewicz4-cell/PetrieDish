# CONTEXT – START TUTAJ

> Plik do wznowienia pracy, gdy kontekst rozmowy zniknął (nowy czat, nowa sesja,
> inny asystent). Przeczytaj go w całości przed jakąkolwiek zmianą, a na koniec każdej
> sesji zaktualizuj sekcje **Stan** i **Ostatnia sesja**.

## Projekt w skrócie

- **Co:** Petrie Dish – przeglądarkowa symulacja cząstek („particle life”) z
  mechanikami fizycznymi i „chemicznymi”, Life Scannerem i efektami wizualnymi.
- **Repo:** https://github.com/michalstankiewicz4-cell/PetrieDish (jedyna gałąź: `main`)
- **Strona:** https://michalstankiewicz4-cell.github.io/PetrieDish/ (GitHub Pages z `main`, katalog główny)
- **Lokalnie (Windows):** `C:\Users\micha\vsrepos\PetrieDish` – uruchomienie: dwuklik na `index.html`.
- **Technologia:** czysty HTML/CSS/JS, bez bundlera i zależności; skrypty `<script defer>`,
  wszystko pod `window.PD`. Język UI: angielski; dokumentacja i rozmowa: polski.

## Stan

- **Wersja:** 3.2.0 (2026-10-19) – szczegóły w `CHANGELOG.md`.
- **Działa:** wszystkie mechaniki, edytory, Life Scanner, VFX, próbki z numerów.
- **Otwarte decyzje:** `docs/KNOWN_ISSUES.md` – pozycje ze statusem `DECYZJA`
  (KI-01…04, KI-12…16). Nic ze statusem `OTWARTY`.
- **Do zrobienia (pomysły):**
  1. Nowa lista nazwanych próbek → `PD.config.SAMPLES` w `js/core/config.js` (obecnie pusta).
  2. Uczenie maszynowe: automatyczne szukanie ciekawych seedów/parametrów
     (CMA-ES / novelty search w Web Workerze – `PD.world.step()` nie dotyka DOM),
     ewentualnie Neural Cellular Automata / ocena klatek przez CLIP (transformers.js).
  3. Decyzje projektowe z KNOWN_ISSUES (np. czy mixing ma zmieniać zachowanie).

## Mapa dokumentacji

| Plik | Po co |
| --- | --- |
| `CONTEXT.md` | ten plik – stan, zasady pracy, ostatnia sesja |
| `CHANGELOG.md` | historia wersji |
| `docs/USER_GUIDE.md` | instrukcja obsługi (każdy przycisk i suwak) |
| `docs/ARCHITECTURE.md` | struktura plików, przepływ klatki, stan `PD.sim`, „jak dodać…” |
| `docs/MECHANICS.md` | dokładne wzory mechanik |
| `docs/KNOWN_ISSUES.md` | rejestr problemów KI-xx (otwarte, decyzje, zamknięte) |
| `README.md` | krótki opis po angielsku dla GitHuba |
| `tools/regression.py` | test regresji (Playwright) |

Przy pracy nad konkretną rzeczą zwykle wystarczy: ten plik + odpowiedni rozdział
`ARCHITECTURE.md` + 2–3 pliki z `js/`. Nie trzeba czytać całego projektu.

## Zasady pracy

1. **Najpierw ten plik**, potem dokumenty z mapy – nie zgadywać struktury.
2. **Małe kroki**: jedna logiczna zmiana = jeden commit; użytkownik testuje po każdej.
3. **Refaktor bez zmiany zachowania** musi dać wynik `tools/regression.py compare`
   = 16/16 identycznych. Zmiana fizyki = świadoma różnica opisana w CHANGELOG.
4. **Seedy**: nie zmieniać kolejności losowań w `js/sim/seed.js` (nowe tylko na końcu)
   ani stałych `SeededRandom` – inaczej każdy numer próbki wygląda inaczej (MAJOR).
5. **Stan tylko w `PD.sim`**; fizyka (`js/sim/`) bez DOM; UI przez `PD.controller`.
6. **Masa**: symulacja zmienia tylko `p._mass`, nigdy `species.mass` (KI-07).
7. **Kolory** zawsze `#rrggbb` (mieszanie je parsuje).
8. **Każdy nowy problem** → wpis `KI-xx` w `docs/KNOWN_ISSUES.md` (kolejny wolny numer: **KI-19**).
9. Po zmianie zachowania lub UI zaktualizować `docs/USER_GUIDE.md` / `docs/MECHANICS.md`.

## Wersjonowanie (obowiązkowe przy każdym wydaniu)

SemVer `MAJOR.MINOR.PATCH`:

| Część | Kiedy |
| --- | --- |
| **MAJOR** | zmiana struktury/API `PD`, zmiana generatora seedów (stare numery wyglądają inaczej), zmiana formatu zapisu |
| **MINOR** | nowa funkcja/mechanika **albo** zmiana zachowania symulacji (te same ustawienia → inny przebieg) |
| **PATCH** | poprawki bez zmiany wyników symulacji: UI, crash, wydajność, dokumentacja |

Checklista wydania (wykonuje ją asystent, bez przypominania):

1. Zmiany opisane w `CHANGELOG.md` pod `[Unreleased]` w trakcie pracy.
2. Przy wydaniu: `[Unreleased]` → `[X.Y.Z] – RRRR-MM-DD`, nowa pusta sekcja `[Unreleased]`.
3. `PD.VERSION` w `js/core/config.js` = `X.Y.Z` (widać w tytule karty).
4. Wersja w sekcji **Stan** tego pliku; statusy w `KNOWN_ISSUES.md` (`ZAMKNIĘTY vX.Y.Z`).
5. Commit `release: vX.Y.Z – krótki opis`, tag `git tag -a vX.Y.Z -m "..."`, push `main` i tagów.
6. Kontrola: strona na GitHub Pages pokazuje nową wersję w tytule karty.

Same zmiany w dokumentacji mogą iść bez nowej wersji (zostają w `[Unreleased]`),
dopóki nie towarzyszy im zmiana kodu.

## Jak sprawdzać zmiany

```
py -m pip install playwright            (jednorazowo)
py -m playwright install chromium       (jednorazowo)
py tools/regression.py run index.html before.json    # przed zmianą
py tools/regression.py run index.html after.json     # po zmianie
py tools/regression.py compare before.json after.json
```
W przeglądarce: konsola → `PD.sim` (stan), `PD.setDebug(true)` (logi), `PD.VERSION`.

## Historia sesji

### Ostatnia sesja – 2026-10-19 (v3.0.0 → v3.2.0)
- Podział jednego `index.html` (6600 linii) na `css/` + `js/` (v3.0.0), zweryfikowany
  testem regresji jako identyczny z 2.22.0; naprawione crash przy zwiększeniu liczby
  gatunków, mnożenie pętli animacji, edytor zasięgu, siatka po resize.
- v3.1.0: Mass Gradient, inteligentne cząstki, Hierarchy Strength, wiązania/Life
  Scanner przez krawędź, zgodność suwaków ze stanem; usunięta stara lista 17 próbek.
- Audyt kolizji mechanik (11 eksperymentów) → `docs/KNOWN_ISSUES.md`.
- v3.2.0: naprawione KI-05…KI-11, KI-17, KI-18; dokumentacja, CHANGELOG, ten plik, tagi.
- Usunięta gałąź `refactor/modules`; pracujemy tylko na `main`.

### Wcześniej
- 2026-03: rozwój wersji jednoplikowej do 2.22.0 (UI, Life Scanner, FPS Booster, edytory per kolor).
- 2026-01: osobna linia v5.x (WebGPU), porzucona 2026-01-16.
