// niveles de detalle de los modelos de los addons: personajes pesados (Trevor de GTA V con 31 mil triángulos, Master
// Chief, SCP-096), cada uno solo a 2,5 / 5 / 10 / 20 / 40 m delante de la cámara. Para cada calidad dibuja el mismo
// cuadro con y sin niveles de detalle (sin avanzar el juego entre medio: el dibujo es determinista) y compara píxel por
// píxel en el rectángulo del personaje; guarda los recortes (sin | con) agrandados.
// Criterios: en Alto/Ultra, ≤ 2 % de los píxeles del rectángulo cambian más de 24 (de 255); en Medio ≤ 4 %; en
// Bajo/Patata ≤ 6 %; armar los niveles tarda ≤ 40 ms por malla; la piel por CPU (aparatos con pocos registros) da lo
// mismo con y sin la lista de vértices del nivel; sin errores. Informa cuántos triángulos se ahorran.
// uso: node gmod_lod.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.resDin = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
// armar los niveles: cuánto tarda cada malla
await ev(`(async () => {
  const g0 = gmLodGen, T = []; gmLodGen = function (P, N, U, S) { const t0 = performance.now(); const r = g0(P, N, U, S); let nt = 0; for (const L of S) nt += L.length / 3; T.push({ ms: +(performance.now() - t0).toFixed(1), tris: nt, niveles: r ? r.map((l) => [+l.s.toFixed(3), l.nt]) : null }); return r; };
  for (const id of ['216408135', '139247091', '367531149']) { const r = await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma'); const A = await gmInstalar(id, { nombre: id, sinDeps: true }, new Uint8Array(await r.arrayBuffer())); await A.listo; }
  window.__T = T; JUG.yaw = 0; JUG.pitch = 0; return 1; })()`);
