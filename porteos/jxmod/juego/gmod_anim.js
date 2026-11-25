// ---------------- las entidades animadas de los addons (CBaseAnimating de Source): secuencias, huesos, enganches y bonemerge ----------------
// En GMod cualquier entidad con modelo es «animable»: SetSequence/ResetSequence ponen una secuencia del .mdl, SetCycle y
// GetCycle dicen por dónde va, la entidad con AutomaticFrameAdvance (o un ClientsideModel con FrameAdvance) la avanza, y
// los huesos (LookupBone, GetBonePosition, GetBoneMatrix) y los enganches (GetAttachment) salen de esa pose. Con
// AddEffects(EF_BONEMERGE) y SetParent una entidad copia los huesos de su padre que se llaman igual (así se viste un
// esqueleto animado con otro modelo: el modelo de jugador sobre las animaciones de una ejecución de BSMod, las piernas de
// la patada, la ropa y los gorros). Antes acá todo eso respondía algo fijo (secuencia 0, duración 1, sin huesos, el
// enganche en el origen) y esas entidades quedaban quietas en la pose de referencia o no se veían.
// Los personajes del juego (el Hero, Goku, los NPC con skin del juego) no son .mdl: Entity:GetModel les da un modelo
// propio («models/jxmod/<skin>.mdl») y, pegado con bonemerge a un esqueleto de Valve, se dibuja el personaje con el
// esqueleto de Valve llevado al suyo (el mismo cálculo que gmod_pm.js hace al revés: giro relativo al reposo, alineado
// por la dirección de cada hueso) y, como el bonemerge de GMod con un modelo de otras medidas, cada articulación donde está
// la de Valve y el hueso estirado lo que haga falta: los golpes y los agarres caen en el mismo lugar que en GMod.
const GMAN = { defs: new Map(), virt: new Map(), cuadro: 0, serie: 0, perfiles: new Map(), perfilSkin: new Map() };
const GMAN_VIRT = /^models\/jxmod\/[^/]+\.mdl$/;
const gmanRuta = (m) => { let r = String(m || '').toLowerCase().replace(/\\/g, '/').replace(/^\/+/, ''); if (r && !r.startsWith('models/')) r = 'models/' + r; return r; };
// (los nombres de Valve con las mayúsculas de sus modelos: l_upperarm → ValveBiped.Bip01_L_UpperArm)
const gmanNomVB = (k) => 'ValveBiped.Bip01_' + k.replace(/(^|_)([a-z])/g, (x, a, c) => a + c.toUpperCase()).replace('Upperarm', 'UpperArm');
// el padre de cada hueso del esqueleto de Valve (por su clave de GMP_VB)
function gmanPadreVB(k) {
  if (k === 'pelvis') return null; if (k === 'spine') return 'pelvis'; if (k === 'spine1') return 'spine'; if (k === 'spine2') return 'spine1'; if (k === 'spine4') return 'spine2';
  if (k === 'neck1') return 'spine4'; if (k === 'head1') return 'neck1';
  const m = /^([lr])_(.+)$/.exec(k); if (!m) return 'pelvis'; const l = m[1], r = m[2];
  const P = { clavicle: 'spine4', upperarm: l + '_clavicle', forearm: l + '_upperarm', hand: l + '_forearm', thigh: 'pelvis', calf: l + '_thigh', foot: l + '_calf', toe0: l + '_foot' }[r];
  if (P) return P.includes('_') || P.startsWith('spine') || P === 'pelvis' ? P : P;
  const f = /^finger(\d)(\d?)$/.exec(r); if (!f) return 'pelvis';
  return f[2] === '' ? l + '_hand' : f[2] === '1' ? l + '_finger' + f[1] : l + '_finger' + f[1] + '1';
}

