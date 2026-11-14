// Discord (Noobsaibot0777): «Hagan el bsmod compatible... tiene ejecuciones». BSMod (Workshop 2106330193): el puño
// (weapon_bsmod_punch, vista c_limbs con las manos del jugador), la patada (bsmod_kick) y las ejecuciones (bsmod_killmove:
// dos ent_km_model con las animaciones —c_limbs para el jugador y bsmodimations_human para la víctima— y el modelo de cada
// uno pegado encima con EF_BONEMERGE; la cámara en los ojos del modelo del jugador por CalcView). Mide:
//  A. el addon monta sin errores; sus comandos son habilidades (la patada, la ejecución) y la ejecución es contextual;
//  B. el puño: en el golpe se ve (≥ 1 % de la pantalla: la mano del jugador), quieto como en GMod (los puños quedan bajo el
//     borde de la vista, –25,5° con un campo visual de ±20,9°), le saca 10–15 de vida a un NPC y golpea una caja;
//  C. la patada: la pierna se ve en primera persona y le saca 10–15 de vida a un NPC;
//  D. con poca vida (≤ 25) un NPC golpeado queda «ejecutable»: resaltado de azul (halo), quieto (≤ 1 cm en 1 s), y el botón
//     contextual aparece sólo apuntándole (traza de 100 unidades, como KMCheck);
//  E. cada ejecución (de frente 1 y 2, de atrás, de costado izquierdo y derecho, en el aire) con cada víctima (un NPC del
//     juego, el zombi y el combine de HL2, un nextbot de DrGBase) y cada jugador (el Hero, un modelo de jugador de GMod):
//     - tiempos: el jugador queda libre a la duración de su secuencia + 0,075 s (±0,1 s) y la víctima muere a la suya;
//     - los dos esqueletos de Valve como en GMod (cada hueso contra la referencia calculada del .mdl, cuadro a cuadro: ≤ 2 unidades, 5 cm);
//     - lo dibujado sobre ellos (el Hero llevado al esqueleto de Valve: ≤ 0,5 cm; un .mdl: bonemerge exacto);
//     - el golpe donde cae en GMod (mano–cabeza mínima ±3 unidades de la de GMod);
//     - que no se atraviesen (los torsos a ≥ 15 cm, salvo lo que ya se cruza en GMod) y que no floten ni se hundan (el pie
//       más bajo de cada uno, a ±4 cm del de GMod);
//     - ningún hueso salta entre dos cuadros más de 5 cm de lo que se mueve en la animación de GMod (las de BSMod traen saltos propios:
//       el primer cuadro de «right_1» tiene el pie 1 m corrido, y los dedos y las puntas de los pies saltan hasta 56 cm por
//       cuadro); los dos cambios de modelo de BSMod (el NPC por su modelo animado y, al final, el muñeco) se anotan aparte;
//     - la cámara en los ojos del modelo del jugador (≤ 1 cm) y con su propio cuerpo a la vista (drawviewer);
//     - al final: el jugador libre, en el piso (±4 cm), con el arma que tenía, sin entidades de la ejecución; la víctima, muñeco
//       de trapo puesto como terminó la animación (cadera, pecho y cabeza a ≤ 10 cm), visible y sin salir volando (≤ 3 m en 1 s);
//     - sin errores de Lua ni de JS. Fotos desde la cámara real y de costado, de atrás y de cerca (hojas de contacto).
//  F. celular (873×393 táctil): el botón de la ejecución está fijado, oculto sin a quién y visible apuntándole; tocarlo la
//     hace;
//  G. multijugador (dos páginas con un broker local, como nextbots_red.mjs): el otro ve al jugador y a la víctima animados (los
//     huesos se mueven ≥ 20 cm en la ejecución) y no ve al jugador ni al NPC quietos encima;
//  I. otro pack que agrega ejecuciones a BSMod (Ultimate Dropkick, Workshop 2561288661, con DROPKICK=URL de su .gma y
//     DROPKICK_GMA=su ruta en disco, para la referencia): lo mismo que E.
// uso: NODE_PATH=... node bsmod.mjs URL_HTML URL_GMA_ARMAS URL_GMA_PERSONAJES URL_GMA_NPC CARPETA [A,B,C,D,E,F,G,I]
//   (URL_GMA_*: carpetas servidas con <id>/<id>.gma; la de NPC con <id>.gma). SOLO=front_1,... para elegir ejecuciones;
//   VICTIMAS y JUGADORES (separados por coma) para elegir con quién; SIN_FOTOS=1 sin fotos; para G, BROKER_DIR=carpeta
//   con mc/broker (aedes y ws), como nextbots_red.mjs.
import { abrir } from './base.mjs';
import { createRequire } from 'module'; import http from 'http';
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const [, , HTML, GA, GC, GN, OUT = '/tmp/claude-0/bsmod', PARTES = 'A,B,C,D,E,F,G,I'] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const AQUI = path.dirname(new URL(import.meta.url).pathname), PARTE = new Set(PARTES.split(','));
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1500) : '')); };
const nota = (n, d) => console.log('NOTA  ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1500) : ''));
const BSMOD = '2106330193', PM = process.env.PM || '139247091', DRG = '1560118657';
// la referencia de GMod: los huesos de las dos animaciones de cada ejecución, del .mdl (herramientas/source_mdl.py)
// (y con DROPKICK_GMA —el .gma del Dropkick en disco—, también las de ese pack)
const REF = JSON.parse(execFileSync('python3', ['-I', AQUI + '/bsmod_ref.py', process.env.BSMOD_GMA || '/tmp/claude-0/gma_armas/2106330193/2106330193.gma'].concat(process.env.DROPKICK_GMA ? [process.env.DROPKICK_GMA] : []), { maxBuffer: 1 << 26 }).toString());

const preparar = async (s, celu) => {
  await s.ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); DIA.hora = 13; DIA.aplicada = -1; 1`);
  await s.p.waitForTimeout(1500); await s.p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 90000 });
  await s.ev(`window.esperaJuego = (t) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + t || performance.now() - r0 > 25000 ? ok() : setTimeout(f, 20)); f(); }); 1`);
  await s.ev(`window.lua = (src, lado) => { let r; gmaEnLado(lado || 'S', () => { try { r = GMA.R.c(GMA.R.cargar(String(src), 'prueba'), 'prueba'); } catch (e) { r = 'ERR ' + GMA.R.msgErr(e); } }); return r; }; 1`);
};
const instalar = (s, url, id) => s.ev(`(async () => { if (GMOD.addons.has('${id}')) return 1; const b = new Uint8Array(await (await fetch(${JSON.stringify(url)})).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, b); await A.listo; await esperaJuego(0.5); return 1; })()`);
// (qué ejecución sale: BSMod sortea la de frente con math.random(1, 2); la prueba la elige)
const elegir = (s) => s.ev(`(() => { const m = GMA.R.G.get('math'); if (!window.__r0) { window.__r0 = m.get('random'); m.set('random', (a, b) => (window.__forzar && a === 1 && b === 2 ? window.__forzar : window.__r0(a, b))); } return 1; })()`);
const fotos = {}; const foto = async (s, n, grupo) => { const f = OUT + '/' + n + '.png'; await s.p.screenshot({ path: f }); (fotos[grupo] || (fotos[grupo] = [])).push(f); return f; };
const hoja = (grupo, cols = 4) => { const L = fotos[grupo]; if (!L || !L.length) return; try { execFileSync('python3', ['-I', AQUI + '/bsmod_hoja.py', OUT + '/hoja_' + grupo + '.jpg', '480', String(cols), ...L]); } catch (e) { nota('hoja ' + grupo, String(e.message).slice(0, 200)); } };
// diferencia entre dos fotos en una caja (porcentaje de píxeles distintos)
const DIF = `async (a, b, caja) => { const im = async (x) => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + x)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d'); g.drawImage(bm, 0, 0); return { d: g.getImageData(0, 0, bm.width, bm.height).data, w: bm.width, h: bm.height }; };
  const IA = await im(a), A = IA.d, B = (await im(b)).d; let n = 0, tot = 0; const x0 = (caja[0] * IA.w) | 0, x1 = (caja[2] * IA.w) | 0, y0 = (caja[1] * IA.h) | 0, y1 = (caja[3] * IA.h) | 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * IA.w + x) * 4; tot++; if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) >= 40) n++; } return +(100 * n / tot).toFixed(3); }`;
const png = async (s) => (await s.p.screenshot({ type: 'png' })).toString('base64');
const dif = (s, a, b, caja) => s.p.evaluate(([f, a, b, c]) => eval(f)(a, b, c), [DIF, a, b, caja || [0, 0, 1, 1]]);
// (el escenario: sin NPC ni restos de otra ejecución, el jugador en el medio del mapa mirando +z, la cámara de prueba apagada)
const LIMPIAR = `(async () => { for (const P of [...NPC.lista]) npcQuitar(P); for (const e of [...GMA.ents.values()]) if (/^(ent_km_model|prop_ragdoll)$/.test(e.clase) || e.nb || (e.cs && e.vivo)) gmaQuitar(e);
  window.__camDbg = null; MODS.tiempo = 1; window.__forzar = 0; JUG.bloqueado = false; JUG.tercera = false; JUG.vivo = true; JUG.vida = 100; JUG.vehiculo = null; JUG.pos.set(0, JUG.pos.y, 0); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0.1; await esperaJuego(0.6); return 1; })()`;
// la cámara de prueba (de costado, de atrás, de cerca): después de la del juego y de CalcView
const CAMARA = `(() => { if (!window.__vl0) { window.__vl0 = gmaVistaLua; gmaVistaLua = (C) => { window.__vl0(C); const d = window.__camDbg; if (d) { const m = typeof d.m === 'function' ? d.m() : d.m, p = typeof d.p === 'function' ? d.p() : d.p; C.pos.copy(p); const v = vsub(m, p).norm(); C.q.copy(Quat.euler(Math.atan2(v.x, v.z), -Math.asin(clamp(v.y, -1, 1)))); } }; } return 1; })()`;

// ---- A. montar ----
let s = await abrir(HTML); await s.p.setViewportSize({ width: 960, height: 540 }); await preparar(s);
await s.ev(CAMARA);
const e0 = await s.ev(`GMA.errores.length`);
await instalar(s, `${GA}/${BSMOD}/${BSMOD}.gma`, BSMOD); await elegir(s);
if (PARTE.has('A')) {
  const hab = await s.ev(`(() => { const A = GMOD.addons.get('${BSMOD}'); A._gmbHab = null; return gmbHabilidades(A).map((h) => [h.k, h.acc && h.acc.id]); })()`);
  ok('A1. BSMod monta sin errores de Lua', (await s.ev(`GMA.errores.length`)) === e0, await s.ev(`GMA.errores.slice(${e0}).slice(0, 4)`));
  ok('A2. sus comandos son habilidades: bsmod_kick (patada) y bsmod_killmove (ejecutar, contextual)', hab.some((h) => h[0] === 'cmd:bsmod_kick' && h[1] === 'patada') && hab.some((h) => h[0] === 'cmd:bsmod_killmove' && h[1] === 'ejecutar'), hab);
}

// ---- B. el puño ----
if (PARTE.has('B')) {
  await s.ev(LIMPIAR);
  await s.ev(`(async () => { gmaSpawnMenu('gmswep:weapon_bsmod_punch'); await esperaJuego(2.5); return 1; })()`);
  const enMano = await s.ev(`!!(GMA.swep && GMA.swep.clase === 'weapon_bsmod_punch' && ARM.v && ARM.v.gm)`);
  // quieto: con y sin la vista
  // (la foto es la de con vista: la de después se sacaba un cuadro antes de que se volviera a dibujar)
  let visA = null; const fotoVis = (n) => { const f = OUT + '/' + n + '.png'; fs.writeFileSync(f, Buffer.from(visA, 'base64')); (fotos.puno || (fotos.puno = [])).push(f); };
  const vis = async () => { const a = await png(s); visA = a; await s.ev(`(async () => { window.__dv = dibujarVista; dibujarVista = () => false; await esperaJuego(0.05); return 1; })()`); const b = await png(s); await s.ev(`(() => { dibujarVista = window.__dv; return 1; })()`); return dif(s, a, b, [0, 0.2, 1, 1]); };
  await s.ev(`(() => { MODS.tiempo = 0.04; return 1; })()`);
  const quieto = await vis(); fotoVis('puno_quieto');
  // en el golpe (el cuadro del brazo estirado: fist_leftpunch, cuadro 9 de 19 a 65 por segundo)
  // (cuando el arma ya puede pegar —si no, el clic no hace nada y quedaba la de quieto—, y hasta que la vista esté en el golpe)
  await s.ev(`(async () => { MODS.tiempo = 1; while (GMA.swep && TIEMPO.t < (GMA.swep.nextP || 0)) await esperaJuego(0.05); MODS.tiempo = 0.04;
    const clip = () => (ARM.v && ARM.v.clip ? Object.keys(DATA.anPorNombre).find((k) => DATA.anPorNombre[k] === ARM.v.clip) || '' : '');
    ENT.disparo = true; const t0 = TIEMPO.t; while (TIEMPO.t - t0 < 0.02) await new Promise((r) => requestAnimationFrame(r)); ENT.disparo = false;
    const r0 = performance.now(); while (!(/punch/.test(clip()) && ARM.v.t >= 0.135) && performance.now() - r0 < 60000) await new Promise((r) => requestAnimationFrame(r)); MODS.tiempo = 0; return clip(); })()`);
  const golpe = await vis(); fotoVis('puno_golpe');
  await s.ev(`(async () => { MODS.tiempo = 1; await esperaJuego(0.6); MODS.tiempo = 0.04; ENT.teclas.add('KeyR'); for (let i = 0; i < 30 && !(ARM.v && /blocking/.test(Object.keys(DATA.anPorNombre).find((k) => DATA.anPorNombre[k] === ARM.v.clip) || '')); i++) await new Promise((r) => requestAnimationFrame(r)); await esperaJuego(0.02); return 1; })()`);
  const guardia = await vis(); fotoVis('puno_guardia');
  await s.ev(`(async () => { ENT.teclas.delete('KeyR'); MODS.tiempo = 1; await esperaJuego(0.8); return 1; })()`);
  ok('B1. el puño en la mano, con su vista c_limbs y las manos del jugador', enMano);
  ok('B2. el golpe se ve en 1ª persona (≥ 1 % de la pantalla) y en guardia (R) también', golpe >= 1 && guardia >= 1, { quieto, golpe, guardia });
  nota('B2. quieto, como en GMod, los puños quedan bajo el borde de la vista (–25,5° con ±20,9° de campo)', { quieto });
  // daño: un NPC y una caja delante
  const dan = await s.ev(`(async () => { const fw = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(); const P = npcCrear('Hero', v3(JUG.pos.x + fw.x * 1.1, JUG.pos.y, JUG.pos.z + fw.z * 1.1), JUG.yaw + Math.PI, { modo: 'quieto', vida: 100 }); await esperaJuego(1.2);
    const e = gmaEntPersona(P); const v0 = P.vida; JUG.pitch = 0.12; await esperaJuego(0.3); const t0 = TIEMPO.t; while (GMA.swep && TIEMPO.t < (GMA.swep.nextP || 0)) await esperaJuego(0.05); ENT.disparo = true; await esperaJuego(0.05); ENT.disparo = false; await esperaJuego(0.6);
    const v1 = P.vida; npcQuitar(P); await esperaJuego(0.3);
    const o = crearObjeto('Crate', v3(CAM.pos.x + fw.x * 1.1, CAM.pos.y - 0.2, CAM.pos.z + fw.z * 1.1)); o.b.frozen = true; await esperaJuego(0.3); const d = vsub(o.b.pos, CAM.pos); JUG.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); await esperaJuego(0.2);
    let n = 0; const O = { dO: danarObjeto, dB: gmaDanoBala }; danarObjeto = (x, ...a) => { if (x === o) n++; return O.dO(x, ...a); }; gmaDanoBala = (h, ...a) => { if (h && h.body === o.b) n++; return O.dB(h, ...a); };
    while (GMA.swep && TIEMPO.t < (GMA.swep.nextS || 0)) await esperaJuego(0.05); ENT.disparo2 = true; await esperaJuego(0.05); ENT.disparo2 = false; await esperaJuego(0.6); danarObjeto = O.dO; gmaDanoBala = O.dB; if (OBJS.includes(o)) borrarObjeto(o);
    return { npc: v0 - v1, caja: n }; })()`);
  ok('B3. el puño le saca 10–15 de vida a un NPC y le pega a una caja', dan.npc >= 10 && dan.npc <= 15 && dan.caja > 0, dan);
  hoja('puno', 3);
}

// ---- C. la patada ----
if (PARTE.has('C')) {
  await s.ev(LIMPIAR);
  const r = await s.ev(`(async () => { JUG.pitch = 0.05; await esperaJuego(0.5); return 1; })()`);
  const sin = await png(s);
  await s.ev(`(async () => { MODS.tiempo = 0.15; gmaConsola2('bsmod_kick'); const t0 = TIEMPO.t; while (TIEMPO.t - t0 < 0.22) await new Promise((r) => requestAnimationFrame(r)); MODS.tiempo = 0; return 1; })()`);
  const con = await png(s); await foto(s, 'patada_pierna', 'patada');
  const pierna = await dif(s, con, sin, [0, 0.35, 1, 1]);
  const dan = await s.ev(`(async () => { MODS.tiempo = 1; await esperaJuego(1.2); const fw = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(); const P = npcCrear('Hero', v3(JUG.pos.x + fw.x * 1.2, JUG.pos.y, JUG.pos.z + fw.z * 1.2), JUG.yaw + Math.PI, { modo: 'quieto', vida: 100 }); await esperaJuego(1.2);
    JUG.pitch = 0.15; await esperaJuego(0.3); const v0 = P.vida; gmaConsola2('bsmod_kick'); await esperaJuego(1.4); const v1 = P.vida; const legs = [...GMA.ents.values()].filter((x) => x.cs && x.vivo).length; npcQuitar(P); return { npc: v0 - v1, cs: legs }; })()`);
  ok('C1. la pierna de la patada se ve en 1ª persona (≥ 1 % de la mitad de abajo)', pierna >= 1, { pierna });
  ok('C2. la patada le saca 10–15 de vida a un NPC y las piernas se van al terminar', dan.npc >= 10 && dan.npc <= 15 && dan.cs === 0, dan);
  // (y a una caja: BSMod patea con FireBullets —75 unidades, fuerza 20—; cuánto la mueve queda anotado)
  const caja = await s.ev(`(async () => { const fw = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(); const o = crearObjeto('Crate', v3(CAM.pos.x + fw.x * 1.0, CAM.pos.y - 0.6, CAM.pos.z + fw.z * 1.0)); await esperaJuego(1); const d = vsub(o.b.pos, CAM.pos); JUG.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); await esperaJuego(0.3);
    let n = 0; const O = { dO: danarObjeto, dB: gmaDanoBala }; danarObjeto = (x, ...a) => { if (x === o) n++; return O.dO(x, ...a); }; gmaDanoBala = (h, ...a) => { if (h && h.body === o.b) n++; return O.dB(h, ...a); };
    const p0 = o.b.pos.clone(); gmaConsola2('bsmod_kick'); await esperaJuego(1.6); danarObjeto = O.dO; gmaDanoBala = O.dB; const mov = o.b.pos.distTo(p0); if (OBJS.includes(o)) borrarObjeto(o); return { golpes: n, mov: +(mov * 100).toFixed(1) }; })()`);
  ok('C3. la patada le pega a una caja (le hace daño)', caja.golpes >= 1, caja);
  hoja('patada', 2);
}

// ---- D. ejecutable ----
const ponerNPC = (skin, giro, dist) => s.ev(`(async () => { const fw = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), sk = ${JSON.stringify(skin)};
  if (/^gmpm:/.test(sk)) { const r = sk.slice(5); if (!gmArchivo(r)) gmlPedir(r); for (let i = 0; i < 120 && !gmpDef(r); i++) { for (const x of ['.vvd', '.dx90.vtx']) { const f = r.replace('.mdl', x); if (gmExiste(f) && !gmArchivo(f)) gmlPedir(f); } await esperaJuego(0.25); } }
  let P;
  if (/^npc_/.test(sk)) { JUG.pitch = 0.05; const e = gmnpcCrear(sk); for (let i = 0; i < 80 && e && !e.o; i++) await esperaJuego(0.25); window.__V = e; window.__P = null;
    if (e) { const p = vadd(v3(JUG.pos.x, JUG.pos.y - JUG.medio - JUG.radio, JUG.pos.z), vscale(fw, ${dist || 1.6})); GMA.metas.Entity.get('SetPos')(e, GMA.V(p)); const a = new LAng(0, quatAng(Quat.axis(0, 1, 0, JUG.yaw + Math.PI + ${giro || 0})).y, 0); a.__mt = GMA.mtAng; GMA.metas.Entity.get('SetAngles')(e, a); }
    await esperaJuego(0.3); return !!e; }
  P = npcCrear(sk, v3(JUG.pos.x + fw.x * ${dist || 1.6}, JUG.pos.y, JUG.pos.z + fw.z * ${dist || 1.6}), JUG.yaw + Math.PI + ${giro || 0}, { modo: 'quieto', vida: 100 }); window.__P = P; window.__V = gmaEntPersona(P);
  for (let i = 0; i < 40 && P.gmpRuta && !P.gmp; i++) await esperaJuego(0.25); await esperaJuego(1.2); return true; })()`);
if (PARTE.has('D')) {
  await s.ev(LIMPIAR);
  await s.ev(`(async () => { gmaSpawnMenu('gmswep:weapon_bsmod_punch'); await esperaJuego(2.2); lua('RunConsoleCommand("bsmod_killmove_chance", "1")'); gmaConsola2('bsmod_killmove_chance 1'); return 1; })()`);
  await ponerNPC('Hero', 0, 1.1);
  const r = await s.ev(`(async () => { const P = window.__P, e = window.__V; JUG.pitch = 0.12; await esperaJuego(0.3); const v0 = P.vida; let n = 0;
    while (!(e.tabla.get('killMovable')) && P.vivo !== false && n < 20) { while (GMA.swep && TIEMPO.t < (GMA.swep.nextP || 0)) await esperaJuego(0.05); ENT.disparo = true; await esperaJuego(0.05); ENT.disparo = false; await esperaJuego(0.4); n++; }
    const km = !!e.tabla.get('killMovable'), vida = P.vida, p0 = P.pos.clone(); await esperaJuego(1); const mov = P.pos.distTo(p0);
    const halo = !!(P.md.haloC && P.md.haloC[2] > 0.9 && P.md.haloC[0] < 0.1 && TIEMPO.t - P.md.haloT < 0.3);
    const listo = gmanApuntaResaltada(100); const btn = gmbCmdTecla(ctlTeclaDe('usar')); JUG.yaw = 1.3; await esperaJuego(0.3); const fuera = gmanApuntaResaltada(100); JUG.yaw = 0; await esperaJuego(0.3);
    return { golpes: n, km, vida, mov: +(mov * 100).toFixed(2), halo, listo, tecla: !!btn, fuera, congelado: !!P.gmCongelado }; })()`);
  await foto(s, 'ejecutable_halo', 'halo');
  ok('D1. golpeado hasta ≤ 25 de vida queda ejecutable (bsmod_killmove_chance 1)', r.km && r.vida <= 25 && r.vida > 0, r);
  ok('D2. ejecutable: quieto (≤ 1 cm en 1 s) y resaltado de azul (halo.Add)', r.congelado && r.mov <= 1 && r.halo, r);
  ok('D3. la ejecución está lista sólo apuntándole (y la tecla de usar la hace en la compu)', r.listo && r.tecla && !r.fuera, r);
  // la tecla de usar (E): la ejecución
  const e2 = await s.ev(`(async () => { const ev = new KeyboardEvent('keydown', { code: ctlTeclaDe('usar'), key: 'e', bubbles: true }); dispatchEvent(ev); await esperaJuego(0.1); const b = !!JUG.bloqueado; dispatchEvent(new KeyboardEvent('keyup', { code: ctlTeclaDe('usar'), key: 'e', bubbles: true })); await esperaJuego(3); return { bloq: b, libre: !JUG.bloqueado, muerto: window.__P.vivo === false }; })()`);
  ok('D4. con la E (usar) apuntándole, la ejecución arranca y termina', e2.bloq && e2.libre && e2.muerto, e2);
  hoja('halo', 1);
}

// ---- E. las ejecuciones ----
// cada caso: [nombre de la secuencia, cómo poner al NPC (giro respecto de mirar al jugador), elegir (1/2 para las de frente), en el aire]
const CASOS = [['killmove_front_1', 0, 1], ['killmove_front_2', 0, 2], ['killmove_back_1', Math.PI, 0], ['killmove_left_1', -Math.PI / 2, 0], ['killmove_right_1', Math.PI / 2, 0], ['killmove_front_air_1', 0, 0, true]];
const VICTIMAS = (process.env.VICTIMAS || 'Hero,gmpm:models/zombie/classic.mdl,gmpm:models/combine_soldier.mdl,npc_drg_zombie').split(',');
const SOLO = process.env.SOLO ? new Set(process.env.SOLO.split(',').map((x) => 'killmove_' + x)) : null;
const MEDIR = fs.readFileSync(AQUI + '/bsmod_medir.js', 'utf8');
const resE = [];
// una ejecución: poner a la víctima, dejarla ejecutable, medirla (kmMedir) contra lo esperado y, si toca, las fotos.
// o: { tag, jug, vic, sec, giro, forzar, aire, dist, fotos, extra (de otro pack: sin la referencia de BSMod) }
const PONER = (forzar, giro) => `(async () => { window.__forzar = ${forzar || 0}; GMA.R.G.set('__KV', window.__V); lua('__KV:SetHealth(20) __KV:SetKillMovable(true)'); await esperaJuego(0.3);
  // (un NPC del juego: que ya esté congelado —BSMod lo congela en el cuadro siguiente— antes de girarlo; si no, se da vuelta solo)
  for (let i = 0; i < 20 && window.__P && !window.__P.gmCongelado; i++) await esperaJuego(0.1);
  kmGirar(${giro}); await esperaJuego(0.2);
  // (a un nextbot se le apunta al medio del cuerpo, como haría el jugador: el zombi de DrGBase va agachado y la mira a la
  // altura de los ojos le pasa por arriba)
  if (!window.__P) { const c0 = lua('return __KV:WorldSpaceCenter()'), c = vG(Array.isArray(c0) ? c0[0] : c0), d = vsub(c, CAM.pos); JUG.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); await esperaJuego(0.2); }
  return 1; })()`;
const SALTAR = `(async () => { JUG.vel.y = 5.5; JUG.suelo = false; JUG.pos.y += 0.05; await new Promise((r) => requestAnimationFrame(r)); await new Promise((r) => requestAnimationFrame(r)); return JUG.suelo; })()`;
async function caso(o) {
  const { tag, jug, vic, sec, giro, forzar, aire, dist } = o, ref = REF[sec] || null, PARTE_N = o.extra ? 'I' : 'E';
  try {
    await s.ev(LIMPIAR); await ponerNPC(vic, giro, dist); await s.ev(PONER(forzar, giro));
    const arma0 = await s.ev(`ARM.lista[ARM.i]`);
    // (en el aire: el jugador salta y la ejecución arranca en la subida)
    if (aire) await s.ev(SALTAR);
    const r = await s.ev(`kmMedir(${JSON.stringify({ sec, ref, tag })})`);
    r.arma = r.armaFin === arma0; r.tag = tag; r.jug = jug; r.vic = vic; resE.push(r);
    const L = [];
    if (!r.empezo) L.push('no empezó');
    else {
      if (r.sec !== sec) L.push('otra secuencia: ' + r.sec);
      if (!(Math.abs(r.durJug - r.durEsperada) <= 0.1)) L.push(`jugador libre a ${r.durJug} s (esperado ${r.durEsperada})`);
      if (!(Math.abs(r.muere - r.muereEsperada) <= 0.12)) L.push(`víctima muere a ${r.muere} s (esperado ${r.muereEsperada})`);
      if (r.ref && !(r.ref.max <= 2)) L.push('esqueleto ≠ GMod: ' + r.ref.max + ' u');
      if (!(r.dibujo <= 0.5)) L.push('lo dibujado no va en el esqueleto: ' + r.dibujo + ' cm');
      if (r.ref && r.contacto !== null && r.ref.contacto !== null && !(Math.abs(r.contacto - r.ref.contacto) <= 3)) L.push(`golpe a ${r.contacto} u (GMod ${r.ref.contacto})`);
      if (!(r.torsos >= Math.min(15, r.ref ? r.ref.torsos - 2 : 15))) L.push('se atraviesan: torsos a ' + r.torsos + ' cm');
      if (r.ref && !(Math.abs(r.pieMin - r.ref.pieMin) <= 4)) L.push(`pie más bajo ${r.pieMin} cm (GMod ${r.ref.pieMin})`);
      if (!(r.salto <= 5)) L.push('un hueso salta ' + r.salto + ' cm (' + r.saltoHueso + ')');
      if (!(r.camara <= 1)) L.push('la cámara no está en los ojos: ' + r.camara + ' cm');
      if (!r.libre || !r.piso) L.push('el jugador no quedó libre en el piso: ' + JSON.stringify(r.fin));
      if (!r.arma) L.push('no volvió el arma: ' + r.armaFin + ' (era ' + arma0 + ')');
      if (r.restos) L.push('quedaron ' + r.restos + ' entidades de la ejecución');
      if (!r.muneco) L.push('la víctima no quedó tirada: ' + JSON.stringify(r.munecoD));
      if (r.errLua.length) L.push('errores de Lua: ' + r.errLua[0]);
    }
    if (r.saltoTrans) nota(`${PARTE_N}. ${tag}: el cambio del NPC por su modelo animado al empezar (como en GMod: BSMod lo esconde y pone otro en la primera pose de la animación)`, { cm: r.saltoTrans });
    ok(`${PARTE_N}. ${tag}`, !L.length, { motivo: L.join('; '), durJug: r.durJug, durSec: r.durSec, muere: r.muere, ref: r.ref && r.ref.max, dibujo: r.dibujo, contacto: [r.contacto, r.ref && r.ref.contacto], torsos: r.torsos, pie: [r.pieMin, r.ref && r.ref.pieMin], salto: r.salto, saltoTrans: r.saltoTrans, camara: r.camara, fin: r.fin, rag: r.munecoD });
    // las fotos: desde la cámara del jugador a lo largo de la ejecución, y de costado, de atrás y de cerca
    if (!process.env.SIN_FOTOS && o.fotos) {
      for (const vista of ['real', 'lado'].concat(/front_1|back|front$/.test(sec) ? ['atras', 'cerca'] : [])) {
        await s.ev(LIMPIAR); await ponerNPC(vic, giro, dist); await s.ev(PONER(forzar, giro));
        if (aire) await s.ev(SALTAR);
        await s.ev(`kmFotoEmpezar(${JSON.stringify(vista)})`);
        const dur = r.durEsperada || 1.5;
        for (const f of [0.02, 0.25, 0.5, 0.75, 1.0].map((k) => k * dur).concat([dur + 0.3])) {
          await s.ev(`kmFotoHasta(${f})`); await foto(s, `${tag}_${vista}_${f.toFixed(2)}`, tag);
        }
        await s.ev(`(() => { MODS.tiempo = 1; window.__camDbg = null; return 1; })()`); await s.ev(`esperaJuego(2.5)`);
      }
      hoja(tag, 6);
    }
  } catch (e) { ok(`${PARTE_N}. ${tag}`, false, 'se cortó: ' + String(e.message || e).slice(0, 300)); try { await s.b.close(); } catch (x) {} s = await abrir(HTML); await s.p.setViewportSize({ width: 960, height: 540 }); await preparar(s); await s.ev(CAMARA); await instalar(s, `${GA}/${BSMOD}/${BSMOD}.gma`, BSMOD); await elegir(s); await s.ev(MEDIR + '; 1'); }
}
const ponerJugador = async (jug) => {
  await s.ev(LIMPIAR);
  if (jug.startsWith('gm:')) { await instalar(s, `${GC}/${jug.slice(3)}/${jug.slice(3)}.gma`, jug.slice(3)); await s.ev(`(async () => { const A = GMOD.addons.get('${jug.slice(3)}'), L = gmpLista().filter((r) => A.G.archivos.has(r)); PREFS.skin = 'gmpm:' + L[0]; jugadorCuerpoNuevo(); await esperaJuego(1.5); return L[0]; })()`); }
  else await s.ev(`(async () => { PREFS.skin = '${jug}'; jugadorCuerpoNuevo(); await esperaJuego(0.8); return 1; })()`);
};
if (PARTE.has('E')) {
  await s.ev(MEDIR + '; 1');
  if (VICTIMAS.some((v) => /^npc_drg/.test(v))) await instalar(s, `${GN}/${DRG}.gma`, DRG);
  for (const jug of (process.env.JUGADORES || 'Hero,gm:' + PM).split(',')) {
    await ponerJugador(jug);
    for (const vic of VICTIMAS) for (const [sec, giro, forzar, aire] of CASOS) {
      if (SOLO && !SOLO.has(sec)) continue;
      if (jug !== 'Hero' && vic !== 'Hero' && !/front_1|back/.test(sec)) continue;   // (con el modelo de GMod: las dos que más se usan)
      // (con el nextbot, las dos de frente: BSMod no congela a los nextbots —SetCondition es de los NPC, igual en GMod— y el de
      // DrGBase te persigue mirándote, así que la de costado sale de frente también en GMod)
      if (/^npc_/.test(vic) && !/front_[12]/.test(sec)) continue;
      const tag = `${sec.replace('killmove_', '')}_${jug.replace(/[^a-z0-9]+/gi, '')}_${vic.replace(/^gmpm:models\//, '').replace(/[^a-z0-9]+/gi, '')}`;
      await caso({ tag, jug, vic, sec, giro, forzar, aire, dist: sec === 'killmove_right_1' ? 1.4 : 1.6, fotos: (jug === 'Hero' && vic === 'Hero') || /front_1/.test(sec) });
    }
  }
}
// ---- I. otro pack de ejecuciones: [BSMod] Ultimate Dropkick Killmove (Workshop 2561288661, el más usado de los que agregan
// ejecuciones a BSMod: unos 329 mil suscriptos). Usa el gancho CustomKillMoves de BSMod con sus propios .mdl (c_limbs_pix_
// dropkick y bsmodimations_pix_dropkick) y sus sonidos; la de frente y la de atrás piden estar a más de 70 unidades. Lo
// mismo que E (DROPKICK = URL de su .gma; con DROPKICK_GMA, su ruta en disco, también contra GMod cuadro a cuadro)
if (PARTE.has('I') && process.env.DROPKICK) {
  await s.ev(MEDIR + '; 1'); await ponerJugador('Hero');
  await instalar(s, process.env.DROPKICK, '2561288661'); await s.ev(`(async () => { gmaConsola2('bsmod_dpkick_chance 4'); await esperaJuego(0.3); return 1; })()`);
  for (const vic of ['Hero', 'gmpm:models/combine_soldier.mdl']) for (const [sec, giro, dist] of [['km_dpkick_front', 0, 2.2], ['km_dpkick_back', Math.PI, 2.2], ['km_dpkick_left', -Math.PI / 2, 1.5], ['km_dpkick_right', Math.PI / 2, 1.5]]) {
    const tag = `${sec}_${vic.replace(/^gmpm:models\//, '').replace(/[^a-z0-9]+/gi, '')}`;
    await caso({ tag, jug: 'Hero', vic, sec, giro, forzar: 0, aire: false, dist, fotos: vic === 'Hero' && /front|left/.test(sec), extra: true });
  }
}
if (resE.length) fs.writeFileSync(OUT + '/ejecuciones.json', JSON.stringify(resE, null, 1));
const jsErr = s.err.filter((x) => !/WebSocket|mqtt|Failed to load|ERR_|favicon|404|409/i.test(x) && (!/^(warning|error): /.test(x) || /TypeError|ReferenceError|RangeError|is not a function|Cannot read/.test(x)));
ok('H. sin errores de JS', !jsErr.length, jsErr.slice(0, 4));
await s.b.close();

