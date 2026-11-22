#!/bin/bash
# Arma JX Hand Engine: el banco nativo y las dos versiones de WebAssembly (web/jxhand_simd.wasm para cualquier vista web
# con SIMD, web/jxhand_relaxed.wasm con FMA para Chrome 114+; jxhand.js elige sola).
# uso: ./armar.sh   (los objetos de compilación van a /tmp/claude-0/jxhand_target*, fuera del repo)
set -euo pipefail
cd "$(dirname "$0")"
T=${CARGO_TARGET_DIR:-/tmp/claude-0/jxhand_target}
CARGO_TARGET_DIR=$T cargo build -q --release -p jxhand-banco
CARGO_TARGET_DIR=$T RUSTFLAGS="-C target-feature=+simd128" cargo build -q --release -p jxhand --target wasm32-unknown-unknown
cp "$T/wasm32-unknown-unknown/release/jxhand.wasm" web/jxhand_simd.wasm
CARGO_TARGET_DIR=${T}_rel RUSTFLAGS="-C target-feature=+simd128,+relaxed-simd" cargo build -q --release -p jxhand --target wasm32-unknown-unknown
cp "${T}_rel/wasm32-unknown-unknown/release/jxhand.wasm" web/jxhand_relaxed.wasm
ls -la web/*.wasm
