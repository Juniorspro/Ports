// la cuenta de Google de punta a punta, con el worker de la tienda de verdad (tienda/worker.js + cuenta.js) corriendo acá
// con una base D1 en memoria, y Google simulado: sus claves públicas y su botón (gsi/client) los sirve esta prueba, y el
// ID token lo firma con una clave propia. Se prueba: el chip y el multijugador sin sesión (cartel en vez de la lista);
// entrar desde la web (ventanita) y desde la app (navegador del celular, con «Volver a JXMod»); que la página rechace
// tokens falsos, de otra app, vencidos o de otro pedido; que la sesión llegue sola al juego; que guardar pida la sesión;
// el progreso que pasa a otro aparato (y los addons que faltan, a la cola); el más nuevo gana; cerrar sesión; crear un
// server pide sesión; y sin GOOGLE_CLIENT_ID todo queda como antes.
// uso: node cuenta_google.mjs URL_HTML [URL_CARPETA_GMA]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import { DatabaseSync } from 'node:sqlite'; import { readFileSync } from 'fs';
const [, , HTML, CARP] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const ROOT = new URL('../tienda/', import.meta.url).pathname, HOST = 'https://rezobox-tienda.holasoyjuniors365.workers.dev';
// ---- D1 en memoria ----
const db = new DatabaseSync(':memory:'); db.exec(readFileSync(ROOT + 'schema.sql', 'utf8'));
const st = (sql, a = []) => ({ bind: (...x) => st(sql, x), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => ({ meta: { changes: db.prepare(sql).run(...a).changes } }), x() { const p = db.prepare(sql); return /^\s*SELECT/i.test(sql) ? p.all(...a) : p.run(...a); } });
const DB = { prepare: (s) => st(s), batch: async (L) => L.map((s) => s.x()) };
const CLIENTE = 'jx-prueba.apps.googleusercontent.com', env = { DB, GOOGLE_CLIENT_ID: CLIENTE, SAL: 'x' };
// ---- Google de mentira: claves y tokens ----
const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pub = await crypto.subtle.exportKey('jwk', par.publicKey); Object.assign(pub, { kid: 'k1', alg: 'RS256', use: 'sig' });
const otro = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const b64u = (b) => Buffer.from(b).toString('base64url');
async function token(o, clave) { const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' })), ahora = Math.floor(Date.now() / 1000);
  const p = b64u(JSON.stringify(Object.assign({ iss: 'https://accounts.google.com', aud: CLIENTE, sub: '1001', name: 'Juan Prueba', picture: 'https://lh3.googleusercontent.com/a/foto', iat: ahora, exp: ahora + 3600 }, o)));
  const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', (clave || par).privateKey, new TextEncoder().encode(h + '.' + p)); return h + '.' + p + '.' + b64u(new Uint8Array(s)); }
const fetch0 = globalThis.fetch;
globalThis.fetch = async (u, o) => (String(u).startsWith('https://www.googleapis.com/oauth2/v3/certs') ? new Response(JSON.stringify({ keys: [pub] }), { headers: { 'Content-Type': 'application/json' } }) : fetch0(u, o));
const W = (await import(ROOT + 'worker.js')).default;
const llamar = async (ruta, o = {}) => { const r = await W.fetch(new Request(HOST + ruta, o), env, { waitUntil() {} }); let j = null; try { j = await r.clone().json(); } catch (e) {} return { st: r.status, j, r }; };
let SUB = '1001';
// (el botón de Google falso: al tocarlo, pide a "Google" un token con el nonce de la página y llama al callback)
const GSI = `window.google={accounts:{id:{initialize:function(o){window.__o=o},renderButton:function(el){var b=document.createElement('button');b.id='gbtn';b.textContent='Google';b.onclick=function(){fetch('https://accounts.google.com/gsi/prueba?nonce='+window.__o.nonce).then(function(r){return r.text()}).then(function(t){window.__o.callback({credential:t})})};el.appendChild(b)}}}};`;
async function ruteo(ctx) {
  await ctx.route(HOST + '/**', async (route) => {
    const q = route.request(), h = await q.allHeaders(); delete h['content-length'];
    const r = await W.fetch(new Request(q.url(), { method: q.method(), headers: h, body: ['GET', 'HEAD'].includes(q.method()) ? undefined : q.postDataBuffer() }), env, { waitUntil() {} });
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
  });
  await ctx.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: GSI }));
  await ctx.route('https://accounts.google.com/gsi/prueba**', async (route) => { const n = new URL(route.request().url()).searchParams.get('nonce'); await route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'Access-Control-Allow-Origin': '*' }, body: await token({ nonce: n, sub: SUB }) }); });
}
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
async function aparato(app) {
  const ctx = await b.newContext(app ? { viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } }); await ruteo(ctx);
  if (app) await ctx.addInitScript(() => { window.JXNativo = { abrir: (u) => { window.__abierto = u; }, version: () => 'prueba' }; });
  const p = await ctx.newPage(), err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
  await p.goto(HTML); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.waitForFunction(() => window.__ev('JUEGO.estado === "principal" && !!RB.el && !!CU.conf'), null, { timeout: 60000 });
  await ev(`PREFS.bienvenida = true; inicioPanel(null); 1`); await p.waitForTimeout(300);
  return { ctx, p, ev, err };
}
const esperar = (p, s, ms = 15000) => p.waitForFunction((x) => window.__ev(x), s, { timeout: ms }).then(() => true, () => false);

