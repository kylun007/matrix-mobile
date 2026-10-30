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
assert.equal(diag.version, '0.5.0');

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
        // Padrões seguros: destaque do jogador desligado e sem acesso ao renderer
        // no modo Fixa (que é 100% CSS).
        assert.equal(camera.mark, false, 'destaque do jogador vem desligado');
        assert.equal(camera.cssOnly, true, 'modo Fixa não toca no canvas do jogo');
        assert.equal(camera.hooked, false, 'nenhum hook de renderer é instalado no modo Fixa');
        assert.equal(typeof camera.report, 'string');

        // --- botão Voltar ------------------------------------------------
        assert.equal(page.haxballMobileBack(), true, 'Voltar fecha o painel');
        assert.equal(gameDom.window.document.getElementById('mobile-panel'), null, 'o painel é removido');
        assert.equal(page.haxballMobileBack(), false, 'sem painéis, o Voltar segue para o Android');

        // --- tela de nick própria -----------------------------------------
        const gameDoc = gameDom.window.document;
        const nick = gameDoc.getElementById('hm-nick');
        assert(nick, 'a tela de nick própria substitui a nativa');
        assert(gameDoc.documentElement.classList.contains('hm-nick-open'), 'a nativa fica escondida');
        const nickInput = nick.querySelector('#hm-nick-input');
        const nativeInput = gameDoc.querySelector('.choose-nickname-view input');
        assert.equal(nickInput.value, 'Teste', 'o campo começa com o nick que o HaxBall já tinha');
        assert.equal(nativeInput.value, 'Teste');

        const fire = (node, type) => node.dispatchEvent(new gameDom.window.Event(type, { bubbles: true, cancelable: true }));
        const nickForm = nick.querySelector('.hm-nick-form');

        // Nick curto: mostra o erro e não mexe no cliente.
        nickInput.value = 'a';
        fire(nickInput, 'input');
        fire(nickForm, 'submit');
        assert.equal(nativeInput.value, 'Teste', 'nick curto não chega ao cliente');
        assert(nick.querySelector('.hm-nick-err').classList.contains('hm-on'), 'o erro aparece');

        // Nick válido: vai para o campo nativo e fica salvo.
        nickInput.value = 'kylun';
        fire(nickInput, 'input');
        fire(nickForm, 'submit');
        assert.equal(nativeInput.value, 'kylun', 'o nick é repassado ao HaxBall');
        assert.equal(page.localStorage.getItem('hm_nick'), 'kylun', 'o nick fica salvo no aparelho');
        assert.equal(nick.dataset.state, 'loading', 'mostra o estado de entrada');

        // Sortear troca o campo.
        fire(nick.querySelector('.hm-nick-dice'), 'click');
        assert(nickInput.value.length > 0, 'o dado escreve um nick');

        // Trocas de pele (temas) aplicam no documento inteiro.
        fire(nick.querySelector('.hm-dot[data-skin="cartoon"]'), 'click');
        assert.equal(JSON.parse(page.localStorage.getItem('hm_settings')).skin, 'cartoon');
        assert(gameDoc.documentElement.classList.contains('hm-skin-cartoon'), 'a pele cartoon é aplicada');
        assert(nick.querySelector('.hm-dot[data-skin="cartoon"]').getAttribute('aria-pressed') === 'true');

        // --- tela de salas -------------------------------------------------
        // O HaxBall entrega a lista pronta e o rodapé de botões flutuava por
        // cima das linhas; agora a tela é remontada num contêiner próprio.
        const view = gameDoc.body.children[0];
        view.insertAdjacentHTML('beforeend', `
            <div class="roomlist-view"><div class="dialog">
                <h1>Salas HaxBall</h1>
                <div class="separator"></div>
                <div class="filters"></div>
                <div class="toolbar">
                    <label>Buscar sala:</label>
                    <input type="text" data-hook="search" placeholder="Buscar">
                </div>
                <div data-hook="listscroll"><table data-hook="list"><tbody>
                    <tr><td data-hook="name">Sala A</td><td data-hook="players">2/12</td><td data-hook="pass">No</td><td data-hook="distance"><span class="flagico f-br"></span>900km</td></tr>
                    <tr><td data-hook="name">Sala B</td><td data-hook="players">5/8</td><td data-hook="pass">Yes</td><td data-hook="distance"><span class="flagico f-br"></span>1200km</td></tr>
                    <tr><td data-hook="name">Sala C</td><td data-hook="players">0/16</td><td data-hook="pass">No</td><td data-hook="distance"><span class="flagico f-pt"></span>1500km</td></tr>
                </tbody></table></div>
                <div class="buttons">
                    <button data-hook="join"><div>Entrar</div></button>
                    <button data-hook="refresh"><div>Atualizar</div></button>
                    <button data-hook="create"><div>Criar sala</div></button>
                    <button data-hook="aboutbtn"><div>Sobre</div></button>
                    <button data-hook="settingsbtn"><div>Configurações</div></button>
                    <button data-hook="url-room"><div>Link</div></button>
                    <button data-hook="changenick"><div>Nome</div></button>
                </div>
            </div></div>`);
        assert.equal(diag.rooms(), true, 'a tela de salas é montada');
        const rooms = gameDoc.querySelector('.hm-rooms');
        assert(rooms, 'o contêiner da lista existe');
        assert.equal(rooms.parentNode, gameDoc.querySelector('.roomlist-view > .dialog'));
        assert.equal(rooms.querySelector('h1').textContent, 'Salas', 'título sem a marca antiga');
        assert(rooms.querySelector('.hm-rooms-head').contains(rooms.querySelector('h1')), 'o título entra no cabeçalho');
        assert.deepEqual([...rooms.children].map(el =>
            ['hm-rooms-head', 'hm-room-toolbar', 'hm-rooms-list', 'hm-rooms-bar'].find(name => el.classList.contains(name))),
            ['hm-rooms-head', 'hm-room-toolbar', 'hm-rooms-list', 'hm-rooms-bar'], 'ordem: cabeçalho, busca, lista, barra');
        assert.equal(rooms.querySelector('[data-hook=hm-room-status]').textContent, '3 salas', 'a contagem vai para o cabeçalho');
        assert(rooms.querySelector('.hm-rooms-list [data-hook=listscroll]'), 'a lista rola dentro do contêiner');
        assert(gameDoc.querySelector('.roomlist-view > .dialog > .hm-room-chrome'), 'restos do layout nativo ficam escondidos');
        assert(rooms.querySelector('tbody .hm-region'), 'o selo de região fica dentro da célula');

        // Entrar usa o botão nativo (é ele que sabe qual sala está selecionada).
        let joined = 0;
        rooms.querySelector('button[data-hook=join]').addEventListener('click', () => joined++);
        fire(rooms.querySelector('.hm-rooms-enter'), 'click');
        assert.equal(joined, 1, 'o Entrar da barra dispara o Entrar nativo');

        // Sem sala selecionada o cliente desliga o Entrar nativo: a barra
        // acompanha e o toque explica, em vez de não fazer nada.
        const joinButton = rooms.querySelector('button[data-hook=join]');
        joinButton.disabled = true;
        diag.rooms();
        const enterButton = gameDoc.querySelector('.hm-rooms-enter');
        assert.equal(enterButton.getAttribute('aria-disabled'), 'true', 'o Entrar fica apagado sem seleção');
        fire(enterButton, 'click');
        assert.equal(joined, 1, 'com o Entrar nativo desligado nada dispara');
        joinButton.disabled = false;
        diag.rooms();
        assert.equal(gameDoc.querySelector('.hm-rooms-enter').getAttribute('aria-disabled'), 'false');

        // "Mais opções" guarda as ações que saíram do rodapé.
        fire(rooms.querySelector('.hm-rooms-more'), 'click');
        const moreMenu = gameDoc.querySelector('#mobile-panel .hm-rooms-menu');
        assert(moreMenu, 'a folha de opções abre');
        assert.deepEqual([...moreMenu.querySelectorAll('.hm-rooms-menu-row span')].map(span => span.textContent),
            ['Criar sala', 'Link da sala', 'Nome', 'Configurações do cliente', 'Ajustes', 'Sobre']);
        diag.close();

        // --- voltar ao início ----------------------------------------------
        // Atalho visível no cabeçalho da lista; o reinício só acontece depois
        // da confirmação (reload não é disparado no teste).
        const homeBtn = rooms.querySelector('[data-hook=hm-rooms-home]');
        assert(homeBtn, 'o Início fica no cabeçalho, fora do menu de opções');
        assert.equal(homeBtn.getAttribute('aria-label'), 'Voltar ao início');
        fire(homeBtn, 'click');
        const homeSheet = gameDoc.getElementById('mobile-panel');
        assert(homeSheet, 'o atalho abre a confirmação');
        assert.equal(homeSheet.querySelector('.hm-sheet-title').textContent, 'Voltar ao início');
        assert(homeSheet.querySelector('.hm-actions .hm-danger'), 'a ação destrutiva é destacada');
        assert.equal(homeSheet.querySelectorAll('.hm-actions button')[1].textContent, 'Cancelar');
        fire(homeSheet.querySelectorAll('.hm-actions button')[1], 'click');
        assert.equal(gameDoc.getElementById('mobile-panel'), null, 'Cancelar fecha sem reiniciar');
        assert(rooms.querySelector('.hm-rooms-tools [data-hook=hm-rooms-home]'), 'o Início continua visível');

        // Reexecutar a montagem não pode duplicar cabeçalho nem barra.
        diag.rooms();
        assert.equal(gameDoc.querySelectorAll('.hm-rooms-head').length, 1);
        assert.equal(gameDoc.querySelectorAll('.hm-rooms-enter').length, 1);

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
