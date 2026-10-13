// Recorre: titulo -> intro (5 piedras) -> Rocky Plateau hasta terminar -> menu -> primer lugar nuevo.
// Uso: node recorrido.mjs URL PREFIJO_FOTOS
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [url, pre] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(url);
await p.waitForFunction(() => window.prueba && window.prueba.listo, null, { timeout: 60000 });
const toque = (x, y) => p.evaluate(([x, y]) => Juego.escena.toque && Juego.escena.toque(x, y), [x, y]);
const nombre = () => p.evaluate(() => Juego.escena === null ? '' : (window.prueba.partida && Juego.escena.paso.toString().includes('Partida') ? 'partida' : ''));
await p.waitForTimeout(3000); await toque(0, 0);
await p.waitForTimeout(6000);
await p.screenshot({ path: pre + '1.png' });
// intro: esperar el boton y tocarlo 5 veces
await p.waitForTimeout(13000);
for (let i = 0; i < 5; i++) { await p.evaluate(() => { const P = Pantalla; Juego.escena.toque(P.cols >> 1, 16); }); await p.waitForTimeout(150); }
await p.screenshot({ path: pre + '2.png' });
await p.waitForTimeout(3000);
// partida: acelerar
const pasos = async (n) => p.evaluate((n) => { for (let i = 0; i < n; i++) Juego.escena.paso(); }, n);
for (let i = 0; i < 40; i++) {
  await pasos(300);
  const e = await p.evaluate(() => { const L = prueba.partida; return L && { x: L.heroe.x, sec: L.seccion, hp: L.heroe.hp, fin: L.completo, perd: L.perdido, n: L.personajes.length, rec: L.recursos }; });
  if (i % 5 === 0 || e.fin) console.log(JSON.stringify(e));
  if (i === 3) await p.screenshot({ path: pre + '3.png' });
  if (e.fin || e.perd) break;
}
await pasos(60); await p.waitForTimeout(500);
await p.screenshot({ path: pre + '4.png' });
await toque(1, 1); await p.waitForTimeout(500);
await p.screenshot({ path: pre + '5.png' });
console.log('menu:', await p.evaluate(() => Quests.habilitados().map((q) => q.id).join(',')));
console.log('errores de la página:', errores.length, errores.slice(0, 5).join(' | '));
await b.close();
