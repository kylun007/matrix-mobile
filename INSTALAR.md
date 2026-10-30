# Como instalar no celular

O projeto **não é um app da Play Store**: você compila o APK no computador e instala no
aparelho. São duas etapas — **gerar o APK** (uma vez por versão) e **instalar** (quantas vezes
quiser).

Versão atual: **0.5.0** (aparece em Ajustes → Sobre e na pílula da tela de entrada).
Requisitos: **Android 8.0+**, tela em paisagem, internet para o jogo.

---

## 1. Gerar o APK (no computador)

Primeiro atualize o código:

```bash
git checkout main
git pull
```

### Linux

```bash
cd android
./build.sh
```

O `build.sh` acha sozinho um JDK 17–22 e conserta o `local.properties`. Precisa do
**SDK Android 35 + Build Tools 34.0.0** instalados.

### Windows

```powershell
cd android
.\build-local.cmd
```

Se preferir o Gradle direto (com JDK 17 configurado): `.\gradlew.bat assembleDebug`.

### Onde fica o arquivo

```
android/app/build/outputs/apk/debug/app-debug.apk
```

A primeira compilação demora (baixa o Gradle, ~130 MB). As seguintes levam segundos.

---

## 2. Instalar no celular

### Opção A — cabo USB (mais rápido para testar)

1. No celular: **Configurações → Sobre o telefone → toque 7× em "Número da versão"** para
   liberar as opções de desenvolvedor.
2. **Opções do desenvolvedor → Depuração USB** → ligar.
3. Conecte o cabo e aceite "Permitir depuração USB" no celular.
4. No computador:

```bash
adb devices                       # o aparelho precisa aparecer como "device"
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

O `-r` atualiza por cima mantendo perfis, favoritos e ajustes do HUD.

### Opção B — sem cabo (manda o arquivo para você mesmo)

1. Envie o `app-debug.apk` para o celular: Telegram (mensagens salvas), WhatsApp, Google
   Drive, e-mail ou cabo como armazenamento.
2. Abra o arquivo pelo **Gerenciador de arquivos** do celular (ou pelo aviso de download).
3. O Android vai pedir para permitir instalação de fontes desconhecidas. Autorize **para o
   app que está abrindo o arquivo** (Arquivos, Chrome, Telegram…), não para o sistema todo.
4. Toque em **Instalar** → **Abrir**.

Se aparecer "bloqueado por outro app" ou nada acontecer, é permissão: **Configurações → Apps →
Acesso especial → Instalar apps desconhecidos** e libere o app do gerenciador de arquivos.

### Opção C — depuração por Wi-Fi

```bash
adb tcpip 5555
adb connect 192.168.0.XX:5555     # IP do celular, mesma rede Wi-Fi
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 3. Erros de instalação

### `INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match`

O APK que está no celular foi assinado por **outra máquina** (cada PC gera a própria chave de
debug em `~/.android/debug.keystore`). Não é possível atualizar por cima.

Antes de desinstalar, salve seus ajustes: **Cliente → Avançado → Perfis → Exportar texto**
(copie o JSON). Depois:

```bash
adb uninstall com.kylun.haxballmobile
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

E reimporte o JSON em **Perfis → Importar texto**. Para não repetir: guarde a
`~/.android/debug.keystore` da máquina que gerou o APK.

### `adb: command not found`

O adb vem com o SDK: `~/Android/Sdk/platform-tools/adb` (Linux) ou
`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` (Windows). Ou use a **Opção B**, que não
precisa de adb.

### `Unsupported class file major version 69`

Gradle rodando em Java 25. Use `./build.sh` (detecta o 17) ou
`sudo apt install openjdk-17-jdk`. Detalhes em `android/README.md`.

### O app instalou mas não abre o jogo

Precisa de internet. Se a página do HaxBall mudar de estrutura, a interface pode não carregar —
o diagnóstico fica em `window.haxballMobileDiag` (console remoto via `chrome://inspect`).

---

## 4. Depois de instalar

1. Abra o app e entre numa sala.
2. Vá em **Cliente → Câmera** e confirme que está em **Desligada** (padrão do 0.4.1).
   O campo deve ficar exatamente igual ao HaxBall do navegador.
3. Confira a interface: barra de ações no topo, painel em folha, lista de salas em cartões.
4. Só depois teste **Fixa** (deslocamento curto, não mexe no desenho do jogo) e
   **Inteligente** (experimental).

Se algo parecer errado, mande um print — e o diagnóstico em
**Cliente → Câmera → Testar câmera agora**.
