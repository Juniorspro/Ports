// destrucción de autos (destruccion.js) y explosiones: un Sedan contra la pared de RB_Construct a 100 km/h y otro a
// 40 km/h (la trompa hundida para atrás, la cola intacta, cuánto se hunde según la velocidad, normales sanas, el daño,
// las ruedas que se sueltan, el humo del motor), una explosión al costado de un auto (se hunde el lado de la
// explosión), un auto que explota (se infla y queda ardiendo), el tiempo de cada abolladura y que al borrar el auto se
// suelten sus búferes. Saca capturas de cada cosa. uso: node destruccion.mjs URL_HTML [carpeta de capturas]
import { abrir } from './base.mjs';
const [, , HTML, DIR = '.'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; PREFS.evento = false; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); DIA.hora = 15; inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && MUNDO.nombre === 'RB_Construct'`), null, { timeout: 180000 });
await p.waitForTimeout(3000);
await ev(`(() => { DIA.hora = 15; JUG.pos.set(-14, -3, 4); JUG.vel.set(0, 0, 0);
  window.__golpes = []; window.__ms = {}; const __mide = (n, f0) => function () { const t = performance.now(), r = f0.apply(this, arguments); __ms[n] = +((__ms[n] || 0) + performance.now() - t).toFixed(2); return r; };
  desNodo = __mide('desNodo', desNodo); desAbollar = __mide('desAbollar', desAbollar); desChispas = __mide('desChispas', desChispas); desSonar = __mide('desSonar', desSonar); desSoltarRueda = __mide('desSoltarRueda', desSoltarRueda); desSubir = __mide('desSubir', desSubir);
  const g0 = desGolpe; desGolpe = function (o, h, lado) { const t = performance.now(); g0(o, h, lado); __golpes.push({ v: +h.v.toFixed(2), ms: +(performance.now() - t).toFixed(2), auto: o.id }); };
  window.__esperar = (s) => new Promise((r) => { const t0 = TIEMPO.t; const f = () => (TIEMPO.t - t0 >= s ? r() : setTimeout(f, 16)); f(); });
  // (cámara fija relativa a un auto: desde ese punto de su marco, mirando a otro)
  window.__cam = (o, de, a) => { const pp = vadd(o.b.pos, o.b.q.rot(de)), m = vadd(o.b.pos, o.b.q.rot(a)), d = vsub(m, pp).norm(); DBG.sinVista = true; DBG.cam = { p: pp, q: Quat.euler(Math.atan2(d.x, d.z), -Math.asin(clamp(d.y, -1, 1)), 0) }; };
  window.__camW = (pp, m) => { const d = vsub(m, pp).norm(); DBG.sinVista = true; DBG.cam = { p: pp.clone(), q: Quat.euler(Math.atan2(d.x, d.z), -Math.asin(clamp(d.y, -1, 1)), 0) }; };
  // (cómo quedó la chapa, en el marco del auto: cuánto se movió cada vértice comparado con la malla original)
  window.__des = (o) => { const C = o.des; if (!C) return null; objetoMatriz(o); o.md.actualizar(); const inv = o.b.q.clone().conj(), c = desCaja(o), largo = c.mx.z - c.mn.z;
    let maxD = 0, n5 = 0, maxAtras = 0, nb = 0, zmin = 1e9, nodos = 0; const sum = v3(), lat = v3();
    for (const k in C.n) { const N = C.n[k]; if (!N) continue; nodos++; const W = o.md.W[N.i], P0 = mallaCPU(N.base).P;
      for (let j = 0; j < N.d.v; j++) { const L = Math.hypot(N.S8[j * 14 + 6], N.S8[j * 14 + 7], N.S8[j * 14 + 8]); if (L < 100 || L > 132) nb++;
        if (!(N.D[j] > 0)) continue;
        const la = inv.rot(vsub(m4pt(W, P0[j * 3], P0[j * 3 + 1], P0[j * 3 + 2], v3()), o.b.pos)), lb = inv.rot(vsub(m4pt(W, N.P[j * 3], N.P[j * 3 + 1], N.P[j * 3 + 2], v3()), o.b.pos)), dd = vsub(lb, la), l = dd.len();
        maxD = Math.max(maxD, l); if (l > 0.05) { n5++; sum.addS(vscale(dd, 1 / l), 1); zmin = Math.min(zmin, la.z); lat.addS(v3(Math.sign(la.x), 0, 0), 1); }
        if (la.z < c.mn.z + largo * 0.3) maxAtras = Math.max(maxAtras, l); } }
    const s = sum.len() ? vscale(sum, 1 / sum.len()) : v3();
    return { maxD: +maxD.toFixed(3), n5, dir: [s.x, s.y, s.z].map((v) => +v.toFixed(2)), zmin: +zmin.toFixed(2), frente: +c.mx.z.toFixed(2), atras: +maxAtras.toFixed(4), normMal: nb, nodos, vida: Math.round(o.veh.vida), ruedas: o.veh.ruedas.length, lado: n5 ? +(lat.x / n5).toFixed(2) : 0 }; };
  return 1; })()`);
const foto = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${DIR}/des_${n}.png` }); };
// un auto parado a 4 m de la pared, que sale a la velocidad pedida
const chocar = (x, v) => ev(`(async () => { const o = crearObjeto('Sedan', v3(${x}, -2.4, 19.2), new Quat()); await __esperar(1.2); window.__o = o;
  __cam(o, v3(3.6, 1.1, 6.2), v3(0, 0.1, 1.8)); await new Promise((r) => setTimeout(r, 900)); return o.id; })()`);
