// mide la mano del final (9b, 34,00–36,92), cuadro a cuadro y con los 4 subcuadros de cada uno: cuánto gira la mano entre
// subcuadros, el giro alrededor del antebrazo, el salto del codo, el codo alrededor del eje hombro→mano y los dedos
// contra la cola del arma (el punto de apoyo que calcula el plano con la malla del arma).
// Uso: JX_URL=http://127.0.0.1:8979/JX.html node mocap/mano_final.mjs planos/p9_final.js salida.json
//      python3 mocap/mano_final.py salida.json
import { abrir } from '../cine.mjs'; import fs from 'fs'; import path from 'path';
const [plano, salida] = process.argv.slice(2);
const AQ = path.dirname(new URL(import.meta.url).pathname);
const { b, ev, err } = await abrir(process.env.JX_URL || 'http://127.0.0.1:8979/JX.html', { W: 320, H: 240, skin: 'SpecialForcesM' });
await ev(fs.readFileSync(path.join(AQ, '..', 'planos', 'playa_comun.js'), 'utf8'));
const code = fs.readFileSync(plano, 'utf8');
const clips = [...new Set((code.match(/'c:\d+_\d+'/g) || []).map((x) => x.slice(1, -1)))];
await ev(`Promise.all(${JSON.stringify(clips)}.map((k) => emoCargar(k))).then(() => 1)`);
console.log('plano:', await ev(code));
const P = JSON.parse(await ev('JSON.stringify(CINE.plano)'));
await ev(`(() => { CINE.tUlt = null; for (let t = ${P.t0} - ${P.previo}; t < 34.0 - 1e-6; t += 1 / 24) CINE.avanzar(t, 1 / 24); return 1; })()`);
// la medida, dentro de la página
await ev(`window.__mano = () => {
  const Pj = JUG.cuerpo, md = Pj.md, h = Pj.D.h, hx = huesosMixamo(Pj.D); md.actualizar();
  const pos = (i) => { const p = celmPos(md, i); return [p.x, p.y, p.z]; };
  const q = celmQMundo(md, h.RightHand);
  const r = { q: [q.x, q.y, q.z, q.w], hom: pos(h.RightArm), codo: pos(h.RightForeArm), mano: pos(h.RightHand), m1: pos(hx.RightHandIndex1), pul: pos(hx.RightHandThumb1), i2: pos(hx.RightHandIndex2), i4: pos(hx.RightHandIndex4) }; if (CINE.apoyo9) r.apoyo = [CINE.apoyo9.x, CINE.apoyo9.y, CINE.apoyo9.z];
  return r;
};`);
const F = [];
for (let i = 0; i < 70; i++) {
  const tf = 34.0 + i / 24;
  for (let k = 0; k < 4; k++) {
    const ti = tf + k * (1 / 24) * 0.5 / 4;
    await ev(`CINE.renderCuadro(${ti}, 1, 0.5, 0)`);   // (dibujando: el cuerpo se pone en su pose al dibujarse)
    F.push(Object.assign({ i, k, t: ti }, JSON.parse(await ev('JSON.stringify(window.__mano())'))));
  }
}
fs.writeFileSync(salida, JSON.stringify({ p9: JSON.parse(await ev('JSON.stringify(CINE.p9 || null)')), v: JSON.parse(await ev('JSON.stringify(window.__p9v || null)')), F }));
console.log('medidas', F.length, 'errores', JSON.stringify(err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 4)));
await b.close();
