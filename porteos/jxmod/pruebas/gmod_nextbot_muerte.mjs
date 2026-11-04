// nextbots del Workshop después de matarte: te tienen que volver a perseguir (antes se quedaban quietos para siempre,
// persiguiendo a un «npc_citizen» fantasma que quedaba en el origen del mapa: tu cuerpo ya borrado). Como en GMod, no
// acampan donde reaparecés (protección de aparición: GAMEMODE.SpawnPoints / info_player_start) y te persiguen apenas
// te alejás. Dos veces seguidas, sin errores de Lua.
// uso: node gmod_nextbot_muerte.mjs URL_HTML URL_CARPETA_GMA [ID=1635295969 (Walter)] [CLASE=npc_walter]
import { abrir } from './base.mjs';
const [, , HTML, CARP, ID = '1635295969', CLS = 'npc_walter'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${ID}.gma')).arrayBuffer()); const A = await gmInstalar('${ID}', { nombre: '${ID}', sinDeps: true }, b); await A.listo; return 1; })()`);
await ev(`JUG.yaw = 0; JUG.pitch = 0; spawnElegir('GMod', 'gmnpc:${CLS}'); 1`); await p.waitForTimeout(1000);
const est = () => ev(`(() => { const e = [...GMA.ents.values()].find((x) => x.clase === '${CLS}'), q = e && gmaEntPos(e); return { vivo: JUG.vivo, j: [+JUG.pos.x.toFixed(1), +JUG.pos.z.toFixed(1)], bot: q ? [+q.x.toFixed(1), +q.z.toFixed(1)] : null }; })()`);
const dist = (e) => (e.bot ? Math.hypot(e.bot[0] - e.j[0], e.bot[1] - e.j[1]) : 1e9);
const esperarMuerte = async (s) => { for (let i = 0; i < s * 2; i++) { if (!(await est()).vivo) return true; await p.waitForTimeout(500); } return false; };
const esperarVivo = () => p.waitForFunction(() => window.__ev('JUG.vivo'), null, { timeout: 20000 }).then(() => true, () => false);
ok(`${CLS} te persigue y te mata`, await esperarMuerte(20));
for (let vuelta = 1; vuelta <= 2; vuelta++) {
  await esperarVivo();
  let muertes = 0; for (let i = 0; i < 10; i++) { if (!(await est()).vivo) { muertes++; await esperarVivo(); } await p.waitForTimeout(500); }
  ok(`vuelta ${vuelta}: reaparecido, no te mata en la aparición (5 s, como la protección de GMod)`, muertes === 0, muertes);
  await ev(`JUG.pos.x += ${vuelta === 1 ? 25 : -12}; 1`);
  const d0 = dist(await est()); let dmin = d0, murio = false;
  for (let i = 0; i < 24 && !murio; i++) { await p.waitForTimeout(500); const e = await est(); if (!e.vivo) murio = true; else dmin = Math.min(dmin, dist(e)); }
  ok(`vuelta ${vuelta}: te alejás ${vuelta === 1 ? 25 : 12} m y te vuelve a perseguir (de ${d0.toFixed(1)} m hasta alcanzarte)`, murio || dmin < 3, { desde: +d0.toFixed(1), min: +dmin.toFixed(1), murio });
}
const fant = await ev(`[...GMA.ents.values()].filter((e) => e.vivo && e.clase === 'npc_citizen' && e.P && e.P.borrado).length`);
ok('sin «NPC fantasma» de cuerpos ya borrados', fant === 0, fant);
const lua = await ev(`GMA.errores.slice(-5)`);
ok('sin errores de Lua', !lua.length, lua);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
