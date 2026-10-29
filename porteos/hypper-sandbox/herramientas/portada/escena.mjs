// escena de la portada: el juego con el reloj a mano (cada paso corre exactamente un cuadro de 0,03 s)
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
export async function preparar(html, W, H) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 160)));
  await p.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window); let manual = false, cola = [], t = 0;
    window.__rafN = 0; window.requestAnimationFrame = (cb) => { window.__rafN++; if (manual) { cola.push(cb); return 1; } return raf(cb); };
    window.__manual = () => { manual = true; t = performance.now(); };
    window.__avanzar = (ms) => { t += ms; const c = cola; cola = []; for (const cb of c) cb(t); return c.length; };
    window.__cola = () => cola.length;
    // la imagen del cuadro recién dibujado (antes de que el navegador la componga)
    window.__foto = (q) => { const cv = document.getElementById('cv'), c2 = window.__c2 || (window.__c2 = document.createElement('canvas')); c2.width = cv.width; c2.height = cv.height; c2.getContext('2d').drawImage(cv, 0, 0); return c2.toDataURL('image/jpeg', q); };
  });
  await p.goto('file://' + html + '?gfx=ultra&sinred=1');
  await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; PREFS.gfx = 'ultra'; PREFS.res = 100; PREFS.lejos = 1100; PREFS.mods = { goku: true, radio: true, piano: true }; PREFS.modFuerza = {}; PREFS.skin = 'Hero';
    inicioMostrar(true); RB.mapaPartida = OFICIALES_MAPAS[0]; RB.mapaCom = 'megarampa'; RB.horaPartida = 'normal'; inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForTimeout(6000);
  // reloj a mano: cada paso corre exactamente un cuadro de 1/30 s (espera a que el juego pida el siguiente)
  const manual = async () => { await p.evaluate(() => window.__manual()); await p.waitForFunction(() => window.__cola() > 0, null, { timeout: 60000, polling: 50 }); };
  const paso = async (n) => { for (let i = 0; i < (n || 1); i++) { let r = await p.evaluate(() => window.__avanzar(30)); while (!r) { await p.waitForTimeout(20); r = await p.evaluate(() => window.__avanzar(30)); } } };
  const pasoFoto = async () => { for (;;) { const r = await p.evaluate(() => (window.__avanzar(30) ? window.__foto(0.96) : null)); if (r) return Buffer.from(r.split(',')[1], 'base64'); await p.waitForTimeout(20); } };
  return { b, p, ev, err, manual, paso, pasoFoto };
}
