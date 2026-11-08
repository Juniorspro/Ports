// gmF2H (juego/gmod.js: la UV de las mallas de GMod —mapas BSP, props, modelos— en medio float). Prueba: los 61 440
// medio float normales vuelven exactos y 2 millones de valores al azar quedan a medio escalón o menos. Antes del arreglo
// de la 3.0.1 el acarreo del redondeo se perdía con exponente impar (7,999 → 4): textura aplastada en ese triángulo.
// uso: node uv_f2h.mjs [../juego/gmod.js]
import fs from 'fs';
const src = fs.readFileSync(process.argv[2] || new URL('../juego/gmod.js', import.meta.url), 'utf8');
const i = src.indexOf('const _f2hB'), j = src.indexOf('\n}\n', src.indexOf('function gmF2H')) + 2, f = new Function(src.slice(i, j) + '\nreturn gmF2H;')();
const dec = (h) => { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff; return e === 0 ? s * m * 2 ** -24 : s * (1 + m / 1024) * 2 ** (e - 15); };
const paso = (x) => { x = Math.abs(x); return x < 2 ** -14 ? 2 ** -24 : 2 ** (Math.floor(Math.log2(x)) - 10); };
let ida = 0, idaMal = 0; for (const sg of [0, 0x8000]) for (let h = 0x0400; h <= 0x7bff; h++) { ida++; if (f(dec(sg | h)) !== (sg | h)) idaMal++; }
let n = 0, mal = 0; const prueba = (v) => { n++; const vf = Math.fround(v); if (Math.abs(vf) >= 2 ** -14 && Math.abs(dec(f(v)) - vf) > paso(vf) / 2 + 1e-12) mal++; };
for (let k = 0; k < 2e6; k++) prueba((Math.random() * 2 - 1) * 1000 * Math.random() ** 3);
for (let p = -13; p <= 15; p++) for (const d of [1e-7, 1e-5, 1e-4, 1e-3]) { prueba(2 ** p * (1 - d)); prueba(-(2 ** p) * (1 - d)); prueba(2 ** p * (1 + d)); }
const ok = !idaMal && !mal;
console.log(`${ok ? 'OK' : 'FALLA'}  ida y vuelta ${ida - idaMal}/${ida}  ·  al azar fuera de medio escalón ${mal}/${n}  ·  7,999 → ${dec(f(7.999))}`);
process.exit(ok ? 0 : 1);
