# Changelog – Emergence

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje SemVer
(zasady w `CONTEXT.md`). Wersja aplikacji: `EM.VERSION` w `js/core/config.js`.

## [Unreleased]

## [0.8.0] – 2026-10-25
### Dodane
- **Edytor fotonu** (górny pasek → Photon, klawisz `E`, prawy panel zamiast Observe):
  - podgląd fotonu: pięć ładunków z kolorem, masą, udziałem na starcie i liczbą dozwolonych
    wiązań przy wybranej energii (suwak *Preview energy*), promień i najbliższa odległość;
  - wykres sił między dwoma fotonami (+1/−1, +1/+1, 0/+1, +2/−2) z zaznaczoną twardą granicą,
    strefą tworzenia wiązań i miejscem pękania;
  - wszystkie prawa jako suwaki w grupach (Photon, Strong, Electromagnetic, Environment,
    Energy, Light) z opisami; zmienione względem ziarna są podświetlone.
  - Większość praw działa **na żywo**; skład ładunków, zasięg R i słońca (↻) – po restarcie
    (pasek „Restart now”). Eksport, powrót do praw z ziarna.
### Poprawione
- **Restart i nowe prawa nie oddalają już kamery** (gdy rozmiar świata się nie zmienia) –
  wcześniej po restarcie liczby na kulkach znikały, bo widok wracał do całego świata.

## [0.7.0] – 2026-10-25
Nowa fizyka: model fotonów. **Stare ziarna praw i archiwum Labu nie pasują** – poprzednia
wersja zostaje pod `v0.6/` (link w menu Help).
### Zmienione
- **Wszystkie fotony to ta sama cząstka o tym samym promieniu (3 px).** Różnią się stanem:
  ładunek −2…+2 (kolor), masa zależna od ładunku, energia. Koniec typów z osobnymi prawami,
  orientacji i reakcji (wrócą jako siła słaba).
- **Twarda granica**: środki fotonów nigdy bliżej niż `dmin`, zależne od **ciśnienia**
  (przy 1 kulki stykają się powierzchniami). Suwak Pressure działa na żywo.
- **Siła elektromagnetyczna** jak w Gravitation: fala z `periods`, `waveOffset`, `phaseShift`,
  przeciwne ładunki się przyciągają, jednakowe odpychają.
- **Siła silna**: krótkie, nasycające się wiązania na styk; walencja to prawo wspólne dla
  wszystkich i **maleje z energią** (gorący foton zrzuca wiązania).
- **Energia przyspiesza**: losowe szarpnięcia rosną z energią (`agitation`).
- **3D domyślne** (2D zostaje jako szybszy podgląd).
- Lab: nowe archiwa (`emergence.lab.v2`, `.3d.v2`). Genom format 2 – pliki z v0.6 są odrzucane z informacją.
### Dodane
- **Liczba na kulce** = ile wiązań silnych foton może jeszcze przyjąć (View → *Free bonds on photons*;
  widać po przybliżeniu, w 2D i 3D).
- Kolor „by charge”, inspektor pokazuje ładunek i masę.
- GPU: te same prawa (fala z offsetem, twarda granica w 5 przejściach, walencja zależna od energii).
- `tools/smoke.js` sprawdza twardą granicę; `tools/gpu-check.html` porównuje nowy model CPU/GPU.

## [0.6.0] – 2026-10-24
### Dodane
- **Górny pasek = menu główne projektu** (na całą szerokość):
  logo i wersja; sekcje **World**, **Observe** (panele boczne), **Elements**
  (tablica Mendelejewa), **Machine learning** (podgląd Labu) z zaznaczeniem, co jest otwarte;
  szybkie przyciski play/pauza, fast forward, nowe prawa, przełączniki **2D/3D** i **CPU/GPU**;
  statystyki na żywo; menu **Help** ze skrótami klawiszy i linkami do dokumentacji,
  zmian, repozytorium i PetrieDish. Na wąskich ekranach same ikony.
### Zmienione
- Pasek zastępuje dawny napis HUD, przyciski „☰ World / Observe ☰” i przycisk „Elements & ML”.
  Atlas (Tab) otwiera się pod paskiem, więc menu jest zawsze widoczne.

## [0.5.0] – 2026-10-24
### Dodane
- **Atlas** (klawisz `Tab` albo przycisk „Elements & ML”): pełnoekranowy widok z dwiema kartami.
- **Tablica Mendelejewa** (118 pierwiastków, prawdziwy układ z lantanowcami i aktynowcami):
  stabilna struktura z Z fotonów = atom pierwiastka Z, wolny foton = H, różne kształty
  o tym samym Z = izotopy. Pole przygasłe = jeszcze nie było, obrysowane = odkryte,
  świecące = jest teraz (jasność od liczby kopii), błysk przy nowym odkryciu.
  Szczegóły pierwiastka: liczba teraz, izotopy (kafelki kształtów), krok odkrycia,
  „Show in the world” podświetla wszystkie jego atomy.
