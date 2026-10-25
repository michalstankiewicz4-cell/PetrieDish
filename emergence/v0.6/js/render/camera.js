/** Camera: zoom around the cursor, drag to pan, fit the world to the screen. */
(function (EM) {
    'use strict';

    const MIN_ZOOM = 0.2, MAX_ZOOM = 12;

    class Camera {
        constructor() {
            this.zoom = 1;      // screen px per world px
            this.x = 0;         // world point shown at the screen's top-left corner
            this.y = 0;
            this.screenW = 1;
            this.screenH = 1;
        }

        setScreen(w, h) {
            this.screenW = w;
            this.screenH = h;
        }

        fit(worldW, worldH) {
            this.zoom = Math.min(this.screenW / worldW, this.screenH / worldH);
            this.x = (worldW - this.screenW / this.zoom) / 2;
            this.y = (worldH - this.screenH / this.zoom) / 2;
        }

        toWorld(sx, sy) {
            return { x: this.x + sx / this.zoom, y: this.y + sy / this.zoom };
        }

        zoomAt(sx, sy, factor) {
            const before = this.toWorld(sx, sy);
            this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
            this.x = before.x - sx / this.zoom;
            this.y = before.y - sy / this.zoom;
        }

        pan(dsx, dsy) {
            this.x -= dsx / this.zoom;
            this.y -= dsy / this.zoom;
        }

        /** Applies the camera transform to a 2D context. */
        apply(ctx) {
            ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.x * this.zoom, -this.y * this.zoom);
        }
    }

    EM.Camera = Camera;
})(EM);
