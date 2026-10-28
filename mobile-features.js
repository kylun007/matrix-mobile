// Mobile features share the existing client scope; no access to native identity data.
const CLIENT_VERSION = '0.3.2';
let mobilePanel = null;
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
function mobileButton(text, parent, action) {
    const button = mobileNode('button', text, parent);
    button.type = 'button';
    button.addEventListener('click', () => {
        try { action(); } catch (error) { mobileNotice(error.message || 'N\u00e3o foi poss\u00edvel concluir.'); }
    });
    return button;
}
function mobileNotice(message) {
    const existing = gameFrame.document.getElementById('mobile-notice');
    if (existing) existing.remove();
    const notice = mobileNode('div', message, gameFrame.document.body);
    notice.id = 'mobile-notice';
    notice.style.cssText = 'position:fixed;top:8px;left:10%;right:10%;padding:10px;background:#244967;color:#fff;z-index:20000;text-align:center;pointer-events:none';
    setTimeout(() => notice.remove(), 3500);
}
function closeMobilePanel() {
    if (mobilePanel) mobilePanel.remove();
    mobilePanel = null;
    mobilePanelOpen = false;
    settingsMenuHandler.style.display = 'none';
    canResetJoystick = true;
    updateUI();
}
function openMobilePanel(title) {
    releaseControls();
    if(mobilePanel)mobilePanel.remove();
    if(mobileChatOpen)setMobileChatOpen(false);
    mobilePanelOpen=true;showControls(false);syncMobileStatus();settingsMenuHandler.style.display='none';
    mobilePanel=mobileNode('div',null,gameFrame.document.body);mobilePanel.id='mobile-panel';
    if(body?.querySelector('.game-view'))mobilePanel.className='hm-game-panel';
    mobilePanel.setAttribute('role','dialog');mobilePanel.setAttribute('aria-label',title);
    const header=mobileNode('div',null,mobilePanel);header.className='hm-header';
    mobileNode('h2',title,header);mobileButton('Fechar',header,closeMobilePanel);
    return mobilePanel;
}

function settingRow(parent, label) {
    const row = mobileNode('label', null, parent);
    row.className = 'hm-setting';
    mobileNode('span', label, row);
    return row;
}
function settingSelect(parent, label, key, options) {
    const row = settingRow(parent, label);
    const select = mobileNode('select', null, row);
    for (const [value, text] of options) {
        const option = mobileNode('option', text, select);
        option.value = value;
    }
    select.value = String(getSetting(key));
    select.addEventListener('change', () => setSetting(key, typeof defaultSettings[key] === 'number' ? Number(select.value) : select.value));
}
function settingSlider(parent,label,key,min,max,step) {
    const row=settingRow(parent,label),group=mobileNode('span',null,row);group.className='hm-range';
    const format=v=>['interfaceOpacity','chatOpacity','controlsOpacity','menuScale','textScale'].includes(key)?Math.round(v*100)+'%':String(Number(Number(v).toFixed(2)));
    const output=mobileNode('output',format(getSetting(key)),group),input=mobileNode('input',null,group);
    input.type='range';input.min=min;input.max=max;input.step=step;input.value=getSetting(key);input.setAttribute('aria-label',label);
    input.addEventListener('input',()=>{output.textContent=format(input.value);setSetting(key,Number(input.value));});
}

