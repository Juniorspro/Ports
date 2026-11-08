// el teléfono parado (el juego girado 90°, como lo juega el dueño) y la cámara libre:
// 1. cámara R (como en Roblox) desde tercera persona, agarrar una caja con la pistola de física y tocar el botón de la
//    cámara: queda en primera persona con la cámara en los ojos (la misma posición respecto del personaje que antes,
//    ±5 cm), la cámara libre apagada (R sin marcar), mirando hacia donde miraba la cámara libre, y la caja sigue
//    agarrada; lo mismo con L. (Antes la cámara seguía girando a 7 m del cuerpo con el arma de primera persona.)
// 2. el celular en la mano con la pantalla girada: sus esquinas en la pantalla del juego iguales a las de un teléfono
//    acostado del mismo tamaño (±2 px), el panel encima del celular 3D en la pantalla del aparato (±2 px) y que se vea
//    (el centro de la pantalla del celular no es negro en la foto).
// 3. ScrW/ScrH y la HUD de los addons (Lua) con las medidas giradas; girar el personaje en Personajes arrastrando
//    (en el aparato el arrastre "hacia la derecha" del juego es hacia abajo); sin errores.
// uso: node girado.mjs URL_HTML [CARPETA_FOTOS]
import { createRequire } from 'module'; import { execFileSync } from 'child_process';
import { abrir } from './base.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const URL0 = process.argv[2], D = (process.argv[3] || '.') + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
// el color medio de un cuadradito de la foto (ffmpeg pasa el PNG a RGB crudo)
const color = (png, x, y, s = 16) => { const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', `crop=${s}:${s}:${Math.round(x - s / 2)}:${Math.round(y - s / 2)}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { input: png });
  let r = 0, g = 0, b = 0; const n = raw.length / 3; for (let i = 0; i < raw.length; i += 3) { r += raw[i]; g += raw[i + 1]; b += raw[i + 2]; } return [r / n, g / n, b / n].map(Math.round); };
async function abrirParado() {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 873 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', (e) => err.push(e.message.slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
  await p.goto(URL0); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await p.waitForTimeout(1500);
  return { b, p, err, ev: (s) => p.evaluate((x) => window.__ev(x), s) };
}
const empezar = async (p, ev) => {
  await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
  await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 30000 });
  await ev(`ENT.tactil = true; document.body.classList.add('tactil'); hudDisponer(); 1`); await p.waitForTimeout(300);
};
const A = await abrirParado(), { p, ev, err } = A;
ok('el teléfono parado gira el juego (medidas del juego acostadas)', await ev(`PANT.rot && VW() === 873 && VH() === 393`), await ev(`({ rot: PANT.rot, vw: VW(), vh: VH() })`));
// ---- 0) girar el personaje en Personajes arrastrando ----
const giro = await ev(`(async () => { PREFS.bienvenida = true; inicioMostrar(true); inicioPanel('personajes'); await new Promise((r) => setTimeout(r, 400));
  if (RB.panel !== 'personajes') return { panel: RB.panel };
  const y0 = MENU.yaw, x = innerWidth / 2 + 120, at = (cy, tipo) => (tipo === 'pointerdown' ? RB.el : window).dispatchEvent(new PointerEvent(tipo, { clientX: x, clientY: cy, bubbles: true, pointerId: 7 }));
  at(80, 'pointerdown'); for (let i = 1; i <= 10; i++) at(80 + i * 10, 'pointermove'); at(180, 'pointerup');
  return { panel: RB.panel, dy: +(MENU.yaw - y0).toFixed(3) }; })()`);
