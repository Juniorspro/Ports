// Los objetos del nivel, los canales de color y el dibujo del nivel (lo que en el juego hacen
// GameObject, GJEffectManager y las capas de lotes de GJBaseGameLayer).
'use strict';
const O = GD.O = {};

// tipos de objeto (enum GameObjectType del juego)
O.TIPO = { SOLIDO: 0, PELIGRO: 2, PORTAL_ARRIBA: 3, PORTAL_ABAJO: 4, PORTAL_NAVE: 5, PORTAL_CUBO: 6, DECO: 7, PAD_AMARILLO: 8, PAD_ROSA: 9,
  PAD_GRAVEDAD: 10, ARO_AMARILLO: 11, ARO_ROSA: 12, ARO_GRAVEDAD: 13, PORTAL_ESPEJO: 14, PORTAL_NOESPEJO: 15, PORTAL_BOLA: 16, PORTAL_GRANDE: 17,
  PORTAL_MINI: 18, PORTAL_OVNI: 19, MODIFICADOR: 20, ROMPIBLE: 21, MONEDA_SECRETA: 22, PORTAL_DUAL: 23, PORTAL_SOLO: 24, PENDIENTE: 25,
  PORTAL_ONDA: 26, PORTAL_ROBOT: 27, TELEPORT: 28, ARO_VERDE: 29, COLECCIONABLE: 30, MONEDA_USUARIO: 31, ARO_CAIDA: 32, PORTAL_ARANA: 33,
  PAD_ROJO: 34, ARO_ROJO: 35, ARO_CUSTOM: 36, ARO_DASH: 37, ARO_DASH_GRAV: 38, COLISION: 39, ESPECIAL: 40, PORTAL_COLUMPIO: 41,
  PORTAL_GRAV_TOGGLE: 42, ARO_ARANA: 43, PAD_ARANA: 44, ARO_TELEPORT: 46, PELIGRO_ANIMADO: 47 };
const TY = O.TIPO;

// lo que la tabla pública no dice bien: tipos por id (de la lista de objetos del juego)
const TIPOS_ID = {
  10: TY.PORTAL_ABAJO, 11: TY.PORTAL_ARRIBA, 12: TY.PORTAL_CUBO, 13: TY.PORTAL_NAVE, 47: TY.PORTAL_BOLA, 111: TY.PORTAL_OVNI, 660: TY.PORTAL_ONDA,
  745: TY.PORTAL_ROBOT, 1331: TY.PORTAL_ARANA, 1933: TY.PORTAL_COLUMPIO, 45: TY.PORTAL_ESPEJO, 46: TY.PORTAL_NOESPEJO, 99: TY.PORTAL_GRANDE,
  101: TY.PORTAL_MINI, 286: TY.PORTAL_DUAL, 287: TY.PORTAL_SOLO, 747: TY.TELEPORT, 2926: TY.PORTAL_GRAV_TOGGLE,
  35: TY.PAD_AMARILLO, 140: TY.PAD_ROSA, 67: TY.PAD_GRAVEDAD, 1332: TY.PAD_ROJO, 3005: TY.PAD_ARANA,
  36: TY.ARO_AMARILLO, 141: TY.ARO_ROSA, 84: TY.ARO_GRAVEDAD, 1022: TY.ARO_VERDE, 1330: TY.ARO_CAIDA, 1333: TY.ARO_ROJO, 1594: TY.ARO_CUSTOM,
  1704: TY.ARO_DASH, 1751: TY.ARO_DASH_GRAV, 3004: TY.ARO_ARANA, 3027: TY.ARO_TELEPORT,
  142: TY.MONEDA_SECRETA, 1329: TY.MONEDA_USUARIO, 1614: TY.COLECCIONABLE, 1275: TY.COLECCIONABLE, 1587: TY.COLECCIONABLE, 1589: TY.COLECCIONABLE, 1598: TY.COLECCIONABLE,
  143: TY.ROMPIBLE, 1816: TY.COLISION, 3643: TY.COLISION,
  200: TY.MODIFICADOR, 201: TY.MODIFICADOR, 202: TY.MODIFICADOR, 203: TY.MODIFICADOR, 1334: TY.MODIFICADOR,
};
O.VELOCIDAD = { 200: 0, 201: 1, 202: 2, 203: 3, 1334: 4 };
O.UPS = [251.16, 311.58, 387.42, 468.0, 576.0]; // unidades por segundo de cada velocidad
O.MODO = { 12: 0, 13: 1, 47: 2, 111: 3, 660: 4, 745: 5, 1331: 6, 1933: 7 }; // portal → modo de juego
O.MODOS = ['cubo', 'nave', 'bola', 'ovni', 'onda', 'robot', 'arana', 'columpio'];

