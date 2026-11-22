// ---------------- JX Hand Engine en el juego: tus manos con la cámara (sólo en la app) ----------------
// Con «Manos con la cámara» prendido (Ajustes, sólo en la app de Android: en la web no están ni los archivos) se abre la
// cámara de frente y el motor de manos (porteos/jxhand: Rust compilado a WebAssembly) corre en un Worker, así el juego
// no se traba. Aparece el arma «Manos JX»: las manos de primera persona (la vista "Hands", con huesos de dedos, como el
// celular en la mano de celumano.js) copian las tuyas: la muñeca va adonde está tu mano frente a la cámara (más cerca de
// la cámara = más lejos de los ojos, como estirar el brazo), la palma gira como la tuya y cada hueso de cada dedo apunta
// como el tuyo (con el esqueleto de JX: largos calibrados y articulaciones que sólo se doblan como las de verdad; se usan
// las direcciones, así el modelo no se estira). Juntar pulgar e índice (pinza) es «usar» (abrir puertas, subir a autos).
// La cámara ve al revés que tus ojos (te mira de frente): se pasa con un giro de 180° alrededor de la vertical. Si una
// mano se pierde, la del juego baja suave hasta salir de la vista. Si el motor tarda (celulares flojos), pasa solo al
// modelo liviano de los puntos. ?jxmanos en la dirección lo prende también en la compu, para probar.
/*JXHAND*/
const MJX = { on: false, estado: 'apagado', video: null, stream: null, trab: null, ocupado: false, manos: [], tManos: 0, msProm: 0, lite: false,
  vm: null, lados: {}, pinzaAnt: false, pinzaT: 0, error: null, cuadros: 0, previa: null, w: 0, h: 0 };
const MJX_DEDOS = [['Thumb', [1, 2, 3, 4]], ['Index', [5, 6, 7, 8]], ['Middle', [9, 10, 11, 12]], ['Ring', [13, 14, 15, 16]], ['Pinky', [17, 18, 19, 20]]];
DEF_ARMAS.ManosJX = { nodo: '', ic: 'Hands', car: 0, cad: 0.3, tipo: 'jxmanos' };
const mjxEnMano = () => MJX.on && ARM.lista[ARM.i] === 'ManosJX';
// (los archivos del motor van al lado del juego sólo en la app: armar.py con PK_BIN, como los fondos animados)
const mjxDisponible = () => typeof JXHAND_ARCHIVOS !== 'undefined' && !!JXHAND_ARCHIVOS.det && (typeof JXNativo !== 'undefined' || /[?&]jxmanos/.test(location.search));

