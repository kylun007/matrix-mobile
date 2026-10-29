# HaxBall Mobile — aplicativo Android

App Android em Java/WebView (Android 8.0 ou superior). Carrega o HaxBall online e injeta
`min.js`, `mobile-features.js` e `mobile-ui.js` deste projeto; não inclui o motor do jogo.
Mantém temas, cores do chat e os controles existentes. Tela em paisagem, barras do sistema
ocultas e cancelamento dos comandos ao interromper os toques ou colocar o app em segundo plano.

## Arquitetura da injeção

```
MainActivity.onCreate()
  bootstrap.js  ← /*CLIENT_SCRIPT*/   min.js
                ← /*MOBILE_FEATURES*/ mobile-features.js
                ← /*MOBILE_UI*/       mobile-ui.js (com o CSS injetado em /*UI_STYLE_TEXT*/)
  webView.loadUrl("https://www.haxball.com/play")

onPageFinished(url === haxball.com/play)
  evaluateJavascript(bundle)
     └─ espera o `.gameframe` e as telas do jogo (até 30 s)
        ├─ fixa low_latency_canvas = "0" (necessário para o overlay da câmera)
        ├─ instala a interface nos dois documentos (página e frame)
        └─ expõe: haxballMobileRelease, haxballMobileBack,
                  haxballMobileExport/Import, haxballMobileCancelHud,
                  haxballMobileDiag (diagnóstico no console remoto)
```

Os três arquivos compartilham escopo: **a ordem dos marcadores no `bootstrap.js` é um contrato**
e o Gradle copia os originais para os assets do APK (task `syncClient` no `preBuild`). Edite
somente os arquivos da raiz.

## Gerar o APK

Instale Android Studio com SDK Android 35 e Build Tools 34.0.0. Use JDK 17 e Gradle 8.9
(combinação compatível com Android Gradle Plugin 8.7.3).

Abra a pasta `android` no Android Studio e sincronize o projeto, ou pelo terminal:

```bash
cd android
./gradlew assembleDebug
```

Resultado: `app/build/outputs/apk/debug/app-debug.apk` (assinado com a chave de debug;
publicação exige assinatura de release).

### Build local no Windows

`build-local.cmd` usa um diretório externo `.android-tools` (JDK, SDK e caches) e não faz
parte do código-fonte:

```powershell
.\build-local.cmd
```

## Testes

Na raiz do repositório:

```bash
npm ci
npm test
```

Cobrem regressões do cliente, a matemática da câmera e o carregamento da interface em DOM real.

## Validação no celular

1. Instalar o APK e abrir a lista de salas; conferir busca, filtros e cores do chat.
2. Entrar numa sala e mover enquanto segura o chute, alternando a ordem dos dedos.
3. Levar o jogador ao canto inferior esquerdo e confirmar que a câmera inteligente afasta o
   personagem de baixo do polegar; sair do canto e confirmar o retorno suave.
4. Interromper o toque e alternar entre aplicativos; verificar que movimento/chute não ficam presos.
5. Conferir teclado do chat, editor do HUD, áudio e conexão em Wi-Fi e dados móveis.

Conexão WebRTC, desempenho, gamepad e compatibilidade com a página atual do HaxBall ainda
precisam de validação em aparelho real. Mudanças na estrutura do site podem exigir atualização
do script.

Referências: https://developer.android.com/develop/ui/views/layout/webapps/webview e
https://developer.android.com/build/releases/agp-8-7-0-release-notes

## Histórico

### Versão 0.4.0 — nova interface e câmera inteligente

- **Design system próprio**: tokens, temas claro/escuro/auto, animações configuráveis,
  alvos de toque de 44 px, `prefers-reduced-motion` e foco visível.
- **Painéis em sheet** com cabeçalho, corpo rolável e fechamento por botão ou Voltar.
- **Configurações reorganizadas em 8 categorias** com abas segmentadas, cartões, switches e
  sliders: Geral, Interface, Controles, Câmera, Jogo, Áudio, Desempenho, Avançado.
- **Dock de ações** no topo (chat, times, menu) com ícones e contador de mensagens não lidas,
  liberando a zona dos polegares.
- **Câmera inteligente**: desloca o campo quando o jogador fica sob os controles, com mola
  amortecida, histerese, proteção de visibilidade da bola e anel de destaque do jogador.
  Modos Desligada/Fixa/Inteligente, intensidade ajustável e atalho para a visão restrita (tecla 0).
- **Lista de salas em cartões**, com região, senha e distância mais legíveis.
- **Menu rápido e painel de sala** redesenhados, com colapso das seções de administração.
- Nova opção "Restaurar tudo para o padrão", diagnósticos (`haxballMobileDiag`) e versão 0.4.0.
- Testes novos: matemática da câmera e smoke de interface em jsdom. CI com checagem de sintaxe.

Validação 0.4.0: `npm test` (14 regressões + 11 blocos de câmera + smoke de UI), `npm run check`.
Validação em aparelho real da câmera ainda pendente.

### Versão 0.3.2

Ajustes de HUD, chat em lote, perfis, favoritos e correções de reset/salvamento.

### Versão 0.2.0

Joystick fixo/flutuante, sensibilidade, zona morta, transparência, zoom do campo, ping/FPS,
perfis exportáveis, favoritos/recentes, botão Enviar no chat e tradução PT-BR dos menus.

### Versão 0.1.1

Correções de reset/salvamento e eventos do editor HUD, isolamento das macros de chute,
liberação de gamepad, mensagens em lote no histórico, visibilidade dos controles nos menus
e painel da sala com altura limitada ao viewport.
