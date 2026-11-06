// Habilitar / Deshabilitar mods (Discord: «opciones para desactivar/habilitar, desactivar todos/habilitar todos los mods»,
// con el dibujo de los botones abajo del panel; y la aclaración: en la página de un mod no van los de «todo», porque ahí
// se elige ese solo). Con dos addons de GMod instalados (Nyan Gun y el perro):
//  1. en la lista: «Deshabilitar todo» y «Habilitar todo» (éste, gris: no hay ninguno deshabilitado) y ningún botón de uno solo;
//  2. en la ficha de la Nyan Gun: sólo «Deshabilitar» (ni «Habilitar» ni los de «todo»). Al tocarlo: se desmonta (ni su
//     Lua ni su arma), queda instalado y guardado como deshabilitado, la ficha lo avisa, el pie pasa a «Habilitar» y en la
//     lista su cuadrito se ve apagado;
//  3. al volver a abrir el juego, sigue instalado y sin montar; el otro sí se monta;
//  4. «Habilitar»: vuelve a montarse desde la caché (sin bajar nada) en ≤ 5 s, con su arma;
//  5. jugando con la Nyan Gun en la mano: deshabilitarla la saca de la mano y de las armas, sin errores; habilitarla la
//     devuelve al menú;
//  6. «Deshabilitar todo» desmonta los dos; «Habilitar todo» los vuelve a montar;
//  7. pestaña Mods (los del juego): en la lista los de «todo»; en la ficha sólo el de ese mod (y ya no la casilla
//     «Activado», que hacía lo mismo); «Deshabilitar todo» los apaga a todos;
//  8. el pie entra en la pantalla del celular (873×393 y 640×360), en un solo renglón: nada se sale ni se pisa;
//  9. sin errores de JS.
// uso: node mods_habilitar.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP, D = ''] = process.argv; if (D) fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const NY = '123277559', PE = '656834283';
const { b, ctx, p, err, ev } = await abrir(HTML, true);
const esperar = async (cond, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(cond).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
const errores = () => err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); 1`);
const inst = await ev(`(async () => { for (const id of ['${NY}', '${PE}']) { const A = await gmInstalar(id, { nombre: id }, new Uint8Array(await (await fetch('${CARP}/' + id + '.gma')).arrayBuffer())); await A.listo; }
  return { montados: [...GMOD.addons.keys()], prefs: Object.keys(PREFS.gmod || {}) }; })()`);
console.log('instalados', JSON.stringify(inst));
// (la pestaña GMod, en Instalados)
const abrirTienda = (tab) => ev(`(() => { cerrarPaneles && cerrarPaneles(); RB.t.tab = '${tab}'; RB.t.vista = 'instalados'; RB.t.ficha = null; RB.t.q = ''; RB.t.etq = ''; inicioMostrar(true); inicioPanel('tienda'); return 1; })()`);
const pie = () => ev(`[...RB.el.querySelectorAll('.rbPanPie .rbHab button')].map((x) => ({ a: x.dataset.rb || '', t: x.textContent.trim(), gris: x.disabled }))`);
await abrirTienda('gmod'); await p.waitForTimeout(1500);
const lista1 = await pie();
ok('1. lista: «Deshabilitar todo» y «Habilitar todo» (gris), sin botón de uno solo', lista1.length === 2 && lista1[0].a === 'desTodoGm' && !lista1[0].gris && lista1[1].a === 'habTodoGm' && lista1[1].gris, lista1);
if (D) await p.screenshot({ path: D + '/lista.png' });
// 2. ficha de la Nyan Gun
await p.click(`[data-rb="ver:${NY}"]`); await p.waitForTimeout(600);
const ficha1 = await pie();
if (D) await p.screenshot({ path: D + '/ficha_on.png' });
await p.click(`.rbHab [data-rb="desGm:${NY}"]`); await p.waitForTimeout(1500);
const des = await ev(`({ montado: GMOD.addons.has('${NY}'), instalado: !!PREFS.gmod['${NY}'], off: PREFS.gmod['${NY}'] && PREFS.gmod['${NY}'].off, guardado: (() => { try { const x = JSON.parse(localStorage.getItem('jx_prefs')).gmod['${NY}']; return x && x.off; } catch (e) { return 'err'; } })(),
  aviso: !!RB.el.querySelector('.rbFicha .rbOffAyuda'), sweps: [...GMA.armas.keys()].filter((k) => /nyan/i.test(k)), otro: GMOD.addons.has('${PE}') })`);
const ficha2 = await pie();
if (D) await p.screenshot({ path: D + '/ficha_off.png' });
await p.click('[data-rb="fichaNo"]'); await p.waitForTimeout(500);
const tile = await ev(`(() => { const t = RB.el.querySelector('[data-rb="ver:${NY}"]'); return t ? { off: t.classList.contains('off'), marca: !!t.querySelector('.rbTileOff') } : null; })()`);
const lista2 = await pie();
if (D) await p.screenshot({ path: D + '/lista_off.png' });
ok('2. ficha: sólo «Deshabilitar»; al tocarlo se desmonta, queda instalado y guardado, la ficha avisa, el pie pasa a «Habilitar» y el cuadrito se apaga',
  ficha1.length === 1 && ficha1[0].a === `desGm:${NY}` && !des.montado && des.instalado && des.off === 1 && des.guardado === 1 && des.aviso && !des.sweps.length && des.otro && ficha2.length === 1 && ficha2[0].a === `habGm:${NY}` && tile && tile.off && tile.marca && lista2.length === 2 && !lista2[0].gris && !lista2[1].gris,
  { ficha1, des, ficha2, tile, lista2 });
// 3. volver a abrir el juego
await p.reload(); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
await ev(`idiomaAplicar('es'); 1`);
const re = await ev(`new Promise((fin) => { const t0 = performance.now(); const f = () => { if (GMOD.addons.has('${PE}') || performance.now() - t0 > 20000) return fin({ ny: GMOD.addons.has('${NY}'), pe: GMOD.addons.has('${PE}'), instalado: !!(PREFS.gmod && PREFS.gmod['${NY}']), off: PREFS.gmod && PREFS.gmod['${NY}'] && PREFS.gmod['${NY}'].off }); setTimeout(f, 200); }; f(); })`);
await p.waitForTimeout(1500);
const re2 = await ev(`({ ny: GMOD.addons.has('${NY}') })`);
ok('3. al volver a abrir: sigue instalado y deshabilitado, sin montar; el otro sí se monta', !re.ny && !re2.ny && re.pe && re.instalado && re.off === 1, { re, re2 });
// 4. Habilitar (desde la caché, sin bajar nada)
// (descargas de addons: se cuenta cada vez que el juego pide bajar uno)
await ev(`(() => { window.__bajo = 0; const gb = gmBajar; gmBajar = (...a) => { window.__bajo++; return gb(...a); }; return 1; })()`);
await abrirTienda('gmod'); await p.waitForTimeout(1200);
await p.click(`[data-rb="ver:${NY}"]`); await p.waitForTimeout(500);
const t0 = Date.now(); await p.click(`.rbHab [data-rb="habGm:${NY}"]`);
await esperar(`GMOD.addons.has('${NY}') && !RB.t.habVa`, 20000);
const hab = await ev(`({ montado: GMOD.addons.has('${NY}'), off: !!(PREFS.gmod['${NY}'] || {}).off, sweps: [...GMA.armas.keys()].filter((k) => /nyan/i.test(k)), pie: [...RB.el.querySelectorAll('.rbPanPie .rbHab button')].map((x) => x.dataset.rb) })`);
const tHab = (Date.now() - t0) / 1000, bajadas = await ev(`window.__bajo`);
ok('4. «Habilitar»: se vuelve a montar desde la caché (sin bajar nada) en ≤ 5 s, con su arma', hab.montado && !hab.off && hab.sweps.length > 0 && tHab <= 5 && bajadas === 0 && hab.pie[0] === `desGm:${NY}`, { hab, s: +tHab.toFixed(1), bajadas });
// 5. jugando, con la Nyan Gun en la mano
await ev(`(() => { inicioMostrar(false); empezarPartida('FlatGrass'); return 1; })()`); await p.waitForTimeout(4000);
const enMano = await ev(`(async () => { spawnElegir('GMod', 'gmswep:weapon_nyangun'); await new Promise((r) => setTimeout(r, 800)); return { arma: ARM.lista[ARM.i], lista: ARM.lista.filter((x) => /nyan/i.test(x)) }; })()`);
const e0 = errores().length;
await ev(`(async () => { RB.desdeJuego = true; RB.t.tab = 'gmod'; RB.t.vista = 'instalados'; RB.t.ficha = '${NY}'; inicioMostrar(true); inicioPanel('tienda'); return 1; })()`); await p.waitForTimeout(800);
await p.click(`.rbHab [data-rb="desGm:${NY}"]`); await p.waitForTimeout(1500);
const sinArma = await ev(`({ arma: ARM.lista[ARM.i], lista: ARM.lista.filter((x) => /nyan/i.test(x)), swep: !!(GMA.swep && /nyan/i.test(GMA.swep.clase || '')) })`);
for (let i = 0; i < 30; i++) await ev(`new Promise((r) => requestAnimationFrame(r))`);
await p.click(`.rbHab [data-rb="habGm:${NY}"]`);
await esperar(`GMOD.addons.has('${NY}') && !RB.t.habVa`, 20000);
await p.waitForTimeout(800);
const vuelve = await ev(`(() => { return { sweps: [...GMA.armas.keys()].filter((k) => /nyan/i.test(k)), montado: GMOD.addons.has('${NY}') }; })()`);
const e1 = errores().slice(e0);
ok('5. jugando: deshabilitarla la saca de la mano y de las armas, sin errores; habilitarla la devuelve', /nyan/i.test(enMano.arma || '') && !sinArma.lista.length && !sinArma.swep && !/nyan/i.test(sinArma.arma || '') && vuelve.montado && vuelve.sweps.length > 0 && !e1.length, { enMano, sinArma, vuelve, errores: e1.slice(0, 3) });
// 6. todo
await ev(`(() => { RB.desdeJuego = false; inicioMostrar(false); return 1; })()`);
await abrirTienda('gmod'); await p.waitForTimeout(1200);
await p.click('.rbHab [data-rb="desTodoGm"]'); await p.waitForTimeout(200); await esperar('!RB.t.habVa', 20000); await p.waitForTimeout(800);
const todoNo = await ev(`({ montados: ['${NY}', '${PE}'].filter((id) => GMOD.addons.has(id)), off: ['${NY}', '${PE}'].filter((id) => PREFS.gmod[id].off).length, pie: [...RB.el.querySelectorAll('.rbPanPie .rbHab button')].map((x) => [x.dataset.rb, x.disabled]) })`);
if (D) await p.screenshot({ path: D + '/lista_todo_off.png' });
await p.click('.rbHab [data-rb="habTodoGm"]'); await p.waitForTimeout(200); await esperar('!RB.t.habVa', 30000); await p.waitForTimeout(800);
const todoSi = await ev(`({ montados: ['${NY}', '${PE}'].filter((id) => GMOD.addons.has(id)), off: ['${NY}', '${PE}'].filter((id) => PREFS.gmod[id].off).length })`);
ok('6. «Deshabilitar todo» desmonta los dos; «Habilitar todo» los vuelve a montar', !todoNo.montados.length && todoNo.off === 2 && todoNo.pie[0][1] === true && todoNo.pie[1][1] === false && todoSi.montados.length === 2 && todoSi.off === 0, { todoNo, todoSi });
// 7. pestaña Mods (los del juego)
const mods = await ev(`(() => { const L = OFICIALES.filter((m) => modTipo(m) !== 'asset').slice(0, 2); INST.of = INST.of || {}; for (const m of L) { INST.of[m.id] = true; PREFS.mods[m.id] = true; } guardarPrefs(); return L.map((m) => m.id); })()`);
await abrirTienda('mod'); await p.waitForTimeout(1200);
const mLista = await pie();
await p.click(`[data-rb="ver:${mods[0]}"]`); await p.waitForTimeout(500);
const mFicha = await pie(), casilla = await ev(`!!RB.el.querySelector('.rbFicha [data-rb^="act:"]')`);
await p.click(`.rbHab [data-rb="desMod:${mods[0]}"]`); await p.waitForTimeout(400);
const mDes = await ev(`({ act: !!PREFS.mods['${mods[0]}'], aviso: !!RB.el.querySelector('.rbFicha .rbOffAyuda'), pie: [...RB.el.querySelectorAll('.rbPanPie .rbHab button')].map((x) => x.dataset.rb) })`);
await p.click('[data-rb="fichaNo"]'); await p.waitForTimeout(400);
await p.click('.rbHab [data-rb="desTodoMod"]'); await p.waitForTimeout(500);
const mTodo = await ev(`({ activos: ${JSON.stringify(mods)}.filter((id) => PREFS.mods[id]).length, instalados: ${JSON.stringify(mods)}.filter((id) => ofInstalado(id)).length })`);
ok('7. pestaña Mods: «todo» en la lista, sólo el de ese mod en la ficha (sin la casilla «Activado»), y «Deshabilitar todo» los apaga',
  mLista.length === 2 && mLista[0].a === 'desTodoMod' && mFicha.length === 1 && mFicha[0].a === `desMod:${mods[0]}` && !casilla && !mDes.act && mDes.aviso && mDes.pie[0] === `habMod:${mods[0]}` && mTodo.activos === 0 && mTodo.instalados === mods.length,
  { mods, mLista, mFicha, casilla, mDes, mTodo });
// 8. el pie en la pantalla del celular (lista y ficha), 873×393 y 640×360
const medir = () => ev(`(() => { const P = RB.el.querySelector('.rbPanPie'), r = P.getBoundingClientRect(), bs = [...P.querySelectorAll('button')].filter((x) => x.offsetParent && getComputedStyle(x).visibility !== 'hidden').map((x) => x.getBoundingClientRect());
  let pisan = 0; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], c = bs[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) pisan++; }
  const fuera = bs.filter((x) => x.left < -0.5 || x.right > innerWidth + 0.5 || x.bottom > innerHeight + 0.5 || x.top < -0.5).length;
  const renglones = new Set(bs.map((x) => Math.round((x.top + x.bottom) / 2 / 8))).size;
  return { w: innerWidth, h: innerHeight, botones: bs.length, pisan, fuera, renglones, scrollX: document.documentElement.scrollWidth > innerWidth, alto: Math.round(r.height) }; })()`);
const caja = [];
for (const [w, h] of [[873, 393], [640, 360]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(500);
  await abrirTienda('gmod'); await p.waitForTimeout(1000); caja.push({ vista: 'lista', ...(await medir()) });
  if (D) await p.screenshot({ path: `${D}/pie_lista_${w}.png` });
  await p.click(`[data-rb="ver:${NY}"]`); await p.waitForTimeout(500); caja.push({ vista: 'ficha', ...(await medir()) });
  if (D) await p.screenshot({ path: `${D}/pie_ficha_${w}.png` });
}
ok('8. el pie entra en el celular (873×393 y 640×360) en un solo renglón: nada se sale ni se pisa', caja.every((c) => c.botones >= 3 && !c.pisan && !c.fuera && !c.scrollX && c.renglones === 1), caja);
ok('9. sin errores de JS', !errores().length, errores().slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
