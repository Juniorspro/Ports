// Efectos visuales siempre activos (pedido: «aquellos objetos que te cambian la cámara a una más realista con estilo vhs
// … que se le ponga el objeto y no importe si tenés el objeto en mano o no, sino que siempre esté activo»). Con el
// Viewfinder real (3780178294), sin darle nunca la cámara al jugador:
//  1. el motor lo reconoce como efecto que depende de su objeto (weapon_ffcamcorder) y al First-Person Body no;
//  2. con otra cosa en la mano el efecto VHS está puesto (la imagen cambia y la cadena de shaders del mod corre); en Medio
//     el motor es DirectX 90 y el mod usa su versión liviana (ps_2_0b), como GMod en una placa floja;
//  3. dentro de los hooks del mod el arma activa es la cámara, pero el mouse y el disparo no le llegan (sí el teclado, para
//     sus propias teclas) y en sus hooks de teclas ve el arma real;
//  4. la página del mod en el panel GMod tiene «Siempre activo»; apagarlo saca el efecto (la imagen vuelve a la normal);
//  5. sin errores de JS ni de WebGL.
// uso: node efecto_siempre.mjs URL_HTML URL_CARPETA_GMA [CARPETA_CAPTURAS]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, CARP, D = '/tmp/claude-0/efsiempre'] = process.argv; fs.mkdirSync(D, { recursive: true });
const VF = '3780178294', FPB = '3104967124';
const t00 = Date.now(), paso = (m) => { if (process.env.PASOS) console.error(((Date.now() - t00) / 1000).toFixed(1) + 's ' + m); };
const caso = (n, ok, info) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + ' · ' + JSON.stringify(info).slice(0, 600)); return ok; };
const { b, p, ev, err: errJS } = await abrir(HTML, false, null); paso('abierto');
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'medio'; PREFS.resDin = false; PREFS.res = 100; aplicarGfx(); inicioMostrar(false); empezarPartida('RB_Construct'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 120000 }); await p.waitForTimeout(2000);
const quieto = `(() => { cerrarPaneles(); JUG.pos.set(3.42, -2.72, 24.14); JUG.vel.set(0, 0, 0); JUG.yaw = 2.2; JUG.pitch = 0.05; DIA.hora = 13; DIA.ciclo = false; diaAplicar && diaAplicar(); return 1; })()`;
paso('partida'); await ev(quieto);
const instalar = (id, n) => ev(`(async () => { const b = new Uint8Array(await (await fetch(${JSON.stringify(CARP)} + '/${id}.gma')).arrayBuffer()); const A = await gmInstalar('${id}', { nombre: '${n}', sinDeps: true }, b); await A.listo; return 1; })()`);
await instalar(FPB, 'First-Person Body');
await p.waitForTimeout(1500); await ev(quieto); await p.waitForTimeout(800);
const foto = async (nom) => { await p.screenshot({ path: D + '/' + nom + '.png', timeout: 120000 }); return 'data:image/png;base64,' + fs.readFileSync(D + '/' + nom + '.png').toString('base64'); };
const antes = await foto('antes'); paso('foto antes');
// (lo que tarda un cuadro sin el efecto: la vara para ver que con el efecto y el panel abierto no se traba)
const medirCuadros = () => p.evaluate(() => new Promise((ok) => { const t = []; let t0 = performance.now(); const f = (x) => { t.push(x - t0); t0 = x; if (t.length < 30) requestAnimationFrame(f); else { t.sort((a, b) => a - b); ok({ mediana: +t[15].toFixed(1), peor: +t[29].toFixed(1) }); } }; requestAnimationFrame(f); }));
const cuadroBase = await medirCuadros();
await instalar(VF, 'Viewfinder'); paso('vf instalado');
await ev(quieto); await p.waitForTimeout(6000);
const dif = (a, c) => p.evaluate(async ([a, c]) => {
  const carga = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; });
  const [A, B] = await Promise.all([carga(a), carga(c)]); const w = A.width, h = A.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  const datos = (im) => { g.drawImage(im, 0, 0); return g.getImageData(Math.round(w * 0.2), Math.round(h * 0.15), Math.round(w * 0.6), Math.round(h * 0.6)).data; };
  const x = datos(A), y = datos(B); let s = 0, n = 0; for (let i = 0; i < x.length; i += 4) { s += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); n++; }
  return +(s / n / 3).toFixed(2);
}, [a, c]);
let bien = 0, tot = 0;
const cls = await ev(`({ vf: gmaEfectoObjeto(GMOD.addons.get('${VF}')), fpb: gmaEfectoObjeto(GMOD.addons.get('${FPB}')), tipoVF: gmbTipo(GMOD.addons.get('${VF}')).k })`);
tot++; if (caso('1. reconoce al Viewfinder como efecto con objeto (y al First-Person Body no)', cls.vf === 'weapon_ffcamcorder' && !cls.fpb && cls.tipoVF === 'efecto', cls)) bien++;
const con = await foto('siempre');
// (el estado del mod, leído con su propio Lua: FFCam.Active y FFCam.Mode)
const estadoVF = () => ev(`(() => { const cx = GMA.ctx; GMA.ctx = 'C'; gmaLado('C'); try { GMA.R.G.get('RunString')('file.Write("jx_vf.txt", tostring(FFCam and FFCam.Active) .. "|" .. tostring(FFCam and FFCam.Mode) .. "|" .. tostring(FFCam.VHS.Signal.ActiveProfile and FFCam.VHS.Signal.ActiveProfile()) .. "|" .. render.GetDXLevel())', 'prueba'); } finally { GMA.ctx = cx; gmaLado(cx); } const [a, m, nv, dx] = String(localStorage.getItem('gmdata:jx_vf.txt') || '').split('|'); return { activo: a === 'true', modo: m, nivel: nv, dx: +dx }; })()`);
const st = await ev(`(() => ({ arma: ARM.lista[ARM.i], tieneCam: !!(GMA.armasJug && GMA.armasJug.has('weapon_ffcamcorder')), progs: [...GRT.progs.keys()].filter((k) => /ntsc/.test(k)).length }))()`);
Object.assign(st, await estadoVF());
const d1 = await dif(antes, con);
tot++; if (caso('2. con las manos sin la cámara, el efecto VHS está puesto (en Medio, con la versión liviana ps_2_0b del mod)', !st.tieneCam && st.activo === true && st.progs >= 3 && d1 > 6 && st.nivel === 'compatible_ps2b' && st.dx === 90, { ...st, difMedia: d1 })) bien++;
const inp = await ev(`(() => { const ha = GMA.hookAddon, he = GMA.hookEv, cx = GMA.ctx; ENT.disparo = true; ENT.teclas.add('KeyR'); GMA.botAnt = null;
  try { const G = GMA.R.G, inp = G.get('input');
    GMA.ctx = 'C'; GMA.hookAddon = '${VF}'; GMA.hookEv = 'Think';
    const w = gmaFantasma(), clase = w ? w.clase : null, raton = inp.get('IsMouseDown')(107), teclaR = inp.get('IsKeyDown')(28), disparoIN = gmaTecla(1);
    GMA.hookEv = 'CreateMove'; const wReal = gmaFantasma(); GMA.hookAddon = null; GMA.hookEv = 'Think'; const ratonOtro = inp.get('IsMouseDown')(107);
    return { clase, raton, teclaR, disparoIN, enTeclas: wReal ? wReal.clase : null, ratonOtroMod: ratonOtro };
  } finally { ENT.disparo = false; ENT.teclas.delete('KeyR'); GMA.hookAddon = ha; GMA.hookEv = he; GMA.ctx = cx; } })()`);
