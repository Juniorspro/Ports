// JXMod sin internet (lo arma herramientas/web_app.py: no editar acá). Versión b7ab1334ac36
// - el juego (index.html y pk.bin) y los íconos se guardan al instalar; si hay una versión nueva, el navegador baja este
//   archivo distinto, guarda la nueva y borra la vieja;
// - lo que el juego baja de al lado (rb/: mapas, personajes, sonidos; emotes/) se guarda la primera vez que se usa;
// - todo lo demás (la tienda, Steam, la sala en línea) va por internet como siempre.
const V = 'jxmod-b7ab1334ac36', REC = 'jxmod-recursos', BASICOS = ["index.html", "pk.bin", "juego.bin", "manifest.webmanifest", "app/icono-180.png", "app/icono-192.png", "app/icono-512.png", "app/icono-512-mascara.png"];
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
  if (/\/web\/(rb|emotes)\//.test(u)) {
    e.respondWith(caches.open(REC).then((c) => c.match(q).then((r) => r || fetch(q).then((x) => { if (x.ok && (x.type === 'basic' || x.type === 'cors')) c.put(q, x.clone()).catch(() => {}); return x; }))));
  }
});
