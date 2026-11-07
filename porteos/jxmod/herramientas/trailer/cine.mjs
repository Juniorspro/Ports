// arnés del tráiler: abre el juego, carga el motor de cinemática (cine_motor.js) y da render(t0) → JPEG
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
export async function abrir(html, { W = 1920, H = 804, mapa = 'Desert', gfx = 'ultra', sombras = '3', part = 2, skin = 'Hero' } = {}) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => err.push(e.message.slice(0, 300)));
  p.on('console', (m) => { if (m.type() === 'error') err.push('console: ' + m.text().slice(0, 200)); });
  await p.goto(html + (html.includes('?') ? '&' : '?') + 'test');
  await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  const ev = (s) => p.evaluate((x) => window.__ev(x), s);
  await ev(`PREFS.skin = '${skin}'; PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.contorno = false; idiomaAplicar('es'); PREFS.gfx = '${gfx}'; PREFS.res = 100; PREFS.sombras = '${sombras}'; PREFS.post = 'si'; GFX.auto = false; aplicarGfx(); inicioMostrar(false); empezarPartida('${mapa}'); if (typeof cuPedirAlAbrir === 'function') cuPedirAlAbrir.hecho = true; if (typeof cuDialogoCerrar === 'function') cuDialogoCerrar(); 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  // el personaje: si su paquete no estaba, el cuerpo arrancó con el de siempre; se espera el paquete y se rehace
  await p.waitForFunction((s) => window.__ev(`(() => { const k = rbDeSkin('${s}'); if (!rbListo(k)) { rbPedir(k); return false; } return true; })()`), skin, { timeout: 180000, polling: 500 });
  const sk = await ev(`(() => { if (!JUG.cuerpo || JUG.cuerpo.skin !== PREFS.skin) jugadorCuerpoNuevo(); return JUG.cuerpo.skin; })()`);
  if (sk !== skin) throw new Error('personaje: ' + sk + ' en vez de ' + skin);
  await ev(`(() => { window.__rafOrig = window.__rafOrig || window.requestAnimationFrame; window.requestAnimationFrame = () => 0; window.__T = performance.now(); GFX.part = ${part}; return 1; })()`);
  const motor = fs.readFileSync(path.join(AQUI, 'cine_motor.js'), 'utf8');
  const r = await ev(motor); if (r !== 'ok' && r !== 'ya') throw new Error('motor: ' + r);
  const render = async (t0, n = 1, obt = 0.5, archivo = null, q = 0.95) => {
    const s = await ev(`CINE.renderCuadro(${t0}, ${n}, ${obt}, ${q})`);
    const buf = Buffer.from(s.split(',')[1], 'base64'); if (archivo) fs.writeFileSync(archivo, buf); return buf;
  };
  return { b, p, ev, err, render };
}
// ffmpeg que recibe JPEGs por la entrada y guarda un video intermedio de buena calidad
export function codificador(salida, { fps = 24, crf = 12 } = {}) {
  const f = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv444p', '-r', String(fps), salida], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fin = new Promise((res) => f.on('close', res));
  return { poner: (buf) => new Promise((res) => { if (!f.stdin.write(buf)) f.stdin.once('drain', res); else res(); }), cerrar: async () => { f.stdin.end(); return fin; } };
}
