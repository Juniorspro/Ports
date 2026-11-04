// patinado de los pies: el personaje avanza a distintas velocidades/direcciones y se mide cuánto se mueve el pie
// apoyado (el más bajo) respecto del piso. Ideal: ~0 m/s. También el hundimiento y la altura mínima de los pies.
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [,, html, skin, casos] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 320, height: 180 } });
await p.goto('file://' + html + '?test&sinred=1&gfx=patata'); if (process.env.SINIK) await p.waitForFunction(() => window.__listo, null, { timeout: 120000 }).then(() => p.evaluate(() => window.__ev('DBG.sinIK = true; 1'))); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 });
if (process.env.PRE) await p.evaluate((e) => window.__ev(e), process.env.PRE);
const r = await p.evaluate(([skin, casos]) => window.__ev(`(() => {
  const out = {};
  for (const [nom, sp, ang, agach] of ${casos}) {
    const P = crearPersona('${skin}', 'HatEmpty', { nombre: '' }); PERS.splice(PERS.indexOf(P), 1);
    const yaw = 0.3, a = yaw + ang; P.yaw = yaw; P.pos.set(0, 50, 0); P.suelo = true; P.agachado = !!agach; P.visible = true;
    P.vel.set(Math.sin(a) * sp, 0, Math.cos(a) * sp);
    const dt = 1 / 60, h = Object.assign({}, P.D.h), L = [], piso = 49; const lt = P.D.sub.findIndex((n) => /LeftToeBase$/.test(n.n)), rt = P.D.sub.findIndex((n) => /RightToeBase$/.test(n.n)); const la = h.LeftFoot, ra = h.RightFoot;
    for (let f = 0; f < 240; f++) {
      P.pos.addS(P.vel, dt); TIEMPO.dt = dt; animarPersona(P, dt); ubicarPersona(P); aterrizarPies(P); if (typeof piesIK === "function") piesIK(P, dt); P.md.actualizar();
      const W = P.md.W, ry = P.md.raiz[13], c = (i, j, k) => (W[i][k] + W[j][k]) / 2; L.push([c(la, lt, 12), c(la, lt, 13), c(la, lt, 14), c(ra, rt, 12), c(ra, rt, 13), c(ra, rt, 14), c(la, lt, 13) - ry, c(ra, rt, 13) - ry]);
    }
    let desl = 0, n = 0, ymin = 1e9, cont = 0, pico = 0; const tob = P.D.tobillo;
    // apoyo: la punta más baja, cerca de su altura mínima (en el espacio del personaje, sin la corrección del piso)
    let mm = 1e9; for (let f = 61; f < L.length; f++) mm = Math.min(mm, L[f][6], L[f][7]);
    for (let f = 61; f < L.length; f++) {
      const A = L[f], B = L[f - 1];
      ymin = Math.min(ymin, A[1] - piso, A[4] - piso);
      const k = A[6] <= A[7] ? 6 : 7, o = k === 6 ? 0 : 3;
      if (k !== (B[6] <= B[7] ? 6 : 7) || A[k] > mm + 0.04) continue;
      const vv = Math.hypot(A[o] - B[o], A[2 + o] - B[2 + o]) / dt; desl += vv; pico = Math.max(pico, vv); n++; cont++;
    }
    out[nom] = { patina: n ? +(desl / n).toFixed(2) : -1, pico: +pico.toFixed(2), apoyo: +(cont / (L.length - 61)).toFixed(2), velocidad: sp, piso: +ymin.toFixed(3) };
  }
  return JSON.stringify(out);
})()`), [skin, casos]);
console.log(r);
await b.close();
