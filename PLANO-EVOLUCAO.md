# Matrix Mobile 2.0 — Plano de evolução para nível profissional

> **Documento de análise e planejamento.** Nada foi alterado no app nesta fase.
> Base: checkout de `arena/6b48c373-matrix-mobile` (commit `5e7369d`), análise estática completa + execução da suíte de testes.
> Data: 28/10/2026.

---

## 1. Veredito direto

**Sim, dá para levar esse projeto a um nível profissional — e o teto é alto, mas não é infinito.**

O ponto que muda tudo é uma descoberta técnica desta análise: **hoje o projeto não toca no motor de render em momento algum** (zero referências a `canvas`, `getContext`, `requestAnimationFrame` na camada de UI — só no loop de gamepad). Ele é 100% "skin de DOM por cima do jogo". Isso explica por que a aparência atual é competente mas genérica: **não há como animar a bola, o campo ou o chute sem entrar no canvas**.

E dá para entrar. O HaxBall 2 renderiza em **Canvas 2D** com `requestAnimationFrame` (confirmado: o próprio site expõe a opção "Use low latency canvas", que é o `desynchronized` do Chromium — e este projeto já força `low_latency_canvas = 0` em dois lugares: `min.js:5` e `bootstrap.js:16`). Como o `.gameframe` é **same-origin**, temos acesso ao `window` do jogo e podemos **interceptar a `CanvasRenderingContext2D.prototype` daquele frame**. A partir disso passamos a conhecer, em tempo real e com precisão, **a posição e o raio de cada disco desenhado: bola, jogadores e até o goleiro**.

Isso desbloqueia a categoria de recursos que hoje é impossível:

| Recurso "de jogo de futebol de verdade" | Viável? | Como |
|---|---|---|
| Rastro na bola com intensidade por velocidade | ✅ | hook em `arc()` → posição da bola → canvas de efeitos |
| Impacto de chute (ripple + flash + vibração) | ✅ | evento de chute próprio + posição da bola |
| Câmera shake no gol | ✅ | `transform` no canvas do jogo (1 layer GPU) |
| Celebração de gol em tela cheia + ticker | ✅ | delta do placar nativo no DOM |
| **Radar/minimapa com todos os jogadores** | ✅ | hook captura **todos** os discos |
| **Replay do último gol** (trajetórias reconstruídas) | 🟡 ambicioso | gravar posições e re-renderizar no overlay |
| Grama estilizada, faixas, vinheta, color grading | ✅ | filtros/overlays CSS no canvas (GPU) |
| Sons novos (chute, rede, apito, torcida) | ✅ | WebAudio sintetizado, 0 KB de assets |
| HUD de transmissão (placar, cronômetro, escalações) | ✅ | DOM + nosso design system |
| Física, rede, anti-cheat, servidores | ❌ | são do HaxBall; não se toca |

**O que eu não consigo (e ninguém consegue sem reescrever o jogo):** alterar física, latência de rede, regras, tickrate, ou transformar isso num jogo autônomo. Também não dá para garantir que o visual continue funcionando se o site oficial mudar os `data-hook`/renderer — o risco é estrutural e será **mitigado**, não eliminado.

**Conclusão:** o salto de "cliente modado" para "experiência mobile de futebol com identidade própria" é realista. Estimo o resultado como algo no nível de um app indie bem-acabado — não como FIFA/eFootball, mas com a mesma *linguagem* de polimento (HUD limpo, movimento com intenção, som com peso, feedback em cada toque).

---

## 2. O diagnóstico honesto do que existe hoje

### O que já é bom (não vou estragar)
- Multi-touch correto por `pointer identifier`, `kickSources` como `Set`, `releaseControls()` como ponto único de soltura (blur, `visibilitychange`, `onPause` do Android). Isso é o que 90% dos clones erram.
- Preservação do DOM nativo (filtros de sala, drag de jogadores) em vez de recriar.
- `validateProfile()` validando faixa/tipo de tudo antes de escrever; `canonicalRoomUrl()` anti-phishing; WebView sem `JavascriptInterface`, mixed content bloqueado, limite de 32 KB na ponte de arquivos.
- 14 blocos de teste de regressão verdes, sem dependências.

