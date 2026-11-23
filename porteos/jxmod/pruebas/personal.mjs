// La versión personal del dueño (armar.py con PERSONAL=1; la app com.jxmod.app.personal, que no se publica). Pedido: «elimina
// todos los mapas menos gm_construct y flatgrass… el menú de GMod sea uno renovado… meterle todos los datos de GMod real…
// borrarás los emotes y pondrás emotes de la workshop… y mods packs donde se detecten todos los mods necesarios»:
//  1. sólo gm_construct y gm_flatgrass (RB_Construct y RB_Flatgrass) y el estilo de GMod (body.jxp);
//  2. el menú Q como el de GMod: Spawnlists, Weapons, Entities, NPCs, Vehicles… y Addons; los 27 spawnlists de fábrica en su
//     árbol y los spawnicons de GMod (se ven);
//  3. las listas del Lua de GMod (base_npcs, base_vehicles, game_hl2): NPCs con su nombre en inglés, vehículos y armas por
//     categoría, sin frases sin traducir («#…»);
//  4. se ponen props de HL2 de los spawnlists (se bajan del contenido base y aparecen) y NPCs de GMod;
//  5. los emotes son los de GMod (las taunts de m_anm.mdl) y los del Workshop: «Dance» se arma con movimiento de verdad
//     (cadera y brazos) y el jugador la hace;
//  6. Addons: pegar el link de un addon arma su mod pack con lo que pide (TDMCars BMW → su Base Pack, que va primero);
//  7. sin errores de JS.
// uso: node personal.mjs URL_HTML_PERSONAL   (servido por http, con rb/jxp/ al lado: herramientas/gmod_personal.mjs)
import { abrir } from './base.mjs';
const [, , URL] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(URL, false, null, async (pg) => {
  // (la ruta de colecciones de la tienda, por si todavía no está desplegada: la misma respuesta con la API de Steam)
  await pg.route(/workers\.dev\/api\/gmod\/coleccion\/\d+/, async (rt) => {
    try { const id = /coleccion\/(\d+)/.exec(rt.request().url())[1], r = await fetch('https://api.steampowered.com/ISteamRemoteStorage/GetCollectionDetails/v1/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'collectioncount=1&publishedfileids[0]=' + id });
      const x = (await r.json()).response.collectiondetails[0], hijos = (x.children || []).map((h) => ({ id: String(h.publishedfileid), col: h.filetype === 2 }));
      rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ es: x.result === 1 && hijos.length > 0, hijos }) }); } catch (e) { rt.abort(); }
  });
});
const t1 = await ev(`({ jxp: JXP, body: document.body.classList.contains('jxp'), mapas: MAPAS.length, rb: MAPAS_RB.slice(), def: MAPA_DEF })`);
ok('1. sólo gm_construct y gm_flatgrass, con el estilo de GMod', t1.jxp && t1.body && t1.mapas === 0 && t1.rb.join() === 'RB_Construct,RB_Flatgrass' && t1.def === 'RB_Flatgrass', t1);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida(MAPA_DEF); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 120000 }).catch(() => {});
await p.waitForFunction(() => window.__ev(`!!(JXPM.menu && GMOD.addons.get('gmod') && GMOD.addons.get('gmod').listas && GMOD.addons.get('gmod').listas.Weapon)`), null, { timeout: 90000 }).catch(() => {});
await ev(`abrirSpawn(); UI.tab = 0; UI.sub = spawnSubs(DATA.menu[0]).findIndex((s) => s.n === 'Props' && s.nivel === 1); spawnDibujar(); 1`);
await p.waitForTimeout(4000);
const t2 = await ev(`(() => { const tabs = [...document.querySelectorAll('#tabs .tab')].filter((t) => t.style.display !== 'none').map((t) => t.textContent), subs = spawnSubs(DATA.menu[0]).filter((s) => s.jxp), L = [...document.querySelectorAll('#grilla .it img')];
  return { tabs, listas: subs.filter((s) => s.n !== 'Addons' && !s.it.some((x) => !/^gm:/.test(x))).length, hijas: subs.filter((s) => s.nivel > 0).length, icoCat: document.querySelectorAll('#cats .cat .catIco').length, items: L.length, vistos: L.filter((i) => i.complete && i.naturalWidth > 0 && /rb\\/jxp\\/iconos\\//.test(i.src)).length }; })()`);
