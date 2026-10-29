// Texturas S3TC (DXT1/3/5) por software, para GPUs sin WEBGL_compressed_texture_s3tc (casi todos los celulares).
// DXT1 sin alfa -> RGB565, DXT1 con alfa -> RGBA5551, DXT3/DXT5 -> RGBA8.
'use strict';
const Dxt = (() => {
  const RGB_DXT1 = 0x83f0, RGBA_DXT1 = 0x83f1, RGBA_DXT3 = 0x83f2, RGBA_DXT5 = 0x83f3;
  const pal = new Uint8Array(16), alf = new Uint8Array(8);
  const color = (c, o) => { const r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31; pal[o] = (r << 3) | (r >> 2); pal[o + 1] = (g << 2) | (g >> 4); pal[o + 2] = (b << 3) | (b >> 2); pal[o + 3] = 255; };

  // devuelve { datos, fmt, tipo } listo para texImage2D, o null si el formato no es S3TC
  function decodificar(ifmt, w, h, src) {
    if (ifmt < RGB_DXT1 || ifmt > RGBA_DXT5) return null;
    const rgba = new Uint8Array(w * h * 4);
    const bw = (w + 3) >> 2, bh = (h + 3) >> 2, tb = ifmt <= RGBA_DXT1 ? 8 : 16;
    let p = 0;
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++, p += tb) {
        if (p + tb > src.length) return empacar(ifmt, w, h, rgba);
        const co = tb === 16 ? p + 8 : p;
        const c0 = src[co] | (src[co + 1] << 8), c1 = src[co + 2] | (src[co + 3] << 8);
        color(c0, 0); color(c1, 4);
        if (c0 > c1 || tb === 16) {
          for (let k = 0; k < 3; k++) { pal[8 + k] = (2 * pal[k] + pal[4 + k] + 1) / 3 | 0; pal[12 + k] = (pal[k] + 2 * pal[4 + k] + 1) / 3 | 0; }
          pal[11] = 255; pal[15] = 255;
        } else {
          for (let k = 0; k < 3; k++) { pal[8 + k] = (pal[k] + pal[4 + k]) >> 1; pal[12 + k] = 0; }
          pal[11] = 255; pal[15] = ifmt === RGBA_DXT1 ? 0 : 255;
        }
        const bits = (src[co + 4] | (src[co + 5] << 8) | (src[co + 6] << 16) | (src[co + 7] << 24)) >>> 0;
        let aLo = 0, aHi = 0;
        if (ifmt === RGBA_DXT5) {
          const a0 = src[p], a1 = src[p + 1];
          alf[0] = a0; alf[1] = a1;
          if (a0 > a1) for (let k = 1; k < 7; k++) alf[k + 1] = ((7 - k) * a0 + k * a1 + 3) / 7 | 0;
          else { for (let k = 1; k < 5; k++) alf[k + 1] = ((5 - k) * a0 + k * a1 + 2) / 5 | 0; alf[6] = 0; alf[7] = 255; }
          aLo = src[p + 2] | (src[p + 3] << 8) | (src[p + 4] << 16);
          aHi = src[p + 5] | (src[p + 6] << 8) | (src[p + 7] << 16);
        }
        for (let i = 0; i < 16; i++) {
          const x = (bx << 2) + (i & 3), y = (by << 2) + (i >> 2);
          if (x >= w || y >= h) continue;
          const o = (y * w + x) << 2, ci = ((bits >>> (2 * i)) & 3) << 2;
          rgba[o] = pal[ci]; rgba[o + 1] = pal[ci + 1]; rgba[o + 2] = pal[ci + 2];
          if (ifmt === RGBA_DXT3) { const n = (src[p + (i >> 1)] >> ((i & 1) * 4)) & 15; rgba[o + 3] = n * 17; }
          else if (ifmt === RGBA_DXT5) rgba[o + 3] = alf[i < 8 ? (aLo >> (3 * i)) & 7 : (aHi >> (3 * (i - 8))) & 7];
          else rgba[o + 3] = pal[ci + 3];
        }
      }
    }
    return empacar(ifmt, w, h, rgba);
  }

  function empacar(ifmt, w, h, rgba) {
    if (ifmt === RGB_DXT1) {
      const d = new Uint16Array(w * h);
      for (let i = 0, o = 0; i < d.length; i++, o += 4) d[i] = ((rgba[o] >> 3) << 11) | ((rgba[o + 1] >> 2) << 5) | (rgba[o + 2] >> 3);
      return { datos: d, fmt: 0x1907, tipo: 0x8363 };
    }
    if (ifmt === RGBA_DXT1) {
      const d = new Uint16Array(w * h);
      for (let i = 0, o = 0; i < d.length; i++, o += 4) d[i] = ((rgba[o] >> 3) << 11) | ((rgba[o + 1] >> 3) << 6) | ((rgba[o + 2] >> 3) << 1) | (rgba[o + 3] >> 7);
      return { datos: d, fmt: 0x1908, tipo: 0x8034 };
    }
    return { datos: rgba, fmt: 0x1908, tipo: 0x1401 };
  }
  return { decodificar };
})();
if (typeof module !== 'undefined') module.exports = Dxt;
