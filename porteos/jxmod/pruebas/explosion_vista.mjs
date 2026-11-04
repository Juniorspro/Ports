// cómo se ven las explosiones en cada calidad (fotos para comparar antes/después) y cuánto cuestan:
// la común (RPG, granadas, barriles, env_explosion), la nuclear propia (Little Boy) y la de un addon de Lua (Nuke Pack 4).
// Por caso: fotos en varios instantes y ms por cuadro del dibujo de efectos (promedio mientras dura) y cuadros/s.
// uso: node explosion_vista.mjs URL_HTML CARPETA_FOTOS [calidades: medio,patata,alto] [URL_GMA (para el addon)]
import { abrir } from './base.mjs';
import fs from 'fs';
const D = (process.argv[3] || '/tmp/expl') + '/'; fs.mkdirSync(D, { recursive: true });
const CAL = (process.argv[4] || 'medio').split(','), G = process.argv[5];
const { b, p, err, ev } = await abrir(process.argv[2], false);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 60000 });
await ev(`window.esperaJuego = (s) => new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + s || performance.now() - r0 > 30000 ? ok() : setTimeout(f, 20)); f(); });
  window.__ms = { fx: 0, n: 0, cuadros: 0, t0: performance.now() };
  for (const k of ['dibujarEfectos', 'gmrParticulas', 'nukeDibujar']) { const f = window[k] || eval(k); const g = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { __ms.fx += performance.now() - t; } }; eval(k + ' = g'); }
  (function cu() { __ms.cuadros++; requestAnimationFrame(cu); })();
  window.__medir = () => { const m = __ms, dt = performance.now() - m.t0, r = { fxMs: +(m.fx / Math.max(1, m.cuadros)).toFixed(2), fps: +(m.cuadros / dt * 1000).toFixed(1) }; m.fx = 0; m.cuadros = 0; m.t0 = performance.now(); return r; };
  JUG.dios = true; 1`);
if (G) await ev(`(async () => { const A = await gmInstalar('106565409', { nombre: 'Nuke Pack 4' }, new Uint8Array(await (await fetch('${G}/106565409.gma')).arrayBuffer())); await A.listo; return 1; })()`);
const casos = [
  ['comun', `efectoExplosion(punto(9, 0.3))`, [0.06, 0.25, 0.6, 1.4, 3]],
  ['nuclear', `nukeExplotar(punto(260, 0), 'NK_littleboy', false)`, [0.4, 1.5, 4, 9]],
  ...(G ? [['addon', `L('local e = ents.Create("sent_nuke") e:SetPos(Vector(${'${x}'}, ${'${z}'}, ${'${y}'})) e:Spawn() e:Activate() return 1')`, [0.4, 1.5, 3.5]]] : []),
];
const res = {};
for (const cal of CAL) {
  await ev(`PREFS.gfx = '${cal}'; aplicarGfx(); 1`); await p.waitForTimeout(800);
  for (const [n, js, ts] of casos) {
    await ev(`(async () => { JUG.vida = 100; JUG.pitch = -0.06; await esperaJuego(0.6); PART.l.length = 0; GR.parts.length = 0; __medir(); return 1; })()`);
    const base = await ev(`(async () => { await esperaJuego(0.8); return __medir(); })()`);
    // punto(d, h): a d metros adelante, h metros sobre el piso (en unidades de GMod para el Lua: x, y, z)
    await ev(`(() => { window.punto = (d, h) => { const f = v3(CAM.fwd.x, 0, CAM.fwd.z).norm(), q = vadd(JUG.pos, vscale(f, d)); const y = pisoBajo(v3(q.x, q.y + 50, q.z), 200); q.y = (y ?? q.y) + h; return q; };
      const q = punto(220, 0); window.x = +(q.x / GS).toFixed(1); window.y = +(q.y / GS).toFixed(1); window.z = +(-q.z / GS).toFixed(1);
      window.L = (c) => gmaCorrer('expl.lua', c.replace(/\\$\\{(\\w)\\}/g, (m, k) => window[k])); window.__t0 = TIEMPO.t; ${js}; return 1; })()`);
    const fotos = [];
    for (const t of ts) { await ev(`esperaJuego(${t} - (TIEMPO.t - __t0))`); await p.screenshot({ path: D + cal + '_' + n + '_' + t + '.png' }); fotos.push(t); }
    const m = await ev(`__medir()`), cuantas = await ev(`PART.l.length + GR.parts.length`);
    res[cal + ' ' + n] = { base, durante: m, part: cuantas };
    console.log(cal, n, JSON.stringify(res[cal + ' ' + n]));
  }
}
const errs = await ev(`GMA.errores.slice(0, 5)`);
console.log('errores:', JSON.stringify(errs), err.filter((e) => !/GPU stall|swiftshader/i.test(e)).slice(0, 4));
fs.writeFileSync(D + 'medidas.json', JSON.stringify(res, null, 1));
await b.close();
