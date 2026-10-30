// node intro.mjs Hypper.html carpeta — la intro de JXStudios cuadro por cuadro (del lienzo, con el tiempo real de la página) mientras el HTML baja lento,
// en la compu y en el celular parado; y cuándo se va la pantalla de carga
// node intro2.mjs Hypper.html carpeta
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http'; import fs from 'fs';
const [,, html, dir] = process.argv; fs.mkdirSync(dir, { recursive: true });
const datos = fs.readFileSync(html), VEL = 3e6;
const srv = http.createServer((q, r) => {
  if (!q.url.startsWith('/j.html')) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': datos.length });
  let i = 0; const paso = () => { if (i >= datos.length) { r.end(); return; } const n = Math.min(datos.length - i, VEL / 20); r.write(datos.subarray(i, i + n)); i += n; setTimeout(paso, 50); }; paso();
});
await new Promise((ok) => srv.listen(8932, '127.0.0.1', ok));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [nom, opts] of [['pc', { viewport: { width: 960, height: 540 } }], ['parado', { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true }]]) {
  const c = await b.newContext(opts), p = await c.newPage(), err = []; p.on('pageerror', (e) => err.push(e.message));
  // dentro de la página: a los 0,6 / 1,6 / 2,6 / 3,6 / 4,6 / 5,4 s de la intro, una foto del lienzo; y cuándo terminó
  await c.addInitScript(() => {
    window.__fotosIntro = []; window.__marcas = {};
    const tomar = () => { const cv = document.getElementById('introCv'), I = window.__intro; if (!cv || !I) return requestAnimationFrame(tomar);
      if (!window.__marcas.t0) window.__marcas.t0 = performance.now();
      const t = (performance.now() - window.__marcas.t0) / 1000, quiero = [0.6, 1.6, 2.6, 3.6, 4.6, 5.4];
      const k = window.__fotosIntro.length; if (k < quiero.length && t >= quiero[k]) window.__fotosIntro.push([+t.toFixed(2), cv.toDataURL('image/jpeg', 0.75)]);
      if (I.fin && !window.__marcas.fin) window.__marcas.fin = +t.toFixed(2);
      const ca = document.getElementById('carga'); if (ca && ca.classList.contains('oc') && !window.__marcas.cargaFuera) window.__marcas.cargaFuera = +t.toFixed(2);
      if (window.__listo && !window.__marcas.listo) window.__marcas.listo = +t.toFixed(2);
      if (!window.__marcas.cargaFuera) requestAnimationFrame(tomar); };
    requestAnimationFrame(tomar);
  });
  p.goto('http://127.0.0.1:8932/j.html?sinred=1').catch(() => {});
  await p.waitForFunction(() => window.__marcas && window.__marcas.cargaFuera, null, { timeout: 300000, polling: 1000 });
  const r = await p.evaluate(() => ({ marcas: window.__marcas, fotos: window.__fotosIntro, rot: document.documentElement.classList.contains('rot') }));
  for (const [t, u] of r.fotos) fs.writeFileSync(dir + '/' + nom + '_' + t + '.jpg', Buffer.from(u.split(',')[1], 'base64'));
  console.log(nom, 'girada:', r.rot, '· marcas (s desde que empezó la intro):', JSON.stringify(r.marcas), '· fotos:', r.fotos.map((f) => f[0]).join(' '));
  await p.waitForTimeout(1500); await p.screenshot({ path: dir + '/' + nom + '_menu.png' });
  console.log(nom, err.join('\n') || 'sin errores'); await c.close();
}
await b.close(); srv.close();
