// descargas en segundo plano: con una partida andando se ponen varios addons en la cola (un pack de armas, un mapa y un
// personaje); siguen bajando mientras se juega, cada uno se activa al terminar (armas en el menú Q y se pueden usar, el
// mapa en la lista, el personaje elegible), aparece la pastilla con el avance, se puede cancelar uno, y lo que quedó a
// medio bajar sigue solo al volver a abrir el juego. Se mide el ritmo de cuadros mientras baja.
// (la bajada se simula desde la carpeta local, en pedazos y a ~3 MB/s, como por internet)
// uso: node gmod_cola.mjs URL_HTML URL_CARPETA_GMA
import { abrir } from './base.mjs';
const [, , HTML, CARP] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
const STUB = `gmBajar = async (wid, prog) => { const r = await fetch(${JSON.stringify(CARP)} + '/' + wid + '.gma'); const tot = +r.headers.get('content-length') || 1, rd = r.body.getReader(), ps = []; let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; ps.push(value); n += value.length; if (prog) prog(0.7 * n / tot, 'bajando'); await new Promise((ok) => setTimeout(ok, value.length / 3e3)); }
  const u = new Uint8Array(n); let o = 0; for (const x of ps) { u.set(x, o); o += x.length; } return (await gmCacheGuardarGMA(String(wid), u)) || u; }; 1`;
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(3000); await ev(STUB);
const ARMAS = '106565409', MAPA = '1751661372', PJ = '158326196', CANC = '104482086';
const fps0 = await ev(`(async () => { const L = []; for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 500)); L.push(TIEMPO.fps); } return Math.round(L.reduce((a, b) => a + b) / L.length); })()`);
// (los cuatro a la cola, jugando)
await ev(`gmcPoner('${ARMAS}', { nombre: 'Nuke pack' }); gmcPoner('${MAPA}', { nombre: 'Backrooms 3' }); gmcPoner('${PJ}', { nombre: 'Personaje' }); gmcPoner('${CANC}', { nombre: 'Para cancelar' }); 1`);
await p.waitForTimeout(600);
const pild = await ev(`(() => { const e = document.getElementById('gmCola'); const r = e && e.getBoundingClientRect(); return { ve: !!e && !e.classList.contains('oc') && r.width > 100, txt: e ? e.textContent.slice(0, 80) : '', estado: JUEGO.estado, cola: GMC.l.map((x) => x.estado) }; })()`);
ok('jugando, la pastilla de descargas se ve con lo que baja', pild.ve && pild.estado === 'juego' && pild.cola.length === 4, pild);
await p.screenshot({ path: 'cola_pastilla.png' });
await ev(`GMC.abierta = true; gmcDibujar(true); 1`); await p.waitForTimeout(300); await p.screenshot({ path: 'cola_lista.png' });
// (se cancela el último mientras espera o baja)
await ev(`gmcCancelar('${CANC}'); 1`);
// (mientras baja: cuadros por segundo y que el juego siga, caminando)
const dur = await ev(`(async () => { const L = []; ENT.teclas.add('KeyW'); const p0 = JUG.pos.clone(); for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 500)); L.push(TIEMPO.fps); } ENT.teclas.delete('KeyW'); return { fps: Math.round(L.reduce((a, b) => a + b) / L.length), min: Math.round(Math.min(...L)), anduvo: +Math.hypot(JUG.pos.x - p0.x, JUG.pos.z - p0.z).toFixed(1), bajando: GMC.l.filter((x) => x.estado === 'bajando').length }; })()`);
ok('mientras baja se sigue jugando (camina y los cuadros no se caen a menos de la mitad)', dur.anduvo > 3 && dur.fps >= fps0 * 0.5, { antes: fps0, durante: dur });
await p.waitForFunction(() => window.__ev(`GMC.l.every((x) => x.estado !== 'espera' && x.estado !== 'bajando')`), null, { timeout: 240000 }).catch(() => {});
const fin = await ev(`(async () => { for (const id of ['${ARMAS}', '${MAPA}', '${PJ}']) { const A = GMOD.addons.get(id); if (A && A.listo) await A.listo; }
  const A = GMOD.addons.get('${ARMAS}'), C = DATA.menu.find((c) => c.n === 'GMod');
  return { estado: JUEGO.estado, armas: !!A, sweps: A ? (A.sweps || []).length : 0, sents: A ? (A.sents || []).length : 0, enQ: !!(C && C.sub.some((s) => s.gm === '${ARMAS}')), mapa: MAPAS_RB.filter((m) => /backrooms3/i.test(m)), pj: typeof gmpLista === 'function' ? gmpLista().filter((r) => GMOD.addons.get('${PJ}') && GMOD.addons.get('${PJ}').G.archivos.has(r)).length : 0, cancelado: GMOD.addons.has('${CANC}'), aviso: document.getElementById('aviso').textContent, cola: GMC.l.map((x) => x.id + ':' + x.estado) }; })()`);
ok('cada uno se activó jugando: armas en el menú Q, mapa en la lista, personaje elegible', fin.estado === 'juego' && fin.armas && fin.sweps + fin.sents > 0 && fin.enQ && fin.mapa.length === 1 && fin.pj > 0, fin);
ok('el cancelado no quedó instalado', !fin.cancelado, fin.cola);
ok('avisa qué trajo y dónde está', /Instalado y activo|Installed and active/.test(fin.aviso), fin.aviso);
// (un arma del pack recién bajado, en la mano y disparando, sin salir de la partida)
const usa = await ev(`(async () => { const A = GMOD.addons.get('${ARMAS}'); const c = (A.sweps || [])[0]; if (!c) return { sin: true }; gmaSpawnMenu('gmswep:' + c); await new Promise((r) => setTimeout(r, 1500)); const a = ARM.lista[ARM.i]; return { clase: c, enMano: String(a || ''), lista: ARM.lista.map(String).slice(-4), tiene: ARM.lista.some((x) => String(x).includes(c)) || String(a || '').includes(c) }; })()`);
ok('un arma recién bajada se agarra del menú Q sin salir de la partida', usa.tiene, usa);
// (se cierra el juego con uno a medio bajar: al abrirlo otra vez sigue solo)
await ev(`gmQuitar('${MAPA}'); gmcPoner('${MAPA}', { nombre: 'Backrooms 3' }); 1`);
await p.waitForFunction((id) => window.__ev(`(GMC.l.find((x) => x.id === '${id}') || {}).p > 0.1`), MAPA, { timeout: 30000 }).catch(() => {});
const guard = await ev(`localStorage.getItem('jx_cola')`);
await p.reload(); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await ev(STUB);
await p.waitForFunction((id) => window.__ev(`GMOD.addons.has('${id}')`), MAPA, { timeout: 60000 }).catch(() => {});
const re = await ev(`({ instalado: GMOD.addons.has('${MAPA}'), mapa: MAPAS_RB.filter((m) => /backrooms3/i.test(m)), cola: localStorage.getItem('jx_cola') })`);
ok('lo que quedó a medio bajar sigue solo al volver a abrir el juego', /1751661372/.test(guard || '') && re.instalado && re.mapa.length === 1, { guardado: guard, ...re });
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
