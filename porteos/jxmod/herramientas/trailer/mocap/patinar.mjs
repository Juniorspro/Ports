import { abrir } from '../cine.mjs'; import fs from 'fs';
const [plano, fnNom, t0, t1] = process.argv.slice(2);
const { b, ev } = await abrir(process.env.JX_URL || 'http://127.0.0.1:8979/JX.html', { W: 480, H: 360, skin: 'SpecialForcesM' });
const code = fs.readFileSync(plano, 'utf8');
const clips = [...new Set((code.match(/'c:\d+_\d+'/g) || []).map((x) => x.slice(1, -1)))];
await ev(`Promise.all(${JSON.stringify(clips)}.map((k) => emoCargar(k))).then(() => 1)`);
console.log(await ev(code));
console.log(await ev(`JSON.stringify(CINE.medirPatinar(CINE.${fnNom}, ${t0}, ${t1}))`));
await b.close();
