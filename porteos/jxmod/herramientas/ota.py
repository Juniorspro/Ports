# Las actualizaciones por partes de la app (Android): en vez de bajar el APK entero (32 MB) e instalarlo encima, la app baja
# sólo los archivos del juego que cambiaron, los guarda y los sirve antes que los suyos (Ota.java, Web.java). Pedido del
# dueño: «que las actualizaciones sean megas, no todo el juego, y se instalen automáticamente: tocás descargar y el juego se
# pone en modo actualizando, sin instalar nada encima ni descargar el juego de nuevo».
#
# Toma la carpeta del juego tal como va adentro del APK (armar.py con PK_BIN=1: index.html, pk.bin y fondos/*.mp4, en
# claro) y escribe en SALIDA (web/ota del repo):
#   - cada archivo cifrado con la llave de las actualizaciones (sale de la firma: cifrar_apk.secreto_ota) y con su
#     HMAC-SHA256, con el nombre <archivo>.<huella>.jxo (la huella del contenido en claro: si no cambió, el mismo nombre);
#   - ota.json: el código de la versión, el APK mínimo que la puede tomar (las partes en Java —Web.java y compañía— no se
#     pueden cambiar así: si cambian, hace falta el APK) y, por archivo, su huella, su tamaño, dónde está y su HMAC.
# La app compara las huellas con las de lo que ya tiene (ota_base.json del APK y lo que ya se instaló) y baja sólo lo
# distinto: si cambió sólo el código del juego, ~4,6 MB.
# Uso: python3 -I herramientas/ota.py WWW SALIDA --codigo 3903 --version 3.9.3 --apk-min 3903
import argparse, hashlib, hmac, json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cifrar_apk
AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AQUI, 'apk'))


def huella_firma():
    """La huella SHA-256 del certificado de la firma oficial (la que ve Android), con las mismas funciones del armado."""
    import importlib.util
    sp = importlib.util.spec_from_file_location('armar_apk', os.path.join(AQUI, 'apk', 'armar_apk.py'))
    m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
    ks, clave = m.firma()
    with tempfile.TemporaryDirectory() as t: return cifrar_apk.huella_cert(m.cert_der(ks, clave, t)), ks, clave


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('www'); ap.add_argument('salida')
    ap.add_argument('--codigo', type=int, required=True); ap.add_argument('--version', required=True)
    ap.add_argument('--apk-min', type=int, required=True)
    a = ap.parse_args()
    cert, ks, clave = huella_firma(); s = cifrar_apk.secreto_ota(ks, clave)
    kc, km = cifrar_apk.clave_ota(cert, s), cifrar_apk.clave_mac(cert, s)
    os.makedirs(a.salida, exist_ok=True)
    archivos, usados = [], set()
    for n in cifrar_apk.archivos_www(a.www):
        with open(os.path.join(a.www, n), 'rb') as f: plano = f.read()
        if plano[:8] == cifrar_apk.MAGIA: raise SystemExit('ya está cifrado (hace falta la carpeta en claro): ' + n)
        h = hashlib.sha256(plano).hexdigest()
        nom = n.replace('/', '_') + '.' + h[:16] + '.jxo'; usados.add(nom)
        dst = os.path.join(a.salida, nom)
        if os.path.isfile(dst):
            with open(dst, 'rb') as f: blob = f.read()   # (el mismo contenido de antes: no se vuelve a cifrar ni cambia en el repo)
        else:
            blob = cifrar_apk.cifrar_bytes(plano, kc)
            with open(dst + '.tmp', 'wb') as f: f.write(blob)
            os.replace(dst + '.tmp', dst)
        archivos.append({'n': n, 'h': h, 't': len(blob), 'u': 'ota/' + nom, 'mac': hmac.new(km, blob, hashlib.sha256).hexdigest()})
    # (lo de versiones anteriores ya no lo pide nadie: la app siempre va a la última)
    for f in os.listdir(a.salida):
        if f.endswith('.jxo') and f not in usados: os.remove(os.path.join(a.salida, f))
    man = {'codigo': a.codigo, 'version': a.version, 'apkMin': a.apk_min, 'archivos': archivos}
    with open(os.path.join(a.salida, 'ota.json'), 'w', encoding='utf-8') as f: json.dump(man, f, ensure_ascii=False, indent=1)
    print('ota', a.version, a.codigo, '· APK mínimo', a.apk_min, '·', ', '.join('%s %.1f MB' % (x['n'], x['t'] / 1e6) for x in archivos))


if __name__ == '__main__':
    main()
