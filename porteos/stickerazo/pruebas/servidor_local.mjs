// El servidor de la comunidad en la compu (el Worker de verdad, con la D1 de mentira). uso: node servidor_local.mjs PUERTO [ADMIN]
import http from 'http'; import fs from 'fs'; import path from 'path'; import { d1 } from './d1_falsa.mjs';
// (lo que el Worker trae de GitHub —actualizaciones, página web, APK— acá sale de esta misma carpeta: /__repo/RAMA/porteos/stickerazo/…)
const RAIZ = new URL('../', import.meta.url).pathname;
const M = await import(new URL('../servidor/worker.js', import.meta.url)), W = M.default;
// (SZ_BASE=/sz: como adentro del Worker de JXMod, con las tablas «sz_»; el resto de las rutas da 404 como si fueran de JXMod)
const BASE = process.env.SZ_BASE || '';
export function arrancar(puerto, admin = 'clave-admin', extra = {}) {
  const env = { DB: d1(), ADMIN_CLAVE: admin, SZ_REPO: `http://127.0.0.1:${puerto}/__repo/`, ...extra };
  const srv = http.createServer(async (q, r) => {
    const rp = /^\/__repo\/.+?\/porteos\/stickerazo\/(.+)$/.exec(decodeURIComponent(q.url.split('?')[0]));
    if (rp) { const f = path.join(RAIZ, rp[1]); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); return r.end('404'); } r.writeHead(200, { 'Content-Length': fs.statSync(f).size }); return fs.createReadStream(f).pipe(r); }
    const partes = []; for await (const c of q) partes.push(c);
    const h = new Headers(); for (const [k, v] of Object.entries(q.headers)) if (typeof v === 'string') h.set(k, v);
    const req = new Request(`http://127.0.0.1:${puerto}${q.url}`, { method: q.method, headers: h, body: ['GET', 'HEAD', 'OPTIONS'].includes(q.method) ? undefined : Buffer.concat(partes), duplex: 'half' });
    try {
      const ruta = new URL(req.url).pathname, res = !BASE ? await W.fetch(req, env, { waitUntil() {} })
        : ruta === BASE || ruta.startsWith(BASE + '/') ? await M.stickerazoRutas(req, env, { waitUntil() {} }, BASE) : new Response('de JXMod', { status: 404 }); r.writeHead(res.status, Object.fromEntries(res.headers)); r.end(Buffer.from(await res.arrayBuffer())); }
    catch (e) { console.error(e); r.writeHead(500); r.end(String(e)); }
  });
  return new Promise((ok) => srv.listen(puerto, '127.0.0.1', () => ok({ srv, env })));
}
if (process.argv[1] && process.argv[1].endsWith('servidor_local.mjs')) { await arrancar(+process.argv[2] || 8990, process.argv[3]); console.log('listo'); }
