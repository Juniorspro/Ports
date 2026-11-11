// la luz de noche en la pizzería: en cada calidad, la oficina y el pasillo oeste, con y sin linterna (fotos para medir con
// noche_luz.py: luminancia del centro, donde apunta la linterna, y de toda la imagen)
// uso: node noche_luz.mjs HTML CARPETA [calidades separadas por coma]
import { abrir } from './base.mjs';
const HTML = process.argv[2], S = (process.argv[3] || '.') + '/', CALS = (process.argv[4] || 'patata,bajo,medio,alto').split(',');
for (const cal of CALS) {
  const { b, p, err, ev } = await abrir(HTML);
  await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = '${cal}'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Pizzeria'); 1`);
  await p.waitForTimeout(3000);
  await ev(`nocheEmpezarNoche(1); for (let i = 0; i < 100; i++) { TIEMPO.t += 0.05; nochePaso(0.05); } NOC.quieta = true; 1`);
  await p.waitForTimeout(5000); await p.screenshot({ path: S + 'luz_calentar.png' });   // (los primeros cuadros salen negros: compilando)
  // (los lugares salen del mapa: la oficina mirando al escritorio, el pasillo oeste mirando hacia la esquina y el comedor
  // mirando al escenario; [x, altura de los ojos sobre el piso, z, yaw, pitch])
  const LUGARES = JSON.parse(await ev(`(() => { const O = DATA.fn.oficina, S = DATA.fn.salas, a = (p, q) => Math.atan2(q[0] - p[0], q[2] - p[2]);
    return JSON.stringify({ oficina: [O.c[0], 1.62, O.c[2], O.yaw, 0.08], pasillo: [S.oeste.B[0], 1.62, S.oeste.B[2], a(S.oeste.B, S.esqO.B), 0.06], comedor: [S.comedor.B[0], 1.62, S.comedor.B[2], a(S.comedor.B, S.escenario.F), 0.02] }); })()`));
  for (const [lugar, [x, y, z, yaw, pitch]] of Object.entries(LUGARES)) {
    for (const lin of [false, true]) {
      await ev(`JUG.noclip = true; const h = mundoRayo(v3(${x}, 2.3, ${z}), v3(0, -1, 0), 4); JUG.pos.set(${x}, (h ? 2.3 - h.t : 0) + ${y} - 0.62, ${z}); JUG.vel.set(0, 0, 0); JUG.yaw = ${yaw}; JUG.pitch = ${pitch}; NOC.linterna = ${lin}; 1`);
      const m0 = await ev(`R.marca`); for (let i = 0; i < 40 && (await ev(`R.marca`)) < m0 + 3; i++) await p.waitForTimeout(250);   // (3 cuadros dibujados en el lugar nuevo)
      await p.screenshot({ path: S + `luz_${cal}_${lugar}_${lin ? 'si' : 'no'}.png` });
    }
  }
  console.log(cal, 'luces especiales:', await ev(`JSON.stringify({gfx: GFX.nombre, nEsp: R.nEsp, nLuces: R.nLuces, luz: GFX.luz, nluz: GFX.nluz, amb: R.ambS})`), 'errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 3).join(' | ') || 'ninguno');
  await b.close();
}
