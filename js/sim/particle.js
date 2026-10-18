/**
 * A single particle. `colorData` points at an entry of PD.sim.colors (shared by
 * every particle of that species) until colour mixing gives the particle its own
 * copy. Hot values are cached on the instance - call syncCache() after changing
 * colorData or one of its fields.
 */
(function (PD) {
    'use strict';

    const { torusDelta } = PD.math;
    const cfg = PD.config;
    const sim = PD.sim;

    class Particle {
        /**
         * @param {number|null} [initX] random when null
         * @param {number|null} [initY] random when null
         * @param {object|null} [colorData] species colour; random active species when null
         */
        constructor(initX = null, initY = null, colorData = null) {
            this.id = sim.nextParticleId++;
            this.x = initX !== null ? initX : Math.random() * sim.width;
            this.y = initY !== null ? initY : Math.random() * sim.height;
            this.colorData = colorData || sim.colors[Math.floor(Math.random() * sim.speciesCount)];
            const spd = sim.enabled.initialSpeed && this.colorData.initialSpeed !== undefined
                ? this.colorData.initialSpeed : 1.0;
            this.vx = (Math.random() - 0.5) * 2 * spd;
            this.vy = (Math.random() - 0.5) * 2 * spd;
            this.radius = 2;
            this.alpha = 1;
            this.dead = false;
            this.bonds = [];
            this._dirty = true;
            this.syncCache();
        }

        /** Copies hot colour properties onto the particle (avoids property chains in the inner loop). */
        syncCache() {
            this._range = this.colorData.interactionRange;
            this._rangeSq = this._range * this._range;
            this._charge = this.colorData.charge;
            this._mass = this.colorData.mass;
            this._vorticness = this.colorData.vorticness;
            this._name = this.colorData.name;
        }

        update(particles) {
            const speed = sim.speed;
            if (speed <= 0) return;

            const W = sim.width, H = sim.height;
            const en = sim.enabled;
            const grid = sim.grid;

            if (en.viscosity) {
                this.vx *= sim.viscosity;
                this.vy *= sim.viscosity;
            }

            const mouse = sim.mouse;
            if (mouse.pressed) {
                const dx = torusDelta(this.x, mouse.x, W);
                const dy = torusDelta(this.y, mouse.y, H);
                const distSq = dx * dx + dy * dy;
                if (distSq < cfg.MOUSE_RANGE * cfg.MOUSE_RANGE && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    const strength = (1 - dist / cfg.MOUSE_RANGE) * cfg.MOUSE_FORCE;
                    this.vx += (dx / dist) * strength;
                    this.vy += (dy / dist) * strength;
                }
            }

            if (en.swarm) this._applySwarm(particles, grid, W, H);

            // Pairwise forces
            const rangeSq = this._rangeSq;
            let nearby, nearbyLen;
            if (grid) {
                nearby = grid.getNearby(this, this._range);
                nearbyLen = grid.nearbyLen;
            } else {
                nearby = particles;
                nearbyLen = particles.length;
            }

            for (let i = 0; i < nearbyLen; i++) {
                const other = nearby[i];
                if (other === this) continue;

                const dx = torusDelta(this.x, other.x, W);
                const dy = torusDelta(this.y, other.y, H);
                const distSq = dx * dx + dy * dy;
                if (!(distSq < rangeSq && distSq > 0)) continue;

                const dist = Math.sqrt(distSq);

                if (en.attraction) {
                    // (looked up per pair: mixColor() inside this loop may change this._name)
                    const force = (sim.matrix[this._name][other._name] * 0.5 * sim.attractionStrength) / dist;
                    this.vx += (dx / dist) * force;
                    this.vy += (dy / dist) * force;
                }

                if (en.charges) {
                    const force = (this._charge * other._charge) * -0.3 * sim.chargeForce / dist;
                    this.vx += (dx / dist) * force;
                    this.vy += (dy / dist) * force;
                }

                if (en.vortex && distSq < 6400) {
                    const colorVorticness = (this._vorticness + other._vorticness) * 0.5;
                    const strength = colorVorticness * sim.vorticness * 0.3 * (1 - dist / 80);
                    this.vx += (-dy / dist) * strength;
                    this.vy += (dx / dist) * strength;
                }

                if (en.mixing && distSq < 64) {
                    this.mixColor(other);
                }

                if (en.massTransfer && distSq < 25) {
                    const transfer = (this._mass - other._mass) * sim.transferRate;
                    this._mass -= transfer;
                    other._mass += transfer;
                    this._mass = Math.max(0.3, Math.min(2.0, this._mass));
                    other._mass = Math.max(0.3, Math.min(2.0, other._mass));
                    this.colorData.mass = this._mass;
                    other.colorData.mass = other._mass;
                }
            }

            // Integrate
            const massEffect = en.mass ? (2 / this._mass * sim.massEffect) : 2;
            this.x += this.vx * massEffect * speed;
            this.y += this.vy * massEffect * speed;
            this._dirty = true;

            this._applyBoundary(W, H, en);

            // Speed cap (sqrt only when needed)
            const speedSq = this.vx * this.vx + this.vy * this.vy;
            if (speedSq > cfg.MAX_SPEED * cfg.MAX_SPEED) {
                const inv = cfg.MAX_SPEED / Math.sqrt(speedSq);
                this.vx *= inv;
                this.vy *= inv;
            }
        }

        /** Pull towards the centre of same-colour neighbours. */
        _applySwarm(particles, grid, W, H) {
            let centerX = 0, centerY = 0, count = 0;
            const rangeSq = sim.swarmRange * sim.swarmRange;
            let nearby, nearbyLen;
            if (grid) {
                nearby = grid.getNearby(this, sim.swarmRange);
                nearbyLen = grid.nearbyLen;
            } else {
                nearby = particles;
                nearbyLen = particles.length;
            }
            for (let i = 0; i < nearbyLen; i++) {
                const other = nearby[i];
                if (other._name !== this._name) continue;
                const dx = torusDelta(this.x, other.x, W);
                const dy = torusDelta(this.y, other.y, H);
                if (dx * dx + dy * dy < rangeSq) {
                    centerX += other.x;
                    centerY += other.y;
                    count++;
                }
            }
            if (count === 0) return;

            centerX /= count;
            centerY /= count;
            const dx = torusDelta(this.x, centerX, W);
            const dy = torusDelta(this.y, centerY, H);
            const distSq = dx * dx + dy * dy;
            if (distSq > 0) {
                const dist = Math.sqrt(distSq);
                this.vx += (dx / dist) * sim.swarmStrength;
                this.vy += (dy / dist) * sim.swarmStrength;
            }
        }

        _applyBoundary(W, H, en) {
            const mode = sim.boundaryMode;
            if (mode === 'warp') {
                this.x = (this.x + W) % W;
                this.y = (this.y + H) % H;
            } else if (mode === 'wall') {
                if (this.x < 0 || this.x > W) {
                    this.vx *= -0.8;
                    this.x = Math.max(0, Math.min(W, this.x));
                    if (en.massTransfer) this._loseMassOnWallHit();
                }
                if (this.y < 0 || this.y > H) {
                    this.vy *= -0.8;
                    this.y = Math.max(0, Math.min(H, this.y));
                    if (en.massTransfer) this._loseMassOnWallHit();
                }
            } else if (mode === 'endless') {
                if (this.x < -50 || this.x > W + 50 || this.y < -50 || this.y > H + 50) {
                    this.dead = true;
                }
            }
        }

        _loseMassOnWallHit() {
            this._mass = Math.max(0.3, this._mass * 0.95);
            this.colorData.mass = this._mass;
        }

        /** Occasionally blend towards the other particle's colour (gives this particle its own colorData). */
        mixColor(other) {
            if (Math.random() >= 0.02) return;
            const a = this.colorData.hex, b = other.colorData.hex;
            const t = sim.blendRate;
            const mix = (i) => Math.floor(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t);
            const hex2 = (v) => v.toString(16).padStart(2, '0');
            this.colorData = { ...this.colorData, hex: `#${hex2(mix(1))}${hex2(mix(3))}${hex2(mix(5))}` };
            this.syncCache();
        }

        draw(ctx) {
            PD.render.drawParticle(ctx, this);
        }
    }

    PD.Particle = Particle;
})(window.PD);
