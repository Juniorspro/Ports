// Importar personaje en multijugador: un personaje importado de un archivo se ve en la sala como las skins del Workshop.
// Ana importa un modelo (rig automático) y se lo pone; arma un server. Beto entra y lo ve (no lo tiene: se lo pide a Ana y
// le llega de a pedazos por la sala); Caro entra más tarde y también lo ve. Se mide cuánto pesa y cuánto tarda en llegar,
// que lo que llegó sea el mismo personaje (la huella) y que no quede entre los importados de Beto.
// uso: BROKER_DIR=carpeta-con-mc/broker node red_importado.mjs URL_HTML URL_MODELOS [CARPETA_FOTOS] [archivos=mh_a/mh_a.obj+mh_a/mh_a.mtl]
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const [, , html, MOD, D = '/tmp/claude-0/redimp', ARCH = 'mh_a/mh_a.obj+mh_a/mh_a.mtl'] = process.argv; fs.mkdirSync(D, { recursive: true });
const PUERTO = +(process.env.PUERTO || 8919);
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
// Ana: importa el personaje (como «Guardar y usar»), se lo pone y arma el server
const A = await abrir('Ana'); await prep(A, 'Ana');
const ana = await J(A, `(async () => { const fs = []; for (const u of ${JSON.stringify(ARCH.split('+').map((f) => MOD + '/' + f))}) fs.push(new File([await (await fetch(u)).arrayBuffer()], u.split('/').pop()));
  const ses = await pjiProcesar(fs); pjiSesArmar(ses); PJI.ses = ses; PJI.ui = { paso: 3 }; ses.nombre = 'Importado de Ana';
  await pjiGuardarSes(); return { skin: PREFS.skin, id: pjiIdDe(PREFS.skin), kb: PJI.lista[0] && PJI.lista[0].kb }; })()`);
ok('Ana importó el personaje y lo tiene puesto', !!ana.id, ana);
await ev(A, `(() => { conectarMultijugador(); crearServidor({ n: 'Prueba importado', pw: '', m: 'FlatGrass', mo: 'Free', pvp: 0, rpg: 1, nb: 0, mp: 1000, mv: 40 }); return 1; })()`);
const anaListo = await hasta(A, `RED.on && JUEGO.estado === 'juego' && !!JUG.cuerpo`, 120);
const sala = await J(A, `(() => { const s = Object.assign({}, SALA); delete s.clave; return s; })()`);
ok('Ana en su server con el importado puesto', anaListo && (await J(A, `JUG.cuerpo && JUG.cuerpo.skin`)) === ana.skin);
// Beto y Caro entran (Caro, 8 s después) y miran a Ana
const entra = async (n) => { const P = await abrir(n); await prep(P, n); await ev(P, `(() => { conectarMultijugador(); entrarSala(${JSON.stringify(sala)}, ''); window.__t0 = performance.now(); return 1; })()`); await hasta(P, `RED.on && JUEGO.estado === 'juego'`, 120); return P; };
const veAna = (P) => `(() => { const r = [...RED.remotos.values()].find((x) => x.nombre === 'Ana' || (x.P && x.P.nombre === 'Ana')); if (r && r.P) { const d = vsub(r.P.pos, JUG.pos); JUG.yaw = Math.atan2(d.x, d.z); } return !!(r && r.skin === '${ana.skin}' && r.P && r.P.gmp && r.P.gmp.def && r.P.gmp.def.pji === '${ana.id}'); })()`;
const B = await entra('Beto'); const tB = Date.now();
const bVe = await hasta(B, veAna(B), 90); const segB = (Date.now() - tB) / 1000;
await espera(6000);
const C = await entra('Caro'); const tC = Date.now();
const cVe = await hasta(C, veAna(C), 90); const segC = (Date.now() - tC) / 1000;
const info = async (P) => J(P, `({ remotos: [...RED.remotos.values()].map((r) => [r.nombre, r.skin, !!(r.P && r.P.gmp && r.P.gmp.def)]), mios: PJI.lista.length, tiene: PJI.packs.has('${ana.id}'), huella: PJI.packs.has('${ana.id}') ? pjiHuella(PJI.packs.get('${ana.id}')) : null })`);
const iB = await info(B), iC = await info(C);
ok('Beto ve a Ana con el personaje importado (le llegó de a pedazos)', bVe && iB.huella === ana.id, { seg: segB, kb: ana.kb, ...iB });
ok('Caro, que entró después, también lo ve', cVe && iC.huella === ana.id, { seg: segC, ...iC });
ok('a Beto y a Caro no les queda entre sus importados (es de visita)', iB.mios === 0 && iC.mios === 0, [iB.mios, iC.mios]);
// fotos desde Beto: Ana delante
await ev(B, `(() => { const r = [...RED.remotos.values()].find((x) => x.skin === '${ana.skin}'); if (r) { JUG.pos.set(r.P.pos.x - 2.4, r.P.pos.y + 0.2, r.P.pos.z); JUG.yaw = Math.PI / 2; JUG.pitch = 0.12; } return 1; })()`).catch(() => {});
await espera(2500); await B.screenshot({ path: D + '/beto_ve_a_ana_importada.jpg', type: 'jpeg', quality: 80 });
ok('sin errores de JS', !errs.length, errs.slice(0, 5));
for (const b of navs) await b.close(); srv.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(0);
