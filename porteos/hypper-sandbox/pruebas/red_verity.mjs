// Verity en una sala (bot del server): Ana y Beto entran sin ningún mod y hay una sola Verity para los dos (la maneja
// uno; el otro la ve en el mismo lugar). El que no la maneja le habla por el chat y con la voz ("che Verity ..."), le
// pide construir (lo ven los dos), la agarra con la pistola de física y la tira (el que la maneja la ve llevada y
// cayendo). Al irse el que la maneja, el otro la sigue manejando desde donde estaba. La tienda se atiende con
// worker.js de verdad (TIENDA_SIM = carpeta con el token y la cuenta de Cloudflare).
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
    const body = Buffer.from(await r.arrayBuffer()); pedidos.push({ de: n, u: q.url().replace(/^.*\/api\//, '').slice(0, 30), st: r.status });
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body });
  });
  await p.addInitScript(() => {
    // el reconocedor de voz del navegador, de mentira: la prueba le hace "oír" frases
    window.__oidos = [];
    window.webkitSpeechRecognition = window.SpeechRecognition = class { constructor() { this.vivo = false; window.__oidos.push(this); } start() { this.vivo = true; } stop() { this.vivo = false; setTimeout(() => this.onend && this.onend(), 10); } abort() { this.stop(); } };
    window.__oir = (t, fin) => { const r = [...window.__oidos].reverse().find((x) => x.vivo); if (!r) return false; const res = [{ transcript: t }]; res.isFinal = !!fin; r.onresult({ resultIndex: 0, results: [res] }); return true; };
  });
  await p.goto('file://' + html + '?test&broker=ws://127.0.0.1:8898/mqtt'); await p.waitForFunction(() => window.__listo, null, { timeout: 150000 }); return p; };
