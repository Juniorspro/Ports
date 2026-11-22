# Arma el APK de JX Hand sin Gradle (como el de JXMod): javac → d8 → aapt2 compile/link (con la página y el motor en
# assets/web) → zipalign → apksigner, y lo revisa (firmas, aapt2 dump badging).
# Uso: python3 -I app/armar_apk.py [SALIDA.apk] [--version-name 1.0] [--version-code N]
#   SALIDA: por defecto porteos/jxhand/JXHand.apk. versionCode: fecha y hora UTC (AAMMDDHH).
# Herramientas: JXHAND_SDK (por defecto /tmp/claude-0/android_dl/sdk, con android-15/{aapt2, zipalign, lib/d8.jar,
#   lib/apksigner.jar, lib64/} y android-35/android.jar), las mismas de JXMod.
# Firma propia (fuera del repo, que es público): /root/.jxhand/firma/jxhand.jks, alias jxhand, clave en clave.txt al
#   lado (chmod 600). Si no existe se crea una vez, con una clave al azar. La clave nunca se muestra.
import argparse, datetime, os, secrets, shutil, subprocess, sys, tempfile, zipfile

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
MIN_SDK, TARGET_SDK = 24, 35
FIRMA = os.environ.get('JXHAND_FIRMA_DIR', '/root/.jxhand/firma')


def fallar(*m): print('ERROR:', *m, file=sys.stderr); sys.exit(1)


def correr(cmd, que, entorno=None):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, env=entorno)
    if r.returncode != 0: sys.stderr.write((r.stdout + r.stderr)[-6000:]); fallar(que, 'salió con código', r.returncode)
    return r.stdout + r.stderr


def herramientas():
    sdk = os.environ.get('JXHAND_SDK', '/tmp/claude-0/android_dl/sdk'); bt = os.path.join(sdk, 'android-15')
    h = {'aapt2': os.path.join(bt, 'aapt2'), 'zipalign': os.path.join(bt, 'zipalign'), 'd8': os.path.join(bt, 'lib', 'd8.jar'),
         'apksigner': os.path.join(bt, 'lib', 'apksigner.jar'), 'android': os.path.join(sdk, 'android-35', 'android.jar')}
    falta = [k for k, v in h.items() if not os.path.isfile(v)] + [p for p in ('java', 'javac', 'keytool') if not shutil.which(p)]
    if falta: fallar('faltan herramientas:', ', '.join(falta))
    h['entorno'] = dict(os.environ, LD_LIBRARY_PATH=os.path.join(bt, 'lib64'))
    return h


