// ---------------------------------------------------------------------------------------------------------
// sonido: los mp3 del juego decodificados una vez. Espacial de verdad: el oído sigue a la cámara, cada fuente es un
// panner (HRTF de cerca, más barato de lejos), se apaga detrás de paredes (oclusión con un rayo) y suena con eco según
// el lugar (adentro, con techo y paredes cerca, más eco; afuera, casi nada).
// ---------------------------------------------------------------------------------------------------------
const AUD = { ctx: null, buf: {}, pend: {}, esperan: {}, master: null, loops: new Map(), rev: null, revG: null, adentro: 0, tLugar: 0, hrtf: 0 };
function audioIniciar() {
  // (callado en segundo plano —FONDO, abajo—: no se vuelve a prender hasta que la página se vea; «interrupted»: Safari
  // después de una llamada o de otra app con sonido)
  if (AUD.ctx) { if ((AUD.ctx.state === 'suspended' || AUD.ctx.state === 'interrupted') && !FONDO.oculto) AUD.ctx.resume().catch(() => {}); return; }
  // (celulares de 4 GB o menos, o calidad patata/baja: los sonidos se guardan a 22 kHz y en mono —cada fuente suena en 3D
  // igual—: los ~230 sonidos decodificados pasan de ~54 MB a ~13 MB, que en un celular barato es lo que hace cerrar el juego)
  AUD.mono = (navigator.deviceMemory || 4) <= 4 || /patata|bajo/.test((typeof GFX !== 'undefined' && GFX.nombre) || '');
  const C = window.AudioContext || window.webkitAudioContext;
  try { AUD.ctx = AUD.mono ? new C({ sampleRate: 22050, latencyHint: 'interactive' }) : new C(); } catch (e) { try { AUD.ctx = new C(); } catch (x) { return; } }
  const c = AUD.ctx;
  AUD.master = c.createGain(); AUD.master.gain.value = PREFS.vol / 100; AUD.master.connect(c.destination);
  // eco: respuesta al impulso inventada (ruido que se apaga), estéreo
  try {
    const n = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    AUD.rev = c.createConvolver(); AUD.rev.buffer = ir; AUD.revG = c.createGain(); AUD.revG.gain.value = 0.12; AUD.rev.connect(AUD.revG); AUD.revG.connect(AUD.master);
  } catch (e) { AUD.rev = null; }
  // (en los celulares débiles cada sonido se decodifica recién la primera vez que suena: en una partida se usan unos
  // pocos de los ~230; en los demás, todos de entrada como antes)
  if (!AUD.mono) for (const n of DATA.son) audioBuf(n);
}
function audioBuf(n, alListo) {
  if (AUD.buf[n]) return AUD.buf[n];
  if (!AUD.ctx) return null;
  if (alListo) (AUD.esperan[n] || (AUD.esperan[n] = [])).push(alListo);
  if (AUD.pend[n]) return null;
  const p = PK.parte('a:' + n); if (!p) { delete AUD.esperan[n]; return null; }
  AUD.pend[n] = true;
  AUD.ctx.decodeAudioData(p.slice().buffer).then((b) => {
    AUD.buf[n] = AUD.mono ? audioMono(b) : b;
    const L = AUD.esperan[n]; delete AUD.esperan[n]; if (L) for (const f of L) { try { f(); } catch (e) {} }
  }).catch(() => { delete AUD.esperan[n]; });
  return null;
}
// el filtro "abierto" (sin oclusión): hasta la mitad de la frecuencia del audio (a 22 kHz, 11 kHz)
const audioAbierto = () => Math.min(20000, ((AUD.ctx && AUD.ctx.sampleRate) || 44100) / 2 - 1);
// estéreo → mono (la mitad de memoria; las fuentes en el mundo se ubican en 3D de todos modos)
function audioMono(b) {
  if (!b || b.numberOfChannels < 2) return b;
  try { const m = AUD.ctx.createBuffer(1, b.length, b.sampleRate), d = m.getChannelData(0), L = b.getChannelData(0), R = b.getChannelData(1);
    for (let i = 0; i < d.length; i++) d[i] = (L[i] + R[i]) * 0.5; return m; } catch (e) { return b; }
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
  const tapado = audioTapado(pos); f.frequency.value = tapado ? 900 : audioAbierto(); if (tapado) g.gain.value *= 0.55;
  // (el sonido 3D fino —HRTF, varias veces más caro para el procesador— sólo en Alto y Ultra; en las otras, el paneo simple)
  p.panningModel = d < 25 && AUD.hrtf < 24 && (GFX.hdr || GFX.luz >= 3) ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 2.5; p.rolloffFactor = 1; p.maxDistance = 400;
  ponerPos(p, pos);
  g.connect(f); f.connect(p); p.connect(AUD.master);
  let r = null; if (AUD.rev) { r = c.createGain(); r.gain.value = 0.35; f.connect(r); r.connect(AUD.rev); }
  return { g, f, p, r };
}
function ponerPos(p, v) { if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; } else p.setPosition(v.x, v.y, v.z); }
// sonar: nombre, posición (o null = plano), volumen, tono
function sonar(n, pos, vol, tono) {
  if (!AUD.ctx || !PREFS.vol) return null;
  const b = audioBuf(n);
  if (!b) {   // (todavía no decodificado: suena apenas esté, si tarda menos de 0,35 s)
    if (AUD.mono && !AUD.buf[n]) { const t = performance.now(), P = pos ? v3(pos.x, pos.y, pos.z) : null; audioBuf(n, () => { if (performance.now() - t < 350) sonar(n, P, vol, tono); }); }
    return null;
  }
  if (pos && pos.distTo(CAM.pos) > 160) return null;
  // (tope de sonidos a la vez por calidad: llegado el tope, los lejanos —más de 12 m— no suenan; los cercanos sí. En un
  // tiroteo con 30 armas el celular no arma 60 cadenas de audio por segundo)
  const topeV = [10, 16, 24, 32, 40][Math.max(0, PERF_ORDEN.indexOf(GFX.nombre))] || 24;
  if (pos && (AUD.vocesN || 0) >= topeV && pos.distTo(CAM.pos) > 12) { AUD.vocesDesc = (AUD.vocesDesc || 0) + 1; return null; }
  const s = AUD.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = tono || 1;
  AUD.vocesN = (AUD.vocesN || 0) + 1; const finV = () => { AUD.vocesN = Math.max(0, AUD.vocesN - 1); };
  const v = vol === undefined ? 1 : vol;
  if (pos) { const F = fuente3D(pos, v); s.connect(F.g); if (F.p.panningModel === 'HRTF') { AUD.hrtf++; s.onended = () => { AUD.hrtf--; finV(); }; } else s.onended = finV; }
  else { const g = AUD.ctx.createGain(); g.gain.value = v; s.connect(g); g.connect(AUD.master); s.onended = finV; }
  s.start();
  return s;
}
// resorte (cama elástica): un "boing" hecho acá, más fuerte cuanto más fuerte el golpe
function sonarResorte(pos, k) {
  if (!AUD.ctx || !PREFS.vol) return;
  const c = AUD.ctx, t = c.currentTime, F = fuente3D(pos, 0.25 + 0.5 * k), o = c.createOscillator(), g = c.createGain(), v = c.createOscillator(), vg = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(330, t + 0.09); o.frequency.exponentialRampToValueAtTime(190, t + 0.4);
  v.frequency.value = 22; vg.gain.setValueAtTime(30, t); vg.gain.exponentialRampToValueAtTime(1, t + 0.4); v.connect(vg); vg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g); g.connect(F.g); o.start(t); v.start(t); o.stop(t + 0.5); v.stop(t + 0.5);
}
// sonido en bucle atado a una cosa (motor de auto, hélice): se actualiza cada cuadro
function bucle(clave, n, pos, vol, tono) {
  if (!AUD.ctx) return;
  let L = AUD.loops.get(clave);
  if (!L) {
    const b = audioBuf(n); if (!b) return;
    const s = AUD.ctx.createBufferSource(); s.buffer = b; s.loop = true;
    if (b.duration > 2) { s.loopStart = 0.03; s.loopEnd = b.duration - 0.03; }   // (el mp3 trae silencio en las puntas: sin esto, el bucle hace un hueco)
    const F = fuente3D(pos || CAM.pos, 0); s.connect(F.g); s.start(); L = { s, F, vivo: true, tOcl: 0 }; AUD.loops.set(clave, L);
  }
  const p = pos || CAM.pos; ponerPos(L.F.p, p);
  L.tOcl -= TIEMPO.dt || 0.016;
  if (L.tOcl <= 0) { L.tOcl = 0.25; L.tapado = audioTapado(p); L.F.f.frequency.value = L.tapado ? 900 : audioAbierto(); }
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
// ---------------- en segundo plano, todo callado ----------------
// (Discord, noviembre de 2026: «salís del juego y se queda el sonido en el celular») Cuando la página deja de verse —el
// celular va al inicio, se apaga la pantalla, se cambia de app o de pestaña— se calla todo lo que suena: el sonido del
// juego (efectos, mods, Verity y las voces del chat: todo pasa por AUD.ctx), las emisoras de la radio, los videos de
// YouTube (radio, tele, música de los emotes y su editor), la voz del sistema, los videos de la pizzería y las
// maquinitas; el micrófono deja de mandar y Verity deja de escuchar. Al volver, sigue lo que sonaba. La app de Android
// también lo pide al pausarse (Web.java: __jxFondo), por si la página no se entera a tiempo de que dejó de verse.
const FONDO = { oculto: false, nativo: false, ctx: false, media: [], yt: [], mic: [], maq: false, n: 0 };
const fondoOculta = () => FONDO.nativo || (typeof document !== 'undefined' && document.visibilityState === 'hidden');
function fondoRevisar() {
  const o = fondoOculta(); if (o === FONDO.oculto) return;
  FONDO.oculto = o; FONDO.n++;
  try { if (o) fondoCallar(); else fondoSeguir(); } catch (e) { console.warn('fondo', e); }
}
// (los reproductores de YouTube de la página: el de la radio y la tele, el de la música de los emotes y su editor)
function fondoYT() { const L = []; for (const f of document.querySelectorAll('iframe')) if (/youtube(-nocookie)?\.com\/embed\//.test(f.src || '')) L.push(f); return L; }
function fondoYTcmd(f, func, args) { try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); } catch (e) {} }
function fondoCallar() {
  const c = AUD.ctx; FONDO.ctx = !!(c && c.state === 'running'); if (FONDO.ctx) c.suspend().catch(() => {});
  // (los <audio> y <video>: los de la página y las emisoras de la radio, que no están en la página; las voces del chat
  // —<audio> mudos, el sonido va por AUD.ctx— no hace falta tocarlas)
  const M = new Set(document.querySelectorAll('audio,video')); if (typeof EST !== 'undefined') for (const S of EST.son.values()) M.add(S.a);
  FONDO.media = []; for (const m of M) if (!m.paused && !(m.srcObject && m.muted)) { FONDO.media.push(m); try { m.pause(); } catch (e) {} }
  FONDO.yt = fondoYT(); for (const f of FONDO.yt) fondoYTcmd(f, 'pauseVideo');
  FONDO.mic = []; if (typeof VOZ !== 'undefined' && VOZ.stream) for (const t of VOZ.stream.getAudioTracks()) if (t.enabled) { t.enabled = false; FONDO.mic.push(t); }
  try { if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch (e) {}
  if (typeof OIDO !== 'undefined' && OIDO.r && typeof oidoParar === 'function') oidoParar();
  FONDO.maq = !!(typeof MAQ !== 'undefined' && MAQ.ifr); if (FONDO.maq) try { MAQ.ifr.contentWindow.postMessage({ rbMaqFondo: 1 }, '*'); } catch (e) {}
}
function fondoSeguir() {
  if (FONDO.ctx && AUD.ctx) AUD.ctx.resume().catch(() => {});
  FONDO.ctx = false;
  for (const m of FONDO.media) { const p = m.play && m.play(); if (p && p.catch) p.catch(() => {}); } FONDO.media = [];
  // (los de YouTube siguen solos —sus pasos los vuelven a poner, y al tiempo de todos, en cuanto ven que están en pausa—;
  // acá se les da el empujón por si el juego no está en una partida)
  for (const f of FONDO.yt) if (f.isConnected) fondoYTcmd(f, 'playVideo'); FONDO.yt = [];
  if (typeof YT !== 'undefined') YT.vol = -1;
  if (typeof EST !== 'undefined') for (const S of EST.son.values()) if (!S.listo && S.espera) S.espera = performance.now() + 9000;   // (una que se estaba conectando no se da por mala)
  for (const t of FONDO.mic) if (t.readyState === 'live') t.enabled = true; FONDO.mic = [];
  if (FONDO.maq && typeof MAQ !== 'undefined' && MAQ.ifr) try { MAQ.ifr.contentWindow.postMessage({ rbMaqFondo: 0 }, '*'); } catch (e) {}
  FONDO.maq = false;
}
// (la app nativa: 1 al pausarse, 0 al volver adelante; devuelve si quedó callado)
window.__jxFondo = (si) => { FONDO.nativo = !!+si; fondoRevisar(); return FONDO.oculto; };
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', fondoRevisar);
  // (al irse de la página o congelarla el navegador: callado ya; al volver —pageshow, resume— se mira si se ve)
  const yaCallar = () => { if (FONDO.oculto) return; FONDO.oculto = true; FONDO.n++; try { fondoCallar(); } catch (e) {} };
  addEventListener('pagehide', yaCallar); document.addEventListener('freeze', yaCallar);
  addEventListener('pageshow', () => { FONDO.oculto = !fondoOculta(); fondoRevisar(); });
  document.addEventListener('resume', () => { FONDO.oculto = !fondoOculta(); fondoRevisar(); });
}
