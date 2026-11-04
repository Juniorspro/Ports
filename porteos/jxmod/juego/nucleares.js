// ---------------- bombas nucleares (Props → Nucleares) ----------------
// Más de 100 bombas y ensayos de verdad (herramientas/nucleares.json: potencia, país, año y tipo), con los modelos del
// HBOMBS Base Pack de Garry's Mod. E arma la bomba (sirena y cuenta regresiva de 10 s, 15 en las de megatones); armada,
// también explota si se la golpea fuerte. La explosión va escalada a los mapas (el radio crece con la raíz cúbica de la
// potencia: 15 kt ≈ 40 m, 1 Mt ≈ 160 m, 50 Mt ≈ 590 m): destello que encandila, bola de fuego, onda expansiva que avanza
// y empuja, rompe y lastima todo lo que alcanza (muerte segura en la bola de fuego), el estruendo llega con la demora del
// sonido, el hongo sube y se queda flotando, y las de superficie dejan radiación un rato. Según el tipo: en el aire (la
// bola no toca el piso), de superficie, subterránea (sin hongo: polvo y temblor), bajo el agua (columna blanca) o en el
// espacio (un destello y una esfera en el cielo). En la sala, el que la tenía avisa y cada uno la ve y recibe lo suyo.
const NUK = { vivas: [], D: null, n: 0 };
const nukeRadio = (kt) => clamp(16 * Math.cbrt(Math.max(0.001, kt)), 6, 700);
function nukeDe(nombre) { const k = DATA.pfPorNombre[nombre], a = k && DATA.pf[k]; return (a && a[0].nk) || null; }
function nukeNom(nombre) { const nk = nukeDe(nombre); return nk ? nk.n : nombre; }
const nukePot = (kt) => (kt >= 1000 ? +(kt / 1000).toFixed(kt >= 10000 ? 0 : 1) + ' Mt' : kt >= 1 ? +kt.toFixed(kt >= 10 ? 0 : 1) + ' kt' : Math.round(kt * 1000) + ' t');
const nukeFicha = (nk) => `${nk.n} · ${nk.p} ${nk.a > 0 ? nk.a : ''} · ${nukePot(nk.kt)}`;
// (los modelos, texturas y sonidos de las bombas vienen en un paquete aparte, web/rb/p_nuk.*.rbp: se piden al abrir la
// sección o al aparecer una; un sonido que todavía no llegó suena apenas llega, si no pasaron más de 4 s)
const NUK_PAQ = 'p_nuk';
function nukePrecargar() { rbPedir(NUK_PAQ); }
function nukeSonar(n, pos, v, t0) {
  if (!AUD.ctx || !PREFS.vol) return;
  if (AUD.buf[n]) { sonar(n, pos, v); return; }
  t0 = t0 || performance.now(); rbPedir(NUK_PAQ); audioBuf(n);
  if (performance.now() - t0 < 4000) setTimeout(() => nukeSonar(n, pos, v, t0), 100);
}

// ---------------- armar ----------------
function nukeUsar(o) {
  if (!o.nk || o.nkArm) return;
  nukeArmar(o, o.nk.kt >= 1000 ? 15 : 10, true);
}
function nukeArmar(o, cuenta, local) {
  o.nkArm = { t: cuenta, tot: cuenta, bip: Math.ceil(cuenta) };
  nukeSonar('NK_sirena', o.b.pos, 1.2); aviso(T('nk.armada').replace('{0}', Math.ceil(cuenta)), 2.5);
  if (local && RED.on) publicar('a', { k: 'nkarm', o: claveObj(o), c: cuenta });
}
function nukePaso(dt) {
  // las armadas: cuenta regresiva (un pitido por segundo, más rápido al final) o un golpe fuerte
  for (const o of OBJS) {
    const A = o.nkArm; if (!A) continue;
    A.t -= dt; const v = o.b.vel.len(), golpe = A.vAnt !== undefined && A.vAnt - v > 9; A.vAnt = v;
    if (A.t < A.bip - 1) { A.bip = Math.ceil(A.t); sonar('UI_blip', o.b.pos, 0.9, A.t < 3 ? 1.6 : 1.2); }
    if ((A.t <= 0 || golpe) && !o.remoto && !o.nkBum) { o.nkBum = true; const p = o.b.pos.clone(), nk = o.nk; nukeExplotar(p, o.nombre, true); borrarObjeto(o, true); }
  }
  // las que explotaron: la onda avanza y alcanza lo que encuentra
  for (let i = NUK.vivas.length - 1; i >= 0; i--) { const E = NUK.vivas[i]; E.t += dt; nukeOnda(E, dt); if (E.t > E.dura) NUK.vivas.splice(i, 1); }
  // la radiación (a los que están adentro de la zona de las de superficie)
  nukeRadiacion(dt);
  // (el destello se apaga solo; la capa sigue al valor aunque alguien lo cambie de golpe)
  const f = $('nukFlash'); if (f && f.style.display !== 'none') { NUK.flash = Math.max(0, (NUK.flash || 0) - dt * 0.45); f.style.opacity = Math.min(1, NUK.flash).toFixed(3); if (NUK.flash <= 0) f.style.display = 'none'; }
}

