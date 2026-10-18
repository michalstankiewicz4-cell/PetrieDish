/**
 * Visual FX state: background colour, trail length (background alpha),
 * particle style, overlay and CSS filter.
 */
(function (PD) {
    'use strict';

    const BG_RGB = {
        'dark': '10, 10, 20',
        'white': '255, 255, 255',
        'deep-space': '0, 0, 8',
        'matrix': '0, 10, 0'
    };

    /** Background alpha per trail preset: lower alpha = previous frames fade slower = longer trails. */
    const TRAIL_ALPHA = {
        normal: 0.15,
        long: 0.04,
        sharp: 1.0,
        ghost: 0.008
    };

    const CSS_FILTERS = {
        none: 'none',
        bw: 'grayscale(1)',
        sepia: 'sepia(0.85)',
        invert: 'invert(1)'
    };

    /** Full VFX presets (buttons in the PRESETS row). */
    const PRESETS = {
        microscope: { bg: 'white', trail: 'sharp', style: 'ring', overlay: 'vignette', filter: 'bw' },
        neon: { bg: 'dark', trail: 'long', style: 'glow', overlay: 'vignette', filter: 'none' },
        void: { bg: 'deep-space', trail: 'ghost', style: 'circle', overlay: 'none', filter: 'none' },
        reset: { bg: 'dark', trail: 'normal', style: 'circle', overlay: 'none', filter: 'none' }
    };

    function bgColor(bg, alpha) {
        return `rgba(${BG_RGB[bg] || BG_RGB.dark}, ${alpha})`;
    }

    const vfx = {
        bg: 'dark',
        trail: 'sharp',
        style: 'circle',         // 'circle' | 'star' | 'ring' | 'glow'
        overlay: 'none',         // 'none' | 'scanlines' | 'vignette' | 'rainbow'
        filter: 'none',          // 'none' | 'bw' | 'sepia' | 'invert'
        /** Colour used to clear the canvas every frame (alpha < 1 leaves trails). */
        frameBg: 'rgba(10, 10, 20, 1.0)',
        rainbowPhase: 0,

        PRESETS,
        bgColor,

        /** Sets one effect ('bg' | 'trail' | 'style' | 'overlay' | 'filter'). */
        set(effect, value) {
            vfx[effect] = value;
            if (effect === 'bg' || effect === 'trail') {
                vfx.frameBg = bgColor(vfx.bg, TRAIL_ALPHA[vfx.trail] !== undefined ? TRAIL_ALPHA[vfx.trail] : 0.15);
            }
        },

        cssFilter() {
            return CSS_FILTERS[vfx.filter] || 'none';
        }
    };

    PD.vfx = vfx;
})(window.PD);
