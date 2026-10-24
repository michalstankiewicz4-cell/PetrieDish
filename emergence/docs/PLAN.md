# Emergence – plan

Cel: świat 2D, w którym z prostych „fotonów” same wyłaniają się kolejne poziomy
organizacji – atomy → molekuły → błony/komórki → organizmy wielokomórkowe – bez
programowania któregokolwiek z tych poziomów. Uczenie maszynowe szuka **praw**,
przy których to się dzieje, ale nie dotyka samej symulacji.

Źródła: siła z pierścieniami, rozszczepianie/łączenie i detektor jąder z
**Gravitation**; pole substancji/światła i adhezja z **CellsEvolution**; struktura
modułów, wersjonowanie i test regresji z **PetrieDish**.

---

## 1. Zasady (twarde)

1. **W dynamice nie ma pojęć wyższego poziomu.** Kod w `js/physics/` zna tylko
   fotony, ich typy, orientację, energię i wiązania. Słowa „atom”, „molekuła”,
   „komórka”, „organizm” mogą pojawić się wyłącznie w `js/observe/` (detektory).
2. **Obserwatorzy tylko czytają.** Żaden detektor nie zmienia stanu świata.
3. **ML zmienia tylko prawa (`Laws`), nigdy stanu cząstek.** Po wybraniu praw
   symulacja biegnie sama.
4. **Nagroda bez wskazywania kształtu.** Liczymy trwałość, różnorodność, liczbę
   poziomów i **nowość** – nigdy „podobieństwo do komórki”.
5. **Zachowanie materii.** Fotony nie powstają i nie znikają; mogą zmieniać typ,
   łączyć się wiązaniami i rozłączać.
6. **Przepływ energii.** Świat jest zasilany (światło) i rozprasza energię (tarcie,
   wyciek). Bez tego wszystko zastyga.
7. **Determinizm.** Ten sam numer praw + ten sam numer świata = ten sam przebieg
   (własny generator losowy, nie `Math.random`).

## 2. Fizyka – składniki (to jest „wszechświat”)

| Składnik | Co daje | Parametry w `Laws` |
| --- | --- | --- |
| **Typy fotonów** (4–6) | różne „pierwiastki” | masa, walencja (0–4), pochłanianie światła, wyciek energii, napęd |
| **Siła z pierścieniami** (jak Gravitation) | stałe odległości, orbity, powłoki | macierze typ×typ: amplituda, zasięg, liczba okresów, faza (asymetryczne) |
| **Twardy rdzeń** | brak nakładania się | stały promień i siła |
| **Orientacja (biegunowość)** | „głowa/ogon” → samoskładające się błony | wpływ kierunku na siłę, moment obrotowy |
| **Wiązania** | molekuły, łańcuchy, pierścienie | czy para może się wiązać, prawdopodobieństwo, energia aktywacji, długość, sztywność, rozpad |
| **Energia wewnętrzna** | metabolizm, magazynowanie energii | pochłanianie, wyciek, przepływ wzdłuż wiązań |
| **Światło** (pole jak siatka substancji w CellsEvolution) | zasilanie, gradienty, cykl dnia | słońca (liczba, rozmiar, dryf), tło, okres dnia |
| **Reakcje** (zmiana typu) | chemia, przenoszenie informacji | tabela: typ A związany z B przy energii ≥ próg → A staje się C |
| **Napęd** | aktywna materia, ruch kierowany | typ z energią pcha się wzdłuż swojej orientacji |
| **Temperatura i tarcie** | szum, rozpraszanie | globalne |

Wszystkie parametry generuje ziarno praw (`lawsSeed`) jako „genom praw” (`js/core/genome.js`). Wzory: `docs/PHYSICS.md`.

## 3. Obserwatorzy (detektory, tylko odczyt)

| Poziom | Detektor | Miara |
| --- | --- | --- |
| Molekuła | składowe spójne grafu wiązań | podpis (skład + liczba wiązań) → rejestr gatunków jak „Elements” w Gravitation |
| Trwałość | wiek wiązań | średni czas życia wiązań |
| Różnorodność | rejestr | liczba różnych gatunków obecnych w ≥ 2 kopiach |
| Błona/komórka | zamknięte puste obszary otoczone związaną materią | liczba „zamknięć”, ich pole i trwałość |
| (dalej) Organizm | skupiska zamknięć, które trwają i poruszają się razem | liczba poziomów zagnieżdżenia |

## 4. Laboratorium ML

- **Pętla zewnętrzna:** novelty search (z elementami MAP-Elites) po przestrzeni praw.
  Kandydat = ziarno praw albo mutacja praw z archiwum.
- **Ocena kandydata:** krótki przebieg bez rysowania (Web Worker), a z jego drugiej
  połowy uśredniony **deskryptor**: udział związanych fotonów, różnorodność
  molekuł, największa molekuła, trwałość wiązań, liczba zamknięć, ruchliwość.
