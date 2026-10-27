// ---------------------------------------------------------------------------------------------------------
// sonido: los mp3 del juego decodificados una vez; sonidos en 3D (distancia y lado) o planos (el arma propia)
// ---------------------------------------------------------------------------------------------------------
const AUD = { ctx: null, buf: {}, pend: {}, master: null, loops: new Map() };
function audioIniciar() {
  if (AUD.ctx) { if (AUD.ctx.state === 'suspended') AUD.ctx.resume(); return; }
  try { AUD.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  AUD.master = AUD.ctx.createGain(); AUD.master.gain.value = PREFS.vol / 100; AUD.master.connect(AUD.ctx.destination);
}
function audioBuf(n) {
  if (AUD.buf[n]) return AUD.buf[n];
  if (!AUD.ctx || AUD.pend[n]) return null;
  const p = PK.parte('a:' + n); if (!p) return null;
  AUD.pend[n] = true;
  AUD.ctx.decodeAudioData(p.slice().buffer).then((b) => (AUD.buf[n] = b)).catch(() => {});
  return null;
}
// sonar: nombre, posición (o null = plano), volumen, tono
function sonar(n, pos, vol, tono) {
  if (!AUD.ctx || !PREFS.vol) return null;
  const b = audioBuf(n); if (!b) return null;
  const s = AUD.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = tono || 1;
  const g = AUD.ctx.createGain(); g.gain.value = vol === undefined ? 1 : vol;
  let out = g;
  if (pos) {
    const d = pos.distTo(CAM.pos); if (d > 120) return null;
    g.gain.value *= 1 / (1 + d * 0.08);
    const pn = AUD.ctx.createStereoPanner ? AUD.ctx.createStereoPanner() : null;
    if (pn) { const rel = vsub(pos, CAM.pos); const der = CAM.q.rot(v3(-1, 0, 0)); pn.pan.value = clamp(vdot(rel, der) / (d + 0.01), -1, 1) * 0.8; g.connect(pn); out = pn; }
  }
  s.connect(g); out.connect(AUD.master); s.start();
  return s;
}
// sonido en bucle atado a una cosa (motor de auto, hélice): se actualiza cada cuadro
function bucle(clave, n, pos, vol, tono) {
  if (!AUD.ctx) return;
  let L = AUD.loops.get(clave);
  if (!L) {
    const b = audioBuf(n); if (!b) return;
    const s = AUD.ctx.createBufferSource(); s.buffer = b; s.loop = true; const g = AUD.ctx.createGain(); g.gain.value = 0;
    s.connect(g); g.connect(AUD.master); s.start(); L = { s, g, vivo: true }; AUD.loops.set(clave, L);
  }
  const d = pos ? pos.distTo(CAM.pos) : 0;
  L.g.gain.value = (vol || 1) / (1 + d * 0.08); L.s.playbackRate.value = tono || 1; L.vivo = true;
}
function buclesFin() { for (const [k, L] of AUD.loops) { if (!L.vivo) { try { L.s.stop(); } catch (e) {} AUD.loops.delete(k); } else L.vivo = false; } }
