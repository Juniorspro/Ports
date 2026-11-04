// ---------------- personajes que vienen como prop: ponérselos ----------------
// Muchos addons traen a su personaje sólo como muñeco o NPC (con el esqueleto de Valve, pero fuera de models/player/) o
// como prop quieto (un solo hueso, sin esqueleto). Los dos se pueden elegir como personaje:
//  · con esqueleto de Valve: van directo por gmod_pm.js (como un modelo de jugador);
//  · sin esqueleto (props con forma de persona: de pie, dos piernas separadas abajo): se les arma un esqueleto de Valve
//    por defecto, el mismo para todos, ajustado a la malla —la entrepierna, el ancho de cada pierna, el cuello donde la
//    malla se angosta, los brazos hasta la punta más lejana de cada lado— y cada vértice se reparte entre los huesos más
//    cercanos de su zona (las piernas por lado, los brazos por lado, el resto columna y cabeza). Después es un modelo de
//    jugador más: copia la pose del personaje del juego hueso por hueso.
const GMAR = { porAddon: new Map(), rigs: new Map(), escaneando: false };
const GMAR_FUERA = /(^models\/player\/)|(\/(v_|w_|c_|gibs?\/|.*_?gib\d|.*_anims?\b|hands?\b|arms?\b))/i;
// los modelos de un addon que se pueden poner: [{ r, tipo: 'vb' (con esqueleto) | 'auto' (rig automático) }]
function gmarDeAddon(A) {
  if (!A || !A.G || !A.G.archivos) return [];
  const k = String(A.id); if (GMAR.porAddon.has(k)) return GMAR.porAddon.get(k);
  const out = [];
  for (const r of A.G.archivos.keys()) {
    if (!/^models\/.+\.mdl$/i.test(r) || GMAR_FUERA.test(r)) continue;
    let M; try { const b = gmArchivo(r); if (!b) continue; M = GMF.mdl(b, null, null); } catch (e) { continue; }
    const H = M.huesos || [];
    if (H.some((h) => /^valvebiped\.bip01_pelvis$/i.test(h.n)) && H.some((h) => /^valvebiped\.bip01_l_thigh$/i.test(h.n)) && H.some((h) => /^valvebiped\.bip01_head1$/i.test(h.n))) { out.push({ r, tipo: 'vb' }); continue; }
    if (H.length > 2) continue;
    // (un prop quieto: primero la caja del modelo —de pie, más alto que hondo—, después la malla)
    const hl = M.hull, alto = hl ? (hl[1][2] - hl[0][2]) * GM_S : 0;
    if (hl && (alto < 0.25 || alto > 8)) continue;
    try { const Mg = gmLeerModelo(r); if (gmarEsPersona(Mg)) out.push({ r, tipo: 'auto' }); } catch (e) {}
  }
  GMAR.porAddon.set(k, out); return out;
}
function gmarTodos() { const L = []; if (typeof GMOD === 'undefined') return L; for (const A of GMOD.addons.values()) for (const x of gmarDeAddon(A)) L.push({ ...x, A }); return L; }
// ---- la forma: ejes del personaje (z arriba en Source; el costado es el eje horizontal más ancho a la altura del pecho) ----
function gmarEjes(V) {
  const n = V.n, P = V.pos; let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) { const z = P[i * 3 + 2]; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const h = z1 - z0; if (!(h > 0)) return null;
  // (los centros y anchos a la altura del pecho, 60-80 %)
  let ax = [Infinity, -Infinity], ay = [Infinity, -Infinity], cx = 0, cy = 0, m = 0;
  for (let i = 0; i < n; i++) { const z = (P[i * 3 + 2] - z0) / h; if (z < 0.6 || z > 0.8) continue; const x = P[i * 3], y = P[i * 3 + 1]; ax[0] = Math.min(ax[0], x); ax[1] = Math.max(ax[1], x); ay[0] = Math.min(ay[0], y); ay[1] = Math.max(ay[1], y); cx += x; cy += y; m++; }
  if (!m) return null;
  const latX = ax[1] - ax[0] > ay[1] - ay[0];   // (¿el costado es x?)
  // forward = el otro eje; su signo, por los pies (la punta del pie sale para adelante del tobillo); si no se nota, +x / -y
  const f = latX ? [0, 1] : [1, 0], l = latX ? [1, 0] : [0, 1];
  let pie = 0, tob = 0, np = 0, nt = 0;
  for (let i = 0; i < n; i++) { const z = (P[i * 3 + 2] - z0) / h, fw = P[i * 3] * f[0] + P[i * 3 + 1] * f[1]; if (z < 0.03) { pie += fw; np++; } else if (z < 0.12) { tob += fw; nt++; } }
  let sg = 1; if (np && nt) { const d = pie / np - tob / nt; if (Math.abs(d) > h * 0.012) sg = Math.sign(d); }
  const F = [f[0] * sg, f[1] * sg];
  // izquierda = arriba × adelante (Source: x adelante, y izquierda, z arriba)
  const Lz = [-F[1], F[0]];
  return { z0, h, c: [cx / m, cy / m], F, L: Lz, n };
}
// ¿un prop con forma de persona? De pie, con dos piernas separadas abajo (un hueco en el medio del costado) y el cuerpo
// unido arriba. (Así no entran botellas, lámparas ni árboles.)
function gmarEsPersona(M) {
  const V = M && M.v; if (!V || V.n < 120) return false;
  const E = gmarEjes(V); if (!E) return false;
  const P = V.pos, h = E.h, alto = h * GM_S; if (alto < 0.25 || alto > 8) return false;
  // (lo hondo: el cuerpo no puede ser una tabla ni un disco)
  let f0 = Infinity, f1 = -Infinity, l0 = Infinity, l1 = -Infinity;
  for (let i = 0; i < V.n; i++) { const x = P[i * 3], y = P[i * 3 + 1], fw = x * E.F[0] + y * E.F[1], lt = x * E.L[0] + y * E.L[1]; f0 = Math.min(f0, fw); f1 = Math.max(f1, fw); l0 = Math.min(l0, lt); l1 = Math.max(l1, lt); }
  if (h < 1.15 * (f1 - f0) || (l1 - l0) < 0.12 * h) return false;
  const pr = gmarPiernas(V, E); return !!pr;
}
// las piernas: en la franja de abajo (8-25 % del alto) los vértices quedan en dos grupos de costado con un hueco en el medio;
// la entrepierna es donde ese hueco se cierra
function gmarPiernas(V, E) {
  const P = V.pos, h = E.h, cl = E.c[0] * E.L[0] + E.c[1] * E.L[1], lat = (i) => P[i * 3] * E.L[0] + P[i * 3 + 1] * E.L[1] - cl;
  const franja = (za, zb) => { const L = []; for (let i = 0; i < V.n; i++) { const z = (P[i * 3 + 2] - E.z0) / h; if (z >= za && z < zb) L.push(lat(i)); } return L; };
  const L = franja(0.06, 0.22); if (L.length < 16) return null;
  let a = Infinity, b = -Infinity; for (const x of L) { if (x < a) a = x; if (x > b) b = x; }
  const ancho = b - a; if (ancho < 0.06 * h) return null;
  const NB = 24, hist = new Array(NB).fill(0); for (const x of L) hist[Math.min(NB - 1, Math.floor((x - a) / ancho * NB))]++;
  // (el hueco: bins vacíos cerca del medio, con piernas de los dos lados)
  const mid = NB >> 1; let g0 = -1, g1 = -1;
  for (let k = Math.floor(NB * 0.3); k <= Math.ceil(NB * 0.7); k++) if (hist[k] <= L.length * 0.004) { if (g0 < 0) g0 = k; g1 = k; }
  if (g0 < 0) return null;
  const izq = hist.slice(0, g0).reduce((s, x) => s + x, 0), der = hist.slice(g1 + 1).reduce((s, x) => s + x, 0);
  if (izq < L.length * 0.18 || der < L.length * 0.18) return null;
  const corte = a + ((g0 + g1 + 1) / 2) / NB * ancho;
  // el centro de cada pierna
  let si = 0, ni = 0, sd = 0, nd = 0; for (const x of L) { if (x < corte) { si += x; ni++; } else { sd += x; nd++; } }
  // la entrepierna: subiendo, la primera franja donde el medio tiene vértices
  let zc = 0.22;
  for (let z = 0.22; z < 0.7; z += 0.02) { const F2 = franja(z, z + 0.02); if (F2.some((x) => Math.abs(x - corte) < 0.025 * h)) { zc = z; break; } zc = z; }
  return { corte: corte + cl, li: si / ni + cl, ld: sd / nd + cl, zc };   // (en coordenadas de costado; li < ld)
}
// ---- el esqueleto por defecto y los pesos ----
function gmarRig(M) {
  const V = M.v, E = gmarEjes(V); if (!E) return null; const PR = gmarPiernas(V, E); if (!PR) return null;
  const P = V.pos, h = E.h, z0 = E.z0, F = E.F, L = E.L, cl = E.c[0] * L[0] + E.c[1] * L[1], cf = E.c[0] * F[0] + E.c[1] * F[1];
  // (de coordenadas del personaje —adelante, costado, alto— a las del modelo)
  const W = (fw, lt, z) => [F[0] * fw + L[0] * lt, F[1] * fw + L[1] * lt, z0 + z * h];
  const lat = (i) => P[i * 3] * L[0] + P[i * 3 + 1] * L[1], fwd = (i) => P[i * 3] * F[0] + P[i * 3 + 1] * F[1], alt = (i) => (P[i * 3 + 2] - z0) / h;
  // el costado izquierdo es +L: ¿la pierna "li" (menor) es la derecha? Sí: menor costado = derecha
  const zc = PR.zc, latD = PR.li, latI = PR.ld, latC = (latD + latI) / 2;
  // ancho del cuerpo por altura (el tramo central unido alrededor del medio) para el cuello y los hombros
  const anchoEn = (za, zb) => { const xs = []; for (let i = 0; i < V.n; i++) { const z = alt(i); if (z >= za && z < zb) xs.push(lat(i) - latC); } xs.sort((a, b) => a - b); if (xs.length < 4) return null;
    // (el tramo unido que contiene el 0: sin saltos de más del 4 % del alto)
    let k = xs.findIndex((x) => x >= 0); if (k < 0) k = xs.length - 1; let a = k, b = k; while (a > 0 && xs[a] - xs[a - 1] < 0.04 * h) a--; while (b < xs.length - 1 && xs[b + 1] - xs[b] < 0.04 * h) b++; return [xs[a], xs[b]]; };
  // el cuello: lo más angosto del cuerpo entre el 62 y el 94 % del alto (si no se angosta, al 82 %)
  let zn = 0.82, wmin = Infinity, wmed = []; for (let z = 0.62; z < 0.94; z += 0.02) { const a = anchoEn(z, z + 0.02); if (!a) continue; const w = a[1] - a[0]; wmed.push(w); if (w < wmin) { wmin = w; zn = z + 0.01; } }
  wmed.sort((a, b) => a - b); if (!(wmed.length && wmin < 0.85 * wmed[wmed.length >> 1])) zn = 0.82;
  zn = Math.max(zn, zc + 0.2);
  const zp = zc + 0.04, zhombro = Math.max(zp + 0.12, zn - 0.05), ah = anchoEn(zhombro - 0.06, zhombro) || [-0.12 * h, 0.12 * h];
  const hombro = Math.max(0.06 * h, Math.min(0.2 * h, Math.min(-ah[0], ah[1]) * 0.9));
  // la mano de cada lado: el vértice más lejano del hombro entre los que están más afuera que el hombro y arriba de la entrepierna
  const jHomI = [cf, latC + hombro, zhombro], jHomD = [cf, latC - hombro, zhombro];
  const mano = (s, jh) => { let best = null, bd = 0; for (let i = 0; i < V.n; i++) { const lt = lat(i) - latC; if (s * lt < hombro * 1.05 || alt(i) < zc) continue; const d = Math.hypot(fwd(i) - jh[0], lt + latC - jh[1], (alt(i) - jh[2]) * h / h); if (d > bd) { bd = d; best = [fwd(i), lt + latC, alt(i)]; } } return best; };
  const mi0 = mano(1, jHomI), md0 = mano(-1, jHomD);
  const brazo = (jh, tip, s) => { // (muñeca al 85 % del hombro a la punta; codo en el medio, un poco atrás)
    if (!tip || Math.hypot(tip[0] - jh[0], (tip[1] - jh[1]) / h, tip[2] - jh[2]) < 0.04) tip = [jh[0], jh[1] + s * 0.04 * h, Math.max(zc + 0.05, jh[2] - 0.3)];
    const mu = [jh[0] + (tip[0] - jh[0]) * 0.85, jh[1] + (tip[1] - jh[1]) * 0.85, jh[2] + (tip[2] - jh[2]) * 0.85];
    const co = [(jh[0] + mu[0]) / 2 - 0.02 * h, (jh[1] + mu[1]) / 2, (jh[2] + mu[2]) / 2]; return { co, mu, tip };
  };
  const BI = brazo(jHomI, mi0, 1), BD = brazo(jHomD, md0, -1);
  // las piernas: cadera a la altura de la entrepierna, tobillo abajo, rodilla en el medio un poco adelante
  const zt = Math.max(0.03, Math.min(0.08, zc * 0.12)), pierna = (lc) => ({ ca: [cf, lc, zc], ro: [cf + 0.015 * h, lc, (zc + zt) / 2], to: [cf, lc, zt], pu: [cf + 0.07 * h, lc, 0.01] });
  const PI_ = pierna(latI), PD = pierna(latD);
  const zs = (k) => zp + (zn - zp) * k, ztop = 1, zcab = zn + (ztop - zn) * 0.35;
  // los huesos (nombre, padre, posición en el modelo [adelante, costado, alto])
  const J = [['ValveBiped.Bip01_Pelvis', -1, [cf, latC, zp]], ['ValveBiped.Bip01_Spine', 0, [cf, latC, zs(0.18)]], ['ValveBiped.Bip01_Spine1', 1, [cf, latC, zs(0.38)]],
    ['ValveBiped.Bip01_Spine2', 2, [cf, latC, zs(0.58)]], ['ValveBiped.Bip01_Spine4', 3, [cf, latC, zs(0.8)]], ['ValveBiped.Bip01_Neck1', 4, [cf, latC, zn]], ['ValveBiped.Bip01_Head1', 5, [cf, latC, zcab]]];
  const lado = (v, B, Pn, s) => { const cla = J.length;
    J.push(['ValveBiped.Bip01_' + v + '_Clavicle', 4, [cf, latC + s * 0.03 * h, zhombro]], ['ValveBiped.Bip01_' + v + '_UpperArm', cla, s > 0 ? jHomI : jHomD], ['ValveBiped.Bip01_' + v + '_Forearm', cla + 1, B.co], ['ValveBiped.Bip01_' + v + '_Hand', cla + 2, B.mu]);
    const mu = J.length; J.push(['ValveBiped.Bip01_' + v + '_Thigh', 0, Pn.ca], ['ValveBiped.Bip01_' + v + '_Calf', mu, Pn.ro], ['ValveBiped.Bip01_' + v + '_Foot', mu + 1, Pn.to], ['ValveBiped.Bip01_' + v + '_Toe0', mu + 2, Pn.pu]); };
  lado('L', BI, PI_, 1); lado('R', BD, PD, -1);
  const pm = J.map((j) => W(j[2][0], j[2][1], j[2][2]));
  const huesos = J.map(([n, pa], i) => { const p = pm[i], q = pa >= 0 ? pm[pa] : [0, 0, 0];
    return { n, pa, pos: [p[0] - q[0], p[1] - q[1], p[2] - q[2]], q: [0, 0, 0, 1], rot: [0, 0, 0], p2b: [1, 0, 0, -p[0], 0, 1, 0, -p[1], 0, 0, 1, -p[2]], superficie: '', proc: null, auto: true }; });
  // ---- pesos: cada vértice entre los huesos de su zona, según la distancia a cada segmento (hueso → su punta) ----
  const ix = (n) => J.findIndex((j) => j[0] === 'ValveBiped.Bip01_' + n);
  const punta = {}; J.forEach(([n, pa], i) => { if (pa >= 0 && punta[pa] === undefined) punta[pa] = i; });
  // (las puntas que faltan: la mano a la punta del brazo, la cabeza arriba, el dedo del pie adelante)
  const pPunta = (i) => { const n = J[i][0]; if (/_Hand$/.test(n)) { const B = /_L_/.test(n) ? BI : BD; return W(B.tip[0], B.tip[1], B.tip[2]); } if (/Head1$/.test(n)) return W(cf, latC, 1); if (/Toe0$/.test(n)) { const p = pm[i]; return [p[0] + F[0] * 0.03 * h, p[1] + F[1] * 0.03 * h, p[2]]; } return pm[punta[i]]; };
  const seg = J.map((_, i) => [pm[i], pPunta(i)]);
  const dSeg = (p, s) => { const a = s[0], b = s[1], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1e-9; const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l2)); return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t); };
  const zona = { tronco: ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Spine4', 'Neck1', 'Head1', 'L_Clavicle', 'R_Clavicle', 'L_Thigh', 'R_Thigh'].map(ix) };
  for (const v of ['L', 'R']) { zona['b' + v] = ['Spine4', v + '_Clavicle', v + '_UpperArm', v + '_Forearm', v + '_Hand'].map(ix); zona['p' + v] = ['Pelvis', v + '_Thigh', v + '_Calf', v + '_Foot', v + '_Toe0'].map(ix); }
  const hb = new Uint8Array(V.n * 3), w = new Float32Array(V.n * 3), lmano = (B) => B.tip, eps = (0.02 * h) ** 2;
  for (let i = 0; i < V.n; i++) {
    const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], z = alt(i), lt = lat(i) - latC;
    let Z;
    if (z < zc - 0.015) Z = lat(i) > PR.corte ? zona.pL : zona.pR;                          // (piernas, por lado)
    else if (Math.abs(lt) > hombro * 0.95 && z > zc + 0.02) Z = lt > 0 ? zona.bL : zona.bR;  // (brazos, por lado)
    else Z = zona.tronco;
    const d = Z.map((j) => [j, dSeg(p, seg[j])]).sort((a, b) => a[1] - b[1]).slice(0, 3);
    const ws = d.map(([, x]) => 1 / ((x * x + eps) ** 2)), tot = ws.reduce((s, x) => s + x, 0);
    for (let k = 0; k < 3; k++) { hb[i * 3 + k] = d[k] ? d[k][0] : 0; w[i * 3 + k] = d[k] ? ws[k] / tot : 0; }
  }
  const M2 = Object.assign({}, M, { huesos, v: Object.assign({}, V, { hb, w }), secuencias: [], anims: [], autoRig: true });
  return M2;
}
function gmarTipo(r) { for (const L of GMAR.porAddon.values()) { const x = L.find((y) => y.r === r); if (x) return x.tipo; } return null; }
