document.head.appendChild(Object.assign(document.createElement("style"), { innerHTML: "#thumb,body{touch-action:none}body{user-select:none;height:100%}@media only screen and (max-device-width:480px){body{touch-action:manipulation}}.header,.rightbar{display:none!important}.rounded{border:none;border-radius:50%}[view|=hidden]{display:none}[view|=visible]{display:flex;justify-content:center;align-items:center}[float]{position:absolute}svg{fill:#ecf0f3cc;width:30px;height:auto}#kick svg{width:50%}" }));
document.querySelector('.gameframe').contentWindow.document.head.appendChild(Object.assign(document.createElement("style"), { innerHTML: ".room-view,.roomlist-view{height:100%;margin-top:0}.game-view>.top-section,.room-view{margin-top:0}.settings-view{width:100%;max-height:none}.game-view>[data-hook=popups]{background-color:#1a212585}.disconnected-view .dialog,.disconnected-view .room-view>.container{width:450px}.create-room-view>.dialog,.room-view.create-room-view>.container{max-width:450px;width:100%}body{background:#1a2125}[data-hook=leave-btn]{background:#c13535!important}.file-btn,[data-hook=rec-btn]{display:none!important}.network-view,.graph-view,[data-hook=network]{display:block!important}h1{text-align:center}.room-view>.container>.header-btns{bottom:0;right:10px;top:auto}.room-view>.container{max-width:none;max-height:max-content}.room-view{position:absolute;width:100%}.roomlist-view>.dialog{max-width:max-content;max-height:max-content}.game-state-view .bar>.scoreboard{display:flex;align-items:center;margin-right:50px}.chatbox-view{position:absolute;left:15px;margin:0;top:10px;width:30%;pointer-events:none;font-size:1rem;display:contents}.chatbox-view-contents{flex-direction:column-reverse;background:0 0;pointer-events:none}.chatbox-view-contents>.input{margin-bottom:10px;pointer-events:auto}.chatbox-view-contents>.log{flex-direction:column;pointer-events:none;overflow-y:scroll;scrollbar-width:none}.settings-view .section.selected{display:flex;align-items:center}.log-contents{display:flex;flex-direction:column-reverse}.log-contents > *{display:inline-block;max-width:fit-content;text-shadow:1px 1px 5px #000000cc}.fade-out{opacity:0;transition:opacity 10s ease-out}thead tr{display:table-row!important}svg{width: 1em}.input-options{position: absolute;width: 100%;height: 100%;z-index: 20;background-color: #1a2125;}" }));

if(!localStorage.getItem('low_latency_canvas') || localStorage.getItem('low_latency_canvas') == 1){
    localStorage.setItem('low_latency_canvas',0)
    location.reload();
}

///////////////////////////////////////// CONSTANTS /////////////////////////////////////////
let gameFrame = document.querySelector('.gameframe').contentWindow;
let body;

const roomLayoutStyle = document.createElement('style');
roomLayoutStyle.textContent = [
    '.room-view{height:100%;margin-top:0;padding:6px;box-sizing:border-box}',
    '.room-view>.container{height:100%;max-height:100%;padding-bottom:10px;overflow-y:auto;overflow-x:hidden}',
    '.room-view>.container>.header-btns{position:static;align-self:flex-end;flex-shrink:0}',
    '.room-view>.container>.teams{flex:1 0 120px;min-height:120px}',
    '.room-view>.container>.teams .player-list-view{flex:1;min-width:0;width:auto}',
    '.room-view>.container>.teams .player-list-view .list{min-height:80px;touch-action:pan-y;overscroll-behavior:contain}'
].join('');
gameFrame.document.head.appendChild(roomLayoutStyle);


const tips = [
    'Dica: salas mais pr\u00f3ximas costumam ter menor lat\u00eancia.',
    'Dica: ajuste os controles em Cliente para jogar com conforto.',
    'Dica: salve um perfil para cada aparelho ou estilo de jogo.',
    'Dica: favoritos ficam dispon\u00edveis no bot\u00e3o Salas.',
    'Dica: use o editor do HUD para escolher o lado dos controles.'
];

const constrolsStyleBase = "#joystick,#kick{z-index:100;bottom:CONTROLS_MARGINvw}.neo{opacity:CONTROLS_OPACITY;background-color:#c2c2c255;box-shadow:6px 6px 10px 0 #a5abb133,-5px -5px 9px 0 #a5abb133;color:#dedede55;font-weight:bolder;font-size:1.5rem}.sizer{width:CONTROLS_WIDTH%;aspect-ratio: 1 / 1;}#joystick{left:CONTROLS_MARGIN%;overflow:visible}#thumb{width:40%;height:40%;background-color:#ecf0f3cc}#kick{right:CONTROLS_MARGIN%}button.neo:active{opacity:KICK_OPACITY}";

const countryFilterHandler = document.createElement('style');
const hideButtons = document.createElement('style');

hideButtons.innerHTML = "button{display:none}";
gameFrame.document.head.appendChild(hideButtons);

const controlsHandler = document.createElement('style');

const copyrightHandler = document.createElement("span");

const aboutHandler = document.createElement("div");

const inputOptionsHandler = document.createElement("div");

const config = { childList: true, subtree: false };

///////////////////////////////////////// VARIABLES /////////////////////////////////////////

let firstTime = true;
let canResetJoystick = true;
const seenChatMessages = new WeakSet();
let joystick;
let kickButton;
let isTouching = false;
let joystickTouchId = null;
let chatHistory = [];
let controlsVisible = false;
let mobilePanelOpen = false;
let chatFocused = false;
let hudEditing = false;
const kickSources = new Set();
const macroTimers = new Map();

///////////////////////////////////////// SETTINGS /////////////////////////////////////////

const defaultSettings = {
    vibration: true,
    macros: true,
    theme: 'dark',
    chatSize: 1,
    chatBg: true,
    chatCascade: false,
    joystickMode: 'fixed',
    sensitivity: 1,
    deadZone: 0.15,
    controlsOpacity: 1,
    fieldView: 1,
    showPing: false,
    showFps: false,
    interfaceOpacity: .88,
    menuScale: 1,
    textScale: 1,
    chatOpacity: .7,
    immersive: false,
    animations: 'full',
    autoHideChat: true,
    chatHideDelay: 8,
    cameraEnabled: true,
    cameraMode: 'smart',
    cameraStrength: 0.6,
    playerMark: true,
    hudDensity: 'comfortable'
};

function getSetting(key) {
    const saved = localStorage.getItem('hm_settings');
    const parsed = readStored('hm_settings', defaultSettings);
    const settings = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : defaultSettings;
    return settings[key] !== undefined ? settings[key] : defaultSettings[key];
}

function setSetting(key, value) {
    const saved = localStorage.getItem('hm_settings');
    const settings = { ...defaultSettings, ...readStored('hm_settings', {}) };
    settings[key] = value;
    localStorage.setItem('hm_settings', JSON.stringify(settings));
    if (key === 'controlsOpacity') {
        const controls = readStored('controls', [20,5,1]);
        controls[2] = value;
        localStorage.setItem('controls', JSON.stringify(controls));
    }
    applySettings();
    if(key === 'chatCascade')updatedChat();
}

