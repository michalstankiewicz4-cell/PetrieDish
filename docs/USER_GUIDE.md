# Instrukcja obsługi – Petrie Dish

Petrie Dish to symulacja cząstek w „płynie”. Każdy kolor (gatunek) ma własną masę,
ładunek, zasięg i siłę wiru. Gatunki przyciągają się lub odpychają według macierzy
oddziaływań. Z tych prostych reguł wyłaniają się kolonie, roje, wiry i „organizmy”.

Uruchomienie: https://michalstankiewicz4-cell.github.io/PetrieDish/ albo dwuklik na
`index.html` (nie trzeba serwera). Aktualna wersja jest w tytule karty przeglądarki.

---

## 1. Ekran główny

| Element | Gdzie | Działanie |
| --- | --- | --- |
| **🎲 Random Sample** | góra, środek | losuje nową próbkę (seed) i od razu uruchamia symulację |
| **❤️** | góra, obok | tryb „Donate” – cząstki układają się w napis; drugi klik wyłącza |
| **HUD** | lewy górny róg | `Seed: …` i licznik `Render: X \| Physics: Y` (klatki i kroki fizyki na sekundę; kropka: zielona > 23, żółta 17–23, czerwona ≤ 16) |
| **Life Scanner** | prawy górny róg | wykrywanie „form życia” (rozdział 5) |
| **☰ lewy** | lewy dolny róg | panel **Settings** |
| **☰ prawy** | prawy dolny róg | panel **Mechanics** |
| **✨ VISUAL FX** | dół, środek | panel efektów wizualnych (rozdział 6) |

### Mysz na planszy

- **Lewy przycisk (przytrzymaj)** – przyciąga cząstki w promieniu 100 px (widać okrąg).
- **Prawy przycisk** – dodaje *inteligentną cząstkę* (tylko gdy włączone Intelligent Life).

Panele zamykają się po kliknięciu obok, chyba że zaznaczysz **Lock** w ich nagłówku.
Otwarcie jednego panelu zamyka drugi (jeśli nie jest zablokowany).

---

## 2. Panel Settings (lewy)

### Przyciski
- **▶️ Start / ⏹️ Stop** – uruchamia / zatrzymuje. Stop zapamiętuje prędkość, Start ją przywraca.
- **🔄 Reset** – nowe cząstki z bieżącymi ustawieniami (mechaniki, kolory, macierz zostają).
- **🎲 Random sample** – jak przycisk na górze, ale nie uruchamia zatrzymanej symulacji.

### Próbki (Sample)
- Lista **Sample** – nazwane próbki (lista do uzupełnienia) i **Custom sample…**:
  wpisz dowolną liczbę całkowitą i **📥 Load Sample** (albo Enter).
- Ta sama liczba zawsze daje ten sam zestaw: włączone mechaniki, liczbę cząstek
  i gatunków, lepkość, wir, masy/ładunki/zasięgi kolorów i macierz oddziaływań.
- **Current:** pokazuje wczytaną próbkę („Default” = ręcznie dobrany zestaw startowy).
- Random Sample w 15% przypadków wybiera Default, w 85% losowy numer.

### Świat
- **Particle starter** – jak rozmieścić cząstki przy Reset:
  *Random* (losowo), *Big Bang* (wszystkie w środku), *Mass Gradient* (pionowe pasy,
  najcięższe kolory z lewej).
- **Boundaries** – krawędzie: *Warp* (wyjście z jednej strony = wejście z drugiej),
  *Wall* (odbicie, traci 20% prędkości), *Endless* (cząstki za krawędzią znikają).
- **Width / Height** + Enter – rozmiar planszy (200–5000 × 150–5000). Zmiana rozmiaru
  okna dopasowuje planszę automatycznie.
- **Particle count** (75–3000) i **Species count** (1–15) – działają po **✅ Apply** / Reset.

### Czas
- **Speed** (0–200%) – mnożnik kroku ruchu. 0% = zamrożenie (cząstki widoczne, fizyka stoi).
  Uwaga: to nie jest zwolnienie czasu (zob. `docs/KNOWN_ISSUES.md`, KI-04).
- **⚡ FPS Booster** – prawdziwe zwolnienie czasu: w prawo = mniej kroków fizyki na
  klatkę (1.00x → 0.001x). Odciąża procesor przy dużej liczbie cząstek.

### Wyświetlanie (zapamiętywane w przeglądarce)
- Show FPS counter, Show seed number, Show Life Scanner,
  Auto-hide buttons (chowa przyciski po 2 s bez ruchu myszy, nie gdy panel jest otwarty).

---

## 3. Panel Mechanics (prawy)

Każda mechanika ma checkbox; po włączeniu pokazują się jej suwaki.
Znak **?** przy nazwie pokazuje krótki opis.

