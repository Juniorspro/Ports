// ---------------- el arma en la mano de los addons: su propio ViewModel (.mdl) con sus animaciones ----------------
// Las armas de los addons (M9K, FA:S, TFA, CW, ArcCW, las sueltas) traen su modelo de primera persona (v_*.mdl con las
// manos, o c_*.mdl sin ellas). Acá se arma igual que las armas de HL2 del juego (herramientas/gmod.py: vista_source) pero
// en el momento: los huesos en los ejes de la cámara, la malla con piel (partida en grupos de 56 huesos como mucho), sus
// materiales, los enganches (la boca: de ahí salen trazadoras y fogonazos) y cada secuencia decodificada del .mdl
// (GMF.pose) remuestreada a 30 cuadros por segundo. Respeta lo de GMod: ViewModelFOV (el campo visual con que GMod la
// dibuja), ViewModelFlip (las de CS:S, espejadas), GetViewModelPosition/CalcViewModelView (miras, correr), SendWeaponAnim
// por actividad (ACT_VM_*) y las secuencias por nombre, y la entidad ViewModel de Lua (huesos, enganches, secuencias).
const GMV = { cache: new Map(), n: 0 };
const _q2m = (q) => { const [x, y, z, w] = q; return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]; };
function _m2q(m) {
  const t = m[0][0] + m[1][1] + m[2][2]; let x, y, z, w;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = 0.25 * s; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1] - m[1][2]) / s; x = 0.25 * s; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = 0.25 * s; z = (m[1][2] + m[2][1]) / s; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = 0.25 * s; }
  const l = Math.hypot(x, y, z, w) || 1; return [x / l, y / l, z / l, w / l];
}
const _m3mul = (a, b) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]));
const _m3T = (a) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => a[j][i]));
// una malla con piel (8 bytes por vértice: 4 huesos y 4 pesos) y sus poses de enlace
function gmvMallaPiel(nombre, P, N, U, J, Wb, porSub, bp) {
  const mi = gmMallaNueva(nombre, P, N, U, porSub, true), d = DATA.ms[mi], viejo = RBP.bins[d.k], n = d.v;
  const sk = (viejo.length + 3) & ~3, buf = new Uint8Array(sk + n * 8); buf.set(viejo);
  for (let k = 0; k < n; k++) { for (let c = 0; c < 4; c++) { buf[sk + k * 8 + c] = J[k * 4 + c]; buf[sk + k * 8 + 4 + c] = Wb[k * 4 + c]; } }
  RBP.bins[d.k] = buf; d.sk = sk; d.bp = bp;
  return mi;
}
// las mallas de un modelo (con cada hueso suyo en un nodo del árbol: nodo(h)) en los ejes del juego que dan pv (posiciones)
// y C (giros); caras por material (piel 0, primer modelo de cada cuerpo), partidas en grupos de 56 huesos como mucho
function gmvMallas(Mx, nodo, etiqueta, arb, pv, C, flip) {
  const CT = _m3T(C);
  if (!Mx.v || !Mx.mallas || !Mx.mallas.length) return 0;
  // la malla: vértices en los ejes de la vista; caras por material (piel 0, primer modelo de cada cuerpo)
  const V = Mx.v, n = V.n, P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), U = new Float32Array(n * 2), Uc = gmUVcorr(Mx);
  for (let i = 0; i < n; i++) {
    const p = pv([V.pos[i * 3], V.pos[i * 3 + 1], V.pos[i * 3 + 2]]); P.set(p, i * 3);
    for (let c = 0; c < 3; c++) Nn[i * 3 + c] = C[c][0] * V.nor[i * 3] + C[c][1] * V.nor[i * 3 + 1] + C[c][2] * V.nor[i * 3 + 2];
    U[i * 2] = V.uv[i * 2] - Uc[i * 2]; U[i * 2 + 1] = 1 - (V.uv[i * 2 + 1] - Uc[i * 2 + 1]);
  }
  const piel = Mx.pieles[0] || [], tris = [];   // [a, b, c, material]
  for (const m of Mx.mallas) {
    if (m.modelo !== 0) continue;
    const ti = piel[m.mat] !== undefined ? piel[m.mat] : m.mat, tex = Mx.texturas[ti] || Mx.texturas[m.mat] || 'error', mat = gmMaterial(tex, Mx.carpetas);
    const T = m.tris; for (let t = 0; t + 2 < T.length; t += 3) { if (flip) tris.push(T[t], T[t + 1], T[t + 2], mat.mi); else tris.push(T[t], T[t + 2], T[t + 1], mat.mi); }
  }
  if (!tris.length) return 0;
  // grupos de triángulos que usan 56 huesos como mucho
  const huesosDe = (v) => { const o = []; for (let c = 0; c < 3; c++) if (V.w[v * 3 + c] > 1e-4) o.push(V.hb[v * 3 + c]); return o.length ? o : [V.hb[v * 3]]; };
  const grupos = []; let g = null;
  for (let t = 0; t < tris.length; t += 4) {
    const hs = new Set([...huesosDe(tris[t]), ...huesosDe(tris[t + 1]), ...huesosDe(tris[t + 2])]);
    if (!g || [...hs].filter((h) => !g.h.has(h)).length + g.h.size > 56) { g = { h: new Set(), t: [] }; grupos.push(g); }
    for (const h of hs) g.h.add(h); g.t.push(t);
  }
  const pos2b = Mx.huesos.map((h) => { const m = h.p2b; return { R: [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]], t: [m[3], m[7], m[11]] }; });
  grupos.forEach((G, gi) => {
    const usados = [...G.h], col = new Map(usados.map((h, i) => [h, i])), remap = new Map(), Pg = [], Ng = [], Ug = [], Jg = [], Wg = [], porMat = new Map();
    for (const t of G.t) {
      const L = porMat.get(tris[t + 3]) || []; porMat.set(tris[t + 3], L);
      for (let c = 0; c < 3; c++) {
        const v = tris[t + c]; let j = remap.get(v);
        if (j === undefined) {
          j = remap.size; remap.set(v, j);
          Pg.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); Ng.push(Nn[v * 3], Nn[v * 3 + 1], Nn[v * 3 + 2]); Ug.push(U[v * 2], U[v * 2 + 1]);
          // pesos por hueso usado (los repetidos se suman), en bytes que suman 255
          const ws = new Map(); for (let q = 0; q < 3; q++) { const w = V.w[v * 3 + q]; if (w > 1e-4) { const h = col.get(V.hb[v * 3 + q]); if (h !== undefined) ws.set(h, (ws.get(h) || 0) + w); } }
          if (!ws.size) ws.set(col.get(V.hb[v * 3]) || 0, 1);
          const L4 = [...ws].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = L4.reduce((a, x) => a + x[1], 0) || 1, wb = L4.map((x) => Math.floor(x[1] / tot * 255)); wb[0] += 255 - wb.reduce((a, x) => a + x, 0);
          for (let q = 0; q < 4; q++) { Jg.push(L4[q] ? L4[q][0] : 0); Wg.push(L4[q] ? wb[q] : 0); }
        }
        L.push(j);
      }
    }
    // pose de enlace: Ce · pose→hueso · Ce⁻¹ (en filas)
    const bp = usados.map((h) => { const { R, t } = pos2b[h], Rr = _m3mul(_m3mul(C, R), CT), tt = pv(t); return [Rr[0][0], Rr[0][1], Rr[0][2], tt[0], Rr[1][0], Rr[1][1], Rr[1][2], tt[1], Rr[2][0], Rr[2][1], Rr[2][2], tt[2], 0, 0, 0, 1]; });
    const mats = [...porMat.keys()];
    const mi = gmvMallaPiel('GMV_' + etiqueta + '#' + gi, new Float32Array(Pg), new Float32Array(Ng), new Float32Array(Ug), new Uint8Array(Jg), new Uint8Array(Wg), mats.map((x) => porMat.get(x)), bp);
    arb.push({ n: 'GMV_malla' + etiqueta.length + '_' + gi, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: 0, m: mi, mt: mats, bo: usados.map((h) => nodo(h)) });
  });
  return tris.length / 4;
}
// arma la vista desde el .mdl: { md, porHash, clip, t, base, mz, M, sec (secuencia → clip), actos (ACT → clips), huesoNodo }
function gmvConstruir(ruta, flip, fovVm, clase, manos) {
  const k = ruta + '|' + (flip ? 1 : 0) + '|' + fovVm + '|' + (manos || '');
  if (GMV.cache.has(k)) return GMV.cache.get(k);
  GMV.cache.set(k, null);
  let M; try { M = gmLeerModelo(ruta); } catch (e) { if (e.pendiente) return null; try { M = GMF.mdl(gmArchivo(ruta)); M.mallas = []; } catch (e2) { gmErr('vista ' + ruta, e); return null; } }   // (sin .vvd/.vtx: sólo huesos y animaciones; si se están leyendo del disco, se vuelve a armar cuando llegan)
  const H = M.huesos, nb = H.length, id = 'gmv' + ++GMV.n;
  // ejes: Source (x adelante, y izquierda, z arriba) → la vista del juego (x izquierda, y arriba, z adelante), en las
  // unidades de debajo del WalkSway (que está escalado 0,3); ViewModelFlip espeja el eje x
  const fx = flip ? -1 : 1, sc = GM_S / 0.3, C = [[0, fx, 0], [0, 0, 1], [1, 0, 0]], CT = _m3T(C);
  const pv = (p) => [sc * fx * p[1], sc * p[2], sc * p[0]];
  const rot = (q) => _m2q(_m3mul(_m3mul(C, _q2m(q)), CT));
  // (GMod dibuja la vista con su propio campo visual, ViewModelFOV horizontal a 4:3; la vista del juego usa 60° de alto)
  const kf = Math.tan(30 * Math.PI / 180) / (Math.tan(Math.max(20, Math.min(120, fovVm || 62)) / 2 * Math.PI / 180) * 0.75);
  const arb = [{ n: 'GMV_' + id, p: [0, 0, 0], r: [0, 0, 0, 1], s: [kf, kf, 1], pa: -1 }];
  for (let i = 0; i < nb; i++) { const h = H[i]; arb.push({ n: h.n, p: pv(h.pos), r: rot(h.q), s: [1, 1, 1], pa: h.pa >= 0 ? 1 + h.pa : 0 }); }
  // la malla (de un modelo Mx, con cada hueso suyo en un nodo del árbol): vértices en los ejes de la vista; caras por
  // material (piel 0, primer modelo de cada cuerpo)
  const mallas = (Mx, nodo, etiqueta) => gmvMallas(Mx, nodo, etiqueta, arb, pv, C, flip);
  // (hay ViewModels sin malla, sólo huesos y animaciones: las manos las pone UseHands, como el parkour)
  if (!mallas(M, (h) => 1 + h, ruta) && !manos) { gmErr('vista ' + ruta, 'sin caras'); return null; }
  // las manos de GMod (UseHands): el modelo c_arms pegado a los huesos del arma por nombre, como el bonemerge de GMod
  if (manos) {
    let Mh = null; try { Mh = gmLeerModelo(manos); } catch (e) { Mh = null; if (e.pendiente) { gmModeloPedir(manos, () => GMV.cache.delete(k)); return null; } }
    if (Mh) {
      const porNombre = new Map(H.map((h, i) => [h.n.toLowerCase(), 1 + i]));
      const nodo = (h) => { for (let k = h, n = 0; k >= 0 && n < 64; k = Mh.huesos[k].pa, n++) { const x = porNombre.get(Mh.huesos[k].n.toLowerCase()); if (x !== undefined) return x; } return 0; };
      mallas(Mh, nodo, manos);
    }
  }
  // los enganches: un nodo por cada uno (la boca primero)
  const adj = M.adjuntos.map((a, i) => ({ a, i })), boca = adj.find((x) => /muzzle|flash/i.test(x.a.n)) || adj.find((x) => x.a.n === '1') || adj[0];
  const nodoAdj = [];
  for (const { a } of adj) {
    if (a.hueso < 0 || a.hueso >= nb) { nodoAdj.push(-1); continue; }
    const m = a.m, R = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]];
    nodoAdj.push(arb.length); arb.push({ n: a === (boca && boca.a) ? 'Muzzle' : 'GMV_adj_' + a.n, p: pv([m[3], m[7], m[11]]), r: _m2q(_m3mul(_m3mul(C, R), CT)), s: [1, 1, 1], pa: 1 + a.hueso });
  }
  // el modelo y el mapa de pistas (como vistaArma)
  const md = new Modelo(arb), camino = (i) => { const s = []; while (i > 0) { s.push(arb[i].n); i = arb[i].pa; } return s.reverse().join('/'); };
  const porHash = new Map(); for (let i = 1; i < arb.length; i++) porHash.set(crc32(camino(i)), i); porHash.set(crc32(''), 0);
  const v = { md, porHash, flip: !!flip, clip: null, t: 0, base: { p: md.p.map((x) => x.slice()), r: md.r.map((x) => x.slice()), s: md.s.map((x) => x.slice()) }, mz: arb.findIndex((x) => x.n === 'Muzzle'), M, ruta, sec: [], actos: new Map(), nodoAdj, kf, fx, gm: true };
  // las secuencias → clips a 30 cuadros por segundo
  const fps30 = (DATA.an && DATA.an.fps) || 30;
  M.secuencias.forEach((sq, si) => {
    const A = M.anims[sq.anim]; if (!A || A.bloque !== 0 || A.nf < 1) { v.sec.push(null); return; }
    const fps = A.fps > 0 ? A.fps : 30, dur = Math.max(0, (A.nf - 1) / fps), n30 = Math.max(2, Math.round(dur * fps30) + 1);
    const poses = []; for (let f = 0; f < A.nf; f++) poses.push(GMF.poseCapas(M, sq.anim, f));
    const pistas = [];
    for (let h = 0; h < nb; h++) {
      const Pk = [], Rk = []; let ult = null;
      for (let i = 0; i < n30; i++) {
        const fr = Math.min(A.nf - 1, i / fps30 * fps), f0 = Math.floor(fr), f1 = Math.min(A.nf - 1, f0 + 1), w = fr - f0, a = poses[f0], b = poses[f1];
        const p = [0, 1, 2].map((c) => a.P[h * 3 + c] * (1 - w) + b.P[h * 3 + c] * w);
        let q1 = [b.Q[h * 4], b.Q[h * 4 + 1], b.Q[h * 4 + 2], b.Q[h * 4 + 3]]; const q0 = [a.Q[h * 4], a.Q[h * 4 + 1], a.Q[h * 4 + 2], a.Q[h * 4 + 3]];
        if (q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3] < 0) q1 = q1.map((x) => -x);
        const qi = q0.map((x, c) => x * (1 - w) + q1[c] * w), l = Math.hypot(...qi) || 1;
        let q = rot(qi.map((x) => x / l)); if (ult && q[0] * ult[0] + q[1] * ult[1] + q[2] * ult[2] + q[3] * ult[3] < 0) q = q.map((x) => -x); ult = q;
        Pk.push(pv(p)); Rk.push(q);
      }
      const hc = crc32(camino(1 + h)); pistas.push({ h: hc, k: 'p', f: Pk }, { h: hc, k: 'r', f: Rk });
    }
    const nom = id + ':' + sq.n, clip = { d: (n30 - 1) / fps30, loop: sq.loop, p: pistas };
    animCompactar(clip); DATA.an.clips[nom] = [clip]; DATA.anPorNombre[nom] = clip; v.sec.push(nom);
    const act = String(sq.act || '').toUpperCase(); if (act) { const L = v.actos.get(act) || []; L.push(nom); v.actos.set(act, L); }
  });
  // las cuatro de siempre (por actividad; si no, por el nombre de la secuencia)
  const busca = (acts, re) => { for (const a of acts) { const L = v.actos.get(a); if (L && L.length) return L[0]; } const i = M.secuencias.findIndex((s, k) => v.sec[k] && re.test(s.n)); return i >= 0 ? v.sec[i] : null; };
  v.quieto = busca(['ACT_VM_IDLE'], /idle/i) || v.sec.find(Boolean) || null;
  v.fuego = busca(['ACT_VM_PRIMARYATTACK', 'ACT_VM_HITCENTER', 'ACT_VM_SECONDARYATTACK'], /fire|shoot|attack|hit/i);
  v.recarga = busca(['ACT_VM_RELOAD', 'ACT_SHOTGUN_RELOAD_START'], /reload/i);
  v.sacar = busca(['ACT_VM_DRAW', 'ACT_VM_DEPLOY'], /draw|deploy/i);
  GMV.cache.set(k, v);
  return v;
}
// la vista del arma del addon que tiene el jugador
function gmvDeArma(w) {
  if (w.vista !== undefined) return w.vista;
  const c = claseTabla(w.clase, 'C') || claseTabla(w.clase, 'S'), ruta = String((c && buscarEnClase(c, 'ViewModel')) || '').toLowerCase().replace(/\\/g, '/');
  w.vista = null;
  if (!ruta || !gmArchivo(ruta)) return null;
  const manos = c && R_T(buscarEnClase(c, 'UseHands')) && gmArchivo('models/weapons/c_arms_citizen.mdl') ? 'models/weapons/c_arms_citizen.mdl' : null;   // (las manos del jugador, las de ciudadano)
  const v = gmvConstruir(ruta, !!(c && buscarEnClase(c, 'ViewModelFlip')), +(c && buscarEnClase(c, 'ViewModelFOV')) || 62, w.clase, manos);
  // (su geometría o la de las manos se está leyendo del disco: se vuelve a probar en los cuadros siguientes)
  if (!v) { if (typeof gmModeloFaltan === 'function' && (GMPZ.mdl.size || gmModeloFaltan(ruta).length || (manos && gmModeloFaltan(manos).length))) w.vista = undefined; return null; }
  w.vista = v;
  const D = DEF_ARMAS['gm:' + w.clase]; if (D) { D.quieto = v.quieto; D.fuego = v.fuego; D.recarga = v.recarga; D.sacar = v.sacar; }
  return v;
}
// lo llama dibujarVista (armas.js) cuando el arma de un addon trae su propio ViewModel
function gmaVistaDibujar() {
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n]; if (!D || D.tipo !== 'gmswep') return false;
  const w = GMA.armasJug && GMA.armasJug.get(D.gm); if (!w) return false;
  const v = gmvDeArma(w); if (!v) return false;
  if (ARM.v !== v) { ARM.v = v; v.t = 0; v.clip = null; if (v.sacar) vistaTocar(v, v.sacar); else if (v.quieto) vistaTocar(v, v.quieto, { loop: true }); }
  // (Player:DrawViewModel(false) —las miras telescópicas de M9K, CW, FA:S...— o SWEP:ShouldDrawViewModel() falso: con la
  // mira puesta sólo se ve el dibujo de la mira, no el arma adentro)
  if (w.vmOculta || w.vmApagada) return false;
  { const r = metodo(w, 'ShouldDrawViewModel', 'C'); if (r && r[0] === false) return false; }
  // dónde: la cámara, o lo que diga el arma (GetViewModelPosition: miras, correr) y el modo de juego (CalcViewModelView)
  let pos = CAM.pos, q = CAM.q;
  try {
    const ang = dirAng(dS(CAM.fwd)); ang.__mt = GMA.mtAng; const p0 = GMA.V(CAM.pos);
    let r = metodo(w, 'GetViewModelPosition', 'C', p0, ang);
    let P = r[0] instanceof LVec ? r[0] : p0, A = r[1] instanceof LAng ? r[1] : ang;
    const vm = G_vm(); r = metodo(w, 'CalcViewModelView', 'C', vm, p0, ang, P, A); if (r[0] instanceof LVec) P = r[0]; if (r[1] instanceof LAng) A = r[1];
    if (P !== p0 || A !== ang) {
      pos = vG(P); q = angQuat(A);
      // (ViewModelFlip: GMod espeja la vista ya ubicada, en el espacio de la cámara; las miras de las de CS:S vienen pensadas
      // así —IronSightsPos.x positivo— y sin espejar el corrimiento quedan del lado de afuera)
      if (v.flip) {
        const der = CAM.q.rot(v3(1, 0, 0)), k = vdot(vsub(pos, CAM.pos), der); pos = vsub(pos, vscale(der, 2 * k));
        const rel = CAM.q.conj().mul(q); rel.y = -rel.y; rel.z = -rel.z; q = CAM.q.clone().mul(rel);
      }
    }
  } catch (e) { /* (el arma sigue en la mano aunque su Lua falle) */ }
  vistaUbicar(v, pos, q, ARM.sway); v.md.encolar();
  return true;
}
// el número de una actividad por su nombre, como la ve el Lua: las del prelude y también las que no están ahí y salen del
// número fijo por nombre de gmod_api.js (ACT_RELOAD_START, ACT_RELOAD_FINISH, ACT_DEPLOY, ACT_UNDEPLOY...)
function gmvActNum(k) { const R = GMA.R; let x = R.G.get(k); if (x === undefined && R.ix) { try { x = R.ix(R.G, k); } catch (e) { x = undefined; } } return x; }
// SendWeaponAnim con la vista propia: la secuencia de esa actividad (si hay varias, una al azar). Se busca entre las
// actividades del modelo: antes se buscaba el nombre entre las globales de Lua y las que no están en el prelude no
// aparecían (Discord, Team Fortress 2 Weapon Pack: «las animaciones no cargan»; la minigun nunca bajaba ni subía —ACT_DEPLOY,
// ACT_UNDEPLOY— y las recargas de a un cartucho no empezaban ni terminaban —ACT_RELOAD_START, ACT_RELOAD_FINISH—)
function gmvActividad(v, act) {
  let nom = null;
  if (typeof act === 'number') { for (const k of v.actos.keys()) if (gmvActNum(k) === act) { nom = k; break; } }
  const L = nom ? v.actos.get(nom) : null; if (!L || !L.length) return 0;
  return vistaTocar(v, L[(Math.random() * L.length) | 0], { loop: /IDLE/.test(nom) });
}
// la entidad ViewModel de Lua cuando la vista es del addon: huesos, enganches y secuencias
function gmvVista() { const n = typeof ARM !== 'undefined' ? ARM.lista[ARM.i] : null, D = n && DEF_ARMAS[n]; return D && D.tipo === 'gmswep' && ARM.v && ARM.v.gm ? ARM.v : null; }
function gmvHuesoMundo(v, i) { v.md.actualizar(); return v.md.W[1 + i]; }
if (typeof module !== 'undefined') module.exports = { gmvConstruir, gmvDeArma, gmaVistaDibujar, gmvActividad, gmvVista };
// los métodos de la entidad ViewModel (y SequenceDuration del arma) cuando la vista es la del addon
function gmvApi() {
  const EM = GMA.metas && GMA.metas.Entity, WM = GMA.metas && GMA.metas.Weapon; if (!EM) return;
  const tab = (o) => { const t = new LuaTable(); for (const k in o) t.set(k, o[k]); return t; };
  const ejes = (v, W) => {   // matriz del juego (columnas) → posición y ejes de Source (adelante, izquierda, arriba)
    const col = (c) => { const x = W[c * 4], y = W[c * 4 + 1], z = W[c * 4 + 2], l = Math.hypot(x, y, z) || 1; return dS(v3(x / l, y / l, z / l)); };
    const F = col(2), L0 = col(0), Lf = new LVec(L0.x * v.fx, L0.y * v.fx, L0.z * v.fx), U = col(1), P = vS(v3(W[12], W[13], W[14]));
    return { P, F, L: Lf, U };
  };
  const ang = (e) => { const a = matAng([e.F.x, e.F.y, e.F.z], [e.L.x, e.L.y, e.L.z], [e.U.x, e.U.y, e.U.z]); a.__mt = GMA.mtAng; return a; };
  const pos = (p) => { p.__mt = GMA.mtVec; return p; };
  // (por nombre con un índice armado una vez: las armas del SWEP Construction Kit buscan todos los huesos en cada cuadro)
  const hueso = (v, n) => {
    if (typeof n === 'number') return n >= 0 && n < v.M.huesos.length ? n : -1;
    let ix = v.ixHuesos; if (!ix) { ix = v.ixHuesos = new Map(); v.M.huesos.forEach((h, i) => { const k = h.n.toLowerCase(); if (!ix.has(k)) ix.set(k, i); }); }
    const i = ix.get(typeof n === 'string' ? n.toLowerCase() : String(n).toLowerCase()); return i === undefined ? -1 : i;
  };
  const reemplazar = (M, nombre, f) => { const orig = M.get(nombre) || (M !== EM ? EM.get(nombre) : undefined); M.set(nombre, (e, ...a) => { const v = (e.tipo === 'vm' || (e.tipo === 'arma' && e === GMA.swep)) && gmvVista(); if (v) { const r = f(v, e, ...a); if (r !== undefined) return r; } return typeof orig === 'function' ? orig(e, ...a) : undefined; }); };
  const soloVm = (nombre, f) => reemplazar(EM, nombre, (v, e, ...a) => (e.tipo === 'vm' ? f(v, e, ...a) : undefined));
  soloVm('GetModel', (v) => v.ruta);
  soloVm('LookupBone', (v, e, n) => { const i = hueso(v, n); return i < 0 ? null : i; });
  soloVm('GetBoneCount', (v) => v.M.huesos.length); soloVm('GetBoneName', (v, e, i) => (v.M.huesos[i | 0] ? v.M.huesos[i | 0].n : '__INVALIDBONE__')); soloVm('GetBoneParent', (v, e, i) => (v.M.huesos[i | 0] ? v.M.huesos[i | 0].pa : -1));
  soloVm('GetBoneMatrix', (v, e, i) => { i = hueso(v, i); if (i < 0) i = 0; const x = ejes(v, gmvHuesoMundo(v, i)); return gmrMatriz([x.F.x, x.L.x, x.U.x, x.P.x, x.F.y, x.L.y, x.U.y, x.P.y, x.F.z, x.L.z, x.U.z, x.P.z, 0, 0, 0, 1]); });
  soloVm('GetBonePosition', (v, e, i) => { i = hueso(v, i); if (i < 0) i = 0;   // (un hueso que este modelo no tiene, o nil: la raíz de la vista, no nil: el Lua del addon sigue)
    const x = ejes(v, gmvHuesoMundo(v, i)); return [pos(x.P), ang(x)]; });
  soloVm('LookupAttachment', (v, e, n) => { const s = String(n).toLowerCase(), i = v.M.adjuntos.findIndex((a) => a.n.toLowerCase() === s); return i < 0 ? 0 : i + 1; });
  soloVm('GetAttachment', (v, e, i) => { const k = (i | 0) - 1, ni = v.nodoAdj[k]; if (ni === undefined || ni < 0) return null; v.md.actualizar(); const x = ejes(v, v.md.W[ni]); return tab({ Pos: pos(x.P), Ang: ang(x) }); });
  soloVm('GetAttachments', (v) => GMA.R.tab(v.M.adjuntos.map((a, i) => tab({ id: i + 1, name: a.n }))));
  // dónde está y hacia dónde mira la vista (la raíz: la cámara con el balanceo, sin el espejo del modelo). Antes daba la
  // entidad sin ubicar (ángulos 0) mientras los enganches venían en el mundo: Extended Flashlight hace
  // CalcView = ángulos − (vm:GetAngles() − enganche.Ang) y la cámara se sumaba a sí misma en cada cuadro y salía girando
  const raiz = (v) => ejes({ fx: 1 }, v.md.raiz);
  soloVm('GetPos', (v) => pos(raiz(v).P)); soloVm('GetAngles', (v) => ang(raiz(v)));
  soloVm('GetForward', (v) => pos(raiz(v).F)); soloVm('GetUp', (v) => pos(raiz(v).U)); soloVm('GetRight', (v) => { const L = raiz(v).L; return pos(new LVec(-L.x, -L.y, -L.z)); });
  soloVm('LookupSequence', (v, e, n) => { const s = String(n).toLowerCase(), i = v.M.secuencias.findIndex((q) => q.n.toLowerCase() === s); return [i, i >= 0 && v.sec[i] ? DATA.anPorNombre[v.sec[i]].d : 0]; });
  soloVm('GetSequence', (v) => Math.max(0, v.sec.findIndex((n) => n && DATA.anPorNombre[n] === v.clip)));
  soloVm('GetSequenceName', (v, e, i) => (v.M.secuencias[i | 0] ? v.M.secuencias[i | 0].n : 'Unknown'));
  soloVm('GetSequenceActivity', (v, e, i) => { const a = v.M.secuencias[i | 0] && v.M.secuencias[i | 0].act; const x = a && gmvActNum(a.toUpperCase()); return typeof x === 'number' ? x : -1; });
  soloVm('GetSequenceActivityName', (v, e, i) => (v.M.secuencias[i | 0] ? v.M.secuencias[i | 0].act : ''));
  soloVm('SelectWeightedSequence', (v, e, act) => { for (const [k, L] of v.actos) if (gmvActNum(k) === act) return v.sec.indexOf(L[0]); return -1; });
  const tocar = (v, i) => { const n = v.sec[i | 0]; if (n) vistaTocar(v, n, { loop: DATA.anPorNombre[n].loop }); };
  soloVm('SendViewModelMatchingSequence', (v, e, i) => { tocar(v, i); return true; }); soloVm('ResetSequence', (v, e, i) => { tocar(v, i); return true; }); soloVm('SetSequence', (v, e, i) => { tocar(v, i); return true; });
  soloVm('SetPlaybackRate', (v, e, r) => { v.vel = Math.max(0.01, +r || 1); return true; }); soloVm('GetPlaybackRate', (v) => v.vel || 1);
  soloVm('GetCycle', (v) => (v.clip && v.clip.d ? Math.min(1, v.t / v.clip.d) : 0)); soloVm('SetCycle', (v, e, c) => { if (v.clip) v.t = Math.max(0, Math.min(1, +c || 0)) * v.clip.d; return true; });
  soloVm('SetNoDraw', (v, e, b) => { const w = GMA.swep; if (w) w.vmOculta = !!b; return true; }); soloVm('GetNoDraw', () => !!(GMA.swep && GMA.swep.vmOculta));
  // manipular huesos (las armas del SWEP Construction Kit agrandan, achican y mueven huesos del ViewModel)
  // (las bases de armas como la de M9K ponen en cada cuadro escala 1, ángulo 0 y posición 0 a TODOS los huesos: lo que no
  // cambia nada no hace nada, y lo que cambia rehace sólo la matriz de ese hueso; antes se rehacían todas en cada llamada
  // y la vista de una AK-47 de M9K costaba 11,6 ms por cuadro)
  const igual = (k, a, b) => (k === 'a' ? a.p === b.p && a.y === b.y && a.r === b.r : a.x === b.x && a.y === b.y && a.z === b.z);
  const neutro = { p: new LVec(), a: new LAng(), s: new LVec(1, 1, 1) };
  const manip = (v, i, k, x) => {
    i = hueso(v, i); if (i < 0) return true;
    const m0 = v.manip && v.manip.get(i);
    if (igual(k, m0 ? m0[k] : neutro[k], x)) return true;
    v.manip = v.manip || new Map(); const m = m0 || { p: new LVec(), a: new LAng(), s: new LVec(1, 1, 1) }; m[k] = x; v.manip.set(i, m);
    if (igual('p', m.p, neutro.p) && igual('a', m.a, neutro.a) && igual('s', m.s, neutro.s)) { v.manip.delete(i); if (v.md.E) v.md.E[1 + i] = undefined; v.md.sucio = true; }
    else gmvManipAplicar(v, i);
    return true;
  };
  soloVm('ManipulateBoneScale', (v, e, i, s) => (s instanceof LVec ? manip(v, i, 's', new LVec(s.x, s.y, s.z)) : true));
  soloVm('ManipulateBonePosition', (v, e, i, p) => (p instanceof LVec ? manip(v, i, 'p', new LVec(p.x, p.y, p.z)) : true));
  soloVm('ManipulateBoneAngles', (v, e, i, a) => (a instanceof LAng ? manip(v, i, 'a', new LAng(a.p, a.y, a.r)) : true));
  soloVm('GetManipulateBoneScale', (v, e, i) => { const m = v.manip && v.manip.get(hueso(v, i)); return m ? GMA.nv(m.s.x, m.s.y, m.s.z) : GMA.nv(1, 1, 1); });
  soloVm('GetManipulateBonePosition', (v, e, i) => { const m = v.manip && v.manip.get(hueso(v, i)); return m ? GMA.nv(m.p.x, m.p.y, m.p.z) : GMA.nv(0, 0, 0); });
  soloVm('GetManipulateBoneAngles', (v, e, i) => { const m = v.manip && v.manip.get(hueso(v, i)); const a = m ? new LAng(m.a.p, m.a.y, m.a.r) : new LAng(); a.__mt = GMA.mtAng; return a; });
  soloVm('SetupBones', () => true); soloVm('InvalidateBoneCache', () => true); soloVm('IsValid', () => true); soloVm('DrawModel', () => true);
  // (el arma: la duración de lo que está haciendo la vista)
  const dur = (v, e, i) => { if (typeof i === 'number' && v.sec[i]) return DATA.anPorNombre[v.sec[i]].d; return v.clip ? v.clip.d / (v.vel || 1) : 0; };
  reemplazar(EM, 'SequenceDuration', dur); if (WM) reemplazar(WM, 'SequenceDuration', dur);
}
// (cada hueso manipulado: una matriz extra después de su local, en los ejes de la vista)
function gmvManipAplicar(v, solo) {
  const md = v.md; md.E = md.E || [];
  for (const [i, m] of v.manip) {
    if (solo !== undefined && i !== solo) continue;
    const a = m.a, R = angMat(a), C = [[0, v.fx, 0], [0, 0, 1], [1, 0, 0]], Rm = [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
    const Rr = _m3mul(_m3mul(C, Rm), _m3T(C)), q = _m2q(Rr), sc = GM_S / 0.3, p = [sc * v.fx * m.p.y, sc * m.p.z, sc * m.p.x], s = [m.s.y, m.s.z, m.s.x];
    const X = new Float32Array(16); m4trs(p, q, s, X); md.E[1 + i] = X;
  }
  md.sucio = true;
}

// ---------------- la cámara del Lua: CalcView (hooks, el modo de juego y el arma) ----------------
// En GMod cada cuadro se pregunta CalcView (hook.Run, y si nadie contesta GM:CalcView, que le pregunta al arma con
// SWEP:CalcView): lo que devuelve es de dónde se mira (origin, angles) y si se ve el propio cuerpo (drawviewer, la
// tercera persona de la Lightsaber, por ejemplo). Sólo se pregunta si hay un hook o un arma o modo que lo cambie.
function gmaVistaLua(C) {
  const fin = () => { if (GMA.vlTer !== undefined) { JUG.tercera = GMA.vlTer; GMA.vlTer = undefined; } };
  if (!GMA.R || !GMA.activo || !GMA.jug || !JUG.vivo || JUG.vehiculo || JUEGO.estado !== 'juego') return fin();
  const H = GMA.hooks.get('CalcView'), hayH = !!(H && [...H.values()].some((h) => h.C));
  const w = GMA.swep && GMA.swep.vivo ? GMA.swep : null, c = w && claseTabla(w.clase, 'C'), wf = c && buscarEnClase(c, 'CalcView');
  if (GMA.vlBase === undefined) { const b = claseTabla('weapon_base', 'C'); GMA.vlBase = b ? b.get('CalcView') : null; }
  const M = GMA.modo, gf = M && M.C ? M.C.get('CalcView') : null, g0 = M && M.t ? (M.t.get('sandbox:C') || {}).get?.('CalcView') : null;
  const armaPropia = typeof wf === 'function' && wf !== GMA.vlBase, modoPropio = typeof gf === 'function' && gf !== g0;
  if (!hayH && !armaPropia && !modoPropio) return fin();
  const ojo = JUG.ojoPos || C.pos, fwd = C.q.rot(v3(0, 0, 1)), o = GMA.V ? GMA.V(ojo) : vS(ojo), a = dirAng(dS(fwd)); o.__mt = GMA.mtVec; a.__mt = GMA.mtAng;
  const cp = (v) => { const x = new LVec(v.x, v.y, v.z); x.__mt = GMA.mtVec; return x; }, ca = (v) => { const x = new LAng(v.p, v.y, v.r); x.__mt = GMA.mtAng; return x; };
  const fov = C.fov || 75;
  let vista = null;
  GMA.ultErr = false;
  if (hayH) { const r = gmaHook0('CalcView', 'C', GMA.jug, cp(o), ca(a), fov, 3, 30000); if (r[0] instanceof LuaTable) vista = r[0]; }
  if (!vista && modoPropio) { const r = gmLlamar(gf, 'C', M.C, GMA.jug, cp(o), ca(a), fov, 3, 30000); if (r[0] instanceof LuaTable) vista = r[0]; }
  if (!vista && armaPropia) { const r = gmLlamar(wf, 'C', w, GMA.jug, cp(o), ca(a), fov); if (r.length) { vista = new LuaTable(); if (r[0] instanceof LVec) vista.set('origin', r[0]); if (r[1] instanceof LAng) vista.set('angles', r[1]); } }
  if (!vista) return fin();
  const vo = vista.get('origin'), va = vista.get('angles'), ter = R_T(vista.get('drawviewer'));
  // (la tercera persona que pide: el cuerpo se ve y el arma de primera persona no; al dejar de pedirla, como estaba)
  if (ter) { if (GMA.vlTer === undefined) { GMA.vlTer = !!JUG.tercera; JUG.tercera = true; } } else fin();
  if (vo instanceof LVec && Math.hypot(vo.x - o.x, vo.y - o.y, vo.z - o.z) > 0.5) C.pos.copy(vG(vo));
  else if (ter && JUG.ojoPos) C.pos.copy(JUG.ojoPos);
  if (va instanceof LAng && (Math.abs(va.p - a.p) > 0.05 || Math.abs(((va.y - a.y + 540) % 360) - 180) > 0.05 || Math.abs(va.r - a.r) > 0.05)) C.q.copy(angQuat(va));
}
// el zoom de Player:SetFOV (las miras: el sniper de TF2 hace SetFOV(GetFOV() / 5)); 0 = el de siempre. Lo usa la cámara
// (principal.js) junto con la sensibilidad del mouse: la que diga SWEP:AdjustMouseSensitivity o, si no dice, la proporción
// del zoom, como GMod
function gmaFovLua() { return GMA.R && GMA.activo && GMA.fovLua > 0 && typeof JUG !== 'undefined' && JUG.vivo && !JUG.vehiculo && JUEGO.estado === 'juego' ? GMA.fovLua : 0; }
function gmaSensLua() {
  if (!GMA.R || !GMA.activo) return 1;
  let k = 0; const w = GMA.swep && GMA.swep.vivo ? GMA.swep : null;
  if (w) {
    if (GMA.amsBase === undefined) { const b = claseTabla('weapon_base', 'C'); GMA.amsBase = b ? b.get('AdjustMouseSensitivity') : null; }
    const c = claseTabla(w.clase, 'C'), f = c && buscarEnClase(c, 'AdjustMouseSensitivity');
    if (typeof f === 'function' && f !== GMA.amsBase) { const r = gmLlamar(f, 'C', w), x = +r[0]; if (x > 0) k = x; }
  }
  const fz = gmaFovLua(); if (!k && fz) k = fz / (typeof fovBase === 'function' ? fovBase() : 70);   // (proporción con el campo de visión elegido)
  return k > 0 ? Math.max(0.02, Math.min(4, k)) : 1;
}
