// en la sala: la pantalla de video (el otro la ve con el mismo video, tamaño y lugar) y un emote hecho en el editor
// (el otro no lo tiene: lo pide y lo ve bailar)
import { createRequire } from 'module'; import http from 'http';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '.', req = createRequire(S + '/mc/broker/package.json'); // carpeta con mc/broker (aedes + ws)
const html = process.argv[2];
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const navs = [], errs = [];
const abrir = async (n) => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] }); navs.push(b);
  const p = await (await b.newContext({ viewport: { width: 1000, height: 560 } })).newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('dialog', (d) => d.accept());
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8897/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 150000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c), espera = (ms) => new Promise((r) => setTimeout(r, ms));
const entrar = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.bienvenida=true; PREFS.modsSrv = {}; PREFS.mods = {}; audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
let ok = 0, tot = 0; const chk = (c, t, x) => { tot++; if (c) ok++; console.log((c ? 'OK   ' : 'MAL  ') + ' ' + t + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
try {
  const A = await abrir('A'), B = await abrir('B');
  await entrar(A, 'Ana'); await entrar(B, 'Beto'); await espera(9000);
  // Ana pone una pantalla grande con un video
  // (los dos lejos de la pantalla: en la prueba, abierta como archivo, YouTube no deja reproducir y el video se sacaría)
  await ev(B, `JUG.pos.set(4, 1.6, -150); 1`); await espera(2500); // (Beto lejos: una pantalla de 5 m que aparece encima de alguien lo empuja)
  await ev(A, `JUG.pos.set(0, 1.6, 0); JUG.yaw = 0; entidadPonerMod('pantalla', true); const e = ENTS.lista.find((x) => x.t === 'pantalla' && x.dueno === 'yo'); pantTamano(e, 5); entidadRed('ent', e); JUG.pos.set(0, 1.6, -150); radioPoner(e, 'dQw4w9WgXcQ', 0, 'prueba', true); 1`);
  await ev(B, `JUG.pos.set(4, 1.6, -150); 1`);
  await espera(7000);
  const pa = JSON.parse(await ev(A, `(() => { const e = ENTS.lista.find((x) => x.t === 'pantalla' && x.dueno === 'yo'); return JSON.stringify({ p: [e.b.pos.x, e.b.pos.y, e.b.pos.z], w: e.prm.w, vid: e.vid }); })()`));
  const pb = JSON.parse(await ev(B, `(() => { const e = ENTS.lista.find((x) => x.t === 'pantalla' && x.dueno !== 'yo'); return JSON.stringify(e ? { p: [e.b.pos.x, e.b.pos.y, e.b.pos.z], w: e.prm.w, vid: e.vid, M: e.M.w, grab: !!e.b.noGrab } : null); })()`));
  chk(!!pb, 'Beto ve la pantalla de Ana', pb);
  chk(pb && pb.vid === pa.vid, 'con el mismo video', pb && pb.vid);
  chk(pb && pb.w === 5 && pb.M === 5, 'del mismo tamaño (5 m)', pb && [pb.w, pb.M]);
  chk(pb && Math.hypot(...pa.p.map((v, i) => v - pb.p[i])) < 0.05, 'en el mismo lugar', pb && { A: pa.p, B: pb.p });
  chk(pb && pb.grab, 'Beto no la puede agarrar (es de Ana)');
  // Ana la mueve: llega
  await ev(A, `(() => { const e = ENTS.lista.find((x) => x.t === 'pantalla' && x.dueno === 'yo'); e.b.pos.x += 3; e.b.frozen = true; e.b.updateWorld(); RED.wSucio = true; return 1; })()`); await espera(3000);
  const pb2 = JSON.parse(await ev(B, `(() => { const e = ENTS.lista.find((x) => x.t === 'pantalla' && x.dueno !== 'yo'); return JSON.stringify([e.b.pos.x, e.b.pos.y, e.b.pos.z]); })()`));
  chk(Math.abs(pb2[0] - (pa.p[0] + 3)) < 0.1, 'Ana la corre 3 m y Beto la ve corrida', pb2);
  // un emote hecho en el editor por Ana
  const id = await ev(A, `(() => { edaAbrir(); EDA.sel = 'RightArm'; EDA.t = 0; edaGirarMundo(Quat.axis(0, 0, 1, 1.2)); EDA.t = 1; edaGirarMundo(Quat.axis(1, 0, 0, -1.4)); EDA.nombre = 'Saludo de Ana'; return 1; })()`);
  await ev(A, `edaGuardar(); 1`); await espera(2500);
  const k = await ev(A, `Object.keys(INST.anims).find((x) => INST.anims[x].nombre === 'Saludo de Ana') || ''`);
  chk(!!k, 'Ana guardó su emote', k);
  await ev(A, `edaCerrar(); emote('u:${k}'); 1`); await espera(6000);
  const vb = JSON.parse(await ev(B, `(() => { const R2 = [...RED.remotos.values()].find((r) => r.nombre === 'Ana'); return JSON.stringify({ emote: R2 && R2.P.emote, clip: !!emoClip('u:${k}'), nombre: EMO.remotos['${k}'] && EMO.remotos['${k}'].nombre }); })()`));
  chk(vb.emote === 'u:' + k, 'Beto ve que Ana hace su emote', vb.emote);
  chk(vb.clip && vb.nombre === 'Saludo de Ana', 'Beto recibió la animación (la pidió) y la puede reproducir', vb);
  // la pantalla se borra cuando Ana la saca
  await ev(A, `(() => { const e = ENTS.lista.find((x) => x.t === 'pantalla' && x.dueno === 'yo'); entidadQuitar(e); entidadRed('entb', e); return 1; })()`); await espera(2500);
  chk(!(await ev(B, `!!ENTS.lista.find((x) => x.t === 'pantalla')`)), 'Ana la saca y a Beto se le va');
} catch (e) { console.log('ERROR', e.message); }
console.log(`\n${ok}/${tot}`);
console.log('errores:', errs.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
for (const b of navs) await b.close(); srv.close(); process.exit(0);
