// Smoke test de interface: carrega o bundle real num DOM (jsdom) e exercita
// os painéis novos. Garante que a camada visual não quebra em runtime.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const css = read('mobile-ui.css');
const bundle = read('android/app/src/main/assets/bootstrap.js')
    .replace('/*CLIENT_SCRIPT*/', read('min.js'))
    .replace('/*MOBILE_FEATURES*/', read('mobile-features.js'))
    .replace('/*MOBILE_UI*/', read('mobile-ui.js').replace('/*UI_STYLE_TEXT*/', JSON.stringify(css)));

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => errors.push(error.message));

const gameDom = new JSDOM(`<!doctype html><html><head></head><body>
    <div class="view"><div class="choose-nickname-view"><input value="Teste"></div></div>
</body></html>`, { url: 'https://www.haxball.com/play', pretendToBeVisual: true, virtualConsole });

const pageDom = new JSDOM(`<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    </head><body><div class="gameframe"></div></body></html>`,
    { url: 'https://www.haxball.com/play', pretendToBeVisual: true, runScripts: 'outside-only', virtualConsole });

const page = pageDom.window;
const frame = page.document.querySelector('.gameframe');
Object.defineProperty(frame, 'contentWindow', { value: gameDom.window, configurable: true });
Object.defineProperty(frame, 'contentDocument', { value: gameDom.window.document, configurable: true });
const mediaStub = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
page.matchMedia = mediaStub;
gameDom.window.matchMedia = mediaStub;
// O bootstrap recarrega uma vez para fixar low_latency_canvas; já deixamos pronto.
page.localStorage.setItem('low_latency_canvas', '0');
page.localStorage.setItem('hm_settings', JSON.stringify({ theme: 'dark', animations: 'reduced' }));

page.eval(bundle);
const diag = page.haxballMobileDiag;
assert(diag, 'o bundle precisa expor window.haxballMobileDiag');
assert.equal(diag.version, '0.4.0');

// init() roda no intervalo de 1 s do min.js; aguardamos ele assumir o corpo.
setTimeout(() => {
    try {
        assert.equal(diag.hasBody(), true, 'init() precisa assumir o corpo do jogo');

        // --- painel de configurações -------------------------------------
        const panel = diag.settings('Geral');
        assert(panel, 'renderMobileSettings deve devolver o corpo do painel');
        const sheet = gameDom.window.document.getElementById('mobile-panel');
        assert(sheet, 'o painel precisa existir no DOM');
        assert(sheet.classList.contains('hm-sheet'), 'o painel usa a superfície do design system');
        assert(sheet.getAttribute('role') === 'dialog');

        const tabs = [...sheet.querySelectorAll('.hm-tabs [role=tab]')];
        assert.equal(tabs.length, 8, 'oito categorias de configuração');
        assert.deepEqual(tabs.map(tab => tab.textContent),
            ['Geral', 'Interface', 'Controles', 'Câmera', 'Jogo', 'Áudio', 'Desempenho', 'Avançado']);
        assert.equal(tabs[0].getAttribute('aria-selected'), 'true');

        // Cartões e componentes aparecem na aba Geral.
        assert(sheet.querySelector('.hm-card'), 'usa cartões agrupados');
        assert(sheet.querySelector('.hm-segment button[aria-selected]'), 'segmentos com estado acessível');
        assert(sheet.querySelector('input[type=checkbox]'), 'switches nativos acessíveis');

        // Troca de aba: Câmera tem segmento, slider e nota.
        tabs[3].dispatchEvent(new page.Event('click', { bubbles: true }));
        assert.equal(tabs[3].getAttribute('aria-selected'), 'true');
        assert.equal(tabs[0].getAttribute('aria-selected'), 'false');
        const cameraTab = sheet.querySelector('.hm-settings-body');
        assert(cameraTab.querySelector('.hm-segment'), 'aba Câmera tem seletor de modo');
        assert(cameraTab.querySelector('input[type=range]'), 'aba Câmera tem controle de intensidade');
        assert(cameraTab.querySelector('.hm-note'), 'aba Câmera explica o funcionamento');

        // Preferências alteradas refletem no estado persistido.
        const modeButtons = [...sheet.querySelectorAll('.hm-segment button')];
        const fixed = modeButtons.find(button => button.textContent === 'Fixa');
        fixed.dispatchEvent(new page.Event('click', { bubbles: true }));
        assert.equal(JSON.parse(page.localStorage.getItem('hm_settings')).cameraMode, 'fixed');

        // --- câmera ------------------------------------------------------
        const camera = diag.camera();
        assert.equal(camera.mode, 'fixed');
        assert.equal(camera.mark, true);

        // --- botão Voltar ------------------------------------------------
        assert.equal(page.haxballMobileBack(), true, 'Voltar fecha o painel');
        assert.equal(gameDom.window.document.getElementById('mobile-panel'), null, 'o painel é removido');
        assert.equal(page.haxballMobileBack(), false, 'sem painéis, o Voltar segue para o Android');

        // --- estilos injetados nos dois documentos ------------------------
        assert(page.document.querySelector('style'), 'o tema é injetado na página');
        assert(gameDom.window.document.querySelector('style'), 'o tema é injetado no frame do jogo');

        assert.deepEqual(errors, [], 'nenhum erro não tratado durante a execução');
        console.log('PASS: interface carrega no DOM real, painéis/abas/componentes funcionam e nada quebra.');
        process.exit(0);
    } catch (error) {
        console.error(error);
        console.error('erros do jsdom:', errors.slice(0, 5));
        process.exit(1);
    }
}, 1300);
