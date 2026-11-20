# Arma el APK de Stickerazo sin Gradle: la página (web/ → assets/www) + javac → d8 → aapt2 → zipalign → apksigner,
# y lo revisa (firmas v1+v2+v3, badging, clases del dex, el manifiesto compilado con el proveedor de WhatsApp).
# Uso: python3 -I herramientas/armar_apk.py [SALIDA.apk] [--version-name 0.1] [--version-code N]
#   versionCode por defecto: fecha y hora UTC (AAMMDDHH). Necesita web/terceros (herramientas/bajar.sh).
# Herramientas: STICKERAZO_SDK o el SDK de JXMod (/tmp/claude-0/android_dl/sdk: android-15/{aapt2, zipalign,
#   lib/d8.jar, lib/apksigner.jar, lib64/} y android-35/android.jar), y un JDK.
# Firma (FUERA del repo): $STICKERAZO_FIRMA_DIR/stickerazo.jks (por defecto /root/.stickerazo/firma), alias stickerazo;
#   la clave en $STICKERAZO_FIRMA_CLAVE o en clave.txt al lado (chmod 600). Si el almacén no existe y está
#   $STICKERAZO_FIRMA_JKS_B64 (el almacén en base64, secreto del entorno) se escribe de ahí; si no, se crea uno nuevo
#   (con clave al azar). La clave nunca se muestra. Sin esa firma las versiones nuevas no se instalan encima.
import argparse, datetime, os, re, secrets, shutil, struct, subprocess, sys, tempfile, zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANDROID, WEB = os.path.join(RAIZ, 'android'), os.path.join(RAIZ, 'web')
PAQUETE, PRINCIPAL, ETIQUETA = 'com.stickerazo.app', 'com.stickerazo.app.Inicio', 'Stickerazo'
MIN_SDK, TARGET_SDK = 24, 35
NO_COMPRIMIR = ['png', 'webp', 'jpg', 'jpeg']


def fallar(*m):
    print('ERROR:', *m, file=sys.stderr)
    sys.exit(1)


def correr(cmd, que, entorno=None):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, env=entorno)
    if r.returncode != 0:
        sys.stderr.write(r.stdout[-20000:] + r.stderr[-20000:])
        fallar(que, 'salió con código %d' % r.returncode)
    return r.stdout + r.stderr


def herramientas():
    sdk = os.environ.get('STICKERAZO_SDK', '/tmp/claude-0/android_dl/sdk')
    bt = os.environ.get('ANDROID_BUILD_TOOLS') or os.path.join(sdk, 'android-15')
    h = {'aapt2': os.path.join(bt, 'aapt2'), 'zipalign': os.path.join(bt, 'zipalign'), 'd8': os.path.join(bt, 'lib', 'd8.jar'),
         'apksigner': os.path.join(bt, 'lib', 'apksigner.jar'),
         'android': os.environ.get('ANDROID_JAR') or os.path.join(sdk, 'android-35', 'android.jar')}
    falta = [k + ': ' + v for k, v in h.items() if not os.path.isfile(v)]
    for p in ('java', 'javac', 'keytool'):
        if not shutil.which(p): falta.append(p + ' (JDK)')
    if falta: fallar('faltan herramientas:\n  ' + '\n  '.join(falta))
    lib64 = os.path.join(bt, 'lib64')
    h['entorno'] = dict(os.environ, LD_LIBRARY_PATH=lib64 + (':' + os.environ['LD_LIBRARY_PATH'] if os.environ.get('LD_LIBRARY_PATH') else ''))
    return h


