// Los props de los mapas con la pose con que los muestra GMod (Discord: «Liminal Hotel: camas fuera de lugar»). Las 133
// camas de gm_liminal_hotel (models/house furniture/bed1.mdl) tienen la raíz girada 90° en su secuencia «idle»: con la pose
// de enlace del .vvd quedaban atravesando la pared de cada habitación y asomando por la fachada.
//  1. la cama toma la pose de la secuencia (la caja de su malla calza con la que guarda el .mdl: 124 × 94 unidades);
//  2. ninguna cama atraviesa una pared: desde donde está puesta, la pared en la dirección en que se extiende queda a lo
//     sumo 20 cm antes de su punta (la cabecera apoyada contra la pared, como la puso el mapa); antes asomaban ~80 cm;
//  3. las puertas y los props de siempre no cambian (gm_hotel: las 8 puertas de modelo con su caja, como antes);
//  4. sin errores de JS.
// uso: node props_pose.mjs URL_HTML URL_CARPETA_GMA [FOTO.png]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP, FOTO] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
async function mapa(id, nom) {
  await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b); await A.listo; return 1; })()`);
  await ev(`empezarPartida(${JSON.stringify(nom)}); 1`);
  await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), nom, { timeout: 300000 }).catch(() => {});
  await p.waitForTimeout(3000); await ev(`cerrarPaneles && cerrarPaneles(); 1`);
}
await mapa('2556466049', 'WS_gm_liminal_hotel');
const c = await ev(`(() => { const nom = gmPrefab('gm:models/house furniture/bed1.mdl'), pf = DATA.pf[DATA.pfPorNombre[nom]][0], d = DATA.ms[pf.m];
  const tam = [d.sc[0], d.sc[1], d.sc[2]].map((x) => +(x / GS).toFixed(0));
  const esq = []; for (let i = 0; i < 8; i++) esq.push(v3(d.mn[0] + (i & 1 ? d.sc[0] : 0), d.mn[1] + (i & 2 ? d.sc[1] : 0), d.mn[2] + (i & 4 ? d.sc[2] : 0)));
  const L = [];
  for (const a of DATA.esc[MUNDO.nombre]) for (const n of a) if (n.n === nom) {
    const q = new Quat(n.r[0], n.r[1], n.r[2], n.r[3]), p0 = v3(n.p[0], n.p[1], n.p[2]);
    const cen = vadd(p0, q.rot(v3(d.mn[0] + d.sc[0] / 2, d.mn[1] + d.sc[1] / 2, d.mn[2] + d.sc[2] / 2))), dir = vsub(cen, p0); dir.y = 0; const dl = Math.hypot(dir.x, dir.z); dir.x /= dl; dir.z /= dl;
    let punta = 0; for (const e of esq) { const w = vsub(vadd(p0, q.rot(e)), p0); punta = Math.max(punta, w.x * dir.x + w.z * dir.z); }
    const h = mundoRayo(vadd(p0, v3(0, 0.3, 0)), dir, 6); L.push({ pared: h ? h.t : 9, punta });
  }
  const cruzan = L.filter((x) => x.pared < x.punta - 0.2);
  return { tam, n: L.length, cruzan: cruzan.length, peor: +Math.max(...L.map((x) => x.punta - x.pared)).toFixed(2), puntaMax: +Math.max(...L.map((x) => x.punta)).toFixed(2) }; })()`);
ok('1. la cama toma la pose de su secuencia (124 × 94 unidades, como la caja del .mdl)', c.tam[2] >= 120 && c.tam[2] <= 128 && c.tam[0] >= 90 && c.tam[0] <= 98, c);
ok('2. ninguna de las camas atraviesa una pared', c.n >= 130 && c.cruzan === 0, c);
if (FOTO) { await ev(`JUG.pos.set(16.86, 19.5, 13.29); JUG.vel.set(0, 0, 0); JUG.yaw = Math.PI; JUG.pitch = -0.15; 1`); await p.waitForTimeout(1500); fs.writeFileSync(FOTO, await p.screenshot()); }
await mapa('740628279', 'WS_gm_hotel');
const c3 = await ev(`({ modelo: PUERTAS.l.filter((D) => D.P.cl === 'prop_door_rotating').length, conCaja: PUERTAS.l.filter((D) => D.P.cl === 'prop_door_rotating' && D.b).length })`);
ok('3. gm_hotel sigue igual: las 8 puertas de modelo, con caja', c3.modelo === 8 && c3.conCaja === 8, c3);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado/i.test(x));
ok('4. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
