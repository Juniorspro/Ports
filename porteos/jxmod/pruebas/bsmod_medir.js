// (se corre en la página: lo usa bsmod.mjs) mide una ejecución de BSMod cuadro a cuadro.
// window.__V: la víctima (entidad de Lua; window.__P su persona, si es un NPC del juego). Devuelve los números de bsmod.mjs.
window.kmMedir = async (o) => {
  const e0 = GMA.errores.length, V = window.__V, P = window.__P, raf = () => new Promise((r) => requestAnimationFrame(r));
  const piso = (x, z) => { const h = mundoRayo(v3(x, JUG.pos.y + 1, z), v3(0, -1, 0), 6); return h ? JUG.pos.y + 1 - h.t : null; };
  const y0 = piso(JUG.pos.x, JUG.pos.z);
  const km = () => [...GMA.ents.values()].filter((x) => x.clase === 'ent_km_model' && x.vivo);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const segDist = (a0, a1, b0, b1) => { let m = 1e9; for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) { const p = a0.map((v, k) => v + (a1[k] - v) * i / 10), q = b0.map((v, k) => v + (b1[k] - v) * j / 10); m = Math.min(m, dist(p, q)); } return m; };
  // (los puntos que se miran, de cada cuerpo dibujado: cabeza, manos, pies, cadera y pecho)
  const PUNTOS = [['head1', 'Head'], ['r_hand', 'RightHand'], ['l_hand', 'LeftHand'], ['r_foot', 'RightFoot'], ['l_foot', 'LeftFoot'], ['pelvis', 'Hips'], ['spine4', 'Spine2']];
  const wp = (W) => [W[12], W[13], W[14]];
  const vbDe = (H, k) => { const i = H.def.porNombre.get('valvebiped.bip01_' + k); return i === undefined ? null : wp(H.W[1 + i]); };
  // lo dibujado de una entidad pegada (el Hero llevado al esqueleto, o un .mdl con bonemerge): puntos y error contra el padre
  const dibujado = (ent) => {
    const H = gmanHuesos(ent); if (!H) return null; const Hp = gmanHuesos(ent.padre); if (!Hp) return null;
    if (H.def.virt) { const Vp = gmanVirtualPose(ent, H); if (!Vp.ok) return null; const pr = Vp.pr, G = Vp.G; let err = 0; for (const [h, j] of pr.deVB) err = Math.max(err, dist(wp(G.W[h]), wp(Hp.W[j])));
      const pts = {}; for (const [k, m] of PUNTOS) if (pr.porNom[m] !== undefined) pts[k] = wp(G.W[pr.porNom[m]]); return { err, pts }; }
    let err = 0; H.def.nombres.forEach((n, i) => { const j = Hp.def.porNombre.get(n.toLowerCase()); if (j !== undefined) err = Math.max(err, dist(wp(H.W[1 + i]), wp(Hp.W[1 + j]))); });
    const pts = {}; for (const [k] of PUNTOS) { const p = vbDe(H, k); if (p) pts[k] = p; } return { err, pts };
  };
  // (la persona visible —antes y después—: sus huesos de Mixamo con el mismo nombre)
  const persona = (Q) => { if (!Q || !Q.md || Q.gmOculto) return null; Q.md.actualizar(); const pts = {}; for (const [k, m] of PUNTOS) { const i = Q.D.h[m]; if (i !== undefined) pts[k] = wp(Q.md.W[i]); } return pts; };
  const r = { empezo: false, sec: null, durJug: null, durSec: null, durEsperada: null, muere: null, muereEsperada: null, ref: null, dibujo: 0, contacto: null, torsos: 1e9, pieMin: 1e9, salto: 0, saltoHueso: '', saltoTrans: 0, camara: 0, fin: null, libre: false, piso: false, armaFin: null, restos: 0, muneco: false, munecoD: null, errLua: [] };
  MODS.tiempo = 0.12;
  let ultPts0 = P ? persona(P) : null;
  const t0 = TIEMPO.t; const okK = lua('return KMCheck(player.GetAll()[1])');
  let ragC0 = null, ant = { r: null }, vistos = 0, refMax = 0, refN = 0, tLib = null, tMuere = null, ultV = null, vbVict = null, empezo = false, ultPts = null;
  // (¿la animación de GMod misma salta en ese tramo? —más de 4 unidades de un cuadro al siguiente: el primer cuadro de right_1—)
  const refSalta = (ta, tb, k) => { const F = o.ref.fr; for (let i = 0; i < F.length - 1; i++) { if (F[i + 1].t < Math.min(ta, tb) - 1e-6 || F[i].t > Math.max(ta, tb) + 1e-6) continue; if (dist(F[i][k], F[i + 1][k]) > 4) return true; } return false; };
  const refI = (t, k) => { const F = o.ref.fr; let i = 0; while (i < F.length - 2 && F[i + 1].t < t) i++; const a = F[i], b = F[Math.min(i + 1, F.length - 1)], w = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0; return a[k].map((v, j) => v + (b[k][j] - v) * w); };
  // (el muñeco, cada cuadro desde que lo pone el Lua: la velocidad más alta de la cadera en los primeros 0,3 s —BSMod lo
  // empuja a los 0,075 s, del lado del cliente— y dónde está 1 s después)
  // (la pose del muñeco ni bien lo pone el Lua —dentro de su gancho, antes de cualquier paso de la física: si después lo lanza,
  // como la patada voladora del Dropkick a 7 m/s, lo que se movió no cuenta—)
  let pose0 = null; const m0 = gmanMuneco;
  gmanMuneco = function (P2) { const x = m0.apply(this, arguments); try { if (P2 === P && P2.rag) { ragdollPaso(P2); P2.md.actualizar(); pose0 = {}; for (const n of ['Hips', 'Spine1', 'Head']) if (P2.D.h[n] !== undefined) pose0[n] = wp(P2.md.W[P2.D.h[n]]); } } catch (e) {} return x; };
  const ragMira = () => {
    if (!ragC0 || !P || !P.rag || ragC0.seVa !== undefined) return; const bh = P.rag.cuerpos && P.rag.cuerpos.get(P.D.h.Hips), d = TIEMPO.t - ragC0.t;
    if (d < 0.3 && bh && bh.b) ragC0.vmax = Math.max(ragC0.vmax || 0, bh.b.vel.len());
    if (d >= 1) { P.md.actualizar(); ragC0.seVa = dist(wp(P.md.W[P.D.h.Hips]), ragC0.p); }
  };
  while (TIEMPO.t - t0 < 6) {
    await raf(); ragMira(); const t = TIEMPO.t - t0, L = km();
    const pa = L.find((x) => x.dueño === GMA.jug && x.an), va = L.find((x) => x.dueño !== GMA.jug && x.an);
    const pm = L.find((x) => x.dueño === GMA.jug && !x.an && x.efectos), vm = L.find((x) => x.dueño !== GMA.jug && !x.an && x.efectos);
    if (pa && pa.an && va && va.an) {
      if (!empezo && o.ref) {
        // (los esqueletos en cada cuadro de la animación de GMod, exactos: la pose del motor en ese momento contra la del .mdl)
        const tp = pa.an.t, tv = va.an.t, Hv0 = gmanHuesos(va), inv0 = M4.inv(Hv0.W[0]);
        const loc0 = (p) => { const l = [inv0[0] * p[0] + inv0[4] * p[1] + inv0[8] * p[2] + inv0[12], inv0[1] * p[0] + inv0[5] * p[1] + inv0[9] * p[2] + inv0[13], inv0[2] * p[0] + inv0[6] * p[1] + inv0[10] * p[2] + inv0[14]]; return [l[2] / GM_S, l[0] / GM_S, l[1] / GM_S]; };
        for (const F of o.ref.fr) { pa.an.t = F.t; va.an.t = F.t; const A = gmanHuesos(pa), B = gmanHuesos(va);
          for (const [k, n, H] of [['pR', 'r_hand', A], ['pL', 'l_hand', A], ['pRF', 'r_foot', A], ['pHead', 'head1', A], ['pPel', 'pelvis', A], ['vHead', 'head1', B], ['vPel', 'pelvis', B]]) { const q = vbDe(H, n); if (q) { refMax = Math.max(refMax, dist(loc0(q), F[k])); refN++; } } }
        pa.an.t = tp; va.an.t = tv;
      }
      if (!empezo) { empezo = true; r.empezo = true; const M = gmanDefDe(pa).M; r.sec = M.secuencias[pa.an.i].n; r.durSec = +GMF.secDur(M, pa.an.i).toFixed(3); r.durEsperada = +(r.durSec + 0.075).toFixed(3); r.muereEsperada = +((r.sec === 'killmove_front_1' ? 1.15 : va.an.dur) + 0.075).toFixed(3); }
      const Hp = gmanHuesos(pa), Hv = gmanHuesos(va), inv = M4.inv(Hv.W[0]);
      const loc = (p) => { const l = [inv[0] * p[0] + inv[4] * p[1] + inv[8] * p[2] + inv[12], inv[1] * p[0] + inv[5] * p[1] + inv[9] * p[2] + inv[13], inv[2] * p[0] + inv[6] * p[1] + inv[10] * p[2] + inv[14]]; return [l[2] / GM_S, l[0] / GM_S, l[1] / GM_S]; };
      // los esqueletos de Valve contra GMod (en los ejes de la víctima, en unidades)
      // (y los saltos: lo que se mueve cada hueso de un cuadro al otro, contra lo que se mueve en la animación de GMod en ese tramo)
      if (o.ref && pa.an.t <= o.ref.durP) { const cur = {}; for (const [k, n, H] of [['pR', 'r_hand', Hp], ['pL', 'l_hand', Hp], ['pRF', 'r_foot', Hp], ['pHead', 'head1', Hp], ['pPel', 'pelvis', Hp], ['vHead', 'head1', Hv], ['vPel', 'pelvis', Hv]]) { const q = vbDe(H, n); if (!q) continue; const lq = loc(q), rf = refI(pa.an.t, k); cur[k] = [lq, rf];
          const A = ant.r && ant.r[k]; if (A && !refSalta(ant.rt, pa.an.t, k)) { const ex = Math.abs(dist(lq, A[0]) - dist(rf, A[1])) * 2.54; if (ex > r.salto) { r.salto = +ex.toFixed(2); r.saltoHueso = k + '@' + pa.an.t.toFixed(2); } } }
        ant.r = cur; ant.rt = pa.an.t; }
      // golpe, torsos y pies (de Valve)
      const ph = [vbDe(Hp, 'r_hand'), vbDe(Hp, 'l_hand')], vh = vbDe(Hv, 'head1');
      if (vh) { const c = Math.min(...ph.filter(Boolean).map((p) => dist(loc(p), loc(vh)))); if (r.contacto === null || c < r.contacto) r.contacto = +c.toFixed(1); }
      const tor = segDist(vbDe(Hp, 'pelvis'), vbDe(Hp, 'spine4'), vbDe(Hv, 'pelvis'), vbDe(Hv, 'spine4')) * 100; r.torsos = Math.min(r.torsos, +tor.toFixed(1));
      for (const H of [Hp, Hv]) for (const f of ['r_foot', 'l_foot']) { const q = vbDe(H, f); if (q) r.pieMin = Math.min(r.pieMin, +((q[1] - y0) * 100).toFixed(1)); }
      // lo dibujado, sus saltos y la cámara
      const dp = pm ? dibujado(pm) : null, dv = vm ? dibujado(vm) : null;
      if (dp) r.dibujo = Math.max(r.dibujo, +(dp.err * 100).toFixed(2)); if (dv) r.dibujo = Math.max(r.dibujo, +(dv.err * 100).toFixed(2));
      // (el primer cuadro de la víctima animada: el cambio del NPC por su modelo animado, aparte)
      if (dv && !vbVict && ultPts) { let m = 0; for (const x in dv.pts) if (ultPts[x]) m = Math.max(m, dist(dv.pts[x], ultPts[x]) * 100); r.saltoTrans = Math.max(r.saltoTrans, +m.toFixed(1)); }
      if (dv) { vbVict = dv.pts; ultV = { pts: dv.pts, vb: { pelvis: vbDe(Hv, 'pelvis'), spine1: vbDe(Hv, 'spine1'), head1: vbDe(Hv, 'head1') } }; }
      if (pm && t > 0.05 && JUG.bloqueado) { const ia = gmanAdjuntos(gmanHuesos(pm).def).findIndex((a) => a.n.toLowerCase() === 'eyes'); const W = ia >= 0 ? gmanAdjunto(pm, ia) : null; if (W) r.camara = Math.max(r.camara, +(Math.hypot(CAM.pos.x - W[12], CAM.pos.y - W[13], CAM.pos.z - W[14]) * 100).toFixed(2)); if (!JUG.tercera) r.camara = Math.max(r.camara, 99); }
      vistos++;
    } else if (!empezo && P) ultPts = persona(P);
    if (empezo && tLib === null && !JUG.bloqueado) tLib = t;
    const vivo = P ? P.vivo !== false : V && V.vivo !== false && !(V.vida <= 0);
    if (empezo && tMuere === null && !vivo) {
      tMuere = t;
      // (el muñeco, ni bien lo pone el Lua —0,02 s—: el pecho donde estaba el del modelo animado; y 1 s después, que no se haya ido lejos)
      const tm = TIEMPO.t; while (TIEMPO.t - tm < 0.02) await raf();
      // (los huesos con cuerpo —cadera, pecho de abajo, cabeza—: los demás siguen a su padre con las medidas del personaje)
      // (sólo los huesos que tiene el modelo de la víctima: el zombi de HL2 no tiene cabeza de Valve —es el headcrab— y en GMod
      // su muñeco tampoco)
      if (P && P.rag && ultV && ultV.vb) { P.md.actualizar(); let m = 0; const dm = P.ragEnt ? gmanDef(P.ragEnt.modelo) : null;
        for (const [n, k] of [['Hips', 'pelvis'], ['Spine1', 'spine1'], ['Head', 'head1']]) { const i = P.D.h[n]; if (dm && dm.porNombre.get('valvebiped.bip01_' + k) === undefined) continue; if (i !== undefined && ultV.vb[k]) m = Math.max(m, dist(pose0 && pose0[n] ? pose0[n] : wp(P.md.W[i]), ultV.vb[k])); } r.munecoD = { huesos: +(m * 100).toFixed(1), alPonerlo: !!pose0 }; const bh = P.rag.cuerpos && P.rag.cuerpos.get(P.D.h.Hips); ragC0 = { p: wp(P.md.W[P.D.h.Hips]), t: TIEMPO.t }; r.munecoD.v0 = bh && bh.b ? +bh.b.vel.len().toFixed(2) : 0; r.munecoD.dt = +(TIEMPO.t - tm + 0.02).toFixed(3); }
    }
    if (empezo && tLib !== null && tMuere !== null && t > Math.max(tLib, tMuere) + 1.2) break;
  }
  // (y 1 s después de morir: cuánto se movió el muñeco —con lo que le hace BSMod al morir: KMRagdoll lo empuja en algunas—;
  // no más lejos que lo que lo lanzó el Lua, con 1 m de margen y nunca menos de 3 m)
  if (ragC0 && P && P.rag) { while (ragC0.seVa === undefined && P.rag) { await raf(); ragMira(); }
    r.munecoD.seVa = +((ragC0.seVa || 0) * 100).toFixed(1); r.munecoD.vmax = +(ragC0.vmax || 0).toFixed(2); }
  gmanMuneco = m0; MODS.tiempo = 1;
  r.durJug = tLib === null ? null : +tLib.toFixed(3); r.muere = tMuere === null ? null : +tMuere.toFixed(3);
  if (o.ref) r.ref = { max: +refMax.toFixed(2), n: refN, contacto: o.ref.contacto, torsos: o.ref.torsos, pieMin: o.ref.pieMin };
  await esperaJuego(0.4);
  const yp = piso(JUG.pos.x, JUG.pos.z), pies = JUG.pos.y - JUG.medio - JUG.radio;
  r.fin = { suelo: !!JUG.suelo, pies: yp === null ? null : +((pies - yp) * 100).toFixed(1), bloq: !!JUG.bloqueado, tercera: !!JUG.tercera };
  r.libre = !JUG.bloqueado && JUG.vivo && !JUG.tercera; r.piso = !!JUG.suelo && yp !== null && Math.abs(pies - yp) <= 0.04;
  r.armaFin = ARM.lista[ARM.i];
  if (P) { r.muneco = !!P.rag && !P.gmOculto && (!r.munecoD || (r.munecoD.huesos <= 10 && !(r.munecoD.seVa > Math.max(300, (r.munecoD.vmax || 0) * 100 + 100)))); if (!r.munecoD) r.munecoD = { rag: !!P.rag, oculto: !!P.gmOculto }; } else { r.muneco = !V.vivo || !(V.vida > 0); r.munecoD = { vivo: !!V.vivo, vida: V.vida }; }
  await esperaJuego(2.4); r.restos = km().length;
  r.errLua = GMA.errores.slice(e0).map((x) => String(x.msg || x).slice(0, 200));
  r.n = vistos; r.ok = okK;
  return r;
};
// las fotos de una ejecución: la cámara (la del jugador o una de prueba) y el reloj del juego muy despacio
window.kmFotoEmpezar = (vista) => {
  const P = window.__P, V = window.__V, pv = () => (P ? P.pos.clone() : gmaEntPos(V).add(v3(0, 0.95, 0)));
  const m0 = vadd(vscale(vadd(JUG.pos.clone(), pv()), 0.5), v3(0, -0.15, 0)), fw = vsub(pv(), JUG.pos).norm(), der = v3(fw.z, 0, -fw.x);
  window.__camDbg = vista === 'real' ? null : vista === 'lado' ? { p: vadd(m0, vadd(vscale(der, 2.8), v3(0, 0.45, 0))), m: m0 } : vista === 'atras' ? { p: vadd(JUG.pos, vadd(vscale(fw, -2.4), v3(0, 0.55, 0))), m: m0 } : { p: vadd(m0, vadd(vscale(der, 1.0), v3(0, 0.55, 0))), m: vadd(m0, v3(0, 0.45, 0)) };
  MODS.tiempo = 0.12; window.__ft0 = TIEMPO.t; lua('KMCheck(player.GetAll()[1])'); return 1;
};
window.kmFotoHasta = async (t) => { MODS.tiempo = 0.12; while (TIEMPO.t - window.__ft0 < t) await new Promise((r) => requestAnimationFrame(r)); MODS.tiempo = 0.0005; await new Promise((r) => requestAnimationFrame(r)); return +(TIEMPO.t - window.__ft0).toFixed(3); };
// (la víctima mirando al jugador, girada «g»: con ella ya quieta —ejecutable—; la de costado y la de atrás se eligen así)
window.kmGirar = (g) => { const P = window.__P, V = window.__V, y = JUG.yaw + Math.PI + g;
  if (P) { P.yaw = y; return 1; } if (V) { const a = new LAng(0, quatAng(Quat.axis(0, 1, 0, y)).y, 0); a.__mt = GMA.mtAng; GMA.metas.Entity.get('SetAngles')(V, a); } return 1; };
