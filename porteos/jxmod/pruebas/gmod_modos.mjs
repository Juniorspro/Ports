// modos de juego (gamemodes) de GMod: instalar el addon, que su modo aparezca para elegir, arrancarlo (en su mapa si lo
// trae, si no en Pasto plano) y jugar: el modo queda puesto (con su cadena de bases), sin errores de Lua al cargar ni en
// 8 s de juego; si es por equipos, se abre la pantalla de equipos, se elige uno y se termina vivo en ese equipo (si hace
// falta, disparando para reaparecer, como en GMod); la barrita de arriba muestra el modo. Al final, volver a Sandbox
// deja el juego como siempre (sin modo, con la Physics Gun).
// uso: node gmod_modos.mjs URL_HTML URL_CARPETA_GMA IDS(coma) [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, IDS, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
const esperar = (cond, ms) => p.waitForFunction((c) => window.__ev(c), cond, { timeout: ms }).then(() => true).catch(() => false);
for (const id of IDS.split(',')) {
  const ins = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b); await A.listo;
    return { n: A.nombre, modos: [...GMM.lista.values()].filter((M) => M.id === '${id}').map((M) => ({ n: M.n, t: M.titulo, base: M.base, menu: M.menu, mapas: M.mapas ? String(M.mapas) : null })), mapas: [...GBSP.mapas].filter(([k, x]) => x.id === '${id}').map(([k]) => k) }; })()`);
  const elegibles = ins.modos.filter((M) => M.menu);
  ok(`${id} (${ins.n}): su modo aparece para elegir`, elegibles.length > 0, ins);
  for (const M of elegibles) {
    // (su mapa si trae uno que le corresponde; si no, Pasto plano)
    const mapa = (await ev(`(() => { const L = ${JSON.stringify(ins.mapas)}; return L.find((k) => gmmDeMapa(k) === ${JSON.stringify(M.n)}) || L[0] || 'FlatGrass'; })()`));
    const e0 = await ev(`(GMA.errores || []).length`), f0 = await ev(`JSON.stringify([...(GMA.faltan || new Map()).keys()])`);
    await ev(`GMM.elegido = ${JSON.stringify(M.n)}; empezarPartida(${JSON.stringify(mapa)}); 1`);
    await esperar(`MUNDO.nombre === ${JSON.stringify(mapa)} && JUEGO.estado === 'juego'`, 240000);
    await p.waitForTimeout(1500);
    const act = await ev(`(() => { const m = GMA.modo; return m ? { n: m.n, cadena: [...m.t.keys()].filter((k) => k.endsWith(':S')).map((k) => k.slice(0, -2)), equipos: [...GMA.equipos].filter(([i]) => i > 0 && i < 1000).map(([i, e]) => [i, e.n, e.j]), porEquipos: R_T(m.S.get('TeamBased')), eq: GMA.equipo ?? 1001, vivo: !!JUG.vivo, barra: (document.getElementById('gmmBarra') || {}).textContent || '', elegir: !!(document.getElementById('gmmEq') && !document.getElementById('gmmEq').classList.contains('oc')) } : null; })()`);
    await p.screenshot({ path: D + 'modo_' + M.n + '_inicio.png' });
    ok(`${M.n}: arranca en ${mapa} con su cadena de bases y la barrita arriba`, !!act && act.n === M.n && act.barra.includes(M.t), act);
    let fin = null;
    if (act && act.porEquipos && act.equipos.some((x) => x[2])) {
      ok(`${M.n}: se abre la pantalla para elegir equipo`, act.elegir, { equipos: act.equipos });
      const eq = act.equipos.find((x) => x[2])[0];
      await ev(`(() => { const bt = document.querySelector('#gmmEq [data-eq="${eq}"]'); if (bt) bt.click(); else gmmPedirEquipo(${eq}); return 1; })()`);
      // (si quedó muerto, disparar para reaparecer como en GMod)
      for (let i = 0; i < 16; i++) { await p.waitForTimeout(500); const v = await ev(`JUG.vivo`); if (v && i > 3) break; if (!v) { await ev(`ENT.disparo = true; 1`); await p.waitForTimeout(150); await ev(`ENT.disparo = false; 1`); } }
      fin = await ev(`({ eq: GMA.equipo, vivo: !!JUG.vivo, armas: ARM.lista.slice(), barra: document.getElementById('gmmBarra').textContent })`);
      ok(`${M.n}: elegido el equipo ${eq}, termina vivo en ese equipo`, fin.eq === eq && fin.vivo, fin);
    }
    await p.waitForTimeout(6000);
    const desp = await ev(`(() => { const e = (GMA.errores || []).slice(${e0}); const f0 = new Set(${f0}); return { errores: e.slice(0, 8), nErr: e.length, faltan: [...(GMA.faltan || new Map()).keys()].filter((k) => !f0.has(k)).slice(0, 25), modo: GMA.modo && GMA.modo.n, vivo: !!JUG.vivo, armas: ARM.lista.slice(), barra: (document.getElementById('gmmBarra') || {}).textContent || '', glob: [...(GMA.glob || new Map())].filter(([k, v]) => typeof v !== 'object').slice(0, 12) }; })()`);
    await p.screenshot({ path: D + 'modo_' + M.n + '_juego.png' });
    ok(`${M.n}: sin errores de Lua al cargarlo ni en 8 s de juego`, desp.nErr === 0 && desp.modo === M.n, desp);
  }
}
// volver a Sandbox: sin modo, con las armas de siempre
await ev(`GMM.elegido = 'sandbox'; empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(2500);
const sb = await ev(`({ modo: GMA.modo ? GMA.modo.n : null, phys: ARM.lista.includes('PhysicsGun'), barra: !!(document.getElementById('gmmBarra') && !document.getElementById('gmmBarra').classList.contains('oc')), gm: GMA.R ? GMA.R.G.get('GAMEMODE') === GMA.R.G.get('GM') : true })`);
ok('volver a Sandbox: sin modo, con la Physics Gun y sin la barrita', sb.modo === null && sb.phys && !sb.barra, sb);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
