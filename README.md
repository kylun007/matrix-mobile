# Matrix Mobile

Cliente Android **não oficial** do [HaxBall](https://www.haxball.com/play), focado em jogar no celular com conforto. O app carrega a página oficial do jogo num WebView e injeta uma camada própria de interface, controles e câmera — o motor, a rede e as regras continuam sendo do HaxBall.

> Jogo original: Mario Carbajal ([@basro](https://github.com/basro)). Adaptação mobile original: Vixel Dev. Cliente Android e interface atual: Kylun.

## O que o cliente adiciona

**Controles**
- Joystick fixo ou flutuante, com sensibilidade e zona morta ajustáveis
- Chute multi-toque (segurar chute e mover ao mesmo tempo)
- Macros de chute `2x` e `FK`, com liberação automática ao soltar/perder foco
- Suporte a gamepad (analógico + botões), com liberação no desconectar
- Editor de HUD: arraste, tamanho por botão e presets Destro/Canhoto

**Câmera inteligente**
- Desloca o campo quando o jogador fica embaixo do joystick ou do botão de chute
- Mola amortecida + histerese (sem tremida), com a bola sempre priorizada na tela
- Modos Desligada / Fixa / Inteligente, intensidade ajustável e anel de destaque no jogador
- Fallback automático: se o renderer do jogo mudar, o app continua funcionando

**Interface**
- Design system próprio (tokens, modo claro/escuro/auto, animações configuráveis)
- Quatro peles completas — **Matrix** (padrão), **Moderno**, **Cartoon** e **Clássico** —
  com paleta, acabamento e sons próprios, trocáveis em Ajustes › Tema
- Tela inicial própria no lugar da tela crua do HaxBall: Saturno desenhado em CSS,
  nick com contador e sorteio, salvo no aparelho e repassado ao cliente original
- Painéis em *sheet*, abas segmentadas, switches e sliders com alvo de toque de 44 px
- Lista de salas com cabeçalho próprio (marca, contagem e atalhos), cartões de uma
  linha com vaga/senha/região/distância, filtros e ordenação; a barra de ações fica
  fixa embaixo (Entrar + "…") e as demais ações abrem numa folha, sem cobrir a lista
- Dock de ações no topo, chat com contador de não lidas e cascata opcional
- Indicador de ping/FPS lendo os valores nativos, com níveis de qualidade
- Sons de interface sintetizados (sem arquivos de áudio): cada pele tem o seu timbre

**Sessão**
- Favoritos e recentes (com link canônico validado), entrada por link ou por nome
- Perfis nomeados exportáveis/importáveis (texto ou arquivo JSON), versão v1
- Histórico de chat (últimas 200 mensagens) e tradução PT-BR dos menus

## Estrutura

```
min.js                      núcleo: controles, chute, macros, HUD, settings
mobile-features.js          painéis, componentes, perfis, salas, navegação
mobile-ui.js                camada visual, dock, chat, métricas e câmera
mobile-ui.css               design system (tokens + componentes + telas)
android/                    app Android (WebView + bridge de arquivos)
tests/                      regressões, matemática da câmera e smoke de UI
```

Os três arquivos JS são concatenados dentro de uma única função por
`android/app/src/main/assets/bootstrap.js` e injetados via `evaluateJavascript`.
Eles compartilham escopo: a ordem de injeção é um contrato.

## Desenvolvimento

```bash
npm ci          # instala jsdom (apenas para os testes)
npm run check   # checagem de sintaxe dos arquivos injetados
npm test        # regressões + câmera + smoke de interface
```

- `tests/client-regressions.cjs` — 14 cenários de comportamento (multi-touch, macros, chat, HUD, perfis, salas)
- `tests/camera-math.test.cjs` — oclusão, histerese, proteção da bola e estabilidade da mola
- `tests/ui-smoke.test.cjs` — carrega o bundle real em jsdom e exercita os painéis

## Build do app

Veja [android/README.md](android/README.md).

## Limitações conhecidas

- A interface depende dos seletores internos do HaxBall (`data-hook`, `.game-view`). Mudanças no site podem exigir atualização.
- A câmera usa o renderer 2D do jogo; se o cliente mudar de renderer, o modo inteligente cai para o deslocamento fixo.
- Validação em aparelho real (WebRTC, desempenho, gamepad) segue pendente.
- Este projeto não é afiliado ao HaxBall.
