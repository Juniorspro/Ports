// la base de celulares (celulares.js): cada código de modelo de la lista se encuentra y da su propio equipo; los
// modelos como los manda el navegador (Client Hints, el user agent con o sin "Build/", Samsung con sufijos /DS, Tecno
// con o sin la marca) se reconocen; la GPU sola (sin modelo) da un puntaje razonable; la calidad elegida sigue al
// puntaje y la memoria; y al abrir el juego con un modelo (?celu=) la calidad automática sale de la base y se ve en
// Ajustes. Sin errores.
// uso: node celulares.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const sep = HTML.includes('?') ? '&' : '?';
const { b, p, err, ev } = await abrir(HTML + sep + 'celu=' + encodeURIComponent('TECNO KI5k'), true);
// 1) todos los códigos de la lista se encuentran y dan su equipo
const r1 = await ev(`(() => { let n = 0, mal = []; const eq = new Set();
  for (const lin of CEL_MOD.split('|')) { const [cods, si, ram, ...nom] = lin.split(':'); eq.add(nom.join(':')); for (const c of cods.split(',')) { n++; const d = celuBuscar(c); if (!d || d.nom !== nom.join(':') || d.soc !== CEL_SOC[+si][0]) mal.push([c, d && d.nom]); } }
  return { codigos: n, equipos: eq.size, socs: CEL_SOC.length, mal: mal.slice(0, 8), nMal: mal.length }; })()`);
ok(`los ${r1.codigos} códigos de los ${r1.equipos} equipos se encuentran y dan su propio equipo (${r1.socs} chips)`, r1.nMal === 0 && r1.equipos >= 300 && r1.socs >= 50, r1);
// 2) modelos como los manda el navegador
const casos = [
  ['SM-A055F', 'Samsung Galaxy A05'], ['SM-A055F/DS', 'Samsung Galaxy A05'], ['sm-a155m', 'Samsung Galaxy A15'],
  ['TECNO KI5k', 'Tecno Spark 10C'], ['KI5k', 'Tecno Spark 10C'], ['23108RN04Y', null], ['moto g24', 'Motorola moto g24'],
  ['Infinix X6528', 'Infinix Hot 40i'], ['M2006C3LG', 'Xiaomi Redmi 9A'], ['itel A665L', null], ['ZTE 8550', 'ZTE Blade V50 Vita'], ['Blade A51', 'ZTE Blade A51'], ['RMX3710', null],
];
const r2 = await ev(`(() => ${JSON.stringify(casos)}.map(([m, e]) => { const d = celuBuscar(m); return [m, d ? d.nom : null, e, d ? d.soc : null, d ? d.puntaje : null]; }))()`);
ok('modelos como los manda el navegador (sufijos, minúsculas, con y sin marca) dan el equipo correcto', r2.every(([m, n, e]) => n && (!e || n === e)), r2);
// 3) el user agent (sin Client Hints): el modelo sale de la cadena, con o sin Build/
const uas = [
  ['Mozilla/5.0 (Linux; Android 13; SM-A055F Build/TP1A.220624.014; wv) AppleWebKit/537.36', 'SM-A055F'],
  ['Mozilla/5.0 (Linux; Android 12; TECNO KI5k) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36', 'TECNO KI5k'],
  ['Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36', ''],
];
const r3 = await ev(`(() => ${JSON.stringify(uas)}.map(([ua, e]) => { const m = /Android [\\d.]+;\\s*(?:[a-z]{2}[-_][a-z]{2};\\s*)?([^;)]+?)(?:\\s+Build\\/[^;)]*)?\\s*[;)]/i.exec(ua); const mod = m && !/^k$/i.test(m[1].trim()) ? m[1].trim() : ''; return [mod, e]; }))()`);
ok('el modelo sale del user agent (y el "K" de Chrome reducido no se toma por modelo)', r3.every(([a, e]) => a === e), r3);
// 4) sólo la GPU
const gpus = ['ANGLE (ARM, Mali-G52 MC2, OpenGL ES 3.2)', 'PowerVR Rogue GE8320', 'Adreno (TM) 610', 'Mali-G57 MC2', 'Adreno (TM) 740'];
const r4 = await ev(`(() => ${JSON.stringify(gpus)}.map((g) => { const d = celuPorGPU(g); return [g, d ? d.puntaje : null, d ? celuPerfil(d) : null]; }))()`);
const pg = Object.fromEntries(r4.map((x) => [x[0], x]));
ok('por la GPU sola: PowerVR GE8320 patata, Mali-G52 medio o bajo, Mali-G57 MC2 medio o más; una GPU que no está, nada', pg['PowerVR Rogue GE8320'][2] === 'patata' && ['bajo', 'medio'].includes(pg['ANGLE (ARM, Mali-G52 MC2, OpenGL ES 3.2)'][2]) && ['medio', 'alto'].includes(pg['Mali-G57 MC2'][2]), r4);
// 5) la calidad con la memoria: un equipo de 2 GB no pasa de Bajo aunque su GPU dé para más; con 1 GB, Patata
const r5 = await ev(`(() => { const dm = Object.getOwnPropertyDescriptor(Navigator.prototype, 'deviceMemory'); const pon = (v) => Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => v });
  const out = []; for (const [pt, ram, dmv] of [[60, 2, 2], [60, 2, 4], [60, 1, 1], [38, 4, 2], [21, 4, 4], [16, 3, 2], [92, 6, 8]]) { pon(dmv); out.push([pt, ram, dmv, celuPerfil({ puntaje: pt, ram })]); }
  delete navigator.deviceMemory; return out; })()`);
const P5 = r5.map((x) => x[3]);
ok('calidad por puntaje y memoria (2 GB → hasta Bajo, 1 GB → Patata, el navegador que dice 2 en uno de 4 GB no lo baja)', JSON.stringify(P5) === JSON.stringify(['bajo', 'alto', 'patata', 'medio', 'bajo', 'patata', 'alto']), r5);
// 6) al abrir con ?celu=TECNO KI5k (Spark 10C, Unisoc T606) la calidad automática sale de la base y se ve en Ajustes
const r6 = await ev(`(() => { const d = CELU.det; if (typeof abrirAjustes === 'function') try { abrirAjustes(); } catch (e) {} const el = document.getElementById('aCelu'); return { det: d && { nom: d.nom, soc: d.soc, puntaje: d.puntaje, fuente: d.fuente }, base: GFX.base, gfx: PREFS.gfx, linea: el ? el.textContent : null }; })()`);
ok('al abrir el juego en un Tecno Spark 10C la calidad automática es Bajo (de la base) y Ajustes muestra el aparato', r6.det && r6.det.nom === 'Tecno Spark 10C' && r6.base === 'bajo', r6);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
