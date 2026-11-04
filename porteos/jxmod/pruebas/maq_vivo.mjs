// las maquinitas como las del Hunter: jugando, el juego se ve en vivo en la pantalla 3D del gabinete (≥ 5 cuadros por
// segundo, la imagen del juego y no la tapa), el que juega queda parado adelante mirándolo; a la sala va una foto chica 4
// veces por segundo (≤ 12 mil letras cada una) sólo si hay alguien cerca; el de otro jugador se ve en su gabinete (la
// pantalla cambia) y él queda con las manos en la palanca y los botones (≤ 12 cm de cada uno); cuando deja de jugar,
// a los 3 s vuelve la tapa y suelta los controles; sin errores.
// uso: node maq_vivo.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 15000 });
// un gabinete adelante y jugar la Serpiente
const j = await ev(`(async () => {
  const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); const o = crearObjeto('Arcade', vadd(JUG.pos, vscale(f, 2.2)), Quat.axis(0, 1, 0, JUG.yaw + Math.PI), {}); window.__o = o;
  await new Promise((r) => setTimeout(r, 1200)); MAQ.obj = o; maqElegir(MAQ_INCLUIDOS.find((x) => x.id === 'rb:serpiente'));
  await new Promise((r) => setTimeout(r, 600)); MAQV.cuadros = 0; const t0 = performance.now();
  // (empezar la partida: Enter)
  maqTecla('start', true); await new Promise((r) => setTimeout(r, 120)); maqTecla('start', false);
  await new Promise((r) => setTimeout(r, 2000)); const fps = MAQV.cuadros / ((performance.now() - t0) / 1000);
  const e = MAQV.lienzo.get(claveObj(o)), px = e.g.getImageData(0, 0, 256, 192).data; let suma = 0, cols = new Set(); for (let i = 0; i < px.length; i += 4 * 37) { suma += px[i] + px[i + 1] + px[i + 2]; cols.add((px[i] >> 4) + ',' + (px[i + 1] >> 4) + ',' + (px[i + 2] >> 4)); }
  const fr = o.b.q.rot(v3(0, 0, 1)), dJ = vsub(JUG.pos, o.b.pos); dJ.y = 0; const mira = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw));
  return { ui: UI.abierto, fps: +fps.toFixed(1), fresca: performance.now() - e.t < 500, colores: cols.size, brillo: Math.round(suma / (px.length / (4 * 37))), adelante: +vdot(dJ, fr).toFixed(2), costado: +Math.abs(vdot(dJ, o.b.q.rot(v3(1, 0, 0)))).toFixed(2), mira: +vdot(mira, vscale(fr, -1)).toFixed(2), clave: claveObj(o) };
})()`);
ok('jugando: el juego se ve en vivo en la pantalla del gabinete (≥ 5 cuadros por segundo, una imagen con colores, no negra)', j.ui === 'maqv' && j.fps >= 5 && j.fresca && j.colores >= 3 && j.brillo > 10, j);
ok('el que juega queda parado adelante del gabinete, pegado al panel (0,75-1 m, centrado) y mirándolo', j.adelante > 0.75 && j.adelante < 1 && j.costado < 0.2 && j.mira > 0.95, j);
// la sala: con alguien cerca se mandan las fotos
const red = await ev(`(async () => { const env = []; const p0 = publicar; window.publicar = publicar = (s, d) => env.push(JSON.parse(JSON.stringify(d))); RED.on = true; RED.ID = RED.ID || 'yo1';
  recibirEstado({ i: 'ana', n: 'Ana', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x + 3, JUG.pos.y, JUG.pos.z], v: [0, 0, 0], y: 0, t: 0, f: 5, a: null, e: 0 });
  await new Promise((r) => setTimeout(r, 2000)); const v = env.filter((x) => x.k === 'maqv' && x.f); window.__env = env;   // (el publicador simulado queda hasta el final: con la red prendida y sin conexión el juego sale de la sala)
  return { n: v.length, max: Math.max(0, ...v.map((x) => x.f.length)), o: v[0] && v[0].o }; })()`);
