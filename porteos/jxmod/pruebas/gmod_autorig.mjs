// personajes que vienen como prop: un prop quieto con forma de persona (Patrick de peluche, 1 hueso) se puede poner de
// personaje con el esqueleto de Valve por defecto ajustado a la malla; uno que viene como muñeco con esqueleto pero fuera
// de models/player (Drawing Mannequin) también. Se mide: que aparezcan en Personajes → Mods y en la ficha («Ponérmelo»),
// que el rig tenga los 23 huesos y cada vértice de una pierna sólo pese en su pierna, que al correr los pies del modelo
// se alternen y al agacharse la cadera baje, que la malla siga al esqueleto (no se queda quieta) y que no se rompa nada.
// uso: node gmod_autorig.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, D = '.'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.cuerpo`), null, { timeout: 60000 }); await p.waitForTimeout(1500);
for (const id of ['499710256', '439849859']) await ev(`(async () => { const A = await gmInstalar('${id}', { nombre: 'addon ${id}', sinDeps: true }, new Uint8Array(await (await fetch('${CARP}/${id}.gma')).arrayBuffer())); await A.listo; return 1; })()`);
const PAT = 'models/plushies/patrickdoll.mdl', MAN = 'models/drawingmannequin/drawingmannequin.mdl';
const lista = await ev(`(() => { const L = gmpLista(); return { pat: L.includes('${PAT}'), man: L.includes('${MAN}'), tipoPat: gmarTipo('${PAT}'), tipoMan: gmarTipo('${MAN}'), nom: pjmInstalados().filter((x) => /patrick|mannequin/.test(x.r)).map((x) => x.n) }; })()`);
ok('el Patrick (prop quieto) y el maniquí (muñeco fuera de models/player) se pueden poner', lista.pat && lista.man && lista.tipoPat === 'auto' && lista.tipoMan === 'vb', lista);
// el rig: huesos y pesos por zona
const rig = await ev(`(() => { const M = gmarRig(gmLeerModelo('${PAT}')); const H = M.huesos.map((h) => h.n), V = M.v; let mal = 0, piernas = 0;
  const iL = H.filter((n) => /_L_(Thigh|Calf|Foot|Toe0)$/.test(n)).map((n) => H.indexOf(n)), iR = H.filter((n) => /_R_(Thigh|Calf|Foot|Toe0)$/.test(n)).map((n) => H.indexOf(n));
  const E = gmarEjes(V), PR = gmarPiernas(V, E);
  for (let i = 0; i < V.n; i++) { const z = (V.pos[i * 3 + 2] - E.z0) / E.h; if (z > PR.zc - 0.05) continue; piernas++; const lt = V.pos[i * 3] * E.L[0] + V.pos[i * 3 + 1] * E.L[1], lado = lt > PR.corte ? iL : iR, otro = lt > PR.corte ? iR : iL;
    for (let k = 0; k < 3; k++) if (V.w[i * 3 + k] > 0.01 && otro.includes(V.hb[i * 3 + k])) { mal++; break; } }
  return { n: H.length, piernas, mal, zc: +PR.zc.toFixed(2), alto: +(E.h * GM_S).toFixed(2) }; })()`);
ok('el rig tiene el esqueleto de Valve entero (23 huesos) y ningún vértice de una pierna pesa en la otra', rig.n === 23 && rig.piernas > 10 && rig.mal === 0, rig);
// ponérselo: un personaje con ese modelo adelante de la cámara, corriendo y agachado
const medir = (ruta, nom) => ev(`(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms)), base = JUG.pos.clone();
  const P = crearPersona('gmpm:${ruta}', 'HatEmpty', { nombre: '' }); P.npcQuieto = true; window.__AR = P;
  const fw = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); P.pos.copy(vadd(base, vscale(fw, 2.4))); P.yaw = JUG.yaw + Math.PI / 2; JUG.pitch = 0.42;   // (mirando un poco para abajo: el Patrick mide 73 cm)
  { const t0 = performance.now(); while (!(P.gmp && !P.gmp.propio) && performance.now() - t0 < 8000) await espera(50); }
  const out = {}, W = (G, n) => { const i = G.def.porMix[n]; return i === undefined ? null : G.Pw[i].clone(); };
  for (const [est, vel, ag] of [['quieto', 0, false], ['corre', 4.5, false], ['agachado', 0, true]]) {
    const t0 = performance.now(); let sep = 0, cad = [], mov = 0, prev = null;
    while (performance.now() - t0 < 1600) { const yv = P.yaw; P.vel.set(Math.sin(yv) * vel, 0, Math.cos(yv) * vel); P.suelo = true; P.agachado = ag; P.pos.y = base.y; await espera(30);
      const G = P.gmp; if (!G || G.propio || performance.now() - t0 < 500) continue;
      const pl = W(G, 'LeftFoot'), pr = W(G, 'RightFoot'), hi = W(G, 'Hips'); if (!pl || !pr || !hi) continue;
      sep = Math.max(sep, Math.abs(vdot(vsub(pl, pr), v3(Math.sin(yv), 0, Math.cos(yv))))); cad.push(hi.y - (P.pos.y - 1));
      if (prev) mov += vsub(pl, prev).len(); prev = pl; }
    out[est] = { sep: +sep.toFixed(2), cadera: cad.length ? +(cad.reduce((a, b) => a + b, 0) / cad.length).toFixed(3) : null, mov: +mov.toFixed(2) };
  }
  out.armado = !!(P.gmp && !P.gmp.propio); return out; })()`);
for (const [ruta, nom] of [[PAT, 'Patrick'], [MAN, 'maniquí']]) {
  const m = await medir(ruta, nom);
  ok(`${nom}: puesto como personaje con el esqueleto de Valve (no como estatua)`, m.armado, m);
  ok(`${nom}: corriendo los pies se alternan y se mueven, agachado la cadera baja`, m.corre.sep > 0.05 && m.corre.mov > 0.3 && m.agachado.cadera < m.quieto.cadera * 0.9, m);
  for (const [est, vel, ag] of [['corre', 4.5, false], ['agachado', 0, true]]) {
    await ev(`(async () => { const P = window.__AR, t0 = performance.now(); while (performance.now() - t0 < 700) { P.vel.set(Math.sin(P.yaw) * ${vel}, 0, Math.cos(P.yaw) * ${vel}); P.suelo = true; P.agachado = ${ag}; await new Promise((r) => setTimeout(r, 30)); } return 1; })()`);
    await p.screenshot({ path: `${D}/autorig_${nom}_${est}.jpg`, type: 'jpeg', quality: 72, clip: { x: 340, y: 160, width: 600, height: 480 } });
  }
  await ev(`borrarPersona(window.__AR); 1`);
}
// y desde la ficha del addon: «Ponérmelo»
const fi = await ev(`(() => { const A = GMOD.addons.get('499710256'); const h = gmFichaAbrir(A); return /pmGm:${PAT.replace(/\//g, '\\/')}/.test(h); })()`);
ok('la ficha del addon del Patrick tiene «Ponérmelo»', fi);
const lua = await ev(`GMA.errores.slice(-3)`); ok('sin errores de Lua', !lua.length, lua);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x)); ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
