// Los celus del Discord (Galaxy A03 Core, Tab A7 Lite, Konka Indus N15, Fire de Amazon): que se reconozcan, que arranquen en
// Patata con el modo de procesador lento ya puesto, que Patata pueda bajar de 45 % sólo si frena la placa (y vuelva si no
// sirvió) y el contador de FPS detallado (tocándolo). Captura del contador en CARPETA.
// uso: node patata_res.mjs URL_HTML [CARPETA=/tmp/claude-0/patres]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/patres'] = process.argv; fs.mkdirSync(D, { recursive: true });
let ok = 0, mal = 0; const chk = (c, m) => { if (c) { ok++; console.log('OK ' + m); } else { mal++; console.log('FALLA ' + m); } };
const sep = HTML.includes('?') ? '&' : '?';
// 1) la detección de cada aparato (con ?celu=, como si el navegador diera ese modelo)
for (const [mod, nom, cal] of [['SM-A032F', 'Galaxy A03 Core', 'patata'], ['SM-T225', 'Tab A7 Lite', 'patata'], ['KONKA Indus N15', 'Indus N15', 'patata'], ['KFONWI', 'Fire HD 8 (2020)', 'patata'], ['KFTRWI', 'Fire HD 10 (2021)', 'bajo']]) {
  const { b, ev } = await abrir(HTML + sep + 'celu=' + encodeURIComponent(mod), true, null, async (pg) => { await pg.addInitScript(() => { window.__lentoPrueba = true; }); });
  const r = await ev(`({ nom: CELU.det && CELU.det.nom, base: GFX.base, chico: TIEMPO.cpuChico, lento: TIEMPO.lento })`);
  chk(r.nom && r.nom.includes(nom) && r.base === cal && (cal !== 'patata' || (r.chico && r.lento === 1)), `${mod} → ${r.nom} · ${r.base} · procesador chico ${r.chico} · lento ${r.lento}`);
  await b.close();
}
// 2) Patata frenada por la placa: baja de 45 % de a un paso, mira si sirvió; y si no sirvió, vuelve y no prueba más
{
  const { b, p, ev } = await abrir(HTML + sep + 'celu=SM-A032F&fpsdet', true, null, async (pg) => { await pg.addInitScript(() => { window.__ahorroPrueba = true; }); });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.fps = true; inicioMostrar(false); empezarPartida('Desert'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
  await ev(`(() => { cerrarPaneles(); JUG.yaw = 0.6; JUG.pitch = 0.05; DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); return 1; })()`);
  // (en esta compu sin placa —SwiftShader dibuja con el procesador, en otro proceso— el JavaScript del cuadro es poco y los
  // cuadros no llegan a 60: para el juego, «frena la placa», como en una PowerVR)
  const L = []; for (let k = 0; k < 14; k++) { await p.waitForTimeout(1000); L.push(await ev(`({ esc: +GFX.escala.toFixed(2), fps: Math.round(TIEMPO.fps), ms: +(TIEMPO.msProm || 0).toFixed(1), prueba: !!TIEMPO.patPrueba, inutil: !!TIEMPO.patInutil, cv: R.cv.width + 'x' + R.cv.height })`)); }
  console.log(L.map((x) => `${x.esc}${x.prueba ? '*' : ''}/${x.fps}fps/${x.ms}ms`).join('  '));
  const min = Math.min(...L.map((x) => x.esc));
  chk(L[0].esc <= 0.45 && min < 0.45 && min >= 0.34 - 1e-6, `Patata baja de 45 % (mínimo ${Math.round(min * 100)} %, nunca menos de 34 %)`);
  await p.screenshot({ path: D + '/contador_detallado.png' });
  const txt = await ev(`$('fps').textContent`); console.log('contador: ' + JSON.stringify(txt));
  chk(/fps · JS [\d.]+ ms · Auto patata \d+% \d+×\d+/.test(txt) && /Galaxy A03 Core/.test(txt), 'el contador detallado dice cuadros, JS, calidad, resolución y el aparato');
  // (no sirvió: se finge que antes de bajar daba muchos más cuadros)
  await ev(`(() => { GFX.escala = 0.45; redimensionar(); TIEMPO.patInutil = false; TIEMPO.patPrueba = { desde: 0.45, fps: 999, t: TIEMPO.t - 2.5 }; GFX.escala = 0.37; redimensionar(); return 1; })()`);
  await p.waitForTimeout(3500);
  const v = await ev(`({ esc: +GFX.escala.toFixed(2), inutil: !!TIEMPO.patInutil })`);
  await p.waitForTimeout(4000);
  const v2 = await ev(`({ esc: +GFX.escala.toFixed(2), inutil: !!TIEMPO.patInutil })`);
  chk(v.esc === 0.45 && v.inutil && v2.esc >= 0.45, `si bajar no sirvió vuelve a 45 % y no lo prueba más (${v.esc} → ${v2.esc})`);
  // tocar el contador: vuelve al simple
  await p.click('#fps'); await p.waitForTimeout(300);
  const t2 = await ev(`$('fps').textContent + '|' + PREFS.fpsDet`);
  chk(/^\d+ fps\|false$/.test(t2), 'tocándolo vuelve al contador simple (' + t2 + ')');
  await b.close();
}
console.log(`RESUMEN patata ${ok}/${ok + mal}`);
