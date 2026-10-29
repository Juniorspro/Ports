// mod Cíclope jugando solo: el personaje, el botón, el láser suave (tocar), la definitiva (mantener 1 s): la
// cinemática de 6 s con sus planos, 15 s de rayo con el cielo rojo, que agarra a un muñeco y lo hace volar, y al final
// todo vuelve a la normalidad. Capturas en la carpeta.
// uso: node ciclope.mjs Hypper.html carpeta [celu]
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/', celu = process.argv[4] === 'celu';
const { b, p, err, ev } = await abrir(HTML, celu);
const glN = () => err.filter((e) => /GL_INVALID/.test(e)).length;
const espera = (ms) => p.waitForTimeout(ms), ok = (c, t, x) => console.log((c ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '') + (glN() ? ' [avisos GL: ' + glN() + ']' : ''));
await ev(`PREFS.bienvenida = true; GFX.auto=false; PREFS.mods = {ciclope: true}; inicioMostrar(false); RB.mapaPartida=null; RB.mapaCom=null; RB.horaPartida='normal'; empezarPartida('City')`);
await espera(5000);
await ev(`JUG.pos.set(JUG.pos.x, JUG.pos.y, JUG.pos.z); JUG.vel.set(0,0,0); JUG.pitch = 0.05; 1`);
const ini = JSON.parse(await ev(`JSON.stringify({ skin: JUG.cuerpo && JUG.cuerpo.skin, nat: NAT.mods.has('ciclope'), boton: !!(CIC.boton && CIC.boton.style.display !== 'none'), menu: modsActivosAhora().map((m) => m.id) })`));
ok(ini.skin === 'Ciclope' && ini.nat && ini.boton, 'con el mod sos Cíclope y aparece el botón', ini);
await ev(`JUG.tercera = true; 1`); await espera(1200); await p.screenshot({ path: D + 'c0_ciclope.png' });
// ---- láser suave (tocar) ----
const tocar = async (ms) => { if (celu) { const r = await p.$('#cicBt'); const bb = await r.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); } else { await p.keyboard.down('KeyH'); await espera(ms); await p.keyboard.up('KeyH'); } };
await ev(`JUG.tercera = false; 1`); await espera(300);
await tocar(120); await espera(60);
const l = JSON.parse(await ev(`JSON.stringify({ rayos: CIC.rayos.length, ult: !!cicMia(), largo: CIC.rayos[0] ? +CIC.rayos[0].o.distTo(CIC.rayos[0].p).toFixed(1) : 0 })`));
ok(l.rayos === 1 && !l.ult, 'tocar: sale un láser suave (no la definitiva)', l);
await p.screenshot({ path: D + 'c1_laser.png' });
// ---- un muñeco enfrente (para que el rayo lo agarre) ----
await ev(`(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); const P = crearPersona('Soldier', 'HatEmpty', { nombre: 'Muñeco' }); P.npc = true; P.vida = 400; P.pos.copy(vadd(JUG.pos, vscale(f, 14))); P.yaw = JUG.yaw + Math.PI; P.suelo = true;
  const bo = new Body(capsuleShape(0.4, 0.5), 80); bo.frozen = true; bo.persona = P; bo.pos.copy(P.pos); bo.updateWorld(); addBody(bo); window.__mu = { P, bo }; return 1; })()`);
// costo por cuadro antes (para comparar con la definitiva)
await ev(`JUG.tercera = true; 1`); await espera(2500); const msAntes = Number(await ev(`TIEMPO.msProm`)); await ev(`JUG.tercera = false; 1`);
// ---- la definitiva: mantener 1 s ----
if (celu) {
  // mantener apretado el botón con el dedo (toques de verdad: empieza, se queda 1,4 s y suelta)
  const r = await p.$('#cicBt'), bb = await r.boundingBox(), cdp = await p.context().newCDPSession(p), pt = [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt }); await espera(1400); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
