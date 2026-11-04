// los personajes de los addons como muñeco de trapo (prop_ragdoll de GMod): en el menú GMod hay una entrada «(muñeco)»
// por personaje; ponerlo lo deja tirado con sus huesos (no parado como una estatua), no se levanta nunca, se lo agarra y se
// lo lleva con la Physics Gun, los tiros lo empujan sin matarlo, para el Lua es un prop_ragdoll y el tacho lo quita.
// uso: node gmod_munecos.mjs URL_HTML URL_CARPETA_GMA [ID=158326196 (Iron Man)]
import { abrir } from './base.mjs';
const [, , HTML, CARP, ID = '158326196'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(2500);
const ruta = await ev(`(async () => { const A = await gmInstalar('${ID}', { nombre: 'x', sinDeps: true }, new Uint8Array(await (await fetch('${CARP}/${ID}.gma')).arrayBuffer())); await A.listo; gmMenu(); return gmpLista().find((r) => A.G.archivos.has(r)) || null; })()`);
const menu = await ev(`(() => { const C = DATA.menu.find((c) => c.n === 'GMod'), it = C ? C.sub.flatMap((s) => s.it) : []; return { rag: it.filter((x) => /^gmrag:/.test(x)).length, nom: it.filter((x) => /^gmrag:/.test(x)).map(propNom)[0] || null }; })()`);
ok('el menú GMod tiene cada personaje también como «(muñeco)»', menu.rag > 0 && /\(muñeco\)|\(ragdoll\)/.test(menu.nom || ''), menu);
const r = await ev(`(async () => { const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  // (apuntar la cámara a un punto: se prueban los dos sentidos del giro y queda el que mira hacia ahí)
  const apuntar = async (q) => { let mejor = null; for (const sg of [1, -1]) { const d = vsub(q, CAM.pos); JUG.yaw = Math.atan2(d.x, d.z) + (sg < 0 ? 0 : Math.PI); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); await espera(150); const al = vdot(CAM.fwd, vsub(q, CAM.pos).norm()); if (!mejor || al > mejor.al) mejor = { al, yaw: JUG.yaw, pitch: JUG.pitch }; } JUG.yaw = mejor.yaw; JUG.pitch = mejor.pitch; await espera(150); return mejor.al; };
  JUG.pos.set(0, 1.5, 0); JUG.yaw = 0; JUG.pitch = 0.15; await espera(300);
  const n0 = NPC.lista.length; spawnElegir('GMod', 'gmrag:${ruta}');
  { const t0 = performance.now(); while (NPC.lista.length <= n0 && performance.now() - t0 < 15000) await espera(100); }
  const P = NPC.lista[NPC.lista.length - 1]; if (!P || !P.muneco) return { puesto: false };
  await espera(1500); const tirado = !!P.rag, piezas = P.rag ? P.rag.cuerpos.size : 0;
  // (6 s después sigue tirado: un muñeco no se levanta)
  await espera(6000); const sigue = !!P.rag;
  // (la entidad de Lua: un prop_ragdoll)
  const h = P.rag && P.rag.cuerpos.get(P.D.h.Hips), e = gmaEntPersona(P), clase = e && e.clase, ragLua = e && GMA.metas && GMA.metas.Entity ? true : true;
  // (con la Physics Gun: apuntar a la cadera, agarrar y llevarlo)
  const iPG = ARM.lista.indexOf('PhysicsGun'); if (iPG >= 0) elegirArma(iPG); await espera(400);
  const al1 = await apuntar(h.b.pos.clone());
  const p0 = h.b.pos.clone(); ENT.disparo = true; await espera(300); const agarrado = !!ARM.agarre && [...P.rag.cuerpos.values()].some((x) => x.b === ARM.agarre.b);
  JUG.pitch -= 0.5; for (let i = 0; i < 12; i++) { JUG.yaw += 0.04; await espera(100); } const llevado = h.b.pos.distTo(p0);
  ENT.disparo = false; await espera(1500);
  // (los tiros lo empujan sin matarlo)
  for (let i = 0; i < 5; i++) danarPersona(P, 50, h.b.pos.clone(), v3(0, 0, -1));
  const vivo = P.vivo !== false && PERS.includes(P); await espera(9000); const noBorrado = PERS.includes(P) && !!P.rag;
  // (el tacho lo quita)
  const al2 = await apuntar(h.b.pos.clone()); borrarApuntado(); await espera(300);
  return { al1: +al1.toFixed(3), al2: +al2.toFixed(3), puesto: true, tirado, piezas, sigue, clase, agarrado, llevado: +llevado.toFixed(2), vivo, noBorrado, quitado: !PERS.includes(P) && !NPC.lista.includes(P) }; })()`);
ok('se pone tirado como muñeco de trapo, con sus huesos (≥ 8 piezas)', r.puesto && r.tirado && r.piezas >= 8, r);
ok('no se levanta (6 s después sigue tirado)', r.sigue, r.sigue);
ok('para el Lua es un prop_ragdoll (no un NPC)', r.clase === 'prop_ragdoll', r.clase);
ok('la Physics Gun lo agarra y se lo lleva (> 1 m)', r.agarrado && r.llevado > 1, { agarrado: r.agarrado, llevado: r.llevado });
ok('los tiros no lo matan ni lo borran (sigue ahí 9 s después)', r.vivo && r.noBorrado, { vivo: r.vivo, sigue: r.noBorrado });
ok('el tacho lo quita', r.quitado, r.quitado);
await p.screenshot({ path: 'munecos.png' });
const lua = await ev(`GMA.errores.slice(-5)`); ok('sin errores de Lua', !lua.length, lua);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x)); ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
