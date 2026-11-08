// Nextbots como en GMod: que persigan bien, con la animación que corresponde, del tamaño que son, sin patinar, y que maten
// (Discord, canal bugs, «Última (creo) bug de drgbase/nextbot»: «a veces los nextbots 3d son muy tontos, también no
// ejecutan su animación correcta, y en drg base, o son pequeños, o no caminan rápido y bien, y no matan»). Con addons
// reales guardados en /tmp/claude-0/srv/gma: DrGBase (1560118657) con su zombie y su hormiga león, el Cartoon Cat de
// DrGBase (1997453273, 290 mil suscriptos), Doro (3505279804, DrGBase) y el SCP-049 (779759026, un nextbot 3D clásico de
// base_nextbot, 1,25 millones). Cada uno aparece como desde el menú (mirando al jugador, como InternalSpawnNPC de GMod):
//  A. tamaño: la caja de sus hitboxes con los huesos que dibuja el juego, en toda la secuencia con que persigue (si es
//     una mezcla, en la de quieto, y si no, en la de pegar), mide de alto lo que la caja que studiomdl guardó para esa
//     secuencia en el .mdl (la unión de las hitboxes en todos los cuadros: su tamaño en GMod) por su ModelScale, ±5 %. En
//     los NPC de HL2 esa caja es 2-12 % más alta que la que da su propia animación (así vienen compilados): para ellos, contra
//     la animación decodificada como el motor (herramientas/source_mdl.py con el .ani; tabla MOTOR), ±2 %. Si las secuencias
//     vienen de un modelo incluido (SCP-049), la malla dibujada contra su pose de enlace, ±15 %;
//  B. velocidad: persiguiendo en campo abierto va a la que pide su Lua —WalkSpeed/RunSpeed, o con UseWalkframes la de
//     suelo de su animación por su escala, la de GMod— ±15 %; y sin patinar: si la animación tiene walkframes (GMod pone el
//     paso para que los pies no resbalen), el pie apoyado (el vértice más bajo de cada hueso, mientras toca el piso) va
//     respecto del cuerpo a la velocidad con que avanza el cuerpo, ±15 %; también se informa cuánto resbala en el mundo
//     (las animaciones sin walkframes —Cartoon Cat, Doro— van a su RunSpeed con el paso en 1 y resbalan igual en GMod);
//  C. IA: con una pared de por medio (dos paredes del juego, 4,2 m de ancho y 2,3 m de alto) rodea la pared y llega al
//     jugador (a ≤ 2,2 m o a su alcance, pegándole) en ≤ 1,5 × (largo del rodeo / su velocidad) + 3 s, y nunca se queda
//     quieto más de 1,5 s mientras lo persigue (antes caminaba contra la pared hasta trabarse);
//  D. animación: mientras persigue, en ≥ 90 % de las muestras la secuencia que se ve es la que pidió su Lua (DrGBase: la
//     de OnUpdateAnimation —caminar, correr, quieto—, a lo sumo 0,15 s después porque la cambia cada 0,1 s, como en GMod;
//     los clásicos: la de su último StartActivity) y nunca ninguna (pose de referencia); al llegar, una de ataque;
//  E. matan: con el daño de verdad, desde 3 m, el jugador pierde vida en ≤ 5 s y muere en ≤ 40 s (los NPC de ejemplo de
//     DrGBase pegan poco: la hormiga 5 por golpe, el zombie 10, como en GMod);
//  F. escala: la hormiga león con la herramienta de escala de DrGBase (SetScale 1,6) mide 1,6 veces lo que sin escala
//     (±5 %; y la caja de sus hitboxes, la de su animación × 1,6, ±2 %) y corre 1,6 veces más rápido (±15 %) sin patinar
//     (pies respecto del cuerpo a la velocidad del cuerpo ±15 %);
//  G. sin errores de Lua ni de JS;
//  H. y a los NPC: el zombie de DrGBase persigue a un NPC del juego (un ciudadano con 40 de vida) y lo mata en ≤ 25 s.
// Fotos y hoja en CARPETA_FOTOS (nextbots_hoja.jpg).
// uso: node nextbots_ia.mjs URL_HTML [URL_CARPETA_GMA] [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const [, , HTML, G = new URL('/gma', HTML).href, D = '/tmp/claude-0/nextbots_ia'] = process.argv;
fs.mkdirSync(D, { recursive: true });
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 2400) : '')); };
const { b, p, ev, err } = await abrir(HTML + (HTML.includes('?') ? '&' : '?') + 'test', false);
await p.setViewportSize({ width: 640, height: 360 });
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; idiomaAplicar('es'); GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); try { cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); } catch (e) {} 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await p.waitForTimeout(1500);
const INST = (id) => ev(`(async () => { const u = new Uint8Array(await (await fetch(${JSON.stringify(G)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${id}', sinDeps: true }, u); await A.listo; return { npcs: [...((A.listas && A.listas.NPC) || new Map()).keys()], err: (A.luaErr || []).slice(0, 3) }; })()`);
const lua = (src) => ev(`(() => { const R = GMA.R; try { const f = luaCompilar(${JSON.stringify(src)}, 'prueba.lua', R); const aJS = (v, n = 0) => v instanceof LuaTable && n < 4 ? (v.h.size ? Object.assign(Object.fromEntries(v.a.map((x, i) => [i + 1, aJS(x, n + 1)])), Object.fromEntries([...v.h].map(([k, x]) => [String(k), aJS(x, n + 1)]))) : v.a.map((x) => aJS(x, n + 1))) : v instanceof LVec ? [v.x, v.y, v.z] : typeof v === 'object' && v !== null ? String(v) : v; return JSON.stringify(aJS(gmaEnLado('S', () => R.c(f, 'prueba'))[0])); } catch (x) { return JSON.stringify('ERR ' + x.message); } })()`).then((r) => JSON.parse(r));
const lua0 = (await ev(`GMA.errores.length`)) | 0, js0 = err.length;   // (los errores de JS desde acá: los de la carga de la página son de otras partes)
// el contenido base que usan los NPC de ejemplo de DrGBase (la hormiga león, m_anm.mdl), como lo baja el juego de Steam
const BASE = ['models/antlion.mdl', 'models/antlion.ani', 'models/antlion.vvd', 'models/antlion.dx90.vtx', 'models/player/gman_high.mdl', 'models/player/gman_high.vvd', 'models/player/gman_high.dx90.vtx', 'models/m_anm.mdl', 'models/m_anm.ani'];
await ev(`(async () => { const L = ${JSON.stringify(BASE)}; for (const r of L) { const x = await fetch(${JSON.stringify(G)} + '/base_ev6/' + r); if (!x.ok) continue; GML.datos.set(r, new Uint8Array(await x.arrayBuffer())); } try { gmlLlegaron(L); } catch (e) {} return 1; })()`);
const inst = {}; for (const id of ['1560118657', '3505279804', '1997453273', '779759026']) inst[id] = await INST(id);
const PISO = await ev(`(() => { const h = mundoRayo(v3(0, 6, 8), v3(0, -1, 0), 30); return h ? 6 - h.t : null; })()`);
await ev(`(() => { window.__dan0 = danarJugador; danarJugador = () => {}; return 1; })()`);
const limpiar = `(() => { for (const e of [...GMA.ents.values()]) if (e.nb) gmaQuitar(e); npcTodos(); if (window.__pared) { for (const o of window.__pared) borrarObjeto(o); window.__pared = null; } JUG.pos.set(0, ${PISO} + JUG.medio, 0); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0.1; JUG.vida = 100; JUG.vivo = true; return 1; })()`;

