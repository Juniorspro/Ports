// Un celular de 512 MB de RAM con procesador de 1,4 GHz (Android Go: Cortex-A53, Mali-T720 / PowerVR GE8100 / Adreno
// 308), pantalla de 960×480, en Alto con sombras medias (pedido del Discord). Mide, en gm_construct con 6 objetos y 10
// personajes caminando:
//  - memoria: la de JavaScript (performance.memory) y lo que se sube a la placa: texturas (con sus mipmaps), búferes
//    de render (renderbuffers), búferes de vértices y la pantalla misma; las 8 cosas más grandes;
//  - placa: por cuadro, cuántos dibujos, pasadas, píxeles que se pintan y bytes que se mueven en cada pasada (como en
//    una GPU de celular, que trae y guarda cada búfer por pasada);
//  - si JSON=archivo, lo guarda para comparar.
// uso: node celu512.mjs URL_HTML [calidad=alto] [sombras=1] [ANCHOxALTO=960x480]
import { createRequire } from 'module'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , HTML, CAL = 'alto', SOMB = '1', TAM = '960x480'] = process.argv;
// (pantalla de 960×480 píxeles con densidad 1,5: 640×320 para la página, como un Android Go de 5,5")
const [W, H] = TAM.split('x').map(Number), DPR = +(process.env.DPR || 1.5);
const espia = () => {
  const M = (window.__mem = { tex: new Map(), rb: new Map(), buf: new Map(), lig: new Map(), rbLig: null, bufLig: new Map(), cuadro: null });
  const bpp = (f, t) => {
    const F = { 0x8058: 4, 0x881A: 8, 0x8C3A: 4, 0x822E: 4, 0x8814: 16, 0x81A6: 4, 0x81A5: 2, 0x8CAC: 4, 0x88F0: 4, 0x8D48: 1, 0x8229: 1, 0x822B: 2, 0x8D62: 2, 0x8051: 3, 0x1908: 4, 0x1907: 3, 0x1909: 1, 0x190A: 2, 0x1903: 1, 0x1902: 4, 0x8C43: 4, 0x8C41: 3, 0x8F98: 4 };
    if (t === 0x1406) return f === 0x1903 || f === 0x8229 ? 4 : 16; if (t === 0x140b) return 8; return F[f] || 4; };
  for (const C of [WebGLRenderingContext, typeof WebGL2RenderingContext !== 'undefined' ? WebGL2RenderingContext : null]) {
    if (!C) continue; const P = C.prototype;
    const bT = P.bindTexture; P.bindTexture = function (t, x) { M.lig.set(t, x); return bT.call(this, t, x); };
    const tI = P.texImage2D; P.texImage2D = function (...a) {
      const r = tI.apply(this, a); const cara = a[0] >= 0x8515 && a[0] <= 0x851a, x = M.lig.get(cara ? 0x8513 : a[0]); if (!x || a[1] !== 0) return r;
      let w, h, b; if (a.length >= 8) { w = a[3]; h = a[4]; b = bpp(a[2], a[7]); } else { const s = a[5]; w = s.width || s.videoWidth || 0; h = s.height || s.videoHeight || 0; b = bpp(a[2], a[4]); }
      const o = M.tex.get(x) || { b: 0, w, h, mip: false, caras: 0 }; o.w = w; o.h = h; o.bpp = b;
      if (cara) { o.caras = Math.min(6, (o.caras || 0) + 1); o.b = w * h * b * 6; } else o.b = w * h * b; if (o.mip) o.b *= 1.333; M.tex.set(x, o); return r; };
    const tS = P.texStorage2D; if (tS) P.texStorage2D = function (t, lv, f, w, h) { const r = tS.call(this, t, lv, f, w, h); const x = M.lig.get(t); if (x) M.tex.set(x, { b: w * h * bpp(f) * (lv > 1 ? 1.333 : 1) * (t === 0x8513 ? 6 : 1), w, h, mip: lv > 1, f }); return r; };
    const gM = P.generateMipmap; P.generateMipmap = function (t) { const x = M.lig.get(t), o = x && M.tex.get(x); if (o && !o.mip) { o.mip = true; o.b *= 1.333; } return gM.call(this, t); };
    const dT = P.deleteTexture; P.deleteTexture = function (x) { M.tex.delete(x); return dT.call(this, x); };
    const fT = P.framebufferTexture2D; P.framebufferTexture2D = function (t, a, tt, x, l) { if (x) { const o = M.tex.get(x); if (o) o.rt = true; M.rts = M.rts || new Set(); M.rts.add(x); } return fT.call(this, t, a, tt, x, l); };
    const bR = P.bindRenderbuffer; P.bindRenderbuffer = function (t, x) { M.rbLig = x; return bR.call(this, t, x); };
    const rS = P.renderbufferStorage; P.renderbufferStorage = function (t, f, w, h) { if (M.rbLig) M.rb.set(M.rbLig, { w, h, b: w * h * bpp(f), f }); return rS.call(this, t, f, w, h); };
    const rM = P.renderbufferStorageMultisample; if (rM) P.renderbufferStorageMultisample = function (t, s, f, w, h) { if (M.rbLig) M.rb.set(M.rbLig, { w, h, b: w * h * bpp(f) * Math.max(1, s), f, s }); return rM.call(this, t, s, f, w, h); };
    const dR = P.deleteRenderbuffer; P.deleteRenderbuffer = function (x) { M.rb.delete(x); return dR.call(this, x); };
    const bB = P.bindBuffer; P.bindBuffer = function (t, x) { M.bufLig.set(t, x); return bB.call(this, t, x); };
    const bD = P.bufferData; P.bufferData = function (t, d, u) { const x = M.bufLig.get(t); if (x) M.buf.set(x, typeof d === 'number' ? d : d.byteLength); return bD.call(this, t, d, u); };
    const dB = P.deleteBuffer; P.deleteBuffer = function (x) { M.buf.delete(x); return dB.call(this, x); };
    // (por cuadro: dibujos, pasadas —cada vez que cambia el framebuffer— y el área de cada una)
    const bF = P.bindFramebuffer; P.bindFramebuffer = function (t, f) { const C = M.cuadro; if (C && (t === 0x8D40 || t === 0x8CA9)) { C.pasadas++; C.fb = f; } return bF.call(this, t, f); };
    const vp = P.viewport; P.viewport = function (x, y, w, h) { const C = M.cuadro; if (C) C.vp = w * h; return vp.call(this, x, y, w, h); };
    for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const o = P[n]; if (o) P[n] = function (...a) { const C = M.cuadro; if (C) { C.dibujos++; C.fbs.add(C.fb || 'pantalla'); } return o.apply(this, a); }; }
    const cl = P.clear; P.clear = function (m) { const C = M.cuadro; if (C) C.clears++; return cl.call(this, m); };
    const bl = P.blitFramebuffer; if (bl) P.blitFramebuffer = function (...a) { const C = M.cuadro; if (C) C.copias++; return bl.apply(this, a); };
  }
};
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const ctx = await b.newContext({ viewport: { width: Math.round(W / DPR), height: Math.round(H / DPR) }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const p = await ctx.newPage(), err = [];
p.on('pageerror', (e) => err.push(e.message.slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
await p.addInitScript(espia);
await p.goto(HTML); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const MB = (x) => +(x / 1048576).toFixed(1);
const memoria = async () => {
  const r = await ev(`(() => { const M = window.__mem, pm = performance.memory || {}; const L = [];
    let t = 0, rb = 0, bu = 0, trt = 0, ntj = 0; for (const [x, o] of M.tex) { t += o.b; const rt = M.rts && M.rts.has(x); if (rt) trt += o.b; else ntj++; L.push({ q: rt ? 'rt' : 'tex', w: o.w, h: o.h, b: o.b }); } for (const [, o] of M.rb) { rb += o.b; L.push({ q: 'rb', w: o.w, h: o.h, b: o.b }); } for (const [, v] of M.buf) bu += v;
    const cv = R.cv, pant = cv.width * cv.height * 4 * 2 + cv.width * cv.height * 4;   // (doble búfer de color y profundidad de la pantalla)
    L.sort((a, c) => c.b - a.b);
    return { js: pm.usedJSHeapSize || 0, jsTotal: pm.totalJSHeapSize || 0, tex: t, texRT: trt, nTex: M.tex.size, nTexJuego: ntj, rb, buf: bu, pant, lienzo: cv.width + 'x' + cv.height, grandes: L.slice(0, 14).map((o) => o.q + ' ' + o.w + '×' + o.h + ' ' + (o.b / 1048576).toFixed(1)) }; })()`);
  const o = { js: MB(r.js), jsTotal: MB(r.jsTotal), tex: MB(r.tex), texRT: MB(r.texRT), nTex: r.nTex, nTexJuego: r.nTexJuego, rb: MB(r.rb), buf: MB(r.buf), pant: MB(r.pant), lienzo: r.lienzo, grandes: r.grandes };
  o.placa = +(o.tex + o.rb + o.buf + o.pant).toFixed(1); o.total = +(o.jsTotal + o.placa).toFixed(1); return o;
};
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; PREFS.sombras = ${JSON.stringify(SOMB)}; PREFS.resDin = false; PREFS.res = 100; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
await ev(`(() => { JUG.pos.set(3.42, -2.72, 24.14); JUG.vel.set(0, 0, 0); cerrarPaneles(); JUG.yaw = 0; JUG.pitch = 0.1; for (let k = 0; k < 6; k++) spawnDelante(['Crate', 'Barrel', 'Crate'][k % 3], {});
  let n = 0; for (let k = 0; k < 60 && n < 10; k++) { const d = [5, 9, 16, 20, 24, 28, 32, 36, 40, 45][n], a = k * 2.399, x = JUG.pos.x + Math.cos(a) * d, z = JUG.pos.z + Math.sin(a) * d;
    const h = raycast(v3(x, JUG.pos.y + 25, z), v3(0, -1, 0), 60); if (!h || !h.ground || h.n.y < 0.7) continue; const y = JUG.pos.y + 25 - h.t; if (Math.abs(y - JUG.pos.y) > 12) continue;
    npcCrear(['Hero', 'Soldier'][n % 2], v3(x, y + 0.05, z), 0, { modo: 'pasear', vel: 1.4, vida: 100 }); n++; }
  DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); return 1; })()`);
// (sin el ahorro automático: la calidad elegida completa, que es lo que ocupa más)
await ev(`gfxAhorroPaso = () => {}; GFX.ahorro = 0; aplicarGfx(); 1`);
await p.waitForTimeout(8000);
// (dar una vuelta: que se carguen las texturas de todo lo que se ve alrededor)
for (let i = 0; i < 8; i++) { await ev(`JUG.yaw = ${i} * Math.PI / 4; 1`); await p.waitForTimeout(700); }
await ev(`JUG.yaw = 0; 1`); await p.waitForTimeout(1500);
// (la memoria viva: después de juntar la basura dos veces —con el protocolo del navegador—, tres muestras; la menor y la mayor)
const cdpM = await ctx.newCDPSession(p); await cdpM.send('HeapProfiler.enable');
const muestras = [];
for (let k = 0; k < 3; k++) { await cdpM.send('HeapProfiler.collectGarbage'); await cdpM.send('HeapProfiler.collectGarbage'); muestras.push(await memoria()); await p.waitForTimeout(1000); }
const mem = muestras.reduce((a, x) => (x.js < a.js ? x : a)); mem.jsMax = Math.max(...muestras.map((x) => x.js)); mem.totalMax = Math.max(...muestras.map((x) => x.total));
// (un cuadro: lo que se le pide a la placa)
const q = await ev(`new Promise((fin) => { const M = window.__mem; const L = []; let k = 0;
  const f = () => { if (M.cuadro) L.push({ dibujos: M.cuadro.dibujos, pasadas: M.cuadro.pasadas, fbs: M.cuadro.fbs.size, clears: M.cuadro.clears, copias: M.cuadro.copias }); M.cuadro = { dibujos: 0, pasadas: 0, fbs: new Set(), clears: 0, copias: 0, fb: null };
    if (++k > 31) { M.cuadro = null; const m = (c) => +(L.reduce((s, x) => s + x[c], 0) / L.length).toFixed(1); return fin({ cuadros: L.length, dibujos: m('dibujos'), pasadas: m('pasadas'), fbs: m('fbs'), clears: m('clears'), copias: m('copias'), fps: +(TIEMPO.fps || 0).toFixed(0), escala: GFX.escala, sombra: [GFX.sombra, GFX.smTam, GFX.sDist], post: { hdr: GFX.hdr, ao: GFX.ao, bloom: GFX.bloom, fxaa: GFX.fxaa, refl: GFX.refl } }); }
    requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
// RECORRIDO=1: después se pasa por otros mapas (la pizzería y el desierto, 45 s en cada uno) y se vuelve a medir: ¿la
// memoria crece con cada mapa visitado?
const recorrido = [];
if (process.env.RECORRIDO) for (const m of ['RB_Pizzeria', 'RB_Desierto']) {
  await ev(`(() => { empezarPartida(${JSON.stringify(m)}); return 1; })()`);
  await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego' && !!JUG.suelo`), m, { timeout: 120000 }).catch(() => {});
  for (let i = 0; i < 8; i++) { await ev(`JUG.yaw = ${i} * Math.PI / 4; 1`); await p.waitForTimeout(600); }
  await p.waitForTimeout(40000);
  await cdpM.send('HeapProfiler.collectGarbage'); await cdpM.send('HeapProfiler.collectGarbage');
  const x = await memoria(); recorrido.push({ mapa: m, js: x.js, tex: x.tex, placa: x.placa, total: x.total, rbp: await ev(`Object.keys(RBP.bins).filter((k) => /^m_/.test(k)).join(',')`) });
}
const salida = { html: HTML.split('/').pop(), calidad: CAL, sombras: SOMB, tam: TAM, mem, placa: q, recorrido };
console.log(JSON.stringify(salida, null, 1));
if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(salida));
const e = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|willReadFrequently/i.test(x));
if (e.length) console.log('errores', JSON.stringify(e.slice(0, 4)));
await b.close(); process.exit(0);
