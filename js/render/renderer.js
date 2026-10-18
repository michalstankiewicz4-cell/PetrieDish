/** Canvas drawing for particles, bonds, life forms and overlays. */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const vfx = PD.vfx;
    const TWO_PI = Math.PI * 2;
    const LIFE_COLOR = '#00FF88';
    const LIFE_DASH = [5, 5];
    const NO_DASH = [];

    // ---------- particles ----------

    function drawStar(ctx, x, y, radius) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        const r = radius * 1.8;
        const ir = radius * 0.7;
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const innerAngle = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2;
            if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
            else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            ctx.lineTo(Math.cos(innerAngle) * ir, Math.sin(innerAngle) * ir);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawParticle(ctx, p) {
        const radius = p._mass * 2.0;
        const color = p.colorData.hex;
        ctx.globalAlpha = p.alpha;

        switch (vfx.style) {
            case 'glow':
                ctx.shadowBlur = 30;
                ctx.shadowColor = color;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius * 1.3, 0, TWO_PI);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;
            case 'ring':
                ctx.shadowBlur = 8;
                ctx.shadowColor = color;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius + 2, 0, TWO_PI);
                ctx.stroke();
                ctx.shadowBlur = 0;
                break;
            case 'star':
                ctx.shadowBlur = 10;
                ctx.shadowColor = color;
                ctx.fillStyle = color;
                drawStar(ctx, p.x, p.y, radius);
                ctx.shadowBlur = 0;
                break;
            default:
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, TWO_PI);
                ctx.fill();
        }

        ctx.globalAlpha = 1;
    }

    function drawIntelligentParticle(ctx, p) {
        const color = p.colorData.hex;
        const useGlow = vfx.style === 'glow' || vfx.style === 'star' || vfx.style === 'ring';

        // Ghost of the predicted future position + dashed line to it
        if (sim.intelligent.showGhost && sim.intelligent.futureFrames > 0) {
            if (useGlow) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = color;
            }
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(p.futureX, p.futureY, p.radius, 0, TWO_PI);
            ctx.fill();
            if (useGlow) ctx.shadowBlur = 0;

            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.2;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.futureX, p.futureY);
            ctx.stroke();
            ctx.setLineDash(NO_DASH);
        }

        if (useGlow) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = color;
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, TWO_PI);
        ctx.fill();

        // Ring marks the particle as intelligent
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 3, 0, TWO_PI);
        ctx.stroke();

        if (useGlow) ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    // ---------- draw order ----------

    // Reused buckets: white first, then black, then the rest (keeps dark/light particles readable)
    const whiteP = [], blackP = [], otherP = [];

    function drawOrder(particles) {
        whiteP.length = 0; blackP.length = 0; otherP.length = 0;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p._name === 'white') whiteP.push(p);
            else if (p._name === 'black') blackP.push(p);
            else otherP.push(p);
        }
        return whiteP.concat(blackP, otherP);
    }

    // ---------- bonds / life ----------

    function drawBonds(ctx, particles) {
        const active = sim.bonds.active;
        if (!sim.enabled.bonds || active.length === 0) return;

        const map = PD.bonds.particleMap(particles);
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.6;
        ctx.shadowBlur = 0;

        for (let b = 0; b < active.length; b++) {
            const p1 = map.get(active[b].p1);
            const p2 = map.get(active[b].p2);
            if (!p1 || !p2) continue;
            ctx.strokeStyle = p1.colorData.hex;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawLifeForms(ctx) {
        const forms = sim.life.forms;
        if (!sim.enabled.lifeDetection || forms.length === 0) return;

        ctx.strokeStyle = LIFE_COLOR;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.setLineDash(LIFE_DASH);

        for (let index = 0; index < forms.length; index++) {
            const cluster = forms[index];
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let avgVx = 0, avgVy = 0;
            for (let i = 0; i < cluster.length; i++) {
                const p = cluster[i];
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
                avgVx += p.vx;
                avgVy += p.vy;
            }
            avgVx /= cluster.length;
            avgVy /= cluster.length;
            const avgSpeed = Math.sqrt(avgVx * avgVx + avgVy * avgVy);

            const pad = 10;
            minX -= pad; minY -= pad; maxX += pad; maxY += pad;
            ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

            ctx.fillStyle = LIFE_COLOR;
            ctx.font = '10px Orbitron';
            ctx.fillText(`Life #${index + 1} | ${cluster.length} particles | ${avgSpeed.toFixed(1)} speed`, minX, minY - 5);
        }

        ctx.globalAlpha = 1;
        ctx.setLineDash(NO_DASH);
    }

    // ---------- overlays ----------

    let scanlineCanvas = null;
    let vignette = null, vignetteW = 0, vignetteH = 0;
    let appliedFilter = null;

    function scanlines(w, h) {
        if (scanlineCanvas && scanlineCanvas.width === w && scanlineCanvas.height === h) return scanlineCanvas;
        scanlineCanvas = document.createElement('canvas');
        scanlineCanvas.width = w;
        scanlineCanvas.height = h;
        const sctx = scanlineCanvas.getContext('2d');
        sctx.fillStyle = '#000000';
        for (let y = 0; y < h; y += 4) sctx.fillRect(0, y, w, 2);
        return scanlineCanvas;
    }

    function drawVfxOverlay(ctx) {
        const W = sim.width, H = sim.height;

        // CSS filter is applied to the canvas element (HUD stays unfiltered); only touch the DOM on change
        const filter = vfx.cssFilter();
        if (filter !== appliedFilter) {
            appliedFilter = filter;
            ctx.canvas.style.filter = filter;
        }

        switch (vfx.overlay) {
            case 'scanlines':
                ctx.globalAlpha = 0.08;
                ctx.drawImage(scanlines(W, H), 0, 0);
                ctx.globalAlpha = 1;
                break;
            case 'vignette':
                if (!vignette || vignetteW !== W || vignetteH !== H) {
                    vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
                    vignette.addColorStop(0, 'rgba(0,0,0,0)');
                    vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
                    vignetteW = W;
                    vignetteH = H;
                }
                ctx.globalAlpha = 1;
                ctx.fillStyle = vignette;
                ctx.fillRect(0, 0, W, H);
                break;
            case 'rainbow':
                vfx.rainbowPhase = (vfx.rainbowPhase + 0.5) % 360;
                ctx.globalAlpha = 0.07;
                ctx.fillStyle = `hsl(${vfx.rainbowPhase}, 100%, 60%)`;
                ctx.fillRect(0, 0, W, H);
                ctx.globalAlpha = 1;
                break;
        }
    }

    function drawMouseCursor(ctx) {
        const m = sim.mouse;
        if (!m.pressed) return;
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, PD.config.MOUSE_RANGE, 0, TWO_PI);
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 245, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 5, 0, TWO_PI);
        ctx.fill();
    }

    // ---------- frame ----------

    /** Fills the whole canvas (used after re-initialising the world). */
    function clear(ctx, color) {
        ctx.fillStyle = color || PD.config.CLEAR_COLOR;
        ctx.fillRect(0, 0, sim.width, sim.height);
    }

    /** Clears with the VFX background (alpha < 1 = trails). */
    function beginFrame(ctx) {
        clear(ctx, vfx.frameBg);
    }

    /**
     * Draws the simulation.
     * @param {boolean} drawAll draw every particle; otherwise only those moved since the last draw
     */
    function drawWorld(ctx, drawAll) {
        const ordered = drawOrder(sim.particles);
        drawBonds(ctx, ordered);
        for (let i = 0; i < ordered.length; i++) {
            const p = ordered[i];
            if (drawAll) {
                p.draw(ctx);
            } else if (p._dirty) {
                p.draw(ctx);
                p._dirty = false;
            }
        }
        drawLifeForms(ctx);
    }

    /** Draws every particle without touching dirty flags (frozen at speed 0). */
    function drawFrozen(ctx) {
        const particles = sim.particles;
        for (let i = 0; i < particles.length; i++) particles[i].draw(ctx);
    }

    function endFrame(ctx) {
        drawVfxOverlay(ctx);
        drawMouseCursor(ctx);
    }

    PD.render = {
        drawParticle,
        drawIntelligentParticle,
        clear,
        beginFrame,
        drawWorld,
        drawFrozen,
        endFrame
    };
})(window.PD);
