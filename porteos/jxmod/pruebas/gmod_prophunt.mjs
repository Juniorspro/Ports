// Prop Hunt como un jugador: en un mapa ph_, elegir Props; que el modo cree la utilería (ph_prop) pegada al jugador y sin
// chocarlo, que el jugador quede invisible, que camine al empezar la ronda, y que con E sobre un objeto del mapa la
// utilería tome su forma. Sin errores de Lua ni de JS.
// uso: node gmod_prophunt.mjs URL_HTML URL_CARPETA_GMA [ID=143190159] [MAPA=WS_ph_no1office] [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, ID = '143190159', MAPA = 'WS_ph_no1office', DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${ID}.gma')).arrayBuffer()); const A = await gmInstalar('${ID}', { nombre: '${ID}', sinDeps: true }, b); await A.listo; return 1; })()`);
await ev(`empezarPartida(${JSON.stringify(MAPA)}); 1`);
await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), MAPA, { timeout: 240000 }).catch(() => {});
await p.waitForTimeout(3000);
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 40000 ? ok() : setTimeout(f, 30)); f(); }); window.__e0 = GMA.errores.length; 1`);
const eq = await ev(`(() => { const L = [...document.querySelectorAll('#gmmEq:not(.oc) [data-eq]')]; const b = L.find((x) => /prop/i.test(x.textContent)); if (b) b.click(); return b ? b.textContent.trim() : null; })()`);
const est = await ev(`(async () => { await esperaJuego(3); const t0 = TIEMPO.t; while ((JUG.congelado || !JUG.vivo || UI.abierto) && TIEMPO.t - t0 < 20) await esperaJuego(0.2);
  const ph = [...GMA.ents.values()].find((e) => e.clase === 'ph_prop' && e.vivo), b = ph && ph.o && ph.o.b;
  const lua = String(gmaCorrer('dbg.lua', 'local p = LocalPlayer() return tostring(p:Team()) .. " " .. tostring(p:GetPlayerClassName()) .. " " .. tostring(IsValid(p.ph_prop)) .. " " .. tostring(p:GetWalkSpeed())'));
  return { lua, ph: !!ph, padre: !!(ph && ph.padre === GMA.jug), noJug: !!(b && b.noJug), cerca: b ? +vsub(gmaEntPos(ph), gmaEntPos(GMA.jug)).len().toFixed(2) : null, invisible: !!(GMA.jug && GMA.jug.color && +GMA.jug.color[3] === 0) }; })()`);
ok('al elegir Props, el modo crea su utilería pegada al jugador (clase Prop, velocidad 250)', !!eq && est.ph && est.padre && / Prop true 250$/.test(est.lua) && est.cerca < 0.5, { eq, ...est });
ok('la utilería no choca con su jugador y el jugador queda invisible (como pide el modo)', est.noJug && est.invisible, est);
const anda = await ev(`(async () => { let mejor = 0; for (let g = 0; g < 4 && mejor <= 1; g++) { const p0 = JUG.pos.clone(); ENT.teclas.add('KeyW'); await esperaJuego(1.5); ENT.teclas.delete('KeyW'); mejor = Math.max(mejor, Math.hypot(JUG.pos.x - p0.x, JUG.pos.z - p0.z)); JUG.yaw += Math.PI / 2; } return { anduvo: +mejor.toFixed(2), suelo: JUG.suelo }; })()`);
ok('camina al empezar la ronda (> 1 m) y queda en el piso', anda.anduvo > 1 && anda.suelo, anda);
const dis = await ev(`(async () => {
  const ph = () => [...GMA.ents.values()].find((e) => e.clase === 'ph_prop' && e.vivo);
  const cand = OBJS.filter((o) => /^gm:models\\//.test(o.nombre) && !o.gmEnt && o.b).map((o) => ({ o, d: vsub(o.b.pos, JUG.pos).len() })).sort((a, b) => a.d - b.d);
  // (uno sin otros objetos pegados: si no, la mira puede caer en el de al lado —una taza sobre un monitor— y toma esa forma)
  const solo = (x) => !OBJS.some((y) => y !== x.o && y.b && /^gm:models\\//.test(y.nombre) && vsub(y.b.pos, x.o.b.pos).len() < 1.2);
  if (!cand.length) return { sinObjetos: true };
  // (parado en el piso al lado del objeto —Prop Hunt pide estar en el piso para tomar la forma—, a 1,6 m de su centro)
  let o = null, c = null;
  for (const x of cand.filter(solo).slice(0, 12)) { const cc = x.o.b.pos, pie = v3(cc.x + 1.6, cc.y + 1.5, cc.z), h = mundoRayo(pie, v3(0, -1, 0), 6); if (h && h.n.y > 0.7) { o = x.o; c = cc.clone(); JUG.pos.set(pie.x, pie.y - h.t + JUG.medio + JUG.radio + 0.02, pie.z); break; } }
  if (!o) return { sinLugar: true };
  JUG.vel.set(0, 0, 0); await esperaJuego(0.8);
  for (let k = 0; k < 3; k++) { const ojo = JUG.ojoPos || CAM.pos, d = vsub(c, ojo); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); await esperaJuego(0.05); }
  usar(); await esperaJuego(0.5);
  return { modelo: ph() && ph().modelo, objeto: o.nombre.slice(3), suelo: JUG.suelo }; })()`);
await ev(`JUG.tercera = true; 1`); await p.waitForTimeout(800); await p.screenshot({ path: D + 'prophunt_disfraz.jpg', type: 'jpeg', quality: 75 });
ok('con E sobre un objeto del mapa, la utilería toma su forma', !!dis.modelo && dis.modelo === dis.objeto, dis);
const errs = await ev(`GMA.errores.slice(window.__e0, window.__e0 + 5)`);
ok('sin errores de Lua', !errs.length, errs);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|\[GMod\]/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
