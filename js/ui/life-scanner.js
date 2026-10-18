/** Floating Life Scanner panel: on/off switch, detection ranges, auto-sizing. */
(function (PD) {
    'use strict';

    const sim = PD.sim;
    const life = sim.life;
    const { $, bindRangePair } = PD.dom;

    const panel = $('lifeScannerPanel');
    const content = $('scannerContent');
    const header = document.querySelector('.scanner-header');
    const toggleBtn = $('scannerToggle');

    /** Grows the panel to fit its content (but never beyond the viewport). */
    function fitToContent() {
        if (!panel || !content) return;

        if (!sim.enabled.lifeDetection) {
            panel.style.width = '170px';
            panel.style.height = 'auto';
            content.style.maxHeight = 'calc(100vh - 120px)';
            return;
        }

        const maxWidth = Math.max(260, window.innerWidth - 24);
        panel.style.width = `${Math.min(Math.max(content.scrollWidth + 24, 290), maxWidth)}px`;

        const headerHeight = header ? header.offsetHeight : 0;
        const maxHeight = Math.max(180, window.innerHeight - 24);
        const panelHeight = Math.min(headerHeight + content.scrollHeight + 2, maxHeight);
        panel.style.height = `${panelHeight}px`;
        content.style.maxHeight = `${Math.max(80, panelHeight - headerHeight - 2)}px`;
    }

    function toggle() {
        const on = !sim.enabled.lifeDetection;
        sim.enabled.lifeDetection = on;
        toggleBtn.classList.toggle('active', on);
        content.style.display = on ? 'block' : 'none';

        if (on) {
            requestAnimationFrame(fitToContent);
        } else {
            fitToContent();
            life.forms = [];
            PD.hud.setCounter('life', 0);
        }
    }

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // the header has its own click handler
        toggle();
    });
    if (header) header.addEventListener('click', toggle);

    window.addEventListener('resize', () => {
        if (sim.enabled.lifeDetection) fitToContent();
    });

    bindRangePair({ from: 'lifeMinParticlesFrom', to: 'lifeMinParticlesTo', out: 'lifeMinParticlesValue', target: life.particles });
    bindRangePair({ from: 'lifeMinColorsFrom', to: 'lifeMinColorsTo', out: 'lifeMinColorsValue', target: life.colors });
    bindRangePair({ from: 'lifeMaxDistanceFrom', to: 'lifeMaxDistanceTo', out: 'lifeMaxDistanceValue', unit: 'px', target: life.distance });
    bindRangePair({ from: 'lifeMaxSpeedDiffFrom', to: 'lifeMaxSpeedDiffTo', out: 'lifeMaxSpeedDiffValue', target: life.speedDiff });

    // "Show Life Scanner" option in the settings panel
    PD.storage.bindCheckbox('lifeScannerDisplayCheckbox', PD.config.STORAGE_KEYS.lifeScannerDisplay, (visible) => {
        if (!panel) return;
        panel.style.display = visible ? 'block' : 'none';
        if (visible && sim.enabled.lifeDetection) requestAnimationFrame(fitToContent);
    });

    PD.ui.lifeScanner = { toggle, fitToContent };
})(window.PD);
