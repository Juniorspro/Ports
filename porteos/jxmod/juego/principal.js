// ---------------------------------------------------------------------------------------------------------
// arranque, preferencias, perfiles gráficos (con "patata" para teléfonos muy flojos), cámara y el bucle.
// ---------------------------------------------------------------------------------------------------------
const JUEGO = { estado: 'carga', dios: false, foto: 0 };
const TIEMPO = { t: 0, dt: 0, acc: 0, fps: 60, cuadros: 0, medT: 0, ms: 0, lento: 0, lentoS: 0, lentoB: 0, ahoS: 0, ahoB: 0 };
// calidades: luz (0 difuso viejo, 1 con brillo, 2 física, 3 física + extras), sombras del sol en cascadas
// (cuántas, tamaño del atlas, hasta qué distancia, filtro), luces puntuales, HDR, oclusión ambiental,
// resplandor, rayos de sol, antialias, nubes y relieve de las texturas
const PERFILES = {
  patata: { fps: 120, res: 45, lejos: 160, texMax: 128, lod: 9, lodPx: 3.5, sub: 5, part: 0.25, aniso: 0, luz: 0, sombra: 0 },
  bajo: { fps: 120, res: 60, lejos: 250, texMax: 256, lod: 2, lodPx: 2, sub: 6, part: 0.5, aniso: 0, luz: 1, sombra: 0 },
  medio: { fps: 120, res: 75, lejos: 450, texMax: 256, lod: 1, lodPx: 0.9, sub: 8, part: 0.8, aniso: 2, luz: 2, sombra: 1, smTam: 1024, sDist: 45, pcf: 1, nluz: 4, espSh: 512 },
  alto: { fps: 60, res: 100, lejos: 750, texMax: 0, lod: 0, lodPx: 0.5, sub: 10, part: 1, aniso: 8, luz: 2, sombra: 2, smTam: 2048, sDist: 110, pcf: 9, nluz: 6, hdr: 1, ao: 1, bloom: 1, fxaa: 1, nubes: 1, refl: 3, espSh: 512 },
  ultra: { fps: 60, res: 100, lejos: 1100, texMax: 0, lod: 0, lodPx: 0.4, sub: 10, part: 1, aniso: 16, luz: 3, sombra: 2, smTam: 2048, sDist: 110, pcf: 9, nluz: 8, hdr: 1, ao: 2, bloom: 2, rayos: 1, fxaa: 1, nubes: 1, det: 1, refl: 2, espSh: 1024 },
};
const PERF_ORDEN = ['patata', 'bajo', 'medio', 'alto', 'ultra'];
const PREFS_DEF = { modo: 'libre', codigo: '', salaLibre: 1, nombre: 'Player' + ((Math.random() * 900 + 100) | 0), mapa: 'Desert', skin: 'Hero', gorro: 'HatEmpty', gfx: 'auto', res: 70, lejos: 350, sens: 12, vol: 80, fps: true,
  sombras: 'auto', post: 'auto', texQ: 'auto', ocultarUI: false, contorno: true, motor: 'webgl2', fov: 70 };
