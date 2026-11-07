#!/bin/bash
# un carril de renders del tráiler. Necesita el juego armado (armar.sh) servido por HTTP en $JX_URL
# (p. ej. http://127.0.0.1:8979/JX.html) y Playwright con el Chromium de /opt/pw-browsers.
# Uso: JX_URL=... ./carril.sh p1_manos:49:220 p5_barril:399:457 ... (plano:cuadro_inicial:cuadro_final[:común])
T=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$T/vid"
for item in "$@"; do
  IFS=: read -r nombre f0 f1 comun <<< "$item"
  d=$(python3 -c "print($f0/24)"); h=$(python3 -c "print($f1/24)")
  extra=""; [ -n "$comun" ] && extra="--comun $T/planos/$comun"
  echo "== $nombre $f0..$f1 $(date +%T)"
  node "$T/correr.mjs" "$T/planos/$nombre.js" "$T/vid/$nombre.mp4" --video --W 1920 --H 804 --n 4 --obt 0.5 --crf 14 --desde $d --hasta $h --html "$JX_URL" $extra
done
