// Saca los cuadros de los fondos animados del menú principal (escenas.mjs, las que tienen «video») desde el juego, con el
// motor foto_motor.js: el juego en Ultra, el tiempo de a 1/240 s, la escena periódica (la cámara en una vuelta cerrada, lo
// que cae con su horario) y cada cuadro con 4 pasadas (4 instantes en medio cuadro —lo rápido queda corrido, como con una
// cámara de verdad— cada uno corrido una fracción de píxel distinta: suavizado ×4). Con --n 8 son 2 corrimientos por instante
// (como las fotos), pero en esta compu (sin placa de video, compartida) cada cuadro tardaba 9 s: los 1980 cuadros de las 6
// escenas, 5 horas; con 4, la mitad (sin medir contra 8 en el video comprimido: no hubo tiempo de máquina).
// Deja <CARPETA>/<nombre>/c0000.png… (L + fundido segundos: lo que sobra después de la vuelta es para el empalme, bucle.py) y
// <CARPETA>/<nombre>.json (lo armado, lo medido, las huellas de cada vuelta y los cambios de lo que yace en el piso).
// uso: node video.mjs URL_HTML CARPETA [--solo m1_,m3_] [--n 4] [--t 4] [--W 1280 --H 720] [--fundido 1] [--cuadros N]
//        [--desde K]   (seguir un render cortado desde el cuadro K: lo de antes se simula sin dibujar —el dibujo no cambia lo
//                       que pasa: el azar y el reloj vuelven a quedar como estaban después de cada pasada—)
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { ESCENAS } from './escenas.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2), HTML = args[0], OUT = args[1];
const op = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const W = +op('W', 1280), H = +op('H', 720), N = +op('n', 4), NT = +op('t', 4), FUNDIDO = +op('fundido', 1), solo = op('solo', ''), CUADROS = +op('cuadros', 0), DESDE = +op('desde', 0);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push(e.message.slice(0, 300)));
await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
const ev = (s) => p.evaluate((x) => window.__ev(x), s);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.contorno = false; idiomaAplicar('es'); PREFS.gfx = 'ultra'; PREFS.res = 100; PREFS.sombras = '3'; PREFS.post = 'si'; PREFS.resDin = false; PREFS.evento = true; GFX.auto = false; aplicarGfx(); inicioMostrar(false); 1`);
console.log('motor', await ev(fs.readFileSync(path.join(AQUI, 'foto_motor.js'), 'utf8')));
const lista = ESCENAS.filter((S) => S.video && (!solo || solo.split(',').some((k) => S.nombre.includes(k))));
for (const S of lista) {
  const t0 = Date.now(), D = path.join(OUT, S.nombre); fs.mkdirSync(D, { recursive: true });
  await ev(`(() => { FOTO.limpiar(); DBG.cam = null; FOTO.andar(); empezarPartida(${JSON.stringify(S.mapa)}); if (typeof cuDialogoCerrar === 'function') cuDialogoCerrar(); return 1; })()`);
  try { await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego' && !!JUG.suelo`), S.mapa, { timeout: 180000, polling: 500 }); }
  catch (e) { console.log(S.nombre, 'el mapa no cargó'); continue; }
  await espera(2500);
  await ev(`(() => { FOTO.parar(); if (typeof ahorroFijar === 'function') ahorroFijar(0); return 1; })()`);
  const arm = await ev(`FOTO.armarVideo(${JSON.stringify(S)})`);
  console.log(S.nombre, JSON.stringify(arm));
  const L = arm.L, fps = arm.fps;
  // (la plaza JX de los mapas base —identidad.js—: si el monolito queda cortado por el borde en algún momento de la vuelta, se
  // saca; si entra entero siempre, queda. Mirado desde 8 lugares de la vuelta, con la vista ya dibujada)
  let plaza = null;
  for (let k = 0; k < 8 && !(plaza && plaza.corta); k++) {
    await ev(`(() => { FOTO.videoCam(${k * L / 8}); FOTO.pasada(); return 1; })()`); await espera(250);
    plaza = await ev(`(() => { const e = ENTS.lista.find((x) => x.t === 'jx_plaza'); if (!e || !R.vpMundo) return null; const M = R.vpMundo;
      let dentro = 0, fuera = 0;
      for (const [x, y, z] of [[-2.45, 0.45, -1.05], [2.45, 0.45, -1.05], [-2.45, 0.45, 1.05], [2.45, 0.45, 1.05], [-2.45, 17.1, -1.05], [2.45, 17.1, -1.05], [-2.45, 17.1, 1.05], [2.45, 17.1, 1.05]]) {
        const p = vadd(e.p, e.q.rot(v3(x, y, z))), cx = M[0] * p.x + M[4] * p.y + M[8] * p.z + M[12], cy = M[1] * p.x + M[5] * p.y + M[9] * p.z + M[13], cw = M[3] * p.x + M[7] * p.y + M[11] * p.z + M[15];
        if (cw <= 0.01) { fuera++; continue; } const sx = cx / cw, sy = cy / cw; if (Math.abs(sx) <= 1 && sy <= 1) dentro++; else fuera++;
      }
      const corta = dentro > 0 && fuera > 0; if (corta) entidadQuitar(e); return { dentro, fuera, corta, t: ${k * L / 8} }; })()`);
  }
  // la vuelta de calentamiento: dos vueltas sin dibujar (lo que cayó en la anterior ya está en el piso, como en todas las que
  // siguen) y en la segunda, una pasada cada medio segundo (la primera vez que se ve cada cosa el navegador decodifica sus
  // texturas: que no pase en un cuadro del video)
  await ev(`(() => { FOTO.videoCam(0); for (let i = 0; i < ${L * 240}; i++) FOTO.videoPaso(1 / 240); return 1; })()`);
  for (let k = 0; k < L * 2; k++) { await ev(`(() => { for (let i = 0; i < 120; i++) FOTO.videoPaso(1 / 240); FOTO.pasada(); return 1; })()`); await espera(120); }
  await ev(`(() => { FOTO.pasada(); return 1; })()`); await espera(600);
  const medido0 = await ev(`FOTO.medir()`);
  // los cuadros: L + fundido segundos, a un ffmpeg que los guarda en PNG
  const total = CUADROS || Math.round((L + FUNDIDO) * fps);
  // (seguir desde el cuadro K: sus 8 pasos de 1/240 s por cuadro, sin dibujar; las nubes se pintan enteras en cada cuadro)
  if (DESDE) await ev(`(() => { for (let i = 0; i < ${DESDE * 8}; i++) FOTO.videoPaso(1 / 240); return 1; })()`);
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-', '-start_number', String(DESDE), path.join(D, 'c%04d.png')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fin = new Promise((r) => ff.on('close', r));
  const tc = Date.now();
  for (let f = DESDE; f < total; f++) {
    const b64 = await ev(`FOTO.videoCuadro(${N}, ${NT})`);
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 30 === 29 || f === total - 1) console.log(S.nombre, 'cuadro', f + 1, '/', total, ((Date.now() - tc) / (f + 1 - DESDE) / 1000).toFixed(2) + ' s/cuadro');
  }
  ff.stdin.end(); await fin;
  const vid = await ev(`({ t: FOTO.vid.t, lanz: FOTO.vid.lanz, cambios: FOTO.vid.cambios, huellas: FOTO.vid.huellas, cola: EVT.cola.length, vivos: EVT.vivos.length, part: PART.l.length })`);
  fs.writeFileSync(path.join(OUT, S.nombre + '.json'), JSON.stringify({ arm, plaza, medido0, vid, W, H, N, NT, fundido: FUNDIDO, cuadros: total, segundos: (Date.now() - t0) / 1000 }, null, 1));
  console.log(S.nombre, ((Date.now() - t0) / 60000).toFixed(1) + ' min', JSON.stringify({ plaza, lanz: vid.lanz, cambios: vid.cambios.slice(-8), huellas: vid.huellas }));
}
await ev(`FOTO.sinSemilla(); FOTO.limpiar(); 1`);
console.log('errores', JSON.stringify(err.slice(0, 6)));
await b.close();
