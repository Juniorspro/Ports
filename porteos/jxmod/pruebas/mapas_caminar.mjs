// los 8 mapas propios (los que reemplazan a los de Hyper Sandbox, herramientas/mapas_hs.py): se aparece parado en el piso,
// y caminando y corriendo 4 s en cada una de 4 direcciones no se cae por ningún agujero, no queda trabado adentro de nada
// y no aparece NaN. Uso: node pruebas/mapas_caminar.mjs URL_HTML [mapa,mapa...]
import { abrir } from './base.mjs';
const { b, p, ev } = await abrir(process.argv[2], false);
const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 160)));
const mapas = (process.argv[3] || 'FlatGrass,Desert,DesertV2,City,Base,BaseV2,Mars,Space').split(',');
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; 1`);
let mal = 0;
for (const m of mapas) {
  await ev(`(() => { inicioMostrar(false); empezarPartida('${m}'); return 1; })()`);
  await p.waitForFunction((mm) => window.__ev(`JUEGO.estado === 'juego' && MUNDO.nombre === '${mm}' && !!JUG.suelo`), m, { timeout: 180000 });
  await ev(`cerrarPaneles(); 1`);
  const res = [];
  for (let k = 0; k < 4; k++) {
    const r = await ev(`(() => { const s = MUNDO.spawns[0]; JUG.pos.set(s.x, s.y, s.z); JUG.vel.set(0, 0, 0); JUG.yaw = ${k} * Math.PI / 2 + 0.3; ENT.teclas.add('KeyW'); ENT.teclas.add('ShiftLeft'); window.__p0 = JUG.pos.clone(); window.__t0 = TIEMPO.t; return 1; })()`);
    await p.waitForFunction(() => window.__ev(`TIEMPO.t - __t0 > 4`), null, { timeout: 60000 });
    res.push(await ev(`(() => { ENT.teclas.delete('KeyW'); ENT.teclas.delete('ShiftLeft'); const q = JUG.pos; return [+q.distTo(__p0).toFixed(1), +q.y.toFixed(2), !!JUG.suelo, isFinite(q.x + q.y + q.z)]; })()`));
  }
  const lo = await ev(`MUNDO.lo ? MUNDO.lo.y : -1e9`);
  const bien = res.every(([d, y, s, f]) => f && y > lo + 2 && y > -20 && d > 3);
  if (!bien) mal++;
  console.log((bien ? 'OK   ' : 'FALLA'), m, JSON.stringify(res));
}
console.log(err.length ? 'errores ' + JSON.stringify(err.slice(0, 4)) : 'sin errores');
console.log(mal || err.length ? 'HAY FALLAS' : 'TODO BIEN', mapas.length - mal + '/' + mapas.length);
await b.close();
