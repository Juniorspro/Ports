// ---------------- gráficos automáticos: la calidad más alta que sostiene 60 cuadros, medida en el aparato ----------------
// Pedido (Discord): «que siempre venga el modo automático activado, que al inicio busque el mejor intermedio en gráficos, o
// sea 60 fps pegados; si no llega en ninguna, que se quede en la que más se acerque por debajo de 60; si en una más alta
// te va a 60 y en otra más baja a 70, que no baje; si en la más alta pasa de 60, queda ésa».
// Cómo: la primera vez que se entra a un mapa en la sesión (con Automático), detrás de la pantalla de carga, con el mapa ya
// armado, se dibuja la escena de verdad en una calidad y se cuentan los cuadros que da la pantalla durante 0,6 s (después de
// que se compilen sus shaders). Se arranca por la calidad que se estima para el aparato (la base de celulares o la placa) o la
// que salió la vez anterior, y se sube mientras sostenga 60 (se acepta ≥ 57: la pantalla de 60 Hz da 59,x) o se baja hasta
// que llegue; si ninguna llega, la que dio más cuadros (empate: la más alta). Sin resolución dinámica mientras se mide.
// Después, en partida, sigue la resolución dinámica de siempre (principal.js).
const GFXA = { midiendo: false, medido: false, res: null, umbral: 57, med: 0.6, tirones: 0, tope: 12000 };
// (cuadros por segundo de la escena en una calidad: espera a que compile y se asiente —hasta 3 s— y cuenta al menos 0,6 s y
// 30 cuadros —hasta 1,5 s—)
async function gfxMedirUna(q) {
  GFX.base = q; aplicarGfx(); GFX.escala = GFX.escalaMax; redimensionar();
  const L = [], t0 = performance.now();
  await new Promise((ok) => { let ult = 0, buenos = 0; const f = (a) => { if (ult && a - ult < 80) buenos++; else buenos = 0; ult = a; if (buenos >= 6 || a - t0 > 3000) ok(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await new Promise((ok) => { const f = (a) => { L.push(a); const n = L.length - 1, dt = a - L[0]; if ((dt >= GFXA.med * 1000 && n >= 30) || dt >= 1500) ok(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  return gfxFps(L);
}
// (los tirones sueltos —el recolector de basura, una textura que sube, otra app— no cuentan: se sacan los cuadros que tardan
// más del triple de la mediana; lo que queda es lo que la calidad sostiene. A 50 cuadros en una pantalla de 60 Hz los
// cuadros van de 16,7 y 33,3 ms, y ninguno pasa el triple: da 50)
function gfxFps(L) {
  if (!L || L.length < 3) return 0;
  const d = []; for (let i = 1; i < L.length; i++) d.push(L[i] - L[i - 1]);
  const s = d.slice().sort((a, b) => a - b), med = s[s.length >> 1];
  let n = 0, t = 0; for (const x of d) if (x <= med * 3) { n++; t += x; }
  GFXA.tirones += d.length - n;
  return n && t > 0 ? n * 1000 / t : 0;
}
// la búsqueda: sube mientras llega, baja hasta que llega; devuelve la elegida y lo medido
// (con tope de tiempo: si ya pasaron GFXA.tope ms —un aparato muy lento o muy ocupado—, no mide más y elige entre lo medido)
async function gfxBuscar(inicio, medir, vence) {
  const O = PERF_ORDEN, med = {}, tarde = () => !!(vence && vence());
  let i = O.indexOf(inicio); if (i < 0) i = 2;
  const fps = async (k) => (med[O[k]] !== undefined ? med[O[k]] : (med[O[k]] = await medir(O[k])));
  let elegida = null;
  if ((await fps(i)) >= GFXA.umbral) {
    elegida = O[i];
    for (let k = i + 1; k < O.length && !tarde(); k++) { if ((await fps(k)) >= GFXA.umbral) elegida = O[k]; else break; }
  } else {
    for (let k = i - 1; k >= 0 && !tarde(); k--) { if ((await fps(k)) >= GFXA.umbral) { elegida = O[k]; break; } }
    // (ninguna llega a 60: la que más se acerca por debajo; si empatan, la más alta)
    if (!elegida) for (const q of O) { if (med[q] === undefined) continue; if (!elegida || med[q] > med[elegida] + 0.5 || (Math.abs(med[q] - med[elegida]) <= 0.5 && O.indexOf(q) > O.indexOf(elegida))) elegida = q; }
  }
  return { elegida, med };
}
// la medición completa (con la pantalla de carga abierta: C, la de template.html)
async function gfxMedir(C) {
  if (PREFS.gfx !== 'auto' || GFXA.midiendo || GFXA.medido || JUEGO.estado !== 'juego') return null;
  if (TEST && !window.__gfxMedirPrueba) return null;
  GFXA.midiendo = true; GFXA.tirones = 0; const t0 = performance.now(), cg = document.getElementById('carga');
  // (mientras mide, la pantalla de carga sin la foto que se mueve ni el desenfoque: lo que cuesta dibujarla no se cuenta
  // como si fuera de la escena)
  if (!document.getElementById('gfxMidCss')) { const st = document.createElement('style'); st.id = 'gfxMidCss'; st.textContent = '#carga.gfxMid .cgFondo{animation-play-state:paused!important}#carga.gfxMid .cgTipC{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; document.head.appendChild(st); }
  if (cg) cg.classList.add('gfxMid');
  try {
    if (C && C.set) { C.set(0.9, 'graficos'); }
    const prev = PREFS.gfxMedido, inicio = prev && PERF_ORDEN.includes(prev.base) && prev.gpu === gfxClave() ? prev.base : GFX.base || 'medio';
    const r = await gfxBuscar(inicio, window.__gfxMedirFalso || gfxMedirUna, () => performance.now() - t0 > GFXA.tope);
    GFX.base = r.elegida; aplicarGfx();
    PREFS.gfxMedido = { base: r.elegida, fps: r.med, gpu: gfxClave(), t: Date.now() }; guardarPrefs();
    GFXA.res = Object.assign({ ms: Math.round(performance.now() - t0), inicio, tirones: GFXA.tirones }, r); GFXA.medido = true;
    if (C && C.log) C.log('graficos', r.elegida[0].toUpperCase() + r.elegida.slice(1) + ' · ' + Math.round(r.med[r.elegida] || 0) + ' fps');
    return GFXA.res;
  } catch (e) { console.error(e); return null; }
  finally { GFXA.midiendo = false; if (cg) cg.classList.remove('gfxMid'); }
}
// (la placa y el aparato: si cambian —otro celular, otro navegador— se vuelve a empezar desde la estimación)
function gfxClave() {
  let g = ''; try { const d = R.gl.getExtension('WEBGL_debug_renderer_info'); g = d ? R.gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : R.gl.getParameter(R.gl.RENDERER); } catch (e) {}
  return String(g).slice(0, 60) + '|' + (R.gl1 ? 1 : 2) + '|' + screen.width + 'x' + screen.height;
}
// se engancha al cierre de la pantalla de carga: antes de esconderla, se mide (una vez por sesión, con Automático)
function gfxEnganchar() {
  const C = window.__carga; if (!C || !C.fin || C.__gfx) return;
  const fin0 = C.fin; C.__gfx = true;
  C.fin = function (cb) { const self = this, args = arguments; if (PREFS.gfx === 'auto' && !GFXA.medido && !GFXA.midiendo && JUEGO.estado === 'juego' && (!TEST || window.__gfxMedirPrueba)) { gfxMedir(C).then(() => fin0.apply(self, args)); return; } return fin0.apply(self, args); };
}
// «que siempre venga el modo automático activado»: una vez, con esta versión, el que tenía una calidad fija pasa a Automático
// (después puede volver a elegir la que quiera)
function gfxAutoUnaVez() {
  if (PREFS.gfxAuto31 || Q.get('gfx')) return;   // (con ?gfx= en la dirección —las pruebas— manda ésa)
  PREFS.gfxAuto31 = true; if (PREFS.gfx !== 'auto') { PREFS.gfx = 'auto'; } guardarPrefs();
}
gfxEnganchar();
