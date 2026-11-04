// los controles táctiles en el celular, medidos: en varias pantallas (de 640×360 a una tablet) y en cada situación (a
// pie con las manos, con la pistola, con la pistola de física, con un arma de un mod de GMod y con un arma de mod que pide
// 4 botones, con algo para usar cerca, manejando un auto), ningún botón visible se encima con otro (y quedan al menos 6 px
// entre ellos), ninguno se sale de la pantalla, los de uso frecuente (disparar, saltar, agacharse, recargar, apuntar,
// acelerar, frenar, doblar) miden al menos 44 px (la guía de Apple: 44 pt; la de Android: 48 dp) y los demás 32 px; la zona
// de la palanca (abajo a la izquierda) queda libre de botones; y en el auto un toque a la izquierda no saca la palanca de
// caminar. Saca una foto por situación.
// uso: node hud_celu.mjs URL_HTML URL_CARPETA_GMA [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, CARP, DIR = '.'] = process.argv, D = DIR + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'patata'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(3000);
await ev(`(async () => { ENT.tactil = true; document.body.classList.add('tactil');
  const r = await fetch(${JSON.stringify(CARP)} + '/128089118.gma'); if (r.ok) { const A = await gmInstalar('128089118', { nombre: 'M9K', sinDeps: true }, new Uint8Array(await r.arrayBuffer())); await A.listo; gmaDarArma('m9k_ak47'); }
  return 1; })()`);
