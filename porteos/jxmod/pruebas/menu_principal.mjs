// El menú principal sin amontonar (captura del usuario en un celular apaisado de ~800×368: «Salir» quedaba debajo de los
// botones de abajo y todo muy junto). En 5 pantallas (ese celular, uno chico 640×360, uno común 873×393, una tablet
// 1180×820 y la compu 1366×768):
//  1. ningún botón del menú se pisa con el logo, con los botones de abajo ni con la versión (con 8 px de aire) y todos
//     se ven enteros adentro de la pantalla;
//  2. las letras del menú miden al menos 14 px y los botones de abajo entran en el ancho;
//  3. en la compu las letras quedan casi del tamaño del diseño (≥ 90 %: ya ahí «Salir» tocaba los chips) y sin deslizar;
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
    const el = RB.el, r = (e) => { const q = e.getBoundingClientRect(); return { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom }; };
    const items = [...el.querySelectorAll('.rbLista .rbIt')].map((e) => ({ t: e.textContent.trim(), ...r(e), f: parseFloat(getComputedStyle(e).fontSize) }));
    const logo = r(el.querySelector('.rbLogo')), chips = [...el.querySelectorAll('.rbAbajo .rbChipG')].map(r), ver = r(el.querySelector('.rbVer'));
    const pisa = (a, b, m) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
    const L = el.querySelector('.rbLista'), lr = r(L), desliza = L.classList.contains('rbDesliza');
    const probs = [];
    for (const it of items) {
      if (pisa(it, logo, 8)) probs.push(it.t + ' × logo');
      for (const c of chips) if (pisa(it, c, 8)) probs.push(it.t + ' × chip');
      if (pisa(it, ver, 8)) probs.push(it.t + ' × versión');
      if (!desliza && (it.y0 < 0 || it.y1 > innerHeight || it.x1 > innerWidth)) probs.push(it.t + ' afuera');
      if (desliza && (it.y0 < lr.y0 - 1 || it.y1 > lr.y1 + 1)) probs.push(it.t + ' tapado en la lista');
    }
    for (const c of chips) if (c.x1 > innerWidth + 1 || c.x0 < -1) probs.push('chip afuera');
    for (const c of chips) if (pisa(c, ver, 4)) probs.push('chip × versión');
    const ys = items.map((i) => i.y0);
    return { W: innerWidth, H: innerHeight, k: +getComputedStyle(el).getPropertyValue('--rbK') || 1, fMin: Math.min(...items.map((i) => i.f)), desliza, n: items.length, probs,
      aireArriba: +(items[0].y0 - logo.y1).toFixed(1), aireAbajo: +(Math.min(...chips.map((c) => c.y0)) - items[items.length - 1].y1).toFixed(1), salir: items.find((i) => /Salir/.test(i.t)) };
  })()`);
  await p.screenshot({ path: D + 'menu_' + nom + '.png' });
  await ctx.close();
}
const R = Object.entries(M);
caso('1. nada se pisa (con 8 px de aire) y todo se ve entero, en las 5 pantallas', R.every(([, m]) => !m.probs.length && m.n === 8), R.map(([k, m]) => ({ k, probs: m.probs, aireArriba: m.aireArriba, aireAbajo: m.aireAbajo, desliza: m.desliza })));
caso('2. letras del menú de al menos 14 px', R.every(([, m]) => m.fMin >= 14), R.map(([k, m]) => ({ k, fMin: +m.fMin.toFixed(1), k2: m.k })));
caso('3. en la compu casi del tamaño del diseño (≥ 90 %) y sin deslizar', M.compu && M.compu.k >= 0.9 && !M.compu.desliza, M.compu && { k: M.compu.k, fMin: M.compu.fMin });
const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError/i.test(e));
caso('4. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); process.exit(RES.every(Boolean) ? 0 : 1);
