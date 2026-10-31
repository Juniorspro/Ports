// el agua (agua.js): en el lago de gm_construct nadar (entra, frena, sube y flota con la cara afuera; bucea y vuelve),
// ahogarse, vadear más lento; lo que flota (sofá, caja de madera), lo que se hunde (pesado), el muñeco que flota; la cubeta
// que se llena metida en el agua, que no pierde parada y se vuelca dada vuelta (chorro, charco en el piso); el agua en
// una bañera donde flota una caja; la vista bajo el agua; el reflejo en alto y lo que cuesta; los sombreadores del agua
// en todas las calidades; sin errores.
// uso: node agua.mjs HTML [CARPETA_FOTOS] (el HTML por http, con hypper/emotes al lado, para probar también el cuerpo nadando)
import { abrir } from './base.mjs';
const HTML = process.argv[2], D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(HTML);
const fallidos = []; p.on('response', (r) => { if (r.status() >= 400) fallidos.push(r.status() + ' ' + r.url().split('/').pop()); });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const PASO = `const paso = (n) => { for (let i = 0; i < n; i++) { aguaFisica(1 / 60); physStep(1 / 60); } };`;
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); DIA.hora = 12; DIA.aplicada = -1; 1`);
await p.waitForTimeout(3000);
await ev(`$('hud').classList.add('oc'); 1`);
ok('el lago de gm_construct es un volumen de agua y su material refleja', await ev(`AGUA.vols.length === 1 && AGUA.vols[0].mapa && matGL(DATA.mt.findIndex((m) => m.n === 'GM_agua')).refleja`), await ev(`AGUA.vols.map((v) => [v.y0, v.y1].map((x) => +x.toFixed(2)))`));
// ---- nadar (el jugador, con pasos fijos: 1/60 s)
const nada = await ev(`(() => { const v = AGUA.vols[0], J = JUG, E = { x: 0, y: 0, saltar: false, agachar: false, correr: false }, out = { serie: [] };
  J.pos.set(96, v.y1 + 4, -49.6); J.vel.set(0, -2, 0); J.noclip = false; J.vida = 100; J.aire = 12;
  const ojos = () => J.pos.y - 0.95 + J.ojoAlto - v.y1;
  for (let i = 0; i < 480; i++) { jugadorPaso(1 / 60, E); if (J.nada && out.entra === undefined) out.entra = i / 60; if (i % 30 === 0) out.serie.push(+ojos().toFixed(2)); }
  out.ojos = +ojos().toFixed(3); out.vy = +J.vel.y.toFixed(3); out.minimo = Math.min(...out.serie);
  // bucear: agachado 1 s baja; suelto vuelve arriba en 4 s
  E.agachar = true; for (let i = 0; i < 60; i++) jugadorPaso(1 / 60, E); out.buceo = +ojos().toFixed(2); E.agachar = false;
  for (let i = 0; i < 240; i++) jugadorPaso(1 / 60, E); out.vuelve = +ojos().toFixed(2);
  // ahogarse: sin aire, debajo del agua 2 s
  J.aire = 0; E.agachar = true; const v0 = J.vida; for (let i = 0; i < 120; i++) jugadorPaso(1 / 60, E); out.dano = v0 - J.vida; E.agachar = false;
  return out; })()`);
ok('cae al lago: nada enseguida y frena (no se hunde más de 1,2 m)', nada.entra !== undefined && nada.minimo > -1.2, nada);
ok('quieto flota con los ojos afuera (0 a 30 cm sobre el agua) y sin subir y bajar (< 0,2 m/s)', nada.ojos > 0 && nada.ojos < 0.3 && Math.abs(nada.vy) < 0.2, [nada.ojos, nada.vy]);
ok('agachado bucea y suelto vuelve a la superficie', nada.buceo < -0.4 && nada.vuelve > -0.05, [nada.buceo, nada.vuelve]);
ok('sin aire debajo del agua se ahoga (10 por segundo)', nada.dano >= 10 && nada.dano <= 30, nada.dano);
// ---- el cuerpo nadando (lo ven los demás y en tercera persona): parado flotando, la cabeza afuera; nadando, acostado
// con la cadera justo debajo del agua (las capturas se bajan de al lado del HTML: sólo si se sirve por http)
if (/^https?:/.test(HTML)) {
  await ev(`Promise.all([emoCargar(NADO.nada), emoCargar(NADO.flota)]).then(() => 1)`);
  const cu = await ev(`(() => { const v = AGUA.vols[0], out = {};
    for (const s of ['Hero', 'Jeppy', 'Sunman']) for (const mov of [0, 1]) { const P = crearPersona(s, 'HatEmpty', { nombre: '' }); P.npc = true; const t = P.tam || 1;
      P.pos.set(96, v.y1 + 0.12 - JUG.ojoAlto * t + 0.95, -49.6); P.yaw = 0; P.vel.set(0, 0, mov ? 2 : 0); P.suelo = false;
      for (let k = 0; k < 90; k++) { animarPersona(P, 1 / 30); dibujarPersona(P); }
      P.md.actualizar(); const H = P.D.h, W = P.md.W; out[s + (mov ? ' nada' : ' flota')] = { cadera: +(W[H.Hips][13] - v.y1).toFixed(2), cabeza: +(W[H.Head][13] - v.y1).toFixed(2), cabezaSobreCadera: +(W[H.Head][13] - W[H.Hips][13]).toFixed(2) }; borrarPersona(P); }
    itemsLimpiar(); return out; })()`);
  ok('flotando en el lugar el cuerpo va parado (cabeza ≥ 30 cm sobre la cadera) con la cabeza en la superficie (±25 cm)', ['Hero', 'Jeppy', 'Sunman'].every((s) => { const x = cu[s + ' flota']; return x.cabezaSobreCadera > 0.3 && Math.abs(x.cabeza) < 0.25; }), cu);
  ok('nadando va acostado (cabeza a menos de 20 cm de la altura de la cadera) con la cadera justo debajo del agua (-20 a 0 cm)', ['Hero', 'Jeppy', 'Sunman'].every((s) => { const x = cu[s + ' nada']; return Math.abs(x.cabezaSobreCadera) < 0.2 && x.cadera > -0.2 && x.cadera < 0; }), cu);
}
// ---- vadear: buscar un lugar con el agua entre las rodillas y el pecho
const vadeo = await ev(`(() => { const v = AGUA.vols[0], J = JUG, E = { x: 0, y: 1, saltar: false, agachar: false, correr: false };
  for (let x = v.ax0 + 2; x < v.ax1; x += 1.5) for (let z = v.az0 + 2; z < v.az1; z += 1.5) {
    const h = mundoRayo(v3(x, v.y1 + 5, z), v3(0, -1, 0), 30); if (!h) continue; const fondo = v.y1 + 5 - h.t, hondo = v.y1 - fondo;
    if (hondo > 0.7 && hondo < 1.0) { J.pos.set(x, fondo + 0.97, z); J.vel.set(0, 0, 0); J.nada = false; for (let i = 0; i < 20; i++) jugadorPaso(1 / 60, E); return { hondo: +J.hondo.toFixed(2), vadeo: +J.vadeo.toFixed(2), nada: J.nada }; } }
  return null; })()`);
ok('vadeando con el agua a medio cuerpo camina más lento (55-90 % de la velocidad) sin nadar', vadeo && vadeo.vadeo > 0.55 && vadeo.vadeo < 0.9 && !vadeo.nada, vadeo);
// ---- lo que flota y lo que se hunde (en lo hondo, separados)
const fl = await ev(`(() => { ${PASO} const v = AGUA.vols[0], out = {};
  for (const [n, op, x] of [['Sofa', {}, 90], ['Box4', {}, 96], ['Toilet', { masa: 4000 }, 102]]) {
    const o = crearObjeto(n, v3(x, v.y1 + 1.5, -49.6), new Quat(), op); const serie = [];
    for (let i = 0; i < 480; i++) { aguaFisica(1 / 60); physStep(1 / 60); if (i >= 360) serie.push(o.b.vel.y); }
    out[n] = { y: +(o.b.pos.y - v.y1).toFixed(2), sumergido: +(o.b.aguaK || 0).toFixed(2), vy: +Math.max(...serie.map(Math.abs)).toFixed(3) };
    borrarObjeto(o, true); }
  return out; })()`);
ok('el sofá flota liviano (15-40 % bajo el agua) y quieto a los 6 s (< 5 cm/s)', fl.Sofa.sumergido > 0.15 && fl.Sofa.sumergido < 0.4 && fl.Sofa.vy < 0.05, fl.Sofa);
ok('la caja de madera flota (55-85 % bajo el agua) y quieta', fl.Box4.sumergido > 0.55 && fl.Box4.sumergido < 0.85 && fl.Box4.vy < 0.05, fl.Box4);
ok('lo muy pesado (4000 kg) se hunde hasta el fondo', fl.Toilet.y < -3 && fl.Toilet.sumergido > 0.99, fl.Toilet);
// ---- el muñeco flota
const mu = await ev(`(() => { const v = AGUA.vols[0]; const P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); P.npc = true; P.pos.set(96, v.y1 + 1.2, -44); P.vel.set(0, -1, 0); ragdoll(P, v3(0, 0, 0));
  for (let i = 0; i < 600; i++) { aguaFisica(1 / 60); physStep(1 / 60); ragdollPaso(P); }
  let y = 0, n = 0, vy = 0; for (const [, e] of P.rag.cuerpos) { y += e.b.pos.y; vy = Math.max(vy, Math.abs(e.b.vel.y)); n++; }
  const out = { partes: n, y: +(y / n - v.y1).toFixed(2), vy: +vy.toFixed(3) }; borrarPersona(P); return out; })()`);
ok('el muñeco flota como una persona: casi todo abajo, cerca de la superficie (-0,5 a +0,15 m) y quieto', mu.y > -0.5 && mu.y < 0.15 && mu.vy < 0.1, mu);
// ---- la cubeta: se llena metida en el agua (agarrada con la pistola: sin empuje) y se vuelca en el piso
const cu = await ev(`(() => { ${PASO} const v = AGUA.vols[0], o = crearObjeto('Cubeta', v3(96, v.y1 - 0.6, -40), new Quat()), R2 = o.rec, out = { cap: R2.cap };
  o.b.held = true; for (let i = 0; i < 240; i++) { o.b.pos.set(96, v.y1 - 0.25, -40); o.b.vel.set(0, 0, 0); o.b.ang.set(0, 0, 0); o.b.q.copy(new Quat()); aguaFisica(1 / 60); physStep(1 / 60); }
  out.llena = +R2.l.toFixed(1); o.b.held = false; borrarObjeto(o, true); return out; })()`);
ok('la cubeta metida en el lago se llena (≥ 90 % de ' + Math.round(cu.cap) + ' l en 4 s)', cu.llena >= 0.9 * cu.cap, cu);
await ev(`empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(2500); await ev(`$('hud').classList.add('oc'); 1`);
const vu = await ev(`(() => { ${PASO} const piso = pisoBajo(v3(JUG.pos.x + 4, JUG.pos.y + 2, JUG.pos.z), 10), o = crearObjeto('Cubeta', v3(JUG.pos.x + 4, piso, JUG.pos.z), new Quat()), R2 = o.rec, out = {};
  R2.l = R2.cap; paso(60); out.parada = +(R2.l / R2.cap).toFixed(3); out.masa = +o.b.mass.toFixed(1);
  // dada vuelta (135°): se vacía por la boca, el chorro cae y deja un charco
  o.b.q.copy(Quat.axis(1, 0, 0, 2.36)); o.b.pos.y += 0.4; o.b.wake(); let t = 0;
  for (let i = 0; i < 300; i++) { aguaFisica(1 / 60); physStep(1 / 60); aguaGotasPaso(1 / 60); aguaCharcosPaso(1 / 60); if (R2.l < 0.5 && !t) t = i / 60; }
  out.vacia = t; out.queda = +R2.l.toFixed(2); out.masaFin = +o.b.mass.toFixed(1); out.charcos = AGUA.charcos.length; out.litrosCharco = +AGUA.charcos.reduce((s, c) => s + c.total, 0).toFixed(1);
  window.__cub = o; return out; })()`);
