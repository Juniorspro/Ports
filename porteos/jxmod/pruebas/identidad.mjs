// Identidad propia de las skins heredadas (pedido: «no hay que darle identidad de Hypper Sandbox a las skins»): las 12
// humanas del paquete original con nombre nuevo y la ropa teñida con los colores de JXMod (identidad.js).
//  1. los 12 nombres nuevos; las de terror (Derik, Corpse) y las propias (Goku, Freddy) siguen igual
//  2. en cada textura de ropa: ≥ 85 % de los puntos de ropa cambian y el tono medio queda a ≤ 25° del de su rampa (en las
//     rampas con color); lo protegido (la cara con el pelo de Nico, los brazos y zapatillas de Rulo) no cambia ni un punto;
//     y la piel suelta de las que tienen cara y ropa juntas (Nico, Sombra, Carnicero) cambia < 3 %
//  3. las texturas de otras skins (Goku, Freddy, Derik) no se tocan
//  4. teñir cuesta ≤ 15 ms por textura (promedio, en este procesador sin placa)
//  5. retratos: los 12 listos a los 3 s de arrancar; la cara (centro, del 30 % al 55 % de alto) igual punto por punto; los
//     costados de abajo (la ropa) cambian (distancia media de color ≥ 40)
//  6. en partida: al ponerse a Nico, su textura sale teñida (la que está en la placa es la teñida)
//  7. con ?sinids todo queda como venía (para comparar)
//  8. mapas: los 8 heredados con nombre nuevo en los 14 idiomas (y los propios, RB_*, igual que antes)
//  9. la plaza JX en los 7 de superficie, a 30–65 m de la aparición, en piso parejo y a la vista desde la aparición
//     (el centro del «JX» cae adentro de la pantalla mirando hacia la plaza); en Espacio, en un mapa de la comunidad y en
//     el creador no aparece; no se guarda con lo del jugador (el creador sólo guarda lo suyo)
// 10. se sube caminando por la rampa (el jugador queda arriba, a la altura de la plataforma) y el monolito
//     frena (caminando contra él no se lo atraviesa: queda a ≥ 0,8 m de su centro en la dirección de avance)
// 11. cuesta poco: 3 mallas (3 llamadas de dibujo), ≤ 2000 triángulos, y el cuadro sube ≤ 1,5 ms mirándola
// 12. sin errores de JS
// uso: node identidad.mjs URL_HTML
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(d).slice(0, 1500)); };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const errs = [];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const abrir = async (extra = '') => {
  const c = await b.newContext({ viewport: { width: 800, height: 450 } });
  await c.route('**/api/cuenta/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"google":false}' }));
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  const t0 = Date.now(); await p.goto(HTML + '?test&gfx=medio' + extra); await p.waitForFunction(() => window.__listo, null, { timeout: 180000 });
  return { c, p, t0, ev: (s) => p.evaluate((x) => window.__ev(x), s) };
};
const SK = ['Hero', 'Soldier', 'Jean', 'Business', 'SpecialForcesW', 'SpecialForcesM', 'Prisoner01', 'PilotFemale', 'Butcher', 'Swat', 'Military', 'Engineer'];
const A = await abrir();
// ---- 1 ----
const nombres = await A.ev(`(${JSON.stringify(SK)}).concat(['Derik', 'Corpse', 'Goku', 'Freddy']).map(skinNom)`);
const esperados = ['Nico', 'Brasa', 'Tomi', 'Don Ferro', 'Vega', 'Rocco', 'Rulo', 'Alas', 'Carnicero', 'Sombra', 'Duna', 'Chispa', 'Derik', 'Corpse', 'Goku', 'Freddy'];
ok('1. los 12 nombres nuevos; las de terror y las propias siguen igual', JSON.stringify(nombres) === JSON.stringify(esperados), nombres);
// ---- 2..4: cada textura de ropa, original contra teñida ----
const tex = await A.ev(`(async () => {
  const T = idsTabla(), out = {}, hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const tono = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return null; let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); return ((h * 60) + 360) % 360; };
  const n0 = IDS.n, ms0 = IDS.ms;
  for (const i in T) {
    const e = T[i], pt = PK.parte('t' + i); if (!pt) { out[i] = { falta: true }; continue; }
    const bm = await createImageBitmap(new Blob([pt], { type: 'image/webp' }), { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const w = bm.width, h = bm.height, c0 = document.createElement('canvas'); c0.width = w; c0.height = h; const x0 = c0.getContext('2d'); x0.drawImage(bm, 0, 0);
    const A = x0.getImageData(0, 0, w, h).data, cv = idTex(+i, bm, bm), B = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const salta = idsSaltaTex(e, w, h); let ropa = 0, cambia = 0, zona = 0, zonaCambia = 0, piel = 0, pielCambia = 0, sx = 0, sy = 0;
    const Z = (e.zonas || []).map(([a, b2, c2, d]) => [a * w, (1 - d) * h, c2 * w, (1 - b2) * h]);
    for (let k = 0; k < w * h; k++) {
      const o = k * 4, dif = Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2]); if (A[o + 3] < 8) continue;
      const xx = k % w, yy = (k / w) | 0, enZona = Z.some((z) => xx >= z[0] && xx < z[2] && yy >= z[1] && yy < z[3]);
      if (enZona) { zona++; if (dif > 0) zonaCambia++; continue; }
      if (e.piel && idsPiel(A[o], A[o + 1], A[o + 2])) { piel++; if (dif > 6) pielCambia++; continue; }
      ropa++; if (dif > 6) cambia++;
      const t = tono(B[o], B[o + 1], B[o + 2]); if (t != null) { const s = (Math.max(B[o], B[o + 1], B[o + 2]) - Math.min(B[o], B[o + 1], B[o + 2])) / 255; sx += Math.cos(t * Math.PI / 180) * s; sy += Math.sin(t * Math.PI / 180) * s; }
    }
    const M = hex(IDS_RAMPA[e.r][1]), tM = tono(M[0], M[1], M[2]), satM = (Math.max(...M) - Math.min(...M)) / 255, tMed = ((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360;
    const dT = tM == null ? 0 : Math.min(Math.abs(tMed - tM), 360 - Math.abs(tMed - tM));
    out[i] = { n: DATA.tx[i] && DATA.tx[i].n, r: e.r, ropa, cambia: +(cambia / Math.max(1, ropa)).toFixed(3), zona, zonaCambia, piel, pielCambia: +(pielCambia / Math.max(1, piel)).toFixed(3), dTono: satM > 0.25 ? +dT.toFixed(1) : null };
  }
  // las de otras skins
  const otras = [];
  for (const s of ['Goku', 'Freddy', 'Derik']) { const D = datosSkin(s); for (const nd of D.sub) for (const mi of (nd.mt || [])) { const d = DATA.mt[mi]; if (d && d.t != null && d.t >= 0) otras.push([s, d.t, !!T[d.t]]); } }
  return { out, otras, ms: (IDS.ms - ms0) / Math.max(1, IDS.n - n0), n: IDS.n - n0 };
})()`);
const filas = Object.values(tex.out);
ok('2. cada textura de ropa: ≥ 85 % cambia, tono a ≤ 25° de su rampa; lo protegido no cambia; la piel suelta cambia < 3 %',
  filas.length >= 15 && filas.every((f) => !f.falta && f.cambia >= 0.85 && f.zonaCambia === 0 && (f.dTono == null || f.dTono <= 25) && (f.piel === 0 || f.pielCambia < 0.03)), tex.out);