else { await p.keyboard.down('KeyH'); await espera(1400); await p.keyboard.up('KeyH'); }
const u = () => ev(`(() => { const U = cicMia(); return U ? +(TIEMPO.t - U.t0).toFixed(2) : -1; })()`).then(Number);
const u0 = await u(); ok(u0 >= 0, 'mantener 1 s: empieza la definitiva', u0); console.log('  fps', await ev(`Math.round(TIEMPO.fps)`)); if (u0 < 0) { await b.close(); process.exit(1); }
const planos = [[0.9, 'c2_colapso'], [2.5, 'c3_perfil'], [3.9, 'c4_lentes'], [5.0, 'c5_grito'], [5.8, 'c6_estalla']];
for (const [t, n] of planos) { while ((await u()) < t && (await u()) >= 0) await espera(40); await p.screenshot({ path: D + n + '.png' }); console.log('  ' + n + ' u=' + (await u()) + ' GL ' + glN()); }
const cine = JSON.parse(await ev(`JSON.stringify({ rojo: +CIC.rojo.toFixed(2), tercera: JUG.tercera, inmune: CIC.inmune, quieto: CIC.quieto, lentes: JUG.cuerpo.cicLentes, bajar: +(JUG.cuerpo.bajar||0).toFixed(2) })`));
console.log('  en la cinemática:', JSON.stringify(cine));
// ---- 15 s de rayo: apunta al muñeco ----
while ((await u()) < 6.6) await espera(50);
// (apunta desde la cámara: como la cámara se mueve al girar, se corrige unas veces)
for (let i = 0; i < 6; i++) { await ev(`(() => { const c = vsub(vadd(window.__mu.P.pos, v3(0, 0.2, 0)), CAM.pos).norm(); JUG.yaw = Math.atan2(c.x, c.z); JUG.pitch = -Math.asin(c.y); return 1; })()`); await espera(150); }
let peg = null;
for (let i = 0; i < 40; i++) { await espera(100); peg = JSON.parse(await ev(`JSON.stringify({ vic: !!(cicMia() && cicMia().vic), rag: !!window.__mu.P.rag, u: +(TIEMPO.t - cicMia().t0).toFixed(1) })`)); if (peg.vic) break; }
ok(peg && peg.vic, 'el rayo agarra al muñeco', peg);
await espera(700); await p.screenshot({ path: D + 'c7_agarrado.png' });
const vuela = JSON.parse(await ev(`(() => { const P = window.__mu.P, h = P.rag && P.rag.cuerpos.get(P.D.h.Hips); return JSON.stringify({ rag: !!P.rag, alto: h ? +(h.b.pos.y - JUG.pos.y).toFixed(1) : null, vel: h ? +h.b.vel.len().toFixed(1) : null }); })()`));
ok(vuela.rag && vuela.vel > 5, 'lo lleva volando', vuela);
// apunta a la calle: explota y cae todo rojo
await espera(3200);
await ev(`JUG.pitch = 0.35; JUG.yaw += 0.6; 1`); await espera(1500);
const furia = JSON.parse(await ev(`JSON.stringify({ rojo: +CIC.rojo.toFixed(2), cielo: R.cielo ? R.cielo.mid.map((x) => +x.toFixed(2)) : null, capa: CIC.capaR.style.opacity, u: +(TIEMPO.t - cicMia().t0).toFixed(1), hit: !!cicMia().hit })`));
ok(furia.rojo > 0.9 && furia.cielo && furia.cielo[0] > furia.cielo[2] * 2, 'cielo y ambiente rojos', furia);
await p.screenshot({ path: D + 'c8_destruye.png' });
const msDurante = Number(await ev(`TIEMPO.msProm`)); console.log('  costo por cuadro: antes', msAntes.toFixed(1), 'ms · con el rayo', msDurante.toFixed(1), 'ms');
await ev(`JUG.yaw -= 1.2; JUG.pitch = -0.05; 1`); await espera(1200); await p.screenshot({ path: D + 'c9_destruye2.png' });
// ---- se termina ----
while ((await u()) >= 0) await espera(200);
await espera(2500);
const fin = JSON.parse(await ev(`JSON.stringify({ ult: !!cicMia(), rojo: +CIC.rojo.toFixed(3), espera: Math.ceil(CIC.espera), tercera: JUG.tercera, inmune: CIC.inmune, quieto: CIC.quieto, lentes: JUG.cuerpo && JUG.cuerpo.cicLentes, vivo: JUG.vivo })`));
ok(!fin.ult && fin.rojo < 0.05 && fin.espera > 10 && !fin.inmune && !fin.quieto, 'al terminar todo vuelve (con espera para la próxima)', fin);
await p.screenshot({ path: D + 'c10_despues.png' });
console.log('errores:', [...new Set(err.filter((e) => !/WebSocket|mqtt|Failed to load resource|favicon/i.test(e)))].slice(0, 8).join(' | ') || 'ninguno');
await b.close(); process.exit(0);