O.cargarTabla = function (t) {
  O.tabla = t;
  for (const id in TIPOS_ID) { const d = t[id] || (t[id] = { t: '', z: 0, o: 0, c1: 0, c2: -1, ct: '' }); d.ty = TIPOS_ID[id]; }
};
O.def = id => O.tabla[id] || O.VACIO;
O.VACIO = { t: '', z: 0, o: 0, c1: 0, c2: -1, ct: '', ty: TY.DECO };
O.esTrigger = id => { const d = O.tabla[id]; return !!(d && d.t && /^edit_e/.test(d.t)) || GD.TR && !!GD.TR.def[id]; };

// ---------------- canales de color ----------------
// 1000 fondo, 1001 piso, 1002 línea, 1003 3DL, 1004 objetos, 1005/1006 colores del jugador,
// 1007 fondo claro (LBG), 1009 piso 2, 1010 negro, 1011 blanco, 1012 más claro, 1013/1014 medio.
class Colores {
  constructor(nv, p1 = [125, 255, 0], p2 = [0, 255, 255]) {
    this.base = {}; this.act = {}; this.p1 = p1; this.p2 = p2; this.trans = {}; this.pulsos = [];
    const def = c => Object.assign({ r: 255, g: 255, b: 255, op: 1, add: false, pc: -1 }, c);
    for (const id in nv.colores) this.base[id] = def(nv.colores[id]);
    const pon = (id, c) => { if (!this.base[id]) this.base[id] = def(c); };
    pon(1000, { r: 40, g: 125, b: 255 }); pon(1001, { r: 0, g: 102, b: 255 }); pon(1002, { r: 255, g: 255, b: 255 });
    pon(1004, { r: 255, g: 255, b: 255 }); pon(1009, { r: 0, g: 102, b: 255 });
    this.base[1010] = def({ r: 0, g: 0, b: 0 }); this.base[1011] = def({ r: 255, g: 255, b: 255 });
    this.base[1005] = def({ pc: 1, add: true }); this.base[1006] = def({ pc: 2, add: true });
    for (const id in this.base) this.act[id] = Object.assign({}, this.base[id]);
    this.calc = {}; this.frame = 0;
  }
  canal(id) { return this.act[id] || (this.act[id] = { r: 255, g: 255, b: 255, op: 1, add: false, pc: -1 }); }
  // color trigger: transición de lo que hay a lo pedido
  cambiar(id, dest, dur) {
    const c = this.canal(id);
    if (dest.add !== undefined) c.add = dest.add;
    const ini = this.valor(id);
    if (dur <= 0) { this.trans[id] = null; Object.assign(c, { r: dest.r, g: dest.g, b: dest.b, op: dest.op, pc: dest.pc, copia: dest.copia, hsv: dest.hsv, copiaOp: dest.copiaOp }); return; }
    this.trans[id] = { ini: { r: ini.r, g: ini.g, b: ini.b, op: ini.op }, dest, t: 0, dur };
    c.copia = 0; c.pc = -1;
  }
  paso(dt) {
    for (const id in this.trans) {
      const t = this.trans[id]; if (!t) continue;
      t.t += dt; const k = Math.min(1, t.t / t.dur), c = this.act[id], d = t.dest;
      let dr = d.r, dg = d.g, db = d.b;
      if (d.pc === 1) [dr, dg, db] = this.p1; else if (d.pc === 2) [dr, dg, db] = this.p2;
      else if (d.copia) { const v = this.valor(d.copia); [dr, dg, db] = O.aplicarHSV([v.r, v.g, v.b], GD.N.hsv(d.hsv)); }
      c.r = t.ini.r + (dr - t.ini.r) * k; c.g = t.ini.g + (dg - t.ini.g) * k; c.b = t.ini.b + (db - t.ini.b) * k;
      c.op = t.ini.op + ((d.op === undefined ? 1 : d.op) - t.ini.op) * k;
      if (k >= 1) { this.trans[id] = null; if (d.pc > 0) c.pc = d.pc; if (d.copia) { c.copia = d.copia; c.hsv = d.hsv; c.copiaOp = d.copiaOp; } }
    }
    for (let i = this.pulsos.length - 1; i >= 0; i--) { const p = this.pulsos[i]; p.t += dt; if (p.t >= p.fi + p.hold + p.fo) this.pulsos.splice(i, 1); }
    this.frame++; this.calc = {};
  }
  // color final del canal (con copias, colores del jugador y pulsos de canal)
  valor(id, prof = 0) {
    const cc = this.calc[id]; if (cc) return cc;
    const c = this.canal(id); let r = c.r, g = c.g, b = c.b, op = c.op;
    if (id == 1010) { r = g = b = 0; } else if (id == 1011) { r = g = b = 255; }
    else if (c.pc === 1) [r, g, b] = this.p1; else if (c.pc === 2) [r, g, b] = this.p2;
    else if (c.copia && prof < 8 && c.copia != id) {
      const v = this.valor(c.copia, prof + 1); [r, g, b] = O.aplicarHSV([v.r, v.g, v.b], GD.N.hsv(c.hsv));
      if (c.copiaOp) op = v.op;
    }
    if (id == 1012) { const v = this.valor(1000, prof + 1); [r, g, b] = O.aplicarHSV([v.r, v.g, v.b], { h: 0, s: -0.2, v: 0.2, sa: true, va: true }); }
    if (id == 1007) { const v = this.valor(1000, prof + 1); [r, g, b] = O.aplicarHSV([v.r, v.g, v.b], { h: 0, s: -0.2, v: 0.2, sa: true, va: true }); }
    for (const p of this.pulsos) if (p.canal == id) [r, g, b] = O.mezclarPulso([r, g, b], p);
    return (this.calc[id] = { r, g, b, op, add: !!c.add });
  }
}
O.Colores = Colores;
// pulso: entra, se queda, sale; puede ser un color o un HSV sobre el actual
O.mezclarPulso = function (rgb, p) {
  const t = p.t; let k;
  if (t < p.fi) k = p.fi ? t / p.fi : 1; else if (t < p.fi + p.hold) k = 1; else k = p.fo ? 1 - (t - p.fi - p.hold) / p.fo : 0;
  k = Math.max(0, Math.min(1, k));
  let d;
  if (p.hsv) d = O.aplicarHSV(rgb, p.hsv, p.copiaRGB); else d = p.rgb;
  return [rgb[0] + (d[0] - rgb[0]) * k, rgb[1] + (d[1] - rgb[1]) * k, rgb[2] + (d[2] - rgb[2]) * k];
};
O.rgbAHsv = function (r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
};
O.hsvARgb = function (h, s, v) {
  h = ((h % 360) + 360) % 360; const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c; let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};
