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

// ---------------------------------------------------------------------------
// Paleta e ícones do design system v2
// ---------------------------------------------------------------------------
const HM_PALETTE = {
    dark: {bg:'#070b10',bg2:'#0c141c',surface:'#111b25',surface2:'#172430',elev:'#1d2d3b',
        text:'#eaf2f8',muted:'#8ea2b5',dim:'#5d7185',line:'#ffffff14',line2:'#ffffff26',
        accent:'#2be0a6',accent2:'#10b981',ink:'#052e22',rgb:'17,27,37'},
    light: {bg:'#eef3f7',bg2:'#e3eaf1',surface:'#ffffff',surface2:'#f4f8fb',elev:'#e6edf3',
        text:'#0d1b26',muted:'#4d6172',dim:'#77909f',line:'#0d1b2614',line2:'#0d1b2626',
        accent:'#0f9d75',accent2:'#0b7f5e',ink:'#ffffff',rgb:'255,255,255'}
};
const HM_ICONS = {
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 5v-5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 10c3.3 0 6 1.6 6 3.6V20H3v-2.4C3 15.6 5.7 14 9 14zm7.5-9a3.5 3.5 0 0 1 0 7 5.9 5.9 0 0 0 0-7zM18 14.2c1.9.5 3 1.7 3 3.3V20h-4v-2.4c0-1.4-.5-2.6-1.4-3.4z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm9 4c0-.6-.1-1.2-.2-1.8l2-1.5-2-3.4-2.3 1a8 8 0 0 0-3.1-1.8L15 2H9l-.4 2.5a8 8 0 0 0-3.1 1.8l-2.3-1-2 3.4 2 1.5a9 9 0 0 0 0 3.6l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 3.1 1.8L9 22h6l.4-2.5a8 8 0 0 0 3.1-1.8l2.3 1 2-3.4-2-1.5c.1-.6.2-1.2.2-1.8z"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10v2H4zm12 0h4v2h-4zM4 11h4v2H4zm6 0h10v2H10zM4 16h12v2H4zm14 0h2v2h-2zM14 4h2v6h-2zM8 9h2v6H8zm6 5h2v6h-2z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h3l2-2h6l2 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4l12 8-12 8z"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 5v2h2V7zm0 4v6h2v-6z"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.6 7 .8-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.8z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.2 1l-6-3.2a3 3 0 0 0 0-1.6l6-3.2A3 3 0 1 0 15 7v.2L9 10.4a3 3 0 1 0 0 3.2l6 3.2V17a3 3 0 1 0 3-1z"/></svg>',
    volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zm12.5-2.1 1.4-1.4a8 8 0 0 1 0 11.2l-1.4-1.4a6 6 0 0 0 0-8.4zM14.6 9.4 16 8a4 4 0 0 1 0 5.6l-1.4-1.4a2 2 0 0 0 0-2.8z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16v2H2V2h2zm3-3V9h3v8zm5 0V5h3v12zm5 0v-6h3v6z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 13H7z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 17.6 4 12.1l1.4-1.4 4.1 4.1 9.1-9.1L20 7.1z"/></svg>',
    leave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6v-2h6V5h-6zm-1.6 5.4L10.8 11H4v2h6.8l-2.4 2.6 1.4 1.4L14 12l-4.2-5z"/></svg>',
    history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 4v5l4 2-.8 1.6-5.2-2.6V7z"/></svg>'
};
function hmIcon(name) { return HM_ICONS[name] || ''; }
function hmIconButton(parent, name, label, action, className) {
    const button = mobileNode('button', null, parent);
    button.type = 'button';
    button.className = 'hm-icon-btn' + (className ? ' ' + className : '');
    button.innerHTML = hmIcon(name);
    button.setAttribute('aria-label', label);
    button.title = label;
    button.addEventListener('click', () => { try { action(); } catch (error) { mobileNotice(error.message || 'Ação indisponível.'); } });
    return button;
}

