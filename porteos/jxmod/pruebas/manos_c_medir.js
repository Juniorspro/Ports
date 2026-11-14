// (se carga en la página) mide las manos pegadas a la vista del arma de ahora contra una referencia hecha con la matemática de
// Source (bonemerge de gmod_hands + DoQuatInterpBone + piel), cuadro a cuadro de cada animación. Todo en unidades de Source
// del espacio de la vista; para pasar a cm, × 2,54.
window.__carms = (() => {
  const I = () => ({ R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] });
  const mul = (A, B) => ({ R: _m3mul(A.R, B.R), t: [A.R[0][0] * B.t[0] + A.R[0][1] * B.t[1] + A.R[0][2] * B.t[2] + A.t[0], A.R[1][0] * B.t[0] + A.R[1][1] * B.t[1] + A.R[1][2] * B.t[2] + A.t[1], A.R[2][0] * B.t[0] + A.R[2][1] * B.t[1] + A.R[2][2] * B.t[2] + A.t[2]] });
  const inv = (A) => { const R = _m3T(A.R); return { R, t: [0, 1, 2].map((r) => -(R[r][0] * A.t[0] + R[r][1] * A.t[1] + R[r][2] * A.t[2])) }; };
  const ap = (A, p) => { const R = A.R; return [R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2] + A.t[0], R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2] + A.t[1], R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2] + A.t[2]]; };
  const QM = (q, p) => ({ R: _q2m(q), t: p.slice() });
  const ang = (A, B) => { const R = _m3mul(_m3T(A.R), B.R), tr = (R[0][0] + R[1][1] + R[2][2] - 1) / 2; return Math.acos(Math.max(-1, Math.min(1, tr))) * 180 / Math.PI; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // nodo del juego → local en Source (inverso de pv y rot de gmvConstruir)
  function localSrc(v, i) {
    const C = v.ejesC, sc = GM_S / 0.3, p = v.md.p[i], q = v.md.r[i];
    return { R: _m3mul(_m3mul(_m3T(C), _q2m(q)), C), t: [p[2] / sc, p[0] / (sc * v.fx), p[1] / sc] };
  }
  function mundoNodos(v) {
    const W = new Map(); W.set(0, I());
    const f = (i) => { if (W.has(i)) return W.get(i); const x = mul(f(v.md.A[i].pa), localSrc(v, i)); W.set(i, x); return x; };
    return f;
  }
  // DoQuatInterpBone (bone_setup.cpp), escrito aparte del juego
  function quatInterp(h, BW, H) {
    const P = H[h.proc.ctrl].pa, M = mul(inv(BW[P]), BW[h.proc.ctrl]), src = _m2q(M.R), tr = h.proc.tr;
    const w = []; let s = 0;
    for (const T of tr) { const d = Math.min(1, Math.abs(T.tq[0] * src[0] + T.tq[1] * src[1] + T.tq[2] * src[2] + T.tq[3] * src[3])); const x = Math.max(0, 1 - 2 * Math.acos(d) * T.inv); w.push(x); s += x; }
    let q = [0, 0, 0, 0], p = [0, 0, 0];
    if (s <= 0.001) { q = tr[0].q.slice(); p = tr[0].pos.slice(); }
    else { s = 1 / s; tr.forEach((T, i) => { if (!w[i]) return; const k = w[i] * s; let a = 0, b = 0; for (let c = 0; c < 4; c++) { a += (T.q[c] - q[c]) ** 2; b += (T.q[c] + q[c]) ** 2; } if (a > b) q = q.map((x) => -x); for (let c = 0; c < 4; c++) q[c] += k * T.q[c]; for (let c = 0; c < 3; c++) p[c] += k * T.pos[c]; }); }
    const l = Math.hypot(...q) || 1; q = q.map((x) => x / l);
    return mul(BW[h.pa], QM(q, p));
  }
  const p2b = (h) => { const m = h.p2b; return { R: [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]], t: [m[3], m[7], m[11]] }; };
  const PBc = new WeakMap(), PRE = new WeakMap();
  function piel(Mx, BW, filtro) {   // vértices con piel (unidades de Source), los de filtro(k)
    const V = Mx.v, out = [], PB = PBc.get(Mx) || (PBc.set(Mx, Mx.huesos.map(p2b)), PBc.get(Mx)), SK = BW.map((B, b) => (B && PB[b] ? mul(B, PB[b]) : null));
    for (let k = 0; k < V.n; k++) {
      if (filtro && !filtro(k)) { out.push(null); continue; }
      const p = [V.pos[k * 3], V.pos[k * 3 + 1], V.pos[k * 3 + 2]], o = [0, 0, 0];
      for (let j = 0; j < 3; j++) { const w = V.w[k * 3 + j]; if (w <= 1e-4) continue; const S = SK[V.hb[k * 3 + j]]; if (!S) continue; const q = ap(S, p); o[0] += w * q[0]; o[1] += w * q[1]; o[2] += w * q[2]; }
      out.push(o);
    }
    return out;
  }
  // lo más cerca entre un punto y los vértices del arma (rejilla de 2 unidades; hasta 16 unidades, 40 cm)
  function rejilla(P) { const g = new Map(); for (const q of P) { const k = Math.floor(q[0] / 2) + ',' + Math.floor(q[1] / 2) + ',' + Math.floor(q[2] / 2); let L = g.get(k); if (!L) g.set(k, (L = [])); L.push(q); } return g; }
  function cercaG(g, p) {
    const cx = Math.floor(p[0] / 2), cy = Math.floor(p[1] / 2), cz = Math.floor(p[2] / 2); let m = Infinity;
    for (let r = 0; r <= 8; r++) {
      for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) for (let z = cz - r; z <= cz + r; z++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) !== r) continue; const L = g.get(x + ',' + y + ',' + z); if (!L) continue;
        for (const q of L) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < m) m = d; }
      }
      if (m < Infinity && Math.sqrt(m) <= r * 2) break;
    }
    return Math.min(16, Math.sqrt(m));
  }
  const domina = (V, k) => { let b = V.hb[k * 3], w = V.w[k * 3]; for (let j = 1; j < 3; j++) if (V.w[k * 3 + j] > w) { w = V.w[k * 3 + j]; b = V.hb[k * 3 + j]; } return b; };
  // un cuadro: huesos de las manos del juego y de la referencia, y sus pieles
  function cuadro(v, Mh, ctx) {
    const M = v.M, H = M.huesos, Hh = Mh.huesos, nodoH = v.manos.nodoH, oc = v.manos.oculto;
    const BWvm = []; H.forEach((h, i) => { const L = localSrc(v, 1 + i); BWvm.push(h.pa >= 0 ? mul(BWvm[h.pa], L) : L); });
    const porN = new Map(H.map((h, i) => [h.n.toLowerCase(), i]));
    const lado = (h) => { const m = /_([lr])_/i.exec(h.n); return m ? m[1].toUpperCase() : null; };
    const ref = [], jue = [], antes = [], f = mundoNodos(v);
    Hh.forEach((h, j) => {
      const L = lado(h); if (L && oc[L]) { ref.push(null); jue.push(null); antes.push(null); return; }
      const x = porN.get(h.n.toLowerCase());
      if (x !== undefined) ref.push(BWvm[x]);
      else if (h.proc && h.pa >= 0 && ref[h.proc.ctrl] && ref[Hh[h.proc.ctrl].pa]) ref.push(quatInterp(h, ref, Hh));
      else ref.push(mul(h.pa >= 0 && ref[h.pa] ? ref[h.pa] : I(), QM(h.q, h.pos)));
      const n = nodoH[j]; jue.push(n > 0 && n <= H.length ? BWvm[n - 1] : f(n));
      // (antes: el antepasado que la vista tiene, con la pose de enlace del hueso propio)
      let a = j; while (a >= 0 && porN.get(Hh[a].n.toLowerCase()) === undefined) a = Hh[a].pa;
      antes.push(a >= 0 ? BWvm[porN.get(Hh[a].n.toLowerCase())] : I());
    });
    let ep = 0, ea = 0; Hh.forEach((h, j) => { if (!ref[j]) return; ep = Math.max(ep, dist(ref[j].t, jue[j].t)); ea = Math.max(ea, ang(ref[j], jue[j])); });
    // (por vértice, una vez por modelo: su hueso principal y si es de una mano —palma o dedos— y de qué lado)
    const Vh = Mh.v, pre = PRE.get(Mh) || (() => { const dom = new Int32Array(Vh.n), lado = new Array(Vh.n).fill(null), palma = new Array(Vh.n).fill(null);
      const hi = { R: Hh.findIndex((h) => /_R_hand$/i.test(h.n)), L: Hh.findIndex((h) => /_L_hand$/i.test(h.n)) };
      for (let k = 0; k < Vh.n; k++) { const b = domina(Vh, k); dom[k] = b; const m = /_([RL])_(hand|finger)/i.exec(Hh[b].n); if (m) { lado[k] = m[1].toUpperCase(); if (b === hi[lado[k]]) palma[k] = lado[k]; } }
      const x = { dom, lado, palma, hi }; PRE.set(Mh, x); return x; })();
    // (la piel entera cada tres cuadros —el error de todos los vértices—; en los demás, sólo las manos para la palma y el hueco)
    const todo = !ctx || ctx.todo !== false, vis = todo ? (k) => !!ref[pre.dom[k]] : (k) => !!pre.lado[k] && !!ref[pre.dom[k]];
    const pr = piel(Mh, ref, vis), pj = piel(Mh, jue, vis);
    // (antes: cada vértice con el hueso de su antepasado pero la pose de enlace de su hueso: equivale a ese hueso pegado al antepasado)
    const pa = ctx && ctx.antes ? piel(Mh, antes, vis) : null;
    let ev = todo ? 0 : undefined, evA = pa ? 0 : undefined; if (todo) for (let k = 0; k < pr.length; k++) if (pr[k]) { ev = Math.max(ev, dist(pr[k], pj[k])); if (pa) evA = Math.max(evA, dist(pr[k], pa[k])); }
    // el arma: sus vértices con piel; palma = vértices de la mano (no dedos) de cada lado; hueco = lo más cerca de la mano y sus dedos
    const pw = M.v && M.v.n ? piel(M, BWvm) : [], g = rejilla(pw);
    const res = { ep, ea, ev, evA };
    for (const L of ['R', 'L']) {
      const hi = pre.hi[L]; if (hi < 0 || !ref[hi]) continue;
      const palma = [], todos = [], todosR = [];
      for (let k = 0; k < Vh.n; k++) { if (!pj[k] || pre.lado[k] !== L) continue; if (pre.palma[k] === L) palma.push(k); todos.push(pj[k]); todosR.push(pr[k]); }
      if (!palma.length || !pw.length) continue;
      const cen = (P) => { const c = [0, 0, 0]; for (const k of palma) for (let i = 0; i < 3; i++) c[i] += P[k][i] / palma.length; return c; };
      const cerca = (p) => cercaG(g, p);
      const hueco = (A) => { let m = Infinity; for (let i = 0; i < A.length; i += 3) m = Math.min(m, cerca(A[i])); return m; };
      res['palma' + L] = cerca(cen(pj)); res['palmaRef' + L] = cerca(cen(pr)); res['hueco' + L] = hueco(todos); res['huecoRef' + L] = hueco(todosR);
      res['manoT' + L] = jue[hi].t;   // (para medir saltos entre cuadros)
    }
    return res;
  }
  // estiramiento: largo de cada hueso de la mano y los dedos en la vista (quieto) contra el de las manos en reposo
  function estiramiento(v, Mh) {
    const H = v.M.huesos, porN = new Map(H.map((h, i) => [h.n.toLowerCase(), i])); let mx = 1;
    Mh.huesos.forEach((h) => { if (!/finger|hand/i.test(h.n) || h.pa < 0) return; const a = porN.get(h.n.toLowerCase()), b = porN.get(Mh.huesos[h.pa].n.toLowerCase()); if (a === undefined || b === undefined) return;
      const lv = Math.hypot(...H[a].pos), lh = Math.hypot(...h.pos); if (lh > 0.3) mx = Math.max(mx, lv / lh, lh / lv); });
    return mx;
  }
  // todas las animaciones de la vista (sacar, quieto, disparo, recarga), cuadro a cuadro a 30 por segundo
  function medir(maxCuadros) {
    const v = ARM.v; if (!v || !v.manos) return { e: 'sin manos', ruta: v && v.ruta };
    let Mh; try { Mh = gmLeerModelo(v.manos.model); } catch (e) { return { e: 'manos: ' + e.message }; }
    const clips = { sacar: v.sacar, quieto: v.quieto, fuego: v.fuego, recarga: v.recarga }, out = { ruta: v.ruta, manos: v.manos.model, proc: v.manos.proc.length, oculto: v.manos.oculto, estir: +estiramiento(v, Mh).toFixed(3), anims: {} };
    const guard = { clip: v.clip, t: v.t, loop: v.loop, vel: v.vel }, t0 = performance.now();
    for (const [k, nom] of Object.entries(clips)) {
      if (!nom || !DATA.anPorNombre[nom]) continue;
      const c = DATA.anPorNombre[nom], n = Math.min(k === 'quieto' ? 15 : maxCuadros || 400, Math.max(2, Math.round(c.d * 30) + 1)), F = [];
      vistaTocar(v, nom, { loop: false });
      // (la animación de la vista misma —los dedos que copian las manos—: cada hueso contra la del .mdl en ese momento)
      const si = v.sec.indexOf(nom), an = si >= 0 ? v.M.secuencias[si].anim : -1, A = an >= 0 ? v.M.anims[an] : null; let vmP = 0, vmG = 0;
      for (let i = 0; i < n; i++) {
        v.t = Math.min(c.d, i / 30); vistaAplicar(v, 0); F.push(cuadro(v, Mh, { todo: i % 3 === 0, antes: i % 6 === 0 }));
        if (A && A.nf > 0) {
          const fps = A.fps > 0 ? A.fps : 30, fr = Math.min(A.nf - 1, v.t * fps), f0 = Math.floor(fr), f1 = Math.min(A.nf - 1, f0 + 1), w = fr - f0, a = GMF.poseCapas(v.M, an, f0), b = GMF.poseCapas(v.M, an, f1);
          v.M.huesos.forEach((h, j) => {
            const p = [0, 1, 2].map((k) => a.P[j * 3 + k] * (1 - w) + b.P[j * 3 + k] * w); let q1 = [0, 1, 2, 3].map((k) => b.Q[j * 4 + k]); const q0 = [0, 1, 2, 3].map((k) => a.Q[j * 4 + k]);
            if (q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3] < 0) q1 = q1.map((x) => -x); const qi = q0.map((x, k) => x * (1 - w) + q1[k] * w), l = Math.hypot(...qi) || 1;
            const L = localSrc(v, 1 + j), Rf = _q2m(qi.map((x) => x / l)); vmP = Math.max(vmP, dist(L.t, p)); vmG = Math.max(vmG, ang(L, { R: Rf, t: p }));
          });
        }
      }
      const mx = (key) => Math.max(0, ...F.map((x) => x[key]).filter((x) => x !== undefined && x !== null && isFinite(x)));
      const salto = (L) => { let m = 0; for (let i = 1; i < F.length; i++) if (F[i]['manoT' + L] && F[i - 1]['manoT' + L]) m = Math.max(m, dist(F[i]['manoT' + L], F[i - 1]['manoT' + L])); return m; };
      const dif = (a, b) => Math.max(0, ...F.map((x) => (x[a] !== undefined ? Math.abs(x[a] - x[b]) : 0)));
      const cm = (x) => +(x * 2.54).toFixed(2);
      out.anims[k] = { clip: nom, cuadros: n, vmErr: +vmP.toFixed(4), vmGrados: +vmG.toFixed(3), huesoErr: +mx('ep').toFixed(4), huesoGrados: +mx('ea').toFixed(3), verticeErrCm: cm(mx('ev')), antesErrCm: cm(mx('evA')),
        palmaR: F.map((x) => (x.palmaR !== undefined ? cm(x.palmaR) : null)), palmaL: F.map((x) => (x.palmaL !== undefined ? cm(x.palmaL) : null)),
        huecoMaxR: cm(mx('huecoR')), huecoMaxL: cm(mx('huecoL')), difRefCm: cm(Math.max(dif('palmaR', 'palmaRefR'), dif('palmaL', 'palmaRefL'), dif('huecoR', 'huecoRefR'), dif('huecoL', 'huecoRefL'))), saltoMaxCmR: cm(salto('R')), saltoMaxCmL: cm(salto('L')) };
    }
    v.clip = guard.clip; v.t = guard.t; v.loop = guard.loop; v.vel = guard.vel; vistaAplicar(v, 0);
    out.ms = Math.round(performance.now() - t0); return out;
  }
  // costo en el procesador por cuadro (animar, huesos procedurales, ubicar y matrices de piel): la vista con manos contra
  // la misma vista armada sin manos, alternando de a 200 cuadros; y en la placa, dibujos y triángulos de un cuadro real
  async function costo(vueltas) {
    const v = ARM.v; if (!v || !v.manos) return null;
    const s = gmvConstruir(v.ruta, v.flip, 62, null, null, 'costo'); if (!s) return null;
    for (const x of [v, s]) { vistaTocar(x, v.quieto || v.sacar, { loop: true }); }
    const uno = (x, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) { vistaAplicar(x, 1 / 60); vistaUbicar(x, CAM.pos, CAM.q, ARM.sway); x.md.actualizar(); } return (performance.now() - t0) / n; };
    uno(v, 50); uno(s, 50); const A = [], B = [];
    for (let k = 0; k < (vueltas || 6); k++) { A.push(uno(v, 200)); B.push(uno(s, 200)); }
    const med = (L) => L.slice().sort((a, b) => a - b)[L.length >> 1];
    // la placa: un cuadro con las manos y otro sin (dibujos y triángulos que manda el juego)
    const cuadro = async () => { const n0 = R.cuadro; await new Promise((ok) => { const f = () => (R.cuadro > n0 + 2 ? ok() : setTimeout(f, 10)); f(); }); return { dib: R.dibujadas, tris: R.tris }; };
    GMVT.ocultar = false; const con = await cuadro(); GMVT.ocultar = true; const sin = await cuadro(); GMVT.ocultar = false;
    vistaTocar(v, v.quieto || v.sacar, { loop: true });
    return { msCon: +med(A).toFixed(4), msSin: +med(B).toFixed(4), msManos: +(med(A) - med(B)).toFixed(4), dibCon: con.dib, dibSin: sin.dib, trisCon: con.tris, trisSin: sin.tris };
  }
  return { medir, costo };
})();
