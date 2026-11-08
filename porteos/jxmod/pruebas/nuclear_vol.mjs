// La nuclear con volumen (Discord, noviembre de 2026: «las bombas nucleares deben ser como el vídeo y faltó el destello
// blanco; agregá al juego esas bombas a todas las existentes con diferentes tamaños, destrucción, etc.»):
//  1. en Medio, Alto y Ultra (WebGL 2) la de superficie va con volumen —contra la misma vista sin bomba, cambia ≥ 3 % de
//     la pantalla (más de 20 de 255)— y sin errores de WebGL; en Bajo y Patata, los carteles de siempre
//  2. las 117 bombas: los tipos que hacen hongo (en el aire, torre, superficie, agua, barco...) van con volumen; la
//     subterránea y la del espacio, con carteles; el hongo escala con la bomba (el alto final sobre el radio, igual en
//     todas ±1 %) y la destrucción también (alcance 2,3 radios), de 10 t a 100 Mt
//  3. el destello blanco: de cerca y mirándola ≥ 0,95 al instante (la captura casi blanca: brillo ≥ 235); a 40 radios
//     ≥ 0,4 (antes, nada más allá de 7 radios); de espaldas, menos pero algo; la subterránea, nada; a los 3 s, < 0,03
//  4. lo que está delante la tapa: un contenedor entre la cámara y el hongo se ve igual que sin la bomba (≤ 6 de 255), y el
//     hongo sí cambia la imagen (≥ 3 % de la pantalla)
//  5. costo (en esta compu, esperando a la placa; contra la pasada del cielo): de lejos ≤ 1,5; de cerca (tapa ~40 %)
//     ≤ 2,6 en Medio y Alto y ≤ 4 en Ultra
//  6. el ruido 3D se arma de a poco: ningún tramo de más de 15 ms en esta compu (de a filas: no traba el juego)
//  7. sin errores de JS
// uso: node nuclear_vol.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const [, , HTML, D] = process.argv;
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(HTML, false);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.resDin = false; aplicarGfx(); inicioMostrar(false); empezarPartida('Desert'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && JUG.suelo`), null, { timeout: 120000 });
// (sin la grieta del evento: se anima y cambiaría la imagen entre una foto y la otra)
await ev(`(() => { EVT.prox = 1e9; PREFS.evento = false; JUEGO.dios = true; DIA.hora = 13; diaAplicar(); nvPreparar(); return 1; })()`);
const listo = () => p.waitForFunction(() => window.__ev(`!!(NUKV.tex && nvCalidad() && nvProg(nvCalidad()) && nvComp(R.salida === 'hdr' ? 2 : 1))`), null, { timeout: 240000, polling: 500 });
await listo();
const espera = (s) => ev(`new Promise((ok) => { const t0 = TIEMPO.t, r0 = performance.now(); const f = () => (TIEMPO.t >= t0 + ${s} || performance.now() - r0 > 30000 ? ok(1) : setTimeout(f, 20)); f(); })`);
// (una bomba de superficie de 4 Mt —la del tráiler— a una distancia, ya con el hongo armado y sin el destello)
const poner = (dist, t = 8, nombre = 'NK_navajo', tipo = 'suelo', R = 260) => ev(`(() => { NUK.vivas.length = 0; LUCES_T.length = 0; const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw));
  const E = nukeExplotar(vadd(JUG.pos, vscale(f, ${dist})), '${nombre}', false); if ('${tipo}') E.tipo = '${tipo}'; if (${R}) { E.R = ${R}; E.alc = E.R * 2.3; } if (!/^(aire|bomba|misil|ficcion)$/.test(E.tipo)) E.p.y = E.piso + 1;
  E.t = ${t}; E.onda = E.alc; E.jug = true; E.son = true; NUK.flash = 0; LUCES_T.length = 0; JUG.pitch = -0.2; window.__E = E; return 1; })()`);
// diferencia media (0..255) entre dos capturas en un rectángulo (en fracciones de la pantalla)
const difer = (a, c, r) => p.evaluate(async ([a, c, r]) => {
  const im = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const x = cv.getContext('2d'); x.drawImage(i, 0, 0);
    const X = Math.floor(r[0] * i.width), Y = Math.floor((1 - r[3]) * i.height), W = Math.max(1, Math.floor((r[2] - r[0]) * i.width)), H = Math.max(1, Math.floor((r[3] - r[1]) * i.height)); return x.getImageData(X, Y, W, H).data; };
  const A = await im(a), B = await im(c); let s = 0, n = 0; for (let i = 0; i < A.length; i += 4) { const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3; s += d; if (d > 20) n++; }
  return { media: s / (A.length / 4), frac: n / (A.length / 4) };
}, [a, c, r]);
const brillo = (a) => p.evaluate(async (a) => { const i = new Image(); i.src = 'data:image/png;base64,' + a; await i.decode(); const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90; const x = cv.getContext('2d'); x.drawImage(i, 0, 0, 160, 90);
  const d = x.getImageData(0, 0, 160, 90).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; return s / (d.length / 4); }, a);
const foto = async (n) => (await p.screenshot(D ? { path: D + '/' + n + '.png' } : {})).toString('base64');

// ---------------- 1. con volumen en Medio, Alto y Ultra; carteles en Bajo y Patata ----------------
const c1 = {};
for (const cal of ['medio', 'alto', 'ultra', 'bajo', 'patata']) {
  await ev(`(() => { PREFS.gfx = '${cal}'; aplicarGfx(); nvPreparar(); return 1; })()`);
  if (['medio', 'alto', 'ultra'].includes(cal)) await listo();
  await poner(900); await espera(0.6);
  const con = await foto('vol_' + cal), st = await ev(`({ vol: !!window.__E.vol, rc: NUKV.rc, razon: NUKV.razon, glErr: R.gl.getError(), carteles: (() => { const L = []; nukeCarteles(window.__E, L); return L.length / 9; })() })`);
  await ev(`(() => { window.__Eg = NUK.vivas.splice(0); return 1; })()`); await espera(0.3);
  const sin = await foto('vol_' + cal + '_sin'); await ev(`(() => { NUK.vivas.push(...window.__Eg); return 1; })()`);
  const dd = await difer(con, sin, [0, 0, 1, 1]);
  c1[cal] = { vol: st.vol, glErr: st.glErr, carteles: st.carteles, cambia: +dd.frac.toFixed(3), razon: st.razon };
}
const vol3 = ['medio', 'alto', 'ultra'].every((k) => c1[k].vol && c1[k].cambia >= 0.03 && c1[k].glErr === 0), cart2 = ['bajo', 'patata'].every((k) => !c1[k].vol && c1[k].carteles > 20 && c1[k].cambia >= 0.03);
ok('1. con volumen en Medio, Alto y Ultra (cambia ≥ 3 % de la pantalla contra sin bomba, sin errores de WebGL); en Bajo y Patata, carteles', vol3 && cart2, c1);

// ---------------- 2. las 117 bombas: tipo, escala y destrucción ----------------
await ev(`(() => { PREFS.gfx = 'alto'; aplicarGfx(); return 1; })()`); await listo();
const c2 = await ev(`(() => {
  const L = DATA.menu.find((c) => c.n === 'Props').sub.find((s) => s.n === 'Nucleares').it.map((n) => [n, nukeDe(n)]);
  const tipos = {}, ratio = [], malos = []; let rmin = 1e9, rmax = 0, kmin = 1e9, kmax = 0;
  for (const [n, nk] of L) {
    const R = nukeRadio(nk.kt), E = { R, tipo: nk.t, t: 120, dura: 150, p: v3(0, 10 + R * 0.45, 0), piso: 10, seed: 977 };
    rmin = Math.min(rmin, R); rmax = Math.max(rmax, R); kmin = Math.min(kmin, nk.kt); kmax = Math.max(kmax, nk.kt);
    tipos[nk.t] = (tipos[nk.t] || 0) + 1;
    if (!NV_TIPOS[nk.t]) continue;
    const S = nvEstado(E), todos = [...S.cap, ...S.tallo, ...S.falda, ...S.fuegoV, ...S.dens, ...S.caja];
    if (todos.some((x) => !isFinite(x))) malos.push(n);
    if (!nvAire(nk.t)) ratio.push(S.H * S.s / R);
  }
  const mn = Math.min(...ratio), mx = Math.max(...ratio);
  return { n: L.length, tipos, malos, rmin, rmax, kt: [kmin, kmax], ratioH: [+mn.toFixed(4), +mx.toFixed(4)], alc: +(nukeRadio(1000) * 2.3).toFixed(1) };
})()`);
// (una de cada tipo, explotando a la vista: ¿va con volumen la que hace hongo?)
const porTipo = {};
for (const [tipo, nombre] of Object.entries(await ev(`(() => { const o = {}; for (const n of DATA.menu.find((c) => c.n === 'Props').sub.find((s) => s.n === 'Nucleares').it) { const nk = nukeDe(n); if (!o[nk.t]) o[nk.t] = n; } return o; })()`))) {
  await poner(700, 6, nombre, '', 0); await espera(0.4);
  porTipo[tipo] = await ev(`({ vol: !!window.__E.vol, R: Math.round(window.__E.R) })`);
}
const tiposOk = Object.entries(porTipo).every(([t, x]) => x.vol === !['subte', 'espacio'].includes(t));
ok('2. las 117 bombas: las que hacen hongo con volumen y la subterránea y la del espacio con carteles; el hongo y la destrucción escalan con la bomba (alto / radio igual en todas ±1 %), de 10 t a 100 Mt',
  c2.n >= 100 && !c2.malos.length && tiposOk && c2.ratioH[1] / c2.ratioH[0] <= 1.01 && c2.kt[0] <= 0.011 && c2.kt[1] >= 100000, { ...c2, porTipo });

// ---------------- 3. el destello blanco ----------------
const flash = async (dist, mira, nombre = 'NK_navajo', tipo = 'suelo') => {
  await ev(`(() => { NUK.vivas.length = 0; NUK.flash = 0; const ff = $('nukFlash'); if (ff) ff.style.display = 'none'; JUG.pitch = 0; const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw)); const q = vadd(JUG.pos, vscale(f, ${mira} * ${dist}));
    const E = nukeExplotar(q, '${nombre}', false); if ('${tipo}') E.tipo = '${tipo}'; window.__I = NUK.flash || 0; return 1; })()`);
  return ev(`window.__I`);
};
const fCerca = await flash(4 * 260, 1);
const fotoFlash = await foto('destello');
const fLejos = await flash(40 * 260, 1), fEspalda = await flash(4 * 260, -1), fSubte = await flash(4 * 260, 1, 'NK_sedan', 'subte');
await flash(4 * 260, 1); await espera(3);
const fFin = await ev(`NUK.flash || 0`), bri = await brillo(fotoFlash);
const c3 = { cerca: +fCerca.toFixed(2), lejos40R: +fLejos.toFixed(2), espaldas: +fEspalda.toFixed(2), subte: fSubte, a3s: +fFin.toFixed(3), brilloCaptura: Math.round(bri) };
ok('3. el destello blanco: de cerca ≥ 0,95 (captura ≥ 235), a 40 radios ≥ 0,4, de espaldas algo menos, la subterránea nada, a los 3 s < 0,03',
  fCerca >= 0.95 && bri >= 235 && fLejos >= 0.4 && fEspalda > 0 && fEspalda < fCerca && fSubte === 0 && fFin < 0.03, c3);

// ---------------- 4. lo de adelante la tapa ----------------
await ev(`(() => { NUK.vivas.length = 0; NUK.flash = 0; const ff = $('nukFlash'); if (ff) ff.style.display = 'none'; JUG.pitch = -0.2; const f = v3(Math.sin(JUG.yaw), 0, Math.cos(JUG.yaw));
  window.__cont = crearObjeto('Contenedor', vadd(JUG.pos, vadd(vscale(f, 9), v3(0, 0.5, 0))), Quat.axis(0, 1, 0, JUG.yaw), {}); if (window.__cont) window.__cont.b.frozen = true; return 1; })()`);
await espera(1.5);
await poner(900); await espera(0.6);
const cont = await ev(`(() => { const o = window.__cont; if (!o) return null; const v = R.vpMundo, c = o.b.pos, x = v[0] * c.x + v[4] * c.y + v[8] * c.z + v[12], y = v[1] * c.x + v[5] * c.y + v[9] * c.z + v[13], w = v[3] * c.x + v[7] * c.y + v[11] * c.z + v[15];
  return { x: x / w * 0.5 + 0.5, y: y / w * 0.5 + 0.5, vol: !!window.__E.vol, rc: NUKV.rc }; })()`);
const conB = await foto('tapa_con');
await ev(`(() => { window.__Eg = NUK.vivas.splice(0); return 1; })()`); await espera(0.3);
const sinB = await foto('tapa_sin'); await ev(`(() => { NUK.vivas.push(...window.__Eg); return 1; })()`);
const caja = cont ? [cont.x - 0.03, cont.y - 0.03, cont.x + 0.03, cont.y + 0.03] : [0.47, 0.47, 0.53, 0.53];
const d4 = cont ? +(await difer(conB, sinB, caja)).media.toFixed(2) : null, dHongo = +(await difer(conB, sinB, [0, 0, 1, 1])).frac.toFixed(3);
ok('4. un contenedor delante del hongo se ve igual que sin la bomba (≤ 6 de 255; el hongo sí cambia ≥ 3 % de la pantalla)', cont && cont.vol && d4 <= 6 && dHongo >= 0.03, { contenedor: d4, hongo: dHongo, en: cont && [+cont.x.toFixed(2), +cont.y.toFixed(2)] });
await ev(`(() => { if (window.__cont) borrarObjeto(window.__cont, true); return 1; })()`);

// ---------------- 5. el costo ----------------
const c5 = {};
for (const cal of ['medio', 'alto', 'ultra']) {
  await ev(`(() => { PREFS.gfx = '${cal}'; aplicarGfx(); return 1; })()`); await listo();
  for (const [nom, dist] of [['lejos', 1600], ['cerca', 520]]) {
    await poner(dist); await espera(0.5);
    c5[cal + '_' + nom] = await ev(`(() => { const gl = R.gl, E = window.__E; E.t = 8;
      const px1 = new Uint8Array(4), pxF = new Float32Array(4), fbE = R.usaPost ? PO.fb : null, W = R.usaPost ? PO.w : R.cv.width, H = R.usaPost ? PO.h : R.cv.height;
      const espera = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, fbE); if (R.salida === 'hdr') gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pxF); else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); };
      const IVP = M4.inv(R.vp), N = 8, t = { cielo: 0, hongo: 0 };
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbE); gl.viewport(0, 0, W, H); espera();
      for (let k = 0; k < 3; k++) {
        let a = performance.now(); for (let i = 0; i < N; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbE); gl.viewport(0, 0, W, H); dibujarCielo(IVP); } espera(); t.cielo += performance.now() - a;
        a = performance.now(); for (let i = 0; i < N; i++) nvDibujar(); espera(); t.hongo += performance.now() - a;
      }
      return { k: +(t.hongo / t.cielo).toFixed(2), hongoMs: +(t.hongo / (3 * N)).toFixed(2), cieloMs: +(t.cielo / (3 * N)).toFixed(2), buf: NUKV.w + 'x' + NUKV.h, vol: !!E.vol }; })()`);
  }
}
const k5 = Object.entries(c5).every(([n, x]) => x.vol && x.k <= (/lejos/.test(n) ? 1.5 : /ultra/.test(n) ? 4 : 2.6));
ok('5. costo contra el cielo: de lejos ≤ 1,5; de cerca ≤ 2,6 en Medio y Alto y ≤ 4 en Ultra', k5, c5);

// ---------------- 6. el ruido se arma de a poco ----------------
const c6 = await ev(`({ tramoMaxMs: +(NUKV.tramoMax || 0).toFixed(1), totalMs: Math.round(NUKV.msRuido || 0) })`);
ok('6. el ruido 3D se arma de a poco (ningún tramo de más de 15 ms)', c6.tramoMaxMs > 0 && c6.tramoMaxMs <= 15, c6);
// ---------------- 7. errores ----------------
const js = err.filter((x) => !/broker|mqtt|tienda|CORS|ERR_FAILED|Failed to load|net::|willRead/i.test(x));
ok('7. sin errores de JS', !js.length, js.slice(0, 4));
await b.close();
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