// ---------- medidas en la página ----------
// (para correrla también con un armado viejo, de antes del arreglo: sin escala de modelo, escala 1)
await ev(`(() => { if (typeof gmnbEscala !== 'function') window.gmnbEscala = (e) => +e.escala || 1; return 1; })()`);
await ev(`window.__NB = {
  // la malla dibujada: cada vértice con su piel (las matrices de los huesos que se dibujaron), su alto en el mundo
  malla(e) { const d = gmnbDef(e), W = e.nbW; if (!d || !W) return null; const M = d.M, V = M.v, H = M.huesos; let y0 = 1e9, y1 = -1e9;
    for (let k = 0; k < V.n; k++) { const x0 = V.pos[k * 3], yy = V.pos[k * 3 + 1], z0 = V.pos[k * 3 + 2]; let py = 0, wt = 0;
      for (let j = 0; j < 3; j++) { const w = V.w[k * 3 + j]; if (!(w > 0)) continue; const hb = V.hb[k * 3 + j], m = H[hb].p2b, A = W[1 + hb]; if (!A) continue; const l = d.pv([m[0] * x0 + m[1] * yy + m[2] * z0 + m[3], m[4] * x0 + m[5] * yy + m[6] * z0 + m[7], m[8] * x0 + m[9] * yy + m[10] * z0 + m[11]]); py += w * (A[1] * l[0] + A[5] * l[1] + A[9] * l[2] + A[13]); wt += w; }
      if (!(wt > 0)) continue; py /= wt; if (py < y0) y0 = py; if (py > y1) y1 = py; }
    return { alto: y1 - y0, bajo: y0 - gmaEntPos(e).y }; },
  // la pose de enlace del propio modelo: su alto
  enlace(e) { const d = gmnbDef(e); if (!d) return null; const V = d.M.v; let y0 = 1e9, y1 = -1e9; for (let k = 0; k < V.n; k++) { const r = d.pv([V.pos[k * 3], V.pos[k * 3 + 1], V.pos[k * 3 + 2]]); if (r[1] < y0) y0 = r[1]; if (r[1] > y1) y1 = r[1]; } return y1 - y0; },
  // la caja de la secuencia de ahora según el .mdl (studiomdl: todos los vértices en todos los cuadros), en metros
  cajaSec(e) { const d = gmnbDef(e), s = e.nbSec; if (!d || !s) return null; const q = d.M.secuencias[s.i], B = d.M.b; if (!q || q.inc || !B || !(q.o > 0)) return null; const dv = new DataView(B.buffer, B.byteOffset, B.byteLength); return (dv.getFloat32(q.o + 52, true) - dv.getFloat32(q.o + 40, true)) * GS; },
  // los puntos que pueden apoyarse: de cada hueso, su vértice más bajo en la pose de enlace (de los que dependen de él al
  // menos al 90 %): la suela, la punta de una pata. Al analizar quedan los que tocan el piso en algún momento
  contactos(e) { const d = gmnbDef(e); if (!d) return []; const V = d.M.v, H = d.M.huesos, mejor = new Map();
    for (let k = 0; k < V.n; k++) { if (!(V.w[k * 3] >= 0.9)) continue; const hb = V.hb[k * 3], y = d.pv([V.pos[k * 3], V.pos[k * 3 + 1], V.pos[k * 3 + 2]])[1]; const m = mejor.get(hb); if (!m || y < m.y) mejor.set(hb, { k, y }); }
    return [...mejor.values()].sort((a, b) => a.y - b.y).slice(0, 48).map((x) => x.k); },
  // un vértice con su piel, en el mundo
  vertice(e, k) { const d = gmnbDef(e), W = e.nbW, V = d.M.v, H = d.M.huesos, x0 = V.pos[k * 3], y0 = V.pos[k * 3 + 1], z0 = V.pos[k * 3 + 2]; let px = 0, py = 0, pz = 0, wt = 0;
    for (let j = 0; j < 3; j++) { const w = V.w[k * 3 + j]; if (!(w > 0)) continue; const hb = V.hb[k * 3 + j], m = H[hb].p2b, A = W[1 + hb]; if (!A) continue; const l = d.pv([m[0] * x0 + m[1] * y0 + m[2] * z0 + m[3], m[4] * x0 + m[5] * y0 + m[6] * z0 + m[7], m[8] * x0 + m[9] * y0 + m[10] * z0 + m[11]]); px += w * (A[0] * l[0] + A[4] * l[1] + A[8] * l[2] + A[12]); py += w * (A[1] * l[0] + A[5] * l[1] + A[9] * l[2] + A[13]); pz += w * (A[2] * l[0] + A[6] * l[1] + A[10] * l[2] + A[14]); wt += w; }
    return wt > 0 ? [px / wt, py / wt, pz / wt] : null; },
  // el alto de la caja de las hitboxes con los huesos dibujados: es lo que studiomdl guardó como caja de cada secuencia
  // (la unión de las hitboxes en todos los cuadros), así que en GMod esa caja es exactamente su tamaño en esa secuencia
  cajaHB(e) { const d = gmnbDef(e), W = e.nbW, M = d && d.M; if (!M || !W || !M.b) return null;
    if (!M.__hb) { const B = M.b, dv = new DataView(B.buffer, B.byteOffset, B.byteLength), hsi = dv.getInt32(0xb0, true), n = dv.getInt32(0xac, true) > 0 ? dv.getInt32(hsi + 4, true) : 0, hbi = hsi + dv.getInt32(hsi + 8, true); M.__hb = [];
      for (let k = 0; k < Math.min(n, 256); k++) { const o = hbi + k * 68; if (o + 32 > B.length) break; const f = (x) => dv.getFloat32(o + x, true); M.__hb.push({ b: dv.getInt32(o, true), mn: [f(8), f(12), f(16)], mx: [f(20), f(24), f(28)] }); } }
    let y0 = 1e9, y1 = -1e9; const oy = gmaEntPos(e).y;
    for (const h of M.__hb) { const A = W[1 + h.b]; if (!A) continue; for (let c = 0; c < 8; c++) { const l = d.pv([c & 1 ? h.mx[0] : h.mn[0], c & 2 ? h.mx[1] : h.mn[1], c & 4 ? h.mx[2] : h.mn[2]]), y = A[1] * l[0] + A[5] * l[1] + A[9] * l[2] + A[13]; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return y1 > y0 ? [y0 - oy, y1 - oy] : null; },   // (lo más bajo y lo más alto respecto de los pies: la caja de studiomdl es la unión de todos los cuadros)
  // la secuencia entera, cuadro por cuadro, con los huesos que dibuja el juego: la unión de las cajas de sus hitboxes
  // (lo mismo que hizo studiomdl para guardar la caja de la secuencia), en metros; deja la secuencia como estaba
  barrer(e, nom) { const d = gmnbDef(e); if (!d || !e.o) return null; const M = d.M, i = M.secuencias.findIndex((q) => q.n === nom), q = M.secuencias[i]; if (!q || q.inc || q.grid) return null; const A = M.anims[q.anim]; if (!A) return null;
    const antes = e.nbSec, rate = e.nbRate; let lo = 1e9, hi = -1e9;
    e.nbSec = { i, anim: q.anim, t: 0, loop: false, dur: (A.nf - 1) / (A.fps || 30) };
    for (let f = 0; f < A.nf; f++) { e.nbSec.t = f / (A.fps || 30); e.o.md.oculto = false; window.__gmnbDib0(e); const c = this.cajaHB(e); if (c) { lo = Math.min(lo, c[0]); hi = Math.max(hi, c[1]); } }
    e.nbSec = antes; e.nbRate = rate; e.o.md.oculto = false; window.__gmnbDib0(e);
    return hi > lo ? { alto: hi - lo, cuadros: A.nf } : null; },
  // la cámara del jugador mirando al nextbot
  mirar(e) { if (!e || !e.vivo) return; const q = gmaEntPos(e), c = vsub(vadd(q, v3(0, 0.6, 0)), CAM.pos); JUG.yaw = Math.atan2(c.x, c.z); JUG.pitch = Math.max(-0.6, Math.min(0.6, Math.atan2(-c.y, Math.hypot(c.x, c.z)))); },
  // grabar cada cuadro: dónde está, qué secuencia, sus pies en el mundo, a qué velocidad va y si el dibujo está al día
  // grabar cada cuadro: dónde está, qué secuencia, sus pies en el mundo, a qué velocidad va; cada 2 cuadros dibujados, el
  // alto de la malla y la caja de su secuencia. Con huir, el jugador se aleja para quedar a 9 m: persigue a toda velocidad
  // durante toda la grabación (los rápidos, a 15 m/s, si no, llegan en menos de un segundo)
  grabar(e, ms, huir) { const S = []; const pies = this.contactos(e); this.S = S; this.on = true; const t0 = performance.now(); const yo = this; let n = 0;
    const f = () => { if (!yo.on || performance.now() - t0 > ms || !e.vivo) { yo.on = false; return; }
      const q = gmaEntPos(e), d = gmnbDef(e), s = e.nbSec, W = e.nbW, L = e.loco && e.loco.st, sq = d && s ? d.M.secuencias[s.i] : null;
      if (huir) { const dx = JUG.pos.x - q.x, dz = JUG.pos.z - q.z, l = Math.hypot(dx, dz) || 1; if (l < 9) { JUG.pos.x = q.x + dx / l * 9; JUG.pos.z = q.z + dz / l * 9; JUG.vel.set(0, 0, 0); } }
      // (la cámara mira al nextbot: así se dibuja en cada cuadro y sus huesos están al día)
      yo.mirar(e);
      const dib = e.__tDib === TIEMPO.t, m = dib && (n++ % 2 === 0) ? yo.malla(e) : null, sqi = sq && !sq.inc && !sq.grid ? sq : null;
      S.push({ t: TIEMPO.t, x: q.x, y: q.y, z: q.z, jx: JUG.pos.x, jz: JUG.pos.z, sec: sq ? sq.n : null, act: sq ? sq.act : null, gs: d && s ? GMF.secVelSuelo(d.M, s.i, e.poseVals) * gmnbEscala(e) * GS : 0, rate: e.nbRate ?? 1, dib,
        alto: m ? m.alto : null, caja: dib && sqi ? yo.cajaSec(e) : null, hb: dib && sqi ? yo.cajaHB(e) : null, esc: gmnbEscala(e),
        pies: dib && W && pies.length ? pies.map((k) => yo.vertice(e, k)) : null, v: L ? Math.hypot(L.v.x, L.v.z) : 0, quiere: L ? L.vel0 * GS : 0, vida: JUG.vida, vivo: JUG.vivo });
      requestAnimationFrame(f); };
    requestAnimationFrame(f); return pies.length; },
};
// (marca cuándo se dibujó cada nextbot: los huesos de ese cuadro)
if (!window.__gmnbDib0) { window.__gmnbDib0 = gmnbDibujar; gmnbDibujar = function (e) { const r = window.__gmnbDib0(e); if (r) e.__tDib = TIEMPO.t; return r; }; }
1`);
// (con foto a mitad de la grabación, con la cámara mirándolo)
const grabar = async (ms, huir, foto) => { await ev(`window.__NB.grabar(window.__e, ${ms}, ${!!huir})`); await p.waitForTimeout(ms * 0.6); if (foto) await p.screenshot({ path: foto }); await p.waitForTimeout(ms * 0.4 + 300); return ev(`window.__NB.S`); };
// un nextbot de una clase como desde el menú (mirando al jugador), a z metros adelante
const poner = (cls, z) => ev(`(() => { const e = gmLlamar(GMA.R.G.get('__gmCrearNPC'), 'S', '${cls}', GMA.V(v3(0, ${PISO}, ${z})))[0]; if (!(e instanceof LEnt)) return null; e.creador = GMA.jug; window.__e = e; return e.clase; })()`);
const esperarModelo = async (ms = 15000) => { for (let t = 0; t < ms; t += 250) { if (await ev(`(() => { const e = window.__e; return !!(e && e.vivo && gmnbDef(e) && e.nbSec && e.nbW); })()`)) return true; await p.waitForTimeout(250); } return false; };
const med = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const r2 = (x, n = 2) => (x == null ? null : +(+x).toFixed(n));
const moda = (a) => { const c = new Map(); for (const x of a) if (x) c.set(x, (c.get(x) || 0) + 1); let m = null, k = 0; for (const [x, n] of c) if (n > k) { k = n; m = x; } return m; };
// el tamaño: de cada secuencia propia (no mezcla) con ≥ 15 muestras, el mayor alto de la caja de las hitboxes con los
// huesos dibujados contra la caja que guardó studiomdl para esa secuencia, por la escala; y el alto de la malla. Si
// ninguna es propia (las del SCP-049 vienen de modelos incluidos), contra la pose de enlace del modelo
function tamano(S) {
  const por = new Map(); for (const s of S) if (s.hb != null && s.caja > 0) { const x = por.get(s.sec) || { n: 0, lo: 1e9, hi: -1e9, caja: s.caja * s.esc, alto: 0 }; x.n++; x.lo = Math.min(x.lo, s.hb[0]); x.hi = Math.max(x.hi, s.hb[1]); x.alto = Math.max(x.alto, s.alto || 0); por.set(s.sec, x); }
  const L = [...por.entries()].filter(([, x]) => x.n >= 15).sort((a, b) => b[1].n - a[1].n);
  if (L.length) { const [sec, x] = L[0]; return { ref: 'caja', sec, hb: r2(x.hi - x.lo), esperado: r2(x.caja), malla: r2(x.alto), n: x.n }; }
  const sec = moda(S.filter((s) => s.alto != null).map((s) => s.sec)), M = S.filter((s) => s.sec === sec && s.alto != null); if (!M.length) return null;
  return { ref: 'enlace', sec, malla: r2(Math.max(...M.map((s) => s.alto))), esperado: null, n: M.length };
}

