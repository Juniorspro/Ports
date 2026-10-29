#!/bin/bash
# Parche del motor para el APK: zip con juego/*.js y web.html (se aplica desde el panel: "Aplicar parche").
#   parche.sh SALIDA.zip
set -euo pipefail
AQUI=$(cd "$(dirname "$0")/../.." && pwd)
rm -f "$1"
zip -9 -q -j "$1" "$AQUI"/juego/*.js "$AQUI/juego/web.html"
ls -la "$1"
