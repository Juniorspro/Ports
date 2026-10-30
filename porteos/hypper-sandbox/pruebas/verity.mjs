// mod Verity jugando solo: aparece y viene a verte (se ve, mira a la cámara) pero no te sigue; se la agarra, tira,
// congela y empuja con las pistolas y a tiros; charla con el
// cerebro de la tienda (se atiende con worker.js de verdad: TIENDA_SIM = carpeta con el token y la cuenta de Cloudflare),
// habla con voz (la boca se mueve con el sonido), hace lo que le piden (construir, poner props, la hora, limpiar),
// recuerda, se le habla por el chat; tiene vida propia (sola rueda por ahí, va a mirar cosas, juega con una pelota y se
// duerme si se cansa), sus animaciones (rodar, rebotar, saltar...), y el oído: con un reconocedor de voz de mentira, sólo
// reacciona a "hey/che Verity". En el celular, además, que el botón SM no tape a pausa. Capturas en la carpeta.
// uso: node verity.mjs Hypper.html carpeta [celu]
import { abrir } from './base.mjs';
import fs from 'fs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', celu = process.argv[4] === 'celu';
const { b, p, err, ev } = await abrir(HTML, celu, [], (pg) => pg.addInitScript(() => {
  // el reconocedor de voz del navegador, de mentira: la prueba le hace "oír" frases
  window.__oidos = [];
  window.webkitSpeechRecognition = window.SpeechRecognition = class { constructor() { this.vivo = false; window.__oidos.push(this); } start() { this.vivo = true; } stop() { this.vivo = false; setTimeout(() => this.onend && this.onend(), 10); } abort() { this.stop(); } };
  window.__oir = (t, fin) => { const r = [...window.__oidos].reverse().find((x) => x.vivo); if (!r) return false; const res = [{ transcript: t }]; res.isFinal = !!fin; r.onresult({ resultIndex: 0, results: [res] }); return true; };
}));
const espera = (ms) => p.waitForTimeout(ms), ok = (c, t, x) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '')); if (!c) ok.n = (ok.n || 0) + 1; };
// ---- la tienda: worker.js con D1 y caché de mentira; Workers AI por REST si hay credenciales ----
let pedidos = [];
const SIM = process.env.TIENDA_SIM;
if (SIM) {
  const T = fs.readFileSync(SIM + '/token', 'utf8').trim(), A = fs.readFileSync(SIM + '/cuenta', 'utf8').trim(), filas = new Map();
  const DB = { prepare(sql) { const st = { args: [], bind(...a) { st.args = a; return st; },
    async run() { if (/INSERT INTO ia_uso \(dia, ip, n\)/.test(sql)) { const k = st.args[0] + '|*', f = filas.get(k) || { c: 0, v: 0, n: 0 }; f.n += st.args[1]; filas.set(k, f); } return {}; },
    async first() { if (/RETURNING/.test(sql)) { const k = st.args[0] + '|' + st.args[1], f = filas.get(k) || { c: 0, v: 0, n: 0 }; f.c += st.args[2]; f.v += st.args[3]; filas.set(k, f); return f; } if (/SELECT n FROM ia_uso/.test(sql)) return filas.get(st.args[0] + '|*') || null; return null; } }; return st; } };
  const AI = { async run(m, inp) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}/ai/run/${m}`, { method: 'POST', headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' }, body: JSON.stringify(inp) }); const d = await r.json(); if (!d.success) throw new Error(JSON.stringify(d.errors)); return d.result; } };
  const cache = new Map(); globalThis.caches = { default: { async match(r) { const x = cache.get(r.url); return x ? new Response(x) : undefined; }, async put(r, res) { cache.set(r.url, new Uint8Array(await res.arrayBuffer())); } } };
  const W = (await import('../tienda/worker.js')).default, env = { DB, AI };
  await p.route(/\/api\/verity(\/voz)?(\?.*)?$/, async (route) => {
    const q = route.request(), t0 = Date.now();
    const r = await W.fetch(new Request(q.url().replace(/^https:\/\/[^/]+/, 'https://x.dev'), { method: q.method(), headers: { 'Content-Type': 'application/json' }, body: q.method() === 'POST' ? q.postData() : undefined }), env);
    const body = Buffer.from(await r.arrayBuffer()); pedidos.push({ u: q.url().replace(/^.*\/api\//, ''), st: r.status, ms: Date.now() - t0, n: body.length, d: q.method() === 'POST' ? JSON.parse(q.postData()) : null, r: /json/.test(r.headers.get('content-type') || '') ? body.toString() : '' });
    fs.writeFileSync(D + 'pedidos.json', JSON.stringify(pedidos, null, 1));
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body });
  });
}
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.resDin=false; PREFS.lang='es'; PREFS.nombre='Juni'; localStorage.removeItem('rb_verity'); PREFS.mods = {verity: true}; inicioMostrar(false); RB.mapaPartida=null; RB.mapaCom=null; RB.horaPartida='normal'; empezarPartida('FlatGrass')`);
await espera(5000);
await ev(`audioIniciar(); DIA.hora = 13; DIA.ciclo = false; DIA.aplicada = -1; JUG.vel.set(0,0,0); JUG.pitch = 0.05; 1`);
await espera(1500);
// ---- aparece al lado, se ve en primera persona y mira a la cámara ----
const vis = async () => JSON.parse(await ev(`(() => { const I = VER.yo, cl = clipDe(I.pos), a = vsub(CAM.pos, I.pos); const df = Math.atan2(a.x, a.z) - I.yaw;
  return JSON.stringify({ on: VER.on, bt: !!(VER.bt && VER.bt.style.display !== 'none' && VER.bt.getBoundingClientRect().width > 20), d: +I.pos.distTo(CAM.pos).toFixed(2), x: cl ? Math.round(cl.x) : null, y: cl ? Math.round(cl.y) : null,
    W: VW(), H: VH(), mira: +Math.abs(Math.atan2(Math.sin(df), Math.cos(df)) * 180 / Math.PI).toFixed(1), alto: +(I.pos.y - JUG.pos.y).toFixed(2) }); })()`));
