# Análise — Câmera inteligente e oclusão do polegar no HaxBall mobile

> **Documento de análise.** Nenhum arquivo do app foi alterado.
> Objetivo: responder se é possível corrigir o problema do dedo em cima do jogador — e como.
> Data: 28/10/2026.

---

## 1. Resposta curta

**Sim, é possível — e a sua ideia está certa, mas o "centro da tela" é o alvo errado.** O alvo certo é **"fora da zona do polegar"**, que não é o centro: é a região livre entre os dois polegares. E há **três níveis de solução**, do mais nativo ao mais invasivo, sendo que **o melhor não é o mais óbvio**.

Também descobri algo que muda o diagnóstico: **a câmera do HaxBall não segue a bola nem o jogador — ela segue a média entre os dois**, e é **limitada por um retângulo definido pelo stadium**. Isso está documentado oficialmente (wiki do repositório `haxball/haxball-issues`) e explica *exatamente* por que o pior caso é o canto:

> `width` / `height`: "The width/height of a rectangle centered in coordinates <0,0> **in which the camera will be contained**. The camera follows the player and ball until it reaches the bounds of this rectangle."
>
> `cameraFollow`: "If set to **"player"** the camera will follow the player only, ignoring the ball. If set to **"ball"** the camera will follow **the average position between the player and the ball**, the camera will **prioritize the player** in case player and ball are too far apart." (padrão: `"ball"`)
>
> `maxViewWidth`: "The maximum allowed viewable width for the level. If the player screen were wide enough to see more width than maxViewWidth then the game will **zoom in** to prevent that. Setting to 0 disables."

Três consequências diretas:

1. **Por que o jogador fica embaixo do dedo**: a câmera mira o **meio do caminho entre você e a bola**. Se você está no canto inferior esquerdo defendendo e a bola está longe (à direita), a câmera fica no meio — e você é desenhado **encostado na borda inferior esquerda da tela**, que é exatamente onde está o joystick.
2. **Existe uma alavanca nativa**: `cameraFollow: "player"` faz a câmera seguir **só o jogador**, com o smoothing do próprio motor. É literalmente o sistema que você descreveu, já implementado pela basro.
3. **No canto, a câmera do jogo não pode mais se mexer** (ela bate no retângulo de contenção). Ou seja: uma solução que só "recentraliza a câmera" falha justamente no pior caso. A correção precisa ser um **deslocamento em espaço de tela** (aplicado depois), não uma mudança no centro da câmera do jogo.

---

## 2. Dimensionando o problema (números reais do seu layout)

Com o viewport de teste que o projeto já usa — **776 × 328** (paisagem de celular) — e o HUD padrão (`joystick: left 5%, bottom 8%, size 20vw`):

| Medida | Valor |
|---|---|
| Diâmetro do joystick | 155 px (20% da largura) |
| Retângulo ocupado | x ≈ 39–194 px, y ≈ 147–302 px |
| Área do widget | ≈ 9,4 % da tela |
| Área **efetivamente coberta** (widget + contato do dedo ~48 px ao redor) | ≈ **16 %** da tela |
| Onde | canto inferior esquerdo — **a região de onde se defende** quando você ataca para a direita |

Some a isso o botão de chute no canto inferior direito (~mesma área): **quase um terço da tela** fica sob os polegares em situação de posse/defesa. Em um campo de 776 px de largura, 155 px de joystick é **20 % do campo** — e no HaxBall o seu jogador tem ~10 px de raio. Ou seja: o dedo cobre **~15 vezes** a área do seu personagem.

**Isso não é um problema de UI — é de câmera.** Reduzir a opacidade do joystick não resolve: o dedo continua no lugar. Mover o joystick também não: o polegar continua sobre o campo. A única família de soluções que resolve de fato é **mover o conteúdo do jogo para fora da zona dos polegares**.

---

## 3. Por que "centro da tela" não é o alvo ideal

Se colocarmos você no centro geométrico, você sai da zona do polegar (que é periférica) — mas perde a referência do gol, do campo e da bola. Pior: **o centro é onde a bola costuma estar** (a câmera média mantém a bola próxima do centro). Recentralizar em você significa **tirar a bola do centro**, e às vezes da tela.

