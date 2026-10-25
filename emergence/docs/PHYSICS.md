# Fizyka – wzory (v0.7, model fotonów)

Tylko to, co jest w `js/physics/` (i to samo w `js/gpu/kernels.js`). Oznaczenia: `i`, `j` –
fotony, `d` – odległość środków (przez krawędź torusa), `n` – kierunek i → j, `e` – energia
fotonu (0–1), `q` – ładunek. Jednostki: piksele i kroki symulacji. Parametry pochodzą z
genomu praw (`js/core/genome.js`, format 2); w nawiasach zakresy losowania.

Poprzedni model (typy z macierzami praw, orientacja, reakcje) – wersja v0.6 w folderze
`v0.6/` (osobna strona, osobne archiwum Labu).

## Foton

Wszystkie fotony to **ta sama cząstka** o tym samym promieniu `r = 3 px`
(`EM.config.PHOTON_RADIUS`). Różnią się tylko stanem:

| Stan | Co to | Zmienia się |
| --- | --- | --- |
| pozycja, prędkość | 2D albo 3D, torus | co krok |
| ładunek `q` | −2, −1, 0, +1, +2; w kodzie `type = q + 2` (kolor) | na razie stały (siła słaba – plan) |
| masa | `massBase (0.5–2) + massPerCharge (0–1) · |q|` | z ładunkiem |
| energia `e` | 0–1 | światło, wyciek, wiązania |
| wiązania silne | do 4 partnerów | tworzą się i pękają |

Skład na starcie: `neutralShare` (0–0.5) fotonów obojętnych; wśród naładowanych
`doubleShare` (0–0.35) z |q| = 2 i `positiveShare` (0.3–0.7) dodatnich.

## Krok (`World.step`)

1. Siatka przestrzenna (komórki ≥ R).
2. Pary: siła elektromagnetyczna + miękki rdzeń, kandydaci do wiązań silnych, lista bliskich par.
3. Wiązania silne: sprężyny, przepływ energii, pękanie.
4. Całkowanie: światło, wyciek, tarcie, szarpnięcia (temperatura + energia), limit prędkości.
5. **Twarda granica** (`World.contacts`).

## Twarda granica i ciśnienie

Środki dwóch fotonów nie zbliżają się bardziej niż

`dmin = 2 r · (1 + 0.5 · (1 − ciśnienie))`

Ciśnienie (0–1, losowane 0.3–1, suwak **Pressure** działa na żywo) to właściwość środowiska:
przy 1 fotony stykają się powierzchniami (`dmin = 2r`), przy niższym trzymają się dalej.
Po ruchu nakładające się pary są rozsuwane (lżejszy foton przesuwa się bardziej, pęd zachowany)
i tracą prędkość zbliżania, z odbiciem `restitution` (0–0.6). CPU: do 4 przejść po bliskich
parach; GPU: 5 przejść równoległych.

## Siła elektromagnetyczna (fala z Gravitation)

Dla `dmin ≤ d < R` (R 20–48), dodatnia = przyciąganie:

`F = forceScale · znak · (|q_i| + |q_j|)/2 · (sin(2π · (periods · d / R + phaseShift)) + offset) / (1 + offset) · (1 − d/R)`

- `znak = +1` gdy ładunki przeciwne, `−1` gdy jednakowe albo jeden obojętny.
- `periods` 0.5–3 – liczba powłok przyciągania/odpychania w zasięgu R;
  `phaseShift` 0–1 przesuwa je; `waveOffset` 0–1: 0 = klasyczna fala (jednakowe ładunki
  przyciągają się w niektórych powłokach), 1 = znak nigdy się nie zmienia (jak Coulomb).
- `forceScale` 0.05–0.3. Dwa obojętne fotony nie czują tej siły.
- Poniżej `dmin` działa jeszcze miękkie odpychanie `d/dmin − 1` (zanim zadziała twarda granica).

## Siła silna (wiązania)

Bardzo krótki zasięg, nasycająca się, taka sama dla wszystkich fotonów:

