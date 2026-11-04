// Descargas de mods que se trababan en 0 % (pedido: «hay veces que los mods se trancan también en descarga arregla eso»).
// Se simula lo peor de un celular: la caché del navegador (IndexedDB) que nunca contesta y una conexión que se queda
// colgada sin cortar. Con el addon First-Person Body (57 kB, de la carpeta GMA):
//  1. caché colgada + la primera bajada colgada: la cola la da por trabada, la vuelve a intentar sola y el mod queda
//     instalado, sin intervenir;
//  2. la bajada que se corta a la mitad (los datos dejan de llegar): igual, se reintenta y se instala;
//  3. una que nunca anda: después de 3 intentos queda en error con el botón «Reintentar», que la vuelve a poner en la cola;
//  4. sin errores de JS.
// uso: node descarga_trabada.mjs URL_HTML CARPETA_GMA
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP] = process.argv;
const GMA = fs.readFileSync(CARP + '/3104967124.gma');
const ID1 = '3104967124', ID2 = '3104967125', ID3 = '3104967126';
const pedidos = {};
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 400)); return ok; };
const { b, p, ev, err: errJS } = await abrir(HTML, true, null, async (pg) => {
  // (la caché del navegador que nunca contesta)
  await pg.addInitScript(() => { const o = indexedDB.open.bind(indexedDB); window.__idbColgada = true; indexedDB.open = function (n, v) { if (window.__idbColgada && n === 'rb-gmod') return {}; return o(n, v); }; });
  // (la primera bajada de ID2 manda la mitad y se queda abierta, sin cerrar: como un servidor que se colgó a mitad de camino)
  await pg.addInitScript(({ b64, id }) => {
    const f0 = window.fetch.bind(window); window.__cortadas = 0;
    window.fetch = function (u, o) {
      if (String(u).includes('gmod/archivo/' + id) && ++window.__cortadas === 1) {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), mitad = bin.slice(0, bin.length >> 1);
        return Promise.resolve(new Response(new ReadableStream({ start(c) { c.enqueue(mitad); } }), { status: 200, headers: { 'content-length': String(bin.length) } }));
      }
      return f0(u, o);
    };
  }, { b64: GMA.toString('base64'), id: ID2 });
  await pg.route('**/api/gmod/**', async (r) => {
    const u = r.request().url(), m = /gmod\/(\w+)\/?(\d*)/.exec(u) || [], ep = m[1], id = m[2];
    if (/detalles\?ids=0/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' });
    if (ep === 'requiere') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ids":[]}' });
    if (ep === 'archivo') {
      const k = (pedidos[id] = (pedidos[id] || 0) + 1);
      if (id === ID1 && k === 1) return;   // (colgada: nunca contesta)
      if (id === ID3) return;   // (nunca anda)
      return r.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream' }, body: GMA });
    }
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
});
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GMC.traba = 9000; GMC.trabaLarga = 20000; 1`);
let bien = 0, tot = 0;
const esperar = async (cond, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond)) return Date.now() - t0; await p.waitForTimeout(500); } return -1; };
// 1
tot++; await ev(`gmcPoner('${ID1}', { nombre: 'Prueba colgada' }); 1`);
let t1 = await esperar(`GMOD.addons.has('${ID1}')`, 60000);
const est1 = await ev(`({ instalado: GMOD.addons.has('${ID1}'), lua: GMOD.addons.has('${ID1}') ? GMOD.addons.get('${ID1}').lua.length : 0, pedidos: ${JSON.stringify(0)} })`);
if (caso('1. caché colgada + primera bajada colgada: se reintenta sola y queda instalado', t1 > 0 && est1.instalado && est1.lua === 1, { ms: t1, ...est1, pedidosArchivo: pedidos[ID1] })) bien++;
// 2 (el mismo .gma con otro número: se cambia el id en la ruta)
tot++; await ev(`gmcPoner('${ID2}', { nombre: 'Prueba cortada' }); 1`);
const t2 = await esperar(`GMOD.addons.has('${ID2}')`, 60000);
const cortadas = await ev(`window.__cortadas`);
if (caso('2. la bajada que se queda a la mitad (sin cerrar) se corta, se reintenta y se instala entera', t2 > 0 && cortadas >= 2 && await ev(`GMOD.addons.get('${ID2}').lua.length === 1`), { ms: t2, intentos: cortadas })) bien++;
// 3
tot++; await ev(`gmcPoner('${ID3}', { nombre: 'Prueba rota' }); GMC.abierta = true; gmcDibujar(true); 1`);
const t3 = await esperar(`GMC.l.some((x) => x.id === '${ID3}' && x.estado === 'error')`, 90000);
const boton = await ev(`(() => { gmcDibujar(true); const b = document.querySelector('#gmCola [data-gmcr="${ID3}"]'); return { hay: !!b, texto: b ? b.textContent : '', visible: b ? b.getBoundingClientRect().width > 0 : false }; })()`);
await p.screenshot({ path: '/tmp/claude-0/descarga_trabada.png' });
let reencolado = false;
if (boton.hay) { await p.click(`#gmCola [data-gmcr="${ID3}"]`); reencolado = await ev(`GMC.l.some((x) => x.id === '${ID3}' && (x.estado === 'espera' || x.estado === 'bajando'))`); }
if (caso('3. una que nunca anda: 3 intentos, error con «Reintentar» y el botón la vuelve a poner en la cola', t3 > 0 && boton.hay && reencolado && pedidos[ID3] >= 3, { ms: t3, ...boton, reencolado, pedidosArchivo: pedidos[ID3] })) bien++;
await ev(`gmcCancelar('${ID3}'); 1`);
tot++; const err = errJS.filter((e) => !/Failed to load resource|net::ERR|404|CORS|Access to fetch/.test(e));
if (caso('4. sin errores de JS', !err.length, { err: err.slice(0, 5) })) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await b.close();
process.exit(bien === tot ? 0 : 1);
