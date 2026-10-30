// arranque común de las pruebas en un navegador: abre el HTML, espera que cargue y devuelve ayudas
// (node con NODE_PATH apuntando a playwright; CHROMIUM = navegador a usar)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
// (antes: algo para hacer con la página antes de cargarla, p. ej. scripts de inicio)
export async function abrir(html, celu, extra, antes) {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio', ...(extra || [])] });
  const ctx = await b.newContext(celu ? { viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => err.push(e.message.slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') err.push(m.type() + ': ' + m.text().slice(0, 200)); });
  if (antes) await antes(p);
  await p.goto(/^https?:/.test(html) ? html : 'file://' + html);
  await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await p.waitForTimeout(1500);
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  return { b, ctx, p, err, ev };
}
