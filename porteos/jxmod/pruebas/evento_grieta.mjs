// Evento 3.0 (Discord, noviembre de 2026: «los mapas principales tengan la grieta y que de vez en cuando lluevan objetos
// del cielo, a veces uno o incluso 6; los descargados no, que usen la skybox de GMod, incluido gm_construct»).
//  1. en los mapas del juego se ve la grieta (de día en Alto y en Bajo, y de noche): la zona del cielo donde está cambia
//     (≥ 10 de 255 en promedio) y el resto de la imagen no (≤ 0,5)
//  2. en gm_construct y gm_flatgrass no hay grieta ni se dibuja nada; los del Workshop y la pizzería tampoco la tienen
//  3. costo: mirándola de frente, la grieta cuesta ≤ 60 % de lo que cuesta el cielo (una pasada de pantalla completa) y
//     detrás de la vista no se dibuja
//  4. una caída de 6: todas caen, ninguna a menos de 8 m del jugador, las que no explotan quedan apoyadas en el piso
//     (≤ 30 cm de hueco y sin hundirse más de 5 cm) y quietas a los 5 s; las partículas no pasan del tope
//  5. cada tanto cae algo solo (de 1 a 6; casi siempre 1 o 2: la cuenta en 20 000 tiradas) y no se juntan más de 12
//  6. con el evento apagado en Ajustes no se dibuja ni cae nada
//  7. en la red (dos jugadores, broker local): reparte el de ID más chico; al otro le llegan las mismas caídas (mismo
//     lugar ±2 cm) y, al caer, ve la cosa de verdad del que repartió (sin quedarse con la copia: nada repetido); el que no
//     reparte no lanza caídas propias
//  8. sin errores de JS
// uso: BROKER_DIR=carpeta-con-mc/broker node evento_grieta.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; import http from 'http'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
const [, , HTML, D = '/tmp/claude-0/ev3/prueba', GMA = ''] = process.argv;   // (GMA: carpeta con 143190159.gma —mapas de Prop Hunt— para probar un mapa del Workshop de verdad)
fs.mkdirSync(D, { recursive: true });
const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
await new Promise((r) => srv.listen(8894, '127.0.0.1', r));
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const errs = [], navs = [];
const abrir = async (n, w = 1280, h = 720) => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  navs.push(b);
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(n + ': ' + e.message.slice(0, 160)));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|mqtt|Failed to load|ERR_|CORS|net::|tienda|broker/i.test(m.text())) errs.push(n + ': ' + m.text().slice(0, 160)); });
  await p.goto(HTML + '?test&broker=' + encodeURIComponent('ws://127.0.0.1:8894/mqtt')); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  return p;
};
const ev = (P, s) => P.evaluate((x) => window.__ev(x), s), J = async (P, s) => JSON.parse(await ev(P, `(async () => JSON.stringify(await (${s})))()`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 4; i++) { if (await J(P, cond).catch(() => false)) return true; await espera(250); } return false; };
const juego = (P, s) => J(P, `new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + ${s} || performance.now() - r0 > 40000 ? ok(1) : setTimeout(f, 20)); f(); })`);
const prep = (P, n, g) => ev(P, `PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.tutVisto=true; PREFS.gfx='${g}'; PREFS.resDin=false; GFX.auto=false; GFX.ahorro=0; GFX.ahorroFijo=true; aplicarGfx(); PREFS.evento=true; 1`);
const mapa = async (P, m) => { await ev(P, `(() => { inicioMostrar(false); empezarPartida('${m}'); return 1; })()`); return hasta(P, `MUNDO.nombre === '${m}' && JUEGO.estado === 'juego'`, 120); };
// (mirar la grieta: el jugador quieto, sin la caída automática ni el ahorro de gráficos, que en este navegador sin placa saltaría)
const mirar = (P) => ev(P, `(() => { EVT.prox = 1e9; TIEMPO.lento = 0; JUG.vel.set(0, 0, 0); JUG.yaw = Math.atan2(EVT.dir.x, EVT.dir.z); JUG.pitch = -Math.asin(EVT.dir.y) * 0.85; for (const e of document.querySelectorAll('#aviso, .aviso')) e.style.visibility = 'hidden'; return 1; })()`);
// dónde cae la grieta en la pantalla (en píxeles de la captura) y un cuadrado de 160 alrededor
const zona = (P) => J(P, `(() => { const v = R.vp, d = EVT.dir, x = v[0] * d.x + v[4] * d.y + v[8] * d.z, y = v[1] * d.x + v[5] * d.y + v[9] * d.z, w = v[3] * d.x + v[7] * d.y + v[11] * d.z; return { x: (x / w * 0.5 + 0.5) * innerWidth, y: (0.5 - y / w * 0.5) * innerHeight }; })()`);
// diferencia media (0..255) entre dos capturas en un rectángulo
const difer = async (P, a, b, r) => P.evaluate(async ([a, b, r]) => {
  const im = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(r[0], r[1], r[2], r[3]).data; };
  const A = await im(a), B = await im(b); let s = 0; for (let i = 0; i < A.length; i += 4) s += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
  return s / (A.length / 4);
}, [a, b, r]);
const foto = async (P, n) => (await P.screenshot({ path: n ? D + '/' + n + '.png' : undefined })).toString('base64');
const dpr = 1;