ok('la cubeta llena parada no pierde agua (≥ 99 %) y pesa con el agua', vu.parada >= 0.99 && vu.masa > 40, vu);
ok('dada vuelta se vacía en menos de 2,5 s y vuelve a su peso', vu.vacia > 0 && vu.vacia < 2.5 && vu.masaFin < 3.5, vu);
ok('el agua que cae hace un charco en el piso (≥ 10 l)', vu.charcos >= 1 && vu.litrosCharco >= 10, vu);
await ev(`JUG.yaw = Math.atan2(window.__cub.b.pos.x - JUG.pos.x, window.__cub.b.pos.z - JUG.pos.z); JUG.pitch = 0.45; 1`); await p.waitForTimeout(600);
await p.screenshot({ path: D + 'agua_charco.png' });
// ---- la bañera con agua: una caja flota adentro
const ba = await ev(`(() => { const piso = pisoBajo(v3(JUG.pos.x - 5, JUG.pos.y + 2, JUG.pos.z), 10), o = crearObjeto('BaneraPatas', v3(JUG.pos.x - 5, piso, JUG.pos.z), new Quat(), { congelado: true }), R2 = o.rec;
  R2.l = R2.cap * 0.7; aguaFisica(1 / 60); const c = crearObjeto('Box4', v3(R2.vol.cx, R2.vol.y1 + 0.5, R2.vol.cz), new Quat());
  for (let i = 0; i < 360; i++) { aguaFisica(1 / 60); physStep(1 / 60); }
  return { nivel: +(R2.vol.y1 - R2.vol.y0).toFixed(2), caja: +(c.b.pos.y - R2.vol.y0).toFixed(2), sumergido: +(c.b.aguaK || 0).toFixed(2), vy: +Math.abs(c.b.vel.y).toFixed(3) }; })()`);