// ---- F. celular ----
if (PARTE.has('F')) {
  const c = await abrir(HTML, true); await preparar(c, true); s = c; await s.ev(CAMARA);
  await s.ev(`(() => { localStorage.removeItem('rb_gmb_auto'); localStorage.removeItem('rb_gmb_fijos'); GMB.fijos = []; ENT.tactil = true; return 1; })()`);
  await instalar(s, `${GA}/${BSMOD}/${BSMOD}.gma`, BSMOD); await elegir(s); await s.ev(`esperaJuego(1)`);
  const fij = await s.ev(`GMB.fijos.map((f) => f.k)`);
  await s.ev(LIMPIAR); await ponerNPC('Hero', 0, 1.6);
  const bt = `(() => { const d = [...document.querySelectorAll('.gbFijo')].find((x) => x._f && x._f.k === 'cmd:bsmod_killmove'); if (!d) return null; const r = d.getBoundingClientRect(); return { oc: d.classList.contains('oc'), w: r.width, x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`;
  const sinK = await s.ev(bt); await foto(s, 'celu_sin', 'celu');
  await s.ev(`(async () => { GMA.R.G.set('__KV', window.__V); lua('__KV:SetHealth(20) __KV:SetKillMovable(true)'); await esperaJuego(0.5); return 1; })()`);
  const conK = await s.ev(bt); await foto(s, 'celu_listo', 'celu');
  let hizo = null;
  if (conK && !conK.oc) { await s.p.touchscreen.tap(conK.x, conK.y); hizo = await s.ev(`(async () => { await esperaJuego(0.2); const b = !!JUG.bloqueado; await esperaJuego(0.5); return b; })()`); await foto(s, 'celu_ejecucion', 'celu'); await s.ev(`esperaJuego(2.5)`); }
  ok('F1. en el celu, al montar BSMod se fijan los botones de la patada y la ejecución', fij.includes('cmd:bsmod_kick') && fij.includes('cmd:bsmod_killmove'), fij);
  ok('F2. el botón de la ejecución está oculto sin a quién y aparece apuntándole a un NPC ejecutable', !!sinK && sinK.oc && !!conK && !conK.oc && conK.w > 20, { sinK, conK });
  ok('F3. tocarlo hace la ejecución', hizo === true, { hizo });
  hoja('celu', 3);
  await s.b.close();
}