- **Podgląd uczenia maszynowego**: liczniki, krzywa uczenia (wynik każdego wszechświata,
  najlepszy dotąd, liczba pierwiastków), mapa przetestowanych wszechświatów (klik = wczytaj),
  mini-tablica pierwiastków, które Lab już wytworzył, najlepsze wszechświaty z listą pierwiastków.
- Obserwator liczy `elements` (różne Z obecne teraz), Lab zapisuje pierwiastki każdego testu
  i historię ocen.
### Zmienione
- **Lab nagradza pierwiastki**: nowa cecha nowości (liczba różnych Z) i premia
  `0.3 · log(1 + pierwiastki) / log(41)` w ocenie. Stare wyniki w archiwum zostają.
- Fizyka bez zmian (przebiegi identyczne z 0.4.0).

## [0.4.0] – 2026-10-23
### Dodane
- **Fast forward** (przycisk w panelu Time, klawisz `T`): fizyka liczy się tak szybko,
  jak się da, bez rysowania, aż do Stop (przycisk na ekranie, `T`, `Esc` albo spacja).
  Na ekranie: numer kroku, ile kroków przybyło i kroki/s. Obserwatorzy i katalog
  działają dalej w zwykłym rytmie. Działa na CPU i GPU, w 2D i 3D.
### Zmienione
- Fizyka bez zmian (te same przebiegi co w 0.3.0).

## [0.3.0] – 2026-10-23
### Dodane
- **Backend GPU (WebGPU)**: fizyka liczona na karcie graficznej – przełącznik
  Compute (CPU/GPU) w panelu World, klawisz `G`, parametr `gpu=1` w linku.
  W trybie GPU do 200 tys. fotonów (domyślnie 40 tys.), w 2D i 3D.
  Pięć shaderów obliczeniowych na krok: siatka (zliczanie, suma prefiksowa,
  rozłożenie), siły parami z propozycjami wiązań, aktualizacja (wiązania,
  reakcje, całkowanie). Stan wraca asynchronicznie do świata na CPU, więc
  rysowanie, obserwatorzy i katalog działają bez zmian.
- `tools/gpu-check.html` – porównanie GPU z CPU (siły po 3 krokach bez szumu,
  niezmienniki, statystyki po kilkuset krokach, prędkość).
### Zmienione
- Tryb CPU bez zmian (ziarna 2D i 3D dają ten sam przebieg co w 0.2.0); Lab zawsze liczy na CPU.
- W trybie GPU obserwatorzy liczą najwyżej co 400 ms (przy setkach tysięcy fotonów są drodzy).

## [0.2.0] – 2026-10-23
### Dodane
- **Świat 3D**: te same prawa w sześcianie zawijanym na wszystkich ścianach.
  Przełącznik Space (2D/3D) w panelu World, klawisz `3`, parametr `d=3` w linku.
  Siatka 3D (komórki R/2, blok 5×5×5), siły 3D, orientacja jako wektor, światło 3D,
  detektor zamknięć wolumetrycznych, kafelki katalogu w rzucie ukośnym.
- **Renderer 3D (WebGL2)**: fotony jako cieniowane kulki (impostory), wiązania,
  słońca i zamknięcia jako poświaty, mgła głębi, kamera orbitalna
  (przeciągnij = obrót, prawy przycisk = przesuwanie, kółko = zoom, auto-obrót).
- Lab ma osobne archiwa dla 2D i 3D i ocenia światy w aktualnym wymiarze.
### Zmienione
- 2D: fotony rysowane jako cieniowane kulki zamiast kwadratów, rozmiar skaluje się z zoomem.
- Wydajność 3D na CPU: ~2 tys. fotonów płynnie (domyślnie w 3D).
- Fizyka 2D bez zmian – ziarna 2D dają identyczny przebieg jak w 0.1.0.

## [0.1.0] – 2026-10-23
Pierwszy prototyp (etap M0 + detektory M1/M2).
### Dodane
- Plan projektu (`docs/PLAN.md`) i wzory fizyki (`docs/PHYSICS.md`).
- Genom praw z ziarna: siła z pierścieniami (jak Gravitation), twardy rdzeń,
  orientacja (biegunowość, moment), wiązania z energią aktywacji i rozpadem,
  energia wewnętrzna, światło (słońca, dzień/noc), reakcje zmieniające typ, napęd.
  Mutacja i eksport/import JSON.
- Silnik: fotony w typed arrays, siatka przez sortowanie przez zliczanie,
  stencil „half-shell”, sinus z tablicy; świat toroidalny; pełny determinizm.
- Obserwatorzy: struktury (graf wiązań, odcisk Weisfeiler-Lehman), katalog
  stabilnych struktur z nazwami, detektor zamknięć (błony/pęcherzyki), metryki
  i historia.
- Lab: novelty search po prawach, ocena w Web Workerach (lub w stronie z `file://`),
  archiwum w localStorage, lista najlepszych z „Load” i eksportem.
- UI: panele World / Observe / Lab, wykres historii, kafelki katalogu, inspektor
  fotonu, zoom/przesuwanie, link z ziarnem praw (`#laws=…&types=…&n=…&world=…`).
- `tools/smoke.js` – determinizm, zachowanie materii, spójność wiązań, brak NaN, wydajność.
