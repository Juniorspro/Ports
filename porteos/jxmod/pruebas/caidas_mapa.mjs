// barrido de caídas en un mapa (por defecto gm_construct): en una grilla cada PASO m se busca el piso de choque desde
// arriba (todos los pisos encimados, hasta 4 por columna) y se suelta al jugador 1,2 m arriba de cada uno (el centro del jugador);
// anda si a los 0,8 s está parado en ese piso y no siguió cayendo. Además, en cada punto camina 1 s hacia adelante y no
// puede terminar más de 3 m debajo del piso más bajo de la columna (cayó a través del mapa).
// (CORRER=1: en vez de caminar 1 s, corre y salta 2 s girando)
// uso: node caidas_mapa.mjs URL_HTML [MAPA=RB_Construct] [PASO=12]
import { abrir } from './base.mjs';
const MAPA = process.argv[3] || 'RB_Construct', PASO = +(process.argv[4] || 12);
const { b, p, ev } = await abrir(process.argv[2], false);
await p.setViewportSize({ width: 320, height: 180 });
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('${MAPA}'); 1`);
await p.waitForTimeout(2500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 120000 });
const r = await ev(`(async () => {
  const esp = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 8000 ? ok() : setTimeout(f, 10)); f(); });
  // límites del mapa: los triángulos de choque
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y1 = -1e9; const T = MUNDO.T; for (let i = 0; i < MUNDO.nt * 9; i += 3) { x0 = Math.min(x0, T[i]); x1 = Math.max(x1, T[i]); y1 = Math.max(y1, T[i + 1]); z0 = Math.min(z0, T[i + 2]); z1 = Math.max(z1, T[i + 2]); }
  const pts = [];
  for (let x = x0 + ${PASO} / 2; x < x1; x += ${PASO}) for (let z = z0 + ${PASO} / 2; z < z1; z += ${PASO}) {
    let y = y1 + 5; const pisos = [];
    // (sólo pisos donde entra el jugador: el mismo piso a ±0,35 m; el borde de una pared de 5 cm no es un piso)
    const ancho = (yp) => [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]].every(([dx, dz]) => { const r = mundoRayo(v3(x + dx, yp + 0.5, z + dz), v3(0, -1, 0), 1); return r && Math.abs(yp + 0.5 - r.t - yp) < 0.15; });
    for (let k = 0; k < 4; k++) { const h = mundoRayo(v3(x, y, z), v3(0, -1, 0), 2000); if (!h) break; const yp = y - h.t; if (!h.caja && h.n && h.n.y > 0.7 && ancho(yp)) pisos.push(yp); y = yp - 2.2; }
    if (pisos.length) pts.push({ x, z, pisos, bajo: Math.min(...pisos) });
  }
  const malos = []; let probados = 0; const t0 = performance.now();
  for (const q of pts) for (const yp of q.pisos) {
    if (performance.now() - t0 > 480000) break;
    JUG.pos.set(q.x, yp + 1.2, q.z); JUG.vel.set(0, 0, 0); JUG.vida = 100; JUG.vivo = true; await esp(0.8); probados++;
    const dy = JUG.pos.y - yp, cae = JUG.vel.y < -3;   // (parado: el centro queda 0,95 m arriba del piso)
    if (dy < 0.4 || dy > 1.7 || cae) { malos.push({ x: +q.x.toFixed(1), z: +q.z.toFixed(1), piso: +yp.toFixed(2), y: +JUG.pos.y.toFixed(2), vy: +JUG.vel.y.toFixed(1), tipo: 'soltar' }); continue; }
    if (${process.env.CORRER ? 1 : 0}) { ENT.y = 1; ENT.correr = true; for (let k = 0; k < 4; k++) { ENT.saltar = true; await esp(0.25); ENT.saltar = false; await esp(0.25); JUG.yaw += 0.8; } ENT.y = 0; ENT.correr = false; await esp(0.5); }
    else { ENT.y = 1; await esp(1); ENT.y = 0; await esp(0.3); } if (JUG.pos.y < q.bajo - 3) malos.push({ x: +q.x.toFixed(1), z: +q.z.toFixed(1), piso: +yp.toFixed(2), y: +JUG.pos.y.toFixed(2), tipo: 'caminar' });
    JUG.yaw = (JUG.yaw || 0) + 1.7;
  }
  return { columnas: pts.length, probados, malos, lim: [x0, x1, z0, z1].map((v) => +v.toFixed(0)) }; })()`);
console.log(JSON.stringify({ columnas: r.columnas, probados: r.probados, lim: r.lim, malos: r.malos.length }));
for (const m of r.malos.slice(0, 40)) console.log('  ', JSON.stringify(m));
console.log(r.malos.length ? 'FALLAN ' + r.malos.length + '/' + r.probados : 'TODO BIEN ' + r.probados + '/' + r.probados);
await b.close();
