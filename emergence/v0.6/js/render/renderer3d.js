/**
 * 3D renderer (WebGL2): photons as shaded spheres (point-sprite impostors -
 * one vertex per photon, the fragment shader draws a lit ball), bonds as lines,
 * suns and enclosures as soft glows, the world cube as a wire box.
 * Orbit camera: drag = rotate, right-drag / shift-drag = pan, wheel = zoom.
 */
(function (EM) {
    'use strict';

    const MV = EM.config.MAX_VALENCE;

    const BALL_VS = `#version 300 es
        in vec3 a_pos;
        in vec2 a_data;            // type, energy
        uniform mat4 u_view, u_proj;
        uniform float u_radius, u_viewH;
        uniform vec3 u_palette[8];
        uniform int u_mode;        // 0 = colour by type, 1 = by energy, 2 = flat colour
        uniform vec3 u_flat;
        out vec3 v_color;
        out float v_depth;
        void main() {
            vec4 vp = u_view * vec4(a_pos, 1.0);
            gl_Position = u_proj * vp;
            gl_PointSize = max(2.0, u_radius * u_proj[1][1] * u_viewH / -vp.z);
            v_depth = -vp.z;
            if (u_mode == 0) v_color = u_palette[int(a_data.x)];
            else if (u_mode == 1) v_color = mix(vec3(0.16, 0.24, 0.55), vec3(1.0, 0.86, 0.25), a_data.y);
            else v_color = u_flat;
        }`;

    const BALL_FS = `#version 300 es
        precision mediump float;
        in vec3 v_color;
        in float v_depth;
        uniform float u_fogNear, u_fogFar;
        out vec4 outColor;
        void main() {
            vec2 c = gl_PointCoord * 2.0 - 1.0;
            c.y = -c.y;
            float d2 = dot(c, c);
            if (d2 > 1.0) discard;
            vec3 n = vec3(c, sqrt(1.0 - d2));
            vec3 l = normalize(vec3(-0.45, 0.6, 0.65));
            float diff = max(dot(n, l), 0.0);
            float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
            vec3 col = v_color * (0.22 + 0.78 * diff) + vec3(spec * 0.45);
            float fog = clamp((v_depth - u_fogNear) / (u_fogFar - u_fogNear), 0.0, 1.0);
            outColor = vec4(mix(col, vec3(0.02, 0.025, 0.045), fog * 0.85), 1.0);
        }`;

    const GLOW_VS = `#version 300 es
        in vec3 a_pos;
        uniform mat4 u_view, u_proj;
        uniform float u_radius, u_viewH;
        void main() {
            vec4 vp = u_view * vec4(a_pos, 1.0);
            gl_Position = u_proj * vp;
            gl_PointSize = max(2.0, u_radius * u_proj[1][1] * u_viewH / -vp.z);
        }`;

    const GLOW_FS = `#version 300 es
        precision mediump float;
        uniform vec4 u_color;
        out vec4 outColor;
        void main() {
            vec2 c = gl_PointCoord * 2.0 - 1.0;
            float d2 = dot(c, c);
            if (d2 > 1.0) discard;
            outColor = vec4(u_color.rgb, u_color.a * (1.0 - d2) * (1.0 - d2));
        }`;

    const LINE_VS = `#version 300 es
        in vec3 a_pos;
        uniform mat4 u_view, u_proj;
        void main() { gl_Position = u_proj * u_view * vec4(a_pos, 1.0); }`;

    const LINE_FS = `#version 300 es
        precision mediump float;
        uniform vec4 u_color;
        out vec4 outColor;
        void main() { outColor = u_color; }`;

    function compile(gl, vsSrc, fsSrc) {
        const make = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        };
        const p = gl.createProgram();
        gl.attachShader(p, make(gl.VERTEX_SHADER, vsSrc));
        gl.attachShader(p, make(gl.FRAGMENT_SHADER, fsSrc));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = {};
        const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < nu; i++) {
            const info = gl.getActiveUniform(p, i);
            u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name);
        }
        return { p, u, pos: gl.getAttribLocation(p, 'a_pos'), data: gl.getAttribLocation(p, 'a_data') };
    }

    /** "hsl(h, s%, l%)" -> [r, g, b] in 0..1 */
    function hslToRgb(str) {
        const m = /hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/.exec(str);
        if (!m) return [1, 1, 1];
        const h = +m[1], s = +m[2] / 100, l = +m[3] / 100;
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [f(0), f(8), f(4)];
    }

    class OrbitCamera {
        constructor() {
            this.yaw = 0.7;
            this.pitch = 0.45;
            this.dist = 600;
            this.target = [0, 0, 0];
            this.fov = 0.9;
            this.spin = 0;   // auto-rotation (rad per frame)
        }

        eye() {
            const cp = Math.cos(this.pitch);
            return [
                this.target[0] + this.dist * cp * Math.sin(this.yaw),
                this.target[1] + this.dist * Math.sin(this.pitch),
                this.target[2] + this.dist * cp * Math.cos(this.yaw)
            ];
        }

        fit(world) {
            this.target = [world.width / 2, world.height / 2, world.depth / 2];
            this.dist = Math.max(world.width, world.height, world.depth) * 1.55;
        }

        rotate(dx, dy) {
            this.yaw -= dx * 0.006;
            this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + dy * 0.006));
        }

        zoom(factor) {
            this.dist = Math.max(20, Math.min(20000, this.dist * factor));
        }

        /** Moves the target in the view plane. */
        pan(dx, dy, view) {
            const s = this.dist * 0.0015;
            // view matrix rows: right = (v0, v4, v8), up = (v1, v5, v9)
            for (let k = 0; k < 3; k++) this.target[k] += (-dx * view[k * 4] + dy * view[k * 4 + 1]) * s;
        }
    }

    class Renderer3D {
        constructor(canvas, view) {
            this.canvas = canvas;
            this.view = view;
            this.camera = new OrbitCamera();
            this.selection = null;
            const gl = this.gl = canvas.getContext('webgl2', { antialias: true });
            if (!gl) throw new Error('WebGL2 is not available');
            this.balls = compile(gl, BALL_VS, BALL_FS);
            this.glow = compile(gl, GLOW_VS, GLOW_FS);
            this.lines = compile(gl, LINE_VS, LINE_FS);
            this.posBuf = gl.createBuffer();
            this.dataBuf = gl.createBuffer();
            this.lineBuf = gl.createBuffer();
            this.miscBuf = gl.createBuffer();
            this.pos = new Float32Array(0);
            this.data = new Float32Array(0);
            this.lineData = new Float32Array(0);
            this.palette = new Float32Array(24);
            this.paletteFor = null;
            this.viewM = null;
            this.projM = null;
            this.resize();
        }

        resize() {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = window.innerWidth, h = window.innerHeight;
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
            this.canvas.style.width = w + 'px';
            this.canvas.style.height = h + 'px';
            this.cssW = w;
            this.cssH = h;
        }

        fit(world) {
            this.camera.fit(world);
        }

        matrices(world) {
            const cam = this.camera;
            cam.yaw += cam.spin;
            const far = cam.dist + Math.max(world.width, world.height, world.depth) * 2;
            this.viewM = EM.mat4.lookAt(cam.eye(), cam.target, [0, 1, 0]);
            this.projM = EM.mat4.perspective(cam.fov, this.canvas.width / this.canvas.height, 2, far);
        }

        draw(world, observer) {
            const gl = this.gl, n = world.n;
            this.matrices(world);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.clearColor(0.02, 0.025, 0.045, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);

            this.drawBox(world);
            if (this.view.bonds && world.bondCount > 0) this.drawBonds(world);

            // photons
            if (this.pos.length < n * 3) {
                this.pos = new Float32Array(n * 3);
                this.data = new Float32Array(n * 2);
            }
            const pos = this.pos, data = this.data;
            for (let i = 0; i < n; i++) {
                pos[i * 3] = world.x[i];
                pos[i * 3 + 1] = world.y[i];
                pos[i * 3 + 2] = world.z[i];
                data[i * 2] = world.type[i];
                data[i * 2 + 1] = world.energy[i];
            }
            if (this.paletteFor !== world.laws) {
                this.paletteFor = world.laws;
                world.laws.color.forEach((c, t) => this.palette.set(hslToRgb(c), t * 3));
            }
            const radius = world.laws.coreR * 0.75;
            this.drawBalls(pos, data, n, radius, this.view.color === 'energy' ? 1 : 0);

            if (this.selection && this.selection.members.length) {
                const m = this.selection.members;
                const sp = new Float32Array(m.length * 3);
                m.forEach((i, k) => { sp[k * 3] = world.x[i]; sp[k * 3 + 1] = world.y[i]; sp[k * 3 + 2] = world.z[i]; });
                this.drawBalls(sp, null, m.length, radius * 1.35, 2, [1, 1, 1]);
            }

            // translucent: suns and enclosures
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            if (this.view.light) this.drawSuns(world);
            if (this.view.enclosures && observer && observer.enclosures && observer.enclosures.cellD) this.drawEnclosures(observer.enclosures);
            gl.depthMask(true);
            gl.disable(gl.BLEND);
        }

        bindAttrib(buf, loc, size, array, count) {
            const gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, array.subarray(0, count * size), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        }

        drawBalls(pos, data, count, radius, mode, flat) {
            const gl = this.gl, s = this.balls;
            gl.useProgram(s.p);
            gl.uniformMatrix4fv(s.u.u_view, false, this.viewM);
            gl.uniformMatrix4fv(s.u.u_proj, false, this.projM);
            gl.uniform1f(s.u.u_radius, radius);
            gl.uniform1f(s.u.u_viewH, this.canvas.height);
            gl.uniform3fv(s.u.u_palette, this.palette);
            gl.uniform1i(s.u.u_mode, mode);
            gl.uniform3fv(s.u.u_flat, flat || [1, 1, 1]);
            gl.uniform1f(s.u.u_fogNear, this.camera.dist * 0.6);
            gl.uniform1f(s.u.u_fogFar, this.camera.dist * 2.2);
            this.bindAttrib(this.posBuf, s.pos, 3, pos, count);
            if (data) {
                this.bindAttrib(this.dataBuf, s.data, 2, data, count);
            } else {
                gl.disableVertexAttribArray(s.data);
                gl.vertexAttrib2f(s.data, 0, 0);
            }
            gl.drawArrays(gl.POINTS, 0, count);
        }

        drawLines(array, count, color) {
            const gl = this.gl, s = this.lines;
            gl.useProgram(s.p);
            gl.uniformMatrix4fv(s.u.u_view, false, this.viewM);
            gl.uniformMatrix4fv(s.u.u_proj, false, this.projM);
            gl.uniform4fv(s.u.u_color, color);
            this.bindAttrib(this.lineBuf, s.pos, 3, array, count);
            gl.drawArrays(gl.LINES, 0, count);
        }

        drawBox(world) {
            const W = world.width, H = world.height, D = world.depth;
            const c = [[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0], [0, 0, D], [W, 0, D], [W, H, D], [0, H, D]];
            const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
            const a = new Float32Array(e.length * 3);
            e.forEach((v, k) => a.set(c[v], k * 3));
            this.drawLines(a, e.length, [0.47, 0.55, 1, 0.35]);
        }

        drawBonds(world) {
            const x = world.x, y = world.y, z = world.z, deg = world.deg, partner = world.partner;
            const hw = world.width / 2, hh = world.height / 2, hd = world.depth / 2;
            const need = world.bondCount * 6;
            if (this.lineData.length < need) this.lineData = new Float32Array(need * 2);
            const a = this.lineData;
            let k = 0;
            for (let i = 0; i < world.n; i++) {
                for (let s = 0; s < deg[i]; s++) {
                    const j = partner[i * MV + s];
                    if (j < i) continue;
                    const dx = x[j] - x[i], dy = y[j] - y[i], dz = z[j] - z[i];
                    if (dx > hw || dx < -hw || dy > hh || dy < -hh || dz > hd || dz < -hd) continue; // crosses the wrap
                    a[k++] = x[i]; a[k++] = y[i]; a[k++] = z[i];
                    a[k++] = x[j]; a[k++] = y[j]; a[k++] = z[j];
                }
            }
            this.drawLines(a, k / 3, [0.75, 0.82, 1, 0.55]);
        }

        drawGlow(points, count, radius, color) {
            const gl = this.gl, s = this.glow;
            gl.useProgram(s.p);
            gl.uniformMatrix4fv(s.u.u_view, false, this.viewM);
            gl.uniformMatrix4fv(s.u.u_proj, false, this.projM);
            gl.uniform1f(s.u.u_radius, radius);
            gl.uniform1f(s.u.u_viewH, this.canvas.height);
            gl.uniform4fv(s.u.u_color, color);
            this.bindAttrib(this.miscBuf, s.pos, 3, points, count);
            gl.drawArrays(gl.POINTS, 0, count);
        }

        drawSuns(world) {
            const gl = this.gl;
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            const day = world.light.day;
            for (const sun of world.light.suns) {
                this.drawGlow(new Float32Array([sun.x, sun.y, sun.z]), 1, sun.r, [1, 0.78, 0.35, 0.22 * day]);
            }
        }

        drawEnclosures(enc) {
            const gl = this.gl;
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            const cols = enc.cols, rows = enc.rows;
            let total = 0;
            enc.regions.forEach((r) => { total += r.cells.length; });
            if (!total) return;
            const pts = new Float32Array(total * 3);
            let k = 0;
            for (const r of enc.regions) {
                for (const c of r.cells) {
                    pts[k++] = (c % cols + 0.5) * enc.cellW;
                    pts[k++] = (((c / cols) | 0) % rows + 0.5) * enc.cellH;
                    pts[k++] = (((c / (cols * rows)) | 0) + 0.5) * enc.cellD;
                }
            }
            this.drawGlow(pts, total, enc.cellW * 0.9, [0.3, 1, 0.65, 0.35]);
        }

        /** Photon nearest to a screen point (front-most among close ones), or -1. */
        pick(world, sx, sy, maxScreenDist = 10) {
            if (!this.viewM) return -1;
            const vp = EM.mat4.multiply(this.projM, this.viewM);
            let best = -1, bestScore = Infinity;
            for (let i = 0; i < world.n; i++) {
                const [cx, cy, , cw] = EM.mat4.transform(vp, world.x[i], world.y[i], world.z[i]);
                if (cw <= 0) continue;
                const px = (cx / cw * 0.5 + 0.5) * this.cssW, py = (0.5 - cy / cw * 0.5) * this.cssH;
                const d = Math.hypot(px - sx, py - sy);
                if (d > maxScreenDist) continue;
                const score = d + cw * 0.01; // prefer nearer photons when overlapping
                if (score < bestScore) { bestScore = score; best = i; }
            }
            return best;
        }

        onWheel(e) {
            this.camera.zoom(e.deltaY < 0 ? 1 / 1.12 : 1.12);
        }

        onDrag(dx, dy, e) {
            if (e.buttons === 2 || e.shiftKey) this.camera.pan(dx, dy, this.viewM || new Float32Array(16));
            else this.camera.rotate(dx, dy);
        }
    }

    EM.Renderer3D = Renderer3D;
})(EM);
