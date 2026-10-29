// ---------------------------------------------------------------------------------------------------------
// sonido: los mp3 del juego decodificados una vez. Espacial de verdad: el oído sigue a la cámara, cada fuente es un
// panner (HRTF de cerca, más barato de lejos), se apaga detrás de paredes (oclusión con un rayo) y suena con eco según
// el lugar (adentro, con techo y paredes cerca, más eco; afuera, casi nada).
// ---------------------------------------------------------------------------------------------------------
const AUD = { ctx: null, buf: {}, pend: {}, master: null, loops: new Map(), rev: null, revG: null, adentro: 0, tLugar: 0, hrtf: 0 };
function audioIniciar() {
  if (AUD.ctx) { if (AUD.ctx.state === 'suspended') AUD.ctx.resume(); return; }
  try { AUD.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const c = AUD.ctx;
  AUD.master = c.createGain(); AUD.master.gain.value = PREFS.vol / 100; AUD.master.connect(c.destination);
  // eco: respuesta al impulso inventada (ruido que se apaga), estéreo
  try {
    const n = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    AUD.rev = c.createConvolver(); AUD.rev.buffer = ir; AUD.revG = c.createGain(); AUD.revG.gain.value = 0.12; AUD.rev.connect(AUD.revG); AUD.revG.connect(AUD.master);
  } catch (e) { AUD.rev = null; }
  for (const n of DATA.son) audioBuf(n);
}
function audioBuf(n) {
  if (AUD.buf[n]) return AUD.buf[n];
  if (!AUD.ctx || AUD.pend[n]) return null;
  const p = PK.parte('a:' + n); if (!p) return null;
  AUD.pend[n] = true;
  AUD.ctx.decodeAudioData(p.slice().buffer).then((b) => (AUD.buf[n] = b)).catch(() => {});
  return null;
}
// ¿hay algo entre la cámara y el punto? (para apagar el sonido detrás de paredes)
function audioTapado(pos) {
  const d = pos.distTo(CAM.pos); if (d < 1.5 || d > 80) return false;
  const h = raycast(CAM.pos, vsub(pos, CAM.pos).norm(), d - 0.6, JUG.vehiculo ? JUG.vehiculo.b : null);
  return !!(h && (h.stat || h.ground || (h.body && h.body.estatico)));
}
// cadena de una fuente en el lugar: ganancia → filtro (oclusión) → panner → salida (+ eco)
function fuente3D(pos, vol) {
  const c = AUD.ctx, g = c.createGain(), f = c.createBiquadFilter(), p = c.createPanner(), d = pos.distTo(CAM.pos);
  g.gain.value = vol; f.type = 'lowpass';
  const tapado = audioTapado(pos); f.frequency.value = tapado ? 900 : 20000; if (tapado) g.gain.value *= 0.55;
  p.panningModel = d < 25 && AUD.hrtf < 24 ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 2.5; p.rolloffFactor = 1; p.maxDistance = 400;
  ponerPos(p, pos);
  g.connect(f); f.connect(p); p.connect(AUD.master);
  if (AUD.rev) { const s = c.createGain(); s.gain.value = 0.35; f.connect(s); s.connect(AUD.rev); }
  return { g, f, p };
}
function ponerPos(p, v) { if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; } else p.setPosition(v.x, v.y, v.z); }
// sonar: nombre, posición (o null = plano), volumen, tono
function sonar(n, pos, vol, tono) {
  if (!AUD.ctx || !PREFS.vol) return null;
  const b = audioBuf(n); if (!b) return null;
  if (pos && pos.distTo(CAM.pos) > 160) return null;
  const s = AUD.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = tono || 1;
  const v = vol === undefined ? 1 : vol;
  if (pos) { const F = fuente3D(pos, v); s.connect(F.g); if (F.p.panningModel === 'HRTF') { AUD.hrtf++; s.onended = () => AUD.hrtf--; } }
  else { const g = AUD.ctx.createGain(); g.gain.value = v; s.connect(g); g.connect(AUD.master); }
  s.start();
  return s;
}
// sonido en bucle atado a una cosa (motor de auto, hélice): se actualiza cada cuadro
function bucle(clave, n, pos, vol, tono) {
  if (!AUD.ctx) return;
  let L = AUD.loops.get(clave);
  if (!L) {
    const b = audioBuf(n); if (!b) return;
    const s = AUD.ctx.createBufferSource(); s.buffer = b; s.loop = true;
    const F = fuente3D(pos || CAM.pos, 0); s.connect(F.g); s.start(); L = { s, F, vivo: true, tOcl: 0 }; AUD.loops.set(clave, L);
  }
  const p = pos || CAM.pos; ponerPos(L.F.p, p);
  L.tOcl -= TIEMPO.dt || 0.016;
  if (L.tOcl <= 0) { L.tOcl = 0.25; L.tapado = audioTapado(p); L.F.f.frequency.value = L.tapado ? 900 : 20000; }
  L.F.g.gain.value = (vol || 1) * (L.tapado ? 0.55 : 1); L.s.playbackRate.value = tono || 1; L.vivo = true;
}
function buclesFin() { for (const [k, L] of AUD.loops) { if (!L.vivo) { try { L.s.stop(); } catch (e) {} AUD.loops.delete(k); } else L.vivo = false; } }
// cada cuadro: el oído en la cámara y cuánto eco según el lugar (techo y paredes cerca = adentro)
function audioPaso(dt) {
  if (!AUD.ctx) return;
  const L = AUD.ctx.listener, f = CAM.fwd, u = CAM.q.rot(v3(0, 1, 0));
  if (L.positionX) { L.positionX.value = CAM.pos.x; L.positionY.value = CAM.pos.y; L.positionZ.value = CAM.pos.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = u.x; L.upY.value = u.y; L.upZ.value = u.z; }
  else { L.setPosition(CAM.pos.x, CAM.pos.y, CAM.pos.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
  AUD.tLugar -= dt;
  if (AUD.tLugar <= 0 && JUEGO.estado === 'juego') {
    AUD.tLugar = 0.4; let n = 0;
    const techo = raycast(CAM.pos, v3(0, 1, 0), 14, null); if (techo) n += 2;
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (raycast(CAM.pos, v3(x, 0, z), 10, null)) n++;
    AUD.adentroMeta = Math.min(1, n / 6);
  }
  AUD.adentro += ((AUD.adentroMeta || 0) - AUD.adentro) * Math.min(1, dt * 2);
  if (AUD.revG) AUD.revG.gain.value = 0.06 + 0.4 * AUD.adentro;
}