ok('2. el menú Q como el de GMod: pestañas, los spawnlists de fábrica en su árbol y sus spawnicons', t2.tabs.slice(0, 5).join() === 'Spawnlists,Weapons,Entities,NPCs,Vehicles' && t2.tabs.includes('Addons') && t2.listas >= 27 && t2.hijas >= 20 && t2.icoCat >= 27 && t2.vistos >= 100, t2);
const t3 = await ev(`(() => { const A = GMOD.addons.get('gmod'), cats = (n) => (DATA.menu.find((c) => c.n === n) || { sub: [] }).sub.filter((s) => s.jxp).map((s) => s.n);
  const npcCats = spawnSubs(DATA.menu.find((c) => c.npcs)).map((s) => s.n);
  return { npc: A.listas.NPC.size, veh: A.listas.Vehicles.size, arm: A.listas.Weapon.size, alyx: gmListaNombre('NPC', 'npc_alyx'), jeep: gmListaNombre('Vehicles', 'Jeep'), npcCats, armas: cats('Weapons'), vehs: cats('Vehicles') }; })()`);
const sinFrase = (l) => l.every((x) => !/^#/.test(x));
ok('3. las listas del Lua de GMod: NPCs, vehículos y armas, con sus nombres', t3.npc >= 50 && t3.veh >= 10 && t3.arm >= 10 && t3.alyx === 'Alyx Vance' && t3.npcCats.includes('Combine') && t3.armas.includes('Half-Life 2') && sinFrase(t3.npcCats) && sinFrase(t3.armas) && sinFrase(t3.vehs), t3);
const t4 = await ev(`(async () => { cerrarPaneles(); const n0 = OBJS.length, k0 = NPC.lista.length, t0 = performance.now(), esp = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const m of ['models/props_c17/oildrum001.mdl', 'models/props_junk/wood_crate001a.mdl', 'models/props_borealis/bluebarrel001.mdl']) { spawnElegir('Props', 'gm:' + m); await esp(200); }
  for (let i = 0; i < 80 && OBJS.length - n0 < 3; i++) await esp(250);
  const props = OBJS.length - n0, ms = Math.round(performance.now() - t0);
  for (const k of ['npc_alyx', 'npc_zombie']) { spawnElegir('NPCs', 'gmnpc:' + k); await esp(1500); }
  return { props, ms, npcs: NPC.lista.length - k0 }; })()`);
ok('4. se ponen props de HL2 de los spawnlists y NPCs de GMod', t4.props === 3 && t4.npcs >= 2, t4);
await ev(`for (const P of [...NPC.lista]) if (typeof borrarNpc === 'function') borrarNpc(P); 1`).catch(() => {});
await ev(`abrirEmotes(); emoDibujar(); 1`);
await p.waitForFunction(() => window.__ev(`!!EMO.clips['w:models/m_anm.mdl#taunt_dance']`), null, { timeout: 90000 }).catch(() => {});
const t5 = await ev(`(() => { const id = 'w:models/m_anm.mdl#taunt_dance', C = EMO.clips[id]; const L = emoLista(); if (!C) return { lista: L.length };
  const nb = C.b.length, ang = (k) => { let mx = 0; const a = k * 4; for (let f = 1; f < C.nf; f++) { const o = (f * nb + k) * 4, d = Math.abs(C.r[a] * C.r[o] + C.r[a + 1] * C.r[o + 1] + C.r[a + 2] * C.r[o + 2] + C.r[a + 3] * C.r[o + 3]) / (32767 * 32767); mx = Math.max(mx, 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI); } return Math.round(mx); };
  cerrarPaneles(); emote(id);
  return { lista: L.length, cats: [...new Set(L.map((e) => e.cat))], propios: L.filter((e) => !e.id.startsWith('w:')).length, nf: C.nf, d: +C.d.toFixed(1), brazoDer: ang(C.b.indexOf('RightArm')), cadera: Math.max(...Array.from(C.h).map(Math.abs)), juega: JUG.cuerpo.emote === id }; })()`);
ok('5. emotes de GMod (taunts de m_anm.mdl) en vez de los propios; «Dance» con movimiento y el jugador la hace', t5.lista >= 16 && t5.propios === 0 && t5.brazoDer > 30 && t5.cadera > 50 && t5.juega, t5);
await ev(`JUG.cuerpo.emote = null; abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.n === 'Addons'); JXP_ADD.sel = 1; spawnDibujar(); 1`);
await p.fill('#jxpLink', 'https://steamcommunity.com/sharedfiles/filedetails/?id=113118541'); await p.click('#jxpBuscar');
await p.waitForFunction(() => window.__ev(`!JXP_ADD.busy && !!JXP_ADD.pack`), null, { timeout: 120000 }).catch(() => {});
const t6 = await ev(`JXP_ADD.pack ? JXP_ADD.pack.items.map((x) => ({ id: x.id, n: x.n, prof: x.prof, mb: x.mb })) : JXP_ADD.msg`);
ok('6. Addons: el link de un addon arma su mod pack con lo que pide (su base primero)', Array.isArray(t6) && t6.length >= 2 && t6[0].id === '112606459' && t6.some((x) => x.id === '113118541'), t6);
const e = err.filter((x) => !/mqtt|WebSocket|status of 409|status of 404/.test(x));
ok('7. sin errores de JS', !e.length, e.slice(0, 6));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(0);
