// Volver al mismo server (Discord, 3.1: «cuando te desconectas del server y vuelves a conectarte apareces en otro lugar»).
// Dos jugadores (Ana y Beto) en FlatGrass con un broker local. Ana se va a un lugar lejos de la aparición y:
//  1. se le corta internet 20 s: sigue donde estaba; para Beto queda quieta donde se cortó (no se hunde ni sigue de
//     largo) y al volver la ve donde está;
//  2. sale al menú y vuelve a entrar al mismo server: aparece donde estaba, mirando para el mismo lado, y Beto la ve ahí;
//  3. se le cierra la app (se cae la página) y vuelve con otro número: aparece donde estaba y Beto ve UNA sola Ana (sin
//     fantasma) donde está;
//  4. vuelve después de más de 5 minutos: aparece en la aparición del mapa;
//  5. donde estaba ahora está parado Beto: aparece al lado, en un lugar libre (no adentro de Beto, y sin empujarlo);
//  6. donde estaba, Beto puso un cajón: no queda adentro del cajón (queda arriba o al lado), con piso abajo;
//  7. lo guardado era de otro mapa: aparece en la aparición del mapa de este server;
//  8. sin errores de JS.
// uso: node red_volver.mjs URL_HTML   (BROKER_DIR: carpeta con mc/broker —aedes + ws—)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http';
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad';
const req = createRequire(S + '/mc/broker/package.json');
const [, , URLH] = process.argv, PUERTO = +(process.env.PUERTO_BROKER || 18955);
const AM = req('aedes'), aedes = typeof AM === 'function' ? AM() : AM.Aedes.createBroker ? await AM.Aedes.createBroker() : new AM.Aedes(); const { WebSocketServer, createWebSocketStream } = req('ws');
const fuera = new Set();
aedes.authenticate = (cl, u, pw, cb) => { for (const x of fuera) if (cl.id.includes(x)) return cb(Object.assign(new Error('fuera'), { returnCode: 3 }), false); cb(null, true); };
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' });
wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(PUERTO, '127.0.0.1', r));
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const errs = [];
const abrir = async (n, ctx0) => {
  const ctx = ctx0 || await b.newContext({ viewport: { width: 640, height: 360 } });
  if (!ctx0) await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 150)));
  await p.goto(URLH + '?test&gfx=patata&broker=' + encodeURIComponent('ws://127.0.0.1:' + PUERTO + '/mqtt')); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  return p;
};
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const SALA = `SALAS_OF.find((s) => s.m === 'FlatGrass')`;
// (entra y espera a que se asiente: en la versión nueva, que termine de revisar su lugar —9 s de juego—; en la de antes, 5 s)
const entrar = async (p) => { await ev(p, `entrarSala(${SALA}); 1`); await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && RED.on`), null, { timeout: 120000 });
  await p.waitForFunction(() => window.__ev(`!RED.lugar || (RED.lugar.mando && !RED.lugar.revisarT)`), null, { timeout: 180000 }).catch(() => {}); await espera(2500); };
const yo = (p) => ev(p, `JSON.stringify({ id: RED.ID, p: [JUG.pos.x, JUG.pos.y, JUG.pos.z], yaw: JUG.yaw, metido: typeof lugarMetido === 'function' ? +lugarMetido(JUG.pos).toFixed(3) : -1, piso: typeof lugarPiso === 'function' ? lugarPiso(JUG.pos) !== null : null, spawn: [MUNDO.spawns[0].x, MUNDO.spawns[0].y, MUNDO.spawns[0].z] })`).then(JSON.parse);
const anas = (p) => ev(p, `JSON.stringify([...RED.remotos.values()].filter((r) => r.nombre === 'Ana').map((r) => ({ id: r.id, p: [r.pos.x, r.pos.y, r.pos.z] })))`).then(JSON.parse);
const dh = (a, c) => Math.hypot(a[0] - c[0], a[2] - c[2]);
let A = await abrir('A'); await ev(A, `PREFS.nombre = 'Ana'; 1`); await entrar(A);
const B = await abrir('B'); await ev(B, `PREFS.nombre = 'Beto'; 1`); await entrar(B);
// Ana se va lejos de la aparición y se queda mirando a un lado
const ir = `(() => { const s = MUNDO.spawns[0]; JUG.pos.set(s.x + 23, s.y + 1.2, s.z - 17); JUG.vel.set(0, 0, 0); JUG.yaw = 1.1; return 1; })()`;
await ev(A, ir); await espera(3500);
const a0 = await yo(A); const lugar = a0.p;
// ---- 1: corte de red ----
fuera.add(a0.id); for (const c of Object.values(aedes.clients)) if (c.id.includes(a0.id)) c.conn.destroy();
await espera(1500); const g0 = await anas(B); await espera(8000); const g1 = await anas(B);
fuera.delete(a0.id); await A.waitForFunction(() => window.__ev(`RED.on`), null, { timeout: 60000 }); await espera(4000);
const a1 = await yo(A), g2 = await anas(B);
ok('1. corte de red de 20 s: Ana sigue donde estaba; Beto la ve quieta durante el corte y después donde está',
  dh(a1.p, lugar) < 0.5 && (!g1.length || (g0.length && Math.abs(g1[0].p[1] - g0[0].p[1]) < 0.3 && dh(g1[0].p, g0[0].p) < 0.3)) && g2.length === 1 && dh(g2[0].p, a1.p) < 1,
  { ana: a1.p.map((x) => +x.toFixed(2)), betoDurante: [g0, g1].map((g) => g.map((r) => r.p.map((x) => +x.toFixed(2)))), betoDespues: g2.map((r) => r.p.map((x) => +x.toFixed(2))) });
// ---- 2: al menú y de vuelta ----
await ev(A, `irMenuPrincipal(); 1`); await espera(6000); await entrar(A);
const a2 = await yo(A), g3 = await anas(B);
ok('2. sale al menú y vuelve: aparece donde estaba, mirando igual, y Beto la ve ahí', dh(a2.p, lugar) < 0.5 && Math.abs(a2.yaw - 1.1) < 0.05 && g3.length === 1 && dh(g3[0].p, a2.p) < 1,
  { dist: +dh(a2.p, lugar).toFixed(2), yaw: +a2.yaw.toFixed(2), beto: g3.map((r) => +dh(r.p, a2.p).toFixed(2)) });
// ---- 3: se cae la app y vuelve con otro número ----
const ctxA = A.context(); { const s = await ctxA.newCDPSession(A); s.send('Page.crash').catch(() => {}); } await espera(1500); await Promise.race([A.close().catch(() => {}), espera(3000)]);   // (Page.crash no contesta: se cae la página)
A = await abrir('A2', ctxA); await ev(A, `PREFS.nombre = 'Ana'; 1`); await entrar(A);
const a3 = await yo(A); const g4 = []; for (let i = 0; i < 3; i++) { g4.push(await anas(B)); await espera(1000); }
ok('3. se cae la app y vuelve con otro número: aparece donde estaba y Beto ve una sola Ana (sin fantasma), donde está',
  a3.id !== a0.id && dh(a3.p, lugar) < 1 && g4.every((g) => g.length === 1 && g[0].id === a3.id && dh(g[0].p, a3.p) < 1),
  { idAntes: a0.id, idAhora: a3.id, dist: +dh(a3.p, lugar).toFixed(2), beto: g4.map((g) => g.map((r) => r.id.slice(0, 4) + '@' + +dh(r.p, a3.p).toFixed(2))) });
// ---- 4: más de 5 minutos ----
await ev(A, `irMenuPrincipal(); const L = JSON.parse(localStorage.getItem('jx_red_lugar') || 'null'); if (L) { L.t -= 6 * 60e3; localStorage.setItem('jx_red_lugar', JSON.stringify(L)); } 1`); await espera(3000); await entrar(A);
const a4 = await yo(A);
ok('4. vuelve después de más de 5 minutos: aparece en la aparición', dh(a4.p, a4.spawn) < 2.5 && dh(a4.p, lugar) > 10, { aSpawn: +dh(a4.p, a4.spawn).toFixed(2), aLugar: +dh(a4.p, lugar).toFixed(2) });
// ---- 5: Beto parado donde estaba Ana ----
await ev(A, ir); await espera(3000); await ev(A, `irMenuPrincipal(); 1`); await espera(1500);
await ev(B, `JUG.pos.set(${lugar[0]}, ${lugar[1]}, ${lugar[2]}); JUG.vel.set(0, 0, 0); 1`); await espera(3000); const b5a = JSON.parse(await ev(B, `JSON.stringify([JUG.pos.x, JUG.pos.y, JUG.pos.z])`));
await entrar(A); const a5 = await yo(A), b5 = JSON.parse(await ev(B, `JSON.stringify([JUG.pos.x, JUG.pos.y, JUG.pos.z])`));
ok('5. donde estaba ahora está Beto: Ana aparece al lado (libre, con piso) y a Beto no lo empuja', dh(a5.p, b5) >= 0.9 && dh(b5, b5a) < 0.3 && dh(a5.p, lugar) < 4 && a5.metido < 0.05 && a5.piso, { aBeto: +dh(a5.p, b5).toFixed(2), betoSeMovio: +dh(b5, b5a).toFixed(2), aLugar: +dh(a5.p, lugar).toFixed(2), metido: a5.metido });
// ---- 6: un cajón de Beto donde estaba Ana ----
await ev(B, `JUG.pos.set(${lugar[0]} - 8, ${lugar[1]}, ${lugar[2]}); 1`);
await ev(A, ir); await espera(3000); await ev(A, `irMenuPrincipal(); 1`); await espera(1500);
await ev(B, `(() => { const o = crearObjeto('Crate', v3(${lugar[0]}, ${lugar[1]} - 0.4, ${lugar[2]}), new Quat()); o.b.frozen = true; redObjeto(); window.__caja = o; return 1; })()`); await espera(3000);
await ev(A, `entrarSala(${SALA}); 1`); const traza6 = []; for (let i = 0; i < 26; i++) { await espera(500); traza6.push(await ev(A, `JUEGO.estado === 'juego' ? [+(JUG.pos.y - ${lugar[1]}).toFixed(2), +Math.hypot(JUG.pos.x - ${lugar[0]}, JUG.pos.z - ${lugar[2]}).toFixed(2), RED.on ? 1 : 0, RED.lugar && RED.lugar.revisarT ? 1 : 0] : 0`)); }
const a6 = await yo(A), c6 = JSON.parse(await ev(A, `JSON.stringify([...RED.objs.values()].filter((o) => o.nombre === 'Crate').map((o) => [o.b.pos.x, o.b.pos.y, o.b.pos.z]))`));
ok('6. donde estaba hay un cajón de Beto: no queda adentro (arriba o al lado), con piso', c6.length === 1 && a6.metido < 0.05 && a6.piso && dh(a6.p, lugar) < 4, { metido: a6.metido, alto: +(a6.p[1] - lugar[1]).toFixed(2), aLugar: +dh(a6.p, lugar).toFixed(2), cajon: c6, traza: traza6.filter((x, i) => i % 3 === 0) });
// ---- 7: lo guardado es de otro mapa ----
await ev(B, `borrarObjeto(window.__caja); redObjeto(); 1`);
await ev(A, ir); await espera(3000); await ev(A, `irMenuPrincipal(); const L = JSON.parse(localStorage.getItem('jx_red_lugar') || 'null'); if (L) { L.m = 'gm_otro'; localStorage.setItem('jx_red_lugar', JSON.stringify(L)); } 1`); await espera(1500);
await entrar(A); const a7 = await yo(A);
ok('7. lo guardado era de otro mapa: aparece en la aparición de este', dh(a7.p, a7.spawn) < 2.5, { aSpawn: +dh(a7.p, a7.spawn).toFixed(2) });
const err = errs.filter((e) => !/WebSocket|net::|Failed to load/i.test(e));
ok('8. sin errores de JS', !err.length, err.slice(0, 5));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
await b.close(); srv.close(); process.exit(R0.every(Boolean) ? 0 : 1);
