// Tres bugs del Discord, medidos (en el celular: pantalla táctil de 873×393 a 2x):
//  1. «si activás la freecam, después equipás el bazooka y disparás, no dispara desde tu personaje, sino desde la freecam».
//     Con la cámara libre (modo L) a ~25 m del personaje y mirando para otro lado, cada arma: el cohete (RPG), la bala
//     (Pistol), la flecha (Crossbow), el rayo y lo que agarra la Physics Gun, el empujón de la Gravity Gun, el golpe de la
//     palanca y el rayo de la Tool Gun salen a ≤ 0,6 m de los ojos o de la mano del personaje (y lejos de la cámara) y van
//     adonde apunta él (lo que toca el rayo de sus ojos), no adonde mira la cámara. Además: en primera persona el cohete sale
//     igual que antes (0,8 m adelante de los ojos, sobre la mira), en tercera persona ya no sale de atrás de la cabeza, y
//     con la cámara libre en modo R o mirando por la cámara de la Tool Gun la bala sale del personaje.
//  2. La linterna atraviesa las cosas (una columna del mapa, en un BSP, en primera persona en el celu). Se busca solo un
//     borde de algo del mapa (cerca a la derecha, pared lejos a la izquierda: detrás del borde queda una franja que el ojo
//     ve y la linterna, corrida 17 cm, no) y se apunta ahí; con la linterna prendida y apagada (el mismo instante) y rayos de
//     la CPU, cada punto de la pantalla dentro del cono queda «iluminado» (la linterna lo ve) o «tapado» (algo del mapa en el
//     medio). Lo que la linterna suma en lo tapado, contra lo iluminado a la misma distancia. En un mapa BSP del Workshop
//     (gm_hotel) y en uno propio (gm_construct): en Medio, Alto y Ultra (con mapa de sombra) lo tapado queda oscuro (en Alto
//     y Ultra se mide también sin el bloom: el resplandor de la mancha casi blanca tiñe la franja, pero no es luz que pasa);
//     en Bajo y Patata (sin mapa de sombra) no queda nada visible que la linterna no alcance iluminado (antes, 195–338
//     puntos de la franja iluminados como la pared de al lado).
//  3. «que brillen las partes celestes de la physics gun»: la Physics Gun en la mano, con la luz del mapa muy oscura y con
//     luz naranja fuerte. Los puntos celestes del arma (los de la textura, vistos con DBG.verTex) quedan celestes (tono
//     165°–200°, saturación ≥ 0,35) y claros (brillo ≥ 110) en Bajo, Medio y Alto; en Alto hacen resplandor alrededor.
// uso: node ev5_arreglos.mjs URL_HTML [URL_CARPETA_GMA] [ID_MAPA_BSP] [CARPETA_FOTOS]   (SOLO=1, 2 o 3: sólo esas partes)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP = 'http://127.0.0.1:8976/gma', ID = '740628279', DIR = ''] = process.argv;
if (DIR) fs.mkdirSync(DIR, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML + '?test', true);
const foto = async (nom) => { if (DIR) await p.screenshot({ path: `${DIR}/${nom}.png` }); };
// ayudas en la página: cuadros a mano en un instante fijo (con y sin algo) y la lectura de la imagen. Todos los cuadros con la
// misma hora T0: el primero llega hasta ahí y los demás tienen dt 0, así dos fotos con el mismo T0 son el mismo instante
// (con horas que avanzan, cada foto corría el juego ~0,1 s y el arma en la mano ya estaba en otra pose)
await ev(`(() => { window.__e5 = {
  foto(T0) {
    const raf0 = window.requestAnimationFrame; window.requestAnimationFrame = () => 0;
    try {
      for (let i = 0; i < 4; i++) cuadro(T0);
      const gl = R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const L = R.espShL || R.esp.find((l) => l.d) || null;
      return { w, h, px, vp: Float32Array.from(R.vpMundo), cam: R.camPos.clone(), L: L ? { p: L.p.clone(), d: L.d.clone().norm(), k: L.k, r: L.r } : null };
    } finally { window.requestAnimationFrame = raf0; }
  },
  Y(F, q) { return 0.2126 * F.px[q * 4] + 0.7152 * F.px[q * 4 + 1] + 0.0722 * F.px[q * 4 + 2]; },
  // cada punto de una grilla (cada paso px) dentro del cono: 1 = la linterna lo ve, 0 = algo lo tapa (a ≥ 0,3 m), 2 = dudoso
  clasificar(F, paso) {
    const { w, h, vp, cam, L } = F, IV = M4.inv(vp), nx = Math.floor(w / paso), ny = Math.floor(h / paso), C = new Int8Array(nx * ny).fill(-1), D = new Float32Array(nx * ny);
    const un = (x, y, z) => { const X = IV[0] * x + IV[4] * y + IV[8] * z + IV[12], Yy = IV[1] * x + IV[5] * y + IV[9] * z + IV[13], Z = IV[2] * x + IV[6] * y + IV[10] * z + IV[14], W = IV[3] * x + IV[7] * y + IV[11] * z + IV[15]; return v3(X / W, Yy / W, Z / W); };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = i * paso + paso / 2, y = j * paso + paso / 2, a = un(2 * x / w - 1, 2 * y / h - 1, -1), bb = un(2 * x / w - 1, 2 * y / h - 1, 1), d = vsub(bb, a).norm();
      const hc = raycast(cam, d, 80, null); if (!hc) continue;
      const v = vsub(hc.p, L.p), dist = v.len(); if (dist > L.r * 0.85 || dist < 0.5) continue;
      const dl = vscale(v, 1 / dist); if (vdot(dl, L.d) < L.k + 0.03) continue;   // (dentro del cono; el borde se desvanece de k a k + 0,08)
      if (vdot(hc.n, dl) > -0.3) continue;   // (la superficie mira a la linterna)
      const k = j * nx + i, hl = raycast(L.p, dl, dist - 0.06, null); D[k] = dist;
      C[k] = !hl ? 1 : hl.t < dist - 0.3 ? 0 : 2;
    }
    return { nx, ny, C, D, paso };
  },
  // lo que suma la linterna (prendida − apagada) en los puntos firmes (sus 8 vecinos de la misma clase)
  fuga(K, A, B) {
    const { nx, ny, C, D, paso } = K, w = A.w, tap = [], luz = [], lej = []; let dmin = 1e9;
    const firme = (i, j) => { const c = C[j * nx + i]; if (c !== 0 && c !== 1) return false; for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) { const ii = i + x, jj = j + y; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || C[jj * nx + ii] !== c) return false; } return true; };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (firme(i, j) && C[j * nx + i] === 0) dmin = Math.min(dmin, D[j * nx + i]);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!firme(i, j)) continue; const k = j * nx + i, q = (j * paso + (paso >> 1)) * w + i * paso + (paso >> 1), s = this.Y(A, q) - this.Y(B, q);
      if (C[k] === 0) tap.push(s); else { luz.push(s); if (D[k] >= dmin - 0.5) lej.push(s); }
    }
    const med = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null), mT = med(tap), mL = med(luz), mJ = med(lej);
    return { tapados: tap.length, iluminados: luz.length, sumaTapado: mT === null ? null : +mT.toFixed(1), sumaLuz: mL === null ? null : +mL.toFixed(1), sumaLuzLejos: mJ === null ? null : +mJ.toFixed(1), fuga: mT !== null && mJ ? +(mT / mJ).toFixed(3) : null, tapadosConLuz: tap.filter((s) => mL && s > 0.25 * mL).length };
  },
}; window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 40000 ? ok() : setTimeout(f, 30)); f(); }); return 1; })()`);

