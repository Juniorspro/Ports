// Verity en una sala: Ana la tiene y Beto no. Beto la ve al lado de Ana, ve sus globos y escucha lo que dice (en su
// juego, desde donde está ella); le habla por el chat ("Verity, ...") y ella le contesta a él, pero no le hace caso si le
// pide poner cosas (eso sólo se lo pide su dueña); de noche Beto la ve oscura; si Ana saca el mod, se va también para
// Beto; Beto, con el micrófono de la sala prendido, la llama con la voz ("che Verity ...") y le contesta. La tienda se atiende con worker.js de verdad (TIENDA_SIM = carpeta con el token y la cuenta de Cloudflare).
// uso: BROKER_DIR=carpeta-con-mc/broker TIENDA_SIM=... node red_verity.mjs Hypper.html carpeta
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '.', req = createRequire(S + '/mc/broker/package.json');
const html = process.argv[2], D = (process.argv[3] || '.') + '/';
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8898, '127.0.0.1', r));
// la tienda simulada (la misma para los dos)
const SIM = process.env.TIENDA_SIM, T = fs.readFileSync(SIM + '/token', 'utf8').trim(), A0 = fs.readFileSync(SIM + '/cuenta', 'utf8').trim(), filas = new Map();
const DB = { prepare(sql) { const st = { args: [], bind(...a) { st.args = a; return st; }, async run() { return {}; },
  async first() { if (/RETURNING/.test(sql)) { const k = st.args[0] + '|' + st.args[1], f = filas.get(k) || { c: 0, v: 0 }; f.c += st.args[2]; f.v += st.args[3]; filas.set(k, f); return f; } return null; } }; return st; } };