ok('3. las texturas de otras skins (Goku, Freddy, Derik) no se tocan', tex.otras.length > 0 && tex.otras.every((o) => !o[2]), { revisadas: tex.otras.length, tocadas: tex.otras.filter((o) => o[2]) });
ok('4. teñir cuesta ≤ 15 ms por textura', tex.ms <= 15, { msPorTextura: +tex.ms.toFixed(2), texturas: tex.n });
// ---- 5: retratos ----
await A.p.waitForFunction(() => window.__ev('Object.keys(IDS.ret).length') >= 12, null, { timeout: 15000 }).catch(() => {});
const ret = await A.ev(`(async () => {
  const carga = (u) => new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = u; });
  const out = {};
  for (const s of ${JSON.stringify(SK)}) {
    if (!IDS.ret[s]) { out[s] = { listo: false }; continue; }
    const a = await carga(_retratoOrig(s)), b = await carga(IDS.ret[s]), w = a.naturalWidth, h = a.naturalHeight, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.drawImage(a, 0, 0); const A = x.getImageData(0, 0, w, h).data; x.clearRect(0, 0, w, h); x.drawImage(b, 0, 0, w, h); const B = x.getImageData(0, 0, w, h).data;
    let cara = 0, caraCambia = 0, lados = 0, dist = 0;
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const o = (y * w + xx) * 4; if (A[o + 3] < 200) continue; const d = Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2]);
      if (y >= h * 0.3 && y < h * 0.55 && xx > w * 0.35 && xx < w * 0.65) { cara++; if (d > 8) caraCambia++; }
      if (y >= h * 0.9 && (xx < w * 0.25 || xx > w * 0.75)) { lados++; dist += Math.hypot(A[o] - B[o], A[o + 1] - B[o + 1], A[o + 2] - B[o + 2]); }
    }
    out[s] = { listo: true, cara, caraCambia, lados, dist: +(dist / Math.max(1, lados)).toFixed(1) };
  }
  return out;
})()`);
const listos = Object.values(ret).filter((r) => r.listo).length;
ok('5. retratos: los 12 listos; la cara igual; la ropa de los costados cambia (distancia ≥ 40)', listos === 12 && Object.values(ret).every((r) => r.listo && r.caraCambia <= r.cara * 0.005 && (r.lados === 0 || r.dist >= 40)), ret);
// ---- 6: en partida ----
const p6 = await A.ev(`(async () => {
  PREFS.skin = 'Hero'; empezarPartida('FlatGrass'); const t = Object.keys(idsTabla()).find((i) => idsTabla()[i] && DATA.tx[i]); const n0 = IDS.n;
  if (R.tex[t]) { R.gl.deleteTexture(R.tex[t].gl); R.tex[t] = undefined; }
  texGL(+t); await new Promise((ok) => setTimeout(ok, 1500)); texGL(+t);
  return { t: +t, subida: !!(R.tex[t] && R.tex[t].gl && R.tex[t].gl !== R.texGris), tenidas: IDS.n - n0 };
})()`);
ok('6. en partida la textura que se sube a la placa es la teñida', p6.subida && p6.tenidas >= 1, p6);
await A.c.close();
// ---- 7 ----
const B = await abrir('&sinids');
const s7 = await B.ev(`(() => { const T = idsTabla(), i = Object.keys(T)[0]; return { nombres: ${JSON.stringify(SK)}.map(skinNom).join(','), idTex: idTex(+i, document.createElement('canvas'), null), ret: retrato('Hero') === _retratoOrig('Hero') }; })()`);
ok('7. con ?sinids todo como venía', s7.nombres === SK.join(',') && s7.idTex === null && s7.ret, s7);
await B.c.close();
// ---- 8..11: mapas ----
const C = await abrir();
const LANGS = ['es', 'en', 'pt', 'id', 'ms', 'fil', 'ja', 'th', 'tr', 'ar', 'ru', 'uk', 'fr', 'de'];
const viejos = { es: ['Desierto', 'Desierto II', 'Pasto plano', 'Ciudad', 'Base', 'Base II', 'Marte', 'Espacio'], en: ['Desert', 'Desert II', 'Flatgrass', 'City', 'Base', 'Base II', 'Mars', 'Space'] };
const nom = await C.ev(`(() => { const o = {}; for (const l of ${JSON.stringify(LANGS)}) { idiomaAplicar(l); PREFS.lang = l; o[l] = ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2', 'Mars', 'Space', 'RB_Llanura'].map(mapaNom); } idiomaAplicar('es'); PREFS.lang = 'es'; return o; })()`);
const nomOk = LANGS.every((l) => nom[l].slice(0, 8).every((x, i) => x && x !== 'm.' + i && !(viejos[l] && viejos[l][i] === x))) && new Set(nom.es.slice(0, 8)).size === 8;
ok('8. los 8 mapas heredados con nombre nuevo en los 14 idiomas', nomOk, { es: nom.es, en: nom.en, ja: nom.ja, ar: nom.ar });
const M7 = ['FlatGrass', 'Desert', 'DesertV2', 'City', 'Base', 'BaseV2', 'Mars'], pz = {};
for (const m of M7) {
  pz[m] = await C.ev(`(async () => { PREFS.bienvenida = true; empezarPartida('${m}'); inicioMostrar(false); await new Promise((ok) => setTimeout(ok, 1200));
    const H = IDS.hito, s = MUNDO.spawns[0]; if (!H || !H.p) return { hito: H };
    const d = Math.hypot(H.p[0] - s.x, H.p[2] - s.z), e = ENTS.lista.find((x) => x.t === 'jx_plaza');
    JUG.pos.set(s.x, s.y + 1.2, s.z); JUG.yaw = Math.atan2(H.p[0] - s.x, H.p[2] - s.z); JUG.pitch = 0.06; await new Promise((ok) => setTimeout(ok, 1000));
    const top = entW(e, 0, 0.45 + 12.6, 0), c = clipDe(top); const enPantalla = !!c && c.x > 0 && c.x < VW() && c.y > 0 && c.y < VH();
    const tris = e.mallas.reduce((a, id) => a + ((R.mallas[id] && R.mallas[id].d.sub[0][1]) || 0) / 3, 0);
    return { d: +d.toFixed(1), enPantalla, mallas: e.mallas.length, tris, dueno: e.dueno, guardable: ENTS.lista.filter((x) => x.dueno === 'yo' && !x.red).includes(e) };
  })()`);
}
const sinPlaza = await C.ev(`(async () => {
  const o = {}; empezarPartida('Space'); await new Promise((ok) => setTimeout(ok, 800)); o.space = ENTS.lista.some((x) => x.t === 'jx_plaza');
  RB.mapaPartida = OFICIALES_MAPAS[0]; empezarPartida('FlatGrass'); await new Promise((ok) => setTimeout(ok, 800)); o.comunidad = ENTS.lista.some((x) => x.t === 'jx_plaza'); RB.mapaPartida = null;
  // (el creador: con el creador prendido, armar el mapa no pone la plaza)
  empezarPartida('FlatGrass'); for (const x of ENTS.lista.filter((x) => x.t === 'jx_plaza')) entidadQuitar(x);
  CREA.on = true; try { idsHitoMapa('FlatGrass'); o.creador = ENTS.lista.some((x) => x.t === 'jx_plaza'); } finally { CREA.on = false; }
  return o; })()`).catch((e) => ({ error: e.message }));