ok('en la bañera con agua la caja flota (despegada del fondo, parte bajo el agua)', ba.sumergido > 0.3 && ba.sumergido < 0.95 && ba.caja > 0.15 && ba.vy < 0.05, ba);
await ev(`JUG.yaw = Math.PI * 1.5; JUG.pitch = 0.5; JUG.pos.x += 0; 1`); await p.waitForTimeout(600);
await p.screenshot({ path: D + 'agua_banera.png' });
// ---- de nuevo en el lago: la vista bajo el agua, el reflejo y su costo, los sombreadores en todas las calidades
await ev(`empezarPartida('RB_Construct'); 1`); await p.waitForTimeout(2500); await ev(`$('hud').classList.add('oc'); 1`);
await ev(`JUG.pos.set(96, AGUA.vols[0].y1 - 3, -49.6); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = -0.3; JUG.aire = 12; 1`); await p.waitForTimeout(500);
const bajo = await ev(`(() => { let nie = null; const f = luzLineal; luzLineal = function () { nie = R.niebla.b; return f.apply(this, arguments); }; return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => { luzLineal = f; ok({ bajo: AGUA.bajo, niebla: nie }); }))); })()`);
ok('con la cámara bajo el agua: vista de debajo del agua (niebla de cerca: < 20 m)', bajo.bajo && bajo.niebla > 0 && bajo.niebla < 20, bajo);
await p.screenshot({ path: D + 'agua_bajo.png' });
await ev(`JUG.pos.set(70, 2, -60); JUG.vel.set(0, 0, 0); JUG.yaw = 0.9; JUG.pitch = 0.12; 1`); await p.waitForTimeout(1500);
const costo = await ev(`(async () => { const raf = () => new Promise((ok) => requestAnimationFrame(() => ok())), out = {};
  for (const r of [3, 0, 3, 0]) { GFX.refl = r; await raf(); await raf(); let ms = 0, dib = 0; for (let k = 0; k < 20; k++) { await raf(); ms += DIB.ms.escena; dib += R.dibujadas; } out[r] = (out[r] || []).concat([[+(ms / 20).toFixed(2), Math.round(dib / 20)]]); }
  GFX.refl = 3; await raf(); await raf(); out.refOn = AGUA.refOn; out.rt = AGUA.rt && [AGUA.rt.w, AGUA.rt.h]; out.lienzo = [R.cv.width, R.cv.height]; return out; })()`);
