// DrGBase sin pose T (Discord: «Compatibilidad con drg base — Se queda todo pose t»). Los NPC de ejemplo de DrGBase
// (Workshop 1560118657): la hormiga león, el headcrab, el zombie, el «Test Nextbot» (el modelo de jugador del G-Man) y el
// «Test Human» (Magnusson). Los dos últimos guardan sus animaciones en otro .mdl (m_anm.mdl, por $includemodel), que
// antes no se leía: no había secuencias y quedaban en la pose de referencia.
//  1. los modelos que incluyen otros suman sus secuencias (≥ 100) y ninguno queda sin las del archivo incluido;
//  2. cada NPC 3D tiene una secuencia puesta a los 8 s y la está reproduciendo (el tiempo avanza);
//  3. ninguno está en la pose de referencia: los huesos giran en promedio ≥ 4° respecto de ella (la pose T da 0°) y la
//     pose cambia con el tiempo (≥ 0,1° en 0,7 s: respirar quieto ya mueve);
//  4. sin errores de Lua ni de JS.
// uso: node drg_poses.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, G, D = '/tmp/claude-0/drg_poses'] = process.argv;
fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1400) : '')); };
const { b, p, ev, err } = await abrir(HTML + '?test', false);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500);
const inst = await ev(`(async () => { const u = new Uint8Array(await (await fetch(${JSON.stringify(G)} + '/1560118657.gma')).arrayBuffer()); const A = await gmInstalar('1560118657', { nombre: 'DrGBase', sinDeps: true }, u); await A.listo; return { npcs: [...((A.listas && A.listas.NPC) || new Map()).keys()], luaErr: (A.luaErr || []).slice(0, 3) }; })()`);
const NPCS = inst.npcs.filter((c) => !/sprite/i.test(c));
// la pose: el giro medio de cada hueso respecto de la pose de referencia, en la secuencia y el cuadro de ahora
const POSE = (c) => `(() => { const cls = (gmLista('NPC', '${c}') && gmLista('NPC', '${c}').get('Class')) || '${c}'; const L = [...GMA.ents.values()].filter((e) => e.vivo !== false && e.clase === cls); const e = L[L.length - 1]; if (!e) return null;
  const d = gmnbDef(e), s = e.nbSec; if (!d) return { c: '${c}', sinDef: true }; const M = d.M;
  const r = { c: '${c}', modelo: e.modelo, nseq: M.secuencias.length, incluidos: M.incHechos ? [...M.incHechos] : [], faltan: M.incFaltan ? [...M.incFaltan] : [], sec: s ? M.secuencias[s.i].n : null, t: s ? +s.t.toFixed(2) : null };
  if (!s) return r; const A = M.anims[s.anim], fps = A.fps > 0 ? A.fps : 30, n = Math.max(1, A.nf - 1), f = Math.floor(s.loop ? (s.t * fps) % n : Math.min(n, s.t * fps));
  const ps = GMF.poseCapas(M, s.anim, f); let tot = 0, k = 0; for (let h = 0; h < M.huesos.length; h++) { const q = M.huesos[h].q, dt = Math.abs(q[0] * ps.Q[h * 4] + q[1] * ps.Q[h * 4 + 1] + q[2] * ps.Q[h * 4 + 2] + q[3] * ps.Q[h * 4 + 3]); tot += 2 * Math.acos(Math.min(1, dt)) * 180 / Math.PI; k++; }
  r.giroRef = +(tot / Math.max(1, k)).toFixed(2); r.Q = Array.from(ps.Q); return r; })()`;
const filas = [];
let k = 0;
for (const c of NPCS) {
  await ev(`(() => { JUG.yaw = ${k * 0.55 - 1.2}; JUG.pitch = 0.3; return 1; })()`); await p.waitForTimeout(300);
  await ev(`(() => { gmnpcCrear('${c}'); return 1; })()`); k++;
}
await p.waitForTimeout(8000);
for (const c of NPCS) {
  const a = await ev(POSE(c)); await p.waitForTimeout(700); const b2 = await ev(POSE(c));
  let cambio = null; if (a && b2 && a.Q && b2.Q && a.Q.length === b2.Q.length) { let tot = 0, n = 0; for (let h = 0; h < a.Q.length / 4; h++) { const dt = Math.abs(a.Q[h * 4] * b2.Q[h * 4] + a.Q[h * 4 + 1] * b2.Q[h * 4 + 1] + a.Q[h * 4 + 2] * b2.Q[h * 4 + 2] + a.Q[h * 4 + 3] * b2.Q[h * 4 + 3]); tot += 2 * Math.acos(Math.min(1, dt)) * 180 / Math.PI; n++; } cambio = +(tot / Math.max(1, n)).toFixed(2); }
  if (a) { delete a.Q; } filas.push({ ...(a || { c }), t2: b2 && b2.t, cambio });
}
console.log(JSON.stringify(filas));
await p.screenshot({ path: `${D}/drg.png` });
const conInc = filas.filter((f) => f.incluidos && (f.incluidos.length || f.faltan.length));
ok('1. los modelos que incluyen otros suman sus secuencias (≥ 100) sin que falte ningún archivo incluido', conInc.length >= 2 && conInc.every((f) => f.nseq >= 100 && !f.faltan.length), conInc.map((f) => ({ c: f.c, nseq: f.nseq, incluidos: f.incluidos, faltan: f.faltan })));
ok('2. cada NPC 3D tiene una secuencia puesta y la reproduce (el tiempo avanza)', filas.length === NPCS.length && filas.every((f) => f.sec && f.t2 !== null && f.t2 !== f.t), filas.map((f) => ({ c: f.c, sec: f.sec, t: f.t, t2: f.t2 })));
ok('3. ninguno en la pose de referencia (giro medio ≥ 4°) y la pose cambia con el tiempo (≥ 0,1°)', filas.every((f) => f.giroRef >= 4 && f.cambio >= 0.1), filas.map((f) => ({ c: f.c, giroRef: f.giroRef, cambio: f.cambio })));
const le = await ev(`GMA.errores.map((x) => String(x.msg || x).slice(0, 200)).slice(0, 4)`);
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('4. sin errores de Lua ni de JS', !le.length && !e.length && !inst.luaErr.length, { lua: le, js: e.slice(0, 4) });
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
