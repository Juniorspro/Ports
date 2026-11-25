// Props importados en multijugador (propimportar.js): Ana importa un modelo (Duck.glb) como prop, arma un server y lo pone
// delante. Beto entra y lo ve: no lo tiene, se lo pide a Ana y le llega de a pedazos por la sala, se arma y aparece donde
// está el de Ana. Se mide cuánto pesa y cuánto tarda, que sea el mismo (la huella) y que no quede entre los props de Beto.
// uso: BROKER_DIR=carpeta-con-mc/broker node red_prop.mjs URL_HTML URL_MODELOS [CARPETA_FOTOS] [archivo=Duck.glb]
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const [, , html, MOD, D = '/tmp/claude-0/redprop', ARCH = 'Duck.glb'] = process.argv; fs.mkdirSync(D, { recursive: true });
const PUERTO = +(process.env.PUERTO || 8921);
// (aedes 1.x: Aedes.createBroker(); las versiones viejas exportaban la función)
const AE = req('aedes'), aedes = typeof AE === 'function' ? AE() : await AE.Aedes.createBroker(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(PUERTO, '127.0.0.1', r));
const errs = [], navs = [];
const abrir = async (n) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  navs.push(b);
  const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_|CORS|net::|aborted/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto(html + '?test&broker=ws://127.0.0.1:' + PUERTO + '/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await p.evaluate(() => window.__ev(`cuentaPedir = () => true; cuentaFaltaPara = () => false; if (typeof cuPedirAlAbrir === 'function') cuPedirAlAbrir.hecho = true; 1`));
  return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s), J = async (P, s) => JSON.parse(await ev(P, `(async () => JSON.stringify(await (${s})))()`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 2; i++) { if (await J(P, cond).catch(() => false)) return true; await espera(500); } return false; };
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const prep = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.tutVisto=true; PREFS.gfx='patata'; GFX.auto=false; aplicarGfx(); audioIniciar(); 1`);
// Ana: importa el prop, arma el server y lo pone delante
const A = await abrir('Ana'); await prep(A, 'Ana');
const ana = await J(A, `(async () => { const fs = [new File([await (await fetch(${JSON.stringify(MOD + '/' + ARCH)})).arrayBuffer()], ${JSON.stringify(ARCH)})];
  const L = await priLeer(fs), m = await priEmpacar(L, 'Pato de Ana', 0.8); return { id: m.id, kb: Math.round(PRI.packs.get(m.id).length / 1024) }; })()`);
ok('Ana importó el prop', !!ana.id, ana);
await ev(A, `(() => { conectarMultijugador(); crearServidor({ n: 'Prueba prop', pw: '', m: 'FlatGrass', mo: 'Free', pvp: 0, rpg: 1, nb: 0, mp: 1000, mv: 40 }); return 1; })()`);
const anaListo = await hasta(A, `RED.on && JUEGO.estado === 'juego' && !!JUG.cuerpo`, 120);
const sala = await J(A, `(() => { const s = Object.assign({}, SALA); delete s.clave; return s; })()`);
await J(A, `new Promise((ok) => { JUG.yaw = 0; JUG.pitch = 0.3; spawnElegir('Props', 'pri:${ana.id}'); setTimeout(() => ok(1), 1500); })`);
const puesto = await J(A, `OBJS.some((o) => !o.remoto && o.nombre === 'pri:${ana.id}')`);
ok('Ana en su server con el prop puesto', anaListo && puesto);
// Beto entra y lo busca
const B = await abrir('Beto'); await prep(B, 'Beto');
await ev(B, `(() => { conectarMultijugador(); entrarSala(${JSON.stringify(sala)}, ''); return 1; })()`); await hasta(B, `RED.on && JUEGO.estado === 'juego' && !!JUG.cuerpo`, 120);
const tB = Date.now();
const bVe = await hasta(B, `[...RED.objs.values()].some((o) => o.nombre === 'pri:${ana.id}')`, 90); const segB = (Date.now() - tB) / 1000;
const iB = await J(B, `(() => { const o = [...RED.objs.values()].find((x) => x.nombre === 'pri:${ana.id}'); const a = o ? o.b.pos : null; return { tiene: PRI.packs.has('${ana.id}'), huella: PRI.packs.has('${ana.id}') ? pjiHuella(PRI.packs.get('${ana.id}')) : null, mios: PRI.lista.length, pos: a ? [+a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2)] : null }; })()`);
const pA = await J(A, `(() => { const o = OBJS.find((x) => !x.remoto && x.nombre === 'pri:${ana.id}'); return o ? [+o.b.pos.x.toFixed(2), +o.b.pos.y.toFixed(2), +o.b.pos.z.toFixed(2)] : null; })()`);
ok('Beto ve el prop de Ana (le llegó de a pedazos) donde lo puso ella', bVe && iB.huella === ana.id && iB.pos && pA && Math.hypot(iB.pos[0] - pA[0], iB.pos[2] - pA[2]) < 0.6, { seg: segB, kb: ana.kb, ...iB, ana: pA });
ok('a Beto no le queda entre sus props importados (es de visita)', iB.mios === 0, iB.mios);
await ev(B, `(() => { const o = [...RED.objs.values()].find((x) => x.nombre === 'pri:${ana.id}'); if (o) { const d = vsub(o.b.pos, JUG.pos); d.y = 0; const l = d.len(); JUG.pos.set(o.b.pos.x - d.x / l * 2.5, JUG.pos.y, o.b.pos.z - d.z / l * 2.5); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = 0.3; } return 1; })()`).catch(() => {});
await espera(2500); await B.screenshot({ path: D + '/beto_ve_el_prop.jpg', type: 'jpeg', quality: 80 });
ok('sin errores de JS', !errs.length, errs.slice(0, 5));
for (const b of navs) await b.close(); srv.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(R.every(Boolean) ? 0 : 1);
