// el arma en la mano de los modelos de jugador del Workshop, de cualquier tamaño (idea de Discord: «el arma se ve flotando
// en los personajes chicos del Workshop»). Con la pistola en la mano, en tercera persona, para varios modelos:
//  1. el arma está en la mano del modelo como en la del Hero: la distancia de la muñeca a la caja del arma no pasa la del
//     Hero en más de 1 cm (antes, de 15 a 26 cm)
//  2. el arma cambia de tamaño con el personaje: su escala es la del arma del Hero por (alto del modelo / alto del Hero),
//     entre 0,45 y 1,6 (±3 %); los Minions y Tiny Rick, chiquitos, la tienen chica
//  3. sin errores
// uso: node arma_mano_gmp.mjs URL_HTML URL_CARPETA_GMA [ids] [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, G, IDS = '158326196,104491619,485879458,348376962,391383735,193152958,139247091,216408135,518592494,1126163495', D = '/tmp/claude-0/armano'] = process.argv;
fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500);
// (los vértices de una malla del juego: posiciones cuantizadas en 16 bits con su mínimo y su escala)
await ev(`(() => { window.__vert = (mi) => { const d = DATA.ms[mi]; if (!d || !d.v) return null; const u8 = RBP.bins[d.k]; if (!u8) return null; const dv = new DataView(u8.buffer, u8.byteOffset + (d.o || 0)), P = new Float32Array(d.v * 3);
  for (let k = 0; k < d.v; k++) for (let c = 0; c < 3; c++) P[k * 3 + c] = d.mn[c] + dv.getUint16(k * 14 + c * 2, true) / 65535 * d.sc[c]; return P; }; return 1; })()`);
// (la referencia: el Hero con la misma pistola, la muñeca —RightHand— a la caja del arma)
const medir = `(() => { const P = JUG.cuerpo, Gm = P.gmp, md = P.armasGm && P.armasGm[P.arma]; if (!md || P.cDib !== PERS_N) return { listo: false };
  let h; if (Gm && !Gm.propio && Gm.def) { const iH = Gm.def.porMix.RightHand; if (iH === undefined) return { listo: false, sinMano: true }; h = Gm.Pw[iH]; } else if (Gm) return { listo: false }; else { P.md.actualizar(); const W0 = P.md.W[P.D.h.RightHand]; h = v3(W0[12], W0[13], W0[14]); }
  const W = md.raiz, d = DATA.ms[DATA.gm.armas[P.arma].m]; if (!d || !d.mn) return { listo: false, sinMalla: true };
  const sx = Math.hypot(W[0], W[1], W[2]), ex = [0, 4, 8].map((c) => v3(W[c], W[c + 1], W[c + 2])), o = v3(W[12], W[13], W[14]), r = vsub(h, o);
  const loc = ex.map((e) => vdot(r, e) / (sx * sx)), fuera = loc.map((u, c) => Math.max(0, d.mn[c] - u, u - (d.mn[c] + d.sc[c])));
  return { listo: true, k: Gm ? +Gm.k.toFixed(2) : 1, s: Gm && Gm.armaD ? +Gm.armaD.s.toFixed(3) : 1, cmMano: +(Math.hypot(...fuera) * sx * 100).toFixed(1), escala: +sx.toFixed(3) }; })()`;
await ev(`(() => { JUG.tercera = true; elegirArma(ARM.lista.indexOf('Pistol')); return 1; })()`);
let ref = null; for (let i = 0; i < 20 && !(ref && ref.listo); i++) { await p.waitForTimeout(500); ref = await ev(medir); }
console.log('Hero:', JSON.stringify(ref));
const filas = [];
for (const id of IDS.split(',')) {
  const pm = await ev(`(async () => { const antes = new Set(gmpLista()); const A = await gmInstalar('${id}', { nombre: '${id}' }, new Uint8Array(await (await fetch('${G}/${id}.gma')).arrayBuffer())); await A.listo;
    const L = gmpLista().filter((r) => !antes.has(r) && !/npc|hands|arms|_c\\.mdl/i.test(r)); return L[0] || null; })()`).catch(() => null);
  if (!pm) { filas.push({ id, sinModelo: true }); continue; }
  await ev(`(() => { PREFS.skin = 'gmpm:${pm}'; jugadorCuerpoNuevo(); JUG.tercera = true; JUG.yaw = 0; JUG.pitch = 0; elegirArma(ARM.lista.indexOf('Pistol')); return 1; })()`);
  let m = null;
  for (let i = 0; i < 24 && !(m && m.listo); i++) {
    await p.waitForTimeout(500);
    m = await ev(medir); if (m && m.listo && m.s === 1 && m.k !== 1) m.listo = false;   // (todavía sin el arma en su mano)
  }
  // (una foto de costado)
  await ev(`(() => { if (CLIB.modo !== 'L') clibElegir('L'); document.body.classList.add('ocultarHUD'); const t = vadd(JUG.pos, v3(0, -0.2, 0)); CLIB.pos.set(t.x + 2.2, t.y + 0.3, t.z + 0.6); const d = vsub(t, CLIB.pos); CLIB.yaw = Math.atan2(d.x, d.z); CLIB.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); return 1; })()`);
  await p.waitForTimeout(900); await p.locator('#cv').screenshot({ path: `${D}/${id}.png` });
  await ev(`(() => { if (CLIB.modo) clibElegir(CLIB.modo); return 1; })()`);
  filas.push({ id, pm: pm.split('/').pop(), ...m });
}
console.log(JSON.stringify(filas, null, 0));
const con = filas.filter((f) => f.listo);
ok('1. el arma en la mano como en el Hero (la muñeca a la caja del arma ≤ la del Hero + 1 cm)', ref && ref.listo && con.length >= 7 && con.every((f) => f.cmMano <= ref.cmMano + 1), { hero: ref && ref.cmMano, modelos: con.map((f) => [f.pm, f.k, f.cmMano]) });
ok('2. el arma del tamaño del personaje (escala = la del Hero × alto del modelo / alto del Hero, ±3 %)', ref && con.length >= 7 && con.every((f) => Math.abs(f.escala / (ref.escala * Math.min(1.6, Math.max(0.45, f.k))) - 1) < 0.03), { hero: ref && ref.escala, modelos: con.map((f) => [f.pm, f.k, f.escala]) });
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('3. sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
