# Znane problemy i kolizje mechanik

Audyt z 2026-10-19 (wersja 3.1.0), naprawy w 3.2.0: 11 eksperymentów bez okna, każda
mechanika osobno i w parach, te same warunki startowe. Pomiary w kolumnie „Dowód”.

**Status:** `OTWARTY` – do naprawy · `DECYZJA` – wymaga wyboru, bo poprawka zmieni
wygląd symulacji · `ZAMKNIĘTY vX.Y.Z` – naprawione w tej wersji.
**Waga:** wysoka = psuje symulację / daje błędne wyniki, średnia = widoczna
niespójność, niska = kosmetyka lub rzadki przypadek.

Przy naprawie: zmień status, dopisz wersję, dodaj wpis do `CHANGELOG.md`.

## Podsumowanie

| ID | Problem | Typ | Waga | Status |
| --- | --- | --- | --- | --- |
| KI-05 | Wall: siły działają przez ścianę | kolizja | wysoka | ZAMKNIĘTY v3.2.0 |
| KI-06 | Mass Transfer + Mass Hierarchy: masy się rozkręcają | kolizja | wysoka | ZAMKNIĘTY v3.2.0 |
| KI-07 | Masa przecieka przez Reset | błąd | wysoka | ZAMKNIĘTY v3.2.0 |
| KI-08 | Mixing kasuje masę zebraną przez Transfer | kolizja | średnia | ZAMKNIĘTY v3.2.0 |
| KI-09 | Po zmieszaniu edytory per kolor nie działają | kolizja | średnia | ZAMKNIĘTY v3.2.0 |
| KI-10 | Endless: martwe wiązania zostają | kolizja | średnia | ZAMKNIĘTY v3.2.0 |
| KI-11 | Duża prędkość: przeskakiwanie zderzeń | kolizja | niska | ZAMKNIĘTY v3.2.0 |
| KI-17 | Inteligentne cząstki z kolorem HSL psuły mieszanie (`#NaN…`) | błąd | niska | ZAMKNIĘTY v3.2.0 |
| KI-18 | Swarm: środek grupy na krawędzi liczony źle (Warp) | błąd | niska | ZAMKNIĘTY v3.2.0 |
| KI-01 | Color mixing tylko wizualny | projekt | średnia | DECYZJA |
| KI-02 | Transfer/Hierarchy bez Mass nic nie robią | projekt | niska | DECYZJA |
| KI-03 | Intelligent Life drga zamiast przewidywać | projekt | średnia | DECYZJA |
| KI-04 | Speed to nie zwolnienie czasu | projekt | niska | DECYZJA |
| KI-12 | Wall + Mass Transfer wysysa masę | projekt | niska | DECYZJA |
| KI-13 | Masa nie wpływa na siły | projekt | niska | DECYZJA |
| KI-14 | Wir ograniczony zasięgiem koloru | projekt | niska | DECYZJA |
| KI-15 | Więzy wiązań ignorują masę | projekt | niska | DECYZJA |
| KI-16 | Seed losuje granice i prędkość, loader je ignoruje | projekt | niska | DECYZJA |

---

## Kolizje i błędy

### KI-05 · Wall: siły działają przez ścianę — wysoka
- **Objaw:** w trybie Wall cząstka przy lewej krawędzi przyciąga cząstkę przy prawej.
- **Dowód:** dwie cząstki x=5 i x=W−5, silne przyciąganie → A dostaje `vx = −0.05`, B `+0.05`.
- **Przyczyna:** `js/sim/particle.js` – siły parami, Swarm i mysz zawsze używają
  `torusDelta`; siatka (`SpatialGrid.getNearby`) zawsze zawija komórki.
- **Naprawa:** w `update()` i `_applySwarm()` użyć `PD.math.delta(a, b, size, sim.boundaryMode === 'warp')`
  (tak jak już robią bonds i Life Scanner); opcjonalnie w siatce nie zawijać komórek poza Warp.
- **Uwaga:** zmienia wygląd próbek tylko w trybie Wall (próbki zawsze ładują Warp).
- **Naprawione w v3.2.0:** siły parami, Swarm, mysz i przewidywanie inteligentnych cząstek używają `PD.math.delta(..., wrap)` – przez krawędź tylko w Warp. Pomiar po naprawie: `vx = 0`.

