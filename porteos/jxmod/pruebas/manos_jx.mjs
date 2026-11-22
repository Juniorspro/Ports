// Tus manos con la cámara (manos_jx.js + JX Hand Engine nativo): el juego armado para la app (PK_BIN) con un puente
// JXManos de mentira que entrega lo que entregaría ManosJX.java. Los cuadros son de verdad: los grabó el motor en Rust
// (por JNI, en la PC) y ManosTexto.java con una mano abierta que se mueve frente a la cámara
// (/tmp/claude-0/jxm_rec/Grabar.java → cuadros.json).
//  1. sin el puente (la web, o un celular de 32 bits) la opción no aparece; con el puente aparece, y al prenderla el
//     juego pide la cámara, da el arma «Manos JX» y lee las manos (presencia, gesto «abierta», 5 dedos);
//  2. con «Manos JX» en la mano, la mano derecha del juego está delante de la cámara (a 15–70 cm, adentro de la vista),
//     con los dedos estirados como la foto, se ve el dorso (tu palma mira a la cámara del celular) y sigue a la tuya;
//  3. la vista chica (lo que ve la cámara, tus manos, el estado y los cuadros por segundo) se dibuja; el modelo completo
//     se pide si se elige en Ajustes;
//  4. apagar avisa a la app y saca el arma; sin errores de JS.
// uso: node manos_jx.mjs CARPETA_DEL_ARMADO CUADROS.json [CARPETA_CAPTURAS]
import { abrir } from './base.mjs';
import fs from 'fs';
import path from 'path';
const [, , DIR = '/tmp/claude-0/jx_web/www', CUADROS = '/tmp/claude-0/jxm_rec/cuadros.json', D = '/tmp/claude-0/manos_jx'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const faltan = new Set();   // (lo que el servidor de prueba no tiene: los mapas y emotes que la app baja aparte)
const tipos = { html: 'text/html', js: 'text/javascript', bin: 'application/octet-stream', mp4: 'video/mp4' };
const servir = async (p) => p.context().route('http://localhost:7777/**', (r) => {
  const u = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\//, '') || 'index.html', f = path.join(DIR, u);
  if (!f.startsWith(DIR) || !fs.existsSync(f)) { faltan.add(u); return r.fulfill({ status: 404, body: '' }); }
  r.fulfill({ body: fs.readFileSync(f), contentType: tipos[path.extname(f).slice(1)] || 'application/octet-stream' });
});
const cuadros = JSON.parse(fs.readFileSync(CUADROS, 'utf8'));
// (la imagen chiquita de la cámara: la del primer cuadro grabado, 96 de ancho, como la da ManosJX.miniatura())
const MINI = fs.existsSync(CUADROS.replace(/cuadros\.json$/, 'mini.txt')) ? fs.readFileSync(CUADROS.replace(/cuadros\.json$/, 'mini.txt'), 'utf8') : '';
const { b, p, err, ev } = await abrir('http://localhost:7777/index.html', true, [], servir);
await ev(`idiomaAplicar('es'); PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego'`), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500); await ev(`cerrarPaneles(); 1`);
const opcion = () => ev(`(() => { abrirAjustes && abrirAjustes('pausa'); const r = { m: !!document.getElementById('aJxM'), c: !!document.getElementById('aJxC') }; document.getElementById('ajustes').classList.add('oc'); return r; })()`).catch(() => null);
// 1) sin puente, nada; con el puente (el de mentira, con los cuadros grabados del motor de verdad)
const sin = await opcion();
await ev(`(() => { const C = ${JSON.stringify(cuadros)}; let t0 = 0, on = false; window.__mjxLlamadas = [];
  window.JXManos = { disponible: () => true, prender: (l) => { window.__mjxLlamadas.push('prender:' + l); on = true; t0 = performance.now(); return 'ok'; },
    apagar: () => { window.__mjxLlamadas.push('apagar'); on = false; },
    leer: (v) => { if (!on) return ''; const t = C[Math.floor((performance.now() - t0) / 33.3) % C.length]; return +t.slice(0, t.indexOf(',')) === v ? '' : t; },
    estado: () => (on ? 'listo' : 'apagado'), config: () => {}, miniatura: () => (on ? ${JSON.stringify(MINI)} : ''), diagnostico: () => (on ? '30,0,640x480,52' : '') }; return 1; })()`);
const con = await opcion();
await ev(`PREFS.jxManos = true; mjxPrender(); 1`);
await p.waitForFunction(() => window.__ev(`MJX.cuadros > 20`), null, { timeout: 30000 }).catch(() => {});
const e1 = await ev(`({ estado: MJX.estado, arma: ARM.lista.includes('ManosJX'), enMano: ARM.lista[ARM.i], cuadros: MJX.cuadros, ms: +MJX.msProm.toFixed(1), lite: MJX.lite, llamadas: window.__mjxLlamadas,
  manos: MJX.manos.map((m) => ({ derecha: m.derecha, presencia: +m.presencia.toFixed(3), gesto: m.gestoNombre, dedos: m.dedos, z: +m.posicion[2].toFixed(2) })) })`);