### Os 6 problemas que impedem o "nível profissional"

| # | Problema | Evidência medida | Impacto |
|---|---|---|---|
| 1 | **Zero controle sobre o render** | 0 refs a canvas/ctx na UI | Sem bola, sem efeito, sem alma |
| 2 | **Guerra de especificidade CSS** | **197** `!important` em 165 linhas | Tema frágil, qualquer ajuste quebra outro; payload inflado |
| 3 | **Forced reflow no caminho quente** | `updatedChat()` roda **síncrono em toda mutação** do `MutationObserver {subtree:true}` e lê `scrollHeight/clientHeight/scrollTop` (layout forçado); `applyHudPositions()` lê `getBoundingClientRect` a cada `applySettings()` | Engasgo em chat cheio e ao arrastar sliders |
| 4 | **Arquitetura por concatenação** | 3 arquivos num escopo só, ordem = contrato implícito | Refatorar é arriscado; não escala para 8 módulos |
| 5 | **Duplicação e código morto** | 2 históricos de chat, 2 caminhos de settings, `aboutHandler` nunca exibido, `constrolsStyleBase` (typo), reload duplicado | Peso e confusão em cada mudança |
| 6 | **Sem áudio próprio, sem haptics, sem motion spec** | único áudio = `navigator.vibrate(30)` no chute | Percepção de "site com CSS", não de jogo |

Some a isso: sem `LICENSE`, sem CI, sem `package.json`, README parado na 0.2.0 e `android/README.md` com acentuação corrompida.

---

## 3. As cinco alavancas técnicas

### Alavanca A — Camada de render própria (`fx`)
Interceptar `CanvasRenderingContext2D.prototype` **dentro do frame do jogo** (`gameFrame.CanvasRenderingContext2D.prototype.arc/fill/stroke/setTransform`), capturar `(x, y, r)` + `getTransform()` por frame, classificar discos por cor/raio (bola = disco claro pequeno; jogadores = cores de time; raio grande = campo). Um **overlay canvas** próprio, empilhado acima do canvas do jogo, recebe então:
- rastro da bola (gradiente por velocidade, some em ~180 ms),
- anel de impacto no chute, flash curto no contato,
- partículas no gol, vinheta pulsante,
- **minimapa** e, se der, replay reconstruído.
Custo: um único `rAF` que **só existe enquanto há efeito na tela** (idle → 0 % de CPU). Sempre atrás de flag e com detecção de capacidade. Se a interceptação falhar (renderer mudou), degrada em silêncio para o modo atual — nunca quebra o jogo.

### Alavanca B — Motor de áudio (`audio`)
WebAudio **sintetizado**: chute (thump + ruído curto), rede/trave, apito, torcida (ruído filtrado com envelope), cliques de UI. Vantagens: **0 KB no APK**, latência ~0, mixagem com compressor/limiter e buses separados (efeitos/UI/torcida), volume por categoria. Modos: `Original` / `Matrix` (substitui) / `Ambos`, com ganho compensado para não duplicar transientes. Haptics pareados a cada evento.

### Alavanca C — Design system v2 (`ui`)
Tokens reais (cor, elevação, raio, espaçamento 4 pt, escala tipográfica, movimento 120/180/240 ms + curvas), componentes (`Panel`, `Sheet`, `Toggle`, `Slider`, `Card`, `TabBar`, `Toast`, `Scoreboard`), tudo em **CSS Layers** (`@layer reset, tokens, components, screens, overrides`) — isso mata os 197 `!important` de forma incremental e segura. Dark-first, com acento derivado da cor do time do jogador.