### 🔗 Dependencies (oddziaływania)
| Mechanika | Co robi | Suwaki |
| --- | --- | --- |
| **Color attraction/repulsion** | siła między kolorami z macierzy (+ przyciąga, − odpycha), słabnie z odległością | Strength 0–200% · **📊 Edit Interaction Matrix** · **🎨 View Color Properties** |
| **Magnetic charges (+/−)** | jednoimienne się odpychają, różnoimienne przyciągają | Force 0–200% |
| **Different masses** | lżejsze cząstki poruszają się szybciej | Effect 0–200% |
| **Mass Transfer** | przy zetknięciu (< 5 px) masy się wyrównują; w trybie Wall odbicie zabiera 5% masy; Reset przywraca masy startowe | Transfer Rate |
| **Mass Hierarchy** | czarne stają się trochę cięższe od najcięższego koloru, białe lżejsze od najlżejszego (razem z Transfer czarne i białe nie wymieniają masy) | Strength (wielkość różnicy) |
| **Color mixing** | przy zetknięciu (< 8 px) kolory się mieszają – **tylko wizualnie** | Blend Rate |
| **Vortex** | siła wirowa (do 80 px), kierunek zależy od wiru kolorów | Vorticness |
| **🚀 Initial Speed** | każdy kolor startuje z własną prędkością (0–2) | Edit Initial Speeds |

### ⚙️ Properties (edytory per kolor, działają od razu)
- **Initial Speed**, **Mass** (0.3–2.0), **Charge** (−1…+1), **Interaction Range** (10–200 px).
- W każdym oknie: suwak na kolor + **Randomize** / **Gradient** (lub All 0.0 / All 1.0).

### 🌍 Environment
- **Swarm** – cząstki tego samego koloru ciągną do środka swojej grupy. Strength, Range.
- **💧 Viscosity** – opór przestrzeni: 0.90 energicznie, 0.98 płynnie, 0.99 „pod wodą”.
  Wyłączona = brak tarcia (prędkości szybko dochodzą do maksimum).

### 🧪 Experimental
- **🧠 Intelligent Life** – prawy klik dodaje cząstkę, która co krok symuluje swój ruch
  *Future Frames* kroków do przodu i odpycha się od własnej przyszłości.
  *Show Future Ghost* rysuje przewidywaną pozycję. Wyłączenie usuwa te cząstki.
- **🔗 Molecular Bonds** – cząstki RÓŻNYCH kolorów, które przez *Formation Time* sekund
  trzymają stałą odległość (< *Max Distance*), łączą się na stałe wiązaniem o długości
  *Bond Length*. Każda cząstka ma *Max Bonds* „slotów” rozłożonych dookoła.
  Wymaga sporo obliczeń – próbki go nigdy nie włączają.

### Macierz oddziaływań
Wiersz = kolor, który odczuwa siłę (FROM), kolumna = kolor, który ją wywołuje (TO).
Wartości −1.0 … +1.0. Macierz nie musi być symetryczna – czerwony może gonić
zielonego, który przed nim ucieka. Przyciski: **Randomize**, **Gradient →**
(od +1 w lewym górnym do −1 w prawym dolnym), **Gradient ↓** (kolumny od +1 do −1).

---

## 4. Typowe zastosowania

- **Szukanie ciekawych układów:** klikaj 🎲, a gdy coś się spodoba – zanotuj numer z HUD.
- **Własny eksperyment:** wczytaj próbkę → zmień macierz / masy → **Reset**.
- **Wolny komputer:** zmniejsz Particle count albo przesuń FPS Booster w prawo;
  efekty Neon Glow i długie smugi są najcięższe.

---

## 5. Life Scanner

Klik w nagłówek lub przełącznik włącza wykrywanie. Skaner szuka skupisk cząstek,
które są blisko siebie i poruszają się podobnie, i obrysowuje je ramką
`Life #N | X particles | Y speed`. Licznik **DETECTED** pokazuje liczbę form.

| Zakres | Znaczenie |
| --- | --- |
| PARTICLES RANGE (3–100) | ile cząstek musi mieć skupisko |
| COLORS RANGE (1–16) | ile różnych kolorów w skupisku |
| DISTANCE RANGE (5–100 px) | odległość między sąsiadami w skupisku |
| VELOCITY RANGE (1–10) | różnica prędkości sąsiadów |

Suwak „od” nie może przekroczyć „do” (i odwrotnie).

---

## 6. Visual FX

| Grupa | Opcje |
| --- | --- |
| Background | Dark, White, Deep Space, Matrix |
| Trails | Sharp (bez smug), Trails, Long Trails, Ghost |
| Particle style | Circle, Stars, Rings, Neon Glow |
| Overlay | None, Scanlines, Vignette, Rainbow Tint |
| Filter | None, B&W, Sepia, Invert (HUD nie jest filtrowany) |
| Presets | Microscope, Neon City, Deep Void, Reset All |

Efekty nie zmieniają fizyki – tylko wygląd.

---

## 7. Co jest zapamiętywane

W `localStorage` przeglądarki: FPS Booster, Show FPS, Show seed, Show Life Scanner,
Auto-hide. Ustawienia symulacji (mechaniki, macierz) **nie** są zapamiętywane –
do odtworzenia układu służy numer próbki.
