// Mobile features share the existing client scope; no access to native identity data.
const CLIENT_VERSION = '0.4.1';
let mobilePanel = null;
let mobilePanelBody = null;
let currentRoom = null;
let selectedRoomName = '';
let appliedViewMode = null;
let floatingJoystick = false;
let pendingJoin = readStored('hm_pending_room', null);
const floatingZone = document.createElement('div');
floatingZone.id = 'floating-joystick-zone';
floatingZone.style.cssText = 'display:none;position:fixed;left:0;top:20%;bottom:0;width:50%;z-index:90;touch-action:none';
document.body.appendChild(floatingZone);
floatingZone.addEventListener('touchstart', handleTouchStart, { passive: false });
floatingZone.addEventListener('touchmove', handleTouchMove, { passive: false });
floatingZone.addEventListener('touchend', handleTouchEnd);
floatingZone.addEventListener('touchcancel', handleTouchEnd);
const mobileGameStyle = document.createElement('style');
gameFrame.document.head.appendChild(mobileGameStyle);

function readStored(key, fallback) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key));
        return parsed == null ? fallback : parsed;
    } catch { return fallback; }
}
function canonicalRoomUrl(value) {
    try {
        const url = new URL(String(value).trim());
        const code = url.searchParams.get('c');
        if (url.protocol !== 'https:' || !['haxball.com','www.haxball.com'].includes(url.hostname) ||
            url.pathname !== '/play' || !code || !/^[a-zA-Z0-9_-]{1,256}$/.test(code)) return null;
        return 'https://www.haxball.com/play?c=' + encodeURIComponent(code);
    } catch { return null; }
}
function mobileNode(tag, text, parent) {
    const node = gameFrame.document.createElement(tag);
    if (text != null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
}
function mobileButton(text, parent, action, options) {
    const button = mobileNode('button', text, parent);
    button.type = 'button';
    if (options && options.className) button.className = options.className;
    button.addEventListener('click', () => {
        try { action(); } catch (error) { mobileNotice(error.message || 'Não foi possível concluir.'); }
    });
    return button;
}
function mobileNotice(message) {
    const doc = gameFrame.document;
    const existing = doc.getElementById('mobile-notice');
    if (existing) existing.remove();
    const notice = mobileNode('div', message, doc.body);
    notice.id = 'mobile-notice';
    notice.className = 'hm-toast';
    notice.setAttribute('role', 'status');
    setTimeout(() => notice.remove(), 3200);
}

// ---------------------------------------------------------------------------
// Painéis (sheet) e componentes de interface
// ---------------------------------------------------------------------------
function closeMobilePanel() {
    if (mobilePanel) mobilePanel.remove();
    mobilePanel = null;
    mobilePanelBody = null;
    mobilePanelOpen = false;
    settingsMenuHandler.style.display = 'none';
    canResetJoystick = true;
    const toggle = body?.querySelector('#hm-quick-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    updateUI();
}
// Abre um painel e devolve o corpo rolável: os chamadores só anexam conteúdo.
function openMobilePanel(title, variant) {
    releaseControls();
    if (mobilePanel) mobilePanel.remove();
    if (mobileChatOpen) setMobileChatOpen(false);
    mobilePanelOpen = true;
    showControls(false);
    syncMobileStatus();
    settingsMenuHandler.style.display = 'none';
    const inGame = !!(body && body.querySelector('.game-view'));
    const sheet = mobileNode('div', null, gameFrame.document.body);
    sheet.id = 'mobile-panel';
    sheet.className = 'hm-sheet ' + (variant || (inGame ? 'hm-drawer' : 'hm-full'));
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', title);
    const head = mobileNode('div', null, sheet);
    head.className = 'hm-sheet-head';
    mobileNode('div', null, head).className = 'hm-sheet-grab';
    mobileNode('h2', title, head).className = 'hm-sheet-title';
    const close = mobileNode('button', null, head);
    close.type = 'button';
    close.className = 'hm-icon-btn';
    close.innerHTML = hmIcon('close');
    close.setAttribute('aria-label', 'Fechar');
    close.addEventListener('click', closeMobilePanel);
    const content = mobileNode('div', null, sheet);
    content.className = 'hm-sheet-body';
    mobilePanel = sheet;
    mobilePanelBody = content;
    const toggle = body?.querySelector('#hm-quick-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    return content;
}

function settingCard(parent, title) {
    const card = mobileNode('section', null, parent);
    card.className = 'hm-card';
    if (title) mobileNode('div', title, card).className = 'hm-card-title';
    return card;
}
function settingRow(parent, label, hint) {
    const row = mobileNode('label', null, parent);
    row.className = 'hm-row';
    const text = mobileNode('span', label, row);
    if (hint) mobileNode('small', hint, text).className = 'hm-row-hint';
    return row;
}
function settingNote(parent, text) {
    const note = mobileNode('p', text, parent);
    note.className = 'hm-note';
    return note;
}
function settingSelect(parent, label, key, options) {
    const row = settingRow(parent, label);
    const select = mobileNode('select', null, row);
    for (const [value, text] of options) {
        const option = mobileNode('option', text, select);
        option.value = value;
    }
    select.value = String(getSetting(key));
    select.setAttribute('aria-label', label);
    select.addEventListener('change', () => setSetting(key, typeof defaultSettings[key] === 'number' ? Number(select.value) : select.value));
    return select;
}
function settingSlider(parent, label, key, min, max, step, format) {
    const row = settingRow(parent, label);
    const group = mobileNode('span', null, row);
    group.className = 'hm-range';
    const asPercent = ['interfaceOpacity','chatOpacity','controlsOpacity','menuScale','textScale'].includes(key);
    const display = value => format ? format(value) : asPercent ? Math.round(value * 100) + '%' : String(Number(Number(value).toFixed(2)));
    const output = mobileNode('output', display(getSetting(key)), group);
    const input = mobileNode('input', null, group);
    input.type = 'range';
    input.min = min; input.max = max; input.step = step; input.value = getSetting(key);
    input.setAttribute('aria-label', label);
    const paint = () => {
        const pct = (Number(input.value) - Number(min)) / (Number(max) - Number(min)) * 100;
        input.style.setProperty('--hm-fill', pct.toFixed(1) + '%');
    };
    paint();
    input.addEventListener('input', () => {
        output.textContent = display(input.value);
        paint();
        setSetting(key, Number(input.value));
    });
    return input;
}
function settingToggle(parent, label, key, hint) {
    const row = settingRow(parent, label, hint);
    const input = mobileNode('input', null, row);
    input.type = 'checkbox';
    input.checked = getSetting(key) !== false && !!getSetting(key);
    input.setAttribute('aria-label', label);
    input.addEventListener('change', () => setSetting(key, input.checked));
    return input;
}
function settingSegment(parent, label, key, options) {
    const row = settingRow(parent, label);
    const group = mobileNode('span', null, row);
    group.className = 'hm-segment';
    group.setAttribute('role', 'group');
    const buttons = [];
    for (const [value, text] of options) {
        const button = mobileNode('button', text, group);
        button.type = 'button';
        button.setAttribute('aria-selected', String(String(getSetting(key)) === String(value)));
        button.addEventListener('click', () => {
            setSetting(key, typeof defaultSettings[key] === 'number' ? Number(value) : value);
            for (const other of buttons) other.setAttribute('aria-selected', String(other === button));
        });
        buttons.push(button);
    }
    return group;
}
function settingAction(parent, label, action, hint, text) {
    const row = settingRow(parent, label, hint);
    // Rótulo explícito: antes TODA ação (inclusive "Restaurar tudo") dizia
    // "Abrir", o que esconde o efeito real do botão.
    const button = mobileButton(text || 'Abrir', row, action);
    button.style.minWidth = '86px';
    return button;
}
// Confirmação para ações destrutivas (antes: um clique apagava as preferências).
function confirmMobileAction(title, message, confirmLabel, action) {
    const panel = openMobilePanel(title);
    const text = mobileNode('p', message, panel);
    text.className = 'hm-note';
    const actions = mobileNode('div', null, panel);
    actions.className = 'hm-actions';
    mobileButton('Cancelar', actions, closeMobilePanel, {className:'hm-btn-ghost'});
    mobileButton(confirmLabel, actions, () => { closeMobilePanel(); action(); }, {className:'hm-btn-danger'});
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------
function renderMobileSettings(category = 'Geral') {
    const panel = openMobilePanel('Configurações');
    const layout = mobileNode('div', null, panel);
    layout.className = 'hm-settings';
    const tabs = mobileNode('nav', null, layout);
    tabs.className = 'hm-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Categorias');
    const view = mobileNode('div', null, layout);
    view.className = 'hm-settings-body';

    const groups = {
        'Geral': () => {
            const look = settingCard(view, 'Aparência');
            settingSegment(look, 'Tema', 'skin', [['matrix','Matrix'],['moderno','Moderno'],['cartoon','Cartoon'],['hax','Clássico']]);
            settingSegment(look, 'Modo', 'theme', [['dark','Escuro'],['light','Claro'],['auto','Auto']]);
            settingSegment(look, 'Animações', 'animations', [['full','Completas'],['reduced','Reduzidas'],['off','Desligadas']]);
            settingToggle(look, 'Modo imersivo', 'immersive', 'Esconde placar e estatísticas durante a partida');
            settingSegment(look, 'Densidade', 'hudDensity', [['comfortable','Confortável'],['compact','Compacta']]);
            const flow = settingCard(view, 'Atalhos');
            settingAction(flow, 'Favoritos e recentes', openRoomsPanel, undefined, 'Ver');
            settingAction(flow, 'Perfis de configuração', openProfilesPanel, undefined, 'Ver');
            const about = settingCard(view, 'Sobre');
            const kv = mobileNode('div', null, about);
            kv.className = 'hm-kv';
            mobileNode('span', 'Cliente', kv);
            mobileNode('b', 'Matrix Mobile ' + CLIENT_VERSION, kv);
            settingAction(about, 'Créditos e informações', openMobileAbout, undefined, 'Ver');
        },
        'Interface': () => {
            const panelCard = settingCard(view, 'Painéis');
            settingSlider(panelCard, 'Opacidade da interface', 'interfaceOpacity', 0, 1, .05);
            settingSlider(panelCard, 'Escala dos menus', 'menuScale', .8, 1.3, .05);
            settingSlider(panelCard, 'Tamanho dos textos', 'textScale', .85, 1.4, .05);
            const chat = settingCard(view, 'Chat');
            settingSlider(chat, 'Tamanho do chat', 'chatSize', .7, 1.8, .1);
            settingSlider(chat, 'Opacidade do chat', 'chatOpacity', 0, 1, .05);
            settingToggle(chat, 'Fundo nas mensagens', 'chatBg');
            settingToggle(chat, 'Mensagens em cascata', 'chatCascade', 'Mostra as 5 últimas durante o jogo');
            settingToggle(chat, 'Ocultar automaticamente', 'autoHideChat');
            settingSlider(chat, 'Ocultar após (s)', 'chatHideDelay', 3, 30, 1);
            settingNote(view, 'A opacidade altera o fundo; textos e botões mantêm contraste para leitura.');
        },
        'Controles': () => {
            const touch = settingCard(view, 'Toque');
            settingSegment(touch, 'Joystick', 'joystickMode', [['fixed','Fixo'],['floating','Flutuante']]);
            settingSlider(touch, 'Sensibilidade', 'sensitivity', .5, 2, .1);
            settingSlider(touch, 'Zona morta', 'deadZone', .05, .35, .01);
            settingSlider(touch, 'Opacidade', 'controlsOpacity', .2, 1, .05);
            const extras = settingCard(view, 'Extras');
            settingToggle(extras, 'Vibração no chute', 'vibration');
            settingToggle(extras, 'Botões de macro (2x / FK)', 'macros');
            const layoutCard = settingCard(view, 'Layout do HUD');
            settingAction(layoutCard, 'Editar posição e tamanho', () => { closeMobilePanel(); enterHudEditMode(); }, undefined, 'Editar');
            settingAction(layoutCard, 'Restaurar layout padrão', () => {
                confirmMobileAction('Restaurar layout', 'Joystick, chute e macros voltam ao lugar e ao tamanho de fábrica.', 'Restaurar', () => {
                    releaseControls();
                    saveHudLayout(JSON.parse(JSON.stringify(defaultHudLayout)));
                    applyHudPositions();
                    mobileNotice('Layout padrão restaurado.');
                });
            }, undefined, 'Restaurar');
        },
        'Câmera': () => {
            const smart = settingCard(view, 'Câmera');
            settingSegment(smart, 'Modo', 'cameraMode', [['off','Desligada'],['fixed','Fixa'],['smart','Inteligente']]);
            settingSlider(smart, 'Intensidade', 'cameraStrength', .2, 1, .05);
            settingToggle(smart, 'Destacar meu jogador', 'playerMark', 'Anel luminoso sobre o seu personagem');
            const zoom = settingCard(view, 'Enquadramento');
            settingSegment(zoom, 'Visão do campo', 'fieldView', [[1,'1x'],[2,'1.25x'],[3,'1.5x'],[4,'1.75x']]);
            settingAction(zoom, 'Visão restrita (tecla 0)', () => {
                gameFrame.document.dispatchEvent(new KeyboardEvent('keydown', { key:'0', code:'Digit0', keyCode:48, which:48, bubbles:true }));
                mobileNotice('Visão restrita aplicada.');
            }, undefined, 'Aplicar');
            const diag = settingCard(view, 'Diagnóstico');
            settingAction(diag, 'Testar câmera agora', () => {
                if (typeof hmCamReport === 'function') mobileNotice(hmCamReport());
                else mobileNotice('Câmera não inicializada.');
            }, undefined, 'Testar');
            settingNote(view, 'Desligada: o campo fica exatamente como o HaxBall desenha. Fixa: um deslocamento curto e constante, sem ler o jogo. Inteligente (experimental): o campo desloca só quando você fica embaixo dos controles; a bola sempre tem prioridade e, se algo falhar, a câmera se desliga sozinha.');
        },
        'Jogo': () => {
            const info = settingCard(view, 'Informações na tela');
            settingToggle(info, 'Mostrar ping', 'showPing');
            settingToggle(info, 'Mostrar FPS', 'showFps');
            settingToggle(info, 'Modo imersivo', 'immersive');
            settingNote(view, 'Jogadores, times e administração ficam no botão de times, na barra superior.');
        },
        'Áudio': () => {
            const card = settingCard(view, 'Som da partida');
            settingAction(card, 'Volume da partida', () => { closeMobilePanel(); openNativeAudio(); }, undefined, 'Ajustar');
            settingAction(card, 'Preferências de efeitos', () => openNativePreferences('soundbtn'), undefined, 'Abrir');
            settingNote(view, 'Volume e efeitos usam os controles originais do HaxBall.');
        },
        'Desempenho': () => {
            const card = settingCard(view, 'Rendimento');
            settingToggle(card, 'Mostrar FPS', 'showFps');
            settingSegment(card, 'Animações', 'animations', [['full','Completas'],['reduced','Reduzidas'],['off','Desligadas']]);
            settingToggle(card, 'Destacar meu jogador', 'playerMark');
            settingAction(card, 'Vídeo e resolução', () => openNativePreferences('videobtn'), undefined, 'Abrir');
            settingNote(view, 'Em aparelhos simples, reduza animações, desligue os efeitos da câmera e use resolução menor nas preferências de vídeo.');
        },
        'Avançado': () => {
            const card = settingCard(view, 'Configuração');
            settingAction(card, 'Perfis / exportar / importar', openProfilesPanel, undefined, 'Abrir');
            settingAction(card, 'Preferências nativas', () => openNativePreferences('miscbtn'), undefined, 'Abrir');
            settingAction(card, 'Restaurar tudo para o padrão', () => {
                confirmMobileAction('Restaurar tudo', 'Tema, controles, câmera e layout do HUD voltam ao padrão de fábrica. Perfis, favoritos e histórico de salas são mantidos.', 'Restaurar tudo', () => {
                    const settings = JSON.parse(JSON.stringify(defaultSettings));
                    localStorage.setItem('hm_settings', JSON.stringify(settings));
                    localStorage.setItem('hud_layout', JSON.stringify(defaultHudLayout));
                    localStorage.setItem('controls', JSON.stringify([20, 5, 1]));
                    updateControlsOptions(20, 5, 1, true, false);
                    applySettings();
                    applyHudPositions();
                    mobileNotice('Configurações restauradas.');
                });
            }, undefined, 'Restaurar');
            settingNote(view, 'Perfis incluem aparência, controles e câmera. Nenhum dado de identidade é exportado.');
        }
    };

    const buttons = [];
    function select(name) {
        view.replaceChildren();
        for (const button of buttons) {
            const on = button.textContent === name;
            button.setAttribute('aria-selected', String(on));
            button.setAttribute('tabindex', on ? '0' : '-1');
        }
        const target = groups[name] ? name : 'Geral';
        if (target !== name) {
            // categoria inexistente: mantém a primeira aba marcada
            for (const button of buttons) button.setAttribute('aria-selected', String(button.textContent === 'Geral'));
        }
        groups[target]();
        const active = buttons.find(button => button.getAttribute('aria-selected') === 'true');
        if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    for (const name of Object.keys(groups)) {
        const button = mobileButton(name, tabs, () => select(name));
        button.setAttribute('role', 'tab');
        button.style.minWidth = 'auto';
        buttons.push(button);
    }
    select(category);
    return panel;
}

function applyMobileSettings() {
    applyVisualSettings();
    const opacity = Number(getSetting('controlsOpacity'));
    const controls = readStored('controls', [20, 5, 1]);
    const controlsCss = constrolsStyleBase.replace(/CONTROLS_WIDTH/g, String(controls[0]))
        .replace(/CONTROLS_MARGIN/g, String(controls[1])).replace(/CONTROLS_OPACITY/g, String(opacity))
        .replace(/KICK_OPACITY/g, String(opacity / 2));
    if (controlsHandler.innerHTML !== controlsCss) controlsHandler.innerHTML = controlsCss;
    const anchor = getHudLayout().joystick;
    const rightSide = anchor.right !== null || anchor.left !== null && anchor.left > 50;
    floatingZone.style.left = rightSide ? '' : '0';
    floatingZone.style.right = rightSide ? '0' : '';
    floatingZone.style.display = controlsVisible && !hudEditing && getSetting('joystickMode') === 'floating' ? 'block' : 'none';
    const gameCss =
        '.chatbox-view-contents>.input{position:fixed;left:8px;right:8px;bottom:8px;z-index:660;padding:6px;gap:6px;box-sizing:border-box}' +
        '.chatbox-view-contents>.input input{flex:1;min-width:0;font-size:16px}' +
        '.roomlist-view .buttons{flex-wrap:wrap;gap:4px}.roomlist-view>.dialog{max-width:100%;max-height:100%;width:100%;height:100%}';
    if (mobileGameStyle.textContent !== gameCss) mobileGameStyle.textContent = gameCss;
    if (isPlayingView() && appliedViewMode !== getSetting('fieldView')) {
        appliedViewMode = getSetting('fieldView');
        localStorage.setItem('view_mode', String(appliedViewMode));
        gameFrame.document.dispatchEvent(new KeyboardEvent('keydown', { key: String(appliedViewMode), code: 'Digit' + appliedViewMode, keyCode: 48 + Number(appliedViewMode), which: 48 + Number(appliedViewMode), bubbles: true }));
    }
    // A câmera vive na camada visual; tolerar ausência (testes carregam só este arquivo).
    if (typeof applyCameraSettings === 'function') applyCameraSettings();
}
function positionFloatingJoystick(touch) {
    const rect = joystick.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth - rect.width, touch.clientX - rect.width / 2));
    const y = Math.max(0, Math.min(window.innerHeight - rect.height, touch.clientY - rect.height / 2));
    joystick.style.position = 'fixed';
    joystick.style.left = x + 'px'; joystick.style.top = y + 'px';
    joystick.style.right = ''; joystick.style.bottom = '';
    floatingJoystick = true;
}
function restoreFloatingJoystick() {
    if (!floatingJoystick) return;
    floatingJoystick = false;
    applyHudPositions();
}
function constrainHudToViewport() {
    for (const id of ['joystick','kick','dblkick','fakekick']) {
        const el = document.getElementById(id);
        if (!el || !el.getBoundingClientRect().width) continue;
        const r = el.getBoundingClientRect();
        if (r.left < 4 || r.right > window.innerWidth - 4) {
            el.style.left = Math.max(4, Math.min(window.innerWidth - r.width - 4, r.left)) + 'px';
            el.style.right = '';
        }
        if (r.top < 4 || r.bottom > window.innerHeight - 4) {
            el.style.top = Math.max(4, Math.min(window.innerHeight - r.height - 4, r.top)) + 'px';
            el.style.bottom = '';
        }
    }
}
function makeHudPreset(hand) {
    const layout = JSON.parse(JSON.stringify(defaultHudLayout));
    if (hand === 'left') {
        for (const pos of Object.values(layout)) {
            const left = pos.left; pos.left = pos.right; pos.right = left;
        }
    }
    return layout;
}
function validateProfile(value) {
    if (!value || value.format !== 'haxball-mobile-profile' || value.version !== 1) throw new Error('Perfil inválido ou incompatível.');
    const config = {format:value.format,version:1,settings:{},controls:[],hud:{}};
    const enums = {
        theme: ['dark','light','auto'],
        skin: ['matrix','moderno','cartoon','hax'],
        joystickMode: ['fixed','floating'],
        animations: ['full','reduced','off'],
        cameraMode: ['off','fixed','smart'],
        hudDensity: ['comfortable','compact']
    };
    const ranges = {
        chatSize:[0.7,1.8],sensitivity:[0.5,2],deadZone:[0.05,0.35],controlsOpacity:[0.2,1],
        fieldView:[1,4],interfaceOpacity:[0,1],menuScale:[.8,1.3],textScale:[.85,1.4],
        chatOpacity:[0,1],chatHideDelay:[3,30],cameraStrength:[.2,1]
    };
    for (const key of Object.keys(defaultSettings)) {
        const v = value.settings && value.settings[key] !== undefined ? value.settings[key] : defaultSettings[key];
        if (typeof v !== typeof defaultSettings[key] || enums[key] && !enums[key].includes(v) ||
            ranges[key] && (!Number.isFinite(v) || v < ranges[key][0] || v > ranges[key][1]) ||
            key === 'fieldView' && !Number.isInteger(v)) throw new Error('Configuração inválida: ' + key);
        config.settings[key] = v;
    }
    if (!Array.isArray(value.controls) || value.controls.length !== 3) throw new Error('Controles inválidos.');
    const limits = [[10,30],[0,15],[0.2,1]];
    config.controls = value.controls.map((v,i) => {
        v = Number(v);
        if (!Number.isFinite(v) || v < limits[i][0] || v > limits[i][1]) throw new Error('Controles fora dos limites.');
        return v;
    });
    for (const id of Object.keys(defaultHudLayout)) {
        const pos = value.hud && value.hud[id];
        if (!pos || !Number.isFinite(pos.size) || pos.size < 8 || pos.size > 35) throw new Error('Tamanho do HUD inválido.');
        const clean = {size:pos.size};
        for (const axis of ['left','right','top','bottom']) {
            const v = pos[axis];
            if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100)) throw new Error('Posição do HUD inválida.');
            clean[axis] = v;
        }
        if (clean.left === null && clean.right === null || clean.top === null && clean.bottom === null) throw new Error('HUD sem posição.');
        config.hud[id] = clean;
    }
    config.controls[2] = config.settings.controlsOpacity;
    return config;
}
function exportMobileProfile() {
    return validateProfile({format:'haxball-mobile-profile',version:1,settings:readStored('hm_settings',defaultSettings),controls:readStored('controls',[20,5,1]),hud:getHudLayout()});
}
function applyMobileProfile(value) {
    const profile = validateProfile(value);
    releaseControls();
    localStorage.setItem('hm_settings', JSON.stringify(profile.settings));
    localStorage.setItem('hud_layout', JSON.stringify(profile.hud));
    updateControlsOptions(...profile.controls,true,false);
    applyHudPositions();
    appliedViewMode = null;
    lastVisualSettings = '';
    applySettings();
}
function openProfilesPanel() {
    const panel = openMobilePanel('Perfis');
    const save = settingCard(panel, 'Salvar configuração atual');
    const name = mobileNode('input', null, save);
    name.placeholder = 'Nome do perfil';
    name.maxLength = 48;
    name.setAttribute('aria-label', 'Nome do perfil');
    name.style.cssText = 'width:100%';
    mobileButton('Salvar perfil atual', save, () => {
        const label = name.value.trim();
        if (!label) throw new Error('Informe o nome do perfil.');
        const profiles = readStored('hm_profiles', []).filter(p => p.name !== label).slice(-19);
        profiles.push({name:label,data:exportMobileProfile()});
        localStorage.setItem('hm_profiles', JSON.stringify(profiles));
        mobileNotice('Perfil "' + label + '" salvo.');
        openProfilesPanel();
    }, {className:'hm-btn-primary'});
    const saved = readStored('hm_profiles', []);
    const list = settingCard(panel, 'Perfis salvos');
    if (!saved.length) {
        const empty = mobileNode('p', 'Nenhum perfil ainda.', list);
        empty.className = 'hm-empty';
    }
    for (const profile of saved) {
        const row = settingRow(list, profile.name);
        const actions = mobileNode('span', null, row);
        actions.className = 'hm-row-actions';
        mobileButton('Aplicar', actions, () => { applyMobileProfile(profile.data); mobileNotice('Perfil aplicado.'); });
        mobileButton('Excluir', actions, () => {
            localStorage.setItem('hm_profiles', JSON.stringify(readStored('hm_profiles', []).filter(p => p.name !== profile.name)));
            openProfilesPanel();
        }, {className:'hm-btn-ghost'});
    }
    const io = settingCard(panel, 'Arquivo ou texto');
    settingNote(io, 'Exporte para JSON ou copie o texto. Para importar, cole um perfil abaixo.');
    const text = mobileNode('textarea', null, io);
    text.rows = 5;
    text.maxLength = 32000;
    text.placeholder = 'JSON do perfil';
    text.style.cssText = 'width:100%;user-select:text';
    const actions = mobileNode('div', null, io);
    actions.className = 'hm-actions';
    mobileButton('Exportar texto', actions, () => { text.value = JSON.stringify(exportMobileProfile(), null, 2); text.focus(); text.select(); });
    mobileButton('Salvar arquivo', actions, () => { window.location.href = 'haxmobile://export-profile'; });
    mobileButton('Importar texto', actions, () => {
        if (text.value.length > 32000) throw new Error('Perfil muito grande.');
        applyMobileProfile(JSON.parse(text.value));
        mobileNotice('Perfil importado.');
    });
    mobileButton('Abrir arquivo', actions, () => { window.location.href = 'haxmobile://import-profile'; });
}
function roomKey(room) { return room.url || 'name:' + room.name; }
function rememberRoom(room) {
    if (!room || !room.name) return;
    const recent = readStored('hm_recent_rooms', []).filter(r => roomKey(r) !== roomKey(room));
    recent.unshift({name:room.name.slice(0,120),url:canonicalRoomUrl(room.url),visited:Date.now()});
    localStorage.setItem('hm_recent_rooms', JSON.stringify(recent.slice(0,20)));
}
function toggleRoomFavorite(room) {
    const favorites = readStored('hm_favorite_rooms', []);
    const exists = favorites.some(r => roomKey(r) === roomKey(room));
    const next = favorites.filter(r => roomKey(r) !== roomKey(room));
    if (!exists) next.unshift({name:room.name.slice(0,120),url:canonicalRoomUrl(room.url)});
    localStorage.setItem('hm_favorite_rooms', JSON.stringify(next.slice(0,100)));
    return !exists;
}
function goToRoom(room) {
    const url = canonicalRoomUrl(room.url);
    if (!url && !room.name) throw new Error('Sala sem link ou nome.');
    localStorage.setItem('hm_pending_room', JSON.stringify({name:room.name,url}));
    window.location.replace(url || 'https://www.haxball.com/play');
}
function openRoomsPanel() {
    const panel = openMobilePanel('Salas');
    if (currentRoom) {
        const current = settingCard(panel, 'Sala atual');
        const row = settingRow(current, currentRoom.name || 'Sala atual');
        mobileButton('Favoritar', row, () => {
            mobileNotice(toggleRoomFavorite(currentRoom) ? 'Sala favoritada.' : 'Favorito removido.');
            openRoomsPanel();
        });
    }
    const join = settingCard(panel, 'Entrar por link');
    const urlInput = mobileNode('input', null, join);
    urlInput.type = 'url';
    urlInput.placeholder = 'https://www.haxball.com/play?c=...';
    urlInput.style.cssText = 'width:100%';
    urlInput.setAttribute('aria-label', 'Link da sala');
    mobileButton('Entrar pelo link', join, () => {
        const url = canonicalRoomUrl(urlInput.value);
        if (!url) throw new Error('Cole um link válido do HaxBall.');
        goToRoom({name:'Sala compartilhada',url});
    }, {className:'hm-btn-primary'});
    for (const [title,key,hint] of [['Favoritos','hm_favorite_rooms','Suas salas marcadas'],['Recentes','hm_recent_rooms','Últimas salas visitadas']]) {
        const card = settingCard(panel, title);
        const rooms = readStored(key,[]);
        if (!rooms.length) {
            const empty = mobileNode('p', 'Nenhuma sala ainda.', card);
            empty.className = 'hm-empty';
        }
        for (const room of rooms) {
            const row = settingRow(card, room.name);
            const actions = mobileNode('span', null, row);
            actions.className = 'hm-row-actions';
            mobileButton('Entrar', actions, () => goToRoom(room));
            mobileButton('Remover', actions, () => {
                localStorage.setItem(key, JSON.stringify(readStored(key, []).filter(r => roomKey(r) !== roomKey(room))));
                openRoomsPanel();
            }, {className:'hm-btn-ghost'});
        }
    }
    settingNote(panel, 'Sem link salvo, a sala é localizada pelo nome na lista pública. Salas fechadas ou com nomes repetidos precisam de seleção manual.');
}
function installChatSend() {
    const chat = body.querySelector('.chatbox-view');
    if (!chat) return;
    const input = chat.querySelector('input');
    const container = chat.querySelector('.input');
    if (!input || !container || container.querySelector('[data-hook=mobile-send]')) return;
    input.setAttribute('enterkeyhint','send');
    input.addEventListener('focus', () => { gameFrame.document.documentElement.classList.add('hm-chat-active'); chatFocused = true; showControls(false); canResetJoystick = true; });
    input.addEventListener('blur', () => {
        gameFrame.document.documentElement.classList.remove('hm-chat-active');
        chatFocused = false; if(!mobileChatOpen)container.style.display = 'none'; canResetJoystick = true;
        setTimeout(() => updateUI(),0);
    });
    const send = mobileNode('button','Enviar',container);
    send.setAttribute('data-hook','mobile-send'); send.type = 'button';
    const submit = () => {
        if (!input.value.trim()) return;
        input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
        input.focus();
    };
    send.addEventListener('touchstart',e=>{e.preventDefault();submit()},{passive:false});
    send.addEventListener('click',submit);
}
function enhanceMobileUI() {
    const roomlist = body.querySelector('.roomlist-view');
    if (roomlist) {
        currentRoom = null;
        const list = roomlist.querySelector('[data-hook=list]');
        const join = roomlist.querySelector('[data-hook=join]');
        if (list && !list.dataset.mobileRooms) {
            list.dataset.mobileRooms = '1';
            list.addEventListener('click', event => {
                const name = event.target.closest('tr')?.querySelector('[data-hook=name]')?.textContent;
                if (name) selectedRoomName = name.trim();
            },true);
            list.addEventListener('dblclick', event => {
                const name = event.target.closest('tr')?.querySelector('[data-hook=name]')?.textContent;
                if (name) pendingJoin = {name:name.trim(),url:null};
            },true);
            if (join) join.addEventListener('click',()=>{if(selectedRoomName)pendingJoin={name:selectedRoomName,url:null}},true);
        }
        addMobileNavigation(roomlist.querySelector('.buttons'));
        if (pendingJoin && !pendingJoin.url && list && list.children.length) {
            const rows = Array.from(list.querySelectorAll('tr')).filter(row=>row.querySelector('[data-hook=name]')?.textContent.trim()===pendingJoin.name);
            if (rows.length) {
                const pending = pendingJoin; pendingJoin = null;
                localStorage.removeItem('hm_pending_room');
                if (rows.length > 1) mobileNotice('Há salas com esse nome. Selecione a desejada na lista.');
                else {
                    selectedRoomName = pending.name;
                    rows[0].dispatchEvent(new gameFrame.MouseEvent('click',{bubbles:true}));
                    if (join) join.click();
                }
            }
        }
    }
    const game = body.querySelector('.game-view');
    if (game) {
        const roomName = body.querySelector('[data-hook=room-name]')?.textContent.trim();
        const linked = canonicalRoomUrl(window.location.href);
        if (!currentRoom || roomName && currentRoom.name !== roomName) {
            currentRoom = {name:roomName || pendingJoin?.name || 'Sala compartilhada',url:currentRoom?.url || pendingJoin?.url || (!selectedRoomName ? linked : null)};
            rememberRoom(currentRoom);
            pendingJoin = null;
            localStorage.removeItem('hm_pending_room');
        }
        const link = body.querySelector('.room-link-view [data-hook=link]')?.value;
        if (canonicalRoomUrl(link) && currentRoom.url !== canonicalRoomUrl(link)) {
            currentRoom.url = canonicalRoomUrl(link); rememberRoom(currentRoom);
            const favorites = readStored('hm_favorite_rooms',[]);
            for (const room of favorites) if (room.name === currentRoom.name) room.url = currentRoom.url;
            localStorage.setItem('hm_favorite_rooms',JSON.stringify(favorites));
        }
        addMobileNavigation(body.querySelector('.sound-button-container')?.parentNode);
        installChatSend();
    }
    translateMobileUI();
    applyMobileSettings();
    enhanceVisualUI();
}
function addMobileNavigation(parent) {
    if (!parent || parent.querySelector('[data-hook=mobile-settings]')) return;
    const settings = mobileButton('Ajustes', parent, () => renderMobileSettings('Geral'));
    settings.setAttribute('data-hook','mobile-settings');
    const rooms = mobileButton('Salas', parent, openRoomsPanel);
    rooms.setAttribute('data-hook','mobile-rooms');
}
function translateMobileUI() {
    const labels = {join:'Entrar',create:'Criar sala',refresh:'Atualizar',settings:'Configurações',changenick:'Nome',copy:'Copiar',close:'Fechar',cancel:'Cancelar',leave:'Sair',soundbtn:'Áudio',videobtn:'Vídeo',inputbtn:'Controles',miscbtn:'Avançado','leave-btn':'Sair','link-btn':'Link','start-btn':'Iniciar','stop-btn':'Parar','pause-btn':'Pausar',settingsbtn:'Cliente','url-room':'Link da sala',aboutbtn:'Sobre'};
    for (const [hook,label] of Object.entries(labels)) {
        for (const el of body.querySelectorAll('button[data-hook="'+hook+'"]')) {
            const text = el.querySelector('div');
            if (text) { if (text.textContent !== label) text.textContent = label; }
            else {
                const part = Array.from(el.childNodes).find(n=>n.nodeType===3&&n.textContent.trim());
                if (part && part.textContent.trim() !== label) part.textContent = ' '+label;
            }
        }
    }
    const heading = body.querySelector('.roomlist-view h1');
    if (heading && heading.textContent !== 'Salas HaxBall') heading.textContent = 'Salas HaxBall';
}
function openMobileAbout() {
    const panel = openMobilePanel('Sobre');
    const hero = mobileNode('div', null, panel);
    hero.className = 'hm-card';
    hero.style.cssText = 'text-align:center;padding:18px 14px';
    mobileNode('h2', 'Matrix Mobile', hero).style.cssText = 'letter-spacing:-.02em';
    const version = mobileNode('p', 'Versão ' + CLIENT_VERSION, hero);
    version.className = 'hm-note';
    const credits = settingCard(panel, 'Créditos');
    settingNote(credits, 'Cliente Android por Kylun. Jogo original: Mario Carbajal (@basro). Adaptação mobile original: Vixel Dev.');
    settingNote(credits, 'Este cliente usa a página oficial do HaxBall e precisa de internet para entrar nas salas. Não é um produto oficial.');
    const features = settingCard(panel, 'O que este cliente adiciona');
    settingNote(features, 'Controles touch com macros, câmera inteligente, HUD configurável, temas, perfis, favoritos de salas e histórico de chat.');
}
function handleMobileBack() {
    if (hudEditing && window.haxballMobileCancelHud) { window.haxballMobileCancelHud(); return true; }
    if (mobilePanelOpen) { closeMobilePanel(); return true; }
    if (mobileChatOpen) { setMobileChatOpen(false); return true; }
    const leaveConfirmation = body.querySelector('.leave-room-view');
    if (leaveConfirmation) { leaveConfirmation.querySelector('[data-hook=cancel]')?.click(); return true; }
    const chat = body.querySelector('.chatbox-view .input');
    if (chat && chat.style.display !== 'none') {
        chat.querySelector('input')?.blur(); chat.style.display = 'none'; return true;
    }
    if (!inputOptionsHandler.hasAttribute('hidden')) { inputOptionsHandler.setAttribute('hidden',''); updateUI(); return true; }
    const popup = body.querySelector('.room-link-view, .settings-view');
    if (popup) { popup.querySelector('[data-hook=close]')?.click(); return true; }
    if (body.querySelector('.room-view') && body.querySelector('.game-view')) {
        gameFrame.document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));
        return true;
    }
    return false;
}
window.haxballMobileBack = handleMobileBack;
window.haxballMobileExport = () => JSON.stringify(exportMobileProfile(),null,2);
window.haxballMobileImport = text => { applyMobileProfile(JSON.parse(text)); mobileNotice('Perfil importado.'); return true; };
// Diagnóstico no console remoto (chrome://inspect) e usado pelos testes de fumaça.
window.haxballMobileDiag = {
    version: CLIENT_VERSION,
    settings: tab => renderMobileSettings(tab || 'Geral'),
    close: () => closeMobilePanel(),
    panel: () => mobilePanel,
    hasBody: () => !!body,
    camera: () => ({
        mode: hmCam.mode, strength: hmCam.strength, mark: hmCam.mark,
        dx: hmCam.dx, dy: hmCam.dy, active: hmCam.active,
        hooked: hmCam.hooked, cssOnly: hmCam.cssOnly, fallback: !!hmCam.fallback,
        frames: hmCam.frames, arcs: hmCam.arcs,
        ballFrames: hmCam.ballFrames, playerFrames: hmCam.playerFrames,
        transforms: hmCam.seen, report: hmCamReport()
    })
};
window.addEventListener('resize', () => { releaseControls(); applyHudPositions(); });
gameFrame.addEventListener('offline',()=>mobileNotice('Sem conexão. Verifique Wi-Fi ou dados móveis.'));
gameFrame.addEventListener('online',()=>mobileNotice('Conexão de internet restabelecida.'));

if (pendingJoin && !pendingJoin.url) {
    setTimeout(() => {
        if (pendingJoin && !currentRoom) mobileNotice('Sala não encontrada. Ela pode estar fechada ou ter mudado de nome.');
    }, 15000);
}