let PREFS = Object.assign({}, PREFS_DEF);
try { Object.assign(PREFS, JSON.parse(localStorage.getItem('jx_prefs') || '{}')); } catch (e) {}
// (desde la 2.9 el motor de siempre es WebGL 2: a los que tenían guardado el WebGL 1 de antes —que era el de entrada— se
// los pasa una vez; si en el aparato no arranca, iniciar vuelve solo a WebGL 1)
if (PREFS.motorV !== 2) { if (PREFS.motor === 'webgl1') PREFS.motor = 'webgl2'; PREFS.motorV = 2; }
if (Q.get('gfx')) PREFS.gfx = Q.get('gfx');
function guardarPrefs() { try { localStorage.setItem('jx_prefs', JSON.stringify(PREFS)); } catch (e) {} }
const GFX = { escala: 0.7, lejos: 350, texMax: 256, lod: 1, sub: 8, part: 0.8, aniso: 0, auto: true, luz: 0, sombra: 0 };
// adivinar la gama del aparato la primera vez
// si el juego se cerró solo la última vez (el sistema mató la pestaña por falta de memoria, o se perdió el WebGL y hubo que
// recargar), arranca más liviano: una calidad menos por cada cierre reciente (hasta 3); con partidas largas sin cierres
// vuelve a subir de a una. Un cierre es haber quedado "andando" (rb_vivo, que se renueva cada 20 s con el juego a la
// vista) sin haber salido bien (al ocultarse la pestaña o cerrarla se borra)
const CIERRE = { n: 0, t: 0, nuevo: false, t0: Date.now() };
function cierreLeer() {
  try {
    const c = JSON.parse(localStorage.getItem('rb_cierres') || '{}'), vivo = +localStorage.getItem('rb_vivo') || 0, ahora = Date.now();
    CIERRE.n = Math.min(3, +c.n || 0); CIERRE.t = +c.t || 0;
    if (ahora - CIERRE.t > 3 * 864e5) CIERRE.n = 0;   // (de hace más de 3 días: se olvida)
    if (vivo && ahora - vivo < 30 * 60e3) { CIERRE.n = Math.min(3, CIERRE.n + 1); CIERRE.t = ahora; CIERRE.nuevo = true; }
    localStorage.setItem('rb_cierres', JSON.stringify({ n: CIERRE.n, t: CIERRE.t })); localStorage.removeItem('rb_vivo');
  } catch (e) {}
}
function cierreVivo(si) {
  try {
    if (si) { localStorage.setItem('rb_vivo', String(Date.now())); return; }
    localStorage.removeItem('rb_vivo');
    // (salió bien después de 10 min o más: un cierre menos)
    if (CIERRE.n > 0 && Date.now() - CIERRE.t0 > 10 * 60e3 && !CIERRE.bajado) { CIERRE.bajado = true; CIERRE.n--; localStorage.setItem('rb_cierres', JSON.stringify({ n: CIERRE.n, t: CIERRE.t })); }
  } catch (e) {}
}
// perder el WebGL cuenta como un cierre ya (después se recarga: no se cuenta dos veces)
function cierrePorWebGL() { try { CIERRE.n = Math.min(3, CIERRE.n + 1); CIERRE.t = Date.now(); localStorage.setItem('rb_cierres', JSON.stringify({ n: CIERRE.n, t: CIERRE.t })); localStorage.removeItem('rb_vivo'); CIERRE.perdido = true; } catch (e) {} }
function cierreIniciar() {
  cierreLeer(); if (TEST) return;
  cierreVivo(document.visibilityState !== 'hidden');
  setInterval(() => { if (document.visibilityState !== 'hidden' && !CIERRE.perdido) cierreVivo(true); }, 20000);
  document.addEventListener('visibilitychange', () => { if (!CIERRE.perdido) cierreVivo(document.visibilityState !== 'hidden'); });
  addEventListener('pagehide', () => cierreVivo(false));
}
function perfilInicial() {
  // (un celular de la lista, por su modelo o por su GPU: celulares.js)
  if (typeof CELU !== 'undefined' && CELU.det) return celuPerfil(CELU.det);
  if (typeof IOS !== 'undefined' && IOS) return iosPerfil();   // (iPhone y iPad: ios.js)
  const mem = navigator.deviceMemory || 4, nuc = navigator.hardwareConcurrency || 4;
  let gpu = '';
  try { const d = R.gl.getExtension('WEBGL_debug_renderer_info'); gpu = d ? R.gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) {}
  gpu = (Q.get('gpu') || gpu || '').toLowerCase();
  if (/mali-[gt]?[4-7]\d|adreno \(tm\) [3-5]\d\d|powervr|sgx|mali-4|adreno 30/.test(gpu) || mem <= 2 || nuc <= 2) return 'patata';
  if (COARSE && (mem <= 4 || /adreno \(tm\) 6[0-2]\d|mali-g5/.test(gpu))) return 'bajo';
  // celulares de gama alta (placas recientes): alto, con la resolución dinámica cuidando los cuadros
  if (COARSE && mem >= 6 && nuc >= 8 && /adreno \(tm\) (7[3-9]\d|8\d\d)|mali-g(7[1-9]|[89]\d\d)|immortalis|xclipse|apple gpu/.test(gpu)) return 'alto';
  if (COARSE) return 'medio';
  if (/rtx|radeon rx [5-9]\d{3}|rx [67]\d{3}|apple m\d|gtx 1[06-9]\d|gtx 16|arc\(tm\) a|arc a\d/.test(gpu) && nuc >= 6) return 'ultra';
  return 'alto';
}
// celulares de 1 GB de RAM o menos (Android Go: 512 MB): la memoria es lo que primero se termina (el sistema cierra el
// juego). Sin cambiar la calidad elegida, se guarda más chico lo que casi no se nota: las texturas opacas en 16 bits
// (RGB565) y el mapa de sombras en 16 bits. ?mem512 lo fuerza para probar
function memoriaBaja() {
  if (Q.has('mem512')) return true;
  const ram = Math.max((typeof CELU !== 'undefined' && CELU.det && CELU.det.ram) || 0, navigator.deviceMemory || 0);
  return ram > 0 && ram <= 1;
}
function aplicarGfx(ahorro) {
  if (GFX.memBaja === undefined) GFX.memBaja = memoriaBaja();
  // (después de cambiar la calidad o de entrar a un mapa se compila todo de una, como siempre; ya andando, lo nuevo en
  // paralelo: ver progDe. ahorro: sólo cambió el paso del ahorro de GPU en plena partida —gfxAhorroPaso—: sin recompilar
  // los materiales ni tocar la resolución)
  if (!ahorro && typeof R !== 'undefined') { R.asinc = false; clearTimeout(R.asincT); R.asincT = setTimeout(() => { R.asinc = true; }, 6000); }
  const esc0 = GFX.escala;
  const nom = PREFS.gfx === 'auto' ? (GFX.base || 'medio') : PREFS.gfx, p = PERFILES[nom] || PERFILES.medio;
  GFX.nombre = PERFILES[nom] ? nom : 'medio';
  GFX.auto = PREFS.gfx === 'auto';
  GFX.escala = (PREFS.gfx === 'auto' ? p.res : PREFS.res) / 100; GFX.escalaMax = GFX.escala; if (ahorro && esc0) GFX.escala = Math.min(esc0, GFX.escalaMax);
  GFX.lejos = PREFS.gfx === 'auto' ? p.lejos : PREFS.lejos;
  GFX.texMax = p.texMax; GFX.lod = p.lod; GFX.lodPx = p.lodPx || 1; GFX.sub = p.sub; GFX.part = p.part; GFX.aniso = p.aniso;
  for (const k of ['luz', 'sombra', 'smTam', 'sDist', 'pcf', 'pcss', 'nluz', 'hdr', 'ao', 'bloom', 'rayos', 'fxaa', 'nubes', 'det', 'refl', 'espSh']) GFX[k] = p[k] || 0;
  // sin tope de cuadros en ninguna calidad: todo lo que dé la pantalla (en la app se le pide a Android la frecuencia más alta;
  // si no, muchos celus dejan las apps en 60 Hz). GFX.fps es la meta de la resolución dinámica: en Patata, Bajo y Medio baja
  // la resolución para llegar a 120; en Alto y Ultra sólo si no llega a 60 (no se pierde nitidez por perseguir 120)
  GFX.fps = p.fps || 60; GFX.tope = 0;
  try { if (window.JXNativo && JXNativo.frecuencia) JXNativo.frecuencia(1000); } catch (e) {}
  // lo que el jugador cambió a mano (como en los ajustes del juego: Sombra, Postprocesado, Calidad de textura)
  if (PREFS.sombras !== 'auto' && GFX.luz >= 2) {
    const s = +PREFS.sombras, T = [null, [1, 1024, 45, 1, 0], [2, 2048, 110, 9, 0], [3, 4096, 220, 9, 1]][s];
    if (!T) GFX.sombra = 0; else { GFX.sombra = T[0]; GFX.smTam = T[1]; GFX.sDist = T[2]; GFX.pcf = T[3]; GFX.pcss = T[4]; }
  }
  if (PREFS.post === 'no') { GFX.hdr = GFX.ao = GFX.bloom = GFX.rayos = GFX.fxaa = 0; }
  else if (PREFS.post === 'si' && GFX.luz >= 2 && !GFX.hdr) { GFX.hdr = 1; GFX.ao = 1; GFX.bloom = 1; GFX.fxaa = 1; }
  // el ahorro de GPU (gfxAhorroPaso; vuelve a 0 si el jugador cambia la calidad, la resolución, las sombras o el posproceso)
  const ahK = [PREFS.gfx, PREFS.res, PREFS.sombras, PREFS.post].join('|'); if (GFX.ahorroK !== ahK) { GFX.ahorroK = ahK; GFX.ahorro = 0; GFX.ahorroFijo = false; }
  const ah = GFX.auto ? 0 : GFX.ahorro || 0; R.aoDef = false;
  if (ah >= 1 && GFX.ao) { GFX.ao = 0; GFX.rayos = 0; R.aoDef = true; }
  if (ah >= 2) { GFX.bloom = 0; if (GFX.refl) GFX.refl = Math.max(GFX.refl, 4); }
  if (ah >= 3 && GFX.sombra) { GFX.smTam = Math.min(GFX.smTam, 1024); GFX.sDist = Math.min(GFX.sDist, 75); }
  if (PREFS.texQ !== 'auto') GFX.texMax = { baja: 128, media: 256, alta: 0 }[PREFS.texQ] === undefined ? GFX.texMax : { baja: 128, media: 256, alta: 0 }[PREFS.texQ];
  // lo que el aparato no puede hacer (WebGL 1 sin alguna extensión) se apaga en cualquier calidad
  if (R.gl) {
    if (!R.fsAlta) GFX.luz = Math.min(GFX.luz, 1);
    if (!R.depthTex) { GFX.sombra = 0; GFX.ao = 0; GFX.rayos = 0; }
    if (R.gl1 || !R.depthTex || GFX.luz < 1) GFX.espSh = 0;   // (la sombra de la linterna: sólo WebGL 2)
    if (!R.deriv) GFX.det = 0;
  }
  if (R.gl) {
    if (!ahorro) progsLimpiar();
    if (GFX.luz >= 2 && GFX.sombra > 0) { if (!sombrasIniciar(GFX.sombra, Math.min(GFX.smTam, R.gl.getParameter(R.gl.MAX_TEXTURE_SIZE)))) GFX.sombra = 0; }
    else sombrasLiberar();
    if (GFX.espSh > 0) { if (!espSombraIniciar(GFX.espSh)) GFX.espSh = 0; } else espSombraLiberar();
    if (!(GFX.luz >= 2 && (GFX.hdr || GFX.ao || GFX.fxaa))) postLiberar();
  }
  // (GPU floja: el reflejo del agua se rehace un cuadro sí y uno no)
  GFX.reflCada = gfxPuntaje() && gfxPuntaje() < 48 ? 2 : 1;
  PH.sub = GFX.sub; R.lejos = vistaLejos();
  if (MUNDO.nombre) {
    const aj = DATA.aj[MUNDO.nombre] || {};
    if (!(aj.fog && aj.fd > 0) && !MUNDO.espacio && !(aj.fog && aj.fe > aj.fs)) { R.niebla.a = vistaLejos() * 0.7; R.niebla.b = vistaLejos(); }
    else if (aj.fog && aj.fm === 1 && aj.fe > aj.fs && !(aj.fd > 0)) Object.assign(R.niebla, nieblaLineal(aj, vistaLejos()));
  }
  if (AUD.master) AUD.master.gain.value = PREFS.vol / 100;
  ENT.sens = 0.00018 * PREFS.sens; ENT.sensT = ENT.sens * 2.6;
  if (!ahorro) redimensionarYa();   // (al cambiar los gráficos, ya: no es en medio de la partida)
}
// Ahorro de GPU en las calidades elegidas a mano (Alto y Ultra sobre todo; la automática ya baja una calidad entera): si
// la resolución dinámica ya bajó a 80 % o menos (o a su piso) y unos segundos seguidos igual no llega a la meta, y no es el procesador
// el que frena (el JavaScript del cuadro tarda menos de 2/3 del cuadro), se apaga de a uno lo que más le cuesta a la placa
// y menos se nota: 1) la oclusión ambiental (una pasada más de todo el mapa en profundidad y el SSAO), 2) el brillo
// (bloom) y el reflejo del agua a menos resolución, 3) el mapa de sombras a 1024. Cuando vuelve a sobrar unos segundos con
// la resolución entera, vuelve un paso; si al volver no alcanza enseguida, se queda en ese paso hasta cambiar de calidad
function gfxAhorroPaso(ms, metaF, piso) {
  const A = GFX.ahorro || 0, gpu = ms < 0.66 * 1000 / Math.max(1, TIEMPO.fps);
  if (A < 3 && TIEMPO.fps < metaF * 0.85 && GFX.escala <= Math.max(piso, GFX.escalaMax * 0.8) + 1e-3 && gpu) {
    if (++TIEMPO.ahoS >= 3) {
      TIEMPO.ahoS = 0; if (TIEMPO.t - (TIEMPO.ahoV || -99) < 15) GFX.ahorroFijo = true;
      GFX.ahorro = A + 1; TIEMPO.ahoT = TIEMPO.t; aplicarGfx(true); aviso('Gráficos: ahorro ' + GFX.ahorro, 2);
    }
  } else TIEMPO.ahoS = 0;
  if (A > 0 && !GFX.ahorroFijo && GFX.escala >= GFX.escalaMax - 1e-3 && TIEMPO.fps > metaF * 0.97 && TIEMPO.t - (TIEMPO.ahoT || 0) > 20) {
    if (++TIEMPO.ahoB >= 5) { TIEMPO.ahoB = 0; GFX.ahorro = A - 1; TIEMPO.ahoT = TIEMPO.ahoV = TIEMPO.t; aplicarGfx(true); }
  } else TIEMPO.ahoB = 0;
}
// Cambiar el tamaño del lienzo lo borra: hecho después de dibujar un cuadro, el navegador mostraba ese cuadro vacío (un
// titileo negro, en el celular cada vez que la resolución dinámica subía o bajaba). Ahora se pide y se hace al empezar
// el cuadro siguiente, antes de dibujar
// el puntaje de la GPU del celu (base de celulares.js), 0 si no es un celu o no se sabe
function gfxPuntaje() { try { return COARSE && typeof CELU !== 'undefined' && CELU.det && CELU.det.puntaje || 0; } catch (e) { return 0; } }
function redimensionar() { R.redim = true; }
function redimensionarYa() {
  R.redim = false;
  // (con tope de píxeles por calidad: en pantallas enormes o muy densas no se dibujan más puntos de los que se notan)
  const dpr = Math.min(devicePixelRatio || 1, 2), w = VW(), h = VH(); let tope = { patata: 0.5e6, bajo: 0.9e6, medio: 1.4e6, alto: 2.2e6, ultra: 3.7e6 }[GFX.nombre] || 2.2e6;
  // (celus con la GPU floja en Alto o Ultra: el tope sale del puntaje de su GPU —el Helio G85, Mali-G52 MC2, puntaje 38,
  // dibuja ~0,95 Mpx— para que llegue a 60 cuadros con todos los efectos; la HUD y el texto siguen nítidos, son HTML)
  const pj = gfxPuntaje(); if (pj && (GFX.nombre === 'alto' || GFX.nombre === 'ultra')) tope = Math.min(tope, clamp((GFX.nombre === 'ultra' ? 0.6e6 : 0.95e6) * pj / 38, 0.5e6, tope));
  const k = Math.min(dpr * GFX.escala, Math.sqrt(tope / Math.max(1, w * h)));
  const W = Math.max(160, Math.round(w * k)), H = Math.max(120, Math.round(h * k));
  if (R.cv.width !== W) R.cv.width = W; if (R.cv.height !== H) R.cv.height = H;   // (si no cambió, no se toca: igual borraría)
}
addEventListener('resize', () => R.cv && redimensionar());
// ---------------- cámara ----------------
const CAM = { pos: v3(), q: new Quat(), qVista: new Quat(), fwd: v3(0, 0, 1), der: v3(1, 0, 0), arr: v3(0, 1, 0), fov: 70, temblor: 0 };
// el campo de visión elegido en Ajustes (grados de alto de la imagen, como CAM.fov; 70 el de siempre). El arma en la mano se
// dibuja con su propio campo (60°, dibujar) y el celular en la mano con el suyo (celumano.js): no se estiran al cambiarlo
const FOV_MIN = 50, FOV_MAX = 110;
const fovBase = () => clamp(Math.round(+PREFS.fov) || 70, FOV_MIN, FOV_MAX);
function camaraActualizar(dt) {
  if (JUEGO.estado === 'principal' && typeof lobbyCamara === 'function') { lobbyCamara(CAM); CAM.qVista.copy(CAM.q).mul(MEDIA_VUELTA); return; }
  jugadorCamara(CAM);
  if (typeof clibCamara === 'function') clibCamara(CAM, dt);   // (cámara libre: volando o como en Roblox)
  if (JUEGO.estado === 'juego') cicCamara(CAM); // (Cíclope: la cinemática y la cámara de la definitiva)
  if (JUEGO.estado === 'juego') nocheCamara(CAM, dt); // (la pizzería: mirando una cámara de seguridad)
  if (EDA.on) edaCamara(CAM); // (editor de animaciones: alrededor del muñeco o la cámara grabada)
  if (DBG.cam) { CAM.pos.copy(DBG.cam.p); CAM.q.copy(DBG.cam.q); } // (pruebas: mirar desde otro lado)
  else if (typeof herCamaraVista === 'function') herCamaraVista();   // (la herramienta Cámara: mirando por una)
  if (!DBG.cam && !EDA.on && !(typeof CLIB !== 'undefined' && CLIB.modo) && typeof gmaVistaLua === 'function') gmaVistaLua(CAM);   // (CalcView de los addons de GMod)
  if (CAM.temblor > 0) { CAM.temblor = Math.max(0, CAM.temblor - dt * 1.5); const k = CAM.temblor * 0.03; CAM.q.mul(Quat.euler((Math.random() - 0.5) * k, (Math.random() - 0.5) * k)); }
  CAM.qVista.copy(CAM.q).mul(MEDIA_VUELTA);
  CAM.fwd.copy(CAM.q.rot(v3(0, 0, 1)));
  CAM.der.copy(CAM.qVista.rot(v3(1, 0, 0))); CAM.arr.copy(CAM.qVista.rot(v3(0, 1, 0)));
  // (con un mod de velocidad, la vista se abre al correr rápido)
  // (o el zoom que pidió el Lua de un addon con Player:SetFOV: gmaFovLua, gmod_vista.js)
  const vh = Math.hypot(JUG.vel.x, JUG.vel.z), z = ARM.zoom ? 18 : (typeof gmaFovLua === 'function' && gmaFovLua()) || (fovBase() + ((MODS.velocidad || 1) > 1.15 && !JUG.vehiculo ? clamp((vh - 7) * 0.8, 0, 14) : 0)) * (1 - 0.27 * (ARM.apK || 0)); CAM.fov += (z - CAM.fov) * Math.min(1, dt * (Math.abs(z - CAM.fov) > 10 ? 12 : 4));
}
// ---------------- partidas ----------------
const DESHACER = [];
function empezarPartida(mapa) {
  audioIniciar(); if (EDA.on) edaCerrar();
  // (un mapa del Workshop: se arma la primera vez, con la pantalla de carga; uno que no está instalado acá, Pasto plano)
  // (si la pantalla de carga ya está abierta —la abrió entrarConCarga desde el menú o al entrar a un server—, se queda así
  // y la cierra quien la abrió cuando la partida arrancó; antes se cerraba apenas empezaba a armarse el mapa y quedaba el
  // fondo crema del menú hasta que terminaba. Devuelve la promesa, para que quien llama espere)
  if (typeof GBSP !== 'undefined' && GBSP.mapas.has(mapa) && !DATA.esc[mapa]) {
    const C = window.__carga, ajena = !!(C && C.listo === false && C.abrir); if (C && C.abrir && !ajena) C.abrir(mapaNom(mapa), null, mapaNom(mapa));
    const p0 = ajena ? clamp(C.p || 0, 0.1, 0.5) : 0.1, cerrar = () => { if (!ajena && C && C.fin) C.fin(); };
    return gbspPreparar(mapa, (p, t) => { if (C && C.set) C.set(p0 + (0.95 - p0) * p, t); }).then(() => { cerrar(); empezarPartida(mapa); }).catch((e) => { gmErr && gmErr('mapa ' + mapa, e); cerrar(); aviso(T('gm.mapaMal'), 4); empezarPartida('FlatGrass'); });
  }
  if (!DATA.esc[mapa]) mapa = 'FlatGrass';
  CAM.fov = fovBase();   // (la partida empieza con el campo de visión elegido, sin acercarse desde el de antes)
  // (el mapa, el personaje y lo que necesiten en paquetes aparte: se bajan antes, con lo que va en la pantalla de carga)
  const falta = rbParaPartida(mapa, JUG.skinRol || JUG.skinMod || PREFS.skin);
  // (con la pantalla de carga abierta mientras baja: antes quedaba la pantalla en blanco hasta que llegaba; si no se pudo
  // bajar —sin internet—, se avisa y se juega con lo que hay en vez de quedar esperando para siempre)
  if (falta.length && !empezarPartida.sinBajar) {
    // (si la carga ya la abrió otro —entrar a un server, que después baja sus mods—, no se cierra acá: la cierra quien la abrió)
    const C = window.__carga, ajena = !!(C && C.listo === false && C.abrir); if (C && C.abrir && !ajena) C.abrir(mapaNom(mapa), (typeof FONDO_MAPA !== 'undefined' && FONDO_MAPA[mapa]) || null, mapaNom(mapa));
    const sigue = (ok) => { if (!ajena && C && C.fin) C.fin(); if (!ok) { aviso(T('gm.mapaMal'), 4); empezarPartida.sinBajar = true; } try { empezarPartida(mapa); } finally { empezarPartida.sinBajar = false; } };
    rbAsegurarTodos(falta, (n, t) => { if (C && C.set && t) C.set(0.05 + 0.85 * n / t, T('ld.bajando') + ' ' + (n / 1048576).toFixed(1) + ' / ' + (t / 1048576).toFixed(1) + ' MB'); }).then(sigue, () => sigue(false));
    return;
  }
  natFin(); if (typeof pillFin === 'function') pillFin(true); entidadesLimpiar(); JUG.skinRol = null; JUG.vidaMax = 0; JUG.colorRol = null; JUG.noclip = false; JUG.congelado = false;
  for (const o of OBJS.slice()) borrarObjeto(o);
  PH.bodies.length = 0; PH.joints.length = 0; PROY.length = 0; PART.l.length = 0;
  if (typeof nukeLimpiar === 'function') nukeLimpiar();   // (una nuclear del mundo de antes no sigue en éste: nucleares.js)
  if (typeof LUCES_T !== 'undefined') LUCES_T.length = 0;   // (ni la luz de una explosión de antes, en el mismo lugar del mundo nuevo)
  if (typeof personasLimpiar === 'function') personasLimpiar();
  cargarMapa(mapa); aplicarGfx(); if (typeof gbspTrasCargar === 'function') gbspTrasCargar(mapa); if (typeof puertasIniciar === 'function') puertasIniciar();
  if (typeof EVT !== 'undefined') EVT.mapa = null;   // (el evento 3.0 empieza de cero en cada partida, aunque sea el mismo mapa: evento.js)
  jugadorAparecer();
  ARM.lista = ['RPG', 'Pistol', 'Camera', 'Hands', 'Crowbar', 'ToolBaton', 'PhysicsGun'];   // (la palanca, como en GMod)
  if (typeof SALA !== 'undefined' && SALA && !SALA.rpg) ARM.lista = ARM.lista.filter((a) => a !== 'RPG');
  ARM.balas = {}; elegirArma(ARM.lista.length - 1);
  aplicarMods(); // mods y mapa de la comunidad (después de las armas: un mod puede sumar)
  if (typeof gmmPartida === 'function') gmmPartida(mapa);   // (un modo de juego de GMod: el elegido o el del mapa)
  if (typeof menuMostrar === 'function') menuMostrar(false); $('hud').classList.remove('oc');
  JUEGO.estado = 'juego'; cerrarPaneles(); modMenuBoton();
  if (typeof jugadorCuerpoNuevo === 'function') jugadorCuerpoNuevo();
  if (typeof redEntrar === 'function') redEntrar(mapa);
  aviso(typeof mapaNom === 'function' ? mapaNom(mapa) : mapa, 2.5);
  if (typeof MENU !== 'undefined' && MENU.cargarGuardado) { MENU.cargarGuardado = false; cargarConstruccion(); }
}
function irMenuPrincipal() {
  modapiDescargar(); natFin(); if (typeof pillFin === 'function') pillFin(true); entidadesLimpiar(); creadorSalir(); rolCerrar();
  if (typeof nukeLimpiar === 'function') nukeLimpiar();   // (sin destello, radiación ni soplido encima del menú)
  if (typeof redSalir === 'function') redSalir();
  if (typeof lanSalir === 'function') lanSalir();   // (si eras anfitrión en la red local, la partida se cierra: lan.js)
  if (typeof nocheFin === 'function') nocheFin();   // (la hora, la energía y los botones de la pizzería no quedan encima del menú)
  JUEGO.estado = 'principal'; $('hud').classList.add('oc'); soltarPuntero(); cerrarPaneles();
  if (typeof SALA !== 'undefined') SALA = null;
  HOST.ds = false;
  inicioMostrar(true);
}
function morirJugador(callado) {   // (callado: KillSilent de un modo de juego, sin muñeco ni aviso)
  JUG.vivo = false; JUG.muertoT = 3; soltarAgarre(); soltarGrav(); modapiEvento('muerte', {});
  if (typeof linternaPaso === 'function') linternaPaso();   // (la linterna se apaga al morir, en el momento)
  if (JUG.vehiculo) salirVehiculo();
  if (callado) return;
  if (typeof jugadorRagdoll === 'function') jugadorRagdoll();
  // (sin cartel de «Te moriste»: como en GMod, al morir se ve el muñeco y se reaparece; Discord: «quiten los carteles de
  // "moriste" o parecidos»)
}
function guardarConstruccion() {
  if (typeof cuentaPedir === 'function' && !cuentaPedir('guardar', guardarConstruccion)) return;   // (guardar pide la sesión de Google)
  const L = OBJS.filter((o) => o.dueno === 'yo').map((o) => ({ n: o.nombre, p: [o.b.pos.x, o.b.pos.y, o.b.pos.z].map((x) => +x.toFixed(3)), q: [o.b.q.x, o.b.q.y, o.b.q.z, o.b.q.w].map((x) => +x.toFixed(4)), f: o.b.frozen ? 1 : 0 }));
  try { localStorage.setItem('jx_save_' + MUNDO.nombre, JSON.stringify(L)); aviso(`Guardado (${L.length} cosas)`); fotoConstruccion(); } catch (e) { aviso('No se pudo guardar'); }
}
function cargarConstruccion() {
  if (typeof cuentaPedir === 'function' && !cuentaPedir('guardar', cargarConstruccion)) return;
  let L = []; try { L = JSON.parse(localStorage.getItem('jx_save_' + MUNDO.nombre) || '[]'); } catch (e) {}
  for (const x of L) {
    const o = crearObjeto(x.n, v3(0, 0, 0), new Quat(x.q[0], x.q[1], x.q[2], x.q[3]), { congelado: !!x.f });
    if (o) { o.b.pos.set(x.p[0], x.p[1], x.p[2]); o.b.q.set(x.q[0], x.q[1], x.q[2], x.q[3]); o.b.updateWorld(); }
  }
  aviso(L.length ? `Cargado (${L.length} cosas)` : 'No hay nada guardado en este mapa');
}
// ---------------- pulsos de teclas y botones ----------------
function atenderPulsos() {
  for (const k of ENT.pulsos) {
    if (JUEGO.estado !== 'juego') continue;
    if (UI.abierto === 'eda') { if (k === 'pausa') edaAccion('salir'); continue; } // (en el editor de animaciones, sólo salir)
    // (lo de la noche en la pizzería que tapa la pantalla no se cierra con Esc: se abre la pausa encima; las cámaras sí se bajan)
    if (k === 'pausa') { if (UI.abierto === 'fncam') nocheTablet(); else if (UI.abierto && !/^fn/.test(UI.abierto)) cerrarPaneles(); else abrirPausa(); continue; }
    if (k === 'cerrar') { cerrarPaneles(); continue; }
    if (k === 'fncam') { nocheTablet(); continue; } // (la pizzería: cámaras y linterna)
    if (k === 'linterna') { linternaAlternar(); continue; }
    if (k === 'modmenu') { if (UI.abierto === 'modm') modMenuCerrar(); else if (!UI.abierto) modMenuAbrir(); continue; }
    if (k === 'servmods') { if (UI.abierto === 'sm') smCerrar(); else if (!UI.abierto) smAbrir(); continue; }
    if (k === 'menu') { if (UI.abierto === 'spawn') cerrarPaneles(); else { cerrarPaneles(); abrirSpawn(); } continue; }
    // (el celular es un arma que da el mod Celular: O lo saca o lo guarda; los memes son una app del celular)
    if (k === 'memes') { if (celmEnMano() && CEL.app === 'memes') { celmSacar(); continue; } if (!celmEnMano()) celmSacar(); if (celmEnMano()) { CEL.app = 'memes'; rbPedir && rbPedir('a_memes'); celDibujar(); } continue; }
    if (k === 'celular') { if (UI.abierto && UI.abierto !== 'celular') continue; celmSacar(); continue; }
    if (UI.abierto) continue;
    if (k === 'chat') abrirChat();
    else if (k === 'camLibre') clibMenu(); else if (k === 'camLibL') clibElegir('L'); else if (k === 'camLibR') clibElegir('R');   // (cámara libre)
    else if (k === 'camara') { if (JUG.vehiculo) { JUG.fpVeh = !JUG.fpVeh; JUG.yaw = JUG.fpVeh ? 0 : JUG.yaw; } else JUG.tercera = !JUG.tercera; }
    else if (k === 'emotes') emoBoton();   // (sólo la ruleta, o el panel si en Ajustes se apagó: ruleta.js)
    else if (k === 'recargar') { if (!volverAgarre()) recargar(); }   // (sosteniendo algo con la de física o la de gravedad: R lo devuelve a su lugar)
    else if (k === 'volver') volverAgarre();
    else if (k === 'rotar') { ENT.rotar = !ENT.rotar && !!ARM.agarre; }   // (un toque: girar; otro: mirar)
    else if (k === 'usar') { if (typeof usar === 'function') usar(); }
    else if (k === 'salir') { if (JUG.vehiculo) salirVehiculo(); else patear(); }   // (F: a pie, patada)
    else if (k === 'patada') patear();
    else if (k === 'borrarApuntado') borrarApuntado();
    else if (k === 'deshacer') { const o = DESHACER.pop(); if (o && OBJS.includes(o)) { borrarObjeto(o); aviso('Deshecho: ' + o.nombre, 1); } }
    else if (k === 'lejos') ENT.pulsoDist = (ENT.pulsoDist || 0) + 1.5;
    else if (k === 'cerca') ENT.pulsoDist = (ENT.pulsoDist || 0) - 1.5;
    else if (k === 'noclip') { JUG.noclip = !JUG.noclip; aviso(JUG.noclip ? 'Volar: sí' : 'Volar: no', 1); }
    else if (k === 'siguienteArma') elegirArma((ARM.i + 1) % ARM.lista.length);
    else if (/^arma\d$/.test(k)) elegirArma(+k.slice(4) - 1);
  }
  ENT.pulsos.length = 0;
}
// ---------------- el cuadro ----------------
// ¿este llamado se saltea? (sólo con un tope puesto, GFX.tope en cuadros por segundo: hoy ninguna calidad lo usa)
function cuadroSalta(ahora, jugando) {
  const di = ahora - (TIEMPO.rafUlt || ahora); TIEMPO.rafUlt = ahora; if (di > 1) TIEMPO.rafMs = Math.min(di, (TIEMPO.rafMs || di) * 1.001);
  // (en el menú principal y con la pausa abierta, a 30 cuadros: no hace falta más y el celular no se calienta ni gasta batería
  // mientras elegís; en partida, sin tope)
  const menu = !GFX.tope && (!TEST || window.__menu30) && (JUEGO.estado !== 'juego' || (typeof UI !== 'undefined' && UI.abierto === 'pausa'));
  const tope = GFX.tope || (menu ? 30 : 0);
  if (!tope) { TIEMPO.ultDib = ahora; return false; }   // (sin tope: se dibuja cada vez que la pantalla lo pide)
  const meta = 1000 / tope, dm = TIEMPO.rafMs || meta;
  const ult = TIEMPO.ultDib || 0;
  if (dm * 1.5 < meta && (jugando || menu) && ahora - ult < meta - dm * 0.5) return true;
  // (la marca avanza de a un cuadro de la meta —no a «ahora»—: si uno salió tarde, el siguiente lo recupera y el promedio
  // queda en la meta; si se atrasó más de dos cuadros, se vuelve a empezar desde ahora)
  TIEMPO.ultDib = ahora - ult < meta * 2 ? ult + meta : ahora; return false;
}
const _proj = new Float32Array(16), _vp2 = new Float32Array(16);
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  if (typeof cnCuadro === 'function') cnCuadro();   // (el latido para la app y el estado en la caja negra: cajanegra.js)
  // la frecuencia de la pantalla (el intervalo más corto entre llamadas, que se olvida de a poco; la usa la resolución
  // dinámica) y, si hubiera un tope, un cuadro sí y otro no, parejo
  if (cuadroSalta(ahora, JUEGO.estado === 'juego')) return;
  const t = ahora / 1000, dt = Math.min(0.1, Math.max(0, t - (TIEMPO.ult || t))) * (JUEGO.estado === 'juego' ? MODS.tiempo || 1 : 1); TIEMPO.ult = t; TIEMPO.dt = dt; TIEMPO.t += dt;
  const t0 = performance.now();
  if (R.perdido) return;   // (sin contexto de WebGL: nada que dibujar hasta que vuelva)
  if (R.redim && R.cv) redimensionarYa();
  if (JUEGO.estado === 'carga') return;
  entradaLeer(); atenderPulsos(); if (typeof clibEntrada === 'function') clibEntrada(); if (typeof tutPaso === 'function') tutPaso(dt);
  // mirar
  const mx = ENT.dx, my = ENT.dy; ENT.dx = ENT.dy = 0; ENT.mdx = mx;
  ENT.rdx = 0; ENT.rdy = 0;
  if (JUEGO.estado === 'juego' && !UI.abierto) {
    if (ARM.rotando) { ENT.rdx = mx; ENT.rdy = my; }
    else if (typeof CLIB !== 'undefined' && CLIB.modo && !JUG.vehiculo) clibMirar(mx, my);   // (la cámara libre gira sola)
    else { const kz = (ARM.zoom ? 0.25 : 1) * (1 - 0.4 * (ARM.apK || 0)) * (typeof gmaSensLua === 'function' && (mx || my) ? gmaSensLua() : 1); JUG.yaw -= mx * ENT.sens * kz; JUG.pitch = clamp(JUG.pitch + my * ENT.sens * kz, -1.55, 1.55); }
  }
  // simulación con paso fijo
  TIEMPO.acc += dt; const paso = 1 / 60; let n = 0;
  while (TIEMPO.acc >= paso && n < 3) {
    TIEMPO.acc -= paso; n++;
    if (JUEGO.estado === 'juego') {
      const ent = UI.abierto || CIC.quieto ? { x: 0, y: 0, saltar: false, agachar: false, correr: false } : ENT;
      jugadorPaso(paso, ent);
      portalesPaso();
      if (typeof vehiculosPaso === 'function') vehiculosPaso(paso, ent);
    }
    // (con el procesador que no da, la física de los objetos un paso sí y uno no, con el doble de tiempo: 30 por segundo)
    // (sólo en el nivel 2: en el 1 la física sigue a 60, que a 30 los objetos se moverían a saltitos)
    const fis30 = TIEMPO.lento >= 2; if (!fis30 || (TIEMPO.fisPar = !TIEMPO.fisPar)) { const pf = fis30 ? paso * 2 : paso; aguaFisica(pf); physStep(pf); }
    for (const b of PH.bodies) if (b.dead && b.obj) { borrarObjeto(b.obj); break; }
    if (typeof personasPaso === 'function') personasPaso(paso);
  }
  if (n === 3) TIEMPO.acc = 0;
  if (typeof gmLuaPaso === 'function') gmLuaPaso(dt);   // (el Lua de los addons de GMod: timers, hooks, entidades, armas)
  if (JUEGO.estado === 'juego') {
    armasPaso(dt);
    if (!JUG.vivo && JUG.muertoT <= 0 && !(typeof gmmManejaMuerte === 'function' && gmmManejaMuerte())) { jugadorAparecer(); if (typeof jugadorCuerpoNuevo === 'function') jugadorCuerpoNuevo(); }
    if (typeof herramientasPaso === 'function') herramientasPaso(dt);
    modapiPaso(dt); vozPaso(dt); natPaso(dt); entidadesPaso(dt); smPaso(dt); if (typeof gmsPaso === 'function') gmsPaso(); modsVisualPaso(dt);
    if (typeof redPaso === 'function') redPaso(dt);
    cicPaso(dt); verPaso(dt); edaPaso(dt); nochePaso(dt); if (typeof puertasPaso === 'function') puertasPaso(dt);
    diaPaso(dt); hostPaso();
    if (typeof eventoPaso === 'function') eventoPaso(dt);   // (el evento 3.0: la grieta y lo que cae de ella)
    if (typeof pillPaso === 'function') pillPaso(dt);   // (Pill Packs: transformado en un personaje)
  }
  efectosPaso(dt);
  camaraActualizar(dt);
  aguaPaso(dt); sonidosPaso(dt); if (typeof emuPaso === 'function') emuPaso(dt); patadasPaso(dt); artPaso(dt); npcPaso(dt); bocinaPaso(); juntosPaso(); nukePaso(dt);
  if (typeof GRT !== 'undefined') GRT.enDibujo = true; try { dibujar(); } finally { if (typeof GRT !== 'undefined') GRT.enDibujo = false; }
  celmCuadro(); if (typeof gmaHUDPaso === 'function') gmaHUDPaso(); if (typeof gmrtFinCuadro === 'function') gmrtFinCuadro();
  buclesFin(); audioPaso(dt);
  hudActualizar(dt); hudPaso(); if (typeof clibDevolver === 'function') clibDevolver();
  // fps y resolución automática
  // (en tiempo real: con muy pocos cuadros o con el mod de cámara lenta el tiempo del juego no sirve para medir)
  const ahoraR = performance.now(); if (!TIEMPO.medR) TIEMPO.medR = ahoraR;
  TIEMPO.cuadros++; TIEMPO.medT = (ahoraR - TIEMPO.medR) / 1000; TIEMPO.ms += ahoraR - t0;
  if (TIEMPO.medT >= 1) {
    TIEMPO.fps = TIEMPO.cuadros / TIEMPO.medT; const ms = TIEMPO.ms / TIEMPO.cuadros; TIEMPO.msProm = ms; TIEMPO.medR = ahoraR;
    if (typeof VENT !== 'undefined') VENT.ok = false;   // (el tamaño de la ventana se vuelve a leer una vez por segundo, por las dudas: entrada.js)
    // ¿el procesador no da? (el JavaScript de cada cuadro tarda mucho: un celu con cuatro Cortex-A53 a 1,4 GHz —Snapdragon
    // 425, MT6739, Unisoc SC9832E— tarda 12 veces lo de una compu). Nivel 1 desde 9 ms por cuadro, 2 desde 16; para bajar
    // tiene que bajar bastante (5,5 y 10 ms) unos segundos, así no va y viene. Con el nivel, lo que no se nota se hace
    // menos seguido: los NPCs y las animaciones de lejos cada dos o cuatro cuadros, los pasos cada dos y, en el nivel 2,
    // la física de los objetos a 30 por segundo. (En las pruebas automáticas, sólo si la prueba lo pide: SwiftShader dibuja con el
    // procesador y siempre parecería un celu lento)
    if (JUEGO.estado === 'juego' && (!navigator.webdriver || window.__lentoPrueba)) {
      // (sólo si no llega a la meta de cuadros: si ya llega, no hace falta resignar nada)
      const L = TIEMPO.lento || 0, meta = Math.min(GFX.fps || 60, 1000 / Math.max(4, TIEMPO.rafMs || 16.7) + 2);
      if (L < 2 && TIEMPO.fps < meta * 0.95 && ms > (L ? 16 : 9)) { if (++TIEMPO.lentoS >= 2) { TIEMPO.lento = L + 1; TIEMPO.lentoS = 0; } } else TIEMPO.lentoS = 0;
      if (L > 0 && ms < (L >= 2 ? 10 : 5.5)) { if (++TIEMPO.lentoB >= 4) { TIEMPO.lento = L - 1; TIEMPO.lentoB = 0; } } else TIEMPO.lentoB = 0;
    }
    $('fps').textContent = PREFS.fps ? `${Math.round(TIEMPO.fps)} fps` : '';
    // resolución dinámica en todas las calidades (también las elegidas a mano), con la meta de la calidad (120 o 60): si no llega baja la
    // resolución interna antes que los efectos, y la vuelve a subir cuando sobra; en automático, además, si con la
    // resolución mínima igual no alcanza baja una calidad entera
    const din = GFX.auto || PREFS.resDin !== false, piso = GFX.auto ? 0.5 : Math.max(0.5, GFX.escalaMax * 0.6), prAh = TEST && window.__ahorroPrueba;
    if (din && JUEGO.estado === 'juego' && !UI.abierto && (!TEST || prAh) && !(typeof GFXA !== 'undefined' && GFXA.midiendo)) {   // (sin resolución dinámica mientras gfxauto.js mide)
      // (sin ir y venir: para volver a subir hacen falta dos segundos seguidos con resto y que hayan pasado 3 s del último
      // cambio; si no, en un celular que anda entre 48 y 57 cuadros la resolución subía y bajaba cada segundo)
      // (la meta: la de la calidad, sin pasar lo que da la pantalla —un celu de 60 Hz no puede dar 120—)
      const metaF = Math.min(GFX.fps || 60, 1000 / Math.max(4, TIEMPO.rafMs || 16.7) + 2);
      TIEMPO.sobra = TIEMPO.fps > metaF * 0.97 && ms < 550 / metaF ? (TIEMPO.sobra || 0) + 1 : 0; const quieto = TIEMPO.t - (TIEMPO.resT || -99) > 3;
      if (TIEMPO.fps < metaF * 0.92 && GFX.escala > piso) { GFX.escala = Math.max(piso, GFX.escala - 0.08); redimensionar(); TIEMPO.bajos = 0; TIEMPO.resT = TIEMPO.t; TIEMPO.sobra = 0; }
      else if (TIEMPO.sobra >= 2 && quieto && GFX.escala < GFX.escalaMax) { GFX.escala = Math.min(GFX.escalaMax, GFX.escala + 0.04); redimensionar(); TIEMPO.resT = TIEMPO.t; TIEMPO.sobra = 0; }
      if (!GFX.auto && GFX.luz >= 2) gfxAhorroPaso(ms, metaF, piso);
    }
    if (GFX.auto && JUEGO.estado === 'juego' && !UI.abierto && !TEST && !(typeof GFXA !== 'undefined' && GFXA.midiendo)) {
      // ya en la resolución mínima y sigue lento: bajar una calidad entera (y no volver a subir en esta partida)
      if (TIEMPO.fps < 50 && GFX.escala <= 0.5) {
        TIEMPO.bajos = (TIEMPO.bajos || 0) + 1;
        const i = PERF_ORDEN.indexOf(GFX.base);
        if (TIEMPO.bajos >= 4 && i > 0) { GFX.base = PERF_ORDEN[i - 1]; aplicarGfx(); TIEMPO.bajos = 0; aviso('Gráficos: ' + GFX.base, 2); }
      } else TIEMPO.bajos = 0;
    }
    TIEMPO.cuadros = 0; TIEMPO.medT = 0; TIEMPO.ms = 0;
  }
}
// el lobby del menú: fondo crema de la cámara del juego y, en la tienda, el personaje con la luz de la escena
const LOBBY_LUZ = { sol: v3(-0.322, 0.765, -0.557), solCol: [1, 0.957, 0.839], amb: [0.44, 0.43, 0.42], fondo: [0.945, 0.925, 0.875] };
function dibujarMenu() {
  const gl = R.gl, W = R.cv.width, H = R.cv.height, F = LOBBY_LUZ.fondo;
  R.cuadro = (R.cuadro || 0) + 1;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H); gl.clearColor(F[0], F[1], F[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!MENU.lobby) return;
  const g = { sol: R.sol.clone(), solCol: R.solCol, ambS: R.ambS, ambG: R.ambG, niebla: R.niebla, lin: R.lin, expo: R.expo };
  R.sol.copy(LOBBY_LUZ.sol); R.solCol = LOBBY_LUZ.solCol; R.ambS = LOBBY_LUZ.amb; R.ambG = LOBBY_LUZ.amb; R.niebla = { c: F, a: 900, b: 1000 };
  // la tienda con la luz física (sin sombras): el fondo crema hace de cielo
  R.salida = GFX.luz >= 2 ? 'ldr' : 'gam'; R.sombraOn = false; R.conAO = false; R.aoActivo = false; R.expo = 1.1;
  const f = srgb3(F), s = srgb3(LOBBY_LUZ.solCol);
  R.lin = { top: f, mid: f, bot: f.map((x) => x * 0.5), topG: F, midG: F, botG: F.map((x) => x * 0.7), solCol: s.map((x) => x * 2.2), cieloSol: s, ambS: srgb3(LOBBY_LUZ.amb).map((x) => x * 1.6), ambG: srgb3(LOBBY_LUZ.amb).map((x) => x * 1.1), nieC: f };
  const P = M4.persp(60 * Math.PI / 180, W / H, 0.08, 50), V = M4.view(CAM.pos, CAM.qVista); R.lodK = H / (2 * Math.tan(Math.PI / 6));
  m4mul(P, V, R.vp); R.fr = frustum(R.vp); R.camPos.copy(CAM.pos); R.marca++; R.luces.length = 0; R.nLuces = 0; R.esp.length = 0; R.nEsp = 0;
  dibujarLobby(); dibujarCola();
  R.sol.copy(g.sol); R.solCol = g.solCol; R.ambS = g.ambS; R.ambG = g.ambG; R.niebla = g.niebla; R.lin = g.lin; R.expo = g.expo;
}
const DIB = { ms: {} };   // tiempos de cada parte (para medir)
function dibujar() {
  const gl = R.gl, W = R.cv.width, H = R.cv.height;
  if (JUEGO.estado === 'principal' && typeof dibujarMenu === 'function' && MENU.el) { dibujarMenu(); pantFinCuadro(false); return; }
  // (en la pausa, Perfil y Personajes muestran tu personaje en 3D como en el menú: se dibuja el lobby con su cámara, sin
  // tocar la de la partida)
  if (JUEGO.estado === 'juego' && typeof dibujarMenu === 'function' && MENU.lobby && ((typeof RB !== 'undefined' && RB.el && RB.el.classList.contains('rb3d') && !RB.el.classList.contains('oc')) || (typeof PJI !== 'undefined' && PJI.vista3d))) {
    const p = CAM.pos.clone(), q = CAM.q.clone(), qv = CAM.qVista.clone(), f = CAM.fov;
    lobbyCamara(CAM); CAM.qVista.copy(CAM.q).mul(MEDIA_VUELTA); dibujarMenu();
    CAM.pos.copy(p); CAM.q.copy(q); CAM.qVista.copy(qv); CAM.fov = f; pantFinCuadro(false); return;
  }
  const asp = W / H, cerca = 0.08, lejos = vistaLejos() * 1.05, fovy = CAM.fov * Math.PI / 180;
  const P = M4.persp(fovy, asp, cerca, lejos), V = M4.view(CAM.pos, CAM.qVista);
  m4mul(P, V, R.vp); R.fr = frustum(R.vp); R.camPos.copy(CAM.pos); R.camF.copy(CAM.fwd); R.lejos = vistaLejos();
  R.lodK = H / (2 * Math.tan(fovy / 2));   // (píxeles por metro a un metro: para los niveles de detalle)
  (R.vpMundo || (R.vpMundo = new Float32Array(16))).set(R.vp);
  R.dibujadas = 0; R.tris = 0; R.marca++; R.cuadro = (R.cuadro || 0) + 1; R.msCuadro = performance.now();
  // (memoria baja: cada 5 s, las texturas que no se dibujan hace 30 s se sacan de la placa —texPodar, gl.js—)
  if (GFX.memBaja && R.msCuadro - (R.podaT || 0) > 5000) { R.podaT = R.msCuadro; texPodar(R.msCuadro); }
  // cómo sale la imagen según la calidad
  const usaPost = GFX.luz >= 2 && (GFX.hdr || GFX.ao || GFX.fxaa) && postPreparar();
  R.salida = GFX.luz < 2 ? 'gam' : usaPost && PO.hdr ? 'hdr' : 'ldr'; R.usaPost = usaPost;
  R.sombraOn = GFX.luz >= 2 && GFX.sombra > 0 && SM.n > 0 && !MUNDO.sinSombra && !R.sinSombraDbg;
  R.conAO = !!(usaPost && GFX.ao > 0 && PO.ao.length);
  R.aoActivo = false;
  const nieAntes = aguaNiebla();   // (debajo del agua: la niebla de cerca, del color del agua)
  if (R.salida !== 'gam') luzLineal();
  // juntar todo lo que hay que dibujar (el mapa fijo marcado aparte para la copia de sombras)
  const t0 = performance.now();
  R.fase = 'mundo'; dibujarMundo(); R.fase = '';
  if (typeof gmrAntes === 'function') gmrAntes();   // (el Lua de los addons dibuja: sus primitivas y qué modelos se ven)
  dibujarObjetos(); aguaEncolar(); maqDibujar(); artDibujar(); if (typeof eventoEncolar === 'function') eventoEncolar();
  if (typeof dibujarPersonas === 'function') dibujarPersonas();
  if (typeof dibujarHerramientas === 'function') dibujarHerramientas();
  dibujarEntidades();
  if (JUEGO.estado === 'juego') { cicDibujar(); verDibujar(); nocheDibujar(); }
  dibujarProyectiles();
  lucesJuntar(); lucesPreparar(); espPreparar();
  if (JUEGO.estado === 'juego' && R.sombraOn) {
    const h = raycast(vadd(CAM.pos, vscale(R.sol, 0.3)), R.sol, 300, JUG.vehiculo ? JUG.vehiculo.b : null), meta = h ? 0.28 : 1;
    R.solVista = R.solVista === undefined ? meta : R.solVista + (meta - R.solVista) * Math.min(1, TIEMPO.dt * 6);
  } else R.solVista = 1;
  const t1 = performance.now();
  if (R.sombraOn) sombrasActualizar();
  // (la sombra de la linterna propia, si está prendida y la calidad la tiene: sombras.js)
  R.espShOn = GFX.espSh > 0 && !!ESH.tex && R.espShI >= 0 && JUEGO.estado === 'juego' && !DBG.sinEsh;   // (DBG.sinEsh: para comparar en las pruebas)
  if (R.espShOn) espSombraActualizar();
  const t2 = performance.now();
  armarCola();
  aguaReflejo(P, V);
  portalesVista(P, V);
  if (usaPost) postEmpezar(); else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); }
  const N = R.salida === 'gam' ? R.niebla.c : R.lin.nieC;
  gl.clearColor(N[0], N[1], N[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const c3d = JUEGO.estado === 'juego' && cielo3dDibujar(fovy, asp);   // (el cielo 3D de los mapas de GMod: de fondo, antes que todo)
  if (R.conAO) {
    // (la pasada previa sólo deja el color de fondo: no se guarda y después se vuelve a borrar, que en las GPU de celu no se
    // trae de la memoria; con el cielo 3D de GMod el color ya tiene ese cielo y se queda)
    dibujarProfundidad(); if (!c3d) descartar(gl.COLOR_ATTACHMENT0); postAO(cerca, lejos, fovy);
    if (!c3d) { gl.clearColor(N[0], N[1], N[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.depthFunc(gl.LEQUAL); gl.depthMask(false); dibujarOpacos(); gl.depthMask(true); gl.depthFunc(gl.LESS);
  } else dibujarOpacos();
  dibujarMarcas();
  portalesQuad();
  if (!AGUA.bajo && !c3d) { dibujarCielo(M4.inv(R.vp)); if (typeof eventoCieloDibujar === 'function') eventoCieloDibujar(); }
  if (typeof nvDibujar === 'function') nvDibujar();   // (el hongo de una nuclear, con volumen: después del cielo y antes de lo transparente)
  dibujarTransparentes();
  if (typeof gmrDibujar === 'function') gmrDibujar('mundo');
  dibujarEfectos(); nukeDibujar();
  dibujarRayoFisica(); dibujarTrazas(); dibujarLineas();
  itemsLimpiar();
  // el arma en la mano, encima de todo (en una franja de profundidad propia)
  if (JUEGO.estado === 'juego') {
    const P2 = M4.persp(60 * Math.PI / 180, asp, 0.01, 20); m4mul(P2, V, R.vp); R.fr = frustum(R.vp); R.marca++;
    R.fase = 'vista';
    if (dibujarVista()) { if (typeof gmrVistaArma === 'function') gmrVistaArma(); gl.depthRange(0, 0.04); armarCola(); dibujarOpacos(); dibujarTransparentes(); if (typeof gmrDibujar === 'function') gmrDibujar('vista'); gl.depthRange(0, 1); }
    R.fase = ''; itemsLimpiar();
  }
  const t3 = performance.now();
  if (usaPost) postTerminar();
  if (nieAntes) R.niebla = nieAntes;
  pantFinCuadro(usaPost); // (alfa 1 en toda la imagen y el hueco de la pantalla de video)
  DIB.ms.juntar = t1 - t0; DIB.ms.sombras = t2 - t1; DIB.ms.escena = t3 - t2; DIB.ms.post = performance.now() - t3;
  if (JUEGO.foto > 0) { JUEGO.foto--; if (JUEGO.foto === 0) { if (JUEGO.fotoCb) { JUEGO.fotoCb(); JUEGO.fotoCb = null; } else fotoGuardar(); } }
}
function fotoGuardar() {
  try { R.cv.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'rezobox_' + Date.now() + '.png'; a.click(); aviso('Foto guardada'); }); } catch (e) {}
}
// ---------------- inicio ----------------
// Arranque a prueba de fallas: cada paso queda anotado; si algo se rompe (un celular con un driver raro) se prueba solo
// con el otro motor (WebGL 1 ↔ 2) y después con la calidad más baja; si igual no anda, se ve el error en pantalla
// en vez de quedar en la intro para siempre.
const INI = { paso: 'inicio', ok: false };
function iniFallos(n) { try { if (n === undefined) return +localStorage.getItem('jx_fallos') || 0; localStorage.setItem('jx_fallos', String(n)); } catch (e) {} return 0; }
function iniError(titulo, detalle, botones) {
  INI.err = true; const c = $('carga'), e = $('cargaErr'); c.classList.remove('salir', 'oc'); c.classList.add('fallo'); e.innerHTML = ''; if (window.__carga) window.__carga.ayuda = true;
  e.innerHTML = '<b>' + titulo + '</b><small>' + detalle + '</small>'; e.classList.add('ve');
  for (const [t, f] of botones || []) { const b = document.createElement('button'); b.textContent = t; b.onclick = f; e.appendChild(b); }
}
function falloInicio(err) {
  if (INI.ok) return;
  const msg = String((err && (err.message || err)) || 'error').slice(0, 300), motor = R.gl ? (R.gl1 ? 'WebGL 1' : 'WebGL 2') : '-';
  try { localStorage.setItem('jx_ultimoError', motor + ' · ' + INI.paso + ' · ' + msg); } catch (e) {}
  const n = iniFallos();
  if (n < 2 && !TEST) {
    iniFallos(n + 1);
    if (n === 0) PREFS.motor = R.gl && !R.gl1 ? 'webgl1' : 'webgl2'; else { PREFS.gfx = 'patata'; PREFS.res = Math.min(PREFS.res || 70, 60); }
    guardarPrefs(); location.reload(); return;
  }
  iniError('No pudo arrancar en este aparato', motor + ' · ' + INI.paso + ' · ' + msg, [
    ['Reintentar', () => { iniFallos(0); location.reload(); }],
    ['Probar ' + (R.gl && !R.gl1 ? 'WebGL 1' : 'WebGL 2'), () => { iniFallos(2); PREFS.motor = R.gl && !R.gl1 ? 'webgl1' : 'webgl2'; guardarPrefs(); location.reload(); }],
  ]);
}
async function iniciar() {
  // (la pantalla de carga muestra cada paso; si uno no avanza, su vigilante avisa y ofrece reintentar o el modo liviano)
  const CG = window.__carga || { set() {}, log() {}, fin(cb) { if (cb) cb(); $('carga').classList.add('oc'); } };
  // (lo de antes del juego, bajar y leer el archivo, ocupa hasta el 40 % de la barra: los pasos del juego van del 40 al 100)
  const cgp = (p) => 0.4 + p * 0.6, paso = (s, p, k) => { INI.paso = s; if (k) CG.set(cgp(p), k); };
  try {
    // (el juego arranca antes de que termine de bajar el paquete: mientras baja, la barra la lleva la pantalla de carga con
    // lo que llegó; acá sólo se anota el paso)
    paso('motor gráfico', 0, document.readyState === 'loading' ? null : 'abrir');
    cierreIniciar(); if (typeof iosIniciar === 'function') iosIniciar();
    try { glIniciar(); } catch (e) {
      if (e && e.message === 'webgl') { iniError('Este aparato no tiene WebGL', 'Probá con Chrome actualizado.'); return; }
      throw e;
    }
    R.aniso = R.gl.getExtension('EXT_texture_filter_anisotropic');
    if (R.aniso) R.anisoMax = R.gl.getParameter(R.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    CG.log('abrir', (R.gl1 ? 'WebGL 1' : 'WebGL 2') + ' · ' + R.gl.getParameter(R.gl.MAX_TEXTURE_SIZE) + ' px');
    paso('datos del juego', 0.05, document.readyState === 'loading' ? null : 'datos');
    let montado = false;
    await cargarPaquete((k) => { if (k >= 0.6 && !montado) { montado = true; CG.log('datos', [[Object.keys(PK.idx).length, 4], [(PK.u8.length / 1048576).toFixed(1) + ' MB']]); } CG.set(cgp(0.05 + k * 0.7), k < 0.6 ? 'datos' : 'modelos'); });
    CG.log('modelos', [[Object.keys(DATA.pfPorNombre).length, 0], [Object.keys(DATA.anPorNombre).length, 1], [MAPAS.length, 2]]);
    // (entre paso y paso, un respiro para que la barra se dibuje)
    const respiro = () => new Promise((ok) => setTimeout(ok, 0));
    paso('gráficos', 0.78, 'graficos'); await respiro(); try { await celuDetectar(); } catch (e) {} if (typeof gfxAutoUnaVez === 'function') gfxAutoUnaVez(); GFX.base = perfilInicial();
    if (CIERRE.n > 0) { const i = PERF_ORDEN.indexOf(GFX.base); GFX.base = PERF_ORDEN[Math.max(0, (i < 0 ? 2 : i) - CIERRE.n)]; if (CIERRE.nuevo && PREFS.gfx === 'auto') setTimeout(() => aviso(T('gfx.cierre'), 5), 2500); }
    aplicarGfx();
    paso('efectos', 0.84, 'graficos'); await respiro(); efectosIniciar(); marcasIniciar();
    CG.log('graficos', Math.round(GFX.escala * 100) + '% · ' + GFX.lejos + ' m');
    paso('interfaz', 0.9, 'menus'); await respiro(); if (typeof cuentaIniciar === 'function') cuentaIniciar(); if (typeof gorrosNuevos === 'function') gorrosNuevos(); uiIniciar(); entradaIniciar();
    paso('menú', 0.95, 'menus'); await respiro(); menuIniciar(); pantallaIniciar(); armasHL2();
    paso('primer cuadro', 0.98, 'menus');
    if (Q.get('mapa')) empezarPartida(Q.get('mapa'));
    else { JUEGO.estado = 'principal'; inicioMostrar(true); }
    cuadro(performance.now());
    CG.log('menus', R.cv.width + '×' + R.cv.height);
  } catch (e) { console.error(e); falloInicio(e); return; }
  INI.ok = true; INI.paso = 'listo';
  const fallos = iniFallos(); iniFallos(0);
  if (fallos > 0) setTimeout(() => aviso(R.gl1 ? 'Arrancó con WebGL 1' : 'WebGL 1 falló en este aparato: uso WebGL 2'), 1500);
  addEventListener('pointerdown', audioIniciar, { once: false });
  // (las pruebas automáticas, con todos los paquetes aparte ya bajados, salvo que prueben justamente la bajada: ?perezoso)
  if (navigator.webdriver && DATA.rbp && !Q.has('perezoso')) await rbAsegurarTodos(Object.keys(DATA.rbp));
  window.__listo = true;
  window.__ev = (s) => eval(s);
  setTimeout(() => { if (typeof gmArrancar === 'function') gmArrancar(); }, 500);   // (los addons de GMod instalados)
  setTimeout(() => { if (typeof cnRevisar === 'function') cnRevisar(); }, 1200);   // (si la vez anterior se trabó: el registro)
  setTimeout(() => { if (typeof bancoSeguir === 'function') bancoSeguir(); }, 900);   // (una comparación de FPS a medias)
  // listo: la pantalla de carga se va sola (aunque algo de la pantalla falle, se va igual)
  CG.fin(() => { PANT.enIntro = false; try { pantallaRevisar(); } catch (e) { console.warn(e); } });
}
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && JUEGO.estado === 'juego' && !UI.abierto && !ENT.tactil && !TEST) abrirPausa(); });
iniciar();