// (aparece arriba y baja flotando: se espera a que llegue a su lugar)
for (let i = 0; i < 60 && Number(await ev(`VER.yo ? Math.abs(VER.yo.pos.y - verMeta().y) + VER.yo.vel.len() : 9`)) > 0.08; i++) await espera(250);
let v = await vis();
ok(v.on && v.bt, 'con el mod aparece Verity y su botón', v);
ok(v.x !== null && v.x > v.W * 0.3 && v.x < v.W * 0.97 && v.y > v.H * 0.15 && v.y < v.H * 0.85 && v.d > 1 && v.d < 2.6, 'aparece y viene a verte (se ve en primera persona)', v);
ok(v.mira < 12, 'mira a la cámara', v.mira + '°');
await p.screenshot({ path: D + 'v0_primera.png' });
await ev(`JUG.tercera = true; 1`); await espera(1500); v = await vis();
ok(v.x !== null && v.x > 0 && v.x < v.W && v.y > 0 && v.y < v.H, 'en tercera persona también se ve', v);
await p.screenshot({ path: D + 'v1_tercera.png' });
// de cerca, de frente (la cara: centrada, sin espejar y con bordes transparentes)
await ev(`(() => { const I = VER.yo; VER.modo = 'quieta'; VER.ancla = I.pos.clone(); const f = v3(Math.sin(I.yaw), 0, Math.cos(I.yaw)); DBG.cam = { p: vadd(I.pos, vadd(vscale(f, 0.95), v3(0, 0.05, 0))), q: Quat.euler(I.yaw + Math.PI, 0.05) }; I.emo = 'feliz'; return 1; })()`);
await espera(700); await p.screenshot({ path: D + 'v2_cara.png' });
for (const e of ['risa', 'sorpresa', 'triste', 'enojada', 'picara', 'siniestra']) { await ev(`VER.yo.emo = '${e}'; VER.yo.emoT = 5; 1`); await espera(250); await p.screenshot({ path: D + 'v2_cara_' + e + '.png' }); }
// de costado y de atrás (que la cara no se vea por detrás y la esfera sea redonda)
await ev(`(() => { const I = VER.yo, f = v3(Math.sin(I.yaw + 1.4), 0, Math.cos(I.yaw + 1.4)); DBG.cam = { p: vadd(I.pos, vscale(f, 1)), q: Quat.euler(I.yaw + 1.4 + Math.PI, 0) }; I.emo = 'feliz'; return 1; })()`);
await espera(400); await p.screenshot({ path: D + 'v3_costado.png' });
await ev(`(() => { const I = VER.yo, f = v3(Math.sin(I.yaw + Math.PI), 0, Math.cos(I.yaw + Math.PI)); DBG.cam = { p: vadd(I.pos, vscale(f, 1)), q: Quat.euler(I.yaw, 0) }; return 1; })()`);
await espera(400); await p.screenshot({ path: D + 'v4_atras.png' });
await ev(`DBG.cam = null; VER.modo = 'seguir'; JUG.tercera = false; 1`); await espera(600);
// ---- sigue al jugador ----
await ev(`VER.modo = 'libre'; verPlan('pasear', 40, { c: VER.yo.pos.clone() }); VER.plan.dest = vadd(VER.yo.pos, v3(-14, 0, 6)); VER.plan.tDest = 30; JUG.pos.x += 14; 1`);
let sig = 0; for (let i = 0; i < 12; i++) { await espera(300); sig = Math.max(sig, Number(await ev(`VER.yo.pos.distTo(JUG.pos)`))); }
ok(sig > 10, 'no te sigue: si te vas mientras ella pasea, sigue en lo suyo', +sig.toFixed(1));
await ev(`JUG.pos.x -= 14; verPlan('visitar', 20, { quien: 'yo' }); 1`); await espera(2500);
// ---- agarrarla con la pistola de física, moverla, tirarla y congelarla ----
const apuntar = `(() => { const d = vsub(VER.yo.pos, CAM.pos).norm(); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.asin(d.y); return 1; })()`;
for (let i = 0; i < 4; i++) { await ev(apuntar); await espera(150); }
await ev(`elegirArma(Math.max(0, ARM.lista.indexOf('PhysicsGun'))); ENT.disparo = true; 1`); await espera(400); // (el gatillo apretado: la agarra y la lleva)
const ag0 = JSON.parse(await ev(`JSON.stringify({ fis: VER.yo.fis, p: [VER.yo.pos.x, VER.yo.pos.y, VER.yo.pos.z], agarre: !!(ARM.agarre && ARM.agarre.b === VER.yo.b) })`));
await ev(`JUG.yaw += 0.8; JUG.pitch -= 0.25; 1`); await espera(1200);
const ag1 = JSON.parse(await ev(`JSON.stringify({ fis: VER.yo.fis, p: [VER.yo.pos.x, VER.yo.pos.y, VER.yo.pos.z], emo: VER.yo.emo })`));
const mov = Math.hypot(ag1.p[0] - ag0.p[0], ag1.p[1] - ag0.p[1], ag1.p[2] - ag0.p[2]);
ok(ag0.agarre && ag0.fis === 'agarrada' && ag1.fis === 'agarrada' && mov > 1, 'la pistola de física la agarra y la lleva', { mov: +mov.toFixed(2), emo: ag1.emo });
await ev(`JUG.tercera = true; 1`); await espera(300); await p.screenshot({ path: D + 'v14_agarrada.png' }); await ev(`JUG.tercera = false; 1`);
// tirarla: se le da velocidad y se suelta
await ev(`ENT.disparo = false; soltarAgarre(); VER.yo.b.vel.set(Math.sin(JUG.yaw) * 9, 4, Math.cos(JUG.yaw) * 9); 1`); await espera(300);
const t1 = JSON.parse(await ev(`JSON.stringify({ fis: VER.yo.fis, v: +VER.yo.b.vel.len().toFixed(1) })`));
let cae = null; for (let i = 0; i < 40; i++) { await espera(150); cae = JSON.parse(await ev(`JSON.stringify({ fis: VER.yo.fis, alto: VER.yo.piso !== null ? +(VER.yo.pos.y - (pisoBajo(VER.yo.pos, 0.3) ?? 0)).toFixed(2) : null })`)); if (cae.fis === 'libre') break; }
ok(t1.fis === 'suelta' && cae.fis === 'libre', 'tirada: vuela, cae, rebota y vuelve a flotar', { t1, cae });
// congelarla en el aire
for (let i = 0; i < 4; i++) { await ev(apuntar); await espera(150); }
await ev(`ENT.disparo = true; 1`); await espera(300); await ev(`JUG.pitch -= 0.2; 1`); await espera(500); await ev(`ENT.disparo2 = true; 1`); await espera(200); await ev(`ENT.disparo = false; 1`); await espera(300); // (clic derecho mientras la agarra: queda congelada)
const c0 = JSON.parse(await ev(`JSON.stringify({ fis: VER.yo.fis, p: [VER.yo.pos.x, VER.yo.pos.y, VER.yo.pos.z] })`)); await espera(2000);
const c1 = JSON.parse(await ev(`JSON.stringify({ fis: VER.yo.fis, p: [VER.yo.pos.x, VER.yo.pos.y, VER.yo.pos.z] })`));
ok(c0.fis === 'congelada' && c1.fis === 'congelada' && Math.hypot(c1.p[0] - c0.p[0], c1.p[1] - c0.p[1], c1.p[2] - c0.p[2]) < 0.05, 'congelada (clic derecho): se queda quieta en el aire', c1);
await ev(`VER.yo.tFis = 0; 1`); await espera(800);
// la pistola de gravedad la empuja, y los tiros también
for (let i = 0; i < 4; i++) { await ev(apuntar); await espera(150); }
const g0 = JSON.parse(await ev(`JSON.stringify([VER.yo.pos.x, VER.yo.pos.z])`)); await ev(`gravPrimario(); 1`); await espera(700);
const g1 = JSON.parse(await ev(`JSON.stringify({ fis: VER.yo.fis, p: [VER.yo.pos.x, VER.yo.pos.z] })`));
ok(Math.hypot(g1.p[0] - g0[0], g1.p[1] - g0[1]) > 1.5, 'la pistola de gravedad la empuja', g1);
for (let i = 0; i < 40 && (await ev(`VER.yo.fis !== 'libre'`)); i++) await espera(150);
await ev(`verPlan('visitar', 20, { quien: 'yo' }); 1`); await espera(2500); for (let i = 0; i < 4; i++) { await ev(apuntar); await espera(150); }
const s0 = JSON.parse(await ev(`JSON.stringify([VER.yo.pos.x, VER.yo.pos.z])`)); await ev(`impactoBala(CAM.pos.clone(), CAM.fwd.clone(), DEF_ARMAS[ARM.lista[0]] || {}, 25); 1`); await espera(500);
const s1 = JSON.parse(await ev(`JSON.stringify({ fis: VER.yo.fis, emo: VER.yo.emo, p: [VER.yo.pos.x, VER.yo.pos.z] })`));
ok(Math.hypot(s1.p[0] - s0[0], s1.p[1] - s0[1]) > 0.5 && s1.emo === 'enojada', 'un tiro la empuja (y se enoja)', s1);
for (let i = 0; i < 40 && (await ev(`VER.yo.fis !== 'libre'`)); i++) await espera(150);
await ev(`verPlan('visitar', 30, { quien: 'yo' }); JUG.yaw = 0; JUG.pitch = 0.05; 1`); await espera(2500); v = await vis();
// costo por cuadro con y sin ella
await espera(1500); const msCon = Number(await ev(`TIEMPO.msProm`));
// ---- charlar: saludo (evento) y pedidos ----
const ultima = () => { const x = [...pedidos].reverse().find((y) => y.r); return x ? x.r.slice(0, 220) : ''; };
const charla = async (q, ms) => { const n0 = Number(await ev(`VER.hist.length`)); await ev(`verPreguntar(${JSON.stringify(q)}); 1`); for (let i = 0; i < (ms || 45000) / 200; i++) { await espera(200); if (!(await ev(`VER.pensando`)) && Number(await ev(`VER.hist.length`)) > n0) break; } return JSON.parse(await ev(`JSON.stringify({ hist: VER.hist.slice(-2), emo: VER.yo.emo, voz: !!VER.yo.voz, nav: VER.yo.nav, sinCF: VER.sinCF, sinVozCF: VER.sinVozCF })`)); };
await espera(3000);
let c = await charla('hola Verity! me llamo Juni y me encanta el rock');
ok(c.hist.length === 2 && c.hist[1][0] === 'v', 'contesta', c.hist[1]);
// la voz: la boca se mueve con el sonido
let bocaMax = 0, conVoz = false; for (let i = 0; i < 25; i++) { await espera(120); const x = JSON.parse(await ev(`JSON.stringify({ b: VER.yo.boca, v: !!VER.yo.voz || VER.yo.nav })`)); bocaMax = Math.max(bocaMax, x.b); conVoz = conVoz || x.v; }
ok(conVoz && bocaMax > 0.25, 'habla con voz y mueve la boca', { bocaMax: +bocaMax.toFixed(2), voz: c.voz, nav: c.nav, sinVozCF: c.sinVozCF });
await p.screenshot({ path: D + 'v5_habla.png' });
await espera(4000);
const mem = JSON.parse(await ev(`localStorage.getItem('rb_verity') || 'null'`));
ok(mem && mem.d.some((x) => /rock|juni/i.test(x)), 'se acuerda (memoria en este aparato)', mem && mem.d);
// construir
const n0 = Number(await ev(`OBJS.length`));
c = await charla('construime una torre');
await espera(5000);
const ob = JSON.parse(await ev(`JSON.stringify({ mios: VER.mios.length, obj: OBJS.length, cong: VER.mios.every((o) => o.b.frozen), obra: !!VER.obra, nom: VER.mios[0] && VER.mios[0].nombre })`));
ok(ob.mios >= 20 && ob.cong && !ob.obra, 'construye una torre de cajas', { ...ob, dijo: c.hist[1] });
await ev(`JUG.tercera = true; JUG.yaw += 0.3; 1`); await espera(900); await p.screenshot({ path: D + 'v6_torre.png' }); await ev(`JUG.tercera = false; JUG.yaw -= 0.3; 1`);
// apilada sin huecos: cada caja apoyada en la de abajo (o en el piso)
const torre = JSON.parse(await ev(`(() => { const L = VER.mios.filter((o) => o.nombre === VER_BLOQUE.n), hs = L.map((o) => o.b.aabb ? +(o.b.aabb.y1 - o.b.aabb.y0).toFixed(3) : 0), ys = [...new Set(L.map((o) => +o.b.aabb.y0.toFixed(2)))].sort((a, b) => a - b);
  const gaps = []; for (let i = 1; i < ys.length; i++) gaps.push(+(ys[i] - ys[i - 1]).toFixed(3)); return JSON.stringify({ n: L.length, alto: hs[0], gaps, b: VER_BLOQUE }); })()`));
