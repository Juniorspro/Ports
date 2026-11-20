// ---------------------------------------------------------------------------------------------------------
// Pepe vuelve (después del evento de los 300: «ÉL VOLVERÁ»). En cualquier mapa, al entrar hay un 26 % de que en algún
// momento —entre los 45 s y los 3 min y pico— Pepe aparezca de la nada atrás tuyo, a 14–18 m: oscuro, un poco deformado, con un
// chasquido de estática. Te sigue (primero caminando, después cada vez más rápido; si te alejás mucho, en auto o
// corriendo, reaparece atrás tuyo) y te habla con su voz de Loquendo, que sale de donde está él (con subtítulo). Cerca,
// la imagen se vuelve cinta VHS, el grave sube y se oye el corazón. Cuando te alcanza —o a los 32 s, se canse o no— dice
// «Ahora te toca a vos.» y el screamer: la cara pegada a la pantalla, el grito, rojo y blanco, y negro. Después se va y
// todo sigue normal. Sólo lo ves vos (no va por la red). Con un menú abierto o muerto, el reloj no corre y él se queda
// quieto. ?pepe lo fuerza a los 4 s (?pepe=10: a los 10); en las pruebas automáticas no aparece si no lo piden. Los
// eventos en vivo (vivo.js) pueden cambiar PV.prob o llamarlo con pvForzar(segundos).
// ---------------------------------------------------------------------------------------------------------
const PV = { prob: 0.26, desde: 45, hasta: 200, cuando: -1, t: 0, f: null, vozP: null, sub: null };
// lo que dice: la primera y la última siempre; en el medio, dos de las otras
const PV_PRIMERA = 'i1', PV_ULTIMA = 'i7', PV_MEDIO = ['s3', 'e1', 'rSilencio', 'p5', 'rTodas'];
const PV_TXT = { i1: 'pv.i1', s3: 'pv.s3', e1: 'pv.e1', i7: 'pv.i7', rSilencio: 'ev3.r.rSilencio', p5: 'ev3.q.p5', rTodas: 'ev3.r.rTodas' };
const pvTocaHoy = () => Math.random() < PV.prob;
// al entrar a un mapa (principal.js, empezarPartida): se sortea si esta vez viene y cuándo
function pvEnPartida(mapa) {
  pvTerminar(); PV.t = 0; PV.cuando = -1;
  if (typeof EV3 !== 'undefined' && EV3.fase) return;
  const forz = Q.has('pepe');
  if ((TEST || navigator.webdriver) && !forz) return;
  if (!forz && !pvTocaHoy()) return;
  PV.cuando = forz ? (+Q.get('pepe') || 4) : PV.desde + Math.random() * (PV.hasta - PV.desde);
  // (las voces se decodifican ya y el Engineer, si viene en un paquete aparte, se va bajando)
  ev3AudioPreparar(); try { if (typeof rbDeSkin === 'function') rbPedir(rbDeSkin('Engineer')); } catch (e) {}
}
// (para los eventos en vivo: que venga en tantos segundos)
function pvForzar(seg) { if (PV.f || JUEGO.estado !== 'juego') return false; ev3AudioPreparar(); PV.cuando = PV.t + Math.max(0, seg || 0); return true; }
// ---------------- aparecer ----------------
// atrás tuyo, a tantos metros, sobre el piso; si hay una pared en el medio, más cerca (que se lo vea venir)
function pvPonerAtras(P, dist) {
  const yaw = JUG.yaw + Math.PI + (Math.random() - 0.5) * 1.1, dir = v3(Math.sin(yaw), 0, Math.cos(yaw));
  const ojo = vadd(JUG.pos, v3(0, 0.6, 0)), h = mundoRayo(ojo, dir, dist); if (h && h.t < dist) dist = Math.max(3, h.t - 1.2);
  const x = JUG.pos.x + dir.x * dist, z = JUG.pos.z + dir.z * dist, y = pisoBajo(v3(x, JUG.pos.y - 1, z), 3.5);
  P.pos.set(x, (y === null ? JUG.pos.y - 1 : y) + 0.96, z); P.yaw = Math.atan2(JUG.pos.x - x, JUG.pos.z - z); P.vel.set(0, 0, 0);
}
function pvAparecer() {
  ev3AudioPreparar();
  const P = crearPersona('Engineer', 'HatEmpty', { nombre: '' }); P.pvPepe = true; P.suelo = true;
  pvPonerAtras(P, 14 + Math.random() * 4); if (P.md) P.md.tinte = EV3_NEGRO; ev3Deformar(P, 0.4);
  const medio = PV_MEDIO.slice().sort(() => Math.random() - 0.5).slice(0, 2);
  PV.f = { P, fase: 'sigue', t: 0, lineas: [PV_PRIMERA, ...medio], li: 0, prox: 1.3, habla: 0, glitch: 0.45, lat: 0, dijoFin: -1, bloq: null };
  ev3Son('electrico', 0, 0.45); pvVhs(true);
}
// ---------------- la voz, desde donde está él ----------------
function pvVoz(k) {
  const A = EV3.aud, b = A.buf[k], c = AUD.ctx, dur = (typeof EV3_VOZ !== 'undefined' && EV3_VOZ.dur[k]) || 1.5;
  pvSub(T(PV_TXT[k] || k), dur + 0.7);
  if (!c || !A.bus || !b) return dur;
  const s = c.createBufferSource(), g = c.createGain(), p = c.createPanner();
  s.buffer = b; s.playbackRate.value = 0.94; g.gain.value = 1.7;
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 4; p.rolloffFactor = 0.7; p.maxDistance = 200;
  s.connect(g); g.connect(p); p.connect(A.bus); s.start(); PV.vozP = p; pvVozPos();
  return dur / 0.94;
}
function pvVozPos() { const F = PV.f; if (!PV.vozP || !F) return; ponerPos(PV.vozP, ev3Hueso(F.P, 'Head') || vadd(F.P.pos, v3(0, 0.7, 0))); }
// el subtítulo (abajo al medio, con la letra de la cinta)
function pvSub(txt, seg) {
  if (!PV.sub) { const d = document.createElement('div'); d.id = 'pvSub'; d.className = 'oc'; document.body.appendChild(d); PV.sub = d; }
  PV.sub.textContent = txt || ''; PV.sub.classList.toggle('oc', !txt); PV.subT = seg || 0;
}
// la cinta: VHS prendido sin lo escrito arriba
function pvVhs(si) {
  if (si && !VHS.on) { vhsPrender(true); for (const k of ['I', 'D', 'C', 'AI', 'AD']) vhsTexto(k, ''); }
  else if (!si && VHS.on && !(typeof EV3 !== 'undefined' && EV3.fase)) vhsPrender(false);
}
// ---------------- cada cuadro (principal.js, después del evento) ----------------
function pvPaso(dt) {
  if (PV.subT > 0) { PV.subT -= dt; if (PV.subT <= 0) pvSub(''); }
  if (!PV.f) {
    if (PV.cuando < 0 || (typeof EV3 !== 'undefined' && EV3.fase)) return;
    if (UI.abierto || !JUG.vivo) return;   // (con un menú abierto o muerto, el reloj no corre)
    PV.t += dt; if (PV.t >= PV.cuando) pvAparecer();
    return;
  }
  const F = PV.f, P = F.P;
  if (F.fase !== 'sale' && (!P || !PERS.includes(P))) { pvTerminar(); return; }   // (lo borró otra cosa: el limpiar del mapa)
  if (P.md) P.md.tinte = F.fase === 'screamer' ? null : EV3_NEGRO;   // (el modelo se cambia cuando termina de cargar: cada cuadro)
  P.suelo = true;
  if (F.fase === 'sigue') pvSigue(F, P, dt);
  else if (F.fase === 'screamer') pvGrita(F, P, dt);
  else if (F.fase === 'sale') {
    F.t += dt; VHS.negro = clamp(1 - F.t / 0.6, 0, 1);
    if (F.t > 0.6) pvTerminar();
  }
  pvVozPos();
}
function pvSigue(F, P, dt) {
  if (UI.abierto || !JUG.vivo) { P.vel.set(0, 0, 0); return; }   // (quieto: no te agarra con la pausa abierta)
  F.t += dt; const t = F.t;
  let d = v3(JUG.pos.x - P.pos.x, 0, JUG.pos.z - P.pos.z), L = Math.hypot(d.x, d.z);
  // muy lejos (en auto, corriendo): reaparece atrás tuyo, de la nada
  if (L > 38) { pvPonerAtras(P, 10 + Math.random() * 3); F.glitch = 0.35; ev3Son('electrico', 0, 0.35); d = v3(JUG.pos.x - P.pos.x, 0, JUG.pos.z - P.pos.z); L = Math.hypot(d.x, d.z); }
  const v = t < 5 ? 1.2 : t < 14 ? 2.3 : 3.5;
  if (L > 1.25 && F.dijoFin < 0) { const s = Math.min(v, (L - 1.2) / Math.max(dt, 1e-3)); P.vel.set(d.x / L * s, 0, d.z / L * s); P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; }
  else P.vel.set(0, 0, 0);
  if (L > 0.01) P.yaw = Math.atan2(d.x, d.z);
  // el piso (sube escalones de hasta 1,5 m; atraviesa paredes: es Pepe)
  const y = pisoBajo(v3(P.pos.x, P.pos.y - 0.96, P.pos.z), 1.5); if (y !== null) P.pos.y += (y + 0.96 - P.pos.y) * Math.min(1, dt * 12);
  ev3Deformar(P, 0.35 + 0.15 * Math.sin(t * 2.3));
  // lo que dice
  if (F.li < F.lineas.length && t >= F.prox && F.dijoFin < 0) { const dur = pvVoz(F.lineas[F.li++]); F.habla = t + dur; F.prox = t + dur + 2.2; F.glitch = Math.max(F.glitch, 0.15); }
  // cerca (o cansado de seguirte): termina lo que estaba diciendo mirándote, «Ahora te toca a vos.» y el screamer
  if (F.dijoFin < 0 && t >= F.habla + 0.4 && ((L < 1.5 && t > 3) || t > 32)) { F.dijoFin = t; F.finDur = pvVoz(PV_ULTIMA); if (L >= 1.5) { pvPonerAdelante(P); F.glitch = 0.3; } }
  if (F.dijoFin >= 0 && t - F.dijoFin > Math.max(1.2, F.finDur * 0.9)) { pvScreamer(F, P); return; }
  // cerca: la cinta, el grave y el corazón
  const cerca = clamp(1 - (L - 1.5) / 10, 0, 1); F.glitch = Math.max(0, F.glitch - dt);
  pvVhs(cerca > 0.2 || F.glitch > 0);
  if (VHS.on) { VHS.dano = Math.min(1, 0.35 + 0.6 * cerca + (F.glitch > 0 ? 0.5 : 0)); VHS.sacudon = F.glitch > 0 ? 0.5 : 0; }
  ev3Bucle('pvGrave', 'grave', 0.06 + 0.4 * cerca);
  F.lat -= dt; if (cerca > 0.1 && F.lat <= 0) { F.lat = 1.0 - 0.55 * cerca; ev3Son('latido', 0, 0.35 + 0.4 * cerca); }
}
// (a tu lado no llegó: aparece delante tuyo, a un metro y medio)
function pvPonerAdelante(P) {
  const f = CAM.fwd, L = Math.hypot(f.x, f.z) || 1, x = JUG.pos.x + f.x / L * 1.4, z = JUG.pos.z + f.z / L * 1.4, y = pisoBajo(v3(x, JUG.pos.y - 1, z), 2.5);
  P.pos.set(x, (y === null ? JUG.pos.y - 1 : y) + 0.96, z); P.yaw = Math.atan2(JUG.pos.x - x, JUG.pos.z - z); P.vel.set(0, 0, 0);
}
// ---------------- el screamer ----------------
function pvScreamer(F, P) {
  F.fase = 'screamer'; F.t = 0; F.bloq = JUG.bloqueado; JUG.bloqueado = true; JUG.vel.set(0, 0, 0); pvSub('');
  // (la pantalla entera para él: sin botones ni el arma en la mano)
  document.body.classList.add('pvGrita'); EV3.sinVista = true;
  ev3Son('grito', 0, 1.3); ev3Voz('f1', 1.4, 0.55); ev3Deformar(P, 1); P.escVis = 1.15; pvVhs(true); ev3BucleParar('pvGrave');
  const d = CAM.fwd; P.pos.set(CAM.pos.x + d.x * 0.42, CAM.pos.y - 1.32, CAM.pos.z + d.z * 0.42); P.yaw = Math.atan2(-d.x, -d.z);
}
function pvGrita(F, P, dt) {
  F.t += dt; const g = F.t;
  // (la cara, en el medio de la pantalla y a medio metro: se corrige con la cabeza del cuadro anterior)
  P.yaw = Math.atan2(-CAM.fwd.x, -CAM.fwd.z); P.vel.set(0, 0, 0);
  const hc = ev3Hueso(P, 'Head'); if (hc && isFinite(hc.x)) { const meta = vadd(CAM.pos, vscale(CAM.fwd, 0.5)); P.pos.addS(vsub(meta, hc), 0.6); }
  VHS.sacudon = clamp(1 - g / 1.6, 0.3, 1); VHS.rojo = Math.floor(g * 12) % 3 === 0 ? 0.45 : 0; VHS.blanco = g < 0.07 ? 1 : 0; VHS.dano = 1;
  if (g > 1.45) { VHS.negro = 1; VHS.rojo = 0; VHS.blanco = 0; VHS.sacudon = 0; P.ev3Oculto = true; }
  if (g > 1.9) { F.fase = 'sale'; F.t = 0; if (PERS.includes(P)) borrarPersona(P); F.P = { pos: P.pos, md: null, vel: P.vel }; JUG.bloqueado = !!F.bloq; F.bloq = null; pvPantalla(); }
}
// (los botones y el arma, de vuelta)
function pvPantalla() { document.body.classList.remove('pvGrita'); if (!(typeof EV3 !== 'undefined' && EV3.fase)) EV3.sinVista = false; }
// la luz del screamer (efectos.js, con las del evento): la cara iluminada de frente, que se vea lo deformada (de día, con el
// sol atrás de él, si no queda negra)
function pvLuces() { const F = PV.f; if (F && F.fase === 'screamer') luzEspecial(vadd(CAM.pos, v3(0, 0.25, 0)), 3.5, [5.5, 5, 4.4], null, -2, 99); }
// ---------------- terminar (al irse, al cambiar de mapa, al volver al menú) ----------------
function pvTerminar() {
  const F = PV.f; PV.f = null; PV.vozP = null;
  if (F) {
    if (F.fase === 'screamer') pvPantalla();
    if (F.P && PERS.includes(F.P)) borrarPersona(F.P);
    if (F.bloq !== null && F.bloq !== undefined) JUG.bloqueado = !!F.bloq;
    ev3BucleParar('pvGrave'); VHS.negro = 0; VHS.rojo = 0; VHS.blanco = 0; VHS.sacudon = 0; pvVhs(false);
    PV.cuando = -1;   // (una vez por mapa)
  }
  pvSub('');
}
Object.assign(IDI3, {
  'pv.i1': ['¿Me escuchás? Soy yo. Pepe.', "Can you hear me? It's me. Pepe.", 'Está me ouvindo? Sou eu. Pepe.'],
  'pv.s3': ['Te estoy mirando.', "I'm watching you.", 'Estou te olhando.'],
  'pv.e1': ['Pepe siempre vuelve.', 'Pepe always comes back.', 'Pepe sempre volta.'],
  'pv.i7': ['Ahora te toca a vos.', "Now it's your turn.", 'Agora é a sua vez.'],
});