// ---------------- 1. la grieta en los mapas del juego ----------------
const A = await abrir('Ana'); await prep(A, 'Ana', 'alto');
const vista = {};
for (const [m, g, hora] of [['Desert', 'alto', 12], ['Desert', 'bajo', 12], ['Desert', 'alto', 0], ['FlatGrass', 'medio', 17.5], ['City', 'alto', 9]]) {
  await prep(A, 'Ana', g);
  if (!(await J(A, `MUNDO.nombre`) === m)) await mapa(A, m);
  await ev(A, `(() => { PREFS.gfx = '${g}'; PREFS.resDin = false; GFX.auto = false; aplicarGfx(); GFX.ahorro = 0; GFX.ahorroFijo = true; DIA.hora = ${hora}; DIA.aplicada = -1; DIA.ciclo = false; return 1; })()`);
  await juego(A, 2); await mirar(A); await juego(A, 1.2); await mirar(A); await juego(A, 0.4);
  const z = await zona(A);
  // (dos capturas iguales seguidas: el ruido de un cuadro al otro —nubes, pulso— para descontar)
  const con = await foto(A, `grieta_${m}_${g}_${hora}`); await juego(A, 0.3); const con2 = await foto(A);
  await ev(A, `PREFS.evento = false; 1`); await juego(A, 0.3); const sin = await foto(A); await ev(A, `PREFS.evento = true; 1`);
  const rz = [Math.max(0, Math.round(z.x * dpr - 80)), Math.max(0, Math.round(z.y * dpr - 80)), 160, 160], rAbajo = [170, 610, 420, 80];
  vista[m + '_' + g + '_' + hora] = { dentro: +(await difer(A, con2, sin, rz)).toFixed(1), ruido: +(await difer(A, con, con2, rz)).toFixed(1), abajo: +(await difer(A, con2, sin, rAbajo)).toFixed(2), z: [Math.round(z.x), Math.round(z.y)], salida: await J(A, `R.salida`) };
}
const v1 = Object.values(vista);
ok('1. la grieta se ve en los mapas del juego (día Alto/Bajo, noche, atardecer, mañana): ≥ 10 en su zona (≥ 3 veces el ruido de un cuadro a otro); en el piso, nada (el brillo que derrama en Alto, ≤ 12 % de lo de la zona)', v1.every((x) => x.dentro >= 10 && x.dentro >= 3 * x.ruido && x.abajo <= Math.max(0.5, 0.12 * x.dentro)), vista);

