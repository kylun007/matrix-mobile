# HaxBall Mobile ? prot?tipo Android

App Android em Java/WebView, Android 8.0 ou superior. Carrega o HaxBall online e injeta o `min.js` deste projeto; n?o inclui o motor do jogo. Mant?m temas, cores do chat e controles existentes. Tela em paisagem, barras ocultas e cancelamento dos comandos ao interromper os toques ou colocar o app em segundo plano.

## Ferramentas locais dispon?veis

Java 17 e SDK Android foram instalados em ../../.android-tools. Para recompilar neste computador, execute .\build-local.cmd dentro desta pasta.

O script configura as vari?veis somente para a compila??o e usa Gradle/cache locais. A pasta de ferramentas n?o faz parte do c?digo-fonte e n?o precisa acompanhar o APK.

## Gerar o APK em outro computador

Instale Android Studio com SDK Android 35 e Build Tools 34.0.0. Use JDK 17 e Gradle 8.9 (combina??o compat?vel com Android Gradle Plugin 8.7.3).

Abra esta pasta `android` no Android Studio e sincronize o projeto. Gere um APK de debug pelo menu de Build. Pelo terminal, com JAVA_HOME configurado e o SDK em `local.properties` ou ANDROID_HOME:

```powershell
.\gradlew.bat assembleDebug
```

Resultado: `app/build/outputs/apk/debug/app-debug.apk`. Este APK de teste ? assinado automaticamente com a chave de debug; publica??o requer assinatura de release.

O Gradle copia `../min.js` para os assets durante o build. Edite somente o arquivo original. `bootstrap.js` espera o iframe e a interface do jogo, evita inje??o duplicada e libera as teclas no segundo plano. Sites externos abrem no navegador; n?o h? ponte JavaScript com acesso nativo.

## Valida??o no celular

1. Instalar o APK e abrir a lista de salas; conferir controles e cores do chat.
2. Entrar numa sala e mover enquanto segura o chute, alternando a ordem dos dedos.
3. Interromper o toque e alternar entre aplicativos; verificar que movimento/chute n?o ficam presos.
4. Conferir teclado do chat, edi??o do HUD, ?udio e conex?o em Wi-Fi e dados m?veis.

Conex?o WebRTC, desempenho, gamepad e compatibilidade com a p?gina atual do HaxBall ainda precisam de valida??o em aparelho real. Mudan?as na estrutura do site podem exigir atualiza??o do script.

Refer?ncias: https://developer.android.com/develop/ui/views/layout/webapps/webview e https://developer.android.com/build/releases/agp-8-7-0-release-notes

## Build validado

APK de debug compilado com sucesso; assinatura verificada pelo apksigner e assets comparados com os originais. C?pia dispon?vel em ../../HaxBall-Mobile-debug.apk. Ainda falta valida??o do jogo em aparelho real.

## Versao 0.1.1

Corrigidos reset/salvamento e eventos do editor HUD, isolamento das macros de chute, liberacao de gamepad, mensagens em lote no historico, visibilidade dos controles nos menus e ajuste de tamanho. Painel da sala com altura limitada ao viewport e listas de jogadores com rolagem.

Validacao: node ../tests/client-regressions.cjs, smoke de layout em Edge com viewport 776x328, assembleDebug e assinatura verificada. Assets do APK comparados com os arquivos originais. Validacao final em celular pendente.

## Versao 0.2.0

Novas opcoes no botao Cliente: joystick fixo/flutuante, sensibilidade, zona morta, transparencia, zoom nativo do campo e indicadores reais de ping/FPS do HaxBall. O editor HUD possui presets Destro/Canhoto e Cancelar. Perfis nomeados podem ser aplicados, exportados/importados como texto ou arquivos JSON; apenas preferencias e HUD sao exportados.

O chat tem botao Enviar e esconde os controles enquanto o teclado esta em uso. Salas permite favoritos, recentes e entrada por link. Favoritos sem link usam o nome exato na lista publica; salas fechadas ou nomes duplicados exigem selecao manual. Abra o painel Link de uma sala para registrar seu link no cliente. No Android, pode ser necessario habilitar Abrir links compativeis nas configuracoes do aplicativo para usar links HTTPS diretamente no APK.

Novo icone de bola, versao exibida em Sobre, menus do cliente em portugues, areas seguras da tela e botao Voltar fechando primeiro chat/menus/editor. Sem mensagens rapidas. Visual geral preservado para a proxima etapa.

Validacao 0.2.0: testes de regressao em Node; fluxos reais do DOM em Edge (configuracoes, perfis, chat, HUD e favoritos); assembleDebug; assinatura e tres assets do APK verificados. Arquivos JSON nativos, links e teclado/recortes devem ser conferidos no Android real.
