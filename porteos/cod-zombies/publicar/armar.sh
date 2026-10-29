#!/bin/bash
# Arma la carpeta del sitio: motor (juego/) + imagen enlazada + datos del APK + paquete de texturas del CDN.
#   armar.sh APK SALIDA        (el APK se trata como dato no confiable: sólo se descomprime, nunca se ejecuta)
set -euo pipefail
APK=$1; SAL=$2
AQUI=$(cd "$(dirname "$0")/.." && pwd)
CDN=http://cdn-boz-android.callofduty.com/PROD/CODBOZ/1_0_8
mkdir -p "$SAL"
TMP=$(mktemp -d)
unzip -q -o "$APK" 'assets/*' -d "$TMP"
python3 -I "$AQUI/extraer/xe3u.py" "$TMP/assets/boz.s3e" 0x00104000 0x00100000 "$TMP/img"
cp "$TMP/img/imagen.bin" "$TMP/img/imagen.json" "$TMP/img/config.txt" "$TMP/assets/blackops_loader.dz" "$SAL/"
cp -r "$TMP/assets/blackops-music" "$TMP/assets/deadops-music" "$SAL/"
cp "$AQUI"/juego/*.js "$AQUI/juego/web.html" "$SAL/"
# texturas DXT (342 MB; el juego elige el paquete por las extensiones GL que anunciamos)
[ -s "$SAL/blackops_dxt.dz" ] || curl -fsS -o "$SAL/blackops_dxt.dz" "$CDN/blackops_dxt.dz"
test "$(stat -c %s "$SAL/blackops_dxt.dz")" = 341884481
rm -rf "$TMP"
echo "listo: $SAL"
