// la pizzería: recorrido con la linterna (salas, techos, texturas, muebles) y las 11 cámaras de seguridad, para mirar
// uso: node pizzeria.mjs HTML CARPETA [calidad]
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/', CAL = process.argv[4] || 'alto';
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = '${CAL}'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Pizzeria'); 1`);
await p.waitForTimeout(3000);
await ev(`nocheEmpezarNoche(1); for (let i = 0; i < 100; i++) { TIEMPO.t += 0.05; nochePaso(0.05); } NOC.quieta = true; NOC.linterna = true; 1`);
await p.waitForTimeout(4000);
const cuadros = async (n) => { const m0 = await ev(`R.marca`); for (let i = 0; i < 60 && (await ev(`R.marca`)) < m0 + n; i++) await p.waitForTimeout(200); };
// [nombre, x, z, yaw, pitch] (a la altura de los ojos sobre el piso de ahí)
const L = [['oficina', -23.8, 0, Math.PI / 2, 0.15], ['oficina_techo', -22.6, 0, Math.PI / 2, -0.9], ['comedor', -2, 0, Math.PI / 2, 0.05], ['comedor_techo', 0, 2, Math.PI / 2, -0.7],
  ['escenario', 4, 0.2, Math.PI / 2, 0.0], ['pirata', -1.5, -6, Math.PI, 0.05], ['atras', 4.2, -12, Math.PI / 2, 0.1], ['oeste', -6, -3.2, -Math.PI / 2, 0.05], ['armario', -11.4, -6.4, Math.PI, 0.15],
  ['este', -6, 3.4, -Math.PI / 2, 0.05], ['cocina', -9.5, 9.5, 0, 0.15], ['cocina2', -9.5, 15.5, Math.PI, 0.1], ['banos', 1.5, 14, 0, 0.1], ['cuarto_atras', -21.9, -7.2, Math.PI, 0.25]];
for (const [nom, x, z, yaw, pitch] of L) {
  await ev(`JUG.noclip = true; const h = mundoRayo(v3(${x}, 2.3, ${z}), v3(0, -1, 0), 4), y = h ? 2.3 - h.t : 0.4; JUG.pos.set(${x}, y + 1.0, ${z}); JUG.vel.set(0, 0, 0); JUG.yaw = ${yaw}; JUG.pitch = ${pitch}; 1`);
  await cuadros(4); await p.screenshot({ path: SALIDA + 'pz_' + nom + '.png' });
}
await ev(`NOC.linterna = false; UI.abierto = null; nocheTablet(); 1`);
for (let i = 0; i < 11; i++) { await ev(`nocheCamElegir(${i}); NOC.ruidoT = 0; 1`); await cuadros(4); await p.screenshot({ path: SALIDA + 'pz_cam' + i + '.png' }); }
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
