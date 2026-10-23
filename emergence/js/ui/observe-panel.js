/**
 * Right panel, "Observe": metrics, small history charts, the catalog of
 * stable structures and the inspector of a clicked photon.
 */
(function (EM) {
    'use strict';

    const { $, fmt, pct } = EM.ui;
    const app = EM.app;

    // ---------- metrics ----------
    const METRICS = [
        ['Bonded photons', (m) => pct(1 - m.freeFraction)],
        ['Structures now', (m) => fmt(m.structures)],
        ['Stable structures', (m) => fmt(m.stableStructures)],
        ['Shapes now', (m) => fmt(m.shapesNow)],
        ['Catalogue', (m) => fmt(m.catalog)],
        ['Largest', (m) => fmt(m.largest)],
        ['Rings', (m) => fmt(m.rings)],
        ['Persistence', (m) => fmt(m.persistence, 1)],
        ['Enclosures', (m) => `${fmt(m.enclosures)} (${fmt(m.stableEnclosures)} stable)`],
        ['Energy / photon', (m) => fmt(m.energy, 3)],
        ['Light', (m) => pct(m.light)],
        ['Motion', (m) => fmt(m.kinetic, 3)],
        ['Reactions / step', (m) => fmt(m.reactionRate, 2)],
        ['Bond turnover', (m) => fmt(m.bondTurnover, 4)]
    ];

    const table = $('metricsTable');
    const cells = METRICS.map(([label]) => {
        const row = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = label;
        const td = document.createElement('td');
        row.append(th, td);
        table.appendChild(row);
        return td;
    });

    // ---------- charts ----------
    const CHARTS = [
        { key: 'bonded', label: 'bonded', color: '#7aa2ff', get: (m) => 1 - m.freeFraction, max: 1 },
        { key: 'shapes', label: 'shapes', color: '#ffb86b', get: (m) => m.shapesNow },
        { key: 'enc', label: 'enclosures', color: '#50ffaa', get: (m) => m.enclosures },
        { key: 'energy', label: 'energy', color: '#ffe066', get: (m) => m.energy, max: 1 }
    ];
    const chart = $('historyChart');

    function drawChart(history) {
        const ctx = chart.getContext('2d');
        const w = chart.width, h = chart.height;
        ctx.clearRect(0, 0, w, h);
        if (history.length < 2) return;
        CHARTS.forEach((c, k) => {
            const vals = history.map(c.get);
            const max = c.max || Math.max(1, ...vals);
            ctx.strokeStyle = c.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            vals.forEach((v, i) => {
                const px = (i / (vals.length - 1)) * w;
                const py = h - 4 - (v / max) * (h - 12);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
            ctx.stroke();
            ctx.fillStyle = c.color;
            ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(c.label, 4 + k * 70, 10);
        });
    }

    // ---------- catalogue ----------
    const grid = $('catalogGrid'), catCount = $('catalogCount');
    const tiles = new Map(); // fp -> { el, canvas, count }

    function refreshCatalog() {
        const obs = app.observer;
        const entries = obs.catalog.sorted().slice(0, EM.config.CATALOG_TILES);
        catCount.textContent = fmt(obs.catalog.size);
        const keep = new Set(entries.map((e) => e.fp));
        tiles.forEach((t, fp) => { if (!keep.has(fp)) { t.el.remove(); tiles.delete(fp); } });

        entries.forEach((e, idx) => {
            let t = tiles.get(e.fp);
            if (!t) {
                const el = document.createElement('button');
                el.className = 'tile';
                el.title = `${e.name}: ${e.size} photons, ${e.edges} bonds, ${e.cycles} ring(s), found at step ${e.discoveredAt}`;
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                EM.tiles.drawTile(canvas, e, app.world.laws.color);
                const name = document.createElement('span');
                name.className = 'tile-name';
                name.textContent = e.name;
                const count = document.createElement('span');
                count.className = 'tile-count';
                el.append(canvas, name, count);
                el.addEventListener('click', () => selectShape(e));
                t = { el, count };
                tiles.set(e.fp, t);
            }
            t.count.textContent = `${e.current} / ${e.peak}`;
            t.count.title = 'now / peak';
            t.el.classList.toggle('gone', e.current === 0);
            if (grid.children[idx] !== t.el) grid.insertBefore(t.el, grid.children[idx] || null);
        });
    }

    /** Highlights every current instance of a catalogue entry. */
    function selectShape(entry) {
        const members = [];
        app.observer.stable.forEach((s) => { if (s.fp === entry.fp) members.push(...s.members); });
        EM.renderer.selection = { members, label: entry.name };
        showInspector(`<b>${entry.name}</b> – ${entry.size} photons, ${entry.edges} bonds, ${entry.cycles} ring(s)<br>` +
            `${entry.current} instance(s) now, peak ${entry.peak}, discovered at step ${fmt(entry.discoveredAt)}`);
    }

    // ---------- inspector ----------
    const inspector = $('inspector'), inspectorBody = $('inspectorBody');
    $('inspectorClose').addEventListener('click', () => {
        inspector.hidden = true;
        EM.renderer.selection = null;
    });

    function showInspector(html) {
        inspectorBody.innerHTML = html;
        inspector.hidden = false;
    }

    /** Click on a photon: show it and highlight the structure it belongs to. */
    function inspectPhoton(i) {
        const w = app.world, MV = EM.config.MAX_VALENCE;
        if (i < 0) {
            inspector.hidden = true;
            EM.renderer.selection = null;
            return;
        }
        // flood fill over bonds = the structure of this photon
        const members = [i], seen = new Set([i]);
        for (let k = 0; k < members.length && members.length < 5000; k++) {
            const p = members[k];
            for (let s = 0; s < w.deg[p]; s++) {
                const q = w.partner[p * MV + s];
                if (!seen.has(q)) { seen.add(q); members.push(q); }
            }
        }
        let shape = '';
        if (members.length > 1) {
            const info = EM.structures.describe(w, members);
            const e = app.observer.catalog.entries.get(info.fp);
            shape = e ? `part of <b>${e.name}</b> (${info.members.length} photons, ${info.cycles} ring(s))`
                : `part of a structure of ${info.members.length} photons (not stable yet)`;
        } else {
            shape = 'free photon';
        }
        EM.renderer.selection = { members, label: 'photon ' + i };
        const t = w.type[i];
        showInspector(`<span class="swatch" style="background:${w.laws.color[t]}"></span><b>photon #${i}</b>, type ${t}<br>` +
            `energy ${fmt(w.energy[i], 3)}, bonds ${w.deg[i]}/${w.laws.valence[t]}, speed ${fmt(Math.hypot(w.vx[i], w.vy[i]), 2)}<br>${shape}`);
    }

    // ---------- refresh ----------
    let lastHistoryLen = -1;
    app.onChange(() => {
        tiles.forEach((t) => t.el.remove());
        tiles.clear();
        inspector.hidden = true;
        lastHistoryLen = -1;
    });

    EM.ui.register(() => {
        const obs = app.observer;
        if (!obs) return;
        const m = obs.metrics;
        METRICS.forEach(([, f], k) => { cells[k].textContent = f(m); });
        if (obs.history.length !== lastHistoryLen) {
            lastHistoryLen = obs.history.length;
            drawChart(obs.history);
            refreshCatalog();
        }
    });

    EM.ui.inspectPhoton = inspectPhoton;
})(EM);
