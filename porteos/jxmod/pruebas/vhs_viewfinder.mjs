// El VHS de Viewfinder (Found Footage & Camcorder SWEP, 3780178294) de verdad: sus shaders de DirectX 9 traducidos a
// WebGL (gmod_dx9.js) y los render targets (gmod_rt.js). Con el .gma real:
//  1. la prueba propia del addon (dibuja su shader en un render target y lee el píxel) da el valor que espera: el addon
//     elige su señal NTSC compuesta («Signal»), no el modo Legacy;
//  2. con la cámara en la mano, la pantalla tiene la imagen procesada: distinta de la escena sin el efecto (diferencia
//     media) y con el aspecto de video: menos detalle fino (la crominancia de VHS es más borrosa que la luminancia);
//  3. el OSD de la cámara (texto que el mod dibuja en 2D) entra en la cinta: la capa 2D se vuelca a la pantalla antes de que
//     el mod la copie, y el texto sale con la fuente propia del mod (resource/fonts), medida como en GMod;
//  4. sin errores de JS ni de WebGL (y sin «could not open the VHS config»: file.Open escribe en data/); captura antes/después.
// uso: node vhs_viewfinder.mjs URL_HTML URL_CARPETA_GMA [CARPETA_CAPTURAS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP, D = '/tmp/claude-0/vhs'] = process.argv; fs.mkdirSync(D, { recursive: true });
const VF = '3780178294';
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 600)); return ok; };
const { b, p, ev, err: errJS } = await abrir(HTML, false, null);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'alto'; PREFS.resDin = false; PREFS.res = 100; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2000);
await ev(`(() => { cerrarPaneles(); JUG.pos.set(3.42, -2.72, 24.14); JUG.vel.set(0, 0, 0); JUG.yaw = 2.2; JUG.pitch = 0.05; DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); return 1; })()`);
await ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${VF}.gma')).arrayBuffer()); const A = await gmInstalar('${VF}', { nombre: 'Viewfinder', sinDeps: true }, b); await A.listo; return 1; })()`);
await p.waitForTimeout(2500);
const pixeles = async (nom) => { await p.screenshot({ path: D + '/' + nom + '.png', timeout: 120000 }); return D + '/' + nom + '.png'; };
const antes = await pixeles('antes');
// la cámara en la mano
const dio = await ev(`(() => { spawnElegir('GMod', 'gmswep:weapon_ffcamcorder'); return { arma: ARM.lista[ARM.i] }; })()`);
await p.waitForTimeout(6000);
const st = await ev(`(() => { const S = GMA.R && GMA.R.G.get('FFCam'); const V = S && S.get('VHS'); const Sg = V && V.get('Signal'); const tier = Sg && Sg.get('ActiveTier') ? GMA.R.c(Sg.get('ActiveTier'), 'x')[0] : null;
  return { arma: ARM.lista[ARM.i], tier: tier === undefined ? null : tier, falla: Sg && Sg.get('FailureReason') ? String(GMA.R.c(Sg.get('FailureReason'), 'x')[0]) : null, progs: [...GRT.progs.entries()].map(([k, v]) => k + ':' + (v.err ? 'ERR ' + v.err.slice(0, 80) : 'ok ' + v.ver)), rts: GRT.rts.size, glErr: R.gl.getError(), errLua: (GMA.errores || []).slice(-6).map((e) => String(e.msg || e).slice(0, 160)),
  volcados: GRT.volcados | 0, fuente: (() => { const F = GMFU.fam.get('real vhs font'); return F ? { css: F.css, k: +F.k.toFixed(3), cargada: [...document.fonts].some((x) => x.family.replace(/"/g, '') === F.css && x.status === 'loaded') } : null; })(),
  nivel: (() => { const cx = GMA.ctx; GMA.ctx = 'C'; gmaLado('C'); try { GMA.R.G.get('RunString')('file.Write("jx_nivel.txt", tostring(FFCam.VHS.Signal.ActiveProfile and FFCam.VHS.Signal.ActiveProfile()) .. "|" .. render.GetDXLevel())', 'prueba'); } finally { GMA.ctx = cx; gmaLado(cx); } return localStorage.getItem('gmdata:jx_nivel.txt'); })(),
  config: (() => { GMA.R.G.get('RunString')('RunConsoleCommand("ffcam_vhs_savecfg"); local f = file.Open("jx_prueba.dat", "wb", "DATA"); f:WriteLong(-7); f:WriteFloat(1.5); f:Write("hola"); f:Close(); local g = file.Open("jx_prueba.dat", "rb", "DATA"); file.Write("jx_prueba.txt", util.TableToJSON({ g:ReadLong(), g:ReadFloat(), g:Read(4), g:EndOfFile() })); g:Close()', 'prueba');
    let guardo = 0, leido = null; try { guardo = Object.keys(localStorage).filter((k) => /^gmdata:ffcam_vhscfg/i.test(k)).length; leido = JSON.parse(localStorage.getItem('gmdata:jx_prueba.txt')); } catch (e) {} return { guardo, leido }; })() }; })()`);
