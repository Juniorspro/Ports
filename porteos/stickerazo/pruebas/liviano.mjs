// Celular flojo (2 núcleos, 1 GB, procesador 4 veces más lento): la app entra en modo liviano (sin agua al cambiar de
// pantalla, sin desenfoques de fondo, el editor con menos píxeles), y se mide cuánto tarda en arrancar y cuántas tareas
// largas (más de 50 ms) hay al pasar por las pestañas. Comparado con un celular común, el agua sólo sale al guardar.
// uso: node liviano.mjs
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire('/home/user/Ports/porteos/jxmod/pruebas/x.mjs'); const { chromium } = require('playwright');
const WEB = new URL('../web/', import.meta.url).pathname;
const T = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.wasm': 'application/wasm' };
const srv = http.createServer((q, r) => { const f = path.join(WEB, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8976);
let fallas = 0; const ok = (c, t, d) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function celu(flojo, ctx0) {
  const ctx = ctx0 || await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  if (!ctx0) await ctx.addInitScript((f) => { window.SZ_API = 'http://127.0.0.1:1'; try { localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); } catch (e) { /* nada */ }
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => (f ? 2 : 8) }); Object.defineProperty(navigator, 'deviceMemory', { get: () => (f ? 1 : 8) });
    window.__largas = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__largas.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); }, flojo);
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); if (flojo) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now(); await p.goto('http://127.0.0.1:8976/index.html'); await p.waitForFunction(() => window.__sz); const arranque = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 1500)); await p.evaluate(() => { for (const x of document.querySelectorAll('.musicaEl')) x.remove(); window.__largas.length = 0; });
  // pasar por las pestañas y abrir un pack listo (cambia de pantalla)
  const agua = await p.evaluate(async () => { const espera = (ms) => new Promise((r) => setTimeout(r, ms)); let vio = 0; const c = document.querySelector('#liquido'); const mira = setInterval(() => { if (c && !c.classList.contains('oc')) vio++; }, 30);
    for (const t of ['Listos', 'Mios', 'Perfil', 'Feed']) { window.__sz.pestaña(t); await espera(400); }
    window.__sz.ir('vPack'); await espera(700); window.__sz.ir('vInicio', true); await espera(500); clearInterval(mira); return vio; });
  const r = await p.evaluate(() => ({ liviano: document.documentElement.classList.contains('liviano'), largas: window.__largas.slice(), blur: getComputedStyle(document.querySelector('.tabs')).backdropFilter }));
  await p.close(); if (!ctx0) await ctx.close(); return { arranque, agua, ...r };
}
const comun = await celu(false);
const ctxF = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctxF.addInitScript(() => { window.SZ_API = 'http://127.0.0.1:1'; try { localStorage.setItem('sz_bienvenida', '1'); localStorage.setItem('sz_pais', 'ar'); } catch (e) { /* nada */ }
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }); Object.defineProperty(navigator, 'deviceMemory', { get: () => 1 });
  window.__largas = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__largas.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); });
const flojo = await celu(true, ctxF), flojo2 = await celu(true, ctxF);
ok(!comun.liviano && flojo.liviano, 'un celular con 2 núcleos y 1 GB entra en modo liviano (uno común, no)');
ok(comun.agua === 0 && flojo.agua === 0, 'cambiar de pestaña o de pantalla ya no tapa todo con el agua', { comun: comun.agua, flojo: flojo.agua });
ok(flojo.blur === 'none', 'en modo liviano, sin desenfoque de fondo en la barra de abajo', flojo.blur);
const suma = (l) => l.reduce((a, x) => a + x, 0);
console.log(`      arranque: común ${comun.arranque} ms, flojo ${flojo.arranque} ms · tareas largas al navegar: común ${comun.largas.length} (${suma(comun.largas)} ms), flojo ${flojo.largas.length} (${suma(flojo.largas)} ms)`);
console.log(`      flojo, la segunda vez (miniaturas ya guardadas): ${flojo2.largas.length} tareas largas (${suma(flojo2.largas)} ms)`);
ok(suma(comun.largas) < 300, 'celular común: navegar por las pestañas no traba (las miniaturas se arman cuando se ven, en los ratos libres)', comun.largas);
ok(suma(flojo2.largas) < suma(flojo.largas) && suma(flojo2.largas) < 1200, 'celular flojo (procesador 4 veces más lento): la segunda vez traba menos que la primera y menos de 1,2 s en total (las miniaturas quedan guardadas)', flojo2.largas);
console.log(`RESUMEN ${fallas ? 'con ' + fallas + ' fallas' : 'todo bien'}`); await b.close(); srv.close(); process.exit(0);
