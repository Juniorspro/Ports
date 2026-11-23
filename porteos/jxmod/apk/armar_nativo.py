# Arma la APK de JXMod nativo: el juego en Rust (libjxmod.so, NativeActivity), sin WebView ni JavaScript. Lleva el mismo
# paquete del juego que la versión web (pk.bin + pk.idx.json y los paquetes aparte de los mapas, rb/), el atlas de letras
# (herramientas/atlas_letras.py) y una clase Java mínima (apk/nativo/src: sólo la pantalla completa, que Android pide
# desde su hilo de la interfaz). Pasos: javac → d8 → aapt2 → .so sin comprimir → zipalign (16 KB) → apksigner (v1+v2+v3).
# Uso: python3 -I apk/armar_nativo.py SALIDA.apk --www DIR [--so-arm64 X.so] [--so-armv7 X.so] [--mapas A,B]
#        [--version-name 0.1] [--version-code N] [--conservar]
#   --www: la carpeta con pk.bin (sin cifrar), pk.idx.json y rb/ (como la arma la versión personal).
#   Las .so por defecto: /tmp/claude-0/jxm_target/<abi>/release/libjxmod.so (cargo build -p jxmod-nativo).
#   La firma: la de JXMod (armar_apk.firma(): fuera del repo; la clave nunca se muestra).
import argparse, datetime, glob, gzip, json, os, re, shutil, subprocess, sys, tempfile, zipfile
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import armar_apk as A

PAQUETE, ETIQUETA, ACTIVIDAD = 'com.jxmod.nativo', 'JXMod Nativo', 'com.jxmod.nativo.Juego'
TARGET = '/tmp/claude-0/jxm_target'
MANIFIESTO = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="%s">
  <uses-feature android:glEsVersion="0x00030000" android:required="true"/>
  <application android:label="%s" android:icon="@mipmap/ic_launcher" android:hasCode="true" android:extractNativeLibs="false"
      android:isGame="true" android:appCategory="game" android:allowBackup="false">
    <activity android:name="%s" android:exported="true" android:screenOrientation="sensorLandscape" android:launchMode="singleTask"
        android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|keyboard|navigation|uiMode|density"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen" android:resizeableActivity="false">
      <meta-data android:name="android.app.lib_name" android:value="jxmod"/>
      <intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
    </activity>
  </application>
