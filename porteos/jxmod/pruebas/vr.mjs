// Modo VR (vr.js): el juego armado para la app (PK_BIN) en un «celular» acostado (873×393, táctil), con un puente
// JXManos de mentira que entrega manos como las del motor (la forma de una mano abierta grabada por el motor de verdad
// —/tmp/claude-0/jxm_rec/cuadros.json— y la posición que pide la prueba) y un giroscopio de mentira
// (DeviceOrientationEvent). Revisa:
//  1. «Partida nueva» tiene el botón VR; con él la partida arranca en VR y las manos con la cámara de ATRÁS;
//  2. la imagen: dos ojos (las dos mitades se parecen pero no son iguales: los ojos están separados) y las esquinas
//     negras de la corrección de las lentes; el resto de la pantalla (los botones) no se ve;
//  3. la cabeza: el celular de pie mira al horizonte, inclinado 45° mira 45° abajo, girado 90° gira 90° a la izquierda;
//  4. las manos 3D: se ven donde está tu mano (a la derecha y abajo, en los dos ojos);
//  5. caminar con las manos: la mano que toca el piso se pega; empujarla para atrás lleva el cuerpo para adelante,
//     empujarla para abajo lo sube, y al soltar sale con el envión;
//  4b. los brazos son los del modo cámara: con la mano más lejos que el largo del brazo, el brazo queda estirado y la
//      mano (la que se dibuja y la que toca) se queda en la punta;
//  6. agarrar: el puño cerca de un objeto lo agarra, el objeto sigue a la mano y al abrirla sale tirado; un objeto
//     largo se agarra por la punta (lejos del centro) y un NPC pasa a muñeco de trapo y se lo lleva de la mano;
//  6d. trepar: el puño sobre algo congelado se agarra ahí (no lo levanta) y tirar sube el cuerpo;
//  7. el mando: la palanca camina, A salta, la derecha gira 30°; fuera del VR la derecha mira;
//  8. salir del VR (el botón de arriba): todo vuelve a la normalidad; sin errores de JS.
// uso: node vr.mjs CARPETA_DEL_ARMADO CUADROS.json [CARPETA_CAPTURAS]
import { abrir } from './base.mjs';
import fs from 'fs';
import path from 'path';
const [, , DIR = '/tmp/claude-0/jx_web/www', CUADROS = '/tmp/claude-0/jxm_rec/cuadros.json', D = '/tmp/claude-0/vr_prueba'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1200) : '')); };
const tipos = { html: 'text/html', js: 'text/javascript', bin: 'application/octet-stream', mp4: 'video/mp4' };
const servir = async (p) => p.context().route('http://localhost:7777/**', (r) => {
  const u = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\//, '') || 'index.html', f = path.join(DIR, u);
  if (!f.startsWith(DIR) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
  r.fulfill({ body: fs.readFileSync(f), contentType: tipos[path.extname(f).slice(1)] || 'application/octet-stream' });
});
// la forma de una mano (176 números de la primera mano del primer cuadro grabado que tenga una)
const C = JSON.parse(fs.readFileSync(CUADROS, 'utf8')).map((t) => t.split(',').map(Number)).find((n) => n[4] >= 1);
const MANO = C.slice(5, 5 + 176);
const { b, p, err, ev } = await abrir('http://localhost:7777/index.html', true, [], servir);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); 1`);
// el puente de mentira: la mano que pide la prueba (window.__vrMano: cámara x, y, z en metros, cerrada o no)
await ev(`(() => { const M = ${JSON.stringify(MANO)}; let n = 0, on = false, t0 = 0; window.__mjxLlamadas = []; window.__vrMano = { pos: [0.08, 0.12, 0.35], cierre: 0, ver: true };
  const texto = () => { const H = window.__vrMano, m = M.slice(); m[1] = 1; m[2] = 0.99; m[4] = H.pos[0]; m[5] = H.pos[1]; m[6] = H.pos[2]; m[166] = H.cierre; m[168] = H.cierre > 0.5 ? 2 : 1;
    return n + ',4.1,1,1,' + (H.ver ? 1 : 0) + (H.ver ? ',' + m.join(',') : ''); };
  window.JXManos = { disponible: () => true, prender: (l) => { window.__mjxLlamadas.push('prender:' + l); on = true; return 'ok'; },
    prenderTrasera: (l) => { window.__mjxLlamadas.push('prenderTrasera:' + l); on = true; return 'ok'; },
    apagar: () => { window.__mjxLlamadas.push('apagar'); on = false; },
    leer: (v) => { if (!on) return ''; n++; return texto(); }, estado: () => (on ? 'listo' : 'apagado'), config: () => {}, miniatura: () => '', diagnostico: () => (on ? '30,90,640x480,80' : '') };
  return 1; })()`);
// 1) el botón en «Partida nueva»
const b1 = await ev(`(() => { inicioPanel('nueva'); const x = document.querySelector('[data-rb=empezarVR]'); if (!x) return null; const r = x.getBoundingClientRect(); x.click(); return { w: Math.round(r.width), h: Math.round(r.height), txt: x.textContent.trim() }; })()`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && VR.on`), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500); await ev(`cerrarPaneles(); 1`);
const e1 = await ev(`({ vr: VR.on, manos: VR.manosOn, trasera: MJX.trasera, arma: ARM.lista.includes('ManosJX'), llamadas: window.__mjxLlamadas, clase: document.body.classList.contains('enVR') })`);
ok('1. «Partida nueva» tiene el botón VR y con él la partida arranca en VR, con las manos de la cámara de atrás (sin el arma de primera persona)',
  b1 && b1.w > 20 && e1.vr && e1.manos && e1.trasera && !e1.arma && e1.llamadas.includes('prenderTrasera:true') && e1.clase, { b1, ...e1 });
