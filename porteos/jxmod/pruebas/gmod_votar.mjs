// addons de GMod del server: Ana pide uno en el panel SM (categoría GMod del server) → a Beto y a Caro les llega el aviso
// → Beto lo toca y acepta → queda activo (mayoría): los tres lo bajan y lo montan; el que entra después también (lista
// retenida en la sala) y queda guardado en la tienda. Otro pedido que rechazan no se activa.
// uso: node gmod_votar.mjs URL_HTML [CARPETA_FOTOS]   (broker MQTT local, como red2.mjs; SIN_PUENTE=1: sin el worker ni el
// puente público, todo con el catálogo y el servidor de archivos de Steam)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http';
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad';
const req = createRequire(S + '/mc/broker/package.json');
const [, , html, fotos = '.'] = process.argv; const D = fotos + '/';
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' });
wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8898, '127.0.0.1', r));
// el puente /api/gmod/* con el código del worker y una base de datos en memoria (la tabla gm_sala)
const W = (await import('../tienda/worker.js')).default; globalThis.caches = globalThis.caches || { default: { match: async () => null, put: async () => {} } };
const FILAS = [];
const DB = { prepare: (sql) => { const st = { args: [], bind(...a) { st.args = a; return st; },
  async run() { if (/^INSERT OR IGNORE INTO gm_sala/.test(sql)) { const [sala, wid, nombre, fecha, ip] = st.args; if (!FILAS.some((f) => f.sala === sala && f.wid === wid)) FILAS.push({ sala, wid, nombre, fecha, ip }); } return {}; },
  async all() { if (/FROM gm_sala/.test(sql)) return { results: FILAS.filter((f) => f.sala === st.args[0]) }; return { results: [] }; },
  async first() { return { n: 0 }; } }; return st; } };