O alvo correto é um **ponto de interesse ponderado**:

```
alvo = bola × w_bola + jogador × w_jogador
```

onde `w_jogador` sobe **só quando você está dentro de uma zona ocluída** (a sua ideia de "só quando sai do canto, volta ao normal" — mas com histerese e suavização, senão a câmera oscila). E com uma restrição dura: **a bola nunca pode sair de uma caixa central de segurança** (ex.: 82 % da tela). Se o alvo ponderado empurrar a bola para fora, o peso do jogador é reduzido automaticamente — o jogo precisa continuar jogável.

Zonas de oclusão não são fixas: o projeto **já persiste a posição e o tamanho do HUD** (`hud_layout`), então as zonas podem ser **calculadas do layout real** — inclusive nos presets Destro/Canhoto e no joystick flutuante (que se move com o dedo: nesse caso a zona é a posição do último toque, não o widget).

---

## 4. Os caminhos possíveis

### Caminho A — Forçar `cameraFollow: "player"` localmente (nativo do motor)
O stadium chega do servidor como JSON e é interpretado pelo cliente. Se interceptarmos o parse no frame do jogo e trocarmos `"ball"` por `"player"`, **a própria engine** centraliza em você, com o smoothing dela, sem CSS, sem clipping, sem custo de frame.

- **Prós**: zero jitter, zero código de física, aparência "nativa", implementação pequena, é exatamente o sistema que você pediu.
- **Contras**: a bola **pode sair da tela** quando você está longe dela (é por isso que o padrão é a média). Para GK isso é bom; para quem ataca, ruim.
- **Risco**: depende de onde/como o stadium é parseado (provável `JSON.parse` no frame do jogo) — **precisa de probe**. Se o cliente validar/integrar o objeto em outro ponto, o override não pega.
- **Competitividade**: não dá vantagem de informação (na verdade **reduz** — você vê menos do campo). Ética OK.

### Caminho B — Viés em espaço de tela no renderer (recomendado)
Hook em `CanvasRenderingContext2D.prototype.setTransform/translate` **dentro do frame do jogo**: lemos a matriz da câmera (posição + escala) e **somamos um offset em pixels** ao transform de mundo. O jogo continua com a câmera dele; nós só empurramos o desenho.

- **Prós**: **funciona mesmo com a câmera clamped no canto** (que é o caso crítico); não altera o estado do jogo; permite o blend jogador/bola exato; dá de graça a posição da bola e dos jogadores (necessária para todo o pacote visual da Fase 4).
- **Contras**: desloca o mundo e pode mostrar um pouco da área fora do stadium (preto — o HaxBall já mostra preto ao redor do campo, então é discreto); exige que o probe confirme o padrão de transform.
- **Risco**: médio. Mitigado por feature flag + auto-desligar se o probe falhar.

### Caminho C — Pan por CSS no canvas (fallback sem tocar no renderer)
`canvas.style.transform = translate(dx,dy) scale(s)`. Não precisa saber nada do internals.

- **Prós**: **certeza absoluta de funcionamento** — é o nosso próprio DOM; implementação em horas.
- **Contras**: **não sabe onde você está** (sem o hook do Caminho B não há como seguir o jogador); só permite deslocamento fixo; como não há margem, é preciso **zoom-in de ~6–10 %** para não deixar faixa vazia — e isso **reduz** o campo visível, que é o oposto do que mobile precisa.
- **Veredito**: serve como **fallback de emergência**, não como solução principal.

### Caminho D — Letterbox: o campo nunca desenha sob os polegares
Redimensionar o **iframe do jogo** (não só o canvas: o HaxBall lê o tamanho da janela) para ~72–76 % da altura, e usar a faixa inferior como área de controles.

- **Prós**: resolve **independentemente da posição do jogador**; zero dependência de internals; combina com o design system (barra de controles dedicada, como jogos mobile de futebol).
- **Contras**: **perde 25–30 % da área de jogo** — em 776×328 isso é brutal. Só faz sentido combinado com o Caminho A/F (câmera do motor) e/ou em aparelhos com tela maior.
- **Veredito**: opção do usuário ("modo barra de controles"), não padrão.

