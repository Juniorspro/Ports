// ¿Qué cuesta un cuadro? La escena de la comparación de FPS (gm_construct, props, 6 personajes caminando, la cámara dando
// la vuelta) en la calidad pedida y con la resolución fija; de cada cuadro: el JavaScript (total y por parte) y lo que se
// le manda a la GPU (pasadas con su tamaño, dibujos, triángulos, pasadas de pantalla completa, shaders usados, subidas de
// texturas). Los shaders de fragmentos usados se guardan en CARPETA para revisarlos.
// uso: node perfil_cuadro.mjs URL_HTML [calidad=alto] [CARPETA=/tmp/claude-0/perfil] [segundos=8]
// VACIO=1: mientras se mide, los dibujos no llegan a la GPU de prueba (SwiftShader dibuja con el procesador y taparía el
// JavaScript): se cuenta lo que se le pide a la GPU, pero el tiempo es sólo el del juego. FRENO=N: el procesador N veces
// más lento (el de un celular: un Cortex-A53 a 1,4 GHz —Snapdragon 425, MT6739, Unisoc SC9832E— es unas 12 veces más
// lento que esta máquina en JavaScript)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CAL = 'alto', D = '/tmp/claude-0/perfil', SEG = '8'] = process.argv; fs.mkdirSync(D, { recursive: true });
const ESPIA = () => {
  // (WebGL 1 y WebGL 2 son prototipos aparte: se espían los dos)
  const PS = [WebGLRenderingContext.prototype].concat(typeof WebGL2RenderingContext !== 'undefined' ? [WebGL2RenderingContext.prototype] : []);
  const E = window.__gpu = { on: false, cuadros: [], c: null, progs: new Map(), nid: 0 };
  const nuevo = () => ({ pasadas: [], subidas: 0, bytesSubidos: 0, clears: 0, inval: 0, ll: {}, blitMB: 0 }); E.c = nuevo();
  // (cuántas llamadas a WebGL por cuadro y de qué tipo: cada una cuesta CPU en el celu)
  for (const P of PS) for (const n of Object.getOwnPropertyNames(P)) { let d; try { d = Object.getOwnPropertyDescriptor(P, n); } catch (e) { continue; } if (!d || typeof d.value !== 'function' || n === 'constructor') continue; const o = d.value; P[n] = function (...a) { if (E.on) E.c.ll[n] = (E.c.ll[n] || 0) + 1; return o.apply(this, a); }; }
  // (en las GPU de celu —por mosaicos, como las Mali— cada pasada (de un cambio de búfer al otro) trae de la memoria lo que
  // había, salvo que empiece borrándolo entero o descartándolo, y al terminar guarda todo, salvo lo descartado. Con el
  // formato de cada textura o búfer se cuentan esos bytes: «memoria» de cada pasada = traído + guardado)
  let fb = 0, fbObj = null, fbLee = null, vw = 0, vh = 0, prog = null, blend = false, cmask = true, pasada = null, inicio = 0, tijera = false, sc = [0, 0, 0, 0], texAct = null, rbAct = null;
  const id = (o) => o ? (o.__id || (o.__id = ++E.nid)) : 0;
  const w = (n, f, siempre) => { for (const P of PS) { const o = P[n]; if (!o) continue; P[n] = function (...a) { if (E.on || siempre) try { f.apply(this, a); } catch (e) { } return o.apply(this, a); }; } };
  const BPP = { 0x881A: 8, 0x8D62: 8, 0x8C3A: 4, 0x8058: 4, 0x1908: 4, 0x1907: 4, 0x8229: 1, 0x81A6: 4, 0x81A5: 2, 0x1902: 4, 0x88F0: 4, 0x8CAC: 4, 0x8814: 16, 0x822F: 4 };
  w('bindTexture', (t, x) => { if (t === 0x0DE1) texAct = x; }, true);
  w('texImage2D', (t, l, f, a, b, c, d, ty) => { if (t === 0x0DE1 && l === 0 && texAct && typeof a === 'number') { let bpp = BPP[f] || 4; if ((f === 0x1908 || f === 0x1907) && (ty === 0x8D61 || ty === 0x140B)) bpp = 8; texAct.__bpp = bpp; texAct.__w = a; texAct.__h = b; } }, true);
  w('texStorage2D', (t, l, f, a, b) => { if (t === 0x0DE1 && texAct) { texAct.__bpp = BPP[f] || 4; texAct.__w = a; texAct.__h = b; } }, true);
  w('bindRenderbuffer', (t, r) => { rbAct = r; }, true);
  w('renderbufferStorage', (t, f, a, b) => { if (rbAct) { rbAct.__bpp = BPP[f] || 4; rbAct.__w = a; rbAct.__h = b; } }, true);
  w('framebufferTexture2D', (t, at, tt, x) => { if (!fbObj || !x) return; if (at === 0x8D00) fbObj.__d = x; else if (at === 0x8CE0) fbObj.__c = x; }, true);
  w('framebufferRenderbuffer', (t, at, rt, x) => { if (!fbObj || !x) return; if (at === 0x8D00) fbObj.__d = x; else if (at === 0x8CE0) fbObj.__c = x; }, true);
  const cerrar = () => { pasada = null; inicio = 0; };
  w('bindFramebuffer', (t, f) => { if (t === 0x8CA8 || t === 0x8D40) fbLee = f || null; if (t === 0x8D40 || t === 0x8CA9) { if (f !== fbObj) cerrar(); fbObj = f || null; fb = id(f); } }, true);
  w('scissor', (x, y, a, b) => { sc = [x, y, a, b]; }, true);
  // (copiar con blit: se lee el rectángulo de origen y se escribe el de destino)
  w('blitFramebuffer', (a0, b0, a1, b1, c0, d0, c1, d1, m) => { const bpp = (o) => (o && (m & 0x100 ? o.__d : o.__c) && (m & 0x100 ? o.__d : o.__c).__bpp) || 4; E.c.blitMB += (Math.abs((a1 - a0) * (b1 - b0)) * bpp(fbLee) + Math.abs((c1 - c0) * (d1 - d0)) * bpp(fbObj)) / 1e6; });
  w('viewport', (x, y, a, b) => { vw = a; vh = b; });
  w('useProgram', (p) => { prog = p; });
  w('enable', (c) => { if (c === 0x0BE2) blend = true; if (c === 0x0C11) tijera = true; }, true); w('disable', (c) => { if (c === 0x0BE2) blend = false; if (c === 0x0C11) tijera = false; }, true);
  w('colorMask', (r) => { cmask = !!r; });
  // (inicio: 1 = color borrado o descartado, 2 = profundidad; un borrado con tijera no cuenta: queda lo de afuera)
  w('clear', (m) => { E.c.clears++; if (pasada) zona(); if (!pasada && !tijera) inicio |= (m & 0x4000 ? 1 : 0) | (m & 0x100 ? 2 : 0); });
  const bits = (at) => at.reduce((a, x) => a | (x === 0x8CE0 || x === 0x1800 ? 1 : x === 0x8D00 || x === 0x1801 || x === 0x821A ? 2 : 0), 0);
  w('invalidateFramebuffer', (t, at) => { E.c.inval++; if (!pasada) inicio |= bits(at); else pasada.fin |= bits(at); });
  const tam = (o) => o ? [o.__w || 0, o.__h || 0, o.__bpp || 4] : null;
  // (lo que toca la pasada: todo, o con tijera sólo la unión de los rectángulos)
  const zona = () => { if (!pasada) return; if (!tijera) { pasada.todo = true; return; } const z = pasada.z; pasada.z = z ? [Math.min(z[0], sc[0]), Math.min(z[1], sc[1]), Math.max(z[2], sc[0] + sc[2]), Math.max(z[3], sc[1] + sc[3])] : [sc[0], sc[1], sc[0] + sc[2], sc[1] + sc[3]]; };
  const dib = (modo, n) => {
    if (!pasada) {
      const c = fbObj ? tam(fbObj.__c) : [vw, vh, 4], d = fbObj ? tam(fbObj.__d) : [vw, vh, 4], wh = c || d || [vw, vh, 4];
      pasada = { fb, w: wh[0], h: wh[1], cB: c ? c[2] : 0, dB: d ? d[2] : 0, dibujos: 0, tris: 0, completas: 0, progs: {}, inicio, fin: 0 }; E.c.pasadas.push(pasada);
    }
    zona();
    const t = modo === 4 ? n / 3 : modo === 5 || modo === 6 ? Math.max(0, n - 2) : 0;
    pasada.dibujos++; pasada.tris += t; if (modo === 4 && n === 3 && prog && prog.__completa) pasada.completas++;
    const k = id(prog); const q = pasada.progs[k] || (pasada.progs[k] = { d: 0, t: 0, mezcla: 0, sinColor: 0 }); q.d++; q.t += t; if (blend) q.mezcla++; if (!cmask) q.sinColor++;
    if (prog && !E.progs.has(k)) E.progs.set(k, { vs: prog.__vs || '', fs: prog.__fs || '' });
  };
  w('drawElements', (m, n) => dib(m, n)); w('drawArrays', (m, f, n) => dib(m, n));
  w('drawElementsInstanced', (m, n, t, o, k) => dib(m, n * k)); w('drawArraysInstanced', (m, f, n, k) => dib(m, n * k));
  // (WebGL 1 dibuja muchas cosas con instancias: ANGLE_instanced_arrays)
  for (const P of PS) { const ge = P.getExtension; P.getExtension = function (n) { const x = ge.call(this, n); if (x && n === 'ANGLE_instanced_arrays' && !x.__esp) { x.__esp = 1; const a = x.drawElementsInstancedANGLE, c = x.drawArraysInstancedANGLE; x.drawElementsInstancedANGLE = function (m, k, t, o, i) { if (E.on) dib(m, k * i); return a.call(this, m, k, t, o, i); }; x.drawArraysInstancedANGLE = function (m, f, k, i) { if (E.on) dib(m, k * i); return c.call(this, m, f, k, i); }; } return x; }; }
  for (const P of PS) { const cs = P.createShader; P.createShader = function (t) { const s = cs.call(this, t); if (s) s.__t = t; return s; }; }
  w('shaderSource', (s, src) => { s.__src = src; }, true);
  w('attachShader', (p, s) => { if (s.__t === 0x8B31) { p.__vs = s.__src; p.__completa = /a_?pos\w*\s*\*\s*0\.5|aP\s*\*\s*0\.5|gl_Position\s*=\s*vec4\s*\(\s*a\w*\s*,\s*0\.0\s*,\s*1\.0\s*\)/.test(s.__src || ''); } else p.__fs = s.__src; }, true);
  w('texImage2D', (...a) => { E.c.subidas++; if (a.length >= 9 && a[8]) E.c.bytesSubidos += a[8].byteLength || 0; else if (a.length === 6 && a[5]) E.c.bytesSubidos += (a[5].width || 0) * (a[5].height || 0) * 4; });
  // (quién sube texturas en cada cuadro: la función que llama, con los bytes)
  const quien = (n) => { if (!E.on) return; const st = (new Error().stack || '').split('\n').slice(2, 6).map((l) => (l.match(/at (\S+)/) || [])[1] || '?').filter((x) => !/^(Object|w|P\.|WebGL)/.test(x)).slice(0, 2).join('<'); E.sub = E.sub || {}; const q = E.sub[st] || (E.sub[st] = { n: 0, kb: 0 }); q.n++; q.kb += n / 1024; };
  w('texImage2D', (...a) => { quien(a.length >= 9 && a[8] ? a[8].byteLength || 0 : a.length === 6 && a[5] ? (a[5].width || 0) * (a[5].height || 0) * 4 : 0); });
  w('texSubImage2D', (...a) => { quien(a.length >= 9 && a[8] ? a[8].byteLength || 0 : a.length === 7 && a[6] ? (a[6].width || 0) * (a[6].height || 0) * 4 : 0); });
  w('texSubImage2D', (...a) => { E.c.subidas++; if (a.length >= 9 && a[8]) E.c.bytesSubidos += a[8].byteLength || 0; });
  const corte = () => { if (E.on) { E.cuadros.push(E.c); E.c = nuevo(); pasada = null; } requestAnimationFrame(corte); }; requestAnimationFrame(corte);
};
const VACIAR = () => {
  const PS = [WebGLRenderingContext.prototype].concat(typeof WebGL2RenderingContext !== 'undefined' ? [WebGL2RenderingContext.prototype] : []);
  for (const P of PS) for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer']) { const o = P[n]; if (o) P[n] = function (...a) { if (window.__vacio) return; return o.apply(this, a); }; }
};
const { b, p, ev } = await abrir(HTML, true, null, async (pg) => { if (process.env.VACIO) await pg.addInitScript(VACIAR); await pg.addInitScript(ESPIA); });
// (VISTA=ANCHOxALTO: el tamaño de la página; con la densidad 2 de base.mjs, 480x240 son 960×480 píxeles. SOMBRAS=0-3)
if (process.env.VISTA) { const [vw, vh] = process.env.VISTA.split('x').map(Number); await p.setViewportSize({ width: vw, height: vh }); await p.waitForTimeout(500); }
const FRENO = +(process.env.FRENO || 1), cdp = FRENO > 1 ? await p.context().newCDPSession(p) : null;
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = ${JSON.stringify(CAL)}; PREFS.sombras = ${JSON.stringify(process.env.SOMBRAS || 'auto')}; PREFS.resDin = false; const p = PERFILES[PREFS.gfx]; PREFS.res = p.res; PREFS.lejos = p.lejos; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2500);
// (POS=x,y,z: el mismo lugar en todas las corridas —la aparición es al azar— para comparar versiones)
if (process.env.POS) { await ev(`(() => { JUG.pos.set(${process.env.POS}); JUG.vel.set(0, 0, 0); return 1; })()`); await p.waitForTimeout(1500); }
await ev(`(() => { cerrarPaneles(); JUG.yaw = 0; JUG.pitch = 0.1; for (let k = 0; k < 6; k++) spawnDelante(['Crate', 'Barrel', 'Crate'][k % 3], {});
  const f = CAM.fwd; for (let k = 0; k < 6; k++) { const d = 4 + k * 2.5, a = (k % 2 ? 1 : -1) * (0.2 + k * 0.05); npcCrear(['Hero', 'Soldier'][k % 2], v3(JUG.pos.x + (f.x * Math.cos(a) - f.z * Math.sin(a)) * d, JUG.pos.y - 0.9, JUG.pos.z + (f.x * Math.sin(a) + f.z * Math.cos(a)) * d), 0, { modo: 'pasear', vel: 1.4, vida: 100 }); }
  DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); return 1; })()`);
