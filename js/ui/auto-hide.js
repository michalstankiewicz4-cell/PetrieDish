/** Optional: hide the floating buttons after 2 s without mouse activity. */
(function (PD) {
    'use strict';

    const HIDE_AFTER_MS = 2000;
    let enabled = false;
    let timer = null;

    function showButtons() {
        document.body.classList.remove('ui-hidden');
    }

    function scheduleHide() {
        clearTimeout(timer);
        showButtons();
        timer = setTimeout(() => {
            // never hide while a panel is open
            if (!PD.ui.panels.anyOpen() && !PD.ui.vfxPanel.isOpen()) {
                document.body.classList.add('ui-hidden');
            }
        }, HIDE_AFTER_MS);
    }

    PD.storage.bindCheckbox('autoHideButtonsCheckbox', PD.config.STORAGE_KEYS.autoHide, (on) => {
        enabled = on;
        if (on) {
            scheduleHide();
        } else {
            clearTimeout(timer);
            showButtons();
        }
    });

    const onActivity = () => { if (enabled) scheduleHide(); };
    document.addEventListener('mousemove', onActivity);
    document.addEventListener('mousedown', onActivity);
})(window.PD);
