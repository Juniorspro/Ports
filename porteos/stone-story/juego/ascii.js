// Dibujos ASCII del juego (AsciiData): paginas separadas por "%%", con {repeat, x, y, colors} opcional.
// '#' es celda vacia (transparente); el espacio tapa. Los simbolos > 127 pasan por la tabla de letras.
'use strict';
const Ascii = (() => {
  const A = {};
  const cache = new Map();
  A.codigo = (c) => {
    if (c === 35) return -1;
    if (c < 128) return c;
    const v = Datos.tablas.letras[c];
    return v === undefined ? 63 : v;
  };
  const GRIS = [128, 128, 128], GRIS_OSC = [46, 46, 46], BLANCO = [255, 255, 255];
  A.GRIS = GRIS; A.GRIS_OSC = GRIS_OSC;

  function meta(linea) {
    const a = linea.indexOf('{'), b = linea.lastIndexOf('}');
    if (a < 0 || b < a) return null;
    try { return slim(linea.slice(a, b + 1)); } catch (e) { return null; }
  }

  function pagina(txt, saltear, m) {
    txt = txt.replace(/[\r\n]+$/, '');
    let filas = txt.split(/\r\n|\r|\n/);
    if (saltear) filas = filas.slice(1);
    const h = filas.length;
    let w = 0;
    for (const f of filas) w = Math.max(w, f.length);
    const celdas = new Int16Array(w * h).fill(-1);
    for (let y = 0; y < h; y++) {
      const f = filas[y];
      for (let x = 0; x < f.length; x++) celdas[y * w + x] = A.codigo(f.charCodeAt(x));
    }
    const p = { w, h, celdas, rep: 1, x: 0, y: 0 };
    if (m) {
      if (m.repeat) p.rep = m.repeat;
      if (m.x) p.x = m.x;
      if (m.y) p.y = m.y;
      if (m.colors) {
        p.colFg = new Map(); p.colBg = new Map();
        for (const c of m.colors) {
          const x0 = c.x0 !== undefined ? c.x0 : c.x, x1 = c.x1 !== undefined ? c.x1 : c.x;
          const y0 = c.y0 !== undefined ? c.y0 : c.y, y1 = c.y1 !== undefined ? c.y1 : c.y;
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            if (c.fg) p.colFg.set(y * w + x, hex(String(c.fg)));
            if (c.bg) p.colBg.set(y * w + x, hex(String(c.bg)));
          }
        }
      }
    }
    return p;
  }

  // como AsciiData.FromText: desde, cuantas (-1 = todas), reemplazos de texto
  A.datos = (ref, desde = 0, cuantas = -1, reemplazos) => {
    const clave = ref + '|' + desde + '|' + cuantas + '|' + (reemplazos ? JSON.stringify(reemplazos) : '');
    if (cache.has(clave)) return cache.get(clave);
    let t = Datos.texto(ref);
    const r = { paginas: [] };
    cache.set(clave, r);
    if (t == null) return r;
    if (reemplazos) for (const s of reemplazos) if (s.find !== undefined) t = t.split(s.find).join(s.replaceWith || '');
    const partes = t.split(/^\s*%%[ \t]*/m);
    let vistas = 0;
    for (let i = 0; i < partes.length; i++) {
      const s = partes[i];
      if (!s) continue;
      vistas++;
      if (!(desde < vistas || (r.paginas.length < 1 && i === partes.length - 1))) continue;
      const nl = s.search(/[\r\n]/);
      const pm = s.indexOf('{') >= 0 && s.indexOf('}') > s.indexOf('{') && (nl < 0 || nl > s.indexOf('}')) ? meta(s.slice(0, nl < 0 ? s.length : nl)) : null;
      r.paginas.push(pagina(s, i !== 0 || !!pm, pm));
      if (cuantas >= 1 && r.paginas.length >= cuantas) break;
    }
    r.w = Math.max(0, ...r.paginas.map((p) => p.w));
    r.h = Math.max(0, ...r.paginas.map((p) => p.h));
    r.cuadros = [];
    r.paginas.forEach((p, k) => { for (let j = 0; j < p.rep; j++) r.cuadros.push(k); });
    return r;
  };

  // dibuja una pagina con su esquina en (x, y); espejada se extiende hacia la izquierda/arriba
  // ops: {fx, fy, color:[r,g,b] | null, negro:bool, fondo:[r,g,b]}
  A.dibujar = (p, x, y, o) => {
    const P = Pantalla;
    const ex = Datos.tablas.espejoX, ey = Datos.tablas.espejoY;
    x += o.fx ? -p.x : p.x; y += o.fy ? -p.y : p.y;
    const base = o.color || BLANCO;
    for (let j = 0; j < p.h; j++) {
      const sy = o.fy ? y - j : y + j;
      if (sy < 0 || sy >= P.filas) continue;
      for (let i = 0; i < p.w; i++) {
        let g = p.celdas[j * p.w + i];
        if (g < 0) continue;
        const sx = o.fx ? x - i : x + i;
        if (sx < 0 || sx >= P.cols) continue;
        if (o.fx && ex[g] !== undefined) g = ex[g];
        if (o.fy && ey[g] !== undefined) g = ey[g];
        let c = base;
        if (p.colFg && !o.forzar) { const k = p.colFg.get(j * p.w + i); if (k) c = o.mult ? [k[0] * o.mult[0] | 0, k[1] * o.mult[1] | 0, k[2] * o.mult[2] | 0] : k; }
        let bg = o.negro ? [0, 0, 0] : o.fondo || null;
        if (p.colBg) { const k = p.colBg.get(j * p.w + i); if (k) bg = k; }
        P.poner(sx, sy, g, c[0], c[1], c[2], bg);
      }
    }
  };
  return A;
})();
