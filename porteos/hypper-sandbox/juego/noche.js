// ---------------------------------------------------------------------------------------------------------
// La noche en la pizzería (mapa RB_Pizzeria, de herramientas/pizzeria.py), como en FNAF 1: de las 12 a las 6 (89 s
// por hora) en la oficina. Freddy, Bonnie, Chica y Foxy (modelos y animaciones del pack Help Wanted de GMod) tienen el
// nivel de cada noche (y suben a las 2, 3 y 4); cada 3 a 5 s prueban moverse y, si les toca, caminan a la sala siguiente
// de su recorrido (escenario, comedor, cuarto de atrás, baños, cocina, pasillos, depósito, esquinas de las puertas) por
// caminos calculados sobre el mapa. En la esquina: con la puerta cerrada se vuelven; abierta, entran y te agarran.
// Freddy no se mueve si alguien lo mira (con los ojos o por la cámara de su sala) y entra mientras miran las cámaras (no la
// 4B); Foxy sale
// de Pirate Cove por etapas mientras nadie tiene la tableta arriba y corre por el pasillo oeste (golpea la puerta y te
// saca energía). Puertas y luces con botones (E), energía como FNAF 1; sin energía se apaga todo y viene Freddy con la
// cajita de música. Cámaras (G), linterna en primera persona (L) que alumbra en todas las calidades, sustos en video (o
// el animatrónico en 3D), llamadas de las noches 1 a 4 (silenciables), 6 AM, Game Over y la noche otra vez.
// Solo: menú de noches (nueva, continuar, la 6 y la personalizada, con el progreso guardado). En una sala la noche la
// maneja un jugador (el de id más chico; si se va, sigue el próximo con el último estado) y la manda a todos; al que
// agarran pasa a espectador (sigue a los demás, vuela libre o mira las cámaras) y nadie lo ve hasta la noche siguiente.
// ---------------------------------------------------------------------------------------------------------
const NOC = { on: false, ctl: false, tCtl: 0, tRed: 0, rem: new Map(), noche: 1, pers: null, hora: 0, poder: 100, estado: 'menu', estT: 0, golpes: 0,
  puerta: { izq: false, der: false }, luz: { izq: false, der: false }, pk: { izq: 0, der: 0 }, cuerpoP: {}, mdP: {}, anim: [], fuera: new Set(), vistas: new Map(),
  cam: null, camT: 0, ruidoT: 0, linterna: false, susto: null, esp: null, ui: null, llamada: null, mudo: false, tAmb: 0, tVista: 0, quieta: false };
const NOC_HORA = 89;
// niveles de FNAF 1 por noche (Freddy, Bonnie, Chica, Foxy); la 7 es la personalizada
const NOC_TABLA = [[0, 0, 0, 0], [0, 3, 1, 1], [1, 0, 5, 2], [1, 2, 4, 6], [3, 5, 7, 5], [4, 10, 12, 16]];
const NOC_K = ['F', 'B', 'C', 'X'], NOC_NOM = { F: 'Freddy', B: 'Bonnie', C: 'Chica', X: 'Foxy' };
const NOC_CADA = { F: 3.02, B: 4.97, C: 4.98, X: 5.01 };   // cada cuánto prueban moverse (s)
const NOC_VEL = { F: 1.25, B: 1.6, C: 1.45, X: 7.5 };      // caminando (Foxy, corriendo)
const NOC_PUERTA = { F: 'der', B: 'izq', C: 'der', X: 'izq' };
const NOC_SIG = {   // adónde puede ir desde cada sala (como en FNAF 1)
  F: { escenario: ['comedor'], comedor: ['banos'], banos: ['cocina'], cocina: ['este'], este: ['esqE'] },
  B: { escenario: ['comedor', 'atras'], comedor: ['atras', 'oeste'], atras: ['comedor', 'oeste'], oeste: ['armario', 'esqO'], armario: ['oeste', 'esqO'] },
  C: { escenario: ['comedor'], comedor: ['banos', 'cocina'], banos: ['cocina', 'este'], cocina: ['banos', 'este'], este: ['esqE', 'comedor'] } };
// cámaras: [cámara del mapa (-1: no hay, sólo audio), número, nombre, sala, a qué sala apunta]
const NOC_CAMS = [[6, '1A', 'fn.c1a', 'escenario', 'escenario'], [4, '1B', 'fn.c1b', 'comedor'], [5, '1C', 'fn.c1c', 'pirata'], [0, '2A', 'fn.c2a', 'oeste'], [1, '2B', 'fn.c2b', 'esqO', 'esqO'],
  [9, '3', 'fn.c3', 'armario'], [2, '4A', 'fn.c4a', 'este'], [3, '4B', 'fn.c4b', 'esqE', 'esqE'], [7, '5', 'fn.c5', 'atras'], [-1, '6', 'fn.c6', 'cocina'], [8, '7', 'fn.c7', 'banos']];
const nocheActiva = () => NOC.on;
const enOficina = (p) => p.x < -20.4 && p.x > -25.3 && p.z > -2.05 && p.z < 2.05;
const miId = () => (typeof RED !== 'undefined' && RED.on ? RED.ID : 'yo');
const enSala = () => typeof SALA !== 'undefined' && !!SALA && typeof RED !== 'undefined' && RED.on;
const nocheSpot = (sala, k) => { const s = DATA.fn.salas[sala]; const p = s && (s[k] || Object.values(s)[0]); return v3(p[0], p[1], p[2]); };

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
  const nf = c.nf, nb = c.nb, F = c.f, L = nf - 1 || 1; let x = t * c.fps;
  x = c.loop ? ((x % L) + L) % L : Math.min(x, nf - 1);
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
function nocheAnimCrear(k) {
  const nom = NOC_NOM[k], md = new Modelo(DATA.fn.pf[nom]), c = nocheClip(nom + ':quieto');
  const A = { k, nom, md, pos: v3(), yaw: 0, clip: 'quieto', ct: 0, prev: null, pt: 0, pct: 0, nb: c.nb, b0: new Float32Array(c.nb * 7), b1: new Float32Array(c.nb * 7),
    sala: 'escenario', destino: null, ruta: null, ri: 0, estado: 'quieto', tMov: 0, tEst: 0, fase: 0, tFuera: 0, freno: 0, meta: v3(), metaYaw: 0, tPaso: 0, pie: 0, tVer: 0, respiro: false };
  nocheAnimInicio(A); return A;
}
// a su lugar de arranque (escenario; Foxy, adentro de la cueva)
function nocheAnimInicio(A) {
  A.sala = A.k === 'X' ? 'pirata' : 'escenario'; A.ruta = null; A.destino = null; A.estado = 'quieto'; A.fase = 0; A.tFuera = 0; A.respiro = false;
  A.tMov = NOC_CADA[A.k] * (0.3 + Math.random() * 0.7);
  A.pos.copy(nocheFoxyPos(A)); A.yaw = A.k === 'X' ? 0 : -Math.PI / 2; A.meta.copy(A.pos); A.metaYaw = A.yaw; nocheAnimClip(A, 'quieto');
}
// Foxy: más adelante en la cueva en cada etapa (la 3, en la boca, listo para correr)
function nocheFoxyPos(A) { const p = nocheSpot(A.sala, A.k); if (A.k === 'X' && A.sala === 'pirata') p.z += A.fase * 0.75; return p; }
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
// caminar a otra sala por el camino calculado (desde el punto del camino más cercano a donde está)
function nocheIr(A, sala, corre) {
  let pts = [];
  const tramo = (a, b) => (DATA.fn.caminos[A.k + ':' + a + '>' + b] || []).map((p) => v3(p[0], p[1], p[2]));
  if (A.k === 'X' && sala === 'esqO' && A.sala === 'pirata') { pts = tramo('pirata', 'oeste'); pts = pts.concat(tramo('oeste', 'esqO').slice(1)); }
  else pts = tramo(A.sala, sala);
  if (!pts.length) return false;
  let mejor = 0, dm = 1e9;
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], ab = vsub(b, a), t = clamp(vdot(vsub(A.pos, a), ab) / Math.max(1e-6, vdot(ab, ab)), 0, 1), d = vadd(a, vscale(ab, t)).distTo(A.pos); if (d < dm) { dm = d; mejor = i + 1; } }
  A.ruta = pts.slice(mejor); A.ri = 0; A.destino = sala; A.estado = corre ? 'corre' : 'camina'; A.velK = corre ? NOC_VEL.X : NOC_VEL[A.k];
  if (A.k === 'F') { sonar('fn_risa', A.pos, 0.9); nocheMandarEvento('risa'); }   // (Freddy se ríe cuando se mueve)
  return true;
}
function nocheMover(A, dt) {
  const m = A.ruta[A.ri], dv = vsub(m, A.pos), d = Math.hypot(dv.x, dv.z), paso = A.velK * dt;
  if (d <= paso) { A.pos.copy(m); if (++A.ri >= A.ruta.length) { A.ruta = null; nocheLlegar(A); } return; }
  A.pos.x += dv.x / d * paso; A.pos.z += dv.z / d * paso; A.pos.y += (m.y - A.pos.y) * Math.min(1, paso / d);
  let dy = Math.atan2(dv.x, dv.z) - A.yaw; dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; A.yaw += dy * Math.min(1, dt * 8);
  nocheAnimClip(A, A.estado === 'corre' ? 'corre' : 'camina');
}
function nocheLlegar(A) {
  A.sala = A.destino; A.destino = null; A.tEst = 0; nocheAnimClip(A, 'quieto');
  if (A.sala === 'oficina') { A.estado = 'dentro'; return; }
  if (A.sala === 'esqO' || A.sala === 'esqE') {
    A.estado = 'esquina'; A.respiro = false; A.yaw = A.sala === 'esqO' ? 0 : Math.PI;   // (mirando a la puerta)
    if (A.k === 'X') nocheFoxyPuerta(A);
    return;
  }
  A.estado = 'quieto'; A.yaw = A.sala === 'escenario' ? -Math.PI / 2 : A.yaw;
}

