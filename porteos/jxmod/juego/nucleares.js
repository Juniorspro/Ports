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
function nukePrecargar() { rbPedir(NUK_PAQ); if (typeof nvPreparar === 'function') nvPreparar(); }   // (y el hongo con volumen: nuclear_vol.js)
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
  if (typeof nvPreparar === 'function') nvPreparar();   // (en la cuenta regresiva se arma el ruido del hongo, de a poco)
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
  for (let i = NUK.vivas.length - 1; i >= 0; i--) { const E = NUK.vivas[i]; E.t += dt; nukeOnda(E, dt); nukeViento(E, dt); if (E.t > E.dura) NUK.vivas.splice(i, 1); }
  // la radiación (a los que están adentro de la zona de las de superficie)
  nukeRadiacion(dt);
  // (el destello se apaga solo; la capa sigue al valor aunque alguien lo cambie de golpe)
  // (el destello: al máximo 0,12 s y después se apaga en un par de segundos; si alguien lo pone en 0, se corta)
  const f = $('nukFlash');
  if (f && f.style.display !== 'none') {
    if ((NUK.flash || 0) > 0) { NUK.flashT = (NUK.flashT || 0) + dt; NUK.flash = (NUK.flashI || 0) * (NUK.flashT < 0.12 ? 1 : Math.exp(-(NUK.flashT - 0.12) * 1.7)); if (NUK.flash < 0.004) NUK.flash = 0; }
    f.style.opacity = Math.min(1, NUK.flash || 0).toFixed(3); if (!(NUK.flash > 0)) f.style.display = 'none';
  }
}

