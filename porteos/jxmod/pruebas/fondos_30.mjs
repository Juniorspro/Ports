// Fondos del evento 3.0 (Discord, noviembre de 2026: «sobre todo nuevas capturas de fondo para los menús»):
//  1. el menú principal trae las 6 fotos nuevas (1280×720, ninguna en blanco o en negro: desvío del brillo ≥ 12; una
//     lisa da ~0, y la de la pizzería, oscura a propósito, da 18)
//  2. la pantalla de carga trae 13 fotos, una por mapa (las mismas medidas), con los nombres que usa FONDO_MAPA
//  3. cada mapa del juego (salvo Base, BaseV2 y el Espacio, que van rotando) tiene la suya, y está en el HTML
//  4. al entrar a un mapa se ve su foto y su nombre de archivo: «map: rb_isla», «map: gm_construct» (antes «rb_rb_isla»)
//  5. la pantalla de carga dice la versión del juego (v3.0; antes decía v1.0)
//  6. sin errores de JS
// uso: node fondos_30.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, false);
// (cada foto: su tamaño y el desvío del brillo, decodificada en la página)
const medir = `async (src) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = 160; c.height = 90; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 160, 90);
  const d = x.getImageData(0, 0, 160, 90).data; let s = 0, s2 = 0; for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += l; s2 += l * l; } const n = d.length / 4, m = s / n;
  return { w: im.naturalWidth, h: im.naturalHeight, brillo: Math.round(m), desvio: Math.round(Math.sqrt(Math.max(0, s2 / n - m * m))), kb: Math.round(src.length * 0.75 / 1024) }; }`;
const menu = await ev(`(async () => { const f = ${medir}; const r = []; for (const s of FONDOS_RB) r.push(await f(s)); return r; })()`);
ok('1. menú: 6 fotos de 1280×720, ninguna en blanco o negro (desvío ≥ 12)', menu.length === 6 && menu.every((x) => x.w === 1280 && x.h === 720 && x.desvio >= 12), menu);
// (las de carga están en el HTML como [nombre, foto]: se leen del código de la página)
const carga = await ev(`(async () => { const t = [...document.scripts].map((s) => s.textContent).find((s) => s.includes('var FON = [')); const m = t.match(/var FON = \\[(.*?)\\], capas/s);
  const L = m ? [...m[1].matchAll(/\\['([^']+)','(data:image\\/[^']+)'\\]/g)].map((x) => [x[1], x[2]]) : []; const f = ${medir}; const r = []; for (const [n, s] of L) r.push(Object.assign({ n }, await f(s))); return r; })()`);
const nombres = carga.map((x) => x.n);
ok('2. pantalla de carga: 13 fotos de 1280×720, ninguna en blanco o negro (desvío ≥ 12)', carga.length === 13 && carga.every((x) => x.w === 1280 && x.h === 720 && x.desvio >= 12), carga);
const mapas = await ev(`(() => { const sin = ['Base', 'BaseV2', 'Space']; return [...MAPAS, ...MAPAS_RB].filter((m) => !sin.includes(m) && !/^WS_/.test(m)).map((m) => [m, FONDO_MAPA[m] || null]); })()`);
const faltan = mapas.filter(([m, f]) => !f || !nombres.includes(f));
ok('3. cada mapa del juego tiene su foto de carga y está en el HTML', !faltan.length, { faltan, mapas: mapas.length });
// 4: entrar con la pantalla de carga (como entrarConCarga): su foto y su nombre
const vista = async (m) => ev(`(async () => { const C = window.__carga; C.abrir(mapaNom(${JSON.stringify(m)}), FONDO_MAPA[${JSON.stringify(m)}] || '', mapaArchivoNom(${JSON.stringify(m)}));
  await new Promise((r) => setTimeout(r, 300)); const v = document.querySelector('#carga .cgFondo.ve'); return { mapa: document.getElementById('cargaMapa').textContent, foto: v ? v.style.backgroundImage.length : 0, h: v ? v.style.backgroundImage.slice(-40) : '' }; })()`);
const vI = await vista('RB_Isla'), vC = await vista('RB_Construct'), vF = await vista('FlatGrass'), vW = await ev(`mapaArchivoNom('WS_gm_hotel')`);
ok('4. al entrar: la foto de su mapa y «map: rb_isla», «map: gm_construct», «map: rb_flatgrass», «gm_hotel»', vI.mapa === 'map: rb_isla' && vC.mapa === 'map: gm_construct' && vF.mapa === 'map: rb_flatgrass' && vW === 'gm_hotel' && vI.foto > 1000 && vI.h !== vC.h && vC.h !== vF.h, { vI: vI.mapa, vC: vC.mapa, vF: vF.mapa, vW });
const ver = await ev(`({ chip: document.getElementById('cargaVer').textContent, v: JX_VERSION })`);
ok('5. la pantalla de carga dice la versión del juego', ver.chip === 'v' + ver.v, ver);
const js = err.filter((x) => !/broker|mqtt|tienda|CORS|ERR_FAILED|Failed to load|net::|willRead/i.test(x));
ok('6. sin errores de JS', !js.length, js.slice(0, 4));
console.log('tamaño: menú ' + menu.reduce((a, x) => a + x.kb, 0) + ' KB, carga ' + carga.reduce((a, x) => a + x.kb, 0) + ' KB');
await b.close();
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
