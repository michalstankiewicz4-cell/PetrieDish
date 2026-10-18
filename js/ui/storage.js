/**
 * localStorage wrapper. Storage may be unavailable (private mode, file:// in
 * some browsers) - every access is guarded, failures are ignored.
 */
(function (PD) {
    'use strict';

    function get(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function set(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (e) { /* ignore */ }
    }

    /**
     * Checkbox whose state is remembered between visits.
     * The saved value (if any) is restored immediately and passed to `apply`.
     */
    function bindCheckbox(id, key, apply) {
        const box = document.getElementById(id);
        if (!box) return null;
        box.addEventListener('change', (e) => {
            apply(e.target.checked);
            set(key, e.target.checked);
        });
        const saved = get(key);
        if (saved !== null) {
            box.checked = saved === 'true';
            apply(box.checked);
        }
        return box;
    }

    PD.storage = { get, set, bindCheckbox };
})(window.PD);
