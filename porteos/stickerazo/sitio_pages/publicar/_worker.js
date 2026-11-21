// stickerazo.pages.dev → el servidor de Stickerazo (/sz/… del Worker de JXMod), por el enlace directo SZ.
// Sólo para leer: la página, sus imágenes, /descargar, /app.json, /privacidad, /terminos, /borrar-cuenta y /p/ID.
// La app sigue hablando con el servidor de siempre (/sz/api/…).
const SERVIDOR = 'https://rezobox-tienda.holasoyjuniors365.workers.dev/sz';
export default {
  async fetch(req, env) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Sólo para mirar', { status: 405 });
    const u = new URL(req.url);
    if (u.pathname.startsWith('/api/')) return new Response('La app usa el servidor directo', { status: 404 });
    const r = await env.SZ.fetch(new Request(SERVIDOR + u.pathname + u.search, { method: req.method, headers: { Accept: req.headers.get('Accept') || '*/*', 'X-Sitio': u.origin }, redirect: 'manual' }));
    const h = new Headers(r.headers);
    // (si el servidor redirige dentro de /sz, que siga en esta dirección)
    const l = h.get('Location'); if (l && l.startsWith(SERVIDOR)) h.set('Location', l.slice(SERVIDOR.length) || '/');
    return new Response(r.body, { status: r.status, headers: h });
  },
};