### KI-06 · Mass Transfer + Mass Hierarchy: masy się rozkręcają — wysoka
- **Objaw:** czarne przyklejają się do 2.0, białe do 0.3, średnia masa reszty rośnie bez końca.
- **Dowód:** średnia masa „innych” 0.97 → 1.15 po 1800 krokach i dalej rośnie; każda
  mechanika osobno jest stabilna (0.98 / 0.97).
- **Przyczyna:** Hierarchy co klatkę ustawia czarnym masę ponad maksimum innych,
  Transfer oddaje część tej masy sąsiadom → maksimum rośnie → zapadka.
- **Naprawa (do wyboru):** (a) Transfer nie dotyczy czarnych i białych, gdy Hierarchy
  jest włączona; (b) Hierarchy liczy max/min z mas bazowych gatunków (`colors[].mass`
  zapisanych przy spawnie), a nie z bieżących.
- **Naprawione w v3.2.0:** przy włączonej Hierarchy czarne i białe nie biorą udziału w Transferze (wariant a). Pomiar: średnia masa „innych” stała 0.973 przez 1800 kroków.

### KI-07 · Masa przecieka przez Reset — wysoka
- **Objaw:** po Resecie nowe cząstki mają masy z poprzedniego przebiegu (np. biały 0.30 zamiast 1.05).
- **Dowód:** masy gatunków przed: `[1.05, 0.95, 1, 0.8, 1.2, 0.9]`, po przebiegu i Resecie: `[0.3, 2, 1.75, 0.998, 0.915, 0.415]`.
- **Przyczyna:** Transfer, Hierarchy i odbicia od ściany zapisują masę do
  `colorData.mass`, które jest wspólnym obiektem gatunku w `sim.colors`.
- **Naprawa:** zmiany masy w trakcie symulacji tylko w `p._mass`; `colorData.mass`
  zmieniają wyłącznie seed i edytor Mass. Rozwiązuje też część KI-08.
- **Naprawione w v3.2.0:** symulacja zmienia tylko `p._mass`; `species.mass` zmieniają tylko seed i edytor Mass. Pomiar: masy gatunków po przebiegu bez zmian.

### KI-08 · Mixing kasuje masę zebraną przez Transfer — średnia
- **Objaw:** cząstka po zmieszaniu koloru skacze do masy z `colorData`.
- **Dowód:** 5714 zmieszań w 600 krokach, 469 skoków masy, maks. 0.21.
- **Przyczyna:** `mixColor()` → `syncCache()` czyta `_mass` z `colorData`.
- **Naprawa:** w `mixColor()` zmieniać tylko `hex` (bez `syncCache`) albo zachować `_mass`.
- **Naprawione w v3.2.0:** `mixColor()` zmienia tylko `hex`, bez `syncCache()`. Pomiar: 0 skoków masy na 5760 zmieszań.

### KI-09 · Po zmieszaniu edytory per kolor nie działają — średnia
- **Objaw:** okna Mass / Charge / Range / Initial Speed nie wpływają na zmieszane cząstki.
- **Dowód:** po 900 krokach z Mixing 894 z 900 cząstek ma własną kopię `colorData`.
- **Przyczyna:** edytory szukają `p.colorData === kolor`; `mixColor()` tworzy kopię.
- **Naprawa:** trzymać gatunek osobno (`p.species` → obiekt z `sim.colors`) i kolor
  rysowania osobno (`p.hex`); edytory szukają po `p.species`.
- **Naprawione w v3.2.0:** nowe pole `p.species` (stały gatunek); edytory szukają po nim. Pomiar: 0 z 900 cząstek odłączonych od gatunku.

### KI-10 · Endless: martwe wiązania zostają — średnia
- **Objaw:** lista wiązań rośnie, cząstki tracą sloty na nowe wiązania.
- **Dowód:** 1075 aktywnych wiązań, z czego 487 wskazuje na usunięte cząstki.
- **Przyczyna:** `world.removeDead()` nie czyści `sim.bonds.active` ani `p.bonds`/`bondSlots`.
  To samo przy wyłączeniu Intelligent Life (usuwa cząstki).
- **Naprawa:** po usunięciu cząstek przefiltrować `bonds.active` i zwolnić sloty
  (slot trzeba zapisywać w wiązaniu, żeby wiedzieć który zwolnić).
- **Naprawione w v3.2.0:** wiązanie pamięta sloty (`s1`, `s2`); `PD.bonds.prune()` po usunięciu cząstek usuwa wiązania i kandydatów, zwalnia slot drugiego końca. Dodatkowo slot zajmowany dopiero, gdy wolne są oba końce (wcześniej nieudane wiązanie blokowało slot). Pomiar: 0 martwych wiązań.