// (SOLO=1, 2 o 3 —o varias, «13»— corre sólo esas partes; sin nada, todas)
const SOLO = process.env.SOLO || '123';
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.res = 70; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500); await ev(`cerrarPaneles && cerrarPaneles(); 1`);
if (SOLO.includes('1')) {
// ======================= 1. armas con la cámara libre =======================
// lo que se mide en cada tiro: ojos, mano, cámara, adónde apunta el personaje (lo que toca el rayo de sus ojos)
await ev(`(() => {
  window.__e5.mano = () => { const P = JUG.cuerpo, hi = P && P.D && P.D.h && P.D.h.RightHand, W = hi !== undefined && P.md && P.md.W && P.md.W[hi]; return W ? v3(W[12], W[13], W[14]) : null; };
  window.__e5.mira = () => { const f = Quat.euler(JUG.yaw, JUG.pitch).rot(v3(0, 0, 1)), h = raycast(JUG.ojoPos, f, 400, null); return { f, P: h ? h.p : vadd(JUG.ojoPos, vscale(f, 400)), t: h ? h.t : 400 }; };
  window.__e5.cerca = (q) => { const o = JUG.ojoPos.distTo(q), m = window.__e5.mano(), dm = m ? m.distTo(q) : 99; return { ojo: +o.toFixed(2), mano: +dm.toFixed(2), cam: +CAM.pos.distTo(q).toFixed(2), min: +Math.min(o, dm).toFixed(2) }; };
  window.__e5.trazas = []; const t0 = efectoTraza; efectoTraza = (a, b) => { window.__e5.trazas.push([a.clone(), b.clone()]); return t0(a, b); };
  window.__e5.exp = []; const x0 = explosion; explosion = function (pp, r, d) { window.__e5.exp.push(pp.clone()); return x0.apply(this, arguments); }; for (const k of ['remota', 'sinFx', 'fuente']) explosion[k] = x0[k];
  window.__e5.caja = (dist, alto) => { if (window.__e5.c && OBJS.includes(window.__e5.c)) borrarObjeto(window.__e5.c); const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), q = vadd(JUG.pos, vscale(f, dist)); q.y = JUG.pos.y - JUG.medio + (alto || 0.6); const o = crearObjeto('CajaMadera', q, Quat.euler(JUG.yaw, 0), { congelado: !!alto }); window.__e5.c = o; return o ? 1 : 0; };
  window.__e5.apuntar = () => { const c = window.__e5.c, d = vsub(c.b.pos, JUG.ojoPos).norm(); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.asin(Math.max(-1, Math.min(1, d.y))); return 1; };
  window.__e5.disparar = (arma) => { const i = ARM.lista.indexOf(arma); if (i < 0) darArma(arma); else elegirArma(i); ARM.ocup = 0; ARM.t = 0; ARM.recargando = 0; ARM.balas[arma] = DEF_ARMAS[arma].car || 0; window.__e5.trazas.length = 0; window.__e5.exp.length = 0; const n0 = PROY.length; disparar(); const pr = PROY.length > n0 ? PROY[PROY.length - 1] : null; return pr ? { p: pr.pos.clone(), d: vscale(pr.vel, 1 / pr.vel.len()) } : null; };
  return 1; })()`);
// el personaje quieto, mirando un poco para abajo; la cámara libre lejos, arriba a un costado y mirando para otro lado
const ponerCamLibre = `(() => { JUG.vel.set(0, 0, 0); JUG.tercera = false; if (CLIB.modo) clibElegir(null); clibElegir('L'); CLIB.pos.copy(vadd(JUG.pos, v3(18, 14, -16))); CLIB.yaw = JUG.yaw + 2.2; CLIB.pitch = 0.35; return CLIB.modo; })()`;
await ev(`(() => { JUEGO.dios = true; JUG.yaw = 0.3; JUG.pitch = 0.06; return 1; })()`);
await ev(`__e5.caja(10, 1.0)`); await ev(`esperaJuego(0.3)`); await ev(`__e5.apuntar()`); await ev(ponerCamLibre); await ev(`esperaJuego(0.6)`);
const camInfo = await ev(`({ modo: CLIB.modo, camOjo: +CAM.pos.distTo(JUG.ojoPos).toFixed(1), camMiraAlPersonaje: +vdot(CAM.fwd, vsub(JUG.ojoPos, CAM.pos).norm()).toFixed(2) })`);
await foto('1_camara_libre');
const r1 = {};
// pistola: la bala sale de la mano y pega donde apunta el personaje
r1.pistola = await ev(`(() => { const m = __e5.mira(), s = __e5.disparar('Pistol'), t = __e5.trazas[0]; if (!t) return null; return { salida: __e5.cerca(t[0]), pegaA: +t[1].distTo(m.P).toFixed(2), mira: +m.t.toFixed(1) }; })()`);
// cohete: sale de la mano y va adonde apunta (lo que toca su rayo, y donde explota de verdad)
r1.cohete = await ev(`(() => { const m = __e5.mira(), s = __e5.disparar('RPG'); if (!s) return null; const h = raycast(s.p, s.d, 400, null), q = h ? h.p : vadd(s.p, vscale(s.d, 400)); window.__e5.mRPG = m.P; return { salida: __e5.cerca(s.p), ang: +(Math.acos(Math.min(1, vdot(s.d, m.f))) * 180 / Math.PI).toFixed(2), rumboA: +q.distTo(m.P).toFixed(2) }; })()`);
await ev(`esperaJuego(1.2)`);
r1.cohete.explotaA = await ev(`__e5.exp.length ? +__e5.exp[0].distTo(__e5.mRPG).toFixed(2) : null`);
await ev(`__e5.caja(10, 1.0)`); await ev(`esperaJuego(0.3)`); await ev(`__e5.apuntar()`); await ev(`esperaJuego(0.2)`);
r1.flecha = await ev(`(() => { const m = __e5.mira(), s = __e5.disparar('Crossbow'); if (!s) return null; return { salida: __e5.cerca(s.p), ang: +(Math.acos(Math.min(1, vdot(s.d, m.f))) * 180 / Math.PI).toFixed(2) }; })()`);
await ev(`esperaJuego(0.8)`);
r1.flecha.clavadaA = await ev(`(() => { const a = PROY.filter((x) => x.nombre === 'Arrow').pop(); return a ? +a.pos.distTo(__e5.mira().P).toFixed(2) : null; })()`);
// Physics Gun: agarra la caja que apunta el personaje, el rayo sale de su mano y la caja queda adelante de él
await ev(`__e5.caja(6)`); await ev(`esperaJuego(0.8)`); await ev(`__e5.apuntar()`); await ev(`esperaJuego(0.2)`);
r1.fisica = await ev(`(() => { const i = ARM.lista.indexOf('PhysicsGun'); elegirArma(i); ARM.ocup = 0; agarrarFisica(); const A = ARM.agarre; if (!A) return { agarro: false }; LIN.n = 0; dibujarRayoFisica(); const p0 = v3(LIN.v[0], LIN.v[1], LIN.v[2]); LIN.n = 0; window.__e5.dA = A.dist; return { agarro: A.b === __e5.c.b, rayo: __e5.cerca(p0) }; })()`);
await ev(`esperaJuego(1)`);
r1.fisica.cajaA = await ev(`(() => { const A = ARM.agarre; if (!A) return null; const meta = vadd(JUG.ojoPos, vscale(Quat.euler(JUG.yaw, JUG.pitch).rot(v3(0, 0, 1)), A.dist)), q = vadd(A.b.pos, A.b.q.rot(A.rl)); const d = +q.distTo(meta).toFixed(2); soltarAgarre(false); return d; })()`);
// Gravity Gun: empuja la caja hacia donde apunta el personaje
await ev(`__e5.caja(4)`); await ev(`esperaJuego(0.8)`); await ev(`__e5.apuntar()`); await ev(`esperaJuego(0.2)`);
r1.gravedad = await ev(`(() => { const c = __e5.c.b; c.vel.set(0, 0, 0); const m = __e5.mira(); __e5.disparar('GravityGun'); const v = c.vel.clone(), L = v.len(); return { vel: +L.toFixed(2), haciaMira: L > 0.01 ? +vdot(vscale(v, 1 / L), m.f).toFixed(2) : null }; })()`);
// palanca: la caja a 1,4 m; el golpe la empuja (la cámara libre está a 25 m: antes no llegaba)
await ev(`__e5.caja(1.45)`); await ev(`esperaJuego(0.8)`); await ev(`__e5.apuntar()`); await ev(`esperaJuego(0.2)`);
r1.palanca = await ev(`(() => { const c = __e5.c.b; c.vel.set(0, 0, 0); const m = __e5.mira(); __e5.disparar('Crowbar'); const v = c.vel.clone(), L = v.len(); return { vel: +L.toFixed(2), haciaMira: L > 0.01 ? +vdot(vscale(v, 1 / L), m.f).toFixed(2) : null }; })()`);
// Tool Gun (Remove): el rayo sale de la mano y borra lo que apunta el personaje
await ev(`__e5.caja(5, 1.0)`); await ev(`esperaJuego(0.5)`); await ev(`__e5.apuntar()`); await ev(`esperaJuego(0.2)`);
r1.toolgun = await ev(`(() => { const c = __e5.c, m = __e5.mira(); HER.sel = DATA.herr.findIndex((h) => h.n === 'Remove'); __e5.disparar('ToolBaton'); const t = __e5.trazas[0]; return { salida: t ? __e5.cerca(t[0]) : null, pegaA: t ? +t[1].distTo(m.P).toFixed(2) : null, borro: !OBJS.includes(c) }; })()`);
await foto('1_despues');
console.log(JSON.stringify({ camInfo, ...r1 }));
const cerca = (x) => x && x.min <= 0.6 && x.cam >= 5;
ok('1a. cámara libre: la bala sale a ≤ 0,6 m de la mano/ojos (no de la cámara) y pega donde apunta el personaje (≤ 0,3 m)', camInfo.modo === 'L' && camInfo.camOjo > 20 && r1.pistola && cerca(r1.pistola.salida) && r1.pistola.pegaA <= 0.3, { cam: camInfo, ...r1.pistola });
ok('1b. cámara libre: el cohete sale a ≤ 0,6 m de la mano/ojos, va adonde apunta el personaje (rumbo ≤ 0,5 m) y explota ahí (≤ 0,8 m)', r1.cohete && cerca(r1.cohete.salida) && r1.cohete.rumboA <= 0.5 && r1.cohete.explotaA !== null && r1.cohete.explotaA <= 0.8, r1.cohete);
ok('1c. cámara libre: la flecha sale a ≤ 0,6 m de la mano/ojos y se clava donde apunta (≤ 0,8 m)', r1.flecha && cerca(r1.flecha.salida) && r1.flecha.ang <= 5 && r1.flecha.clavadaA !== null && r1.flecha.clavadaA <= 0.8, r1.flecha);
ok('1d. cámara libre: la Physics Gun agarra lo que apunta el personaje, el rayo sale de su mano y lo sostiene adelante de él (≤ 0,5 m)', r1.fisica && r1.fisica.agarro && cerca(r1.fisica.rayo) && r1.fisica.cajaA !== null && r1.fisica.cajaA <= 0.5, r1.fisica);
ok('1e. cámara libre: la Gravity Gun y la palanca empujan lo que tiene adelante el personaje, hacia donde apunta', r1.gravedad.vel > 1 && r1.gravedad.haciaMira > 0.9 && r1.palanca.vel > 0.3 && r1.palanca.haciaMira > 0.8, { gravedad: r1.gravedad, palanca: r1.palanca });
ok('1f. cámara libre: el rayo de la Tool Gun sale de la mano y borra lo que apunta el personaje', r1.toolgun && cerca(r1.toolgun.salida) && r1.toolgun.pegaA <= 0.3 && r1.toolgun.borro, r1.toolgun);
// primera persona (sin cámara libre): igual que antes; y en tercera persona, de la mano y no de atrás de la cabeza
const r1b = {};
await ev(`(() => { clibElegir(null); JUG.tercera = false; return 1; })()`); await ev(`esperaJuego(0.5)`);
r1b.primera = await ev(`(() => { const s = __e5.disparar('RPG'), q = vadd(CAM.pos, vscale(CAM.fwd, 0.8)); return { salidaVsAntes: +s.p.distTo(q).toFixed(4), angVsCam: +(Math.acos(Math.min(1, vdot(s.d, CAM.fwd))) * 180 / Math.PI).toFixed(3) }; })()`);
await ev(`esperaJuego(1.2)`);
await ev(`(() => { JUG.tercera = true; return 1; })()`); await ev(`__e5.caja(10, 1.0)`); await ev(`esperaJuego(0.5)`); await ev(`__e5.apuntar()`); await ev(`esperaJuego(0.3)`);
r1b.tercera = await ev(`(() => { const m = __e5.mira(), s = __e5.disparar('RPG'), h = raycast(s.p, s.d, 400, null), q = h ? h.p : vadd(s.p, vscale(s.d, 400)); return { salida: __e5.cerca(s.p), atrasDeOjos: +vdot(vsub(s.p, JUG.ojoPos), m.f).toFixed(2), rumboA: +q.distTo(m.P).toFixed(2) }; })()`);
await ev(`esperaJuego(1.2)`); await ev(`(() => { JUG.tercera = false; return 1; })()`);
ok('1g. primera persona como antes (el cohete 0,8 m adelante de la cámara, sobre la mira); tercera persona: de la mano, adelante de los ojos, adonde apunta', r1b.primera.salidaVsAntes < 0.01 && r1b.primera.angVsCam < 0.05 && r1b.tercera.salida.min <= 0.6 && r1b.tercera.atrasDeOjos > 0 && r1b.tercera.rumboA <= 0.5, r1b);
// la cámara libre en modo R (alrededor del personaje, como en Roblox) y mirando por una cámara de la Tool Gun: lo mismo
await ev(`__e5.caja(10, 1.0)`); await ev(`esperaJuego(0.3)`); await ev(`__e5.apuntar()`);
await ev(`(() => { clibElegir('R'); CLIB.yaw = JUG.yaw + 2.5; CLIB.pitch = 0.4; return 1; })()`); await ev(`esperaJuego(0.5)`);
r1b.modoR = await ev(`(() => { const m = __e5.mira(), s = __e5.disparar('Pistol'), t = __e5.trazas[0]; return t ? { modo: CLIB.modo, salida: __e5.cerca(t[0]), pegaA: +t[1].distTo(m.P).toFixed(2) } : null; })()`);
await ev(`(() => { clibElegir(null); JUG.tercera = false; const f = v3(Math.sin(JUG.yaw + 1.6), 0, Math.cos(JUG.yaw + 1.6)), q = vadd(JUG.pos, vscale(f, 9)); const o = crearObjeto('CamaraTripode', v3(q.x, JUG.pos.y - 0.9, q.z), Quat.axis(0, 1, 0, JUG.yaw + 2.4), { congelado: true }); o.camPitch = 0.1; window.__e5.cam = o; HCAM.ver = o; return !!o; })()`); await ev(`esperaJuego(0.5)`);
r1b.camaraTool = await ev(`(() => { const m = __e5.mira(), vis = !!HCAM.ver && CAM.pos.distTo(JUG.ojoPos) > 3, s = __e5.disparar('Pistol'), t = __e5.trazas[0]; const r = t ? { mirandoPorLaCamara: vis, salida: __e5.cerca(t[0]), pegaA: +t[1].distTo(m.P).toFixed(2) } : null; HCAM.ver = null; borrarObjeto(__e5.cam); return r; })()`);
ok('1h. cámara libre en modo R y mirando por la cámara de la Tool Gun: la bala sale de la mano/ojos y pega donde apunta el personaje', r1b.modoR && r1b.modoR.modo === 'R' && cerca(r1b.modoR.salida) && r1b.modoR.pegaA <= 0.3 && r1b.camaraTool && r1b.camaraTool.mirandoPorLaCamara && cerca(r1b.camaraTool.salida) && r1b.camaraTool.pegaA <= 0.3, { modoR: r1b.modoR, camaraTool: r1b.camaraTool });

}
if (SOLO.includes('3')) {
// ======================= 3. la Physics Gun brilla =======================
// (puntos celestes: con DBG.verTex en Bajo la imagen es el color de la textura; los del arma son los que cambian al sacarla)
// (sin humo ni cohetes en vuelo: cambian de un cuadro a otro aunque el tiempo esté quieto)
await ev(`(() => { DIA.ciclo = false; LINT.on = false; PROY.length = 0; PART.l.length = 0; JUG.yaw = 0.3; JUG.pitch = -0.05; JUG.tercera = false; if (CLIB.modo) clibElegir(null); elegirArma(ARM.lista.indexOf('PhysicsGun')); return 1; })()`);
await ev(`esperaJuego(1.5)`);   // (que termine de sacarla)
// (y los programas que falten se compilan en el momento: en paralelo, el primer cuadro salía sin lo que se compilaba)
await ev(`(() => { window.__raf0 = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; clearTimeout(R.asincT); R.asinc = false; return 1; })()`); await p.waitForTimeout(200);
const LUZ = { oscuro: `R.solCol = [0.02, 0.02, 0.03]; R.ambS = [0.03, 0.03, 0.04]; R.ambG = [0.02, 0.02, 0.03];`, naranja: `R.solCol = [1.0, 0.42, 0.1]; R.ambS = [0.55, 0.26, 0.07]; R.ambG = [0.45, 0.2, 0.05];` };
const cal3 = async (c) => { await ev(`(() => { GFX.auto = false; PREFS.gfx = '${c}'; aplicarGfx(); clearTimeout(R.asincT); R.asinc = false; return 1; })()`); };
await cal3('bajo');
const T3 = await ev(`(() => { const T = performance.now(); __e5.foto(T); window.__T3 = T; return T; })()`);   // (un cuadro de más: después queda fijo)
// (los del arma: distintos con y sin ella, y iguales en dos fotos de cada una: lo que cambia solo no cuenta)
const masc = await ev(`(() => { DBG.verTex = true; progsLimpiar(); const A = __e5.foto(__T3), A2 = __e5.foto(__T3); const v = ARM.v; ARM.v = null; const B = __e5.foto(__T3), B2 = __e5.foto(__T3); ARM.v = v; DBG.verTex = false; progsLimpiar();
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, M = [], arma = [], dif = (X, Y, o) => Math.abs(X.px[o] - Y.px[o]) + Math.abs(X.px[o + 1] - Y.px[o + 1]) + Math.abs(X.px[o + 2] - Y.px[o + 2]);
  for (let i = 0; i < A.w * A.h; i++) { const o = i * 4; if (dif(A, B, o) < 12 || dif(A, A2, o) > 0 || dif(B, B2, o) > 0) continue; arma.push(i);
    const r = A.px[o] / 255, g = A.px[o + 1] / 255, bb = A.px[o + 2] / 255, cel = ss(0.02, 0.15, Math.min(g, bb) - r) * ss(0.2, 0.5, Math.max(g, bb)); if (cel > 0.6) M.push(i); }
  window.__mascara = M; window.__arma = arma; return { w: A.w, h: A.h, arma: arma.length, celeste: M.length }; })()`);
// el color medio de los puntos celestes del arma
const medirArma = (luz) => ev(`(() => { ${LUZ[luz]} const F = __e5.foto(__T3); if (F.w * F.h !== ${masc.w * masc.h}) return { tam: [F.w, F.h] };
  let r = 0, g = 0, bb = 0; for (const i of __mascara) { r += F.px[i * 4]; g += F.px[i * 4 + 1]; bb += F.px[i * 4 + 2]; } const n = __mascara.length; r /= n; g /= n; bb /= n;
  const mx = Math.max(r, g, bb), mn = Math.min(r, g, bb), d = mx - mn; let hue = 0; if (d > 0) hue = mx === r ? 60 * (((g - bb) / d) % 6) : mx === g ? 60 * ((bb - r) / d + 2) : 60 * ((r - g) / d + 4); if (hue < 0) hue += 360;
  return { rgb: [r, g, bb].map((x) => Math.round(x)), tono: Math.round(hue), sat: +(mx > 0 ? d / mx : 0).toFixed(2), brillo: Math.round(0.2126 * r + 0.7152 * g + 0.0722 * bb) }; })()`);
// el resplandor: lo que el bloom suma alrededor de lo celeste (puntos fuera del arma a 2–8 px de un punto celeste, oscuros sin bloom)
const medirResplandor = () => ev(`(() => { ${LUZ.oscuro} const b0 = GFX.bloom; const A = __e5.foto(__T3); GFX.bloom = 0; __e5.foto(__T3); const B = __e5.foto(__T3); GFX.bloom = b0; __e5.foto(__T3);
  const W = A.w, enArma = new Uint8Array(A.w * A.h), cel = new Uint8Array(A.w * A.h); for (const i of __arma) enArma[i] = 1; for (const i of __mascara) cel[i] = 1;
  let s = 0, n = 0; for (let i = 0; i < A.w * A.h; i++) { if (enArma[i] || __e5.Y(B, i) > 60) continue; const x = i % W, y = (i / W) | 0; let cerca = false;
    for (let k = 2; k <= 8 && !cerca; k += 3) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < A.h && cel[yy * W + xx]) { cerca = true; break; } }
    if (cerca) { s += __e5.Y(A, i) - __e5.Y(B, i); n++; } }
  return { puntos: n, suma: n ? +(s / n).toFixed(2) : null }; })()`);
const r3 = {};
for (const c of ['bajo', 'medio', 'alto']) {
  await cal3(c);
  for (const luz of ['oscuro', 'naranja']) { r3[c + '_' + luz] = await medirArma(luz); if (luz === 'oscuro') await foto('3_' + c + '_' + luz); }
}
r3.resplandor = await medirResplandor();
await ev(`(() => { DIA.aplicada = -1; diaAplicar(); GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); window.requestAnimationFrame = window.__raf0; requestAnimationFrame(cuadro); R.asinc = true; return 1; })()`);
console.log(JSON.stringify({ masc, ...r3 }));
const celeste = (x) => x && x.tono >= 165 && x.tono <= 200 && x.sat >= 0.35 && x.brillo >= 110;
ok('3a. hay puntos celestes del arma para medir (≥ 400)', masc.celeste >= 400, masc);
ok('3b. en lo oscuro, lo celeste de la Physics Gun brilla celeste (tono 165°–200°, sat ≥ 0,35, brillo ≥ 110) en Bajo, Medio y Alto', ['bajo', 'medio', 'alto'].every((c) => celeste(r3[c + '_oscuro'])), Object.fromEntries(['bajo', 'medio', 'alto'].map((c) => [c, r3[c + '_oscuro']])));
ok('3c. con luz naranja fuerte, lo celeste sigue celeste (no marrón) en Bajo, Medio y Alto', ['bajo', 'medio', 'alto'].every((c) => celeste(r3[c + '_naranja'])), Object.fromEntries(['bajo', 'medio', 'alto'].map((c) => [c, r3[c + '_naranja']])));
ok('3d. en Alto hace un resplandor suave alrededor (lo oscuro a 2–8 px de lo celeste sube de 1,5 a 40 con el bloom)', r3.resplandor && r3.resplandor.puntos >= 100 && r3.resplandor.suma >= 1.5 && r3.resplandor.suma <= 40, r3.resplandor);

}
if (SOLO.includes('2')) {
// ======================= 2. la linterna no atraviesa lo que tiene adelante =======================
// un borde de algo del mapa cerca de las apariciones: a la izquierda (más yaw) lejos, a la derecha cerca (la linterna va a la
// derecha de los ojos: la franja de sombra que se ve cae del lado izquierdo del borde)
// (la franja que se ve detrás del borde mide ~0,12·(1/cerca − 1/lejos) rad: se elige la más ancha, de ≥ 0,04 rad)
const BUSCAR = `(() => {
  const pts = MUNDO.spawns.slice(0, 12).map((s) => [s.x, s.y, s.z]), out = [];
  for (const q of pts) for (const off of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [3, 3], [-3, -3], [3, -3], [-3, 3]]) {
    const piso = mundoRayo(v3(q[0] + off[0], q[1] + 0.5, q[2] + off[1]), v3(0, -1, 0), 4); if (!piso) continue;
    const pie = v3(q[0] + off[0], q[1] + 0.5 - piso.t, q[2] + off[1]), ojo = vadd(pie, v3(0, 1.67, 0)), D = [];
    for (let a = 0; a < 360; a++) { const yaw = a * Math.PI / 180, f = v3(Math.sin(yaw), 0, Math.cos(yaw)), der = v3(-Math.cos(yaw), 0, Math.sin(yaw)), o = vadd(vadd(ojo, vscale(f, 0.15)), vscale(der, 0.12)); o.y -= 0.12; const h = raycast(o, f, 30, null); D.push(h ? h.t : 30); }
    for (let a = 0; a < 360; a++) { const dn = D[(a + 358) % 360], dn2 = D[(a + 352) % 360], df = D[(a + 2) % 360], df2 = D[(a + 8) % 360];
      if (dn >= 1.2 && dn <= 4 && Math.abs(dn2 - dn) < 1 && df > dn + 2.5 && df < 22 && df2 > dn + 2.5 && df2 < 22) out.push({ q: [pie.x, pie.y, pie.z], a, dn: +dn.toFixed(2), df: +df.toFixed(2), franja: +(0.12 * (1 / dn - 1 / df)).toFixed(3) }); }
  }
  return out.filter((c) => c.franja >= 0.04).sort((x, y) => y.franja - x.franja); })()`;
const LINTERNA = async (mapa, cals) => {
  const c = (await ev(BUSCAR))[0]; if (!c) return { borde: null };
  const res = { borde: c };
  for (const cal of cals) {
    await ev(`(() => { GFX.auto = false; PREFS.gfx = '${cal}'; aplicarGfx(); clearTimeout(R.asincT); R.asinc = false; const c = ${JSON.stringify(c)}; JUG.noclip = true; JUG.pos.set(c.q[0], c.q[1] + 0.95, c.q[2]); JUG.vel.set(0, 0, 0); JUG.yaw = (c.a - 6) * Math.PI / 180; JUG.pitch = 0; JUG.tercera = false; if (CLIB.modo) clibElegir(null); window.__armaV = ARM.v; ARM.v = null; return 1; })()`);
    await ev(`esperaJuego(0.6)`);
    res[cal] = await ev(`(() => { const T = performance.now(); LINT.on = false; __e5.foto(T); LINT.on = true; const A = __e5.foto(T); LINT.on = false; const B = __e5.foto(T); const K = __e5.clasificar(A, 3), f = __e5.fuga(K, A, B);
      let sb = null; if (GFX.bloom) { const b0 = GFX.bloom; GFX.bloom = 0; __e5.foto(T); LINT.on = true; const A2 = __e5.foto(T); LINT.on = false; const B2 = __e5.foto(T); GFX.bloom = b0; sb = __e5.fuga(K, A2, B2).fuga; }
      return { ...f, sinBloom: sb, mapaSombra: GFX.espSh, luz: A.L && [A.L.p.x, A.L.p.y, A.L.p.z].map((x) => +x.toFixed(2)), ojos: [CAM.pos.x, CAM.pos.y, CAM.pos.z].map((x) => +x.toFixed(2)) }; })()`);
    if (cal === 'bajo' || cal === 'medio') { await ev(`LINT.on = true; 1`); await p.waitForTimeout(500); await foto(`2_${mapa}_${cal}`); await ev(`LINT.on = false; 1`); }
    await ev(`ARM.v = window.__armaV; JUG.noclip = false; R.asinc = true; 1`);
  }
  return res;
};
const CALS = ['patata', 'bajo', 'medio', 'alto', 'ultra'];
// (mapa propio: gm_construct, del paquete)
await ev(`(async () => { const f = rbParaPartida('RB_Construct', PREFS.skin); if (f.length) await rbAsegurarTodos(f, () => {}); await empezarPartida('RB_Construct'); return 1; })()`);
await p.waitForFunction(() => window.__ev(`MUNDO.nombre === 'RB_Construct' && JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(2000); await ev(`cerrarPaneles && cerrarPaneles(); 1`);
const r2c = await LINTERNA('construct', CALS);
console.log(JSON.stringify({ construct: r2c }));
// (mapa del Workshop: un BSP con luz horneada)
const ins = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${ID}.gma')).arrayBuffer()); const A = await gmInstalar('${ID}', { nombre: '${ID}', sinDeps: true }, b); await A.listo; return [...GBSP.mapas].filter(([k, x]) => x.id === '${ID}').map(([k]) => k); })()`);
const NOM = ins[0];
await ev(`empezarPartida(${JSON.stringify(NOM)}); 1`);
await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), NOM, { timeout: 240000 }).catch(() => {});
await p.waitForTimeout(3000); await ev(`cerrarPaneles && cerrarPaneles(); 1`);
const r2b = await LINTERNA('bsp', CALS);
console.log(JSON.stringify({ [NOM]: r2b }));
for (const [nom, r] of [['gm_construct (propio)', r2c], [NOM + ' (BSP del Workshop)', r2b]]) {
  ok(`2a. ${nom}: hay un borde del mapa para medir y en Medio la linterna no lo atraviesa (lo tapado suma ≤ 5 % de lo iluminado a esa distancia, con ≥ 30 puntos tapados)`, r.borde && r.medio && r.medio.tapados >= 30 && r.medio.fuga !== null && r.medio.fuga <= 0.05, r.borde ? { borde: r.borde, medio: r.medio } : r);
  ok(`2b. ${nom}: en Alto y Ultra lo tapado tampoco recibe luz (≤ 5 % sin el resplandor; con él ≤ 60 %: el bloom de la mancha casi blanca)`, ['alto', 'ultra'].every((c) => r[c] && r[c].tapados >= 30 && r[c].sinBloom !== null && r[c].sinBloom <= 0.05 && r[c].fuga <= 0.6), Object.fromEntries(['alto', 'ultra'].map((c) => [c, r[c] && { tapados: r[c].tapados, fuga: r[c].fuga, sinBloom: r[c].sinBloom }])));
  ok(`2c. ${nom}: en Bajo y Patata (sin mapa de sombra) no queda nada visible que la linterna no alcance iluminado (0 puntos tapados con luz) y alumbra (suma ≥ 40)`, ['bajo', 'patata'].every((c) => r[c] && r[c].tapadosConLuz === 0 && r[c].sumaLuz >= 40), Object.fromEntries(['bajo', 'patata'].map((c) => [c, r[c] && { tapados: r[c].tapados, tapadosConLuz: r[c].tapadosConLuz, fuga: r[c].fuga, sumaLuz: r[c].sumaLuz }])));
}
}
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('4. sin errores de JS ni de WebGL', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
