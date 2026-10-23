/** Left panel: laws, world, time and view controls + the HUD line. */
(function (EM) {
    'use strict';

    const { $, fmt } = EM.ui;
    const app = EM.app;

    // ---------- panel toggles ----------
    document.querySelectorAll('[data-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => document.getElementById(btn.dataset.toggle).classList.toggle('open'));
    });

    // ---------- laws ----------
    const lawsSeed = $('lawsSeed'), types = $('typesInput'), typesValue = $('typesValue');

    $('newLawsBtn').addEventListener('click', () => app.newLaws(undefined, +types.value));
    $('loadLawsBtn').addEventListener('click', () => app.newLaws(+lawsSeed.value >>> 0, +types.value));
    lawsSeed.addEventListener('keydown', (e) => { if (e.key === 'Enter') app.newLaws(+lawsSeed.value >>> 0, +types.value); });
    types.addEventListener('input', () => { typesValue.textContent = types.value; });
    $('mutateBtn').addEventListener('click', () => app.mutate());

    $('exportBtn').addEventListener('click', () => {
        EM.ui.download(`emergence-laws-${app.settings.lawsSeed}.json`, app.exportGenome());
    });
    $('importBtn').addEventListener('click', async () => {
        const text = await EM.ui.pickFile('.json,application/json');
        try {
            app.loadGenome(EM.genome.fromJSON(text), 'file');
        } catch (e) {
            alert('Cannot load laws: ' + e.message);
        }
    });

    // ---------- world ----------
    const dimSelect = $('dimSelect');
    dimSelect.addEventListener('change', () => app.setDim(+dimSelect.value));
    const count = $('countInput'), countValue = $('countValue');
    count.addEventListener('input', () => { countValue.textContent = fmt(+count.value); });
    $('applyCountBtn').addEventListener('click', () => app.setCount(+count.value));
    $('restartBtn').addEventListener('click', () => app.restart(false));
    $('reseedBtn').addEventListener('click', () => app.restart(true));

    // ---------- time ----------
    const playBtn = $('playBtn');
    playBtn.addEventListener('click', () => app.togglePlay());
    const spf = $('speedInput'), spfValue = $('speedValue');
    spf.addEventListener('input', () => {
        app.settings.stepsPerFrame = +spf.value;
        spfValue.textContent = spf.value;
    });

    // ---------- view ----------
    const view = EM.renderer.view;
    [['viewBonds', 'bonds'], ['viewLight', 'light'], ['viewHeadings', 'headings'], ['viewEnclosures', 'enclosures']].forEach(([id, key]) => {
        const box = $(id);
        box.checked = view[key];
        box.addEventListener('change', () => { view[key] = box.checked; });
    });
    $('viewColor').addEventListener('change', (e) => { view.color = e.target.value; });
    $('fitBtn').addEventListener('click', () => EM.renderer.fit(app.world));
    const spin = $('viewSpin');
    spin.addEventListener('change', () => EM.renderer.setSpin(spin.checked));

    // ---------- refresh ----------
    const hud = $('hudStats'), originEl = $('lawsOrigin');
    const ORIGIN = { seed: 'from seed', mutation: 'mutated (export to keep)', lab: 'from Lab (export to keep)', file: 'from file' };

    function syncControls() {
        const s = app.settings;
        lawsSeed.value = s.lawsSeed;
        types.value = s.types;
        typesValue.textContent = s.types;
        count.value = s.count;
        countValue.textContent = fmt(s.count);
        spf.value = s.stepsPerFrame;
        spfValue.textContent = s.stepsPerFrame;
        originEl.textContent = ORIGIN[app.origin] || '';
        dimSelect.value = s.dim;
        // options that only make sense in one of the views
        document.querySelectorAll('[data-dim]').forEach((el) => { el.hidden = +el.dataset.dim !== s.dim; });
    }

    app.onChange(syncControls);

    EM.ui.register(() => {
        const w = app.world;
        if (!w) return;
        playBtn.textContent = app.settings.running ? '❚❚ Pause' : '▶ Play';
        const loop = EM.loop;
        hud.textContent = `${w.dim}D · step ${fmt(w.steps)} · ${fmt(w.n)} photons · ${fmt(w.bondCount)} bonds · ` +
            `${loop.fps} fps · ${loop.stepsPerSecond} steps/s · ${loop.msPerStep.toFixed(1)} ms/step`;
    });
})(EM);
