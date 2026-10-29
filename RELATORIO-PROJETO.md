# Matrix Mobile — Relatório de exploração do projeto

> Análise do repositório `kylun007/matrix-mobile` (branch `arena/6b48c373-matrix-mobile`, commit base `5e7369d "Rename project to Matrix Mobile"`).
> Data da análise: 28/10/2026. Todos os números abaixo foram medidos no checkout local.

---

## 1. O que é o projeto

**Matrix Mobile** é um **cliente alternativo e não oficial do HaxBall para celular**. Ele não reimplementa o jogo: é uma **camada de JavaScript injetada dentro do site oficial** (`https://www.haxball.com/play`), que roda dentro de um **WebView** embrulhado num app Android nativo.

Traduzindo a ideia central:

1. O app Android carrega a página real do HaxBall (o motor/rede/anticheat continuam sendo do site oficial).
2. Quando a página termina de carregar, o app **injeta via `evaluateJavascript`** um bundle JS composto por três arquivos do repositório.
3. Esse bundle **reescreve a interface** (CSS), **adiciona controles touch** (joystick + chute), **traduz menus**, adiciona **painéis de configuração**, **perfis exportáveis**, **favoritos de salas**, **histórico de chat** etc.
4. Uma pequena **ponte de URL customizada** (`haxmobile://`) permite ao JS pedir ações nativas ao Android (compartilhar sala, exportar/importar arquivo de perfil).

Atribuições declaradas no código: jogo original de **Mario Carbajal (@basro)**; adaptação mobile original de **Vixel Dev**; cliente Android personalizado por **Kylun** (aparece em "Sobre" e no rodapé).

### Situação do repositório

| Item | Estado |
|---|---|
| Commits | **1 único commit** (`5e7369d`) — histórico não preservado, tudo entrou de uma vez |
| Arquivos versionados | 27 |
| Linhas de código (sem assets binários) | ~3.634 |
| Versão declarada | **0.3.2** (`mobile-features.js:2` e `android/app/build.gradle` `versionName`, `versionCode 6`) |
| Licença | **Ausente** — nenhum `LICENSE` |
| CI | **Ausente** — nenhum workflow do GitHub Actions |
| Gerenciador de pacotes | **Ausente** — não há `package.json`; os testes rodam com `node` puro |
| Árvore de trabalho | limpa, nada pendente |

---

## 2. Estrutura de arquivos

```
matrix-mobile/
├── README.md                  478 B    visão geral curta
├── min.js                    60 KB   1.329 linhas  ← "cliente" principal (injetado primeiro)
├── mobile-features.js        29 KB     502 linhas  ← funcionalidades/ajustes do cliente
├── mobile-ui.js              29 KB     465 linhas  ← camada visual, painéis, chat, HUD de status
├── mobile-ui.css             21 KB     165 linhas  ← tema/tokens CSS injetados como string
├── image.png / image2.png    ~800 KB  screenshots (não referenciados em nenhum doc)
├── tests/
│   └── client-regressions.cjs 20 KB    317 linhas  ← 14 blocos de teste, 79 asserções
└── android/
    ├── README.md                        instruções de build + changelog (parcial)
    ├── build-local.cmd                  build no Windows usando ../../.android-tools
    ├── build.gradle / settings.gradle   AGP 8.7.3
    ├── gradle.properties                wrapper Gradle 8.9
    ├── gradlew, gradlew.bat, wrapper/   wrapper commitado (jar incluído)
    └── app/
        ├── build.gradle                 minSdk 26, targetSdk 35, versão 0.3.2
        └── src/main/
            ├── AndroidManifest.xml      activity única, paisagem, deep link /play
            ├── assets/bootstrap.js      orquestrador injetado (49 linhas)
            ├── java/.../MainActivity.java   275 linhas — WebView + ponte nativa
            └── res/                     tema, cores, ícone adaptativo (bola de futebol)
```

