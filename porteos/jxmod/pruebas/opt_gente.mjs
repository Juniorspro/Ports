// mucha gente con modelos de GMod pesados (como un server lleno con personajes del Workshop): 12 personas con Trevor de
// GTA V (31 mil triángulos), Master Chief y SCP-096 paradas a 4-40 m alrededor de la cámara. Para cada calidad mide,
// alternando 3 veces, el cuadro con y sin niveles de detalle: triángulos dibujados y ms de dibujar() (promedio y p95).
// uso: node opt_gente.mjs URL_HTML URL_CARPETA_GMA [calidades=alto,bajo,patata] [celu=0]
import { abrir } from './base.mjs';
const [, , HTML, CARP, CALS = 'alto,bajo,patata', CELU = '0'] = process.argv;
const { b, p, ev } = await abrir(HTML, CELU === '1');
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; PREFS.resDin = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
await ev(`(async () => {
  for (const id of ['216408135', '139247091', '367531149']) { const r = await fetch(${JSON.stringify(CARP)} + '/' + id + '.gma'); const A = await gmInstalar(id, { nombre: id, sinDeps: true }, new Uint8Array(await r.arrayBuffer())); await A.listo; }
  const mods = ['models/grandtheftauto5/trevor.mdl', 'models/halo4/spartans/masterchief_player.mdl', 'models/shaklin/scp/096/scp_096.mdl'], suelo = JUG.pos.y - 0.96;
  JUG.yaw = 0; JUG.pitch = 0; await new Promise((r) => setTimeout(r, 200)); const f = CAM.fwd;
  // (doce, en un abanico delante de la cámara: así se ven todas)
  for (let i = 0; i < 12; i++) { const d = 4 + i * 3.3, a = (i % 2 ? 1 : -1) * (0.12 + (i % 4) * 0.1), x = f.x * Math.cos(a) - f.z * Math.sin(a), z = f.x * Math.sin(a) + f.z * Math.cos(a);
    npcCrear('gmpm:' + mods[i % 3], v3(JUG.pos.x + x * d, suelo, JUG.pos.z + z * d), Math.atan2(-x, -z), { modo: 'quieto', vida: 100 }); }
  return 1; })()`);
await p.waitForTimeout(5000);
const out = {};
for (const cal of CALS.split(',')) {
  await ev(`PREFS.gfx = ${JSON.stringify(cal)}; aplicarGfx(); 1`); await p.waitForTimeout(2000);
  const r = await ev(`(async () => {
    const px0 = GFX.lodPx, M = { con: [], sin: [] }, T = { con: [], sin: [] };
    const d0 = dibujar; let modo = 'sin';
    dibujar = function () { const t = performance.now(); const r = d0.apply(this, arguments); M[modo].push(performance.now() - t); T[modo].push(R.tris); return r; };
    for (let k = 0; k < 6; k++) { modo = k % 2 ? 'con' : 'sin'; GFX.lodPx = modo === 'con' ? px0 : 1e-9; M[modo].push(NaN); T[modo].push(NaN); await new Promise((ok) => setTimeout(ok, 1500)); }
    dibujar = d0; GFX.lodPx = px0;
    const est = (L) => { const s = L.filter((x) => !Number.isNaN(x)).slice(); s.sort((a, b) => a - b); const sum = s.reduce((a, b) => a + b, 0); return { n: s.length, prom: +(sum / Math.max(1, s.length)).toFixed(1), p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1) }; };
    return { W: R.cv.width, H: R.cv.height, msSin: est(M.sin), msCon: est(M.con), trisSin: est(T.sin).prom, trisCon: est(T.con).prom };
  })()`);
  r.menosTris = +((1 - r.trisCon / r.trisSin) * 100).toFixed(1); r.menosMs = +((1 - r.msCon.prom / r.msSin.prom) * 100).toFixed(1);
  out[cal] = r; console.log(cal, JSON.stringify(r));
}
await b.close(); process.exit(0);
