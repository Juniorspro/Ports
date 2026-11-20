// El sticker: capas (la foto recortada, textos y emojis) sobre 512×512, con el borde blanco de sticker alrededor de todo.
// Lo que pide WhatsApp: 512×512, fondo transparente, WebP de 100 KB como mucho, y un margen (16 px) para que no se corte.
export const LADO = 512, MARGEN = 16, MAX_BYTES = 100 * 1024;
export const FUENTES = [
  { id: 'LuckiestGuy', nombre: 'Luckiest Guy' }, { id: 'Bangers', nombre: 'Bangers' }, { id: 'Anton', nombre: 'Anton' },
  { id: 'PermanentMarker', nombre: 'Permanent Marker' }, { id: 'Pacifico', nombre: 'Pacifico' },
];
export const COLORES = ['#ffffff', '#111111', '#ffd23f', '#ff3e8a', '#3ec7ff', '#4cd964', '#ff7a1a', '#9b5cff'];
export async function cargarFuentes(base) {
  await Promise.all(FUENTES.map(async (f) => { try { const ff = new FontFace(f.id, `url(${base}fuentes/${f.id}.ttf)`); await ff.load(); document.fonts.add(ff); } catch (e) { /* sin esa fuente: la del sistema */ } }));
}
const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

// la foto recortada → un lienzo del tamaño de lo que quedó (con la máscara como transparencia)
export function recortarImagen(img, mascara, mw, mh) {
  const c = lienzo(mw, mh), g = c.getContext('2d'); g.drawImage(img, 0, 0, mw, mh);
  const d = g.getImageData(0, 0, mw, mh); let x0 = mw, y0 = mh, x1 = -1, y1 = -1;
  for (let y = 0, i = 0; y < mh; y++) for (let x = 0; x < mw; x++, i++) { const a = mascara ? mascara[i] : 255; d.data[i * 4 + 3] = a; if (a > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  g.putImageData(d, 0, 0);
  if (x1 < 0) return null;
  const out = lienzo(x1 - x0 + 1, y1 - y0 + 1); out.getContext('2d').drawImage(c, -x0, -y0); return out;
}

export class Sticker {
  constructor() { this.capas = []; this.borde = 12; this.colorBorde = '#ffffff'; this.sombra = true; this.sel = -1; }
  // ---- capas ----
  agregarImagen(src) {
    const lugar = LADO - 2 * (MARGEN + this.borde), esc = Math.min(lugar / src.width, lugar / src.height);
    this.capas.push({ tipo: 'img', src, x: LADO / 2, y: LADO / 2, esc, rot: 0 }); this.sel = this.capas.length - 1; return this.capas[this.sel];
  }
  agregarTexto(o) {
    const c = { tipo: 'texto', texto: o.texto || 'Texto', fuente: o.fuente || 'LuckiestGuy', color: o.color || '#ffffff', contorno: o.contorno === undefined ? '#111111' : o.contorno, tam: 96, x: LADO / 2, y: this.capas.length ? LADO - 90 : LADO / 2, esc: 1, rot: 0 };
    // (que entre a lo ancho)
    const m = this.medidas(c), maxW = LADO - 2 * (MARGEN + this.borde) - 8; if (m.w > maxW) c.esc = maxW / m.w;
    // (si ya hay algo, abajo, apoyado adentro del margen: aunque sea de varios renglones no se sale)
    if (this.capas.length) c.y = LADO - MARGEN - this.borde - 6 - (m.h * c.esc) / 2;
    this.capas.push(c); this.sel = this.capas.length - 1; return c;
  }
  agregarEmoji(ch) { this.capas.push({ tipo: 'emoji', ch, tam: 140, x: LADO - 120, y: 130, esc: 1, rot: -0.15 }); this.sel = this.capas.length - 1; return this.capas[this.sel]; }
  borrarSel() { if (this.sel >= 0) { this.capas.splice(this.sel, 1); this.sel = -1; } }
  alFrente() { if (this.sel >= 0) { const c = this.capas.splice(this.sel, 1)[0]; this.capas.push(c); this.sel = this.capas.length - 1; } }
  // tamaño de la capa sin su escala ni giro
  medidas(c) {
    if (c.tipo === 'img') return { w: c.src.width, h: c.src.height };
    const g = Sticker._g || (Sticker._g = lienzo(4, 4).getContext('2d'));
    const fuente = c.tipo === 'emoji' ? `${c.tam}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif` : `${c.tam}px "${c.fuente}", sans-serif`;
    g.font = fuente; const lineas = c.tipo === 'emoji' ? [c.ch] : String(c.texto).split('\n');
    const w = Math.max(...lineas.map((l) => g.measureText(l).width)) + (c.tipo === 'texto' ? c.tam * 0.3 : 0), h = lineas.length * c.tam * 1.08 + c.tam * 0.18;
    return { w, h, fuente, lineas };
  }
  dibujarCapa(g, c) {
    g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.scale(c.esc, c.esc);
    if (c.tipo === 'img') g.drawImage(c.src, -c.src.width / 2, -c.src.height / 2);
    else {
      const m = this.medidas(c); g.font = m.fuente; g.textAlign = 'center'; g.textBaseline = 'middle';
      const alto = c.tam * 1.08, y0 = -((m.lineas.length - 1) * alto) / 2;
      m.lineas.forEach((l, i) => {
        if (c.tipo === 'texto' && c.contorno) { g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = c.tam * 0.2; g.strokeStyle = c.contorno; g.strokeText(l, 0, y0 + i * alto); }
        g.fillStyle = c.tipo === 'texto' ? c.color : '#000'; g.fillText(l, 0, y0 + i * alto);
      });
    }
    g.restore();
  }
  // ---- el dibujo entero: las capas, y alrededor el borde de sticker (dilatando la silueta) y una sombra suave ----
  componer() {
    const base = lienzo(LADO, LADO), g = base.getContext('2d');
    for (const c of this.capas) this.dibujarCapa(g, c);
    if (!this.borde && !this.sombra) return base;
    const out = lienzo(LADO, LADO), o = out.getContext('2d');
    if (this.borde > 0) {
      const sil = lienzo(LADO, LADO), s = sil.getContext('2d'); s.drawImage(base, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = this.colorBorde; s.fillRect(0, 0, LADO, LADO);
      const ani = lienzo(LADO, LADO), a = ani.getContext('2d'), r = this.borde;
      for (const f of [1, 0.66, 0.33]) for (let k = 0; k < 24; k++) { const t = (k / 24) * Math.PI * 2; a.drawImage(sil, Math.cos(t) * r * f, Math.sin(t) * r * f); }
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
  // dónde está lo dibujado (sin el borde), aunque se salga del cuadro: { x0, y0, x1, y1 } en coordenadas del sticker
  caja() {
    const k = 0.25, T = LADO * 3, c = lienzo(T * k, T * k), g = c.getContext('2d', { willReadFrequently: true });
    g.scale(k, k); g.translate(LADO, LADO); for (const capa of this.capas) this.dibujarCapa(g, capa);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return null;
    return { x0: x0 / k - LADO, y0: y0 / k - LADO, x1: (x1 + 1) / k - LADO, y1: (y1 + 1) / k - LADO };
  }
  // que entre todo (con el borde) adentro del margen: achica lo justo y lo corre lo justo
  encajar() {
    const c = this.caja(); if (!c) return false;
    const b = this.borde + 3, lo = MARGEN + b, hi = LADO - MARGEN - b, cw = c.x1 - c.x0, ch = c.y1 - c.y0;
    const s = Math.min(1, (hi - lo) / cw, (hi - lo) / ch), cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    const nx0 = cx - (cw * s) / 2, ny0 = cy - (ch * s) / 2;
    const dx = nx0 < lo ? lo - nx0 : nx0 + cw * s > hi ? hi - (nx0 + cw * s) : 0, dy = ny0 < lo ? lo - ny0 : ny0 + ch * s > hi ? hi - (ny0 + ch * s) : 0;
    for (const capa of this.capas) { capa.x = cx + (capa.x - cx) * s + dx; capa.y = cy + (capa.y - cy) * s + dy; capa.esc *= s; }
    return true;
  }
  // cuánto se sale del lugar seguro (para avisar): 0 si entra todo
  seSale() {
    const c = this.componer(), d = c.getContext('2d').getImageData(0, 0, LADO, LADO).data; let n = 0;
    for (let y = 0; y < LADO; y++) for (let x = 0; x < LADO; x++) if ((x < MARGEN - 4 || x >= LADO - MARGEN + 4 || y < MARGEN - 4 || y >= LADO - MARGEN + 4) && d[(y * LADO + x) * 4 + 3] > 40) n++;
    return n;
  }
}

// ---- exportar ----
const aBlob = (c, tipo, q) => new Promise((ok) => c.toBlob(ok, tipo, q));
// el WebP de 512×512 de 100 KB como mucho (bajando la calidad de a poco si hace falta)
export async function exportarWebP(c) {
  for (const q of [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4, 0.3]) {
    const b = await aBlob(c, 'image/webp', q);
    if (!b || b.type !== 'image/webp') throw new Error('este navegador no hace WebP');
    if (b.size <= MAX_BYTES) return { blob: b, q };
  }
  throw new Error('el sticker pesa demasiado');
}
// el ícono del pack en WhatsApp: 96×96, PNG de 50 KB como mucho
export async function exportarBandeja(c) {
  const t = lienzo(96, 96), g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, 96, 96);
  const b = await aBlob(t, 'image/png'); if (b.size <= 50 * 1024) return b;
  return aBlob(t, 'image/webp', 0.8);
}
