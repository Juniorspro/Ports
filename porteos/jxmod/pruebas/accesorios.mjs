// los accesorios importados para la cabeza (accesorios.js): importarlo por Personajes → Gorros, que quede puesto y se dibuje
// en la cabeza, que las barras lo muevan y que el paquete se rearme del otro lado de la red. Uso: node pruebas/accesorios.mjs URL
import { abrir } from './base.mjs';
import fs from 'fs';
const { b, p, ev } = await abrir(process.argv[2], false);
const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
// (el casco de prueba: pruebas/casco.glb, una media esfera a rayas con visera, en centímetros)
const CASCO = new URL('./casco.glb', import.meta.url).pathname;
// 1) importar por la ventana: Personajes → Gorros, el input del archivo
await ev(`PREFS.bienvenida = true; GFX.auto = false; 1`);
await ev(`(() => { RBM.pjTab = 'hat'; inicioPanel('personajes'); return 1; })()`).catch((e) => console.log('panel', e.message));
await p.waitForTimeout(1500);
const inp = await p.$('.accImp input');
console.log('hay boton importar:', !!inp);
if (inp) { await inp.setInputFiles(CASCO); await p.waitForTimeout(2500); }
console.log(await ev(`JSON.stringify({ acc: PREFS.acc, lista: ACCS.lista.map((x) => [x.n, x.tris]), estado: (document.querySelector('.accEstado') || {}).textContent, barras: document.querySelectorAll('[data-accv]').length })`));
await p.screenshot({ path: 'a_panel.png' });
// 2) en el juego, en tercera persona
await ev(`(() => { inicioMostrar(false); empezarPartida('FlatGrass'); return 1; })()`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 });
await ev(`(() => { cerrarPaneles(); JUG.tercera = true; document.querySelectorAll('#hud > *').forEach((e) => e.style.visibility = 'hidden'); return 1; })()`);
await p.waitForTimeout(2500);
console.log(await ev(`JSON.stringify({ malla: (() => { const G = ACCS.mallas.get(PREFS.acc && PREFS.acc.id); return G && G.partes ? G.partes.length : null; })() })`));
// de frente, cerca de la cabeza
await ev(`(() => { const P = JUG.cuerpo, hi = P.D.h.Head; P.md.actualizar(); const W = P.md.W[hi], c = v3(W[12], W[13], W[14]), f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); const pp = vadd(vadd(c, vscale(f, 1.3)), v3(0.3, 0.15, 0)), dd = vsub(c, pp).norm(); DBG.cam = { p: pp, q: Quat.euler(Math.atan2(dd.x, dd.z), -Math.asin(clamp(dd.y, -1, 1)), 0) }; return 1; })()`);
await p.waitForTimeout(1500); await p.screenshot({ path: 'a_frente.png', clip: { x: 340, y: 110, width: 600, height: 500 } });
await ev(`(() => { PREFS.acc.ry = 45; PREFS.acc.y = 14; PREFS.acc.s = 1.2; return 1; })()`); await p.waitForTimeout(800);
await p.screenshot({ path: 'a_ajuste.png', clip: { x: 340, y: 110, width: 600, height: 500 } });
// 3) el paquete por la red: lo que se manda y lo que se arma del otro lado (accRed con los pedazos)
console.log(await ev(`(async () => { const id = PREFS.acc.id, b = await accPaquete(id); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  const d = btoa(s), L = []; for (let i = 0; i < d.length; i += 24000) L.push(d.slice(i, i + 24000)); ACCS.packs.delete(id); ACCS.mallas.delete(id); const lista = ACCS.lista; ACCS.lista = [];
  L.forEach((x, k) => accRed({ k: 'acd', g: id, x: k, n: L.length, d: x })); const ok = ACCS.packs.has(id); ACCS.lista = lista; return JSON.stringify({ bytes: b.length, pedazos: L.length, rearmado: ok, limpio: JSON.stringify(accLimpio({ id, s: 99, y: -999 })) }); })()`));
console.log('errores', err);
await b.close();