// ---------------- 2. sin grieta en los de GMod, del Workshop y la pizzería ----------------
const g2 = {};
for (const m of ['RB_Construct', 'RB_Flatgrass']) {
  await mapa(A, m); await ev(A, `(() => { PREFS.gfx = 'alto'; aplicarGfx(); return 1; })()`); await juego(A, 0.5);
  const d0 = await J(A, `EVT.dib`); await ev(A, `(() => { JUG.yaw = Math.atan2(EVT.dir.x, EVT.dir.z); JUG.pitch = -0.5; EVT.prox = TIEMPO.t; return 1; })()`); await juego(A, 1.5);
  g2[m] = await J(A, `({ grieta: EVT.grieta, caidas: EVT.caidas, dibujos: EVT.dib - ${d0}, cola: EVT.cola.length })`);
}
// (un mapa del Workshop instalado de verdad: queda en la lista de mapas como WS_*, y adentro no hay grieta)
if (GMA) {
  const ws = await J(A, `(async () => { const b = new Uint8Array(await (await fetch('${GMA}/143190159.gma')).arrayBuffer()); await gmInstalar('143190159', { nombre: 'ph', sinDeps: true }, b); return [...GBSP.mapas].filter(([k, x]) => x.id === '143190159').map(([k]) => k); })()`);
  const m = ws.find((x) => /no1office/.test(x)) || ws[0];
  await mapa(A, m); await juego(A, 1); const d0 = await J(A, `EVT.dib`); await ev(A, `(() => { JUG.yaw = Math.atan2(EVT.dir.x, EVT.dir.z); JUG.pitch = -0.6; return 1; })()`); await juego(A, 1);
  g2[m] = await J(A, `({ grieta: EVT.grieta, caidas: EVT.caidas, dibujos: EVT.dib - ${d0}, cola: EVT.cola.length, enLista: MAPAS_RB.includes(${JSON.stringify(m)}) })`);
}
const unidad = await J(A, `({ ws: evtConGrieta('WS_gm_bigcity') || evtConGrieta(MAPAS_RB.find((m) => /^WS_/.test(m)) || 'WS_x') || [...(GBSP.mapas || new Map()).keys()].some(evtConGrieta), pizzeria: evtConGrieta('RB_Pizzeria'), espacioCaidas: evtConCaidas('Space'), desierto: evtConGrieta('Desert'), llanura: evtConGrieta('RB_Llanura') })`);
ok('2. gm_construct, gm_flatgrass y un mapa del Workshop instalado sin grieta ni caídas (nada dibujado); la pizzería tampoco', Object.values(g2).every((x) => !x.grieta && !x.caidas && x.dibujos === 0 && x.cola === 0) && !unidad.ws && !unidad.pizzeria && !unidad.espacioCaidas && unidad.desierto && unidad.llanura, { g2, unidad });

// ---------------- 3. lo que cuesta ----------------
await mapa(A, 'Desert'); await ev(A, `(() => { PREFS.gfx = 'alto'; aplicarGfx(); DIA.hora = 12; DIA.aplicada = -1; return 1; })()`); await mirar(A); await juego(A, 1);
// (la pasada de la grieta y la del cielo, cada una 30 veces con la placa esperando al final; alternadas, 5 rondas)
const costo = await J(A, `(() => {
  const gl = R.gl, IVP = M4.inv(R.vp), N = 40, t = { grieta: 0, cielo: 0 }, px = new Uint8Array(4), espera = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, R.cv.width, R.cv.height); espera();
  for (let k = 0; k < 5; k++) {
    let a = performance.now(); for (let i = 0; i < N; i++) dibujarCielo(IVP); espera(); t.cielo += performance.now() - a;
    a = performance.now(); for (let i = 0; i < N; i++) eventoCieloDibujar(); espera(); t.grieta += performance.now() - a;
  }
  const res = { grietaMs: +(t.grieta / (5 * N)).toFixed(3), cieloMs: +(t.cielo / (5 * N)).toFixed(3), px: R.cv.width + 'x' + R.cv.height };
  res.k = +(res.grietaMs / res.cieloMs).toFixed(2);
  // (de espaldas: no se dibuja)
  const d0 = EVT.dib; JUG.yaw += Math.PI; camaraActualizar(0); eventoCieloDibujar(); res.deEspaldas = EVT.dib - d0;
  JUG.yaw -= Math.PI; return res;
})()`);
ok('3. de frente la grieta cuesta ≤ 60 % del cielo; de espaldas no se dibuja', costo.k <= 0.6 && costo.deEspaldas === 0, costo);

