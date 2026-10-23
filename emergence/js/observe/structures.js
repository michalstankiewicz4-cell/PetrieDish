/**
 * Finds bonded structures (connected components of the bond graph) and gives
 * each a fingerprint that depends only on its shape and composition, not on
 * where it is or which photons form it.
 *
 * Observer code: reads the world, never changes it.
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;
    const WL_ROUNDS = 3; // Weisfeiler-Lehman refinement rounds

    /**
     * @returns {Array<{members:number[], edges:number, cycles:number, fp:string, composition:number[]}>}
     *   components with >= 2 photons
     */
    function find(world) {
        const n = world.n, deg = world.deg, partner = world.partner;

        // union-find over bonds
        const parent = new Int32Array(n);
        for (let i = 0; i < n; i++) parent[i] = i;
        const root = (a) => {
            while (parent[a] !== a) {
                parent[a] = parent[parent[a]];
                a = parent[a];
            }
            return a;
        };
        for (let i = 0; i < n; i++) {
            for (let s = 0; s < deg[i]; s++) {
                const j = partner[i * MV + s];
                if (j > i) {
                    const ri = root(i), rj = root(j);
                    if (ri !== rj) parent[ri < rj ? rj : ri] = ri < rj ? ri : rj;
                }
            }
        }

        const groups = new Map();
        for (let i = 0; i < n; i++) {
            if (deg[i] === 0) continue;
            const r = root(i);
            let g = groups.get(r);
            if (!g) groups.set(r, (g = []));
            g.push(i);
        }

        const out = [];
        groups.forEach((members) => {
            if (members.length >= 2) out.push(describe(world, members));
        });
        return out;
    }

    /** Fingerprint + basic graph numbers for one component. */
    function describe(world, members) {
        const T = world.laws.T, type = world.type, deg = world.deg, partner = world.partner;
        const local = new Map();
        members.forEach((p, idx) => local.set(p, idx));

        let edges2 = 0;
        const composition = new Array(T).fill(0);
        let labels = members.map((p) => {
            composition[type[p]]++;
            edges2 += deg[p];
            return type[p] * 8 + deg[p];
        });

        // Weisfeiler-Lehman: a node's label absorbs its neighbours' labels
        for (let r = 0; r < WL_ROUNDS; r++) {
            labels = members.map((p, idx) => {
                const neigh = [];
                for (let s = 0; s < deg[p]; s++) neigh.push(labels[local.get(partner[p * MV + s])]);
                neigh.sort((a, b) => a - b);
                return EM.hash.ints([labels[idx], ...neigh]);
            });
        }

        const sorted = labels.slice().sort((a, b) => a - b);
        const edges = edges2 / 2;
        return {
            members,
            edges,
            cycles: edges - members.length + 1, // independent loops (rings)
            composition,
            fp: EM.hash.ints([members.length, edges, ...sorted]).toString(36)
        };
    }

    /** Positions of the members relative to the first one (unwrapped across the torus edge). [dx, dy, dz] */
    function localShape(world, members) {
        const x0 = world.x[members[0]], y0 = world.y[members[0]], z0 = world.z[members[0]];
        const W = world.width, H = world.height, D = world.depth;
        return members.map((p) => {
            let dx = world.x[p] - x0, dy = world.y[p] - y0, dz = world.z[p] - z0;
            if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W;
            if (dy > H / 2) dy -= H; else if (dy < -H / 2) dy += H;
            if (D) { if (dz > D / 2) dz -= D; else if (dz < -D / 2) dz += D; }
            return [dx, dy, dz];
        });
    }

    EM.structures = { find, describe, localShape };
})(EM);
