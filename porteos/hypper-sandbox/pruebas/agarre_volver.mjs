// pistola de física / gravedad: el botón de girar se prende con un toque y se apaga con otro (no hay que mantener) y al
// soltar se apaga solo; sosteniendo algo aparece el botón de volver y lo deja donde estaba al agarrarlo (posición, giro
// y congelado); con la de gravedad igual; R hace lo mismo en la compu; la tele propia se borra con el tacho apuntándola
// (la de otro no); sin errores.
// uso: node agarre_volver.mjs URL_HTML
import { abrir } from './base.mjs';
const { b, p, err, ev } = await abrir(process.argv[2], true);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500); await p.touchscreen.tap(5, 300); await p.waitForTimeout(300);
const pos = async (sel) => ev(`(() => { const e = document.querySelector('${sel}'); if (!e || e.classList.contains('oc') || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; })()`);
// una caja adelante, mirándola, con la pistola de física
await ev(`(() => { JUG.pitch = 0.25; const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10);
  window.__o = crearObjeto('Box4', v3(JUG.pos.x + f.x * 3, piso, JUG.pos.z + f.z * 3), Quat.axis(0, 1, 0, 0.3)); for (let i = 0; i < 60; i++) physStep(1 / 60);
  elegirArma(ARM.lista.indexOf('PhysicsGun')); return 1; })()`);
await p.waitForTimeout(400);
await ev(`(() => { const b = window.__o.b, d = vsub(b.pos, CAM.pos).norm(); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.asin(d.y); return 1; })()`); await p.waitForTimeout(300);
const ini = await ev(`(() => { const b = window.__o.b; const h = raycast(CAM.pos, CAM.fwd, 50, null); return { apunta: !!(h && h.body === b), p: [b.pos.x, b.pos.y, b.pos.z], q: [b.q.x, b.q.y, b.q.z, b.q.w] }; })()`);
await ev(`agarrarFisica(); 1`); await p.waitForTimeout(400);
const vol0 = await pos('#bvolver'), rot = await pos('#brotar');
if (rot) { await p.touchscreen.tap(rot[0], rot[1]); await p.waitForTimeout(300); }
const r1 = await ev(`({ rotar: ENT.rotar, on: $('brotar').classList.contains('on'), rotando: ARM.rotando })`);
if (rot) { await p.touchscreen.tap(rot[0], rot[1]); await p.waitForTimeout(300); }
const r2 = await ev(`({ rotar: ENT.rotar, on: $('brotar').classList.contains('on') })`);
ok('girar: un toque lo prende (queda prendido sin mantener), otro lo apaga', r1.rotar && r1.on && !r2.rotar && !r2.on, { r1, r2, apunta: ini.apunta });
// llevarla lejos y girarla, y volver
await ev(`(() => { ENT.rotar = true; for (let i = 0; i < 60; i++) { JUG.yaw += 0.02; ENT.rdx = 8; physStep(1 / 60); } ENT.rotar = false; return 1; })()`); await p.waitForTimeout(400);
const lejos = await ev(`(() => { const b = window.__o.b; return Math.hypot(b.pos.x - ${ini.p[0]}, b.pos.z - ${ini.p[2]}); })()`);
const vol = await pos('#bvolver'); if (vol) { await p.touchscreen.tap(vol[0], vol[1]); await p.waitForTimeout(300); }
const fin = await ev(`(() => { const b = window.__o.b, q = [b.q.x, b.q.y, b.q.z, b.q.w], q0 = ${JSON.stringify(ini.q)}; return { d: +Math.hypot(b.pos.x - ${ini.p[0]}, b.pos.y - ${ini.p[1]}, b.pos.z - ${ini.p[2]}).toFixed(3), giro: +(2 * Math.acos(Math.min(1, Math.abs(q[0] * q0[0] + q[1] * q0[1] + q[2] * q0[2] + q[3] * q0[3]))) * 180 / Math.PI).toFixed(1), suelto: !ARM.agarre, botonSeVa: !document.querySelector('#bvolver:not(.oc)') }; })()`);
ok('sosteniendo aparece "volver"; tocarlo la deja donde estaba (a < 2 cm y < 2°) y la suelta', !!vol0 && lejos > 1 && fin.d < 0.02 && fin.giro < 2 && fin.suelto && fin.botonSeVa, { lejos: +lejos.toFixed(2), ...fin });
// la de gravedad y R en la compu
const grav = await ev(`(async () => { elegirArma(ARM.lista.indexOf('GravityGun') >= 0 ? ARM.lista.indexOf('GravityGun') : (ARM.lista.push('GravityGun'), ARM.lista.length - 1)); await new Promise((r) => setTimeout(r, 300));
  const b = window.__o.b, dd = vsub(b.pos, CAM.pos).norm(); JUG.yaw = Math.atan2(dd.x, dd.z); JUG.pitch = -Math.asin(dd.y); await new Promise((r) => setTimeout(r, 300)); const p0 = b.pos.clone(); gravSecundario(); const tiene = !!ARM.grav; for (let i = 0; i < 40; i++) { JUG.yaw += 0.03; gravPaso(1 / 60); physStep(1 / 60); }
  const movio = b.pos.distTo(p0); ENT.pulsos.push('recargar'); atenderPulsos(); return { tiene, movio: +movio.toFixed(2), d: +b.pos.distTo(p0).toFixed(3), suelto: !ARM.grav }; })()`);
ok('con la de gravedad igual, y R la devuelve', grav.tiene && grav.movio > 0.5 && grav.d < 0.02 && grav.suelto, grav);
// la tele propia se borra con el tacho; la de otro no
const tele = await ev(`(async () => { JUG.pitch = 0; entidadPonerMod('pantalla', true); const e = ENTS.lista.find((x) => x.t === 'pantalla' && x.dueno === 'yo'); const c = vadd(entPos(e), v3(0, ((e.prm && e.prm.w) || 2) * 0.5, 0));
  const d = vsub(c, CAM.pos).norm(); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.asin(d.y); await new Promise((r) => setTimeout(r, 200));
  const otra = entidadCrear({ t: 'pantalla', p: [JUG.pos.x - 6, JUG.pos.y - 0.95, JUG.pos.z], yaw: 0 }, { dueno: 'otro', key: 'otro:1' });
  borrarApuntado(); const mia = ENTS.lista.includes(e);
  const c2 = vadd(entPos(otra), v3(0, 1, 0)), d2 = vsub(c2, CAM.pos).norm(); JUG.yaw = Math.atan2(d2.x, d2.z); JUG.pitch = -Math.asin(d2.y); await new Promise((r) => setTimeout(r, 200));
  borrarApuntado(); return { miaBorrada: !mia, otraQueda: ENTS.lista.includes(otra) }; })()`);
ok('la tele propia se borra con el tacho; la de otro jugador no', tele.miaBorrada && tele.otraQueda, tele);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