ok(torre.gaps.every((g) => Math.abs(g - torre.alto) < 0.03), 'las cajas quedan apoyadas una arriba de la otra', torre);
c = await charla('poneme 3 pelotas');
await espera(2500);
const pel = Number(await ev(`OBJS.filter((o) => o.verity && /pelota|ball/i.test(o.nombre)).length`));
ok(pel === 3, 'pone 3 pelotas', { pel, dijo: c.hist[1] });
c = await charla('limpiá todo lo que hiciste');
await espera(500);
ok(Number(await ev(`OBJS.filter((o) => o.verity).length`)) === 0, 'limpia lo que puso', ultima());
// por el chat
await ev(`chatEnviar('Verity, saltá!'); 1`); await espera(300);
ok(await ev(`VER.pensando || VER.hist.some((h) => /salt/i.test(h[1]))`), 'se le habla por el chat ("Verity, ...")');
for (let i = 0; i < 150 && (await ev(`VER.pensando`)); i++) await espera(200);
// el panel (Y): abre, se escribe y se cierra
if (!celu) {
  await p.keyboard.press('KeyY'); await espera(300);
  const pan = await ev(`!!(VER.pan && !VER.pan.classList.contains('oc')) && UI.abierto === 'verity'`);
  await p.screenshot({ path: D + 'v7_panel.png' });
  await p.keyboard.press('Escape'); await espera(200);
  ok(pan && !(await ev(`!VER.pan.classList.contains('oc')`)), 'Y abre su panel y Escape lo cierra');
} else {
  const r = await p.$('#verBt'), bb = await r.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await espera(400);
  const pan = await ev(`!!(VER.pan && !VER.pan.classList.contains('oc'))`); await p.screenshot({ path: D + 'v7_panel.png' });
  ok(pan, 'tocar su botón abre el panel'); await ev(`verPanel(false); 1`);
}
// ---- la noche: se pone misteriosa (sin monstruos) ----
c = await charla('hacé que sea de noche');
await espera(800);
const h = Number(await ev(`DIA.hora`)); ok(h >= 20.5 || h < 5, 'cambia la hora (de noche)', { h, r: ultima() }); if (!(h >= 20.5 || h < 5)) await ev(`DIA.hora = 23; DIA.aplicada = -1; 1`);
await ev(`VER.oscura = 1; 1`); await espera(1500);
ok(await ev(`typeof VER.fig === 'undefined' && typeof verFiguraNueva === 'undefined' && !document.getElementById('verVelo')`), 'no hay monstruo ni sustos');
await p.screenshot({ path: D + 'v8_noche.png' });
await ev(`DIA.hora = 13; DIA.aplicada = -1; VER.oscura = 0; 1`); await espera(600);
// ---- vida propia: sola rueda por ahí, va a mirar cosas, juega con una pelota y se duerme ----
await ev(`VER.modo = 'libre'; VER.ultCharla = -999; JUG.vel.set(0,0,0); verCallar(VER.yo); VER.yo.falsa = 0; 1`);
await ev(`verPlan('pasear', 30); VER.plan.dest = vadd(JUG.pos, v3(8, 0, 3)); VER.plan.tDest = 20; 1`);
const q0 = JSON.parse(await ev(`JSON.stringify([VER.yo.q.x, VER.yo.q.y, VER.yo.q.z, VER.yo.q.w])`)), p0 = JSON.parse(await ev(`JSON.stringify([VER.yo.pos.x, VER.yo.pos.z])`));
for (let i = 0; i < 20; i++) { await espera(300); const p1 = JSON.parse(await ev(`JSON.stringify([VER.yo.pos.x, VER.yo.pos.z])`)); if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 3) break; }
const ro = JSON.parse(await ev(`(() => { const I = VER.yo; return JSON.stringify({ suelo: I.suelo, apoyada: I.piso !== null ? +(I.pos.y - I.piso - VER_R).toFixed(3) : null, rueda: I.rueda, q: [I.q.x, I.q.y, I.q.z, I.q.w], p: [I.pos.x, I.pos.z], plan: VER.plan && VER.plan.n }); })()`));
const giro = 2 * Math.acos(Math.min(1, Math.abs(q0[0] * ro.q[0] + q0[1] * ro.q[1] + q0[2] * ro.q[2] + q0[3] * ro.q[3]))) * 180 / Math.PI, anduvo = Math.hypot(ro.p[0] - p0[0], ro.p[1] - p0[1]);
ok(ro.suelo && Math.abs(ro.apoyada) < 0.06 && anduvo > 2 && giro > 60, 'sola: pasea rodando por el piso (apoyada, gira como pelota)', { ...ro, q: undefined, anduvo: +anduvo.toFixed(2), giro: Math.round(giro) });
await ev(`JUG.tercera = true; 1`); await espera(400); await p.screenshot({ path: D + 'v9_rueda.png' }); await ev(`JUG.tercera = false; 1`);
// va a mirar un auto
await ev(`(() => { const o = crearObjeto('Sedan', verDelante(7, 3), Quat.axis(0, 1, 0, 0)); window.__auto = o; const foco = { k: 'o' + o.id, n: o.nombre, p: () => o.b.pos, alto: () => (o.b.aabb ? o.b.aabb.y1 - o.b.pos.y : 1), d: 7 }; verPlan('investigar', 30, { foco }); return 1; })()`);
await espera(4500);
const inv = JSON.parse(await ev(`(() => { const I = VER.yo, o = window.__auto, d = I.pos.distTo(o.b.pos), a = vsub(o.b.pos, I.pos); const df = Math.atan2(a.x, a.z) - I.yaw; return JSON.stringify({ d: +d.toFixed(2), mira: +Math.abs(Math.atan2(Math.sin(df), Math.cos(df)) * 180 / Math.PI).toFixed(0), plan: VER.plan.n, encima: +(I.pos.y - o.b.aabb.y1).toFixed(2), gx: +I.gx.toFixed(2) }); })()`));
ok(inv.plan === 'investigar' && inv.d < 3.2 && inv.mira < 35 && inv.encima > 0, 'va a mirar el auto (da vueltas cerca y lo mira)', inv);
await ev(`JUG.tercera = true; 1`); await espera(300); await p.screenshot({ path: D + 'v10_mira_auto.png' }); await ev(`JUG.tercera = false; borrarObjeto(window.__auto); 1`);
// juega con una pelota
await ev(`(() => { const o = crearObjeto('bouncy_ball', verDelante(4, -2), new Quat()) || crearObjeto('Pelota', verDelante(4, -2), new Quat()); window.__bola = o; window.__b0 = o.b.pos.clone(); verPlan('jugar', 30, { bola: o }); return 1; })()`);
let bola = null; for (let i = 0; i < 40; i++) { await espera(250); bola = JSON.parse(await ev(`JSON.stringify({ mov: +window.__bola.b.pos.distTo(window.__b0).toFixed(2), golpes: VER.plan.tGolpe ? 1 : 0 })`)); if (bola.mov > 1.5) break; }
ok(bola.mov > 1.5, 'juega: persigue la pelota y la empuja', bola);
await ev(`borrarObjeto(window.__bola); 1`);
// cansada: se duerme en el piso y se despierta si la llamás
await ev(`VER.mente.energia = 0.1; VER.plan = null; JUG.vel.set(0,0,0); 1`); await espera(2500);
const due = JSON.parse(await ev(`JSON.stringify({ plan: VER.plan && VER.plan.n, emo: VER.yo.emo, suelo: VER.yo.suelo })`));
ok(due.plan === 'descansar' && due.emo === 'dormida' && due.suelo, 'cansada, se duerme en el piso', due);
await ev(`JUG.tercera = true; 1`); await espera(300); await p.screenshot({ path: D + 'v11_duerme.png' }); await ev(`JUG.tercera = false; VER.mente.energia = 1; 1`);
// ---- el oído: sólo "hey/che Verity" ----
const nH = Number(await ev(`VER.hist.length`));
ok(await ev(`!!(OIDO.r && OIDO.r.vivo && OIDO.r.continuous)`), 'escucha siempre (reconocimiento continuo prendido)');
await ev(`__oir('hola, ¿cómo andan todos?', true); 1`); await espera(1500);
ok(Number(await ev(`VER.hist.length`)) === nH && !(await ev(`VER.pensando`)), 'si no le dicen su nombre, no hace nada');
await ev(`__oir('che Verity', false); 1`); await espera(400);
const des = JSON.parse(await ev(`JSON.stringify({ globo: VER.yo.burbTx, plan: VER.plan && VER.plan.n })`));
ok(des.globo === '…' && des.plan === 'atender', '"che Verity": se despierta, viene y escucha', des);
await ev(`__oir('che Verity poneme dos pelotas', true); 1`);
for (let i = 0; i < 150 && (await ev(`VER.pensando || VER.hist.length < ${nH + 2}`)); i++) await espera(200);
await espera(2000);
const oy = JSON.parse(await ev(`JSON.stringify({ q: VER.hist.slice(-2), pel: OBJS.filter((o) => o.verity && /pelota|ball/i.test(o.nombre)).length })`));
ok(/pelotas/.test(JSON.stringify(oy.q)) && oy.pel === 2, 'por la voz le pide algo y lo hace', oy);
await ev(`OIDO.r.stop(); 1`); await espera(1500);
ok(await ev(`!!(OIDO.r && OIDO.r.vivo)`), 'si el navegador corta, vuelve a escuchar solo');
// ---- las animaciones del panel ----
for (const a of ['rodar', 'rebotar', 'saltar', 'bailar', 'amor', 'mareo']) {
  await ev(`verAnim(VER.yo, '${a}'); 1`); await espera(a === 'mareo' ? 2600 : 700);
  await ev(`JUG.tercera = true; 1`); await espera(150); await p.screenshot({ path: D + 'v12_' + a + '.png' }); await ev(`JUG.tercera = false; 1`);
}
const an = JSON.parse(await ev(`JSON.stringify({ anim: VER.yo.anim, emo: VER.yo.emo })`));
ok(an.anim === 'mareo' && an.emo === 'mareada', 'las animaciones andan (mareada al final del mareo)', an);
await ev(`verAnim(VER.yo, ''); 1`);
if (celu) {
  await ev(`smBotonPoner(true); hudDisponer(); 1`); await espera(300);
  const sm = JSON.parse(await ev(`(() => { const a = document.querySelector('[data-btn=pausa]').getBoundingClientRect(), b = document.querySelector('.smBt').getBoundingClientRect(); const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)), y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)); return JSON.stringify({ tapa: Math.round(x * y), pausa: [a.left, a.top].map(Math.round), sm: [b.left, b.top].map(Math.round) }); })()`));
  ok(sm.tapa === 0, 'en el celular el botón SM no tapa a pausa', sm);
  await p.screenshot({ path: D + 'v13_hud_sm.png' });
}
// apagar el mod: se va
await ev(`PREFS.mods = {}; natIniciar([]); 1`); await espera(400);
ok(!(await ev(`VER.on`)) && (await ev(`!VER.bt || VER.bt.style.display === 'none'`)), 'al sacar el mod se va');
await espera(1500); const msSin = Number(await ev(`TIEMPO.msProm`));
console.log('  costo por cuadro: con Verity', msCon.toFixed(2), 'ms · sin', msSin.toFixed(2), 'ms');
console.log('  pedidos a la tienda:', pedidos.map((x) => x.u.slice(0, 40) + ' ' + x.st + ' ' + x.ms + 'ms ' + x.n + 'B').join(' | '));
fs.writeFileSync(D + 'pedidos.json', JSON.stringify(pedidos, null, 1));
console.log('errores:', [...new Set(err.filter((e) => !/WebSocket|mqtt|Failed to load resource|favicon/i.test(e)))].slice(0, 8).join(' | ') || 'ninguno');
await b.close(); process.exit(ok.n ? 1 : 0);
