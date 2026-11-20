#!/usr/bin/env python3
# El panel desde acá (Claude): leer lo que publica la gente en Bugs y sugerencias y lo que deja el dueño en la app admin,
# contestar, ponerles estado, ver quién juega y los errores, aprobar los celulares del dueño y dar órdenes a los juegos.
# Cada pedido va firmado con la llave de los eventos en vivo (la misma de vivo.py: sale del secreto de la firma del APK,
# nunca se muestra). Ver tienda/panel.js.
#
# uso: python3 -I herramientas/panel.py [--api URL] COSA ...
#   estado                                    quién juega ahora, hoy, versiones, errores, órdenes vigentes
#   posts [--tipo bug|sug|idea|nota] [--estado nuevo|visto|en_curso|hecho|no] [--ocultos]
#   bajar ID [--dir CARPETA]                   un post con sus imágenes y videos a una carpeta (para mirarlos)
#   responder ID [--texto T] [--estado E] [--ocultar | --mostrar]
#   borrar ID
#   errores · error-estado HASH hecho
#   admins · aprobar PUB --nombre N · baja PUB
#   orden aviso --titulo T --texto T [--dura 60]
#   orden cielo --titulo T --texto T [--img URL] [--video URL] [--dura 120]
#   orden cine --url URL [--en 30] [--dura 600]          (empieza en todos a la vez, a los N segundos; se baja antes)
#   orden ir --mapa M [--juntos] [--pos x,y,z] [--texto T] [--dura 1800]
#   orden guion --js ARCHIVO [--dura 3600]
#   orden quitar --uid UID
#   ordenes
import argparse, base64, hashlib, importlib.util, json, os, sys, time, urllib.request, uuid
AQUI = os.path.dirname(os.path.abspath(__file__))
API = 'https://rezobox-tienda.holasoyjuniors365.workers.dev/api/'
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils


def vivo():
    sp = importlib.util.spec_from_file_location('vivo', os.path.join(AQUI, 'vivo.py')); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m


_K = None
def llave():
    global _K
    if _K is None: _K = vivo().privada()
    return _K


def firmar(txt):
    r, s = utils.decode_dss_signature(llave().sign(txt.encode('utf-8'), ec.ECDSA(hashes.SHA256())))
    return base64.b64encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big')).decode()


