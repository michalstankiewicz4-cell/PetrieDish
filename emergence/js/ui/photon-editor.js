/**
 * Photon editor (top bar → Photon, key E) for the Gravitation model (v0.9):
 *  - the formula rows (like Gravitation's photon editor): role rows feed a
 *    property of every photon, helper rows are named values later rows use;
 *    edits act live (photons keep charge, mass and energy);
 *  - the environment: pressure (bond length), temperature (weakens the force),
 *    bond settings;
 *  - min / mean / max of every property in the running world;
 *  - the force between two typical photons vs distance.
 */
(function (EM) {
    'use strict';

    const { $, fmt } = EM.ui;
    const app = EM.app;
    const panel = $('editorPanel');
    const ROLES = EM.formulas.ROLES;

    let vars = [];          // rows being edited
    let applyTimer = null;

    // ---------- formula rows ----------
    const rowsEl = $('edRows');

    function render(errors) {
        rowsEl.innerHTML = '';
        vars.forEach((v, i) => {
            const row = document.createElement('div');
            row.className = 'fx-row' + (errors && errors[i] ? ' err' : '');
            const roleInfo = v.role ? ROLES[v.role].label : 'helper variable – later rows can use its name';
            row.innerHTML =
                `<div class="mv"><button data-mv="-1" title="Move up">▲</button><button data-mv="1" title="Move down">▼</button></div>` +
                `<input class="name" value="${escapeAttr(v.name)}" ${v.role ? 'readonly' : ''} title="${escapeAttr(roleInfo)}">` +
                `<input class="expr" value="${escapeAttr(v.expr)}" spellcheck="false" title="${escapeAttr(roleInfo)}">` +
                (v.role ? '<span></span>' : '<button class="del" title="Delete helper">✕</button>');
            row.querySelector('.expr').addEventListener('input', (e) => { vars[i].expr = e.target.value; scheduleApply(); });
            if (!v.role) {
                row.querySelector('.name').addEventListener('input', (e) => { vars[i].name = e.target.value; scheduleApply(); });
                row.querySelector('.del').addEventListener('click', () => { vars.splice(i, 1); apply(true); });
            }
            row.querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', () => {
                const k = i + +b.dataset.mv;
                if (k < 0 || k >= vars.length) return;
                [vars[i], vars[k]] = [vars[k], vars[i]];
                apply(true);
            }));
            rowsEl.appendChild(row);
            if (errors && errors[i]) {
                const msg = document.createElement('div');
                msg.className = 'fx-msg';
                msg.textContent = errors[i];
                row.appendChild(msg);
            }
        });
    }

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function scheduleApply() {
        clearTimeout(applyTimer);
        applyTimer = setTimeout(() => apply(false), 250);
    }

    /** Sends the rows to the world; rebuild = redraw the rows (order / count changed). */
    function apply(rebuild) {
        clearTimeout(applyTimer);
        const errors = app.setFormulas(vars);
        if (rebuild) render(errors);
        else markErrors(errors);
        drawAll();
    }

    function markErrors(errors) {
        [...rowsEl.querySelectorAll('.fx-row')].forEach((row, i) => {
            row.classList.toggle('err', !!errors[i]);
            let msg = row.querySelector('.fx-msg');
            if (errors[i]) {
                if (!msg) {
                    msg = document.createElement('div');
                    msg.className = 'fx-msg';
                    row.appendChild(msg);
                }
                msg.textContent = errors[i];
            } else if (msg) {
                msg.remove();
            }
        });
    }

    $('edAddBtn').addEventListener('click', () => {
        let k = 1;
        while (vars.some((v) => v.name === 'h' + k)) k++;
        vars.push({ role: null, name: 'h' + k, expr: '1' });
        apply(true);
    });
    $('edDefaultsBtn').addEventListener('click', () => {
        if (confirm(EM.t("Back to Gravitation's formulas and the default environment?"))) app.resetLaws();
    });

    // ---------- environment ----------
    const envEl = $('edEnv');
    const envRows = new Map();
    EM.genome.ENV.forEach((e) => {
        const row = document.createElement('div');
        row.className = 'ed-law';
        const step = (e.max - e.min) / 200;
        row.innerHTML = `<label title="${escapeAttr(e.help)}">${e.label}</label>` +
            `<input type="range" min="${e.min}" max="${e.max}" step="${step}"><span class="value"></span>`;
        const input = row.querySelector('input'), value = row.querySelector('.value');
        input.addEventListener('input', () => {
            app.setEnv(e.key, +input.value);
            value.textContent = fmtEnv(e, +input.value);
            drawForces();
        });
        envEl.appendChild(row);
        envRows.set(e.key, { input, value, spec: e });
    });

    function fmtEnv(e, v) {
        return e.max >= 100 ? Math.round(v).toString() : v.toFixed(2);
    }

    function syncEnv() {
        if (!app.genome) return;
        envRows.forEach((r, key) => {
            const v = app.genome.env[key];
            if (document.activeElement !== r.input) r.input.value = v;
            r.value.textContent = fmtEnv(r.spec, v);
        });
    }

    // ---------- statistics of the running world ----------
    const STAT_ROLES = [
        ['charge', 'charge'], ['mass', 'mass'], ['speed', 'speed'], ['energyRaw', 'energy'],
        ['force', 'force'], ['range', 'forceRange'], ['periods', 'periods'], ['offsetW', 'waveOffset'],
        ['phase', 'phaseShift'], ['valence', 'valence'], ['bondAngle', 'bondAngle']
    ];

    function drawStats() {
        const w = app.world;
        if (!w) return;
        const rows = STAT_ROLES.map(([key, label]) => {
            const a = w[key];
            let mn = Infinity, mx = -Infinity, sum = 0;
            for (let i = 0; i < w.n; i++) {
                const v = a[i];
                if (v < mn) mn = v;
                if (v > mx) mx = v;
                sum += v;
            }
            const f = (v) => fmt(v, Math.abs(v) >= 100 ? 0 : 2);
            return `<tr><td data-no-i18n>${label}</td><td>${f(mn)} · <b>${f(sum / w.n)}</b> · ${f(mx)}</td></tr>`;
        });
        $('edStats').innerHTML = '<tr><td></td><td class="hint">min · <b>mean</b> · max</td></tr>' + rows.join('');
    }

    // ---------- force curves ----------
    /** Mean properties of the photons with charge of the given sign. */
    function typical(w, sign) {
        const keys = ['charge', 'force', 'range', 'periods', 'offsetW', 'phase'];
        const out = { count: 0 };
        keys.forEach((k) => { out[k] = 0; });
        for (let i = 0; i < w.n; i++) {
            if (Math.sign(w.charge[i]) !== sign) continue;
            out.count++;
            keys.forEach((k) => { out[k] += w[k][i]; });
        }
        if (out.count) keys.forEach((k) => { out[k] /= out.count; });
        return out;
    }

    /** Same formula as World.pairs (positive = attraction). */
    function pairForce(a, b, d, factor) {
        const rg = (a.range + b.range) / 2;
        if (d >= rg || rg <= 0) return 0;
        const o = (a.offsetW + b.offsetW) / 2;
        const wave = (Math.sin(2 * Math.PI * ((a.periods + b.periods) / 2 * d / rg + (a.phase + b.phase) / 2)) + o) / (1 + o);
        const sign = a.charge * b.charge < 0 ? 1 : -1;
        return sign * (a.force + b.force) / 2 * wave * (1 - d / rg) * factor;
    }

    function setupCanvas(cv) {
        const dpr = window.devicePixelRatio || 1;
        if (!cv._h) cv._h = cv.height;
        const w = cv.clientWidth || 340, h = cv._h;
        if (cv.width !== Math.round(w * dpr)) {
            cv.width = Math.round(w * dpr);
            cv.height = Math.round(h * dpr);
            cv.style.height = h + 'px';
        }
        const ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        return { ctx, w, h };
    }

    function drawForces() {
        const w = app.world;
        if (!w || !panel.classList.contains('open')) return;
        const L = w.laws;
        const { ctx, w: cw, h } = setupCanvas($('edForces'));
        const pos = typical(w, 1), neg = typical(w, -1);
        const pairs = [];
        if (pos.count && neg.count) pairs.push([pos, neg, '#50ffaa', '+ / −']);
        if (pos.count) pairs.push([pos, pos, '#ff9f5a', '+ / +']);
        if (neg.count) pairs.push([neg, neg, '#7aa2ff', '− / −']);
        let R = 0;
        pairs.forEach(([a, b]) => { R = Math.max(R, (a.range + b.range) / 2); });
        R = Math.max(R, L.breakDist * 1.1, 10);
        const padL = 30, top = 18, H = h - top - 16, W = cw - padL - 4;
        const X = (d) => padL + (d / R) * W;
        const N = 200;
        const curves = pairs.map(([a, b]) => {
            const pts = [];
            for (let k = 0; k <= N; k++) {
                const d = L.dmin + (k / N) * (R - L.dmin);
                pts.push([d, pairForce(a, b, d, L.forceFactor)]);
            }
            return pts;
        });
        let maxF = 1;
        curves.forEach((c) => c.forEach(([, f]) => { maxF = Math.max(maxF, Math.abs(f)); }));
        const Y = (f) => top + H / 2 - (f / maxF) * (H / 2) * 0.92;

        ctx.fillStyle = 'rgba(160,170,200,0.16)';
        ctx.fillRect(padL, top, X(L.dmin) - padL, H);
        ctx.fillStyle = 'rgba(122,162,255,0.22)';
        ctx.fillRect(X(L.dmin), top, Math.max(1.5, X(L.bondLen) - X(L.dmin)), H);
        ctx.strokeStyle = 'rgba(122,162,255,0.7)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(X(L.breakDist), top);
        ctx.lineTo(X(L.breakDist), top + H);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.moveTo(padL, Y(0));
        ctx.lineTo(cw, Y(0));
        ctx.stroke();
        ctx.fillStyle = '#7c86a8';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText('0', 4, Y(0) + 3);
        ctx.fillText(fmt(maxF, 0), 2, top + 8);
        ctx.fillText('0', padL - 3, h - 3);
        ctx.textAlign = 'right';
        ctx.fillText(`${R.toFixed(0)} px`, cw - 2, h - 3);
        ctx.textAlign = 'left';

        curves.forEach((c, k) => {
            ctx.strokeStyle = pairs[k][2];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            c.forEach(([d, f], m) => { if (m === 0) ctx.moveTo(X(d), Y(f)); else ctx.lineTo(X(d), Y(f)); });
            ctx.stroke();
        });
        ctx.lineWidth = 1;
        pairs.forEach(([, , color, label], k) => {
            ctx.fillStyle = color;
            ctx.fillRect(padL + k * 70, 6, 8, 3);
            ctx.fillStyle = '#c9d2ee';
            ctx.fillText(label, padL + 12 + k * 70, 11);
        });
        if (!pairs.length) {
            ctx.fillStyle = '#7c86a8';
            ctx.fillText(EM.t('every photon is neutral – no electromagnetic force'), padL + 6, top + H / 2 - 8);
        }
    }

    function drawAll() {
        if (!panel.classList.contains('open')) return;
        drawStats();
        drawForces();
    }

    // ---------- buttons ----------
    $('edRestartBtn').addEventListener('click', () => app.restart(false));
    $('edExportBtn').addEventListener('click', () => EM.ui.download(`emergence-photons-${app.settings.lawsSeed}.json`, app.exportGenome()));
    $('edImportBtn').addEventListener('click', async () => {
        const text = await EM.ui.pickFile('.json,application/json');
        try {
            app.loadGenome(EM.genome.fromJSON(text), 'file');
        } catch (e) {
            alert(EM.t('Cannot load: ') + e.message);
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.target.matches('input, select, textarea')) return;
        if (e.key === 'e' || e.key === 'E') document.querySelector('[data-toggle="editorPanel"]').click();
    });

    function syncAll() {
        if (!app.genome) return;
        vars = app.genome.vars.map((v) => Object.assign({}, v));
        render(EM.formulas.run(EM.genome.compile(app.genome).compiled, new EM.Rng(1)).errors);
        syncEnv();
        drawAll();
    }

    app.onChange(syncAll);
    app.lawListeners.add((key) => {
        if (key !== 'formulas') syncEnv();
        drawAll();
    });
    new MutationObserver(() => { if (panel.classList.contains('open')) drawAll(); })
        .observe(panel, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', drawAll);

    EM.i18n.onChange(syncAll);
    EM.ui.photonEditor = { sync: syncAll };
})(EM);
