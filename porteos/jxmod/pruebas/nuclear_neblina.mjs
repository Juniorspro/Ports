// La neblina de las nucleares (Discord: «¿por qué tanta neblina?» «por la bomba»): la falda de polvo del hongo con volumen
// tapaba el mapa entero a la altura de los ojos los 150 s. Con bombas de 1 kt a 50 Mt, mirando a la bomba desde 1 y 2
// radios a la altura de los ojos, lo que tapa el humo en la mitad de abajo de la pantalla (el alfa del búfer del hongo):
//  1. a los 60 s, ≤ 10 % a 1 radio y ≤ 3 % a 2 radios;  2. a los 120 s, ≤ 2 % (antes 12-31 %);
//  3. sigue habiendo hongo (a los 10 s tapa algo a 1 radio: > 3 %);  4. sin errores de JS.
// uso: node nuclear_neblina.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Flatgrass'); 1`); await p.waitForTimeout(4000);
const res = await ev(`(async () => { nvPreparar(); for (let i = 0; i < 600 && !NUKV.tex; i++) await new Promise((r) => setTimeout(r, 100)); NUKV.forzarOcho = true; $('hud').classList.add('oc');
  const L = DATA.menu.find((c) => c.n === 'Props').sub.find((s) => s.n === 'Nucleares').it.map((n) => [n, nukeDe(n).kt, nukeDe(n).t]).filter((x) => /suelo|torre|barco|aire|bomba/.test(x[2]));
  const bombas = [1, 15, 1000, 15000, 50000].map((kt) => L.slice().sort((a, b) => Math.abs(Math.log(a[1] / kt)) - Math.abs(Math.log(b[1] / kt)))[0]);
  const tapa = () => { const gl = R.gl, E = NUK.vivas[0]; if (!NUKV.fb || !NUKV.ok || !E || !E.vol) return 0; gl.bindFramebuffer(gl.FRAMEBUFFER, NUKV.fb); gl.readBuffer(gl.COLOR_ATTACHMENT0); const w = NUKV.w, h = NUKV.h, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null); let s = 0; for (let y = 0; y < h / 2; y++) for (let x = 0; x < w; x++) s += px[(y * w + x) * 4 + 3] / 255; return s / (w * h / 2); };
  const out = {};
  for (const [nom, kt] of bombas) { nukeLimpiar(); const E = nukeExplotar(v3(0, 0.5, 0), nom, false); E.sinViento = true; E.jug = true; NUK.flash = 0; NUK.zonas = []; const f = {};
    for (const t of [10, 60, 120]) for (const k of [1, 2]) { E.t = t; E.onda = E.alc; JUG.noclip = true; JUG.vel.set(0, 0, 0); JUG.pos.set(E.R * k, 1.7, 0); JUG.yaw = -Math.PI / 2; JUG.pitch = 0; CAM.temblor = 0; await new Promise((r) => setTimeout(r, 300)); E.t = t; f[t + 's_' + k + 'R'] = +(100 * tapa()).toFixed(1); }
    out[nom + ' ' + kt + ' kt'] = f; }
  nukeLimpiar(); return out; })()`);
const V = Object.values(res), m = (k) => Math.max(...V.map((f) => f[k]));
ok('1. a los 60 s casi no queda: ≤ 10 % a 1 radio y ≤ 3 % a 2 radios', m('60s_1R') <= 10 && m('60s_2R') <= 3, res);
ok('2. a los 120 s, ≤ 2 %', m('120s_1R') <= 2 && m('120s_2R') <= 2);
ok('3. el hongo sigue estando (a los 10 s, a 1 radio, tapa algo)', Math.min(...V.map((f) => f['10s_1R'])) > 3);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|aborted/i.test(x));
ok('4. sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
