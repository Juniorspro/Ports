# La app web instalable de JXMod (iPhone/iPad con «Agregar a inicio», y cualquier navegador): al lado del juego armado
# con PK_BIN=1 APP_WEB=1 (index.html + pk.bin) pone los íconos, el manifiesto y el service worker que la deja andar sin
# internet. Uso: python3 -I herramientas/web_app.py CARPETA   (la carpeta con index.html y pk.bin; en el repo, web/)
import os, sys, json, hashlib
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__)); JX = os.path.dirname(AQUI)
D = os.path.abspath(sys.argv[1]); os.makedirs(os.path.join(D, 'app'), exist_ok=True)
for f in ('index.html', 'pk.bin'):
    assert os.path.isfile(os.path.join(D, f)), 'falta ' + f + ' (armar con PK_BIN=1 APP_WEB=1)'

# íconos: el logo de la app de Android (su capa de adelante) sobre su fondo, opacos (iOS no acepta transparencia y les
# redondea las puntas solo). «maskable» (Android) con el logo más chico: el sistema puede recortarlo en círculo
fondo = (0x20, 0x20, 0x20, 255)
logo = Image.open(os.path.join(JX, 'apk', 'res', 'mipmap-xxxhdpi', 'ic_launcher_foreground.png')).convert('RGBA')
logo = logo.crop(logo.getbbox())
def icono(lado, ancho):
    im = Image.new('RGBA', (lado, lado), fondo)
    w = round(lado * ancho); h = round(w * logo.height / logo.width)
    l = logo.resize((w, h), Image.LANCZOS); im.alpha_composite(l, ((lado - w) // 2, (lado - h) // 2))
    return im.convert('RGB')
iconos = {'icono-180.png': (180, 0.8), 'icono-192.png': (192, 0.8), 'icono-512.png': (512, 0.8), 'icono-512-mascara.png': (512, 0.66)}
for n, (lado, ancho) in iconos.items(): icono(lado, ancho).save(os.path.join(D, 'app', n), optimize=True)

man = {'name': 'JXMod', 'short_name': 'JXMod', 'description': 'Sandbox con mods de GMod', 'lang': 'es',
       'start_url': 'index.html', 'scope': './', 'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'],
       'orientation': 'landscape', 'background_color': '#000000', 'theme_color': '#1b1d22',
       'icons': [{'src': 'app/icono-192.png', 'sizes': '192x192', 'type': 'image/png'},
                 {'src': 'app/icono-512.png', 'sizes': '512x512', 'type': 'image/png'},
                 {'src': 'app/icono-512-mascara.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}
open(os.path.join(D, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps(man, ensure_ascii=False, indent=1))

# la versión: una huella del juego y del paquete; si cambian, el service worker es otro y el navegador lo actualiza
h = hashlib.sha256()
for f in ('index.html', 'pk.bin'): h.update(open(os.path.join(D, f), 'rb').read())
V = h.hexdigest()[:12]
basicos = ['index.html', 'pk.bin', 'manifest.webmanifest'] + ['app/' + n for n in iconos]
SW = '''// JXMod sin internet (lo arma herramientas/web_app.py: no editar acá). Versión ''' + V + '''
// - el juego (index.html y pk.bin) y los íconos se guardan al instalar; si hay una versión nueva, el navegador baja este
//   archivo distinto, guarda la nueva y borra la vieja;
// - lo que el juego baja de al lado (rb/: mapas, personajes, sonidos; emotes/) se guarda la primera vez que se usa;
// - todo lo demás (la tienda, Steam, la sala en línea) va por internet como siempre.
const V = 'jxmod-''' + V + '''', REC = 'jxmod-recursos', BASICOS = ''' + json.dumps(basicos) + ''';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('jxmod-') && k !== V && k !== REC).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const base = new URL('./', self.location).href;
self.addEventListener('fetch', (e) => {
  const q = e.request; if (q.method !== 'GET' || q.headers.has('range')) return;
  const u = q.url.split('#')[0], rel = u.startsWith(base) ? u.slice(base.length).split('?')[0] : null;
  if (rel !== null && (BASICOS.includes(rel) || rel === '' || q.mode === 'navigate')) {
    const k = rel === '' || q.mode === 'navigate' ? 'index.html' : rel;
    e.respondWith(caches.open(V).then((c) => c.match(k).then((r) => r || fetch(q))));
    return;
  }
  if (/\\/web\\/(rb|emotes)\\//.test(u)) {
    e.respondWith(caches.open(REC).then((c) => c.match(q).then((r) => r || fetch(q).then((x) => { if (x.ok && (x.type === 'basic' || x.type === 'cors')) c.put(q, x.clone()).catch(() => {}); return x; }))));
  }
});
'''
open(os.path.join(D, 'sw.js'), 'w', encoding='utf-8').write(SW)
print('ok', D, 'versión', V, 'íconos', len(iconos))

