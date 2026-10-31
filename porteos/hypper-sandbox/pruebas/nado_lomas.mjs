// gm_construct: parado en una loma de pasto (pendientes de 18° a 38°) sin tocar nada no se resbala; caminando sube y baja
// la loma; nadando con la cámara un poco hacia abajo (hasta 20°, como queda en el celular) se nada por la superficie con
// la cara afuera; más inclinada (40°) se bucea; sin errores.
// uso: node nado_lomas.mjs URL_HTML
import { abrir } from './base.mjs';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`MUNDO.nombre === 'RB_Construct'`), null, { timeout: 60000 }); await p.waitForTimeout(2500);
const E0 = `{ x: 0, y: 0, saltar: false, agachar: false, correr: false }`;
const lomas = await ev(`(() => { const v = AGUA.vols[0], out = []; let s = 7;
  const az = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 6000 && out.length < 12; k++) { const x = v.cx + (az() - 0.5) * 140, z = v.cz + (az() - 0.5) * 140, h = mundoRayo(v3(x, 200, z), v3(0, -1, 0), 400);
    if (!h || h.n.y < 0.78 || h.n.y > 0.95 || 200 - h.t < v.y1 + 0.5) continue; out.push([x, 200 - h.t, z, h.n.y]); }
  return out.map(([x, y, z, ny]) => { JUG.pos.set(x, y + 0.96, z); JUG.vel.set(0, 0, 0); JUG.suelo = true;
    for (let i = 0; i < 30; i++) jugadorPaso(1 / 60, ${E0}); const a = JUG.pos.clone();
    for (let i = 0; i < 300; i++) jugadorPaso(1 / 60, ${E0});
    return { grados: Math.round(Math.acos(ny) * 180 / Math.PI), desliz: +Math.hypot(JUG.pos.x - a.x, JUG.pos.z - a.z).toFixed(3), suelo: JUG.suelo }; }); })()`);
ok('parado en lomas de 18-38° sin tocar nada: no se resbala (< 1 cm en 5 s)', lomas.length >= 8 && lomas.every((l) => l.desliz < 0.01 && l.suelo), lomas);
const sube = await ev(`(() => { const v = AGUA.vols[0]; let mejor = null; let s = 3; const az = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 6000 && !mejor; k++) { const x = v.cx + (az() - 0.5) * 140, z = v.cz + (az() - 0.5) * 140, h = mundoRayo(v3(x, 200, z), v3(0, -1, 0), 400);
    if (h && h.n.y > 0.8 && h.n.y < 0.93 && 200 - h.t > v.y1 + 1) mejor = [x, 200 - h.t, z, h.n]; }
  const [x, y, z, n] = mejor, arriba = Math.atan2(-n.x, -n.z);   // (mirando loma arriba)
  JUG.pos.set(x, y + 0.96, z); JUG.vel.set(0, 0, 0); JUG.yaw = arriba; JUG.suelo = true; const y0 = JUG.pos.y;
  for (let i = 0; i < 90; i++) jugadorPaso(1 / 60, { x: 0, y: 1, saltar: false, agachar: false, correr: false });
  const subio = JUG.pos.y - y0; JUG.yaw = arriba + Math.PI; const y1 = JUG.pos.y;
  for (let i = 0; i < 90; i++) jugadorPaso(1 / 60, { x: 0, y: 1, saltar: false, agachar: false, correr: false });
  return { subio: +subio.toFixed(2), bajo: +(y1 - JUG.pos.y).toFixed(2) }; })()`);
ok('caminando sube y baja la loma', sube.subio > 0.3 && sube.bajo > 0.3, sube);
const nado = await ev(`(() => { const v = AGUA.vols[0], out = {};
  for (const [nom, pitch] of [['derecho', 0], ['14°', 0.25], ['20°', 0.33], ['40°', 0.7]]) {
    JUG.pos.set(v.cx, v.y1 - 0.5, v.cz); JUG.vel.set(0, 0, 0); JUG.pitch = pitch; JUG.yaw = 0;
    for (let i = 0; i < 60; i++) jugadorPaso(1 / 60, ${E0});
    let lo = 1e9; for (let i = 0; i < 180; i++) { jugadorPaso(1 / 60, { x: 0, y: 1, saltar: false, agachar: false, correr: false }); lo = Math.min(lo, JUG.pos.y - 0.95 + JUG.ojoAlto - v.y1); }
    out[nom] = +lo.toFixed(2); }
  JUG.pitch = 0; return out; })()`);
ok('nadando hacia adelante con la cámara hasta 20° abajo: los ojos no bajan más de 15 cm de la superficie', ['derecho', '14°', '20°'].every((k) => nado[k] > -0.15), nado);
ok('con la cámara a 40° abajo se bucea (los ojos se meten bajo el agua, hasta el fondo)', nado['40°'] < -0.3, nado);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