// la versión del motor que entiende esta vista web: con FMA (relaxed SIMD, Chrome 114+) o con SIMD de siempre
function mjxVersion() {
  const rel = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 61, 1, 59, 0, 253, 12, ...Array(16).fill(0), 253, 12, ...Array(16).fill(0), 253, 12, ...Array(16).fill(0), 253, 133, 2, 11]);
  try { if (WebAssembly.validate(rel)) return 'relaxed'; } catch (e) { /* sin WebAssembly */ }
  return 'simd';
}
// el Worker: el motor (web/jxhand.js, que armar.py pone en JXHAND_FUENTE) + recibir cuadros y devolver las manos
function mjxTrabajador() {
  const codigo = JXHAND_FUENTE + `
let jx = null, cv = null, cx = null;
onmessage = async (e) => {
  const m = e.data;
  if (m.tipo === 'crear') {
    try { jx = await JXHand.crear({ wasm: m.wasm, detector: m.det, puntos: m.pun }); jx.config('prediccionMs', m.pred || 50); postMessage({ tipo: 'listo' }); }
    catch (x) { postMessage({ tipo: 'error', txt: String((x && x.message) || x) }); }
    return;
  }
  if (m.tipo === 'cuadro') {
    const b = m.img;
    if (!jx) { b.close(); postMessage({ tipo: 'manos', manos: [], ms: 0 }); return; }
    if (!cv || cv.width !== b.width || cv.height !== b.height) { cv = new OffscreenCanvas(b.width, b.height); cx = cv.getContext('2d', { willReadFrequently: true }); }
    cx.drawImage(b, 0, 0); b.close();
    const d = cx.getImageData(0, 0, cv.width, cv.height), t0 = performance.now();
    const manos = jx.procesar(d.data, cv.width, cv.height, m.t, false);
    postMessage({ tipo: 'manos', manos, ms: performance.now() - t0, t: m.t, w: cv.width, h: cv.height, det: jx.corrioDetector });
  }
};`;
  return new Worker(URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' })));
}
const mjxUrl = (r) => new URL(r, location.href).href;
function mjxCrearMotor() {
  const A = JXHAND_ARCHIVOS, v = mjxVersion();
  MJX.trab.postMessage({ tipo: 'crear', wasm: mjxUrl(v === 'relaxed' ? A.relaxed : A.simd), det: mjxUrl(A.det), pun: mjxUrl(MJX.lite ? A.lite : A.pun), pred: 50 });
}

// prender y apagar
async function mjxPrender() {
  if (MJX.on || !mjxDisponible()) return;
  MJX.on = true; MJX.estado = 'cámara'; MJX.error = null;
  try {
    MJX.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } });
  } catch (e) { MJX.on = false; MJX.estado = 'sin cámara'; MJX.error = String(e && e.name || e); aviso('No se pudo abrir la cámara: ' + MJX.error, 4); return; }
  const v = document.createElement('video'); v.playsInline = true; v.muted = true; v.srcObject = MJX.stream; v.style.cssText = 'position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
  document.body.appendChild(v); MJX.video = v; v.play().catch(() => {});
  MJX.trab = mjxTrabajador(); MJX.estado = 'cargando';
  MJX.trab.onmessage = (e) => mjxMensaje(e.data);
  mjxCrearMotor();
  darArma('ManosJX');
  mjxBombear();
}
function mjxApagar() {
  MJX.on = false; MJX.estado = 'apagado'; MJX.manos = [];
  if (MJX.stream) MJX.stream.getTracks().forEach((t) => t.stop());
  if (MJX.video) MJX.video.remove();
  if (MJX.trab) MJX.trab.terminate();
  MJX.stream = MJX.video = MJX.trab = null; MJX.ocupado = false;
  const i = ARM.lista.indexOf('ManosJX'); if (i >= 0) { if (ARM.i === i) elegirArma(Math.max(0, ARM.lista.indexOf('Hands'))); ARM.lista.splice(ARM.lista.indexOf('ManosJX'), 1); if (ARM.i >= ARM.lista.length) ARM.i = 0; }
  if (MJX.previa) { MJX.previa.remove(); MJX.previa = null; }
}
function mjxMensaje(m) {
  if (m.tipo === 'listo') { MJX.estado = 'listo'; return; }
  if (m.tipo === 'error') { MJX.estado = 'error'; MJX.error = m.txt; console.error('JX Hand Engine', m.txt); return; }
  if (m.tipo === 'manos') {
    MJX.ocupado = false; MJX.cuadros++;
    if (m.ms) MJX.msProm = MJX.msProm ? MJX.msProm * 0.9 + m.ms * 0.1 : m.ms;
    MJX.manos = m.manos || []; MJX.tManos = performance.now(); MJX.w = m.w; MJX.h = m.h;
    // celular flojo: el modelo liviano de los puntos (la mitad de cuentas)
    if (!MJX.lite && MJX.cuadros > 30 && MJX.msProm > 55) { MJX.lite = true; MJX.estado = 'cargando'; mjxCrearMotor(); }
  }
}
// cada cuadro nuevo de la cámara, si el motor está libre (si no, se saltea: siempre el más nuevo)
function mjxBombear() {
  if (!MJX.on) return;
  const v = MJX.video, sig = () => { if (!MJX.on) return; if (v && v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => mjxBombear()); else setTimeout(mjxBombear, 16); };
  if (v && v.readyState >= 2 && !MJX.ocupado && MJX.estado === 'listo' && v.videoWidth) {
    MJX.ocupado = true;
    const k = Math.min(1, 480 / v.videoWidth), opts = { resizeWidth: Math.round(v.videoWidth * k), resizeHeight: Math.round(v.videoHeight * k) };
    createImageBitmap(v, opts).then((b) => { if (MJX.trab) MJX.trab.postMessage({ tipo: 'cuadro', img: b, t: performance.now() }, [b]); else b.close(); }).catch(() => { MJX.ocupado = false; });
  }
  sig();
}

