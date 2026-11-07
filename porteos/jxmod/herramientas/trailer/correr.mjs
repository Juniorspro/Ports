// corre un plano: node correr.mjs plano.js salida [--W 960 --H 402 --n 1 --obt 0.5 --fotos t1,t2,... --video]
// el plano (JS de la página) define CINE.plano = { t0, t1, previo } y CINE.escena(t, dt) con t en el tiempo del tráiler
import { abrir, codificador } from './cine.mjs'; import fs from 'fs'; import path from 'path';
const args = process.argv.slice(2), plano = args[0], salida = args[1];
const op = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const W = +op('W', 960), H = +op('H', 402), n = +op('n', 1), obt = +op('obt', 0.5), fotos = op('fotos', ''), video = args.includes('--video');
const HTML = op('html', process.env.JX_URL || 'http://127.0.0.1:8979/JX.html');
const t00 = Date.now();
const { b, ev, err, render } = await abrir(HTML, { W, H, skin: op('skin', 'SpecialForcesM') });
const comun = op('comun', '');
if (comun) console.log('común:', await ev(fs.readFileSync(comun, 'utf8')));
const code = fs.readFileSync(plano, 'utf8');
// los clips de captura de movimiento que usa el plano ('c:NN_NN'): bajados antes de armarlo
const clips = [...new Set((code.match(/'c:\d+_\d+'/g) || []).map((x) => x.slice(1, -1)))];
if (clips.length) console.log('clips', clips.join(' '), await ev(`Promise.all(${JSON.stringify(clips)}.map((k) => emoCargar(k))).then((r) => r.map((c) => !!c).join(','))`));
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
  // cada cuadro queda como JPEG en <salida>_cuadros/ (si el proceso se corta, lo hecho no se pierde); con --reanudar
  // los cuadros que ya están no se vuelven a dibujar: la escena avanza igual (los mismos subcuadros, sin dibujar). Al
  // final, el MP4 se arma con los JPEG
  // --solo a:b: sólo los cuadros a..b-1 (los de antes se saltan avanzando la escena igual, como con --reanudar): así
  // un plano se reparte entre varios carriles y queda idéntico a dibujarlo de corrido; el MP4 se arma aparte
  const dir = salida.replace(/\.mp4$/, '') + '_cuadros', reanudar = args.includes('--reanudar');
  const solo = op('solo', ''), [sa, sb] = solo ? solo.split(':').map(Number) : [0, Infinity];
  fs.mkdirSync(dir, { recursive: true });
  const nf = Math.round((hasta - desde) * fps); let hechos = 0, saltados = 0, porCalentar = false;
  for (let i = 0; i < nf && i < sb; i++) {
    const tf = desde + i / fps, arch = path.join(dir, String(i).padStart(4, '0') + '.jpg');
    if (i < sa || (reanudar && fs.existsSync(arch) && fs.statSync(arch).size > 1000)) {
      await ev(`(() => { const fd = 1 / ${fps}; for (let k = 0; k < ${n}; k++) { const ti = ${tf} + (${n} > 1 ? k * fd * ${obt} / ${n} : 0), dt = CINE.tUlt === null ? fd : Math.max(0, ti - CINE.tUlt); CINE.avanzar(ti, dt); } return 1; })()`);
      saltados++; porCalentar = true; continue;
    }
    // después de saltar cuadros (sin dibujar), lo que aparece recién acá todavía no pidió sus texturas: se dibuja este
    // instante unas veces, sin avanzar el tiempo, dándole al navegador tiempo para decodificarlas (si no, los primeros
    // cuadros muestran cosas sin textura, como el arma clavada al empezar 9b)
    if (porCalentar) {
      for (let k = 0; k < 6; k++) { await ev(`CINE.renderCuadro(${tf}, 1, ${obt}, 0)`); await espera(k < 2 ? 600 : 300); }
      porCalentar = false;
    }
    const jpg = await render(tf, n, obt, null, 0.95); fs.writeFileSync(arch, jpg); hechos++;
    if (args.includes('--muestras') && i % 12 === 0) fs.writeFileSync(salida.replace(/\.mp4$/, '') + `_m${String(i).padStart(3, '0')}.jpg`, jpg);
    if (i % 24 === 0) console.log('cuadro', i, '/', nf, ((Date.now() - t00) / 1000).toFixed(0) + ' s');
  }
  console.log('cuadros dibujados', hechos, 'ya estaban', saltados);
  if (solo) {
    console.log('parte', solo, 'lista (el MP4 se arma cuando estén todas)'); console.log('errores', JSON.stringify(err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 6)));
    console.log('total', ((Date.now() - t00) / 1000).toFixed(0), 's'); await b.close(); process.exit(0);
  }
  const { spawnSync } = await import('child_process');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, '%04d.jpg'), '-frames:v', String(nf), '-c:v', 'libx264', '-preset', 'medium', '-crf', String(+op('crf', 12)), '-pix_fmt', 'yuv444p', '-r', String(fps), salida], { stdio: 'inherit' });
  console.log('mp4', r.status === 0 ? 'listo' : 'ERROR ' + r.status, salida);
}
console.log('errores', JSON.stringify(err.filter((e) => !/WebSocket|mqtt/i.test(e)).slice(0, 6)));
console.log('total', ((Date.now() - t00) / 1000).toFixed(0), 's');
await b.close();
