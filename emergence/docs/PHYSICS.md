# Fizyka – wzory (v0.1)

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

## Determinizm

Cała fizyka używa `EM.Rng` (mulberry32): genom z `lawsSeed`, pozycje/szum z
`worldSeed`. `Math.random` tylko w UI (nowe ziarna) i Labie (wybór kandydatów).
Kolejność losowań w `genome.random` = kolejność list SPECS – nowe parametry
dopisywać na końcu list.
