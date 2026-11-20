#!/usr/bin/env python3
# Los eventos en vivo (juego/vivo.js): el juego baja cada pocos minutos web/vivo/vivo.json y, si cambió, el guion del
# evento (JavaScript) que dice; lo ejecuta sin actualizar la app ni recargar. Cada guion va FIRMADO (ECDSA P-256 sobre
# «JXVIVO1\n<v>\n<hasta>\n<sha256 del guion>»): el juego trae la llave pública (VIVO_PUB en vivo.js) y no corre nada que
# no esté firmado con la privada. La privada no se guarda en ningún lado: sale del secreto de la firma del APK
# (cifrar_apk.secreto_ota, que vive fuera del repo), así dura lo mismo que la firma. Nunca se muestra.
#
# uso:
#   python3 -I herramientas/vivo.py clave                         la llave pública (para VIVO_PUB)
#   python3 -I herramientas/vivo.py publicar guion.js [--hasta 2026-12-01T03:00] [--dir web/vivo]
#   python3 -I herramientas/vivo.py apagar [--dir web/vivo]        sin evento (el que estaba se termina)
#   python3 -I herramientas/vivo.py ver [--dir web/vivo]           comprueba la firma de lo publicado
# (después de publicar o apagar: commit y push; los juegos lo toman en ≤ 5 min, lo que tarda el caché de GitHub)
import argparse, base64, datetime, hashlib, hmac, importlib.util, json, os, sys, time
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils

N_P256 = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551


def privada():
    import cifrar_apk
    sp = importlib.util.spec_from_file_location('ota', os.path.join(AQUI, 'ota.py')); ota = importlib.util.module_from_spec(sp); sp.loader.exec_module(ota)
    _, ks, clave = ota.huella_firma()
    s = cifrar_apk.secreto_ota(ks, clave)
    d = int.from_bytes(hmac.new(s, b'JXVIVO1 ecdsa p-256', hashlib.sha256).digest(), 'big') % (N_P256 - 1) + 1
    return ec.derive_private_key(d, ec.SECP256R1())


def publica_b64(k):
    return base64.b64encode(k.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)).decode()


def mensaje(v, hasta, h):
    return ('JXVIVO1\n%d\n%d\n%s' % (v, hasta, h)).encode()


def firmar(k, v, hasta, h):
    r, s = utils.decode_dss_signature(k.sign(mensaje(v, hasta, h), ec.ECDSA(hashes.SHA256())))
    return base64.b64encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big')).decode()   # (r‖s: lo que pide WebCrypto)


def escribir(dirv, guion, hasta):
    os.makedirs(dirv, exist_ok=True)
    k = privada(); v = int(time.time())
    try: v = max(v, json.load(open(os.path.join(dirv, 'vivo.json'), encoding='utf-8')).get('v', 0) + 1)   # (siempre para adelante)
    except Exception: pass
    txt = guion.encode('utf-8'); h = hashlib.sha256(txt).hexdigest()
    m = {'v': v, 'hasta': hasta, 'h': h, 'firma': firmar(k, v, hasta, h)}
    viejos = [f for f in os.listdir(dirv) if f.startswith('ev.') and f.endswith('.js')]
    if guion.strip():
        m['js'] = 'ev.%d.%s.js' % (v, h[:12])
        with open(os.path.join(dirv, m['js']), 'wb') as f: f.write(txt)
    for f in viejos:
        if f != m.get('js'): os.remove(os.path.join(dirv, f))
    with open(os.path.join(dirv, 'vivo.json'), 'w', encoding='utf-8') as f: json.dump(m, f, indent=1)
    return m


def ver(dirv):
    m = json.load(open(os.path.join(dirv, 'vivo.json'), encoding='utf-8'))
    txt = open(os.path.join(dirv, m['js']), 'rb').read() if m.get('js') else b''
    h = hashlib.sha256(txt).hexdigest()
    pub = privada().public_key(); f = base64.b64decode(m['firma'])
    try:
        pub.verify(utils.encode_dss_signature(int.from_bytes(f[:32], 'big'), int.from_bytes(f[32:], 'big')), mensaje(m['v'], m['hasta'], m['h']), ec.ECDSA(hashes.SHA256())); ok = h == m['h']
    except Exception: ok = False
    return m, ok


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('que', choices=['clave', 'publicar', 'apagar', 'ver']); ap.add_argument('guion', nargs='?')
    ap.add_argument('--hasta', default=''); ap.add_argument('--dir', default=os.path.join(os.path.dirname(os.path.dirname(RAIZ)), 'web', 'vivo'))
    a = ap.parse_args()
    if a.que == 'clave': print(publica_b64(privada())); return
    if a.que == 'ver':
        m, ok = ver(a.dir); print('v', m['v'], '· guion', m.get('js', '(ninguno)'), '· hasta', m['hasta'] or '-', '· firma', 'bien' if ok else 'MAL'); sys.exit(0 if ok else 1)
    hasta = 0
    if a.hasta:   # (sin zona: la hora de Argentina)
        d = datetime.datetime.fromisoformat(a.hasta)
        if d.tzinfo is None: d = d.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))
        hasta = int(d.timestamp() * 1000)
    guion = '' if a.que == 'apagar' else open(a.guion, encoding='utf-8').read()
    m = escribir(a.dir, guion, hasta)
    print('vivo v%d · %s · hasta %s · en %s' % (m['v'], m.get('js', 'sin evento'), hasta or '-', a.dir))


if __name__ == '__main__':
    main()
