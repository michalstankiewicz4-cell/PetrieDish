/** Left panel: laws, world, time and view controls + the HUD line. */
(function (EM) {
    'use strict';

    const { $, fmt } = EM.ui;
    const app = EM.app;

    // ---------- panel toggles ----------
    document.querySelectorAll('[data-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const panel = document.getElementById(btn.dataset.toggle);
            panel.classList.toggle('open');
            // panels on the same side share the space: opening one closes the others
            if (panel.classList.contains('open') && panel.dataset.side) {
                document.querySelectorAll(`.panel[data-side="${panel.dataset.side}"]`).forEach((p) => { if (p !== panel) p.classList.remove('open'); });
            }
        });
    });

    // ---------- laws ----------
    const lawsSeed = $('lawsSeed'), pressure = $('pressureInput'), pressureValue = $('pressureValue');

    $('newLawsBtn').addEventListener('click', () => app.newLaws());
    $('loadLawsBtn').addEventListener('click', () => app.newLaws(+lawsSeed.value >>> 0));
    lawsSeed.addEventListener('keydown', (e) => { if (e.key === 'Enter') app.newLaws(+lawsSeed.value >>> 0); });
    // pressure acts live on the running world (environment, not a restart)
    pressure.addEventListener('input', () => {
        app.setPressure(+pressure.value);
        pressureValue.textContent = (+pressure.value).toFixed(2);
    });
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
    const backendSelect = $('backendSelect');
    if (!EM.gpu.supported) {
        backendSelect.querySelector('[value="gpu"]').disabled = true;
        backendSelect.title = 'WebGPU is not available in this browser';
    }
    backendSelect.addEventListener('change', () => app.setBackend(backendSelect.value));
    const count = $('countInput'), countValue = $('countValue');
    count.addEventListener('input', () => { countValue.textContent = fmt(+count.value); });
    $('applyCountBtn').addEventListener('click', () => app.setCount(+count.value));
    $('restartBtn').addEventListener('click', () => app.restart(false));
    $('reseedBtn').addEventListener('click', () => app.restart(true));

    // ---------- time ----------
    const playBtn = $('playBtn');
    playBtn.addEventListener('click', () => app.togglePlay());
    const fastBtn = $('fastBtn');
    fastBtn.addEventListener('click', () => app.setFast(!app.fast));
    $('fastStopBtn').addEventListener('click', () => app.setFast(false));
    const spf = $('speedInput'), spfValue = $('speedValue');
    spf.addEventListener('input', () => {
        app.settings.stepsPerFrame = +spf.value;
        spfValue.textContent = spf.value;
    });

    // ---------- view ----------
    const view = EM.renderer.view;
    [['viewBonds', 'bonds'], ['viewLight', 'light'], ['viewEnclosures', 'enclosures'], ['viewLabels', 'labels']].forEach(([id, key]) => {
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
    const ORIGIN = { seed: 'from seed', mutation: 'mutated (export to keep)', lab: 'from Lab (export to keep)', file: 'from file', edited: 'edited (export to keep)' };

    function syncControls() {
        const s = app.settings;
        lawsSeed.value = s.lawsSeed;
        if (app.world) {
            pressure.value = app.world.laws.pressure;
            pressureValue.textContent = app.world.laws.pressure.toFixed(2);
        }
        const lim = app.countLimits();
        count.min = lim.min;
        count.max = s.backend === 'gpu' ? lim.max : 20000;
        count.step = s.backend === 'gpu' ? 2000 : 500;
        count.value = s.count;
        backendSelect.value = s.backend;
        countValue.textContent = fmt(s.count);
        spf.value = s.stepsPerFrame;
        spfValue.textContent = s.stepsPerFrame;
        originEl.textContent = ORIGIN[app.origin] || '';
        dimSelect.value = s.dim;
        // options that only make sense in one of the views
        document.querySelectorAll('[data-dim]').forEach((el) => { el.hidden = +el.dataset.dim !== s.dim; });
    }

    app.onChange(syncControls);
    // the photon editor can change the pressure too
    app.lawListeners.add((key) => {
        if (key !== 'pressure' || document.activeElement === pressure) return;
        pressure.value = app.world.laws.pressure;
        pressureValue.textContent = app.world.laws.pressure.toFixed(2);
    });

    EM.ui.register(() => {
        const w = app.world;
        if (!w) return;
        playBtn.textContent = app.settings.running ? '❚❚ Pause' : '▶ Play';
        fastBtn.textContent = app.fast ? '■ Stop' : '⏩ Fast forward';
        const loop = EM.loop;
        hud.innerHTML = `<span>step <b>${fmt(w.steps)}</b></span><span><b>${fmt(w.n)}</b> photons</span>` +
            `<span><b>${fmt(w.bondCount)}</b> bonds</span><span>${loop.fps} fps</span>` +
            `<span title="${loop.msPerStep.toFixed(1)} ms/step">${fmt(loop.stepsPerSecond)} steps/s</span>`;
    });
})(EM);
