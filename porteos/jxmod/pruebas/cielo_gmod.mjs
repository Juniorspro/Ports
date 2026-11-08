// Cielo de GMod (Discord, noviembre de 2026: «los mapas descargados que usen la skybox de GMod, incluido gm_construct»;
// «el cielo tiene que ser celeste como en el gm_construct original»; «los objetos se ponen naranjas»).
//  1. gm_construct y gm_flatgrass: el cielo es el «painted» de GMod (el celeste de siempre: medido de sus caras) y se ve
//     igual en Alto, Medio y Bajo (la parte alta del cielo, a ≤ 14 por canal del color del «painted» a esa altura)
//  2. un mapa del Workshop (ph_no1office, cielo sky_day01_01 de HL2): con el contenido base, su cielo de verdad (caras
//     propias, no el «painted»); sin el contenido base (sin red), el «painted» en vez del degradé del juego
//  3. en ninguno de esos hay grieta del evento
//  4. el sol de los mapas del Workshop: el brillo de Source va lineal (en lineal, color × brillo; antes, brillo^2,2)
//  5. sin errores de JS
// uso: node cielo_gmod.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, GMA, D = '/tmp/claude-0/ev4/prueba'] = process.argv;
import fs from 'fs'; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, false);
const J = async (s) => ev(s);
const espera = (s) => ev(`new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + ${s} || performance.now() - r0 > 30000 ? ok(1) : setTimeout(f, 20)); f(); })`);
const mapa = async (m) => { await ev(`(() => { inicioMostrar(false); empezarPartida(${JSON.stringify(m)}); return 1; })()`); await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), m, { timeout: 300000 }); await espera(1.5); };
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.resDin = false; GFX.auto = false; 1`);
// el color del «painted» a la altura de un píxel (para comparar): la dirección del píxel → la cara del cubo y la fila
const colorPainted = `((d) => { const ax = Math.abs(d.x), ay = Math.abs(d.y), az = Math.abs(d.z); if (ay >= Math.max(ax, az)) return [126, 188, 255];
  const t = Math.min(1, ay / Math.max(ax, az)) * 16, i = Math.min(15, Math.floor(t)), f = t - i, P = CIELO_PAINTED; return [0, 1, 2].map((k) => P[16 - i][k] + (P[16 - i - 1][k] - P[16 - i][k]) * f); })`;
// muestra el cielo de la pantalla (filas de arriba, donde no hay nada del mapa) contra el «painted»
const medir = async (n) => {
  await ev(`(() => { JUG.pitch = -0.75; for (const e of document.querySelectorAll('#aviso, .aviso')) e.style.visibility = 'hidden'; return 1; })()`); await espera(0.8);
  // (sin el arma ni la mira: sólo el cielo)
  const png = (await p.screenshot({ path: D + '/' + n + '.png' })).toString('base64');
  return ev(`(async () => {
    const im = new Image(); im.src = 'data:image/png;base64,${png}'; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const IVP = M4.inv(R.vp), cp = ${colorPainted}; let peor = 0, n = 0;
    for (let py = 90; py < 200; py += 22) for (let px = 200; px < 1080; px += 110) {
      const nx = px / innerWidth * 2 - 1, ny = 1 - py / innerHeight * 2, v = [nx, ny, 1, 1], w = [0, 0, 0, 0];
      for (let r = 0; r < 4; r++) w[r] = IVP[r] * v[0] + IVP[4 + r] * v[1] + IVP[8 + r] * v[2] + IVP[12 + r] * v[3];
      const d = v3(w[0] / w[3] - R.camPos.x, w[1] / w[3] - R.camPos.y, w[2] / w[3] - R.camPos.z).norm(), e = cp(d), q = x.getImageData(px, py, 1, 1).data;
      peor = Math.max(peor, Math.abs(q[0] - e[0]), Math.abs(q[1] - e[1]), Math.abs(q[2] - e[2])); n++;
    }
    return { peor: Math.round(peor), n, cuboPainted: R.cielo.cuboPx === cieloPainted(64), salida: R.salida };
  })()`);
};
// ---------------- 1 y 3: gm_construct y gm_flatgrass ----------------
const g1 = {};
for (const m of ['RB_Construct', 'RB_Flatgrass']) {
  await mapa(m);
  // (arriba de todo, donde sólo hay cielo: en gm_construct hay edificios alrededor de la aparición)
  await ev(`(() => { JUG.noclip = true; JUG.pos.y += 60; JUG.vel.set(0, 0, 0); return 1; })()`);
  for (const g of ['alto', 'medio', 'bajo']) { await ev(`(() => { PREFS.gfx = '${g}'; aplicarGfx(); return 1; })()`); await espera(0.6); g1[m + '_' + g] = await medir(m + '_' + g); }
  g1[m + '_grieta'] = await J(`EVT.grieta`);
}
ok('1. gm_construct y gm_flatgrass: el cielo «painted» de GMod en Alto, Medio y Bajo (≤ 14 por canal del color esperado; en Alto ≤ 22, por el color y el contraste del posproceso)', Object.entries(g1).filter(([k]) => !/grieta/.test(k)).every(([, x]) => x.cuboPainted && x.peor <= (x.salida === 'hdr' ? 22 : 14)), g1);
// ---------------- 2: un mapa del Workshop con su cielo de HL2 ----------------
const ins = await J(`(async () => { const b = new Uint8Array(await (await fetch('${GMA}/143190159.gma')).arrayBuffer()); await gmInstalar('143190159', { nombre: 'ph', sinDeps: true }, b); return [...GBSP.mapas].filter(([k, x]) => x.id === '143190159').map(([k]) => k); })()`);
const ws = ins.find((x) => /no1office/.test(x));
await mapa(ws);
const conBase = await J(`({ cubo: !!R.cielo.cuboPx, painted: R.cielo.cuboPx === cieloPainted(64), grieta: EVT.grieta, L: R.cielo.cuboPx && R.cielo.cuboPx.L })`);
await p.screenshot({ path: D + '/ws_con_base.png' });
// (sin el contenido base: como si no hubiera red; el mapa se vuelve a armar desde cero)
await J(`(async () => { GBS.idx = null; GBS.prom = Promise.resolve(); for (const M of [GML.datos, GMOD.arch, GMPZ.cache]) if (M) for (const k of [...M.keys()]) if (/skybox\\//i.test(k)) M.delete(k); delete DATA.aj[${JSON.stringify(ws)}]; delete DATA.esc[${JSON.stringify(ws)}]; return 1; })()`);
await mapa('FlatGrass'); await mapa(ws);
const sinBase = await J(`({ cubo: !!R.cielo.cuboPx, painted: R.cielo.cuboPx === cieloPainted(64), grieta: EVT.grieta })`);
ok('2. mapa del Workshop: con el contenido base, su propio cielo; sin él, el «painted» de GMod', conBase.cubo && !conBase.painted && sinBase.painted, { conBase, sinBase });
ok('3. sin grieta en gm_construct, gm_flatgrass ni en el mapa del Workshop', g1.RB_Construct_grieta === false && g1.RB_Flatgrass_grieta === false && conBase.grieta === false && sinBase.grieta === false);
// ---------------- 4: el sol (un mapa abierto, con light_environment) ----------------
const ins2 = await J(`(async () => { const b = new Uint8Array(await (await fetch('${GMA}/133364818.gma')).arrayBuffer()); await gmInstalar('133364818', { nombre: 'rh', sinDeps: true }, b); return [...GBSP.mapas].filter(([k, x]) => x.id === '133364818').map(([k]) => k); })()`);
const ws2 = ins2[0]; await ev(`(() => { PREFS.gfx = 'alto'; aplicarGfx(); return 1; })()`); await mapa(ws2);
const sol = await J(`(() => { const esc = DATA.esc[${JSON.stringify(ws2)}] || []; let lz = null; for (const a of esc) for (const x of a) if (x.lz && x.lz.t === 1) lz = x.lz;
  if (!lz) return null; const brillo = Math.pow(lz.i, 2.2), lin = R.lin.solCol, base = lz.c.map((c) => Math.pow(c, 2.2) * brillo * 2.6);
  return { i: +lz.i.toFixed(3), brillo: +brillo.toFixed(3), lin: lin.map((x) => +x.toFixed(3)), esperado: base.map((x) => +x.toFixed(3)) }; })()`);
ok('4. el sol de los mapas de GMod: en lineal, color × brillo (±1 %)', sol && sol.lin.every((x, k) => Math.abs(x - sol.esperado[k]) <= 0.01 * Math.max(1, sol.esperado[k])), sol);
ok('5. sin errores de JS', !err.filter((x) => !/broker|mqtt|tienda|CORS|ERR_FAILED|Failed to load|net::|willRead/i.test(x)).length, err.filter((x) => !/broker|mqtt|tienda|CORS|ERR_FAILED|Failed to load|net::|willRead/i.test(x)).slice(0, 4));
await b.close();
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
process.exit(R.every(Boolean) ? 0 : 1);
