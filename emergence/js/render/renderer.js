/**
 * Draws the world: light field, enclosures, bonds, photons, headings and the
 * selected structure. Photons are batched by colour (one fillStyle per batch).
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;
    const BG = '#05060b';
    const ENERGY_LEVELS = 8;

    class Renderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.camera = new EM.Camera();
            this.view = {
                bonds: true,
                light: true,
                headings: true,
                enclosures: true,
                color: 'type'   // 'type' | 'energy'
            };
            this.lightCanvas = document.createElement('canvas');
            this.lightImage = null;
            this.selection = null; // { members: number[], label }
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
            const r = Math.max(1.2, Math.min(world.laws.coreR * 0.6, 2.6 / Math.sqrt(this.camera.zoom) + 0.6));
            const size = r * 2;

            if (this.view.color === 'energy') {
                const e = world.energy;
                for (let lvl = 0; lvl < ENERGY_LEVELS; lvl++) {
                    const t = lvl / (ENERGY_LEVELS - 1);
                    ctx.fillStyle = `rgb(${Math.round(40 + 215 * t)}, ${Math.round(60 + 160 * t)}, ${Math.round(140 - 100 * t)})`;
                    for (let i = 0; i < n; i++) {
                        if (Math.min(ENERGY_LEVELS - 1, (e[i] * ENERGY_LEVELS) | 0) === lvl) ctx.fillRect(x[i] - r, y[i] - r, size, size);
                    }
                }
                return;
            }

            const colors = world.laws.color;
            for (let t = 0; t < colors.length; t++) {
                ctx.fillStyle = colors[t];
                for (let i = 0; i < n; i++) if (type[i] === t) ctx.fillRect(x[i] - r, y[i] - r, size, size);
            }
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

    EM.Renderer = Renderer;
})(EM);
