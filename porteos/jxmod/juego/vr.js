// ---------------- Modo VR (experimental): JXMod con el celular adentro de un casco (VR box) ----------------
// Se entra desde «Partida nueva» (el botón VR, al lado de Empezar) o desde la pausa (VR). La pantalla se parte en dos,
// una imagen para cada ojo, con los ojos separados como los tuyos (Ajustes: distancia entre los ojos); la cabeza mira
// con el giroscopio del celular (sin giroscopio, con el dedo o el mouse, como siempre) y las lentes del casco, que
// curvan la imagen, se corrigen con la curva al revés (se puede apagar en Ajustes).
// En la app (64 bits, con JX Hand Engine) las manos salen de la cámara de ATRÁS, la que mira para adelante con el
// celular en el casco (ManosJX.prenderTrasera): manos 3D como las de JX Hand que flotan delante tuyo, con brazos
// largos de gorila (Ajustes: largo de los brazos), y con ellas:
//  - caminar con las manos, como en los juegos de gorilas: una mano que toca el piso, una pared o un techo se queda
//    pegada donde tocó; empujar mueve el cuerpo para el otro lado (empujar el piso para atrás te lleva adelante,
//    bajar la mano por una pared te sube) y al soltar salís con el envión: saltos y trepadas. Sólo se empuja: alejar
//    la mano de lo que tocaste la suelta;
//  - agarrar: cerrar la mano (puño) cerca de un objeto lo agarra (sigue a tu mano y gira con ella) y abrirla lo suelta
//    con el envión de la mano (tirarlo); una mano abierta empuja lo que toca;
//  - un mando (Bluetooth): la palanca izquierda camina, la derecha gira de a 30°, A salta, B se agacha, los gatillos
//    disparan (apuntás con la mirada), los botones de arriba cambian de arma, Start abre la pausa y Select centra la
//    vista. El mando también anda fuera del VR (ahí la palanca derecha mira, como el mouse).
// El cuerpo en VR es de gorila: los ojos a 1,05 m del piso (así las manos llegan al suelo sin agacharse) y sin el
// cuerpo propio a la vista (desde adentro se vería el pecho por dentro).
const VR = { on: false, alEntrar: false, ori: null, oriT: 0, angPrueba: null, yawOff: 0, yawAnt: null, qCab: new Quat(), qDisp: new Quat(), giro: false,
  manos: {}, vCuerpo: v3(), anclas: 0, fb: null, tex: null, rb: null, fbW: 0, fbH: 0, prog: null, hud: null, txt: ['', '', ''], clase: false,
  tercera: false, giroPad: false, manosOn: false, ojos: [{ pos: v3(), vp: new Float32Array(16), x: 0 }, { pos: v3(), vp: new Float32Array(16), x: 0 }],
  P: null, Pc: null, mat: -1, mallas: {}, toques: 0 };
const VR_ALTO = 1.05, VR_RADIO = 0.05, VR_K1 = 0.3, VR_K2 = 0.15, VR_Q1 = new Quat(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
const vrLentes = () => PREFS.vrLentes !== false;
const vrSep = () => clamp(+PREFS.vrOjos || 63, 50, 80) / 1000;
const vrBrazos = () => clamp(+PREFS.vrBrazos || 150, 100, 220) / 100;
// en estéreo: en VR, jugando y sin un panel abierto (la pausa y los menús se ven normales, encima de la imagen común)
const vrActivo = () => VR.on && JUEGO.estado === 'juego' && !UI.abierto && !!R.gl;
// sin el arma en la mano: con las manos de la cámara, las manos son las 3D (el arma de primera persona no va)
const vrSinVista = () => VR.manosOn && typeof MJX !== 'undefined' && MJX.on;

// ---------------- entrar y salir ----------------
function vrEntrar() {
  if (VR.on || JUEGO.estado !== 'juego') return;
  VR.on = true; VR.yawAnt = null; VR.giro = false; VR.ori = null; VR.anclas = 0; VR.vCuerpo.set(0, 0, 0); VR.toques = 0;
  VR.tercera = !!JUG.tercera; JUG.tercera = false;
  addEventListener('deviceorientation', vrOrientacion);
  vrHudCrear();
  for (const S of ['Right', 'Left']) VR.manos[S] = { S, vis: false, perdida: 9, off: null, pts: null, ult: null, anc: null, ag: null, T: v3(), pAnt: null, vel: v3(), cierre: 0, qMano: new Quat() };
  // las manos con la cámara de atrás: sólo en la app que la sabe abrir (si no, un aviso de que hay que actualizarla)
  VR.manosOn = false;
  if (typeof mjxDisponible === 'function' && mjxDisponible()) {
    let puede = false; try { puede = typeof JXManos.prenderTrasera === 'function'; } catch (e) { /* nada */ }
    if (puede) { if (MJX.on) mjxApagar(); mjxPrender(true); VR.manosOn = true; }
    else setTimeout(() => aviso(T('vr.actualizar'), 6), 4200);
  }
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nada */ }
  aviso(T('vr.entrar'), 4);
}
function vrSalir() {
  if (!VR.on) return;
  VR.on = false; removeEventListener('deviceorientation', vrOrientacion);
  JUG.tercera = VR.tercera; JUG.vrLibre = false;
  for (const S in VR.manos) vrSoltar(VR.manos[S], false);
  if (typeof MJX !== 'undefined' && MJX.trasera) { mjxApagar(); if (PREFS.jxManos && JUEGO.estado === 'juego') mjxPrender(); }
  VR.manosOn = false;
  if (VR.clase) { document.body.classList.remove('enVR'); VR.clase = false; }
}
// al empezar una partida desde el botón VR de «Partida nueva»
function vrAlEntrar() { if (VR.alEntrar) { VR.alEntrar = false; vrEntrar(); } }