- **Wynik:** nowość (odległość od k najbliższych w archiwum) × żywotność (nie „gaz”
  bez wiązań i nie „jedna bryła”). Brak nagrody za konkretny kształt.
- **Wyniki** trafiają do listy w panelu Lab: podgląd liczb, „Load” (uruchamia ten
  wszechświat w pełnej skali), eksport JSON.

## 5. Etapy

| Etap | Co ma się wyłonić | Miara sukcesu | Status |
| --- | --- | --- | --- |
| **M0** | silnik: tysiące fotonów, wiązania, energia, światło | ≥ 5 000 fotonów płynnie (CPU) | v0.1 |
| **M1** | trwałe, różnorodne molekuły | ≥ 5 gatunków, średni wiek wiązań ≫ czas zderzenia | v0.1 (detektor), szukane w Lab |
| **M2** | błony i pęcherzyki | zamknięcia trwające ≥ kilka tysięcy kroków | v0.1 (detektor), szukane w Lab |
| **M3** | metabolizm | struktury pochłaniające światło trwają dłużej niż w ciemności | plan |
| **M4** | samopowielanie | rosnąca liczba kopii tego samego gatunku/kształtu | plan |
| **M5** | dziedziczenie ze zmiennością | drzewo potomków, ewolucja w środku symulacji | plan |
| **M6** | wielokomórkowość | zamknięcia trzymające się razem i różnicujące | plan |

Kolejne etapy dodają **miary** (obserwatorów) i rozszerzają **przestrzeń praw**,
a nie wpisują zachowań. Etap uznajemy za osiągnięty, gdy Lab znajduje prawa
spełniające miarę, a efekt widać w pełnej symulacji.

## 6. Architektura

- **Dane SoA** (osobne `Float32Array`/`Int32Array` na x, y, vx, vy, typ,
  orientację, energię, wiązania) – szybkie na CPU i gotowe do przeniesienia na
  WebGPU (te same bufory).
- **Siatka przestrzenna** przez sortowanie przez zliczanie (bez alokacji co klatkę),
  pary odwiedzane raz („half-shell”).
- **Sinus z tablicy** zamiast `Math.sin()` dla każdej pary.
- **Świat toroidalny** (bez ścian) – brak efektów brzegowych.
- **Ten sam kod fizyki** działa w oknie i w Web Workerze (`self.EM`, zero DOM w
  `physics/` i `observe/`).
- Bez kroku budowania: zwykłe `<script defer>`, działa z `file://` (Lab w trybie
  awaryjnym bez workerów) i z GitHub Pages (Lab z workerami).

```
emergence/
  index.html
  css/                 base (tokeny, HUD), panels
  js/core/             config (EM, wersja), rng, genome (prawa), spatial-hash (2D), spatial-hash3 (3D)
  js/physics/          light, bonds, forces (2D), forces3d, reactions, world (2D/3D)
  js/observe/          structures (odcisk kształtu), catalog, enclosures, observer
  js/lab/              runner (bez okna), search (novelty), pool, lab, worker
  js/gpu/              kernels (WGSL), gpu-world (WebGPU, lustro stanu w World)
  js/render/           camera (2D), mat4, renderer2d (Canvas, kulki), renderer3d (WebGL2, kulki), tiles
  js/app/              setup, controller, loop
  js/ui/               dom, world-panel, observe-panel, lab-panel, input, atlas (Tab: pierwiastki + ML)
  js/main.js
  docs/                PLAN, PHYSICS
  tools/smoke.js       test: determinizm, zachowanie materii, brak NaN, wydajność
  tools/gpu-check.html porównanie GPU z CPU
  CONTEXT.md, CHANGELOG.md, README.md
```

## 7. Wersjonowanie

Osobne od PetrieDish, SemVer od `0.x` (prototyp): `MINOR` = nowy etap albo zmiana
fizyki (te same ziarna dają inny świat), `PATCH` = poprawki bez zmiany wyników.
Zmiana generatora praw = nowy `MINOR` w 0.x, a od 1.0 = `MAJOR`. Wersja w tytule
karty, `CHANGELOG.md`, `CONTEXT.md`.

## 8. Ryzyka

- **Moc obliczeniowa:** na CPU ~5–10 tys. fotonów w czasie rzeczywistym; ewolucja
  (M4+) może wymagać WebGPU i długich przebiegów.
- **Przestrzeń praw jest ogromna:** większość wszechświatów to „gaz” albo „bryła”.
  Dlatego Lab, nowość i żywotność.
- **M5–M6 to otwarty problem badawczy** – cel eksperymentu, nie obietnica.
- **3D** (od v0.2) liczy się na CPU: ~2 tys. fotonów płynnie; od v0.3 backend
  WebGPU pozwala na setki tysięcy (bez powtarzalności co do bitu). Emergencja w 3D jest trudniejsza:
  błona to powierzchnia, potrzeba więcej fotonów na strukturę.
