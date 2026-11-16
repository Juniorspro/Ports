// los mapas de Hyper Sandbox (MAPAS): de cada uno, foto desde la aparición, foto desde arriba y medidas (tamaño, alturas
// del piso, apariciones, cuántos modelos y materiales), para rehacerlos propios con el mismo terreno jugable.
// uso: node mapas_hs.mjs URL_HTML CARPETA [mapas=todos]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/mapas_hs', SOLO = ''] = process.argv; fs.mkdirSync(D, { recursive: true });
const { b, p, err, ev } = await abrir(HTML, false);
const L = SOLO ? SOLO.split(',') : await ev('MAPAS.slice()');
const info = {};
for (const m of L) {
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; aplicarGfx(); inicioMostrar(false); empezarPartida('${m}'); DIA.hora = 13; DIA.aplicada = -1; 1`);
  await p.waitForFunction((mm) => window.__ev(`JUEGO.estado === 'juego' && MUNDO.nombre === '${mm}'`), m, { timeout: 120000 });
  await p.waitForTimeout(2500);
  const I = await ev(`(() => { const lo = MUNDO.lo, hi = MUNDO.hi, S = MUNDO.spawns;
    // (las alturas del piso en una grilla de 24 × 24: cuánto del mapa es piso caminable y a qué altura)
    const N = 24, alt = new Map(); let piso = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = lo.x + (hi.x - lo.x) * (i + .5) / N, z = lo.z + (hi.z - lo.z) * (j + .5) / N; const ys = mundoPisosEn(x, hi.y + 2, z, hi.y - lo.y + 4); if (ys.length) { piso++; const k = Math.round(ys[ys.length - 1]); alt.set(k, (alt.get(k) || 0) + 1); } }
    const mats = new Set(), nodos = []; for (const md of MUNDO.modelos) { for (const x of md.arb || md.A || []) { if (x && x.mt) for (const t of x.mt) mats.add(t); if (x && x.n && nodos.length < 4000) nodos.push(x.n); } }
    const nombres = {}; for (const n of nodos) { const k = n.replace(/[ _.(]*\\(?\\d+\\)?$/, ''); nombres[k] = (nombres[k] || 0) + 1; }
    return { lo: [lo.x, lo.y, lo.z].map((v) => +v.toFixed(1)), hi: [hi.x, hi.y, hi.z].map((v) => +v.toFixed(1)), spawns: S.length, s0: S[0] && [S[0].x, S[0].y, S[0].z].map((v) => +v.toFixed(1)),
      pisoPct: Math.round(piso / (N * N) * 100), alturas: [...alt.entries()].sort((a, c) => c[1] - a[1]).slice(0, 6), modelos: MUNDO.modelos.length, cajas: MUNDO.cajas.length, tris: MUNDO.nt || (MUNDO.T ? MUNDO.T.length / 9 : 0),
      mats: mats.size, texturas: [...new Set(MUNDO.modelos.flatMap((md) => (md.arb || md.A || []).flatMap((x) => (x && x.mt ? x.mt : []).map((t) => { const M = R.mats[t] || DATA.mats && DATA.mats[t]; return M && M.tex !== undefined && DATA.tx && DATA.tx[M.tex] ? DATA.tx[M.tex].n : String(t); }))))].slice(0, 30), nodos: Object.entries(nombres).sort((a, c) => c[1] - a[1]).slice(0, 25), grav: MUNDO.gravedad }; })()`);
  info[m] = I; console.log(m, JSON.stringify(I).slice(0, 900));
  await p.screenshot({ path: `${D}/${m}_aparicion.png` });
  // desde arriba: la cámara de prueba sobre el centro, mirando abajo
  // (desde arriba de la aparición, a 3 alturas: 60, 180 y 450 m, mirando abajo y un poco adelante)
  for (const h of [60, 180, 450]) {
    await ev(`(() => { const s = MUNDO.spawns[0] || v3(); DBG.cam = { p: v3(s.x, s.y + ${h}, s.z + ${h} * 0.55), q: Quat.euler(Math.PI, 1.06, 0) }; return 1; })()`);
    await p.waitForTimeout(1200); await p.screenshot({ path: `${D}/${m}_arriba${h}.png` });
  }
  await ev(`DBG.cam = null; 1`);
}
fs.writeFileSync(D + '/info.json', JSON.stringify(info, null, 1));
console.log('errores', err.filter((e) => !/WebSocket|ERR_CONN|net::/.test(e)).slice(0, 3));
await b.close();
