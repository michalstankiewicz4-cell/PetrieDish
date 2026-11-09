/**
 * Bond storage: world.partner[i * MAX_VALENCE + slot], world.deg[i] = used slots.
 * Forming, springs, breaking and angles live in World (js/physics/world.js).
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;

    /** Bonds photon i may hold (its valence from the formulas). */
    function allowed(world, i) {
        return world.valence[i];
    }

    function isBonded(world, i, j) {
        const base = i * MV, partner = world.partner;
        for (let s = 0; s < world.deg[i]; s++) if (partner[base + s] === j) return true;
        return false;
    }

    function add(world, i, j) {
        world.partner[i * MV + world.deg[i]++] = j;
        world.partner[j * MV + world.deg[j]++] = i;
        world.bondCount++;
    }

    function removeSlot(world, i, j) {
        const base = i * MV, partner = world.partner;
        const last = --world.deg[i];
        for (let s = 0; s <= last; s++) {
            if (partner[base + s] === j) {
                partner[base + s] = partner[base + last];
                partner[base + last] = -1;
                return;
            }
        }
    }

    function remove(world, i, j) {
        removeSlot(world, i, j);
        removeSlot(world, j, i);
        world.bondCount--;
        world.bondsBroken++;
    }

    /** Calls fn(i, j) once per bond. */
    function forEach(world, fn) {
        const deg = world.deg, partner = world.partner;
        for (let i = 0; i < world.n; i++) {
            for (let s = 0; s < deg[i]; s++) {
                const j = partner[i * MV + s];
                if (j > i) fn(i, j);
            }
        }
    }

    function clearAll(world) {
        world.deg.fill(0);
        world.partner.fill(-1);
        world.bondCount = 0;
    }

    EM.bonds = { allowed, isBonded, add, remove, forEach, clearAll };
})(EM);