// el giroscopio de mentira: el celular acostado (pantalla girada 90°) como en el casco
const giro = (a, bb, g, ang) => ev(`(() => { VR.angPrueba = ${ang}; dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: ${a}, beta: ${bb}, gamma: ${g} })); return 1; })()`);
const vista = () => ev(`({ f: [CAM.fwd.x, CAM.fwd.y, CAM.fwd.z].map((x) => +x.toFixed(3)), yaw: +(JUG.yaw * 180 / Math.PI).toFixed(1), pitch: +(JUG.pitch * 180 / Math.PI).toFixed(1), arr: +CAM.arr.y.toFixed(3) })`);
// (cada 50 ms, como un giroscopio: el último vale)
const sostener = async (a, bb, g, ang, ms) => { const t = Date.now(); while (Date.now() - t < ms) { await giro(a, bb, g, ang); await p.waitForTimeout(40); } };
// 2) la imagen: las dos mitades, las esquinas y lo que tapa la pantalla
await sostener(0, 0, -90, 90, 600);
const leerPx = `(() => { dibujar(); const gl = R.gl, W = R.cv.width, H = R.cv.height, px = new Uint8Array(W * H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return { W, H, px }; })()`;
const img = await ev(`(() => { const { W, H, px } = ${leerPx}; const w2 = W >> 1, at = (x, y) => (y * W + x) * 4;
  let dif = 0, n = 0, osc = 0, nc = 0;
  for (let y = 4; y < H; y += 6) for (let x = 4; x < w2; x += 6) { const a = at(x, y), c = at(x + w2, y); dif += Math.abs(px[a] - px[c]) + Math.abs(px[a + 1] - px[c + 1]) + Math.abs(px[a + 2] - px[c + 2]); n++; }
  for (const [x, y] of [[2, 2], [w2 - 3, 2], [2, H - 3], [w2 - 3, H - 3], [w2 + 2, 2], [W - 3, H - 3]]) { const a = at(x, y); osc += px[a] + px[a + 1] + px[a + 2]; nc++; }
  const cen = [at(w2 >> 1, H >> 1), at(w2 + (w2 >> 1), H >> 1)].map((a) => px[a] + px[a + 1] + px[a + 2]);
  const hud = ['hud', 'tactil'].map((i) => { const e = document.getElementById(i); return e ? getComputedStyle(e).display : 'no'; });
  return { W, H, difMedia: +(dif / n / 3).toFixed(1), esquinas: osc / nc, centro: cen, hud, vrHud: getComputedStyle(document.getElementById('vrHud')).display }; })()`);
await p.screenshot({ path: path.join(D, 'vr_1_estereo.png') });
ok('2. dos ojos (las mitades se parecen y no son iguales), las esquinas negras de las lentes, el centro con imagen, y sin los botones de la pantalla',
  img.difMedia > 0.3 && img.difMedia < 40 && img.esquinas < 6 && img.centro.every((c) => c > 30) && img.hud.every((d) => d === 'none') && img.vrHud === 'flex', img);
// 3) la cabeza
await sostener(0, 90, 0, 0, 500); const v0 = await vista();
await sostener(0, 45, 0, 0, 500); const v45 = await vista();
await sostener(90, 90, 0, 0, 500); const v90 = await vista();
await sostener(0, 0, -90, 90, 500); const vAc = await vista();
const dYaw = ((v90.yaw - v0.yaw + 540) % 360) - 180;
ok('3. la cabeza: de pie mira al horizonte, inclinada 45° mira 45° abajo, girada 90° gira 90° a la izquierda; acostada en el casco, derecha y al horizonte',
  Math.abs(v0.f[1]) < 0.02 && Math.abs(v45.pitch - 45) < 1.5 && Math.abs(dYaw - 90) < 1.5 && Math.abs(vAc.f[1]) < 0.02 && vAc.arr > 0.99, { v0, v45, v90, dYaw, vAc });
