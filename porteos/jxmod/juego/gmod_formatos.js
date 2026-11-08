// ---------------- formatos de Garry's Mod / Source, leídos en el navegador ----------------
// Todo lo que traen los addons del Workshop (medido con 111 addons reales y ~12 mil archivos): el .gma (y la compresión LZMA
// con que los baja el Workshop), modelos .mdl (v44, v48, v49) con .vvd (v4) y .vtx (dx90/dx80/sw), colisiones .phy,
// texturas .vtf (7.0 a 7.5: DXT1/3/5, RGBA/BGRA/BGR/RGB, I8, IA88, A8, 565, 4444, 5551, HDR...), materiales .vmt
// (KeyValues, también "patch") y sonidos .wav (PCM de 8/16/24 bits y ADPCM de Microsoft e IMA, que el navegador no lee).
// Funciones puras sobre Uint8Array (sin el juego): se prueban también fuera del navegador.

const GMF = {};

// ---------------- LZMA "alone" (como los .gma del Workshop): decodificador según LzmaSpec de Igor Pavlov ----------------
GMF.lzma = function (src, alProgreso) {
  const p0 = src[0]; if (p0 >= 225) throw new Error('lzma: propiedades malas');
  const lc = p0 % 9, lp = ((p0 / 9) | 0) % 5, pb = (p0 / 45) | 0;
  const lo = (src[5] | src[6] << 8 | src[7] << 16 | src[8] << 24) >>> 0, hi = (src[9] | src[10] << 8 | src[11] << 16 | src[12] << 24) >>> 0;
  const sabe = !(lo === 0xffffffff && hi === 0xffffffff), tam = sabe ? hi * 4294967296 + lo : -1;
  if (sabe && tam > 1.5e9) throw new Error('lzma: demasiado grande');
  let out = new Uint8Array(sabe ? tam : Math.max(1 << 20, src.length * 4)), op = 0;
  let ip = 13, range = 0xffffffff, code = 0;
  ip++;   // (el primer byte del codificador es 0)
  for (let i = 0; i < 4; i++) code = ((code << 8) | src[ip++]) >>> 0;
  const P = (n) => new Uint16Array(n).fill(1024);
  const lit = P(0x300 << (lc + lp)), isMatch = P(12 << 4), isRep = P(12), isRepG0 = P(12), isRepG1 = P(12), isRepG2 = P(12), isRep0Long = P(12 << 4);
  const posSlot = P(4 << 6), posDec = P(115), align = P(16);
  const LEN = () => ({ ch: P(2), low: P(16 << 3), mid: P(16 << 3), high: P(256) });
  const lenD = LEN(), repD = LEN();
  const bit = (p, i) => {
    const v = p[i], b = (range >>> 11) * v; let s;
    if (code < b) { p[i] = v + ((2048 - v) >>> 5); range = b; s = 0; } else { p[i] = v - (v >>> 5); code -= b; range -= b; s = 1; }
    if (range < 16777216) { range = (range * 256) >>> 0; code = ((code * 256) + (ip < src.length ? src[ip] : 0)) >>> 0; ip++; }
    return s;
  };
  const arbol = (p, base, n) => { let m = 1; for (let i = 0; i < n; i++) m = (m << 1) + bit(p, base + m); return m - (1 << n); };
  const arbolInv = (p, base, n) => { let m = 1, s = 0; for (let i = 0; i < n; i++) { const b = bit(p, base + m); m = (m << 1) + b; s |= b << i; } return s; };
  const directos = (n) => { let r = 0; while (n--) { range >>>= 1; let b = 0; if (code >= range) { code -= range; b = 1; } r = r * 2 + b; if (range < 16777216) { range = (range * 256) >>> 0; code = ((code * 256) + (ip < src.length ? src[ip] : 0)) >>> 0; ip++; } } return r; };
  const largo = (L, ps) => (!bit(L.ch, 0) ? arbol(L.low, ps << 3, 3) : !bit(L.ch, 1) ? 8 + arbol(L.mid, ps << 3, 3) : 16 + arbol(L.high, 0, 8));
  const crecer = (n) => { if (op + n <= out.length) return; let t = out.length * 2; while (t < op + n) t *= 2; const o2 = new Uint8Array(t); o2.set(out.subarray(0, op)); out = o2; };
  let st = 0, r0 = 0, r1 = 0, r2 = 0, r3 = 0; const mpb = (1 << pb) - 1, mlp = (1 << lp) - 1;
  let paso = 0;
  for (;;) {
    if (sabe && op >= tam) break;
    if (alProgreso && ++paso % 262144 === 0) alProgreso(op, tam);
    const ps = op & mpb;
    if (!bit(isMatch, (st << 4) + ps)) {
      if (!sabe) crecer(1);
      const prev = op > 0 ? out[op - 1] : 0, base = 0x300 * (((op & mlp) << lc) + (prev >>> (8 - lc)));
      let s = 1;
      if (st >= 7) {
        let mb = out[op - r0 - 1];
        do { const m = (mb >>> 7) & 1; mb <<= 1; const b = bit(lit, base + ((1 + m) << 8) + s); s = (s << 1) | b; if (m !== b) break; } while (s < 0x100);
      }
      while (s < 0x100) s = (s << 1) | bit(lit, base + s);
      out[op++] = s - 0x100;
      st = st < 4 ? 0 : st < 10 ? st - 3 : st - 6;
      continue;
    }
    let len;
    if (bit(isRep, st)) {
      if (op === 0) throw new Error('lzma: datos dañados');
      if (!bit(isRepG0, st)) {
        if (!bit(isRep0Long, (st << 4) + ps)) { if (!sabe) crecer(1); st = st < 7 ? 9 : 11; out[op] = out[op - r0 - 1]; op++; continue; }
      } else {
        let d;
        if (!bit(isRepG1, st)) d = r1;
        else { if (!bit(isRepG2, st)) d = r2; else { d = r3; r3 = r2; } r2 = r1; }
        r1 = r0; r0 = d;
      }
      len = largo(repD, ps); st = st < 7 ? 8 : 11;
    } else {
      r3 = r2; r2 = r1; r1 = r0;
      len = largo(lenD, ps); st = st < 7 ? 7 : 10;
      const ls = len > 3 ? 3 : len, slot = arbol(posSlot, ls << 6, 6);
      if (slot < 4) r0 = slot;
      else {
        const nd = (slot >>> 1) - 1; let d = (2 | (slot & 1)) * 2 ** nd;
        if (slot < 14) d += arbolInv(posDec, d - slot, nd);
        else d += directos(nd - 4) * 16 + arbolInv(align, 0, 4);
        r0 = d;
      }
      if (r0 === 0xffffffff) break;   // (marca de fin)
      if (r0 >= op) throw new Error('lzma: distancia fuera');
    }
    len += 2;
    if (sabe && len > tam - op) len = tam - op;
    if (!sabe) crecer(len);
    for (let k = 0; k < len; k++) { out[op] = out[op - r0 - 1]; op++; }
  }
  return sabe ? out : out.subarray(0, op);
};

