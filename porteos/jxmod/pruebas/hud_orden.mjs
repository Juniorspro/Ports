// Los botones del celular ordenados (pedido: «los botones quiero que los reordenes, está todo junto» y «una IA con mi key
// de Gemini que reordene esto automáticamente»). En un celular emulado, con el Viewfinder (6 teclas fijadas):
//  (desde «Mejores botones», de GOLDEN: en la disposición nueva —«Mejores botones», hud.js— los grupos son columnas: la del sistema en la esquina, la de
//  crear al lado y las teclas; «fila» acá es cada grupo, en el orden de arriba abajo y de izquierda a derecha)
//  1. arriba a la izquierda, tres grupos separados: sistema (pausa primera), crear (props, MOD, GMod) y las teclas del mod,
//     éstas con ícono, nombre y una placa que las agrupa; sin dos teclas que hagan lo mismo;
//  2. en tres pantallas (teléfono 873×393, teléfono chico 640×360, tablet 1180×820): ningún botón (ni su nombre) se pisa
//     con otro, todos adentro de la pantalla, y los de las filas, parejos y sin huecos;
//  3. «Ordenar»: con lo que más se usó, cada fila queda con lo más usado a la izquierda (la pausa sigue primera);
//  4. «Ordenar con IA»: lo que contesta la IA de la tienda (Gemini) se aplica validado (ids conocidos, sin repetir);
//     si la IA contesta cualquier cosa, se ordena por uso y se avisa; «Guardar» lo deja y queda al volver a jugar;
//  5. sin errores de JS.
// uso: node hud_orden.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, CARP, DIR = '.'] = process.argv, D = DIR + '/';
const RES = []; const caso = (n, ok, info) => { RES.push(!!ok); console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 900)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-AR' });
let respIA = null;
await ctx.route('**/ia/hud', (r) => r.fulfill({ status: respIA ? 200 : 502, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(respIA || { error: 'no' }) }));
await ctx.route('https://text.pollinations.ai/**', (r) => r.fulfill({ status: 500, body: 'no' }));
const p = await ctx.newPage(); const errJS = []; p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
await p.goto(HTML + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.hudPos = {}; PREFS.hudUso = {}; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(1500);
await p.touchscreen.tap(430, 200); await p.waitForTimeout(400);
await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/3780178294.gma')).arrayBuffer()); const A = await gmInstalar('3780178294', { nombre: 'Viewfinder', sinDeps: true }, b); await A.listo; return 1; })()`);
await p.waitForTimeout(2500); await ev(`cerrarPaneles && cerrarPaneles(); 1`); await p.waitForTimeout(600);
// lo que se ve de los botones (y de sus nombres) en la pantalla
const medir = () => ev(`(() => {
  const vis = (e) => { if (!e || e.classList.contains('oc')) return false; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
  const L = []; for (const [sel] of HUD_TACTIL) for (const e of document.querySelectorAll(sel)) if (vis(e) && e.closest('#tactil, body')) { const r = e.getBoundingClientRect(); L.push({ sel, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
    const t = e.querySelector('.accTxt'); if (t) { const q = t.getBoundingClientRect(); if (q.width > 0) L.push({ sel: sel + ' (nombre)', de: sel, x0: q.left, y0: q.top, x1: q.right, y1: q.bottom }); } }
  const W = innerWidth, H = innerHeight, pisa = [], fuera = [];
  for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.x0 < -1 || a.y0 < -1 || a.x1 > W + 1 || a.y1 > H + 1) fuera.push(a.sel);
    for (let j = i + 1; j < L.length; j++) { const c = L[j]; if (a.de === c.sel || c.de === a.sel || (a.de && a.de === c.de)) continue; const ix = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0), iy = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0); if (ix > 2 && iy > 2) pisa.push(a.sel + ' × ' + c.sel); } }
  const fila = (q) => [...document.querySelectorAll(q.join(','))].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.dataset.btn || e.className.split(' ')[0], x: +(r.left + r.width / 2).toFixed(1), y: +(r.top + r.height / 2).toFixed(1) }; }).sort((a, b) => (Math.abs(a.x - b.x) > 1.5 ? a.x - b.x : a.y - b.y));
  const filas = { sis: fila(HUD_ZONAS.sis.l), crear: fila(HUD_ZONAS.crear.l), hab: fila(HUD_ZONAS.hab.l) };
  const parejo = (F) => { if (F.length < 2) return true; const xs = [...new Set(F.map((f) => Math.round(f.x)))].sort((a, b) => a - b), ys = [...new Set(F.map((f) => Math.round(f.y)))].sort((a, b) => a - b);
    const paso = (L) => L.length < 3 || L.slice(1).every((v, i) => Math.abs((v - L[i]) - (L[1] - L[0])) < 2); return paso(xs) && paso(ys) && F.every((f) => xs.some((x) => Math.abs(x - f.x) < 1.5) && ys.some((y) => Math.abs(y - f.y) < 1.5)); };
  const pl = document.getElementById('hudHab'), pr = pl && pl.style.display !== 'none' ? pl.getBoundingClientRect() : null;
  const habR = [...document.querySelectorAll(HUD_ZONAS.hab.l.join(','))].filter(vis).map((e) => e.getBoundingClientRect());
  const placa = !!pr && habR.every((r) => r.left >= pr.left - 1 && r.right <= pr.right + 1 && r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1);
  const nombres = [...document.querySelectorAll(HUD_ZONAS.hab.l.join(','))].filter(vis).map((e) => (e.querySelector('.accTxt') || {}).textContent || '');
  const tam = L.filter((x) => !x.de).map((x) => Math.min(x.x1 - x.x0, x.y1 - x.y0));
  return { W, H, n: L.length, pisa: pisa.slice(0, 8), fuera, filas: Object.fromEntries(Object.entries(filas).map(([k, F]) => [k, F.map((f) => f.id)])), parejo: Object.values(filas).every(parejo),
    sepFilas: filas.sis.length && filas.crear.length && filas.hab.length ? [+(filas.crear[0].y - filas.sis[0].y).toFixed(1), +(filas.hab[0].y - filas.crear[0].y).toFixed(1)] : null,
    placa, nombres, repetidos: nombres.length - new Set(nombres).size, tamMin: +Math.min(...tam).toFixed(1) };
})()`);
const m1 = await medir();
await p.screenshot({ path: D + 'hud_orden_telefono.png' });
const okFilas = (m) => m.filas.sis[0] === 'pausa' && m.filas.crear.length >= 3 && m.filas.hab.length >= 3 && m.parejo && m.placa && m.repetidos === 0 && m.nombres.every(Boolean);
caso('1. tres filas (sistema con la pausa primera, crear, teclas del mod con nombre y placa), sin teclas repetidas', okFilas(m1), m1);
const vistas = [m1];
for (const [w, h] of [[640, 360], [1180, 820]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(700); vistas.push(await medir()); }
await p.screenshot({ path: D + 'hud_orden_tablet.png' });
await p.setViewportSize({ width: 873, height: 393 }); await p.waitForTimeout(600);
caso('2. en 3 pantallas: nada se pisa, todo adentro, filas parejas y sin huecos', vistas.every((m) => !m.pisa.length && !m.fuera.length && m.parejo && okFilas(m)), vistas.map((m) => ({ W: m.W, H: m.H, n: m.n, pisa: m.pisa, fuera: m.fuera, parejo: m.parejo, sepFilas: m.sepFilas, tamMin: m.tamMin })));
// 3: «Ordenar» con lo que más se usó
const c3 = await ev(`(() => { PREFS.hudUso = { celular: 50, chat: 3, gmod: 30, props: 1, mod: 0, tecla3: 9 }; ctlEditar(); document.querySelector('#ctlEd [data-ce=ordenar]').click(); return { orden: CTL.borrador._orden }; })()`);
await p.waitForTimeout(300);
const m3 = await medir();
caso('3. «Ordenar»: lo más usado a la izquierda de cada fila (la pausa sigue primera)', c3.orden && c3.orden.sis[0] === '[data-btn=pausa]' && c3.orden.sis[1] === '[data-btn=celular]' && c3.orden.crear[0] === '.gmbBt' && c3.orden.hab[0] === '#bgmb2' && !m3.pisa.length, { sis: c3.orden && c3.orden.sis, crear: c3.orden && c3.orden.crear, hab: c3.orden && c3.orden.hab, pisa: m3.pisa });
// 4: «Ordenar con IA» (la IA de la tienda, simulada): una respuesta buena, y después una mala
respIA = { zonas: { sis: ['pausa', 'voces', 'chat', 'celular'], crear: ['verity', 'props', 'mod', 'gmod', 'pausa', 'inventado'], hab: ['tecla2', 'tecla1'] }, razon: 'prueba' };
const c4 = await ev(`(async () => { const b = document.querySelector('#ctlEd [data-ce=ordenarIA]'); b.click(); const t0 = Date.now(); while (Date.now() - t0 < 20000 && b.disabled) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 300)); return { orden: CTL.borrador._orden, aviso: (document.getElementById('aviso') || {}).textContent || '' }; })()`);
respIA = { zonas: 'cualquier cosa' };
const c4b = await ev(`(async () => { const b = document.querySelector('#ctlEd [data-ce=ordenarIA]'); b.click(); const t0 = Date.now(); while (Date.now() - t0 < 60000 && b.disabled) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 300)); return { orden: CTL.borrador._orden, aviso: (document.getElementById('aviso') || {}).textContent || '' }; })()`);
// (otra vez la buena, y «Guardar»; se vuelve a jugar)
respIA = { zonas: { sis: ['pausa', 'voces', 'chat', 'celular'], crear: ['verity', 'props', 'mod', 'gmod'], hab: ['tecla2', 'tecla1'] }, razon: 'prueba' };
const c4c = await ev(`(async () => { const b = document.querySelector('#ctlEd [data-ce=ordenarIA]'); b.click(); const t0 = Date.now(); while (Date.now() - t0 < 20000 && b.disabled) await new Promise((r) => setTimeout(r, 100)); document.querySelector('#ctlEd [data-ce=guardar]').click(); await new Promise((r) => setTimeout(r, 500)); return { guardado: PREFS.hudPos && PREFS.hudPos._orden, edit: CTL.edit }; })()`);
const m4 = await medir();
const bien = c4.orden && c4.orden.crear[0] === '#verBt' && c4.orden.sis[0] === '[data-btn=pausa]' && c4.orden.hab[0] === '#bgmb1' && !c4.orden.crear.includes('[data-btn=pausa]');
const malo = c4b.orden && c4b.orden.sis[0] === '[data-btn=pausa]' && c4b.orden.sis[1] === '[data-btn=celular]' && /no contestó/.test(c4b.aviso);
caso('4. «Ordenar con IA»: la respuesta se aplica validada; si es mala, ordena por uso y avisa; «Guardar» la deja', bien && malo && c4c.guardado && c4c.guardado.crear[0] === '#verBt' && !c4c.edit && !m4.pisa.length && JSON.stringify(m4.filas.hab.slice(0, 2)) === '["bgmb1","bgmb0"]' && /prueba/.test(c4.aviso),
  { ia: c4.orden && { sis: c4.orden.sis, crear: c4.orden.crear, hab: c4.orden.hab }, aviso: c4.aviso, mala: { aviso: c4b.aviso, sis: c4b.orden && c4b.orden.sis }, filas: m4.filas, pisa: m4.pisa });
await p.screenshot({ path: D + 'hud_orden_ia.png' });
const err = errJS.filter((e) => !/WebSocket|net::|Failed to load|Failed to fetch|NetworkError|willReadFrequently/i.test(e));
caso('5. sin errores de JS', !err.length, { err: err.slice(0, 5) });
console.log('RESUMEN ' + RES.filter(Boolean).length + '/' + RES.length);
await b.close();
process.exit(RES.every(Boolean) ? 0 : 1);
