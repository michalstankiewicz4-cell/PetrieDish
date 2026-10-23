/** Creates the shared renderer (needed by the UI modules loaded after this file). */
(function (EM) {
    'use strict';

    EM.renderer = new EM.Renderer(document.getElementById('world'));
})(EM);
