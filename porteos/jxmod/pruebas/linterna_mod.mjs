// La linterna de un mod de GMod (Discord: «el mod de la linterna dinámica está súper bug: 1- no ilumina 2- la cámara se
// vuelve loca e incontrolable»; es [VManip and SWEP] Extended Flashlight, 2947598424). Con el arma en la mano, en
// gm_construct, mirando el piso a 3 m:
//  1. carga y se equipa sin errores de Lua;
//  2. ilumina: prendida suma luz en el centro de la pantalla, por lo menos la mitad de lo que suma la linterna del juego;
//  3. el botón principal la apaga (vuelve a lo de antes, ±3) y la prende de nuevo;
//  4. la cámara no se va sola: 4 s quieto, la vista se aparta de hacia donde mira el jugador ≤ 6° y no crece con el
//     tiempo; mientras la prende y la apaga el arma la mueve un poco, como en GMod (≤ 15°);
//  5. la cámara sigue al mouse: girando 40° con el mouse la vista gira 40° (±4°);
//  6. al cambiar de arma la luz se apaga (no queda flotando);
//  7. sin errores de JS.
// uso: node linterna_mod.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, DIR = ''] = process.argv, ID = '2947598424';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML, false);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForTimeout(4000);
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 40000 ? ok() : setTimeout(f, 30)); f(); }); 1`);
const W = 1280, H = 720;
async function brillo(nom) {
  await ev(`esperaJuego(0.5)`);
  const buf = await p.screenshot({ clip: { x: W / 2 - 80, y: H / 2 - 50, width: 160, height: 100 } });
  if (DIR) (await import('fs')).writeFileSync(DIR + '/' + nom + '.png', buf);
  return await p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return +(s / (d.length / 4)).toFixed(1); }, buf.toString('base64'));
}
// (mirar el piso unos 3 m adelante, en un lugar con sombra)
const pose = await ev(`(() => {
  for (const q of [[-30, 0.5, 8], [JUG.pos.x, JUG.pos.y, JUG.pos.z]]) for (let a = 0; a < 8; a++) {
    const yaw = a * Math.PI / 4, d = v3(Math.sin(yaw), 0, Math.cos(yaw));
    const piso = mundoRayo(v3(q[0], q[1] + 0.5, q[2]), v3(0, -1, 0), 3); if (!piso) continue;
    const p0 = v3(q[0], q[1] + 0.5 - piso.t + 0.05, q[2]), ojo = vadd(p0, v3(0, 1.6, 0)), meta = vadd(p0, vscale(d, 3));
    const dir = vsub(meta, ojo), L = dir.len(); dir.x /= L; dir.y /= L; dir.z /= L;
    const h = mundoRayo(ojo, dir, 6); if (!h || h.t < L - 0.4 || h.n.y < 0.6) continue;
    window.__pose = { p: [p0.x, p0.y, p0.z], yaw, pitch: Math.atan2(1.6, 3) }; return window.__pose;
  }
  return null; })()`);
const ponerPose = () => ev(`(() => { const q = __pose; JUG.noclip = true; JUG.pos.set(q.p[0], q.p[1], q.p[2]); JUG.vel.set(0, 0, 0); JUG.yaw = q.yaw; JUG.pitch = q.pitch; JUG.tercera = false; return 1; })()`);
await ponerPose();
// (de noche se ve mejor: la luz del sol baja; igual para las dos linternas)
await ev(`if (typeof nocheForzar === 'function') nocheForzar(true); 1`);
// referencia: la linterna del juego
await ev(`linternaAlternar(false); 1`); const base0 = await brillo('ref_apagada');
await ev(`linternaAlternar(true); 1`); const ref = await brillo('ref_juego');
await ev(`linternaAlternar(false); 1`);
// 1. el mod
const ins = await ev(`(async () => { const A = await gmInstalar('${ID}', { nombre: '${ID}' }, new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${ID}.gma')).arrayBuffer())); await A.listo; return { sweps: (A.sweps || []).length, err: (A.err || []).length }; })()`);
await ev(`(async () => { window.__e0 = GMA.errores.length; gmaSpawnMenu('gmswep:shaky_flashlight'); await esperaJuego(2.5); return 1; })()`);
await ponerPose();
// (cuánto se aparta la vista de hacia donde mira el jugador, en cada cuadro)
await ev(`(() => { window.__dev = []; const o = gmaVistaLua; gmaVistaLua = (C) => { const f0 = C.q.rot(v3(0, 0, 1)); const r = o(C); const f1 = C.q.rot(v3(0, 0, 1)); __dev.push({ t: TIEMPO.t, d: Math.acos(Math.max(-1, Math.min(1, vdot(f0, f1)))) * 180 / Math.PI }); if (__dev.length > 3000) __dev.shift(); return r; }; return 1; })()`);
const eq = await ev(`({ arma: ARM.lista[ARM.i], vista: !!(ARM.v && ARM.v.gm), luces: GMA.pts ? [...GMA.pts].filter((t) => t.vivo).map((t) => ({ brillo: +t.brillo.toFixed(2), fov: t.fovH, lejos: t.lejos, listo: t.listo })) : null, errores: GMA.errores.slice(__e0).filter((x) => !/BuildConVarList/.test(x)).slice(0, 6) })`);
ok('1. se equipa y su Lua corre sin errores', ins.sweps > 0 && eq.arma && /shaky/.test(eq.arma) && eq.vista && !eq.errores.length, { ins, ...eq });
const mod = await brillo('mod_prendida');
const sumaRef = +(ref - base0).toFixed(1), sumaMod = +(mod - base0).toFixed(1);
ok('2. ilumina: suma luz en el centro, ≥ la mitad de lo que suma la linterna del juego', sumaRef > 4 && sumaMod >= 0.5 * sumaRef, { apagada: base0, juego: ref, mod, sumaRef, sumaMod, luces: eq.luces });
// 3. el principal la apaga y la prende (de paso se mide la cámara durante esa animación)
await ev(`__dev.length = 0; 1`);
await ev(`(async () => { ENT.disparo = true; await esperaJuego(0.15); ENT.disparo = false; await esperaJuego(1.4); return 1; })()`); await ponerPose();
const off = await brillo('mod_apagada');
await ev(`(async () => { ENT.disparo = true; await esperaJuego(0.15); ENT.disparo = false; await esperaJuego(1.4); return 1; })()`); await ponerPose();
const on2 = await brillo('mod_prendida2');
const devAnim = await ev(`({ n: __dev.length, max: +Math.max(0, ...__dev.map((x) => x.d)).toFixed(2) })`);
ok('3. el botón principal la apaga (como sin luz, ±3) y la vuelve a prender', Math.abs(off - base0) <= 3 && sumaMod > 4 && on2 - base0 >= 0.5 * sumaMod, { off, on2, base0 });
// 4. cámara quieta 4 s
await ev(`__dev.length = 0; 1`); await ev(`esperaJuego(4)`);
const dev = await ev(`(() => { const d = __dev.map((x) => x.d), n = d.length, m = (a) => a.length ? Math.max(...a) : 0; return { n, max: +m(d).toFixed(2), primeraMitad: +m(d.slice(0, n >> 1)).toFixed(2), segunda: +m(d.slice(n >> 1)).toFixed(2) }; })()`);
ok('4. la cámara no se va sola: 4 s quieto ≤ 6° y sin crecer; mientras prende y apaga, el arma la mueve ≤ 15°', dev.n > 30 && dev.max <= 6 && dev.segunda <= dev.primeraMitad + 1.5 && devAnim.n > 30 && devAnim.max <= 15, { quieto: dev, animacion: devAnim });
// 5. sigue al mouse: 40° a la derecha
const g = await ev(`(async () => { const yaw0 = JUG.yaw, f0 = CAM.fwd.clone(); ENT.bloqueado = true; ENT.dx += (40 * Math.PI / 180) / ENT.sens; await esperaJuego(0.6); const f1 = CAM.fwd.clone();
  const a0 = Math.atan2(f0.x, f0.z), a1 = Math.atan2(f1.x, f1.z); let d = (a1 - a0) * 180 / Math.PI; d = ((d + 540) % 360) - 180; return { jugador: +(((JUG.yaw - yaw0) * 180 / Math.PI)).toFixed(1), vista: +d.toFixed(1) }; })()`);
ok('5. girando 40° con el mouse la vista gira 40° (±4°)', Math.abs(Math.abs(g.vista) - 40) <= 4 && Math.abs(Math.abs(g.jugador) - 40) <= 1, g);
if (DIR) await p.screenshot({ path: DIR + '/linterna_mod.png' });
// 6. al cambiar de arma la luz se va (no queda una luz flotando donde estaba)
await ev(`(async () => { elegirArma(0); await esperaJuego(1); return 1; })()`); await ponerPose();
const cambio = await ev(`({ arma: ARM.lista[ARM.i], vivas: GMA.pts ? [...GMA.pts].filter((t) => t.vivo && t.brillo > 0).length : 0 })`);
const tras = await brillo('tras_cambiar');
ok('6. al cambiar de arma la luz del mod se apaga (como sin luz, ±3)', cambio.vivas === 0 && !/shaky/.test(cambio.arma) && Math.abs(tras - base0) <= 3, { ...cambio, brillo: tras, base0 });
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently|BuildConVarList|\[GMod\]/i.test(x));
ok('7. sin errores de JS', !e.length, e.slice(0, 4));
await b.close();
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
