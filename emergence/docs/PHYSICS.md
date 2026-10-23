# Fizyka – wzory (v0.3)

Tylko to, co jest w `js/physics/`. Oznaczenia: `i`, `j` – fotony, `d` – odległość
(przez krawędź torusa), `n = (dx, dy) / d` – kierunek i → j, `p = typ_i · T + typ_j`.
Jednostki: piksele i kroki symulacji. Wszystkie parametry pochodzą z genomu praw
(`js/core/genome.js`), zakresy w nawiasach to zakresy losowania.

## Krok symulacji (`World.step`)

1. Siatka przestrzenna (sortowanie przez zliczanie, komórka ≥ R).
2. Kierunki `h_i = (cos θ_i, sin θ_i)` (gdy prawa mają orientację).
3. Światło: dryf słońc, co 10 kroków nowe pole.
4. Siły parami + kandydaci do wiązań (`forces.js`).
5. Sprężyny wiązań, przepływ energii, rozpad (`bonds.js`).
6. Reakcje (`reactions.js`).
7. Całkowanie (`World.integrate`).

## Siły parami (każda para raz)

| Strefa | Siła na i (dodatnia = do j) |
| --- | --- |
| `d < coreR` (3–6) | `coreK · (d / coreR − 1)` – odpychanie, coreK 0.5–2 |
| `coreR ≤ d < R` (R 20–48) | `F_ij = forceScale · amp[p] · sin(k[p] · d + phase[p]) · (1 − d/R)` |
| `d ≥ R` | 0 |

- `k[p] = 2π · waves[p] / R`, waves 0.5–3 → 0.5–3 „pierścieni” przyciągania/odpychania.
- `amp` −1…1, `phase` 0–2π, `forceScale` 0.05–0.4. Parametry są **kierunkowe**:
  `F_ij ≠ F_ji`, wymieszane przez `symmetry` (0 = całkiem jednostronne, 1 = akcja = reakcja).
- **Orientacja** (gdy |polar| ≥ 0.5 lub |torque| ≥ 0.5 dla jakiejś pary):
  - `F_ij ← F_ij · (1 + polar[p] · (h_i · n))` – „głowa” i „ogon” czują sąsiada inaczej;
  - `θ_i += torque[p] · 0.05 · (h_i × n) · (1 − d/R)` – obrót do (+) lub od (−) sąsiada.
- Sinus z tablicy 4096 wartości z interpolacją liniową.

## Wiązania

- **Powstanie** – para w odległości `< 1.25 · bondLength` próbuje, gdy:
  `affinity > 0` (wylosowane < 0.4 = nigdy się nie wiąże), obie mają wolną walencję
  (walencja typu 0–4), kwadrat prędkości względnej `≤ bindEnergy` (0.05–2),
  `e_i + e_j ≥ activation` (0 albo 0.3–1), a losowanie `< affinity · bondFormRate` (0.005–0.1).
  Energia aktywacji jest zużywana (proporcjonalnie do energii obu fotonów).
- **Sprężyna**: `F = bondK · (d − bondLength) + 0.15 · (v_j − v_i) · n`,
  `bondLength = (1.1–3) · coreR`, `bondK` 0.02–0.4.
- **Przepływ energii**: `Δ = (e_j − e_i) · energyShare · 0.5` (energyShare 0–0.2).
- **Rozpad**: `d > breakStretch · bondLength` (1.4–3) albo losowo z szansą
  `decay · (1 + e_i + e_j)` (decay 0 albo do 0.002). Przy rozpadzie każdy foton
  odzyskuje `activation / 2` energii.

## Reakcje

Dla fotonu i związanego z j (typy a, b): jeśli tabela ma reakcję `a+b → c`
(~25% par), `e_i ≥ próg` (0.2–0.9) i losowanie `< reactionRate` (0–0.05), to
i zmienia typ na c i traci `próg` energii. Najwyżej jedna reakcja na foton na krok.
Gdy nowy typ ma mniejszą walencję, nadmiarowe wiązania pękają. Liczba fotonów
się nie zmienia.

## Energia i ruch (`World.integrate`)

- `e += absorb[typ] · światło(x, y)` (absorb 0 albo 0.01–0.03), potem `e −= leak · e` (0.002–0.03).
- Przyspieszenie `a = F / masa` (masa typu 0.5–2).
- **Napęd** (typy z thrust 0.03–0.08): gdy `e > 0.05`: `a += h · thrust · e`, `e −= thrust · e / 2`.
- Obrót: `θ += suma momentów + szum · spin` (spin 0–0.2).
- `v = (v + a) · (1 − friction) + szum` (friction 0.03–0.2, szum ±temperature/2, temperature 0–0.2).
- Limit prędkości 4, zawijanie torusa. Energia przycinana do 0–1.