### Alavanca D — Desempenho (`perf`)
Orçamento explícito e testável: **≤ 2 ms/frame de trabalho nosso**, ≤ 8 MB de heap adicional, ≤ 250 ms de tempo-até-jogável após `onPageCommitVisible`. Técnicas já mapeadas nos hotspots reais:
- `updatedChat()` sai do observer síncrono → entra num scheduler rAF/`requestIdleCallback` com cache de métricas;
- `applyHudPositions`/`applyMobileSettings` escrevem em **CSS custom properties** em vez de lerem layout por elemento;
- `contain: layout paint style` nos painéis, `content-visibility: auto` em listas longas;
- remover `box-shadow`/`blur` de elementos repetidos; efeitos vão para o **canvas**, não para o DOM;
- injeção em **3 estágios** (núcleo de controles → UI → cosméticos) para reduzir o tempo até jogar;
- Android: `setRendererPriorityPolicy(RENDERER_PRIORITY_IMPORTANT, false)`, `LAYER_TYPE_HARDWARE`, `setWebContentsDebuggingEnabled(false)` em release, cache de assets, `overScrollMode = NEVER`;
- bundle minificado (140 KB → ~45 KB) e um **modo "Latência"** que religa `low_latency_canvas` e desliga toda a camada de efeitos.

### Alavanca E — Arquitetura e processo
`src/` modular compilado com **esbuild** em um único `bundle.js` IIFE (o Android continua injetando **um** arquivo, como hoje), com:
```
src/
  platform/android-bridge.js   (haxmobile://, export/import)
  haxball/adapter.js           ← TODOS os seletores data-hook/classes num só lugar
  haxball/probe.js             ← detecção de capacidade + degradação graciosa
  core/{controls,settings,state,store}.js
  fx/{ball-tracker,overlay,effects,minimap}.js
  audio/{engine,sfx,ducking}.js
  ui/{tokens.css,components/*,screens/*,hud}
  features/{rooms,profiles,chat,players}.js
```
Mais: `package.json`, ESLint + Prettier, CI (testes + `assembleDebug`), `LICENSE`, README com prints, changelog até 0.3.2 e `android/README.md` reescrito com encoding correto.

---

## 4. Roadmap em fases

Cada fase é **entregável e jogável** por si só, com critério de aceite. Se algo falhar, o app continua funcionando como hoje.

### Fase 0 — Fundação (sem mudar aparência)
- `package.json`, esbuild, `src/` modular, `dist/bundle.js`, `syncClient` apontando para o dist.
- Extração do **adapter** de seletores + `probe.js` com modo degradado.
- Remoção de código morto/duplicado; `LICENSE`; CI; docs corrigidos; 197 `!important` migrados para `@layer` **sem regressão visual**.
- Suíte de testes migrada e estendida; **Playwright + página mock do HaxBall** (canvas + data-hooks) para testar de verdade.
- **Aceite:** suite verde, bundle ≤ 60 KB, APK compila, zero diff visual.

### Fase 1 — Desempenho e fluidez
- Scheduler central (rAF + idle), fim do reflow forçado, CSS vars no lugar de layout reads.
- Estágios de injeção; minificação; flags Android; modo "Latência".
- **Aceite:** ≤ 2 ms/frame medido no mock; queda de 30 %+ no tempo até jogável; FPS nativo inalterado em teste A/B.

### Fase 2 — Design system + HUD de transmissão
- Tokens, componentes, motion spec, ícones SVG próprios.
- Novo HUD: placar com cores dos times, cronômetro, indicador de ping/FPS discreto, FABs, joystick e chute redesenhados (com anel de progresso de carga), painéis em sheet animado.
- Telas: lista de salas em cards, sala, configurações 2.0, onboarding de primeira execução.
- **Aceite:** 100 % dos fluxos existentes preservados; nenhum texto cortado em 776×328 e 360×640; alvos ≥ 44 px.

