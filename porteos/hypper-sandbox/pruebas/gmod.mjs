// los mapas de Garry's Mod (gm_construct, gm_flatgrass): recorrido con la cámara del juego (aparición, vistas por el
// mapa y de arriba) y medidas: cuántos puntos tienen piso abajo, si el cielo de caja cargó, errores
// uso: node gmod.mjs HTML CARPETA [mapa] [calidad]
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/', MAPA = process.argv[4] || 'RB_Construct', CAL = process.argv[5] || 'alto';
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = '${CAL}'; aplicarGfx(); inicioMostrar(false); empezarPartida('${MAPA}'); 1`);
await p.waitForTimeout(6000);
const cuadros = async (n) => { const m0 = await ev(`R.marca`); for (let i = 0; i < 80 && (await ev(`R.marca`)) < m0 + n; i++) await p.waitForTimeout(200); };
const info = await ev(`({ lo: [MUNDO.lo.x, MUNDO.lo.y, MUNDO.lo.z].map(x => +x.toFixed(1)), hi: [MUNDO.hi.x, MUNDO.hi.y, MUNDO.hi.z].map(x => +x.toFixed(1)), spawns: MUNDO.spawns.length, tris: MUNDO.nt, luces: MUNDO.luces.length,
  cubo: !!(R.cubo && R.cubo.t), lejos: vistaLejos(), pos: [JUG.pos.x, JUG.pos.y, JUG.pos.z].map(x => +x.toFixed(2)), niebla: R.niebla })`);
console.log(JSON.stringify(info));
await ev(`$('hud').classList.add('oc'); document.querySelectorAll('.aviso,#aviso').forEach(x => x.style.display = 'none'); DIA.hora = 12; DIA.ciclo = false; DIA.aplicada = -1; 1`);
// la aparición, mirando a los cuatro lados
const s0 = info.pos;
for (let k = 0; k < 4; k++) {
  await ev(`JUG.noclip = true; JUG.pos.set(${s0[0]}, ${s0[1]}, ${s0[2]}); JUG.vel.set(0, 0, 0); JUG.yaw = ${k} * Math.PI / 2; JUG.pitch = 0.02; 1`);
  await cuadros(5); await p.screenshot({ path: SALIDA + MAPA + '_aparicion' + k + '.jpg', type: 'jpeg', quality: 82 });
}
// una grilla de puntos con piso: a la altura de los ojos, mirando hacia el centro del mapa
const pts = await ev(`(() => { const r = [], lo = MUNDO.lo, hi = MUNDO.hi, cx = (lo.x + hi.x) / 2, cz = (lo.z + hi.z) / 2;
  for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) {
    const x = lo.x + (hi.x - lo.x) * i / 6, z = lo.z + (hi.z - lo.z) * j / 6, h = mundoRayo(v3(x, hi.y - 1, z), v3(0, -1, 0), hi.y - lo.y + 2);
    if (h) r.push([+x.toFixed(2), +(hi.y - 1 - h.t + 1.7).toFixed(2), +z.toFixed(2), Math.atan2(cx - x, cz - z)]);
  } return r; })()`);
console.log('puntos con piso', pts.length, 'de 25');
for (const [i, [x, y, z, yaw]] of pts.entries()) {
  if (i % 3) continue;
  await ev(`JUG.pos.set(${x}, ${y}, ${z}); JUG.vel.set(0, 0, 0); JUG.yaw = ${yaw}; JUG.pitch = 0.05; 1`);
  await cuadros(5); await p.screenshot({ path: SALIDA + MAPA + '_vista' + i + '.jpg', type: 'jpeg', quality: 82 });
}
// de arriba
await ev(`const lo = MUNDO.lo, hi = MUNDO.hi; JUG.pos.set((lo.x + hi.x) / 2, Math.min(hi.y, lo.y + 60) + 40, lo.z - 10); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0.75; 1`);
await cuadros(6); await p.screenshot({ path: SALIDA + MAPA + '_arriba.jpg', type: 'jpeg', quality: 82 });
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
