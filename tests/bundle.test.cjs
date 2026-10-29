// Valida a montagem do bundle injetado no WebView (o que o Android realmente executa).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const bootstrap = read('android/app/src/main/assets/bootstrap.js');
const css = read('mobile-ui.css');
const bundle = bootstrap
    .replace('/*CLIENT_SCRIPT*/', read('min.js'))
    .replace('/*MOBILE_FEATURES*/', read('mobile-features.js'))
    .replace('/*MOBILE_UI*/', read('mobile-ui.js').replace('/*UI_STYLE_TEXT*/', JSON.stringify(css)));

// 1. Compila como um único script (mesma checagem que o WebView fará).
assert.doesNotThrow(() => new vm.Script(bundle), 'o bundle precisa compilar');
assert.doesNotThrow(() => new vm.Script(bundle, { filename: 'bundle.js' }));

// 2. Nenhum marcador sobrou sem substituição.
for (const marker of ['/*CLIENT_SCRIPT*/', '/*MOBILE_FEATURES*/', '/*MOBILE_UI*/', '/*UI_STYLE_TEXT*/']) {
    assert(!bundle.includes(marker), 'marcador não substituído: ' + marker);
}

// 3. O CSS entra como string JSON válida (aspas e quebras escapadas).
const styleMatch = /mobileUiStyle\.textContent = (".*?");\r?\n/s.exec(bundle);
assert(styleMatch, 'o CSS precisa ser atribuído a mobileUiStyle.textContent');
assert.doesNotThrow(() => JSON.parse(styleMatch[1]));
const injectedCss = JSON.parse(styleMatch[1]);
// Comentários não são regras: a checagem olha só o CSS efetivo.
const effectiveCss = injectedCss.replace(/\/\*[\s\S]*?\*\//g, '');
assert(injectedCss.includes('#mobile-panel'), 'o CSS do design system precisa estar presente');
assert(injectedCss.includes('#hm-dock'), 'o CSS do dock precisa estar presente');

// --- compatibilidade com WebView antiga -----------------------------------
// @layer, color-mix() e :has() são ignorados (ou invalidam a declaração) em
// WebViews antigas. Um @layer não suportado descarta a folha inteira.
for (const forbidden of ['@layer', 'color-mix(', ':has(', 'inset:', 'aspect-ratio', 'gap:', 'clamp(']) {
    assert(!effectiveCss.includes(forbidden), 'recurso CSS incompatível com WebView antiga: ' + forbidden);
}
assert(!/\bmargin-inline|\bpadding-inline|\bblock-size/.test(effectiveCss), 'propriedades lógicas não são suportadas');

// Toda cor translúcida precisa usar rgba() — nada de color-mix.
const translucent = injectedCss.match(/rgba\([^)]*\)/g) || [];
assert(translucent.length > 20, 'o tema usa rgba() para translucidez');
assert(injectedCss.includes('-webkit-transform'), 'transform precisa de prefixo -webkit- para WebViews antigas');

// 4. Ordem de injeção: min.js define o núcleo antes dos módulos que dependem dele.
const order = ['let gameFrame = document.querySelector', 'const CLIENT_VERSION', 'const mobileUiStyle'];
const positions = order.map(fragment => bundle.indexOf(fragment));
assert(positions.every(position => position > -1), 'todos os módulos precisam estar no bundle');
assert(positions[0] < positions[1] && positions[1] < positions[2], 'a ordem de injeção é um contrato');

// 5. Câmera: o renderer do jogo só pode ser tocado no modo Inteligente, e o
// deslocamento por CSS precisa cobrir a borda com zoom de compensação.
assert(
    bundle.includes('if (!hmCam.cssOnly && !hmCamInstall()) return;'),
    'o hook do canvas precisa estar restrito ao modo Inteligente'
);
assert(
    bundle.includes("'px,0) scale('"),
    'no modo Fixa o deslocamento em CSS precisa de zoom para não revelar borda'
);
assert(bundle.includes('hmCamClearTransform'), 'o transform da câmera precisa ser limpo ao desligar');

// 6. CSS estruturalmente são: chaves balanceadas e sem declarações órfãs.
let depth = 0, minDepth = 0;
for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') depth++;
    else if (char === '}') { depth--; minDepth = Math.min(minDepth, depth); }
}
assert.equal(depth, 0, 'chaves do CSS balanceadas');
assert.equal(minDepth, 0, 'CSS sem fechamento excedente');

// 7. Tamanho do que é injetado (orçamento de desempenho).
// 240 KB: a tela de nick própria, as quatro peles e o motor de som entraram
// no bundle (antes eram 204 KB). O teto continua servindo de alarme contra
// crescimento acidental — subir de novo exige justificar o que entrou.
const kilobytes = Math.round(bundle.length / 1024);
assert(kilobytes < 240, 'bundle acima do orçamento (' + kilobytes + ' KB)');

console.log('PASS: bundle injetado compila, sem marcadores pendentes, CSS válido e dentro do orçamento (' + kilobytes + ' KB).');
