// la luz de noche en la pizzería: en cada calidad, la oficina y el pasillo oeste, con y sin linterna (fotos para medir con
// noche_luz.py: luminancia del centro, donde apunta la linterna, y de toda la imagen)
// uso: node noche_luz.mjs HTML CARPETA [calidades separadas por coma]
import { abrir } from './base.mjs';
const HTML = process.argv[2], S = (process.argv[3] || '.') + '/', CALS = (process.argv[4] || 'patata,bajo,medio,alto').split(',');
const LUGARES = { oficina: [-23.6, 1.62, 0, Math.PI / 2, 0.08], pasillo: [-17.5, 1.62, -3.2, Math.PI / 2, 0.06], comedor: [-3, 1.62, 1.5, Math.PI / 2, 0.02] };
for (const cal of CALS) {
  const { b, p, err, ev } = await abrir(HTML);
  await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = '${cal}'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Pizzeria'); 1`);
  await p.waitForTimeout(3000);
  await ev(`nocheEmpezarNoche(1); for (let i = 0; i < 100; i++) { TIEMPO.t += 0.05; nochePaso(0.05); } NOC.quieta = true; 1`);
  await p.waitForTimeout(5000); await p.screenshot({ path: S + 'luz_calentar.png' });   // (los primeros cuadros salen negros: compilando)
  for (const [lugar, [x, y, z, yaw, pitch]] of Object.entries(LUGARES)) {
    for (const lin of [false, true]) {
      await ev(`JUG.noclip = true; JUG.pos.set(${x}, ${y} + DATA.fn.salas.oficina.F[1] - 0.4, ${z}); JUG.vel.set(0, 0, 0); JUG.yaw = ${yaw}; JUG.pitch = ${pitch}; NOC.linterna = ${lin}; 1`);
      const m0 = await ev(`R.marca`); for (let i = 0; i < 40 && (await ev(`R.marca`)) < m0 + 3; i++) await p.waitForTimeout(250);   // (3 cuadros dibujados en el lugar nuevo)
      await p.screenshot({ path: S + `luz_${cal}_${lugar}_${lin ? 'si' : 'no'}.png` });
    }
  }
  console.log(cal, 'luces especiales:', await ev(`JSON.stringify({gfx: GFX.nombre, nEsp: R.nEsp, nLuces: R.nLuces, luz: GFX.luz, nluz: GFX.nluz, amb: R.ambS})`), 'errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 3).join(' | ') || 'ninguno');
  await b.close();
}
