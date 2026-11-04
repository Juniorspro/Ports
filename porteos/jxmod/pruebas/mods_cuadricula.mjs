// el menú de mods de GMod en cuadrícula (pedido: «el menú debe ser como un menú de cuadrícula y podés entrar a cada mod, si
// es un mapa va a los mapas no ahí, si es un efecto de pantalla VHS o algo te deja configurado y se aplica no como un item
// sino como un activado y desactivado»). Con la Lightsaber, M9K, un mod de mapas (ttt_backrooms) y un efecto VHS hecho acá
// (un .gma chico: RenderScreenspaceEffects con DrawColorModify, rayas en HUDPaint y dos ajustes):
//  1. la cuadrícula: una tarjeta por mod con imagen, nombre y qué es; el de mapas no está (aviso «están en Mapas») y su
//     mapa sí está en la lista de mapas
//  2. el efecto se ve prendido: el color de la imagen cambia (filtro del lienzo y capa que suma) y las rayas se dibujan
//  3. el interruptor de la tarjeta lo apaga sin entrar: en 2 cuadros no queda nada del efecto, y queda guardado
//  4. tocar una tarjeta entra a su página (con «‹ Mods»); la del efecto empieza con el interruptor y sus ajustes, y un
//     ajuste cambia el efecto al momento; «‹ Mods» vuelve a la cuadrícula
//  5. en el celu parado la cuadrícula y la página entran en la pantalla
//  6. sin errores de JS
// uso: node mods_cuadricula.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML, CARP, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
// el .gma del efecto VHS (formato 3: cabecera, tabla de archivos, datos)
const LUA = `CreateClientConVar("vhs_color", "0.4", true, false, "Cuanto color queda (0 a 1)")
CreateClientConVar("vhs_rayas", "1", true, false, "Rayas de la cinta")
hook.Add("RenderScreenspaceEffects", "VHS_Prueba", function()
  DrawColorModify({ ["$pp_colour_addr"] = 0.06, ["$pp_colour_addg"] = 0, ["$pp_colour_addb"] = 0.03, ["$pp_colour_brightness"] = -0.02, ["$pp_colour_contrast"] = 1.1, ["$pp_colour_colour"] = GetConVar("vhs_color"):GetFloat(), ["$pp_colour_mulr"] = 0, ["$pp_colour_mulg"] = 0, ["$pp_colour_mulb"] = 0 })
end)
hook.Add("HUDPaint", "VHS_Prueba_Rayas", function()
  if GetConVar("vhs_rayas"):GetInt() == 0 then return end
  surface.SetDrawColor(0, 0, 0, 70)
  for y = 0, ScrH(), 4 do surface.DrawRect(0, y, ScrW(), 1) end
end)
`;
function gma(nombre, archivos) {
  const te = new TextEncoder(), partes = [], u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
  partes.push(Buffer.from('GMAD'), Buffer.from([3]), Buffer.alloc(8), Buffer.alloc(8), Buffer.from([0]));
  partes.push(Buffer.from(te.encode(nombre + '\0{"description":"efecto de prueba","type":"effects","tags":["fun"]}\0jx\0')), u32(1));
  archivos.forEach(([r, d], i) => { partes.push(u32(i + 1), Buffer.from(te.encode(r + '\0')), u32(d.length), u32(0), u32(0)); });
  partes.push(u32(0)); for (const [, d] of archivos) partes.push(Buffer.from(d)); partes.push(u32(0));
  return Buffer.concat(partes);
}
const VHS = gma('VHS de prueba', [['lua/autorun/client/vhs_prueba.lua', new TextEncoder().encode(LUA)]]).toString('base64');
for (const modo of ['pc', 'parado']) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(modo === 'parado' ? { viewport: { width: 393, height: 873 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => err.push(e.message.slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') err.push(m.type() + ': ' + m.text().slice(0, 200)); });
  await p.goto(HTML); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); localStorage.removeItem('rb_gmb_apagados'); GMA.apagados.clear(); 1`);
  await p.waitForTimeout(2500);
  await ev(`(async () => { for (const id of ['111412589', '128089118', '1751661372']) { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma')).arrayBuffer()); const A = await gmInstalar(id, { nombre: { '111412589': 'Lightsaber', '128089118': 'M9K Assault Rifles', '1751661372': 'ttt_backrooms' }[id], sinDeps: true }, b); await A.listo; }
    const v = Uint8Array.from(atob('${VHS}'), (c) => c.charCodeAt(0)); const A = await gmInstalar('local:vhs', { nombre: 'VHS de prueba', sinDeps: true }, v); await A.listo; return 1; })()`);
  await p.waitForTimeout(1200);
  // (esperar cuadros del juego)
  const cuadros = async (n = 3) => { for (let i = 0; i < n; i++) { const t0 = await ev(`TIEMPO.t`); await p.waitForFunction((x) => window.__ev(`TIEMPO.t`) > x, t0, { timeout: 20000, polling: 16 }); } };
  // 1. la cuadrícula
  const g = await ev(`(() => { gmbAbrir(); const P = document.getElementById('gmbPanel'), T = [...P.querySelectorAll('.gbMod')].map((t) => ({ id: t.dataset.gb.slice(4), nom: t.querySelector('b').textContent, tipo: t.querySelector('small').textContent, img: !!t.querySelector('img').getAttribute('src'), sw: !!t.querySelector('[data-gb^="tog:"]') }));
    const mapa = [...GBSP.mapas.entries()].find(([k, x]) => x.id === '1751661372');
    return { T, aviso: (P.querySelector('.gbMapasAviso') || {}).textContent || '', mapaEnLista: !!mapa && MAPAS_RB.includes(mapa[0]), atras: !!P.querySelector('[data-gb="atras"]') }; })()`);
  await p.screenshot({ path: D + 'mods_' + modo + '_cuadricula.png' });
  const ids = g.T.map((t) => t.id).sort(), vhs = g.T.find((t) => t.id === 'local:vhs');
  ok(`${modo}: 1. una tarjeta por mod (imagen, nombre, qué es); el de mapas no está y su mapa sí está en Mapas`, ids.join() === ['111412589', '128089118', 'local:vhs'].join() && g.T.every((t) => t.img && t.nom && t.tipo) && vhs && vhs.sw && /effect|efecto/i.test(vhs.tipo) && /1/.test(g.aviso) && g.mapaEnLista && !g.atras, g);
  // 2. el efecto prendido
  await cuadros();
  const ef = () => ev(`(() => { const c = R.cv, capas = [...document.querySelectorAll(".gmPP")].sort((a, b) => (a.style.mixBlendMode === "multiply") - (b.style.mixBlendMode === "multiply")), h = document.getElementById('gmHUD'); return { filtro: c.style.filter, suma: capas[0] ? (capas[0].style.display !== 'none' ? capas[0].style.background : '') : null, resta: capas[1] ? (capas[1].style.display !== 'none' ? capas[1].style.background : '') : null, hud: !!(h && h.style.display !== 'none'), apagados: [...GMA.apagados], guardado: localStorage.getItem('rb_gmb_apagados') }; })()`);
  const on1 = await ef();
  ok(`${modo}: 2. el efecto prendido se ve: color (contraste 1,1 y color 0,4), capa que suma y rayas`, /brightness\(1\.1\)/.test(on1.filtro) && /saturate\(0\.4\)/.test(on1.filtro) && /rgb\(10, 0, 3\)|rgb\(10,0,3\)/.test(on1.suma || '') && on1.hud, on1);
  await ev(`gmbCerrar(); 1`); await cuadros(2); await p.screenshot({ path: D + 'mods_' + modo + '_vhs_on.png' });
  // 3. apagarlo desde la tarjeta (sin entrar)
  await ev(`(() => { gmbAbrir(); document.querySelector('#gmbPanel .gbMod[data-gb="ver:local:vhs"] [data-gb^="tog:"]').click(); return 1; })()`);
  const enGrilla = await ev(`({ sel: GMB.sel, off: document.querySelector('#gmbPanel .gbMod[data-gb="ver:local:vhs"]').classList.contains('off') })`);
  await cuadros(2); const off1 = await ef();
  await ev(`gmbCerrar(); 1`); await cuadros(2); await p.screenshot({ path: D + 'mods_' + modo + '_vhs_off.png' });
  ok(`${modo}: 3. el interruptor de la tarjeta lo apaga sin entrar: en 2 cuadros no queda nada del efecto y queda guardado`, enGrilla.sel === null && enGrilla.off && off1.filtro === '' && !off1.suma && !off1.resta && !off1.hud && /local:vhs/.test(off1.guardado || ''), { enGrilla, off1 });
  // 4. la página del efecto: el interruptor y los ajustes arriba; un ajuste cambia el efecto; ‹ Mods vuelve
  const pg = await ev(`(() => { gmbAbrir(); document.querySelector('#gmbPanel .gbMod[data-gb="ver:local:vhs"]').click(); const P = document.getElementById('gmbPanel'), secs = [...P.querySelectorAll('.gbCuerpo > .gbSec')];
    return { sel: GMB.sel, atras: !!P.querySelector('[data-gb="atras"]'), tit: P.querySelector('.gbCabT b').textContent, primero: secs[0] && secs[0].classList.contains('gbEfecto') && !!secs[0].querySelector('[data-gb="tog:local:vhs"]'), segundo: secs[1] ? [...secs[1].querySelectorAll('[data-cv]')].map((x) => x.dataset.cv) : [] }; })()`);
  await ev(`(() => { document.querySelector('#gmbPanel [data-gb="tog:local:vhs"]').click(); const i = document.querySelector('#gmbPanel input[type=range][data-cv="vhs_color"]'); i.value = '0.9'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await cuadros(2); const on2 = await ef();
  await p.screenshot({ path: D + 'mods_' + modo + '_vhs_pagina.png' });
  const pr = await ev(`(() => { const P = document.getElementById('gmbPanel'), r = P.getBoundingClientRect(); return { w: P.offsetWidth, h: P.offsetHeight, l: P.offsetLeft, t: P.offsetTop, W: VW(), H: VH() }; })()`);
  await ev(`document.querySelector('#gmbPanel [data-gb="atras"]').click(); 1`);
  const vuelta = await ev(`({ sel: GMB.sel, tarjetas: document.querySelectorAll('#gmbPanel .gbMod').length })`);
  const gr = await ev(`(() => { const P = document.getElementById('gmbPanel'); return { w: P.offsetWidth, h: P.offsetHeight, l: P.offsetLeft, t: P.offsetTop, W: VW(), H: VH() }; })()`);
  ok(`${modo}: 4. la página del efecto: «‹ Mods», el interruptor y sus ajustes primero; el ajuste cambia el efecto al momento; «‹ Mods» vuelve`, pg.sel === 'local:vhs' && pg.atras && pg.primero && pg.segundo.includes('vhs_color') && /saturate\(0\.9\)/.test(on2.filtro) && !on2.apagados.length && vuelta.sel === null && vuelta.tarjetas === 3, { pg, on2: on2.filtro, vuelta });
  const entra = (x) => x.l >= 0 && x.t >= 0 && x.l + x.w <= x.W + 1 && x.t + x.h <= x.H + 1;
  ok(`${modo}: 5. la cuadrícula y la página entran en la pantalla`, entra(pr) && entra(gr), { pr, gr });
  // la página de un mod de armas: ‹ Mods y sus armas; tocar un arma la da
  const ar = await ev(`(async () => { document.querySelector('#gmbPanel .gbMod[data-gb="ver:128089118"]').click(); const n = document.querySelectorAll('#gmbPanel [data-gb^="it:gmswep:"]').length; await new Promise((r) => setTimeout(r, 200)); return { n, atras: !!document.querySelector('#gmbPanel [data-gb="atras"]') }; })()`);
  await p.screenshot({ path: D + 'mods_' + modo + '_m9k.png' });
  ok(`${modo}: la página de un mod de armas trae sus armas`, ar.n >= 10 && ar.atras, ar);
  await ev(`gmbCerrar(); 1`);
  const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|GPU stall|swiftshader|Failed to load/i.test(x));
  ok(`${modo}: 6. sin errores de JS`, !e2.length, e2.slice(0, 5));
  await b.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(0);
