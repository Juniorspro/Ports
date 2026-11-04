// NPCs agresivos con armas y NPCs amigos que te defienden (idea de Discord). En gm_flatgrass, con el jugador quieto:
//  1. el lector local entiende el arma y la defensa ("agresivo con escopeta", "un amigo que me defienda con un rifle",
//     "guardaespaldas") y lo de antes sigue igual ("que me siga", "guardia que vigile", "zombie que persiga")
//  2. un hostil con pistola a 15 m: tiene la pistola en la mano, empieza a tirar en ≤ 3 s, tira a su cadencia (1-2,5 tiros/s)
//     y te baja vida en ≤ 6 s; detrás de una pared no tira (0 tiros en 3 s)
//  3. el que te defiende (SMG) mata a un hostil (a patadas) que viene a 12 m en ≤ 15 s y a vos no te pega nunca; el hostil,
//     tiroteado, se da vuelta contra él
//  4. si estás en la línea de tiro, el que te defiende no tira (0 tiros en 2,5 s); al correrte, tira
//  5. la red: el estado manda el arma, el bando y los tiros; del otro lado el NPC lleva el arma y los tiros se ven salir
//  6. el panel: «Armado», «Te defiende» y la fila de armas, que cambia el arma del NPC
//  7. sin errores
// uso: node npc_armas.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/npcarmas'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500);
const esperarJuego = async (seg) => { const t0 = await ev(`TIEMPO.t`); await p.waitForFunction((x) => window.__ev(`TIEMPO.t`) >= x, t0 + seg, { timeout: 120000, polling: 50 }); };
// (el jugador quieto, sin el modo dios; las fuentes del daño que recibe)
await ev(`(() => { JUEGO.dios = false; MODS.invencible = false; JUG.vida = 100; JUG.tercera = true; window.__dano = [];
  const o = danarJugador; danarJugador = (dan, de) => { window.__dano.push({ dan, de: de ? [de.x, de.z] : null, t: TIEMPO.t }); return o(dan, de); };
  window.__piso = JUG.pos.y - 0.95;
  window.__poner = (dx, dz, act) => { const P = npcCrear('Hero', v3(JUG.pos.x + dx, __piso, JUG.pos.z + dz), Math.atan2(-dx, -dz), act); return P; };
  return 1; })()`);
// 1. el lector local
const lec = await ev(`(() => { const f = (t) => { const a = npcActDeTexto(t, {}); return [a.modo, a.arma, a.hostil, a.obj]; };
  return { escopeta: f('agresivo con escopeta'), rifle: f('un amigo que me defienda con un rifle'), guarda: f('guardaespaldas'), sigue: f('que me siga'), guardia: f('guardia que vigile la puerta'), zombie: f('zombie que persiga') }; })()`);
ok('1. el lector entiende el arma y la defensa, y lo de antes sigue igual', lec.escopeta[0] === 'perseguir' && lec.escopeta[1] === 'Shotgun' && lec.escopeta[2] === true
  && lec.rifle[0] === 'defender' && lec.rifle[1] === 'Akm' && lec.rifle[2] === false && lec.rifle[3] === 'yo' && lec.guarda[0] === 'defender' && lec.guarda[1] === ''
  && lec.sigue[0] === 'seguir' && lec.sigue[1] === '' && lec.guardia[0] === 'guardia' && lec.zombie[0] === 'perseguir' && lec.zombie[1] === '', lec);
// 2. un hostil con pistola a 15 m
await ev(`(() => { window.__h = __poner(0, 15, { modo: 'perseguir', vel: 4, hostil: true, dano: 12, dist: 1.2, arma: 'Pistol' }); NPC.tiros = 0; window.__t0 = TIEMPO.t; window.__primero = null;
  window.__mirar = setInterval(() => { try { if (__primero === null && NPC.tiros > 0) __primero = TIEMPO.t - __t0; } catch (e) {} }, 20); return 1; })()`);
