// Pill Packs del Workshop (pill_gmod.js): se instala un addon hecho para pk_pills (el de FNaF, Workshop 320621862, y si se
// pasa, el pack base de Parakeet, 950845673) desde un .gma servido al lado del HTML; sus personajes aparecen en la pestaña
// Pill Packs bajo el nombre del pack, con su ícono; transformarse en uno usa su modelo y sus secuencias (quieto/caminar),
// su vida y velocidad, el golpe de pk_pills.common.melee con sus sonidos y la habilidad de su Lua (reload). Caminan por lo
// menos como el jugador, su carrera le gana a su correr y saltan (los de FNaF traen jumpPower = 0: según su tamaño) sin
// atravesar el piso al caer. Fotos.
// uso: node pill_gmod.mjs URL_HTML CARPETA_FOTOS GMA_FNAF [GMA_BASE]   (los .gma por URL, relativos al HTML)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, DIR = '.', GMA_F = 'fnaf.gma', GMA_B] = process.argv, D = DIR.replace(/\/?$/, '/'); fs.mkdirSync(D, { recursive: true });
let ok = 0, mal = 0; const res = (b, t, x) => { b ? ok++ : mal++; console.log((b ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };
const { b, p, err, ev } = await abrir(HTML);
const J = async (s) => JSON.parse(await ev(`JSON.stringify(${s})`));
const cuadros = async (n) => { const m0 = await ev(`R.marca`); for (let i = 0; i < 150 && (await ev(`R.marca`)) < m0 + n; i++) await p.waitForTimeout(50); };
await ev(`PREFS.bienvenida = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && JUG.suelo`), null, { timeout: 120000, polling: 300 }); await p.waitForTimeout(2000);
// (caminar, correr y saltar medidos en el reloj de la física: con el navegador por software va a menos de tiempo real)
await ev(`window.__simT = 0; { const f0 = jugadorPaso; jugadorPaso = function (dt) { window.__simT += dt; return f0.apply(this, arguments); }; }
  window.__piso = () => new Promise((ok) => { const t0 = performance.now(), s0 = window.__simT; const f = () => { if ((JUG.suelo && JUG.tiempoSuelo > 0.25) || window.__simT - s0 > 5 || performance.now() - t0 > 120000) ok(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  window.__lugar = () => { const sp = MUNDO.spawns[0] || v3(0, 5, 0); for (const o of [...OBJS]) if (o.b && o.b.pos.distTo(sp) < 8) borrarObjeto(o); JUG.pos.set(sp.x, sp.y + 0.2, sp.z); JUG.vel.set(0, 0, 0); JUG.yaw = 0.6; JUG.pitch = 0.15; };
  window.__mv = async (teclas) => { window.__lugar(); await window.__piso(); PILL.pod = pillPodMax(); for (const k of teclas) ENT.teclas.add(k); const L = [], t0 = window.__simT;
    await new Promise((ok) => { const f = () => { L.push([window.__simT, JUG.pos.x, JUG.pos.z]); if (window.__simT - t0 < 2.2) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
    for (const k of teclas) ENT.teclas.delete(k); ENT.x = ENT.y = 0; const fin = L[L.length - 1]; let a = L[0]; for (const q of L) if (fin[0] - q[0] <= 1) { a = q; break; }
    return +(Math.hypot(fin[1] - a[1], fin[2] - a[2]) / (fin[0] - a[0])).toFixed(2); };
  // (el origen del modelo de GMod va en sus pies: al caer, no más abajo que el piso)
  window.__salto = async () => { window.__lugar(); await window.__piso(); const P = JUG.cuerpo, y0 = JUG.pos.y, sec0 = P.gmp ? P.gmp.sec : -1; let yM = y0, salio = false, cae = null, raizMin = 9, secAire = null, n = 0;
    ENT.teclas.add('Space'); const t0 = window.__simT;
    await new Promise((ok) => { const f = () => { if (++n === 4) ENT.teclas.delete('Space'); yM = Math.max(yM, JUG.pos.y); if (!JUG.suelo) { salio = true; if (secAire === null && P.gmp) secAire = P.gmp.sec; } if (salio && JUG.suelo && cae === null) cae = window.__simT;
      if (cae !== null) { P.md.actualizar(); const g = mundoRayo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), v3(0, -1, 0), 10); if (g) raizMin = Math.min(raizMin, P.md.raiz[13] - (JUG.pos.y + 0.5 - g.t)); }
      if ((cae !== null && window.__simT - cae > 0.5) || window.__simT - t0 > 5) ok(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    ENT.teclas.delete('Space'); return { alto: +(yM - y0).toFixed(2), salio, raizMin: +raizMin.toFixed(3), sec0, secAire, nominal: +pillSaltoDe(PILL.def).toFixed(2) }; }; 1`);
const jugCorre = await p.evaluate(() => window.__ev(`window.__mv(['KeyW', 'ShiftLeft'])`));
const instalar = (url, id, n) => p.evaluate(([u, i, nn]) => window.__ev(`(async () => { const t0 = performance.now(); const r = await fetch(${JSON.stringify(u)}); const b = new Uint8Array(await r.arrayBuffer()); const A = await gmInstalar(${JSON.stringify(i)}, { nombre: ${JSON.stringify(nn)}, sinDeps: true }, b); return { s: +((performance.now() - t0) / 1000).toFixed(1), lua: A.lua.length, modelos: A.modelos.length }; })()`), [url, id, n]);
const r1 = await instalar(GMA_F, '320621862', 'FNaF Pill Pack');
await p.waitForTimeout(3000);
const reg = await J(`({ formas: [...PGM.formas.keys()], packs: PGM.packs.map((x) => [x.n, x.items.length]), usables: pillGmPacks().map(([n, L]) => [n, L.map((i) => pillGmDef(i).nom)]) })`);
res(reg.formas.length >= 4 && reg.usables.length === 1 && reg.usables[0][1].length === new Set(reg.usables[0][1]).size && reg.packs.length === 1, 'el addon de pk_pills se instala y registra sus personajes una vez (pk_pills propio; el autorun corre de los dos lados)', { r1, ...reg });
if (GMA_B) {
  const r2 = await instalar(GMA_B, '950845673', "Parakeet's Pill Pack"); await p.waitForTimeout(3000);
  const reg2 = await J(`({ formas: PGM.formas.size, packs: PGM.packs.map((x) => [x.n, x.items.length]), usables: pillGmPacks().map(([n, L]) => [n, L.length, new Set(L).size]) })`);
  res(reg2.formas > reg.formas.length && reg2.usables.length > 1 && reg2.usables.every((u) => u[1] === u[2]) && new Set(reg2.packs.map((x) => x[0])).size === reg2.packs.length, 'el pack base de Parakeet también: sus packs con los personajes que caminan', { r2, ...reg2 });
}
// la pestaña
await ev(`abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.pill); UI.sub = 0; spawnDibujar(); 1`); await p.waitForTimeout(500);
const cats = await J(`[...$('cats').querySelectorAll('.cat')].map((c) => c.textContent)`);
const k = cats.indexOf(reg.usables[0] && reg.usables[0][0]);
await ev(`UI.sub = ${k}; spawnDibujar(); 1`); await p.waitForTimeout(2500); await ev(`spawnDibujar(); 1`); await p.waitForTimeout(1500);
const gr = await J(`[...$('grilla').querySelectorAll('.pillIt')].map((d) => ({ id: d.dataset.pill, n: d.textContent, img: d.querySelector('img').naturalWidth }))`);
res(k > 0 && gr.length >= 4 && gr.every((x) => x.img > 0), 'la pestaña muestra el pack con sus personajes y su ícono', { cats, gr });
await p.screenshot({ path: D + 'gm_pestana.png' });
// transformarse en cada uno
for (const it of gr.slice(0, 4)) {
  await ev(`cerrarPaneles(); abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.pill); UI.sub = ${k}; spawnDibujar(); 1`); await p.waitForTimeout(300);
  await ev(`$('grilla').querySelector('[data-pill="${it.id}"]').click(); 1`);
  await p.waitForFunction((x) => window.__ev(`PILL.on && PILL.id === ${JSON.stringify(x)} && JUG.cuerpo && JUG.cuerpo.gmp && JUG.cuerpo.gmp.def`), it.id, { timeout: 60000, polling: 300 }).catch(() => {});
  await ev(`JUG.pos.copy(MUNDO.spawns[0] || JUG.pos); JUG.vel.set(0, 0, 0); JUG.yaw = 0.6; JUG.pitch = 0.15; 1`); await p.waitForTimeout(2500);
  const e = await J(`(() => { const P = JUG.cuerpo, G = P.gmp; return { on: PILL.on, nom: PILL.def && PILL.def.nom, skin: P.skin, propio: !!(G && G.propio), sec: G && G.sec, vida: JUG.vidaMax, vel: +JUG.vel_max.toFixed(2), tam: +(JUG.tam || 1).toFixed(2), hab: PILL.def.hab.map((h) => h && h.t), tercera: JUG.tercera }; })()`);
  res(e.on && e.tercera && /^gmpm:/.test(e.skin), `${it.n}: transformado con el modelo del addon`, e);
  await cuadros(4); await p.screenshot({ path: D + 'gm_' + it.id.replace(/\W/g, '_') + '.png' });
  // caminar: la secuencia cambia (idle → run)
  const s0 = await J(`JUG.cuerpo.gmp.sec`);
  await ev(`ENT.teclas.add('KeyW'); 1`); await cuadros(15); const s1 = await J(`JUG.cuerpo.gmp.sec`); await p.screenshot({ path: D + 'gm_' + it.id.replace(/\W/g, '_') + '_camina.png' }); await ev(`ENT.teclas.delete('KeyW'); 1`); await cuadros(10);
  res(s0 !== s1, `${it.n}: al caminar cambia la animación (secuencia del pack)`, { quieto: s0, camina: s1 });
  // los pies (el origen del modelo de GMod va en el piso)
  const piso = await J(`(() => { const P = JUG.cuerpo, g = mundoRayo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), v3(0, -1, 0), 10); P.md.actualizar(); return { raiz: +(P.md.raiz[13] - (JUG.pos.y + 0.5 - g.t)).toFixed(3) }; })()`);
  res(Math.abs(piso.raiz) < 0.06, `${it.n}: el origen del modelo en el piso`, piso);
  // más rápido que el jugador (caminar ≥ 6 m/s, la carrera más que su correr) y saltar (el pack de FNaF trae jumpPower = 0:
  // acá salta igual, según su tamaño), sin que el modelo atraviese el piso al caer
  const vel = { camina: await p.evaluate(() => window.__ev(`window.__mv(['KeyW'])`)), carrera: await p.evaluate(() => window.__ev(`window.__mv(['KeyW', 'ShiftLeft'])`)) };
  res(vel.camina >= 5.9 && vel.carrera > jugCorre * 1.1, `${it.n}: camina como mínimo como el jugador y su carrera le gana a su correr (${jugCorre} m/s)`, vel);
  const sj = await p.evaluate(() => window.__ev(`window.__salto()`));
  res(sj.salio && sj.alto > 0.6 && Math.abs(sj.alto - sj.nominal) < 0.15 * sj.nominal && sj.raizMin > -0.03, `${it.n}: salta (${sj.nominal} m) y al caer no atraviesa el piso`, sj);
  await ev(`window.__lugar(); 1`); await p.evaluate(() => window.__ev(`window.__piso()`)); await ev(`ENT.teclas.add('Space'); 1`); await cuadros(2); await ev(`ENT.teclas.delete('Space'); 1`);
  for (let i = 0; i < 60 && !(await J(`!JUG.suelo && JUG.vel.y < 0.8`)); i++) await p.waitForTimeout(30);
  await p.screenshot({ path: D + 'gm_' + it.id.replace(/\W/g, '_') + '_salto.png' }); await p.evaluate(() => window.__ev(`window.__piso()`));
  // el golpe del pack (pk_pills.common.melee) contra un NPC
  await ev(`(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); npcCrear('Jean', vadd(JUG.pos, vscale(f, 1.6)), JUG.yaw + Math.PI); })(); PILL.cd = [0, 0, 0, 0]; ENT.pillA0 = true; 1`);
  await cuadros(3); await ev(`ENT.pillA0 = false; 1`);
  // (el golpe llega «delay» segundos después: a los cuadros que dé el navegador por software)
  for (let i = 0; i < 40 && (await J(`!!PILL.golpe`)); i++) await p.waitForTimeout(150); await p.waitForTimeout(300);
  const g = await J(`({ npc: PERS.filter((Q) => Q.npc).map((Q) => Q.vivo !== false ? Q.vida : 'muerto'), una: !!JUG.cuerpo.pillUna })`);
  res(g.npc.length && g.npc.every((v) => v === 'muerto' || v < 100), `${it.n}: el golpe del pack lastima`, g);
  await p.screenshot({ path: D + 'gm_' + it.id.replace(/\W/g, '_') + '_golpe.png' });
  await ev(`for (const Q of PERS.filter((Q) => Q.npc)) borrarPersona(Q); 1`);
  // la habilidad de su Lua (reload: R)
  const hl = await J(`PILL.def.hab[3] && PILL.def.hab[3].t`);
  if (hl) {
    const a = await J(`[JUG.pos.x, JUG.pos.z]`);
    await ev(`JUG.pitch = 0.2; PILL.cd = [0, 0, 0, 0]; window.__luaLog = []; ENT.pillA3 = true; 1`); await cuadros(3); await ev(`ENT.pillA3 = false; 1`);
    // (la de los animatrónicos del pack: a los 2 s —timer.Simple, en el tiempo del juego— aparece donde mira)
    // (en 4 s del reloj del juego, con lo que tarde: con la máquina cargada, 2 s del juego eran más de 10 de la pared)
    const tj = await J(`TIEMPO.t`); for (let i = 0; i < 400 && Math.hypot(...(await J(`[JUG.pos.x - ${a[0]}, JUG.pos.z - ${a[1]}]`))) < 1 && (await J(`TIEMPO.t`)) - tj < 4; i++) await p.waitForTimeout(200);
    const d = await J(`({ pos: [JUG.pos.x, JUG.pos.z], rota: !!PILL.def.hab[3].rota })`);
    res(!d.rota && Math.hypot(d.pos[0] - a[0], d.pos[1] - a[1]) > 3, `${it.n}: la habilidad de su Lua (R: teletransporte del pack) anda`, { antes: a, despues: d.pos, rota: d.rota, movio: +Math.hypot(d.pos[0] - a[0], d.pos[1] - a[1]).toFixed(2) });
  }
}
// los del pack base (con los modelos de HL2 que trae el juego para los addons): uno de cada pack
if (GMA_B) {
  const muestra = await J(`pillGmPacks().filter(([n]) => n !== 'Five Nights at Freddys').map(([n, L]) => [n, L.slice(0, 2)])`);
  for (const [pack, L] of muestra) for (const id of L) {
    await ev(`pillAplicar(${JSON.stringify(id)}); 1`);
    const lis = await p.waitForFunction((x) => window.__ev(`PILL.on && PILL.id === ${JSON.stringify(x)} && JUG.cuerpo && JUG.cuerpo.skin === PILL.def.skin && !!(JUG.cuerpo.gmp && JUG.cuerpo.gmp.def)`), id, { timeout: 60000, polling: 300 }).then(() => true, () => false);
    await ev(`JUG.pos.copy(MUNDO.spawns[0] || JUG.pos); JUG.vel.set(0, 0, 0); JUG.yaw = 0.6; JUG.pitch = 0.15; 1`); await p.waitForTimeout(2000);
    const e = await J(`({ nom: PILL.def && PILL.def.nom, skin: JUG.cuerpo.skin, propio: !!(JUG.cuerpo.gmp && JUG.cuerpo.gmp.propio), tam: +(JUG.tam || 1).toFixed(2), vida: JUG.vidaMax, hab: PILL.def.hab.map((h) => h && h.t) })`);
    await ev(`ENT.teclas.add('KeyW'); 1`); await cuadros(12); await p.screenshot({ path: D + 'gm_base_' + id.replace(/\W/g, '_') + '.png' }); await ev(`ENT.teclas.delete('KeyW'); 1`); await cuadros(4);
    res(lis, `${pack} · ${e.nom}: transformado con su modelo`, e);
    const cv = await p.evaluate(() => window.__ev(`window.__mv(['KeyW'])`)), sj = await p.evaluate(() => window.__ev(`window.__salto()`));
    res(cv >= 5.9 && sj.salio && sj.alto > 0.5 && Math.abs(sj.alto - sj.nominal) < 0.15 * sj.nominal, `${pack} · ${e.nom}: camina ≥ 6 m/s y salta (${sj.nominal} m)`, { camina: cv, salto: sj });
  }
}
await ev(`pillFin(); 1`); await cuadros(4);
res(!(await J(`PILL.on`)) && (await J(`JUG.cuerpo.skin`)) === (await J(`PREFS.skin`)), 'vuelve al personaje de siempre');
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|GPU stall|swiftshader|Automatic fallback/i.test(x));
res(!e2.length, 'sin errores de JS', e2.slice(0, 6));
console.log(`RESUMEN ${ok}/${ok + mal}`);
await b.close(); process.exit(mal ? 1 : 0);
