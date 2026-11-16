// ---------------------------------------------------------------------------------------------------------
// las armas de JXMod (3.9): pedido del dueño, «el juego ahora sí debe ser único». Primero se hizo una Physics Gun entera
// en código y al dueño no le gustó en primera persona («está horrible: modificá la de Half-Life quitando y agregando
// cosas»): queda la de GMod con sus brazos y sus animaciones, pero pintada de amarillo JXMod (las manos con guantes
// oscuros), sin sus garras y con piezas propias en sus huesos (el núcleo y su anillo en la boca, garras nuevas que siguen
// la animación, luces en los tubos). Por dentro es la misma arma (el mismo nombre y lo que hace): las partidas, los
// servers y los addons andan igual. Las de GMod y Half-Life tal cual quedan en el mod de la comunidad «Armas clásicas»,
// que viene instalado y apagado: prendido, se ven ésas.
// Las piezas que se agregan: cajas biseladas, cilindros, anillos y esferas, de tamaño 1 (se escalan al ponerlas).
// ---------------------------------------------------------------------------------------------------------
const AJX = { modelos: {}, mats: null, t: 0 };

// ---------------- el kit de modelado ----------------
const ajxNuevo = () => ({ P: [], N: [], U: [], I: [] });
function ajxVert(B, p, n, u, v) { B.P.push(p.x, p.y, p.z); B.N.push(n.x, n.y, n.z); B.U.push(u, v); return B.P.length / 3 - 1; }
function ajxTri(B, a, b, c) { B.I.push(a, b, c); }
// una base (dos ejes perpendiculares a d)
function ajxBase(d) { const a = Math.abs(d.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), x = vcross(a, d).norm(), y = vcross(d, x).norm(); return [x, y]; }
// cilindro (o cono truncado) de a a b, radios r0 y r1, con tapas; seg lados; suave (normales que siguen la curva)
function ajxCil(B, a, b, r0, r1, seg, tapas, fase) {
  const d = vsub(b, a), L = d.len(); d.norm(); const [ex, ey] = ajxBase(d), n = seg || 16, f0 = fase || 0;
  const k0 = B.P.length / 3, inc = (r0 - r1) / L;   // (la normal de un cono se inclina hacia la punta)
  for (let i = 0; i <= n; i++) {
    const t = f0 + i / n * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), rad = vadd(vscale(ex, c), vscale(ey, s)), nn = vadd(rad, vscale(d, inc)).norm();
    ajxVert(B, vadd(a, vscale(rad, r0)), nn, i / n * 2 * Math.PI * r0 / 0.1, 0); ajxVert(B, vadd(b, vscale(rad, r1)), nn, i / n * 2 * Math.PI * r1 / 0.1, L / 0.1);
  }
  for (let i = 0; i < n; i++) { const p = k0 + i * 2; ajxTri(B, p, p + 2, p + 1); ajxTri(B, p + 1, p + 2, p + 3); }
  if (tapas) for (const [o, r, s] of [[a, r0, -1], [b, r1, 1]]) {
    if (r <= 1e-5) continue; const nn = vscale(d, s), c0 = ajxVert(B, o, nn, 0.5, 0.5), k = B.P.length / 3;
    for (let i = 0; i <= n; i++) { const t = f0 + i / n * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t); ajxVert(B, vadd(o, vadd(vscale(ex, c * r), vscale(ey, sn * r))), nn, 0.5 + c * 0.5, 0.5 + sn * 0.5); }
    for (let i = 0; i < n; i++) s > 0 ? ajxTri(B, c0, k + i, k + i + 1) : ajxTri(B, c0, k + i + 1, k + i);
  }
}
// anillo (toro) alrededor del eje d en c: radio R y grosor r
function ajxToro(B, c, d, R, r, s1, s2) {
  d = d.clone().norm(); const [ex, ey] = ajxBase(d), n1 = s1 || 24, n2 = s2 || 10, k0 = B.P.length / 3;
  for (let i = 0; i <= n1; i++) {
    const t = i / n1 * Math.PI * 2, rad = vadd(vscale(ex, Math.cos(t)), vscale(ey, Math.sin(t))), cc = vadd(c, vscale(rad, R));
    for (let j = 0; j <= n2; j++) { const u = j / n2 * Math.PI * 2, nn = vadd(vscale(rad, Math.cos(u)), vscale(d, Math.sin(u))).norm(); ajxVert(B, vadd(cc, vscale(nn, r)), nn, i / n1 * 4, j / n2); }
  }
  for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) { const a = k0 + i * (n2 + 1) + j, b = a + n2 + 1; ajxTri(B, a, b, a + 1); ajxTri(B, a + 1, b, b + 1); }
}
// esfera
function ajxEsfera(B, c, r, seg) {
  const n = seg || 14, k0 = B.P.length / 3;
  for (let i = 0; i <= n; i++) { const th = i / n * Math.PI; for (let j = 0; j <= n * 2; j++) { const ph = j / (n * 2) * Math.PI * 2, nn = v3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); ajxVert(B, vadd(c, vscale(nn, r)), nn, j / (n * 2), i / n); } }
  for (let i = 0; i < n; i++) for (let j = 0; j < n * 2; j++) { const a = k0 + i * (n * 2 + 1) + j, b = a + n * 2 + 1; ajxTri(B, a, a + 1, b); ajxTri(B, a + 1, b + 1, b); }
}
// caja biselada: centro, medios lados h [x, y, z], giro q y bisel e (los filos cortados a 45°: las caras chicas en los
// filos y triángulos en las esquinas, cada uno con su normal)
function ajxCaja(B, c, h, q, e) {
  q = q || new Quat(); e = Math.min(e === undefined ? 0.004 : e, h[0] * 0.45, h[1] * 0.45, h[2] * 0.45);
  const E = [q.rot(v3(1, 0, 0)), q.rot(v3(0, 1, 0)), q.rot(v3(0, 0, 1))];
  // (el punto de la esquina (sx, sy, sz) metido e en los ejes que no son 'a')
  const P = (sx, sy, sz, a) => { const s = [sx, sy, sz], o = [0, 1, 2].map((k) => s[k] * (k === a ? h[k] : h[k] - e)); return vadd(c, vadd(vscale(E[0], o[0]), vadd(vscale(E[1], o[1]), vscale(E[2], o[2])))); };
  const quad = (p0, p1, p2, p3, n) => { const k = B.P.length / 3, w = p0.distTo(p1) / 0.1, hh = p0.distTo(p3) / 0.1; ajxVert(B, p0, n, 0, 0); ajxVert(B, p1, n, w, 0); ajxVert(B, p2, n, w, hh); ajxVert(B, p3, n, 0, hh);
    if (vdot(vcross(vsub(p1, p0), vsub(p2, p0)), n) < 0) { ajxTri(B, k, k + 2, k + 1); ajxTri(B, k, k + 3, k + 2); } else { ajxTri(B, k, k + 1, k + 2); ajxTri(B, k, k + 2, k + 3); } };
  const tri = (p0, p1, p2, n) => { const k = B.P.length / 3; ajxVert(B, p0, n, 0, 0); ajxVert(B, p1, n, 1, 0); ajxVert(B, p2, n, 0, 1); if (vdot(vcross(vsub(p1, p0), vsub(p2, p0)), n) < 0) ajxTri(B, k, k + 2, k + 1); else ajxTri(B, k, k + 1, k + 2); };
  // las 6 caras
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const b = (a + 1) % 3, cc = (a + 2) % 3, pt = (i, j) => { const v = [0, 0, 0]; v[a] = s; v[b] = i; v[cc] = j; return P(v[0], v[1], v[2], a); };
    quad(pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1), vscale(E[a], s));
  }
  // los 12 filos (entre la cara a y la b, a lo largo de c)
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) { const cc = 3 - a - b; for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const pt = (sc, de) => { const v = [0, 0, 0]; v[a] = sa; v[b] = sb; v[cc] = sc; return P(v[0], v[1], v[2], de); };
    quad(pt(-1, a), pt(1, a), pt(1, b), pt(-1, b), vadd(vscale(E[a], sa), vscale(E[b], sb)).norm());
  } }
  // las 8 esquinas
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) tri(P(sx, sy, sz, 0), P(sx, sy, sz, 1), P(sx, sy, sz, 2), vadd(vscale(E[0], sx), vadd(vscale(E[1], sy), vscale(E[2], sz))).norm());
}
const ajxQ = (ax, ay, az) => Quat.euler(ay || 0, ax || 0, az || 0);   // (giros en radianes: x arriba/abajo, y a los costados)