function settingToggle(parent, label, key) {
    const row = settingRow(parent, label);
    const input = mobileNode('input', null, row);
    input.type = 'checkbox'; input.checked = getSetting(key);
    input.addEventListener('change', () => setSetting(key, input.checked));
}
function renderMobileSettings(category='Geral') {
    const panel=openMobilePanel('Configura\u00e7\u00f5es');
    const layout=mobileNode('div',null,panel);layout.className='hm-settings';
    const tabs=mobileNode('nav',null,layout);tabs.className='hm-tabs';tabs.setAttribute('aria-label','Categorias');
    const content=mobileNode('div',null,layout);content.className='hm-content';
    const groups={
      'Geral':()=>{
        settingSelect(content,'Tema','theme',[['dark','Escuro'],['light','Claro'],['auto','Autom\u00e1tico']]);
        settingToggle(content,'Modo imersivo','immersive');
        mobileButton('Favoritos e recentes',content,openRoomsPanel);mobileButton('Sobre o cliente',content,openMobileAbout);
      },
      'Interface':()=>{
        settingSlider(content,'Opacidade da interface','interfaceOpacity',0,1,.05);
        settingSlider(content,'Escala dos menus','menuScale',.8,1.3,.05);
        settingSlider(content,'Tamanho dos textos','textScale',.85,1.4,.05);
        animations();settingSlider(content,'Tamanho do chat','chatSize',.7,1.8,.1);
        settingSlider(content,'Opacidade do chat','chatOpacity',0,1,.05);
        settingToggle(content,'Mensagens em cascata durante o jogo','chatCascade');
        settingToggle(content,'Fundo nas mensagens','chatBg');
        settingToggle(content,'Ocultar chat automaticamente','autoHideChat');
        settingSlider(content,'Ocultar ap\u00f3s (segundos)','chatHideDelay',3,30,1);
        note('A opacidade altera o fundo. Textos e bot\u00f5es mant\u00eam contraste para leitura.');
      },
      'Controles':()=>{
        settingSelect(content,'Joystick','joystickMode',[['fixed','Fixo'],['floating','Flutuante']]);
        settingSlider(content,'Sensibilidade','sensitivity',.5,2,.1);settingSlider(content,'Zona morta','deadZone',.05,.35,.01);
        settingSlider(content,'Opacidade dos controles','controlsOpacity',.2,1,.05);
        settingToggle(content,'Vibra\u00e7\u00e3o no chute','vibration');settingToggle(content,'Bot\u00f5es de macro','macros');
        mobileButton('Editar posi\u00e7\u00e3o e tamanho',content,()=>{closeMobilePanel();enterHudEditMode();});
        mobileButton('Restaurar layout padr\u00e3o',content,()=>{releaseControls();saveHudLayout(JSON.parse(JSON.stringify(defaultHudLayout)));applyHudPositions();mobileNotice('Layout padr\u00e3o restaurado.');});
      },
      'Jogo':()=>{
        settingSelect(content,'Vis\u00e3o do campo','fieldView',[[1,'Ampla (1x)'],[2,'Zoom 1,25x'],[3,'Zoom 1,5x'],[4,'Zoom 1,75x']]);
        settingToggle(content,'Modo imersivo','immersive');settingToggle(content,'Mostrar ping (Wi-Fi)','showPing');
        note('Jogadores, times e administra\u00e7\u00e3o ficam no menu da partida.');
      },
      '\u00c1udio':()=>{
        note('Volume e efeitos usam os controles originais do HaxBall.');
        mobileButton('Volume da partida',content,()=>{closeMobilePanel();openNativeAudio();});
        mobileButton('Prefer\u00eancias de efeitos',content,()=>openNativePreferences('soundbtn'));
      },
      'Desempenho':()=>{
        settingToggle(content,'Mostrar FPS do jogo','showFps');animations();
        note('Em aparelhos mais simples, reduza as anima\u00e7\u00f5es e a resolu\u00e7\u00e3o nas prefer\u00eancias de v\u00eddeo.');
        mobileButton('V\u00eddeo e resolu\u00e7\u00e3o',content,()=>openNativePreferences('videobtn'));
      },
      'Avan\u00e7ado':()=>{
        mobileButton('Perfis / exportar / importar',content,openProfilesPanel);
        mobileButton('Prefer\u00eancias nativas',content,()=>openNativePreferences('miscbtn'));
        note('Perfis incluem o visual e os controles. Nenhum dado de identidade \u00e9 exportado.');
      }
    };
    const buttons=[];
    function note(text){mobileNode('p',text,content).className='hm-note';}
    function animations(){settingSelect(content,'Anima\u00e7\u00f5es','animations',[['full','Completo'],['reduced','Reduzido'],['off','Desativado']]);}
    function select(name){
        content.replaceChildren();buttons.forEach(b=>b.setAttribute('aria-selected',String(b.textContent===name)));
        mobileNode('h3',name,content);groups[name]();
    }
    for(const name of Object.keys(groups))buttons.push(mobileButton(name,tabs,()=>select(name)));
    select(groups[category]?category:'Geral');
}

