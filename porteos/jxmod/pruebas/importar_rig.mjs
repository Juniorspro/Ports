// Importar personaje (pjimportar.js): el rig automático y el retargeteo, medidos con cada modelo de prueba (CC0/CC-BY, fuera
// del repo: CREDITOS.md). Por modelo: cuánto tarda (leer + rig), y con las animaciones del juego (quieto, caminar, correr,
// saltar, agachado y seis emotes) a 30 cuadros por segundo, cuadro a cuadro con la piel calculada en la CPU como la placa:
//  · estiramiento de las aristas de la malla por zona (la mano tiene que ser rígida: los dedos no se estiran)
//  · penetraciones: vértices de los brazos dentro del torso y de una pierna dentro de la otra (en la grilla de vóxeles del
//    reposo, por el hueso del torso o de la otra pierna), en cm
//  · saltos: cuánto se mueve cada hueso entre dos cuadros (respecto de la raíz) y su aceleración (2.ª diferencia), contra
//    los mismos huesos del Hero en la misma animación (escalados a su alto)
// Y capturas desde la cámara real en tercera persona (el personaje puesto, caminando y corriendo por el mapa).
// uso: node importar_rig.mjs URL_HTML URL_MODELOS CARPETA_FOTOS [nombre=archivo1+archivo2,...]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, MOD, D = '.', LISTA] = process.argv; fs.mkdirSync(D, { recursive: true });
const MODELOS = (LISTA || 'cesium=../bajados/cesiumman/CesiumMan.glb,robot=../bajados/robot/RobotExpressive.glb,figura=../bajados/riggedfigure/RiggedFigure.glb,kenney=../bajados/kenney/character.glb,'
  + 'cesium_obj=cesium_obj/cesium_obj.obj+cesium_obj/cesium_obj.mtl+cesium_obj/tex0.jpg,robot_obj=robot_obj/robot_obj.obj+robot_obj/robot_obj.mtl,'
  + 'mh_a=mh_a/mh_a.obj+mh_a/mh_a.mtl,mh_t=mh_t/mh_t.obj+mh_t/mh_t.mtl,mh_alto=mh_alto/mh_alto.obj+mh_alto/mh_alto.mtl,mh_bajito=mh_bajito/mh_bajito.obj+mh_bajito/mh_bajito.mtl,'
  + 'mh_cabezon=mh_cabezon/mh_cabezon.obj+mh_cabezon/mh_cabezon.mtl,mh_vestido=mh_vestido/mh_vestido.obj+mh_vestido/mh_vestido.mtl,mh_tapado=mh_tapado/mh_tapado.obj+mh_tapado/mh_tapado.mtl')
  .split(',').map((x) => { const [n, a] = x.split('='); return [n, a.split('+')]; });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.cuerpo`), null, { timeout: 90000 }); await p.waitForTimeout(1500);
// la medición, en la página: una persona con ese modelo, animada a mano a 30 cuadros por segundo
await ev(`(() => { window.__pjiMed = (skin, ses) => {
  const ESC = [['quieto', 1, 0, 0], ['caminar', 3, 1.7, 0], ['correr', 3, 6, 0], ['saltar', 1.6, 0, 0], ['agachado', 1.5, 0, 0], ['Hi', 3, 0, 1], ['Clap', 3, 0, 1], ['ChickenDance', 3, 0, 1], ['Techno', 3, 0, 1], ['Victory', 3, 0, 1], ['Twerk', 3, 0, 1]].filter((x) => !window.__esc || window.__esc.includes(x[0]));
  const dt = 1 / 30, base = JUG.pos.clone().add(v3(4, 0, 4)), P = crearPersona(skin, 'HatEmpty', { nombre: '' }); P.pos.copy(base); P.yaw = 0.3;
  const t0 = TIEMPO.t, dt0 = TIEMPO.dt; TIEMPO.dt = dt;
  for (let k = 0; k < 10 && !(P.gmp || !P.gmpRuta); k++) { animarPersona(P, dt); dibujarPersona(P); }
  const G = P.gmp, esHero = !P.gmpRuta, out = { esc: {}, ok: esHero || !!(G && !G.propio) };
  if (!out.ok) { borrarPersona(P); TIEMPO.dt = dt0; return out; }
  // los huesos que se comparan (los del Hero que tienen todos): su posición en el mundo
  const NOM = ['Hips', 'Spine', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
  const pos = (n) => { if (esHero) { const i = P.D.h[n]; if (i === undefined) return null; P.md.actualizar(); const W = P.md.W[i]; return v3(W[12], W[13], W[14]); } const i = G.def.porMix[n]; return i === undefined ? null : G.Pw[i].clone(); };
  // la piel en la CPU (como la placa): S_h = mundo del hueso · p2b
  let piel = null;
  if (!esHero && ses) {
    const M = G.def.M, V = M.v, n = V.n, nb = M.huesos.length, PB = M.huesos.map((h) => { const m = h.p2b; return [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, m[3], m[7], m[11], 1]; });
    const S = Array.from({ length: nb }, () => new Float32Array(16)), Q = new Float32Array(n * 3);
    // aristas únicas (soldadas por posición) y la zona de cada una (por el hueso que más pesa en sus dos puntas)
    const sold = new Int32Array(n), mp = new Map(); let ns = 0; for (let v = 0; v < n; v++) { const k = Math.round(V.pos[v * 3] * 1e4) + ',' + Math.round(V.pos[v * 3 + 1] * 1e4) + ',' + Math.round(V.pos[v * 3 + 2] * 1e4); let s = mp.get(k); if (s === undefined) { s = ns++; mp.set(k, s); } sold[v] = s; }
    const E = new Map(); for (const m of M.mallas) for (let t = 0; t < m.tris.length; t += 3) for (let c = 0; c < 3; c++) { const a = m.tris[t + c], b = m.tris[t + (c + 1) % 3], sa = sold[a], sb = sold[b]; if (sa === sb) continue; const k = sa < sb ? sa * 1e7 + sb : sb * 1e7 + sa; if (!E.has(k)) E.set(k, [a, b]); }
    const ed = [...E.values()], zona = (v) => { const h = V.hb[v * 3], m = G.def.mix[1 + h] || ''; return /Hand/.test(m) && V.w[v * 3] > 0.999 ? 'mano' : /Arm|Shoulder|Hand/.test(m) ? 'brazo' : /UpLeg|Leg$|Foot|Toe/.test(m) ? 'pierna' : /Head|Neck/.test(m) ? 'cabeza' : 'torso'; };
    const ez = ed.map(([a, b]) => { const za = zona(a), zb = zona(b); return za === zb ? za : za === 'mano' || zb === 'mano' ? 'muñeca' : za + '-' + zb; });
    const L0 = ed.map(([a, b]) => Math.hypot(V.pos[a * 3] - V.pos[b * 3], V.pos[a * 3 + 1] - V.pos[b * 3 + 1], V.pos[a * 3 + 2] - V.pos[b * 3 + 2]));
    piel = { M, V, n, nb, PB, S, Q, ed, ez, L0, est: {}, est999: {} };
    // penetraciones: con los vóxeles y las etiquetas del rig (sólo en el rig automático)
    if (ses.rig && ses.rig.vox) {
      const X = ses.rig.vox, lab = ses.rig.lab, prof = new Float32Array(X.N).fill(0), cola = [], et = ses.rig.et, TOR = new Set([0, 1, 2, 3]);
      // (la profundidad dentro de cada zona: BFS desde el borde de la zona)
      const zonaVox = (q) => (!X.sol[q] ? -1 : TOR.has(lab[q]) ? 0 : lab[q] >= 14 && lab[q] <= 17 ? 1 : lab[q] >= 18 && lab[q] <= 21 ? 2 : 3);
      for (let q = 0; q < X.N; q++) prof[q] = zonaVox(q) < 0 ? 0 : Infinity;
      const nxy = X.nx * X.ny; for (let q = 0; q < X.N; q++) { if (prof[q] === 0) continue; const z = zonaVox(q); for (const o of [1, -1, X.nx, -X.nx, nxy, -nxy]) if (zonaVox(q + o) !== z) { prof[q] = 1; cola.push(q); break; } }
      for (let i = 0; i < cola.length; i++) { const q = cola[i], z = zonaVox(q); for (const o of [1, -1, X.nx, -X.nx, nxy, -nxy]) { const q2 = q + o; if (prof[q2] === Infinity && zonaVox(q2) === z) { prof[q2] = prof[q] + 1; cola.push(q2); } } }
      piel.pen = { X, lab, prof, zonaVox, brazos: [...Array(n).keys()].filter((v) => et[v] === 8 || et[v] === 9 || et[v] === 12 || et[v] === 13), pI: [...Array(n).keys()].filter((v) => et[v] >= 14 && et[v] <= 17), pD: [...Array(n).keys()].filter((v) => et[v] >= 18 && et[v] <= 21), max: {}, cuadros: {} };
    }
  }
  // estiramiento, igual para el Hero y para el importado: cada malla con piel del modelo, en la CPU con las mismas matrices que
  // van a la placa (pz.h). Aristas soldadas por posición y de al menos 1 % del alto (las chiquitas dan cocientes sin sentido);
  // rígidas: las dos puntas con ≥ 95 % en el mismo hueso (ahí no se tiene que estirar nada)
  const mdE = esHero ? P.md : G.md;
  const estPrep = (md) => { md.actualizar(); const L = [];
    for (const pz of md.pieles) { const x = md.A[pz.i], d = DATA.ms[x.m], B = d && binDe(d); if (!d || d.sk === undefined || !B) continue;
      const dv = new DataView(B.buffer, B.byteOffset), n = d.v, pos = new Float32Array(n * 3), J = new Uint8Array(n * 4), Wt = new Float32Array(n * 4); let y0 = Infinity, y1 = -Infinity;
      for (let v = 0; v < n; v++) { const o = d.o + v * 14; for (let c = 0; c < 3; c++) pos[v * 3 + c] = d.mn[c] + dv.getUint16(o + c * 2, true) / 65535 * d.sc[c]; y0 = Math.min(y0, pos[v * 3 + 1]); y1 = Math.max(y1, pos[v * 3 + 1]);
        for (let k = 0; k < 4; k++) { J[v * 4 + k] = dv.getUint8(d.sk + v * 8 + k); Wt[v * 4 + k] = dv.getUint8(d.sk + v * 8 + 4 + k) / 255; } }
      const sold = new Int32Array(n), mp = new Map(); let ns = 0; for (let v = 0; v < n; v++) { const k = Math.round(pos[v * 3] * 1e4) + ',' + Math.round(pos[v * 3 + 1] * 1e4) + ',' + Math.round(pos[v * 3 + 2] * 1e4); let s2 = mp.get(k); if (s2 === undefined) { s2 = ns++; mp.set(k, s2); } sold[v] = s2; }
      const ix = (k) => (d.i32 ? dv.getUint32(d.i + k * 4, true) : dv.getUint16(d.i + k * 2, true)), E = new Map(), minL = 0.01 * (y1 - y0);
      for (const [st, cn] of d.sub) for (let t = st; t + 2 < st + cn; t += 3) for (let c = 0; c < 3; c++) { const a2 = ix(t + c), b2 = ix(t + (c + 1) % 3 + 0 * c), sa = sold[a2], sb = sold[b2]; if (sa === sb) continue; const k = sa < sb ? sa * 1e7 + sb : sb * 1e7 + sa; if (!E.has(k)) E.set(k, [a2, b2]); }
      const dom = (v) => { let b2 = 0, w = -1; for (let k = 0; k < 4; k++) if (Wt[v * 4 + k] > w) { w = Wt[v * 4 + k]; b2 = J[v * 4 + k]; } return [b2, w]; };
      const ed = [], L0 = [], rig = [], par = []; for (const [a2, b2] of E.values()) { const l = Math.hypot(pos[a2 * 3] - pos[b2 * 3], pos[a2 * 3 + 1] - pos[b2 * 3 + 1], pos[a2 * 3 + 2] - pos[b2 * 3 + 2]); if (l < minL) continue; ed.push(a2, b2); L0.push(l); const [ba, wa] = dom(a2), [bb, wb] = dom(b2); rig.push(ba === bb && wa >= 0.999 && wb >= 0.999 ? 1 : 0); par.push(ba < bb ? ba * 256 + bb : bb * 256 + ba); }
      L.push({ pz, pos, J, Wt, n, ed: Int32Array.from(ed), L0: Float32Array.from(L0), rig: Uint8Array.from(rig), par: Uint16Array.from(par), out: new Float32Array(n * 3), esc: 0 }); }
    return L; };
  const estL = estPrep(mdE);
  const estCuadro = (acc) => { mdE.actualizar();
    for (const m of estL) { const H = m.pz.h, { pos, J, Wt, out, n } = m;
      for (let v = 0; v < n; v++) { let x = 0, y = 0, z = 0; const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2];
        for (let k = 0; k < 4; k++) { const w = Wt[v * 4 + k]; if (!w) continue; const B = J[v * 4 + k] * 12; x += w * (H[B] * px + H[B + 1] * py + H[B + 2] * pz + H[B + 3]); y += w * (H[B + 4] * px + H[B + 5] * py + H[B + 6] * pz + H[B + 7]); z += w * (H[B + 8] * px + H[B + 9] * py + H[B + 10] * pz + H[B + 11]); }
        out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z; }
      const R = new Float32Array(m.L0.length); for (let e = 0; e < m.L0.length; e++) { const a2 = m.ed[e * 2], b2 = m.ed[e * 2 + 1]; R[e] = Math.hypot(out[a2 * 3] - out[b2 * 3], out[a2 * 3 + 1] - out[b2 * 3 + 1], out[a2 * 3 + 2] - out[b2 * 3 + 2]) / m.L0[e]; }
      // (la escala de la malla —el Hero viene en otras unidades—: la mediana de las rígidas en el primer cuadro)
      if (!m.esc) { const r = [...R].filter((x, e) => m.rig[e]).sort((a2, b2) => a2 - b2); m.esc = r.length ? r[r.length >> 1] : 1; }
      for (let e = 0; e < R.length; e++) { const r = R[e] / m.esc; if (m.rig[e]) { acc.rig = Math.max(acc.rig, Math.abs(r - 1)); continue; } if (r > 1.5 || r < 0.6) { const k = m.par[e]; acc.pares[k] = (acc.pares[k] || 0) + 1; } acc.h[Math.min(399, Math.max(0, Math.round(r * 100)))]++; acc.n++; if (r > acc.max) acc.max = r; if (r < acc.min) acc.min = r; } } };
  const pielCPU = () => {
    const { PB, S, Q, V, n, nb } = piel; for (let h = 0; h < nb; h++) m4mul(G.W[1 + h], PB[h], S[h]);
    for (let v = 0; v < n; v++) { let x = 0, y = 0, z = 0; const px = V.pos[v * 3], py = V.pos[v * 3 + 1], pz = V.pos[v * 3 + 2];
      for (let k = 0; k < 3; k++) { const w = V.w[v * 3 + k]; if (w <= 0) continue; const s = S[V.hb[v * 3 + k]]; x += w * (s[0] * px + s[4] * py + s[8] * pz + s[12]); y += w * (s[1] * px + s[5] * py + s[9] * pz + s[13]); z += w * (s[2] * px + s[6] * py + s[10] * pz + s[14]); }
      Q[v * 3] = x; Q[v * 3 + 1] = y; Q[v * 3 + 2] = z; }
  };
  // (un punto del mundo a la pose de reposo de un hueso: reposo = (mundo · p2b)⁻¹ · p)
  const inv4 = (a) => { const o = new Float32Array(16), r = [a[0], a[1], a[2], a[4], a[5], a[6], a[8], a[9], a[10]]; const t = [a[12], a[13], a[14]];
    // (rígida con escala uniforme: la inversa es la transpuesta / s², y la traslación −Rᵀt / s²)
    const s2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2] || 1;
    o[0] = r[0] / s2; o[1] = r[3] / s2; o[2] = r[6] / s2; o[4] = r[1] / s2; o[5] = r[4] / s2; o[6] = r[7] / s2; o[8] = r[2] / s2; o[9] = r[5] / s2; o[10] = r[8] / s2; o[15] = 1;
    o[12] = -(o[0] * t[0] + o[4] * t[1] + o[8] * t[2]); o[13] = -(o[1] * t[0] + o[5] * t[1] + o[9] * t[2]); o[14] = -(o[2] * t[0] + o[6] * t[1] + o[10] * t[2]); return o; };
  for (const [nom, dur, vel, emo] of ESC) {
    P.emote = null; P.agachado = false; P.suelo = true; P.vel.set(0, 0, 0);
    if (emo) { P.emote = nom; P.emoteT = 0; }
    const N = Math.round(dur / dt), R2 = { salto: 0, acel: 0, quien: '', e: { rig: 0, h: new Uint32Array(400), n: 0, max: 0, min: 9, pares: {} }, pen: { brazo: 0, pierna: 0, cuadros: 0 } };
    let hist = [];
    for (let f = 0; f < N; f++) {
      const fw = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
      if (nom === 'agachado') P.agachado = true;
      if (nom === 'saltar') { const c = f * dt % 0.8; P.suelo = c > 0.5; P.vel.set(0, P.suelo ? 0 : 3 - c * 8, 0); }
      else if (!emo) P.vel.set(fw.x * vel, 0, fw.z * vel);
      if (emo && P.emote !== nom) { P.emote = nom; P.emoteT = 0; }
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; TIEMPO.t += dt;
      animarPersona(P, dt); dibujarPersona(P);
      const raiz = v3(P.md.raiz[12], P.md.raiz[13], P.md.raiz[14]), act = NOM.map((n) => { const q = pos(n); return q ? vsub(q, raiz) : null; });
      if (f > 3) hist.push(act);
      if (f > 3) estCuadro(R2.e);
      if (piel && piel.pen && f > 3 && f % 2 === 0) {
        pielCPU(); const Q = piel.Q;
        {
          const { X, prof, zonaVox } = piel.pen, M = piel.M, Si = {}, deH = (h) => Si[h] || (Si[h] = inv4(piel.S[h]));
          let pb = 0, pp = 0;
          for (const v of piel.pen.brazos) for (const [h, l1, l2] of [[0, 0, 1], [2, 1, 2], [3, 2, 3]]) { const m = deH(h), x = Q[v * 3], y = Q[v * 3 + 1], z = Q[v * 3 + 2], r = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]], q = X.de(r[0], r[1], r[2]); if (q >= 0 && X.sol[q] && (piel.pen.lab[q] === l1 || piel.pen.lab[q] === l2) && prof[q] > pb) pb = prof[q]; }
          for (const [L, Ho] of [[piel.pen.pI, [18, 19]], [piel.pen.pD, [14, 15]]]) for (const v of L) for (const h of Ho) { const m = deH(h), x = Q[v * 3], y = Q[v * 3 + 1], z = Q[v * 3 + 2], r = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]], q = X.de(r[0], r[1], r[2]); const zz = q >= 0 ? zonaVox(q) : -1; if ((zz === 1 || zz === 2) && zz !== (Ho[0] === 18 ? 1 : 2) && prof[q] > pp) pp = prof[q]; }
          const cb = (pb - 0.5) * X.vs * 100, cp = (pp - 0.5) * X.vs * 100; R2.pen.brazo = Math.max(R2.pen.brazo, cb); R2.pen.pierna = Math.max(R2.pen.pierna, cp); if (cb > 2 || cp > 2) R2.pen.cuadros++;
          R2.pen.medidos = (R2.pen.medidos || 0) + 1;
        }
      }
    }
    // saltos: desplazamiento por cuadro (respecto de la raíz) y 2.ª diferencia
    for (let f = 1; f < hist.length; f++) for (let i = 0; i < NOM.length; i++) { const a = hist[f][i], b2 = hist[f - 1][i]; if (!a || !b2) continue; const d = vsub(a, b2).len() * 100; if (d > R2.salto) { R2.salto = d; R2.quien = NOM[i]; }
      if (f > 1 && hist[f - 2][i]) { const c = hist[f - 2][i], ac = Math.hypot(a.x - 2 * b2.x + c.x, a.y - 2 * b2.y + c.y, a.z - 2 * b2.z + c.z) * 100; if (ac > R2.acel) { R2.acel = ac; R2.quienA = NOM[i]; } } }
    R2.salto = +R2.salto.toFixed(1); R2.acel = +R2.acel.toFixed(1);
    { const E2 = R2.e, pc = (q) => { let c = 0; for (let i = 0; i < 400; i++) { c += E2.h[i]; if (c >= q * E2.n) return i / 100; } return 4; }; let m15 = 0; for (let i = 150; i < 400; i++) m15 += E2.h[i]; for (let i = 0; i <= 60; i++) m15 += E2.h[i];
      const nomH = (b2) => { const x = mdE.A[mdE.A[estL[0].pz.i].bo[b2]]; return x ? x.n.replace(/^.*[:]/, '') : '?'; };
      R2.est = { rigido: +(E2.rig * 100).toFixed(2), p99: pc(0.99), p999: pc(0.999), max: +E2.max.toFixed(2), min: +E2.min.toFixed(2), fuera: +(m15 / Math.max(1, E2.n) * 100).toFixed(3), pares: Object.entries(E2.pares).sort((a2, b2) => b2[1] - a2[1]).slice(0, 4).map(([k, c]) => nomH(k >> 8) + '-' + nomH(k & 255) + ':' + c) }; delete R2.e; }
    R2.pen.brazo = +Math.max(0, R2.pen.brazo).toFixed(1); R2.pen.pierna = +Math.max(0, R2.pen.pierna).toFixed(1);
    out.esc[nom] = R2;
  }
  out.alto = esHero ? 1.9 : G.def.restP[G.def.porMix.Head].y; out.nb = esHero ? null : G.def.nb;
  borrarPersona(P); TIEMPO.dt = dt0; return out;
}; return 1; })()`);
if (process.env.CFG) await ev(`Object.assign(PJI.cfg, ${process.env.CFG}); 1`);
if (process.env.ESC) await ev(`window.__esc = ${JSON.stringify(process.env.ESC.split(','))}; 1`);
const hero = await ev(`JSON.parse(JSON.stringify(__pjiMed('Hero', null)))`);
console.log('Hero (referencia):', JSON.stringify(Object.fromEntries(Object.entries(hero.esc).map(([k, v]) => [k, [v.salto, v.acel, v.quien, v.est]]))));
const tabla = [];
for (const [nom, arch] of MODELOS) {
  const r = await ev(`(async () => { try {
    const fs = []; for (const u of ${JSON.stringify(arch.map((f) => MOD + '/' + f))}) { const r = await fetch(u); if (!r.ok) continue; fs.push(new File([await r.arrayBuffer()], u.split('/').pop())); }
    const t0 = performance.now(); const ses = await pjiProcesar(fs); const t1 = performance.now(); pjiSesArmar(ses); const t2 = performance.now();
    PJI.defs.set(ses.clave, ses.def); window.__ses = ses;
    const m = __pjiMed(pjiSkin(ses.clave), ses);
    return JSON.parse(JSON.stringify({ propio: ses.usarPropio, nv: ses.Nm.pos.length / 3, nb: ses.rig.huesos.length, alto: +ses.alto.toFixed(2), leer: Math.round(t1 - t0), rig: Math.round(t2 - t1), m }));
  } catch (e) { return { error: String(e && e.stack || e).slice(0, 600) }; } })()`);
  if (r.error) { ok(nom + ': se importa', false, r.error); continue; }
  const k = r.alto / 1.9, esc = r.m.esc, mx = (f) => Math.max(...Object.values(esc).map(f));
  // contra el Hero en la misma animación: lo que salta de más (cm)
  const deMas = Object.fromEntries(Object.entries(esc).map(([a, v]) => [a, +(v.salto - hero.esc[a].salto * Math.max(1, k)).toFixed(1)]));
  const deMasA = Object.fromEntries(Object.entries(esc).map(([a, v]) => [a, +(v.acel - hero.esc[a].acel * Math.max(1, k)).toFixed(1)]));
  const fila = { nom, propio: r.propio, nv: r.nv, nb: r.nb, alto: r.alto, leer_ms: r.leer, rig_ms: r.rig, salto: mx((v) => v.salto), saltoDeMas: Math.max(...Object.values(deMas)), acelDeMas: Math.max(...Object.values(deMasA)),
    rigido: mx((v) => v.est.rigido), p99: mx((v) => v.est.p99), p99Hero: Math.max(...Object.values(hero.esc).map((v) => v.est.p99)), max: mx((v) => v.est.max), maxHero: Math.max(...Object.values(hero.esc).map((v) => v.est.max)),
    fuera: mx((v) => v.est.fuera), fueraHero: Math.max(...Object.values(hero.esc).map((v) => v.est.fuera)),
    penBrazo: mx((v) => v.pen.brazo), penPierna: mx((v) => v.pen.pierna), penCuadros: Object.values(esc).reduce((a, v) => a + v.pen.cuadros, 0), medidos: Object.values(esc).reduce((a, v) => a + (v.pen.medidos || 0), 0) };
  tabla.push(fila); fs.writeFileSync(`${D}/medidas_${nom}.json`, JSON.stringify({ fila, esc, deMas, deMasA }, null, 1));
  ok(`${nom}: armado (${r.propio ? 'su esqueleto' : 'rig automático'}), ${r.nv} vértices, leer ${r.leer} ms + rig ${r.rig} ms`, r.m.ok);
  // (contra el Hero, animación por animación: los saltos de verdad son aceleraciones —un hueso que cambia de golpe—; la
  // velocidad de un pie al correr depende de las proporciones y no es un salto)
  const peorEst = Object.entries(esc).map(([a, v]) => [a, v.est.fuera, hero.esc[a].est.fuera, v.est.p99, hero.esc[a].est.p99]).filter(([, f, fh]) => f > Math.max(fh * 1.5, fh + 1));
  ok(`${nom}: lo rígido no se estira (aristas con las dos puntas 100 % en un hueso, como la mano y los dedos: ≤ 1 %)`, fila.rigido <= 1, fila.rigido);
  ok(`${nom}: ningún hueso acelera de golpe más de 3 cm por cuadro² de lo que acelera el Hero en la misma animación`, fila.acelDeMas <= 3, deMasA);
  ok(`${nom}: en cada animación, las articulaciones no se estiran más que las del Hero (aristas fuera de 0,6-1,5: ≤ 1,5 veces las del Hero, o 1 punto más)`, !peorEst.length, peorEst.length ? peorEst : Object.fromEntries(Object.entries(esc).map(([a, v]) => [a, [v.est.fuera, hero.esc[a].est.fuera]])));
  const penC = ['quieto', 'caminar', 'correr'].map((a) => esc[a] ? Math.max(esc[a].pen.brazo, esc[a].pen.pierna) : 0);
  if (fila.medidos) ok(`${nom}: quieto, caminando y corriendo, los antebrazos y las manos no entran más de 3 cm en el torso ni una pierna en la otra`, Math.max(...penC) <= 3, { quietoCaminarCorrer: penC, todas: { brazo: fila.penBrazo, pierna: fila.penPierna, cuadros: fila.penCuadros + '/' + fila.medidos } });
  // capturas desde la cámara de la partida en tercera persona: el personaje puesto, caminando y corriendo
  if (process.env.FOTOS !== '0') {
    await ev(`(() => { const s = window.__ses; PREFS.skin = pjiSkin(s.clave); jugadorCuerpoNuevo(); JUG.tercera = true; JUG.pitch = 0.18; return 1; })()`);
    await p.waitForTimeout(800);
    for (const [a, tecla, sh] of [['camina', 'w', false], ['corre', 'w', true]]) {
      if (sh) await p.keyboard.down('Shift'); await p.keyboard.down(tecla); await p.waitForTimeout(900);
      await p.screenshot({ path: `${D}/3p_${nom}_${a}.jpg`, type: 'jpeg', quality: 78 });
      await p.keyboard.up(tecla); if (sh) await p.keyboard.up('Shift'); await p.waitForTimeout(300);
    }
    await ev(`emote('ChickenDance'); 1`); await p.waitForTimeout(1200); await p.screenshot({ path: `${D}/3p_${nom}_emote.jpg`, type: 'jpeg', quality: 78 });
    await ev(`JUG.cuerpo.emote = null; 1`);
  }
}
console.log('\nTABLA ' + JSON.stringify(tabla));
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|aborted/i.test(x)); ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
