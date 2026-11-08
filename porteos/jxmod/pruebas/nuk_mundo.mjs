// Nucleares (nucleares.js, JXMod 3.0.2):
//  A) una nuclear detonada no sigue en el mundo nuevo: se detona, se empieza otra partida (lo mismo que entrar a otro server:
//     red.js entrarSala → empezarPartida) y no tiene que quedar nada (explosiones vivas, radiación, destello, luces, soplido).
//  B) el humo de una nuclear lejana (más allá de la vista: la tanda «lejos» de nukeDibujar) no se dibuja encima de lo que
//     está delante. En Patata (sin volumen: van las bocanadas), cámara fija mirando el horizonte; la bomba más allá de la
//     vista: esa tanda tiene que ir con prueba de profundidad y al fondo (se mira el estado de WebGL en cada dibujo).
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
// La tanda de bocanadas de más allá de la vista (nukeDibujar) tiene que ir CON prueba de profundidad y al fondo
// (depthRange 1..1 + LEQUAL): así sólo se pinta donde no hay nada dibujado (el cielo no escribe profundidad y el cielo 3D
// la borra) y la tapa todo lo que esté delante. Se mira el estado de WebGL en cada dibujo de la nuclear (una comparación
// de fotos no sirve acá: las nubes del cielo se mueven solas entre foto y foto).
const geo = await ev(`(() => { const s = MUNDO.spawns[0] || JUG.pos; const E = nukeRadio(nukeDe(${JSON.stringify(nom)}).kt); return { x: s.x, y: s.y, z: s.z, lejos: R.lejos || 300, alc: E * 2.3 }; })()`);
const dist = Math.max(geo.lejos * 1.6, geo.alc * 1.3 + 50);
await ev(`NUK.vivas.length = 0; if (NUK.zonas) NUK.zonas.length = 0; 1`);
await ev(`(() => { const gl = R.gl, dA = gl.drawArrays.bind(gl); window.__nkGL = []; gl.drawArrays = function (...a) { if (window.__nkDib) window.__nkGL.push({ dt: gl.isEnabled(gl.DEPTH_TEST), dr: Array.from(gl.getParameter(gl.DEPTH_RANGE)), df: gl.getParameter(gl.DEPTH_FUNC) === gl.LEQUAL ? 'LEQUAL' : gl.getParameter(gl.DEPTH_FUNC) === gl.LESS ? 'LESS' : 'otra' }); return dA(...a); }; const nd = nukeDibujar; window.nukeDibujar = nukeDibujar = function () { window.__nkDib = true; try { return nd(); } finally { window.__nkDib = false; } }; return 1; })()`);
await ev(`nukeExplotar(vadd(JUG.pos, v3(0, 0, -${dist.toFixed(0)})), ${JSON.stringify(nom)}, false); 1`);
await p.waitForTimeout(5000);
const vivoB = await ev(`({ vivas: NUK.vivas.length, vol: NUK.vivas.map((E) => !!E.vol), dist: ${dist.toFixed(0)}, lejos: R.lejos })`);
const gls = await ev(`(window.__nkGL || [])`);
const lejos = gls.filter((g) => g.dr[0] === 1 || !g.dt), sinProf = gls.filter((g) => !g.dt).length;
res(vivoB.vivas >= 1 && vivoB.vol.every((v) => !v), 'B: nuclear más allá de la vista, con bocanadas (Patata, sin volumen)', vivoB);
res(gls.length > 0 && sinProf === 0, 'B: ninguna tanda de la nuclear se dibuja sin prueba de profundidad', { dibujos: gls.length, sinProfundidad: sinProf });
res(lejos.length > 0 && lejos.every((g) => g.dt && g.dr[0] === 1 && g.dr[1] === 1 && g.df === 'LEQUAL'), 'B: la tanda lejana va al fondo (depthRange 1..1, LEQUAL)', lejos.slice(0, 1));
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
res(!e2.length, 'sin errores de JS', e2.slice(0, 3));
console.log(`RESUMEN ${ok}/${ok + mal}`);
await b.close();
process.exit(mal ? 1 : 0);
