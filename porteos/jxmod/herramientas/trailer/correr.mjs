// corre un plano: node correr.mjs plano.js salida [--W 960 --H 402 --n 1 --obt 0.5 --fotos t1,t2,... --video]
// el plano (JS de la página) define CINE.plano = { t0, t1, previo } y CINE.escena(t, dt) con t en el tiempo del tráiler
import { abrir, codificador } from './cine.mjs'; import fs from 'fs'; import path from 'path';
const args = process.argv.slice(2), plano = args[0], salida = args[1];
const op = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const W = +op('W', 960), H = +op('H', 402), n = +op('n', 1), obt = +op('obt', 0.5), fotos = op('fotos', ''), video = args.includes('--video');
const HTML = op('html', 'http://127.0.0.1:8979/JX.html');
const t00 = Date.now();
const { b, ev, err, render } = await abrir(HTML, { W, H });
const comun = op('comun', '');
if (comun) console.log('común:', await ev(fs.readFileSync(comun, 'utf8')));
const code = fs.readFileSync(plano, 'utf8');
const r = await ev(code); console.log('plano:', r);
// --k: el factor del ángulo de visión para otro formato (pisa el CINE.aspK del plano)
if (op('k', '')) console.log('aspK', await ev(`CINE.aspK = ${+op('k', 1)}`)); else console.log('aspK', await ev('CINE.aspK || 1'));
const P = JSON.parse(await ev(`JSON.stringify(CINE.plano)`));
const desde = +op('desde', P.t0), hasta = +op('hasta', P.t1);
// previo: dejar que todo se acomode (sin dibujar) y después dibujar el último medio segundo, con pausas para que el
// navegador termine de decodificar las texturas (se piden al dibujar algo por primera vez)
const previo = P.previo || 1.5;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
await ev(`(() => { CINE.tUlt = null; const t0 = ${desde} - ${previo}; for (let t = t0; t < ${desde} - 0.5 - 1e-6; t += 1 / 24) CINE.avanzar(t, 1 / 24); return 1; })()`);
if (P.calentar && P.calentar.length) {
  await ev(`CINE.renderCuadro(${desde} - 0.5, 1, 0.5, 0)`); await ev(`CINE.precalentar(${JSON.stringify(P.calentar)})`);
  for (let i = 0; i < 4; i++) { await ev(`(() => { R.redim = false; dibujar(); return 1; })()`); await espera(400); }
  await ev(`CINE.enfriar()`);
}
for (let k = 0; k < 12; k++) { const t = desde - 0.5 + k / 24; await ev(`CINE.renderCuadro(${t}, 1, 0.5, 0)`); await espera(k < 3 ? 350 : 60); }
await espera(500);
const fps = 24;
if (fotos) {
  const ts = fotos.split(',').map(Number).sort((a, b) => a - b);
  fs.mkdirSync(salida, { recursive: true });
  let t = desde;
  for (const tf of ts) {
    // avanzar hasta tf sin dibujar, de a 1/24
    await ev(`(() => { let t = ${t}; while (t + 1 / 24 < ${tf} - 1e-6) { t += 1 / 24; CINE.avanzar(t, 1 / 24); } return 1; })()`);
    const t1 = Date.now();
    await render(tf, n, obt, path.join(salida, `f_${tf.toFixed(2)}.jpg`));
    console.log('foto', tf, ((Date.now() - t1) / 1000).toFixed(2) + ' s');
    t = tf;
  }
} else if (video) {
  const enc = codificador(salida, { fps, crf: +op('crf', 12) });
  const nf = Math.round((hasta - desde) * fps);
  for (let i = 0; i < nf; i++) {
    const tf = desde + i / fps;
    const jpg = await render(tf, n, obt, null, 0.95); await enc.poner(jpg);
    if (args.includes('--muestras') && i % 12 === 0) fs.writeFileSync(salida.replace(/\.mp4$/, '') + `_m${String(i).padStart(3, '0')}.jpg`, jpg);
    if (i % 24 === 0) console.log('cuadro', i, '/', nf, ((Date.now() - t00) / 1000).toFixed(0) + ' s');
  }
  await enc.cerrar();
}
console.log('errores', JSON.stringify(err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 6)));
console.log('total', ((Date.now() - t00) / 1000).toFixed(0), 's');
await b.close();