def firma():
    """el almacén y su clave (se crean una vez); la clave va por variable de entorno, nunca en la línea de comandos"""
    os.makedirs(FIRMA, mode=0o700, exist_ok=True)
    ks, pc = os.path.join(FIRMA, 'jxhand.jks'), os.path.join(FIRMA, 'clave.txt')
    if not os.path.isfile(pc):
        with open(pc, 'w') as f: f.write(secrets.token_urlsafe(24))
        os.chmod(pc, 0o600)
    clave = open(pc).read().strip()
    ent = dict(os.environ, JXH_PASS=clave)
    if not os.path.isfile(ks):
        correr(['keytool', '-genkeypair', '-keystore', ks, '-storetype', 'PKCS12', '-alias', 'jxhand', '-keyalg', 'RSA', '-keysize', '3072',
                '-validity', '36500', '-storepass:env', 'JXH_PASS', '-keypass:env', 'JXH_PASS', '-dname', 'CN=JXApps, O=JXApps'], 'keytool', ent)
        os.chmod(ks, 0o600); print('firma nueva creada en', FIRMA)
    return ks, ent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('salida', nargs='?', default=os.path.join(RAIZ, 'JXHand.apk'))
    ap.add_argument('--version-name', default='1.0')
    ap.add_argument('--version-code', type=int, default=int(datetime.datetime.now(datetime.timezone.utc).strftime('%y%m%d%H')))
    a = ap.parse_args(); h = herramientas()
    with tempfile.TemporaryDirectory() as tmp:
        # 1) Java (Java 8, sin lambdas: no hacen falta los stubs de LambdaMetafactory)
        fuentes = [os.path.join(r, f) for r, _, fs in os.walk(os.path.join(AQUI, 'src')) for f in fs if f.endswith('.java')]
        clases = os.path.join(tmp, 'clases'); os.makedirs(clases)
        correr(['javac', '-source', '8', '-target', '8', '-encoding', 'UTF-8', '-Xlint:-options', '-nowarn', '-bootclasspath', h['android'], '-d', clases] + fuentes, 'javac')
        cjar = os.path.join(tmp, 'clases.jar')
        with zipfile.ZipFile(cjar, 'w') as z:
            for r, _, fs in os.walk(clases):
                for f in fs: z.write(os.path.join(r, f), os.path.relpath(os.path.join(r, f), clases))
        dexdir = os.path.join(tmp, 'dex'); os.makedirs(dexdir)
        correr(['java', '-cp', h['d8'], 'com.android.tools.r8.D8', '--release', '--min-api', MIN_SDK, '--lib', h['android'], '--output', dexdir, cjar], 'd8')
        # 2) la página y el motor en assets/web
        web = os.path.join(tmp, 'assets', 'web'); os.makedirs(os.path.join(web, 'modelos'))
        shutil.copy(os.path.join(AQUI, 'web', 'index.html'), web)
        for f in ('jxhand.js', 'jxhand_relaxed.wasm', 'jxhand_simd.wasm'): shutil.copy(os.path.join(RAIZ, 'web', f), web)
        for f in ('hand_detector.tflite', 'hand_landmarks_detector.tflite', 'hand_landmark_lite.tflite'): shutil.copy(os.path.join(RAIZ, 'modelos', f), os.path.join(web, 'modelos'))
        # 3) recursos y enlace
        rz = os.path.join(tmp, 'res.zip')
        correr([h['aapt2'], 'compile', '--dir', os.path.join(AQUI, 'res'), '-o', rz], 'aapt2 compile')
        base = os.path.join(tmp, 'base.apk')
        correr([h['aapt2'], 'link', '-o', base, '--manifest', os.path.join(AQUI, 'AndroidManifest.xml'), '-I', h['android'], '--min-sdk-version', MIN_SDK,
                '--target-sdk-version', TARGET_SDK, '--version-code', a.version_code, '--version-name', a.version_name, '-A', os.path.join(tmp, 'assets'),
                '-0', 'tflite', '-0', 'wasm', '-0', 'png', rz], 'aapt2 link')
        crudo = os.path.join(tmp, 'crudo.apk')
        with zipfile.ZipFile(base) as zin, zipfile.ZipFile(crudo, 'w') as zout:
            for zi in zin.infolist(): zout.writestr(zi, zin.read(zi.filename))
            for f in sorted(os.listdir(dexdir)): zout.write(os.path.join(dexdir, f), f, compress_type=zipfile.ZIP_DEFLATED)
        # 4) alinear, firmar (v1 + v2 + v3) y revisar
        alineado = os.path.join(tmp, 'alineado.apk')
        correr([h['zipalign'], '-P', '16', '-f', '4', crudo, alineado], 'zipalign', h['entorno'])
        ks, ent = firma()
        final = os.path.join(tmp, 'final.apk')
        correr(['java', '-jar', h['apksigner'], 'sign', '--ks', ks, '--ks-key-alias', 'jxhand', '--ks-pass', 'env:JXH_PASS', '--key-pass', 'env:JXH_PASS',
                '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true', '--min-sdk-version', MIN_SDK, '--out', final, alineado], 'apksigner sign', ent)
        v = correr(['java', '-jar', h['apksigner'], 'verify', '--verbose', '--min-sdk-version', MIN_SDK, final], 'apksigner verify')
        if 'Verified using v2 scheme (APK Signature Scheme v2): true' not in v: fallar('la firma v2 no se verificó')
        b = correr([h['aapt2'], 'dump', 'badging', final], 'aapt2 dump badging', h['entorno'])
        for esperado in ("package: name='com.jxapps.jxhand'", "application-label:'JX Hand'", "uses-permission: name='android.permission.CAMERA'", "launchable-activity: name='com.jxapps.jxhand.Principal'"):
            if esperado not in b: fallar('badging: falta', esperado, '\n' + b[:1500])
        os.makedirs(os.path.dirname(os.path.abspath(a.salida)), exist_ok=True); shutil.copy(final, a.salida)
        print('%s · %.2f MB · versionCode %d · versionName %s · minSdk %d targetSdk %d · firmas v1+v2+v3 bien'
              % (a.salida, os.path.getsize(a.salida) / 1e6, a.version_code, a.version_name, MIN_SDK, TARGET_SDK))


if __name__ == '__main__':
    main()