- **Powstaje**, gdy `d < dmin · (1 + strongReach)` (0.1–0.6), oba fotony mają wolne miejsce,
  kwadrat prędkości względnej `≤ bindEnergy` (0.05–2), razem mają energię aktywacji
  (`activation`: 0 albo 0.3–1, zużywana) i losowanie `< strongRate` (0.005–0.1).
- **Sprężyna** o długości spoczynkowej `dmin` (styk) i sztywności `strongK` (0.05–0.5) + tłumienie 0.15.
- **Pęka**, gdy `d > dmin · breakStretch` (1.3–2.5), losowo z szansą `decay · (1 + e_i + e_j)`
  (decay 0 albo do 0.002) albo gdy foton ma więcej wiązań niż mu wolno (szansa 1/4 na krok).
  Przy pęknięciu każdy foton odzyskuje połowę energii aktywacji.
- **Walencja** jest narzuconym prawem (`valence` 0–4, ta sama dla wszystkich) i **maleje z energią**:

  `dozwolone = valence − ⌊e · valence · energyValence⌋` (energyValence 0–1)

  Gorący foton zrzuca wiązania, zimny może je odzyskać. Liczba na kulce (View → *Free bonds on
  photons*) = dozwolone − obecne.
- Wzdłuż wiązania płynie energia: `Δ = (e_j − e_i) · energyShare · 0.5` (0–0.2).

## Energia i ruch

- `e += absorb · światło(x)` (absorb 0 albo 0.01–0.03), potem `e −= leak · e` (0.002–0.03).
- `a = F / masa`; `v = (v + a) · (1 − friction) + szarpnięcie`, friction 0.03–0.2.
- **Szarpnięcie** (losowe, każda oś): amplituda `temperature + agitation · e`
  (temperature 0–0.2, agitation 0–0.4) – im więcej energii, tym szybciej foton się porusza.
- Limit prędkości 4 px/krok, zawijanie torusa, energia przycinana do 0–1.

## Światło

`L(x) = min(1.5, ambient + Σ exp(−d²/(2s²))) · dzień`, siatka 32 px (w 3D sześciany).
ambient 0–0.3, 0–3 słońc o promieniu (0.1–0.4) · bok świata, dryf 0–0.3 px/krok,
`dzień = 0.5 + 0.5 · sin(2π · krok / okres)` gdy okres ≥ 500.

## 2D i 3D

Te same wzory; w 3D świat to sześcian zawijany na wszystkich ścianach
(bok = ∛(liczba · 4500) px, w 2D pole = liczba · 220 px²). 3D jest domyślne.

## Backend GPU

Te same wzory w WebGPU (jeden wątek na foton). Różnice: siły zbierane od sąsiadów (bez
atomowych dodawań), prawdziwy `sin`, wiązania przez wzajemne propozycje (najwyżej jedno nowe
na foton na krok), losowość z funkcji skrótu (symetryczna dla obu końców wiązania), energia
liczona z początku kroku, twarda granica w 5 przejściach równoległych. Przebieg nie jest
powtarzalny co do bitu; statystyki zgodne z CPU (`tools/gpu-check.html`).

## Determinizm

Fizyka na CPU używa tylko `EM.Rng` (mulberry32): prawa z `lawsSeed`, pozycje i szum z
`worldSeed`. Nowe parametry dopisywać na **końcu** `SPECS` w `genome.js`.

## Plan (pomysły do dalszych kroków)

- **Kąty wiązań** – nie na sztywno: dozwolony zakres kąta zależny od szybkości/energii
  (szybki foton trudniej złapać → szerszy dozwolony kąt).
- **Moc wiązania** zależna od stanu fotonów.
- **Wymiana właściwości przez wiązanie** (ładunek, masa, energia) zamiast rozszczepiania i fuzji.
- **Siła słaba** – zmiany ładunku.
- Edytor fotonu (formuły jak w Gravitation) i filtry podglądu (rozmiar, kolor).
