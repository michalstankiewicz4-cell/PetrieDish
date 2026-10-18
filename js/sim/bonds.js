/**
 * Molecular bonds: two particles of DIFFERENT colours that keep a stable
 * distance for `formationTime` seconds become permanently linked, and the link
 * is then kept at a fixed `length` (position-based constraint).
 */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const state = sim.bonds;
    const { delta } = PD.math;
    const wraps = () => sim.boundaryMode === 'warp';
    const TWO_PI = 2 * Math.PI;

    // id -> particle lookup, built lazily once per frame (see endFrame)
    let frameParticleMap = null;

    function particleMap(particles) {
        if (!frameParticleMap) {
            frameParticleMap = new Map();
            for (let i = 0; i < particles.length; i++) frameParticleMap.set(particles[i].id, particles[i]);
        }
        return frameParticleMap;
    }

    /** Must be called once at the end of every rendered frame. */
    function endFrame() {
        frameParticleMap = null;
    }

    /** Each particle has `maxPerParticle` angular slots; a bond needs a free slot on both ends. */
    function claimSlot(particle, angle) {
        const max = state.maxPerParticle;
        angle = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
        const slotIndex = Math.floor(angle / (TWO_PI / max));

        if (!particle.bondSlots) {
            particle.bondSlots = new Array(max).fill(false);
        }
        if (slotIndex < max && !particle.bondSlots[slotIndex]) {
            particle.bondSlots[slotIndex] = true;
            return true;
        }
        return false;
    }

    function detectAndCreate(particles) {
        const grid = sim.grid;
        if (!sim.enabled.bonds || !grid) return;

        const requiredFrames = state.formationTime * PD.config.BOND_TARGET_FPS;
        const maxDist = state.maxDistance;
        const maxDistSq = maxDist * maxDist;
        const maxBonds = state.maxPerParticle;
        const candidates = state.candidates;
        const checked = new Set();
        const wrap = wraps();
        const W = sim.width, H = sim.height;

        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            if (p1.bonds.length >= maxBonds) continue;

            const nearby = grid.getNearby(p1, maxDist);
            const nearbyLen = grid.nearbyLen;
            for (let n = 0; n < nearbyLen; n++) {
                const p2 = nearby[n];
                if (p2 === p1) continue;
                if (p2.bonds.length >= maxBonds) continue;
                if (p1._name === p2._name) continue;

                const lo = p1.id < p2.id ? p1.id : p2.id;
                const hi = p1.id < p2.id ? p2.id : p1.id;
                const pairKey = lo * 100000 + hi;
                if (checked.has(pairKey)) continue;
                checked.add(pairKey);

                if (p1.bonds.includes(p2.id)) continue;

                const dx = delta(p1.x, p2.x, W, wrap);
                const dy = delta(p1.y, p2.y, H, wrap);
                const distSq = dx * dx + dy * dy;

                if (!(distSq < maxDistSq)) {
                    candidates.delete(pairKey);
                    continue;
                }

                const dist = Math.sqrt(distSq);
                let candidate = candidates.get(pairKey);
                if (!candidate) {
                    candidate = { frames: 0, distance: dist };
                    candidates.set(pairKey, candidate);
                }

                if (!(Math.abs(dist - candidate.distance) < 1.0)) {
                    // Distance changed too much - start counting again
                    candidate.frames = 0;
                    candidate.distance = dist;
                    continue;
                }

                candidate.frames++;
                candidate.distance = dist;
                if (candidate.frames >= requiredFrames &&
                    claimSlot(p1, Math.atan2(dy, dx)) &&
                    claimSlot(p2, Math.atan2(-dy, -dx))) {
                    p1.bonds.push(p2.id);
                    p2.bonds.push(p1.id);
                    state.active.push({ p1: p1.id, p2: p2.id, distance: dist });
                    candidates.delete(pairKey);
                }
            }
        }
    }

    function applyConstraints(particles) {
        if (!sim.enabled.bonds || state.active.length === 0) return;

        const map = particleMap(particles);
        const active = state.active;
        const wrap = wraps();
        const W = sim.width, H = sim.height;
        for (let b = 0; b < active.length; b++) {
            const p1 = map.get(active[b].p1);
            const p2 = map.get(active[b].p2);
            if (!p1 || !p2) continue;

            const dx = delta(p1.x, p2.x, W, wrap);
            const dy = delta(p1.y, p2.y, H, wrap);
            const distSq = dx * dx + dy * dy;
            if (distSq === 0) continue;

            const currentDist = Math.sqrt(distSq);
            const correction = (currentDist - state.length) / currentDist * 0.5;
            const cx = dx * correction;
            const cy = dy * correction;
            p1.x += cx; p1.y += cy;
            p2.x -= cx; p2.y -= cy;
        }
    }

    /** Forget all bonds (world reset). */
    function reset() {
        state.candidates.clear();
        state.active = [];
    }

    /** Remove bonds and free all slots on existing particles (mechanic switched off). */
    function clearFromParticles(particles) {
        reset();
        particles.forEach(p => {
            p.bonds = [];
            p.bondSlots = new Array(state.maxPerParticle).fill(false);
        });
    }

    PD.bonds = { detectAndCreate, applyConstraints, reset, clearFromParticles, particleMap, endFrame };
})(window.PD);