// HSV del juego: h suma, s y v multiplican o (con la marca) suman
O.aplicarHSV = function (rgb, hsv, base) {
  if (!hsv) return rgb;
  let [h, s, v] = O.rgbAHsv(...(base || rgb));
  h += hsv.h; s = hsv.sa ? s + hsv.s : s * hsv.s; v = hsv.va ? v + hsv.v : v * hsv.v;
  return O.hsvARgb(h, GD.clamp(s, 0, 1), GD.clamp(v, 0, 1));
};

// ---------------- objetos ----------------
// key 19 de los niveles 1.x: color viejo → canal
const COLOR_VIEJO = { 1: 1005, 2: 1006, 3: 1, 4: 2, 5: 1007, 6: 3, 7: 4, 8: 1003 };
let _nObj = 0;
class Obj {
  constructor(raw) {
    this.raw = raw; this.id = raw[1]; this.n = _nObj++;
    const d = this.d = O.def(this.id);
    this.x = +raw[2] || 0; this.y = +raw[3] || 0; this.rot = +raw[6] || 0;
    const sc = raw[32] !== undefined ? +raw[32] : 1;
    this.sx = (raw[128] !== undefined ? +raw[128] : 1) * sc; this.sy = (raw[129] !== undefined ? +raw[129] : 1) * sc;
    this.fx = raw[4] == 1; this.fy = raw[5] == 1;
    this.warpX = +raw[131] || 0; this.warpY = +raw[132] || 0;
    this.capa = raw[24] !== undefined && raw[24] != 0 ? +raw[24] : d.z;
    this.orden = raw[25] !== undefined ? +raw[25] : d.o;
    let c1 = raw[21] ? +raw[21] : d.c1, c2 = raw[22] ? +raw[22] : d.c2;
    if (raw[19] && !raw[21] && COLOR_VIEJO[raw[19]]) { if (d.ct === 'd') c2 = COLOR_VIEJO[raw[19]]; else c1 = COLOR_VIEJO[raw[19]]; }
    let h1 = raw[41] == 1 ? GD.N.hsv(raw[43]) : null, h2 = raw[42] == 1 ? GD.N.hsv(raw[44]) : null;
    if (d.sw) { [c1, c2] = [c2, c1]; [h1, h2] = [h2, h1]; }
    this.c1 = c1; this.c2 = c2; this.h1 = h1; this.h2 = h2;
    this.grupos = GD.N.grupos(raw);
    this.ty = d.ty !== undefined ? d.ty : TY.DECO;
    this.op = 1; this.vis = !(raw[135] == 1); this.dx = 0; this.dy = 0; this.drot = 0; this.activo = true;
    this.noGlow = raw[96] == 1; this.noTocar = raw[121] == 1; this.altoDetalle = raw[103] == 1;
    this.partes = O.partes(this);
    // objeto de partículas de la 2.2: la definición va en la clave 145
    if (this.id === 2065 && raw[145]) this.pdef = GD.ParticulasGD.leer(raw[145]);
    // sierras y engranajes giran solos (98 = sin giro, 97 = velocidad propia)
    this.giro = raw[98] == 1 ? 0 : raw[97] !== undefined ? +raw[97] : (O.GIRAN.test(d.t || '') ? 360 : 0);
    this.late = O.LATEN.test(d.t || '');
  }
  get cx() { return this.x + this.dx; } get cy() { return this.y + this.dy; }
}
O.Obj = Obj;
O.GIRAN = /sawblade|cogwheel|blade|spikewheel|d_wheel|cartwheel|bladeTrap|darkblade/;
O.LATEN = /^(ring_|gravring_|d_ball|d_heart|d_circle|d_ring|d_star_|pulse)/;
O.latido = 0;
O.reloj = 0; // tiempo de juego para animaciones y giros (lo avanza la partida)
// los "trozos" que dibuja un objeto: el sprite principal y sus hijos (aplanados con su matriz)
O.partes = function (o) {
  const d = o.d, out = [];
  if (d.t && GD.T.m(d.t)) {
    // brillo detrás de bloques y pinches (hoja de brillos)
    const g = d.t.replace(/_001\.png$/, '_glow_001.png');
    if (!o.noGlow && (o.ty === TY.SOLIDO || o.ty === TY.PELIGRO || o.ty === TY.PENDIENTE) && g !== d.t && GD.T.m(g)) out.push({ f: GD.T.m(g), m: [1, 0, 0, 1, 0, 0], ct: 'glow', z: -1000, op: 1 });
    const prin = { f: GD.T.m(d.t), m: [1, 0, 0, 1, 0, 0], ct: d.ct, z: 0, op: d.op === undefined ? 1 : d.op };
    // animación cuadro a cuadro: monedas, fuego, gotas, lava… (los cuadros _002, _003…)
    const base = d.t.replace(/_001\.png$/, '');
    if (base !== d.t && GD.T.m(base + '_002.png')) { const l = [prin.f]; for (let k = 2; GD.T.m(`${base}_${String(k).padStart(3, '0')}.png`); k++) l.push(GD.T.m(`${base}_${String(k).padStart(3, '0')}.png`)); prin.anim = l; prin.fps = /secretCoin/.test(base) ? 10 : 15; }
    out.push(prin);
  }
  // objeto de texto (914): las letras de la fuente del nivel
  if (o.id === 914) { out.push({ texto: GD.N.texto64(o.raw[31] || ''), m: [1, 0, 0, 1, 0, 0], ct: 'b', z: 0, op: 1, f: GD.T.m('emptyFrame.png') || { tx: GD.R.blanco } }); }
  const rec = (hs, pm) => {
    for (const h of hs) {
      const [tex, x, y, z, rot, sx, sy, fx, fy, ax, ay, ct, op, sub] = h;
      const f = GD.T.m(tex); if (!f) continue;
      const r = -rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      const kx = sx * (fx ? -1 : 1), ky = sy * (fy ? -1 : 1);
      // ancla del hijo: 0 = centro; ±0.5 = borde (en unidades del tamaño del marco)
      const ox = -(ax * (fx ? -1 : 1)) * f.sw, oy = -(ay * (fy ? -1 : 1)) * f.sh;
      const l = [c * kx, s * kx, -s * ky, c * ky, x + c * kx * ox - s * ky * oy, y + s * kx * ox + c * ky * oy];
      const m = [pm[0] * l[0] + pm[2] * l[1], pm[1] * l[0] + pm[3] * l[1], pm[0] * l[2] + pm[2] * l[3], pm[1] * l[2] + pm[3] * l[3],
        pm[0] * l[4] + pm[2] * l[5] + pm[4], pm[1] * l[4] + pm[3] * l[5] + pm[5]];
      out.push({ f, m, ct, z, op });
      if (sub) rec(sub, m);
    }
  };
  if (d.h) rec(d.h, [1, 0, 0, 1, 0, 0]);
  out.sort((a, b) => a.z - b.z);
  return out;
};
// capas Z del juego: B5..T4 → orden de dibujo
// texto con la fuente del nivel (O.fuente: bigFont o gjFontNN), centrado en el objeto
O.pintarTexto = function (w, p, col, add) {
  const F = GD.fuentes[O.fuente] || GD.fuentes.bigFont; if (!F || !F.tx) return;
  const lineas = p.texto.split('\n'), lh = F.lh / 2, tw = F.tx.w, th = F.tx.h, xs = new Float32Array(8), uv = new Float32Array(8);
  const ancho = l => { let a = 0; for (const ch of l) { const c = F.chars[ch.codePointAt(0)] || F.chars[63]; if (c) a += c[6] / 2; } return a; };
  const alto = lh * lineas.length;
  lineas.forEach((l, i) => {
    let x = -ancho(l) / 2; const yb = alto / 2 - lh * i;
    for (const ch of l) {
      const c = F.chars[ch.codePointAt(0)] || F.chars[63]; if (!c) continue;
      if (c[2] > 0) {
        const x0 = x + c[4] / 2, y1 = yb - c[5] / 2, x1 = x0 + c[2] / 2, y0 = y1 - c[3] / 2;
        const P = (k, X, Y) => { xs[k] = w[0] * X + w[2] * Y + w[4]; xs[k + 1] = w[1] * X + w[3] * Y + w[5]; };
        P(0, x0, y1); P(2, x1, y1); P(4, x0, y0); P(6, x1, y0);
        uv.set([c[0] / tw, c[1] / th, (c[0] + c[2]) / tw, c[1] / th, c[0] / tw, (c[1] + c[3]) / th, (c[0] + c[2]) / tw, (c[1] + c[3]) / th]);
        GD.R.quad(F.tx, add, 0, xs, uv, col);
      }
      x += c[6] / 2;
    }
  });
};
O.fuente = 'bigFont';
O.ORDEN_CAPA = { '-5': 0, '-3': 1, '-1': 2, 1: 3, 3: 4, 0: 5, 5: 5, 7: 6, 9: 7, 11: 8 };