// ---------------- las manos de primera persona ----------------
function mjxVista() {
  if (MJX.vm) return MJX.vm;
  const v = vistaArma('Hands', 'jxmanos'); if (!v) return null;
  MJX.vm = v; const md = v.md;
  v.h = {}; md.A.forEach((n, i) => { v.h[n.n] = i; });
  v.base = { p: md.p.map((x) => x.slice()), r: md.r.map((x) => x.slice()), s: md.s.map((x) => x.slice()) };
  return v;
}
// de la cámara del celular (x derecha, y abajo, z de la cámara hacia vos) a tus ojos en el juego (x derecha, y abajo,
// z hacia adelante): giro de 180° alrededor de la vertical; después al mundo con los ejes de la cámara del juego
function mjxEjes() { const q = CAM.q, f = q.rot(v3(0, 0, 1)), u = q.rot(v3(0, 1, 0)); return { f, u, r: celmDerecha(f, u, q) }; }
const mjxDir = (E, d) => vadd(vscale(E.r, -d[0]), vadd(vscale(E.u, -d[1]), vscale(E.f, -d[2])));
// dónde va la muñeca: x e y como frente a la cámara; la distancia: más cerca de la cámara = más lejos de los ojos
function mjxMuneca(E, m) {
  const p = m.posicion, c = [0, 5, 9, 13, 17].reduce((a, i) => [a[0] + m.mundo[i][0] / 5, a[1] + m.mundo[i][1] / 5, a[2] + m.mundo[i][2] / 5], [0, 0, 0]);
  const adelante = clamp(0.34 + (0.42 - p[2]) * 0.9, 0.18, 0.62);
  const palma = vadd(CAM.pos, vadd(vscale(E.r, -p[0] * 1.15), vadd(vscale(E.u, -p[1] * 1.15 - 0.06), vscale(E.f, adelante))));
  return vadd(palma, mjxDir(E, [m.mundo[0][0] - c[0], m.mundo[0][1] - c[1], m.mundo[0][2] - c[2]]));
}
function mjxPosarLado(v, S, m, E, dt) {
  const md = v.md, h = v.h, hand = h[S + 'Hand'], sh = h[S + 'Arm'], el = h[S + 'ForeArm']; if (hand === undefined || sh === undefined || el === undefined) return;
  const L = MJX.lados[S] || (MJX.lados[S] = { w: null, f: null, i: null, dedos: {}, vis: 0 });
  // el objetivo (o, sin la mano, abajo y afuera de la vista) y un suavizado chico (el motor ya filtra y adelanta)
  const k = 1 - Math.exp(-dt * 22);
  if (m) {
    // (los ejes de la palma salen directo de los puntos: muñeca → nudillo del medio y meñique → índice)
    const w = mjxMuneca(E, m), W = m.mundo, sub = (a, b) => [W[a][0] - W[b][0], W[a][1] - W[b][1], W[a][2] - W[b][2]];
    const fT = mjxDir(E, sub(9, 0)).norm(), iT = mjxDir(E, sub(5, 17)).norm();
    L.w = L.w ? vadd(L.w, vscale(vsub(w, L.w), k)) : w; L.f = L.f ? vadd(L.f, vscale(vsub(fT, L.f), k)).norm() : fT; L.i = L.i ? vadd(L.i, vscale(vsub(iT, L.i), k)).norm() : iT;
    for (const [D, ids] of MJX_DEDOS) for (let j = 0; j < 3; j++) {
      const a = m.mundo[ids[j]], b = m.mundo[ids[j + 1]], d = mjxDir(E, [b[0] - a[0], b[1] - a[1], b[2] - a[2]]).norm(), key = D + j;
      L.dedos[key] = L.dedos[key] ? vadd(L.dedos[key], vscale(vsub(d, L.dedos[key]), k)).norm() : d;
    }
    L.vis = Math.min(1, L.vis + dt * 4);
  } else {
    L.vis = Math.max(0, L.vis - dt * 2.5);
    if (!L.w) return;
    L.w = vadd(L.w, vscale(vsub(vadd(L.w, vscale(E.u, -0.6)), L.w), 1 - Math.exp(-dt * 3)));
  }
  if (!L.w || L.vis <= 0) return;
  // la palma: la rotación que lleva la base de la mano del modelo (dedos, lado del índice) a la tuya
  const f0 = vsub(celmPos(md, h[S + 'HandMiddle1']), celmPos(md, hand)).norm(), ir = vsub(celmPos(md, h[S + 'HandIndex1']), celmPos(md, h[S + 'HandPinky1']));
  const i0 = vsub(ir, vscale(f0, vdot(ir, f0))).norm(), fT = L.f, iT = vsub(L.i, vscale(fT, vdot(L.i, fT))).norm();
  const Qb = qBase(f0, i0, vcross(f0, i0)), Qt = qBase(fT, iT, vcross(fT, iT)), qd = Qt.clone().mul(Qb.conj()).norm();
  const qHand = qd.clone().mul(celmQMundo(md, hand)).norm();
  // el brazo: cinemática inversa de dos huesos desde el hombro del modelo (los dos lados comparten la raíz), con el codo
  // hacia afuera y abajo
  const lado = S === 'Right' ? 1 : -1, wrist = L.w;
  const a = celmPos(md, sh).distTo(celmPos(md, el)), b = celmPos(md, el).distTo(celmPos(md, hand)), S0 = celmPos(md, sh);
  const dW = vsub(wrist, S0), dist = Math.min(dW.len(), (a + b) * 0.999), dn = dW.clone().norm();
  const polo = vadd(vscale(E.r, 0.75 * lado), vscale(E.u, -0.65)).norm();
  const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), alto = a * Math.sqrt(1 - cosA * cosA);
  const lat = vsub(polo, vscale(dn, vdot(polo, dn))).norm(), codo = vadd(S0, vadd(vscale(dn, a * cosA), vscale(lat, alto)));
  celmGirar(md, sh, celmDesde(vsub(celmPos(md, el), S0).norm(), vsub(codo, S0).norm()));
  celmGirar(md, el, celmDesde(vsub(celmPos(md, hand), celmPos(md, el)).norm(), vsub(wrist, celmPos(md, el)).norm()));
  celmPonerQ(md, hand, qHand);
  // los dedos: cada hueso apunta como el tuyo
  for (const [D] of MJX_DEDOS) for (let j = 1; j <= 3; j++) {
    const i1 = h[S + 'Hand' + D + j], i2 = h[S + 'Hand' + D + (j + 1)], t = L.dedos[D + (j - 1)]; if (i1 === undefined || i2 === undefined || !t) continue;
    celmGirar(md, i1, celmDesde(vsub(celmPos(md, i2), celmPos(md, i1)).norm(), t));
  }
}
function mjxVistaDibujar() {
  const v = mjxVista(); if (!v) return false;
  const md = v.md, dt = Math.min(0.05, TIEMPO.dt || 0.016), E = mjxEjes();
  for (let i = 0; i < md.p.length; i++) { md.p[i] = v.base.p[i].slice(); md.r[i] = v.base.r[i].slice(); md.s[i] = v.base.s[i].slice(); }
  vistaUbicar(v, CAM.pos, CAM.q, { x: 0, y: 0, z: 0, qx: 0, qy: 0 }); md.actualizar();
  if (!MJX.esc) { const L = celmPos(md, v.h.RightHand).distTo(celmPos(md, v.h.RightHandMiddle4 !== undefined ? v.h.RightHandMiddle4 : v.h.RightHandMiddle3)) || 0.05; MJX.esc = 0.3 * 0.185 / L; }
  const e = MJX.esc;
  m4trs([CAM.pos.x, CAM.pos.y, CAM.pos.z], [CAM.q.x, CAM.q.y, CAM.q.z, CAM.q.w], [1, 1, 1], _mb); m4trs([0, 0, 0], [0, 0, 0, 1], [e, e, e], _mo); m4mul(_mb, _mo, md.raiz); md.sucio = true; md.actualizar();
  // los hombros del modelo, al lado de la cabeza y abajo: los dos lados
  const der = MJX.manos.find((m) => m.derecha), izq = MJX.manos.find((m) => !m.derecha && m !== der);
  const viejo = performance.now() - MJX.tManos > 400;
  mjxPosarLado(v, 'Right', viejo ? null : der, E, dt);
  mjxPosarLado(v, 'Left', viejo ? null : izq, E, dt);
  md.encolar();
  return true;
}

