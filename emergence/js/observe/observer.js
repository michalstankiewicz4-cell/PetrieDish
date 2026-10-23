/**
 * Observer: every OBSERVE_EVERY steps looks at the world and decides which
 * structures are STABLE (same shape held by the same lead photon for
 * STABLE_PASSES consecutive passes), records them in the catalog and computes
 * general metrics. These metrics are what the ML lab will later optimise -
 * none of them says what a structure should look like.
 */
(function (EM) {
    'use strict';

    class Observer {
        constructor(world) {
            this.world = world;
            this.catalog = new EM.Catalog();
            this.passes = 0;
            /** instance key -> number of consecutive passes it has been seen */
            this.age = new Map();
            /** stable structures of the last pass: { fp, members, entry } */
            this.stable = [];
            this.metrics = {};
            this.history = []; // compact metric history for charts / ML
            /** last enclosure result (for drawing) */
            this.enclosures = null;
            /** enclosure centre key -> consecutive passes seen (persistence) */
            this.enclosureAge = new Map();
            this._counters = { reactions: 0, formed: 0, broken: 0, steps: 0 };
        }

        observe() {
            const world = this.world;
            const comps = EM.structures.find(world);
            const nextAge = new Map();
            const need = EM.config.STABLE_PASSES;

            this.catalog.beginPass();
            this.stable = [];

            let bonded = 0, largest = 0, rings = 0, ageSum = 0;
            const shapesNow = new Set();

            for (const c of comps) {
                bonded += c.members.length;
                if (c.members.length > largest) largest = c.members.length;
                rings += c.cycles;
                shapesNow.add(c.fp);

                // same shape + same lowest photon id = same individual structure
                const key = c.fp + ':' + Math.min(...c.members);
                const age = (this.age.get(key) || 0) + 1;
                nextAge.set(key, age);
                ageSum += age;

                if (age >= need) {
                    const entry = this.catalog.record(c, world);
                    this.stable.push({ fp: c.fp, members: c.members, entry });
                }
            }
            this.age = nextAge;
            this.passes++;

            // enclosures (membranes / vesicles) and how long each has existed
            const enc = EM.enclosures.find(world);
            const nextEnc = new Map();
            let encAgeSum = 0, encOld = 0;
            const bucket = Math.max(enc.cellW, enc.cellH) * 4; // centres may wobble a little
            for (const r of enc.regions) {
                const key = Math.round(r.cx / bucket) + ':' + Math.round(r.cy / bucket);
                const a = (this.enclosureAge.get(key) || 0) + 1;
                nextEnc.set(key, a);
                r.age = a;
                encAgeSum += a;
                if (a >= need) encOld++;
            }
            this.enclosureAge = nextEnc;
            this.enclosures = enc;

            // rates since the previous pass
            const c = this._counters;
            const dSteps = Math.max(1, world.steps - c.steps);
            const rates = {
                reactions: (world.reactions - c.reactions) / dSteps,
                formed: (world.bondsFormed - c.formed) / dSteps,
                broken: (world.bondsBroken - c.broken) / dSteps
            };
            this._counters = { reactions: world.reactions, formed: world.bondsFormed, broken: world.bondsBroken, steps: world.steps };

            const n = world.n;
            this.metrics = {
                step: world.steps,
                photons: n,
                bonds: world.bondCount,
                freeFraction: 1 - bonded / n,
                structures: comps.length,
                stableStructures: this.stable.length,
                largest,
                rings,
                shapesNow: shapesNow.size,
                catalog: this.catalog.size,
                // average age (in passes) of current structures - proxy for persistence
                persistence: comps.length ? ageSum / comps.length : 0,
                kinetic: world.kineticEnergy() / n,
                energy: world.internalEnergy() / n,
                light: world.light.day,
                enclosures: enc.count,
                enclosureArea: enc.cells,
                stableEnclosures: encOld,
                enclosurePersistence: enc.count ? encAgeSum / enc.count : 0,
                reactionRate: rates.reactions,
                bondTurnover: (rates.formed + rates.broken) / Math.max(1, world.bondCount)
            };
            this.history.push(this.metrics);
            if (this.history.length > 600) this.history.shift();
            return this.metrics;
        }
    }

    /**
     * Numbers describing a world for the ML lab - general measures only, nothing
     * says which shape is "good". Averaged over the given metric snapshots.
     */
    function descriptor(history) {
        const keys = ['freeFraction', 'shapesNow', 'largest', 'persistence', 'rings', 'enclosures', 'stableEnclosures', 'kinetic', 'energy', 'bondTurnover'];
        const d = {};
        keys.forEach((k) => {
            d[k] = history.length ? history.reduce((s, m) => s + (m[k] || 0), 0) / history.length : 0;
        });
        d.catalog = history.length ? history[history.length - 1].catalog : 0;
        return d;
    }

    EM.Observer = Observer;
    EM.descriptor = descriptor;
})(EM);
