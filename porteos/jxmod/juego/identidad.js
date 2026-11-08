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

// ---------------- los mapas base heredados: nombre propio y un hito de JXMod en cada uno ----------------
// Los ocho mapas que venían con el paquete (Desierto, Desierto II, Pasto plano, Ciudad, Base, Base II, Marte y Espacio)
// cambian de nombre en los 14 idiomas, y en los siete de superficie aparece, a unos 46 m de la aparición y a la vista, la
// plaza JX: una plataforma de hormigón con rampas en los cuatro lados (se sube caminando o en auto), un monolito de 16 m
// con el «JX» y una costura luminosa en amarillo, y cuatro postes con luz. Todo es una malla por material (3 llamadas de
// dibujo) y choca como el mapa. Sólo en el mapa base solo: no en un mapa de la comunidad montado encima, ni en el creador
// de mapas (para no pisar lo que armó alguien), y sólo si el terreno es parejo ahí (si no, prueba otros rumbos).
// Los nombres internos (Desert, FlatGrass...) no cambian: partidas, servers y mods los siguen usando.
const IDS_MAPAS = {
  // orden: es en pt id ms fil ja th tr ar ru uk fr de
  Desert: ['Cañadón Ocre', 'Ochre Canyon', 'Cânion Ocre', 'Ngarai Oker', 'Ngarai Oker', 'Kanyong Okre', 'オーカー渓谷', 'หุบเขาสีดินเหลือง', 'Okr Kanyonu', 'وادي المغرة', 'Охровый каньон', 'Охровий каньйон', "Canyon d'Ocre", 'Ockerschlucht'],
  DesertV2: ['Médanos', 'Dunes', 'Dunas', 'Bukit Pasir', 'Bukit Pasir', 'Mga Buhanginan', '砂丘', 'เนินทราย', 'Kum Tepeleri', 'الكثبان', 'Дюны', 'Дюни', 'Dunes', 'Dünen'],
  FlatGrass: ['Pradera', 'Meadow', 'Pradaria', 'Padang Rumput', 'Padang Rumput', 'Parang', '草原', 'ทุ่งหญ้า', 'Çayır', 'المرج', 'Луг', 'Луг', 'Prairie', 'Wiese'],
  City: ['Distrito Norte', 'North District', 'Distrito Norte', 'Distrik Utara', 'Daerah Utara', 'Hilagang Distrito', '北地区', 'เขตเหนือ', 'Kuzey Bölgesi', 'الحي الشمالي', 'Северный район', 'Північний район', 'Quartier Nord', 'Nordviertel'],
  Base: ['Hangar 7', 'Hangar 7', 'Hangar 7', 'Hangar 7', 'Hangar 7', 'Hangar 7', 'ハンガー7', 'โรงเก็บ 7', 'Hangar 7', 'الحظيرة 7', 'Ангар 7', 'Ангар 7', 'Hangar 7', 'Hangar 7'],
  BaseV2: ['Polo Industrial', 'Industrial Park', 'Polo Industrial', 'Kawasan Industri', 'Kawasan Perindustrian', 'Industriyal na Sona', '工業地帯', 'นิคมอุตสาหกรรม', 'Sanayi Bölgesi', 'المنطقة الصناعية', 'Промзона', 'Промзона', 'Zone Industrielle', 'Industriegebiet'],
  Mars: ['Planeta Rojo', 'Red Planet', 'Planeta Vermelho', 'Planet Merah', 'Planet Merah', 'Pulang Planeta', '赤い惑星', 'ดาวแดง', 'Kızıl Gezegen', 'الكوكب الأحمر', 'Красная планета', 'Червона планета', 'Planète Rouge', 'Roter Planet'],
  Space: ['Órbita', 'Orbit', 'Órbita', 'Orbit', 'Orbit', 'Orbit', '軌道', 'วงโคจร', 'Yörünge', 'المدار', 'Орбита', 'Орбіта', 'Orbite', 'Orbit'],
};
const IDS_LANGS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
(function idsNombresMapas() {
  if (IDS.off || typeof IDI_T === 'undefined' || typeof IDI_K === 'undefined') return;
  IDS_LANGS.forEach((l, j) => {
    if (!IDI_T[l]) return; const a = IDI_T[l].split('|');
    for (const m in IDS_MAPAS) { const i = IDI_K.indexOf('m.' + m); if (i >= 0 && i < a.length) a[i] = IDS_MAPAS[m][j]; }
    IDI_T[l] = a.join('|');
  });
  if (typeof _idiCache !== 'undefined') for (const k in _idiCache) delete _idiCache[k];
})();
// los tonos de la plaza por mapa: el hormigón y el grafito cambian con el suelo; el amarillo JX es siempre el mismo
const IDS_TONOS = {
  gris: { piso: [0.78, 0.77, 0.74], graf: [0.14, 0.155, 0.18] }, arena: { piso: [0.84, 0.76, 0.62], graf: [0.23, 0.18, 0.14] }, marte: { piso: [0.73, 0.5, 0.42], graf: [0.17, 0.11, 0.1] },
};
const IDS_HITOS = { Desert: 'arena', DesertV2: 'arena', FlatGrass: 'gris', City: 'gris', Base: 'gris', BaseV2: 'gris', Mars: 'marte' };
// (un triángulo con su normal, para los costados de las rampas)
function idsTri(B, a, b, c, n) { const k = B.P.length / 3; for (const p of [a, b, c]) { B.P.push(p.x, p.y, p.z); B.N.push(n.x, n.y, n.z); } B.U.push(0, 0, 1, 0, 0, 1); if (vdot(vcross(vsub(b, a), vsub(c, a)), n) < 0) B.I.push(k, k + 2, k + 1); else B.I.push(k, k + 1, k + 2); }
ENT_INFO.jx_plaza = ['jx_plaza', { tono: 'gris' }];
ENT_TIPO.jx_plaza = {
  crear(e) {
    const T = IDS_TONOS[e.prm.tono] || IDS_TONOS.gris, S = geoNuevo(), G = geoNuevo(), A = geoNuevo(), tris = [];
    const ew = (x, y, z) => vadd(e.p, e.q.rot(v3(x, y, z))), up = e.q.rot(v3(0, 1, 0));
    const caja = (B, x, y, z, hx, hy, hz, q2, choca) => { const c = ew(x, y, z), q = q2 ? e.q.clone().mul(q2) : e.q; geoCaja(B, c, [hx, hy, hz], q, 2); if (choca) e.cajas.push(cajaFija(c, [hx, hy, hz], q)); };
    const L = 9, H = 0.45, F = 1.2, RL = 5.5, RW = 4;   // (medio lado, alto, falda bajo tierra, largo y medio ancho de cada rampa)
    // la plataforma: tapa clara, costados de grafito (con falda hacia abajo para que no quede luz si el piso no es plano)
    const t = [ew(L, H, L), ew(-L, H, L), ew(-L, H, -L), ew(L, H, -L)];
    geoQuad(S, t[0], t[1], t[2], t[3], up, 3); tris.push(...[0, 1, 2, 0, 2, 3].flatMap((i) => [t[i].x, t[i].y, t[i].z]));
    for (let k = 0; k < 4; k++) {
      const a = t[k], b = t[(k + 1) % 4], a2 = vsub(a, vscale(up, H + F)), b2 = vsub(b, vscale(up, H + F)), n = vcross(vsub(b, a), up).norm();
      geoQuad(G, a2, b2, b, a, vscale(n, -1), 2); tris.push(a2.x, a2.y, a2.z, b2.x, b2.y, b2.z, b.x, b.y, b.z, a2.x, a2.y, a2.z, b.x, b.y, b.z, a.x, a.y, a.z);
    }
    // las cuatro rampas (5° de pendiente: se sube caminando y en auto)
    for (let k = 0; k < 4; k++) {
      const ang = k * Math.PI / 2, rq = Quat.axis(0, 1, 0, ang), pr = (x, y, z) => vadd(e.p, e.q.rot(rq.rot(v3(x, y, z))));
      const p0 = pr(RW, H, L), p1 = pr(-RW, H, L), p2 = pr(-RW, 0, L + RL), p3 = pr(RW, 0, L + RL);
      const nr = e.q.rot(rq.rot(v3(0, RL, H).norm()));
      geoQuad(S, p0, p1, p2, p3, nr, 3); tris.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
      for (const s of [1, -1]) { const top = pr(s * RW, H, L), bot = pr(s * RW, -F, L), fin = pr(s * RW, -F, L + RL), pie = pr(s * RW, 0, L + RL), ns = e.q.rot(rq.rot(v3(s, 0, 0))); idsTri(G, top, bot, pie, ns); idsTri(G, bot, fin, pie, ns); }
    }
    // el filo amarillo (luminoso) a 0,6 m del borde y una franja en cada rampa
    for (const [x, z, hx, hz] of [[0, L - 0.6, L - 0.6, 0.07], [0, -(L - 0.6), L - 0.6, 0.07], [L - 0.6, 0, 0.07, L - 0.6], [-(L - 0.6), 0, 0.07, L - 0.6]]) caja(A, x, H + 0.012, z, hx, 0.012, hz);
    // el monolito: 4,4 × 16 × 1,6 m, con el «JX» y una costura luminosa en las dos caras
    const MH = 8, MW = 2.2, MD = 0.8;
    caja(G, 0, H + MH, 0, MW, MH, MD, null, true); caja(S, 0, H + MH * 2 + 0.2, 0, MW + 0.25, 0.2, MD + 0.25);
    for (const s of [1, -1]) {
      const z = s * (MD + 0.02), lz = 0.025;
      caja(A, 0, H + 5.2, z, 0.09, 4.6, lz);   // (la costura de abajo)
      // la J: palo, gancho y punta
      caja(A, -0.7, H + 12.6, z, 0.16, 1.5, lz); caja(A, -1.25, H + 11.25, z, 0.55, 0.15, lz); caja(A, -1.65, H + 11.6, z, 0.15, 0.4, lz); caja(A, -0.95, H + 14.0, z, 0.55, 0.13, lz);
      // la X: dos diagonales
      caja(A, 1.05, H + 12.6, z, 0.15, 1.75, lz, Quat.axis(0, 0, 1, 0.5)); caja(A, 1.05, H + 12.6, z, 0.15, 1.75, lz, Quat.axis(0, 0, 1, -0.5));
    }
    // cuatro postes con un farol amarillo
    for (const [x, z] of [[L - 1.2, L - 1.2], [-(L - 1.2), L - 1.2], [L - 1.2, -(L - 1.2)], [-(L - 1.2), -(L - 1.2)]]) { caja(G, x, H + 1.6, z, 0.17, 1.6, 0.17, null, true); caja(A, x, H + 3.32, z, 0.21, 0.12, 0.21); }
    e.tris = mundoSumarTris(tris);
    // (hormigón liso y claro: contra el grafito del monolito y el amarillo, la plaza se lee de lejos)
    e.mPiso = matPropio('jxPiso_' + e.prm.tono, T.piso, { pbr: [0.82, 0, 0.04] }); e.mGraf = matPropio('jxGraf_' + e.prm.tono, T.graf, { pbr: [0.55, 0.15, 0.05] });
    e.mLuz = matPropio('jxLuz', [1, 0.74, 0.16], { pbr: [0.4, 0, 0.04], em: [2.4, 1.55, 0.25] });
    e.mallas = [mallaPropia(S), mallaPropia(G), mallaPropia(A)];
  },
  dibujar(e) { encolar(e.mallas[0], 0, e.mPiso, IDM, null, null); encolar(e.mallas[1], 0, e.mGraf, IDM, null, null); encolar(e.mallas[2], 0, e.mLuz, IDM, null, null); },
  luz(e) { luzPuntual(entW(e, 0, 1.4, 1.6), 12, [2.2, 1.5, 0.35]); },
};
// ¿dónde va la plaza? Delante de la aparición (46 m; si ahí no es parejo, a los costados, atrás o más lejos): el piso en
// 13 puntos de su huella (plataforma más rampas) tiene que estar a ±0,6 m del centro y sin nada encima (techos, autos)
function idsLugarPlaza() {
  const s = MUNDO.spawns[0]; if (!s) return null;
  const yaw = s.yaw || 0;
  for (const d of [46, 60, 34]) for (const giro of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const a = yaw + giro, c = v3(s.x + Math.sin(a) * d, s.y + 30, s.z + Math.cos(a) * d), y0 = pisoBajo(c, 0); if (y0 === null || Math.abs(y0 - s.y) > 6) continue;
    let bien = true;
    for (const [dx, dz] of [[0, 0], [9, 9], [-9, 9], [9, -9], [-9, -9], [14, 0], [-14, 0], [0, 14], [0, -14], [5, 0], [-5, 0], [0, 5], [0, -5]]) {
      const yy = pisoBajo(v3(c.x + dx, y0 + 30, c.z + dz), 0); if (yy === null || Math.abs(yy - y0) > 0.6) { bien = false; break; }
    }
    if (bien) return { p: [c.x, y0, c.z], yaw: a };
  }
  return null;
}
function idsHitoMapa(mapa) {
  IDS.hito = null;
  if (IDS.off || !IDS_HITOS[mapa] || (typeof RB !== 'undefined' && RB.mapaPartida) || (typeof CREA !== 'undefined' && CREA.on)) return;
  const L = idsLugarPlaza(); if (!L) { IDS.hito = { omitido: true }; return; }
  const e = entidadCrear({ t: 'jx_plaza', p: L.p, yaw: L.yaw + Math.PI, prm: { tono: IDS_HITOS[mapa] } }, { dueno: 'mapa' });
  IDS.hito = e ? { p: L.p, yaw: L.yaw } : null;
}
// (después de armar el mapa: cargarMapa de mundo.js, envuelta)
const _idsCargarMapa = cargarMapa;
cargarMapa = function (m) { const r = _idsCargarMapa.apply(this, arguments); try { idsHitoMapa(m); } catch (x) { console.warn('plaza JX', x); } return r; };
