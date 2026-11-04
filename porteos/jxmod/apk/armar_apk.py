# Arma el APK de JXMod sin Gradle: javac → d8 → aapt2 compile/link → dex y .so adentro → zipalign → apksigner,
# y lo revisa (firmas v1+v2+v3, aapt2 dump badging, clases del dex, alineación). Falla fuerte ante cualquier error.
# Uso: python3 -I apk/armar_apk.py [SALIDA.apk] [--version-name 1.0] [--version-code N] [--src DIR]... [--libs DIR] [--conservar]
#   SALIDA: por defecto /home/user/Ports/jxmod/JXMod.apk. versionCode: fecha y hora UTC del armado (AAMMDDHH).
#   Compila apk/web/src y apk/unido/src (Java 8) contra android.jar (+ los .jar/.aar de --libs, si se pasa una carpeta;
#   sus .so irían a lib/<abi>/ sin comprimir y alineadas a 16 KB). Hoy la app no lleva bibliotecas ni código nativo.
# Herramientas: JXMOD_SDK (por defecto /tmp/claude-0/android_dl/sdk, con android-15/{aapt2, zipalign, lib/d8.jar,
#   lib/apksigner.jar, lib64/} y android-35/android.jar) o ANDROID_BUILD_TOOLS (build-tools/<v>) + ANDROID_JAR.
# Firma (fuera del repo, que es público): $JXMOD_FIRMA_DIR/jxmod.jks (por defecto /root/.jxmod/firma), alias jxmod;
#   clave en $JXMOD_FIRMA_CLAVE o, si no está, en clave.txt al lado del almacén (chmod 600). Si no existe el
#   almacén se crea una vez (con clave al azar si no hay ninguna). La clave nunca se muestra.
import argparse, datetime, glob, os, re, secrets, shutil, struct, subprocess, sys, tempfile, zipfile

AQUI = os.path.dirname(os.path.abspath(__file__))
PAQUETE, PRINCIPAL = 'com.jxmod.app', 'com.jxmod.app.Inicio'
MIN_SDK, TARGET_SDK = 24, 35
ABIS = {'arm64-v8a': (2, 183), 'armeabi-v7a': (1, 40), 'x86_64': (2, 62), 'x86': (1, 3)}   # clase ELF, máquina
NO_COMPRIMIR = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'ogg', 'oga', 'mp3', 'm4a', 'aac', 'opus', 'flac', 'wav', 'mp4',
                'webm', 'zip', 'gz', 'gma', 'bz2', 'xz', '7z', 'ktx', 'ktx2', 'pkm', 'astc', 'bin', 'idx']


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
    sdk = os.environ.get('JXMOD_SDK', '/tmp/claude-0/android_dl/sdk')
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


def bibliotecas(tmp, libs):
    """Jars a compilar y dexar, y las .so: {'lib/<abi>/x.so': (bytes, origen)}."""
    if not libs: return [], {}
    jars, nativas = sorted(glob.glob(os.path.join(libs, '*.jar'))), {}

    def agregar(abi, nombre, datos, origen):
        if abi not in ABIS:
            print('AVISO: ABI desconocida %r (%s): no se incluye' % (abi, origen))
            return
        k = 'lib/%s/%s' % (abi, nombre)
        if k in nativas and nativas[k][0] != datos: fallar('dos %s distintas: %s y %s' % (k, nativas[k][1], origen))
        nativas[k] = (datos, origen)

    for so in sorted(glob.glob(os.path.join(libs, 'jni', '*', '*.so'))):
        with open(so, 'rb') as f: agregar(os.path.basename(os.path.dirname(so)), os.path.basename(so), f.read(), so)
    for aar in sorted(glob.glob(os.path.join(libs, '*.aar'))):
        base, con_res = os.path.splitext(os.path.basename(aar))[0], False
        with zipfile.ZipFile(aar) as z:
            for n in z.namelist():
                m = re.fullmatch(r'jni/([^/]+)/([^/]+\.so)', n)
                if n == 'classes.jar' or re.fullmatch(r'libs/[^/]+\.jar', n):
                    dest = os.path.join(tmp, 'aar', base, n.replace('/', '_'))
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    with open(dest, 'wb') as f: f.write(z.read(n))
                    jars.append(dest)
                elif m: agregar(m.group(1), m.group(2), z.read(n), aar + '!' + n)
                elif n.startswith('res/') and not n.endswith('/'): con_res = True
        if con_res: print('AVISO: %s trae recursos (res/) que no se enlazan' % os.path.basename(aar))
    return jars, nativas