Observações de empacotamento:
- `android/app/build.gradle` **não guarda cópia** dos JS: a task `syncClient` copia `../min.js`, `../mobile-features.js`, `../mobile-ui.js`, `../mobile-ui.css` para `build/generated/clientAssets` no `preBuild`. Fonte única de verdade — bom.
- `.gitignore` cobre `.gradle/`, `**/build/`, `local.properties`, `.idea/`, `*.apk`.
- `image.png` / `image2.png` estão versionados mas **não são usados** por documentação nem por código.

---

## 3. Arquitetura em execução

### 3.1 Cadeia de injeção (o ponto mais importante para entender o projeto)

```
Android MainActivity.onCreate()
  ├─ readAsset("bootstrap.js")
  │    ├─ replace("/*CLIENT_SCRIPT*/",   min.js)
  │    ├─ replace("/*MOBILE_FEATURES*/", mobile-features.js)
  │    └─ replace("/*MOBILE_UI*/",       mobile-ui.js  ← com /*UI_STYLE_TEXT*/ trocado por mobile-ui.css citado em JSON)
  └─ webView.loadUrl("https://www.haxball.com/play")

WebViewClient.onPageFinished()  +  URL é haxball.com/play
  └─ evaluateJavascript(clientScript)
       └─ bootstrap.js: IIFE
            ├─ guarda contra dupla injeção (window.__haxballMobileStarted)
            ├─ espera o iframe .gameframe e as telas do jogo (até 120 × 250 ms = 30 s)
            ├─ força localStorage.low_latency_canvas = "0" (e recarrega uma vez)
            ├─ cria <meta viewport> se não existir
            └─ installClient():
                 min.js → mobile-features.js → mobile-ui.js   (nessa ordem!)
                 namespace público em window:
                   haxballMobileRelease  (solta joystick/chute ao perder foco)
                   haxballMobileBack     (botão Voltar do Android)
                   haxballMobileExport / haxballMobileImport (perfis)
                   haxballMobileCancelHud (cancelar editor do HUD)
```

**Consequência arquitetural crítica:** os três arquivos JS **não são módulos**. Eles são concatenados dentro de **uma única função `installClient()`** e compartilham o mesmo escopo léxico. Por isso:
- `mobile-features.js` usa `mobilePanelOpen`, `gameFrame`, `body`, `defaultSettings`, `defaultHudLayout`, `themes`, `controlStyleBase` etc. definidos em `min.js`;
- `mobile-ui.js` usa `mobileButton`, `mobileNode`, `openMobilePanel`, `settingRow` definidos em `mobile-features.js`;
- **a ordem dos `/*...*/` no `bootstrap.js` é acoplamento funcional**, não estilo. Trocar a ordem quebra tudo;
- `let`/`const` de nível superior viram variáveis locais da função — não há vazamento para `window` além do que é atribuído explicitamente.

### 3.2 Como o bundle "conversa" com o jogo

Todo o controle do HaxBall é feito **sem API oficial**, por manipulação de DOM e **eventos de teclado sintéticos**:

| Necessidade | Mecanismo usado |
|---|---|
| Mover o jogador | `gameFrame.document.dispatchEvent(new KeyboardEvent('keydown/keyup', {code:'KeyW/A/S/D'}))` (`min.js:851`) |
| Chutar | `KeyboardEvent` com `code:'KeyX'` (`min.js:759`) |
| Trocar visão do campo | `KeyboardEvent` com `key:'1'..'4'` (`mobile-features.js:191`) |
| Voltar de tela | `KeyboardEvent` `Escape` (`mobile-ui.js`) |
| Clicar em botões nativos | `element.click()` sobre `[data-hook=...]` |
| Volume | `MouseEvent` sintético sobre o slider nativo (`mobile-ui.js:255`) |
| Mover jogadores entre times | `row.ondragstart({dataTransfer})` / `target.ondrop(...)` reaproveitando o ID interno do HaxBall (`mobile-ui.js:340`) |
| Comandos de admin | mensagens de chat `!setteam <nome> red|blue|spec` (`min.js:398`) |

