// choques de los mapas de GMod: el jugador cae sobre el piso en una grilla de puntos y desde cada aparición camina en
// ocho direcciones; nadie tiene que atravesar el piso ni salirse del mapa. Y el costo de dibujo (pedidos y triángulos)
// uso: node gmod_choques.mjs HTML [mapa] [calidad]
import { abrir } from './base.mjs';
const HTML = process.argv[2], MAPA = process.argv[3] || 'RB_Construct', CAL = process.argv[4] || 'alto';
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = '${CAL}'; aplicarGfx(); inicioMostrar(false); empezarPartida('${MAPA}'); 1`);
await p.waitForTimeout(5000);
const espera = (ms) => p.waitForTimeout(ms);
// (espera tiempo del juego, no del reloj: con swiftshader los cuadros son lentos)
const juego = async (s) => { const t0 = await ev(`TIEMPO.t`); for (let i = 0; i < 400 && (await ev(`TIEMPO.t`)) < t0 + s; i++) await espera(100); };
const nan = async () => ev(`[CAM.pos.x, CAM.pos.y, CAM.pos.z, JUG.pos.x, JUG.pos.y, JUG.vel.x].some((v) => !isFinite(v))`);
let nans = 0;
// 1) caer: desde 1,5 m sobre el piso de cada punto de una grilla de 7×7
const pts = await ev(`(() => { const r = [], lo = MUNDO.lo, hi = MUNDO.hi;
  for (let i = 1; i < 8; i++) for (let j = 1; j < 8; j++) {
    const x = lo.x + (hi.x - lo.x) * i / 8, z = lo.z + (hi.z - lo.z) * j / 8, h = mundoRayo(v3(x, Math.min(hi.y, 60), z), v3(0, -1, 0), 200);
    if (h && h.n && h.n.y > 0.7) r.push([+x.toFixed(2), +(Math.min(hi.y, 60) - h.t).toFixed(2), +z.toFixed(2)]);
  } return r; })()`);
// la altura de parado: en la primera aparición, después de 2 s de juego
await ev(`JUG.noclip = false; const sp = MUNDO.spawns[0]; JUG.pos.set(sp.x, sp.y + 0.5, sp.z); JUG.vel.set(0, 0, 0); 1`); await juego(2);
const alto0 = await ev(`(() => { const h = mundoRayo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), v3(0, -1, 0), 10); return h ? h.t - 0.5 : null; })()`);   // (lo alto del centro sobre el piso)
let malos = [], alturas = [];
for (const [x, y, z] of pts) {
  await ev(`JUG.noclip = false; JUG.pos.set(${x}, ${y} + 1.5, ${z}); JUG.vel.set(0, 0, 0); 1`); await juego(1.6);
  const r = await ev(`[JUG.pos.x, JUG.pos.y, JUG.pos.z]`); if (await nan()) nans++;
  const sobre = r[1] - y; alturas.push(+sobre.toFixed(2));
  if (Math.abs(sobre - alto0) > 0.25 || Math.hypot(r[0] - x, r[2] - z) > 1.5) malos.push({ en: [x, y, z], quedo: r.map((v) => +v.toFixed(2)), sobre: +sobre.toFixed(2) });
}
console.log('caídas:', pts.length, 'puntos · parado a', alto0 && +alto0.toFixed(2), 'm del piso · alturas', JSON.stringify(alturas), '· mal', malos.length, JSON.stringify(malos.slice(0, 6)));
// 2) caminar 5 s desde cada aparición en 8 direcciones: ni atravesar el piso ni salir del mapa
const ns = await ev(`MUNDO.spawns.length`); let fuera = [], max = 0;
for (let s = 0; s < Math.min(ns, 6); s++) {
  for (let k = 0; k < 8; k++) {
    await ev(`JUG.noclip = false; const sp = MUNDO.spawns[${s}]; JUG.pos.set(sp.x, sp.y + 1, sp.z); JUG.vel.set(0, 0, 0); JUG.yaw = ${k} * Math.PI / 4; ENT.teclas.add('KeyW'); ENT.teclas.add('ShiftLeft'); window.__tr = []; 1`);
    for (let i = 0; i < 10; i++) { await juego(0.5); const q = await ev(`[JUG.pos.x, JUG.pos.y, JUG.pos.z]`); await ev(`window.__tr.push(${JSON.stringify(q)}); 1`); if (await nan()) nans++; }
    const tr = await ev(`(ENT.teclas.delete('KeyW'), ENT.teclas.delete('ShiftLeft'), window.__tr)`);
    const lo = await ev(`[MUNDO.lo.x, MUNDO.lo.y, MUNDO.lo.z, MUNDO.hi.x, MUNDO.hi.z]`);
    const d = Math.hypot(tr[tr.length - 1][0] - tr[0][0], tr[tr.length - 1][2] - tr[0][2]); max = Math.max(max, d);
    for (const q of tr) if (q[1] < lo[1] - 0.5 || q[0] < lo[0] - 1 || q[0] > lo[3] + 1 || q[2] < lo[2] - 1 || q[2] > lo[4] + 1) { fuera.push({ s, k, q: q.map((v) => +v.toFixed(1)) }); break; }
  }
}
console.log('caminatas:', Math.min(ns, 6) * 8, '· se salieron', fuera.length, JSON.stringify(fuera.slice(0, 5)), '· lo más lejos que llegó', +max.toFixed(1), 'm');
// 3) costo de dibujo desde la aparición mirando a los cuatro lados
const costo = [];
for (let k = 0; k < 4; k++) {
  await ev(`JUG.noclip = true; const sp = MUNDO.spawns[0]; JUG.pos.set(sp.x, sp.y + 1.7, sp.z); JUG.vel.set(0, 0, 0); JUG.yaw = ${k} * Math.PI / 2; JUG.pitch = 0; 1`); await espera(900);
  costo.push(await ev(`[R.dibujadas, Math.round(R.tris)]`));
}
console.log('dibujo (pedidos, triángulos) a los 4 lados:', JSON.stringify(costo));
console.log('cámara o jugador con NaN:', nans);
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
