// Portada animada de HypperX RezoBox (cuadros del juego de verdad). Uso, con NODE_PATH hacia playwright:
//   node captura.mjs Hypper.html carpeta 150 15     (150 cuadros del bucle + 15 para fundir el final con el principio)
//   python3 -I post.py carpeta salida ../../juego/logo_rezobox.webp 150 15
//   ffmpeg -framerate 100/3 -i salida/g%04d.png -vf "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 portada.gif
// La cámara hace un arco suave que vuelve al mismo lugar; cada cuadro es un paso de 0,03 s del juego (el GIF guarda
// centésimas: 0,03 s = 33 fps a velocidad real) y la imagen se lee del lienzo apenas se dibuja (1920×1080, se achica a 960×540).
import { preparar } from './escena.mjs'; import fs from 'fs';
const [html, D, N, F] = [process.argv[2], process.argv[3], +(process.argv[4] || 150), +(process.argv[5] || 12)];
// vertical (9:16) con VERTICAL=1: 1080×1920 y la cámara más atrás y mirando más arriba (entra la rampa entera)
const VERT = !!process.env.VERTICAL, [W, H] = VERT ? [1080, 1920] : [1920, 1080];
fs.mkdirSync(D, { recursive: true });
const { b, p, ev, err, manual, paso, pasoFoto } = await preparar(html, W, H);
await ev(fs.readFileSync(new URL('./armar_escena.js', import.meta.url), 'utf8'));
await manual(); await paso(45);
// ya apoyado: sin arma y en pose de pelea (si se pone antes, al caer se corta)
await ev(`JUG.vel.set(0, 0, 0); elegirArma(ARM.lista.indexOf('Hands')); emote('FightIdle'); 1`); await paso(45);
console.log('pose:', await ev(`JSON.stringify({emote: JUG.cuerpo.emote, arma: ARM.lista[ARM.i], suelo: JUG.suelo})`));
console.log(await ev(`JSON.stringify({buf: R.gl.drawingBufferWidth + 'x' + R.gl.drawingBufferHeight, t: TIEMPO.t.toFixed(2)})`));
const t0 = Date.now();
for (let f = 0; f < N + F; f++) {
  const u = 2 * Math.PI * f / N;
  await ev(`(() => { const C = window.__C, a = -0.12 + 0.3 * Math.sin(${u}), r = (${VERT} ? 6.6 : 4.7) + 0.25 * Math.cos(${u}), h = (${VERT} ? 1.0 : 1.25) + 0.08 * Math.sin(${u} * 2);
    const c = v3(C.x + Math.sin(a) * r, C.y + h, C.z + Math.cos(a) * r), m = v3(C.x + Math.sin(a) * 1.5, C.y + (${VERT} ? 3.6 : 2.3), C.z - 6), d = vsub(m, c).norm();
    DBG.cam = { p: c, q: Quat.euler(Math.atan2(d.x, d.z), -Math.asin(d.y)) }; })()`);
  fs.writeFileSync(`${D}/f${String(f).padStart(4, '0')}.jpg`, await pasoFoto());
  if (f % 30 === 0) console.log('cuadro', f, ((Date.now() - t0) / 1000 / (f + 1)).toFixed(2), 's/cuadro');
}
console.log('total', ((Date.now() - t0) / 1000).toFixed(0), 's');
console.log('errores:', err.slice(0, 5).join(' | ') || 'ninguno');
await b.close();