const themes = {
    light: {bg:'#edf2f7',accent:'#08795d',text:'#172738'},
    auto: {bg:'#111820',accent:'#57d6ad',text:'#edf3f9'},
    dark:   { bg: '#1a2125', accent: '#c13535', text: '#ecf0f3' },
    blue:   { bg: '#0d1b2a', accent: '#1e90ff', text: '#e0f0ff' },
    green:  { bg: '#0f1f15', accent: '#2ecc71', text: '#d5f5e3' },
    purple: { bg: '#1a0f2e', accent: '#9b59b6', text: '#e8d5f5' },
    black:  { bg: '#0a0a0a', accent: '#ff4444', text: '#ffffff' }
};

const themeStyleHandler = document.createElement('style');
document.head.appendChild(themeStyleHandler);
const themeGameStyleHandler = document.createElement('style');

function applySettings() {
    const themeKey = getSetting('theme') === 'auto' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : getSetting('theme');
    const theme = themes[themeKey] || themes.dark;
    const chatSize = getSetting('chatSize');
    const chatBg = getSetting('chatBg');

    themeStyleHandler.innerHTML = `body { background: var(--hm-bg, ${theme.bg}) !important; }`;
    themeGameStyleHandler.innerHTML = `
        body { background: var(--hm-bg, ${theme.bg}) !important; }
        .game-view>[data-hook=popups] { background-color: transparent !important; }
        [data-hook=leave-btn] { background: ${theme.accent} !important; }
        .chatbox-view { font-size: ${chatSize}rem !important; }
        .log-contents > * { ${chatBg ? 'background: #00000066; padding: 2px 6px; border-radius: 4px; margin-bottom: 2px; display: inline-block; max-width: fit-content;' : 'display: inline-block; max-width: fit-content;'} }
        h1 { color: ${theme.text} !important; }
    `;

    try {
        gameFrame.document.head.appendChild(themeGameStyleHandler);
    } catch {}

    // Mostrar/esconder botões de macro
    if (!getSetting('macros')) {
        cancelKickMacro('double');
        cancelKickMacro('fake');
    }
    showControls(controlsVisible);
    applyMobileSettings();
}


///////////////////////////////////////// MAIN /////////////////////////////////////////

var checkLoaderInterval = setInterval(checkLoader, 1000);

function checkLoader() {
    if (!gameFrame.document.body.querySelector(".loader-view") && gameFrame.document.body.querySelector('.choose-nickname-view, .roomlist-view, .room-view')) {
        clearInterval(checkLoaderInterval);
        body = gameFrame.document.body.children[0];
        init();
    }
}

function init() {
    //Remove ads and header
    document.querySelector('.rightbar')?.remove();
    document.querySelector('.header')?.remove();

    document.querySelector("meta[name=viewport]").setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=0');

    //const viewportTag = document.createElement('meta');
    //viewportTag.name = 'viewport';
    //viewportTag.content = 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=0';
    //gameFrame.document.head.appendChild(viewportTag);

    setupCountryFilter();
    setupControls();
    setupCopyright(true);
    setupSettingsMenu();
    applySettings();
    hideButtons.remove();

    //Mutation observer
    let uiDebounce = null;
    const observer = new MutationObserver(function() {
        if (controlsVisible && !isPlayingView()) {
            showControls(false);
            canResetJoystick = true;
        }
        // Native ping updates can be continuous: schedule once instead of postponing forever.
        if (uiDebounce === null) uiDebounce = setTimeout(() => {
            uiDebounce = null;
            try { updateUI(); } catch (error) { console.error('HAXMOBILE: Falha na interface: ' + error.message); }
        }, 100);
        try { updatedChat(); } catch {}
    });
    try { updateUI() } catch {}
    observer.observe(body, { childList: true, subtree: true });


    aboutHandler.setAttribute('data-hook', 'about');
    aboutHandler.style.cssText = 'background: #1a2125; position: absolute; width: 100%; height: 100%; display: none; justify-content: center; flex-direction: column; align-items: center; margin: 0;';
    aboutHandler.innerHTML = '<div class="dialog basic-dialog"><h1>HaxBall Mobile</h1><p>Jogo original: Mario Carbajal (@basro). Mobile original: Vixel Dev.</p><button data-hook="closeabout">Fechar</button></div>';

    body.parentNode.appendChild(aboutHandler);
    if (localStorage.getItem("firstTime") === null) {
        aboutHandler.style.display = 'none';
        localStorage.setItem("firstTime", true)
        localStorage.setItem("view_mode", 1)
        localStorage.setItem("resolution_scale", 0.75)
    }
    body.parentNode.querySelector('[data-hook="closeabout"]').addEventListener("click", function() {
        aboutHandler.style.display = 'none';
    });

    // Registrar gamepad após gameFrame estar pronto
    registerGamepadListeners(window);
    try { registerGamepadListeners(gameFrame); } catch {}
    setTimeout(() => {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < pads.length; i++) {
            if (pads[i]) {
                gamepadIndicator.textContent = '🎮 Controle detectado';
                gamepadIndicator.style.display = 'block';
                setTimeout(() => { gamepadIndicator.style.display = 'none'; }, 2000);
                startGamepadLoop(i);
                break;
            }
        }
    }, 500);

    console.log("PAGE_LOADED")
}

///////////////////////////////////////// UTILS /////////////////////////////////////////

function insertAfter(e, n) {
    e.parentNode.insertBefore(n, e.nextSibling);
}

function pickRandom(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
        return null; // Return null for invalid input or empty array
    }

    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
}

function getByDataHook(dataHook) {
    return body.querySelector('[data-hook="' + dataHook + '"]');
}

function openHaxballURL(uri) {
    const url = canonicalRoomUrl(uri);
    if (!url) { mobileNotice('Link de sala invalido.'); return; }
    goToRoom({name:'Sala compartilhada',url});
}

function searchRoomlist() {
    filterMobileRooms();
}

///////////////////////////////////////// UI /////////////////////////////////////////


function setupCountryFilter() {
    countryFilterHandler.innerHTML = "";
    countryFilterHandler.name = "stylesheet";
    gameFrame.document.head.appendChild(countryFilterHandler);
}

function setupCopyright() {
    copyrightHandler.setAttribute("data-hook", "copyright");
    copyrightHandler.setAttribute("style", "text-align:center;position:absolute;bottom:15px;width:100%; display: block");
    copyrightHandler.innerHTML = '2024 Vixel Dev. Original game by Mario Carbajal (@basro)';
    document.body.appendChild(copyrightHandler);
}

function copyright(s) {
    copyrightHandler.style.display = s ? "block" : "none";
}

