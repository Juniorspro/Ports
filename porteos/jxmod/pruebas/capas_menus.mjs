// Discord (Kris): «si tenés equipado el celular y abrís el menú de pausa», el celular queda dibujado encima de la pausa.
// La causa: la regla que lo escondía era «body:has(.panel:not(.oc)) #celular,#celular.tapado»; un navegador sin :has()
// (WebView viejos de Android, Safari antes de 15.4) descarta la regla ENTERA. Acá se simula ese navegador cambiando :has(
// por un selector que no existe en el HTML que se sirve.
//  1. el juego de antes, sin :has(): el celular en la mano queda encima de la pausa (se reproduce el error);
//  2. el de ahora, sin :has() y con: con la pausa abierta, lo que está arriba en el centro del celular es la pausa y el
//     celular está escondido;
//  3. lo mismo con los otros menús grandes (Ajustes, Controles, Personaje, el spawn, los emotes, el editor de botones) y con
//     otras capas abiertas debajo (la ruleta de emotes, el panel GMod, el menú MOD, el chat): ninguna queda encima;
//  4. sin menú, el celular en la mano se ve y se toca (arriba de todo lo del juego); al cerrar la pausa vuelve;
//  5. sin errores de JS.
// uso: node capas_menus.mjs URL_HTML_NUEVO [URL_HTML_ANTES] [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, ANTES, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1200) : '')); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
async function abrir(url, sinHas) {
  const ctx = await b.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  // (un navegador sin :has(): el selector se cambia por uno que tampoco entiende, así la regla se descarta igual que allá)
  if (sinHas) await ctx.route((u) => /index\.html/.test(u.pathname), async (r) => { const res = await r.fetch(); const t = (await res.text()).split(':has(').join(':nohay('); r.fulfill({ response: res, body: t }); });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
  await p.goto(url + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(800);
  await ev(`if (typeof cuDialogoCerrar === 'function') cuDialogoCerrar(); ENT.tactil = true; document.body.classList.add('tactil'); hudDisponer(); 1`);
  await ev(`(() => { if (ARM.lista[ARM.i] !== 'Celular') pulso('celular'); return 1; })()`); await p.waitForTimeout(1500);
  return { ctx, p, err, ev };
}
// qué está arriba en el centro del celular (en la pantalla) y si el celular se ve
const ARRIBA = `(() => { const c = $('celular'), r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y);
  const quien = !e ? '' : e.closest('#celular') ? 'celular' : e.closest('#pausa') ? 'pausa' : e.closest('.panel') ? 'panel:' + e.closest('.panel').id : e.closest('#spawn') ? 'spawn' : e.closest('#rbInicio') ? 'inicio' : e.closest('#ctlEd') ? 'editor' : e.closest('#ruleta') ? 'ruleta' : e.closest('#gmbPanel') ? 'gmod' : (e.id || e.className || e.tagName);
  const vis = (q) => { const x2 = document.querySelector(q); if (!x2) return null; const s = getComputedStyle(x2); return s.display !== 'none' && s.visibility !== 'hidden' && !x2.classList.contains('oc'); };
  return { quien, celu: vis('#celular'), clase: c.className, z: getComputedStyle(c).zIndex, ruleta: vis('#ruleta'), gmod: vis('#gmbPanel'), mod: vis('#modMenu'), chat: vis('#chatIn') }; })()`;
const pausa = async (A) => { await A.ev(`abrirPausa(); 1`); await A.p.waitForTimeout(700); return A.ev(ARRIBA); };
// ---- 1: el de antes sin :has() ----
if (ANTES) {
  const A = await abrir(ANTES, true); const m = await pausa(A); await A.p.screenshot({ path: D + 'capas_antes_sinhas.png' });
  ok('1. (se reproduce) el juego de antes en un navegador sin :has(): el celular queda encima de la pausa', m.quien === 'celular' && m.celu, m);
  await A.ctx.close();
}
// ---- 2 a 5: el de ahora ----
for (const sinHas of [true, false]) {
  const A = await abrir(HTML, sinHas), tag = sinHas ? 'sin :has()' : 'con :has()';
  const m0 = await A.ev(ARRIBA);
  ok(`4a. (${tag}) jugando con el celular en la mano, se ve y está arriba`, m0.celu && m0.quien === 'celular', m0);
  const m = await pausa(A); await A.p.screenshot({ path: D + `capas_pausa_${sinHas ? 'sinhas' : 'conhas'}.png` });
  ok(`2. (${tag}) con la pausa abierta, arriba está la pausa y el celular está escondido`, m.quien === 'pausa' && !m.celu, m);
  await A.ev(`cerrarPaneles(); 1`); await A.p.waitForTimeout(600);
  const m1 = await A.ev(ARRIBA);
  ok(`4b. (${tag}) al cerrar la pausa el celular vuelve`, m1.celu && m1.quien === 'celular', m1);
  if (!sinHas) {
    // ---- 3: los otros menús grandes y las otras capas ----
    const casos = {
      ajustes: `abrirPausa(); abrirAjustes('pausa')`,
      controles: `abrirPausa(); abrirAjustes('pausa'); ctlAbrir('pausa')`,
      personaje: `abrirPausa(); $('bPersonaje').click()`,
      spawn: `abrirSpawn()`,
      emotes: `abrirEmotes()`,
      editor: `ctlAbrir('pausa'); ctlEditar()`,
      ruletaYpausa: `rulAbrir(true); abrirPausa()`,
      gmodYpausa: `gmbAbrir(); abrirPausa()`,
      modYpausa: `modMenuAbrir(); abrirPausa()`,
      chatYpausa: `abrirChat(); abrirPausa()`,
    };
    const mal = {};
    for (const [n, js] of Object.entries(casos)) {
      await A.ev(`(() => { try { ${js}; } catch (e) { window.__e = String(e); } return 1; })()`); await A.p.waitForTimeout(900);
      const r = await A.ev(ARRIBA); if (r.quien === 'celular' || r.celu || r.ruleta || r.gmod || r.mod || r.chat) mal[n] = r;
      if (n === 'personaje' || n === 'gmodYpausa') await A.p.screenshot({ path: D + `capas_${n}.png` });
      await A.ev(`(() => { if (CTL.edit) ctlSalirEditor(false); const p = $('ctlPanel'); if (p) p.classList.add('oc'); cerrarPaneles(); if (rbVisible()) { RB.desdeJuego = false; inicioMostrar(false); menuMostrar(false); } return 1; })()`); await A.p.waitForTimeout(500);
    }
    ok('3. con Ajustes, Controles, Personaje, el spawn, los emotes o el editor, y con la ruleta, el panel GMod, el menú MOD o el chat abiertos debajo de la pausa: nada queda encima', !Object.keys(mal).length, mal);
  }
  const e = A.err.filter((x) => !/WebSocket|ERR_|404|Failed to load/i.test(x));
  ok(`5. (${tag}) sin errores de JS`, !e.length, e.slice(0, 4));
  await A.ctx.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