// ---------------- los materiales ----------------
function ajxMats() {
  if (AJX.mats) return AJX.mats;
  AJX.mats = {
    amarillo: matPropio('ajxAmarillo', [0.95, 0.62, 0.05], { pbr: [0.32, 0.15, 0.05] }),   // (pintura: el amarillo de JXMod)
    negro: matPropio('ajxNegro', [0.035, 0.037, 0.042], { pbr: [0.45, 0.35, 0.05] }),
    metal: matPropio('ajxMetal', [0.22, 0.23, 0.25], { pbr: [0.28, 0.95, 0.05] }),
    acero: matPropio('ajxAcero', [0.55, 0.56, 0.58], { pbr: [0.2, 1, 0.05] }),
    goma: matPropio('ajxGoma', [0.02, 0.02, 0.022], { pbr: [0.85, 0, 0.04] }),
    cobre: matPropio('ajxCobre', [0.72, 0.38, 0.18], { pbr: [0.3, 1, 0.05] }),
    brillo: matPropio('ajxBrillo', [1, 0.72, 0.18], { pbr: [0.3, 0, 0.04], em: [5.5, 3.4, 0.6] }),   // (lo que brilla: ámbar)
    brilloSuave: matPropio('ajxBrilloS', [1, 0.6, 0.15], { pbr: [0.4, 0, 0.04], em: [1.6, 0.9, 0.15] }),
    vidrio: matPropio('ajxVidrio', [0.05, 0.06, 0.07], { pbr: [0.06, 0.3, 0.06] }),
    azul: matPropio('ajxAzul', [0.35, 0.85, 1], { pbr: [0.3, 0, 0.04], em: [0.9, 3.6, 5.2] }),   // (lo que brilla: el celeste de la Physics Gun)
    azulSuave: matPropio('ajxAzulS', [0.3, 0.8, 1], { pbr: [0.35, 0, 0.04], em: [0.25, 1.3, 2] }),
    grafito: matPropio('ajxGrafito', [0.075, 0.08, 0.09], { pbr: [0.34, 0.75, 0.05] }),
  };
  return AJX.mats;
}