ok('a la sala: hasta 4 fotos por segundo (≥ 3 en 2 s con el juego a 6 cuadros/s de esta prueba; ≤ 8) chicas (≤ 12 mil letras), con alguien cerca', red.n >= 3 && red.n <= 8 && red.max <= 12000, red);
await ev(`maqVistaCerrar(); JUG.tercera = true; 1`);
await p.waitForTimeout(3500);
// el de otra persona: llega su pantalla y ella juega en el gabinete
const otro = await ev(`(async () => {
  const o = window.__o, clave = claveObj(o), e0 = MAQV.lienzo.get(clave); const vieja = e0 ? e0.t : 0;
  // (una foto de prueba: franjas de colores)
  const c = document.createElement('canvas'); c.width = 160; c.height = 120; const g = c.getContext('2d'); ['#f00', '#0f0', '#00f', '#ff0'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 40, 0, 40, 120); });
  const f = c.toDataURL('image/jpeg', 0.6).split(',')[1];
  // (Ana parada adelante del gabinete: su estado, como llega por la red, cada medio segundo)
  const L = maqLugar(o);   // (donde se para el que juega, el mismo lugar que usa el juego)
  const est = () => recibirEstado({ i: 'ana', n: 'Ana', k: 'Hero', h: 'HatEmpty', p: [L.p.x, L.p.y, L.p.z], v: [0, 0, 0], y: L.yaw, t: 0, f: 5, a: null, e: 0 });
  est(); window.__est = setInterval(est, 400); await new Promise((r) => setTimeout(r, 1200));
  const R2 = RED.remotos.get('ana');
  for (let k = 0; k < 6; k++) { await maqVivoRed({ k: 'maqv', i: 'ana', o: clave, f }); await new Promise((r) => setTimeout(r, 250)); }
  const e = MAQV.lienzo.get(clave), px = e.g.getImageData(20, 96, 1, 1).data;
  // las manos de Ana en el panel
  const P = R2.P, md = P.md; md.actualizar(); const pos = (n) => { const W = md.W[P.D.h[n]]; return v3(W[12], W[13], W[14]); };
  const meta = (L) => vadd(o.b.pos, o.b.q.rot(v3(L[0], L[1] + 0.04, L[2] + 0.06)));
  const dDer = pos('RightHand').distTo(meta(MAQ_PANEL.der)), dIzq = pos('LeftHand').distTo(meta(MAQ_PANEL.izq));
  return { nueva: e.t > vieja, rojo: px[0] > 150 && px[1] < 90, juega: !!(P.maqJ && P.maqJ.o === clave), dDer: +dDer.toFixed(3), dIzq: +dIzq.toFixed(3) };
})()`);
// foto desde el costado, mirando la pantalla del gabinete
await ev(`(() => { const o = window.__o, lado = o.b.q.rot(v3(1, 0, 0)), fr = o.b.q.rot(v3(0, 0, 1)); DBG.cam = { p: vadd(o.b.pos, vadd(vscale(lado, 1.7), vadd(vscale(fr, 1.6), v3(0, 0.75, 0)))), q: null }; const d = vsub(vadd(o.b.pos, v3(0, 0.25, 0.3)), DBG.cam.p).norm(); DBG.cam.q = Quat.euler(Math.atan2(d.x, d.z), -Math.asin(d.y), 0); return 1; })()`);
await p.waitForTimeout(600); await p.screenshot({ path: D + 'maq_vivo_otro.png' });
ok('la de otro: su pantalla se ve en el gabinete y ella juega con las manos en la palanca y los botones (≤ 12 cm)', otro.nueva && otro.rojo && otro.juega && otro.dDer <= 0.12 && otro.dIzq <= 0.12, otro);
// deja de jugar: a los 3 s vuelve la tapa y suelta los controles
await p.waitForTimeout(3500);
const fin = await ev(`(() => { const o = window.__o, e = MAQV.lienzo.get(claveObj(o)), R2 = RED.remotos.get('ana'); clearInterval(window.__est); return { ana: !!R2, tapa: performance.now() - e.t > 2500, suelta: !!R2 && !R2.P.maqJ }; })()`);
ok('cuando deja de jugar: vuelve la tapa y suelta los controles', fin.tapa && fin.suelta, fin);
await ev(`DBG.cam = null; RED.on = false; 1`);
// (el aviso de "willReadFrequently" lo causa esta prueba al leer el lienzo con getImageData)
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404|willReadFrequently/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
