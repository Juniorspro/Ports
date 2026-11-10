// Pill Packs (pillpacks.js): la pestaña del menú de spawn, transformarse en cada personaje (cuerpo, cámara en tercera,
// vida, velocidad, tamaño), los pies en el piso (quieto y caminando), cada habilidad (lo que hace y lo que gasta), el nivel,
// volver con H y el costo por cuadro. Fotos de la pestaña, de cada transformación y de las habilidades.
// uso: node pill_packs.mjs URL_HTML CARPETA_FOTOS [celu]   (URL_HTML con http://; un python3 -m http.server en su carpeta)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, DIR = '.', MODO] = process.argv, D = DIR.replace(/\/?$/, '/'), CELU = MODO === 'celu', PRE = CELU ? 'celu_' : 'pc_'; fs.mkdirSync(D, { recursive: true });
let ok = 0, mal = 0; const res = (b, t, x) => { b ? ok++ : mal++; console.log((b ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
const prefs = { bienvenida: true, gfx: 'medio', res: 100, resDin: false, fps: false, lang: 'es', motor: 'webgl2', motorV: 2 };
const { b, p, err, ev } = await abrir(HTML, CELU, null, async (pg) => {
  await pg.addInitScript((pr) => { try { localStorage.setItem('jx_prefs', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('jx_prefs') || '{}'), pr))); localStorage.removeItem('jx_pills_xp'); } catch (e) {} }, prefs);
});
const J = async (s) => JSON.parse(await ev(`JSON.stringify(${s})`));
const cuadros = async (n) => { const m0 = await ev(`R.marca`); for (let i = 0; i < 150 && (await ev(`R.marca`)) < m0 + n; i++) await p.waitForTimeout(50); };
const foto = async (n) => { await cuadros(3); await p.screenshot({ path: D + PRE + n + '.png' }); };
await ev(`GFX.auto = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`MUNDO.nombre === 'FlatGrass' && JUEGO.estado === 'juego'`), null, { timeout: 120000, polling: 300 });
await p.waitForTimeout(3000);

// ---- la pestaña ----
await ev(`abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.pill); UI.sub = 0; spawnDibujar(); 1`);
await p.waitForTimeout(1500);
const tab = await J(`({ tabs: [...$('tabs').children].map((t) => t.textContent), i: UI.tab, gm: DATA.menu.findIndex((c) => c.n === 'GMod'), ar: DATA.menu.findIndex((c) => c.n === 'Weapons'), cats: [...$('cats').querySelectorAll('.cat')].map((c) => c.textContent), cartas: $('grilla').querySelectorAll('.pillIt').length, imgs: [...$('grilla').querySelectorAll('.pillIt img')].filter((i) => i.complete && i.naturalWidth > 0).length, sel: $('tabs').children[UI.tab].classList.contains('sel') })`);
res(tab.cartas >= 20 && tab.i === (tab.gm >= 0 ? tab.gm : tab.ar) + 1 && tab.tabs[tab.i] === 'Pill Packs', 'pestaña Pill Packs al lado de GMod (o de Armas, sin addons) con sus tarjetas', tab);
await p.screenshot({ path: D + PRE + 'pestana.png' });
// (la identidad de los menús 3.0, como menus_jx.mjs: sin redondeados, sombras con desenfoque ni degradados; letras de 11 px o
// más; tarjetas de 40 px o más y adentro del panel)
const ident = `(() => { const sp = $('spawn'), R = sp.getBoundingClientRect(), malos = [];
  for (const e of sp.querySelectorAll('.pillIt, .pillIt *, .pillInfo, .pillPie, .pillVolverBt')) { if (!e.getClientRects().length || e.tagName === 'IMG') continue; const c = getComputedStyle(e), id = e.className || e.tagName;
    if (parseFloat(c.borderTopLeftRadius) > 1) malos.push(id + ' redondeado'); if (/gradient/.test(c.backgroundImage)) malos.push(id + ' degradado');
    for (const sh of [c.boxShadow, c.textShadow]) if (sh !== 'none' && sh.split(/,(?![^(]*\\))/).some((q) => { const n = (q.match(/-?[\\d.]+px/g) || []).map(parseFloat); return n.length >= 3 && n[2] > 0.5; })) malos.push(id + ' sombra');
    if (e.childNodes.length && [...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()) && parseFloat(c.fontSize) < 11) malos.push(id + ' letra ' + c.fontSize); }
  const cartas = [...sp.querySelectorAll('.pillIt')].map((d) => d.getBoundingClientRect()), gr = $('grilla').getBoundingClientRect();
  const chicas = cartas.filter((r) => Math.min(r.width, r.height) < 40).length, fuera = cartas.filter((r) => r.left < gr.left - 1 || r.right > gr.right + 1).length;
  const vb = $('pillVolverBt'), vr = vb && vb.getBoundingClientRect();
  return { malos: [...new Set(malos)], chicas, fuera, volver: vr ? [Math.round(vr.width), Math.round(vr.height), vr.right <= R.right + 1 && vr.bottom <= R.bottom + 1] : null }; })()`;
const id0 = await J(ident);
res(!id0.malos.length && !id0.chicas && !id0.fuera, 'la pestaña con la identidad de los menús (sin adornos, letras ≥ 11 px, tarjetas ≥ 40 px y adentro)', id0);
await ev(`UI.sub = 1; spawnDibujar(); 1`); await p.waitForTimeout(1200);
const fn = await J(`[...$('grilla').querySelectorAll('.pillIt span')].map((s) => s.textContent)`);
res(['Freddy Fazbear', 'Bonnie', 'Chica', 'Foxy'].every((n) => fn.includes(n)), 'la categoría FNAF tiene a los cuatro animatrónicos', fn);
await p.screenshot({ path: D + PRE + 'pestana_fnaf.png' });

// ---- transformarse ----
const pisoMed = `(() => { const P = JUG.cuerpo, Dd = P.D, md = P.md; md.actualizar(); let bajo = Math.min(md.W[Dd.h.LeftFoot][13], md.W[Dd.h.RightFoot][13]) - Dd.tobillo; const pz = Dd.pies;
  if (pz) for (const [l, iF] of [['L', Dd.h.LeftFoot], ['R', Dd.h.RightFoot]]) { const W = md.W[iF]; for (const q of pz[l]) { const y = W[1] * q.x + W[5] * q.y + W[9] * q.z + W[13]; if (y < bajo) bajo = y; } }
  const g = mundoRayo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), v3(0, -1, 0), 10); const piso = JUG.pos.y + 0.5 - g.t; return +(bajo - piso).toFixed(3); })()`;
const medirPies = async (andando) => {
  if (andando) await ev(`ENT.teclas.add('KeyW'); 1`);
  const L = []; for (let i = 0; i < (andando ? 24 : 6); i++) { await cuadros(2); if ((await ev(`JUG.suelo`)) === true) L.push(await J(pisoMed)); }
  if (andando) await ev(`ENT.teclas.delete('KeyW'); ENT.x = ENT.y = 0; 1`);
  return { min: Math.min(...L), max: Math.max(...L) };
};
const pulsar = async (i, ms) => { await ev(`ENT.pillA${i} = true; 1`); await cuadros(2); if (ms) await p.waitForTimeout(ms); await ev(`ENT.pillA${i} = false; 1`); await cuadros(2); };
const npcCerca = (d) => ev(`(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); const Q = npcCrear('Jean', vadd(JUG.pos, vscale(f, ${d})), JUG.yaw + Math.PI); return !!Q; })()`);
// (la referencia: el personaje de siempre, medido igual —el cuerpo del jugador va unos centímetros metido en el piso—)
await ev(`cerrarPaneles(); 1`); // (caminando, los grandes —el Boiled One— levantan los dos pies unos centímetros en el paso, igual que con su skin sin
// transformarse: aterrizarPies los baja de a poco)
const base = await medirPies(false), baseW = await medirPies(true); console.log('pies del personaje de siempre:', JSON.stringify({ quieto: base, camina: baseW }));
const PJ = CELU ? ['freddy', 'bonnie', 'chica', 'foxy'] : ['freddy', 'bonnie', 'chica', 'foxy', 'zombi', 'goku', 'boiled', 'robot', 'ninja'];
for (const id of PJ) {
  await ev(`cerrarPaneles(); JUG.vida = 100; JUG.pos.copy(MUNDO.spawns[0] || JUG.pos); JUG.vel.set(0, 0, 0); JUG.yaw = 0.6; JUG.pitch = 0.18; 1`);
  await ev(`abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.pill); UI.sub = 0; spawnDibujar(); 1`); await p.waitForTimeout(300);
  await ev(`$('grilla').querySelector('[data-pill="${id}"]').click(); 1`);
  await p.waitForFunction((x) => window.__ev(`PILL.on && PILL.id === '${x}' && JUG.cuerpo && JUG.cuerpo.skin === PILL.def.skin`), id, { timeout: 60000, polling: 300 }).catch(() => {});
  await p.waitForTimeout(1500);
  const e = await J(`({ on: PILL.on, skin: JUG.cuerpo.skin, tercera: JUG.tercera, vida: JUG.vida, vidaMax: JUG.vidaMax, vel: +JUG.vel_max.toFixed(2), tam: +(JUG.tam || 1).toFixed(3), ojo: +JUG.ojoAlto.toFixed(2), menu: UI.abierto, hud: !$('pillHud').classList.contains('oc'), hp: $('phHpN').textContent, poder: $('phPodN').textContent, niv: $('phNivN').textContent, camD: +CAM.pos.distTo(JUG.ojoPos).toFixed(2), arma: ARM.lista[ARM.i] })`);
  res(e.on && e.tercera && e.vida === e.vidaMax && e.hud && !e.menu && e.arma === 'Hands', `${id}: transformado (${e.skin}), tercera persona, vida ${e.vidaMax}, HUD`, e);
  if (id === 'freddy') {
    // (los sonidos de los animatrónicos vienen en un paquete chico propio —a_pill—, sin bajar la pizzería entera)
    const so = await J(`({ paq: rbListo('a_pill'), pizzeria: rbListo('m_RB_Pizzeria'), sons: ['fn_grito', 'fn_risa', 'fn_paso1', 'fn_cajita', 'fn_estatica', 'fn_ollas', 'fn_foxycorre'].filter((n) => !PK.parte('a:' + n)) })`);
    res(so.paq && !so.pizzeria && !so.sons.length, 'los sonidos de los animatrónicos están (paquete a_pill, sin la pizzería)', so);
  }
  await foto(id);
  // (el HUD del personaje no pisa la palanca, los botones de la pantalla ni la barra de habilidades)
  const pisa = await J(`(() => { const H = $('pillHud').getBoundingClientRect(), L = [];
    const ver = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05;
    for (const e of [$('palanca'), ...document.querySelectorAll('.bt-t, #pillBar, #hud > .boton, #botones > *')]) { if (!ver(e) || $('pillHud').contains(e)) continue; const r = e.getBoundingClientRect(); if (r.width && H.left < r.right - 1 && r.left < H.right - 1 && H.top < r.bottom - 1 && r.top < H.bottom - 1) L.push(e.id || e.className); }
    return { hud: [Math.round(H.left), Math.round(H.top), Math.round(H.right), Math.round(H.bottom)], pisa: L, dentro: H.left >= 0 && H.top >= 0 && H.right <= innerWidth && H.bottom <= innerHeight }; })()`);
  res(!pisa.pisa.length && pisa.dentro, `${id}: el HUD (vida, poder, nivel) no pisa otros controles y entra en la pantalla`, pisa);
  const q = await medirPies(false), w = await medirPies(true);
  res(Math.abs(q.min - base.min) < 0.025 && Math.abs(q.max - base.max) < 0.025 && w.min > baseW.min - 0.045 && w.max < baseW.max + 0.08, `${id}: pies en el piso como el personaje de siempre (quieto y caminando)`, { quieto: q, camina: w });
  await ev(`ENT.teclas.add('KeyW'); 1`); await cuadros(10); await foto(id + '_camina'); await ev(`ENT.teclas.delete('KeyW'); ENT.x = ENT.y = 0; 1`); await cuadros(20);
  // las habilidades
  const H = await J(`PILL.def.hab.map((h) => h && h.t)`);
  for (let i = 0; i < 4; i++) {
    const t = H[i]; if (!t) continue;
    // (cada una en un lugar limpio: el NPC que voló con el golpe no empuja al que grita)
    await ev(`PILL.pod = pillPodMax(); PILL.cd = [0, 0, 0, 0]; JUG.pos.x += 7; JUG.vel.set(0, 0, 0); 1`); await cuadros(8);
    if (t === 'golpe' || t === 'embestida') await npcCerca(t === 'golpe' ? 1.4 : 3);
    if (t === 'curar') await ev(`JUG.vida = 40; 1`);
    if (t === 'tele' || t === 'rafaga') await ev(`JUG.pitch = 0.25; 1`);
    const a = await J(`({ pod: PILL.pod, vida: JUG.vida, pos: [JUG.pos.x, JUG.pos.z], npc: PERS.filter((Q) => Q.npc).map((Q) => Q.vida) })`);
    if (t === 'carrera') {
      await ev(`ENT.teclas.add('KeyW'); 1`); await cuadros(20); const v0 = await J(`Math.hypot(JUG.vel.x, JUG.vel.z)`);
      await ev(`ENT.pillA2 = true; 1`); await cuadros(30); const v1 = await J(`Math.hypot(JUG.vel.x, JUG.vel.z)`); await foto(id + '_carrera');
      const c = await J(`({ car: PILL.carrera, pod: PILL.pod })`); await ev(`ENT.pillA2 = false; ENT.teclas.delete('KeyW'); ENT.x = ENT.y = 0; 1`); await cuadros(4);
      res(c.car && v1 > v0 * 1.25 && c.pod < a.pod, `${id}: carrera más rápida y gasta poder`, { v0: +v0.toFixed(2), v1: +v1.toFixed(2), pod: +c.pod.toFixed(1) });
      continue;
    }
    await pulsar(i);
    await p.waitForTimeout(t === 'susto' ? 450 : 250); await foto(id + '_' + t);
    const d = await J(`({ pod: PILL.pod, cd: PILL.cd[${i}], vida: JUG.vida, pos: [JUG.pos.x, JUG.pos.z], emote: JUG.cuerpo.emote, npc: PERS.filter((Q) => Q.npc).map((Q) => Q.vida), acc: !!JUG.cuerpo.accion })`);
    const movio = Math.hypot(d.pos[0] - a.pos[0], d.pos[1] - a.pos[1]);
    const bien = { golpe: d.npc.some((v, k) => v < a.npc[k]), susto: d.emote === 'Scream' && d.pod < a.pod, cajita: d.pod < a.pod, tele: movio > 2, curar: d.vida > 40, embestida: movio > 1.5 && d.npc.some((v, k) => v < a.npc[k]), salto: d.pod < a.pod, rafaga: d.pod < a.pod }[t];
    res(!!bien, `${id}: habilidad ${i + 1} (${t})`, { antes: a, despues: d, movio: +movio.toFixed(2) });
    await p.waitForTimeout(t === 'susto' ? 1000 : 300); await ev(`for (const Q of PERS.filter((Q) => Q.npc)) borrarPersona(Q); JUG.cuerpo.emote = null; 1`);
  }
}
// ---- el nivel ----
const n0 = await J(`pillNivel()`); await ev(`pillXp(120); 1`); await cuadros(4);
const n1 = await J(`({ n: pillNivel(), hud: $('phNivN').textContent, vm: JUG.vidaMax, guardado: JSON.parse(localStorage.getItem('jx_pills_xp') || '{}') })`);
// el pie de la pestaña transformado: «Sos … · nivel …» y el botón Volver
await ev(`abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.pill); UI.sub = 0; spawnDibujar(); 1`); await p.waitForTimeout(800);
const id1 = await J(ident); await p.screenshot({ path: D + PRE + 'pestana_transformado.png' }); await ev(`cerrarPaneles(); 1`);
res(!id1.malos.length && id1.volver && id1.volver[1] >= 40 && id1.volver[2], 'transformado, el pie muestra quién sos y el botón Volver (≥ 40 px, adentro)', id1);
res(n1.n > n0 && n1.hud === String(n1.n), 'el nivel sube con la experiencia (y se guarda)', { n0, n1 });
await foto('nivel');
// ---- primera persona (V) y volver con H ----
await ev(`JUG.tercera = false; 1`); await cuadros(6); const p1 = await J(`+CAM.pos.distTo(JUG.ojoPos).toFixed(2)`); await foto('primera'); await ev(`JUG.tercera = true; 1`);
res(p1 < 0.3, 'primera persona: la cámara en los ojos', p1);
await p.keyboard.press('KeyH'); await cuadros(6);
const v = await J(`({ on: PILL.on, skin: JUG.cuerpo.skin, vm: JUG.vidaMax, vel: JUG.vel_max, tam: JUG.tam, hud: $('pillHud').classList.contains('oc'), tercera: JUG.tercera })`);
res(!v.on && v.skin === (await J(`PREFS.skin`)) && v.hud && v.tam === 1, 'H: volviste a tu personaje', v);
await foto('volver');
// ---- el costo por cuadro (transformado en Freddy, quieto y caminando) ----
await ev(`pillAplicar('freddy'); 1`); await cuadros(10);
const costo = await p.evaluate(() => window.__ev(`(async () => { let n = 0, t = 0; const f0 = pillPaso; pillPaso = function (dt) { const a = performance.now(); f0(dt); t += performance.now() - a; n++; }; ENT.teclas.add('KeyW'); await new Promise((r) => setTimeout(r, 4000)); ENT.teclas.delete('KeyW'); ENT.x = ENT.y = 0; pillPaso = f0; return { cuadros: n, msPorCuadro: +(t / Math.max(1, n)).toFixed(4) }; })()`));
res(costo.msPorCuadro < 0.15, 'costo de pillPaso por cuadro', costo);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|GPU stall|swiftshader|Automatic fallback/i.test(x));
res(!e2.length, 'sin errores de JS', e2.slice(0, 6));
console.log(`RESUMEN ${ok}/${ok + mal}`);
await b.close();
process.exit(mal ? 1 : 0);
