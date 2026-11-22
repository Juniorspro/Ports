// ---------------------------------------------------------------------------------------------------------
// las armas de JXMod: la Physics Gun, la Gravity Gun, la Tool Gun y la palanca son las de GMod ENTERAS (con sus brazos,
// sus animaciones y todas sus piezas), pintadas con los colores de JXMod: el cuerpo grafito y los acentos ámbar —el
// amarillo del menú— en la Physics Gun, la Tool Gun y la palanca, y celeste en la Gravity Gun (así no se confunden).
// Historia: en la 3.9 primero se hizo una entera en código («está horrible») y después la de GMod con piezas pegadas
// (garras nuevas, un núcleo, una aleta con el logo JXM); el dueño: «muy feo los modelos propios nuestros… el cartel JXM
// sobre la Physics Gun». Ahora no se les saca ni se les pega nada: sólo pintura en dos tonos (el shader, gl.js: lo gris
// de la textura con un color y lo de color con otro, que además brilla) y el rayo con cuerpo del mismo ámbar.
// Por dentro es la misma arma (el mismo nombre y lo que hace): las partidas, los servers y los addons andan igual. Las
// de GMod tal cual quedan en el mod de la comunidad «Armas clásicas» (instalado y apagado).
// ---------------------------------------------------------------------------------------------------------
const AJX = { t: 0 };

// ---------------- la pintura ----------------
// Cada una: [cuerpo [r, g, b, cuánto], acentos [r, g, b, cuánto], [brillo r, g, b, desde qué saturación es acento]]
// (los colores multiplican el brillo de la textura: más de 1 para que un acento oscuro, como la pintura roja de la
// palanca, quede amarillo). Se eligió entre grafito con ámbar, acero con celeste y negro con amarillo, con capturas.
const AJX_PALETA = {
  fisica: [[0.62, 0.66, 0.74, 0.85], [2.9, 1.75, 0.32, 1], [0.22, 0.13, 0.02, 0.14]],
  gravedad: [[0.62, 0.66, 0.74, 0.85], [0.75, 1.9, 2.6, 1], [0.12, 0.42, 0.62, 0.14]],
  tool: [[0.62, 0.66, 0.74, 0.8], [2.9, 1.9, 0.35, 1], [0.25, 0.15, 0.02, 0.14]],
  palanca: [[0.55, 0.58, 0.64, 0.6], [4.6, 3.1, 0.55, 1], [0.1, 0.06, 0, 0.1]],
};
// qué materiales de cada modelo se pintan (en su orden; el 523 de todas son las manos y el 526 de la Tool Gun, su pantalla)
const AJX_MATS = { fisica: [1, 0], gravedad: [0, 1], tool: [1, 0, 1, 1, 0], palanca: [1, 0, 1] };
// tintes: por material de la malla de la vista; mundo: el del modelo en la mano del personaje y el del ícono
const AJX_ARMAS = {};
for (const k in AJX_MATS) AJX_ARMAS[k] = { tintes: AJX_MATS[k].map((x) => (x ? AJX_PALETA[k] : null)), mundo: AJX_PALETA[k] };
// ¿se ven las de JXMod? (con el mod de la comunidad «Armas clásicas» prendido, las de GMod tal cual)
const ajxActivas = () => !(typeof MODS !== 'undefined' && MODS.armasClasicas);
const ajxDeArma = (n) => { const D = typeof DEF_ARMAS !== 'undefined' && DEF_ARMAS[n]; return D && D.jx && ajxActivas() ? D.jx : null; };
// la vista (primera persona) de un arma de GMod pintada: en lugar de md.encolar(); false si no es de las nuestras
function ajxGmVista(v, nombre) {
  const md = v && v.md; if (!md) return false;
  const jx = ajxDeArma(nombre), C = jx && AJX_ARMAS[jx];
  md.mCambio = null;
  if (!C) { md.tintes = null; return false; }   // (con las clásicas: tal cual)
  md.tintes = C.tintes; md.encolar();
  return true;
}
// en la mano del personaje: el modelo de GMod con la misma pintura
function ajxGmMundo(md, nombre) { const jx = ajxDeArma(nombre), C = jx && AJX_ARMAS[jx]; md.tinte = C ? C.mundo : null; }
// el color del rayo de la Physics Gun (ámbar la de JXMod; celeste, como en GMod, la clásica)
const ajxRayoColor = () => (ajxDeArma('PhysicsGun') ? [1, 0.74, 0.22, 0.95] : [0.35, 0.78, 1, 0.95]);

