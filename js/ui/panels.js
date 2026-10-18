/**
 * Left (settings) and right (mechanics) slide-in panels.
 * Opening one closes the other unless it is locked; clicking outside closes unlocked panels.
 */
(function (PD) {
    'use strict';

    const { $ } = PD.dom;

    function createPanel(side) {
        const panel = $(`${side}Panel`);
        const hamburger = $(`${side}Hamburger`);
        const lock = $(`${side}PanelLockCheckbox`);
        const closeBtn = $(`close${side[0].toUpperCase()}${side.slice(1)}Panel`);

        const api = {
            panel,
            hamburger,
            isOpen: () => panel.classList.contains('open'),
            isLocked: () => !!(lock && lock.checked),
            open() {
                panel.classList.add('open');
                hamburger.classList.add('active');
            },
            close() {
                if (!api.isOpen() || api.isLocked()) return;
                panel.classList.remove('open');
                hamburger.classList.remove('active');
            }
        };
        closeBtn.addEventListener('click', api.close);
        return api;
    }

    const left = createPanel('left');
    const right = createPanel('right');

    function wireHamburger(self, other) {
        self.hamburger.addEventListener('click', () => {
            if (self.isOpen()) self.close(); else self.open();
            if (other.isOpen() && !other.isLocked()) other.close();
        });
    }
    wireHamburger(left, right);
    wireHamburger(right, left);

    document.addEventListener('click', (e) => {
        for (const p of [left, right]) {
            if (p.isOpen() && !p.panel.contains(e.target) && !p.hamburger.contains(e.target)) {
                p.close();
            }
        }
    });

    PD.ui = PD.ui || {};
    PD.ui.panels = { left, right, anyOpen: () => left.isOpen() || right.isOpen() };
})(window.PD);
