// saltos de huesos entre cuadros: una secuencia con todos los cambios de estado; se mide cuánto se mueve cada hueso
// en un cuadro (descontando lo que se mueve el cuerpo). Ideal: nada salta más de unos cm
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [,, html, skin] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 320, height: 180 } });
await p.goto('file://' + html + '?test&sinred=1&gfx=patata'); await p.waitForFunction(() => window.__listo, null, { timeout: 120000 });
const r = await p.evaluate(([skin, DET]) => window.__ev(`(() => { const DET = '${DET}';
  const P = crearPersona('${skin}', 'HatEmpty', { nombre: '' }); PERS.splice(PERS.indexOf(P), 1);
  P.pos.set(0, 50, 0); P.yaw = 0; P.suelo = true; P.visible = true;
  const dt = 1 / 60, E = DATA.hu.est, emo = Object.keys(E).find((k) => /dance|wave|salute|clap/i.test(k)) || null;
  const pasos = [
    ['quieto', 40, () => P.vel.set(0, 0, 0)],
    ['arranca', 40, () => P.vel.set(0, 0, 6)],
    ['giro180', 40, () => P.vel.set(0, 0, -6)],
    ['costado', 40, () => P.vel.set(5, 0, 0)],
    ['frena', 40, () => P.vel.set(0, 0, 0)],
    ['agacha', 30, () => { P.agachado = true; }],
    ['agachaCamina', 40, () => P.vel.set(0, 0, 3)],
    ['levanta', 30, () => { P.agachado = false; P.vel.set(0, 0, 0); }],
    ['salta', 50, () => { P.suelo = false; P.vel.set(0, 6, 4); }],
    ['aterriza', 40, () => { P.suelo = true; P.vel.set(0, 0, 4); }],
    ['arma', 30, () => { P.arma = 'Akm'; P.vel.set(0, 0, 0); }],
    ['dispara', 20, () => humAccion(P, 'tiro')],
    ['recarga', 60, () => humAccion(P, 'recarga')],
    ['golpe', 40, () => humAccion(P, 'golpe')],
    ['sinArma', 30, () => { P.arma = null; }],
    ['emote', 60, () => { P.emote = emo; P.emoteT = 0; }],
    ['finEmote', 30, () => { P.emote = null; }],
    ['sienta', 40, () => { P.sentado = true; }],
    ['para', 40, () => { P.sentado = false; }],
  ];
  const n = P.md.W.length, prev = new Float32Array(n * 3), out = {}; let pp = null, prim = true;
  for (const [nom, k, f] of pasos) {
    f(); let mx = 0, mf = -1, hb = '', fr = [];
    for (let i = 0; i < k; i++) {
      if (P.emote) P.emoteT += dt;
      if (!P.suelo) { P.vel.y -= 9.8 * dt; }
      P.pos.addS(P.vel, dt); TIEMPO.dt = dt; animarPersona(P, dt); ubicarPersona(P); if (!P.rag && P.hum && !P.sentado && !P.emote) { aterrizarPies(P); piesIK(P, dt); } else P.ik = null; P.md.actualizar();
      const W = P.md.W, d0 = pp ? [P.pos.x - pp[0], P.pos.y - pp[1], P.pos.z - pp[2]] : [0, 0, 0];
      for (let j = 0; j < n; j++) {
        const x = W[j][12], y = W[j][13], z = W[j][14];
        if (!prim) { const d = Math.hypot(x - prev[j * 3] - d0[0], y - prev[j * 3 + 1] - d0[1], z - prev[j * 3 + 2] - d0[2]); if (d > mx) { mx = d; mf = i; hb = P.D.sub[j].n; } }
        prev[j * 3] = x; prev[j * 3 + 1] = y; prev[j * 3 + 2] = z;
      }
      prim = false; pp = [P.pos.x, P.pos.y, P.pos.z];
      if (nom === DET) { let m = 0, hn = ''; for (let j = 0; j < n; j++) { const d = Math.hypot(W[j][12] - (window.__q ? window.__q[j * 3] : 0) - d0[0], W[j][13] - (window.__q ? window.__q[j * 3 + 1] : 0) - d0[1], W[j][14] - (window.__q ? window.__q[j * 3 + 2] : 0) - d0[2]); if (d > m) { m = d; hn = P.D.sub[j].n; } } fr.push(i + ':' + (m * 100).toFixed(0) + hn.replace(/^mixamorig\\d*:/, '').slice(0, 9)); }
      window.__q = Float32Array.from(prev);
    }
    if (fr.length) out[nom + '_det'] = fr.join(' ');
    out[nom] = (mx * 100).toFixed(1) + 'cm@' + mf + ' ' + hb.replace(/^mixamorig\\d*:/, '');
  }
  return 'emote=' + emo + '\\n' + Object.entries(out).map(([k, v]) => k + ': ' + v).join('\\n');
})()`), [skin, process.env.DET || '']);
console.log(r); await b.close();
