// ---------------------------------------------------------------------------------------------------------
// La noche en la pizzería (mapa RB_Pizzeria, de herramientas/pizzeria.py): de las 12 a las 6 con Freddy, Bonnie,
// Chica y Foxy (modelos y animaciones del pack Help Wanted de GMod), que salen del escenario y de Pirate Cove y vienen
// por los pasillos hasta las puertas de la oficina. Puertas y luces con botones (E) que gastan energía: si se acaba,
// se apaga todo y viene Freddy con la cajita de música. Cámaras de seguridad (G: la vista salta a cada una, con
// estática), linterna en primera persona (L), sustos en video y sonidos de "FNAF In Real Time". A las 6 se gana y
// empieza la noche siguiente (más difícil); si te agarran, se pierde (en una sala: quedás mirando las cámaras y se
// pierde cuando agarran a todos).
// En una sala la noche la maneja un solo jugador (el de id más chico de los que están; si se va, sigue el próximo con
// el último estado que llegó) y la manda a todos cuatro veces por segundo; los botones se le piden por la red.
// ---------------------------------------------------------------------------------------------------------
const NOC = { on: false, ctl: false, tCtl: 0, tRed: 0, rem: new Map(), noche: 1, hora: 0, poder: 100, estado: 'espera', estT: 0,
  puerta: { izq: false, der: false }, luz: { izq: false, der: false }, pk: { izq: 0, der: 0 }, cuerpoP: {}, mdP: {}, anim: [], fuera: new Set(),
  cam: null, camT: 0, linterna: false, susto: null, mirando: 0, videos: {}, ui: null, llamada: null, tAmb: 0 };
const NOC_HORA = 70;   // segundos por hora (la noche dura 7 minutos)
// caminos (validados contra paredes y muebles con el plano del mapa): escenario, comedor (pasillos entre las mesas),
// Pirate Cove, los dos pasillos hasta las esquinas de las puertas (izquierda: sd, derecha: nd) y la oficina
const NOC_N = { esc_f: [9.6, 0.2, 1.02], esc_b: [9.4, -1.8, 1.02], esc_c: [9.4, 2.2, 1.02], w0: [6.6, 0, 0.41], wN: [6.6, 7.8, 0.41], wS: [6.6, -6, 0.41],
  cN: [1.75, 7.8, 0.41], cM: [1.75, -1, 0.41], cS: [1.75, -6, 0.41], eN: [-3.4, 7.8, 0.41], eM: [-3.4, 3.3, 0.41], eC: [-3.4, -1, 0.41], eS: [-3.4, -3, 0.41], eSS: [-3.4, -6, 0.41],
  cov: [-0.3, -11, 1.02], cov_b: [-0.3, -8.6, 1.02], cov_s: [-0.3, -6.9, 0.41], n0: [-6.5, 3.3, 0.43], n1: [-12, 3.3, 0.43], n2: [-17.5, 3.3, 0.41], nd: [-22.4, 3.3, 0.41],
  s0: [-6.5, -3, 0.43], s1: [-12, -3, 0.43], s2: [-17.5, -3, 0.41], sd: [-22.4, -3, 0.41], ofi: [-22.6, 0, 0.41] };
const NOC_RUTA = { Freddy: ['esc_f', 'w0', 'wN', 'cN', 'cM', 'eC', 'eM', 'n0', 'n1', 'n2', 'nd'], Bonnie: ['esc_b', 'w0', 'wS', 'cS', 'eSS', 'eS', 's0', 's1', 's2', 'sd'],
  Chica: ['esc_c', 'w0', 'wN', 'cN', 'eN', 'eM', 'n0', 'n1', 'n2', 'nd'], Foxy: ['cov', 'cov_b', 'cov_s', 'eSS', 'eS', 's0', 's1', 's2', 'sd'] };
const NOC_LADO = { Freddy: 'der', Bonnie: 'izq', Chica: 'der', Foxy: 'izq' };
const NOC_VEL = { Freddy: 1.15, Bonnie: 1.45, Chica: 1.3, Foxy: 1.6 };   // caminando (m/s); persiguiendo, el doble (Foxy corre a 6,5)
const NOC_CADA = { Freddy: 3.0, Bonnie: 4.97, Chica: 4.98, Foxy: 5.01 };   // cada cuánto prueban moverse (como en FNAF 1)
// nivel (0 a 20) de cada uno por noche; a las 2, 3 y 4 suben uno
const NOC_NIVEL = [[1, 3, 2, 1], [2, 5, 4, 3], [4, 8, 6, 6], [7, 11, 10, 9], [10, 14, 13, 12], [15, 18, 17, 16]];
const NOC_ANIMS = ['Freddy', 'Bonnie', 'Chica', 'Foxy'];
// cámaras: cuál del mapa es cada una de FNAF 1 (vistas en las fotos de prueba); las de las esquinas apuntan a la puerta
const NOC_CAMS = [[6, '1A', 'fn.c1a'], [4, '1B', 'fn.c1b'], [5, '1C', 'fn.c1c'], [0, '2A', 'fn.c2a'], [1, '2B', 'fn.c2b', 'sd'], [9, '3', 'fn.c3'], [2, '4A', 'fn.c4a'], [3, '4B', 'fn.c4b', 'nd'], [7, '5', 'fn.c5'], [8, '7', 'fn.c7']];
const nocheActiva = () => NOC.on;
const enOficina = (p) => p.x < -20.4 && p.x > -25.3 && p.z > -2.05 && p.z < 2.05;

// ---------------- clips (float16 en el paquete: pos y giro locales de cada hueso por cuadro) ----------------
function h2f(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023;
  return e === 0 ? s * f * 5.960464477539063e-8 : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * Math.pow(2, e - 15);
}
function nocheClip(nom) {
  const c = DATA.fn && DATA.fn.clips[nom]; if (!c) return null;
  if (!c.f) {
    const n = c.nf * c.nb * 7, u = new Uint16Array(BIN.slice(c.o, c.o + n * 2).buffer), f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = h2f(u[i]);
    c.f = f; c.d = Math.max(1, c.nf - 1) / c.fps;
  }
  return c;
}
// pose de un clip en el tiempo t (interpolando cuadros) en buf (nb x 7)
function clipPose(c, t, buf) {
  const nf = c.nf, nb = c.nb, F = c.f; let x = t * c.fps;
  x = c.loop ? ((x % (nf - 1 || 1)) + (nf - 1 || 1)) % (nf - 1 || 1) : Math.min(x, nf - 1);
  const i0 = Math.floor(x), i1 = Math.min(nf - 1, i0 + 1), w = x - i0, a = i0 * nb * 7, b = i1 * nb * 7;
  for (let k = 0; k < nb * 7; k += 7) {
    for (let j = 0; j < 3; j++) buf[k + j] = F[a + k + j] + (F[b + k + j] - F[a + k + j]) * w;
    let d = 0; for (let j = 3; j < 7; j++) d += F[a + k + j] * F[b + k + j];
    const sg = d < 0 ? -1 : 1; let l = 0;
    for (let j = 3; j < 7; j++) { buf[k + j] = F[a + k + j] + (sg * F[b + k + j] - F[a + k + j]) * w; l += buf[k + j] * buf[k + j]; }
    l = Math.sqrt(l) || 1; for (let j = 3; j < 7; j++) buf[k + j] /= l;
  }
}

