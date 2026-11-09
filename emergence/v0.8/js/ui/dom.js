/** DOM helpers + the UI refresh registry. */
(function (EM) {
    'use strict';

    const $ = (id) => document.getElementById(id);

    /** Number formatting for panels. */
    function fmt(v, digits = 2) {
        if (v === undefined || v === null || !isFinite(v)) return '–';
        if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('en-US');
        if (Number.isInteger(v)) return String(v);
        return v.toFixed(digits);
    }

    function pct(v) {
        return isFinite(v) ? Math.round(v * 100) + '%' : '–';
    }

    function download(filename, text) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function pickFile(accept) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.onchange = () => {
                const f = input.files[0];
                if (!f) return;
                f.text().then(resolve);
            };
            input.click();
        });
    }

    const refreshers = [];

    EM.ui = {
        $, fmt, pct, download, pickFile,
        /** Registers a function called ~4x per second and after every new world. */
        register(fn) {
            refreshers.push(fn);
        },
        refresh() {
            for (const fn of refreshers) fn();
        }
    };
})(EM);
