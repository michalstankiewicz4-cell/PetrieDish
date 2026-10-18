/** Bottom "Visual FX" panel: effect buttons (data-effect/data-value) and presets. */
(function (PD) {
    'use strict';

    const vfx = PD.vfx;
    const { $ } = PD.dom;

    const btn = $('vfxBtn');
    const panel = $('vfxPanel');

    function setOpen(open) {
        panel.classList.toggle('open', open);
        btn.classList.toggle('open', open);
        // the floating button hides while the panel is open
        btn.style.opacity = open ? '0' : '';
        btn.style.pointerEvents = open ? 'none' : '';
    }

    btn.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    $('vfxCloseBtn').addEventListener('click', () => setOpen(false));

    const effectButtons = (effect) => document.querySelectorAll(`.vfx-effect-btn[data-effect="${effect}"]`);

    function markActive(effect, value) {
        effectButtons(effect).forEach((b) => b.classList.toggle('active', b.dataset.value === value));
    }

    /** Paint the new background at full opacity so the change is visible immediately. */
    function repaintBackground() {
        PD.render.clear(PD.loop.ctx, vfx.bgColor(vfx.bg, 1.0));
    }

    document.querySelectorAll('.vfx-effect-btn').forEach((b) => {
        b.addEventListener('click', () => {
            const { effect, value } = b.dataset;
            markActive(effect, value);
            vfx.set(effect, value);
            if (effect === 'bg') repaintBackground();
        });
    });

    const presetButtons = {
        microscope: $('vfxPresetMicroscope'),
        neon: $('vfxPresetNeon'),
        void: $('vfxPresetVoid'),
        reset: $('vfxPresetReset')
    };

    Object.entries(presetButtons).forEach(([name, presetBtn]) => {
        presetBtn.addEventListener('click', () => {
            const preset = vfx.PRESETS[name];
            Object.entries(preset).forEach(([effect, value]) => {
                vfx.set(effect, value);
                markActive(effect, value);
            });
            repaintBackground();
            document.querySelectorAll('.vfx-preset-btn').forEach((p) => p.classList.remove('active'));
            if (name !== 'reset') presetBtn.classList.add('active');
        });
    });

    PD.ui.vfxPanel = { isOpen: () => panel.classList.contains('open') };
})(window.PD);
