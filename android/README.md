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

Instale o **SDK Android 35** com Build Tools 34.0.0. Use **JDK 17** e Gradle 8.9 (combinação
compatível com o Android Gradle Plugin 8.7.3).

Abra a pasta `android` no Android Studio e sincronize o projeto, ou pelo terminal:

```bash
cd android
./gradlew assembleDebug          # Linux / macOS
```

```powershell
cd android
.\gradlew.bat assembleDebug       # Windows
```

Resultado: `app/build/outputs/apk/debug/app-debug.apk` (assinado com a chave de debug;
publicação exige assinatura de release).

Instalar no aparelho conectado:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Build com detecção de JDK (recomendado no Linux)

O `build.sh` procura um JDK compatível (17 a 22) e o usa **somente nesta compilação**, sem
mexer no `JAVA_HOME` global. Aceita qualquer task do Gradle.

```bash
cd android
./build.sh                       # equivale a ./build.sh assembleDebug
./build.sh assembleRelease       # outra task
```

Ele procura em `JAVA_HOME`, no `java` do PATH, em `/usr/lib/jvm`, no SDKMAN, no JBR do
Android Studio e em `/opt`.

### Build local no Windows

`build-local.cmd` usa um diretório externo `.android-tools` (JDK, SDK e caches) que não faz
parte do código-fonte:

```powershell
.\build-local.cmd
```

## Problemas comuns de build

### `Unsupported class file major version 69`

O Gradle está rodando com **Java 25**. O código do erro indica a versão:

| Mensagem | Java em uso |
|---|---|
| `major version 69` | Java 25 |
| `major version 68` | Java 24 |
| `major version 67` | Java 23 |
| `major version 65` | Java 21 (compatível) |
| `major version 61` | Java 17 (recomendado) |

Gradle 8.9 só aceita até **Java 22**, e o AGP 8.7.3 é homologado para o **17**.

Solução no Linux (Ubuntu/Debian/Pop!_OS/Mint):

```bash
sudo apt install openjdk-17-jdk
cd android && ./build.sh          # detecta o 17 automaticamente
```

Ou aponte apenas para este build, sem alterar o padrão da máquina:

```bash
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew assembleDebug
# ou:
./gradlew assembleDebug -Dorg.gradle.java.home=/usr/lib/jvm/java-17-openjdk-amd64
```

No Windows, instale o JDK 17 e defina `JAVA_HOME` antes do build:
`setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17..."` (reabra o terminal).

### `.\gradlew.bat: comando não encontrado` no Linux

`gradlew.bat` é só para Windows. No Linux/macOS use `./gradlew` (ou `./build.sh`).
Se aparecer `/bin/sh^M: bad interpreter`, o arquivo está com CRLF: o `.gitattributes`
do repositório força LF em `gradlew` e `*.sh`, então basta atualizar o checkout.

### `SDK location not found` / `sdk.dir ... Directory does not exist`

O `android/local.properties` aponta para uma pasta que não existe — normalmente porque o
caminho foi copiado de um exemplo. O `build.sh` detecta isso, procura o SDK nos locais
usuais e regrava o arquivo.

Para resolver à mão, descubra o caminho real e grave:

```bash
ls -d ~/Android/Sdk ~/snap/android-studio/*/Android/Sdk /usr/lib/android-sdk 2>/dev/null
echo "sdk.dir=$HOME/Android/Sdk" > local.properties
```

No Windows: `sdk.dir=C\:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk`.
Alternativamente, exporte `ANDROID_HOME`. O diretório precisa conter `platforms/`.

### Instalar o SDK sem o Android Studio

Baixe as *command line tools* em
<https://developer.android.com/studio#command-line-tools-only> e depois:

```bash
mkdir -p ~/Android/Sdk/cmdline-tools
unzip commandlinetools-linux-*.zip -d /tmp/cmdline
mv /tmp/cmdline/cmdline-tools ~/Android/Sdk/cmdline-tools/latest

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --licenses
~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager \
    "platform-tools" "platforms;android-35" "build-tools;34.0.0"

echo "sdk.dir=$HOME/Android/Sdk" > local.properties
./build.sh
```

O `sdkmanager` precisa do JDK 17+ no `JAVA_HOME` (o mesmo requisito do build).

### O SDK existe, mas falta a plataforma

Se `ls $ANDROID_HOME` mostrar apenas `platform-tools`, a instalação está incompleta (é o caso
do pacote `android-sdk` do apt). O `build.sh` detecta isso e imprime os comandos com o
caminho e o `sudo` corretos. Manualmente:

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
sudo -E /usr/lib/android-sdk/cmdline-tools/latest/bin/sdkmanager \
    "platform-tools" "platforms;android-35" "build-tools;34.0.0"
```

Uma alternativa mais confortável é apontar o projeto para um SDK no seu `$HOME`
(`~/Android/Sdk`), onde não é preciso `sudo` a cada componente.

### `INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match`

O APK instalado no aparelho foi assinado com **outra chave de debug**. Cada máquina gera a sua
em `~/.android/debug.keystore`, então um APK compilado em outro computador (ou antes de
formatar o sistema) não pode ser atualizado por cima.

Opção 1 — manter as configurações (perfis, favoritos, HUD):

1. Abra o app antigo → **Cliente → Avançado → Perfis → Exportar texto** e copie o JSON
   (ou **Salvar arquivo**).
2. Desinstale e instale o novo:
   ```bash
   adb uninstall com.kylun.haxballmobile
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
3. No app novo → **Cliente → Avançado → Perfis → Importar texto** e cole o JSON.

Opção 2 — instalação limpa (perde as configurações):

```bash
adb uninstall com.kylun.haxballmobile
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Para não repetir isso no futuro, guarde a `~/.android/debug.keystore` da máquina onde o APK
foi gerado, ou configure uma assinatura de release fixa (`signingConfigs`) para builds
distribuídos.

### Primeira compilação demora

O wrapper baixa o Gradle 8.9 (~130 MB) e as dependências do AGP. Precisa de internet.

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

### Validar a câmera inteligente

O cliente tem um diagnóstico no próprio aparelho, sem precisar de PC:

1. Entre numa sala e vá até o **canto inferior esquerdo** (embaixo do joystick).
2. Abra **Cliente → Câmera → Testar câmera agora**.
3. Um aviso mostra, em tempo real: `hook sim · bola 87% · jogador ok · desloc 46,0 · ATIVA · 776x328`.

Como interpretar:

| Campo | Esperado | Se estiver diferente |
|---|---|---|
| `hook sim` | interceptação do canvas funcionando | `hook CSS` = só deslocamento fixo; `hook não` = sem canvas |
| `bola N%` | 60–100% dos quadros com a bola rastreada | 0% = renderer diferente do esperado |
| `jogador ok` | posição estimada do seu disco | `não` = caiu no modo fixo |
| `desloc X,Y` | diferente de `0,0` no canto | `0,0` = zona não detectada |
| `ATIVA` | câmera deslocando | `parada` = fora da zona de oclusão |

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
