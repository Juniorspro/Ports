// puertas portal (linked_portal_door) de THE BACKROOMS: la vista de frente (de lejos y muy de cerca), cruzar caminando (posición,
// giro y velocidad llevados a la compañera, sin volver en el mismo paso), cuadros al cruzar y el costo de la vista
import { abrir } from './base.mjs';
// uso: node gmod_portales.mjs URL_HTML URL_CARPETA_GMA 1874464606 CARPETA_FOTOS [calidad=medio]
const [, , HTML, CARP, ID, D, GFXN = 'medio'] = process.argv;
const { b, p, ev, err } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = '${GFXN}'; PREFS.resDin = false; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(2500);
const m = await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${ID}.gma')).arrayBuffer()); await gmInstalar('${ID}', { nombre: '${ID}', sinDeps: true }, b); return [...GBSP.mapas].filter(([k, x]) => x.id === '${ID}').map(([k]) => k)[0]; })()`);
await ev(`empezarPartida(${JSON.stringify(m)}); 1`);
await p.waitForFunction((k) => window.__ev(`MUNDO.nombre === ${JSON.stringify(k)} && JUEGO.estado === 'juego'`), m, { timeout: 240000 });
await p.waitForTimeout(2000); await ev(`$('hud').classList.add('oc'); 1`);
console.log('puertas', JSON.stringify(await ev(`POR.L.map((d) => [d.n, d.par, !!d.B, d.o.map((x) => +x.toFixed(2)), d.f.map((x) => +x.toFixed(2)), +d.w.toFixed(2), +d.h.toFixed(2)])`)));
// el jugador delante de una puerta, a dist metros, mirándola
const poner = (n, dist) => ev(`(() => { const d = POR.L.find((x) => x.n === '${n}'); const p = v3(d.o[0] + d.f[0] * ${dist}, d.o[1] - d.h + 0.97, d.o[2] + d.f[2] * ${dist});
  JUG.pos.copy(p); JUG.vel.set(0, 0, 0); JUG.yaw = Math.atan2(-d.f[0], -d.f[2]); JUG.pitch = 0; for (const e of POR.L) e.lx = null; return [p.x, p.y, p.z]; })()`);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const [n, dist] of [['door1', 4], ['door1', 1.2], ['door3', 4], ['door5', 4]]) {
  await poner(n, dist); await p.waitForTimeout(700);
  const st = await ev(`({ on: POR.on, A: POR.A && POR.A.n, ms: +POR.ms.toFixed(2), items: POR.items, caja: POR.caja })`);
  console.log(n, dist, JSON.stringify(st));
  await p.screenshot({ path: `${D}/${n}_${dist}.jpg`, type: 'jpeg', quality: 75 });
}
// lo que se ve de verdad delante de la compañera (para comparar): la cámara 5 cm detrás de door2 mirando adelante
await ev(`(() => { const d = POR.L.find((x) => x.n === 'door2'); DBG.cam = { p: v3(d.o[0] - d.f[0] * 0.05, d.o[1] - d.h + 0.97 + JUG.ojoAlto - 0.95, d.o[2] - d.f[2] * 0.05), q: Quat.euler(Math.atan2(d.f[0], d.f[2]), 0) }; return 1; })()`);
await p.waitForTimeout(500); await p.screenshot({ path: `${D}/real_door2.jpg`, type: 'jpeg', quality: 75 }); await ev(`DBG.cam = null; 1`);
// muy cerca de door1 (5 cm): tiene que verse lo mismo que lo de arriba
await poner('door1', 0.05); await p.waitForTimeout(500); await p.screenshot({ path: `${D}/door1_0.05.jpg`, type: 'jpeg', quality: 75 });
// cruzar caminando
await poner('door1', 3); await p.waitForTimeout(600);
const cruce = await ev(`(async () => { const s0 = POR.saltos, d = POR.L.find((x) => x.n === 'door1'), B = d.B, pasos = []; ENT.teclas.add('KeyW');
  let t = 0; const tg0 = TIEMPO.t; while (POR.saltos === s0 && t < 9000) { await new Promise((r) => setTimeout(r, 16)); t += 16; pasos.push(porLocal(d, JUG.pos)[0]); }
  const lB = porLocal(B, JUG.pos), fw = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)), vB = JUG.vel.x * B.f[0] + JUG.vel.y * B.f[1] + JUG.vel.z * B.f[2];
  const tj = TIEMPO.t; while (TIEMPO.t - tj < 0.4) await new Promise((r) => setTimeout(r, 16)); ENT.teclas.delete('KeyW');
  const lB2 = porLocal(B, JUG.pos);
  return { saltos: POR.saltos - s0, ms: t, juego: +(TIEMPO.t - tg0).toFixed(2), lB: lB.map((x) => +x.toFixed(3)), fwB: +(fw.x * B.f[0] + fw.z * B.f[2]).toFixed(3), vB: +vB.toFixed(2), lB2: lB2.map((x) => +x.toFixed(2)), ultimos: pasos.slice(-4).map((x) => +x.toFixed(3)) }; })()`);
