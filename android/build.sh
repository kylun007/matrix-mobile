#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Build do APK usando um JDK compatível com Gradle 8.9 / AGP 8.7.3.
#
# O AGP 8.7.3 é feito para o JDK 17 e o Gradle 8.9 recusa versões muito novas
# com "Unsupported class file major version 69" (69 = Java 25).
# Este script procura um JDK 17..22 e o usa só para esta compilação, sem
# alterar o JAVA_HOME global da máquina.
#
# Uso:
#   ./build.sh                 # gera o APK de debug
#   ./build.sh assembleRelease  # qualquer outra task do Gradle
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")"

if [ "$#" -eq 0 ]; then
    set -- assembleDebug
fi

# Versão maior do Java em um diretório candidato (17, 21, 25...).
java_major() {
    [ -x "$1/bin/java" ] || return 1
    local raw
    raw="$("$1/bin/java" -version 2>&1 | head -n 1)"
    raw="${raw#*\"}"
    raw="${raw%%\"*}"
    case "$raw" in
        1.*) raw="${raw#1.}"; raw="${raw%%.*}" ;;
        *)   raw="${raw%%.*}" ;;
    esac
    case "$raw" in
        ''|*[!0-9]*) return 1 ;;
    esac
    printf '%s' "$raw"
}

in_range() {
    [ "$1" -ge 17 ] 2>/dev/null && [ "$1" -le 22 ] 2>/dev/null
}

describe() {
    "$1/bin/java" -version 2>&1 | head -n 1 | sed 's/^/    /'
}

CANDIDATES=()
[ -n "${JAVA_HOME:-}" ] && CANDIDATES+=("$JAVA_HOME")
[ -n "${JAVA_HOME_17:-}" ] && CANDIDATES+=("$JAVA_HOME_17")

# O Java do PATH (via readlink do binário) também é candidato.
if command -v java >/dev/null 2>&1; then
    RESOLVED="$(readlink -f "$(command -v java)" 2>/dev/null || true)"
    [ -n "$RESOLVED" ] && CANDIDATES+=("$(dirname "$(dirname "$RESOLVED")")")
fi

# Locais comuns de instalação (Ubuntu/Debian, SDKMAN, Android Studio, asdf).
for pattern in \
    "/usr/lib/jvm/*17*" "/usr/lib/jvm/*21*" \
    "/usr/lib/jvm/*-17-*" "/usr/lib/jvm/*-21-*" \
    "$HOME/.sdkman/candidates/java/*17*" \
    "$HOME/.sdkman/candidates/java/*21*" \
    "$HOME/android-studio/jbr" \
    "$HOME/.local/share/JetBrains/Toolbox/apps/AndroidStudio/ch-*/jbr" \
    "/opt/android-studio/jbr" \
    "/opt/*jdk*17*" "/opt/*jdk*21*" \
    "$HOME/.asdf/installs/java/17"* "$HOME/.asdf/installs/java/21"*
do
    # shellcheck disable=SC2086
    for dir in $pattern; do
        [ -d "$dir" ] && CANDIDATES+=("$dir")
    done
done

CHOSEN=""
for candidate in "${CANDIDATES[@]}"; do
    major="$(java_major "$candidate" 2>/dev/null || true)"
    [ -z "$major" ] && continue
    if in_range "$major"; then
        CHOSEN="$candidate"
        break
    fi
done

if [ -z "$CHOSEN" ]; then
    cat >&2 <<'EOF'
Nenhum JDK compatível (17 a 22) foi encontrado.

O Gradle 8.9 + AGP 8.7.3 não funcionam com Java muito novo:
  Unsupported class file major version 69  ->  Java 25
  Unsupported class file major version 68  ->  Java 24
O recomendado é o JDK 17.

Ubuntu / Debian / Pop!_OS / Mint:
    sudo apt install openjdk-17-jdk
    # se houver várias versões, aponte só para este build:
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./build.sh

Fedora:
    sudo dnf install java-17-openjdk-devel

Arch:
    sudo pacman -S jdk17-openjdk

Ou instale o Android Studio (traz um JBR compatível em ~/android-studio/jbr).
EOF
    exit 1
fi

major="$(java_major "$CHOSEN")"
echo "JDK ${major} em ${CHOSEN}"
describe "$CHOSEN"

# ---------------------------------------------------------------------------
# SDK do Android: valida o local.properties existente e, se ele apontar para
# uma pasta inexistente (erro comum ao copiar um caminho de exemplo), procura
# o SDK nos locais usuais e reescreve o arquivo.
# ---------------------------------------------------------------------------
sdk_valid() {
    [ -n "$1" ] && [ -d "$1" ] && [ -d "$1/platforms" ]
}