</manifest>
"""


def rb_de_mapas(www, mapas):
    """Los paquetes aparte (rb/) de los mapas: los dice DATA.rbp (m_<mapa> → [archivo, …]). Con «todo»: todos los de
    DATA.rbp (los 12 mapas que tienen paquete, las skins de los personajes, los memes, las pastillas y lo nuclear)."""
    idx = json.load(open(os.path.join(www, 'pk.idx.json'), encoding='utf-8'))
    o, n = idx['d'][0], idx['d'][1]
    with open(os.path.join(www, 'pk.bin'), 'rb') as f: f.seek(o); crudo = f.read(n)
    try: d = json.loads(gzip.decompress(crudo))
    except Exception: A.fallar('pk.bin no se lee (¿cifrado?): hace falta el de la versión personal sin cifrar')
    fuera = []
    if mapas == ['todo']: return [v[0] for v in (d.get('rbp') or {}).values()]
    for m in mapas:
        r = (d.get('rbp') or {}).get('m_' + m)
        if not r: A.fallar('el mapa', m, 'no tiene paquete aparte en DATA.rbp')
        fuera.append(r[0])
    return fuera


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('salida')
    ap.add_argument('--www', required=True)
    ap.add_argument('--so-arm64', default=os.path.join(TARGET, 'aarch64-linux-android', 'release', 'libjxmod.so'))
    ap.add_argument('--so-armv7', default=os.path.join(TARGET, 'armv7-linux-androideabi', 'release', 'libjxmod.so'))
    ap.add_argument('--mapas', default='todo')
    ap.add_argument('--rb-extra', default='/tmp/claude-0/jxp_pub/rb', help='otra carpeta donde buscar los paquetes aparte que no estén en WWW/rb')
    ap.add_argument('--version-name', default='0.1')
    ap.add_argument('--version-code', type=int, default=int(datetime.datetime.now(datetime.timezone.utc).strftime('%y%m%d%H')))
    ap.add_argument('--conservar', action='store_true')
    a = ap.parse_args()
    h = A.herramientas()
    tmp = tempfile.mkdtemp(prefix='jxnat_', dir='/tmp/claude-0')
    try:
        # 1) la clase de la pantalla completa: javac → d8
        fuentes = sorted(glob.glob(os.path.join(AQUI, 'nativo', 'src', '**', '*.java'), recursive=True))
        clases = os.path.join(tmp, 'clases'); os.makedirs(clases)
        A.correr(['javac', '-source', '8', '-target', '8', '-encoding', 'UTF-8', '-Xlint:-options', '-nowarn',
                  '-bootclasspath', h['android'], '-d', clases] + fuentes, 'javac')
        cjar = os.path.join(tmp, 'clases.jar')
        with zipfile.ZipFile(cjar, 'w') as z:
            for r, _, fs in os.walk(clases):
                for f in fs: z.write(os.path.join(r, f), os.path.relpath(os.path.join(r, f), clases))
        dexdir = os.path.join(tmp, 'dex'); os.makedirs(dexdir)
        A.correr(['java', '-cp', h['d8'], 'com.android.tools.r8.D8', '--release', '--min-api', A.MIN_SDK, '--lib', h['android'],
                  '--output', dexdir, cjar], 'd8')
        dex = os.path.join(dexdir, 'classes.dex')
        _, definidas = A.leer_dex(open(dex, 'rb').read())
        if 'L%s;' % ACTIVIDAD.replace('.', '/') not in definidas: A.fallar(ACTIVIDAD, 'no está en el dex')
        # 2) recursos: sólo el ícono
        res = os.path.join(tmp, 'res')
        for dp in ('mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'):
            os.makedirs(os.path.join(res, 'mipmap-' + dp))
            shutil.copyfile(os.path.join(AQUI, 'res', 'mipmap-' + dp, 'ic_launcher.png'), os.path.join(res, 'mipmap-' + dp, 'ic_launcher.png'))
        rz = os.path.join(tmp, 'res.zip')
        A.correr([h['aapt2'], 'compile', '--dir', res, '-o', rz], 'aapt2 compile')
        # 3) los activos: el paquete del juego, los mapas y las letras
        act = os.path.join(tmp, 'assets'); os.makedirs(os.path.join(act, 'rb')); os.makedirs(os.path.join(act, 'ui'))
        for n in ('pk.bin', 'pk.idx.json'): shutil.copyfile(os.path.join(a.www, n), os.path.join(act, n))
        rbs = rb_de_mapas(a.www, a.mapas.split(','))
        for r in rbs:
            orig = next((os.path.join(d, r) for d in (os.path.join(a.www, 'rb'), a.rb_extra) if d and os.path.isfile(os.path.join(d, r))), None)
            if not orig: A.fallar('no está el paquete aparte', r, '(ni en WWW/rb ni en --rb-extra)')
            shutil.copyfile(orig, os.path.join(act, 'rb', r))
        A.correr([sys.executable, '-I', os.path.join(os.path.dirname(AQUI), 'herramientas', 'atlas_letras.py'), os.path.join(act, 'ui')], 'atlas de letras')
        # (las dos capturas de nado del cuerpo —CMU 126_04 y 79_02, las que la web baja de emotes/cmu—)
        cmu = os.path.join(AQUI, '..', '..', '..', 'web', 'emotes', 'cmu'); os.makedirs(os.path.join(act, 'cmu'))
        for n in ('126_04.bin', '79_02.bin'): shutil.copyfile(os.path.join(cmu, n), os.path.join(act, 'cmu', n))
        man = os.path.join(tmp, 'AndroidManifest.xml')
        with open(man, 'w', encoding='utf-8') as f: f.write(MANIFIESTO % (PAQUETE, ETIQUETA, ACTIVIDAD))
        base = os.path.join(tmp, 'base.apk')
        cmd = [h['aapt2'], 'link', '-o', base, '--manifest', man, '-I', h['android'], '--min-sdk-version', A.MIN_SDK,
               '--target-sdk-version', A.TARGET_SDK, '--version-code', a.version_code, '--version-name', a.version_name, '-A', act]
        for e in A.NO_COMPRIMIR + ['rbp']: cmd += ['-0', e]
        A.correr(cmd + [rz], 'aapt2 link')
        # 4) dex y las .so (sin comprimir: Android las carga directo del APK, alineadas a 16 KB)
        nativas = {}
        for abi, so in (('arm64-v8a', a.so_arm64), ('armeabi-v7a', a.so_armv7)):
            if so and os.path.isfile(so):
                d = open(so, 'rb').read(); k = 'lib/%s/libjxmod.so' % abi; A.revisar_elf(k, d); nativas[k] = d
        if 'lib/arm64-v8a/libjxmod.so' not in nativas: A.fallar('falta la .so de arm64:', a.so_arm64)
        crudo = os.path.join(tmp, 'crudo.apk')
        with zipfile.ZipFile(base) as zin, zipfile.ZipFile(crudo, 'w') as zout:
            for zi in zin.infolist(): zout.writestr(zi, zin.read(zi.filename))
            zout.write(dex, 'classes.dex', compress_type=zipfile.ZIP_DEFLATED)
            for k in sorted(nativas):
                zi = zipfile.ZipInfo(k, date_time=(2008, 1, 1, 0, 0, 0)); zi.compress_type, zi.external_attr = zipfile.ZIP_STORED, 0o644 << 16
                zout.writestr(zi, nativas[k])
        alineado = os.path.join(tmp, 'alineado.apk')
        A.correr([h['zipalign'], '-P', '16', '-f', '4', crudo, alineado], 'zipalign', h['entorno'])
        A.correr([h['zipalign'], '-c', '-P', '16', '4', alineado], 'zipalign -c', h['entorno'])
        # 5) firma v1 + v2 + v3 y revisiones
        ks, clave = A.firma()
        final = os.path.join(tmp, 'final.apk')
        A.correr(['java', '-jar', h['apksigner'], 'sign', '--ks', ks, '--ks-key-alias', 'jxmod', '--ks-pass', clave, '--v1-signing-enabled', 'true',
                  '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true', '--v4-signing-enabled', 'false', '--min-sdk-version', A.MIN_SDK,
                  '--out', final, alineado], 'apksigner sign')
        v = A.correr(['java', '-jar', h['apksigner'], 'verify', '--verbose', '--min-sdk-version', '23', final], 'apksigner verify')
        for esq in ('v1 scheme (JAR signing)', 'v2 scheme (APK Signature Scheme v2)', 'v3 scheme (APK Signature Scheme v3)'):
            if 'Verified using %s: true' % esq not in v: A.fallar('firma', esq, 'no verificada')
        b = A.correr([h['aapt2'], 'dump', 'badging', final], 'aapt2 dump badging')
        for e in ["package: name='%s' versionCode='%d'" % (PAQUETE, a.version_code), "application-label:'%s'" % ETIQUETA,
                  "launchable-activity: name='%s'" % ACTIVIDAD]:
            if e not in b: A.fallar('badging: falta', repr(e), '\n' + b)
        with zipfile.ZipFile(final) as z:
            for k in nativas:
                zi = z.getinfo(k)
                if zi.compress_type != zipfile.ZIP_STORED: A.fallar(k, 'quedó comprimida')
        os.makedirs(os.path.dirname(os.path.abspath(a.salida)), exist_ok=True)
        shutil.copyfile(final, a.salida)
        print('APK:', os.path.abspath(a.salida))
        print('  %.2f MB | %s %s (%d) | nativas: %s | mapas: %s (%s)' % (os.path.getsize(a.salida) / 1048576, PAQUETE, a.version_name, a.version_code,
              ', '.join(k.split('/')[1] for k in sorted(nativas)), a.mapas, '%d paquetes aparte' % len(rbs)))
    finally:
        if a.conservar: print('temporales en', tmp)
        else: shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
