/** Lab panel: start/stop the search over laws, budget, results list. */
(function (EM) {
    'use strict';

    const { $, fmt, pct } = EM.ui;
    const lab = EM.lab.controller;

    const startBtn = $('labStartBtn'), status = $('labStatus'), list = $('labResults');
    const countIn = $('labCount'), stepsIn = $('labSteps'), workersIn = $('labWorkers');

    countIn.value = lab.opts.count;
    stepsIn.value = lab.opts.steps;
    workersIn.value = lab.opts.workers;
    workersIn.max = Math.max(1, navigator.hardwareConcurrency || 4);

    const readOpts = () => {
        lab.opts.count = Math.max(300, Math.min(6000, +countIn.value || 1500));
        lab.opts.steps = Math.max(500, Math.min(20000, +stepsIn.value || 3000));
        lab.opts.workers = Math.max(1, Math.min(+workersIn.max, +workersIn.value || 1));
    };

    startBtn.addEventListener('click', () => {
        if (lab.running) {
            lab.stop();
        } else {
            readOpts();
            lab.start();
        }
    });

    $('labClearBtn').addEventListener('click', () => {
        if (!confirm('Forget all lab results?')) return;
        lab.search.clear();
        render();
    });

    function row(entry, rank) {
        const d = entry.descriptor;
        const tr = document.createElement('tr');
        tr.innerHTML =
            `<td>${rank}</td>` +
            `<td title="${entry.origin}${entry.parent ? ' of ' + entry.parent : ''}">${entry.name}</td>` +
            `<td>${fmt(entry.interest, 2)}</td>` +
            `<td>${pct(1 - d.freeFraction)}</td>` +
            `<td>${fmt(d.shapesNow, 0)}</td>` +
            `<td>${fmt(d.largest, 0)}</td>` +
            `<td>${fmt(d.enclosures, 1)}</td>`;
        const td = document.createElement('td');
        const load = document.createElement('button');
        load.textContent = 'Load';
        load.addEventListener('click', () => EM.app.loadGenome(entry.genome, 'lab'));
        const save = document.createElement('button');
        save.textContent = '⤓';
        save.title = 'Export laws (JSON)';
        save.addEventListener('click', () => EM.ui.download(`emergence-${entry.name}.json`, EM.genome.toJSON(entry.genome)));
        td.append(load, save);
        tr.appendChild(td);
        return tr;
    }

    function render() {
        const s = lab.search;
        const mode = lab.pool ? (lab.pool.mode === 'workers' ? `${lab.pool.size} worker(s)` : 'in page (open via http for workers)') : '';
        status.textContent = `${lab.dim}D · ` + (lab.running ? `searching · ${mode} · ` : 'stopped · ') +
            `${fmt(s.evaluated)} evaluated · archive ${s.archive.length}` +
            (lab.last ? ` · last ${lab.last.name} (${fmt(lab.last.interest, 2)})` : '') +
            (lab.error ? ` · error: ${lab.error}` : '');
        startBtn.textContent = lab.running ? '■ Stop search' : '▶ Start search';
        startBtn.classList.toggle('active', lab.running);

        list.innerHTML = '';
        lab.search.best(20).forEach((e, k) => list.appendChild(row(e, k + 1)));
    }

    lab.onUpdate(render);
    // the lab follows the current world's dimension
    EM.app.onChange((app) => {
        if (lab.dim !== app.settings.dim) {
            lab.useDim(app.settings.dim);
            countIn.value = lab.opts.count;
        }
    });
    EM.ui.labRender = render;
})(EM);
