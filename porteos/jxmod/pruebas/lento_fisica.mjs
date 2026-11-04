// Con el procesador que no da (TIEMPO.lento 1 y 2: la física a 30 por segundo, los NPCs de lejos cada 2 o 4 cuadros),
// ¿todo sigue igual de bien? Los mismos cuadros corridos a mano (60 por segundo) con cada nivel, desde el mismo arranque:
// - 8 cajas y barriles que caen de 3 m: ninguno atraviesa el piso, todos quedan quietos y a la misma altura que con el
//   nivel 0 (±5 cm);
// - 6 NPCs paseando a 5–45 m: ninguno se cae del mapa ni atraviesa paredes (no aparece del otro lado de un muro entre dos
//   pasos: el rayo entre la posición anterior y la nueva no choca con el mapa) y caminan una distancia parecida.
// uso: node lento_fisica.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const { b, p, ev } = await abrir(HTML, false, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; PREFS.resDin = false; PREFS.res = 50; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(3000);
await ev(`(() => { cerrarPaneles(); JUG.pos.set(3.42, -2.72, 24.14); JUG.vel.set(0, 0, 0); JUG.yaw = 0; JUG.pitch = 0.1; window.__rafO = requestAnimationFrame; requestAnimationFrame = () => 0; return 1; })()`);
await p.waitForTimeout(400);
const corrida = async (nivel) => ev(`(() => {
  for (const o of OBJS.slice()) borrarObjeto(o); for (const P of NPC.lista.slice()) npcQuitar(P);
  TIEMPO.lento = ${nivel}; TIEMPO.acc = 0; let T = window.__bT || performance.now(); const paso = () => { T += 1000 / 60; cuadro(T); TIEMPO.lento = ${nivel}; };
  JUG.pos.set(3.42, -2.72, 24.14); JUG.vel.set(0, 0, 0); for (let i = 0; i < 10; i++) paso();
  // (las cajas en una fila delante, a 3 m de altura sobre el piso)
  const f = CAM.fwd, objs = []; for (let k = 0; k < 8; k++) { const x = JUG.pos.x + f.x * (3 + k * 1.2), z = JUG.pos.z + f.z * (3 + k * 1.2), h = raycast(v3(x, JUG.pos.y + 20, z), v3(0, -1, 0), 60); if (!h) continue; const y = JUG.pos.y + 20 - h.t;
    const o = spawnDelante(['Crate', 'Barrel'][k % 2], {}); if (!o || !o.b) continue; o.b.pos.set(x, y + 3, z); o.b.vel.set(0, 0, 0); o.b.ang && o.b.ang.set(0, 0, 0); o.b.frozen = false; o.b.dormido = false; o.piso = y; objs.push(o); }
  // (los NPCs donde hay piso, a 5–45 m)
  let n = 0; const npcs = []; for (let k = 0; k < 60 && n < 6; k++) { const d = [5, 12, 20, 28, 36, 45][n], a = k * 2.399, x = JUG.pos.x + Math.cos(a) * d, z = JUG.pos.z + Math.sin(a) * d, h = raycast(v3(x, JUG.pos.y + 25, z), v3(0, -1, 0), 60);
    if (!h || !h.ground || h.n.y < 0.7) continue; const y = JUG.pos.y + 25 - h.t; if (Math.abs(y - JUG.pos.y) > 12) continue; const P = npcCrear(['Hero', 'Soldier'][n % 2], v3(x, y + 0.05, z), 0, { modo: 'pasear', vel: 1.4, vida: 100 }); if (P) { P.__ant = P.pos.clone(); P.__dist = 0; P.__muro = 0; npcs.push(P); } n++; }
  for (let i = 0; i < 360; i++) { paso(); for (const P of npcs) { const d = vsub(P.pos, P.__ant), L = d.len(); if (L > 1e-4) { const o = vadd(P.__ant, v3(0, 0.9, 0)), h = mundoRayo(o, vscale(d, 1 / L), L); if (h && h.t < L - 0.05) P.__muro++; P.__dist += L; } P.__ant = P.pos.clone(); } }
  const r = { cajas: objs.map((o) => ({ alto: +(o.b.pos.y - o.piso).toFixed(3), vel: +o.b.vel.len().toFixed(3), cayo: o.b.pos.y < o.piso - 0.5 })), npcs: npcs.map((P) => ({ vivo: PERS.includes(P), dist: +P.__dist.toFixed(2), muro: P.__muro, cayo: P.pos.y < MUNDO.lo.y })) };
  window.__bT = T; return r; })()`);
const res = {};
for (const n of [0, 1, 2]) res[n] = await corrida(n);
const C = res[0].cajas, cmp = {};
for (const n of [1, 2]) {
  const c = res[n].cajas, q = res[n].npcs, q0 = res[0].npcs;
  cmp[n] = { cajasAtraviesan: c.filter((x) => x.cayo).length, cajasMoviendose: c.filter((x) => x.vel > 0.2).length, difAlturaMax: +Math.max(...c.map((x, i) => C[i] ? Math.abs(x.alto - C[i].alto) : 0)).toFixed(3),
    npcsCaidos: q.filter((x) => x.cayo || !x.vivo).length, npcsMuro: q.reduce((a, x) => a + x.muro, 0), distTotal: +q.reduce((a, x) => a + x.dist, 0).toFixed(1), distTotal0: +q0.reduce((a, x) => a + x.dist, 0).toFixed(1) };
}
const base = { cajasAtraviesan: C.filter((x) => x.cayo).length, cajasMoviendose: C.filter((x) => x.vel > 0.2).length, npcsMuro: res[0].npcs.reduce((a, x) => a + x.muro, 0), cajas: C.length, npcs: res[0].npcs.length };
const ok = [1, 2].every((n) => cmp[n].cajasAtraviesan === 0 && cmp[n].cajasMoviendose <= base.cajasMoviendose && cmp[n].difAlturaMax <= 0.05 && cmp[n].npcsCaidos === 0 && cmp[n].npcsMuro <= base.npcsMuro && cmp[n].distTotal > 0.7 * cmp[n].distTotal0);
console.log(JSON.stringify({ ok, base, cmp, detalle: res }, null, 0));
await b.close();
