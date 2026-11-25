// Los textos de la web en los 14 idiomas (juego/idiomas.js e idiomas3.js, tal cual: se ejecutan) para JXMod nativo:
// motor/juego/src/idiomas_web.json.gz con {L: códigos, n: nombres, f: [[es, en, pt, …], …]} (una fila por texto, en el
// orden de IDI3_L). La nativa busca por el texto en castellano (juego/src/idiomas.rs). Uso: node herramientas/idiomas_nativo.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const ctx = { PREFS: { lang: 'es' }, document: { documentElement: {} }, navigator: { languages: ['es'] }, guardarPrefs() {}, console, HUESOS_ANIM_RB: [] };
vm.createContext(ctx);
for (const f of ['idiomas.js', 'idiomas3.js']) vm.runInContext(fs.readFileSync(path.join(aqui, '..', 'juego', f), 'utf8'), ctx, { filename: f });
const r = vm.runInContext('({L: IDI3_L, R: IDIOMAS_RB, K: IDI_K, T: IDI_T, K2: IDI_K2, T2: IDI_T2, I3: IDI3})', ctx);
const L = r.L; const filas = []; const vistas = new Set();
const poner = (v) => { const es = v[0]; if (!es || vistas.has(es)) return; vistas.add(es); filas.push(v); };
for (const [K, T] of [[r.K, r.T], [r.K2, r.T2]]) {
  const div = {}; for (const l of L) div[l] = (T[l] || T.en).split('|');
  K.forEach((k, i) => poner(L.map((l) => div[l][i] || div.en[i] || '')));
}
for (const v of Object.values(r.I3)) poner(L.map((l, i) => v[i] || v[1] || ''));
// (y los de los demás archivos de la web con los 14 idiomas en un texto separado por «|» —el tutorial, lo social—)
const jsDir = path.join(aqui, '..', 'juego'); let sueltos = 0;
for (const f of fs.readdirSync(jsDir).filter((n) => n.endsWith('.js') && !n.startsWith('idiomas'))) {
  const t = fs.readFileSync(path.join(jsDir, f), 'utf8');
  for (const m of t.matchAll(/'((?:[^'\\\n]|\\.){3,}?)'|"((?:[^"\\\n]|\\.){3,}?)"/g)) {
    const x = (m[1] ?? m[2]).replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');
    const v = x.split('|'); if (v.length !== L.length || !v[0].trim() || !v[1].trim()) continue;
    const antes = filas.length; poner(v.map((y) => y.trim())); sueltos += filas.length - antes;
  }
}
const sal = path.join(aqui, '..', 'motor', 'juego', 'src', 'idiomas_web.json.gz');
fs.writeFileSync(sal, zlib.gzipSync(JSON.stringify({ L, n: L.map((l) => r.R[l][0]), f: filas }), { level: 9 }));
console.log('idiomas:', L.length, '· textos:', filas.length, '(' + sueltos + ' de otros archivos)', '·', fs.statSync(sal).size, 'bytes →', path.relative(process.cwd(), sal));
