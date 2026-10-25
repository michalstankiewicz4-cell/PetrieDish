/**
 * 2D renderer (Canvas 2D): light field, enclosures, bonds, photons as shaded
 * balls (one pre-rendered sprite per colour, drawn with drawImage), headings
 * and the selected structure. Wheel = zoom at cursor, drag = pan.
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;
    const BG = '#05060b';
    const ENERGY_LEVELS = 8;
    const SPRITE = 32; // px of a pre-rendered ball

    /** A shaded ball (highlight top-left, dark rim) in the given colour. */
    function ballSprite(color) {
        const c = document.createElement('canvas');
        c.width = c.height = SPRITE;
        const g = c.getContext('2d');
        const r = SPRITE / 2;
        // base colour
        g.fillStyle = color;
        g.beginPath();
        g.arc(r, r, r - 0.5, 0, Math.PI * 2);
        g.fill();
        // shading: light from the top-left, dark rim
        const shade = g.createRadialGradient(r * 0.65, r * 0.6, r * 0.05, r, r, r);
        shade.addColorStop(0, 'rgba(255,255,255,0.75)');
        shade.addColorStop(0.25, 'rgba(255,255,255,0.12)');
        shade.addColorStop(0.7, 'rgba(0,0,0,0.15)');
        shade.addColorStop(1, 'rgba(0,0,0,0.6)');
        g.fillStyle = shade;
        g.beginPath();
        g.arc(r, r, r - 0.5, 0, Math.PI * 2);
        g.fill();
        return c;
    }

    class Renderer2D {
        constructor(canvas, view) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.camera = new EM.Camera();
            this.view = view;
            this.selection = null;
            this.sprites = new Map(); // colour -> sprite canvas
            this.lightCanvas = document.createElement('canvas');
            this.lightImage = null;
            this.resize();
        }

        resize() {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = window.innerWidth, h = window.innerHeight;
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
            this.canvas.style.width = w + 'px';
            this.canvas.style.height = h + 'px';
            this.dpr = dpr;
            this.camera.setScreen(w, h);
        }

        sprite(color) {
            let s = this.sprites.get(color);
            if (!s) {
                s = ballSprite(color);
                this.sprites.set(color, s);
            }
            return s;
        }

        fit(world) {
            this.camera.fit(world.width, world.height);
        }

        onWheel(e) {
            this.camera.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
        }

        onDrag(dx, dy) {
            this.camera.pan(dx, dy);
        }

        draw(world, observer) {
            const ctx = this.ctx, cam = this.camera, v = this.view;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = BG;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.save();
            ctx.scale(cam.zoom, cam.zoom);
            ctx.translate(-cam.x, -cam.y);

            // world frame
            ctx.fillStyle = '#0a0c16';
            ctx.fillRect(0, 0, world.width, world.height);

            if (v.light) this.drawLight(world);
            if (v.enclosures && observer && observer.enclosures) this.drawEnclosures(observer.enclosures);
            if (v.bonds && world.bondCount > 0) this.drawBonds(world);
            this.drawPhotons(world);
            if (v.labels && world.laws.valence[0] > 0 && world.laws.radius * cam.zoom >= 7) this.drawLabels(world);
            if (v.headings && world.laws.hasOrientation && cam.zoom >= 1.6) this.drawHeadings(world);
            if (this.selection) this.drawSelection(world);

            ctx.strokeStyle = 'rgba(120, 140, 255, 0.25)';
            ctx.lineWidth = 1 / cam.zoom;
            ctx.strokeRect(0, 0, world.width, world.height);
            ctx.restore();
        }

        drawLight(world) {
            const light = world.light, ctx = this.ctx;
            const cols = light.cols, rows = light.rows;
            if (!this.lightImage || this.lightImage.width !== cols || this.lightImage.height !== rows) {
                this.lightCanvas.width = cols;
                this.lightCanvas.height = rows;
                this.lightImage = this.lightCanvas.getContext('2d').createImageData(cols, rows);
            }
            const data = this.lightImage.data, f = light.field;
            for (let i = 0; i < f.length; i++) {
                const v = Math.min(1, f[i]);
                data[i * 4] = 255;
                data[i * 4 + 1] = 200;
                data[i * 4 + 2] = 90;
                data[i * 4 + 3] = v * 46;
            }
            this.lightCanvas.getContext('2d').putImageData(this.lightImage, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(this.lightCanvas, 0, 0, cols * EM.Light.CELL, rows * EM.Light.CELL);
        }

        drawEnclosures(enc) {
            const ctx = this.ctx, cw = enc.cellW, ch = enc.cellH, cols = enc.cols;
            for (const r of enc.regions) {
                const old = (r.age || 0) >= EM.config.STABLE_PASSES;
                ctx.fillStyle = old ? 'rgba(80, 255, 170, 0.32)' : 'rgba(80, 255, 170, 0.14)';
                for (const c of r.cells) ctx.fillRect((c % cols) * cw, ((c / cols) | 0) * ch, cw, ch);
            }
        }

        drawBonds(world) {
            const ctx = this.ctx, x = world.x, y = world.y, deg = world.deg, partner = world.partner;
            const hw = world.width / 2, hh = world.height / 2;
            ctx.strokeStyle = 'rgba(190, 210, 255, 0.35)';
            ctx.lineWidth = Math.max(0.6, 1 / this.camera.zoom);
            ctx.beginPath();
            for (let i = 0; i < world.n; i++) {
                for (let s = 0; s < deg[i]; s++) {
                    const j = partner[i * MV + s];
                    if (j < i) continue;
                    const dx = x[j] - x[i], dy = y[j] - y[i];
                    if (dx > hw || dx < -hw || dy > hh || dy < -hh) continue; // bond across the torus edge
                    ctx.moveTo(x[i], y[i]);
                    ctx.lineTo(x[j], y[j]);
                }
            }
            ctx.stroke();
        }

        drawPhotons(world) {
            const ctx = this.ctx, x = world.x, y = world.y, n = world.n, type = world.type;
            // every photon has the same radius (world units), but never under ~1.5 screen px
            const r = Math.max(world.laws.radius, 1.5 / this.camera.zoom);
            const size = r * 2;
            ctx.imageSmoothingEnabled = true;

            if (this.view.color === 'energy') {
                const e = world.energy;
                for (let lvl = 0; lvl < ENERGY_LEVELS; lvl++) {
                    const t = lvl / (ENERGY_LEVELS - 1);
                    const img = this.sprite(`rgb(${Math.round(40 + 215 * t)}, ${Math.round(60 + 160 * t)}, ${Math.round(140 - 100 * t)})`);
                    for (let i = 0; i < n; i++) {
                        if (Math.min(ENERGY_LEVELS - 1, (e[i] * ENERGY_LEVELS) | 0) === lvl) ctx.drawImage(img, x[i] - r, y[i] - r, size, size);
                    }
                }
                return;
            }

            const colors = world.laws.color;
            for (let t = 0; t < colors.length; t++) {
                const img = this.sprite(colors[t]);
                for (let i = 0; i < n; i++) if (type[i] === t) ctx.drawImage(img, x[i] - r, y[i] - r, size, size);
            }
        }

        /** Free strong bonds on each visible photon (only when zoomed in). */
        drawLabels(world) {
            const ctx = this.ctx, cam = this.camera, x = world.x, y = world.y, deg = world.deg;
            const r = world.laws.radius;
            const x0 = cam.x - r, y0 = cam.y - r;
            const x1 = cam.x + cam.screenW / cam.zoom + r, y1 = cam.y + cam.screenH / cam.zoom + r;
            ctx.font = `600 ${(r * 1.25).toFixed(2)}px ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(6, 8, 16, 0.85)';
            for (let i = 0; i < world.n; i++) {
                if (x[i] < x0 || x[i] > x1 || y[i] < y0 || y[i] > y1) continue;
                ctx.fillText(String(Math.max(0, EM.bonds.allowed(world, i) - deg[i])), x[i], y[i] + r * 0.06);
            }
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }

        drawHeadings(world) {
            const ctx = this.ctx, x = world.x, y = world.y, th = world.theta, n = world.n;
            const len = world.laws.coreR * 1.1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                ctx.moveTo(x[i], y[i]);
                ctx.lineTo(x[i] + Math.cos(th[i]) * len, y[i] + Math.sin(th[i]) * len);
            }
            ctx.stroke();
        }

        drawSelection(world) {
            const ctx = this.ctx, sel = this.selection;
            const r = world.laws.coreR * 1.2;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2 / this.camera.zoom;
            ctx.beginPath();
            for (const i of sel.members) {
                ctx.moveTo(world.x[i] + r, world.y[i]);
                ctx.arc(world.x[i], world.y[i], r, 0, Math.PI * 2);
            }
            ctx.stroke();
        }

        /** Index of the photon nearest to a screen point (or -1). */
        pick(world, sx, sy, maxScreenDist = 12) {
            const p = this.camera.toWorld(sx, sy);
            const max = maxScreenDist / this.camera.zoom, max2 = max * max;
            let best = -1, bestD = max2;
            for (let i = 0; i < world.n; i++) {
                const dx = world.x[i] - p.x, dy = world.y[i] - p.y, d2 = dx * dx + dy * dy;
                if (d2 < bestD) { bestD = d2; best = i; }
            }
            return best;
        }
    }

    EM.Renderer2D = Renderer2D;
})(EM);