// 4) las manos 3D donde está tu mano (a la derecha y abajo: en la imagen, abajo a la derecha del centro de cada ojo)
await ev(`window.__vrMano.pos = [0.08, 0.1, 0.3]; window.__vrMano.cierre = 0; 1`); await p.waitForTimeout(800);
const mano = await ev(`(() => { const L = VR.manos.Right; const con = ${leerPx}; const pc = con.px.slice(); L.vis = false; const sin = ${leerPx}; L.vis = true;
  const { W, H } = con, w2 = W >> 1, ojos = [[0, 0, 0], [0, 0, 0]];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const a = (y * W + x) * 4; if (Math.abs(pc[a] - sin.px[a]) + Math.abs(pc[a + 1] - sin.px[a + 1]) + Math.abs(pc[a + 2] - sin.px[a + 2]) > 30) { const o = ojos[x < w2 ? 0 : 1]; o[0]++; o[1] += x - (x < w2 ? 0 : w2); o[2] += y; } }
  const r = ojos.map(([n, sx, sy]) => ({ px: n, x: n ? +(sx / n / w2).toFixed(2) : null, y: n ? +(sy / n / H).toFixed(2) : null }));   // (readPixels: la fila 0 es la de abajo)
  const P = vrPalma(L, vrOjoPos(v3())), d = vsub(P, CAM.pos);
  return { ojos: r, adelante: +vdot(d, CAM.fwd).toFixed(2), derecha: +vdot(d, CAM.der).toFixed(2), arriba: +vdot(d, CAM.arr).toFixed(2), vis: L.vis, malla: !!VR.brazosOn || !!(VR.mallas.Right && R.mallas[VR.mallas.Right.id]), brazos: !!VR.brazosOn,
  medidas: (() => { const B = vrBrazosMedidas(); return B && { hombroDer: [B.H.Right.p.x, B.H.Right.p.y, B.H.Right.p.z].map((x) => +x.toFixed(3)), largo: +B.H.Right.largo.toFixed(3), kb: +B.kb.toFixed(2), alcance: +B.alcance.toFixed(3) }; })(),
  msCuadro: (() => { const t0 = performance.now(); for (let i = 0; i < 5; i++) dibujar(); return +((performance.now() - t0) / 5).toFixed(1); })(),
  msBrazos: (() => { const t0 = performance.now(); for (let i = 0; i < 20; i++) vrBrazosDibujar(vrOjoPos(v3())); return +((performance.now() - t0) / 20).toFixed(2); })() }; })()`);
await p.screenshot({ path: path.join(D, 'vr_2_manos.png') });
// 4b) el brazo te limita: la mano a 1,2 m delante de la cámara (con brazos de 1,5, a 1,8 m de los ojos)
await ev(`window.__vrMano.pos = [0.05, 0.05, 1.2]; 1`); await p.waitForTimeout(700);
const est = await ev(`(() => { const L = VR.manos.Right, B = vrBrazosMedidas(), o = vrOjoPos(v3()), q = vrQCuerpo(), s = vrHombro(B, 'Right', o, q);
  const w = vadd(vrPalma(L, o), L.pts[0]), md = MJX.vm.md, mano = celmPos(md, MJX.vm.h.RightHand);
  return { estirado: !!L.estirado, dist: +w.distTo(s).toFixed(3), alcance: +B.alcance.toFixed(3), manoModelo: +mano.distTo(w).toFixed(3), pedida: +vscale(vrDeCam(0.05, 0.05, 1.2), vrBrazos()).len().toFixed(2) }; })()`);
await p.screenshot({ path: path.join(D, 'vr_2b_estirado.png') });
ok('4b. el brazo te limita: con la mano más lejos que el largo del brazo, queda estirado y la mano (la que se ve y la que toca) en la punta',
  est.estirado && Math.abs(est.dist - est.alcance) < 0.02 && est.manoModelo < 0.03, est);
await ev(`window.__vrMano.pos = [0.08, 0.1, 0.3]; 1`); await p.waitForTimeout(400);
ok('4. la mano 3D se ve en los dos ojos, abajo a la derecha (como tu mano frente a la cámara de atrás), a medio metro',
  mano.vis && mano.malla && mano.ojos.every((o) => o.px > 150 && o.x > 0.5 && o.y < 0.5) && mano.adelante > 0.3 && mano.adelante < 0.8 && mano.derecha > 0.05 && mano.arriba < -0.05, mano);
