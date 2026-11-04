// el tutorial: sale solo la primera vez que entrás a jugar (no si ya lo viste), recorre los botones que se ven (celu) o
// las teclas (compu), cada paso resalta su botón con la tarjeta adentro de la pantalla sin taparlo, anda en español e
// inglés, con el celu parado (juego girado 90°), y se vuelve a ver desde la pausa y desde Ajustes.
// uso: node tutorial.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, D = '.'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
// (las pruebas automáticas no lo abren solo: navigator.webdriver; acá se simula un aparato normal)
const sinWebdriver = async (p) => { await p.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); }); };
// (cada paso: el botón resaltado coincide con el de verdad y la tarjeta está entera en pantalla y no lo tapa)
const revisar = (ev) => ev(`(() => { const out = []; const W = TUT.el.clientWidth, H = TUT.el.clientHeight;
  for (let i = 0; i < TUT.pasos.length; i++) { TUT.i = i; tutDibujar(); const [id, sel] = TUT.pasos[i], el = sel && document.querySelector(sel), ve = !!el && tutVisible(el);
    const C = TUT.el.querySelector('.tutCaja'), h = TUT.el.querySelector('.tutHueco'), c = { x: parseFloat(C.style.left), y: parseFloat(C.style.top), w: C.offsetWidth, h: C.offsetHeight };   // (el estilo final: la caja se desliza con una transición)
    const dentro = c.x >= 0 && c.y >= 0 && c.x + c.w <= W + 1 && c.y + c.h <= H + 1;
    let tapa = false, centro = null; if (ve) { const r = tutRect(el); centro = Math.abs(parseFloat(h.style.left) + parseFloat(h.style.width) / 2 - (r.x + r.w / 2)) < 3 && Math.abs(parseFloat(h.style.top) + parseFloat(h.style.height) / 2 - (r.y + r.h / 2)) < 3; tapa = !(c.x + c.w <= r.x || r.x + r.w <= c.x || c.y + c.h <= r.y || r.y + r.h <= c.y); }
    out.push({ id, ve, dentro, tapa, centro, tit: C.querySelector('h3').textContent, txt: C.querySelector('p').textContent.length }); }
  TUT.i = 0; tutDibujar(); return out; })()`);
for (const [nom, celu, lang, rot] of [['celu', true, 'es', false], ['compu', false, 'en', false], ['celu parado', true, 'es', true]]) {
  const { b, p, err, ev } = await abrir(HTML, celu, null, async (pg) => { await sinWebdriver(pg); if (rot) await pg.setViewportSize({ width: 393, height: 873 }); });
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = false; PREFS.lang = '${lang}'; idiomaAplicar('${lang}'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  const solo = await p.waitForFunction(() => window.__ev('TUT.on'), null, { timeout: 60000 }).then(() => true, () => false);
  ok(`${nom}: sale solo la primera vez que entrás a jugar`, solo, await ev(`({ on: TUT.on, ui: UI.abierto })`));
  if (!solo) { await b.close(); continue; }
  const L = await revisar(ev);
  const visibles = L.filter((x) => x.ve), malos = L.filter((x) => !x.dentro || x.tapa || (x.ve && !x.centro) || !x.txt || !x.tit);
  ok(`${nom}: ${L.length} pasos; los ${visibles.length} botones resaltados en su lugar, la tarjeta entera y sin taparlos`, L.length >= (celu ? 14 : 18) && !malos.length && visibles.length >= (celu ? 12 : 1), { n: L.length, vis: visibles.length, malos: malos.slice(0, 4) });
  if (lang === 'en') ok(`${nom}: en inglés, con la tecla de cada cosa`, L.some((x) => /Jump/.test(x.tit)) && (await ev(`(() => { TUT.i = TUT.pasos.findIndex((x) => x[0] === 'saltar'); tutDibujar(); return document.querySelector('#tut kbd') ? document.querySelector('#tut kbd').textContent : null; })()`)) !== null, L.map((x) => x.tit).slice(0, 8));
  // fotos de algunos pasos
  for (const id of ['mover', 'disparo', 'menu', 'linterna']) { const i = await ev(`TUT.pasos.findIndex((x) => x[0] === '${id}')`); if (i < 0) continue; await ev(`TUT.i = ${i}; tutDibujar(); 1`); await p.waitForTimeout(450); await p.screenshot({ path: `${D}/tut_${nom.replace(' ', '_')}_${id}.png` }); }
  // siguiente hasta el final y "¡A jugar!": se cierra, queda visto y el juego vuelve a tomar los toques
  await ev(`TUT.i = 0; tutDibujar(); 1`); let n = 0; while (n < 60 && (await ev(`TUT.on`))) { await p.click('#tut [data-tut=sig]'); n++; }
  const fin = await ev(`({ on: TUT.on, visto: PREFS.tutVisto, ui: UI.abierto })`);
  ok(`${nom}: con «Siguiente» se recorre todo y se cierra (queda visto)`, !fin.on && fin.visto && !fin.ui, { ...fin, clics: n });
  // ya visto: no vuelve a salir solo
  await ev(`irMenuPrincipal(); 1`); await p.waitForTimeout(800); await ev(`inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(5000);
  ok(`${nom}: ya visto, no vuelve a salir solo`, !(await ev(`TUT.on`)));
  // desde la pausa y desde Ajustes
  await ev(`abrirPausa(); 1`); await p.waitForTimeout(300); await p.click('#bTutorial'); await p.waitForTimeout(400);
  const pau = await ev(`({ on: TUT.on, pausa: !document.getElementById('pausa').classList.contains('oc') })`);
  ok(`${nom}: desde la pausa se vuelve a ver`, pau.on && !pau.pausa, pau);
  await p.click('#tut [data-tut=saltar]'); await p.waitForTimeout(200);
  await ev(`abrirAjustes('juego'); document.querySelector('[data-aj=c]').click(); 1`); await p.waitForTimeout(300); await p.click('#aTut'); await p.waitForTimeout(400);
  ok(`${nom}: desde Ajustes (Controles y audio) también`, await ev(`TUT.on`));
  await p.click('#tut [data-tut=saltar]');
  const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x)); ok(`${nom}: sin errores de JS`, !e2.length, e2.slice(0, 5));
  await b.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(0);
