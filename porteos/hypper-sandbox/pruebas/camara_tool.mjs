// herramienta Cámara de la Tool Gun: está en la lista; clic pone un trípode con cámara congelado donde apuntás, con el
// lente hacia donde mirás (probado con 3 direcciones); clic derecho mira por la primera, después por la segunda y
// después vuelve a tus ojos; la vista sale del lente (a ≤ 10 cm de la punta del modelo) y mira hacia donde miraba el
// que la puso; si borrás la cámara o cambiás de arma, volvés a tus ojos; sin errores.
// uso: node camara_tool.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 15000 });
const i = await ev(`DATA.herr.findIndex((h) => h.n === 'Camara')`);
ok('la Cámara está entre las herramientas', i >= 0, i);
await ev(`equiparHerramienta(${i}); 1`); await p.waitForTimeout(400);
const angs = [0.0, 2.1, -1.3], puestas = [];
for (const a of angs) {
  await ev(`JUG.yaw = ${a}; JUG.pitch = 0.55; 1`); await p.waitForTimeout(150);
  const r = await ev(`(() => { const n = OBJS.length; const f = CAM.fwd.clone(); herramientaUsar(false); const o = OBJS[OBJS.length - 1]; if (OBJS.length === n) return null;
    const ad = o.b.q.rot(v3(-1, 0, 0)); const h = Math.hypot(f.x, f.z); return { nombre: o.nombre, art: o.art, cong: !!o.b.frozen, dot: (ad.x * f.x + ad.z * f.z) / h, adY: ad.y, pitch: o.camPitch }; })()`);
  puestas.push(r);
}
ok('clic pone un trípode con cámara, congelado, con el lente hacia donde mirás (3 direcciones)', puestas.every((r) => r && r.nombre === 'CamaraTripode' && r.art === 'camara' && r.cong && r.dot > 0.999 && Math.abs(r.adY) < 1e-3), puestas);
await ev(`JUG.yaw = 0.4; JUG.pitch = 0.1; 1`); await p.waitForTimeout(150);
// mirar por la primera
await ev(`herramientaUsar(true); 1`); await p.waitForTimeout(300);
const v1 = await ev(`(() => { const o = HCAM.ver, mias = OBJS.filter((x) => x.art === 'camara'); const d = DATA.ms[(DATA.pf[DATA.pfPorNombre.CamaraTripode]).find((x) => x.m !== undefined).m];
  const punta = vadd(o.b.pos, o.b.q.rot(vsub(v3(d.mn[0], d.mn[1] + d.sc[1] * 0.875, d.mn[2] + d.sc[2] * 0.5), o.c)));
  const ad = o.b.q.rot(v3(-1, 0, 0)); return { cual: mias.indexOf(o), dist: Math.hypot(CAM.pos.x - punta.x, CAM.pos.y - punta.y, CAM.pos.z - punta.z), dot: (CAM.fwd.x * ad.x + CAM.fwd.z * ad.z) / Math.hypot(CAM.fwd.x, CAM.fwd.z), fwdY: CAM.fwd.y, ojoY: JUG.pos.y }; })()`);
ok('clic derecho: mira por la primera, desde el lente y hacia donde apunta (con la inclinación del que la puso)', v1.cual === 0 && v1.dist < 0.1 && v1.dot > 0.999 && v1.fwdY < -0.4, v1);
const vc = await ev(`(() => { const P = JUG.cuerpo; return { arma: dibujarVista(), cuerpo: P.cDib === PERS_N, cab: P.md.s[P.D.h.Head][0] }; })()`);
ok('mirando por la cámara: sin el arma en la mano, se ve tu cuerpo entero (con cabeza)', vc.arma === false && vc.cuerpo && vc.cab > 0.5, vc);
await p.screenshot({ path: D + 'camara_tool_vista.png' });
await ev(`herramientaUsar(true); 1`); await p.waitForTimeout(200);
const v2 = await ev(`OBJS.filter((x) => x.art === 'camara').indexOf(HCAM.ver)`);
await ev(`herramientaUsar(true); herramientaUsar(true); 1`); await p.waitForTimeout(200);
const v3 = await ev(`({ ver: HCAM.ver, d: Math.hypot(CAM.pos.x - JUG.pos.x, CAM.pos.z - JUG.pos.z) })`);
ok('clic derecho otra vez: la segunda; después de la última, vuelve a tus ojos', v2 === 1 && v3.ver === null && v3.d < 0.5, { v2, v3 });
// borrar la que mirás / cambiar de arma: vuelve a tus ojos
await ev(`herramientaUsar(true); 1`); await p.waitForTimeout(150);
await ev(`borrarObjeto(HCAM.ver); 1`); await p.waitForTimeout(200);
const b1 = await ev(`({ ver: HCAM.ver, d: Math.hypot(CAM.pos.x - JUG.pos.x, CAM.pos.z - JUG.pos.z) })`);
await ev(`herramientaUsar(true); 1`); await p.waitForTimeout(150);
await ev(`elegirArma(ARM.lista.indexOf('PhysicsGun') >= 0 ? ARM.lista.indexOf('PhysicsGun') : 0); 1`); await p.waitForTimeout(250);
const b2 = await ev(`({ ver: HCAM.ver, arma: ARM.lista[ARM.i], d: Math.hypot(CAM.pos.x - JUG.pos.x, CAM.pos.z - JUG.pos.z) })`);
ok('si borrás la cámara que mirás o cambiás de arma, volvés a tus ojos', b1.ver === null && b1.d < 0.5 && b2.ver === null && b2.d < 0.5, { b1, b2 });
await ev(`JUG.tercera = true; JUG.yaw = 2.6; JUG.pitch = 0.3; 1`); await p.waitForTimeout(500);
await p.screenshot({ path: D + 'camara_tool_tripodes.png' });
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
