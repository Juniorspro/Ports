// Muñecos de trapo de cualquier modelo (gmod_rag.js). Panel: «cuando descargo un modelo de GMod se pone duro» (dvq7d92i,
// Foxy de FNaF en pose T), «que haga ragdolls» (za7gix4d). Con «FNaF SL - Funtime Foxy (Ragdoll)» (Workshop 1544329722,
// esqueleto propio, no el humano de Valve):
//  1. el modelo tiene .phy de varios sólidos y se puede hacer muñeco (gmrgPuede); no es de esqueleto humano (gmEsMuneco);
//  2. puesto desde el menú sale como muñeco: un cuerpo por sólido, unidos;
//  3. cae y queda tirado en el piso (ningún cuerpo por debajo del piso, todos quietos al final) y ya no está en pose T: los
//     huesos se movieron respecto de la pose de referencia;
//  4. un empujón (como un tiro) lo mueve y los huesos lo siguen;
//  5. el tacho lo borra y suelta sus cuerpos;
//  6. sin errores de Lua ni de JS.
// uso: node muneco_generico.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/muneco_generico'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const { b, p, err, ev } = await abrir(HTML + '?test', !!process.env.CELU);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
const inst = await ev(`(async () => { const A = await gmInstalar('1544329722', { nombre: 'foxy' }); if (A && A.listo) await A.listo; await new Promise((r) => setTimeout(r, 1500)); return { ok: !!A, mdl: [...A.G.archivos.keys()].filter((k) => /\\.mdl$/.test(k)) }; })()`);
const e0 = await ev(`GMA.errores.length`);
// el modelo de muñeco: el que tiene .phy de varios sólidos (sus piezas se leen del disco de a pedazos: se espera, como
// spawnElegir con gmModeloEsperar)
let ruta = null;
for (let k = 0; k < 40 && !ruta; k++) { ruta = await ev(`(${JSON.stringify(inst.mdl)}).find((r) => { gmModeloEsperar && gmModeloEsperar('gm:' + r, () => {}); return gmrgPuede(r); }) || null`); if (!ruta) await p.waitForTimeout(500); }
const esHum = ruta ? await ev(`gmEsMuneco(${JSON.stringify(ruta)})`) : null;
ok('1. el modelo tiene .phy de varios sólidos y no es de esqueleto humano', !!ruta && !esHum, { mdl: inst.mdl, ruta, esHum });
await ev(`(() => { JUG.yaw = 0; JUG.pitch = 0.2; return 1; })()`);
await ev(`spawnElegir('props', 'gm:' + ${JSON.stringify(ruta)}); 1`); await p.waitForTimeout(400);
const M = `[...GMRG.lista][0]`;
const st0 = await ev(`(() => { const e = ${M}; if (!e) return null; return { cuerpos: e.ragGen.cuerpos.length, uniones: PH.joints.filter((j) => j.a.gmRag === e).length, clase: e.clase }; })()`);
ok('2. sale como muñeco: un cuerpo por sólido, unidos', st0 && st0.cuerpos >= 2 && st0.uniones >= st0.cuerpos - 1, st0);
// (la física, 5 s a 60 pasos por segundo como en un aparato que anda bien: el navegador de prueba va a 4-7 cuadros por
// segundo y el juego, en una máquina lenta, pasa la física a 30 por segundo, donde cualquier cadena de uniones tiembla)
await ev(`(() => { for (let i = 0; i < 300; i++) { physStep(1 / 60); gmrgPaso(); } return 1; })()`);
await p.waitForTimeout(300);
await p.screenshot({ path: D + '/1_tirado.png' });
// (de cerca: el jugador a 1,6 m mirándolo)
await ev(`(() => { const e = ${M}, q = e.ragGen.raiz.b.pos, d0 = vsub(JUG.pos, q); d0.y = 0; d0.norm(); const pj = vadd(q, vscale(d0, 1.6)); JUG.pos.set(pj.x, JUG.pos.y, pj.z); JUG.vel.set(0, 0, 0); const d = vsub(q, CAM.pos); JUG.yaw = Math.atan2(-d0.x, -d0.z); JUG.pitch = 0.55; return 1; })()`);
await p.waitForTimeout(900); await p.screenshot({ path: D + '/1b_cerca.png' });
if (process.env.VEL) console.log('VEL', JSON.stringify(await ev(`(() => { const e = ${M}, d = gmanDef(e.modelo); return e.ragGen.cuerpos.map((c) => [d.nombres[c.k], +c.b.vel.len().toFixed(2), +(c.b.ang ? c.b.ang.len() : 0).toFixed(2), +c.b.mass.toFixed(1)]); })()`)));
const st1 = await ev(`(() => { const e = ${M}, d = gmanDef(e.modelo), H = gmanHuesos(e), piso = pisoBajo(e.pos, 3); let dif = 0, n = 0;
  // (cuánto se apartaron los huesos de la pose de referencia, cada uno respecto de su padre: en pose T sería 0)
  for (let i = 0; i < d.nb; i++) { const pa = d.padres[i]; if (pa < 0) continue; const A = H.W[1 + pa], B = H.W[1 + i], R0 = d.restW[1 + pa], R1 = d.restW[1 + i];
    const qa = m4quat(A), qb = m4quat(B), ra = m4quat(R0), rb = m4quat(R1); const rel = qa.conj().mul(qb), rrel = ra.conj().mul(rb); dif += 2 * Math.acos(Math.min(1, Math.abs(rel.x * rrel.x + rel.y * rrel.y + rel.z * rrel.z + rel.w * rrel.w))); n++; }
  const bajo = e.ragGen.cuerpos.map((c) => +(c.b.pos.y - piso).toFixed(2)), vel = Math.max(...e.ragGen.cuerpos.map((c) => c.b.vel.len()));
  return { gradosProm: +(dif / Math.max(1, n) * 180 / Math.PI).toFixed(1), minAltura: Math.min(...bajo), vel: +vel.toFixed(3), piso: +piso.toFixed(2) }; })()`);