function updateUI() {
    if (!isPlayingView()) {
        showControls(false);
        canResetJoystick = true;
    }
    if (body.querySelector('.choose-nickname-view')) {
        //Chose nickname
        showControls(false);
        copyright(true);
        console.log("PAGE_LOADED")
    }
    if (body.querySelector('.roomlist-view')) {
        //Roomlist
        copyright(false);
        firstTime = true;
        if (!getByDataHook('search')) createSearchbar();
        if (!getByDataHook('url-room')) createURLButton();
        if (!getByDataHook('fil-cou')) createCountryButton();
        if (!getByDataHook('aboutbtn')) createAboutButton();
        if (!getByDataHook('settingsbtn')) createSettingsButton();
        if (getByDataHook('count')) getByDataHook('count').remove();
        showControls(false);
    } else if (body.querySelector('.create-room-view')) {
        //Create room
        copyright(true);
        showControls(false);
    } else if (body.querySelector('.settings-view')) {
        //Settings
        copyright(false);
        if (inputOptionsHandler.getAttribute("hidden") != null) {
            showControls(false);
        }
        try {
            const videoSec = getByDataHook('videosec')
            if (videoSec.children.length == 10) {
                videoSec.lastChild.remove();
                videoSec.lastChild.remove();
                videoSec.lastChild.remove();
            }
        } catch {}
        if (!getByDataHook('newinputbtn')) createInputButton();
        canResetJoystick = true;
    } else if (body.querySelector('.g-recaptcha-response')) {
        //Captha
        copyright(false);
        showControls(false);
        resetJoystick();
        canResetJoystick = true;
    } else if (body.querySelector('.game-view') && !body.querySelector('.room-view')) {
        //In game
        if (canResetJoystick) {
            copyright(false);
            showControls(true);
            setupGameUI();
            resetJoystick();
            canResetJoystick = false;
        }
    } else if (body.querySelector('.game-view') && !body.querySelector('.room-link-view')) {
        //Room admin
        copyright(false);
        showControls(false);
        if (!getByDataHook('store')) createStoreButton();
        setupGameUI();
        setupAdminPlayerButtons();
        resetJoystick();
        canResetJoystick = true;
    } else if (body.querySelector('.room-link-view')) {
        showControls(false);
        if (!getByDataHook('share')) createShareButton();
        canResetJoystick = true;
    }
    enhanceMobileUI();
}

function createInputButton() {
    var el = getByDataHook('inputbtn');
    var elClone = el.cloneNode(true);
    elClone.setAttribute("data-hook", "newinputbtn")
    elClone.addEventListener("click", function() {
        showControls(true);
        inputOptionsHandler.removeAttribute("hidden")
        resetJoystick();
    });
    el.parentNode.replaceChild(elClone, el);
}

function createShareButton() {
    let share = document.createElement("button");
    share.setAttribute("data-hook", "share");
    share.innerHTML = 'Compartilhar';
    insertAfter(getByDataHook('copy'), share);
    share.addEventListener("click", function() {
        const url = canonicalRoomUrl(getByDataHook('link').value);
        if (url) window.location.href = 'haxmobile://share-room?url=' + encodeURIComponent(url);
    });
}

function createStoreButton() {
    let store = document.createElement("button");
    store.setAttribute("data-hook", "store");
    store.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 407 407" fill="white" style="height:0.85em; width: auto"><path d="M402 84 323 5c-3-3-7-5-12-5H17C8 0 0 8 0 17v373c0 9 8 17 17 17h373c9 0 17-8 17-17V96c0-4-2-9-5-12zm-101 80H67V39h234v125z"></path><path d="M214 148h43c3 0 6-2 6-6V60c0-4-3-6-6-6h-43c-3 0-6 2-6 6v82c0 4 3 6 6 6z"></path></svg> Store';
    insertAfter(getByDataHook('rec-btn'), store);
    store.addEventListener("click", function() {
        prefabMessage("/store")
    });
}

function setupAdminPlayerButtons() {
    const rows = body.querySelectorAll('tr');
    rows.forEach(row => {
        if (row.querySelector('[data-hook="mod-btns"]')) return; // já tem botões

        const nameSpan = row.querySelector('span[data-hook="name"]');
        if (!nameSpan) return;

        // Pegar o nome do jogador pelo span
        const playerName = nameSpan.textContent.trim();
        if (!playerName) return;

        const btnContainer = document.createElement('span');
        btnContainer.setAttribute('data-hook', 'mod-btns');
        btnContainer.style.cssText = 'display:inline-flex;gap:3px;margin-left:6px;vertical-align:middle';

        // Botão → Time Vermelho
        const redBtn = document.createElement('button');
        redBtn.textContent = '🔴';
        redBtn.title = 'Mover pro vermelho';
        redBtn.style.cssText = 'background:#c1353588;border:none;border-radius:4px;padding:2px 5px;font-size:0.75rem;cursor:pointer;color:#fff;min-width:0';
        redBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            prefabMessage(`!setteam ${playerName} red`);
        });

        // Botão → Time Azul
        const blueBtn = document.createElement('button');
        blueBtn.textContent = '🔵';
        blueBtn.title = 'Mover pro azul';
        blueBtn.style.cssText = 'background:#1e90ff88;border:none;border-radius:4px;padding:2px 5px;font-size:0.75rem;cursor:pointer;color:#fff;min-width:0';
        blueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            prefabMessage(`!setteam ${playerName} blue`);
        });

        // Botão → Spec
        const specBtn = document.createElement('button');
        specBtn.textContent = '👁';
        specBtn.title = 'Mover pro spec';
        specBtn.style.cssText = 'background:#55555588;border:none;border-radius:4px;padding:2px 5px;font-size:0.75rem;cursor:pointer;color:#fff;min-width:0';
        specBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            prefabMessage(`!setteam ${playerName} spec`);
        });

        btnContainer.appendChild(redBtn);
        btnContainer.appendChild(blueBtn);
        btnContainer.appendChild(specBtn);
        nameSpan.appendChild(btnContainer);
    });
}

function createSearchbar() {
    const inputContainer = document.createElement("div");
    inputContainer.className = "label-input";
    inputContainer.style.backgroundColor = "transparent";

    inputContainer.innerHTML = '<label>Buscar sala:</label><input data-hook="search" type="text">';

    const dialog = body.querySelector("div.dialog");
    const secondParagraph = dialog.querySelector("p:nth-child(2)");

    insertAfter(secondParagraph, inputContainer);

    secondParagraph.innerHTML = pickRandom(tips);

    const input = inputContainer.querySelector('input');
    input.addEventListener("input", searchRoomlist);
}

function createURLButton() {
    let button = document.createElement("button");
    button.setAttribute("data-hook", "url-room");
    button.innerHTML = '<i class="icon-link"></i><div>Link da sala</div>';

    button.addEventListener("click", function() {
        if (!body.querySelector('[data-hook="input-url"]')) {
            let urlForm = document.createElement("form");
            urlForm.action = "javascript:void(0);";
            urlForm.innerHTML = '<div class="label-input" style="background-color: transparent"><label>URL:</label><input data-hook="input-url" type="url"></div>';
            insertAfter(body.querySelector("div.dialog > p:nth-child(2)"), urlForm)
            getByDataHook('search').parentNode.style.display = "none";
            getByDataHook('input-url').focus();
            getByDataHook('input-url').addEventListener('blur', function() {
                getByDataHook('search').parentNode.style.display = "flex";
                urlForm.remove()
            })
            urlForm.addEventListener('submit', function() { openHaxballURL(getByDataHook('input-url').value) })
        }
    });
    insertAfter(getByDataHook('join'), button)
}

