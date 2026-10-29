#!/usr/bin/env python3
"""Sube el sitio armado (armar.sh) a R2 y publica el Worker con la puerta de clave; deja el lanzador abrir.html.

    publicar.py SITIO ABRIR_HTML [APK]

Con APK, se sube como BO-Zombies.apk: el link https://.../<clave>/BO-Zombies.apk lo descarga al abrirlo.

Lee CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID del entorno. La clave se genera una vez y se guarda FUERA del
repo (/tmp/claude-0/cf/clave-cod-zombies); el lanzador la lleva adentro: es sólo para el dueño, nunca al repo.
"""
import json, os, secrets, sys, urllib.request, urllib.error, uuid, hashlib

API = 'https://api.cloudflare.com/client/v4'
CUENTA = os.environ['CLOUDFLARE_ACCOUNT_ID']
TOKEN = os.environ['CLOUDFLARE_API_TOKEN']
BALDE, NOMBRE = 'cod-zombies', 'boz'
PARTE = 64 << 20          # tamaño de cada parte en R2 (múltiplo de los trozos de 256 KB que pide el juego)
GRANDE = 200 << 20
ESTADO = '/tmp/claude-0/cf/subidos-cod-zombies.json'
TIPOS = {'html': 'text/html; charset=utf-8', 'js': 'text/javascript; charset=utf-8', 'json': 'application/json', 'txt': 'text/plain; charset=utf-8', 'mp3': 'audio/mpeg'}


def pedir(metodo, ruta, datos=None, tipo='application/json'):
    if isinstance(datos, (dict, list)):
        datos = json.dumps(datos).encode()
    r = urllib.request.Request(API + ruta, data=datos, method=metodo, headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': tipo})
    try:
        with urllib.request.urlopen(r, timeout=600) as f:
            return json.loads(f.read() or b'{}')
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b'{}') | {'_estado': e.code}


def subir(clave_r2, datos, tipo, hechos):
    huella = hashlib.sha1(datos).hexdigest()
    if hechos.get(clave_r2) == huella:
        return
    r = pedir('PUT', f'/accounts/{CUENTA}/r2/buckets/{BALDE}/objects/{urllib.request.quote(clave_r2)}', datos, tipo)
    if not r.get('success', '_estado' not in r):
        sys.exit(f'no se pudo subir {clave_r2}: {r}')
    hechos[clave_r2] = huella
    json.dump(hechos, open(ESTADO, 'w'))
    print('subido', clave_r2, len(datos))


def main():
    sitio, abrir = sys.argv[1], sys.argv[2]
    apk = sys.argv[3] if len(sys.argv) > 3 else None
    os.makedirs('/tmp/claude-0/cf', exist_ok=True)
    arch_clave = '/tmp/claude-0/cf/clave-cod-zombies'
    if not os.path.exists(arch_clave):
        open(arch_clave, 'w').write(secrets.token_urlsafe(18))
    clave = open(arch_clave).read().strip()
    hechos = json.load(open(ESTADO)) if os.path.exists(ESTADO) else {}

    r = pedir('POST', f'/accounts/{CUENTA}/r2/buckets', {'name': BALDE})
    if not r.get('success') and 'already' not in json.dumps(r).lower() and r.get('_estado') != 409:
        sys.exit(f'balde: {r}')

    for raiz, _, nombres in os.walk(sitio):
        for n in sorted(nombres):
            p = os.path.join(raiz, n)
            k = os.path.relpath(p, sitio).replace(os.sep, '/')
            tam = os.path.getsize(p)
            tipo = TIPOS.get(n.rsplit('.', 1)[-1], 'application/octet-stream')
            if tam <= GRANDE:
                subir(k, open(p, 'rb').read(), tipo, hechos)
                continue
            with open(p, 'rb') as f:
                i = 0
                while True:
                    d = f.read(PARTE)
                    if not d:
                        break
                    subir(f'{k}.{i:03d}', d, 'application/octet-stream', hechos)
                    i += 1
            subir(k + '.partes', json.dumps({'tam': tam, 'parte': PARTE}).encode(), 'application/json', hechos)

    if apk:
        subir('BO-Zombies.apk', open(apk, 'rb').read(), 'application/vnd.android.package-archive', hechos)

    # Worker (módulo) con el balde y la clave
    limite = '----' + uuid.uuid4().hex
    meta = {'main_module': 'worker.js', 'compatibility_date': '2024-09-23',
            'bindings': [{'type': 'r2_bucket', 'name': 'R2', 'bucket_name': BALDE}, {'type': 'secret_text', 'name': 'CLAVE', 'text': clave}]}
    codigo = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'worker.js'), 'rb').read()
    cuerpo = (f'--{limite}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n'.encode() + json.dumps(meta).encode() +
              f'\r\n--{limite}\r\nContent-Disposition: form-data; name="worker.js"; filename="worker.js"\r\nContent-Type: application/javascript+module\r\n\r\n'.encode() +
              codigo + f'\r\n--{limite}--\r\n'.encode())
    r = pedir('PUT', f'/accounts/{CUENTA}/workers/scripts/{NOMBRE}', cuerpo, 'multipart/form-data; boundary=' + limite)
    if not r.get('success'):
        sys.exit(f'worker: {r}')
    pedir('POST', f'/accounts/{CUENTA}/workers/scripts/{NOMBRE}/subdomain', {'enabled': True, 'previews_enabled': False})
    sub = pedir('GET', f'/accounts/{CUENTA}/workers/subdomain').get('result', {}).get('subdomain')
    if not sub:
        sys.exit('la cuenta no tiene subdominio workers.dev')
    url = f'https://{NOMBRE}.{sub}.workers.dev/{clave}/'

    # lanzador: un iframe a la versión privada; reenvía "game:ready" a Rezona
    open(abrir, 'w').write(f'''<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Black Ops Zombies</title>
<style>html,body{{margin:0;height:100%;background:#000;overflow:hidden}}iframe{{border:0;width:100%;height:100%;display:block}}</style>
</head><body>
<iframe src="{url}" allow="autoplay; fullscreen; gamepad; screen-wake-lock" allowfullscreen></iframe>
<script>addEventListener('message', function (e) {{ if (e.data && e.data.type === 'game:ready') parent.postMessage({{ type: 'game:ready' }}, '*'); }});</script>
</body></html>
''')
    print('publicado; lanzador en', abrir)
    if apk:
        open(abrir + '.descarga.txt', 'w').write(url + 'BO-Zombies.apk\n')
        print('link de descarga del APK en', abrir + '.descarga.txt')


if __name__ == '__main__':
    main()
