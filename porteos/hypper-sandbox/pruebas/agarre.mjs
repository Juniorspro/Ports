// el agarre de las armas de GMod en tercera persona, en todos los personajes: cada uno parado con el arma (postura de GMod),
// y se mide con la geometría de verdad: el eje del mango (el eje largo de la malla del arma), lo lejos que queda del centro
// de la palma y cuánto lo rodean los dedos (ángulo barrido alrededor del eje, del nudillo a la punta). Fotos de cerca.
// uso: node agarre.mjs HTML CARPETA [arma]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', ARMA = process.argv[4] || 'Crowbar';
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(3000);
const skins = await ev(`DATA.chars.slice()`);
await ev(`$('hud').classList.add('oc'); JUG.noclip = true; JUG.tercera = false; ARM.v = null; window.__P = null; 1`);
const res = [];
for (const s of skins) {
  const r = await ev(`(() => {
    if (window.__P) borrarPersona(window.__P);
    const P = window.__P = crearPersona('${s}', 'HatEmpty', { nombre: '' }); P.npc = true; P.arma = '${ARMA}';
    P.pos.set(JUG.pos.x + Math.sin(JUG.yaw) * 2.2, JUG.pos.y, JUG.pos.z + Math.cos(JUG.yaw) * 2.2); P.yaw = JUG.yaw + Math.PI * 0.62; P.vel.set(0, 0, 0); P.suelo = true;
    for (let i = 0; i < 30; i++) animarPersona(P, 1 / 30);
    ubicarPersona(P); P.md.sucio = true; P.md.actualizar();
    const A = DATA.gm.armas['${ARMA}']; if (!A) return { error: 'sin datos' };
    if (!armaGmDibujar(P)) { const ix = huesosMixamo(P.D); return { error: 'no se puso', mano: ['RightHand', 'RightHandMiddle1', 'RightHandIndex1', 'RightHandPinky1'].map((n) => ix[n]), W: !!P.md.W, n: P.md.W.length }; }
    R.nItems = Math.max(0, R.nItems - 1); // (sólo para tener la matriz del arma)
    const md = P.armasGm['${ARMA}']; md.actualizar(); const Wm = md.W[0];
    // el eje largo de la malla del arma, en el mundo
    const mc = mallaCPU(A.m), Pp = mc.P, n = Pp.length / 3, pts = [];
    for (let i = 0; i < n; i += Math.max(1, (n / 400) | 0)) { const q = m4pt(Wm, Pp[i * 3], Pp[i * 3 + 1], Pp[i * 3 + 2], v3()); pts.push(q); }
    const c = pts.reduce((a, q) => a.add(q), v3()).scale(1 / pts.length);
    let ax = v3(1, 0, 0); for (let it = 0; it < 30; it++) { const nx = v3(); for (const q of pts) { const d = vsub(q, c); nx.add(vscale(d, vdot(d, ax))); } ax = nx.norm(); }
    const W = P.md.W, ix = huesosMixamo(P.D), pos = (nm) => { const w = W[ix[nm]]; return w ? v3(w[12], w[13], w[14]) : null; };
    const dEje = (q) => { const d = vsub(q, c); return vsub(d, vscale(ax, vdot(d, ax))).len(); };
    const F = new Float32Array(16), L = manoMarco(W, ix, 'Right', F), h = v3(F[12], F[13], F[14]), xh = v3(F[0], F[1], F[2]);
    const palma = vadd(h, vscale(xh, L * 0.5));
    // cuánto rodean los dedos el eje: ángulo barrido del nudillo a la punta, en el plano perpendicular al eje
    const ang = (q) => { const d = vsub(q, c); return vsub(d, vscale(ax, vdot(d, ax))); };
    const barrido = (dedo) => { const k1 = pos('RightHand' + dedo + '1'); if (!k1) return null; const ref = ang(k1).norm(), e2 = vcross(ax, ref); let tot = 0, prev = null;
      for (let s = 1; s <= 4; s++) { const q = pos('RightHand' + dedo + s); if (!q) break; const u = ang(q); const a = Math.atan2(vdot(u, e2), vdot(u, ref)); if (prev !== null) { let da = a - prev; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; tot += da; } prev = a; }
      return Math.round(Math.abs(tot) * 180 / Math.PI); };
    const dedos = ['Index', 'Middle', 'Ring', 'Pinky'].map(barrido);
    // ¿la mano o la palanca se meten en la cabeza? (esfera de la cabeza: del hueso de la cabeza a la punta, con margen)
    let t0 = 1e9, t1 = -1e9; for (const q of pts) { const t = vdot(vsub(q, c), ax); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
    const hd = pos('Head'), ht = pos('HeadTop_End') || vadd(hd, v3(0, 0.22, 0)), hc = vscale(vadd(hd, ht), 0.5), hr = hd.distTo(ht) * 0.55;
    const segDist = (q) => { const t = Math.max(t0, Math.min(t1, vdot(vsub(q, c), ax))); return q.distTo(vadd(c, vscale(ax, t))); };
    const cabeza = { mano: +((pos('RightHand').distTo(hc) - hr) * 100).toFixed(1), palanca: +((segDist(hc) - hr) * 100).toFixed(1) };
    // contra GMod: lo lejos que quedan las articulaciones y la punta de donde las tiene GMod (en el marco de la mano, a la
    // escala de la mano) y si alguna falange se mete en el mango (el de la mano: lo que queda cerca de la palma)
    const Fi = M4.inv(F), PG = DATA.gm.dedos[A.tipo].Right.pos, Mg = mangoArma(A, L), rfd = 0.065 * L;
    const contra = ['Index', 'Middle', 'Ring', 'Pinky'].map((dd) => { const T = PG[dd]; const Q = [1, 2, 3, 4].map((k) => pos('RightHand' + dd + k)); if (!T || !Q[1] || !Q[2]) return null;
      if (!Q[3]) Q[3] = vadd(Q[2], vscale(vsub(Q[2], Q[1]), 0.8)); const H = Q.map((q) => m4pt(Fi, q.x, q.y, q.z, v3()));
      let mx = 0; for (const k of [1, 2, 3]) mx = Math.max(mx, H[k].distTo(v3(T[k][0] * L, T[k][1] * L, T[k][2] * L)));
      let dentro = 0; for (let k = 0; k < 3; k++) for (let u = 0; u <= 1; u += 0.25) { const q = vadd(H[k], vscale(vsub(H[k + 1], H[k]), u)); dentro = Math.max(dentro, Mg.r + 0.5 * rfd - ejeMango(q, Mg)); }
      return [+(mx * 100).toFixed(1), +(dentro * 100).toFixed(1)]; });
    return { gmod: contra, palmaEje: +(dEje(palma) * 100).toFixed(1), relacion: +(dEje(palma) / L).toFixed(2), manoCm: +(L * 100).toFixed(1), puntas: ['Index', 'Middle', 'Ring', 'Pinky'].map((dd) => { const q = pos('RightHand' + dd + '4') || pos('RightHand' + dd + '3'); return q ? +(dEje(q) * 100).toFixed(1) : null; }),
      rodean: dedos, pulgar: barrido('Thumb'), cabeza };
  })()`);
  res.push([s, r]);
  // fotos con la cámara de pruebas (DBG.cam): la mano de cerca (de costado y de frente) y el cuerpo entero
  const mirar = (p, t) => `(() => { const p = v3(${p}), t = v3(${t}), f = vsub(t, p).norm(); let q = Quat.euler(Math.atan2(f.x, f.z), Math.asin(f.y));
    if (q.rot(v3(0, 0, 1)).distTo(f) > 0.01) q = Quat.euler(Math.atan2(f.x, f.z), -Math.asin(f.y)); DBG.cam = { p, q }; return 1; })()`;
  const geo = await ev(`(() => { const P = window.__P, W = P.md.W, ix = huesosMixamo(P.D), w = W[ix.RightHand], h = [w[12], w[13], w[14]], c = [P.pos.x, P.pos.y, P.pos.z], y = P.yaw; return { h, c, y }; })()`);
  const [hx, hy, hz] = geo.h, y0 = geo.y;
  for (const [nom, ang, dist, alto] of [['agarre_' + s, 1.4, 0.42, 0.04], ['agarre2_' + s, -0.3, 0.42, 0.1]]) {
    const a = y0 + ang; await ev(mirar(`${hx + Math.sin(a) * dist}, ${hy + alto}, ${hz + Math.cos(a) * dist}`, `${hx}, ${hy}, ${hz}`));
    await p.waitForTimeout(450); await p.screenshot({ path: D + nom + '.jpg', type: 'jpeg', quality: 80 });
  }
  const [cx, cy, cz] = geo.c, a = y0 + 0.9; await ev(mirar(`${cx + Math.sin(a) * 2.6}, ${cy + 0.6}, ${cz + Math.cos(a) * 2.6}`, `${cx}, ${cy + 0.4}, ${cz}`));
  await p.waitForTimeout(450); await p.screenshot({ path: D + 'cuerpo_' + s + '.jpg', type: 'jpeg', quality: 80 });
  await ev(`DBG.cam = null; 1`);
}
for (const [s, r] of res) console.log(s.padEnd(15), JSON.stringify(r));
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 5).join(' | ') || 'ninguno');
await b.close();
