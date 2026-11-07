#!/bin/bash
# un carril de renders del tráiler. Necesita el juego armado (armar.sh) servido por HTTP en $JX_URL
# (p. ej. http://127.0.0.1:8979/JX.html) y Playwright con el Chromium de /opt/pw-browsers.
# Uso: JX_URL=... ./carril.sh p1_manos:49:220 p5_barril:399:457 ... (plano:cuadro_inicial:cuadro_final[:común])
T=$(cd "$(dirname "$0")" && pwd)
# formato: W y H por el entorno (por defecto 1440×1080, 4:3; con W=1920 H=804 sale el panorámico 2,39:1); SAL = carpeta
W=${W:-1440}; H=${H:-1080}; SAL=${SAL:-vid43}; mkdir -p "$T/$SAL"
for item in "$@"; do
  IFS=: read -r nombre f0 f1 comun <<< "$item"
  d=$(python3 -c "print($f0/24)"); h=$(python3 -c "print($f1/24)")
  extra=""; [ -n "$comun" ] && extra="--comun $T/planos/$comun"
  echo "== $nombre $f0..$f1 $(date +%T)"
  node "$T/correr.mjs" "$T/planos/$nombre.js" "$T/$SAL/$nombre.mp4" --video --muestras --W $W --H $H --n 4 --obt 0.5 --crf 14 --desde $d --hasta $h --html "$JX_URL" $extra
done