await esperarJuego(1.2);
const mano = await ev(`(() => { const P = __h; return { arma: P.arma, dibujo: !!(P.armasGm && P.armasGm.Pistol) || !!(P.armas3p && P.armas3p.Pistol) }; })()`);
await ev(`(() => { const t = v3(__h.pos.x, __h.pos.y + 0.2, __h.pos.z), c = vadd(JUG.pos, v3(2.2, 0.6, 3)); CAM.pos.copy(c); return 1; })()`);
await esperarJuego(4.8);
const h2 = await ev(`(() => { const t = TIEMPO.t - __t0; return { primero: __primero && +__primero.toFixed(2), tiros: NPC.tiros, seg: +t.toFixed(2), vida: JUG.vida, danos: __dano.length, dist: +Math.hypot(__h.pos.x - JUG.pos.x, __h.pos.z - JUG.pos.z).toFixed(1) }; })()`);
await p.locator('#cv').screenshot({ path: `${D}/hostil.png` });
// (la cadencia, desde el primer tiro)
const cad = h2.primero !== null ? h2.tiros / Math.max(0.5, h2.seg - h2.primero) : 0;
// detrás de una pared
await ev(`(() => { npcTodos(); JUG.vida = 100; __dano.length = 0;
  const w = new Body(boxShape(3, 2.5, 0.3), 0); w.pos.set(JUG.pos.x, __piso + 2.5, JUG.pos.z + 6); w.frozen = true; addBody(w); window.__pared = w;
  window.__h = __poner(0, 12, { modo: 'guardia', vel: 0.5, hostil: true, dano: 12, dist: 1, arma: 'Pistol' }); NPC.tiros = 0; return 1; })()`);
await esperarJuego(3);
const pared = await ev(`({ tiros: NPC.tiros, vis: !!__h.ia.vis })`);
await ev(`(() => { removeBody(__pared); npcTodos(); return 1; })()`);
ok('2. el hostil con pistola la tiene en la mano, tira en ≤ 3 s a su cadencia (1-2,5/s) y te baja vida en ≤ 6 s; detrás de una pared no tira',
  mano.arma === 'Pistol' && h2.primero !== null && h2.primero <= 3 && cad >= 1 && cad <= 2.5 && h2.vida < 100 && pared.tiros === 0, { mano, ...h2, cadencia: +cad.toFixed(2), pared });
// 3. el que te defiende contra un hostil a patadas
await ev(`(() => { JUG.vida = 100; __dano.length = 0; NPC.tiros = 0;
  window.__d = __poner(1.5, -1, { modo: 'defender', vel: 5, obj: 'yo', dist: 3, hostil: false, dano: 12, arma: 'Smg', vida: 200, de: RED.ID || 'yo' });
  window.__h = __poner(0, 12, { modo: 'perseguir', vel: 3, hostil: true, dano: 8, dist: 1.2, vida: 100 }); window.__t0 = TIEMPO.t; window.__muerto = null; window.__vengo = null;
  clearInterval(__mirar); window.__mirar = setInterval(() => { try { if (__muerto === null && __h.vivo === false) __muerto = TIEMPO.t - __t0; if (__vengo === null && __h.ia.venganza && __h.ia.venganza.P === __d) __vengo = TIEMPO.t - __t0; } catch (e) {} }, 20); return 1; })()`);