// ---------------- los animatrónicos ----------------
function nocheAnimCrear(nom) {
  const md = new Modelo(DATA.fn.pf[nom]), c = nocheClip(nom + ':quieto');
  const A = { nom, md, pos: v3(), yaw: 0, clip: 'quieto', ct: 0, prev: null, pt: 0, nb: c.nb, b0: new Float32Array(c.nb * 7), b1: new Float32Array(c.nb * 7),
    ruta: NOC_RUTA[nom], i: 0, camino: [], estado: 'quieto', tMov: Math.random() * NOC_CADA[nom], tEst: 0, presa: null, tVer: 0, fase: 0, meta: v3(), metaYaw: 0, tPaso: 0, pie: 0 };
  nocheAnimA(A, A.ruta[0]); return A;
}
function nocheAnimA(A, nodo) { const n = NOC_N[nodo]; A.nodo = nodo; A.i = Math.max(0, A.ruta.indexOf(nodo)); A.pos.set(n[0], n[2], n[1]); A.meta.copy(A.pos); A.camino = []; A.yaw = nodo.startsWith('esc') ? -Math.PI / 2 : nodo === 'cov' ? 0 : A.yaw; A.metaYaw = A.yaw; }
function nocheAnimClip(A, clip) {
  if (!DATA.fn.clips[A.nom + ':' + clip]) clip = clip === 'corre' ? 'camina' : clip === 'camina' ? 'corre' : 'quieto';
  if (A.clip === clip) return;
  A.prev = A.clip; A.pct = A.ct; A.pt = 0; A.clip = clip; A.ct = 0;
}
// la pose (con fundido de 0,25 s entre clips) y el lugar en el mundo
function nocheAnimPose(A, dt) {
  const c = nocheClip(A.nom + ':' + A.clip); A.ct += dt; clipPose(c, A.ct, A.b0);
  if (A.prev && A.pt < 0.25) {
    A.pt += dt; A.pct += dt; const w = Math.min(1, A.pt / 0.25), cp = nocheClip(A.nom + ':' + A.prev); clipPose(cp, A.pct, A.b1);
    for (let k = 0; k < A.nb * 7; k += 7) {
      for (let j = 0; j < 3; j++) A.b0[k + j] = A.b1[k + j] + (A.b0[k + j] - A.b1[k + j]) * w;
      let d = 0; for (let j = 3; j < 7; j++) d += A.b1[k + j] * A.b0[k + j]; const sg = d < 0 ? -1 : 1; let l = 0;
      for (let j = 3; j < 7; j++) { A.b0[k + j] = A.b1[k + j] + (sg * A.b0[k + j] - A.b1[k + j]) * w; l += A.b0[k + j] ** 2; }
      l = Math.sqrt(l) || 1; for (let j = 3; j < 7; j++) A.b0[k + j] /= l;
    }
  }
  const md = A.md;
  for (let k = 0; k < A.nb; k++) { const o = k * 7, p = md.p[k + 1], r = md.r[k + 1]; p[0] = A.b0[o]; p[1] = A.b0[o + 1]; p[2] = A.b0[o + 2]; r[0] = A.b0[o + 3]; r[1] = A.b0[o + 4]; r[2] = A.b0[o + 5]; r[3] = A.b0[o + 6]; }
  md.ponerRaizPQ(A.pos, Quat.axis(0, 1, 0, A.yaw), [1, 1, 1]);
}
function nocheIrA(A, nodo) {   // camino por el grafo (en orden de la ruta, o el más corto)
  const ady = nocheAdy(), prev = { [A.nodo]: null }, cola = [A.nodo];
  while (cola.length) { const x = cola.shift(); if (x === nodo) break; for (const y of ady[x] || []) if (!(y in prev)) { prev[y] = x; cola.push(y); } }
  if (!(nodo in prev)) return;
  const c = []; for (let x = nodo; x && x !== A.nodo; x = prev[x]) c.unshift(x);
  A.camino = c; A.estado = 'camina';
}
let _ady = null;
function nocheAdy() {
  if (_ady) return _ady;
  const E = [['esc_f', 'w0'], ['esc_b', 'w0'], ['esc_c', 'w0'], ['w0', 'wN'], ['w0', 'wS'], ['wN', 'cN'], ['wS', 'cS'], ['cN', 'cM'], ['cM', 'cS'], ['cN', 'eN'], ['cM', 'eC'], ['cS', 'eSS'], ['eN', 'eM'],
    ['eM', 'eC'], ['eC', 'eS'], ['eS', 'eSS'], ['eM', 'n0'], ['eS', 's0'], ['cov', 'cov_b'], ['cov_b', 'cov_s'], ['cov_s', 'eSS'], ['cov_s', 'cS'], ['n0', 'n1'], ['n1', 'n2'], ['n2', 'nd'],
    ['s0', 's1'], ['s1', 's2'], ['s2', 'sd'], ['sd', 'ofi'], ['nd', 'ofi']];
  _ady = {}; for (const [a, b] of E) { (_ady[a] = _ady[a] || []).push(b); (_ady[b] = _ady[b] || []).push(a); }
  return _ady;
}

// ---------------- empezar y terminar ----------------
function nocheIniciar() {
  if (!DATA.fn || !DATA.fn.pf) return;
  NOC.on = true; NOC.noche = 1; NOC.fuera.clear(); NOC.rem.clear(); NOC.ctl = false; NOC.tCtl = TIEMPO.t; NOC.linterna = false; NOC.cam = null; NOC.susto = null;
  NOC.anim = NOC_ANIMS.map(nocheAnimCrear);
  // las puertas de la oficina: su modelo, su caja de choque (arriba, lejos, mientras está abierta)
  for (const lado of ['izq', 'der']) {
    const P = DATA.fn.puertas[lado]; if (!P) continue;
    NOC.mdP[lado] = MUNDO.modelos.find((m) => m.A[0].n === 'FN_Puerta_' + lado) || null;
    const c = P.caja, b = new Body(boxShape(c[0] / 2 + 0.03, c[1] / 2, c[2] / 2 + 0.03), 0);
    b.pos.set(P.p[0], P.p[1] + 100, P.p[2]); b.updateWorld(); b.estatico = true; b.snd = 'metal';
    MUNDO.cajas.push(b); const a = b.aabb; grillaAgregar(a.x0, a.z0, a.x1, a.z1, b); NOC.cuerpoP[lado] = b;
  }
  // de noche, en la pizzería, sólo manos y cámara (y nada de cosas del menú: es para tener miedo)
  ARM.lista = ['Hands', 'Camera']; elegirArma(0);
  for (const n of ['fn_ventilador', 'fn_zumbido', 'fn_puerta', 'fn_golpe', 'fn_foxycorre', 'fn_apagon', 'fn_6am', 'fn_estatica', 'fn_blip', 'fn_tablet', 'fn_ambiente', 'fn_ninos',
    'fn_paso1', 'fn_paso2', 'fn_paso3', 'fn_risa', 'fn_ollas', 'fn_respira', 'fn_cajita', 'fn_grito', 'fn_corre1', 'fn_corre2', 'fn_llamada_es', 'fn_llamada_en']) audioBuf(n);
  nocheUI(); nocheEmpezarNoche(1);
}
function nocheFin() {
  if (!NOC.on) return;
  NOC.on = false; NOC.anim = []; nocheCamCerrar(); NOC.susto = null; document.body.classList.remove('fnSusto'); if (NOC.llamada) { try { NOC.llamada.stop(); } catch (e) {} NOC.llamada = null; }
  if (NOC.ui) NOC.ui.raiz.classList.add('oc');
}
function nocheEmpezarNoche(n) {
  NOC.noche = Math.max(1, Math.min(7, n)); NOC.hora = 0; NOC.poder = 100; NOC.estado = 'espera'; NOC.estT = 0; NOC.fuera.clear();
  NOC.puerta.izq = NOC.puerta.der = false; NOC.luz.izq = NOC.luz.der = false;
  for (const A of NOC.anim) { nocheAnimA(A, A.ruta[0]); A.estado = 'quieto'; A.fase = 0; A.presa = null; nocheAnimClip(A, 'quieto'); }
  nocheCamCerrar(); nocheCartel(T('fn.noche') + ' ' + NOC.noche, '12 AM', 4);
}
function nocheNivel(k) {
  const t = NOC_NIVEL[Math.min(NOC_NIVEL.length - 1, NOC.noche - 1)][k], h = Math.floor(NOC.hora);
  return Math.min(20, t + (h >= 2) + (h >= 3) + (h >= 4) + (NOC.noche >= 7 ? 20 : 0));
}