function createAboutButton() {
    let button = document.createElement("button");
    button.setAttribute("data-hook", "aboutbtn");
    button.innerHTML = '<i class="icon-attention"></i><div>About us</div>';

    button.addEventListener("click", function() {
        openMobileAbout();
    });
    insertAfter(body.querySelector(".buttons .spacer"), button)
}

function createSettingsButton() {
    let button = document.createElement("button");
    button.setAttribute("data-hook", "settingsbtn");
    button.innerHTML = '<i class="icon-cog"></i><div>Mod Settings</div>';
    button.addEventListener("click", function() {
        settingsMenuHandler.style.display = 'flex';
        renderSettingsMenu();
    });
    insertAfter(body.querySelector(".buttons .spacer"), button)
}

const settingsMenuHandler = document.createElement("div");

function setupSettingsMenu() {
    settingsMenuHandler.style.cssText = 'background: #1a2125; position: absolute; width: 100%; height: 100%; display: none; justify-content: center; flex-direction: column; align-items: center; margin: 0; z-index: 999;';
    body.parentNode.appendChild(settingsMenuHandler);
}

function renderSettingsMenu() {
    renderMobileSettings();
}

function filterCountries(button) {
    const geoData = localStorage.getItem('geo_override') || localStorage.getItem('geo');

    if (geoData) {
        const parsedData = JSON.parse(geoData);

        const code = parsedData['code'];

        const iconClass = button.lastChild.getAttribute("class");

        if (iconClass === "icon-cancel") {
            button.lastChild.setAttribute("class", "icon-ok");
            countryFilterHandler.innerHTML = ""
        } else {
            button.lastChild.setAttribute("class", "icon-cancel");
            countryFilterHandler.innerHTML = "tr:not(:has(div.f-" + code + ")){display: none;}";
        }
        getByDataHook('listscroll').scrollTop = 0;
    }
}

function createCountryButton() {
    let button = document.createElement("span");
    button.setAttribute("class", "bool");
    button.setAttribute("data-hook", "fil-cou");
    button.innerHTML = 'Show other countries <i class="icon-ok"></i>';
    countryFilterHandler.innerHTML = "";
    button.addEventListener("click", function() { filterCountries(button) });

    body.querySelector('.filters').prepend(button);
}

function setupGameUI() {
    const chat = body.querySelector('.chatbox-view');

    if (!getByDataHook('chat-toggle')) {
        const button = document.createElement("button");
        button.setAttribute("data-hook", "chat-toggle");
        button.setAttribute("style", "display: flex; justify-content: center; align-items: center;");
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 20 20"><path fill="white" d="M5.8 12.2V6H2C.9 6 0 6.9 0 8v6c0 1.1.9 2 2 2h1v3l3-3h5c1.1 0 2-.9 2-2v-1.82a.943.943 0 0 1-.2.021h-7zM18 1H9c-1.1 0-2 .9-2 2v8h7l3 3v-3h1c1.1 0 2-.899 2-2V3c0-1.1-.9-2-2-2"/></svg>';
        button.addEventListener("click", chatToggle);
        body.querySelector('.sound-button-container').parentNode.prepend(button);
    }

    if (!getByDataHook('chat-history-btn')) {
        const histBtn = document.createElement("button");
        histBtn.setAttribute("data-hook", "chat-history-btn");
        histBtn.setAttribute("style", "display: flex; justify-content: center; align-items: center;");
        histBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="white" d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95L6.64 18.36A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>';
        histBtn.addEventListener("click", openChatHistory);
        body.querySelector('.sound-button-container').parentNode.prepend(histBtn);
    }

    if (firstTime) {
        body.querySelector('.drag').remove();
        const statsViewContainer = body.querySelector('.stats-view-container');
        statsViewContainer.style.cssText = "display: none;";
        getByDataHook('log-contents').firstChild.remove();
        getByDataHook('menu').innerHTML = '<i class="icon-menu"></i>';
        const inputStyle = chat.querySelector('.input').style;
        inputStyle.display = 'none';
        chat.querySelector('input').addEventListener('blur', function() { if(!mobileChatOpen)inputStyle.display = 'none'; });
        firstTime = false;
        setupPingHUD();
    }
}

let pingHudInterval = null;

function setupPingHUD() {
    // The compact HUD reads the native values without moving its graphs over the field.
    clearInterval(pingHudInterval);
}

const chatHistoryPanel = document.createElement("div");
chatHistoryPanel.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:#1a2125ee; z-index:9999; flex-direction:column;';
chatHistoryPanel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#111;flex-shrink:0">
        <span style="color:#ecf0f3;font-weight:bold;font-size:1rem">💬 Histórico do Chat</span>
        <button id="close-chat-history" style="background:#c13535;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:0.9rem">✕ Fechar</button>
    </div>
    <div id="chat-history-list" style="flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:4px;"></div>
`;
document.body.appendChild(chatHistoryPanel);
chatHistoryPanel.querySelector('#close-chat-history').addEventListener('click', () => {
    chatHistoryPanel.style.display = 'none';
});

function openChatHistory() {
    const list = chatHistoryPanel.querySelector('#chat-history-list');
    list.innerHTML = '';
    if (chatHistory.length === 0) {
        list.innerHTML = '<span style="color:#aaa;font-size:0.9rem">Nenhuma mensagem ainda.</span>';
    } else {
        chatHistory.forEach(msg => {
            const el = document.createElement('div');
            el.style.cssText = `color:${msg.color || '#ecf0f3'};font-size:0.95rem;padding:3px 0;border-bottom:1px solid #ffffff11;word-break:break-word;`;
            el.innerHTML = msg.html;
            list.appendChild(el);
        });
        list.scrollTop = list.scrollHeight;
    }
    chatHistoryPanel.style.display = 'flex';
}

///////////////////////////////////////// CHAT /////////////////////////////////////////

function prefabMessage(msg) {
    const chatbox = body.querySelector('.chatbox-view');
    const input = chatbox.querySelector('input');
    input.focus();
    input.value = msg;

    input.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        keyCode: 13,
        which: 13,
    }));
}


function updatedChat() {
    const log=getByDataHook('log'),contents=log?.querySelector('.log-contents') || log?.firstChild;
    if(!contents)return;
    const atBottom=log.scrollHeight-log.clientHeight-log.scrollTop<40;
    const messages=Array.from(contents.children);
    messages.forEach((message,index)=>{
        const visible=mobileChatOpen || !!getSetting('chatCascade')&&index>=messages.length-5;
        const display=visible?'':'none';
        if(message.style.display!==display)message.style.display=display;
        if(seenChatMessages.has(message))return;
        seenChatMessages.add(message);
        chatHistory.push({html:message.innerHTML,color:message.style.color||''});
        if(chatHistory.length>200)chatHistory.shift();
        message.style.opacity=1;message.classList.add('hm-new-message');
        noteMobileChatMessage();
    });
    if(mobileChatOpen&&atBottom)log.scrollTop=log.scrollHeight;
    else if(!mobileChatOpen)log.scrollTop=0;
}
function chatToggle(){toggleMobileChat();}

///////////////////////////////////////// CONTROLS /////////////////////////////////////////

