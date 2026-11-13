// Pill Packs en una sala (pillpacks.js + red.js): Ana se transforma en Freddy y Beto la ve como Freddy (el modelo, el nivel,
// la carrera); ve sus habilidades (el zarpazo, el susto —que, de cerca, también lo asusta a él—, el teletransporte de Bonnie,
// la ráfaga de Goku) y, cuando Ana vuelve a su personaje, la ve como antes. Como Foxy, la ve saltar (sin que al caer los pies
// atraviesen el piso) y correr con la velocidad de los ajustes al máximo (×2: 28 m/s) pareja, sin saltos de lugar ni
// temblequeo. Fotos desde la cámara de Beto.
// uso: BROKER_DIR=carpeta-con-mc/broker [BROKER_PORT=8899] node red_pill.mjs URL_HTML [CARPETA_FOTOS]   (URL_HTML con http://)
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const [, , html, DIR = '.'] = process.argv, F = DIR.replace(/\/?$/, '/'); fs.mkdirSync(F, { recursive: true });
const PUERTO = +process.env.BROKER_PORT || 8899;   // (otro puerto si hay otra prueba de red andando)
// (aedes 0.x es una función; desde la 1.x, un módulo con Aedes.createBroker)
const AE = req('aedes'), aedes = typeof AE === 'function' ? AE() : AE.Aedes && AE.Aedes.createBroker ? await AE.Aedes.createBroker() : new AE.Aedes(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(PUERTO, '127.0.0.1', r));
const errs = [], navs = [];
const abrir = async (n) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); navs.push(b);
  const c = await b.newContext({ viewport: { width: 960, height: 540 } });
  await c.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await c.newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_|404/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto(html + (html.includes('?') ? '&' : '?') + 'test&broker=' + encodeURIComponent('ws://127.0.0.1:' + PUERTO + '/mqtt')); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s), J = async (P, s) => JSON.parse(await ev(P, `JSON.stringify(${s})`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 4; i++) { if (await J(P, cond)) return true; await espera(250); } return false; };
