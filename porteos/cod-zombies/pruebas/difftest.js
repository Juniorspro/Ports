// Prueba diferencial: ejecuta bloques con estados aleatorios y compara contra Unicorn (ver vectores.py)
//   node difftest.js run entrada.bin salida.bin imagen.bin base_img
// entrada.bin: [u32 n] y por prueba: u32 pc|thumb, u32 regs[16], u32 nzcv(bits 31..28), u32 vfp[64], u32 fpscr
// salida.bin : por prueba: u32 estado(0 ok,1 error), u32 pcSalida, regs[16], nzcv, vfp[64], fpscr, u32 nEscrituras, (u32 off, u32 val)*
'use strict';
require('./cargar.js')();
const fs = require('fs');
const [, , modo, fin, fout, fimg, sbase] = process.argv;
const BASE = Number(sbase), SCR = 0x02000000, SCRSZ = 0x10000, MEMSZ = 0x03000000;
const buf = new ArrayBuffer(MEMSZ), u8 = new Uint8Array(buf);
const img = fs.readFileSync(fimg); u8.set(img, BASE);
const scratch0 = fs.readFileSync(fout + '.scratch');
const wr = new Uint8Array(0x4a8000 - 0x3dc000); wr.set(img.subarray(0x3dc000));
const cpu = new Cpu({ buf, codeLo: BASE, codeHi: BASE + img.length, stubLo: 0x100000, stubHi: 0x100000, roLo: 0, roHi: 0 });
const inp = fs.readFileSync(fin), iv = new DataView(inp.buffer, inp.byteOffset, inp.byteLength);
const n = iv.getUint32(0, true);
const out = [];
let o = 4, errores = {};
for (let t = 0; t < n; t++) {
  const pcT = iv.getUint32(o, true); o += 4;
  const lim = iv.getUint32(o, true); o += 4;
  const code = inp.subarray(o, o + 32); o += 32;
  const regs = []; for (let i = 0; i < 16; i++) { regs.push(iv.getInt32(o, true)); o += 4; }
  const nzcv = iv.getUint32(o, true); o += 4;
  const vfp = []; for (let i = 0; i < 64; i++) { vfp.push(iv.getUint32(o, true)); o += 4; }
  const fpscr = iv.getUint32(o, true); o += 4;
  u8.set(scratch0, SCR); u8.set(wr, BASE + 0x3dc000);
  if (pcT >= 0x02800000) u8.set(code, 0x02800000);
  for (let i = 0; i < 16; i++) cpu.R[i] = regs[i];
  cpu.F[0] = 0; cpu.F[4] = nzcv >>> 31; cpu.F[5] = (nzcv >>> 30) & 1; cpu.F[6] = (nzcv >>> 29) & 1; cpu.F[7] = (nzcv >>> 28) & 1;
  for (let i = 0; i < 64; i++) cpu.U[i] = vfp[i];
  cpu.FP[0] = fpscr | 0;
  let pcOut = 0, st = 0, msg = '';
  try {
    const thumb = pcT & 1, pc = pcT & ~1;
    cpu.pc = pcT;
    const f = cpu.compile(pc, !!thumb, lim);
    pcOut = f();
  } catch (e) { st = 1; msg = String(e.message || e).slice(0, 120); errores[msg] = (errores[msg] || 0) + 1; }
  const rec = [st, pcOut >>> 0];
  for (let i = 0; i < 16; i++) rec.push(cpu.R[i] >>> 0);
  rec.push(((cpu.H.fN() << 31) | (cpu.H.fZ() << 30) | (cpu.H.fC() << 29) | (cpu.H.fV() << 28)) >>> 0);
  for (let i = 0; i < 64; i++) rec.push(cpu.U[i]);
  rec.push(cpu.FP[0] >>> 0);
  const diffs = [];
  for (let i = 0; i < SCRSZ; i++) if (u8[SCR + i] !== scratch0[i]) diffs.push(i, u8[SCR + i]);
  rec.push(diffs.length / 2, ...diffs);
  out.push(Uint32Array.from(rec));
}
const tot = out.reduce((s, a) => s + a.length, 0), ob = new Uint32Array(tot + 1);
ob[0] = n; let p = 1; for (const a of out) { ob.set(a, p); p += a.length; }
fs.writeFileSync(fout, Buffer.from(ob.buffer));
if (Object.keys(errores).length) { console.log('errores de traduccion/ejecucion:'); for (const [k, v] of Object.entries(errores).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(' ', v, k); }
console.log('pruebas', n, 'bloques compilados', cpu.nblocks);