// ---- el modelo de los personajes del juego (Entity:GetModel) ----
function gmanModeloPersona(P) {
  const r = P && P.gmpRuta ? String(P.gmpRuta).toLowerCase() : '';
  if (r && !/^jxpj\//.test(r)) return r;   // (un modelo de jugador de GMod: su .mdl de verdad)
  const skin = (P && P.skin) || 'Hero', ruta = 'models/jxmod/' + String(skin).toLowerCase().replace(/[^a-z0-9_.-]+/g, '_') + '.mdl';
  const x = GMAN.virt.get(ruta), gorro = (P && P.gorro) || 'HatEmpty';
  if (!x || x.skin !== skin || x.gorro !== gorro) GMAN.virt.set(ruta, { skin, gorro });
  return ruta;
}

// ---- lo que se sabe de un modelo: huesos, secuencias, enganches y (si tiene) su malla ----
function gmanDef(ruta) {
  ruta = gmanRuta(ruta); if (!ruta) return null;
  const vx = GMAN.virt.get(ruta); if (vx) return gmanDefVirtual(ruta, vx);
  if (GMAN.defs.has(ruta)) return GMAN.defs.get(ruta);
  const b = gmArchivo(ruta); if (!b) return null;   // (todavía no llegó: se vuelve a probar)
  if (gmvEnCamino(ruta)) return null;   // (sus piezas —.vvd, .vtx— están llegando de la biblioteca)
  let M = null, conMalla = false;
  try { M = gmLeerModelo(ruta); conMalla = true; } catch (e) {
    if (e && e.pendiente) return null;   // (su geometría se está leyendo del disco)
    // (sin malla —.vvd vacío—: sólo huesos y animaciones, como las de BSMod o las c_ de los brazos)
    try { M = GMF.mdl(b); M.mallas = []; gmAniCargar(M); gmIncluidos(M, 0); } catch (e2) { GMAN.defs.set(ruta, null); return null; }
  }
  if (!M || !M.huesos || !M.huesos.length) { GMAN.defs.set(ruta, null); return null; }
  const H = M.huesos, nb = H.length, S = GM_S;
  const pv = (p) => [S * p[1], S * p[2], S * p[0]], rot = (q) => [q[1], q[2], q[0], q[3]];   // (Source → juego: x, y, z → y, z, x)
  const arb = [{ n: 'GMAN_' + ++GMAN.serie, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1 }];
  for (const h of H) arb.push({ n: h.n, p: pv(h.pos), r: rot(h.q), s: [1, 1, 1], pa: h.pa >= 0 ? 1 + h.pa : 0 });
  // (con malla: la de gmod_pm.js, que ya parte la piel por grupos de huesos; los props sin esqueleto no se animan)
  let gp = null; if (conMalla && nb > 2 && typeof gmpDef === 'function') { try { gp = gmpDef(ruta); } catch (e) { gp = null; } if (gp && gp.nb !== nb) gp = null; }
  const porNombre = new Map(); H.forEach((h, i) => { const k = h.n.toLowerCase(); if (!porNombre.has(k)) porNombre.set(k, i); });
  const md = new Modelo(arb); md.actualizar(); const restW = md.W.map((w) => Float32Array.from(w));
  const def = { ruta, M, nb, arb, pv, rot, gp, conMalla, porNombre, restW, virt: false, nombres: H.map((h) => h.n), padres: H.map((h) => h.pa) };
  GMAN.defs.set(ruta, def); return def;
}
// el de un personaje del juego: el esqueleto de Valve con los nombres de siempre (para pegarse a uno de Valve)
function gmanDefVirtual(ruta, vx) {
  const k = ruta + '|' + vx.skin; let d = GMAN.defs.get(k); if (d) return d;
  const claves = gmhVB(), porNombre = new Map(), nombres = claves.map(gmanNomVB);
  nombres.forEach((n, i) => porNombre.set(n.toLowerCase(), i));
  const padres = claves.map((c) => { const p = gmanPadreVB(c); const i = p ? claves.indexOf(p) : -1; return i; });
  d = { ruta, virt: true, skin: vx.skin, vx, nb: claves.length, porNombre, nombres, padres, claves, M: null };
  GMAN.defs.set(k, d); return d;
}
// (el modelo de una entidad, por su ruta; una persona del juego, el suyo)
function gmanDefDe(e) {
  if (!(e instanceof LEnt)) return null;
  if (e.P && !e.modelo) return null;   // (las personas: gmod_pm.js —gmhApi— da sus huesos)
  return e.modelo ? gmanDef(e.modelo) : null;
}

// ---- la secuencia de una entidad ----
// (q: número o nombre; si el modelo todavía no llegó, queda pedida y se pone cuando llega)
function gmanSecuencia(e, q, reiniciar) {
  const d = gmanDefDe(e); if (!d || !d.M) { e.anPide = { q, reiniciar }; return 0; }
  const M = d.M; let i = -1;
  if (typeof q === 'number') i = q | 0; else if (q !== undefined && q !== null) { const s = String(q).toLowerCase(); i = M.secuencias.findIndex((x) => x.n.toLowerCase() === s); }
  if ((i < 0 || !M.secuencias[i]) && typeof gmIncluidosReintentar === 'function' && gmIncluidosReintentar(M) && typeof q === 'string') { const s = q.toLowerCase(); i = M.secuencias.findIndex((x) => x.n.toLowerCase() === s); }
  if (i < 0 || !M.secuencias[i]) { e.anPide = M.incFaltan && M.incFaltan.size ? { q, reiniciar } : null; return 0; }
  e.anPide = null;
  const sq = M.secuencias[i]; let ai = sq.anim; if (!M.anims[ai] && sq.grid) { ai = GMF.animDe(M, i, e.poseVals); if (!M.anims[ai]) ai = sq.grid.find((x) => x >= 0 && M.anims[x]); }
  const A = M.anims[ai]; if (!A) return 0;
  const dur = Math.max(0, (A.nf - 1) / (A.fps > 0 ? A.fps : 30)), an0 = e.an;
  // (SetSequence de la misma deja el ciclo; ResetSequence y una distinta empiezan del principio, como Source)
  const t = !reiniciar && an0 && an0.i === i ? an0.t : 0;
  e.an = { i, anim: ai, t, loop: sq.loop, dur, rate: an0 ? an0.rate : 1, ult: TIEMPO.t };
  return dur;
}
// ¿avanza sola? (ENT.AutomaticFrameAdvance de la clase o de la entidad —BSMod lo apaga al final de la ejecución para que
// quede en la última pose—, o SetAutomaticFrameAdvance). Los ClientsideModel no: los avanza el Lua con FrameAdvance
function gmanAuto(e) {
  if (e.cs) return false;
  if (e.anAuto !== undefined) return e.anAuto;
  const v = e.tabla && e.tabla.get('AutomaticFrameAdvance'); if (v !== undefined && v !== null) return v === true;
  const c = claseTabla(e.clase, 'S'); return !!(c && buscarEnClase(c, 'AutomaticFrameAdvance') === true);
}
// cada cuadro (gmaPaso): las que avanzan solas, y lo pedido antes de que llegara el modelo
function gmanPaso(dt) {
  GMAN.cuadro++;
  for (const e of GMA.ents.values()) {
    if (!e.vivo || e.nb) continue;
    if (e.anPide && gmanDefDe(e)) gmanSecuencia(e, e.anPide.q, e.anPide.reiniciar);
    const a = e.an; if (!a) continue;
    if (gmanAuto(e)) { a.t += dt * a.rate; a.ult = TIEMPO.t; }
  }
  try { gmanRedPaso(dt); } catch (x) { gmaErr('animación (red): ' + ((x && x.message) || x)); }
  if (typeof gmrgPaso === 'function') gmrgPaso();   // (los muñecos de cualquier modelo: gmod_rag.js)
  if (typeof gmbContextoPaso === 'function') { try { gmbContextoPaso(); } catch (x) {} }   // (el botón de ejecutar: gmod_panel.js)
  // (los modelos de personaje que se dibujaban y ya no: se sueltan)
  if (GMAN.cuadro % 120 === 0) for (const e of GMAN.pvs || []) if (!e.vivo) { GMAN.pvs.delete(e); e.anPv = null; }
}
const gmanCiclo = (a) => (!a || !(a.dur > 0) ? 0 : a.loop ? ((a.t / a.dur) % 1 + 1) % 1 : Math.max(0, Math.min(1, a.t / a.dur)));

// ---- la pose: las matrices del mundo de cada hueso (W[0] la entidad, W[1 + i] el hueso i), en los ejes del juego ----
const _anQ = [0, 0, 0, 1], _anP = [0, 0, 0], _anU = [1, 1, 1];
function gmanRaiz(e, out) {
  const p = e.rOrigen ? vG(e.rOrigen) : gmaEntPos(e), q = e.rAng ? angQuat(e.rAng) : entQ(e), s = typeof gmnbEscala === 'function' ? gmnbEscala(e) : +e.escala || 1;
  m4trs([p.x, p.y, p.z], [q.x, q.y, q.z, q.w], [s, s, s], out); return out;
}
// el estado de animación de una entidad: la suya, la de un nextbot (gmod_nextbot.js) o ninguna (la pose de referencia)
function gmanEstado(e) { if (e.nb && e.nbSec) return { anim: e.nbSec.anim, t: e.nbSec.t, loop: e.nbSec.loop, i: e.nbSec.i }; return e.an || null; }
function gmanLocal(d, st, i, P, Q, w, pa, pb) {
  const h = i;
  if (!pa) { const n = d.arb[1 + h]; P[0] = n.p[0]; P[1] = n.p[1]; P[2] = n.p[2]; Q[0] = n.r[0]; Q[1] = n.r[1]; Q[2] = n.r[2]; Q[3] = n.r[3]; return; }
  const S = GM_S, x = pa.P[h * 3] * (1 - w) + pb.P[h * 3] * w, y = pa.P[h * 3 + 1] * (1 - w) + pb.P[h * 3 + 1] * w, z = pa.P[h * 3 + 2] * (1 - w) + pb.P[h * 3 + 2] * w;
  P[0] = S * y; P[1] = S * z; P[2] = S * x;
  let bx = pb.Q[h * 4], by = pb.Q[h * 4 + 1], bz = pb.Q[h * 4 + 2], bw = pb.Q[h * 4 + 3]; const ax = pa.Q[h * 4], ay = pa.Q[h * 4 + 1], az = pa.Q[h * 4 + 2], aw = pa.Q[h * 4 + 3];
  if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
  const qx = ax + (bx - ax) * w, qy = ay + (by - ay) * w, qz = az + (bz - az) * w, qw = aw + (bw - aw) * w, l = Math.hypot(qx, qy, qz, qw) || 1;
  Q[0] = qy / l; Q[1] = qz / l; Q[2] = qx / l; Q[3] = qw / l;
}
// los cuadros de la animación de ese momento (con las capas de siempre del modelo)
function gmanCuadros(d, st) {
  if (!st || !d.M) return null;
  const M = d.M, A = M.anims[st.anim]; if (!A || !(A.nf > 0)) return null;
  const fps = A.fps > 0 ? A.fps : 30, n = Math.max(1, A.nf - 1), fr = st.loop ? ((st.t * fps) % n + n) % n : Math.max(0, Math.min(n, st.t * fps)), f0 = Math.floor(fr);
  const c = d.cuadros || (d.cuadros = new Map()), k0 = st.anim * 100000 + f0, k1 = st.anim * 100000 + Math.min(A.nf - 1, f0 + 1);
  const get = (k, f) => { let x = c.get(k); if (!x) { x = GMF.poseCapas(M, st.anim, f); if (!x.ok) return null; if (c.size > 4000) c.clear(); c.set(k, x); } return x; };
  const pa = get(k0, f0), pb = get(k1, Math.min(A.nf - 1, f0 + 1)); if (!pa || !pb) return null;
  return { pa, pb, w: fr - f0 };
}
// las matrices de los huesos de una entidad (con su bonemerge), una vez por cuadro y por lugar
function gmanHuesos(e, prof) {
  const d = gmanDefDe(e); if (!d) return null;
  if (e.ragGen && typeof gmrgHuesos === 'function') return gmrgHuesos(e, d);   // (un muñeco de trapo: los huesos salen de sus cuerpos)
  const merge = !!(e.efectos & 1) && e.padre && e.padre.vivo !== false && (prof || 0) < 8;
  const Hp = merge ? gmanHuesosDe(e.padre, (prof || 0) + 1) : null;
  const st = d.virt ? null : gmanEstado(e);
  const raiz = Hp ? Hp.W[0] : gmanRaiz(e, e._anR || (e._anR = new Float32Array(16)));
  // (la clave: el cuadro, la secuencia, el momento, la raíz y la pose del padre)
  const K = e._anK || (e._anK = new Float64Array(24)); let igual = K[0] === GMAN.cuadro && K[1] === (st ? st.anim : -1) && K[2] === (st ? st.t : -1) && K[3] === (Hp ? Hp.serie : -1) && K[20] === (e.manipV || 0);
  for (let k = 0; k < 16 && igual; k++) if (K[4 + k] !== raiz[k]) igual = false;
  if (igual && e._anH && e._anH.def === d) return e._anH;
  K[0] = GMAN.cuadro; K[1] = st ? st.anim : -1; K[2] = st ? st.t : -1; K[3] = Hp ? Hp.serie : -1; for (let k = 0; k < 16; k++) K[4 + k] = raiz[k]; K[20] = e.manipV || 0;
  let H = e._anH; if (!H || H.def !== d) H = e._anH = { def: d, W: Array.from({ length: d.nb + 1 }, () => new Float32Array(16)), serie: 0 };
  H.serie = ++GMAN.serie; H.W[0].set(raiz);
  const W = H.W, nb = d.nb, L = _anL;
  if (d.virt) {
    // (un personaje del juego: los huesos de Valve de su padre; los que el padre no tiene, en el lugar de su hueso padre)
    for (let i = 0; i < nb; i++) {
      const j = Hp ? Hp.def.porNombre.get(d.nombres[i].toLowerCase()) : undefined;
      if (j !== undefined) W[1 + i].set(Hp.W[1 + j]); else W[1 + i].set(W[d.padres[i] >= 0 ? 1 + d.padres[i] : 0]);
    }
    H.persona = null; return H;
  }
  const C = gmanCuadros(d, st);
  for (let i = 0; i < nb; i++) {
    const j = Hp ? Hp.def.porNombre.get(d.nombres[i].toLowerCase()) : undefined;
    if (j !== undefined) { W[1 + i].set(Hp.W[1 + j]); continue; }
    gmanLocal(d, st, i, _anP, _anQ, C ? C.w : 0, C && C.pa, C && C.pb);
    const mp = e.manipH && e.manipH.get(i);
    if (mp) gmanManip(mp, L); else m4trs(_anP, _anQ, _anU, L);
    m4mul(W[d.padres[i] >= 0 ? 1 + d.padres[i] : 0], L, W[1 + i]);
  }
  return H;
}
const _anL = new Float32Array(16);
// ManipulateBone* sobre la pose de la animación (en el espacio del padre, como GMod): la posición se suma (de unidades de
// Source a metros, con los ejes del juego), el giro se aplica después del de la animación y la escala achica o agranda el
// hueso con sus hijos
const _anM = [0, 0, 0, 1], _anS = [1, 1, 1];
function gmanManip(m, L) {
  const S = GM_S; _anP[0] += S * m.p[1]; _anP[1] += S * m.p[2]; _anP[2] += S * m.p[0];
  if (m.a[0] || m.a[1] || m.a[2]) {
    if (!m.q) { const R = angMat(new LAng(m.a[0], m.a[1], m.a[2])), C = [[0, 1, 0], [0, 0, 1], [1, 0, 0]], Rm = [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]]; m.q = _m2q(_m3mul(_m3mul(C, Rm), _m3T(C))); }
    const [ax, ay, az, aw] = _anQ, [bx, by, bz, bw] = m.q;
    _anM[0] = aw * bx + ax * bw + ay * bz - az * by; _anM[1] = aw * by - ax * bz + ay * bw + az * bx; _anM[2] = aw * bz + ax * by - ay * bx + az * bw; _anM[3] = aw * bw - ax * bx - ay * by - az * bz;
  } else { _anM[0] = _anQ[0]; _anM[1] = _anQ[1]; _anM[2] = _anQ[2]; _anM[3] = _anQ[3]; }
  _anS[0] = m.s[1]; _anS[1] = m.s[2]; _anS[2] = m.s[0];
  m4trs(_anP, _anM, _anS, L);
}
// los huesos de cualquier entidad: la animada, o una persona (el jugador, un NPC del juego) con su esqueleto de Valve
function gmanHuesosDe(e, prof) {
  if (!(e instanceof LEnt)) return null;
  const P = typeof gmhPersona === 'function' ? gmhPersona(e) : null;
  if (P && !e.modelo) return gmanHuesosPersona(e, P);
  return gmanHuesos(e, prof);
}
// (una persona como esqueleto de Valve: los huesos que gmod_pm.js le da —gmhHuesoMundo—, para pegarle algo con bonemerge)
function gmanHuesosPersona(e, P) {
  const cl = gmhVB(), d = gmanDefVirtual(gmanModeloPersona(P), { skin: P.skin || 'Hero', gorro: P.gorro || 'HatEmpty' });
  let H = e._anHP; if (!H) H = e._anHP = { def: d, W: Array.from({ length: cl.length + 1 }, () => new Float32Array(16)), serie: 0 };
  if (H.cuadro === GMAN.cuadro) return H; H.cuadro = GMAN.cuadro; H.serie = ++GMAN.serie; H.def = d;
  gmanRaiz(e, H.W[0]);
  for (let i = 0; i < cl.length; i++) { const W = gmhHuesoMundo(e, i); if (W) H.W[1 + i].set(W); else H.W[1 + i].set(H.W[0]); }
  return H;
}

