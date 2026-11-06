// Ruedas que se despegan del auto (video del usuario: el Sofie —el auto blanco tipo Caterham— quieto en Flatgrass, con dos
// ruedas que aparecen sueltas alrededor y cada vez más lejos). En el Sofie el nodo que junta las cuatro ruedas se llama
// «wheels» y la rueda de atrás a la izquierda lo tomaba como su dibujo: al girar se llevaba el grupo entero.
// En Flatgrass, para cada vehículo con tracción del juego: aparece, el jugador se sube, 3 s quieto y 2 s acelerando:
//  1. ninguna rueda toma como dibujo un nodo que tenga otra rueda adentro;
//  2. cada rueda de la física tiene su rueda dibujada (las que tienen tantos dibujos como ruedas);
//  3. en todo el recorrido, el centro de cada rueda dibujada queda a ≤ 0,35 m de la rueda de la física;
//  4. el Sofie anda (avanza ≥ 3 m en 2 s);
//  5. sin errores de JS.
// uso: node ruedas_autos.mjs URL_HTML [nombres=todos]
import { abrir } from './base.mjs';
const [, , HTML, SOLO = ''] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(1500);
const autos = JSON.parse(await ev(`JSON.stringify(Object.keys(DATA.pf || {}).filter((k) => { const a = DATA.pf[k], A = Array.isArray(a) ? a : a && a.a; return A && A[0] && (A[0].mb || []).includes('SCC_Drivetrain'); }).map((k) => k.split('#')[0]))`))
  .filter((n) => !SOLO || SOLO.split(',').includes(n));
const res = [];
for (const nom of autos) {
  await ev(`(() => { cerrarPaneles(); if (JUG.vehiculo) salirVehiculo(); for (const o of OBJS.slice()) borrarObjeto(o); JUG.pos.set(0, 1, 0); JUG.vel.set(0, 0, 0); JUG.yaw = 0; return 1; })()`).catch(() => {});
  await p.waitForTimeout(400);
  const ini = JSON.parse(await ev(`JSON.stringify((() => { const o = spawnDelante(${JSON.stringify(nom)}, {}); window.__o = o; if (!o || !o.veh) return { ok: false };
    const A = o.md.A, V = o.veh, anc = (a, d) => { for (let k = A[d].pa; k >= 0; k = A[k].pa) if (k === a) return true; return false; };
    const vis = V.ruedas.map((w) => w.vis), grupo = vis.some((i) => i >= 0 && vis.some((j) => j >= 0 && j !== i && anc(i, j)));
    const dibujos = A.filter((x, i) => /wheel|^F[LR]$|^R[LR]$|tire|rueda/i.test(x.n) && !x.wc && o.md.act[i]).length;
    return { ok: true, tipo: V.tipo, ruedas: V.ruedas.length, conDibujo: vis.filter((i) => i >= 0).length, grupo, nombres: vis.map((i) => (i >= 0 ? A[i].n : '-')) }; })())`));
  if (!ini.ok) { res.push({ nom, ok: false }); continue; }
  await p.waitForTimeout(1500);
  await ev(`subirVehiculo(__o); 1`);
  const medir = `(() => { const o = __o, V = o.veh, md = o.md; md.actualizar(); let mx = 0;
    for (const w of V.ruedas) { if (w.vis < 0) continue; const c = m4pt(md.W[w.vis], w.cl.x, w.cl.y, w.cl.z, v3()), pw = vadd(o.b.pos, o.b.q.rot(w.p)); mx = Math.max(mx, c.distTo(pw)); } return mx; })()`;
  let mx = 0; const p0 = JSON.parse(await ev(`JSON.stringify([__o.b.pos.x, __o.b.pos.z])`));
  for (let k = 0; k < 15; k++) { await p.waitForTimeout(200); mx = Math.max(mx, await ev(medir)); }
  const pq = JSON.parse(await ev(`JSON.stringify([__o.b.pos.x, __o.b.pos.z])`));
  await ev(`ENT.teclas.add('KeyW'); 1`);
  for (let k = 0; k < 10; k++) { await p.waitForTimeout(200); mx = Math.max(mx, await ev(medir)); }
  await ev(`ENT.teclas.delete('KeyW'); 1`);
  const p1 = JSON.parse(await ev(`JSON.stringify([__o.b.pos.x, __o.b.pos.z])`));
  res.push({ nom, ...ini, maxDist: +mx.toFixed(2), anduvo: +Math.hypot(p1[0] - pq[0], p1[1] - pq[1]).toFixed(1), quieto: +Math.hypot(pq[0] - p0[0], pq[1] - p0[1]).toFixed(2) });
  await ev(`(() => { if (JUG.vehiculo) salirVehiculo(); return 1; })()`).catch(() => {});
}
const autosOk = res.filter((x) => x.ok);
ok('1. ninguna rueda toma un grupo (un nodo con otra rueda adentro)', autosOk.every((x) => !x.grupo), autosOk.map((x) => [x.nom, x.grupo]));
ok('2. cada rueda de la física tiene su rueda dibujada', autosOk.every((x) => x.conDibujo === x.ruedas), autosOk.map((x) => [x.nom, x.conDibujo + '/' + x.ruedas, x.nombres.join(',')]));
ok('3. las ruedas dibujadas quedan pegadas a las de la física (≤ 0,35 m), quietas y andando', autosOk.every((x) => x.maxDist <= 0.35), autosOk.map((x) => [x.nom, x.maxDist]));
const S = res.find((x) => x.nom === 'Sofie');
ok('4. el Sofie anda (≥ 3 m en 2 s acelerando)', !!S && S.anduvo >= 3, S);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('5. sin errores de JS', !e.length, e.slice(0, 4));
await b.close();
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
