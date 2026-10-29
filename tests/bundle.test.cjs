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
assert(JSON.parse(styleMatch[1]).includes('@layer tokens'), 'o CSS do design system precisa estar presente');

// 4. Ordem de injeção: min.js define o núcleo antes dos módulos que dependem dele.
const order = ['let gameFrame = document.querySelector', 'const CLIENT_VERSION', 'const mobileUiStyle'];
const positions = order.map(fragment => bundle.indexOf(fragment));
assert(positions.every(position => position > -1), 'todos os módulos precisam estar no bundle');
assert(positions[0] < positions[1] && positions[1] < positions[2], 'a ordem de injeção é um contrato');

// 5. CSS estruturalmente são: chaves balanceadas e sem declarações órfãs.
let depth = 0, minDepth = 0;
for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') depth++;
    else if (char === '}') { depth--; minDepth = Math.min(minDepth, depth); }
}
assert.equal(depth, 0, 'chaves do CSS balanceadas');
assert.equal(minDepth, 0, 'CSS sem fechamento excedente');

// 6. Tamanho do que é injetado (orçamento de desempenho).
const kilobytes = Math.round(bundle.length / 1024);
assert(kilobytes < 220, 'bundle acima do orçamento (' + kilobytes + ' KB)');

console.log('PASS: bundle injetado compila, sem marcadores pendentes, CSS válido e dentro do orçamento (' + kilobytes + ' KB).');