function isPlayingView() {
    return !mobilePanelOpen && !mobileChatOpen && !chatFocused && !!body && !!body.querySelector('.game-view') &&
        !body.querySelector('.room-view, .room-link-view, .settings-view, .create-room-view, .roomlist-view, .choose-nickname-view, .g-recaptcha-response, .game-view>[data-hook=popups] > *');
}

function showControls(v) {
    controlsVisible = Boolean(v && isPlayingView());
    v = controlsVisible;
    if (!v) releaseControls();
    if (hudEditing) return;
    applyMobileSettings();
    if (v) {
        joystick.setAttribute("view", "visible");
        kickButton.setAttribute("view", "visible");
        const macrosOn = getSetting('macros');
        const dbBtn = document.getElementById('dblkick');
        const fkBtn = document.getElementById('fakekick');
        if (dbBtn) dbBtn.setAttribute('view', macrosOn ? 'visible' : 'hidden');
        if (fkBtn) fkBtn.setAttribute('view', macrosOn ? 'visible' : 'hidden');
    } else {
        joystick.setAttribute("view", "hidden");
        kickButton.setAttribute("view", "hidden");
        const dbBtn = document.getElementById('dblkick');
        const fkBtn = document.getElementById('fakekick');
        if (dbBtn) dbBtn.setAttribute('view', 'hidden');
        if (fkBtn) fkBtn.setAttribute('view', 'hidden');
    }
}

function updateControlsSettingsNumbers() {
    let inputs = inputOptionsHandler.querySelectorAll(".option-row");
    inputs[0].children[1].innerHTML = inputs[0].children[2].value;
    inputs[1].children[1].innerHTML = inputs[1].children[2].value;
    inputs[2].children[1].innerHTML = inputs[2].children[2].value;
}

function onControlsSettingsInput() {
    let inputs = inputOptionsHandler.querySelectorAll(".option-row");
    updateControlsOptions(inputs[0].children[2].value, inputs[1].children[2].value, inputs[2].children[2].value)
}

function updateControlsOptions(w, m, o, f = false, syncHud = true) {
    if (f) {
        let inputs = inputOptionsHandler.querySelectorAll(".option-row");
        inputs[0].children[2].value = w;
        inputs[1].children[2].value = m;
        inputs[2].children[2].value = o;
    }
    const settings = { ...defaultSettings, ...readStored('hm_settings', {}) };
    settings.controlsOpacity = Number(o);
    localStorage.setItem('hm_settings', JSON.stringify(settings));
    localStorage.setItem("controls", JSON.stringify([w, m, o]))
    controlsHandler.innerHTML = constrolsStyleBase.replace(/CONTROLS_WIDTH/g, w.toString()).replace(/CONTROLS_MARGIN/g, m.toString()).replace(/CONTROLS_OPACITY/g, o.toString()).replace(/KICK_OPACITY/g, (o / 2).toString());
    if (syncHud) {
        const layout = getHudLayout();
        layout.joystick.size = Number(w);
        layout.kick.size = Number(w);
        saveHudLayout(layout);
        applyHudPositions();
    }
    updateControlsSettingsNumbers();
    resetJoystick();
}

function handleTouchStart(e) {
    if (hudEditing || !controlsVisible) return;
    if (isTouching) return;
    const touch = e.changedTouches[0];
    if (getSetting('joystickMode') === 'floating') positionFloatingJoystick(touch);
    joystickTouchId = touch.identifier;
    isTouching = true;
    updateJoystick(touch);
}

function handleTouchMove(e) {
    if (!isTouching) return;
    const touch = Array.from(e.touches).find(t => t.identifier === joystickTouchId);
    if (touch) updateJoystick(touch);
}

function handleTouchEnd(e) {
    if (e && !Array.from(e.changedTouches).some(t => t.identifier === joystickTouchId)) return;
    isTouching = false;
    joystickTouchId = null;
    restoreFloatingJoystick();
    resetJoystick();
}

function kick(str, source = 'touch') {
    if (str === 'keydown' && (hudEditing || !controlsVisible)) return;
    const wasPressed = kickSources.size > 0;
    if (str === 'keydown') kickSources.add(source);
    else kickSources.delete(source);
    const isPressed = kickSources.size > 0;
    if (wasPressed === isPressed) return;
    try {
        gameFrame.document.dispatchEvent(new KeyboardEvent(isPressed ? 'keydown' : 'keyup', { code: 'KeyX' }));
        if (isPressed && navigator.vibrate && getSetting('vibration')) navigator.vibrate(30);
    } catch {}
}

function cancelKickMacro(source) {
    (macroTimers.get(source) || []).forEach(clearTimeout);
    macroTimers.delete(source);
    kick('keyup', source);
}

function startKickMacro(source, steps) {
    if (hudEditing || !controlsVisible || !getSetting('macros')) return;
    cancelKickMacro(source);
    kick('keydown', source);
    const timers = steps.map(([delay, event], index) => setTimeout(() => {
        kick(event, source);
        if (index === steps.length - 1) macroTimers.delete(source);
    }, delay));
    macroTimers.set(source, timers);
}

