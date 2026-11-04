#!/usr/bin/env bash
# La app de JXMod, sin teléfono: la puerta (EleccionMotor, Java puro: ¿hay una WebView que sirva?) y el APK con un solo
# motor, el juego web (Inicio + Web) con WebGL 2 (o WebGL 1). Sin bibliotecas ni código nativo. Uso: apk/pruebas/unido/correr.sh
#   SALIDA=ruta.apk VERSION=2.9 (opcionales); WWW: el juego web armado con PK_BIN=1 (por defecto lo arma acá)
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"; APK="$(cd "$AQUI/../.." && pwd)"
B=${B:-/tmp/claude-0/jx_build/unido}
rm -rf "$B" && mkdir -p "$B/puro"
javac --release 8 -Xlint:-options -d "$B/puro" "$APK/unido/src/com/jxmod/app/EleccionMotor.java" "$AQUI/PruebaEleccion.java"
java -cp "$B/puro" PruebaEleccion
A=${A:-/tmp/claude-0/jx_unido/activos}; WWW=${WWW:-/tmp/claude-0/jx_web/activos/www}
# (el juego web se arma de nuevo con el código de ahora: si no, el APK puede llevar uno viejo)
if [ -z "${SIN_ARMAR_WEB:-}" ] && [ -f /tmp/claude-0/hyp_rb/armar.sh ]; then
  (cd "$APK/.." && PK_BIN=1 RB_DIR="$APK/../../../web/rb" PK=${PK:-/tmp/claude-0/hyp_ah18} bash /tmp/claude-0/hyp_rb/armar.sh "$WWW/index.html" | tail -1)
fi
# (el JS va comprimido: se mira que el armado sea más nuevo que todo el código del juego)
[ -z "$(find "$APK/../juego" -newer "$WWW/index.html" -name '*.js')" ] || { echo "el juego web de $WWW es más viejo que el código"; exit 1; }
rm -rf "$A" && mkdir -p "$A" && cp -al "$WWW" "$A/www"
python3 -I "$APK/armar_apk.py" "${SALIDA:-$B/JXMod.apk}" --version-name "${VERSION:-prueba}" --src "$APK/web/src" --src "$APK/unido/src" \
  --manifiesto "$APK/unido/AndroidManifest.xml" --activos "$A" 2>&1 | grep -v "^Picked up"
unzip -l "${SALIDA:-$B/JXMod.apk}" | grep -E "classes.dex|assets/www/|lib/" | head -6