function applyVisualSettings() {
    const stored = {...defaultSettings,...readStored('hm_settings',{})};
    const values = ['theme','interfaceOpacity','menuScale','textScale','chatSize','chatOpacity','controlsOpacity','immersive','animations','autoHideChat','chatCascade','chatBg','hudDensity'].map(key=>stored[key]);
    const signature = JSON.stringify(values);
    if (signature === lastVisualSettings) return;
    lastVisualSettings = signature;
    const light = getSetting('theme') === 'light' || getSetting('theme') === 'auto' && themeMedia.matches;
    const palette = light ? HM_PALETTE.light : HM_PALETTE.dark;
    const duration = {full:'180ms',reduced:'90ms',off:'0ms'}[getSetting('animations')] || '180ms';
    const vars = {
        '--hm-bg':palette.bg,'--hm-bg-2':palette.bg2,'--hm-surface':palette.surface,
        '--hm-surface-2':palette.surface2,'--hm-elev':palette.elev,'--hm-rgb':palette.rgb,
        '--hm-text':palette.text,'--hm-muted':palette.muted,'--hm-dim':palette.dim,
        '--hm-line':palette.line,'--hm-line-2':palette.line2,
        '--hm-accent':palette.accent,'--hm-accent-2':palette.accent2,'--hm-accent-ink':palette.ink,
        '--hm-opacity':getSetting('interfaceOpacity'),
        '--hm-scale':getSetting('menuScale'),'--hm-text-scale':getSetting('textScale'),
        '--hm-chat-size':getSetting('chatSize'),'--hm-chat-opacity':getSetting('chatOpacity'),
        '--hm-control-opacity':Number(getSetting('controlsOpacity')) * Number(getSetting('interfaceOpacity')),
        '--hm-duration':duration
    };
    for (const doc of [document,gameFrame.document]) {
        for (const [key,value] of Object.entries(vars)) doc.documentElement.style.setProperty(key,String(value));
        doc.documentElement.classList.toggle('hm-immersive',!!getSetting('immersive'));
        doc.documentElement.classList.toggle('hm-cascade-enabled',!!getSetting('chatCascade'));
        doc.documentElement.classList.toggle('hm-theme-light',light);
        doc.documentElement.classList.toggle('hm-anim-off',getSetting('animations') === 'off');
        doc.documentElement.classList.toggle('hm-reduce',getSetting('animations') === 'reduced');
        doc.documentElement.classList.toggle('hm-density-compact',getSetting('hudDensity') === 'compact');
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
    const panel = openMobilePanel('Histórico do chat');
    const list = mobileNode('div',null,panel); list.className = 'hm-list';
    if (!chatHistory.length) { const empty = mobileNode('p','Nenhuma mensagem ainda.',panel); empty.className = 'hm-empty'; return; }
    for (const message of chatHistory) {
        const row = mobileNode('div',null,list);
        row.className = 'hm-listitem';
        row.style.cssText = 'align-items:flex-start;padding:8px 10px;white-space:normal';
        row.innerHTML = message.html;
        if (message.color) row.style.color = message.color;
    }
    list.scrollTop = list.scrollHeight;
}
function openQuickMenu() {
    const panel = openMobilePanel('Menu da partida');
    const grid = mobileNode('div',null,panel); grid.className='hm-quick-grid';
    const item = (icon,label,action,danger) => {
        const button = mobileNode('button',null,grid);
        button.type='button';
        button.innerHTML = hmIcon(icon);
        mobileNode('span',label,button);
        if (danger) button.className='hm-danger';
        button.addEventListener('click',()=>{try{action();}catch(error){mobileNotice(error.message||'Ação indisponível.');}});
        return button;
    };
    item('users','Jogadores e times',()=>{if(body.querySelector('.room-view'))closeMobilePanel();else openPlayersMenu();});
    item('chat','Chat',()=>{closeMobilePanel();setMobileChatOpen(true);});
    item('sliders','Controles',()=>renderMobileSettings('Controles'));
    item('camera','Câmera',()=>renderMobileSettings('Câmera'));
    item('settings','Configurações',()=>renderMobileSettings('Geral'));
    item('info','Sala',openRoomInfo);
    item('history','Histórico',openMobileChatHistory);
    item('leave','Sair da sala',confirmLeaveRoom,true);
    const quick = mobileNode('div',null,panel); quick.className='hm-card';
    settingToggle(quick,'Modo imersivo','immersive');
    settingToggle(quick,'Câmera inteligente','cameraEnabled');
}
function openRoomInfo() {
    const panel = openMobilePanel('Sala');
    const info = mobileNode('div',null,panel); info.className='hm-card';
    mobileNode('h3',currentRoom?.name || 'Sala atual',info).style.cssText='text-transform:none;letter-spacing:-.01em;color:var(--hm-text)!important;font-size:15px';
    const ping = body.querySelector('.stats-view [data-hook=ping]')?.textContent;
    if (ping) { const row = mobileNode('div',null,info); row.className='hm-kv'; mobileNode('span','Latência',row); mobileNode('b',ping,row); }
    const actions = mobileNode('div',null,panel); actions.className='hm-actions';
    mobileButton('Favoritar sala',actions,()=>{mobileNotice(toggleRoomFavorite(currentRoom)?'Sala favoritada.':'Favorito removido.');});
    mobileButton('Compartilhar link',actions,()=>{closeMobilePanel();body.querySelector('[data-hook=link-btn]')?.click();});
    mobileButton('Favoritos e recentes',actions,openRoomsPanel);
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
            if(settings)settings.click();else {nativeSettingsTab=null;mobileNotice('Use as preferências de áudio e vídeo no menu nativo da sala.');}
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
    if(game)installDock(game);
    if(game)installMobileChat(game);
    else if(mobileChatGame){mobileChatGame=null;mobileChatOpen=false;mobileChatUnread=0;}
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
                const admin=mobileButton('Opções da partida',header,()=>{
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
    return {name,count:players?Number(players[1]):0,max:players?Number(players[2]):0,password:!!pass&&!['no','não','false','-'].includes(pass),region,distance:Number.isFinite(distance)?distance:Infinity};
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
    const text=visible+' salas · Jogadores / limite · Senha · Distância';
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
    const row=settingRow(panel,'Ordenação'),select=mobileNode('select',null,row);
    for(const [value,label] of [['native','Padrão'],['distance','Menor distância'],['players','Mais jogadores']]){
        const option=mobileNode('option',label,select);option.value=value;
    }
    select.value=roomFilters.sort;select.addEventListener('change',()=>{roomFilters.sort=select.value;save();});
    const regionRow=settingRow(panel,'Região'),regionSelect=mobileNode('select',null,regionRow);
    const regions=new Set(Array.from(body.querySelectorAll('.roomlist-view [data-hook=list] tr')).map(row=>roomRowDetails(row).region).filter(Boolean));
    for(const code of ['',...Array.from(regions).sort()]){
        const option=mobileNode('option',code||'Todas',regionSelect);option.value=code;
    }
    regionSelect.value=roomFilters.region;regionSelect.addEventListener('change',()=>{roomFilters.region=regionSelect.value;countryFilterHandler.innerHTML='';save();});
    mobileNode('p','A lista pública informa distância do servidor. O ping real fica disponível ao entrar na sala.',panel).className='hm-note';
    const actions=mobileNode('div',null,panel);actions.className='hm-actions';
    mobileButton('Limpar filtros',actions,()=>{roomFilters={available:false,password:false,favorites:false,region:'',sort:'native'};countryFilterHandler.innerHTML='';save();openRoomFilters();});
}
function openNativeAudio() {
    if (!body.querySelector('.game-view')) { openNativePreferences('soundbtn'); return; }
    const panel=openMobilePanel('Volume da partida');
    const sound=body.querySelector('.sound-button-container');
    const slider=sound?.querySelector('[data-hook=sound-slider]');
    const bar=sound?.querySelector('[data-hook=sound-bar-bg]');
    const fill=sound?.querySelector('[data-hook=sound-bar]');
    if(!slider||!bar){mobileNode('p','Volume indisponível nesta tela.',panel).className='hm-empty';return;}
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
    const actions=mobileNode('div',null,panel);actions.className='hm-actions';
    mobileButton('Ativar / silenciar',actions,()=>sound.querySelector('[data-hook=sound-btn]')?.click());
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
    const description = !metrics.online ? 'Sem conexão' : metrics.ping === null ? 'Aguardando dados de ping' : 'Ping: '+metrics.ping+' ms. Pico: '+metrics.peak+' ms.';
    if (ping.getAttribute('aria-label') !== description) {ping.setAttribute('aria-label',description);ping.title=description;}
    // Suppress secondary information while any menu is being used.
    const hidden = mobilePanelOpen || mobileChatOpen || chatFocused || !!body.querySelector('.room-view,.settings-view,.room-link-view,.leave-room-view') ||
        !!getSetting('immersive') || !showPing && !showFps;
    hud.hidden = hidden;
}
gameFrame.addEventListener('offline',syncMobileStatus);
gameFrame.addEventListener('online',syncMobileStatus);

// ---------------------------------------------------------------------------
// Dock de ações (canto superior direito, fora da zona dos polegares)
// ---------------------------------------------------------------------------
function installDock(game) {
    let dock = game.querySelector('#hm-dock');
    if (!dock) {
        dock = mobileNode('div',null,game);
        dock.id = 'hm-dock';
        dock.setAttribute('role','toolbar');
        dock.setAttribute('aria-label','Ações da partida');
    }
    if (!dock.querySelector('#hm-chat-toggle')) {
        const chat = hmIconButton(dock,'chat','Chat',toggleMobileChat);
        chat.id = 'hm-chat-toggle';
        chat.setAttribute('aria-expanded','false');
        const badge = mobileNode('span','0',chat);
        badge.className = 'hm-chat-badge hm-badge';
        badge.hidden = true;
    }
    if (!dock.querySelector('#hm-players-toggle')) {
        const players = hmIconButton(dock,'users','Jogadores e times',openPlayersMenu);
        players.id = 'hm-players-toggle';
    }
    if (!dock.querySelector('#hm-quick-toggle')) {
        const menu = hmIconButton(dock,'menu','Abrir menu da partida',()=>{mobilePanelOpen?closeMobilePanel():openQuickMenu();});
        menu.id = 'hm-quick-toggle';
        menu.setAttribute('aria-expanded','false');
    }
    return dock;
}

// ---------------------------------------------------------------------------
// Câmera inteligente — matemática pura (testável de forma isolada)
// ---------------------------------------------------------------------------
// ==CAM-MATH==
function hmCamClamp(value, min, max) { return value < min ? min : value > max ? max : value; }
function hmCamRect(x, y, w, h) { return {x:x,y:y,w:w,h:h,cx:x+w/2,cy:y+h/2}; }
// Quanto o ponto (x,y) está dentro do retângulo expandido por 'pad' (0 = fora).
function hmCamDepth(x, y, rect, pad) {
    pad = pad || 0;
    const left = rect.x - pad, top = rect.y - pad, right = rect.x + rect.w + pad, bottom = rect.y + rect.h + pad;
    if (x <= left || x >= right || y <= top || y >= bottom) return 0;
    return Math.min(x - left, right - x, y - top, bottom - y);
}
// Ponto livre mais próximo fora do retângulo, puxando na direção do centro da tela.
function hmCamFreePoint(x, y, rect, pad, view) {
    pad = pad || 0;
    const left = rect.x - pad, right = rect.x + rect.w + pad;
    const top = rect.y - pad, bottom = rect.y + rect.h + pad;
    const toCenterX = (view.w / 2) - x, toCenterY = (view.h / 2) - y;
    let fx = x, fy = y;
    if (Math.abs(toCenterX) >= Math.abs(toCenterY)) fx = toCenterX >= 0 ? right : left;
    else fy = toCenterY >= 0 ? bottom : top;
    return {x:fx,y:fy};
}
// Resolve o deslocamento de tela desejado. Puro: mesmas entradas = mesma saída.
function hmCamResolve(input) {
    const out = {dx:0,dy:0,active:false,guarded:false,reason:'idle'};
    if (!input) return out;
    const mode = input.mode || 'off';
    if (mode === 'off') { out.reason='off'; return out; }
    const view = input.view || {w:1,h:1};
    const strength = hmCamClamp(Number(input.strength == null ? .6 : input.strength), 0, 1);
    const dt = hmCamClamp(Number(input.dt) || 1/60, 1/240, 1/15);
    const prev = input.prev || {dx:0,dy:0};
    const zones = Array.isArray(input.zones) ? input.zones : [];
    const maxShiftX = view.w * (input.maxShiftX == null ? .16 : input.maxShiftX);
    const maxShiftY = view.h * (input.maxShiftY == null ? .14 : input.maxShiftY);
    const pad = input.pad == null ? 26 : input.pad;
    const player = input.player;

    let targetX = 0, targetY = 0;
    if (mode === 'fixed') {
        // Sem localização: empurra o conteúdo para longe do canto do controle.
        const zone = zones[0];
        if (zone) {
            targetX = (zone.cx < view.w / 2 ? 1 : -1) * view.w * .05 * strength;
            targetY = (zone.cy < view.h / 2 ? .35 : -.5) * view.h * .05 * strength;
        }
    } else if (mode === 'smart' && player) {
        let zone = null, depth = 0;
        for (const candidate of zones) {
            const d = hmCamDepth(player.x, player.y, candidate, pad);
            if (d > depth) { depth = d; zone = candidate; }
        }
        // Histerese: mantém o deslocamento até sair completamente da zona.
        const sticky = input.prevActive ? (zone = zones.find(z => hmCamDepth(player.x, player.y, z, pad + 12) > 0) || null) : null;
        const activeZone = zone || sticky;
        if (activeZone) {
            const free = hmCamFreePoint(player.x, player.y, activeZone, pad, view);
            targetX = free.x - player.x;
            targetY = free.y - player.y;
            out.active = true;
            out.reason = 'occluded';
            // Deslocamento proporcional à intensidade (nunca salta direto).
            targetX *= strength; targetY *= strength;
        } else if (input.prevActive) {
            out.reason = 'release';
        }
    } else if (mode === 'smart') {
        // Sem posição do jogador: comportamento fixo reduzido.
        const zone = zones[0];
        if (zone) {
            targetX = (zone.cx < view.w / 2 ? 1 : -1) * view.w * .03 * strength;
            targetY = -.35 * view.h * .03 * strength;
        }
        out.reason = 'no-player';
    }
    targetX = hmCamClamp(targetX, -maxShiftX, maxShiftX);
    targetY = hmCamClamp(targetY, -maxShiftY, maxShiftY);

    // A bola tem prioridade de visibilidade.
    const ball = input.ball;
    if (ball && (targetX || targetY)) {
        const marginX = view.w * .08, marginY = view.h * .12;
        const minX = marginX - ball.x, maxX = view.w - marginX - ball.x;
        const minY = marginY - ball.y, maxY = view.h - marginY - ball.y;
        const allowedX = hmCamClamp(targetX, minX, maxX);
        const allowedY = hmCamClamp(targetY, minY, maxY);
        if (allowedX !== targetX || allowedY !== targetY) out.guarded = true;
        targetX = allowedX; targetY = allowedY;
    }

    // Mola criticamente amortecida (estável, sem overshoot).
    const omega = 7 + strength * 9;
    const alpha = 1 - Math.exp(-omega * dt);
    out.dx = prev.dx + (targetX - prev.dx) * alpha;
    out.dy = prev.dy + (targetY - prev.dy) * alpha;
    if (Math.abs(out.dx) < .05) out.dx = 0;
    if (Math.abs(out.dy) < .05) out.dy = 0;
    return out;
}
// ==/CAM-MATH==

const hmCam = {
    mode: 'off', strength: .6, mark: true, ready: false, hooked: false, bias: false,
    canvas: null, ctx: null, dpr: 1, world: null, ball: null, seen: 0,
    player: null, ballScreen: null, playerScreen: null,
    dx: 0, dy: 0, active: false, guarded: false,
    zones: [], raf: 0, lastT: 0, lostAt: 0, markEl: null, cssOnly: false, frames: 0, startedAt: 0
};

function hmCamCanvas() {
    try {
        const doc = gameFrame.document;
        return doc && typeof doc.querySelector === 'function' ? doc.querySelector('canvas') : null;
    } catch { return null; }
}
function hmCamSetBias(on) {
    hmCam.bias = !!on;
    if (!hmCam.bias && hmCam.canvas) hmCam.canvas.style.transform = '';
}
function hmCamInstall() {
    if (hmCam.hooked) return hmCam.ready;
    const canvas = hmCamCanvas();
    if (!canvas) return false;
    hmCam.canvas = canvas;
    const Ctor = gameFrame.CanvasRenderingContext2D;
    const proto = Ctor && Ctor.prototype;
    if (!proto || typeof proto.setTransform !== 'function' || proto.__hmMatrix__) {
        hmCam.cssOnly = true; hmCam.ready = true; hmCam.hooked = true;
        return true;
    }
    const original = { setTransform: proto.setTransform, arc: proto.arc, drawImage: proto.drawImage, translate: proto.translate, fill: proto.fill };
    proto.__hmMatrix__ = true;
    proto.setTransform = function (a, b, c, d, e, f) {
        if (this === hmCam.ctx || this.canvas === hmCam.canvas) {
            hmCam.world = { a, b, c, d, e, f };
            hmCam.seen++;
            // Só desloca transformações de mundo puras (escala + translação).
            if (hmCam.bias && Math.abs(b) < 1e-6 && Math.abs(c) < 1e-6 && a > 0 && d > 0) {
                return original.setTransform.call(this, a, b, c, d,
                    e + hmCam.dx * hmCam.dpr, f + hmCam.dy * hmCam.dpr);
            }
        }
        return original.setTransform.call(this, a, b, c, d, e, f);
    };
    proto.translate = function (x, y) {
        // Se o jogo posiciona a câmera via setTransform, deslocar translate duplicaria o viés.
        if (hmCam.bias && !hmCam.seen && (this === hmCam.ctx || this.canvas === hmCam.canvas)) {
            return original.translate.call(this, x + hmCam.dx * hmCam.dpr, y + hmCam.dy * hmCam.dpr);
        }
        return original.translate.call(this, x, y);
    };
    proto.arc = function (x, y, r) {
        try {
            if (this.canvas === hmCam.canvas) hmCamReadArc(this, x, y, r);
        } catch {}
        return original.arc.apply(this, arguments);
    };
    hmCam.ready = true;
    hmCam.hooked = true;
    hmCam.ctx = null;
    return true;
}
function hmCamParseColor(style) {
    if (typeof style !== 'string') return null;
    let match = /^#([0-9a-f]{6})$/i.exec(style);
    if (match) {
        const value = parseInt(match[1], 16);
        return [value >> 16 & 255, value >> 8 & 255, value & 255];
    }
    match = /^#([0-9a-f]{3})$/i.exec(style);
    if (match) {
        const value = match[1];
        return [parseInt(value[0] + value[0], 16), parseInt(value[1] + value[1], 16), parseInt(value[2] + value[2], 16)];
    }
    match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(style);
    if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
    if (/^white$/i.test(style)) return [255, 255, 255];
    return null;
}
// A bola do HaxBall é o disco claro e pequeno. Guardamos o candidato mais próximo
// do quadro anterior para manter o rastreio estável.
function hmCamReadArc(ctx, x, y, r) {
    if (!(r > 2)) return;
    const matrix = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    if (!matrix) return;
    const scale = Math.abs(matrix.a) || 1;
    const screenRadius = r * scale / hmCam.dpr;
    if (screenRadius < 2 || screenRadius > 26) return;
    const color = hmCamParseColor(ctx.fillStyle);
    if (!color || color[0] < 195 || color[1] < 195 || color[2] < 195) return;
    const sx = (x * matrix.a + matrix.e) / hmCam.dpr;
    const sy = (y * matrix.d + matrix.f) / hmCam.dpr;
    const previous = hmCam.ballScreen;
    const distance = previous ? Math.hypot(sx - previous.x, sy - previous.y) : 0;
    if (!previous || distance < Math.max(60, screenRadius * 6)) {
        hmCam.ballScreen = { x: sx, y: sy, r: screenRadius };
        hmCam.lostAt = 0;
    }
}
function hmCamZoneCache() {
    const now = performance.now();
    if (now - (hmCam.zoneAt || 0) < 400 && hmCam.zones.length) return hmCam.zones;
    hmCam.zoneAt = now;
    const zones = [];
    for (const id of ['joystick','kick']) {
        // Os controles vivem no documento pai; o canvas, no iframe do jogo.
        const el = document.getElementById(id) || gameFrame.document.getElementById(id);
        if (!el || typeof el.getBoundingClientRect !== 'function') continue;
        const rect = el.getBoundingClientRect();
        if (!rect || !rect.width) continue;
        zones.push(hmCamRect(rect.left, rect.top, rect.width, rect.height));
    }
    if (zones.length) hmCam.zones = zones;
    return hmCam.zones;
}
function hmCamEstimatePlayer() {
    if (!hmCam.world) return null;
    const canvas = hmCam.canvas;
    const world = hmCam.world;
    const deviceW = canvas.width || 1, deviceH = canvas.height || 1;
    if (!world.a || !world.d) return null;
    const centerX = (deviceW / 2 - world.e) / world.a;
    const centerY = (deviceH / 2 - world.f) / world.d;
    const ball = hmCam.ballScreen;
    let playerX, playerY;
    if (ball) {
        // cameraFollow padrão = média entre jogador e bola; invertemos a média.
        const ballWorldX = (ball.x * hmCam.dpr - world.e) / world.a;
        const ballWorldY = (ball.y * hmCam.dpr - world.f) / world.d;
        playerX = 2 * centerX - ballWorldX;
        playerY = 2 * centerY - ballWorldY;
    } else {
        return null;
    }
    const screenX = (playerX * world.a + world.e) / hmCam.dpr;
    const screenY = (playerY * world.d + world.f) / hmCam.dpr;
    const width = canvas.clientWidth || deviceW / hmCam.dpr;
    const height = canvas.clientHeight || deviceH / hmCam.dpr;
    if (!(screenX > -width * .3 && screenX < width * 1.3 && screenY > -height * .3 && screenY < height * 1.3)) return null;
    return { x: screenX, y: screenY };
}
function hmCamUpdateMark() {
    if (!hmCam.mark || !hmCam.playerScreen) {
        if (hmCam.markEl) hmCam.markEl.hidden = true;
        return;
    }
    if (!hmCam.markEl) {
        hmCam.markEl = gameFrame.document.createElement('div');
        hmCam.markEl.id = 'hm-player-mark';
        hmCam.markEl.setAttribute('aria-hidden','true');
        gameFrame.document.body.appendChild(hmCam.markEl);
    }
    hmCam.markEl.hidden = !hmCam.active;
    hmCam.markEl.style.left = (hmCam.playerScreen.x + hmCam.dx) + 'px';
    hmCam.markEl.style.top = (hmCam.playerScreen.y + hmCam.dy) + 'px';
}
function hmCamTick(timestamp) {
    hmCam.raf = 0;
    if (hmCam.mode === 'off') return;
    hmCam.raf = requestAnimationFrame(hmCamTick);
    if (!hmCam.canvas || !controlsVisible || !isPlayingView()) {
        if (hmCam.dx || hmCam.dy) { hmCam.dx = 0; hmCam.dy = 0; }
        hmCamUpdateMark();
        return;
    }
    const canvas = hmCam.canvas;
    hmCam.dpr = canvas.width && canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    const width = canvas.clientWidth || gameFrame.innerWidth || 1;
    const height = canvas.clientHeight || gameFrame.innerHeight || 1;
    const now = timestamp || performance.now();
    const dt = hmCam.lastT ? Math.min(.05, (now - hmCam.lastT) / 1000) : 1/60;
    hmCam.lastT = now;
    hmCam.frames++;

    const player = hmCam.mode === 'smart' ? hmCamEstimatePlayer() : null;
    hmCam.playerScreen = player;
    if (player) hmCam.fallback = false;
    if (hmCam.mode === 'smart' && !player && hmCam.seen > 0 && hmCam.frames > 120 && !hmCam.ballScreen) {
        // Sem rastreio confiável: cai para o deslocamento fixo reduzido.
        hmCam.fallback = true;
    }
    const result = hmCamResolve({
        mode: hmCam.mode === 'smart' && hmCam.fallback ? 'fixed' : hmCam.mode,
        strength: hmCam.strength,
        dt,
        prev: { dx: hmCam.dx, dy: hmCam.dy },
        prevActive: hmCam.active,
        player, ball: hmCam.ballScreen,
        zones: hmCamZoneCache(),
        view: { w: width, h: height },
        pad: Math.max(20, Math.min(width, height) * .07)
    });
    hmCam.dx = result.dx; hmCam.dy = result.dy;
    hmCam.active = result.active; hmCam.guarded = result.guarded;

    if (hmCam.cssOnly) {
        // Sem acesso ao renderer: deslocamento por CSS, limitado para não revelar borda.
        const maxX = width * .045, maxY = height * .05;
        canvas.style.transform =
            'translate3d(' + hmCamClamp(hmCam.dx, -maxX, maxX).toFixed(2) + 'px,' +
            hmCamClamp(hmCam.dy, -maxY, maxY).toFixed(2) + 'px,0)';
    }
    hmCamUpdateMark();
    // Auto-proteção: se o quadro ficar pesado, reduz a intensidade.
    if (dt > .035 && hmCam.strength > .25) hmCam.strength = Math.max(.25, hmCam.strength - .02);
}
function hmCamStart() {
    if (hmCam.raf) return;
    if (!hmCamInstall()) return;
    hmCam.startedAt = performance.now();
    hmCamSetBias(!hmCam.cssOnly);
    hmCam.raf = requestAnimationFrame(hmCamTick);
}
function hmCamStop() {
    if (hmCam.raf) cancelAnimationFrame(hmCam.raf);
    hmCam.raf = 0;
    hmCam.dx = 0; hmCam.dy = 0; hmCam.active = false;
    hmCamSetBias(false);
    if (hmCam.markEl) hmCam.markEl.hidden = true;
}
function applyCameraSettings() {
    try {
        if (typeof gameFrame === 'undefined' || !gameFrame || !gameFrame.document ||
            typeof gameFrame.document.querySelector !== 'function') return;
        const enabled = getSetting('cameraEnabled');
        const mode = getSetting('cameraMode') || 'smart';
        hmCam.mode = enabled === false || mode === 'off' ? 'off' : (mode === 'fixed' ? 'fixed' : 'smart');
        hmCam.strength = hmCamClamp(Number(getSetting('cameraStrength') == null ? .6 : getSetting('cameraStrength')), .15, 1);
        hmCam.mark = getSetting('playerMark') !== false;
        hmCam.fallback = false;
        if (hmCam.mode === 'off') { hmCamStop(); return; }
        hmCamStart();
    } catch (error) {
        try { console.warn('HAXMOBILE: câmera indisponível: ' + (error && error.message)); } catch {}
    }
}
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
    const hint=mobileNode('p','Toque para opções. Segure o nome e arraste para outro time.',room.querySelector('.container'));
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
    button.setAttribute('aria-label','Chat'+(mobileChatUnread?', '+mobileChatUnread+' mensagens não lidas':''));
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
        const button=hmIconButton(game,'chat','Chat',toggleMobileChat);button.id='hm-chat-toggle';
        const badge=mobileNode('span','0',button);badge.className='hm-chat-badge hm-badge';badge.hidden=true;
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