// ---------------- dibujo de objetos ----------------
const _xs = new Float32Array(8), _uv = new Float32Array(8);
// matriz del objeto en el mundo (unidades del nivel)
O.matriz = function (o, m) {
  const r = -(o.rot + o.drot + (o.giro ? O.reloj * o.giro * (o.fx ? -1 : 1) : 0)) * Math.PI / 180;
  let a = Math.cos(r), b = Math.sin(r), c = -b, d = a;
  if (o.warpX || o.warpY) { // 2.2: "warp" = sesgo en grados
    const rx = -(o.rot + o.drot + o.warpX) * Math.PI / 180, ry = -(o.rot + o.drot + o.warpY) * Math.PI / 180;
    a = Math.cos(rx); b = Math.sin(rx); c = -Math.sin(ry); d = Math.cos(ry);
  }
  const lat = o.late ? 0.8 + 0.4 * O.latido : 1;
  const sx = o.sx * (o.fx ? -1 : 1) * (o.esx || 1) * lat, sy = o.sy * (o.fy ? -1 : 1) * (o.esy || 1) * lat;
  const ve = o.ve || 1; // escala visual de los efectos de entrada
  m[0] = a * sx * ve; m[1] = b * sx * ve; m[2] = c * sy * ve; m[3] = d * sy * ve; m[4] = o.x + o.dx + (o.vx || 0); m[5] = o.y + o.dy + (o.vy || 0);
  return m;
};
// dibuja un trozo: w = vista·objeto, p.m = matriz del trozo dentro del objeto
O.pintarParte = function (w, p, col, add) {
  if (p.texto !== undefined) { O.pintarTexto(w, p, col, add); return; }
  const f = p.anim ? p.anim[Math.floor(O.reloj * p.fps) % p.anim.length] : p.f, pm = p.m;
  const a = w[0] * pm[0] + w[2] * pm[1], b = w[1] * pm[0] + w[3] * pm[1], c = w[0] * pm[2] + w[2] * pm[3], d = w[1] * pm[2] + w[3] * pm[3];
  const e = w[0] * pm[4] + w[2] * pm[5] + w[4], g = w[1] * pm[4] + w[3] * pm[5] + w[5];
  const x0 = -f.sw / 2 + (f.sw - f.cw) / 2 + f.ox, y0 = -f.sh / 2 + (f.sh - f.ch) / 2 + f.oy, x1 = x0 + f.cw, y1 = y0 + f.ch;
  _xs[0] = a * x0 + c * y1 + e; _xs[1] = b * x0 + d * y1 + g;
  _xs[2] = a * x1 + c * y1 + e; _xs[3] = b * x1 + d * y1 + g;
  _xs[4] = a * x0 + c * y0 + e; _xs[5] = b * x0 + d * y0 + g;
  _xs[6] = a * x1 + c * y0 + e; _xs[7] = b * x1 + d * y0 + g;
  const tw = f.tx.w, th = f.tx.h, u0 = f.x / tw, v0 = f.y / th;
  if (!f.rot) { const u1 = (f.x + f.w) / tw, v1 = (f.y + f.h) / th; _uv[0] = u0; _uv[1] = v0; _uv[2] = u1; _uv[3] = v0; _uv[4] = u0; _uv[5] = v1; _uv[6] = u1; _uv[7] = v1; }
  else { const u1 = (f.x + f.h) / tw, v1 = (f.y + f.w) / th; _uv[0] = u1; _uv[1] = v0; _uv[2] = u1; _uv[3] = v1; _uv[4] = u0; _uv[5] = v0; _uv[6] = u0; _uv[7] = v1; }
  GD.R.quad(f.tx, add, 0, _xs, _uv, col);
};
// color de un trozo según su tipo (base/detalle/negro) y los canales
O.colorParte = function (o, p, cols) {
  let id, hsv;
  if (p.ct === 'd') { id = o.c2; hsv = o.h2; } else if (p.ct === 'b' || p.ct === 'glow') { id = o.c1; hsv = o.h1; } else if (p.ct === 'k') { id = o.c1 > 0 ? o.c1 : o.c2; }
  else return [255, 255, 255, 1, false];
  if (id === undefined || id < 0) id = p.ct === 'd' ? 0 : 1004;
  if (id === 0) id = p.ct === 'd' ? 1011 : 1004;
  const v = cols.valor(id);
  if (p.ct === 'k') return [0, 0, 0, v.op, false];
  let rgb = [v.r, v.g, v.b];
  if (hsv) rgb = O.aplicarHSV(rgb, hsv);
  if (o.pulsos) for (const pu of o.pulsos) if (!pu.soloDetalle || p.ct === 'd') if (!pu.soloBase || p.ct !== 'd') rgb = O.mezclarPulso(rgb, pu);
  return [rgb[0], rgb[1], rgb[2], v.op, v.add || p.ct === 'glow'];
};

