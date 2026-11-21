# Arma el APK de Stickerazo sin Gradle: la página (web/ → assets/www) + javac → d8 → aapt2 → zipalign → apksigner,
# y lo revisa (firmas v1+v2+v3, badging, clases del dex, el manifiesto compilado con el proveedor de WhatsApp).
# Uso: python3 -I herramientas/armar_apk.py [SALIDA.apk] [--version-name 0.1] [--version-code N] [--aab SALIDA.aab]
#        [--canal web|play|galaxy|huawei|uptodown] [--publicar]
#   --canal: de dónde se baja (va en assets/canal.txt). «web» (el de nuestra página, por defecto) se actualiza solo: baja
#   el APK nuevo y lo instala (permiso REQUEST_INSTALL_PACKAGES). Los de las tiendas NO tienen ese permiso (las tiendas no
#   lo dejan): para un APK nuevo abren su tienda. Con --aab el canal es «play».
#   --publicar (sólo canal web): copia el APK a descargas/Stickerazo.apk (lo que baja la página y la app), escribe
#   descargas/app.json (versión, nombre, tamaño, huella) y vuelve a firmar web/ota.json con esos datos.
#   versionCode por defecto: AAMMDD y el cuarto de hora UTC del día (00-95), así cada armado es mayor que el anterior.
#   --aab: además, el paquete para Google Play (Android App Bundle), firmado con la misma llave (la «de subida»).
#   Necesita web/terceros (herramientas/bajar.sh).
# Herramientas: STICKERAZO_SDK o el SDK de JXMod (/tmp/claude-0/android_dl/sdk: android-16 o android-15/{aapt2, zipalign,
#   lib/d8.jar, lib/apksigner.jar, lib64/}, android-36/android.jar y, para --aab, bundletool.jar), y un JDK.
# Firma (FUERA del repo): $STICKERAZO_FIRMA_DIR/stickerazo.jks (por defecto /root/.stickerazo/firma), alias stickerazo;
#   la clave en $STICKERAZO_FIRMA_CLAVE o en clave.txt al lado (chmod 600). Si el almacén no existe y está
#   $STICKERAZO_FIRMA_JKS_B64 (el almacén en base64, secreto del entorno) se escribe de ahí; si no, se crea uno nuevo
#   (con clave al azar). La clave nunca se muestra. Sin esa firma las versiones nuevas no se instalan encima.
import argparse, datetime, os, re, secrets, shutil, struct, subprocess, sys, tempfile, zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANDROID, WEB = os.path.join(RAIZ, 'android'), os.path.join(RAIZ, 'web')
PAQUETE, PRINCIPAL, ETIQUETA = 'com.stickerazo.app', 'com.stickerazo.app.Inicio', 'Stickerazo'
# (Google Play pide targetSdk 36 —Android 16— para apps nuevas y actualizaciones desde el 31/8/2026)
MIN_SDK, TARGET_SDK = 24, 36
# (el APK más viejo que puede usar la página de ahora: subirlo cuando la página use algo nuevo del puente con Java)
OTA_APK_MIN = 0
NO_COMPRIMIR = ['png', 'webp', 'jpg', 'jpeg']
CANALES = ('web', 'play', 'galaxy', 'huawei', 'uptodown')
# (sólo el de la web: instalar el APK nuevo él mismo y, desde Android 14, sin preguntar las veces siguientes)
PERMISOS_WEB = ['android.permission.REQUEST_INSTALL_PACKAGES', 'android.permission.UPDATE_PACKAGES_WITHOUT_USER_ACTION']
DESCARGAS = os.path.join(RAIZ, 'descargas')


