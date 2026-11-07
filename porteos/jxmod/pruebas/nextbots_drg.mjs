// Nextbots (pedido de Discord: «los de DrG Base, y también los normales porque no sale su sprite»). Con DrGBase del Workshop
// (1560118657) y seis nextbots clásicos de sprite (Walter, Doge, Obunga, Sanic.png, Smiley, Shaq):
//  1. DrGBase carga y sus 6 NPCs aparecen sin errores de Lua (antes: GetCreationID, yield cortado, OnGround, caminos…);
//  2. el nextbot 2D de DrGBase se dibuja con su sprite de verdad (la imagen .png del addon, no un reemplazo) y anima
//     (cambia de cuadro);
//  3. con el jugador a 14 m, el nextbot 2D camina hacia él (se acerca ≥ 6 m en 8 s);
//  4. el zombie 3D de DrGBase te ve, va hasta vos, usa sus animaciones de golpe y te saca vida (≥ 20 en 12 s);
//  5. los seis nextbots clásicos de sprite se dibujan con su textura real (ninguno con un brillo o un blanco de reemplazo);
//  6. sin errores de JS.
// uso: node nextbots_drg.mjs URL_HTML URL_CARPETA_GMA
import { abrir } from './base.mjs';
const [, , HTML, CARP] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const conTest = (u) => u + (u.includes('?') ? '&' : '?') + 'test';
const INSTALAR = (id) => `(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b); await A.listo; return JSON.stringify([...((A.listas && A.listas.NPC) || new Map()).keys()]); })()`;
// qué textura usa cada tramo dibujado por el Lua: la real o una de reemplazo (brillo, blanco, rayo, disco)
const TEXTURAS = `JSON.stringify(GR.L.mundo.filter((t) => t.n).map((t) => { const m = t.m; if (!m || m.nada) return 'nada'; let tx = null; try { tx = m.tex && m.tex(); } catch (e) { return 'err'; } if (!tx) return 'sin'; for (const k in GR.tex) if (GR.tex[k] === tx) return 'reemplazo:' + k; return 'real'; }))`;
async function partida() {
  const s = await abrir(conTest(HTML), true);
  await s.ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await s.p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await s.p.waitForTimeout(1500);
  s.lua = (src) => s.ev(`(() => { const R = GMA.R; try { const f = luaCompilar(${JSON.stringify(src)}, 'prueba.lua', R); return JSON.stringify(gmaEnLado('S', () => R.c(f, 'prueba'))[0]); } catch (x) { return JSON.stringify('ERR ' + x.message); } })()`).then((r) => JSON.parse(r));
  s.ent = (cls) => s.ev(`JSON.stringify((() => { const e = [...GMA.ents.values()].find((x) => x.clase === ${JSON.stringify(cls)} && x.vivo !== false), q = e && gmaEntPos(e), d = e && gmnbDef(e); return q ? { x: q.x, z: q.z, d: Math.hypot(q.x - JUG.pos.x, q.z - JUG.pos.z), sec: e.nbSec && d ? d.M.secuencias[e.nbSec.i].n : null } : null; })())`).then((r) => JSON.parse(r));
  return s;
}
const erroresJS = [];
// ---- DrGBase ----
{
  const s = await partida();
  const npcs = JSON.parse(await s.ev(INSTALAR('1560118657')));
  const lua0 = (await s.ev(`GMA.errores.length`)) | 0;
  // 1: los 6 a la vez, cada uno en su lugar
  await s.ev(`(() => { ${JSON.stringify(npcs)}.forEach((c, i) => { JUG.yaw = i * 1.05; gmnpcCrear(c); }); JUG.yaw = 0; return 1; })()`);
  await s.p.waitForTimeout(4000);
  const luaErr = (await s.ev(`GMA.errores.slice(${lua0})`)) || [];
  ok('1. DrGBase: sus 6 NPCs aparecen sin errores de Lua', npcs.length === 6 && !luaErr.length, { npcs, luaErr: luaErr.slice(0, 3) });
  await s.ev(`(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); return 1; })()`); await s.p.waitForTimeout(500);
  // 2 y 3: el 2D, con el jugador a 14 m
  await s.ev(`(() => { JUG.pos.set(0, JUG.pos.y, 0); JUG.yaw = 0; gmnpcCrear('npc_drg_testsprite'); return 1; })()`); await s.p.waitForTimeout(600);
  await s.ev(`(() => { JUG.pos.z -= 14; return 1; })()`);
  const e0 = await s.ent('npc_drg_testsprite'); const cuadros = new Set(); let tex = [];
  for (let k = 0; k < 16; k++) { await s.p.waitForTimeout(500); cuadros.add(await s.lua(`local e = ents.FindByClass('npc_drg_testsprite')[1]; return e:GetSpriteAnim() .. e:GetSpriteFrame()`)); if (k === 4) tex = JSON.parse(await s.ev(TEXTURAS)); }
  const e1 = await s.ent('npc_drg_testsprite');
  ok('2. el nextbot 2D de DrGBase se dibuja con su sprite real y anima', tex.includes('real') && !tex.some((t) => /reemplazo/.test(t)) && cuadros.size >= 2, { tex, cuadros: [...cuadros] });
  ok('3. con el jugador a 14 m, el 2D camina hacia él (se acerca ≥ 6 m en 8 s)', e0 && e1 && e0.d - e1.d >= 6, { desde: e0 && +e0.d.toFixed(1), hasta: e1 && +e1.d.toFixed(1) });
  await s.ev(`(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); JUG.pos.set(0, JUG.pos.y, 0); JUG.vida = 100; return 1; })()`); await s.p.waitForTimeout(500);
  // 4: el zombie
  await s.ev(`(() => { JUG.yaw = 0; gmnpcCrear('npc_drg_zombie'); return 1; })()`); await s.p.waitForTimeout(800);
  await s.lua(`local e = ents.FindByClass('npc_drg_zombie')[1]; e:SpotEntity(player.GetAll()[1]); return 1`);
  const golpes = new Set(); const v0 = await s.ev(`JUG.vida | 0`);
  for (let k = 0; k < 12; k++) { await s.p.waitForTimeout(1000); const z = await s.ent('npc_drg_zombie'); if (z && z.sec && /attack/i.test(z.sec)) golpes.add(z.sec); }
  const v1 = await s.ev(`JUG.vida | 0`);
  ok('4. el zombie de DrGBase te persigue, usa sus golpes y te saca vida (≥ 20 en 12 s)', v0 - v1 >= 20 && golpes.size >= 1, { vida: [v0, v1], golpes: [...golpes] });
  erroresJS.push(...s.err); await s.b.close();
}
// ---- 5: los nextbots clásicos de sprite ----
{
  const s = await partida();
  const res = [];
  for (const id of ['1635295969', '648137007', '1429991132', '758184158', '1639300664', '1261582571']) {
    const npcs = JSON.parse(await s.ev(INSTALAR(id)));
    // (el jugador a 12 m, mirándolo, y sin recibir daño: estos bots te alcanzan y te matan en un segundo)
    await s.ev(`(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); JUG.pos.set(0, JUG.pos.y, 0); JUG.vida = 100; JUG.vivo = true; JUG.yaw = 0; JUG.pitch = 0.05; gmnpcCrear(${JSON.stringify(npcs[0])}); JUG.pos.z -= 12; window.__dan0 = window.__dan0 || danarJugador; danarJugador = () => {}; return 1; })()`);
    // (cada 200 ms durante 2 s: estos bots corren rápido y enseguida te alcanzan —quedan fuera de la vista y no se dibujan—)
    const vistas = new Set(); for (let k = 0; k < 10; k++) { await s.p.waitForTimeout(200); for (const t of JSON.parse(await s.ev(TEXTURAS))) vistas.add(t); }
    res.push([npcs[0], [...vistas]]);
  }
  await s.ev(`(() => { if (window.__dan0) danarJugador = window.__dan0; return 1; })()`);
  ok('5. los seis nextbots clásicos de sprite se dibujan con su textura real', res.every(([, t]) => t.length && t.every((x) => x === 'real')), res);
  erroresJS.push(...s.err); await s.b.close();
}
const e = erroresJS.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('6. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
