// El HTML suelto que se actualiza solo (juego/suelto.js), abierto desde el disco como lo abre un jugador:
//  1. abre el juego de adentro (3.9.7) y, buscando, baja la 3.9.8 de la web (sin el paquete: es el mismo) y avisa;
//     «Ponerla ahora» la pone en el momento;
//  2. al salir y volver a entrar arranca la 3.9.8 (sin el pedido del código), entra a un mapa y vuelve a buscar (al día);
//  3. sin internet, la 3.9.8 guardada arranca igual;
//  4. si lo guardado se rompió, recarga con la de adentro y la vuelve a bajar;
//  5. si el paquete cambió (A2), lo baja, lo comprueba y la 3.9.8 arranca con él;
//  6. un HTML más nuevo que lo guardado (A3, 3909) arranca el suyo y borra lo guardado; sin errores de JS.
// Se arma así (clave de prueba, la web en http://localhost:8961/web/; ver LEEME, «El HTML suelto que se actualiza solo»):
//   JX_SUELTO_PRUEBA=1 SUELTO=1 SUELTO_BASES=http://localhost:8961/web/ python3 -I armar.py PAQUETE CARPETA/A.html
//   (A2: además SUELTO_PKH_PRUEBA=otro; A3: además JX_COD=3909)
//   la web: JX_VERSION 3.9.8, PK_BIN=1 APP_WEB=1 armar.py → CARPETA/web/index.html; JX_SUELTO_PRUEBA=1 JX_COD=3908
//   codigo_web.mjs CARPETA/web --lugar http://localhost:8961/web/ --suelto; web_app.py; version.json {"codigo":3908,...}
// uso: node html_suelto.mjs CARPETA
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const D = path.resolve(process.argv[2] || '/tmp/claude-0/suelto_t');
let ok = 0, mal = 0; const chk = (c, m, x) => { if (c) ok++; else mal++; console.log((c ? 'OK    ' : 'FALLA ') + m + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
// la web, con CORS (el HTML abierto desde el disco pide desde «null»), anotando lo que se pide
const pedidos = [];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), f = path.join(D, decodeURIComponent(u.pathname)); pedidos.push(u.pathname);
  if (!f.startsWith(D) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); return res.end('no'); }
  res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(8961);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, locale: 'es-AR' });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const err = [];