// ---------------- la explosión ----------------
function nukeExplotar(p0, nombre, local) {
  const nk = nukeDe(nombre); if (!nk) return;
  const R = nukeRadio(nk.kt), tipo = nk.t, p = p0.clone();
  let piso = pisoBajo(v3(p.x, p.y + 2, p.z), 400); if (piso === null) piso = p.y - 1;
  // (a qué altura: en el aire la bola de fuego no toca el piso; en el espacio, bien arriba)
  if (tipo === 'aire' || tipo === 'bomba' || tipo === 'misil' || tipo === 'ficcion') p.y = Math.max(p.y, piso + R * 0.45);
  if (tipo === 'espacio') p.y = piso + Math.max(250, R * 3);
  const E = { p, piso, nk, R, tipo, t: 0, dura: tipo === 'subte' ? 25 : 150, onda: 0, vel: Math.max(70, R * 1.7), alc: R * 2.3, tocados: new Set(), jug: false, son: false, seed: (NUK.n = (NUK.n || 0) + 1) * 977 };
  NUK.vivas.push(E);
  if (local && RED.on) publicar('a', { k: 'nk', n: nombre, p: [r3(p0.x), r3(p0.y), r3(p0.z)] });
  // el destello: más fuerte cerca y mirando hacia ella; la luz del mundo, un instante
  const d = CAM.pos.distTo(p), mira = Math.max(0, vdot(vsub(p, CAM.pos).norm(), CAM.fwd));
  if (tipo !== 'subte') { NUK.flash = Math.max(NUK.flash || 0, clamp(1.6 - d / (R * (tipo === 'espacio' ? 30 : 7)), 0, 1.6) * (0.55 + 0.45 * mira)); const f = nukeFlashEl(); f.style.display = 'block'; }
  luzTemporal(vadd(p, v3(0, R * 0.3, 0)), R * 4, tipo === 'subte' ? [6, 4, 2] : [900, 600, 300], tipo === 'subte' ? 0.5 : 2.5);
  // la radiación: las de superficie (la bola toca el piso)
  if (tipo === 'suelo' || tipo === 'torre' || tipo === 'barco' || tipo === 'artilleria') (NUK.zonas || (NUK.zonas = [])).push({ p: v3(p.x, piso, p.z), r: R * 0.85, t: 100 });
  return E;
}
function nukeFlashEl() { let f = $('nukFlash'); if (!f) { f = document.createElement('div'); f.id = 'nukFlash'; document.body.appendChild(f); } return f; }
// la onda: avanza con su velocidad y a cada cosa la alcanza una vez
function nukeOnda(E, dt) {
  if (E.tipo === 'espacio') { nukeSonido(E); return; }
  const r0 = E.onda; E.onda = Math.min(E.alc, E.onda + E.vel * dt); const r1 = E.onda, R = E.R, p = E.p;
  if (r1 > r0) {
    for (const b of PH.bodies) {
      if (E.tocados.has(b) || (!b.dynamic && !b.frozen)) continue;
      const dv = vsub(b.pos, p), L = dv.len(); if (L > r1) continue;
      E.tocados.add(b); const k = Math.pow(clamp(1 - L / E.alc, 0, 1), 1.4), dir = L > 0.01 ? dv.scale(1 / L) : v3(0, 1, 0);
      if (b.frozen && b.obj && L < R) b.frozen = false;   // (como en HBOMBS: lo congelado cerca se suelta)
      b.wake();
      if (b.dynamic) { const fz = (18 + R * 0.12) * k * Math.min(1, 400 / b.mass + 0.2); b.vel.addS(dir, fz); b.vel.y += fz * 0.35 + (E.tipo === 'subte' ? 6 * k : 0); b.ang.addS(v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), 8 * k); }
      if (b.obj) danarObjeto(b.obj, L < R * 0.35 ? 9999 : 600 * k, b.pos, dir);
      if (b.persona && !b.persona.rag) { const P = b.persona; if (typeof danarPersona === 'function') danarPersona(P, L < R * 0.35 ? 9999 : 260 * k, b.pos, dir, b); if (P.npc && !P.rag && typeof npcTumbar === 'function') npcTumbar(P, vadd(vscale(dir, 20 * k), v3(0, 8 * k, 0)), 0); }
    }
    // yo
    const dj = JUG.pos.distTo(p);
    if (!E.jug && dj <= r1) {
      E.jug = true; const k = Math.pow(clamp(1 - dj / E.alc, 0, 1), 1.4);
      if (JUG.vivo && !CIC.inmune) { danarJugador(dj < R * 0.35 ? 99999 : 240 * k, p); if (!JUG.vehiculo) { JUG.vel.addS(vsub(JUG.pos, p).norm(), 30 * k); JUG.vel.y += 9 * k; } }
      CAM.temblor = Math.max(CAM.temblor, clamp(0.4 + k * 1.6, 0, 1.5));
    }
  }
  nukeSonido(E);
}
// el estruendo, con la demora del sonido (340 m/s), y el rumor que sigue
function nukeSonido(E) {
  const d = CAM.pos.distTo(E.p);
  if (!E.son && E.t >= d / 340) {
    E.son = true; const kt = E.nk.kt, v = clamp(1.5 - d / (E.R * 9), 0.3, 1.5);
    const s = E.tipo === 'subte' ? 'NK_onda' : kt < 1 ? 'NK_davy' : kt < 60 ? (E.tipo === 'torre' ? 'NK_trinity' : kt < 20 ? 'NK_abomb' : 'NK_fat') : kt < 1000 ? 'NK_abomb_big' : kt < 20000 ? 'NK_real' : 'NK_tsar';
    nukeSonar(s, null, v); setTimeout(() => nukeSonar('NK_rumble', null, v * 0.8), 1200); if (kt >= 50) setTimeout(() => nukeSonar('NK_despues', null, v * 0.6), 6500);
    if (d < E.alc * 1.6) CAM.temblor = Math.max(CAM.temblor, 0.6);
  }
}
function nukeRadiacion(dt) {
  const Z = NUK.zonas; if (!Z || !Z.length) { NUK.rad = 0; return; }
  let rad = 0;
  for (let i = Z.length - 1; i >= 0; i--) { const z = Z[i]; z.t -= dt; if (z.t <= 0) { Z.splice(i, 1); continue; } const d = JUG.pos.distTo(z.p); if (d < z.r) rad = Math.max(rad, (1 - d / z.r) * Math.min(1, z.t / 20)); }
  NUK.rad = rad; const g = $('nukRad') || (() => { const e = document.createElement('div'); e.id = 'nukRad'; document.body.appendChild(e); return e; })(); g.style.opacity = (rad * 0.55).toFixed(3);
  if (rad > 0.02 && !NUK.radAviso) { NUK.radAviso = true; aviso(T('nk.rad'), 3); } else if (rad <= 0.02) NUK.radAviso = false;
  if (rad > 0.02 && JUG.vivo) {
    NUK.radT = (NUK.radT || 0) + dt; if (NUK.radT > 1) { NUK.radT = 0; danarJugador(Math.ceil(6 * rad), null); }
    if (Math.random() < dt * (3 + 25 * rad)) sonar('UI_blip', null, 0.12 + 0.2 * rad, 2.6 + Math.random());   // (el contador Geiger)
  }
}
// en la sala
function nukeRed(d) {
  if (d.k === 'nk' && typeof d.n === 'string' && Array.isArray(d.p) && nukeDe(d.n)) nukeExplotar(v3(+d.p[0], +d.p[1], +d.p[2]), d.n, false);
  else if (d.k === 'nkarm' && typeof d.o === 'string') { const o = buscarObjeto(d.o); if (o && o.nk && !o.nkArm) nukeArmar(o, clamp(+d.c || 10, 1, 30), false); }
}