// 5) caminar con las manos: mirando abajo, la mano a un punto del piso (la prueba pasa de dónde la quiere en el mundo a
//    dónde estaría frente a la cámara)
await sostener(0, 0, -90, 90, 200);
await ev(`(() => { window.__vrPunto = (w) => { const q = VR.qCab, o = vrOjoPos(v3()), l = q.conj().rot(vsub(w, o)), K = vrBrazos(); l.x -= 0; l.y += 0.02; l.z -= 0.08; return [-l.x / K, -l.y / K, l.z / K]; }; return 1; })()`);
// (mirar 50° abajo: el piso a la vista)
await sostener(0, 0, -40, 90, 400);
const suelo = await ev(`(() => { const o = vrOjoPos(v3()), h = mundoRayo(o, v3(0, -1, 0), 5); return h ? +(o.y - h.t).toFixed(3) : null; })()`);
const fw = await ev(`(() => { const f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(); return [f.x, f.z]; })()`);
// (la mano se mueve respecto de la cabeza, como una de verdad: «rel» es dónde está respecto de los ojos, en metros del mundo)
await ev(`(() => { window.__vrRel = (r) => { const l = VR.qCab.conj().rot(r), K = vrBrazos(); l.y += 0.02; l.z -= 0.08; return [-l.x / K, -l.y / K, l.z / K]; }; const o = vrOjoPos(v3()); window.__rel0 = v3((${fw[0]}) * 0.5, (${suelo}) - 0.04 - o.y, (${fw[1]}) * 0.5); return 1; })()`);
const ir = (atras, baja) => ev(`(() => { const r = window.__rel0.clone().add(v3(-(${fw[0]}) * (${atras}), -(${baja}), -(${fw[1]}) * (${atras}))); window.__vrMano.pos = window.__vrRel(r); return 1; })()`);
await ir(0, 0); await p.waitForTimeout(500);
const an0 = await ev(`({ anc: !!VR.manos.Right.anc, n: VR.manos.Right.anc ? +VR.manos.Right.anc.n.y.toFixed(2) : null, pos: [JUG.pos.x, JUG.pos.y, JUG.pos.z] })`);
// (para atrás por el piso, 40 cm en 0,4 s, siguiendo el mismo punto del mundo: el cuerpo va para adelante)
const p0 = an0.pos;
for (let i = 1; i <= 12; i++) { await ir(0.4 * i / 12, 0); await p.waitForTimeout(34); }
await p.waitForTimeout(200);
const an1 = await ev(`({ anc: !!VR.manos.Right.anc, pos: [JUG.pos.x, JUG.pos.y, JUG.pos.z] })`);
const avance = (an1.pos[0] - p0[0]) * fw[0] + (an1.pos[2] - p0[2]) * fw[1];
// (para abajo 20 cm: el cuerpo sube)
const y0 = an1.pos[1];
for (let i = 1; i <= 8; i++) { await ir(0.4, 0.2 * i / 8); await p.waitForTimeout(34); }
await p.waitForTimeout(200);
const an2 = await ev(`({ anc: !!VR.manos.Right.anc, y: JUG.pos.y })`);
// (un empujón rápido para atrás y soltar: sale con el envión)
for (let i = 1; i <= 6; i++) { await ir(0.4 + 0.36 * i / 6, 0.2); await p.waitForTimeout(25); }
await ev(`window.__vrMano.pos = [0.1, -0.3, 0.3]; 1`); await p.waitForTimeout(200);
const an3 = await ev(`({ anc: !!VR.manos.Right.anc, vel: [JUG.vel.x, JUG.vel.y, JUG.vel.z].map((x) => +x.toFixed(2)), libre: !!JUG.vrLibre, toques: VR.toques })`);
const velAd = an3.vel[0] * fw[0] + an3.vel[2] * fw[1];
await p.screenshot({ path: path.join(D, 'vr_3_gorila.png') });
ok('5. caminar con las manos: la mano que toca el piso se pega; para atrás 40 cm lleva el cuerpo 30–45 cm adelante, para abajo 20 cm lo sube 12–22 cm, y al soltar sale con el envión',
  an0.anc && an0.n > 0.9 && an1.anc && avance > 0.3 && avance < 0.45 && an2.y - y0 > 0.12 && an2.y - y0 < 0.22 && !an3.anc && velAd > 1 && an3.libre,
  { suelo, an0, avance: +avance.toFixed(3), sube: +(an2.y - y0).toFixed(3), an3, velAd: +velAd.toFixed(2) });
await p.waitForTimeout(1500);
// 6) agarrar: un objeto delante, la mano abierta al lado y después el puño
await sostener(0, 0, -90, 90, 300);
// (la prueba 5 dejó el cuerpo con el envión: quieto antes de seguir)
await ev(`JUG.vel.set(0, 0, 0); JUG.vrLibre = false; 1`); await p.waitForTimeout(500);
const obj = await ev(`(() => { const n = Object.keys(DATA.pfPorNombre).find((k) => /^(box|caja|crate|barril|barrel|cono|cone|silla|chair|melon|sandia)/i.test(k)) || Object.keys(DATA.pfPorNombre)[0];
  const o = vrOjoPos(v3()), f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), w = v3(o.x + f.x * 0.8, o.y - 0.5, o.z + f.z * 0.8);
  // (suelto, cae al piso y queda ahí: lo congelado no se levanta con la mano, es para trepar —prueba 6d—)
  const x = crearObjeto(n, w, new Quat()); window.__vrObj = x && x.b; if (window.__vrObj) window.__vrObj.vel.set(0, 0, 0);
  window.__vrMano.cierre = 0; window.__vrObjN = n; return { n, ok: !!window.__vrObj, masa: window.__vrObj && window.__vrObj.mass }; })()`);
