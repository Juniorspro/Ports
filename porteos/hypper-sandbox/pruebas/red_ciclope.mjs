// Cíclope en una sala: Ana tira la definitiva y Beto (sin el mod) ve la cinemática en su pantalla; después el rayo
// agarra a Beto, que pasa a primera persona con las manos arriba, ve todo rojo, sale volando y recibe el golpe final;
// al terminar, el cielo vuelve para los dos. Capturas en la carpeta.
// uso: BROKER_DIR=carpeta-con-mc/broker node red_ciclope.mjs Hypper.html carpeta
import { createRequire } from 'module'; import http from 'http';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '.', req = createRequire(S + '/mc/broker/package.json');
const html = process.argv[2], D = (process.argv[3] || '.') + '/';
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const navs = [], errs = [];
const abrir = async (n) => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); navs.push(b);
  const c = await b.newContext({ viewport: { width: 960, height: 540 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8897/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 150000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c), espera = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (b, t, x) => console.log((b ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + (typeof x === 'string' ? x : JSON.stringify(x)) : ''));
const entrar = (P, n, mods) => ev(P, `PREFS.nombre='${n}'; PREFS.bienvenida=true; PREFS.modsSrv = ${JSON.stringify(mods)}; PREFS.mods = {}; audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
try {
  const A = await abrir('A'), B = await abrir('B');
  await entrar(A, 'Ana', { ciclope: true }); await entrar(B, 'Beto', {}); await espera(9000);
  await ev(A, `JUG.pos.set(10, 1.6, 5); JUG.yaw = 0; JUG.pitch = 0; JUG.vel.set(0,0,0); 1`); await ev(B, `JUG.pos.set(10, 1.6, 17); JUG.yaw = Math.PI; JUG.pitch = 0.05; JUG.tercera = false; JUG.vel.set(0,0,0); 1`);
  await espera(2500);
  const vis = JSON.parse(await ev(B, `JSON.stringify((() => { const R2 = [...RED.remotos.values()].find((r) => r.nombre === 'Ana'); return { ve: !!R2, skin: R2 && R2.skin }; })())`));
  ok(vis.ve && vis.skin === 'Ciclope', 'Beto ve a Ana como Cíclope', vis);
  // Ana tira la definitiva
  await ev(A, `cicDefinitiva(); 1`); await espera(400);
  const uA = () => ev(A, `cicMia() ? +(TIEMPO.t - cicMia().t0).toFixed(2) : -1`).then(Number);
  const uB = () => ev(B, `(() => { const U = [...CIC.ults.values()][0]; return U ? +(TIEMPO.t - U.t0).toFixed(2) : -1; })()`).then(Number);
  ok((await uB()) >= 0, 'a Beto le llega la definitiva de Ana', { uA: await uA(), uB: await uB() });
  while ((await uB()) < 2.4 && (await uB()) >= 0) await espera(60);
  const camB = JSON.parse(await ev(B, `JSON.stringify((() => { const R2 = [...RED.remotos.values()][0]; return { lejosDeAna: +CAM.pos.distTo(R2.P.pos).toFixed(2), lejosDeBeto: +CAM.pos.distTo(JUG.pos).toFixed(2) }; })())`));
  ok(camB.lejosDeAna < 2.5 && camB.lejosDeBeto > 5, 'Beto ve la cinemática (su cámara está al lado de Ana)', camB);
  await B.screenshot({ path: D + 'rc1_beto_cinematica.png' });
  while ((await uB()) < 4.0) await espera(60); await B.screenshot({ path: D + 'rc2_beto_lentes.png' });
  while ((await uB()) < 5.9) await espera(60); await B.screenshot({ path: D + 'rc3_beto_estalla.png' });
  // termina la cinemática: Beto vuelve a su cámara; el cielo rojo también para él
  while ((await uB()) < 6.5) await espera(60);
  const tras = JSON.parse(await ev(B, `JSON.stringify({ rojo: +CIC.rojo.toFixed(2), camConBeto: +CAM.pos.distTo(JUG.ojoPos).toFixed(2) })`));
  ok(tras.rojo > 0.6 && tras.camConBeto < 0.2, 'después de la cinemática Beto vuelve a su vista y el cielo está rojo', tras);
  // Ana apunta a Beto: el rayo lo agarra
  for (let i = 0; i < 8; i++) { await ev(A, `(() => { const R2 = [...RED.remotos.values()][0], c = vsub(vadd(R2.P.pos, v3(0, 0.2, 0)), CAM.pos).norm(); JUG.yaw = Math.atan2(c.x, c.z); JUG.pitch = -Math.asin(c.y); return 1; })()`); await espera(150); }
  let v = null;
  for (let i = 0; i < 30; i++) { await espera(150); v = JSON.parse(await ev(B, `JSON.stringify({ vic: !!CIC.vic, terc: JUG.tercera, ciego: +CIC.ciego.toFixed(2), manos: !!(JUG.cuerpo && JUG.cuerpo.cicManos), vel: +JUG.vel.len().toFixed(1), y: +JUG.pos.y.toFixed(1), vida: Math.round(JUG.vida) })`)); if (v.vic && v.ciego > 0.4) break; }
  ok(v.vic && !v.terc && v.manos, 'a Beto lo agarra el rayo: primera persona con las manos arriba', v);
  ok(v.ciego > 0.4 && v.vel > 5, 've rojo y sale volando', v);
  await ev(B, `CIC.capaC.style.visibility = 'hidden'; 1`); await espera(80); await B.screenshot({ path: D + 'rc4_beto_manos.png' }); await ev(B, `CIC.capaC.style.visibility = ''; 1`); // (sin el rojo, para ver las manos)
  await espera(300); await B.screenshot({ path: D + 'rc5_beto_rojo.png' });
  const vA = JSON.parse(await ev(A, `JSON.stringify({ pegado: !!(cicMia() && cicMia().vic), poseBeto: (() => { const R2 = [...RED.remotos.values()][0]; return R2 && R2.P.cicVicT !== undefined ? +(TIEMPO.t - R2.P.cicVicT).toFixed(1) : null; })() })`));
  ok(vA.pegado && vA.poseBeto !== null, 'Ana lo tiene agarrado y lo ve con las manos arriba', vA);
  await A.screenshot({ path: D + 'rc6_ana_agarra.png' });
  // el golpe final
  // (con dos navegadores el juego va lento: se espera por el tiempo del juego)
  let f = null; for (let i = 0; i < 200; i++) { await espera(150); f = JSON.parse(await ev(B, `JSON.stringify({ vic: !!CIC.vic, vida: Math.round(JUG.vida), vivo: JUG.vivo })`)); if (!f.vic) break; }
  ok(!f.vic && (f.vida < 30 || !f.vivo), 'golpe final: queda muy lastimado o muerto', f);
  await espera(600); await B.screenshot({ path: D + 'rc7_beto_golpe.png' });
  // termina: el cielo vuelve para los dos
  while ((await uA()) >= 0) await espera(300);
  for (let i = 0; i < 60; i++) { await espera(300); if (Number(await ev(B, `CIC.rojo`)) < 0.02 && Number(await ev(A, `CIC.rojo`)) < 0.02) break; }
  const finA = JSON.parse(await ev(A, `JSON.stringify({ rojo: +CIC.rojo.toFixed(2), ults: CIC.ults.size })`)), finB = JSON.parse(await ev(B, `JSON.stringify({ rojo: +CIC.rojo.toFixed(2), ults: CIC.ults.size, vic: !!CIC.vic })`));
  ok(finA.rojo < 0.05 && finB.rojo < 0.05 && !finA.ults && !finB.ults && !finB.vic, 'al terminar todo vuelve para los dos', { finA, finB });
  await B.screenshot({ path: D + 'rc8_beto_fin.png' });
} catch (e) { console.log('ERROR', e.message); }
console.log('errores:', errs.slice(0, 8).join(' | ') || 'ninguno');
for (const b of navs) await b.close(); srv.close(); process.exit(0);
