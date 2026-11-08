// node intro.mjs JXMod.html carpeta — la intro de JXStudios (fotos de la pantalla con el tiempo real de la página) mientras el HTML baja lento,
// en la compu y en el celular parado; y cuándo se va la pantalla de carga
// node intro2.mjs JXMod.html carpeta
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
  // dentro de la página: cuándo empezó la intro (su primer cuadro), cuándo terminó, cuándo se fue la carga y cuándo estuvo
  // el juego (la intro de la 3.0 es de CSS, no un lienzo: las fotos son de la pantalla, a los 0,2 / 0,5 / 0,8 / 1,2 / 1,6 s)
  await c.addInitScript(() => {
    window.__marcas = {};
    const mirar = () => { const I = window.__intro, M = window.__marcas; if (!I || !I.t0) return requestAnimationFrame(mirar);
      const t = (performance.now() - I.t0) / 1000; M.t0 = M.t0 || +(I.t0 / 1000).toFixed(2);
      if (I.fin && !M.fin) M.fin = +t.toFixed(2);
      const ca = document.getElementById('carga'); if (ca && ca.classList.contains('oc') && !M.cargaFuera) M.cargaFuera = +t.toFixed(2);
      if (window.__listo && !M.listo) M.listo = +t.toFixed(2);
      if (!M.cargaFuera) requestAnimationFrame(mirar); };
    requestAnimationFrame(mirar);
  });
  p.goto('http://127.0.0.1:8932/j.html?sinred=1').catch(() => {});
  await p.waitForFunction(() => window.__intro && window.__intro.t0, null, { timeout: 120000, polling: 20 });
  const fotos = [];
  for (const q of [0.2, 0.5, 0.8, 1.2, 1.6]) {
    await p.waitForFunction((q) => (performance.now() - window.__intro.t0) / 1000 >= q || window.__intro.fin, q, { polling: 10 });
    const t = await p.evaluate(() => +((performance.now() - window.__intro.t0) / 1000).toFixed(2)); if (await p.evaluate(() => window.__intro.fin)) break;
    await p.screenshot({ path: dir + '/' + nom + '_' + t + '.jpg', quality: 80 }); fotos.push(t);
  }
  await p.waitForFunction(() => window.__marcas && window.__marcas.cargaFuera, null, { timeout: 300000, polling: 1000 });
  const r = await p.evaluate(() => ({ marcas: window.__marcas, rot: document.documentElement.classList.contains('rot') }));
  r.fotos = fotos;
  console.log(nom, 'girada:', r.rot, '· marcas (s desde que empezó la intro):', JSON.stringify(r.marcas), '· fotos:', r.fotos.join(' '));
  await p.waitForTimeout(1500); await p.screenshot({ path: dir + '/' + nom + '_menu.png' });
  console.log(nom, err.join('\n') || 'sin errores'); await c.close();
}
await b.close(); srv.close();
