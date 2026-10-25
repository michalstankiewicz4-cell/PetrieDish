/**
 * EM.renderer: one facade over the 2D (Canvas) and 3D (WebGL) renderers, so
 * the rest of the app does not care which one is active. Created before the
 * UI modules, which use it at load time.
 */
(function (EM) {
    'use strict';

    const canvas2d = document.getElementById('world');
    const canvas3d = document.getElementById('world3d');

    /** View options shared by both renderers. */
    const view = {
        bonds: true,
        light: true,
        headings: false, // photons have no orientation in the current model
        labels: true,    // free strong bonds as a number on each photon (when zoomed in)
        enclosures: true,
        color: 'type' // 'type' | 'energy'
    };

    const r2d = new EM.Renderer2D(canvas2d, view);
    let r3d = null;
    let error3d = null;

    function get3d() {
        if (!r3d && !error3d) {
            try {
                r3d = new EM.Renderer3D(canvas3d, view);
            } catch (e) {
                error3d = e.message;
            }
        }
        return r3d;
    }

    EM.renderer = {
        view,
        dim: 2,
        _selection: null,

        get active() {
            return this.dim === 3 && get3d() ? r3d : r2d;
        },

        get selection() {
            return this._selection;
        },
        set selection(sel) {
            this._selection = sel;
            r2d.selection = sel;
            if (r3d) r3d.selection = sel;
        },

        /** Switches to the renderer for a 2D or 3D world. */
        setDim(dim) {
            this.dim = dim;
            const use3d = dim === 3 && get3d();
            if (dim === 3 && !use3d) alert('3D view needs WebGL2: ' + error3d);
            canvas2d.hidden = !!use3d;
            canvas3d.hidden = !use3d;
            this.selection = this._selection;
        },

        get error3d() {
            return error3d;
        },

        draw(world, observer) {
            this.active.draw(world, observer);
        },
        fit(world) {
            this.active.fit(world);
        },
        pick(world, sx, sy) {
            return this.active.pick(world, sx, sy);
        },
        resize() {
            r2d.resize();
            if (r3d) r3d.resize();
        },
        onWheel(e) {
            this.active.onWheel(e);
        },
        onDrag(dx, dy, e) {
            this.active.onDrag(dx, dy, e);
        },
        /** Auto-rotation of the 3D camera (rad per frame). */
        setSpin(on) {
            const r = get3d();
            if (r) r.camera.spin = on ? 0.003 : 0;
        }
    };
})(EM);