### Caminho E — Mitigações sem mexer na câmera (valem de qualquer forma)
Estas não resolvem sozinhas, mas **reduzem muito a dor** e são baratas:

1. **Anel/contorno no seu jogador** desenhado no nosso overlay (você se acha mesmo com o dedo em cima) + seta indicando a direção dele se estiver ocluído.
2. **Joystick fantasma**: opacidade cai para ~20 % após 1,2 s sem movimento e volta ao toque.
3. **Zona de toque sem desenho**: joystick vira uma área invisível grande (o widget visual fica pequeno) — menos coisa na frente do campo.
4. **"Modo GK"**: quando você está dentro da sua grande área, a câmera ganha um viés fixo para cima (você + seu gol visíveis, chão livre).
5. **Realocação assistida**: sugestão automática de layout (joystick mais alto/interno) baseada em onde você morre mais.

### Caminho F — Teste de 1 linha: view mode `0` (restricted)
O cliente já dispara teclas de view mode (é assim que o `fieldView` funciona hoje: `mobile-features.js:189-193` envia `1..4`). O **`0` = restricted view** existe e é nativo. Em 30 segundos de teste no aparelho dá para ver se ele resolve, ajuda ou é irrelevante. **Custo zero, faça primeiro.**

---

## 5. Comparativo

| | Resolve no canto? | Precisa de hook? | Risco | Esforço | Qualidade |
|---|---|---|---|---|---|
| **A** cameraFollow=player | Parcial (câmera clampada) | Sim (parse) | Médio | Baixo | Nativa |
| **B** viés no transform | **Sim** | Sim (renderer) | Médio | Médio | **Melhor** |
| **C** pan CSS | Parcial | Não | Baixo | Baixo | Fraca |
| **D** letterbox | Sim | Não | Baixo | Médio | Reduz área |
| **E** mitigações | Não | Não | Nenhum | Baixo | Complementar |
| **F** view mode 0 | A testar | Não | Nenhum | ~zero | A testar |

**Recomendação**: **B como motor principal + E sempre ligado + A como opção "câmera centrada no jogador" + F testado antes de tudo + C/D como fallback configurável.**

---

## 6. O algoritmo do "smart camera" (especificação)

```
Entradas por frame:
  p  = posição em tela do MEU jogador        (do hook do canvas)
  b  = posição em tela da bola               (do hook do canvas)
  Z  = zonas de oclusão                      (calculadas de hud_layout + último toque)
  S  = caixa de segurança da tela            (ex.: 6% a 94%)

1. oclusão = p está dentro de alguma Z expandida pelo raio do dedo (+24 dp)?
   - não → alvo_jogador = 0            (volta ao normal — sua ideia)
   - sim → alvo_jogador = k            (k = 0.35 sutil / 0.6 padrão / 1.0 forte)

2. alvo = lerp(b, p, alvo_jogador)       // ponto que a câmera deve "olhar"
3. offset = centro_da_tela_livre − alvo // deslocamento necessário, em px
4. offset = clamp(offset, ±12% da tela) // nunca vira teleporte
5. offset = spring(offset_anterior, offset, ω=10 rad/s, ξ=1.0)   // criticamente amortecido
6. se b sair de S → reduz k e recomputa (bola tem prioridade de visibilidade)
7. aplica offset no transform de mundo (Caminho B) ou no CSS (Caminho C)

Histerese: entra na oclusão com margem +8 dp, sai com −8 dp (evita oscilar na borda).
Deadband: ignora variações < 2 px.
Reset: em gol, troca de sala, virada de lado e ao abrir menu/painel.
Desligado em: espectador, admin de sala, replay, editor de HUD.
```

Parâmetros expostos ao usuário (dentro do painel de Controles):
`Desligado / Sutil / Padrão / Forte` + `Centrar no jogador (cameraFollow)` + `Seguir bola com prioridade` + toggle `Destaque do meu jogador`.

---

## 7. O que precisa ser verificado em aparelho (antes de implementar)

Três probes curtos, rodados no app com o console remoto (`chrome://inspect`). Nada disso altera o app — são scripts de diagnóstico injetados manualmente.