// ---------------- dibujo por tandas (como las capas de lotes del juego) ----------------
// cada capa Z se dibuja en este orden: brillos, objetos comunes (agrupados por hoja) y los que
// mezclan aditivo (agrupados por hoja). Así hay pocas tandas por cuadro y el orden es el del juego.
const _mo = new Float32Array(6);
let _mats = new Float32Array(6 * 4096);
O.dibujarObjetos = function (vis, w, cols, op) {
  // op: {editor, capaEd, jugadores (fn), capaJugador, opacidad(o)}
  const n = vis.length;
  if (_mats.length < n * 6) _mats = new Float32Array(n * 12);
  const capas = O._capas || (O._capas = []);
  for (const c of capas) if (c) c.length = 0;
  for (let i = 0; i < n; i++) {
    const o = vis[i];
    const capa = O.ORDEN_CAPA[o.capa] ?? 5;
    const fade = op.opacidad ? op.opacidad(o) : 1;
    if (fade <= 0.003 && !op.editor) continue;
    O.matriz(o, _mo);
    const k = i * 6;
    _mats[k] = w[0] * _mo[0] + w[2] * _mo[1]; _mats[k + 1] = w[1] * _mo[0] + w[3] * _mo[1];
    _mats[k + 2] = w[0] * _mo[2] + w[2] * _mo[3]; _mats[k + 3] = w[1] * _mo[2] + w[3] * _mo[3];
    _mats[k + 4] = w[0] * _mo[4] + w[2] * _mo[5] + w[4]; _mats[k + 5] = w[1] * _mo[4] + w[3] * _mo[5] + w[5];
    const pp = o.partes;
    for (let q = 0; q < pp.length; q++) {
      const p = pp[q];
      const c = O.colorParte(o, p, cols);
      let al = c[3] * o.op * p.op * fade;
      if (op.editor) al = op.alfaEditor(o, al);
      if (al <= 0.003) continue;
      const col = o.selec ? GD.col(0, 255, 0, 255 * Math.max(al, 0.6)) : GD.col(c[0], c[1], c[2], 255 * al);
      const tx = p.texto !== undefined ? ((GD.fuentes[O.fuente] || GD.fuentes.bigFont || {}).tx || GD.R.blanco) : (p.anim ? p.anim[0] : p.f).tx;
      const modo = p.ct === 'glow' ? 0 : (c[4] && !o.selec) ? 2 : 1;
      let lista = capas[capa * 3 + modo]; if (!lista) lista = capas[capa * 3 + modo] = [];
      lista.push(tx, k, p, col);
    }
  }
  // dentro de cada tanda, hoja por hoja (el orden entre objetos de la misma hoja se mantiene)
  const vistos = O._vistos || (O._vistos = []);
  for (let capa = 0; capa < 9; capa++) {
    if (capa === op.capaJugador && op.jugadores) op.jugadores();
    for (let modo = 0; modo < 3; modo++) {
      const lista = capas[capa * 3 + modo]; if (!lista || !lista.length) { if (modo === 2 && op.emisores) O.emisoresCapa(op, capa); continue; }
      vistos.length = 0;
      for (let i = 0; i < lista.length; i += 4) if (!vistos.includes(lista[i])) vistos.push(lista[i]);
      const add = modo !== 1;
      for (const tx of vistos) for (let i = 0; i < lista.length; i += 4) {
        if (lista[i] !== tx) continue;
        const k = lista[i + 1];
        _mo[0] = _mats[k]; _mo[1] = _mats[k + 1]; _mo[2] = _mats[k + 2]; _mo[3] = _mats[k + 3]; _mo[4] = _mats[k + 4]; _mo[5] = _mats[k + 5];
        O.pintarParte(_mo, lista[i + 2], lista[i + 3], add);
      }
      if (modo === 2 && op.emisores) O.emisoresCapa(op, capa);
    }
  }
  if (op.capaJugador >= 9 && op.jugadores) op.jugadores();
};
// partículas de la 2.2: van con su capa, después de los objetos de esa capa
O.emisoresCapa = function (op, capa) { for (const o of op.emisores) if ((O.ORDEN_CAPA[o.capa] ?? 5) === capa) op.dibujarEmisor(o); };