// ---------------- la explosión ----------------
function nukeExplotar(p0, nombre, local) {
  const nk = nukeDe(nombre); if (!nk) return;
  const R = nukeRadio(nk.kt), tipo = nk.t, p = p0.clone();
  // (el piso debajo de la bomba: desde un poco más arriba, para abajo; antes se le pasaba 400 como «alto» y el rayo arrancaba
  // 400 m arriba y no llegaba al piso: tomaba el primer techo, árbol o borde del mapa que hubiera encima)
  let piso = pisoBajo(v3(p.x, p.y + 1, p.z), 1); if (piso === null || piso > p.y + 1.5) piso = p.y - 1;
  // (a qué altura: en el aire la bola de fuego no toca el piso; en el espacio, bien arriba)
  if (tipo === 'aire' || tipo === 'bomba' || tipo === 'misil' || tipo === 'ficcion') p.y = Math.max(p.y, piso + R * 0.45);
  if (tipo === 'espacio') p.y = piso + Math.max(250, R * 3);
  const E = { p, piso, nk, R, tipo, t: 0, dura: tipo === 'subte' ? 25 : 150, onda: 0, vel: Math.max(70, R * 1.7), alc: R * 2.3, tocados: new Set(), jug: false, son: false, seed: (NUK.n = (NUK.n || 0) + 1) * 977 };
  NUK.vivas.push(E);
  if (local && RED.on) publicar('a', { k: 'nk', n: nombre, p: [r3(p0.x), r3(p0.y), r3(p0.z)] });
  // el destello blanco: de cerca encandila del todo; de lejos baja pero no se apaga (una nuclear se ve a decenas de km), y
  // aunque no la estés mirando el cielo se pone blanco (menos). La luz del mundo, un instante
  const d = CAM.pos.distTo(p), mira = vdot(vsub(p, CAM.pos).norm(), CAM.fwd);
  if (tipo !== 'subte') { const I = nukeDestello(d, R, mira, tipo); if (I > (NUK.flash || 0)) { NUK.flashI = I; NUK.flashT = 0; NUK.flash = I; } const f = nukeFlashEl(); f.style.display = 'block'; f.style.opacity = Math.min(1, NUK.flash).toFixed(3); }
  if (typeof nvPreparar === 'function') nvPreparar();
  luzTemporal(vadd(p, v3(0, R * 0.3, 0)), R * 4, tipo === 'subte' ? [6, 4, 2] : [900, 600, 300], tipo === 'subte' ? 0.5 : 2.5);
  // la radiación: las de superficie (la bola toca el piso)
  if (tipo === 'suelo' || tipo === 'torre' || tipo === 'barco' || tipo === 'artilleria') (NUK.zonas || (NUK.zonas = [])).push({ p: v3(p.x, piso, p.z), r: R * 0.85, t: 100 });
  return E;
}
// cuánto encandila: 1,35 a menos de 4 radios, baja de a poco con la distancia (0,4 como mínimo) y, si no la mirás, un 35 %
function nukeDestello(d, R, mira, tipo) {
  const k = clamp(1.35 - 0.3 * Math.log2(1 + d / (R * (tipo === 'espacio' ? 30 : 4))), 0.4, 1.35);
  return k * (0.35 + 0.65 * clamp((mira + 0.2) / 0.8, 0, 1));
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
      if (b.dynamic) {
        const fz = (18 + R * 0.12) * k * Math.min(1, 400 / b.mass + 0.2); b.vel.addS(dir, fz); b.vel.y += fz * 0.35 + (E.tipo === 'subte' ? 6 * k : 0); b.ang.addS(v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), 8 * k);
        // (y el viento que viene con la onda, el mismo que empuja lo liviano de afuera —nukeViento—: así el empujón no salta
        // en el borde del daño —antes, justo adentro casi nada y justo afuera 6 m/s— y siempre baja con la distancia)
        const fv = nukeVientoCosa(E, b, L); if (fv > 0) { const hx = b.pos.x - p.x, hz = b.pos.z - p.z, hl = Math.hypot(hx, hz) || 1; b.vel.x += hx / hl * fv; b.vel.z += hz / hl * fv; b.vel.y += fv * 0.25; }
      }
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
// ---------------- el viento de la explosión ----------------
// La onda sigue de largo como viento hasta 3 veces el alcance del daño: cuando te llega, una ráfaga hacia afuera (te empuja,
// tiembla la cámara, polvo y basuritas que vuelan a ras del piso y un soplido) que dura más cuanto más grande la bomba; después,
// mientras sube el hongo, el viento de vuelta hacia la bola de fuego (el «viento de retorno» de las pruebas reales), más suave.
// Lo suelto y liviano lejos del daño también se mueve. Las partículas, sólo cerca de la cámara y con tope por calidad: cuesta
// lo mismo con una de 10 t que con una de 100 Mt
function nukeViento(E, dt) {
  if (E.tipo === 'espacio' || E.tipo === 'subte' || E.sinViento) return;   // (sinViento: las fotos de las pruebas)
  const R = E.R, p = E.p, alcV = E.alc * 3, frente = Math.min(alcV, E.vel * E.t);
  const V = E.viento || (E.viento = { t0: -1, k: 0, sop: false, ret: 0 });
  // (a mí: cuándo me alcanza el frente y con cuánta fuerza; dura de 1,5 s a 6 s según el tamaño)
  const dj = Math.hypot(JUG.pos.x - p.x, JUG.pos.z - p.z);
  if (V.t0 < 0 && frente >= dj && dj < alcV) { V.t0 = E.t; V.k = Math.pow(clamp(1 - dj / alcV, 0, 1), 1.2); V.dura = clamp(1.5 + R / 60, 1.5, 6); }
  let k = 0, sale = 1;
  if (V.t0 >= 0) {
    const u = E.t - V.t0;
    if (u < V.dura) k = V.k * Math.min(1, u / 0.15) * (1 - u / V.dura);   // la ráfaga: sube en 0,15 s y se apaga
    else if (E.t < 40) { sale = -1; k = V.k * 0.28 * clamp((u - V.dura) / 3, 0, 1) * clamp((40 - E.t) / 10, 0, 1); }   // el retorno
    if (!V.sop && V.k > 0.02) { V.sop = true; nukeSoplido(V.k, V.dura); }
  }
  V.ahora = k * sale; V.dir = dj > 0.5 ? [(JUG.pos.x - p.x) / dj, (JUG.pos.z - p.z) / dj] : [1, 0];
  if (k > 0.002) {
    const dx = V.dir[0] * sale, dz = V.dir[1] * sale;
    // (en el piso el roce frena e^(-12·dt): con 75·k se sienten 2 a 6 m/s; en el aire, menos)
    if (JUG.vivo && !JUG.vehiculo && !CIC.inmune) { const a = (JUG.suelo ? 75 : 25) * k; JUG.vel.x += dx * a * dt; JUG.vel.z += dz * a * dt; }
    if (sale > 0) CAM.temblor = Math.max(CAM.temblor || 0, 0.25 * k);
    // (basuritas y polvo que pasan volando al lado de la cámara)
    // (unas 45 por segundo con la ráfaga a pleno, por la cantidad de partículas de la calidad: duran 1 a 2 s, así quedan ~60)
    const lam = (GFX.part || 0.25) * 45 * k * dt, n = Math.floor(lam) + (Math.random() < lam % 1 ? 1 : 0), agua = E.tipo === 'agua' || E.tipo === 'barco';
    for (let i = 0; i < n; i++) {
      const lat = (Math.random() - 0.5) * 40, adel = -sale * (10 + Math.random() * 25), q = v3(JUG.pos.x + dx * adel - dz * lat, JUG.pos.y - 1 + Math.random() * 2.5, JUG.pos.z + dz * adel + dx * lat);
      const vv = (25 + 30 * k) * (0.7 + Math.random() * 0.6), chico = Math.random() < 0.45;
      const h = chico ? particula(q, v3(dx * vv, Math.random() * 3, dz * vv), 1.1, 0.08 + Math.random() * 0.12, agua ? [0.8, 0.83, 0.86, 0.9] : [0.22, 0.19, 0.16, 0.95], 'humo', 0)
                      : particula(q, v3(dx * vv * 0.6, 1 + Math.random() * 2, dz * vv * 0.6), 2.2, 1.5 + Math.random() * 2.5, agua ? [0.85, 0.87, 0.9, 0.35] : [0.62, 0.52, 0.4, 0.38], 'humo', 2.2);
      if (h) { h.fr = 0.3; h.grav = chico ? 0.3 : 0; if (chico) h.dr = (Math.random() - 0.5) * 9; }
    }
  }
  // (el frente que avanza: el polvo que levanta a ras del piso, en la parte que está cerca de la cámara)
  if (frente > E.alc * 0.6 && frente < alcV && E.t < 60) {
    const dc = Math.hypot(CAM.pos.x - p.x, CAM.pos.z - p.z);
    if (Math.abs(dc - frente) < 140) {
      const lam = (GFX.part || 0.25) * 25 * dt, m = Math.floor(lam) + (Math.random() < lam % 1 ? 1 : 0), ang0 = Math.atan2(CAM.pos.z - p.z, CAM.pos.x - p.x), agua = E.tipo === 'agua' || E.tipo === 'barco';
      for (let i = 0; i < m; i++) {
        const a = ang0 + (Math.random() - 0.5) * Math.min(1.4, 160 / Math.max(frente, 1)), cx = p.x + Math.cos(a) * frente, cz = p.z + Math.sin(a) * frente;
        const h = particula(v3(cx, E.piso + 0.5 + Math.random() * 1.5, cz), v3(Math.cos(a) * E.vel * 0.35, 2 + Math.random() * 4, Math.sin(a) * E.vel * 0.35), 3, 4 + Math.random() * 5, agua ? [0.88, 0.9, 0.93, 0.35] : [0.6, 0.5, 0.38, 0.4], 'humo', 2.6);
        if (h) { h.fr = 0.8; h.grav = 0; }
      }
    }
  }
  // (lo suelto y liviano entre el daño y el final del viento: un empujón al pasar el frente; lo que ya tocó la onda, no)
  if (frente > E.alc && frente < alcV) {
    const r0 = Math.max(E.alc, frente - E.vel * dt);
    for (const b of PH.bodies) {
      if (!b.dynamic || b.frozen || b.mass > 300 || E.tocados.has(b)) continue;
      const ddx = b.pos.x - p.x, ddz = b.pos.z - p.z, L = Math.hypot(ddx, ddz); if (L < r0 || L > frente) continue;
      E.tocados.add(b); const fz = nukeVientoCosa(E, b, L);
      b.wake(); b.vel.x += ddx / L * fz; b.vel.z += ddz / L * fz; b.vel.y += fz * 0.25;
    }
  }
}
// (el empujón del viento a una cosa suelta y liviana —hasta 300 kg— a L metros: baja derecho hasta el final del viento, 3 veces
// el alcance del daño; las pesadas, nada)
function nukeVientoCosa(E, b, L) {
  if (E.tipo === 'espacio' || E.tipo === 'subte' || E.sinViento || !b.dynamic || b.mass > 300) return 0;
  return 9 * clamp(1 - L / (E.alc * 3), 0, 1) * Math.min(1, 120 / b.mass + 0.2);
}
// el soplido: ruido filtrado que sube, ruge y se va (WebAudio, sin archivos)
function nukeSoplido(k, dura) {
  if (typeof AUD === 'undefined' || !AUD.ctx || !PREFS.vol) return;
  const c = AUD.ctx, t = c.currentTime, n = Math.round(c.sampleRate * Math.min(7, dura + 1));
  if (!NUK.ruidoBuf || NUK.ruidoBuf.length < n) { const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let ult = 0; for (let i = 0; i < n; i++) { ult = ult * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = ult * 9; } NUK.ruidoBuf = b; }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = NUK.ruidoBuf; f.type = 'lowpass'; f.Q.value = 0.8;
  f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.2); f.frequency.exponentialRampToValueAtTime(320, t + dura);
  const v = clamp(0.25 + 0.75 * k, 0.1, 1);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dura + 0.6);
  s.connect(f); f.connect(g); g.connect(AUD.master); s.start(t); s.stop(t + dura + 0.8);
  NUK.soplidos = (NUK.soplidos || 0) + 1;
  // (anotado, para cortarlo si se cambia de mundo: nukeLimpiar)
  const L = NUK.sons || (NUK.sons = []); L.push(s); s.onended = () => { const i = L.indexOf(s); if (i >= 0) L.splice(i, 1); };
}
// al empezar otro mundo, entrar a un server o volver al menú, lo de una nuclear de antes no sigue. Antes la explosión, la
// onda, el viento, la radiación, el destello y el soplido seguían en el mundo nuevo hasta terminarse (hasta 150 s), también
// al pasar de un server a otro (Discord: «si creás un mundo nuevo y en un anterior detonaste una, sigue estando»)
function nukeLimpiar() {
  NUK.vivas.length = 0; NUK.zonas = []; NUK.flash = NUK.flashI = NUK.flashT = 0; NUK.rad = 0; NUK.radAviso = false; NUK.radT = 0;
  const f = $('nukFlash'); if (f) { f.style.opacity = '0'; f.style.display = 'none'; }
  const g = $('nukRad'); if (g) g.style.opacity = '0';
  if (NUK.sons) { for (const s of NUK.sons.splice(0)) try { s.stop(); } catch (e) { /* ya terminó */ } }
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
  if (E.vol) return;   // (ésta va con volumen: nuclear_vol.js)
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
  // dos tandas: lo que está dentro de la vista del mapa (con profundidad) y lo de más allá (con una proyección más larga).
  // Lo de más allá va AL FONDO (depthRange 1..1 con LEQUAL): sólo se pinta donde no hay nada dibujado —el cielo— y lo tapa
  // cualquier cosa que esté delante. Antes iba sin profundidad y la nube se veía encima de los edificios, los cerros y los
  // objetos (Discord: «se sobreponen las explosiones sobre objetos»); en el celu pasaba casi siempre, porque la vista es corta
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
      gl.uniformMatrix4fv(P.u.uVP, false, vp); gl.enable(gl.DEPTH_TEST);
      if (cerca) { gl.depthRange(0, 1); gl.depthFunc(gl.LESS); } else { gl.depthRange(1, 1); gl.depthFunc(gl.LEQUAL); }
      gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, m * PART_F), gl.STREAM_DRAW);
      gl.blendFunc(gl.SRC_ALPHA, suma ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(P.u.uBri, suma ? 3 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, m);
    }
  }
  gl.depthRange(0, 1); gl.depthFunc(gl.LESS);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null); R.vaoAct = null;
}