// (apretar una habilidad unos cuadros: con dos navegadores por software van a pocos cuadros por segundo)
const apretar = async (P, i, pre) => { await ev(P, `${pre || ''} window.__m0 = R.marca; ENT.pillA${i} = true; 1`); await hasta(P, `R.marca >= window.__m0 + 3`, 3); await ev(P, `ENT.pillA${i} = false; 1`); };
let ok = 0, mal = 0; const chk = (c, t, x) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); c ? ok++ : mal++; };
const entrar = (P, n, sk) => ev(P, `PREFS.nombre='${n}'; PREFS.skin='${sk}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.gfx='medio'; GFX.auto=false; aplicarGfx(); inicioMostrar(false); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
const A = await abrir('Ana'), B = await abrir('Beto');
await entrar(A, 'Ana', 'Hero'); await entrar(B, 'Beto', 'Jean');
chk(await hasta(A, `RED.remotos.size === 1 && JUEGO.estado === 'juego'`, 60) && await hasta(B, `RED.remotos.size === 1 && JUEGO.estado === 'juego'`, 60), 'los dos en la sala y se ven');
await espera(2500);
// Beto, a 5 m de Ana mirándola (tercera persona de Ana para la foto de Ana)
const rem = `[...RED.remotos.values()][0]`;
// (Beto ya la ve quieta donde está Ana, parada: con la máquina cargada, la física de Ana va más lenta que el tiempo real y se
// la dibuja a su ritmo, unos segundos atrás)
const quieta = async () => { const y = await J(A, `[JUG.pos.x, JUG.pos.y, JUG.pos.z]`); return hasta(B, `(() => { const r = ${rem}; return !!(r && r.P && r.P.suelo && Math.hypot(r.P.pos.x - ${y[0]}, r.P.pos.y - ${y[1]}, r.P.pos.z - ${y[2]}) < 0.03); })()`, 30); };
await ev(A, `JUG.pos.copy(MUNDO.spawns[0] || JUG.pos); JUG.yaw = 0; JUG.vel.set(0, 0, 0); 1`); await espera(800);
const pa = await J(A, `[JUG.pos.x, JUG.pos.y, JUG.pos.z]`);
await ev(B, `JUG.pos.set(${pa[0]}, ${pa[1]}, ${pa[2] + 5}); JUG.vel.set(0, 0, 0); JUG.yaw = Math.PI; JUG.pitch = 0.08; JUG.tercera = false; 1`); await espera(1500);
// ---- Ana se transforma en Freddy ----
await ev(A, `pillAplicar('freddy'); 1`);
chk(await hasta(B, `(() => { const r = ${rem}; return !!(r && r.P && r.P.skin === 'Freddy' && r.pill && r.pill.id === 'freddy'); })()`, 40), 'Beto ve a Ana como Freddy (modelo e id del Pill)', await J(B, `(() => { const r = ${rem}; return { skin: r.P && r.P.skin, pill: r.pill && { id: r.pill.id, niv: r.pill.niv } }; })()`));
await espera(1500); await B.screenshot({ path: F + 'red_beto_ve_freddy.png' });
// pies del Freddy de Ana en la pantalla de Beto (ya quieta y asentada: con la máquina cargada, caer desde la aparición
// puede llevar varios segundos)
await hasta(A, `JUG.suelo && JUG.tiempoSuelo > 0.3 && Math.hypot(JUG.vel.x, JUG.vel.z) < 0.05`, 40); await quieta(); await espera(2000);
const pies = await J(B, `(() => { const P = ${rem}.P, Dd = P.D, md = P.md; md.actualizar(); const g = mundoRayo(v3(P.pos.x, P.pos.y + 0.5, P.pos.z), v3(0, -1, 0), 10); return +(Math.min(md.W[Dd.h.LeftFoot][13], md.W[Dd.h.RightFoot][13]) - Dd.tobillo - (P.pos.y + 0.5 - g.t)).toFixed(3); })()`);
const piesYo = await J(B, `(() => { const P = JUG.cuerpo, Dd = P.D, md = P.md; md.actualizar(); const g = mundoRayo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), v3(0, -1, 0), 10); return +(Math.min(md.W[Dd.h.LeftFoot][13], md.W[Dd.h.RightFoot][13]) - Dd.tobillo - (JUG.pos.y + 0.5 - g.t)).toFixed(3); })()`);
const dRem = await J(B, `(() => { const r = ${rem}, L = r.mm || [], u = L[L.length - 1]; return { y: +r.pos.y.toFixed(3), meta: +r.meta.y.toFixed(3), suelo: r.P.suelo, n: L.length, rr: r.rr !== undefined ? +(u ? r.rr - u.rt : 0).toFixed(3) : null, err: +(r.rrErr || 0).toFixed(3) }; })()`), yAna = await J(A, `+JUG.pos.y.toFixed(3)`);
chk(Math.abs(pies - piesYo) < 0.04, 'el Freddy de Ana se apoya en el piso como el cuerpo de Beto', { remoto: pies, beto: piesYo, enBeto: dRem, ana: yAna });
// ---- el zarpazo: Beto ve el gesto ----
await apretar(A, 0);
chk(await hasta(B, `!!${rem}.P.accion`, 3), 'Beto ve el zarpazo (el gesto en el cuerpo de Ana)');
await espera(200); await B.screenshot({ path: F + 'red_beto_ve_zarpazo.png' });
await espera(1200);
// ---- el susto (Beto a 5 m: le llega) ----
await apretar(A, 1, 'PILL.cd = [0, 0, 0, 0]; PILL.pod = 100;');
chk(await hasta(B, `PILL.sustoT > 0 || (!!$('pillSusto') && $('pillSusto').classList.contains('ve'))`, 3), 'el susto de Ana asusta a Beto (de cerca)');
chk(await hasta(B, `${rem}.P.emote === 'Scream'`, 8), 'Beto ve la pose del grito');
// (la cara de Beto queda hacia Ana: ya la miraba y el susto lo gira hacia el que grita, no al revés)
const mira = await J(B, `(() => { const r = ${rem}.P.pos, f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), d = vsub(r, JUG.pos); d.y = 0; d.norm(); return +vdot(f, d).toFixed(3); })()`);
chk(mira > 0.95, 'después del susto Beto mira a Ana', mira);
await espera(150); await B.screenshot({ path: F + 'red_beto_susto.png' });
await espera(2500);
// ---- la carrera (va en el estado) ----
await ev(A, `PILL.pod = 100; ENT.teclas.add('KeyW'); ENT.pillA2 = true; 1`);
chk(await hasta(B, `!!(${rem}.pill && ${rem}.pill.car)`, 3), 'Beto sabe que Ana va en carrera');
await ev(A, `ENT.pillA2 = false; ENT.teclas.delete('KeyW'); 1`); await espera(1200);
// ---- Foxy: el salto y la carrera con el ajuste de velocidad al máximo (×2: 28 m/s), vistos por Beto ----
// (Beto anota cuadro a cuadro dónde dibuja a Ana, en qué momento del reloj de Ana —con el que la dibuja—, lo bajo de sus
// pies respecto del piso y si la ve en el aire)
await ev(A, `pillAplicar('foxy'); 1`);
chk(await hasta(B, `${rem}.P.skin === 'Foxy'`, 40), 'Ana cambia a Foxy y Beto la ve así');
await ev(A, `JUG.pos.copy(MUNDO.spawns[0] || JUG.pos); JUG.yaw = 0; JUG.vel.set(0, 0, 0); 1`); await espera(2500);
const anotar = (n) => ev(B, `window.__rs = []; window.__rsFin = false; (function f() { const r = ${rem}; if (r && r.P) { const P = r.P, Dd = P.D, md = P.md; md.actualizar(); let bajo = Math.min(md.W[Dd.h.LeftFoot][13], md.W[Dd.h.RightFoot][13]) - Dd.tobillo; const pz = Dd.pies;
  if (pz) for (const [l, iF] of [['L', Dd.h.LeftFoot], ['R', Dd.h.RightFoot]]) { const W = md.W[iF]; for (const q of pz[l]) { const y = W[1] * q.x + W[5] * q.y + W[9] * q.z + W[13]; if (y < bajo) bajo = y; } }
  const g = mundoRayo(v3(P.pos.x, P.pos.y + 0.5, P.pos.z), v3(0, -1, 0), 10); window.__rs.push([r.rr !== undefined ? r.rr : TIEMPO.t, P.pos.x, P.pos.y, P.pos.z, g ? bajo - (P.pos.y + 0.5 - g.t) : 0, P.suelo ? 1 : 0]); }
  if (window.__rs.length < ${n} && !window.__rsFin) requestAnimationFrame(f); })(); 1`);
await hasta(A, `JUG.suelo && JUG.tiempoSuelo > 0.3`, 40); await quieta(); await espera(1500); await anotar(4000); await espera(800);
await ev(A, `window.__m0 = R.marca; ENT.teclas.add('Space'); 1`); await hasta(A, `R.marca >= window.__m0 + 3`, 3); await ev(A, `ENT.teclas.delete('Space'); 1`);
await hasta(A, `!JUG.suelo && JUG.vel.y < 0.5`, 4); await espera(250); await B.screenshot({ path: F + 'red_beto_ve_salto.png' });
await hasta(B, `window.__rs.some((q) => !q[5]) && ${rem}.P.suelo`, 15); await espera(800); await ev(B, `window.__rsFin = true; 1`);
const vs = await J(B, `(() => { const L = window.__rs, n0 = Math.max(1, Math.min(8, L.length >> 3)), y0 = L.slice(0, n0).reduce((a, q) => a + q[2], 0) / n0, p0 = L.slice(0, n0).reduce((a, q) => a + q[4], 0) / n0;
  let alto = 0, aire = 0, piesMin = 9, tras = false; for (const q of L) { alto = Math.max(alto, q[2] - y0); if (!q[5]) { aire++; tras = true; } if (tras && q[5]) piesMin = Math.min(piesMin, q[4]); }
  return { cuadros: L.length, alto: +alto.toFixed(2), aire, parado: +p0.toFixed(3), alCaer: +piesMin.toFixed(3) }; })()`);
const altoA = await J(A, `pillSaltoDe(PILL.def)`);
chk(vs.alto > 0.75 * altoA && vs.aire > 0 && vs.alCaer < 9 && vs.alCaer >= Math.min(vs.parado, piesYo) - 0.04, 'Beto ve saltar a Foxy (alto, en el aire) y al caer sus pies no atraviesan el piso (comparado con parado)', { ...vs, beto: piesYo, saltoFoxy: altoA });
// la carrera a ×2 (velocidad 2: Foxy a 28 m/s): Beto la ve moverse parejo, sin saltos de lugar
// (el rumbo con más camino llano y sin paredes desde la aparición: derecho hacia +z hay un escalón a 40 m y una pared a 45;
// Beto, 30 m adelante y 12 al costado, mirando el camino)
const ru = await J(A, `(() => { const s = MUNDO.spawns[0] || JUG.pos; let yaw = 0, lejos = -1;
  for (let k = 0; k < 24; k++) { const a = k * TAU / 24, d = v3(Math.sin(a), 0, Math.cos(a)); let ok = 0, y0 = null;
    for (let m = 6; m <= 90; m += 3) { const q = v3(s.x + d.x * m, s.y + 3, s.z + d.z * m), g = mundoRayo(q, v3(0, -1, 0), 30); if (!g) break; const y = q.y - g.t; if (y0 === null) y0 = y; if (Math.abs(y - y0) > 0.15) break; ok = m; }
    const w = raycast(v3(s.x, s.y + 0.4, s.z), d, 95, null), lim = Math.min(ok, w ? w.t - 2 : 95); if (lim > lejos) { lejos = lim; yaw = a; } }
  const d = v3(Math.sin(yaw), 0, Math.cos(yaw)), l = v3(d.z, 0, -d.x);
  return { yaw, m: lejos, s: [s.x, s.y, s.z], d: [d.x, d.z], b: [s.x + d.x * 30 + l.x * 12, s.y, s.z + d.z * 30 + l.z * 12], yawB: Math.atan2(-l.x, -l.z) }; })()`);
await ev(A, `pillAjPoner('vel', 2); JUG.pos.copy(MUNDO.spawns[0] || JUG.pos); JUG.yaw = ${ru.yaw}; JUG.vel.set(0, 0, 0); PILL.pod = pillPodMax(); 1`); await espera(1500);
await ev(B, `JUG.pos.set(${ru.b[0]}, ${ru.b[1]}, ${ru.b[2]}); JUG.vel.set(0, 0, 0); JUG.yaw = ${ru.yawB}; JUG.pitch = 0.05; 1`); await espera(800);
await anotar(6000);
await ev(A, `PILL.pod = pillPodMax(); ENT.teclas.add('KeyW'); ENT.teclas.add('ShiftLeft'); 1`);
await hasta(B, `(${rem}.P.pos.x - ${ru.s[0]}) * ${ru.d[0]} + (${rem}.P.pos.z - ${ru.s[2]}) * ${ru.d[1]} > 27`, 15); await B.screenshot({ path: F + 'red_beto_ve_carrera_x2.png' }); await espera(2500);
await ev(A, `ENT.teclas.delete('KeyW'); ENT.teclas.delete('ShiftLeft'); ENT.x = ENT.y = 0; 1`); await espera(1500); await ev(B, `window.__rsFin = true; 1`);
const vc = await J(B, `(() => { const L = window.__rs, sp = [], d = []; for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i], dd = Math.hypot(b[1] - a[1], b[3] - a[3]), dt = b[0] - a[0]; d.push(dd); if (dt > 0.005) sp.push(dd / dt); }
  const rap = sp.filter((s) => s > 8).sort((a, b) => a - b); if (rap.length < 4) return { cuadros: L.length, rap: rap.length };
  const m = rap.slice(Math.floor(rap.length * 0.2), Math.ceil(rap.length * 0.8)); const med = m[m.length >> 1], mean = m.reduce((a, b) => a + b, 0) / m.length, de = Math.sqrt(m.reduce((a, b) => a + (b - mean) * (b - mean), 0) / m.length);
  return { cuadros: L.length, rap: rap.length, mediana: +med.toFixed(1), desvio: +(de / mean).toFixed(3), maxPaso: +Math.max(...d).toFixed(2), maxVel: +Math.max(...sp).toFixed(1) }; })()`);
const velA = await J(A, `+(PILL.def.vel * PILL.def.hab[2].mult * pillAj('vel')).toFixed(1)`);
chk(vc.rap >= 4 && vc.maxVel < 1.6 * vc.mediana && vc.desvio < 0.2, 'Beto ve a Foxy a ×2 (28 m/s) moverse parejo: sin teletransportes ni temblequeo', { ...vc, velAna: velA, camino: ru.m });
await ev(A, `pillAjPoner('vel', 1); guardarPrefs(); 1`);
await ev(B, `JUG.pos.set(${pa[0]}, ${pa[1]}, ${pa[2] + 5}); JUG.vel.set(0, 0, 0); JUG.yaw = Math.PI; JUG.pitch = 0.08; 1`); await espera(800);
// ---- Bonnie: el teletransporte ----
await ev(A, `pillAplicar('bonnie'); 1`);
chk(await hasta(B, `${rem}.P.skin === 'Bonnie'`, 40), 'Ana cambia a Bonnie y Beto la ve así');
await espera(1500);
await apretar(A, 3, 'JUG.pitch = 0.3; JUG.yaw = Math.PI / 2; PILL.pod = 100; PILL.cd = [0, 0, 0, 0];'); await espera(400);
const ta = await J(A, `[JUG.pos.x, JUG.pos.z]`);
chk(await hasta(B, `Math.hypot(${rem}.P.pos.x - ${ta[0]}, ${rem}.P.pos.z - ${ta[1]}) < 0.6`, 3), 'Beto ve a Bonnie aparecer donde se teletransportó', { ana: ta, enBeto: await J(B, `[${rem}.P.pos.x, ${rem}.P.pos.z]`) });
// ---- Goku: la ráfaga ----
await ev(A, `pillAplicar('goku'); 1`); await hasta(B, `${rem}.P.skin === 'Goku'`, 40); await espera(1500);
await ev(A, `JUG.yaw = Math.PI; JUG.pitch = 0.1; PILL.pod = 100; PILL.cd = [0, 0, 0, 0]; 1`); await espera(300);
const fx0 = await J(B, `PART.l.length`);
await apretar(A, 1); await espera(150);
const fx1 = await J(B, `PART.l.length`); await B.screenshot({ path: F + 'red_beto_rafaga.png' });
chk(fx1 > fx0 + 5, 'Beto ve el rayo de la ráfaga', { antes: fx0, despues: fx1 });
// ---- vuelve a su personaje ----
await espera(800); await ev(A, `pillFin(); 1`);
chk(await hasta(B, `${rem}.P.skin === 'Hero' && !${rem}.pill`, 10), 'Ana vuelve a su personaje y Beto la ve como antes');
await espera(800); await B.screenshot({ path: F + 'red_beto_volvio.png' });
chk(!errs.length, 'sin errores de JS', errs.slice(0, 6));
console.log(`RESUMEN ${ok}/${ok + mal}`);
for (const b of navs) await b.close(); srv.close(); process.exit(mal ? 1 : 0);
