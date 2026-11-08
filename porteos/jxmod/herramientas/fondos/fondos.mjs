// Saca las fotos de fondo del menú principal y de la pantalla de carga desde el juego (escenas.mjs), con el motor
// foto_motor.js: el juego en Ultra, el tiempo cuadro a cuadro y 8 pasadas por foto para suavizar los bordes.
// uso: node fondos.mjs URL_HTML CARPETA [--solo nombre1,nombre2] [--n 8] [--W 1280 --H 720]
// Deja <CARPETA>/<nombre>.png y <CARPETA>/<nombre>.json (lo medido: dónde quedó la grieta y cada cosa que cae).
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path';
import { ESCENAS } from './escenas.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2), HTML = args[0], OUT = args[1];
const op = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const W = +op('W', 1280), H = +op('H', 720), N = +op('n', 8), solo = op('solo', '');
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push(e.message.slice(0, 300)));
await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.contorno = false; idiomaAplicar('es'); PREFS.gfx = 'ultra'; PREFS.res = 100; PREFS.sombras = '3'; PREFS.post = 'si'; PREFS.resDin = false; PREFS.evento = true; GFX.auto = false; aplicarGfx(); inicioMostrar(false); 1`);
console.log('motor', await ev(fs.readFileSync(path.join(AQUI, 'foto_motor.js'), 'utf8')));
const lista = ESCENAS.filter((S) => !solo || solo.split(',').some((k) => S.nombre.includes(k)));
for (const S of lista) {
  const t0 = Date.now();
  await ev(`(() => { FOTO.limpiar(); DBG.cam = null; FOTO.andar(); empezarPartida(${JSON.stringify(S.mapa)}); if (typeof cuDialogoCerrar === 'function') cuDialogoCerrar(); return 1; })()`);
  try { await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego' && !!JUG.suelo`), S.mapa, { timeout: 180000, polling: 500 }); }
  catch (e) { console.log(S.nombre, 'el mapa no cargó'); continue; }
  await espera(2500);
  await ev(`(() => { FOTO.parar(); if (typeof ahorroFijar === 'function') ahorroFijar(0); return 1; })()`);
  const arm = await ev(`FOTO.armar(${JSON.stringify(S)})`);
  // (la primera vez que se ve cada cosa, el navegador decodifica sus texturas: unos cuadros con pausas)
  for (let k = 0; k < 3; k++) { await ev(`(() => { FOTO.paso(1 / 60, true); return 1; })()`); await espera(500); }
  await ev(`FOTO.avanzar(${arm.tau} - 3 / 60)`);
  for (let k = 0; k < 4; k++) { await ev(`(() => { FOTO.paso(0, true); return 1; })()`); await espera(k < 2 ? 600 : 250); }
  const png = await ev(`FOTO.foto(${N})`);
  fs.writeFileSync(path.join(OUT, S.nombre + '.png'), Buffer.from(png.split(',')[1], 'base64'));
  const med = await ev(`FOTO.medir()`);
  fs.writeFileSync(path.join(OUT, S.nombre + '.json'), JSON.stringify({ arm, med }, null, 1));
  console.log(S.nombre, ((Date.now() - t0) / 1000).toFixed(0) + ' s', JSON.stringify({ arm, grieta: med.grieta, caidas: med.caidas.map((c) => [c.n, c.est, c.s, c.px]), gente: med.gente.map((g) => [g.n, g.s, g.alto]) }));
}
await ev(`FOTO.sinSemilla(); 1`);
console.log('errores', JSON.stringify(err.slice(0, 6)));
await b.close();
