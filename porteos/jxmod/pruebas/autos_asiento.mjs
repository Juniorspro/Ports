// El conductor sentado adentro del auto (Discord: «pies traspasando el suelo del auto», con el Viper blanco de TDMCars):
// con el personaje más chico, el Hero y el más grande, en autos del juego (Sedan, Derby6, policía, Sofie) y de TDMCars
// (Viper, Challenger 70, Charger SRT8), los vértices del cuerpo —cada uno con su piel— contra la malla del auto: ninguno
// sin auto abajo en el Hero ni en el chico, y en el grande (BoiledOne, 1,53, con sobretodo) ≤ 5 % de los vértices.
// uso: node autos_asiento.mjs URL_HTML URL_CARPETA_GMA (con 112606459.gma y 114001545.gma: TDMCars Base Pack y Dodge)
import { abrir } from './base.mjs';
const [, , HTML, G = new URL('/gma', HTML).href] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(3000);
await ev(`(async () => { for (const id of ['112606459', '114001545']) { const u = new Uint8Array(await (await fetch(${JSON.stringify(G)} + '/' + id + '.gma')).arrayBuffer()); await gmInstalar(id, { nombre: id, sinDeps: true }, u); } return 1; })()`);
// (la malla del auto en su marco, en columnas de 10 cm; los vértices del conductor con su piel; % sin nada del auto abajo)
await ev(`window.__medir = (o) => {
  const inv = o.b.q.clone().conj(), loc = (x, y, z) => inv.rot(v3(x - o.b.pos.x, y - o.b.pos.y, z - o.b.pos.z)); o.md.sucio = true; o.md.actualizar(); const T = [];
  for (let i = 0; i < o.md.A.length; i++) { const x = o.md.A[i]; if (!(x.m >= 0) || !o.md.ver[i] || /collider/i.test(x.n)) continue; const mc = mallaCPU(x.m); if (!mc) continue; const W = o.md.W[i], P = mc.P, I = mc.I, L = []; for (let k = 0; k < P.length; k += 3) { const w = m4pt(W, P[k], P[k + 1], P[k + 2], v3()); L.push(loc(w.x, w.y, w.z)); } let n = 0; for (const s of mc.d.sub) n = Math.max(n, s[0] + s[1]); for (let k = 0; k + 2 < n; k += 3) T.push(L[I[k]], L[I[k + 1]], L[I[k + 2]]); }
  const C = 0.1, G = new Map(); for (let t = 0; t < T.length; t += 3) { const a = T[t], b = T[t + 1], c = T[t + 2], x0 = Math.floor(Math.min(a.x, b.x, c.x) / C), x1 = Math.floor(Math.max(a.x, b.x, c.x) / C), z0 = Math.floor(Math.min(a.z, b.z, c.z) / C), z1 = Math.floor(Math.max(a.z, b.z, c.z) / C); if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4000) continue; for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i + ',' + j; let l = G.get(k); if (!l) G.set(k, (l = [])); l.push(t); } }
  const abajo = (x, y, z) => { for (const t of G.get(Math.floor(x / C) + ',' + Math.floor(z / C)) || []) { const a = T[t], b = T[t + 1], c = T[t + 2], d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(d) < 1e-9) continue; const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d, v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d, w = 1 - u - v; if (u >= -1e-4 && v >= -1e-4 && w >= -1e-4 && u * a.y + v * b.y + w * c.y < y) return true; } return false; };
  const P = JUG.cuerpo, md = P.md; md.actualizar(); let n = 0, fuera = 0, hondo = 0;
  for (let i = 0; i < md.A.length; i++) { const x = md.A[i]; if (!x.bo || !md.ver[i]) continue; const pz = md.pieles.find((q) => q.i === i), m = mallaGL(x.m); if (!pz || !m) continue; const out = new Float32Array(m.d.v * 6); pielCalcular(m, pz.h, out, null);
    for (let k = 0; k < m.d.v; k += 2) { const q = loc(out[k * 6], out[k * 6 + 1], out[k * 6 + 2]); n++; if (!abajo(q.x, q.y, q.z)) { fuera++; hondo = Math.max(hondo, -q.y); } } }
  return { pct: +(100 * fuera / Math.max(1, n)).toFixed(1), verts: n, adentro: !!JUG.vehiculo && P.sentado }; }; 1`);
const skins = await ev(`(() => { const c = [...new Set(Object.keys(DATA.tam || {}).concat(['Hero']))].filter((s) => { try { return rbListo(rbDeSkin(s)) && datosSkin(s); } catch (e) { return false; } }).map((s) => [s, tamSkin(s).k]).sort((a, b) => a[1] - b[1]); return [c[0][0], 'Hero', c[c.length - 1][0]]; })()`);
const autos = ['Sedan', 'Derby6', 'police_car_v4', 'Sofie', 'gmveh:vipvipertdm', 'gmveh:challenger70tdm', 'gmveh:chargersrt8tdm'];
for (const sk of skins) {
  const res = {};
  for (const A of autos) res[A] = await ev(`(async () => { const espera = (ms) => new Promise((r) => setTimeout(r, ms)); PREFS.skin = '${sk}'; if (!JUG.cuerpo || JUG.cuerpo.skin !== '${sk}') { jugadorCuerpoNuevo(); await espera(500); }
    for (const o of OBJS.slice()) if (o.veh) borrarObjeto(o); if (JUG.vehiculo) salirVehiculo(); JUG.pos.set(0, 1.5, 0); JUG.vel.set(0, 0, 0);
    let o = null; for (let i = 0; i < 40 && !o; i++) { o = crearObjeto('${A}', v3(0, 1, 8), new Quat()); if (!o) await espera(500); } if (!o) return null;
    await espera(1500); for (let i = 0; i < 20 && JUG.vehiculo !== o; i++) { subirVehiculo(o); await espera(300); } await espera(1500); return __medir(o); })()`);
  const tope = sk === skins[2] ? 5 : 0, malos = Object.entries(res).filter(([, r]) => !r || !r.adentro || r.pct > tope);
  ok(`${sk}: sentado adentro en los ${autos.length} autos, sin nada abajo del auto (≤ ${tope} % de los vértices)`, !malos.length, Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r && r.pct])));
}
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|aborted/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
