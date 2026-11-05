// La linterna en los mapas del Workshop (pedido del Discord: «que se pueda iluminar en los custom maps también, me pasó en
// gm_mallparking y así»). Se mira una pared a 2–5 m y se mide el brillo del centro de la pantalla (donde cae el cono) con
// la linterna apagada y prendida:
// (se mira el piso a 3 m: está en cualquier mapa)
//  1. en un mapa propio (gm_construct, de referencia) la linterna suma luz;
//  2. en un mapa del Workshop (BSP con luz horneada) también suma, parecido;
//  3. en una parte oscura del mapa del Workshop se ve: el centro pasa de casi negro a visible;
//  4. sin errores de JS.
// uso: node linterna_bsp.mjs URL_HTML URL_CARPETA_GMA ID_MAPA NOMBRE_MAPA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, ID = '740628279', NOM = 'WS_gm_hotel', DIR = ''] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForTimeout(4000);
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 40000 ? ok() : setTimeout(f, 30)); f(); }); 1`);
// brillo medio (0–255) de un cuadrado en el centro de la imagen del juego
async function brillo(nom) {
  await ev(`esperaJuego(0.4)`);
  const buf = await p.screenshot({ clip: { x: 873 / 2 - 60, y: 393 / 2 - 40, width: 120, height: 80 } });
  if (DIR) (await import('fs')).writeFileSync(DIR + '/' + nom + '.png', buf);
  return await p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return +(s / (d.length / 4)).toFixed(1); }, buf.toString('base64'));
}
// mirar el piso unos 3 m adelante desde los puntos dados (el primero que tenga piso firme y nada en el medio)
const mirarPared = (puntos) => ev(`(() => {
  const pts = ${JSON.stringify(puntos || null)} || [[JUG.pos.x, JUG.pos.y, JUG.pos.z]];
  for (const q of pts) for (let a = 0; a < 8; a++) {
    const yaw = a * Math.PI / 4, d = v3(Math.sin(yaw), 0, Math.cos(yaw));
    const piso = mundoRayo(v3(q[0], q[1] + 0.5, q[2]), v3(0, -1, 0), 3); if (!piso) continue;
    const p0 = v3(q[0], q[1] + 0.5 - piso.t + 0.05, q[2]), ojo = vadd(p0, v3(0, 1.6, 0)), meta = vadd(p0, vscale(d, 3));
    const dir = vsub(meta, ojo), L = dir.len(); dir.x /= L; dir.y /= L; dir.z /= L;
    const h = mundoRayo(ojo, dir, 6); if (!h || h.t < L - 0.4 || h.n.y < 0.6) continue;
    JUG.noclip = true; JUG.pos.copy(p0); JUG.vel.set(0, 0, 0); JUG.yaw = yaw; JUG.pitch = Math.atan2(1.6, 3); JUG.tercera = false; return { t: +h.t.toFixed(2), q };
  }
  return null; })()`);
async function medir(nom) {
  await ev(`linternaAlternar(false); 1`); const apagada = await brillo(nom + '_apagada');
  await ev(`linternaAlternar(true); 1`); const prendida = await brillo(nom + '_prendida');
  await ev(`linternaAlternar(false); 1`);
  return { apagada, prendida, suma: +(prendida - apagada).toFixed(1) };
}
await ev(`esperaJuego(1)`);
const pp = await mirarPared();
const m1 = pp ? await medir('propio') : null;
ok('1. mapa propio: la linterna suma luz en el centro', m1 && m1.suma > 6, { pared: pp, ...m1 });
await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${ID}.gma')).arrayBuffer()); const A = await gmInstalar('${ID}', { nombre: '${ID}', sinDeps: true }, b); await A.listo; return 1; })()`);
await ev(`empezarPartida(${JSON.stringify(NOM)}); 1`);
await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), NOM, { timeout: 240000 }).catch(() => {});
await p.waitForTimeout(3000); await ev(`cerrarPaneles && cerrarPaneles(); 1`);
const pw = await mirarPared();
const m2 = pw ? await medir('workshop') : null;
ok('2. mapa del Workshop: la linterna suma luz parecido al propio (≥ 60 %)', m2 && m1 && m2.suma >= 0.6 * m1.suma, { pared: pw, ...m2 });
// 3: el lugar más oscuro entre las apariciones del mapa (y el de recién)
const puntos = await ev(`(MUNDO.spawns || []).slice(0, 12).map((a) => { const p = a.p || a.pos || a; return [p.x !== undefined ? p.x : p[0], p.y !== undefined ? p.y : p[1], p.z !== undefined ? p.z : p[2]]; })`);
let mejor = m2 && pw ? { v: m2.apagada, q: pw.q, m: m2 } : null;
for (const q of puntos || []) {
  const pq = await mirarPared([q]); if (!pq) continue;
  const m = await medir('ap'); if (!mejor || m.apagada < mejor.v) mejor = { v: m.apagada, q, m };
}
const m3 = mejor && mejor.m;
ok('3. en la parte más oscura que se encontró la linterna deja ver (el centro sube ≥ 25 y pasa de 45)', m3 && m3.suma >= 25 && m3.prendida >= 45, { ...m3, lugares: (puntos || []).length + 1 });
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado/i.test(x));
ok('4. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
