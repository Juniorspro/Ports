// cualquier modelo de personaje de un addon se puede poner como NPC: en el menú GMod hay una entrada "(NPC)" por cada
// modelo de jugador; tocarla pone un NPC con ese modelo adelante, parado en el piso, que se arma con el esqueleto de
// GMod y camina; sin errores.
// uso: node gmod_npc_modelos.mjs URL_HTML URL_CARPETA_GMA IDS(coma) [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, IDS, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
for (const id of IDS.split(',')) {
  const r = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b);
    gmMenu(); const C = DATA.menu.find((c) => c.n === 'GMod'), it = C ? C.sub.flatMap((s) => s.it) : [], L = it.filter((x) => /^gmnpcm:/.test(x)).filter((x) => A.G.archivos.has(x.slice(7)));
    const out = { n: A.nombre, entradas: L.length, npcs: [] };
    for (const x of L.slice(0, 3)) {
      JUG.yaw = 0; JUG.pitch = 0.1; const n0 = PERS.length; spawnElegir('GMod', x);
      // (aparece cuando llega su geometría —se lee del disco—: se espera a que esté y 2 s de juego para que se apoye)
      { const r0 = performance.now(); while (PERS.length <= n0 && performance.now() - r0 < 15000) await new Promise((r) => setTimeout(r, 50)); const t0 = TIEMPO.t, r1 = performance.now(); while (TIEMPO.t - t0 < 2 && performance.now() - r1 < 20000) await new Promise((r) => setTimeout(r, 50)); }
      const P = PERS.length > n0 ? PERS[PERS.length - 1] : null, h = P ? mundoRayo(v3(P.pos.x, P.pos.y + 2, P.pos.z), v3(0, -1, 0), 50) : null;
      out.npcs.push({ m: x.slice(7).split('/').pop(), puesto: !!P, gmp: !!(P && P.gmp), piso: P && h ? +(P.pos.y - (P.pos.y + 2 - h.t)).toFixed(2) : null, nom: propNom(x) });
    }
    return out; })()`);
  await p.screenshot({ path: D + 'npc_modelos_' + id + '.png' });
  const bien = r.npcs.filter((x) => x.puesto && x.gmp && x.piso !== null && x.piso > 0.6 && x.piso < 1.3);
  ok(`${id}: hay entradas (NPC) para sus modelos y se ponen como NPC con su modelo, parados en el piso (centro del cuerpo a 0,6-1,3 m; ${bien.length}/${r.npcs.length})`, r.entradas > 0 && bien.length === r.npcs.length, r);
}
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
