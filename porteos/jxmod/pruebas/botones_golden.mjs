// «Mejores botones» (concepto de GOLDEN): la disposición nueva de los botones del celular, medida.
//  1. en 13 pantallas (de 640×360 a 1280×800 apaisadas, y el juego girado con el celular parado: 393×873 y 360×800), con
//     los controles al 60, 80, 100 y 120 % y en cada situación (a pie con las manos, la pistola, la pistola de física,
//     agarrando con ella, un arma de mod con 4 botones, algo para usar, la cámara libre con L y R, 6 teclas de mods
//     fijadas con todo lo de arriba a la izquierda —micrófono, voces, SM—, en auto y en helicóptero):
//     ningún botón visible se pisa con otro ni queda a menos de 6 px (los redondos, de borde a borde del círculo); el área
//     para el dedo de cada uno (al menos 44 px) no se pisa con la de otro; el nombre de las teclas de los mods no pisa a
//     nadie; ninguno se sale de la pantalla; la zona de la palanca (el tercio izquierdo, del 45 al 92 % del alto) queda
//     libre a pie; tamaños al 80 %: disparar, saltar, agacharse y el secundario ≥ 48 px, recargar y los de arriba a la
//     izquierda ≥ 44, los demás ≥ 34 y el área para el dedo de todos ≥ 44;
//  2. arriba a la izquierda, como en el concepto: columnas parejas (cada grupo con su x por columna y las filas a la misma
//     altura), la del sistema primero con la pausa en la esquina, la de crear al lado, sin huecos;
//  3. la disposición guardada antes de este cambio (botones movidos) queda EXACTAMENTE como estaba: se compara con el juego de
//     antes con lo mismo guardado (todos los botones, ±0,6 px); la nueva con un botón movido lo deja donde lo puso;
//     «Probar la nueva» y «Volver a la mía» van y vuelven; lo que se publica en la tienda de controles lleva la versión;
//  4. el editor: al arrastrar un botón de la nueva arranca de donde está (no salta) y guardar no la pasa a la vieja;
//  5. Pill Packs: sus botones van donde están el disparo, el secundario, la patada, recargar y el arma;
//  6. sin errores de JS.
// uso: node botones_golden.mjs URL_HTML_NUEVO [URL_HTML_ANTES] [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, ANTES, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1400) : '')); };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ARGS });
async function abrir(url, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-AR' });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.hudPos = {}; PREFS.hud = 80; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(800);
  await ev(`(() => { if (typeof cuDialogoCerrar === 'function') cuDialogoCerrar(); ENT.tactil = true; document.body.classList.add('tactil'); hudDisponer(); return 1; })()`);
  return { ctx, p, err, ev };
}
// las situaciones (cada una deja la anterior limpia)
const LIMPIAR = `(() => { if (JUG.vehiculo) salirVehiculo(); for (const o of OBJS.slice()) if (o.veh) borrarObjeto(o); $('usarTxt').textContent = ''; GMB.fijos = []; gmbFijosDibujar();
  if (typeof CLIB !== 'undefined' && CLIB.menu) clibMenu(); $('fisBotones').classList.add('oc'); $('bvolver').classList.add('oc');
  for (const i of [0, 1, 2, 3]) { const e = $('bmod' + i); if (e) { e.classList.add('oc'); e._ctl = null; } }
  if (typeof vozBotonPoner === 'function') vozBotonPoner(false); if (typeof smBotonPoner === 'function') smBotonPoner(false); return 1; })()`;
