// El juego no se congela al bajar y montar un mod (pedido: «crashea, queda pegado … la descarga gira, para mí que hay
// algo ahí», con el Viewfinder al 99 %). Al cargarse, el Viewfinder dibuja una textura de ruido borrando 1024 cuadraditos
// de a uno (render.Clear); por cada uno el juego guardaba y volvía a poner el estado de WebGL preguntándoselo a la placa
// (11 getParameter que esperan a que la placa termine todo): en un celular simulado el juego quedaba congelado ~4 minutos.
// En un celular simulado (procesador 4 veces más lento), en el menú principal:
//  1. el Viewfinder se baja por la cola y se monta: listo en menos de 90 s, el juego nunca se congela más de 6 s y el
//     latido a la app sigue llegando (con ?sombra=0 —el estado preguntado a la placa, como antes— y ANTES=1, se mide igual);
//  2. si la vez anterior se trabó corriendo el Lua de un mod (la caja negra lo dice), al abrir ese mod queda montado pero
//     sin correr su Lua, el aviso lo explica, y su página del panel GMod tiene «Volver a cargarlo», que lo carga;
//  3. si se pierde el WebGL y el navegador no lo devuelve, a los 10 s el juego se recarga solo y avisa (antes quedaba la
//     última imagen congelada para siempre);
//  4. sin errores de JS.
// uso: node montar_sin_trabar.mjs URL_HTML CARPETA_GMA   (ANTES=1 en el entorno: mide también sin el arreglo)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs';
const [, , HTML, CARP] = process.argv;
const VF = '3780178294';
const GMA_VF = fs.readFileSync(CARP + '/' + VF + '.gma');
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 600)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 11 Pro 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 JXMod/2.9-prueba10' });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
await ctx.route('**/api/gmod/**', async (r) => {
  const u = r.request().url(), m = /gmod\/(\w+)\/?(\d*)/.exec(u) || [];
  const H = { 'Access-Control-Allow-Origin': '*' };
  if (/detalles\?ids=0/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '{"items":[]}' });
  if (m[1] === 'requiere') return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '{"ids":[]}' });
  if (m[1] === 'archivo' && m[2] === VF) { await new Promise((ok) => setTimeout(ok, 2000)); return r.fulfill({ status: 200, headers: { ...H, 'content-type': 'application/octet-stream' }, body: GMA_VF }); }
  return r.fulfill({ status: 404, contentType: 'application/json', headers: H, body: '{}' });
});
// (el hilo del juego: un reloj cada 250 ms; un hueco largo es un congelamiento. Y la app de Android de mentira)
await ctx.addInitScript(() => { window.__lat = 0; window.__vivo = [performance.now()]; setInterval(() => window.__vivo.push(performance.now()), 250);
  window.JXNativo = { latido() { window.__lat++; }, registroNativo() { return ''; }, registroVisto() {}, version() { return 'prueba'; } }; });
const p = await ctx.newPage(); const errJS = [];
p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const abrir = async (q) => { await p.goto(HTML + (q || '')); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); };
const cdp = await ctx.newCDPSession(p);
let bien = 0, tot = 0;

