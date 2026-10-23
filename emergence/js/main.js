/** Entry point - runs after every other script (order in index.html). */
(function (EM) {
    'use strict';

    document.title = `Emergence v${EM.VERSION}`;
    document.getElementById('version').textContent = 'v' + EM.VERSION;

    // small screens: start with the panels closed (the toggles open them)
    if (window.innerWidth < 760) document.querySelectorAll('.panel').forEach((p) => p.classList.remove('open'));

    const fromLink = EM.app.readHash();
    EM.lab.controller.init();
    document.getElementById('labCount').value = EM.lab.controller.opts.count;
    EM.ui.labRender();

    EM.app.newLaws(fromLink ? EM.app.settings.lawsSeed : Math.floor(Math.random() * 1e9), EM.app.settings.types);
    EM.loop.start();
})(EM);