await p.waitForTimeout(1500);
// (la mano abierta, al lado del objeto donde quedó, y después el puño)
// (se acerca despacio, en 0,5 s: así no lo empuja; antes, sin la mano a la vista, se la pone arriba del objeto, así no
// lo cruza de un salto desde donde estaba)
await ev(`(() => { const b = window.__vrObj; window.__vrMano.ver = false; window.__vrMano.pos = window.__vrPunto(v3(b.pos.x, b.pos.y + 0.3, b.pos.z)); return 1; })()`); await p.waitForTimeout(300);
await ev(`window.__vrMano.ver = true; 1`); await p.waitForTimeout(300);
for (let i = 0; i <= 10; i++) { await ev(`(() => { const b = window.__vrObj; window.__vrMano.pos = window.__vrPunto(v3(b.pos.x, b.pos.y + 0.05 + 0.25 * (1 - ${i} / 10), b.pos.z)); return 1; })()`); await p.waitForTimeout(50); }
await p.waitForTimeout(500);
await ev(`window.__vrMano.cierre = 1; 1`); await p.waitForTimeout(300);
const g0 = await ev(`(() => { const L = VR.manos.Right, b = window.__vrObj, P = vrPalma(L, vrOjoPos(v3())); return { ag: !!L.ag, y: b.pos.y, dbg: { cierre: L.cierre, vis: L.vis, anc: !!L.anc, cant: L.cerradaAnt, d: +b.pos.distTo(P).toFixed(3), r: b.r, est: !!b.estatico, noGrab: !!b.noGrab, npc: !!b.npc, held: !!b.held, en: PH.bodies.includes(b), vivo: JUG.vivo, veh: !!JUG.vehiculo } }; })()`);
await ev(`(() => { const b = window.__vrObj, w = v3(b.pos.x, b.pos.y + 0.3, b.pos.z); window.__vrMano.pos = window.__vrPunto(w); return 1; })()`); await p.waitForTimeout(700);
const g1 = await ev(`({ ag: !!VR.manos.Right.ag, y: window.__vrObj.pos.y, held: window.__vrObj.held })`);
// (un tirón para un costado y abrir la mano: sale tirado)
for (let i = 1; i <= 5; i++) { await ev(`(() => { const o = vrOjoPos(v3()), f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), r = CAM.der, w = v3(o.x + f.x * 0.75 + r.x * ${0.1 * i}, o.y + 0.15, o.z + f.z * 0.75 + r.z * ${0.1 * i}); window.__vrMano.pos = window.__vrPunto(w); return 1; })()`); await p.waitForTimeout(30); }
await ev(`window.__vrMano.cierre = 0; 1`); await p.waitForTimeout(200);
const g2 = await ev(`({ ag: !!VR.manos.Right.ag, held: window.__vrObj.held, vel: +window.__vrObj.vel.len().toFixed(2) })`);
await p.screenshot({ path: path.join(D, 'vr_4_agarrar.png') });
ok('6. agarrar: el puño cerca del objeto lo agarra, sube 30 cm con la mano y al abrirla sale tirado', obj.ok && g0.ag && g1.ag && g1.held && g1.y - g0.y > 0.2 && !g2.ag && !g2.held && g2.vel > 0.5,
  { obj, g0, g1, g2, sube: +(g1.y - g0.y).toFixed(3) });
// 6b) un objeto largo y fino (el tubo de oxígeno: 1 m × 22 cm), suelto en el piso. (a) El puño 25 cm arriba del medio:
//     el método viejo (desde el centro, con el radio del objeto) lo agarraba en el aire; ahora no. (b) El puño a 6 cm de
//     la punta más cercana: lo agarra de ahí, lejos del centro
await p.waitForTimeout(800);
await ev(`JUG.vel.set(0, 0, 0); JUG.vrLibre = false; 1`);
const lg0 = await ev(`(() => { const o = vrOjoPos(v3()), f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm();
  const n = ['Oxygen_tank', 'Garrafa', 'Crowbar', 'Shotgun', 'Smg', 'Akm'].find((k) => DATA.pfPorNombre[k]); if (!n) return null;
  const x = crearObjeto(n, v3(o.x + f.x * 0.6, o.y - 0.8, o.z + f.z * 0.6), Quat.euler(JUG.yaw + Math.PI / 2, Math.PI / 2)); if (!x || !x.b) return null;
  window.__vrLargo = x.b; window.__vrLargoObj = x; return { n, r: +x.b.r.toFixed(2), masa: x.b.mass }; })()`);
await p.waitForTimeout(1500);   // (cae y queda quieto en el piso)
const lg = lg0 && await ev(`(() => { const b = window.__vrLargo, o = vrOjoPos(v3()), s = vrHombro(vrBrazosMedidas(), 'Right', o, vrQCuerpo());
  // (las puntas: desde afuera, por cada lado, un rayo hacia el centro encuentra la superficie; la que esté a más de 30 cm
  // del centro y más cerca del hombro)
  let pto = null, dir = null, mejor = 1e9;
  for (const d of [v3(1, 0, 0), v3(-1, 0, 0), v3(0, 0, 1), v3(0, 0, -1), v3(0.7, 0, 0.7), v3(-0.7, 0, 0.7), v3(0.7, 0, -0.7), v3(-0.7, 0, -0.7)].map((x) => x.norm())) {
    const ini = vadd(b.pos, vscale(d, b.r * 1.5)), h = raycast(ini, vscale(d, -1), b.r * 1.5, null);
    if (!h || h.body !== b) continue; const q = vadd(ini, vscale(d, -h.t)); if (q.distTo(b.pos) < 0.3) continue;
    const ds = q.distTo(s); if (ds < mejor) { mejor = ds; pto = q; dir = d; }
  }
  // (arriba del medio: la cara de arriba y 25 cm más)
  const h2 = raycast(vadd(b.pos, v3(0, 1, 0)), v3(0, -1, 0), 1.2, null); window.__vrArriba = h2 && h2.body === b ? v3(b.pos.x, b.pos.y + 1 - h2.t + 0.25, b.pos.z) : null;
  if (!pto || !window.__vrArriba) return { ...${JSON.stringify(lg0)}, sinPunta: true };
  window.__vrPuntaMano = vadd(pto, vscale(dir, 0.06));
  return { ...${JSON.stringify(lg0)}, punta: +pto.distTo(b.pos).toFixed(2), alHombro: +mejor.toFixed(2) }; })()`);
