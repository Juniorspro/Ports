// ---------------- gorros nuevos, hechos con geometría (sin archivos: pesan nada) ----------------
// Se agregan a los del juego (debajo del contenedor Hats del jugador, como los otros): de copa, gorra, de lana, corona,
// aureola, cuernos, orejas de conejo, de chef y casco vikingo. Cada uno con sus materiales (el color que se elige en
// Personajes los tiñe), su ícono dibujado desde el mismo modelo, y se ven igual en la red (va el nombre, como los otros).
// Medidas en metros en el marco del gorro: y arriba, la base del gorro a la altura de la frente, z adelante.
const GN = { hecho: false, ico: {} };
// (una malla con varias partes, cada parte con su material)
function gnMalla() { return { P: [], N: [], U: [], S: [] }; }
function gnParte(g) { g.S.push([]); return g.S.length - 1; }
function gnV(g, p, n, u, v) { g.P.push(p[0], p[1], p[2]); const l = Math.hypot(n[0], n[1], n[2]) || 1; g.N.push(n[0] / l, n[1] / l, n[2] / l); g.U.push(u || 0, v || 0); return g.P.length / 3 - 1; }
// (superficie de revolución alrededor de y: prof [[r, y], ...] de abajo hacia arriba; cada tramo con su normal: bordes duros)
function gnTorno(g, s, prof, seg = 28, c = [0, 0, 0], esc = [1, 1, 1]) {
  for (let i = 0; i + 1 < prof.length; i++) {
    const [r0, y0] = prof[i], [r1, y1] = prof[i + 1], dr = r1 - r0, dy = y1 - y0, nr = dy, ny = -dr, base = g.P.length / 3;
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      for (const [r, y] of [[r0, y0], [r1, y1]]) gnV(g, [c[0] + r * ca * esc[0], c[1] + y * esc[1], c[2] + r * sa * esc[2]], [nr * ca / esc[0], ny / esc[1], nr * sa / esc[2]], k / seg, y);
    }
    for (let k = 0; k < seg; k++) { const a = base + k * 2, b = a + 1, d = a + 2, e = a + 3; if (Math.abs(r0) + Math.abs(r1) < 1e-6) continue; g.S[s].push(a, d, b, b, d, e); }
  }
}
// (elipsoide, entero o una franja de latitudes: de0..a0 en radianes desde arriba)
function gnEsfera(g, s, c, rad, seg = 20, ani = 12, de0 = 0, a0 = Math.PI) {
  const base = g.P.length / 3;
  for (let j = 0; j <= ani; j++) {
    const t = de0 + (a0 - de0) * (j / ani), st = Math.sin(t), ct = Math.cos(t);
    for (let k = 0; k <= seg; k++) { const a = (k / seg) * Math.PI * 2, x = st * Math.cos(a), z = st * Math.sin(a), y = ct; gnV(g, [c[0] + x * rad[0], c[1] + y * rad[1], c[2] + z * rad[2]], [x / rad[0], y / rad[1], z / rad[2]], k / seg, j / ani); }
  }
  for (let j = 0; j < ani; j++) for (let k = 0; k < seg; k++) { const a = base + j * (seg + 1) + k, b = a + seg + 1; g.S[s].push(a, a + 1, b, b, a + 1, b + 1); }
}
// (tubo que sigue una curva de puntos con radios: cuernos, orejas)
function gnTubo(g, s, pts, radios, seg = 10) {
  const base = g.P.length / 3, n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], tl = Math.hypot(...t) || 1; t[0] /= tl; t[1] /= tl; t[2] /= tl;
    let u = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let x = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]]; const xl = Math.hypot(...x); x = x.map((v) => v / xl);
    const y = [t[1] * x[2] - t[2] * x[1], t[2] * x[0] - t[0] * x[2], t[0] * x[1] - t[1] * x[0]], r = radios[i];
    for (let k = 0; k <= seg; k++) { const an = (k / seg) * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an), nn = [x[0] * ca + y[0] * sa, x[1] * ca + y[1] * sa, x[2] * ca + y[2] * sa]; gnV(g, [pts[i][0] + nn[0] * r, pts[i][1] + nn[1] * r, pts[i][2] + nn[2] * r], nn, k / seg, i / (n - 1)); }
  }
  for (let i = 0; i + 1 < n; i++) for (let k = 0; k < seg; k++) { const a = base + i * (seg + 1) + k, b = a + seg + 1; g.S[s].push(a, b, a + 1, a + 1, b, b + 1); }
}
const gnToro = (g, s, c, R, r, seg = 36) => { const pts = [], rs = []; for (let k = 0; k <= seg; k++) { const a = (k / seg) * Math.PI * 2; pts.push([c[0] + Math.cos(a) * R, c[1], c[2] + Math.sin(a) * R]); rs.push(r); } gnTubo(g, s, pts, rs, 10); };
const gnCurva = (p0, p1, p2, n = 10) => { const L = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; L.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], a * p0[2] + b * p1[2] + c * p2[2]]); } return L; };
// (una cúpula: media esfera achatada que cubre la cabeza)
const gnCupula = (g, s, r, alto, y0 = 0, seg = 28) => { const prof = []; for (let i = 0; i <= 9; i++) { const t = (i / 9) * Math.PI / 2; prof.push([Math.cos(t) * r, y0 + Math.sin(t) * alto]); } prof.push([0, y0 + alto]); gnTorno(g, s, prof, seg); };
// las recetas: partes con color [r,g,b] (0-1), brillo y metal
const GN_RECETAS = {
  HatTop: { m: [[[0.06, 0.06, 0.07], 0.35, 0], [[0.62, 0.08, 0.1], 0.3, 0]], f(g) { const a = gnParte(g), b = gnParte(g);
    gnTorno(g, a, [[0, 0], [0.155, 0], [0.155, 0.012], [0.09, 0.014], [0.09, 0.19], [0, 0.19]]); gnTorno(g, b, [[0.0905, 0.016], [0.0905, 0.048]]); } },
  HatCap: { m: [[[0.12, 0.33, 0.78], 0.25, 0], [[0.95, 0.95, 0.95], 0.2, 0]], f(g) { const a = gnParte(g), b = gnParte(g);
    gnCupula(g, a, 0.112, 0.118, 0);
    // (la visera: media elipse para adelante, un poco inclinada para abajo, con espesor)
    for (const [yy, ny] of [[0.014, 1], [0.006, -1]]) { const c = gnV(g, [0, yy, 0.06], [0, ny, 0]); const L = []; for (let k = 0; k <= 16; k++) { const an = Math.PI * (k / 16); L.push(gnV(g, [Math.cos(an) * 0.11, yy - Math.sin(an) * 0.025, 0.06 + Math.sin(an) * 0.11], [0, ny, 0.15 * ny])); } for (let k = 0; k < 16; k++) g.S[a].push(...(ny > 0 ? [c, L[k + 1], L[k]] : [c, L[k], L[k + 1]])); }
    gnEsfera(g, b, [0, 0.118, 0], [0.012, 0.008, 0.012], 10, 5, 0, Math.PI / 2); } },
  HatBeanie: { m: [[[0.78, 0.14, 0.16], 0.05, 0], [[0.96, 0.95, 0.92], 0.05, 0]], f(g) { const a = gnParte(g), b = gnParte(g);
    gnCupula(g, a, 0.11, 0.14, 0.025); gnTorno(g, a, [[0.114, -0.005], [0.119, 0.012], [0.114, 0.034]]); gnEsfera(g, b, [0, 0.175, 0], [0.033, 0.03, 0.033], 14, 9); } },
  HatCrown: { m: [[[0.98, 0.76, 0.2], 0.7, 0.3], [[0.85, 0.1, 0.18], 0.8, 0]], f(g) { const a = gnParte(g), b = gnParte(g), y = 0.06;
    gnTorno(g, a, [[0.092, y], [0.092, y + 0.045], [0.086, y + 0.045], [0.086, y]], 32);
    for (let k = 0; k < 8; k++) { const an = (k / 8) * Math.PI * 2, x = Math.cos(an) * 0.09, z = Math.sin(an) * 0.09; gnTubo(g, a, [[x, y + 0.04, z], [x * 1.02, y + 0.075, z * 1.02], [x * 1.04, y + 0.105, z * 1.04]], [0.022, 0.012, 0.001], 6); gnEsfera(g, b, [x * 1.04, y + 0.025, z * 1.04], [0.012, 0.012, 0.012], 8, 5); } } },
  HatHalo: { m: [[[1, 0.88, 0.35], 0.9, 0.4]], e: true, f(g) { const a = gnParte(g); gnToro(g, a, [0, 0.17, 0], 0.095, 0.011); } },
  HatHorns: { m: [[[0.72, 0.06, 0.06], 0.4, 0]], f(g) { const a = gnParte(g);
    for (const sg of [1, -1]) gnTubo(g, a, gnCurva([sg * 0.055, 0.045, 0.02], [sg * 0.12, 0.08, 0.03], [sg * 0.12, 0.17, 0.0], 12), [...Array(13)].map((_, i) => 0.028 * (1 - i / 12) + 0.002), 10); } },
  HatBunny: { m: [[[0.97, 0.97, 0.97], 0.1, 0], [[0.98, 0.62, 0.72], 0.1, 0]], f(g) { const a = gnParte(g), b = gnParte(g);
    { const pts = [], rs = []; for (let k = 0; k <= 20; k++) { const an = Math.PI * (k / 20); pts.push([Math.cos(an) * 0.106, 0.035 + Math.sin(an) * 0.075, -0.005]); rs.push(0.006); } gnTubo(g, a, pts, rs, 8); }
    for (const sg of [1, -1]) { gnEsfera(g, a, [sg * 0.042, 0.2, -0.005], [0.028, 0.095, 0.012], 14, 10); gnEsfera(g, b, [sg * 0.042, 0.2, 0.004], [0.016, 0.075, 0.006], 12, 8); } } },
  HatChef: { m: [[[0.98, 0.98, 0.97], 0.15, 0]], f(g) { const a = gnParte(g);
    gnTorno(g, a, [[0.104, 0], [0.108, 0.07], [0, 0.07]]);
    gnEsfera(g, a, [0, 0.13, 0], [0.125, 0.075, 0.125], 22, 12);
    for (let k = 0; k < 6; k++) { const an = (k / 6) * Math.PI * 2; gnEsfera(g, a, [Math.cos(an) * 0.07, 0.16, Math.sin(an) * 0.07], [0.055, 0.045, 0.055], 12, 8); } } },
  HatViking: { m: [[[0.6, 0.61, 0.65], 0.6, 0.35], [[0.93, 0.89, 0.78], 0.3, 0], [[0.45, 0.32, 0.17], 0.4, 0.2]], f(g) { const a = gnParte(g), b = gnParte(g), c = gnParte(g);
    gnCupula(g, a, 0.114, 0.125, 0.005); gnTorno(g, c, [[0.117, -0.004], [0.121, 0.006], [0.121, 0.028], [0.117, 0.036]], 32);
    gnTubo(g, c, [[0, 0.03, 0.119], [0, 0.075, 0.11], [0, 0.118, 0.07], [0, 0.13, 0.0]], [0.008, 0.008, 0.008, 0.008], 6);
    for (const sg of [1, -1]) gnTubo(g, b, gnCurva([sg * 0.095, 0.06, 0], [sg * 0.17, 0.08, 0.02], [sg * 0.17, 0.2, 0.06], 12), [...Array(13)].map((_, i) => 0.03 * (1 - i / 12) + 0.002), 10); } },
};
// el ícono: el modelo de frente y un poco de costado, con luz, dibujado en un canvas (como los íconos de los otros)
function gnIcono(g, cols) {
  const L = 96, cv = document.createElement('canvas'); cv.width = cv.height = L; const x = cv.getContext('2d'); if (!x) return '';
  const ay = -0.5, ax = 0.32, cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const tr = (i) => { const p = [g.P[i * 3], g.P[i * 3 + 1], g.P[i * 3 + 2]]; const X = p[0] * cy + p[2] * sy, Z0 = -p[0] * sy + p[2] * cy, Y = p[1] * cx - Z0 * sx, Z = p[1] * sx + Z0 * cx; return [X, Y, Z]; };
  const n = g.P.length / 3, T = []; let mn = [1e9, 1e9], mx = [-1e9, -1e9];
  const V = []; for (let i = 0; i < n; i++) { const v = tr(i); V.push(v); mn = [Math.min(mn[0], v[0]), Math.min(mn[1], v[1])]; mx = [Math.max(mx[0], v[0]), Math.max(mx[1], v[1])]; }
  const k = (L * 0.82) / Math.max(mx[0] - mn[0], mx[1] - mn[1]), ox = L / 2 - ((mn[0] + mx[0]) / 2) * k, oy = L / 2 + ((mn[1] + mx[1]) / 2) * k;
  const luz = [0.35, 0.65, 0.68];
  g.S.forEach((S, si) => { for (let t = 0; t < S.length; t += 3) { const a = V[S[t]], b = V[S[t + 1]], c = V[S[t + 2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nl = Math.hypot(...nn) || 1;
    T.push({ z: (a[2] + b[2] + c[2]) / 3, a, b, c, l: Math.abs((nn[0] * luz[0] + nn[1] * luz[1] + nn[2] * luz[2]) / nl), si }); } });
  T.sort((p, q) => q.z - p.z);   // (de atrás hacia adelante)
  for (const t of T) { const col = cols[t.si] || cols[0], f = 0.35 + 0.65 * t.l, s = (v) => Math.round(Math.min(255, Math.pow(v, 1 / 2.2) * 255 * f));
    x.fillStyle = x.strokeStyle = `rgb(${s(col[0])},${s(col[1])},${s(col[2])})`; x.lineWidth = 0.6; x.beginPath();
    x.moveTo(ox + t.a[0] * k, oy - t.a[1] * k); x.lineTo(ox + t.b[0] * k, oy - t.b[1] * k); x.lineTo(ox + t.c[0] * k, oy - t.c[1] * k); x.closePath(); x.fill(); x.stroke(); }
  try { return cv.toDataURL('image/png'); } catch (e) { return ''; }
}
// se agregan una vez, cuando están los datos del juego
function gorrosNuevos() {
  if (GN.hecho || typeof DATA === 'undefined' || !DATA || !DATA.hats || typeof gmMallaNueva !== 'function') return;
  const arb = typeof arbolJugador === 'function' ? arbolJugador() : null; if (!arb) return;
  const hats = arb.findIndex((n) => n.n === 'Hats' && arb[n.pa] && arb[n.pa].n === 'CharactersRoot'); if (hats < 0) return;
  GN.hecho = true;
  const molde = arb.find((n) => n.pa === hats && n.m !== undefined && n.m >= 0) || {};
  for (const [nom, R] of Object.entries(GN_RECETAS)) {
    if (DATA.hats.includes(nom)) continue;
    try {
      const g = gnMalla(); R.f(g); if (!g.P.length) continue;
      const mi = gmMallaNueva('GN_' + nom, new Float32Array(g.P), new Float32Array(g.N), new Float32Array(g.U), g.S, false);
      const mats = R.m.map(([c, brillo, metal], k) => { const i = DATA.mt.length; DATA.mt.push({ n: 'GN_' + nom + '_' + k, sh: 'Standard', c: [c[0], c[1], c[2], 1], f: { _Mode: 0, _Glossiness: brillo, _Metallic: metal }, ...(R.e ? { e: [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6] } : {}) }); return i; });
      arb.push(Object.assign({}, molde, { n: nom, pa: hats, p: [0, 0.1, 0.012], r: [0, 0, 0, 1], s: [1, 1, 1], m: mi, mt: mats, bo: undefined }));
      DATA.hats.push(nom); GN.ico[nom] = gnIcono(g, R.m.map((x) => x[0]));
    } catch (e) { if (typeof console !== 'undefined') console.warn('gorro ' + nom, e); }
  }
}