// ---------------- 4. una caída de 6 ----------------
await ev(A, `(() => { for (const o of OBJS.slice()) borrarObjeto(o); EVT.vivos.length = 0; EVT.cola.length = 0; return 1; })()`);
await juego(A, 0.3);
const lanz = await J(A, `(() => { const n = eventoForzar(6); return { n, l: EVT.cola.map((c) => ({ nombre: c.nombre, ex: c.ex, d: +Math.hypot(c.suelo.x - JUG.pos.x, c.suelo.z - JUG.pos.z).toFixed(1), t: +(c.t1 - TIEMPO.t).toFixed(2) })) }; })()`);
await ev(A, `(() => { const c = EVT.cola[0]; const d = vsub(c.suelo, JUG.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -0.3; window.__picoPart = 0; window.__exp = 0; const f0 = efectoExplosion; efectoExplosion = (...a) => { window.__exp++; return f0(...a); }; const mide = () => { window.__picoPart = Math.max(window.__picoPart, PART.l.length); if (EVT.cola.length) requestAnimationFrame(mide); }; mide(); return 1; })()`);
const tFin = Math.max(...lanz.l.map((x) => x.t));
await juego(A, Math.max(0, tFin - 0.9)); await foto(A, 'cae_llega');
await juego(A, 1.0); await foto(A, 'cae_golpe'); await ev(A, `window.__tLlego = TIEMPO.t; 1`);
await juego(A, 5);
// (una que empujó una explosión o que rueda por una duna puede seguir moviéndose: se le dan hasta 10 s más)
for (let i = 0; i < 10 && await J(A, `EVT.vivos.some((o) => !o.borrado && o.b.vel.len() >= 0.5)`); i++) await juego(A, 1);
const cayo = await J(A, `(() => {
  const vivos = EVT.vivos.filter((o) => !o.borrado);
  return { esperaExtra: +(TIEMPO.t - window.__tLlego).toFixed(1), cola: EVT.cola.length, vivos: vivos.map((o) => { let minY = 1e9; for (const v of puntosForma(o.F.shape)) minY = Math.min(minY, o.b.q.rot(v).y + o.b.pos.y);
    const h = mundoRayo(v3(o.b.pos.x, o.b.pos.y + 3, o.b.pos.z), v3(0, -1, 0), 50), piso = h ? o.b.pos.y + 3 - h.t : null;
    return { n: o.nombre, veh: o.tipo === 'vehiculo', arriba: +o.b.q.rot(v3(0, 1, 0)).y.toFixed(2), hueco: piso === null ? null : +(minY - piso).toFixed(3), vel: +o.b.vel.len().toFixed(2), duerme: !!o.b.sleep }; }),
    pico: window.__picoPart, tope: Math.round(partTope()), exp: window.__exp };
})()`);
await foto(A, 'cae_quedo');
const noExplotan = lanz.l.filter((x) => !x.ex).length, explotan = lanz.l.length - noExplotan;
ok('4. caída de 6: todas caen lejos (≥ 8 m), las que quedan apoyadas (hueco −5…+30 cm; los autos sobre las ruedas, derechos) y quietas (a los 5 s, o 15 s si las empujó una explosión o ruedan), explosiones = las que explotan, partículas ≤ tope',
  lanz.n === 6 && lanz.l.every((x) => x.d >= 8) && cayo.cola === 0 && cayo.vivos.length === noExplotan && cayo.vivos.every((o) => o.hueco !== null && o.hueco >= -0.05 && o.hueco <= (o.veh ? 0.5 : 0.3) && o.vel < 0.5 && (!o.veh || o.arriba > 0.9)) && cayo.exp >= explotan && cayo.pico <= cayo.tope,
  { lanz, cayo });