function releaseControls() {
    isTouching = false;
    joystickTouchId = null;
    restoreFloatingJoystick();
    Array.from(macroTimers.keys()).forEach(cancelKickMacro);
    kickSources.clear();
    try { gameFrame.document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX' })); } catch {}
    gpIsXPressed = false;
    if (joystick) resetJoystick();
    else emulateKeys('');
}

function updateJoystick(touch) {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = touch.clientX - centerX;
    const deltaY = touch.clientY - centerY;

    const angle = Math.atan2(deltaY, deltaX);
    const distance = Math.hypot(deltaX, deltaY);
    const maxRadius = joystick.clientWidth / 2;
    const clampedDistance = Math.min(maxRadius, distance);

    const thumbX = centerX + clampedDistance * Math.cos(angle);
    const thumbY = centerY + clampedDistance * Math.sin(angle);

    thumb.style.left = thumbX - rect.left - thumb.clientWidth / 2 + 'px';
    thumb.style.top = thumbY - rect.top - thumb.clientHeight / 2 + 'px';

    const deadZone = Number(getSetting('deadZone'));
    const sensitivity = Number(getSetting('sensitivity'));
    const normalized = Math.min(clampedDistance / maxRadius * sensitivity, 1);

    if (normalized < deadZone) {
        emulateKeys("");
        return;
    }

    const angleInDegrees = (angle * 180 / Math.PI + 360) % 360;
    const diagonalThreshold = 30;

    let keys = "";
    // Horizontal
    if (angleInDegrees < 90 - diagonalThreshold || angleInDegrees > 270 + diagonalThreshold) keys += "d";
    else if (angleInDegrees > 90 + diagonalThreshold && angleInDegrees < 270 - diagonalThreshold) keys += "a";
    // Vertical
    if (angleInDegrees > 360 - (90 - diagonalThreshold) || angleInDegrees < 90 - diagonalThreshold) {} // só horizontal
    if (angleInDegrees > diagonalThreshold && angleInDegrees < 180 - diagonalThreshold) keys += "s";
    else if (angleInDegrees > 180 + diagonalThreshold && angleInDegrees < 360 - diagonalThreshold) keys += "w";

    emulateKeys(keys);
}

function resetJoystick() {
    const rect = joystick.getBoundingClientRect();
    thumb.style.left = joystick.clientWidth / 2 - thumb.clientWidth / 2 + 'px';
    thumb.style.top = joystick.clientHeight / 2 - thumb.clientHeight / 2 + 'px';
    emulateKeys("")
}

function emulateKeys(str) {
    if (str && (hudEditing || !controlsVisible)) return;
    let keys = { "w": "keyup", "a": "keyup", "s": "keyup", "d": "keyup" }
    for (var i = 0; i < str.length; i++) {
        var char = str[i];
        keys[char] = "keydown";
    }
    try {
        gameFrame.document.dispatchEvent(new KeyboardEvent(keys['w'], { code: "KeyW" }));
        gameFrame.document.dispatchEvent(new KeyboardEvent(keys['a'], { code: "KeyA" }));
        gameFrame.document.dispatchEvent(new KeyboardEvent(keys['s'], { code: "KeyS" }));
        gameFrame.document.dispatchEvent(new KeyboardEvent(keys['d'], { code: "KeyD" }));
    } catch {

    }
}

function setupControls() {
    controlsHandler.name = "stylesheet";
    document.head.appendChild(controlsHandler);

    inputOptionsHandler.setAttribute("class", "input-options");
    inputOptionsHandler.setAttribute("hidden", "")
    inputOptionsHandler.innerHTML = '<div class="dialog settings-view" style="height:min-content"><h1>Controles</h1><button data-hook="closeinput" style="position:absolute;top:12px;right:10px">Voltar</button><div class="tabcontents"><div class="section selected"><div class="option-row"><div style="margin-right:10px;flex:1;min-width:60px">Tamanho</div><div style="width:45px">0</div><input class="slider" type="range" min="10" max="30" step="0.01"></div><div class="option-row"><div style="margin-right:10px;flex:1;min-width:60px">Margem</div><div style="width:45px">0</div><input class="slider" type="range" min="0" max="15" step="0.01"></div><div class="option-row"><div style="margin-right:10px;flex:1;min-width:60px">Opacidade</div><div style="width:45px">0</div><input class="slider" type="range" min="0.2" max="1" step="0.01"></div><br><div style="display:flex;gap:8px;flex-wrap:wrap"><button data-hook="resetinput">Redefinir</button><button data-hook="edithud" style="background:#1e90ff">✏️ Editar HUD</button></div></div></div></div>';
    body.parentNode.appendChild(inputOptionsHandler);
    body.parentNode.querySelector('[data-hook="closeinput"]').addEventListener("click", function() {
        inputOptionsHandler.setAttribute("hidden", "");
        showControls(false);
    });
    body.parentNode.querySelector('[data-hook="resetinput"]').addEventListener("click", function() {
        updateControlsOptions(20, 5, 1, true)
    });
    body.parentNode.querySelector('[data-hook="edithud"]').addEventListener("click", function() {
        inputOptionsHandler.setAttribute("hidden", "");
        enterHudEditMode();
    });
    inputOptionsHandler.querySelectorAll(".option-row")[0].children[2].addEventListener("input", onControlsSettingsInput)
    inputOptionsHandler.querySelectorAll(".option-row")[1].children[2].addEventListener("input", onControlsSettingsInput)
    inputOptionsHandler.querySelectorAll(".option-row")[2].children[2].addEventListener("input", onControlsSettingsInput)

    joystick = document.createElement("div");
    joystick.setAttribute("class", "neo rounded sizer");
    joystick.setAttribute("view", "hidden");
    joystick.setAttribute("float", "");
    joystick.setAttribute("id", "joystick");
    joystick.setAttribute("role", "application");
    joystick.setAttribute("aria-label", "Joystick de movimento");
    joystick.innerHTML = '<div id="thumb" class="rounded" float></div>';
    joystick.addEventListener('touchstart', handleTouchStart);
    joystick.addEventListener('touchmove', handleTouchMove);
    joystick.addEventListener('touchend', handleTouchEnd);
    joystick.addEventListener('touchcancel', handleTouchEnd);

    kickButton = document.createElement("button");
    kickButton.setAttribute("class", "neo rounded sizer");
    kickButton.setAttribute("view", "hidden");
    kickButton.setAttribute("float", "");
    kickButton.setAttribute("id", "kick");
    kickButton.setAttribute("aria-label", "Chutar");
    kickButton.type = "button";
    kickButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M290 49c-16 0-32 14-38 36-6 25 5 48 22 52 18 5 39-10 45-35 7-25-5-48-22-52l-7-1zM89 68 78 87c32 16 63 34 96 47l28-12c-40-16-77-34-113-54zm148 56c-48 26-98 42-154 62l9 16c52-16 111-33 161-56-7-6-12-13-16-22zm30 35c-22 11-46 20-71 29-20 45-28 95-37 140l-2 11-101-40-16 26 130 60 3-4 15-29a1672 1672 0 0 0 79-193zm-31 135-17 36c25 37 57 79 95 109l23-17c-36-40-73-85-101-128zm188 73a48 48 0 0 0-48 48 48 48 0 0 0 48 48 48 48 0 0 0 48-48 48 48 0 0 0-48-48z"/></svg>';
    kickButton.addEventListener('touchstart', function() { kick('keydown') });
    kickButton.addEventListener('touchend', function() { kick('keyup') });
    kickButton.addEventListener('touchcancel', function() { kick('keyup') });

    // Double Kick
    const dblKickBtn = document.createElement("button");
    dblKickBtn.setAttribute("class", "neo rounded sizer");
    dblKickBtn.setAttribute("view", "hidden");
    dblKickBtn.setAttribute("float", "");
    dblKickBtn.setAttribute("id", "dblkick");
    dblKickBtn.setAttribute("aria-label", "Chute duplo (macro)");
    dblKickBtn.type = "button";
    dblKickBtn.innerHTML = '2x';
    dblKickBtn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        startKickMacro('double', [[50, 'keyup'], [100, 'keydown'], [150, 'keyup']]);
    });

    // Fake Shot
    const fakeKickBtn = document.createElement("button");
    fakeKickBtn.setAttribute("class", "neo rounded sizer");
    fakeKickBtn.setAttribute("view", "hidden");
    fakeKickBtn.setAttribute("float", "");
    fakeKickBtn.setAttribute("id", "fakekick");
    fakeKickBtn.setAttribute("aria-label", "Finta (macro)");
    fakeKickBtn.type = "button";
    fakeKickBtn.innerHTML = 'FK';
    fakeKickBtn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        startKickMacro('fake', [[30, 'keyup']]);
    });

    document.body.appendChild(joystick);
    document.body.appendChild(kickButton);
    document.body.appendChild(dblKickBtn);
    document.body.appendChild(fakeKickBtn);

    const controlOptions = readStored('controls', null);
    const savedSettings = readStored('hm_settings', {});
    if (controlOptions && typeof savedSettings.controlsOpacity === 'number') controlOptions[2] = savedSettings.controlsOpacity;
    if (controlOptions === null) {
        updateControlsOptions(20, 5, 1, true, false)
    } else {
        updateControlsOptions(controlOptions[0], controlOptions[1], controlOptions[2], true, false)
    }

    // Apply saved HUD positions (or defaults)
    applyHudPositions();

    resetJoystick();
}

