# Mechaniki – jak dokładnie działają

Opis odpowiada kodowi w `js/sim/` w wersji z `CHANGELOG.md`. Oznaczenia:
`p` – cząstka liczona, `o` – sąsiad, `d` – odległość, `(dx, dy)` – wektor p → o
(przez krawędź tylko w trybie Warp), `v` – prędkość.

## Kolejność w jednym kroku (`Particle.update`)

1. Lepkość: `v *= viscosity` (gdy włączona).
2. Mysz: gdy wciśnięta i `d < 100`: `v += kierunek * (1 − d/100) * 0.6`.
3. Rój (Swarm).
4. Siły parami dla sąsiadów z `0 < d < zasięg p` (zasięg = `interactionRange` koloru p):
   przyciąganie, ładunki, wir, mieszanie, transfer masy.
5. Ruch: `krok = v * k * speed`, gdzie `k = 2 / masa * massEffect` (Mass włączona) albo `k = 2`;
   długość kroku ograniczona do 8 px (`MAX_STEP_PX`), żeby nie przeskakiwać zderzeń.
6. Granice (Warp / Wall / Endless).
7. Limit prędkości: `|v| ≤ 3`.

Zasięg jest jednostronny: p czuje o, gdy o jest w zasięgu p – niezależnie od zasięgu o.

## Siły

| Mechanika | Wzór (dodawane do `v` cząstki p) | Parametry (suwak → stan) |
| --- | --- | --- |
| Attraction | `(dx,dy)/d * matrix[p][o] * 0.5 * strength / d` | Strength 0–200% → 0–2 |
| Charges | `(dx,dy)/d * (q_p * q_o) * −0.3 * force / d` | Force 0–200% → 0–2 |
| Vortex (gdy `d < 80`) | `(−dy, dx)/d * avg(vort_p, vort_o) * vorticness * 0.3 * (1 − d/80)` | Vorticness 0–100% → 0–0.05 |
| Swarm | `kierunek do średniego przesunięcia ku sąsiadom tego samego koloru (d < range) * swarmStrength` | Strength 0–100% → 0–0.1, Range 50–200 px |
| Mouse | j.w. | stałe: zasięg 100 px, siła 0.6 |

Siły są typu `1/d` bez „twardego rdzenia” – przy bardzo małym `d` są duże, ale
ogranicza je limit prędkości 3. Macierz nie musi być symetryczna, więc pęd nie jest
zachowany – stąd samonapędzające się struktury.

## Masa

- **Mass**: masa skaluje tylko krok ruchu (`k = 2/m`), nie siły. Masa 0.5 → ruch 2× szybszy niż 1.0.
- **Mass Transfer** (`d < 5`): `t = (m_p − m_o) * transferRate`; `m_p −= t`, `m_o += t`,
  zakres 0.3–2.0. Zmienia tylko masę cząstki (`_mass`); masa gatunku zostaje, więc Reset
  przywraca masy startowe. Przy włączonej Mass Hierarchy czarne i białe nie biorą
  udziału w wymianie. W trybie Wall każde odbicie: `m *= 0.95` (min 0.3). Rate 0–100% → 0–0.01.
- **Mass Hierarchy** (raz na klatkę, gdy ≥ 2 gatunki): czarne = `min(2, max_innych + 0.1*strength)`,
  białe = `max(0.3, min_innych − 0.1*strength)`. Strength 0–200% → 0–2.

## Kolor

- **Color mixing** (`d < 8`, szansa 2% na parę i krok): `hex_p = hex_p*(1−blend) + hex_o*blend`.
  Cząstka dostaje własną kopię `colorData` z nowym `hex`. Zmienia się tylko kolor
  rysowania – gatunek (`p.species`), masa i reszta fizyki zostają; edytory per kolor
  nadal działają na zmieszane cząstki.
  Blend Rate 0–100% → 0–0.1.
- **Initial Speed**: przy spawnie `v = losowy[−1,1] * initialSpeed koloru` (bez mechaniki: 1.0).

## Wiązania (Molecular Bonds)

- Kandydat: para RÓŻNYCH kolorów, `d < maxDistance`, obie mają wolne miejsce.
- Licznik rośnie co krok, jeśli `|d − d_poprzednie| < 1 px`; inaczej zeruje się.
- Po `formationTime * 60` krokach powstaje wiązanie, jeśli kierunek trafia w wolny
  „slot” kątowy obu cząstek (`maxPerParticle` slotów po `360°/max`). Slot jest
  zajmowany dopiero, gdy wolne są oba końce.
- Gdy cząstka znika (Endless, wyłączenie Intelligent Life), jej wiązania są usuwane,
  a slot na drugim końcu zwalniany.
- Więzy: co krok obie cząstki przesuwane po połowie różnicy `d − length`
  (bez względu na masę, bez zmiany prędkości).

## Intelligent Life

Co krok: normalny `update`, potem symulacja `futureFrames` kroków do przodu
(tylko lepkość, przyciąganie, masa, granice – na zamrożonych sąsiadach).
Jeśli przewidywana pozycja jest bliżej niż 30 px: `v −= kierunek_do_przyszłości * (1 − d/30) * 0.8`.
Kolor unikalny (złoty kąt HSL zapisany jako hex), masa 1, zasięg 50, ładunek 0; brak wiersza
w macierzy = neutralna dla przyciągania.

## Life Scanner

Co 3. krok: BFS po sąsiadach (siatka), krawędź gdy `distFrom ≤ d ≤ distTo` i
`speedFrom ≤ |v_p − v_o| ≤ speedTo`. Skupisko jest „życiem”, gdy liczba cząstek
i liczba kolorów mieszczą się w zakresach. Tylko obserwacja – nie zmienia fizyki.

## Czas

- **Speed**: mnoży tylko krok ruchu (siły działają co krok tak samo).
- **FPS Booster**: `timescale = 1 − slider/100 * 0.999`; akumulator wykonuje
  `floor(akumulator)` kroków na klatkę (maks. 2). To jest prawdziwe zwolnienie czasu.

## Granice

- **Warp**: `x = (x + W) % W` (torus). Siły, rój, mysz, wiązania i Life Scanner liczą
  odległość przez krawędź.
- **Wall**: poza ekranem → odbicie `v *= −0.8`, pozycja przycięta. Nic nie działa przez ścianę.
- **Endless**: dalej niż 50 px za krawędzią → cząstka usuwana na koniec klatki.

## Seed → ustawienia

`PD.seed.generate(n)` losuje kolejno: 9 mechanik (bool), tryb granic, tryb startu,
liczbę cząstek (75–3000), gatunków (1–15), prędkość, lepkość (0.90–0.99),
wir (0–5), potem dla każdego koloru: ładunek ±1, masę 0.5–1.5, zasięg 30–150,
wir 0–1, prędkość startową 0.2–1.5 (ładunek / masa / wir / prędkość tylko gdy dana
mechanika jest włączona – inaczej 0 / 1 / 0 / 1, bez losowania), na końcu macierz (−0.6…0.6; biały–biały
odpychanie, czarny–czarny przyciąganie). Loader ignoruje wylosowany tryb granic
i prędkość (zawsze Warp, 100%). Molecular Bonds nigdy nie są włączane z seeda.
