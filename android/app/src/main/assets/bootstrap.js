(function () {
    if (window.__haxballMobileStarted) return;
    window.__haxballMobileStarted = true;
    var attempts = 0;
    function waitForGame() {
        try {
            var frame = document.querySelector('.gameframe');
            var game = frame && frame.contentWindow.document;
            if (!document.head || !document.body || !game || !game.head || !game.body ||
                game.querySelector('.loader-view') ||
                !game.querySelector('.choose-nickname-view, .roomlist-view, .room-view')) {
                retry();
                return;
            }
            // The original client needs this canvas mode. Reload only once.
            if (localStorage.getItem('low_latency_canvas') !== '0') {
                localStorage.setItem('low_latency_canvas', '0');
                location.reload();
                return;
            }
            if (!document.querySelector('meta[name="viewport"]')) {
                var meta = document.createElement('meta');
                meta.name = 'viewport';
                document.head.appendChild(meta);
            }
            installClient();
        } catch (error) {
            console.error('HAXMOBILE: N?o foi poss?vel iniciar os controles: ' + error.message);
        }
    }
    function retry() {
        if (++attempts < 120) setTimeout(waitForGame, 250);
        else console.error('HAXMOBILE: O jogo n?o carregou a interface esperada. Verifique a conex?o e recarregue o app.');
    }
    function installClient() {
        /*CLIENT_SCRIPT*/
        /*MOBILE_FEATURES*/
        /*MOBILE_UI*/
        window.haxballMobileRelease = releaseControls;
        window.addEventListener('blur', window.haxballMobileRelease);
        gameFrame.addEventListener('blur', window.haxballMobileRelease);
        [document, gameFrame.document].forEach(function (doc) {
            doc.addEventListener('visibilitychange', function () {
                if (doc.hidden) window.haxballMobileRelease();
            });
        });
    }
    waitForGame();
})();