// velocidad y patinar de una grabación: la del cuerpo (mediana, mientras está a más de 3 m) y, de cada punto que se apoya
// (su altura llega a ≤ 6 cm del piso), cuánto se mueve en el mundo mientras está apoyado, sobre lo que avanza el cuerpo. Un
// pie que no resbala da 0; con el paso de la animación mal puesto resbalan todos: se toma el que menos (el zombie arrastra
// un pie a propósito)
function analizar(S) {
  const L = S.filter((s) => s.dib && s.pies), vb = [], porPie = [];
  for (let i = 1; i < S.length; i++) { const a = S[i - 1], z = S[i], dt = z.t - a.t; if (dt <= 0) continue; if (Math.hypot(z.x - z.jx, z.z - z.jz) > 3) vb.push(Math.hypot(z.x - a.x, z.z - a.z) / dt); }
  const nP = L.length && L[0].pies ? L[0].pies.length : 0;
  for (let k = 0; k < nP; k++) {
    const h = L.map((s) => (s.pies[k] ? s.pies[k][1] - s.y : NaN)), hv = h.filter(Number.isFinite); if (!hv.length) continue;
    const lo = Math.min(...hv), hi = Math.max(...hv); if (lo > 0.06) continue;
    const umbral = lo + Math.max(0.02, 0.12 * (hi - lo)), v = [], rel = [];
    for (let i = 1; i < L.length; i++) { const a = L[i - 1], z = L[i], dt = z.t - a.t; if (dt <= 0 || dt > 0.1 || !a.pies[k] || !z.pies[k]) continue; if (h[i] > umbral || h[i - 1] > umbral) continue; if (Math.hypot(z.x - z.jx, z.z - z.jz) < 3) continue; const bx = (z.x - a.x) / dt, bz = (z.z - a.z) / dt, vc = Math.hypot(bx, bz); if (vc < 0.2) continue;
      const fx = (z.pies[k][0] - a.pies[k][0]) / dt, fz = (z.pies[k][2] - a.pies[k][2]) / dt; v.push(Math.hypot(fx, fz) / vc); rel.push(Math.hypot(fx - bx, fz - bz) / vc); }   // (rel: la velocidad del pie respecto del cuerpo sobre la del cuerpo; sin patinar, 1)
    if (v.length >= 3) porPie.push([med(v), med(rel)]);
  }
  porPie.sort((a, b) => a[0] - b[0]);
  return { v: med(vb), patina: porPie.length ? porPie[0][0] : null, piesCuerpo: porPie.length ? porPie[0][1] : null, patinaPies: porPie.slice(0, 6).map((x) => r2(x[0])), apoyos: porPie.length };
}
// (la altura de la unión de hitboxes de cada secuencia de los NPC de HL2, decodificando la animación como el motor —el
// lector de Source del proyecto, herramientas/source_mdl.py, con los bloques del .ani—, en metros: en estos modelos la caja
// que guarda el .mdl es 2-12 % más alta que lo que da su propia animación —así vienen compilados—, así que para
// ellos la referencia es esta; en los del Workshop las dos coinciden al centésimo)
const MOTOR = {
  'models/zombie/classic.mdl': {'Idle01': 1.855, 'walk4': 1.942, 'FireWalk': 1.93, 'FireIdle': 1.925, 'attackA': 2.202, 'attackB': 1.903, 'attackC': 1.973, 'attackD': 1.885, 'attackE': 2.384, 'attackF': 2.37, 'swatleftmid': 1.916, 'swatrightmid': 1.914, 'swatleftlow': 2.151, 'swatrightlow': 2.008, 'releasecrab': 2.071, 'Tantrum': 1.893, 'WallPound': 2.123},
  'models/antlion.mdl': {'Idle': 1.597, 'DistractIdle2': 1.587, 'DistractIdle3': 1.689, 'DistractIdle4': 1.609, 'RunAgitated': 1.59, 'attack1': 2.503, 'attack2': 2.528, 'attack3': 2.372, 'attack4': 2.397, 'attack5': 2.337, 'attack6': 2.606, 'charge_start': 2.386, 'charge_run': 1.865, 'charge_end': 2.089, 'pounce': 2.066, 'pounce2': 2.089, 'distract': 2.004, 'distract_arrived': 1.907, 'spit': 2.004, 'headturn': 1.53, 'frustration': 2.395},
};
const BOTS = [
  // clase, nombre, a cuántos metros aparece, velocidad esperada (null: la de suelo de su animación), qué ataque mata
  { cls: 'npc_drg_zombie', nom: 'zombie_drgbase', z: 9, ataque: /attack|melee|swat/i },
  { cls: 'npc_drg_antlion', nom: 'hormiga_drgbase', z: 12, ataque: /attack|melee/i },
  { cls: 'npc_drg_cartoon_cat_vb', nom: 'cartoon_cat_drgbase', z: 14, ataque: /attack|grab|slap|execution/i },
  { cls: 'doroxd', nom: 'doro_drgbase', z: 14, ataque: null },   // (Doro no tiene animación de ataque: explota al tocarte)
  { cls: 'npc_scp_049', nom: 'scp049_3d', z: 12, ataque: null },
];
const RES = {};
// (SOLO=clase,clase: sólo esos, para probar uno; sin F ni H)
const SOLO = process.env.SOLO ? process.env.SOLO.split(',') : null;
if (SOLO) BOTS.splice(0, BOTS.length, ...BOTS.filter((B) => SOLO.includes(B.cls)));
for (const B of BOTS) {
  const r = (RES[B.cls] = { nom: B.nom });
  // ---------- A, B, D: persiguiendo en campo abierto ----------
  await ev(limpiar); await p.waitForTimeout(300);
  r.clase = await poner(B.cls, B.z); r.cargo = await esperarModelo();
  // (lo que pide su Lua: velocidades, escala, UseWalkframes)
  r.lua = await lua(`local e = ents.FindByClass('${B.cls}')[1] if not IsValid(e) then return {} end return { walk = e.WalkSpeed, run = e.RunSpeed, wf = e.UseWalkframes and true or false, ms = e:GetModelScale(), drg = e.IsDrGNextbot and true or false }`);
  const S = await grabar(3500, true, `${D}/ia_${B.nom}_persigue.png`);
  await ev(`(() => { JUG.pos.set(window.__e ? gmaEntPos(window.__e).x : 0, JUG.pos.y, window.__e ? gmaEntPos(window.__e).z - 4 : 0); return 1; })()`);
  // D: la secuencia que se ve contra la que pide el Lua (cada 150 ms, aparte)
  const pedidos = [];
  const pedido = () => lua(`local e = ents.FindByClass('${B.cls}')[1] if not IsValid(e) then return {} end
      local quiere, como = nil, ''
      if e.IsDrGNextbot then if e:IsPlayingAnimation() then quiere = e:GetSequence() como = 'seq' else local a = e:OnUpdateAnimation() if isstring(a) and string.StartWith(a, 'ACT_') then a = e:GetActivityIDFromName(a) end
        if isnumber(a) then quiere = a como = 'act' elseif isstring(a) then quiere = e:LookupSequence(a) como = 'seq' end end
      else quiere = e:GetActivity() como = 'act' end
      local s = e:GetSequence() local ok = (como == 'seq' and s == quiere) or (como == 'act' and e:GetSequenceActivity(s) == quiere)
      return { ok = ok, sec = e:GetSequenceName(s), como = como, quiere = tostring(quiere), mueve = e.loco:GetVelocity():Length() > 12, ataque = e.IsDrGNextbot and e:IsAttacking() or false }`);
  // (DrGBase cambia la animación cada 0,1 s —UpdateAnimation, igual en GMod—: si justo cambió lo que quiere, se mira otra
  // vez 150 ms después; vale si para entonces ya está la que pide)
  for (let k = 0; k < 16; k++) { let x = await pedido(); if (!x.ok) { await p.waitForTimeout(150); const y = await pedido(); if (y.ok) x = Object.assign(y, { tarde: true }); } pedidos.push(x); await p.waitForTimeout(90); }
  r.D = { muestras: pedidos.length, bien: pedidos.filter((x) => x.ok).length, tarde: pedidos.filter((x) => x.tarde).length, sinSec: S.filter((s) => !s.sec).length, secs: [...new Set(S.map((s) => s.sec))].slice(0, 6), mal: pedidos.filter((x) => !x.ok).slice(0, 3) };
  // B: la velocidad y los pies
  const lejos = S.filter((s) => Math.hypot(s.x - s.jx, s.z - s.jz) > 3), an = analizar(S), quiere = med(lejos.map((s) => (r.lua.wf ? s.gs : s.quiere)));
  r.B = Object.assign(an, { esperada: r2(quiere), gs: r2(med(lejos.map((s) => s.gs))), rate: r2(med(lejos.map((s) => s.rate))), sec: moda(lejos.map((s) => s.sec)) });
  r.B.v = r2(r.B.v); r.B.patina = r2(r.B.patina); r.B.piesCuerpo = r2(r.B.piesCuerpo);
  r.B.walkframes = (r.B.gs || 0) > 0.05;
  // al llegar (el jugador quieto a 4 m): ¿anima un ataque? (grabando: también da muestras de las secuencias de ataque y
  // de quieto para el tamaño)
  const S2 = await grabar(3000, false, `${D}/ia_${B.nom}_ataca.png`);
  const ataques = new Set(S2.map((s) => s.sec).filter((x) => x && B.ataque && B.ataque.test(x)));
  r.D.ataques = [...ataques];
  // (quieto, con la IA apagada —la herramienta de DrGBase—: su animación de quieto, para el tamaño)
  let S3 = [];
  if (r.lua.drg) { await lua(`local e = ents.FindByClass('${B.cls}')[1] if IsValid(e) and e.DisableAI then e:DisableAI() end return 1`); await p.waitForTimeout(600); S3 = await grabar(2000, false); await lua(`local e = ents.FindByClass('${B.cls}')[1] if IsValid(e) and e.EnableAI then e:EnableAI() end return 1`); }
  // (primero la secuencia de perseguir; si es una mezcla —run_all de la hormiga, walk del zombie: su caja es la de las 9
  // direcciones— o de un modelo incluido, la de quieto y si no, la de pegar)
  r.A = tamano(S); for (const X of [S3, S2]) { if (r.A && r.A.ref === 'caja') break; const a2 = tamano(X); if (a2 && (a2.ref === 'caja' || !r.A)) r.A = a2; }
  // (y esa secuencia entera, cuadro por cuadro: en la partida puede no haberse visto el cuadro más alto)
  if (r.A && r.A.ref === 'caja') { const bz = await ev(`(() => { const e = window.__e; return e && e.vivo ? window.__NB.barrer(e, ${JSON.stringify(r.A.sec)}) : null; })()`); if (bz) { r.A.hbJugando = r.A.hb; r.A.hb = r2(bz.alto); r.A.cuadros = bz.cuadros; } }
  // (los de HL2: contra su animación decodificada como el motor, ±2 %)
  const mdlBot = await ev(`(() => { const e = window.__e; return e ? String(e.modelo || '').toLowerCase() : ''; })()`), tabM = MOTOR[mdlBot];
  if (r.A && r.A.ref === 'caja' && tabM && tabM[r.A.sec]) { r.A.ref = 'motor'; r.A.cajaMdl = r.A.esperado; r.A.esperado = r2(tabM[r.A.sec] * (r.lua.ms || 1), 3); }
  if (r.A && r.A.ref === 'enlace') r.A.esperado = r2(await ev(`(() => { const e = window.__e; return e ? window.__NB.enlace(e) * gmnbEscala(e) : null; })()`));
  r.mallaPersigue = r2(Math.max(0, ...S.filter((x) => x.sec === r.B.sec && x.alto != null).map((x) => x.alto)));

  // ---------- C: con una pared de por medio ----------
  await ev(limpiar); await p.waitForTimeout(300);
  const zb = Math.min(B.z, 10), zw = zb / 2;
  // (la pared: dos paredes del juego —wall_15, 2,11 m × 2,32 m × 0,2 m— una al lado de la otra, quietas, a mitad de camino)
  const ancho = await ev(`(() => { const L = []; for (const x of [-1.055, 1.055]) { const o = crearObjeto('wall_15', v3(x, ${PISO}, ${zw}), new Quat(), { congelado: true }); if (o) { o.b.frozen = true; o.b.updateWorld(); L.push(o); } } window.__pared = L; if (!L.length) return 0; return Math.max(...L.map((o) => Math.abs(o.b.aabb.x1))); })()`);
  await ev(`(() => { GMNB.rutas = { n: 0, ms: 0, max: 0 }; return 1; })()`);
  await poner(B.cls, zb); await esperarModelo();
  // (el que no ve al jugador detrás de la pared igual lo persigue: como si lo hubiera oído, SpotEntity)
  await lua(`local e = ents.FindByClass('${B.cls}')[1] if IsValid(e) and e.SpotEntity then e:SpotEntity(player.GetAll()[1]) end return 1`);
  const t0 = await ev(`TIEMPO.t`);
  const SC = []; let llego = null, quietoMax = 0, quietoDesde = null, foto = false;
  const vEsp = Math.max(0.3, r.B.esperada || r.B.v || 1);
  const rodeo = 2 * Math.hypot(zw, (ancho || 2.11) + 0.5), tope = 1.5 * rodeo / vEsp + 3;
  for (let k = 0; k < Math.ceil(tope / 0.2) + 10 && llego === null; k++) {
    const s = await ev(`(() => { const e = window.__e; if (!e || !e.vivo) return null; const q = gmaEntPos(e), d = gmnbDef(e); return { t: TIEMPO.t, x: q.x, z: q.z, d: Math.hypot(q.x - JUG.pos.x, q.z - JUG.pos.z), sec: e.nbSec && d ? d.M.secuencias[e.nbSec.i].n : null }; })()`);
    if (!s) break; SC.push(s);
    // (llegó: a ≤ 2,2 m o ya empezó a pegarle —los grandes, como el Cartoon Cat, pegan desde su alcance—)
    if (s.d <= 2.2 || (B.ataque && s.sec && B.ataque.test(s.sec) && s.d < 4.5)) llego = s.t - t0;
    const a = SC.length > 1 ? SC[SC.length - 2] : null;
    if (a && Math.hypot(s.x - a.x, s.z - a.z) < 0.01) { quietoDesde = quietoDesde ?? a.t; quietoMax = Math.max(quietoMax, s.t - quietoDesde); } else quietoDesde = null;
    if (!foto && Math.abs(s.x) > (ancho || 2.11) * 0.8 && s.z < zw + 1.5 && s.z > zw - 1.5) { foto = true; await ev(`(() => { window.__NB.mirar(window.__e); JUG.pitch = Math.max(JUG.pitch, 0.25); return 1; })()`); await p.screenshot({ path: `${D}/ia_${B.nom}_rodea.png` }); await ev(`(() => { JUG.pitch = 0.1; return 1; })()`); }
    await p.waitForTimeout(150);
  }
  const rut = await ev(`GMNB.rutas || { n: 0, ms: 0, max: 0 }`);
  r.C = { busquedas: rut.n, msMedio: rut.n ? r2(rut.ms / rut.n, 1) : 0, msMax: r2(rut.max, 1), pared: r2(2 * ancho, 2), llego: r2(llego, 1), tope: r2(tope, 1), rodeo: r2(rodeo, 1), quietoMax: r2(quietoMax, 1), xMax: r2(Math.max(0, ...SC.map((s) => Math.abs(s.x))), 1), foto };

  // ---------- E: con el daño de verdad ----------
  await ev(limpiar); await p.waitForTimeout(300);
  await ev(`(() => { danarJugador = window.__dan0; return 1; })()`);
  await poner(B.cls, 3); await esperarModelo(8000);
  const tE = await ev(`TIEMPO.t`); let murio = null, vidaMin = 100, fotoE = false, primero = null; const logE = [];
  for (let k = 0; k < 200 && murio === null; k++) {
    const s = await ev(`(() => { const e = window.__e, q = e && gmaEntPos(e), d = e && gmnbDef(e); return { t: TIEMPO.t, vida: JUG.vida, vivo: JUG.vivo, d: q ? +Math.hypot(q.x - JUG.pos.x, q.z - JUG.pos.z).toFixed(2) : null, sec: e && e.nbSec && d ? d.M.secuencias[e.nbSec.i].n : null, inmune: !!(JUEGO.dios || (typeof CIC !== 'undefined' && CIC.inmune) || (typeof MODS !== 'undefined' && MODS.invencible)) }; })()`);
    vidaMin = Math.min(vidaMin, s.vida); if (!s.vivo) murio = s.t - tE; if (primero === null && s.vida < 100) primero = s.t - tE;
    if (k % 5 === 0) logE.push([r2(s.t - tE, 1), r2(s.vida, 0), s.d, s.sec, s.inmune ? 'inmune' : '']);
    if (!fotoE && s.vida < 100) { fotoE = true; await ev(`window.__NB.mirar(window.__e)`); await p.screenshot({ path: `${D}/ia_${B.nom}_golpe.png` }); }
    await p.waitForTimeout(200);
  }
  r.E = { primero: r2(primero, 1), murio: r2(murio, 1), vidaMin: r2(vidaMin, 0), log: murio === null ? logE.slice(-6) : undefined };
  await ev(`(() => { danarJugador = () => {}; return 1; })()`);
  // (reaparecer)
  for (let k = 0; k < 40; k++) { if (await ev(`JUG.vivo`)) break; await p.waitForTimeout(250); }
  await p.waitForTimeout(500);
}
await ev(limpiar);

