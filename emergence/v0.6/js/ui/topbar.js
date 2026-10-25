/**
 * Top bar = main menu of the project: sections (World / Observe panels,
 * Elements and Machine learning pages of the atlas), quick controls
 * (play, fast forward, new laws, 2D/3D, CPU/GPU), live stats and help.
 * The panel toggles ([data-toggle]) are wired in world-panel.js.
 */
(function (EM) {
    'use strict';

    const { $ } = EM.ui;
    const app = EM.app;
    const bar = $('topbar');

    // sections
    bar.querySelectorAll('[data-atlas]').forEach((b) => {
        b.addEventListener('click', () => {
            EM.ui.atlas.show(b.dataset.atlas);
            sync();
        });
    });
    // opening a side panel while the atlas covers the screen: close the atlas first
    bar.querySelectorAll('[data-toggle]').forEach((b) => {
        b.addEventListener('click', () => {
            if (EM.ui.atlas.open) {
                // the panel was hidden behind the atlas: show it (world-panel.js just toggled it)
                EM.ui.atlas.toggle(false);
                document.getElementById(b.dataset.toggle).classList.add('open');
            }
            sync();
        });
    });
    $('tbBrand').addEventListener('click', (e) => {
        e.preventDefault();
        if (EM.ui.atlas.open) EM.ui.atlas.toggle(false);
        sync();
    });

    // quick controls
    $('tbPlay').addEventListener('click', () => app.togglePlay());
    $('tbFast').addEventListener('click', () => app.setFast(!app.fast));
    $('tbNew').addEventListener('click', () => app.newLaws());
    $('tbDim').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => app.setDim(+b.dataset.space)));
    $('tbBackend').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => app.setBackend(b.dataset.backend)));
    if (!EM.gpu.supported) {
        const gpuBtn = $('tbBackend').querySelector('[data-backend="gpu"]');
        gpuBtn.disabled = true;
        gpuBtn.title = 'WebGPU is not available in this browser';
    }

    // help dropdown
    const help = $('tbHelp'), helpBtn = $('tbHelpBtn');
    helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        help.hidden = !help.hidden;
        sync();
    });
    document.addEventListener('click', (e) => {
        if (!help.hidden && !help.contains(e.target)) {
            help.hidden = true;
            sync();
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !help.hidden) {
            help.hidden = true;
            sync();
        }
    });

    /** Highlights what is open / active. Cheap - runs with every UI refresh. */
    function sync() {
        const atlasOpen = EM.ui.atlas.open, tab = EM.ui.atlas.tab;
        bar.querySelectorAll('[data-toggle]').forEach((b) => {
            b.classList.toggle('on', document.getElementById(b.dataset.toggle).classList.contains('open') && !atlasOpen);
        });
        bar.querySelectorAll('[data-atlas]').forEach((b) => b.classList.toggle('on', atlasOpen && tab === b.dataset.atlas));
        helpBtn.classList.toggle('on', !help.hidden);

        const s = app.settings;
        const play = $('tbPlay');
        play.textContent = app.fast ? '▶' : (s.running ? '❚❚' : '▶');
        play.title = s.running ? 'Pause (Space)' : 'Play (Space)';
        $('tbFast').classList.toggle('active', app.fast);
        $('tbFast').textContent = app.fast ? '■' : '⏩';
        $('tbDim').querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.space === s.dim));
        $('tbBackend').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.backend === s.backend));
    }

    app.onChange(sync);
    EM.ui.register(sync);
    sync();
    EM.ui.topbar = { sync };
})(EM);