const soltar = (v) => ev(`(async () => { const o = __o; __golpes.length = 0; for (const k in __ms) delete __ms[k]; o.b.vel.set(0, 0, ${v}); o.b.wake(); await __esperar(1.6); return JSON.stringify({ golpes: __golpes.slice(0, 6), des: __des(o), ms: __ms, piezas: DES.piezas.map((P) => ({ y: +P.b.pos.y.toFixed(2), r: +P.b.shape.r.toFixed(2) })) }); })()`);
// 1) 100 km/h
await chocar(-2, 27.78); await foto('100_antes');
const r1 = JSON.parse(await soltar(27.78));
await ev(`__cam(__o, v3(3.6, 1.1, 6.2), v3(0, 0.1, 1.8)); 1`); await foto('100_despues');
await ev(`__cam(__o, v3(4.8, 0.9, 0.5), v3(0, 0.2, 0.6)); 1`); await foto('100_costado');
const g1 = r1.golpes[0] || {}, d1 = r1.des || {};
ok('100 km/h: la trompa se hunde 30 a 55 cm', d1.maxD >= 0.3 && d1.maxD <= 0.55, { impacto: g1.v, maxD: d1.maxD, vertices5cm: d1.n5 });
ok('100 km/h: hacia atrás (el vértice promedio se mueve a -z)', d1.dir && d1.dir[2] < -0.75, { dir: d1.dir });
ok('100 km/h: lo hundido es la parte de adelante y la cola queda intacta (< 1 cm)', d1.zmin > d1.frente - 2.2 && d1.atras < 0.01, { desde_z: d1.zmin, frente: d1.frente, atras: d1.atras });
ok('normales sanas (ninguna rota)', d1.normMal === 0, { malas: d1.normMal });
ok('100 km/h: daño fuerte sin explotar (vida 60–160 de 400) y ruedas de adelante sueltas', d1.vida >= 60 && d1.vida <= 160 && d1.ruedas <= 3, { vida: d1.vida, ruedas: d1.ruedas });
const ms1 = Math.max(...r1.golpes.map((g) => g.ms));
ok('cada golpe cuesta menos de 12 ms (el primero, con la copia de la malla)', ms1 < 12, { ms: r1.golpes.map((g) => g.ms), partes: r1.ms });
ok('la rueda suelta es una pieza con su radio y no atraviesa el piso', r1.piezas.length >= 1 && r1.piezas.every((q) => q.y > -3.9), r1.piezas);
// el humo del motor (dañado: vida < 60 %)
const humo = await ev(`(async () => { await __esperar(2); const o = __o, c = desCaja(o), m = vadd(o.b.pos, o.b.q.rot(v3(0, 0, c.mx.z - 0.6))); __cam(o, v3(4.5, 2.2, 5.5), v3(0, 0.8, 1.2));
  return PART.l.filter((q) => q.tipo === 'humo' && q.t > 0 && q.p.distTo(m) < 4).length; })()`);