const arma = (n) => `(() => { elegirArma(ARM.lista.indexOf('${n}')); return 1; })()`;
const ESTADOS = {
  manos: arma('Hands'),
  pistola: arma('Pistol'),
  fisica: arma('PhysicsGun'),
  agarrando: `(() => { elegirArma(ARM.lista.indexOf('PhysicsGun')); $('fisBotones').classList.remove('oc'); $('bvolver').classList.remove('oc'); return 1; })()`,
  armaMod4: `(() => { elegirArma(ARM.lista.indexOf('Pistol')); for (const i of [0, 1, 2, 3]) { const e = $('bmod' + i); e._ctl = { t: 'EFZG'[i] }; e.innerHTML = '<b class="ctlLetra">' + 'EFZG'[i] + '</b>'; e.classList.remove('oc'); } $('bdisp2').classList.remove('oc'); return 1; })()`,
  usar: `(() => { elegirArma(ARM.lista.indexOf('Pistol')); $('usarTxt').textContent = 'E'; return 1; })()`,
  camLibre: `(() => { elegirArma(ARM.lista.indexOf('Pistol')); if (!CLIB.menu) clibMenu(); return 1; })()`,
  todos: `(() => { elegirArma(ARM.lista.indexOf('Pistol')); GMB.fijos = [1, 2, 3, 4, 5, 6].map((i) => ({ k: 'key:KEY_' + i, t: String(i) })); gmbFijosDibujar(); vozBotonPoner(true); smBotonPoner(true); $('usarTxt').textContent = 'E'; if (!CLIB.menu) clibMenu(); return 1; })()`,
  auto: `(() => { elegirArma(ARM.lista.indexOf('Hands')); const o = crearObjeto('Sedan', v3(JUG.pos.x + 4, JUG.pos.y + 1, JUG.pos.z), new Quat(), {}); subirVehiculo(o); return 1; })()`,
  heli: `(() => { elegirArma(ARM.lista.indexOf('Hands')); const n = DATA.pfPorNombre.CityCopter !== undefined ? 'CityCopter' : Object.keys(DATA.pfPorNombre).find((k) => /copter|heli/i.test(k)); if (!n) return 0; const o = crearObjeto(n, v3(JUG.pos.x + 6, JUG.pos.y + 2, JUG.pos.z), new Quat(), {}); if (o && o.veh) subirVehiculo(o); return 1; })()`,
};
const ESPERA = `(async () => { ARM.barraT = 0; $('barra').classList.add('oc'); $('arribaDe').style.visibility = ''; HUD.c = 9; const c0 = R.cuadro, r0 = performance.now(); while (R.cuadro < c0 + 3 && performance.now() - r0 < 15000) await new Promise((r) => setTimeout(r, 30)); hudDisponer(); return 1; })()`;
// lo que se ve, en las coordenadas del juego (con el juego girado también: los estilos que pone hudDisponer)
const MEDIR = `(() => {
  const W = VW(), H = VH(), out = [], lab = [];
  const vis = (e) => { if (!e || e.closest('.oc')) return false; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; return parseFloat(e.style.width) > 1; };
  for (const [sel] of HUD_TACTIL) for (const e of document.querySelectorAll(sel)) { if (!vis(e)) continue;
    const x = parseFloat(e.style.left), y = parseFloat(e.style.top), w = parseFloat(e.style.width), h = parseFloat(e.style.height), red = parseFloat(getComputedStyle(e).borderTopLeftRadius) >= 0.4 * Math.min(w, h);
    out.push({ s: sel, x, y, w, h, red, hit: parseFloat(e.style.getPropertyValue('--hit')) || 0 });
    const t = e.querySelector('.accTxt'); if (t && t.offsetWidth) lab.push({ s: sel + ' (nombre)', de: sel, x: x + w / 2 - t.offsetWidth / 2, y: y + t.offsetTop, w: t.offsetWidth, h: t.offsetHeight }); }
  return { W, H, b: out, lab, ver: HUD.ver, R: HUD.v2 && HUD.v2.R, q: HUD.v2 && +HUD.v2.q.toFixed(3) };
})()`;
const FREC = ['#bdisparo', '#bsaltar', '#bagachar', '#bdisp2'], MED = ['#brecargar', '[data-btn=pausa]', '[data-btn=chat]', '[data-btn=celular]', '[data-btn=menu]', '.modmBt', '.gmbBt', '.smBt', '#vozBt', '#vocesBt'];
const minDe = (s) => (FREC.includes(s) ? 48 : MED.includes(s) ? 44 : 34);
const fallas = { solape: [], dedo: [], nombre: [], afuera: [], chico: [], palanca: [], columnas: [] }, tam = {};
function revisar(M, tag, n, h80) {
  const L = M.b, gapDe = (a, c) => { const gx = Math.max(a.x - (c.x + c.w), c.x - (a.x + a.w)), gy = Math.max(a.y - (c.y + c.h), c.y - (a.y + a.h));
    return a.red && c.red ? Math.hypot(a.x + a.w / 2 - c.x - c.w / 2, a.y + a.h / 2 - c.y - c.h / 2) - (a.w + c.w) / 4 - (a.h + c.h) / 4 : Math.max(gx, gy); };
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], c = L[j], g = gapDe(a, c);
    if (g < 6) fallas.solape.push(`${tag} ${n}: ${a.s} y ${c.s} (${g.toFixed(1)} px)`);
    if (g - a.hit - c.hit < -0.5) fallas.dedo.push(`${tag} ${n}: ${a.s} y ${c.s} (${(g - a.hit - c.hit).toFixed(1)} px)`);
  }
  for (const t of M.lab) for (const a of L) { if (a.s === t.de) continue; const ix = Math.min(t.x + t.w, a.x + a.w) - Math.max(t.x, a.x), iy = Math.min(t.y + t.h, a.y + a.h) - Math.max(t.y, a.y); if (ix > 1 && iy > 1) fallas.nombre.push(`${tag} ${n}: ${t.s} pisa ${a.s}`); }
  for (const a of L) {
    if (a.x < -0.5 || a.y < -0.5 || a.x + a.w > M.W + 0.5 || a.y + a.h > M.H + 0.5) fallas.afuera.push(`${tag} ${n}: ${a.s}`);
    const t = Math.min(a.w, a.h), dedo = t + 2 * a.hit; if (h80) tam[a.s] = Math.min(tam[a.s] || 1e9, t);
    if (h80 && (t < minDe(a.s) - 0.5 || dedo < 43.5)) fallas.chico.push(`${tag} ${n}: ${a.s} ${t.toFixed(1)} px (dedo ${dedo.toFixed(1)}, mín ${minDe(a.s)})`);
    if (n !== 'auto' && n !== 'heli' && a.x < M.W * 0.33 && a.y + a.h > M.H * 0.45 && a.y < M.H * 0.92) fallas.palanca.push(`${tag} ${n}: ${a.s}`);
  }
  // (arriba a la izquierda: columnas parejas; la pausa arriba de todo y a la izquierda)
  if (M.ver === 2) {
    const zona = (q) => L.filter((a) => q.includes(a.s)).map((a) => ({ s: a.s, cx: +(a.x + a.w / 2).toFixed(1), cy: +(a.y + a.h / 2).toFixed(1) }));
    const sis = zona(HUDZ.sis), crear = zona(HUDZ.crear), todos = [...sis, ...crear];
    const p = sis.find((a) => a.s === '[data-btn=pausa]');
    if (!p || todos.some((a) => a.cx < p.cx - 0.6 || a.cy < p.cy - 0.6)) fallas.columnas.push(`${tag} ${n}: la pausa no está en la esquina`);
    const xs = [...new Set(todos.map((a) => a.cx))].sort((x, y) => x - y), ys = [...new Set(todos.map((a) => a.cy))].sort((x, y) => x - y);
    const casi = (v, L2) => L2.some((u) => Math.abs(u - v) < 0.6);
    if (todos.some((a) => !casi(a.cx, xs) || !casi(a.cy, ys)) || ys.length > 3) fallas.columnas.push(`${tag} ${n}: filas o columnas desparejas ${JSON.stringify({ xs, ys })}`);
    if (crear.length && sis.length && Math.min(...crear.map((a) => a.cx)) < Math.max(...sis.map((a) => a.cx)) - 0.6) fallas.columnas.push(`${tag} ${n}: crear no va a la derecha del sistema`);
  }
}
let HUDZ = null;
// ---- 1 y 2: pantallas × tamaños × situaciones ----
const PANTALLAS = [[640, 360], [667, 375], [720, 360], [800, 360], [844, 390], [873, 393], [915, 412], [932, 430], [1024, 600], [1180, 820], [1280, 800], [393, 873], [360, 800]];
const fotos = { '873x393': ['manos', 'fisica', 'agarrando', 'todos', 'auto'], '640x360': ['todos'], '393x873': ['pistola'], '1180x820': ['todos'], '915x412': ['camLibre'] };
const resumen = [];
for (const [w, h] of PANTALLAS) {
  const A = await abrir(HTML, w, h);
  if (!HUDZ) HUDZ = await A.ev(`({ sis: HUD_ZONAS.sis.l, crear: HUD_ZONAS.crear.l })`);
  const rot = await A.ev(`({ rot: PANT.rot, W: VW(), H: VH() })`);
  for (const pct of [80, 60, 100, 120]) {
    await A.ev(`PREFS.hud = ${pct}; hudDisponer(); 1`);
    for (const [n, js] of Object.entries(ESTADOS)) {
      if (pct !== 80 && !['todos', 'agarrando', 'armaMod4', 'auto'].includes(n)) continue;
      await A.ev(LIMPIAR); await A.ev(js); await A.ev(ESPERA);
      const M = await A.ev(MEDIR), tag = `${w}×${h}${rot.rot ? ' (girado)' : ''} ${pct}%`;
      revisar(M, tag, n, pct === 80);
      if (pct === 80 && n === 'todos') resumen.push({ pantalla: `${w}×${h}`, juego: `${rot.W}×${rot.H}`, filas: M.R, q: M.q, n: M.b.length });
      const k = `${w}x${h}`; if (pct === 80 && fotos[k] && fotos[k].includes(n)) await A.p.screenshot({ path: `${D}botones_${k}_${n}.png` });
      if (pct === 80 && n === 'todos' && process.env.VOLCAR) console.log('VIS', w, h, JSON.stringify(M.b.map((a) => [a.s, Math.round(a.x + a.w / 2), Math.round(a.y + a.h / 2), Math.round(a.w)])));
    }
  }
  const e = A.err.filter((x) => !/WebSocket|ERR_|404|Failed to load/i.test(x)); if (e.length) fallas.afuera.push(`${w}×${h} errores JS: ${e.slice(0, 2).join(' | ')}`);
  await A.ctx.close();
}
const lim = (L) => ({ n: L.length, ej: L.slice(0, 10) });
console.log('pantallas', JSON.stringify(resumen));
console.log('tamaño mínimo visto al 80 % (px)', JSON.stringify(Object.fromEntries(Object.entries(tam).map(([k, v]) => [k, +v.toFixed(1)]))));
ok('1a. ningún botón visible se pisa ni queda a menos de 6 px de otro (13 pantallas, 60-120 %, 10 situaciones)', !fallas.solape.length, lim(fallas.solape));
ok('1b. el área para el dedo (≥ 44 px) de cada uno no pisa la de otro', !fallas.dedo.length, lim(fallas.dedo));
ok('1c. el nombre de las teclas de los mods no pisa a ningún botón', !fallas.nombre.length, lim(fallas.nombre));
ok('1d. ninguno se sale de la pantalla (y sin errores de JS)', !fallas.afuera.length, lim(fallas.afuera));
ok('1e. tamaños al 80 %: 48 px los de uso frecuente, 44 recargar y los de arriba a la izquierda, 34 los demás; dedo ≥ 44', !fallas.chico.length, lim(fallas.chico));
ok('1f. la zona de la palanca queda libre a pie', !fallas.palanca.length, lim(fallas.palanca));
ok('2. arriba a la izquierda: columnas parejas, la pausa en la esquina, crear a la derecha del sistema', !fallas.columnas.length, lim(fallas.columnas));
// ---- 3: lo guardado antes queda igual ----
const GUARDADO = { '#bdisparo': [-300, 250, 160], '[data-btn=chat]': [60, -150, 90], _orden: { sis: ['[data-btn=pausa]', '[data-btn=celular]', '[data-btn=chat]'] } };
const medirCon = async (A, hp, n) => { await A.ev(`PREFS.hudPos = ${JSON.stringify(hp)}; PREFS.hud = 80; hudDisponer(); 1`); await A.ev(LIMPIAR); await A.ev(ESTADOS[n]); await A.ev(ESPERA); return A.ev(MEDIR); };
if (ANTES) {
  const A0 = await abrir(ANTES, 873, 393), A1 = await abrir(HTML, 873, 393); const dif = []; let comp = 0;
  for (const n of ['manos', 'pistola', 'fisica', 'agarrando', 'usar']) {
    const m0 = await medirCon(A0, GUARDADO, n), m1 = await medirCon(A1, GUARDADO, n);
    for (const a of m0.b) { const c = m1.b.find((x) => x.s === a.s); comp++; if (!c) { dif.push(`${n}: ${a.s} no está`); continue; } const d = Math.max(Math.abs(a.x - c.x), Math.abs(a.y - c.y), Math.abs(a.w - c.w)); if (d > 0.6) dif.push(`${n}: ${a.s} ${d.toFixed(1)} px`); }
    if (m1.ver !== 1) dif.push(`${n}: versión ${m1.ver}`);
  }
  await A0.p.screenshot({ path: D + 'botones_guardado_antes.png' }); await A1.p.screenshot({ path: D + 'botones_guardado_ahora.png' });
  ok('3a. una disposición guardada antes queda igual que en el juego de antes (todos los botones, ±0,6 px)', !dif.length && comp > 30, { comparados: comp, dif: dif.slice(0, 8) });
  await A0.ctx.close(); await A1.ctx.close();
}
{
  const A = await abrir(HTML, 873, 393);
  const m = await medirCon(A, { _v: 2, '#bsaltar': [-400, 120, 130] }, 'manos');
  const j = m.b.find((a) => a.s === '#bsaltar'), esp = await A.ev(`(() => { const kb = Math.sqrt(VW() / 1280 * VH() / 720), k = kb * hudTam(); return { cx: VW() - 400 * kb, cy: VH() - 120 * kb, t: 130 * k }; })()`);
  ok('3b. la nueva con un botón movido: ése queda donde lo puso y los demás en la nueva', m.ver === 2 && Math.abs(j.x + j.w / 2 - esp.cx) < 0.6 && Math.abs(j.y + j.h / 2 - esp.cy) < 0.6 && Math.abs(j.w - esp.t) < 0.6, { ver: m.ver, j, esp });
  const ida = await A.ev(`(() => { PREFS.hudPos = ${JSON.stringify(GUARDADO)}; hudDisponer(); const v0 = HUD.ver; ctlAbrir('pausa'); const b1 = !!document.querySelector('[data-ctl=hudNueva]'); ctlAccion('hudNueva'); const v1 = HUD.ver, bk = !!PREFS.hudPosV1, b2 = !!document.querySelector('[data-ctl=hudMia]');
    ctlAccion('hudMia'); const v2 = HUD.ver, igual = JSON.stringify(PREFS.hudPos) === ${JSON.stringify(JSON.stringify(GUARDADO))}; const d = ctlDatos(); ctlAccion('hudFab'); const d2 = ctlDatos(); ctlCerrar(); cerrarPaneles();
    return { v0, b1, v1, bk, b2, v2, igual, pub: d.v, pubHud: !!d.hud['#bdisparo'], fab: HUD.ver, fabV: d2.hud._v }; })()`);
  ok('3c. «Probar la nueva» pasa a la nueva guardando la tuya y «Volver a la mía» la deja igual; la tienda publica con versión', ida.v0 === 1 && ida.b1 && ida.v1 === 2 && ida.bk && ida.b2 && ida.v2 === 1 && ida.igual && ida.pub === 2 && ida.pubHud && ida.fab === 2 && ida.fabV === 2, ida);
  // ---- 4: el editor ----
  const ed = await A.ev(`(() => { PREFS.hudPos = {}; hudDisponer(); ctlEditar(); const r = HUD_TACTIL.find((x) => x[0] === '#bdisparo'); const e = $('bdisparo'); const c0 = [parseFloat(e.style.left) + parseFloat(e.style.width) / 2, parseFloat(e.style.top) + parseFloat(e.style.height) / 2, parseFloat(e.style.width)];
    const P0 = ctlPosDe(r); CTL.borrador['#bdisparo'] = P0.slice(); hudDisponer(); const c1 = [parseFloat(e.style.left) + parseFloat(e.style.width) / 2, parseFloat(e.style.top) + parseFloat(e.style.height) / 2, parseFloat(e.style.width)];
    CTL.borrador['#bdisparo'] = [P0[0] - 40, P0[1] + 20, P0[2]]; hudDisponer(); const ver = HUD.ver; ctlSalirEditor(true); const g = JSON.parse(JSON.stringify(PREFS.hudPos)); ctlCerrar(); cerrarPaneles();
    return { salto: +Math.max(Math.abs(c0[0] - c1[0]), Math.abs(c0[1] - c1[1]), Math.abs(c0[2] - c1[2])).toFixed(2), verEditando: ver, guardadoV: g._v, verDespues: HUD.ver }; })()`);
  ok('4. el editor: el botón arranca de donde está (salta ≤ 0,6 px) y al guardar sigue la nueva', ed.salto <= 0.6 && ed.verEditando === 2 && ed.guardadoV === 2 && ed.verDespues === 2, ed);
  // ---- 5: Pill Packs ----
  const pl = await A.ev(`(async () => { PREFS.hudPos = {}; hudDisponer(); if (typeof pillHudArmar !== 'function') return { no: 1 }; pillHudArmar(); pillHudUbicar();
    const L = ['bdisparo', 'bdisp2', 'bpatada', 'brecargar']; let peor = 0; for (let i = 0; i < 4; i++) { const a = $(L[i]), p = $('bpill' + i); for (const k of ['left', 'top', 'width']) peor = Math.max(peor, Math.abs(parseFloat(a.style[k]) - parseFloat(p.style[k]))); }
    const aa = $('armaAct'), v = $('bpill4'), cxA = parseFloat(aa.style.left) + parseFloat(aa.style.width) / 2, cxV = parseFloat(v.style.left) + parseFloat(v.style.width) / 2; peor = Math.max(peor, Math.abs(cxA - cxV)); return { peor: +peor.toFixed(2) }; })()`);
  ok('5. Pill Packs: sus 5 botones van donde están los que reemplazan (±0,6 px)', pl.peor !== undefined && pl.peor <= 0.6, pl);
  const e = A.err.filter((x) => !/WebSocket|ERR_|404|Failed to load/i.test(x));
  ok('6. sin errores de JS', !e.length, e.slice(0, 4));
  await A.ctx.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