// ---------------- empezar y terminar ----------------
function nocheIniciar() {
  if (!DATA.fn || !DATA.fn.pf || !DATA.fn.salas) return;
  NOC.on = true; NOC.fuera.clear(); NOC.rem.clear(); NOC.vistas.clear(); NOC.ctl = false; NOC.tCtl = TIEMPO.t; NOC.linterna = false; NOC.cam = null; NOC.susto = null; NOC.esp = null;
  NOC.anim = NOC_K.map(nocheAnimCrear);
  // las puertas de la oficina: su modelo y su caja de choque (arriba, lejos, mientras está abierta)
  for (const lado of ['izq', 'der']) {
    const P = DATA.fn.puertas[lado]; if (!P) continue;
    NOC.mdP[lado] = MUNDO.modelos.find((m) => m.A[0].n === 'FN_Puerta_' + lado) || null;
    const c = P.caja, b = new Body(boxShape(c[0] / 2 + 0.03, c[1] / 2, c[2] / 2 + 0.03), 0);
    b.pos.set(P.p[0], P.p[1] + 100, P.p[2]); b.updateWorld(); b.estatico = true; b.snd = 'metal';
    MUNDO.cajas.push(b); const a = b.aabb; grillaAgregar(a.x0, a.z0, a.x1, a.z1, b); NOC.cuerpoP[lado] = b; NOC.pk[lado] = 0;
  }
  // la cortina de Pirate Cove: dos paños que se juntan a los costados según cuánto se asoma Foxy
  NOC.mdC = ['Izq', 'Der'].map((l) => MUNDO.modelos.find((m) => m.A[0].n === 'FN_Cortina' + l)).filter(Boolean); NOC.ck = 0;
  // de noche, en la pizzería, sólo manos y cámara (y nada de cosas del menú: es para tener miedo)
  ARM.lista = ['Hands', 'Camera']; elegirArma(0);
  for (const n of NOC_SONIDOS) audioBuf(n);
  nocheUI();
  NOC.estado = 'menu'; NOC.estT = 0; NOC.ronda = NOC.rondaVista = 0; NOC.estVisto = 'menu';
  if (!enSala()) nocheMenu(true);   // solo: el menú de noches (en una sala arranca sola la noche 1)
}
const NOC_SONIDOS = ['fn_ventilador', 'fn_zumbido', 'fn_puerta', 'fn_golpe', 'fn_foxycorre', 'fn_apagon', 'fn_6am', 'fn_estatica', 'fn_blip', 'fn_tablet', 'fn_ambiente', 'fn_ninos',
  'fn_paso1', 'fn_paso2', 'fn_paso3', 'fn_risa', 'fn_ollas', 'fn_respira', 'fn_aliento', 'fn_cajita', 'fn_grito', 'fn_corre1', 'fn_corre2', 'fn_gameover', 'fn_error'];
function nocheFin() {
  if (!NOC.on) return;
  NOC.on = false; NOC.anim = []; nocheCamCerrar(); nocheEspSalir(); nocheSustoFin(); nocheLlamadaCortar(); nocheMenu(false);
  document.body.classList.remove('fnSusto', 'fnTapa');
  if (NOC.ui) NOC.ui.raiz.classList.add('oc');
}
// una noche desde cero (la decide el que maneja; a todos les llega el estado 'intro')
function nocheEmpezarNoche(n, pers) {
  NOC.noche = Math.max(1, Math.min(7, n | 0)); NOC.pers = NOC.noche === 7 ? (pers || NOC.pers || [20, 20, 20, 20]) : null;
  NOC.hora = 0; NOC.poder = 100; NOC.golpes = 0; NOC.estado = 'intro'; NOC.estT = 0; NOC.fuera.clear(); NOC.tRed = 0;
  NOC.puerta.izq = NOC.puerta.der = false; NOC.luz.izq = NOC.luz.der = false;
  NOC.f4 = 1 + (Math.random() < 0.5 ? 1 : 0);   // (Freddy en la noche 4: 1 o 2)
  for (const A of NOC.anim) nocheAnimInicio(A);
  NOC.ronda = (NOC.ronda || 0) + 1; NOC.rondaVista = NOC.ronda;
  nocheResetLocal(); nocheHUD();
}
// lo de cada uno al empezar una noche: a la oficina, sin cámaras, sin espectar, sin linterna, sin llamada
function nocheResetLocal() {
  nocheCamCerrar(); nocheEspSalir(); nocheMenu(false); nocheLlamadaCortar(); NOC.mudo = false;
  if (NOC.noche <= 4) audioBuf(nocheLlamadaNombre());   // (la llamada se decodifica mientras dura la tapa)
  nocheSustoFin(); if (UI.abierto === 'fngo') UI.abierto = null;
  NOC.ui.go.classList.add('oc');
  NOC.linterna = false; NOC.ui.lin.classList.remove('on');
  JUG.noclip = false; jugadorAparecer(); JUG.yaw = Math.PI / 2; JUG.pitch = 0;   // (mirando hacia el comedor)
}
function nocheNivel(k) {
  const i = NOC_K.indexOf(k);
  if (NOC.noche === 7) return (NOC.pers || [20, 20, 20, 20])[i];
  let n = NOC_TABLA[Math.min(5, NOC.noche - 1)][i]; if (NOC.noche === 4 && k === 'F') n = NOC.f4 || 1;
  const h = Math.floor(NOC.hora);
  if (k === 'B' && h >= 2) n++;
  if ((k === 'B' || k === 'C' || k === 'X') && h >= 3) n++;
  if ((k === 'B' || k === 'C' || k === 'X') && h >= 4) n++;
  return Math.min(20, n);
}

// ---------------- ¿quién maneja la noche? ----------------
function nocheManejo() {
  if (!enSala()) return true;
  const t = TIEMPO.t;
  for (const [id, x] of NOC.rem) { if (!RED.remotos.has(id)) { NOC.rem.delete(id); continue; } if (t - x < 2.5 && (!NOC.ctl || id < RED.ID)) return false; }   // (los que se fueron no cuentan)
  if (NOC.ctl) return true;
  let antes = 0; for (const id of RED.remotos.keys()) if (id < RED.ID) antes++;
  return t - NOC.tCtl > 3 + 2 * antes;
}
// los jugadores (yo y los de la sala) con dónde están; vivos = los que no agarraron
function nocheJugadores() {
  const L = [{ id: miId(), pos: JUG.pos, yo: true }];
  if (enSala()) for (const R2 of RED.remotos.values()) L.push({ id: R2.id, pos: R2.pos, yo: false, R2 });
  return L;
}
const nocheVivos = () => nocheJugadores().filter((j) => !NOC.fuera.has(j.id));

