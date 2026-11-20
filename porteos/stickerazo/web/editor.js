// El sticker: capas (la foto recortada, textos y emojis) sobre 512×512, con el borde de sticker alrededor de todo.
// Lo que pide WhatsApp: 512×512, fondo transparente, WebP de 100 KB como mucho (animado: 500 KB y 10 s), y un margen
// (16 px) para que no se corte. Cada capa se puede animar (latido, temblor, rebote…): el sticker sale animado.
export const LADO = 512, MARGEN = 16, MAX_BYTES = 100 * 1024, MAX_ANIMADO = 500 * 1024;
export const FUENTES = [
  { id: 'LuckiestGuy', nombre: 'Luckiest Guy' }, { id: 'Bangers', nombre: 'Bangers' }, { id: 'Anton', nombre: 'Anton' },
  { id: 'PermanentMarker', nombre: 'Permanent Marker' }, { id: 'Pacifico', nombre: 'Pacifico' },
];
export const COLORES = ['#ffffff', '#111111', '#ffd23f', '#ff3e8a', '#3ec7ff', '#4cd964', '#ff7a1a', '#9b5cff'];
export async function cargarFuentes(base) {
  await Promise.all(FUENTES.map(async (f) => { try { const ff = new FontFace(f.id, `url(${base}fuentes/${f.id}.ttf)`); await ff.load(); document.fonts.add(ff); } catch (e) { /* sin esa fuente: la del sistema */ } }));
}
export const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

// ---- animaciones: t va de 0 a 1 (una vuelta); en t = 0 la capa está quieta (así el primer cuadro es el sticker normal)
const TAU = Math.PI * 2, campana = (t, c, a) => Math.exp(-(((t - c) / a) ** 2));
export const ANIMACIONES = [
  { id: 'latido', nombre: 'Latido', ico: '❤️', dur: 1.2, f: (t) => ({ s: 1 + 0.13 * campana(t, 0.18, 0.05) + 0.09 * campana(t, 0.38, 0.05) }) },
  { id: 'temblor', nombre: 'Temblor', ico: '😱', dur: 1.2, f: (t) => ({ dx: 5 * Math.sin(TAU * 5 * t) + 2.5 * Math.sin(TAU * 9 * t), dy: 4 * Math.sin(TAU * 7 * t), rot: 0.05 * Math.sin(TAU * 6 * t) }) },
  { id: 'rebote', nombre: 'Rebote', ico: '🏀', dur: 1.2, f: (t) => { const h = Math.abs(Math.sin(TAU * t)), apl = Math.max(0, 1 - h * 6); return { dy: -42 * h, sx: 1 + 0.09 * apl, sy: 1 - 0.09 * apl, base: true }; } },
  { id: 'giro', nombre: 'Giro', ico: '🌀', dur: 2.4, f: (t) => ({ rot: TAU * t }) },
  { id: 'flotar', nombre: 'Flotar', ico: '☁️', dur: 2.4, f: (t) => ({ dy: -12 * Math.sin(TAU * t), rot: 0.06 * Math.sin(TAU * t + 0.8) }) },
  { id: 'bamboleo', nombre: 'Bamboleo', ico: '🎎', dur: 1.2, f: (t) => ({ rot: 0.22 * Math.sin(TAU * t), pivote: true }) },
  { id: 'pum', nombre: 'Pum', ico: '💥', dur: 1.2, f: (t) => ({ s: 1 + 0.32 * campana(t, 0.55, 0.06), rot: 0.06 * Math.sin(TAU * 4 * t) * campana(t, 0.55, 0.1) }) },
  { id: 'aparecer', nombre: 'Escribir', ico: '✍️', dur: 2.4, soloTexto: true, f: (t) => ({ letras: t < 0.3 ? 1 : t < 0.36 ? 0 : t < 0.86 ? (t - 0.36) / 0.5 : 1 }) },
  { id: 'parpadeo', nombre: 'Parpadeo', ico: '✨', dur: 1.2, f: (t) => ({ alfa: t > 0.5 && t < 0.62 ? 0.12 : 1 }) },
  { id: 'arcoiris', nombre: 'Arcoíris', ico: '🌈', dur: 2.4, f: (t) => ({ tono: 360 * t }) },
];
export const ANIM = Object.fromEntries(ANIMACIONES.map((a) => [a.id, a]));

