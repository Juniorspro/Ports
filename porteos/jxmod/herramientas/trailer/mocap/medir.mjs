// mide la velocidad (pie apoyado) de clips de captura en el cuerpo del personaje
import { abrir } from '../cine.mjs';
const ids = process.argv[2].split(','), skin = process.argv[3] || 'PilotFemale';
const { b, ev } = await abrir(process.env.JX_URL || 'http://127.0.0.1:8979/JX.html', { W: 480, H: 360, skin });
console.log(await ev(`Promise.all(${JSON.stringify(ids)}.map((k) => emoCargar('c:' + k))).then((r) => r.map((c) => !!c).join(','))`));
for (const k of ids) console.log(k, await ev(`(() => { const c = emoClip('c:${k}'); if (!c) return 'sin clip'; const m = CINE.mocapVel('c:${k}', 0.6, Math.max(1.2, c.d * 2.2)); return JSON.stringify({ dur: +c.d.toFixed(2), loop: c.loop, v: +m.v.toFixed(2), lat: +m.lat.toFixed(2), apoyo: +(m.apoyo || 0).toFixed(2), bucle: emoBucle(c, true) }); })()`));
await b.close();
