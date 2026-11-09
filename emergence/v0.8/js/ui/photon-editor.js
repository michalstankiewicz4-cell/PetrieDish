/**
 * Photon editor (top bar → Photon, key E): every law of the current world as
 * a slider, a picture of the photon (charges, mass, share at start, allowed
 * bonds at a chosen energy) and the force between two photons vs distance.
 * Most laws change the running world live; the rest (↻) apply after a restart.
 * It edits the same genome the Lab mutates - exported files load anywhere.
 */
(function (EM) {
    'use strict';

    const { $ } = EM.ui;
    const app = EM.app;
    const panel = $('editorPanel');

    /** Label, group and explanation of every law (keys of EM.genome.SPECS). */
    const INFO = {
        pressure: ['Pressure', 'Environment', 'How close photons may come: 1 = surfaces touch, lower = they keep a gap'],
        friction: ['Friction', 'Environment', 'Share of speed lost every step'],
        temperature: ['Temperature', 'Environment', 'Random kicks every photon gets'],
        restitution: ['Bounce', 'Environment', 'How much photons bounce off each other at the hard boundary'],
        neutralShare: ['Neutral share', 'Photon', 'Share of photons with charge 0 (at the start)'],
        doubleShare: ['Charge ±2 share', 'Photon', 'Share of charged photons with charge ±2 (at the start)'],
        positiveShare: ['Positive share', 'Photon', 'Share of charged photons that are positive (at the start)'],
        massBase: ['Mass', 'Photon', 'Mass of a neutral photon'],
        massPerCharge: ['Mass per |charge|', 'Photon', 'Extra mass per unit of charge'],
        range: ['Range R', 'Electromagnetic', 'Reach of the electromagnetic force (px)'],
        forceScale: ['Strength', 'Electromagnetic', 'Amplitude of the electromagnetic wave'],
        periods: ['Shells', 'Electromagnetic', 'Number of attract/repel shells inside the range'],
        waveOffset: ['Offset', 'Electromagnetic', '0 = like charges attract in some shells, 1 = like charges always repel (Coulomb-like)'],
        phaseShift: ['Phase', 'Electromagnetic', 'Slides the shells along the distance (in periods)'],
        valence: ['Valence', 'Strong', 'Max strong bonds of a cold photon (the same for every photon)'],
        energyValence: ['Energy → fewer bonds', 'Strong', 'Allowed bonds = valence − ⌊energy × valence × this⌋'],
        strongReach: ['Reach', 'Strong', 'Bonds form within dmin × (1 + this)'],
        strongRate: ['Bond chance', 'Strong', 'Chance per step that touching photons bond'],
        strongK: ['Stiffness', 'Strong', 'Spring strength of a bond'],
        breakStretch: ['Break at', 'Strong', 'A bond breaks when stretched beyond dmin × this'],
        bindEnergy: ['Capture speed', 'Strong', 'Max squared relative speed that still bonds'],
        activation: ['Activation', 'Strong', 'Energy spent to form a bond (released when it breaks); below 0.3 = off'],
        decay: ['Decay', 'Strong', 'Spontaneous breaking, faster with energy; below 0.6 = off'],
        absorb: ['Light absorption', 'Energy', 'Energy gained from light per step; below 0.01 = off'],
        leak: ['Energy leak', 'Energy', 'Share of energy lost per step'],
        energyShare: ['Flow along bonds', 'Energy', 'Energy evening out along strong bonds'],
        agitation: ['Energy → speed', 'Energy', 'Random kick × energy: hot photons move faster'],
        lightAmbient: ['Ambient light', 'Light', 'Light everywhere'],
        sunCount: ['Suns', 'Light', 'Number of bright drifting spots'],
        sunRadius: ['Sun size', 'Light', '× side of the world'],
        sunDrift: ['Sun drift', 'Light', 'px per step'],
        dayPeriod: ['Day length', 'Light', 'Steps per day/night cycle; below 500 = always day']
    };
    const GROUPS = ['Photon', 'Strong', 'Electromagnetic', 'Environment', 'Energy', 'Light'];
    /** raw values that compile to "off" */
    const GATES = { activation: 0.3, decay: 0.6, absorb: 0.01 };

    const rows = new Map(); // key -> { input, value, row, spec }
    let seedGenes = null;   // laws of the seed (to mark changed rows)

    // ---------- build the sliders ----------
    const groupsEl = $('edGroups');
    GROUPS.forEach((group, gi) => {
        const det = document.createElement('details');
        det.open = gi < 2;
        det.innerHTML = `<summary>${group}</summary>`;
        EM.genome.SPECS.filter((s) => INFO[s.key] && INFO[s.key][1] === group).forEach((spec) => {
            const [label, , help] = INFO[spec.key];
            const restart = EM.genome.RESTART_KEYS.includes(spec.key);
            const row = document.createElement('div');
            row.className = 'ed-law';
            row.innerHTML = `<label title="${help}${restart ? ' (applies after a restart)' : ''}">${label}${restart ? '<span class="rs">↻</span>' : ''}</label>` +
                `<input type="range" min="${spec.min}" max="${spec.max}" step="${spec.int ? 1 : (spec.max - spec.min) / 200}">` +
                '<span class="value"></span>';
            const input = row.querySelector('input'), value = row.querySelector('.value');
            input.addEventListener('input', () => {
                app.setGene(spec.key, spec.int ? Math.round(+input.value) : +input.value);
                showValue(spec.key);
                drawAll();
                syncRestart();
            });
            det.appendChild(row);
            rows.set(spec.key, { input, value, row, spec });
        });
        groupsEl.appendChild(det);
    });

    function fmtVal(spec, v) {
        if (spec.int) return String(Math.round(v));
        const span = spec.max - spec.min;
        return v.toFixed(span >= 100 ? 0 : span >= 10 ? 1 : span >= 1 ? 2 : 3);
    }

    function showValue(key) {
        const r = rows.get(key), v = app.genome.global[key];
        const off = GATES[key] !== undefined && v < GATES[key];
        r.value.textContent = off ? 'off' : fmtVal(r.spec, v);
        r.value.classList.toggle('off', off);
        r.row.classList.toggle('changed', !!seedGenes && Math.abs(seedGenes[key] - v) > 1e-9);
    }

    function syncAll() {
        if (!app.genome) return;
        rows.forEach((r, key) => {
            if (document.activeElement !== r.input) r.input.value = app.genome.global[key];
            showValue(key);
        });
        syncRestart();
        const o = { seed: `laws seed ${app.settings.lawsSeed}`, edited: 'edited – export to keep', mutation: 'mutated', lab: 'from Lab', file: 'from file' };
        $('edOrigin').textContent = o[app.origin] || '';
        drawAll();
    }

    function syncRestart() {
        $('edRestart').hidden = !app.pendingRestart;
    }

    // ---------- photon picture ----------
    const energyIn = $('edEnergy');
    energyIn.addEventListener('input', drawPhoton);

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

    function drawPhoton() {
        if (!app.world || !panel.classList.contains('open')) return;
        const L = app.world.laws, e = +energyIn.value;
        $('edEnergyValue').textContent = e.toFixed(2);
        const { ctx, w, h } = setupCanvas($('edPhoton'));
        const v = L.valence[0];
        const allowed = Math.max(0, v - Math.floor(e * v * L.energyValence));
        const total = L.typeWeights.reduce((a, b) => a + b, 0) || 1;
        const cell = w / L.T, r = Math.min(22, cell * 0.32);
        ctx.textAlign = 'center';
        for (let t = 0; t < L.T; t++) {
            const cx = cell * (t + 0.5), cy = 48, q = L.charge[t];
            // ball
            const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
            g.addColorStop(0, '#fff');
            g.addColorStop(0.25, L.color[t]);
            g.addColorStop(1, 'rgba(0,0,0,0.85)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            if (v > 0) {
                ctx.fillStyle = 'rgba(6, 8, 16, 0.85)';
                ctx.font = `600 ${Math.round(r * 0.95)}px ui-monospace, monospace`;
                ctx.fillText(String(allowed), cx, cy + r * 0.33);
            }
            // labels
            ctx.fillStyle = '#c9d2ee';
            ctx.font = '600 11px ui-monospace, monospace';
            ctx.fillText(`q ${q > 0 ? '+' : ''}${q}`, cx, 16);
            ctx.fillStyle = '#7c86a8';
            ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(`m ${(1 / L.invMass[t]).toFixed(2)}`, cx, 88);
            // share at the start
            const share = L.typeWeights[t] / total;
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.fillRect(cx - cell * 0.35, 98, cell * 0.7, 5);
            ctx.fillStyle = L.color[t];
            ctx.fillRect(cx - cell * 0.35, 98, cell * 0.7 * share, 5);
            ctx.fillStyle = '#7c86a8';
            ctx.fillText(`${Math.round(share * 100)}%`, cx, 118);
        }
        ctx.textAlign = 'left';
        $('edPhotonText').innerHTML =
            `Radius ${L.radius} px for every photon · closest centres <b>${L.dmin.toFixed(2)} px</b> (pressure ${L.pressure.toFixed(2)}). ` +
            `At energy ${e.toFixed(2)}: <b>${allowed}</b> of ${v} strong bonds allowed, random kick ±${((L.temperature + L.agitation * e) / 2).toFixed(3)} px/step. ` +
            'Bars = share of each charge at the start.';
    }

    // ---------- force curves ----------
    function drawForces() {
        if (!app.world || !panel.classList.contains('open')) return;
        const L = app.world.laws;
        const { ctx, w, h } = setupCanvas($('edForces'));
        const padL = 30, padB = 16, top = 6;
        const R = L.R, W = w - padL - 4, H = h - padB - top;
        const X = (d) => padL + (d / R) * W;
        const pairs = [
            [3, 1, '#50ffaa', '+1 / −1'],
            [3, 3, '#ff6b6b', '+1 / +1'],
            [2, 3, '#9aa3bd', '0 / +1'],
            [4, 0, '#7aa2ff', '+2 / −2']
        ];
        const N = 160;
        const curves = pairs.map(([i, j]) => {
            const pts = [];
            for (let k = 0; k <= N; k++) {
                const d = L.dmin + (k / N) * (R - L.dmin);
                pts.push([d, EM.genome.forceAt(L, i, j, d)]);
            }
            return pts;
        });
        let maxF = 0.02;
        curves.forEach((c) => c.forEach(([, f]) => { maxF = Math.max(maxF, Math.abs(f)); }));
        const Y = (f) => top + H / 2 - (f / maxF) * (H / 2) * 0.92;

        // zones: hard boundary, strong bonding, break distance
        ctx.fillStyle = 'rgba(160,170,200,0.16)';
        ctx.fillRect(padL, top, X(L.dmin) - padL, H);
        if (L.valence[0] > 0) {
            ctx.fillStyle = 'rgba(122,162,255,0.22)';
            ctx.fillRect(X(L.dmin), top, X(L.bondFormDist[0]) - X(L.dmin), H);
            ctx.strokeStyle = 'rgba(122,162,255,0.7)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(X(L.bondBreak[0]), top);
            ctx.lineTo(X(L.bondBreak[0]), top + H);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        // axes
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.moveTo(padL, Y(0));
        ctx.lineTo(w, Y(0));
        ctx.stroke();
        ctx.fillStyle = '#7c86a8';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText('0', 4, Y(0) + 3);
        ctx.fillText('+', 4, top + 9);
        ctx.fillText('−', 4, top + H - 2);
        ctx.fillText('0', padL - 3, h - 3);
        ctx.textAlign = 'right';
        ctx.fillText(`R = ${R.toFixed(0)} px`, w - 2, h - 3);
        ctx.textAlign = 'left';
        // curves
        curves.forEach((c, k) => {
            ctx.strokeStyle = pairs[k][2];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            c.forEach(([d, f], m) => { if (m === 0) ctx.moveTo(X(d), Y(f)); else ctx.lineTo(X(d), Y(f)); });
            ctx.stroke();
        });
        ctx.lineWidth = 1;
        // legend
        pairs.forEach(([, , color, label], k) => {
            ctx.fillStyle = color;
            ctx.fillRect(padL + 6 + k * 74, top + 2, 8, 3);
            ctx.fillStyle = '#c9d2ee';
            ctx.fillText(label, padL + 18 + k * 74, top + 7);
        });
    }

    function drawAll() {
        drawPhoton();
        drawForces();
    }

    // ---------- buttons ----------
    $('edRestartBtn').addEventListener('click', () => app.restart(false));
    $('edApplyBtn').addEventListener('click', () => app.restart(false));
    $('edResetBtn').addEventListener('click', () => app.newLaws(app.settings.lawsSeed));
    $('edExportBtn').addEventListener('click', () => EM.ui.download(`emergence-laws-${app.settings.lawsSeed}.json`, app.exportGenome()));

    window.addEventListener('keydown', (e) => {
        if (e.target.matches('input, select, textarea')) return;
        if (e.key === 'e' || e.key === 'E') document.querySelector('[data-toggle="editorPanel"]').click();
    });

    app.onChange(() => {
        // the laws of the seed, to highlight what was changed by hand
        seedGenes = EM.genome.random(app.settings.lawsSeed).global;
        syncAll();
    });
    app.lawListeners.add((key) => {
        if (rows.has(key) && document.activeElement !== rows.get(key).input) {
            rows.get(key).input.value = app.genome.global[key];
            showValue(key);
            drawAll();
        }
    });
    // panel opened: draw (canvases have no size while hidden)
    new MutationObserver(() => { if (panel.classList.contains('open')) syncAll(); })
        .observe(panel, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', drawAll);

    EM.ui.photonEditor = { sync: syncAll };
})(EM);