///////////////////////////////////////// HUD EDITOR /////////////////////////////////////////

// Default positions: % from left/top of screen, size in vw
const defaultHudLayout = {
    joystick:  { left: 5,   top: null, right: null, bottom: 8, size: 20 },
    kick:      { left: null, top: null, right: 5,   bottom: 8, size: 20 },
    dblkick:   { left: null, top: null, right: 5,   bottom: 36, size: 13 },
    fakekick:  { left: null, top: null, right: 20,  bottom: 36, size: 13 }
};

function getHudLayout() {
    const saved = localStorage.getItem('hud_layout');
    if (!saved) return JSON.parse(JSON.stringify(defaultHudLayout));
    try { return JSON.parse(saved); } catch { return JSON.parse(JSON.stringify(defaultHudLayout)); }
}

function saveHudLayout(layout) {
    localStorage.setItem('hud_layout', JSON.stringify(layout));
}

function applyHudPositions() {
    const layout = getHudLayout();
    const ids = ['joystick', 'kick', 'dblkick', 'fakekick'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        const pos = layout[id];
        if (!el || !pos) return;
        el.style.left    = pos.left   != null ? pos.left + '%'   : '';
        el.style.right   = pos.right  != null ? pos.right + '%'  : '';
        el.style.top     = pos.top    != null ? pos.top + '%'    : '';
        el.style.bottom  = pos.bottom != null ? pos.bottom + '%' : '';
        el.style.width   = Math.min(pos.size, window.innerHeight / window.innerWidth * 65) + 'vw';
        el.style.fontSize = (pos.size * 0.045) + 'rem';
        el.style.zIndex  = '100';
        el.style.position = 'absolute';
    });
    constrainHudToViewport();
}

function enterHudEditMode() {
    if (hudEditing) return;
    releaseControls();
    hudEditing = true;
    const originalLayout = getHudLayout();
    const originalControlOpacity = getSetting("controlsOpacity");
    let layout = JSON.parse(JSON.stringify(originalLayout));
    const cleanup = [];
    function listen(target, type, handler) {
        target.addEventListener(type, handler, { capture: true, passive: false });
        cleanup.push(() => target.removeEventListener(type, handler, true));
    }
    const ids = ['joystick', 'kick', 'dblkick', 'fakekick'];
    const labels = { joystick: '🕹️', kick: '⚽', dblkick: '2x', fakekick: 'FK' };

    // Apply current saved positions first so buttons render in the right place
    applyHudPositions();

    // Force all buttons visible: remove 'view' attribute (CSS [view|=hidden] would hide them)
    // and set display + z-index directly so they float above the overlay
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.removeAttribute('view');
        el.style.display = 'flex';
        el.style.justifyContent = 'center';
        el.style.alignItems = 'center';
        el.style.zIndex = '10001'; // above overlay (9999) and bottom panel (10000)
    });

    // Dim overlay — pointer-events:none so touches go through to the buttons
    const overlay = document.createElement('div');
    overlay.id = 'hud-edit-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0006;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;pointer-events:none;';

    const bar = document.createElement('div');
    bar.style.cssText = 'width:100%;background:#1a2125ee;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;flex-wrap:wrap;gap:8px;pointer-events:auto;';
    bar.innerHTML = `
        <span style="color:#ecf0f3;font-size:0.9rem;font-weight:bold">✏️ Editar HUD — arraste os botões</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="hud-cancel-btn" style="background:#555">Cancelar</button><button id="hud-right-btn" style="background:#244967">Destro</button><button id="hud-left-btn" style="background:#244967">Canhoto</button><button id="hud-reset-btn" style="background:#555;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:0.85rem">Restaurar layout padrão</button>
            <button id="hud-save-btn" style="background:#2ecc71;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:0.9rem;font-weight:bold">✓ Salvar</button>
        </div>
    `;
    overlay.appendChild(bar);
    document.body.appendChild(overlay);

    // Size sliders panel
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10000;background:#1a2125ee;padding:10px 14px;box-sizing:border-box;pointer-events:auto;';
    panel.innerHTML = `
        <div style="color:#ecf0f3;font-size:0.8rem;margin-bottom:6px;font-weight:bold">📐 Tamanho dos botões:</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${ids.map(id => `
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;min-width:60px">
                <span style="color:#ecf0f3;font-size:0.75rem">${labels[id]}</span>
                <input id="size-${id}" type="range" min="8" max="35" step="0.5" value="${layout[id].size}" style="width:70px">
                <span id="size-lbl-${id}" style="color:#aaa;font-size:0.7rem">${layout[id].size}vw</span>
            </div>
        `).join('')}
        </div>
    `;
    panel.id = 'hud-size-panel';
    const opacityRow = document.createElement('label');
    opacityRow.className = 'hm-setting';
    opacityRow.textContent = 'Opacidade dos controles';
    const opacityInput = document.createElement('input');
    opacityInput.type = 'range'; opacityInput.min = .2; opacityInput.max = 1; opacityInput.step = .05;
    opacityInput.value = originalControlOpacity;
    opacityInput.setAttribute('aria-label','Opacidade dos controles');
    opacityInput.addEventListener('input', () => setSetting('controlsOpacity',Number(opacityInput.value)));
    opacityRow.appendChild(opacityInput); panel.appendChild(opacityRow);
    document.body.appendChild(panel);

    ids.forEach(id => {
        document.getElementById('size-' + id).addEventListener('input', function() {
            layout[id].size = parseFloat(this.value);
            document.getElementById('size-lbl-' + id).textContent = this.value + 'vw';
            const el = document.getElementById(id);
            if (el) {
                el.style.width = this.value + 'vw';
                el.style.fontSize = (parseFloat(this.value) * 0.045) + 'rem';
                el.style.display = 'flex';
                el.style.zIndex = '10001';
            }
        });
    });

    // Capture editor events before gameplay handlers and remove them on exit.
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        let startX, startY, startLeft, startTop;
        let touchId = null;
        let mouseDragging = false;
        const originalOpacity = el.style.opacity;
        const originalTransition = el.style.transition;
        cleanup.push(() => {
            el.style.opacity = originalOpacity;
            el.style.transition = originalTransition;
        });
        function onDragStart(cx, cy) {
            el.style.transition = 'none';
            el.style.opacity = '1';
            const r = el.getBoundingClientRect();
            startX = cx; startY = cy;
            startLeft = r.left; startTop = r.top;
            el.style.right = ''; el.style.bottom = '';
            el.style.left = startLeft + 'px'; el.style.top = startTop + 'px';
        }
        function onDragMove(cx, cy) {
            const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + cx - startX));
            const newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + cy - startY));
            el.style.left = newLeft + 'px';
            el.style.top = newTop + 'px';
        }
        function onDragEnd() {
            const r = el.getBoundingClientRect();
            const leftPct = r.left / window.innerWidth * 100;
            const topPct = r.top / window.innerHeight * 100;
            layout[id] = { left: Number(leftPct.toFixed(2)), top: Number(topPct.toFixed(2)), right: null, bottom: null, size: layout[id].size };
            el.style.left = leftPct + '%'; el.style.top = topPct + '%';
            el.style.right = ''; el.style.bottom = '';
        }
        function stop(e) { e.preventDefault(); e.stopImmediatePropagation(); }
        listen(el, 'touchstart', e => {
            stop(e);
            if (touchId !== null) return;
            const touch = e.changedTouches[0];
            touchId = touch.identifier;
            onDragStart(touch.clientX, touch.clientY);
        });
        listen(el, 'touchmove', e => {
            stop(e);
            const touch = Array.from(e.touches).find(t => t.identifier === touchId);
            if (touch) onDragMove(touch.clientX, touch.clientY);
        });
        function endTouch(e) {
            stop(e);
            if (!Array.from(e.changedTouches).some(t => t.identifier === touchId)) return;
            onDragEnd();
            touchId = null;
        }
        listen(el, 'touchend', endTouch);
        listen(el, 'touchcancel', endTouch);
        listen(el, 'mousedown', e => {
            stop(e);
            mouseDragging = true;
            onDragStart(e.clientX, e.clientY);
        });
        listen(document, 'mousemove', e => {
            if (mouseDragging) onDragMove(e.clientX, e.clientY);
        });
        listen(document, 'mouseup', () => {
            if (!mouseDragging) return;
            onDragEnd();
            mouseDragging = false;
        });
    });

    function exitEditMode() {
        cleanup.forEach(remove => remove());
        hudEditing = false;
        window.haxballMobileCancelHud = null;
        overlay.remove();
        panel.remove();
        // Restore buttons: put view="hidden" back so showControls() manages them normally
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.display = '';
            el.style.zIndex = '';
            el.setAttribute('view', 'hidden');
        });
        showControls(false);
        canResetJoystick = true;
        updateUI();
    }

    function cancelEditMode() {
        if (getSetting("controlsOpacity") !== originalControlOpacity) setSetting("controlsOpacity",originalControlOpacity);
        saveHudLayout(originalLayout);
        applyHudPositions();
        exitEditMode();
    }
    window.haxballMobileCancelHud = cancelEditMode;
    document.getElementById('hud-cancel-btn').addEventListener('click', cancelEditMode);
    for (const hand of ['right', 'left']) {
        document.getElementById('hud-' + hand + '-btn').addEventListener('click', () => {
            layout = makeHudPreset(hand);
            saveHudLayout(layout);
            applyHudPositions();
            ids.forEach(id => {
                const el = document.getElementById(id);
                el.style.display = 'flex'; el.style.zIndex = '10001';
                document.getElementById('size-' + id).value = layout[id].size;
                document.getElementById('size-lbl-' + id).textContent = layout[id].size + 'vw';
            });
        });
    }

    document.getElementById('hud-save-btn').addEventListener('click', function() {
        saveHudLayout(layout);
        applyHudPositions();
        exitEditMode();
    });

    document.getElementById('hud-reset-btn').addEventListener('click', function() {
        const def = JSON.parse(JSON.stringify(defaultHudLayout));
        layout = def;
        saveHudLayout(layout);
        // Clear inline position styles so applyHudPositions sets them fresh
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.left=''; el.style.right=''; el.style.top=''; el.style.bottom=''; }
        });
        applyHudPositions();
        // Keep buttons visible after reset
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.display = 'flex'; el.style.zIndex = '10001'; }
            const s = document.getElementById('size-' + id);
            if (s) { s.value = def[id].size; document.getElementById('size-lbl-' + id).textContent = def[id].size + 'vw'; }
        });
    });
}








