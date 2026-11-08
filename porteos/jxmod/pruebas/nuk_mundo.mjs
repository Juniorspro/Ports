// Nucleares (nucleares.js, JXMod 3.0.2):
//  A) una nuclear detonada no sigue en el mundo nuevo: se detona, se empieza otra partida (lo mismo que entrar a otro server:
//     red.js entrarSala → empezarPartida) y no tiene que quedar nada (explosiones vivas, radiación, destello, luces, soplido).
//  B) el humo de una nuclear lejana (más allá de la vista: la tanda «lejos» de nukeDibujar) no se dibuja encima de lo que
//     está delante. En Patata (sin volumen: van las bocanadas), cámara fija mirando el horizonte; la bomba más allá de la
//     vista y fuera del alcance de la onda (sin polvo cerca); foto a los 7 s (ya sin destello ni luz) contra la misma vista
//     sin bomba: en el PISO (filas de abajo) no tiene que cambiar nada; en el CIELO la nube tiene que verse.
// uso: node nuk_mundo.mjs URL_HTML [CARPETA_FOTOS]   (URL_HTML con http://; un python3 -m http.server en su carpeta)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, DIR = '.'] = process.argv, D = DIR.replace(/\/?$/, '/'); fs.mkdirSync(D, { recursive: true });
let ok = 0, mal = 0; const res = (b, t, x) => { b ? ok++ : mal++; console.log((b ? 'OK   ' : 'FALLA') + ' ' + t + (x !== undefined ? ' · ' + JSON.stringify(x) : '')); };

