// el arma en la mano, a gusto (idea de Discord: «personalizar cómo querés agarrar el arma»). En la pausa, «Arma en la mano»:
//  1. el panel se abre con el arma de primera persona y su nombre; en tercera persona avisa y no abre
//  2. cada barra al tope mueve el arma lo que dice, para el lado que dice (±10 %, los otros ejes ≤ 1 cm):
//     Adelante +12 cm hacia adelante, Costado +10 cm a la derecha, Altura +10 cm arriba; el giro, 25° (±2°)
//  3. queda guardado para esa arma (también en localStorage) y no toca a las otras; «Como venía» la devuelve (≤ 3 mm)
//  4. apuntando, el ajuste no cuenta: la boca sigue en el centro (|x| ≤ 0,06)
//  5. sin errores
// uso: node arma_aj.mjs URL_HTML
import { abrir } from './base.mjs';
const [, , HTML] = process.argv;
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, ev, err } = await abrir(HTML, true, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); cuPedirAlAbrir.hecho = true; cuDialogoCerrar(); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1500);
await ev(`(() => { ARM.lista = ['Pistol', 'Smg', 'Akm']; JUG.tercera = false; JUG.pitch = 0; delete PREFS.armaAj; elegirArma(0);
  // (dónde está el arma respecto de la cámara, en metros: a la derecha, arriba, adelante; y hacia dónde mira su caño)
  window.__pos = () => { const v = ARM.v; if (!v) return null; const W = v.md.raiz, r = vsub(v3(W[12], W[13], W[14]), CAM.pos);
    const e = v3(W[8], W[9], W[10]).norm(), az = Math.atan2(vdot(e, CAM.der), vdot(e, CAM.fwd)) * 180 / Math.PI;
    return { der: vdot(r, CAM.der), arr: vdot(r, CAM.arr), ad: vdot(r, CAM.fwd), az }; };
  window.__barra = (k, v) => { const i = document.querySelector('#armaAjPan [data-aa="' + k + '"]'); i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); return 1; };
  return 1; })()`);
