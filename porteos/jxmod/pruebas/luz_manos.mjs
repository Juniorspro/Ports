// Panel (bug 77h3t45d): «Primera persona con iluminación no coordinada con el mapa: con un mod para cambiar las manos,
// las manos tenían una iluminación más brillante que el mapa». En el video, gm_mallparking (Workshop 2619660952): un
// estacionamiento a oscuras y las manos naranjas como a pleno sol. Ahora las manos y el arma usan la luz de cada lugar
// del mapa (gmod_bsp.js gbspLuzHojas / gbspVistaLuz). Se mide con las manos de verdad en la pantalla:
//  1. el mapa trae la luz por lugar (muestras) y en un lugar oscuro es mucho menos que la luz pareja de antes;
//  2. en el lugar más oscuro que se encontró: las manos (lo que cambia en la pantalla al dibujarlas) quedan parecidas a lo
//     que tapan (entre 0,4 y 2,5 veces su brillo) y bastante más oscuras que antes;
//  3. en el lugar más claro: las manos no quedan negras (≥ 0,4 veces lo que tapan) y tienen volumen (las lámparas les dan
//     luz de un lado: el desvío del brillo adentro de las manos es al menos la mitad del de antes, que era con el sol);
//  4. pasar de un lugar a otro no salta de golpe (se acomoda en ~0,5 s) y la cuenta de cada cuadro cuesta < 0,05 ms;
//  5. en un mapa con sol (GM_Bigcity 4T, 210061840), a cielo abierto el sol les da a las manos y no quedan más oscuras que
//     con la luz de antes (≥ 0,6 veces); en un interior sin sol (gm_mallparking), no aplica;
//  6. sin errores de JS.
// uso: node luz_manos.mjs URL_HTML [CALIDAD=bajo|alto] [CARPETA_FOTOS] [ID_MAPA=2619660952] [NOMBRE=gm_mallparking]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CAL = 'bajo', D = '/tmp/claude-0/luz_manos', ID = '2619660952', NOMBRE = 'gm_mallparking'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = '${CAL}'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 40000 ? ok() : setTimeout(f, 30)); f(); }); 1`);
const k = await ev(`(async () => { const A = await gmInstalar('${ID}', { nombre: '${NOMBRE}' }); if (A && A.listo) await A.listo; return [...GBSP.mapas].filter(([, x]) => x.id === '${ID}').map(([k]) => k)[0] || null; })()`);
await ev(`empezarPartida(${JSON.stringify(k)}); 1`);
await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), k, { timeout: 300000 }).catch(() => {});
await p.waitForTimeout(4000); await ev(`typeof cerrarPaneles === 'function' && cerrarPaneles(); 1`);
const info = await ev(`(() => { const L = MUNDO.luzHojas; return { mapa: MUNDO.nombre, muestras: L ? L.n : 0, hojas: L ? L.H.length / 2 : 0, ambS: R.ambS.map((x) => +x.toFixed(3)), armas: ARM.lista.slice(0, 12) }; })()`);
console.log('mapa', info);
// (los lugares: las apariciones y una grilla sobre el piso del mapa; de cada uno, la luz que le llega a los ojos)
const lugares = await ev(`(() => {
  const L = MUNDO.luzHojas, c = new Float32Array(18), out = [], pts = [];
  for (const a of (MUNDO.spawns || []).slice(0, 16)) { const q = a.p || a.pos || a; pts.push([q.x !== undefined ? q.x : q[0], q.y !== undefined ? q.y : q[1], q.z !== undefined ? q.z : q[2]]); }
  const s0 = pts[0] || [JUG.pos.x, JUG.pos.y, JUG.pos.z];
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) pts.push([s0[0] + i * 6, s0[1] + 1, s0[2] + j * 6]);
  for (const q of pts) {
    const piso = mundoRayo(v3(q[0], q[1] + 0.5, q[2]), v3(0, -1, 0), 4); if (!piso || piso.n.y < 0.7) continue;
    const pie = v3(q[0], q[1] + 0.5 - piso.t + 0.02, q[2]), ojo = vadd(pie, v3(0, 1.62, 0));
    // (sin techo encima a menos de 1,9 m: un lugar donde se pueda estar parado)
    const techo = mundoRayo(vadd(pie, v3(0, 0.05, 0)), v3(0, 1, 0), 1.9); if (techo) continue;
    if (!L || !gbspLuzEn(L, ojo, c)) continue;
    const lum = (o) => 0.2126 * c[o] + 0.7152 * c[o + 1] + 0.0722 * c[o + 2];
    const sol = !MUNDO.sinSombra && R.sol.y > 0.02 && !raycast(vadd(ojo, vscale(R.sol, 0.3)), R.sol, 300, null);
    out.push({ q: [pie.x, pie.y, pie.z], sol, arriba: +lum(12).toFixed(4), abajo: +lum(15).toFixed(4), costado: +((lum(0) + lum(3) + lum(6) + lum(9)) / 4).toFixed(4) });
  }
  return out; })()`);
