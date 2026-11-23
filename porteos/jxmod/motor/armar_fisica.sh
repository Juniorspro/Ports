#!/bin/bash
# Arma la física en Rust para WebAssembly y la deja en juego/fisica_wasm.js (base64), que armar.py mete en el juego.
# uso: ./armar_fisica.sh   (los objetos de compilación van a /tmp/claude-0/jxm_target, fuera del repo)
set -euo pipefail
cd "$(dirname "$0")"
T=${CARGO_TARGET_DIR:-/tmp/claude-0/jxm_target}
CARGO_TARGET_DIR=$T cargo build -q --release -p jxfisica --target wasm32-unknown-unknown
W=$T/wasm32-unknown-unknown/release/jxfisica.wasm
python3 -I - "$W" ../juego/fisica_wasm.js <<'PY'
import base64, sys, hashlib
b = open(sys.argv[1], 'rb').read()
open(sys.argv[2], 'w').write('// la física en Rust (porteos/jxmod/motor/fisica, armada con motor/armar_fisica.sh): WebAssembly en base64, %d bytes, sha256 %s\nconst FISICA_WASM = \'%s\';\n' % (len(b), hashlib.sha256(b).hexdigest()[:16], base64.b64encode(b).decode()))
print('juego/fisica_wasm.js:', len(b), 'bytes de WebAssembly')
PY