ok('3. cae y queda tirado: sobre el piso, quieto y sin la pose T', st1.minAltura > -0.05 && st1.vel < 0.5 && st1.gradosProm > 2, st1);
// 4: un empujón (como una explosión: a todos sus cuerpos)
const st2 = await ev(`(async () => { const e = ${M}, b = e.ragGen.raiz.b, p0 = b.pos.clone(), h0 = gmanHuesos(e).W[1 + e.ragGen.raiz.k][12]; for (const c of e.ragGen.cuerpos) { c.b.wake && c.b.wake(); c.b.vel.add(v3(0, 4, 3)); } for (let i = 0; i < 40; i++) { physStep(1 / 60); gmrgPaso(); } GMAN.cuadro++; const h1 = gmanHuesos(e).W[1 + e.ragGen.raiz.k][12]; return { movio: +b.pos.distTo(p0).toFixed(2), huesoSiguio: Math.abs(h1 - b.pos.x) < 0.5 && h1 !== h0 }; })()`);
await p.waitForTimeout(1500); await p.screenshot({ path: D + '/2_empujado.png' });
ok('4. un empujón lo mueve y los huesos lo siguen', st2.movio > 0.3 && st2.huesoSiguio, st2);
// 5: el tacho (ya asentado otra vez)
await ev(`(() => { for (let i = 0; i < 240; i++) { physStep(1 / 60); gmrgPaso(); } return 1; })()`); await p.waitForTimeout(300);
const st3 = await ev(`(() => { const e = ${M}, b = e.ragGen.raiz.b, o = gmaOjo(); const d = vsub(b.pos, CAM.pos); JUG.yaw = Math.atan2(d.x, d.z); JUG.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); return 1; })()`);
await p.waitForTimeout(300);
const st4 = await ev(`(() => { const n0 = PH.bodies.filter((x) => x.gmRag).length; borrarApuntado(); return { antes: n0, despues: PH.bodies.filter((x) => x.gmRag).length, lista: GMRG.lista.size }; })()`);
ok('5. el tacho lo borra y suelta sus cuerpos', st4.antes > 0 && st4.despues === 0 && st4.lista === 0, st4);
// (lo que no contesta de afuera —el broker público, los servidores de Steam con 502— no es del muñeco)
const e1 = await ev(`GMA.errores.slice(${e0})`), errJs = err.filter((x) => !/WebSocket connection to|Failed to load resource/.test(x));
ok('6. sin errores de Lua ni de JS', !e1.length && !errJs.length, { lua: e1.slice(0, 4), js: errJs.slice(0, 4) });
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