// ---------------- las piezas que se agregan (mallas de tamaño 1, una vez) ----------------
const AJX_PIEZAS = {};
function ajxPieza(nom) {
  const x = AJX_PIEZAS[nom]; if (x && R.mallas[x]) return x;
  const B = ajxNuevo(), V = v3;
  if (nom === 'esfera') ajxEsfera(B, V(0, 0, 0), 1, 14);
  else if (nom === 'anillo') ajxToro(B, V(0, 0, 0), V(0, 0, 1), 1, 0.16, 32, 10);   // (alrededor de z)
  else if (nom === 'aro') ajxToro(B, V(0, 0, 0), V(0, 0, 1), 1, 0.07, 36, 8);
  else if (nom === 'barra') ajxCaja(B, V(0, 0, 0.5), [0.5, 0.5, 0.5], null, 0.18);   // (de z=0 a z=1)
  else if (nom === 'placa') { const n = V(0, 0, 1); [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]].forEach(([x, y, u, v]) => ajxVert(B, V(x, y, 0), n, u, v)); ajxTri(B, 0, 1, 2); ajxTri(B, 0, 2, 3); }
  return (AJX_PIEZAS[nom] = mallaPropia(B));
}
// poner una pieza: su centro y sus tres ejes (con el tamaño)
function ajxPoner(pieza, mat, c, X, Y, Z) { const id = ajxPieza(pieza); if (mat === null || mat === undefined) return; encolar(id, 0, mat, Float32Array.from([X.x, X.y, X.z, 0, Y.x, Y.y, Y.z, 0, Z.x, Z.y, Z.z, 0, c.x, c.y, c.z, 1]), null, null); }
function ajxEjes(z, u) { z = z.clone().norm(); let y = vsub(u, vscale(z, vdot(u, z))); if (y.len() < 1e-5) y = ajxBase(z)[1]; y.norm(); return [vcross(y, z).norm(), y, z]; }
// una barra de a a b (su z) con ancho w y alto h (el alto hacia u)
function ajxEntre(pieza, mat, a, b, w, h, u) { const d = vsub(b, a), L = d.len(); if (L < 1e-5) return; const [x, y, z] = ajxEjes(d, u); ajxPoner(pieza, mat, a, vscale(x, w), vscale(y, h), vscale(z, L)); }
// centrada en c, de radio r, su z hacia z
function ajxEn(pieza, mat, c, r, z, u) { const [x, y, zz] = ajxEjes(z, u); ajxPoner(pieza, mat, c, vscale(x, r), vscale(y, r), vscale(zz, r)); }