if (SOLO) { console.log(JSON.stringify(RES, null, 1).slice(0, 6000)); await b.close(); process.exit(0); }
// ---------- F: la hormiga león escalada (la herramienta de escala de DrGBase) ----------
await poner('npc_drg_antlion', 14); await esperarModelo();
await lua(`local e = ents.FindByClass('npc_drg_antlion')[1] if IsValid(e) then e:SetScale(1.6) end return 1`);
await p.waitForTimeout(600);
const SF = await grabar(3000, true, `${D}/ia_hormiga_x1.6.png`);
const anF = analizar(SF), lejF = SF.filter((s) => Math.hypot(s.x - s.jx, s.z - s.jz) > 3), secF = moda(lejF.map((s) => s.sec));
await ev(`(() => { JUG.pos.set(window.__e ? gmaEntPos(window.__e).x : 0, JUG.pos.y, window.__e ? gmaEntPos(window.__e).z - 4 : 0); return 1; })()`);
const SF2 = await grabar(3000, false), AF = tamano(SF2);
if (AF && AF.ref === 'caja') { const bz = await ev(`(() => { const e = window.__e; return e && e.vivo ? window.__NB.barrer(e, ${JSON.stringify(AF.sec)}) : null; })()`); if (bz) { AF.hbJugando = AF.hb; AF.hb = r2(bz.alto); AF.cuadros = bz.cuadros; } }
if (AF && AF.ref === 'caja' && MOTOR['models/antlion.mdl'][AF.sec]) { AF.ref = 'motor'; AF.cajaMdl = AF.esperado; AF.esperado = r2(MOTOR['models/antlion.mdl'][AF.sec] * 1.6, 3); }
const F = { esc: r2(med(SF.map((s) => s.esc))), sec: secF, malla: r2(Math.max(0, ...SF.filter((x) => x.sec === secF && x.alto != null).map((x) => x.alto))), mallaSinEscala: RES.npc_drg_antlion.mallaPersigue, cajaHB: AF, v: r2(anF.v), vEsperada: r2(med(lejF.map((s) => s.gs))), vSinEscala: RES.npc_drg_antlion.B.v, patina: r2(anF.patina), piesCuerpo: r2(anF.piesCuerpo) };
await ev(limpiar);

