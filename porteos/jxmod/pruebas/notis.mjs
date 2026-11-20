// Las notificaciones del panel de punta a punta, en la compu: el worker de la tienda de verdad (worker.js + panel.js +
// cuenta.js + correo.js, base D1 en memoria, correos en una lista) servido acá junto con la web instalable del juego
// (APP_WEB + PK_BIN + web_app.py, sin código), un servicio de push de mentira y panel.py firmando como Claude:
//  1. el juego en la web se anota para el push («Avisarme en este aparato»: permiso, suscripción, alta en el panel) y
//     deja la dirección del panel para su service worker;
//  2. panel.py noti (juego + push + correo): al juego le llega en ≤ 5 s el cartel y el globito de Avisos; la lista
//     de Avisos la muestra con su enlace y al verla se va el globito;
//  3. el push: el servicio recibe el aviso firmado (VAPID ES256 con la llave pública del panel, aud = su origen, TTL);
//     al entregarlo, el service worker muestra la notificación con el título y el texto del panel;
//  4. el correo: les llega a las cuentas que aceptaron novedades (y no a la otra), con el enlace de baja;
//  5. con el juego en otra pestaña (y permiso), la que llega sale también como notificación del sistema;
//  6. quitada, ya no le llega a un aparato nuevo;
//  7. en la app de Android (JXNativo con los avisos): el botón programa la tarea de la app con lo último visto, y lo que
//     llega al juego se lo dice a la app (para que no lo repita con la app cerrada); sin errores de JS.
// uso: node notis.mjs CARPETA_WEB   (armada con PK_BIN=1 APP_WEB=1 armar.py → CARPETA_WEB/index.html; web_app.py)
import './cf_sockets.mjs';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { DatabaseSync } from 'node:sqlite'; import { readFileSync, existsSync, statSync, createReadStream } from 'fs'; import http from 'http'; import path from 'path';
import { execFile } from 'child_process'; import { promisify } from 'util';
const [, , WEB] = process.argv, PUERTO = 8971, BASE = `http://localhost:${PUERTO}/`, API = BASE + 'api/';
let ok = 0, mal = 0; const chk = (c, m, x) => { if (c) ok++; else mal++; console.log((c ? 'OK    ' : 'FALLA ') + m + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 380) : '')); };
const ROOT = new URL('../tienda/', import.meta.url).pathname, HERR = new URL('../herramientas/panel.py', import.meta.url).pathname;
const db = new DatabaseSync(':memory:'); db.exec(readFileSync(ROOT + 'schema.sql', 'utf8'));
const st = (sql, a = []) => ({ bind: (...x) => st(sql, x.map((v) => (v === undefined ? null : typeof v === 'boolean' ? +v : v))), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; }, x: () => db.prepare(sql).run(...a) });
const env = { DB: { prepare: (s) => st(s), batch: async (L) => L.map((s) => s.x()) }, CORREO_PRUEBA: '1', GMAIL_USUARIO: 'juego.jxmod@gmail.com', SAL: 'x', PUSH_PRUEBA: BASE + 'pushfalso/' };
const W = (await import(ROOT + 'worker.js')).default, { CORREOS_PRUEBA } = await import(ROOT + 'correo.js');
const PUSH = [];
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.bin': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, BASE), trozos = []; for await (const c of req) trozos.push(c);
  if (u.pathname.startsWith('/api/')) {
    const h = { ...req.headers }; delete h['content-length'];
    const r = await W.fetch(new Request(BASE.slice(0, -1) + req.url, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(trozos) }), env, { waitUntil() {} });
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (u.pathname.startsWith('/pushfalso/')) { PUSH.push({ url: BASE.slice(0, -1) + u.pathname, h: req.headers, n: Buffer.concat(trozos).length }); res.writeHead(201); return res.end(); }
  let f = path.join(WEB, decodeURIComponent(u.pathname)); if (existsSync(f) && statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(res);
}).listen(PUERTO);
// (asincrónico: panel.py le habla a este mismo proceso)
const py = async (...a) => (await promisify(execFile)('python3', ['-I', HERR, '--api', API, ...a], { maxBuffer: 1 << 20 })).stdout;
const llamar = async (ruta, cuerpo) => (await fetch(API + ruta, cuerpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) } : undefined)).json();
// tres cuentas por correo: dos aceptaron novedades
for (const [c, av] of [['ana.perez@gmail.com', true], ['beto.gomez@gmail.com', true], ['caro.luna@gmail.com', false]]) {
  await llamar('cuenta/correo/pedir', { correo: c }); const m = [...CORREOS_PRUEBA].reverse().find((x) => x.para === c);
  await llamar('cuenta/correo/entrar', { correo: c, codigo: /(\d{6})/.exec(m.asunto)[1], avisos: av });
}
CORREOS_PRUEBA.length = 0;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const err = [];
async function aparato(app) {
  const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR' });
  await ctx.grantPermissions(['notifications'], { origin: BASE.slice(0, -1) });
  // (las cuentas y lo demás de la tienda, al worker de acá)
  await ctx.route('https://rezobox-tienda.holasoyjuniors365.workers.dev/**', async (route) => { const q = route.request(), r = await fetch(q.url().replace('https://rezobox-tienda.holasoyjuniors365.workers.dev/', BASE), { method: q.method(), headers: { 'Content-Type': 'application/json' }, body: q.postDataBuffer() || undefined }); await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) }); });
  // (Chromium sin servicio de push: la suscripción la da el servicio de mentira de acá)
  await ctx.addInitScript((B) => { if (window.PushManager) { PushManager.prototype.getSubscription = async () => null; PushManager.prototype.subscribe = async function (o) { window.__sub = o; return { endpoint: B + 'pushfalso/aparato1' }; }; }
    const N = window.Notification; window.__notis = []; if (N) { const F = function (t, o) { window.__notis.push([t, o && o.body]); return new N(t, o); }; F.permission = N.permission; F.requestPermission = N.requestPermission.bind(N); Object.defineProperty(F, 'permission', { get: () => N.permission }); window.Notification = F; } }, BASE);
  if (app) await ctx.addInitScript(() => { const L = (window.__nat = []); let est = 'pedir'; window.JXNativo = { abrir: () => {}, version: () => 'prueba', avisosEstado: () => est, avisosActivar: (nd) => { L.push(['activar', nd]); est = 'activo'; }, avisosVisto: (nd) => L.push(['visto', nd]) }; });
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
  await p.goto(BASE + 'index.html?panel=' + encodeURIComponent(API + 'panel/') + '&panelCada=2'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; if (typeof cuCancelar === 'function') cuCancelar(); 1`);
  return { ctx, p, ev };
}
const esperar = (p, s, ms = 15000) => p.waitForFunction((x) => window.__ev(x), s, { timeout: ms, polling: 200 }).then(() => true, () => false);

// 1. anotarse para el push
const A = await aparato();
await A.p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});
await A.ev(`inicioAccion('avisos'); 1`); await A.p.waitForTimeout(300);
const boton = await A.ev(`!!RB.el.querySelector('[data-rb="av:activar"]')`);
await A.ev(`RB.el.querySelector('[data-rb="av:activar"]').click(); 1`);
await esperar(A.p, `!!localStorage.getItem('jx_push')`, 15000);
const alta = db.prepare('SELECT endpoint FROM pn_push').all(), conf = await A.p.evaluate(async () => { try { const c = await caches.open('jx-conf'), r = await c.match('panel'); return r ? r.text() : null; } catch (e) { return 'err ' + e; } });
const clave = (await llamar('panel/push/clave')).clave, sub = await A.p.evaluate(() => window.__sub && [...new Uint8Array(window.__sub.applicationServerKey)].length);
const estado1 = await A.ev(`(() => { inicioPanel('avisos'); return (RB.el.querySelector('.avEst') || {}).textContent || ''; })()`);
chk(boton && alta.length === 1 && alta[0].endpoint.endsWith('/pushfalso/aparato1') && conf === API + 'panel/' && sub === 65 && /aunque el juego esté cerrado/.test(estado1), '1. «Avisarme en este aparato»: permiso, suscripción con la llave del panel, alta y la dirección para el service worker', { boton, alta, conf, sub, estado1 });
await A.ev(`inicioPanel(null); 1`);
// 2. la notificación
const t0 = Date.now();
const salida = await py('noti', '--titulo', 'Evento del sábado', '--texto', 'A las 18 h en gm_construct: ¡vengan todos!', '--url', 'https://example.com/evento', '--push', '--correo');
const llego = await esperar(A.p, `!!document.querySelector('#ordAvisos .ordAviso') && /Evento del sábado/.test(document.getElementById('ordAvisos').textContent)`, 8000), tarda = Date.now() - t0;
const globo = await A.ev(`({ hay: document.documentElement.classList.contains('avHay'), n: getComputedStyle(document.documentElement).getPropertyValue('--avN').trim(), chips: [...document.querySelectorAll('.avGlobo')].filter((x) => x.offsetWidth).length })`);
await A.ev(`cuDialogoCerrar(); 1`); await A.p.screenshot({ path: '/tmp/claude-0/notis_cartel.png' });
await A.ev(`(() => { const x = document.querySelector('#ordAvisos .ordX'); if (x) x.click(); return 1; })()`); await A.p.waitForTimeout(500); await A.p.screenshot({ path: '/tmp/claude-0/notis_globo.png' });
chk(llego && tarda < 6000 && globo.hay && globo.n === '"1"' && globo.chips >= 1, '2. al juego le llega el cartel en ' + (tarda / 1000).toFixed(1) + ' s, y el globito (1) en Avisos', { llego, globo, salida: salida.trim().split('\n') });
await A.ev(`inicioAccion('avisos'); 1`); await A.p.waitForTimeout(300);
const lista = await A.ev(`({ items: [...RB.el.querySelectorAll('.avItem')].map((x) => ({ t: x.querySelector('b').textContent, nuevo: x.classList.contains('nuevo'), abrir: !!x.querySelector('[data-rb^="av:abrir"]') })), hay: document.documentElement.classList.contains('avHay') })`);
await A.ev(`cuDialogoCerrar(); 1`); await A.p.screenshot({ path: '/tmp/claude-0/notis_lista.png' });
chk(lista.items.length === 1 && lista.items[0].t === 'Evento del sábado' && lista.items[0].nuevo && lista.items[0].abrir && !lista.hay, '2. la lista de Avisos la muestra (nueva, con su enlace) y se va el globito', lista);
// 3. el push
const P0 = PUSH[0], m = P0 && /^vapid t=([^,]+), k=(.+)$/.exec(P0.h.authorization || '');
let firma = false, dat = null;
if (m) {
  const [h, c, s] = m[1].split('.'), d64 = (x) => Buffer.from(x, 'base64url'); dat = JSON.parse(d64(c).toString());
  const k = await crypto.subtle.importKey('raw', d64(m[2]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  firma = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, d64(s), new TextEncoder().encode(h + '.' + c));
}
chk(PUSH.length === 1 && m && m[2] === clave && firma && dat.aud === BASE.slice(0, -1) && dat.exp > Date.now() / 1000 && +P0.h.ttl > 0 && P0.n === 0, '3. el servicio de push recibe el aviso firmado (VAPID ES256, la llave del panel, aud y TTL)', { n: PUSH.length, firma, dat, ttl: P0 && P0.h.ttl });
const cdp = await A.ctx.newCDPSession(A.p); let reg = null;
cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => { for (const r of e.registrations) if (r.scopeURL.startsWith(BASE)) reg = r.registrationId; });
await cdp.send('ServiceWorker.enable'); for (let i = 0; i < 20 && !reg; i++) await A.p.waitForTimeout(100);
await cdp.send('ServiceWorker.deliverPushMessage', { origin: BASE.slice(0, -1), registrationId: reg, data: '' });
let notiSW = []; for (let i = 0; i < 30 && !notiSW.length; i++) { await A.p.waitForTimeout(200); notiSW = await A.p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => [n.title, n.body, n.data && n.data.link])); }
chk(notiSW.length === 1 && notiSW[0][0] === 'Evento del sábado' && /gm_construct/.test(notiSW[0][1]) && notiSW[0][2] === 'https://example.com/evento', '3. al entregarlo, el service worker muestra la notificación con lo del panel', notiSW);
// 4. el correo
const dest = CORREOS_PRUEBA.map((x) => x.para).sort(), c0 = CORREOS_PRUEBA[0];
chk(dest.join(',') === 'ana.perez@gmail.com,beto.gomez@gmail.com' && c0.asunto === 'Evento del sábado' && /https:\/\/example\.com\/evento/.test(c0.texto) && /cuenta\/baja\?u=/.test(c0.texto) && /List-Unsubscribe: </.test(c0.crudo), '4. el correo les llega a las dos cuentas que aceptaron novedades (no a la tercera), con el enlace de baja', { dest, asunto: c0 && c0.asunto });
// 5. con el juego en otra pestaña
await A.ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); 1`);
await py('noti', '--titulo', 'Server nuevo', '--texto', 'Ya está abierto');
await A.ev(`notTraer(); 1`);
const sis = await A.p.waitForFunction(() => (window.__notis || []).length, null, { timeout: 8000 }).then(() => A.p.evaluate(() => window.__notis), () => []);
chk(sis.length === 1 && sis[0][0] === 'Server nuevo' && sis[0][1] === 'Ya está abierto', '5. con el juego en otra pestaña, la nueva sale también como notificación del sistema', sis);
// 6. quitarla
const id = /noti (\w+)/.exec(salida)[1]; await py('noti-quitar', id);
const nuevo = await aparato(); await nuevo.p.waitForTimeout(5000);
const tiene = await nuevo.ev(`NOT.L.map((x) => x.t)`);
chk(!tiene.includes('Evento del sábado') && tiene.includes('Server nuevo'), '6. quitada, ya no le llega a un aparato nuevo (la otra sí)', tiene);
// 7. la app de Android
const C = await aparato(true); await C.p.waitForTimeout(4000);
await C.ev(`inicioAccion('avisos'); 1`); await C.p.waitForTimeout(300);
const b7 = await C.ev(`!!RB.el.querySelector('[data-rb="av:activar"]')`);
await C.ev(`RB.el.querySelector('[data-rb="av:activar"]').click(); 1`); await C.p.waitForTimeout(1200);
const e7 = await C.ev(`({ nat: window.__nat, txt: (RB.el.querySelector('.avEst') || {}).textContent || '', boton: !!RB.el.querySelector('[data-rb="av:activar"]'), nd: NOT.nd })`);
chk(b7 && e7.nat.some((x) => x[0] === 'activar' && +x[1] === e7.nd && e7.nd > 0) && e7.nat.some((x) => x[0] === 'visto' && +x[1] === e7.nd) && !e7.boton && /aunque el juego esté cerrado/.test(e7.txt), '7. en la app: el botón programa los avisos de Android con lo último visto, y lo visto en el juego se le dice a la app', e7);
chk(!err.length, '7. sin errores de JS', err.slice(0, 4));
console.log(`\n${ok}/${ok + mal}`);
await b.close(); process.exit(mal ? 1 : 0);