// ---------------- el dibujo: bola de fuego, onda de polvo y hongo (carteles grandes, con su propio búfer) ----------------
// Cada explosión arma ~60-150 carteles calculados del tiempo (no partículas sueltas: el sistema de partículas tiene tope).
// Los lejanos (más allá de la vista del mapa, como el sombrero de las de megatones) se dibujan aparte, sin profundidad.
function nukeAzar(E, i) { const x = Math.sin((E.seed + i) * 12.9898) * 43758.5453; return x - Math.floor(x); }
function nukeCarteles(E, out) {
  // (más bocanadas en Alto y Ultra: son cuadros enormes que tapan la pantalla y en un celular cuesta cada uno)
  const t = E.t, R = E.R, p = E.p, piso = E.piso, pocos = GFX.part < 0.5, mas = GFX.part >= 1 ? 1.4 : 1, fin = clamp((E.dura - t) / 20, 0, 1);
  const pon = (x, y, z, s, c, a, suma) => out.push(x, y, z, c[0], c[1], c[2], a * fin, s, suma ? 1 : 0);
  const fuego = (k) => (k < 0.15 ? [1, 0.95, 0.8] : k < 0.5 ? [1, 0.7, 0.3] : [1, 0.42, 0.12]);
  if (E.tipo === 'espacio') {
    // una esfera que se agranda y se apaga en el cielo
    const rr = R * 2.5 * (1 - Math.exp(-t * 0.8)), a = clamp(1 - t / 25, 0, 1), n = pocos ? 18 : 36;
    for (let i = 0; i < n; i++) { const u = nukeAzar(E, i) * Math.PI * 2, w = Math.acos(2 * nukeAzar(E, i + 99) - 1); pon(p.x + rr * Math.sin(w) * Math.cos(u), p.y + rr * Math.cos(w), p.z + rr * Math.sin(w) * Math.sin(u), R * 0.6, [0.6, 0.85, 1], a * 0.5, true); }
    pon(p.x, p.y, p.z, R * 1.2 * (1 - Math.exp(-t * 3)), [1, 1, 1], clamp(1 - t / 4, 0, 1), true);
    return;
  }
  // bola de fuego (suma luz): crece rápido, sube un poco y se apaga en ~10 s
  if (E.tipo !== 'subte') {
    const rf = R * 0.38 * (1 - Math.exp(-t * 6)), sube = t > 0.6 ? (t - 0.6) * R * 0.05 : 0, k = clamp(t / 10, 0, 1), a = clamp(1.4 - t / 8, 0, 1), c = fuego(k), n = pocos ? 6 : Math.round(12 * mas);
    for (let i = 0; i < n; i++) { const u = nukeAzar(E, i) * Math.PI * 2, w = Math.acos(2 * nukeAzar(E, i + 50) - 1), rr = rf * 0.55; pon(p.x + rr * Math.sin(w) * Math.cos(u), p.y + sube + rr * Math.cos(w), p.z + rr * Math.sin(w) * Math.sin(u), rf * 1.1, c, a, true); }
    pon(p.x, p.y + sube, p.z, rf * 1.8, [1, 0.9, 0.7], clamp(1 - t / 2.5, 0, 1), true);
  }
  // el polvo que levanta la onda en el piso (marrón; en el agua, blanco)
  const agua = E.tipo === 'agua' || E.tipo === 'barco', nd = pocos ? 12 : Math.round(26 * mas), rs = Math.min(E.alc * 0.85, E.onda * 0.95), ad = clamp(1 - (t - 4) / 14, 0, 0.8);
  for (let i = 0; i < nd; i++) { const u = (i / nd) * Math.PI * 2 + nukeAzar(E, i + 200) * 0.3; pon(p.x + Math.cos(u) * rs, piso + R * 0.06, p.z + Math.sin(u) * rs, R * 0.32, agua ? [0.85, 0.87, 0.9] : [0.45, 0.38, 0.3], ad, false); }
  if (E.tipo === 'subte') {
    // subterránea: una cúpula de polvo que se levanta y cae
    const h = R * 0.5 * Math.sin(Math.min(Math.PI, t * 0.6)), n = pocos ? 10 : 20;
    for (let i = 0; i < n; i++) { const u = nukeAzar(E, i) * Math.PI * 2, rr = R * 0.4 * nukeAzar(E, i + 7); pon(p.x + Math.cos(u) * rr, piso + h * nukeAzar(E, i + 30), p.z + Math.sin(u) * rr, R * 0.3, [0.5, 0.42, 0.33], clamp(1 - t / 22, 0, 0.8), false); }
    return;
  }
  // el hongo: el tallo y el sombrero (un anillo que rueda), que sube y se queda; iluminado de naranja al principio
  const H = clamp(R * 1.6 + 25, 30, 900) * (agua ? 0.7 : 1), hc = (E.tipo === 'aire' || E.tipo === 'bomba' || E.tipo === 'misil' || E.tipo === 'ficcion' ? p.y - piso : 0) * 0.3 + H * (1 - Math.exp(-t / 5)), y0 = piso;
  const luz = clamp(1 - t / 14, 0, 1), gris = agua ? [0.92, 0.93, 0.95] : [0.5, 0.45, 0.4], col = (k) => [gris[0] + (1 - gris[0]) * luz * k, gris[1] + (0.55 - gris[1]) * luz * k, gris[2] + (0.25 - gris[2]) * luz * k];
  const ns = pocos ? 8 : Math.round(16 * mas), aT = clamp(t / 1.5, 0, 0.85);
  for (let i = 0; i < ns; i++) { const k = i / (ns - 1), y = y0 + k * hc * 0.92, rr = R * (0.1 + 0.06 * (1 - k)); pon(p.x + (nukeAzar(E, i + 300) - 0.5) * rr, y, p.z + (nukeAzar(E, i + 330) - 0.5) * rr, R * (0.2 + 0.12 * (1 - k)), col(0.6 + 0.4 * k), aT, false); }
  const Rm = R * 0.42 * (0.55 + 0.45 * (1 - Math.exp(-t / 4))), rm = R * 0.3, nc = pocos ? 22 : Math.round(54 * mas), rueda = t * 0.25;
  for (let i = 0; i < nc; i++) {
    const u = (i / nc) * Math.PI * 2 * 3 + nukeAzar(E, i + 400) * 0.6, w = nukeAzar(E, i + 450) * Math.PI * 2 + rueda, rr = Rm + Math.cos(w) * rm;
    pon(p.x + Math.cos(u) * rr, y0 + hc + Math.sin(w) * rm * 0.8, p.z + Math.sin(u) * rr, rm * 1.15, col(Math.sin(w) < 0 ? 1 : 0.5), aT, false);
  }
  // abajo del sombrero, el resplandor de la bola (los primeros segundos)
  if (luz > 0.05) pon(p.x, y0 + hc - rm * 0.4, p.z, Rm * 1.6, [1, 0.5, 0.15], luz * 0.5, true);
}
function nukeDibujar() {
  if (!NUK.vivas.length) return;
  const gl = R.gl, P = PART.prog; if (!P) return;
  const L = []; for (const E of NUK.vivas) nukeCarteles(E, L);
  const n = L.length / 9; if (!n) return;
  const D = NUK.D && NUK.D.length >= n * 6 * PART_F ? NUK.D : (NUK.D = new Float32Array(Math.ceil(n * 1.5) * 6 * PART_F));
  const lejos = (R.lejos || 300) * 0.95, cam = CAM.pos;
  // (de lejos a cerca: con alfa se ve bien encimado)
  const idx = []; for (let i = 0; i < n; i++) { const o = i * 9; idx.push([i, (L[o] - cam.x) ** 2 + (L[o + 1] - cam.y) ** 2 + (L[o + 2] - cam.z) ** 2]); }
  idx.sort((a, b) => b[1] - a[1]);
  gl.useProgram(P.p); R.progAct = P; gl.uniform1f(P.u.uLin, R.salida === 'hdr' ? 1 : 0);
  gl.uniform3f(P.u.uDer, CAM.der.x, CAM.der.y, CAM.der.z); gl.uniform3f(P.u.uArr, CAM.arr.x, CAM.arr.y, CAM.arr.z); gl.uniform3f(P.u.uCam, CAM.pos.x, CAM.pos.y, CAM.pos.z);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, PART.tex.atlas); R.texAct = null;
  gl.bindVertexArray(PART.vao); gl.bindBuffer(gl.ARRAY_BUFFER, PART.buf); gl.enable(gl.BLEND); gl.depthMask(false); gl.disable(gl.CULL_FACE);
  // dos tandas: lo que está dentro de la vista del mapa (con profundidad) y lo de más allá (con una proyección más larga, sin profundidad)
  const VPlejos = NUK.vpL || (NUK.vpL = new Float32Array(16)); m4mul(M4.persp(CAM.fov * Math.PI / 180, R.cv.width / R.cv.height, 1, 6000), M4.view(CAM.pos, CAM.qVista), VPlejos);
  for (const [vp, cerca] of [[VPlejos, false], [R.vp, true]]) {
    for (const suma of [false, true]) {
      let m = 0;
      for (const [i, d2] of idx) {
        const o = i * 9; if ((Math.sqrt(d2) < lejos) !== cerca || (L[o + 8] > 0.5) !== suma) continue;
        // (con las texturas de humo y de llama del atlas, cada bocanada girada a su manera)
        m = partVertices(D, m, L[o], L[o + 1], L[o + 2], L[o + 3], L[o + 4], L[o + 5], L[o + 6], L[o + 7], i * 2.39996, suma ? 2 : 1, 0, 0, 0, 0);
      }
      if (!m) continue;
      gl.uniformMatrix4fv(P.u.uVP, false, vp); if (cerca) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
      gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, m * PART_F), gl.STREAM_DRAW);
      gl.blendFunc(gl.SRC_ALPHA, suma ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(P.u.uBri, suma ? 3 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, m);
    }
  }
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null); R.vaoAct = null;
}