const med = (l) => (l.arriba + l.abajo + 4 * l.costado) / 6;
lugares.sort((a, b) => med(a) - med(b));
const oscuro = lugares[0], claro = lugares[lugares.length - 1];
const lumAnt = info.ambS.reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
ok('1. el mapa trae la luz por lugar y en un lugar oscuro es mucho menos que la luz pareja de antes', info.muestras > 100 && oscuro && 1.9 * Math.pow(med(oscuro) / 4, 1 / 2.2) < lumAnt * 0.7,
  { muestras: info.muestras, hojas: info.hojas, lugares: lugares.length, oscuro: oscuro && med(oscuro).toFixed(4), claro: claro && med(claro).toFixed(4), antes: lumAnt.toFixed(3) });
// las manos: «Hands» (las manos solas, como el mod del video), si no la Physics Gun
const arma = info.armas.includes('Hands') ? 'Hands' : 'PhysicsGun';
await ev(`elegirArma(ARM.lista.indexOf('${arma}')); 1`);
async function foto(nom) {
  await ev(`esperaJuego(0.5)`);
  const buf = await p.screenshot(); fs.writeFileSync(D + '/' + nom + '.png', buf); return buf.toString('base64');
}
// brillo (0–255) de lo que cambia al dibujar las manos: con las manos nuevas (B), las de antes (C) y lo que tapan (A)
const medirManos = (A, B, C) => p.evaluate(async ([a, b2, c2]) => {
  const px = async (s) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, cv.width, cv.height).data; };
  const [A, B, C] = [await px(a), await px(b2), await px(c2)], Y = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  let n = 0, sA = 0, sB = 0, sC = 0, qB = 0, qC = 0;
  for (let i = 0; i < A.length; i += 4) {
    const dif = (X) => Math.max(Math.abs(X[i] - A[i]), Math.abs(X[i + 1] - A[i + 1]), Math.abs(X[i + 2] - A[i + 2]));
    if (dif(B) < 10 && dif(C) < 10) continue; n++; sA += Y(A, i); sB += Y(B, i); sC += Y(C, i); qB += Y(B, i) ** 2; qC += Y(C, i) ** 2;
  }
  // (volumen: el desvío del brillo adentro de las manos sobre su brillo medio —una mano pareja, de un solo color, da 0—)
  const vol = (s, q) => +(Math.sqrt(Math.max(0, q / n - (s / n) ** 2)) / Math.max(1, s / n)).toFixed(3);
  return n ? { px: n, tapan: +(sA / n).toFixed(1), ahora: +(sB / n).toFixed(1), antes: +(sC / n).toFixed(1), volAhora: vol(sB, qB), volAntes: vol(sC, qC) } : { px: 0 };
}, [A, B, C]);
async function lugar(l, nom) {
  await ev(`JUG.noclip = false; JUG.pos.set(${l.q[0]}, ${l.q[1]} + 0.97, ${l.q[2]}); JUG.vel.set(0, 0, 0); JUG.pitch = 0.45; JUG.tercera = false; 1`);
  await ev(`esperaJuego(1.2)`);
  await ev(`EV3.sinVista = true; 1`); const A = await foto(nom + '_sin_manos');
  await ev(`EV3.sinVista = false; DBG.sinLuzVista = false; 1`); const B = await foto(nom + '_ahora');
  await ev(`DBG.sinLuzVista = true; 1`); await ev(`esperaJuego(0.2)`); const C = await foto(nom + '_antes');
  await ev(`DBG.sinLuzVista = false; 1`);
  const m = await medirManos(A, B, C);
  return { ...m, amb: await ev(`R.ambVista ? { gS: R.ambVista.gS.map((x) => +x.toFixed(3)), gG: R.ambVista.gG.map((x) => +x.toFixed(3)), cG: R.ambVista.cG.map((x) => +x.toFixed(3)), dir: R.ambVista.dir.map((x) => +x.toFixed(2)), sol: +R.ambVista.sol.toFixed(2) } : null`) };
}
const mo = oscuro ? await lugar(oscuro, 'oscuro') : null;
ok('2. en el lugar más oscuro: las manos quedan como lo que tapan (0,4–2,5 veces) y más oscuras que antes (≤ 0,7)',
  mo && mo.px > 500 && mo.ahora >= 0.4 * mo.tapan && mo.ahora <= 2.5 * Math.max(mo.tapan, 4) && mo.ahora <= 0.7 * mo.antes, mo);
