// Arranca el juego en Node con las funciones s3e de juego/s3e.js y muestra lo que pasa.
//   node arrancar.js IMAGEN.bin IMAGEN.json CONFIG.txt [opciones: --max=N bloques de yield, --trazar=config,archivos,todo]
'use strict';
require('./cargar.js')(['decode.js', 'cpu.js', 'vfp.js', 'icf.js', 's3e.js', 'fsvirtual.js', 'gl.js']);
const fs = require('fs');
const [, , fimg, fjson, fcfg, ...resto] = process.argv;
const opts = Object.fromEntries(resto.map((a) => { const m = /^--(\w+)=?(.*)$/.exec(a); return [m[1], m[2] === '' ? true : m[2]]; }));
const meta = JSON.parse(fs.readFileSync(fjson));
const img = fs.readFileSync(fimg);
const BASE = meta.base_img, STUB = meta.base_stubs;
const MEM = 0x0C000000;
const buf = new ArrayBuffer(MEM); new Uint8Array(buf).set(img, BASE);
const cpu = new Cpu({ buf, codeLo: BASE, codeHi: BASE + img.length, stubLo: STUB, stubHi: STUB + 8 * meta.nombres.length, roLo: BASE, roHi: BASE + 0x3dc000 });
const cfg = new Icf(fs.readFileSync(fcfg, 'latin1'), { OS: 'ANDROID', CLASS: 'ANDROID', MODEL: 'Nexus S' });
const trazar = Object.fromEntries(String(opts.trazar || '').split(',').filter(Boolean).map((x) => [x, true]));
const fsv = new FsVirtual();
for (const m of String(opts.montar || '').split(';').filter(Boolean)) {
  const [n, ruta] = m.split('=');
  const st = fs.statSync(ruta);
  if (st.size > 64 << 20) { const fd = fs.openSync(ruta, 'r'); fsv.montar(n, { tam: st.size, leer(d, k, u8, o) { return fs.readSync(fd, u8, o, k, d); } }); } // paquetes grandes: se leen por tramos
  else fsv.montar(n, FsVirtual.deBuffer(fs.readFileSync(ruta)));
}
const glh = new GlHle({ ancho: 800, alto: 480, log: (m) => console.log(m), vendor: opts.vendor, renderer: opts.renderer, extensiones: opts.ext ? String(opts.ext).split(',') : undefined });
const s3e = new S3e(cpu, meta.nombres, { cfg, fs: fsv, gl: glh, ancho: 800, alto: 480, log: (m) => console.log(m), trazar, heapLo: 0x01000000, heapHi: 0x0A000000 });
cpu.hle = s3e.tabla; if (opts.pila) cpu.pilaSombra = true; if (opts.montar) console.log('montado:', [...fsv.arch.keys()].join(', '));
cpu.R[13] = 0x0B000000; cpu.R[14] = Cpu.MAGIC;
if (opts.traza) { // --traza=N : tras el 2do chequeo de blackops_dxt.dz se anotan N bloques
  let n = 0, activo = false, cuenta = 0; const limite = Number(opts.traza);
  s3e.disparo = () => { if (++cuenta === 2) { activo = true; } };
  cpu.traza = (p) => { if (activo && n < limite) { n++; console.log('  blk ' + (p >>> 0).toString(16)); } };
}
if (opts.probar) { // --probar=nombre1,nombre2 : al preguntar por console.bin, prueba esos nombres contra los sistemas de archivos del juego
  s3e.alConsultar = (n) => {
    if (n !== 'console.bin') return;
    const rb = s3e.cadenaPersistente('rb');
    for (const x of String(opts.probar).split(',')) {
      const hd = s3e.userFs.map((u) => cpu.call(u.open, [s3e.cadenaPersistente(x), rb]));
      console.log('probar', JSON.stringify(x), '->', hd.map((v) => (v >>> 0).toString(16)).join(','));
    }
  };
}
if (opts.hook) { // --hook=addr,addr : anota cuando se entra a esas direcciones (con lr y r0-r3)
  const hs = new Set(String(opts.hook).split(',').map((x) => parseInt(x, 16)));
  const ant = cpu.traza;
  cpu.traza = (p) => { if (hs.has(p & ~1)) console.log('  HOOK ' + (p >>> 0).toString(16) + ' lr=' + (cpu.R[14] >>> 0).toString(16) + (opts.pila ? ' cs=' + cpu.cs.slice(-8).reverse().map((x) => (x >>> 0).toString(16)).join(',') : '') + ' r0-3=' + [0, 1, 2, 3].map((i) => (cpu.R[i] >>> 0).toString(16)).join(',') + ' txt=' + [0, 1, 2, 3].map((i) => { const v = cpu.R[i] >>> 0; if (v < 0x1000 || v >= cpu.buf.byteLength - 64) return '-'; const s = s3e.cstr(v, 80); return /^[\x20-\x7e]{3,}$/.test(s) ? JSON.stringify(s) : '-'; }).join(' ')); if (ant) ant(p); };
}
let pc = BASE; const max = Number(opts.max || 200);
const t0 = Date.now();
try {
  for (let i = 0; i < max; i++) {
    s3e.yieldPedido = false;
    if (opts.click) for (const it of String(opts.click).split(';')) { const [fr, xy] = it.split(':'); const [cx, cy] = xy.split(',').map(Number); const f = Number(fr);
      if (i === f) { s3e.entrada({ t: 'ptr', e: 'move', id: 0, x: cx, y: cy }); s3e.entrada({ t: 'ptr', e: 'down', id: 0, x: cx, y: cy }); console.log('--- click en cuadro', i); }
      if (i === f + 3) s3e.entrada({ t: 'ptr', e: 'up', id: 0, x: cx, y: cy }); }
    if (opts.desde && i === Number(opts.desde)) s3e.trazar.todo = true;
    pc = cpu.run(pc);
    if (pc === Cpu.MAGIC || pc === Cpu.MAGIC + 1) { console.log('el juego retorno de main'); break; }
    if (s3e.quit) { console.log('salida pedida', s3e.salida); break; }
    if (!s3e.yieldPedido) break;
    pc = cpu.R[14];
  }
} catch (e) {
  console.log('EXCEPCION:', e.message, 'pc bloque=', (cpu.pc >>> 0).toString(16), 'lr=', (cpu.R[14] >>> 0).toString(16), 'sp=', (cpu.R[13] >>> 0).toString(16));
  console.log('regs:', Array.from(cpu.R).map((x) => (x >>> 0).toString(16)).join(' '));
}
console.log('bloques', cpu.nblocks, 'ms', Date.now() - t0, 'heap usado', s3e.mont.usado, 'llamadas:', JSON.stringify(Object.entries(s3e.llamadas).sort((a, b) => b[1] - a[1]).slice(0, 14)));