// ---- G. multijugador ----
if (PARTE.has('G')) {
  const S = process.env.BROKER_DIR || '/tmp/claude-0/-home-user-Ports/eeadafdf-53e8-5696-a49a-cc5a848c1abe/scratchpad', req = createRequire(S + '/mc/broker/package.json');
  const PUERTO = +(process.env.PUERTO || 18975);
  const aedes = req('aedes')(); const { WebSocketServer, createWebSocketStream } = req('ws');
  const srv = http.createServer(); const wss = new WebSocketServer({ server: srv, path: '/mqtt' }); wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
  await new Promise((r) => srv.listen(PUERTO, '127.0.0.1', r));
  const url = HTML + (HTML.includes('?') ? '&' : '?') + 'test&broker=ws://127.0.0.1:' + PUERTO + '/mqtt';
  const entrar = (P, n) => P.ev(`PREFS.nombre='${n}'; PREFS.lang='es'; PREFS.bienvenida=true; PREFS.tutVisto=true; PREFS.gfx='patata'; GFX.auto=false; aplicarGfx(); audioIniciar(); inicioMostrar(false); conectarMultijugador(); entrarSala(SALAS_OF.find((s) => s.m === 'FlatGrass')); 1`);
  const hasta = async (P, cond, seg) => { for (let i = 0; i < seg * 4; i++) { if (await P.ev(cond)) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };
  const A = await abrir(url); const B = await abrir(url);
  for (const P of [A, B]) await P.ctx.route('**/api/gmod/sala/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"l":[]}' }));
  await entrar(A, 'Ana'); await entrar(B, 'Beto');
  const juntos = (await hasta(A, `MUNDO.nombre === 'FlatGrass' && RED.remotos.size === 1 && JUG.suelo`, 90)) && (await hasta(B, `MUNDO.nombre === 'FlatGrass' && RED.remotos.size === 1 && JUG.suelo`, 90));
  for (const P of [A, B]) { await P.ev(`window.esperaJuego = (t) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + t || performance.now() - r0 > 25000 ? ok() : setTimeout(f, 20)); f(); }); window.lua = (src) => { let r; gmaEnLado('S', () => { try { r = GMA.R.c(GMA.R.cargar(String(src), 'prueba'), 'prueba'); } catch (e) { r = 'ERR ' + GMA.R.msgErr(e); } }); return r; }; SALA.pvp = 0; 1`); }
  // (los .gma de visita salen de la carpeta de prueba)
  // (y lo que diría Steam de él: la página de prueba no tiene salida a internet)
  await B.ev(`(() => { gmBajar = async (w) => { const r = await fetch(${JSON.stringify(GA)} + '/' + w + '/' + w + '.gma'); if (!r.ok) throw new Error('no ' + w); return new Uint8Array(await r.arrayBuffer()); };
    gmDetalles = async (ids) => new Map(ids.map((i) => [String(i), { title: 'BSMod', file_size: 13e6, tags: [] }])); return 1; })()`);
  s = A; await instalar(A, `${GA}/${BSMOD}/${BSMOD}.gma`, BSMOD); await elegir(A);
  // Ana y su NPC a la vista de Beto (Beto a 5 m de costado, mirándolos)
  // (la ejecución de Ana: KMCheck hasta que arranque —recién puesta en la sala, la primera traza a veces no le da—)
  const KM = `(async () => { for (let i = 0; i < 10 && !JUG.bloqueado; i++) { lua('KMCheck(player.GetAll()[1])'); await esperaJuego(0.1); } return JUG.bloqueado; })()`;
  const ponerA = `(async () => { for (const P of [...NPC.lista]) npcQuitar(P); JUG.pos.set(0, JUG.pos.y, 0); JUG.yaw = 0; JUG.pitch = 0.1; await esperaJuego(0.5); for (let i = 0; i < 60 && !JUG.suelo; i++) await esperaJuego(0.1); const P = npcCrear('Hero', v3(0, JUG.pos.y, 1.6), Math.PI, { modo: 'quieto', vida: 100 }); window.__P = P; await esperaJuego(1.5); GMA.R.G.set('__KV', gmaEntPersona(P)); lua('__KV:SetHealth(20) __KV:SetKillMovable(true)'); window.__forzar = 1; await esperaJuego(0.5); return 1; })()`;
  await A.ev(ponerA);
  await B.ev(`(async () => { JUG.pos.set(5, JUG.pos.y, 0.8); JUG.yaw = -Math.PI / 2; JUG.pitch = 0.15; await esperaJuego(2); return 1; })()`);
  // (la primera vez Beto no tiene BSMod: lo baja como visita —los .mdl de las animaciones— mientras ve la primera ejecución;
  // mientras tanto no se dibuja nada en su lugar. Se mide la segunda, con todo ya bajado)
  const arranco1 = await A.ev(KM);
  const bajo = await B.ev(`(async () => { const r0 = performance.now(); let caja = false; while (performance.now() - r0 < 120000) { const L = [...GMA.ents.values()].filter((e) => e.anRem && e.vivo); if (L.some((e) => !gmanDefDe(e))) caja = true; if (GMOD.addons.has('${BSMOD}') && L.every((e) => gmanDefDe(e))) break; await esperaJuego(0.1); } return { seg: +((performance.now() - r0) / 1000).toFixed(1), visita: GMOD.addons.has('${BSMOD}') }; })()`);
  await A.ev(`(async () => { await esperaJuego(3); return 1; })()`); await A.ev(ponerA); await B.ev(`esperaJuego(1)`);
  const arranco2 = await A.ev(KM);
  // Beto mira: los títeres animados y lo que no se tiene que ver
  const mBp = B.ev(`(async () => { const out = []; const t0 = TIEMPO.t; let mov = 0, ant = null;
    while (TIEMPO.t - t0 < 1.6) { await esperaJuego(0.1); const L = [...GMA.ents.values()].filter((e) => e.anRem && e.vivo);
      const ana = [...RED.remotos.values()][0], npc = [...NPC.rem.values()][0];
      const pos = []; for (const e of L) { const H = gmanHuesos(e); if (H) for (let i = 1; i < H.W.length; i += 7) pos.push([H.W[i][12], H.W[i][13], H.W[i][14]]); }
      if (ant && ant.length === pos.length) for (let i = 0; i < pos.length; i++) mov = Math.max(mov, Math.hypot(pos[i][0] - ant[i][0], pos[i][1] - ant[i][1], pos[i][2] - ant[i][2]));
      ant = pos; out.push({ t: +(TIEMPO.t - t0).toFixed(2), n: L.length, anaVis: !!(ana && ana.P && ana.P.visible), npcOc: !!(npc && npc.P.gmOculto), npcVivo: !!(npc && npc.P.vivo !== false && !npc.P.rag), modelos: L.map((e) => e.modelo), dib: L.map((e) => { const d = gmanDefDe(e); return [e.modelo.split('/').pop(), d ? (d.conMalla ? 'malla' : 'esq') + (d.gp ? '+gp' : '') : 'sinDef', e.noDraw ? 'oculto' : '', e.efectos & 1 ? 'bm' : '', gmaPrefabCS(e.modelo) || '']; }) }); }
    return { out, mov: +(mov * 100).toFixed(1) }; })()`);
  // (una foto de lo que ve Beto en medio de la ejecución)
  await new Promise((r) => setTimeout(r, 2500)); await B.p.screenshot({ path: OUT + '/red_beto.png' }); const mB = await mBp;
  const conTiteres = mB.out.filter((x) => x.n >= 3);
  ok('G0. Ana y Beto en el mismo server, y Beto baja BSMod como visita al ver la primera ejecución', juntos && arranco1 && arranco2 && bajo.visita, { ...bajo, arranco1, arranco2 });
  nota('G. lo que dibuja Beto de cada títere (modelo, malla, oculto, bonemerge, modelo quieto de reemplazo)', mB.out.find((x) => x.n >= 3)?.dib);
  ok('G1. Beto ve la ejecución de Ana: las entidades animadas (≥ 3: los dos esqueletos y sus modelos) y se mueven (≥ 20 cm)', conTiteres.length >= 5 && mB.mov >= 20, { muestras: mB.out.length, conTiteres: conTiteres.length, mov: mB.mov, modelos: mB.out.find((x) => x.n)?.modelos });
  // (el NPC, mientras está vivo: al morir queda su muñeco a la vista, como en GMod)
  const malG2 = conTiteres.filter((x) => x.anaVis || (x.npcVivo && !x.npcOc));
  ok('G2. mientras tanto Beto no ve a Ana ni al NPC quietos encima', !malG2.length, { mal: malG2.slice(0, 4).map((x) => ({ t: x.t, anaVis: x.anaVis, npcOc: x.npcOc, npcVivo: x.npcVivo })), muestras: conTiteres.length });
  await A.b.close(); await B.b.close(); srv.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
process.exit(R.every(Boolean) ? 0 : 1);
