// Testes da matemática da câmera inteligente (funções puras de mobile-ui.js).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'mobile-ui.js'), 'utf8');
const start = ui.indexOf('// ==CAM-MATH==');
const end = ui.indexOf('// ==/CAM-MATH==');
assert(start > -1 && end > start, 'bloco CAM-MATH não encontrado em mobile-ui.js');

const ctx = vm.createContext({ Math });
vm.runInContext(ui.slice(start, end), ctx);
const { hmCamResolve, hmCamDepth, hmCamFreePoint } = ctx;

// Layout de referência: 776x328 (o mesmo viewport de validação do projeto).
const VIEW = { w: 776, h: 328 };
const JOYSTICK = { x: 39, y: 147, w: 155, h: 155, cx: 116.5, cy: 224.5 };  // 20vw no canto inferior esquerdo
const KICK = { x: 582, y: 147, w: 155, h: 155, cx: 659.5, cy: 224.5 };

function settle(input, frames = 90) {
    let state = { dx: 0, dy: 0 };
    let result = null;
    for (let i = 0; i < frames; i++) {
        result = hmCamResolve({ ...input, dt: 1 / 60, prev: state, prevActive: result ? result.active : false });
        state = { dx: result.dx, dy: result.dy };
    }
    return { ...result, ...state };
}

// 1. Desligada nunca desloca.
const off = hmCamResolve({ mode: 'off', view: VIEW, player: { x: 60, y: 300 }, zones: [JOYSTICK] });
assert.equal(off.dx, 0);
assert.equal(off.dy, 0);
assert.equal(off.active, false);
assert.equal(off.reason, 'off');

// 2. Profundidade de oclusão: dentro > 0, fora = 0.
assert(hmCamDepth(100, 220, JOYSTICK, 0) > 0);
assert.equal(hmCamDepth(400, 160, JOYSTICK, 0), 0);
assert(hmCamDepth(30, 220, JOYSTICK, 26) > 0, 'a margem do polegar expande a zona');

// 3. Ponto livre sai da zona na direção do centro da tela.
const free = hmCamFreePoint(100, 220, JOYSTICK, 26, VIEW);
assert(free.x > JOYSTICK.x + JOYSTICK.w, 'deve sair pela direita, rumo ao centro');
assert.equal(hmCamDepth(free.x, free.y, JOYSTICK, 26), 0);

// 4. Jogador sob o joystick: desloca para a direita, sem mexer no eixo Y.
const corner = settle({ mode: 'smart', strength: .6, view: VIEW, zones: [JOYSTICK, KICK], player: { x: 100, y: 220 } });
assert(corner.active, 'deve detectar oclusão');
assert(corner.dx > 40, 'deve afastar o jogador do canto (dx=' + corner.dx + ')');
assert(Math.abs(corner.dy) < 6, 'não deve deslocar na vertical (dy=' + corner.dy + ')');
assert(corner.dx <= VIEW.w * .16 + .5, 'não pode passar do limite máximo');

// 5. Jogador no centro do campo: câmera não se move.
const centered = settle({ mode: 'smart', strength: .6, view: VIEW, zones: [JOYSTICK, KICK], player: { x: 388, y: 164 } });
assert.equal(centered.active, false);
assert.equal(centered.dx, 0);
assert.equal(centered.dy, 0);

// 6. Histerese: saindo da zona por pouco, o deslocamento continua (sem piscar).
const nearEdge = { x: JOYSTICK.x + JOYSTICK.w + 30, y: 220 };
const hysteresis = hmCamResolve({
    mode: 'smart', strength: .6, view: VIEW, zones: [JOYSTICK],
    player: nearEdge, dt: 1 / 60, prev: { dx: 60, dy: 0 }, prevActive: true
});
assert(hysteresis.active, 'deve manter o deslocamento dentro da margem de histerese');

// 7. Bola tem prioridade: se o deslocamento tiraria a bola da tela, ele é limitado.
const guarded = settle({
    mode: 'smart', strength: 1, view: VIEW, zones: [JOYSTICK],
    player: { x: 100, y: 220 }, ball: { x: 760, y: 220 }
});
assert(guarded.guarded, 'deve acionar a proteção da bola');
assert(guarded.dx < VIEW.w * .16, 'o deslocamento precisa ser reduzido para manter a bola visível');
assert(760 + guarded.dx <= VIEW.w * .92 + .5, 'a bola não pode sair da caixa segura');

// 8. Modo fixo funciona sem localizar o jogador e empurra para longe do canto.
const fixed = settle({ mode: 'fixed', strength: .6, view: VIEW, zones: [JOYSTICK] });
assert(fixed.dx > 0 && fixed.dy < 0, 'modo fixo afasta o conteúdo do canto inferior esquerdo');
assert(Math.abs(fixed.dx) <= VIEW.w * .05 + .5);

// 9. Jogador no canto inferior direito (canhoto) inverte o sentido.
const mirrored = settle({
    mode: 'smart', strength: .6, view: VIEW, zones: [KICK],
    player: { x: 700, y: 220 }
});
assert(mirrored.dx < -40, 'no canto direito o deslocamento é para a esquerda (dx=' + mirrored.dx + ')');

// 10. A mola é estável: nunca inverte de sinal durante a convergência.
let state = { dx: 0, dy: 0 }, last = null, flips = 0;
for (let i = 0; i < 120; i++) {
    const result = hmCamResolve({
        mode: 'smart', strength: .6, view: VIEW, zones: [JOYSTICK],
        player: { x: 100, y: 220 }, dt: 1 / 60, prev: state, prevActive: last ? last.active : false
    });
    if (last && Math.sign(result.dx) !== 0 && Math.sign(last.dx) !== 0 && Math.sign(result.dx) !== Math.sign(last.dx)) flips++;
    state = { dx: result.dx, dy: result.dy };
    last = result;
}
assert.equal(flips, 0, 'não pode oscilar (overshoot) na convergência');

// 11. Robustez de entrada: nada quebra com dados ausentes ou inválidos.
assert.doesNotThrow(() => hmCamResolve(null));
assert.doesNotThrow(() => hmCamResolve({ mode: 'smart' }));
assert.doesNotThrow(() => hmCamResolve({ mode: 'smart', view: VIEW, zones: [JOYSTICK], player: { x: NaN, y: NaN } }));
assert.doesNotThrow(() => hmCamResolve({ mode: 'fixed', view: VIEW, zones: [] }));

console.log('PASS: câmera inteligente resolve oclusão do polegar, protege a bola, mantém histerese e não oscila.');
