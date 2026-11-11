// la pizzería: recorrido con la linterna (la oficina para los cuatro lados y cada sala de FNAF, parado delante del
// lugar de cada animatrónico, mirándolo) y las 11 cámaras de seguridad, para mirar. Los lugares salen del mapa
// (DATA.fn.oficina y DATA.fn.salas), así sirve con cualquier pizzería que arme herramientas/pizzeria.py.
// uso: node pizzeria.mjs HTML CARPETA [calidad] [celu]
import { abrir } from './base.mjs';
const HTML = process.argv[2], SALIDA = (process.argv[3] || '.') + '/', CAL = process.argv[4] || 'alto', CELU = process.argv[5] === 'celu';
const { b, p, err, ev } = await abrir(HTML, CELU);
await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = '${CAL}'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Pizzeria'); 1`);
for (let i = 0; i < 120 && !(await ev(`JUEGO.estado === 'juego' && typeof NOC !== 'undefined' && NOC.on`)); i++) await p.waitForTimeout(500);
await p.waitForTimeout(3000);
await ev(`nocheEmpezarNoche(1); for (let i = 0; i < 100; i++) { TIEMPO.t += 0.05; nochePaso(0.05); } NOC.quieta = true; NOC.linterna = true; 1`);
await p.waitForTimeout(4000);
const cuadros = async (n) => { const m0 = await ev(`R.marca`); for (let i = 0; i < 60 && (await ev(`R.marca`)) < m0 + n; i++) await p.waitForTimeout(200); };
// [nombre, x, z, yaw, pitch] (a la altura de los ojos sobre el piso de ahí)
const L = JSON.parse(await ev(`(() => {
  const O = DATA.fn.oficina, L = [], y0 = O.yaw;
  L.push(['oficina', O.c[0], O.c[2], y0, 0.12], ['oficina_izq', O.c[0], O.c[2], y0 + Math.PI / 2, 0.05], ['oficina_der', O.c[0], O.c[2], y0 - Math.PI / 2, 0.05], ['oficina_atras', O.c[0], O.c[2], y0 + Math.PI, 0.05], ['oficina_techo', O.c[0], O.c[2], y0, -0.9]);
  for (const [sala, S] of Object.entries(DATA.fn.salas)) {
    if (sala === 'oficina') continue;
    const s = Object.values(S)[0], f = v3(Math.sin(s[3]), 0, Math.cos(s[3]));
    const h = mundoRayo(v3(s[0], s[1] + 1.6, s[2]), f, 3.2), d = h ? Math.max(0.8, h.t - 0.4) : 3.2;   // (delante, sin meterse en la pared)
    L.push([sala, s[0] + f.x * d, s[2] + f.z * d, s[3] + Math.PI, 0.12]);
  }
  return JSON.stringify(L); })()`));
for (const [nom, x, z, yaw, pitch] of L) {
  await ev(`JUG.noclip = true; const h = mundoRayo(v3(${x}, 2.3, ${z}), v3(0, -1, 0), 4), y = h ? 2.3 - h.t : 0.4; JUG.pos.set(${x}, y + 1.0, ${z}); JUG.vel.set(0, 0, 0); JUG.yaw = ${yaw}; JUG.pitch = ${pitch}; 1`);
  await cuadros(4); await p.screenshot({ path: SALIDA + 'pz_' + nom + '.png' });
}
await ev(`NOC.linterna = false; UI.abierto = null; nocheTablet(); 1`);
// (en cada cámara, los animatrónicos que pueden estar en esa sala, parados en su lugar)
for (let i = 0; i < 11; i++) { await ev(`nocheCamElegir(${i}); NOC.ruidoT = 0; const sala = NOC_CAMS[${i}][3], S = DATA.fn.salas[sala] || {};
  for (const A of NOC.anim) { const p = S[A.k]; if (!p) continue; A.sala = sala; A.ruta = null; A.estado = 'quieto'; A.pos.set(p[0], p[1], p[2]); A.meta.copy(A.pos); A.yaw = A.metaYaw = p[3]; A.salaVista = sala; } 1`); await cuadros(3); await ev(`NOC.ruidoT = 0; 1`); await p.waitForTimeout(400); await cuadros(3); await p.screenshot({ path: SALIDA + 'pz_cam' + i + '.png' }); }
console.log('errores:', err.filter((e) => !/WebSocket|mqtt|ERR_/i.test(e)).slice(0, 8).join(' | ') || 'ninguno');
await b.close();