for (let i = 0; i < 30; i++) { await esperarJuego(0.5); if (await ev(`__muerto !== null`)) break; }
const def = await ev(`(() => ({ muerto: __muerto && +__muerto.toFixed(2), vengo: __vengo && +__vengo.toFixed(2), tiros: NPC.tiros, danoDelDefensor: __dano.filter((x) => x.de && Math.hypot(x.de[0] - __d.pos.x, x.de[1] - __d.pos.z) < 0.01).length, danos: __dano.length, vidaDef: __d.vida }))()`);
await p.locator('#cv').screenshot({ path: `${D}/defensor.png` });
ok('3. el que te defiende mata al hostil en ≤ 15 s, a vos no te pega y el hostil se da vuelta contra él', def.muerto !== null && def.muerto <= 15 && def.danoDelDefensor === 0 && def.vengo !== null, def);
// 4. en la línea de tiro no tira
await ev(`(() => { npcTodos(); NPC.tiros = 0;
  window.__d = __poner(0, -3, { modo: 'defender', vel: 0.5, obj: 'yo', dist: 1, hostil: false, dano: 12, arma: 'Smg', vida: 200, de: RED.ID || 'yo' });
  window.__h = __poner(0, 8, { modo: 'quieto', hostil: true, dano: 8, vida: 2000 }); return 1; })()`);
await esperarJuego(2.5);
const enMedio = await ev(`NPC.tiros`);
await ev(`(() => { JUG.pos.x += 3; return 1; })()`);
await esperarJuego(2.5);
const alCostado = await ev(`NPC.tiros`);
ok('4. con vos en la línea de tiro no tira (0 tiros en 2,5 s); al correrte, tira', enMedio === 0 && alCostado > 0, { enMedio, alCostado });
// 5. la red (el estado que manda y lo que hace el otro con él)
const red = await ev(`(() => { let m = null; const pub = publicar; publicar = (t, d) => { if (d && d.k === 'npcs') m = d; };
  try { __d.ia.tirosRed = 3; __d.ia.miraRed = v3(JUG.pos.x, JUG.pos.y, JUG.pos.z + 8); npcRedMandar(); } finally { publicar = pub; }
  const x = m && m.l.find((e) => e[0] === __d.npcId); if (!x) return { sin: true };
  npcRecibir({ i: 'otro', k: 'npcs', l: [x] }); const E = NPC.rem.get('otro/' + __d.npcId);
  return { arma: x[11], bueno: !!(x[9] & 16), tiros: x[12], remArma: E && E.P.arma, remBueno: E && E.P.npcRem.bueno, remTiros: E && E.tiros, cero: __d.ia.tirosRed }; })()`);
await esperarJuego(0.6);
const red2 = await ev(`(() => { const E = NPC.rem.get('otro/' + __d.npcId); return { quedan: E ? E.tiros : null }; })()`);
ok('5. la red manda el arma, el bando y los tiros; del otro lado lleva el arma y los tiros salen', red.arma === 'Smg' && red.bueno && red.tiros === 3 && red.remArma === 'Smg' && red.remBueno && red.remTiros === 3 && red.cero === 0 && red2.quedan !== null && red2.quedan < 3, { ...red, ...red2 });
// 6. el panel
await ev(`(() => { NPC.rem.forEach((E, k) => npcRemQuitar(k, E)); npcPanel(__d); return 1; })()`); await p.waitForTimeout(300);
const pan = await ev(`(() => { const q = (s) => document.querySelectorAll('#npcPan ' + s); const r = [...q('[data-npcr]')].map((x) => x.dataset.npcr);
  const w = [...q('[data-npca]')]; const sel = w.find((x) => x.classList.contains('sel')); const ak = w.find((x) => x.dataset.npca === 'Akm'); ak.click();
  return { rapidas: r, armas: w.length, sel: sel && sel.dataset.npca, despues: __d.act.arma, enMano: __d.arma, ahora: document.querySelector('#npcPan .npcAhora b').textContent }; })()`);
await p.waitForTimeout(200); await p.screenshot({ path: `${D}/panel.png` });
ok('6. el panel tiene «Armado», «Te defiende» y la fila de armas (7), que cambia el arma', pan.rapidas.includes('armado') && pan.rapidas.includes('defensor') && pan.armas === 7 && pan.sel === 'Smg' && pan.despues === 'Akm', pan);
await ev(`(() => { clearInterval(__mirar); npcPanelCerrar(); npcTodos(); return 1; })()`);
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('7. sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