1. **Transform da câmera** (decide o Caminho B): envolver `setTransform/translate/scale` e logar, por 1 s, quantas chamadas por frame e com que argumentos. Se houver uma chamada dominante por frame com escala constante → temos a câmera.
2. **Stadium parse** (decide o Caminho A): envolver `JSON.parse` no frame do jogo e logar objetos que contenham `cameraFollow`, `width`, `height`, `maxViewWidth`. Se aparecer, o override é trivial.
3. **View modes** (decide o Caminho F): entrar numa sala, disparar a tecla `0`, capturar tela, comparar com `1`. 30 segundos.

E, no mesmo passe: identificar **os discos** (bola vs. jogadores) pelas chamadas de `arc` + `fillStyle`/`getTransform` — o mesmo hook que o pacote visual da Fase 4 vai precisar. **Uma descoberta resolve dois problemas.**

---

## 8. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| **Jitter / enjoo** com câmera que persegue | Spring criticamente amortecido, deadband, histerese, limite de 12 % e velocidade máxima |
| **Bola fora da tela** | Bola tem prioridade de visibilidade; `k` cai automaticamente se a bola ameaçar sair da caixa segura |
| **No canto a câmera do jogo está clampada** | Por isso o viés é aplicado **em espaço de tela**, depois do clamp |
| **HaxBall muda o renderer** | Feature flag + probe + auto-desligar + fallback CSS (Caminho C) + o app continua como hoje |
| **Custo de frame** | Hook só lê números; cálculo em 1 rAF compartilhado; nada de DOM; auto-desligar se FPS cair |
| **Conflito com o editor de HUD** | Zonas são lidas do layout salvo, então acompanham qualquer mudança automaticamente |
| **Vantagem competitiva** | O viés não aumenta a informação visível (só move o enquadramento). **Não** vamos expandir o campo além do que o view mode 1 permite — isso sim seria vantagem |
| **Conflito com `cameraFollow` de salas que já usam "player"** | Detecta e não duplica |

---

## 9. Onde entra no roadmap e critérios de aceite

- **Fase 4 (camada `fx`)** é o lugar natural: o hook do canvas já existirá. O Caminho F (view mode 0) entra **já na Fase 2** como teste de 1 linha; as mitigações do Caminho E na **Fase 2** junto com o HUD novo; o override de `cameraFollow` na **Fase 4** como opção.
- **Aceite**:
  - com o jogador no canto inferior esquerdo, **o sprite e a bola ficam visíveis** fora da zona de oclusão em ≥ 95 % dos frames amostrados;
  - **zero oscilação** medida (nenhuma inversão de sinal de offset em < 300 ms);
  - **≤ 0,3 ms/frame** de custo próprio;
  - com a opção desligada, **diff visual zero** em relação ao app atual;
  - teste automatizado no mock (Playwright + canvas) cobrindo: entra no canto → desloca; sai do canto → volta; bola ameaça sair → prioriza bola; menu aberto → congela; troca de sala → reseta.

**Estimativa**: probe 0,5 dia · Caminho E 0,5 dia · Caminho A 0,5–1 dia · Caminho B 2–3 dias · testes e ajuste fino em aparelho 1–2 dias.

---

## 10. Conclusão

O problema é real, é o gargalo de gameplay mobile mais sério do HaxBall, **e tem solução de qualidade**. A sua intuição (câmera inteligente) é a direção certa; o refinamento importante é:

1. o alvo é **a zona livre entre os polegares**, não o centro da tela;
2. o deslocamento precisa ser **em espaço de tela**, porque no canto a câmera do jogo já está presa no limite do stadium;
3. a câmera deve considerar **jogador e bola juntos**, com a bola tendo prioridade de visibilidade;
4. precisa de **histerese + mola amortecida**, senão troca um problema (dedo) por dois (câmera tremendo e bola sumindo);
5. **vale implementar de qualquer forma** as mitigações do Caminho E — elas custam pouco e já melhoram a sensação mesmo antes da câmera.

Resta uma incerteza honesta e barata de resolver: se o renderer expõe a câmera via transform e se o stadium é parseado de forma interceptável. **Ambas se confirmam ou se descartam em ~40 minutos de probe no aparelho** — e o desenho final (B + A + E, com C de reserva) já está preparado para os dois resultados.
