/**
 * "Time-loop" particle: every step it simulates its own trajectory N frames
 * ahead (against the current, frozen neighbours) and is pushed away from that
 * future position. Added with a right click while Intelligent Life is enabled.
 */
(function (PD) {
    'use strict';

    const { torusDelta } = PD.math;
    const cfg = PD.config;
    const sim = PD.sim;

    const AVOID_RADIUS = 30;
    const AVOID_FORCE = 0.8;

    class IntelligentParticle extends PD.Particle {
        constructor(x, y, colorHex) {
            super(x, y);

            // Unique colour that is not part of the species list. It has no row in the
            // interaction matrix, so attraction to/from it is neutral.
            this.colorData = {
                hex: colorHex,
                charge: 0,
                mass: 1.0,
                interactionRange: 50,
                vorticness: 0.3,
                name: `intelligent_${sim.intelligent.nextColor++}`
            };

            this.syncCache();
            this.isIntelligent = true;
            this.futureX = this.x;
            this.futureY = this.y;
            this.radius = 3;
        }

        /** Simulates `frames` steps ahead and returns the predicted position. */
        predictFuture(frames) {
            const W = sim.width, H = sim.height;
            const en = sim.enabled;
            const range = this.colorData.interactionRange;
            const ownRow = sim.matrix[this.colorData.name];
            const probe = { x: 0, y: 0 };

            let fx = this.x, fy = this.y;
            let fvx = this.vx, fvy = this.vy;

            for (let step = 0; step < frames; step++) {
                if (en.viscosity) {
                    fvx *= sim.viscosity;
                    fvy *= sim.viscosity;
                }

                probe.x = fx;
                probe.y = fy;
                const neighbors = sim.grid.getNearby(probe, range);
                const neighborsLen = sim.grid.nearbyLen;

                for (let i = 0; i < neighborsLen; i++) {
                    const other = neighbors[i];
                    if (other === this || other.isIntelligent) continue;

                    const dx = torusDelta(other.x, fx, W);
                    const dy = torusDelta(other.y, fy, H);
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < range && dist > 0 && en.attraction) {
                        const attraction = (ownRow && ownRow[other.colorData.name]) || 0;
                        const force = (attraction * 0.5) / dist;
                        fvx += (dx / dist) * force;
                        fvy += (dy / dist) * force;
                    }
                }

                const massEffect = en.mass ? (2 / this.colorData.mass * sim.massEffect) : 2;
                fx += fvx * massEffect * sim.speed;
                fy += fvy * massEffect * sim.speed;

                if (sim.boundaryMode === 'warp') {
                    if (fx < 0) fx = W;
                    if (fx > W) fx = 0;
                    if (fy < 0) fy = H;
                    if (fy > H) fy = 0;
                } else if (sim.boundaryMode === 'wall') {
                    if (fx < 0 || fx > W) {
                        fvx *= -0.8;
                        fx = Math.max(0, Math.min(W, fx));
                    }
                    if (fy < 0 || fy > H) {
                        fvy *= -0.8;
                        fy = Math.max(0, Math.min(H, fy));
                    }
                }

                const speed = Math.sqrt(fvx * fvx + fvy * fvy);
                if (speed > cfg.MAX_SPEED) {
                    fvx = (fvx / speed) * cfg.MAX_SPEED;
                    fvy = (fvy / speed) * cfg.MAX_SPEED;
                }
            }

            return { x: fx, y: fy };
        }

        update(particles) {
            super.update(particles);

            const frames = sim.intelligent.futureFrames;
            if (frames <= 0) return;

            const future = this.predictFuture(frames);
            this.futureX = future.x;
            this.futureY = future.y;

            // Push away from our own future self
            const dx = torusDelta(this.futureX, this.x, sim.width);
            const dy = torusDelta(this.futureY, this.y, sim.height);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < AVOID_RADIUS && dist > 0) {
                const force = (1 - dist / AVOID_RADIUS) * AVOID_FORCE;
                this.vx -= (dx / dist) * force;
                this.vy -= (dy / dist) * force;
            }
        }

        draw(ctx) {
            PD.render.drawIntelligentParticle(ctx, this);
        }
    }

    PD.IntelligentParticle = IntelligentParticle;
})(window.PD);