// ---- los enganches (GetAttachment) ----
const _anA = new Float32Array(16), _anB = new Float32Array(16);
// los de un personaje del juego (no tiene .mdl): los ojos y la boca en la cabeza, las manos, el pecho y adelante
const GMAN_ADJ_VIRT = [['eyes', 'Head'], ['mouth', 'Head'], ['anim_attachment_RH', 'RightHand'], ['anim_attachment_LH', 'LeftHand'], ['anim_attachment_head', 'Head'], ['chest', 'Spine2'], ['forward', 'Hips']];
function gmanAdjuntos(d) { return d.virt ? GMAN_ADJ_VIRT.map(([n]) => ({ n })) : d.M.adjuntos; }
// el enganche k (desde 0) de una entidad, en el mundo: matriz del juego (columnas) o null
function gmanAdjunto(e, k) {
  const H = gmanHuesosDe(e); if (!H) return null; const d = H.def;
  if (d.virt) return gmanAdjuntoVirtual(e, H, k);
  const a = d.M.adjuntos[k]; if (!a || a.hueso < 0 || a.hueso >= d.nb) return null;
  m4mul(H.W[1 + a.hueso], gmhDeSource(a.m, _anA), _anB); return _anB;
}

// ---- el esqueleto de Valve llevado a un personaje del juego (el Hero y los demás: huesos de Mixamo) ----
// El perfil de un par (esqueleto de Valve, personaje): por cada hueso del personaje que tiene par en el de Valve, su giro
// de reposo, el del de Valve y la alineación entre sus direcciones de reposo; la cadera, la proporción de alturas.
function gmanPerfil(dv, skin) {
  const k = dv.ruta + '|' + skin; if (GMAN.perfiles.has(k)) return GMAN.perfiles.get(k);
  const D = datosSkin(gmpEs(skin) ? 'Hero' : skin), sub = D.sub, n = sub.length;
  const porNom = {}; sub.forEach((x, i) => { const m = /^mixamorig\d*:(.*)$/.exec(x.n); if (m && porNom[m[1]] === undefined) porNom[m[1]] = i; });
  if (porNom.Hips === undefined) { GMAN.perfiles.set(k, null); return null; }
  // (el reposo del personaje, en su espacio)
  const mh = new Modelo(sub); mh.actualizar();
  const rQ = mh.W.map((w) => m4quat(w)), rP = mh.W.map((w) => v3(w[12], w[13], w[14])), rS = mh.W.map((w) => Math.hypot(w[0], w[1], w[2]) || 1);
  // (y el de Valve)
  const vb = {}; for (const c of Object.keys(GMP_VB)) { const i = dv.porNombre.get('valvebiped.bip01_' + c); if (i !== undefined) vb[c] = i; }
  if (vb.pelvis === undefined) { GMAN.perfiles.set(k, null); return null; }
  const vQ = dv.restW.map((w) => m4quat(w)), vP = dv.restW.map((w) => v3(w[12], w[13], w[14]));
  // el hueso de Valve de cada uno del personaje (Spine2 de Mixamo es el pecho: el Spine4 de Valve, de donde cuelgan las clavículas)
  const deVB = new Map(); for (const [c, m] of Object.entries(GMP_VB)) { if (c === 'spine2') continue; if (vb[c] !== undefined && porNom[m] !== undefined) deVB.set(porNom[m], 1 + vb[c]); }
  // (el esqueleto de Valve se gira para que la línea de la cadera quede como la del personaje, como gmpPreparar)
  let th = 0; { const yw = (a, b) => Math.atan2(b.x - a.x, b.z - a.z); const a = vb.l_thigh, b = vb.r_thigh;
    if (a !== undefined && b !== undefined && porNom.LeftUpLeg !== undefined && porNom.RightUpLeg !== undefined) th = yw(rP[porNom.LeftUpLeg], rP[porNom.RightUpLeg]) - yw(vP[1 + a], vP[1 + b]); }
  const ry = new Quat(0, Math.sin(th / 2), 0, Math.cos(th / 2)), vQr = vQ.map((q) => ry.clone().mul(q).norm()), vPr = vP.map((p) => ry.rot(p));
  // la alineación: del reposo del personaje al de Valve, por la dirección hacia la punta (el hijo que sigue)
  const alin = new Array(n).fill(null), invVQ = new Array(n).fill(null);
  for (const [h, j] of deVB) {
    invVQ[h] = vQr[j].conj();
    const m = /^mixamorig\d*:(.*)$/.exec(sub[h].n)[1], pm = GMP_PUNTA[m]; if (!pm || m === 'Hips') continue;
    const hT = porNom[pm], jT = hT !== undefined ? deVB.get(hT) : undefined; if (hT === undefined || jT === undefined) continue;
    const dH = vsub(rP[hT], rP[h]), dV = vsub(vPr[jT], vPr[j]); if (dH.len() > 1e-5 && dV.len() > 1e-5) alin[h] = rotEntre(dH, dV);
  }
  // (la cadera: su altura en reposo sobre los pies, la del personaje y la de Valve)
  const hipsH = Math.max(0.1, rP[porNom.Hips].y), hipsV = Math.max(0.1, vP[1 + vb.pelvis].y);
  const L = (a, b) => (a !== undefined && b !== undefined ? vsub(rP[b], rP[a]).len() : 0);
  const pr = { D, sub, porNom, deVB, rQ, rP, rS, ry, ryI: ry.conj(), alin, invVQ, k: hipsV / hipsH, vb, n, pa: sub.map((x) => x.pa),
    loc: sub.map((x) => ({ p: v3(x.p[0], x.p[1], x.p[2]), r: new Quat(x.r[0], x.r[1], x.r[2], x.r[3]) })),
    tob: D.tobillo || 0.08, vbTob: vb.l_foot !== undefined ? Math.max(0, vP[1 + vb.l_foot].y) : 0.1, brazo: L(porNom.LeftArm, porNom.LeftForeArm) + L(porNom.LeftForeArm, porNom.LeftHand),
    hijos: sub.map((x, i) => i) };
  // (cada hueso, hasta la articulación siguiente: el largo en reposo y la dirección en sus ejes, para estirarlo como el de Valve)
  pr.estira = new Array(n).fill(null);
  for (const [h] of deVB) {
    const m = /^mixamorig\d*:(.*)$/.exec(sub[h].n)[1], pm = GMP_PUNTA[m]; if (!pm || m === 'Hips') continue;
    const t = porNom[pm], jt = t !== undefined ? deVB.get(t) : undefined; if (jt === undefined) continue;
    const dv0 = vsub(rP[t], rP[h]), l = dv0.len(); if (l < 1e-4) continue;
    const dl = rQ[h].conj().rot(vscale(dv0, 1 / l)); pr.estira[h] = { j: jt, l, d: [dl.x, dl.y, dl.z] };
  }
  // ¿para dónde mira el personaje en reposo? (la punta del pie adelante del tobillo: +z o −z)
  pr.fz = porNom.LeftToeBase !== undefined && porNom.LeftFoot !== undefined && rP[porNom.LeftToeBase].z < rP[porNom.LeftFoot].z ? -1 : 1;
  // los ojos: en la cabeza, 9 cm arriba de su hueso y 9 cm adelante (a la escala del personaje), mirando adelante
  if (porNom.Head !== undefined) {
    const hi = porNom.Head, s = tamSkin(skin).k || 1, ojo = vadd(rP[hi], v3(0, 0.09 * s, 0.09 * s * pr.fz)), cara = new Quat(0, pr.fz < 0 ? 1 : 0, 0, pr.fz < 0 ? 0 : 1);
    const qi = rQ[hi].conj(); pr.ojoL = { p: qi.rot(vsub(ojo, rP[hi])).scale(1 / rS[hi]), q: qi.clone().mul(cara).norm() };
  }
  GMAN.perfiles.set(k, pr); GMAN.perfilSkin.set(skin, { pr, dv }); return pr;
}
// el personaje con la pose de un esqueleto de Valve, como el bonemerge de Source: cada hueso que tiene par va donde está
// el de Valve (la posición de la articulación) con el giro de Valve llevado al suyo, y estirado a lo largo del hueso hasta
// la articulación que sigue (la malla de un personaje más alto o más bajo se acomoda al esqueleto de la animación, como un
// modelo de jugador de otras medidas en GMod: los golpes y los agarres caen donde caen en GMod). Los huesos sin par
// (puntas de los dedos, la del pie, la de la cabeza) siguen a su padre. Wv: matrices del mundo de los huesos de dv
// (W[1 + i]); raiz: la de la entidad (los pies); G.W: una matriz por nodo del personaje.
function gmanRetarget(pr, dv, Wv, raiz, G) {
  const n = pr.n;
  if (!G.Q) { G.Q = Array.from({ length: n }, () => new Quat()); G.Pw = Array.from({ length: n }, () => v3()); G.S = new Float32Array(n); G.W = Array.from({ length: n }, () => new Float32Array(16)); G.est = new Float32Array(n); }
  const rq = m4quat(raiz), rp = v3(raiz[12], raiz[13], raiz[14]), R0 = rq.clone().mul(pr.ryI).norm(), W = G.W, L = _anL;
  for (let h = 0; h < n; h++) {
    const pa = pr.pa[h], j = pr.deVB.get(h), Lc = pr.loc[h];
    if (j !== undefined) {
      // giro: (Valve ahora · Valve en reposo⁻¹) · alineación · reposo del personaje; lugar: el de la articulación de Valve
      const Q = G.Q[h], w = Wv[j]; m4quat(w, Q); Q.mul(pr.invVQ[h]); if (pr.alin[h]) Q.mul(pr.alin[h]); Q.mul(pr.rQ[h]).norm();
      G.Pw[h].set(w[12], w[13], w[14]); const s = pr.rS[h]; G.S[h] = s;
      _anP[0] = w[12]; _anP[1] = w[13]; _anP[2] = w[14]; _anQ[0] = Q.x; _anQ[1] = Q.y; _anQ[2] = Q.z; _anQ[3] = Q.w; _anU[0] = _anU[1] = _anU[2] = s; m4trs(_anP, _anQ, _anU, W[h]);
      // (estirado a lo largo del hueso: el largo de Valve sobre el suyo, hasta la articulación siguiente)
      const e = pr.estira[h]; let f = 1;
      if (e) { const wt = Wv[e.j], lv = Math.hypot(wt[12] - w[12], wt[13] - w[13], wt[14] - w[14]); f = Math.max(0.5, Math.min(2, lv / e.l)); }
      G.est[h] = f;
      if (Math.abs(f - 1) > 1e-4) { const d = e.d, k = f - 1; for (let c = 0; c < 3; c++) { const x = W[h][c * 4], y = W[h][c * 4 + 1], z = W[h][c * 4 + 2], dc = d[c] * k, ax = W[h][0] * d[0] + W[h][4] * d[1] + W[h][8] * d[2], ay = W[h][1] * d[0] + W[h][5] * d[1] + W[h][9] * d[2], az = W[h][2] * d[0] + W[h][6] * d[1] + W[h][10] * d[2]; L[c * 4] = x + ax * dc; L[c * 4 + 1] = y + ay * dc; L[c * 4 + 2] = z + az * dc; } for (let c = 0; c < 3; c++) { W[h][c * 4] = L[c * 4]; W[h][c * 4 + 1] = L[c * 4 + 1]; W[h][c * 4 + 2] = L[c * 4 + 2]; } }
      continue;
    }
    // (la raíz: la de la entidad, girada como el esqueleto de Valve respecto del personaje; los demás, con su padre)
    if (pa < 0) { const Q = G.Q[h].copy(R0).mul(pr.rQ[h]).norm(), P = G.Pw[h].copy(rp).add(R0.rot(pr.rP[h])), s = pr.rS[h]; G.S[h] = s; _anP[0] = P.x; _anP[1] = P.y; _anP[2] = P.z; _anQ[0] = Q.x; _anQ[1] = Q.y; _anQ[2] = Q.z; _anQ[3] = Q.w; _anU[0] = _anU[1] = _anU[2] = s; m4trs(_anP, _anQ, _anU, W[h]); continue; }
    _anP[0] = Lc.p.x; _anP[1] = Lc.p.y; _anP[2] = Lc.p.z; _anQ[0] = Lc.r.x; _anQ[1] = Lc.r.y; _anQ[2] = Lc.r.z; _anQ[3] = Lc.r.w; _anU[0] = _anU[1] = _anU[2] = 1; m4trs(_anP, _anQ, _anU, L); m4mul(W[pa], L, W[h]);
    m4quat(W[h], G.Q[h]); G.Pw[h].set(W[h][12], W[h][13], W[h][14]); G.S[h] = G.S[pa];
  }
  _anU[0] = _anU[1] = _anU[2] = 1;
  return G;
}
const _anV = v3();
// el personaje de una entidad con modelo del juego, posado ese cuadro: { pr, G (nodos), Pv (la persona que se dibuja) }
function gmanVirtualPose(e, H) {
  const d = H.def, padre = (e.efectos & 1) && e.padre ? e.padre : null, Hp = padre ? gmanHuesosDe(padre) : null;
  const dv = Hp && !Hp.def.virt ? Hp.def : null;
  const V = e.anV || (e.anV = { G: {}, serie: -1 });
  if (V.serie === H.serie && V.cuadro === GMAN.cuadro) return V;
  V.serie = H.serie; V.cuadro = GMAN.cuadro; V.ok = false;
  const pr = dv ? gmanPerfil(dv, d.skin) : null; V.pr = pr;
  if (!pr) return V;
  gmanRetarget(pr, dv, Hp.W, H.W[0], V.G); V.ok = true;
  return V;
}
function gmanAdjuntoVirtual(e, H, k) {
  const x = GMAN_ADJ_VIRT[k]; if (!x) return null;
  const V = gmanVirtualPose(e, H), pr = V.pr;
  if (!V.ok || !pr) { // (sin esqueleto de Valve debajo: el hueso de Valve que corresponde, si lo hay)
    const c = { Head: 'head1', RightHand: 'r_hand', LeftHand: 'l_hand', Spine2: 'spine4', Hips: 'pelvis' }[x[1]], i = H.def.claves.indexOf(c); return i >= 0 ? H.W[1 + i] : H.W[0];
  }
  const h = pr.porNom[x[1]]; if (h === undefined) return null;
  const W = V.G.W[h];
  if ((x[0] === 'eyes' || x[0] === 'mouth') && pr.ojoL) {
    const o = pr.ojoL, s = V.G.S[h], p = V.G.Q[h].rot(v3(o.p.x * s, (o.p.y - (x[0] === 'mouth' ? 0.07 : 0)) * s, o.p.z * s)).add(V.G.Pw[h]), q = V.G.Q[h].clone().mul(o.q).norm();
    m4trs([p.x, p.y, p.z], [q.x, q.y, q.z, q.w], [1, 1, 1], _anB); return _anB;
  }
  return W;
}
// la persona (sin estar en el mundo) con la que se dibuja una entidad de modelo del juego
function gmanPersonaVirtual(e, d) {
  const vx = d.vx; let Pv = e.anPv;
  if (Pv && Pv.skin === vx.skin && Pv.gorro === vx.gorro) return Pv;
  Pv = crearPersona(vx.skin, vx.gorro, { nombre: '' }); const i = PERS.indexOf(Pv); if (i >= 0) PERS.splice(i, 1);
  Pv.visible = true; Pv.gmanVirt = true; Pv.md.fijo = Pv.D.sub.map(() => null);
  e.anPv = Pv; (GMAN.pvs || (GMAN.pvs = new Set())).add(e); return Pv;
}

