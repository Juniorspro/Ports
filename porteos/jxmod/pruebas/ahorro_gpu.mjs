// Ahorro de GPU (gfxAhorroPaso): cuánto cuesta cada paso en una GPU que dibuja con el procesador (SwiftShader: el costo
// sigue a los píxeles y pasadas, como en una GPU floja de celu) y cómo se ve. Partes:
// 0) lo que se le pide a la GPU en cada paso (dibujos, triángulos, pasadas, megapíxeles cubiertos);
// 1) a mano: Alto con la resolución fija, pasos 0..3 alternados en tandas; de cada uno, los cuadros por segundo y una
//    captura (CARPETA/ahorro_N.png);
// 2) solo: con la resolución dinámica y la meta, ¿sube el ahorro sin tocar nada, avisa y no recompila?
// uso: node ahorro_gpu.mjs URL_HTML [CARPETA] [calidad=alto]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/ahorro', CAL = 'alto'] = process.argv; fs.mkdirSync(D, { recursive: true });
// (cuenta lo que se le pide a la GPU: dibujos, triángulos, pasadas —cada cambio de búfer con dibujos— y los píxeles que
// cubre cada pasada; sólo mientras window.__cnt.on)
const CONTAR = () => {
  const PS = [WebGLRenderingContext.prototype].concat(typeof WebGL2RenderingContext !== 'undefined' ? [WebGL2RenderingContext.prototype] : []);
  const C = window.__cnt = { on: false, dib: 0, tris: 0, pas: 0, px: 0, nuevo: true, vw: 0, vh: 0 };
  const w = (n, f) => { for (const P of PS) { const o = P[n]; if (!o) continue; P[n] = function (...a) { if (C.on) f(...a); return o.apply(this, a); }; } };
  w('bindFramebuffer', (t) => { if (t !== 0x8CA8) C.nuevo = true; }); w('viewport', (x, y, a, b) => { C.vw = a; C.vh = b; });
  const d = (m, n) => { if (C.nuevo) { C.nuevo = false; C.pas++; C.px += C.vw * C.vh; } C.dib++; C.tris += m === 4 ? n / 3 : m === 5 ? Math.max(0, n - 2) : 0; };
  w('drawElements', (m, n) => d(m, n)); w('drawArrays', (m, f, n) => d(m, n)); w('drawElementsInstanced', (m, n, t, o, k) => d(m, n * k)); w('drawArraysInstanced', (m, f, n, k) => d(m, n * k));
};
const { b, p, ev } = await abrir(HTML, false, null, async (pg) => { await pg.addInitScript(CONTAR); });
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; PREFS.resDin = false; const p = PERFILES[PREFS.gfx]; PREFS.res = ${+(process.env.RES || 50)}; PREFS.lejos = p.lejos; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
await ev(`(() => { cerrarPaneles(); JUG.pos.set(${process.env.POS || '3.42,-2.72,24.14'}); JUG.vel.set(0, 0, 0); JUG.yaw = 0.6; JUG.pitch = 0.05; DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); for (let k = 0; k < 4; k++) spawnDelante(['Crate', 'Barrel'][k % 2], {}); return 1; })()`);
await p.waitForTimeout(3000);
const fps = async (s) => ev(`new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ${s * 1000}) __rafO(f); else ok(+(n * 1000 / (performance.now() - t0)).toFixed(2)); }; __rafO(f); })`);
await ev(`window.__rafO = requestAnimationFrame.bind(window); 1`);
// 0) lo que se le pide a la GPU en cada paso, con cuadros corridos a mano (no depende de cuán rápido dibuje la de prueba)
const cuenta = async (n) => ev(`(() => { GFX.ahorro = ${n}; aplicarGfx(true); requestAnimationFrame = () => 0; let T = window.__bT || performance.now();
  for (let i = 0; i < 20; i++) { T += 1000 / 60; cuadro(T); }
  const C = __cnt; Object.assign(C, { dib: 0, tris: 0, pas: 0, px: 0 }); C.on = true; for (let i = 0; i < 20; i++) { T += 1000 / 60; C.nuevo = true; cuadro(T); } C.on = false; window.__bT = T;
  requestAnimationFrame = __rafO; return { dibujos: +(C.dib / 20).toFixed(1), tris: Math.round(C.tris / 20), pasadas: +(C.pas / 20).toFixed(1), mpx: +(C.px / 20 / 1e6).toFixed(2) }; })()`);
await ev(`window.__rafO = requestAnimationFrame.bind(window); 1`);
const gpu = {}; for (const n of [0, 1, 2, 3, 0]) { const r = await cuenta(n); gpu[n] = gpu[n] ? [gpu[n], r] : r; await p.waitForTimeout(500); }
const res = { 0: [], 1: [], 2: [], 3: [] }, cfg = {};
const poner = async (n) => ev(`(() => { GFX.ahorro = ${n}; aplicarGfx(true); return { ahorro: GFX.ahorro, ao: GFX.ao, bloom: GFX.bloom, refl: GFX.refl, smTam: GFX.smTam, sDist: GFX.sDist, aoDef: R.aoDef, progs: R.progs.size, escala: GFX.escala }; })()`);
for (let t = 0; t < 3; t++) for (const n of (t % 2 ? [3, 2, 1, 0] : [0, 1, 2, 3])) {
  cfg[n] = await poner(n); await p.waitForTimeout(1200); res[n].push(await fps(3));
  if (t === 0) { await p.waitForTimeout(200); await p.screenshot({ path: `${D}/ahorro_${n}.png` }); }
}
const prom = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
const parte1 = Object.fromEntries(Object.keys(res).map((n) => [n, { fps: prom(res[n]), corridas: res[n], ms: +(1000 / prom(res[n])).toFixed(1), cfg: cfg[n] }]));
// 2) solo: resolución dinámica prendida y la prueba habilitada; se espera a que suba el ahorro (la GPU de prueba no llega a 60)
await poner(0);
const avisos = [];
await ev(`(() => { const a0 = aviso; aviso = function (t, ...r) { (window.__avisos || (window.__avisos = [])).push(String(t)); return a0.call(this, t, ...r); }; PREFS.resDin = true; window.__ahorroPrueba = true; R.__compilados = 0; const s0 = shader; shader = function (...a) { R.__compilados++; return s0.apply(this, a); }; return 1; })()`);
const hist = [];
for (let i = 0; i < 40; i++) { await p.waitForTimeout(1000); const e = await ev(`({ t: +TIEMPO.t.toFixed(1), fps: +TIEMPO.fps.toFixed(1), ms: +(TIEMPO.msProm || 0).toFixed(1), escala: +GFX.escala.toFixed(2), ahorro: GFX.ahorro || 0 })`); hist.push(e); if (e.ahorro >= 3) break; }
const fin = await ev(`({ avisos: window.__avisos || [], compilados: R.__compilados, errGL: R.gl.getError(), progs: R.progs.size })`);
console.log(JSON.stringify({ html: HTML.split('/').pop(), lienzo: await ev(`R.cv.width + 'x' + R.cv.height`), gpu, parte1, parte2: { pasos: hist.filter((e, i) => i === 0 || e.ahorro !== hist[i - 1].ahorro), ultimo: hist[hist.length - 1], segundos: hist.length, ...fin } }, null, 1));
await b.close();