ok('9. la plaza en los 7 de superficie (30–65 m, a la vista desde la aparición); no en Espacio, ni sobre un mapa de la comunidad, ni en el creador; no se guarda con lo del jugador',
  M7.every((m) => pz[m].d >= 30 && pz[m].d <= 65 && pz[m].enPantalla && pz[m].dueno === 'mapa' && !pz[m].guardable) && sinPlaza.space === false && sinPlaza.comunidad === false && sinPlaza.creador === false, { pz, sinPlaza });
// 10: subir caminando y chocar con el monolito
await C.ev(`(async () => { empezarPartida('FlatGrass'); inicioMostrar(false); cerrarPaneles(); await new Promise((ok) => setTimeout(ok, 1000)); return 1; })()`);
const ini = await C.ev(`(() => { const H = IDS.hito, e = ENTS.lista.find((x) => x.t === 'jx_plaza'), f = e.q.rot(v3(0, 0, 1)); const p = vadd(e.p, vscale(f, 17)); JUG.pos.set(p.x, p.y + 1.2, p.z); JUG.vel.set(0, 0, 0); JUG.yaw = Math.atan2(-f.x, -f.z); JUG.pitch = 0; return { y0: e.p.y }; })()`);
await C.p.mouse.click(400, 225).catch(() => {}); await C.p.keyboard.down('KeyW');
// (en este entorno el juego va a pocos cuadros y la física se frena: se camina hasta 40 s, hasta quedar trabado contra el
// monolito tres muestras seguidas)
const subida = [];
for (let i = 0; i < 40; i++) {
  await espera(1000); subida.push(await C.ev(`(() => { const e = ENTS.lista.find((x) => x.t === 'jx_plaza'), L = entLocal(e, JUG.pos); return { y: +(JUG.pos.y - e.p.y).toFixed(2), z: +L.z.toFixed(2), x: +L.x.toFixed(2) }; })()`));
  const n = subida.length; if (n >= 4 && subida[n - 1].z < 3 && Math.abs(subida[n - 1].z - subida[n - 3].z) < 0.05) break;
}
await C.p.keyboard.up('KeyW');
const arriba = subida.find((s) => s.y > 0.45 + 0.6 && Math.abs(s.z) < 8.5);
const ultimo = subida[subida.length - 1];
ok('10. se sube caminando por la rampa y el monolito frena (no se lo atraviesa)', !!arriba && subida.every((s) => !(Math.abs(s.x) < 2 && Math.abs(s.z) < 0.8 + 0.2)) && ultimo.z >= 0.8, { arriba, ultimo, recorrido: subida.map((s) => [s.z, s.y]) });
// 11: costo
const costo = await C.ev(`(async () => {
  const e = ENTS.lista.find((x) => x.t === 'jx_plaza'), H = IDS.hito; JUG.pos.set(e.p.x, e.p.y + 1.2, e.p.z + 30); JUG.yaw = Math.PI; JUG.pitch = 0.05;
  const medir = async () => { await new Promise((ok) => setTimeout(ok, 600)); const L = []; for (let i = 0; i < 40; i++) { const t = performance.now(); dibujar(); L.push(performance.now() - t); await new Promise((ok) => requestAnimationFrame(ok)); } L.sort((a, b) => a - b); return L[L.length >> 1]; };
  const conMs = []; const sinMs = [];
  for (let r = 0; r < 3; r++) { conMs.push(await medir()); const i = ENTS.lista.indexOf(e); ENTS.lista.splice(i, 1); sinMs.push(await medir()); ENTS.lista.push(e); }
  const md = (a) => a.sort((x, y) => x - y)[1];
  return { con: +md(conMs).toFixed(2), sin: +md(sinMs).toFixed(2) };
})()`);
ok('11. cuesta poco: 3 mallas, ≤ 2000 triángulos, ≤ 1,5 ms más por cuadro', pz.FlatGrass.mallas === 3 && pz.FlatGrass.tris <= 2000 && costo.con - costo.sin <= 1.5, { mallas: pz.FlatGrass.mallas, tris: pz.FlatGrass.tris, ...costo });
await C.c.close();
const e2 = errs.filter((x) => !/broker|mqtt|tienda|CORS|ERR_FAILED|Failed to load|net::|willRead/i.test(x));
ok('12. sin errores de JS', !e2.length, e2.slice(0, 4));
console.log('RESUMEN ' + R.filter(Boolean).length + '/' + R.length);
await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