// ---- dibujar ----
// ¿se dibuja animada? (tiene secuencia, va pegada con bonemerge o es un personaje del juego)
// (una que se anima o va pegada a otra, cuyo modelo todavía no llegó: no se dibuja nada —antes, la caja de reemplazo—)
function gmanEsperando(e) {
  if (!(e instanceof LEnt) || e.P || e.nb || !e.modelo) return false;
  return !!(e.an || e.anPide || e.anRem || ((e.efectos & 1) && e.padre)) && !gmanDefDe(e);
}
function gmanAnimada(e) {
  if (!(e instanceof LEnt) || e.P || e.nb || !e.modelo) return false;
  if (!(e.an || e.ragGen || ((e.efectos & 1) && e.padre) || GMAN_VIRT.test(gmanRuta(e.modelo)))) return false;   // (ragGen: un muñeco de cualquier modelo, gmod_rag.js)
  return !!gmanDefDe(e);
}
// (SetMaterial con un material que no se ve —«null», como hace BSMod con el jugador durante la ejecución—)
const gmanInvisible = (e) => { const m = e && e.material ? String(e.material).toLowerCase() : ''; return m === 'null' || m === 'tools/toolsinvisible' || m === 'models/effects/vol_light001'; };
// la cabeza achicada si la cámara está adentro de ella (la vista desde los ojos de ese modelo: CalcView de una ejecución),
// como el cuerpo propio en primera persona del juego
const GMAN_RCAB = 0.28;
function gmanSinCabeza(W, hi, hijos) {
  const h = W[hi]; if (!h || Math.hypot(CAM.pos.x - h[12], CAM.pos.y - h[13], CAM.pos.z - h[14]) > GMAN_RCAB) return false;
  const px = h[12], py = h[13], pz = h[14], k = 0.001;
  for (const i of hijos) { const w = W[i]; for (let c = 0; c < 12; c++) w[c] *= k; w[12] = px + (w[12] - px) * k; w[13] = py + (w[13] - py) * k; w[14] = pz + (w[14] - pz) * k; }
  return true;
}
// (los descendientes de un nodo, él incluido)
function gmanRama(pa, i0) { const out = [i0], S = new Set([i0]); for (let i = i0 + 1; i < pa.length; i++) if (S.has(pa[i])) { S.add(i); out.push(i); } return out; }
function gmanDibujar(e, forzar) {
  if (gmanInvisible(e) || (e.noDraw && !forzar)) { if (e.o) e.o.md.oculto = true; return true; }
  // (pegada con bonemerge a una cuyo modelo todavía no llegó —en red, el de la animación se está bajando—: nada, como su padre;
  // antes quedaba en la pose de reposo, con los brazos abiertos)
  if ((e.efectos & 1) && e.padre && e.padre.vivo !== false && !e.padre.P && !gmanHuesosDe(e.padre)) { if (e.o) e.o.md.oculto = true; return true; }
  const H = gmanHuesos(e); if (!H) return false;
  const d = H.def;
  if (d.virt) return gmanDibujarVirtual(e, H);
  // (sin la malla con piel —un prop de uno o dos huesos—: el modelo quieto de siempre; sólo esqueleto: no hay nada que ver)
  const gp = d.gp; if (!gp) { if (d.conMalla) return false; if (e.o) e.o.md.oculto = true; return true; }
  if (e.o) e.o.md.oculto = true;
  let md = e.anMd; if (!md || md.A !== gp.arb) { md = e.anMd = new Modelo(gp.arb); md.fijo = gp.arb.map(() => null); e.anW = Array.from({ length: d.nb + 1 }, () => new Float32Array(16)); }
  const W = e.anW; for (let i = 0; i <= d.nb; i++) { W[i].set(H.W[i]); md.fijo[i] = W[i]; }
  // (con su matriz de EnableMatrix("RenderMultiply"): sólo en la copia que se dibuja —gmrMatrizHuesos—)
  const G = gmrMatrizHuesos(e, H.W[0]); if (G) for (let i = 0; i <= d.nb; i++) m4mul(G, W[i], W[i]);
  const hc = d.porNombre.get('valvebiped.bip01_head1');
  if (hc !== undefined) { if (!d.cabeza) d.cabeza = gmanRama([-1, ...d.padres.map((p) => (p >= 0 ? 1 + p : 0))], 1 + hc); gmanSinCabeza(W, 1 + hc, d.cabeza); }
  md.color = gmrTinte(e); md.sinSombra = !!e.sinSombra; md.haloC = e.haloC; md.haloT = e.haloT; md.sucio = true; md.encolar();
  return true;
}
function gmanDibujarVirtual(e, H) {
  if (e.o) e.o.md.oculto = true;
  const d = H.def, Pv = gmanPersonaVirtual(e, d), md = Pv.md, V = gmanVirtualPose(e, H), pr = V.pr;
  // (una copia: lo que se achica para dibujar no cambia los enganches —los ojos— que el Lua lee en el mismo cuadro)
  let W = null;
  if (V.ok) { W = e.anWv && e.anWv.length === pr.n ? e.anWv : (e.anWv = Array.from({ length: pr.n }, () => new Float32Array(16))); for (let h = 0; h < pr.n; h++) { W[h].set(V.G.W[h]); md.fijo[h] = W[h]; } }
  else { for (let h = 0; h < md.fijo.length; h++) md.fijo[h] = null; md.ponerRaiz(H.W[0]); }
  // (desde adentro de la cabeza: sin cabeza ni gorro)
  let sin = false;
  if (V.ok && pr.porNom.Head !== undefined) { if (!pr.cabeza) pr.cabeza = gmanRama(pr.pa, pr.porNom.Head); sin = gmanSinCabeza(W, pr.porNom.Head, pr.cabeza); }
  md.color = gmrTinte(e); md.sinSombra = !!e.sinSombra; md.haloC = e.haloC; md.haloT = e.haloT; md.sucio = true;
  if (Pv.gmpRuta && typeof gmpDibujar === 'function') { md.ponerRaiz(H.W[0]); Pv.lejos = false; Pv.suelo = true; gmpDibujar(Pv); }
  else md.encolar();
  if (Pv.gorroMd && !sin && V.ok && pr.porNom.Head !== undefined) { m4mul(W[pr.porNom.Head], Pv.gorroL, _anA); Pv.gorroMd.ponerRaiz(_anA); Pv.gorroMd.color = md.color; Pv.gorroMd.encolar(); }
  return true;
}

