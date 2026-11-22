// Panel (cqik6q4u, vh29kvmq): «juego con nextbots o con el mod de Bonnie y no me siguen o atacan» (Obunga Nextbot,
// Withered Bonnie, Ultimate Nextbots Pack). Como un jugador en Pasto plano, quieto donde aparece:
//  1. Obunga Nextbot (2803406998, la base de Sanic): persigue y mata; reaparecés, lo ponés otra vez y vuelve a perseguir
//     y matar (antes, después de morir una vez la «protección de aparición» lo dejaba quieto para siempre), y lo mismo
//     a 12 m del punto de aparición;
//  2. Withered Bonnie (415860986) pide «FNAF 2 NPCs» (382393981, 250 MB), que no se baja solo por el peso: al ponerlo sale
//     un cartel con el peso y «Bajar» (y no se pone uno roto, sin su base); tocándolo se baja, el Lua se vuelve a montar y
//     Bonnie (la que corre) persigue y mata;
//  3. sin errores de Lua ni de JS.
// uso: node nextbots_panel.mjs ARCHIVO.html [CARPETA]   (baja del Workshop: ~260 MB)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/nextbots_panel'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500);
const instalar = (id) => ev(`(async () => { const A = await gmInstalar('${id}', { nombre: '${id}' }); await A.listo; await new Promise((r) => setTimeout(r, 800)); return { npcs: [...((A.listas && A.listas.NPC) || new Map()).keys()], grandes: (A.depsGrandes || []).map((x) => x.id), err: (A.luaErr || []).slice(0, 3) }; })()`);
const e0 = await ev(`GMA.errores.length`);
// pone el NPC desde el menú y mide 12 s: la menor distancia al jugador y si lo mata
const probar = async (cls, lejos, foto) => {
  await ev(`(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); jugadorAparecer(); ${lejos ? 'JUG.pos.x += 12;' : ''} JUG.vel.set(0, 0, 0); JUG.pitch = 0.25; return 1; })()`);
  await p.waitForTimeout(800);
  const puso = await ev(`(() => { const antes = new Set(GMA.ents.keys()); spawnElegir('GMod', 'gmnpc:${cls}'); const e = [...GMA.ents.values()].find((x) => !antes.has(x.id) && (x.nb || x.tipo === 'npc' || x.tipo === 'ent')); window.__e = e || null; return e ? e.clase : null; })()`);
  const M = [];
  for (let i = 0; i < 24; i++) { await p.waitForTimeout(500); M.push(await ev(`(() => { const e = window.__e; if (!e) return null; const q = gmaEntPos(e); return { d: +Math.hypot(q.x - JUG.pos.x, q.z - JUG.pos.z).toFixed(2), vida: JUG.vida, vivo: JUG.vivo }; })()`)); if (i === 5 && foto) await p.screenshot({ path: D + '/' + foto }); }
  const m = M.filter(Boolean); return { puso, d0: m.length ? m[0].d : null, dmin: m.length ? Math.min(...m.map((x) => x.d)) : null, murio: m.some((x) => !x.vivo || x.vida <= 0) };
};
// 1)
const o = await instalar('2803406998');
const o1 = await probar('npc_obunga', false, '1_obunga.png'), o2 = await probar('npc_obunga', false), o3 = await probar('npc_obunga', true);
ok('1. Obunga persigue y mata, también después de reaparecer y a 12 m del punto de aparición', o1.murio && o2.murio && o3.murio && o2.dmin < 1.5, { o, o1, o2, o3 });
// 2)
const bo = await instalar('415860986');
const cls = bo.npcs.find((x) => /run/.test(x)) || bo.npcs[0] || 'old_bonnie_run_2';
const roto = await ev(`(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); jugadorAparecer(); JUG.pitch = 0.25; const antes = new Set(GMA.ents.keys()); spawnElegir('GMod', 'gmnpc:${cls}'); return [...GMA.ents.values()].filter((x) => !antes.has(x.id) && x.clase === '${cls}').length; })()`);
let cartel = null; for (let i = 0; i < 30 && !cartel; i++) { await p.waitForTimeout(500); cartel = await ev(`(() => { const d = document.getElementById('cfDlg'); return d && d.className !== 'oc' ? d.textContent.slice(0, 260) : null; })()`); }
await p.screenshot({ path: D + '/2_cartel.png' });
await ev(`(() => { const d = document.getElementById('cfDlg'); const bt = d && d.querySelector('[data-cf=si]'); if (bt) bt.click(); return 1; })()`);
let listo = false; for (let i = 0; i < 160 && !listo; i++) { await p.waitForTimeout(3000); listo = await ev(`GMOD.addons.has('382393981') && !!GMA.clases.get('fnaf2_npc_base')`); }
await p.waitForTimeout(3000);
const bo2 = await ev(`(() => { const A = GMOD.addons.get('415860986'); return { npcs: [...((A.listas && A.listas.NPC) || new Map()).keys()].slice(0, 6), base: !!GMA.clases.get('fnaf2_npc_base'), orden: [...GMOD.addons.keys()] }; })()`);
const b1 = await probar(cls, false, '2_bonnie.png');
ok('2. Bonnie: sin su base no se pone (no queda uno roto) y sale el cartel con el peso y «Bajar»; se baja «FNAF 2 NPCs», el Lua se vuelve a montar y Bonnie persigue', bo.grandes.includes('382393981') && roto === 0 && !!cartel && /250/.test(cartel) && listo && bo2.base && b1.dmin !== null && b1.dmin < b1.d0 - 2, { bo, roto, cartel, listo, bo2, b1 });
// 3)
const lua = await ev(`GMA.errores.slice(${e0})`);
const js = err.filter((x) => !/favicon|ERR_|net::|404|409|WebSocket|mqtt|wss:|CORS|scheme 'file'|Cache/i.test(x));
ok('3. sin errores de Lua ni de JS', !lua.length && !js.length, { lua: lua.slice(0, 5), js: js.slice(0, 5) });
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(0);