// ---------------- la cabeza: el giroscopio ----------------
function vrOrientacion(e) {
  if (e.alpha === null && e.beta === null && e.gamma === null) return;
  VR.ori = [+e.alpha || 0, +e.beta || 0, +e.gamma || 0]; VR.oriT = performance.now();
}
function vrAnguloPantalla() {
  if (VR.angPrueba !== null) return VR.angPrueba;
  try { if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle; } catch (e) { /* nada */ }
  return +window.orientation || 0;
}
// la orientación del celular (alfa, beta, gama del navegador y el giro de la pantalla) como la cámara del juego: la
// cuenta de DeviceOrientationControls de three.js (cámara que mira por la espalda del celular, Y arriba) y media vuelta,
// que la cámara del juego mira para +Z (verificado: de pie mira al horizonte, inclinado 45° mira 45° abajo, y en
// horizontal —el celular en el casco— arriba queda arriba)
function vrQDisp(a, b, g, ang, out) {
  const D = Math.PI / 180, x = b * D, y = a * D, z = -g * D;
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  out.set(s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3);
  out.mul(VR_Q1).mul(Quat.axis(0, 0, 1, -ang * D)).mul(MEDIA_VUELTA);
  return out.norm();
}
// la cámara en VR: los ojos del gorila y la cabeza del giroscopio. Lo que se giró con el mouse, el dedo o el mando
// (cambios de JUG.yaw que no vienen de la cabeza) se suma como giro del cuerpo
const _vrQy = new Quat();
function vrCamara(cam) {
  if (!VR.on || JUEGO.estado !== 'juego') return;
  const J = JUG;
  J.tercera = false;
  const dYaw = VR.yawAnt === null ? 0 : J.yaw - VR.yawAnt;
  if (dYaw) { VR.yawOff += dYaw; vrGirarManos(dYaw); }
  const giro = !!VR.ori && performance.now() - VR.oriT < 1000;
  if (giro) {
    const q = vrQDisp(VR.ori[0], VR.ori[1], VR.ori[2], vrAnguloPantalla(), VR.qDisp);
    // (la primera vez: hacia donde miraba el personaje)
    if (!VR.giro) { const f = q.rot(v3(0, 0, 1)); VR.yawOff = J.yaw - Math.atan2(f.x, f.z); }
    VR.qCab.copy(_vrQy.copy(Quat.axis(0, 1, 0, VR.yawOff))).mul(q).norm();
    const f = VR.qCab.rot(v3(0, 0, 1));
    J.yaw = Math.atan2(f.x, f.z); J.pitch = clamp(Math.asin(clamp(-f.y, -1, 1)), -1.55, 1.55);
  } else VR.qCab.copy(Quat.euler(J.yaw, J.pitch));
  VR.giro = giro; VR.yawAnt = J.yaw;
  cam.q.copy(VR.qCab);
  if (J.vivo && !J.vehiculo) vrOjoPos(cam.pos);
}
const vrOjoPos = (out) => out.set(JUG.pos.x, JUG.pos.y - 0.95 + VR_ALTO, JUG.pos.z);
// centrar: lo que mirás pasa a ser adelante del cuerpo de cuando entraste (Select del mando)
function vrCentrar() { VR.giro = false; aviso(T('vr.centrado'), 1.5); }

// ---------------- la imagen: dos ojos ----------------
// lo de cada cuadro: la proyección de cada ojo (la mitad de la pantalla), sus matrices y la de la cámara del medio, un
// poco más abierta, para elegir qué se dibuja (lo que ve cualquiera de los dos ojos)
function vrPreparar(W, H) {
  const lentes = vrLentes(), w2 = W >> 1, asp = w2 / H, fovy = (lentes ? 96 : 72) * Math.PI / 180, cerca = 0.05, lejos = vistaLejos() * 1.05;
  VR.P = M4.persp(fovy, asp, cerca, lejos); VR.Pc = M4.persp(fovy + 0.1, asp * 1.15, cerca, lejos);
  const sep = vrSep();
  for (let i = 0; i < 2; i++) {
    const o = VR.ojos[i]; o.pos.copy(CAM.pos).addS(CAM.der, (i ? 0.5 : -0.5) * sep); o.x = i * w2;
    m4mul(VR.P, M4.view(o.pos, CAM.qVista), o.vp);
  }
  if (lentes && !vrBufer(W, H)) return vrPrepararSin(W, H);
  return { lentes, w2, W, H, asp, fovy, cerca, lejos, Pc: VR.Pc, P: VR.P };
}
function vrPrepararSin(W, H) { PREFS.vrLentes = false; return vrPreparar(W, H); }
// el búfer donde se dibujan los dos ojos antes de curvarlos para las lentes
function vrBufer(W, H) {
  const gl = R.gl;
  if (VR.fb && VR.fbW === W && VR.fbH === H) return true;
  try {
    if (VR.fb) { gl.deleteFramebuffer(VR.fb); gl.deleteTexture(VR.tex); gl.deleteRenderbuffer(VR.rb); }
    VR.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, VR.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null); R.texAct = null;
    VR.rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, VR.rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, R.gl1 ? gl.DEPTH_COMPONENT16 : gl.DEPTH_COMPONENT24, W, H);
    VR.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, VR.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, VR.tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, VR.rb);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { VR.fb = null; return false; }
    VR.fbW = W; VR.fbH = H; return true;
  } catch (e) { VR.fb = null; return false; }
}
// un ojo: su mitad de la pantalla (o del búfer), su matriz y desde dónde mira
function vrOjo(c, i) {
  const gl = R.gl, o = VR.ojos[i];
  gl.bindFramebuffer(gl.FRAMEBUFFER, c.lentes ? VR.fb : null);
  gl.viewport(o.x, 0, c.w2, c.H); gl.enable(gl.SCISSOR_TEST); gl.scissor(o.x, 0, c.w2, c.H);
  R.vp.set(o.vp); R.camPos.copy(o.pos); R.marca++;
}
// la curva de las lentes: cada punto de la pantalla toma el color de un poco más afuera (más cuanto más lejos del centro
// del ojo); se ve recto a través de las lentes, que agrandan más los bordes
const FS_VR = `precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec4 uK; out vec4 o;
void main(){
  float ojo = vUV.x < 0.5 ? 0.0 : 1.0;
  vec2 p = (vec2((vUV.x - ojo * 0.5) * 2.0, vUV.y) * 2.0 - 1.0) * vec2(uK.w, 1.0);
  float r2 = dot(p, p);
  vec2 s = p * (1.0 + uK.x * r2 + uK.y * r2 * r2) * uK.z / vec2(uK.w, 1.0) * 0.5 + 0.5;
  if (s.x < 0.0 || s.y < 0.0 || s.x > 1.0 || s.y > 1.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  o = vec4(texture(uTex, vec2((s.x + ojo) * 0.5, s.y)).rgb, 1.0);
}`;
function vrTerminar(c) {
  const gl = R.gl; gl.disable(gl.SCISSOR_TEST);
  if (!c.lentes) return;
  if (!VR.prog) { try { VR.prog = shader(VS_PANT, FS_VR, []); } catch (e) { console.warn('vr', e); PREFS.vrLentes = false; return; } }
  const P = VR.prog;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, c.W, c.H);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
  gl.useProgram(P.p); R.progAct = P; texEn(0, VR.tex); gl.uniform1i(P.u.uTex, 0);
  gl.uniform4f(P.u.uK, VR_K1, VR_K2, 1 / (1 + VR_K1 + VR_K2), c.asp);
  gl.bindVertexArray(R.quad); gl.drawArrays(gl.TRIANGLES, 0, 3);
  texEn(0, null); gl.bindVertexArray(null); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  R.progAct = null; R.texAct = null; R.vaoAct = null;
}