def pedir(api, ruta, cuerpo=None, crudo=False):
    req = urllib.request.Request(api + ruta, data=None if cuerpo is None else json.dumps(cuerpo).encode(), headers={'Content-Type': 'application/json', 'User-Agent': 'jxmod-panel'}, method='GET' if cuerpo is None else 'POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as r: d = r.read()
    except urllib.error.HTTPError as e: d = e.read()
    return d if crudo else json.loads(d.decode('utf-8'))


def admin(api, op, **datos):
    q = json.dumps(dict(datos, op=op, t=int(time.time() * 1000)), ensure_ascii=False, separators=(',', ':'))
    return pedir(api, 'panel/admin', {'q': q, 'firma': firmar('JXPANEL1\n' + q)})


def orden(api, tipo, datos, dura):
    a = json.dumps({'uid': uuid.uuid4().hex[:12], 'tipo': tipo, 'datos': datos, 't': int(time.time() * 1000), 'hasta': int((time.time() + dura) * 1000)}, ensure_ascii=False, separators=(',', ':'))
    return admin(api, 'orden', a=a, f=firmar('JXORDEN1\n' + a)), json.loads(a)['uid']


def cert(pub, nombre):
    desde = int(time.time() * 1000)
    return {'pub': pub, 'nombre': nombre, 'desde': desde, 'firma': firmar('JXADMIN1\n%s\n%s\n%d' % (pub, nombre, desde))}


def ver(o): print(json.dumps(o, ensure_ascii=False, indent=1))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--api', default=API); ap.add_argument('cosa'); ap.add_argument('args', nargs='*')
    for k in ['tipo', 'estado', 'dir', 'texto', 'nombre', 'titulo', 'img', 'video', 'url', 'mapa', 'pos', 'js', 'uid']: ap.add_argument('--' + k)
    for k in ['ocultos', 'ocultar', 'mostrar', 'juntos']: ap.add_argument('--' + k, action='store_true')
    ap.add_argument('--dura', type=float); ap.add_argument('--en', type=float, default=0)
    a = ap.parse_args(); api = a.api if a.api.endswith('/') else a.api + '/'
    if a.cosa == 'estado': return ver(admin(api, 'estado'))
    if a.cosa == 'posts':
        d = admin(api, 'posts', tipo=a.tipo, estado=a.estado, ocultos=a.ocultos)
        for p in d.get('posts', []): print('%s · %-4s · %-8s · %s · %s · %d medios · ♥%d%s%s' % (p['id'], p['tipo'], p['estado'], time.strftime('%d/%m %H:%M', time.localtime(p['creado'] / 1000)), p['titulo'], len(p['media']), p['likes'], ' · OCULTO' if p.get('oculto') else '', ' · resp: ' + p['respuesta'][:40] if p.get('respuesta') else ''))
        if 'error' in d: ver(d)
        return
    if a.cosa == 'bajar':
        d = admin(api, 'posts', ocultos=True); p = next((x for x in d.get('posts', []) if x['id'] == a.args[0]), None)
        if not p: return print('no está')
        car = a.dir or '/tmp/claude-0/panel/' + p['id']; os.makedirs(car, exist_ok=True)
        with open(os.path.join(car, 'post.json'), 'w', encoding='utf-8') as f: json.dump(p, f, ensure_ascii=False, indent=1)
        for i, m in enumerate(p['media']):
            ext = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'}.get(m['mime'], '')
            with open(os.path.join(car, '%d_%s%s' % (i, m['id'], ext)), 'wb') as f: f.write(pedir(api, 'panel/media/' + m['id'], crudo=True))
        print(car); return print('\n'.join(sorted(os.listdir(car))))
    if a.cosa == 'responder':
        d = {'id': a.args[0]}
        if a.texto is not None: d['respuesta'] = a.texto
        if a.estado: d['estado'] = a.estado
        if a.ocultar: d['oculto'] = True
        if a.mostrar: d['oculto'] = False
        return ver(admin(api, 'post_cambiar', **d))
    if a.cosa == 'borrar': return ver(admin(api, 'post_borrar', id=a.args[0]))
    if a.cosa == 'errores':
        for e in admin(api, 'errores').get('errores', []): print('%s · %s · ×%d · %s · %s' % (e['h'], e['version'], e['n'], e.get('estado') or '-', e['msg'][:160]))
        return
    if a.cosa == 'error-estado': return ver(admin(api, 'error_estado', h=a.args[0], estado=a.args[1]))
    if a.cosa == 'admins':
        for x in admin(api, 'admins').get('admins', []): print('%s · %s · %s · código %s' % (x['estado'], x['nombre'], time.strftime('%d/%m %H:%M', time.localtime(x['pedido'] / 1000)), hashlib.sha256(x['pub'].encode()).hexdigest()[:8]), '\n   ', x['pub'])
        return
    if a.cosa == 'aprobar': return ver(admin(api, 'aprobar', cert=cert(a.args[0], a.nombre or 'dueño')))
    if a.cosa == 'baja': return ver(admin(api, 'baja', pub=a.args[0]))
    if a.cosa == 'ordenes':
        for o in admin(api, 'ordenes').get('ordenes', []): print(o['id'], o['tipo'], o['de'], time.strftime('%d/%m %H:%M', time.localtime(o['creada'] / 1000)), '→', time.strftime('%d/%m %H:%M', time.localtime(o['hasta'] / 1000)), o['a'][:120])
        return
    if a.cosa == 'orden':
        t = a.args[0]
        if t == 'aviso': r = orden(api, 'aviso', {'titulo': a.titulo or '', 'texto': a.texto or ''}, a.dura or 60)
        elif t == 'cielo': r = orden(api, 'cielo', {'titulo': a.titulo or '', 'texto': a.texto or '', 'img': a.img or '', 'video': a.video or ''}, a.dura or 120)
        elif t == 'cine': r = orden(api, 'cine', {'url': a.url, 'titulo': a.titulo or '', 'cuando': int((time.time() + a.en) * 1000) if a.en else 0}, a.dura or 600)
        elif t == 'ir': r = orden(api, 'ir', {'mapa': a.mapa, 'juntos': a.juntos, 'pos': [float(x) for x in a.pos.split(',')] if a.pos else None, 'texto': a.texto or ''}, a.dura or 1800)
        elif t == 'guion': r = orden(api, 'guion', {'js': open(a.js, encoding='utf-8').read()}, a.dura or 3600)
        elif t == 'quitar': r = orden(api, 'quitar', {'uid': a.uid}, 3600)
        else: return print('¿qué orden?')
        ver(r[0]); return print('uid', r[1])
    print('¿qué cosa?')


if __name__ == '__main__':
    main()