Ou seja: **o projeto depende inteiramente dos `data-hook` e das classes CSS internas do site do HaxBall**. Qualquer mudança de UI no site oficial (`.game-view`, `.roomlist-view`, `.gameframe`, `[data-hook=join]`…) pode quebrar o cliente. Isso está reconhecido no `android/README.md` ("Mudanças na estrutura do site podem exigir atualização do script").

### 3.3 Loop de atualização

`init()` (`min.js:171`) instala um único `MutationObserver` em `body` com `{childList:true, subtree:true}`:
- se os controles estão visíveis e a tela deixou de ser "de jogo" → esconde;
- `updateUI()` com **debounce de 100 ms** (comentário no código explica: o ping nativo atualiza continuamente, então agendar uma vez evita postergar indefinidamente);
- `updatedChat()` a cada mutação (idempotente via `WeakSet` `seenChatMessages`).

`updateUI()` (`min.js:291`) é uma **máquina de estados por seletores** que detecta a tela atual: nickname → lista de salas → criar sala → settings → captcha → jogo → admin de sala → link da sala; e então liga/desliga controles, cria botões e chama `enhanceMobileUI()`.

---

## 4. Funcionalidades (por arquivo)

### 4.1 `min.js` — o núcleo (1.329 linhas)

- **CSS de base** injetado no documento pai e no iframe do jogo (esconde `.header`, `.rightbar`, esconde botões nativos durante o boot, viraliza layout mobile).
- **Sistema de settings** (21 chaves em `defaultSettings`, `min.js:70`): vibração, macros, tema, tamanho/fundo/cascata/auto-ocultar do chat, modo de joystick, sensibilidade, zona morta, opacidade dos controles, zoom do campo, ping, FPS, opacidade da interface, escala de menus/textos, modo imersivo, animações, delay do chat. Persistido em `localStorage.hm_settings`.
- **Temas** (`themes`, `min.js:115`): light, auto, dark, blue, green, purple, black.
- **Joystick virtual** com `pointer/touch` por `identifier` (multi-touch correto: joystick e chute ao mesmo tempo), zona morta, sensibilidade, e conversão ângulo → WASD com `diagonalThreshold = 30°` (`updateJoystick`, `min.js:801`).
- **Chute multi-fonte**: `kickSources: Set` garante que soltar uma fonte (touch, macro, gamepad) não "engasga" o chute se outra ainda está pressionada (`kick`, `min.js:759`).
- **Macros de chute**: `2x` (chute duplo) e `FK` (fake) construídas com sequências de `setTimeout` canceláveis (`startKickMacro`, `min.js:778`).
- **Editor de HUD** (`enterHudEditMode`, `min.js:995`): overlay de arraste, sliders de tamanho por botão (8–35 vw), presets **Destro/Canhoto**, Cancelar/Salvar/Restaurar, persistência em `localStorage.hud_layout`.
- **Gamepad**: loop `requestAnimationFrame` lendo `navigator.getGamepads()` — analógico esquerdo → WASD, botões 0/2/7 → chute, botão 9 (Options) → chat; indicador visual e limpeza ao desconectar (`min.js:1231+`).
- **Chat**: intercepta o log nativo, guarda até 200 mensagens com cor (`chatHistory`), painel de histórico, `prefabMessage()` para enviar mensagens programaticamente, contador de não lidas.
- **Admin**: botões 🔴/🔵/👁 por jogador que disparam `!setteam`.
- **Buscador de salas**, filtro por país (`geo` / `geo_override`), dicas aleatórias, botões "Link da sala", "About us", "Mod Settings", "Store" (`/store`).
- **Gamepad/limpeza**: `releaseControls()` é o "ponto único de soltura" (chamado em `blur`, `visibilitychange`, `pause` do Android, abertura de painel).

### 4.2 `mobile-features.js` — configurações e persistência (502 linhas)

