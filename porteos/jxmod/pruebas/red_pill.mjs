// Pill Packs en una sala (pillpacks.js + red.js): Ana se transforma en Freddy y Beto la ve como Freddy (el modelo, el nivel,
// la carrera); ve sus habilidades (el zarpazo, el susto —que, de cerca, también lo asusta a él—, el teletransporte de Bonnie,
// la ráfaga de Goku) y, cuando Ana vuelve a su personaje, la ve como antes. Fotos desde la cámara de Beto.
// uso: BROKER_DIR=carpeta-con-mc/broker node red_pill.mjs URL_HTML [CARPETA_FOTOS]   (URL_HTML con http://)
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const [, , html, DIR = '.'] = process.argv, F = DIR.replace(/\/?$/, '/'); fs.mkdirSync(F, { recursive: true });
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8899, '127.0.0.1', r));
const errs = [], navs = [];
const abrir = async (n) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); navs.push(b);
  const c = await b.newContext({ viewport: { width: 960, height: 540 } });
  await c.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await c.newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_|404/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto(html + (html.includes('?') ? '&' : '?') + 'test&broker=' + encodeURIComponent('ws://127.0.0.1:8899/mqtt')); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); return p;
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
await ev(A, `JUG.pos.copy(MUNDO.spawns[0] || JUG.pos); JUG.yaw = 0; JUG.vel.set(0, 0, 0); 1`); await espera(800);
const pa = await J(A, `[JUG.pos.x, JUG.pos.y, JUG.pos.z]`);
await ev(B, `JUG.pos.set(${pa[0]}, ${pa[1]}, ${pa[2] + 5}); JUG.vel.set(0, 0, 0); JUG.yaw = Math.PI; JUG.pitch = 0.08; JUG.tercera = false; 1`); await espera(1500);
// ---- Ana se transforma en Freddy ----
await ev(A, `pillAplicar('freddy'); 1`);
chk(await hasta(B, `(() => { const r = ${rem}; return !!(r && r.P && r.P.skin === 'Freddy' && r.pill && r.pill.id === 'freddy'); })()`, 40), 'Beto ve a Ana como Freddy (modelo e id del Pill)', await J(B, `(() => { const r = ${rem}; return { skin: r.P && r.P.skin, pill: r.pill && { id: r.pill.id, niv: r.pill.niv } }; })()`));
await espera(1500); await B.screenshot({ path: F + 'red_beto_ve_freddy.png' });
// pies del Freddy de Ana en la pantalla de Beto (ya quieta y asentada)
await espera(1500);
const pies = await J(B, `(() => { const P = ${rem}.P, Dd = P.D, md = P.md; md.actualizar(); const g = mundoRayo(v3(P.pos.x, P.pos.y + 0.5, P.pos.z), v3(0, -1, 0), 10); return +(Math.min(md.W[Dd.h.LeftFoot][13], md.W[Dd.h.RightFoot][13]) - Dd.tobillo - (P.pos.y + 0.5 - g.t)).toFixed(3); })()`);
const piesYo = await J(B, `(() => { const P = JUG.cuerpo, Dd = P.D, md = P.md; md.actualizar(); const g = mundoRayo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), v3(0, -1, 0), 10); return +(Math.min(md.W[Dd.h.LeftFoot][13], md.W[Dd.h.RightFoot][13]) - Dd.tobillo - (JUG.pos.y + 0.5 - g.t)).toFixed(3); })()`);
chk(Math.abs(pies - piesYo) < 0.04, 'el Freddy de Ana se apoya en el piso como el cuerpo de Beto', { remoto: pies, beto: piesYo });
// ---- el zarpazo: Beto ve el gesto ----
await apretar(A, 0);
chk(await hasta(B, `!!${rem}.P.accion`, 3), 'Beto ve el zarpazo (el gesto en el cuerpo de Ana)');
await espera(200); await B.screenshot({ path: F + 'red_beto_ve_zarpazo.png' });
await espera(1200);
// ---- el susto (Beto a 5 m: le llega) ----
await apretar(A, 1, 'PILL.cd = [0, 0, 0, 0]; PILL.pod = 100;');
chk(await hasta(B, `PILL.sustoT > 0 || (!!$('pillSusto') && $('pillSusto').classList.contains('ve'))`, 3), 'el susto de Ana asusta a Beto (de cerca)');
chk(await hasta(B, `${rem}.P.emote === 'Scream'`, 3), 'Beto ve la pose del grito');
// (la cara de Beto queda hacia Ana: ya la miraba y el susto lo gira hacia el que grita, no al revés)
const mira = await J(B, `(() => { const r = ${rem}.P.pos, f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), d = vsub(r, JUG.pos); d.y = 0; d.norm(); return +vdot(f, d).toFixed(3); })()`);
chk(mira > 0.95, 'después del susto Beto mira a Ana', mira);
await espera(150); await B.screenshot({ path: F + 'red_beto_susto.png' });
await espera(2500);
// ---- la carrera (va en el estado) ----
await ev(A, `PILL.pod = 100; ENT.teclas.add('KeyW'); ENT.pillA2 = true; 1`);
chk(await hasta(B, `!!(${rem}.pill && ${rem}.pill.car)`, 3), 'Beto sabe que Ana va en carrera');
await ev(A, `ENT.pillA2 = false; ENT.teclas.delete('KeyW'); 1`); await espera(1200);
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