tot++; if (caso('3. el mod ve la cámara en la mano; el mouse y el disparo no le llegan (el teclado sí); sus hooks de teclas ven el arma real', inp.clase === 'weapon_ffcamcorder' && inp.raton === false && inp.disparoIN === false && inp.teclaR === true && inp.enTeclas === null && inp.ratonOtroMod === true, inp)) bien++;
// 4: el interruptor del panel
const pag = await ev(`(() => { gmbAbrir && gmbAbrir(); GMB.sel = '${VF}'; gmbDibujar(); const el = document.querySelector('[data-gb="sie:${VF}"]'); return { hay: !!el, on: !!(el && el.querySelector('.smSw.on')), texto: el ? el.textContent.trim().slice(0, 80) : '' }; })()`);
// (con el panel abierto y el efecto puesto el juego sigue andando: los cuadros no se traban)
const cuadros = await medirCuadros();
pag.cuadros = cuadros;
try { await p.screenshot({ path: D + '/panel.png', timeout: 20000 }); } catch (e) { pag.captura = 'no salió'; }
await ev(`(() => { gmbAccion('sie:${VF}'); gmbCerrar && gmbCerrar(); cerrarPaneles(); return 1; })()`);
await ev(quieto); await p.waitForTimeout(3000);
const sin = await foto('apagado');
const st2 = { ...(await estadoVF()), guardado: await ev(`localStorage.getItem('rb_gmb_siempreNo')`) };
const d2 = await dif(antes, sin);
tot++; if (caso('4. el panel tiene «Siempre activo» y apagarlo saca el efecto', pag.hay && pag.on && pag.cuadros.mediana < cuadroBase.mediana * 2.5 && st2.activo === false && d2 < d1 / 3, { pag, cuadroBase, ...st2, difApagado: d2, difPrendido: d1 })) bien++;
await ev(`gmaSiempreAlternar('${VF}', true); 1`);
const err = errJS.filter((e) => !/Failed to load resource|net::ERR|404|CORS|Access to fetch|WebSocket|willReadFrequently/i.test(e));
const gl = await ev(`({ e: R.gl.getError(), lua: (GMA.errores || []).slice(-4).map((e) => String(e.msg || e).slice(0, 160)) })`);
tot++; if (caso('5. sin errores de JS ni de WebGL', !err.length && gl.e === 0, { err: err.slice(0, 5), ...gl })) bien++;
console.log('RESUMEN ' + bien + '/' + tot);
await b.close();
process.exit(bien === tot ? 0 : 1);