- **Painel de configurações em 7 abas**: Geral, Interface, Controles, Jogo, Áudio, Desempenho, Avançado — construído por helpers declarativos (`settingSelect`, `settingSlider`, `settingToggle`).
- **Perfis nomeados** (até 20) + **exportar/importar** por texto ou arquivo JSON.
- **`validateProfile()`** (`mobile-features.js:233`) é o ponto de segurança mais bem feito do projeto: valida `format`/`version`, tipo e faixa de cada setting, enums, 3 valores de controles com limites, e posição/tamanho do HUD (0–100 %, 8–35 vw). Nada é escrito no `localStorage` antes da validação completa.
- **Favoritos e recentes** (100 favoritos / 20 recentes) com `canonicalRoomUrl()` restringindo a `https://haxball.com|www.haxball.com/play?c=<token>` — bloqueia phishing e esquemas estranhos.
- **Entrar por link**, **entrar por nome** (com fallback: se houver nomes duplicados, pede seleção manual; aviso após 15 s se a sala não aparecer).
- **Joystick flutuante** (`floating-joystick-zone`, 50 % esquerdo/direito da tela) com reposicionamento e restauração ao soltar.
- **`handleMobileBack()`** (`mobile-features.js:472`): pilha de prioridades do botão Voltar — HUD → painel → chat → confirmação de saída → composer → preferências nativas → popup → sair da sala.
- **`translateMobileUI()`**: tradução PT-BR dos botões nativos por `data-hook`, e ajuste do título "Salas HaxBall".

### 4.3 `mobile-ui.js` — camada visual (465 linhas)

- **Sistema de design por CSS custom properties** (`--hm-bg`, `--hm-accent`, `--hm-opacity`, `--hm-scale`, `--hm-chat-size`…), aplicado nos **dois documentos** (pai e iframe), com `applyVisualSettings()` assinado por hash para evitar trabalho repetido.
- **Tema auto** via `prefers-color-scheme` com listener (`themeMedia.addEventListener`).
- **Menu rápido da partida** (☰): jogadores/times, chat, configurações, controles, info da sala, histórico, sair.
- **Chat móvel**: botão "Chat" com **badge de não lidas** (99+), esconde os controles enquanto o chat está aberto, cascata opcional das 5 últimas mensagens, auto-ocultar com timer, composer fixo com botão "Enviar".
- **HUD de status**: ícone de Wi-Fi + ping/pico + FPS lendo os valores **nativos** (`.stats-view [data-hook=ping|fps]`), com níveis good/fair/slow/poor/offline e `aria-label` descritivo. Oculto durante menus.
- **Lista de salas móvel**: linhas em grid, filtros (vaga, sem senha, favoritas, região) + ordenação (distância, jogadores) via `style.order` — **sem substituir as linhas nativas**, preservando os handlers originais.
- **Painel de sala**: altura limitada ao viewport, listas roláveis, colapso das seções de admin, tradução dos botões Red/Blue/Spectators, botão "Voltar ao jogo".
- **Drag-and-drop por toque** para admins moverem jogadores entre times, com "ghost" flutuante, hit-test por `elementFromPoint`, timeout de 300 ms para long-press, cancelamento em scroll/blur/resize/touchcancel.

### 4.4 `mobile-ui.css` (165 linhas)

Design system próprio: tokens em `:root`, alvos de toque de **44 px** mínimo, estados `:focus-visible`, `input[type=checkbox]` estilizado como switch, `env(safe-area-inset-*)` para notch, `@media(max-width:650px)`, `@media(max-height:360px)` (paisagem de celular), `@media(prefers-reduced-motion:reduce)` e animação `hm-enter` com duração configurável (`--hm-duration`: 160/70/0 ms).

---

## 5. Camada Android (`MainActivity.java` + manifest)

