// lo grande de los addons (texturas .vtf y mapas .bsp) queda en el navegador (un Blob en IndexedDB) y se lee cuando hace
// falta: instala addons pesados, mide cuánto queda en memoria (los bytes de los archivos montados), recarga la página
// (al arrancar se montan desde la caché sin cargarlos enteros), y comprueba que el arma de un addon se ve con sus
// texturas, que su ícono sale y que un mapa del Workshop se arma leyendo su .bsp recién al elegirlo.
// uso: node gmod_perezoso.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
const IDS = ['128089118', '177059754', '336509414'];
const memoria = () => ev(`(() => { const vistos = new Set(); let tot = 0; for (const u of GMOD.arch.values()) { const ab = u.buffer; if (!vistos.has(ab)) { vistos.add(ab); tot += ab.byteLength; } }
  let cache = 0; for (const u of GMPZ.cache.values()) cache += u.length; const pm = performance.memory || {};
  return { montadoMB: +(tot / 1048576).toFixed(1), perezosos: GMPZ.idx.size, cacheMB: +(cache / 1048576).toFixed(1), heapMB: +((pm.usedJSHeapSize || 0) / 1048576).toFixed(1), addons: [...GMOD.addons.keys()] }; })()`);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
let tam = 0;
for (const id of IDS) {
  const r = await ev(`(async () => { const r = await fetch(${JSON.stringify(CARP)} + '/${id}.gma'); if (!r.ok) return 0; const u = new Uint8Array(await r.arrayBuffer()); const n = u.length; const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, u); await A.listo; return n; })()`);
  tam += r;
}
await p.waitForTimeout(1500);
const m1 = await memoria();
ok(`instalados ${IDS.length} addons (${(tam / 1048576).toFixed(0)} MB): en memoria queda menos de un tercio y lo demás espera en el disco`, m1.perezosos > 50 && m1.montadoMB < tam / 1048576 / 3, m1);
// el arma de M9K en la mano, con texturas de verdad (no grises) al rato
await ev(`(() => { gmaDarArma('m9k_ak47'); elegirArma(ARM.lista.indexOf('gm:m9k_ak47')); $('hud').classList.add('oc'); return 1; })()`);
await p.waitForTimeout(3500);
const tex = await ev(`(() => { let gris = 0, listas = 0; for (const [k, ti] of GMOD.tex) { if (typeof ti !== 'number' || ti < 0) continue; const t = R.tex[ti]; if (!t) continue; if (t.gl) listas++; else gris++; } return { listas, gris }; })()`);
ok('las texturas del arma llegan del disco (ninguna se queda gris)', tex.listas > 0 && tex.gris === 0, tex);
await p.screenshot({ path: D + 'perezoso_arma.jpg', type: 'jpeg', quality: 75 });
// el ícono de un modelo del addon (sus texturas se leen chicas antes de dibujarlo)
const ico = await ev(`(async () => { const r = 'models/weapons/w_ak47_m9k.mdl'; const n = 'gm:' + r; gmIcono(n); for (let i = 0; i < 60 && !GMOD.iconos.get(n); i++) await new Promise((x) => setTimeout(x, 100)); const u = GMOD.iconos.get(n) || ''; return { tiene: u.length > 100, largo: u.length }; })()`);
ok('el ícono de un modelo sale (con sus texturas leídas del disco)', ico.tiene, ico);
// recargar: los instalados se montan desde la caché sin cargarlos enteros
await ev(`(() => { PREFS.gmod = PREFS.gmod || {}; for (const id of ${JSON.stringify(IDS)}) PREFS.gmod[id] = PREFS.gmod[id] || { n: id, t: Date.now() }; guardarPrefs(); return 1; })()`);
await p.reload(); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
for (let i = 0; i < 60; i++) { const n = await ev(`GMOD.addons.size`); if (n >= IDS.length) break; await p.waitForTimeout(500); }
const m2 = await memoria();
ok('al arrancar de nuevo, los 3 se montan desde la caché y en memoria queda lo mismo de poco', IDS.every((x) => m2.addons.includes(x)) && m2.montadoMB < tam / 1048576 / 3, m2);
// el mapa del Workshop se arma leyendo el .bsp del disco
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); 1`);
const mapa = await ev(`[...GBSP.mapas].filter(([k, x]) => x.id === '177059754').map(([k]) => k)[0] || ''`);
await ev(`empezarPartida(${JSON.stringify(mapa)}); 1`);
await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), mapa, { timeout: 300000 }).catch(() => {});
await p.waitForTimeout(4000);
const mm = await ev(`({ nombre: MUNDO.nombre, tris: MUNDO.nt, cielo3d: !!MUNDO.cielo3d, cubo: !!(R.cielo && R.cielo.cuboPx) })`);
ok('el mapa se arma leyendo su .bsp del disco (con su cielo 3D y su cielo de verdad)', mm.nombre === mapa && mm.tris > 1000 && mm.cielo3d && mm.cubo, mm);
await ev(`$('hud').classList.add('oc'); 1`); await p.screenshot({ path: D + 'perezoso_mapa.jpg', type: 'jpeg', quality: 75 });
const m3 = await memoria(); console.log('después del mapa', JSON.stringify(m3));
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