function applyMobileSettings() {
    applyVisualSettings();
    const opacity = Number(getSetting('controlsOpacity'));
    const controls = readStored('controls', [20,5,1]);
    const controlsCss = constrolsStyleBase.replace(/CONTROLS_WIDTH/g,String(controls[0]))
        .replace(/CONTROLS_MARGIN/g,String(controls[1])).replace(/CONTROLS_OPACITY/g,String(opacity))
        .replace(/KICK_OPACITY/g,String(opacity / 2));
    if (controlsHandler.innerHTML !== controlsCss) controlsHandler.innerHTML = controlsCss;
    const anchor = getHudLayout().joystick;
    const rightSide = anchor.right !== null || anchor.left !== null && anchor.left > 50;
    floatingZone.style.left = rightSide ? '' : '0';
    floatingZone.style.right = rightSide ? '0' : '';
    floatingZone.style.display = controlsVisible && !hudEditing && getSetting('joystickMode') === 'floating' ? 'block' : 'none';
    const gameCss =
        '.chatbox-view-contents>.input{position:fixed;left:8px;right:8px;bottom:8px;z-index:200;background:#1a2125;padding:6px;gap:6px;box-sizing:border-box}' +
        '.chatbox-view-contents>.input input{flex:1;min-width:0;font-size:16px}' +
        '.roomlist-view .buttons{flex-wrap:wrap;gap:4px}.roomlist-view>.dialog{max-width:100%;max-height:100%;width:100%;height:100%}';
    if (mobileGameStyle.textContent !== gameCss) mobileGameStyle.textContent = gameCss;
    if (isPlayingView() && appliedViewMode !== getSetting('fieldView')) {
        appliedViewMode = getSetting('fieldView');
        localStorage.setItem('view_mode', String(appliedViewMode));
        gameFrame.document.dispatchEvent(new KeyboardEvent('keydown', {key:String(appliedViewMode),code:'Digit'+appliedViewMode,keyCode:48+Number(appliedViewMode),which:48+Number(appliedViewMode),bubbles:true}));
    }
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
    if (!value || value.format !== 'haxball-mobile-profile' || value.version !== 1) throw new Error('Perfil inv\u00e1lido ou incompat\u00edvel.');
    const config = {format:value.format,version:1,settings:{},controls:[],hud:{}};
    const enums = {theme:Object.keys(themes),joystickMode:['fixed','floating'],animations:['full','reduced','off']};
    const ranges = {chatSize:[0.7,1.8],sensitivity:[0.5,2],deadZone:[0.05,0.35],controlsOpacity:[0.2,1],fieldView:[1,4],interfaceOpacity:[0,1],menuScale:[.8,1.3],textScale:[.85,1.4],chatOpacity:[0,1],chatHideDelay:[3,30]};
    for (const key of Object.keys(defaultSettings)) {
        const v = value.settings && value.settings[key] !== undefined ? value.settings[key] : defaultSettings[key];
        if (typeof v !== typeof defaultSettings[key] || enums[key] && !enums[key].includes(v) ||
            ranges[key] && (!Number.isFinite(v) || v < ranges[key][0] || v > ranges[key][1]) ||
            key === 'fieldView' && !Number.isInteger(v)) throw new Error('Configura\u00e7\u00e3o inv\u00e1lida: ' + key);
        config.settings[key] = v;
    }
    if (!Array.isArray(value.controls) || value.controls.length !== 3) throw new Error('Controles inv\u00e1lidos.');
    const limits = [[10,30],[0,15],[0.2,1]];
    config.controls = value.controls.map((v,i) => {
        v = Number(v);
        if (!Number.isFinite(v) || v < limits[i][0] || v > limits[i][1]) throw new Error('Controles fora dos limites.');
        return v;
    });
    for (const id of Object.keys(defaultHudLayout)) {
        const pos = value.hud && value.hud[id];
        if (!pos || !Number.isFinite(pos.size) || pos.size < 8 || pos.size > 35) throw new Error('Tamanho do HUD inv\u00e1lido.');
        const clean = {size:pos.size};
        for (const axis of ['left','right','top','bottom']) {
            const v = pos[axis];
            if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100)) throw new Error('Posi\u00e7\u00e3o do HUD inv\u00e1lida.');
            clean[axis] = v;
        }
        if (clean.left === null && clean.right === null || clean.top === null && clean.bottom === null) throw new Error('HUD sem posi\u00e7\u00e3o.');
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
    applySettings();
}
function openProfilesPanel() {
    const panel = openMobilePanel('Perfis de configura\u00e7\u00e3o');
    const name = mobileNode('input', null, panel);
    name.placeholder = 'Nome do perfil'; name.maxLength = 48;
    name.style.cssText = 'padding:8px;width:100%;box-sizing:border-box';
    mobileButton('Salvar perfil atual', panel, () => {
        const label = name.value.trim();
        if (!label) throw new Error('Informe o nome do perfil.');
        const profiles = readStored('hm_profiles', []).filter(p => p.name !== label).slice(-19);
        profiles.push({name:label,data:exportMobileProfile()});
        localStorage.setItem('hm_profiles', JSON.stringify(profiles));
        openProfilesPanel();
    });
    for (const profile of readStored('hm_profiles', [])) {
        const row = settingRow(panel, profile.name);
        mobileButton('Aplicar', row, () => { applyMobileProfile(profile.data); mobileNotice('Perfil aplicado.'); });
        mobileButton('Excluir', row, () => {
            localStorage.setItem('hm_profiles',JSON.stringify(readStored('hm_profiles',[]).filter(p=>p.name !== profile.name)));
            openProfilesPanel();
        });
    }
    mobileNode('p', 'Exporte para arquivo JSON ou copie o texto. Para importar, cole um perfil abaixo.', panel);
    const text = mobileNode('textarea', null, panel);
    text.rows = 5; text.maxLength = 32000; text.placeholder = 'JSON do perfil';
    text.style.cssText = 'width:100%;box-sizing:border-box;user-select:text';
    mobileButton('Exportar texto', panel, () => { text.value = JSON.stringify(exportMobileProfile(),null,2); text.focus(); text.select(); });
    mobileButton('Salvar arquivo JSON', panel, () => { window.location.href = 'haxmobile://export-profile'; });
    mobileButton('Importar texto', panel, () => {
        if (text.value.length > 32000) throw new Error('Perfil muito grande.');
        applyMobileProfile(JSON.parse(text.value));
        mobileNotice('Perfil importado.');
    });
    mobileButton('Abrir arquivo JSON', panel, () => { window.location.href = 'haxmobile://import-profile'; });
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
    const panel = openMobilePanel('Favoritos e salas recentes');
    if (currentRoom) mobileButton('Favoritar / desfavoritar sala atual', panel, () => {
        mobileNotice(toggleRoomFavorite(currentRoom) ? 'Sala favoritada.' : 'Favorito removido.');
        openRoomsPanel();
    });
    const urlInput = mobileNode('input', null, panel);
    urlInput.type = 'url'; urlInput.placeholder = 'https://www.haxball.com/play?c=...';
    urlInput.style.cssText = 'width:100%;box-sizing:border-box;padding:8px';
    mobileButton('Entrar pelo link', panel, () => {
        const url = canonicalRoomUrl(urlInput.value);
        if (!url) throw new Error('Cole um link v\u00e1lido do HaxBall.');
        goToRoom({name:'Sala compartilhada',url});
    });
    for (const [title,key] of [['Favoritos','hm_favorite_rooms'],['Recentes','hm_recent_rooms']]) {
        mobileNode('h3', title, panel);
        const rooms = readStored(key,[]);
        if (!rooms.length) mobileNode('p','Nenhuma sala ainda.',panel);
        for (const room of rooms) {
            const row = settingRow(panel,room.name);
            mobileButton('Entrar',row,()=>goToRoom(room));
            mobileButton('Remover',row,()=>{
                localStorage.setItem(key,JSON.stringify(readStored(key,[]).filter(r=>roomKey(r)!==roomKey(room))));
                openRoomsPanel();
            });
        }
    }
    mobileNode('p','Sem link salvo, a sala \u00e9 localizada pelo nome na lista p\u00fablica. Salas fechadas ou com nomes repetidos precisam de sele\u00e7\u00e3o manual.',panel);
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
                if (rows.length > 1) mobileNotice('H\u00e1 salas com esse nome. Selecione a desejada na lista.');
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
    const settings = mobileButton('Cliente',parent,renderMobileSettings);
    settings.setAttribute('data-hook','mobile-settings');
    const rooms = mobileButton('Salas',parent,openRoomsPanel);
    rooms.setAttribute('data-hook','mobile-rooms');
}
function translateMobileUI() {
    const labels = {join:'Entrar',create:'Criar sala',refresh:'Atualizar',settings:'Configura\u00e7\u00f5es',changenick:'Nome',copy:'Copiar',close:'Fechar',cancel:'Cancelar',leave:'Sair',soundbtn:'Áudio',videobtn:'Vídeo',inputbtn:'Controles',miscbtn:'Avançado','leave-btn':'Sair','link-btn':'Link','start-btn':'Iniciar','stop-btn':'Parar','pause-btn':'Pausar','settingsbtn':'Cliente','url-room':'Link da sala','aboutbtn':'Sobre'};
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
    const panel = openMobilePanel('HaxBall Mobile');
    mobileNode('p','Vers\u00e3o '+CLIENT_VERSION,panel);
    mobileNode('p','Cliente Android personalizado por Kylun. Jogo original: Mario Carbajal (@basro). Adapta\u00e7\u00e3o mobile original: Vixel Dev.',panel);
    mobileNode('p','Este cliente precisa de internet para entrar nas salas.',panel);
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
window.addEventListener('resize', () => { releaseControls(); applyHudPositions(); });
gameFrame.addEventListener('offline',()=>mobileNotice('Sem conex\u00e3o. Verifique Wi-Fi ou dados m\u00f3veis.'));
gameFrame.addEventListener('online',()=>mobileNotice('Conex\u00e3o de internet restabelecida.'));

if (pendingJoin && !pendingJoin.url) {
    setTimeout(() => {
        if (pendingJoin && !currentRoom) mobileNotice('Sala nao encontrada. Ela pode estar fechada ou ter mudado de nome.');
    }, 15000);
}