// ---------------- cada cuadro ----------------
function nochePaso(dt) {
  const debe = JUEGO.estado === 'juego' && MUNDO.nombre === 'RB_Pizzeria';
  if (debe && !NOC.on) nocheIniciar(); else if (!debe && NOC.on) nocheFin();
  if (!NOC.on) return;
  NOC.ctl = nocheManejo();
  if (NOC.ctl) {
    if (enSala() && NOC.estado === 'menu') nocheEmpezarNoche(1);   // (en una sala no hay menú)
    nocheLogica(dt);
  }
  // lo que cambió (acá o por la red, en los que no manejan): una noche nueva (cada una tiene su número) y el estado
  if (NOC.rondaVista !== NOC.ronda) { NOC.rondaVista = NOC.ronda; nocheResetLocal(); }
  if (NOC.estVisto !== NOC.estado) { const antes = NOC.estVisto; NOC.estVisto = NOC.estado; nocheCambioEstado(antes, NOC.estado); }
  // puertas: se mueven solas hasta donde dice el estado (y chocan cuando están casi cerradas)
  for (const lado of ['izq', 'der']) {
    const P = DATA.fn.puertas[lado]; if (!P) continue;
    const cerr = NOC.puerta[lado] && NOC.estado !== 'apagon' && NOC.estado !== 'perdiendo', meta = cerr ? 1 : 0, k0 = NOC.pk[lado];
    NOC.pk[lado] += Math.sign(meta - k0) * Math.min(Math.abs(meta - k0), dt * 3.2);
    const md = NOC.mdP[lado]; if (md) { md.p[0][1] = P.p[1] + (1 - NOC.pk[lado]) * (P.alto + 0.05); md.sucio = true; }
    const b = NOC.cuerpoP[lado]; if (b) { const y = P.p[1] + (NOC.pk[lado] > 0.55 ? 0 : 100); if (b.pos.y !== y) { b.pos.y = y; b.updateWorld(); } }
  }
  // la cortina: cerrada con Foxy adentro; se abre en cada etapa (como en FNAF) y del todo cuando sale
  const X = NOC.anim[3];
  if (X && NOC.mdC && NOC.mdC.length) {
    const meta = X.sala === 'pirata' && X.estado !== 'corre' ? [0, 0.22, 0.45, 0.7][X.fase] || 0 : 0.7;
    NOC.ck += Math.sign(meta - NOC.ck) * Math.min(Math.abs(meta - NOC.ck), dt * 1.2);
    for (const md of NOC.mdC) if (md.s[0][0] !== 1 - NOC.ck) { md.s[0][0] = 1 - NOC.ck; md.sucio = true; }
  }
  // animatrónicos: los que maneja otro se acercan a lo último que llegó
  for (const A of NOC.anim) {
    if (!NOC.ctl) {
      const k = 1 - Math.exp(-dt * 8); if (A.meta.distTo(A.pos) > 4) A.pos.copy(A.meta); else A.pos.lerpTo(A.meta, k);
      let dy = A.metaYaw - A.yaw; dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; A.yaw += dy * k;
    }
    if (A.salaVista !== A.sala) { if (NOC.cam !== null && (NOC_CAMS[NOC.cam][3] === A.sala || NOC_CAMS[NOC.cam][3] === A.salaVista)) NOC.ruidoT = 0.8; A.salaVista = A.sala; }   // (en la cámara que mirás, estática cuando entra o sale)
    nocheAnimPose(A, dt); nocheAnimSonidos(A, dt);
  }
  // lo que miro: lo cuento (y lo mando) para Freddy y Foxy
  const c = NOC.cam !== null && !NOC.fuera.has(miId()) ? NOC.cam : -1;
  NOC.vistas.set(miId(), { c, t: TIEMPO.t });
  if (enSala() && (c !== NOC.vistaMandada || TIEMPO.t - NOC.tVista > 2)) { NOC.vistaMandada = c; NOC.tVista = TIEMPO.t; publicar('a', { k: 'fnv', c }); }
  nocheSonidos(dt); nocheAmbiente(); nocheHUD(dt);
  // lo que tapa la pantalla (el susto, el menú, Game Over, la tapa negra, espectar) vuelve a mandar al cerrarse la pausa
  if (!UI.abierto && NOC.ui) {
    const U = NOC.ui, ab = NOC.susto ? 'fnsusto' : !U.menu.classList.contains('oc') ? 'fnmenu' : !U.go.classList.contains('oc') && !enSala() ? 'fngo' : !U.tapa.classList.contains('oc') ? 'fntapa' : NOC.esp && NOC.esp.modo === 'seguir' ? 'fnesp' : null;
    if (ab) { UI.abierto = ab; soltarPuntero(); }
  }
  if (NOC.cam !== null && UI.abierto !== 'fncam') nocheCamCerrar();
  if (NOC.susto) nocheSustoPaso(dt);
  if (NOC.esp) nocheEspPaso(dt);
  if (NOC.ctl && enSala() && TIEMPO.t - NOC.tRed > 0.25) { NOC.tRed = TIEMPO.t; publicar('a', nocheEstadoRed()); }
}
// cuando cambia el estado (en el que maneja y en los demás): lo de cada uno
function nocheCambioEstado(antes, ahora) {
  if (ahora === 'juega' && antes === 'intro') setTimeout(nocheLlamada, 1500);
  if (ahora === 'apagon') { sonar('fn_apagon', null, 0.9); nocheLlamadaCortar(); nocheCamCerrar(); }
  if (ahora === 'gano') { nocheLlamadaCortar(); nocheCamCerrar(); nocheEspSalir(); sonar('fn_6am', null, 0.9); setTimeout(() => sonar('fn_ninos', null, 0.6), 3200); if (!enSala()) nocheProgreso(NOC.noche); }
  if (ahora === 'perdio') { nocheLlamadaCortar(); nocheCamCerrar(); nocheEspSalir(); nocheGameOver(); }
}
// lo que decide el que maneja: la hora, la energía, los animatrónicos, quién se salva
function nocheLogica(dt) {
  if (NOC.quieta) return;   // (pruebas: todo quieto)
  NOC.estT += dt;
  if (NOC.estado === 'menu') return;
  if (NOC.estado === 'intro') { if (NOC.estT > 4) { NOC.estado = 'juega'; NOC.estT = 0; } return; }
  if (NOC.estado === 'gano') { if (NOC.estT > 9) { if (!enSala() && NOC.noche >= 5) { NOC.estado = 'menu'; NOC.estT = 0; nocheMenu(true); } else nocheEmpezarNoche(NOC.noche === 7 ? 7 : NOC.noche + 1); } return; }
  if (NOC.estado === 'perdio') { if (enSala() && NOC.estT > 8) nocheEmpezarNoche(NOC.noche); return; }   // (solo: espera "Reintentar")
  NOC.hora += dt / NOC_HORA;
  if (NOC.hora >= 6 && NOC.estado !== 'perdiendo') { NOC.hora = 6; nocheTerminar('gano'); return; }   // (a las 6 se salva, aun en el apagón)
  NOC.hora = Math.min(NOC.hora, 6);
  if (NOC.estado === 'juega') {
    // energía como FNAF 1: 0,1 % por segundo por cada barra de uso, más el gasto de cada noche (0,1 % cada 6, 5, 4 o 3 s)
    const pas = NOC.noche >= 5 ? 3 : [0, 0, 6, 5, 4][NOC.noche];   // (la 1 no tiene gasto extra)
    NOC.poder -= dt * (nocheUso() * 0.1 + (pas ? 0.1 / pas : 0));
    if (NOC.poder <= 0) { NOC.poder = 0; NOC.estado = 'apagon'; NOC.estT = 0; NOC.luz.izq = NOC.luz.der = false; NOC.puerta.izq = NOC.puerta.der = false; NOC.tFreddy = 3 + Math.random() * 12; NOC.tMusica = 6 + Math.random() * 14; NOC.tFin = 2 + Math.random() * 4; nocheMandarEvento('apagon'); }
  }
  if (NOC.estado === 'apagon' || NOC.estado === 'perdiendo') { nocheApagonPaso(); return; }
  if (NOC.estado !== 'juega') return;
  const V = nocheVivos();
  // agarraron a todos (solo: a vos): se pierde, después de dejar ver el susto
  if (!V.length) { if ((NOC.todosT = (NOC.todosT || 0) + dt) > 3.2) { NOC.todosT = 0; nocheTerminar('perdio'); } return; }
  NOC.todosT = 0;
  for (const A of NOC.anim) nocheIA(A, dt, V);
}
function nocheUso() { return Math.min(5, 1 + (NOC.puerta.izq ? 1 : 0) + (NOC.puerta.der ? 1 : 0) + (NOC.luz.izq ? 1 : 0) + (NOC.luz.der ? 1 : 0) + (nocheTabletArriba() ? 1 : 0)); }
function nocheTerminar(e) {
  NOC.estado = e; NOC.estT = 0;
  if (e === 'gano') for (const A of NOC.anim) nocheAnimInicio(A);
  nocheMandarEvento(e);
}
// ¿alguien vivo tiene la tableta arriba? ¿alguien vivo mira la cámara de tal sala?
function nocheTabletArriba() { for (const [id, v] of NOC.vistas) if (v.c >= 0 && TIEMPO.t - v.t < 5 && !NOC.fuera.has(id)) return true; return false; }
function nocheViendoSala(sala) { for (const [id, v] of NOC.vistas) if (v.c >= 0 && TIEMPO.t - v.t < 5 && !NOC.fuera.has(id) && NOC_CAMS[v.c] && NOC_CAMS[v.c][3] === sala) return true; return false; }

