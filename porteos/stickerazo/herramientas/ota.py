# Las actualizaciones solas de Stickerazo (como en JXMod): arma web/ota.json con la versión, el versionCode mínimo del
# APK y la huella (sha256) de cada archivo de web/ (menos terceros/: MediaPipe y los modelos vienen en el APK), firmado
# con ECDSA P-256; si hay descargas/app.json, también la versión y la huella del APK de la página. La app lo baja de
# nuestro servidor (/sz/web/, que lo trae de GitHub) o de GitHub, revisa la firma con la llave pública que trae adentro y baja sólo lo que
# cambió. Publicar una versión nueva de la página = correr esto y subir web/ (commit y push).
# Llave privada FUERA del repo: $STICKERAZO_FIRMA_DIR/ota.pem (por defecto /root/.stickerazo/firma); si no está y está
# $STICKERAZO_OTA_PEM_B64 (secreto del entorno), se escribe de ahí; si no, se crea una nueva. Nunca se muestra.
# uso: python3 -I herramientas/ota.py [--apk-min N]
import argparse, base64, datetime, hashlib, json, os, sys
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(RAIZ, 'web')
FUERA = {'terceros'}


def llave():
    d = os.environ.get('STICKERAZO_FIRMA_DIR', '/root/.stickerazo/firma'); f = os.path.join(d, 'ota.pem')
    if not os.path.isfile(f):
        os.makedirs(d, mode=0o700, exist_ok=True)
        b64 = os.environ.get('STICKERAZO_OTA_PEM_B64', '').strip()
        datos = base64.b64decode(b64) if b64 else ec.generate_private_key(ec.SECP256R1()).private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
        fd = os.open(f, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as o: o.write(datos)
        if not b64: print('llave nueva de las actualizaciones:', f, '(guardar una copia: sin ella los celulares no aceptan versiones nuevas)')
    with open(f, 'rb') as i: return serialization.load_pem_private_key(i.read(), password=None)


def publica_b64(k=None):
    k = k or llave()
    return base64.b64encode(k.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)).decode()


def archivos(web=WEB):
    """{ruta: {h, n}} de la página (sin terceros/, sin lo de prueba ni ota.json)"""
    r = {}
    for raiz, dirs, fs in os.walk(web):
        dirs[:] = sorted(x for x in dirs if not (os.path.relpath(os.path.join(raiz, x), web).split(os.sep)[0] in FUERA or x.startswith('.') or x.startswith('_')))
        for f in sorted(fs):
            if f.startswith('_') or f.startswith('.') or f == 'ota.json': continue
            p = os.path.join(raiz, f)
            with open(p, 'rb') as i: d = i.read()
            r[os.path.relpath(p, web).replace(os.sep, '/')] = {'h': hashlib.sha256(d).hexdigest(), 'n': len(d)}
    return r


def generar(apk_min=0, web=WEB):
    """escribe web/ota.json firmado y devuelve los datos"""
    k = llave()
    datos = {'v': int(datetime.datetime.now(datetime.timezone.utc).strftime('%y%m%d%H%M')), 'apkMin': apk_min, 'archivos': archivos(web)}
    # (el APK que se baja de nuestra página: versión y huella firmadas, así la app sabe que hay uno nuevo y lo revisa antes de instalarlo)
    apk = os.path.join(os.path.dirname(os.path.abspath(web)), 'descargas', 'app.json')
    if os.path.isfile(apk):
        with open(apk, encoding='utf-8') as i: a = json.load(i)
        datos['apk'] = {k: a[k] for k in ('v', 'nombre', 'h', 'n') if k in a}
    viejo = os.path.join(web, 'ota.json')
    if os.path.isfile(viejo):
        try:
            ant = json.loads(json.load(open(viejo, encoding='utf-8'))['datos'])
            if ant.get('archivos') == datos['archivos'] and ant.get('apkMin') == apk_min and ant.get('apk') == datos.get('apk'): return ant   # (nada cambió: queda la misma versión)
            datos['v'] = max(datos['v'], ant.get('v', 0) + 1)
        except Exception: pass
    d = json.dumps(datos, separators=(',', ':'), ensure_ascii=False, sort_keys=True)
    firma = base64.b64encode(k.sign(d.encode('utf-8'), ec.ECDSA(hashes.SHA256()))).decode()
    with open(viejo, 'w', encoding='utf-8') as o: json.dump({'datos': d, 'firma': firma}, o, ensure_ascii=False)
    return datos


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Firma la versión de la página (web/ota.json)')
    ap.add_argument('--apk-min', type=int, default=0, help='versionCode mínimo del APK para esta versión (si cambió el puente con Java)')
    ap.add_argument('--web', default=WEB, help='(para las pruebas) otra carpeta')
    ap.add_argument('--publica', action='store_true', help='sólo mostrar la llave pública (base64; la que va en el APK)')
    a = ap.parse_args()
    if a.publica: print(publica_b64()); sys.exit(0)
    d = generar(a.apk_min, a.web)
    print('web/ota.json: versión %d, %d archivos, APK mínimo %d' % (d['v'], len(d['archivos']), d.get('apkMin', 0)))