// ---------------- 5. sola, de 1 a 6, y el tope de 12 ----------------
const dist = await J(A, `(() => { const c = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 20000; i++) c[evtCuantas()]++; return c.slice(1).map((x) => +(x / 200).toFixed(1)); })()`);
await ev(A, `(() => { EVT.cola.length = 0; EVT.prox = TIEMPO.t; return 1; })()`); await juego(A, 0.5);
const sola = await J(A, `({ n: EVT.cola.length, prox: +(EVT.prox - TIEMPO.t).toFixed(0) })`);
for (let i = 0; i < 3; i++) { await ev(A, `(() => { eventoForzar(6); for (const c of EVT.cola) { c.t0 = TIEMPO.t; c.t1 = TIEMPO.t + 0.4; c.ex = 0; } return 1; })()`); await juego(A, 1.2); }
await juego(A, 4);
const tope = await J(A, `({ vivos: EVT.vivos.filter((o) => !o.borrado).length, enMundo: OBJS.length })`);
ok('5. cae sola (1–6, la próxima en 100–260 s), casi siempre 1 o 2 (% de 1..6) y no se juntan más de 12', sola.n >= 1 && sola.n <= 6 && sola.prox >= 99 && sola.prox <= 261 && dist[0] > 30 && dist[5] < 10 && dist[0] + dist[1] > 50 && tope.vivos <= 12 && tope.enMundo <= 12, { dist, sola, tope });

// ---------------- 6. apagado en Ajustes ----------------
await ev(A, `(() => { for (const o of OBJS.slice()) borrarObjeto(o); EVT.vivos.length = 0; EVT.cola.length = 0; PREFS.evento = false; EVT.prox = TIEMPO.t; return 1; })()`);
await mirar(A); const d6 = await J(A, `EVT.dib`); await ev(A, `EVT.prox = TIEMPO.t; 1`); await juego(A, 1.5);
const apag = await J(A, `({ dibujos: EVT.dib - ${d6}, cola: EVT.cola.length })`);
await ev(A, `PREFS.evento = true; EVT.prox = 1e9; 1`);
ok('6. con el evento apagado no se dibuja ni cae nada', apag.dibujos === 0 && apag.cola === 0, apag);