def manifiesto(tmp, canal):
    """el AndroidManifest.xml de este canal (el de la web suma los permisos para actualizarse solo)"""
    with open(os.path.join(ANDROID, 'AndroidManifest.xml'), encoding='utf-8') as f: m = f.read()
    if canal == 'web':
        extra = ''.join('    <uses-permission android:name="%s" />\n' % p for p in PERMISOS_WEB)
        ancla = '    <uses-permission android:name="android.permission.VIBRATE" />\n'
        if ancla not in m: fallar('manifiesto: no encuentro dónde poner los permisos de actualizar')
        m = m.replace(ancla, ancla + extra)
    d = os.path.join(tmp, 'manifiesto'); os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'AndroidManifest.xml'), 'w', encoding='utf-8') as f: f.write(m)
    return os.path.join(d, 'AndroidManifest.xml')


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
    bt = os.environ.get('ANDROID_BUILD_TOOLS') or next((os.path.join(sdk, x) for x in ('android-16', 'android-15') if os.path.isdir(os.path.join(sdk, x))), os.path.join(sdk, 'android-16'))
    h = {'aapt2': os.path.join(bt, 'aapt2'), 'zipalign': os.path.join(bt, 'zipalign'), 'd8': os.path.join(bt, 'lib', 'd8.jar'),
         'apksigner': os.path.join(bt, 'lib', 'apksigner.jar'),
         'android': os.environ.get('ANDROID_JAR') or os.path.join(sdk, 'android-%d' % TARGET_SDK, 'android.jar')}
    h['bundletool'] = os.environ.get('BUNDLETOOL') or os.path.join(sdk, 'bundletool.jar')
    falta = [k + ': ' + v for k, v in h.items() if k != 'bundletool' and not os.path.isfile(v)]
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


def activos(tmp, canal='web'):
    """web/ → assets/www (sin lo de prueba: archivos que empiezan con «_»). Falla si faltan MediaPipe o los modelos."""
    for f in ('terceros/mediapipe/vision_bundle.mjs', 'terceros/mediapipe/vision_wasm_internal.wasm', 'terceros/mediapipe/vision_wasm_internal.js',
              'terceros/modelos/selfie_multiclass_256x256.tflite', 'terceros/modelos/magic_touch.tflite'):
        if not os.path.isfile(os.path.join(WEB, f)): fallar('falta web/' + f + ': correr herramientas/bajar.sh')
    dest = os.path.join(tmp, 'assets', 'www')
    shutil.copytree(WEB, dest, ignore=lambda d, fs: [f for f in fs if f.startswith('_') or f.startswith('.')])
    # (las actualizaciones solas: se firma la página de ahora —web/ota.json, va en el commit— y el APK lleva sus huellas
    # y la llave pública para revisar las que vengan)
    import json as _json
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ota
    datos = ota.generar(OTA_APK_MIN)
    with open(os.path.join(tmp, 'assets', 'ota_base.json'), 'w', encoding='utf-8') as f: _json.dump({'v': datos['v'], 'archivos': ota.archivos(WEB)}, f)
    with open(os.path.join(tmp, 'assets', 'ota_pub.txt'), 'w') as f: f.write(ota.publica_b64())
    with open(os.path.join(tmp, 'assets', 'canal.txt'), 'w') as f: f.write(canal)
    print('página: versión %d (%d archivos que se actualizan solos)  |  canal: %s' % (datos['v'], len(datos['archivos']), canal))
    return os.path.join(tmp, 'assets')