const ev = (p, c) => p.evaluate((c) => window.__ev(c), c), espera = (ms) => new Promise((r) => setTimeout(r, ms));
let fallas = 0; const ok = (b, t, x) => { if (!b) fallas++; console.log((b ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '')); };
const entrar = (P, n) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.modsSrv = {}; PREFS.mods = {}; localStorage.removeItem('rb_verity'); audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
const estado = (P) => ev(P, `JSON.stringify({ on: VER.on, rem: VER.rem.size, id: RED.ID, pos: VER.on ? [VER.yo.pos.x, VER.yo.pos.y, VER.yo.pos.z] : (() => { const I = [...VER.rem.values()][0]; return I ? [I.pos.x, I.pos.y, I.pos.z] : null; })() })`).then(JSON.parse);
try {
  const A = await abrir('A'), B = await abrir('B');
  await entrar(A, 'Ana'); await entrar(B, 'Beto'); await espera(9000);
  await ev(A, `DIA.hora = 13; DIA.ciclo = false; DIA.aplicada = -1; JUG.pos.set(10, 1.6, 5); JUG.yaw = 0; JUG.pitch = 0; JUG.vel.set(0,0,0); 1`); await ev(B, `DIA.hora = 13; DIA.ciclo = false; DIA.aplicada = -1; JUG.pos.set(10, 1.6, 12); JUG.yaw = Math.PI; JUG.pitch = 0.05; JUG.tercera = false; JUG.vel.set(0,0,0); 1`);
  // una sola Verity para los dos (sin que nadie tenga el mod)
  let a, b; for (let i = 0; i < 80; i++) { await espera(500); a = await estado(A); b = await estado(B); if ((a.on ? 1 : 0) + (b.on ? 1 : 0) === 1 && (a.on ? b.rem : a.rem) === 1) break; }
  ok((a.on ? 1 : 0) + (b.on ? 1 : 0) === 1 && (a.on ? b.rem : a.rem) === 1 && (a.on ? a.rem : b.rem) === 0, 'una sola Verity en la sala, sin el mod: la maneja uno y el otro la ve', { a: { on: a.on, rem: a.rem }, b: { on: b.on, rem: b.rem } });
  const [C, O, nC, nO] = a.on ? [A, B, 'Ana', 'Beto'] : [B, A, 'Beto', 'Ana'];
  ok((a.on ? a.id < b.id : b.id < a.id), 'la maneja el de id más chico', { a: a.id, b: b.id });
  // los dos la ven en el mismo lugar (una vez quieta)
  await ev(C, `VER.modo = 'quieta'; VER.ancla = vadd(JUG.pos, v3(0, 0.6, 3.5)); VER.tModo = 999; 1`);
  for (let i = 0; i < 60 && Number(await ev(C, `VER.yo.vel.len() + VER.yo.pos.distTo(VER.ancla)`)) > 0.1; i++) await espera(400);
  await espera(2500); const pc = (await estado(C)).pos, po = (await estado(O)).pos, dif = Math.hypot(pc[0] - po[0], pc[1] - po[1], pc[2] - po[2]);
  ok(dif < 0.3, 'los dos la ven en el mismo lugar', +dif.toFixed(3));
  await O.screenshot({ path: D + 'rv1_otro_ve.png' });
  await ev(C, `VER.modo = 'libre'; verPlan('visitar', 60, { quien: [...RED.remotos.keys()][0] }); 1`); await espera(3000);
  // el que no la maneja le habla por el chat
  const n0 = Number(await ev(C, `VER.hist.length`));
  await ev(O, `chatEnviar('Verity, hola! soy ${nO}, ¿me ves?'); 1`);
  let r = null; for (let i = 0; i < 100; i++) { await espera(200); r = JSON.parse(await ev(C, `JSON.stringify({ n: VER.hist.length, h: VER.hist.slice(-2), plan: VER.plan && VER.plan.n })`)); if (r.n >= n0 + 2 && !(await ev(C, `VER.pensando`))) break; }
  ok(r.n >= n0 + 2 && new RegExp(nO).test(r.h[0][1]), 'el otro le habla por el chat y ella le contesta', r.h);
  await espera(1500); ok(await ev(O, `CHAT.some((c) => /^Verity \\(/.test(c.t)) && VER.hist.some((h) => h[0] === 'v')`), 'y él ve la respuesta (chat y su panel)');
  await espera(3000);
  // con la voz (cerca de ella)
  const oye = await ev(O, `!!(OIDO.r && OIDO.r.vivo)`), n1 = Number(await ev(C, `VER.hist.length`));
  await ev(O, `__oir('che Verity, contame algo corto', true); 1`);
  for (let i = 0; i < 100; i++) { await espera(200); r = JSON.parse(await ev(C, `JSON.stringify({ n: VER.hist.length, h: VER.hist.slice(-2) })`)); if (r.n >= n1 + 2 && !(await ev(C, `VER.pensando`))) break; }
  ok(oye && r.n >= n1 + 2 && /contame/.test(r.h[0][1]), 'y con la voz ("che Verity ...")', { oye, h: r.h });
  await espera(3000);
  // le pide construir: lo hace (en la sala, cualquiera le puede pedir cosas) y lo ven los dos
  const ob0 = Number(await ev(O, `OBJS.length`));
  await ev(O, `chatEnviar('Verity, construime una torre acá'); 1`);
  let ob = 0; for (let i = 0; i < 120; i++) { await espera(250); ob = Number(await ev(O, `OBJS.length`)) - ob0; if (ob >= 24) break; }
  ok(ob >= 20, 'le pide una torre y la construye (los dos la ven)', { cajasQueVeElOtro: ob, mias: Number(await ev(C, `VER.mios.length`)) });
  await O.screenshot({ path: D + 'rv2_torre.png' });
  await ev(C, `verAcciones([{ a: 'limpiar' }]); VER.modo = 'quieta'; VER.ancla = vadd(JUG.pos, v3(0, 0.6, 3.5)); VER.tModo = 999; 1`); await espera(4000);
  // el otro la agarra con la pistola de física y la lleva: el que la maneja la ve llevada
  const apuntar = `(() => { const I = [...VER.rem.values()][0], d = vsub(I.pos, CAM.pos).norm(); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.asin(d.y); return 1; })()`;
  await ev(O, `elegirArma(Math.max(0, ARM.lista.indexOf('PhysicsGun'))); 1`);
  let toca = false; for (let i = 0; i < 20 && !toca; i++) { await ev(O, apuntar); await espera(200); toca = await ev(O, `(() => { const h = raycast(CAM.pos, CAM.fwd, 50, null); return !!(h && h.body && h.body.verity); })()`); }
  await ev(O, `ENT.disparo = true; 1`); await espera(600);
  await ev(O, `JUG.yaw += 0.7; 1`); await espera(1500);
  await espera(2000); // (con la pistola quieta: así se compara dónde la ve cada uno sin el atraso de la red)
  const g = JSON.parse(await ev(C, `JSON.stringify({ fis: VER.yo.fis, p: [VER.yo.pos.x, VER.yo.pos.y, VER.yo.pos.z] })`)), go = JSON.parse(await ev(O, `(() => { const I = [...VER.rem.values()][0]; return JSON.stringify({ fis: I.fis, p: [I.pos.x, I.pos.y, I.pos.z] }); })()`));
  const dg = Math.hypot(g.p[0] - go.p[0], g.p[1] - go.p[1], g.p[2] - go.p[2]);
  ok(go.fis === 'agarrada' && g.fis === 'remota' && dg < 0.8, 'el otro la agarra con la pistola y el que la maneja la ve llevada', { maneja: g.fis, otro: go.fis, dif: +dg.toFixed(2) });
  if (go.fis !== 'agarrada') console.log('  diag:', await ev(O, `(() => { const I = [...VER.rem.values()][0], h = raycast(CAM.pos, CAM.fwd, 50, null); return JSON.stringify({ armas: ARM.lista, arma: ARM.lista[ARM.i], agarre: !!ARM.agarre, cuerpo: !!I.b, enPH: PH.bodies.includes(I.b), held: I.b && I.b.held, hit: h ? { t: +h.t.toFixed(2), verity: !!(h.body && h.body.verity) } : null, d: +I.pos.distTo(CAM.pos).toFixed(2), disp: ENT.disparo, abierto: UI.abierto }); })()`));
  await O.screenshot({ path: D + 'rv3_agarrada.png' });
  // la tira
  await ev(O, `ENT.disparo = false; soltarAgarre(); const I = [...VER.rem.values()][0]; I.b.vel.set(Math.sin(JUG.yaw) * 10, 3, Math.cos(JUG.yaw) * 10); 1`); await espera(500);
  let st = null; for (let i = 0; i < 40; i++) { await espera(250); st = await ev(C, `VER.yo.fis`); if (st === 'suelta') break; }
  ok(st === 'suelta', 'la tira: el que la maneja la ve volar y caer', st);
  for (let i = 0; i < 40 && (await ev(C, `VER.yo.fis !== 'libre'`)); i++) await espera(250);
  await espera(2000);
  // se va el que la maneja: el otro la sigue desde donde estaba
  await ev(C, `VER.modo = 'quieta'; VER.ancla = VER.yo.pos.clone(); VER.tModo = 999; 1`); await espera(3000);
  const antes = (await estado(O)).pos;
  await ev(C, `salirSala ? salirSala() : (typeof volverMenu === 'function' && volverMenu()); 1`).catch(() => {});
  await navs[a.on ? 0 : 1].close();
  let o2 = null; for (let i = 0; i < 60; i++) { await espera(500); o2 = await estado(O); if (o2.on) break; }
  const tom = o2.on ? JSON.parse(await ev(O, `JSON.stringify(VER.tomada ? [VER.tomada.pos.x, VER.tomada.pos.y, VER.tomada.pos.z] : null)`)) : null;
  const dd = tom ? Math.hypot(tom[0] - antes[0], tom[1] - antes[1], tom[2] - antes[2]) : 99;
  ok(o2.on && dd < 2, 'se va el que la maneja: el otro la sigue manejando desde donde estaba', { on: o2.on, salto: +dd.toFixed(2) });
  console.log('  pedidos:', pedidos.length, pedidos.slice(-6).map((x) => x.de + ':' + x.u + ' ' + x.st).join(' | '));
} catch (e) { console.log('ERROR', e.message); fallas++; }
console.log('errores:', errs.filter((e) => !/isExternalMethodAvailable/.test(e)).slice(0, 6).join(' | ') || 'ninguno');
for (const b of navs) await b.close().catch(() => {}); srv.close(); aedes.close(); process.exit(fallas ? 1 : 0);