- **Activity única** (`Activity`, não `AppCompatActivity`), `screenOrientation="sensorLandscape"`, `launchMode="singleTask"`, `adjustResize` para o teclado.
- **WebView endurecida**: `setAllowFileAccess(false)`, `setAllowContentAccess(false)`, `MIXED_CONTENT_NEVER_ALLOW`, `usesCleartextTraffic="false"`, `allowBackup="false"`, sem `addJavascriptInterface` (nenhuma ponte JS→nativo exposta ao conteúdo remoto).
- **UA de desktop**: remove `; wv` e `" Mobile"` do User-Agent — necessário porque o HaxBall não serve a versão jogável para mobile.
- **Barras do sistema**: `WindowInsetsController` (API 30+) com fallback para `SYSTEM_UI_FLAG_IMMERSIVE_STICKY`; `FLAG_KEEP_SCREEN_ON`; `setOnApplyWindowInsetsListener` aplicando `displayCutout | systemBars | ime` como padding.
- **Controle de navegação**: só `haxball.com/play` carrega dentro do app; qualquer outro `https` abre no navegador externo; `haxmobile://` é interceptado e roteado para `share-room`, `export-profile`, `import-profile`.
- **Bridge de arquivos**: `ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT` com **limite de 32 KB** e validação de que o resultado é string JSON antes de gravar; importação passa por `JSONObject.quote()` (evita injeção na chamada `evaluateJavascript`).
- **Ciclo de vida**: `onPause` chama `haxballMobileRelease()` antes de `webView.onPause()` (evita movimento/chute "presos" em background); `onBackPressed` chama `haxballMobileBack()` e só mostra "Sair do HaxBall?" se o JS devolver `false`.
- **Erros**: diálogo de falha de rede com "Tentar novamente", Toast para erro HTTP; mensagens do JS com prefixo `HAXMOBILE:` viram Toast.
- **Deep link**: `https://(www.)haxball.com/play` com `android:pathPrefix="/play"`, validando o código `[a-zA-Z0-9_-]{1,256}` e reconstruindo a URL canônica.

Build: AGP **8.7.3**, Gradle **8.9**, JDK **17**, `compileSdk/targetSdk 35`, `minSdk 26` (Android 8.0), `versionCode 6 / versionName 0.3.2`. `build-local.cmd` espera uma pasta **externa** `../../.android-tools` (JDK/SDK/caches) que **não existe neste checkout** — é o ambiente da máquina do autor.

---

## 6. Testes

`tests/client-regressions.cjs` roda com `node` puro, sem dependências:

```
node tests/client-regressions.cjs     →  14 blocos PASS, 79 asserções, exit 0 (~1 s)
```

Estratégia: um **DOM falso** escrito à mão (`node()` com `style`, `attrs`, `handlers`, `children`, `getBoundingClientRect`), `vm.createContext` + `vm.runInContext` para carregar trechos do `min.js` por marcadores de texto (`section(a, b)`), e `vm.runInNewContext` para funções isoladas. O próprio `new vm.Script(bundle concatenado)` do topo funciona como **checagem de sintaxe do build**.

Verifiquei a execução **agora**: todos os 14 blocos passam.

Cobertura declarada (nome dos casos):
1. macros preservam chute segurado; eventos pendentes cancelam ao soltar;
2. desconexão de gamepad solta o chute e encerra o loop;
3. mensagens em lote do chat gravadas uma vez com suas cores;
4. painéis de sala/menus escondem os controles; settings preserva visibilidade;
5. reset/salvar do HUD; modo de edição suprime o jogo e remove listeners;
6. slider de tamanho atualiza largura inline; boot preserva tamanhos individuais;
7. painel de sala rola e mantém altura útil das listas;
8. validação de perfil rejeita entrada inválida sem escrever; URLs de sala restritas;
9. presets Destro/Canhoto espelham controles; Cancelar restaura;
10. joystick flutuante restaura posição; sensibilidade/zona morta afetam ativação;
11. HUD compacto preserva ping/FPS nativos e estados offline;
12. drag por toque transfere o ID nativo uma vez; tap abre opções; scroll/cancel nunca movem jogadores;
13. painel de chat preserva recebidas/enviadas, contador, ocultação e cascata;
14. modais nativos bloqueiam o jogo; Voltar cancela a confirmação de saída.

