// El menú principal sin amontonar (captura del usuario en un celular apaisado de ~800×368: «Salir» quedaba debajo de los
// botones de abajo y todo muy junto). Ahora el menú principal es la portada (juego/portada.js): las mismas
// exigencias, medidas sobre sus bloques (arriba: el perfil, el logo y los íconos; a la izquierda las tarjetas; a la derecha
// los accesos chicos; abajo las pestañas con la versión; abajo a la derecha el mapa elegido y JUGAR). En 5 pantallas (ese
// celular, uno chico 640×360, uno común 873×393, una tablet 1180×820 y la compu 1366×768):
//  1. ningún bloque se pisa con otro (con 8 px de aire), ningún botón se pisa con otro y todo se ve entero adentro de la
//     pantalla (antes: la lista con el logo, los botones de abajo y la versión);
//  2. las letras del menú miden al menos 14 px (los títulos de las tarjetas, las pestañas, JUGAR y el mapa elegido; antes,
//     las 8 placas de la lista);
//  3. en la compu todo queda del tamaño del diseño: sin ninguno de los pasos para achicar (ni letras achicadas, ni el logo
//     escondido, ni las pestañas apretadas) —antes: la lista al ≥ 90 % y sin deslizar—;
//  4. sin errores de JS.
// uso: node menu_principal.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, DIR = '.'] = process.argv, D = DIR + '/';
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 900)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const PANT = [['celu_usuario', 800, 368, true], ['celu_chico', 640, 360, true], ['celu', 873, 393, true], ['tablet', 1180, 820, true], ['compu', 1366, 768, false]];
const errJS = [], M = {};
for (const [nom, w, h, movil] of PANT) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: movil, hasTouch: movil, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(nom + ': ' + e.message.slice(0, 200)));
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await p.goto(HTML + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.nombre = 'NijulaX'; idiomaAplicar('es'); guardarPrefs(); inicioMostrar(true); 1`);
  await p.waitForTimeout(1500);
  M[nom] = await ev(`(() => {
    const U = PTD.ui, r = (e) => { const q = e.getBoundingClientRect(); return { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom }; };
    const vis = (e) => e && e.offsetWidth > 0 && !e.closest('.oc') && getComputedStyle(e).visibility !== 'hidden';
    const une = (L) => L.filter(vis).map(r).reduce((a, q) => ({ x0: Math.min(a.x0, q.x0), y0: Math.min(a.y0, q.y0), x1: Math.max(a.x1, q.x1), y1: Math.max(a.y1, q.y1) }));
    const B = { arriba: une([U.querySelector('.ptArriba')]), izquierda: une([U.querySelector('.ptIzq')]), derecha: une([...U.querySelectorAll('.ptCol .ptMini')]),
      abajo: une([U.querySelector('.ptTabs'), U.querySelector('.ptVer')]), jugar: une([U.querySelector('.ptCartel'), U.querySelector('.ptModo'), U.querySelector('.ptJugar')]) };
    const pisa = (a, b, m) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
    const probs = [], K = Object.keys(B);
    for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) if (pisa(B[K[i]], B[K[j]], 8)) probs.push(K[i] + ' × ' + K[j]);
    const bt = [...U.querySelectorAll('button')].filter(vis).map((e) => ({ k: e.dataset.rb, ...r(e) }));
    for (let i = 0; i < bt.length; i++) for (let j = i + 1; j < bt.length; j++) if (pisa(bt[i], bt[j], -1)) probs.push(bt[i].k + ' × ' + bt[j].k);
    for (const e of bt) if (e.x0 < 0 || e.y0 < 0 || e.x1 > innerWidth || e.y1 > innerHeight) probs.push(e.k + ' afuera');
    const letras = [...U.querySelectorAll('.ptCT, .ptTabT, .ptJugarT, .ptModoN, #rbNombre')].filter(vis).map((e) => ({ t: (e.textContent || e.value).trim(), f: parseFloat(getComputedStyle(e).fontSize) }));
    const pasos = ['ptSinLogo', 'ptCuC', 'ptCol2', 'ptTabsC', 'ptTabsC2', 'ptMultiW'].filter((c) => U.classList.contains(c))
      .concat([...U.querySelectorAll('.ptSinSub, .ptSwC, .ptModoC, .ptModoC2')].map((e) => e.className)).concat([...U.querySelectorAll('.ptFit')].filter((e) => e.style.fontSize).map((e) => 'achicado: ' + e.textContent.trim()));
    return { W: innerWidth, H: innerHeight, probs, fMin: Math.min(...letras.map((x) => x.f)), chicas: letras.filter((x) => x.f < 14), pasos, n: bt.length };
  })()`);
  await p.screenshot({ path: D + 'menu_' + nom + '.png' });
  await ctx.close();
}
const R = Object.entries(M);
caso('1. nada se pisa (los bloques con 8 px de aire) y todo se ve entero, en las 5 pantallas', R.every(([, m]) => !m.probs.length && m.n >= 20), R.map(([k, m]) => ({ k, probs: m.probs, n: m.n })));
caso('2. letras del menú de al menos 14 px', R.every(([, m]) => m.fMin >= 14), R.map(([k, m]) => ({ k, fMin: +m.fMin.toFixed(1), chicas: m.chicas })));
caso('3. en la compu, del tamaño del diseño (sin ningún paso para achicar)', M.compu && !M.compu.pasos.length, M.compu && M.compu.pasos);
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError/i.test(e));
caso('4. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
