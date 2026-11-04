// Entrar a un server con mods que no tengo (pedido: «al unirte a un server con mods que no tenés primero debas
// descargarlos en la pantalla de carga y después entrar»). Sin red de verdad: la sala es de mentira (conectado al
// instante), la lista del server la da la tienda y los .gma salen de la carpeta GMA (First-Person Body y Viewfinder).
//  1. la pantalla de carga muestra «Bajando los mods del server 1/2 · <nombre> NN %» mientras baja;
//  2. no se cierra hasta que los dos mods están montados (al cerrarse, los dos ya están);
//  3. con un mod que no termina nunca, «Entrar sin esperar» cierra la carga y se juega (el mod sigue en la cola);
//  4. sin errores de JS.
// uso: node server_mods_carga.mjs URL_HTML CARPETA_GMA [CARPETA_CAPTURAS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP, D = '/tmp/claude-0/srvmods'] = process.argv; fs.mkdirSync(D, { recursive: true });
const FPB = '3104967124', VF = '3780178294', COLGADO = '3104967199';
const archivos = { [FPB]: fs.readFileSync(CARP + '/' + FPB + '.gma'), [VF]: fs.readFileSync(CARP + '/' + VF + '.gma') };
let lista = [{ id: FPB, n: 'First-Person Body' }, { id: VF, n: 'Viewfinder' }];
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 500)); return ok; };
const { b, p, ev, err: errJS } = await abrir(HTML, true, null, async (pg) => {
  if (process.env.RASTRO) await pg.addInitScript(() => { const a0 = DOMTokenList.prototype.add; window.__ocPor = []; DOMTokenList.prototype.add = function (...x) { if (x.includes('oc') && this === (document.getElementById('carga') || {}).classList) window.__ocPor.push(new Error().stack.split('\n').slice(1, 6).join(' | ')); return a0.apply(this, x); }; });
  await pg.route('**/api/gmod/**', async (r) => {
    const u = r.request().url(), m = /gmod\/(\w+)\/?([\w%]*)/.exec(u) || [];
    if (/detalles\?ids=0/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' });
    if (m[1] === 'detalles') { const ids = (/ids=([\d,]+)/.exec(u) || [])[1] || ''; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: ids.split(',').map((id) => ({ id, t: id, mb: 1, dir: true })) }) }); }
    if (m[1] === 'sala') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ l: lista }) });
    if (m[1] === 'requiere') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ids":[]}' });
    if (m[1] === 'archivo') {
      const id = m[2]; if (id === COLGADO) return;   // (nunca contesta)
      // (el Viewfinder, 15 MB, tarda un poco: así se ve el avance)
      if (id === VF) await new Promise((ok) => setTimeout(ok, 2500));
      if (archivos[id]) return r.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream' }, body: archivos[id] });
    }
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
});
// (la red de mentira: entrar a la sala conecta al instante y publicar no manda nada)
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; window.__cargaPrueba = true; redEntrar = function () { RED.on = true; }; publicar = function () {}; GMC.traba = 9000; 1`);
const entrar = (id) => ev(`(() => { SALA = { id: '${id}', n: 'Server de prueba', m: 'RB_Construct' }; window.__vistos = []; window.__alCerrar = null;
  const W = window.__carga, f0 = W.fin; W.fin = function (cb) { window.__alCerrar = { fpb: GMOD.addons.has('${FPB}'), vf: GMOD.addons.has('${VF}'), t: Date.now() }; return f0.call(this, cb); };
  const s0 = W.set; W.set = function (p, paso) { if (paso && !window.__vistos.includes(paso)) window.__vistos.push(paso); return s0.call(this, p, paso); };
  entrarConCarga('Server de prueba', 'RB_Construct', () => { inicioMostrar(false); return empezarPartida('RB_Construct'); }, true); return 1; })()`);
let bien = 0, tot = 0;
// (que termine de cerrarse la carga del arranque antes de entrar)
for (let i = 0; i < 40 && !(await ev(`window.__carga.listo && document.getElementById('carga').classList.contains('oc')`)); i++) await p.waitForTimeout(250);
await entrar('prueba_mods_1');
// mientras baja: una captura con el avance
let capt = false;
for (let i = 0; i < 120 && !(await ev(`!!window.__alCerrar`)); i++) {
  await p.waitForTimeout(250);
  if (!capt && (await ev(`/ \\d+\\/2 · /.test(document.getElementById('cargaPaso').textContent || '')`))) { capt = true; await p.screenshot({ path: D + '/carga_mods.png' }); console.log('CARGA', JSON.stringify(await ev(`(() => { const c = document.getElementById('carga'), s = getComputedStyle(c); return { por: (window.__ocPor || []).slice(-3), cls: c.className, disp: s.display, op: s.opacity, z: s.zIndex, vis: s.visibility, listo: window.__carga.listo, paso: document.getElementById('cargaPaso').textContent }; })()`))); }
}
const v = await ev(`({ vistos: window.__vistos.filter((x) => / \\d+\\/2 · /.test(x)).slice(0, 4), alCerrar: window.__alCerrar, estado: JUEGO.estado, montados: [...GMS.montados] })`);
tot++; if (caso('1. la carga muestra qué mod baja y cuánto va', v.vistos.length > 0 && capt, { vistos: v.vistos })) bien++;
tot++; if (caso('2. la carga se cierra recién con los dos mods montados', !!(v.alCerrar && v.alCerrar.fpb && v.alCerrar.vf) && v.estado === 'juego', v)) bien++;
// 3: otro server con un mod que no termina nunca
await ev(`gmsSalir(); SALA = null; 1`);
await p.waitForTimeout(500);
lista = [{ id: COLGADO, n: 'Mod colgado' }];
await ev(`GMOD.addons.delete('${COLGADO}'); 1`);
await entrar('prueba_mods_2');
let hayBt = false; for (let i = 0; i < 60 && !hayBt; i++) { await p.waitForTimeout(250); hayBt = await ev(`!!document.getElementById('cargaSaltar')`); }
await p.waitForTimeout(800); await p.screenshot({ path: D + '/carga_saltar.png' });
if (hayBt) await p.click('#cargaSaltar');
let cerro = false; for (let i = 0; i < 40 && !cerro; i++) { await p.waitForTimeout(250); cerro = await ev(`!!window.__alCerrar`); }
tot++; if (caso('3. «Entrar sin esperar» cierra la carga con un mod colgado y se juega', hayBt && cerro && (await ev(`JUEGO.estado === 'juego'`)), { hayBt, cerro })) bien++;
const err = errJS.filter((e) => !/Failed to load resource|net::ERR|404|CORS|Access to fetch|WebSocket|mqtt/i.test(e));
tot++; if (caso('4. sin errores de JS', !err.length, { err: err.slice(0, 5) })) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await b.close();
process.exit(bien === tot ? 0 : 1);
