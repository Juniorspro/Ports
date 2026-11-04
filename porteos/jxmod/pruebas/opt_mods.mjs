// cuánto cuesta cada parte del cuadro con mods de GMod pesados y gente: el Lua de los addons (hooks, timers, armas,
// entidades), la HUD de los addons, el dibujo del Lua, los personajes (jugadores/NPCs), la física y el dibujo.
// Escena fija: Pasto plano, calidad pedida, M9K + Lightsaber + Nuke Pack + SCP-096 instalados, el arma de M9K en la
// mano, 3 bombas, 2 SCP-096 y N personas (como jugadores de un server) caminando. Mide 6 s y da ms por cuadro de cada
// parte (promedio y percentil 95) y los cuadros por segundo.
// uso: node opt_mods.mjs URL_HTML URL_CARPETA_GMA [calidad=bajo] [personas=12] [celu=0]
import { abrir } from './base.mjs';
const [, , HTML, CARP, CAL = 'bajo', NP = '12', CELU = '0'] = process.argv;
const { b, p, ev } = await abrir(HTML, CELU === '1');
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; PREFS.resDin = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
await ev(`(async () => { for (const id of ['128089118', '111412589', '106565409', '367531149']) { const r = await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma'); if (!r.ok) continue; const A = await gmInstalar(id, { nombre: id, sinDeps: true }, new Uint8Array(await r.arrayBuffer())); await A.listo; } return 1; })()`);
await ev(`(async () => {
  gmaDarArma('m9k_ak47'); elegirArma(ARM.lista.indexOf('gm:m9k_ak47'));
  const pos = (k) => v3(JUG.pos.x + Math.sin(k) * 6, JUG.pos.y, JUG.pos.z + Math.cos(k) * 6);
  for (const [i, c] of ['barrel_sent_atomic_bomb', 'barrel_sent_he_missile', 'briefcase_sent_atomic_bomb'].entries()) { try { gmaSpawnMenu('gment:' + c); } catch (e) {} }
  for (let i = 0; i < 2; i++) { try { gmnpcCrear('npc_shaklin_scp096'); } catch (e) {} }
  for (let i = 0; i < ${+NP}; i++) { try { npcCrear('Hero', pos(i * 0.5 + 1), i, { modo: 'pasear', vel: 1.4, vida: 100 }); } catch (e) {} }
  return 1; })()`);
await p.waitForTimeout(3000);
const r = await ev(`(async () => {
  const partes = ['gmLuaPaso', 'gmaHUDPaso', 'gmrAntes', 'personasPaso', 'npcPaso', 'physStep', 'dibujar', 'redPaso', 'efectosPaso', 'hudActualizar'];
  const M = {}, orig = {};
  for (const n of partes) { let f; try { f = eval(n); } catch (e) { continue; } if (typeof f !== 'function') continue; orig[n] = f; M[n] = []; const w = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { M[n].push(performance.now() - t0); } }; eval(n + ' = w'); }
  const c0 = TIEMPO.cuadros, t0 = performance.now(); let cuadros = 0; const fr = []; let ult = performance.now();
  await new Promise((ok) => { const f = () => { const a = performance.now(); fr.push(a - ult); ult = a; cuadros++; if (a - t0 < 6000) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
  for (const n of Object.keys(orig)) eval(n + ' = orig[n]');
  const est = (L) => { if (!L.length) return null; const s = L.slice().sort((a, b) => a - b); const sum = L.reduce((a, b) => a + b, 0); return { prom: +(sum / cuadros).toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), llamadas: L.length }; };
  const out = {}; for (const n of Object.keys(M)) out[n] = est(M[n]);
  const sf = fr.slice(2).sort((a, b) => a - b);
  return { fps: +(cuadros / ((performance.now() - t0) / 1000)).toFixed(1), cuadroP50: +sf[Math.floor(sf.length / 2)].toFixed(1), cuadroP95: +sf[Math.floor(sf.length * 0.95)].toFixed(1), partes: out, personas: PERS.length, ents: GMA.ents.size, hooks: [...GMA.hooks].reduce((a, [k, v]) = > a + v.size, 0) };
})()`.replace('= >', '=>'));
console.log(JSON.stringify(r, null, 1));
await b.close(); process.exit(0);
