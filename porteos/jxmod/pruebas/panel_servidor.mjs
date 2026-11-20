// El servidor del panel (tienda/panel.js) en la compu, para las pruebas: las mismas rutas con SQLite en vez de D1 (las
// mismas consultas), sin cuentas de Google (publica cualquiera, como con las cuentas apagadas). Además sirve los
// archivos de una carpeta (la página del juego, la app admin, videos de prueba) desde el mismo lugar.
// uso: node panel_servidor.mjs PUERTO CARPETA [BASE.sqlite]
import http from 'http';
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { panelRutas } from '../tienda/panel.js';
const [, , PUERTO = '8396', CARPETA = '.', BASE = ':memory:'] = process.argv;
const db = new DatabaseSync(BASE);
// (lo que usa panel.js de D1: prepare → bind → first / all / run, y batch)
const prep = (sql) => {
  let st0 = null; const st = () => st0 || (st0 = db.prepare(sql));   // (como D1: se compila al usarse)
  const conArgs = (a) => ({
    first: async () => st().get(...a) ?? null,
    all: async () => ({ results: st().all(...a) }),
    run: async () => { const r = st().run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return Object.assign({ bind: (...a) => conArgs(a.map((x) => (x === undefined ? null : x))) }, conArgs([]));
};
const env = { DB: { prepare: prep, batch: async (L) => { for (const s of L) await s.run(); } } };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm', '.jpg': 'image/jpeg', '.png': 'image/png', '.bin': 'application/octet-stream', '.rbp': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:' + PUERTO), r = url.pathname.replace(/\/+$/, '');
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (r.startsWith('/api/')) {
      const trozos = []; for await (const c of req) trozos.push(c);
      const cuerpo = Buffer.concat(trozos), rq = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : cuerpo });
      const R = (r === '/api/cuenta/config' ? json({ google: false }) : await panelRutas(rq, env, url, r, '127.0.0.1', json, null, () => false)) || json({ error: 'no existe' }, 404);
      res.writeHead(R.status, Object.fromEntries(R.headers)); return res.end(Buffer.from(await R.arrayBuffer()));
    }
    let f = path.join(CARPETA, decodeURIComponent(url.pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!f.startsWith(path.resolve(CARPETA)) && !path.resolve(f).startsWith(path.resolve(CARPETA))) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(f)) { res.writeHead(404, CORS); return res.end('no'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', ...CORS }); fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(+PUERTO, () => console.log('panel en http://localhost:' + PUERTO));
