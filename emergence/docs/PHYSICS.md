# Fizyka – wzory (v0.9, model fotonów z Gravitation)

Tylko to, co jest w `js/physics/`. Fotony i siła pochodzą z silnika **Gravitation**
(jego edytor fotonu i wzór na siłę), do tego **ciśnienie**, **temperatura** i **wiązania z kątami**.

Poprzednie modele działają dalej jako osobne strony: `v0.6/` (typy fotonów, orientacja, reakcje)
i `v0.8/` (identyczne fotony, siła silna i elektromagnetyczna, światło).

## Foton = formuły (edytor jak w Gravitation)

Każdy foton liczy po kolei wiersze formuł (`js/core/formulas.js`); `rand(a, b)` daje każdemu
fotonowi inną wartość. Wiersz może używać nazw z wierszy **nad nim**; wiersze pomocnicze (bez roli)
tylko podają nazwę dalej. Funkcje: rand, abs, min, max, sqrt, pow, round, floor, ceil.

| Rola | Domyślnie (Gravitation) | Znaczenie |
| --- | --- | --- |
| charge | `rand(-1, 1)` | ładunek; znak = kolor (− niebieski, 0 biały, + pomarańczowy) |
| mass | `rand(0.5, 3)` | bezwładność |
| speed | `100 / mass` | prędkość w px/s – **zawsze stała**, siły zmieniają tylko kierunek |
| energy | `9` | liczba używana w innych formułach |
| force | `abs(charge) * 5000` | amplituda siły |
| forceRange | `abs(charge) * 50` | zasięg siły (px) |
| (pcount) | `3` | pomocnicza |
| periods | `energy / pcount` | liczba okresów fali w zasięgu |
| waveOffset | `1` | 0 = klasyczna fala, 1 = znak siły nigdy się nie zmienia |
| phaseShift | `0` | przesunięcie fali (w okresach) |
| valence | `3` | ile wiązań foton może mieć (0–4) – **nasze** |
| bondAngle | `60` | najmniejszy kąt między dwoma wiązaniami fotonu (°) – **nasze** |

Zmiana formuł działa na żywo: foton zachowuje ładunek, masę i energię, reszta liczy się od nowa
(jak `refreshAllPhotons` w Gravitation). Błąd w formule → wartość zapasowa i czerwony komunikat.
Formuły i środowisko zapisują się w przeglądarce (localStorage), Export/Import jako JSON.

## Krok (dt = 1/60 s)

1. **Siatka** – komórki ≥ największy zasięg siły.
2. **Pary** – siła z Gravitation, parametry uśrednione z obu fotonów:

   `range = (r_i + r_j)/2`, `amp = (F_i + F_j)/2`, `periods`, `waveOffset`, `phaseShift` – średnie

   `f = znak · amp · (sin(2π · (periods · d / range + phaseShift)) + offset) / (1 + offset) · (1 − d / range) · (1 − temperatura)`

   `znak = +1` (przyciąganie) dla przeciwnych ładunków, `−1` dla jednakowych albo z zerem.
   Siła działa na oba fotony (akcja = reakcja).
3. **Nowe wiązania** – fotony bliżej niż `1.3 · długość wiązania`, oba mają wolne miejsce
   (`valence`), kierunek nowego wiązania tworzy z każdym istniejącym wiązaniem obu fotonów kąt
   ≥ ich `bondAngle`, losowanie `< bondChance`.
4. **Wiązania** – sprężyna do długości wiązania (`bondStrength · (d − długość)`); pęka, gdy
   `d > długość · bondBreak` albo gdy foton ma więcej wiązań niż `valence` (po zmianie formuły).
   **Kąty:** dwa wiązania fotonu bliżej niż jego `bondAngle` – ich końce są odpychane
   (`angleStiffness · (cos − cos bondAngle)`).
5. **Ruch** – `v += F / m · dt`, potem `|v|` wraca do `speed` fotonu (jak w Gravitation),
   `x += v · dt`, zawijanie torusa.
6. **Twarda granica** – kulki (promień 3 px) nigdy na siebie nie wchodzą: nakładające się pary
   są rozsuwane (lżejsza bardziej), prędkość zbliżania znika (następny krok przywraca `speed`).

## Środowisko

| Parametr | Domyślnie | Działanie |
| --- | --- | --- |
| **Ciśnienie** (0–1) | 0.8 | **długość wiązania** = 2r · (1 + 1.5 · (1 − ciśnienie)): przy 1 kulki się stykają, przy 0 wiązanie jest 2.5× dłuższe |
| **Temperatura** (0–1) | 0 | **osłabia siłę**: × (1 − temperatura) |
| Bond strength | 1500 | sztywność wiązania |
| Bond breaks at | 2 | wiązanie pęka po rozciągnięciu × tyle |
| Bond chance | 0.2 | szansa na wiązanie na krok przy styku |
| Angle stiffness | 1500 | jak mocno pilnowany jest kąt między wiązaniami |

## Świat

Torus 2D albo 3D (domyślnie), bok/pole rośnie z liczbą fotonów (1500 px² albo 40 000 px³ na foton –
rzadziej niż wcześniej, bo zasięg sił sięga 50 px). Bez rozszczepiania i fuzji (`splitTime` z
Gravitation pominięty – w planie wymiana właściwości przez wiązanie).

## Co jest wyłączone w tym modelu

- **Lab (uczenie maszynowe)** – prawa stroi się ręcznie w edytorze.
- **GPU** – shadery znają jeszcze model v0.8; liczy CPU.
- Światło i przepływ energii (energia to stała właściwość z formuły).

## Determinizm

Pozycje i kierunki z ziarna świata, wartości `rand()` w formułach z ziarna (`Seed` w panelu).
Te same formuły + te same ziarna = ten sam przebieg (sprawdza `node tools/smoke.js`).

## Plan

- Moc wiązania zależna od właściwości fotonów (formuła).
- Dozwolony kąt zależny od szybkości (można już wpisać np. `bondAngle = 40 + speed / 4`).
- Wymiana właściwości przez wiązanie zamiast rozpadu i fuzji.
- GPU i Lab dla tego modelu.
