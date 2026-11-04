// Hornea caminar, correr, agacharse y saltar de GMod (de gmod.py, GM_SOLO=loco) en clips humanoides del juego, con el
// cuerpo entero: con el Hero y el motor de verdad busca, cuadro por cuadro, los músculos de piernas, columna, cuello,
// cabeza y brazos y el giro de la cadera (RootQ) que dejan cada segmento apuntando como en GMod (muslo, pierna, pie y
// dedos del pie incluidos; la cadera con su arriba y su costado), la palma girada igual y la cabeza mirando adonde miran
// los ojos del jugador de GMod. Los músculos de Unity son los mismos para todos los personajes: sirve para todos.
// Informa el peor error de cada segmento en grados.
// Uso: node gmod_locomocion.mjs JXMOD.html OBJETIVOS.json SALIDA.json   (con NODE_PATH apuntando a playwright)
import { createRequire } from 'module'; import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , HTML, OBJ, OUT] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 320, height: 180 } })).newPage();
p.on('console', (m) => { if (m.type() === 'log' && /^HORNO/.test(m.text())) console.log(m.text()); });
await p.goto(/^https?:/.test(HTML) ? HTML + '?test&gfx=patata' : 'file://' + HTML + '?test&gfx=patata'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
const obj = JSON.parse(fs.readFileSync(OBJ, 'utf8'));
// (los ángulos de dirección por el nombre del clip: el pie apoyado de dos diagonales agachado no se mide bien)
const ANG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: -135, W: -90, NW: -45 };
for (const [n, c] of Object.entries(obj.clips)) { const m = /_(N|NE|E|SE|S|SW|W|NW)$/.exec(n); if (m) c.ang = ANG[m[1]] * Math.PI / 180; }
for (const pref of ['gm_run_', 'gm_cwalk_']) { const L = Object.entries(obj.clips).filter(([n]) => n.startsWith(pref)), vs = L.map(([, c]) => c.v).sort((a, b) => a - b), med = vs[vs.length >> 1]; for (const [, c] of L) if (c.v < med * 0.6) c.v = med; }
await p.evaluate((o) => { window.__obj = o; }, obj);
const r = await p.evaluate(() => window.__ev(`(() => {
  const O = window.__obj, P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); PERS.splice(PERS.indexOf(P), 1);
  const H = P.hum, md = P.md, sub = P.D.sub, ix = {}; sub.forEach((n, i) => { const m = /^mixamorig\\d*:(.*)$/.exec(n.n); if (m && ix[m[1]] === undefined) ix[m[1]] = i; });
  md.raiz.set(IDM);
  const idle = humClipNombre('Pose', 'IdleLookAround_loop') || humClipNombre('Pose', 'Idle01'), base = new Float32Array(NV); humClip(idle, 0, 1, base);
  const U = []; for (let k = 7; k < NV; k++) U.push(k);
  const seg = [['Hips', 'Spine', 2], ['Spine', 'Spine1', 1], ['Spine1', 'Spine2', 1], ['Spine2', 'Neck', 1], ['Neck', 'Head', 0.7], ['LeftUpLeg', 'RightUpLeg', 2]];
  for (const l of ['Right', 'Left']) seg.push([l + 'Shoulder', l + 'Arm', 1], [l + 'Arm', l + 'ForeArm', 2.5], [l + 'ForeArm', l + 'Hand', 2.5], [l + 'Hand', l + 'HandMiddle1', 1.2],
    [l + 'UpLeg', l + 'Leg', 3], [l + 'Leg', l + 'Foot', 3], [l + 'Foot', l + 'ToeBase', 1.5]);
  const W = md.W, pos = (n) => { const w = W[ix[n]]; return [w[12], w[13], w[14]]; };
  const dir = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const palma = (J, l) => { const h = J(l + 'Hand'), c = cruz(dir(h, J(l + 'HandPinky1')), dir(h, J(l + 'HandIndex1'))), n = Math.hypot(...c) || 1; return [c[0] / n, c[1] / n, c[2] / n]; };
  H.v.set(base); humAplicar(P); md.sucio = true; md.actualizar();
  const fz = pos('LeftToeBase')[2] - pos('LeftFoot')[2], giro = fz < 0 ? -1 : 1;
  let pz = null, bi = -1; for (const z of md.pieles) { const k = md.A[z.i].bo.indexOf(ix.Head); if (k >= 0) { pz = z; bi = k; break; } }
  const nrm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cabeza = () => { const h = pz.h, o = bi * 12; return [nrm([0, 1, 2].map((r) => h[o + r * 4 + 2] * giro)), nrm([0, 1, 2].map((r) => h[o + r * 4 + 1]))]; };
  const metas = (F) => { const J = (n) => { const q = F[n]; return [q[0] * giro, q[1], q[2] * giro]; }; return { t: seg.filter(([a, c]) => F[a] && F[c]).map(([a, c, w]) => [a, c, w, dir(J(a), J(c))]),
    pal: F.RightHandPinky1 ? { Right: palma(J, 'Right'), Left: palma(J, 'Left') } : null,
    // (la cabeza mira al frente y derecha, como en GMod con la mira: ahí las capas de puntería la enderezan; los clips solos
    // la dejaban mirando al piso corriendo y agachado)
    mira: pz ? [[0, 0, giro], [0, 1, 0]] : null }; };
  const REG = [[16, 0.004], [17, 0.012], [18, 0.012], [19, 0.004], [20, 0.012], [21, 0.012]];
  // el giro de la cadera: el de la pose quieta por un giro chico (tres ángulos que también se ajustan)
  const q0 = new Quat(base[3], base[4], base[5], base[6]).norm();
  const raiz = (r) => { const q = q0.clone().mul(Quat.euler(r[1], r[0])).mul(new Quat(0, 0, Math.sin(r[2] / 2), Math.cos(r[2] / 2))).norm(); H.v[3] = q.x; H.v[4] = q.y; H.v[5] = q.z; H.v[6] = q.w; };
  const error = (M, det) => {
    humAplicar(P); md.sucio = true; md.actualizar(); let e = 0; const d = det ? {} : null;
    for (const [k, w] of REG) e += w * H.v[k] * H.v[k];
    for (const [a, c, w, t] of M.t) { const h = dir(pos(a), pos(c)), k = h[0] * t[0] + h[1] * t[1] + h[2] * t[2]; e += w * (1 - k); if (d) d[a + '>' + c] = +(Math.acos(Math.max(-1, Math.min(1, k))) * 180 / Math.PI).toFixed(1); }
    if (M.pal) for (const l of ['Right', 'Left']) { const h = palma((n) => pos(n), l), t = M.pal[l], k = h[0] * t[0] + h[1] * t[1] + h[2] * t[2]; e += 0.8 * (1 - k); if (d) d[l + 'Palma'] = +(Math.acos(Math.max(-1, Math.min(1, k))) * 180 / Math.PI).toFixed(1); }
    if (M.mira) { const C = cabeza(); for (const [k, w, n] of [[0, 2.5, 'Mira'], [1, 1, 'MiraArriba']]) { const h = C[k], t = M.mira[k], c = h[0] * t[0] + h[1] * t[1] + h[2] * t[2]; e += w * (1 - c); if (d) d[n] = +(Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI).toFixed(1); } }
    return det ? d : e;
  };
  const ajustar = (M, v0, r0, pasos) => {
    const v = v0.slice(), r = r0.slice(); H.v.set(v); raiz(r); let mejor = error(M);
    for (const paso of pasos) {
      for (let vuelta = 0; vuelta < 8; vuelta++) {
        let mejoro = false;
        for (const k of U) for (const s of [paso, -paso]) {
          const viejo = v[k]; v[k] = Math.max(-1.6, Math.min(1.6, viejo + s)); H.v[k] = v[k]; const e = error(M);
          if (e < mejor - 1e-7) { mejor = e; mejoro = true; } else { v[k] = viejo; H.v[k] = viejo; }
        }
        for (let k = 0; k < 3; k++) for (const s of [paso, -paso]) {
          const viejo = r[k]; r[k] = viejo + s * 0.8; raiz(r); const e = error(M);
          if (e < mejor - 1e-7) { mejor = e; mejoro = true; } else { r[k] = viejo; raiz(r); }
        }
        if (!mejoro) break;
      }
    }
    for (let k = 3; k < 7; k++) v[k] = H.v[k];
    return { v, r, e: mejor, det: error(M, true) };
  };
  const out = {}, inf = {};
  for (const [nom, C] of Object.entries(O.clips)) {
    let v = Array.from(base), r = [0, 0, 0]; const frames = [];
    for (let i = 0; i < C.frames.length; i++) { const x = ajustar(metas(C.frames[i]), v, r, i ? [0.1, 0.05, 0.025, 0.012, 0.006] : [0.4, 0.2, 0.1, 0.05, 0.025, 0.012, 0.006]); v = x.v; r = x.r; frames.push(x); }
    // (en los que dan la vuelta, el último cuadro es el primero: así no salta al repetirse)
    if (C.loop && frames.length > 2) frames[frames.length - 1] = frames[0];
    const c = {}; for (const k of U) c[42 + k - 7] = frames.map((f) => +f.v[k].toFixed(4));
    for (let k = 3; k < 7; k++) c[7 + k] = frames.map((f) => +f.v[k].toFixed(5));
    c[8] = [+base[1].toFixed(5)];
    out[nom] = { n: nom, est: 'GmLoco', d: C.d, nf: frames.length, loop: C.loop ? 1 : 0, c, v: C.v || 0, ang: C.ang || 0 };
    const peor = {}; for (const f of frames) for (const [s, g] of Object.entries(f.det)) peor[s] = Math.max(peor[s] || 0, g);
    inf[nom] = peor; console.log('HORNO ' + nom + ' listo');
  }
  return JSON.stringify({ clips: out, inf, giro });
})()`));
const R = JSON.parse(r);
fs.writeFileSync(OUT, JSON.stringify({ clips: R.clips }));
console.log('el Hero mira a', R.giro > 0 ? '+z' : '-z');
for (const [n, d] of Object.entries(R.inf)) console.log(n.padEnd(14), 'peor error (°):', Object.entries(d).filter(([, g]) => g > 8).map(([s, g]) => s.replace(/Right/g, 'D').replace(/Left/g, 'I') + ' ' + g).join(' · ') || 'todo < 8°');
await b.close();