def main():
    ap = argparse.ArgumentParser(description='Arma el APK de Stickerazo')
    ap.add_argument('salida', nargs='?', default='/tmp/claude-0/stickerazo/Stickerazo.apk')
    ap.add_argument('--version-name', default='0.1')
    ahora = datetime.datetime.now(datetime.timezone.utc)
    ap.add_argument('--version-code', type=int, default=int(ahora.strftime('%y%m%d')) * 100 + (ahora.hour * 60 + ahora.minute) // 15)
    ap.add_argument('--aab', help='también el Android App Bundle para Google Play')
    ap.add_argument('--conservar', action='store_true', help='no borrar la carpeta temporal')
    ap.add_argument('--canal', choices=CANALES, help='de dónde se baja (por defecto «web»; con --aab, «play»)')
    ap.add_argument('--publicar', action='store_true', help='(canal web) dejarlo en descargas/ para la página y las actualizaciones')
    a = ap.parse_args()
    a.canal = a.canal or ('play' if a.aab else 'web')
    if a.aab and a.canal != 'play': fallar('el AAB es para Google Play: --canal play (o sin --canal)')
    if a.publicar and a.canal != 'web': fallar('--publicar es para el APK de la página (canal web)')
    h = herramientas()
    if a.aab and not os.path.isfile(h['bundletool']): fallar('falta bundletool.jar (para --aab):', h['bundletool'])
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
        act = activos(tmp, a.canal)
        a.manifiesto = manifiesto(tmp, a.canal)
        cmd = [h['aapt2'], 'link', '-o', base, '--manifest', a.manifiesto, '-I', h['android'],
               '--min-sdk-version', MIN_SDK, '--target-sdk-version', TARGET_SDK, '--version-code', a.version_code,
               '--version-name', a.version_name, '-A', act]
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
        # los permisos de actualizarse solo: sólo en el de la web (Play y las otras tiendas no lo aceptan)
        for perm in PERMISOS_WEB:
            if (("uses-permission: name='%s'" % perm) in b) != (a.canal == 'web'): fallar('permiso', perm, 'en el canal', a.canal)
        for paquete in ('com.whatsapp', 'com.whatsapp.w4b'):
            if paquete not in xt.split('E: application')[0]: fallar('manifiesto: falta <queries>', paquete)
        with zipfile.ZipFile(final) as z: nombres = z.namelist()
        with zipfile.ZipFile(final) as z:
            if z.read('assets/canal.txt').decode() != a.canal: fallar('canal.txt no dice', a.canal)
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
        if a.aab: armar_aab(h, a, tmp, rz, act, dex, ks, clave, b, nombres)
        if a.publicar: publicar(a)
    finally:
        if a.conservar: print('temporales en', tmp)
        else: shutil.rmtree(tmp, ignore_errors=True)


def publicar(a):
    """el APK de la página: descargas/Stickerazo.apk + descargas/app.json, y ota.json firmado otra vez con esos datos"""
    import hashlib, json as _json
    os.makedirs(DESCARGAS, exist_ok=True)
    destino = os.path.join(DESCARGAS, 'Stickerazo.apk')
    shutil.copyfile(a.salida, destino)
    with open(destino, 'rb') as f: d = f.read()
    info = {'v': a.version_code, 'nombre': a.version_name, 'n': len(d), 'h': hashlib.sha256(d).hexdigest(), 'minSdk': MIN_SDK,
            'fecha': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')}
    with open(os.path.join(DESCARGAS, 'app.json'), 'w', encoding='utf-8') as f: _json.dump(info, f, ensure_ascii=False, indent=1)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ota
    o = ota.generar(OTA_APK_MIN)
    if o.get('apk', {}).get('h') != info['h']: fallar('ota.json no quedó con la huella del APK')
    print('publicado: descargas/Stickerazo.apk  %s (%d)  %.2f MB  |  ota.json versión %d con los datos del APK' % (info['nombre'], info['v'], info['n'] / 1048576, o['v']))


def armar_aab(h, a, tmp, rz, act, dex, ks, clave, badging_apk, nombres_apk):
    """El paquete para Google Play: los mismos recursos, página y dex en formato «proto», armado con bundletool y
    firmado con jarsigner (la llave de subida). Se revisa: bundletool validate y el APK universal que sale de él tiene que
    decir lo mismo que el APK (paquete, versiones, permisos, página)."""
    bt = ['java', '-jar', h['bundletool']]
    proto = os.path.join(tmp, 'proto.apk')
    correr([h['aapt2'], 'link', '--proto-format', '-o', proto, '--manifest', a.manifiesto, '-I', h['android'],
            '--min-sdk-version', MIN_SDK, '--target-sdk-version', TARGET_SDK, '--version-code', a.version_code,
            '--version-name', a.version_name, '-A', act, rz], 'aapt2 link --proto-format')
    modulo = os.path.join(tmp, 'base.zip')
    with zipfile.ZipFile(proto) as zin, zipfile.ZipFile(modulo, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in zin.namelist():
            if n == 'AndroidManifest.xml': d = 'manifest/AndroidManifest.xml'
            elif n == 'resources.pb' or n.startswith('res/') or n.startswith('assets/'): d = n
            else: fallar('aab: no sé dónde va', n)
            zout.writestr(d, zin.read(n))
        zout.write(dex, 'dex/classes.dex')
    # (las imágenes ya vienen comprimidas: se guardan tal cual, como en el APK)
    conf = os.path.join(tmp, 'BundleConfig.json')
    with open(conf, 'w') as f:
        import json as _json
        _json.dump({'compression': {'uncompressedGlob': ['**/*.' + e for e in NO_COMPRIMIR]}}, f)
    crudo = os.path.join(tmp, 'crudo.aab')
    correr(bt + ['build-bundle', '--modules=' + modulo, '--output=' + crudo, '--config=' + conf], 'bundletool build-bundle')
    # firma (jarsigner, como pide Play para el AAB)
    tipo, valor = clave.split(':', 1)
    pw = ['-storepass:env', valor] if tipo == 'env' else ['-storepass:file', valor]
    final = os.path.join(tmp, 'Stickerazo.aab')
    shutil.copyfile(crudo, final)
    correr(['jarsigner', '-keystore', ks, '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256'] + pw + [final, 'stickerazo'], 'jarsigner')
    v = correr(['jarsigner', '-verify', '-certs', final], 'jarsigner -verify')
    if 'jar verified.' not in v: fallar('aab: la firma no verifica\n' + v[-2000:])
    correr(bt + ['validate', '--bundle=' + final], 'bundletool validate')
    # el APK universal que armaría Play, firmado con la misma llave, tiene que ser igual al nuestro
    kp = os.path.join(tmp, 'kp.txt')
    fd = os.open(kp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f: f.write(os.environ[valor] if tipo == 'env' else open(valor).read().strip())
    apks = os.path.join(tmp, 'u.apks')
    try:
        correr(bt + ['build-apks', '--bundle=' + final, '--output=' + apks, '--mode=universal', '--ks=' + ks, '--ks-key-alias=stickerazo',
                     '--ks-pass=file:' + kp], 'bundletool build-apks')
    finally:
        os.remove(kp)
    with zipfile.ZipFile(apks) as z:
        uni = os.path.join(tmp, 'universal.apk')
        with open(uni, 'wb') as f: f.write(z.read('universal.apk'))
    b = correr([h['aapt2'], 'dump', 'badging', uni], 'aapt2 dump badging (universal)')
    clave_badging = lambda t: sorted(x for x in t.splitlines() if re.match(r"(package|sdkVersion|minSdkVersion|targetSdkVersion|uses-permission|application-label|launchable-activity):", x))
    if clave_badging(b) != clave_badging(badging_apk): fallar('aab: el APK universal no coincide con el APK\n' + '\n'.join(sorted(set(clave_badging(b)) ^ set(clave_badging(badging_apk)))))
    with zipfile.ZipFile(uni) as z: un = set(z.namelist())
    falta = sorted(n for n in nombres_apk if n.startswith('assets/') and n not in un)
    if falta: fallar('aab: al APK universal le faltan', falta[:10])
    os.makedirs(os.path.dirname(os.path.abspath(a.aab)), exist_ok=True)
    shutil.copyfile(final, a.aab)
    print('AAB:', os.path.abspath(a.aab))
    print('  %.2f MB  |  bundletool validate ok  |  firma (jarsigner) ok  |  el APK universal coincide con el APK' % (os.path.getsize(a.aab) / 1048576))


if __name__ == '__main__':
    main()
