// El modo grabación (grabar.js; Discord, Chillguy: el grabador del celular dejó de grabar el sonido del juego). Graba de
// verdad con el juego andando y mira el archivo con ffprobe y ffmpeg:
//  1. el archivo: existe, dura lo grabado (±0,3 s; las pausas no cuentan), tiene la resolución y los cuadros elegidos
//     (±10 %, o los del juego si da menos: 30 y 60 con el tamaño de la pantalla; 720p y 1080p) y la duración escrita en la
//     cabecera (Chrome la deja vacía);
//  2. el sonido del juego, medido en dB: hay señal donde sonó un disparo, una explosión y música (notas del sintetizador
//     del juego) y silencio donde no sonó nada;
//  3. sonido y video juntos: cada sonido y su destello (la pantalla en blanco ese cuadro) a menos de 100 ms;
//  4. lo que cuesta grabar contra no grabar: cuadros por segundo del juego y ms de JS por cuadro (todo el cuadro y lo propio
//     de grabar), con el procesador 4 veces más lento, en Gráficos bajos y medios, en 720p 30, 1080p 60 y la pantalla a 30,
//     corridas alternadas (y el tiempo de procesador de cada proceso); el de fábrica tiene que costar menos que 1080p 60;
//  5. el celular (873×402): el botón de la pausa, el de la pantalla y el indicador miden 44 px o más, se tocan bien
//     (el indicador termina la grabación con un toque) y no tapan los controles del juego;
//  6. la app (simulada): el video va a Java por pedazos por el mismo camino que en el celular (JXNativo.grab*, con
//     Grabador.java de verdad: PruebaGrabador --servir) y queda en Movies/JXMod con la duración en la cabecera;
//  7. MP4: con H.264 en MP4 (este Chromium no tiene AAC: se pide avc1 con Opus para probar el contenedor) también queda la
//     duración (mehd) y se reproduce;
//  8. el sonido interno con el grabador del celular (voz.js): en Android el micrófono del chat se suelta en segundo plano y
//     al volver se abre recién cuando el sonido del juego ya arrancó, y la voz sigue con la pista nueva;
//  v. las voces del chat: se escuchan como antes y no van al video salvo que se pidan;
//  9. sin errores de JS.
// uso: node grabar.mjs URL_HTML [CARPETA]   (CARPETA: capturas, archivos y avance/; FASES=1234… para correr algunas)
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs'; import path from 'path'; import os from 'os'; import { execFileSync, spawn } from 'child_process';
const [, , HTML, D0] = process.argv;
const D = D0 || fs.mkdtempSync(path.join(os.tmpdir(), 'grabar-')); fs.mkdirSync(path.join(D, 'avance'), { recursive: true });
const AQUI = path.dirname(new URL(import.meta.url).pathname), APK = path.join(AQUI, '..', 'apk');
const FASE = (k) => !process.env.FASES || process.env.FASES.includes(k);
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900) : '')); };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ARGS });
const errJS = [];
process.on('uncaughtException', (e) => { console.log('ERROR', e && e.message ? e.message.split('\n')[0] : e); process.exit(2); });
async function abrir(vp, dpr, gfx) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, permissions: ['microphone'] });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errJS.push(e.message.slice(0, 200))); p.on('console', (m) => { if (/grabar/.test(m.text())) errJS.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await p.goto(HTML + (HTML.includes('?') ? '&' : '?') + 'test'); await p.waitForFunction(() => window.__listo, null, { timeout: 240000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.evento = false; PREFS.ambiente = false; PREFS.vol = 80; PREFS.gfx = '${gfx}'; GFX.auto = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
  // (el destello de la prueba: con window.__flash > 0, el cuadro recién dibujado queda en blanco —antes de que grabar.js lo copie—
  // y en el primero suena lo pedido; cada marca guarda cuándo, desde que empezó la grabación)
  await ev(`(() => { const d0 = dibujar; window.__marcas = [];
    dibujar = function () { const r = d0.apply(this, arguments); const F = window.__flash; if (F && F.n > 0) { const gl = R.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.disable(gl.SCISSOR_TEST); gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      if (F.f) { F.f(); F.f = null; window.__marcas.push({ k: F.k, t: performance.now() - GRAB.t }); } F.n--; } return r; };
    PREFS.vol = 80; if (AUD.master) AUD.master.gain.value = 0.8; return 1; })()`);
  await p.waitForTimeout(2500);
  return { ctx, p, ev };
}
const sh = (cmd, args) => execFileSync(cmd, args, { maxBuffer: 1 << 28 });
function probe(f) { return JSON.parse(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,sample_rate,channels', '-of', 'json', f]).toString()); }
// cuadros: tiempos y brillo medio (32×18 en gris)
function cuadros(f) {
  const t = sh('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', f]).toString().trim().split('\n').map(Number);
  const raw = sh('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=32:18,format=gray', '-vsync', 'passthrough', '-f', 'rawvideo', '-']);
  const n = Math.min(t.length, Math.floor(raw.length / 576)), br = [];
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < 576; j++) s += raw[i * 576 + j]; br.push(s / 576); }
  return { t: t.slice(0, n), br };
}
function pcm(f) { const r = sh('ffmpeg', ['-v', 'error', '-i', f, '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', '-']); return new Int16Array(r.buffer, r.byteOffset, Math.floor(r.length / 2)); }
const dB = (a, t0, t1) => { const i0 = Math.max(0, Math.round(t0 * 48000)), i1 = Math.min(a.length, Math.round(t1 * 48000)); let s = 0, pk = 0; for (let i = i0; i < i1; i++) { const v = a[i] / 32768; s += v * v; pk = Math.max(pk, Math.abs(v)); } const rms = Math.sqrt(s / Math.max(1, i1 - i0)); return { rms: rms > 0 ? +(20 * Math.log10(rms)).toFixed(1) : -120, pico: pk > 0 ? +(20 * Math.log10(pk)).toFixed(1) : -120 }; };
// (el comienzo de un sonido: el primer tramo de 2,5 ms con 4 veces la energía de los 50 ms de antes —así la cola de eco del
// anterior no lo tapa— y por encima del umbral)
function inicioSonido(a, t0, t1, umbral) {
  const T = 120, rms = (i) => { let s = 0; for (let k = i; k < i + T && k < a.length; k++) { const v = a[k] / 32768; s += v * v; } return Math.sqrt(s / T); };
  const i0 = Math.max(T * 20, Math.round(t0 * 48000)), i1 = Math.min(a.length - T, Math.round(t1 * 48000)), E = [];
  for (let i = i0 - T * 20; i < i1; i += T) E.push(rms(i));
  for (let j = 20; j < E.length; j++) { let m = 0; for (let k = j - 20; k < j; k++) m += E[k]; m /= 20; if (E[j] > umbral && E[j] > m * 4) return (i0 + (j - 20) * T) / 48000; }
  return null;
}
function inicioDestello(C, t0, t1) { for (let i = 1; i < C.t.length; i++) if (C.t[i] >= t0 && C.t[i] <= t1 && C.br[i] > 200 && C.br[i - 1] < 170) return C.t[i]; return null; }
// guardar el video de la página (la descarga, sin bajar: el blob de GRAB.ult)
async function bajar(ev, nombre) {
  const s = await ev(`(async () => { const u = GRAB.ult; if (!u || !u.blob) return ''; const a = new Uint8Array(await u.blob.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode.apply(null, a.subarray(i, i + 32768)); return btoa(s); })()`);
  const f = path.join(D, nombre); fs.writeFileSync(f, Buffer.from(s, 'base64')); return f;
}
const jpg = (p, n) => p.screenshot({ path: path.join(D, 'avance', n), type: 'jpeg', quality: 70 });

// ======== 1, 2, 3: el archivo, el sonido y el destello ========
// (la máquina de las pruebas es compartida: con otras pruebas corriendo —carga de más de 4 en 4 núcleos— se espera hasta
// 10 min a que baje antes de cada parte que mide tiempos)
const carga = () => +fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
const esperarCarga = async (min) => { for (let i = 0; i < min * 12 && carga() > 4; i++) await new Promise((r) => setTimeout(r, 5000)); return carga(); };
// la secuencia: 2 s quieto, un disparo, una explosión, música (una melodía con el piano del juego —el sintetizador de los
// mods y del piano—), la pausa del juego 1,5 s y la app en segundo plano 1,5 s (no cuentan), y un rato más; cada sonido
// con su destello (la pantalla en blanco ese cuadro)
async function secuencia(p, ev, cal, fps, nombre) {
  await ev(`window.__marcas = []; GRAB.ult = null; window.__grabSinDescarga = 1; PREFS.grab = { cal: '${cal}', fps: ${fps}, mic: false, voces: false, hud: true }; guardarPrefs(); 1`);
  const t0 = Date.now(); await ev(`grabEmpezar()`);
  await p.waitForFunction(() => window.__ev(`!!(GRAB.on && GRAB.rec && GRAB.rec.state === 'recording')`), null, { timeout: 20000 });
  const ev2 = (k, f) => ev(`window.__flash = { n: 4, k: '${k}', f: () => { ${f} } }; 1`);
  const fj = []; const muestra = setInterval(() => ev(`TIEMPO.fps`).then((x) => fj.push(x)).catch(() => {}), 1000);
  await p.waitForTimeout(2000); await ev2('disparo', `sonar('pistol2Fire_1', null, 1)`);
  await p.waitForTimeout(1500); await ev2('explosion', `sonar('GrenadeExplode', null, 1)`);
  await p.waitForTimeout(1500);
  await ev2('musica', `const N = [523, 659, 784, 1047, 784, 659, 523, 659]; N.forEach((hz, i) => setTimeout(() => notaTocar(hz, 0.4, null, 0.9, 'piano'), i * 250))`);
  await p.waitForTimeout(3000);
  await ev(`abrirPausa(); 1`); await p.waitForTimeout(1500); const enPausa = await ev(`GRAB.pausa + ':' + GRAB.rec.state`); await ev(`cerrarPaneles(); 1`);
  await p.waitForTimeout(600);
  await ev(`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1`);
  await p.waitForTimeout(1500); const enFondo = await ev(`GRAB.pausa + ':' + GRAB.rec.state`);
  await ev(`delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); 1`);
  await p.waitForTimeout(600);
  const marcas = JSON.parse(await ev(`JSON.stringify(window.__marcas)`)); clearInterval(muestra);
  const juego = fj.slice(1).reduce((x, y) => x + y, 0) / Math.max(1, fj.length - 1);
  await ev(`grabParar(); 1`); await p.waitForFunction(() => window.__ev(`!!GRAB.ult`), null, { timeout: 30000 });
  const ult = JSON.parse(await ev(`JSON.stringify(Object.assign({}, GRAB.ult, { blob: undefined }))`)), pared = (Date.now() - t0) / 1000;
  const f = await bajar(ev, nombre + '.' + (/mp4/.test(ult.tipo) ? 'mp4' : 'webm'));
  const P = probe(f), V = P.streams.find((x) => x.codec_type === 'video'), A = P.streams.find((x) => x.codec_type === 'audio'), C = cuadros(f), a = pcm(f);
  const M = Object.fromEntries(marcas.map((m) => [m.k, m.t / 1000]));
  const sil = dB(a, 0.3, Math.min(1.6, M.disparo - 0.3)), dis = dB(a, M.disparo - 0.05, M.disparo + 0.35), exp = dB(a, M.explosion - 0.05, M.explosion + 0.8), mus = dB(a, M.musica + 0.05, M.musica + 1.9), sil2 = dB(a, M.musica + 3.3, M.musica + 4.0);
  const des = ['disparo', 'explosion', 'musica'].map((k) => { const tv = inicioDestello(C, M[k] - 0.3, M[k] + 0.6), ta = inicioSonido(a, M[k] - 0.3, M[k] + 0.6, 0.01); return { k, video: tv, sonido: ta, ms: tv !== null && ta !== null ? Math.round((ta - tv) * 1000) : null }; });
  return { f, ult, P, V, A, C, M, dur: +P.format.duration, fpsReal: (C.t.length - 1) / (C.t[C.t.length - 1] - C.t[0]), juego, pared, enPausa, enFondo, sonido: { silencio: sil, disparo: dis, explosion: exp, musica: mus, 'silencio después': sil2 }, des };
}
const señal = (S) => ['disparo', 'explosion', 'musica'].every((k) => S[k].rms - S.silencio.rms >= 25 && S[k].pico > -30) && S.silencio.rms < -55 && S['silencio después'].rms < -55;
if (FASE('1')) {
  const cg = await esperarCarga(10);
  const { ctx, p, ev } = await abrir({ width: 873, height: 402 }, 1, 'patata');
  const r = await secuencia(p, ev, '720', 30, 'video_720p30');
  ok('1. archivo: existe, MP4 o WebM según lo que sabe el navegador, con video y sonido', fs.statSync(r.f).size > 10000 && !!r.V && !!r.A, { archivo: path.basename(r.f), MB: +(fs.statSync(r.f).size / 1048576).toFixed(2), tipo: r.ult.tipo, video: r.V && r.V.codec_name, sonido: r.A && r.A.codec_name + ' ' + r.A.sample_rate + ' Hz', 'carga de la máquina': cg });
  ok('1b. duración: la del archivo (cabecera) = lo grabado ±0,3 s, sin la pausa ni el segundo plano', Math.abs(r.dur - r.ult.ms / 1000) <= 0.3 && r.pared - r.dur > 2.6 && r.enPausa === 'true:paused' && r.enFondo === 'true:paused',
    { archivo: r.dur, grabado: r.ult.ms / 1000, 'reloj de la prueba': +r.pared.toFixed(2), 'en la pausa': r.enPausa, 'en segundo plano': r.enFondo });
  // (los cuadros: los 30 elegidos si el juego y el codificador llegan; acá VP8 va por software, en los mismos 4 núcleos que
  // dibujan con SwiftShader, y a 1566×720 no siempre llega: se mide que no pase de 30 y se anota cuántos salieron —1d y 1e
  // miden los 30 y los 60 donde el codificador llega—)
  ok('1c. resolución 720p (el lado corto, con la forma de la pantalla) y nunca más de 30 cuadros por segundo', r.V.height === 720 && r.V.width === r.ult.W && r.fpsReal <= 33, { tam: r.V.width + '×' + r.V.height, cuadros: r.C.t.length, 'por segundo': +r.fpsReal.toFixed(2), 'el juego (grabando)': +r.juego.toFixed(1) });
  ok('2. sonido (720p30): disparo, explosión y música con señal; silencio donde no sonó nada (dBFS)', señal(r.sonido), Object.assign({}, r.sonido, { 'marcas (s)': r.M }));
  console.log('     destellos y sonidos en el de 720p30 (con el codificador al límite se pierden cuadros): ' + JSON.stringify(r.des));
  sh('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, r.M.disparo - 0.8)), '-i', r.f, '-frames:v', '1', '-q:v', '4', path.join(D, 'avance', '05_cuadro_video.jpg')]);
  await ctx.close();
  // la misma secuencia con el tamaño de la pantalla en una más chica (acá el codificador llega a tiempo y no pierde cuadros)
  await esperarCarga(5);
  const q = await abrir({ width: 640, height: 360 }, 1, 'patata');
  const s2 = await secuencia(q.p, q.ev, 'pant', 30, 'video_pantalla30');
  ok('2b. sonido (pantalla a 30): igual', señal(s2.sonido), s2.sonido);
  ok('3. sonido y video juntos: cada sonido a menos de 100 ms de su destello', s2.des.every((x) => x.ms !== null && Math.abs(x.ms) < 100), { pantalla30: s2.des, 'por segundo': +s2.fpsReal.toFixed(1), juego: +s2.juego.toFixed(1) });
  await q.ctx.close();
}

// ======== 1d: los cuadros elegidos (30 y 60, con el tamaño de la pantalla, que acá se puede codificar a tiempo) y 1080p ========
if (FASE('1')) {
  await esperarCarga(10);
  const { ctx, p, ev } = await abrir({ width: 640, height: 360 }, 1, 'patata');
  const r = {};
  for (const [cal, fps] of [['pant', 30], ['pant', 60], ['1080', 60]]) {
    await ev(`GRAB.ult = null; window.__grabSinDescarga = 1; PREFS.grab = { cal: '${cal}', fps: ${fps}, hud: true }; grabEmpezar()`);
    await p.waitForFunction(() => window.__ev(`!!(GRAB.on && GRAB.rec && GRAB.rec.state === 'recording')`), null, { timeout: 20000 });
    const fj = []; for (let i = 0; i < 5; i++) { await p.waitForTimeout(1000); fj.push(await ev(`TIEMPO.fps`)); }
    const juego = fj.slice(1).reduce((x, y) => x + y, 0) / (fj.length - 1);
    await ev(`grabParar(); 1`); await p.waitForFunction(() => window.__ev(`!!GRAB.ult`), null, { timeout: 30000 });
    const u = JSON.parse(await ev(`JSON.stringify(Object.assign({}, GRAB.ult, { blob: undefined }))`)), f = await bajar(ev, `video_${cal}_${fps}.webm`);
    const P = probe(f), V = P.streams.find((s) => s.codec_type === 'video'), C = cuadros(f);
    r[cal + fps] = { pedido: u.W + '×' + u.H, archivo: V.width + '×' + V.height, cuadros: C.t.length, porSeg: +((C.t.length - 1) / (C.t[C.t.length - 1] - C.t[0])).toFixed(1), juego: +juego.toFixed(1), dur: +(+P.format.duration).toFixed(2), grabado: u.ms / 1000 };
  }
  const cv = await ev(`R.cv.width + '×' + R.cv.height`), par = cv.replace(/(\d+)/g, (x) => String(Math.round(x / 2) * 2)), A = r.pant30, B = r.pant60, C = r['108060'];
  // (los cuadros del video: los elegidos, o los del juego si da menos —acá SwiftShader, en una máquina compartida—, ±10 %)
  const cerca = (x, m) => Math.abs(x.porSeg - Math.min(m, x.juego)) <= Math.min(m, x.juego) * 0.1;
  ok('1d. 30 por segundo: 30 ±10 % (con el juego más rápido, un cuadro sí y otro no), o los del juego si da menos; del tamaño del lienzo', A.archivo === par && cerca(A, 30), Object.assign({ lienzo: cv }, A));
  ok('1e. 60 por segundo: 60 ±10 %, o cada cuadro del juego si da menos (no se queda en 30)', B.archivo === par && cerca(B, 60), B);
  ok('1f. 1080p: 1080 de alto con la forma de la pantalla y la duración bien (los cuadros, los que da el juego acá)', C.archivo === C.pedido && /×1080$/.test(C.archivo) && Math.abs(C.dur - C.grabado) <= 0.3, C);
  await ctx.close();
}

// ======== 4: lo que cuesta ========
if (FASE('4')) {
  const carga0 = await esperarCarga(20);
  const { ctx, p, ev } = await abrir({ width: 873, height: 402 }, 2, 'bajo');
  const cdp = await ctx.newCDPSession(p), cdpB = await b.newBrowserCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // (el JS propio de grabar, medido adentro: grabCuadro en cada cuadro y lo que se hace con cada pedazo)
  await ev(`(() => { window.__gj = { ms: 0, n: 0 }; const g0 = grabCuadro; grabCuadro = function () { const t = performance.now(); g0(); __gj.ms += performance.now() - t; __gj.n++; };
    const p0 = grabPedazo; grabPedazo = function (b) { const t = performance.now(); p0(b); __gj.ms += performance.now() - t; }; return 1; })()`);
  const cpu = async () => { const r = await cdpB.send('SystemInfo.getProcessInfo'); const o = {}; for (const x of r.processInfo) o[x.type] = (o[x.type] || 0) + x.cpuTime; return o; };
  const medir = async () => {
    await p.waitForTimeout(2500); const c0 = await cpu(), f = [], ms = []; const t0 = Date.now(); await ev(`__gj.ms = 0; __gj.n = 0; 1`);
    for (let i = 0; i < 6; i++) { await p.waitForTimeout(1000); const x = JSON.parse(await ev(`JSON.stringify([TIEMPO.fps, TIEMPO.msProm])`)); f.push(x[0]); ms.push(x[1]); }
    const c1 = await cpu(), s = (Date.now() - t0) / 1000, m = (a) => a.reduce((x, y) => x + y, 0) / a.length, gj = JSON.parse(await ev(`JSON.stringify(__gj)`));
    return { fps: m(f), ms: m(ms), grab: gj.n ? gj.ms / gj.n : 0, carga: carga(), cpu: Object.fromEntries(Object.keys(c1).map((k) => [k.toLowerCase(), ((c1[k] - (c0[k] || 0)) / s)])) };
  };
  const T = {};
  for (const g of ['bajo', 'medio']) {
    await ev(`PREFS.gfx = '${g}'; aplicarGfx(); 1`); await p.waitForTimeout(2000);
    for (let vuelta = 0; vuelta < 3; vuelta++) for (const [k, cal, fps] of [['sin grabar'], ['720p30', '720', 30], ['1080p60', '1080', 60], ['pantalla 30', 'pant', 30]]) {
      if (cal) await ev(`GRAB.ult = null; window.__grabSinDescarga = 1; PREFS.grab = { cal: '${cal}', fps: ${fps}, hud: true }; grabEmpezar()`);
      const r = await medir();
      if (cal) { await ev(`grabParar(); 1`); await p.waitForFunction(() => window.__ev(`!!GRAB.ult`), null, { timeout: 60000 }); }
      const L = (T[g + ' · ' + k] = T[g + ' · ' + k] || []); L.push(r);
      await p.waitForTimeout(800);
    }
  }
  const tabla = {}, cv = await ev(`R.cv.width + '×' + R.cv.height`);
  for (const k in T) { const L = T[k], m = (f) => L.reduce((x, y) => x + f(y), 0) / L.length; tabla[k] = { fps: +m((x) => x.fps).toFixed(1), 'ms JS': +m((x) => x.ms).toFixed(2), 'ms JS de grabar': +m((x) => x.grab).toFixed(3), 'cpu renderer': +m((x) => x.cpu.renderer || 0).toFixed(2), 'cpu gpu': +m((x) => x.cpu.gpu || 0).toFixed(2), carga: +m((x) => x.carga).toFixed(1) }; }
  console.log('     costo (procesador ×4, lienzo ' + cv + ', 3 vueltas alternadas de 6 s; cpu = segundos de procesador por segundo; carga de la máquina al empezar: ' + carga0 + '):');
  for (const k in tabla) console.log('       ' + k.padEnd(22) + JSON.stringify(tabla[k]));
  const d = (g, k) => ({ fps: +(tabla[g + ' · ' + k].fps - tabla[g + ' · sin grabar'].fps).toFixed(1), msJS: +(tabla[g + ' · ' + k]['ms JS'] - tabla[g + ' · sin grabar']['ms JS']).toFixed(2), grabar: tabla[g + ' · ' + k]['ms JS de grabar'] });
  const dif = { 'bajo 720p30': d('bajo', '720p30'), 'bajo 1080p60': d('bajo', '1080p60'), 'bajo pantalla 30': d('bajo', 'pantalla 30'), 'medio 720p30': d('medio', '720p30'), 'medio 1080p60': d('medio', '1080p60'), 'medio pantalla 30': d('medio', 'pantalla 30') };
  // (el JS de grabar por cuadro es poco: copiar el cuadro y mirar la pausa; lo pesado —codificar y leer el cuadro de la placa—
  // va en otros hilos, que acá son SwiftShader y VP8 por software en los mismos 4 núcleos)
  // (el de fábrica, 720p a 30, tiene que costar menos cuadros del juego que 1080p a 60, en bajo y en medio)
  ok('4. costo medido contra no grabar (procesador ×4, 3 vueltas alternadas); el de fábrica (720p30) cuesta menos que 1080p60', dif['bajo 720p30'].fps > dif['bajo 1080p60'].fps && dif['medio 720p30'].fps > dif['medio 1080p60'].fps, dif);
  fs.writeFileSync(path.join(D, 'costo.json'), JSON.stringify({ lienzo: cv, tabla, dif }, null, 1));
  await ctx.close();
}

// ======== 5: el celular (873×402) ========
if (FASE('5')) {
  const { ctx, p, ev } = await abrir({ width: 873, height: 402 }, 2, 'bajo');
  await ev(`PREFS.grab = { cal: '720', fps: 30, hud: true }; guardarPrefs(); grabBotones(); document.body.classList.add('tactil'); hudDisponer(); 1`); await p.waitForTimeout(600);
  const rect = (sel) => ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return JSON.stringify([r.left, r.top, r.width, r.height].map(Math.round)); })()`).then((x) => x && JSON.parse(x));
  // los controles del juego que se ven (para ver que no se pisan)
  const controles = async (fuera) => JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#hud .bt, #hud .bt-t, #hud .redondo, #armaAct, #palanca, #hud #vida')].filter((e) => !e.matches('${fuera}') && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.oc')).map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.dataset.btn || e.className.split(' ')[0], r.left, r.top, r.right, r.bottom].map((x) => typeof x === 'number' ? Math.round(x) : x); }))`));
  const pisa = (r, L) => L.filter((c) => r[0] < c[3] - 1 && r[0] + r[2] > c[1] + 1 && r[1] < c[4] - 1 && r[1] + r[3] > c[2] + 1).map((c) => c[0]);
  const hb = await rect('#grabBt'), hudC = await controles('#grabBt');
  await jpg(p, '00_hud_boton.jpg');
  ok('5. botón ● REC de la pantalla: 44 px o más y no pisa otro control', hb && hb[2] >= 44 && hb[3] >= 44 && !pisa(hb, hudC).length, { boton: hb, pisa: pisa(hb, hudC) });
  // la pausa: el botón Grabar
  await ev(`abrirPausa(); 1`); await p.waitForTimeout(700); const pb = await rect('#bGrabar');
  await jpg(p, '01_pausa_boton.jpg');
  ok('5b. «Grabar» en la pausa: 44 px de alto o más', pb && pb[3] >= 44 && pb[2] >= 44, { boton: pb });
  // las opciones (los botones de las opciones también)
  await p.tap('#bGrabar'); await p.waitForTimeout(700);
  const op = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#grabPan button')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 14) || e.className, Math.round(r.width), Math.round(r.height), Math.round(r.bottom)]; }))`));
  const caja = await rect('#grabPan .grCaja');
  await jpg(p, '03_opciones.jpg');
  ok('5c. las opciones: abren desde la pausa, entran en la pantalla y cada botón mide 44 px o más', op.length >= 8 && op.every((x) => x[1] >= 44 && x[2] >= 44) && caja[1] >= 0 && caja[1] + caja[3] <= 402, { botones: op.length, menor: op.reduce((m, x) => Math.min(m, x[1], x[2]), 99), caja });
  // empezar (con el dedo) → el indicador
  await p.tap('#grabPan .grIr');
  await p.waitForFunction(() => window.__ev(`!!(GRAB.on && GRAB.rec && GRAB.rec.state === 'recording')`), null, { timeout: 20000 });
  await p.waitForTimeout(2200); const ind = await rect('#grabInd'), hudC2 = await controles('#grabBt'), tInd = await ev(`$('grabInd').textContent`);
  await jpg(p, '02_grabando.jpg');
  ok('5d. el indicador: punto rojo y tiempo, 44 px o más, sin tapar controles', ind && ind[3] >= 44 && ind[2] >= 44 && !pisa(ind, hudC2).length && /\d:\d\d/.test(tInd), { indicador: ind, texto: tInd, pisa: pisa(ind, hudC2) });
  // un toque en el indicador termina y guarda
  await ev(`window.__grabSinDescarga = 1; 1`);
  await p.tap('#grabInd'); await p.waitForFunction(() => window.__ev(`!!GRAB.ult`), null, { timeout: 30000 }); await p.waitForTimeout(500);
  const av = await rect('#grabAviso'), avT = await ev(`$('grabAviso').textContent`), hudC3 = await controles('#grabBt');
  await jpg(p, '04_guardado.jpg');
  ok('5e. un toque en el indicador termina; el aviso dice dónde quedó (arriba, sin tapar controles)', !(await ev(`GRAB.on`)) && /JXMod_\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d\.(mp4|webm)/.test(avT) && av && !pisa(av, hudC3).length, { aviso: avT, rect: av, pisa: pisa(av, hudC3) });
  // esconder el botón de la pantalla (las opciones)
  await ev(`PREFS.grab.hud = false; grabBotones(); 1`); await p.waitForTimeout(400); const oculto = await ev(`$('grabBt').style.display`);
  await ev(`PREFS.grab.hud = true; grabBotones(); 1`);
  ok('5f. el botón de la pantalla se puede esconder', oculto === 'none', { display: oculto });
  // empezar con el botón de la pantalla y salir al menú grabando: se guarda lo grabado
  await ev(`GRAB.ult = null; 1`); await p.waitForTimeout(300); await p.tap('#grabBt');
  await p.waitForFunction(() => window.__ev(`!!(GRAB.on && GRAB.rec && GRAB.rec.state === 'recording')`), null, { timeout: 20000 });
  await p.waitForTimeout(2000); await ev(`irMenuPrincipal(); 1`);
  await p.waitForFunction(() => window.__ev(`!!GRAB.ult`), null, { timeout: 30000 });
  const sal = JSON.parse(await ev(`JSON.stringify({ ok: GRAB.ult.ok, ms: GRAB.ult.ms, on: GRAB.on, estado: JUEGO.estado })`));
  ok('5g. el botón de la pantalla empieza; si se sale al menú grabando, se guarda lo grabado', sal.ok && sal.ms > 1500 && !sal.on, sal);
  await ctx.close();
}

