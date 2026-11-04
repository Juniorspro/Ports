// la linterna en todos los mapas (L o el botón táctil): de noche en FlatGrass, lo que mirás se ilumina (luminancia del
// centro de la pantalla con y sin linterna, en Bajo, Medio y Alto), el botón queda marcado, el Lua la ve
// (FlashlightIsOn, PlayerSwitchFlashlight que la bloquea, AllowFlashlight(false)), los demás de la sala la ven (bit 128
// y la luz de un jugador remoto), se apaga al morir y en la pizzería sigue siendo la de FNAF.
// uso: node linterna.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, D = '.'] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.cuerpo`), null, { timeout: 60000 }); await p.waitForTimeout(2000);
await ev(`DIA.hora = 0; DIA.ciclo = false; diaAplicar(); JUG.pitch = 0.55; 1`); await p.waitForTimeout(800);
// (la luminancia media del centro de la pantalla, de una captura)
const lum = async () => { const png = await p.screenshot({ clip: { x: 873 / 2 - 80, y: 393 / 2 - 20, width: 160, height: 120 } }); return await p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return +(s / (d.length / 4)).toFixed(1); }, png.toString('base64')); };
const med = {};
for (const g of ['bajo', 'medio', 'alto']) {
  await ev(`PREFS.gfx = '${g}'; aplicarGfx(); DIA.aplicada = -1; diaAplicar(); linternaAlternar(false); 1`); await p.waitForTimeout(1200);
  const apag = await lum(); await ev(`linternaAlternar(true); 1`); await p.waitForTimeout(700); const pren = await lum();
  if (g === 'medio') await p.screenshot({ path: D + '/linterna_medio.png' });
  med[g] = { apagada: apag, prendida: pren, x: +(pren / Math.max(1, apag)).toFixed(2) };
}
ok('de noche, con la linterna lo que mirás se ilumina (≥ 1,8× la luminancia) en Bajo, Medio y Alto', Object.values(med).every((m) => m.x >= 1.8), med);
const bt = await ev(`({ hay: !!document.getElementById('blinterna'), sel: document.getElementById('blinterna').classList.contains('sel'), vis: getComputedStyle(document.getElementById('blinterna')).display !== 'none' })`);
ok('hay botón táctil de linterna y queda marcado prendido', bt.hay && bt.sel && bt.vis, bt);
// el botón la apaga
// (en Alto y con el render por software un cuadro puede tardar más de medio segundo: se espera el resultado, hasta 6 s)
await p.tap('#blinterna'); await p.waitForFunction(() => window.__ev('!LINT.on'), null, { timeout: 6000 }).catch(() => {});
const tras = await ev(`({ on: LINT.on, sel: document.getElementById('blinterna').classList.contains('sel') })`);
ok('tocar el botón la apaga', !tras.on && !tras.sel, tras);
// la tecla L
await p.keyboard.press('KeyL'); await p.waitForFunction(() => window.__ev('LINT.on'), null, { timeout: 6000 }).catch(() => {}); const tecla = await ev(`LINT.on`);
ok('la tecla L la prende', tecla === true, tecla);
// el Lua
const red = await ev(`({ bits: linternaBits(), lin: GMA.linterna })`);
ok('para la red va el bit 128 (los demás la ven)', red.bits === 128 && red.lin === true, red);
const lua = await ev(`(() => { if (!GMA.R) gmaIniciar(); const q = (s) => String(gmaCorrer('lin.lua', s));
  const a = q('return tostring(LocalPlayer():FlashlightIsOn())');
  q('hook.Add("PlayerSwitchFlashlight", "noLin", function(p, on) if on then return false end end)'); linternaAlternar(false); linternaAlternar(true); const bloq = LINT.on;
  q('hook.Remove("PlayerSwitchFlashlight", "noLin")'); q('LocalPlayer():Flashlight(true)'); const desdeLua = LINT.on;
  q('LocalPlayer():AllowFlashlight(false)'); linternaAlternar(true); const noPerm = LINT.on; q('LocalPlayer():AllowFlashlight(true)');
  return { a, bloq, desdeLua, noPerm, err: GMA.errores.slice(-3) }; })()`);
ok('el Lua la ve como en GMod (FlashlightIsOn, PlayerSwitchFlashlight la bloquea, Flashlight(true), AllowFlashlight(false))', lua.a === 'true' && !lua.bloq && lua.desdeLua && !lua.noPerm && !lua.err.length, lua);
// un jugador remoto con la linterna prendida alumbra
await ev(`recibirEstado({ i: 'ana', n: 'Ana', k: 'Hero', h: 'HatEmpty', p: [JUG.pos.x, JUG.pos.y, JUG.pos.z + 4], v: [0, 0, 0], y: Math.PI, t: 0.5, f: 5 | 128, a: null, e: 0 }); linternaAlternar(false); 1`); await p.waitForTimeout(600);
const rem = await ev(`(() => { R.esp.length = 0; linternaLuces(); return R.esp.length; })()`);
ok('la linterna de otro jugador de la sala también alumbra', rem >= 1, rem);
// se apaga al morir
await ev(`linternaAlternar(true); danarJugador ? danarJugador(1000) : (JUG.vivo = false); 1`); await p.waitForFunction(() => window.__ev('!LINT.on'), null, { timeout: 6000 }).catch(() => {});
const muerto = await ev(`({ vivo: JUG.vivo, on: LINT.on })`);
ok('al morir se apaga', !muerto.vivo && !muerto.on, muerto);
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x)); ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
