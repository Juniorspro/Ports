// Worker de Cloudflare: sirve el sitio desde R2 sólo con la clave en la ruta (/<clave>/archivo), con Range.
// Los archivos grandes van partidos en R2 ("x.000", "x.001"...) porque la API no sube objetos de más de ~300 MB;
// "x.partes" = {"tam":..., "parte":...} y el Worker arma los rangos pidiendo a la parte que corresponde.
const TIPOS = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json', txt: 'text/plain; charset=utf-8', mp3: 'audio/mpeg' };
const partes = new Map();

async function manifiesto(env, ruta) {
  if (partes.has(ruta)) return partes.get(ruta);
  const o = await env.R2.get(ruta + '.partes');
  const m = o ? await o.json() : null;
  partes.set(ruta, m);
  return m;
}

function rango(h, tam) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(h || '');
  if (!m) return null;
  let a, b;
  if (m[1] === '') { a = Math.max(0, tam - Number(m[2])); b = tam - 1; } else { a = Number(m[1]); b = m[2] === '' ? tam - 1 : Math.min(Number(m[2]), tam - 1); }
  return a <= b ? [a, b] : null;
}

async function leerPartido(env, ruta, m, a, b) {
  const trozos = [];
  for (let p = Math.floor(a / m.parte); p * m.parte <= b; p++) {
    const ini = Math.max(a, p * m.parte), fin = Math.min(b, (p + 1) * m.parte - 1);
    const o = await env.R2.get(ruta + '.' + String(p).padStart(3, '0'), { range: { offset: ini - p * m.parte, length: fin - ini + 1 } });
    if (!o) return null;
    trozos.push(new Uint8Array(await o.arrayBuffer()));
  }
  if (trozos.length === 1) return trozos[0];
  const out = new Uint8Array(b - a + 1); let k = 0;
  for (const t of trozos) { out.set(t, k); k += t.length; }
  return out;
}

export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const [, clave, ...resto] = url.pathname.split('/');
    if (!env.CLAVE || clave !== env.CLAVE) return new Response('No existe', { status: 404 });
    if (resto.length === 0) return Response.redirect(url.origin + '/' + clave + '/', 302);
    const ruta = decodeURIComponent(resto.join('/')) || 'web.html';
    const ext = ruta.split('.').pop();
    const cab = { ...cors, 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': ext === 'html' || ext === 'js' ? 'no-cache' : 'private, max-age=604800' };
    // el APK se descarga solo al abrir el link
    if (ext === 'apk') { cab['Content-Type'] = 'application/vnd.android.package-archive'; cab['Content-Disposition'] = 'attachment; filename="' + ruta.split('/').pop() + '"'; }
    const m = await manifiesto(env, ruta);
    if (m) {
      const r = rango(req.headers.get('Range'), m.tam) || [0, m.tam - 1];
      if (r[1] - r[0] + 1 > 64 << 20) return new Response('Pedí por rangos', { status: 416, headers: cab });
      const d = await leerPartido(env, ruta, m, r[0], r[1]);
      if (!d) return new Response('Falta una parte', { status: 500, headers: cab });
      return new Response(d, { status: 206, headers: { ...cab, 'Content-Range': `bytes ${r[0]}-${r[1]}/${m.tam}`, 'Content-Length': String(d.length) } });
    }
    const cabeza = await env.R2.head(ruta);
    if (!cabeza) return new Response('No existe', { status: 404, headers: cab });
    const r = rango(req.headers.get('Range'), cabeza.size);
    if (r) {
      const o = await env.R2.get(ruta, { range: { offset: r[0], length: r[1] - r[0] + 1 } });
      return new Response(o.body, { status: 206, headers: { ...cab, 'Content-Range': `bytes ${r[0]}-${r[1]}/${cabeza.size}`, 'Content-Length': String(r[1] - r[0] + 1) } });
    }
    const o = await env.R2.get(ruta);
    return new Response(o.body, { headers: { ...cab, 'Content-Length': String(cabeza.size) } });
  },
};
