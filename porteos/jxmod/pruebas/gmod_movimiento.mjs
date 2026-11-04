// caminar, correr, agacharse y saltar con las animaciones de GMod (male_anims.mdl horneadas: estado GmLoco), con varios
// personajes (el Hero, Jake —bajito— y Bon): para cada estado, que los pies apoyen (la suela más baja a ±4 cm del
// piso, sin hundirse), que agachado la cadera baje (≥ 25 %) y las rodillas se doblen (< 115°), que corriendo los pies se
// alternen (uno adelante y el otro atrás, > 25 cm) y que cada clip venga de GMod (no el de Unity ni el agachado armado a
// mano). Fotos de costado de cada estado.
// uso: node gmod_movimiento.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, D = '.'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.cuerpo`), null, { timeout: 60000 }); await p.waitForTimeout(1500);
const hay = await ev(`(() => { const G = humGm(); return G ? { run: G.run.map((c) => c.n + ' ' + Math.round(c.ang * 180 / Math.PI)), cwalk: G.cwalk.length, jump: !!G.jump } : null; })()`);
ok('están los clips de GMod (quieto, correr 8 direcciones, agachado, caminar agachado 8 direcciones, salto)', !!hay && hay.run.length === 8 && hay.cwalk === 8 && hay.jump, hay);
const ESTADOS = [['quieto', 0, 0, false, true], ['corre_adelante', 4.5, 0, false, true], ['corre_costado', 4.5, Math.PI / 2, false, true], ['corre_atras', 4.5, Math.PI, false, true],
  ['agachado', 0, 0, true, true], ['agachado_camina', 1.6, 0, true, true], ['agachado_costado', 1.6, -Math.PI / 2, true, true], ['salto', 0, 0, false, false]];
const medir = (skin) => ev(`(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  JUG.tercera = false; const base = JUG.pos.clone(), P = crearPersona('${skin}', 'HatEmpty', { nombre: '' }); P.npcQuieto = true;
  const fw = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); P.pos.copy(vadd(base, vscale(fw, 3.2))); P.pos.y = base.y; P.yaw = JUG.yaw + Math.PI / 2;
  const h = P.D.h, out = {};
  const ang3 = (a, b, c) => { const u = vsub(a, b).norm(), w = vsub(c, b).norm(); return Math.acos(Math.max(-1, Math.min(1, vdot(u, w)))) * 180 / Math.PI; };
  const W = (i) => v3(P.md.W[i][12], P.md.W[i][13], P.md.W[i][14]);
  for (const [nom, vel, dir, ag, suelo] of ${JSON.stringify(ESTADOS)}) {
    const t0 = performance.now(); let piesMin = 1e9, piesMax = -1e9, cadera = [], rod = 180, sep = 0, clip = '';
    while (performance.now() - t0 < 1800) {
      const yv = P.yaw + dir; P.vel.set(Math.sin(yv) * vel, suelo ? 0 : 1.5, Math.cos(yv) * vel); P.suelo = suelo; P.agachado = ag; P.pos.y = base.y + (suelo ? 0 : 0.4);
      await espera(30);
      if (performance.now() - t0 < 500) continue;   // (que termine la transición)
      const piso = P.pos.y - 1, yl = W(h.LeftFoot).y - P.D.tobillo, yr = W(h.RightFoot).y - P.D.tobillo, bajo = Math.min(yl, yr) - piso;
      piesMin = Math.min(piesMin, bajo); piesMax = Math.max(piesMax, bajo); cadera.push(W(h.Hips).y - piso);
      rod = Math.min(rod, ang3(W(h.LeftUpLeg), W(h.LeftLeg), W(h.LeftFoot)), ang3(W(h.RightUpLeg), W(h.RightLeg), W(h.RightFoot)));
      const df = vsub(W(h.LeftFoot), W(h.RightFoot)); sep = Math.max(sep, Math.abs(vdot(df, v3(Math.sin(yv), 0, Math.cos(yv)))));
      clip = P.hum.clave;
    }
    out[nom] = { piesMin: +piesMin.toFixed(3), piesMax: +piesMax.toFixed(3), cadera: +(cadera.reduce((a, b) => a + b, 0) / cadera.length).toFixed(3), rodilla: Math.round(rod), sep: +sep.toFixed(2), clave: clip };
  }
  borrarPersona(P); return out; })()`);
// las fotos: de costado, en tercera persona sobre un Hero puesto adelante
async function fotos() {
  await ev(`(() => { const P = crearPersona('Hero', 'HatEmpty', { nombre: '' }); window.__F = P; const fw = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); P.pos.copy(vadd(JUG.pos, vscale(fw, 2.6))); P.yaw = JUG.yaw + Math.PI / 2; return 1; })()`);
  for (const [nom, vel, dir, ag, suelo] of ESTADOS) {
    await ev(`(async () => { const P = window.__F, base = JUG.pos.y, t0 = performance.now(); while (performance.now() - t0 < 900) { const yv = P.yaw + ${dir}; P.vel.set(Math.sin(yv) * ${vel}, ${suelo ? 0 : 1.5}, Math.cos(yv) * ${vel}); P.suelo = ${suelo}; P.agachado = ${ag}; P.pos.y = base + ${suelo ? 0 : 0.4}; await new Promise((r) => setTimeout(r, 30)); } return 1; })()`);
    await p.screenshot({ path: `${D}/mov_${nom}.jpg`, type: 'jpeg', quality: 70, clip: { x: 340, y: 120, width: 600, height: 520 } });
  }
  await ev(`borrarPersona(window.__F); 1`);
}
await fotos();
for (const skin of ['Hero', 'Jake', 'Bon']) {
  const m = await medir(skin);
  const malos = Object.entries(m).filter(([n, x]) => n !== 'salto' && (x.piesMin < -0.04 || x.piesMin > 0.04));
  ok(`${skin}: los pies apoyan en todos los estados (suela más baja a ±4 cm)`, !malos.length, Object.fromEntries(Object.entries(m).map(([n, x]) => [n, [x.piesMin, x.piesMax]])));
  ok(`${skin}: agachado baja la cadera (≥ 25 %) y dobla las rodillas (< 115°)`, m.agachado.cadera < m.quieto.cadera * 0.75 && m.agachado.rodilla < 115 && m.agachado_camina.rodilla < 115, { quieto: m.quieto.cadera, agachado: m.agachado.cadera, rod: [m.agachado.rodilla, m.agachado_camina.rodilla] });
  const L0 = m.quieto.cadera;   // (el paso, en largos de pierna: Jake es bajito)
  ok(`${skin}: corriendo los pies se alternan (paso > 0,5 largos de pierna)`, m.corre_adelante.sep > 0.5 * L0 && m.corre_costado.sep > 0.35 * L0 && m.agachado_camina.sep > 0.35 * L0, { adel: m.corre_adelante.sep, cost: m.corre_costado.sep, agach: m.agachado_camina.sep });
  ok(`${skin}: los clips son los de GMod`, Object.values(m).every((x) => /^\\|\\|[ga]/.test(x.clave) || /\\|g|\\|a/.test(x.clave)), Object.fromEntries(Object.entries(m).map(([n, x]) => [n, x.clave])));
}
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x)); ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
