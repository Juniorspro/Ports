// ---------------------------------------------------------------------------------------------------------
// el paquete del juego va adentro del HTML (base64): índice + un solo bloque con todo pegado
// d = datos (gzip), m = mallas (gzip), tN = texturas webp, a:nombre = sonidos mp3, i:nombre = íconos webp
// ---------------------------------------------------------------------------------------------------------
let DATA = null, BIN = null;
const PK = {
  u8: null, idx: null,
  parte(k) { const e = this.idx[k]; return e ? this.u8.subarray(e[0], e[0] + e[1]) : null; },
  urls: {},
  url(k, tipo) { if (this.urls[k]) return this.urls[k]; const p = this.parte(k); if (!p) return ''; return (this.urls[k] = URL.createObjectURL(new Blob([p], { type: tipo }))); },
};
async function desgz(a) {
  return new Uint8Array(await new Response(new Blob([a]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
async function b64bytes(s) {
  try { return new Uint8Array(await (await fetch('data:application/octet-stream;base64,' + s)).arrayBuffer()); }
  catch (e) {
    const n = s.length, out = new Uint8Array(Math.floor(n * 3 / 4)); let o = 0;
    for (let i = 0; i < n; i += 65536) { const b = atob(s.slice(i, i + 65536)); for (let j = 0; j < b.length; j++) out[o++] = b.charCodeAt(j); }
    return out.subarray(0, o);
  }
}
async function cargarPaquete(progreso) {
  PK.idx = JSON.parse($('pkidx').textContent);
  progreso(0.1);
  const el = $('pk'); PK.u8 = await b64bytes(el.textContent); el.textContent = '';
  progreso(0.5);
  DATA = JSON.parse(new TextDecoder().decode(await desgz(PK.parte('d'))));
  progreso(0.7);
  BIN = await desgz(PK.parte('m'));
  progreso(0.95);
  // índices por nombre
  DATA.pfPorNombre = {};
  for (const k in DATA.pf) { const n = k.split('#')[0]; if (!DATA.pfPorNombre[n]) DATA.pfPorNombre[n] = k; }
  DATA.anPorNombre = {};
  for (const k in DATA.an.clips) DATA.anPorNombre[k] = DATA.an.clips[k][0];
}
const icono = (n) => (DATA.ico[n] ? PK.url('i:' + DATA.ico[n], 'image/webp') : '');
// vértices de una malla en la CPU (para choques y rayos): posiciones [x,y,z,...] e índices
const _mallaCPU = {};
function mallaCPU(i) {
  if (_mallaCPU[i]) return _mallaCPU[i];
  const d = DATA.ms[i], dv = new DataView(BIN.buffer, BIN.byteOffset);
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
