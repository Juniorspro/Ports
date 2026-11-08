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
# los archivos del APK que se cifran (están dentro de assets/www/)
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
    return hechos


# ---- el secreto, partido y enmascarado en Llave.java (que se compila al .dex) ----
def _java_bytes(b):
    return '{' + ','.join(str(x if x < 128 else x - 256) for x in b) + '}'


def generar_llave_java(paquete, secreto, cert_sha):
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
    private Llave() {}
}
''' % (paquete, arma, _java_bytes(cert_sha))


def nuevo_secreto():
    return secrets.token_bytes(32)
