// ---------------- JXMod: los fondos animados del menú clásico ----------------
// El dueño: «que los fondos ahora sean animados de verdad: renders que se reproducen detrás del juego, pero de manera fluida,
// tirando a video quizás, pero a la vez render para no gastar tanto». Detrás del clásico, las 6 escenas del juego (la grieta,
// lo que cae prendido fuego, las explosiones, la gente) son videos: sacados con el motor del juego cuadro por cuadro
// (herramientas/fondos/video.mjs), en bucle sin que se note el empalme (bucle.py) y en H.264, que el celular decodifica con
// su hardware: se ve fluido como un video y gasta mucho menos que dibujar el 3D en vivo.
//  · cada capa del fondo (.rbBg, inicio.js) tiene su <video> encima de la foto; la foto es el primer cuadro del video, así que
//    mientras el video carga se ve igual y, cuando está, se muestra parado en ese cuadro y recién ahí arranca: no salta;
//  · un solo video decodificando a la vez (los dos sólo en el fundido de 1,8 s del cambio de escena); el que se va, al
//    terminar el fundido se suelta entero (sin decodificador ni memoria);
//  · se pausa cuando no se ve: con un panel encima, en la partida (ahí además se suelta) y en segundo plano; mientras está en
//    pausa la escena no cambia;
//  · con «menos movimiento» del aparato, Gráficos Patata o Bajos, o el ahorro de datos: las fotos de siempre, sin bajar ningún
//    video (Bajos: con el video la placa tiene que volver a mezclar el menú entero 30 veces por segundo; ver LEEME);
//  · si un video no está (sin internet la primera vez) o no se puede ver, queda la foto; si el aparato no sabe decodificarlo,
//    se deja de intentar y vuelve el agrandado lento de la foto.
// Los archivos van al lado del juego (fondos/, armar.py) y viajan como el paquete: en la web con código, cifrados
// (codigo_web.mjs deja acá el que los descifra) y guardados por el service worker para jugar sin internet; en el APK, cifrados
// como index.html y pk.bin.
const FONDOS_VIDEO = [/*FONDOSVIDEO*/];   // [archivo, bytes] de cada escena, en el orden de FONDOS_RB
// (la página con código deja el descifrador de los fondos antes de que corra el juego: se toma una vez y se borra)
const FV_DESC = typeof window.jxCodigoFondo === 'function' ? window.jxCodigoFondo : null;
try { window.jxCodigoFondo = null; } catch (e) {}
const FV = { url: {}, prom: {}, falla: {}, roto: false, sop: null, corre: false, ult: null, pide: 0, ver: 0, espera: 0, hay: false };
// ¿sabe este navegador mostrar H.264 (perfil high) en MP4?
function fvSoporta() {
  if (FV.sop === null) { try { const v = document.createElement('video'); FV.sop = !!(v.canPlayType && v.canPlayType('video/mp4; codecs="avc1.640028"')); } catch (e) { FV.sop = false; } }
  return FV.sop;
}
const fvAhorroDatos = () => { try { return !!(navigator.connection && navigator.connection.saveData); } catch (e) { return false; } };
// (el video va en el clásico con todo el movimiento —Medios, Altos y Ultra—; si no, las fotos)
const fvActivo = () => FONDOS_VIDEO.length > 0 && !FV.roto && RB.home === 'clasico' && !!CL.el && clNivel() === 'pleno' && !fvAhorroDatos() && fvSoporta();
// (y corre sólo cuando se ve: el clásico a la vista, sin panel, en el menú principal y con la página al frente)
const fvSeVe = () => fvActivo() && clVisible() && !RB.panel && JUEGO.estado === 'principal' && !document.hidden && !RB.el.classList.contains('rb3d');
// (mientras el video está activo pero tapado, la escena de fondo no cambia: inicio.js)
const fvRetener = () => fvActivo() && !fvSeVe();
// (se carga sólo en el menú principal a la vista: no en una partida)
const fvCabe = () => fvActivo() && JUEGO.estado === 'principal' && !RB.el.classList.contains('oc');
// el video de una capa (se arma la primera vez)
function fvVideo(capa) {
  let v = capa.querySelector('video');
  if (v) return v;
  v = document.createElement('video'); v.className = 'rbVid';
  v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.disablePictureInPicture = true; v.disableRemotePlayback = true;
  for (const a of ['muted', 'playsinline', 'webkit-playsinline', 'loop', 'disablepictureinpicture', 'disableremoteplayback']) v.setAttribute(a, '');
  v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
  v.addEventListener('error', () => fvError(v));
  capa.appendChild(v); return v;
}
// los bytes de la escena k (del lado del juego; en la web con código, descifrados) en un blob: una sola vez por escena
function fvBlob(k) {
  if (FV.url[k]) return Promise.resolve(FV.url[k]);
  if (FV.prom[k]) return FV.prom[k];
  const e = FONDOS_VIDEO[k]; if (!e) return Promise.resolve(null);
  return (FV.prom[k] = (async () => {
    try {
      const r = await fetch(e[0]); if (!r.ok) throw new Error('fondo ' + r.status);
      let u8 = new Uint8Array(await r.arrayBuffer());
      if (FV_DESC) u8 = await FV_DESC(u8);
      if (!u8 || u8.length < 1024) throw new Error('fondo vacío');
      return (FV.url[k] = URL.createObjectURL(new Blob([u8], { type: 'video/mp4' })));
    } catch (x) { FV.falla[k] = performance.now(); return null; }
    finally { delete FV.prom[k]; }
  })());
}
// (se guardan a lo sumo los de la escena que se ve, la anterior y la siguiente: unos 2 MB)
function fvLimpiarBlobs(k) {
  const n = FONDOS_VIDEO.length, quedan = new Set([k, (k + 1) % n, (k + n - 1) % n]);
  for (const j of Object.keys(FV.url)) if (!quedan.has(+j)) { try { URL.revokeObjectURL(FV.url[j]); } catch (e) {} delete FV.url[j]; }
}
// soltar el video de una capa: sin fuente, el navegador libera el decodificador y sus cuadros
function fvSoltar(capa) {
  const v = capa && capa.querySelector('video'); if (!v) return;
  v.classList.remove('ve'); delete v.dataset.k; v.dataset.tok = '';
  try { v.pause(); } catch (e) {}
  if (v.getAttribute('src')) { v.removeAttribute('src'); try { v.load(); } catch (e) {} }
}
// la capa que entra muestra la escena k: la foto ya está; el video se carga, se muestra parado en su primer cuadro (igual a
// la foto) y arranca. La que se va se suelta cuando termina el fundido (1,8 s)
function fvPasar(sig, act, k) {
  clearTimeout(FV.tSoltar); clearTimeout(FV.tPasar); FV.tPasar = 0; FV.ult = { capa: sig, k };
  if (!fvActivo()) { fvSoltar(sig); fvSoltar(act); return; }
  FV.tSoltar = setTimeout(() => { if (!act.classList.contains('on')) fvSoltar(act); }, 1950);
  fvSoltar(sig); fvPedir(sig, k);
}
// (la primera vez, cuando el menú ya se puede tocar y el aparato está libre: el video no atrasa la entrada; mientras, la foto)
function fvPedir(capa, k) {
  if (FV.ver) return fvCargar(capa, k);
  if (FV.espera) return; FV.espera = 1;
  const libre = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 1500 }) : (f) => setTimeout(f, 300);
  setTimeout(() => libre(() => { FV.ver = 1; FV.espera = 0; if (FV.ult) fvCargar(FV.ult.capa, FV.ult.k); }), 1200);
}
function fvCargar(capa, k) {
  if (!fvCabe() || !capa.classList.contains('on') || !FONDOS_VIDEO[k]) return;
  // (si la última vez no se pudo bajar, se vuelve a probar recién a los 30 s)
  if (FV.falla[k] && performance.now() - FV.falla[k] < 30000) return;
  const v = fvVideo(capa), tok = String(++FV.pide); v.dataset.tok = tok; v.dataset.k = k;
  fvBlob(k).then((u) => {
    if (!u || v.dataset.tok !== tok || !capa.classList.contains('on') || !fvCabe()) return;
    let listo = false;
    const mostrar = () => {
      if (listo || v.dataset.tok !== tok) return; listo = true;
      // (parado en el primer cuadro, que es la foto: se muestra y recién después corre)
      v.classList.add('ve'); fvActualizar(true); fvGuardar();
    };
    v.addEventListener('loadeddata', mostrar, { once: true });
    v.src = u; FV.hay = true; try { v.currentTime = 0; } catch (e) {} try { v.load(); } catch (e) {}
    // (iOS no siempre adelanta el primer cuadro sin reproducir: si en 1,5 s no llegó, se muestra al arrancar)
    setTimeout(() => { if (!listo && v.dataset.tok === tok) { v.addEventListener('playing', mostrar, { once: true }); fvActualizar(true); } }, 1500);
    fvLimpiarBlobs(k);
    // (y la siguiente escena, ya bajada para cuando toque)
    const sg = (k + 1) % FONDOS_VIDEO.length; if (sg !== k) setTimeout(() => { if (fvCabe()) fvBlob(sg); }, 2500);
  });
}
// en la web con el service worker (sw.js, de web_app.py): con el menú ya andando, los 6 se piden de a uno, despacio (uno cada
// 2,5 s, sólo con el menú a la vista), así quedan guardados para jugar sin internet aunque todavía no se hayan visto. En el APK
// están en la app y en la web sin service worker no hace falta
function fvGuardar() {
  if (FV.guarda || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  FV.guarda = 1; const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  navigator.serviceWorker.ready.then(async () => {
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await pausa(1500);
    if (!navigator.serviceWorker.controller) return;
    for (const e of FONDOS_VIDEO) {
      if (!e) continue;
      for (let i = 0; i < 400 && !fvCabe(); i++) await pausa(3000);   // (en una partida, espera a volver al menú)
      if (!fvCabe()) return;
      try { const r = await fetch(e[0]); if (r.ok) await r.arrayBuffer(); } catch (x) {}
      await pausa(2500);
    }
  }).catch(() => {});
}
// ¿le toca pasar a la escena siguiente? Con el video corriendo, cuando llega a 2 s de su final (a los 8 s de 10): el fundido de
// 1,8 s termina antes del final, así el video nunca vuelve a empezar a la vista (el navegador no salta al principio). null: no
// hay video corriendo (cuenta el reloj de siempre, inicio.js)
function fvToca() {
  const v = RB.el.querySelector('.rbBg.on video.ve'); if (!v || v.paused || !fvSeVe()) return null;
  if (!FV.tPasar) {
    const falta = (v.duration || 10) - 2 - v.currentTime;
    if (falta < 1.05) FV.tPasar = setTimeout(() => { FV.tPasar = 0; if (fvSeVe()) inicioFondoPasar(); }, Math.max(0, falta * 1000));
  }
  return false;
}
// un error del video: si no lo puede decodificar (formato o códec), no se prueba más y vuelve la foto con su agrandado
function fvError(v) {
  const e = v.error; if (!e || !v.getAttribute('src')) return;
  const k = +v.dataset.k; if (k >= 0) FV.falla[k] = performance.now();
  v.classList.remove('ve');
  if (e.code === 3 || e.code === 4) { FV.roto = true; fvApagar(); }
}
// sin video: las fotos (al cambiar a Patata, Bajos o «menos movimiento», al ir al depósito, si no se puede ver; y las pruebas
// que comparan el menú con la foto)
function fvApagar() {
  clearTimeout(FV.tSoltar); FV.corre = false; FV.hay = false;
  if (RB.el) for (const c of RB.el.querySelectorAll('.rbBg')) fvSoltar(c);
  for (const j of Object.keys(FV.url)) { try { URL.revokeObjectURL(FV.url[j]); } catch (e) {} delete FV.url[j]; }
}
// correr o pausar según se vea (lo llaman clMostrar —al mostrar u ocultar el menú: un panel, la partida— y el cambio de
// pestaña, con forzar; y clPausa en cada vuelta del menú, que basta revisar cada 200 ms: en cada cuadro eran 3 ms de JS por
// segundo con el procesador 4× más lento). En una partida —o sin video— se suelta todo (el decodificador y los blobs); con un
// panel encima o en segundo plano, en pausa
function fvActualizar(forzar) {
  if (!RB.el) return;
  const ahora = performance.now(); if (!forzar && ahora - (FV.tAct || 0) < 200) return; FV.tAct = ahora;
  if (!fvCabe()) { if (FV.hay) fvApagar(); FV.corre = false; return; }
  const corre = fvSeVe(); if (corre === FV.corre && !forzar) return;
  FV.corre = corre;
  for (const c of RB.el.querySelectorAll('.rbBg')) {
    const v = c.querySelector('video'); if (!v || !v.getAttribute('src')) continue;
    if (corre && c.classList.contains('on')) { if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } }
    else if (!corre) v.pause();
  }
  // (al volver a verse —se cerró el panel, volvió de una partida o la página—, si la capa no tiene su video, se carga)
  const u = FV.ult; if (corre && u && u.capa.classList.contains('on') && !u.capa.querySelector('video[src]')) fvPedir(u.capa, u.k);
}
document.addEventListener('visibilitychange', () => fvActualizar(true));
