// VJ Base + Crack-Life (Discord: «compatibilidad con VJ Base, DrG Base, HL Resurgence y Crack-Life»). VJ Base es un
// marco de NPCs con IA propia que vive de la del motor de Source (horarios, tareas, caminos); Crack-Life son 19 NPCs
// hechos con VJ. Con los dos addons de la carpeta (VJ Base 131759821 de 78 MB y Crack-Life 878253040):
//  1. VJ Base carga su Lua sin errores (require de sus módulos, constantes de sonido de la IA);
//  2. los 19 NPCs de Crack-Life están en el menú de NPCs;
//  3. cada uno aparece (como NPC del juego, con lo que dice su Lua: modelo, vida, daño, amigo o enemigo) con su modelo;
//  4. los enemigos persiguen al jugador y le pegan en 4 s (la vida baja; el jugador no muere en la prueba);
//  5. DrG Base (1560118657) carga sin errores;
//  6. sin errores de JS.
// uso: node vj_crack.mjs URL_HTML (con gma/131759821.gma, gma/878253040.gma y gma/1560118657.gma al lado)
import { abrir } from './base.mjs';
const [, , HTML] = process.argv, BASE = HTML.replace(/[^/]*$/, '');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(3000);
const inst = await ev(`(async () => { const o = {};
  for (const id of ['131759821', '878253040', '1560118657']) { const A = await gmInstalar(id, { nombre: id }, new Uint8Array(await (await fetch('${BASE}gma/' + id + '.gma')).arrayBuffer())); await A.listo; o[id] = { lua: (A.lua || []).length, err: (A.err || []).length }; }
  return o; })()`);
const avisos = err.filter((x) => /\\[GMod\\]/.test(x) && !/BuildConVarList|vj_tool_/.test(x));
ok('1. VJ Base carga su Lua sin errores', inst['131759821'].lua > 50 && !inst['131759821'].err && !avisos.some((x) => /vj_base|npc_vj/.test(x)), { inst, avisos: avisos.slice(0, 4) });
const CL = ['npc_crack_skellington', 'npc_crack_gopnik', 'npc_crack_supergopnik', 'npc_crack_evilsci', 'npc_crack_zombozo', 'npc_crack_terror', 'npc_crack_skrillex', 'npc_crack_shrek', 'npc_crack_pinkpanther', 'npc_crack_megagopnik', 'npc_crack_mariozombie', 'npc_crack_blackscary', 'npc_crack_bigsmoke', 'npc_crack_spooky', 'npc_crack_bonewheel', 'npc_crack_tree', 'npc_crack_chav', 'npc_crack_camsci', 'npc_crack_gus'];
const menu = await ev(`${JSON.stringify(CL)}.filter((k) => !!gmLista('NPC', k)).length`);
ok('2. los 19 NPCs de Crack-Life están en el menú', menu === 19, { menu });
const r = await ev(`(async () => { const o = [];
  for (const k of ${JSON.stringify(CL)}) {
    JUG.vida = 100000; const P0 = JUG.pos.clone(); const P = gmnpcCrear(k); if (!P) { o.push({ k, nada: true }); continue; }
    for (let i = 0; i < 40 && P.gmp === undefined; i++) await new Promise((r) => setTimeout(r, 100));
    const d0 = P.pos ? P.pos.distTo(JUG.pos) : null, v0 = JUG.vida;
    await new Promise((r) => setTimeout(r, 4000));
    o.push({ k, snpc: !!(P.gmNpc && P.gmNpc.snpc), modelo: !!(P.gmpRuta && P.gmp && P.gmp.def), hostil: !!(P.act && P.act.hostil), acerca: d0 !== null ? +(d0 - P.pos.distTo(JUG.pos)).toFixed(2) : null, dano: +(v0 - JUG.vida).toFixed(0) });
    npcQuitar(P); JUG.pos.copy(P0); JUG.vel.set(0, 0, 0);
  }
  JUG.vida = 100; return o; })()`);
const malos = r.filter((x) => x.nada || !x.snpc || !x.modelo);
ok('3. los 19 aparecen como NPC con su modelo', !malos.length, { malos, total: r.length });
const hostiles = r.filter((x) => x.hostil);
ok('4. los enemigos persiguen (se acercan o ya llegaron) y pegan en 4 s', hostiles.length > 0 && hostiles.every((x) => x.dano > 0), { hostiles: hostiles.length, amigos: r.filter((x) => !x.hostil).map((x) => x.k), detalle: r.map((x) => [x.k.slice(10), x.hostil ? 'E' : 'A', x.acerca, x.dano]) });
ok('5. DrG Base carga sin errores', inst['1560118657'].lua > 0 && !inst['1560118657'].err && !avisos.some((x) => /drgbase/i.test(x)), inst['1560118657']);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently|BuildConVarList|vj_tool_/i.test(x));
ok('6. sin errores de JS', !e.length, e.slice(0, 5));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
