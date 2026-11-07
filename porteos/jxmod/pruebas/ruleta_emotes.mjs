// La ruleta de emotes (Discord: «ruleta de emotes como Fortnite»). En la compu y en el celular:
//  1. mantener la B abre la ruleta con 5 lugares; mover el mouse hacia uno lo marca y al soltar la B el personaje hace
//     ese emote;
//  2. (3.0, Discord: «que los emotes abran sólo la ruleta») un toque corto de la B abre sólo la ruleta, quieta, con
//     «Editar emotes», «Todos los emotes» y «Cerrar»; «Todos los emotes» abre el panel; en Ajustes → Controles está
//     «El botón de emotes abre la ruleta», prendido de fábrica, y apagado un toque abre el panel como antes;
//  3. en el celular: mantener el botón de emotes y deslizar el dedo hacia arriba (el lugar 1), al soltar hace ese emote;
//  4. soltar en el medio deja la ruleta abierta; «Editar emotes» → tocar el lugar 3 → el panel dice «Elegí el emote
//     para el lugar 3» → tocar un emote lo pone en ese lugar, vuelve a la ruleta y queda guardado (PREFS.ruleta);
//  5. la ruleta entra en la pantalla del celular (873×393) y no tapa nada fuera de la rueda mientras se elige;
//  6. sin errores de JS.
// uso: node ruleta_emotes.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/ruleta'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const prep = `idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`;
// ---- en la compu ----
{
  const { b, p, err, ev } = await abrir(HTML);
  await ev(prep); await p.waitForTimeout(3000);
  await ev(`(() => { PREFS.ruleta = [DATA.emotes[0], DATA.emotes[1], null, DATA.emotes[2], DATA.emotes[3]]; cerrarPaneles(); JUG.cuerpo.emote = null; return 1; })()`).catch(() => {});
  const slots = await ev(`rulSlots()`);
  await p.keyboard.down('KeyB'); await p.waitForTimeout(400);
  const abierta = await ev(`({ abierta: RUL.abierto, lugares: document.querySelectorAll('#ruleta .rulLug').length, visible: !$('ruleta').classList.contains('oc') })`);
  await p.screenshot({ path: D + '/compu_abierta.png' });
  // (el mouse hacia el lugar 4, «Dance»: el de abajo a la izquierda)
  const pos = await ev(`(() => { const r = document.querySelector('#ruleta [data-rul="3"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await p.mouse.move(pos[0], pos[1], { steps: 4 }); await p.waitForTimeout(150);
  const marcado = await ev(`RUL.sel`);
  await p.keyboard.up('KeyB'); await p.waitForTimeout(300);
  const hizo = await ev(`({ emote: JUG.cuerpo.emote, abierta: RUL.abierto })`);
  ok('1. mantener la B abre la ruleta (5 lugares); el mouse marca uno y al soltar hace ese emote', abierta.abierta && abierta.visible && abierta.lugares === 5 && marcado === 3 && hizo.emote === slots[3] && !hizo.abierta, { abierta, marcado, hizo, esperado: slots[3] });
  await ev(`(() => { JUG.cuerpo.emote = null; cerrarPaneles(); return 1; })()`);
  await p.keyboard.down('KeyB'); await p.waitForTimeout(60); await p.keyboard.up('KeyB'); await p.waitForTimeout(300);
  const corto = await ev(`({ ui: UI.abierto, panel: !$('emotes').classList.contains('oc'), ruleta: RUL.abierto, fija: RUL.fija, editar: !!document.querySelector('#ruleta .rulEd'), todos: !!document.querySelector('#ruleta .rulTodos'), cerrar: !!document.querySelector('#ruleta .rulCerrar') })`);
  await p.screenshot({ path: D + '/compu_toque.png' });
  await p.click('#ruleta .rulTodos'); await p.waitForTimeout(300);
  const todos = await ev(`({ ui: UI.abierto, panel: !$('emotes').classList.contains('oc'), ruleta: RUL.abierto, asignar: RUL.asignar })`);
  // (la opción de Ajustes: apagada, un toque abre el panel como antes)
  await ev(`(() => { cerrarPaneles(); abrirAjustes('juego'); return 1; })()`); await p.waitForTimeout(300);
  const aj = await ev(`({ hay: !!$('aEmoR'), on: !!($('aEmoR') && $('aEmoR').checked), txt: $('aEmoR') ? $('aEmoR').closest('label').textContent.trim() : null })`);
  await ev(`(() => { $('aEmoR').checked = false; $('aOk').click(); cerrarPaneles(); return 1; })()`); await p.waitForTimeout(300);
  await p.keyboard.down('KeyB'); await p.waitForTimeout(60); await p.keyboard.up('KeyB'); await p.waitForTimeout(300);
  const apagada = await ev(`({ ui: UI.abierto, panel: !$('emotes').classList.contains('oc'), ruleta: RUL.abierto, pref: PREFS.emoRuleta })`);
  await ev(`(() => { PREFS.emoRuleta = true; guardarPrefs(); cerrarPaneles(); return 1; })()`);
  ok('2. un toque corto de la B abre sólo la ruleta (quieta, con Editar emotes, Todos los emotes y Cerrar); «Todos los emotes» abre el panel; con la opción de Ajustes apagada, un toque abre el panel como antes',
    corto.ruleta && corto.fija && corto.ui === 'ruleta' && !corto.panel && corto.editar && corto.todos && corto.cerrar && todos.ui === 'emotes' && todos.panel && !todos.ruleta && aj.hay && aj.on && apagada.ui === 'emotes' && apagada.panel && !apagada.ruleta && apagada.pref === false, { corto, todos, aj, apagada });
  // 4. soltar en el medio, editar, elegir
  await ev(`(() => { cerrarPaneles(); return 1; })()`);
  await p.keyboard.down('KeyB'); await p.waitForTimeout(400); await p.mouse.move(640, 360); await p.keyboard.up('KeyB'); await p.waitForTimeout(300);
  const fija = await ev(`({ fija: RUL.fija, abierta: RUL.abierto, ui: UI.abierto, editar: !!document.querySelector('#ruleta .rulEd') })`);
  await p.click('#ruleta .rulEd'); await p.waitForTimeout(200);
  await p.click('#ruleta [data-rul="2"]'); await p.waitForTimeout(500);
  const elegir = await ev(`({ ui: UI.abierto, titulo: document.querySelector('#emotes .emoCab h3').textContent })`);
  await p.screenshot({ path: D + '/compu_elegir.png' });
  const cual = await ev(`(() => { const x = document.querySelector('#emoLista [data-emo]'); return x ? x.dataset.emo : null; })()`);
  await p.click('#emoLista [data-emo="' + cual + '"]'); await p.waitForTimeout(400);
  const despues = await ev(`({ ruleta: RUL.abierto, editar: RUL.editar, lugar3: rulSlots()[2], prefs: PREFS.ruleta, guardado: (() => { try { return JSON.parse(localStorage.getItem('jx_prefs') || '{}').ruleta || null; } catch (e) { return 'err'; } })() })`);
  await p.screenshot({ path: D + '/compu_editada.png' });
  ok('4. soltar en el medio la deja abierta; Editar → lugar 3 → «Elegí el emote para el lugar 3» → el emote queda en el lugar 3 y guardado', fija.fija && fija.ui === 'ruleta' && fija.editar && elegir.ui === 'emotes' && /lugar 3/.test(elegir.titulo) && despues.ruleta && despues.lugar3 === cual && PREFS_OK(despues), { fija, elegir, cual, despues });
  function PREFS_OK(d) { return Array.isArray(d.prefs) && d.prefs[2] === cual && Array.isArray(d.guardado) && d.guardado[2] === cual; }
  const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently/i.test(x));
  ok('6a. sin errores de JS en la compu', !e.length, e.slice(0, 4));
  await b.close();
}
// ---- en el celular ----
{
  const { b, p, err, ev } = await abrir(HTML, true);
  await ev(prep); await p.waitForTimeout(3000);
  await ev(`(() => { PREFS.ruleta = DATA.emotes.slice(0, 5); ENT.tactil = true; if (typeof hudTactil === 'function') hudTactil(); JUG.cuerpo.emote = null; return 1; })()`).catch(() => {});
  const bt = await ev(`(() => { const x = document.querySelector('[data-btn=emotes]'); if (!x) return null; const r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width > 0]; })()`);
  const cdp = await p.context().newCDPSession(p);
  const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  let celu = { bt };
  if (bt && bt[2]) {
    await toque('touchStart', bt[0], bt[1]); await p.waitForTimeout(350);
    celu.abierta = await ev(`RUL.abierto`);
    const caja = await ev(`(() => { const r = document.querySelector('#ruleta .rulRueda').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight]; })()`);
    celu.caja = caja.map((x) => Math.round(x));
    // (el dedo hacia arriba: el lugar 1, «Wave»)
    for (let i = 1; i <= 6; i++) { await toque('touchMove', bt[0], bt[1] - i * 15); await p.waitForTimeout(30); }
    celu.sel = await ev(`RUL.sel`);
    await p.screenshot({ path: D + '/celu_eligiendo.png' });
    await toque('touchEnd'); await p.waitForTimeout(300);
    celu.emote = await ev(`JUG.cuerpo.emote`); celu.esperado = await ev(`DATA.emotes[0]`);
  }
  ok('3. en el celular: mantener el botón de emotes y deslizar hacia arriba hace el emote del lugar 1', celu.abierta && celu.sel === 0 && celu.emote === celu.esperado, celu);
  // (un toque corto en el botón: la ruleta quieta, entera en la pantalla con sus botones de abajo)
  let toqueC = null;
  if (bt && bt[2]) {
    await ev(`(() => { JUG.cuerpo.emote = null; cerrarPaneles(); return 1; })()`);
    await toque('touchStart', bt[0], bt[1]); await p.waitForTimeout(80); await toque('touchEnd'); await p.waitForTimeout(350);
    toqueC = await ev(`(() => { const R = $('ruleta'), q = (s) => { const e = R.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); }; return { ruleta: RUL.abierto, fija: RUL.fija, ui: UI.abierto, rueda: q('.rulRueda'), pie: q('.rulPie'), W: innerWidth, H: innerHeight }; })()`);
    await p.screenshot({ path: D + '/celu_toque.png' });
    await ev(`(() => { rulCerrar(); return 1; })()`);
  }
  const dentro = (r, t) => r && r[0] >= 0 && r[1] >= 0 && r[2] <= t.W && r[3] <= t.H;
  ok('3b. en el celular: un toque corto en el botón de emotes abre sólo la ruleta, entera en la pantalla con sus botones', toqueC && toqueC.ruleta && toqueC.fija && toqueC.ui === 'ruleta' && dentro(toqueC.rueda, toqueC) && dentro(toqueC.pie, toqueC), toqueC);
  const c = celu.caja || [0, 0, 0, 0, 1, 1];
  ok('5. la ruleta entra en la pantalla del celular', c[0] >= 0 && c[1] >= 0 && c[2] <= c[4] && c[3] <= c[5], { caja: celu.caja });
  const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently/i.test(x));
  ok('6b. sin errores de JS en el celular', !e.length, e.slice(0, 4));
  await b.close();
}
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
