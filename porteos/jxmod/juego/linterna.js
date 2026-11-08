// ---------------- linterna (L o el botón táctil): en todos los mapas, como la de GMod ----------------
// un cono de luz desde los ojos hacia donde mirás, que anda en todas las calidades (es una «luz especial», la misma de la
// pizzería) y que los demás de la sala ven (bit 128 del estado). En la noche de la pizzería sigue siendo la de FNAF. El
// Lua lo ve igual que en GMod: ply:Flashlight(), ply:FlashlightIsOn(), ply:AllowFlashlight() y el hook
// PlayerSwitchFlashlight (devolver false la deja como estaba).
const LINT = { on: false, permitida: true };
const linternaFnaf = () => typeof NOC !== 'undefined' && NOC.on;
function linternaAlternar(forzar, desdeLua) {
  if (linternaFnaf()) { nocheLinterna(); return; }
  const nuevo = forzar === undefined ? !LINT.on : !!forzar;
  if (nuevo === LINT.on) return;
  if (nuevo && (!JUG.vivo || !LINT.permitida)) return;
  if (!desdeLua && typeof gmaHook === 'function' && typeof GMA !== 'undefined' && GMA.R && GMA.jug) {
    const r = gmaHook('PlayerSwitchFlashlight', 'S', GMA.jug, nuevo); if (r && r[0] === false) return;
  }
  LINT.on = nuevo; if (typeof GMA !== 'undefined') GMA.linterna = nuevo;
  sonar('IT_linterna', null, 0.5, nuevo ? 1.05 : 0.9);
  linternaPintar();
}
function linternaPintar() { const b = $('blinterna'); if (b) b.classList.toggle('sel', LINT.on); }
// (al morir o al cambiar de mapa se apaga, como en GMod)
function linternaPaso() { if (LINT.on && (!JUG.vivo || linternaFnaf())) { LINT.on = false; if (typeof GMA !== 'undefined') GMA.linterna = false; linternaPintar(); } }
function linternaLuces() {
  if (linternaFnaf()) return;   // (la noche dibuja las suyas)
  const cp = CAM.pos;
  if (LINT.on && JUG.vivo) {
    // (con la cámara afuera —la libre, la de la Tool Gun— la linterna sigue la mira del jugador, como en GMod, y no la
    // cámara: antes alumbraba hacia donde miraba la cámara libre; y sale del personaje: armas.js, camaraAfuera)
    const afuera = camaraAfuera(), qm = afuera ? Quat.euler(JUG.yaw, JUG.pitch) : null;
    const f = afuera ? qm.rot(v3(0, 0, 1)) : CAM.fwd, der = afuera ? qm.rot(v3(-1, 0, 0)) : CAM.der, ojo = JUG.tercera && JUG.cuerpo ? vadd(JUG.pos, v3(0, 0.62, 0)) : afuera ? JUG.ojoPos : cp;
    const o = vadd(vadd(ojo, vscale(f, 0.15)), vscale(der, 0.12)); o.y -= 0.12;
    // Sin el mapa de sombra de la linterna (Bajo, Patata y WebGL 1: sombras.js) nada la tapa. Corrida 17 cm de los ojos, en
    // primera persona se veía la luz «atravesar» lo que tiene adelante: detrás del borde de una columna queda una franja de
    // pared que el ojo ve y la linterna no (de 2° a 10°, más ancha cuanto más cerca está la columna), y se iluminaba igual
    // (Discord, en un mapa BSP en el celu). Ahí la luz sale de los ojos: lo que se ve es justo lo que la linterna alcanza, sin
    // costo. El arma en la mano sigue alumbrada desde donde estaba (pv: gl.js, espUniformes)
    const sinMapa = !(GFX.espSh > 0 && ESH.tex) && !afuera && !JUG.tercera;
    luzEspecial(sinMapa ? vadd(cp, vscale(f, 0.02)) : o, 30, [6.8, 6.5, 5.9], f.clone(), Math.cos(0.42), 10, true, sinMapa ? o : null);   // (la propia hace sombra: sombras.js)
  }
  for (const R2 of RED.remotos.values()) {   // (sólo hay remotos en una sala)
    if (!(R2.f & 128) || !R2.P || R2.pos.distTo(cp) > 32) continue;
    const f = Quat.euler(R2.yaw, R2.P.mira || 0).rot(v3(0, 0, 1)); luzEspecial(vadd(R2.pos, v3(0, 0.5, 0)), 26, [5.8, 5.5, 5], f, Math.cos(0.42), 6);
  }
}
const linternaBits = () => (LINT.on && !linternaFnaf() ? 128 : 0);