### Fase 3 — Áudio + haptics
- Motor WebAudio completo, buses, limiter, presets, 3 modos de áudio.
- Haptics por evento (kick, gol, apito, borda).
- **Aceite:** latência perceptível < 30 ms; sem clipping; silêncio em background; 0 KB de assets.

### Fase 4 — Camada de render (`fx`)
- Ball tracker, overlay, rastro, impacto, shake, vinheta, minimapa.
- Grama/faixas/color grading toggláveis.
- **Aceite:** detecção de bola estável ≥ 99 % dos frames no mock; efeitos desligam sozinhos se o probe falhar; **0 ms de custo com efeitos off**.

### Fase 5 — Pacote "jogo de verdade"
- Celebração de gol em tela cheia, ticker de eventos, contagem regressiva, cartão de fim de partida, estatísticas reconstruídas da nossa captura.
- Presets de experiência: **Leve / Equilibrado / Cinematográfico / Latência mínima**.
- **Aceite:** trocar preset muda tudo em ≤ 1 frame; preset Leve roda em aparelho de entrada.

### Fase 6 — Polimento e release
- Acessibilidade (daltonismo, escala, reduce motion), i18n PT/EN/ES, migração de perfis v1→v2, safe mode (boot sem cosméticos), assinatura de release, guia de validação em aparelho real.

---

## 5. Riscos e mitigação

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Site do HaxBall muda seletores/renderer | Alta (histórico do projeto mostra isso) | Adapter central + probe + modo degradado + testes contra mock + aviso `HAXMOBILE:` |
| Hook no canvas quebra ou custa caro | Média | Feature flag, auto-disable por medição de FPS, fallback CSS-only |
| Overlay criando latência de input | Média | Efeitos em canvas separado e `pointer-events:none`; modo Latência religa low-latency canvas |
| WebView antiga sem `getTransform` / WebAudio | Baixa | Polyfill/capability check, degradação em 3 níveis |
| Termos de uso / direitos do HaxBall | **Relevante** | Não redistribuir o motor; manter créditos (basro, Vixel Dev); documentar que é cliente não oficial; avaliar distribuição fora de stores |
| Escopo grande demais | Alta | Fases independentes, cada uma entregável; nada quebra o que existe |
| Perder a robustez atual | Média | A suíte de 14 cenários vira gate obrigatório de cada fase |

---

## 6. Decisões que eu tomaria por padrão (ajustáveis depois)

1. **Visual:** dark-first, acento derivado do time, sem excesso de vidro/blur (custa caro no WebView). "Cinematográfico" é preset, não padrão.
2. **Efeitos:** padrão **adaptativo** — mede FPS nos primeiros 3 s e escolhe o tier (Leve/Equilibrado/Cinematográfico).
3. **Áudio:** padrão **Matrix** (sintetizado), com opção de voltar ao original.
4. **Custo de latência:** manter `low_latency_canvas = 0` (necessário para overlay confiável), com preset explícito "Latência mínima" que reverte.
5. **Compatibilidade:** o modo degradado precisa ser **indistinguível do app atual** — é o nosso piso de segurança.

---

## 7. Ordem de ataque recomendada

Se eu começar, a sequência é **0 → 1 → 2 → 3 → 4 → 5 → 6**, com um corte vertical em cada fase (código + teste + doc). Os dois primeiros dias de trabalho rendem pouco visual e muito futuro: sem a fundação da Fase 0, cada fase seguinte vira dívida. O primeiro efeito visível de verdade chega na **Fase 2** (HUD novo) e o "uau" na **Fase 4** (bola, gol, som).

---

## 8. Resumo em uma frase

O projeto tem base sólida de engenharia (multi-touch, validação, WebView segura) e um teto visual baixo **apenas porque nunca tocou no canvas**; com um adapter de seletores, um design system próprio, um motor de áudio sintetizado e uma camada de efeitos alimentada por hook no `CanvasRenderingContext2D`, ele vira uma experiência mobile de futebol com identidade — mantendo fallback que é idêntico ao app de hoje se o HaxBall mudar.