// la foto recortada → un lienzo del tamaño de lo que quedó (con la máscara como transparencia)
export function recortarImagen(img, mascara, mw, mh) {
  const c = lienzo(mw, mh), g = c.getContext('2d'); g.drawImage(img, 0, 0, mw, mh);
  const d = g.getImageData(0, 0, mw, mh); let x0 = mw, y0 = mh, x1 = -1, y1 = -1;
  for (let y = 0, i = 0; y < mh; y++) for (let x = 0; x < mw; x++, i++) { const a = mascara ? mascara[i] : 255; d.data[i * 4 + 3] = a; if (a > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  g.putImageData(d, 0, 0);
  if (x1 < 0) return null;
  const out = lienzo(x1 - x0 + 1, y1 - y0 + 1); out.getContext('2d').drawImage(c, -x0, -y0);
  out.origen = { x: x0, y: y0 }; // (dónde estaba en la foto: para el cabezón)
  return out;
}

// el globo de diálogo detrás de un texto (w × h del texto, en coordenadas de la capa)
function globo(g, w, h) {
  const pw = w / 2 + 26, ph = h / 2 + 14, r = Math.min(ph, 46);
  g.beginPath(); g.moveTo(-pw + r, -ph); g.arcTo(pw, -ph, pw, ph, r); g.arcTo(pw, ph, -pw, ph, r);
  g.lineTo(-pw * 0.18, ph); g.lineTo(-pw * 0.42, ph + 34); g.lineTo(-pw * 0.42 - 2, ph); // (la colita)
  g.arcTo(-pw, ph, -pw, -ph, r); g.arcTo(-pw, -ph, pw, -ph, r); g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#111111'; g.lineJoin = 'round'; g.stroke();
}

export class Sticker {
  constructor() { this.capas = []; this.borde = 12; this.colorBorde = '#ffffff'; this.sombra = true; this.sel = -1; }
  // ---- capas ----
  agregarImagen(src) {
    // (con lugar para el borde y la sombra, que cae 4 px para abajo)
    const lugar = LADO - 2 * (MARGEN + this.borde + 4), esc = Math.min(lugar / src.width, lugar / src.height);
    this.capas.push({ tipo: 'img', src, x: LADO / 2, y: LADO / 2, esc, rot: 0 }); this.sel = this.capas.length - 1; return this.capas[this.sel];
  }
  agregarTexto(o) {
    const c = { tipo: 'texto', texto: o.texto || 'Texto', fuente: o.fuente || 'LuckiestGuy', color: o.color || '#ffffff', contorno: o.contorno === undefined ? '#111111' : o.contorno, globo: !!o.globo, tam: 96, x: LADO / 2, y: LADO / 2, esc: 1, rot: 0 };
    if (c.globo) { c.color = '#111111'; c.contorno = ''; }
    this.ajustarTexto(c, !this.capas.length);
    this.capas.push(c); this.sel = this.capas.length - 1; return c;
  }
  // que entre a lo ancho; si ya hay algo, abajo (el globo, arriba), apoyado adentro del margen
  ajustarTexto(c, centrado) {
    const m = this.medidas(c), maxW = LADO - 2 * (MARGEN + this.borde) - 8; c.esc = Math.min(1, maxW / m.w);
    if (centrado) return;
    const alto = (m.h * c.esc) / 2;
    c.y = c.globo ? MARGEN + this.borde + 6 + alto : LADO - MARGEN - this.borde - 6 - alto;
  }
  agregarEmoji(ch) { this.capas.push({ tipo: 'emoji', ch, tam: 140, x: LADO - 120, y: 130, esc: 1, rot: -0.15 }); this.sel = this.capas.length - 1; return this.capas[this.sel]; }
  borrarSel() { if (this.sel >= 0) { this.capas.splice(this.sel, 1); this.sel = -1; } }
  alFrente() { if (this.sel >= 0) { const c = this.capas.splice(this.sel, 1)[0]; this.capas.push(c); this.sel = this.capas.length - 1; } }
  // tamaño de la capa sin su escala ni giro (con el globo, si tiene)
  medidas(c) {
    if (c.tipo === 'img') return { w: c.src.width, h: c.src.height };
    const g = Sticker._g || (Sticker._g = lienzo(4, 4).getContext('2d'));
    const fuente = c.tipo === 'emoji' ? `${c.tam}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif` : `${c.tam}px "${c.fuente}", sans-serif`;
    g.font = fuente; const lineas = c.tipo === 'emoji' ? [c.ch] : String(c.texto).split('\n');
    let w = Math.max(...lineas.map((l) => g.measureText(l).width)) + (c.tipo === 'texto' ? c.tam * 0.3 : 0), h = lineas.length * c.tam * 1.08 + c.tam * 0.18;
    if (c.globo) { w += 52 + 6; h += 28 + 34 + 6; }
    return { w, h, fuente, lineas };
  }
  // ---- animación ----
  animado() { return this.capas.some((c) => c.anim && ANIM[c.anim]); }
  duracion() { return Math.max(1.2, ...this.capas.filter((c) => c.anim && ANIM[c.anim]).map((c) => ANIM[c.anim].dur)); }
  mov(c, t) {
    const a = c.anim && ANIM[c.anim]; if (!a) return null;
    const vueltas = Math.max(1, Math.round(this.duracion() / a.dur)); return a.f((t * vueltas) % 1);
  }
  dibujarCapa(g, c, t = 0) {
    const m = this.mov(c, t) || {}, md = this.medidas(c);
    g.save(); g.translate(c.x + (m.dx || 0), c.y + (m.dy || 0)); g.rotate(c.rot);
    // (el bamboleo gira desde abajo, como un muñeco; el rebote se aplasta contra el piso)
    const piso = (md.h * c.esc) / 2;
    if (m.pivote || m.base) g.translate(0, piso);
    g.rotate(m.rot || 0);
    const s = m.s || 1; g.scale(c.esc * s * (m.sx || 1), c.esc * s * (m.sy || 1));
    if (m.pivote || m.base) g.translate(0, -piso / c.esc);
    if (m.alfa !== undefined) g.globalAlpha = m.alfa;
    if (m.tono && c.tipo !== 'texto') g.filter = `hue-rotate(${m.tono}deg) saturate(1.4)`;
    if (c.tipo === 'img') g.drawImage(c.src, -c.src.width / 2, -c.src.height / 2);
    else {
      g.font = md.fuente; g.textAlign = 'center'; g.textBaseline = 'middle';
      const alto = c.tam * 1.08, y0 = -((md.lineas.length - 1) * alto) / 2 - (c.globo ? 17 : 0);
      if (c.globo) { g.save(); g.translate(0, -17); globo(g, md.w - 58, md.h - 68); g.restore(); }
      let quedan = m.letras === undefined ? Infinity : Math.round(m.letras * md.lineas.reduce((n, l) => n + [...l].length, 0));
      const color = c.tipo === 'texto' && m.tono ? `hsl(${m.tono}, 95%, 60%)` : c.color;
      md.lineas.forEach((l, i) => {
        const ch = [...l], ver = ch.slice(0, Math.max(0, quedan)).join(''); quedan -= ch.length; if (!ver) return;
        // (letra por letra: el renglón se escribe desde su lugar final, no corrido al centro)
        const x = ver.length < l.length ? -g.measureText(l).width / 2 + g.measureText(ver).width / 2 : 0;
        if (c.tipo === 'texto' && c.contorno) { g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = c.tam * 0.2; g.strokeStyle = c.contorno; g.strokeText(ver, x, y0 + i * alto); }
        g.fillStyle = c.tipo === 'texto' ? color : '#000'; g.fillText(ver, x, y0 + i * alto);
      });
    }
    g.restore();
  }
  // ---- el dibujo entero en el momento t: las capas, y alrededor el borde de sticker (dilatando la silueta) y una sombra ----
  componer(t = 0) {
    const base = lienzo(LADO, LADO), g = base.getContext('2d');
    for (const c of this.capas) this.dibujarCapa(g, c, t);
    if (!this.borde && !this.sombra) return base;
    const out = lienzo(LADO, LADO), o = out.getContext('2d');
    if (this.borde > 0) {
      const sil = lienzo(LADO, LADO), s = sil.getContext('2d'); s.drawImage(base, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = this.colorBorde; s.fillRect(0, 0, LADO, LADO);
      const ani = lienzo(LADO, LADO), a = ani.getContext('2d'), r = this.borde;
      for (const f of [1, 0.66, 0.33]) for (let k = 0; k < 24; k++) { const th = (k / 24) * TAU; a.drawImage(sil, Math.cos(th) * r * f, Math.sin(th) * r * f); }
      a.drawImage(sil, 0, 0);
      if (this.sombra) { o.save(); o.shadowColor = 'rgba(0,0,0,0.38)'; o.shadowBlur = 10; o.shadowOffsetY = 4; o.drawImage(ani, 0, 0); o.restore(); }
      else o.drawImage(ani, 0, 0);
    } else if (this.sombra) { o.save(); o.shadowColor = 'rgba(0,0,0,0.38)'; o.shadowBlur = 10; o.shadowOffsetY = 4; o.drawImage(base, 0, 0); o.restore(); }
    o.drawImage(base, 0, 0);
    return out;
  }
  // ¿qué capa hay en (x, y)? la de más arriba
  tocada(x, y) {
    for (let i = this.capas.length - 1; i >= 0; i--) {
      const c = this.capas[i], m = this.medidas(c), dx = x - c.x, dy = y - c.y, cs = Math.cos(-c.rot), sn = Math.sin(-c.rot);
      const lx = (dx * cs - dy * sn) / c.esc, ly = (dx * sn + dy * cs) / c.esc, pad = 18 / c.esc;
      if (Math.abs(lx) <= m.w / 2 + pad && Math.abs(ly) <= m.h / 2 + pad) return i;
    }
    return -1;
  }
  // dónde está lo dibujado (sin el borde), aunque se salga del cuadro, en todo el movimiento: { x0, y0, x1, y1 }
  caja() {
    const k = 0.25, T = LADO * 3, c = lienzo(T * k, T * k), g = c.getContext('2d', { willReadFrequently: true });
    const ts = this.animado() ? Array.from({ length: 12 }, (_, i) => i / 12) : [0];
    g.scale(k, k); g.translate(LADO, LADO); for (const t of ts) for (const capa of this.capas) this.dibujarCapa(g, capa, t);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return null;
    return { x0: x0 / k - LADO, y0: y0 / k - LADO, x1: (x1 + 1) / k - LADO, y1: (y1 + 1) / k - LADO };
  }
  // que entre todo (con el borde, y en todo el movimiento) adentro del margen: achica lo justo y lo corre lo justo
  encajar() {
    const c = this.caja(); if (!c) return false;
    const b = this.borde + 3, lo = MARGEN + b, hi = LADO - MARGEN - b, cw = c.x1 - c.x0, ch = c.y1 - c.y0;
    const s = Math.min(1, (hi - lo) / cw, (hi - lo) / ch), cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    const nx0 = cx - (cw * s) / 2, ny0 = cy - (ch * s) / 2;
    const dx = nx0 < lo ? lo - nx0 : nx0 + cw * s > hi ? hi - (nx0 + cw * s) : 0, dy = ny0 < lo ? lo - ny0 : ny0 + ch * s > hi ? hi - (ny0 + ch * s) : 0;
    for (const capa of this.capas) { capa.x = cx + (capa.x - cx) * s + dx; capa.y = cy + (capa.y - cy) * s + dy; capa.esc *= s; }
    return true;
  }
  // cuánto se sale del lugar seguro (para avisar): 0 si entra todo (si está animado, en todo el movimiento)
  seSale() {
    const ts = this.animado() ? Array.from({ length: 8 }, (_, i) => i / 8) : [0]; let n = 0;
    for (const t of ts) {
      const d = this.componer(t).getContext('2d').getImageData(0, 0, LADO, LADO).data;
      for (let y = 0; y < LADO; y++) for (let x = 0; x < LADO; x++) if ((x < MARGEN - 4 || x >= LADO - MARGEN + 4 || y < MARGEN - 4 || y >= LADO - MARGEN + 4) && d[(y * LADO + x) * 4 + 3] > 40) n++;
    }
    return Math.round(n / ts.length);
  }
  // ---- el proyecto (para volver a editarlo): todo menos las imágenes, que van aparte ----
  aProyecto() {
    const imgs = [], capas = this.capas.map((c) => {
      const { src, ...resto } = c;
      if (c.tipo === 'img') { let i = imgs.indexOf(src); if (i < 0) { imgs.push(src); i = imgs.length - 1; } return { ...resto, img: i }; }
      return resto;
    });
    return { proyecto: { v: 1, borde: this.borde, colorBorde: this.colorBorde, sombra: this.sombra, capas }, imgs };
  }
  static deProyecto(p, imgs) {
    const s = new Sticker(); s.borde = p.borde; s.colorBorde = p.colorBorde; s.sombra = p.sombra;
    s.capas = p.capas.filter((c) => c.tipo !== 'img' || imgs[c.img]).map((c) => { const { img, ...resto } = c; return c.tipo === 'img' ? { ...resto, src: imgs[img] } : { ...resto }; });
    return s;
  }
}

// ---- exportar ----
export const aBlob = (c, tipo, q) => new Promise((ok) => c.toBlob(ok, tipo, q));
// el WebP de 512×512 de 100 KB como mucho (bajando la calidad de a poco si hace falta)
export async function exportarWebP(c) {
  for (const q of [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4, 0.3]) {
    const b = await aBlob(c, 'image/webp', q);
    if (!b || b.type !== 'image/webp') throw new Error('este navegador no hace WebP');
    if (b.size <= MAX_BYTES) return { blob: b, q };
  }
  throw new Error('el sticker pesa demasiado');
}
// el ícono del pack en WhatsApp: 96×96, PNG de 50 KB como mucho (también en los packs animados: quieto)
export async function exportarBandeja(c) {
  const t = lienzo(96, 96), g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, 96, 96);
  const b = await aBlob(t, 'image/png'); if (b.size <= 50 * 1024) return b;
  return aBlob(t, 'image/webp', 0.8);
}

// ---- WebP animado (el navegador sólo sabe hacer WebP quietos: cada cuadro se hace quieto y acá se arma la animación) ----
// Formato: RIFF 'WEBP' · VP8X (con animación y transparencia) · ANIM (fondo transparente, vueltas infinitas) · un ANMF por
// cuadro con los trozos ALPH/VP8 de un WebP quieto. Cada cuadro va recortado a lo que tiene dibujado (pesa y tarda mucho
// menos que 512×512 entero) y se borra al pasar al siguiente, así no quedan restos del anterior.
const ascii = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));
function trozosWebP(buf) {
  const v = new DataView(buf), id = (o) => String.fromCharCode(...new Uint8Array(buf, o, 4));
  if (id(0) !== 'RIFF' || id(8) !== 'WEBP') throw new Error('no es un WebP');
  const out = []; let o = 12;
  while (o + 8 <= buf.byteLength) { const n = v.getUint32(o + 4, true); out.push({ id: id(o), datos: new Uint8Array(buf, o + 8, n) }); o += 8 + n + (n & 1); }
  return out;
}
function trozo(id, datos) {
  const n = datos.length, b = new Uint8Array(8 + n + (n & 1)); b.set(ascii(id), 0); new DataView(b.buffer).setUint32(4, n, true); b.set(datos, 8); return b;
}
const u24 = (b, o, v) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; };
const unir = (partes) => { const n = partes.reduce((s, x) => s + x.length, 0), u = new Uint8Array(n); let o = 0; for (const x of partes) { u.set(x, o); o += x.length; } return u; };
// lo dibujado de un cuadro: { x, y (pares, como pide el formato), c: el lienzo recortado }
export function recortarCuadro(c) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 1; } // (cuadro vacío: uno de 2×2 transparente)
  x0 -= x0 & 1; y0 -= y0 & 1;
  const out = lienzo(x1 - x0 + 1, y1 - y0 + 1); out.getContext('2d').drawImage(c, -x0, -y0);
  return { x: x0, y: y0, c: out };
}
async function anmf(cr, ms, q) {
  const b = await aBlob(cr.c, 'image/webp', q); if (!b || b.type !== 'image/webp') throw new Error('este navegador no hace WebP');
  const ts = trozosWebP(await b.arrayBuffer()).filter((x) => x.id === 'ALPH' || x.id === 'VP8 ' || x.id === 'VP8L');
  if (!ts.some((x) => x.id !== 'ALPH')) throw new Error('cuadro sin imagen');
  const cab = new Uint8Array(16); u24(cab, 0, cr.x / 2); u24(cab, 3, cr.y / 2); u24(cab, 6, cr.c.width - 1); u24(cab, 9, cr.c.height - 1);
  u24(cab, 12, Math.max(8, Math.round(ms))); cab[15] = 0x03; // (sin mezclar con el anterior; al terminar, se borra)
  return trozo('ANMF', unir([cab, ...ts.map((x) => trozo(x.id, x.datos))]));
}
export async function webpAnimado(cuadros, ms, q, W = LADO, H = LADO) {
  const crs = cuadros.map((c) => (c.c ? c : recortarCuadro(c))), partes = [];
  for (const cr of crs) partes.push(await anmf(cr, ms, q));
  const vp8x = new Uint8Array(10); vp8x[0] = 0x02 | 0x10; u24(vp8x, 4, W - 1); u24(vp8x, 7, H - 1);
  const anim = new Uint8Array(6); // (fondo transparente; vueltas: 0 = siempre)
  const cuerpo = unir([ascii('WEBP'), trozo('VP8X', vp8x), trozo('ANIM', anim), ...partes]);
  const riff = new Uint8Array(8 + cuerpo.length); riff.set(ascii('RIFF'), 0); new DataView(riff.buffer).setUint32(4, cuerpo.length, true); riff.set(cuerpo, 8);
  return new Blob([riff], { type: 'image/webp' });
}
// el sticker animado de 500 KB como mucho. La calidad se elige midiendo 4 cuadros de muestra (la más alta que, según
// ellos, entra con un 10 % de margen). Antes que bajar de 0,6 de calidad, menos cuadros por segundo (12 → 10 → 8).
export async function exportarAnimado(st) {
  const D = st.duracion(), Q = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38, 0.3], MIN_Q = 0.6;
  let mejor = null;
  for (const fps of [12, 10, 8]) {
    const n = Math.max(2, Math.round(D * fps)), ms = Math.round((1000 * D) / n), cuadros = Array.from({ length: n }, (_, i) => recortarCuadro(st.componer(i / n)));
    const muestra = [0, 1, 2, 3].map((k) => cuadros[Math.floor((k * n) / 4)]);
    let i = 0;
    for (; i < Q.length - 1; i++) {
      let peso = 0; for (const cr of muestra) peso += (await anmf(cr, ms, Q[i])).length;
      if ((peso / muestra.length) * n + 64 <= MAX_ANIMADO * 0.9) break;
    }
    const cand = { fps, n, ms, cuadros, i };
    if (!mejor || i < mejor.i) mejor = cand;
    if (Q[i] >= MIN_Q) break;
  }
  for (let i = mejor.i; i < Q.length; i++) {
    const blob = await webpAnimado(mejor.cuadros, mejor.ms, Q[i]);
    if (blob.size <= MAX_ANIMADO) return { blob, cuadros: mejor.n, ms: mejor.ms, q: Q[i], fps: mejor.fps };
  }
  throw new Error('el sticker animado pesa demasiado');
}