// ---------- H: los de DrGBase también matan a los NPC del juego (el zombie y un ciudadano, con el jugador lejos) ----------
await ev(`(() => { JUG.pos.set(0, ${PISO} + JUG.medio, -30); window.__P = npcCrear('Hero', v3(0, ${PISO}, 5), 0, { modo: 'quieto', vida: 40 }); return !!window.__P; })()`);
await poner('npc_drg_zombie', 10); await esperarModelo();
const tH = await ev(`TIEMPO.t`); let muereNPC = null, vidaNPC = [];
for (let k = 0; k < 120 && muereNPC === null; k++) {
  const s = await ev(`(() => { const P = window.__P; return { t: TIEMPO.t, vida: P ? P.vida : null, vivo: P ? P.vivo !== false : false }; })()`);
  if (k % 10 === 0) vidaNPC.push(r2(s.vida, 0)); if (!s.vivo) muereNPC = s.t - tH;
  if (k === 20) { await ev(`window.__NB.mirar(window.__e)`); await p.screenshot({ path: `${D}/ia_zombie_contra_npc.png` }); }
  await p.waitForTimeout(250);
}
const enemigoH = await lua(`local e = ents.FindByClass('npc_drg_zombie')[1] return IsValid(e) and IsValid(e:GetEnemy()) and e:GetEnemy():GetClass() or 'nadie'`);
const H = { muere: r2(muereNPC, 1), vida: vidaNPC, enemigo: enemigoH };
await ev(limpiar);