// ---- halo.Add: lo resaltado de un color (en GMod, un contorno borroso; acá un brillo de ese color en el borde del modelo,
// como el resaltado de lo que se apunta con la Physics Gun). Queda anotado por cuadro: el botón de una habilidad que pide
// apuntar a algo resaltado —la ejecución de BSMod— aparece sólo entonces (gmod_panel.js)
function gmanHalo(t, c) {
  const L = t instanceof LuaTable ? t.claves().map((k) => t.get(k)) : t instanceof LEnt ? [t] : [];
  const col = c instanceof LuaTable ? [(+c.get('r') || 0) / 255, (+c.get('g') || 0) / 255, (+c.get('b') || 0) / 255] : [1, 1, 1];
  const S = GMAN.halos && GMAN.halosT === TIEMPO.t ? GMAN.halos : (GMAN.halos = new Set()); GMAN.halosT = TIEMPO.t;
  for (const e of L) {
    if (!(e instanceof LEnt) || !e.vivo) continue; S.add(e); if (GMA.hookAddon) (GMAN.halosDe || (GMAN.halosDe = new Map())).set(e, GMA.hookAddon);
    e.haloC = col; e.haloT = TIEMPO.t;
    const md = e.P ? e.P.md : e.o ? e.o.md : null; if (md) { md.haloC = col; md.haloT = TIEMPO.t; }
  }
}
// (¿está resaltada en este cuadro o el anterior?)
const gmanResaltada = (e) => !!(e && GMAN.halos && GMAN.halos.has(e) && TIEMPO.t - (e.haloT || -9) < 0.2);
// ¿lo que está en la mira, a menos de «u» unidades de los ojos, está resaltado? (la misma traza que KMCheck de BSMod: si el botón
// aparece, la ejecución sale; para el botón de una acción con algo adelante —gmod_panel.js—)
function gmanApuntaResaltada(u) {
  if (!GMAN.halos || !GMAN.halos.size || TIEMPO.t - (GMAN.halosT || -9) > 0.3) return false;
  const o = gmaOjo(), d = gmaApunta(), max = (u || 100) * GS;
  const t = gmaTraza(o, d, max, null), e = t.get('Entity'); return e instanceof LEnt && gmanResaltada(e);
}