// ---------------- inteligencia (sólo el que maneja) ----------------
function nocheIA(A, dt, V) {
  A.tEst += dt;
  if (A.ruta) { nocheMover(A, dt); nocheAtrapa(A, V, dt); return; }
  if (A.estado === 'susto') return;
  if (A.estado === 'dentro') {   // adentro de la oficina: agarra al que esté más cerca; si no hay nadie, se vuelve
    const j = V.filter((x) => enOficina(x.pos)).sort((a, b) => a.pos.distTo(A.pos) - b.pos.distTo(A.pos))[0];
    if (j && A.tEst > 1.1) { nocheAgarrar(A, j.id); return; }
    if (!j && A.tEst > 5) nocheAnimInicio(A);
    return;
  }
  nocheAtrapa(A, V, dt);
  if (A.k === 'X') { nocheFoxy(A, dt); return; }
  if (A.estado === 'esquina' && !A.respiro && NOC.luz[NOC_PUERTA[A.k]] && A.k !== 'F') { A.respiro = true; sonar('fn_aliento', A.pos, 1); nocheMandarEvento('aliento_' + A.k); }   // (la luz lo muestra)
  if ((A.tMov -= dt) > 0) return;
  A.tMov += NOC_CADA[A.k];
  if (1 + Math.floor(Math.random() * 20) > nocheNivel(A.k)) return;
  if (A.k === 'F' && nocheMirado(A)) return;   // Freddy no se mueve si lo miran
  if (A.estado === 'esquina') {
    const lado = NOC_PUERTA[A.k];
    if (NOC.puerta[lado]) nocheIr(A, A.k === 'B' ? 'comedor' : 'este');   // con la puerta cerrada se vuelve
    else if (A.k === 'F') { if (nocheTabletArriba() && !nocheViendoSala('esqE')) nocheIr(A, 'oficina'); }   // Freddy entra sólo mientras miran las cámaras (y no la 4B)
    else nocheIr(A, 'oficina');
    return;
  }
  const L = NOC_SIG[A.k][A.sala]; if (!L) return;
  nocheIr(A, L[(Math.random() * L.length) | 0]);
}
// Foxy: sale por etapas mientras nadie tiene la tableta arriba; afuera, corre a los 25 s o si alguien mira el pasillo oeste
function nocheFoxy(A, dt) {
  if (A.sala !== 'pirata') return;
  if (A.fase < 3) {
    if (nocheTabletArriba()) { A.freno = 0.83 + Math.random() * 15.84; return; }
    if ((A.freno -= dt) > 0) return;
    if ((A.tMov -= dt) > 0) return;
    A.tMov += NOC_CADA.X;
    if (1 + Math.floor(Math.random() * 20) > nocheNivel('X')) return;
    A.fase++; A.tFuera = 0; A.pos.copy(nocheFoxyPos(A)); A.ri = 0;
    return;
  }
  A.tFuera += dt;
  if (A.tFuera > 25 || nocheViendoSala('oeste')) { nocheIr(A, 'esqO', true); sonar('fn_foxycorre', A.pos, 1); nocheMandarEvento('foxy'); }
}
function nocheFoxyPuerta(A) {
  if (NOC.puerta.izq) {   // golpea la puerta: energía (1 %, 6 %, 11 %...) y a la cueva
    nocheMandarEvento('golpe'); nocheGolpes(); NOC.poder = Math.max(0, NOC.poder - (1 + 5 * NOC.golpes)); NOC.golpes++;
    A.fase = Math.random() < 0.5 ? 0 : 1; A.sala = 'pirata'; A.estado = 'quieto'; A.pos.copy(nocheFoxyPos(A)); A.yaw = 0; A.tMov = NOC_CADA.X;
  } else { nocheIr(A, 'oficina', true); }
}
function nocheGolpes() { for (let i = 0; i < 3; i++) setTimeout(() => sonar('fn_golpe', nocheSpot('esqO', 'B'), 1), i * 260); }
// fuera de la oficina, si te lo cruzás: te agarra (no te persigue; si lo tocás o te ve de frente muy cerca)
function nocheAtrapa(A, V, dt) {
  if ((A.tVer -= dt) > 0) return; A.tVer = 0.2;
  if ((A.sala === 'escenario' && !A.ruta) || (A.k === 'X' && A.sala === 'pirata' && !A.ruta)) return;
  const f = v3(Math.sin(A.yaw), 0, Math.cos(A.yaw));
  for (const j of V) {
    if (enOficina(j.pos)) continue;
    const dv = vsub(j.pos, A.pos); dv.y = 0; const d = dv.len(); if (d > 2.6) continue;
    if (d < 1.25 || (vdot(dv, f) / d > 0.55 && !mundoRayo(vadd(A.pos, v3(0, 1.6, 0)), vsub(vadd(j.pos, v3(0, 0.5, 0)), vadd(A.pos, v3(0, 1.6, 0))).norm(), d))) { nocheAgarrar(A, j.id); return; }
  }
}
// ¿alguien vivo lo está mirando? (con los ojos, de cerca y sin paredes en el medio, o por la cámara de su sala)
function nocheMirado(A) {
  if (nocheViendoSala(A.sala)) return true;
  const c = vadd(A.pos, v3(0, 1.4, 0));
  const ve = (o, f) => { const dv = vsub(c, o), l = dv.len(); if (l > 22 || vdot(dv, f) / l < 0.75) return false; return !mundoRayo(o, vscale(dv, 1 / l), l - 0.4); };
  if (!NOC.fuera.has(miId()) && NOC.cam === null && ve(CAM.pos, CAM.fwd)) return true;
  if (enSala()) for (const R2 of RED.remotos.values()) { if (NOC.fuera.has(R2.id)) continue; const o = vadd(R2.pos, v3(0, 0.6, 0)); if (ve(o, Quat.euler(R2.yaw, R2.P.mira || 0).rot(v3(0, 0, 1)))) return true; }
  return false;
}
function nocheAgarrar(A, id) {
  if (NOC.fuera.has(id)) return;
  A.ruta = null; A.estado = 'susto'; nocheAnimClip(A, 'susto');
  setTimeout(() => { if (NOC.on && A.estado === 'susto') nocheAnimInicio(A); }, 2200);
  NOC.fuera.add(id);
  if (id === miId()) nocheSusto(A.nom); else if (enSala()) publicar('a', { k: 'fnx', to: id, a: A.nom });
}
// apagón: Freddy aparece en la puerta izquierda con la cajita de música, se apaga todo y asusta a todos
function nocheApagonPaso() {
  const t = NOC.estT, F = NOC.anim[0];
  if (t > NOC.tFreddy && F.sala !== 'esqO') { F.ruta = null; F.sala = 'esqO'; F.estado = 'apagon'; F.pos.copy(nocheSpot('esqO', 'B')); F.yaw = 0; nocheAnimClip(F, 'quieto'); sonar('fn_cajita', F.pos, 1); nocheMandarEvento('cajita'); }
  if (t > NOC.tFreddy + NOC.tMusica + NOC.tFin && NOC.estado === 'apagon') {
    for (const j of nocheVivos()) { NOC.fuera.add(j.id); if (j.yo) nocheSusto('apagon'); else publicar('a', { k: 'fnx', to: j.id, a: 'apagon' }); }
    NOC.estado = 'perdiendo'; NOC.estT = 0;
  }
  if (NOC.estado === 'perdiendo' && NOC.estT > 3) nocheTerminar('perdio');
}

// ---------------- botones, puertas, luces (E) ----------------
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
  if (!NOC.on || NOC.cam !== null || NOC.esp || NOC.fuera.has(miId())) return null;
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
  // sin energía, o con uno de ellos adentro de la oficina, los botones no andan (como en FNAF)
  if (NOC.estado !== 'juega' || NOC.anim.some((A) => A.estado === 'dentro')) { sonar('fn_error', v3(-23.8, 1.9, lado === 'izq' ? -2 : 2), 0.8); nocheMandarEvento('error_' + lado); return; }
  if (que === 'puerta') { NOC.puerta[lado] = !NOC.puerta[lado]; sonar('fn_puerta', v3(...DATA.fn.puertas[lado].p), 1); nocheMandarEvento('puerta_' + lado); }
  else { NOC.luz[lado] = !NOC.luz[lado]; if (NOC.luz[lado]) for (const A of NOC.anim) if (A.estado === 'esquina' && NOC_PUERTA[A.k] === lado) A.respiro = false; }
  NOC.tRed = 0;
}

// ---------------- red ----------------
function nocheEstadoRed() {
  return { k: 'fnn', n: NOC.noche, ro: NOC.ronda | 0, ps: NOC.pers, h: +NOC.hora.toFixed(3), p: +NOC.poder.toFixed(2), e: NOC.estado, et: +NOC.estT.toFixed(2), pu: [NOC.puerta.izq ? 1 : 0, NOC.puerta.der ? 1 : 0],
    lu: [NOC.luz.izq ? 1 : 0, NOC.luz.der ? 1 : 0], fu: [...NOC.fuera],
    a: NOC.anim.map((A) => [r3(A.pos.x), r3(A.pos.y), r3(A.pos.z), r3(A.yaw), A.clip, A.sala, A.estado, A.fase]) };
}
function nocheMandarEvento(e) { if (NOC.ctl && enSala()) publicar('a', { k: 'fne', e }); }
function nocheRed(d) {
  if (!NOC.on) return;
  if (d.k === 'fnn') {
    NOC.rem.set(d.i, TIEMPO.t); NOC.tCtl = TIEMPO.t; if (NOC.ctl && d.i > RED.ID) return;   // (dos manejando a la vez: gana el de id más chico)
    if (typeof d.ro === 'number') NOC.ronda = d.ro | 0;
    NOC.noche = num(d.n, 1, 7, 1) | 0; NOC.pers = Array.isArray(d.ps) ? d.ps.slice(0, 4).map((x) => num(x, 0, 20, 0) | 0) : null;
    NOC.hora = num(d.h, 0, 6, 0); NOC.poder = num(d.p, 0, 100, 100); NOC.estado = ['menu', 'intro', 'juega', 'apagon', 'perdiendo', 'gano', 'perdio'].includes(d.e) ? d.e : 'juega'; NOC.estT = num(d.et, 0, 1e4, 0);
    if (Array.isArray(d.pu)) { NOC.puerta.izq = !!d.pu[0]; NOC.puerta.der = !!d.pu[1]; } if (Array.isArray(d.lu)) { NOC.luz.izq = !!d.lu[0]; NOC.luz.der = !!d.lu[1]; }
    NOC.fuera = new Set(Array.isArray(d.fu) ? d.fu.filter((x) => typeof x === 'string').slice(0, 64) : []);
    if (Array.isArray(d.a)) d.a.forEach((x, k) => {
      const A = NOC.anim[k]; if (!A || !Array.isArray(x)) return;
      A.meta.set(num(x[0], -1e3, 1e3, 0), num(x[1], -50, 50, 0), num(x[2], -1e3, 1e3, 0)); A.metaYaw = num(x[3], -50, 50, 0);
      if (typeof x[4] === 'string') nocheAnimClip(A, x[4]); if (typeof x[5] === 'string' && DATA.fn.salas[x[5]]) A.sala = x[5];
      A.estado = String(x[6] || 'quieto').slice(0, 10); A.fase = x[7] | 0;
    });
  } else if (d.k === 'fnb' && NOC.ctl) nocheBoton(d.q === 'luz' ? 'luz' : 'puerta', d.l === 'der' ? 'der' : 'izq');
  else if (d.k === 'fnv') NOC.vistas.set(d.i, { c: num(d.c, -1, NOC_CAMS.length - 1, -1) | 0, t: TIEMPO.t });
  else if (d.k === 'fnx' && d.to === RED.ID) nocheSusto(['Freddy', 'Bonnie', 'Chica', 'Foxy', 'apagon'].includes(d.a) ? d.a : 'Freddy');
  else if (d.k === 'fne') {   // sonidos de lo que pasa (los decide el que maneja)
    const e = String(d.e || '');
    if (e === 'cajita') sonar('fn_cajita', nocheSpot('esqO', 'B'), 1);
    else if (e === 'golpe') nocheGolpes();
    else if (e === 'foxy') sonar('fn_foxycorre', NOC.anim[3] ? NOC.anim[3].pos : null, 1);
    else if (e === 'risa') sonar('fn_risa', NOC.anim[0] ? NOC.anim[0].pos : null, 0.9);
    else if (/^aliento_[BC]$/.test(e)) { const A = NOC.anim[NOC_K.indexOf(e.slice(8))]; if (A) sonar('fn_aliento', A.pos, 1); }
    else if (/^puerta_(izq|der)$/.test(e)) sonar('fn_puerta', v3(...DATA.fn.puertas[e.slice(7)].p), 1);
    else if (/^error_(izq|der)$/.test(e)) sonar('fn_error', v3(-23.8, 1.9, e.endsWith('izq') ? -2 : 2), 0.8);
  }
}
// bits del jugador para los demás: 128 linterna prendida, 256 espectador (no se ve ni choca)
const nocheBits = () => (NOC.on && NOC.linterna && !NOC.esp ? 128 : 0) | (NOC.on && NOC.esp ? 256 : 0);