const prefs = { bienvenida: true, gfx: 'patata', res: 100, resDin: false, ocultarUI: true, fps: false, motor: 'webgl2', motorV: 2 };
const { b, p, err, ev } = await abrir(HTML, false, null, async (pg) => {
  await pg.addInitScript((pr) => { try { localStorage.setItem('jx_prefs', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('jx_prefs') || '{}'), pr))); } catch (e) {} }, prefs);
});
const partida = async (m) => { await ev(`empezarPartida(${JSON.stringify(m)}); 1`); await p.waitForFunction((x) => window.__ev(`MUNDO.nombre === ${JSON.stringify(x)} && JUEGO.estado === 'juego'`), m, { timeout: 120000, polling: 300 }); await p.waitForTimeout(2500); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); 1`);
await partida('FlatGrass');
// una nuclear de superficie (con radiación) del catálogo
const nom = await ev(`Object.keys(DATA.pfPorNombre).find((n) => { const k = nukeDe(n); return k && k.t === 'suelo' && k.kt <= 50; }) || Object.keys(DATA.pfPorNombre).find((n) => nukeDe(n))`);
res(!!nom, 'hay una nuclear en el catálogo', nom);

// ---- A) no sigue en el mundo nuevo ----
const est = `({ vivas: NUK.vivas.length, zonas: (NUK.zonas || []).length, flash: +(NUK.flash || 0).toFixed(3), flashVis: (() => { const f = $('nukFlash'); return !!f && f.style.display !== 'none'; })(), rad: +(NUK.rad || 0).toFixed(3), luces: LUCES_T.length, sons: (NUK.sons || []).length })`;
await ev(`nukeExplotar(vadd(JUG.pos, v3(0, 0, -40)), ${JSON.stringify(nom)}, false); 1`);
await p.waitForTimeout(800);
const a0 = await ev(est); res(a0.vivas >= 1, 'A: recién detonada, está viva', a0);
await partida('FlatGrass');   // (otro mundo: lo mismo que crear uno nuevo o entrar a otro server)
const a1 = await ev(est);
res(a1.vivas === 0 && a1.zonas === 0 && a1.flash === 0 && !a1.flashVis && a1.luces === 0 && a1.sons === 0, 'A: en el mundo nuevo no queda nada de la nuclear', a1);
await p.waitForTimeout(1500);
const a2 = await ev(est); res(a2.vivas === 0 && a2.rad === 0, 'A: 1,5 s después sigue sin nada (ni radiación)', a2);
// (y volver al menú también limpia)
await ev(`nukeExplotar(vadd(JUG.pos, v3(0, 0, -40)), ${JSON.stringify(nom)}, false); irMenuPrincipal(); 1`); await p.waitForTimeout(500);
const a3 = await ev(est); res(a3.vivas === 0 && !a3.flashVis, 'A: volver al menú también la saca', a3);
await ev(`inicioMostrar(false); 1`); await partida('FlatGrass');

// ---- B) el humo lejano no se dibuja encima de lo de adelante ----
const geo = await ev(`(() => { const s = MUNDO.spawns[0] || JUG.pos; const E = nukeRadio(nukeDe(${JSON.stringify(nom)}).kt); return { x: s.x, y: s.y, z: s.z, lejos: R.lejos || 300, R: E, alc: E * 2.3 }; })()`);
const dist = Math.max(geo.lejos * 1.6, geo.alc * 1.3 + 50);
// cámara a 1,7 m, mirando al -Z apenas para abajo: la mitad de abajo es piso (cerca), la de arriba cielo
await ev(`DBG.cam = { p: v3(${geo.x}, ${geo.y + 1.7}, ${geo.z}), q: Quat.euler(0, 0.06) }; JUG.congelado = true; 1`);
await p.waitForTimeout(2500);
const foto = async () => { await p.waitForTimeout(300); return p.screenshot(); };
await ev(`NUK.vivas.length = 0; if (NUK.zonas) NUK.zonas.length = 0; 1`); await p.waitForTimeout(1500);
const sin = await foto(); const sin2 = await foto();
await ev(`nukeExplotar(v3(${geo.x}, ${geo.y}, ${geo.z - dist}), ${JSON.stringify(nom)}, false); 1`);
await p.waitForTimeout(7000);
const vivoB = await ev(`({ vivas: NUK.vivas.length, vol: NUK.vivas.map((E) => !!E.vol), flash: +(NUK.flash || 0).toFixed(4), luces: LUCES_T.length, dist: ${dist.toFixed(0)}, lejos: R.lejos, cam: [CAM.pos.x, CAM.pos.y, CAM.pos.z].map((v) => +v.toFixed(1)) })`);
const con = await foto();
fs.writeFileSync(D + 'nuk_sin.png', sin); fs.writeFileSync(D + 'nuk_con.png', con);
// diferencia por zonas: piso = el 30 % de abajo; cielo = el 35 % de arriba
const m = await p.evaluate(async ([a, c]) => {
  const img = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const x = cv.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height); };
  const A = await img(a), C = await img(c), W = A.width, H = A.height;
  const zona = (y0, y1, x0 = 0, x1 = 1) => { let n = 0, d8 = 0, s = 0; for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++) for (let x = Math.floor(x0 * W); x < Math.floor(x1 * W); x++) { const o = (y * W + x) * 4; const d = (Math.abs(A.data[o] - C.data[o]) + Math.abs(A.data[o + 1] - C.data[o + 1]) + Math.abs(A.data[o + 2] - C.data[o + 2])) / 3; n++; s += d; if (d > 8) d8++; } return { cambiados: +(100 * d8 / n).toFixed(2), media: +(s / n).toFixed(2) }; };
  return { piso: zona(0.70, 1.0, 0, 0.5), cielo: zona(0.0, 0.35) };
}, [sin.toString('base64'), con.toString('base64')]);
const ruido = await p.evaluate(async ([a, c]) => { const img = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const x = cv.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height); }; const A = await img(a), C = await img(c), W = A.width, H = A.height; let n = 0, d8 = 0; for (let y = Math.floor(0.7 * H); y < H; y++) for (let x = 0; x < W >> 1; x++) { const o = (y * W + x) * 4; const d = (Math.abs(A.data[o] - C.data[o]) + Math.abs(A.data[o + 1] - C.data[o + 1]) + Math.abs(A.data[o + 2] - C.data[o + 2])) / 3; n++; if (d > 8) d8++; } return +(100 * d8 / n).toFixed(2); }, [sin.toString('base64'), sin2.toString('base64')]);
console.log('ruido del piso (dos fotos sin bomba): ' + ruido + ' %');
res(vivoB.vivas >= 1 && vivoB.vol.every((v) => !v), 'B: la nuclear lejana sigue viva y va con bocanadas (Patata, sin volumen)', vivoB);
res(m.cielo.cambiados > 0.5, 'B: la nube se ve en el cielo', m.cielo);
res(m.piso.cambiados < 0.5, 'B: el piso de adelante NO queda tapado por el humo lejano (izquierda, sin el arma)', m.piso);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
res(!e2.length, 'sin errores de JS', e2.slice(0, 3));
console.log(`RESUMEN ${ok}/${ok + mal}`);
await b.close();
process.exit(mal ? 1 : 0);
