// el tráiler del juego (45 s a 60 cuadros por segundo, 1920 × 1080): el juego se graba cuadro por cuadro —el tiempo del
// juego avanza 1/60 s por cuadro, así sale parejo aunque la placa de prueba sea lenta— con los títulos encima (HTML, con
// la letra y el estilo del juego) y sin los botones. Cada escena se graba aparte (sus cuadros van numerados en el tiempo
// del tráiler) y herramientas/trailer_montar.py los junta con la música.
// uso: node trailer.mjs URL_HTML CARPETA escena[,escena...] [cada=1]   (cada=N: uno de cada N cuadros, para probar)
// (ritmo: la escena puede pedir cámara lenta —el tiempo del juego avanza menos por cuadro—)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs';
import { ESCENAS, FPS } from './trailer_escenas.mjs';
const [, , HTML, D = '/tmp/claude-0/trailer/fr', LISTA = '', CADA = '1'] = process.argv; fs.mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
await p.goto(HTML); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 }); await p.waitForTimeout(1500);
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
// lo de siempre: sin botones (quedan el lienzo, los nombres de los jugadores y los títulos)
await ev(`(() => { PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.resDin = false; const pf = PERFILES[PREFS.gfx]; PREFS.res = ${+(process.env.RES || 67)}; PREFS.lejos = pf.lejos; aplicarGfx();
  const st = document.createElement('style'); st.textContent = \`
    body.trailer > *:not(#cv):not(#hud):not(#trOver):not(script):not(style){visibility:hidden!important}
    body.trailer #hud > *:not(.etiqueta):not(.npcGlobo){visibility:hidden!important} body.trailer #hud{visibility:visible!important}
    body.trailer #hud .etiqueta{font-size:15px}
    #trOver{position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden;font-family:'JX Oswald','Roboto Condensed','Arial Narrow',sans-serif;color:#fff}
    #trOver .trNegro{position:absolute;inset:0;background:#000}
    #trOver .trBlanco{position:absolute;inset:0;background:#fff}
    #trOver .trT{position:absolute;left:6%;bottom:13%;transform-origin:0 100%}
    #trOver .trT b{display:block;font-weight:600;font-size:86px;line-height:.92;letter-spacing:.01em;text-transform:uppercase;transform:skewX(-7deg);text-shadow:0 4px 0 rgba(0,0,0,.55),0 0 30px rgba(0,0,0,.35)}
    #trOver .trT b i{font-style:normal;color:#f2b31b}
    #trOver .trT u{display:block;height:8px;margin-top:14px;background:repeating-linear-gradient(-45deg,#f2b31b 0 12px,transparent 12px 24px);text-decoration:none;transform-origin:0 50%}
    #trOver .trT small{display:inline-block;margin-top:12px;padding:6px 12px;background:#f2b31b;color:#121212;font-weight:600;font-size:26px;letter-spacing:.14em;text-transform:uppercase}
    #trOver .trLogo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;white-space:nowrap}
    #trOver .trLogo .dLogo{justify-content:center}
    #trOver .trLogo .dLogo{font-size:190px;line-height:1}
    #trOver .trLogo p{margin:18px 0 0;font-weight:500;font-size:30px;letter-spacing:.32em;text-transform:uppercase;color:#cfd3dc}
    #trOver .trLogo em{display:inline-block;margin-top:22px;padding:8px 18px;background:#f2b31b;color:#121212;font-style:normal;font-weight:600;font-size:34px;letter-spacing:.12em;text-transform:uppercase}
    #trOver .trCred{position:absolute;left:0;right:0;bottom:4%;text-align:center;font-family:Roboto,Arial,sans-serif;font-size:17px;color:rgba(255,255,255,.62);letter-spacing:.02em}
    #trOver .trBarras:before,#trOver .trBarras:after{content:'';position:absolute;left:0;right:0;height:9%;background:#000}#trOver .trBarras:before{top:0}#trOver .trBarras:after{bottom:0}\`;
  document.head.appendChild(st);
  const o = document.createElement('div'); o.id = 'trOver'; document.body.appendChild(o);
  window.__rafO = window.__rafO || requestAnimationFrame;
  return 1; })()`);