### KI-11 · Duża prędkość: przeskakiwanie zderzeń — niska
- **Objaw:** przy Speed 200% lekkie cząstki skaczą ~17 px na krok – więcej niż
  promień mieszania (8 px) i transferu (5 px), więc zderzenia są gubione.
- **Naprawa:** limit przesunięcia na krok (np. ≤ 5 px) albo podział kroku przy dużym `speed`.
- **Naprawione w v3.2.0:** krok ruchu ograniczony do `PD.config.MAX_STEP_PX` = 8 px. Zmienia wygląd szybkich/lekkich cząstek (np. Speed > 100%, masa < 0.75).

### KI-17 · Inteligentne cząstki z kolorem HSL psuły mieszanie — niska
- **Objaw:** z włączonym Color mixing kolor `hsl(...)` był parsowany jak hex → `#NaN…`, cząstka rysowana złym kolorem.
- **Naprawione w v3.2.0:** kolor inteligentnych cząstek zapisywany jako hex (`PD.math.hslToHex`).

### KI-18 · Swarm: środek grupy na krawędzi liczony źle — niska
- **Objaw:** w trybie Warp grupa leżąca na krawędzi miała „środek” w połowie ekranu (średnia surowych współrzędnych).
- **Naprawione w v3.2.0:** środek = średnie przesunięcie do sąsiadów liczone przez krawędź.

---

## Decyzje projektowe (poprawka zmieni zachowanie)

### KI-01 · Color mixing tylko wizualny
Zmienia `hex`, a `name` (fizyka) zostaje. Po chwili kolory nie mówią, kto kogo
przyciąga, a suwak Blend Rate nie wpływa na ruch. **Opcje:** zostawić jako efekt
wizualny (przenieść do VFX?) albo mieszać też właściwości (masa, ładunek, wiersz macierzy).

### KI-02 · Mass Transfer / Hierarchy bez Mass nic nie robią
Zmieniają tylko rozmiar kropek. Seed może je wylosować przy wyłączonej Mass.
**Opcje:** włączać Mass automatycznie, blokować checkbox, albo w seedzie losować je tylko przy Mass.

### KI-03 · Intelligent Life drga zamiast przewidywać
Odpychanie od przyszłej pozycji (która leży na kierunku ruchu) hamuje i zawraca
cząstkę → oscylacja. Średnia prędkość 1.64 vs 0.41 zwykłych (bez przewidywania 0.13).
Przewidywanie pomija ładunki, wir, rój i mysz. **Opcja:** zamiast odpychania od siebie –
np. unikanie przewidywanych zderzeń z innymi albo szukanie celu (dobry kandydat pod ML).

### KI-04 · Speed to nie zwolnienie czasu
Mnoży tylko krok ruchu; siły działają tak samo, więc zmienia się dynamika
(Speed 50% przez 240 kroków ≠ 100% przez 120 kroków). Prawdziwe zwolnienie to FPS Booster.
**Opcja:** przemianować na „Step size” albo skalować też siły.

### KI-12 · Wall + Mass Transfer wysysa masę
Każde odbicie od ściany: `masa *= 0.95`. Mechanika wymiany masy ma efekt uboczny niezwiązany z wymianą.

### KI-13 · Masa nie wpływa na siły
Ciężka cząstka przyspiesza jak lekka, tylko wolniej się przesuwa (masa skaluje krok, nie `F/m`).

### KI-14 · Wir ograniczony zasięgiem koloru
Wir działa do 80 px, ale tylko wśród sąsiadów w zasięgu koloru (30–150). Przy małych zasięgach jest słabszy.

### KI-15 · Więzy wiązań ignorują masę
Korekta długości przesuwa obie cząstki po połowie, niezależnie od masy.

### KI-16 · Seed losuje granice i prędkość, loader je ignoruje
Celowo (Endless potrafi wyczyścić ekran). Losowań nie usuwać – zmieniłoby to każdy numer próbki.

---

## Inne uwagi

- Siatka przestrzenna ma stałą komórkę 150 px. Zasięgi > 150 px działają, ale wolniej.
- Ten sam seed daje te same ustawienia, ale nie identyczny przebieg – pozycje startowe
  i mieszanie kolorów używają `Math.random`.
