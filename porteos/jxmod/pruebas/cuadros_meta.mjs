// los cuadros por calidad: 120 en Patata, Bajo y Medio; 60 parejos en Alto y Ultra (pedido: «60 fijos en Alto y Ultra, 120
// en Bajo, Medio y Patata»). La compu dibuja con SwiftShader (no llega a 120 de verdad): el tope se prueba con pantallas
// simuladas, llamando a la misma función que usa el cuadro.
//  1. con la meta en 60: pantalla de 120 Hz → 60 cuadros por segundo, todos a 16,7 ms (±0,5); 144 Hz → 72 parejos; 60 Hz → 60;
//     y si dibujar tarda 12 ms en una de 120 Hz, igual 60 (no cae a 40)
//  2. con la meta en 120: pantalla de 120 Hz → 120; de 60 Hz → 60 (lo que dé)
//  3. cada calidad con su meta (Patata/Bajo/Medio 120, Alto/Ultra 60) y en la app se le pide a Android esa frecuencia
//  4. Ultra usa las sombras medias (2048, sin PCSS), como Alto
//  5. sin errores
// uso: node cuadros_meta.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
await p.waitForTimeout(500);
// (simulación: llamadas en cada refresco; si se dibuja, la próxima llega en el primer refresco después de terminar)
await ev(`(() => { window.__sim = (hz, fps, dibMs, seg) => { const T0 = Object.assign({}, TIEMPO), f0 = GFX.fps; GFX.fps = fps; TIEMPO.rafUlt = 0; TIEMPO.rafMs = 0; TIEMPO.ultDib = 0;
  const per = 1000 / hz, dib = []; let t = 1000;
  while (t < 1000 + seg * 1000) { const salta = cuadroSalta(t, true); if (!salta) { dib.push(t); t = Math.ceil((t + dibMs) / per - 1e-6) * per; if (t <= dib[dib.length - 1]) t += per; } else t += per; }
  GFX.fps = f0; Object.assign(TIEMPO, T0);
  const iv = dib.slice(30).map((x, i, a) => i ? x - a[i - 1] : null).filter((x) => x !== null);
  return { porSeg: +(dib.length / seg).toFixed(1), ivMin: +Math.min(...iv).toFixed(2), ivMax: +Math.max(...iv).toFixed(2) }; }; return 1; })()`);
const s60_120 = await ev(`__sim(120, 60, 4, 4)`), s60_144 = await ev(`__sim(144, 60, 4, 4)`), s60_60 = await ev(`__sim(60, 60, 4, 4)`), s60_120lento = await ev(`__sim(120, 60, 12, 4)`);
ok('1. meta 60: 120 Hz → 60 parejos (16,7 ±0,5 ms), 144 Hz → 72 parejos, 60 Hz → 60, y dibujando en 12 ms sigue en 60',
  Math.abs(s60_120.porSeg - 60) <= 1 && s60_120.ivMin >= 16.1 && s60_120.ivMax <= 17.2 && Math.abs(s60_144.porSeg - 72) <= 1 && s60_144.ivMax - s60_144.ivMin < 0.5
  && Math.abs(s60_60.porSeg - 60) <= 1 && Math.abs(s60_120lento.porSeg - 60) <= 1, { s60_120, s60_144, s60_60, s60_120lento });
const s120_120 = await ev(`__sim(120, 120, 4, 4)`), s120_60 = await ev(`__sim(60, 120, 4, 4)`);
ok('2. meta 120: 120 Hz → 120; 60 Hz → 60', Math.abs(s120_120.porSeg - 120) <= 1 && Math.abs(s120_60.porSeg - 60) <= 1, { s120_120, s120_60 });
const cal = await ev(`(() => { const pedidos = []; window.JXNativo = Object.assign(window.JXNativo || {}, { frecuencia: (hz) => pedidos.push(hz) }); const o = {};
  for (const c of ['patata', 'bajo', 'medio', 'alto', 'ultra']) { PREFS.gfx = c; aplicarGfx(); o[c] = { fps: GFX.fps, pedido: pedidos[pedidos.length - 1], sombra: GFX.sombra, smTam: GFX.smTam, pcss: GFX.pcss, sDist: GFX.sDist }; }
  return o; })()`);
ok('3. cada calidad con su meta y se le pide a Android esa frecuencia', ['patata', 'bajo', 'medio'].every((c) => cal[c].fps === 120 && cal[c].pedido === 120) && ['alto', 'ultra'].every((c) => cal[c].fps === 60 && cal[c].pedido === 60), cal);
ok('4. Ultra con las sombras medias (como Alto: 2048, sin PCSS)', cal.ultra.sombra === cal.alto.sombra && cal.ultra.smTam === 2048 && !cal.ultra.pcss && cal.ultra.sDist === cal.alto.sDist, { ultra: cal.ultra, alto: cal.alto });
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('5. sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
