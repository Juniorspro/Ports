// Modo memoria baja (celulares de 512 MB–1 GB; ?mem512 lo fuerza): ¿se ve igual? La misma escena de gm_construct en Alto
// con sombras medias, desde 4 lugares, con y sin el modo; y la memoria de cada uno.
//  1. la imagen casi no cambia: diferencia media ≤ 3 (de 255; el formato de 16 bits redondea a pasos de 4 u 8, así que
//     menos de medio paso) y ≤ 1 % de píxeles con más de 12 de diferencia. Se mide en los píxeles quietos: se hace una
//     segunda corrida normal y lo que cambia entre las dos normales (nubes, pájaros, el pasto que se mueve) no cuenta;
//  2. las sombras siguen en su lugar: en las 4 vistas la parte sombreada de la imagen no cambia más de 1 punto porcentual;
//  3. ocupa menos: memoria de la placa ≥ 25 % menos;
//  4. sin errores de JS.
// uso: node memoria_baja.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , HTML, D = ''] = process.argv; if (D) fs.mkdirSync(D, { recursive: true });
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const VISTAS = [[3.42, -2.72, 24.14, 0, 0.1], [3.42, -2.72, 24.14, 2.2, 0.05], [-30, 0.5, 8, Math.PI, 0.35], [10, 1, -20, 1, 0.2]];
const errs = [];
async function correr(mem) {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 320 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  // (contar lo que ocupa la placa: texturas y búferes de dibujo)
  await p.addInitScript(() => { const M = (window.__mem = { tex: new Map(), lig: new Map() }); const P = WebGL2RenderingContext.prototype;
    const B = { 0x8D62: 2, 0x81A5: 2, 0x881A: 8, 0x8C3A: 4, 0x81A6: 4, 0x1907: 3, 0x8229: 1 };
    const bT = P.bindTexture; P.bindTexture = function (t, x) { M.lig.set(t, x); return bT.call(this, t, x); };
    const tI = P.texImage2D; P.texImage2D = function (...a) { const r = tI.apply(this, a); const cara = a[0] >= 0x8515 && a[0] <= 0x851a, x = M.lig.get(cara ? 0x8513 : a[0]); if (!x || a[1] !== 0) return r;
      let w, h; if (a.length >= 8) { w = a[3]; h = a[4]; } else { w = a[5].width; h = a[5].height; } const bpp = B[a[2]] || (a[2] === 0x1907 ? 3 : 4);
      const o = M.tex.get(x) || { b: 0 }; o.b = w * h * bpp * (cara ? 6 : 1); M.tex.set(x, o); return r; };
    const tS = P.texStorage2D; P.texStorage2D = function (t, l, f, w, h) { const r = tS.call(this, t, l, f, w, h); const x = M.lig.get(t); if (x) M.tex.set(x, { b: w * h * (B[f] || 4) }); return r; };
    const gM = P.generateMipmap; P.generateMipmap = function (t) { const x = M.lig.get(t), o = x && M.tex.get(x); if (o && !o.mip) { o.mip = true; o.b *= 1.333; } return gM.call(this, t); };
    const dT = P.deleteTexture; P.deleteTexture = function (x) { M.tex.delete(x); return dT.call(this, x); }; });
  await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'perezoso' + (mem ? '&mem512' : '')); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.sombras = '1'; PREFS.resDin = false; PREFS.res = 100; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
  await ev(`gfxAhorroPaso = () => {}; GFX.ahorro = 0; aplicarGfx(); DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); cerrarPaneles(); 1`);
  const fotos = [];
  for (const [x, y, z, yaw, pit] of VISTAS) {
    await ev(`(() => { JUG.noclip = true; JUG.pos.set(${x}, ${y}, ${z}); JUG.vel.set(0, 0, 0); JUG.yaw = ${yaw}; JUG.pitch = ${pit}; return 1; })()`);
    await p.waitForTimeout(6000);
    fotos.push(await p.screenshot());
  }
  const placa = await ev(`(() => { let t = 0; for (const [, o] of window.__mem.tex) t += o.b; return +(t / 1048576).toFixed(1); })()`);
  const info = await ev(`({ memBaja: !!GFX.memBaja })`);
  await b.close(); return { fotos, placa, info };
}
const A = await correr(false), B = await correr(true), A2 = await correr(false);
// comparar en Node con el decodificador de PNG de una página (sin dependencias)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage();
const comparar = (fa, fb, fc) => p.evaluate(async ([a, c, e]) => {
    const px = async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
    const X = await px(a), Y = await px(c), Z = await px(e); let s = 0, mal = 0, n = 0, mov = 0, sc = 0, osA = 0, osB = 0;
    const dif = (P, Q, i) => Math.max(Math.abs(P[i] - Q[i]), Math.abs(P[i + 1] - Q[i + 1]), Math.abs(P[i + 2] - Q[i + 2]));
    for (let i = 0; i < X.length; i += 4) {
      // (oscuro: luminancia < 70 —sombra—)
      const la = 0.3 * X[i] + 0.59 * X[i + 1] + 0.11 * X[i + 2], lb = 0.3 * Y[i] + 0.59 * Y[i + 1] + 0.11 * Y[i + 2]; if (la < 70) osA++; if (lb < 70) osB++;
      const dc = dif(X, Z, i); sc += dc; if (dc > 6) { mov++; continue; }   // (se movió entre las dos corridas normales)
      const d = dif(X, Y, i); s += d; n++; if (d > 12) mal++;
    }
    const N = X.length / 4;
    return { media: +(s / n).toFixed(2), malPct: +(100 * mal / n).toFixed(2), movPct: +(100 * mov / N).toFixed(2), control: +(sc / N).toFixed(2), sombraA: +(100 * osA / N).toFixed(2), sombraB: +(100 * osB / N).toFixed(2) };
  }, [fa.toString('base64'), fb.toString('base64'), fc.toString('base64')]);
const cmp = [];
for (let k = 0; k < VISTAS.length; k++) {
  if (D) { fs.writeFileSync(`${D}/normal_${k}.png`, A.fotos[k]); fs.writeFileSync(`${D}/mem512_${k}.png`, B.fotos[k]); }
  cmp.push(await comparar(A.fotos[k], B.fotos[k], A2.fotos[k]));
}
await b.close();
ok('1. la imagen casi no cambia en lo quieto (diferencia media ≤ 3, ≤ 1 % de píxeles con más de 12)', cmp.every((c) => c.media <= 3 && c.malPct <= 1 && c.movPct < 20), cmp.map((c) => ({ media: c.media, mal: c.malPct, seMueve: c.movPct, control: c.control })));
ok('2. las sombras siguen igual (parte oscura ±1 punto)', cmp.every((c) => Math.abs(c.sombraA - c.sombraB) <= 1), cmp.map((c) => [c.sombraA, c.sombraB]));
ok('3. la placa ocupa ≥ 25 % menos', B.info.memBaja && !A.info.memBaja && B.placa <= 0.75 * A.placa, { normal: A.placa, memBaja: B.placa, modo: [A.info, B.info] });
ok('4. sin errores de JS', !errs.length, errs.slice(0, 4));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