// ---- multijugador: las entidades animadas de uno las ven los demás ----
// (las de una ejecución de BSMod: los dos esqueletos con su secuencia y los modelos pegados con bonemerge). Como los nextbots
// (gmod_nextbot.js): diez veces por segundo el modelo, dónde está, su secuencia y por dónde va, a qué está pegada y si se ve;
// los demás la dibujan un momento atrás, entre dos muestras. Si no tienen el addon, se bajan sus archivos de visita (sin
// su Lua). El jugador que la hace no se ve (su material invisible va como «no se ve» —red.js—) y la víctima tampoco
// (npc.js). Antes los demás veían al jugador y al NPC quietos donde estaban y nada más.
const GMAN_RED = { t: 0, rem: new Map(), habia: false, ji: 0, inv: new Map() };
function gmanJugInvisible() { return typeof GMA !== 'undefined' && !!GMA.jug && gmanInvisible(GMA.jug); }
function gmanRedPaso(dt) {
  const on = typeof RED !== 'undefined' && !!RED.on;
  if (!on) { for (const [k, X] of [...GMAN_RED.rem]) gmanTitereQuitar(k, X); GMAN_RED.habia = false; return; }
  gmanTiteresPaso();
  if ((GMAN_RED.t -= dt) > 0) return; GMAN_RED.t = 0.1;
  const l = [], R3 = (x) => Math.round((+x || 0) * 1000) / 1000;
  for (const e of GMA.ents.values()) {
    if (!e.vivo || !e.creado || e.anRem || e.nb || e.P || l.length >= 24) continue;
    if (!(e.an || ((e.efectos & 1) && e.padre))) continue;
    const d = gmanDefDe(e); if (!d) continue;
    const c = GMA.clases.get(e.clase), w = c && c.addon && c.addon.id, wid = /^\d{3,12}$/.test(String(w)) ? String(w) : '';
    const p = gmaEntPos(e), a = quatAng(entQ(e)), A = e.an, vx = d.virt ? d.vx : null, pa = (e.efectos & 1) && e.padre && !e.padre.P ? e.padre.id : 0;
    l.push([e.id, wid, String(e.modelo).slice(0, 160), R3(p.x), R3(p.y), R3(p.z), R3(a.p), R3(a.y), R3(a.r), A ? A.i : -1, A ? R3(A.t) : 0, 0, pa, gmanInvisible(e) || e.noDraw ? 1 : 0, vx ? String(vx.skin).slice(0, 60) : '', vx ? String(vx.gorro).slice(0, 60) : '', R3(+e.escala || 1)]);
  }
  // (ji: el jugador está escondido por el Lua —SetMaterial("null") en la ejecución de BSMod—; va con los títeres para que el
  // otro lo esconda en el mismo momento en que aparecen, y se repite mientras dure: si se pierde el último, a los 0,5 s vuelve)
  const ji = gmanJugInvisible() ? 1 : 0;
  if (l.length || GMAN_RED.habia || ji || GMAN_RED.ji) publicar('a', { k: 'gan', t: Math.round(TIEMPO.t * 1000) / 1000, l, ji });
  GMAN_RED.habia = l.length > 0; GMAN_RED.ji = ji;
}
// (el jugador remoto id está escondido por el Lua de un mod suyo: red.js no lo dibuja)
function gmanRemInvisible(id) { const t = GMAN_RED.inv.get(id); return t !== undefined && TIEMPO.t - t < 0.5; }
function gmanRedRecibir(d) {
  if (!d || !Array.isArray(d.l) || typeof d.i !== 'string' || (typeof RED !== 'undefined' && d.i === RED.ID)) return;
  if (!GMA.R) gmaIniciar(); if (!GMA.activo) GMA.activo = true;
  const de = d.i, rt = num(d.t, 0, 1e9, 0), vivos = new Set(), n = (v, m, x) => num(v, -m, m, x);
  if (d.ji === 1) GMAN_RED.inv.set(de, TIEMPO.t); else GMAN_RED.inv.delete(de);
  for (const x of d.l.slice(0, 24)) {
    if (!Array.isArray(x) || x.length < 17) continue;
    const key = de + '/' + (x[0] | 0), modelo = gmanRuta(String(x[2] || '').slice(0, 160)); vivos.add(key);
    // (un personaje del juego: con su skin, si es uno que existe)
    if (GMAN_VIRT.test(modelo) && typeof x[14] === 'string' && x[14]) { const sk = DATA.chars && DATA.chars.includes(x[14]) ? x[14] : 'Hero'; GMAN.virt.set(modelo, { skin: sk, gorro: typeof x[15] === 'string' && x[15] ? x[15] : 'HatEmpty' }); }
    let X = GMAN_RED.rem.get(key); if (X && X.modelo !== modelo) { gmanTitereQuitar(key, X); X = null; }
    if (!X) X = gmanTitere(de, key, String(x[1] || ''), modelo);
    X.t = TIEMPO.t; X.padreK = x[12] | 0 ? de + '/' + (x[12] | 0) : null; X.oculto = x[13] === 1; X.esc = num(x[16], 0.01, 100, 1);
    const m = { rt, p: v3(n(x[3], 1e5, 0), n(x[4], 1e5, 0), n(x[5], 1e5, 0)), q: angQuat(new LAng(n(x[6], 1e4, 0), n(x[7], 1e4, 0), n(x[8], 1e4, 0))), sec: x[9] | 0, ct: num(x[10], 0, 1e6, 0) };
    const L = X.mm, u = L[L.length - 1];
    if (u && rt <= u.rt) { if (rt < u.rt - 2) { L.length = 0; X.rr = undefined; } else continue; }
    L.push(m); if (L.length > 16) L.shift();
    if (X.rr === undefined) X.rr = rt - 0.15;   // (un momento atrás: entre dos muestras)
  }
  for (const [k, X] of [...GMAN_RED.rem]) if (X.de === de && !vivos.has(k)) gmanTitereQuitar(k, X);
}
function gmanTitere(de, key, wid, modelo) {
  const e = new LEnt('gman_remoto', 'ent'); e.creado = true; e.cs = true; e.modelo = modelo; e.anRem = true; e.pos = v3(); e.q = new Quat();
  const X = { de, key, wid, modelo, e, mm: [], t: TIEMPO.t }; GMAN_RED.rem.set(key, X);
  if (/^\d{3,12}$/.test(wid) && typeof gmVisita === 'function' && !GMOD.addons.has(wid)) gmVisita(wid).then((A) => { if (!A) return; try { if (typeof gmlLlegaron === 'function') gmlLlegaron([...A.G.archivos.keys()]); } catch (x) {} GMAN.defs.delete(modelo); }).catch(() => {});
  return X;
}
function gmanTitereQuitar(key, X) { GMAN_RED.rem.delete(key); const e = X.e; e.vivo = false; GMA.ents.delete(e.id); e.anPv = null; }
function gmanTiteresPaso() {
  for (const [key, X] of [...GMAN_RED.rem]) {
    const e = X.e, L = X.mm;
    if (!e.vivo || TIEMPO.t - X.t > 3 || !RED.remotos.has(X.de)) { gmanTitereQuitar(key, X); continue; }
    if (!L.length) continue;
    X.rr = Math.min((X.rr ?? L[0].rt) + (TIEMPO.dt || 0), L[L.length - 1].rt + 0.2);
    while (L.length > 2 && L[1].rt <= X.rr) L.shift();
    const a = L[0], b = L[1]; let f = 0, s = a; if (b && b.rt > a.rt) { f = Math.max(0, Math.min(1, (X.rr - a.rt) / (b.rt - a.rt))); if (f >= 1) s = b; }
    if (b && f > 0 && f < 1) { e.pos.set(a.p.x + (b.p.x - a.p.x) * f, a.p.y + (b.p.y - a.p.y) * f, a.p.z + (b.p.z - a.p.z) * f); const q = a.q.clone(); const bq = b.q.x * q.x + b.q.y * q.y + b.q.z * q.z + b.q.w * q.w < 0 ? new Quat(-b.q.x, -b.q.y, -b.q.z, -b.q.w) : b.q; q.set(q.x + (bq.x - q.x) * f, q.y + (bq.y - q.y) * f, q.z + (bq.z - q.z) * f, q.w + (bq.w - q.w) * f).norm(); e.q.copy(q); }
    else { e.pos.copy(s.p); e.q.copy(s.q); }
    e.escala = X.esc; e.noDraw = X.oculto;
    // (pegada con bonemerge a otra suya)
    const Pp = X.padreK ? GMAN_RED.rem.get(X.padreK) : null; e.padre = Pp ? Pp.e : null; e.efectos = Pp ? 1 : 0;
    if (s.sec >= 0) {
      const t = b && a.sec === b.sec && f < 1 ? a.ct + (b.ct - a.ct) * f : s.ct + Math.max(0, X.rr - s.rt);
      if (!e.an || e.an.i !== s.sec) gmanSecuencia(e, s.sec, true); if (e.an) { e.an.t = t; e.an.ult = TIEMPO.t; }
    } else e.an = null;
  }
}

// ---- la API de Lua (Entity) ----
function gmanApi(R, G) {
  const E0 = GMA.metas && GMA.metas.Entity; if (!E0) return;
  const E = (n, f) => E0.set(n, f), V = (g) => { const v = vS(g); v.__mt = GMA.mtVec; return v; }, A = (a) => { a.__mt = GMA.mtAng; return a; };
  const tabla = (o) => { const t = new LuaTable(); for (const k in o) t.set(k, o[k]); return t; };
  const angDe = (W) => { const n = (o) => { const x = W[o], y = W[o + 1], z = W[o + 2], l = Math.hypot(x, y, z) || 1; const s = dS(v3(x / l, y / l, z / l)); return [s.x, s.y, s.z]; }; return matAng(n(8), n(0), n(4)); };
  const pos = (W) => V(v3(W[12], W[13], W[14]));
  const def = (e) => { const H = gmanHuesosDe(e); return H ? H.def : null; };
  const hueso = (d, x) => { if (typeof x === 'number') return x >= 0 && x < d.nb ? x | 0 : -1; if (typeof x !== 'string') return -1; const i = d.porNombre.get(x.toLowerCase()); return i === undefined ? -1 : i; };
  // secuencias
  const M = (e) => { const d = gmanDefDe(e); return d && d.M ? d.M : null; };
  E('SetSequence', (e, s) => { gmanSecuencia(e, s, false); });
  E('ResetSequence', (e, s) => { gmanSecuencia(e, s, true); if (e.an) e.an.rate = 1; });
  E('ResetSequenceInfo', (e) => { if (e.an) e.an.rate = 1; });
  E('GetSequence', (e) => (e.an ? e.an.i : 0));
  E('LookupSequence', (e, n) => { const m = M(e); if (!m) return [-1, 0]; const s = String(n).toLowerCase(), i = m.secuencias.findIndex((q) => q.n.toLowerCase() === s); if (i < 0) return [-1, 0]; return [i, GMF.secDur(m, i, e.poseVals)]; });
  E('SequenceDuration', (e, i) => { const m = M(e); if (!m) return e.an ? e.an.dur : 0; const k = i === undefined || i === null ? (e.an ? e.an.i : 0) : +i; return m.secuencias[k] ? GMF.secDur(m, k, e.poseVals) : 0; });
  E('GetSequenceName', (e, i) => { const m = M(e), s = m && m.secuencias[i === undefined ? (e.an ? e.an.i : 0) : +i]; return s ? s.n : 'Unknown'; });
  E('GetSequenceActivityName', (e, i) => { const m = M(e), s = m && m.secuencias[i === undefined ? (e.an ? e.an.i : 0) : +i]; return s && s.act ? String(s.act) : ''; });
  E('GetSequenceActivity', (e, i) => { const m = M(e), s = m && m.secuencias[i === undefined ? (e.an ? e.an.i : 0) : +i]; return s && s.act && typeof gmnbNum === 'function' ? gmnbNum(String(s.act).toUpperCase()) ?? -1 : -1; });
  E('GetSequenceCount', (e) => { const m = M(e); return m ? m.secuencias.length : 0; });
  E('GetSequenceList', (e) => { const m = M(e), t = new LuaTable(); if (m) m.secuencias.forEach((s, i) => t.set(i, s.n)); return t; });
  E('SelectWeightedSequence', (e, act) => { const m = M(e); if (!m || typeof gmnbSecsDeAct !== 'function') return -1; const L = gmnbSecsDeAct(m, act); return L.length ? L[0] : -1; });
  E('SetCycle', (e, c) => { if (e.an) e.an.t = Math.max(0, +c || 0) * e.an.dur; });
  E('GetCycle', (e) => gmanCiclo(e.an));
  E('SetPlaybackRate', (e, r) => { e.velAnim = Number.isFinite(+r) ? +r : 1; if (e.an) e.an.rate = e.velAnim; });
  E('GetPlaybackRate', (e) => (e.an ? e.an.rate : e.velAnim ?? 1));
  // (FrameAdvance: lo que pasó desde la última vez, o lo que dice; para los ClientsideModel es lo que los anima)
  E('FrameAdvance', (e, dt) => { const a = e.an; if (!a) return; const d = +dt > 0 ? +dt : Math.max(0, TIEMPO.t - (a.ult ?? TIEMPO.t)); a.t += d * a.rate; a.ult = TIEMPO.t; });
  E('SetAutomaticFrameAdvance', (e, b) => { e.anAuto = R.T(b); });
  // efectos: EF_BONEMERGE (1), EF_NODRAW (32)
  E('AddEffects', (e, f) => { f = +f | 0; e.efectos = (e.efectos | 0) | f; if (f & 32) e.noDraw = true; });
  E('RemoveEffects', (e, f) => { f = +f | 0; e.efectos = (e.efectos | 0) & ~f; if (f & 32) e.noDraw = false; });
  E('GetEffects', (e) => (e.efectos | 0) | (e.noDraw ? 32 : 0)); E('IsEffectActive', (e, f) => !!(((e.efectos | 0) | (e.noDraw ? 32 : 0)) & (+f | 0)));
  // huesos
  E('GetBoneCount', (e) => { const d = def(e); return d ? d.nb : 0; });
  E('GetBoneName', (e, i) => { const d = def(e); return d && d.nombres[i | 0] !== undefined && i >= 0 ? d.nombres[i | 0] : '__INVALIDBONE__'; });
  E('GetBoneParent', (e, i) => { const d = def(e); return d && d.padres[i | 0] !== undefined ? d.padres[i | 0] : -1; });
  E('LookupBone', (e, n) => { const d = def(e); if (!d) return undefined; const i = hueso(d, String(n)); return i < 0 ? undefined : i; });
  E('GetBonePosition', (e, i) => {
    const H = gmanHuesosDe(e), k = H ? hueso(H.def, i) : -1;
    // (sin ese hueso: donde está la entidad, no nil —el SWEP Construction Kit sigue—)
    if (!H || k < 0) return [V(gmaEntPos(e)), A(quatAng(entQ(e)))];
    const W = H.W[1 + k]; return [pos(W), A(angDe(W))];
  });
  E('GetBoneMatrix', (e, i) => {
    const H = gmanHuesosDe(e), k = H ? hueso(H.def, i) : -1; if (!H || k < 0) return undefined;
    const W = H.W[1 + k], c = (o) => { const l = Math.hypot(W[o], W[o + 1], W[o + 2]) || 1; return dS(v3(W[o] / l, W[o + 1] / l, W[o + 2] / l)); }, F = c(8), Lf = c(0), U = c(4), P = vS(v3(W[12], W[13], W[14]));
    return gmrMatriz([F.x, Lf.x, U.x, P.x, F.y, Lf.y, U.y, P.y, F.z, Lf.z, U.z, P.z, 0, 0, 0, 1]);
  });
  E('SetupBones', () => {}); E('InvalidateBoneCache', () => {});
  // enganches
  const adjDe = (e) => { const d = def(e); if (d) return gmanAdjuntos(d); const Mi = gmaModeloInfo(e); return Mi ? Mi.adjuntos : null; };
  E('LookupAttachment', (e, n) => { const L = adjDe(e); const s = String(n).toLowerCase(), i = L ? L.findIndex((a) => a.n.toLowerCase() === s) : -1; return i < 0 ? 0 : i + 1; });
  E('GetAttachments', (e) => { const L = adjDe(e) || []; return R.tab(L.map((a, i) => tabla({ id: i + 1, name: a.n }))); });
  const adj0 = E0.get('GetAttachment');
  E('GetAttachment', (e, i) => {
    if (!(e instanceof LEnt) || e.tipo === 'vm') return typeof adj0 === 'function' ? adj0(e, i) : undefined;
    const H = gmanHuesosDe(e); if (!H) return typeof adj0 === 'function' ? adj0(e, i) : undefined;
    const W = gmanAdjunto(e, (i | 0) - 1); if (!W) return undefined;
    return tabla({ Pos: pos(W), Ang: A(angDe(W)), Bone: 0 });
  });
}

