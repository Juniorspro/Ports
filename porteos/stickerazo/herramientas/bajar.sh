#!/bin/sh
# Baja las piezas de terceros que van en la app (no se guardan en el repo) y comprueba sus huellas.
# MediaPipe Tasks Vision 0.10.35 (Apache-2.0) y sus modelos (Apache-2.0). Uso: sh herramientas/bajar.sh [CARPETA=web/terceros]
set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
D="${1:-$AQUI/../web/terceros}"; mkdir -p "$D/mediapipe" "$D/modelos"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
URL=$(curl -sf https://registry.npmjs.org/@mediapipe/tasks-vision/0.10.35 | python3 -c 'import json,sys; print(json.load(sys.stdin)["dist"]["tarball"])')
curl -sfL -o "$T/tv.tgz" "$URL"; tar xzf "$T/tv.tgz" -C "$T"
cp "$T/package/vision_bundle.mjs" "$D/mediapipe/"; cp "$T/package/wasm/vision_wasm_internal.js" "$T/package/wasm/vision_wasm_internal.wasm" "$D/mediapipe/"
M=https://storage.googleapis.com/mediapipe-models
curl -sfL -o "$D/modelos/selfie_multiclass_256x256.tflite" "$M/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
curl -sfL -o "$D/modelos/magic_touch.tflite" "$M/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite"
cd "$D" && sha256sum -c <<SUMAS
$(cat "$AQUI/huellas.txt")
SUMAS