const FREC = ['#bdisparo', '#bsaltar', '#bagachar', '#brecargar', '#bdisp2', '#bgas', '#bfreno', '#bizq', '#bder'];
const ESTADOS = {
  manos: `elegirArma(ARM.lista.indexOf('Hands'))`,
  pistola: `elegirArma(ARM.lista.indexOf('Pistol'))`,
  fisica: `elegirArma(ARM.lista.indexOf('PhysicsGun'))`,
  armaMod: `elegirArma(ARM.lista.indexOf('gm:m9k_ak47'))`,
  armaMod4: `(() => { _ctlLeidos.set('m9k_ak47', [{ id: 'a', t: 'E', tecla: 'KeyE' }, { id: 'b', t: 'F', tecla: 'KeyF' }, { id: 'c', t: 'Zoom', bit: 0x80000 }, { id: 'd', t: 'G', tecla: 'KeyG' }]); CTL.modArma = null; elegirArma(ARM.lista.indexOf('gm:m9k_ak47')); return 1; })()`,
  usar: `(() => { elegirArma(ARM.lista.indexOf('Pistol')); $('usarTxt').textContent = 'E'; return 1; })()`,
  // (6 habilidades de addons fijadas en la pantalla desde el panel GMod, con el arma de mod de 4 botones en la mano)
  hab6: `(() => { GMB.fijos = [1, 2, 3, 4, 5, 6].map((i) => ({ k: 'key:KEY_' + i, t: String(i) })); gmbFijosDibujar(); CTL.modArma = null; elegirArma(ARM.lista.indexOf('gm:m9k_ak47')); $('usarTxt').textContent = 'E'; return 1; })()`,
  heli: `(() => { $('usarTxt').textContent = ''; GMB.fijos = []; gmbFijosDibujar(); if (JUG.vehiculo) salirVehiculo(); for (const o of OBJS.slice()) if (o.veh) borrarObjeto(o); elegirArma(ARM.lista.indexOf('Hands'));
    const n = DATA.pfPorNombre.CityCopter !== undefined ? 'CityCopter' : Object.keys(DATA.pfPorNombre).find((k) => /copter|heli/i.test(k)); if (!n) return 'sin heli'; const o = crearObjeto(n, v3(JUG.pos.x + 6, JUG.pos.y + 2, JUG.pos.z), new Quat(), {}); if (!o || !o.veh) return 'no es vehiculo ' + n; subirVehiculo(o); return o.veh.tipo; })()`,
  auto: `(() => { if (JUG.vehiculo) salirVehiculo(); for (const o of OBJS.slice()) if (o.veh) borrarObjeto(o); $('usarTxt').textContent = ''; elegirArma(ARM.lista.indexOf('Hands')); const o = crearObjeto('Sedan', v3(JUG.pos.x + 4, JUG.pos.y + 1, JUG.pos.z), new Quat(), {}); subirVehiculo(o); return 1; })()`,
};
const PANTALLAS = [[640, 360], [667, 375], [800, 360], [873, 393], [915, 412], [1024, 600], [1280, 800]];
const medir = () => ev(`(() => {
  const W = VW(), H = VH(), out = [];
  const vis = (e) => { if (!e || e.closest('.oc')) return false; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  for (const [sel] of HUD_TACTIL) for (const e of document.querySelectorAll(sel)) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); const rad = parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0; out.push({ s: sel, x: r.left, y: r.top, w: r.width, h: r.height, red: rad >= 0.4 * Math.min(r.width, r.height) }); }
  return { W, H, b: out };
})()`);
const fallas = { solape: [], afuera: [], chico: [], palanca: [] };
for (const [w, h] of PANTALLAS) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(400);
  for (const [n, js] of Object.entries(ESTADOS)) {
    if (n === 'manos') await ev(`(() => { if (JUG.vehiculo) salirVehiculo(); for (const o of OBJS.slice()) if (o.veh) borrarObjeto(o); return 1; })()`);
    await ev(js); await p.waitForTimeout(350);
    // (y unos cuadros dibujados: con la máquina cargada, en 350 ms la HUD a veces no se había actualizado)
    await ev(`(async () => { const c0 = R.cuadro, r0 = performance.now(); while (R.cuadro < c0 + 3 && performance.now() - r0 < 15000) await new Promise((r) => setTimeout(r, 30)); return 1; })()`);
    const M = await medir();
    const L = M.b;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      // (dos redondos: la distancia entre los bordes de los círculos; si no, entre las cajas)
      const a = L[i], c = L[j], gx = Math.max(a.x - (c.x + c.w), c.x - (a.x + a.w)), gy = Math.max(a.y - (c.y + c.h), c.y - (a.y + a.h));
      const gap = a.red && c.red ? Math.hypot(a.x + a.w / 2 - c.x - c.w / 2, a.y + a.h / 2 - c.y - c.h / 2) - (a.w + c.w) / 4 - (a.h + c.h) / 4 : Math.max(gx, gy);
      if (gap < 6) fallas.solape.push(`${w}×${h} ${n}: ${a.s} y ${c.s} (${gap < 0 ? 'encimados ' + (-gap).toFixed(0) : 'a ' + gap.toFixed(0)} px)`);
    }
    for (const a of L) {
      if (a.x < 0 || a.y < 0 || a.x + a.w > M.W + 0.5 || a.y + a.h > M.H + 0.5) fallas.afuera.push(`${w}×${h} ${n}: ${a.s}`);
      const min = FREC.includes(a.s) ? 44 : 32; if (Math.min(a.w, a.h) < min - 0.5) fallas.chico.push(`${w}×${h} ${n}: ${a.s} ${a.w.toFixed(0)} px (mín ${min})`);
      // (la zona de la palanca: el tercio izquierdo de abajo, del 45 % al 92 % de la altura)
      if (n !== 'auto' && n !== 'heli' && a.x < M.W * 0.33 && a.y + a.h > M.H * 0.45 && a.y < M.H * 0.92 && a.x + a.w > 0) fallas.palanca.push(`${w}×${h} ${n}: ${a.s}`);
    }
    if (w === 873) { await p.screenshot({ path: `${D}hud_${n}.jpg`, type: 'jpeg', quality: 80 }); if (process.env.VOLCAR) console.log('VIS', n, JSON.stringify(L.map((a) => [a.s, Math.round(a.x + a.w / 2), Math.round(a.y + a.h / 2), Math.round(a.w)]))); }
  }
}
const lim = (L) => L.slice(0, 14);
ok('ningún botón visible se encima ni queda a menos de 6 px de otro', !fallas.solape.length, { n: fallas.solape.length, ej: lim(fallas.solape) });
ok('ninguno se sale de la pantalla', !fallas.afuera.length, { n: fallas.afuera.length, ej: lim(fallas.afuera) });
ok('los de uso frecuente miden ≥ 44 px y los demás ≥ 32 px', !fallas.chico.length, { n: fallas.chico.length, ej: lim(fallas.chico) });
ok('la zona de la palanca (abajo a la izquierda) queda libre de botones a pie', !fallas.palanca.length, { n: fallas.palanca.length, ej: lim(fallas.palanca) });
// en el auto: un toque en la izquierda no saca la palanca de caminar
await p.setViewportSize({ width: 873, height: 393 }); await p.waitForTimeout(300); await ev(ESTADOS.auto); await p.waitForTimeout(300);
const pal = await ev(`(() => { const z = $('toque'); const t = new Touch({ identifier: 7, target: z, clientX: 120, clientY: 300 });
  z.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], cancelable: true, bubbles: true }));
  const r = { activa: $('palanca').classList.contains('activa'), vehiculo: !!JUG.vehiculo };
  z.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], cancelable: true, bubbles: true })); return r; })()`);
ok('en el auto, tocar a la izquierda no saca la palanca de caminar', pal.vehiculo && !pal.activa, pal);
const tipoHeli = await ev(ESTADOS.heli); await p.waitForTimeout(300);
const palH = await ev(`(() => { const z = $('toque'); const t = new Touch({ identifier: 8, target: z, clientX: 120, clientY: 300 });
  z.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], cancelable: true, bubbles: true }));
  const r = { activa: $('palanca').classList.contains('activa'), tipo: JUG.vehiculo && JUG.vehiculo.veh.tipo, subir: !$('bsaltar').classList.contains('oc'), bajar: !$('bagachar').classList.contains('oc'), flechas: !$('bizq').classList.contains('oc') };
  z.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], cancelable: true, bubbles: true })); return r; })()`);
ok('en el helicóptero sí hay palanca (inclinar y girar) y botones de subir y bajar, sin las flechas del auto', palH.tipo === 'heli' && palH.activa && palH.subir && palH.bajar && !palH.flechas, { tipoHeli, ...palH });
const e2 = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:/i.test(x));
ok('sin errores de JS', !e2.length, e2.slice(0, 5));
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