// ---------------- el rayo de la Physics Gun con cuerpo ----------------
// un tubo ámbar que brilla, por los puntos del rayo (se encola con el mundo, antes de armar la cola; el de una línea sola
// casi no se veía en pantallas grandes). El tubo: una malla de largo 1 y radio 1, una vez
// una base (dos ejes perpendiculares a d)
function ajxBase(d) { const a = Math.abs(d.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), x = vcross(a, d).norm(), y = vcross(d, x).norm(); return [x, y]; }
function ajxVert(B, p, n, u, v) { B.P.push(p.x, p.y, p.z); B.N.push(n.x, n.y, n.z); B.U.push(u, v); return B.P.length / 3 - 1; }
function ajxTri(B, a, b, c) { B.I.push(a, b, c); }
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
function ajxTubo() {
  if (AJX.tubo && R.mallas[AJX.tubo]) return AJX.tubo;
  const B = { P: [], N: [], U: [], I: [] }; ajxCil(B, v3(0, 0, 0), v3(0, 0, 1), 1, 1, 8, false, 0);
  return (AJX.tubo = mallaPropia(B));
}
function ajxEjes(z, u) { z = z.clone().norm(); let y = vsub(u, vscale(z, vdot(u, z))); if (y.len() < 1e-5) y = ajxBase(z)[1]; y.norm(); return [vcross(y, z).norm(), y, z]; }
function ajxMundoDibujar() {
  if (!ARM.agarre || JUEGO.estado !== 'juego' || !ajxDeArma(ARM.lista[ARM.i]) || typeof rayoFisicaPuntos !== 'function') return;
  const L = rayoFisicaPuntos(); if (!L) return;
  if (AJX.rayoMat === undefined || !R.mats[AJX.rayoMat]) AJX.rayoMat = matPropio('ajxRayo', [1, 0.72, 0.18], { pbr: [0.3, 0, 0.04], em: [5.5, 3.4, 0.6] });
  const id = ajxTubo(), up = v3(0, 1, 0), t = TIEMPO.t; R.encNs = true;   // (sin sombra)
  for (let i = 1; i < L.length; i++) {
    const a = L[i - 1], d = vsub(L[i], a), n = d.len(); if (n < 1e-4) continue;
    const r = 0.012 * (1 + 0.25 * Math.sin(t * 18 - i * 0.9)), [x, y, z] = ajxEjes(d, up), X = vscale(x, r), Y = vscale(y, r), Z = vscale(z, n * 1.02);
    encolar(id, 0, AJX.rayoMat, Float32Array.from([X.x, X.y, X.z, 0, Y.x, Y.y, Y.z, 0, Z.x, Z.y, Z.z, 0, a.x, a.y, a.z, 1]), null, null);
  }
  R.encNs = false;
}

// ---------------- el ícono: el de GMod con el color del arma (para la barra y el menú) ----------------
function ajxIconoTenido(src, tinte, listo) {
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => {
    try {
      const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      // (en dos tonos, como en el juego: lo gris con el color del cuerpo y lo de color con el de los acentos)
      // (los íconos de GMod son el modelo del mundo casi negro: se aclara —que lo más claro llegue a ~175— para que se vea)
      const d = g.getImageData(0, 0, W, H), p = d.data, T = Array.isArray(tinte[0]) ? tinte : [tinte, null, null];
      const [C0, C1, C2] = T, s0 = C2 ? C2[3] : 1, mz = (x, y, k) => x + (y - x) * k, ls = [];
      for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 128) ls.push(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]);
      ls.sort((a, b) => a - b); const ga = Math.min(2.6, Math.max(1, 175 / Math.max(1, ls[Math.floor(ls.length * 0.95)] || 175)));
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i], gg = p[i + 1], b = p[i + 2], l = (0.299 * r + 0.587 * gg + 0.114 * b) * 1.15 * ga, sat = (Math.max(r, gg, b) - Math.min(r, gg, b)) / 255;
        const kA = C1 ? Math.min(1, Math.max(0, (sat - s0) / 0.16)) : 0;
        for (let q = 0; q < 3; q++) { const v = Math.min(255, [r, gg, b][q] * ga), cu = mz(v, Math.min(255, l * C0[q]), C0[3]), ac = C1 ? mz(v, Math.min(255, l * C1[q]), C1[3]) : cu; p[i + q] = mz(cu, ac, kA); }
      }
      g.putImageData(d, 0, 0);
      // (y un halo del color de los acentos alrededor, como brillan en el juego —y los íconos de armas de HL2—)
      const o = document.createElement('canvas'); o.width = W; o.height = H; const go = o.getContext('2d');
      if (C1) { const m = Math.max(C1[0], C1[1], C1[2]), hx = C1.slice(0, 3).map((v) => Math.round(Math.min(1, v / m) * 255)); go.shadowColor = `rgba(${hx[0]},${hx[1]},${hx[2]},0.85)`; go.shadowBlur = Math.round(W * 0.06); go.drawImage(c, 0, 0); go.shadowBlur = Math.round(W * 0.025); }
      go.drawImage(c, 0, 0); listo(o.toDataURL('image/png'));
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
      else if (!(AJX.iconoPide || (AJX.iconoPide = {}))[D.jx] && AJX_ARMAS[D.jx] && AJX_ARMAS[D.jx].mundo && typeof DATA !== 'undefined' && DATA && DATA.ico && icono(D.icClasico)) {
        AJX.iconoPide[D.jx] = true; ajxIconoTenido(icono(D.icClasico), AJX_ARMAS[D.jx].mundo, (u) => { AJX.iconoPide[D.jx] = false; if (!u) return; AJX.iconos[D.jx] = u; if (ajxActivas()) { D.ic = u; if (typeof hudArma === 'function' && ARM.lista.length && JUEGO.estado === 'juego') hudArma(); } });
      }
    } else D.ic = D.icClasico;
  }
}
setTimeout(ajxAplicar, 0);
