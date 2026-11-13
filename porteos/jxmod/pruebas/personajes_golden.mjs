// Personajes (concepto de GOLDEN «Mejora en la interfaz de skins»): pestañas Personajes / Mods / Gorros con buscador,
// tarjetas con la cara de cada uno y el elegido en 3D bien grande en el escenario (pedido: «que la skin se vea más»).
//  1. en la compu (1280×720) y en celulares (873×393, 640×360, el juego girado con el celular parado 393×873) y una
//     tablet (1180×820): el personaje, medido en la foto (la silueta sobre el fondo del escenario), ocupa ≥ 70 % del alto
//     del escenario, centrado a lo ancho (±6 %), entero adentro (sin cortarse) y más alto que en el menú de antes
//     (que lo dejaba en ~50 % del alto de la pantalla);
//  2. arriba entra en un renglón (pestañas y buscador, sin cortarse) en los 14 idiomas, en la compu y en 640×360;
//  3. el buscador filtra (Personajes y Gorros), elegir pone el personaje (y el escenario cambia de nombre), elegir un gorro
//     lo pone y su personalización (tamaño, X/Y/Z, color) se ve al momento; Mods: tarjetas con «Instalar» que preguntan
//     antes, «Importar personaje» está;
//  4. se gira arrastrando en el escenario y está en reposo animado (cuando terminó de girar, los huesos se mueven solos
//     respecto de la cadera ≥ 3 mm en 3 s);
//  5. jugando, Pausa → Personaje abre el mismo panel con el escenario: elegir un personaje y un gorro los pone al momento
//     en el jugador; «Volver a la pausa» vuelve a la pausa; la tecla de pausa lo cierra;
//  6. sin errores de JS.
// uso: node personajes_golden.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1200) : '')); };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
async function abrir(w, h, celu) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: !!celu, hasTouch: !!celu, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
  await p.goto(HTML + '?test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.skin = 'Hero'; PREFS.gorro = 'HatEmpty'; PREFS.gorroAj = null; 1`);
  // (el cartel de la cuenta que sale al abrir en la compu tapaba el escenario: se cierra, no es parte de lo que se mide)
  await ev(CERRAR_DLG);
  return { ctx, p, err, ev };
}
const CERRAR_DLG = `(() => { if (typeof cuPedirAlAbrir === 'function') cuPedirAlAbrir.hecho = true; if (typeof cuDialogoCerrar === 'function') cuDialogoCerrar(); for (const id of ['cuDlg', 'cfDlg']) { const d = document.getElementById(id); if (d) d.classList.add('oc'); } return 1; })()`;
// la silueta del personaje en la foto: lo que no es el fondo del escenario (con el nombre, la ayuda y el brillo del piso
// escondidos), en las coordenadas de la foto (con el juego girado, la foto está girada: se mide igual, en el lado largo)
const ESCONDER = `(() => { const E = RB.el.querySelector('.pjEscena'); E.style.background = 'none'; for (const q of ['.pjEscInfo', '.pjGira']) E.querySelector(q).style.visibility = 'hidden'; return 1; })()`;
const MOSTRAR = `(() => { const E = RB.el.querySelector('.pjEscena'); E.style.background = ''; for (const q of ['.pjEscInfo', '.pjGira']) E.querySelector(q).style.visibility = ''; return 1; })()`;
function silueta(png, r0, rot, Wv) {
  // r: el escenario en la foto (x, y, w, h), sin sus filos (el borde del costado y las esquinas redondeadas del panel)
  const r = { x: r0.x + 12, y: r0.y + 12, w: r0.w - 24, h: r0.h - 24 };
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', `crop=${Math.floor(r.w)}:${Math.floor(r.h)}:${Math.round(r.x)}:${Math.round(r.y)}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { input: png, maxBuffer: 1 << 28 });
  const w = Math.floor(r.w), h = Math.floor(r.h), bg = [30, 31, 35]; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; if (Math.abs(raw[i] - bg[0]) + Math.abs(raw[i + 1] - bg[1]) + Math.abs(raw[i + 2] - bg[2]) > 24) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return { x0, y0, x1, y1, n, w, h };
}
const fotosDe = async (A, tag) => {
  const e = await A.ev(`(() => { const E = RB.el.querySelector('.pjEscena'), r = E.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, rot: PANT.rot, W: VW(), H: VH(), enc: MENU.encuadre ? { px: MENU.encuadre.px, alto: +MENU.encuadre.alto.toFixed(2) } : null }; })()`);
  await A.ev(CERRAR_DLG); await A.ev(ESCONDER); await A.p.waitForTimeout(500); const png = await A.p.screenshot(); await A.ev(MOSTRAR); await A.p.waitForTimeout(300);
  await A.p.screenshot({ path: `${D}personajes_${tag}.png` });
  const s = silueta(png, e, e.rot);
  // (girado: el escenario en la foto es alto y angosto; el «alto» del juego es el ancho de la foto)
  const altoEsc = e.rot ? e.w : e.h, anchoEsc = e.rot ? e.h : e.w, altoP = e.rot ? s.x1 - s.x0 + 1 : s.y1 - s.y0 + 1, cx = e.rot ? (s.y0 + s.y1) / 2 : (s.x0 + s.x1) / 2;
  return { pantalla: tag, escenario: [Math.round(anchoEsc), Math.round(altoEsc)], personaje: altoP, frac: +(altoP / altoEsc).toFixed(3), fracPantalla: +(altoP / e.H).toFixed(3), centro: +((cx - (e.rot ? s.h : s.w) / 2) / anchoEsc).toFixed(3),
    adentro: s.x0 > 1 && s.y0 > 1 && s.x1 < s.w - 2 && s.y1 < s.h - 2, n: s.n, enc: e.enc };
};
// ---- 1: el tamaño del personaje en el escenario ----
const medidas = [];
for (const [w, h, celu, tag] of [[1280, 720, false, 'compu'], [873, 393, true, 'celu'], [640, 360, true, 'celu_chico'], [393, 873, true, 'girado'], [1180, 820, true, 'tablet']]) {
  const A = await abrir(w, h, celu);
  await A.ev(`RBM.pjTab = 'skin'; inicioMostrar(true); inicioPanel('personajes'); 1`); await A.p.waitForTimeout(2500);
  const m = await fotosDe(A, tag); medidas.push(m);
  if (tag === 'celu') { await A.ev(`RBM.pjTab = 'hat'; pjElegir('HatPumpkin' in DATA.ico ? 'HatPumpkin' : DATA.hats[2]); inicioPanel('personajes'); 1`); await A.p.waitForTimeout(1800); await A.p.screenshot({ path: `${D}personajes_celu_gorros.png` });
    await A.ev(`RBM.pjTab = 'mod'; PJM.ws = [{ id: '1', t: 'Kermit the Frog', img: '', mb: 0.7 }, { id: '2', t: 'Payday 2', img: '', mb: 22.6 }, { id: '3', t: 'GMod Tower Pack', img: '', mb: 66.1 }]; PJM.t = performance.now(); inicioPanel('personajes'); 1`); await A.p.waitForTimeout(1200); await A.p.screenshot({ path: `${D}personajes_celu_mods.png` }); }
  if (tag === 'compu') { await A.ev(`RBM.pjTab = 'hat'; inicioPanel('personajes'); 1`); await A.p.waitForTimeout(1500); await A.p.screenshot({ path: `${D}personajes_compu_gorros.png` }); }
  await A.ctx.close();
}
console.log('medidas', JSON.stringify(medidas));
ok('1a. el personaje ocupa ≥ 70 % del alto del escenario y está entero adentro (5 pantallas)', medidas.every((m) => m.frac >= 0.7 && m.adentro), medidas.map((m) => [m.pantalla, m.frac, m.adentro]));
ok('1b. centrado a lo ancho del escenario (±6 %)', medidas.every((m) => Math.abs(m.centro) <= 0.06), medidas.map((m) => [m.pantalla, m.centro]));
ok('1c. más grande que en el menú de antes (≥ 0,55 del alto de la pantalla; antes ~0,50)', medidas.every((m) => m.fracPantalla >= 0.55), medidas.map((m) => [m.pantalla, m.fracPantalla]));
// ---- 2-4 en la compu; 2 también en 640×360 ----
const LANGS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const cab = [];
for (const [w, h, celu] of [[1280, 720, false], [640, 360, true]]) {
  const A = await abrir(w, h, celu);
  for (const l of LANGS) for (const t of ['skin', 'mod', 'hat']) {
    const m = await A.ev(`(async () => { idiomaAplicar('${l}'); RBM.pjTab = '${t}'; inicioMostrar(true); inicioPanel('personajes'); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); pjEncajar();
      const C = RB.el.querySelector('.pjCab'), tb = C.querySelector('.tiTabs'), bus = C.querySelector('.pjBus');
      const cort = [...tb.querySelectorAll('.rbTab')].filter((x) => x.offsetLeft - tb.offsetLeft + x.offsetWidth > tb.clientWidth + 1).length;
      return { ok: C.scrollWidth <= C.clientWidth + 1 && tb.scrollWidth <= tb.clientWidth + 1 && cort === 0 && bus.offsetWidth >= 110, bus: bus.offsetWidth, c3: C.classList.contains('tiC3'), cab: [C.scrollWidth, C.clientWidth], tabs: [tb.scrollWidth, tb.clientWidth], cort }; })()`);
    if (!m.ok) cab.push(`${w}×${h} ${l} ${t} ${JSON.stringify(m)}`);
  }
  if (w === 1280) {
    await A.ev(`idiomaAplicar('es'); 1`);
    const r3 = await A.ev(`(async () => { const esp = (s) => new Promise((r) => setTimeout(r, s * 1000)), cuadros = async (n) => { const c0 = R.cuadro, t0 = performance.now(); while (R.cuadro < c0 + n && performance.now() - t0 < 20000) await esp(0.03); }; RBM.pjTab = 'skin'; PJ_Q.skin = ''; inicioPanel('personajes'); await esp(0.3);
      const P = RB.el.querySelector('.rbPan'), bus = P.querySelector('#pjBuscar'), n0 = P.querySelectorAll('.pjCard').length; bus.value = 'ro'; bus.dispatchEvent(new Event('input')); await esp(0.2);
      const fil = [...P.querySelectorAll('.pjCard b')].map((x) => x.textContent); const c = P.querySelector('.pjCard[data-rb]'); const s = c.dataset.rb.slice(6); c.click(); await esp(1.2);
      const nom = P.querySelector('.pjEscInfo b').textContent, lob = MENU.lobby && MENU.lobby.skin;
      bus.value = ''; bus.dispatchEvent(new Event('input'));
      // gorros: buscar y elegir; la personalización al momento
      RBM.pjTab = 'hat'; inicioPanel('personajes'); await esp(0.3); const bg = RB.el.querySelector('#pjBuscar'); bg.value = 'pump'; bg.dispatchEvent(new Event('input')); await esp(0.2);
      const gs = [...RB.el.querySelectorAll('.pjCard[data-rb]')].map((x) => x.dataset.rb.slice(6)); const g = RB.el.querySelector('.pjCard[data-rb]'); if (g) g.click(); await esp(0.5); await cuadros(4);
      const G0 = MENU.lobby && MENU.lobby.gorroMd; const esc0 = G0 ? Math.hypot(G0.raiz[0], G0.raiz[1], G0.raiz[2]) : 0;
      const ca = RB.el.querySelector('.gorroAj'), set = (k, v) => { const i = ca.querySelector('[data-ga=' + k + ']'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }; set('s', 150); ca.querySelector('[data-gac="#e0524f"]').click(); await esp(0.3); await cuadros(4);
      const G1 = MENU.lobby && MENU.lobby.gorroMd; const esc1 = G1 ? Math.hypot(G1.raiz[0], G1.raiz[1], G1.raiz[2]) : 0;
      const sub = RB.el.querySelector('.pjEscInfo small').textContent;
      // mods: tarjetas del Workshop con Instalar que preguntan antes; importar
      window.__inst = 0; const o = pjmInstalar; pjmInstalar = () => { window.__inst++; }; PJM.ws = [{ id: '12345', t: 'Modelo de prueba', img: '', mb: 12.5 }]; PJM.t = performance.now(); RBM.pjTab = 'mod'; inicioPanel('personajes'); await esp(0.4);
      const t = RB.el.querySelector('[data-pjm="inst:12345"]'), acc = t && t.querySelector('.pjAcc') ? t.querySelector('.pjAcc').textContent : ''; t.click(); await esp(0.2); const Dg = document.getElementById('cfDlg'), pregunta = Dg && !Dg.classList.contains('oc'); Dg.querySelector('[data-cf=si]').click(); pjmInstalar = o;
      return { n0, fil, s, nom, lob, gs, gorro: PREFS.gorro, esc: +(esc1 / esc0).toFixed(2), color: PREFS.gorroAj && PREFS.gorroAj.c, sub, acc, pregunta, inst: window.__inst, imp: !!RB.el.querySelector('.pjmImp input[type=file]') }; })()`);
    ok('3a. el buscador de Personajes filtra («ro») y tocar pone el personaje (el escenario cambia de nombre)', r3.fil.length >= 1 && r3.fil.length < r3.n0 && r3.fil.every((x) => /ro/i.test(x)) && r3.lob === r3.s && r3.nom === r3.fil[0], { n0: r3.n0, fil: r3.fil, s: r3.s, nom: r3.nom, lob: r3.lob });
    ok('3b. Gorros: el buscador filtra, elegir lo pone y la personalización se ve al momento (1,5× y rojo)', r3.gs.length >= 1 && r3.gs.every((x) => /pump/i.test(x)) && r3.gorro === r3.gs[0] && Math.abs(r3.esc - 1.5) < 0.05 && r3.color === '#e0524f' && /Pumpkin/i.test(r3.sub), { gs: r3.gs, gorro: r3.gorro, esc: r3.esc, color: r3.color, sub: r3.sub });
    ok('3c. Mods: «Instalar» en la tarjeta, pregunta antes de bajar e «Importar personaje» está', /Instalar/.test(r3.acc) && r3.pregunta && r3.inst === 1 && r3.imp, { acc: r3.acc, pregunta: r3.pregunta, inst: r3.inst, imp: r3.imp });
    // ---- 4: girar arrastrando en el escenario; reposo animado ----
    const r4 = await A.ev(`(async () => { RBM.pjTab = 'skin'; inicioPanel('personajes'); await new Promise((r) => setTimeout(r, 400)); const E = RB.el.querySelector('.pjEscena'), q = E.getBoundingClientRect(), y0 = MENU.yaw;
      const at = (x, tipo) => (tipo === 'pointerdown' ? E : window).dispatchEvent(new PointerEvent(tipo, { clientX: x, clientY: q.top + q.height / 2, bubbles: true, pointerId: 3 }));
      at(q.left + 40, 'pointerdown'); for (let i = 1; i <= 8; i++) at(q.left + 40 + i * 15, 'pointermove'); at(q.left + 160, 'pointerup');
      const P = MENU.lobby, h = P.D.h, ids = ['Head', 'LeftHand', 'RightHand', 'Spine2'].map((n) => h[n]).filter((i) => i !== undefined); P.emote = null;
      const hi = h.Hips, pos = () => { P.md.actualizar(); const C = P.md.W[hi]; return ids.map((i) => [P.md.W[i][12] - C[12], P.md.W[i][13] - C[13], P.md.W[i][14] - C[14]]); };
      const giro = MENU.yaw - y0; await new Promise((r) => setTimeout(r, 2500)); const a = pos(); let mx = 0; for (let k = 0; k < 30; k++) { await new Promise((r) => setTimeout(r, 100)); const c = pos(); for (let i = 0; i < a.length; i++) mx = Math.max(mx, Math.hypot(a[i][0] - c[i][0], a[i][1] - c[i][1], a[i][2] - c[i][2])); }
      return { giro: +giro.toFixed(3), reposoMm: +(mx * 1000).toFixed(1), mismo: P === MENU.lobby }; })()`);
    ok('4. se gira arrastrando en el escenario y el reposo está animado (≥ 3 mm en 3 s)', Math.abs(r4.giro) > 0.5 && r4.reposoMm >= 3 && r4.mismo, r4);
  }
  const e = A.err.filter((x) => !/WebSocket|ERR_|404|Failed to load/i.test(x)); if (e.length) cab.push('errores ' + e.slice(0, 2).join(' | '));
  await A.ctx.close();
}
ok('2. arriba entra en un renglón (pestañas y buscador sin cortarse) en 14 idiomas × 3 pestañas, compu y 640×360', !cab.length, cab.slice(0, 8));
// ---- 5: jugando, desde la pausa ----
{
  const A = await abrir(873, 393, true);
  await A.ev(`GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await A.p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await A.p.waitForTimeout(1000);
  await A.ev(`if (typeof cuDialogoCerrar === 'function') cuDialogoCerrar(); ENT.tactil = true; document.body.classList.add('tactil'); hudDisponer(); 1`);
  const j = await A.ev(`(async () => { const esp = (s) => new Promise((r) => setTimeout(r, s * 1000)); abrirPausa(); await esp(0.3); $('bPersonaje').click(); await esp(1.5);
    const abierto = rbVisible() && RB.panel === 'personajes' && !!RB.el.querySelector('.pjEscena') && $('pausa').classList.contains('oc'), lobby = !!MENU.lobby, escena = !!MENU.encuadre;
    const s0 = DATA.chars.find((s) => s !== PREFS.skin && s !== 'Hero'); RB.el.querySelector('[data-rb="pjSel:' + s0 + '"]').click(); await esp(1.2); const r1 = JUG.cuerpo && JUG.cuerpo.skin;
    RBM.pjTab = 'hat'; inicioPanel('personajes'); await esp(0.3); const h0 = DATA.hats.find((x) => x !== 'HatEmpty'); RB.el.querySelector('[data-rb="pjSel:' + h0 + '"]').click(); await esp(1.2); const g1 = JUG.cuerpo && JUG.cuerpo.gorro;
    const vb = RB.el.querySelector('[data-rb=volver]').textContent.trim(); RB.el.querySelector('[data-rb=volver]').click(); await esp(0.5);
    const vuelve = !rbVisible() && !$('pausa').classList.contains('oc') && UI.abierto === 'pausa';
    $('bPersonaje').click(); await esp(0.8); pulso('pausa'); await esp(0.8); const cierra = !rbVisible() && $('pausa').classList.contains('oc');
    return { abierto, lobby, escena, s0, r1, h0, g1, vb, vuelve, cierra }; })()`);
  await A.p.screenshot({ path: D + 'personajes_pausa_cerrado.png' });
  ok('5a. Pausa → Personaje abre el panel nuevo con el personaje en 3D', j.abierto && j.lobby && j.escena, j);
  ok('5b. jugando, elegir personaje y gorro los pone al momento en el jugador', j.r1 === j.s0 && j.g1 === j.h0, j);
  ok('5c. «Volver a la pausa» vuelve a la pausa y la tecla de pausa lo cierra', j.vuelve && j.cierra && /pausa/i.test(j.vb), j);
  const e = A.err.filter((x) => !/WebSocket|ERR_|404|Failed to load/i.test(x));
  ok('6. sin errores de JS', !e.length, e.slice(0, 4));
  await A.ctx.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
