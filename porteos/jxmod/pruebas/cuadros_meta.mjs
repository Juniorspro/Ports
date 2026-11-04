// los cuadros por calidad (pedido: «que Alto y Ultra también lleguen a 120, sin tope»). La compu dibuja con SwiftShader
// (no llega a 120 de verdad): se prueba con pantallas simuladas, llamando a la misma función que usa el cuadro.
//  1. ninguna calidad tiene tope: con la pantalla a 120 Hz se dibujan 120 por segundo, a 144 Hz 144 (todas las calidades)
//  2. en la app se le pide a Android la frecuencia más alta en todas las calidades
//  3. la resolución dinámica apunta a 120 en Patata, Bajo y Medio y a 60 en Alto y Ultra (no pierde nitidez por perseguir 120)
//  4. Ultra usa las sombras medias (2048, sin PCSS), como Alto
//  5. sin errores
// uso: node cuadros_meta.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
await p.waitForTimeout(500);
// (simulación: llamadas en cada refresco; si se dibuja, la próxima llega en el primer refresco después de terminar)
await ev(`(() => { window.__sim = (hz, dibMs, seg) => { const T0 = Object.assign({}, TIEMPO); TIEMPO.rafUlt = 0; TIEMPO.rafMs = 0; TIEMPO.ultDib = 0;
  const per = 1000 / hz; let t = 1000, n = 0;
  while (t < 1000 + seg * 1000) { if (!cuadroSalta(t, true)) { n++; t = Math.max(t + per, Math.ceil((t + dibMs) / per - 1e-6) * per); } else t += per; }
  Object.assign(TIEMPO, T0); return +(n / seg).toFixed(1); }; return 1; })()`);
const cal = await ev(`(() => { const pedidos = []; window.JXNativo = Object.assign(window.JXNativo || {}, { frecuencia: (hz) => pedidos.push(hz) }); const o = {};
  for (const c of ['patata', 'bajo', 'medio', 'alto', 'ultra']) { PREFS.gfx = c; aplicarGfx(); o[c] = { a120: __sim(120, 4, 3), a144: __sim(144, 3, 3), pedido: pedidos[pedidos.length - 1], meta: GFX.fps, sombra: GFX.sombra, smTam: GFX.smTam, pcss: GFX.pcss, sDist: GFX.sDist }; }
  return o; })()`);
const C = Object.keys(cal);
ok('1. sin tope: 120 Hz → 120 y 144 Hz → 144 en todas las calidades', C.every((c) => Math.abs(cal[c].a120 - 120) <= 1 && Math.abs(cal[c].a144 - 144) <= 1), C.map((c) => [c, cal[c].a120, cal[c].a144]));
ok('2. a Android se le pide la frecuencia más alta en todas', C.every((c) => cal[c].pedido >= 120), C.map((c) => [c, cal[c].pedido]));
ok('3. la resolución dinámica apunta a 120 en Patata/Bajo/Medio y a 60 en Alto/Ultra', ['patata', 'bajo', 'medio'].every((c) => cal[c].meta === 120) && ['alto', 'ultra'].every((c) => cal[c].meta === 60), C.map((c) => [c, cal[c].meta]));
ok('4. Ultra con las sombras medias (como Alto: 2048, sin PCSS)', cal.ultra.sombra === cal.alto.sombra && cal.ultra.smTam === 2048 && !cal.ultra.pcss && cal.ultra.sDist === cal.alto.sDist, { ultra: cal.ultra, alto: cal.alto });
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('5. sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