ok('al cruzar door1 caminando sale delante de door2, mirando y yendo hacia adelante de door2, y sigue caminando sin volver', cruce.saltos === 1 && cruce.lB[0] > 0 && cruce.lB[0] < 0.3 && cruce.fwB > 0.99 && cruce.vB > 1 && cruce.lB2[0] > 1, cruce);
await p.screenshot({ path: `${D}/despues.jpg`, type: 'jpeg', quality: 75 });
// cuadros justo antes de cruzar: de 30 cm a 1 cm del plano (la caja tapa el corte del plano cercano)
for (const dist of [0.3, 0.15, 0.08, 0.04, 0.01]) { await poner('door1', dist); await p.waitForTimeout(250); await p.screenshot({ path: `${D}/cerca_${dist}.jpg`, type: 'jpeg', quality: 75 }); }
// de atrás: sin vista (como en GMod)
await ev(`(() => { const d = POR.L.find((x) => x.n === 'door1'); JUG.pos.set(d.o[0] - d.f[0] * 2, d.o[1] - d.h + 0.97, d.o[2] - d.f[2] * 2); JUG.vel.set(0, 0, 0); JUG.yaw = Math.atan2(d.f[0], d.f[2]); for (const e of POR.L) e.lx = null; return 1; })()`);
await p.waitForTimeout(500); const atras = await ev(`(async () => { const c0 = R.cuadro, r0 = performance.now(); while (R.cuadro < c0 + 4 && performance.now() - r0 < 20000) await new Promise((r) => setTimeout(r, 30)); return { on: POR.on, A: POR.A && POR.A.n }; })()`);   // (unos cuadros dibujados: con la máquina cargada 500 ms no alcanzaban) ok('de atrás la puerta no muestra la vista (puede verse otra puerta, de frente, más lejos)', !(atras.on && atras.A === 'door1'), atras);
await p.screenshot({ path: `${D}/atras.jpg`, type: 'jpeg', quality: 75 });
// costo: cuadros de 2 s delante de door1 a 4 m con y sin la vista
const medir = async (sin) => ev(`(async () => { ${sin ? "Q.set('sinPortal', '1');" : "Q.delete('sinPortal');"} const t = []; let a = performance.now(); for (let i = 0; i < 120; i++) { await new Promise((r) => requestAnimationFrame(r)); const b = performance.now(); t.push(b - a); a = b; } t.sort((x, y) => x - y); return { med: +t[60].toFixed(1), p95: +t[114].toFixed(1), dib: DIB.ms ? JSON.stringify(DIB.ms).slice(0, 200) : '' }; })()`);
await poner('door1', 4); await p.waitForTimeout(500);
console.log('con', JSON.stringify(await medir(false)), 'sin', JSON.stringify(await medir(true)), 'por', JSON.stringify(await ev(`({ ms: +POR.ms.toFixed(2), items: POR.items })`)));
await ev(`Q.delete('sinPortal'); 1`);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x)); ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