// ---------------- la marca: el logo de JXMod, celeste, para pegar en el arma ----------------
// (del logo del juego: las letras claras se quedan —con sus siluetas de adentro— y lo oscuro se recorta)
function ajxLogo() {
  const k = TX_PROPIA + 7900;
  if (AJX.logoMat !== undefined && R.tex[k]) return AJX.logoMat;
  if (AJX.logoCv) {   // (la textura se perdió: de nuevo, del lienzo que ya está)
    const gl = R.gl, tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, AJX.logoCv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    R.tex[k] = { gl: tx };
    if (AJX.logoMat === undefined) { const id = matPropio('ajxLogo', [1, 1, 1], { pbr: [0.3, 0, 0.04] }), m = R.mats[id]; m.tex = k; m.cut = true; m.unlit = true; m.claveBase = ',CUT,UNLIT,'; m.claveGam = ',CUT,UNLIT'; AJX.logoMat = id; }
    return AJX.logoMat;
  }
  if (AJX.logoPide) return null; AJX.logoPide = true;
  const im = new Image(), el = document.querySelector('#carga .dLogo img'), src = window.__logoOrig || (el && el.src);
  if (!src) return null;
  im.onload = () => {
    try {
      const W = 512, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
      // (adentro de la chapa del logo: las letras; centradas, con su proporción)
      const sx = im.naturalWidth * 0.035, sy = im.naturalHeight * 0.1, sw = im.naturalWidth * 0.93, sh = im.naturalHeight * 0.8, h = H * 0.86, w = Math.min(W * 0.96, h * sw / sh);
      g.drawImage(im, sx, sy, sw, sh, (W - w) / 2, (H - h) / 2, w, h);
      const d = g.getImageData(0, 0, W, H), p = d.data;
      for (let i = 0; i < p.length; i += 4) { const l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255 * (p[i + 3] / 255); const a = Math.max(0, Math.min(1, (l - 0.5) * 6)); p[i] = 200; p[i + 1] = 246; p[i + 2] = 255; p[i + 3] = a * 255; }
      g.putImageData(d, 0, 0); AJX.logoCv = cv;
    } catch (e) { AJX.logoCv = null; }
  };
  im.src = src; return null;
}

