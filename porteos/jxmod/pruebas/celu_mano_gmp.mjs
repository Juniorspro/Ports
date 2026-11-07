// el celular en la mano de los personajes de mods (Discord, «Adaptar avatares»: con un modelo de jugador del Workshop
// el celular no estaba en su mano: quedaba donde iría la mano del personaje de base, que el modelo no usa). En tercera
// persona, con el celular en la mano, para 6 modelos de jugador de GMod de distintos tamaños y el Hero de referencia:
//  1. el celular está en la mano del modelo: su centro a ≤ 1,3 veces el largo de la palma de la muñeca del modelo, como en
//     los personajes del juego (sin dedos en el esqueleto: la palma del Hero a su escala); antes, lejos: se mide también
//     dónde quedaba;
//  2. ningún dedo del modelo lo atraviesa (≤ 3 mm, a la escala del celular);
//  3. delante del pecho: entre 15 y 40 cm (a la escala del personaje) debajo de la cabeza del modelo;
//  4. del tamaño del personaje: la escala del celular es la del arma en esa mano (la misma que las armas, 0,45–1,6);
//  5. sin errores de JS.
// uso: node celu_mano_gmp.mjs URL_HTML URL_CARPETA_GMA [ids] [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, G, IDS = '485879458,348376962,391383735,193152958,656834283,158326196', D = '/tmp/claude-0/celugmp'] = process.argv;
fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 1400) : '')); };
const { b, p, ev, err } = await abrir(HTML + '?test', false);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500);
// lo que se dibuja (P.celuDib) contra la mano y los dedos del modelo (o del Hero)
const medir = `(() => { const P = JUG.cuerpo, Gm = P.gmp, C = P.celuDib, C0 = P.celu3p; if (!C || !C0 || P.cDib !== PERS_N) return { listo: false };
  let pos, X = null; if (Gm && !Gm.propio && Gm.def) { X = Gm.def.porMix; pos = (n) => { const i = X[n]; return i === undefined ? null : Gm.Pw[i].clone(); }; } else if (Gm) return { listo: false, propio: true };
  else { const hx = huesosMixamo(P.D); P.md.actualizar(); pos = (n) => { const i = n === 'RightHand' ? P.D.h.RightHand : n === 'Head' ? P.D.h.Head : hx[n]; return i === undefined ? null : celmPos(P.md, i); }; }
  const h = pos('RightHand'), m1 = pos('RightHandMiddle1'), cab = pos('Head'); if (!h) return { listo: false, sinMano: true };
  // (los modelos sin dedos en el esqueleto, como el tiburón: la palma del Hero a su escala)
  const k = Gm && Gm.armaD ? Gm.armaD.s : 1, hx0 = huesosMixamo(P.D), palmaH = celmPos(P.md, P.D.h.RightHand).distTo(celmPos(P.md, hx0.RightHandMiddle1)), palma = m1 ? h.distTo(m1) : palmaH * k;
  let pen = 0; for (const Dd of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) for (const j of [1, 2, 3, 4]) { const q = pos('RightHand' + Dd + j); if (!q) continue; const d = vsub(q, C.c), x = vdot(d, C.r) / C.t, y = vdot(d, C.u) / C.t, z = vdot(d, C.n) / C.t; if (Math.abs(x) < CELM_W / 2 && Math.abs(y) < CELM_H / 2) pen = Math.max(pen, Math.min(z + 0.008 + CELM_D / 2, CELM_D / 2 + 0.008 - z)); }
  return { listo: true, gmp: !!Gm, s: +k.toFixed(3), t: +C.t.toFixed(3), palmaCm: +(palma * 100).toFixed(1), manoCelu: +(h.distTo(C.c) / palma).toFixed(2), antesCm: +(h.distTo(C0.c) * 100).toFixed(1), penMm: +(pen * 1000).toFixed(1), bajoCab: cab ? +((cab.y - C.c.y) / C.t).toFixed(2) : null }; })()`;
const foto = async (nom) => {
  // (de frente, cerca: la cámara libre girando alrededor del personaje)
  await ev(`(() => { clibElegir('R'); CLIB.yaw = JUG.yaw + Math.PI; CLIB.pitch = 0.15; CLIB.dist = 1.6; return 1; })()`); await p.waitForTimeout(500);
  await p.screenshot({ path: `${D}/${nom}.png` });
  await ev(`(() => { clibElegir(null); JUG.tercera = true; return 1; })()`);
};
await ev(`(() => { JUG.tercera = true; JUG.yaw = 0; JUG.pitch = 0; elegirArma(ARM.lista.indexOf('Celular')); return 1; })()`);
let ref = null; for (let i = 0; i < 20 && !(ref && ref.listo); i++) { await p.waitForTimeout(400); ref = await ev(medir); }
console.log('Hero:', JSON.stringify(ref)); await foto('hero');
const filas = [];
for (const id of IDS.split(',')) {
  const pm = await ev(`(async () => { const antes = new Set(gmpLista()); const A = await gmInstalar('${id}', { nombre: '${id}' }, new Uint8Array(await (await fetch('${G}/${id}.gma')).arrayBuffer())); await A.listo;
    const L = gmpLista().filter((r) => !antes.has(r) && !/npc|hands|arms|_c\\.mdl/i.test(r)); return L[0] || null; })()`).catch(() => null);
  if (!pm) { filas.push({ id, sinModelo: true }); continue; }
  await ev(`(() => { PREFS.skin = 'gmpm:${pm}'; jugadorCuerpoNuevo(); JUG.tercera = true; JUG.yaw = 0; JUG.pitch = 0; elegirArma(ARM.lista.indexOf('Celular')); return 1; })()`);
  let m = null; for (let i = 0; i < 30 && !(m && m.listo); i++) { await p.waitForTimeout(400); m = await ev(medir); }
  filas.push({ id, pm: pm.replace(/^.*\//, ''), ...m });
  if (m && m.listo) await foto('pm_' + id);
}
console.log(JSON.stringify(filas, null, 0));
const L = filas.filter((f) => f.listo);
ok('0. el Hero (referencia): el celular en su mano (≤ 1,3 palmas), sin dedos dentro (≤ 3 mm)', ref && ref.listo && ref.manoCelu <= 1.3 && ref.penMm <= 3, ref);
ok(`1. en la mano del modelo: centro a ≤ 1,3 palmas de su muñeca, en los ${L.length} de ${filas.length} modelos con mano (antes quedaba a ${L.map((f) => f.antesCm).join(', ')} cm)`, L.length >= 5 && L.every((f) => f.manoCelu <= 1.3), L.map((f) => ({ id: f.id, manoCelu: f.manoCelu, palmaCm: f.palmaCm, antesCm: f.antesCm })));
ok('2. ningún dedo del modelo lo atraviesa (≤ 3 mm)', L.length >= 5 && L.every((f) => f.penMm <= 3), L.map((f) => ({ id: f.id, penMm: f.penMm })));
ok('3. delante del pecho: 15–40 cm (a escala) debajo de la cabeza del modelo', L.length >= 5 && L.every((f) => f.bajoCab === null || (f.bajoCab >= 0.15 && f.bajoCab <= 0.4)), L.map((f) => ({ id: f.id, bajoCab: f.bajoCab })));
ok('4. del tamaño del personaje: la escala del celular es la del arma en esa mano (0,45–1,6)', L.length >= 5 && L.every((f) => Math.abs(f.t - f.s) < 0.01 && f.s >= 0.45 && f.s <= 1.6), L.map((f) => ({ id: f.id, s: f.s, t: f.t })));
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|CORS|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('5. sin errores de JS', !e.length, e.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