let lgR = null, lejos = null;
if (lg && !lg.sinPunta) {
  // (a) arriba del medio
  await ev(`(() => { window.__vrMano.ver = false; window.__vrMano.cierre = 0; window.__vrMano.pos = window.__vrPunto(window.__vrArriba); return 1; })()`); await p.waitForTimeout(300);
  await ev(`window.__vrMano.ver = true; 1`); await p.waitForTimeout(400);
  await ev(`window.__vrMano.cierre = 1; 1`); await p.waitForTimeout(300);
  lejos = await ev(`(() => { const L = VR.manos.Right, b = window.__vrLargo, P = vrPalma(L, vrOjoPos(v3())); return { ag: !!L.ag, dCentro: +P.distTo(b.pos).toFixed(2), viejoAgarraba: P.distTo(b.pos) - (b.r || 0.2) * 0.8 < 0.18 }; })()`);
  await ev(`window.__vrMano.cierre = 0; 1`); await p.waitForTimeout(300);
  // (b) la punta
  await ev(`(() => { const t = window.__vrPuntaMano, b = window.__vrLargo, d = vsub(t, b.pos).norm(); window.__vrMano.ver = false; window.__vrMano.pos = window.__vrPunto(vadd(t, vscale(d, 0.25))); return 1; })()`); await p.waitForTimeout(300);
  await ev(`window.__vrMano.ver = true; 1`); await p.waitForTimeout(300);
  for (let i = 0; i <= 8; i++) { await ev(`(() => { const t = window.__vrPuntaMano, b = window.__vrLargo, d = vsub(t, b.pos).norm(), k = 0.25 * (1 - ${i} / 8); window.__vrMano.pos = window.__vrPunto(vadd(t, vscale(d, k))); return 1; })()`); await p.waitForTimeout(50); }
  await p.waitForTimeout(400);
  await ev(`window.__vrMano.cierre = 1; 1`); await p.waitForTimeout(300);
  lgR = await ev(`(() => { const L = VR.manos.Right, b = window.__vrLargo, P = vrPalma(L, vrOjoPos(v3())); return { ag: !!L.ag && L.ag.b === b, dCentro: +P.distTo(b.pos).toFixed(2), puntoAg: L.ag ? +L.ag.p.distTo(b.pos).toFixed(2) : null }; })()`);
  await ev(`window.__vrMano.cierre = 0; 1`); await p.waitForTimeout(250);
}
await p.screenshot({ path: path.join(D, 'vr_4b_punta.png') });
ok('6b. un objeto largo se agarra por la punta (lejos del centro, a pocos cm de la superficie), y 25 cm arriba del medio no (el método viejo, desde el centro, sí)',
  !!lg && !lg.sinPunta && lgR && lgR.ag && lgR.dCentro > 0.35 && lejos && !lejos.ag && lejos.viejoAgarraba, { lg, lgR, lejos });
// 6c) un NPC: el puño al lado de su pecho lo agarra (pasa a muñeco de trapo) y se lo lleva
await ev(`(() => { if (window.__vrLargoObj) borrarObjeto(window.__vrLargoObj); return 1; })()`);
const np = await ev(`(() => { const o = vrOjoPos(v3()), f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), piso = pisoBajo(v3(o.x + f.x * 0.9, o.y, o.z + f.z * 0.9), 3);
  const P = npcCrear('Hero', v3(o.x + f.x * 0.9, piso !== null ? piso : o.y - 1.05, o.z + f.z * 0.9), JUG.yaw + Math.PI, { modo: 'quieto' });
  if (!P) return null; window.__vrNpc = P; return { ok: true, pos: [P.pos.x, P.pos.y, P.pos.z].map((x) => +x.toFixed(2)) }; })()`);