// ---------------- ¿quién maneja la noche? ----------------
function nocheManejo() {
  if (typeof SALA === 'undefined' || !SALA || !RED.on) return true;
  const t = TIEMPO.t;
  for (const [id, x] of NOC.rem) { if (!RED.remotos.has(id)) { NOC.rem.delete(id); continue; } if (t - x < 2.5 && (!NOC.ctl || id < RED.ID)) return false; }   // (los que se fueron no cuentan)
  if (NOC.ctl) return true;
  let antes = 0; for (const id of RED.remotos.keys()) if (id < RED.ID) antes++;
  return t - NOC.tCtl > 3 + 2 * antes;
}
function nocheJugadores() {   // yo y los de la sala (con dónde están), sin los que ya agarraron
  const L = [{ id: typeof RED !== 'undefined' && RED.on ? RED.ID : 'yo', pos: JUG.pos, yo: true }];
  if (typeof RED !== 'undefined' && RED.on) for (const R2 of RED.remotos.values()) L.push({ id: R2.id, pos: R2.pos, yo: false });
  return L;
}
const miId = () => (typeof RED !== 'undefined' && RED.on ? RED.ID : 'yo');

// ---------------- cada cuadro ----------------
function nochePaso(dt) {
  const debe = JUEGO.estado === 'juego' && MUNDO.nombre === 'RB_Pizzeria';
  if (debe && !NOC.on) nocheIniciar(); else if (!debe && NOC.on) nocheFin();
  if (!NOC.on) return;
  NOC.ctl = nocheManejo();
  if (NOC.ctl) nocheLogica(dt);
  // puertas: se mueven solas hasta donde dice el estado (y chocan cuando están casi cerradas)
  for (const lado of ['izq', 'der']) {
    const P = DATA.fn.puertas[lado]; if (!P) continue;
    const cerr = NOC.puerta[lado] && NOC.estado !== 'apagon', meta = cerr ? 1 : 0, k0 = NOC.pk[lado];
    NOC.pk[lado] += Math.sign(meta - k0) * Math.min(Math.abs(meta - k0), dt * 3.2);
    const md = NOC.mdP[lado]; if (md) { md.p[0][1] = P.p[1] + (1 - NOC.pk[lado]) * (P.alto + 0.05); md.sucio = true; }
    const b = NOC.cuerpoP[lado]; if (b) { const y = P.p[1] + (NOC.pk[lado] > 0.55 ? 0 : 100); if (b.pos.y !== y) { b.pos.y = y; b.updateWorld(); } }
  }
  // animatrónicos: los que maneja otro se acercan a lo último que llegó
  for (const A of NOC.anim) {
    if (!NOC.ctl) {
      const k = 1 - Math.exp(-dt * 8); A.pos.lerpTo(A.meta, k);
      let dy = A.metaYaw - A.yaw; dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; A.yaw += dy * k;
    }
    nocheAnimPose(A, dt); nocheAnimSonidos(A, dt);
  }
  nocheSonidos(dt); nocheAmbiente(); nocheHUD();
  if (NOC.cam !== null && UI.abierto !== 'fncam') nocheCamCerrar();
  if (NOC.susto) nocheSustoPaso(dt);
  // la red: el que maneja manda el estado; los demás, nada (los botones se piden al tocarlos)
  if (NOC.ctl && typeof RED !== 'undefined' && RED.on && TIEMPO.t - NOC.tRed > 0.25) { NOC.tRed = TIEMPO.t; publicar('a', nocheEstadoRed()); }
}
// lo que decide el que maneja: la hora, la energía, los animatrónicos, quién se salva
function nocheLogica(dt) {
  if (NOC.quieta) return;   // (pruebas: todo quieto)
  NOC.estT += dt;
  if (NOC.estado === 'espera') { if (NOC.estT > 5) { NOC.estado = 'juega'; NOC.estT = 0; nocheLlamada(); } return; }
  if (NOC.estado === 'gano' || NOC.estado === 'perdio') { if (NOC.estT > 9) nocheEmpezarNoche(NOC.estado === 'gano' ? NOC.noche + 1 : NOC.noche); return; }
  NOC.hora += dt / NOC_HORA;
  if (NOC.hora >= 6) { nocheTerminar('gano'); return; }
  // energía: lo de siempre + cada puerta cerrada, cada luz y las cámaras (si alguien las mira)
  if (NOC.estado === 'juega') {
    const uso = nocheUso(); NOC.poder -= dt * (0.1 + 0.13 * (uso - 1 - (NOC.mirando ? 1 : 0)) + (NOC.mirando ? 0.06 : 0));
    if (NOC.poder <= 0) { NOC.poder = 0; NOC.estado = 'apagon'; NOC.estT = 0; NOC.luz.izq = NOC.luz.der = false; NOC.puerta.izq = NOC.puerta.der = false; sonar('fn_apagon', null, 0.9); nocheMandarEvento('apagon'); }
  }
  if (NOC.estado === 'apagon') { nocheApagonPaso(); return; }
  const J = nocheJugadores().filter((x) => !NOC.fuera.has(x.id));
  // agarraron a todos los que quedan (solo: a vos): se pierde, después de dejar ver el susto
  if (!J.length) { if ((NOC.todosFueraT = (NOC.todosFueraT || 0) + dt) > 3.2) { NOC.todosFueraT = 0; nocheTerminar('perdio'); } return; }
  NOC.todosFueraT = 0;
  for (let k = 0; k < NOC.anim.length; k++) nocheIA(NOC.anim[k], k, dt, J);
}
function nocheUso() { return 1 + (NOC.puerta.izq ? 1 : 0) + (NOC.puerta.der ? 1 : 0) + (NOC.luz.izq ? 1 : 0) + (NOC.luz.der ? 1 : 0) + (NOC.mirando ? 1 : 0); }
function nocheTerminar(e) {
  NOC.estado = e; NOC.estT = 0;
  for (const A of NOC.anim) { nocheAnimA(A, A.ruta[0]); A.estado = 'quieto'; nocheAnimClip(A, 'quieto'); }
  nocheMandarEvento(e); nocheFinal(e);
}
// ---------------- inteligencia (sólo el que maneja) ----------------
function nocheIA(A, k, dt, J) {
  const lado = NOC_LADO[A.nom], vel = NOC_VEL[A.nom];
  A.tEst += dt;
  // ¿hay alguien cerca y a la vista fuera de la oficina? lo persigue
  if ((A.tVer -= dt) <= 0) {
    A.tVer = 0.3; let mejor = null, dm = A.nom === 'Foxy' && A.fase < 3 ? 0 : 7.5;
    for (const j of J) {
      if (enOficina(j.pos)) continue;
      const d = j.pos.distTo(A.pos); if (d > dm) continue;
      const o = vadd(A.pos, v3(0, 1.6, 0)), dv = vsub(vadd(j.pos, v3(0, 0.4, 0)), o), l = dv.len();
      if (!mundoRayo(o, vscale(dv, 1 / l), l - 0.3)) { mejor = j; dm = d; }
    }
    if (mejor) { A.presa = mejor.id; A.tPresa = 0; A.estado = 'caza'; }
    else if (A.estado === 'caza' && (A.tPresa += 0.3) > 2.5) { A.presa = null; A.estado = 'vuelve'; nocheIrA(A, nocheMasCerca(A.pos)); }
  }
  if (A.estado === 'caza') {
    const j = J.find((x) => x.id === A.presa); if (!j || enOficina(j.pos)) { A.estado = 'vuelve'; A.presa = null; nocheIrA(A, nocheMasCerca(A.pos)); return; }
    const dv = vsub(j.pos, A.pos); dv.y = 0; const d = dv.len();
    if (d < 1.15) { nocheAgarrar(A, j.id); return; }
    const v = A.nom === 'Foxy' ? 6.5 : vel * 1.9; A.pos.addS(dv, Math.min(d, v * dt) / d); nocheAnimClip(A, A.nom === 'Foxy' ? 'corre' : 'camina');
    A.pos.y = nocheAltura(A.pos, A.pos.y); A.yaw = Math.atan2(dv.x, dv.z); return;
  }
  // caminando a un punto del grafo
  if (A.camino.length) {
    const n = NOC_N[A.camino[0]], m = v3(n[0], n[2], n[1]), dv = vsub(m, A.pos), d = Math.hypot(dv.x, dv.z);
    const v = A.nom === 'Foxy' && A.fase >= 3 ? 6.5 : vel;
    if (d < 0.05) { A.nodo = A.camino.shift(); A.i = Math.max(A.i, A.ruta.indexOf(A.nodo)); if (!A.camino.length) { A.estado = A.nodo === 'sd' || A.nodo === 'nd' ? 'puerta' : A.nodo === 'ofi' ? 'oficina' : 'quieto'; A.tEst = 0; nocheAnimClip(A, 'quieto'); } return; }
    const s = Math.min(d, v * dt) / d; A.pos.x += dv.x * s; A.pos.z += dv.z * s; A.pos.y += (m.y - A.pos.y) * Math.min(1, s * 1.2);
    let dy = Math.atan2(dv.x, dv.z) - A.yaw; dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; A.yaw += dy * Math.min(1, dt * 7);
    nocheAnimClip(A, v > 3 ? 'corre' : 'camina'); return;
  }
  if (A.estado === 'puerta') {   // en la esquina de la puerta: si está cerrada se vuelve; si no, entra
    if (A.nom === 'Foxy') {
      if (NOC.puerta[lado]) { sonar('fn_golpe', nocheP('sd'), 1); setTimeout(() => sonar('fn_golpe', nocheP('sd'), 1), 260); setTimeout(() => sonar('fn_golpe', nocheP('sd'), 1), 520); nocheMandarEvento('golpe');
        NOC.poder = Math.max(0, NOC.poder - 2 - 4 * Math.random()); A.fase = 0; nocheAnimA(A, 'cov'); A.estado = 'quieto'; }
      else { A.estado = 'entra'; nocheIrA(A, 'ofi'); }
      return;
    }
    if (NOC.puerta[lado] && A.tEst > 3 + Math.random() * 4) { A.estado = 'vuelve'; nocheIrA(A, A.ruta[Math.max(2, A.i - 3 - ((Math.random() * 3) | 0))]); return; }
    if (!NOC.puerta[lado] && A.tEst > 2.6) { nocheIrA(A, 'ofi'); A.estado = 'entra'; }
    return;
  }
  if (A.estado === 'oficina' || A.estado === 'entra') {   // adentro: agarra al que esté más cerca en la oficina
    const j = J.filter((x) => enOficina(x.pos)).sort((a, b) => a.pos.distTo(A.pos) - b.pos.distTo(A.pos))[0];
    if (j) { nocheAgarrar(A, j.id); return; }
    if (A.tEst > 4) { A.estado = 'vuelve'; nocheIrA(A, A.ruta[2]); }
    return;
  }
  // quieto: cada tanto prueba avanzar (Freddy no se mueve si alguien lo está mirando; Foxy sale por etapas)
  if ((A.tMov -= dt) > 0) return;
  A.tMov = NOC_CADA[A.nom];
  if (1 + Math.floor(Math.random() * 20) > nocheNivel(k)) return;
  if (A.nom === 'Freddy' && nocheMirado(A)) return;
  if (A.nom === 'Foxy') { if (A.nodo === 'cov' && A.fase < 3) { A.fase++; if (A.fase === 3) { sonar('fn_foxycorre', A.pos, 1); nocheIrA(A, 'sd'); nocheMandarEvento('foxy'); } } return; }
  const sig = A.ruta[Math.min(A.ruta.length - 1, A.i + 1)];
  if (sig && sig !== A.nodo) { nocheIrA(A, sig); if (A.nom === 'Freddy' && Math.random() < 0.5) sonar('fn_risa', A.pos, 0.8); }
  else if (A.nom === 'Chica' && Math.random() < 0.3) sonar('fn_ollas', A.pos, 0.6);
}
const nocheP = (n) => v3(NOC_N[n][0], NOC_N[n][2] + 1, NOC_N[n][1]);
function nocheMasCerca(p) { let m = null, dm = 1e9; for (const n in NOC_N) { if (n === 'ofi') continue; const q = NOC_N[n], d = Math.hypot(q[0] - p.x, q[1] - p.z); if (d < dm) { dm = d; m = n; } } return m; }
function nocheAltura(p, y0) { const h = mundoRayo(v3(p.x, y0 + 1, p.z), v3(0, -1, 0), 3); return h ? y0 + 1 - h.t : y0; }
// ¿alguien lo está mirando? (con los ojos o por una cámara)
function nocheMirado(A) {
  const c = vadd(A.pos, v3(0, 1.4, 0));
  const ve = (o, f) => { const dv = vsub(c, o), l = dv.len(); if (l > 24 || vdot(dv, f) / l < 0.75) return false; return !mundoRayo(o, vscale(dv, 1 / l), l - 0.4); };
  if (ve(CAM.pos, CAM.fwd)) return true;
  if (typeof RED !== 'undefined' && RED.on) for (const R2 of RED.remotos.values()) { const o = vadd(R2.pos, v3(0, 0.6, 0)); if (ve(o, Quat.euler(R2.yaw, R2.P.mira || 0).rot(v3(0, 0, 1)))) return true; }
  return false;
}
function nocheAgarrar(A, id) {
  A.estado = 'susto'; nocheAnimClip(A, 'susto');
  setTimeout(() => { if (!NOC.on) return; A.estado = 'vuelve'; A.presa = null; nocheAnimA(A, A.ruta[0]); A.estado = 'quieto'; nocheAnimClip(A, 'quieto'); }, 2600);
  NOC.fuera.add(id);
  if (id === miId()) nocheSusto(A.nom); else if (typeof RED !== 'undefined' && RED.on) publicar('a', { k: 'fnx', to: id, a: A.nom });
}
// apagón: Freddy aparece en la puerta izquierda con la cajita de música, se apaga todo y asusta a todos
function nocheApagonPaso() {
  const t = NOC.estT, F = NOC.anim[0];
  if (t > 3 && F.nodo !== 'sd') { nocheAnimA(F, 'sd'); F.yaw = 0; F.estado = 'apagon'; sonar('fn_cajita', nocheP('sd'), 1); nocheMandarEvento('cajita'); }
  if (t > 15) {
    for (const j of nocheJugadores()) if (!NOC.fuera.has(j.id)) { NOC.fuera.add(j.id); if (j.yo) nocheSusto('apagon'); else if (RED.on) publicar('a', { k: 'fnx', to: j.id, a: 'apagon' }); }
    NOC.estado = 'perdiendo'; setTimeout(() => { if (NOC.on && NOC.estado === 'perdiendo') nocheTerminar('perdio'); }, 3000);
  }
}