///////////////////////////////////////// GAMEPAD /////////////////////////////////////////

const gamepadIndicator = document.createElement('div');
gamepadIndicator.style.cssText = 'display:none;position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#2ecc7199;color:#fff;padding:4px 12px;border-radius:20px;font-size:0.8rem;z-index:9999;pointer-events:none';
gamepadIndicator.textContent = '🎮 Controle conectado';
document.body.appendChild(gamepadIndicator);

let gamepadLoopRunning = false;
let gamepadFrame = null;
let activeGamepadIndex = null;
let gpIsXPressed = false;
let gpOptionsWasPressed = false;

function getGamepadDirection(x, y) {
    const deadZone = 0.2;
    if (Math.abs(x) < deadZone && Math.abs(y) < deadZone) return '';
    let keys = '';
    if (y < -deadZone) keys += 'w';
    if (y > deadZone)  keys += 's';
    if (x < -deadZone) keys += 'a';
    if (x > deadZone)  keys += 'd';
    return keys;
}

function startGamepadLoop(index) {
    if (gamepadLoopRunning) return;
    gamepadLoopRunning = true;
    activeGamepadIndex = index;

    function loop() {
        if (!gamepadLoopRunning || activeGamepadIndex !== index) return;
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads[index];
        if (!gp) {
            gamepadLoopRunning = false;
            activeGamepadIndex = null;
            emulateKeys('');
            kick('keyup', 'gamepad');
            gpIsXPressed = false;
            return;
        }

        // Movimento — analógico esquerdo
        const dir = getGamepadDirection(gp.axes[0] || 0, gp.axes[1] || 0);
        emulateKeys(dir);

        // Chute — X(0), Quadrado(2), R2(7)
        const kickNow = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed || gp.buttons[7]?.pressed);
        if (kickNow && !gpIsXPressed) {
            kick("keydown", "gamepad");
            gpIsXPressed = true;
        } else if (!kickNow && gpIsXPressed) {
            kick("keyup", "gamepad");
            gpIsXPressed = false;
        }

        // Options(9) — abre/fecha chat, só uma vez por press
        const optionsNow = !!(gp.buttons[9]?.pressed);
        if (optionsNow && !gpOptionsWasPressed) chatToggle();
        gpOptionsWasPressed = optionsNow;

        gamepadFrame = requestAnimationFrame(loop);
    }

    gamepadFrame = requestAnimationFrame(loop);
}

function registerGamepadListeners(ctx) {
    ctx.addEventListener("gamepadconnected", (event) => {
        gamepadIndicator.style.display = 'block';
        setTimeout(() => { gamepadIndicator.style.display = 'none'; }, 3000);
        startGamepadLoop(event.gamepad.index);
    });
    ctx.addEventListener("gamepaddisconnected", event => {
        if (activeGamepadIndex !== event.gamepad.index) return;
        gamepadLoopRunning = false;
        activeGamepadIndex = null;
        cancelAnimationFrame(gamepadFrame);
        gamepadFrame = null;
        emulateKeys('');
        kick('keyup', 'gamepad');
        gpIsXPressed = false;
        gpOptionsWasPressed = false;
        gamepadIndicator.textContent = '🎮 Controle desconectado';
        gamepadIndicator.style.background = '#c1353599';
        gamepadIndicator.style.display = 'block';
        setTimeout(() => {
            gamepadIndicator.style.display = 'none';
            gamepadIndicator.textContent = '🎮 Controle conectado';
            gamepadIndicator.style.background = '#2ecc7199';
        }, 2000);
    });
}








