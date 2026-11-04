// ¿llega a 60? el trabajo de JavaScript de cada cuadro (todo el bucle: física, Lua de los addons, personas, dibujo,
// HUD) en una escena pesada: 12 personajes de GMod (Trevor, Master Chief, SCP-096) caminando, el arma de M9K en la
// mano, 3 bombas del Nuke Pack y la Lightsaber instalada. Un celular de gama baja es 3-4 veces más lento que esta
// máquina, así que para 60 cuadros (16,7 ms) el JavaScript de acá tiene que quedar en ≤ 3 ms promedio y ≤ 5 ms en el
// percentil 95. Da el promedio, el p95 y cuánto cuesta cada parte.
// uso: node opt_60.mjs URL_HTML URL_CARPETA_GMA [calidad=bajo] [celu=0]
import { abrir } from './base.mjs';
const [, , HTML, CARP, CAL = 'bajo', CELU = '0'] = process.argv;
const { b, p, ev } = await abrir(HTML, CELU === '1');
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; PREFS.resDin = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
await ev(`(async () => {
  for (const id of ['128089118', '111412589', '106565409', '367531149', '216408135', '139247091']) { const r = await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma'); if (!r.ok) continue; const A = await gmInstalar(id, { nombre: id, sinDeps: true }, new Uint8Array(await r.arrayBuffer())); await A.listo; }
  gmaDarArma('m9k_ak47'); elegirArma(ARM.lista.indexOf('gm:m9k_ak47'));
  for (const c of ['barrel_sent_atomic_bomb', 'barrel_sent_he_missile', 'briefcase_sent_atomic_bomb']) { try { gmaSpawnMenu('gment:' + c); } catch (e) {} }
  const mods = ['models/grandtheftauto5/trevor.mdl', 'models/halo4/spartans/masterchief_player.mdl', 'models/shaklin/scp/096/scp_096.mdl'], suelo = JUG.pos.y - 0.96;
  JUG.yaw = 0; JUG.pitch = 0; await new Promise((r) => setTimeout(r, 200)); const f = CAM.fwd;
  for (let i = 0; i < 12; i++) { const d = 4 + i * 3, a = (i % 2 ? 1 : -1) * (0.15 + (i % 4) * 0.1), x = f.x * Math.cos(a) - f.z * Math.sin(a), z = f.x * Math.sin(a) + f.z * Math.cos(a);
    npcCrear('gmpm:' + mods[i % 3], v3(JUG.pos.x + x * d, suelo, JUG.pos.z + z * d), Math.atan2(-x, -z), { modo: 'pasear', vel: 1.4, vida: 100 }); }
  return 1; })()`);
await p.waitForTimeout(6000);
if (process.env.PARTES) await ev(`window.__PARTES = ${JSON.stringify(process.env.PARTES)}; 1`);
const r = await ev(`(async () => {
  const partes = (window.__PARTES || 'gmLuaPaso,gmaHUDPaso,gmrAntes,personasPaso,npcPaso,physStep,dibujar,dibujarPersonas,animarPersona,armarCola,sombrasActualizar,dibujarOpacos,hudActualizar,efectosPaso,camaraActualizar,jugadorPaso,armasPaso').split(',');
  const M = {}, orig = {};
  for (const n of partes) { let f; try { f = eval(n); } catch (e) { continue; } if (typeof f !== 'function') continue; orig[n] = f; M[n] = 0; const w = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { M[n] += performance.now() - t0; } }; eval(n + ' = w'); }
  // (el bucle entero: cuadro() mide su propio tiempo en TIEMPO.ms; acá se toma cada cuadro aparte)
  const c0 = cuadro, L = []; cuadro = function (a) { const t = performance.now(); try { return c0.call(this, a); } finally { L.push(performance.now() - t); } };
  const n0 = TIEMPO.cuadros; await new Promise((ok) => setTimeout(ok, 6000));
  cuadro = c0; for (const n of Object.keys(orig)) eval(n + ' = orig[n]');
  const s = L.slice(5).sort((a, b) => a - b), N = s.length, prom = s.reduce((a, b) => a + b, 0) / N;
  const out = {}; for (const n of Object.keys(M)) out[n] = +(M[n] / N).toFixed(3);
  return { cuadros: N, prom: +prom.toFixed(2), p50: +s[Math.floor(N / 2)].toFixed(2), p95: +s[Math.floor(N * 0.95)].toFixed(2), partes: out, personas: PERS.length, ents: GMA.ents.size, tris: R.tris, dibujadas: R.dibujadas };
})()`);
console.log(JSON.stringify(r, null, 1));
await b.close(); process.exit(0);
