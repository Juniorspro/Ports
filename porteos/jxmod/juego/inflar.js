// ---------------- gzip en JS (para navegadores sin DecompressionStream) ----------------
// Va afuera del código del juego, sin comprimir: el arranque del HTML lo usa para descomprimir el código del juego (que
// viene en gzip) y el juego, para el paquete. Las funciones quedan globales.
// gzip/deflate (RFC 1952/1951) en JS, sólo para cuando el navegador no trae DecompressionStream
function gunzipJS(d) {
  let p = 10; const flg = d[3];
  if (flg & 4) p += 2 + (d[p] | d[p + 1] << 8);
  if (flg & 8) while (d[p++]);
  if (flg & 16) while (d[p++]);
  if (flg & 2) p += 2;
  const n = d.length, tam = (d[n - 4] | d[n - 3] << 8 | d[n - 2] << 16 | d[n - 1] << 24) >>> 0;
  return inflarJS(d.subarray(p, n - 8), tam);
}
const INF = (() => {
  const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  // tabla de Huffman canónica: cuántos códigos hay de cada largo y los símbolos en orden
  const tabla = (L, n) => {
    const cnt = new Uint16Array(16), off = new Uint16Array(16), sym = new Uint16Array(n);
    for (let i = 0; i < n; i++) cnt[L[i]]++;
    cnt[0] = 0; for (let i = 1; i < 16; i++) off[i] = off[i - 1] + cnt[i - 1];
    for (let i = 0; i < n; i++) if (L[i]) sym[off[L[i]]++] = i;
    return { cnt, sym };
  };
  const fl = new Uint8Array(288); fl.fill(8, 0, 144); fl.fill(9, 144, 256); fl.fill(7, 256, 280); fl.fill(8, 280, 288);
  const fd = new Uint8Array(30).fill(5);
  return { LB, LE, DB, DE, ORD, tabla, fijaL: tabla(fl, 288), fijaD: tabla(fd, 30) };
})();
function inflarJS(src, tam) {
  const out = new Uint8Array(tam); let op = 0, ip = 0, bb = 0, bn = 0;
  const bits = (n) => { while (bn < n) { bb |= src[ip++] << bn; bn += 8; } const v = bb & ((1 << n) - 1); bb >>>= n; bn -= n; return v; };
  const dec = (h) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1); const c = h.cnt[len];
      if (code - c < first) return h.sym[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('datos dañados');
  };
  let fin;
  do {
    fin = bits(1); const t = bits(2);
    if (t === 0) {
      bb = 0; bn = 0; const len = src[ip] | src[ip + 1] << 8; ip += 4;
      out.set(src.subarray(ip, ip + len), op); ip += len; op += len;
    } else if (t === 3) throw new Error('datos dañados');
    else {
      let lh = INF.fijaL, dh = INF.fijaD;
      if (t === 2) {
        const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, cl = new Uint8Array(19);
        for (let i = 0; i < nc; i++) cl[INF.ORD[i]] = bits(3);
        const ch = INF.tabla(cl, 19), L = new Uint8Array(nl + nd);
        for (let i = 0; i < nl + nd;) {
          const sy = dec(ch);
          if (sy < 16) L[i++] = sy;
          else { let r, v = 0; if (sy === 16) { v = L[i - 1]; r = 3 + bits(2); } else if (sy === 17) r = 3 + bits(3); else r = 11 + bits(7); while (r--) L[i++] = v; }
        }
        lh = INF.tabla(L.subarray(0, nl), nl); dh = INF.tabla(L.subarray(nl), nd);
      }
      for (;;) {
        let sy = dec(lh);
        if (sy < 256) out[op++] = sy;
        else if (sy === 256) break;
        else {
          sy -= 257; const len = INF.LB[sy] + bits(INF.LE[sy]), ds = dec(dh), dist = INF.DB[ds] + bits(INF.DE[ds]);
          for (let k = 0; k < len; k++, op++) out[op] = out[op - dist];
        }
      }
    }
  } while (!fin);
  return out;
}
