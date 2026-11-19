# Cifrado de los activos del APK (anti-robo de código y anti-repaquetado). Lo usa apk/armar_apk.py.
#
# Qué hace: index.html (con el juego en gzip adentro) y pk.bin (modelos, texturas, sonidos) no viajan en claro dentro del
# APK: van cifrados con AES-256-CTR. Un `unzip` del APK saca sólo basura. La llave NO es una cadena en el .dex: sale de
#   key = SHA-256( ETIQUETA || SHA-256(certificado de firma) || SECRETO )
# donde:
#   - SHA-256(certificado de firma): la huella de la firma del APK. Si alguien modifica el APK y lo vuelve a firmar (otro
#     certificado), la huella cambia, la llave cambia y los activos ya no se descifran: el juego no abre. Anti-repaquetado.
#   - SECRETO: 32 bytes al azar por armado, partidos y enmascarados en Llave.java (compilado al .dex): no aparece con
#     `strings` ni de un vistazo.
# Para abrirlo de verdad hay que sacar a la vez el certificado (va en el APK) y el SECRETO del .dex, y aun así sólo se
# descifra la copia original: una copia modificada no abre. No es magia —con mucho trabajo un experto podría— pero sube la
# vara muchísimo contra copiar el código o meter trampas.
#
# El mismo cálculo está en apk/web/src/com/jxmod/app/Cifrado.java (runtime) y en apk/pruebas/unido/PruebaCifrado.java.
import hashlib, os, secrets
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIA = b'JXENC1\x00\x00'          # 8 bytes: marca de archivo cifrado (lo de más va: iv de 16 + cifrado)
ETIQUETA = b'JXMOD-ANDROID-WWW-v1'  # separa esta llave de cualquier otro uso del certificado
# los archivos del APK que se cifran (están dentro de assets/www/; además, los fondos animados de fondos/: cifrar_www)
CIFRAR = ('index.html', 'pk.bin')


def huella_cert(der):
    """SHA-256 del certificado en DER: la misma huella que Android saca de la firma (Signature.toByteArray())."""
    return hashlib.sha256(der).digest()


def clave_aes(cert_sha, secreto):
    """La llave AES-256 del APK: SHA-256(ETIQUETA || huella de la firma || secreto)."""
    return hashlib.sha256(ETIQUETA + cert_sha + secreto).digest()


def cifrar_bytes(datos, key):
    iv = secrets.token_bytes(16)
    c = Cipher(algorithms.AES(key), modes.CTR(iv)).encryptor()
    return MAGIA + iv + c.update(datos) + c.finalize()


def descifrar_bytes(blob, key):
    """(para las pruebas) el inverso de cifrar_bytes."""
    assert blob[:8] == MAGIA, 'no es un activo cifrado'
    iv = blob[8:24]
    c = Cipher(algorithms.AES(key), modes.CTR(iv)).decryptor()
    return c.update(blob[24:]) + c.finalize()


def cifrar_archivo(ruta, key):
    """Cifra el archivo en su lugar, con un archivo nuevo (no toca el inodo original, por si está enlazado)."""
    with open(ruta, 'rb') as f: datos = f.read()
    if datos[:8] == MAGIA: return len(datos)   # ya cifrado (no cifrar dos veces)
    blob = cifrar_bytes(datos, key)
    tmp = ruta + '.cif'
    with open(tmp, 'wb') as f: f.write(blob)
    os.replace(tmp, ruta)
    return len(blob)


def cifrar_www(dir_www, key):
    """Cifra los activos elegidos dentro de assets/www. Devuelve la lista de (nombre, bytes)."""
    hechos = []
    for n in CIFRAR:
        r = os.path.join(dir_www, n)
        if os.path.isfile(r): hechos.append((n, cifrar_archivo(r, key)))
    # los fondos animados del menú (fondos/*.mp4, de armar.py): también van cifrados; Web.java los descifra al servirlos
    # (Cifrado.abrir mira la marca) y por LAN da su largo (el del asset menos los 24 bytes de la cabecera)
    fd = os.path.join(dir_www, 'fondos')
    if os.path.isdir(fd):
        for f in sorted(os.listdir(fd)):
            if f.endswith('.mp4'): hechos.append(('fondos/' + f, cifrar_archivo(os.path.join(fd, f), key)))
    return hechos


# ---- las actualizaciones por partes (herramientas/ota.py, Ota.java) ----
# Las actualizaciones bajan sólo los archivos que cambiaron (index.html con el juego, pk.bin, los fondos) y la app los sirve
# antes que los suyos. Van cifrados con otra llave, la de las actualizaciones, que tiene que ser la MISMA en todos los APK
# (el de hoy tiene que poder abrir lo que se publique mañana): sale de la firma + un secreto FIJO que vive fuera del repo,
# sale de la firma (su almacén y su clave): dura lo mismo que ella. Si se perdiera la firma, igual habría que reinstalar. Cada archivo lleva además su HMAC-SHA256: la app
# no instala nada que no venga de quien tiene el secreto (nadie puede colar una actualización trucha).
ETIQUETA_OTA = b'JXMOD-ANDROID-OTA-v1'
ETIQUETA_MAC = b'JXMOD-ANDROID-OTA-MAC-v1'
BASE_OTA = 'ota_base.json'   # en assets/www: las huellas de lo que trae el APK, para bajar sólo lo que cambió