// 1: bajar y montar el Viewfinder con el procesador lento
async function medir(q) {
  await abrir(q);
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; guardarPrefs(); 1`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now(); let listo = -1, peor = 0, lat0 = await ev(`window.__lat`), colgado = false;
  await ev(`window.__vivo = [performance.now()]; gmcPoner('${VF}', { nombre: 'Viewfinder', img: '' }); 1`);
  while (Date.now() - t0 < 120000) {
    await p.waitForTimeout(2000);
    const s = await Promise.race([ev(`(() => { const v = window.__vivo; let m = 0; for (let k = 1; k < v.length; k++) m = Math.max(m, v[k] - v[k - 1]); window.__vivo = v.slice(-1); return { m, mont: GMOD.addons.has('${VF}') && !GMC.l.length }; })()`), new Promise((ok) => setTimeout(() => ok(null), 25000))]);
    if (!s) { colgado = true; peor = Math.max(peor, 25000); if (q) break; continue; }
    peor = Math.max(peor, s.m);
    if (s.mont && listo < 0) { listo = Date.now() - t0; break; }
  }
  if (listo < 0) console.log("estado", JSON.stringify(await ev(`({ cola: GMC.l.map((x) => [x.n, x.estado, x.fase, x.p, x.err && String(x.err)]), mont: [...GMOD.addons.keys()], err: GMOD.errores.slice(-4) })`)));
  const lat = (await Promise.race([ev(`window.__lat`), new Promise((ok) => setTimeout(() => ok(null), 60000))])) - lat0;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return { listoMs: listo, peorCongeladoMs: Math.round(peor), latidos: lat, colgado };
}
let antes = null;
if (process.env.ANTES === '1') { antes = await medir('?sombra=0'); console.log('ANTES (?sombra=0): ' + JSON.stringify(antes)); await abrir(''); await ev(`(async () => { const db = await gmDB(); await new Promise((ok) => { const t = db.transaction('gma', 'readwrite'); t.objectStore('gma').clear(); t.oncomplete = ok; }); for (const k of Object.keys(PREFS.gmod || {})) delete PREFS.gmod[k]; guardarPrefs(); return 1; })()`); }
const d1 = await medir('');
tot++; if (caso('1. con el procesador 4 veces más lento, el Viewfinder se baja y se monta sin congelar el juego', d1.listoMs > 0 && d1.listoMs < 90000 && d1.peorCongeladoMs < 6000 && d1.latidos >= 3 && !d1.colgado, { despues: d1, antes })) bien++;

// 2: la vez anterior se trabó corriendo el Lua del Viewfinder
await p.waitForTimeout(1500);
await ev(`(() => { cnGuardar = function () {}; const c = JSON.parse(localStorage.getItem('jx_caja')); c.paso = 'corriendo el Lua del mod Viewfinder'; c.addon = '${VF}'; localStorage.setItem('jx_caja', JSON.stringify(c)); localStorage.setItem('rb_vivo', String(Date.now())); return 1; })()`);
await abrir('?colgado=1');
await p.waitForFunction((x) => window.__ev(x), `GMOD.addons.has('${VF}') && !!document.getElementById('cnVen')`, { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2500);
const c2 = await ev(`(() => { const A = GMOD.addons.get('${VF}'), v = document.getElementById('cnVen'); return { montado: !!A, trabado: !!(A && A.trabado), lua: A ? A.luaCorridos || 0 : -1, enLista: GMA.trabados.has('${VF}'), guardado: localStorage.getItem('rb_gm_trabados'), aviso: v ? v.innerText.slice(0, 260) : '', url: location.search }; })()`);
await ev(`(() => { const v = document.getElementById('cnVen'); if (v) v.remove(); empezarPartida('RB_Construct'); return 1; })()`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 180000 });
await p.waitForTimeout(1500);
await ev(`(() => { gmbAbrir('${VF}'); return 1; })()`);
await p.waitForTimeout(800);
const bt = await ev(`(() => { const x = document.querySelector('[data-gb="cargar:${VF}"]'); return x ? x.innerText : null; })()`);
if (bt) await p.click(`[data-gb="cargar:${VF}"]`).catch(() => ev(`gmbAccion('cargar:${VF}'); 1`));
await p.waitForTimeout(2500);
const c2b = await ev(`(() => { const A = GMOD.addons.get('${VF}'); return { lua: A.luaCorridos || 0, trabado: !!A.trabado, enLista: GMA.trabados.has('${VF}'), guardado: localStorage.getItem('rb_gm_trabados'), boton: !!document.querySelector('[data-gb="cargar:${VF}"]') }; })()`);
tot++; if (caso('2. el mod que se trabó al cargarse queda montado sin su Lua, el aviso lo dice, y «Volver a cargarlo» lo carga', c2.montado && c2.trabado && c2.lua === 0 && /quedó sin cargar/.test(c2.aviso) && !/colgado/.test(c2.url) && bt && c2b.lua > 0 && !c2b.trabado && !c2b.enLista && c2b.guardado === '[]' && !c2b.boton, { antes: c2, boton: bt, despues: c2b })) bien++;

// 3: se pierde el WebGL y no vuelve
await ev(`(() => { if (typeof gmbCerrar === 'function') gmbCerrar(); window.__perdi = Date.now(); R.gl.getExtension('WEBGL_lose_context').loseContext(); return 1; })()`);
const t3 = Date.now();
await p.waitForURL(/caida=webgl/, { timeout: 30000 }).catch(() => {});
const recargo = Date.now() - t3;
await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }).catch(() => {});
await p.waitForSelector('#cnVen', { timeout: 20000 }).catch(() => {});
const c3 = await ev(`(() => { const v = document.getElementById('cnVen'); return { ventana: !!v, anotado: v ? /se perdió el contexto de WebGL/.test(v.querySelector('textarea').value) : false, perdido: !!R.perdido, url: location.search }; })()`);
tot++; if (caso('3. WebGL perdido que no vuelve: se recarga solo a los ~10 s y avisa', recargo > 8000 && recargo < 25000 && c3.ventana && c3.anotado && !c3.perdido && !/caida/.test(c3.url), { recargoMs: recargo, ...c3 })) bien++;

const err = errJS.filter((e) => !/WebSocket|net::|Failed to load/i.test(e));
tot++; if (caso('4. sin errores de JS', !err.length, { err: err.slice(0, 5) })) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await b.close();
process.exit(bien === tot ? 0 : 1);