// ---------------- qué arma se modifica y cómo ----------------
// tintes: por material de la malla (el arma azul acero —lo celeste sigue brillando— y las manos como están); quitar: las
// piezas de esos huesos; mundo: el tinte del modelo de la mano del personaje y del ícono
const AJX_ARMAS = {
  fisica: { tintes: [[0.48, 0.72, 1.15, 0.62]], quitar: ['Prong_A', 'Prong_B', 'Doodad_4', 'Doodad_1'], mundo: [0.48, 0.72, 1.15, 0.62] },
};
// ¿se ven las de JXMod? (con el mod de la comunidad «Armas clásicas» prendido, las de GMod tal cual)
const ajxActivas = () => !(typeof MODS !== 'undefined' && MODS.armasClasicas);
const ajxDeArma = (n) => { const D = typeof DEF_ARMAS !== 'undefined' && DEF_ARMAS[n]; return D && D.jx && ajxActivas() ? D.jx : null; };
// una copia de una malla con piel sin algunas piezas: las piezas sueltas (lo conectado, por sus triángulos y por los vértices
// en el mismo lugar) cuyo hueso principal es uno de los que se quitan. Sin achicar huesos: así no quedan puntas estiradas
function ajxMallaSin(mi, bo, A, nombres) {
  const clave = mi + ':' + nombres.join(','), T = AJX.sin || (AJX.sin = {}); if (T[clave] !== undefined && R.mallas[T[clave]]) return T[clave];
  const m = mallaGL(mi), mc = m && mallaCPU(mi); if (!m || !mc || m.d.sk === undefined) return mi;
  const d = m.d, BIN = binDe(d), dv = new DataView(BIN.buffer, BIN.byteOffset), nv = d.v, P = mc.P, quita = new Uint8Array(nv);
  for (let k = 0; k < nv; k++) { const q = d.sk + k * 8; let jb = 0, wb = -1; for (let j = 0; j < 4; j++) if (BIN[q + 4 + j] > wb) { wb = BIN[q + 4 + j]; jb = BIN[q + j]; } const bi = bo[jb]; quita[k] = bi >= 0 && A[bi] && nombres.includes(A[bi].n) ? 1 : 0; }
  const par = new Int32Array(nv); for (let k = 0; k < nv; k++) par[k] = k;
  const raiz = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }, une = (a, b) => { a = raiz(a); b = raiz(b); if (a !== b) par[a] = b; };
  const pos = new Map(); for (let k = 0; k < nv; k++) { const c = Math.round(P[k * 3] * 1e4) + ',' + Math.round(P[k * 3 + 1] * 1e4) + ',' + Math.round(P[k * 3 + 2] * 1e4), o = pos.get(c); if (o === undefined) pos.set(c, k); else une(k, o); }
  const ix = (q) => (d.i32 ? dv.getUint32(d.i + q * 4, true) : dv.getUint16(d.i + q * 2, true));
  for (const [s0, sn] of d.sub) for (let q = s0; q < s0 + sn; q += 3) { une(ix(q), ix(q + 1)); une(ix(q + 1), ix(q + 2)); }
  const n = new Map(); for (let k = 0; k < nv; k++) { const r = raiz(k), c = n.get(r) || [0, 0]; c[0]++; c[1] += quita[k]; n.set(r, c); }
  const fuera = (k) => { const c = n.get(raiz(k)); return c[1] * 2 > c[0]; };
  const I = [], sub = [];
  for (const [s0, sn] of d.sub) { const i0 = I.length; for (let q = s0; q < s0 + sn; q += 3) { const a = ix(q); if (!fuera(a)) I.push(a, ix(q + 1), ix(q + 2)); } sub.push([i0, I.length - i0]); }
  const gl = R.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, 14, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.BYTE, true, 14, 6);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, R.gl1 ? gl.UNSIGNED_SHORT : gl.HALF_FLOAT, false, 14, 10);
  if (m.sb) { gl.bindBuffer(gl.ARRAY_BUFFER, m.sb); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, false, 8, 0); gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 8, 4); }
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.i32 ? new Uint32Array(I) : new Uint16Array(I), gl.STATIC_DRAW);
  gl.bindVertexArray(null); R.vaoAct = null;
  const id = ID_PROPIO + GEO.malla++;
  R.mallas[id] = Object.assign({}, m, { vao, ib, d: Object.assign({}, d, { sub }), cpuS: undefined, sinDe: mi });
  AJX.quitados = (d.sub.reduce((a, s) => a + s[1], 0) - I.length) / 3;
  return (T[clave] = id);
}
// la vista (primera persona) de un arma de GMod modificada: en lugar de md.encolar(); false si no es de las nuestras
function ajxGmVista(v, nombre) {
  const md = v && v.md; if (!md) return false;
  const jx = ajxDeArma(nombre), C = jx && AJX_ARMAS[jx];
  if (!v.ajx) { v.ajx = { h: {}, abre: 0 }; md.A.forEach((n, i) => { if (v.ajx.h[n.n] === undefined) v.ajx.h[n.n] = i; }); }
  const h = v.ajx.h;
  if (!C) { md.tintes = null; md.mCambio = null; return false; }   // (con las clásicas: tal cual)
  // quitar: algunos fierros (las garras grandes y sus brazos), con la malla sin esas piezas
  if (C.quitar.length) { const c = md.mCambio || (md.mCambio = {}); md.A.forEach((x, i) => { if (x.bo && x.m !== undefined && x.m >= 0) c[i] = ajxMallaSin(x.m, x.bo, md.A, C.quitar); }); }
  if (AJX.vistaPrueba) AJX.vistaPrueba(md, h);   // (las pruebas: verla de otro lado)
  md.tintes = C.tintes; md.encolar();
  if (AJX.sinPiezas || h.Base === undefined || h.Muzzle === undefined) return true;   // (las pruebas: sin lo agregado)
  ajxFisicaPiezas(v, md, h);
  return true;
}
// lo que se agrega a la Physics Gun, en el marco de su hueso Base (u: arriba, f: adelante, s: al costado que se ve; en
// unidades de L, del Base a la boca): el emisor nuevo, tres garras que se abren al agarrar y la aleta con la marca
function ajxFisicaPiezas(v, md, h) {
  const M = ajxMats(), t = TIEMPO.t, W = md.W, B = W[h.Base], o = v3(B[12], B[13], B[14]);
  const U = v3(B[0], B[1], B[2]).norm(), F = v3(B[4], B[5], B[6]).norm(), S = v3(B[8], B[9], B[10]).norm();
  const boca = v3(W[h.Muzzle][12], W[h.Muzzle][13], W[h.Muzzle][14]), L = boca.distTo(o);
  const P = (c, u, f, s) => v3(c.x + (U.x * u + F.x * f + S.x * s) * L, c.y + (U.y * u + F.y * f + S.y * s) * L, c.z + (U.z * u + F.z * f + S.z * s) * L);
  const dt = Math.min(0.1, TIEMPO.dt || 0.016), meta = ARM.agarre ? 1 : 0; v.ajx.abre += (meta - v.ajx.abre) * Math.min(1, dt * 9); const k = v.ajx.abre;
  // el emisor: un aro grueso de grafito, un aro celeste y el núcleo que late (más fuerte agarrando)
  const late = 1 + 0.12 * Math.sin(t * 7) + 0.3 * k;
  ajxEn('anillo', M.grafito, P(boca, 0, 0.0, 0), L * 0.27, F, U);
  ajxEn('aro', M.azul, P(boca, 0, 0.07, 0), L * 0.2, F, U);
  ajxEn('esfera', M.azul, P(boca, 0, 0.1, 0), L * 0.085 * late, F, U);
  // las garras: tres, alrededor de la boca (una arriba y dos abajo a los costados), con la punta celeste
  for (let g = 0; g < 3; g++) {
    const an = g * 2.0944, R1 = v3(U.x * Math.cos(an) + S.x * Math.sin(an), U.y * Math.cos(an) + S.y * Math.sin(an), U.z * Math.cos(an) + S.z * Math.sin(an));
    const at = (f, r) => v3(boca.x + (F.x * f + R1.x * r) * L, boca.y + (F.y * f + R1.y * r) * L, boca.z + (F.z * f + R1.z * r) * L);
    const a = at(-0.16, 0.26), b = at(0.2, 0.38 + 0.08 * k), c = at(0.46, 0.24 + 0.14 * k), d = at(0.55, 0.19 + 0.13 * k);
    ajxEntre('barra', M.grafito, a, b, L * 0.1, L * 0.07, R1);
    ajxEntre('barra', M.metal, b, c, L * 0.085, L * 0.06, R1);
    ajxEntre('barra', M.azul, c, d, L * 0.06, L * 0.045, R1);
  }
  // la aleta de arriba, con el logo de JXMod a los dos lados y una línea celeste en el borde
  const al = AJX.aleta || [0.27, -0.2, 0.62, 0.18, 0.08];   // (alto del centro, de dónde a dónde, alto, grosor)
  ajxEntre('barra', M.grafito, P(o, al[0], al[1], 0), P(o, al[0], al[2], 0), L * al[4], L * al[3], U);
  ajxEntre('barra', M.azulSuave, P(o, al[0] + al[3] / 2, al[1] + 0.05, 0), P(o, al[0] + al[3] / 2, al[2] - 0.05, 0), L * al[4] * 0.55, L * 0.02, U);
  const lm = ajxLogo();
  if (lm) for (const sg of [1, -1]) {
    const n = vscale(S, sg), lg = (al[2] - al[1]) * 0.86, cx = P(o, al[0], (al[1] + al[2]) / 2, sg * (al[4] / 2 + 0.003)), X = vcross(U, n).norm();
    ajxPoner('placa', lm, cx, vscale(X, L * lg), vscale(U, L * lg / 4), n);
  }
}
// en la mano del personaje: el modelo de GMod con el mismo color
function ajxGmMundo(md, nombre) { const jx = ajxDeArma(nombre), C = jx && AJX_ARMAS[jx]; md.tinte = C ? C.mundo : null; }