// ---------------- luces ----------------
// las especiales andan en todas las calidades (también sin luces puntuales): linternas, la lámpara de la oficina, las luces
// de las puertas, la cara de Freddy en el apagón; en las calidades sin luces puntuales, además, las del techo más cercanas
function nocheLucesEsp() {
  if (!NOC.on) return;
  const apagon = NOC.estado === 'apagon' || NOC.estado === 'perdiendo', t = TIEMPO.t, cp = CAM.pos;
  if (NOC.linterna && NOC.cam === null && !NOC.esp) {
    const f = CAM.fwd, o = vadd(vadd(cp, vscale(f, 0.15)), vscale(CAM.der, 0.12)); o.y -= 0.12;
    luzEspecial(o, 24, [7.5, 7.1, 6.2], f.clone(), Math.cos(0.47), 10);
  }
  if (NOC.susto && NOC.susto.tres && !NOC.susto.est) luzEspecial(vadd(cp, v3(0, 0.4, 0)), 5, [4, 3.7, 3.2], null, -2, 11);
  if (enSala()) for (const R2 of RED.remotos.values()) {
    if (!(R2.f & 128) || R2.pos.distTo(cp) > 26) continue;
    const f = Quat.euler(R2.yaw, R2.P.mira || 0).rot(v3(0, 0, 1)); luzEspecial(vadd(R2.pos, v3(0, 0.5, 0)), 22, [6.5, 6.1, 5.4], f, Math.cos(0.47), 6);
  }
  if (!apagon) {
    if (Math.abs(cp.x + 23) < 16 && Math.abs(cp.z) < 16) luzEspecial(v3(-23.2, 3.0, 0), 8, [3.2, 3.0, 2.6], null, -2, 7);   // la lámpara de la oficina
    for (const lado of ['izq', 'der']) if (NOC.luz[lado]) { const s = lado === 'izq' ? -1 : 1; luzEspecial(v3(-22.4, 3.1, 2.3 * s), 8, [8, 7.4, 6.3], v3(0, -0.78, 0.62 * s).norm(), Math.cos(0.75), 8); }
    if (!(GFX.nluz > 0) || GFX.luz < 2) for (const L of DATA.fn.luces) { if (L.d) continue; const p = v3(L.p[0], L.p[1], L.p[2]); if (p.distTo(cp) < 16) luzEspecial(p, L.r * 1.3, [L.c[0] * 2.6, L.c[1] * 2.6, L.c[2] * 2.6], null, -2, 1); }
  } else if (NOC.estado === 'apagon' && NOC.estT > NOC.tFreddy && NOC.estT < NOC.tFreddy + NOC.tMusica && Math.sin(t * 9) * Math.sin(t * 2.3) > 0.1) {
    luzEspecial(vadd(nocheSpot('esqO', 'B'), v3(0, 2.0, 0.4)), 2.6, [3, 2.6, 1.8], null, -2, 9);   // la cara de Freddy titila con la música
  }
}
// las del techo del mapa (en las calidades con luces puntuales): más fuertes y titilando un poco
function nocheLuces() {
  if (!NOC.on || NOC.estado === 'apagon' || NOC.estado === 'perdiendo') return;
  const t = TIEMPO.t, cp = CAM.pos;
  for (const L of DATA.fn.luces) {
    if (L.d || Math.abs(L.p[0] - cp.x) > 26 || Math.abs(L.p[2] - cp.z) > 26) continue;
    const k = 3.2 * (0.93 + 0.07 * Math.sin(t * 13 + L.p[0] * 7) * Math.sin(t * 3.1 + L.p[2]));
    luzPuntual(v3(L.p[0], L.p[1], L.p[2]), L.r * 1.25, [L.c[0] * k, L.c[1] * k, L.c[2] * k]);
  }
}
// la luz de relleno: oscuro, pero que se vea por dónde se camina; las cámaras ven en la oscuridad (como las infrarrojas)
function nocheAmbiente() {
  const fis = GFX.luz >= 2, apagon = NOC.estado === 'apagon' || NOC.estado === 'perdiendo';
  let b = fis ? 0.17 : 0.11;
  if (apagon) b *= 0.35;
  if (NOC.cam !== null) b = fis ? 0.36 : 0.3;
  R.ambS = [b, b, b * 1.18]; R.ambG = [b * 0.75, b * 0.75, b * 0.85];
}

// ---------------- sonidos ----------------
function nocheSonidos(dt) {
  const apagon = NOC.estado === 'apagon' || NOC.estado === 'perdiendo', juega = NOC.estado === 'juega' || apagon;
  if (!apagon && juega) bucle('fn_vent', 'fn_ventilador', v3(-19.5, 1.6, 0.4), 0.55);
  for (const lado of ['izq', 'der']) if (NOC.luz[lado] && !apagon) bucle('fn_luz_' + lado, 'fn_zumbido', v3(-22.4, 3, lado === 'izq' ? -2.4 : 2.4), 0.5);
  if (juega) bucle('fn_amb', 'fn_ambiente', null, 0.2);
  if (NOC.cam !== null) bucle('fn_est', 'fn_estatica', null, NOC.ruidoT > 0 ? 0.45 : 0.1);
  if (NOC.cam !== null && NOC_CAMS[NOC.cam][0] < 0 && NOC.anim.some((A) => A.sala === 'cocina' && !A.ruta) && Math.random() < dt * 0.5) sonar('fn_ollas', null, 0.45, 0.9 + Math.random() * 0.2);   // (la cocina: sólo audio)
  if ((NOC.tAmb -= dt) <= 0) { NOC.tAmb = 25 + Math.random() * 40; if (NOC.estado === 'juega' && Math.random() < 0.5) sonar('fn_ninos', nocheSpot('comedor', 'C'), 0.35); }
}
function nocheAnimSonidos(A, dt) {
  const camina = A.clip === 'camina' || A.clip === 'corre'; if (!camina) return;
  if ((A.tPaso -= dt) > 0) return;
  A.tPaso = A.clip === 'corre' ? 0.28 : 0.62; A.pie++;
  sonar(A.clip === 'corre' ? (A.pie % 2 ? 'fn_corre1' : 'fn_corre2') : ['fn_paso1', 'fn_paso2', 'fn_paso3'][A.pie % 3], A.pos, A.clip === 'corre' ? 0.9 : 0.75, 0.9 + Math.random() * 0.15);
}
// la llamada de cada noche (1 a 4) por el parlante, con "Silenciar llamada" (y en el menú se pueden apagar todas)
const nocheLlamadaNombre = () => 'fn_llamada' + NOC.noche + (/^es/.test(PREFS.lang || PREFS.idioma || 'es') ? '_es' : '_en');
function nocheLlamada(intento) {
  if (NOC.llamada || NOC.mudo || NOC.noche > 4 || NOC.estado !== 'juega' || nochePref('llamadas') === false) return;
  const n = nocheLlamadaNombre();
  if (!audioBuf(n)) { if ((intento || 0) < 25) setTimeout(() => nocheLlamada((intento || 0) + 1), 400); return; }   // (todavía decodificando)
  const s = sonar(n, null, 0.95); if (!s) return;
  NOC.llamada = s; s.onended = () => { if (NOC.llamada === s) { NOC.llamada = null; NOC.ui.mudo.classList.add('oc'); } };
  NOC.ui.mudo.classList.remove('oc');
}
function nocheLlamadaCortar() { if (NOC.llamada) { try { NOC.llamada.stop(); } catch (e) {} NOC.llamada = null; } if (NOC.ui) NOC.ui.mudo.classList.add('oc'); }
function nochePref(k, v) {
  let o = {}; try { o = JSON.parse(localStorage.getItem('rb_fn') || '{}') || {}; } catch (e) {}
  if (v === undefined) return o[k];
  o[k] = v; try { localStorage.setItem('rb_fn', JSON.stringify(o)); } catch (e) {}
  return v;
}
function nocheProgreso(n) { const m = nochePref('max') || 1; if (n >= m && n < 7) nochePref('max', Math.min(7, n + 1)); }