// ---------------- las manos ----------------
// de la cámara de atrás (x derecha, y abajo, z adelante) a la cabeza del juego (x izquierda, y arriba, z adelante)
const vrDeCam = (x, y, z) => v3(-x, -y, z);
// lo nuevo del motor: dónde está cada mano respecto de los ojos y sus 21 puntos respecto de la palma, girados con la
// cabeza de ese momento (así una mano quieta queda quieta en el mundo aunque gires la cabeza), con un suavizado chico
// entre un cuadro de la cámara y el siguiente
function vrManosLeer(dt) {
  const viejo = typeof MJX === 'undefined' || !MJX.on || performance.now() - MJX.tManos > 350;
  const der = viejo ? null : MJX.manos.find((m) => m.derecha), izq = viejo ? null : MJX.manos.find((m) => !m.derecha && m !== der);
  const K = vrBrazos(), esc = 1 + (K - 1) * 0.5, k = 1 - Math.exp(-dt * 30);
  for (const [S, m] of [['Right', der], ['Left', izq]]) {
    const L = VR.manos[S]; if (!L) continue;
    if (!m) { L.perdida += dt; if (L.perdida > 0.25) { L.vis = false; L.ult = null; } continue; }
    L.perdida = 0;
    if (m !== L.ult) {
      L.ult = m;
      const c = [0, 5, 9, 13, 17].reduce((a, i) => [a[0] + m.mundo[i][0] / 5, a[1] + m.mundo[i][1] / 5, a[2] + m.mundo[i][2] / 5], [0, 0, 0]);
      const q = VR.qCab, p = m.posicion;
      // (la cámara está unos 8 cm delante de los ojos; los brazos de gorila alargan lo que se aleja de la cabeza)
      L.offM = q.rot(vadd(v3(0, -0.02, 0.08), vscale(vrDeCam(p[0], p[1], p[2]), K)));
      L.ptsM = m.mundo.map((w) => q.rot(vscale(vrDeCam(w[0] - c[0], w[1] - c[1], w[2] - c[2]), esc)));
      L.cierre = Math.max(m.agarre || 0, m.gestoNombre === 'puno' ? 0.9 : 0);
    }
    if (!L.off || !L.vis) { L.off = L.offM.clone(); L.pts = L.ptsM.map((x) => x.clone()); }
    else { L.off.addS(vsub(L.offM, L.off), k); for (let i = 0; i < 21; i++) L.pts[i].addS(vsub(L.ptsM[i], L.pts[i]), k); }
    L.vis = true;
    // la orientación de la mano (para lo que se agarra): dedos (muñeca → medio) e índice (meñique → índice)
    const f = vsub(L.pts[9], L.pts[0]).norm(), i0 = vsub(L.pts[5], L.pts[17]), i = vsub(i0, vscale(f, vdot(i0, f))).norm();
    if (f.lenSq() > 0.5 && i.lenSq() > 0.5) L.qMano = qBase(i, vcross(f, i), f);
  }
}
// un giro del cuerpo (mando, mouse): las manos giran con él
function vrGirarManos(d) {
  const q = Quat.axis(0, 1, 0, d);
  for (const S in VR.manos) { const L = VR.manos[S]; if (L.offM) { L.offM = q.rot(L.offM); L.ptsM = L.ptsM.map((x) => q.rot(x)); } if (L.off) { L.off = q.rot(L.off); L.pts = L.pts.map((x) => q.rot(x)); } }
}
const _vrO = v3(), _vrO2 = v3();
// cada paso de la física (antes que el jugador): pegarse, empujar, soltarse y agarrar. Devuelve true si el cuerpo lo
// movieron las manos (ese paso no camina ni cae)
function vrPaso(dt, ent) {
  if (!VR.on) return false;
  const J = JUG;
  if (J.suelo) J.vrLibre = false;
  if (!VR.manosOn || !J.vivo || J.vehiculo || J.noclip || J.bloqueado || J.maqFijo) { for (const S in VR.manos) { const L = VR.manos[S]; L.anc = null; } VR.anclas = 0; return false; }
  vrManosLeer(dt);
  const L2 = [VR.manos.Right, VR.manos.Left];
  // 1) las manos pegadas: dónde quedaría cada una con el cuerpo donde está; el cuerpo se corre lo que haga falta para
  //    que sigan donde tocaron (alejarla de lo que tocó la suelta: sólo se empuja)
  const ojo = vrOjoPos(_vrO);
  let dx = 0, dy = 0, dz = 0, n = 0;
  for (const L of L2) {
    if (!L.vis || L.ag) { L.anc = null; continue; }
    L.T.copy(ojo).add(L.off);
    if (!L.anc) continue;
    const o = vsub(L.T, L.anc.p);
    if (vdot(o, L.anc.n) > 0.015 || o.len() > 0.45) { L.anc = null; continue; }
    dx += L.anc.p.x - L.T.x; dy += L.anc.p.y - L.T.y; dz += L.anc.p.z - L.T.z; n++;
  }
  if (n) {
    J.vel.set(dx / n / dt, dy / n / dt, dz / n / dt); const v = J.vel.len(); if (v > 14) J.vel.scale(14 / v);
    const x0 = J.pos.x, y0 = J.pos.y, z0 = J.pos.z;
    jugadorMoverChocar(dt);
    const k = 0.35; VR.vCuerpo.set(VR.vCuerpo.x + ((J.pos.x - x0) / dt - VR.vCuerpo.x) * k, VR.vCuerpo.y + ((J.pos.y - y0) / dt - VR.vCuerpo.y) * k, VR.vCuerpo.z + ((J.pos.z - z0) / dt - VR.vCuerpo.z) * k);
    J.vel.set(0, 0, 0);
  }
  // 2) las que tocan algo nuevo: un rayo de los ojos (que nunca están adentro de una pared) a la mano
  const ojo2 = vrOjoPos(_vrO2);
  for (const L of L2) {
    if (!L.vis || L.anc || L.ag) continue;
    L.T.copy(ojo2).add(L.off);
    const d = vsub(L.T, ojo2), len = d.len(); if (len < 0.08) continue; d.scale(1 / len);
    const h = mundoRayo(ojo2, d, len + VR_RADIO);
    if (!h) continue;
    const nr = h.n.clone(); if (vdot(nr, d) > 0) nr.scale(-1);
    L.anc = { p: vadd(ojo2, vscale(d, Math.max(0.05, h.t - VR_RADIO))), n: nr };
    VR.toques++;
    // (el golpecito: más fuerte cuanto más rápido llegó la mano)
    const vel = L.vel.len(); if (vel > 0.6) sonar('CB_Impact', L.anc.p, clamp(vel * 0.05, 0.05, 0.3), 1.6);
  }
  // 3) sin ninguna mano pegada, el cuerpo sale con el envión que traía (un poco más, como los gorilas)
  const anclas = L2.filter((L) => L.anc).length;
  if (VR.anclas && !anclas) {
    const v = VR.vCuerpo.clone().scale(1.15), s = v.len(); if (s > 7.5) v.scale(7.5 / s);
    if (s > 0.4) { J.vel.copy(v); J.suelo = false; J.tiempoSuelo = 0; J.vrLibre = true; }
  }
  if (!anclas) VR.vCuerpo.scale(0.5);
  VR.anclas = anclas;
  // 4) agarrar, soltar y empujar
  vrAgarrarPaso(dt, ojo2);
  return anclas > 0;
}
// dónde está la palma en el mundo (pegada: donde tocó)
const vrPalma = (L, ojo) => (L.anc ? L.anc.p : vadd(ojo, L.off));
function vrAgarrarPaso(dt, ojo) {
  for (const S in VR.manos) {
    const L = VR.manos[S];
    if (!L.vis) { vrSoltar(L, true); L.pAnt = null; continue; }
    const P = vrPalma(L, ojo);
    if (L.pAnt) { const k = 0.4; L.vel.set(L.vel.x + ((P.x - L.pAnt.x) / dt - L.vel.x) * k, L.vel.y + ((P.y - L.pAnt.y) / dt - L.vel.y) * k, L.vel.z + ((P.z - L.pAnt.z) / dt - L.vel.z) * k); }
    const antes = L.pAnt; L.pAnt = P.clone();
    const cerrada = L.cierre > (L.ag ? 0.42 : 0.62);
    if (L.ag) {
      const b = L.ag.b;
      if (!cerrada || !PH.bodies.includes(b)) { vrSoltar(L, true); continue; }
      // (sigue a la mano: el punto agarrado va adonde está la palma y gira con ella, como la pistola física)
      const meta = vadd(P, L.qMano.rot(L.ag.rl));
      b.held = true; b.frozen = false; b.wake();
      b.vel.copy(vsub(meta, b.pos).scale(Math.min(1 / dt, 16))); const vm = b.vel.len(); if (vm > 30) b.vel.scale(30 / vm);
      const qm = L.qMano.clone().mul(L.ag.qrel), dq = new Quat().mulTo(qm, b.q.conj()); if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
      b.ang.set(dq.x * 2 / dt * 0.35, dq.y * 2 / dt * 0.35, dq.z * 2 / dt * 0.35);
      continue;
    }
    if (cerrada && !L.cerradaAnt) {
      // lo más cercano que se pueda agarrar, a menos de 18 cm de la palma
      let mejor = null, md = 0.18;
      for (const b of PH.bodies) {
        if (b.estatico || b.noGrab || b.dead || b.npc || !(b.mass < 1500) || b.held) continue;
        const d = b.pos.distTo(P) - (b.r || 0.2) * 0.8; if (d < md) { md = d; mejor = b; }
      }
      if (mejor) {
        if (mejor.obj && typeof redReclamar === 'function') redReclamar(mejor.obj);
        L.ag = { b: mejor, rl: L.qMano.conj().rot(vsub(mejor.pos, P)), qrel: L.qMano.conj().mul(mejor.q) };
        mejor.held = true; mejor.frozen = false; mejor.wake(); L.anc = null;
        sonar('Click', P, 0.25, 1.3);
      }
    }
    L.cerradaAnt = cerrada;
    // empujar: la mano abierta que se mueve rápido contra un objeto le pasa su velocidad (acercarse despacio para
    // agarrarlo no lo mueve)
    if (antes && !cerrada && L.vel.len() > 0.8) {
      const d = vsub(P, antes), len = d.len();
      if (len > 0.004) {
        d.scale(1 / len);
        const h = raycast(antes, d, len + VR_RADIO, null);
        if (h && h.body && !h.body.estatico && !h.body.held && h.body.mass < 1500) {
          const b = h.body; b.frozen = false; b.wake();
          const vn = vdot(L.vel, d) - 0.8 - vdot(b.vel, d); if (vn > 0) b.vel.addS(d, vn * clamp(2 / Math.max(1, b.mass / 20), 0.15, 1));
        }
      }
    }
  }
}
function vrSoltar(L, tirar) {
  if (!L || !L.ag) return;
  const b = L.ag.b; L.ag = null; L.cerradaAnt = true;
  if (!b) return;
  b.held = false; b.wake();
  if (tirar) { const v = L.vel.clone().scale(1.2), s = v.len(); b.vel.copy(s > 25 ? v.scale(25 / s) : v); }
}