const mc = claro ? await lugar(claro, 'claro') : null;
ok('3. en el lugar más claro: las manos no quedan negras (≥ 0,4 veces lo que tapan) y tienen volumen (≥ la mitad del de antes)', mc && mc.px > 500 && mc.ahora >= 0.4 * mc.tapan && mc.volAhora >= 0.5 * mc.volAntes, mc);
// 4: de lo claro a lo oscuro, cuánto cambia en el primer cuadro y a los 0,6 s; y lo que cuesta la cuenta
const tr = await ev(`(async () => {
  const lum = () => { const g = R.ambVista.gS; return 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2]; };
  const a = lum(); JUG.pos.set(${oscuro.q[0]}, ${oscuro.q[1]} + 0.97, ${oscuro.q[2]}); JUG.vel.set(0, 0, 0);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const b1 = lum();
  await esperaJuego(0.6); const c = lum();
  const L = MUNDO.luzHojas, cu = new Float32Array(18), t0 = performance.now(); for (let i = 0; i < 2000; i++) gbspLuzEn(L, CAM.pos, cu); const ms = (performance.now() - t0) / 2000;
  return { claro: +a.toFixed(3), primerCuadro: +b1.toFixed(3), a06s: +c.toFixed(3), ms: +ms.toFixed(4) }; })()`);
const salto = Math.abs(tr.primerCuadro - tr.claro) / Math.max(1e-3, Math.abs(tr.a06s - tr.claro));
ok('4. no salta de golpe (el primer cuadro hace < 40 % del cambio, a los 0,6 s ya está) y la cuenta cuesta < 0,05 ms', salto < 0.4 && tr.ms < 0.05, { ...tr, salto: +salto.toFixed(2) });
const alSol = lugares.filter((l) => l.sol).pop();
if (alSol) {
  const ms = await lugar(alSol, 'al_sol');
  ok('5. a cielo abierto el sol les da a las manos y no quedan más oscuras que antes (≥ 0,6 veces)', ms && ms.px > 500 && ms.amb && ms.amb.sol >= 0.9 && ms.ahora >= 0.6 * ms.antes, ms);
} else ok('5. a cielo abierto: no aplica (' + (await ev(`MUNDO.sinSombra ? 'mapa sin sol' : 'ningún lugar ve el sol'`)) + ')', true);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|wss:|mqtt/i.test(x));
ok('6. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