def revisar_elf(k, d):
    """La .so es de la ABI de su carpeta; en 64 bits avisa si no carga con páginas de 16 KB."""
    abi = k.split('/')[1]
    if d[:4] != b'\x7fELF': fallar(k, 'no es un ELF')
    clase, maquina = d[4], struct.unpack_from('<H', d, 18)[0]
    if (clase, maquina) != ABIS[abi]: fallar(k, 'es de otra arquitectura (clase ELF %d, máquina %d)' % (clase, maquina))
    if clase == 2: phoff, (phent, phnum) = struct.unpack_from('<Q', d, 32)[0], struct.unpack_from('<HH', d, 54)
    else: phoff, (phent, phnum) = struct.unpack_from('<I', d, 28)[0], struct.unpack_from('<HH', d, 42)
    alin = [struct.unpack_from('<Q', d, o + 48)[0] if clase == 2 else struct.unpack_from('<I', d, o + 28)[0]
            for o in (phoff + i * phent for i in range(phnum)) if struct.unpack_from('<I', d, o)[0] == 1]
    if clase == 2 and alin and min(alin) < 16384:
        print('AVISO: %s: segmentos alineados a %d bytes: no carga en teléfonos con páginas de 16 KB' % (k, min(alin)))


LAMBDA = """package java.lang.invoke;
public final class LambdaMetafactory {
    public static final int FLAG_SERIALIZABLE = 1, FLAG_MARKERS = 2, FLAG_BRIDGES = 4;
    public static CallSite metafactory(MethodHandles.Lookup l, String n, MethodType t, MethodType s, MethodHandle m, MethodType i) { throw new UnsupportedOperationException(); }
    public static CallSite altMetafactory(MethodHandles.Lookup l, String n, MethodType t, Object... a) { throw new UnsupportedOperationException(); }
}
"""


def stubs_lambda(tmp, android):
    """javac necesita LambdaMetafactory para compilar lambdas y android.jar no lo trae (Gradle usa core-lambda-stubs.jar):
    se compila uno de mentira sólo para compilar. d8 convierte las lambdas igual y este nunca va al dex."""
    d = os.path.join(tmp, 'lambda')
    os.makedirs(os.path.join(d, 'src'))
    f = os.path.join(d, 'src', 'LambdaMetafactory.java')
    with open(f, 'w') as o: o.write(LAMBDA)
    correr(['javac', '-source', '8', '-target', '8', '-Xlint:-options', '-nowarn', '-bootclasspath', android, '-d', os.path.join(d, 'clases'), f],
           'javac (stub de lambdas)')
    return os.path.join(d, 'clases')


def leer_dex(b):
    """(cantidad de métodos referenciados, clases definidas) de un classes.dex."""
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


def firma():
    """Almacén y clave de la firma, fuera del repo. Devuelve (almacén, clave para apksigner: 'env:...' o 'file:...')."""
    d = os.environ.get('JXMOD_FIRMA_DIR', '/root/.jxmod/firma')
    ks, archivo = os.path.join(d, 'jxmod.jks'), os.path.join(d, 'clave.txt')
    en_entorno = bool(os.environ.get('JXMOD_FIRMA_CLAVE'))
    # (la firma guardada como secreto del entorno: JXMOD_FIRMA_JKS_B64 = el almacén en base64; así cada sesión nueva firma
    # con la misma y las versiones nuevas se instalan encima de las viejas)
    b64 = os.environ.get('JXMOD_FIRMA_JKS_B64', '').strip()
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
        pw = ['-storepass:env', 'JXMOD_FIRMA_CLAVE', '-keypass:env', 'JXMOD_FIRMA_CLAVE'] if en_entorno else \
             ['-storepass:file', archivo, '-keypass:file', archivo]
        correr(['keytool', '-genkeypair', '-keystore', ks, '-storetype', 'PKCS12', '-alias', 'jxmod', '-keyalg', 'RSA',
                '-keysize', '2048', '-validity', '10000', '-dname', 'CN=JXMod, O=JXStudios'] + pw, 'keytool')
        os.chmod(ks, 0o600)
        print('firma nueva:', ks, '(guardar una copia: sin ella las versiones nuevas no se instalan encima)')
    if en_entorno: return ks, 'env:JXMOD_FIRMA_CLAVE'
    if not os.path.isfile(archivo): fallar('está', ks, 'pero no la clave: poner JXMOD_FIRMA_CLAVE o', archivo)
    return ks, 'file:' + archivo


