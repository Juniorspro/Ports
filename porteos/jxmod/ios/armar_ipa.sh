#!/bin/bash
# Arma JXMod.ipa (la app de iPhone/iPad) SIN FIRMAR: el juego web (web/index.html + web/pk.bin) dentro de una app nativa
# (ios/JXMod/main.swift). Corre en una Mac con Xcode; lo usa .github/workflows/ipa.yml. La .ipa se instala con
# Sideloadly, AltStore, SideStore o eSign, que la firman con el Apple ID de cada uno.
# uso: bash porteos/jxmod/ios/armar_ipa.sh [SALIDA.ipa] [VERSION]
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"; RAIZ="$(cd "$AQUI/../../.." && pwd)"
SALIDA="${1:-$RAIZ/jxmod/JXMod.ipa}"; VERSION="${2:-2.9}"; NUM="${GITHUB_RUN_NUMBER:-1}"
case "$SALIDA" in /*) ;; *) SALIDA="$PWD/$SALIDA" ;; esac
T="$(mktemp -d)"; APP="$T/Payload/JXMod.app"; mkdir -p "$APP/www"
SDK="$(xcrun --sdk iphoneos --show-sdk-path)"; SDKV="$(xcrun --sdk iphoneos --show-sdk-version)"
echo "Xcode: $(xcodebuild -version | tr '\n' ' ') · SDK iphoneos $SDKV"

# 1. el programa (arm64, desde iOS 15)
xcrun -sdk iphoneos swiftc -target arm64-apple-ios15.0 -sdk "$SDK" -O -module-name JXMod "$AQUI/JXMod/main.swift" -o "$APP/JXMod"

# 2. el juego (lo pesado de rb/ y emotes/ se baja la primera vez que se usa y queda en la caché)
cp "$RAIZ/web/index.html" "$RAIZ/web/pk.bin" "$APP/www/"
# (con la página con código, el juego va cifrado en juego.bin: la app también pide el código)
for f in juego.bin manifest.webmanifest; do [ -f "$RAIZ/web/$f" ] && cp "$RAIZ/web/$f" "$APP/www/"; done
[ -d "$RAIZ/web/app" ] && cp -R "$RAIZ/web/app" "$APP/www/app"
printf 'APPL????' > "$APP/PkgInfo"
cp "$AQUI/Info.plist" "$APP/Info.plist"

# 3. los íconos: con un catálogo (actool, un PNG de 1024 por ícono) y, si eso falla, PNG sueltos de cada tamaño
IDS="clasico noche dorado neon rojo blanco azul vhs"
CAT="$T/Iconos.xcassets"; mkdir -p "$CAT"; echo '{"info":{"author":"xcode","version":1}}' > "$CAT/Contents.json"
for id in $IDS; do
  n="$id"; [ "$id" = clasico ] && n=AppIcon
  mkdir -p "$CAT/$n.appiconset"
  sips -s format png -z 1024 1024 "$AQUI/iconos/$id-60@3x.png" --out "$CAT/$n.appiconset/icono.png" >/dev/null
  echo '{"images":[{"filename":"icono.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}' > "$CAT/$n.appiconset/Contents.json"
done
mkdir -p "$CAT/Fondo.colorset"
echo '{"colors":[{"color":{"color-space":"srgb","components":{"alpha":"1.000","blue":"0.000","green":"0.000","red":"0.000"}},"idiom":"universal"}],"info":{"author":"xcode","version":1}}' > "$CAT/Fondo.colorset/Contents.json"
ACT=(xcrun actool "$CAT" --compile "$APP" --platform iphoneos --minimum-deployment-target 15.0 --target-device iphone --target-device ipad
     --app-icon AppIcon --output-partial-info-plist "$T/parcial.plist" --output-format human-readable-text --notices --warnings --errors)
MODO=suelto
if "${ACT[@]}" --include-all-app-icons; then MODO=catalogo
else
  ALT=(); for id in $IDS; do [ "$id" = clasico ] || ALT+=(--alternate-app-icon "$id"); done
  rm -f "$T/parcial.plist"; "${ACT[@]}" "${ALT[@]}" && MODO=catalogo || true
fi
if [ "$MODO" = suelto ]; then
  rm -f "$APP/Assets.car" "$T/parcial.plist"
  for id in $IDS; do
    n="$id"; [ "$id" = clasico ] && n=AppIcon
    cp "$AQUI/iconos/$id-60@2x.png" "$APP/${n}60x60@2x.png"; cp "$AQUI/iconos/$id-60@3x.png" "$APP/${n}60x60@3x.png"
    cp "$AQUI/iconos/$id-76@2x.png" "$APP/${n}76x76@2x~ipad.png"; cp "$AQUI/iconos/$id-83.5@2x.png" "$APP/${n}83.5x83.5@2x~ipad.png"
  done
fi
echo "íconos: $MODO"

# 4. el Info.plist final (versión, íconos, SDK)
python3 -I - "$APP/Info.plist" "$T/parcial.plist" "$MODO" "$VERSION" "$NUM" "$SDKV" "$IDS" <<'PY'
import plistlib, sys, os
ruta, parcial, modo, version, num, sdkv, ids = sys.argv[1:8]
p = plistlib.load(open(ruta, 'rb'))
p['CFBundleShortVersionString'] = version; p['CFBundleVersion'] = num
p.update({'DTPlatformName': 'iphoneos', 'DTSDKName': 'iphoneos' + sdkv, 'DTPlatformVersion': sdkv})
alts = [i for i in ids.split() if i != 'clasico']
if modo == 'catalogo' and os.path.exists(parcial):
    p.update(plistlib.load(open(parcial, 'rb'))); p['UILaunchScreen'] = {'UIColorName': 'Fondo'}
    # (por las dudas: que estén todos los alternativos aunque actool no los haya anotado)
    for k in ('CFBundleIcons', 'CFBundleIcons~ipad'):
        d = p.setdefault(k, {}).setdefault('CFBundleAlternateIcons', {})
        for i in alts: d.setdefault(i, {'CFBundleIconName': i})
else:
    def ic(n, ipad): return {'CFBundleIconFiles': [n + '60x60'] + ([n + '76x76', n + '83.5x83.5'] if ipad else []), 'UIPrerenderedIcon': False}
    for k, ipad in (('CFBundleIcons', False), ('CFBundleIcons~ipad', True)):
        p[k] = {'CFBundlePrimaryIcon': ic('AppIcon', ipad), 'CFBundleAlternateIcons': {i: ic(i, ipad) for i in alts}}
plistlib.dump(p, open(ruta, 'wb'), fmt=plistlib.FMT_BINARY)
print('Info.plist:', version, '(' + num + ')', 'íconos alternativos:', ', '.join(sorted(p['CFBundleIcons']['CFBundleAlternateIcons'])))
PY

# 5. firma ad hoc (la de verdad la pone Sideloadly/AltStore al instalar) y la .ipa
codesign --force --sign - --timestamp=none "$APP"
codesign --verify --verbose=1 "$APP" || true
mkdir -p "$(dirname "$SALIDA")"; rm -f "$SALIDA"
(cd "$T" && zip -qry -X "$SALIDA" Payload)
ls -la "$SALIDA"; unzip -l "$SALIDA" | tail -n 25
rm -rf "$T"
