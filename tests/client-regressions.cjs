const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'min.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'android/app/src/main/assets/bootstrap.js'), 'utf8');
const features = fs.readFileSync(path.join(root, 'mobile-features.js'), 'utf8');
const ui = fs.readFileSync(path.join(root,'mobile-ui.js'),'utf8').replace('/*UI_STYLE_TEXT*/',JSON.stringify(fs.readFileSync(path.join(root,'mobile-ui.css'),'utf8')));
new vm.Script(bootstrap.replace('/*CLIENT_SCRIPT*/', source).replace('/*MOBILE_FEATURES*/', features).replace('/*MOBILE_UI*/',ui));
const section = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const nodes = new Map(), timers = new Map(), frames = new Map(), storage = new Map(), events = [];
let counter = 0, screen = 'game', pads = [];
function node(id) {
    const el = {style:{opacity:'',transition:''},attrs:{},handlers:new Map(),children:[],offsetWidth:100,offsetHeight:100,clientWidth:100,clientHeight:100,
        setAttribute(k,v){this.attrs[k]=v}, removeAttribute(k){delete this.attrs[k]},
        appendChild(child){this.children.push(child)},
        addEventListener(type,fn,options){const list=this.handlers.get(type)||[];list.push({fn,capture:options===true||!!options?.capture});this.handlers.set(type,list)},
        removeEventListener(type,fn,capture){this.handlers.set(type,(this.handlers.get(type)||[]).filter(h=>h.fn!==fn||h.capture!==!!capture))},
        remove(){this.children.forEach(child=>child.remove());if(this.id)nodes.delete(this.id)},
        getBoundingClientRect(){return {left:parseFloat(this.style.left)||20,top:parseFloat(this.style.top)||20,width:100,height:100}}
    };
    Object.defineProperty(el,'id',{get:()=>id,set:v=>{id=v;nodes.set(v,el)}});
    Object.defineProperty(el,'innerHTML',{get:()=>el.html||'',set:html=>{
        html=String(html); el.html=html;
        for(const match of html.matchAll(/id="([^"]+)"/g)){const child=node(match[1]);el.children.push(child)}
    }});
    if(id)nodes.set(id,el);
    return el;
}
const doc = node();
doc.createElement = () => node();
doc.getElementById = id => nodes.get(id)||null;
doc.body = node();
const controlIds = ['joystick','kick','dblkick','fakekick'];
controlIds.forEach(node);
const body = {querySelector(selector){
    if(selector==='.game-view')return screen==='game'||screen==='room'?{}:null;
    return selector.split(',').some(s=>s.trim()==='.'+screen+'-view')?{}:null;
}};
const inputs = Array.from({length:3},()=>({children:[{},node(),{value:0}]}));
const gameDoc = {head:{appendChild(){}},dispatchEvent:event=>events.push({type:event.type,code:event.code})};
const settings = {theme:'dark',chatSize:1,chatBg:true,macros:true,vibration:false,joystickMode:'fixed',sensitivity:1,deadZone:0.15,controlsOpacity:1,fieldView:1,showPing:false,showFps:false};
const ctx = vm.createContext({
    document:doc,body,window:{innerWidth:1000,innerHeight:500,addEventListener(){},location:{href:'https://www.haxball.com/play'}},gameFrame:{document:gameDoc,addEventListener(){}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    navigator:{getGamepads:()=>pads},getSetting:k=>settings[k],
    KeyboardEvent:function(type,options){Object.assign(this,{type},options)},
    setTimeout:(fn,delay)=>{const id=++counter;timers.set(id,{fn,delay});return id},
    clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{const id=++counter;frames.set(id,fn);return id},
    cancelAnimationFrame:id=>frames.delete(id),isTouching:false,joystickTouchId:null,
    joystick:nodes.get('joystick'),kickButton:nodes.get('kick'),thumb:{style:{},clientWidth:40,clientHeight:40},
    gpIsXPressed:false,gpOptionsWasPressed:false,gamepadLoopRunning:false,gamepadFrame:null,activeGamepadIndex:null,
    resetJoystick(){ctx.emulateKeys('')},inputOptionsHandler:{querySelectorAll:()=>inputs},
    controlsHandler:node(),themeStyleHandler:{},themeGameStyleHandler:{},
    themes:{dark:{bg:'#000',accent:'#fff',text:'#fff'}},gamepadIndicator:{style:{}},
    URL,console,mobileChatOpen:false,noteMobileChatMessage(){},applyVisualSettings(){},revealMobileChat(){},updateUI(){},canResetJoystick:true,settingsMenuHandler:{style:{}}
});
function load(a,b){vm.runInContext(section(a,b),ctx)}
function evaluate(text){return vm.runInContext(text,ctx)}
load('let chatHistory = [];','const defaultSettings');
load('const constrolsStyleBase','const countryFilterHandler');
load('const defaultSettings','function getSetting');
evaluate('const seenChatMessages = new WeakSet();');
load('function kick(','function updateJoystick');
load('function emulateKeys(','function setupControls');
load('function isPlayingView()','function updateControlsSettingsNumbers');
load('function handleTouchStart','function kick(');
load('function updateJoystick','function resetJoystick');
load('function updateControlsSettingsNumbers()','function handleTouchStart');
load('const defaultHudLayout','const gamepadIndicator');
vm.runInContext(features,ctx);
load('function applySettings()','var checkLoaderInterval');
load('function updatedChat()','function chatToggle()');
vm.runInContext(source.slice(source.indexOf('function startGamepadLoop(index)')),ctx);
const xEvents = () => events.filter(e=>e.code==='KeyX').map(e=>e.type);
function tick(max){for(const [id,t] of [...timers].sort((a,b)=>a[1].delay-b[1].delay)){if(t.delay<=max&&timers.has(id)){timers.delete(id);t.fn()}}}

ctx.showControls(true);
events.length=0;
ctx.kick('keydown');
ctx.startKickMacro('fake',[[30,'keyup']]);
tick(30);
assert.deepEqual(xEvents(),['keydown']);
ctx.kick('keyup');
assert.deepEqual(xEvents(),['keydown','keyup']);
ctx.startKickMacro('double',[[50,'keyup'],[100,'keydown'],[150,'keyup']]);
ctx.releaseControls();
events.length=0;
tick(200);
assert.deepEqual(xEvents(),[]);
console.log('PASS: macros preserve held kick; pending macro events cancel on release.');

ctx.kick('keydown','gamepad');
evaluate('activeGamepadIndex=0;gamepadLoopRunning=true;gpIsXPressed=true;');
const listeners={};
ctx.registerGamepadListeners({addEventListener:(name,fn)=>listeners[name]=fn});
events.length=0;
listeners.gamepaddisconnected({gamepad:{index:0}});
assert.deepEqual(xEvents(),['keyup']);
assert.equal(ctx.gpIsXPressed,false);
assert.equal(ctx.activeGamepadIndex,null);
console.log('PASS: gamepad disconnect releases kick and stops its loop.');

const messages=Array.from({length:7},(_,i)=>({innerHTML:'message '+i,style:{color:'#abcdef'},classList:{add(){}}}));
const log={querySelector(){return null},firstChild:{children:messages},scrollTop:1,scrollHeight:100,clientHeight:100};
ctx.getByDataHook=()=>log;
ctx.updatedChat();ctx.updatedChat();
assert.equal(evaluate('chatHistory.length'),7);
assert.equal(evaluate('chatHistory[0].html'),'message 0');
assert.equal(evaluate('chatHistory[6].color'),'#abcdef');
assert.equal(messages[0].style.display,'none');
ctx.mobileChatOpen=true;ctx.updatedChat();assert(messages.every(message=>message.style.display===''));
assert.equal(evaluate('chatHistory.length'),7);ctx.mobileChatOpen=false;
console.log('PASS: batched chat messages are recorded once with their colors.');

screen='room';
ctx.showControls(true);
assert.equal(nodes.get('joystick').attrs.view,'hidden');
ctx.applySettings();
assert.equal(nodes.get('dblkick').attrs.view,'hidden');
assert.equal(nodes.get('fakekick').attrs.view,'hidden');
screen='game';ctx.showControls(true);ctx.applySettings();
assert.equal(nodes.get('dblkick').attrs.view,'visible');
settings.macros=false;ctx.applySettings();
assert.equal(nodes.get('dblkick').attrs.view,'hidden');
settings.macros=true;
console.log('PASS: room/menu panels hide all gameplay controls; settings preserve visibility.');

const custom=JSON.parse(JSON.stringify(ctx.getHudLayout()));
custom.joystick.left=40;
ctx.saveHudLayout(custom);
let gameplayTouches=0;
nodes.get('joystick').addEventListener('touchstart',()=>gameplayTouches++);
ctx.enterHudEditMode();
const joystick=nodes.get('joystick');
const event={changedTouches:[{identifier:2,clientX:20,clientY:20}],preventDefault(){},stopImmediatePropagation(){this.stopped=true}};
for(const h of [...joystick.handlers.get('touchstart')].sort((a,b)=>b.capture-a.capture)){if(event.stopped)break;h.fn(event)}
assert.equal(gameplayTouches,0);
events.length=0;ctx.kick('keydown');ctx.emulateKeys('w');
assert.equal(events.length,0);
nodes.get('hud-reset-btn').handlers.get('click')[0].fn();
nodes.get('hud-save-btn').handlers.get('click')[0].fn();
assert.equal(ctx.getHudLayout().joystick.left,5);
assert.equal(joystick.handlers.get('touchstart').length,1);
assert.equal(doc.handlers.get('mousemove').length,0);
ctx.enterHudEditMode();
assert.equal(joystick.handlers.get('touchstart').length,2);
nodes.get('hud-save-btn').handlers.get('click')[0].fn();
assert.equal(joystick.handlers.get('touchstart').length,1);
assert.equal(joystick.style.opacity,'');
console.log('PASS: HUD reset/save persists defaults; edit suppresses gameplay and removes listeners.');

ctx.updateControlsOptions(27,5,1,true);
assert.equal(nodes.get('joystick').style.width,'27vw');
assert.equal(nodes.get('kick').style.width,'27vw');
assert.equal(ctx.getHudLayout().joystick.size,27);
const saved=ctx.getHudLayout();saved.kick.size=19;ctx.saveHudLayout(saved);
ctx.updateControlsOptions(27,5,1,true,false);ctx.applyHudPositions();
assert.equal(nodes.get('kick').style.width,'19vw');
console.log('PASS: size slider updates inline width; startup preserves individual HUD sizes.');
assert(source.includes('.room-view>.container{height:100%;max-height:100%;'));
assert(source.includes('.player-list-view .list{min-height:80px;touch-action:pan-y;'));
console.log('PASS: room panel allows scrolling and player lists retain usable height.');

const profile = ctx.exportMobileProfile();
assert.equal(profile.format,'haxball-mobile-profile');
assert.equal(profile.settings.joystickMode,'fixed');
assert(!JSON.stringify(profile).includes('player_auth_key'));
const before = storage.get('hm_settings');
const bad = JSON.parse(JSON.stringify(profile)); bad.settings.sensitivity=999;
assert.throws(()=>ctx.applyMobileProfile(bad),/inv/);
assert.equal(storage.get('hm_settings'),before);
assert.equal(ctx.canonicalRoomUrl('https://haxball.com/play?c=abc_123&pass=secret'),'https://www.haxball.com/play?c=abc_123');
assert.equal(ctx.canonicalRoomUrl('https://evil.example/play?c=abc'),null);
assert.equal(ctx.canonicalRoomUrl('http://haxball.com/play?c=abc'),null);
assert.equal(ctx.canonicalRoomUrl('https://www.haxball.com/play?c=%00'),null);
console.log('PASS: profile validation rejects invalid input without writing; room URLs are restricted.');

const left = ctx.makeHudPreset('left'), right=ctx.makeHudPreset('right');
assert.equal(left.joystick.right,right.joystick.left);
assert.equal(left.kick.left,right.kick.right);
ctx.enterHudEditMode();
nodes.get('hud-left-btn').handlers.get('click')[0].fn();
assert.equal(ctx.getHudLayout().joystick.right,5);
ctx.applyMobileSettings();
assert.equal(doc.getElementById('floating-joystick-zone').style.right,'0');
ctx.window.haxballMobileCancelHud();
assert.equal(ctx.getHudLayout().joystick.left,5);
console.log('PASS: left/right presets mirror controls; Cancel restores previous layout.');

screen='game';ctx.showControls(true);
settings.joystickMode='floating';
ctx.handleTouchStart({changedTouches:[{identifier:9,clientX:250,clientY:250}]});
assert.equal(joystick.style.position,'fixed');
ctx.handleTouchEnd({changedTouches:[{identifier:9}]});
assert.equal(joystick.style.position,'absolute');
settings.joystickMode='fixed';
const rect=joystick.getBoundingClientRect();
const touch={clientX:rect.left+joystick.clientWidth/2+5,clientY:rect.top+joystick.clientHeight/2};
events.length=0;settings.sensitivity=1;ctx.updateJoystick(touch);
assert(!events.some(e=>e.type==='keydown'&&e.code==='KeyD'));
events.length=0;settings.sensitivity=2;ctx.updateJoystick(touch);
assert(events.some(e=>e.type==='keydown'&&e.code==='KeyD'));
console.log('PASS: floating joystick restores position; sensitivity/dead zone affect activation.');

const uiSource = fs.readFileSync(path.join(root,'mobile-ui.js'),'utf8');
vm.runInContext(uiSource.slice(uiSource.indexOf('function readMobileMetrics('),uiSource.indexOf('function syncMobileStatus()')),ctx);
assert.equal(ctx.readMobileMetrics('Ping: 39 - 157','Fps: 60').ping,39);
assert.equal(ctx.readMobileMetrics('Ping: 39 - 157','Fps: 60').peak,157);
assert.equal(ctx.readMobileMetrics('Ping: 39 - 157','Fps: 60').fps,60);
for(const [ping,level] of [[80,'good'],[81,'fair'],[150,'fair'],[151,'slow'],[250,'slow'],[251,'poor']])
    assert.equal(ctx.readMobileMetrics('Ping: '+ping,'').level,level);
assert.equal(ctx.readMobileMetrics('','').ping,null);
assert.equal(ctx.readMobileMetrics('','').fps,null);
assert.equal(ctx.readMobileMetrics('Ping: 39 - 157','Fps: 60',false).level,'offline');
console.log('PASS: compact HUD preserves native ping/FPS, connection levels and missing/offline states.');


// Exercise native touch callbacks without relying on desktop browser touch support.
function classes(...values) {
    const set=new Set(values);
    return {contains:value=>set.has(value),add:value=>set.add(value),remove:value=>set.delete(value),
        toggle(value,force){const on=force===undefined?!set.has(value):force;on?set.add(value):set.delete(value);return on;}};
}
const roomTouch=node(),rowTouch=node(),redTouch=node(),blueTouch=node(),roomContainer=node();
roomTouch.dataset={};roomTouch.classList=classes('admin');roomTouch.isConnected=true;
rowTouch.classList=classes();rowTouch.isConnected=true;rowTouch.draggable=true;
redTouch.classList=classes();blueTouch.classList=classes();
roomTouch.contains=target=>[rowTouch,redTouch,blueTouch].includes(target);
roomTouch.querySelector=()=>roomContainer;
rowTouch.closest=()=>rowTouch;rowTouch.querySelector=()=>({textContent:'Mesmo nick'});
let dropId=null,dropCount=0,optionCount=0,dragStarts=0;
rowTouch.ondragstart=event=>{dragStarts++;event.dataTransfer.setData('player','42');};
rowTouch.oncontextmenu=()=>optionCount++;
blueTouch.ondrop=event=>{event.preventDefault();dropId=event.dataTransfer.getData('player');dropCount++;};
gameDoc.createElement=()=>{const el=node();el.remove=()=>{el.removed=true;};return el;};
gameDoc.body=node();
gameDoc.elementFromPoint=x=>({closest:()=>x>150?blueTouch:redTouch});
ctx.gameFrame.innerWidth=500;
vm.runInContext(uiSource.slice(uiSource.indexOf('let playerTouchDrag ='),uiSource.indexOf('let mobileChatOpen =')),ctx);
ctx.installPlayerTouchDrag(roomTouch);
function emitPlayerTouch(type,x=40,y=40) {
    const point={identifier:7,clientX:x,clientY:y};
    const event={target:rowTouch,touches:type==='touchend'||type==='touchcancel'?[]:[point],changedTouches:[point],
        preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){}};
    for(const handler of roomTouch.handlers.get(type)||[])handler.fn(event);
    return event;
}
function hold() {
    const id=evaluate('playerTouchDrag.timer');
    const timer=timers.get(id);assert.equal(timer.delay,300);timers.delete(id);timer.fn();
}
emitPlayerTouch('touchstart');hold();
assert(evaluate('playerTouchDrag.active'));
assert(emitPlayerTouch('touchmove',250,40).prevented);
emitPlayerTouch('touchend',250,40);
assert.equal(dropId,'42');assert.equal(dropCount,1);assert.equal(evaluate('playerTouchDrag'),null);
emitPlayerTouch('touchstart');emitPlayerTouch('touchend');assert.equal(optionCount,1);
emitPlayerTouch('touchstart');emitPlayerTouch('touchmove',40,70);
assert.equal(evaluate('playerTouchDrag'),null);assert.equal(dropCount,1);
emitPlayerTouch('touchstart');hold();emitPlayerTouch('touchcancel');
assert.equal(evaluate('playerTouchDrag'),null);assert.equal(dropCount,1);
emitPlayerTouch('touchstart');hold();rowTouch.draggable=false;emitPlayerTouch('touchend',250,40);
assert.equal(dropCount,1);rowTouch.draggable=true;
roomTouch.classList.remove('admin');emitPlayerTouch('touchstart');
assert.equal(evaluate('playerTouchDrag'),null);
assert.equal(dragStarts,3);
console.log('PASS: touch drag transfers the native ID once; tap opens options; scroll/cancel/lost permission never move players.');

