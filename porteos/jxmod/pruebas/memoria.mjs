// ¿cuánta memoria usa el juego? (en un celular de 2-3 GB, si la pestaña pasa de unos 300-400 MB entre JavaScript y la
// placa, el sistema la cierra: "se crashea"). Cuenta, en modo celular y calidad Patata: la memoria de JavaScript usada
// (performance.memory) y lo que se sube a la placa (texturas con sus mipmaps y búferes de vértices, sumados al crearse y
// restados al borrarse), en cada momento: el menú, una partida en FlatGrass, con armas y personajes de addons pesados, y
// con un mapa del Workshop. Da las texturas más grandes.
// uso: node memoria.mjs URL_HTML URL_CARPETA_GMA [IDS_ADDONS=128089118,216408135,139247091] [ID_MAPA] [calidad=patata]
import { abrir } from './base.mjs';
const [, , HTML, CARP, ADDONS = '128089118,216408135,139247091', MAPA = '', CAL = 'patata'] = process.argv;
const contar = () => {
  const M = (window.__mem = { tex: new Map(), buf: new Map(), ligada: new Map(), bufLig: new Map() });
  const bpp = (fmt, tipo) => (tipo === 0x1406 ? 16 : tipo === 0x140b ? 8 : fmt === 0x1907 || fmt === 0x8051 ? 3 : fmt === 0x1909 || fmt === 0x1903 || fmt === 0x8229 ? 1 : 4);
  for (const C of [WebGLRenderingContext, typeof WebGL2RenderingContext !== 'undefined' ? WebGL2RenderingContext : null]) {
    if (!C) continue; const P = C.prototype;
    const bT = P.bindTexture; P.bindTexture = function (t, x) { M.ligada.set(t, x); return bT.call(this, t, x); };
    const tI = P.texImage2D; P.texImage2D = function (...a) {
      const r = tI.apply(this, a); const x = M.ligada.get(a[0] === 0x8513 || (a[0] >= 0x8515 && a[0] <= 0x851a) ? 0x8513 : a[0]); if (!x || a[1] !== 0) return r;
      let w, h, b; if (a.length >= 8) { w = a[3]; h = a[4]; b = bpp(a[2], a[7]); } else { const s = a[5]; w = s.width || s.videoWidth || 0; h = s.height || s.videoHeight || 0; b = bpp(a[2], a[4]); }
      const o = M.tex.get(x) || { b: 0, w, h, mip: false }; o.w = w; o.h = h; o.b = w * h * b * (a[0] === 0x0de1 ? 1 : 6); M.tex.set(x, o); return r; };
    const tS = P.texStorage2D; if (tS) P.texStorage2D = function (t, lv, f, w, h) { const r = tS.call(this, t, lv, f, w, h); const x = M.ligada.get(t); if (x) M.tex.set(x, { b: w * h * 4 * 1.33, w, h, mip: true }); return r; };
    const gM = P.generateMipmap; P.generateMipmap = function (t) { const x = M.ligada.get(t), o = x && M.tex.get(x); if (o && !o.mip) { o.mip = true; o.b *= 1.333; } return gM.call(this, t); };
    const dT = P.deleteTexture; P.deleteTexture = function (x) { M.tex.delete(x); return dT.call(this, x); };
    const bB = P.bindBuffer; P.bindBuffer = function (t, x) { M.bufLig.set(t, x); return bB.call(this, t, x); };
    const bD = P.bufferData; P.bufferData = function (t, d, u) { const x = M.bufLig.get(t); if (x) M.buf.set(x, typeof d === 'number' ? d : d.byteLength); return bD.call(this, t, d, u); };
    const dB = P.deleteBuffer; P.deleteBuffer = function (x) { M.buf.delete(x); return dB.call(this, x); };
  }
};
const { b, p, err, ev } = await abrir(HTML, true, null, async (pg) => { await pg.addInitScript(contar); });
const medir = async (n) => {
  const r = await ev(`(() => { const M = window.__mem; let t = 0, bu = 0; const L = []; for (const [, o] of M.tex) { t += o.b; L.push(o); } for (const [, v] of M.buf) bu += v;
    L.sort((a, c) => c.b - a.b); const pm = performance.memory || {};
    return { js: +((pm.usedJSHeapSize || 0) / 1048576).toFixed(1), jsTotal: +((pm.totalJSHeapSize || 0) / 1048576).toFixed(1), tex: +(t / 1048576).toFixed(1), nTex: M.tex.size, buf: +(bu / 1048576).toFixed(1),
      grandes: L.slice(0, 6).map((o) => o.w + '×' + o.h + ' ' + (o.b / 1048576).toFixed(1) + 'MB') }; })()`);
  r.total = +(r.jsTotal + r.tex + r.buf).toFixed(1); console.log(n.padEnd(26), JSON.stringify(r)); return r;
};
await medir('menú');
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(5000);
const R0 = await medir('FlatGrass');
await ev(`(async () => { for (const id of ${JSON.stringify(ADDONS.split(',').filter(Boolean))}) { const r = await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma'); if (!r.ok) continue; const A = await gmInstalar(id, { nombre: id, sinDeps: true }, new Uint8Array(await r.arrayBuffer())); await A.listo; }
  try { gmaDarArma('m9k_ak47'); elegirArma(ARM.lista.indexOf('gm:m9k_ak47')); } catch (e) {}
  const mods = PERSONAJES_GM && PERSONAJES_GM.length ? PERSONAJES_GM : []; return 1; })()`).catch(() => 0);
await ev(`(() => { try { const L = (typeof gmpLista === 'function' ? gmpLista() : []).slice(0, 3); for (let i = 0; i < 6; i++) { const m = L[i % Math.max(1, L.length)]; if (!m) break; npcCrear('gmpm:' + (m.ruta || m), v3(JUG.pos.x + 3 + i, JUG.pos.y - 0.9, JUG.pos.z + 4), 0, { modo: 'quieto', vida: 100 }); } } catch (e) {} return 1; })()`).catch(() => 0);
await p.waitForTimeout(6000);
const R1 = await medir('con addons y NPCs');
let R2 = null;
if (MAPA) {
  await ev(`(async () => { const r = await fetch(${JSON.stringify(CARP)} + '/${MAPA}.gma'); const A = await gmInstalar('${MAPA}', { nombre: 'mapa', sinDeps: true }, new Uint8Array(await r.arrayBuffer())); await A.listo;
    const L = (A.mapas || []); if (L.length) { const n = typeof L[0] === 'string' ? L[0] : L[0].n || L[0].nombre; await gbspJugar ? gbspJugar(A, n) : 0; } return 1; })()`).catch((e) => console.log('mapa:', String(e).slice(0, 120)));
  await p.waitForTimeout(15000);
  R2 = await medir('mapa ' + MAPA);
}
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
console.log('errores', JSON.stringify(e2.slice(0, 4)));
console.log('RESUMEN ' + JSON.stringify({ flatgrass: R0.total, addons: R1.total, mapa: R2 && R2.total }));
await b.close(); process.exit(0);