**Não coberto:** nada do lado Android (Java não tem teste algum), nada de renderização real (os testes usam DOM falso), nada de integração com o site real do HaxBall.

---

## 7. Avaliação técnica

### Pontos fortes

1. **Consciência de multi-touch** — controle por `identifier`, `kickSources` como Set, fluxo de "soltar" centralizado em `releaseControls()`. É exatamente onde clientes mobile do HaxBall costumam falhar.
2. **Preservação do DOM nativo** — filtros/ordenação de salas e drag de jogadores reaproveitam os elementos e handlers originais em vez de recriá-los. Reduz muito o risco de quebrar lógica do jogo.
3. **Validação de entrada de verdade** — `validateProfile()`, `canonicalRoomUrl()`, limite de 32 KB e `JSONObject.quote()` no lado Java. Postura defensiva acima da média para um projeto desse tipo.
4. **WebView configurada com critério** — sem `JavascriptInterface`, mixed content bloqueado, file/content access desligados, links externos fora do app.
5. **Ciclo de vida bem tratado** — blur, `visibilitychange`, `onPause` e `onBackPressed` todos passando pelo mesmo ponto de liberação.
6. **Fonte única dos assets** — a task `syncClient` do Gradle evita a "segunda cópia que ninguém atualiza".
7. **Testes de regressão reais e baratos** — 14 cenários que efetivamente pegariam as regressões mais prováveis, sem dependências.
8. **Acessibilidade** acima do esperado: `aria-label`, `aria-selected`, `aria-expanded`, `:focus-visible` e respeito a `prefers-reduced-motion`.

### Riscos e fragilidades

| # | Risco | Detalhe |
|---|---|---|
| 1 | **Dependência total de seletores do site oficial** | `data-hook`, `.game-view`, `.roomlist-view`, `.player-list-item`… Qualquer refactor do HaxBall quebra o cliente. Não há camada de adaptação nem teste contra o site real. |
| 2 | **Escopo global compartilhado por concatenação** | Ordem dos `/*...*/` no `bootstrap.js` é contrato implícito; não há `import`/`export` nem checagem. Renomear algo em `min.js` quebra `mobile-features.js` silenciosamente em runtime. |
| 3 | **Admin via `!setteam`** | `setupAdminPlayerButtons` envia comandos de chat que **só funcionam se o bot da sala suportar**. Não é API do HaxBall. |
| 4 | **Duplicação de funcionalidades** | Existem **dois** históricos de chat (`chatHistoryPanel` em `min.js:599` e `openMobileChatHistory()` em `mobile-ui.js:56`) e **dois** caminhos de configuração (`settingsMenuHandler`/`renderSettingsMenu` em `min.js:514` e `renderMobileSettings` em `mobile-features.js:108`). |
| 5 | **Código morto / resíduos** | `aboutHandler` (diálogo "HaxBall Mobile") é criado mas nunca exibido — "Sobre" abre `openMobileAbout()`; `updateControlsSettingsNumbers`/`onControlsSettingsInput` só são acionados pelo fluxo nativo legado; `saved` é atribuído e não usado em `getSetting`/`setSetting` (`min.js:95,102`); a lógica de reload de `low_latency_canvas` existe **duas vezes** (`min.js:5` e `bootstrap.js:16`). |
| 6 | **Typo no símbolo público** | `constrolsStyleBase` (`min.js:33`) — nome errado, replicado em `mobile-features.js:177`. Custo zero para corrigir, mas hoje é contrato. |
| 7 | **Acento quebrado no `android/README.md`** | O arquivo está em UTF-8 com `?` no lugar de acentos ("prot?tipo", "Configura??es") — corrupção de encoding anterior, provavelmente de edição em cp1252. |
| 8 | **Documentação desatualizada** | O `android/README.md` para na versão **0.2.0**, mas o app está em **0.3.2** (3 versões sem changelog). O `README.md` raiz não menciona `image.png`/`image2.png` nem como rodar os testes. |
| 9 | **Sem licença** | Código público sem `LICENSE`, e derivado de trabalho de terceiros (basro / Vixel Dev). Situação jurídica indefinida — vale escolher uma licença e manter o crédito. |
| 10 | **Sem build reprodutível fora da máquina do autor** | `build-local.cmd` aponta para `../../.android-tools`, inexistente no repositório; não há CI para compilar o APK nem rodar os testes. |
| 11 | **Strings PT-BR mistas** | Parte do código usa `\u00e3`/`\u00e7`, parte usa acentos literais (`translateMobileUI`), parte não tem acento ("Historico", "Configuracoes" em alguns pontos). Inconsistência visível na UI. |
| 12 | **Assets de screenshot versionados sem uso** | ~800 KB de PNGs no repositório sem referência em nenhum documento (deveriam estar em docs/ ou ser citados no README). |
| 13 | **Um único commit** | O histórico foi achatado — perde-se a rastreabilidade das 3+ versões descritas no changelog. |