## Światło

`L(x, y) = min(1.5, ambient + Σ exp(−d²/(2r²))) · dzień`, siatka 32 px.
ambient 0–0.3, 0–3 słońc o promieniu (0.1–0.4) · min(W, H), dryf 0–0.3 px/krok,
`dzień = 0.5 + 0.5 · sin(2π · krok / okres)` gdy okres ≥ 500 (inaczej 1).

## 3D (od v0.2)

Te same prawa (ten sam genom) w sześcianie zawijanym na wszystkich ścianach
(3-torus). Wybór: panel World → Space albo klawisz `3`.

- **Rozmiar świata:** bok = ∛(liczba fotonów · 4500) px (w 2D: pole = liczba · 220 px²).
  W 3D jest rzadziej, bo każdy foton ma tam znacznie więcej sąsiadów w tym samym zasięgu.
- **Siatka:** komórki o boku ≥ R/2, sąsiedzi szukani w bloku 5×5×5 (62 komórki „do przodu” + własna).
- **Siły:** te same wzory z wektorem `n = (dx, dy, dz)/d` (`forces3d.js`).
- **Orientacja:** kierunek to wektor jednostkowy `h`. `polar` jak w 2D (`h · n`).
  Moment: `h += torque · 0.05 · (n − (h·n) h) · (1 − d/R)` (składowa n prostopadła do h),
  plus szum obrotowy, potem normalizacja.
- **Wiązania, energia, reakcje:** bez zmian (wiązania liczą też oś z).
- **Światło:** pole 3D (sześciany 32 px), słońca to kule gaussowskie dryfujące w 3D.
- **Zamknięcia:** woksele (~1.25 długości wiązania), flood fill przez ściany (6 sąsiadów);
  wnęka liczy się, gdy jest szczelnie otoczona związaną materią.
- **Determinizm:** świat 2D losuje dokładnie to samo co w v0.1 (dodatkowe losowania
  tylko w 3D) – ziarna 2D dają identyczny przebieg.

## Backend GPU (od v0.3)

Te same prawa i wzory, liczone w WebGPU (`js/gpu/kernels.js`, `js/gpu/gpu-world.js`)
jako „jeden wątek na foton”. Różnice względem CPU:

- **Siły zbierane, nie rozdzielane:** każdy foton sumuje siły od sąsiadów sam
  (komórki ≥ R, sąsiedztwo 3×3 albo 3×3×3), więc nie trzeba atomowych dodawań floatów.
  Prawdziwy `sin` zamiast tablicy (różnica ~1e-4).
- **Wiązania przez wzajemne propozycje:** w kroku każdy foton wybiera jednego
  kandydata (ten z najwyższą wartością skrótu pary); wiązanie powstaje, gdy dwa
  fotony wybrały siebie nawzajem. Najwyżej jedno nowe wiązanie na foton na krok.
- **Losowość z funkcji skrótu** `hash(id_niższy, id_wyższy, krok)` – oba końce
  wiązania liczą tę samą liczbę, więc decyzje o tworzeniu i rozpadzie są symetryczne.
  Parametry pary bierze się od fotonu o niższym indeksie.
- **Energia (przepływ, aktywacja, uwolnienie)** liczona z energii z początku kroku
  (równolegle, nie po kolei).
- **Reakcje:** foton zmienia typ tylko wtedy, gdy nowy typ ma walencję ≥ liczba jego
  wiązań (na CPU nadmiarowe wiązania pękają) – dlatego reakcji jest trochę mniej.
- Kolejność fotonów w komórkach zależy od atomowych operacji → przebieg na GPU
  **nie jest powtarzalny** co do bitu. CPU pozostaje wzorcem; Lab liczy na CPU.

Kontrola: `tools/gpu-check.html` (z serwera lokalnego). Po 3 krokach bez szumu
pozycje CPU i GPU różnią się o < 1e-3 px; po 400–600 krokach udział związanych
fotonów, średnia energia i liczba utworzonych wiązań różnią się o kilka procent.

## Determinizm

Cała fizyka używa `EM.Rng` (mulberry32): genom z `lawsSeed`, pozycje/szum z
`worldSeed`. `Math.random` tylko w UI (nowe ziarna) i Labie (wybór kandydatów).
Kolejność losowań w `genome.random` = kolejność list SPECS – nowe parametry
dopisywać na końcu list.