await p.waitForTimeout(1500);
// (esperar dos cuadros nuevos del juego antes de medir)
const cuadros = async (n = 2) => { for (let i = 0; i < n; i++) { const t0 = await ev(`TIEMPO.t`); await p.waitForFunction((x) => window.__ev(`TIEMPO.t`) > x, t0, { timeout: 20000, polling: 16 }); } };
const med = async () => { await cuadros(3); return ev(`__pos()`); };
// 1. abrir
await ev(`(() => { JUG.tercera = true; abrirPausa(); $('bArmaAj').click(); return 1; })()`); await p.waitForTimeout(300);
const ter = await ev(`({ abierto: !!$('armaAjPan') && !$('armaAjPan').classList.contains('oc'), aviso: (document.getElementById('aviso') || {}).textContent || '' })`);
await ev(`(() => { cerrarPaneles(); JUG.tercera = false; return 1; })()`); await p.waitForTimeout(1200);
await ev(`(() => { abrirPausa(); $('bArmaAj').click(); return 1; })()`); await p.waitForTimeout(400);
const pri = await ev(`({ abierto: !$('armaAjPan').classList.contains('oc'), ui: UI.abierto, pausa: !$('pausa').classList.contains('oc'), tit: document.querySelector('#armaAjPan .aaTit').textContent })`);
ok('1. se abre en primera persona con el nombre del arma (en tercera, avisa y no abre)', pri.abierto && pri.ui === 'armaAj' && !pri.pausa && /·/.test(pri.tit) && !ter.abierto, { pri, ter });
// 2. cada barra
const base = await med(); const filas = {};
for (const [k, eje, esp] of [['z', 'ad', 0.12], ['x', 'der', 0.10], ['y', 'arr', 0.10]]) {
  await ev(`__barra('${k}', 1)`); const m = await med(); await ev(`__barra('${k}', 0)`);
  const d = { der: m.der - base.der, arr: m.arr - base.arr, ad: m.ad - base.ad };
  const otros = Object.keys(d).filter((q) => q !== eje).map((q) => Math.abs(d[q]));
  filas[k] = { cm: +(d[eje] * 100).toFixed(2), esp: esp * 100, otrosCm: +(Math.max(...otros) * 100).toFixed(2), bien: Math.abs(d[eje] / esp - 1) <= 0.1 && Math.max(...otros) <= 0.01 };
}
await ev(`__barra('g', 1)`); { const m = await med(); let dg = m.az - base.az; dg = ((dg + 540) % 360) - 180; filas.g = { grados: +dg.toFixed(2), bien: Math.abs(Math.abs(dg) - 25) <= 2 }; }
ok('2. cada barra mueve el arma lo que dice y para su lado (±10 %; Costado positivo = a la derecha; el giro 25°)', Object.values(filas).every((f) => f.bien), filas);
// 3. guardado por arma, «Como venía»
await ev(`__barra('g', 0)`); await ev(`__barra('z', 0.5)`); await ev(`__barra('y', -0.5)`);
await ev(`document.querySelectorAll('#armaAjPan [data-aab="listo"]')[1].click()`); await p.waitForTimeout(200);
const g1 = await ev(`({ pref: PREFS.armaAj && PREFS.armaAj.Pistol, ls: (JSON.parse(localStorage.getItem('jx_prefs') || '{}').armaAj || {}).Pistol || null, cerrado: $('armaAjPan').classList.contains('oc'), ui: UI.abierto })`);
const conAj = await med();
await ev(`elegirArma(1)`); await p.waitForTimeout(1500); const smgB = await ev(`({ aj: armaAjDe('Smg'), p: __pos() })`);
await ev(`elegirArma(0)`); await p.waitForTimeout(1500); const vuelta = await med();
await ev(`(() => { abrirPausa(); $('bArmaAj').click(); return 1; })()`); await p.waitForTimeout(300);
const barras = await ev(`['z', 'y'].map((k) => +document.querySelector('#armaAjPan [data-aa="' + k + '"]').value)`);
await ev(`document.querySelector('#armaAjPan [data-aab="cero"]').click()`); const cero = await med();
await ev(`document.querySelectorAll('#armaAjPan [data-aab="listo"]')[1].click()`);
const sinPistol = await ev(`!(PREFS.armaAj && PREFS.armaAj.Pistol)`);
const dist = (a, c) => Math.hypot(a.der - c.der, a.arr - c.arr, a.ad - c.ad) * 100;
ok('3. queda guardado para esa arma (y en el aparato), las otras no cambian y «Como venía» la devuelve',
  g1.pref && Math.abs(g1.pref.z - 0.06) < 1e-3 && Math.abs(g1.pref.y + 0.05) < 1e-3 && g1.ls && g1.ls.z === g1.pref.z && g1.cerrado && g1.ui !== 'armaAj' && !smgB.aj
  && dist(vuelta, conAj) <= 0.3 && Math.abs(barras[0] - 0.5) < 0.02 && Math.abs(barras[1] + 0.5) < 0.02 && dist(cero, base) <= 0.3 && sinPistol,
  { g1, smgAj: smgB.aj, vueltaCm: +dist(vuelta, conAj).toFixed(2), barras, ceroCm: +dist(cero, base).toFixed(2) });
// 4. apuntando no cuenta
await ev(`(() => { PREFS.armaAj = { Pistol: { x: 0.1, y: -0.1, z: 0.12, g: 25 } }; cerrarPaneles(); ARM.apunta = false; ENT.disparo2 = true; return 1; })()`); await p.waitForTimeout(1200);
const ap = await ev(`(() => { const v = ARM.v; v.md.actualizar(); const W = v.md.W[v.mz], r = vsub(v3(W[12], W[13], W[14]), CAM.pos), z = vdot(r, CAM.fwd), t = Math.tan(CAM.fov * Math.PI / 360);
  return { x: +(vdot(r, CAM.der) / z / (t * innerWidth / innerHeight)).toFixed(3), y: +(vdot(r, CAM.arr) / z / t).toFixed(3), k: +ARM.apK.toFixed(2) }; })()`);
ok('4. apuntando el ajuste no cuenta: la boca sigue en el centro (|x| ≤ 0,06)', ap.k > 0.95 && Math.abs(ap.x) <= 0.06 && ap.y < 0 && ap.y > -0.24, ap);
const malos = err.filter((x) => !/GPU stall|swiftshader|ERR_|404|Failed to load|WebSocket/i.test(x));
ok('5. sin errores de JS', !malos.length, malos.slice(0, 3));
await b.close();
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
