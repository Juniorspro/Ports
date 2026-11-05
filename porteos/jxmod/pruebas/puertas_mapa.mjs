// Puertas de los mapas de GMod (pedido del Discord: «puertas funcionales para cada mapa, que sea algo universal»). En
// gm_hotel (tiene de las tres clases: prop_door_rotating, func_door y func_door_rotating, botones y casilleros con el
// modelo pegado a una puerta invisible) y en ph_motel_blacke_v3 (9 prop_door_rotating), como un jugador:
//  1. se cargan todas: las 8 de modelo y las de bloques que se ven (o tienen un modelo pegado); las que chocan, con su caja;
//  2. cerrada no deja pasar: caminando contra ella el jugador no cruza;
//  3. mirándola aparece «E: abrir la puerta»; con E se abre (gira ≥ 80° en menos de 2 s, para el lado contrario al jugador)
//     y se puede cruzar caminando;
//  4. cerrándose encima del jugador vuelve a abrirse y no lo mete adentro; sin nadie, se cierra del todo;
//  5. el botón del mapa que abre la puerta del traje (func_button → hev_door, Open): «E: apretar el botón» y la puerta sube;
//  6. en una sala: abrirla avisa a los demás ('pta') y lo que llega de otro la mueve igual;
//  7. ph_motel_blacke_v3: sus 9 puertas, con caja;
//  8. sin errores de JS.
// uso: node puertas_mapa.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML);
if (process.env.DBG) { p.on('console', (m) => { const t = m.text(); if (/^(traza|lugar)/.test(t)) console.log(t.slice(0, 3000)); }); await ev(`window.__DBG = 1; 1`); }
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
async function mapa(id, nom) {
  await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b); await A.listo; return 1; })()`);
  await ev(`empezarPartida(${JSON.stringify(nom)}); 1`);
  await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), nom, { timeout: 240000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await ev(`cerrarPaneles && cerrarPaneles(); window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 40000 ? ok() : setTimeout(f, 30)); f(); }); 1`);
}
await mapa('740628279', 'WS_gm_hotel');
// (herramientas adentro de la página: el lado libre de una cosa con piso, mirar un punto, caminar hacia un punto)
await ev(`(() => {
  window.__eje = (lo, hi) => { const t = [hi.x - lo.x, hi.z - lo.z]; return t[0] < t[1] ? v3(1, 0, 0) : v3(0, 0, 1); };
  window.__lugar = (c, n, d, uno) => { for (const s of uno ? [1] : [1, -1]) { const q = v3(c.x + n.x * d * s, c.y + 0.6, c.z + n.z * d * s), h = mundoRayo(q, v3(0, -1, 0), 4); if (!h || h.n.y < 0.7) continue; const piso = q.y - h.t; const ojo = v3(q.x, piso + 1.6, q.z), dd = vsub(v3(c.x, piso + 1.2, c.z), ojo), g = mundoRayo(ojo, dd.clone().norm(), dd.len()); if (g && g.t < dd.len() - 0.6 && !(g.caja && g.caja.puerta)) continue; return { p: v3(q.x, piso + 0.951 + 0.02, q.z), s }; } return null; };
  window.__mirar = (c) => { const o = JUG.ojoPos || CAM.pos, d = vsub(c, o); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); };
  window.__poner = (q) => { JUG.noclip = false; JUG.pos.copy(q); JUG.vel.set(0, 0, 0); };
  window.__caminar = async (meta, s) => { const t0 = TIEMPO.t, tr = []; ENT.teclas.add('KeyW'); while (TIEMPO.t - t0 < s) { const d = vsub(meta, JUG.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = 0; await esperaJuego(0.05); tr.push([JUG.pos.x, JUG.pos.y, JUG.pos.z].map((x) => x.toFixed(2)).join(',') + (JUG.suelo ? 'S' : '-')); } ENT.teclas.delete('KeyW'); if (window.__DBG) console.log('trazaCam ' + tr.join(' ')); };
  window.__ang = (D) => { const q = D.md.r[0]; const d = Math.abs(D.q0.x * q[0] + D.q0.y * q[1] + D.q0.z * q[2] + D.q0.w * q[3]); return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI; };
  return 1; })()`);
const c1 = await ev(`(() => { const L = PUERTAS.l; return { total: L.length, modelo: L.filter((D) => D.P.cl === 'prop_door_rotating').length, bloques: L.filter((D) => D.P.cl !== 'prop_door_rotating').length,
  conCaja: L.filter((D) => D.b).length, sinCaja: L.filter((D) => !D.b).map((D) => (D.P.nombre || D.md.A[0].n) + (D.P.pasa ? ' (se atraviesa)' : '')), conModeloPegado: L.filter((D) => D.md.A.length > 1).map((D) => D.P.nombre), botones: PUERTAS.bot.length }; })()`);
ok('1. gm_hotel: las 8 puertas de modelo y ≥ 13 de bloques (con casilleros de modelo pegado); las que chocan, con caja', c1.modelo === 8 && c1.bloques >= 13 && c1.conModeloPegado.length >= 3 && c1.sinCaja.every((x) => /se atraviesa/.test(x)), c1);
// 2-4: una puerta de modelo con lugar libre a los dos lados (piso, sin paredes ni cajas sueltas del mapa en el camino)
const c2 = await ev(`(async () => {
  let D = null, A = null, B = null, n = null, c = null;
  for (const X of PUERTAS.l.filter((X) => X.P.cl === 'prop_door_rotating' && X.b)) { const cc = X.b.pos.clone(), nn = __eje(X.b.aabb ? v3(X.b.aabb.x0, 0, X.b.aabb.z0) : cc, X.b.aabb ? v3(X.b.aabb.x1, 0, X.b.aabb.z1) : cc); const a = __lugar(cc, nn, 1.1), bb = a && __lugar(cc, v3(-nn.x * a.s, 0, -nn.z * a.s), 1.6, true); const libre = (q) => !OBJS.some((o) => o.b && vsub(o.b.pos, q).len() < 1.6); if (a && bb && libre(cc) && libre(a.p) && libre(bb.p)) { D = X; c = cc; n = v3(nn.x * a.s, 0, nn.z * a.s); A = a.p; B = bb.p; break; } }
  if (!D) return { sinPuerta: true };
  window.__D = D; window.__c = c; window.__n = n; window.__A = A; window.__B = B;
  if (window.__DBG) console.log('lugar ' + JSON.stringify({ c, n, A, B }));
  __poner(A); await esperaJuego(0.6);
  // (cerrada: camina contra ella 1,5 s)
  const lado0 = vdot(vsub(JUG.pos, c), n); await __caminar(B, 1.5); const lado1 = vdot(vsub(JUG.pos, c), n);
  if (window.__DBG) { const L = []; for (const dy of [-0.85, -0.3, 0.4, 0.8]) for (const lx of [-0.4, 0, 0.4]) { const o = v3(JUG.pos.x + lx * -n.z, JUG.pos.y + dy, JUG.pos.z + lx * n.x), g = mundoRayo(o, v3(-n.x, 0, -n.z), 2.5); if (g) L.push(dy + '/' + lx + ':' + g.t.toFixed(2) + (g.caja ? (g.caja.puerta ? 'P' + g.caja.puerta.i : 'C') : 'W')); }
    const P = JUG.pos, cerca = MUNDO.cajas.filter((x) => x.aabb && P.x + 0.8 > x.aabb.x0 && P.x - 0.8 < x.aabb.x1 && P.z + 0.8 > x.aabb.z0 && P.z - 0.8 < x.aabb.z1 && P.y + 1.2 > x.aabb.y0 && P.y - 1.2 < x.aabb.y1).map((x) => ({ puerta: x.puerta ? x.puerta.i : null, tipo: x.shape && x.shape.type, est: x.estatico, aabb: [x.aabb.x0, x.aabb.y0, x.aabb.z0, x.aabb.x1, x.aabb.y1, x.aabb.z1].map((v) => +v.toFixed(2)) }));
    console.log('trazaCerca ' + JSON.stringify({ P: [P.x, P.y, P.z].map((v) => +v.toFixed(2)), cerca, objs: OBJS.filter((o) => o.b && vsub(o.b.pos, P).len() < 2).map((o) => o.nombre) }));
    const b = D.b; console.log('trazaCerrada ' + L.join(' ') + ' cuerpo ' + JSON.stringify({ pos: b.pos, aabb: b.aabb, q: b.q, wv: (b.wv || []).slice(0, 8).map((v) => [v.x, v.y, v.z].map((x) => +x.toFixed(2))) })); }
  return { puerta: D.md.A[0].n, nombre: D.P.nombre, lado0: +lado0.toFixed(2), lado1: +lado1.toFixed(2), suelo: JUG.suelo }; })()`);
ok('2. cerrada no deja pasar (camina contra ella y no cruza)', !c2.sinPuerta && c2.lado0 > 0.5 && c2.lado1 > 0.4, c2);
await ev(`(async () => { __poner(__A); await esperaJuego(0.5); __mirar(v3(__c.x, __c.y, __c.z)); await esperaJuego(0.2); return 1; })()`);
await p.screenshot({ path: D + 'puerta_cerrada.jpg', type: 'jpeg', quality: 70 });
const txt = await ev(`({ apunta: puertaApunta(), hud: (document.getElementById('apunta') || document.getElementById('hudApunta') || {}).textContent || '' })`);
await p.keyboard.press('e');
const c3 = await ev(`(async () => { const t0 = TIEMPO.t; let t80 = null; while (TIEMPO.t - t0 < 2.5) { await esperaJuego(0.05); if (t80 === null && __ang(__D) >= 80) t80 = TIEMPO.t - t0; }
  // (se abre para el otro lado: la punta de la puerta, lejos del jugador)
  const lejos = vdot(vsub(__D.b.pos, __c), __n);
  return { ang: +__ang(__D).toFixed(1), t80: t80 && +t80.toFixed(2), meta: __D.meta, haciaElOtroLado: +lejos.toFixed(2) }; })()`);
await p.screenshot({ path: D + 'puerta_abierta.jpg', type: 'jpeg', quality: 70 });
const c3b = await ev(`(async () => { await __caminar(__B, 2.5); if (window.__DBG) { const L = []; for (const dy of [-0.85, -0.6, -0.3, 0, 0.4, 0.8]) for (const lx of [-0.4, 0, 0.4]) { const o = v3(JUG.pos.x + lx * -__n.z, JUG.pos.y + dy, JUG.pos.z + lx * __n.x), g = mundoRayo(o, v3(-__n.x, 0, -__n.z), 1.5); if (g) L.push(dy + '/' + lx + ':' + g.t.toFixed(2) + (g.caja ? (g.caja.puerta ? 'P' : 'C' + (g.caja.nombre || g.caja.snd || '')) : 'W') + '[' + [g.n.x, g.n.y, g.n.z].map((x) => x.toFixed(1)) + ']'); } console.log('trazaRayos ' + L.join(' ')); } const o = v3(JUG.pos.x, JUG.pos.y + 0.2, JUG.pos.z), d = vsub(__B, JUG.pos); d.y = 0; d.norm(); const g = mundoRayo(o, d, 2), gp = mundoRayo(v3(JUG.pos.x, JUG.pos.y - 0.6, JUG.pos.z), d, 2);
  return { lado: +vdot(vsub(JUG.pos, __c), __n).toFixed(2), suelo: JUG.suelo, choca: g && { t: +g.t.toFixed(2), puerta: !!(g.caja && g.caja.puerta), caja: !!g.caja, n: [g.n.x, g.n.y, g.n.z].map((x) => +x.toFixed(2)) }, chocaPie: gp && { t: +gp.t.toFixed(2), puerta: !!(gp.caja && gp.caja.puerta), caja: !!gp.caja, n: [gp.n.x, gp.n.y, gp.n.z].map((x) => +x.toFixed(2)) }, lat: +Math.abs(vdot(vsub(JUG.pos, __c), v3(-__n.z, 0, __n.x))).toFixed(2) }; })()`);
ok('3. «E: abrir la puerta», con E se abre (≥ 80° en < 2 s, hacia el otro lado) y se cruza caminando', /^E: abrir la puerta/.test(txt.apunta) && c3.t80 !== null && c3.t80 < 2 && c3.haciaElOtroLado < -0.1 && c3b.lado < -0.4, { txt, ...c3, cruce: c3b });
const c4 = await ev(`(async () => {
  // (parado en el marco, se le cierra encima)
  __poner(v3(__c.x, __A.y, __c.z)); await esperaJuego(0.4); const p0 = JUG.pos.clone();
  puertaAlternar(__D, false); const tr = []; { const t0 = TIEMPO.t; while (TIEMPO.t - t0 < 2.2) { await esperaJuego(0.03); tr.push([+__D.k.toFixed(3), __D.meta, puertaTocaJug(__D, 0) ? 1 : 0, +vsub(JUG.pos, p0).len().toFixed(2)].join(' ')); } }
  if (window.__DBG) console.log('traza4 ' + tr.slice(0, 50).join(' | '));
  const r = { meta: __D.meta, ang: +__ang(__D).toFixed(1), adentro: puertaTocaJug(__D, -0.05), movido: +vsub(JUG.pos, p0).len().toFixed(2) };
  // (sin nadie: se cierra del todo)
  __poner(__A); await esperaJuego(0.3); puertaAlternar(__D, false); await esperaJuego(2.5); r.cerrada = +__ang(__D).toFixed(1); r.k = __D.k;
  return r; })()`);
ok('4. cerrándose encima del jugador vuelve a abrirse sin meterlo adentro; sin nadie se cierra del todo', c4.meta === 1 && !c4.adentro && c4.movido < 0.35 && c4.k === 0 && c4.cerrada < 1, c4);
// 5: el botón de la puerta del traje
const c5 = await ev(`(async () => {
  const bt = PUERTAS.bot[0]; if (!bt) return { sinBoton: true };
  const c = bt.lo.clone().add(bt.hi).scale(0.5), H = PUERTAS.l.find((X) => X.P.nombre === 'hev_door'); if (!H) return { sinPuerta: true };
  const lg = __lugar(c, __eje(bt.lo, bt.hi), 1.0); if (!lg) return { sinLugar: true, c: [c.x, c.y, c.z] };
  __poner(lg.p); await esperaJuego(0.5); __mirar(c); await esperaJuego(0.2);
  window.__H = H; window.__y0 = H.b ? H.b.pos.y : 0;
  return { apunta: puertaApunta(), acc: bt.acc, puerta: H.P.nombre, k: H.k }; })()`);
await p.keyboard.press('e');
const c5b = await ev(`(async () => { if (!window.__H) return {}; await esperaJuego(Math.abs(__H.recorrido) / Math.max(0.3, __H.P.velM) + 0.8); return { k: __H.k, subio: __H.b ? +(__H.b.pos.y - __y0).toFixed(2) : null, recorrido: +__H.recorrido.toFixed(2) }; })()`);
ok('5. el botón del mapa (func_button → hev_door): «E: apretar el botón» y la puerta sube', /apretar el botón/.test(c5.apunta || '') && c5b.k === 1 && c5b.subio > 1.5, { ...c5, ...c5b });
// 6: en una sala (lo que se manda y lo que llega)
const c6 = await ev(`(async () => {
  const env = []; const pub0 = publicar; publicar = (t, d) => env.push([t, d]); const on0 = RED.on; RED.on = true;
  puertaAlternar(__D, true); RED.on = on0; publicar = pub0;
  await esperaJuego(1.5); const abierta = __ang(__D);
  puertaRed({ n: __D.i, a: 0, s: 1 }); await esperaJuego(2); const cerrada = __ang(__D);
  return { env: env.filter((x) => x[1] && x[1].k === 'pta'), abierta: +abierta.toFixed(1), cerrada: +cerrada.toFixed(1) }; })()`);
ok('6. en una sala: abrir avisa a los demás y lo que llega de otro la cierra', c6.env.length === 1 && c6.env[0][1].n !== undefined && c6.abierta > 80 && c6.cerrada < 1, c6);
const e1 = err.length;
// 7: ph_motel_blacke_v3
await mapa('143190159', 'WS_ph_motel_blacke_v3');
const c7 = await ev(`({ total: PUERTAS.l.length, conCaja: PUERTAS.l.filter((D) => D.b).length, mapa: MUNDO.nombre })`);
ok('7. ph_motel_blacke_v3: sus 9 puertas, con caja', c7.total === 9 && c7.conCaja === 9, c7);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|\[GMod\]/i.test(x));
ok('8. sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