SDK=""
INCOMPLETE=""
if [ -f local.properties ]; then
    SDK="$(sed -n 's/^[[:space:]]*sdk\.dir[[:space:]]*=[[:space:]]*//p' local.properties | tr -d '\r' | head -n 1)"
    sdk_valid "$SDK" || { [ -d "${SDK:-/nonexistent}" ] && INCOMPLETE="$SDK"; SDK=""; }
fi

if [ -z "$SDK" ]; then
    for candidate in \
        "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" \
        "$HOME/Android/Sdk" "$HOME/Android/sdk" "$HOME/android-sdk" \
        "$HOME/Library/Android/sdk" \
        "/usr/lib/android-sdk" "/opt/android-sdk" "/opt/android/sdk" \
        "$HOME/snap/android-studio/common/Android/Sdk" \
        "$HOME/.local/share/Android/Sdk"
    do
        if sdk_valid "$candidate"; then SDK="$candidate"; break; fi
    done
fi

# Pasta do SDK existe mas sem a plataforma: instalar os componentes que faltam.
if [ -z "$SDK" ] && [ -n "$INCOMPLETE" ]; then
    echo "SDK incompleto em $INCOMPLETE (falta a pasta platforms/)." >&2
    echo "Instale os componentes e rode de novo:" >&2
    echo >&2
    echo "  export JAVA_HOME='${CHOSEN}'" >&2
    SUDO=""
    [ -w "$INCOMPLETE" ] || SUDO="sudo -E "
    echo "  ${SUDO}${INCOMPLETE}/cmdline-tools/latest/bin/sdkmanager \\" >&2
    echo "      \"platform-tools\" \"platforms;android-35\" \"build-tools;34.0.0\"" >&2
    echo >&2
    echo "Se não existir cmdline-tools nessa pasta, instale por lá:" >&2
    echo "  ${SUDO}apt install -y unzip" >&2
    echo "  curl -L -o /tmp/clt.zip https://dl.google.com/android/repository/commandlinetools-linux-latest.zip" >&2
    echo "  unzip -q /tmp/clt.zip -d /tmp/clt && ${SUDO}mkdir -p $INCOMPLETE/cmdline-tools" >&2
    echo "  ${SUDO}mv /tmp/clt/cmdline-tools $INCOMPLETE/cmdline-tools/latest" >&2
    echo "  ${SUDO}${INCOMPLETE}/cmdline-tools/latest/bin/sdkmanager --licenses" >&2
    echo >&2
    echo "Ou instale o Android Studio e abra esta pasta nele (ele cuida do SDK)." >&2
    exit 1
fi

if [ -z "$SDK" ]; then
    cat >&2 <<'EOF'
SDK do Android não encontrado.

O Gradle precisa do SDK (platform 35 + Build Tools 34.0.0) em ANDROID_HOME
ou no arquivo android/local.properties (sdk.dir=/caminho/do/Sdk).

1) Se você tem o Android Studio, o SDK costuma estar em ~/Android/Sdk.
   Descubra o caminho real:
       ls -d ~/Android/Sdk ~/snap/android-studio/*/Android/Sdk 2>/dev/null
   E grave no projeto:
       echo "sdk.dir=$HOME/Android/Sdk" > local.properties

2) Se não tem SDK, instale só as ferramentas de linha de comando:
   https://developer.android.com/studio#command-line-tools-only
       mkdir -p ~/Android/Sdk/cmdline-tools
       unzip commandlinetools-linux-*.zip -d /tmp/cmdline
       mv /tmp/cmdline/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
       export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
       yes | ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --licenses
       ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager \
           "platform-tools" "platforms;android-35" "build-tools;34.0.0"
       echo "sdk.dir=$HOME/Android/Sdk" > local.properties

3) Ou instale o Android Studio e abra a pasta android nele (ele configura tudo).
EOF
    exit 1
fi

# Reescreve o local.properties quando ausente ou apontando para lugar nenhum.
CURRENT=""
[ -f local.properties ] && CURRENT="$(sed -n 's/^[[:space:]]*sdk\.dir[[:space:]]*=[[:space:]]*//p' local.properties | tr -d '\r' | head -n 1)"
if [ "$CURRENT" != "$SDK" ]; then
    printf 'sdk.dir=%s\n' "$SDK" > local.properties
    echo "SDK do Android: $SDK (gravado em android/local.properties)"
else
    echo "SDK do Android: $SDK"
fi

# Avisos de conteúdo (não impedem o build, mas explicam falhas comuns).
if [ ! -d "$SDK/platforms/android-35" ]; then
    echo "Aviso: 'platforms;android-35' não está instalado. Instale com:" >&2
    echo "  $SDK/cmdline-tools/latest/bin/sdkmanager \"platforms;android-35\"" >&2
fi
if [ ! -d "$SDK/build-tools/34.0.0" ]; then
    echo "Aviso: 'build-tools;34.0.0' não está instalado (o Gradle costuma baixar sozinho)." >&2
fi

exec env JAVA_HOME="$CHOSEN" ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK" ./gradlew "$@"
