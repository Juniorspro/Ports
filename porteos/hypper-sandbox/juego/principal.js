// ---------------------------------------------------------------------------------------------------------
// arranque, preferencias, perfiles gráficos (con "patata" para teléfonos muy flojos), cámara y el bucle.
// ---------------------------------------------------------------------------------------------------------
const JUEGO = { estado: 'carga', dios: false, foto: 0 };
const TIEMPO = { t: 0, dt: 0, acc: 0, fps: 60, cuadros: 0, medT: 0, ms: 0 };
// calidades: luz (0 difuso viejo, 1 con brillo, 2 física, 3 física + extras), sombras del sol en cascadas
// (cuántas, tamaño del atlas, hasta qué distancia, filtro), luces puntuales, HDR, oclusión ambiental,
// resplandor, rayos de sol, antialias, nubes y relieve de las texturas
const PERFILES = {
  patata: { res: 45, lejos: 160, texMax: 128, lod: 9, sub: 5, part: 0.25, aniso: 0, luz: 0, sombra: 0 },
  bajo: { res: 60, lejos: 250, texMax: 256, lod: 2, sub: 6, part: 0.5, aniso: 0, luz: 1, sombra: 0 },
  medio: { res: 75, lejos: 450, texMax: 256, lod: 1, sub: 8, part: 0.8, aniso: 2, luz: 2, sombra: 1, smTam: 1024, sDist: 45, pcf: 1, nluz: 4 },
  alto: { res: 100, lejos: 750, texMax: 0, lod: 0, sub: 10, part: 1, aniso: 8, luz: 2, sombra: 2, smTam: 2048, sDist: 110, pcf: 9, nluz: 6, hdr: 1, ao: 1, bloom: 1, fxaa: 1, nubes: 1 },
  ultra: { res: 100, lejos: 1100, texMax: 0, lod: 0, sub: 10, part: 1, aniso: 16, luz: 3, sombra: 3, smTam: 4096, sDist: 220, pcf: 9, pcss: 1, nluz: 8, hdr: 1, ao: 2, bloom: 2, rayos: 1, fxaa: 1, nubes: 1, det: 1 },
};
const PERF_ORDEN = ['patata', 'bajo', 'medio', 'alto', 'ultra'];
const PREFS_DEF = { modo: 'libre', codigo: '', salaLibre: 1, nombre: 'Player' + ((Math.random() * 900 + 100) | 0), mapa: 'Desert', skin: 'Hero', gorro: 'HatEmpty', gfx: 'auto', res: 70, lejos: 350, sens: 12, vol: 80, fps: true,
  sombras: 'auto', post: 'auto', texQ: 'auto', ocultarUI: false, contorno: true, motor: 'webgl1' };
