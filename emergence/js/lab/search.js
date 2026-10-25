/**
 * Novelty search over laws (genomes).
 *
 * The lab never touches a running world - it only proposes laws, lets them run
 * headless and reads general measures (EM.descriptor). The score rewards
 * NOVELTY (distance to what was already seen) times VIABILITY (neither a gas
 * of free photons nor one frozen lump) plus a small bonus for persistent
 * structure and enclosures, and for the number of different "elements"
 * (stable structures of different sizes - see observe/elements.js).
 * Nothing rewards a particular shape.
 */
(function (EM) {
    'use strict';

    const K_NEAREST = 5;
    const ARCHIVE_MAX = 300;
    const RANDOM_SHARE = 0.3;
    const MIN_ARCHIVE_FOR_MUTATION = 10;

    /** Descriptor -> normalised feature vector (each roughly 0..1). */
    function features(d) {
        const lg = (v, max) => Math.log1p(Math.max(0, v)) / Math.log1p(max);
        return [
            1 - d.freeFraction,              // bonded share
            lg(d.shapesNow, 300),            // diversity of structures
            lg(d.largest, 1000),             // biggest structure
            lg(d.persistence, 60),           // how long structures live
            lg(d.rings, 2000),               // loops in bond graphs
            lg(d.enclosures, 60),            // enclosed regions (membranes)
            lg(d.kinetic, 3),                // motion
            Math.min(1, d.energy),           // stored energy
            lg(d.bondTurnover, 0.2),         // how dynamic the bonds are
            lg(d.elementsEver || 0, 40)      // how many elements (sizes of stable structures)
        ];
    }

    function dist(a, b) {
        let s = 0;
        for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]);
        return Math.sqrt(s);
    }

    /** 0 for a gas or a single lump, 1 for anything in between with some variety. */
    function viability(d) {
        const bonded = 1 - d.freeFraction;
        const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
        return ramp(bonded, 0.03, 0.15) * (1 - ramp(bonded, 0.9, 0.99)) * ramp(d.shapesNow, 1, 4);
    }

    /** Small bonus for persistent structure on several levels (molecules, rings, enclosures). */
    function structure(d) {
        return 0.15 * Math.log1p(d.persistence) / Math.log1p(60) +
            0.15 * Math.log1p(d.stableEnclosures) / Math.log1p(20) +
            0.3 * Math.log1p(d.elementsEver || 0) / Math.log1p(40);
    }

    const LOG_MAX = 1000;

    function nameOf(genome) {
        const h = EM.hash.string(JSON.stringify(genome)).toString(36).toUpperCase();
        return 'L-' + h.slice(0, 5);
    }

    class Search {
        constructor(storageKey = 'emergence.lab.v2') {
            this.storageKey = storageKey;
            /** @type {Array<{name, genome, descriptor, f, novelty, interest, parent, origin, top, at}>} */
            this.archive = [];
            this.evaluated = 0;
            /** every evaluation in order (for the learning curve): { n, interest, novelty, viability, elements, best } */
            this.log = [];
            this.rng = new EM.Rng(Math.floor(Math.random() * 1e9));
            this.load();
        }

        /** Next genome to evaluate. */
        propose() {
            if (this.archive.length < MIN_ARCHIVE_FOR_MUTATION || this.rng.next() < RANDOM_SHARE) {
                const seed = Math.floor(this.rng.next() * 1e9);
                return { genome: EM.genome.random(seed), parent: null, origin: 'random' };
            }
            const parent = this.tournament(3);
            const genome = EM.genome.mutate(parent.genome, this.rng, { rate: 0.2, sigma: 0.12 });
            return { genome, parent: parent.name, origin: 'mutation' };
        }

        tournament(k) {
            let best = null;
            for (let i = 0; i < k; i++) {
                const c = this.archive[Math.floor(this.rng.next() * this.archive.length)];
                if (!best || c.interest > best.interest) best = c;
            }
            return best;
        }

        novelty(f) {
            if (this.archive.length === 0) return 1;
            const ds = this.archive.map((a) => dist(f, a.f)).sort((a, b) => a - b);
            const k = Math.min(K_NEAREST, ds.length);
            let s = 0;
            for (let i = 0; i < k; i++) s += ds[i];
            return s / k;
        }

        /** Adds an evaluated genome; returns its archive entry. */
        add(proposal, result) {
            const d = result.descriptor;
            const f = features(d);
            const novelty = this.novelty(f);
            const v = viability(d);
            const entry = {
                name: nameOf(proposal.genome),
                genome: proposal.genome,
                parent: proposal.parent,
                origin: proposal.origin,
                descriptor: d,
                top: result.top,
                elements: result.elements || [],
                f,
                novelty,
                viability: v,
                interest: v * (novelty + structure(d)),
                at: Date.now()
            };
            this.evaluated++;
            const prevBest = this.log.length ? this.log[this.log.length - 1].best : 0;
            this.log.push({
                n: this.evaluated,
                interest: entry.interest,
                novelty,
                viability: v,
                elements: entry.elements.length,
                best: Math.max(prevBest, entry.interest)
            });
            if (this.log.length > LOG_MAX) this.log.shift();
            this.archive.push(entry);
            if (this.archive.length > ARCHIVE_MAX) {
                // forget the least interesting (keeps the archive diverse and small)
                this.archive.sort((a, b) => b.interest - a.interest);
                this.archive.length = ARCHIVE_MAX;
            }
            this.save();
            return entry;
        }

        best(n = 20) {
            return this.archive.slice().sort((a, b) => b.interest - a.interest).slice(0, n);
        }

        clear() {
            this.archive = [];
            this.evaluated = 0;
            this.log = [];
            this.save();
        }

        save() {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify({ evaluated: this.evaluated, archive: this.archive, log: this.log }));
            } catch (e) { /* storage full or unavailable - the lab still works for this session */ }
        }

        load() {
            try {
                const raw = localStorage.getItem(this.storageKey);
                if (!raw) return;
                const data = JSON.parse(raw);
                this.archive = (data.archive || []).filter((a) => a && a.genome && a.genome.format === EM.genome.FORMAT && a.descriptor);
                this.archive.forEach((a) => {
                    a.f = features(a.descriptor);
                    if (!a.elements) a.elements = [];
                });
                this.log = Array.isArray(data.log) ? data.log : [];
                this.evaluated = data.evaluated || this.archive.length;
            } catch (e) {
                this.archive = [];
            }
        }
    }

    EM.lab = EM.lab || {};
    EM.lab.Search = Search;
    EM.lab.score = { features, viability, structure };
})(EM);