// ---------------- dibujo ----------------
function nocheDibujar() {
  if (!NOC.on) return;
  for (const A of NOC.anim) A.md.encolar();
  if (NOC.susto && NOC.susto.tres && !NOC.susto.est) NOC.susto.tres.md.encolar();
}

// ---------------- cámaras de seguridad (G) ----------------
function nocheTablet() {
  if (!NOC.on || NOC.estado === 'intro' || NOC.estado === 'menu') return;
  if (NOC.cam !== null) { if (NOC.esp && NOC.esp.modo === 'cams') return; cerrarPaneles(); return; }
  if (NOC.estado === 'apagon' || NOC.estado === 'perdiendo') { sonar('fn_error', null, 0.7); return; }
  if (UI.abierto && UI.abierto !== 'fnesp') return;
  NOC.cam = NOC.camUlt || 0; UI.abierto = 'fncam'; soltarPuntero(); NOC.ui.cam.classList.remove('oc'); NOC.camT = 0; NOC.ruidoT = 0.5; document.body.classList.add('fnCam');
  sonar('fn_tablet', null, 0.7); nocheCamPintar();
}
function nocheCamElegir(i) { NOC.cam = NOC.camUlt = ((i % NOC_CAMS.length) + NOC_CAMS.length) % NOC_CAMS.length; NOC.camT = 0; NOC.ruidoT = 0.35; sonar('fn_blip', null, 0.6); nocheCamPintar(); }
function nocheCamCerrar() {
  if (NOC.cam === null) return;
  NOC.cam = null; document.body.classList.remove('fnCam'); if (NOC.ui) NOC.ui.cam.classList.add('oc');
  if (UI.abierto === 'fncam') UI.abierto = NOC.esp ? 'fnesp' : null;
  sonar('fn_tablet', null, 0.5, 0.8);
}
function nocheCamara(out, dt) {
  if (!NOC.on) return;
  if (NOC.esp && NOC.cam === null) { nocheEspCamara(out); return; }
  if (NOC.cam === null) return;
  const k = NOC_CAMS[NOC.cam], c = DATA.fn.camaras[k[0]];
  NOC.camT += dt; NOC.ruidoT = Math.max(0, NOC.ruidoT - dt);
  if (!c) { out.pos.set(-15, 30, 12); out.q.copy(Quat.euler(0, 1.5, 0)); return; }   // (la cocina no tiene cámara: no se ve nada)
  let f = c.f; if (k[4]) { const s = nocheSpot(k[4], { esqO: 'B', esqE: 'C' }[k[4]] || 'F'), d = v3(s.x - c.p[0], s.y + 1.1 - c.p[1], s.z - c.p[2]).norm(); f = [d.x, d.y, d.z]; }   // (apunta a donde se paran)
  const yaw0 = Math.atan2(f[0], f[2]), pitch = Math.asin(-f[1]) + (k[4] ? 0 : 0.08), gira = Math.sin(NOC.camT * 0.35) * (k[4] ? 0.12 : 0.32);   // (se va moviendo de un lado al otro, como en FNAF)
  out.pos.set(c.p[0], c.p[1], c.p[2]); out.q.copy(Quat.euler(yaw0 + gira, pitch, 0));
}
function nocheCamPintar() {
  const U = NOC.ui; if (!U) return; const k = NOC_CAMS[NOC.cam];
  U.camTit.innerHTML = 'CAM ' + k[1] + '<small>' + esc(T(k[2])) + '</small>';
  U.audio.classList.toggle('oc', k[0] >= 0);
  U.camMapa.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('sel', +b.dataset.c === NOC.cam));
}

// ---------------- linterna (L) ----------------
function nocheLinterna() { if (!NOC.on || NOC.esp) return; NOC.linterna = !NOC.linterna; sonar('IT_linterna', null, 0.55, NOC.linterna ? 1.05 : 0.9); NOC.ui.lin.classList.toggle('on', NOC.linterna); }

// ---------------- sustos ----------------
function nocheSusto(quien) {
  if (NOC.susto) return;
  nocheCamCerrar(); cerrarPaneles(); nocheLlamadaCortar();
  const nom = quien === 'apagon' ? 'fn_susto_apagon' : 'fn_susto_' + quien.toLowerCase(), v = NOC.ui.video;
  NOC.ui.susto.classList.remove('oc', 'est', 'tres'); NOC.susto = { t: 0, fin: false };
  // si el navegador no puede con el video: el animatrónico de verdad, en 3D, saltándote encima
  const tres = () => { const S = NOC.susto; if (!S || S.tres || S.est) return; S.tres = nocheAnimCrear(NOC_K[Math.max(0, ['Freddy', 'Bonnie', 'Chica', 'Foxy'].indexOf(quien))]); nocheAnimClip(S.tres, 'susto'); S.tres.prev = null; S.t = 0; NOC.ui.susto.classList.add('tres'); sonar('fn_grito', null, 1); };
  v.onerror = tres;
  if (!v.canPlayType('video/mp4')) tres();
  else { v.src = PK.url('v:' + nom, 'video/mp4'); v.currentTime = 0; v.muted = !PREFS.vol; v.volume = Math.min(1, (PREFS.vol || 0) / 100 * 1.2); const p = v.play(); if (p && p.catch) p.catch(tres); }
  CAM.temblor = 1.4; UI.abierto = 'fnsusto'; document.body.classList.add('fnSusto');
}
// el susto termina antes de tiempo (Game Over, el menú, otra noche): sin video ni estática encima
function nocheSustoFin() {
  if (!NOC.susto) return;
  NOC.susto = null; NOC.ui.susto.classList.add('oc'); document.body.classList.remove('fnSusto'); if (UI.abierto === 'fnsusto') UI.abierto = null;
  try { NOC.ui.video.pause(); } catch (e) {}
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
    // en una sala, si quedan otros: a espectar hasta que termine la noche
    if (NOC.fuera.has(miId()) && enSala() && nocheVivos().length && NOC.estado === 'juega') nocheEspEntrar();
  }
}

