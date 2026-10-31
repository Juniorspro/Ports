// hace las miniaturas de los emotes de captura (la silueta en su pose más característica, emoMini en emotes.js) con el
// esqueleto del juego y las guarda en hypper/emotes/cmu/minis.json (armar.py las mete en el catálogo); además una hoja
// de muestra para mirarlas.
// uso: node emotes_minis.mjs URL_HTML SALIDA_JSON [HOJA_PNG]
import { abrir } from './base.mjs';
import fs from 'fs';
const { b, p, err, ev } = await abrir(process.argv[2]);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2000);
const r = await ev(`(async () => {
  const ids = CMU_CAT.items.map((x) => 'c:' + x[0]), out = {}; const t0 = performance.now();
  for (let vez = 0; vez < 3; vez++) for (let i = 0; i < ids.length; i += 40) await Promise.all(ids.slice(i, i + 40).filter((id) => !EMO.clips[id]).map((id) => emoCargar(id)));
  for (const id of ids) { const C = EMO.clips[id]; if (C) out[id.slice(2)] = emoMini(C); }
  return { out, ms: Math.round(performance.now() - t0) }; })()`);
fs.writeFileSync(process.argv[3], JSON.stringify(r.out));
console.log('miniaturas', Object.keys(r.out).length, 'tiempo', r.ms, 'ms', 'tamaño', fs.statSync(process.argv[3]).size);
if (process.argv[4]) {
  const muestra = await ev(`(() => { const L = CMU_CAT.items.filter((x, i) => i % 23 === 0).slice(0, 96); return L.map((x) => ({ n: x[1], s: emoMiniSVG(${JSON.stringify(r.out)}[x[0]], x[2]) })); })()`);
  await p.setContent(`<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(12,96px);gap:6px;padding:6px;font:10px sans-serif;color:#ddd">${muestra.map((m) => `<div style="width:96px">${m.s.replace('class="emoMini"', 'width="96" height="96"')}<div style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${m.n.replace(/</g, '')}</div></div>`).join('')}</body>`);
  await p.setViewportSize({ width: 1240, height: 940 }); await p.screenshot({ path: process.argv[4] });
}
console.log('errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 3));
await b.close();