def firma():
    """(almacén, clave para apksigner: 'env:...' o 'file:...'), fuera del repo."""
    d = os.environ.get('STICKERAZO_FIRMA_DIR', '/root/.stickerazo/firma')
    ks, archivo = os.path.join(d, 'stickerazo.jks'), os.path.join(d, 'clave.txt')
    en_entorno = bool(os.environ.get('STICKERAZO_FIRMA_CLAVE'))
    b64 = os.environ.get('STICKERAZO_FIRMA_JKS_B64', '').strip()
    if b64 and not os.path.isfile(ks):
        import base64
        os.makedirs(d, mode=0o700, exist_ok=True)
        fd = os.open(ks, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as f: f.write(base64.b64decode(b64))
    if not os.path.isfile(ks):
        os.makedirs(d, mode=0o700, exist_ok=True)
        if not en_entorno and not os.path.isfile(archivo):
            fd = os.open(archivo, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w') as f: f.write(secrets.token_urlsafe(24))
        pw = ['-storepass:env', 'STICKERAZO_FIRMA_CLAVE', '-keypass:env', 'STICKERAZO_FIRMA_CLAVE'] if en_entorno else \
             ['-storepass:file', archivo, '-keypass:file', archivo]
        correr(['keytool', '-genkeypair', '-keystore', ks, '-storetype', 'PKCS12', '-alias', 'stickerazo', '-keyalg', 'RSA',
                '-keysize', '3072', '-validity', '12000', '-dname', 'CN=Stickerazo'] + pw, 'keytool')
        os.chmod(ks, 0o600)
        print('firma nueva:', ks, '(hay que guardar una copia: sin ella las versiones nuevas no se instalan encima)')
    if en_entorno: return ks, 'env:STICKERAZO_FIRMA_CLAVE'
    if not os.path.isfile(archivo): fallar('está', ks, 'pero no la clave: poner STICKERAZO_FIRMA_CLAVE o', archivo)
    return ks, 'file:' + archivo


def leer_dex(b):
    """(métodos referenciados, clases definidas) de un classes.dex."""
    if b[:4] != b'dex\n': fallar('dex inválido')
    off_str, n_tipo, off_tipo = struct.unpack_from('<I', b, 0x3C)[0], *struct.unpack_from('<II', b, 0x40)
    metodos = struct.unpack_from('<I', b, 0x58)[0]
    n_cls, off_cls = struct.unpack_from('<II', b, 0x60)

    def cadena(i):
        o = struct.unpack_from('<I', b, off_str + 4 * i)[0]
        while b[o] & 0x80: o += 1
        o += 1
        return b[o:b.index(0, o)].decode('utf-8', 'replace')

    def tipo(t): return cadena(struct.unpack_from('<I', b, off_tipo + 4 * t)[0])
    return metodos, {tipo(struct.unpack_from('<I', b, off_cls + 32 * k)[0]) for k in range(n_cls)}


def activos(tmp):
    """web/ → assets/www (sin lo de prueba: archivos que empiezan con «_»). Falla si faltan MediaPipe o los modelos."""
    for f in ('terceros/mediapipe/vision_bundle.mjs', 'terceros/mediapipe/vision_wasm_internal.wasm', 'terceros/mediapipe/vision_wasm_internal.js',
              'terceros/modelos/selfie_multiclass_256x256.tflite', 'terceros/modelos/magic_touch.tflite'):
        if not os.path.isfile(os.path.join(WEB, f)): fallar('falta web/' + f + ': correr herramientas/bajar.sh')
    dest = os.path.join(tmp, 'assets', 'www')
    shutil.copytree(WEB, dest, ignore=lambda d, fs: [f for f in fs if f.startswith('_') or f.startswith('.')])
    return os.path.join(tmp, 'assets')


def main():
    ap = argparse.ArgumentParser(description='Arma el APK de Stickerazo')
    ap.add_argument('salida', nargs='?', default='/tmp/claude-0/stickerazo/Stickerazo.apk')
    ap.add_argument('--version-name', default='0.1')
    ap.add_argument('--version-code', type=int, default=int(datetime.datetime.now(datetime.timezone.utc).strftime('%y%m%d%H')))
    ap.add_argument('--conservar', action='store_true', help='no borrar la carpeta temporal')
    a = ap.parse_args()
    h = herramientas()
    tmp = tempfile.mkdtemp(prefix='stickerazo_apk_')
    try:
        # 1) javac (Java 8, contra android.jar)
        fuentes = sorted(os.path.join(r, f) for r, _, fs in os.walk(os.path.join(ANDROID, 'src')) for f in fs if f.endswith('.java'))
        if not fuentes: fallar('no hay fuentes Java')
        clases = os.path.join(tmp, 'clases')
        os.makedirs(clases)
        correr(['javac', '-source', '8', '-target', '8', '-encoding', 'UTF-8', '-g:source,lines', '-Xlint:-options', '-Xlint:deprecation', '-bootclasspath', h['android'], '-d', clases] + fuentes, 'javac')
        cjar = os.path.join(tmp, 'clases.jar')
        with zipfile.ZipFile(cjar, 'w', zipfile.ZIP_STORED) as z:
            for r, _, fs in os.walk(clases):
                for f in fs: z.write(os.path.join(r, f), os.path.relpath(os.path.join(r, f), clases))
        # 2) d8
        dexdir = os.path.join(tmp, 'dex')
        os.makedirs(dexdir)
        avisos = [x for x in correr(['java', '-cp', h['d8'], 'com.android.tools.r8.D8', '--release', '--min-api', MIN_SDK, '--lib', h['android'],
                                     '--output', dexdir, cjar], 'd8').splitlines() if re.match(r'\s*(Warning|Error)', x)]
        if avisos: print('d8:', '\n'.join(avisos[:12]))
        dex = os.path.join(dexdir, 'classes.dex')
        if not os.path.isfile(dex): fallar('d8 no generó classes.dex')
        with open(dex, 'rb') as f: metodos, definidas = leer_dex(f.read())
        for c in ('Inicio', 'Stickers', 'Fotos', 'Puente', 'Almacen'):
            if 'Lcom/stickerazo/app/%s;' % c not in definidas: fallar(c, 'no está en el dex')
        # 3) aapt2: recursos, manifiesto y la página
        rz = os.path.join(tmp, 'res.zip')
        correr([h['aapt2'], 'compile', '--dir', os.path.join(ANDROID, 'res'), '-o', rz], 'aapt2 compile')
        base = os.path.join(tmp, 'base.apk')
        cmd = [h['aapt2'], 'link', '-o', base, '--manifest', os.path.join(ANDROID, 'AndroidManifest.xml'), '-I', h['android'],
               '--min-sdk-version', MIN_SDK, '--target-sdk-version', TARGET_SDK, '--version-code', a.version_code,
               '--version-name', a.version_name, '-A', activos(tmp)]
        for e in NO_COMPRIMIR: cmd += ['-0', e]
        av = correr(cmd + [rz], 'aapt2 link').strip()
        if av: print('aapt2:', av)
        # 4) el dex adentro, 5) zipalign
        crudo = os.path.join(tmp, 'crudo.apk')
        with zipfile.ZipFile(base) as zin, zipfile.ZipFile(crudo, 'w') as zout:
            for zi in zin.infolist(): zout.writestr(zi, zin.read(zi.filename))
            zout.write(dex, 'classes.dex', compress_type=zipfile.ZIP_DEFLATED)
        alineado = os.path.join(tmp, 'alineado.apk')
        correr([h['zipalign'], '-P', '16', '-f', '4', crudo, alineado], 'zipalign', h['entorno'])
        correr([h['zipalign'], '-c', '-P', '16', '4', alineado], 'zipalign -c', h['entorno'])
        # 6) firma v1 + v2 + v3
        ks, clave = firma()
        final = os.path.join(tmp, 'Stickerazo.apk')
        correr(['java', '-jar', h['apksigner'], 'sign', '--ks', ks, '--ks-key-alias', 'stickerazo', '--ks-pass', clave,
                '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true', '--v4-signing-enabled', 'false',
                '--min-sdk-version', MIN_SDK, '--out', final, alineado], 'apksigner sign')
        # 7) revisiones
        v = correr(['java', '-jar', h['apksigner'], 'verify', '--print-certs', '--verbose', '--min-sdk-version', '23', final], 'apksigner verify')
        for esq in ('v1 scheme (JAR signing)', 'v2 scheme (APK Signature Scheme v2)', 'v3 scheme (APK Signature Scheme v3)'):
            if 'Verified using %s: true' % esq not in v: fallar('firma', esq, 'no verificada')
        sha = re.search(r'Signer #1 certificate SHA-256 digest: (\w+)', v)
        b = correr([h['aapt2'], 'dump', 'badging', final], 'aapt2 dump badging')
        for e in ["package: name='%s' versionCode='%d' versionName='%s'" % (PAQUETE, a.version_code, a.version_name),
                  "targetSdkVersion:'%d'" % TARGET_SDK, "application-label:'%s'" % ETIQUETA, "launchable-activity: name='%s'" % PRINCIPAL]:
            if e not in b: fallar('badging: falta', repr(e), '\n' + b)
        if not re.search(r"^(?:min)?[sS]dkVersion:'%d'$" % MIN_SDK, b, re.M): fallar('badging: minSdk no es', MIN_SDK)
        if 'native-code' in b: fallar('badging: código nativo inesperado')
        # el proveedor de WhatsApp, como lo pide su ejemplo: público, con su permiso de lectura y la autoridad que usa el código
        xt = correr([h['aapt2'], 'dump', 'xmltree', '--file', 'AndroidManifest.xml', final], 'aapt2 dump xmltree')
        # (cada elemento: su línea «E: provider» y sus atributos «A: …», hasta el próximo «E:»)
        prov = [m.group(1) for m in re.finditer(r'E: provider[^\n]*\n((?:\s*A: [^\n]*\n)*)', xt) if 'Stickers"' in m.group(1)]
        if not prov: fallar('manifiesto: no está el proveedor .Stickers')
        p0 = prov[0]
        for patron, que in ((r':authorities\(0x01010018\)="com\.stickerazo\.app\.stickers"', 'autoridad'), (r':exported\(0x01010010\)=(true|\(type 0x12\)0xffffffff)', 'público'),
                            (r':readPermission\(0x01010007\)="com\.whatsapp\.sticker\.READ"', 'permiso de WhatsApp')):
            if not re.search(patron, p0): fallar('manifiesto: al proveedor de WhatsApp le falta', que, '\n' + p0[:1500])
        for paquete in ('com.whatsapp', 'com.whatsapp.w4b'):
            if paquete not in xt.split('E: application')[0]: fallar('manifiesto: falta <queries>', paquete)
        with zipfile.ZipFile(final) as z: nombres = z.namelist()
        for f in ('assets/www/index.html', 'assets/www/app.js', 'assets/www/terceros/modelos/magic_touch.tflite', 'assets/www/fuentes/LuckiestGuy.ttf',
                  'res/mipmap-xxxhdpi-v4/ic_launcher.png'):
            if f not in nombres: fallar('falta en el APK:', f)
        os.makedirs(os.path.dirname(os.path.abspath(a.salida)), exist_ok=True)
        shutil.copyfile(final, a.salida)
        permisos = re.findall(r"uses-permission: name='([^']+)'", b)
        print('APK:', os.path.abspath(a.salida))
        print('  %.2f MB  |  versionCode %d  versionName %s  |  minSdk %d targetSdk %d'
              % (os.path.getsize(a.salida) / 1048576, a.version_code, a.version_name, MIN_SDK, TARGET_SDK))
        print('  dex: %d métodos referenciados, %d clases  |  %d .java  |  %d archivos de la página'
              % (metodos, len(definidas), len(fuentes), sum(1 for n in nombres if n.startswith('assets/www/'))))
        print('  permisos: %s' % ', '.join(p.rsplit('.', 1)[-1] for p in permisos))
        print('  firma v1+v2+v3 ok  SHA-256 %s' % (sha and sha.group(1)[:16] + '…'))
    finally:
        if a.conservar: print('temporales en', tmp)
        else: shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