await p.waitForTimeout(3000);
// AHORRO=N: el paso del ahorro de GPU (gfxAhorroPaso) puesto a mano. QUIETO=1: la cámara no gira (cuentas parejas)
if (process.env.AHORRO) { await ev(`GFX.ahorro = ${+process.env.AHORRO}; aplicarGfx(true); 1`); await p.waitForTimeout(5000); }
if (process.env.VACIO) await ev(`window.__vacio = true; 1`);
// LENTO=1: el juego se adapta al procesador que no da (TIEMPO.lento; en las pruebas está apagado si no se pide)
if (process.env.LENTO) await ev(`window.__lentoPrueba = true; 1`);
if (cdp) { await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO }); await p.waitForTimeout(process.env.LENTO ? 7000 : 1500); }
// PERFIL_CPU=1: el perfil del procesador mientras se mide (las funciones que más tiempo propio gastan)
const cdpP = process.env.PERFIL_CPU ? (cdp || await p.context().newCDPSession(p)) : null;
if (cdpP) { await cdpP.send('Profiler.enable'); await cdpP.send('Profiler.setSamplingInterval', { interval: 200 }); await cdpP.send('Profiler.start'); }
const r = await ev(`(async () => {
  const partes = 'gmLuaPaso,gmaHUDPaso,personasPaso,npcPaso,physStep,dibujar,dibujarPersonas,animarPersona,armarCola,sombrasActualizar,dibujarOpacos,hudActualizar,efectosPaso,camaraActualizar,jugadorPaso,armasPaso,postAplicar,dibujarAgua,aguaPaso,sonidosPaso,dibujarCielo,nubesDibujar,dibujarTransp,efectosDibujar,reflejoDibujar'.split(',');
  const M = {}, orig = {};
  for (const n of partes) { let f; try { f = eval(n); } catch (e) { continue; } if (typeof f !== 'function') continue; orig[n] = f; M[n] = 0; const w = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { M[n] += performance.now() - t0; } }; eval(n + ' = w'); }
  const c0 = cuadro, L = []; cuadro = function (a) { const t = performance.now(); try { return c0.call(this, a); } finally { L.push(performance.now() - t); } };
  const y0 = JUG.yaw, t0 = performance.now(); let on = true; const giro = () => { if (!on) return; JUG.yaw = y0 + ${process.env.QUIETO ? 0 : 1} * Math.PI * 2 * (performance.now() - t0) / (${+SEG} * 1000); JUG.pitch = 0.1; requestAnimationFrame(giro); }; requestAnimationFrame(giro);
  const smR0 = typeof SM !== 'undefined' ? SM.rehechas : 0;
  window.__gpu.cuadros = []; window.__gpu.on = true;
  await new Promise((ok) => setTimeout(ok, ${+SEG} * 1000));
  window.__gpu.on = false; on = false; cuadro = c0; for (const n of Object.keys(orig)) eval(n + ' = orig[n]');
  const s = (L.length > 4 ? L.slice(2) : L).sort((a, b) => a - b), N = Math.max(1, s.length), prom = s.reduce((a, b) => a + b, 0) / N; if (!s.length) s.push(0);
  const out = {}; for (const n of Object.keys(M)) if (M[n] > 0) out[n] = +(M[n] / N).toFixed(3);
  return { lento: TIEMPO.lento || 0, smRehechasPorCuadro: typeof SM !== 'undefined' ? +((SM.rehechas - smR0) / Math.max(1, L.length)).toFixed(2) : 0, motor: R.gl1 ? 'webgl1' : 'webgl2', pos: [JUG.pos.x, JUG.pos.y, JUG.pos.z].map((v) => +v.toFixed(2)).join(','), cuadros: N, prom: +prom.toFixed(2), p50: +s[Math.floor(N / 2)].toFixed(2), p95: +s[Math.floor(N * 0.95)].toFixed(2), partes: out, lienzo: R.cv.width + 'x' + R.cv.height, mapa: MUNDO.nombre, personas: PERS.length, juegoDibujadas: R.dibujadas, juegoTris: R.tris, gfx: GFX.nombre, cfg: { luz: GFX.luz, sombra: GFX.sombra, smTam: GFX.smTam, pcf: GFX.pcf, nluz: GFX.nluz, hdr: GFX.hdr, ao: GFX.ao, bloom: GFX.bloom, fxaa: GFX.fxaa, nubes: GFX.nubes, refl: GFX.refl, escala: GFX.escala } };
})()`);
if (cdpP) { const { profile: P } = await cdpP.send('Profiler.stop'); const yo = new Map(), total = P.samples.length, dt = P.timeDeltas;
  const porId = new Map(P.nodes.map((n) => [n.id, n])); const cuenta = new Map(); for (const sId of P.samples) cuenta.set(sId, (cuenta.get(sId) || 0) + 1);
  for (const [id, c] of cuenta) { const n = porId.get(id), k = n.callFrame.functionName + ' ' + (n.callFrame.url || '').split('/').pop() + ':' + n.callFrame.lineNumber; yo.set(k, (yo.get(k) || 0) + c); }
  console.log('PERFIL_CPU ' + JSON.stringify([...yo].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, c]) => [k, +(100 * c / total).toFixed(1)]))); }