// ---------------- espectador (en una sala, al que agarraron) ----------------
function nocheEspEntrar() {
  NOC.esp = { modo: 'seguir', i: 0, tercera: false }; NOC.linterna = false; NOC.ui.lin.classList.remove('on');
  document.body.classList.add('fnEsp'); NOC.ui.esp.classList.remove('oc'); nocheEspModo('seguir'); aviso(T('fn.mirar'), 4);
}
function nocheEspSalir() {
  if (!NOC.esp) return;
  NOC.esp = null; document.body.classList.remove('fnEsp'); if (NOC.ui) NOC.ui.esp.classList.add('oc');
  if (UI.abierto === 'fnesp') UI.abierto = null; JUG.noclip = false;
}
function nocheEspModo(m) {
  const E = NOC.esp; if (!E) return;
  if (m === 'seguir' && !nocheEspObjetivos().length) m = 'libre';
  E.modo = m; nocheCamCerrar();
  if (m === 'cams') { UI.abierto = null; nocheTablet(); }
  else if (m === 'libre') { UI.abierto = null; JUG.noclip = true; JUG.pos.copy(CAM.pos); JUG.pos.y -= 0.6; }
  else { UI.abierto = 'fnesp'; soltarPuntero(); }
  nocheEspPintar();
}
function nocheEspObjetivos() { return enSala() ? [...RED.remotos.values()].filter((R2) => !NOC.fuera.has(R2.id) && !(R2.f & 256)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')) : []; }
function nocheEspPaso() {
  const E = NOC.esp; if (E.modo === 'seguir' && !nocheEspObjetivos().length) nocheEspModo('libre');
  if (E.modo === 'cams' && NOC.cam === null && UI.abierto !== 'fncam') nocheEspModo('seguir');
  nocheEspPintar();
}
function nocheEspCamara(out) {
  const E = NOC.esp; if (E.modo !== 'seguir') return;
  const L = nocheEspObjetivos(); if (!L.length) return; const R2 = L[((E.i % L.length) + L.length) % L.length];
  const q = Quat.euler(R2.yaw, R2.P.mira || 0), ojo = vadd(R2.pos, v3(0, 0.62, 0));
  if (!E.tercera) { out.pos.copy(ojo); out.q.copy(q); return; }
  const atras = vscale(q.rot(v3(0, 0, 1)), -1), h = mundoRayo(ojo, atras, 2.9);
  out.pos.copy(ojo).addS(atras, h ? Math.max(0.3, h.t - 0.3) : 2.6); out.pos.y += 0.25; out.q.copy(q);
}
function nocheEspPintar() {
  const E = NOC.esp, U = NOC.ui; if (!E || !U) return;
  const L = nocheEspObjetivos(), R2 = L.length ? L[((E.i % L.length) + L.length) % L.length] : null;
  const txt = E.modo === 'seguir' && R2 ? R2.nombre || '?' : E.modo === 'libre' ? T('fn.libre') : T('fn.camaras');
  if (U.espNomT !== txt) { U.espNomT = txt; U.espNom.textContent = txt; }
  U.esp.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('sel', b.dataset.m === E.modo || (b.dataset.m === 'tercera' && E.tercera)));
}
function nocheEspTecla(dir) {
  const E = NOC.esp; if (!E) return false;
  if (E.modo === 'cams') { nocheCamElegir(NOC.cam + dir); return true; }
  if (E.modo !== 'seguir') nocheEspModo('seguir');
  E.i += dir; nocheEspPintar(); return true;
}

// ---------------- menú de noches (solo), intro, 6 AM, Game Over ----------------
function nocheMenu(si) {
  const U = NOC.ui; if (!U) return;
  if (!si) { U.menu.classList.add('oc'); if (UI.abierto === 'fnmenu') UI.abierto = null; return; }
  nocheSustoFin(); U.go.classList.add('oc'); if (UI.abierto === 'fngo') UI.abierto = null;
  const max = nochePref('max') || 1, ll = nochePref('llamadas') !== false, pers = nochePref('pers') || [1, 2, 3, 3];
  U.menu.innerHTML = `<div class="fnMenuC"><h2>${esc(T('m.RB_Pizzeria'))}</h2>
    <button data-n="1">${esc(T('fn.nueva'))}</button>
    ${max > 1 ? `<button data-n="${Math.min(5, max)}">${esc(T('fn.continuar'))} · ${esc(T('fn.noche'))} ${Math.min(5, max)}</button>` : ''}
    ${max >= 6 ? `<button data-n="6">${esc(T('fn.noche'))} 6</button>` : ''}
    ${max >= 7 ? `<div class="fnPers">${NOC_K.map((k, i) => `<label>${NOC_NOM[k]} <input type="range" min="0" max="20" value="${pers[i]}" data-p="${i}"><b>${pers[i]}</b></label>`).join('')}<button data-n="7">${esc(T('fn.pers'))}</button></div>` : ''}
    <label class="fnLl"><input type="checkbox" id="fnLlam" ${ll ? 'checked' : ''}> ${esc(T('fn.llamadas'))}</label></div>`;
  U.menu.querySelectorAll('[data-p]').forEach((r) => (r.oninput = () => { r.nextElementSibling.textContent = r.value; }));
  U.menu.querySelector('#fnLlam').onchange = (e) => nochePref('llamadas', e.target.checked);
  U.menu.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => {
    const n = +b.dataset.n, p = [...U.menu.querySelectorAll('[data-p]')].map((r) => +r.value);
    if (n === 7) nochePref('pers', p);
    nocheMenu(false); sonar('fn_blip', null, 0.7); nocheEmpezarNoche(n, n === 7 ? p : null);
  }));
  U.menu.classList.remove('oc'); UI.abierto = 'fnmenu'; soltarPuntero();
}
function nocheGameOver() {
  const U = NOC.ui; nocheSustoFin(); sonar('fn_gameover', null, 0.7);
  U.go.innerHTML = `<b>GAME OVER</b>${enSala() ? `<small>${esc(T('fn.noche'))} ${NOC.noche}…</small>` : `<div><button data-r="1">${esc(T('fn.reintentar'))}</button><button data-r="0">${esc(T('fn.menu'))}</button></div>`}`;
  U.go.classList.remove('oc'); U.go.classList.add('est'); setTimeout(() => U.go.classList.remove('est'), 2600);
  if (!enSala()) { UI.abierto = 'fngo'; soltarPuntero(); }
  U.go.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => { U.go.classList.add('oc'); if (UI.abierto === 'fngo') UI.abierto = null; if (b.dataset.r === '1') nocheEmpezarNoche(NOC.noche, NOC.pers); else { NOC.estado = 'menu'; NOC.estT = 0; nocheMenu(true); } }));
}

