#!/usr/bin/env bash
# Todas las pruebas de Stickerazo, sin teléfono: el Java puro (almacén y JSON), la app en el navegador, la app como en
# el celular (la página con el puente SZN y el Java de verdad, y lo que lee WhatsApp) y el armado del APK.
# uso: pruebas/correr.sh CARPETA_FOTOS   (grace_hopper.jpg, YellowLabradorLooking_new.jpg, burger.jpg)
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"; RAIZ="$(cd "$AQUI/.." && pwd)"; FOTOS="${1:?falta la carpeta de fotos}"
B=/tmp/claude-0/sz_java; mkdir -p "$B/clases"
javac --release 8 -Xlint:-options -encoding UTF-8 -d "$B/clases" "$RAIZ"/android/src/com/stickerazo/app/{Json,Almacen}.java "$AQUI/PruebaAlmacen.java" 2>&1 | grep -v "Picked up" || true
rm -rf "$B/datos" && java -Dstdout.encoding=UTF-8 -cp "$B/clases" PruebaAlmacen "$B/datos" 2>&1 | grep -E "FALLA|RESUMEN"
echo "== navegador";     (cd "$AQUI" && node app.mjs "$FOTOS" | grep -E "FALLA|TODO|errores")
echo "== como la app";   (cd "$AQUI" && MODO=app node app.mjs "$FOTOS" /tmp/claude-0/sz_app_android 2>&1 | grep -v "Picked up" | grep -E "FALLA|TODO|errores")
echo "== APK";           python3 -I "$RAIZ/herramientas/armar_apk.py" "${SALIDA:-/tmp/claude-0/stickerazo/Stickerazo.apk}" 2>&1 | grep -v "^Picked up"
