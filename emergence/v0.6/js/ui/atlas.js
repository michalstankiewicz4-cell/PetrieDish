/**
 * Atlas (Tab key or the "Elements & ML" button): a full-screen view with
 *  - the periodic table of emergent elements (Z = photons in a stable
 *    structure, see observe/elements.js), lit when they exist in the world;
 *  - a live picture of the machine learning (the Lab): learning curve, map of
 *    tested universes, elements the lab has produced, best universes.
 * Read-only: it never changes the world or the search.
 */
(function (EM) {
    'use strict';

    const { $, fmt } = EM.ui;
    const app = EM.app;
    const lab = EM.lab.controller;
    const TABLE = EM.elements.TABLE;

    const COLORS = {
        alkali: '#ff6b6b',
        alkaline: '#ffa94d',
        transition: '#f2c94c',
        post: '#a9e34b',
        metalloid: '#38d9a9',
        nonmetal: '#4dabf7',
        halogen: '#9775fa',
        noble: '#f783ac',
        lanthanide: '#e599f7',
        actinide: '#ff8fab',
        unknown: '#8a93a8'
    };
    const colorOf = (z) => COLORS[TABLE[z - 1].category];

    const atlas = $('atlas');
    const state = {
        open: false,
        tab: 'table',
        selZ: null,
        census: null,
        known: null,      // Z already discovered in this world (for the "new" flash)
        world: null
    };

    // ---------- periodic table: build once ----------
    const grid = $('ptGrid');
    const cells = TABLE.map((el) => {
        const d = document.createElement('div');
        d.className = 'pt-cell';
        d.style.setProperty('--c', COLORS[el.category]);
        d.style.gridRow = el.row;
        d.style.gridColumn = el.col;
        d.title = `${el.z} ${el.name}`;
        d.innerHTML = `<span class="z">${el.z}</span><span class="sym">${el.symbol}</span><span class="iso"></span><span class="cnt"></span>`;
        d.addEventListener('click', () => {
            state.selZ = state.selZ === el.z ? null : el.z;
            refreshTable();
        });
        d.addEventListener('mouseenter', () => renderDetail(el.z));
        d.addEventListener('mouseleave', () => renderDetail(state.selZ));
        grid.appendChild(d);
        return { el: d, iso: d.querySelector('.iso'), cnt: d.querySelector('.cnt') };
    });
    [[6, '57–71'], [7, '89–103']].forEach(([row, text]) => {
        const g = document.createElement('div');
        g.className = 'pt-gap';
        g.style.gridRow = row;
        g.style.gridColumn = 3;
        g.textContent = text;
        grid.appendChild(g);
    });
    const title = document.createElement('div');
    title.className = 'pt-title';
    title.innerHTML = '<b>PERIODIC TABLE OF EMERGENCE</b>Z = number of photons in a stable structure · H = a free photon · ' +
        'shapes with the same Z are isotopes · nothing here is programmed into the physics';
    grid.appendChild(title);

    $('ptLegend').innerHTML = Object.entries(EM.elements.CATEGORIES)
        .map(([k, label]) => `<span style="--c:${COLORS[k]}">${label}</span>`).join('') +
        '<span style="--c:transparent;border:0">· dim = not yet · outlined = discovered · glowing = present now</span>';

    // ---------- open / close / tabs ----------
    function toggle(force) {
        state.open = force === undefined ? !state.open : force;
        atlas.hidden = !state.open;
        if (state.open) refresh();
        else $('mlTip').hidden = true;
        if (EM.ui.topbar) EM.ui.topbar.sync();
    }

    $('atlasClose').addEventListener('click', () => toggle(false));
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.target.matches('input[type="number"], input[type="text"], textarea')) {
            e.preventDefault();
            toggle();
        } else if (e.key === 'Escape' && state.open) {
            e.stopImmediatePropagation();
            toggle(false);
        }
    }, true);

    function setTab(tab) {
        state.tab = tab;
        atlas.querySelectorAll('.atlas-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
        $('pageTable').hidden = tab !== 'table';
        $('pageMl').hidden = tab !== 'ml';
        refresh();
    }
    atlas.querySelectorAll('.atlas-tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

    function refresh() {
        if (!state.open || !app.world || !app.observer) return;
        refreshTable();
        if (state.tab === 'ml') refreshMl();
    }

    // ---------- periodic table: live state ----------
    function refreshTable() {
        if (state.world !== app.world) {
            state.world = app.world;
            state.known = null;
            state.selZ = null;
        }
        const c = state.census = EM.elements.census(app.observer);
        let maxNow = 1;
        for (let z = 2; z <= TABLE.length; z++) maxNow = Math.max(maxNow, c.elements[z - 1].now);
        const first = state.known === null;
        if (first) state.known = new Set();

        cells.forEach((cell, k) => {
            const z = k + 1, e = c.elements[k];
            const seen = z === 1 ? e.now > 0 : e.isotopes > 0;
            const now = e.now > 0;
            cell.el.classList.toggle('seen', seen);
            cell.el.classList.toggle('now', now);
            cell.el.classList.toggle('sel', state.selZ === z);
            cell.el.style.setProperty('--glow', now ? (z === 1 ? 0.25 : Math.log1p(e.now) / Math.log1p(maxNow)).toFixed(2) : 0);
            cell.cnt.textContent = now ? (e.now >= 1000 ? Math.round(e.now / 1000) + 'k' : e.now) : '';
            const dots = Math.min(4, e.isotopes);
            if (cell.iso.childElementCount !== dots) cell.iso.innerHTML = '<i></i>'.repeat(dots);
            if (seen && !state.known.has(z)) {
                state.known.add(z);
                if (!first) {
                    cell.el.classList.remove('new');
                    void cell.el.offsetWidth; // restart the animation
                    cell.el.classList.add('new');
                }
            }
            const iso = e.isotopes ? `, ${e.isotopes} isotope(s)` : '';
            cell.el.title = `${z} ${TABLE[k].name} – ${now ? e.now + ' now' : seen ? 'discovered, none now' : 'not yet'}${iso}`;
        });

        const discovered = c.everDistinct + (c.freePhotons > 0 ? 1 : 0);
        const heavy = c.heaviest ? `${TABLE[c.heaviest - 1].symbol} (Z ${c.heaviest})` : '–';
        $('atlasSummary').innerHTML =
            `<span><b>${c.distinct}</b> elements present now</span>` +
            `<span><b>${discovered}</b> / 118 discovered</span>` +
            `<span class="atlas-progress"><i style="width:${(discovered / 118) * 100}%"></i></span>` +
            `<span>heaviest <b>${heavy}</b></span>` +
            `<span>step ${fmt(app.world.steps)} · ${app.world.dim}D</span>`;
        renderDetail(state.selZ);
    }

    function renderDetail(z) {
        const box = $('ptDetail');
        const c = state.census;
        if (!c) return;
        // rebuild only when something shown changed (keeps the button clickable)
        const e0 = z ? c.elements[z - 1] : null;
        const key = z ? `${z}:${e0.now}:${e0.isotopes}:${e0.entries.map((x) => x.current).join(',')}`
            : `0:${c.distinct}:${c.everDistinct}:${c.freePhotons}:${app.observer.stable.length}`;
        if (box._key === key) return;
        box._key = key;
        if (!z) {
            box.style.removeProperty('--c');
            box.innerHTML = `<h4>Elements of this universe</h4>
                <p class="hint" style="margin-top:8px">Photons that stay bonded in the same shape long enough form a
                <b>stable structure</b>. Its size is its atomic number: 2 photons = He, 6 = C, 26 = Fe…
                Different shapes of the same size are <b>isotopes</b>.</p>
                <p class="hint" style="margin-top:8px">Hover or click an element. Good laws light up many cells –
                the Lab is rewarded for that (tab <b>Machine learning</b>).</p>
                <dl><dt>present now</dt><dd>${c.distinct}</dd><dt>discovered</dt><dd>${c.everDistinct}</dd>
                <dt>free photons (H)</dt><dd>${fmt(c.freePhotons)}</dd><dt>stable structures</dt><dd>${fmt(app.observer.stable.length)}</dd></dl>`;
            return;
        }
        const el = TABLE[z - 1], e = c.elements[z - 1];
        const seen = z === 1 ? e.now > 0 : e.isotopes > 0;
        box.style.setProperty('--c', COLORS[el.category]);
        let html = `<div class="big"><div class="sym${seen ? '' : ' off'}">${el.symbol}</div>
            <div><h4>${el.name}</h4><div class="cat">${EM.elements.CATEGORIES[el.category]} · Z = ${z}</div></div></div>`;
        if (z === 1) {
            html += `<dl><dt>free photons now</dt><dd>${fmt(e.now)}</dd></dl>
                <p class="hint">A single photon without bonds – the raw material of every other element.</p>`;
        } else if (!seen) {
            html += `<p class="hint">Not formed yet in this universe. It needs a structure of exactly ${z} photons
                that keeps its shape for ${EM.config.STABLE_PASSES} observer passes.</p>`;
        } else {
            html += `<dl><dt>present now</dt><dd>${e.now}</dd><dt>isotopes (shapes)</dt><dd>${e.isotopes}</dd>
                <dt>first at step</dt><dd>${fmt(e.first)}</dd></dl><div class="pt-iso"></div>`;
        }
        if (seen) html += '<button class="show">◎ Show in the world</button>';
        box.innerHTML = html;

        const iso = box.querySelector('.pt-iso');
        if (iso) {
            e.entries.slice(0, 9).forEach((entry) => {
                const fig = document.createElement('figure');
                const cv = document.createElement('canvas');
                cv.width = cv.height = 64;
                EM.tiles.drawTile(cv, entry, app.world.laws.color);
                const cap = document.createElement('figcaption');
                cap.textContent = `${entry.name} ×${entry.current}`;
                fig.append(cv, cap);
                iso.appendChild(fig);
            });
        }
        const btn = box.querySelector('.show');
        if (btn) btn.addEventListener('click', () => showInWorld(z));
    }

    /** Highlights every current instance of element z and closes the atlas. */
    function showInWorld(z) {
        const members = [];
        if (z === 1) {
            const w = app.world;
            for (let i = 0; i < w.n; i++) if (w.deg[i] === 0) members.push(i);
        } else {
            app.observer.stable.forEach((s) => { if (s.members.length === z) members.push(...s.members); });
        }
        EM.renderer.selection = { members, label: TABLE[z - 1].symbol };
        toggle(false);
    }

    // ---------- machine learning ----------
    const tip = $('mlTip');
    const startBtn = $('mlStartBtn');
    startBtn.addEventListener('click', () => (lab.running ? lab.stop() : lab.start()));

    const symbolsOf = (list, max = 14) => {
        const chips = list.slice(0, max).map((z) => `<span style="--c:${colorOf(z)}">${TABLE[z - 1].symbol}</span>`).join('');
        return chips + (list.length > max ? `<span>+${list.length - max}</span>` : '');
    };

    function refreshMl() {
        const s = lab.search;
        const best = s.best(1)[0];
        const maxEl = s.archive.reduce((m, a) => Math.max(m, (a.elements || []).length), 0);
        $('mlMode').textContent = `${lab.dim}D · ${lab.running ? 'running' : 'stopped'}`;
        $('mlStats').innerHTML =
            `<div class="ml-stat"><b>${fmt(s.evaluated)}</b><span>universes tested</span></div>` +
            `<div class="ml-stat"><b>${s.archive.length}</b><span>kept in archive</span></div>` +
            `<div class="ml-stat"><b>${best ? best.interest.toFixed(2) : '–'}</b><span>best score</span></div>` +
            `<div class="ml-stat"><b>${maxEl}</b><span>most elements in one</span></div>`;
        startBtn.textContent = lab.running ? '■ Stop search' : '▶ Start search';
        startBtn.classList.toggle('active', lab.running);
        const pool = lab.pool;
        const size = pool ? pool.size : lab.opts.workers;
        const busy = pool && lab.running ? size - pool.free : 0;
        $('mlWorkers').innerHTML = Array.from({ length: size }, (_, k) => `<i class="${k < busy ? 'busy' : ''}"></i>`).join('') +
            ` ${busy ? busy + ' testing' : 'idle'}${pool && pool.mode === 'page' ? ' (in page)' : ''}`;

        drawCurve(s.log);
        drawMap(s);
        drawMini(s.archive);
        drawBest(s);
    }

    function setupCanvas(cv) {
        const dpr = window.devicePixelRatio || 1;
        const w = cv.clientWidth, h = cv.height / (cv._dpr || 1);
        if (!cv._h) cv._h = cv.height;
        const H = cv._h;
        if (cv.width !== Math.round(w * dpr) || cv._dpr !== dpr) {
            cv.width = Math.round(w * dpr);
            cv.height = Math.round(H * dpr);
            cv.style.height = H + 'px';
            cv._dpr = dpr;
        }
        const ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, H);
        return { ctx, w, h: H || h };
    }

    function empty(ctx, w, h, text) {
        ctx.fillStyle = '#7c86a8';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, w / 2, h / 2);
        ctx.textAlign = 'left';
    }

    function drawCurve(log) {
        const { ctx, w, h } = setupCanvas($('mlCurve'));
        if (!log.length) return empty(ctx, w, h, 'Start the search – every tested universe appears here');
        const padL = 34, padB = 18, top = 26;
        const plotH = h - padB - top, elH = plotH * 0.28;
        const maxI = Math.max(0.1, ...log.map((p) => p.interest));
        const maxE = Math.max(1, ...log.map((p) => p.elements));
        const X = (k) => padL + (log.length === 1 ? 0.5 : k / (log.length - 1)) * (w - padL - 6);
        const Y = (v) => top + plotH - (v / maxI) * plotH;

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.fillStyle = '#7c86a8';
        ctx.font = '10px ui-monospace, monospace';
        for (let g = 0; g <= 4; g++) {
            const v = (maxI * g) / 4, y = Y(v);
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w, y); ctx.stroke();
            ctx.fillText(v.toFixed(2), 2, y + 3);
        }
        ctx.fillText(`#${log[0].n}`, padL, h - 4);
        ctx.textAlign = 'right';
        ctx.fillText(`#${log[log.length - 1].n}`, w - 4, h - 4);
        ctx.textAlign = 'left';

        // elements per universe: green bars at the bottom
        const bw = Math.max(1, (w - padL) / log.length - 1);
        log.forEach((p, k) => {
            if (!p.elements) return;
            const bh = (p.elements / maxE) * elH;
            ctx.fillStyle = 'rgba(80,255,170,0.28)';
            ctx.fillRect(X(k) - bw / 2, top + plotH - bh, bw, bh);
        });
        // every universe: a dot
        log.forEach((p, k) => {
            ctx.fillStyle = p.viability > 0 ? 'rgba(122,162,255,0.75)' : 'rgba(124,134,168,0.35)';
            ctx.beginPath();
            ctx.arc(X(k), Y(p.interest), p.viability > 0 ? 2.2 : 1.5, 0, Math.PI * 2);
            ctx.fill();
        });
        // best so far
        ctx.strokeStyle = '#50ffaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        log.forEach((p, k) => { if (k === 0) ctx.moveTo(X(k), Y(p.best)); else ctx.lineTo(X(k), Y(p.best)); });
        ctx.stroke();
        ctx.lineWidth = 1;

        ctx.font = '10px ui-monospace, monospace';
        [['#50ffaa', 'best so far'], ['#7aa2ff', 'score of each universe'], ['rgba(80,255,170,0.6)', `elements (max ${maxE})`]].forEach(([c, t], k) => {
            ctx.fillStyle = c;
            ctx.fillRect(padL + k * 170, 6, 8, 8);
            ctx.fillStyle = '#c9d2ee';
            ctx.fillText(t, padL + 12 + k * 170, 14);
        });
    }

    let mapPoints = [];
    const mapCanvas = $('mlMap');

    function gradient(t) {
        // low -> high: deep blue, accent blue, green
        const a = [59, 74, 138], b = [122, 162, 255], c = [80, 255, 170];
        const [p, q, u] = t < 0.5 ? [a, b, t * 2] : [b, c, (t - 0.5) * 2];
        return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * u)).join(',')})`;
    }

    function drawMap(s) {
        const { ctx, w, h } = setupCanvas(mapCanvas);
        mapPoints = [];
        if (!s.archive.length) return empty(ctx, w, h, 'No universes yet');
        const pad = 26;
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        for (let g = 0; g <= 4; g++) {
            const x = pad + (g / 4) * (w - pad * 2), y = pad + (g / 4) * (h - pad * 2);
            ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
        }
        ctx.fillStyle = '#7c86a8';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText('gas', pad, h - 8);
        ctx.textAlign = 'right';
        ctx.fillText('all bonded →', w - pad, h - 8);
        ctx.textAlign = 'left';
        ctx.save();
        ctx.translate(11, h - pad);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('more kinds of shapes →', 0, 0);
        ctx.restore();

        const maxI = Math.max(0.05, ...s.archive.map((a) => a.interest));
        const best = s.best(1)[0];
        const sorted = s.archive.slice().sort((a, b) => a.interest - b.interest); // best drawn last
        sorted.forEach((a) => {
            const x = pad + Math.min(1, a.f[0]) * (w - pad * 2);
            const y = h - pad - Math.min(1, a.f[1]) * (h - pad * 2);
            const r = 2.5 + Math.sqrt((a.elements || []).length) * 1.6;
            ctx.globalAlpha = a.viability > 0 ? 0.9 : 0.35;
            ctx.fillStyle = gradient(a.interest / maxI);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            mapPoints.push({ x, y, r, a });
        });
        ctx.globalAlpha = 1;
        const ring = (a, color, extra) => {
            const p = mapPoints.find((m) => m.a === a);
            if (!p) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r + extra, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
        };
        if (best) ring(best, '#ffffff', 3);
        if (lab.last) ring(lab.last, '#ffb86b', 3 + 2 * Math.abs(Math.sin(performance.now() / 300)));
        ctx.fillStyle = '#c9d2ee';
        ctx.fillText('○ best   ', w - 150, 14);
        ctx.fillStyle = '#ffb86b';
        ctx.fillText('○ newest', w - 90, 14);
    }

    function pointAt(e) {
        const r = mapCanvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        let hit = null, bd = 12 * 12;
        mapPoints.forEach((p) => {
            const d = (p.x - x) ** 2 + (p.y - y) ** 2;
            if (d < bd) { bd = d; hit = p; }
        });
        return hit;
    }
    mapCanvas.addEventListener('mousemove', (e) => {
        const p = pointAt(e);
        if (!p) { tip.hidden = true; mapCanvas.style.cursor = ''; return; }
        const a = p.a, d = a.descriptor;
        tip.innerHTML = `<b>${a.name}</b> · score ${a.interest.toFixed(2)} · ${a.origin}<br>` +
            `bonded ${Math.round((1 - d.freeFraction) * 100)}% · shapes ${Math.round(d.shapesNow)} · largest ${Math.round(d.largest)}<br>` +
            `elements: ${(a.elements || []).length ? (a.elements || []).map((z) => TABLE[z - 1].symbol).join(' ') : 'none'}`;
        tip.style.left = e.clientX + 14 + 'px';
        tip.style.top = e.clientY + 12 + 'px';
        tip.hidden = false;
        mapCanvas.style.cursor = 'pointer';
    });
    mapCanvas.addEventListener('mouseleave', () => { tip.hidden = true; });
    mapCanvas.addEventListener('click', (e) => {
        const p = pointAt(e);
        if (!p) return;
        tip.hidden = true;
        EM.app.loadGenome(p.a.genome, 'lab');
        toggle(false);
    });

    // mini periodic table: how many archived universes produced each element
    const mini = $('mlMini');
    const miniCells = TABLE.map((el) => {
        const d = document.createElement('div');
        d.style.gridRow = el.row === 9 ? 9 : el.row === 10 ? 10 : el.row;
        d.style.gridColumn = el.col;
        d.textContent = el.symbol;
        mini.appendChild(d);
        return d;
    });

    function drawMini(archive) {
        const counts = new Array(TABLE.length + 1).fill(0);
        archive.forEach((a) => (a.elements || []).forEach((z) => { counts[z]++; }));
        const n = Math.max(1, archive.length);
        miniCells.forEach((d, k) => {
            const z = k + 1;
            const share = z === 1 ? (archive.length ? 1 : 0) : counts[z] / n;
            d.classList.toggle('hit', share > 0);
            d.style.background = share > 0
                ? `color-mix(in srgb, ${colorOf(z)} ${Math.round(20 + share * 80)}%, #0a0c18)`
                : '';
            d.title = `${TABLE[k].name}: ${z === 1 ? 'free photons – every universe' : counts[z] + ' of ' + archive.length + ' universes'}`;
        });
    }

    function drawBest(s) {
        const box = $('mlBest');
        const list = s.best(8);
        if (!list.length) {
            box.innerHTML = '<div class="ml-empty">The best universes will appear here.</div>';
            return;
        }
        const top = list[0].interest || 1;
        const key = list.map((e) => e.name + e.interest).join('|');
        if (box._key === key) return; // unchanged - keep buttons stable under the mouse
        box._key = key;
        box.innerHTML = '';
        list.forEach((e, k) => {
            const d = e.descriptor;
            const row = document.createElement('div');
            row.className = 'ml-best-row';
            row.innerHTML = `<span class="rank">${k + 1}</span><span title="${e.origin}${e.parent ? ' of ' + e.parent : ''}">${e.name}</span>
                <div><div class="bar"><i style="width:${(e.interest / top) * 100}%"></i></div>
                <div class="ml-chips">${(e.elements || []).length ? symbolsOf(e.elements) : '<span>no elements</span>'}
                <span style="--c:#7c86a8">${e.interest.toFixed(2)} · bonded ${Math.round((1 - d.freeFraction) * 100)}%</span></div></div>`;
            const load = document.createElement('button');
            load.textContent = 'Load';
            load.addEventListener('click', () => {
                EM.app.loadGenome(e.genome, 'lab');
                toggle(false);
            });
            row.appendChild(load);
            box.appendChild(row);
        });
    }

    lab.onUpdate(() => { if (state.open && state.tab === 'ml') refreshMl(); });
    EM.ui.register(refresh);
    // the "newest" ring pulses while the ML page is open
    (function pulse() {
        if (state.open && state.tab === 'ml' && lab.running) drawMap(lab.search);
        setTimeout(pulse, 120);
    })();

    EM.ui.atlas = {
        toggle,
        /** Opens the atlas on a tab ('table' | 'ml'); the same tab again closes it. */
        show(tab) {
            if (state.open && state.tab === tab) return toggle(false);
            setTab(tab);
            toggle(true);
        },
        get open() { return state.open; },
        get tab() { return state.tab; }
    };
})(EM);
