// ¿Los personajes se ven igual con la subida de huesos nueva? (prueba16: se manda sólo la parte de la paleta que usa
// cada malla, una vez por pasada, y los vectores sueltos con uniform3f/4f). El mismo instante del juego (gm_construct,
// Alto, sombras medias, 8 personajes cerca de la cámara, quietos y caminando) se dibuja dos veces: con el código de
// antes (puesto otra vez en la página) y con el de ahora, sin mover nada entre las dos. En las calidades pedidas:
//  1. la imagen es idéntica (diferencia máxima ≤ 2 de 255 en ≥ 99,9 % de los píxeles);
//  2. hay personajes en la imagen (la prueba mira algo: ≥ 2 % de los píxeles cambian si se esconden);
//  3. sin errores de JS.
// uso: node huesos_igual.mjs URL_HTML [calidades=alto,medio,bajo] [CARPETA_FOTOS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CALS = 'alto,medio,bajo', D = ''] = process.argv; if (D) fs.mkdirSync(D, { recursive: true });
const R0 = []; const ok = (n, c, d) => { R0.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const { b, p, err, ev } = await abrir(HTML, true);
const VIEJO = `window.__nuevo = { uniV, geomDibujar, uNv };
  window.__viejo = {
    uniV: function (u, k, v, n) { const c = u.__v || (u.__v = {}); if (c[k] === v) return; c[k] = v; const gl = R.gl; if (n === 4) gl.uniform4fv(u[k], v); else if (n === 3) gl.uniform3fv(u[k], v); else gl.uniformMatrix4fv(u[k], false, v); },
    uNv: function (P, loc, v, n, t) { if (!loc || !_uval(P, loc, v, n)) return; const gl = R.gl; if (t === 16) gl.uniformMatrix4fv(loc, false, v); else if (t === 4) gl.uniform4fv(loc, v); else if (t === 3) gl.uniform3fv(loc, v); else if (t === 2) gl.uniform2fv(loc, v); else gl.uniform1fv(loc, v); },
    geomDibujar: function (p, u) {
      const gl = R.gl, d = p.m.d; const cv = u.__v || (u.__v = {});
      if (p.h && R.cpuSkin) { const c = pielCPU(p); if (cv.q !== 1) { cv.q = 1; gl.uniform3f(u.uQ0, 0, 0, 0); gl.uniform3f(u.uQ1, 1, 1, 1); } if (R.vaoAct !== c.vao) { gl.bindVertexArray(c.vao); R.vaoAct = c.vao; } }
      else { if (cv.q !== d) { cv.q = d; gl.uniform3f(u.uQ0, d.mn[0], d.mn[1], d.mn[2]); gl.uniform3f(u.uQ1, d.sc[0], d.sc[1], d.sc[2]); } if (p.h) gl.uniform4fv(u.uB, R.nHuesos < 168 ? sub(p.h, R.nHuesos * 4) : p.h); if (R.vaoAct !== p.m.vao) { gl.bindVertexArray(p.m.vao); R.vaoAct = p.m.vao; } }
      if (p.h && R.cpuSkin) { cv.uM = null; gl.uniformMatrix4fv(u.uM, false, p.M); } else uniV(u, 'uM', p.M, 16);
      gl.drawElements(gl.TRIANGLES, p.sn, p.m.it, p.s0 * p.m.isz);
    } };
  window.__poner = (k) => { const F = k === 'viejo' ? __viejo : __nuevo; uniV = F.uniV; geomDibujar = F.geomDibujar; uNv = F.uNv; };
  1`;
const px = (buf) => p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return Array.from(g.getImageData(0, 0, c.width, c.height).data); }, buf.toString('base64'));
const dif = (X, Y) => { let mal = 0, mx = 0, n = X.length / 4; for (let i = 0; i < X.length; i += 4) { const d = Math.max(Math.abs(X[i] - Y[i]), Math.abs(X[i + 1] - Y[i + 1]), Math.abs(X[i + 2] - Y[i + 2])); if (d > mx) mx = d; if (d > 2) mal++; } return { malPct: +(100 * mal / n).toFixed(3), max: mx }; };
const res = [];
for (const cal of CALS.split(',')) {
  await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = '${cal}'; PREFS.sombras = '1'; PREFS.resDin = false; const p = PERFILES[PREFS.gfx]; PREFS.res = p.res; PREFS.lejos = p.lejos; aplicarGfx(); if (JUEGO.estado !== 'juego') { inicioMostrar(false); empezarPartida('RB_Construct'); } 1`);
  await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
  // (hacia donde haya lugar: el primer rumbo sin pared en 10 m)
  await ev(`(() => { cerrarPaneles(); for (const P of NPC.lista.slice()) npcQuitar(P); JUG.noclip = true; JUG.pos.set(3.42, -2.72, 24.14); JUG.vel.set(0, 0, 0); DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar();
    let yaw = 0; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; if (!mundoRayo(v3(JUG.pos.x, JUG.pos.y + 0.5, JUG.pos.z), v3(Math.sin(a), 0, Math.cos(a)), 10)) { yaw = a; break; } }
    JUG.yaw = yaw; JUG.pitch = 0.15;
    const sk = ['Hero', 'Soldier', 'Hero', 'Soldier', 'Hero', 'Soldier', 'Hero', 'Soldier'], em = [];   // (sin bailes: los emotes avanzan con el reloj de verdad aunque el juego esté quieto y la foto de control cambiaría)
    for (let k = 0; k < 8; k++) { const a = JUG.yaw - 0.6 + k * 0.17, d = 4 + (k % 3) * 1.6, x = JUG.pos.x + Math.sin(a) * d, z = JUG.pos.z + Math.cos(a) * d; const h = raycast(v3(x, JUG.pos.y + 10, z), v3(0, -1, 0), 30); const y = h ? JUG.pos.y + 10 - h.t : JUG.pos.y;
      const P = npcCrear(sk[k], v3(x, y + 0.95, z), Math.PI + a, { modo: k % 2 ? 'pasear' : 'quieto', vel: 1.4, vida: 100 }); if (P && em[k]) P.emote = em[k]; }
    return NPC.lista.length; })()`);
  await p.waitForTimeout(2500);
  // (quieto: sin cuadros nuevos; se dibuja a mano el mismo instante)
  await ev(`window.__rafG = window.__rafG || requestAnimationFrame; window.requestAnimationFrame = () => 0; ${VIEJO}`);
  await p.waitForTimeout(300);
  // (se lee el lienzo apenas dibujado —readPixels—: sin los botones y carteles de la página encima)
  // (con el paso de tiempo en 0: la caminata y la respiración avanzan con TIEMPO.dt en cada dibujo, aunque el juego esté quieto)
  // (y sin animar: la pose de cada uno queda como está —animarPersona no hace nada mientras tanto—)
  const foto = async (k, slot) => ev(`(() => { window.__dt0 = window.__dt0 === undefined ? TIEMPO.dt : __dt0; TIEMPO.dt = 0; for (const P of PERS) P.dtJunto = 0; if (!window.__animO) { window.__animO = animarPersona; animarPersona = () => {}; } __poner('${k}'); R.marca++; dibujar(); const gl = R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; gl.bindFramebuffer(gl.FRAMEBUFFER, null); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); (window.__f || (window.__f = {}))['${slot}'] = { px, w, h }; return 1; })()`);
  const difP = (a, c) => ev(`(() => { const X = __f['${a}'].px, Y = __f['${c}'].px; let mal = 0, mx = 0; const n = X.length / 4; for (let i = 0; i < X.length; i += 4) { const d = Math.max(Math.abs(X[i] - Y[i]), Math.abs(X[i + 1] - Y[i + 1]), Math.abs(X[i + 2] - Y[i + 2])); if (d > mx) mx = d; if (d > 2) mal++; } return { malPct: +(100 * mal / n).toFixed(3), max: mx }; })()`);
  // (varios dibujos antes, para que la animación gaste el tiempo que le quedaba juntado del último cuadro: después queda quieta)
  // (en Medio y Bajo los de lejos se animan cada 2 a 4 dibujos: 8 para que todos gasten lo suyo)
  for (let i = 0; i < 8; i++) await foto('nuevo', 'X');
  await foto('nuevo', 'N'); await foto('viejo', 'V'); await foto('nuevo', 'N2');
  await ev(`window.__sacados = NPC.lista.slice(); for (const P of __sacados) PERS.splice(PERS.indexOf(P), 1); 1`); await foto('nuevo', 'S'); await ev(`for (const P of __sacados) PERS.push(P); 1`);
  if (D) await ev(`(() => { const A = __f.N, B = __f.N2, px = new Uint8Array(A.px.length); for (let i = 0; i < px.length; i += 4) { const d = Math.max(Math.abs(A.px[i] - B.px[i]), Math.abs(A.px[i + 1] - B.px[i + 1]), Math.abs(A.px[i + 2] - B.px[i + 2])); px[i] = d > 2 ? 255 : A.px[i] >> 2; px[i + 1] = A.px[i + 1] >> 2; px[i + 2] = A.px[i + 2] >> 2; px[i + 3] = 255; } __f.D = { px, w: A.w, h: A.h }; return 1; })()`);
  if (D) for (const k of ['N', 'V', 'S', 'D']) { const b64 = await ev(`(() => { const F = __f['${k}'], c = document.createElement('canvas'); c.width = F.w; c.height = F.h; const g = c.getContext('2d'), im = g.createImageData(F.w, F.h); for (let y = 0; y < F.h; y++) im.data.set(F.px.subarray((F.h - 1 - y) * F.w * 4, (F.h - y) * F.w * 4), y * F.w * 4); g.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1]; })()`); fs.writeFileSync(`${D}/${cal}_${k}.png`, Buffer.from(b64, 'base64')); }
  const nv = await difP('N', 'V'), nn = await difP('N', 'N2'), ns = await difP('N', 'S');
  res.push({ cal, nuevoVsViejo: nv, nuevoVsNuevo: nn, conVsSin: ns });
  await ev(`__poner('nuevo'); if (window.__animO) { animarPersona = __animO; window.__animO = null; } if (window.__dt0 !== undefined) { TIEMPO.dt = __dt0; window.__dt0 = undefined; } window.requestAnimationFrame = __rafG; requestAnimationFrame((t) => cuadro(t)); 1`);
}
ok('1. los personajes se dibujan igual con la subida de huesos nueva (≥ 99,9 % de los píxeles a ≤ 2)', res.every((r) => r.nuevoVsViejo.malPct <= 0.1), res.map((r) => [r.cal, r.nuevoVsViejo, 'control', r.nuevoVsNuevo]));
ok('2. hay personajes en la imagen (escondiéndolos cambia ≥ 2 %)', res.every((r) => r.conVsSin.malPct >= 2), res.map((r) => [r.cal, r.conVsSin.malPct]));
const e = err.filter((x) => !/WebSocket|net::|Failed to load|404|favicon|shader simplificado|willReadFrequently|\[GMod\]/i.test(x));
ok('3. sin errores de JS', !e.length, e.slice(0, 4));
await b.close();
console.log('RESUMEN ' + R0.filter(Boolean).length + '/' + R0.length);
process.exit(R0.every(Boolean) ? 0 : 1);
