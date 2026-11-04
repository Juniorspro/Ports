// entrar a un mapa del Workshop como lo hace el jugador (menú → Empezar, con la pantalla de carga de verdad, sin ?test):
// cada 200 ms se mira qué se ve. Falla si en algún momento no hay ni pantalla de carga, ni menú, ni partida (la pantalla
// crema del fondo del menú) o si el mapa no arranca.
// uso: node mapa_entrar.mjs URL_HTML URL_CARPETA_GMA ID [celu]
import { abrir } from './base.mjs';
const [, , HTML, CARP, ID, CELU] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, !!CELU);
await p.waitForFunction(() => window.__ev('JUEGO.estado === "principal" && !!RB.el'), null, { timeout: 60000 });
await ev(`PREFS.bienvenida = true; 1`);
const ins = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${ID}.gma')).arrayBuffer()); const A = await gmInstalar('${ID}', { nombre: '${ID}', sinDeps: true }, b);
  return [...GBSP.mapas].filter(([k, x]) => x.id === '${ID}').map(([k]) => k); })()`);
const m = ins[0]; ok('el mapa del addon está en la lista', !!m, ins);
// (FALLA=1: el .bsp no se puede leer; tiene que avisar y entrar a Pasto plano, sin pantalla crema)
if (process.env.FALLA) await ev(`gbspAbrir = () => { throw new Error('bsp roto (prueba)'); }; 1`);
await ev(`(() => { const o = gbspPreparar; gbspPreparar = async (...a) => { const t = performance.now(); try { return await o(...a); } finally { window.__tb = +((performance.now() - t) / 1000).toFixed(2); } }; return 1; })()`);
await ev(`RB.mapa = ${JSON.stringify(m)}; RB.mapaCom = null; inicioAccion('empezar'); 1`);
const t0 = Date.now(), vistas = []; let crema = 0, maxCrema = 0, racha = 0, fin = null, tAnt = Date.now(), segCrema = 0, nadaAnt = false;
while (Date.now() - t0 < 240000) {
  const s = await ev(`(() => { const c = document.getElementById('carga'), carga = !!c && !c.classList.contains('oc') && !c.classList.contains('salir');
    const menu = !!RB.el && !RB.el.classList.contains('oc'); return { e: JUEGO.estado, carga, menu, m: MUNDO.nombre, p: +(window.__carga.p || 0).toFixed(2), paso: window.__carga.paso }; })()`);
  const nada = !s.carga && !s.menu && s.e !== 'juego', tAhora = Date.now(); if (nada && nadaAnt) segCrema += (tAhora - tAnt) / 1000; nadaAnt = nada; tAnt = tAhora;
  if (nada) { crema++; racha++; maxCrema = Math.max(maxCrema, racha); } else racha = 0;
  vistas.push((s.e === 'juego' ? 'J' : s.carga ? 'C' : s.menu ? 'M' : '_'));
  if (s.e === 'juego' && !globalThis.tJuego) globalThis.tJuego = (Date.now() - t0) / 1000;
  if (s.e === 'juego' && s.m === (process.env.FALLA ? 'FlatGrass' : m) && !s.carga) { fin = s; break; }
  await p.waitForTimeout(200);
}
const seg = (Date.now() - t0) / 1000;
console.log('linea de tiempo (C carga, M menú, _ crema, J juego):', vistas.join(''));
const intro = await ev(`!!(window.__intro && !window.__intro.fin)`), tb = await ev(`window.__tb || 0`); console.log('armado del mapa', tb, 's');
ok(`entra al mapa (${seg.toFixed(1)} s; la partida arrancó a los ${(globalThis.tJuego || 0).toFixed(1)} s)`, !!fin, { ...fin, introAun: intro });
ok('nunca queda la pantalla crema (sin carga, sin menú y sin partida)', crema === 0, { muestras: crema, seg: +segCrema.toFixed(1) });
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x) && !(process.env.FALLA && /bsp roto/.test(x)));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
