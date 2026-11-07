#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
VER=4.7.2
BASE="https://github.com/godotengine/godot/releases/download/${VER}-stable"
TOOLS="$ROOT/.tools"
mkdir -p "$TOOLS"

case "$(uname -s):$(uname -m)" in
  Linux:x86_64)
    ASSET="Godot_v${VER}-stable_linux.x86_64"
    ENGINE="$TOOLS/godot"
    TEMPLATES="${XDG_DATA_HOME:-$HOME/.local/share}/godot/export_templates/${VER}.stable"
    ;;
  MINGW*:x86_64|MSYS*:x86_64)
    ASSET="Godot_v${VER}-stable_win64.exe"
    ENGINE="$TOOLS/Godot_v${VER}-stable_win64_console.exe"
    TEMPLATES="$(cygpath -u "${APPDATA:?APPDATA is required}")/Godot/export_templates/${VER}.stable"
    ;;
  *) echo 'Supported hosts: Linux x86_64 or Windows x86_64 with Git Bash.' >&2; exit 1 ;;
esac

if [[ ! -x "$ENGINE" ]]; then
  curl --fail --location --silent --show-error --retry 2 \
    --output "$TOOLS/godot-download.zip" "$BASE/$ASSET.zip"
  if [[ "$ASSET" == *_linux.* ]]; then
    unzip -p "$TOOLS/godot-download.zip" "$ASSET" > "$TOOLS/godot.download"
    chmod +x "$TOOLS/godot.download"
    mv -- "$TOOLS/godot.download" "$ENGINE"
  else
    unzip -q -o "$TOOLS/godot-download.zip" -d "$TOOLS"
  fi
  rm -f -- "$TOOLS/godot-download.zip"
fi

VERSION="$("$ENGINE" --headless --version)"
case "$VERSION" in
  "$VER.stable"*) ;;
  *) echo "Expected Godot $VER.stable, got: $VERSION" >&2; exit 1 ;;
esac

if [[ "$ENGINE" != "$TOOLS/godot" ]]; then
  printf '#!/usr/bin/env bash\nexec "$(dirname -- "$0")/%s" "$@"\n' \
    "$(basename -- "$ENGINE")" > "$TOOLS/godot"
  chmod +x "$TOOLS/godot"
fi

if [[ "${WITH_TEMPLATES:-0}" == 1 && ! -f "$TEMPLATES/version.txt" ]]; then
  curl --fail --location --silent --show-error --retry 2 \
    --output "$TOOLS/templates.tpz" "$BASE/Godot_v${VER}-stable_export_templates.tpz"
  unzip -q -o "$TOOLS/templates.tpz" -d "$TOOLS/template-cache"
  mkdir -p "$TEMPLATES"
  cp -R -- "$TOOLS/template-cache/templates/." "$TEMPLATES/"
  rm -f -- "$TOOLS/templates.tpz"
fi
printf '%s\n' "$VERSION"
