// ---------------------------------------------------------------------------------------------------------
// EL EVENTO DE LOS 300 (pedido del dueño, de agradecimiento por los 300 miembros del Discord). Al actualizar, sí o sí:
//  1. la cinta (ev300_intro.js): 30 s en VHS a pantalla completa, atado a una silla en un cuarto lleno de cámaras,
//     mirando sólo lo que deja el cuello, con Pepe (el Loquendo robot) contando lo que le hicieron; recuerdos en
//     primera persona de lo que le hicimos (bajo el agua) y al final una entidad entra y nos pega;
//  2. gm_construct de noche (ev300_mis.js): 10 misiones distintas repartidas por el mapa abren los 10 sellos del
//     candado del cuarto del 1.047 (el número de muertes de Pepe, pintado arriba de la puerta; afuera, el auto chocado).
//     Controles: caminar, mirar, saltar, agacharse, usar/agarrar y la linterna; primera persona, sin props, sin celular,
//     sin armas. Si alguien se mete al cuarto por un bug, lo saca y se reinicia la última misión que hizo;
//  3. adentro, Pepe: «pedir perdón» → screamer → el juego se reinicia y vuelve el menú de siempre (con la grieta). La
//     próxima vez que entra a gm_construct sigue de noche, sólo se puede caminar, aparece «ÉL VOLVERÁ» y se cierra el
//     juego. Desde ahí, todo normal.
// Lo que se hizo queda guardado (jx_ev300): si se cierra el juego en el medio, sigue en la misma fase y con los sellos
// que tenía. Lo que se ve en 3D (los carteles, los papeles, el contador, las sogas, las luces de REC) son mallas y
// texturas hechas acá; las luces, «luces especiales» (las de la pizzería), que andan en todas las calidades.
// ?ev300 lo fuerza en las pruebas (con ?test no arranca solo); ?sinev300 lo saltea.
// ---------------------------------------------------------------------------------------------------------
const EV3_CLAVE = 'jx_ev300', EV3_MAPA = 'RB_Construct';
const EV3 = {
  fase: null, t: 0, est: { fase: 'nuevo', hechas: [], ultima: null, reinicios: {} },
  sinVista: false, armado: null, objs: [], pers: [], fijas: [], mallas: [], puntos: [], carteles: [], lleva: null, llevaFlanco: false,
  apunta: null, ui: null, panel: null, aud: { buf: {}, decod: null, bus: null, agua: null, bucles: {} }, mis: {}, hora0: 0, msj: null,
};
// ---------------- lo guardado ----------------
function ev3Leer() {
  try { const e = JSON.parse(localStorage.getItem(EV3_CLAVE) || 'null'); if (e && e.v === 1) EV3.est = Object.assign({ hechas: [], reinicios: {} }, e); } catch (e) {}
  return EV3.est;
}
function ev3Guardar() { try { localStorage.setItem(EV3_CLAVE, JSON.stringify(Object.assign({ v: 1 }, EV3.est))); } catch (e) {} }
// al arrancar el juego (principal.js, iniciar): si el evento está pendiente, arranca él en vez del menú
function ev3Arranque() {
  ev3Leer();
  // (en las pruebas automáticas —?test o el navegador manejado por un programa— sólo si lo piden: ?ev300)
  if (Q.has('sinev300') || ((TEST || navigator.webdriver) && !Q.has('ev300'))) return false;
  const f = EV3.est.fase;
  if (f === 'hecho' || f === 'despues') return false;
  ev3Empezar(f === 'puzles' ? 'puzles' : 'intro');
  return true;
}
// al entrar a un mapa (principal.js, empezarPartida): después del screamer, gm_construct guarda el epílogo
function ev3EnPartida(mapa) {
  if (EV3.fase) return;
  if (EV3.est.fase === 'despues' && mapa === EV3_MAPA && !((TEST || navigator.webdriver) && !Q.has('ev300'))) ev3Empezar('epilogo');
}
// ---------------- empezar y terminar ----------------
function ev3Empezar(fase) {
  EV3.fase = 'carga'; EV3.siguiente = fase; EV3.t = 0; EV3.armado = null;
  document.body.classList.add('ev3'); ev3Ui(); vhsPrender(true); VHS.negro = 1; VHS.dano = 0.45;
  vhsTexto('I', ''); vhsTexto('D', ''); vhsTexto('C', ''); vhsTexto('AI', ''); vhsTexto('AD', '');
  ev3AudioPreparar();
  // (Pepe y la entidad son el Engineer: si viene en un paquete aparte, que se vaya bajando ya)
  try { if (typeof rbDeSkin === 'function') rbPedir(rbDeSkin('Engineer')); } catch (e) {}
  // (la web no deja sonar nada sin un toque: la cinta arranca con «PLAY» después de tocar; en la app, sola)
  const yaToco = !!window.JXNativo || (navigator.userActivation && navigator.userActivation.hasBeenActive) || TEST;
  if (fase === 'epilogo') { ev3Fase('epilogo'); return; }
  const ir = () => { audioIniciar(); ev3AudioPreparar(); EV3.ui.cinta.classList.add('oc'); EV3.fase = 'carga'; ev3AlMapa(); };
  if (yaToco) ir(); else { EV3.ui.cinta.classList.remove('oc'); EV3.fase = 'cinta'; EV3.ui.cinta.onclick = ir; }
}
// al mapa (con su pantalla de carga) y, ya adentro, la fase
function ev3AlMapa() {
  if (JUEGO.estado === 'juego' && MUNDO.nombre === EV3_MAPA) { ev3Fase(EV3.siguiente); return; }
  const r = empezarPartida(EV3_MAPA);
  const listo = () => { if (JUEGO.estado === 'juego' && MUNDO.nombre === EV3_MAPA) ev3Fase(EV3.siguiente); else setTimeout(listo, 200); };
  if (r && r.then) r.then(listo, listo); else listo();
}
function ev3Fase(f) {
  const ant = EV3.fase; EV3.fase = f; EV3.t = 0;
  if (ant && ant !== f && typeof ev3Salir === 'function') ev3Salir(ant);
  ev3Base();
  if (f === 'intro') ev3IntroArmar();
  else if (f === 'despertar') ev3DespertarArmar();
  else if (f === 'puzles') ev3PuzlesArmar();
  else if (f === 'epilogo') { if (JUEGO.estado === 'juego' && MUNDO.nombre === EV3_MAPA) ev3EpilogoArmar(); else { EV3.siguiente = 'epilogo'; EV3.fase = 'carga'; ev3AlMapa(); } }
}
// lo común de todas las fases: de noche, primera persona, sin armas ni lo demás
function ev3Base() {
  PREFS.evento = false; DIA.ciclo = false; DIA.hora = 1.5; DIA.aplicada = -1; if (typeof diaAplicar === 'function') diaAplicar();
  JUG.tercera = false; JUG.noclip = false; JUG.vehiculo = null; if (typeof HCAM !== 'undefined') HCAM.ver = false;
  if (typeof soltarAgarre === 'function') soltarAgarre(); if (typeof soltarGrav === 'function') soltarGrav();
  ARM.lista = ['Hands']; ARM.i = 0; EV3.sinVista = true;
  if (typeof celmEnMano === 'function' && celmEnMano() && typeof celmSacar === 'function') celmSacar();
  cerrarPaneles(); if (typeof NOC !== 'undefined' && NOC.on && typeof nocheFin === 'function') nocheFin();
  if (typeof cicTerminar === 'function' && typeof CIC !== 'undefined') for (const U of [...CIC.ults.values()]) try { cicTerminar(U); } catch (e) {}
}
// todo lo que puso el evento fuera del mundo
function ev3Limpiar() {
  // (una pregunta de Pepe que quedó en el aire)
  if (typeof EV3I !== 'undefined' && EV3I.preg) { EV3I.preg = null; if (EV3.ui) EV3.ui.preg.classList.add('oc'); if (UI.abierto === 'ev3preg') UI.abierto = null; }
  for (const o of EV3.objs) if (OBJS.includes(o)) borrarObjeto(o, true);
  for (const P of EV3.pers) { if (P.npc) npcQuitar(P); else if (PERS.includes(P)) borrarPersona(P); }
  for (const b of EV3.fijas) if (typeof cajaQuitar === 'function') cajaQuitar(b);
  for (const id of EV3.mallas) mallaPropiaBorrar(id);
  EV3.objs = []; EV3.pers = []; EV3.fijas = []; EV3.mallas = []; EV3.puntos = []; EV3.carteles = []; EV3.lleva = null; EV3.mis = {};
  JUG.bloqueado = false; JUG.congelado = false; DBG.cam = null; DBG.fov = 0;
}
// el final de todo (después del epílogo)
function ev3Terminar() {
  ev3Limpiar(); EV3.fase = null; EV3.sinVista = false; vhsPrender(false); ev3AudioParar();
  document.body.classList.remove('ev3', 'ev3Quieto', 'ev3Lleva', 'ev3SinLint');
  if (EV3.ui) for (const k of ['cinta', 'nota', 'pausa', 'tecla', 'radio', 'negro']) EV3.ui[k].classList.add('oc');
}
// ---------------- cada cuadro (principal.js: antes de las armas) ----------------
function ev3Paso(dt) {
  if (!EV3.fase) return;
  if (!(EV3.fase === 'intro' && EV3I.preg)) EV3.t += dt;   // (con una pregunta de Pepe en el aire, la cinta espera)
  // (las armas no se usan: el disparo es tirar lo que se lleva en la mano)
  const disp = ENT.disparo; ENT.disparo = ENT.disparo2 = false;
  if (EV3.lleva) { if (disp && !EV3.llevaFlanco) ev3Soltar(true); }
  EV3.llevaFlanco = disp;
  ev3LlevarPaso(dt);
  if (JUG.tercera) JUG.tercera = false;
  if (EV3.fase === 'intro') ev3IntroPaso(dt);
  else if (EV3.fase === 'despertar') ev3DespertarPaso(dt);
  else if (EV3.fase === 'puzles') ev3PuzlesPaso(dt);
  else if (EV3.fase === 'final' || EV3.fase === 'screamer') ev3FinalPaso(dt);
  else if (EV3.fase === 'epilogo') ev3EpilogoPaso(dt);
  vhsTexto('AI', EV3.fase === 'cinta' || EV3.fase === 'carga' ? '' : vhsHora((performance.now() - EV3.hora0) / 1000));
  ev3AudioPaso(dt);
}
// la cámara (principal.js, camaraActualizar): la intro y el final la manejan ellos
function ev3Camara(C) {
  if (EV3.fase === 'intro') return ev3IntroCamara(C);
  if (EV3.fase === 'final' || EV3.fase === 'screamer') return typeof ev3FinalCamara === 'function' && ev3FinalCamara(C);
  return false;
}
// lo que se dibuja (principal.js, dibujar): las cajas sueltas, los carteles y lo de cada fase
function ev3Dibujar() {
  if (!EV3.fase) return;
  const cp = CAM.pos;
  for (const c of EV3.carteles) if (!c.oculto && (EV3.fase === 'intro' || Math.abs(c.c.x - cp.x) + Math.abs(c.c.z - cp.z) < (c.lejos || 55))) ev3CartelDibujar(c);
  if (EV3.fase === 'intro') ev3IntroDibujar();
  else if (EV3.fase === 'puzles' || EV3.fase === 'final' || EV3.fase === 'screamer') ev3PuzlesDibujar();
}
// las luces (efectos.js, lucesJuntar): luces especiales, en todas las calidades (van las 4 más importantes)
function ev3Luces() {
  if (!EV3.fase) return;
  if (EV3.fase === 'intro') ev3IntroLuces();
  else if (EV3.fase === 'puzles' || EV3.fase === 'final' || EV3.fase === 'screamer') ev3PuzlesLuces();
  else if (EV3.fase === 'epilogo') ev3EpilogoLuces();
}
// ---------------- los botones y las teclas: sólo lo justo ----------------
// (principal.js, atenderPulsos: devuelve true si el evento se lo queda)
function ev3Pulso(k) {
  if (!EV3.fase) return false;
  if (EV3.panel) { if (k === 'pausa' || k === 'cerrar' || k === 'usar') ev3PanelCerrar(); return true; }
  if (EV3.fase !== 'puzles') return true;   // (la cinta, la intro, el final, el epílogo: nada más que caminar)
  if (k === 'pausa') { ev3PausaAbrir(); return true; }
  if (k === 'usar') { if (EV3.fase === 'puzles') ev3Usar(); return true; }
  if (k === 'linterna') { if (!document.body.classList.contains('ev3SinLint')) linternaAlternar(); return true; }
  return true;
}
// lo que dice el cartel de «usar» (herramientas.js, herramientasPaso)
function ev3ApuntaTxt() {
  if (!EV3.fase) return null;
  if (EV3.fase !== 'puzles' || EV3.panel) return '';
  const q = ev3Apuntado(); EV3.apunta = q;
  if (EV3.lleva) return q && q.conLleva ? (typeof q.txt === 'function' ? q.txt() : q.txt) : T('ev3.soltar');
  if (q) return typeof q.txt === 'function' ? q.txt() : q.txt;
  const o = ev3Agarrable(); return o ? T('ev3.agarrar') : '';
}
// usar: un punto (papel, botón, palanca...), agarrar una caja o soltar la que se lleva
function ev3Usar() {
  const q = ev3Apuntado();
  if (EV3.lleva) { if (q && q.conLleva) q.usar(); else ev3Soltar(false); return; }
  if (q) { q.usar(); return; }
  const o = ev3Agarrable(); if (o) { ev3Agarrar(o); return; }
  sonar('UI_niega', null, 0.25);
}
// los puntos que se usan: esfera en p de radio r; el más cercano que corta la mira, a menos de 2,6 m y sin pared en el medio
function ev3Punto(p, r, txt, usar, extra) { const q = Object.assign({ p, r, txt, usar, activo: null }, extra || {}); EV3.puntos.push(q); return q; }
function ev3Apuntado() {
  const o = CAM.pos, d = CAM.fwd; let mejor = null, tm = 2.6;
  for (const q of EV3.puntos) {
    if (q.activo && !q.activo()) continue;
    const L = vsub(q.p, o), t = vdot(L, d); if (t < 0 || t > tm + q.r) continue;
    const d2 = vdot(L, L) - t * t; if (d2 > q.r * q.r) continue;
    const t0 = t - Math.sqrt(q.r * q.r - d2); if (t0 > tm) continue;
    const h = mundoRayo(o, d, Math.max(0.01, t0)); if (h && h.t < t0 - 0.05) continue;
    mejor = q; tm = Math.max(0, t0);
  }
  return mejor;
}
// ---------------- agarrar y llevar (con las manos: una caja, una batería, la llave) ----------------
function ev3Agarrable() {
  const h = raycast(CAM.pos, CAM.fwd, 2.4, null);
  const o = h && h.body && h.body.obj; return o && o.ev3Agarra && OBJS.includes(o) ? o : null;
}
function ev3Agarrar(o) {
  o.b.frozen = false; o.b.held = true; o.b.wake(); EV3.lleva = o; document.body.classList.add('ev3Lleva');
  sonar('Click', null, 0.35, 0.8);
}
function ev3Soltar(tirar) {
  const o = EV3.lleva; EV3.lleva = null; document.body.classList.remove('ev3Lleva');
  if (!o || !OBJS.includes(o)) return;
  o.b.held = false; o.b.wake(); if (tirar) { o.b.vel.addS(CAM.fwd, 7.5); o.b.vel.y += 1.5; sonar('Arm_Swing_edited', null, 0.4); }
}
function ev3LlevarPaso(dt) {
  const o = EV3.lleva; if (!o) return;
  if (!OBJS.includes(o) || !PH.bodies.includes(o.b)) { EV3.lleva = null; document.body.classList.remove('ev3Lleva'); return; }
  // (adelante de los ojos del jugador —de este cuadro: la cámara se acomoda después—)
  const ojo = vadd(JUG.pos, v3(0, JUG.agK > 0.5 ? 0.0 : 0.67, 0)), fw = Quat.euler(JUG.yaw, JUG.pitch).rot(v3(0, 0, 1));
  const b = o.b, meta = vadd(vadd(ojo, vscale(fw, 1.15 + (b.r || 0.4))), v3(0, -0.15, 0));
  // (si se traba contra algo o queda lejos, se suelta)
  if (b.pos.distTo(meta) > 3.0) { ev3Soltar(false); return; }
  b.vel.copy(vsub(meta, b.pos).scale(Math.min(1 / Math.max(dt, 1e-3), 12))); b.ang.scale(0.7); b.held = true; b.wake();
}
// ---------------- objetos, personas y choques del evento (se borran al terminar) ----------------
function ev3Prop(nombre, p, q, op) {
  const o = crearObjeto(nombre, p, q || new Quat(), { congelado: !(op && op.suelto) });
  if (!o) return null; o.ev3 = true; o.noBorrar = true; EV3.objs.push(o);
  if (op && op.piso !== undefined) { const bb = ev3Caja(o); o.b.pos.y += op.piso - bb.min.y; o.b.updateWorld && o.b.updateWorld(); }
  if (op && op.agarra) o.ev3Agarra = true;
  return o;
}
function ev3Caja(o) {
  const b = o.b, Q = puntosForma(o.F.shape), mn = v3(1e9, 1e9, 1e9), mx = v3(-1e9, -1e9, -1e9);
  for (const v of Q) { const w = vadd(b.q.rot(v), b.pos); mn.x = Math.min(mn.x, w.x); mn.y = Math.min(mn.y, w.y); mn.z = Math.min(mn.z, w.z); mx.x = Math.max(mx.x, w.x); mx.y = Math.max(mx.y, w.y); mx.z = Math.max(mx.z, w.z); }
  return { min: mn, max: mx };
}
// muchas cajas fijas en una sola malla (un solo dibujo): [centro, tamaño entero, giro]; se dibuja con ev3MallaDibujar
function ev3Malla(L) {
  const B = geoNuevo(); for (const [c, t, q] of L) geoCaja(B, c, [t[0] / 2, t[1] / 2, t[2] / 2], q || null, 1);
  const id = mallaPropia(B); EV3.mallas.push(id); return id;
}
function ev3MallaDibujar(id, mat) { if (id >= 0 && R.mallas[id]) encolar(id, 0, mat, IDM, null, null); }
function ev3Fija(c, h, q) { const b = cajaFija(c, h, q); EV3.fijas.push(b); return b; }
const ev3Piso = (x, z, y0) => pisoBajo(v3(x, y0 === undefined ? 10 : y0, z), y0 === undefined ? 40 : 3) ?? -3.66;
// ---------------- materiales y carteles (texturas dibujadas en un lienzo) ----------------
function ev3Mat(clave, c, op) { return matPropio('ev3' + clave, c, op || {}); }
const EV3_TX = { n: 0 };
// un lienzo hecho textura: dibujar(g, w, h) lo pinta; con tipo 'cut' (recortado), 'blend' (transparente) o nada (opaco).
// Devuelve { mat, cv, subir() } (subir: después de volver a pintar)
function ev3Lienzo(w, h, dibujar, tipo, sinLuz) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  const k = TX_PROPIA + 9300 + (EV3_TX.n++), L = { cv, g, k, mat: null, dibujar };
  L.subir = () => {
    const gl = R.gl; let t = R.tex[k];
    if (!t) { t = R.tex[k] = { gl: gl.createTexture() }; }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.gl); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    R.texAct = null;
  };
  L.pintar = () => { g.clearRect(0, 0, w, h); dibujar(g, w, h); L.subir(); };
  L.pintar();
  const id = matPropio('ev3tx' + k, [1, 1, 1], { pbr: [0.85, 0, 0.04] }), m = R.mats[id];
  m.tex = k; m.st = [1, 1, 0, 0];
  if (tipo === 'cut') { m.cut = true; m.claveBase = ',CUT,' + (sinLuz ? 'UNLIT' : '') + ','; m.claveGam = ',CUT' + (sinLuz ? ',UNLIT' : ','); }
  else if (tipo === 'blend') { m.blend = true; m.sombra = false; m.claveBase = 'BLEND,,' + (sinLuz ? 'UNLIT' : '') + ','; m.claveGam = 'BLEND,' + (sinLuz ? ',UNLIT' : ','); }
  if (sinLuz) m.unlit = true;
  L.mat = id; return L;
}
// el cuadrado de 1 × 1 m (de cara a +z) que llevan los carteles
function ev3Quad() {
  if (EV3.quad !== undefined && R.mallas[EV3.quad]) return EV3.quad;
  const B = geoNuevo(); geoQuad(B, v3(-0.5, -0.5, 0), v3(0.5, -0.5, 0), v3(0.5, 0.5, 0), v3(-0.5, 0.5, 0), v3(0, 0, 1), 1);
  // (las UV de geoQuad van en metros desde la esquina: en 1 × 1 ya son 0..1)
  return (EV3.quad = mallaPropia(B));
}
// un cartel: lienzo L en el centro c, de cara a n (o mirando a la cámara: n = null), de w × h metros
function ev3Cartel(L, c, n, w, h, op) { const C = Object.assign({ L, c, n, w, h, M: new Float32Array(16), oculto: false }, op || {}); EV3.carteles.push(C); return C; }
function ev3CartelDibujar(C) {
  let q;
  // (los fijos: la matriz se arma una vez; los que miran a la cámara, cada cuadro)
  if (C.n) { if (!C.listo) { q = Quat.euler(Math.atan2(C.n.x, C.n.z), -Math.asin(clamp(C.n.y, -1, 1)), C.giro || 0); m4trs([C.c.x, C.c.y, C.c.z], [q.x, q.y, q.z, q.w], [C.w, C.h, 1], C.M); C.q = q; C.listo = true; } q = C.q; }
  else { const d = vsub(CAM.pos, C.c); q = Quat.euler(Math.atan2(d.x, d.z), 0); m4trs([C.c.x, C.c.y, C.c.z], [q.x, q.y, q.z, q.w], [C.w, C.h, 1], C.M); }
  encolar(ev3Quad(), 0, C.L.mat, C.M, null, null);
  if (C.doble) { const M2 = C.M2 || (C.M2 = new Float32Array(16)); if (!C.listo2 || !C.n) { const q2 = q.clone().mul(Quat.axis(0, 1, 0, Math.PI)); m4trs([C.c.x, C.c.y, C.c.z], [q2.x, q2.y, q2.z, q2.w], [C.w, C.h, 1], M2); C.listo2 = true; } encolar(ev3Quad(), 0, C.L.mat, M2, null, null); }
}
// letra de las cosas escritas: a mano (para los papeles) y la de la cinta
const EV3_MANO = "'Segoe Print','Bradley Hand','Comic Sans MS','Chalkboard SE',cursive";
function ev3TextoLineas(g, txt, x, y, ancho, alto) {
  const pal = String(txt).split(/\s+/); let lin = '', yy = y;
  for (const p of pal) { const t = lin ? lin + ' ' + p : p; if (g.measureText(t).width > ancho && lin) { g.fillText(lin, x, yy); yy += alto; lin = p; } else lin = t; }
  if (lin) g.fillText(lin, x, yy); return yy;
}
// ---------------- la interfaz propia (la página) ----------------
function ev3Ui() {
  if (EV3.ui) return EV3.ui;
  const mk = (id, cls, html) => { const d = document.createElement('div'); d.id = id; d.className = cls; d.innerHTML = html || ''; document.body.appendChild(d); return d; };
  const U = EV3.ui = {
    cinta: mk('ev3Cinta', 'oc', '<div class="ev3Play">PLAY ▶</div><div class="ev3Num">CINTA 0300</div><div class="ev3Toca"></div>'),
    negro: mk('ev3Negro', 'oc'),
    nota: mk('ev3Nota', 'oc', '<div class="ev3Papel"><div class="ev3PapelTxt"></div></div><div class="ev3Cierra"></div>'),
    pausa: mk('ev3Pausa', 'oc', '<div class="ev3Caja"><b class="ev3Tit"></b><div class="ev3Lista"></div><div class="ev3Bts"></div></div>'),
    tecla: mk('ev3Tecla', 'oc', '<div class="ev3Caja"><div class="ev3Pant">----</div><div class="ev3Teclas"></div><div class="ev3Cierra"></div></div>'),
    preg: mk('ev3Preg', 'oc', '<div class="ev3PregTxt"></div><div class="ev3PregOps"></div>'),
    radio: mk('ev3Radio', 'oc', '<div class="ev3Caja"><div class="ev3Dial"><b class="ev3Frec">88.0</b><small>FM</small></div><input type="range" min="880" max="1080" step="1" value="880" class="ev3Perilla"><div class="ev3Cierra"></div></div>'),
  };
  U.cinta.querySelector('.ev3Toca').textContent = T('ev3.toca');
  for (const k of ['nota', 'tecla', 'radio']) U[k].querySelector('.ev3Cierra').textContent = T('ev3.cerrar');
  U.nota.addEventListener('click', () => ev3PanelCerrar());
  for (const k of ['tecla', 'radio']) U[k].querySelector('.ev3Cierra').addEventListener('click', () => ev3PanelCerrar());
  return U;
}
// los paneles (un papel, el teclado, la radio, la pausa): el juego queda quieto detrás
function ev3PanelAbrir(nom) {
  ev3PanelCerrar(); EV3.panel = nom; EV3.ui[nom].classList.remove('oc'); UI.abierto = 'ev3' + nom; soltarPuntero();
}
function ev3PanelCerrar() {
  if (!EV3.panel) return; const p = EV3.panel; EV3.panel = null; EV3.ui[p].classList.add('oc'); if (UI.abierto === 'ev3' + p) UI.abierto = null;
  if (p === 'radio' && typeof ev3RadioCerrar === 'function') ev3RadioCerrar();
}
// un papel: el texto entero, en grande
function ev3NotaAbrir(txt) {
  ev3Ui(); EV3.ui.nota.querySelector('.ev3PapelTxt').textContent = txt; ev3PanelAbrir('nota'); sonar('Click', null, 0.3, 1.3);
}
// la pausa: seguir, reiniciar la misión de donde estás, la lista de sellos (y saltear una que se trabó 3 veces)
function ev3PausaAbrir() {
  const U = ev3Ui(), m = typeof ev3MisCerca === 'function' ? ev3MisCerca() : null;
  U.pausa.querySelector('.ev3Tit').textContent = T('ev3.pausa') + '  ·  ' + T('ev3.sellos') + ' ' + EV3.est.hechas.length + '/10';
  const L = U.pausa.querySelector('.ev3Lista'); L.innerHTML = '';
  for (const M of EV3_MIS) { const d = document.createElement('div'); const ok = EV3.est.hechas.includes(M.id); d.className = ok ? 'ok' : ''; d.textContent = (ok ? '■ ' : '□ ') + T('ev3.m.' + M.id) + (ok ? '' : '  —  ' + T('ev3.d.' + M.id)); L.appendChild(d); }
  const B = U.pausa.querySelector('.ev3Bts'); B.innerHTML = '';
  const bt = (txt, fn) => { const b = document.createElement('button'); b.textContent = txt; b.onclick = (e) => { e.stopPropagation(); fn(); }; B.appendChild(b); };
  bt(T('ev3.seguir'), () => ev3PanelCerrar());
  if (m && !EV3.est.hechas.includes(m.id)) {
    bt(T('ev3.reiniciar') + ': ' + T('ev3.m.' + m.id), () => { ev3PanelCerrar(); ev3MisReiniciar(m, true); });
    if ((EV3.est.reinicios[m.id] || 0) >= 3) bt(T('ev3.saltar'), () => { ev3PanelCerrar(); ev3MisHecha(m, true); });
  }
  ev3PanelAbrir('pausa');
}
// un mensaje en el medio de la cinta (letra VCR), unos segundos
function ev3Msj(txt, seg) { vhsTexto('C', txt); EV3.msjT = seg || 3.5; }
// ---------------- el sonido del evento ----------------
// (las voces de Pepe vienen en ev300_son.js, en MP3; lo demás —la estática, el latido, el zumbido, los tonos— se hace acá)
function ev3AudioPreparar() {
  const c = AUD.ctx; if (!c || EV3.aud.bus) return;
  const A = EV3.aud; A.bus = c.createGain(); A.bus.gain.value = PREFS.vol / 100; A.bus.connect(c.destination);
  A.agua = c.createBiquadFilter(); A.agua.type = 'lowpass'; A.agua.frequency.value = 22000; A.agua.Q.value = 0.8;
  A.sfx = c.createGain(); A.sfx.connect(A.agua); A.agua.connect(A.bus);
  // (las voces: en paralelo, decodificadas una vez)
  if (typeof EV3_VOZ !== 'undefined' && !A.decod) {
    A.decod = Promise.all(Object.entries(EV3_VOZ.mp3).map(([k, b64]) => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new Promise((ok) => { try { c.decodeAudioData(u.buffer, (b) => { A.buf[k] = b; ok(); }, () => ok()); } catch (e) { ok(); } });
    }));
  }
}
function ev3AudioParar() { const A = EV3.aud; for (const k of Object.keys(A.bucles)) ev3BucleParar(k); ev3Agua(0); }
// una voz de Pepe (o sea el robot): por la voz, sin el filtro de agua
function ev3Voz(k, vol, tono) {
  const A = EV3.aud, b = A.buf[k]; if (!A.bus || !b) return null;
  const s = AUD.ctx.createBufferSource(), g = AUD.ctx.createGain(); s.buffer = b; s.playbackRate.value = tono || 1; g.gain.value = vol === undefined ? 1 : vol;
  s.connect(g); g.connect(A.bus); s.start(); return s;
}
// bajo el agua (los recuerdos): el sonido del juego y los efectos apagados, como oídos desde adentro de una pileta
function ev3Agua(k) {
  const A = EV3.aud; if (!A.agua || !AUD.ctx) return; const t = AUD.ctx.currentTime;
  A.agua.frequency.setTargetAtTime(k > 0 ? 420 : 22000, t, 0.06);
  if (k > 0 && !A.enAgua) { A.enAgua = true; try { AUD.master.disconnect(); AUD.master.connect(A.agua); } catch (e) {} }
  else if (!(k > 0) && A.enAgua) { A.enAgua = false; try { AUD.master.disconnect(); AUD.master.connect(AUD.ctx.destination); } catch (e) {} }
}
// ruido blanco (para la estática, la cinta, el viento, los golpes del screamer)
function ev3Ruido() {
  const c = AUD.ctx; if (EV3.aud.ruido) return EV3.aud.ruido;
  const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return (EV3.aud.ruido = b);
}
// un sonido en bucle hecho acá: tipo 'cinta' (siseo), 'zumbido' (fluorescente), 'grave' (el ambiente), 'estatica' (la radio)
function ev3Bucle(k, tipo, vol) {
  const c = AUD.ctx, A = EV3.aud; if (!c || !A.bus) return null;
  let B = A.bucles[k];
  if (!B) {
    const g = c.createGain(); g.gain.value = 0; g.connect(A.sfx); const nodos = [];
    if (tipo === 'cinta' || tipo === 'estatica') {
      const s = c.createBufferSource(); s.buffer = ev3Ruido(); s.loop = true; const f = c.createBiquadFilter(); f.type = tipo === 'cinta' ? 'highpass' : 'bandpass'; f.frequency.value = tipo === 'cinta' ? 3800 : 1800; f.Q.value = tipo === 'cinta' ? 0.4 : 0.6;
      s.connect(f); f.connect(g); s.start(); nodos.push(s);
    } else if (tipo === 'zumbido') {
      for (const [fr, v] of [[100, 0.6], [200, 0.25], [300, 0.12]]) { const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.value = fr; og.gain.value = v * 0.08; o.connect(og); og.connect(g); o.start(); nodos.push(o); }
    } else if (tipo === 'grave') {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.connect(g);
      for (const fr of [41, 41.7, 55.3]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const og = c.createGain(); og.gain.value = 0.22; o.connect(og); og.connect(f); o.start(); nodos.push(o); }
    }
    B = A.bucles[k] = { g, nodos };
  }
  B.g.gain.setTargetAtTime(vol, c.currentTime, 0.08); return B;
}
function ev3BucleParar(k) { const A = EV3.aud, B = A.bucles[k]; if (!B) return; delete A.bucles[k]; try { B.g.gain.setTargetAtTime(0, AUD.ctx.currentTime, 0.05); } catch (e) {} setTimeout(() => { for (const n of B.nodos) try { n.stop(); } catch (e) {} try { B.g.disconnect(); } catch (e) {} }, 400); }
// sonidos cortos hechos acá: 'latido', 'tono' (frecuencia), 'mal', 'bien', 'golpe' (el del screamer y el de la entidad), 'chirrido' (puerta)
function ev3Son(tipo, a, vol) {
  const c = AUD.ctx, A = EV3.aud; if (!c || !A.bus) return; const t = c.currentTime, v = vol === undefined ? 1 : vol;
  const env = (g, at, pico, dur) => { g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(pico, t + at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur); };
  const osc = (tipoO, f0, f1, at, dur, pico, dest) => { const o = c.createOscillator(), g = c.createGain(); o.type = tipoO; o.frequency.setValueAtTime(f0, t + at); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + at + dur); env(g, at, pico, dur); o.connect(g); g.connect(dest || A.sfx); o.start(t + at); o.stop(t + at + dur + 0.05); };
  const ruido = (at, dur, pico, fr, q, dest) => { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = ev3Ruido(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = q || 1; env(g, at, pico, dur); s.connect(f); f.connect(g); g.connect(dest || A.sfx); s.start(t + at, Math.random()); s.stop(t + at + dur + 0.05); };
  if (tipo === 'latido') { osc('sine', 62, 40, 0, 0.16, 0.9 * v); osc('sine', 58, 38, 0.24, 0.14, 0.6 * v); }
  else if (tipo === 'tono') osc('square', a || 660, 0, 0, 0.22, 0.12 * v);
  else if (tipo === 'bien') { osc('triangle', 523, 0, 0, 0.12, 0.25 * v); osc('triangle', 784, 0, 0.1, 0.25, 0.25 * v); }
  else if (tipo === 'mal') { osc('sawtooth', 140, 90, 0, 0.45, 0.25 * v); }
  else if (tipo === 'sello') { osc('triangle', 196, 0, 0, 0.9, 0.3 * v); osc('sine', 98, 0, 0, 1.4, 0.4 * v); ruido(0, 0.25, 0.3 * v, 4200, 2); }
  else if (tipo === 'golpe') { osc('sine', 90, 30, 0, 0.5, 1.4 * v); ruido(0, 0.35, 1.1 * v, 900, 0.7); ruido(0, 0.08, 0.8 * v, 3000, 0.5); }
  else if (tipo === 'chirrido') { const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(380, t); o.frequency.linearRampToValueAtTime(260, t + 0.6); o.frequency.linearRampToValueAtTime(420, t + 1.1); o.frequency.linearRampToValueAtTime(300, t + 1.6); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 6; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * v, t + 0.1); g.gain.setValueAtTime(0.18 * v, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); o.connect(f); f.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + 1.9); }
  else if (tipo === 'grito') {
    // (el screamer: un chirrido que sube, ruido rasgado y la voz de Pepe deformada encima, saturado)
    const sat = c.createWaveShaper(), cu = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cu[i] = Math.tanh(x * 6); } sat.curve = cu; const gs = c.createGain(); gs.gain.value = 0.9 * v; sat.connect(gs); gs.connect(A.bus);
    for (const [f0, f1] of [[220, 880], [233, 940], [330, 1320]]) osc('sawtooth', f0, f1, 0, 1.3, 0.5, sat);
    ruido(0, 1.4, 1.0, 1500, 0.4, sat); ruido(0, 0.4, 1.0, 300, 0.6, sat);
  } else if (tipo === 'cadena') { for (let i = 0; i < 6; i++) ruido(i * 0.07 + Math.random() * 0.03, 0.06, 0.35 * v, 3500 + Math.random() * 2500, 4); }
  else if (tipo === 'electrico') { ruido(0, 0.5, 0.4 * v, 2500, 0.5); osc('sawtooth', 120, 60, 0, 0.5, 0.15 * v); }
  else if (tipo === 'campana') { for (const [f, d] of [[392, 2.2], [784, 1.4], [1176, 0.9]]) osc('sine', f, 0, 0, d, 0.25 * v); }
}
function ev3AudioPaso(dt) {
  if (EV3.msjT > 0 && (EV3.msjT -= dt) <= 0) vhsTexto('C', '');
}
// ---------------- los textos (es, en, pt; los demás idiomas, en inglés) ----------------
Object.assign(IDI3, {
  'ev3.toca': ['Tocá la pantalla para reproducir la cinta', 'Tap the screen to play the tape', 'Toque a tela para reproduzir a fita'],
  'ev3.cerrar': ['Tocá para cerrar', 'Tap to close', 'Toque para fechar'],
  'ev3.soltar': ['E: soltar · disparo: tirar', 'E: drop · fire: throw', 'E: soltar · tiro: jogar'],
  'ev3.agarrar': ['E: agarrar', 'E: pick up', 'E: pegar'],
  'ev3.leer': ['E: leer', 'E: read', 'E: ler'],
  'ev3.pausa': ['PAUSA', 'PAUSE', 'PAUSA'],
  'ev3.sellos': ['SELLOS', 'SEALS', 'SELOS'],
  'ev3.seguir': ['Seguir', 'Continue', 'Continuar'],
  'ev3.reiniciar': ['Reiniciar', 'Restart', 'Reiniciar'],
  'ev3.saltar': ['Saltear esta misión', 'Skip this mission', 'Pular esta missão'],
  'ev3.sello': ['SELLO', 'SEAL', 'SELO'],
  'ev3.abierto': ['EL 1.047\nESTÁ ABIERTO', 'THE 1.047\nIS OPEN', 'O 1.047\nESTÁ ABERTO'],
  'ev3.objetivo': ['ABRÍ EL 1.047\nENCONTRÁ LOS 10 SELLOS', 'OPEN THE 1.047\nFIND THE 10 SEALS', 'ABRA O 1.047\nENCONTRE OS 10 SELOS'],
  'ev3.echado': ['NO.', 'NO.', 'NÃO.'],
  'ev3.perdon': ['E: pedir perdón', 'E: say sorry', 'E: pedir desculpas'],
  'ev3.perdonDijo': ['Perdón, Pepe.', 'Sorry, Pepe.', 'Desculpa, Pepe.'],
  'ev3.volvera': ['ÉL VOLVERÁ', 'HE WILL RETURN', 'ELE VOLTARÁ'],
  'ev3.fusPoner': ['E: poner la batería', 'E: insert the battery', 'E: colocar a bateria'],
  'ev3.teclado': ['E: escribir el código', 'E: enter the code', 'E: digitar o código'],
  'ev3.radio': ['E: prender la radio', 'E: turn on the radio', 'E: ligar o rádio'],
  'ev3.simonEsc': ['E: escuchar la secuencia', 'E: listen to the sequence', 'E: ouvir a sequência'],
  'ev3.simonBt': ['E: botón', 'E: button', 'E: botão'],
  'ev3.palanca': ['E: mover la palanca', 'E: pull the lever', 'E: mover a alavanca'],
  'ev3.selloTomar': ['E: tomar el sello', 'E: take the seal', 'E: pegar o selo'],
  'ev3.llaveTomar': ['E: agarrar la llave', 'E: take the key', 'E: pegar a chave'],
  'ev3.campana': ['E: tocar la campana', 'E: ring the bell', 'E: tocar o sino'],
  'ev3.tocar': ['E: tocar', 'E: touch', 'E: tocar'],
  'ev3.o.admin': ['la computadora (ADMIN)', 'the computer (ADMIN)', 'o computador (ADMIN)'],
  'ev3.o.13': ['el cartel del 13', 'the 13 sign', 'a placa do 13'],
  'ev3.o.pared': ['la pared', 'the wall', 'a parede'],
  // el interrogatorio (ev300_intro.js): lo que pregunta Pepe, las respuestas y lo que contesta
  'ev3.q.p1': ['¿Te acordás cuántas veces me mataste?', 'Do you remember how many times you killed me?', 'Você lembra quantas vezes me matou?'],
  'ev3.q.p2': ['¿Sabés dónde estás?', 'Do you know where you are?', 'Você sabe onde está?'],
  'ev3.q.p3': ['¿Te divertías?', 'Were you having fun?', 'Você se divertia?'],
  'ev3.q.p4': ['¿Cuál te gustó más?', 'Which one did you like best?', 'Qual você gostou mais?'],
  'ev3.q.p5': ['¿Me vas a pedir perdón?', 'Are you going to say sorry?', 'Você vai me pedir perdão?'],
  'ev3.q.nose': ['No sé', "I don't know", 'Não sei'],
  'ev3.q.ninguna': ['Ninguna', 'None', 'Nenhuma'],
  'ev3.q.si': ['Sí', 'Yes', 'Sim'],
  'ev3.q.no': ['No', 'No', 'Não'],
  'ev3.r.rExacto': ['Exacto. Cada una.', 'Exactly. Every single one.', 'Exato. Cada uma.'],
  'ev3.r.rMeAcuerdo': ['Yo sí me acuerdo. De todas.', 'I do remember. Every one.', 'Eu lembro. De todas.'],
  'ev3.r.rMentiroso': ['Mentiroso.', 'Liar.', 'Mentiroso.'],
  'ev3.r.rSincero': ['Por lo menos sos sincero.', 'At least you are honest.', 'Pelo menos você é sincero.'],
  'ev3.r.rCinta': ['Estás adentro de la cinta. Igual que yo.', 'You are inside the tape. Just like me.', 'Você está dentro da fita. Igual a mim.'],
  'ev3.r.rTodavia': ['Todavía no. Primero vas a jugar.', 'Not yet. First you are going to play.', 'Ainda não. Primeiro você vai jogar.'],
  'ev3.r.rYaLoVas': ['Ya lo vas a hacer.', 'You will.', 'Você vai.'],
  'ev3.r.rTodas': ['A mí me dolieron todas.', 'They all hurt me.', 'Todas doeram em mim.'],
  'ev3.r.rSilencio': ['¿No me vas a contestar?', "You're not going to answer me?", 'Não vai me responder?'],
  'ev3.o.sedan': ['el auto', 'the car', 'o carro'],
  'ev3.o.heladera': ['la heladera', 'the fridge', 'a geladeira'],
  'ev3.o.barril': ['el barril', 'the barrel', 'o barril'],
  'ev3.ord0': ['primer', 'first', 'primeiro'], 'ev3.ord1': ['segundo', 'second', 'segundo'], 'ev3.ord2': ['tercer', 'third', 'terceiro'], 'ev3.ord3': ['cuarto', 'fourth', 'quarto'],
  'ev3.m.cajas': ['Las cajas', 'The boxes', 'As caixas'], 'ev3.m.fusibles': ['Los fusibles', 'The fuses', 'Os fusíveis'], 'ev3.m.codigo': ['El código', 'The code', 'O código'],
  'ev3.m.radio': ['La radio', 'The radio', 'O rádio'], 'ev3.m.simon': ['Las luces', 'The lights', 'As luzes'], 'ev3.m.palancas': ['Las palancas', 'The levers', 'As alavancas'],
  'ev3.m.sigilo': ['Lo que camina', 'What walks', 'O que anda'], 'ev3.m.llave': ['La llave', 'The key', 'A chave'], 'ev3.m.torre': ['La campana', 'The bell', 'O sino'], 'ev3.m.orden': ['El registro', 'The record', 'O registro'],
  'ev3.d.cajas': ['el cuadrado rojo en la cancha', 'the red square on the field', 'o quadrado vermelho no campo'],
  'ev3.d.fusibles': ['en la pared, al lado de la puerta del 1.047', 'on the wall next to the 1.047 door', 'na parede, ao lado da porta do 1.047'],
  'ev3.d.codigo': ['mirando el 1.047, la puerta suelta a la izquierda, lejos', 'facing the 1.047, the lone door far to the left', 'olhando o 1.047, a porta solta longe à esquerda'],
  'ev3.d.radio': ['la mesa del otro lado de la cancha, cerca de la pared', 'the table across the field, by the wall', 'a mesa do outro lado do campo, perto da parede'],
  'ev3.d.simon': ['la mesa en el medio de la cancha', 'the table in the middle of the field', 'a mesa no meio do campo'],
  'ev3.d.palancas': ['mirando el 1.047, a la izquierda, en la pared', 'facing the 1.047, on the wall to the left', 'olhando o 1.047, na parede à esquerda'],
  'ev3.d.sigilo': ['adentro del salón, a la derecha del 1.047', 'inside the hall, to the right of the 1.047', 'dentro do salão, à direita do 1.047'],
  'ev3.d.llave': ['el fondo de la pileta', 'the bottom of the pool', 'o fundo da piscina'],
  'ev3.d.torre': ['las tablas contra el edificio, a la derecha', 'the planks against the building, to the right', 'as tábuas junto ao prédio, à direita'],
  'ev3.d.orden': ['la otra punta de la cancha, cerca de la pileta', 'the far end of the field, by the pool', 'o outro lado do campo, perto da piscina'],
  'ev3.p.inicio': ['Si leés esto, ya te agarraron.\n\nDiez sellos cierran la puerta del 1.047. Están por todo el mapa: cajas, luces, palancas, una radio, una campana... Cada misión abre uno.\n\nCon usar (E) agarrás, leés y tocás. La linterna es la L o su botón. En la pausa está la lista de lo que falta.\n\nNo intentes entrar por otro lado.',
    'If you are reading this, they already got you.\n\nTen seals lock the 1.047 door. They are all over the map: boxes, lights, levers, a radio, a bell... Each mission opens one.\n\nUse (E) to pick up, read and touch. The flashlight is L or its button. The pause menu lists what is left.\n\nDo not try to get in any other way.',
    'Se você está lendo isto, já te pegaram.\n\nDez selos trancam a porta do 1.047. Estão por todo o mapa: caixas, luzes, alavancas, um rádio, um sino... Cada missão abre um.\n\nCom usar (E) você pega, lê e toca. A lanterna é o L ou o botão dela. Na pausa está a lista do que falta.\n\nNão tente entrar por outro lado.'],
  'ev3.p.registro': ['REGISTRO DE MUERTES — PEPE\n\n0.101   ADMIN\n0.388   13 PISOS\n0.612   PARED\n1.045   SEDÁN\n1.046   HELADERA\n1.047   BARRIL\n\nEstán todas juntas en la otra punta de la cancha. Tocalas en este orden.',
    'DEATH RECORD — PEPE\n\n0.101   ADMIN\n0.388   13 FLOORS\n0.612   WALL\n1.045   SEDAN\n1.046   FRIDGE\n1.047   BARREL\n\nThey are all together at the far end of the field. Touch them in this order.',
    'REGISTRO DE MORTES — PEPE\n\n0.101   ADMIN\n0.388   13 ANDARES\n0.612   PAREDE\n1.045   SEDÃ\n1.046   GELADEIRA\n1.047   BARRIL\n\nEstão todas juntas no outro lado do campo. Toque nelas nesta ordem.'],
  'ev3.p.cajas': ['Juntá las 10 cajas marcadas (las de la lucecita roja) adentro del cuadrado rojo.\n\nAlgunas no están a mano: arriba de otras, en el agua, en el techo, detrás de un alambrado, arriba del auto...\n\nCon usar las agarrás; con el disparo las tirás.',
    'Gather the 10 marked boxes (the ones with the little red light) inside the red square.\n\nSome are not easy to reach: on top of others, in the water, on the roof, behind a fence, on top of the car...\n\nUse picks them up; fire throws them.',
    'Junte as 10 caixas marcadas (as da luzinha vermelha) dentro do quadrado vermelho.\n\nAlgumas não estão à mão: em cima de outras, na água, no telhado, atrás de um alambrado, em cima do carro...\n\nCom usar você pega; com o tiro você joga.'],
  'ev3.p.cajasSalta': ['La de arriba se alcanza saltando de caja en caja.', 'The one on top is reached by jumping from box to box.', 'A de cima se alcança pulando de caixa em caixa.'],
  'ev3.p.cajasFlota': ['Las de cartón flotan. Nadá hasta ella y traela.', 'Cardboard floats. Swim to it and bring it back.', 'As de papelão flutuam. Nade até ela e traga.'],
  'ev3.p.cajasAgacha': ['El alambrado de ese lado está levantado: agachate (Ctrl o ▼) y pasá por abajo.', 'The fence on that side is raised: crouch (Ctrl or ▼) and go under it.', 'O alambrado daquele lado está levantado: agache (Ctrl ou ▼) e passe por baixo.'],
  'ev3.p.fusibles': ['Se cortó la luz. Faltan tres baterías en esta caja.\n\nUna está arriba de una mesa en la cancha. Otra, arriba, en la vereda alta del costado. La última, en una esquina de la pileta, del lado de las tribunas.',
    'The power is out. This box is missing three batteries.\n\nOne is on top of a table on the field. Another is up on the high sidewalk on the side. The last one is in a corner of the pool, by the bleachers.',
    'A luz acabou. Faltam três baterias nesta caixa.\n\nUma está em cima de uma mesa no campo. Outra, em cima, na calçada alta do lado. A última, num canto da piscina, do lado das arquibancadas.'],
  'ev3.p.codigo': ['Cuatro números abren esta puerta.\n\nCada uno está escrito en un papel, en algún lugar del mapa.', 'Four numbers open this door.\n\nEach one is written on a piece of paper somewhere on the map.', 'Quatro números abrem esta porta.\n\nCada um está escrito num papel, em algum lugar do mapa.'],
  'ev3.p.num': ['El {o} número es: {n}', 'The {o} number is: {n}', 'O {o} número é: {n}'],
  'ev3.p.radio': ['Pepe murió 1.047 veces.\n\nEsta radio sólo agarra la décima parte. Mové la perilla hasta escucharlo.', 'Pepe died 1,047 times.\n\nThis radio only picks up a tenth of that. Turn the dial until you hear him.', 'Pepe morreu 1.047 vezes.\n\nEste rádio só pega a décima parte. Gire o botão até ouvir ele.'],
  'ev3.p.simon': ['Tocá la luz de arriba para escuchar la secuencia. Repetila con los botones.\n\nTres veces. Cada vez es más larga.', 'Touch the top light to hear the sequence. Repeat it with the buttons.\n\nThree times. Each one is longer.', 'Toque a luz de cima para ouvir a sequência. Repita com os botões.\n\nTrês vezes. Cada uma é mais longa.'],
  'ev3.p.palancas': ['Cómo van las palancas está escrito adentro del salón, en la oscuridad.\n\nSólo se ve con la linterna.', 'How the levers go is written inside the hall, in the dark.\n\nOnly the flashlight shows it.', 'Como as alavancas ficam está escrito dentro do salão, no escuro.\n\nSó a lanterna mostra.'],
  'ev3.p.sigilo': ['Hay algo caminando ahí adentro. Si te ve, te saca.\n\nNo lo alumbres: con la luz te ve de más lejos. El sello está al fondo.', 'Something is walking in there. If it sees you, it throws you out.\n\nDo not light it up: with the light it sees you from farther away. The seal is at the back.', 'Tem algo andando aí dentro. Se te vir, te expulsa.\n\nNão ilumine: com a luz ele te vê de mais longe. O selo está no fundo.'],
  'ev3.p.llave': ['Se me cayó la llave en la pileta. Brilla.\n\nPara bajar nadando, agachate.', 'I dropped the key in the pool. It glows.\n\nTo swim down, crouch.', 'Deixei cair a chave na piscina. Ela brilha.\n\nPara descer nadando, agache.'],
  'ev3.p.torre': ['Arriba del techo hay una campana.\n\nSaltá de tabla en tabla. No mires abajo.', 'There is a bell on the roof.\n\nJump from plank to plank. Do not look down.', 'Em cima do telhado tem um sino.\n\nPule de tábua em tábua. Não olhe para baixo.'],
});