await p.waitForTimeout(300);
const MODS = ['models/grandtheftauto5/trevor.mdl', 'models/halo4/spartans/masterchief_player.mdl', 'models/shaklin/scp/096/scp_096.mdl'], DIST = [2.5, 5, 10, 20, 40];
// los tres a la misma distancia, separados de costado (sus rectángulos no se tocan); mismo cuadro con y sin niveles
const medir = (d) => ev(`(async () => {
  for (const P of NPC.lista.slice()) npcQuitar(P);
  const f = CAM.fwd, lat = v3(f.z, 0, -f.x), suelo = JUG.pos.y - 0.96, sep = Math.max(1.5, ${d} * 0.3), L = [];
  ${JSON.stringify(MODS)}.forEach((m, i) => { const s = (i - 1) * sep; L.push({ m, P: npcCrear('gmpm:' + m, v3(JUG.pos.x + f.x * ${d} + lat.x * s, suelo, JUG.pos.z + f.z * ${d} + lat.z * s), Math.atan2(-f.x, -f.z) + 0.5, { modo: 'quieto', vida: 100 }) }); });
  await new Promise((r) => setTimeout(r, 1200));
  const cv = R.cv, W = cv.width, H = cv.height, c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const g = c2.getContext('2d', { willReadFrequently: true });
  const foto = () => { dibujar(); g.drawImage(cv, 0, 0); return g.getImageData(0, 0, W, H); };
  // (sin, con y sin otra vez en la misma tarea: si las dos sin difieren, todavía se estaba subiendo alguna textura y se repite)
  const px0 = GFX.lodPx; let niv = {}, A, B, trisA, trisB, estable = false, intentos = 0;
  const igual = (X, Y) => { for (let j = 0; j < X.data.length; j++) if (X.data[j] !== Y.data[j]) return false; return true; };
  // (el dibujo de las personas avanza su animación con TIEMPO.dt en cada llamada: durante las tomas, el tiempo quieto)
  const dt0 = TIEMPO.dt; TIEMPO.dt = 1e-9;
  try {
  for (; intentos < 5 && !estable; intentos++) {
    if (intentos) await new Promise((r) => setTimeout(r, 700));
    niv = {}; GFX.lodPx = 1e-9; A = foto(); trisA = R.tris;
    GFX.lodPx = px0; const enc0 = encolar; encolar = function (mi, sub, mat, M, h) { const n0 = R.nItems; enc0.apply(this, arguments); if (R.nItems > n0 && h) { const it = R.items[R.nItems - 1], k = String(it.m.d.n || '').replace(/^.*\\//, '').replace(/\\.mdl.*$/, ''); niv[k] = Math.max(niv[k] || 0, it.niv || 0); } }; B = foto(); trisB = R.tris; encolar = enc0;
    GFX.lodPx = 1e-9; const A2 = foto(); GFX.lodPx = px0; estable = igual(A, A2);
  }
  } finally { TIEMPO.dt = dt0; }
  const out = L.map(({ m, P }) => {
    const q = (y) => { const v = [P.pos.x, P.pos.y + y, P.pos.z], o = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) o[i] = R.vp[i] * v[0] + R.vp[4 + i] * v[1] + R.vp[8 + i] * v[2] + R.vp[12 + i]; return [(o[0] / o[3] * 0.5 + 0.5) * W, (1 - (o[1] / o[3] * 0.5 + 0.5)) * H]; };
    const a = q(-1.0), c = q(1.0), h = Math.abs(a[1] - c[1]) * 1.1, w = h * 0.45;
    const x0 = Math.max(0, Math.floor(a[0] - w / 2)), x1 = Math.min(W, Math.ceil(a[0] + w / 2)), y0 = Math.max(0, Math.floor(c[1] - h * 0.05)), y1 = Math.min(H, Math.ceil(a[1] + h * 0.05));
    let n = 0, dif = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * W + x) * 4; n++; const dd = Math.max(Math.abs(A.data[o] - B.data[o]), Math.abs(A.data[o + 1] - B.data[o + 1]), Math.abs(A.data[o + 2] - B.data[o + 2])); if (dd > 24) dif++; }
    const nom = m.replace(/^.*\\//, '').replace(/\\.mdl$/, '');
    return { nom, niv: niv[nom] || 0, alto: Math.round(h / 1.1), pct: n ? +(dif / n * 100).toFixed(2) : 0, r: [x0, y0, x1, y1] };
  });
  // (la tira sin | con de los tres, agrandada)
  const X0 = Math.min(...out.map((o) => o.r[0])), Y0 = Math.min(...out.map((o) => o.r[1])), X1 = Math.max(...out.map((o) => o.r[2])), Y1 = Math.max(...out.map((o) => o.r[3]));
  const cw = Math.max(1, X1 - X0), ch = Math.max(1, Y1 - Y0), z = Math.max(1, Math.min(4, Math.floor(260 / ch))), o2 = document.createElement('canvas'); o2.width = cw * z; o2.height = ch * z * 2 + 4; const g2 = o2.getContext('2d'); g2.imageSmoothingEnabled = false;
  const t1 = document.createElement('canvas'); t1.width = W; t1.height = H; const tg = t1.getContext('2d');
  tg.putImageData(A, 0, 0); g2.drawImage(t1, X0, Y0, cw, ch, 0, 0, cw * z, ch * z); tg.putImageData(B, 0, 0); g2.drawImage(t1, X0, Y0, cw, ch, 0, ch * z + 4, cw * z, ch * z);
  return { estable, intentos, trisA, trisB, out, url: o2.toDataURL('image/png') };
})()`);
const tot = {}; let inest = 0;
// (Ultra no se mide aparte: elige igual o más fino que Alto, que es más estricto que él en el tope)
for (const cal of (process.env.CALIDADES || 'alto,medio,bajo,patata').split(',')) {
  await ev(`PREFS.gfx = ${JSON.stringify(cal)}; aplicarGfx(); 1`); await p.waitForTimeout(1200);
  const tope = cal === 'alto' || cal === 'ultra' ? 2 : cal === 'medio' ? 4 : 6; let peor = 0; const filas = [];
  for (const d of DIST) {
    const r = await medir(d);
    fs.writeFileSync(D + `lod_${cal}_${d}.png`, Buffer.from(r.url.split(',')[1], 'base64'));
    for (const o of r.out) { filas.push([o.nom.slice(0, 8), d, o.niv, o.alto, o.pct]); peor = Math.max(peor, o.pct); }
    if (!r.estable) inest++;
    tot[cal] = tot[cal] || [0, 0]; tot[cal][0] += r.trisA; tot[cal][1] += r.trisB;
  }
  ok(`${cal}: lo que cambia en la imagen de cada personaje ≤ ${tope} % (peor ${peor} %) [modelo, m, nivel, alto px, %]`, peor <= tope, filas);
}
for (const cal of Object.keys(tot)) { const [a2, b3] = tot[cal]; console.log(`INFO ${cal}: triángulos sumando las 5 distancias ${a2} → ${b3} (−${((1 - b3 / a2) * 100).toFixed(1)} %)`); }
const T = await ev(`window.__T.filter((x) => x.tris >= 1200)`);
const lentos = T.filter((x) => x.ms > 40);
ok(`armar los niveles: ${T.length} mallas pesadas, la más lenta ${Math.max(...T.map((x) => x.ms))} ms (≤ 40 ms cada una)`, T.length > 0 && !lentos.length, { muestra: T.slice(0, 6), lentos: lentos.length });
ok('cada toma comparada con el cuadro ya estable (las texturas terminadas)', inest === 0, { inestables: inest });
// la piel por CPU: con la lista de vértices del nivel, esos vértices quedan igual que calculando todos
const cpu = await ev(`(() => {
  for (const m of R.mallas) { if (!m || !m.skin || !m.d.lod) continue; const d = m.d;
    const H = new Float32Array(256 * 12); for (let b = 0; b < 256; b++) { const o = b * 12; H[o] = 1; H[o + 5] = 1; H[o + 10] = 1; H[o + 3] = b * 0.001; H[o + 7] = 0.5; H[o + 11] = -b * 0.002; }
    const a = new Float32Array(d.v * 6), c = new Float32Array(d.v * 6); pielCalcular(m, H, a, null); const L = pielVerts(m, d.lod.length); pielCalcular(m, H, c, L);
    let mx = 0; for (const k of L) for (let j = 0; j < 6; j++) mx = Math.max(mx, Math.abs(a[k * 6 + j] - c[k * 6 + j]));
    return { malla: d.n, verts: d.v, usados: L.length, difMax: mx }; }
  return null; })()`);
ok('la piel por CPU con sólo los vértices del nivel da lo mismo en esos vértices', cpu && cpu.difMax < 1e-6 && cpu.usados < cpu.verts, cpu);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