### Métricas de robustez observadas

- **Pontos de falha silenciosa**: vários `try {} catch {}` vazios (`applySettings`, `emulateKeys`, `updateUI` no observer, `installClient`). Isso mantém o app vivo, mas esconde quebras de integração — um `console.warn` com prefixo `HAXMOBILE:` (que já viraria Toast) seria mais útil.
- **Padrão de erro consistente**: `mobileNotice()` para o usuário + `console.error('HAXMOBILE: ...')` para diagnóstico via Toast. Bom.
- **Sem telemetria**: nada sai do dispositivo; `readAsset`/`localStorage` apenas. Alinhado com o discurso de "nenhum dado de identidade é exportado".

---

## 8. Sugestões priorizadas

**Curto prazo (baixo risco, alto ganho)**
1. Criar `LICENSE` (MIT/Apache-2.0) mantendo os créditos de basro, Vixel Dev e Kylun.
2. Adicionar `package.json` com `"scripts": { "test": "node tests/client-regressions.cjs" }` e um workflow de CI (`npm test` + `assembleDebug`).
3. Corrigir o encoding do `android/README.md` e completar o changelog até **0.3.2**.
4. Atualizar o `README.md` raiz: como rodar os testes, prints (`image.png`/`image2.png`), estrutura de injeção, aviso de que é cliente não oficial.
5. Remover (ou mover para `docs/`) os PNGs não referenciados; remover `aboutHandler` morto e as variáveis `saved` não usadas; corrigir `constrolsStyleBase` → `controlsStyleBase`.

**Médio prazo (arquitetura)**
6. Trocar a concatenação por um **build explícito** (esbuild/rollup gerando um único `bundle.js` com ordem declarada e checagem de símbolos), mantendo o `evaluateJavascript` de um só arquivo. Elimina a classe de bug "ordem/escopo compartilhado".
7. Unificar os dois históricos de chat e os dois caminhos de configuração.
8. Extrair uma **camada de adaptação** (`hooks.js`) concentrando todos os seletores `data-hook`/classes do HaxBall num único lugar — quando o site mudar, mexe-se em um arquivo.
9. Padronizar i18n: um dicionário único de strings PT-BR (com acentos corretos) em vez de literais espalhados.

**Longo prazo**
10. Testes de integração com Playwright/WebView contra uma **página mock** que replique os `data-hook` do HaxBall — permitiria detectar quebras sem aparelho real.
11. Validação em aparelho real (o próprio README admite pendência: WebRTC, desempenho, gamepad e compatibilidade com a página atual).

---

## 9. Resumo em uma frase

**Matrix Mobile** é um cliente Android de ~3,6 mil linhas que injeta uma camada de UI/controles em JavaScript dentro do site oficial do HaxBall, com engenharia de multi-touch, validação de perfis e endurecimento de WebView acima da média, mas **fortemente acoplada aos seletores internos do site**, sem licença, sem CI e com documentação defasada em três versões.