// (lo que no es del juego: YouTube, y los fondos animados, que desde el disco no se pueden pedir —quedan las fotos—)
const ajeno = (t) => /youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com|fondos\/|ERR_FAILED|ERR_INTERNET_DISCONNECTED|Cache|sin conexión|No se pudo|mqtt|wss?:|ERR_NAME|net::/i.test(t);
async function abrir(html) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => err.push(html + ': ' + e.message.slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !ajeno(m.text())) err.push(html + ': ' + m.text().slice(0, 200)); });
  await p.goto('file://' + path.join(D, html));
  await p.waitForFunction(() => window.__listo, null, { timeout: 180000, polling: 250 });
  await p.waitForTimeout(800);
  return p;
}
const ev = (p, s) => p.evaluate((x) => window.__ev(x), s);
const estado = (p) => p.evaluate(() => ({ usar: window.__jxSuelto.usar, estado: window.__jxSuelto.estado, ver: window.__ev('JX_VERSION'), meta: JSON.parse(localStorage.getItem('jx_suelto') || 'null'), plaintext: !!document.querySelector('plaintext'), puerta: !!document.getElementById('jxPuerta'), boton: !!document.getElementById('jxAct') }));
async function buscarHasta(p, quiero) {
  // (además de la que se pide acá, el HTML busca solo a los 20 s: si justo está buscando, se espera a que termine)
  for (let i = 0; i < 60; i++) { const e = await p.evaluate(() => window.__jxSuelto.buscar(true)); if (e === quiero || /^falló|distinto|no está/.test(e)) return e; await p.waitForTimeout(1000); }
  return p.evaluate(() => window.__jxSuelto.estado);
}
async function mapa(p) {
  await ev(p, `idiomaAplicar('es'); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000, polling: 250 });
  return ev(p, `({ estado: JUEGO.estado, suelo: !!JUG.suelo, objetos: ENTS.lista.length })`);
}
const borrarTodo = (p) => p.evaluate(() => new Promise((ok) => { localStorage.removeItem('jx_suelto'); sessionStorage.clear(); const r = indexedDB.deleteDatabase('jxmod_suelto'); r.onsuccess = r.onerror = r.onblocked = () => ok(1); }));

// 1. el de adentro, y baja la nueva
let p = await abrir('A.html');
await borrarTodo(p); await p.close(); p = await abrir('A.html');
let e = await estado(p);
chk(e.usar === false && e.ver === '3.9.7' && !e.meta, '1. abre el juego de adentro (3.9.7)', e);
pedidos.length = 0;
const r1 = await buscarHasta(p, 'lista');
const pid = pedidos.map((x) => x.replace('/web/', ''));
chk(r1 === 'lista' && ['version.json', 'suelto.json', 'juego.bin', 'index.html'].every((x) => pid.includes(x)) && !pid.includes('pk.bin'), '1. baja la 3.9.8: index.html y juego.bin, sin el paquete (es el mismo)', { r1, pedidos: [...new Set(pid)] });
e = await estado(p);
const cartel = await p.evaluate(() => { const c = document.getElementById('jxSuelto'); return c ? c.textContent : null; });
chk(e.meta && e.meta.cod === 3908 && e.meta.listo && /3\.9\.8 ya se bajó/.test(cartel || ''), '1. queda lista y avisa', { meta: e.meta, cartel });
await p.screenshot({ path: path.join(D, 'suelto_aviso.jpg'), quality: 80, type: 'jpeg' });
// «Ponerla ahora»: recarga y arranca la nueva en el momento
await Promise.all([p.waitForNavigation({ timeout: 60000 }), p.click('#jxSuelto button:not([aria-label])')]);
await p.waitForFunction(() => window.__listo, null, { timeout: 180000, polling: 250 });
e = await estado(p);
chk(e.usar === true && e.ver === '3.9.8', '1. «Ponerla ahora» la pone en el momento', { usar: e.usar, ver: e.ver });
await p.close();

// 2. salir y entrar: la 3.9.8
p = await abrir('A.html'); e = await estado(p);
chk(e.usar === true && e.estado === 'guardada' && e.ver === '3.9.8' && !e.plaintext && !e.puerta && !e.boton, '2. al volver a entrar arranca la 3.9.8 (sin pedir código)', e);
// (el aviso sale a los 6 s de abrir y dura 6 s)
const ya = await p.waitForFunction(() => { const c = document.getElementById('jxSuelto'); return c && c.textContent; }, null, { timeout: 15000, polling: 200 }).then((h) => h.jsonValue(), () => null);
await p.screenshot({ path: path.join(D, 'suelto_398.jpg'), quality: 80, type: 'jpeg' });
const m2 = await mapa(p);
chk(m2.estado === 'juego' && m2.suelo, '2. entra a un mapa con la 3.9.8', m2);
const r2 = await buscarHasta(p, 'al día');
chk(/Ya tenés JXMod 3\.9\.8/.test(ya || '') && r2 === 'al día', '2. avisa «Ya tenés JXMod 3.9.8» y sigue buscando (al día)', { ya, r2 });
await p.close();

// 3. sin internet
await ctx.setOffline(true);
p = await abrir('A.html'); e = await estado(p);
const m3 = await mapa(p);
chk(e.usar && e.ver === '3.9.8' && m3.estado === 'juego', '3. sin internet arranca la 3.9.8 guardada y entra a un mapa', { ver: e.ver, m3 });
await p.close(); await ctx.setOffline(false);

// 4. lo guardado se rompió
p = await abrir('A.html');
await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open('jxmod_suelto', 1); r.onsuccess = () => { const tx = r.result.transaction('d', 'readwrite'); tx.objectStore('d').delete('v'); tx.oncomplete = () => { r.result.close(); ok(1); }; }; }));
await p.close();
p = await abrir('A.html'); e = await estado(p);
chk(e.usar === false && e.ver === '3.9.7' && !e.meta, '4. con lo guardado roto, recarga con la de adentro', e);
const r4 = await buscarHasta(p, 'lista');
chk(r4 === 'lista', '4. y la vuelve a bajar', r4);
await p.close();

// 5. el paquete cambió (A2: su paquete «no es» el de la web)
p = await abrir('A2.html'); await borrarTodo(p); await p.close();
p = await abrir('A2.html'); pedidos.length = 0;
const r5 = await buscarHasta(p, 'lista');
chk(r5 === 'lista' && pedidos.some((x) => x.endsWith('/pk.bin')), '5. si el paquete cambió, lo baja (y lo comprueba)', { r5, pk: pedidos.filter((x) => x.endsWith('pk.bin')).length });
await p.close();
p = await abrir('A2.html'); e = await estado(p);
const m5 = await mapa(p);
chk(e.usar && e.ver === '3.9.8' && m5.estado === 'juego', '5. la 3.9.8 arranca con el paquete bajado y entra a un mapa', { ver: e.ver, m5 });
await p.close();

// 6. un HTML más nuevo que lo guardado
p = await abrir('A3.html'); e = await estado(p);
const r6 = await buscarHasta(p, 'al día');
const quedo = await p.evaluate(() => new Promise((ok) => setTimeout(() => { const r = indexedDB.open('jxmod_suelto', 1); r.onsuccess = () => { const q = r.result.transaction('d').objectStore('d').getAllKeys(); q.onsuccess = () => { r.result.close(); ok(q.result); }; }; }, 5500)));
chk(e.usar === false && !e.meta && r6 === 'al día' && quedo.length === 0, '6. un HTML más nuevo arranca el suyo y borra lo guardado', { usar: e.usar, meta: e.meta, r6, quedo });
await p.close();

chk(!err.length, 'sin errores de JS', err.slice(0, 6));
console.log(`\n${ok}/${ok + mal}`);
await b.close(); srv.close();
process.exit(mal ? 1 : 0);