// ======== 6: la app (simulada): JXNativo.grab* con Grabador.java ========
if (FASE('6')) {
  const JC = fs.mkdtempSync(path.join(os.tmpdir(), 'grabj-')), SD = path.join(D, 'celular');
  execFileSync('javac', ['--release', '8', '-Xlint:-options', '-nowarn', '-d', JC, path.join(APK, 'web/src/com/jxmod/app/Grabador.java'), path.join(APK, 'pruebas/unido/PruebaGrabador.java')], { stdio: 'pipe' });
  const PJ = 8997;
  const java = spawn('java', ['-Dfile.encoding=UTF-8', '-Xmx64m', '-cp', JC, 'PruebaGrabador', '--servir', String(PJ), SD], { env: { ...process.env, LC_ALL: 'C.UTF-8' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => java.stdout.once('data', r));
  process.on('exit', () => { try { java.kill(); } catch (e) {} });
  const { ctx, p, ev } = await abrir({ width: 873, height: 402 }, 1, 'patata');
  // (el puente como lo ve la página: llamadas que esperan la respuesta —XMLHttpRequest sincrónico a Java—; el resto, nada)
  await ev(`(() => { const U = 'http://127.0.0.1:${PJ}/grab/', sx = (r, q, cuerpo) => { const x = new XMLHttpRequest(); x.open('POST', U + r + '?' + q, false); x.send(cuerpo || ''); return x.responseText; };
    window.__pedazos = 0; window.__llamadaMs = 0;
    const G = { grabar: () => 1, grabEmpezar: (n, m) => sx('empezar', 'nombre=' + encodeURIComponent(n) + '&mime=' + encodeURIComponent(m)),
      grabEscribir: (id, b) => { window.__pedazos++; const t = performance.now(); const r = +sx('escribir', 'id=' + id, b); window.__llamadaMs = Math.max(window.__llamadaMs, performance.now() - t); return r; },
      grabPendiente: (id) => +sx('pendiente', 'id=' + id), grabParche: (id, pos, b) => sx('parche', 'id=' + id + '&pos=' + pos, b) === 'true',
      grabFin: (id) => { const r = sx('fin', 'id=' + id); setTimeout(() => window.__jxGrabListo && window.__jxGrabListo(r), 0); }, grabCancelar: (id) => sx('cancelar', 'id=' + id),
      audioEstado: () => '{"sdk":34,"modo":0,"captura":1,"usos":[1,14]}' };
    window.JXNativo = new Proxy(G, { get: (o, k) => (k in o ? o[k] : () => 0) }); return 1; })()`);
  await ev(`PREFS.grab = { cal: '720', fps: 30, hud: true }; grabEmpezar()`);
  await p.waitForFunction(() => window.__ev(`!!(GRAB.on && GRAB.rec && GRAB.rec.state === 'recording')`), null, { timeout: 20000 });
  await p.waitForTimeout(1500); await ev(`sonar('GrenadeExplode', null, 1); 1`); await p.waitForTimeout(3500);
  await ev(`grabParar(); 1`); await p.waitForFunction(() => window.__ev(`!!GRAB.ult`), null, { timeout: 30000 }); await p.waitForTimeout(300);
  const u = JSON.parse(await ev(`JSON.stringify(Object.assign({}, GRAB.ult, { blob: undefined }))`)), info = JSON.parse(await ev(`JSON.stringify({ pedazos: window.__pedazos, llamadaMs: +window.__llamadaMs.toFixed(1), aviso: $('grabAviso').textContent })`));
  const dir = path.join(SD, 'Movies', 'JXMod'), L = fs.existsSync(dir) ? fs.readdirSync(dir) : [], f = L.length ? path.join(dir, L[L.length - 1]) : null;
  const P = f ? probe(f) : null, dur = P ? +P.format.duration : NaN;
  ok('6. la app (simulada): el video llega a Java por pedazos mientras se graba y queda en Movies/JXMod, con la duración', !!f && u.ok && /^Movies\/JXMod\/JXMod_/.test(u.ruta || '') && Math.abs(dur - u.ms / 1000) <= 0.3 && info.pedazos >= 3 && fs.statSync(f).size >= u.bytes,
    { archivo: f && path.relative(D, f), bytes: f && fs.statSync(f).size, duracion: dur, grabado: u.ms / 1000, pedazos: info.pedazos, 'la llamada más larga (XHR de la prueba)': info.llamadaMs + ' ms', aviso: info.aviso });
  // (las opciones en la app: el renglón del grabador del celular)
  await ev(`abrirPausa(); grabPanelAbrir(); 1`); await p.waitForTimeout(500); const sis = await ev(`document.querySelector('#grabPan .grSis').textContent`); await ev(`cerrarPaneles(); 1`);
  ok('6b. en la app, las opciones dicen si el grabador del celular puede grabar el sonido del juego (JXNativo.audioEstado)', /puede|can/.test(sis), sis);
  await ctx.close(); java.kill();
}

// ======== 7: MP4 (H.264 en MP4; sin AAC en este Chromium) ========
if (FASE('7')) {
  const { ctx, p, ev } = await abrir({ width: 873, height: 402 }, 1, 'patata');
  const sop = await ev(`MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') + ':' + MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,opus')`);
  await ev(`window.__grabTipos = [['video/mp4;codecs=avc1,opus', 'mp4', 'MP4 (H.264 + Opus)']]; window.__grabSinDescarga = 1; PREFS.grab = { cal: '720', fps: 30, hud: true }; grabEmpezar()`);
  await p.waitForFunction(() => window.__ev(`!!(GRAB.on && GRAB.rec && GRAB.rec.state === 'recording')`), null, { timeout: 20000 });
  await p.waitForTimeout(3000); await ev(`sonar('GrenadeExplode', null, 1); 1`); await p.waitForTimeout(2000);
  await ev(`grabParar(); 1`); await p.waitForFunction(() => window.__ev(`!!GRAB.ult`), null, { timeout: 30000 });
  const u = JSON.parse(await ev(`JSON.stringify(Object.assign({}, GRAB.ult, { blob: undefined }))`)), f = await bajar(ev, 'video_720p30.mp4');
  const P = probe(f), V = P.streams.find((s) => s.codec_type === 'video'), mehd = sh('python3', ['-I', '-c', `import struct,sys
b=open(sys.argv[1],'rb').read(); i=b.find(b'mehd'); print(struct.unpack('>Q', b[i+8:i+16])[0] if i>0 else -1)`, f]).toString().trim();
  const dec = (() => { try { sh('ffmpeg', ['-v', 'error', '-i', f, '-f', 'null', '-']); return true; } catch (e) { return false; } })();
  ok('7. MP4: H.264 con la duración en la cabecera (mehd) igual a lo grabado y se decodifica entero', V && V.codec_name === 'h264' && Math.abs(+mehd / 1000 - u.ms / 1000) <= 0.05 && Math.abs(+P.format.duration - u.ms / 1000) <= 0.3 && dec,
    { 'H.264+AAC / H.264+Opus en este Chromium': sop, duracion: +P.format.duration, mehd: +mehd / 1000, grabado: u.ms / 1000, decodifica: dec });
  await ctx.close();
}

// ======== 8: el micrófono del chat en segundo plano (Android) ========
if (FASE('8')) {
  const { ctx, p, ev } = await abrir({ width: 873, height: 402 }, 1, 'patata');
  // (como en Android —window.__vozSoltar—; una conexión de voz de mentira para ver que sigue con la pista nueva)
  await ev(`window.__vozSoltar = 1; window.__orden = []; const g0 = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (c) => { window.__orden.push('micrófono:' + (AUD.ctx && AUD.ctx.state)); return g0(c); };
    vozActivar().then(() => { const pc = new RTCPeerConnection(); VOZ.stream.getTracks().forEach((t) => pc.addTrack(t, VOZ.stream)); VOZ.sal.set('prueba', { pc }); }); 1`);
  await p.waitForFunction(() => window.__ev(`!!(VOZ.stream && VOZ.sal.size)`), null, { timeout: 15000 });
  const pista0 = await ev(`VOZ.stream.getAudioTracks()[0].id`);
  await ev(`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1`);
  await p.waitForTimeout(1200);
  const fondo = JSON.parse(await ev(`JSON.stringify({ stream: !!VOZ.stream, on: VOZ.on, ctx: AUD.ctx.state, vivas: 0 })`));
  await ev(`window.__orden.push('vuelve'); delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); 1`);
  await p.waitForFunction(() => window.__ev(`!!VOZ.stream`), null, { timeout: 15000 }); await p.waitForTimeout(300);
  const vuelta = JSON.parse(await ev(`JSON.stringify({ ctx: AUD.ctx.state, orden: window.__orden, pista: VOZ.stream.getAudioTracks()[0].id, viva: VOZ.stream.getAudioTracks()[0].readyState, envia: [...VOZ.sal.values()][0].pc.getSenders()[0].track && [...VOZ.sal.values()][0].pc.getSenders()[0].track.id })`));
  ok('8. Android, chat de voz: en segundo plano el micrófono se suelta (sin modo llamada) y al volver se abre después del sonido del juego, con la voz en la pista nueva',
    !fondo.stream && fondo.on && fondo.ctx === 'suspended' && vuelta.ctx === 'running' && vuelta.orden[vuelta.orden.length - 1] === 'micrófono:running' && vuelta.pista !== pista0 && vuelta.viva === 'live' && vuelta.envia === vuelta.pista, { fondo, vuelta });
  await ctx.close();
}

// ======== v: las voces del chat (de mentira: un tono que llega como una voz remota) ========
if (FASE('v')) {
  const { ctx, p, ev } = await abrir({ width: 873, height: 402 }, 1, 'patata');
  await ev(`(() => { const ac = new AudioContext(), o = ac.createOscillator(), d = ac.createMediaStreamDestination(); o.frequency.value = 330; o.connect(d); o.start(); window.__vozAc = ac;
    const C = {}; VOZ.ent.set('prueba', C); vozRecibir('prueba', C, d.stream); window.__an = AUD.ctx.createAnalyser(); AUD.voz.connect(window.__an); return 1; })()`);
  await p.waitForTimeout(1500);
  const nivel = await ev(`(() => { const b = new Float32Array(2048); __an.getFloatTimeDomainData(b); let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); return +(20 * Math.log10(m + 1e-9)).toFixed(1); })()`);
  const r = {};
  for (const voces of [false, true]) {
    await ev(`GRAB.ult = null; window.__grabSinDescarga = 1; PREFS.grab = { cal: 'pant', fps: 30, voces: ${voces}, hud: true }; grabEmpezar()`);
    await p.waitForFunction(() => window.__ev(`!!(GRAB.on && GRAB.rec && GRAB.rec.state === 'recording')`), null, { timeout: 20000 });
    await p.waitForTimeout(3000); await ev(`grabParar(); 1`); await p.waitForFunction(() => window.__ev(`!!GRAB.ult`), null, { timeout: 30000 });
    const f = await bajar(ev, 'voces_' + voces + '.webm'), a = pcm(f); r[voces ? 'con' : 'sin'] = dB(a, 0.5, 2.5);
  }
  const eco = await ev(`(() => { const C = VOZ.ent.get('prueba'); return C && C.F && C.F.r ? +C.F.r.gain.value.toFixed(2) : null; })()`);
  ok('v. voces del chat: se escuchan (salen por su nodo) y no van al video salvo que se pidan; su eco vuelve al terminar', nivel > -30 && r.sin.rms < -55 && r.con.rms > -40 && eco === 0.35, { 'nivel en la salida de las voces (dBFS)': nivel, 'video sin voces': r.sin, 'video con voces': r.con, 'eco de la voz después': eco });
  await ctx.close();
}

const err = errJS.filter((e) => !/WebSocket|mqtt|net::|Failed to load/i.test(e));
ok('9. sin errores de JS', !err.length, err.slice(0, 5));
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
await b.close();
process.exit(R0.every(Boolean) ? 0 : 1);