// ---------------- botones, puertas, luces (E) ----------------
// los botones del mapa: dos por lado (arriba la puerta, abajo la luz)
function nocheBotones() {
  if (NOC.bts) return NOC.bts;
  const B = (DATA.fn.botones || []).map((p) => v3(p[0], p[1], p[2])), out = [];
  for (const lado of ['izq', 'der']) {
    const L = B.filter((p) => (lado === 'izq' ? p.z < 0 : p.z > 0)).sort((a, b) => b.y - a.y);
    if (L[0]) out.push({ p: L[0], que: 'puerta', lado }); if (L[1]) out.push({ p: L[1], que: 'luz', lado });
  }
  return (NOC.bts = out);
}
function nocheApuntado() {
  if (!NOC.on || NOC.cam !== null) return null;
  let mejor = null, dm = 0.16;
  for (const b of nocheBotones()) {
    const dv = vsub(b.p, CAM.pos), t = vdot(dv, CAM.fwd); if (t < 0.2 || t > 2.6) continue;
    const d = vsub(dv, vscale(CAM.fwd, t)).len(); if (d < dm) { dm = d; mejor = b; }
  }
  return mejor;
}
function nocheApunta() { const b = nocheApuntado(); return b ? 'E: ' + T(b.que === 'puerta' ? 'fn.puerta' : 'fn.luz') : ''; }
function nocheUsar() {
  const b = nocheApuntado(); if (!b) return false;
  sonar('Click', b.p, 0.8);
  if (NOC.ctl) nocheBoton(b.que, b.lado); else publicar('a', { k: 'fnb', q: b.que, l: b.lado });
  return true;
}
function nocheBoton(que, lado) {
  if (NOC.estado === 'apagon' || NOC.estado === 'perdiendo') { sonar('fn_blip', nocheBotones()[0].p, 0.6); return; }
  if (que === 'puerta') { NOC.puerta[lado] = !NOC.puerta[lado]; sonar('fn_puerta', v3(...DATA.fn.puertas[lado].p), 1); nocheMandarEvento('puerta_' + lado); }
  else NOC.luz[lado] = !NOC.luz[lado];
  NOC.tRed = 0;
}

