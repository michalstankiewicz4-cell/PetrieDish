/**
 * Per-colour editors (modals): initial speed, mass, charge, interaction range,
 * the interaction matrix and the read-only colour properties table.
 */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const { $, modal, on } = PD.dom;

    /** Colours of the species currently in use. */
    const activeColors = () => sim.colors.slice(0, sim.speciesCount);

    /** Runs fn for every particle that still uses `color` (mixed particles have their own copy). */
    function forParticlesOf(color, fn) {
        sim.particles.forEach((p) => { if (p.colorData === color) fn(p); });
    }

    const initialSpeedOf = (c) => (c.initialSpeed !== undefined ? c.initialSpeed : 1.0);
    const signed = (v) => (v > 0 ? '+' + v.toFixed(1) : v.toFixed(1));

    /**
     * Generic "one slider per colour" editor.
     * apply(color, value) must update the colour AND live particles.
     * actions: { buttonId: (index, count) => value }
     */
    const EDITORS = [
        {
            modal: 'speedModal', close: 'speedModalClose', table: 'speedTable', open: ['editSpeedBtn', 'editSpeedBtn2'],
            slider: { min: 0, max: 200, step: 5 },
            toSlider: (c) => Math.round(initialSpeedOf(c) * 100),
            current: (c) => Math.round(initialSpeedOf(c) * 100) / 100,
            fromSlider: (v) => v / 100,
            format: (v) => v.toFixed(2),
            apply(color, value) {
                const old = initialSpeedOf(color);
                color.initialSpeed = value;
                // rescale the current velocity of existing particles
                const scale = old > 0.001 ? value / old : value;
                forParticlesOf(color, (p) => { p.vx *= scale; p.vy *= scale; });
            },
            actions: {
                speedAllZeroBtn: () => 0,
                speedAllMaxBtn: () => 1.0,
                speedGradientBtn: (i, n) => (n > 1 ? Math.round((1 - i / (n - 1)) * 200) / 100 : 1.0)
            }
        },
        {
            modal: 'massModal', close: 'massModalClose', table: 'massTable', open: ['editMassBtn'],
            slider: { min: 30, max: 200, step: 5 },
            toSlider: (c) => Math.round(c.mass * 100),
            current: (c) => c.mass,
            fromSlider: (v) => v / 100,
            format: (v) => v.toFixed(2),
            apply(color, value) {
                color.mass = value;
                forParticlesOf(color, (p) => { p._mass = value; });
            },
            actions: {
                massRandomBtn: () => Math.round((0.3 + Math.random() * 1.7) * 20) / 20,
                massGradientBtn: (i, n) => (n > 1 ? Math.round((0.3 + (1.7 * i / (n - 1))) * 100) / 100 : 1.0)
            }
        },
        {
            modal: 'chargeModal', close: 'chargeModalClose', table: 'chargeTable', open: ['editChargeBtn'],
            slider: { min: -100, max: 100, step: 10 },
            toSlider: (c) => Math.round(c.charge * 100),
            current: (c) => c.charge,
            fromSlider: (v) => v / 100,
            format: signed,
            apply(color, value) {
                color.charge = value;
                forParticlesOf(color, (p) => { p._charge = value; });
            },
            actions: {
                chargeRandomBtn: () => (Math.random() < 0.5 ? -1 : 1),
                chargeGradientBtn: (i, n) => (n > 1 ? Math.round((-1 + (2 * i / (n - 1))) * 10) / 10 : 0)
            }
        },
        {
            modal: 'rangeModal', close: 'rangeModalClose', table: 'rangeTable', open: ['editRangeBtn'],
            slider: { min: 10, max: 200, step: 5 },
            toSlider: (c) => c.interactionRange,
            current: (c) => c.interactionRange,
            fromSlider: (v) => v,
            format: (v) => v + 'px',
            apply(color, value) {
                color.interactionRange = value;
                forParticlesOf(color, (p) => { p._range = value; p._rangeSq = value * value; });
            },
            actions: {
                rangeRandomBtn: () => Math.round((10 + Math.random() * 190) / 5) * 5,
                rangeGradientBtn: (i, n) => (n > 1 ? Math.round((10 + (190 * i / (n - 1))) / 5) * 5 : 100)
            }
        }
    ];

    function createEditor(spec) {
        const table = $(spec.table);

        function render() {
            table.innerHTML = '';
            activeColors().forEach((color) => {
                const row = document.createElement('div');
                row.className = 'color-editor-row';

                const label = document.createElement('span');
                label.className = 'color-editor-label';
                label.style.color = color.hex;
                label.textContent = color.name.toUpperCase();

                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = spec.slider.min;
                slider.max = spec.slider.max;
                slider.step = spec.slider.step;
                slider.value = spec.toSlider(color);

                const value = document.createElement('span');
                value.className = 'color-editor-value';
                value.textContent = spec.format(spec.current(color));

                slider.addEventListener('input', () => {
                    const v = spec.fromSlider(parseInt(slider.value));
                    spec.apply(color, v);
                    value.textContent = spec.format(v);
                });

                row.append(label, slider, value);
                table.appendChild(row);
            });
        }

        const dialog = modal(spec.modal, spec.close, render);
        spec.open.forEach((id) => on(id, 'click', dialog.open));

        Object.entries(spec.actions).forEach(([buttonId, valueFor]) => {
            on(buttonId, 'click', () => {
                const colors = activeColors();
                colors.forEach((color, i) => spec.apply(color, valueFor(i, colors.length)));
                render();
            });
        });
        return { render, dialog };
    }

    EDITORS.forEach(createEditor);

    // ---------- interaction matrix ----------

    const matrixGrid = $('interactionMatrix');

    function headerCell(className, color, axisLabel) {
        const cell = document.createElement('div');
        cell.className = `matrix-cell ${className}`;
        const name = document.createElement('div');
        name.className = 'matrix-color-label';
        name.style.color = color.hex;
        name.textContent = color.name.substring(0, 4).toUpperCase();
        const axis = document.createElement('div');
        axis.className = 'matrix-axis-label';
        axis.textContent = axisLabel;
        cell.append(name, axis);
        return cell;
    }

    function matrixInput(from, to) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'matrix-input';
        input.min = '-1.0';
        input.max = '1.0';
        input.step = '0.1';
        input.value = ((sim.matrix[from] && sim.matrix[from][to]) || 0).toFixed(1);
        input.title = `${from} → ${to}`;
        input.addEventListener('change', (e) => {
            const parsed = parseFloat(e.target.value);
            if (isNaN(parsed)) {
                e.target.value = ((sim.matrix[from] && sim.matrix[from][to]) || 0).toFixed(1);
                return;
            }
            const clamped = Math.max(-1.0, Math.min(1.0, parsed));
            e.target.value = clamped.toFixed(1);
            if (!sim.matrix[from]) sim.matrix[from] = {};
            sim.matrix[from][to] = clamped;
        });
        return input;
    }

    /** Row = FROM (whose force), column = TO. */
    function renderMatrix() {
        if (!matrixGrid) return;
        const colors = activeColors();
        matrixGrid.innerHTML = '';
        matrixGrid.style.gridTemplateColumns = `60px repeat(${colors.length}, ${colors.length <= 6 ? '1fr' : 'minmax(48px, 1fr)'})`;

        const corner = document.createElement('div');
        corner.className = 'matrix-cell matrix-corner';
        corner.innerHTML = '<div class="matrix-corner-label">Y↓ / X→</div>';
        matrixGrid.appendChild(corner);

        colors.forEach((c) => matrixGrid.appendChild(headerCell('matrix-header-col', c, 'TO→')));

        colors.forEach((fromColor) => {
            matrixGrid.appendChild(headerCell('matrix-header-row', fromColor, 'FROM'));
            colors.forEach((toColor) => {
                const cell = document.createElement('div');
                cell.className = 'matrix-cell matrix-data';
                if (fromColor.name === toColor.name) cell.classList.add('is-diagonal');
                cell.appendChild(matrixInput(fromColor.name, toColor.name));
                matrixGrid.appendChild(cell);
            });
        });
    }

    /** Fills the active part of the matrix with valueFor(row, col, n) and redraws it. */
    function fillMatrix(valueFor) {
        const names = activeColors().map((c) => c.name);
        const n = names.length;
        names.forEach((from, r) => {
            if (!sim.matrix[from]) sim.matrix[from] = {};
            names.forEach((to, c) => { sim.matrix[from][to] = valueFor(r, c, n); });
        });
        renderMatrix();
    }

    const round1 = (v) => Math.round(v * 10) / 10;
    on('randomizeMatrixBtn', 'click', () => fillMatrix(() => round1(Math.random() * 2 - 1)));
    // diagonal ramp from +1 (top-left) to -1 (bottom-right)
    on('gradientMatrixBtn', 'click', () => fillMatrix((r, c, n) => {
        const total = n * n - 1;
        return round1(total > 0 ? 1 - (2 * (r * n + c) / total) : 0);
    }));
    // every row: +1 in the first column ... -1 in the last
    on('gradientVMatrixBtn', 'click', () => fillMatrix((r, c, n) => round1(n > 1 ? 1 - (2 * c / (n - 1)) : 0)));

    const matrixDialog = modal('matrixModal', 'matrixModalClose', renderMatrix);
    on('editMatrixBtn', 'click', matrixDialog.open);

    // ---------- colour properties (read-only) ----------

    const propsTable = $('colorPropertiesTable');

    function propsRow(cells, cellClass) {
        const row = document.createElement('div');
        row.className = 'props-row';
        cells.forEach(([text, extraClass, color]) => {
            const cell = document.createElement('div');
            cell.className = cellClass + (extraClass ? ' ' + extraClass : '');
            cell.textContent = text;
            if (color) cell.style.color = color;
            row.appendChild(cell);
        });
        return row;
    }

    function renderProperties() {
        if (!propsTable) return;
        propsTable.innerHTML = '';
        propsTable.appendChild(propsRow(
            ['Color', 'Charge', 'Mass', 'Range', 'Vorticness'].map((t) => [t]), 'props-header'));

        activeColors().forEach((c) => {
            const chargeClass = c.charge > 0 ? 'positive' : (c.charge < 0 ? 'negative' : '');
            propsTable.appendChild(propsRow([
                [c.name.toUpperCase(), 'color-name', c.hex],
                [c.charge > 0 ? '+1' : (c.charge < 0 ? '-1' : '0'), chargeClass],
                [c.mass.toFixed(2)],
                [c.interactionRange + 'px'],
                [c.vorticness.toFixed(2)]
            ], 'props-cell'));
        });
    }

    const propertiesDialog = modal('propertiesModal', 'propertiesModalClose', renderProperties);
    on('viewPropertiesBtn', 'click', propertiesDialog.open);

    PD.ui.colorEditors = { renderMatrix, renderProperties };
})(window.PD);
