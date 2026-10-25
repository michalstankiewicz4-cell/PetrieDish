/**
 * The periodic table of Emergence: a stable structure made of Z photons is
 * an "atom" of element Z (Z = number of photons; H = a single free photon).
 * Different shapes with the same Z are its isotopes.
 *
 * Observer code only - the physics knows nothing about elements. The lab
 * reads `distinct` (how many different elements a world produces) as one
 * of its general measures.
 */
(function (EM) {
    'use strict';

    const SYMBOLS = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
        'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu ' +
        'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr ' +
        'Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' ');

    const NAMES = ('Hydrogen Helium Lithium Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon Sodium Magnesium Aluminium ' +
        'Silicon Phosphorus Sulfur Chlorine Argon Potassium Calcium Scandium Titanium Vanadium Chromium Manganese Iron ' +
        'Cobalt Nickel Copper Zinc Gallium Germanium Arsenic Selenium Bromine Krypton Rubidium Strontium Yttrium Zirconium ' +
        'Niobium Molybdenum Technetium Ruthenium Rhodium Palladium Silver Cadmium Indium Tin Antimony Tellurium Iodine Xenon ' +
        'Caesium Barium Lanthanum Cerium Praseodymium Neodymium Promethium Samarium Europium Gadolinium Terbium Dysprosium ' +
        'Holmium Erbium Thulium Ytterbium Lutetium Hafnium Tantalum Tungsten Rhenium Osmium Iridium Platinum Gold Mercury ' +
        'Thallium Lead Bismuth Polonium Astatine Radon Francium Radium Actinium Thorium Protactinium Uranium Neptunium ' +
        'Plutonium Americium Curium Berkelium Californium Einsteinium Fermium Mendelevium Nobelium Lawrencium Rutherfordium ' +
        'Dubnium Seaborgium Bohrium Hassium Meitnerium Darmstadtium Roentgenium Copernicium Nihonium Flerovium Moscovium ' +
        'Livermorium Tennessine Oganesson').split(' ');

    const CATEGORIES = {
        alkali: 'Alkali metal',
        alkaline: 'Alkaline earth metal',
        transition: 'Transition metal',
        post: 'Post-transition metal',
        metalloid: 'Metalloid',
        nonmetal: 'Reactive nonmetal',
        halogen: 'Halogen',
        noble: 'Noble gas',
        lanthanide: 'Lanthanide',
        actinide: 'Actinide',
        unknown: 'Unknown properties'
    };

    const SETS = {
        alkali: [3, 11, 19, 37, 55, 87],
        alkaline: [4, 12, 20, 38, 56, 88],
        metalloid: [5, 14, 32, 33, 51, 52],
        nonmetal: [1, 6, 7, 8, 15, 16, 34],
        halogen: [9, 17, 35, 53, 85],
        noble: [2, 10, 18, 36, 54, 86],
        post: [13, 31, 49, 50, 81, 82, 83, 84],
        unknown: [109, 110, 111, 113, 114, 115, 116, 117, 118]
    };

    function categoryOf(z) {
        for (const [k, list] of Object.entries(SETS)) if (list.includes(z)) return k;
        if (z >= 57 && z <= 71) return 'lanthanide';
        if (z >= 89 && z <= 103) return 'actinide';
        return 'transition';
    }

    /**
     * Grid position (1-based): row 1..7 = periods, rows 9 and 10 = the
     * lanthanide / actinide block shown under the table.
     */
    function positionOf(z) {
        if (z === 1) return { row: 1, col: 1 };
        if (z === 2) return { row: 1, col: 18 };
        const starts = [[3, 2], [11, 3], [19, 4], [37, 5], [55, 6], [87, 7]];
        if (z >= 57 && z <= 71) return { row: 9, col: 3 + (z - 57) };
        if (z >= 89 && z <= 103) return { row: 10, col: 3 + (z - 89) };
        for (let k = starts.length - 1; k >= 0; k--) {
            const [first, period] = starts[k];
            if (z < first) continue;
            const i = z - first; // index inside the period
            if (period <= 3) return { row: period, col: i < 2 ? i + 1 : i + 11 };
            if (period <= 5) return { row: period, col: i + 1 };
            // periods 6 and 7: s-block, then (after the f-block gap) groups 4..18
            if (i < 2) return { row: period, col: i + 1 };
            return { row: period, col: i - 14 + 1 + 0 };
        }
        return { row: 1, col: 1 };
    }

    const TABLE = SYMBOLS.map((symbol, k) => {
        const z = k + 1;
        return Object.assign({ z, symbol, name: NAMES[k], category: categoryOf(z) }, positionOf(z));
    });

    /**
     * Elements present in a world, read from the observer's stable structures and catalogue.
     * @returns {{ elements: Array<{z, now, isotopes, entries, first}>, distinct: number, everDistinct: number, heaviest: number, freePhotons: number }}
     */
    function census(observer) {
        const world = observer.world;
        const out = TABLE.map(() => ({ now: 0, isotopes: 0, entries: [], first: Infinity }));

        // H = a single photon without bonds
        let free = 0;
        for (let i = 0; i < world.n; i++) if (world.deg[i] === 0) free++;
        out[0].now = free;
        if (free > 0) out[0].first = 0;

        observer.catalog.entries.forEach((e) => {
            if (e.size > TABLE.length) return;
            const el = out[e.size - 1];
            el.isotopes++;
            el.entries.push(e);
            el.now += e.current;
            if (e.discoveredAt < el.first) el.first = e.discoveredAt;
        });

        let distinct = 0, ever = 0, heaviest = free > 0 ? 1 : 0;
        for (let z = 2; z <= TABLE.length; z++) {
            const el = out[z - 1];
            if (el.isotopes > 0) {
                ever++;
                heaviest = z;
            }
            if (el.now > 0) distinct++;
        }
        out.forEach((el) => el.entries.sort((a, b) => (b.current - a.current) || (b.peak - a.peak)));
        return { elements: out, distinct, everDistinct: ever, heaviest, freePhotons: free };
    }

    /** Sorted list of Z (>= 2) of every catalogue entry - used by the lab. */
    function foundZ(catalog) {
        const set = new Set();
        catalog.entries.forEach((e) => { if (e.size >= 2 && e.size <= TABLE.length) set.add(e.size); });
        return Array.from(set).sort((a, b) => a - b);
    }

    EM.elements = { TABLE, CATEGORIES, census, foundZ };
})(EM);
