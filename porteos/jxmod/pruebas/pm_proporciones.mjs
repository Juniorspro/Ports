// modelos de jugador del Workshop con el «truco de las proporciones» (bug de Discord: el perro Doge con el pecho y las
// patas de adelante estirados como una sábana). Sus animaciones son de otro esqueleto y una secuencia «proportions»
// (autoplay, de diferencia) lleva cada hueso a las medidas del modelo, como hace el motor de Source en cada cuadro.
//  1. el Doge: en todas sus animaciones (quieto, caminar, correr, agachado, saltar; varios cuadros de cada una) cada hueso
//     tiene el largo que tiene en el modelo (±2 %; antes, sin la capa, hasta 10 unidades de diferencia); quieto, la piel
//     queda como en reposo (borde más estirado ≤ 1,05 veces) y en las demás el 99 % de los bordes se estira ≤ 1,6 veces
//     (lo que queda es la flexión de hombros y rodillas al galopar, como en GMod con la misma piel)
//  2. caminar y correr toman la celda de la mezcla de «para adelante» (move_x = 1, move_y = 0), no una esquina
//  3. en todos los modelos de jugador de la carpeta que usan capas: su primera secuencia + las capas = la pose de enlace
//     (cada hueso a ≤ 0,05 unidades y ≤ 1° de donde está en reposo; la raíz no cuenta: en Source va en otro espacio)
//  4. en los que no tienen capas, la pose no cambia nada (lo de antes queda igual)
//  5. jugando con el Doge: lo más bajo de la piel en el piso quieto (±4 cm) y, quieto y corriendo, el origen del modelo en
//     el piso (±1 cm, como en GMod: antes seguía la corrección de los pies del Hero, que no se ve, y se hundía hasta 7 cm)
// uso: node pm_proporciones.mjs URL_HTML URL_CARPETA_GMA [ids separados por coma] [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, G, IDS = '656834283,104491619,106565409,139247091,143190159,158326196,175697854,183901628,193152958,216408135,348376962,391383735,485879458', D = '/tmp/claude-0/pmp'] = process.argv;
import fs from 'fs'; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; 1`);
// (lo que se mide adentro de la página: matrices de Source por hueso, la piel con GMF.posar, los bordes de los triángulos)
await ev(`(() => { window.__pm = {
  leer: async (ruta) => { try { return gmLeerModelo(ruta); } catch (e) { if (e.pendiente) { await new Promise((r) => gmModeloPedir(ruta, r)); return gmLeerModelo(ruta); } throw e; } },
  mundo: (M, ps) => { const H = M.huesos, W = []; for (let i = 0; i < H.length; i++) { const x = ps.Q[i * 4], y = ps.Q[i * 4 + 1], z = ps.Q[i * 4 + 2], w = ps.Q[i * 4 + 3];
      const L = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), ps.P[i * 3], 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), ps.P[i * 3 + 1], 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), ps.P[i * 3 + 2]];
      const pa = H[i].pa; W.push(pa >= 0 && pa < i ? __pm.m34(W[pa], L) : L); } return W; },
  m34: (A, B) => [A[0] * B[0] + A[1] * B[4] + A[2] * B[8], A[0] * B[1] + A[1] * B[5] + A[2] * B[9], A[0] * B[2] + A[1] * B[6] + A[2] * B[10], A[0] * B[3] + A[1] * B[7] + A[2] * B[11] + A[3],
    A[4] * B[0] + A[5] * B[4] + A[6] * B[8], A[4] * B[1] + A[5] * B[5] + A[6] * B[9], A[4] * B[2] + A[5] * B[6] + A[6] * B[10], A[4] * B[3] + A[5] * B[7] + A[6] * B[11] + A[7],
    A[8] * B[0] + A[9] * B[4] + A[10] * B[8], A[8] * B[1] + A[9] * B[5] + A[10] * B[9], A[8] * B[2] + A[9] * B[6] + A[10] * B[10], A[8] * B[3] + A[9] * B[7] + A[10] * B[11] + A[11]],
  // el borde de triángulo más estirado (y el percentil 99) de la malla posada respecto de la de reposo
  estira: (M, ps) => { const W = __pm.mundo(M, ps), S = W.map((w, i) => M.huesos[i].p2b && M.huesos[i].p2b.length >= 12 ? __pm.m34(w, M.huesos[i].p2b) : null), P = GMF.posar(M, { S }).pos, V = M.v.pos, r = [];
    for (const m of M.mallas) for (let t = 0; t + 2 < m.tris.length; t += 3) for (let e = 0; e < 3; e++) { const a = m.tris[t + e], c = m.tris[t + (e + 1) % 3];
      const l0 = Math.hypot(V[a * 3] - V[c * 3], V[a * 3 + 1] - V[c * 3 + 1], V[a * 3 + 2] - V[c * 3 + 2]); if (l0 < 0.05) continue;
      r.push(Math.hypot(P[a * 3] - P[c * 3], P[a * 3 + 1] - P[c * 3 + 1], P[a * 3 + 2] - P[c * 3 + 2]) / l0); }
    r.sort((x, y) => x - y); return { max: +r[r.length - 1].toFixed(2), p99: +r[Math.floor(r.length * 0.99)].toFixed(3) }; },
  // el hueso (menos la raíz) cuyo largo hasta el padre más se aparta del de reposo, en proporción
  largos: (M, ps) => { let e = 0; M.huesos.forEach((h, i) => { if (h.pa < 0) return; const l0 = Math.hypot(h.pos[0], h.pos[1], h.pos[2]); if (l0 < 0.5) return; e = Math.max(e, Math.abs(Math.hypot(ps.P[i * 3], ps.P[i * 3 + 1], ps.P[i * 3 + 2]) - l0) / l0); }); return e; },
  // cuánto se aleja cada hueso (menos la raíz) de su lugar de reposo en una pose
  aReposo: (M, ps) => { let dp = 0, dg = 0; M.huesos.forEach((h, i) => { if (h.pa < 0) return; dp = Math.max(dp, Math.hypot(ps.P[i * 3] - h.pos[0], ps.P[i * 3 + 1] - h.pos[1], ps.P[i * 3 + 2] - h.pos[2]));
      const d = Math.abs(ps.Q[i * 4] * h.q[0] + ps.Q[i * 4 + 1] * h.q[1] + ps.Q[i * 4 + 2] * h.q[2] + ps.Q[i * 4 + 3] * h.q[3]); dg = Math.max(dg, 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI); }); return { dp: +dp.toFixed(3), dg: +dg.toFixed(2) }; },
}; return 1; })()`);
const modelos = [];
for (const id of IDS.split(',')) {
  const r = await ev(`(async () => { const antes = new Set(gmpLista()); const A = await gmInstalar('${id}', { nombre: '${id}' }, new Uint8Array(await (await fetch('${G}/${id}.gma')).arrayBuffer())); await A.listo;
    const nuevos = gmpLista().filter((x) => !antes.has(x)), out = [];
    for (const ruta of nuevos) { let M; try { M = await __pm.leer(ruta); } catch (e) { out.push({ ruta, error: String(e.message || e) }); continue; }
      if (!M || !M.huesos || !M.secuencias || !M.secuencias.length || !M.v) continue;
      const capas = GMF.capas(M).length, s0 = M.secuencias[0].anim, A0 = M.anims[s0], vb = M.huesos.some((h) => /^valvebiped\\.bip01_pelvis$/i.test(h.n));
      if (!A0 || A0.bloque !== 0 || A0.flags & 4) { out.push({ ruta, capas, vb, sinPose: true }); continue; }
      const con = __pm.aReposo(M, GMF.poseCapas(M, s0, 0)), sin = __pm.aReposo(M, GMF.pose(M, s0, 0));
      const igual = capas ? null : (() => { const a = GMF.pose(M, s0, 0), b = GMF.poseCapas(M, s0, 0); let d = 0; for (let k = 0; k < a.P.length; k++) d = Math.max(d, Math.abs(a.P[k] - b.P[k])); for (let k = 0; k < a.Q.length; k++) d = Math.max(d, Math.abs(a.Q[k] - b.Q[k])); return d; })();
      out.push({ ruta, capas, vb, con, sin, igual }); }
    return out; })()`).catch((e) => [{ id, error: String(e).slice(0, 200) }]);
  for (const x of r) modelos.push({ id, ...x });
}
for (const m of modelos) console.log('  ', JSON.stringify(m));
const conCapas = modelos.filter((m) => m.capas > 0 && !m.sinPose && !m.error), sinCapas = modelos.filter((m) => m.capas === 0 && !m.sinPose && !m.error);
// 1 y 2: el Doge, animación por animación
const dg = await ev(`(async () => { const ruta = gmpLista().find((r) => /doge_player\\.mdl$/.test(r)); if (!ruta) return null; const def = gmpDef(ruta) || (await new Promise((r) => setTimeout(r, 1500)), gmpDef(ruta)); if (!def) return null; const M = def.M, S = def.secs, out = {};
  for (const [k, ia] of Object.entries(S)) { if (ia < 0) { out[k] = null; continue; } const A = M.anims[ia], fs = [...new Set([0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => Math.round(t * (A.nf - 1))))];
    let con = { max: 0, p99: 0, largo: 0 }, sin = { max: 0, p99: 0, largo: 0 };
    for (const f of fs) { const pc = GMF.poseCapas(M, ia, f), pn = GMF.pose(M, ia, f), a = __pm.estira(M, pc), b = __pm.estira(M, pn);
      con = { max: Math.max(con.max, a.max), p99: Math.max(con.p99, a.p99), largo: +Math.max(con.largo, __pm.largos(M, pc)).toFixed(3) }; sin = { max: Math.max(sin.max, b.max), p99: Math.max(sin.p99, b.p99), largo: +Math.max(sin.largo, __pm.largos(M, pn)).toFixed(3) }; }
    out[k] = { anim: A.n, cuadros: fs.length, con, sin }; }
  // la celda «para adelante» de la mezcla de caminar y de correr
  const celda = (re) => { const i = M.secuencias.findIndex((q) => re.test(q.act || '')); const q = M.secuencias[i]; if (!q || !q.grid) return { sinMezcla: true };
    const nom = (a) => M.poseParams[q.par[a]], t = [0, 1].map((a) => { const v = nom(a) === 'move_x' ? 1 : 0; return Math.round(Math.max(0, Math.min(1, (v - q.ps[a]) / (q.pe[a] - q.ps[a]))) * (q.g[a] - 1)); });
    return { esperada: M.anims[q.grid[t[0] + t[1] * q.g[0]]].n, primera: M.anims[q.grid[0]].n }; };
  return { ruta, out, camina: { tomada: S.camina >= 0 ? M.anims[S.camina].n : null, ...celda(/^ACT_HL2MP_WALK$/) }, corre: { tomada: S.corre >= 0 ? M.anims[S.corre].n : null, ...celda(/^ACT_HL2MP_RUN$/) } }; })()`);
console.log(JSON.stringify(dg));
const anims = dg ? Object.values(dg.out).filter(Boolean) : [];
ok('el Doge: en todas sus animaciones cada hueso tiene el largo del modelo (±2 %; antes no)', anims.length >= 4 && anims.every((a) => a.con.largo <= 0.02), dg && Object.fromEntries(Object.entries(dg.out).map(([k, a]) => [k, a && { con: a.con.largo, sin: a.sin.largo }])));
ok('y la piel: quieto como en reposo (≤ 1,05) y en el resto el 99 % de los bordes ≤ 1,6 veces (antes, quieto 4,7 veces)', dg && dg.out.quieto && dg.out.quieto.con.max <= 1.05 && anims.every((a) => a.con.p99 <= 1.6), dg && Object.fromEntries(Object.entries(dg.out).map(([k, a]) => [k, a && { max: a.con.max, p99: a.con.p99, antesMax: a.sin.max, antesP99: a.sin.p99 }])));
ok('caminar y correr toman la celda «para adelante» de la mezcla', dg && dg.camina.tomada === dg.camina.esperada && dg.corre.tomada === dg.corre.esperada, dg && { camina: dg.camina, corre: dg.corre });
ok('todos los modelos de jugador con capas: primera secuencia + capas = pose de enlace (≤ 0,05 u y ≤ 1° por hueso)', conCapas.length >= 1 && conCapas.every((m) => m.con.dp <= 0.05 && m.con.dg <= 1), conCapas.map((m) => ({ m: m.ruta.split('/').pop(), con: m.con, sin: m.sin })));
ok('los que no tienen capas quedan igual que antes', sinCapas.length >= 5 && sinCapas.every((m) => m.igual === 0), { n: sinCapas.length, dif: Math.max(0, ...sinCapas.map((m) => m.igual)) });
// 5: jugando, las patas en el piso
const ruta = dg && dg.ruta;
await ev(`PREFS.skin = 'gmpm:${ruta}'; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
// (en tercera persona: en primera el cuerpo propio no se dibuja y su pose no avanza)
await ev(`(JUG.tercera = true, 1)`); await p.waitForTimeout(2500);
// (lo más bajo de la piel en el cuadro que se está mostrando: la malla posada con su animación y sus capas, en el mundo)
const patas = async () => ev(`(() => { const P = JUG.cuerpo, G = P.gmp; if (!G || !G.def || G.sec < 0) return null; const M = G.def.M, An = M.anims[G.sec], fps = An.fps > 0 ? An.fps : 30;
  const f = Math.floor((G.t * fps) % Math.max(1, An.nf - 1)), ps = GMF.poseCapas(M, G.sec, f), W = __pm.mundo(M, ps), S = W.map((w, i) => M.huesos[i].p2b ? __pm.m34(w, M.huesos[i].p2b) : null), V = GMF.posar(M, { S }).pos;
  let mz = Infinity, k0 = 0; for (let k = 0; k < V.length / 3; k++) if (V[k * 3 + 2] < mz) { mz = V[k * 3 + 2]; k0 = k; }
  const yS = G.W[0][13] + GM_S * mz, h = mundoRayo(v3(P.pos.x, P.pos.y + 0.5, P.pos.z), v3(0, -1, 0), 4), piso = h ? P.pos.y + 0.5 - h.t : null;
  return { sec: An.n, t: +G.t.toFixed(2), suela: piso === null ? null : +(yS - piso).toFixed(3), origen: piso === null ? null : +(G.W[0][13] - piso).toFixed(3), anim: +(GM_S * mz).toFixed(3) }; })()`);
