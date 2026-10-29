#!/bin/bash
# APK para instalar directo: WebView + servidor local con el sitio de armar.sh.   armar-apk.sh SITIO ICONO.png SALIDA.apk
#   COMPLETO=1: el paquete de texturas va adentro comprimido por bloques (bloques.py; BLOQUES=archivo ya hecho) y la
#   música pasa a Opus 48 kbps; si no, la app baja el paquete del CDN por trozos y lo guarda.
#   SDK: build-tools 34 en $SDK/android-14 y android.jar en $SDK/android-34 (de dl.google.com/android/repository)
#   firma: $KS (almacén) y $KS_PASS; si no hay, se crea uno fuera del repo en /tmp/claude-0/apk/
set -euo pipefail
SITIO=$1; ICONO=$2; APK=$3
SDK=${SDK:-/tmp/claude-0/sdk}; BT=$SDK/android-14; JAR=$SDK/android-34/android.jar
AQUI=$(cd "$(dirname "$0")" && pwd)
T=$(mktemp -d)
mkdir -p "$T/clases" "$T/assets/sitio" "$T/res/mipmap-xxxhdpi"
cp -r "$SITIO"/. "$T/assets/sitio/"
rm -f "$T/assets/sitio/blackops_dxt.dz"
if [ "${COMPLETO:-0}" = 1 ]; then
  if [ -n "${BLOQUES:-}" ]; then cp "$BLOQUES" "$T/assets/sitio/blackops_dxt.dz.bloques"
  else python3 -I "$AQUI/bloques.py" "$SITIO/blackops_dxt.dz" "$T/assets/sitio/blackops_dxt.dz.bloques" 33554432; fi
  for m in "$T"/assets/sitio/*-music/*.mp3; do
    ffmpeg -nostdin -loglevel error -y -i "$m" -vn -c:a libopus -b:a 48k "${m%.mp3}.ogg" && rm "$m"
  done
fi
XZ=$SDK/mvn/xz-1.9.jar   # decodificador LZMA2 (dominio público), sólo en el APK
[ -f "$XZ" ] || { mkdir -p "$SDK/mvn"; curl -fsS -o "$XZ" https://repo1.maven.org/maven2/org/tukaani/xz/1.9/xz-1.9.jar; }
cp "$ICONO" "$T/res/mipmap-xxxhdpi/icono.png"
javac -nowarn -source 11 -target 11 -cp "$JAR:$XZ" -d "$T/clases" "$AQUI"/src/ar/porteos/boz/*.java 2>&1 | grep -v "^warning\|^Note\|^1 warning" || true
"$BT/d8" --min-api 24 --lib "$JAR" --output "$T" $(find "$T/clases" -name '*.class') "$XZ"
"$BT/aapt2" compile -o "$T/res.zip" --dir "$T/res"
"$BT/aapt2" link -o "$T/base.apk" -I "$JAR" --manifest "$AQUI/AndroidManifest.xml" -A "$T/assets" -R "$T/res.zip" \
  --min-sdk-version 24 --target-sdk-version 34 --version-code "${VERSION:-1}" --version-name "1.${VERSION:-1}" -0 bloques -0 ogg
(cd "$T" && zip -q base.apk classes.dex)
"$BT/zipalign" -p -f 4 "$T/base.apk" "$T/alineado.apk"
if [ -z "${KS:-}" ]; then
  KS=/tmp/claude-0/apk/boz.jks; mkdir -p /tmp/claude-0/apk
  [ -f /tmp/claude-0/apk/pass ] || head -c 18 /dev/urandom | base64 | tr -d '/+=' > /tmp/claude-0/apk/pass
  KS_PASS=$(cat /tmp/claude-0/apk/pass)
  [ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias boz -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Porteos" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --out "$APK" "$T/alineado.apk"
rm -rf "$T"
ls -la "$APK"