// ---- 1) aparato web, sin sesión ----
const A = await aparato(false);
// (al abrir el juego —también después de actualizar— pide iniciar sesión, sin esperar al multijugador)
const alAbrir = await esperar(A.p, `!!document.querySelector('#cuDlg:not(.oc) [data-cu=entrar]')`, 30000);
ok('al abrir el juego pide iniciar sesión con Google (una vez, en el menú)', alAbrir);
await A.ev(`cuCancelar(); 1`);
const chip = await A.ev(`(() => { const c = RB.el.querySelector('.cuChip'); return c ? c.textContent.trim() : null; })()`);
ok('el menú muestra «Iniciar sesión con Google»', /Google/.test(chip || ''), chip);
await A.ev(`inicioAccion('multi'); 1`); await A.p.waitForTimeout(400);
const mp0 = await A.ev(`({ cartel: !!RB.el.querySelector('.cuPanel .cuGoogle'), lista: !!RB.el.querySelector('#mpLista') })`);
ok('multijugador sin sesión: el cartel para entrar, sin la lista de servers', mp0.cartel && !mp0.lista, mp0);
await A.p.screenshot({ path: 'cuenta_multi.png' });
await A.ev(`entrarSala({ id: 'abcd1234', n: 'x', m: 'FlatGrass' }); 1`); await A.p.waitForTimeout(300);
const sinEntrar = await A.ev(`({ sala: typeof SALA !== 'undefined' && !!SALA, dlg: !document.getElementById('cuDlg').classList.contains('oc') })`);
ok('entrar a un server sin sesión no entra y pide la cuenta', !sinEntrar.sala && sinEntrar.dlg, sinEntrar);
await A.ev(`cuCancelar(); 1`);
// ---- 2) entrar (web: ventanita) ----
const [pop] = await Promise.all([A.ctx.waitForEvent('page'), A.ev(`(() => { RB.el.querySelector('.cuPanel .cuGoogle').click(); return 1; })()`)]);
await pop.waitForLoadState(); const url = pop.url(), e = new URL(url).searchParams.get('e');
const pagina = await llamar(new URL(url).pathname + new URL(url).search);
const csp = pagina.r.headers.get('content-security-policy') || '', html = await pagina.r.text();
ok('la página de entrada: botón de Google con el client id, CSP estricta y sin marcos', pagina.st === 200 && html.includes(CLIENTE) && /script-src 'nonce-/.test(csp) && /frame-ancestors 'none'/.test(csp), { st: pagina.st, csp: csp.slice(0, 90) });
const esp = await A.ev(`({ espera: !!CU.espera, dlg: !!document.querySelector('#cuDlg:not(.oc) .cuGira') })`);
ok('mientras tanto el juego muestra que espera a Google', esp.espera && esp.dlg, esp);
await A.p.screenshot({ path: 'cuenta_espera.png' }); await pop.screenshot({ path: 'cuenta_pagina.png' });
// (tokens que no tienen que pasar)
const malos = [
  ['firma de otro', await token({ nonce: e }, otro)], ['otra app (aud)', await token({ nonce: e, aud: 'otra.apps.googleusercontent.com' })],
  ['vencido', await token({ nonce: e, exp: Math.floor(Date.now() / 1000) - 600 })], ['de otro pedido (nonce)', await token({ nonce: 'f'.repeat(64) })],
  ['emisor falso', await token({ nonce: e, iss: 'https://evil.example' })], ['basura', 'a.b.c']];
const rech = []; for (const [n, t] of malos) { const r = await llamar('/api/cuenta/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: t, e }) }); rech.push(n + ':' + r.st); }
ok('rechaza tokens falsos, de otra app, vencidos, de otro pedido o de otro emisor', rech.every((x) => /:401$/.test(x)), rech);
const robo = await llamar('/api/cuenta/listo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 'x'.repeat(43) }) });
ok('con sólo ver la dirección no se puede llevar la sesión', robo.st === 200 && robo.j && robo.j.espera && !robo.j.token, robo.j);
await pop.click('#gbtn');
const enPag = await pop.waitForFunction(() => /Juan Prueba/.test(document.body.textContent), null, { timeout: 15000 }).then(() => true, () => false).catch(() => true);
const entro = await esperar(A.p, `!!CU.token && !CU.espera`);
const yo = await A.ev(`({ token: CU.token.length, u: CU.u && CU.u.nombre, chip: (RB.el.querySelector('.cuChip') || {}).textContent, lista: !!RB.el.querySelector('#mpLista'), dlg: !document.getElementById('cuDlg').classList.contains('oc') })`);
ok('tocando el botón de Google la sesión llega sola al juego y aparece la lista de servers', enPag && entro && yo.token === 64 && yo.u === 'Juan Prueba' && /Juan/.test(yo.chip || '') && yo.lista && !yo.dlg, yo);
const dos = await llamar('/api/cuenta/listo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: await A.ev(`'x'`) }) });
const fila = db.prepare('SELECT COUNT(*) AS n FROM entradas').get();
ok('la sesión se entrega una sola vez (no queda esperando en la tienda)', fila.n === 0, fila);
// ---- 3) guardar con sesión: sube a la cuenta ----
await A.ev(`inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await esperar(A.p, `JUEGO.estado === 'juego'`, 60000); await A.p.waitForTimeout(1500);
await A.ev(`(() => { crearObjeto(DATA.menu[0].sub ? DATA.menu[0].sub[0].it[0] : 'Crate', vadd(JUG.pos, v3(2, 1, 0))); guardarConstruccion(); nocheProgreso(3); PREFS.gmod = Object.assign(PREFS.gmod || {}, { '106565409': { n: 'Nuke pack', img: '', mb: 1.5 } }); guardarPrefs(); cuSubir(); return 1; })()`);
await A.p.waitForTimeout(6000); await A.ev(`cuSubir(); 1`); await A.p.waitForTimeout(1500);
const nube = db.prepare("SELECT k, length(v) AS n FROM progreso").all().map((x) => x.k);
ok('lo guardado sube a la cuenta (construcción, noches, perfil con los addons)', nube.includes('jx_save_FlatGrass') && nube.includes('rb_fn') && nube.includes('cu:perfil'), nube);
// ---- 4) otro aparato (la app): entra con la misma cuenta y recibe todo ----
const B = await aparato(true);
const stubB = async () => { if (CARP) await B.ev(`gmBajar = async (wid, prog) => { const r = await fetch(${JSON.stringify(CARP)} + '/' + wid + '.gma'); const u = new Uint8Array(await r.arrayBuffer()); if (prog) prog(0.7, 'bajando'); return (await gmCacheGuardarGMA(String(wid), u)) || u; }; 1`); };
await stubB(); await B.ev(`cuentaEntrar(); 1`); await B.p.waitForTimeout(500);
const abierto = await B.ev(`window.__abierto || ''`);
ok('en la app, entrar abre el navegador del celular (con &app=1)', /\/api\/cuenta\/entrar\?e=[a-f0-9]{64}.*app=1/.test(abierto), abierto.slice(0, 120));
// (Android cierra el juego mientras se entra en el navegador: al volver a abrirlo sigue esperando)
await B.p.reload(); await B.p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await esperar(B.p, `!!CU.conf`, 30000); await stubB();
const sigue = await B.ev(`!!CU.espera`);
ok('si Android cierra el juego a la mitad, al volver sigue esperando la cuenta', sigue);
const pB = await B.ctx.newPage(); await pB.goto(abierto); await pB.click('#gbtn');
const volver = await pB.waitForSelector('a.b[href="jxmod://cuenta"]', { timeout: 15000 }).then(() => true, () => false);
ok('en la página, al terminar, el botón «Volver a JXMod» (vuelve a la app)', volver);
await pB.screenshot({ path: 'cuenta_pagina_listo.png' });
await esperar(B.p, `!!CU.token`); await B.p.waitForTimeout(2500);
const recibio = await B.ev(`({ save: !!localStorage.getItem('jx_save_FlatGrass'), fn: (JSON.parse(localStorage.getItem('rb_fn') || '{}').max) || 0, dlgMods: /addons/.test((document.querySelector('#cuDlg:not(.oc)') || {}).textContent || '') })`);
ok('el otro aparato recibe la construcción y las noches', recibio.save && recibio.fn === 4, recibio);
ok('y le ofrece bajar los addons de la cuenta que no tiene', recibio.dlgMods, recibio);
await B.p.screenshot({ path: 'cuenta_mods_celu.png' });
if (CARP) { await B.ev(`(() => { document.querySelector('#cuDlg [data-cu=bajar]').click(); return 1; })()`); const inst = await esperar(B.p, `GMOD.addons.has('106565409')`, 60000); ok('«Bajarlos» los pone en la cola y se instalan', inst); }
// ---- 5) el más nuevo gana ----
await B.ev(`localStorage.setItem('jx_save_FlatGrass', '[{"n":"nuevo","p":[0,0,0],"q":[0,0,0,1],"f":1}]'); cuSubir(); 1`); await B.p.waitForTimeout(2000);
await A.ev(`cuSincronizar(); 1`); await A.p.waitForTimeout(2500);
const gana = await A.ev(`localStorage.getItem('jx_save_FlatGrass')`);
ok('lo más nuevo de otro aparato le gana a lo viejo', /nuevo/.test(gana || ''), (gana || '').slice(0, 60));
// ---- 6) crear un server pide sesión (en la tienda) ----
const sinS = await llamar('/api/salas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'zzzz1111', n: 'x', m: 'FlatGrass' }) });
const tok = await A.ev(`CU.token`); const conS = await llamar('/api/salas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ id: 'zzzz2222', n: 'Server de prueba', m: 'FlatGrass', mo: 'Free' }) });
ok('crear un server: sin sesión 401, con sesión pasa', sinS.st === 401 && conS.st !== 401, { sin: sinS.st, con: conS.st, j: conS.j });
// ---- 7) cerrar sesión ----
await A.ev(`cuentaSalir(); 1`); await A.p.waitForTimeout(1500);
const fuera = await A.ev(`({ token: CU.token, guardado: localStorage.getItem('jx_cuenta') })`), yoT = await llamar('/api/cuenta/yo', { headers: { Authorization: 'Bearer ' + tok } });
ok('cerrar sesión borra la sesión acá y en la tienda', !fuera.token && !fuera.guardado && yoT.st === 401, { ...fuera, yo: yoT.st });
// ---- 8) sin sesión, guardar pide la cuenta y no guarda ----
await A.ev(`localStorage.removeItem('jx_save_FlatGrass'); guardarConstruccion(); 1`); await A.p.waitForTimeout(400);
const g = await A.ev(`({ dlg: /Google/.test((document.querySelector('#cuDlg:not(.oc)') || {}).textContent || ''), save: localStorage.getItem('jx_save_FlatGrass') })`);
ok('sin sesión, «Guardar construcción» pide iniciar sesión y no guarda', g.dlg && g.save === null, g);
await A.p.screenshot({ path: 'cuenta_guardar.png' });
// ---- 9) sin GOOGLE_CLIENT_ID: como antes ----
delete env.GOOGLE_CLIENT_ID;
const C = await aparato(false);
await C.ev(`inicioAccion('multi'); 1`); await C.p.waitForTimeout(400);
const libre = await C.ev(`({ chip: !!RB.el.querySelector('.cuChip'), lista: !!RB.el.querySelector('#mpLista'), puede: cuentaPuedeGuardar() })`);
const sinCfg = await llamar('/api/salas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'zzzz3333', n: 'Libre', m: 'FlatGrass', mo: 'Free' }) });
ok('sin configurar Google en la tienda: sin chip, multijugador y guardar como antes', !libre.chip && libre.lista && libre.puede && sinCfg.st !== 401, { ...libre, salas: sinCfg.st });
const e2 = [...A.err, ...B.err, ...C.err].filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
