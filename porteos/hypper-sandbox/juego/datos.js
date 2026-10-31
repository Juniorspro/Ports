// ---------------------------------------------------------------------------------------------------------
// el paquete del juego va adentro del HTML (base64): índice + un solo bloque con todo pegado
// d = datos (gzip), m = mallas (gzip), tN = texturas webp, a:nombre = sonidos mp3, i:nombre = íconos webp
// ---------------------------------------------------------------------------------------------------------
let DATA = null, BIN = null;
const PK = {
  u8: null, idx: null,
  extra: {},   // (lo que llegó en los paquetes aparte: texturas)
  parte(k) { const e = this.idx[k]; return e ? this.u8.subarray(e[0], e[0] + e[1]) : this.extra[k] || null; },
  urls: {},
  url(k, tipo) { if (this.urls[k]) return this.urls[k]; const p = this.parte(k); if (!p) return ''; return (this.urls[k] = URL.createObjectURL(new Blob([p], { type: tipo }))); },
};
async function desgz(a) {
  // el navegador lo descomprime solo; si no sabe (navegadores o visores viejos), se hace acá en JS
  if (typeof DecompressionStream === 'function' && Blob.prototype.stream) {
    try { return new Uint8Array(await new Response(new Blob([a]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); } catch (e) {}
  }
  return gunzipJS(a);
}
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
async function b64bytes(s) {
  if (typeof Uint8Array.fromBase64 === 'function') { try { return Uint8Array.fromBase64(s); } catch (e) {} }
  // fetch de un data: es lo más rápido; si el navegador no lo hace (o se cuelga), a mano por partes
  try {
    return await Promise.race([
      fetch('data:application/octet-stream;base64,' + s).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)),
      new Promise((_, no) => setTimeout(() => no(new Error('lento')), 12000)),
    ]);
  } catch (e) {
    const n = s.length, out = new Uint8Array(Math.floor(n * 3 / 4)); let o = 0;
    for (let i = 0; i < n; i += 65536) { const b = atob(s.slice(i, i + 65536)); for (let j = 0; j < b.length; j++) out[o++] = b.charCodeAt(j); }
    return out.subarray(0, o);
  }
}
async function cargarPaquete(progreso) {
  PK.idx = JSON.parse($('pkidx').textContent);
  // el paquete viene en pedazos de 1 MB después del código del juego: mientras el HTML baja se decodifica cada pedazo que
  // terminó de llegar (uno está entero cuando ya empezó el siguiente, o cuando el documento terminó) y la parte de las
  // mallas (gzip) va entrando al descompresor a medida que llega. La pantalla de carga cuenta lo bajado
  let tam = 0; for (const k in PK.idx) tam = Math.max(tam, PK.idx[k][0] + PK.idx[k][1]);
  PK.u8 = new Uint8Array(tam);
  const els = document.getElementsByClassName('pk'), M = PK.idx.m, Dd = PK.idx.d;
  let o = 0, i = 0, mDado = M ? M[0] : 0, gz = null, gzErr = null, dP = null;
  if (M && typeof DecompressionStream === 'function') {
    try { const ds = new DecompressionStream('gzip'); gz = { w: ds.writable.getWriter(), r: new Response(ds.readable).arrayBuffer() }; gz.r.catch((e) => { gzErr = e; }); } catch (e) { gz = null; }
  }
  for (;;) {
    const fin = document.readyState !== 'loading';
    for (; i < els.length - (fin ? 0 : 1); i++) {
      const b = await b64bytes(els[i].textContent); PK.u8.set(b, o); o += b.length; els[i].textContent = '';
      if (gz && o > mDado && mDado < M[0] + M[1]) { const h = Math.min(o, M[0] + M[1]); gz.w.write(PK.u8.subarray(mDado, h)).catch((e) => { gzErr = e; }); mDado = h; }
      // los datos (lo primero del paquete) se leen apenas están enteros, mientras baja lo demás
      if (!dP && Dd && o >= Dd[0] + Dd[1]) dP = desgz(PK.parte('d')).then((u) => JSON.parse(new TextDecoder().decode(u)));
    }
    if (fin && i >= els.length) break;
    await new Promise((ok) => setTimeout(ok, 25));
  }
  progreso(0.5);
  if (gz) { gz.w.close().catch((e) => { gzErr = e; }); }
  DATA = await (dP || desgz(PK.parte('d')).then((u) => JSON.parse(new TextDecoder().decode(u))));
  progreso(0.7);
  if (gz) { try { const r = await gz.r; if (!gzErr) BIN = new Uint8Array(r); } catch (e) {} }
  if (!BIN) BIN = await desgz(PK.parte('m'));   // (sin descompresor del navegador, o si falló: entero, como antes)
  if (M && M[2] === 1) desfiltrarIndices(BIN, DATA.ms.filter((m) => !m.k));
  // lo que ya se leyó (los datos y las mallas comprimidas, ~19 MB) no hace falta más: el paquete se queda sólo con lo que
  // se pide después (texturas, sonidos, íconos, videos). Importa en los celulares de 2 GB
  { const quedan = Object.entries(PK.idx).filter(([k]) => k !== 'd' && k !== 'm'); let t = 0; for (const [, e] of quedan) t += e[1];
    const nu = new Uint8Array(t), idx = {}; let o2 = 0;
    for (const [k, e] of quedan) { nu.set(PK.u8.subarray(e[0], e[0] + e[1]), o2); idx[k] = [o2, e[1]]; o2 += e[1]; }
    PK.u8 = nu; PK.idx = idx; }
  progreso(0.95);
  // índices por nombre
  DATA.pfPorNombre = {};
  for (const k in DATA.pf) { const n = k.split('#')[0]; if (!DATA.pfPorNombre[n]) DATA.pfPorNombre[n] = k; }
  DATA.anPorNombre = {};
  for (const k in DATA.an.clips) DATA.anPorNombre[k] = DATA.an.clips[k][0];
}
// los índices de los triángulos vienen como diferencias en zigzag con los bytes en planos (lo arma armar.py): se
// vuelven a armar en su lugar (una vez por zona, aunque dos mallas la compartan)
function desfiltrarIndices(BIN, lista) {
  const hechos = new Set();
  for (const m of lista) {
    if (m.o === undefined || m.o === null || !m.sub || !m.sub.length || hechos.has(m.i)) continue;
    hechos.add(m.i); let n = 0; for (const s of m.sub) n = Math.max(n, s[0] + s[1]);
    const w = m.i32 ? 4 : 2, src = BIN.slice(m.i, m.i + n * w); let ant = 0, o = m.i;
    if (w === 2) for (let k = 0; k < n; k++) { const z = src[k] | src[n + k] << 8; ant = (ant + ((z >>> 1) ^ -(z & 1))) & 0xffff; BIN[o++] = ant & 255; BIN[o++] = ant >>> 8; }
    else for (let k = 0; k < n; k++) {
      const z = (src[k] | src[n + k] << 8 | src[2 * n + k] << 16 | src[3 * n + k] << 24) >>> 0; ant = (ant + ((z >>> 1) ^ -(z & 1))) >>> 0;
      BIN[o++] = ant & 255; BIN[o++] = (ant >>> 8) & 255; BIN[o++] = (ant >>> 16) & 255; BIN[o++] = ant >>> 24;
    }
  }
}
const icono = (n) => (DATA.ico[n] ? PK.url('i:' + DATA.ico[n], 'image/webp') : '');
// vértices de una malla en la CPU (para choques y rayos): posiciones [x,y,z,...] e índices
const _mallaCPU = {};
function mallaCPU(i) {
  if (_mallaCPU[i]) return _mallaCPU[i];
  const d = DATA.ms[i], B = binDe(d); if (!B) { rbPedir(d.k); return null; }
  const dv = new DataView(B.buffer, B.byteOffset);
  const P = new Float32Array(d.v * 3);
  for (let k = 0; k < d.v; k++) {
    const o = d.o + k * 14;
    P[k * 3] = d.mn[0] + dv.getUint16(o, true) / 65535 * d.sc[0];
    P[k * 3 + 1] = d.mn[1] + dv.getUint16(o + 2, true) / 65535 * d.sc[1];
    P[k * 3 + 2] = d.mn[2] + dv.getUint16(o + 4, true) / 65535 * d.sc[2];
  }
  let n = 0; for (const s of d.sub) n = Math.max(n, s[0] + s[1]);
  const I = d.i32 ? new Uint32Array(n) : new Uint16Array(n);
  for (let k = 0; k < n; k++) I[k] = d.i32 ? dv.getUint32(d.i + k * 4, true) : dv.getUint16(d.i + k * 2, true);
  return (_mallaCPU[i] = { P, I, d });
}