ok('1. sin el puente no hay opción; con él aparece, prende (modelo liviano), da «Manos JX» ya en la mano y lee las manos del motor (presencia > 0,9, «abierta», 5 dedos)',
  sin && !sin.m && con && con.m && con.c && e1.estado === 'listo' && e1.arma && e1.enMano === 'ManosJX' && e1.llamadas[0] === 'prender:true' && e1.manos.length >= 1 && e1.manos[0].presencia > 0.9 && e1.manos.some((m) => m.gesto === 'abierta' && m.dedos === 5), { sin, con, ...e1 });
// 2) «Manos JX» en la mano
await ev(`elegirArma(ARM.lista.indexOf('ManosJX')); 1`); await p.waitForTimeout(1500);
const medir = `(() => { const v = MJX.vm; if (!v) return null; const md = v.md, h = v.h, E = mjxEjes(), lado = MJX.manos.find((m) => m.derecha) ? 'Right' : 'Left';
  const w = celmPos(md, h[lado + 'Hand']), d = vsub(w, CAM.pos), f = vdot(d, E.f), x = vdot(d, E.r), y = vdot(d, E.u);
  const ang = ['Index', 'Middle', 'Ring', 'Pinky'].map((D) => { const a = celmPos(md, h[lado + 'Hand' + D + '1']), b = celmPos(md, h[lado + 'Hand' + D + '2']), c = celmPos(md, h[lado + 'Hand' + D + '3']);
    return Math.round(Math.acos(Math.max(-1, Math.min(1, vdot(vsub(b, a).norm(), vsub(c, b).norm())))) * 180 / Math.PI); });
  const pul = vdot(vsub(celmPos(md, h[lado + 'HandThumb3']), celmPos(md, h[lado + 'HandMiddle1'])), E.r), dorso = lado === 'Left' ? pul > 0 : pul < 0;
  return { lado, adelante: +f.toFixed(3), x: +x.toFixed(3), y: +y.toFixed(3), dedos: ang, enVista: Math.abs(x / f) < 1.2 && Math.abs(y / f) < 0.8, dorso }; })()`;
const m1 = await ev(medir); await p.screenshot({ path: path.join(D, 'manos_1.png') });
await p.waitForTimeout(900); const m2 = await ev(medir); await p.screenshot({ path: path.join(D, 'manos_2.png') });
const mov = m1 && m2 ? Math.hypot(m1.x - m2.x, m1.y - m2.y) : 0;
ok('2. la mano del juego está delante de la cámara (15–70 cm, en la vista), con los dedos estirados, se ve el dorso y sigue a la tuya',
  m1 && m1.adelante > 0.15 && m1.adelante < 0.7 && m1.enVista && m1.dedos.every((a) => a < 40) && m1.dorso && mov > 0.005, { m1, m2, mov: +mov.toFixed(3) });
// 3) la vista chica y el modelo completo desde Ajustes
// (la vista chica con la imagen de la cámara: un píxel del medio no es transparente y no es el gris del fondo vacío)
const pv = await ev(`(() => { const c = MJX.previa; if (!c || c.style.display === 'none') return null; const d = c.getContext('2d').getImageData(c.width / 2 - 30, c.height / 2, 1, 1).data; return { imagen: !!MJX.mini, px: [...d], diag: MJX.diag }; })()`);
await ev(`(() => { abrirAjustes('pausa'); document.getElementById('aJxC').checked = true; document.getElementById('aOk').click(); document.getElementById('ajustes').classList.add('oc'); return 1; })()`);
await p.waitForTimeout(400);
const e3 = await ev(`({ llamadas: window.__mjxLlamadas, completo: PREFS.jxCompleto, on: MJX.on })`);
ok('3. la vista chica se dibuja con lo que ve la cámara y los cuadros por segundo; elegir el modelo completo vuelve a prender con el modelo completo', pv && pv.imagen && pv.px[3] > 0 && pv.diag && e3.completo && e3.on && e3.llamadas.includes('prender:false'), { pv, ...e3 });
// 4) apagar
await ev(`PREFS.jxManos = false; mjxApagar(); 1`); await p.waitForTimeout(300);
const e4 = await ev(`({ on: MJX.on, arma: ARM.lista.includes('ManosJX'), llamadas: window.__mjxLlamadas })`);
// (no cuentan: los 404 de archivos que en la app vienen aparte —mapas, emotes— y que este servidor no tiene, y el
// multijugador, que desde esta máquina no llega a su servidor)
const errJs = err.filter((e) => !/Failed to load resource|WebSocket connection to 'wss:\/\/broker/.test(e));
ok('4. apagar avisa a la app y saca el arma; sin errores de JS', !e4.on && !e4.arma && e4.llamadas[e4.llamadas.length - 1] === 'apagar' && errJs.length === 0, { ...e4, errJs: errJs.slice(0, 5), noServidos: [...faltan].slice(0, 8) });
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close();