const despues = await pixeles('despues');
let bien = 0, tot = 0;
tot++; if (caso('1. el shader propio del addon corre (su prueba de píxel pasa) y en Alto elige la señal compuesta de alta fidelidad (ps_3_0)', st.progs.some((x) => /probe.*:ok/.test(x)) && !st.progs.some((x) => /ERR/.test(x)) && !/Legacy/.test(String(st.falla || '')) && /^high_ps30\|95$/.test(String(st.nivel)), { dio, ...st })) bien++;
// comparar las capturas: diferencia media y detalle fino (bordes) de la imagen
const cmp = await p.evaluate(async ([a, c]) => {
  const carga = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; });
  const [A, B] = await Promise.all([carga(a), carga(c)]); const w = A.width, h = A.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  const datos = (im) => { g.drawImage(im, 0, 0); return g.getImageData(0, Math.round(h * 0.15), w, Math.round(h * 0.6)).data; };
  const x = datos(A), y = datos(B); let dif = 0, n = 0, bordeA = 0, bordeB = 0, cromaA = 0, cromaB = 0;
  for (let i = 0; i + 4 < x.length; i += 4) { dif += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); n++; bordeA += Math.abs(x[i] - x[i + 4]); bordeB += Math.abs(y[i] - y[i + 4]);
    const ca = (x[i] - x[i + 2]) - (x[i + 4] - x[i + 6]), cb = (y[i] - y[i + 2]) - (y[i + 4] - y[i + 6]); cromaA += Math.abs(ca); cromaB += Math.abs(cb); }
  return { difMedia: +(dif / n / 3).toFixed(2), bordeAntes: +(bordeA / n).toFixed(2), bordeDespues: +(bordeB / n).toFixed(2), cromaBordeAntes: +(cromaA / n).toFixed(2), cromaBordeDespues: +(cromaB / n).toFixed(2) };
}, ['data:image/png;base64,' + fs.readFileSync(antes).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(despues).toString('base64')]);
tot++; if (caso('2. con la cámara la imagen cambia (aspecto de video: menos detalle de color fino)', cmp.difMedia > 4 && cmp.cromaBordeDespues < cmp.cromaBordeAntes, cmp)) bien++;
tot++; if (caso('3. el OSD entra en la cinta y usa la fuente del mod', st.volcados > 0 && !!(st.fuente && st.fuente.cargada), { volcados: st.volcados, fuente: st.fuente })) bien++;
const err = errJS.filter((e) => !/Failed to load resource|net::ERR|404|CORS|Access to fetch|WebSocket|willReadFrequently/i.test(e));
tot++; if (caso('4. sin errores de JS ni de WebGL; la configuración del mod se guarda', !err.length && st.glErr === 0 && st.config.guardo > 0 && JSON.stringify(st.config.leido) === JSON.stringify([-7, 1.5, 'hola', true]), { err: err.slice(0, 5), glErr: st.glErr, lua: st.errLua, config: st.config })) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await b.close();
process.exit(bien === tot ? 0 : 1);