// ---------------- red ----------------
function nocheEstadoRed() {
  return { k: 'fnn', n: NOC.noche, h: +NOC.hora.toFixed(3), p: +NOC.poder.toFixed(2), e: NOC.estado, et: +NOC.estT.toFixed(2), pu: [NOC.puerta.izq ? 1 : 0, NOC.puerta.der ? 1 : 0],
    lu: [NOC.luz.izq ? 1 : 0, NOC.luz.der ? 1 : 0], fu: [...NOC.fuera], m: NOC.mirando ? 1 : 0,
    a: NOC.anim.map((A) => [r3(A.pos.x), r3(A.pos.y), r3(A.pos.z), r3(A.yaw), A.clip, A.nodo, A.estado, A.fase, A.i]) };
}
function nocheMandarEvento(e) { if (NOC.ctl && typeof RED !== 'undefined' && RED.on) publicar('a', { k: 'fne', e }); }
function nocheRed(d) {
  if (!NOC.on) return;
  if (d.k === 'fnn') {
    NOC.rem.set(d.i, TIEMPO.t); NOC.tCtl = TIEMPO.t; if (NOC.ctl && d.i > RED.ID) return;   // (dos manejando a la vez: gana el de id más chico)
    const antes = NOC.estado;
    NOC.noche = num(d.n, 1, 7, 1) | 0; NOC.hora = num(d.h, 0, 6, 0); NOC.poder = num(d.p, 0, 100, 100); NOC.estado = String(d.e || 'juega').slice(0, 12); NOC.estT = num(d.et, 0, 1e4, 0);
    if (Array.isArray(d.pu)) { NOC.puerta.izq = !!d.pu[0]; NOC.puerta.der = !!d.pu[1]; } if (Array.isArray(d.lu)) { NOC.luz.izq = !!d.lu[0]; NOC.luz.der = !!d.lu[1]; }
    NOC.fuera = new Set(Array.isArray(d.fu) ? d.fu.filter((x) => typeof x === 'string').slice(0, 64) : []); NOC.mirandoRed = !!d.m;
    if (Array.isArray(d.a)) d.a.forEach((x, k) => {
      const A = NOC.anim[k]; if (!A || !Array.isArray(x)) return;
      A.meta.set(num(x[0], -1e3, 1e3, 0), num(x[1], -50, 50, 0), num(x[2], -1e3, 1e3, 0)); A.metaYaw = num(x[3], -50, 50, 0);
      if (A.meta.distTo(A.pos) > 6) A.pos.copy(A.meta);
      if (typeof x[4] === 'string') nocheAnimClip(A, x[4]); if (typeof x[5] === 'string' && NOC_N[x[5]]) A.nodo = x[5];
      A.estado = String(x[6] || 'quieto').slice(0, 10); A.fase = x[7] | 0; A.i = x[8] | 0;
    });
    if (antes !== NOC.estado && (NOC.estado === 'gano' || NOC.estado === 'perdio')) nocheFinal(NOC.estado);
    if (antes !== NOC.estado && NOC.estado === 'espera') { nocheCamCerrar(); nocheCartel(T('fn.noche') + ' ' + NOC.noche, '12 AM', 4); }
    if (antes === 'espera' && NOC.estado === 'juega') nocheLlamada();
  } else if (d.k === 'fnb' && NOC.ctl) nocheBoton(d.q === 'luz' ? 'luz' : 'puerta', d.l === 'der' ? 'der' : 'izq');
  else if (d.k === 'fnx' && d.to === RED.ID) nocheSusto(['Freddy', 'Bonnie', 'Chica', 'Foxy', 'apagon'].includes(d.a) ? d.a : 'Freddy');
  else if (d.k === 'fne') {   // sonidos de lo que pasa (los decide el que maneja)
    if (d.e === 'apagon') sonar('fn_apagon', null, 0.9);
    else if (d.e === 'cajita') sonar('fn_cajita', nocheP('sd'), 1);
    else if (d.e === 'golpe') for (let i = 0; i < 3; i++) setTimeout(() => sonar('fn_golpe', nocheP('sd'), 1), i * 260);
    else if (d.e === 'foxy') sonar('fn_foxycorre', NOC.anim[3] ? NOC.anim[3].pos : null, 1);
    else if (/^puerta_(izq|der)$/.test(d.e)) sonar('fn_puerta', v3(...DATA.fn.puertas[d.e.slice(7)].p), 1);
  }
}
const nocheBits = () => (NOC.on && NOC.linterna ? 128 : 0);

