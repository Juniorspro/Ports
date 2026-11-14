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
// y C (giros); caras por material (piel 0, primer modelo de cada cuerpo, o la piel y los cuerpos de op: { piel, cuerpos },
// como Entity:SetSkin y SetBodyGroups: las manos de un modelo de jugador con guantes o de otro color), partidas en grupos
// de 56 huesos como mucho
function gmvMallas(Mx, nodo, etiqueta, arb, pv, C, flip, op) {
  const CT = _m3T(C);
  if (!Mx.v || !Mx.mallas || !Mx.mallas.length) return 0;
  // la malla: vértices en los ejes de la vista; caras por material (piel 0, primer modelo de cada cuerpo)
  const V = Mx.v, n = V.n, P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), U = new Float32Array(n * 2), Uc = gmUVcorr(Mx);
  for (let i = 0; i < n; i++) {
    const p = pv([V.pos[i * 3], V.pos[i * 3 + 1], V.pos[i * 3 + 2]]); P.set(p, i * 3);
    for (let c = 0; c < 3; c++) Nn[i * 3 + c] = C[c][0] * V.nor[i * 3] + C[c][1] * V.nor[i * 3 + 1] + C[c][2] * V.nor[i * 3 + 2];
    U[i * 2] = V.uv[i * 2] - Uc[i * 2]; U[i * 2 + 1] = 1 - (V.uv[i * 2 + 1] - Uc[i * 2 + 1]);
  }
  const piel = (op && Mx.pieles[op.piel | 0]) || Mx.pieles[0] || [], tris = [];   // [a, b, c, material]
  // (el modelo de cada cuerpo: el pedido si existe; si no, el primero, como SetBodygroup con un valor que no hay)
  const cuerpo = (k) => { const x = op && op.cuerpos ? op.cuerpos[k] | 0 : 0, c = Mx.cuerpos && Mx.cuerpos[k]; return c && x < c.modelos.length ? x : 0; };
  for (const m of Mx.mallas) {
    if (m.modelo !== cuerpo(m.cuerpo)) continue;
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
// manos: las del jugador (UseHands): { model, skin, body, tinte, k } de gmvManosJugador
function gmvConstruir(ruta, flip, fovVm, clase, manos, aparte) {
  const k = ruta + '|' + (flip ? 1 : 0) + '|' + fovVm + '|' + (manos ? manos.k : '') + (aparte ? '|' + aparte : '');
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
  // las manos del jugador (UseHands): gmvManosArmar, como la entidad gmod_hands de GMod pegada a la vista
  let manosArm = null;
  if (manos) {
    let Mh = null; try { Mh = gmLeerModelo(manos.model); } catch (e) { Mh = null; if (e.pendiente) { gmModeloPedir(manos.model, () => GMV.cache.delete(k)); GMV.cache.delete(k); return null; } gmErr('manos ' + manos.model, e); }
    if (Mh) manosArm = gmvManosArmar(M, Mh, manos, arb, pv, rot, C, flip);
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
  // (las manos: sus huesos procedurales —la muñeca y el cúbito— se calculan en cada cuadro después de la animación, en
  // vistaAplicar; y sus mallas, para esconderlas si un addon lo pide con PreDrawPlayerHands)
  if (manosArm) { v.manos = manosArm; v.proc = manosArm.proc.length ? manosArm.proc : null; v.ejesC = C; if (v.proc) gmvProcAplicar(v); }
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
  // (si cambiaron las manos —otro modelo de jugador, o su addon las registró después—, se rearma con las nuevas)
  if (w.vista && w.vistaManos && w.vistaManos !== gmvManosClave()) w.vista = undefined;
  if (w.vista !== undefined) return w.vista;
  const c = claseTabla(w.clase, 'C') || claseTabla(w.clase, 'S'), ruta = String((c && buscarEnClase(c, 'ViewModel')) || '').toLowerCase().replace(/\\/g, '/');
  w.vista = null;
  if (!ruta) return null;
  if (!gmArchivo(ruta)) { if (gmExiste(ruta)) w.vista = undefined; return null; }   // (se está bajando: se vuelve a probar)
  // (las manos del modelo de jugador que tenés puesto, si el arma las usa: UseHands; si todavía se están bajando, se vuelve
  // a probar en los cuadros siguientes)
  const manos = c && R_T(buscarEnClase(c, 'UseHands')) ? gmvManosListas(gmvManosJugador()) : null;
  if (manos === false) { w.vista = undefined; return null; }
  const v = gmvConstruir(ruta, !!(c && buscarEnClase(c, 'ViewModelFlip')), +(c && buscarEnClase(c, 'ViewModelFOV')) || 62, w.clase, manos);
  // (su geometría o la de las manos se está leyendo del disco: se vuelve a probar en los cuadros siguientes)
  if (!v) { if (typeof gmModeloFaltan === 'function' && (GMPZ.mdl.size || gmModeloFaltan(ruta).length || (manos && gmModeloFaltan(manos.model).length))) w.vista = undefined; return null; }
  w.vista = v; w.vistaManos = manos ? manos.k : '';
  const D = DEF_ARMAS['gm:' + w.clase]; if (D) { D.quieto = v.quieto; D.fuego = v.fuego; D.recarga = v.recarga; D.sacar = v.sacar; }
  return v;
}
// ---- la vista que dibuja el Lua del arma: un ClientsideModel con el modelo de primera persona (FA:S 2.0, CW 2.0) ----
// Esas bases ponen un ViewModel de mentira (FA:S: una granada de HL2) o lo esconden, y en PostDrawViewModel ubican su propio
// modelo (SetRenderOrigin / SetPos), le ponen la secuencia por nombre, lo avanzan con FrameAdvance y lo dibujan. Antes ese
// modelo se dibujaba quieto en el origen del mapa: las armas de FA:S no se veían y las de CW 2.0 no apuntaban (la mira mueve
// ese modelo). Ahora es una vista más (gmvConstruir, aparte de la del arma), con sus huesos, enganches y secuencias para
// el Lua, y mientras se dibuja la vista de siempre del arma no se dibuja.
const GMV_RE_VISTA = /(^|\/)(v|c)_[^/]*\.mdl$|\/view\//i;
function gmvCS(e) {
  if (!e || !e.cs || typeof e.modelo !== 'string') return null;
  if (e.gmvCSRuta === e.modelo && (e.gmvCS || (e.gmvCS === null && !(TIEMPO.t > e.gmvCSprox))) && !(e.gmvCS && e.gmvCS.manos && e.gmvCS.manos.k !== gmvManosClave())) return e.gmvCS;
  let ruta = e.modelo.toLowerCase().replace(/\\/g, '/'); if (!ruta.startsWith('models/')) ruta = 'models/' + ruta;
  e.gmvCSRuta = e.modelo; e.gmvCS = null; e.gmvCSprox = Infinity;
  // (un modelo de primera persona por su nombre, o el mismo ViewModel del arma: CW 2.0 copia el suyo, models/cw2/...)
  const w0 = GMA.swep, vmArma = w0 && typeof w0.vm === 'string' ? w0.vm.toLowerCase().replace(/\\/g, '/').replace(/^(?!models\/)/, 'models/') : '';
  // (si todavía no es el arma en la mano —CW 2.0 lo crea en su Initialize—, se vuelve a mirar en un segundo)
  if (!GMV_RE_VISTA.test(ruta) && ruta !== vmArma) { e.gmvCSprox = TIEMPO.t + 1; return null; }
  // (su modelo puede estar todavía en camino —la biblioteca o el disco—: se vuelve a probar cada segundo)
  if (!gmArchivo(ruta)) { e.gmvCSprox = TIEMPO.t + 1; return null; }
  const w = GMA.swep, c = w && (claseTabla(w.clase, 'C') || claseTabla(w.clase, 'S'));
  const manos = c && R_T(buscarEnClase(c, 'UseHands')) && /(^|\/)c_[^/]*$/.test(ruta) ? gmvManosListas(gmvManosJugador()) : null;
  if (manos === false) { e.gmvCSprox = TIEMPO.t + 0.25; return null; }
  const v = gmvConstruir(ruta, !!(c && buscarEnClase(c, 'ViewModelFlip')), +(c && buscarEnClase(c, 'ViewModelFOV')) || 62, w && w.clase, manos, 'cs');
  // (todavía se lee del disco: se vuelve a probar; un modelo que no es una vista —sin quieto ni sacar— se dibuja como prop)
  if (!v) { e.gmvCSprox = TIEMPO.t + 1; return null; }
  if (!v.quieto && !v.sacar && !v.fuego) return null;
  return (e.gmvCS = v);
}
// DrawModel de ese modelo en la pasada de la vista: ubicado donde lo puso el Lua, con la pose de su secuencia
function gmvDibujarCS(e) {
  const v = gmvCS(e); if (!v) return false;
  const pos = e.rOrigen ? vG(e.rOrigen) : gmaEntPos(e), q = e.rAng ? angQuat(e.rAng) : entQ(e);
  if (!v.clip && v.quieto) vistaTocar(v, v.quieto, { loop: true });
  vistaAplicar(v, 0); if (v.manos) gmvManosCuadro(v, GMA.swep); vistaUbicar(v, pos, q, { x: 0, y: 0, z: 0 }); v.md.encolar();
  const w = GMA.swep; if (w) { w.vmPropioT = TIEMPO.t; w.vmPropio = v; }
  return true;
}
// ¿el arma dibuja su vista desde el Lua? (PreDrawViewModel, ViewModelDrawn o PostDrawViewModel propios, o un hook de
// PostDrawViewModel —CW 2.0—): entonces esos ganchos corren aunque la vista de siempre no exista
function gmvVistaLua(w) {
  const c = claseTabla(w.clase, 'C'); if (!c) return false;
  const b = claseTabla('weapon_base', 'C');
  for (const k of ['PostDrawViewModel', 'ViewModelDrawn', 'PreDrawViewModel']) { const f = buscarEnClase(c, k); if (typeof f === 'function' && f !== (b && buscarEnClase(b, k))) return true; }
  const H = GMA.hooks.get('PostDrawViewModel'); return !!(H && [...H.values()].some((h) => h.C));
}
// lo llama dibujarVista (armas.js) cuando el arma de un addon trae su propio ViewModel
function gmaVistaDibujar() {
  const n = ARM.lista[ARM.i], D = DEF_ARMAS[n]; if (!D || D.tipo !== 'gmswep') return false;
  const w = GMA.armasJug && GMA.armasJug.get(D.gm); if (!w) return false;
  // (sin vista: si es que no tiene —FA:S, con un ViewModel que no existe—, los ganchos del Lua igual corren; si todavía se
  // está leyendo del disco, no: el Lua de la vista —el SWEP Construction Kit de M9K— espera sus huesos)
  const v = gmvDeArma(w); if (!v) return w.vista === null && gmvVistaLua(w);
  if (ARM.v !== v) { ARM.v = v; v.t = 0; v.clip = null; if (v.sacar) vistaTocar(v, v.sacar); else if (v.quieto) vistaTocar(v, v.quieto, { loop: true }); }
  // (el Lua dibuja su propia vista —gmvDibujarCS en el cuadro anterior—: la de siempre no se dibuja, pero sigue para el Lua)
  if (w.vmPropioT && TIEMPO.t - w.vmPropioT < 0.5) return true;
  // (Player:DrawViewModel(false) —las miras telescópicas de M9K, CW, FA:S...— o SWEP:ShouldDrawViewModel() falso: con la
  // mira puesta sólo se ve el dibujo de la mira, no el arma adentro)
  if (w.vmOculta || w.vmApagada) return false;
  { const r = metodo(w, 'ShouldDrawViewModel', 'C'); if (r && r[0] === false) return false; }
  // dónde: la cámara, o lo que diga el arma (GetViewModelPosition: miras, correr) y el modo de juego (CalcViewModelView)
  let pos = CAM.pos, q = CAM.q;
  try {
    const ang = dirAng(dS(CAM.fwd)); ang.__mt = GMA.mtAng; const p0 = GMA.V(CAM.pos);
    // (lo que había antes de llamar: ArcCW corre la vista cambiando el mismo vector que recibe —pos:Add— y lo devuelve; antes
    // eso se tomaba como «no la movió» y la mira de ArcCW no se veía)
    const x0 = [p0.x, p0.y, p0.z, ang.p, ang.y, ang.r];
    let r = metodo(w, 'GetViewModelPosition', 'C', p0, ang);
    let P = r[0] instanceof LVec ? r[0] : p0, A = r[1] instanceof LAng ? r[1] : ang;
    const vm = G_vm(); r = metodo(w, 'CalcViewModelView', 'C', vm, p0, ang, P, A); if (r[0] instanceof LVec) P = r[0]; if (r[1] instanceof LAng) A = r[1];
    const cambio = P !== p0 || A !== ang || P.x !== x0[0] || P.y !== x0[1] || P.z !== x0[2] || A.p !== x0[3] || A.y !== x0[4] || A.r !== x0[5];
    if (cambio) {
      pos = vG(P); q = angQuat(A);
      // (ViewModelFlip: GMod espeja la vista ya ubicada, en el espacio de la cámara; las miras de las de CS:S vienen pensadas
      // así —IronSightsPos.x positivo— y sin espejar el corrimiento quedan del lado de afuera)
      if (v.flip) {
        const der = CAM.q.rot(v3(1, 0, 0)), k = vdot(vsub(pos, CAM.pos), der); pos = vsub(pos, vscale(der, 2 * k));
        const rel = CAM.q.conj().mul(q); rel.y = -rel.y; rel.z = -rel.z; q = CAM.q.clone().mul(rel);
      }
    }
  } catch (e) { /* (el arma sigue en la mano aunque su Lua falle) */ }
  if (v.manos) gmvManosCuadro(v, w);
  vistaUbicar(v, pos, q, ARM.sway); v.md.encolar();
  return true;
}
// las manos en este cuadro: el color de un personaje del juego cuando está, y PreDrawPlayerHands (como GM:PostDrawViewModel
// de GMod: si un hook devuelve true, esas manos no se dibujan; sólo se pregunta si algún addon lo usa)
function gmvManosCuadro(v, w) {
  gmvTintePaso(v);
  const H = GMA.hooks && GMA.hooks.get('PreDrawPlayerHands');
  let ver = !GMVT.ocultar;   // (ocultar: para medir lo que cuestan)
  if (ver && H && H.size && [...H.values()].some((h) => h.C)) { try { const r = gmaHook0('PreDrawPlayerHands', 'C', NULL_ENT, G_vm(), GMA.jug, w); ver = r[0] !== true; } catch (e) { ver = true; } }
  gmvManosVer(v, ver);
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
  const vDe = (e) => (!e ? null : e.cs ? gmvCS(e) : (e.tipo === 'vm' || (e.tipo === 'arma' && e === GMA.swep)) && gmvVista());
  const reemplazar = (M, nombre, f) => { const orig = M.get(nombre) || (M !== EM ? EM.get(nombre) : undefined); M.set(nombre, (e, ...a) => { const v = vDe(e); if (v) { const r = f(v, e, ...a); if (r !== undefined) return r; } return typeof orig === 'function' ? orig(e, ...a) : undefined; }); };
  // (cs: también para la vista que dibuja el Lua; no lo que es del arma —esconderla— ni dibujar)
  const soloVm = (nombre, f, cs = true) => reemplazar(EM, nombre, (v, e, ...a) => (e.tipo === 'vm' || (cs && e.cs) ? f(v, e, ...a) : undefined));
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
  soloVm('SelectWeightedSequenceSeeded', (v, e, act) => { for (const [k, L] of v.actos) if (gmvActNum(k) === act) return v.sec.indexOf(L[0]); return -1; });   // (la TFA Base)
  // (la secuencia por número o por nombre, como en GMod: FA:S 2.0 y otras bases ponen las animaciones por nombre)
  const tocar = (v, i) => { if (typeof i === 'string') { const s = i.toLowerCase(); i = v.M.secuencias.findIndex((q) => q.n.toLowerCase() === s); if (i < 0) return; } const n = v.sec[i | 0]; if (n) vistaTocar(v, n, { loop: DATA.anPorNombre[n].loop }); };
  soloVm('SendViewModelMatchingSequence', (v, e, i) => { tocar(v, i); return true; }); soloVm('ResetSequence', (v, e, i) => { tocar(v, i); return true; }); soloVm('SetSequence', (v, e, i) => { tocar(v, i); return true; });
  soloVm('SetPlaybackRate', (v, e, r) => { v.vel = Math.max(0.01, +r || 1); return true; }); soloVm('GetPlaybackRate', (v) => v.vel || 1);
  soloVm('GetCycle', (v) => (v.clip && v.clip.d ? Math.min(1, v.t / v.clip.d) : 0)); soloVm('SetCycle', (v, e, c) => { if (v.clip) v.t = Math.max(0, Math.min(1, +c || 0)) * v.clip.d; return true; });
  soloVm('SetNoDraw', (v, e, b) => { const w = GMA.swep; if (w) w.vmOculta = !!b; return true; }, false); soloVm('GetNoDraw', () => !!(GMA.swep && GMA.swep.vmOculta), false);
  // (avanzar la animación: la vista del Lua la avanza el Lua, como en GMod)
  soloVm('FrameAdvance', (v, e, dt) => { if (e.cs) vistaAplicar(v, +dt > 0 ? +dt : TIEMPO.dt || 1 / 60); return true; });
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
  soloVm('SetupBones', () => true); soloVm('InvalidateBoneCache', () => true); soloVm('IsValid', () => true, false); soloVm('DrawModel', () => true, false);
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

// ---------------- las manos de las armas c_ (UseHands): las del modelo de jugador que tenés puesto ----------------
// Las armas «c_» no traen brazos: GMod les pega la entidad gmod_hands (bonemerge a la vista) con las manos que da el modelo
// de jugador (GM:PlayerSetHandsModel → player_manager.TranslatePlayerHands(TranslateToPlayerModelName(modelo)) →
// { model, skin, body }): las que registró su addon con player_manager.AddValidHands. Un modelo que nadie registró es
// «kleiner» (c_arms_citizen, piel 0) y uno registrado sin manos lleva las de por defecto (c_arms_citizen, cuerpo
// «100000000»). Los de HL2, CS:S, DoD y Portal 2 que trae GMod, con su tabla (GMV_PM_BASE, de player_manager.lua). Los
// personajes del juego (Hero, Goku, Freddy...) y los importados no son de GMod: c_arms_citizen con las mangas del color de
// la ropa de su antebrazo y las manos del de su mano (gmvTinte).
const GMV_CARMS = { c: 'citizen', r: 'refugee', b: 'combine', s: 'cstrike', h: 'chell', d: 'dod' };
const GMV_PM_BASE = new Map();   // nombre → [modelo, manos | null]
('alyx alyx c 0 0,breen breen c 0 0,eli eli c 1 0,gman gman_high c 0 0,kleiner kleiner c 0 0,monk monk c 0 0,odessa odessa c 0 0,barney barney b 0 0,' +
 'magnusson magnusson c 0 0,mossman mossman c 0 0,mossmanarctic mossman_arctic c 0 1,combine combine_soldier b 0 0,combineprison combine_soldier_prisonguard b 0 0,' +
 'combineelite combine_super_soldier b 0 0,police police b 0 0,policefem police_fem b 0 0,stripped soldier_stripped c 0 0,charple charple c 2 0,corpse corpse1 c 2 0,' +
 'skeleton skeleton c 2 0,zombie zombie_classic c 2 0,zombiefast zombie_fast c 2 0,zombine zombie_soldier b 0 0,female01 group01/female_01 c 0 0,female02 group01/female_02 c 0 0,' +
 'female03 group01/female_03 c 1 0,female04 group01/female_04 c 0 0,female05 group01/female_05 c 1 0,female06 group01/female_06 c 0 0,female07 group03/female_01 r 0 1,' +
 'female08 group03/female_02 r 0 1,female09 group03/female_03 r 1 1,female10 group03/female_04 r 0 1,female11 group03/female_05 r 1 1,female12 group03/female_06 r 0 1,' +
 'male01 group01/male_01 c 1 0,male02 group01/male_02 c 0 0,male03 group01/male_03 c 1 0,male04 group01/male_04 c 0 0,male05 group01/male_05 c 0 0,male06 group01/male_06 c 0 0,' +
 'male07 group01/male_07 c 0 0,male08 group01/male_08 c 0 0,male09 group01/male_09 c 0 0,male10 group03/male_01 r 1 1,male11 group03/male_02 r 0 0,male12 group03/male_03 r 1 0,' +
 'male13 group03/male_04 r 0 1,male14 group03/male_05 r 0 1,male15 group03/male_06 r 0 1,male16 group03/male_07 r 0 1,male17 group03/male_08 r 0 0,male18 group03/male_09 r 0 1,' +
 'medic01 group03m/male_01 r 1 1,medic02 group03m/male_02 r 0 0,medic03 group03m/male_03 r 1 1,medic04 group03m/male_04 r 0 0,medic05 group03m/male_05 r 0 1,' +
 'medic06 group03m/male_06 r 0 0,medic07 group03m/male_07 r 0 0,medic08 group03m/male_08 r 0 0,medic09 group03m/male_09 r 0 0,medic10 group03m/female_01 r 0 1,' +
 'medic11 group03m/female_02 r 0 0,medic12 group03m/female_03 r 1 0,medic13 group03m/female_04 r 0 1,medic14 group03m/female_05 r 0 1,medic15 group03m/female_06 r 1 1,' +
 'refugee01 group02/male_02 c 0 0,refugee02 group02/male_04 c 0 0,refugee03 group02/male_06 c 0 0,refugee04 group02/male_08 c 0 0,hostage01 hostage/hostage_01,' +
 'hostage02 hostage/hostage_02,hostage03 hostage/hostage_03,hostage04 hostage/hostage_04,css_arctic arctic s 0 0,css_gasmask gasmask s 0 0,css_guerilla guerilla s 0 0,' +
 'css_leet leet s 0 0,css_phoenix phoenix s 0 0,css_riot riot s 0 0,css_swat swat s 0 0,css_urban urban s 0 0,chell p2_chell h 0 0,dod_german dod_german d 0 0,dod_american dod_american d 1 0')
  .split(',').forEach((x) => { const [n, m, h, s, b] = x.split(' '); GMV_PM_BASE.set(n, ['models/player/' + m + '.mdl', h ? { model: 'models/weapons/c_arms_' + GMV_CARMS[h] + '.mdl', skin: +s, body: b === '1' ? '0100000' : '0000000' } : null]); });
const GMV_MANOS_DEF = { model: 'models/weapons/c_arms_citizen.mdl', skin: 0, body: '100000000' };
const gmvRutaMdl = (m) => { const r = String(m || '').toLowerCase().replace(/\\/g, '/').replace(/^\/+/, ''); return r && !r.startsWith('models/') ? 'models/' + r : r; };
// TranslateToPlayerModelName: el nombre con que lo registró su addon (AddValidModel), el de GMod, o «kleiner»
function gmvPmNombre(m) {
  const r = gmvRutaMdl(m);
  if (typeof GMA !== 'undefined' && GMA.pmNombres && GMA.pmNombres.has(r)) return GMA.pmNombres.get(r);
  for (const [n, x] of GMV_PM_BASE) if (x[0] === r) return n;
  return 'kleiner';
}
// TranslatePlayerHands: { model, skin, body, matchBodySkin }
function gmvManosDeNombre(n) {
  const a = typeof GMA !== 'undefined' && GMA.pmanos && GMA.pmanos.get(String(n)); if (a) return a;
  const b = GMV_PM_BASE.get(String(n)); return (b && b[1]) || GMV_MANOS_DEF;
}
// las manos de un modelo de jugador: las de GMod (TranslatePlayerHands del nombre con que quedó registrado) y, si con ese
// nombre no hay manos pero el addon sí registró unas para ese modelo con otro nombre, ésas: el Kermit se registra dos veces
// («Kermit», con manos, y después «kermit» para el NPC) y el Picolas Cage registra las manos con el nombre del archivo
// («picolas_cage_reference») y el modelo como «Picolas_Cage». En GMod los dos quedan con las de ciudadano; acá, con las
// que trajo su addon
function gmvManosDeModelo(m) {
  const r = gmvRutaMdl(m), n = gmvPmNombre(r), H = typeof GMA !== 'undefined' && GMA.pmanos;
  if (H && H.has(n)) return H.get(n);
  if (H && H.size) {
    const bajo = (x) => String(x).toLowerCase(), alias = [n];
    if (GMA.pmodels) for (const [k, x] of GMA.pmodels) if (gmvRutaMdl(x) === r) alias.push(k);
    alias.push(r.replace(/^.*\//, '').replace(/\.mdl$/, ''));
    for (const a of alias) for (const [k, h] of H) if (bajo(k) === bajo(a)) return h;
  }
  return gmvManosDeNombre(n);
}
// ¿un modelo de jugador trae sus propias manos? (las registró su addon y no son las de ciudadano: la tarjeta lo dice)
function gmvPmTieneManos(m) {
  const a = gmvManosDeModelo(m);
  return !!(a && a !== GMV_MANOS_DEF && gmvRutaMdl(a.model) !== GMV_MANOS_DEF.model && gmExiste(gmvRutaMdl(a.model)));
}
// el modelo del jugador como lo ve el Lua (Player:GetModel): el del addon que tiene puesto; los del juego, Kleiner
function gmvModeloJugador() {
  const P = typeof JUG !== 'undefined' ? JUG.cuerpo : null, r = P && P.gmpRuta ? String(P.gmpRuta) : '';
  return r && !/^jxpj\//.test(r) ? r : 'models/player/kleiner.mdl';
}
// las manos del jugador de ahora: { model, skin, body, tinte (el personaje del juego o importado del que sale el color), k }
// (se recalcula si cambia el cuerpo o un addon registra modelos o manos: GMA.pmV)
function gmvManosJugador() {
  const P = typeof JUG !== 'undefined' ? JUG.cuerpo : null, pv = (typeof GMA !== 'undefined' && GMA.pmV) || 0;
  if (P && P._manos && P._manosV === pv) return P._manos;
  const r = P && P.gmpRuta ? String(P.gmpRuta).toLowerCase() : '';
  let s;
  if (r && !/^jxpj\//.test(r)) {
    const h = gmvManosDeModelo(r), model = gmvRutaMdl(h.model) || GMV_MANOS_DEF.model, skin = Math.max(0, +h.skin || 0), body = String(h.body === undefined || h.body === null ? '' : h.body);
    s = { model, skin, body, k: model + '|' + skin + '|' + body };
  } else {
    const t = r || (P && P.skin) || (typeof PREFS !== 'undefined' && PREFS.skin) || 'Hero';
    s = { model: GMV_MANOS_DEF.model, skin: 0, body: '0000000', tinte: t, k: GMV_MANOS_DEF.model + '|0|0000000|' + t };
  }
  if (P) { P._manos = s; P._manosV = pv; }
  return s;
}
const gmvManosClave = () => gmvManosJugador().k;
// ¿están los archivos de esas manos? (se piden a la biblioteca de GMod o al disco si faltan): la misma especificación, o
// false mientras llegan. Si el modelo no existe en ningún lado —un addon que registra manos que no trae— o no llega en
// 10 s, las de por defecto, como el modelo de error de GMod pero con manos
function gmvManosListas(s) {
  const tiene = (m) => { const b = m.slice(0, -4); return !!(gmArchivo(m) && gmArchivo(b + '.vvd') && (gmArchivo(b + '.dx90.vtx') || gmArchivo(b + '.vtx') || gmArchivo(b + '.dx80.vtx') || gmArchivo(b + '.sw.vtx'))); };
  if (tiene(s.model)) { GMVT.espera.delete(s.model); return s; }
  const t0 = GMVT.espera.get(s.model) ?? (GMVT.espera.set(s.model, TIEMPO.t), TIEMPO.t);
  if (s.model !== GMV_MANOS_DEF.model && (!gmExiste(s.model) || TIEMPO.t - t0 > 10)) { const d = Object.assign({}, s, { model: GMV_MANOS_DEF.model, skin: 0, body: '0000000', k: s.k }); return tiene(d.model) ? d : false; }
  return false;
}
// ¿la vista ya trae sus brazos? (las «v_»: cientos de vértices en dedos, antebrazos o brazos). Entonces no se le pegan las
// manos, aunque diga UseHands (GMod las dibujaría encima, dos brazos en el mismo lugar: la Freeze Gun, el MUDA MUDA)
function gmvTraeBrazos(M) {
  const V = M.v; if (!V || !V.n) return false;
  const ih = new Uint8Array(M.huesos.length); M.huesos.forEach((h, i) => { if (/finger|forearm|upperarm|clavicle/i.test(h.n)) ih[i] = 1; });
  let n = 0; for (let k = 0; k < V.n; k++) if (ih[V.hb[k * 3]] && V.w[k * 3] > 0.5 && ++n >= 100) return true;
  return false;
}
// las manos pegadas a la vista (el bonemerge de Source): cada hueso de las manos con el mismo nombre que uno de la vista va
// donde va ése; los que la vista no tiene cuelgan de su padre con su pose de reposo, y los procedurales (la muñeca y el cúbito
// de las c_arms, «quaternion» de $proceduralbones, que giran con la mano para que el antebrazo no se retuerza) se calculan
// en cada cuadro como Source (gmvProcAplicar). Antes los que faltaban —ninguna c_ de GMod trae Ulna ni Wrist— se pegaban
// al antebrazo con su propia pose de enlace: la piel de la muñeca y del antebrazo quedaba corrida 15 y 29 cm hacia el codo.
// Un brazo cuya mano la vista no tiene (la Physics Gun: sólo la izquierda) no se dibuja
function gmvManosArmar(M, Mh, manos, arb, pv, rot, C, flip) {
  if (gmvTraeBrazos(M)) return null;
  const porNombre = new Map(M.huesos.map((h, i) => [h.n.toLowerCase(), 1 + i]));
  if (!porNombre.has('valvebiped.bip01_r_hand') && !porNombre.has('valvebiped.bip01_l_hand')) return null;
  const oculto = { R: !porNombre.has('valvebiped.bip01_r_hand'), L: !porNombre.has('valvebiped.bip01_l_hand') };
  let nOc = -1; const nodoOculto = () => (nOc >= 0 ? nOc : (nOc = arb.push({ n: 'GMV_manoOculta', p: [0, 0, 0], r: [0, 0, 0, 1], s: [1e-4, 1e-4, 1e-4], pa: 0 }) - 1));
  const nodoH = [], proc = [], H = Mh.huesos;
  H.forEach((h, j) => {
    const lado = /_([lr])_/i.exec(h.n), x = porNombre.get(h.n.toLowerCase());
    if (lado && oculto[lado[1].toUpperCase()]) { nodoH.push(nodoOculto()); return; }
    if (x !== undefined) { nodoH.push(x); return; }
    const pa = h.pa >= 0 ? nodoH[h.pa] : 0;
    nodoH.push(arb.length); arb.push({ n: 'GMV_mano:' + h.n, p: pv(h.pos), r: rot(h.q), s: [1, 1, 1], pa });
    if (h.proc && h.pa >= 0 && H[h.proc.ctrl] && H[h.proc.ctrl].pa >= 0) proc.push({ i: nodoH[j], ctrl: h.proc.ctrl, tr: h.proc.tr });
  });
  for (const x of proc) { x.ctrlPa = nodoH[H[x.ctrl].pa]; x.ctrl = nodoH[x.ctrl]; }
  const ini = arb.length;
  const op = { piel: manos.skin | 0, cuerpos: [...String(manos.body || '')].map((ch) => parseInt(ch, 36) || 0) };
  gmvMallas(Mh, (h) => nodoH[h], 'manos:' + manos.model, arb, pv, C, flip, op);
  const nodos = []; for (let i = ini; i < arb.length; i++) if (arb[i].m !== undefined) nodos.push(i);
  // (los personajes del juego: los materiales propios, teñidos con sus colores; los de las mangas y los de las manos)
  if (manos.tinte) for (const i of nodos) arb[i].mt = arb[i].mt.map((mi) => gmvMatTenido(mi, manos.tinte));
  return { k: manos.k, model: manos.model, proc: proc.filter((x) => x.ctrl !== undefined && x.ctrlPa !== undefined), nodos, nodoH, oculto, tinte: manos.tinte || null };
}
// los huesos procedurales de las manos (DoQuatInterpBone de Source): el giro de la mano respecto de su antebrazo elige, entre
// los disparadores del hueso, cuánto pesa cada uno (1 − 2·ángulo·tolerancia⁻¹) y el hueso toma la mezcla de sus giros y
// posiciones, respecto de su padre. Va en los ejes de Source (las c_arms los traen así) y se pasa a los de la vista
const _gpQa = [0, 0, 0, 1], _gpQb = [0, 0, 0, 1];
function _gpCadena(md, i, out) {   // (el giro de un nodo desde la raíz de la vista, sin la raíz: lo que la escala de la raíz no toca)
  out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1;
  for (let n = 0; i > 0 && n < 128; i = md.A[i].pa, n++) { const r = md.r[i], x = r[0] * out[3] + r[3] * out[0] + r[1] * out[2] - r[2] * out[1], y = r[1] * out[3] + r[3] * out[1] + r[2] * out[0] - r[0] * out[2], z = r[2] * out[3] + r[3] * out[2] + r[0] * out[1] - r[1] * out[0], w = r[3] * out[3] - r[0] * out[0] - r[1] * out[1] - r[2] * out[2]; out[0] = x; out[1] = y; out[2] = z; out[3] = w; }
  return out;
}
// (los ejes: Source (x, y, z) → vista (fx·y, z, x) en las posiciones; en los giros, la parte vectorial va igual y, si está
// espejada (fx = −1, que invierte la mano), cambia de signo: así no se arman matrices en cada cuadro)
const _gpQs = [0, 0, 0, 0], _gpAcc = [0, 0, 0, 0], _gpPos = [0, 0, 0];
function gmvProcAplicar(v) {
  const md = v.md, fx = v.fx, sc = GM_S / 0.3, s = _gpQs, q = _gpAcc, p = _gpPos;
  for (const x of v.proc) {
    // giro de la mano respecto de su antebrazo (en el mundo de la vista) → ejes de Source
    const a = _gpCadena(md, x.ctrlPa, _gpQa), b = _gpCadena(md, x.ctrl, _gpQb);
    const gx = -a[0] * b[3] + a[3] * b[0] - a[1] * b[2] + a[2] * b[1], gy = -a[1] * b[3] + a[3] * b[1] - a[2] * b[0] + a[0] * b[2], gz = -a[2] * b[3] + a[3] * b[2] - a[0] * b[1] + a[1] * b[0], gw = a[3] * b[3] + a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    s[0] = fx * gz; s[1] = gx; s[2] = fx * gy; s[3] = gw;
    let tot = 0; const w = x.w || (x.w = new Float32Array(x.tr.length));
    for (let t = 0; t < x.tr.length; t++) { const u = x.tr[t].tq, d = Math.min(1, Math.abs(u[0] * s[0] + u[1] * s[1] + u[2] * s[2] + u[3] * s[3])); w[t] = Math.max(0, 1 - 2 * Math.acos(d) * x.tr[t].inv); tot += w[t]; }
    q[0] = q[1] = q[2] = q[3] = 0; p[0] = p[1] = p[2] = 0;
    if (tot <= 0.001) { const T = x.tr[0]; for (let c = 0; c < 4; c++) q[c] = T.q[c]; for (let c = 0; c < 3; c++) p[c] = T.pos[c]; }
    else for (let t = 0; t < x.tr.length; t++) {
      if (!w[t]) continue; const k = w[t] / tot, T = x.tr[t], tq = T.q;
      // (QuaternionAlign: lo acumulado del mismo lado que este disparador)
      let da = 0, db = 0; for (let c = 0; c < 4; c++) { da += (tq[c] - q[c]) ** 2; db += (tq[c] + q[c]) ** 2; } if (da > db) for (let c = 0; c < 4; c++) q[c] = -q[c];
      for (let c = 0; c < 4; c++) q[c] += k * tq[c]; for (let c = 0; c < 3; c++) p[c] += k * T.pos[c];
    }
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1, P = md.p[x.i], Rr = md.r[x.i];
    P[0] = sc * fx * p[1]; P[1] = sc * p[2]; P[2] = sc * p[0];
    Rr[0] = q[1] / l; Rr[1] = fx * q[2] / l; Rr[2] = fx * q[0] / l; Rr[3] = q[3] / l;
  }
  md.sucio = true;
}
// PreDrawPlayerHands (un addon que esconde las manos con cierta arma) y lo que pide la vista: se muestran o no
function gmvManosVer(v, si) {
  const md = v.md; if (!v.manos || v.manosVer === si) return; v.manosVer = si;
  for (const i of v.manos.nodos) md.act[i] = si ? 1 : 0;
  for (const i of v.manos.nodos) { const x = md.A[i]; md.ver[i] = md.act[i] && md.act[x.pa] && x.m !== undefined && x.m >= 0 && x.mt && !x.mroff && !md.ocultoLod[i] ? 1 : 0; }
  md.sucio = true;
}

// ---- el color de las manos de los personajes del juego y de los importados ----
// De la malla del personaje: los vértices que dependen sobre todo de un antebrazo (la ropa: las mangas) y de una mano o sus
// dedos (la piel, o el guante), con el color de su textura en sus coordenadas UV (la misma que se ve, ya teñida por
// identidad.js) por el del material. Cada pieza de las c_arms se tiñe para que su color medio sea ése (color del material ×
// lo que falta: objetivo ÷ promedio de su textura). Se calcula una vez por personaje, sin trabar el cuadro (las texturas se
// leen cuando ya están decodificadas)
const GMVT = { col: new Map(), mats: new Map(), base: new Map(), espera: new Map(), tex: new Map() };
const GMVT_MANGA = /forearm|lowerarm|ulna|elbow/i, GMVT_MANO = /hand|finger|thumb|index|middle|ring|pinky|palm|wrist/i;
function _gmvH2F(h) { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * f * 5.960464477539063e-8 : e === 31 ? 0 : s * (1 + f / 1024) * Math.pow(2, e - 15); }
// los píxeles de una textura (fila 0 = v 0, como las UV del juego), chicos; null si todavía no está
function gmvTexPx(ti) {
  if (GMVT.tex.has(ti)) return GMVT.tex.get(ti);
  const pt = typeof PK !== 'undefined' && PK.parte('t' + ti), d = DATA.tx[ti];
  if (pt) {   // (del paquete del juego: el webp, decodificado aparte y teñido como el que se sube a la placa)
    GMVT.tex.set(ti, null);
    decodificar(new Blob([pt], { type: 'image/webp' })).then(([img, volteada]) => {
      const L = 64, c = document.createElement('canvas'); c.width = L; c.height = L; const x = c.getContext('2d', { willReadFrequently: true });
      if (!volteada) { x.translate(0, L); x.scale(1, -1); }
      x.drawImage(img, 0, 0, L, L); img.close && img.close();
      let src = c; try { src = (typeof idTex === 'function' && idTex(ti, c, null)) || c; } catch (e) { src = c; }
      GMVT.tex.set(ti, { w: L, h: L, px: src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, L, L).data });
    }).catch(() => GMVT.tex.set(ti, { w: 1, h: 1, px: new Uint8Array([255, 255, 255, 255]) }));
    return null;
  }
  // (de un addon o importado: ya está en la placa; se lee de ahí)
  const t = R.tex && R.tex[ti], gl = R.gl;
  if (!d || !t || !t.gl || t.gl === R.texGris || t.gl === R.texBlanca || !gl) { if (d && d.k && typeof texGL === 'function') texGL(ti); return null; }
  const w = d.w | 0, h = d.h | 0; if (w < 1 || h < 1 || w * h > 4096 * 4096) return null;
  let out = null; const fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING), fb = gl.createFramebuffer();
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.gl, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) { const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); out = { w, h, px }; }
  } catch (e) { out = null; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb0); gl.deleteFramebuffer(fb);
  out = out || { w: 1, h: 1, px: new Uint8Array([255, 255, 255, 255]) };
  GMVT.tex.set(ti, out); return out;
}
const _gmvMuestra = (T, u, v) => { const x = Math.min(T.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * T.w))), y = Math.min(T.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * T.h))), i = (y * T.w + x) * 4; return [T.px[i], T.px[i + 1], T.px[i + 2], T.px[i + 3]]; };
// el color medio por zona (mangas, manos) de las mallas con piel de un árbol (nodos con m, mt y bo: los huesos por nombre).
// null si falta alguna textura (se vuelve a probar); {} si no hay nada que medir
function gmvColores(A, nombre) {
  const mu = { mangas: [], manos: [] }, nom = nombre || ((b) => (A[b] && A[b].n) || '');
  for (const x of A) {
    if (x.m === undefined || x.m < 0 || !x.bo || !x.mt) continue;
    const d = DATA.ms[x.m], B = d && binDe(d); if (!d || d.sk === undefined || !B) continue;
    const dv = new DataView(B.buffer, B.byteOffset), zona = x.bo.map((b) => { const n = nom(b); return GMVT_MANGA.test(n) ? 'mangas' : GMVT_MANO.test(n) ? 'manos' : null; });
    if (!zona.some(Boolean)) continue;
    // (cada vértice pesa el área de sus triángulos: las articulaciones de Freddy tienen muchos vértices chicos de metal y
    // contados de a uno le ganaban a la piel marrón, que es lo que se ve)
    const pos = (vi, o) => { const b = d.o + vi * 14; for (let c = 0; c < 3; c++) o[c] = d.mn[c] + dv.getUint16(b + c * 2, true) / 65535 * d.sc[c]; return o; }, P0 = [0, 0, 0], P1 = [0, 0, 0], P2 = [0, 0, 0];
    for (let k = 0; k < x.mt.length && k < d.sub.length; k++) {
      const mi = x.mt[k], M = DATA.mt[mi]; if (!M) continue; const ti = matGL(mi).tex;
      const T = ti !== undefined && ti >= 0 ? gmvTexPx(ti) : { w: 1, h: 1, px: [255, 255, 255, 255] }; if (!T) return null;
      const c = M.c || [1, 1, 1, 1], [s0, n] = d.sub[k], idx = (q) => (d.i32 ? dv.getUint32(d.i + (s0 + q) * 4, true) : dv.getUint16(d.i + (s0 + q) * 2, true));
      for (let q = 0; q + 2 < n; q += 3) {
        const V = [idx(q), idx(q + 1), idx(q + 2)]; if (V.some((vi) => vi >= d.v)) continue;
        pos(V[0], P0); pos(V[1], P1); pos(V[2], P2);
        const ax = P1[0] - P0[0], ay = P1[1] - P0[1], az = P1[2] - P0[2], bx = P2[0] - P0[0], by = P2[1] - P0[1], bz = P2[2] - P0[2];
        const area = 0.5 * Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) / 3; if (!(area > 0)) continue;
        for (const vi of V) {
          let bm = 0, wm = -1; for (let j = 0; j < 4; j++) { const wj = dv.getUint8(d.sk + vi * 8 + 4 + j); if (wj > wm) { wm = wj; bm = dv.getUint8(d.sk + vi * 8 + j); } }
          const z = zona[bm]; if (!z) continue;
          const o = d.o + vi * 14, px = _gmvMuestra(T, _gmvH2F(dv.getUint16(o + 10, true)), _gmvH2F(dv.getUint16(o + 12, true))); if (px[3] < 100) continue;
          mu[z].push(px[0] * c[0], px[1] * c[1], px[2] * c[2], area);
        }
      }
    }
  }
  // (el color que más hay, no el promedio: el antebrazo de Goku es piel con una muñequera azul y el promedio daba un gris
  // azulado que no es ninguno de los dos. Se suma el área por cubos de 32 niveles, se toma el más lleno y se promedian las
  // muestras que están a menos de 48 niveles de ése)
  const out = {};
  for (const z of ['mangas', 'manos']) {
    const L = mu[z]; if (L.length < 32) continue; let tot = 0; for (let i = 3; i < L.length; i += 4) tot += L[i];
    const cub = new Map(); let mejor = null;
    for (let i = 0; i < L.length; i += 4) { const q = (x) => Math.min(7, Math.max(0, x >> 5)), k = (q(L[i]) << 6) | (q(L[i + 1]) << 3) | q(L[i + 2]), w = L[i + 3], c = cub.get(k) || [0, 0, 0, 0]; c[0] += L[i] * w; c[1] += L[i + 1] * w; c[2] += L[i + 2] * w; c[3] += w; cub.set(k, c); if (!mejor || c[3] > mejor[3]) mejor = c; }
    const m = [mejor[0] / mejor[3], mejor[1] / mejor[3], mejor[2] / mejor[3]], S = [0, 0, 0, 0];
    for (let i = 0; i < L.length; i += 4) if (Math.hypot(L[i] - m[0], L[i + 1] - m[1], L[i + 2] - m[2]) < 48) { const w = L[i + 3]; S[0] += L[i] * w; S[1] += L[i + 1] * w; S[2] += L[i + 2] * w; S[3] += w; }
    out[z] = [S[0] / S[3] / 255, S[1] / S[3] / 255, S[2] / S[3] / 255]; out[z + 'Parte'] = +(S[3] / tot).toFixed(2);
  }
  return out;
}
// el color de un personaje del juego o importado (por su nombre de skin o su ruta jxpj/): { mangas, manos } o null mientras
// se calcula
function gmvTinte(clave) {
  const x = GMVT.col.get(clave); if (x) return x;
  let A = null;
  let nom = null;   // (los importados: el nombre del hueso que les dio el rig —LeftHand, RightForeArm...—, no el del archivo)
  if (/^jxpj\//.test(clave)) { const def = typeof pjiDefDe === 'function' ? pjiDefDe(clave) : null; A = def && def.arb; if (def && def.mix) nom = (b) => def.mix[b] || (A[b] && A[b].n) || ''; }
  else if (typeof datosSkin === 'function' && typeof rbListo === 'function' && rbListo(rbDeSkin(clave))) A = datosSkin(clave).sub;
  if (!A) return null;
  const c = gmvColores(A, nom); if (!c) return null;
  // (sin antebrazo con malla propia —un personaje de manga corta o sin brazos—: la mano para las dos; sin nada, sin teñir)
  if (!c.mangas && c.manos) c.mangas = c.manos; if (!c.manos && c.mangas) c.manos = c.mangas;
  GMVT.col.set(clave, c); return c;
}
// un material propio de las manos de un personaje (copia del de las c_arms, que se tiñe cuando está su color)
function gmvMatTenido(mi0, clave) {
  const m0 = DATA.mt[mi0]; if (!m0) return mi0;
  const rol = /hand|glove|finger|skin/i.test(String(m0.n || '')) ? 'manos' : 'mangas';   // (c_arms_citizen: _sleeves, _hands, _glove)
  const c = (m0.c || [1, 1, 1, 1]).slice(), m = Object.assign({}, m0, { n: m0.n + '#' + rol, c, cc: Object.assign({}, m0.cc || {}, { _Color: c }) });
  const mi = DATA.mt.length; DATA.mt.push(m);
  const L = GMVT.mats.get(clave) || []; L.push({ mi, mi0, rol, ok: false }); GMVT.mats.set(clave, L);
  gmvTinteAplicar(clave);
  return mi;
}
// cuando está el color del personaje y el promedio de la textura de cada pieza: se tiñen (y si no están, se vuelve a probar
// en los cuadros siguientes: gmvTintePaso). La copia sigue a su original: si la textura de las c_arms llegó después de la
// biblioteca (gmlLlegaron rehace el material en el mismo lugar), la copia la toma y se vuelve a medir y a teñir; antes de
// eso no se mide (la textura de relleno, blanca o el damero, daba un promedio falso)
const GMVT_RELLENO = /^GMA_(faltante|blanca)$/;
function gmvTinteAplicar(clave) {
  const L = GMVT.mats.get(clave); if (!L) return true;
  for (const x of L) {   // (la textura del original, si cambió)
    const m0 = DATA.mt[x.mi0], m = DATA.mt[x.mi]; if (!m0 || !m) continue;
    if (m.t !== m0.t || m.tt !== m0.tt || m.sh !== m0.sh) { m.t = m0.t; m.tt = m0.tt; m.sh = m0.sh; m.f = m0.f; GMVT.base.delete(x.mi0); x.ok = false; if (R.mats) R.mats[x.mi] = undefined; }
  }
  if (L.every((x) => x.ok)) return true;
  const col = gmvTinte(clave); if (!col) return false;
  for (const x of L) {
    if (x.ok) continue;
    let b = GMVT.base.get(x.mi0);
    if (!b) {
      const ti = matGL(x.mi0).tex, d = ti !== undefined && ti >= 0 ? DATA.tx[ti] : null;
      if (d && GMVT_RELLENO.test(d.n || '') && (x.t0 ?? (x.t0 = TIEMPO.t)) > TIEMPO.t - 15) continue;   // (todavía no llegó la de verdad)
      const T = d ? gmvTexPx(ti) : { w: 1, h: 1, px: [255, 255, 255, 255] }; if (!T) continue;
      let s = [0, 0, 0], n = 0; for (let i = 0; i < T.w * T.h; i++) if (T.px[i * 4 + 3] > 100) { s[0] += T.px[i * 4]; s[1] += T.px[i * 4 + 1]; s[2] += T.px[i * 4 + 2]; n++; }
      const c0 = DATA.mt[x.mi0].c || [1, 1, 1, 1]; b = n ? [s[0] / n / 255 * c0[0], s[1] / n / 255 * c0[1], s[2] / n / 255 * c0[2]] : [1, 1, 1]; GMVT.base.set(x.mi0, b);
    }
    const obj = col[x.rol], m = DATA.mt[x.mi], c0 = DATA.mt[x.mi0].c || [1, 1, 1, 1]; x.ok = true; if (!obj || !m) continue;
    for (let k = 0; k < 3; k++) m.c[k] = Math.max(0, Math.min(4, c0[k] * obj[k] / Math.max(0.03, b[k])));
    m.cc._Color = m.c; if (R.mats) R.mats[x.mi] = undefined;
  }
  return L.every((x) => x.ok);
}
// (cada tanto, desde la vista: las que esperan su color o su textura)
function gmvTintePaso(v) { if (v && v.manos && v.manos.tinte && !(v.tinteT > TIEMPO.t)) { v.tinteT = TIEMPO.t + 0.25; gmvTinteAplicar(v.manos.tinte); } }

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
