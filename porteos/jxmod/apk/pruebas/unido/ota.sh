#!/usr/bin/env bash
# Prueba de las actualizaciones por partes sin teléfono: una firma y un secreto de PRUEBA (en una carpeta temporal, nunca
# los de verdad), ota.py publica un juego de mentira y PruebaOta.java (como Ota.java) lo comprueba. Uso: apk/pruebas/unido/ota.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"; RAIZ="$(cd "$AQUI/../../.." && pwd)"
T=$(mktemp -d /tmp/claude-0/ota_prueba.XXXX); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/www/fondos" "$T/firma" "$T/clases"
head -c 200000 /dev/urandom > "$T/www/index.html"; head -c 1000000 /dev/urandom > "$T/www/pk.bin"; head -c 50000 /dev/urandom > "$T/www/fondos/a.mp4"
SEC=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
JXMOD_FIRMA_DIR="$T/firma" JXMOD_OTA_SECRETO="$SEC" python3 -I "$RAIZ/herramientas/ota.py" "$T/www" "$T/ota" --codigo 3903 --version 3.9.3 --apk-min 3903
CERT=$(cd "$T" && JXMOD_FIRMA_DIR="$T/firma" python3 -I -c "
import sys, importlib.util, tempfile; sys.path.insert(0, '$RAIZ/herramientas'); import cifrar_apk
sp = importlib.util.spec_from_file_location('a', '$RAIZ/apk/armar_apk.py'); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
ks, c = m.firma(); print(cifrar_apk.huella_cert(m.cert_der(ks, c, '$T')).hex())" | tail -1)
javac --release 8 -Xlint:-options -nowarn -d "$T/clases" "$AQUI/PruebaOta.java"
java -cp "$T/clases" PruebaOta "$CERT" "$SEC" "$T/ota" "$T/www"
# (sin JXMOD_OTA_SECRETO: el secreto sale de la firma de prueba, como en un armado de verdad; Java lo recibe calculado igual)
rm -rf "$T/ota"; JXMOD_FIRMA_DIR="$T/firma" python3 -I "$RAIZ/herramientas/ota.py" "$T/www" "$T/ota" --codigo 3903 --version 3.9.3 --apk-min 3903 > /dev/null
SEC2=$(cd "$T" && JXMOD_FIRMA_DIR="$T/firma" python3 -I -c "
import sys, importlib.util; sys.path.insert(0, '$RAIZ/herramientas'); import cifrar_apk
sp = importlib.util.spec_from_file_location('a', '$RAIZ/apk/armar_apk.py'); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
ks, c = m.firma(); print(cifrar_apk.secreto_ota(ks, c).hex())" | tail -1)
java -cp "$T/clases" PruebaOta "$CERT" "$SEC2" "$T/ota" "$T/www" | tail -1
# (con otro secreto —una actualización que no hizo el dueño— el HMAC no pasa)
OTRO=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
if java -cp "$T/clases" PruebaOta "$CERT" "$OTRO" "$T/ota" "$T/www" > /dev/null; then echo "FALLA una actualización con otro secreto pasó"; exit 1; else echo "OK    una actualización con otro secreto no pasa"; fi