// el reloj del tráiler: el juego quieto (sin su bucle) y un cuadro por paso
const congelar = () => ev(`(() => { window.requestAnimationFrame = () => 0; window.__T = window.__T || performance.now(); return 1; })()`);
const soltar = () => ev(`(() => { window.requestAnimationFrame = window.__rafO; window.__rafO(cuadro); return 1; })()`);
const elegidas = LISTA ? LISTA.split(',') : Object.keys(ESCENAS);
const t00 = Date.now(); let hechos = 0;
for (const nom of elegidas) {
  const E = ESCENAS[nom]; if (!E) { console.log('no hay escena', nom); continue; }
  const t1 = Date.now();
  await soltar();
  await ev(`document.body.classList.add('trailer'); $('trOver').innerHTML = ''; DBG.cam = null; 1`);
  if (E.mapa) { await ev(`(() => { if (MUNDO.nombre !== '${E.mapa}' || JUEGO.estado !== 'juego') { inicioMostrar(false); empezarPartida('${E.mapa}'); } return 1; })()`); await p.waitForFunction((m) => window.__ev(`JUEGO.estado === 'juego' && MUNDO.nombre === '${m}' && !!JUG.suelo`), E.mapa, { timeout: 180000 }); }
  await ev(`(() => { cerrarPaneles(); limpiarTodo && limpiarTodo(); return 1; })()`).catch(() => {});
  if (E.preparar) await ev(`(async () => { ${E.preparar}; return 1; })()`);
  await p.waitForTimeout(E.espera || 2500);
  await congelar();
  if (E.listo) await ev(`(async () => { ${E.listo}; return 1; })()`);
  if (E.listo) console.log(nom, 'listo', await ev(`JSON.stringify({ agarro: window.__agarro })`));
  // (unos cuadros antes, para que lo que recién se puso se acomode: el tiempo del juego corre, no se graban)
  await ev(`(() => { let T = window.__T; for (let i = 0; i < ${E.antes || 30}; i++) { T += 1000 / ${FPS}; ${E.cada ? `window.__tr = { t: ${E.t0} - (${E.antes || 30} - i) / ${FPS}, i: -1 }; ${E.cada};` : ''} cuadro(T); } window.__T = T; return 1; })()`);
  const n0 = Math.round(E.t0 * FPS), n1 = Math.round(E.t1 * FPS);
  for (let n = n0; n < n1; n++) {
    const t = n / FPS, k = (n - n0);
    await ev(`(() => { const t = ${t}, k = ${k}, u = ${(t - E.t0) / (E.t1 - E.t0)}; window.__tr = { t, i: k, u }; window.__T += 1000 / ${FPS}${E.ritmo ? ` * (() => { ${E.ritmo} })()` : ''};
      { ${E.cada || ''}; }
      ${E.cam ? `{ const C = (() => { ${E.cam} })(); if (C) { const pp = v3(C.p[0], C.p[1], C.p[2]), d = vsub(v3(C.m[0], C.m[1], C.m[2]), pp).norm(); DBG.cam = { p: pp, q: Quat.euler(Math.atan2(d.x, d.z), -Math.asin(clamp(d.y, -1, 1)), C.r || 0) }; } }` : ''}
      cuadro(window.__T);
      { ${E.titulos || ''}; }
      return 1; })()`);
    if (k % +CADA !== 0) continue;
    await p.screenshot({ path: `${D}/${String(n).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92, timeout: 180000 });
    hechos++;
  }
  { const d = await ev(`JSON.stringify(window.__dbg || null)`); if (d !== 'null') { console.log(nom, 'dbg', d); await ev(`window.__dbg = null; 1`); } }
  console.log(nom, ((Date.now() - t1) / 1000).toFixed(1) + ' s', n1 - n0, 'cuadros', (((Date.now() - t1) / Math.max(1, (n1 - n0) / +CADA)) | 0) + ' ms c/u');
}
console.log('listo', hechos, 'cuadros en', ((Date.now() - t00) / 1000).toFixed(0), 's; errores', err.slice(0, 4));
await b.close();