// ---------------- la mano 3D (la de JX Hand Engine —malla.rs— pasada a JS) ----------------
// un tubo por dedo que pasa por sus articulaciones con una curva suave, más grueso en la base y con la punta redonda, y
// la palma como una almohada entre la muñeca, la base del pulgar y los nudillos. La forma (cuántos vértices y cómo se
// unen) es siempre la misma: se arma una vez y en cada cuadro sólo se mueven los vértices
const VRM = { lados: 10 };
const _ad = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], _su = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], _po = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const _pu = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], _cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const _la = (a) => Math.sqrt(_pu(a, a)), _un = (a) => { const l = _la(a); return l > 1e-6 ? _po(a, 1 / l) : [0, 0, -1]; }, _me = (a, b, t) => _ad(a, _po(_su(b, a), t));
function vrmCurva(p, n) {
  const m = p.length, sal = [];
  for (let s = 0; s < m - 1; s++) {
    const p0 = p[Math.max(0, s - 1)], p1 = p[s], p2 = p[s + 1], p3 = p[Math.min(m - 1, s + 2)];
    for (let k = 0; k < n; k++) {
      if (s > 0 && k === 0) continue;
      const t = k / n, t2 = t * t, t3 = t2 * t;
      sal.push([_ad(_ad(_po(p0, -0.5 * t3 + t2 - 0.5 * t), _po(p1, 1.5 * t3 - 2.5 * t2 + 1)), _ad(_po(p2, -1.5 * t3 + 2 * t2 + 0.5 * t), _po(p3, 0.5 * t3 - 0.5 * t2))), s + t]);
    }
  }
  sal.push([p[m - 1], m - 1]);
  return sal;
}
function vrmVert(B, p, n) { const k = B.nv++; B.P.push(p[0], p[1], p[2]); B.N.push(n[0], n[1], n[2]); return k; }
function vrmTubo(B, c, r, lados) {
  const n = c.length, I = B.I, base = B.nv;
  const t = c.map((_, k) => _un(_su(c[Math.min(n - 1, k + 1)], c[Math.max(0, k - 1)])));
  const marco0 = () => { const q = _cr(t[0], [0, 0, 1]); return _la(q) > 0.2 ? _un(q) : _un(_cr(t[0], [0, 1, 0])); };
  let nn = marco0();
  for (let k = 0; k < n; k++) {
    if (k > 0) { const q = _su(nn, _po(t[k], _pu(nn, t[k]))); if (_la(q) > 1e-4) nn = _un(q); }
    const b = _un(_cr(t[k], nn));
    for (let s = 0; s < lados; s++) {
      const th = Math.PI * 2 * s / lados, d = _ad(_po(nn, Math.cos(th)), _po(b, Math.sin(th)));
      vrmVert(B, _ad(c[k], _po(d, r[k])), d);
    }
  }
  if (I) for (let k = 0; k < n - 1; k++) for (let s = 0; s < lados; s++) {
    const a0 = base + k * lados + s, a1 = base + k * lados + (s + 1) % lados, b0 = a0 + lados, b1 = a1 + lados;
    I.push(a0, b0, a1, a1, b0, b1);
  }
  // las dos puntas: media esfera (3 anillos y el polo)
  for (const fin of [false, true]) {
    const k = fin ? n - 1 : 0, dir = fin ? t[k] : _po(t[k], -1), nk = fin ? nn : marco0(), bk = _un(_cr(t[k], nk));
    let previo = base + k * lados;
    for (let j = 1; j < 4; j++) {
      const fi = Math.PI / 2 * j / 4, ini = B.nv;
      for (let s = 0; s < lados; s++) {
        const th = Math.PI * 2 * s / lados, d = _ad(_po(nk, Math.cos(th)), _po(bk, Math.sin(th)));
        vrmVert(B, _ad(_ad(c[k], _po(d, r[k] * Math.cos(fi))), _po(dir, r[k] * Math.sin(fi))), _un(_ad(_po(d, Math.cos(fi)), _po(dir, Math.sin(fi)))));
      }
      if (I) for (let s = 0; s < lados; s++) {
        const a0 = previo + s, a1 = previo + (s + 1) % lados, b0 = ini + s, b1 = ini + (s + 1) % lados;
        if (fin) I.push(a0, b0, a1, a1, b0, b1); else I.push(a0, a1, b0, a1, b1, b0);
      }
      previo = ini;
    }
    const polo = vrmVert(B, _ad(c[k], _po(dir, r[k])), dir);
    if (I) for (let s = 0; s < lados; s++) { const a0 = previo + s, a1 = previo + (s + 1) % lados; if (fin) I.push(a0, polo, a1); else I.push(a0, a1, polo); }
  }
}
const VRM_RADIOS = [[0.20, 0.165, 0.14, 0.12], [0.15, 0.135, 0.12, 0.105], [0.155, 0.14, 0.125, 0.11], [0.145, 0.13, 0.117, 0.103], [0.125, 0.112, 0.1, 0.09]];
function vrmMano(B, q) {
  const w = Math.max(0.04, _la(_su(q[5], q[17]))), lados = VRM.lados;
  for (let d = 0; d < 5; d++) {
    const j = [1 + d * 4, 2 + d * 4, 3 + d * 4, 4 + d * 4], rr = VRM_RADIOS[d].map((x) => x * w);
    const dir = _un(_su(q[j[3]], q[j[2]])), punta = _su(q[j[3]], _po(dir, rr[3]));
    const pts = [q[j[0]], q[j[1]], q[j[2]], punta], rs = rr.slice();
    if (d > 0) { pts.unshift(_ad(q[j[0]], _po(_un(_su(q[0], q[j[0]])), _la(_su(q[j[1]], q[j[0]])) * 0.08))); rs.unshift(rr[0] * 1.02); }
    const c = vrmCurva(pts, 5);
    vrmTubo(B, c.map((x) => x[0]), c.map(([, s]) => { const k = Math.min(Math.floor(s), rs.length - 2), f = s - k; return rs[k] + (rs[k + 1] - rs[k]) * f; }), lados);
  }
  vrmPalma(B, q, w);
}
function vrmPalma(B, q, w) {
  const a = _un(_su(q[5], q[17])), arriba = _un(_su(q[9], q[0])), n = _un(_cr(a, arriba));
  const sube = (m) => _me(q[m], q[m + 1], 0.2);
  const k5 = _ad(sube(5), _po(a, 0.10 * w)), k17 = _su(sube(17), _po(a, 0.10 * w));
  const wr = _ad(_ad(q[0], _po(a, 0.36 * w)), _po(arriba, 0.05 * w)), wu = _ad(_su(q[0], _po(a, 0.32 * w)), _po(arriba, 0.05 * w));
  const top = vrmCurva([k5, sube(9), sube(13), k17], 4).map((x) => x[0]);
  const tenar = _me(_me(q[1], q[2], 0.35), q[5], 0.25), membrana = _me(q[2], q[5], 0.62);
  const rad = vrmCurva([wr, tenar, membrana, k5], 3).map((x) => x[0]);
  const hipo = _su(_me(wu, k17, 0.5), _po(a, 0.07 * w));
  const uln = vrmCurva([wu, hipo, k17], 5).map((x) => x[0]);
  const muestra = (l, t) => { const f = t * (l.length - 1), k = Math.min(Math.floor(f), l.length - 2); return _me(l[k], l[k + 1], f - k); };
  const nu = 16, nv = 8, espesor = 0.17 * w, centro = _me(q[0], q[9], 0.5), I = B.I;
  for (const lado of [1, -1]) {
    const ini = B.nv, pos = [];
    for (let j = 0; j <= nv; j++) {
      const vv = j / nv;
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, b = _me(wr, wu, u), k = muestra(top, u), sr = muestra(rad, vv), su = muestra(uln, vv);
        const p = _su(_ad(_ad(_po(b, 1 - vv), _po(k, vv)), _ad(_po(sr, 1 - u), _po(su, u))),
          _ad(_ad(_po(wr, (1 - u) * (1 - vv)), _po(wu, u * (1 - vv))), _ad(_po(k5, (1 - u) * vv), _po(k17, u * vv))));
        const h = espesor * Math.sqrt(Math.max(0, 1 - Math.abs(2 * u - 1) ** 3)) * Math.sqrt(Math.max(0, 1 - Math.abs(2 * vv - 1) ** 3));
        pos.push(_ad(p, _po(n, h * lado)));
      }
    }
    const idx = (i, j) => j * (nu + 1) + i, nor = pos.map(() => [0, 0, 0]);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      for (const [x, y, z] of [[idx(i, j), idx(i + 1, j), idx(i, j + 1)], [idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)]]) {
        const f = _cr(_su(pos[y], pos[x]), _su(pos[z], pos[x])); for (const k of [x, y, z]) nor[k] = _ad(nor[k], f);
      }
    }
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const k = idx(i, j); let nk = _un(nor[k]); if (_pu(nk, _po(n, lado)) < 0) nk = _po(nk, -1);
      if (i === 0 || j === 0 || i === nu || j === nv) { let fu = _su(pos[k], centro); fu = _un(_su(fu, _po(n, _pu(fu, n)))); nk = _un(_ad(fu, _po(n, lado * 0.25))); }
      vrmVert(B, pos[k], nk);
    }
    if (I) for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const p00 = ini + idx(i, j), p10 = ini + idx(i + 1, j), p01 = ini + idx(i, j + 1), p11 = ini + idx(i + 1, j + 1);
      if (lado > 0) I.push(p00, p10, p01, p10, p11, p01); else I.push(p00, p01, p10, p10, p01, p11);
    }
  }
}
// la malla de una mano en la placa: los vértices se suben de nuevo en cada cuadro (posición en 16 bits dentro de una
// caja fija de ±35 cm alrededor de la palma, normal en 8 bits, como las mallas del juego)
const VRM_CAJA = 0.35;
function vrmGL(S, q) {
  let G = VR.mallas[S];
  const B = { P: [], N: [], I: G && R.mallas[G.id] ? null : [], nv: 0 };
  vrmMano(B, q);
  const gl = R.gl, nv = B.nv;
  if (B.I) {
    const buf = new ArrayBuffer(nv * 14), vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, nv * 14, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, 14, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 14, 6);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, R.gl1 ? gl.UNSIGNED_SHORT : gl.HALF_FLOAT, false, 14, 10);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(B.I), gl.STATIC_DRAW);
    gl.bindVertexArray(null); R.vaoAct = null;
    const id = ID_PROPIO + GEO.malla++, mn = [-VRM_CAJA, -VRM_CAJA, -VRM_CAJA], sc = [2 * VRM_CAJA, 2 * VRM_CAJA, 2 * VRM_CAJA];
    R.mallas[id] = { vao, vb, ib, d: { mn, sc, sub: [[0, B.I.length]], v: nv, i32: false }, it: gl.UNSIGNED_SHORT, isz: 2, c: [0, 0, 0], r: VRM_CAJA * 1.5, skin: false, idx: id, propia: true };
    G = VR.mallas[S] = { id, vb, buf, dv: new DataView(buf), nv, M: new Float32Array(16) };
  }
  const dv = G.dv, P = B.P, N = B.N, e = 65535 / (2 * VRM_CAJA);
  for (let k = 0; k < nv; k++) {
    const o = k * 14;
    for (let a = 0; a < 3; a++) {
      dv.setUint16(o + a * 2, clamp(Math.round((P[k * 3 + a] + VRM_CAJA) * e), 0, 65535), true);
      dv.setInt8(o + 6 + a, Math.round(clamp(N[k * 3 + a], -1, 1) * 127));
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, G.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, G.buf);
  return G;
}
// cada cuadro, con lo demás que se dibuja: las dos manos donde están (o donde quedaron pegadas)
function vrEncolar() {
  if (!VR.on || !VR.manosOn || !R.gl) return;
  if (VR.mat < 0 || !R.mats[VR.mat]) VR.mat = matPropio('vrMano', [0.85, 0.62, 0.5], { pbr: [0.55, 0, 0.04] });
  const ojo = vrOjoPos(_vrO);
  for (const S in VR.manos) {
    const L = VR.manos[S]; if (!L.vis || !L.pts) continue;
    const P = vrPalma(L, ojo), G = vrmGL(S, L.pts.map((p) => [p.x, p.y, p.z]));
    m4trs([P.x, P.y, P.z], [0, 0, 0, 1], [1, 1, 1], G.M);
    encolar(G.id, 0, VR.mat, G.M, null, null);
  }
}