let PREFS = Object.assign({}, PREFS_DEF);
try { Object.assign(PREFS, JSON.parse(localStorage.getItem('hypper_prefs') || '{}')); } catch (e) {}
if (Q.get('gfx')) PREFS.gfx = Q.get('gfx');
function guardarPrefs() { try { localStorage.setItem('hypper_prefs', JSON.stringify(PREFS)); } catch (e) {} }
const GFX = { escala: 0.7, lejos: 350, texMax: 256, lod: 1, sub: 8, part: 0.8, aniso: 0, auto: true, luz: 0, sombra: 0 };
// adivinar la gama del aparato la primera vez
function perfilInicial() {
  const mem = navigator.deviceMemory || 4, nuc = navigator.hardwareConcurrency || 4;
  let gpu = '';
  try { const d = R.gl.getExtension('WEBGL_debug_renderer_info'); gpu = d ? R.gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) {}
  gpu = (Q.get('gpu') || gpu || '').toLowerCase();
  if (/mali-[gt]?[4-7]\d|adreno \(tm\) [3-5]\d\d|powervr|sgx|mali-4|adreno 30/.test(gpu) || mem <= 2 || nuc <= 2) return 'patata';
  if (COARSE && (mem <= 4 || /adreno \(tm\) 6[0-2]\d|mali-g5/.test(gpu))) return 'bajo';
  if (COARSE) return 'medio';
  if (/rtx|radeon rx [5-9]\d{3}|rx [67]\d{3}|apple m\d|gtx 1[06-9]\d|gtx 16|arc\(tm\) a|arc a\d/.test(gpu) && nuc >= 6) return 'ultra';
  return 'alto';
}
function aplicarGfx() {
  const nom = PREFS.gfx === 'auto' ? (GFX.base || 'medio') : PREFS.gfx, p = PERFILES[nom] || PERFILES.medio;
  GFX.nombre = PERFILES[nom] ? nom : 'medio';
  GFX.auto = PREFS.gfx === 'auto';
  GFX.escala = (PREFS.gfx === 'auto' ? p.res : PREFS.res) / 100; GFX.escalaMax = GFX.escala;
  GFX.lejos = PREFS.gfx === 'auto' ? p.lejos : PREFS.lejos;
  GFX.texMax = p.texMax; GFX.lod = p.lod; GFX.sub = p.sub; GFX.part = p.part; GFX.aniso = p.aniso;
  for (const k of ['luz', 'sombra', 'smTam', 'sDist', 'pcf', 'pcss', 'nluz', 'hdr', 'ao', 'bloom', 'rayos', 'fxaa', 'nubes', 'det']) GFX[k] = p[k] || 0;
  // lo que el jugador cambió a mano (como en los ajustes del juego: Sombra, Postprocesado, Calidad de textura)
  if (PREFS.sombras !== 'auto' && GFX.luz >= 2) {
    const s = +PREFS.sombras, T = [null, [1, 1024, 45, 1, 0], [2, 2048, 110, 9, 0], [3, 4096, 220, 9, 1]][s];
    if (!T) GFX.sombra = 0; else { GFX.sombra = T[0]; GFX.smTam = T[1]; GFX.sDist = T[2]; GFX.pcf = T[3]; GFX.pcss = T[4]; }
  }
  if (PREFS.post === 'no') { GFX.hdr = GFX.ao = GFX.bloom = GFX.rayos = GFX.fxaa = 0; }
  else if (PREFS.post === 'si' && GFX.luz >= 2 && !GFX.hdr) { GFX.hdr = 1; GFX.ao = 1; GFX.bloom = 1; GFX.fxaa = 1; }
  if (PREFS.texQ !== 'auto') GFX.texMax = { baja: 128, media: 256, alta: 0 }[PREFS.texQ] === undefined ? GFX.texMax : { baja: 128, media: 256, alta: 0 }[PREFS.texQ];
  // lo que el aparato no puede hacer (WebGL 1 sin alguna extensión) se apaga en cualquier calidad
  if (R.gl) {
    if (!R.fsAlta) GFX.luz = Math.min(GFX.luz, 1);
    if (!R.depthTex) { GFX.sombra = 0; GFX.ao = 0; GFX.rayos = 0; }
    if (!R.deriv) GFX.det = 0;
  }
  if (R.gl) {
    progsLimpiar();
    if (GFX.luz >= 2 && GFX.sombra > 0) { if (!sombrasIniciar(GFX.sombra, Math.min(GFX.smTam, R.gl.getParameter(R.gl.MAX_TEXTURE_SIZE)))) GFX.sombra = 0; }
    else sombrasLiberar();
    if (!(GFX.luz >= 2 && (GFX.hdr || GFX.ao || GFX.fxaa))) postLiberar();
  }
  PH.sub = GFX.sub; R.lejos = GFX.lejos;
  if (MUNDO.nombre) {
    const aj = DATA.aj[MUNDO.nombre] || {};
    if (!(aj.fog && aj.fd > 0) && MUNDO.nombre !== 'Space') { R.niebla.a = GFX.lejos * 0.7; R.niebla.b = GFX.lejos; }
  }
  if (AUD.master) AUD.master.gain.value = PREFS.vol / 100;
  ENT.sens = 0.00018 * PREFS.sens; ENT.sensT = ENT.sens * 2.6;
  redimensionar();
}
function redimensionar() {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = VW(), h = VH(), k = dpr * GFX.escala;
  R.cv.width = Math.max(160, Math.round(w * k)); R.cv.height = Math.max(120, Math.round(h * k));
}
addEventListener('resize', () => R.cv && redimensionar());
// ---------------- cámara ----------------
const CAM = { pos: v3(), q: new Quat(), qVista: new Quat(), fwd: v3(0, 0, 1), der: v3(1, 0, 0), arr: v3(0, 1, 0), fov: 70, temblor: 0 };
function camaraActualizar(dt) {
  if (JUEGO.estado === 'principal' && typeof lobbyCamara === 'function') { lobbyCamara(CAM); CAM.qVista.copy(CAM.q).mul(MEDIA_VUELTA); return; }
  jugadorCamara(CAM);
  if (CAM.temblor > 0) { CAM.temblor = Math.max(0, CAM.temblor - dt * 1.5); const k = CAM.temblor * 0.03; CAM.q.mul(Quat.euler((Math.random() - 0.5) * k, (Math.random() - 0.5) * k)); }
  CAM.qVista.copy(CAM.q).mul(MEDIA_VUELTA);
  CAM.fwd.copy(CAM.q.rot(v3(0, 0, 1)));
  CAM.der.copy(CAM.qVista.rot(v3(1, 0, 0))); CAM.arr.copy(CAM.qVista.rot(v3(0, 1, 0)));
  const z = ARM.zoom ? 18 : 70; CAM.fov += (z - CAM.fov) * Math.min(1, dt * 12);
}
// ---------------- partidas ----------------
const DESHACER = [];
function empezarPartida(mapa) {
  audioIniciar();
  for (const o of OBJS.slice()) borrarObjeto(o);
  PH.bodies.length = 0; PH.joints.length = 0; PROY.length = 0; PART.l.length = 0;
  if (typeof personasLimpiar === 'function') personasLimpiar();
  cargarMapa(mapa); aplicarGfx();
  jugadorAparecer();
  ARM.lista = ['RPG', 'Pistol', 'Camera', 'Hands', 'ToolBaton', 'PhysicsGun'];
  if (typeof SALA !== 'undefined' && SALA && !SALA.rpg) ARM.lista = ARM.lista.filter((a) => a !== 'RPG');
  ARM.balas = {}; elegirArma(ARM.lista.length - 1);
  if (typeof menuMostrar === 'function') menuMostrar(false); $('hud').classList.remove('oc');
  JUEGO.estado = 'juego'; cerrarPaneles();
  if (typeof jugadorCuerpoNuevo === 'function') jugadorCuerpoNuevo();
  if (typeof redEntrar === 'function') redEntrar(mapa);
  aviso(mapa, 2.5);
  if (typeof MENU !== 'undefined' && MENU.cargarGuardado) { MENU.cargarGuardado = false; cargarConstruccion(); }
}
function irMenuPrincipal() {
  if (typeof redSalir === 'function') redSalir();
  JUEGO.estado = 'principal'; $('hud').classList.add('oc'); soltarPuntero(); cerrarPaneles();
  if (typeof SALA !== 'undefined') SALA = null;
  HOST.ds = false;
  menuMostrar(true);
}
function morirJugador() {
  JUG.vivo = false; JUG.muertoT = 3; soltarAgarre(); soltarGrav();
  if (JUG.vehiculo) salirVehiculo();
  if (typeof jugadorRagdoll === 'function') jugadorRagdoll();
  aviso('Te moriste', 3);
}
function guardarConstruccion() {
  const L = OBJS.filter((o) => o.dueno === 'yo').map((o) => ({ n: o.nombre, p: [o.b.pos.x, o.b.pos.y, o.b.pos.z].map((x) => +x.toFixed(3)), q: [o.b.q.x, o.b.q.y, o.b.q.z, o.b.q.w].map((x) => +x.toFixed(4)), f: o.b.frozen ? 1 : 0 }));
  try { localStorage.setItem('hypper_save_' + MUNDO.nombre, JSON.stringify(L)); aviso(`Guardado (${L.length} cosas)`); } catch (e) { aviso('No se pudo guardar'); }
}
function cargarConstruccion() {
  let L = []; try { L = JSON.parse(localStorage.getItem('hypper_save_' + MUNDO.nombre) || '[]'); } catch (e) {}
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
    if (k === 'pausa') { if (UI.abierto) cerrarPaneles(); else abrirPausa(); continue; }
    if (k === 'cerrar') { cerrarPaneles(); continue; }
    if (k === 'menu') { if (UI.abierto === 'spawn') cerrarPaneles(); else { cerrarPaneles(); abrirSpawn(); } continue; }
    if (UI.abierto) continue;
    if (k === 'chat') abrirChat();
    else if (k === 'camara') { if (JUG.vehiculo) { JUG.fpVeh = !JUG.fpVeh; JUG.yaw = JUG.fpVeh ? 0 : JUG.yaw; } else JUG.tercera = !JUG.tercera; }
    else if (k === 'emotes') abrirEmotes();
    else if (k === 'recargar') recargar();
    else if (k === 'usar') { if (typeof usar === 'function') usar(); }
    else if (k === 'salir') { if (JUG.vehiculo) salirVehiculo(); }
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
const _proj = new Float32Array(16), _vp2 = new Float32Array(16);
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const t = ahora / 1000, dt = Math.min(0.1, Math.max(0, t - (TIEMPO.ult || t))); TIEMPO.ult = t; TIEMPO.dt = dt; TIEMPO.t += dt;
  const t0 = performance.now();
  if (JUEGO.estado === 'carga') return;
  entradaLeer(); atenderPulsos();
  // mirar
  const mx = ENT.dx, my = ENT.dy; ENT.dx = ENT.dy = 0; ENT.mdx = mx;
  ENT.rdx = 0; ENT.rdy = 0;
  if (JUEGO.estado === 'juego' && !UI.abierto) {
    if (ARM.rotando) { ENT.rdx = mx; ENT.rdy = my; }
    else { JUG.yaw -= mx * ENT.sens * (ARM.zoom ? 0.25 : 1); JUG.pitch = clamp(JUG.pitch + my * ENT.sens * (ARM.zoom ? 0.25 : 1), -1.55, 1.55); }
  }
  // simulación con paso fijo
  TIEMPO.acc += dt; const paso = 1 / 60; let n = 0;
  while (TIEMPO.acc >= paso && n < 3) {
    TIEMPO.acc -= paso; n++;
    if (JUEGO.estado === 'juego') {
      const ent = UI.abierto ? { x: 0, y: 0, saltar: false, agachar: false, correr: false } : ENT;
      jugadorPaso(paso, ent);
      if (typeof vehiculosPaso === 'function') vehiculosPaso(paso, ent);
    }
    physStep(paso);
    for (const b of PH.bodies) if (b.dead && b.obj) { borrarObjeto(b.obj); break; }
    if (typeof personasPaso === 'function') personasPaso(paso);
  }
  if (n === 3) TIEMPO.acc = 0;
  if (JUEGO.estado === 'juego') {
    armasPaso(dt);
    if (!JUG.vivo && JUG.muertoT <= 0) { jugadorAparecer(); if (typeof jugadorCuerpoNuevo === 'function') jugadorCuerpoNuevo(); }
    if (typeof herramientasPaso === 'function') herramientasPaso(dt);
    if (typeof redPaso === 'function') redPaso(dt);
    diaPaso(dt); hostPaso();
  }
  efectosPaso(dt);
  camaraActualizar(dt);
  dibujar();
  buclesFin();
  hudActualizar(dt);
  // fps y resolución automática
  TIEMPO.cuadros++; TIEMPO.medT += dt; TIEMPO.ms += performance.now() - t0;
  if (TIEMPO.medT >= 1) {
    TIEMPO.fps = TIEMPO.cuadros / TIEMPO.medT; const ms = TIEMPO.ms / TIEMPO.cuadros; TIEMPO.msProm = ms;
    $('fps').textContent = PREFS.fps ? `${Math.round(TIEMPO.fps)} fps` : '';
    if (GFX.auto && JUEGO.estado === 'juego' && !UI.abierto && !TEST) {
      if (TIEMPO.fps < 48 && GFX.escala > 0.5) { GFX.escala = Math.max(0.5, GFX.escala - 0.08); redimensionar(); TIEMPO.bajos = 0; }
      else if (TIEMPO.fps > 58 && ms < 9 && GFX.escala < GFX.escalaMax) { GFX.escala = Math.min(GFX.escalaMax, GFX.escala + 0.04); redimensionar(); }
      // ya en la resolución mínima y sigue lento: bajar una calidad entera (y no volver a subir en esta partida)
      if (TIEMPO.fps < 40 && GFX.escala <= 0.5) {
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
  const P = M4.persp(60 * Math.PI / 180, W / H, 0.08, 50), V = M4.view(CAM.pos, CAM.qVista);
  m4mul(P, V, R.vp); R.fr = frustum(R.vp); R.camPos.copy(CAM.pos); R.marca++; R.luces.length = 0; R.nLuces = 0;
  dibujarLobby(); dibujarCola();
  R.sol.copy(g.sol); R.solCol = g.solCol; R.ambS = g.ambS; R.ambG = g.ambG; R.niebla = g.niebla; R.lin = g.lin; R.expo = g.expo;
}
const DIB = { ms: {} };   // tiempos de cada parte (para medir)
function dibujar() {
  const gl = R.gl, W = R.cv.width, H = R.cv.height;
  if (JUEGO.estado === 'principal' && typeof dibujarMenu === 'function' && MENU.el) return dibujarMenu();
  const asp = W / H, cerca = 0.08, lejos = GFX.lejos * 1.05, fovy = CAM.fov * Math.PI / 180;
  const P = M4.persp(fovy, asp, cerca, lejos), V = M4.view(CAM.pos, CAM.qVista);
  m4mul(P, V, R.vp); R.fr = frustum(R.vp); R.camPos.copy(CAM.pos); R.camF.copy(CAM.fwd); R.lejos = GFX.lejos;
  (R.vpMundo || (R.vpMundo = new Float32Array(16))).set(R.vp);
  R.dibujadas = 0; R.tris = 0; R.marca++; R.cuadro = (R.cuadro || 0) + 1;
  // cómo sale la imagen según la calidad
  const usaPost = GFX.luz >= 2 && (GFX.hdr || GFX.ao || GFX.fxaa) && postPreparar();
  R.salida = GFX.luz < 2 ? 'gam' : usaPost && PO.hdr ? 'hdr' : 'ldr';
  R.sombraOn = GFX.luz >= 2 && GFX.sombra > 0 && SM.n > 0 && !MUNDO.sinSombra && !R.sinSombraDbg;
  R.conAO = !!(usaPost && GFX.ao > 0 && PO.ao.length);
  R.aoActivo = false;
  if (R.salida !== 'gam') luzLineal();
  // juntar todo lo que hay que dibujar (el mapa fijo marcado aparte para la copia de sombras)
  const t0 = performance.now();
  R.fase = 'mundo'; dibujarMundo(); R.fase = '';
  dibujarObjetos();
  if (typeof dibujarPersonas === 'function') dibujarPersonas();
  if (typeof dibujarHerramientas === 'function') dibujarHerramientas();
  dibujarProyectiles();
  lucesJuntar(); lucesPreparar();
  if (JUEGO.estado === 'juego' && R.sombraOn) {
    const h = raycast(vadd(CAM.pos, vscale(R.sol, 0.3)), R.sol, 300, JUG.vehiculo ? JUG.vehiculo.b : null), meta = h ? 0.28 : 1;
    R.solVista = R.solVista === undefined ? meta : R.solVista + (meta - R.solVista) * Math.min(1, TIEMPO.dt * 6);
  } else R.solVista = 1;
  const t1 = performance.now();
  if (R.sombraOn) sombrasActualizar();
  const t2 = performance.now();
  armarCola();
  if (usaPost) postEmpezar(); else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); }
  const N = R.salida === 'gam' ? R.niebla.c : R.lin.nieC;
  gl.clearColor(N[0], N[1], N[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (R.conAO) {
    dibujarProfundidad(); postAO(cerca, lejos, fovy);
    gl.depthFunc(gl.LEQUAL); gl.depthMask(false); dibujarOpacos(); gl.depthMask(true); gl.depthFunc(gl.LESS);
  } else dibujarOpacos();
  dibujarMarcas();
  dibujarCielo(M4.inv(R.vp));
  dibujarTransparentes();
  dibujarEfectos();
  dibujarRayoFisica(); dibujarTrazas(); dibujarLineas();
  itemsLimpiar();
  // el arma en la mano, encima de todo (en una franja de profundidad propia)
  if (JUEGO.estado === 'juego') {
    const P2 = M4.persp(60 * Math.PI / 180, asp, 0.01, 20); m4mul(P2, V, R.vp); R.fr = frustum(R.vp); R.marca++;
    R.fase = 'vista';
    if (dibujarVista()) { gl.depthRange(0, 0.04); armarCola(); dibujarOpacos(); dibujarTransparentes(); gl.depthRange(0, 1); }
    R.fase = ''; itemsLimpiar();
  }
  const t3 = performance.now();
  if (usaPost) postTerminar();
  DIB.ms.juntar = t1 - t0; DIB.ms.sombras = t2 - t1; DIB.ms.escena = t3 - t2; DIB.ms.post = performance.now() - t3;
  if (JUEGO.foto > 0) { JUEGO.foto--; if (JUEGO.foto === 0) fotoGuardar(); }
}
function fotoGuardar() {
  try { R.cv.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'hypper_' + Date.now() + '.png'; a.click(); aviso('Foto guardada'); }); } catch (e) {}
}
// ---------------- inicio ----------------
async function iniciar() {
  try {
    glIniciar();
  } catch (e) { $('carga').innerHTML = '<div style="padding:20px;text-align:center">Este aparato no tiene WebGL.<br>Probá con Chrome actualizado.</div>'; return; }
  R.aniso = R.gl.getExtension('EXT_texture_filter_anisotropic');
  if (R.aniso) R.anisoMax = R.gl.getParameter(R.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
  await cargarPaquete((k) => ($('cargaB').style.width = k * 100 + '%'));
  $('cargaLogo').src = icono('c'); $('cargaLogo').style.display = 'block';
  GFX.base = perfilInicial(); aplicarGfx();
  efectosIniciar(); marcasIniciar(); uiIniciar(); entradaIniciar();
  menuIniciar(); pantallaIniciar();
  $('carga').classList.add('oc');
  if (Q.get('mapa')) empezarPartida(Q.get('mapa'));
  else { JUEGO.estado = 'principal'; menuMostrar(true); }
  addEventListener('pointerdown', audioIniciar, { once: false });
  requestAnimationFrame(cuadro);
  window.__listo = true;
  window.__ev = (s) => eval(s);
}
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && JUEGO.estado === 'juego' && !UI.abierto && !ENT.tactil && !TEST) abrirPausa(); });
iniciar();
