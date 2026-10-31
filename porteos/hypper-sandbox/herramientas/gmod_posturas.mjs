// Hornea las posturas de GMod (de gmod.py) en clips humanoides del juego: con el Hero y el motor de verdad,
// busca los músculos de la parte de arriba del cuerpo (columna, cuello, cabeza, hombros, brazos y manos) que dejan
// cada segmento apuntando como en GMod (y la palma girada igual), cuadro por cuadro. Los músculos de Unity son los
// mismos para todos los personajes: la postura sirve para todos. Informa el error de cada segmento en grados.
// Uso: node gmod_posturas.mjs HYPPER.html OBJETIVOS.json SALIDA.json   (con NODE_PATH apuntando a playwright)
import { createRequire } from 'module'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , HTML, OBJ, OUT] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 320, height: 180 } })).newPage();
await p.goto('file://' + HTML + '?test&gfx=patata'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
const obj = JSON.parse(fs.readFileSync(OBJ, 'utf8'));
await p.evaluate((o) => { window.__obj = o; }, obj);
const r = await p.evaluate(() => window.__ev(`(() => {
  const O = window.__obj, P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); PERS.splice(PERS.indexOf(P), 1);
  const H = P.hum, md = P.md, sub = P.D.sub, ix = {}; sub.forEach((n, i) => { const m = /^mixamorig\\d*:(.*)$/.exec(n.n); if (m && ix[m[1]] === undefined) ix[m[1]] = i; });
  md.raiz.set(IDM);
  // la base: parado (piernas y cadera como en el juego)
  const idle = humClipNombre('Pose', 'IdleLookAround_loop') || humClipNombre('Pose', 'Idle01'), base = new Float32Array(NV); humClip(idle, 0, 1, base);
  const U = []; for (let k = 0; k < NV; k++) if (HUM_ARRIBA[k]) U.push(k);
  const seg = [['Spine', 'Spine1', 1], ['Spine1', 'Spine2', 1], ['Spine2', 'Neck', 1], ['Neck', 'Head', 0.7]];
  for (const l of ['Right', 'Left']) seg.push([l + 'Shoulder', l + 'Arm', 1], [l + 'Arm', l + 'ForeArm', 2.5], [l + 'ForeArm', l + 'Hand', 2.5], [l + 'Hand', l + 'HandMiddle1', 1.5]);
  const W = md.W, pos = (n) => { const w = W[ix[n]]; return [w[12], w[13], w[14]]; };
  const dir = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const palma = (J, l) => { const h = J(l + 'Hand'), c = cruz(dir(h, J(l + 'HandPinky1')), dir(h, J(l + 'HandIndex1'))), n = Math.hypot(...c) || 1; return [c[0] / n, c[1] / n, c[2] / n]; };
  // ¿el Hero mira a +z? (la punta del pie adelante del tobillo)
  H.v.set(base); humAplicar(P); md.sucio = true; md.actualizar();
  const fz = pos('LeftToeBase')[2] - pos('LeftFoot')[2], giro = fz < 0 ? -1 : 1;
  // y que las manos no queden más cerca de la cabeza que en GMod (en largos de torso): con el torso más derecho que el de
  // GMod, la mano levantada de la postura de la palanca se metía en la cabeza. Empuja sólo si se acerca de más
  const largo = (J) => Math.hypot(...[0, 1, 2].map((c) => J('Neck')[c] - J('Hips')[c]));
  const lejos = (J, a, b) => Math.hypot(...[0, 1, 2].map((c) => J(b)[c] - J(a)[c])) / largo(J);
  const metas = (F) => { const J = (n) => { const q = F[n]; return [q[0] * giro, q[1], q[2] * giro]; }; const t = seg.map(([a, c, w]) => [a, c, w, dir(J(a), J(c))]); return { t, pal: { Right: palma(J, 'Right'), Left: palma(J, 'Left') }, huelgo: [['Head', 'RightHand'], ['Head', 'LeftHand']].map(([a, b]) => [a, b, lejos(J, a, b)]) }; };
  const error = (M, det) => {
    humAplicar(P); md.sucio = true; md.actualizar(); let e = 0; const d = det ? {} : null;
    for (const [a, c, w, t] of M.t) { const h = dir(pos(a), pos(c)), k = h[0] * t[0] + h[1] * t[1] + h[2] * t[2]; e += w * (1 - k); if (d) d[a + '>' + c] = +(Math.acos(Math.max(-1, Math.min(1, k))) * 180 / Math.PI).toFixed(1); }
    for (const l of ['Right', 'Left']) { const h = palma((n) => pos(n), l), t = M.pal[l], k = h[0] * t[0] + h[1] * t[1] + h[2] * t[2]; e += 1.5 * (1 - k); if (d) d[l + 'Palma'] = +(Math.acos(Math.max(-1, Math.min(1, k))) * 180 / Math.PI).toFixed(1); }
    for (const [a, c, m] of M.huelgo) { const q = lejos(pos, a, c), f = Math.max(0, m - q); e += 40 * f * f; if (d) d[a + '→' + c + ' falta (% torso)'] = +(f * 100).toFixed(1); }
    return det ? d : e;
  };
  const ajustar = (M, v0) => {
    const v = v0.slice(); H.v.set(v); let mejor = error(M);
    for (const paso of [0.4, 0.2, 0.1, 0.05, 0.025, 0.012, 0.006, 0.003]) {
      for (let vuelta = 0; vuelta < 8; vuelta++) {
        let mejoro = false;
        for (const k of U) for (const s of [paso, -paso]) {
          const viejo = v[k]; v[k] = Math.max(-1.6, Math.min(1.6, viejo + s)); H.v.set(v); const e = error(M);
          if (e < mejor - 1e-7) { mejor = e; mejoro = true; } else v[k] = viejo;
        }
        if (!mejoro) break;
      }
    }
    H.v.set(v); return { v, e: mejor, det: error(M, true) };
  };
  const out = {}, inf = {};
  for (const [nom, C] of Object.entries(O.clips)) {
    let v = Array.from(base); if (C.est !== 'Pose' && out['gm_idle_' + nom.split('_').slice(2).join('_')]) { const ib = out['gm_idle_' + nom.split('_').slice(2).join('_')]; for (const k of U) v[k] = ib.c[42 + k - 7][0]; }
    const frames = [];
    for (const F of C.frames) { const r = ajustar(metas(F), v); v = r.v; frames.push(r); }
    const c = {}; for (const k of U) c[42 + k - 7] = frames.map((f) => +f.v[k].toFixed(4));
    out[nom] = { n: nom, est: C.est, d: C.d, nf: frames.length, loop: C.loop ? 1 : 0, c };
    const peor = {}; for (const f of frames) for (const [s, g] of Object.entries(f.det)) peor[s] = Math.max(peor[s] || 0, g);
    inf[nom] = peor;
  }
  return JSON.stringify({ clips: out, inf, giro });
})()`));
const R = JSON.parse(r);
fs.writeFileSync(OUT, JSON.stringify({ clips: R.clips }));
console.log('el Hero mira a', R.giro > 0 ? '+z' : '-z');
for (const [n, d] of Object.entries(R.inf)) console.log(n.padEnd(22), 'peor error (°):', Object.entries(d).map(([s, g]) => s.replace(/Right/g, 'D').replace(/Left/g, 'I') + ' ' + g).join(' · '));
await b.close();
