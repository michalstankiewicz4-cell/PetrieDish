/**
 * Life Scanner: flood-fill clusters of particles whose neighbour distance AND
 * relative speed fall inside the configured ranges, then keep clusters whose
 * size and colour diversity are inside their ranges as well.
 */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const life = sim.life;
    let stepCounter = 0;

    /** Breadth-first fill from particle index `start`. Returns { cluster, colorCount }. */
    function growCluster(particles, start, visited, limits) {
        const { distFromSq, distToSq, speedFromSq, speedToSq, searchRange } = limits;
        const grid = sim.grid;
        const cluster = [];
        const queue = [start];
        const colorSeen = {};
        let colorCount = 0;
        let head = 0;
        visited.add(start);

        const tryAdd = (current, neighbor, nIdx) => {
            const dx = neighbor.x - current.x;
            const dy = neighbor.y - current.y;
            const distSq = dx * dx + dy * dy;
            if (!(distSq >= distFromSq && distSq <= distToSq)) return;
            const dvx = neighbor.vx - current.vx;
            const dvy = neighbor.vy - current.vy;
            const speedSq = dvx * dvx + dvy * dvy;
            if (!(speedSq >= speedFromSq && speedSq <= speedToSq)) return;
            visited.add(nIdx);
            queue.push(nIdx);
        };

        while (head < queue.length) {
            const current = particles[queue[head++]];
            cluster.push(current);

            if (!colorSeen[current._name]) {
                colorSeen[current._name] = true;
                colorCount++;
            }

            if (grid) {
                const nearby = grid.getNearby(current, searchRange);
                const nearbyLen = grid.nearbyLen;
                for (let n = 0; n < nearbyLen; n++) {
                    const neighbor = nearby[n];
                    if (!visited.has(neighbor._idx)) tryAdd(current, neighbor, neighbor._idx);
                }
            } else {
                for (let j = 0; j < particles.length; j++) {
                    if (!visited.has(j)) tryAdd(current, particles[j], j);
                }
            }
        }
        return { cluster, colorCount };
    }

    function detect(particles) {
        if (!sim.enabled.lifeDetection) {
            life.forms = [];
            return;
        }
        stepCounter++;
        if (stepCounter % PD.config.LIFE_DETECT_EVERY !== 0) return;

        const limits = {
            distFromSq: life.distance.from * life.distance.from,
            distToSq: life.distance.to * life.distance.to,
            speedFromSq: life.speedDiff.from * life.speedDiff.from,
            speedToSq: life.speedDiff.to * life.speedDiff.to,
            searchRange: life.distance.to
        };

        // index lookup for the grid path (avoids indexOf)
        for (let i = 0; i < particles.length; i++) particles[i]._idx = i;

        const clusters = [];
        const visited = new Set();
        for (let i = 0; i < particles.length; i++) {
            if (visited.has(i)) continue;
            const { cluster, colorCount } = growCluster(particles, i, visited, limits);
            if (cluster.length >= life.particles.from && cluster.length <= life.particles.to &&
                colorCount >= life.colors.from && colorCount <= life.colors.to) {
                clusters.push(cluster);
            }
        }
        life.forms = clusters;
    }

    PD.life = { detect };
})(window.PD);