// ---------------- lo que se ve encima: el punto del medio y los avisos, en los dos ojos ----------------
function vrHudCrear() {
  if (VR.hud) return;
  const st = document.createElement('style');
  st.textContent = `#vrHud{position:fixed;inset:0;display:none;pointer-events:none;z-index:40}body.enVR #vrHud{display:flex}
body.enVR #hud,body.enVR #tactil,body.enVR .mjxPrevia{display:none!important}
#vrHud .vrOjo{flex:1;position:relative;overflow:hidden}
#vrHud .vrPunto{position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 0 0 1.5px rgba(0,0,0,.45)}
#vrHud p{position:absolute;left:14%;right:14%;margin:0;text-align:center;color:#fff;font:600 12px/1.3 system-ui,sans-serif;text-shadow:0 1px 3px #000,0 0 6px rgba(0,0,0,.6)}
#vrHud .vrMsg{top:62%}#vrHud .vrEst{top:70%;font-size:10px;font-weight:500;opacity:.85}#vrHud .vrMsg:empty,#vrHud .vrEst:empty{display:none}
#vrHud #vrX{position:absolute;top:calc(6px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);pointer-events:auto;border:0;border-radius:999px;
  background:rgba(10,10,14,.55);color:#fff;font:600 11px system-ui,sans-serif;padding:6px 12px;opacity:.75}`;
  document.head.appendChild(st);
  const h = document.createElement('div'); h.id = 'vrHud';
  const ojo = '<div class="vrOjo"><i class="vrPunto"></i><p class="vrMsg"></p><p class="vrEst"></p></div>';
  h.innerHTML = ojo + ojo + '<button id="vrX" type="button"></button>';
  document.body.appendChild(h); VR.hud = h;
  h.querySelector('#vrX').addEventListener('click', (e) => { e.stopPropagation(); vrSalir(); });
}
function vrHudTexto(i, t) {
  if (VR.txt[i] === t) return; VR.txt[i] = t;
  if (i === 2) { VR.hud.querySelector('#vrX').textContent = t; return; }
  for (const p of VR.hud.querySelectorAll(i ? '.vrEst' : '.vrMsg')) p.textContent = t;
}
// después de dibujar cada cuadro: el estéreo prendido o no (con un panel abierto, la imagen común), y los textos
function vrCuadro() {
  if (!VR.on) return;
  if (JUEGO.estado !== 'juego') { vrSalir(); return; }
  const est = vrActivo();
  if (est !== VR.clase) { VR.clase = est; document.body.classList.toggle('enVR', est); }
  if (!est || !VR.hud) return;
  const a = $('aviso');
  vrHudTexto(0, a && a.classList.contains('ve') ? a.textContent : '');
  let e = '';
  if (VR.manosOn && typeof MJX !== 'undefined') {
    if (MJX.estado === 'permiso' || MJX.estado === 'sin permiso') e = T('vr.permiso');
    else if (MJX.estado === 'listo' && !MJX.manos.length) e = T('vr.manosVer');
    else if (MJX.estado !== 'listo') e = String(MJX.estado).slice(0, 40);
  }
  if (!VR.giro && !e) e = T('vr.sinGiro');
  vrHudTexto(1, e); vrHudTexto(2, T('vr.salir'));
}

