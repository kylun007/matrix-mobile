
// Shared visual layer: native room nodes and their event handlers stay in place.
const mobileUiStyle = document.createElement('style');
mobileUiStyle.textContent = /*UI_STYLE_TEXT*/;
document.head.appendChild(mobileUiStyle);
const mobileFrameUiStyle = gameFrame.document.createElement('style');
mobileFrameUiStyle.textContent = mobileUiStyle.textContent;
gameFrame.document.head.appendChild(mobileFrameUiStyle);
let lastVisualSettings = '';
let chatHideTimer = null;
let roomFilters = readStored('hm_room_filters',{available:false,password:false,favorites:false,region:'',sort:'native'});
let nativeSettingsTab = null;
const themeMedia = window.matchMedia('(prefers-color-scheme: light)');
themeMedia.addEventListener('change', () => { lastVisualSettings = ''; applyVisualSettings(); });

function applyVisualSettings() {
    const stored = {...defaultSettings,...readStored('hm_settings',{})};
    const values = ['theme','interfaceOpacity','menuScale','textScale','chatSize','chatOpacity','controlsOpacity','immersive','animations','autoHideChat','chatCascade'].map(key=>stored[key]);
    const signature = JSON.stringify(values);
    if (signature === lastVisualSettings) return;
    lastVisualSettings = signature;
    const light = getSetting('theme') === 'light' || getSetting('theme') === 'auto' && themeMedia.matches;
    const duration = {full:'160ms',reduced:'70ms',off:'0ms'}[getSetting('animations')] || '160ms';
    const vars = {
        '--hm-bg':light?'#edf2f7':'#111820','--hm-surface':light?'#ffffff':'#1c2733',
        '--hm-rgb':light?'255,255,255':'28,39,51','--hm-text':light?'#172738':'#edf3f9',
        '--hm-muted':light?'#516477':'#aab8c8','--hm-line':light?'#17273829':'#ffffff24',
        '--hm-accent':light?'#08795d':'#57d6ad','--hm-opacity':getSetting('interfaceOpacity'),
        '--hm-scale':getSetting('menuScale'),'--hm-text-scale':getSetting('textScale'),
        '--hm-chat-size':getSetting('chatSize'),'--hm-chat-opacity':getSetting('chatOpacity'),
        '--hm-control-opacity':Number(getSetting('controlsOpacity')) * Number(getSetting('interfaceOpacity')),
        '--hm-duration':duration
    };
    for (const doc of [document,gameFrame.document]) {
        for (const [key,value] of Object.entries(vars)) doc.documentElement.style.setProperty(key,String(value));
        doc.documentElement.classList.toggle('hm-immersive',!!getSetting('immersive'));
        doc.documentElement.classList.toggle('hm-cascade-enabled',!!getSetting('chatCascade'));
    }
    // Keep text readable over the field even with a fully transparent panel.
    mobileFrameUiStyle.textContent = mobileUiStyle.textContent +
        (Number(getSetting('interfaceOpacity')) < .35 ? '#mobile-panel.hm-game-panel,.room-view>.container{color:#fff!important;text-shadow:0 1px 3px #000,0 0 4px #000}#mobile-panel.hm-game-panel h2,.room-view h1{color:#fff!important}' : '') +
        (!getSetting('chatBg') ? '.chatbox-view-contents .log-contents>*{background:transparent!important}' : '');
    if (!getSetting('autoHideChat')) {
        clearTimeout(chatHideTimer);
        gameFrame.document.documentElement.classList.remove('hm-chat-hidden');
    }
}
function revealMobileChat() {
    const root = gameFrame.document.documentElement;
    root.classList.remove('hm-chat-hidden');
    clearTimeout(chatHideTimer);
    if (getSetting('autoHideChat')) chatHideTimer = setTimeout(() => {
        if (!chatFocused) root.classList.add('hm-chat-hidden');
    }, Number(getSetting('chatHideDelay')) * 1000);
}
function openMobileChatHistory() {
    const panel = openMobilePanel('Hist\u00f3rico do chat');
    const list = mobileNode('div',null,panel); list.className = 'hm-content';
    if (!chatHistory.length) mobileNode('p','Nenhuma mensagem ainda.',list);
    for (const message of chatHistory) {
        const row = mobileNode('div',null,list);
        row.style.cssText = 'padding:8px;overflow-wrap:anywhere;border-bottom:1px solid var(--hm-line);background:#111820;color:#fff;border-radius:8px;margin-bottom:4px';
        row.innerHTML = message.html;
        if (message.color) row.style.color = message.color;
    }
    list.scrollTop = list.scrollHeight;
}
function openQuickMenu() {
    const panel = openMobilePanel('Menu da partida');
    const grid = mobileNode('div',null,panel); grid.className='hm-quick-grid';
    mobileButton('Jogadores e times',grid,()=>{if(body.querySelector('.room-view'))closeMobilePanel();else openPlayersMenu();});
    mobileButton('Chat',grid,()=>{closeMobilePanel();setMobileChatOpen(true);});
    mobileButton('Configura\u00e7\u00f5es',grid,()=>renderMobileSettings('Interface'));
    mobileButton('Controles',grid,()=>renderMobileSettings('Controles'));
    mobileButton('Informa\u00e7\u00f5es da sala',grid,openRoomInfo);
    mobileButton('Hist\u00f3rico do chat',grid,openMobileChatHistory);
    const leave = mobileButton('Sair da sala',grid,confirmLeaveRoom);leave.className='hm-danger';
    settingToggle(panel,'Modo imersivo','immersive');
}
function openRoomInfo() {
    const panel = openMobilePanel('Informa\u00e7\u00f5es da sala');
    mobileNode('h3',currentRoom?.name || 'Sala atual',panel);
    const ping = body.querySelector('.stats-view [data-hook=ping]')?.textContent;
    if (ping) mobileNode('p',ping,panel);
    const actions = mobileNode('div',null,panel);actions.className='hm-actions';
    mobileButton('Favoritos e recentes',actions,openRoomsPanel);
    mobileButton('Compartilhar link',actions,()=>{closeMobilePanel();body.querySelector('[data-hook=link-btn]')?.click();});
}
function confirmLeaveRoom() {
    closeMobilePanel();
    const leave=body.querySelector('[data-hook=leave-btn]');
    if(leave)leave.click();
    else{
        body.querySelector('[data-hook=menu]')?.click();
        setTimeout(()=>body.querySelector('[data-hook=leave-btn]')?.click(),100);
    }
}
function openNativePreferences(tab) {
    closeMobilePanel();
    nativeSettingsTab=tab;
    const button=body.querySelector('[data-hook=settings]');
    if(button)button.click();
    else{
        // The room's native preferences are opened through its menu.
        body.querySelector('[data-hook=menu]')?.click();
        setTimeout(()=>{
            const settings=body.querySelector('[data-hook=settings]');
            if(settings)settings.click();else {nativeSettingsTab=null;mobileNotice('Use as prefer\u00eancias de \u00e1udio e v\u00eddeo no menu nativo da sala.');}
        },100);
    }
}
function enhanceVisualUI() {
    applyVisualSettings();
    syncMobileStatus();
    const nativeSettings=body.querySelector('.settings-view');
    if(nativeSettings && nativeSettingsTab) {
        const button=nativeSettings.querySelector('[data-hook='+nativeSettingsTab+']');
        nativeSettingsTab=null;button?.click();
    }
    const game=body.querySelector('.game-view');
    if(game)installMobileChat(game);
    else if(mobileChatGame){mobileChatGame=null;mobileChatOpen=false;mobileChatUnread=0;}
    if(game && !game.querySelector('#hm-quick-toggle')){
        const toggle=mobileButton('\u2630',game,()=>mobilePanelOpen?closeMobilePanel():openQuickMenu());
        toggle.id='hm-quick-toggle';toggle.setAttribute('aria-label','Abrir menu da partida');
    }
    if(game && !game.querySelector('#hm-players-toggle')){
        const players=mobileButton('Times',game,openPlayersMenu);
        players.id='hm-players-toggle';players.setAttribute('aria-label','Jogadores e times');
    }
    const room=body.querySelector('.room-view');
    if(playerTouchDrag && (!room || !room.classList.contains('admin')))cancelPlayerTouchDrag();
    if(room)installPlayerTouchDrag(room);
    if(room && !room.dataset.visualMobile){
        room.dataset.visualMobile='1';
        const header=room.querySelector('.header-btns');
        if(header){
            mobileButton('Voltar ao jogo',header,()=>{
                closeMobilePanel();
                gameFrame.document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));
            });
            // Hide administrative sections through an explicit toggle, retaining native permissions.
            if(room.querySelector('.admin-only')){
                room.dataset.hmAdminCollapsed='1';
                const admin=mobileButton('Op\u00e7\u00f5es da partida',header,()=>{
                    const collapsed=room.dataset.hmAdminCollapsed!=='1';room.dataset.hmAdminCollapsed=collapsed?'1':'0';
                    admin.setAttribute('aria-expanded',String(!collapsed));
                });
                admin.setAttribute('aria-expanded','false');
            }
        }
        for(const [hook,label] of [['red-list','Red'],['blue-list','Blue'],['spec-list','Spectators']]){
            const join=room.querySelector('[data-hook='+hook+'] [data-hook=join-btn],.t-'+({'red-list':'red','blue-list':'blue','spec-list':'spec'}[hook])+' [data-hook=join-btn]');
            if(join){join.textContent=label;join.setAttribute('aria-label','Entrar em '+label);}
        }
    }
    const roomlist=body.querySelector('.roomlist-view');
    if(roomlist){
        const dialog=roomlist.querySelector('.dialog'),actions=roomlist.querySelector('.splitter>.buttons');
        if(dialog&&actions)dialog.appendChild(actions);
        const search=roomlist.querySelector('[data-hook=search]');
        if(search){search.placeholder='Buscar sala pelo nome';search.setAttribute('aria-label','Buscar sala');}
        if(!roomlist.querySelector('[data-hook=hm-filters]')){
            const bar=search?.parentNode;
            if(bar){
                const button=mobileButton('Filtros',bar,openRoomFilters);button.setAttribute('data-hook','hm-filters');
                bar.classList.add('hm-room-toolbar');
            }
            const status=mobileNode('p',null,roomlist.querySelector('.dialog'));status.setAttribute('data-hook','hm-room-status');status.className='hm-room-status';
        }
        filterMobileRooms();
    }
    const chat=body.querySelector('.chatbox-view .input');
    if(chat && !chat.querySelector('[data-hook=hm-minimize]')){
        const minimize=mobileButton('Fechar',chat,()=>{
            chat.querySelector('input')?.blur();chat.style.display='none';chatFocused=false;canResetJoystick=true;updateUI();
        });minimize.setAttribute('data-hook','hm-minimize');minimize.setAttribute('aria-label','Minimizar chat');
        minimize.addEventListener('pointerdown',e=>e.preventDefault());
    }
}
function roomRowDetails(row) {
    const name=row.querySelector('[data-hook=name]')?.textContent.trim() || '';
    const players=(row.querySelector('[data-hook=players]')?.textContent || row.children[1]?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
    const pass=(row.querySelector('[data-hook=pass]')?.textContent || row.children[2]?.textContent || '').trim().toLowerCase();
    const flag=row.querySelector('.flagico');
    const region=Array.from(flag?.classList || []).find(c=>/^f-/.test(c))?.slice(2).toUpperCase() || '';
    const distance=parseFloat((row.querySelector('[data-hook=distance]')?.textContent || row.children[3]?.textContent || '').replace(/[^\d.,]/g,'').replace(',','.'));
    return {name,count:players?Number(players[1]):0,max:players?Number(players[2]):0,password:!!pass&&!['no','n\u00e3o','false','-'].includes(pass),region,distance:Number.isFinite(distance)?distance:Infinity};
}
function filterMobileRooms() {
    const list=body.querySelector('.roomlist-view [data-hook=list]');
    if(!list)return;
    const search=body.querySelector('[data-hook=search]')?.value.toLocaleLowerCase() || '';
    const favorites=readStored('hm_favorite_rooms',[]);
    const rows=Array.from(list.querySelectorAll('tr')).map(row=>({row,data:roomRowDetails(row)}));
    let visible=0;
    for(const {row,data} of rows){
        const show=data.name.toLocaleLowerCase().includes(search) &&
            (!roomFilters.available || data.max>data.count) &&
            (!roomFilters.password || !data.password) &&
            (!roomFilters.favorites || favorites.some(f=>f.name===data.name)) &&
            (!roomFilters.region || data.region===roomFilters.region.toUpperCase());
        const display=show?'':'none';
        if(row.style.display!==display)row.style.display=display;
        if(show)visible++;
        const pass=row.querySelector('[data-hook=pass]');
        if(pass)pass.dataset.hmPassword=data.password?'Senha':'Livre';
        const existingRegion=row.querySelector('.hm-region');
        if(existingRegion && existingRegion.textContent!==data.region)existingRegion.textContent=data.region;
        const distance=row.querySelector('[data-hook=distance]');
        if(distance && !distance.parentNode.querySelector('.hm-region')){
            const region=mobileNode('span',data.region,distance.parentNode);
            region.className='hm-region';
            distance.parentNode.insertBefore(region,distance);
        }
    }
    // CSS order changes the presentation without replacing the native rows or selection handlers.
    list.style.display='flex';list.style.flexDirection='column';
    const sorted=rows.slice().sort((a,b)=>roomFilters.sort==='players'?b.data.count-a.data.count:roomFilters.sort==='distance'?a.data.distance-b.data.distance:0);
    sorted.forEach(({row},index)=>{const order=String(index);if(row.style.order!==order)row.style.order=order;});
    const status=body.querySelector('[data-hook=hm-room-status]');
    const text=visible+' salas \u00b7 Jogadores / limite \u00b7 Senha \u00b7 Dist\u00e2ncia';
    if(status && status.textContent!==text)status.textContent=text;
}
function openRoomFilters() {
    const panel=openMobilePanel('Filtrar salas');
    function toggle(label,key){
        const row=settingRow(panel,label);const input=mobileNode('input',null,row);
        input.type='checkbox';input.checked=!!roomFilters[key];input.addEventListener('change',()=>{roomFilters[key]=input.checked;save();});
    }
    function save(){localStorage.setItem('hm_room_filters',JSON.stringify(roomFilters));filterMobileRooms();}
    toggle('Somente salas com vaga','available');toggle('Sem senha','password');toggle('Favoritas','favorites');
    const row=settingRow(panel,'Ordena\u00e7\u00e3o'),select=mobileNode('select',null,row);
    for(const [value,label] of [['native','Padr\u00e3o'],['distance','Menor dist\u00e2ncia'],['players','Mais jogadores']]){
        const option=mobileNode('option',label,select);option.value=value;
    }
    select.value=roomFilters.sort;select.addEventListener('change',()=>{roomFilters.sort=select.value;save();});
    const regionRow=settingRow(panel,'Regi\u00e3o'),regionSelect=mobileNode('select',null,regionRow);
    const regions=new Set(Array.from(body.querySelectorAll('.roomlist-view [data-hook=list] tr')).map(row=>roomRowDetails(row).region).filter(Boolean));
    for(const code of ['',...Array.from(regions).sort()]){
        const option=mobileNode('option',code||'Todas',regionSelect);option.value=code;
    }
    regionSelect.value=roomFilters.region;regionSelect.addEventListener('change',()=>{roomFilters.region=regionSelect.value;countryFilterHandler.innerHTML='';save();});
    mobileNode('p','A lista p\u00fablica informa dist\u00e2ncia do servidor. O ping real fica dispon\u00edvel ao entrar na sala.',panel).className='hm-note';
    mobileButton('Limpar filtros',panel,()=>{roomFilters={available:false,password:false,favorites:false,region:'',sort:'native'};countryFilterHandler.innerHTML='';save();openRoomFilters();});
}

function openNativeAudio() {
    if (!body.querySelector('.game-view')) { openNativePreferences('soundbtn'); return; }
    const panel=openMobilePanel('Volume da partida');
    const sound=body.querySelector('.sound-button-container');
    const slider=sound?.querySelector('[data-hook=sound-slider]');
    const bar=sound?.querySelector('[data-hook=sound-bar-bg]');
    const fill=sound?.querySelector('[data-hook=sound-bar]');
    if(!slider||!bar){mobileNode('p','Volume indispon\u00edvel nesta tela.',panel);return;}
    const row=settingRow(panel,'Volume'),range=mobileNode('input',null,row);
    range.type='range';range.min=0;range.max=100;range.step=1;
    range.value=100-parseFloat(fill.style.top || '0');
    range.setAttribute('aria-label','Volume da partida');
    range.addEventListener('input',()=>{
        const toolbar=sound.parentNode;
        const original=[toolbar,slider].map(el=>el.getAttribute('style'));
        try{
            toolbar.style.setProperty('display','flex','important');
            toolbar.style.visibility='hidden';
            slider.style.setProperty('display','block','important');
            const rect=bar.getBoundingClientRect();
            if(!rect.height)return;
            const event={clientX:rect.left,clientY:rect.top+rect.height*(1-Number(range.value)/100),bubbles:true,cancelable:true};
            slider.dispatchEvent(new gameFrame.MouseEvent('mousedown',event));
            gameFrame.document.dispatchEvent(new gameFrame.MouseEvent('mouseup',event));
        } finally {
            [toolbar,slider].forEach((el,index)=>original[index]===null?el.removeAttribute('style'):el.setAttribute('style',original[index]));
        }
    });
    mobileButton('Ativar / silenciar',panel,()=>sound.querySelector('[data-hook=sound-btn]')?.click());
}

function readMobileMetrics(pingText, fpsText, online = true) {
    const pingNumbers = String(pingText || '').match(/\d+(?:[.,]\d+)?/g) || [];
    const fpsNumbers = String(fpsText || '').match(/\d+(?:[.,]\d+)?/g) || [];
    const ping = pingNumbers.length ? Math.round(Number(pingNumbers[0].replace(',','.'))) : null;
    const peak = pingNumbers.length > 1 ? Math.round(Number(pingNumbers[1].replace(',','.'))) : ping;
    const fps = fpsNumbers.length ? Math.round(Number(fpsNumbers[0].replace(',','.'))) : null;
    const level = !online ? 'offline' : ping === null ? 'unknown' : ping <= 80 ? 'good' : ping <= 150 ? 'fair' : ping <= 250 ? 'slow' : 'poor';
    return {ping,peak,fps,level,online};
}
function syncMobileStatus() {
    const game = body?.querySelector('.game-view');
    if (!game) return;
    let hud = game.querySelector('#hm-status');
    const showPing = !!getSetting('showPing'), showFps = !!getSetting('showFps');
    if (!hud && !showPing && !showFps) return;
    if (!hud) {
        hud = mobileNode('div',null,game);hud.id='hm-status';
        hud.innerHTML = '<span class="hm-ping"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="hm-wifi-arc hm-wifi-outer" d="M2 8a15 15 0 0 1 20 0"/><path class="hm-wifi-arc hm-wifi-middle" d="M5.5 11.5a10 10 0 0 1 13 0"/><path class="hm-wifi-arc hm-wifi-inner" d="M9 15a4.7 4.7 0 0 1 6 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/><path class="hm-wifi-offline" d="M3 3l18 18"/></svg><span data-metric="ping">-- ms</span></span><span class="hm-fps"><span class="hm-fps-label">FPS</span><span data-metric="fps">--</span></span>';
    }
    const metrics = readMobileMetrics(
        game.querySelector('.stats-view [data-hook=ping]')?.textContent,
        game.querySelector('.stats-view [data-hook=fps]')?.textContent,
        gameFrame.navigator.onLine !== false);
    const ping = hud.querySelector('.hm-ping'), fps = hud.querySelector('.hm-fps');
    ping.hidden = !showPing;fps.hidden = !showFps;
    if (hud.dataset.level !== metrics.level) hud.dataset.level=metrics.level;
    const pingValue = metrics.online ? (metrics.ping === null ? '--' : metrics.ping)+' ms' : 'Offline';
    const fpsValue = metrics.fps === null ? '--' : String(metrics.fps);
    for (const [key,value] of [['ping',pingValue],['fps',fpsValue]]) {
        const label=hud.querySelector('[data-metric='+key+']');
        if(label.textContent!==value)label.textContent=value;
    }
    const description = !metrics.online ? 'Sem conex\u00e3o' : metrics.ping === null ? 'Aguardando dados de ping' : 'Ping: '+metrics.ping+' ms. Pico: '+metrics.peak+' ms.';
    if (ping.getAttribute('aria-label') !== description) {ping.setAttribute('aria-label',description);ping.title=description;}
    // Suppress secondary information while any menu is being used.
    const hidden = mobilePanelOpen || mobileChatOpen || chatFocused || !!body.querySelector('.room-view,.settings-view,.room-link-view,.leave-room-view') ||
        !!getSetting('immersive') || !showPing && !showFps;
    hud.hidden = hidden;
}
gameFrame.addEventListener('offline',syncMobileStatus);
gameFrame.addEventListener('online',syncMobileStatus);

let playerTouchDrag = null;
function cancelPlayerTouchDrag() {
    const drag=playerTouchDrag;
    if(!drag)return;
    clearTimeout(drag.timer);
    drag.ghost?.remove();
    drag.row.classList.remove('hm-player-dragging');
    drag.target?.classList.remove('hm-team-drop-target');
    playerTouchDrag=null;
}
function openPlayersMenu() {
    closeMobilePanel();
    const room=body.querySelector('.room-view');
    if(room) {
        gameFrame.document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));
    } else body.querySelector('[data-hook=menu]')?.click();
}
function installPlayerTouchDrag(room) {
    if(room.dataset.touchPlayers)return;
    room.dataset.touchPlayers='1';
    let suppressContextUntil=0;
    function canMove(row){return room.isConnected&&room.classList.contains('admin')&&row.isConnected&&row.draggable;}
    function updateTarget(touch){
        const drag=playerTouchDrag;if(!drag?.active)return;
        drag.x=touch.clientX;drag.y=touch.clientY;
        drag.ghost.style.left=Math.max(8,Math.min(gameFrame.innerWidth-160,touch.clientX+12))+'px';
        drag.ghost.style.top=Math.max(8,touch.clientY-48)+'px';
        const hit=gameFrame.document.elementFromPoint(touch.clientX,touch.clientY);
        const target=hit?.closest('.player-list-view');
        const next=target&&room.contains(target)?target:null;
        if(drag.target!==next){drag.target?.classList.remove('hm-team-drop-target');next?.classList.add('hm-team-drop-target');drag.target=next;}
        if(Math.hypot(touch.clientX-drag.startX,touch.clientY-drag.startY)>10)drag.moved=true;
    }
    room.addEventListener('touchstart',event=>{
        if(event.touches.length!==1){cancelPlayerTouchDrag();return;}
        const row=event.target.closest('.player-list-item');
        if(!row||!canMove(row)||typeof row.ondragstart!=='function')return;
        cancelPlayerTouchDrag();
        const touch=event.changedTouches[0];
        const drag={row,room,id:touch.identifier,startX:touch.clientX,startY:touch.clientY,x:touch.clientX,y:touch.clientY,active:false,moved:false,target:null,ghost:null};
        playerTouchDrag=drag;
        drag.timer=setTimeout(()=>{
            if(playerTouchDrag!==drag||!canMove(row)){cancelPlayerTouchDrag();return;}
            // Reuse the ID placed in the transfer by HaxBall, never infer IDs from nicknames.
            const values=new Map();
            drag.transfer={setData:(key,value)=>values.set(key,String(value)),getData:key=>values.get(key)||'',get types(){return Array.from(values.keys());}};
            try{row.ondragstart({dataTransfer:drag.transfer});}catch{cancelPlayerTouchDrag();return;}
            if(!drag.transfer.getData('player')){cancelPlayerTouchDrag();return;}
            drag.active=true;suppressContextUntil=Date.now()+1000;
            drag.ghost=mobileNode('div',row.querySelector('[data-hook=name]')?.textContent||'Jogador',gameFrame.document.body);
            drag.ghost.className='hm-player-drag-ghost';row.classList.add('hm-player-dragging');
            updateTarget({clientX:drag.x,clientY:drag.y});
        },300);
    },{passive:true});
    room.addEventListener('touchmove',event=>{
        const drag=playerTouchDrag;if(!drag||drag.room!==room)return;
        const touch=Array.from(event.touches).find(t=>t.identifier===drag.id);
        if(!touch||!canMove(drag.row)){cancelPlayerTouchDrag();return;}
        if(!drag.active){
            if(Math.hypot(touch.clientX-drag.startX,touch.clientY-drag.startY)>10)cancelPlayerTouchDrag();
            return;
        }
        event.preventDefault();event.stopPropagation();updateTarget(touch);
    },{passive:false});
    room.addEventListener('touchend',event=>{
        const drag=playerTouchDrag;if(!drag||drag.room!==room)return;
        const touch=Array.from(event.changedTouches).find(t=>t.identifier===drag.id);
        if(!touch)return;
        const permitted=canMove(drag.row);
        if(drag.active){event.preventDefault();event.stopPropagation();updateTarget(touch);}
        suppressContextUntil=Date.now()+700;
        const target=drag.target,transfer=drag.transfer,row=drag.row;
        const drop=drag.active&&drag.moved&&permitted&&target&&room.contains(target);
        const tap=!drag.moved&&permitted;
        cancelPlayerTouchDrag();
        if(drop&&typeof target.ondrop==='function')target.ondrop({dataTransfer:transfer,preventDefault(){}});
        else if(tap&&typeof row.oncontextmenu==='function'){event.preventDefault();row.oncontextmenu({preventDefault(){}});}
    },{passive:false});
    room.addEventListener('touchcancel',cancelPlayerTouchDrag,{passive:true});
    room.addEventListener('contextmenu',event=>{
        if(playerTouchDrag?.active||Date.now()<suppressContextUntil){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    const hint=mobileNode('p','Toque para op\u00e7\u00f5es. Segure o nome e arraste para outro time.',room.querySelector('.container'));
    hint.className='hm-player-touch-hint admin-only';
}
window.addEventListener('blur',cancelPlayerTouchDrag);
window.addEventListener('resize',cancelPlayerTouchDrag);
gameFrame.addEventListener('blur',cancelPlayerTouchDrag);

let mobileChatOpen = false;
let mobileChatUnread = 0;
let mobileChatGame = null;
function refreshMobileChatBadge() {
    const button=body?.querySelector('#hm-chat-toggle');
    if(!button)return;
    const badge=button.querySelector('.hm-chat-badge');
    badge.hidden=mobileChatUnread===0;
    const text=mobileChatUnread>99?'99+':String(mobileChatUnread);
    if(badge.textContent!==text)badge.textContent=text;
    button.setAttribute('aria-label','Chat'+(mobileChatUnread?', '+mobileChatUnread+' mensagens n\u00e3o lidas':''));
    button.setAttribute('aria-expanded',String(mobileChatOpen));
}
function noteMobileChatMessage() {
    if(!mobileChatOpen)mobileChatUnread++;
    refreshMobileChatBadge();
    if(getSetting('chatCascade'))revealMobileChat();
}
function setMobileChatOpen(open) {
    const game=body?.querySelector('.game-view'),chat=game?.querySelector('.chatbox-view-contents');
    if(!game||!chat)return;
    if(open&&mobilePanelOpen)closeMobilePanel();
    mobileChatOpen=!!open;
    game.classList.toggle('hm-chat-open',mobileChatOpen);
    const composer=chat.querySelector('.input');
    if(mobileChatOpen){
        releaseControls();showControls(false);mobileChatUnread=0;
        composer.style.display='flex';
        gameFrame.document.documentElement.classList.remove('hm-chat-hidden');
        updatedChat();
        const log=chat.querySelector('.log');if(log)log.scrollTop=log.scrollHeight;
    }else{
        composer.querySelector('input')?.blur();composer.style.display='none';chatFocused=false;
        canResetJoystick=true;updatedChat();updateUI();
    }
    refreshMobileChatBadge();syncMobileStatus();
}
function toggleMobileChat(){setMobileChatOpen(!mobileChatOpen);}
function installMobileChat(game) {
    if(mobileChatGame!==game){
        mobileChatGame=game;mobileChatOpen=false;mobileChatUnread=0;
    }
    if(!game.querySelector('#hm-chat-toggle')){
        const button=mobileButton('Chat',game,toggleMobileChat);button.id='hm-chat-toggle';
        const badge=mobileNode('span','0',button);badge.className='hm-chat-badge';badge.hidden=true;
    }
    const chat=game.querySelector('.chatbox-view-contents');
    if(chat&&!chat.querySelector('.hm-chat-header')){
        const header=mobileNode('div',null);header.className='hm-chat-header';
        mobileNode('strong','Chat da sala',header);
        mobileButton('Fechar',header,()=>setMobileChatOpen(false));
        chat.prepend(header);
    }
    gameFrame.document.documentElement.classList.toggle('hm-cascade-enabled',!!getSetting('chatCascade'));
    refreshMobileChatBadge();
}
