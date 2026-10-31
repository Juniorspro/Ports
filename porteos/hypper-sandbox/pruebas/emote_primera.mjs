// emotes en primera persona: hacer un emote (Hi y uno de captura) no pasa a tercera persona; se ve el cuerpo (con la
// cabeza achicada a nada, los brazos enteros) y no el arma de la mano; al terminar vuelve todo (cabeza, arma, sin cuerpo).
// uso: node emote_primera.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 15000 });
const c0 = await ev(`(() => { const P = JUG.cuerpo; return { cab: P.md.s[P.D.h.Head][0], hombro: P.md.s[P.D.h.LeftShoulder][0] }; })()`);
await ev(`JUG.tercera = false; JUG.pitch = 0.9; emote('Hi'); 1`); await p.waitForTimeout(700);
const dur = await ev(`(() => { const P = JUG.cuerpo; return { tercera: JUG.tercera, dibujado: P.cDib === PERS_N, cab: P.md.s[P.D.h.Head][0], hombro: P.md.s[P.D.h.LeftShoulder][0], arma: dibujarVista() }; })()`);
await p.screenshot({ path: D + 'emote_primera.png' });
ok('Hi en primera persona: sigue en primera, se ve el cuerpo, la cabeza achicada, los brazos enteros, sin el arma', !dur.tercera && dur.dibujado && dur.cab < c0.cab * 0.01 && Math.abs(dur.hombro - c0.hombro) < 1e-6 && dur.arma === false, { c0, dur });
await ev(`JUG.cuerpo.emote = null; 1`); await p.waitForTimeout(600);
const fin = await ev(`(() => { const P = JUG.cuerpo; return { cab: P.md.s[P.D.h.Head][0], dibujado: P.cDib === PERS_N, arma: dibujarVista() }; })()`);
ok('al terminar: la cabeza vuelve, el cuerpo deja de dibujarse y vuelve el arma', Math.abs(fin.cab - c0.cab) < 1e-6 && !fin.dibujado && fin.arma === true, fin);
// la patada sigue achicando hombros (para que no tapen la cámara)
await ev(`PAT.t = -9; patear(); 1`); await p.waitForTimeout(120);
const pa = await ev(`(() => { const P = JUG.cuerpo; return { cab: P.md.s[P.D.h.Head][0], hombro: P.md.s[P.D.h.LeftShoulder][0] }; })()`);
ok('la patada sigue achicando cabeza y hombros', pa.cab < c0.cab * 0.01 && pa.hombro < c0.hombro * 0.01, pa);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).length === 0, err.slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
