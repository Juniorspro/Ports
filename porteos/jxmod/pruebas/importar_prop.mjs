// Importar prop (propimportar.js; Bugs y sugerencias f5piayqr: «que se puedan meter modelos .glb, .obj y más también como
// props»). Como un jugador: Props → Tus props importados → Importar prop → elegir los archivos → nombre y tamaño → Guardar.
// Con un GLB (Duck, Lantern de Khronos), un OBJ con su .mtl y su textura en centímetros (una mesa armada acá) y un .zip como
// el que baja Sketchfab (BoxTextured: .gltf + .bin + la textura en una carpeta):
//  1. la sección está en Props con el botón de importar;
//  2. cada uno se lee y la ventana propone su tamaño (el del archivo si es razonable; la mesa en cm → 1 m) y guarda;
//  3. sale en la sección con su retrato y, tocándolo, se pone delante: cae y queda apoyado en el piso (sin atravesarlo), con
//     el tamaño elegido y su textura;
//  4. al recargar la página siguen guardados y se ponen igual (el modelo se rearma del paquete);
//  5. la cruz lo borra (de la lista y del aparato);
//  6. sin errores de JS. Fotos: la ventana, el menú y los props puestos.
// uso: node importar_prop.mjs URL_HTML URL_MODELOS [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, MOD, D = '/tmp/claude-0/importar_prop'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const CASOS = [['pato', ['Duck.glb'], null], ['farol', ['Lantern.glb'], null], ['mesa', ['mesa.obj', 'mesa.mtl', 'madera.png'], 1], ['caja', ['caja_sketchfab.zip'], null]];
async function partida(prev) {
  let s = prev;
  if (!s) s = await abrir(HTML + '?test');
  else { s.err.length = 0; await s.p.reload(); await s.p.waitForFunction(() => window.__listo, null, { timeout: 180000 }); await s.p.waitForTimeout(1500); }
  await s.ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; PREFS.lang = 'es'; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
  await s.p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 }); await s.p.waitForTimeout(1200);
  await s.ev(`(async () => { await priCargarLista(); spawnTabs(); UI.tab = DATA.menu.findIndex((c) => c.n === 'Props'); UI.sub = spawnSubs(DATA.menu[UI.tab]).findIndex((x) => x.pri); abrirSpawn(); return 1; })()`);
  return s;
}
let s = await partida();
const st1 = await s.ev(`(() => { const subs = spawnSubs(DATA.menu[UI.tab]), S = subs.find((x) => x.pri); return { hay: !!S, nom: S && spawnCatNom(S), primero: S && S.it[0], boton: !!document.querySelector('#grilla .itPri') }; })()`);
ok('1. Props tiene «Tus props importados» con el botón de importar', st1.hay && st1.primero === 'pri+' && st1.boton, st1);
const metas = {};
for (const [n, archs, tam] of CASOS) {
  const r = await s.ev(`(async () => { const fs = []; for (const a of ${JSON.stringify(archs)}) { const u = new Uint8Array(await (await fetch(${JSON.stringify(MOD)} + '/' + a)).arrayBuffer()); fs.push(new File([u], a)); }
    priAbrir(fs); for (let k = 0; k < 200 && !document.querySelector('#priVen [data-pri=si]') && !document.querySelector('#priVen .priEst.mal'); k++) await new Promise((r) => setTimeout(r, 100));
    const V = document.getElementById('priVen'), err = V.querySelector('.priEst.mal'); if (err) return { error: err.textContent };
    const propuesto = PRI.ui.L.tam, o = V.querySelector('output').textContent;
    V.querySelector('input[type=text]').value = ${JSON.stringify(n)};
    ${tam ? `{ const rg = V.querySelector('input[type=range]'); rg.value = priBarraDe(${tam}); rg.oninput(); }` : ''}
    return { propuesto, o, img: !!V.querySelector('.priVista img') }; })()`);
  if (n === 'mesa') await s.p.screenshot({ path: D + '/1_ventana.png' });
  const g = await s.ev(`(async () => { const n0 = PRI.lista.length; document.querySelector('#priVen [data-pri=si]').click(); for (let k = 0; k < 300 && PRI.lista.length === n0 && !document.querySelector('#priVen .priEst.mal'); k++) await new Promise((r) => setTimeout(r, 100));
    const m = PRI.lista[PRI.lista.length - 1], e = document.querySelector('#priVen:not(.oc) .priEst.mal'); return e ? { error: e.textContent } : { id: m.id, n: m.n, tam: m.tam, tris: m.tris, img: (m.img || '').slice(0, 15) }; })()`);
  metas[n] = g;
  ok(`2. ${n}: se lee, propone su tamaño y se guarda`, !r.error && !g.error && g.n === n && /^data:image/.test(g.img) && (n !== 'mesa' || (Math.abs(r.propuesto - 1) < 1e-6 && Math.abs(g.tam - 1) < 0.02)), { ventana: r, guardado: g });
}
await s.ev(`(() => { spawnDibujar(); return 1; })()`); await s.p.waitForTimeout(500);
await s.p.screenshot({ path: D + '/2_menu.png' });
// 3: ponerlos, uno al lado del otro, tocando su retrato
async function poner(s, tag) {
  const out = {};
  let i = 0;
  for (const [n] of CASOS) {
    const id = metas[n] && metas[n].id; if (!id) continue;
    await s.ev(`(() => { JUG.yaw = ${(-0.5 + i * 0.33).toFixed(2)}; JUG.pitch = 0.25; spawnDibujar(); return 1; })()`);
    const o0 = await s.ev(`OBJS.length`);
    await s.ev(`(() => { const d = [...document.querySelectorAll('#grilla .it')].find((x) => x.querySelector('span') && x.querySelector('span').textContent === ${JSON.stringify(n)}); d.click(); return 1; })()`);
    for (let k = 0; k < 60 && (await s.ev(`OBJS.length`)) === o0; k++) await s.p.waitForTimeout(150);
    i++;
  }
  // (la física, 4 s a 60 por segundo)
  await s.ev(`(() => { for (let k = 0; k < 240; k++) physStep(1 / 60); return 1; })()`);
  for (const [n] of CASOS) {
    const id = metas[n] && metas[n].id; if (!id) continue;
    out[n] = await s.ev(`(() => { const o = OBJS.filter((x) => x.nombre === 'pri:${id}' || x.key === 'pri:${id}' || (x.md && x.md.arb && x.md.arb[0].n === 'pri:${id}')).pop(); if (!o) return null; const b = o.b, pts = puntosForma(b.shape); let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const v of pts) { const w = vadd(b.pos, b.q.rot(v.clone ? v.clone() : v3(v.x, v.y, v.z))); y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y); x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); z0 = Math.min(z0, w.z); z1 = Math.max(z1, w.z); }
      const piso = pisoBajo(b.pos, 5), lx = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9]; for (const v of pts) { lx[0] = Math.min(lx[0], v.x); lx[1] = Math.max(lx[1], v.x); lx[2] = Math.min(lx[2], v.y); lx[3] = Math.max(lx[3], v.y); lx[4] = Math.min(lx[4], v.z); lx[5] = Math.max(lx[5], v.z); }
      return { base: +(y0 - piso).toFixed(3), lado: +Math.max(lx[1] - lx[0], lx[3] - lx[2], lx[5] - lx[4]).toFixed(2), vel: +b.vel.len().toFixed(3), masa: +b.mass.toFixed(1) }; })()`);
  }
  await s.ev(`(() => { cerrarPaneles(); JUG.yaw = 0; JUG.pitch = 0.35; return 1; })()`); await s.p.waitForTimeout(1500);
  await s.p.screenshot({ path: D + '/3_puestos' + tag + '.png' });
  return out;
}
const p1 = await poner(s, '');
const bien = (o, n) => o && o.base > -0.03 && o.base < 0.12 && o.vel < 0.3 && Math.abs(o.lado - metas[n].tam) < metas[n].tam * 0.08 + 0.02;
ok('3. se ponen, caen y quedan apoyados con su tamaño', Object.keys(metas).every((n) => bien(p1[n], n)), p1);
const errJs1 = s.err.filter((x) => !/WebSocket connection to|Failed to load resource/.test(x));
// 4: recargar la página (lo guardado en el aparato: IndexedDB)
s = await partida(s);
const lista = await s.ev(`PRI.lista.map((m) => m.n)`);
const p2 = await poner(s, '_recargado');
ok('4. al recargar siguen guardados y se ponen igual', Object.keys(metas).every((n) => lista.includes(n) && bien(p2[n], n)), { lista, p2 });
// 5: la cruz
await s.ev(`(() => { abrirSpawn(); UI.tab = DATA.menu.findIndex((c) => c.n === 'Props'); UI.sub = spawnSubs(DATA.menu[UI.tab]).findIndex((x) => x.pri); spawnDibujar(); return 1; })()`);
const b5 = await s.ev(`(async () => { const d = [...document.querySelectorAll('#grilla .it')].find((x) => x.querySelector('span') && x.querySelector('span').textContent === 'pato'); d.querySelector('.itX').click(); await new Promise((r) => setTimeout(r, 400));
  const db = await priDB(), enDB = await pjiTx(db, 'pr', 'readonly', (st) => st.getAll()); return { lista: PRI.lista.map((m) => m.n), db: enDB.map((m) => m.n), tiles: [...document.querySelectorAll('#grilla .it span')].map((x) => x.textContent) }; })()`);
ok('5. la cruz lo borra de la lista y del aparato', !b5.lista.includes('pato') && !b5.db.includes('pato') && !b5.tiles.includes('pato') && b5.lista.length === 3, b5);
const errJs = errJs1.concat(s.err.filter((x) => !/WebSocket connection to|Failed to load resource/.test(x)));
ok('6. sin errores de JS', !errJs.length, errJs.slice(0, 4));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await s.b.close();
process.exit(R.every(Boolean) ? 0 : 1);