// ---------------- paquetes aparte (hypper/rb/, de herramientas/remotos.py) ----------------
// Los personajes que no son el Hero y los mapas grandes (mallas y texturas) no van adentro del HTML: se bajan cuando
// hacen falta (al elegir el personaje, al entrar al mapa, cuando otro jugador lo usa) del lado del HTML o, si se abrió
// como archivo, de GitHub. Se guardan en la caché del navegador (el nombre lleva el contenido: nunca quedan viejos).
const RBP = { bins: {}, est: {}, prom: {}, alListo: [], falla: {},
  bases: ['rb/', 'https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/hypper/rb/', 'https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/hypper/rb/'] };
const rbListo = (k) => !k || !DATA.rbp || !DATA.rbp[k] || RBP.est[k] === 'ok';
const binDe = (d) => (d && d.k ? RBP.bins[d.k] || null : BIN);
const rbDeSkin = (s) => 's_' + s, rbDeMapa = (m) => 'm_' + m;
function rbPedir(k) { if (k && !rbListo(k) && !RBP.prom[k] && performance.now() - (RBP.falla[k] || -1e9) > 10000) rbAsegurar(k); }
async function rbBajar(nom, prog) {
  let cache = null; try { if (window.caches && location.protocol === 'https:') cache = await caches.open('rb-paquetes-1'); } catch (e) {}
  for (const b of RBP.bases) {
    if (location.protocol === 'file:' && !/^https?:/.test(b)) continue;   // (abierto como archivo: el navegador no deja leer al lado)
    const url = new URL(b + nom, location.href).href;
    try {
      let r = cache && (await cache.match(url));
      if (!r) { r = await fetch(url); if (!r.ok) continue; if (cache) cache.put(url, r.clone()).catch(() => {}); }
      // (de a pedazos, para mostrar cuánto va)
      if (prog && r.body && r.body.getReader) {
        const tot = +r.headers.get('content-length') || 0, rd = r.body.getReader(), ps = []; let n = 0;
        for (;;) { const { done, value } = await rd.read(); if (done) break; ps.push(value); n += value.length; prog(n, tot); }
        const u = new Uint8Array(n); let o = 0; for (const p of ps) { u.set(p, o); o += p.length; } return u;
      }
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {}
  }
  return null;
}
function rbAsegurar(k, prog) {
  if (rbListo(k)) return Promise.resolve(true);
  if (RBP.prom[k]) return RBP.prom[k];
  return (RBP.prom[k] = (async () => {
    const u8 = await rbBajar(DATA.rbp[k][0], prog);
    let ok = false;
    try {
      if (u8 && String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) === 'RBP1') {
        const n = u8[4] | u8[5] << 8 | u8[6] << 16 | u8[7] << 24, idx = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + n))), c = u8.subarray(8 + n);
        if (idx.m) { const b = await desgz(c.subarray(idx.m[0], idx.m[0] + idx.m[1])); desfiltrarIndices(b, DATA.ms.filter((m) => m.k === k)); RBP.bins[k] = b; }
        for (const t in idx.t) PK.extra['t' + t] = c.subarray(idx.t[t][0], idx.t[t][0] + idx.t[t][1]);
        for (const a in idx.a || {}) { PK.extra['a:' + a] = c.subarray(idx.a[a][0], idx.a[a][0] + idx.a[a][1]); if (DATA.son.includes(a) && typeof audioBuf === 'function') audioBuf(a); }   // (los de la lista de entrada, listos para sonar)
        ok = true;
      }
    } catch (e) {}
    delete RBP.prom[k];
    if (!ok) { RBP.falla[k] = performance.now(); return false; }
    RBP.est[k] = 'ok';
    for (const f of RBP.alListo) { try { f(k); } catch (e) {} }
    return true;
  })());
}
// lo que hace falta para jugar en un mapa con un personaje (la pizzería trae a los animatrónicos como personajes)
function rbParaPartida(mapa, skin) {
  const L = [rbDeMapa(mapa), rbDeSkin(skin || PREFS.skin)];
  if (mapa === 'RB_Pizzeria') L.push(...['Freddy', 'Bonnie', 'Chica', 'Foxy'].map(rbDeSkin));
  return L.filter((k) => !rbListo(k));
}
// varios a la vez, con un solo número de progreso (bytes bajados / total)
async function rbAsegurarTodos(L, prog) {
  const tot = L.reduce((a, k) => a + ((DATA.rbp[k] || [0, 0])[1] || 0), 0), va = {};
  const r = await Promise.all(L.map((k) => rbAsegurar(k, (n) => { va[k] = n; if (prog) prog(Object.values(va).reduce((a, b) => a + b, 0), tot); })));
  return r.every(Boolean);
}
