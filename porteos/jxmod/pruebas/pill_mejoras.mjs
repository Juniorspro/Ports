// Pill Packs: saltar, más velocidad y los ajustes (pedido de Deep en el Discord: «Mejora en los Pill Packs»).
// · La referencia: el jugador de siempre (camina y corre; su salto), medido en el reloj de la física (no en el de la
//   pared: con el navegador por software van a pocos cuadros por segundo y la física a menos de tiempo real).
// · Cada Pill propio: camina por lo menos como el jugador, su carrera le gana al correr del jugador, Foxy es el que más
//   corre y Freddy camina al mínimo; salta (Espacio; en el celular, el botón de saltar de siempre) a su altura, con la
//   animación de salto, y al caer los pies no atraviesan el piso (comparado con parado).
// · Los ajustes de la pestaña (Velocidad y Tiempo de recarga): están, con la identidad de los menús; cambian la velocidad,
//   la espera de las habilidades y lo que tarda en volver el poder; se guardan (recargando la página siguen) y «Por
//   defecto» los vuelve a ×1; los textos en los 14 idiomas y que entren.
// uso: node pill_mejoras.mjs URL_HTML CARPETA_FOTOS [celu]   (URL_HTML con http://; un python3 -m http.server en su carpeta)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, DIR = '.', MODO] = process.argv, D = DIR.replace(/\/?$/, '/'), CELU = MODO === 'celu', PRE = CELU ? 'celu_' : 'pc_'; fs.mkdirSync(D, { recursive: true });
let ok = 0, mal = 0; const res = (b, t, x) => { b ? ok++ : mal++; console.log((b ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
const prefs = { bienvenida: true, gfx: 'medio', res: 100, resDin: false, fps: false, lang: 'es', motor: 'webgl2', motorV: 2 };
const { b, p, err, ev } = await abrir(HTML, CELU, null, async (pg) => {
  // (una vez: la primera carga empieza sin ajustes guardados; al recargar, se queda con lo que guardó el juego)
  await pg.addInitScript((pr) => { try { if (sessionStorage.getItem('pmPrueba')) return; sessionStorage.setItem('pmPrueba', '1'); const o = Object.assign(JSON.parse(localStorage.getItem('jx_prefs') || '{}'), pr); delete o.pillVel; delete o.pillRec; localStorage.setItem('jx_prefs', JSON.stringify(o)); localStorage.removeItem('jx_pills_xp'); } catch (e) {} }, prefs);
});
const J = async (s) => JSON.parse(await ev(`JSON.stringify(${s})`));
const cuadros = async (n) => { const m0 = await ev(`R.marca`); for (let i = 0; i < 150 && (await ev(`R.marca`)) < m0 + n; i++) await p.waitForTimeout(50); };
const foto = async (n) => { await cuadros(2); await p.screenshot({ path: D + PRE + n + '.png' }); };
const empezar = async () => {
  await ev(`GFX.auto = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForFunction(() => window.__ev(`MUNDO.nombre === 'FlatGrass' && JUEGO.estado === 'juego'`), null, { timeout: 120000, polling: 300 });
  await p.waitForTimeout(2500);
  // (medir: el reloj de la física —jugadorPaso—, caminar un rato y lo recorrido en el último segundo, saltar y lo más alto)
  await ev(`window.__simT = 0; { const f0 = jugadorPaso; jugadorPaso = function (dt) { window.__simT += dt; return f0.apply(this, arguments); }; }
  window.__piso = () => new Promise((ok) => { const t0 = performance.now(), s0 = window.__simT; const f = () => { if ((JUG.suelo && JUG.tiempoSuelo > 0.25) || window.__simT - s0 > 5 || performance.now() - t0 > 120000) ok(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  window.__pies = () => { const P = JUG.cuerpo, Dd = P.D, md = P.md; if (!Dd || !Dd.h || Dd.h.LeftFoot === undefined) return null; md.actualizar(); let bajo = Math.min(md.W[Dd.h.LeftFoot][13], md.W[Dd.h.RightFoot][13]) - Dd.tobillo; const pz = Dd.pies;
    if (pz) for (const [l, iF] of [['L', Dd.h.LeftFoot], ['R', Dd.h.RightFoot]]) { const W = md.W[iF]; for (const q of pz[l]) { const y = W[1] * q.x + W[5] * q.y + W[9] * q.z + W[13]; if (y < bajo) bajo = y; } }
    const g = mundoRayo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), v3(0, -1, 0), 10); return g ? bajo - (JUG.pos.y + 0.5 - g.t) : null; };
  // (la aparición, sin objetos sueltos cerca: uno caído ahí hacía saltar desde arriba de él. Hacia dónde correr: el rumbo
  // con más camino llano y sin paredes desde la aparición; en FlatGrass, derecho hacia +z hay un escalón a 40 m y una pared
  // a 45, y Foxy a ×1,5 los alcanzaba)
  window.__rumbo = (() => { const s = MUNDO.spawns[0] || JUG.pos; let mejor = 0, lejos = -1;
    for (let k = 0; k < 24; k++) { const a = k * TAU / 24, d = v3(Math.sin(a), 0, Math.cos(a)); let ok = 0, y0 = null;
      for (let m = 6; m <= 90; m += 3) { const q = v3(s.x + d.x * m, s.y + 3, s.z + d.z * m), g = mundoRayo(q, v3(0, -1, 0), 30); if (!g) break; const y = q.y - g.t; if (y0 === null) y0 = y; if (Math.abs(y - y0) > 0.15) break; ok = m; }
      const w = raycast(v3(s.x, s.y + 0.4, s.z), d, 95, null), lim = Math.min(ok, w ? w.t - 2 : 95); if (lim > lejos) { lejos = lim; mejor = a; } }
    return { yaw: mejor, m: lejos }; })();
  window.__lugar = () => { const sp = MUNDO.spawns[0] || v3(0, 5, 0); for (const o of [...OBJS]) if (o.b && o.b.pos.distTo(sp) < 8) borrarObjeto(o); JUG.pos.set(sp.x, sp.y + 0.2, sp.z); JUG.vel.set(0, 0, 0); JUG.yaw = window.__rumbo.yaw; JUG.pitch = 0.12; };
  window.__mv = async (teclas, banderas, ms) => {
    window.__lugar(); await window.__piso(); if (PILL.on) { PILL.pod = pillPodMax(); PILL.cd = [0, 0, 0, 0]; }
    for (const k of teclas) ENT.teclas.add(k); for (const k of banderas) ENT[k] = true;
    const L = [], t0 = window.__simT;
    await new Promise((ok) => { const f = () => { L.push([window.__simT, JUG.pos.x, JUG.pos.z]); if (window.__simT - t0 < ms / 1000) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
    for (const k of teclas) ENT.teclas.delete(k); for (const k of banderas) ENT[k] = false; ENT.x = ENT.y = 0;
    const fin = L[L.length - 1]; let a = L[0]; for (const q of L) if (fin[0] - q[0] <= 0.7) { a = q; break; }   // (los últimos 0,7 s: ya a toda velocidad)
    return +(Math.hypot(fin[1] - a[1], fin[2] - a[2]) / (fin[0] - a[0])).toFixed(2);
  };
  // saltar con la tecla (compu) o con el botón de saltar de la pantalla (celular: un toque de verdad sobre #bsaltar)
  window.__salto = async (celu) => {
    window.__lugar(); await window.__piso(); for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
    const quieto = window.__pies(), y0 = JUG.pos.y; let yM = y0, salio = false, anim = false, cae = null, piesMin = 1, tAp = null, cuadros = 0;
    const bt = $('bsaltar'), r = bt.getBoundingClientRect(), tq = () => new Touch({ identifier: 77, target: bt, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    const visto = celu ? !!(bt.getClientRects().length && getComputedStyle(bt).display !== 'none' && getComputedStyle(bt).visibility !== 'hidden') : null;
    if (celu) { const t = tq(); bt.dispatchEvent(new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true })); } else ENT.teclas.add('Space');
    const t0 = window.__simT;
    await new Promise((ok) => { const f = () => {
      cuadros++;
      if (cuadros === 5) { if (celu) { const t = tq(); bt.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [t], bubbles: true, cancelable: true })); } else ENT.teclas.delete('Space'); }
      const P = JUG.cuerpo; if (JUG.pos.y > yM) { yM = JUG.pos.y; tAp = window.__simT; }
      if (!JUG.suelo) { salio = true; if (P && P.hum && /\\|a\\|/.test(P.hum.clave || '')) anim = true; }
      if (salio && JUG.suelo && cae === null) cae = window.__simT;
      if (cae !== null) { const q = window.__pies(); if (q !== null) piesMin = Math.min(piesMin, q); }
      if ((cae !== null && window.__simT - cae > 0.5) || window.__simT - t0 > 5) ok(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    if (!celu) ENT.teclas.delete('Space'); ENT.saltar = false;
    return { alto: +(yM - y0).toFixed(3), salio, anim, quieto: quieto === null ? null : +quieto.toFixed(3), cae: +piesMin.toFixed(3), visto };
  }; 1`);
};
await empezar();

// ---- la referencia: el jugador de siempre ----
const jug = { camina: await p.evaluate(() => window.__ev(`window.__mv(['KeyW'], [], 1600)`)) };
// (en el celular se corre con la palanca al tope: lo mismo que Shift, ×1,35)
jug.corre = CELU ? +(jug.camina * 1.35).toFixed(2) : await p.evaluate(() => window.__ev(`window.__mv(['KeyW', 'ShiftLeft'], [], 1600)`));
jug.salto = await p.evaluate((c) => window.__ev(`window.__salto(${c})`), CELU);
console.log('jugador de siempre:', JSON.stringify(jug), 'rumbo:', JSON.stringify(await J('window.__rumbo')));
res(Math.abs(jug.camina - 6) < 0.15 && jug.salto.alto > 0.95, 'el jugador de siempre: camina a 6 m/s y salta ~1,1 m (la referencia)', jug);

// ---- cada Pill: velocidad, carrera y salto ----
const IDS = CELU ? ['freddy', 'foxy', 'boiled', 'jake', 'goku', 'astronauta'] : await J(`PILL_PROPIOS.map((d) => d.id)`);
const FOTOS = new Set(['freddy', 'foxy', 'boiled', 'jake', 'goku']);
const tabla = {};
for (const id of IDS) {
  await ev(`cerrarPaneles(); pillAplicar('${id}'); 1`);
  await p.waitForFunction((x) => window.__ev(`PILL.on && PILL.id === '${x}' && JUG.cuerpo && JUG.cuerpo.skin === PILL.def.skin`), id, { timeout: 60000, polling: 300 }).catch(() => {});
  await p.waitForTimeout(600);
  const camina = await p.evaluate(() => window.__ev(`window.__mv(['KeyW'], [], 1600)`));
  const carrera = await p.evaluate((c) => window.__ev(c ? `window.__mv(['KeyW'], ['pillA2'], 1600)` : `window.__mv(['KeyW', 'ShiftLeft'], [], 1600)`), CELU);
  // (sin poder, Shift es el correr de siempre: ×1,35; en dos, la máquina de las pruebas no da para más)
  const sinPoder = CELU || !['freddy', 'foxy'].includes(id) ? null : await p.evaluate(() => window.__ev(`(async () => { const f0 = pillCarrera; pillCarrera = function (h, ap, dt) { PILL.pod = 0; return f0.call(this, h, false, dt); }; try { return await window.__mv(['KeyW', 'ShiftLeft'], [], 1600); } finally { pillCarrera = f0; } })()`));
  const nominal = await J(`({ salto: pillSaltoDe(PILL.def), vel: PILL.def.vel, tope: PILL.def.hab[2] ? +(PILL.def.vel * PILL.def.hab[2].mult).toFixed(2) : null })`);
  const fotoSalto = FOTOS.has(id);
  const sal = await p.evaluate((c) => window.__ev(`window.__salto(${c})`), CELU);
  tabla[id] = { camina, carrera, sinPoder, salto: sal.alto, nominal };
  res(camina >= jug.camina - 0.1 && carrera > jug.corre * 1.1 && (sinPoder === null || sinPoder >= jug.corre - 0.15), `${id}: camina ≥ el jugador (${jug.camina}) y su carrera le gana a su correr (${jug.corre})`, { camina, carrera, sinPoder });
  res(sal.salio && Math.abs(sal.alto - nominal.salto) < 0.14 * nominal.salto && sal.alto > 0.6 && sal.visto !== false, `${id}: salta${CELU ? ' con el botón de saltar' : ''} a su altura (${nominal.salto.toFixed(2)} m)`, { alto: sal.alto, visto: sal.visto });
  res(sal.anim, `${id}: en el aire, la animación de salto`);
  res(sal.quieto !== null && sal.cae >= sal.quieto - 0.03, `${id}: al caer los pies no atraviesan el piso (lo más bajo, comparado con parado)`, { parado: sal.quieto, alCaer: sal.cae });
  if (fotoSalto) {
    // (la foto en lo alto del salto, desde la cámara del juego)
    await ev(`window.__lugar(); JUG.yaw = 0.5; 1`); await p.evaluate(() => window.__ev(`window.__piso()`));
    await ev(`ENT.teclas.add('Space'); 1`); await cuadros(2); await ev(`ENT.teclas.delete('Space'); 1`);
    for (let i = 0; i < 60 && !(await J(`!JUG.suelo && JUG.vel.y < 0.8`)); i++) await p.waitForTimeout(30);
    await p.screenshot({ path: D + PRE + 'salto_' + id + '.png' });
    await p.evaluate(() => window.__ev(`window.__piso()`));
  }
}
console.log('TABLA ' + JSON.stringify(tabla));
const ids = Object.keys(tabla);
if (!CELU) {
  const tope = ids.map((k) => tabla[k].carrera), maxT = Math.max(...tope), caminaMin = Math.min(...ids.map((k) => tabla[k].camina));
  res(tabla.foxy.carrera >= maxT - 0.05, 'Foxy es el que más corre (su carrera, la más rápida)', { foxy: tabla.foxy.carrera, max: maxT });
  res(tabla.freddy.camina <= caminaMin + 0.05 && tabla.freddy.camina >= jug.camina - 0.1 && tabla.freddy.carrera < tabla.foxy.carrera && tabla.freddy.carrera > jug.corre, 'Freddy: de los más lentos, pero no lento (camina como el jugador y corre más que él)', tabla.freddy);
}
await ev(`cerrarPaneles(); pillAplicar('foxy'); 1`);
await p.waitForFunction(() => window.__ev(`PILL.on && PILL.id === 'foxy' && JUG.cuerpo && JUG.cuerpo.skin === PILL.def.skin`), null, { timeout: 60000, polling: 300 }).catch(() => {});

// ---- el botón de saltar en el celular: se ve y no lo tapan los de las habilidades ----
if (CELU) {
  const bs = await J(`(() => { const r = $('bsaltar').getBoundingClientRect(), L = []; for (const e of document.querySelectorAll('.pillBt')) { if (!e.getClientRects().length || getComputedStyle(e).display === 'none') continue; const q = e.getBoundingClientRect(); if (r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1) L.push(e.id); } return { r: [Math.round(r.left), Math.round(r.top), Math.round(r.width)], pisa: L }; })()`);
  res(bs.r[2] >= 40 && !bs.pisa.length, 'celular: el botón de saltar está y ningún botón del Pill lo tapa', bs);
  await foto('hud_saltar');
}

// ---- los ajustes de la pestaña ----
const abrirTab = async (sub) => { await ev(`abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.pill); UI.sub = ${sub || 0}; UI.q = ''; spawnDibujar(); 1`); await p.waitForTimeout(700); };
await abrirTab(0);
const aj = await J(`(() => { const A = $('grilla').querySelector('.pillAj'); if (!A) return null; const R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
  const g = $('grilla').getBoundingClientRect(), malos = [];
  for (const e of [A, ...A.querySelectorAll('*')]) { const c = getComputedStyle(e); if (parseFloat(c.borderTopLeftRadius) > 1) malos.push(e.className || e.tagName); if (/gradient/.test(c.backgroundImage)) malos.push('degradado'); if ([...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()) && parseFloat(c.fontSize) < 11) malos.push('letra ' + c.fontSize); }
  const ins = [...A.querySelectorAll('input[type=range]')].map((i) => ({ k: i.dataset.pa, v: +i.value, min: +i.min, max: +i.max, r: R(i) }));
  const txt = [...A.querySelectorAll('.pillAjF span, .pillAjF output, .pillAjDef')].map((e) => ({ t: e.textContent, entra: e.scrollWidth <= e.clientWidth + 1 }));
  const fuera = [A, ...A.children].some((e) => { const r = e.getBoundingClientRect(); return r.left < g.left - 1 || r.right > g.right + 1; });
  return { ins, txt, malos: [...new Set(malos)], fuera, def: A.querySelector('.pillAjDef').disabled, alto: R(A)[3] }; })()`);
res(aj && aj.ins.length === 2 && aj.ins[0].k === 'vel' && aj.ins[1].k === 'rec' && aj.ins.every((i) => i.v === 1) && aj.def, 'la pestaña tiene Velocidad y Tiempo de recarga (×1 de entrada; «Por defecto» apagado)', aj && aj.ins);
res(aj && aj.ins[0].min === 0.5 && aj.ins[0].max === 2 && aj.ins[1].min === 0.25 && aj.ins[1].max === 2, 'límites: velocidad ×0,5 a ×2, recarga ×0,25 a ×2', aj && aj.ins.map((i) => [i.min, i.max]));
res(aj && !aj.malos.length && !aj.fuera && aj.txt.every((x) => x.entra) && aj.ins.every((i) => i.r[3] >= 30), 'los ajustes con la identidad de los menús (sin redondeos ni degradados, letras ≥ 11 px, todo adentro, barras ≥ 30 px de alto)', aj);
await p.screenshot({ path: D + PRE + 'ajustes.png' });
// (en otras categorías también, y no en la búsqueda)
await abrirTab(1); const enFnaf = await J(`!!$('grilla').querySelector('.pillAj')`);
res(enFnaf, 'los ajustes están también en las otras categorías');
await abrirTab(0);
// mover las barras como lo haría el jugador (el valor y los eventos input y change)
const mover = (k, v) => ev(`(() => { const i = $('grilla').querySelector('input[data-pa="${k}"]'); i.value = ${v}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return i.nextElementSibling.textContent; })()`);
const o1 = await mover('vel', 1.5), o2 = await mover('rec', 0.5);
const guard = await J(`({ pv: PREFS.pillVel, pr: PREFS.pillRec, ls: (() => { const o = JSON.parse(localStorage.getItem('jx_prefs') || '{}'); return [o.pillVel, o.pillRec]; })(), def: $('grilla').querySelector('.pillAjDef').disabled })`);
res(o1 === '×1,50' && o2 === '×0,50' && guard.pv === 1.5 && guard.pr === 0.5 && guard.ls[0] === 1.5 && guard.ls[1] === 0.5 && !guard.def, 'mover las barras: se ve ×1,50 y ×0,50 y se guarda', { o1, o2, guard });
await p.screenshot({ path: D + PRE + 'ajustes_cambiados.png' });
await ev(`cerrarPaneles(); 1`);
// (Foxy a ×1,5: camina a 10,5 y corre a 21)
const fv = { camina: await p.evaluate(() => window.__ev(`window.__mv(['KeyW'], [], 2200)`)), carrera: await p.evaluate((c) => window.__ev(c ? `window.__mv(['KeyW'], ['pillA2'], 2200)` : `window.__mv(['KeyW', 'ShiftLeft'], [], 2200)`), CELU) };
res(Math.abs(fv.camina - tabla.foxy.camina * 1.5) < 0.2 && Math.abs(fv.carrera - tabla.foxy.carrera * 1.5) < 0.35, 'Velocidad ×1,5: Foxy camina y corre un 50 % más', { antes: [tabla.foxy.camina, tabla.foxy.carrera], ahora: fv });
// (Recarga ×0,5: la espera del zarpazo de Foxy, 0,6 s → 0,3; el poder vuelve el doble de rápido)
const rec = await p.evaluate(() => window.__ev(`(async () => { window.__lugar(); await window.__piso(); PILL.cd = [0, 0, 0, 0]; PILL.pod = pillPodMax(); pillUsar(0); const cd = PILL.cd[0];
  // (el poder y las esperas corren con el reloj del juego, no con el de la física)
  PILL.pod = 20; PILL.sinRegen = 0; const p0 = PILL.pod, t0 = TIEMPO.t; await new Promise((ok) => { const f = () => (TIEMPO.t - t0 >= 1 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  return { cd: +cd.toFixed(3), poderPorSeg: +((PILL.pod - p0) / (TIEMPO.t - t0)).toFixed(2) }; })()`));
res(Math.abs(rec.cd - 0.3) < 0.01 && Math.abs(rec.poderPorSeg - 18) < 1.5, 'Tiempo de recarga ×0,5: la espera del zarpazo es la mitad (0,3 s) y el poder vuelve el doble (18 por segundo)', rec);
await foto('hud_ajustes');
// recargar la página: los ajustes siguen
await p.reload(); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
await empezar();
await abrirTab(0);
const tras = await J(`({ pv: PREFS.pillVel, pr: PREFS.pillRec, ins: [...$('grilla').querySelectorAll('.pillAj input')].map((i) => +i.value), out: [...$('grilla').querySelectorAll('.pillAj output')].map((o) => o.textContent) })`);
res(tras.pv === 1.5 && tras.pr === 0.5 && tras.ins[0] === 1.5 && tras.ins[1] === 0.5, 'al recargar la página los ajustes siguen', tras);
// «Por defecto»
await ev(`$('grilla').querySelector('.pillAjDef').click(); 1`);
const def = await J(`({ pv: PREFS.pillVel, pr: PREFS.pillRec, ins: [...$('grilla').querySelectorAll('.pillAj input')].map((i) => +i.value), apagado: $('grilla').querySelector('.pillAjDef').disabled, ls: JSON.parse(localStorage.getItem('jx_prefs') || '{}').pillVel })`);
res(def.pv === 1 && def.pr === 1 && def.ins.every((v) => v === 1) && def.apagado && def.ls === 1, '«Por defecto» los vuelve a ×1', def);
// ---- los textos en los 14 idiomas (y que entren en la pestaña) ----
const idi = await J(`(() => { const L0 = PREFS.lang, out = {}; for (const l of IDI3_L) { PREFS.lang = l; out[l] = ['pill.aj.vel', 'pill.aj.rec', 'pill.aj.def', 'pill.aj.velAy', 'pill.aj.recAy'].map((k) => T(k)); } PREFS.lang = L0; return out; })()`);
const faltan = Object.entries(idi).filter(([, L]) => L.some((t) => !t || /^pill\\./.test(t))).map(([l]) => l);
const distintos = new Set(Object.values(idi).map((L) => L[3])).size;
res(Object.keys(idi).length === 14 && !faltan.length && distintos >= 13, 'los textos de los ajustes en los 14 idiomas', { faltan, distintos });
const entran = {};
for (const l of ['de', 'ru', 'fil', 'ar', 'ja']) {
  await ev(`PREFS.lang = '${l}'; document.documentElement.lang = '${l}'; spawnDibujar(); 1`); await p.waitForTimeout(300);
  entran[l] = await J(`(() => { const A = $('grilla').querySelector('.pillAj'), g = $('grilla').getBoundingClientRect(); return [...A.querySelectorAll('.pillAjF span, .pillAjF output, .pillAjDef')].every((e) => e.scrollWidth <= e.clientWidth + 1) && [...A.children].every((e) => { const r = e.getBoundingClientRect(); return r.left >= g.left - 1 && r.right <= g.right + 1; }); })()`);
  if (l === 'de' || l === 'ar') await p.screenshot({ path: D + PRE + 'ajustes_' + l + '.png' });
}
await ev(`PREFS.lang = 'es'; document.documentElement.lang = 'es'; cerrarPaneles(); 1`);
res(Object.values(entran).every(Boolean), 'en alemán, ruso, filipino, árabe y japonés los ajustes entran', entran);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|GPU stall|swiftshader|Automatic fallback/i.test(x));
res(!e2.length, 'sin errores de JS', e2.slice(0, 6));
console.log(`RESUMEN ${ok}/${ok + mal}`);
await b.close();
process.exit(mal ? 1 : 0);
