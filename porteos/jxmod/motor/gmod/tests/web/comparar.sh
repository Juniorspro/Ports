#!/bin/bash
# compara las trazas de la web (node) y de jxgmod (jxgmod_traza) para cada addon de una lista (una ruta por línea)
#   comparar.sh <lista> <carpeta de salida> [binario jxgmod_traza] [opciones de las dos trazas: --api, --ticks N]
L="${1:?lista}"; D="${2:?salida}"; B="${3:-/tmp/claude-0/jxm_target/release/jxgmod_traza}"; shift 3 2>/dev/null; X=("$@")
H="$(dirname "$0")/traza_web.js"
mkdir -p -- "$D"
iguales=0; casi=0; orden=0; total=0
while IFS= read -r a; do
  [ -z "$a" ] && continue
  total=$((total+1)); n=$(echo "$a" | sed 's|^./||' | tr '/ ' '__' | tail -c 70)
  timeout 300 node "$H" "$a" "${X[@]}" > "$D/$n.web" 2>/dev/null
  timeout 300 "$B" "$a" "${X[@]}" > "$D/$n.rs" 2>/dev/null
  w=$(wc -l < "$D/$n.web"); r=$(wc -l < "$D/$n.rs")
  if cmp -s "$D/$n.web" "$D/$n.rs"; then iguales=$((iguales+1)); echo "IGUAL  $w  $a"; rm -f -- "$D/$n.web" "$D/$n.rs";
  else
    # (sin el número de línea de los mensajes de error: la web a veces da el de otra sentencia)
    norm() { sed -E 's/(\.lua):[0-9]+:/\1:N:/g' "$1" | awk '/^[^ ]+ error /{m=substr($0, index($0, " error ")); c[m]++; if (c[m] > 3) next} {print}'; }
    if cmp -s <(norm "$D/$n.web") <(norm "$D/$n.rs"); then casi=$((casi+1)); echo "IGUAL-SALVO-LINEA-DE-ERROR  $w  $a"; continue; fi
    # (las mismas líneas en otro orden: la web evalúa el operando derecho de a > b y a >= b antes que el izquierdo)
    if cmp -s <(norm "$D/$n.web" | sort) <(norm "$D/$n.rs" | sort); then orden=$((orden+1)); echo "IGUAL-SALVO-ORDEN  $w  $a"; continue; fi
    d=$(diff "$D/$n.web" "$D/$n.rs" | grep -c '^[<>]'); echo "DIFIERE web=$w rust=$r difs=$d  $a"; fi
done < "$L"
echo "iguales: $iguales / $total; iguales salvo la línea de un error: $casi; las mismas líneas en otro orden: $orden"