// ---------------- el mando (también fuera del VR) ----------------
// mapeo estándar: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Select, 9 Start, 10 L3, 11 R3, 12–15 la cruz. Lo que
// pone el mando se saca al soltarlo sólo si lo había puesto él (así no pisa la palanca de la pantalla ni el teclado)
const MANDO = { ant: [], puso: {}, aviso: false };
function mandoLeer() {
  let pads = [];
  try { pads = navigator.getGamepads ? [...navigator.getGamepads()].filter((p) => p && p.connected !== false) : []; } catch (e) { return; }
  const g = pads.find((p) => p.mapping === 'standard') || pads[0];
  const P = MANDO.puso, suelta = (k, v0) => { if (P[k]) { ENT[k] = v0; P[k] = false; } };
  if (!g || JUEGO.estado !== 'juego') { suelta('x', 0); suelta('y', 0); suelta('saltar', false); suelta('agachar', false); suelta('disparo', false); suelta('disparo2', false); suelta('correr', false); if (g) MANDO.ant = g.buttons.map((b) => !!(b && b.pressed)); return; }
  if (!MANDO.aviso) { MANDO.aviso = true; aviso(T('vr.mando'), 2.5); }
  const B = (i) => !!(g.buttons[i] && g.buttons[i].pressed), F = (i) => B(i) && !MANDO.ant[i], A = (i) => +g.axes[i] || 0;
  const zona = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
  const pon = (k, v, si) => { if (si) { ENT[k] = v; P[k] = true; } else suelta(k, typeof v === 'boolean' ? false : 0); };
  const abierto = !!UI.abierto;
  if (F(9)) pulso('pausa');
  if (abierto) { if (F(1)) pulso('cerrar'); MANDO.ant = g.buttons.map((b) => !!(b && b.pressed)); return; }
  const ax = zona(A(0)), ay = zona(A(1));
  pon('x', ax, !!(ax || ay)); pon('y', -ay, !!(ax || ay));
  pon('saltar', true, B(0)); pon('agachar', true, B(1)); pon('correr', true, B(10)); pon('disparo', true, B(7) || mandoValor(g, 7) > 0.5); pon('disparo2', true, B(6) || mandoValor(g, 6) > 0.5);
  if (F(2)) pulso('recargar');
  if (F(3)) pulso('usar');
  if (F(4) || F(14)) ENT.rueda -= 1;
  if (F(5) || F(15)) ENT.rueda += 1;
  if (F(12)) pulso('linterna');
  if (F(13)) pulso('menu');
  if (F(11)) pulso('patada');
  const rx = zona(A(2)), ry = zona(A(3));
  if (VR.on) {
    // (en VR, la palanca derecha gira de a 30°: girar suave marea)
    if (Math.abs(rx) > 0.7 && !VR.giroPad) { VR.giroPad = true; JUG.yaw -= Math.sign(rx) * Math.PI / 6; }
    else if (Math.abs(rx) < 0.3) VR.giroPad = false;
    if (F(8)) vrCentrar();
  } else {
    if (rx || ry) { const dt = Math.min(0.05, TIEMPO.dt || 1 / 60), s = 3.2 * dt / (ENT.sens || 0.0022); ENT.dx += rx * Math.abs(rx) * s; ENT.dy += ry * Math.abs(ry) * s * 0.8; }
    if (F(8)) pulso('camara');
  }
  MANDO.ant = g.buttons.map((b) => !!(b && b.pressed));
}
const mandoValor = (g, i) => (g.buttons[i] ? +g.buttons[i].value || 0 : 0);

