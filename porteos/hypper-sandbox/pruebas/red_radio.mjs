// radio en la sala: la emisora suena en 3D para todos, se ve en la espalda del que la lleva y queda pegada donde la
// congelan con la pistola de física (también para el que entra después)
import { createRequire } from 'module'; import http from 'http';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '.', req = createRequire(S + '/mc/broker/package.json'); // carpeta con mc/broker (aedes + ws)
const html = process.argv[2], D = (process.argv[3] || '.') + '/';
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8897, '127.0.0.1', r));
const navs = [], errs = [];
const abrir = async (n) => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); navs.push(b);
  const c = await b.newContext({ viewport: { width: 1000, height: 560 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('dialog', (d) => d.accept());
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8897/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 150000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c), espera = (ms) => new Promise((r) => setTimeout(r, ms));
const entrar = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.bienvenida=true; PREFS.modsSrv = {radio: true}; PREFS.mods = {}; audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
// la radio de Ana vista por otro
const deAna = (P) => ev(P, `(() => { const R2 = [...RED.remotos.values()].find((r) => r.nombre === 'Ana'); const e = R2 && ENTS.lista.find((x) => x.t === 'radio' && x.dueno === R2.id); if (!e) return JSON.stringify({hay: false});
  const S = EST.son.get(e); return JSON.stringify({hay: true, vid: e.vid, ll: e.prm.ll, fz: !!e.prm.fz, enFisica: PH.bodies.includes(e.b), noGrab: !!e.b.noGrab, pos: [e.b.pos.x, e.b.pos.y, e.b.pos.z].map((v) => +v.toFixed(3)), q: [e.b.q.x, e.b.q.y, e.b.q.z, e.b.q.w].map((v) => +v.toFixed(3)),
    aAna: +e.b.pos.distTo(R2.P.pos).toFixed(2), suena: !!S, listo: !!(S && S.listo), nivel: +(e.nivel || 0).toFixed(3)}); })()`).then(JSON.parse);
try {
  const A = await abrir('A'), B = await abrir('B');
  await entrar(A, 'Ana'); await entrar(B, 'Beto'); await espera(9000);
  await ev(A, `JUG.pos.set(10, 1.6, 5); JUG.yaw = 0; JUG.vel.set(0,0,0); 1`); await ev(B, `JUG.pos.set(10, 1.6, 14); JUG.yaw = Math.PI; JUG.pitch = 0.1; JUG.tercera = false; 1`);
  console.log('A tiene la radio en el menú MOD:', await ev(A, `NAT.mods.has('radio') + ' / botón ' + (MODM.boton && MODM.boton.style.display !== 'none')`));
  // A pone la radio y una emisora de pop
  await ev(A, `entidadPonerMod('radio', true); 1`); await espera(800);
  // (una emisora MP3: el Chromium de las pruebas no decodifica AAC, Chrome/Edge/Safari/Firefox sí)
  const est = await ev(A, `fetch(TIENDA_URL + 'radio?q=lofi').then((r) => r.json()).then((d) => { const x = d.items.find((y) => y.id === '4260f1f5-d5b3-44d5-9666-355da4da0b21') || d.items[0]; radioMia().lista = d.items.slice(0, 5).map((y) => ({ id: 'rb:' + y.id, t: y.t })); radioPoner(radioMia(), 'rb:' + x.id, 0, x.t, true); return x.t + ' (' + x.k + ')'; })`);
  console.log('A pone:', est); await espera(14000);
  let r = await deAna(B); console.log('B (a 9 m) la ve y la oye:', JSON.stringify(r));
  const dbgAudio = (P) => ev(P, `(() => { const e = ENTS.lista.find((x) => x.t === 'radio'), S = e && EST.son.get(e); if (!S) return 'sin S'; const a = S.a; return JSON.stringify({ctx: AUD.ctx && AUD.ctx.state, src: a.getAttribute('src'), paused: a.paused, rs: a.readyState, ns: a.networkState, err: a.error && a.error.code, t: +a.currentTime.toFixed(1), prox: S.prox, listo: S.listo, url: EST.url.get(e.vid.slice(3))}); })()`);
  console.log('audio A:', await dbgAudio(A), ' · audio B:', await dbgAudio(B));
  let mx = 0; for (let i = 0; i < 15; i++) { await espera(150); mx = Math.max(mx, (await deAna(B)).nivel); } console.log('B nivel máximo:', mx.toFixed(3));
  // A se la pone en la espalda y camina; B lo mira
  await ev(A, `radioEspalda(radioMia(), true); JUG.yaw = Math.PI / 2; 1`); await espera(1500);
  r = await deAna(B); console.log('B la ve en la espalda de Ana:', JSON.stringify({ ll: r.ll, enFisica: r.enFisica, aAna: r.aAna, suena: r.suena }));
  await ev(A, `ENT.teclas.add('KeyW'); 1`); await espera(1500); await ev(A, `ENT.teclas.delete('KeyW'); JUG.yaw = 0; 1`); await espera(1200);
  r = await deAna(B); console.log('Ana caminó; la radio va con ella:', JSON.stringify({ aAna: r.aAna, pos: r.pos }));
  await ev(B, `(() => { const R2 = [...RED.remotos.values()][0]; JUG.pos.set(R2.P.pos.x - 2.4, 1.6, R2.P.pos.z - 2.4); const d = vsub(R2.P.pos, v3(JUG.pos.x, JUG.pos.y + 0.6, JUG.pos.z)); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = 0.15; })()`); await espera(1200);
  await B.screenshot({ path: D + 'rr1_B_ve_espalda.png' });
  // A la suelta, la agarra con la pistola de física, la sube y la congela en el aire
  await ev(A, `radioEspalda(radioMia(), false); 1`); await espera(1500);
  await ev(A, `(() => { const e = radioMia(); JUG.pos.set(e.b.pos.x, 1.6, e.b.pos.z - 3); JUG.vel.set(0,0,0); JUG.tercera = false; elegirArma(ARM.lista.indexOf('PhysicsGun')); })()`); await espera(1500);
  await ev(A, `(() => { const e = radioMia(), d = vsub(e.b.pos, CAM.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); })()`); await espera(300);
  await ev(A, `ENT.disparo = true; 1`); await espera(1500);
  console.log('A la agarró:', await ev(A, `String(!!ARM.agarre && ARM.agarre.b === radioMia().b)`));
  await ev(A, `JUG.pitch = -0.6; 1`); await espera(1500);
  await ev(A, `ENT.disparo2 = true; 1`); await espera(400); await ev(A, `ENT.disparo = false; 1`); await espera(2500);
  const pa = JSON.parse(await ev(A, `JSON.stringify({p: [radioMia().b.pos.x, radioMia().b.pos.y, radioMia().b.pos.z], fz: radioMia().b.frozen})`));
  r = await deAna(B);
  console.log('congelada en el aire: A', JSON.stringify(pa), '· B', JSON.stringify({ pos: r.pos, fz: r.fz, noGrab: r.noGrab }), '· diferencia', Math.hypot(...pa.p.map((v, i) => v - r.pos[i])).toFixed(3), 'm');
  await ev(B, `(() => { const e = ENTS.lista.find((x) => x.t === 'radio' && x.dueno !== 'yo'); JUG.pos.set(e.b.pos.x + 3, 1.6, e.b.pos.z - 4); const d = vsub(e.b.pos, v3(JUG.pos.x, JUG.pos.y + 0.6, JUG.pos.z)); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); })()`); await espera(1200);
  await B.screenshot({ path: D + 'rr2_B_ve_congelada.png' });
  // B no la puede agarrar (es de Ana)
  await ev(B, `(() => { const e = ENTS.lista.find((x) => x.t === 'radio' && x.dueno !== 'yo'); const d = vsub(e.b.pos, CAM.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); elegirArma(ARM.lista.indexOf('PhysicsGun')); })()`); await espera(300);
  await ev(B, `ENT.disparo = true; 1`); await espera(400); console.log('B intenta agarrarla:', await ev(B, `ARM.agarre ? 'la agarró (mal)' : 'no puede (bien)'`)); await ev(B, `ENT.disparo = false; 1`);
  // C entra después: la ve congelada en el mismo lugar
  const C = await abrir('C'); await entrar(C, 'Ceci'); await espera(10000);
  r = await deAna(C);
  console.log('C (entró después):', JSON.stringify({ hay: r.hay, vid: r.vid, ll: r.ll, fz: r.fz, diferencia: r.pos ? +Math.hypot(...pa.p.map((v, i) => v - r.pos[i])).toFixed(3) : null, q: r.q }));
} catch (e) { console.log('ERROR', e.message); }
console.log('errores:', errs.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
for (const b of navs) await b.close(); srv.close(); process.exit(0);