def secreto_ota(ks=None, clave=None):
    """El secreto fijo de las actualizaciones (32 bytes): sale del almacén de la firma y de su clave, que ya se guardan
    (fuera del repo, y como secretos del entorno: JXMOD_FIRMA_JKS_B64 y JXMOD_FIRMA_CLAVE), así dura lo mismo que la firma
    sin otro archivo que cuidar. `clave` es lo que da armar_apk.firma(): 'env:VARIABLE' o 'file:ruta'. Nunca se muestra.
    (JXMOD_OTA_SECRETO, en hexa, lo reemplaza: para las pruebas)"""
    h = os.environ.get('JXMOD_OTA_SECRETO', '').strip()
    if h: return bytes.fromhex(h)
    if not ks or not clave: raise SystemExit('secreto de las actualizaciones: falta la firma')
    pw = os.environ.get(clave[4:], '') if clave.startswith('env:') else open(clave[5:], encoding='utf-8').read().strip()
    with open(ks, 'rb') as f: alm = f.read()
    return hashlib.sha256(b'JXMOD-OTA-SECRETO-v1' + pw.encode('utf-8') + hashlib.sha256(alm).digest()).digest()


def clave_ota(cert_sha, s):
    return hashlib.sha256(ETIQUETA_OTA + cert_sha + s).digest()


def clave_mac(cert_sha, s):
    return hashlib.sha256(ETIQUETA_MAC + cert_sha + s).digest()


def archivos_www(dir_www):
    """Los archivos del juego que trae el APK y que una actualización puede cambiar (rutas relativas, ordenadas)."""
    L = [n for n in CIFRAR if os.path.isfile(os.path.join(dir_www, n))]
    fd = os.path.join(dir_www, 'fondos')
    if os.path.isdir(fd): L += ['fondos/' + f for f in sorted(os.listdir(fd)) if f.endswith('.mp4')]
    return L


def huellas_www(dir_www):
    """SHA-256 de cada archivo, en claro (antes de cifrar): lo que se compara para saber qué cambió."""
    out = {}
    for n in archivos_www(dir_www):
        with open(os.path.join(dir_www, n), 'rb') as f: out[n] = hashlib.sha256(f.read()).hexdigest()
    return out


# ---- el secreto, partido y enmascarado en Llave.java (que se compila al .dex) ----
def _java_bytes(b):
    return '{' + ','.join(str(x if x < 128 else x - 256) for x in b) + '}'


def generar_llave_java(paquete, secreto, cert_sha, secreto_ota=None):
    """El texto de Llave.java: rearma el secreto de a pedazos enmascarados, y guarda la huella de firma esperada (para
    avisar «copia no oficial» con cara linda en vez de una pantalla en blanco). No es inviolable: es para que no salte a
    la vista ni con `strings`."""
    import secrets as _s
    partes = [secreto[i:i + 8] for i in range(0, 32, 8)]
    mascaras = [_s.token_bytes(8) for _ in partes]
    enmasc = [bytes(a ^ b for a, b in zip(p, m)) for p, m in zip(partes, mascaras)]
    cuerpo = []
    for i in range(4):
        cuerpo.append('    private static final byte[] P%d = %s;' % (i, _java_bytes(enmasc[i])))
        cuerpo.append('    private static final byte[] M%d = %s;' % (i, _java_bytes(mascaras[i])))
    so = secreto_ota if secreto_ota is not None else bytes(32)
    mo = [_s.token_bytes(8) for _ in range(4)]
    for i in range(4):
        cuerpo.append('    private static final byte[] Q%d = %s;' % (i, _java_bytes(bytes(a ^ b for a, b in zip(so[i * 8:i * 8 + 8], mo[i])))))
        cuerpo.append('    private static final byte[] N%d = %s;' % (i, _java_bytes(mo[i])))
    arma = '\n'.join(cuerpo)
    return '''package %s;
// Generado por herramientas/cifrar_apk.py en cada armado — NO editar a mano (cambia en cada build).
// El secreto de 32 bytes va partido en cuatro y enmascarado: se rearma en memoria sólo cuando hace falta descifrar.
final class Llave {
%s
    // la huella SHA-256 del certificado con el que se armó (la firma oficial): si al abrir la app la firma no es ésta,
    // la copia es trucha y la llave va a dar mal igual (acá sólo sirve para avisar con cara linda)
    static final byte[] FIRMA = %s;
    static byte[] secreto() {
        byte[] s = new byte[32];
        byte[][] p = {P0, P1, P2, P3}, m = {M0, M1, M2, M3};
        for (int i = 0; i < 4; i++) for (int j = 0; j < 8; j++) s[i * 8 + j] = (byte) (p[i][j] ^ m[i][j]);
        return s;
    }
    // el secreto FIJO de las actualizaciones por partes (el mismo en todos los APK: Ota.java)
    static byte[] secretoOta() {
        byte[] s = new byte[32];
        byte[][] p = {Q0, Q1, Q2, Q3}, m = {N0, N1, N2, N3};
        for (int i = 0; i < 4; i++) for (int j = 0; j < 8; j++) s[i * 8 + j] = (byte) (p[i][j] ^ m[i][j]);
        return s;
    }
    private Llave() {}
}
''' % (paquete, arma, _java_bytes(cert_sha))


def nuevo_secreto():
    return secrets.token_bytes(32)
