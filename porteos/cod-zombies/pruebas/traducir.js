// Traduce todos los bloques de una lista y muestra los que fallan (con el desensamblado hasta el fallo)
'use strict';
require('./cargar.js')();
const fs = require('fs');
const [, , fb, fimg, sbase] = process.argv;
const BASE = Number(sbase), img = fs.readFileSync(fimg);
const buf = new ArrayBuffer(0x1000000 + BASE), u8 = new Uint8Array(buf); u8.set(img, BASE);
const cpu = new Cpu({ buf, codeLo: BASE, codeHi: BASE + img.length, stubLo: 0x100000, stubHi: 0x100000, roLo: 0, roHi: 0 });
const bl = JSON.parse(fs.readFileSync(fb));
const err = {}; let n = 0;
for (const [a, t] of bl) {
  try { cpu.translate(a, !!t); n++; } catch (e) { const m = String(e.message).replace(/ en [0-9a-f]+ w=[0-9a-f]+/, '').slice(0, 70); (err[m] = err[m] || []).push([a, t, e.message]); }
}
console.log('traducidos', n, 'de', bl.length);
for (const [k, v] of Object.entries(err).sort((x, y) => y[1].length - x[1].length)) console.log(v.length, k, '\n    ej:', v.slice(0, 3).map((x) => x[0].toString(16) + (x[1] ? 'T' : 'A') + ' -> ' + x[2].slice(-40)).join(' | '));