// ---------------- luces ----------------
const _luzF = v3();
function nocheLuces() {
  if (!NOC.on) return;
  const apagon = NOC.estado === 'apagon' || NOC.estado === 'perdiendo', t = TIEMPO.t;
  if (!apagon) {
    for (const L of DATA.fn.luces) {
      if (L.d || Math.abs(L.p[0] - CAM.pos.x) > 26 || Math.abs(L.p[2] - CAM.pos.z) > 26) continue;
      const k = 0.55 * (0.92 + 0.08 * Math.sin(t * 13 + L.p[0] * 7) * Math.sin(t * 3.1 + L.p[2]));
      luzPuntual(v3(L.p[0], L.p[1], L.p[2]), L.r, [L.c[0] * k, L.c[1] * k, L.c[2] * k]);
    }
    luzPuntual(v3(-23.2, 3.1, 0), 6.5, [1.25, 1.18, 1.0]);   // la lámpara de la oficina
    for (const lado of ['izq', 'der']) if (NOC.luz[lado]) { const s = lado === 'izq' ? -1 : 1; luzPuntual(v3(-22.4, 3.2, 2.4 * s), 6, [3.2, 3.0, 2.6], v3(0, -0.85, 0.52 * s).norm(), 0.55); }
  } else if (NOC.estado === 'apagon' && NOC.estT > 4 && NOC.estT < 14 && Math.sin(t * 9) * Math.sin(t * 2.3) > 0.1) {
    luzPuntual(v3(-22.4, 2.4, -2.9), 2.2, [1.4, 1.2, 0.8]);   // la cara de Freddy titila con la música
  }
  if (NOC.susto && NOC.susto.tres && !NOC.susto.est) luzPuntual(vadd(CAM.pos, v3(0, 0.4, 0)), 5, [3.2, 3, 2.6]);
  // linternas: la mía y la de los demás
  if (NOC.linterna && NOC.cam === null) { _luzF.copy(CAM.fwd); luzPuntual(vadd(CAM.pos, vscale(CAM.fwd, 0.25)), 16, [3.4, 3.2, 2.8], _luzF.clone(), Math.cos(0.36)); }
  if (typeof RED !== 'undefined' && RED.on) for (const R2 of RED.remotos.values()) {
    if (!(R2.f & 128)) continue;
    const f = Quat.euler(R2.yaw, R2.P.mira || 0).rot(v3(0, 0, 1)); luzPuntual(vadd(R2.pos, v3(0, 0.55, 0)), 14, [3, 2.85, 2.5], f, Math.cos(0.36));
  }
}
// sin luces puntuales (calidades bajas) la oscuridad sería total: se levanta un poco el ambiente
function nocheAmbiente() {
  const sinLuces = !(GFX.nluz > 0) || GFX.luz < 2, apagon = NOC.estado === 'apagon' || NOC.estado === 'perdiendo';
  const base = NOC.cam !== null ? (sinLuces ? 0.32 : 0.22) : sinLuces ? (apagon ? 0.05 : NOC.linterna ? 0.24 : 0.15) : apagon ? 0.012 : 0.06;   // (las cámaras ven en la oscuridad, como las infrarrojas)
  R.ambS = [base, base, base * 1.25]; R.ambG = [base * 0.7, base * 0.7, base * 0.85];
}

// ---------------- sonidos ----------------
function nocheSonidos(dt) {
  const apagon = NOC.estado === 'apagon' || NOC.estado === 'perdiendo';
  if (!apagon) bucle('fn_vent', 'fn_ventilador', v3(-19.5, 1.6, 0.4), 0.55);
  for (const lado of ['izq', 'der']) if (NOC.luz[lado] && !apagon) bucle('fn_luz_' + lado, 'fn_zumbido', v3(-22.4, 3, lado === 'izq' ? -2.4 : 2.4), 0.5);
  bucle('fn_amb', 'fn_ambiente', null, 0.22);
  if (NOC.cam !== null) bucle('fn_est', 'fn_estatica', null, 0.12);
  if ((NOC.tAmb -= dt) <= 0) { NOC.tAmb = 25 + Math.random() * 40; if (NOC.estado === 'juega' && Math.random() < 0.5) sonar('fn_ninos', nocheP(Math.random() < 0.5 ? 'cN' : 'w0'), 0.35); }
}
function nocheAnimSonidos(A, dt) {
  const camina = A.clip === 'camina' || A.clip === 'corre'; if (!camina) return;
  if ((A.tPaso -= dt) > 0) return;
  A.tPaso = A.clip === 'corre' ? 0.28 : 0.62; A.pie++;
  sonar(A.clip === 'corre' ? (A.pie % 2 ? 'fn_corre1' : 'fn_corre2') : ['fn_paso1', 'fn_paso2', 'fn_paso3'][A.pie % 3], A.pos, A.clip === 'corre' ? 0.9 : 0.75, 0.9 + Math.random() * 0.15);
}
function nocheLlamada() {
  if (NOC.noche !== 1 || NOC.llamada) return;
  const es = /^es/.test(PREFS.lang || PREFS.idioma || 'es');
  NOC.llamada = sonar(es ? 'fn_llamada_es' : 'fn_llamada_en', v3(-24.3, 1.4, -0.6), 0.85);
  if (NOC.llamada) NOC.llamada.onended = () => (NOC.llamada = null);
}

// ---------------- dibujo ----------------
function nocheDibujar() { if (!NOC.on) return; for (const A of NOC.anim) A.md.encolar(); if (NOC.susto && NOC.susto.tres && !NOC.susto.est) NOC.susto.tres.md.encolar(); }