// ---------- veredictos ----------
const dentro = (x, y, tol) => x != null && y > 0 && Math.abs(x / y - 1) <= tol;
const fila = (B) => RES[B.cls];
const aOk = (r) => r.A && (r.A.ref === 'motor' ? dentro(r.A.hb, r.A.esperado, 0.02) : r.A.ref === 'caja' ? dentro(r.A.hb, r.A.esperado, 0.05) : dentro(r.A.malla, r.A.esperado, 0.15));
ok('A. tamaño: la caja de las hitboxes dibujada (la secuencia entera) = la de su secuencia en el .mdl × ModelScale ±5 % (HL2: la de su animación decodificada como el motor ±2 %; incluidas: la malla contra su pose de enlace ±15 %)', BOTS.every((B) => aOk(fila(B))), BOTS.map((B) => ({ bot: B.nom, ...fila(B).A, ok: aOk(fila(B)) })));
const bvOk = (r) => r.B && dentro(r.B.v, r.B.esperada, 0.15);
const bpOk = (r) => !r.B.walkframes || (r.B.piesCuerpo != null && Math.abs(r.B.piesCuerpo - 1) <= 0.15);
ok('B1. velocidad persiguiendo: la que pide su Lua (WalkSpeed/RunSpeed, o la de suelo de su animación con UseWalkframes) ±15 %', BOTS.every((B) => bvOk(fila(B))), BOTS.map((B) => ({ bot: B.nom, v: fila(B).B.v, esperada: fila(B).B.esperada, wf: fila(B).lua.wf, sec: fila(B).B.sec, ok: bvOk(fila(B)) })));
ok('B2. sin patinar: con walkframes, el pie apoyado va respecto del cuerpo a la velocidad del desplazamiento ±15 % (y cuánto resbala en el mundo)', BOTS.every((B) => bpOk(fila(B))), BOTS.map((B) => ({ bot: B.nom, walkframes: fila(B).B.walkframes, piesCuerpo: fila(B).B.piesCuerpo, patina: fila(B).B.patina, pies: fila(B).B.patinaPies, rate: fila(B).B.rate, gs: fila(B).B.gs, ok: bpOk(fila(B)) })));
const cOk = (r) => r.C && r.C.llego != null && r.C.llego <= r.C.tope && r.C.quietoMax <= 1.5;
ok('C. con una pared de por medio la rodea y alcanza al jugador en ≤ 1,5 × rodeo / velocidad + 3 s, sin quedarse quieto > 1,5 s', BOTS.every((B) => cOk(fila(B))), BOTS.map((B) => ({ bot: B.nom, ...fila(B).C, ok: cOk(fila(B)) })));
const dOk = (r, B) => r.cargo && r.D.bien >= 0.9 * r.D.muestras && r.D.sinSec === 0 && (!B.ataque || r.D.ataques.length >= 1);
ok('D. la animación que se ve es la que pide su Lua (≥ 90 %, a lo sumo 0,15 s después de pedirla), nunca ninguna, y al llegar una de ataque', BOTS.every((B) => dOk(fila(B), B)), BOTS.map((B) => ({ bot: B.nom, bien: fila(B).D.bien + '/' + fila(B).D.muestras, tarde: fila(B).D.tarde, sinSec: fila(B).D.sinSec, secs: fila(B).D.secs, ataques: fila(B).D.ataques, mal: fila(B).D.mal, ok: dOk(fila(B), B) })));
const eOk = (r) => r.E && r.E.primero != null && r.E.primero <= 5 && r.E.murio != null && r.E.murio <= 40;
ok('E. matan: desde 3 m el jugador pierde vida en ≤ 5 s y muere en ≤ 40 s (la hormiga de ejemplo pega 5 por golpe; el zombie, 10)', BOTS.every((B) => eOk(fila(B))), BOTS.map((B) => ({ bot: B.nom, ...fila(B).E, ok: eOk(fila(B)) })));
const fOk = Math.abs(F.esc - 1.6) < 0.01 && dentro(F.malla, 1.6 * (F.mallaSinEscala || 0), 0.05) && F.cajaHB && (F.cajaHB.ref === 'motor' ? dentro(F.cajaHB.hb, F.cajaHB.esperado, 0.02) : F.cajaHB.ref === 'caja' && dentro(F.cajaHB.hb, F.cajaHB.esperado, 0.05)) && dentro(F.v, F.vEsperada, 0.15) && dentro(F.v, 1.6 * (F.vSinEscala || 0), 0.15) && F.piesCuerpo != null && Math.abs(F.piesCuerpo - 1) <= 0.15;
ok('F. la hormiga león con SetScale(1,6): la malla 1,6 veces más alta que sin escala (±5 %), la caja de sus hitboxes la de GMod × 1,6 (±2 % contra su animación decodificada como el motor), 1,6 veces más rápida (±15 %) y sin patinar (pies/cuerpo 1 ±15 %)', fOk, F);
ok('H. el zombie de DrGBase persigue y mata a un NPC del juego (40 de vida) en ≤ 25 s', H.muere != null && H.muere <= 25, H);
const le = await ev(`GMA.errores.slice(${lua0}).map((x) => String(x.msg || x).slice(0, 200)).slice(0, 5)`);
const ej = err.slice(js0).filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('G. sin errores de Lua ni de JS', !le.length && !ej.length && Object.values(inst).every((x) => !x.err.length), { lua: le, js: ej.slice(0, 4), inst: Object.fromEntries(Object.entries(inst).map(([k, x]) => [k, x.err])) });
fs.writeFileSync(`${D}/nextbots_ia.json`, JSON.stringify({ RES, F, H }, null, 1));
// la hoja: todas las fotos en una
try { execFileSync('python3', ['-I', '-c', `import sys, glob, os
from PIL import Image, ImageDraw
L = sorted(glob.glob(os.path.join(sys.argv[1], 'ia_*.png')))
if L:
    w, h = 320, 180; cols = 4; rows = (len(L) + cols - 1) // cols; H = Image.new('RGB', (cols * w, rows * (h + 16)), (20, 20, 20)); d = ImageDraw.Draw(H)
    for i, f in enumerate(L):
        im = Image.open(f).convert('RGB').resize((w, h)); x, y = (i % cols) * w, (i // cols) * (h + 16); H.paste(im, (x, y + 16)); d.text((x + 4, y + 2), os.path.basename(f)[3:-4], fill=(255, 255, 255))
    H.save(os.path.join(sys.argv[1], 'nextbots_hoja.jpg'), quality=84)`, D]); } catch (e) { console.log('hoja: ' + e.message); }
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
await b.close(); process.exit(R0.every(Boolean) ? 0 : 1);