await p.waitForTimeout(800);
let npR = null;
if (np) {
  // (la mano al costado del pecho, del lado de la cámara: a 12 cm de su cuerpo)
  await ev(`(() => { const P = window.__vrNpc, o = vrOjoPos(v3()), c = v3(P.pos.x, P.pos.y + 0.35, P.pos.z), d = vsub(o, c); d.y = 0; d.norm(); window.__vrMano.ver = false; window.__vrMano.pos = window.__vrPunto(vadd(c, vscale(d, 0.75))); return 1; })()`); await p.waitForTimeout(300);
  await ev(`window.__vrMano.ver = true; 1`); await p.waitForTimeout(300);
  for (let i = 0; i <= 8; i++) { await ev(`(() => { const P = window.__vrNpc, o = vrOjoPos(v3()), c = v3(P.pos.x, P.pos.y + 0.35, P.pos.z), d = vsub(o, c); d.y = 0; d.norm(); const t = vadd(c, vscale(d, 0.5 + 0.25 * (1 - ${i} / 8))); window.__vrMano.pos = window.__vrPunto(t); return 1; })()`); await p.waitForTimeout(50); }
  await p.waitForTimeout(400);
  await ev(`window.__vrMano.cierre = 1; 1`); await p.waitForTimeout(300);
  // (dónde está el punto agarrado del muñeco: tiene que seguir a la palma)
  const pos = `(() => { const L = VR.manos.Right, P = window.__vrNpc, m = vrPalma(L, vrOjoPos(v3())), g = L.ag ? vadd(L.ag.b.pos, L.ag.b.q.rot(L.ag.pl)) : null; return { ag: !!L.ag, rag: !!P.rag, held: L.ag ? !!L.ag.b.held : false, b: g ? [g.x, g.y, g.z] : null, m: [m.x, m.y, m.z], dist: g ? +g.distTo(m).toFixed(3) : null }; })()`;
  const n0 = await ev(pos);
  // (la mano 35 cm más arriba y 20 cm más cerca: lo agarrado tiene que ir con ella)
  await ev(`(() => { const L = VR.manos.Right, o = vrOjoPos(v3()), m = vrPalma(L, o), d = vsub(o, m); d.y = 0; d.norm(); window.__vrMano.pos = window.__vrPunto(vadd(m, vadd(v3(0, 0.35, 0), vscale(d, 0.2)))); return 1; })()`);
  const traza = []; for (let i = 0; i < 8; i++) { await p.waitForTimeout(100); traza.push(await ev(`(() => { const L = VR.manos.Right; if (!L.ag) return null; const b = L.ag.b, m = vrPalma(L, vrOjoPos(v3())), g = vadd(b.pos, b.q.rot(L.ag.pl)); return [+g.distTo(m).toFixed(3), +L.ag.pl.len().toFixed(3), +b.ang.len().toFixed(1), +b.vel.len().toFixed(2), !!L.estirado]; })()`)); }
  console.log('traza 6c (dist, |pl|, |ang|, |vel|, estirado):', JSON.stringify(traza));
  const n1 = await ev(pos);
  await ev(`window.__vrMano.cierre = 0; 1`); await p.waitForTimeout(250);
  const dif = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dm = dif(n1.m, n0.m), db = n0.b && n1.b ? dif(n1.b, n0.b) : null;
  npR = { n0: { ag: n0.ag, rag: n0.rag, dist: n0.dist }, n1: { ag: n1.ag, held: n1.held, dist: n1.dist }, manoMueve: dm.map((x) => +x.toFixed(2)), npcMueve: db && db.map((x) => +x.toFixed(2)), error: db ? +Math.hypot(...dif(db, dm)).toFixed(3) : null };
}
await p.screenshot({ path: path.join(D, 'vr_4c_npc.png') });
ok('6c. un NPC se agarra con el puño: pasa a muñeco de trapo y el punto agarrado sigue a la mano (a menos de 5 cm de la palma)', !!np && npR && npR.n0.ag && npR.n0.rag && npR.n1.ag && npR.n1.held && npR.n1.dist !== null && npR.n1.dist < 0.05 && Math.hypot(...npR.manoMueve) > 0.25, { np, npR });
await ev(`(() => { if (window.__vrNpc) npcQuitar(window.__vrNpc); return 1; })()`); await p.waitForTimeout(300);
// 6d) trepar: una caja congelada delante, a la altura del pecho; el puño sobre ella la agarra (no la levanta) y bajar la
//     mano 25 cm sube el cuerpo; abrirla suelta
await sostener(0, 0, -70, 90, 300);
const tr = await ev(`(() => { const o = vrOjoPos(v3()), f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), n = window.__vrObjN;
  const x = crearObjeto(n, v3(o.x + f.x * 0.6, o.y - 0.45, o.z + f.z * 0.6), new Quat()); if (!x || !x.b) return null;
  const b = x.b; b.frozen = true; b.vel.set(0, 0, 0); window.__vrTrepa = x;
  const h = raycast(v3(b.pos.x, b.pos.y + 2, b.pos.z), v3(0, -1, 0), 3, null); window.__vrTope = h && h.body === b ? v3(b.pos.x, b.pos.y + 2 - h.t, b.pos.z) : null;
  return { ok: true, tope: window.__vrTope ? +window.__vrTope.y.toFixed(2) : null }; })()`);