const AI = { async run(m, inp) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A0}/ai/run/${m}`, { method: 'POST', headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' }, body: JSON.stringify(inp) }); const d = await r.json(); if (!d.success) throw new Error(JSON.stringify(d.errors)); return d.result; } };
const cache = new Map(); globalThis.caches = { default: { async match(r) { const x = cache.get(r.url); return x ? new Response(x) : undefined; }, async put(r, res) { cache.set(r.url, new Uint8Array(await res.arrayBuffer())); } } };
const W = (await import('../tienda/worker.js')).default, env = { DB, AI }, pedidos = [];
const navs = [], errs = [];
const abrir = async (n) => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] }); navs.push(b);
  const c = await b.newContext({ viewport: { width: 960, height: 540 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.route(/\/api\/verity(\/voz)?(\?.*)?$/, async (route) => {
    const q = route.request(), r = await W.fetch(new Request(q.url().replace(/^https:\/\/[^/]+/, 'https://x.dev'), { method: q.method(), headers: { 'Content-Type': 'application/json' }, body: q.method() === 'POST' ? q.postData() : undefined }), env);
    const body = Buffer.from(await r.arrayBuffer()); pedidos.push({ de: n, u: q.url().replace(/^.*\/api\//, '').slice(0, 30), st: r.status, r: /json/.test(r.headers.get('content-type') || '') ? body.toString().slice(0, 200) : body.length + 'B' });
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body });
  });
  await p.addInitScript(() => {
    window.__oidos = [];
    window.webkitSpeechRecognition = window.SpeechRecognition = class { constructor() { this.vivo = false; window.__oidos.push(this); } start() { this.vivo = true; } stop() { this.vivo = false; setTimeout(() => this.onend && this.onend(), 10); } abort() { this.stop(); } };
    window.__oir = (t, fin) => { const r = [...window.__oidos].reverse().find((x) => x.vivo); if (!r) return false; const res = [{ transcript: t }]; res.isFinal = !!fin; r.onresult({ resultIndex: 0, results: [res] }); return true; };
  });
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8898/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 150000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c), espera = (ms) => new Promise((r) => setTimeout(r, ms));
let fallas = 0; const ok = (b, t, x) => { if (!b) fallas++; console.log((b ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '')); };
const entrar = (P, n, mods) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.modsSrv = ${JSON.stringify(mods)}; PREFS.mods = {}; localStorage.removeItem('rb_verity'); audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
try {
  const A = await abrir('A'), B = await abrir('B');
  await entrar(A, 'Ana', { verity: true }); await entrar(B, 'Beto', {}); await espera(9000);
  await ev(A, `DIA.hora = 13; DIA.ciclo = false; DIA.aplicada = -1; JUG.pos.set(10, 1.6, 5); JUG.yaw = 0; JUG.pitch = 0; JUG.vel.set(0,0,0); 1`); await ev(B, `DIA.hora = 13; DIA.ciclo = false; DIA.aplicada = -1; JUG.pos.set(10, 1.6, 12); JUG.yaw = Math.PI; JUG.pitch = 0.05; JUG.tercera = false; JUG.vel.set(0,0,0); 1`);
  // (con dos navegadores sin placa el juego anda a 2-3 cuadros por segundo: se espera a que llegue al lado de Ana)
  for (let i = 0; i < 150 && Number(await ev(A, `VER.yo.vel.len() + VER.yo.pos.distTo(verMeta())`)) > 0.15; i++) await espera(400);
  await espera(2500);
  const ve = JSON.parse(await ev(B, `JSON.stringify((() => { const [id, I] = [...VER.rem.entries()][0] || []; const R2 = id && RED.remotos.get(id); return { n: VER.rem.size, yo: VER.on, cerca: I && R2 ? +I.pos.distTo(R2.P.pos).toFixed(2) : null, nombre: R2 && R2.nombre }; })())`));
  const posA = JSON.parse(await ev(A, `JSON.stringify([VER.yo.pos.x, VER.yo.pos.y, VER.yo.pos.z])`)), posB = JSON.parse(await ev(B, `JSON.stringify((() => { const I = [...VER.rem.values()][0]; return I ? [I.pos.x, I.pos.y, I.pos.z] : null; })())`));
  const dif = posB ? Math.hypot(posA[0] - posB[0], posA[1] - posB[1], posA[2] - posB[2]) : 99;
  ok(ve.n === 1 && !ve.yo && ve.nombre === 'Ana' && ve.cerca < 2.5 && dif < 0.25, 'Beto (sin el mod) ve la Verity de Ana al lado de ella, donde Ana la ve', { ...ve, dif: +dif.toFixed(3) });
  await B.screenshot({ path: D + 'rv1_beto_ve.png' });
  // Ana le habla: Beto ve el globo y lo escucha (voz en su juego)
  await ev(A, `verPreguntar('contale un chiste corto a Beto'); 1`);
  let g = null; for (let i = 0; i < 100; i++) { await espera(200); g = JSON.parse(await ev(B, `JSON.stringify((() => { const I = [...VER.rem.values()][0]; return I ? { tx: I.burbTx, vis: !!(I.burb && I.burb.style.display !== 'none'), voz: !!I.voz || I.nav || I.falsa > 0, chat: CHAT.some((c) => /^Verity \\(Ana\\)/.test(c.t)) } : null; })())`)); if (g && g.tx && g.voz) break; }
  ok(g && g.tx && g.vis && g.voz && g.chat, 'lo que dice la de Ana le llega a Beto (globo, voz y chat)', g);
  await espera(600); await B.screenshot({ path: D + 'rv2_beto_globo.png' });
  for (let i = 0; i < 60 && (await ev(A, `VER.pensando`)); i++) await espera(200); await espera(4000);
  // Beto le habla por el chat
  const nA = Number(await ev(A, `VER.hist.length`));
  await ev(B, `chatEnviar('Verity, hola! soy Beto, ¿cómo te llamás?'); 1`);
  let r = null; for (let i = 0; i < 100; i++) { await espera(200); r = JSON.parse(await ev(A, `JSON.stringify({ n: VER.hist.length, h: VER.hist.slice(-2) })`)); if (r.n >= nA + 2 && !(await ev(A, `VER.pensando`))) break; }
  ok(r.n >= nA + 2 && /Beto/.test(r.h[0][1]), 'Beto le habla por el chat y la de Ana le contesta', r.h);
  await espera(1500);
  const lleg = await ev(B, `(() => { const I = [...VER.rem.values()][0]; return !!(I && I.burbTx && CHAT.filter((c) => /^Verity \\(Ana\\)/.test(c.t)).length >= 2); })()`);
  ok(lleg, 'y Beto ve la respuesta');
  await espera(4000);
  // Beto le pide poner cosas: no se las pone (sólo su dueña)
  const o0 = Number(await ev(A, `OBJS.length`));
  await ev(B, `chatEnviar('Verity, poné 5 autos y construí una casa'); 1`);
  for (let i = 0; i < 100; i++) { await espera(200); if (Number(await ev(A, `VER.hist.length`)) >= nA + 4 && !(await ev(A, `VER.pensando`))) break; }
  await espera(2500);
  ok(Number(await ev(A, `OBJS.length`)) === o0, 'a otro jugador no le pone cosas en nombre de Ana', Number(await ev(A, `OBJS.length`)) - o0);
  // Beto prende el micrófono de la sala y la llama con la voz
  await ev(B, `VOZ.on = true; 1`); await espera(1500);
  const oye = await ev(B, `!!(OIDO.r && OIDO.r.vivo)`);
  const nV = Number(await ev(A, `VER.hist.length`));
  await ev(B, `__oir('che Verity, ¿me escuchás? soy Beto', true); 1`);
  let rv = null; for (let i = 0; i < 100; i++) { await espera(200); rv = JSON.parse(await ev(A, `JSON.stringify({ n: VER.hist.length, h: VER.hist.slice(-2) })`)); if (rv.n >= nV + 2 && !(await ev(A, `VER.pensando`))) break; }
  ok(oye && rv.n >= nV + 2 && /Beto/.test(rv.h[0][1]), 'Beto (sin el mod, con el micrófono de la sala) la llama con la voz y ella le contesta', { oye, h: rv.h });
  await ev(B, `VOZ.on = false; 1`); await espera(4000);
  // de noche: Beto la ve oscura
  await ev(A, `DIA.hora = 23; DIA.aplicada = -1; VER.oscura = 1; 1`); await espera(1500);
  ok(await ev(B, `(() => { const I = [...VER.rem.values()][0]; return !!(I && I.noche); })()`), 'de noche Beto la ve en su fase oscura');
  await ev(B, `DIA.hora = 23; DIA.aplicada = -1; 1`); await espera(800); await B.screenshot({ path: D + 'rv3_beto_noche.png' });
  // Ana saca el mod
  await ev(A, `PREFS.modsSrv = {}; smAplicar(false); natIniciar([]); 1`); await espera(3000);
  ok(Number(await ev(B, `VER.rem.size`)) === 0, 'si Ana saca el mod, se va también para Beto');
  console.log('  pedidos:', pedidos.map((x) => x.de + ':' + x.u + ' ' + x.st).join(' | '));
} catch (e) { console.log('ERROR', e.message); fallas++; }
console.log('errores:', errs.slice(0, 6).join(' | ') || 'ninguno');
for (const b of navs) await b.close(); srv.close(); aedes.close(); process.exit(fallas ? 1 : 0);