ok('en Personajes, arrastrar "a la derecha" del juego (hacia abajo en el aparato) gira el personaje', giro.panel === 'personajes' && Math.abs(giro.dy + 1.2) < 0.05, giro);
await empezar(p, ev);
// ---- 1) la cámara libre y volver a primera persona ----
for (const modo of ['R', 'L']) {
  const base = await ev(`(async () => { JUG.tercera = false; elegirArma(ARM.lista.indexOf('PhysicsGun')); await new Promise((r) => setTimeout(r, 300)); return [CAM.pos.x - JUG.pos.x, CAM.pos.y - JUG.pos.y, CAM.pos.z - JUG.pos.z]; })()`);
  await ev(`(() => { const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), piso = pisoBajo(v3(JUG.pos.x, JUG.pos.y + 2, JUG.pos.z), 10);
    if (window.__o) borrarObjeto(window.__o); window.__o = crearObjeto('Box4', v3(JUG.pos.x + f.x * 3, piso, JUG.pos.z + f.z * 3), new Quat()); for (let i = 0; i < 30; i++) physStep(1 / 60);
    JUG.tercera = true; return 1; })()`);
  await p.waitForTimeout(300);
  await ev(`pulso('camLibre'); 1`); await p.waitForTimeout(200); await ev(`pulso('camLib${modo}'); 1`); await p.waitForTimeout(400);
  // (agarra la caja mirándola desde la cámara libre, como en el video; con la cámara libre la pistola apunta desde los ojos
  // del personaje y hacia donde mira él, como en GMod (miraOjo/miraDir en armas.js), así que el personaje también la mira)
  const ag = await ev(`(async () => { const b = window.__o.b, d = vsub(b.pos, CAM.pos).norm(); CLIB.yaw = Math.atan2(d.x, d.z); CLIB.pitch = -Math.asin(d.y); await new Promise((r) => setTimeout(r, 250));
    const o = JUG.ojoPos || CAM.pos, e = vsub(b.pos, o).norm(); JUG.yaw = Math.atan2(e.x, e.z); JUG.pitch = -Math.asin(clamp(e.y, -1, 1)); await new Promise((r) => setTimeout(r, 100));
    agarrarFisica(); await new Promise((r) => setTimeout(r, 300)); return { agarre: !!ARM.agarre, lejos: +CAM.pos.distTo(JUG.pos).toFixed(2), modo: CLIB.modo }; })()`);
  if (modo === 'R') await p.screenshot({ path: D + 'girado_camR.png' });
  const yawLib = await ev(`CLIB.yaw`);
  await ev(`pulso('camara'); 1`); await p.waitForTimeout(600);
  const fin = await ev(`(() => { const d = [CAM.pos.x - JUG.pos.x, CAM.pos.y - JUG.pos.y, CAM.pos.z - JUG.pos.z]; const b = ${JSON.stringify(base)};
    return { modo: CLIB.modo, tercera: JUG.tercera, difCm: +(Math.hypot(d[0] - b[0], d[1] - b[1], d[2] - b[2]) * 100).toFixed(1), agarre: !!ARM.agarre, marcado: !!document.querySelector('[data-btn="camLib${modo}"].sel'), yaw: JUG.yaw, vm: !!(ARM.v || ARM.vm || true) }; })()`);
  if (modo === 'R') await p.screenshot({ path: D + 'girado_vuelta.png' });
  const dYaw = Math.abs(Math.atan2(Math.sin(fin.yaw - yawLib), Math.cos(fin.yaw - yawLib)));
  ok(`cámara ${modo}: agarrar con la pistola de física y tocar la cámara vuelve a primera persona con la cámara en los ojos (±5 cm)`, ag.agarre && ag.modo === modo && fin.modo === null && fin.tercera === false && fin.difCm <= 5 && !fin.marcado, { ag, fin: { ...fin, yaw: undefined }, base });
  ok(`cámara ${modo}: mira hacia donde miraba la cámara libre y la caja sigue agarrada`, dYaw < 0.01 && fin.agarre, { dYaw: +dYaw.toFixed(4), agarre: fin.agarre });
  await ev(`soltarAgarre(false); pulso('camLibre'); 1`); await p.waitForTimeout(300);
}
// ---- 2) el celular en la mano ----
const celu = async (pg, e) => { await e(`JUG.tercera = false; if (ARM.lista[ARM.i] !== 'Celular') pulso('celular'); 1`); await pg.waitForTimeout(1200);
  return e(`(() => { const Q = CELM.quad, el = $('celular'), rc = el.getBoundingClientRect(); return { Q, rc: [rc.left, rc.top, rc.right, rc.bottom], iw: innerWidth, ih: innerHeight, clase: el.className }; })()`); };
const cP = await celu(p, ev);
const png = await p.screenshot({ path: D + 'girado_celu.png' });
const L = await abrir(URL0, true); await empezar(L.p, L.ev); const cL = await celu(L.p, L.ev); await L.p.screenshot({ path: D + 'acostado_celu.png' }); await L.b.close();
const difQ = cP.Q && cL.Q ? Math.max(...cP.Q.flatMap((q, i) => [Math.abs(q[0] - cL.Q[i][0]), Math.abs(q[1] - cL.Q[i][1])])) : 999;
ok('el celular queda en la pantalla del juego igual que con el teléfono acostado (esquinas ±2 px)', difQ <= 2, { difQ: +difQ.toFixed(2), parado: cP.Q && cP.Q.map((q) => q.map(Math.round)), acostado: cL.Q && cL.Q.map((q) => q.map(Math.round)) });
// (las esquinas del juego en el aparato: x = ancho - y, y = x)
const V = cP.Q ? cP.Q.map(([x, y]) => [cP.iw - y, x]) : [[0, 0]], bx = [Math.min(...V.map((q) => q[0])), Math.min(...V.map((q) => q[1])), Math.max(...V.map((q) => q[0])), Math.max(...V.map((q) => q[1]))];
const difEl = Math.max(...bx.map((v, i) => Math.abs(v - cP.rc[i])));
ok('el panel del celular está encima del celular 3D en el aparato (±2 px)', difEl <= 2 && /mano/.test(cP.clase) && !/tercera/.test(cP.clase), { difEl: +difEl.toFixed(1), clase: cP.clase });
const cx = (bx[0] + bx[2]) / 2, cy = (bx[1] + bx[3]) / 2, col = color(png, cx * 2, cy * 2, 24);
ok('la pantalla del celular se ve (no es negra)', col[0] + col[1] + col[2] > 120, { col, centro: [Math.round(cx), Math.round(cy)] });
await ev(`pulso('celular'); 1`); await p.waitForTimeout(400);
// ---- 3) los addons: ScrW/ScrH y su HUD con las medidas giradas ----
const hud = await ev(`(() => { gmaIniciar(); const G = GMA.R.G, w = G.get('ScrW')(), h = G.get('ScrH')(); GMA.hudCtx(); const act = GMA.activo; GMA.activo = true; GMA.hudSucio = true; gmaHUDPaso(); GMA.activo = act;
  const c = GMA.hud.c, dpr = Math.min(GFX.nombre === 'patata' || GFX.nombre === 'bajo' ? 1.5 : 2, devicePixelRatio || 1); return { w, h, cw: c.width, ch: c.height, esp: [Math.round(VW() * dpr), Math.round(VH() * dpr)] }; })()`);
ok('ScrW/ScrH de los addons son las del juego girado y su HUD se dibuja a esa medida (en Patata y Bajo, a densidad 1,5)', hud.w === 873 && hud.h === 393 && hud.cw === hud.esp[0] && hud.ch === hud.esp[1], hud);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await A.b.close(); process.exit(0);