const G = await ev(`(() => { const E = window.__gpu; return { sub: E.sub || {}, cuadros: E.cuadros.slice(2), progs: [...E.progs].map(([k, v]) => ({ k, ...v })) }; })()`);
await b.close();
// resumen de la GPU: el cuadro típico (la mediana de dibujos) y el promedio de todo
const C = G.cuadros, med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 0; };
const tot = (c) => c.pasadas.reduce((a, q) => a + q.dibujos, 0), tris = (c) => c.pasadas.reduce((a, q) => a + q.tris, 0);
const tip = C.slice().sort((x, y) => tot(x) - tot(y))[Math.floor(C.length / 2)];
// memoria de una pasada (MB): traer lo que no se borró ni descartó + guardar lo que no se descartó al final
const memP = (q) => { const px = q.todo || !q.z ? q.w * q.h : Math.max(0, (q.z[2] - q.z[0]) * (q.z[3] - q.z[1])), traer = (q.inicio & 1 ? 0 : q.cB) + (q.inicio & 2 ? 0 : q.dB), guardar = (q.fin & 1 ? 0 : q.cB) + (q.fin & 2 ? 0 : q.dB); return { traer: px * traer / 1e6, guardar: px * guardar / 1e6 }; };
const INI = (q) => { const t = (!(q.inicio & 1) && q.cB ? 'c' : '') + (!(q.inicio & 2) && q.dB ? 'p' : ''); return t ? 'traer ' + t : 'nada'; };
const pas = tip.pasadas.map((q) => ({ fb: q.fb, tam: q.w + 'x' + q.h + ' ' + q.cB + '+' + q.dB + 'B', inicio: INI(q) + (q.fin ? ' fin-desc:' + q.fin : ''), mb: +(memP(q).traer + memP(q).guardar).toFixed(2), dibujos: q.dibujos, tris: Math.round(q.tris), completas: q.completas, progs: Object.entries(q.progs).sort((a, b) => b[1].t - a[1].t).slice(0, 5).map(([k, v]) => k + ':' + v.d + 'd/' + Math.round(v.t) + 't' + (v.mezcla ? '/m' + v.mezcla : '') + (v.sinColor ? '/sc' : '')) }));
for (const q of G.progs) fs.writeFileSync(`${D}/prog_${q.k}.frag`, q.fs), fs.writeFileSync(`${D}/prog_${q.k}.vert`, q.vs);
console.log(JSON.stringify({ subidasDe: Object.entries(G.sub).sort((a, b) => b[1].kb - a[1].kb).slice(0, 6).map(([k, v]) => k + ' ' + v.n + 'x ' + Math.round(v.kb) + 'kB').join(' | '), js: r, gpu: { cuadros: C.length, dibujosMed: med(C.map(tot)), trisMed: Math.round(med(C.map(tris))), pasadasMed: med(C.map((c) => c.pasadas.length)), pasadasPorCuadro: C.map((c) => c.pasadas.length).join(' '), dibujosPorCuadro: C.map(tot).join(' '), subidasProm: +(C.reduce((a, c) => a + c.subidas, 0) / C.length).toFixed(2), mbTraidos: +med(C.map((c) => c.pasadas.reduce((a, q) => a + memP(q).traer, 0))).toFixed(1), mbGuardados: +med(C.map((c) => c.pasadas.reduce((a, q) => a + memP(q).guardar, 0))).toFixed(1), mbCopias: +med(C.map((c) => c.blitMB)).toFixed(1), mpxMed: +(med(C.map((c) => c.pasadas.reduce((a, q) => a + (q.todo || !q.z ? q.w * q.h : Math.max(0, (q.z[2] - q.z[0]) * (q.z[3] - q.z[1]))), 0))) / 1e6).toFixed(2), mbMemoria: +med(C.map((c) => c.blitMB + c.pasadas.reduce((a, q) => a + memP(q).traer + memP(q).guardar, 0))).toFixed(1), invalidaciones: med(C.map((c) => c.inval)), llamadas: med(C.map((c) => Object.values(c.ll).reduce((a, b) => a + b, 0))), llamadasTipo: (() => { const t = {}; for (const c of C) for (const [k, v] of Object.entries(c.ll)) t[k] = (t[k] || 0) + v; return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + ':' + Math.round(v / C.length)).join(' '); })(), kbSubidosProm: +(C.reduce((a, c) => a + c.bytesSubidos, 0) / C.length / 1024).toFixed(1), tipico: pas } }, null, 1));
