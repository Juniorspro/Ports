// La intro de JXStudios de la 3.0 (pedido: «una mejor intro… minimalista, goty, rápido, bien»). Con números:
//  1. arranca enseguida: con el HTML bajando a 3 MB/s, el primer cuadro de la intro antes de 0,5 s (la intro va antes de
//     las fotos de la pantalla de carga) y con la letra del menú (Oswald) ya cargada;
//  2. corta: termina (I.fin) entre 1,5 y 1,9 s después de su primer cuadro;
//  3. si el juego ya cargó, el menú queda a ≤ 2,5 s del primer cuadro de la intro (la carga se va junto con ella) y la
//     pantalla de carga no se asoma en el medio (su contenido escondido mientras se funde);
//  4. se saltea: una tecla (compu) o un toque (celular) la terminan en ≤ 100 ms y se va del todo en ≤ 0,4 s;
//  5. liviana y suave aunque el juego esté compilando: sin video, imágenes ni lienzos, y todo lo que se mueve son
//     animaciones de transform y opacity (las dibuja el compositor: 0 ms de JavaScript por cuadro);
//  6. en 7 pantallas (compu 1920×1080 y 1366×768, tablet, celulares apaisados 873×393, 800×368 y 640×360 y el celular
//     parado 393×873, donde el juego se gira 90°) la marca entra entera, centrada (±2 px), con ≥ 8 % de aire a cada lado,
//     «JX» adentro de la placa y STUDIOS sin letras pisadas; la placa ≥ 30 px y las letras de STUDIOS ≥ 9 px; con el
//     celular parado, derecha dentro del juego girado;
//  7. con «reducir movimiento» del sistema, la versión quieta (≤ 1,3 s); sin errores de JS.
// uso: node intro_jx.mjs JXMod.html [CARPETA_FOTOS]   (fotos: los cuadros de la intro, congelados en tiempos exactos, en
// la compu, el celular chico y el parado)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import http from 'http'; import fs from 'fs';
const [, , HTML, DIR = '.'] = process.argv; fs.mkdirSync(DIR, { recursive: true });
const datos = fs.readFileSync(HTML); let VEL = 0;
const srv = http.createServer((q, r) => {
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': datos.length });
  if (!VEL) { r.end(datos); return; }
  let i = 0; const paso = () => { if (i >= datos.length || r.destroyed) { r.end(); return; } const n = Math.min(datos.length - i, VEL / 20); r.write(datos.subarray(i, i + n)); i += n; setTimeout(paso, 50); }; paso();
});
srv.on('clientError', () => {});
await new Promise((ok) => srv.listen(8934, '127.0.0.1', ok));
const URL = 'http://127.0.0.1:8934/j.html?sinred=1';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 1600)); return ok; };
const errJS = [];
// dentro de la página: cuándo arranca la intro, cuándo termina y la pantalla de carga mientras se va
const MIRAR = () => {
  window.__m = { vis: [] };
  const mirar = () => {
    const el = document.getElementById('intro'), I = window.__intro, M = window.__m;
    if (el && I && I.t0 && M.fuente == null) M.fuente = document.fonts.check("600 20px 'JX Oswald'") && document.fonts.check("300 20px 'JX Oswald'");
    if (I && I.t0) {
      const t = (performance.now() - I.t0) / 1000, c = document.getElementById('carga'), a = c && c.querySelector('.cgArriba');
      if (I.fin && M.fin == null) M.fin = +t.toFixed(3);
      if (c.classList.contains('salir') && M.salir == null) M.salir = +t.toFixed(3);
      if (M.salir != null && !c.classList.contains('oc')) M.vis.push([+t.toFixed(2), getComputedStyle(a).visibility, +getComputedStyle(el).opacity, +getComputedStyle(c).opacity]);
      if (c.classList.contains('oc') && M.oc == null) M.oc = +t.toFixed(3);
      if (M.oc != null && M.fin != null) return;
    }
    requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
};
async function pagina(opts, vel) {
  VEL = vel || 0;
  const c = await b.newContext(opts), p = await c.newPage(); p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
  await c.addInitScript(MIRAR);
  p.goto(URL).catch(() => {});
  await p.waitForFunction(() => window.__intro && window.__intro.t0, null, { timeout: 60000, polling: 10 });
  return { c, p };
}
// congelar la intro en un tiempo exacto (y que no termine sola ni la cierre el juego mientras tanto)
const CONGELAR = (t) => { const el = document.getElementById('intro'); window.__intro.fin = true; if (window.__carga) window.__carga.fin = () => {};
  for (const a of el.getAnimations({ subtree: true })) { a.pause(); a.currentTime = t * 1000; } };

// --- 1 y 2: el arranque con el HTML bajando a 3 MB/s; la duración, a 1 MB/s (sin el juego compilando en el hilo principal:
// las animaciones las sigue dibujando el compositor, pero el aviso de que terminó lo da el JavaScript y llega tarde si la
// compu está ocupada; eso se informa aparte)
const dur = {};
for (const vel of [3e6, 1e6]) {
  const { c, p } = await pagina({ viewport: { width: 1366, height: 768 } }, vel);
  await p.waitForFunction(() => window.__m.fin != null, null, { timeout: 30000, polling: 50 });
  dur[vel] = await p.evaluate(() => ({ m: window.__m, I: { inicio: window.__intro.inicio, tFin: window.__intro.tFin, dur: window.__intro.dur } }));
  await c.close();
}
caso('1. arranca enseguida (HTML a 3 MB/s): primer cuadro < 0,5 s, con Oswald cargada', dur[3e6].I.inicio < 0.5 && dur[3e6].m.fuente, { inicio_s: dur[3e6].I.inicio, fuente: dur[3e6].m.fuente });
caso('2. corta: termina entre 1,5 y 1,9 s después de su primer cuadro', dur[1e6].m.fin >= 1.5 && dur[1e6].m.fin <= 1.9, { fin_s: dur[1e6].m.fin, dur: dur[1e6].I.dur, aviso_con_el_juego_compilando_3MBs: dur[3e6].m.fin });
// --- 3: el juego ya cargado (se simula llamando a la carga como lo hace el juego al terminar, a los 0,3 s). Con el HTML a
// 1 MB/s: el código del juego (4 MB) todavía no llegó y no ocupa el hilo principal (con el juego cargado de verdad, al
// terminar la intro ya está libre); si no, se mediría cuánto tarda esta compu en compilarlo
{
  const { c, p } = await pagina({ viewport: { width: 1366, height: 768 } }, 1e6);
  await p.waitForFunction(() => window.__carga && (performance.now() - window.__intro.t0) > 300, null, { polling: 10 });
  const tCb = await p.evaluate(() => +((performance.now() - window.__intro.t0) / 1000).toFixed(3));
  await p.evaluate(() => window.__carga.fin(() => { window.__m.cb = +((performance.now() - window.__intro.t0) / 1000).toFixed(3); }));
  await p.waitForFunction(() => window.__m.oc != null, null, { timeout: 15000, polling: 50 });
  const m = await p.evaluate(() => window.__m), asoma = m.vis.filter((v) => v[1] !== 'hidden' && v[3] > 0.02);
  caso('3. con el juego cargado, el menú a ≤ 2,5 s del primer cuadro y sin que se asome la carga', m.oc <= 2.5 && !asoma.length && m.cb != null, { listoA: tCb, fin: m.fin, menuCb: m.cb, salir: m.salir, cargaFuera: m.oc, muestras: m.vis.length, asoma: asoma.slice(0, 3) });
  await c.close();
}
// --- 4: saltear con una tecla (compu) y con un toque (celular)
const saltos = {};
for (const [nom, opts] of [['tecla', { viewport: { width: 1366, height: 768 } }], ['toque', { viewport: { width: 873, height: 393 }, isMobile: true, hasTouch: true }]]) {
  const { c, p } = await pagina(opts, 1e6);
  await p.waitForFunction(() => (performance.now() - window.__intro.t0) > 500, null, { polling: 10 });
  const t1 = await p.evaluate(() => performance.now());
  if (nom === 'tecla') await p.keyboard.press('KeyA'); else await p.touchscreen.tap(400, 200);
  await p.waitForFunction(() => window.__intro.fin, null, { timeout: 5000, polling: 5 });
  const t2 = await p.evaluate(() => performance.now()), salto = await p.evaluate(() => window.__intro.salto);
  await p.waitForTimeout(400); const op = await p.evaluate(() => { const e = document.getElementById('intro'); return getComputedStyle(e).display === 'none' ? 0 : +getComputedStyle(e).opacity; });
  saltos[nom] = { ms: Math.round(t2 - t1), como: salto, opacidad_04s: op };
  await c.close();
}
caso('4. se saltea con una tecla y con un toque (≤ 100 ms) y se va del todo en ≤ 0,4 s', Object.entries(saltos).every(([k, s]) => s.como === k && s.ms <= 100 && s.opacidad_04s === 0), saltos);
// --- 5, 6 y las fotos: la marca en 7 pantallas, congelada ya armada (1,2 s); los cuadros en 3 de ellas
const PANT = [['pc1080', 1920, 1080, false], ['pc', 1366, 768, false], ['tablet', 1180, 820, true], ['celu', 873, 393, true], ['celu_u', 800, 368, true], ['celu_ch', 640, 360, true], ['parado', 393, 873, true]];
const CUADROS = [0.06, 0.12, 0.18, 0.26, 0.36, 0.46, 0.56, 0.66, 0.78, 0.95, 1.2, 1.42, 1.52, 1.62];
const lug = []; let props = null;
for (const [nom, w, h, movil] of PANT) {
  const { c, p } = await pagina({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: movil, hasTouch: movil }, 0);
  if (!props) props = await p.evaluate(() => { const el = document.getElementById('intro'), s = new Set(); for (const a of el.getAnimations({ subtree: true })) for (const k of a.effect.getKeyframes()) for (const q of Object.keys(k)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(q)) s.add(q);
    return { props: [...s], n: el.getAnimations({ subtree: true }).length, medios: el.querySelectorAll('img,video,canvas,svg').length }; });
  await p.evaluate(CONGELAR, 1.2); await p.waitForTimeout(120);
  const r = await p.evaluate(() => {
    const el = document.getElementById('intro'), rot = document.documentElement.classList.contains('rot'), PW = innerWidth;
    // (con el juego girado, los rectángulos de la página pasan al marco del juego: x = Y de la página, y = ancho − X)
    const loc = (q) => (rot ? { x0: q.top, x1: q.bottom, y0: PW - q.right, y1: PW - q.left } : { x0: q.left, x1: q.right, y0: q.top, y1: q.bottom });
    const R = (e) => loc(e.getBoundingClientRect()), rg = document.createRange(); rg.selectNodeContents(el.querySelector('.inPlaca b'));
    const placa = R(el.querySelector('.inPlaca')), jx = loc(rg.getBoundingClientRect()), letras = [...el.querySelectorAll('.inLetras i')].map(R), todo = R(el);
    return { rot, W: todo.x1 - todo.x0, H: todo.y1 - todo.y0, o: [todo.x0, todo.y0], placa, jx, letras, fL: parseFloat(getComputedStyle(el.querySelector('.inLetras')).fontSize) };
  });
  const sx = (v) => v - r.o[0], sy = (v) => v - r.o[1], x0 = sx(r.placa.x0), x1 = sx(r.letras[6].x1), y0 = sy(Math.min(r.placa.y0, ...r.letras.map((l) => l.y0))), y1 = sy(Math.max(r.placa.y1, ...r.letras.map((l) => l.y1)));
  const aireX = Math.min(x0, r.W - x1) / r.W, aireY = Math.min(y0, r.H - y1) / r.H, centro = Math.abs((x0 + x1) / 2 - r.W / 2), S = r.placa.x1 - r.placa.x0;
  const jxDentro = r.jx.x0 >= r.placa.x0 && r.jx.x1 <= r.placa.x1, pisadas = r.letras.slice(1).filter((l, i) => l.x0 < r.letras[i].x1 - 0.5).length;
  const ok = aireX >= 0.08 && aireY >= 0.08 && centro <= 2 && S >= 30 && r.fL >= 9 && jxDentro && !pisadas && (nom !== 'parado' || (r.rot && r.W > r.H));
  lug.push({ nom, ok, aireX: +aireX.toFixed(3), aireY: +aireY.toFixed(3), centro: +centro.toFixed(1), placa: +S.toFixed(1), letra: r.fL, jxDentro, pisadas, rot: r.rot, juego: Math.round(r.W) + '×' + Math.round(r.H) });
  if (['pc', 'celu_ch', 'parado'].includes(nom)) for (const t of CUADROS) { await p.evaluate(CONGELAR, t); await p.waitForTimeout(60); await p.screenshot({ path: `${DIR}/intro_${nom}_${t.toFixed(2)}.png` }); }
  else await p.screenshot({ path: `${DIR}/marca_${nom}.png` });
  await c.close();
}
caso('5. sin video, imágenes ni lienzos; sólo animaciones de transform y opacity (0 ms de JS por cuadro)', props && props.n >= 7 && !props.medios && props.props.every((q) => q === 'transform' || q === 'opacity'), props);
caso('6. en 7 pantallas: entera, centrada, ≥ 8 % de aire, JX en la placa, letras sin pisarse, placa ≥ 30 px, letras ≥ 9 px; parado: derecha', lug.every((l) => l.ok), lug);
// --- 7: reducir movimiento
{
  const { c, p } = await pagina({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' }, 1e6);
  await p.waitForFunction(() => window.__m.fin != null, null, { timeout: 15000, polling: 20 });
  const r = await p.evaluate(() => ({ quieta: window.__intro.quieta, fin: window.__m.fin }));
  const e2 = errJS.filter((e) => !/WebSocket|net::|Failed to (load|fetch)|NetworkError/i.test(e));
  caso('7. con «reducir movimiento», la versión quieta (≤ 1,3 s); sin errores de JS', r.quieta && r.fin <= 1.3 && !e2.length, { ...r, err: e2.slice(0, 3) });
  await c.close();
}
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close(); srv.close(); process.exit(RES.every(Boolean) ? 0 : 1);
