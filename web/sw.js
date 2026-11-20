// JXMod sin internet (lo arma herramientas/web_app.py: no editar acá). Versión 4cd48daad976
// - el juego (index.html y pk.bin) y los íconos se guardan al instalar; si hay una versión nueva, el navegador baja este
//   archivo distinto, guarda la nueva y borra la vieja;
// - los fondos animados del menú (fondos/) se guardan con la versión cuando el juego los pide (con el menú ya andando);
// - lo que el juego baja de al lado (rb/: mapas, personajes, sonidos; emotes/) se guarda la primera vez que se usa;
// - todo lo demás (la tienda, Steam, la sala en línea) va por internet como siempre; la app admin (panel/) no la toca.
const V = 'jxmod-4cd48daad976', REC = 'jxmod-recursos', BASICOS = ["index.html", "pk.bin", "juego.bin", "manifest.webmanifest", "app/icono-180.png", "app/icono-192.png", "app/icono-512.png", "app/icono-512-mascara.png"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('jxmod-') && k !== V && k !== REC).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const base = new URL('./', self.location).href;
self.addEventListener('fetch', (e) => {
  const q = e.request; if (q.method !== 'GET' || q.headers.has('range')) return;
  const u = q.url.split('#')[0], rel = u.startsWith(base) ? u.slice(base.length).split('?')[0] : null;
  if (rel !== null && rel.startsWith('panel/')) return;   // (la app admin —web/panel— es otra página: ni el juego guardado ni caché)
  if (rel !== null && (BASICOS.includes(rel) || rel === '' || q.mode === 'navigate')) {
    const k = rel === '' || q.mode === 'navigate' ? 'index.html' : rel;
    e.respondWith(caches.open(V).then((c) => c.match(k).then((r) => r || fetch(q))));
    return;
  }
  if (rel !== null && rel.startsWith('fondos/')) {
    e.respondWith(caches.open(V).then((c) => c.match(rel).then((r) => r || fetch(q).then((x) => { if (x.ok) c.put(rel, x.clone()).catch(() => {}); return x; }))));
    return;
  }
  if (/\/web\/(rb|emotes)\//.test(u)) {
    e.respondWith(caches.open(REC).then((c) => c.match(q).then((r) => r || fetch(q).then((x) => { if (x.ok && (x.type === 'basic' || x.type === 'cors')) c.put(q, x.clone()).catch(() => {}); return x; }))));
  }
});
