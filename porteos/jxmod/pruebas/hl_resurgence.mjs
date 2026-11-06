// Half-Life Resurgence y Crack-Life Resurgence (Discord: «compatibilidad con Crack-Life y Half-Life Resurgence»). Son
// packs de NPCs hechos con VJ Base: HL Resurgence (2548809283, 705 MB: los NPCs de Half-Life 1, 2 y sus expansiones) y
// Crack-Life Resurgence (2691157473, 93 MB). Con VJ Base (131759821) y los dos packs de la carpeta:
//  1. los tres cargan su Lua sin errores;
//  2. sus NPCs están en el menú de NPCs (HL Resurgence ≥ 100, Crack-Life Resurgence ≥ 15);
//  3. una muestra pareja de cada pack (24 de HL Resurgence y 12 de Crack-Life Resurgence) aparece como NPC del juego, con lo
//     que dice su Lua y con su modelo, o como entidad del pack con su modelo (≥ 90 %; los que usan un modelo de HL2 que no
//     trae el pack —ciudadanos, rebeldes— salen en el juego del contenido de GMod en Steam: acá no hay, se anotan aparte);
//  4. de los enemigos de la muestra, ≥ 75 % persiguen y pegan en 5 s (algunos son torretas o bichos quietos: se anotan);
//  5. sin errores de JS.
// (sin guardar los packs en la caché del navegador: en esta máquina no hay disco para 900 MB más)
// uso: node hl_resurgence.mjs URL_HTML (con gma/131759821.gma, gma/2548809283.gma y gma/2691157473.gma al lado)
import { abrir } from './base.mjs';
const [, , HTML, NHL = '24', NCL = '12'] = process.argv, BASE = HTML.replace(/[^/]*$/, '');
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(3000);
const PACKS = { '131759821': 'VJ Base', '2548809283': 'Half-Life Resurgence', '2691157473': 'Crack-Life Resurgence' };
// (se instalan en el orden en que los instalaría alguien: primero la base y después los packs, que VJ Base encuentra
// como plugins; al terminar, el Lua se vuelve a cargar una vez)
const inst = await ev(`(async () => { const o = {}; gmCacheGuardarGMA = async () => null; const e0 = GMA.errores.length, t00 = performance.now();
  for (const id of ${JSON.stringify(Object.keys(PACKS))}) { const t0 = performance.now();
    const A = await gmInstalar(id, { nombre: id, sinDeps: true }, new Uint8Array(await (await fetch('${BASE}gma/' + id + '.gma')).arrayBuffer())); await A.listo;
    o[id] = { s: +((performance.now() - t0) / 1000).toFixed(1) }; }
  const recargo = !!GMOD.recargaT; while (GMOD.recargaT) await GMOD.recarga;
  for (const id of Object.keys(o)) { const A = GMOD.addons.get(id); Object.assign(o[id], { lua: (A.lua || []).length, err: (A.err || []).length, luaErr: (A.luaErr || []).filter((x) => !/BuildConVarList/.test(x)).slice(0, 3), npcs: A.listas && A.listas.NPC ? A.listas.NPC.size : 0 }); }
  o.recargo = recargo; o.total_s = +((performance.now() - t00) / 1000).toFixed(1); o.errores = GMA.errores.slice(e0).filter((x) => !/BuildConVarList|vj_tool_/.test(x)).slice(0, 5);
  return o; })()`);
