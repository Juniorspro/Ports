// ---------------- cámara libre (botón del HUD): L vuela la cámara sola, R es la cámara de Roblox ----------------
// Tocar el botón de la cámara libre despliega abajo dos botones: L y R. Con L la cámara se suelta del personaje y vuela por
// el mapa (palanca o WASD para moverse hacia donde mira, saltar para subir, agacharse para bajar, correr para ir rápido);
// el personaje se queda quieto donde estaba y se lo ve. Con R la cámara gira alrededor del personaje como en Roblox: el
// dedo o el mouse giran la cámara, el personaje camina hacia donde se empuja la palanca (relativo a la cámara) y se da
// vuelta para ese lado; la cámara no atraviesa paredes. Tocar otra vez el modo activo, o el botón principal, vuelve a la
// cámara normal.
const CLIB = { menu: false, modo: null, pos: v3(), yaw: 0, pitch: 0.25, dist: 7, mx: 0, my: 0, sube: 0, rapido: false, ter0: false };
function clibElegir(m) {
  if (CLIB.modo === m || !m) { if (CLIB.modo) { JUG.tercera = CLIB.ter0; CLIB.modo = null; } clibBotones(); return; }
  if (!CLIB.modo) CLIB.ter0 = !!JUG.tercera;
  CLIB.modo = m; CLIB.yaw = JUG.yaw; CLIB.pitch = m === 'R' ? 0.3 : JUG.pitch; CLIB.pos.copy(CAM.pos);
  JUG.tercera = true;   // (el cuerpo propio se ve y no el arma de primera persona)
  clibBotones();
}
// algo pasó a primera persona mientras la cámara libre estaba puesta (el botón de la cámara, un emote, un mod): se
// suelta la cámara libre y la vista vuelve a los ojos del personaje, mirando hacia donde miraba la cámara libre
function clibVigente() {
  if (!CLIB.modo || JUG.tercera) return !!CLIB.modo;
  JUG.yaw = CLIB.yaw; if (CLIB.modo === 'L') JUG.pitch = clamp(CLIB.pitch, -1.55, 1.55);
  CLIB.modo = null; clibBotones(); return false;
}
function clibMenu() { CLIB.menu = !CLIB.menu; if (!CLIB.menu) clibElegir(null); clibBotones(); }
function clibBotones() {
  const c = $('camLibBtns'); if (c) c.classList.toggle('oc', !CLIB.menu);
  for (const [k, m] of [['camLibL', 'L'], ['camLibR', 'R']]) { const b = document.querySelector(`[data-btn="${k}"]`); if (b) b.classList.toggle('sel', CLIB.modo === m); }
  const p = document.querySelector('[data-btn="camLibre"]'); if (p) p.classList.toggle('sel', CLIB.menu);
}
// la entrada de este cuadro: en L la palanca mueve la cámara (no al personaje); en R el personaje camina hacia la palanca
function clibEntrada() {
  if (!clibVigente() || JUEGO.estado !== 'juego' || JUG.vehiculo) return;
  if (CLIB.modo === 'L') {
    CLIB.mx = ENT.x; CLIB.my = ENT.y; CLIB.sube = (ENT.saltar ? 1 : 0) - (ENT.agachar ? 1 : 0); CLIB.rapido = !!ENT.correr;
    // (el personaje no camina: se le saca la entrada en este cuadro y clibDevolver la vuelve a poner al final, porque con el
    // dedo la palanca sólo escribe cuando el dedo se mueve y los botones de subir/bajar sólo al apoyarlos: si no, con el dedo
    // quieto la cámara se frenaba enseguida)
    CLIB.dev = [ENT.x, ENT.y, ENT.saltar, ENT.agachar];
    ENT.x = ENT.y = 0; ENT.saltar = false; ENT.agachar = false;
  } else {
    const m = Math.min(1, Math.hypot(ENT.x, ENT.y));
    // (lo mismo: con el dedo quieto, el cuadro siguiente tiene que ver la dirección de la palanca, no la ya girada)
    if (m > 0.05) { CLIB.dev = [ENT.x, ENT.y, ENT.saltar, ENT.agachar]; const meta = CLIB.yaw + Math.atan2(-ENT.x, ENT.y), d = Math.atan2(Math.sin(meta - JUG.yaw), Math.cos(meta - JUG.yaw)); JUG.yaw += d * 0.3; ENT.y = m; ENT.x = 0; }
  }
}
function clibDevolver() {
  if (!CLIB.dev) return;
  if (ENT.tactil) [ENT.x, ENT.y, ENT.saltar, ENT.agachar] = CLIB.dev;   // (con teclado entradaLeer la lee de nuevo cada cuadro)
  CLIB.dev = null;
}
// mirar: el dedo o el mouse giran la cámara libre (no al personaje)
function clibMirar(mx, my) { CLIB.yaw -= mx * ENT.sens; CLIB.pitch = clamp(CLIB.pitch + my * ENT.sens, CLIB.modo === 'R' ? -0.6 : -1.55, 1.4); }
function clibCamara(out, dt) {
  if (!clibVigente() || JUEGO.estado !== 'juego' || JUG.vehiculo) return;
  const q = Quat.euler(CLIB.yaw, CLIB.pitch);
  if (CLIB.modo === 'L') {
    const f = q.rot(v3(0, 0, 1)), r = q.rot(v3(-1, 0, 0)), v = (CLIB.rapido ? 20 : 8) * (dt || 0.016);
    CLIB.pos.addS(f, CLIB.my * v).addS(r, CLIB.mx * v).addS(v3(0, 1, 0), CLIB.sube * v);
    out.pos.copy(CLIB.pos);
  } else {
    // alrededor de la cabeza del personaje, sin atravesar paredes
    const centro = vadd(JUG.pos, v3(0, 0.35, 0)), atras = q.rot(v3(0, 0, -CLIB.dist)), d = atras.len(), dir = vscale(atras, 1 / d), h = typeof mundoRayo === 'function' ? mundoRayo(centro, dir, d) : null;
    out.pos.copy(centro).addS(dir, h ? Math.max(0.6, h.t - 0.3) : d); CLIB.pos.copy(out.pos);
  }
  out.q.copy(q);
}