def activos_con_mapas(tmp, dir_mapas, origen=None):
    """apk/assets más el paquete de mapas (gm_mapas.*: gm_flatgrass y gm_construct con su contenido) en assets/mapas/,
    con mapas/lista.txt ("nombre tamaño"), para que el juego arranque sin red. Se arma en la carpeta temporal."""
    dest = os.path.join(tmp, 'assets')
    origen = origen or os.path.join(AQUI, 'assets')
    if os.path.isdir(origen): shutil.copytree(origen, dest)
    idx = sorted(glob.glob(os.path.join(dir_mapas, 'gm_mapas.*.idx'))) if dir_mapas else []
    if not idx and not dir_mapas: return dest if os.path.isdir(dest) else None
    if not idx:
        print('aviso: no está el paquete de mapas en', dir_mapas, '(el juego lo bajará de la red)')
        return dest if os.path.isdir(dest) else None
    pre = idx[-1][:-4]
    nombres = [os.path.basename(idx[-1])] + sorted(os.path.basename(f) for f in glob.glob(pre + '.*.bin'))
    os.makedirs(os.path.join(dest, 'mapas'), exist_ok=True)
    with open(os.path.join(dest, 'mapas', 'lista.txt'), 'w', encoding='utf-8') as l:
        for n in nombres:
            shutil.copyfile(os.path.join(dir_mapas, n), os.path.join(dest, 'mapas', n))
            l.write('%s %d\n' % (n, os.path.getsize(os.path.join(dir_mapas, n))))
    print('mapas en el APK:', ', '.join(nombres))
    return dest


