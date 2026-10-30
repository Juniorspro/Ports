// celular parado (360x800): ¿se gira todo? la pantalla de carga mientras baja, el inicio, los menús, el juego y la pausa
// node parado.mjs Hypper.html carpeta
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [,, html, dir] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const c = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await c.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message));
const rot = () => p.evaluate(() => document.documentElement.classList.contains('rot'));
p.goto('file://' + html + '?sinred=1&gpu=' + encodeURIComponent('Adreno (TM) 610')).catch(() => {});
for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => !!document.getElementById('carga')).catch(() => false)) break; }
await p.waitForTimeout(1200); await p.screenshot({ path: dir + '/0_carga.png' }); console.log('carga: girada?', await rot());
await p.waitForFunction(() => window.__listo, null, { timeout: 240000 }); await p.waitForTimeout(2500);
const ev = (s) => p.evaluate((s) => window.__ev(s), s);
await p.screenshot({ path: dir + '/1_bienvenida.png' }); console.log('inicio: girada?', await rot());
await p.evaluate(() => document.querySelector('[data-rb="bienvOK"]').click()); await p.waitForTimeout(600);
await p.screenshot({ path: dir + '/2_menu.png' });
for (const [k, n] of [['multi', '3_multi'], ['tienda', '4_tienda']]) {
  await p.evaluate((k) => { const e = document.querySelector('[data-rb="' + k + '"]'); if (e) e.click(); }, k); await p.waitForTimeout(900);
  await p.screenshot({ path: dir + '/' + n + '.png' });
  await p.evaluate(() => { const e = document.querySelector('[data-rb="volver"]'); if (e) e.click(); }); await p.waitForTimeout(500);
}
await p.evaluate(() => document.querySelector('[data-rb="nueva"]').click()); await p.waitForTimeout(700);
await p.screenshot({ path: dir + '/5_nueva.png' });
await p.evaluate(() => document.querySelector('[data-rb="empezar"]').click()); await p.waitForTimeout(5000);
await p.screenshot({ path: dir + '/6_juego.png' });
console.log('juego', await ev('JSON.stringify({ e: JUEGO.estado, rot: PANT.rot, vw: VW(), vh: VH(), cv: [R.cv.width, R.cv.height] })'));
await ev('abrirPausa()'); await p.waitForTimeout(700); await p.screenshot({ path: dir + '/7_pausa.png' });
console.log(err.join('\n') || 'sin errores'); await b.close();