const quieto = await patas();
await ev(`(() => { ENT.y = 1; return 1; })()`); await p.waitForTimeout(1200);
const andando = []; for (let i = 0; i < 6; i++) { await ev(`(ENT.y = 1, 1)`); andando.push(await patas()); await p.waitForTimeout(150); }
await ev(`(ENT.y = 0, 1)`);
await ev(`(() => { document.body.classList.add('ocultarHUD'); return 1; })()`); await p.waitForTimeout(600);
await p.locator('#cv').screenshot({ path: D + '/doge.png' });
// (los dedos de las patas: lo más bajo de cada una; la piel va un poco por debajo del hueso)
const minQ = quieto && quieto.suela !== null ? quieto.suela : 99;
ok('jugando: el Doge quieto apoya las patas en el piso (lo más bajo de la piel a ±4 cm)', Math.abs(minQ) <= 0.04, quieto);
const minA = andando.filter(Boolean).map((a) => a.suela);
// (corriendo, la piel sube y baja lo que trae la animación —al galope hay un momento con las cuatro patas en el aire—: lo
// que el juego tiene que hacer es lo de GMod, el origen del modelo en el piso en cada cuadro)
ok('y caminando/corriendo (con su animación, que avanza): el origen del modelo en el piso en cada cuadro (±1 cm), como en GMod', andando.length >= 4 && andando.every((a) => a && a.origen !== null && Math.abs(a.origen) <= 0.01 && /walk|run/i.test(a.sec)) && andando[andando.length - 1].t > andando[0].t, { origen: andando.map((a) => a && a.origen), pielSegunAnim: minA, sec: andando.map((a) => a && a.sec + '@' + a.t) });
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
