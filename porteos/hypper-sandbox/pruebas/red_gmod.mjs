// gm_construct en una sala: Ana y Beto entran al server oficial del mapa y se ven; Ana saca la palanca (Beto la ve en
// su mano) y le pega a Beto de frente: a Beto le baja la vida y oye el golpe; un golpe al aire suena a silbido
// uso: BROKER_DIR=carpeta-con-mc/broker node red_gmod.mjs Hypper.html
import { createRequire } from 'module'; import http from 'http';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const html = process.argv[2];
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8899, '127.0.0.1', r));
const navs = [], errs = [];
const abrir = async (n) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); navs.push(b);
  const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8899/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s), J = async (P, s) => JSON.parse(await ev(P, `JSON.stringify(${s})`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 2; i++) { if (await J(P, cond)) return true; await espera(500); } return false; };
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const entrar = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.gfx='patata'; GFX.auto=false; aplicarGfx(); audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'RB_Construct')); 1`);
const A = await abrir('Ana'); await entrar(A, 'Ana');
const B = await abrir('Beto'); await entrar(B, 'Beto');
ok('los dos en gm_construct y se ven', await hasta(A, `MUNDO.nombre === 'RB_Construct' && RED.remotos.size === 1`, 40) && await hasta(B, `MUNDO.nombre === 'RB_Construct' && RED.remotos.size === 1`, 40));
// Beto parado quieto; Ana a 1,3 m mirándolo, con la palanca
await ev(B, `JUG.noclip = false; const sp = MUNDO.spawns[3]; JUG.pos.set(sp.x, sp.y + 0.3, sp.z); JUG.vel.set(0, 0, 0); window.__son = []; const _s = sonar; sonar = (n, ...r) => { window.__son.push(n); return _s(n, ...r); }; 1`);
await espera(2500);
const pb = await J(B, `[JUG.pos.x, JUG.pos.y, JUG.pos.z]`);
await ev(A, `JUG.noclip = false; JUG.pos.set(${pb[0]}, ${pb[1]}, ${pb[2]} + 1.3); JUG.vel.set(0, 0, 0); JUG.yaw = Math.PI; JUG.pitch = 0.12; elegirArma(ARM.lista.indexOf('Crowbar')); 1`);
ok('Beto ve la palanca en la mano de Ana', await hasta(B, `(() => { const r = [...RED.remotos.values()][0]; return !!(r && r.P && r.P.arma === 'Crowbar' && r.P.armasGm && r.P.armasGm.Crowbar); })()`, 20));   // (con el agarre de GMod)
await espera(2000);
const v0 = await J(B, `JUG.vida`);
// (Ana mira a Beto: en la pendiente se puede haber corrido un poco)
await ev(A, `(() => { const r = [...RED.remotos.values()][0], d = vsub(r.b.pos, CAM.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); return 1; })()`); await espera(500);
const mira = await J(A, `(() => { const h = raycast(CAM.pos, CAM.fwd, 1.95, null); return h ? (h.body && h.body.persona ? 'persona' : 'otra') : 'nada'; })()`);
console.log('ana ve a beto:', JSON.stringify(await J(A, `(() => { const r = [...RED.remotos.values()][0]; return { cam: [CAM.pos.x, CAM.pos.y, CAM.pos.z].map((v) => +v.toFixed(2)), fwd: [CAM.fwd.x, CAM.fwd.y, CAM.fwd.z].map((v) => +v.toFixed(2)), rP: r && r.P && [r.P.pos.x, r.P.pos.y, r.P.pos.z].map((v) => +v.toFixed(2)), rb: r && r.b ? { p: [r.b.pos.x, r.b.pos.y, r.b.pos.z].map((v) => +v.toFixed(2)), enFis: PH.bodies.includes(r.b), persona: !!r.b.persona, noRay: !!r.b.noRay } : null }; })()`)), 'beto:', JSON.stringify(pb));
await ev(A, `ARM.t = 0; ARM.ocup = 0; disparar(); 1`);
ok('a Beto le baja la vida', await hasta(B, `JUG.vida < ${v0}`, 10), { mira, antes: v0, despues: await J(B, `JUG.vida`) });
await espera(800);
const son = await J(B, `window.__son`);
ok('Beto oye el golpe de la palanca en la carne', son.some((n) => /^CB_Flesh/.test(n)), son);
// al aire (mirando al cielo): silbido
await ev(B, `window.__son = []; 1`); await ev(A, `JUG.pitch = -1.2; 1`); await espera(400); await ev(A, `ARM.t = 0; ARM.ocup = 0; disparar(); 1`); await espera(1500);   // (un cuadro para que la cámara mire arriba)
const son2 = await J(B, `window.__son`);
ok('el golpe al aire suena a silbido', son2.includes('CB_Swing'), son2);
ok('sin errores', !errs.length, errs.slice(0, 5));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
for (const b of navs) await b.close(); srv.close(); process.exit(0);