// ---------------- pantalla ----------------
function nocheUI() {
  if (NOC.ui) { NOC.ui.raiz.classList.remove('oc'); return; }
  const est = 'url(' + 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><filter id="f"><feTurbulence baseFrequency=".9" numOctaves="1" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#f)" opacity=".9"/></svg>') + ')';
  const st = document.createElement('style');
  st.textContent = `#fnRaiz{position:fixed;inset:0;pointer-events:none;z-index:6;font-family:inherit;color:#e8e8e8}
#fnRaiz.oc{display:none}
#fnHora{position:absolute;top:calc(env(safe-area-inset-top) + 58px);right:calc(env(safe-area-inset-right) + 14px);text-align:right;text-shadow:0 1px 3px #000}
#fnHora b{display:block;font-size:30px;letter-spacing:1px}#fnHora small{font-size:14px;opacity:.85}
#fnPoder{position:absolute;left:calc(env(safe-area-inset-left) + 12px);bottom:calc(env(safe-area-inset-bottom) + 34px);font-size:14px;text-shadow:0 1px 3px #000}
#fnPoder i{display:inline-block;width:9px;height:14px;margin-right:2px;background:#5ad35a;vertical-align:-2px}#fnPoder i.r{background:#e2c33b}#fnPoder i.rr{background:#e04a3a}
#fnBtns{position:absolute;right:calc(env(safe-area-inset-right) + 14px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:10px;pointer-events:auto}
#fnBtns div{width:46px;height:46px;border-radius:50%;background:rgba(20,22,28,.72);display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid transparent}
#fnBtns div.on{border-color:#f2d36b;background:rgba(80,70,30,.8)}#fnBtns svg{width:24px;height:24px}
#fnMudo{position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 12px);transform:translateX(-50%);padding:7px 16px;background:rgba(20,22,28,.85);border:1px solid #889;pointer-events:auto;cursor:pointer;font-size:14px;border-radius:4px}
#fnCam{position:absolute;inset:0;pointer-events:auto}
#fnRuido{position:absolute;inset:0;width:100%;height:100%;opacity:.07;mix-blend-mode:screen;image-rendering:pixelated;transition:opacity .15s}#fnCam.mov #fnRuido{opacity:.55}
#fnCam:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.1) 0 2px,transparent 2px 4px);pointer-events:none}
#fnAudio{position:absolute;inset:0;background:#000;display:flex;align-items:center;justify-content:center;font-size:22px;letter-spacing:2px;color:#bbb}
#fnCamTit{position:absolute;left:calc(env(safe-area-inset-left) + 22px);top:calc(env(safe-area-inset-top) + 64px);font-size:30px;text-shadow:0 1px 3px #000}
#fnCamTit small{display:block;font-size:15px;opacity:.85}
#fnRec{position:absolute;left:calc(env(safe-area-inset-left) + 24px);top:calc(env(safe-area-inset-top) + 40px);width:14px;height:14px;border-radius:50%;background:#e33;animation:fnRec 1s steps(2) infinite}
@keyframes fnRec{50%{opacity:0}}
#fnMapa{position:absolute;right:calc(env(safe-area-inset-right) + 14px);bottom:calc(env(safe-area-inset-bottom) + 14px);width:220px;height:240px;background:rgba(0,0,0,.5) center/100% 100% no-repeat;border:1px solid rgba(255,255,255,.25)}
#fnMapa b{position:absolute;transform:translate(-50%,-50%);font-size:11px;padding:3px 5px;background:#3c3f46;border:1px solid #9aa;cursor:pointer;font-weight:normal;color:#eee}
#fnMapa b.sel{background:#3d8d3d}#fnMapa b.yo{display:none}
#fnCerrar{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 14px);transform:translateX(-50%);padding:8px 26px;background:rgba(20,22,28,.8);border:1px solid #889;cursor:pointer;font-size:14px}
#fnSusto{position:absolute;inset:0;background:#000;pointer-events:auto}
#fnSusto video{width:100%;height:100%;object-fit:cover}#fnSusto.est video,#fnSusto.tres video{display:none}#fnSusto.tres:not(.est){background:transparent}
#fnSusto.est:after,#fnGo.est:after{content:'';position:absolute;inset:0;background:${est};background-size:cover;animation:fnEst .12s steps(3) infinite}
@keyframes fnEst{33%{background-position:7px 3px}66%{background-position:-5px 9px}}
#fnTapa{position:absolute;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .8s;pointer-events:auto}
#fnTapa b{font-size:56px;letter-spacing:3px}#fnTapa small{font-size:24px;margin-top:6px;opacity:.9}
#fnTapa .rueda{height:66px;overflow:hidden;font-size:56px;font-weight:bold}#fnTapa .rueda i{display:block;font-style:normal;transition:transform 2.2s cubic-bezier(.6,0,.3,1) 1.2s}
#fnTapa .rueda.va i{transform:translateY(-66px)}
#fnGo{position:absolute;inset:0;background:#000;pointer-events:auto;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-end;padding:0 6% 7%}
#fnGo b{font-size:46px;letter-spacing:4px;z-index:1}#fnGo small{font-size:18px;z-index:1;opacity:.8}#fnGo div{z-index:1;display:flex;gap:10px;margin-top:14px}
#fnGo button,#fnMenu button{font:inherit;font-size:17px;color:#eee;background:rgba(30,32,40,.9);border:1px solid #889;padding:9px 20px;cursor:pointer}
#fnGo button:hover,#fnMenu button:hover{background:#3d8d3d}
#fnMenu{position:absolute;inset:0;background:rgba(0,0,0,.82);pointer-events:auto;display:flex;align-items:center;justify-content:center}
.fnMenuC{display:flex;flex-direction:column;gap:9px;min-width:260px;max-width:92vw}.fnMenuC h2{font-size:30px;margin:0 0 10px;letter-spacing:1px}
.fnPers{display:flex;flex-direction:column;gap:4px;padding:8px;border:1px solid #445;margin-top:6px}.fnPers label{display:flex;align-items:center;gap:8px;font-size:14px}.fnPers input{flex:1}.fnPers b{width:22px;text-align:right}
.fnLl{font-size:14px;opacity:.9;margin-top:6px}
#fnEsp{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 14px);transform:translateX(-50%);display:flex;align-items:center;gap:6px;pointer-events:auto;background:rgba(10,12,16,.75);padding:6px 8px;border:1px solid #556;border-radius:4px;font-size:14px;flex-wrap:wrap;justify-content:center;max-width:94vw}
#fnEsp span{min-width:90px;text-align:center;font-weight:bold}#fnEsp div{padding:6px 10px;border:1px solid #667;cursor:pointer}#fnEsp div.sel{background:#3d8d3d}
#fnEspTit{position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 50px);transform:translateX(-50%);font-size:13px;opacity:.75;letter-spacing:1px}
body.tactil #fnHora{top:calc(env(safe-area-inset-top) + 50px)}body.tactil #fnBtns{top:calc(env(safe-area-inset-top) + 150px);transform:none;right:calc(env(safe-area-inset-right) + 10px)}
body.tactil #fnPoder{left:auto;bottom:auto;right:calc(env(safe-area-inset-right) + 14px);top:calc(env(safe-area-inset-top) + 100px);text-align:right;font-size:12px}
body.tactil #fnMapa{transform:scale(.78);transform-origin:right bottom}
body.fnCam #hud,body.fnSusto #hud,body.fnEsp #hud,body.fnCam #fnBtns,body.fnEsp #fnBtns,body.fnEsp #fnPoder{visibility:hidden}
body.fnCam.fnEsp #fnCerrar{display:none}`;
  document.head.appendChild(st);
  const r = document.createElement('div'); r.id = 'fnRaiz';
  const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${d}</svg>`;
  r.innerHTML = `<div id="fnHora"><b>12 AM</b><small></small></div><div id="fnPoder"></div>
<div id="fnBtns"><div id="fnLin" title="L">${ico('<path d="M8 3h8l-1 6H9z"/><path d="M9 9h6v12H9z"/><path d="M12 13v3"/>')}</div><div id="fnCamB" title="G">${ico('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>')}</div></div>
<div id="fnMudo" class="oc"></div>
<div id="fnCam" class="oc"><div id="fnAudio" class="oc"></div><canvas id="fnRuido" width="160" height="90"></canvas><div id="fnRec"></div><div id="fnCamTit"></div><div id="fnMapa"></div><div id="fnCerrar">✕</div></div>
<div id="fnEsp" class="oc"><div data-d="-1">◀</div><span></span><div data-d="1">▶</div><div data-m="seguir"></div><div data-m="tercera"></div><div data-m="libre"></div><div data-m="cams"></div></div>
<div id="fnSusto" class="oc"><video playsinline preload="auto"></video></div><div id="fnTapa" class="oc"></div><div id="fnGo" class="oc"></div><div id="fnMenu" class="oc"></div>`;
  document.body.prepend(r);   // (antes que los paneles del juego: la pausa queda encima)
  const q = (s) => r.querySelector(s);
  const U = (NOC.ui = { raiz: r, hora: q('#fnHora b'), noche: q('#fnHora small'), poder: q('#fnPoder'), lin: q('#fnLin'), cam: q('#fnCam'), camTit: q('#fnCamTit'), camMapa: q('#fnMapa'),
    ruido: q('#fnRuido'), audio: q('#fnAudio'), susto: q('#fnSusto'), video: q('video'), tapa: q('#fnTapa'), go: q('#fnGo'), menu: q('#fnMenu'), mudo: q('#fnMudo'), esp: q('#fnEsp'), espNom: q('#fnEsp span') });
  U.audio.textContent = T('fn.soloAudio'); U.mudo.textContent = T('fn.silenciar');
  U.mudo.onclick = () => { NOC.mudo = true; nocheLlamadaCortar(); };
  // el plano de las cámaras: el mapa visto de arriba (la oficina abajo, el escenario arriba) y cada cámara donde está
  const M = DATA.fn.mapa || null;
  if (M) U.camMapa.style.backgroundImage = 'url(' + icono('fn_mapa') + ')';
  const X = (z) => M ? (z - M.z0) / (M.z1 - M.z0) * 220 : 110, Y = (x) => M ? (M.x1 - x) / (M.x1 - M.x0) * 240 : 120;
  U.camMapa.innerHTML = NOC_CAMS.map((k, i) => { const c = k[0] >= 0 ? DATA.fn.camaras[k[0]].p : (() => { const s = nocheSpot(k[3], 'F'); return [s.x, s.y, s.z]; })(); return `<b data-c="${i}" style="left:${X(c[2])}px;top:${Y(c[0])}px">${k[1]}</b>`; }).join('');
  U.camMapa.querySelectorAll('[data-c]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); nocheCamElegir(+b.dataset.c); }));
  q('#fnCerrar').onclick = () => nocheTablet();
  U.lin.onclick = () => nocheLinterna(); q('#fnCamB').onclick = () => nocheTablet();
  // espectador: anterior/siguiente, 1ª o 3ª persona, libre y cámaras
  const eb = (m, t) => { const b = q(`#fnEsp [data-m="${m}"]`); b.textContent = t; b.onclick = () => { if (m === 'tercera') { NOC.esp.tercera = !NOC.esp.tercera; nocheEspModo('seguir'); } else nocheEspModo(m); }; };
  eb('seguir', T('fn.seguir')); eb('tercera', T('fn.tercera')); eb('libre', T('fn.libre')); eb('cams', T('fn.camaras'));
  r.querySelectorAll('#fnEsp [data-d]').forEach((b) => (b.onclick = () => nocheEspTecla(+b.dataset.d)));
  // flechas: cambiar de cámara o de jugador
  addEventListener('keydown', (e) => {
    if (!NOC.on || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const dir = e.key === 'ArrowLeft' ? -1 : 1;
    if (NOC.esp) { nocheEspTecla(dir); e.preventDefault(); } else if (NOC.cam !== null) { nocheCamElegir(NOC.cam + dir); e.preventDefault(); }
  });
  // estática de las cámaras: ruido en un lienzo chico, estirado (más fuerte un rato cuando algo se mueve en la que mirás)
  const g = U.ruido.getContext('2d'), im = g.createImageData(160, 90);
  setInterval(() => { if (NOC.cam === null) return; U.cam.classList.toggle('mov', NOC.ruidoT > 0); const d = im.data; for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } g.putImageData(im, 0, 0); }, 70);
}
function nocheHUD() {
  const U = NOC.ui; if (!U) return;
  const h = Math.min(6, Math.floor(NOC.hora)), txt = (h === 0 ? 12 : h) + ' AM';
  if (U.hT !== txt) { U.hT = txt; U.hora.textContent = txt; }
  const nt = NOC.noche === 7 ? T('fn.pers') : T('fn.noche') + ' ' + NOC.noche; if (U.nT !== nt) { U.nT = nt; U.noche.textContent = nt; }
  const p = Math.ceil(NOC.poder), uso = nocheUso(), key = p + '|' + uso + '|' + NOC.estado;
  if (U.pT !== key) {
    U.pT = key; let b = ''; for (let i = 0; i < Math.min(5, uso); i++) b += `<i class="${i >= 3 ? 'rr' : i >= 2 ? 'r' : ''}"></i>`;
    U.poder.innerHTML = esc(T('fn.energia')) + ': <b>' + Math.max(0, p) + '%</b><br>' + esc(T('fn.uso')) + ': ' + b;
  }
  // la tapa negra: "12:00 AM · Noche N" al empezar; "5 AM → 6 AM" al ganar
  const tapa = NOC.estado === 'intro' ? 'intro' + NOC.noche : NOC.estado === 'gano' ? 'gano' + NOC.noche : '';
  if (U.tapaT !== tapa) {
    U.tapaT = tapa;
    if (!tapa) { U.tapa.classList.add('oc'); document.body.classList.remove('fnTapa'); if (UI.abierto === 'fntapa') UI.abierto = null; }
    else {
      U.tapa.innerHTML = NOC.estado === 'intro' ? `<b>12:00 AM</b><small>${esc(NOC.noche === 7 ? T('fn.pers') : T('fn.noche') + ' ' + NOC.noche)}</small>` : `<div class="rueda"><i>5</i><i>6</i></div><b style="font-size:40px">AM</b>`;
      U.tapa.classList.remove('oc'); U.tapa.style.opacity = 1; document.body.classList.add('fnTapa'); nocheCamCerrar(); if (!UI.abierto) UI.abierto = 'fntapa';
      if (NOC.estado === 'gano') requestAnimationFrame(() => requestAnimationFrame(() => { const w = U.tapa.querySelector('.rueda'); if (w) w.classList.add('va'); }));
    }
  }
  if (tapa && NOC.estado === 'intro') U.tapa.style.opacity = NOC.estT > 3.2 ? Math.max(0, 1 - (NOC.estT - 3.2) / 0.8) : 1;
}