// ---------------- 7. en la red ----------------
await prep(A, 'Ana', 'patata');
await ev(A, `(() => { irMenuPrincipal(); conectarMultijugador(); crearServidor({ n: 'Grieta', pw: '', m: 'Desert' }); return 1; })()`);
await hasta(A, `JUEGO.estado === 'juego' && RED.on && MUNDO.nombre === 'Desert'`, 120); await juego(A, 0.2); await ev(A, `EVT.prox = 1e9; 1`);
const sala = await J(A, `(() => { const s = Object.assign({}, SALA); delete s.clave; return s; })()`);
const B = await abrir('Beto', 900, 500); await prep(B, 'Beto', 'patata');
await ev(B, `(() => { conectarMultijugador(); entrarSala(${JSON.stringify(sala)}, ''); return 1; })()`);
await hasta(B, `JUEGO.estado === 'juego' && RED.on && RED.remotos.size === 1 && MUNDO.nombre === 'Desert'`, 120); await juego(B, 0.2); await ev(B, `EVT.prox = 1e9; 1`);
await hasta(A, `RED.remotos.size === 1`, 30);
for (const P of [A, B]) await ev(P, `(() => { EVT.prox = 1e9; EVT.cola.length = 0; EVT.vivos.length = 0; TIEMPO.lento = 0; return 1; })()`);
const ids = { A: await J(A, `RED.ID`), B: await J(B, `RED.ID`) };
const [L, F] = ids.A < ids.B ? [A, B] : [B, A];
const quien = { reparte: ids.A < ids.B ? 'Ana' : 'Beto', A: await J(A, `evtReparto()`), B: await J(B, `evtReparto()`) };
const objsF0 = await J(F, `OBJS.filter((o) => !o.remoto).length`);
// (que no explote ninguna, en los dos desde que llegan: antes se le cambiaba al otro después de recibirla, y con la
// máquina cargada su copia a veces pegaba antes (la primera cae a los 4,1 s) y explotaba sólo en su juego, rompiendo
// las de verdad que ya habían llegado; en el juego los dos reciben lo mismo)
for (const P of [L, F]) await ev(P, `(() => { if (!window.__evtR0) { window.__evtR0 = evtRecibir; evtRecibir = (l, mia) => { for (const x of l) x[9] = 0; return window.__evtR0(l, mia); }; } return 1; })()`);
const lan7 = await J(L, `(() => { const n = eventoForzar(4); for (const c of EVT.cola) c.ex = 0; return { n, l: EVT.cola.map((c) => [c.nombre, c.suelo.x, c.suelo.y, c.suelo.z]) }; })()`);
const llego = await hasta(F, `EVT.cola.length === ${lan7.n}`, 6);
const colaF = await J(F, `EVT.cola.map((c) => [c.nombre, c.suelo.x, c.suelo.y, c.suelo.z, c.ex])`);
const igual = lan7.l.every((x, i) => colaF[i] && colaF[i][0] === x[0] && Math.hypot(colaF[i][1] - x[1], colaF[i][2] - x[2], colaF[i][3] - x[3]) <= 0.02);
// (el que no reparte tiene que mostrar la que no explota hasta que llegue la de verdad; acá se fuerza que no exploten)
await ev(F, `(() => { for (const c of EVT.cola) c.ex = 0; return 1; })()`);
await juego(F, 4.5); await hasta(F, `EVT.cola.length === 0`, 15); await juego(F, 2);
await foto(F, 'red_otro');
// (si el juego del que reparte va atrasado —un celular lento, o esta compu cargada—, a él todavía le pueden estar cayendo:
// se espera a que peguen todas en su juego y a que al otro le lleguen por la red)
await hasta(L, `EVT.cola.every((c) => c.estado >= 2) && EVT.vivos.filter((o) => !o.borrado).length >= ${lan7.n}`, 40);
// (las de verdad del que repartió, por su clave en la red, y dónde quedaron respecto de dónde cayeron: ruedan o se deslizan)
const realesL = await J(L, `EVT.vivos.filter((o) => !o.borrado).map((o) => [RED.ID + ':' + o.id, o.nombre])`);
await hasta(F, `${JSON.stringify(realesL)}.every(([k]) => RED.objs.get(k) && !RED.objs.get(k).borrado)`, 15);
const enF = await J(F, `(() => { const K = ${JSON.stringify(realesL)}, L = ${JSON.stringify(lan7.l)}; return { reales: K.length, llegaron: K.map(([k, n]) => !!(RED.objs.get(k) && RED.objs.get(k).nombre === n && !RED.objs.get(k).borrado)),
  corrieron: K.map(([k]) => { const o = RED.objs.get(k), x = o && L.find((y) => y[0] === o.nombre); return o && x ? +Math.hypot(o.b.pos.x - x[1], o.b.pos.z - x[3]).toFixed(1) : null; }), visuales: EVT.cola.filter((c) => c.vis).length, propios: OBJS.filter((o) => !o.remoto).length }; })()`);
// (el que no reparte, aunque le toque, no lanza)
await ev(F, `EVT.prox = TIEMPO.t; 1`); await juego(F, 1);
// (y al que reparte no le llega nada: se cuentan sólo las que recibió por la red; las suyas pueden seguir ardiendo en el
// piso si su juego va atrasado, como pasaba con la máquina cargada: «recibioL» 4 con las 4 suyas todavía en la cola)
const propiaF = await J(F, `EVT.cola.length`), recibioL = await J(L, `EVT.cola.filter((c) => !c.mia).length`);
ok('7. en la red: reparte el de ID más chico; al otro le llegan las mismas (±2 cm), ve las de verdad y nada repetido; el otro no lanza',
  quien[ids.A < ids.B ? 'A' : 'B'] === true && quien[ids.A < ids.B ? 'B' : 'A'] === false && lan7.n >= 3 && llego && igual && enF.reales === lan7.n && enF.llegaron.every(Boolean) && enF.visuales === 0 && enF.propios === objsF0 && propiaF === 0 && recibioL === 0,
  { quien, lan7: lan7.n, llego, igual, enF, objsF0, propiaF, recibioL });

// ---------------- 8. errores ----------------
ok('8. sin errores de JS', !errs.length, errs.slice(0, 5));
for (const b of navs) await b.close();
srv.close();
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