await foto('100_humo');
ok('el motor dañado echa humo', humo >= 4, { bocanadas: humo });
// 2) 40 km/h, otro auto
await ev(`borrarObjeto(__o); 1`);
await chocar(3, 11.11);
const r2 = JSON.parse(await soltar(11.11)), d2 = r2.des || {};
await ev(`__cam(__o, v3(3.6, 1.1, 6.2), v3(0, 0.1, 1.8)); 1`); await foto('40_despues');
ok('40 km/h: se hunde menos (6 a 22 cm) y no pierde ruedas', d2.maxD >= 0.06 && d2.maxD <= 0.22 && d2.ruedas === 4, { impacto: (r2.golpes[0] || {}).v, maxD: d2.maxD, ruedas: d2.ruedas, vida: d2.vida });
// 3) explosión al costado (a 2,6 m del lado derecho, +x del auto)
const r3 = JSON.parse(await ev(`(async () => { const o = __o; const pe = vadd(o.b.pos, o.b.q.rot(v3(2.6, -0.3, 0))); __camW(vadd(o.b.pos, v3(7, 2.5, -7)), vadd(o.b.pos, v3(0.5, 0.3, 0)));
  const d0 = __des(o); explosion(pe, 4, 20); await __esperar(0.15); window.__d0 = d0; return JSON.stringify({ d0, d: __des(o) }); })()`));
await foto('explosion_015');
await ev(`__esperar(0.5)`); await foto('explosion_065');
await ev(`__esperar(1.6)`); await foto('explosion_225');
ok('explosión: la chapa se hunde del lado de la explosión', r3.d && r3.d.lado > 0.5 && r3.d.n5 > r3.d0.n5, { lado: r3.d && r3.d.lado, n5: [r3.d0.n5, r3.d && r3.d.n5] });
const fuego = await ev(`DES.fuegos.length`);
ok('queda fuego en el piso después de la explosión', fuego >= 1, { fuegos: fuego });
// 4) el auto explota: se infla, salta alguna rueda y queda ardiendo
const r4 = JSON.parse(await ev(`(async () => { const o = __o; const n0 = __des(o).n5; danarObjeto(o, 999, o.b.pos, v3(0, 1, 0)); await __esperar(2.5); __camW(vadd(o.b.pos, v3(6, 3, -6)), vadd(o.b.pos, v3(0, 0.4, 0)));
  return JSON.stringify({ roto: o.veh.roto, n0, d: __des(o), fuego: PART.l.filter((q) => q.tipo === 'fuego' && q.t > 0 && q.p.distTo(o.b.pos) < 4).length }); })()`));
await foto('roto');
ok('al explotar: roto, la carrocería inflada (más vértices movidos) y ardiendo', r4.roto && r4.d.n5 > r4.n0 && r4.fuego >= 4, { n5: [r4.n0, r4.d.n5], llamas: r4.fuego, ruedas: r4.d.ruedas });
// 5) al borrar, se sueltan los búferes
const r5 = await ev(`(async () => { const o = __o, ids = Object.values(o.des.n).filter(Boolean).map((N) => N.id); borrarObjeto(o); await __esperar(1.3);
  return JSON.stringify({ ids: ids.length, quedan: ids.filter((i) => R.mallas[i]).length, autos: DES.autos.length }); })()`);
const q5 = JSON.parse(r5); ok('al borrar el auto se sueltan sus copias de malla', q5.ids > 0 && q5.quedan === 0 && q5.autos === 0, q5);
// 6) los otros autos (otras escalas: el Derby viene ×2,67, el patrullero en centímetros): misma prueba a 100 km/h
for (const A of ['Derby6', 'police_car_v4']) {
  const r = JSON.parse(await ev(`(async () => { for (const o of OBJS.slice()) if (o.veh) borrarObjeto(o); await __esperar(1.2);
    const o = crearObjeto('${A}', v3(-2, -2.4, 19.2), new Quat()); await __esperar(1.2); window.__o = o; __golpes.length = 0; for (const k in __ms) delete __ms[k];
    o.b.vel.set(0, 0, 27.78); o.b.wake(); await __esperar(1.6); __cam(o, v3(3.6, 1.3, 6.4), v3(0, 0.1, 1.8)); return JSON.stringify({ golpes: __golpes.slice(0, 4), des: __des(o) }); })()`));
  await foto('100_' + A);
  const d = r.des || {};
  ok(`${A} a 100 km/h: se hunde la trompa (25–55 cm) hacia atrás, la cola intacta, normales sanas, < 12 ms`, d.maxD >= 0.25 && d.maxD <= 0.55 && d.dir[2] < -0.7 && d.atras < 0.01 && d.normMal === 0 && Math.max(...r.golpes.map((g) => g.ms)) < 12, { impacto: (r.golpes[0] || {}).v, maxD: d.maxD, dir: d.dir, atras: d.atras, malas: d.normMal, nodos: d.nodos, ms: r.golpes.map((g) => g.ms) });
}
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
