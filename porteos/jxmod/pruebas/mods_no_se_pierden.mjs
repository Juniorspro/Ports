// Los mods y mapas instalados no se pierden (pedido: «perdí mis mapas y mods descargados, eso no debería pasar»). En la
// 2.9-prueba8 la caché de los addons tenía 8 s de tope: en un celular con muchos mods, una lectura lenta se tomaba como
// «no está» y por 2 minutos ningún otro mod se montaba (ni los mapas que traen). Con First-Person Body y Viewfinder:
//  1. con la caché lenta (cada lectura tarda 12 s), al volver a abrir el juego los dos mods se montan igual y siguen en la
//     lista de instalados;
//  2. si un mod instalado de verdad no está en la caché (una descarga que no se llegó a guardar), se vuelve a bajar solo y
//     queda montado, sin tocar la lista;
//  3. en modo seguro (?seguro=1, lo pide la app después de varios cuelgues) los mods no se cargan pero siguen instalados;
//  4. sin errores de JS.
// uso: node mods_no_se_pierden.mjs URL_HTML CARPETA_GMA
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs';
const [, , HTML, CARP] = process.argv;
const FPB = '3104967124', VF = '3780178294';
const GMAS = { [FPB]: fs.readFileSync(CARP + '/' + FPB + '.gma'), [VF]: fs.readFileSync(CARP + '/' + VF + '.gma') };
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 500)); return ok; };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
let bajadas = 0;
await ctx.route('**/api/gmod/**', async (r) => {
  const u = r.request().url(), m = /gmod\/(\w+)\/?(\d*)/.exec(u) || [];
  if (/detalles\?ids=0/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' });
  if (m[1] === 'requiere') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ids":[]}' });
  if (m[1] === 'archivo' && GMAS[m[2]]) { bajadas++; return r.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream' }, body: GMAS[m[2]] }); }
  return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
});
// (la caché lenta: cada lectura de un addon tarda 12 s, como en un celular con mucho guardado)
await ctx.addInitScript(() => {
  if (!/lenta/.test(location.search)) return;
  const g0 = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get = function (k) {
    const q = g0.call(this, k); const ev = { onsuccess: null, onerror: null };
    const prox = new Proxy(q, { set(t, p, v) { if (p === 'onsuccess' || p === 'onerror') { ev[p] = v; return true; } t[p] = v; return true; }, get(t, p) { if (p === 'result') return t.result; const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } });
    q.onsuccess = (e) => setTimeout(() => ev.onsuccess && ev.onsuccess.call(prox, e), 12000);
    q.onerror = (e) => setTimeout(() => ev.onerror && ev.onerror.call(prox, e), 12000);
    return prox;
  };
});
const p = await ctx.newPage(); const errJS = [];
p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200)));
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const abrir = async (q) => { await p.goto(HTML + (q || '')); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); };
const esperar = async (cond, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return Date.now() - t0; await p.waitForTimeout(500); } return -1; };
let bien = 0, tot = 0;
await abrir('');
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; guardarPrefs(); 1`);
for (const id of [FPB, VF]) await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify('http://127.0.0.1:8958/gma')} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: 'mod ${id}', sinDeps: true }, b); await A.listo; return 1; })()`);
await p.waitForTimeout(1500);
// 1
await abrir('?lenta=1');
const t1 = await esperar(`GMOD.addons.has('${FPB}') && GMOD.addons.has('${VF}')`, 90000);
const e1 = await ev(`({ montados: [...GMOD.addons.keys()], lista: Object.keys(PREFS.gmod || {}) })`);
tot++; if (caso('1. con la caché lenta (12 s por lectura) los dos mods se montan y siguen instalados', t1 > 0 && e1.lista.includes(FPB) && e1.lista.includes(VF), { ms: t1, ...e1 })) bien++;
// 2: el Viewfinder sale de la caché (como una descarga que no se guardó)
await ev(`(async () => { const db = await gmDB(); await new Promise((ok) => { const t = db.transaction('gma', 'readwrite'); t.objectStore('gma').delete('${VF}'); t.oncomplete = ok; }); return 1; })()`);
bajadas = 0;
await abrir('');
const t2 = await esperar(`GMOD.addons.has('${VF}') && GMOD.addons.has('${FPB}')`, 90000);
const e2 = await ev(`({ montados: [...GMOD.addons.keys()], lista: Object.keys(PREFS.gmod || {}), errores: GMOD.errores.slice(-3) })`);
tot++; if (caso('2. un mod instalado que no está en la caché se vuelve a bajar solo y queda montado', t2 > 0 && bajadas >= 1 && e2.lista.includes(VF), { ms: t2, bajadas, ...e2 })) bien++;
// 3
await abrir('?seguro=1');
await p.waitForTimeout(4000);
const e3 = await ev(`({ montados: GMOD.addons.size, lista: Object.keys(PREFS.gmod || {}) })`);
tot++; if (caso('3. en modo seguro los mods no se cargan pero siguen instalados', e3.montados === 0 && e3.lista.includes(FPB) && e3.lista.includes(VF), e3)) bien++;
const err = errJS.filter((e) => !/WebSocket|net::|Failed to load/i.test(e));
tot++; if (caso('4. sin errores de JS', !err.length, { err: err.slice(0, 5) })) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await b.close();
process.exit(bien === tot ? 0 : 1);
