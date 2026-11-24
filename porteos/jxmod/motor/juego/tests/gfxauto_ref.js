// la búsqueda de la calidad automática de la web (gfxBuscar de juego/gfxauto.js, la de verdad) con tablas de cuadros
// inventadas: lo que elige y lo que llega a medir, para comparar con juego/src/gfxauto.rs (paso)
// uso: node juego/tests/gfxauto_ref.js > juego/tests/datos/gfxauto.json
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '../../../juego/gfxauto.js'), 'utf8');
const ini = src.indexOf('async function gfxBuscar'), fin = src.indexOf('\n}\n', ini) + 3;
const ctx = { PERF_ORDEN: ['patata', 'bajo', 'medio', 'alto', 'ultra'], GFXA: { umbral: 57 } }; vm.createContext(ctx);
vm.runInContext(src.slice(ini, fin) + '\nthis.gfxBuscar = gfxBuscar;', ctx);
let s = 12345; const azar = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const VAL = [null, 0, 20, 40, 48, 49.5, 50, 55, 56.9, 57, 58, 61, 90, 120];
(async () => {
  const L = [];
  for (let c = 0; c < 400; c++) {
    const fps = [0, 1, 2, 3, 4].map(() => VAL[Math.floor(azar() * VAL.length)]);
    const ki = Math.floor(azar() * 6), inicio = ki < 5 ? ctx.PERF_ORDEN[ki] : 'nada', m = [99, 1, 2, 3][Math.floor(azar() * 4)];
    let n = 0;
    const r = await ctx.gfxBuscar(inicio, async (q) => { n++; return fps[ctx.PERF_ORDEN.indexOf(q)]; }, () => n >= m);
    L.push({ fps, inicio: ki, m, elegida: ctx.PERF_ORDEN.indexOf(r.elegida), med: ctx.PERF_ORDEN.map((q) => (q in r.med ? r.med[q] : 'x')) });
  }
  console.log(JSON.stringify(L));
})();
