/**
 * World lifecycle: spawning particles and advancing the simulation.
 * Pure simulation - no DOM access here.
 */
(function (PD) {
    'use strict';

    const sim = PD.sim;

    function spawnRandom() {
        for (let i = 0; i < sim.particleCount; i++) {
            sim.particles.push(new PD.Particle());
        }
    }

    function spawnBigBang() {
        const cx = sim.width / 2;
        const cy = sim.height / 2;
        const spread = 5;
        for (let i = 0; i < sim.particleCount; i++) {
            const ox = (Math.random() - 0.5) * spread * 2;
            const oy = (Math.random() - 0.5) * spread * 2;
            sim.particles.push(new PD.Particle(cx + ox, cy + oy));
        }
    }

    /** Vertical strips, heaviest species on the left. */
    function spawnMassGradient() {
        const species = sim.speciesCount;
        const sorted = [...sim.colors.slice(0, species)].sort((a, b) => b.mass - a.mass);
        const perColor = Math.floor(sim.particleCount / species);
        const remainder = sim.particleCount % species;
        const stripWidth = sim.width / species;

        for (let c = 0; c < species; c++) {
            const color = sorted[c];
            const count = perColor + (c < remainder ? 1 : 0);
            const xStart = c * stripWidth;
            const xEnd = (c + 1) * stripWidth;
            for (let i = 0; i < count; i++) {
                const x = xStart + Math.random() * (xEnd - xStart);
                const y = Math.random() * sim.height;
                const particle = new PD.Particle(x, y);
                particle.colorData = color;
                sim.particles.push(particle);
            }
        }
    }

    const SPAWNERS = {
        random: spawnRandom,
        bigbang: spawnBigBang,
        gradient: spawnMassGradient
    };

    /** Throws away all particles, bonds and intelligent particles and spawns a fresh population. */
    function init() {
        sim.particles = [];
        sim.nextParticleId = 0;
        PD.bonds.reset();

        const spawn = SPAWNERS[sim.initMode];
        if (spawn) spawn();

        sim.intelligent.list = [];
        sim.intelligent.nextColor = 0;

        sim.grid = new PD.SpatialGrid(sim.width, sim.height, PD.config.GRID_CELL_SIZE);
    }

    /** One physics step. */
    function step() {
        const particles = sim.particles;

        if (sim.grid) sim.grid.rebuild(particles);

        for (let i = 0; i < particles.length; i++) {
            particles[i].update(particles);
        }

        PD.donate.applyForces();
        PD.bonds.detectAndCreate(particles);
        PD.bonds.applyConstraints(particles);
        PD.life.detect(particles);
    }

    /**
     * Advances the fixed-step accumulator by one rendered frame.
     * @returns {number} how many physics steps were executed (0 in slow motion frames)
     */
    function advance() {
        sim.physicsAccumulator += sim.timescale;
        const steps = Math.min(PD.config.MAX_PHYSICS_STEPS_PER_FRAME, Math.floor(sim.physicsAccumulator));
        if (steps > 0) {
            sim.physicsAccumulator -= steps;
            for (let s = 0; s < steps; s++) step();
        }
        return steps;
    }

    /** Per-frame bookkeeping that runs after rendering. */
    function afterFrame() {
        if (sim.boundaryMode === 'endless') removeDead();
        if (sim.enabled.massHierarchy && sim.speciesCount >= 2) applyMassHierarchy();
    }

    /** In-place compaction of particles that left the world. */
    function removeDead() {
        const particles = sim.particles;
        let w = 0;
        for (let r = 0; r < particles.length; r++) {
            if (!particles[r].dead) particles[w++] = particles[r];
        }
        if (w < particles.length) {
            particles.length = w;
            sim.particleCount = w;
        }
    }

    /** Black becomes slightly heavier than the heaviest colour, white slightly lighter than the lightest. */
    function applyMassHierarchy() {
        const particles = sim.particles;
        const black = [];
        const white = [];
        let maxOther = -Infinity;
        let minOther = Infinity;
        let hasOther = false;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p._name === 'black') {
                black.push(p);
            } else if (p._name === 'white') {
                white.push(p);
            } else {
                const m = p._mass;
                if (m > maxOther) maxOther = m;
                if (m < minOther) minOther = m;
                hasOther = true;
            }
        }
        if (!hasOther) return;

        const blackMass = Math.min(2.0, maxOther + 0.1);
        for (let i = 0; i < black.length; i++) {
            black[i].colorData.mass = blackMass;
            black[i]._mass = blackMass;
        }
        const whiteMass = Math.max(0.3, minOther - 0.1);
        for (let i = 0; i < white.length; i++) {
            white[i].colorData.mass = whiteMass;
            white[i]._mass = whiteMass;
        }
    }

    /** Adds a time-loop particle at a canvas position. */
    function addIntelligentParticle(x, y) {
        const hue = (sim.intelligent.nextColor * 137.5) % 360; // golden angle -> distinct colours
        const p = new PD.IntelligentParticle(x, y, `hsl(${hue}, 80%, 60%)`);
        sim.particles.push(p);
        sim.intelligent.list.push(p);
        return p;
    }

    function removeIntelligentParticles() {
        sim.particles = sim.particles.filter(p => !p.isIntelligent);
        sim.intelligent.list = [];
        sim.intelligent.nextColor = 0;
    }

    PD.world = { init, step, advance, afterFrame, addIntelligentParticle, removeIntelligentParticles };
})(window.PD);