// ---------------- cámaras de seguridad (G) ----------------
function nocheTablet() {
  if (!NOC.on) return;
  if (NOC.cam !== null) { if (NOC.fuera.has(miId()) && NOC.estado === 'juega') return; cerrarPaneles(); return; }
  if (UI.abierto) return;
  NOC.cam = NOC.camUlt || 0; UI.abierto = 'fncam'; soltarPuntero(); NOC.ui.cam.classList.remove('oc'); NOC.camT = 0; document.body.classList.add('fnCam');
  sonar('fn_tablet', null, 0.7); nocheCamPintar();
}
function nocheCamElegir(i) { NOC.cam = NOC.camUlt = i; NOC.camT = 0; sonar('fn_blip', null, 0.6); nocheCamPintar(); }
function nocheCamCerrar() { if (NOC.cam === null) return; NOC.cam = null; document.body.classList.remove('fnCam'); if (NOC.ui) NOC.ui.cam.classList.add('oc'); if (UI.abierto === 'fncam') UI.abierto = null; sonar('fn_tablet', null, 0.5, 0.8); }
function nocheCamara(out, dt) {
  if (!NOC.on || NOC.cam === null) return;
  const k = NOC_CAMS[NOC.cam], c = DATA.fn.camaras[k[0]]; if (!c) return;
  NOC.camT += dt;
  let f = c.f; if (k[3]) { const n = NOC_N[k[3]], d = v3(n[0] - c.p[0], n[2] + 0.9 - c.p[1], n[1] - c.p[2]).norm(); f = [d.x, d.y, d.z]; }
  const yaw0 = Math.atan2(f[0], f[2]), pitch = Math.asin(-f[1]) + (k[3] ? 0 : 0.08), gira = Math.sin(NOC.camT * 0.35) * (k[3] ? 0.12 : 0.32);   // (se va moviendo de un lado al otro, como en FNAF)
  out.pos.set(c.p[0], c.p[1], c.p[2]); out.q.copy(Quat.euler(yaw0 + gira, pitch, 0));
}
function nocheCamPintar() {
  const U = NOC.ui; if (!U) return; const k = NOC_CAMS[NOC.cam];
  U.camTit.innerHTML = 'CAM ' + k[1] + '<small>' + esc(T(k[2])) + '</small>';
  U.camMapa.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('sel', +b.dataset.c === NOC.cam));
}

// ---------------- linterna (L) ----------------
function nocheLinterna() { if (!NOC.on) return; NOC.linterna = !NOC.linterna; sonar('Click', null, 0.5, NOC.linterna ? 1.2 : 0.9); NOC.ui.lin.classList.toggle('on', NOC.linterna); }

// ---------------- sustos ----------------
function nocheSusto(quien) {
  if (NOC.susto) return;
  nocheCamCerrar(); cerrarPaneles();
  const nom = quien === 'apagon' ? 'fn_susto_apagon' : 'fn_susto_' + quien.toLowerCase(), v = NOC.ui.video;
  NOC.ui.susto.classList.remove('oc', 'est', 'tres'); NOC.susto = { t: 0, fin: false };
  // si el navegador no puede con el video: el animatrónico de verdad, en 3D, saltándote encima
  const tres = () => { const S = NOC.susto; if (!S || S.tres || S.est) return; S.tres = nocheAnimCrear(quien === 'apagon' ? 'Freddy' : quien); nocheAnimClip(S.tres, 'susto'); S.tres.prev = null; S.t = 0; NOC.ui.susto.classList.add('tres'); sonar('fn_grito', null, 1); };
  v.onerror = tres;
  if (!v.canPlayType('video/mp4')) tres();
  else { v.src = PK.url('v:' + nom, 'video/mp4'); v.currentTime = 0; v.muted = !PREFS.vol; v.volume = Math.min(1, (PREFS.vol || 0) / 100 * 1.2); const p = v.play(); if (p && p.catch) p.catch(tres); }
  CAM.temblor = 1.4; UI.abierto = 'fnsusto'; document.body.classList.add('fnSusto');
}
function nocheSustoPaso(dt) {
  const S = NOC.susto, v = NOC.ui.video; S.t += dt;
  if (S.tres) {   // delante de la cámara, con la cabeza a la altura de los ojos, mirándote
    if (!S.f) S.f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm();   // (la animación del susto ya trae el salto hacia adelante)
    const f = S.f, A = S.tres; A.pos.copy(CAM.pos).addS(f, A.nom === 'Foxy' ? 3.7 : 1.7); A.pos.y -= 1.85; A.yaw = Math.atan2(-f.x, -f.z);   // (Foxy salta 2,25 m)
    nocheAnimPose(A, dt);
  }
  if (!S.est && (S.tres ? S.t > 1.7 : v.ended || S.t > 2.6)) { S.est = true; S.t = 0; NOC.ui.susto.classList.add('est'); sonar('fn_estatica', null, 0.5); }
  if (S.est && S.t > 2.2) {
    NOC.susto = null; NOC.ui.susto.classList.add('oc'); document.body.classList.remove('fnSusto'); if (UI.abierto === 'fnsusto') UI.abierto = null;
    // en una sala, el que agarraron mira las cámaras hasta que termina la noche
    if (NOC.fuera.has(miId()) && typeof SALA !== 'undefined' && SALA && nocheJugadores().length > 1 && NOC.estado === 'juega') { nocheTablet(); aviso(T('fn.mirar'), 5); }
  }
}
function nocheFinal(e) {
  if (e === 'gano') { sonar('fn_6am', null, 0.9); setTimeout(() => sonar('fn_ninos', null, 0.6), 2500); nocheCartel('6 AM', T('fn.gano'), 7); }
  else nocheCartel(T('fn.perdiste'), T('fn.noche') + ' ' + NOC.noche, 6);
  nocheCamCerrar();
}
function nocheCartel(a, b, s) {
  const U = NOC.ui; if (!U) return;
  U.cartel.innerHTML = '<b>' + esc(a) + '</b><small>' + esc(b) + '</small>'; U.cartel.classList.remove('oc'); U.cartel.classList.add('ve');
  clearTimeout(U.tCartel); U.tCartel = setTimeout(() => U.cartel.classList.remove('ve'), s * 1000);
}