// ---------------- cada cuadro: gestos y la vista chica de tus manos ----------------
function mjxCuadro() {
  if (!MJX.on) return;
  // la pinza (pulgar con índice) de cualquier mano: «usar», al cerrarla (con 0,4 s entre una y otra)
  const pinza = mjxEnMano() && MJX.manos.some((m) => m.gestoNombre === 'pinza' || m.gestoNombre === 'ok' || m.pinza > 0.9);
  if (pinza && !MJX.pinzaAnt && TIEMPO.t - MJX.pinzaT > 0.4 && JUEGO.estado === 'juego' && !UI.abierto) { MJX.pinzaT = TIEMPO.t; if (typeof usar === 'function') usar(); }
  MJX.pinzaAnt = pinza;
  mjxPrevia();
}
// la vista chica (abajo a la izquierda): tus manos como líneas, el gesto y cuánto tarda el motor
function mjxPrevia() {
  const ver = mjxEnMano() && JUEGO.estado === 'juego' && PREFS.jxPrevia !== false;
  if (!ver) { if (MJX.previa) MJX.previa.style.display = 'none'; return; }
  if (!MJX.previa) {
    const c = document.createElement('canvas'); c.width = 176; c.height = 132;
    c.style.cssText = 'position:fixed;left:12px;bottom:12px;width:132px;height:99px;border-radius:10px;background:rgba(8,8,12,.55);pointer-events:none;z-index:30';
    document.body.appendChild(c); MJX.previa = c;
  }
  const c = MJX.previa, x = c.getContext('2d'); c.style.display = '';
  x.clearRect(0, 0, c.width, c.height);
  const H = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
  for (const m of MJX.manos) {
    // (espejada, como un espejo: tu derecha a la derecha)
    const P = m.img.map((p) => [(1 - p[0]) * c.width, p[1] * c.height]);
    x.strokeStyle = m.derecha ? '#ff3e8a' : '#7a3cff'; x.lineWidth = 2; x.beginPath();
    for (const [a, b] of H) { x.moveTo(P[a][0], P[a][1]); x.lineTo(P[b][0], P[b][1]); } x.stroke();
    x.fillStyle = '#ffd23f'; for (const i of [4, 8, 12, 16, 20]) { x.beginPath(); x.arc(P[i][0], P[i][1], 2.5, 0, 7); x.fill(); }
  }
  x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '600 12px system-ui,sans-serif';
  const g = MJX.manos.map((m) => m.gestoNombre).filter((n) => n !== 'nada').join(' · ');
  x.fillText(MJX.estado === 'listo' ? (g || (MJX.manos.length ? '' : 'Mostrá tus manos')) : MJX.estado, 8, 16);
  x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '11px system-ui,sans-serif';
  x.fillText((MJX.msProm ? Math.round(MJX.msProm) + ' ms' : '') + (MJX.lite ? ' · liviano' : ''), 8, c.height - 8);
}
Object.assign(IDI3, {
  'aj.jxManos': ['Manos con la cámara (JX Hand Engine)', 'Hands with the camera (JX Hand Engine)', 'Mãos com a câmera (JX Hand Engine)', 'Tangan dengan kamera (JX Hand Engine)', 'Tangan dengan kamera (JX Hand Engine)',
    'Mga kamay gamit ang camera (JX Hand Engine)', 'カメラで手を操作 (JX Hand Engine)', 'มือผ่านกล้อง (JX Hand Engine)', 'Kamerayla eller (JX Hand Engine)', 'اليدان بالكاميرا (JX Hand Engine)',
    'Руки через камеру (JX Hand Engine)', 'Руки через камеру (JX Hand Engine)', 'Mains avec la caméra (JX Hand Engine)', 'Hände mit der Kamera (JX Hand Engine)'],
});
// (si quedó prendido de la vez anterior, se vuelve a prender al entrar a una partida)
function mjxAlEntrar() { if (PREFS.jxManos && mjxDisponible() && !MJX.on) mjxPrender(); }