// ---------------- .gma: el paquete de un addon ----------------
const _td = new TextDecoder('utf-8'), _tl = new TextDecoder('latin1');
// la cabecera y la tabla de archivos de un .gma (de su principio; null si el pedazo no alcanza)
GMF.gmaTabla = function (b) {
  const n = b.length; if (n < 25) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), ver = b[4]; let p = 5 + 8 + 8;
  const CORTO = {}, cstr = () => { let e = p; while (e < n && b[e] !== 0) e++; if (e >= n) throw CORTO; const s = _td.decode(b.subarray(p, e)); p = e + 1; return s; };
  try {
    if (ver > 1) while (cstr()) {}   // (contenido requerido)
    const nombre = cstr(), desc = cstr(), autor = cstr(); p += 4;
    const A = [];
    for (;;) {
      if (p + 4 > n) throw CORTO;
      const k = dv.getUint32(p, true); p += 4; if (k === 0) break;
      const ruta = cstr().toLowerCase().replace(/\\/g, '/'); if (p + 12 > n) throw CORTO;
      const tamL = dv.getUint32(p, true), tamH = dv.getUint32(p + 4, true); p += 12;
      A.push([ruta, tamH * 4294967296 + tamL]);
    }
    let info = {}; try { info = JSON.parse(desc); } catch (e) { info = { description: desc }; }
    return { nombre, autor, info, A, ini: p };
  } catch (e) { if (e === CORTO) return null; throw e; }
};
GMF.gma = function (b) {
  if (b[0] !== 0x47 || b[1] !== 0x4d || b[2] !== 0x41 || b[3] !== 0x44) {
    b = GMF.lzma(b);
    if (b[0] !== 0x47 || b[1] !== 0x4d || b[2] !== 0x41 || b[3] !== 0x44) throw new Error('no es un .gma');
  }
  const T = GMF.gmaTabla(b); if (!T) throw new Error('gma cortado');
  const archivos = new Map(); let q = T.ini;
  for (const [ruta, t] of T.A) { if (!ruta.includes('..')) archivos.set(ruta, b.subarray(q, q + t)); q += t; }
  return { nombre: T.nombre, autor: T.autor, info: T.info, archivos };
};
// ---------------- KeyValues (los .vmt y otros .txt de Source) ----------------
GMF.kv = function (txt) {
  let i = 0; const n = txt.length;
  const tok = () => {
    for (;;) {
      while (i < n && /\s/.test(txt[i])) i++;
      if (txt[i] === '/' && txt[i + 1] === '/') { while (i < n && txt[i] !== '\n') i++; continue; }
      break;
    }
    if (i >= n) return null;
    const c = txt[i];
    if (c === '{' || c === '}') { i++; return c; }
    if (c === '"') { let e = i + 1; while (e < n && txt[e] !== '"') e++; const s = txt.slice(i + 1, e); i = e + 1; return { s, q: true }; }
    let e = i; while (e < n && !/[\s{}"]/.test(txt[e])) e++; const s = txt.slice(i, e); i = e; return { s };
  };
  const bloque = () => {
    const o = {};
    for (;;) {
      const k = tok(); if (k === null || k === '}') return o;
      if (k === '{') { bloque(); continue; }
      let v = tok(); if (v === null) return o;
      // (condicionales como [$X360] van después del valor)
      const esCond = (t) => t && t.s !== undefined && (t.q ? /^\[!?\$\w/.test(t.s) : /^\[.*\]$/.test(t.s));
      if (esCond(v)) v = tok();
      const key = (k.s || '').toLowerCase();
      if (v === '{') { const sub = bloque(); if (!(key in o)) o[key] = sub; }
      else if (v && v.s !== undefined) { const save = i, t2 = tok(); if (!esCond(t2)) i = save; if (!(key in o)) o[key] = v.s; }
    }
  };
  const raiz = tok(); if (!raiz || raiz.s === undefined) return null;
  const ab = tok(); if (ab !== '{') return null;
  return { shader: raiz.s.toLowerCase(), k: bloque() };
};
GMF.vmt = function (bytes, buscar) {
  let m = GMF.kv(_tl.decode(bytes)); if (!m) return null;
  // "patch": otro .vmt con cambios encima
  for (let k = 0; m.shader === 'patch' && k < 4; k++) {
    const inc = m.k.include, base = inc && buscar ? buscar(inc.toLowerCase().replace(/\\/g, '/').replace(/^\/*materials\//, '')) : null, b2 = base ? GMF.kv(_tl.decode(base)) : null;
    const extra = Object.assign({}, m.k.insert || {}, m.k.replace || {});
    m = b2 ? { shader: b2.shader, k: Object.assign(b2.k, extra) } : { shader: 'vertexlitgeneric', k: extra };
  }
  const k = m.k, num = (x, d) => (x === undefined ? d : +x);
  // (bloques condicionales: ">=DX90" { $basetexture ... }, "GPU>=1", "LightmappedGeneric_DX6"... lo que falta arriba se toma
  // de ahí, primero de los de placas nuevas (>=): un material de HL2 dejaba la textura sólo en ">=DX90" y se veía blanco)
  const cond = Object.keys(k).filter((x) => k[x] && typeof k[x] === 'object' && x !== 'proxies' && x !== 'insert' && x !== 'replace' && /^[<>]|dx\d|gpu|srgb|ldr|hdr/i.test(x));
  cond.sort((a, b) => (/^>/.test(b) ? 1 : 0) - (/^>/.test(a) ? 1 : 0) || (/_dx[5-8]$|^</.test(a) ? 1 : 0) - (/_dx[5-8]$|^</.test(b) ? 1 : 0));
  for (const c of cond) for (const [kk, vv] of Object.entries(k[c])) if (k[kk] === undefined) k[kk] = vv;
  const vec = (x) => { if (x === undefined) return null; const v = String(x).replace(/[\[\]{}]/g, ' ').trim().split(/\s+/).map(Number); return v.length >= 3 && v.every(Number.isFinite) ? (/\{/.test(x) ? v.slice(0, 3).map((c) => c / 255) : v.slice(0, 3)) : null; };
  const ruta = (x) => (x ? String(x).toLowerCase().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.vtf$/, '') : null);
  // (el espejo de la textura: "scale" de $basetexturetransform, o el de un proxy TextureTransform —scaleVar, la variable con
  // la escala—; la mira del sniper de TF2 dibuja los cuatro cuartos con una sola textura espejada así)
  const espejo = (() => { const tp = k.proxies && k.proxies.texturetransform, rv = tp && String(tp.resultvar || '').toLowerCase();
    const sv = tp && tp.scalevar && (rv === '$basetexturetransform' || (rv === '$bumptransform' && /refract/.test(m.shader))) ? k[String(tp.scalevar).toLowerCase()] : undefined;
    const de = (x) => { const v = String(x).replace(/[\[\]{}]/g, ' ').trim().split(/\s+/).map(Number); return v.length >= 2 && v.every(Number.isFinite) ? [Math.sign(v[0]) || 1, Math.sign(v[1]) || 1] : null; };
    if (sv !== undefined) return de(sv); const bt = k.$basetexturetransform && /scale\s+(\S+)\s+(\S+)/i.exec(String(k.$basetexturetransform)); return bt ? de(bt[1] + ' ' + bt[2]) : null; })();
  return {
    shader: m.shader, base: ruta(k.$basetexture), bump: ruta(k.$bumpmap), detalle: ruta(k.$detail), tinte: ruta(k.$refracttinttexture), espejo,
    trans: num(k.$translucent, 0) !== 0 || num(k.$alpha, 1) < 1, alfa: num(k.$alpha, 1), corte: num(k.$alphatest, 0) !== 0, umbral: num(k.$alphatestreference, 0.5),
    suma: num(k.$additive, 0) !== 0, dosLados: num(k.$nocull, 0) !== 0, brilla: num(k.$selfillum, 0) !== 0,
    sinLuz: /unlit|sprite|spritecard/.test(m.shader), color: vec(k.$color2) || vec(k.$color), env: !!k.$envmap, phong: num(k.$phong, 0) !== 0,
    vcolor: num(k.$vertexcolor, 0) !== 0, superficie: k.$surfaceprop ? String(k.$surfaceprop).toLowerCase() : null,
    anim: k.proxies && (k.proxies.animatedtexture || k.proxies.texturescroll) ? true : false,
    nodraw: num(k.$no_draw, 0) !== 0 || num(k['%nodraw'], 0) !== 0,
  };
};

// ---------------- .vtf: texturas ----------------
// formatos de Source → bytes por píxel (0 = comprimido en bloques de 4×4)
const VTF_BPP = { 0: 4, 1: 4, 2: 3, 3: 3, 4: 2, 5: 1, 6: 2, 7: 1, 8: 1, 9: 3, 10: 3, 11: 4, 12: 4, 13: 0, 14: 0, 15: 0, 16: 4, 17: 2, 18: 2, 19: 2, 20: 0, 21: 2, 22: 2, 23: 4, 24: 8, 25: 8, 26: 4 };
const vtfTam = (f, w, h) => { if (f === 13 || f === 20) return Math.max(1, (w + 3) >> 2) * Math.max(1, (h + 3) >> 2) * 8; if (f === 14 || f === 15) return Math.max(1, (w + 3) >> 2) * Math.max(1, (h + 3) >> 2) * 16; return w * h * (VTF_BPP[f] || 4); };
// lee la cabecera y elige el nivel de detalle que entra en "max" (del cuadro 0, cara 0)
// (el nivel elegido: dónde empieza y cuánto mide; sólo hace falta la cabecera)
function vtfCab(b, max) {
  if (!(b[0] === 0x56 && b[1] === 0x54 && b[2] === 0x46 && b[3] === 0)) throw new Error('no es un .vtf');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), vmen = dv.getUint32(8, true), hdr = dv.getUint32(12, true);
  const w0 = dv.getUint16(16, true), h0 = dv.getUint16(18, true), flags = dv.getUint32(20, true), frames = Math.max(1, dv.getUint16(24, true));
  const fmt = dv.getInt32(52, true), nmip = b[56], lfmt = dv.getInt32(57, true), lw = b[61], lh = b[62];
  const prof = vmen >= 2 ? Math.max(1, dv.getUint16(63, true)) : 1;
  const caras = !(flags & 0x4000) ? 1 : vmen < 5 && dv.getUint16(26, true) !== 0xffff ? 7 : 6;   // (los cubemaps anteriores a 7.5 traen 7: la esfera)
  let off = -1;
  if (vmen >= 3) {
    const nr = dv.getUint32(68, true);
    for (let r = 0; r < nr; r++) { const o = 80 + r * 8; if (b[o] === 0x30 && b[o + 1] === 0 && b[o + 2] === 0) { off = dv.getUint32(o + 4, true); break; } }
  }
  if (off < 0) off = hdr + (lfmt >= 0 && lw && lh ? vtfTam(lfmt, lw, lh) : 0);
  // los niveles van del más chico al más grande
  let o = off, elegido = null;
  for (let m = nmip - 1; m >= 0; m--) {
    const w = Math.max(1, w0 >> m), h = Math.max(1, h0 >> m), t = vtfTam(fmt, w, h), d = Math.max(1, prof >> m);
    if (!elegido || (Math.max(w, h) <= (max || 1e9))) elegido = { w, h, o, t };
    o += t * frames * caras * d;
  }
  if (!elegido) throw new Error('vtf sin niveles');
  return { w: elegido.w, h: elegido.h, fmt, o: elegido.o, t: elegido.t, alfa: !!(flags & (0x1000 | 0x2000)) || [0, 1, 6, 8, 11, 12, 14, 15, 19, 20, 21, 24, 25].includes(fmt), frames, flags };
}
GMF.vtf = function (b, max) {
  const c = vtfCab(b, max); if (c.o + c.t > b.length) throw new Error('vtf cortado');
  return { w: c.w, h: c.h, fmt: c.fmt, datos: b.subarray(c.o, c.o + c.t), alfa: c.alfa, frames: c.frames, flags: c.flags };
};
// hasta qué byte hay que leer un .vtf para tener el nivel que entra en "max" (los chicos vienen primero)
GMF.vtfFin = function (b, max) { const c = vtfCab(b, max); return c.o + c.t; };
// a RGBA de 8 bits (para subir a la GPU sin compresión, o cuando el aparato no tiene S3TC)
const _c565 = (c, o, i) => { const r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31; o[i] = (r << 3) | (r >> 2); o[i + 1] = (g << 2) | (g >> 4); o[i + 2] = (b << 3) | (b >> 2); };
function dxtBloque(src, s, out, w, h, x0, y0, tipo) {
  const ac = tipo === 1 ? 0 : 8, c0 = src[s + ac] | src[s + ac + 1] << 8, c1 = src[s + ac + 2] | src[s + ac + 3] << 8;
  const P = new Uint8Array(16); _c565(c0, P, 0); _c565(c1, P, 4); P[3] = P[7] = 255;
  if (c0 > c1 || tipo !== 1) { for (let k = 0; k < 3; k++) { P[8 + k] = (2 * P[k] + P[4 + k] + 1) / 3 | 0; P[12 + k] = (P[k] + 2 * P[4 + k] + 1) / 3 | 0; } P[11] = P[15] = 255; }
  else { for (let k = 0; k < 3; k++) P[8 + k] = (P[k] + P[4 + k]) >> 1; P[11] = 255; P[12] = P[13] = P[14] = 0; P[15] = 0; }
  const idx = src[s + ac + 4] | src[s + ac + 5] << 8 | src[s + ac + 6] << 16 | src[s + ac + 7] << 24;
  let A = null;
  if (tipo === 3) { A = new Uint8Array(16); for (let k = 0; k < 16; k++) { const v = (src[s + (k >> 1)] >> ((k & 1) * 4)) & 15; A[k] = v * 17; } }
  else if (tipo === 5) {
    const a0 = src[s], a1 = src[s + 1], T = [a0, a1]; A = new Uint8Array(16);
    if (a0 > a1) for (let k = 1; k < 7; k++) T.push(((7 - k) * a0 + k * a1) / 7 | 0); else { for (let k = 1; k < 5; k++) T.push(((5 - k) * a0 + k * a1) / 5 | 0); T.push(0, 255); }
    let bits = 0, nb = 0, p = s + 2;
    for (let k = 0; k < 16; k++) { while (nb < 3) { bits |= src[p++] << nb; nb += 8; } A[k] = T[bits & 7]; bits >>>= 3; nb -= 3; }
  }
  for (let k = 0; k < 16; k++) {
    const x = x0 + (k & 3), y = y0 + (k >> 2); if (x >= w || y >= h) continue;
    const c = (idx >>> (2 * k)) & 3, d = (y * w + x) * 4;
    out[d] = P[c * 4]; out[d + 1] = P[c * 4 + 1]; out[d + 2] = P[c * 4 + 2]; out[d + 3] = A ? A[k] : P[c * 4 + 3];
  }
}
const _h2f = (h) => { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023; return e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * 2 ** (e - 15); };
GMF.vtfRGBA = function (t) {
  const { w, h, fmt, datos: s } = t, n = w * h, o = new Uint8Array(n * 4);
  if (fmt === 13 || fmt === 20 || fmt === 14 || fmt === 15) {
    const tb = fmt === 14 ? 3 : fmt === 15 ? 5 : 1, bs = tb === 1 ? 8 : 16, bw = Math.max(1, (w + 3) >> 2), bh = Math.max(1, (h + 3) >> 2);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) dxtBloque(s, (by * bw + bx) * bs, o, w, h, bx * 4, by * 4, tb);
    return o;
  }
  for (let i = 0; i < n; i++) {
    const d = i * 4; let r, g, b, a = 255;
    switch (fmt) {
      case 0: r = s[i * 4]; g = s[i * 4 + 1]; b = s[i * 4 + 2]; a = s[i * 4 + 3]; break;
      case 1: a = s[i * 4]; b = s[i * 4 + 1]; g = s[i * 4 + 2]; r = s[i * 4 + 3]; break;
      case 2: case 9: r = s[i * 3]; g = s[i * 3 + 1]; b = s[i * 3 + 2]; if (fmt === 9 && r === 0 && g === 0 && b === 255) a = 0; break;
      case 3: case 10: b = s[i * 3]; g = s[i * 3 + 1]; r = s[i * 3 + 2]; if (fmt === 10 && r === 0 && g === 0 && b === 255) a = 0; break;
      case 4: { const c = s[i * 2] | s[i * 2 + 1] << 8; r = ((c >> 11) & 31) * 255 / 31; g = ((c >> 5) & 63) * 255 / 63; b = (c & 31) * 255 / 31; break; }
      case 17: { const c = s[i * 2] | s[i * 2 + 1] << 8; b = ((c >> 11) & 31) * 255 / 31; g = ((c >> 5) & 63) * 255 / 63; r = (c & 31) * 255 / 31; break; }
      case 5: r = g = b = s[i]; break;
      case 6: r = g = b = s[i * 2]; a = s[i * 2 + 1]; break;
      case 8: r = g = b = 255; a = s[i]; break;
      case 11: a = s[i * 4]; r = s[i * 4 + 1]; g = s[i * 4 + 2]; b = s[i * 4 + 3]; break;
      case 12: b = s[i * 4]; g = s[i * 4 + 1]; r = s[i * 4 + 2]; a = s[i * 4 + 3]; break;
      case 16: b = s[i * 4]; g = s[i * 4 + 1]; r = s[i * 4 + 2]; break;
      case 18: case 21: { const c = s[i * 2] | s[i * 2 + 1] << 8; b = ((c >> 10) & 31) * 255 / 31; g = ((c >> 5) & 31) * 255 / 31; r = (c & 31) * 255 / 31; if (fmt === 21) a = c & 0x8000 ? 255 : 0; break; }
      case 19: { const c = s[i * 2] | s[i * 2 + 1] << 8; b = ((c >> 12) & 15) * 17; g = ((c >> 8) & 15) * 17; r = ((c >> 4) & 15) * 17; a = (c & 15) * 17; break; }
      case 22: r = s[i * 2]; g = s[i * 2 + 1]; b = 255; break;
      case 23: case 26: r = s[i * 4]; g = s[i * 4 + 1]; b = s[i * 4 + 2]; a = s[i * 4 + 3]; break;
      case 24: { const f = (k) => { const v = _h2f(s[i * 8 + k * 2] | s[i * 8 + k * 2 + 1] << 8); return Math.round(255 * Math.pow(Math.max(0, v / (1 + v)), 1 / 2.2)); }; r = f(0); g = f(1); b = f(2); a = Math.min(255, Math.round(255 * _h2f(s[i * 8 + 6] | s[i * 8 + 7] << 8))); break; }
      case 25: r = s[i * 8 + 1]; g = s[i * 8 + 3]; b = s[i * 8 + 5]; a = s[i * 8 + 7]; break;
      default: r = 255; g = 0; b = 255;
    }
    o[d] = r; o[d + 1] = g; o[d + 2] = b; o[d + 3] = a;
  }
  return o;
};

// ---------------- .mdl + .vvd + .vtx: modelos ----------------
const _cs = (b, o) => { let e = o; while (e < b.length && b[e] !== 0) e++; return _tl.decode(b.subarray(o, e)); };
GMF.mdl = function (mdl, vvd, vtx) {
  const dv = new DataView(mdl.buffer, mdl.byteOffset, mdl.byteLength), i32 = (o) => dv.getInt32(o, true), f32 = (o) => dv.getFloat32(o, true);
  if (!(mdl[0] === 0x49 && mdl[1] === 0x44 && mdl[2] === 0x53 && mdl[3] === 0x54)) throw new Error('no es un .mdl');
  const M = { version: i32(4), nombre: _cs(mdl, 12), hull: [[f32(104), f32(108), f32(112)], [f32(116), f32(120), f32(124)]], flags: i32(152) };
  const nb = i32(156), bi = i32(160);
  M.huesos = [];
  for (let k = 0; k < nb; k++) {
    const o = bi + k * 216, P = (j) => [f32(o + j), f32(o + j + 4), f32(o + j + 8)];
    const p2b = []; for (let j = 0; j < 12; j++) p2b.push(f32(o + 96 + j * 4));
    // (los huesos procedurales de Valve —muñeca, cúbito, codo, bíceps, rodilla de los ValveBiped—: STUDIO_PROC_QUATINTERP, el
    // giro y el lugar sale de mezclar los de cada "disparador" según cuánto se parece el giro del hueso de control)
    let proc = null; const pt = i32(o + 164), pix = i32(o + 168);
    if (pt === 2 && pix > 0 && o + pix + 12 <= mdl.length) {
      const b0 = o + pix, ctrl = i32(b0), nt = i32(b0 + 4), ti = i32(b0 + 8), tr = [];
      for (let t = 0; t < Math.min(nt, 32); t++) { const q = b0 + ti + t * 48; if (q + 48 > mdl.length) break; tr.push({ inv: f32(q), tq: [f32(q + 4), f32(q + 8), f32(q + 12), f32(q + 16)], pos: [f32(q + 20), f32(q + 24), f32(q + 28)], q: [f32(q + 32), f32(q + 36), f32(q + 40), f32(q + 44)] }); }
      if (tr.length && ctrl >= 0 && ctrl < nb) proc = { ctrl, tr };
    }
    M.huesos.push({ n: _cs(mdl, o + i32(o)), pa: i32(o + 4), pos: P(32), q: [f32(o + 44), f32(o + 48), f32(o + 52), f32(o + 56)], rot: P(60), ps: P(72), rs: P(84), p2b, superficie: _cs(mdl, o + i32(o + 160)), proc });
  }
  const ntex = i32(204), txi = i32(208), ncd = i32(212), cdi = i32(216), nsr = i32(220), nsf = i32(224), ski = i32(228), nbp = i32(232), bpi = i32(236);
  M.texturas = []; for (let k = 0; k < ntex; k++) { const o = txi + k * 64; M.texturas.push(_cs(mdl, o + i32(o)).toLowerCase().replace(/\\/g, '/')); }
  M.carpetas = []; for (let k = 0; k < ncd; k++) M.carpetas.push(_cs(mdl, i32(cdi + k * 4)).toLowerCase().replace(/\\/g, '/').replace(/^\/+/, ''));
  M.pieles = []; for (let f = 0; f < Math.max(1, nsf); f++) { const L = []; for (let r = 0; r < nsr; r++) L.push(dv.getInt16(ski + (f * nsr + r) * 2, true)); M.pieles.push(L); }
  const nat = i32(240), ati = i32(244); M.adjuntos = [];
  for (let k = 0; k < nat; k++) { const o = ati + k * 92, m = []; for (let j = 0; j < 12; j++) m.push(f32(o + 12 + j * 4)); M.adjuntos.push({ n: _cs(mdl, o + i32(o)), hueso: i32(o + 8), m }); }
  M.cuerpos = [];
  for (let k = 0; k < nbp; k++) {
    const o = bpi + k * 16, nn = i32(o), nm = i32(o + 4), mi = i32(o + 12), mods = [];
    for (let j = 0; j < nm; j++) {
      const mo = o + mi + j * 148, nme = i32(mo + 72), nmi = i32(mo + 76), nv = i32(mo + 80), vi = i32(mo + 84), mallas = [];
      for (let t = 0; t < nme; t++) { const me = mo + nmi + t * 116; mallas.push({ mat: i32(me), nv: i32(me + 8), voff: i32(me + 12) }); }
      mods.push({ n: _cs(mdl, mo), nv, vi: vi / 48, mallas });
    }
    M.cuerpos.push({ n: _cs(mdl, o + nn), modelos: mods });
  }
  // las animaciones (descriptores) y las secuencias (nombre, actividad, bucle, su primera animación)
  // (hasta 4096 y 2048, mientras quepan en el archivo: m_anm.mdl, las animaciones de los modelos de jugador de GMod, trae
  // 1563 animaciones y 464 secuencias; con el tope de antes —600 y 400— las que pasaban de ahí quedaban sin animación y un
  // nextbot que pedía una —el SCP-049 persigue con swim_idle_pistol, la animación 897— se deslizaba en la pose de referencia)
  const nan = i32(180), ani = i32(184); M.anims = [];
  for (let k = 0; k < Math.min(nan, 4096) && ani + k * 100 + 100 <= mdl.length; k++) { const o = ani + k * 100; M.anims.push({ n: _cs(mdl, o + i32(o + 4)), o, fps: f32(o + 8), flags: i32(o + 12), nf: i32(o + 16), bloque: i32(o + 52), idx: i32(o + 56), sidx: i32(o + 80), sfr: i32(o + 84) });
    // (lo que avanza la animación —los «walkframes»: mstudiomovement_t, por tramos de cuadros—; de ahí sale la velocidad de
    // suelo de cada secuencia, con la que los nextbots de DrGBase con UseWalkframes caminan y ajustan el paso)
    const nm = i32(o + 20), mi = i32(o + 24);
    if (nm > 0 && nm <= 64 && mi > 0 && o + mi + nm * 44 <= mdl.length) { const L = []; for (let j = 0; j < nm; j++) { const q = o + mi + j * 44; L.push({ fin: i32(q), v0: f32(q + 8), v1: f32(q + 12), ang: f32(q + 16), vec: [f32(q + 20), f32(q + 24), f32(q + 28)], pos: [f32(q + 32), f32(q + 36), f32(q + 40)] }); } M.anims[k].mov = L; } }
  const nseq = i32(188), sqi = i32(192); M.secuencias = [];
  for (let k = 0; k < Math.min(nseq, 2048) && sqi + k * 212 + 212 <= mdl.length; k++) {
    const o = sqi + k * 212, fl = i32(o + 12), aii = i32(o + 60);
    let anim = -1; try { anim = dv.getInt16(o + aii, true); } catch (e) {}
    // (las mezclas: una grilla de g[0]×g[1] animaciones según uno o dos parámetros de pose —move_x/move_y al caminar, la
    // mira—; y el peso por hueso, para las capas)
    const g = [Math.max(1, i32(o + 68)), Math.max(1, i32(o + 72))], q = { n: _cs(mdl, o + i32(o + 4)), act: _cs(mdl, o + i32(o + 8)), peso: i32(o + 16), flags: fl, loop: !!(fl & 1), anim, o, wl: i32(o + 156) };
    if (g[0] * g[1] > 1 && g[0] * g[1] <= 64) { q.g = g; q.par = [i32(o + 76), i32(o + 80)]; q.ps = [f32(o + 84), f32(o + 88)]; q.pe = [f32(o + 92), f32(o + 96)]; q.grid = []; try { for (let j = 0; j < g[0] * g[1]; j++) q.grid.push(dv.getInt16(o + aii + j * 2, true)); } catch (e) { q.grid = null; }
      // (las «pose keys»: el valor del parámetro en cada columna/fila de la grilla, cuando no están parejas)
      const pk = i32(o + 160); if (pk > 0 && o + pk + (g[0] + g[1]) * 4 <= mdl.length) q.claves = [0, 1].map((a) => { const L = []; for (let j = 0; j < g[a]; j++) L.push(f32(o + pk + (a * g[0] + j) * 4)); return L; }); }
    // (los eventos de la animación —el golpe de un zombie, los pasos—: en qué parte de la secuencia y con qué datos; el
    // motor los manda a ENT:HandleAnimEvent. Cada uno: ciclo, número, tipo, opciones y su nombre si es de los nuevos)
    const nev = i32(o + 24), evi = i32(o + 28);
    if (nev > 0 && nev <= 64 && evi > 0) { q.ev = []; for (let j = 0; j < nev; j++) { const eo = o + evi + j * 80; if (eo + 80 > mdl.length) break; const ni = i32(eo + 76); q.ev.push({ c: f32(eo), ev: i32(eo + 4), tipo: i32(eo + 8), op: _cs(mdl, eo + 12), n: ni ? _cs(mdl, eo + ni) : '' }); } }
    M.secuencias.push(q);
  }
  M.poseParams = []; M.poseRangos = []; { const npp = i32(300), ppi = i32(304); for (let k = 0; k < Math.min(npp, 32); k++) { const o = ppi + k * 20; if (o + 20 > mdl.length) break; M.poseParams.push(_cs(mdl, o + i32(o))); M.poseRangos.push([f32(o + 8), f32(o + 12)]); } }
  // los bloques de animación: el .ani (su nombre) y dónde empieza y termina cada bloque dentro de él (GMF.pose)
  M.aniNom = ''; M.bloques = []; { const no = i32(348), nbl = i32(352), bli = i32(356);
    if (nbl > 1 && nbl < 4096 && bli > 0 && bli + nbl * 8 <= mdl.length) { for (let k = 0; k < nbl; k++) M.bloques.push([i32(bli + k * 8), i32(bli + k * 8 + 4)]); if (no > 0 && no < mdl.length) M.aniNom = _cs(mdl, no).toLowerCase().replace(/\\/g, '/').replace(/^\/+/, ''); } }
  M.b = mdl;
  if (vvd && vtx) GMF._geo(M, vvd, vtx);
  return M;
};
// la pose local (posición y cuaternión) de cada hueso en el cuadro entero "f" de la animación ia, como el motor de Source:
// cuaterniones crudos de 48 o 64 bits, ángulos y posiciones comprimidos con RLE (en secciones); lo que no está animado
// queda en la pose de referencia; las animaciones "delta" parten de cero
GMF.pose = function (M, ia, f) {
  if (M.anims[ia] && M.anims[ia].src) return GMF._poseIncluida(M, M.anims[ia], f);   // (de un modelo incluido)
  const H = M.huesos, nb = H.length, P = new Float32Array(nb * 3), Q = new Float32Array(nb * 4), A = M.anims[ia];
  const delta = A && !!(A.flags & 4);
  for (let k = 0; k < nb; k++) { const h = H[k]; if (delta) { Q[k * 4 + 3] = 1; continue; } P.set(h.pos, k * 3); Q.set(h.q, k * 4); }
  if (!A) return { P, Q, ok: false };
  // dónde están los datos de este cuadro: en el .mdl o en un bloque de animación del .ani (los NPC de HL2 —zombies,
  // hormigas león, headcrabs, combine— y las animaciones de los modelos de jugador de GMod, m_anm, están todas en el
  // .ani: sin leerlo quedaban en la pose de referencia, la pose T); por secciones, cada sección dice su bloque
  const bm = M.b, dvm = new DataView(bm.buffer, bm.byteOffset, bm.byteLength);
  f = Math.max(0, Math.min(A.nf - 1, f | 0));
  let blk = A.bloque, idx = A.idx;
  if (A.sfr) { const sec = Math.floor(f / A.sfr), so = A.o + A.sidx + sec * 8; if (so + 8 > bm.length) return { P, Q, ok: false }; blk = dvm.getInt32(so, true); idx = dvm.getInt32(so + 4, true); f -= sec * A.sfr; }
  let b, o;
  if (blk === 0) { b = bm; o = A.o + idx; }
  else { const bl = M.bloques && M.bloques[blk]; if (!M.ani || !bl || blk < 0) return { P, Q, ok: false, falta: !!bl && !M.ani }; b = M.ani; o = bl[0] + idx; }
  const dv = b === bm ? dvm : new DataView(b.buffer, b.byteOffset, b.byteLength), i16 = (o) => dv.getInt16(o, true), u16 = (o) => dv.getUint16(o, true);
  const valor = (o, k, esc) => { for (let n = 0; n < 4096; n++) { const valid = b[o], total = b[o + 1]; if (total === 0) return 0; if (total > k) return (valid > k ? i16(o + (k + 1) * 2) : i16(o + valid * 2)) * esc; k -= total; o += (valid + 1) * 2; } return 0; };
  const aq = (x, y, z) => { const sr = Math.sin(x / 2), cr = Math.cos(x / 2), sp = Math.sin(y / 2), cp = Math.cos(y / 2), sy = Math.sin(z / 2), cy = Math.cos(z / 2); const srcp = sr * cp, crsp = cr * sp, crcp = cr * cp, srsp = sr * sp; return [srcp * cy - crsp * sy, crsp * cy + srcp * sy, crcp * sy - srsp * cy, crcp * cy + srsp * sy]; };
  for (let guard = 0; guard < 512 && o > 0 && o + 4 <= b.length; guard++) {
    const hb = b[o], fl = b[o + 1], nxt = i16(o + 2); if (hb >= nb) break;
    const h = H[hb]; let d = o + 4;
    if (fl & 0x02) { const x = u16(d), y = u16(d + 2), zw = u16(d + 4), qx = (x - 32768) / 32768, qy = (y - 32768) / 32768, qz = ((zw & 0x7fff) - 16384) / 16384, qw = Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy - qz * qz)) * (zw >> 15 ? -1 : 1); Q[hb * 4] = qx; Q[hb * 4 + 1] = qy; Q[hb * 4 + 2] = qz; Q[hb * 4 + 3] = qw; d += 6; }
    else if (fl & 0x20) { const lo = dv.getUint32(d, true), hi = dv.getUint32(d + 4, true), v = (BigInt(hi) << 32n) | BigInt(lo), m = 0x1fffffn; const qx = Number((v & m) - 1048576n) / 1048576.5, qy = Number(((v >> 21n) & m) - 1048576n) / 1048576.5, qz = Number(((v >> 42n) & m) - 1048576n) / 1048576.5, qw = Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy - qz * qz)) * (v >> 63n ? -1 : 1); Q[hb * 4] = qx; Q[hb * 4 + 1] = qy; Q[hb * 4 + 2] = qz; Q[hb * 4 + 3] = qw; d += 8; }
    else if (fl & 0x08) { const a = [0, 1, 2].map((i) => { const of = i16(d + i * 2); return of ? valor(d + of, f, h.rs[i]) : 0; }); if (!delta) { a[0] += h.rot[0]; a[1] += h.rot[1]; a[2] += h.rot[2]; } Q.set(aq(a[0], a[1], a[2]), hb * 4); d += 6; }
    if (fl & 0x01) { for (let i = 0; i < 3; i++) P[hb * 3 + i] = _h2f(u16(d + i * 2)); }
    else if (fl & 0x04) { for (let i = 0; i < 3; i++) { const of = i16(d + i * 2), v = of ? valor(d + of, f, h.ps[i]) : 0; P[hb * 3 + i] = delta ? v : v + h.pos[i]; } }
    if (nxt === 0) break; o += nxt;
  }
  return { P, Q, ok: true };
};
// los modelos incluidos ($includemodel): los NPC de HL2 (ciudadanos, policías), los modelos de jugador (m_anm.mdl) y
// muchos NPC y nextbots del Workshop guardan sus animaciones en otros .mdl, y Source las suma al modelo (un modelo
// «virtual»). Sin ellas no había secuencias que elegir y el modelo quedaba en su pose de referencia: la pose T
// (Discord: «DrGBase: se queda todo pose T»). Los nombres, como en el .mdl: se buscan con «models/» adelante
GMF.incluidos = function (M) {
  const b = M.b; if (!b || b.length < 344) return [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), n = dv.getInt32(336, true), o = dv.getInt32(340, true), L = [];
  if (!(n > 0 && n <= 32 && o > 0 && o + n * 8 <= b.length)) return L;
  for (let j = 0; j < n; j++) {
    const so = o + j * 8, ni = dv.getInt32(so + 4, true); if (!ni || so + ni >= b.length) continue;
    let r = _cs(b, so + ni).toLowerCase().replace(/\\/g, '/').replace(/^\/+/, ''); if (!r) continue;
    if (!/^models\//.test(r)) r = 'models/' + r; if (!/\.mdl$/.test(r)) r += '.mdl'; if (!L.includes(r)) L.push(r);
  }
  return L;
};
// suma al modelo las animaciones y las secuencias de uno incluido: sus huesos se emparejan por nombre (lo que el
// incluido no tiene queda en la pose del modelo), los parámetros de pose por nombre, y una secuencia que el modelo ya
// tiene con ese nombre queda la del modelo (como Source)
GMF.unirIncluido = function (M, IM) {
  if (!IM || !IM.anims || !IM.secuencias || !IM.huesos) return 0;
  const nom = new Map(); M.huesos.forEach((h, i) => { const k = String(h.n).toLowerCase(); if (!nom.has(k)) nom.set(k, i); });
  const mapa = IM.huesos.map((h) => { const k = String(h.n).toLowerCase(); return nom.has(k) ? nom.get(k) : -1; });
  if (!mapa.some((k) => k >= 0)) return 0;   // (otro esqueleto: no sirve)
  const base = M.anims.length;
  for (let k = 0; k < IM.anims.length; k++) M.anims.push(Object.assign({}, IM.anims[k], { src: IM, srcI: k, mapa }));
  M.poseParams = M.poseParams || []; M.poseRangos = M.poseRangos || [];
  const pp = (i) => { const n = IM.poseParams && IM.poseParams[i]; if (n === undefined) return i; let j = M.poseParams.indexOf(n); if (j < 0) { M.poseParams.push(n); M.poseRangos.push((IM.poseRangos && IM.poseRangos[i]) || [0, 1]); j = M.poseParams.length - 1; } return j; };
  (IM.poseParams || []).forEach((n, i) => pp(i));   // (todos los del incluido: move_x, move_y, aim_yaw...)
  const ya = new Set(M.secuencias.map((q) => String(q.n).toLowerCase()));
  let n = 0;
  for (const q of IM.secuencias) {
    const k = String(q.n).toLowerCase(); if (ya.has(k)) continue;
    const c = Object.assign({}, q, { anim: q.anim >= 0 ? q.anim + base : -1, inc: true });
    if (q.grid) c.grid = q.grid.map((a) => (a >= 0 ? a + base : a));
    if (q.par) c.par = q.par.map(pp);
    M.secuencias.push(c); ya.add(k); n++;
  }
  return n;
};
// la pose de una animación de un modelo incluido, llevada a los huesos del modelo
GMF._poseIncluida = function (M, A0, f) {
  const r = GMF.pose(A0.src, A0.srcI, f), H = M.huesos, nb = H.length, P = new Float32Array(nb * 3), Q = new Float32Array(nb * 4), delta = !!(A0.flags & 4);
  for (let k = 0; k < nb; k++) { const h = H[k]; if (delta) { Q[k * 4 + 3] = 1; continue; } P.set(h.pos, k * 3); Q.set(h.q, k * 4); }
  if (!r.ok) return { P, Q, ok: false, falta: !!r.falta };
  const mapa = A0.mapa;
  for (let j = 0; j < mapa.length; j++) { const k = mapa[j]; if (k < 0) continue; P[k * 3] = r.P[j * 3]; P[k * 3 + 1] = r.P[j * 3 + 1]; P[k * 3 + 2] = r.P[j * 3 + 2]; Q[k * 4] = r.Q[j * 4]; Q[k * 4 + 1] = r.Q[j * 4 + 1]; Q[k * 4 + 2] = r.Q[j * 4 + 2]; Q[k * 4 + 3] = r.Q[j * 4 + 3]; }
  return { P, Q, ok: true };
};
// la animación de una secuencia con los parámetros de pose dados (por nombre; los que faltan, en 0): en una mezcla, la
// celda de la grilla más cercana (caminar para adelante es move_x = 1, move_y = 0, que en la grilla de 3×3 de los modelos
// de jugador es la del medio de un borde; la primera celda es una esquina, en diagonal o de costado)
GMF.animDe = function (M, k, vals) {
  const q = M.secuencias[k]; if (!q) return -1;
  if (!q.grid || !q.grid.length) return q.anim;
  let a = -1, w = -1; for (const x of GMF.mezcla(M, k, vals)) if (x.w > w) { w = x.w; a = x.ia; }   // (la de más peso en la mezcla)
  return a >= 0 && M.anims[a] ? a : q.anim;
};
// la mezcla de una secuencia con esos parámetros de pose, como Studio_SeqAnims de Source: hasta cuatro animaciones de la
// grilla con su peso (entre las dos columnas y las dos filas que rodean el valor, o los tramos de sus «pose keys»; el
// valor fuera del rango del parámetro se recorta, como SetPoseParameter); sin grilla, la única
GMF.mezcla = function (M, k, vals) {
  const q = M.secuencias[k]; if (!q) return [];
  if (!q.grid || !q.grid.length) return q.anim >= 0 && M.anims[q.anim] ? [{ ia: q.anim, w: 1 }] : [];
  const ix = [0, 0], s = [0, 0];
  for (let a = 0; a < 2; a++) {
    const g = q.g[a], pi = q.par[a], nom = M.poseParams && M.poseParams[pi]; if (g <= 1 || pi < 0 || nom === undefined) continue;
    const R = (M.poseRangos && M.poseRangos[pi]) || [q.ps[a], q.pe[a]], lo = Math.min(R[0], R[1]), hi = Math.max(R[0], R[1]);
    const v = Math.max(lo, Math.min(hi, vals && vals[nom] !== undefined ? +vals[nom] || 0 : 0));
    let i = 0, t = 0;
    if (q.claves) { const K = q.claves[a]; for (;;) { const d = K[i + 1] - K[i]; t = Math.abs(d) > 1e-9 ? (v - K[i]) / d : 0; if (i < g - 2 && t > 1) { i++; continue; } break; } }
    else { const d = q.pe[a] - q.ps[a]; t = Math.abs(d) > 1e-9 ? Math.max(0, Math.min(1, (v - q.ps[a]) / d)) : 0; if (g > 2) { i = Math.min(g - 2, Math.floor(t * (g - 1))); t = t * (g - 1) - i; } }
    ix[a] = i; s[a] = Math.max(0, Math.min(1, t));
  }
  const L = [], g0 = q.g[0];
  const pon = (x, y, w) => { if (!(w > 1e-6)) return; const a = q.grid[x + y * g0]; if (!(a >= 0 && M.anims[a])) return; const o = L.find((e) => e.ia === a); if (o) o.w += w; else L.push({ ia: a, w }); };
  pon(ix[0], ix[1], (1 - s[0]) * (1 - s[1])); pon(ix[0] + 1, ix[1], s[0] * (1 - s[1])); pon(ix[0], ix[1] + 1, (1 - s[0]) * s[1]); pon(ix[0] + 1, ix[1] + 1, s[0] * s[1]);
  return L;
};
// lo que avanzó una animación hasta el ciclo c (Studio_AnimPosition: por los tramos de sus walkframes, en pulgadas, y el
// giro en yaw; con más de una vuelta suma las vueltas enteras); null si no tiene movimiento
const _gmfAnimPos = (A, c) => {
  const L = A.mov; if (!L || !L.length) return null;
  const vueltas = c > 1 ? Math.trunc(c) : c < 0 ? Math.trunc(c) - 1 : 0, fr = (c - vueltas) * Math.max(0, A.nf - 1);
  let ant = 0, p = [0, 0, 0], y = 0;
  for (const m of L) {
    if (m.fin >= fr) {
      const f = m.fin > ant ? (fr - ant) / (m.fin - ant) : 1, d = m.v0 * f + 0.5 * (m.v1 - m.v0) * f * f;
      p = [p[0] + d * m.vec[0], p[1] + d * m.vec[1], p[2] + d * m.vec[2]]; y = y * (1 - f) + m.ang * f;
      if (vueltas) { const u = L[L.length - 1]; p = [p[0] + vueltas * u.pos[0], p[1] + vueltas * u.pos[1], p[2] + vueltas * u.pos[2]]; y += vueltas * u.ang; }
      return { p, y };
    }
    ant = m.fin; p = m.pos.slice(); y = m.ang;
  }
  return null;
};
// lo que avanza una secuencia entre los ciclos c0 y c1 con esos parámetros de pose (Studio_SeqMovement: en los ejes de su
// arranque, pulgadas de Source, y el giro en yaw); ok: hay movimiento (o una animación quieta, que también vale)
GMF.secMov = function (M, k, vals, c0, c1) {
  const p = [0, 0, 0]; let y = 0, ok = false;
  for (const { ia, w } of GMF.mezcla(M, k, vals)) {
    const A = M.anims[ia], a = _gmfAnimPos(A, c0), b = a && _gmfAnimPos(A, c1);
    if (a && b) {
      const r = -a.y * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1];
      p[0] += (dx * cs - dy * sn) * w; p[1] += (dx * sn + dy * cs) * w; p[2] += (b.p[2] - a.p[2]) * w; y += (b.y - a.y) * w; ok = true;
    } else if (!(A.flags & 4) && !(A.mov && A.mov.length)) ok = true;
  }
  return { ok, p, y };
};
// lo que dura una secuencia con esos parámetros (Studio_Duration: la inversa de los ciclos por segundo de la mezcla)
GMF.secDur = function (M, k, vals) {
  let cps = 0; for (const { ia, w } of GMF.mezcla(M, k, vals)) { const A = M.anims[ia]; if (A && A.nf > 1) cps += ((A.fps > 0 ? A.fps : 30) / (A.nf - 1)) * w; }
  return cps > 0 ? 1 / cps : 0;
};
// la velocidad de suelo de una secuencia (GetSequenceGroundSpeed: lo que avanza en una vuelta sobre lo que dura), en
// pulgadas por segundo; 0 si no avanza (una animación hecha para moverse «en el lugar»)
GMF.secVelSuelo = function (M, k, vals) {
  const t = GMF.secDur(M, k, vals); if (!(t > 0)) return 0;
  const m = GMF.secMov(M, k, vals, 0, 1); return m.ok ? Math.hypot(m.p[0], m.p[1], m.p[2]) / t : 0;
};
// las capas que el motor de Source suma siempre (secuencias «autoplay» de diferencia): en muchos modelos de jugador del
// Workshop las animaciones son de otro esqueleto y una capa «proportions» lleva cada hueso a las medidas del modelo (el
// truco de las proporciones). Sin ella los huesos quedaban donde los tenía el otro esqueleto y la piel se estiraba (el
// perro Doge con el pecho y las patas de adelante tirados como una sábana).
GMF.capas = function (M) {
  if (M._capas) return M._capas;
  const L = [], nb = M.huesos.length, dv = new DataView(M.b.buffer, M.b.byteOffset, M.b.byteLength);
  for (const q of M.secuencias) {
    if ((q.flags & 0x0c) !== 0x0c) continue;   // (STUDIO_DELTA | STUDIO_AUTOPLAY)
    const A = M.anims[q.anim]; if (!A || A.bloque !== 0 || A.nf < 1) continue;
    let w = null; if (q.wl) { try { w = new Float32Array(nb); for (let h = 0; h < nb; h++) w[h] = dv.getFloat32(q.o + q.wl + h * 4, true); } catch (e) { w = null; } }
    L.push({ ia: q.anim, post: !!(q.flags & 0x10), w, nf: A.nf, cache: new Map() });
  }
  M._capas = L; return L;
};
// la pose de una animación con esas capas encima (como SlerpBones de Source: la posición se suma; el giro, delante
// —dq·q— o, con «predelta», detrás —q·dq—, por el peso de cada hueso)
GMF.poseCapas = function (M, ia, f) {
  const ps = GMF.pose(M, ia, f), A = M.anims[ia]; if (!ps.ok || (A && A.flags & 4)) return ps;
  const L = GMF.capas(M); if (!L.length) return ps;
  const nb = M.huesos.length, P = ps.P, Q = ps.Q;
  for (const c of L) {
    const fr = c.nf > 1 ? Math.max(0, Math.min(c.nf - 1, f | 0)) : 0;
    let d = c.cache.get(fr); if (!d) { d = GMF.pose(M, c.ia, fr); if (c.cache.size < 256 && !d.falta) c.cache.set(fr, d); }   // (sin el .ani todavía: no se guarda)
    if (!d.ok) continue;
    for (let h = 0; h < nb; h++) {
      const s = c.w ? c.w[h] : 1; if (!(s > 0)) continue;
      P[h * 3] += d.P[h * 3] * s; P[h * 3 + 1] += d.P[h * 3 + 1] * s; P[h * 3 + 2] += d.P[h * 3 + 2] * s;
      let dx = d.Q[h * 4], dy = d.Q[h * 4 + 1], dz = d.Q[h * 4 + 2], dw = d.Q[h * 4 + 3];
      if (s < 0.999) { if (dw < 0) { dx = -dx; dy = -dy; dz = -dz; dw = -dw; } dx *= s; dy *= s; dz *= s; dw = dw * s + (1 - s); }   // (hacia la identidad)
      const qx = Q[h * 4], qy = Q[h * 4 + 1], qz = Q[h * 4 + 2], qw = Q[h * 4 + 3];
      const [ax, ay, az, aw, bx, by, bz, bw] = c.post ? [qx, qy, qz, qw, dx, dy, dz, dw] : [dx, dy, dz, dw, qx, qy, qz, qw];
      let x = aw * bx + ax * bw + ay * bz - az * by, y = aw * by - ax * bz + ay * bw + az * bx, z = aw * bz + ax * by - ay * bx + az * bw, w = aw * bw - ax * bx - ay * by - az * bz;
      const l = Math.hypot(x, y, z, w) || 1; Q[h * 4] = x / l; Q[h * 4 + 1] = y / l; Q[h * 4 + 2] = z / l; Q[h * 4 + 3] = w / l;
    }
  }
  return ps;
};
// la pose con la que GMod muestra un prop: el primer cuadro de su primera secuencia, no la pose de enlace del .vvd. Casi
// siempre son iguales; en algunos modelos —los aviones de WAC— la raíz va girada −90° en la secuencia y el modelo se veía
// de costado (y su casco de choque, que está en esa pose, no coincidía). Devuelve, por hueso, la matriz 3×4 que lleva un
// vértice de la pose de enlace a la de la secuencia (S) y la de cada hueso al modelo (W); null si no cambia nada.
const _m34 = (A, B) => [A[0] * B[0] + A[1] * B[4] + A[2] * B[8], A[0] * B[1] + A[1] * B[5] + A[2] * B[9], A[0] * B[2] + A[1] * B[6] + A[2] * B[10], A[0] * B[3] + A[1] * B[7] + A[2] * B[11] + A[3],
  A[4] * B[0] + A[5] * B[4] + A[6] * B[8], A[4] * B[1] + A[5] * B[5] + A[6] * B[9], A[4] * B[2] + A[5] * B[6] + A[6] * B[10], A[4] * B[3] + A[5] * B[7] + A[6] * B[11] + A[7],
  A[8] * B[0] + A[9] * B[4] + A[10] * B[8], A[8] * B[1] + A[9] * B[5] + A[10] * B[9], A[8] * B[2] + A[9] * B[6] + A[10] * B[10], A[8] * B[3] + A[9] * B[7] + A[10] * B[11] + A[11]];
GMF.poseReposo = function (M) {
  const H = M.huesos; if (!H || !H.length || !M.anims || !M.anims.length) return null;
  // (el primer cuadro de la primera secuencia, con las capas de siempre; una animación de diferencia no es una pose)
  const s0 = M.secuencias && M.secuencias[0], ia = s0 && s0.anim >= 0 && M.anims[s0.anim] ? s0.anim : 0;
  if (M.anims[ia] && M.anims[ia].flags & 4) return null;
  let ps; try { ps = GMF.poseCapas(M, ia, 0); } catch (e) { return null; }
  if (!ps || !ps.ok) return null;
  const W = [], S = []; let cambia = false;
  for (let i = 0; i < H.length; i++) {
    const x = ps.Q[i * 4], y = ps.Q[i * 4 + 1], z = ps.Q[i * 4 + 2], w = ps.Q[i * 4 + 3];
    const L = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), ps.P[i * 3], 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), ps.P[i * 3 + 1], 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), ps.P[i * 3 + 2]];
    const pa = H[i].pa; W.push(pa >= 0 && pa < i ? _m34(W[pa], L) : L);
    const m = H[i].p2b; if (!m || m.length < 12) { S.push(null); continue; }
    const Si = _m34(W[i], m); S.push(Si);
    if (!cambia) for (let k = 0; k < 12; k++) { const id = k === 0 || k === 5 || k === 10 ? 1 : 0; if (Math.abs(Si[k] - id) > (k === 3 || k === 7 || k === 11 ? 0.5 : 2e-3)) { cambia = true; break; } }
  }
  return cambia ? { S, W } : null;
};
// los vértices (y sus normales) de la malla, llevados a esa pose
GMF.posar = function (M, RP) {
  const V = M.v, n = V.n, P = new Float32Array(n * 3), N = new Float32Array(n * 3), S = RP.S;
  for (let k = 0; k < n; k++) {
    const x = V.pos[k * 3], y = V.pos[k * 3 + 1], z = V.pos[k * 3 + 2], nx = V.nor[k * 3], ny = V.nor[k * 3 + 1], nz = V.nor[k * 3 + 2];
    let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0, wt = 0;
    for (let j = 0; j < 3; j++) {
      const w = V.w[k * 3 + j]; if (!(w > 0)) continue; const m = S[V.hb[k * 3 + j]]; if (!m) continue;
      px += w * (m[0] * x + m[1] * y + m[2] * z + m[3]); py += w * (m[4] * x + m[5] * y + m[6] * z + m[7]); pz += w * (m[8] * x + m[9] * y + m[10] * z + m[11]);
      qx += w * (m[0] * nx + m[1] * ny + m[2] * nz); qy += w * (m[4] * nx + m[5] * ny + m[6] * nz); qz += w * (m[8] * nx + m[9] * ny + m[10] * nz); wt += w;
    }
    if (wt <= 0) { const m = S[V.hb[k * 3]]; if (m) { px = m[0] * x + m[1] * y + m[2] * z + m[3]; py = m[4] * x + m[5] * y + m[6] * z + m[7]; pz = m[8] * x + m[9] * y + m[10] * z + m[11]; qx = m[0] * nx + m[1] * ny + m[2] * nz; qy = m[4] * nx + m[5] * ny + m[6] * nz; qz = m[8] * nx + m[9] * ny + m[10] * nz; } else { px = x; py = y; pz = z; qx = nx; qy = ny; qz = nz; } wt = 1; }
    P[k * 3] = px / wt; P[k * 3 + 1] = py / wt; P[k * 3 + 2] = pz / wt;
    const l = Math.hypot(qx, qy, qz) || 1; N[k * 3] = qx / l; N[k * 3 + 1] = qy / l; N[k * 3 + 2] = qz / l;
  }
  return { pos: P, nor: N };
};
GMF._geo = function (M, vvd, vtx) {
  const dv = new DataView(vvd.buffer, vvd.byteOffset, vvd.byteLength);
  if (!(vvd[0] === 0x49 && vvd[1] === 0x44 && vvd[2] === 0x53 && vvd[3] === 0x56)) throw new Error('no es un .vvd');
  const n0 = dv.getInt32(16, true), nfx = dv.getInt32(48, true), fxs = dv.getInt32(52, true), vds = dv.getInt32(56, true);
  let orden = null;
  if (nfx) { orden = []; for (let k = 0; k < nfx; k++) { const o = fxs + k * 12, lod = dv.getInt32(o, true), src = dv.getInt32(o + 4, true), num = dv.getInt32(o + 8, true); if (lod >= 0) for (let j = 0; j < num; j++) orden.push(src + j); } }
  const n = n0, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), hb = new Uint8Array(n * 3), w = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const s = orden ? orden[k] : k, o = vds + s * 48, nbn = vvd[o + 15];
    for (let c = 0; c < 3; c++) { w[k * 3 + c] = c < nbn ? dv.getFloat32(o + c * 4, true) : 0; hb[k * 3 + c] = vvd[o + 12 + c]; pos[k * 3 + c] = dv.getFloat32(o + 16 + c * 4, true); nor[k * 3 + c] = dv.getFloat32(o + 28 + c * 4, true); }
    uv[k * 2] = dv.getFloat32(o + 40, true); uv[k * 2 + 1] = dv.getFloat32(o + 44, true);
  }
  M.v = { n, pos, nor, uv, hb, w };
  const tv = new DataView(vtx.buffer, vtx.byteOffset, vtx.byteLength), nbp = tv.getInt32(28, true), bpo = tv.getInt32(32, true);
  const leer = (tam) => {
    const out = [];
    for (let k = 0; k < nbp; k++) {
      const o = bpo + k * 8, nm = tv.getInt32(o, true), mo = tv.getInt32(o + 4, true);
      for (let j = 0; j < nm; j++) {
        const om = o + mo + j * 8, lo = tv.getInt32(om + 4, true), ol = om + lo, nme = tv.getInt32(ol, true), meo = tv.getInt32(ol + 4, true);
        const mod = M.cuerpos[k] && M.cuerpos[k].modelos[j]; if (!mod) throw new Error('vtx: modelo');
        for (let t = 0; t < nme; t++) {
          const ome = ol + meo + t * 9, nsg = tv.getInt32(ome, true), sgo = tv.getInt32(ome + 4, true), mm = mod.mallas[t]; if (!mm) throw new Error('vtx: malla');
          const tris = [];
          for (let g = 0; g < nsg; g++) {
            const og = ome + sgo + g * tam, nv = tv.getInt32(og, true), vo = tv.getInt32(og + 4, true), ni = tv.getInt32(og + 8, true), io = tv.getInt32(og + 12, true);
            if (ni % 3 || nv < 0 || ni < 0 || og + io + ni * 2 > vtx.length || og + vo + nv * 9 > vtx.length) throw new Error('vtx: grupo raro');
            const base = mod.vi + mm.voff;
            for (let x = 0; x < ni; x++) {
              const ii = tv.getUint16(og + io + x * 2, true); if (ii >= nv) throw new Error('vtx: índice');
              const orig = tv.getUint16(og + vo + ii * 9 + 4, true) + base; if (orig >= n) throw new Error('vtx: fuera');
              tris.push(orig);
            }
          }
          out.push({ cuerpo: k, modelo: j, mat: mm.mat, tris: Uint32Array.from(tris) });
        }
      }
    }
    return out;
  };
  let mallas = null;
  for (const tam of [25, 33]) { try { mallas = leer(tam); break; } catch (e) { mallas = null; } }
  if (!mallas) throw new Error('vtx ilegible');
  M.mallas = mallas;
};

// ---------------- .phy: las formas de choque (casco convexo de cada sólido) ----------------
// Formato IVP "compact surface": cada sólido trae "ledges" convexos con sus triángulos y una lista de puntos (metros, ejes
// de IVP: x, -z, y de Source). Se devuelven los puntos de cada pieza convexa en el espacio de Source (pulgadas).
GMF.phy = function (b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), hs = dv.getInt32(0, true), ns = dv.getInt32(8, true);
  let p = hs; const solidos = [];
  for (let s = 0; s < ns && p + 4 < b.length; s++) {
    const tam = dv.getInt32(p, true), ini = p + 4; p = ini + tam;
    const piezas = [];
    if (b[ini] === 0x56 && b[ini + 1] === 0x50 && b[ini + 2] === 0x48 && b[ini + 3] === 0x59) {
      const cs = ini + 28;   // (cabecera VPHY: id, versión, tipo, tamaño, ejes, mapa de ejes)
      const raiz = dv.getInt32(cs + 32, true), fin = raiz > 0 ? cs + raiz : p;
      const pieza = (lp) => {
        if (lp < cs || lp + 16 > p) return;
        const ptOff = dv.getInt32(lp, true), nt = dv.getInt16(lp + 12, true);
        if (nt <= 0 || nt > 4096) return;
        const usados = new Set();
        for (let t = 0; t < nt; t++) { const to = lp + 16 + t * 16; if (to + 16 > p) return; for (let e = 0; e < 3; e++) usados.add(dv.getUint32(to + 4 + e * 4, true) & 0xffff); }
        const pts = [];
        for (const i of usados) { const o = lp + ptOff + i * 16; if (o < cs || o + 12 > p) continue; const x = dv.getFloat32(o, true), y = dv.getFloat32(o + 4, true), z = dv.getFloat32(o + 8, true); pts.push(x / 0.0254, z / 0.0254, -y / 0.0254); }
        if (pts.length >= 12) piezas.push(new Float32Array(pts));
      };
      // (las piezas convexas se encuentran recorriendo el árbol de piezas —ledgetree: cada nodo dice dónde está su hijo
      // derecho, el izquierdo va pegado, y las hojas apuntan a su pieza—; seguidas una tras otra sólo está la primera: un
      // casco "cóncavo" de muchas piezas, como el del A-10 de WAC, quedaba reducido a una caja de la cola)
      const hojas = [], visto = new Set();
      const nodo = (o, prof) => {
        if (prof > 64 || o < cs || o + 28 > p || visto.has(o) || hojas.length > 2048) return; visto.add(o);
        const der = dv.getInt32(o, true), led = dv.getInt32(o + 4, true);
        if (der === 0) { hojas.push(o + led); return; }
        nodo(o + 28, prof + 1); nodo(o + der, prof + 1);
      };
      if (raiz > 0) nodo(cs + raiz, 0);
      if (hojas.length) for (const lp of hojas) pieza(lp);
      else {   // (sin árbol: las que estén seguidas)
        let lp = cs + 48, guard = 0;
        while (lp + 16 <= fin && guard++ < 4096) { const bits = dv.getUint32(lp + 8, true), nt = dv.getInt16(lp + 12, true), tamL = (bits >>> 8) * 16; if (tamL <= 0 || nt <= 0) break; pieza(lp); lp += tamL; }
      }
    }
    solidos.push(piezas);
  }
  // (después de los sólidos: texto con los parámetros de cada uno, como "solid { "index" "0" "mass" "35" ... }")
  let texto = ''; try { texto = _tl.decode(b.subarray(Math.min(p, b.length))); } catch (e) {}
  const masa = /"mass"\s+"([\d.]+)"/i.exec(texto), mat = /"surfaceprop"\s+"([\w-]+)"/i.exec(texto);
  // cada sólido va pegado a un hueso (por su nombre): sus puntos están en el espacio de ese hueso
  const hueso = []; for (const m of texto.matchAll(/solid\s*\{([^}]*)\}/gi)) { const ix = /"index"\s+"(\d+)"/i.exec(m[1]), nm = /"name"\s+"([^"]*)"/i.exec(m[1]); if (ix) hueso[+ix[1]] = nm ? nm[1].toLowerCase() : null; }
  let masaTot = 0; for (const m of texto.matchAll(/"mass"\s+"([\d.]+)"/gi)) masaTot += +m[1];
  return { solidos, hueso, masa: masaTot || (masa ? +masa[1] : null), superficie: mat ? mat[1].toLowerCase() : null, texto };
};
// los puntos de las piezas en el espacio del modelo (con la pose de enlace de su hueso)
GMF.phyModelo = function (P, M, RP) {
  const out = [];
  P.solidos.forEach((piezas, s) => {
    // (el sólido va en el espacio del hueso que nombra; si nombra uno que el modelo no tiene —el "phy" de los aviones
    // WAC—, sus puntos ya están en el espacio del modelo tal como se ve; con la pose de reposo, la del hueso en esa pose)
    const nb = P.hueso[s], hi0 = nb ? M.huesos.findIndex((h) => h.n.toLowerCase() === nb) : 0, hi = Math.max(0, hi0), H = M.huesos[hi], m = nb && hi0 < 0 ? null : H ? H.p2b : null;
    const Wp = m && RP && RP.W[hi] ? RP.W[hi] : null;
    for (const f of piezas) {
      const g = new Float32Array(f.length);
      for (let k = 0; k < f.length; k += 3) {
        if (Wp) { const x = f[k], y = f[k + 1], z = f[k + 2]; g[k] = Wp[0] * x + Wp[1] * y + Wp[2] * z + Wp[3]; g[k + 1] = Wp[4] * x + Wp[5] * y + Wp[6] * z + Wp[7]; g[k + 2] = Wp[8] * x + Wp[9] * y + Wp[10] * z + Wp[11]; continue; }
        if (!m) { g[k] = f[k]; g[k + 1] = f[k + 1]; g[k + 2] = f[k + 2]; continue; }
        const x = f[k] - m[3], y = f[k + 1] - m[7], z = f[k + 2] - m[11];   // (p2b: v_hueso = R·v + t → v = Rᵀ·(v_hueso − t))
        g[k] = m[0] * x + m[4] * y + m[8] * z; g[k + 1] = m[1] * x + m[5] * y + m[9] * z; g[k + 2] = m[2] * x + m[6] * y + m[10] * z;
      }
      out.push({ s, pts: g });
    }
  });
  // (los "static props" de Source guardan el casco girado 90° alrededor de Z respecto de la malla: si así encaja mejor con
  // los bordes de la geometría, se gira)
  if (M.v && M.huesos.length <= 1 && out.length) {
    const caja = (L, rot) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const f of L) for (let k = 0; k < f.length; k += 3) { const x = rot ? f[k + 1] : f[k], y = rot ? -f[k] : f[k + 1], z = f[k + 2]; const v = [x, y, z]; for (let c = 0; c < 3; c++) { if (v[c] < mn[c]) mn[c] = v[c]; if (v[c] > mx[c]) mx[c] = v[c]; } } return [mn, mx]; };
    // (contra la malla en la misma pose: con la de reposo, la malla posada)
    const m = caja([RP ? GMF.posar(M, RP).pos : M.v.pos], false), dif = (b) => Math.max(...[0, 1, 2].map((c) => Math.abs(b[0][c] - m[0][c]) + Math.abs(b[1][c] - m[1][c])));
    const L = out.map((x) => x.pts);
    if (dif(caja(L, true)) + 0.01 < dif(caja(L, false))) for (const x of out) { const f = x.pts; for (let k = 0; k < f.length; k += 3) { const a = f[k]; f[k] = f[k + 1]; f[k + 1] = -a; } }
  }
  return out;
};

// ---------------- .wav: lo que el navegador no lee (ADPCM) pasa a PCM de 16 bits ----------------
// (un .wav con un punto "cue" —o un bucle "smpl"— es un sonido en bucle para Source: suena hasta que lo paran, desde ese
// punto; se anota en lo que devuelve, .bucle = segundos desde donde vuelve: la minigun y el lanzallamas de TF2)
GMF.wav = function (b) {
  if (!(b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46)) return b;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let p = 12, fmt = null, datos = null, cue = -1, smpl = -1;
  while (p + 8 <= b.length) {
    const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]), t = dv.getUint32(p + 4, true);
    if (id === 'fmt ') fmt = { tag: dv.getUint16(p + 8, true), ch: dv.getUint16(p + 10, true), sr: dv.getUint32(p + 12, true), align: dv.getUint16(p + 20, true), bits: dv.getUint16(p + 22, true), p: p + 8, t };
    else if (id === 'data') datos = b.subarray(p + 8, Math.min(b.length, p + 8 + t));
    else if (id === 'cue ' && t >= 28 && p + 36 <= b.length && dv.getUint32(p + 8, true) > 0) cue = dv.getUint32(p + 32, true);
    else if (id === 'smpl' && t >= 60 && p + 56 <= b.length && dv.getUint32(p + 36, true) > 0) smpl = dv.getUint32(p + 52, true);
    p += 8 + t + (t & 1);
  }
  if (!fmt || !datos) return b;
  const bucle = smpl >= 0 ? smpl : cue, fin = (o) => { if (bucle >= 0 && fmt.sr > 0) o.bucle = bucle / fmt.sr; return o; };
  if (fmt.tag === 1 || fmt.tag === 3) {
    // (PCM: se rearma limpio, porque Source deja "cue"/"LIST" que algunos navegadores no aceptan bien)
    return fin(GMF._wavPCM(datos, fmt.ch, fmt.sr, fmt.bits, fmt.tag));
  }
  if (fmt.tag !== 2 && fmt.tag !== 0x11) return b;
  const ch = fmt.ch, blk = fmt.align, nb = Math.floor(datos.length / blk), out = [];
  if (fmt.tag === 2) {
    const C1 = [256, 512, 0, 192, 240, 460, 392], C2 = [0, -256, 0, 64, 0, -208, -232], AD = [230, 230, 230, 230, 307, 409, 512, 614, 768, 614, 512, 409, 307, 230, 230, 230];
    for (let k = 0; k < nb; k++) {
      const o = k * blk, pred = [], del = [], s1 = [], s2 = []; let q = o;
      for (let c = 0; c < ch; c++) pred.push(Math.min(6, datos[q++]));
      const i16 = (x) => { const v = datos[x] | datos[x + 1] << 8; return v & 0x8000 ? v - 0x10000 : v; };
      for (let c = 0; c < ch; c++) { del.push(i16(q)); q += 2; }
      for (let c = 0; c < ch; c++) { s1.push(i16(q)); q += 2; }
      for (let c = 0; c < ch; c++) { s2.push(i16(q)); q += 2; }
      for (let c = 0; c < ch; c++) out.push(s2[c]); for (let c = 0; c < ch; c++) out.push(s1[c]);
      let c = 0;
      for (; q < o + blk; q++) for (const nib of [datos[q] >> 4, datos[q] & 15]) {
        const sn = nib & 8 ? nib - 16 : nib;
        let v = ((s1[c] * C1[pred[c]] + s2[c] * C2[pred[c]]) >> 8) + sn * del[c]; v = Math.max(-32768, Math.min(32767, v));
        s2[c] = s1[c]; s1[c] = v; out.push(v); del[c] = Math.max(16, (AD[nib] * del[c]) >> 8); c = (c + 1) % ch;
      }
    }
  } else {
    const IX = [-1, -1, -1, -1, 2, 4, 6, 8], ST = []; for (let i = 0, s = 7; i < 89; i++) { ST.push(Math.round(s)); s *= 1.1; }
    ST.splice(0, ST.length, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767);
    for (let k = 0; k < nb; k++) {
      const o = k * blk, pr = [], ix = [], buf = Array.from({ length: ch }, () => []);
      for (let c = 0; c < ch; c++) { const v = datos[o + c * 4] | datos[o + c * 4 + 1] << 8; pr.push(v & 0x8000 ? v - 0x10000 : v); ix.push(Math.min(88, datos[o + c * 4 + 2])); buf[c].push(pr[c]); }
      for (let q = o + 4 * ch; q + 4 * ch <= o + blk; q += 4 * ch) for (let c = 0; c < ch; c++) for (let j = 0; j < 4; j++) {
        const by = datos[q + c * 4 + j];
        for (const nib of [by & 15, by >> 4]) {
          const st = ST[ix[c]]; let d = st >> 3; if (nib & 4) d += st; if (nib & 2) d += st >> 1; if (nib & 1) d += st >> 2;
          pr[c] = Math.max(-32768, Math.min(32767, pr[c] + (nib & 8 ? -d : d))); ix[c] = Math.max(0, Math.min(88, ix[c] + IX[nib & 7])); buf[c].push(pr[c]);
        }
      }
      for (let i = 0; i < buf[0].length; i++) for (let c = 0; c < ch; c++) out.push(buf[c][i] || 0);
    }
  }
  const pcm = new Uint8Array(out.length * 2), pv = new DataView(pcm.buffer); out.forEach((v, i) => pv.setInt16(i * 2, v, true));
  return fin(GMF._wavPCM(pcm, ch, fmt.sr, 16, 1));
};
GMF._wavPCM = function (pcm, ch, sr, bits, tag) {
  const o = new Uint8Array(44 + pcm.length), dv = new DataView(o.buffer), S = (p, s) => { for (let i = 0; i < 4; i++) o[p + i] = s.charCodeAt(i); };
  S(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length, true); S(8, 'WAVE'); S(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, tag || 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * bits / 8, true); dv.setUint16(32, ch * bits / 8, true); dv.setUint16(34, bits, true); S(36, 'data'); dv.setUint32(40, pcm.length, true); o.set(pcm, 44);
  return o;
};

if (typeof module !== 'undefined' && module.exports) module.exports = GMF;