let trR = null;
if (tr && tr.tope !== null) {
  await ev(`(() => { const t = window.__vrTope; window.__vrMano.ver = false; window.__vrMano.cierre = 0; window.__vrMano.pos = window.__vrPunto(v3(t.x, t.y + 0.25, t.z)); return 1; })()`); await p.waitForTimeout(300);
  await ev(`window.__vrMano.ver = true; 1`); await p.waitForTimeout(300);
  for (let i = 0; i <= 8; i++) { await ev(`(() => { const t = window.__vrTope; window.__vrMano.pos = window.__vrPunto(v3(t.x, t.y + 0.06 + 0.19 * (1 - ${i} / 8), t.z)); return 1; })()`); await p.waitForTimeout(50); }
  await p.waitForTimeout(300);
  await ev(`window.__vrMano.cierre = 1; 1`); await p.waitForTimeout(300);
  const t0 = await ev(`({ anc: !!VR.manos.Right.anc, agarre: !!(VR.manos.Right.anc && VR.manos.Right.anc.agarre), ag: !!VR.manos.Right.ag, y: JUG.pos.y })`);
  // (la mano baja 25 cm respecto de los ojos, de a poco: el cuerpo sube)
  await ev(`window.__vrRelT = (() => { const L = VR.manos.Right, o = vrOjoPos(v3()); return vsub(vrPalma(L, o), o); })(); 1`);
  for (let i = 1; i <= 10; i++) { await ev(`(() => { const r = window.__vrRelT.clone().add(v3(0, -0.25 * ${i} / 10, 0)); window.__vrMano.pos = window.__vrRel(r); return 1; })()`); await p.waitForTimeout(40); }
  await p.waitForTimeout(250);
  const t1 = await ev(`({ anc: !!VR.manos.Right.anc, y: JUG.pos.y, congelada: !!window.__vrTrepa.b.frozen, held: !!window.__vrTrepa.b.held })`);
  await ev(`window.__vrMano.cierre = 0; 1`); await p.waitForTimeout(200);
  const t2 = await ev(`({ anc: !!VR.manos.Right.anc })`);
  trR = { t0, t1, t2, sube: +(t1.y - t0.y).toFixed(3) };
}
await p.screenshot({ path: path.join(D, 'vr_4d_trepar.png') });
ok('6d. trepar: el puño sobre una caja congelada se agarra (no la levanta), bajar la mano 25 cm sube el cuerpo 15–30 cm y abrirla suelta',
  !!tr && trR && trR.t0.anc && trR.t0.agarre && !trR.t0.ag && trR.sube > 0.15 && trR.sube < 0.3 && trR.t1.congelada && !trR.t1.held && !trR.t2.anc, { tr, trR });
await ev(`(() => { if (window.__vrTrepa) borrarObjeto(window.__vrTrepa); return 1; })()`);
// 7) el mando (uno estándar de mentira)
await ev(`(() => { window.__pad = { id: 'prueba', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  navigator.getGamepads = () => [window.__pad]; window.__vrMano.ver = false; return 1; })()`);
await p.waitForTimeout(600);
const m0 = await ev(`({ pos: [JUG.pos.x, JUG.pos.z], yaw: JUG.yaw })`);
await ev(`window.__pad.axes[1] = -1; 1`); await p.waitForTimeout(700); await ev(`window.__pad.axes[1] = 0; 1`); await p.waitForTimeout(150);
const m1 = await ev(`({ pos: [JUG.pos.x, JUG.pos.z], y: ENT.y })`);
const camino = (m1.pos[0] - m0.pos[0]) * Math.sin(m0.yaw) + (m1.pos[1] - m0.pos[1]) * Math.cos(m0.yaw);
await p.waitForTimeout(300);
await ev(`window.__pad.buttons[0].pressed = true; 1`); await p.waitForTimeout(120);
const m2 = await ev(`({ vy: JUG.vel.y, suelo: JUG.suelo })`); await ev(`window.__pad.buttons[0].pressed = false; 1`);
await p.waitForTimeout(800);
const yawA = await ev(`JUG.yaw`); await ev(`window.__pad.axes[2] = 1; 1`); await p.waitForTimeout(150); await ev(`window.__pad.axes[2] = 0; 1`); await p.waitForTimeout(150);
const yawB = await ev(`JUG.yaw`);
const giro30 = (((yawB - yawA) * 180 / Math.PI + 540) % 360) - 180;
ok('7a. el mando en VR: la palanca camina para adelante, A salta y la derecha gira 30° a la derecha', camino > 1 && m1.y === 0 && (m2.vy > 1 || !m2.suelo) && Math.abs(giro30 + 30) < 1,
  { camino: +camino.toFixed(2), m2, giro30: +giro30.toFixed(1) });
// 8) salir del VR (el botón de arriba)
await ev(`document.getElementById('vrX').click(); 1`); await p.waitForTimeout(500);
const s8 = await ev(`(() => { const { W, H, px } = ${leerPx}; const at = (x, y) => (y * W + x) * 4, a = at(2, 2); return { vr: VR.on, clase: document.body.classList.contains('enVR'), trasera: MJX.trasera, on: MJX.on, esquina: px[a] + px[a + 1] + px[a + 2],
  hud: getComputedStyle(document.getElementById('hud')).display, llamadas: window.__mjxLlamadas.slice(-2) }; })()`);
// (fuera del VR, la palanca derecha del mando mira)
const yA = await ev(`JUG.yaw`); await ev(`window.__pad.axes[2] = 0.8; 1`); await p.waitForTimeout(400); await ev(`window.__pad.axes[2] = 0; 1`); await p.waitForTimeout(100);
const yB = await ev(`JUG.yaw`);
await ev(`navigator.getGamepads = () => []; 1`);
await p.screenshot({ path: path.join(D, 'vr_5_fuera.png') });
const errJs = err.filter((e) => !/Failed to load resource|WebSocket connection to 'wss:\/\/broker/.test(e));
ok('7b/8. salir del VR deja todo normal (sin cámara de atrás, con los botones y la imagen entera); fuera del VR la palanca derecha del mando mira; sin errores de JS',
  !s8.vr && !s8.clase && !s8.trasera && s8.esquina > 30 && s8.hud !== 'none' && s8.llamadas.includes('apagar') && yB < yA - 0.3 && errJs.length === 0, { ...s8, mira: +(yB - yA).toFixed(2), errJs: errJs.slice(0, 5) });
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close();