// ---- los muñecos de trapo para el Lua: CreateClientsideRagdoll y CreateEntityRagdoll de un NPC del juego que muere ----
// El muñeco del juego tiene un cuerpo por hueso del personaje (Mixamo); para el Lua es un prop_ragdoll con el modelo del
// NPC (GetModel: el suyo o el del juego) y sus PhysObj en los nombres de Valve: GetPhysicsObjectNum(i) da el cuerpo i,
// TranslatePhysBoneToBone su hueso en ese modelo y SetPos/SetAngles ponen ese hueso de Valve (se lleva al del personaje
// con el mismo perfil con que se dibuja) — BSMod deja así el cuerpo como terminó la ejecución, como en GMod.
function gmanMuneco(P, e) {
  if (!P || !P.rag || !GMA.R || !GMA.activo) return;
  const rag = new LEnt('prop_ragdoll', 'ent'); rag.creado = true; rag.ragP = P; rag.modelo = e && (e.modelo || (e.P ? gmanModeloPersona(e.P) : '')) || gmanModeloPersona(P);
  rag.pos = P.pos.clone(); rag.q = Quat.axis(0, 1, 0, P.yaw || 0);
  const d = gmanDef(rag.modelo), cuerpos = [...P.rag.cuerpos.entries()];
  // (cada cuerpo: el hueso de Valve que le toca —por el nombre de Mixamo, al revés de GMP_VB—)
  const inv = {}; for (const [c, m] of Object.entries(GMP_VB)) if (c !== 'spine2' && inv[m] === undefined) inv[m] = c;
  const todos = cuerpos.map(([i, x]) => { const m = /^mixamorig\d*:(.*)$/.exec(P.D.sub[i].n), c = m ? inv[m[1]] : null, k = c && d ? d.porNombre.get('valvebiped.bip01_' + c) : undefined; return { i, x, c, k: k === undefined ? -1 : k }; });
  // (la pelvis primero, como el phys 0 de los muñecos de GMod)
  rag.ragCuerpos = d ? todos.filter((rc) => rc.k >= 0) : todos; rag.ragCuerpos.sort((a, b) => (a.c === 'pelvis' ? -1 : b.c === 'pelvis' ? 1 : 0));
  // los cuerpos sin hueso en el modelo (el zombi de HL2 no tiene Neck1 ni Head1: la cabeza es el headcrab): en GMod su muñeco
  // no tiene ese PhysObj, así que el Lua no lo ve; acá siguen al cuerpo antepasado que sí tiene, con el mismo giro relativo que
  // al morir (si no, BSMod lo ponía donde la entidad —GetBonePosition de un hueso que no hay— y la cabeza quedaba a 3 m)
  rag.ragHuerf = [];
  if (d) for (const rc of todos) {
    if (rc.k >= 0) continue; let h = P.D.sub[rc.i].pa, anc = null;
    while (h >= 0 && !anc) { anc = rag.ragCuerpos.find((o) => o.i === h) || null; h = P.D.sub[h].pa; }
    if (!anc || !anc.x.b || !rc.x.b) continue; const a = anc.x.b, b = rc.x.b;
    const Ma = m4trs([a.pos.x, a.pos.y, a.pos.z], [a.q.x, a.q.y, a.q.z, a.q.w], [1, 1, 1], new Float32Array(16)), Mb = m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], new Float32Array(16));
    rc.anc = anc; rc.rel = m4mul(M4.inv(Ma), Mb, new Float32Array(16)); rag.ragHuerf.push(rc);
  }
  GMA.ents.delete(rag.id); GMA.ents.set(rag.id, rag);
  // (como en GMod según ai_serverragdolls: con 1, un muñeco del servidor —CreateEntityRagdoll—; con 0, uno del cliente
  // —CreateClientsideRagdoll—. Los muñecos de los NPC del juego quedan, chocan y se ven en red: son del servidor, y ése es el
  // valor de fábrica acá. Correr los dos sobre el mismo muñeco lo lanzaba dos veces —BSMod lo empuja de cada lado— y su
  // código del cliente, que no pone el cuerpo 0, dejaba la cadera corriéndose sola hasta 13 cm antes del segundo)
  const cv = GMA.cvars && GMA.cvars.get('ai_serverragdolls'), srv = String(cv ? cv.v : typeof gmaCvarMotor === 'function' ? gmaCvarMotor('ai_serverragdolls') : '1') !== '0';
  try { if (srv) gmaHook('CreateEntityRagdoll', 'S', e || NULL_ENT, rag); else gmaHook('CreateClientsideRagdoll', 'C', e || NULL_ENT, rag); } catch (x) {}
  // (sigue siendo del Lua mientras dure el muñeco)
  P.ragEnt = rag;
}
// el perfil con que se pasa entre los huesos de Valve y los del personaje de una persona: el de su modelo de GMod si es
// uno (gmod_pm.js), o el último con que se dibujó su skin
function gmanPerfilPersona(P) {
  const x = GMAN.perfilSkin.get(P.skin || 'Hero'); return x ? x.pr : null;
}
// (un giro de hueso de Valve en el mundo → el del cuerpo del muñeco)
function gmanRagPoner(f) {
  const rc = f.rc, P = f.rag.ragP, body = rc.x.b; if (!body || !P) return;
  const h = rc.i, pr = gmanPerfilPersona(P);
  // giro del hueso del personaje: el de Valve llevado con el perfil; si no hay, el de ahora
  let Q = null;
  if (f.ang) {
    const qv = angQuat(f.ang);
    if (P.gmp && P.gmp.def && !P.gmp.propio) {   // (el modelo de GMod dibujado sobre el Hero: el giro al revés de gmpDibujar)
      const G = P.gmp, j = G.hero.indexOf(h); if (j > 0) { Q = qv.clone().mul(G.restQ[j].conj()); if (G.alin[j]) Q.mul(G.alin[j].conj()); Q.mul(P.D.rw[h]).norm(); }
    } else if (pr && pr.deVB.has(h)) { Q = qv.clone().mul(pr.invVQ[h]); if (pr.alin[h]) Q.mul(pr.alin[h]); Q.mul(pr.rQ[h]).norm(); }
  }
  if (!Q) { const W = P.md.W[h]; Q = m4quat(W); }
  const p = f.pos ? vG(f.pos) : v3(P.md.W[h][12], P.md.W[h][13], P.md.W[h][14]), s = Math.hypot(P.md.W[h][0], P.md.W[h][1], P.md.W[h][2]) || 1;
  // el cuerpo: W = M(cuerpo) · off → M(cuerpo) = W · off⁻¹
  m4trs([p.x, p.y, p.z], [Q.x, Q.y, Q.z, Q.w], [s, s, s], _anA); m4mul(_anA, M4.inv(rc.x.off), _anB);
  const poner = (b, M) => { b.pos.set(M[12], M[13], M[14]); b.q.copy(m4quat(M)).norm(); b.vel.set(0, 0, 0); if (b.ang) b.ang.set(0, 0, 0); if (b.wake) b.wake(); if (b.updateWorld) b.updateWorld(); };
  poner(body, _anB);
  // (y los cuerpos sin hueso en el modelo que cuelgan de éste)
  if (f.rag.ragHuerf && f.rag.ragHuerf.length) {
    m4trs([body.pos.x, body.pos.y, body.pos.z], [body.q.x, body.q.y, body.q.z, body.q.w], [1, 1, 1], _anB);
    for (const o of f.rag.ragHuerf) if (o.anc === rc && o.x.b) { m4mul(_anB, o.rel, _anA); poner(o.x.b, _anA); }
  }
  gmanRagReanclar(P);
}
// las uniones del muñeco, vueltas a anclar donde quedaron los cuerpos: el personaje del juego tiene otras medidas que el esqueleto
// de Valve en que se lo pone (el Hero mide 2 m) y con las uniones de antes la física tiraba de golpe para volver a juntarlas —la
// cadera saltaba 18 cm en un cuadro y el muñeco se iba 1,3 m—. Así queda quieto como lo dejó la animación, como en GMod
function gmanRagReanclar(P) {
  if (!P.rag || typeof PH === 'undefined') return;
  const off = new Map(); for (const [, x] of P.rag.cuerpos) off.set(x.b, x.off);
  for (const j of PH.joints) {
    if (j.a.persona !== P || j.b.persona !== P) continue; const o = off.get(j.b); if (!o) continue;
    const b = j.b; m4trs([b.pos.x, b.pos.y, b.pos.z], [b.q.x, b.q.y, b.q.z, b.q.w], [1, 1, 1], _anA); m4mul(_anA, o, _anB); const pt = v3(_anB[12], _anB[13], _anB[14]);
    j.pa = j.a.q.conj().rot(vsub(pt, j.a.pos)); j.pb = j.b.q.conj().rot(vsub(pt, j.b.pos));
    // (y la referencia de los límites de giro, en la pose de ahora: si no, la física enderezaba de golpe lo que la animación dobló)
    const oa = off.get(j.a); if (!oa) continue; const a = j.a; m4trs([a.pos.x, a.pos.y, a.pos.z], [a.q.x, a.q.y, a.q.z, a.q.w], [1, 1, 1], _anA); m4mul(_anA, oa, _anC);
    const ax = vsub(pt, v3(_anC[12], _anC[13], _anC[14])); if (ax.len() < 1e-4) continue; ax.norm();
    const perp = Math.abs(ax.y) < 0.9 ? vcross(ax, v3(0, 1, 0)).norm() : vcross(ax, v3(1, 0, 0)).norm();
    j.axA = a.q.conj().rot(ax); j.axB = b.q.conj().rot(ax); j.pA = a.q.conj().rot(perp); j.pB = b.q.conj().rot(perp);
  }
}
const _anC = new Float32Array(16);
function gmanRagApi() {
  const E0 = GMA.metas && GMA.metas.Entity, PH = GMA.metas && GMA.metas.PhysObj; if (!E0 || !PH) return;
  const envolver = (n, f) => { const f0 = E0.get(n); E0.set(n, (e, ...a) => (e instanceof LEnt && e.ragP ? f(e, ...a) : typeof f0 === 'function' ? f0(e, ...a) : undefined)); };
  // (los PhysObj del muñeco: los de siempre —gmod_api.js, con su cuerpo— y SetPos/SetAngles/GetPos/GetAngles como hueso de Valve)
  if (!GMAN.mtRag) {
    const M = (GMAN.mtRag = new LuaTable()), I = new LuaTable();
    I.set('SetPos', (f, p) => { if (p instanceof LVec) { f.pos = new LVec(p.x, p.y, p.z); gmanRagPoner(f); } });
    I.set('SetAngles', (f, a) => { if (a instanceof LAng) { f.ang = new LAng(a.p, a.y, a.r); gmanRagPoner(f); } });
    I.set('GetPos', (f) => { const b = f.rc.x.b; const v = vS(b ? b.pos : v3()); v.__mt = GMA.mtVec; return v; });
    I.set('GetAngles', (f) => { const b = f.rc.x.b, a = quatAng(b ? b.q : new Quat()); a.__mt = GMA.mtAng; return a; });
    I.set('IsValid', (f) => !!(f.rc.x.b && f.rag.ragP && f.rag.ragP.rag));
    // (la velocidad que el Lua le da a un cuerpo la llevan también los que cuelgan de él sin hueso en el modelo: si no, la
    // cabeza del zombi se quedaba atrás cuando BSMod lanza el muñeco)
    I.set('SetVelocity', (f, v) => { const g = PH.get('SetVelocity'); if (typeof g === 'function') g(f, v); const b = f.rc.x.b; if (b) for (const o of f.rag.ragHuerf || []) if (o.anc === f.rc && o.x.b) { o.x.b.vel.copy(b.vel); if (o.x.b.wake) o.x.b.wake(); } });
    I.set('SetAngleVelocity', (f, v) => { const b = f.rc.x.b; if (b && v instanceof LVec && b.ang) { b.ang.copy(b.q.rot(dG(v)).scale(RAD)); if (b.wake) b.wake(); } });
    I.set('WorldToLocalVector', (f, v) => { const b = f.rc.x.b; const w = v instanceof LVec ? dG(v) : v3(); const l = b ? b.q.conj().rot(w) : w; const r = dS(l); r.__mt = GMA.mtVec; return r; });
    I.set('LocalToWorldVector', (f, v) => { const b = f.rc.x.b; const w = v instanceof LVec ? dG(v) : v3(); const l = b ? b.q.rot(w) : w; const r = dS(l); r.__mt = GMA.mtVec; return r; });
    I.set('GetEntity', (f) => f.rag);
    M.set('__index', (f, k) => { const v = I.get(k); return v !== undefined ? v : PH.get(k); }); M.set('__tostring', () => 'PhysObject [ragdoll]');
  }
  const fis = (e, i) => { const rc = e.ragCuerpos && e.ragCuerpos[i | 0]; if (!rc) return undefined; e.ragF = e.ragF || []; return e.ragF[i | 0] || (e.ragF[i | 0] = { e, rag: e, rc, rb: rc.x, __mt: GMAN.mtRag }); };
  envolver('GetPhysicsObjectCount', (e) => (e.ragCuerpos ? e.ragCuerpos.length : 0));
  envolver('GetPhysicsObjectNum', (e, i) => fis(e, i));
  envolver('GetPhysicsObject', (e) => fis(e, 0));
  envolver('TranslatePhysBoneToBone', (e, i) => { const rc = e.ragCuerpos[i | 0]; return rc ? rc.k : -1; });
  envolver('TranslateBoneToPhysBone', (e, b) => { const i = e.ragCuerpos.findIndex((rc) => rc.k === (b | 0)); return i; });
  envolver('IsRagdoll', () => true); envolver('GetPos', (e) => { const P = e.ragP; const v = vS(P.pos); v.__mt = GMA.mtVec; return v; });
  // (los huesos del muñeco: los del personaje tirado, con el giro llevado al de Valve con el mismo perfil)
  envolver('GetBonePosition', (e, b) => {
    const P = e.ragP, d = gmanDef(e.modelo), k = d ? (typeof b === 'number' ? b | 0 : d.porNombre.get(String(b).toLowerCase())) : undefined;
    const c = d && k !== undefined && k >= 0 ? (d.virt ? d.claves[k] : (/^valvebiped\.bip01_(.+)$/i.exec(d.nombres[k] || '') || [])[1]) : null;
    const m = c ? GMP_VB[String(c).toLowerCase()] : null, pr = gmanPerfilPersona(P);
    let h = m && pr ? pr.porNom[m] : m ? P.D.h[m] : undefined; if (h === undefined) h = P.D.h.Hips;
    P.md.actualizar(); const W = P.md.W[h], q = m4quat(W);
    if (P.gmp && P.gmp.def && !P.gmp.propio) { const G = P.gmp, j = G.hero.indexOf(h); if (j > 0) { q.mul(P.D.rw[h].conj()); if (G.alin[j]) q.mul(G.alin[j]); q.mul(G.restQ[j]).norm(); } }
    else if (pr && pr.deVB.has(h)) { q.mul(pr.rQ[h].conj()); if (pr.alin[h]) q.mul(pr.alin[h].conj()); q.mul(pr.invVQ[h].conj()).norm(); }
    const v = vS(v3(W[12], W[13], W[14])); v.__mt = GMA.mtVec; const a = quatAng(q); a.__mt = GMA.mtAng; return [v, a];
  });
  envolver('SetMaterial', (e, m) => { e.material = m; if (e.ragP) e.ragP.gmMaterial = m; });
  envolver('RemoveAllDecals', () => {});
}
if (typeof module !== 'undefined') module.exports = { gmanDef, gmanSecuencia, gmanHuesos, gmanRetarget, gmanPerfil, gmanApi };