ok('en alto el lago refleja la escena (a un tercio de la resolución)', costo.refOn && costo.rt && Math.abs(costo.rt[0] - costo.lienzo[0] / 3) <= 1, costo);
await p.screenshot({ path: D + 'agua_reflejo.png' });
console.log('     costo del reflejo (ms de escena, dibujos) con / sin:', JSON.stringify(costo[3]), JSON.stringify(costo[0]));
const shd = [];
for (const g of ['patata', 'bajo', 'medio', 'ultra']) {
  await ev(`PREFS.gfx = '${g}'; aplicarGfx(); 1`); await p.waitForTimeout(1200);
  shd.push([g, await ev(`({ err: R.errShader || null, refOn: AGUA.refOn })`)]);
  if (g === 'patata' || g === 'ultra') await p.screenshot({ path: D + 'agua_' + g + '.png' });
}
ok('el agua se dibuja en todas las calidades sin errores de sombreador (refleja sólo en alto y ultra)', shd.every(([g, x]) => !x.err && x.refOn === (g === 'ultra')), shd);
// ---- costo de la física: 20 cosas flotando
const cf = await ev(`(() => { const v = AGUA.vols[0], L = []; for (let i = 0; i < 20; i++) L.push(crearObjeto(['Sofa', 'Box4', 'Cubeta', 'Vase'][i % 4], v3(84 + (i % 5) * 4, v.y1 + 0.5, -56 + Math.floor(i / 5) * 4), new Quat()));
  for (let i = 0; i < 120; i++) { aguaFisica(1 / 60); physStep(1 / 60); }
  const t0 = performance.now(); for (let i = 0; i < 300; i++) aguaFisica(1 / 60); const ms = (performance.now() - t0) / 300;
  const flotan = L.filter((o) => o.b.aguaK > 0).length; for (const o of L) borrarObjeto(o, true); return { msPorPaso: +ms.toFixed(3), flotan }; })()`);
ok('el empuje de 20 cosas en el agua cuesta < 0,3 ms por paso de física', cf.msPorPaso < 0.3 && cf.flotan >= 18, cf);
// (el servidor de prueba no tiene favicon.ico: no cuenta)
const errs = err.filter((e) => !/WebSocket|ERR_CONNECTION|net::/.test(e) && !(/404/.test(e) && fallidos.every((f) => /favicon/.test(f))));
ok('sin errores (ni pedidos que fallen, salvo el favicon)', !errs.length && fallidos.every((f) => /favicon/.test(f)), { errs: errs.slice(0, 5), fallidos });
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