// ---------------- pantalla: hora, noche, energía, botones, cámaras, sustos ----------------
function nocheUI() {
  if (NOC.ui) { NOC.ui.raiz.classList.remove('oc'); return; }
  const st = document.createElement('style');
  st.textContent = `#fnRaiz{position:fixed;inset:0;pointer-events:none;z-index:6;font-family:inherit;color:#e8e8e8}
#fnRaiz.oc{display:none}
#fnHora{position:absolute;top:calc(env(safe-area-inset-top) + 58px);right:calc(env(safe-area-inset-right) + 14px);text-align:right;text-shadow:0 1px 3px #000}
#fnHora b{display:block;font-size:30px;letter-spacing:1px}#fnHora small{font-size:14px;opacity:.85}
#fnPoder{position:absolute;left:calc(env(safe-area-inset-left) + 12px);bottom:calc(env(safe-area-inset-bottom) + 34px);font-size:14px;text-shadow:0 1px 3px #000}
#fnPoder i{display:inline-block;width:9px;height:14px;margin-right:2px;background:#5ad35a;vertical-align:-2px}#fnPoder i.r{background:#e2c33b}#fnPoder i.rr{background:#e04a3a}
#fnBtns{position:absolute;right:calc(env(safe-area-inset-right) + 14px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:10px;pointer-events:auto}
#fnBtns div{width:46px;height:46px;border-radius:50%;background:rgba(20,22,28,.72);display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid transparent}
#fnBtns div.on{border-color:#f2d36b}#fnBtns svg{width:24px;height:24px}#fnBtns small{position:absolute;margin-top:56px;font-size:10px;opacity:.7}
#fnCam{position:absolute;inset:0;pointer-events:auto}#fnCam.oc{display:none}
#fnRuido{position:absolute;inset:0;width:100%;height:100%;opacity:.07;mix-blend-mode:screen;image-rendering:pixelated}
#fnCam:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.1) 0 2px,transparent 2px 4px);pointer-events:none}
#fnCamTit{position:absolute;left:calc(env(safe-area-inset-left) + 22px);top:calc(env(safe-area-inset-top) + 64px);font-size:30px;text-shadow:0 1px 3px #000}
#fnCamTit small{display:block;font-size:15px;opacity:.85}
#fnRec{position:absolute;left:calc(env(safe-area-inset-left) + 24px);top:calc(env(safe-area-inset-top) + 40px);width:14px;height:14px;border-radius:50%;background:#e33;animation:fnRec 1s steps(2) infinite}
@keyframes fnRec{50%{opacity:0}}
#fnMapa{position:absolute;right:calc(env(safe-area-inset-right) + 14px);bottom:calc(env(safe-area-inset-bottom) + 14px);width:250px;height:190px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25)}
#fnMapa i{position:absolute;background:rgba(255,255,255,.14)}
#fnMapa b{position:absolute;transform:translate(-50%,-50%);font-size:11px;padding:3px 5px;background:#3c3f46;border:1px solid #9aa;cursor:pointer;font-weight:normal}
#fnMapa b.sel{background:#3d8d3d}
#fnCerrar{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 14px);transform:translateX(-50%);padding:8px 26px;background:rgba(20,22,28,.8);border:1px solid #889;cursor:pointer;font-size:14px}
#fnSusto{position:absolute;inset:0;background:#000;pointer-events:auto}#fnSusto.oc{display:none}
#fnSusto video{width:100%;height:100%;object-fit:cover}#fnSusto.est video,#fnSusto.tres video{display:none}#fnSusto.tres:not(.est){background:transparent}
#fnSusto.est:after{content:'';position:absolute;inset:0;background:url(${'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><filter id="f"><feTurbulence baseFrequency=".9" numOctaves="1" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#f)" opacity=".9"/></svg>')});background-size:cover;animation:fnEst .12s steps(3) infinite}
@keyframes fnEst{33%{background-position:7px 3px}66%{background-position:-5px 9px}}
#fnCartel{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);text-align:center;opacity:0;transition:opacity .8s;text-shadow:0 2px 8px #000}
#fnCartel.ve{opacity:1}#fnCartel b{display:block;font-size:52px;letter-spacing:2px}#fnCartel small{font-size:20px;opacity:.85}
body.tactil #fnHora{top:calc(env(safe-area-inset-top) + 50px)}body.tactil #fnBtns{top:calc(env(safe-area-inset-top) + 150px);transform:none;right:calc(env(safe-area-inset-right) + 10px)}
body.tactil #fnPoder{left:auto;bottom:auto;right:calc(env(safe-area-inset-right) + 14px);top:calc(env(safe-area-inset-top) + 100px);text-align:right;font-size:12px}
body.tactil #fnMapa{transform:scale(.82);transform-origin:right bottom}
body.fnCam #hud,body.fnSusto #hud,body.fnCam #fnBtns{visibility:hidden}`;
  document.head.appendChild(st);
  const r = document.createElement('div'); r.id = 'fnRaiz';
  const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${d}</svg>`;
  r.innerHTML = `<div id="fnHora"><b>12 AM</b><small></small></div><div id="fnPoder"></div>
<div id="fnBtns"><div id="fnLin" title="L">${ico('<path d="M8 3h8l-1 6H9z"/><path d="M9 9h6v12H9z"/><path d="M12 13v3"/>')}</div><div id="fnCamB" title="G">${ico('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>')}</div></div>
<div id="fnCam" class="oc"><canvas id="fnRuido" width="160" height="90"></canvas><div id="fnRec"></div><div id="fnCamTit"></div><div id="fnMapa"></div><div id="fnCerrar">✕</div></div>
<div id="fnSusto" class="oc"><video playsinline preload="auto"></video></div><div id="fnCartel" class="oc"></div>`;
  document.body.appendChild(r);
  const U = (NOC.ui = { raiz: r, hora: r.querySelector('#fnHora b'), noche: r.querySelector('#fnHora small'), poder: r.querySelector('#fnPoder'), lin: r.querySelector('#fnLin'), cam: r.querySelector('#fnCam'),
    camTit: r.querySelector('#fnCamTit'), camMapa: r.querySelector('#fnMapa'), ruido: r.querySelector('#fnRuido'), susto: r.querySelector('#fnSusto'), video: r.querySelector('video'), cartel: r.querySelector('#fnCartel') });
  // el plano chico: salas como rectángulos y las cámaras donde están (arriba el escenario, en +x; abajo la oficina, en -x)
  const X = (z) => 125 + z * 8.2, Y = (x) => 14 + (12 - x) * 4.6;
  const sala = (x0, x1, z0, z1) => `<i style="left:${X(z0)}px;top:${Y(-x0)}px;width:${(z1 - z0) * 8.2}px;height:${(x1 - x0) * 4.6}px"></i>`;   // (x0..x1: hacia la oficina, que está en -x)
  U.camMapa.innerHTML = sala(-12.5, -7, -5.5, 6) + sala(-7, 5.5, -9, 11) + sala(-2, 3, -13, -9) + sala(5.5, 25.5, 2.3, 4.6) + sala(5.5, 25.5, -4.6, -2.3) + sala(20.5, 25, -2, 2) + sala(6.5, 10.3, -9.8, -5.8) + sala(-7, 5.5, 10.5, 13.5) +
    NOC_CAMS.map((k, i) => { const c = DATA.fn.camaras[k[0]]; return c ? `<b data-c="${i}" style="left:${X(c.p[2])}px;top:${Y(c.p[0])}px">${k[1]}</b>` : ''; }).join('');
  U.camMapa.querySelectorAll('[data-c]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); nocheCamElegir(+b.dataset.c); }));
  r.querySelector('#fnCerrar').onclick = () => nocheTablet();
  U.lin.onclick = () => nocheLinterna(); r.querySelector('#fnCamB').onclick = () => nocheTablet();
  r.querySelector('#fnCam').addEventListener('keydown', (e) => e.stopPropagation());
  // estática de las cámaras: ruido en un lienzo chico, estirado
  const g = U.ruido.getContext('2d'), im = g.createImageData(160, 90);
  setInterval(() => { if (NOC.cam === null) return; const d = im.data; for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } g.putImageData(im, 0, 0); }, 70);
}
function nocheHUD() {
  const U = NOC.ui; if (!U) return;
  const h = Math.floor(NOC.hora), txt = (h === 0 ? 12 : h) + ' AM';
  if (U.hT !== txt) { U.hT = txt; U.hora.textContent = txt; }
  const nt = T('fn.noche') + ' ' + NOC.noche; if (U.nT !== nt) { U.nT = nt; U.noche.textContent = nt; }
  const p = Math.ceil(NOC.poder), uso = nocheUso(), key = p + '|' + uso + '|' + NOC.estado;
  if (U.pT !== key) {
    U.pT = key; let b = ''; for (let i = 0; i < Math.min(5, uso); i++) b += `<i class="${i >= 3 ? 'rr' : i >= 2 ? 'r' : ''}"></i>`;
    U.poder.innerHTML = esc(T('fn.energia')) + ': <b>' + Math.max(0, p) + '%</b><br>' + esc(T('fn.uso')) + ': ' + b;
  }
  // ¿alguien mira las cámaras? (gasta energía; lo cuenta el que maneja)
  NOC.mirando = NOC.cam !== null || !!NOC.mirandoRed;
}
