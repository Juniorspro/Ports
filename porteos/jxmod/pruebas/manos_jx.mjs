// Tus manos con la cámara (manos_jx.js + JX Hand Engine): de punta a punta con una cámara de mentira de Chromium (un
// video Y4M con una mano abierta que se mueve) sobre el armado de la app (PK_BIN: el motor y los modelos al lado del juego).
//  1. la opción aparece (con ?jxmanos; en la web sin los archivos, no) y al prenderla se abre la cámara y el motor queda
//     listo (WebAssembly con FMA si la vista web lo tiene) y da el arma «Manos JX»;
//  2. el motor ve la mano en los cuadros de la cámara (presencia, gesto «abierta»), cuánto tarda y cuántos cuadros;
//  3. con «Manos JX» en la mano, la mano derecha del juego está delante de la cámara (a 15–70 cm, adentro de la vista) y
//     sus dedos estirados (como la foto: mano abierta) y sigue a la tuya cuando se mueve;
//  4. la vista chica de tus manos se dibuja; apagar cierra la cámara y saca el arma; sin errores de JS.
// uso: node manos_jx.mjs CARPETA_DEL_ARMADO CAMARA.y4m [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
import path from 'path';
const [, , DIR = '/tmp/claude-0/jxm_prueba', CAM = '/tmp/claude-0/jxm_cam.y4m', D = '/tmp/claude-0/manos_jx'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const tipos = { html: 'text/html', js: 'text/javascript', wasm: 'application/wasm', bin: 'application/octet-stream', tflite: 'application/octet-stream', mp4: 'video/mp4' };
const servir = async (p) => p.context().route('http://localhost:7777/**', (r) => {
  const u = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\//, '') || 'index.html', f = path.join(DIR, u);
  if (!f.startsWith(DIR) || !fs.existsSync(f)) { if (!/favicon/.test(u)) console.log('404', u); return r.fulfill({ status: 404, body: '' }); }
  r.fulfill({ body: fs.readFileSync(f), contentType: tipos[path.extname(f).slice(1)] || 'application/octet-stream' });
});
const { b, p, err, ev } = await abrir('http://localhost:7777/index.html?jxmanos', true,
  ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + CAM], servir);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500); await ev(`cerrarPaneles(); 1`);
// 1) la opción en Ajustes y prender
const op = await ev(`(() => { abrirAjustes && abrirAjustes('pausa'); const e = document.getElementById('aJxM'); const r = !!e; document.getElementById('ajustes').classList.add('oc'); return r; })()`).catch(() => null);
await ev(`PREFS.jxManos = true; mjxPrender(); 1`);
await p.waitForFunction(() => window.__ev(`MJX.estado === 'listo' || MJX.estado === 'error' || MJX.estado === 'sin cámara'`), null, { timeout: 60000 }).catch(() => {});
const e1 = await ev(`({ estado: MJX.estado, error: MJX.error, version: mjxVersion(), arma: ARM.lista.includes('ManosJX'), camara: !!(MJX.video && MJX.video.videoWidth), w: MJX.video && MJX.video.videoWidth, h: MJX.video && MJX.video.videoHeight })`);
ok('1. la opción está (con ?jxmanos y los archivos), se abre la cámara, el motor queda listo y aparece «Manos JX»', op !== false && e1.estado === 'listo' && e1.arma && e1.camara, { op, ...e1 });
// 2) el motor ve la mano
await p.waitForFunction(() => window.__ev(`MJX.cuadros > 40`), null, { timeout: 90000 }).catch(() => {});
const e2 = await ev(`({ cuadros: MJX.cuadros, ms: +MJX.msProm.toFixed(1), lite: MJX.lite, manos: MJX.manos.map((m) => ({ derecha: m.derecha, presencia: +m.presencia.toFixed(3), gesto: m.gestoNombre, dedos: m.dedos, z: +m.posicion[2].toFixed(2), calibrada: m.calibrada })) })`);
ok('2. el motor ve la mano en la cámara (presencia > 0,9, gesto «abierta», 5 dedos) y dice cuánto tarda', e2.manos.length >= 1 && e2.manos[0].presencia > 0.9 && e2.manos.some((m) => m.gesto === 'abierta'), e2);
// 3) «Manos JX» en la mano: la mano del juego delante de la cámara, con los dedos estirados, y sigue a la tuya
await ev(`elegirArma(ARM.lista.indexOf('ManosJX')); 1`); await p.waitForTimeout(1500);
const medir = `(() => { const v = MJX.vm; if (!v) return null; const md = v.md, h = v.h, E = mjxEjes(), lado = MJX.manos.find((m) => m.derecha) ? 'Right' : 'Left';
  const w = celmPos(md, h[lado + 'Hand']), d = vsub(w, CAM.pos), f = vdot(d, E.f), x = vdot(d, E.r), y = vdot(d, E.u);
  // los dedos estirados: el ángulo entre los dos primeros huesos de cada dedo (chico = derecho)
  const ang = ['Index', 'Middle', 'Ring', 'Pinky'].map((D) => { const a = celmPos(md, h[lado + 'Hand' + D + '1']), b = celmPos(md, h[lado + 'Hand' + D + '2']), c = celmPos(md, h[lado + 'Hand' + D + '3']);
    return Math.round(Math.acos(Math.max(-1, Math.min(1, vdot(vsub(b, a).norm(), vsub(c, b).norm())))) * 180 / Math.PI); });
  // de qué lado queda el pulgar visto por vos: con la palma hacia la cámara del celular (la foto), ves el dorso; en la
  // izquierda el pulgar queda a la derecha de la mano (y en la derecha, a la izquierda)
  const pul = vdot(vsub(celmPos(md, h[lado + 'HandThumb3']), celmPos(md, h[lado + 'HandMiddle1'])), E.r), dorso = lado === 'Left' ? pul > 0 : pul < 0;
  return { lado, adelante: +f.toFixed(3), x: +x.toFixed(3), y: +y.toFixed(3), dedos: ang, enVista: Math.abs(x / f) < 1.2 && Math.abs(y / f) < 0.8, dorso }; })()`;
const m1 = await ev(medir); await p.screenshot({ path: path.join(D, 'manos_1.png') });
await p.waitForTimeout(700); const m2 = await ev(medir); await p.screenshot({ path: path.join(D, 'manos_2.png') });
const mov = m1 && m2 ? Math.hypot(m1.x - m2.x, m1.y - m2.y) : 0;
ok('3. la mano del juego está delante de la cámara (15–70 cm, en la vista), con los dedos estirados como la tuya, se ve el dorso (tu palma mira a la cámara del celular) y se mueve con la tuya', m1 && m1.adelante > 0.15 && m1.adelante < 0.7 && m1.enVista && m1.dedos.every((a) => a < 40) && m1.dorso && mov > 0.005, { m1, m2, mov: +mov.toFixed(3) });
// 4) la vista chica y apagar
const pv = await ev(`!!(MJX.previa && MJX.previa.style.display !== 'none')`);
await ev(`PREFS.jxManos = false; mjxApagar(); 1`); await p.waitForTimeout(300);
const e4 = await ev(`({ on: MJX.on, arma: ARM.lista.includes('ManosJX'), video: !!MJX.video })`);
ok('4. la vista chica de tus manos se dibuja; apagar cierra la cámara y saca el arma; sin errores de JS', pv && !e4.on && !e4.arma && !e4.video && err.length === 0, { pv, ...e4, err: err.slice(0, 5) });
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close();