vm.runInContext(uiSource.slice(uiSource.indexOf('let mobileChatOpen =')),ctx);
// Compile against the chat bindings, as the combined production bootstrap does.
load('function updatedChat()','function chatToggle()');
const gameChat=node(),chatContents=node(),composerChat=node(),chatButton=node(),chatBadge=node();
gameChat.classList=classes();gameChat.querySelector=()=>chatContents;
chatContents.querySelector=selector=>selector==='.input'?composerChat:log;
composerChat.querySelector=()=>({blur(){}});
chatButton.querySelector=()=>chatBadge;
ctx.body={querySelector:selector=>selector==='.game-view'?gameChat:selector==='#hm-chat-toggle'?chatButton:null};
ctx.syncMobileStatus=()=>{};gameDoc.documentElement={classList:classes()};
const incomingMessage={innerHTML:'mensagem recebida',style:{},classList:{add(){}}};
messages.push(incomingMessage);ctx.updatedChat();ctx.updatedChat();
assert.equal(evaluate('mobileChatUnread'),1);assert.equal(chatBadge.hidden,false);
ctx.setMobileChatOpen(true);
assert(gameChat.classList.contains('hm-chat-open'));
assert.equal(evaluate('mobileChatUnread'),0);assert.equal(chatBadge.hidden,true);
assert.equal(incomingMessage.style.display,'');assert.equal(composerChat.style.display,'flex');
assert.equal(nodes.get('joystick').attrs.view,'hidden');
const sentMessage={innerHTML:'mensagem enviada',style:{},classList:{add(){}}};
messages.push(sentMessage);ctx.updatedChat();
assert.equal(sentMessage.style.display,'');assert.equal(evaluate('mobileChatUnread'),0);
ctx.setMobileChatOpen(false);
assert.equal(sentMessage.style.display,'none');
settings.chatCascade=true;ctx.updatedChat();
assert.equal(sentMessage.style.display,'');assert.equal(messages[0].style.display,'none');
assert.equal(evaluate('mobileChatUnread'),0);
console.log('PASS: chat panel preserves received/sent messages, unread counts, control hiding and optional cascade.');


let nativePopupVisible=true,leaveCanceled=0;
const modalState={
    mobilePanelOpen:false,mobileChatOpen:false,chatFocused:false,
    body:{querySelector(selector){
        if(selector==='.game-view')return {};
        return nativePopupVisible&&selector.includes('[data-hook=popups]')?{}:null;
    }}
};
vm.runInNewContext(section('function isPlayingView()','function showControls('),modalState);
assert.equal(modalState.isPlayingView(),false);
nativePopupVisible=false;assert.equal(modalState.isPlayingView(),true);
const backState={
    hudEditing:false,mobilePanelOpen:false,mobileChatOpen:false,
    body:{querySelector(selector){return selector==='.leave-room-view'?{querySelector(){return {click(){leaveCanceled++;}}}}:null;}}
};
vm.runInNewContext(features.slice(features.indexOf('function handleMobileBack()'),features.indexOf('window.haxballMobileBack =')),backState);
assert.equal(backState.handleMobileBack(),true);assert.equal(leaveCanceled,1);
console.log('PASS: native modals block gameplay; Back cancels the room-leave confirmation.');
