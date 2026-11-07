// lo más bajo que llegan las manos en clips de "levantar algo" (sobre el piso), y cuándo
import { abrir } from '../cine.mjs';
const clips = process.argv.slice(2);
const { b, ev } = await abrir(process.env.JX_URL || 'http://127.0.0.1:8979/JX.html', { W: 320, H: 240, skin: 'SpecialForcesM' });
console.log(await ev(`Promise.all(${JSON.stringify(clips.map((c) => 'c:' + c))}.map((k) => emoCargar(k))).then((r) => r.map((c) => !!c).join(','))`));
console.log(await ev(`(() => {
  const C = CINE, X = -90, Z = -95, piso = pisoBajo(v3(X, 0, Z), 300), out = [];
  JUG.pos.set(X, piso + 1, Z); JUG.tercera = true; C.suaveJug = false;
  for (const k of ${JSON.stringify(clips)}) {
    const id = 'c:' + k, Cl = emoClip(id), dur = (Cl.nf - 1) / Cl.fps;
    const fn = C.locomocion({ id, t0: 0, p0: v3(X, piso, Z), yaw: 0, girar: 0, esc: 1, desde: 0.2, hasta: dur - 0.05 });
    let mejor = null; const serie = [];
    for (let tc = 0.2; tc < dur - 0.05; tc += 1 / 15) {
      const H = C.poseHuesos(fn, tc - 0.2, ['LeftHand', 'RightHand', 'Hips']);
      const yl = H.LeftHand.y - piso, yr = H.RightHand.y - piso, m = Math.min(yl, yr);
      if (!mejor || m < mejor.m) mejor = { m: +m.toFixed(3), tc: +tc.toFixed(2), mano: yl < yr ? 'L' : 'R', cadera: +(H.Hips.y - piso).toFixed(2) };
      serie.push(+m.toFixed(2));
    }
    out.push(k + ' dur ' + dur.toFixed(1) + ' mín ' + JSON.stringify(mejor) + ' serie(cada 0,2 s): ' + serie.filter((_, i) => i % 3 === 0).join(' '));
  }
  return out.join('\\n');
})()`));
await b.close();
