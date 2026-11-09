/**
 * Reactions: a photon of type a bonded to a photon of type b may turn into
 * another type, if it has enough energy (the energy is spent). Matter is
 * conserved - only types change. If the new type has a lower valence,
 * the extra bonds break.
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;
    const changes = []; // reused: [photon, newType, ...]

    function apply(world) {
        const L = world.laws;
        if (!L.hasReactions || L.reactionRate <= 0 || world.bondCount === 0) return;
        const n = world.n, T = L.T, deg = world.deg, partner = world.partner, type = world.type, e = world.energy;
        const rng = world.rng, rate = L.reactionRate, rxTo = L.rxTo, rxThr = L.rxThr;
        changes.length = 0;

        for (let i = 0; i < n; i++) {
            const d = deg[i];
            if (d === 0) continue;
            const row = type[i] * T;
            for (let s = 0; s < d; s++) {
                const p = row + type[partner[i * MV + s]];
                const to = rxTo[p];
                if (to < 0 || e[i] < rxThr[p]) continue;
                if (rng.next() >= rate) continue;
                e[i] -= rxThr[p];
                changes.push(i, to);
                break; // at most one reaction per photon per step
            }
        }

        for (let c = 0; c < changes.length; c += 2) {
            const i = changes[c], to = changes[c + 1];
            type[i] = to;
            const keep = L.valence[to];
            while (deg[i] > keep) {
                EM.bonds.remove(world, i, world.partner[i * MV + deg[i] - 1]);
            }
        }
        world.reactions += changes.length / 2;
    }

    EM.reactions = { apply };
})(EM);
