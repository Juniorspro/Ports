// ---------------- identidad propia: las skins que venían del paquete original, con nombre y ropa nuevos ----------------
// Pedido (Discord): «no hay que darle identidad de Hypper Sandbox a las skins». Las 12 skins humanas heredadas (Hero,
// Soldier, Jean, Business, las dos de fuerzas especiales, Prisoner01, PilotFemale, Butcher, Swat, Military, Engineer) pasan
// a ser el equipo de JXMod: un nombre propio y la ropa teñida con una rampa de tres colores (sombra, medio y luz) según la
// luminancia de cada punto, así quedan los pliegues, costuras y bolsillos de la textura pero con otro color. En las
// texturas que tienen cara y ropa juntas, la piel no se toca. El retrato del menú se tiñe igual. Las de terror (Derik y
// Corpse) quedan como estaban. Por dentro la skin sigue llamándose igual (partidas guardadas, la red y los mods la nombran
// así): sólo cambia lo que se ve.
const IDS_RAMPA = {
  amarillo: ['#3b2a06', '#e8a514', '#fff0c2'], terracota: ['#2c1109', '#a8452e', '#f2b49c'], petroleo: ['#06201f', '#1f8577', '#b8efe5'],
  grafito: ['#0b0d10', '#2e333b', '#9aa3ad'], bordo: ['#120307', '#561424', '#b4606f'], artico: ['#3d4650', '#b9c3cc', '#ffffff'],
  violeta: ['#150b2c', '#5f3fb0', '#d9cbff'], cielo: ['#081a33', '#2f7fd6', '#d4e9ff'], musgo: ['#0c1608', '#4a6b2a', '#d3e6b5'],
  noche: ['#05070d', '#1d2b4a', '#8fa4cc'], duna: ['#2a1d0c', '#b08b52', '#f4e6c8'], fuego: ['#2a0b03', '#d4541f', '#ffd0b0'],
};
// por skin: el nombre y, por textura de su ropa (el nombre del material), la rampa, si hay piel suelta en esa textura (se
// reconoce por el color) y zonas que no se tocan (rectángulos en la imagen, de 0 a 1 desde arriba a la izquierda: la cara
// con el pelo, los brazos de piel morena que tienen el mismo tono que un mono naranja, las zapatillas)
const IDS_SKINS = {
  Hero: { n: 'Nico', r: 'amarillo', ret: 0.7, tex: { DI_Hero: { piel: true, zonas: [[0, 0.5, 0.86, 0.76]] } } },
  Soldier: { n: 'Brasa', r: 'terracota', ret: 0.7, tex: { body1Color2: {} } },
  Jean: { n: 'Tomi', r: 'petroleo', ret: 0.7, tex: { wonamman_Top_diffuse: {}, wonamman_Bottom_diffuse: { r: 'grafito' }, wonamman_Shoes_diffuse: { r: 'grafito' } } },
  Business: { n: 'Don Ferro', r: 'bordo', ret: 0.74, tex: { Delovoy_Top_diffuse: {}, Delovoy_Bottom_diffuse: {}, Delovoy_Shoes_diffuse: { r: 'grafito' } } },
  SpecialForcesW: { n: 'Vega', r: 'artico', ret: 0.87, tex: { Mat_SpecialForces_Suit: {} } },
  SpecialForcesM: { n: 'Rocco', r: 'artico', ret: 0.75, tex: { Mat_SpecialForces_Suit: {} } },
  Prisoner01: { n: 'Rulo', r: 'violeta', ret: 0.78, tex: { Mat_Prisoner_02_Body: { zonas: [[0, 0, 0.48, 0.47], [0.6, 0.04, 0.88, 0.21], [0.36, 0.88, 0.52, 1]] } } },
  PilotFemale: { n: 'Alas', r: 'cielo', ret: 0.74, tex: { Mat_F_Pilot_02_Suit: {} } },
  Butcher: { n: 'Carnicero', r: 'musgo', ret: 0.76, tex: { body2_Albedo: { piel: true } } },
  Swat: { n: 'Sombra', r: 'noche', ret: 0.72, tex: { DI_SWAT: { piel: true } } },
  Military: { n: 'Duna', r: 'duna', ret: 0.74, tex: { Soldier_body1: {} } },
  Engineer: { n: 'Chispa', r: 'fuego', ret: 0.82, tex: { Mat_Engineer_02_Body: {} } },
};
const IDS = { tex: null, ret: {}, listo: false, n: 0, ms: 0, off: Q.has('sinids') };   // (?sinids: como venían, para comparar)
const idsHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// (las texturas a teñir, por su número en el paquete: se arma la primera vez, con los materiales ya cargados)
function idsTabla() {
  if (IDS.tex) return IDS.tex;
  const T = {}, porNombre = {};
  for (const s in IDS_SKINS) for (const n in IDS_SKINS[s].tex) porNombre[n] = Object.assign({ r: IDS_SKINS[s].r }, IDS_SKINS[s].tex[n]);
  for (let i = 0; i < DATA.mt.length; i++) { const d = DATA.mt[i]; if (d && porNombre[d.n] && d.t != null && d.t >= 0 && !T[d.t]) T[d.t] = porNombre[d.n]; }
  return (IDS.tex = T);
}
// ¿es piel? (tonos de piel de claros a oscuros: rojizos a amarillentos, saturación media, no negros)
function idsPiel(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
  if (v < 0.13 || s < 0.14 || s > 0.82 || r < g || r < b) return false;
  const h = mx === mn ? 0 : mx === r ? (60 * ((g - b) / (mx - mn)) + 360) % 360 : 0;
  return h <= 48 && r - b > 14;
}
// teñir unos píxeles con una rampa: la luminancia (estirada entre el 4 % y el 96 % de la ropa) elige el color de la rampa,
// y se mezcla con el original un 12 % para no perder del todo los matices. salta(k, r, g, b): los que no se tocan
function idsTenir(px, rampa, salta, alfaMin, piso) {
  const R = IDS_RAMPA[rampa] || IDS_RAMPA.grafito, A = idsHex(R[0]), B = idsHex(R[1]), C = idsHex(R[2]), n = px.length / 4, hist = new Uint32Array(256), sel = new Uint8Array(n);
  let cuenta = 0;
  for (let k = 0; k < n; k++) { const o = k * 4; if (px[o + 3] < alfaMin || (salta && salta(k, px[o], px[o + 1], px[o + 2]))) continue; sel[k] = 1; hist[(px[o] * 77 + px[o + 1] * 150 + px[o + 2] * 29) >> 8]++; cuenta++; }
  if (!cuenta) return 0;
  let lo = 0, hi = 255, ac = 0; for (let l = 0; l < 256; l++) { ac += hist[l]; if (ac >= cuenta * 0.04) { lo = l; break; } }
  ac = 0; for (let l = 255; l >= 0; l--) { ac += hist[l]; if (ac >= cuenta * 0.04) { hi = l; break; } }
  const esc = 1 / Math.max(24, hi - lo);
  for (let k = 0; k < n; k++) {
    if (!sel[k]) continue;
    const o = k * 4, r = px[o], g = px[o + 1], b = px[o + 2], t0 = Math.min(1, Math.max(0, (((r * 77 + g * 150 + b * 29) >> 8) - lo) * esc)), t = piso ? piso + (1 - piso) * t0 : t0;
    let cr, cg, cb; if (t < 0.5) { const u = t * 2; cr = A[0] + (B[0] - A[0]) * u; cg = A[1] + (B[1] - A[1]) * u; cb = A[2] + (B[2] - A[2]) * u; } else { const u = t * 2 - 1; cr = B[0] + (C[0] - B[0]) * u; cg = B[1] + (C[1] - B[1]) * u; cb = B[2] + (C[2] - B[2]) * u; }
    px[o] = cr * 0.88 + r * 0.12; px[o + 1] = cg * 0.88 + g * 0.12; px[o + 2] = cb * 0.88 + b * 0.12;
  }
  return cuenta;
}
// lo que no se toca en una textura: sus zonas (el lienzo está dado vuelta: la fila 0 es la de abajo de la imagen) y, si
// tiene piel suelta, lo que tenga color de piel
function idsSaltaTex(e, w, h) {
  const Z = (e.zonas || []).map(([x0, y0, x1, y1]) => [x0 * w, (1 - y1) * h, x1 * w, (1 - y0) * h]);
  return (k, r, g, b) => { const x = k % w, y = (k / w) | 0; for (const z of Z) if (x >= z[0] && x < z[2] && y >= z[1] && y < z[3]) return true; return !!e.piel && idsPiel(r, g, b); };
}
// en los retratos: la piel es la del color de la cara de ese personaje (se mide en el centro del retrato: el tono —la
// proporción entre rojo, verde y azul— cerca del de la cara, más clara o más oscura). Así un cuello moreno no se confunde
// con un mono naranja, que tiene otro tono aunque los dos sean «anaranjados»
function idsSaltaCara(px, w, h) {
  const L = [];
  for (let y = Math.floor(h * 0.3); y < h * 0.55; y++) for (let x = Math.floor(w * 0.38); x < w * 0.62; x++) { const o = (y * w + x) * 4; if (px[o + 3] > 200) L.push([px[o], px[o + 1], px[o + 2]]); }
  if (L.length < 20) return null;
  const med = (i) => L.map((c) => c[i]).sort((a, b) => a - b)[L.length >> 1], R0 = med(0), G0 = med(1), B0 = med(2), S0 = R0 + G0 + B0 || 1, cr0 = R0 / S0, cg0 = G0 / S0;
  // (y algo de saturación: una cara pálida tiene casi el mismo tono que una camisa gris, pero la piel nunca es gris)
  const esPiel = (r, g, b) => { const S = r + g + b, mx = Math.max(r, g, b); if (S < 40 || S < S0 * 0.3 || S > S0 * 1.9 || (mx - Math.min(r, g, b)) < mx * 0.12) return false; return Math.hypot(r / S - cr0, g / S - cg0) < 0.06; };
  return { esPiel };
}
// gl.js (texDecodificar) pregunta acá antes de subir una textura del paquete: si es ropa de una skin heredada, devuelve un
// lienzo teñido (en la misma orientación que espera WebGL sin dar vuelta); si no, null y sigue como siempre
function idTex(i, src, img) {
  if (typeof DATA === 'undefined' || !DATA || !DATA.mt) return null;
  if (IDS.off) return null; const e = idsTabla()[i]; if (!e) return null;
  const t0 = performance.now();
  try {
    const w = src.width, h = src.height, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    // (un <img> sin achicar llega sin dar vuelta: WebGL lo daba vuelta al subirlo; acá se da vuelta al dibujarlo)
    if (src === img && typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) { x.translate(0, h); x.scale(1, -1); }
    x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h); idsTenir(d.data, e.r, idsSaltaTex(e, w, h), 8); x.putImageData(d, 0, 0);
    IDS.n++; IDS.ms += performance.now() - t0;
    return c;
  } catch (er) { return null; }
}
// los retratos teñidos (siempre cuidando la piel: son caras), en segundo plano al arrancar; mientras tanto, el de siempre
function idsRetratos() {
  if (IDS.listo || typeof DATA === 'undefined' || !DATA || !DATA.ico) return;
  IDS.listo = true;
  for (const s in IDS_SKINS) {
    const k = RETRATO[s] || s; if (!DATA.ico[k]) continue;
    const u = icono(k), im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height);
        // (desde donde empieza la ropa en ese retrato —ret, medido a ojo en cada uno: debajo del mentón— y sin tocar lo que
        // tenga el tono de su cara, el cuello; la ropa oscura del retrato va un poco hacia el tono medio de la rampa, para que
        // el color nuevo se note en una franja tan chica)
        const cara = idsSaltaCara(d.data, c.width, c.height), y0 = Math.floor(c.height * (IDS_SKINS[s].ret || 0.72));
        // (el tono de la cara se cuida sólo en el centro, donde está el cuello: a los costados es todo ropa, aunque una sombra
        // del mono naranja tenga el mismo tono que una piel morena)
        const sub = d.data.subarray(Math.min(c.height, y0) * c.width * 4), W = c.width, cx0 = W * 0.32, cx1 = W * 0.68;
        const piel = cara ? cara.esPiel : idsPiel, salta = (k, r, g, b) => { const xx = k % W; return xx > cx0 && xx < cx1 && piel(r, g, b); };
        idsTenir(sub, IDS_SKINS[s].r, salta, 40, 0.3); x.putImageData(d, 0, 0);
        IDS.ret[s] = c.toDataURL('image/png');   // (sin pérdida: la cara queda igual punto por punto)
        // (lo que ya esté a la vista con el retrato de antes —el menú de personajes abierto— se cambia solo)
        for (const el of document.querySelectorAll('img')) if (el.src === u) el.src = IDS.ret[s];
      } catch (e) {}
    };
    im.src = u;
  }
}
// (los retratos se tiñen apenas están los íconos, al arrancar: así el menú ya los muestra nuevos)
const _idsT = setInterval(() => { if (IDS.off) { clearInterval(_idsT); return; } if (typeof DATA !== 'undefined' && DATA && DATA.ico && DATA.ico.hero) { clearInterval(_idsT); idsRetratos(); } }, 400);
// el nombre que se ve y el retrato: se suman a los de menu.js
if (!IDS.off) Object.assign(SKIN_NOM, Object.fromEntries(Object.entries(IDS_SKINS).map(([s, v]) => [s, v.n])));
const _retratoOrig = retrato;
retrato = function (s) { if (IDS_SKINS[s] && !IDS.off) { idsRetratos(); if (IDS.ret[s]) return IDS.ret[s]; } return _retratoOrig(s); };
