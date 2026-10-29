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

# O SDK do Android precisa estar em ANDROID_HOME/ANDROID_SDK_ROOT ou
# em android/local.properties (sdk.dir=...).
if [ ! -f local.properties ] && [ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]; then
    echo "Aviso: SDK do Android não configurado." >&2
    echo "Crie android/local.properties com: sdk.dir=/caminho/do/Android/Sdk" >&2
fi

exec env JAVA_HOME="$CHOSEN" ./gradlew "$@"
