/**
 * Language (English / Polish). The interface is written in English; in Polish
 * every text node and tooltip is translated on the fly:
 *  - DICT: exact sentences (whitespace-normalised),
 *  - PATTERNS: texts with numbers ("12 fps", "step 300 · 3D"),
 *  - EM.t(text, vars) for strings drawn on canvases, alerts and templates with
 *    numbers inside a sentence ({name} placeholders).
 * A MutationObserver translates everything the panels add or change later.
 * Texts inside <code>, inputs and [data-no-i18n] stay as they are (names of
 * formula variables are code).
 * The choice is kept in localStorage ('emergence.lang'); default = browser language.
 */
(function (EM) {
    'use strict';

    const DICT = {
        // ---------- top bar, menu, help ----------
        'World': 'Świat', 'Observe': 'Obserwacja', 'Photon': 'Foton', 'Elements': 'Pierwiastki',
        'Machine learning': 'Uczenie maszynowe', 'Help': 'Pomoc', 'Keys': 'Klawisze', 'Project': 'Projekt',
        'play / pause': 'start / pauza', 'fast forward (no drawing)': 'przewijanie (bez rysowania)',
        'periodic table & ML': 'tablica pierwiastków i ML', 'new laws / mutate': 'nowe ziarno / mutacja',
        'photon editor': 'edytor fotonu', 'fit the view': 'dopasuj widok', 'close / stop': 'zamknij / stop',
        'README – how to use': 'README – jak używać', 'Physics – all formulas': 'Fizyka – wszystkie wzory',
        'Plan – milestones M0–M6': 'Plan – etapy M0–M6', 'Changelog': 'Lista zmian',
        'GitHub repository': 'Repozytorium GitHub', 'PetrieDish (sister project)': 'PetrieDish (projekt siostrzany)',
        'Previous model v0.8 (strong + EM forces)': 'Poprzedni model v0.8 (siła silna + EM)',
        'Previous model v0.6 (photon types)': 'Poprzedni model v0.6 (typy fotonów)',
        'Emergence – photons, laws, elements': 'Emergence – fotony, prawa, pierwiastki',
        'Laws, world, time and view': 'Prawa, świat, czas i widok', 'Metrics, catalogue, Lab': 'Metryki, katalog, Lab',
        'Photon editor: properties and interactions (E)': 'Edytor fotonu: właściwości i oddziaływania (E)',
        'Periodic table (Tab)': 'Tablica pierwiastków (Tab)', 'Machine learning – search for laws': 'Uczenie maszynowe – szukanie praw',
        'Play / pause (Space)': 'Start / pauza (spacja)', 'Pause (Space)': 'Pauza (spacja)', 'Play (Space)': 'Start (spacja)',
        'Fast forward without drawing (T)': 'Przewijanie bez rysowania (T)', 'New laws (N)': 'Nowe ziarno (N)',
        'Space: 2D / 3D (3)': 'Przestrzeń: 2D / 3D (3)', 'Compute: CPU (exact) / GPU (WebGPU) (G)': 'Obliczenia: CPU (dokładne) / GPU (WebGPU) (G)',
        'Keys and links': 'Klawisze i linki', 'Language': 'Język',
        'WebGPU is not available in this browser': 'Ta przeglądarka nie ma WebGPU',
        'GPU backend needs WebGPU: ': 'Obliczenia na GPU wymagają WebGPU: ',
        // ---------- world panel ----------
        'Laws': 'Prawa', 'Seed': 'Ziarno', 'Load': 'Wczytaj', 'Pressure': 'Ciśnienie', 'Temperature': 'Temperatura',
        '🎲 New seed': '🎲 Nowe ziarno', '⚛ Formulas': '⚛ Formuły', '⤓ Export': '⤓ Eksport', '⤒ Import': '⤒ Import',
        'Randomness of rand() in the photon formulas': 'Losowość rand() w formułach fotonu',
        'Bond length: 1 = bonded photons touch, 0 = 2.5 x longer': 'Długość wiązania: 1 = związane fotony się stykają, 0 = 2,5 × dłuższe',
        'Weakens the force between photons: force x (1 − temperature)': 'Osłabia siłę między fotonami: siła × (1 − temperatura)',
        'N – same formulas, new random values': 'N – te same formuły, nowe losowe wartości',
        'E – photon formulas': 'E – formuły fotonu',
        'formulas are kept in this browser – Export to share them': 'formuły zapisują się w tej przeglądarce – Eksport, żeby się nimi podzielić',
        'from file': 'z pliku', 'from Lab': 'z Labu', 'edited': 'zmienione', 'mutated (export to keep)': 'zmutowane (eksportuj, by zachować)',
        'Space': 'Przestrzeń', '3D (cube)': '3D (sześcian)', '2D (plane)': '2D (płaszczyzna)', '3 = switch': '3 = przełącz',
        'Compute': 'Obliczenia', 'CPU (exact)': 'CPU (dokładne)', 'Photons': 'Fotony', 'Apply': 'Zastosuj',
        '↺ Restart': '↺ Restart', '⟳ New start': '⟳ Nowy start', 'Same laws, same start': 'Te same prawa, ten sam start',
        'Same laws, new start': 'Te same prawa, nowy start', 'Time': 'Czas', '❚❚ Pause': '❚❚ Pauza', '▶ Play': '▶ Start',
        '⏩ Fast forward': '⏩ Przewijanie', '■ Stop': '■ Stop', 'Steps / frame': 'Kroki / klatkę',
        'T – compute as fast as possible without drawing, until Stop': 'T – licz jak najszybciej bez rysowania, aż do Stop',
        'View': 'Widok', 'Bonds': 'Wiązania', 'Light': 'Światło', 'Auto-rotate': 'Obrót', 'Enclosures': 'Zamknięcia',
        'Free bonds on photons': 'Wolne wiązania na fotonach',
        'Number on each photon (zoom in): how many more strong bonds it may take now': 'Liczba na każdym fotonie (przybliż): ile jeszcze wiązań może przyjąć',
        'Colour': 'Kolor', 'by charge': 'wg ładunku', 'by energy': 'wg energii', 'Fit': 'Dopasuj',
        'Drag = rotate · right-drag = move · wheel = zoom · click = inspect · T = fast forward · 3 = 2D · G = GPU':
            'Przeciągnij = obrót · prawy przycisk = przesuń · kółko = zoom · klik = podgląd · T = przewijanie · 3 = 2D · G = GPU',
        'Wheel = zoom · drag = move · click = inspect · Space = pause · T = fast forward · 3 = 3D · G = GPU':
            'Kółko = zoom · przeciągnij = przesuń · klik = podgląd · spacja = pauza · T = przewijanie · 3 = 3D · G = GPU',
        '⏩ FAST FORWARD': '⏩ PRZEWIJANIE', 'drawing is off · T / Esc / Space = stop': 'rysowanie wyłączone · T / Esc / spacja = stop',
        // ---------- photon editor ----------
        '⚛ Photon formulas': '⚛ Formuły fotonu', 'like Gravitation': 'jak w Gravitation', 'Formulas': 'Formuły',
        'Every photon runs these rows top to bottom;': 'Każdy foton liczy te wiersze od góry do dołu;',
        'gives each photon its own value. A row can use the names above it. Functions: rand, abs, min, max, sqrt, pow, round, floor, ceil. Changes act live: photons keep their charge, mass and energy, everything else is recomputed.':
            'daje każdemu fotonowi własną wartość. Wiersz może używać nazw z wierszy nad nim. Funkcje: rand, abs, min, max, sqrt, pow, round, floor, ceil. Zmiany działają na żywo: fotony zachowują ładunek, masę i energię, reszta liczy się od nowa.',
        '＋ Helper variable': '＋ Zmienna pomocnicza', '⟲ Defaults': '⟲ Domyślne',
        'A helper variable later rows can use': 'Zmienna pomocnicza dla dalszych wierszy',
        "Gravitation's formulas and the default environment": 'Formuły z Gravitation i domyślne środowisko',
        'Move up': 'W górę', 'Move down': 'W dół', 'Delete helper': 'Usuń zmienną',
        'Environment': 'Środowisko', 'Bond strength': 'Siła wiązania', 'Bond breaks at': 'Wiązanie pęka przy',
        'Bond chance': 'Szansa wiązania', 'Angle stiffness': 'Sztywność kątów',
        'Spring force of a bond per px of stretch': 'Siła sprężyny wiązania na px rozciągnięcia',
        'A bond breaks beyond this x its length': 'Wiązanie pęka powyżej tylu × jego długości',
        'Chance per step that two touching photons with free bonds bond': 'Szansa na krok, że dwa stykające się fotony z wolnymi miejscami się zwiążą',
        'How hard bonds of one photon are pushed apart below its bondAngle': 'Jak mocno wiązania jednego fotonu są rozpychane poniżej jego bondAngle',
        'Photons in this world': 'Fotony w tym świecie', 'min ·': 'min ·', 'mean': 'średnia', '· max': '· max',
        'Force between two photons': 'Siła między dwoma fotonami',
        'Two typical photons of this world (charge ±, average of the other values), force vs distance; positive = attraction. Grey = they touch, blue = bond length (pressure), dashed = a bond breaks.':
            'Dwa typowe fotony tego świata (ładunek ±, średnie pozostałych wartości), siła od odległości; dodatnia = przyciąganie. Szare = stykają się, niebieskie = długość wiązania (ciśnienie), przerywana = wiązanie pęka.',
        '↻ Restart': '↻ Restart', 'New world with these formulas': 'Nowy świat z tymi formułami',
        'Save formulas and environment as JSON': 'Zapisz formuły i środowisko jako JSON',
        'Load formulas and environment': 'Wczytaj formuły i środowisko',
        'charge (sign: − blue, 0 white, + orange)': 'ładunek (znak: − niebieski, 0 biały, + pomarańczowy)',
        'mass (inertia)': 'masa (bezwładność)', 'speed px/s (always kept – only direction changes)': 'prędkość px/s (zawsze stała – zmienia się tylko kierunek)',
        'energy (use it in other formulas)': 'energia (do użycia w innych formułach)', 'force amplitude': 'amplituda siły',
        'force range px': 'zasięg siły px', 'wave periods inside the range': 'okresy fali w zasięgu',
        '0 = classic wave, 1 = sign never flips': '0 = klasyczna fala, 1 = znak się nie zmienia',
        'slides the wave (in periods)': 'przesuwa falę (w okresach)', 'bonds a photon may hold (0–4)': 'ile wiązań foton może mieć (0–4)',
        'minimal angle between two bonds of a photon (°)': 'najmniejszy kąt między dwoma wiązaniami fotonu (°)',
        'helper variable – later rows can use its name': 'zmienna pomocnicza – dalsze wiersze mogą użyć jej nazwy',
        // ---------- observe panel ----------
        'Bonded photons': 'Związane fotony', 'Structures now': 'Struktury teraz', 'Stable structures': 'Stabilne struktury',
        'Shapes now': 'Kształty teraz', 'Catalogue': 'Katalog', 'Largest': 'Największa', 'Rings': 'Pierścienie',
        'Persistence': 'Trwałość', 'Energy / photon': 'Energia / foton', 'Motion': 'Ruch',
        'Reactions / step': 'Reakcje / krok', 'Bond turnover': 'Wymiana wiązań',
        'Structures that stayed the same shape long enough. Click to highlight.': 'Struktury, które wystarczająco długo zachowały kształt. Kliknij, by podświetlić.',
        'now / peak': 'teraz / maksimum', 'Inspector': 'Podgląd', 'Clear': 'Wyczyść',
        'Lab – search for laws': 'Lab – szukanie praw',
        'Runs many small worlds without drawing and keeps the laws whose behaviour is new and neither gas nor a frozen lump. It only chooses laws – it never touches a running world.':
            'Uruchamia wiele małych światów bez rysowania i zachowuje prawa, które dają coś nowego – ani gaz, ani zastygłą bryłę. Wybiera tylko prawa, nigdy nie zmienia działającego świata.',
        'Photons / test': 'Fotony / test', 'Steps / test': 'Kroki / test', 'Workers': 'Wątki',
        'Lab off': 'Lab wyłączony', 'Export laws (JSON)': 'Eksport praw (JSON)',
        'The Lab is switched off for the Gravitation photon model – tune the formulas by hand (⚛ Photon)':
            'Lab jest wyłączony dla modelu fotonów z Gravitation – stroisz formuły ręcznie (⚛ Foton)',
        'Off for the Gravitation photon model (v0.9) – tune the formulas by hand in ⚛ Photon. Archived results are from older models.':
            'Wyłączony dla modelu fotonów z Gravitation (v0.9) – formuły stroisz ręcznie w ⚛ Foton. Zapisane wyniki są ze starszych modeli.',
        '▶ Start search': '▶ Szukaj', '■ Stop search': '■ Zatrzymaj', 'Lab is off in this model': 'Lab wyłączony w tym modelu',
        // ---------- atlas: periodic table ----------
        'Periodic table': 'Tablica pierwiastków', '✕ close': '✕ zamknij', 'Tab / Esc': 'Tab / Esc',
        'PERIODIC TABLE OF EMERGENCE': 'TABLICA PIERWIASTKÓW EMERGENCE',
        'Z = number of photons in a stable structure · H = a free photon · shapes with the same Z are isotopes · nothing here is programmed into the physics':
            'Z = liczba fotonów w stabilnej strukturze · H = wolny foton · kształty o tym samym Z to izotopy · nic z tego nie jest zaprogramowane w fizyce',
        'Alkali metal': 'Metal alkaliczny', 'Alkaline earth metal': 'Metal ziem alkalicznych', 'Transition metal': 'Metal przejściowy',
        'Post-transition metal': 'Metal bloku p', 'Metalloid': 'Półmetal', 'Reactive nonmetal': 'Niemetal',
        'Halogen': 'Fluorowiec', 'Noble gas': 'Gaz szlachetny', 'Lanthanide': 'Lantanowiec', 'Actinide': 'Aktynowiec',
        'Unknown properties': 'Właściwości nieznane',
        '· dim = not yet · outlined = discovered · glowing = present now': '· przygaszone = jeszcze nie · obrysowane = odkryte · świecące = są teraz',
        'elements present now': 'pierwiastków jest teraz', '/ 118 discovered': '/ 118 odkrytych', 'heaviest': 'najcięższy',
        'Elements of this universe': 'Pierwiastki tego wszechświata',
        'Photons that stay bonded in the same shape long enough form a': 'Fotony, które wystarczająco długo trzymają się w tym samym kształcie, tworzą',
        'stable structure': 'stabilną strukturę',
        '. Its size is its atomic number: 2 photons = He, 6 = C, 26 = Fe… Different shapes of the same size are':
            '. Jej rozmiar to liczba atomowa: 2 fotony = He, 6 = C, 26 = Fe… Różne kształty o tym samym rozmiarze to',
        'isotopes': 'izotopy',
        'Hover or click an element. Good laws light up many cells – the Lab is rewarded for that (tab':
            'Najedź albo kliknij pierwiastek. Dobre prawa zapalają wiele pól – Lab jest za to nagradzany (karta',
        'present now': 'jest teraz', 'discovered': 'odkryte', 'free photons (H)': 'wolne fotony (H)',
        'stable structures': 'stabilne struktury', 'free photons now': 'wolne fotony teraz',
        'A single photon without bonds – the raw material of every other element.': 'Pojedynczy foton bez wiązań – surowiec każdego innego pierwiastka.',
        'isotopes (shapes)': 'izotopy (kształty)', 'first at step': 'pierwszy w kroku', '◎ Show in the world': '◎ Pokaż w świecie',
        // ---------- atlas: machine learning ----------
        'Search': 'Wyszukiwanie', 'Learning curve': 'Krzywa uczenia',
        'every tested universe · best so far · elements found': 'każdy testowany wszechświat · najlepszy dotąd · znalezione pierwiastki',
        'Map of universes': 'Mapa wszechświatów',
        'x = bonded matter · y = variety of shapes · size = elements · click = load': 'x = związana materia · y = różnorodność kształtów · wielkość = pierwiastki · klik = wczytaj',
        'Elements the lab has made': 'Pierwiastki, które wytworzył Lab', 'share of archived universes': 'udział zapisanych wszechświatów',
        'How it learns': 'Jak się uczy', 'Each test is a new universe: random laws or a': 'Każdy test to nowy wszechświat: losowe prawa albo',
        'mutation': 'mutacja',
        'of an interesting one. It runs without drawing and is described by general numbers only. Score =':
            'ciekawego. Liczy się bez rysowania i jest opisany tylko ogólnymi liczbami. Wynik =',
        'viability × (novelty + persistence + enclosures + elements)': 'żywotność × (nowość + trwałość + zamknięcia + pierwiastki)',
        ': not a gas, not one lump,': ': nie gaz, nie jedna bryła,', 'unlike what was seen before': 'inny niż wszystko dotąd',
        ', and producing many different stable sizes – our elements. Nothing tells it which shape to build.':
            ' i dający wiele różnych stabilnych rozmiarów – nasze pierwiastki. Nic nie mówi mu, jaki kształt zbudować.',
        'Best universes': 'Najlepsze wszechświaty', 'load one to watch it at full size': 'wczytaj, by zobaczyć w pełnej skali',
        'universes tested': 'przetestowanych wszechświatów', 'kept in archive': 'w archiwum', 'best score': 'najlepszy wynik',
        'most elements in one': 'najwięcej pierwiastków w jednym', 'idle': 'bezczynne',
        'The best universes will appear here.': 'Tu pojawią się najlepsze wszechświaty.', 'no elements': 'bez pierwiastków',
        // ---------- strings used from code (EM.t) ----------
        ', {n} isotope(s)': ', izotopy: {n}', '{n} now': 'teraz: {n}', 'discovered, none now': 'odkryty, teraz brak',
        'not yet': 'jeszcze nie',
        'Not formed yet in this universe. It needs a structure of exactly {z} photons that keeps its shape for {k} observer passes.':
            'Jeszcze nie powstał w tym wszechświecie. Potrzebna jest struktura z dokładnie {z} fotonów, która utrzyma kształt przez {k} przejść obserwatora.',
        'free photons – every universe': 'wolne fotony – każdy wszechświat', '{a} of {b} universes': '{a} z {b} wszechświatów',
        'best so far': 'najlepszy dotąd', 'score of each universe': 'wynik każdego wszechświata', 'elements (max {n})': 'pierwiastki (maks. {n})',
        'gas': 'gaz', 'all bonded →': 'wszystko związane →', 'more kinds of shapes →': 'więcej rodzajów kształtów →',
        '○ best': '○ najlepszy', '○ newest': '○ najnowszy',
        'Start the search – every tested universe appears here': 'Uruchom wyszukiwanie – każdy testowany wszechświat pojawi się tutaj',
        'No universes yet': 'Brak wszechświatów',
        'bonded': 'związane', 'shapes': 'kształty', 'enclosures': 'zamknięcia', 'energy': 'energia',
        "Back to Gravitation's formulas and the default environment?": 'Wrócić do formuł z Gravitation i domyślnego środowiska?',
        'every photon is neutral – no electromagnetic force': 'wszystkie fotony są obojętne – brak siły elektromagnetycznej',
        'Cannot load: ': 'Nie można wczytać: ', 'Cannot load laws: ': 'Nie można wczytać praw: ',
        'The GPU backend does not support the Gravitation photon model (v0.9) yet – the physics runs on the CPU.':
            'Obliczenia na GPU nie obsługują jeszcze modelu fotonów z Gravitation (v0.9) – fizyka liczy się na CPU.',
        '3D view needs WebGL2: ': 'Widok 3D wymaga WebGL2: ',
        // ---------- HUD pieces ----------
        'step': 'krok', 'photons': 'fotonów', 'bonds': 'wiązań',
        'bond': 'wiąz.', 'encl': 'zamkn.', 'laws': 'prawa', 'score': 'wynik'
    };

    /** Texts with numbers. */
    const PATTERNS = [
        [/^([\d.,\s]+) fps$/, '$1 kl./s'],
        [/^([\d.,\s]+) steps\/s$/, '$1 kroków/s'],
        [/^([\d.,]+) ms\/step$/, '$1 ms/krok'],
        [/^step (.+) · \+(.+) · (.+) steps\/s$/, 'krok $1 · +$2 · $3 kroków/s'],
        [/^step (.+) · (\d)D$/, 'krok $1 · $2D'],
        [/^([\d,]+) \(([\d,]+) stable\)$/, '$1 ($2 stabilnych)'],
        [/^(\d)D · running$/, '$1D · działa'],
        [/^(\d)D · stopped$/, '$1D · zatrzymany'],
        [/^(.+): (\d+) photons, (\d+) bonds, (\d+) ring\(s\), found at step (\d+)$/, '$1: fotonów $2, wiązań $3, pierścieni $4, znaleziony w kroku $5'],
        [/^(\d+) testing$/, 'testuje: $1']
    ];

    /** Polish names of the elements (Z = 1..118). */
    const ELEMENTS_PL = ('Wodór Hel Lit Beryl Bor Węgiel Azot Tlen Fluor Neon Sód Magnez Glin Krzem Fosfor Siarka Chlor Argon ' +
        'Potas Wapń Skand Tytan Wanad Chrom Mangan Żelazo Kobalt Nikiel Miedź Cynk Gal German Arsen Selen Brom Krypton ' +
        'Rubid Stront Itr Cyrkon Niob Molibden Technet Ruten Rod Pallad Srebro Kadm Ind Cyna Antymon Tellur Jod Ksenon ' +
        'Cez Bar Lantan Cer Prazeodym Neodym Promet Samar Europ Gadolin Terb Dysproz Holm Erb Tul Iterb Lutet ' +
        'Hafn Tantal Wolfram Ren Osm Iryd Platyna Złoto Rtęć Tal Ołów Bizmut Polon Astat Radon ' +
        'Frans Rad Aktyn Tor Protaktyn Uran Neptun Pluton Ameryk Kiur Berkel Kaliforn Einstein Ferm Mendelew Nobel Lorens ' +
        'Rutherford Dubn Seaborg Bohr Has Meitner Darmsztadt Roentgen Kopernik Nihon Flerow Moskow Liwermor Tenes Oganeson').split(' ');

    const STORE = 'emergence.lang';
    let lang = 'en';
    try {
        lang = localStorage.getItem(STORE) || ((navigator.language || '').toLowerCase().startsWith('pl') ? 'pl' : 'en');
    } catch (e) {
        lang = (navigator.language || '').toLowerCase().startsWith('pl') ? 'pl' : 'en';
    }

    const norm = (s) => s.replace(/\s+/g, ' ').trim();

    /** English text -> current language (null when there is no translation). */
    function lookup(en) {
        const key = norm(en);
        if (!key) return null;
        if (Object.prototype.hasOwnProperty.call(DICT, key)) return DICT[key];
        for (const [re, rep] of PATTERNS) if (re.test(key)) return key.replace(re, rep);
        return null;
    }

    /** For code: translated text with {name} placeholders filled from vars. */
    function t(en, vars) {
        let s = en;
        if (lang === 'pl') {
            const tr = Object.prototype.hasOwnProperty.call(DICT, en) ? DICT[en] : null;
            if (tr !== null) s = tr;
        }
        if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
        return s;
    }

    const skip = (el) => !el || !!el.closest('script, style, code, [data-no-i18n]');

    function translateText(node) {
        if (skip(node.parentElement)) return;
        if (lang === 'en') {
            if (node.__en !== undefined && node.data === node.__tr) node.data = node.__en;
            node.__en = undefined;
            return;
        }
        if (node.__tr !== undefined && node.data === node.__tr) return; // already translated
        const tr = lookup(node.data);
        if (tr === null) return;
        const lead = node.data.match(/^\s*/)[0], trail = node.data.match(/\s*$/)[0];
        node.__en = node.data;
        node.__tr = lead + tr + trail;
        node.data = node.__tr;
    }

    function translateAttr(el, attr) {
        if (skip(el)) return;
        const store = '__en_' + attr, done = '__tr_' + attr;
        const cur = el.getAttribute(attr);
        if (cur === null) return;
        if (lang === 'en') {
            if (el[store] !== undefined && cur === el[done]) el.setAttribute(attr, el[store]);
            el[store] = undefined;
            return;
        }
        if (el[done] !== undefined && cur === el[done]) return;
        const tr = lookup(cur);
        if (tr === null) return;
        el[store] = cur;
        el[done] = tr;
        el.setAttribute(attr, tr);
    }

    function apply(root) {
        if (!root) return;
        if (root.nodeType === 3) { translateText(root); return; }
        if (root.nodeType !== 1) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) translateText(n);
        if (root.hasAttribute('title')) translateAttr(root, 'title');
        root.querySelectorAll('[title]').forEach((el) => translateAttr(el, 'title'));
    }

    const observer = new MutationObserver((list) => {
        if (lang === 'en') return;
        for (const m of list) {
            if (m.type === 'childList') m.addedNodes.forEach(apply);
            else if (m.type === 'characterData') translateText(m.target);
            else if (m.type === 'attributes') translateAttr(m.target, m.attributeName);
        }
    });

    const listeners = new Set();

    function set(next) {
        lang = next === 'pl' ? 'pl' : 'en';
        try { localStorage.setItem(STORE, lang); } catch (e) { /* storage off */ }
        document.documentElement.lang = lang;
        apply(document.body);
        listeners.forEach((fn) => fn(lang));
    }

    /** Name of element z in the current language. */
    function elementName(z, en) {
        return lang === 'pl' ? ELEMENTS_PL[z - 1] : en;
    }

    function start() {
        document.documentElement.lang = lang;
        apply(document.body);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title'] });
    }

    EM.i18n = {
        get lang() { return lang; },
        set, t, start, elementName, onChange: (fn) => listeners.add(fn),
        DICT, ELEMENTS_PL
    };
    EM.t = t;
})(EM);