const envW = { DB };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const errs = [];
const abrir = async (n) => {
  const ctx = await b.newContext({ viewport: { width: 900, height: 506 } }), p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message));
  if (process.env.SIN_PUENTE) { await p.route(/\/api\/gmod\//, (rt) => rt.fulfill({ status: 404, body: 'no' })); await p.route(/cors\.eu\.org/, (rt) => rt.abort()); }
  else await p.route(/\/api\/gmod\//, async (rt) => { try { const r = await W.fetch(new Request(rt.request().url(), { method: rt.request().method(), body: rt.request().postData() || undefined, headers: { 'Content-Type': 'application/json' } }), envW, {}); await rt.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { await rt.fulfill({ status: 502, body: String(e) }); } });
  await p.goto(html + '?test&gfx=patata&broker=' + encodeURIComponent('ws://127.0.0.1:8898/mqtt')); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 }); return p;
};
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (p, c, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(p, c)) return true; await espera(250); } return false; };
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const entrar = (p, nom) => ev(p, `PREFS.nombre='${nom}'; PREFS.bienvenida = true; entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
const A = await abrir('A'); await entrar(A, 'Ana');
const B = await abrir('B'); await entrar(B, 'Beto');
const C = await abrir('C'); await entrar(C, 'Caro');
const verse = await Promise.all([A, B, C].map((p) => hasta(p, 'RED.on && RED.remotos.size === 2', 20000)));
ok('los tres están en la misma sala y se ven', verse.every(Boolean), verse);
// ---- Ana busca en "GMod del server" y pide la Nyan Gun ----
await ev(A, `smAbrir(); smAccion('f:gmod'); SMOD.q = 'nyan gun'; document.querySelector('#smQ').value = SMOD.q; smDibujar(); 1`);
const hay = await hasta(A, `!!document.querySelector('[data-sm="gms:123277559"]')`, 30000);
ok('el panel SM tiene la categoría GMod del server y el buscador del Workshop con Solicitar', hay, await ev(A, `GMS.items.slice(0, 4).map((x) => x.t)`));
const fotosOk = await hasta(A, `[...document.querySelectorAll('#smLista img')].slice(0, 6).every((i) => i.complete && i.naturalWidth > 0)`, 15000);
ok("las fotos de los addons se ven en la lista", fotosOk);
await A.screenshot({ path: D + 'gmod_srv_panel.png' });
await A.click('[data-sm="gms:123277559"]');
const noti = await Promise.all([B, C].map((p) => hasta(p, `!!document.querySelector('#gmNotis .gmNoti')`, 10000)));
ok('a los demás les llega el aviso', noti.every(Boolean), noti);
// ---- Beto toca el aviso y acepta ----
await B.click('#gmNotis .gmNoti .gmNotiCab'); await espera(300);
await B.screenshot({ path: D + 'gmod_srv_aviso.png' });
const vis = await ev(B, `(() => { const n = document.querySelector('#gmNotis .gmNoti'); return { abierta: n.classList.contains('abierta'), texto: n.querySelector('.gmNotiCab b').textContent, botones: n.querySelectorAll('[data-gms^="si:"], [data-gms^="no:"]').length }; })()`);
ok('tocarlo muestra el addon con Aceptar y Rechazar', vis.abierta && vis.botones === 2 && /Ana/.test(vis.texto), vis);
await B.click('#gmNotis [data-gms^="si:"]');
// mayoría (Ana y Beto, 2 de 3): activo; los tres lo bajan y lo montan
const mont = await Promise.all([A, B, C].map((p) => hasta(p, `GMOD.addons.has('123277559') && GMS.lista.has('123277559')`, 90000)));
ok('con la mayoría queda activo y los tres lo bajan y lo montan (con su Lua)', mont.every(Boolean), mont);
const armaC = await ev(C, `(() => { const A2 = GMOD.addons.get('123277559'); return { sweps: A2 && A2.sweps, menu: (DATA.menu.find((c) => c.n === 'GMod') || { sub: [] }).sub.flatMap((s) => s.it).filter((x) => /^gmswep:/.test(x)) }; })()`);
ok('Caro (que no votó) también tiene el arma del addon en su menú', armaC.sweps && armaC.sweps.includes('weapon_nyangun') && armaC.menu.length > 0, armaC);
await C.screenshot({ path: D + 'gmod_srv_activo.png' });
if (!process.env.SIN_PUENTE) ok('queda guardado en la tienda para ese server', FILAS.some((f) => f.wid === '123277559' && f.sala === 'f_FlatGrass_1'), FILAS.map((f) => [f.sala, f.wid, f.nombre]));
// ---- un pedido que rechazan ----
await ev(A, `gmsSolicitar({ id: '104607228', n: 'Fire Extinguisher', mb: 1 }); 1`);
await Promise.all([B, C].map((p) => hasta(p, `[...GMS.votos.values()].some((v) => v.w === '104607228')`, 10000)));
await ev(B, `gmsVotar([...GMS.votos.values()].find((v) => v.w === '104607228').v, false); 1`);
await ev(C, `gmsVotar([...GMS.votos.values()].find((v) => v.w === '104607228').v, false); 1`);
const rech = await Promise.all([A, B, C].map((p) => hasta(p, `(() => { const v = [...GMS.votos.values()].find((v) => v.w === '104607228'); return v && v.fin && !v.ok; })()`, 10000)));
await espera(1500);
const nada = await Promise.all([A, B, C].map((p) => ev(p, `!GMS.lista.has('104607228') && !GMOD.addons.has('104607228')`)));
ok('si la mayoría rechaza, no se activa en nadie', rech.every(Boolean) && nada.every(Boolean), { rech, nada });
// ---- el que entra después lo recibe solo (lista retenida en la sala) ----
const Dp = await abrir('D'); await entrar(Dp, 'Dani');
const tarde = await hasta(Dp, `GMS.lista.has('123277559') && GMOD.addons.has('123277559')`, 60000);
ok('Dani, que entra después, recibe la lista del server y lo monta', tarde, await ev(Dp, `[...GMS.lista.keys()]`));
// ---- "para siempre": Ana sale del todo y vuelve con otra sesión ----
await A.context().close();
const A2 = await abrir('A2'); await entrar(A2, 'Ana');
const vuelve = await hasta(A2, `GMS.lista.has('123277559') && GMOD.addons.has('123277559')`, 60000);
ok('al volver a entrar sigue activo en ese server', vuelve);
// ---- salir de la sala: los addons del server se desmontan (no estaban instalados por ella) ----
const sale = await ev(A2, `(async () => { redSalir(); SALA = null; await new Promise((r) => setTimeout(r, 300)); return { montado: GMOD.addons.has('123277559'), lista: GMS.lista.size }; })()`);
ok('al irse del server, sus addons se desmontan', !sale.montado, sale);
ok('sin errores de JS', errs.length === 0, errs.slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close(); srv.close(); process.exit(0);