ok('1. VJ Base, HL Resurgence y Crack-Life Resurgence cargan su Lua sin errores', Object.keys(PACKS).every((id) => inst[id].lua > 0 && !inst[id].err && !inst[id].luaErr.length) && !inst.errores.length, inst);
const listas = await ev(`(() => { const o = {}; for (const id of ['2548809283', '2691157473']) { const A = GMOD.addons.get(id); o[id] = A && A.listas && A.listas.NPC ? [...A.listas.NPC.keys()] : []; } return o; })()`);
const nHL = listas['2548809283'].length, nCL = listas['2691157473'].length;
ok('2. sus NPCs están en el menú (HL Resurgence ≥ 100, Crack-Life Resurgence ≥ 15)', nHL >= 100 && nCL >= 15, { hl: nHL, cl: nCL, ejHL: listas['2548809283'].slice(0, 6), ejCL: listas['2691157473'].slice(0, 6) });
// (una muestra pareja: uno cada tanto de la lista)
const muestra = (L, n) => { const k = Math.max(1, L.length / n), o = []; for (let i = 0; i < n && Math.floor(i * k) < L.length; i++) o.push(L[Math.floor(i * k)]); return o; };
// (LISTA=clase,clase… para probar sólo esas)
const M = process.env.LISTA ? process.env.LISTA.split(',').map((k) => ['?', k]) : [...muestra(listas['2548809283'], +NHL).map((k) => ['hl', k]), ...muestra(listas['2691157473'], +NCL).map((k) => ['cl', k])];
const r = [];
for (const [pack, k] of M) {
  const x = await ev(`(async () => {
    JUG.vida = 100000; JUG.noclip = false; const P0 = JUG.pos.clone(); const e0 = GMA.errores.length; let P = null;
    try { P = gmnpcCrear(${JSON.stringify(k)}); } catch (e) { return { k: ${JSON.stringify(k)}, error: String(e).slice(0, 120) }; }
    if (!P) return { k: ${JSON.stringify(k)}, nada: true };
    for (let i = 0; i < 50 && P.gmp === undefined; i++) await new Promise((r) => setTimeout(r, 100));
    const d0 = P.pos ? P.pos.distTo(JUG.pos) : null, v0 = JUG.vida;
    await new Promise((r) => setTimeout(r, 5000));
    // (una entidad del pack —la espora de Xen— queda como entidad con su Lua y su modelo; un NPC de VJ, como NPC del juego.
    // El modelo que no trae el pack —los ciudadanos de HL2— sale del contenido base de GMod en Steam, por la tienda)
    const ent = P instanceof LEnt, sn = !ent && gmnpcSNPC(${JSON.stringify(k)}), mb = sn && sn.mod;
    const base = !!(mb && !gmArchivo(mb) && !(GML.idx && GML.idx.f[mb]));
    const o = { k: ${JSON.stringify(k)}, ent, snpc: ent || !!(P.gmNpc && P.gmNpc.snpc), modelo: ent ? !!(P.modelo && gmArchivo(P.modelo)) : !!(P.gmpRuta && P.gmp && P.gmp.def), ruta: ent ? P.modelo : P.gmpRuta || null, base: base ? mb : null, hostil: !!(P.act && P.act.hostil), vivo: !P.muerto,
      acerca: d0 !== null && P.pos ? +(d0 - P.pos.distTo(JUG.pos)).toFixed(2) : null, dano: +(v0 - JUG.vida).toFixed(0), errores: GMA.errores.slice(e0).filter((x) => !/BuildConVarList|vj_tool_/.test(x)).slice(0, 2) };
    try { if (ent) gmaQuitar(P); else npcQuitar(P); } catch (e) {} JUG.pos.copy(P0); JUG.vel.set(0, 0, 0); JUG.vida = 100; return o; })()`);
  x.pack = pack; r.push(x);
}
if (process.env.LISTA) console.log(JSON.stringify(r));
// (los que piden un modelo de HL2 que no está en la carpeta de prueba no cuentan: en el juego salen de Steam; se anotan)
const deBase = r.filter((x) => x.base && !x.modelo), cuentan = r.filter((x) => !deBase.includes(x));
const conModelo = cuentan.filter((x) => x.snpc && x.modelo), malos = cuentan.filter((x) => !(x.snpc && x.modelo));
ok(`3. la muestra aparece con su modelo, como NPC o como entidad del pack (≥ 90 % de ${cuentan.length})`, conModelo.length >= 0.9 * cuentan.length, { bien: conModelo.length, de: cuentan.length, entidades: r.filter((x) => x.ent).map((x) => x.k), malos: malos.map((x) => [x.k, x.nada ? 'nada' : x.error || (!x.snpc ? 'sin VJ' : 'sin modelo')]), modeloDeHL2: deBase.map((x) => [x.k, x.base]) });
const hostiles = r.filter((x) => x.hostil), pegan = hostiles.filter((x) => x.dano > 0);
ok('4. de los enemigos, ≥ 75 % persiguen y pegan en 5 s', hostiles.length > 0 && pegan.length >= 0.75 * hostiles.length, { hostiles: hostiles.length, pegan: pegan.length, noPegan: hostiles.filter((x) => !(x.dano > 0)).map((x) => [x.k, x.acerca]), amigos: r.filter((x) => !x.hostil).map((x) => x.k) });
const errLua = r.filter((x) => x.errores && x.errores.length).map((x) => [x.k, x.errores]);
if (errLua.length) console.log('errores de Lua al aparecer:', JSON.stringify(errLua).slice(0, 1200));
const mem = await ev(`performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null`);
console.log('memoria JS (MB):', mem);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently|BuildConVarList|vj_tool_|\[GMod\]/i.test(x));
ok('5. sin errores de JS', !e.length, e.slice(0, 4));
await b.close();
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
