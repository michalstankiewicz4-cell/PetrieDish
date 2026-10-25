/**
 * Catalog of discovered stable structures (like the "Elements" table in
 * Gravitation). One entry per fingerprint; the name is derived from the
 * fingerprint, so the same structure always gets the same name.
 */
(function (EM) {
    'use strict';

    const CONSONANTS = 'bcdfghklmnprstvz';
    const VOWELS = 'aeiouy';

    /** Pronounceable name from a fingerprint: e.g. "Kavoru". */
    function nameFor(fp, size) {
        let h = EM.hash.string(fp);
        const syllables = 2 + (size > 6 ? 1 : 0) + (size > 20 ? 1 : 0);
        let name = '';
        for (let s = 0; s < syllables; s++) {
            name += CONSONANTS[h % CONSONANTS.length];
            h = Math.floor(h / CONSONANTS.length);
            name += VOWELS[h % VOWELS.length];
            h = Math.floor(h / VOWELS.length);
        }
        return name[0].toUpperCase() + name.slice(1);
    }

    class Catalog {
        constructor() {
            /** @type {Map<string, object>} fingerprint -> entry */
            this.entries = new Map();
        }

        /** Marks the start of an observer pass (resets "current" counts). */
        beginPass() {
            this.entries.forEach((e) => { e.current = 0; });
        }

        /**
         * Records one stable instance. Creates the entry on first sight.
         * @returns {object} the entry
         */
        record(info, world) {
            let e = this.entries.get(info.fp);
            if (!e) {
                e = {
                    id: this.entries.size + 1,
                    fp: info.fp,
                    name: nameFor(info.fp, info.members.length),
                    size: info.members.length,
                    edges: info.edges,
                    cycles: info.cycles,
                    composition: info.composition.slice(),
                    discoveredAt: world.steps,
                    // snapshot used to draw the catalog tile
                    shape: EM.structures.localShape(world, info.members),
                    types: info.members.map((p) => world.type[p]),
                    links: linksOf(world, info.members),
                    current: 0,
                    peak: 0,
                    sightings: 0
                };
                this.entries.set(info.fp, e);
            }
            e.current++;
            e.sightings++;
            if (e.current > e.peak) e.peak = e.current;
            return e;
        }

        /** Entries sorted by how common they are right now, then by peak. */
        sorted() {
            return Array.from(this.entries.values()).sort((a, b) => (b.current - a.current) || (b.peak - a.peak) || (a.id - b.id));
        }

        get size() {
            return this.entries.size;
        }
    }

    /** Bonds inside a structure as pairs of local indices (for drawing tiles). */
    function linksOf(world, members) {
        const local = new Map();
        members.forEach((p, idx) => local.set(p, idx));
        const MV = EM.config.MAX_VALENCE;
        const links = [];
        members.forEach((p, a) => {
            for (let s = 0; s < world.deg[p]; s++) {
                const b = local.get(world.partner[p * MV + s]);
                if (b !== undefined && b > a) links.push([a, b]);
            }
        });
        return links;
    }

    EM.Catalog = Catalog;
    EM.catalogNames = { nameFor };
})(EM);