def main():
    ap = argparse.ArgumentParser(description='Arma el APK de JXMod')
    ap.add_argument('salida', nargs='?', default='/home/user/Ports/jxmod/JXMod.apk')
    ap.add_argument('--version-name', default='1.0')
    ap.add_argument('--version-code', type=int, default=int(datetime.datetime.now(datetime.timezone.utc).strftime('%y%m%d%H')))
    ap.add_argument('--src', action='append', help='carpeta de fuentes Java (se puede repetir; por defecto apk/web/src y apk/unido/src)')
    ap.add_argument('--libs', default='', help='carpeta de jars, aars y jni/<abi>/*.so (por defecto ninguna)')
    ap.add_argument('--conservar', action='store_true', help='no borrar la carpeta temporal')
    ap.add_argument('--nativas-comprimidas', action='store_true', help='las .so comprimidas (el manifiesto tiene que decir extractNativeLibs="true")')
    ap.add_argument('--manifiesto', default=os.path.join(AQUI, 'unido', 'AndroidManifest.xml'), help='AndroidManifest.xml a usar')
    ap.add_argument('--activos', default=None, help='carpeta de assets (por defecto apk/assets)')
    ap.add_argument('--mapas', default=os.environ.get('JXMOD_MAPAS', ''),
                    help='carpeta con gm_mapas.*.idx/.bin para assets/mapas/ (los usaba el motor en Java; por defecto ninguna)')
    a = ap.parse_args()
    h = herramientas()
    srcs = a.src or [os.path.join(AQUI, 'web', 'src'), os.path.join(AQUI, 'unido', 'src')]
    tmp = tempfile.mkdtemp(prefix='jxmod_apk_')
    try:
        jars, nativas = bibliotecas(tmp, a.libs)
        # 1) javac (Java 8, contra android.jar)
        fuentes = sorted(os.path.join(r, f) for s in srcs for r, _, fs in os.walk(s) for f in fs if f.endswith('.java'))
        if not fuentes: fallar('no hay fuentes Java en', srcs)
        clases = os.path.join(tmp, 'clases')
        os.makedirs(clases)
        lista = os.path.join(tmp, 'fuentes.txt')
        with open(lista, 'w', encoding='utf-8') as f: f.write('\n'.join('"%s"' % p.replace('\\', '/') for p in fuentes))
        boot = stubs_lambda(tmp, h['android'])
        cmd = ['javac', '-source', '8', '-target', '8', '-encoding', 'UTF-8', '-g:source,lines', '-Xlint:-options', '-nowarn',
               '-bootclasspath', boot + os.pathsep + h['android'], '-d', clases]
        if jars: cmd += ['-cp', os.pathsep.join(jars)]
        correr(cmd + ['@' + lista], 'javac')
        cjar = os.path.join(tmp, 'clases.jar')
        with zipfile.ZipFile(cjar, 'w', zipfile.ZIP_STORED) as z:
            for r, _, fs in os.walk(clases):
                for f in fs: z.write(os.path.join(r, f), os.path.relpath(os.path.join(r, f), clases))
        # 2) d8 (multidex nativo si hace falta: minSdk 24)
        dexdir = os.path.join(tmp, 'dex')
        os.makedirs(dexdir)
        avisos_d8 = correr(['java', '-cp', h['d8'], 'com.android.tools.r8.D8', '--release', '--min-api', MIN_SDK, '--lib', h['android'],
                            '--output', dexdir, cjar] + jars, 'd8').strip()
        avisos_d8 = [x for x in avisos_d8.splitlines() if re.match(r'\s*(Warning|Error)', x)]   # los "Info" de luaj no importan
        if avisos_d8: print('d8:', '\n'.join(avisos_d8[:12]))
        dexes = sorted(glob.glob(os.path.join(dexdir, 'classes*.dex')))
        if not dexes: fallar('d8 no generó classes.dex')
        metodos, definidas = 0, set()
        for dx in dexes:
            with open(dx, 'rb') as f: m, c = leer_dex(f.read())
            metodos += m
            definidas |= c
        # (la actividad que abre la app: la del manifiesto que se use)
        import re as _re
        _m = _re.search(r'<activity[^>]*android:name="([^"]+)"', open(a.manifiesto, encoding='utf-8').read())
        global PRINCIPAL
        if _m: PRINCIPAL = (PAQUETE + _m.group(1)) if _m.group(1).startswith('.') else _m.group(1)
        if 'L%s;' % PRINCIPAL.replace('.', '/') not in definidas: fallar(PRINCIPAL, 'no está en el dex')
        # 3) aapt2: recursos y manifiesto
        rz = os.path.join(tmp, 'res.zip')
        correr([h['aapt2'], 'compile', '--dir', os.path.join(AQUI, 'res'), '-o', rz], 'aapt2 compile')
        base = os.path.join(tmp, 'base.apk')
        cmd = [h['aapt2'], 'link', '-o', base, '--manifest', a.manifiesto, '-I', h['android'],
               '--min-sdk-version', MIN_SDK, '--target-sdk-version', TARGET_SDK, '--version-code', a.version_code,
               '--version-name', a.version_name]
        activos = activos_con_mapas(tmp, a.mapas, a.activos)
        if activos: cmd += ['-A', activos]
        for e in NO_COMPRIMIR: cmd += ['-0', e]
        avisos = correr(cmd + [rz], 'aapt2 link').strip()
        if avisos: print('aapt2:', avisos)
        # 4) dex y .so adentro (las .so sin comprimir: zipalign las alinea a 16 KB)
        for k, (d, _) in nativas.items(): revisar_elf(k, d)
        crudo = os.path.join(tmp, 'crudo.apk')
        with zipfile.ZipFile(base) as zin, zipfile.ZipFile(crudo, 'w') as zout:
            for zi in zin.infolist(): zout.writestr(zi, zin.read(zi.filename))
            for dx in dexes: zout.write(dx, os.path.basename(dx), compress_type=zipfile.ZIP_DEFLATED)
            for k in sorted(nativas):
                zi = zipfile.ZipInfo(k, date_time=(2008, 1, 1, 0, 0, 0))
                # (--nativas-comprimidas: van comprimidas y Android las saca al instalar —el manifiesto dice
                # extractNativeLibs="true"—; para el V8 del motor jxr, que sin comprimir pesa 107 MB)
                zi.compress_type, zi.external_attr = zipfile.ZIP_DEFLATED if a.nativas_comprimidas else zipfile.ZIP_STORED, 0o644 << 16
                zout.writestr(zi, nativas[k][0])
        # 5) zipalign: 4 bytes y .so a páginas de 16 KB (sirve también para 4 KB)
        alineado = os.path.join(tmp, 'alineado.apk')
        correr([h['zipalign'], '-P', '16', '-f', '4', crudo, alineado], 'zipalign', h['entorno'])
        correr([h['zipalign'], '-c', '-P', '16', '4', alineado], 'zipalign -c', h['entorno'])
        # 6) firma v1 + v2 + v3 (sin --key-pass: apksigner usa la del almacén; con el mismo file: leería otra línea)
        ks, clave = firma()
        final = os.path.join(tmp, 'JXMod.apk')
        correr(['java', '-jar', h['apksigner'], 'sign', '--ks', ks, '--ks-key-alias', 'jxmod', '--ks-pass', clave, '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true',
                '--v3-signing-enabled', 'true', '--v4-signing-enabled', 'false', '--min-sdk-version', MIN_SDK,
                '--out', final, alineado], 'apksigner sign')
        # 7) revisiones
        # --min-sdk-version 23: así también revisa v1 (con minSdk 24 sólo mira v2/v3)
        v = correr(['java', '-jar', h['apksigner'], 'verify', '--print-certs', '--verbose', '--min-sdk-version', '23', final], 'apksigner verify')
        for esq in ('v1 scheme (JAR signing)', 'v2 scheme (APK Signature Scheme v2)', 'v3 scheme (APK Signature Scheme v3)'):
            if 'Verified using %s: true' % esq not in v: fallar('firma', esq, 'no verificada:\n' + v)
        cert = re.search(r'Signer #1 certificate DN: (.*)', v)
        sha = re.search(r'Signer #1 certificate SHA-256 digest: (\w+)', v)
        b = correr([h['aapt2'], 'dump', 'badging', final], 'aapt2 dump badging')
        esperado = ["package: name='%s' versionCode='%d' versionName='%s'" % (PAQUETE, a.version_code, a.version_name),
                    "targetSdkVersion:'%d'" % TARGET_SDK, "application-label:'JXMod'",
                    "launchable-activity: name='%s'" % PRINCIPAL]
        for e in esperado:
            if e not in b: fallar('badging: falta', repr(e), '\n' + b)
        if not re.search(r"^(?:min)?[sS]dkVersion:'%d'$" % MIN_SDK, b, re.M): fallar('badging: minSdk no es', MIN_SDK, '\n' + b)
        abis = sorted({k.split('/')[1] for k in nativas})
        nc = re.search(r"native-code: (.*)", b)
        if abis and (not nc or sorted(re.findall(r"'([^']+)'", nc.group(1))) != abis): fallar('badging: native-code', nc and nc.group(0), '≠', abis)
        if not abis and nc: fallar('badging: native-code inesperado', nc.group(0))
        os.makedirs(os.path.dirname(os.path.abspath(a.salida)), exist_ok=True)
        shutil.copyfile(final, a.salida)
        permisos = re.findall(r"uses-permission: name='([^']+)'", b)
        print('APK:', os.path.abspath(a.salida))
        print('  %.2f MB  |  versionCode %d  versionName %s  |  minSdk %d targetSdk %d'
              % (os.path.getsize(a.salida) / 1048576, a.version_code, a.version_name, MIN_SDK, TARGET_SDK))
        print('  dex: %d archivo(s), %d métodos referenciados, %d clases  |  fuentes: %d .java, %d jar(s)'
              % (len(dexes), metodos, len(definidas), len(fuentes), len(jars)))
        print('  nativas: %s' % (', '.join('%s (%d)' % (x, sum(1 for k in nativas if k.split('/')[1] == x)) for x in abis) or 'ninguna'))
        print('  permisos: %s' % ', '.join(p.rsplit('.', 1)[-1] for p in permisos))
        print('  firma v1+v2+v3 ok: %s  SHA-256 %s' % (cert and cert.group(1), sha and sha.group(1)[:16] + '…'))
    finally:
        if a.conservar: print('temporales en', tmp)
        else: shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