Object.assign(IDI3, {
  'vr.boton': ['VR', 'VR', 'VR', 'VR', 'VR', 'VR', 'VR', 'VR', 'VR', 'VR', 'VR', 'VR', 'VR', 'VR'],
  'vr.jugar': ['Jugar en VR (con el celular en un casco)', 'Play in VR (phone in a headset)', 'Jogar em VR (celular num óculos)', 'Main dalam VR (ponsel di headset)', 'Main dalam VR (telefon dalam set kepala)',
    'Maglaro sa VR (phone sa headset)', 'VRで遊ぶ（スマホをゴーグルに）', 'เล่นแบบ VR (ใส่มือถือในแว่น)', 'VR\'da oyna (telefon gözlükte)', 'العب في الواقع الافتراضي (الهاتف داخل النظارة)', 'Играть в VR (телефон в шлеме)', 'Грати у VR (телефон у шоломі)',
    'Jouer en VR (téléphone dans un casque)', 'In VR spielen (Handy in einer Brille)'],
  'vr.entrar': ['Modo VR: poné el celular en el casco y mové la cabeza para mirar', 'VR mode: put the phone in the headset and move your head to look', 'Modo VR: coloque o celular no óculos e mova a cabeça para olhar',
    'Mode VR: pasang ponsel di headset dan gerakkan kepala untuk melihat', 'Mod VR: letak telefon dalam set kepala dan gerakkan kepala untuk melihat', 'VR mode: ilagay ang phone sa headset at igalaw ang ulo para tumingin',
    'VRモード：スマホをゴーグルに入れて、頭を動かして見回そう', 'โหมด VR: ใส่มือถือในแว่นแล้วขยับหัวเพื่อมอง', 'VR modu: telefonu gözlüğe takın ve bakmak için başınızı hareket ettirin', 'وضع الواقع الافتراضي: ضع الهاتف في النظارة وحرّك رأسك لتنظر',
    'Режим VR: вставьте телефон в шлем и двигайте головой, чтобы смотреть', 'Режим VR: вставте телефон у шолом і рухайте головою, щоб дивитися', 'Mode VR : mettez le téléphone dans le casque et bougez la tête pour regarder',
    'VR-Modus: Handy in die Brille stecken und den Kopf bewegen, um dich umzusehen'],
  'vr.salir': ['Salir del VR', 'Exit VR', 'Sair do VR', 'Keluar VR', 'Keluar VR', 'Lumabas sa VR', 'VRを終了', 'ออกจาก VR', 'VR\'dan çık', 'الخروج من الواقع الافتراضي', 'Выйти из VR', 'Вийти з VR', 'Quitter la VR', 'VR beenden'],
  'vr.sinGiro': ['Sin giroscopio: mirá con el dedo, el mouse o el mando', 'No gyroscope: look with your finger, the mouse or a controller', 'Sem giroscópio: olhe com o dedo, o mouse ou o controle',
    'Tanpa giroskop: lihat dengan jari, mouse, atau kontroler', 'Tiada giroskop: lihat dengan jari, tetikus atau alat kawalan', 'Walang gyroscope: tumingin gamit ang daliri, mouse o controller',
    'ジャイロなし：指・マウス・コントローラーで見回そう', 'ไม่มีไจโร: มองด้วยนิ้ว เมาส์ หรือจอย', 'Jiroskop yok: parmak, fare veya kumandayla bakın', 'لا يوجد جيروسكوب: انظر بإصبعك أو الفأرة أو وحدة التحكم',
    'Нет гироскопа: смотрите пальцем, мышью или геймпадом', 'Немає гіроскопа: дивіться пальцем, мишею або геймпадом', 'Pas de gyroscope : regardez avec le doigt, la souris ou une manette', 'Kein Gyroskop: schau mit dem Finger, der Maus oder einem Controller'],
  'vr.manosVer': ['Mostrá tus manos a la cámara de atrás', 'Show your hands to the back camera', 'Mostre suas mãos para a câmera traseira', 'Tunjukkan tangan ke kamera belakang', 'Tunjukkan tangan kepada kamera belakang',
    'Ipakita ang mga kamay sa likod na camera', '背面カメラに手を見せて', 'ยื่นมือให้กล้องหลังเห็น', 'Ellerinizi arka kameraya gösterin', 'أظهر يديك للكاميرا الخلفية', 'Покажите руки задней камере', 'Покажіть руки задній камері',
    'Montrez vos mains à la caméra arrière', 'Zeig deine Hände der Rückkamera'],
  'vr.actualizar': ['Para usar tus manos en VR, actualizá la app de JXMod', 'To use your hands in VR, update the JXMod app', 'Para usar as mãos em VR, atualize o app do JXMod', 'Untuk memakai tangan di VR, perbarui aplikasi JXMod',
    'Untuk guna tangan dalam VR, kemas kini aplikasi JXMod', 'Para gamitin ang mga kamay sa VR, i-update ang JXMod app', 'VRで手を使うにはJXModアプリを更新してね', 'อัปเดตแอป JXMod เพื่อใช้มือใน VR', 'VR\'da ellerinizi kullanmak için JXMod uygulamasını güncelleyin',
    'لاستخدام يديك في الواقع الافتراضي حدّث تطبيق JXMod', 'Чтобы использовать руки в VR, обновите приложение JXMod', 'Щоб використовувати руки у VR, оновіть застосунок JXMod', 'Pour utiliser vos mains en VR, mettez à jour l\'appli JXMod',
    'Um deine Hände in VR zu nutzen, aktualisiere die JXMod-App'],
  'vr.permiso': ['Permití la cámara para usar tus manos', 'Allow the camera to use your hands', 'Permita a câmera para usar as mãos', 'Izinkan kamera untuk memakai tangan', 'Benarkan kamera untuk guna tangan',
    'Payagan ang camera para gamitin ang mga kamay', '手を使うにはカメラを許可してね', 'อนุญาตกล้องเพื่อใช้มือ', 'Ellerinizi kullanmak için kameraya izin verin', 'اسمح بالكاميرا لاستخدام يديك', 'Разрешите камеру, чтобы использовать руки',
    'Дозвольте камеру, щоб використовувати руки', 'Autorisez la caméra pour utiliser vos mains', 'Erlaube die Kamera, um deine Hände zu nutzen'],
  'vr.centrado': ['Vista centrada', 'View centered', 'Visão centralizada', 'Tampilan ditengahkan', 'Pandangan dipusatkan', 'Nakasentro ang view', '視点をリセット', 'จัดมุมมองกึ่งกลางแล้ว', 'Görünüm ortalandı', 'تم توسيط العرض',
    'Вид отцентрирован', 'Вигляд відцентровано', 'Vue recentrée', 'Ansicht zentriert'],
  'vr.mando': ['Mando conectado', 'Controller connected', 'Controle conectado', 'Kontroler tersambung', 'Alat kawalan disambung', 'Nakakonekta ang controller', 'コントローラー接続', 'เชื่อมต่อจอยแล้ว', 'Kumanda bağlandı', 'تم توصيل وحدة التحكم',
    'Геймпад подключён', 'Геймпад підключено', 'Manette connectée', 'Controller verbunden'],
  'aj.vrLentes': ['VR: corregir la curva de las lentes del casco', 'VR: correct the headset lens curve', 'VR: corrigir a curva das lentes', 'VR: koreksi lengkung lensa headset', 'VR: betulkan lengkung kanta set kepala',
    'VR: itama ang kurba ng lente ng headset', 'VR：レンズの歪みを補正', 'VR: แก้ความโค้งของเลนส์', 'VR: gözlük merceğinin eğriliğini düzelt', 'الواقع الافتراضي: تصحيح انحناء العدسات', 'VR: исправлять искажение линз', 'VR: виправляти викривлення лінз',
    'VR : corriger la courbure des lentilles', 'VR: Linsenverzerrung ausgleichen'],
  'aj.vrOjos': ['VR: distancia entre los ojos (mm)', 'VR: distance between the eyes (mm)', 'VR: distância entre os olhos (mm)', 'VR: jarak antar mata (mm)', 'VR: jarak antara mata (mm)', 'VR: layo ng mga mata (mm)', 'VR：目の間隔 (mm)',
    'VR: ระยะห่างระหว่างตา (มม.)', 'VR: gözler arası mesafe (mm)', 'الواقع الافتراضي: المسافة بين العينين (مم)', 'VR: расстояние между глазами (мм)', 'VR: відстань між очима (мм)', 'VR : écart entre les yeux (mm)', 'VR: Augenabstand (mm)'],
  'aj.vrBrazos': ['VR: largo de los brazos (%)', 'VR: arm length (%)', 'VR: comprimento dos braços (%)', 'VR: panjang lengan (%)', 'VR: panjang lengan (%)', 'VR: haba ng braso (%)', 'VR：腕の長さ (%)', 'VR: ความยาวแขน (%)',
    'VR: kol uzunluğu (%)', 'الواقع الافتراضي: طول الذراعين (%)', 'VR: длина рук (%)', 'VR: довжина рук (%)', 'VR : longueur des bras (%)', 'VR: Armlänge (%)'],
});
addEventListener('gamepadconnected', () => { MANDO.aviso = false; });
