/** Small DOM helpers used by all UI modules. */
(function (PD) {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const sliders = new Map(); // id -> { input, output, format }

    function show(el, visible, display = 'block') {
        if (el) el.style.display = visible ? display : 'none';
    }

    /**
     * Binds an <input type="range"> to a state setter and a value label.
     * @param {object} spec
     * @param {string} spec.id        input id
     * @param {string} [spec.out]     id of the element showing the value
     * @param {(v:number)=>string} [spec.format] label text for an integer slider value
     * @param {(v:number)=>void} spec.apply      writes the value into the state
     */
    function bindSlider({ id, out, format = String, apply }) {
        const input = $(id);
        const output = out ? $(out) : null;
        if (!input) return;
        sliders.set(id, { input, output, format });
        input.addEventListener('input', (e) => {
            const v = parseInt(e.target.value);
            apply(v);
            if (output) output.textContent = format(v);
        });
    }

    /** Moves a bound slider and its label without triggering its handler. */
    function setSlider(id, value) {
        const s = sliders.get(id);
        if (!s) return;
        s.input.value = value;
        if (s.output) s.output.textContent = s.format(value);
    }

    /**
     * Two sliders forming a [from, to] range; `from` can never pass `to`.
     * @param {{from:string, to:string, out:string, unit?:string, target:{from:number,to:number}}} spec
     */
    function bindRangePair({ from, to, out, unit = '', target }) {
        const fromEl = $(from), toEl = $(to), outEl = $(out);
        const label = () => { outEl.textContent = `${parseInt(fromEl.value)}-${parseInt(toEl.value)}${unit}`; };

        fromEl.addEventListener('input', () => {
            let a = parseInt(fromEl.value);
            const b = parseInt(toEl.value);
            if (a > b) { a = b; fromEl.value = a; }
            target.from = a;
            label();
        });
        toEl.addEventListener('input', () => {
            let b = parseInt(toEl.value);
            const a = parseInt(fromEl.value);
            if (b < a) { b = a; toEl.value = b; }
            target.to = b;
            label();
        });
    }

    /** Modal overlay: close button + click on the backdrop. Returns { open, close, el }. */
    function modal(modalId, closeBtnId, onOpen) {
        const el = $(modalId);
        const close = () => el.classList.remove('active');
        const open = () => {
            if (onOpen) onOpen();
            el.classList.add('active');
        };
        const closeBtn = $(closeBtnId);
        if (closeBtn) closeBtn.addEventListener('click', close);
        el.addEventListener('click', (e) => { if (e.target === el) close(); });
        return { el, open, close, isOpen: () => el.classList.contains('active') };
    }

    function on(id, event, handler) {
        const el = $(id);
        if (el) el.addEventListener(event, handler);
        return el;
    }

    PD.dom = { $, show, bindSlider, setSlider, bindRangePair, modal, on };
})(window.PD);