// ---------------- el ícono: el de GMod con el color del arma (para la barra y el menú) ----------------
function ajxIconoTenido(src, tinte, listo) {
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), p = d.data, a = tinte[3];
      for (let i = 0; i < p.length; i += 4) { const l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) * 1.15; p[i] += (Math.min(255, l * tinte[0]) - p[i]) * a; p[i + 1] += (Math.min(255, l * tinte[1]) - p[i + 1]) * a; p[i + 2] += (Math.min(255, l * tinte[2]) - p[i + 2]) * a; }
      g.putImageData(d, 0, 0); listo(c.toDataURL('image/png'));
    } catch (e) { listo(null); }
  };
  im.onerror = () => listo(null); im.src = src;
}
// ---------------- los sonidos: hechos acá (síntesis), sin los de Half-Life ni GMod ----------------
// El zumbido de sostener (un segundo que se repite sin corte: dos tonos con un leve batido y un ronroneo), el de sacarla
// (un chasquido y una subida corta) y el de soltar (una bajada). Se arman una vez, cuando ya hay sonido.
const AJX_SON = { fisica: { sS: 'JX_FisSacar', sSuelta: 'JX_FisSuelta', sSosten: 'JX_FisSosten' } };
function ajxSonidos() {
  if (typeof AUD === 'undefined' || !AUD.ctx || AJX.sonListos) return; AJX.sonListos = true;
  const c = AUD.ctx, sr = c.sampleRate, hacer = (nom, seg, f) => { const b = c.createBuffer(1, Math.round(sr * seg), sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = f(i / sr, i); AUD.buf[nom] = b; };
  // (sostener: 1 s exacto, frecuencias con ciclos enteros en un segundo para que el bucle no tenga costura)
  hacer('JX_FisSosten', 1, (t) => { const w = 2 * Math.PI; return 0.22 * Math.sin(w * 96 * t) + 0.12 * Math.sin(w * 192 * t + 0.4) + 0.08 * Math.sin(w * 291 * t) * (0.6 + 0.4 * Math.sin(w * 6 * t)) + 0.05 * Math.sin(w * 588 * t) * Math.sin(w * 3 * t); });
  hacer('JX_FisSacar', 0.32, (t, i) => { const env = Math.min(1, t / 0.005) * Math.exp(-t * 11), f = 260 + 900 * Math.min(1, t / 0.16); return env * (0.4 * Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sign(Math.sin(2 * Math.PI * f * 0.5 * t)) * Math.exp(-t * 30) + (i < sr * 0.004 ? (Math.random() * 2 - 1) * 0.5 : 0)); });
  hacer('JX_FisSuelta', 0.22, (t) => { const env = Math.min(1, t / 0.004) * Math.exp(-t * 16), f = 820 - 620 * Math.min(1, t / 0.18); return env * (0.45 * Math.sin(2 * Math.PI * f * t) + 0.15 * Math.sin(2 * Math.PI * f * 2.01 * t)); });
}
// al empezar: el ícono y los sonidos de cada arma propia (y los de antes, para volver con las clásicas)
function ajxAplicar() {
  if (typeof DEF_ARMAS === 'undefined') return;
  ajxSonidos();
  for (const n in DEF_ARMAS) {
    const D = DEF_ARMAS[n]; if (!D.jx) continue;
    if (D.icClasico === undefined) D.icClasico = D.ic;
    const S = AJX_SON[D.jx] || {}; if (!D.sonClasico) { D.sonClasico = {}; for (const k in S) D.sonClasico[k] = D[k]; }
    for (const k in S) D[k] = ajxActivas() ? S[k] : D.sonClasico[k];
    if (ajxActivas()) {
      if (!AJX.iconos) AJX.iconos = {};
      if (AJX.iconos[D.jx]) D.ic = AJX.iconos[D.jx];
      else if (!AJX.iconoPide && AJX_ARMAS[D.jx] && AJX_ARMAS[D.jx].mundo && typeof DATA !== 'undefined' && DATA && DATA.ico && icono(D.icClasico)) {
        AJX.iconoPide = true; ajxIconoTenido(icono(D.icClasico), AJX_ARMAS[D.jx].mundo, (u) => { AJX.iconoPide = false; if (!u) return; AJX.iconos[D.jx] = u; if (ajxActivas()) { D.ic = u; if (typeof hudArma === 'function' && ARM.lista.length && JUEGO.estado === 'juego') hudArma(); } });
      }
    } else D.ic = D.icClasico;
  }
}
setTimeout(ajxAplicar, 0);
