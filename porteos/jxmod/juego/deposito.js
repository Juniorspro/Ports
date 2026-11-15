// ---------------- JXMod: el menú principal «Tu depósito» ----------------
// El concepto que eligió el dueño después de tres maquetas (tu terreno + la pila de cajas + el plano), combinado y menos
// confuso. Reemplaza la portada de la 3.4 (que se parecía demasiado al lobby de otro juego). Es una escena 3D de verdad,
// con el motor del juego: el pasto de Pradera, de fondo la torre JX y, a la izquierda, tu personaje en tercera persona con
// la pistola de física. Cada sección es una caja de madera en un lugar fijo, en tres pilas que miran de frente:
//  · «VOS»: Emotes arriba y Personajes abajo;
//  · «CREAR»: Crear mapa arriba; Workshop y Mods y mapas abajo;
//  · «JUGAR CON OTROS»: Multijugador y, al lado, el barril violeta de La grieta (el evento).
// Cada caja lleva una chapa atornillada (HTML encima de la caja: el texto queda nítido, se traduce y no se mueve) con el
// ícono, la palabra y un dato de verdad (cuántos emotes, cuántos personajes, mods activos, gente en línea…). La cámara es
// fija y se encuadra para cada pantalla (depEncuadre), así cada caja y su chapa caen siempre en el mismo lugar.
//  · La primera vez (o cuando hay algo nuevo en una caja) las cajas caen con la física del juego y terminan exactamente en
//    su lugar; JUGAR se puede tocar desde el primer momento.
//  · Al tocar una caja, el haz de la pistola de física de tu personaje la agarra y la trae hacia la cámara; ahí se abre el
//    panel de siempre de esa sección (los del menú 3.4). Al volver del panel, la caja vuelve a su lugar.
//  · La luz sigue la hora del aparato (mañana, tarde, atardecer o noche); de noche se prenden el farol, el cartel JX, una
//    luz suave sobre tu personaje y el barril de la grieta.
//  · Arriba: el perfil (abre su hoja: nombre, personaje y la cuenta), Amigos (con Chats adentro) y el engranaje (la hoja de
//    Ajustes: Gráficos, Sonido y Controles; y abajo Idioma, Tutorial, Lista, Discord, TikTok, Actualizar y Salir).
//  · Abajo a la derecha, el mapa y el modo (abre Empezar partida nueva) y JUGAR, verde (lo único verde) y lo más grande.
//  · La Lista: todo en cuatro grupos, para el teclado y el mando (que también recorren las cajas directamente).
// El costo: después de la entrada se dibuja un cuadro y el dibujo queda en pausa (dibujoPausar, principal.js) hasta que
// algo cambia (un toque, el foco, la hora, el tamaño de la pantalla o la animación del agarre). Ver pruebas/deposito.mjs.
const DEP = { el: null, ui: null, cajasEl: null, listo: false, armando: false, cajas: {}, pj: null, farol: null, O: v3(), sx: 1, g: 0,
  cam: { pos: v3(0, 1.5, -5), fov: 50 }, enc: null, foco: null, sobre: null, tenida: null, anim: null, hoja: null, abrio: null, lista: false,
  franja: '', noche: 0, tecla: false, pad: { on: false, ant: {}, rep: 0 }, ins: { l: 0, r: 0, t: 0, b: 0 }, firmaEnc: '', ayuda: true };
// las cajas: [clave, pila, corrimiento en la pila (m, hacia la izquierda de la pantalla), piso (0 abajo, 1 arriba), ícono]
// (la de arriba de «CREAR», Crear mapa, va un poco corrida hacia afuera —apoyada en las dos de abajo—: así la torre JX, atrás,
// se ve entera al lado y no tapada)
// (en este orden se recorren con el teclado y el mando: de izquierda a derecha y de arriba a abajo)
const DP_CAJAS = [['emotes', 'vos', 0, 1, 'baile'], ['pj', 'vos', 0, 0, 'persona'], ['crear', 'crear', -0.3, 1, 'martillo'], ['ws', 'crear', 0.52, 0, 'caja'],
  ['mods', 'crear', -0.52, 0, 'mods'], ['multi', 'otros', 0, 0, 'mundo'], ['evento', 'otros', -0.95, 0, 'rayo']];
const DP_K = DP_CAJAS.map((c) => c[0]);
// las pilas: dónde (x hacia la izquierda de la pantalla, z hacia el fondo; en metros desde el origen de la escena) y su rótulo
const DP_PILAS = { vos: { x: 1.45, z: 0, t: 'dp.vos' }, crear: { x: -1.0, z: 0, t: 'dp.crear' }, otros: { x: -2.85, z: 0, t: 'dp.otros' } };
// el origen de la escena: a 47,6 m de la torre JX de Pradera (la plaza la pone identidad.js delante de la aparición) y 0,99 m
// a su izquierda; las pilas miran a una cámara de referencia en (0,1; -5,1). En árabe todo se espeja alrededor de la torre
const DP_TORRE = v3(-0.99, 0, 47.557), DP_CAMREF = [0.1, -5.1];
const DP_PJ = { x: 2.75, z: -0.9, yaw: Math.PI + 0.95 }, DP_FAROL = { x: 3.55, z: 2.6 };
// de noche: el farol (alumbra las pilas desde atrás a la izquierda), el brillo de la pistola de física, una luz suave sobre
// tu personaje, el barril de la grieta, el cartel JX (alumbra la torre alrededor de las letras) y el piso delante de la torre
// (con Gráficos medios entran las cuatro más cercanas; con altos, todas; con bajos, ninguna: ahí alumbran los brillos y la
// luz de relleno, más fuerte de noche en el menú)
const DP_LUCES = [[3.0, 3.4, 1.4, 10, [3.6, 2.7, 1.5]], [2.2, 1.5, -1.8, 7, [1.0, 1.7, 2.2]], [3.0, 2.7, -2.1, 6.5, [3.4, 3.4, 3.8]], [-3.8, 1.7, -1.0, 3.6, [2.4, 0.9, 4.0]], [-0.99, 13.2, 45.6, 40, [5.0, 3.6, 0.9]], [-0.99, 2.5, 42, 14, [3.0, 2.3, 0.7]]];
// la hora: mañana, tarde, atardecer o noche, según el reloj del aparato (la hora del juego que se usa para cada una)
const DP_FRANJAS = [['manana', 6, 12, 9.5], ['tarde', 12, 17.5, 15.3], ['atardecer', 17.5, 20, 17.4], ['noche', 20, 30, 21.5]];
// el barril de la grieta: violeta (el tinte por entidad), con el borde que brilla violeta de día y encendido de noche; el foco
// o el mouse encima: el borde azul de lo que se apunta en la partida
const DP_TINTE = new Float32Array([1.55, 0.62, 2.9, 0.92]), DP_EM_NOCHE = [0.3, 0.08, 0.6], DP_EM_DIA = [0.1, 0.03, 0.22], DP_RIM_BARRIL = [0.85, 0.35, 1.7], DP_RIM_BARRIL_N = [1.4, 0.55, 2.6], DP_RIM = [0.25, 0.75, 2.4];
const dpReducido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const dpX = (x) => DP_TORRE.x + DEP.sx * (x - DP_TORRE.x);   // (x de la escena, espejada en árabe)

// ======================= armar la página =======================
function depCrear(home) {
  DEP.el = home;
  home.innerHTML = `<div class="dpCajas"></div><div class="dpUI"></div><i class="dpSonda" aria-hidden="true"></i>`;
  DEP.cajasEl = home.querySelector('.dpCajas'); DEP.ui = home.querySelector('.dpUI');
  // (la caja se toca en cualquier parte, con la chapa; el mouse encima la resalta en la escena)
  DEP.cajasEl.addEventListener('pointerover', (e) => { const b = e.target.closest('.dpCaja'); depResaltar(b ? b.dataset.k : null, 'sobre'); });
  DEP.cajasEl.addEventListener('pointerleave', () => depResaltar(null, 'sobre'));
  home.addEventListener('focusin', (e) => { const b = e.target.closest && e.target.closest('.dpCaja'); depResaltar(b ? b.dataset.k : null, 'foco'); });
  home.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement, b = a && a.closest && a.closest('.dpCaja'); depResaltar(b ? b.dataset.k : null, 'foco'); }, 0));
  addEventListener('keydown', depTecla, true);
  addEventListener('pointerdown', () => { DEP.tecla = false; }, true);
  addEventListener('resize', () => { if (depVisible()) setTimeout(depEncajar, 60); if (DEP.listo) dibujoDespertar(); });
  try { document.fonts.addEventListener('loadingdone', () => { if (depVisible()) depEncajar(true); }); } catch (e) {}
  addEventListener('gamepadconnected', () => { DEP.pad.on = true; depMandoPaso(); });
  // (Actualizar de la web —herramientas/codigo_web.mjs— pone su botón en el body cuando hay una versión nueva)
  try { DEP.obs = new MutationObserver(() => { if (depVisible()) depActualizarVer(); }); DEP.obs.observe(document.body, { childList: true }); } catch (e) {}
  // la hora: cada minuto se mira si cambió la franja (mañana, tarde, atardecer, noche); si cambió, otra luz y un cuadro
  setInterval(() => { if (DEP.listo && depFranja()[0] !== DEP.franja) { depHora(); dibujoDespertar(); } }, 60000);
  // (llegó el paquete de tu personaje: se rehace con el de verdad)
  if (typeof RBP !== 'undefined') RBP.alListo.push((k) => { if (DEP.pj && DEP.pj.skinQuiere && k === 's_' + DEP.pj.skinQuiere) { depPersonaje(); dibujoDespertar(); } });
}
// lo que dice cada caja: [la palabra (puede ir en dos renglones), el dato]
function depDatos() {
  const n = (k, v) => T(k).replace('{n}', v), nm = modsTodos().filter((m) => PREFS.mods[m.id]).length, na = Object.keys(PREFS.gmod || {}).length;
  const emo = (typeof animsOficiales === 'function' ? animsOficiales().length : 0) + Object.keys(INST.anims || {}).length;
  const pjs = (DATA.chars || []).length + (typeof PJI !== 'undefined' && PJI.lista ? PJI.lista.length : 0);
  const tuyos = Object.values(INST.mapas || {}).filter((m) => m.creado).length;
  const on = typeof LISTA !== 'undefined' && LISTA.on, L = on && typeof listaSalas === 'function' ? listaSalas() : [], jug = L.reduce((a, e) => a + e.j.length, 0);
  const visto = (k) => !!(PREFS.ptVisto && PREFS.ptVisto[k]);
  return {
    emotes: [T('t.anims'), String(emo)], pj: [T('dp.pj'), String(pjs)], crear: [T('dp.crearMapa'), n(tuyos === 1 ? 'dp.tuyo1' : 'dp.tuyos', tuyos)],
    ws: [T('dp.ws'), !visto('gmod') ? T('pt.nuevo') : n('dp.addons', na)], mods: [T('dp.mods'), n(nm === 1 ? 'dp.activo1' : 'dp.activos', nm)],
    multi: [T('dp.multi'), on ? n('dp.online', jug) : T('dp.sinRed')], evento: [T('dp.grieta'), T(PREFS.evento !== false ? 'pt.on' : 'pt.off')],
  };
}
// todo lo de la página (se vuelve a armar al cambiar el idioma, el nombre, los mods o el personaje; la escena no)
function depDibujar() {
  if (!DEP.ui) return;
  DEP.hoja = null; DEP.abrio = null; DEP.lista = false;
  const lbl = (t) => `title="${esc(t)}" aria-label="${esc(t)}"`, D = depDatos(), I = IDIOMAS_RB[PREFS.lang] || IDIOMAS_RB.en;
  const red = (n) => RED_SOCIAL.find((r) => r[0] === n) || ['', '', ''];
  // las cajas: la caja entera se toca; adentro, la chapa
  DEP.cajasEl.innerHTML = DP_CAJAS.map(([k, , , , ic]) => `<button class="dpCaja dpC_${k}" data-rb="dp:${k}" data-k="${k}" ${lbl(`${D[k][0].replace(/[\u00ad\u200b]/g, '')}: ${D[k][1]}`)}><span class="dpChapa">${glifo(ic, 'dpChI')}<b class="dpChP" dir="auto">${esc(D[k][0])}</b><small class="dpChD" dir="auto">${esc(D[k][1])}</small></span></button>`).join('')
    + Object.entries(DP_PILAS).map(([p, P]) => `<div class="dpGrupo dpG_${p}" aria-hidden="true"><i></i><span>${esc(T(P.t))}</span></div>`).join('');
  const pc = T(COARSE ? 'dp.ayuda' : 'dp.ayudaPC');
  DEP.ui.innerHTML = `<button class="dpPerfil" data-rb="dpPerfil" aria-haspopup="dialog" aria-expanded="false" ${lbl(T('so.perfil'))}><span class="dpAvatar"><img src="${esc(retrato(PREFS.skin))}" alt="" draggable="false"></span><b class="dpNom" dir="auto"></b><span class="dpG"></span></button>
    <div class="dpDer"><button class="dpIco dpAmigos" data-rb="dpSoc" ${lbl(T('dp.amigosChats'))}>${glifo('gente')}</button><button class="dpIco dpAj" data-rb="dpAjustes" aria-haspopup="dialog" aria-expanded="false" ${lbl(T('pz.ajustes'))}>${glifo('ajustes')}</button></div>
    <div class="dpAyuda${DEP.ayuda ? '' : ' oc'}" aria-hidden="true">${glifo('mano')}<span>${esc(pc)}</span></div>
    <div class="dpVer" title="JXMod ${esc(VERSION_RB)} · ${esc(ARMADO_RB)}"><img class="rbLogo dpLogo" alt="" src="${LOGO_RB}" draggable="false"><span dir="ltr">JXMod <b>${esc(VERSION_RB)}</b> ${esc(ARMADO_RB.split(' ')[0])}</span></div>
    <button class="dpMapa" data-rb="nueva"><span class="dpMapaT"><b class="dpMapaN" dir="auto"></b><small class="dpMapaS" dir="auto"></small></span><svg class="gli dpMapaF" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
    <button class="dpJugar" data-rb="jugar"><span class="dpBola">${glifo('jugar')}</span><b>${esc(T('pt.jugar'))}</b></button>
    <div class="dpVelo oc" data-rb="dpCerrar"></div>
    <div class="dpHoja dpHojaPerfil oc" role="dialog" aria-label="${esc(T('so.perfil'))}">
      <label class="dpCampo"><span class="dpTit">${esc(T('b.nombre'))}</span><input id="rbNombre" maxlength="16" spellcheck="false" autocomplete="off" dir="auto" aria-label="${esc(T('b.nombre'))}"></label>
      <button class="dpFila" data-rb="personajes"><img src="${esc(retrato(PREFS.skin))}" alt="" draggable="false"><span><b>${esc(T('m.personajes'))}</b><small dir="auto">${esc(typeof pjNomActual === 'function' ? pjNomActual() : PREFS.skin)}</small></span>${glifo('adelante')}</button>
      <div class="dpCuenta ptCuenta"></div></div>
    <div class="dpHoja dpHojaAj oc" role="dialog" aria-label="${esc(T('pz.ajustes'))}">
      <h3>${esc(T('pz.ajustes'))}</h3>
      <div class="dpGrilla dpFuerte"><button data-rb="dpAj:g">${glifo('ajustes')}<span>${esc(T('dp.graficos'))}</span></button><button data-rb="dpAj:s">${glifo('volumen')}<span>${esc(T('dp.sonido'))}</span></button><button data-rb="dpAj:c">${glifo('mano')}<span>${esc(T('dp.controles'))}</span></button></div>
      <h3>${esc(T('dp.mas'))}</h3>
      <div class="dpGrilla"><button data-rb="idioma">${glifo('mundo')}<span dir="auto">${esc(I[0])}</span></button>${typeof tutAbrir === 'function' ? `<button data-rb="dpTut">${glifo('libro')}<span>${esc(T('pt.tutorial'))}</span></button>` : ''}<button data-rb="dpLista">${glifo('lista')}<span>${esc(T('dp.lista'))}</span></button>
        <button class="dpRed" data-rb="red" data-url="${esc(red('Discord')[1])}" title="Discord">${red('Discord')[2]}<span>Discord</span></button><button class="dpRed" data-rb="red" data-url="${esc(red('TikTok')[1])}" title="TikTok">${red('TikTok')[2]}<span>TikTok</span></button>
        <button class="dpAct oc" data-rb="dpAct">${glifo('bajar')}<span>${esc(T('pt.actualizar'))}</span></button><button class="dpSalir" data-rb="salir">${glifo('salir')}<span>${esc(T('m.salir'))}</span></button></div></div>
    <div class="dpLista oc" role="dialog" aria-label="${esc(T('dp.lista'))}"></div>`;
  const inp = DEP.ui.querySelector('#rbNombre'); inp.value = PREFS.nombre || '';
  inp.oninput = () => { nombrePoner(inp.value); depNombre(); };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
  // (las cajas que están cayendo o la agarrada siguen así: la página se rearma, por ejemplo, al volver de un panel)
  for (const k of DP_K) { const b = DEP.cajasEl.querySelector('.dpC_' + k), C = DEP.cajas[k]; if (b) { b.classList.toggle('dpCae', !!C && C.est === 'cae'); b.classList.toggle('dpTenida', DEP.tenida === k); } }
  depNombre(); depMapa(); depGlobos(); depActualizarVer();
  if (typeof cuentaPintar === 'function') cuentaPintar(); else depCuentaMarca();
  depEncajar(true); clearTimeout(DEP.tEnc); DEP.tEnc = setTimeout(() => depEncajar(true), 400);
}
// (lo que cambia sin rearmar: el nombre, el mapa, los globitos, los datos de las cajas)
function depNombre() { const b = DEP.ui && DEP.ui.querySelector('.dpNom'); if (b) b.textContent = PREFS.nombre || T('b.nombre'); }
function depCuentaMarca() {
  const m = DEP.ui && DEP.ui.querySelector('.dpG'); if (!m) return;
  // (la «G» si hay sesión: con la foto de la cuenta si tiene)
  const dentro = typeof cuDentro === 'function' && cuDentro();
  m.innerHTML = !dentro ? '' : CU.u && CU.u.foto ? `<img class="cuFoto" src="${esc(CU.u.foto)}" alt="" referrerpolicy="no-referrer">` : typeof CU_G !== 'undefined' ? CU_G : '';
  m.classList.toggle('dpGsi', !!dentro);
}
function depMapa() {
  if (!DEP.ui) return;
  const mc = RB.mapaCom && mapaDe(RB.mapaCom), nom = mc ? nombreDe(mc) : mapaNom(RB.mapa);
  const modo = typeof GMM !== 'undefined' && GMM.elegido && GMM.elegido !== 'auto' ? (GMM.elegido === 'sandbox' ? 'Sandbox' : ((typeof gmmElegibles === 'function' && gmmElegibles().find((M) => M.n === GMM.elegido)) || {}).titulo || GMM.elegido) : '';
  const nm = modsTodos().filter((m) => PREFS.mods[m.id]).length, mods = nm ? T(nm === 1 ? 'dp.mod1' : 'dp.modN').replace('{n}', nm) : T('sinMods');
  const q = (s) => DEP.ui.querySelector(s);
  q('.dpMapaN').textContent = nom; q('.dpMapaS').textContent = `${modo || T('h.' + (RB.hora || 'normal'))} · ${mods}`;
  q('.dpMapa').setAttribute('aria-label', `${T('pt.mapa')}: ${nom} · ${q('.dpMapaS').textContent} · ${T('pt.cambiar')}`);
  q('.dpJugar').setAttribute('aria-label', `${T('pt.jugar')}: ${nom}`);
}
function depDatosPintar() {
  if (!DEP.cajasEl) return;
  const D = depDatos(); let cambio = false;
  for (const k of DP_K) { const b = DEP.cajasEl.querySelector('.dpC_' + k); if (!b) continue; const d = b.querySelector('.dpChD'); if (d.textContent !== D[k][1]) { d.textContent = D[k][1]; b.setAttribute('aria-label', `${D[k][0].replace(/[\u00ad\u200b]/g, '')}: ${D[k][1]}`); b.title = b.getAttribute('aria-label'); cambio = true; } }
  if (cambio) depChapasEncajar();
}
// el globito de Amigos: las solicitudes de amistad y los mensajes sin leer, juntos (social.js)
function depGlobos() {
  if (!DEP.ui || typeof SOC === 'undefined') return;
  const b = DEP.ui.querySelector('.dpAmigos'); if (!b) return;
  const n = Math.max(SOC.badge || 0, SOC.sol || 0); let e = b.querySelector('.soBadge');
  if (!n) { if (e) e.remove(); return; }
  if (!e) { e = document.createElement('em'); e.className = 'soBadge'; b.appendChild(e); } e.textContent = n > 99 ? '99+' : n;
}
// Actualizar: en la app busca una versión nueva (avisa si ya está la última); en la web aparece sólo si apareció el botón de
// codigo_web.mjs (y entonces el engranaje lleva el globito)
const depActNativo = () => { try { return !!(window.JXNativo && JXNativo.buscarActualizacion); } catch (e) { return false; } };
function depActualizarVer() {
  const b = DEP.ui && DEP.ui.querySelector('.dpAct'); if (!b) return;
  const web = !!document.getElementById('jxAct');
  b.classList.toggle('oc', !(depActNativo() || web)); b.classList.toggle('dpHay', web);
  const g = DEP.ui.querySelector('.dpAj'); let e = g.querySelector('.soBadge');
  if (web && !e) { e = document.createElement('em'); e.className = 'soBadge'; e.textContent = '1'; g.appendChild(e); } else if (!web && e) e.remove();
}
function depActualizar() {
  if (depActNativo()) { try { JXNativo.buscarActualizacion(); } catch (e) {} return; }
  const w = document.getElementById('jxAct'); if (w) w.click();
}

// ======================= la escena =======================
// el mundo del menú: Pradera, con su torre JX, las cajas, el farol y tu personaje. Se arma después de mostrar la página (JUGAR
// ya se puede tocar) y cada vez que se vuelve de una partida (la partida usa el mismo mundo)
const depEscenaViva = () => DEP.listo && MUNDO.nombre === 'FlatGrass' && DP_K.every((k) => DEP.cajas[k] && DEP.cajas[k].o && OBJS.includes(DEP.cajas[k].o)) && !!DEP.pj && PERS.includes(DEP.pj);
function depArmar() {
  if (DEP.armando) return; DEP.armando = true; DEP.listo = false;
  try {
    // (lo mismo que al empezar una partida: lo que quedó de antes, fuera —sin avisar a la red: no es tuyo de nadie—)
    if (typeof natFin === 'function') natFin(); if (typeof pillFin === 'function') pillFin(true); entidadesLimpiar();
    for (const o of OBJS.slice()) borrarObjeto(o, true);
    PH.bodies.length = 0; PH.joints.length = 0; PROY.length = 0; PART.l.length = 0;
    if (typeof nukeLimpiar === 'function') nukeLimpiar(); if (typeof LUCES_T !== 'undefined') LUCES_T.length = 0;
    if (typeof personasLimpiar === 'function') personasLimpiar();
    if (MENU.lobby) { menuLobby(false); MENU.caja = null; }
    cargarMapa('FlatGrass');
  } catch (e) { console.warn('depósito', e); if (typeof cnAnotar === 'function') cnAnotar('deposito', String(e && e.message || e).slice(0, 160)); DEP.armando = false; return; }
  // (en dos tareas: el mapa, y en la siguiente las cajas, tu personaje y la luz; así ninguna de las dos frena mucho el primer
  // toque —medido en deposito.mjs: la tarea más larga después de que el menú se puede tocar—)
  setTimeout(depArmar2, 0);
}
function depArmar2() {
  if (JUEGO.estado !== 'principal' || MUNDO.nombre !== 'FlatGrass') { DEP.armando = false; return; }
  try {
    // el origen: donde quedó la torre (si la plaza no se pudo poner, delante de la aparición)
    const h = typeof IDS !== 'undefined' && IDS.hito && IDS.hito.p, s = MUNDO.spawns[0] || v3();
    DEP.O.set(h ? h[0] - DP_TORRE.x : s.x + 0.99, 0, h ? h[2] - DP_TORRE.z : s.z - 1.557);
    DEP.sx = RB.el && RB.el.dir === 'rtl' ? -1 : 1;
    DEP.cajas = {};
    for (const [k] of DP_CAJAS) {
      const o = crearObjeto(k === 'evento' ? 'BarrilExplosivo' : 'CajaMadera', v3(DEP.O.x, -50, DEP.O.z), new Quat(), { congelado: true, dueno: 'menu' });
      if (!o) continue; o.tipo = 'prop'; o.menu = true;
      if (k === 'evento') o.md.tinte = DP_TINTE;
      DEP.cajas[k] = { o, k };
    }
    DEP.farol = crearObjeto('Farol', v3(DEP.O.x, -50, DEP.O.z), new Quat(), { congelado: true, dueno: 'menu' }); if (DEP.farol) DEP.farol.menu = true;
    depLugares(); depPersonaje(); depHora();
    EVT.mapa = null; eventoIniciar(); EVT.enMenu = true;
    DEP.listo = true; RB.el.classList.add('dpListo');
    depEncajar(true);
    // la entrada: la primera vez, o sólo las cajas que tienen algo nuevo; si no, ya están en su lugar
    const nuevas = depNovedades();
    if (nuevas.length && !dpReducido()) depEntrada(nuevas); else { for (const k of DP_K) depPoner(k); depMarcarVisto(); }
  } catch (e) { console.warn('depósito', e); if (typeof cnAnotar === 'function') cnAnotar('deposito', String(e && e.message || e).slice(0, 160)); }
  DEP.armando = false; depPausa(); dibujoDespertar();
}
// el lugar de cada cosa (fijo: el mismo en cada carga): la pila, girada para mirar a la cámara de referencia; el piso, el de
// verdad debajo de cada una
function depLugares() {
  const O = DEP.O, piso = (x, z) => { const y = pisoBajo(v3(x, O.y + 30, z), 0); return y === null ? (MUNDO.spawns[0] ? MUNDO.spawns[0].y - 1.5 : 0) : y; };
  DEP.g = piso(O.x + dpX(DP_PILAS.crear.x), O.z);
  for (const [k, pila, dx, nivel] of DP_CAJAS) {
    const C = DEP.cajas[k]; if (!C) continue;
    // (cada pila mira a la cámara: a donde quedó para esta pantalla —DEP.camRef, de depEncajar— o, antes, a la de referencia)
    const P = DP_PILAS[pila], px = dpX(P.x), cr = DEP.camRef || [dpX(DP_CAMREF[0]), DP_CAMREF[1]], yaw = -Math.atan2(cr[0] - px, P.z - cr[1]);
    const qy = Quat.axis(0, 1, 0, yaw), lx = DEP.sx * dx, dz = k === 'evento' ? -0.1 : 0;
    const off = qy.rot(v3(lx, 0, dz)), x = O.x + px + off.x, z = O.z + P.z + off.z;
    // (la orientación de reposo: la del prefab —con el giro de su cápsula, si tiene— y el de la pila)
    // (las medidas, sin girar: el ancho de la cara y el alto)
    // (se mide en el origen y la caja vuelve a donde estaba: una que cae o viaja sigue su camino, sin saltar)
    const o = C.o, b = o.b, p0 = b.pos.clone(), q0 = b.q.clone(); b.q.copy(b.capQ || new Quat()); b.pos.set(0, 0, 0); b.updateWorld();
    const y0 = b.aabb.y0, alto = b.aabb.y1 - b.aabb.y0, ancho = b.aabb.x1 - b.aabb.x0, g = DEP.g;
    const qL = qy.clone(); if (b.capQ) qL.mul(b.capQ);
    b.pos.copy(p0); b.q.copy(q0); b.updateWorld();
    C.L = { p: v3(x, g - y0 + nivel * (alto + 0.004), z), q: qL, cap: b.capQ ? b.capQ.clone() : null, alto, yaw, ancho };
  }
  if (DEP.farol) { const f = DEP.farol.b, x = O.x + dpX(DP_FAROL.x), z = O.z + DP_FAROL.z; f.q.copy(Quat.axis(0, 1, 0, DEP.sx > 0 ? Math.PI : -Math.PI)); if (f.capQ) f.q.mul(f.capQ); f.pos.set(0, 0, 0); f.updateWorld(); f.pos.set(x, piso(x, z) - f.aabb.y0 + 0.02, z); f.updateWorld(); }
}
// una caja en su lugar exacto, quieta
function depPoner(k) {
  const C = DEP.cajas[k]; if (!C || !C.L) return;
  const b = C.o.b; b.pos.copy(C.L.p); b.q.copy(C.L.q); b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.frozen = true; b.updateWorld(); C.o.md.sucio = true; C.est = 'quieta';
  const el = DEP.cajasEl && DEP.cajasEl.querySelector('.dpC_' + k); if (el) el.classList.remove('dpCae');
}
// tu personaje, con la pistola de física, mirando a las cajas
function depPersonaje() {
  if (DEP.pj) borrarPersona(DEP.pj);
  const P = (DEP.pj = crearPersona(PREFS.skin, PREFS.gorro, { nombre: '' })), O = DEP.O, z = O.z + DP_PJ.z;
  P.menu = true; P.arma = 'PhysicsGun'; P.suelo = true; P.vel.set(0, 0, 0);
  depPersonajeLugar();
  P.yaw = DEP.yawPj = DEP.sx > 0 ? DP_PJ.yaw : -DP_PJ.yaw;
}
// (dónde está parado: DEP.pjX lo elige el encuadre —más cerca de la pila «VOS» si la pantalla es angosta—)
function depPersonajeLugar() {
  const P = DEP.pj; if (!P) return;
  const O = DEP.O, x = O.x + dpX(DEP.pjX || DP_PJ.x), z = O.z + DP_PJ.z, y = pisoBajo(v3(x, O.y + 30, z), 0);
  P.pos.set(x, (y === null ? DEP.g : y) + (P.tam || 1), z);
}
// ---------------- la hora ----------------
// (DEP.franjaPrueba: las pruebas y las fotos eligen la franja)
function depFranja() { if (DEP.franjaPrueba) return DP_FRANJAS.find((f) => f[0] === DEP.franjaPrueba) || DP_FRANJAS[1]; const d = new Date(), h = d.getHours() + d.getMinutes() / 60; return DP_FRANJAS.find(([, a, b]) => (h >= a && h < b) || (h + 24 >= a && h + 24 < b)) || DP_FRANJAS[1]; }
function depHora() {
  const [nom, , , hora] = depFranja(); DEP.franja = nom;
  DIA.ciclo = false; DIA.hora = hora; DIA.aplicada = -1; diaAplicar();
  // (las nubes se pintan de a franjas, una por cuadro: con el dibujo en pausa quedaban mitad de día y mitad de noche. Se
  // rehacen enteras ya, como al entrar a un mapa —cielos.js—)
  try { if (typeof cieloCTPaso === 'function' && R.cielo && R.cielo.nub) cieloCTPaso(true); } catch (e) {}
  DEP.noche = R.noche || 0;
  const O = DEP.O; MUNDO.luces = DEP.noche > 0.5 ? DP_LUCES.map(([x, y, z, r, c]) => ({ p: v3(O.x + dpX(x), DEP.g + y, O.z + z), r, c, d: null, k: -2 })) : [];
  // (de noche, más luz de relleno en el menú —en Bajo y Patata no hay luces puntuales: tu personaje y las chapas se perdían—)
  if (DEP.noche > 0.5) { R.ambS = R.ambS.map((x) => x * 1.7); R.ambG = R.ambG.map((x) => x * 1.5); }
  depBrillos();
  depLuzPj();
  if (RB.el) RB.el.dataset.franja = nom;
}
// (sin luces puntuales —Gráficos bajos y Patata—, de noche tu personaje con un poco de luz propia: si no, era una sombra)
function depLuzPj() { if (DEP.pj) DEP.pj.md.extra = DEP.noche > 0.5 && !(GFX.nluz > 0 && GFX.luz >= 2) ? { em: [0.16, 0.16, 0.19] } : null; }
// ---------------- la cámara ----------------
// Fija para cada tamaño de pantalla: mira derecho hacia la torre (sin inclinar: el horizonte, en el medio) y se ubica para que
// las cajas entren entre la barra de arriba (con los rótulos) y la fila de JUGAR, con la chapa de cada una de un tamaño que
// se lea (≥ 92 px de cara: la palabra más larga, a 14 px), sin pasar de un tamaño razonable en la compu (18 % del alto). A lo
// ancho entran las cajas y tu personaje; si no hay lugar, tu personaje se acerca a la pila «VOS» (de 2,75 a 2,3 m) y, si
// igual no entra, queda cortado a la izquierda: las cajas, siempre enteras. JUGAR se agranda con las cajas: un poco más del
// doble del área de la más grande.
// (aj: lo que la proyección de verdad agrega a la cuenta de la cara chata —medido en depEncajar, con las cajas giradas hacia
// la cámara y el barril más adelante—: kA, el área de la caja más grande sobre la de la cara; dyM y dtM, cuánto pasan las
// caras de abajo y de arriba, en metros del plano de las caras)
const DP_AJ0 = { kA: 1.17, dyM: 0.04, dtM: 0.03 };
function depEncuadre(W, H, aj) {
  aj = aj || DP_AJ0;
  const I = DEP.ins, u = clamp(Math.min(W / 873, H / 402), 1, 1.6), fov = 50, f = (H / 2) / Math.tan(fov * Math.PI / 360);
  const C0 = DEP.cajas.pj && DEP.cajas.pj.L, ancho = C0 ? C0.ancho : 1.02, alto = C0 ? C0.alto : 1.02, altoP = 2 * alto + 0.004 + aj.dyM + aj.dtM;
  const zc = -ancho / 2;   // (el plano de las caras de adelante)
  // a lo ancho: de la pila «VOS» al barril (y tu personaje, si entra), medido desde la torre; a lo alto, las dos filas de cajas
  const xV = Math.abs(DP_PILAS.vos.x - DP_TORRE.x) + ancho / 2, xB = Math.abs(DP_PILAS.otros.x - 0.95 - 0.37 - DP_TORRE.x), xP = (x) => (Math.abs(x - DP_TORRE.x) + 0.55) * 1.1;   // (tu personaje está más cerca: se ve un 10 % más ancho)
  // (arriba: la barra —8 + 44—, 10 de aire —8 y 2 de sobra, por los medios píxeles— y el rótulo de la pila, que arranca 23
  // más arriba que la caja)
  const L = I.l + 12 * u, Rr = W - I.r - 12 * u, yTop = I.t + 8 * u + 44 * u + 10 * u + 23 * u, m = 10 * u;
  // (la cara: de 96 px o más —la palabra más larga entra entera a 14 px—; si a lo alto no hay lugar —el celular chico—, hasta
  // 84, con la palabra larga cortada por su guion: antes que pisar la barra de arriba o JUGAR)
  const caraMax = Math.max(100, H * (0.25 - 0.07 * clamp((H - 402) / 678, 0, 1))), caraMin = 96, sMin = caraMin / ancho, sDuro = 84 / ancho, sMax = caraMax / ancho;
  let s = H * 0.25, J = null, pjX = DP_PJ.x;
  for (let it = 0; it < 4; it++) {
    // (JUGAR: un poco más del doble del área de la caja más grande; bajo y ancho —hasta 3,4 veces más ancho que alto—)
    const cara = ancho * s, A = Math.max(2.1 * aj.kA * cara * cara, 19000 * u * u), jh = Math.max(64 * u, Math.sqrt(A / 3.4));
    J = { w: Math.ceil(A / jh), h: Math.round(jh) };
    const yBot = H - I.b - m - J.h - 8 * u, sV = (yBot - yTop) / altoP, sT = (Rr - L) / (xV + xB), sP = (x) => (Rr - L) / (xP(x) + xB);
    // (con tu personaje en su lugar; si así las cajas quedan chicas, más cerca de la pila; si igual, cortado)
    const sObj = Math.max(sDuro, Math.min(sMin, sV));
    pjX = DP_PJ.x; s = Math.min(sV, sMax, sP(pjX));
    if (s < sObj) { pjX = 2.3; s = Math.min(sV, sMax, sP(pjX)); }
    if (s < sObj) s = Math.max(sDuro, Math.min(sObj, sT));
  }
  DEP.pjX = pjX;
  const yBot = H - I.b - m - J.h - 8 * u, dz = f / s;
  // (la x de la cámara: lo de la derecha —el barril— contra su borde; si sobra lugar, como en la maqueta, el barril a un 6 %
  // del borde y lo que sobra, a la izquierda de tu personaje —así la torre JX queda entre las pilas, no tapada por «CREAR»—.
  // En la pantalla un punto X queda en W/2 - (X - cx)·s: la derecha es -x)
  const ancho1 = (xP(pjX) + xB) * s, sobra = Math.max(0, Rr - L - ancho1), mR = Math.min(sobra, 0.06 * W), xBm = dpX(DP_TORRE.x - xB);
  const cx = DEP.sx > 0 ? xBm + (Rr - mR - W / 2) / s : xBm + (L + mR - W / 2) / s;
  // (a lo alto: lo de abajo de las cajas, justo arriba de JUGAR; lo que sobra, cielo con la torre)
  const g = DEP.g, cy = g + (yBot - aj.dyM * s - H / 2) / s;
  DEP.cam.pos.set(DEP.O.x + cx, cy, DEP.O.z + zc - dz); DEP.cam.fov = fov;
  DEP.enc = { W, H, u, s, f, J, yBot, yTop, L, R: Rr, cara: ancho * s };
}
const depCamF = () => DEP.enc ? DEP.enc.f : 1;
// un punto del mundo en la pantalla (px de la página del juego): la cámara mira hacia +z, con la derecha hacia -x
function depProy(P) {
  const E = DEP.enc, c = DEP.cam.pos, z = P.z - c.z; if (z < 0.05) return null;
  return [E.W / 2 - (P.x - c.x) * E.f / z, E.H / 2 - (P.y - c.y) * E.f / z];
}
// el rectángulo de la cara de adelante de una caja (en su lugar o donde esté, viajando); del barril, su silueta de frente
function depCara(k, enLugar) {
  const C = DEP.cajas[k]; if (!C || !C.L) return null;
  const b = C.o.b, pos = enLugar ? C.L.p : b.pos, barril = k === 'evento';
  // (la caja: su cara -z, la que mira a la cámara; el barril, de pie: el ancho de su diámetro y el alto)
  const q = barril ? Quat.axis(0, 1, 0, C.L.yaw) : enLugar ? C.L.q : b.q, hx = C.L.ancho / 2, hy = C.L.alto / 2, hz = barril ? 0 : C.L.ancho / 2;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const p = depProy(vadd(pos, q.rot(v3(sx * hx, sy * hy, -hz)))); if (!p) return null;
    x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
// la torre JX en la pantalla (el rótulo de «CREAR» no la pisa)
function depTorreRect() {
  const T0 = vadd(DEP.O, v3(DP_TORRE.x, DEP.g, DP_TORRE.z)); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const sx of [-1, 1]) for (const y of [0.45, 17.3]) { const p = depProy(v3(T0.x + sx * 2.45, T0.y + y, T0.z - 1.05)); if (!p) return null; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return { x0, y0, x1, y1 };
}
// ======================= que todo entre =======================
// Las medidas salen de la escena: la cámara (depEncuadre) y la proyección de cada caja en su lugar. Medido en px de la página
// del juego (con el juego girado en el celular parado, también: todo va adentro de #rbInicio, que no gira).
function depInsets() {
  const s = DEP.el && DEP.el.querySelector('.dpSonda'); if (!s) return;
  const c = getComputedStyle(s), n = (v) => parseFloat(v) || 0;
  DEP.ins = { l: n(c.paddingLeft), r: n(c.paddingRight), t: n(c.paddingTop), b: n(c.paddingBottom) };
}
function depEncajar(forzar) {
  if (!DEP.ui || !depVisible()) return;
  const W = RB.el.clientWidth || VW(), H = RB.el.clientHeight || VH();
  depInsets();
  const firma = [W, H, DEP.ins.l, DEP.ins.r, DEP.ins.t, DEP.ins.b, DEP.sx, DEP.listo ? 1 : 0, PREFS.lang].join('|');
  if (firma !== DEP.firmaEnc || forzar) {
    DEP.firmaEnc = firma;
    // (en árabe la escena se espeja: si cambió, se vuelven a poner las cosas)
    const sx = RB.el.dir === 'rtl' ? -1 : 1;
    if (DEP.listo && sx !== DEP.sx) { DEP.sx = sx; depLugares(); depPersonaje(); depHora(); for (const k of DP_K) if (DEP.cajas[k].est !== 'cae') depPoner(k); }
    DEP.sx = sx;
    // (dos pasadas: la primera con lo que suele agregar la proyección; la segunda con lo medido en estas cajas)
    depEncuadre(W, H);
    // (las pilas, de frente a la cámara de esta pantalla: si no, en una pantalla angosta —la cámara más corrida— la caja de
    // atrás de una pila queda más lejos y de costado, y su chapa, más chica)
    if (DEP.listo) {
      const cr = [DEP.cam.pos.x - DEP.O.x, DEP.cam.pos.z - DEP.O.z], v = DEP.camRef;
      if (!v || Math.abs(v[0] - cr[0]) > 0.02 || Math.abs(v[1] - cr[1]) > 0.02) { DEP.camRef = cr; depLugares(); for (const k of DP_K) if (DEP.cajas[k].est === 'quieta') depPoner(k); }
    }
    const aj = depMedirAj(); if (aj) { depEncuadre(W, H, aj); depAsegurar(); }
    depPersonajeLugar();
    const E = DEP.enc, u = E.u, st = DEP.el.style;
    st.setProperty('--u', u); st.setProperty('--jw', E.J.w + 'px'); st.setProperty('--jh', E.J.h + 'px');
    if (DEP.listo) depGrietaLugar();
    if (DEP.listo) dibujoDespertar();
  }
  depCajasPoner();
  if (DEP.hoja) depHojaEncajar();
  if (DEP.lista) depListaEncajar();
}
// lo que la proyección de verdad agrega (ver DP_AJ0): con la escena armada, de las caras de las cajas en su lugar
function depMedirAj() {
  if (!DP_K.every((k) => DEP.cajas[k] && DEP.cajas[k].L)) return null;
  const E = DEP.enc, R = DP_K.map((k) => depCara(k, true)); if (R.some((r) => !r)) return null;
  const yNb = E.H / 2 - (DEP.g - DEP.cam.pos.y) * E.s, alto = DEP.cajas.pj.L.alto, yNt = yNb - (2 * alto + 0.004) * E.s;
  const maxA = Math.max(...R.map((r) => (r.x1 - r.x0) * (r.y1 - r.y0))), bot = Math.max(...R.map((r) => r.y1)), top = Math.min(...R.map((r) => r.y0));
  return { kA: maxA / (E.cara * E.cara), dyM: Math.max(0, (bot - yNb) / E.s), dtM: Math.max(0, (yNt - top) / E.s) };
}
// (y lo que no puede fallar: JUGAR con el doble del área de la caja más grande —se ensancha— y las cajas arriba de JUGAR —la
// cámara baja un poco—)
function depAsegurar() {
  const E = DEP.enc, R = DP_K.map((k) => depCara(k, true)); if (R.some((r) => !r)) return;
  const maxA = Math.max(...R.map((r) => Math.ceil(r.x1 - r.x0) * Math.ceil(r.y1 - r.y0)));
  if (E.J.w * E.J.h < 2.05 * maxA) E.J.w = Math.ceil(2.05 * maxA / E.J.h);
  const bot = Math.max(...R.map((r) => r.y1));
  if (bot > E.yBot) DEP.cam.pos.y -= (bot - E.yBot + 1) / E.s;   // (la cámara más abajo: las cajas suben en la pantalla)
}
// la grieta del cielo, arriba a la derecha (a la izquierda en árabe), entre la torre y la barra de arriba
function depGrietaLugar() {
  const E = DEP.enc; if (!E) return;
  const t = Math.tan(DEP.cam.fov * Math.PI / 360), nx = DEP.sx > 0 ? 0.46 : -0.46, ny = 0.6;
  // (en coordenadas de la cámara: adelante +z; la derecha de la pantalla es -x)
  const d = v3(-nx * t * (E.W / E.H), ny * t, 1).norm(); EVT.dir = d;
  let e1 = vcross(v3(0, 1, 0), d).norm(); const e2 = vcross(d, e1).norm(), giro = 0.18, cg = Math.cos(giro), sg = Math.sin(giro);
  EVT.e1 = vadd(vscale(e1, cg), vscale(e2, sg)).norm(); EVT.e2 = vadd(vscale(e1, -sg), vscale(e2, cg)).norm();
  EVT.tam = 0.21 * t; EVT.lN = 0;
}
// las cajas (lo que se toca, con su chapa) y los rótulos de las pilas, en su lugar de la pantalla
function depCajasPoner() {
  if (!DEP.enc || !DEP.cajasEl) return;
  const E = DEP.enc, u = E.u, R0 = {};
  for (const k of DP_K) R0[k] = depCara(k, true);
  if (!DP_K.every((k) => R0[k])) { DEP.cajasEl.classList.add('oc'); return; }
  DEP.cajasEl.classList.remove('oc');
  // (sin pisarse: las que se tocan comparten el borde —la de arriba con la de abajo, las de al lado— a mitad de camino)
  const R1 = {}; for (const k of DP_K) R1[k] = Object.assign({}, R0[k]);
  // (las chapas de cada fila, a la misma altura: el medio de las caras de la fila —la perspectiva las corre 1 a 3 px—)
  const filaCy = {}; for (const F of [['pj', 'ws', 'mods', 'multi'], ['emotes', 'crear']]) { const c = F.reduce((a, k) => a + R0[k].cy, 0) / F.length; for (const k of F) filaCy[k] = c; }
  const lado = (a, b) => { const A = R1[a], B = R1[b]; if (DEP.sx > 0 ? A.x1 > B.x0 : B.x1 > A.x0) { const m = DEP.sx > 0 ? (A.x1 + B.x0) / 2 : (B.x1 + A.x0) / 2; if (DEP.sx > 0) { A.x1 = m; B.x0 = m; } else { B.x1 = m; A.x0 = m; } } };
  const arriba = (a, b) => { const A = R1[a], B = R1[b]; if (A.y1 > B.y0) { const m = (A.y1 + B.y0) / 2; A.y1 = m; B.y0 = m; } };
  arriba('emotes', 'pj'); arriba('crear', 'ws'); arriba('crear', 'mods'); lado('ws', 'mods'); lado('multi', 'evento');
  for (const k of DP_K) { const r = R1[k]; r.x0 = Math.round(r.x0); r.y0 = Math.round(r.y0); r.x1 = Math.round(r.x1); r.y1 = Math.round(r.y1); }
  DEP.rect = R1; DEP.cara = R0;
  for (const k of DP_K) {
    const el = DEP.cajasEl.querySelector('.dpC_' + k); if (!el) continue;
    const r = R1[k], f = R0[k];
    Object.assign(el.style, { left: r.x0 + 'px', top: r.y0 + 'px', width: r.x1 - r.x0 + 'px', height: r.y1 - r.y0 + 'px' });
    // la chapa: centrada en la cara, ~62 % de ella (la madera se ve alrededor). En el barril, que no es una caja, más chica
    // (~42 %) y un poco más abajo, como la etiqueta de un barril: arriba y abajo se ven la tapa y los aros
    const fw = f.x1 - f.x0, fh = f.y1 - f.y0, ch = el.querySelector('.dpChapa'), barril = k === 'evento';
    const w = fw * (barril ? 0.78 : 0.8), h = fh * (barril ? 0.54 : 0.78), cy = barril ? f.cy + fh * 0.05 : filaCy[k];
    Object.assign(ch.dataset, { w0: w, h0: h, l0: f.cx - r.x0 - w / 2, t0: cy - r.y0 - h / 2, fw, fh });
    ch.style.setProperty('--cf', Math.min(fw, fh) + 'px');
  }
  depChapasEncajar();
  // los rótulos: una línea fina del ancho de la pila y el nombre en la punta de afuera, encima de la caja de arriba
  const T0 = depTorreRect(), pilas = { vos: ['emotes', 'pj'], crear: ['crear', 'ws', 'mods'], otros: ['multi', 'evento'] };
  for (const [p, ks] of Object.entries(pilas)) {
    const el = DEP.cajasEl.querySelector('.dpG_' + p); if (!el) continue;
    let x0 = Math.min(...ks.map((k) => R0[k].x0)), x1 = Math.max(...ks.map((k) => R0[k].x1)); const y = Math.min(...ks.map((k) => R0[k].y0)) - 14 * u;
    // («CREAR»: la línea empieza después de la torre, si la torre está detrás)
    if (p === 'crear' && T0 && T0.y1 > y - 10 && T0.x1 > x0 && T0.x0 < x1) { if (DEP.sx > 0) x0 = Math.max(x0, T0.x1 + 6 * u); else x1 = Math.min(x1, T0.x0 - 6 * u); }
    Object.assign(el.style, { left: x0 + 'px', top: y + 'px', width: Math.max(10, x1 - x0) + 'px' });
  }
}
// las letras de las chapas, todas del mismo tamaño (una sola letra para las seis cajas, como en un cartel): primero cada
// chapa sola, con la letra más grande que le entra; después todas con la más chica de esas (el dato, a lo sumo el 90 % de
// la palabra). El barril, que es otra cosa, con la suya si es más chica
function depChapasEncajar() {
  if (!DEP.cajasEl) return;
  const L = DP_K.map((k) => [k, DEP.cajasEl.querySelector('.dpC_' + k + ' .dpChapa')]).filter(([, e]) => e && e.dataset.w0); if (!L.length) return;
  for (const [k] of L) depChapaEncajar(k);
  const cajas = L.filter(([k]) => k !== 'evento'), px = (e, c) => parseFloat(e.querySelector(c).style.fontSize);
  const p = Math.min(...cajas.map(([, e]) => px(e, '.dpChP'))), d = Math.max(14, Math.min(p * 0.9, ...cajas.map(([, e]) => px(e, '.dpChD'))));
  for (const [k] of L) depChapaEncajar(k, { p, d });
}
// la letra de una chapa: la palabra, del tamaño que entre (hasta tope, si lo hay). Primero, cada palabra entera en su
// renglón (de su tamaño para la cara hasta 14 px); si alguna igual no entra, se deja cortar con guion donde lleva el guion
// blando (dos renglones); y si tampoco, la chapa se agranda hasta el 70 % de la cara
function depChapaEncajar(k, tope) {
  const el = DEP.cajasEl && DEP.cajasEl.querySelector('.dpC_' + k + ' .dpChapa'); if (!el || !el.dataset.w0) return;
  const fw = +el.dataset.fw, fh = +el.dataset.fh, P = el.querySelector('.dpChP'), D = el.querySelector('.dpChD');
  // (la chapa, desde su tamaño: ~62 % de la cara)
  let w = +el.dataset.w0, h = +el.dataset.h0; el.dataset.w = w; el.dataset.h = h;
  Object.assign(el.style, { left: el.dataset.l0 + 'px', top: el.dataset.t0 + 'px', width: w + 'px', height: h + 'px' });
  let base = Math.max(14, Math.min(fw, fh) * 0.155), dat = Math.max(14, Math.min(fw, fh) * 0.14);
  if (tope) { base = Math.min(base, tope.p); dat = Math.min(dat, tope.d); }
  const sale = () => el.scrollWidth > el.clientWidth + 0.5 || el.scrollHeight > el.clientHeight + 0.5 || P.scrollWidth > P.clientWidth + 0.5 || D.scrollWidth > D.clientWidth + 0.5;
  const achicar = () => { for (let f = parseFloat(P.style.fontSize); sale() && f > 14; ) { f = Math.max(14, f - 0.5); P.style.fontSize = f + 'px'; } };
  // (el margen de adentro, con la chapa: que la palabra no toque los tornillos)
  el.style.padding = `${Math.max(4, fh * 0.05).toFixed(1)}px ${Math.max(3, fw * 0.05).toFixed(1)}px`;
  P.style.fontSize = base + 'px'; D.style.fontSize = dat + 'px';
  // (primero el dato, en un renglón: si no entra, más chico hasta 14 px)
  for (let f = dat; D.scrollWidth > D.clientWidth + 0.5 && f > 14; ) { f = Math.max(14, f - 0.5); D.style.fontSize = f + 'px'; }
  // (agrandar la chapa: más ancha, sin pasar el 70 % de la cara —si hace falta, un poco más baja—)
  const lim = k === 'evento' ? { a: 0.49, h: 0.62 } : { a: 0.69, h: 0.86 };   // (el barril: hasta la mitad; con 1 % de sobra por los medios píxeles)
  const agrandar = () => {
    for (let i = 0; sale() && i < 10 && w < fw * 0.895; i++) {
      const cx = parseFloat(el.style.left) + w / 2, cy = parseFloat(el.style.top) + h / 2;
      w = Math.min(fw * 0.895, w * 1.03); h = Math.min(h * 1.02, fh * lim.h, fw * fh * lim.a / w);
      Object.assign(el.style, { width: w + 'px', height: h + 'px', left: cx - w / 2 + 'px', top: cy - h / 2 + 'px' }); el.dataset.w = w; el.dataset.h = h;
    }
  };
  P.classList.remove('dpCorta', 'dpRompe'); P.classList.add('dpEntera'); el.classList.remove('dpSinI'); achicar(); agrandar();
  // (si una palabra igual no entra entera a lo ancho: se corta con guion —o, en japonés y tailandés, donde va el espacio de
  // ancho cero—; si lo que no entra es el alto —el barril, en el celular chico—, la chapa va sin el ícono)
  const ancha = () => el.scrollWidth > el.clientWidth + 0.5 || P.scrollWidth > P.clientWidth + 0.5 || D.scrollWidth > D.clientWidth + 0.5;
  if (sale() && !ancha()) el.classList.add('dpSinI');
  if (sale() && ancha()) { P.classList.replace('dpEntera', 'dpCorta'); P.style.fontSize = base + 'px'; achicar(); agrandar(); }
  if (sale() && ancha()) { P.classList.replace('dpCorta', 'dpRompe'); P.style.fontSize = base + 'px'; achicar(); }
  if (sale()) el.classList.add('dpSinI');
  el.classList.toggle('dpSale', sale());
}

// ======================= el paso de cada cuadro =======================
// (lo llama el bucle del juego en el menú, antes de la cámara: las animaciones de las cajas, el haz y tu personaje)
function depPaso(dt) {
  if (!DEP.listo || !depMundoVisible()) return;
  if (!depEscenaViva()) { DEP.listo = false; RB.el.classList.remove('dpListo'); setTimeout(depArmar, 0); return; }
  // (el reloj de las animaciones avanza con los cuadros, de a 50 ms como mucho: en un aparato lento la caja va más despacio
  // pero no salta; las pruebas lo fijan con DEP.relojPrueba)
  DEP.reloj = DEP.relojPrueba !== undefined ? DEP.relojPrueba : (DEP.reloj || 0) + Math.min(dt, 0.05);
  const A = DEP.anim, ahora = DEP.reloj;
  if (A && A.tipo === 'entrada') depEntradaPaso(A, ahora);
  else if (A && (A.tipo === 'agarre' || A.tipo === 'suelta')) depViajePaso(A, ahora);
  // tu personaje: apunta a la caja que agarra (y vuelve)
  const P = DEP.pj; if (P) { const dy = depPjGiro(); P.yaw += dy * Math.min(1, dt * 9); if (Math.abs(dy) < 0.002) P.yaw += dy; }
  // el haz de la pistola de física: de la boca del arma a la caja agarrada
  if (DEP.tenida && (!A || A.tipo !== 'entrada')) depHaz();
  if (DEP.cajasEl && DEP.tenida) depChapaViaja();
  if (!DEP.anim) depPausa();
}
// (cuánto le falta girar a tu personaje: hacia la caja agarrada, o de vuelta a su lugar)
function depPjGiro() {
  const P = DEP.pj; if (!P) return 0;
  let meta = DEP.yawPj;
  if (DEP.tenida && DEP.cajas[DEP.tenida]) { const d = vsub(DEP.cajas[DEP.tenida].o.b.pos, P.pos); meta = Math.atan2(d.x, d.z); }
  return ((meta - P.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}
// ---------------- la entrada ----------------
// Las cajas nuevas caen desde arriba de su lugar (las de abajo primero) con un poco de giro, con la física del juego; cuando
// apoyan (o al rato, por si una rebota), se acomodan en un cuarto de segundo a su lugar exacto y quedan quietas.
function depNovedades() {
  const D = depFirmas(), V = PREFS.dpVisto;
  if (!V) return DP_K.slice();
  return DP_K.filter((k) => D[k] !== undefined && V[k] !== undefined && D[k] > V[k]);
}
// (lo que cuenta como «algo nuevo» en una caja: que haya más emotes, más personajes o más mods para ver que la última vez)
function depFirmas() { return { emotes: (typeof animsOficiales === 'function' ? animsOficiales().length : 0), pj: (DATA.chars || []).length, mods: OFICIALES.length }; }
function depMarcarVisto() { const D = depFirmas(); PREFS.dpVisto = Object.assign({}, PREFS.dpVisto, D); guardarPrefs(); }
function depEntrada(lista) {
  const t0 = DEP.reloj || 0;
  RB.el.classList.add('dpEntra');
  const alto = { pj: 2.6, emotes: 4.2, ws: 3.1, mods: 3.5, crear: 4.9, multi: 2.9, evento: 3.3 }, giro = { pj: 0.5, emotes: -0.7, ws: 0.9, mods: -0.4, crear: 0.6, multi: -0.8, evento: 0.3 };
  const cuando = { pj: 0, ws: 0.08, mods: 0.16, multi: 0.05, evento: 0.12, emotes: 0.62, crear: 0.7 };
  DEP.anim = { tipo: 'entrada', t0, cajas: {} };
  for (const k of lista) {
    const C = DEP.cajas[k]; if (!C) continue;
    const b = C.o.b; C.est = 'cae';
    b.pos.copy(C.L.p); b.pos.y += alto[k] + 40; b.q.copy(Quat.axis(0.4, 1, 0.2, giro[k] * 0.35).mul(C.L.q)); b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.frozen = true; b.updateWorld();
    DEP.anim.cajas[k] = { suelta: t0 + cuando[k], alto: alto[k], giro: giro[k], fase: 0 };
    const el = DEP.cajasEl && DEP.cajasEl.querySelector('.dpC_' + k); if (el) el.classList.add('dpCae');
  }
  depPausa();
}
function depEntradaPaso(A, ahora) {
  let quedan = 0;
  for (const k in A.cajas) {
    const X = A.cajas[k], C = DEP.cajas[k], b = C.o.b;
    if (X.fase === 0) {   // esperando: aparece arriba de su lugar y se suelta
      quedan++; if (ahora < X.suelta) continue;
      b.pos.copy(C.L.p); b.pos.y += X.alto; b.q.copy(Quat.axis(0.4, 1, 0.2, X.giro * 0.35).mul(C.L.q)); b.updateWorld();
      b.frozen = false; b.sleep = false; b.vel.set(0, -1.2, 0); b.ang.set(X.giro * 0.6, X.giro * 1.1, -X.giro * 0.4); X.fase = 1; X.t1 = ahora; continue;
    }
    if (X.fase === 1) {   // cayendo (la física): cuando apoya, o a los 1,4 s, se acomoda
      quedan++;
      const apoyo = b.pos.y - C.L.p.y < 0.12 && b.vel.y > -1.2, tarde = ahora - X.t1 > 1.4;
      if ((apoyo && ahora - X.t1 > 0.45) || tarde) { X.fase = 2; X.t2 = ahora; X.p0 = b.pos.clone(); X.q0 = b.q.clone(); b.frozen = true; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); }
      continue;
    }
    if (X.fase === 2) {   // acomodándose (un cuarto de segundo) a su lugar exacto
      const e = sstep(0, 1, (ahora - X.t2) / 0.25);
      b.pos.set(X.p0.x + (C.L.p.x - X.p0.x) * e, X.p0.y + (C.L.p.y - X.p0.y) * e, X.p0.z + (C.L.p.z - X.p0.z) * e); b.q.copy(X.q0.clone().slerpTo(C.L.q, e)); b.updateWorld(); C.o.md.sucio = true;
      if (e >= 1) { depPoner(k); X.fase = 3; } else quedan++;
    }
  }
  if (!quedan) { DEP.anim = null; RB.el.classList.remove('dpEntra'); depMarcarVisto(); depPausa(); }
}
// ---------------- el agarre ----------------
// Tocar una caja: el haz la agarra y la trae hacia la cámara (0,55 s); ahí se abre su panel. Al volver del panel, vuelve a
// su lugar (0,45 s) y el dibujo queda en pausa otra vez. Con menos movimiento pedido por el aparato, sin el viaje.
function depAgarrar(k) {
  if (!DEP.cajas[k] || (DEP.anim && DEP.anim.tipo !== 'entrada')) return false;
  if (DEP.anim && DEP.anim.tipo === 'entrada') { for (const j in DEP.anim.cajas) depPoner(j); DEP.anim = null; RB.el.classList.remove('dpEntra'); depMarcarVisto(); }
  if (DEP.ayuda) { DEP.ayuda = false; PREFS.dpAyuda = 1; guardarPrefs(); const a = DEP.ui.querySelector('.dpAyuda'); if (a) a.classList.add('oc'); }
  DEP.tenida = k; RB.el.classList.add('dpAgarra'); DEP.cajasEl.querySelector('.dpC_' + k).classList.add('dpTenida');
  if (dpReducido()) { depSostener(k, 1); depAbrir(k); return true; }
  DEP.anim = { tipo: 'agarre', k, t0: DEP.reloj || 0, dur: 0.55 };
  depPausa(); return true;   // (mientras se mueve, sin pausa: el reloj de la animación avanza con los cuadros)
}
function depSoltar() {
  const k = DEP.tenida; if (!k) return;
  if (dpReducido() || !DEP.listo) { depPoner(k); depSoltada(); return; }
  DEP.anim = { tipo: 'suelta', k, t0: DEP.reloj || 0, dur: 0.45 };
  depPausa();
}
function depSoltada() {
  const k = DEP.tenida; DEP.tenida = null; DEP.anim = null; if (k) depPoner(k);
  RB.el.classList.remove('dpAgarra'); const el = k && DEP.cajasEl.querySelector('.dpC_' + k); if (el) { el.classList.remove('dpTenida'); const ch = el.querySelector('.dpChapa'); ch.style.transform = ''; }
  depCajasPoner(); depPausa(); dibujoDespertar();
}
// dónde se sostiene la caja: delante de la cámara, a la izquierda (a la derecha en árabe), de frente y un poco girada hacia vos
function depSostenida(k) {
  const E = DEP.enc, c = DEP.cam.pos, d = 2.35, x = (DEP.sx > 0 ? 0.34 : 0.66) * E.W, y = 0.4 * E.H, C = DEP.cajas[k];
  const q = Quat.axis(0.3, 1, 0.15, DEP.sx * 0.28); if (C.L.cap) q.mul(C.L.cap);
  return { p: v3(c.x - (x - E.W / 2) * d / E.f, c.y + (E.H / 2 - y) * d / E.f, c.z + d), q };
}
function depSostener(k, e) {
  const C = DEP.cajas[k], b = C.o.b, S = depSostenida(k), L = C.L, a = L.p, z = S.p;
  // (por una curva: sube un poco y viene)
  const m = v3((a.x + z.x) / 2, Math.max(a.y, z.y) + 0.55, (a.z + z.z) / 2), t = e, u = 1 - t;
  b.pos.set(u * u * a.x + 2 * u * t * m.x + t * t * z.x, u * u * a.y + 2 * u * t * m.y + t * t * z.y, u * u * a.z + 2 * u * t * m.z + t * t * z.z);
  b.q.copy(L.q.clone().slerpTo(S.q, e)); b.frozen = true; b.updateWorld(); C.o.md.sucio = true; C.est = e >= 1 ? 'tenida' : 'viaja';
}
function depViajePaso(A, ahora) {
  const t = clamp((ahora - A.t0) / A.dur, 0, 1), e = t * t * (3 - 2 * t);
  depSostener(A.k, A.tipo === 'agarre' ? e : 1 - e);
  if (t < 1) return;
  if (A.tipo === 'agarre') { DEP.anim = null; depAbrir(A.k); }
  else depSoltada();
}
// (la chapa acompaña a la caja que viaja: va al centro de su cara y se agranda como ella, según lo cerca que está)
function depChapaViaja() {
  const k = DEP.tenida, el = DEP.cajasEl.querySelector('.dpC_' + k + ' .dpChapa'), f0 = DEP.cara && DEP.cara[k], C = DEP.cajas[k]; if (!el || !f0 || !C) return;
  const f = depCara(k, false); if (!f) return;
  const z0 = C.L.p.z - DEP.cam.pos.z, z1 = C.o.b.pos.z - DEP.cam.pos.z, k2 = z0 / Math.max(0.3, z1);
  el.style.transform = `translate(${(f.cx - f0.cx).toFixed(1)}px, ${(f.cy - f0.cy).toFixed(1)}px) scale(${k2.toFixed(3)})`;
}
// el haz: una curva celeste de la boca de la pistola a la cara de la caja (con el ancho de unas líneas al lado)
function depHaz() {
  const P = DEP.pj, C = DEP.cajas[DEP.tenida]; if (!P || !C) return;
  DEP.hazN = (DEP.hazN || 0) + 1;
  const hi = P.D && P.D.h && P.D.h.RightHand, W = hi !== undefined && P.md && P.md.W && P.md.W[hi];
  const f = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  const p0 = W ? vadd(v3(W[12], W[13], W[14]), vadd(vscale(f, 0.42), v3(0, 0.06, 0))) : vadd(P.pos, v3(0, 0.3, 0));
  const b = C.o.b, p1 = vadd(b.pos, b.q.rot(v3(0, 0, -C.L.ancho * 0.45)));
  const mid = vadd(vadd(p0, vscale(f, Math.min(1.6, p0.distTo(p1) * 0.5))), v3(0, 0.25, 0));
  const lado = vcross(vsub(p1, p0), vsub(CAM.pos, p0)).norm(), n = 18;
  for (const [o, c] of [[0, [0.86, 0.97, 1, 1]], [0.012, [0.35, 0.78, 1, 0.75]], [-0.012, [0.35, 0.78, 1, 0.75]], [0.026, [0.3, 0.6, 1, 0.35]], [-0.026, [0.3, 0.6, 1, 0.35]]]) {
    let prev = vadd(p0, vscale(lado, o));
    for (let i = 1; i <= n; i++) { const t = i / n, a = vadd(vadd(vscale(p0, (1 - t) * (1 - t)), vadd(vscale(mid, 2 * t * (1 - t)), vscale(p1, t * t))), vscale(lado, o * (1 - t * 0.5))); linea(prev, a, c); prev = a; }
  }
}
// ---------------- resaltar (el foco del teclado o el mando, el mouse encima) ----------------
function depResaltar(k, por) {
  if (DEP[por] === k) return;
  DEP[por] = k; depBrillos();
  if (DEP.listo) dibujoDespertar();
}
// el brillo de cada caja (extra del modelo: el borde y lo que se enciende): la resaltada, con el borde azul; el barril, violeta
function depBrillos() {
  const r = DEP.foco || DEP.sobre, n = DEP.noche > 0.5;
  for (const j of DP_K) {
    const C = DEP.cajas[j]; if (!C || !C.o) continue;
    C.o.md.extra = j === 'evento' ? { rim: j === r ? DP_RIM : n ? DP_RIM_BARRIL_N : DP_RIM_BARRIL, em: n ? DP_EM_NOCHE : DP_EM_DIA } : j === r ? { rim: DP_RIM } : null;
  }
}
// ---------------- la pausa del dibujo ----------------
// Sin nada que se mueva, el dibujo queda en pausa (principal.js): el lienzo se queda con el último cuadro.
function depPausa() {
  const quieta = JUEGO.estado === 'principal' && DEP.listo && depMundoVisible() && !DEP.anim && !DEP.armando && Math.abs(depPjGiro()) < 0.002;
  if (typeof dibujoPausar === 'function') dibujoPausar(quieta);
}
// ¿se dibuja el mundo del depósito? (en el menú, con la escena armada; con el panel de Personajes, no: ése tiene su escenario)
function depMundoVisible() { return JUEGO.estado === 'principal' && DEP.listo && !!RB.el && !RB.el.classList.contains('oc') && RB.panel !== 'personajes' && RB.panel !== 'bienvenida' && MUNDO.nombre === 'FlatGrass'; }
function depCamara(cam) {
  if (!depMundoVisible() || !DEP.enc) return false;
  cam.pos.copy(DEP.cam.pos); cam.q.copy(new Quat()); cam.fov = DEP.cam.fov; return true;
}

// ======================= mostrar =======================
const depVisible = () => !!(DEP.el && !DEP.el.classList.contains('oc') && RB.el && !RB.el.classList.contains('oc'));
function depMostrar(on) {
  if (!DEP.el) return;
  on = !!on; DEP.el.classList.toggle('oc', !on); RB.el.classList.toggle('dpOn', on);
  RB.el.classList.toggle('dpFondo', RB.panel !== 'personajes' && RB.panel !== 'bienvenida');
  EVT.enMenu = true;
  if (!on) { if (DEP.hoja) depHoja(null); if (DEP.lista) depListaCerrar(); depPausa(); return; }
  if (MENU.lobby) menuLobby(false); MENU.caja = null;
  DEP.ayuda = !PREFS.dpAyuda; const a = DEP.ui && DEP.ui.querySelector('.dpAyuda'); if (a) a.classList.toggle('oc', !DEP.ayuda);
  depDatosPintar(); depEncajar(true); depLuzPj();   // (por si cambió la calidad en Ajustes)
  // (la escena se arma después de mostrar la página: JUGAR ya se puede tocar mientras tanto)
  if (!depEscenaViva() && !DEP.armando) { DEP.listo = false; RB.el.classList.remove('dpListo'); depArmarLuego(); }
  else if (DEP.tenida) depSoltar();
  depPausa(); dibujoDespertar();
}
// (la escena se arma cuando la página ya se puede tocar: con la pantalla de carga yéndose y un respiro, así armarla —el mapa,
// las cajas, compilar lo que se dibuja— no atrasa el primer toque; mientras, atrás del menú hay un cielo y un pasto pintados)
function depArmarLuego() {
  clearTimeout(DEP.tArmar);
  const cargando = () => { const c = document.getElementById('carga'); return !!(c && !c.classList.contains('oc') && !c.classList.contains('salir')); };
  DEP.tArmar = setTimeout(() => {
    if (JUEGO.estado !== 'principal' || !rbVisible() || depEscenaViva() || DEP.armando) return;
    // (con el panel de Personajes abierto, después: su escenario —el lobby— es lo que se ve y armar la escena lo borraría)
    if (cargando() || RB.panel === 'personajes') return depArmarLuego();
    depArmar();
  }, 150);
}
// (al salir del menú a una partida: la escena es del mundo de la partida, que la borra al empezar)
function depSalir() { EVT.enMenu = false; DEP.listo = false; DEP.tenida = null; DEP.anim = null; if (RB.el) RB.el.classList.remove('dpListo', 'dpAgarra'); if (typeof dibujoPausar === 'function') dibujoPausar(false); }

// ======================= acciones (las llama inicioAccion primero) =======================
// (qué abre cada caja: el panel de siempre de esa sección)
function depAbrir(k) {
  switch (k) {
    case 'emotes': depMarcarVistoSec('anim'); RB.t.vista = 'explorar'; return inicioAccion('tab:anim');
    case 'pj': return inicioAccion('personajes');
    case 'crear': return inicioAccion('crear');
    case 'ws': depMarcarVistoSec('gmod'); RB.t.vista = 'explorar'; return inicioAccion(typeof GM_ICO !== 'undefined' ? 'tab:gmod' : 'tab:mod');
    case 'mods': RB.t.vista = 'explorar'; return inicioAccion('tab:mod');
    case 'multi': return inicioAccion('multi');
    case 'evento': return inicioPanel('evento');
  }
}
const depVistoSec = (k) => !!(PREFS.ptVisto && PREFS.ptVisto[k]);
function depMarcarVistoSec(k) { if (depVistoSec(k)) return; PREFS.ptVisto = Object.assign({}, PREFS.ptVisto, { [k]: 1 }); guardarPrefs(); }
function depAccion(a, v, b) {
  // (lo que se elige adentro de una hoja la cierra)
  if (DEP.hoja && b && DEP.hoja.contains(b)) depHoja(null);
  if (DEP.lista && b && DEP.ui.querySelector('.dpLista').contains(b) && a !== 'dpEvSw') depListaCerrar();
  switch (a) {
    case 'jugar': inicioAccion('empezar'); return true;
    case 'dp': if (!depAgarrar(v)) { if (!DEP.listo) depAbrir(v); } return true;
    case 'dpPerfil': depHoja(DEP.hoja && DEP.abrio === b ? null : 'perfil', DEP.tecla); return true;
    case 'dpAjustes': depHoja(DEP.hoja && DEP.abrio === b ? null : 'ajustes', DEP.tecla); return true;
    case 'dpCerrar': depHoja(null); if (DEP.lista) depListaCerrar(); return true;
    case 'dpSoc': if (typeof SOC !== 'undefined') SOC.tab = (SOC.sol || 0) || !((SOC.badge || 0) > 0) ? 'amigos' : 'chats'; inicioPanel('social'); return true;
    case 'dpAj': abrirAjustes('principal'); { const c = $('ajustesCaja'), t = c && c.querySelector(`[data-aj=${v === 'g' ? 'g' : 'c'}]`); if (t) t.click(); if (v === 's') { const r = $('aV'); if (r) setTimeout(() => { try { r.focus(); r.scrollIntoView({ block: 'center' }); } catch (e) {} }, 60); } } return true;
    case 'dpTut': if (typeof tutAbrir === 'function') tutAbrir(); return true;
    case 'dpAct': depActualizar(); return true;
    case 'dpLista': depListaAbrir(); return true;
    case 'dpL': depListaElegir(v); return true;
    case 'dpEvSw': PREFS.evento = PREFS.evento === false; guardarPrefs(); depEventoPintar(); depDatosPintar(); if (DEP.listo) dibujoDespertar(); return true;
  }
  return false;
}
// el panel del evento (el barril): qué es y el interruptor (lo mismo que Ajustes → Renderizado)
function panelEvento(P) {
  P.innerHTML = `<div class="rbPanCab">${glifo('rayo')} ${esc(T('dp.grieta').replace(/[\u00ad\u200b]/g, ''))}<small>${esc(T('pt.evento'))}</small></div>
    <div class="rbPanCuerpo dpEvCuerpo">${FONDOS_RB[4] ? `<div class="dpEvFoto" style="background-image:url(${FONDOS_RB[4]})"></div>` : ''}<div class="dpEvTxt"><p>${esc(T('dp.eventoTxt'))}</p>
      <button class="dpEvSw" data-rb="dpEvSw" role="switch" aria-checked="false"><span>${esc(T('aj.evento'))}</span><i></i><b></b></button></div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span></div>`;
  depEventoPintar();
}
function depEventoPintar() {
  const on = PREFS.evento !== false;
  for (const b of document.querySelectorAll('#rbInicio .dpEvSw')) { b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); const t = b.querySelector('b'); if (t) t.textContent = T(on ? 'pt.on' : 'pt.off'); }
}

// ======================= las hojas (el perfil y los ajustes) =======================
// Se abren debajo de su botón, encima de un velo que las cierra al tocar afuera; Esc o B también, y el foco vuelve al botón.
function depHoja(cual, foco) {
  if (!DEP.ui) return;
  const H = cual ? DEP.ui.querySelector(cual === 'perfil' ? '.dpHojaPerfil' : '.dpHojaAj') : null;
  for (const h of DEP.ui.querySelectorAll('.dpHoja')) h.classList.toggle('oc', h !== H);
  DEP.ui.querySelector('.dpVelo').classList.toggle('oc', !H && !DEP.lista);
  for (const [s, k] of [['.dpPerfil', 'perfil'], ['.dpAj', 'ajustes']]) { const b = DEP.ui.querySelector(s); if (b) { b.setAttribute('aria-expanded', H && cual === k ? 'true' : 'false'); b.classList.toggle('dpAbierto', !!H && cual === k); } }
  const antes = DEP.abrio; DEP.hoja = H; DEP.abrio = H ? DEP.ui.querySelector(cual === 'perfil' ? '.dpPerfil' : '.dpAj') : null;
  RB.el.classList.toggle('dpHojaOn', !!H);
  if (H) { depHojaEncajar(); if (foco) { const f = depFocos()[0]; if (f) f.focus(); } }
  else { depNombre(); if (foco && antes && antes.isConnected) antes.focus(); }
}
function depHojaEncajar() {
  const H = DEP.hoja; if (!H) return;
  const b = DEP.abrio, alto = RB.el.clientHeight || VH(), top = b ? b.offsetTop + b.offsetHeight + 8 : 60;
  H.style.top = top + 'px'; H.style.maxHeight = Math.max(120, alto - top - 8) + 'px';
}
// ======================= la Lista (teclado y mando) =======================
// Todo lo del menú en cuatro grupos, con el foco a la vista: Jugar, Crear y bajar, Vos, En vivo y más.
function depListaAbrir() {
  const L = DEP.ui.querySelector('.dpLista'), D = depDatos(), mc = RB.mapaCom && mapaDe(RB.mapaCom), nom = mc ? nombreDe(mc) : mapaNom(RB.mapa);
  const it = (k, ic, t, cls) => `<button class="dpLi${cls ? ' ' + cls : ''}" data-rb="dpL:${k}">${typeof ic === 'string' && ic.startsWith('<') ? ic : glifo(ic)}<span dir="auto">${esc(t)}</span></button>`;
  const cero = (s) => String(s).replace(/[\u00ad\u200b]/g, '');
  L.innerHTML = `<div class="dpLcols">
    <div><h3>${esc(T('pt.jugar'))}</h3>${it('jugar', 'jugar', T('pt.jugar'), 'dpLverde')}${it('nueva', 'mapa', `${T('pt.mapa')} · ${nom}`)}${it('multi', 'mundo', cero(D.multi[0]))}${it('mcrear', 'servidor', T('mp.crear'))}</div>
    <div><h3>${esc(T('dp.gCrear'))}</h3>${it('ws', 'caja', `${cero(D.ws[0])} · ${D.ws[1]}`)}${it('mods', 'mods', cero(D.mods[0]))}${it('crear', 'martillo', cero(D.crear[0]))}</div>
    <div><h3>${esc(T('dp.gVos'))}</h3>${it('pj', 'persona', cero(D.pj[0]))}${it('emotes', 'baile', cero(D.emotes[0]))}${it('perfil', 'persona', T('dp.perfil'))}${it('amigos', 'gente', T('dp.amigosChats'))}</div>
    <div><h3>${esc(T('dp.gVivo'))}</h3>${it('evento', 'rayo', `${cero(D.evento[0])} · ${D.evento[1]}`)}${it('ajustes', 'ajustes', T('pz.ajustes'))}${it('mas', 'mundo', T('dp.mas2'))}</div></div>
    <div class="dpLpie"><span><kbd>↑↓←→</kbd> ${esc(T('dp.mover'))}</span><span><kbd>A</kbd>/<kbd>Enter</kbd> ${esc(T('dp.abrir'))}</span><span><kbd>B</kbd>/<kbd>Esc</kbd> ${esc(T('volver'))}</span></div>`;
  L.classList.remove('oc'); DEP.lista = true; RB.el.classList.add('dpListaOn');
  DEP.ui.querySelector('.dpVelo').classList.remove('oc');
  depListaEncajar();
  (L.querySelector('.dpLi') || L).focus();
}
function depListaCerrar() {
  const L = DEP.ui && DEP.ui.querySelector('.dpLista'); if (!L) return;
  L.classList.add('oc'); DEP.lista = false; RB.el.classList.remove('dpListaOn'); if (!DEP.hoja) DEP.ui.querySelector('.dpVelo').classList.add('oc');
}
function depListaEncajar() {
  const L = DEP.ui.querySelector('.dpLista'), b = DEP.ui.querySelector('.dpPerfil'), alto = RB.el.clientHeight || VH(), top = b.offsetTop + b.offsetHeight + 8;
  L.style.top = top + 'px'; L.style.maxHeight = Math.max(140, alto - top - 8) + 'px';
}
function depListaElegir(k) {
  switch (k) {
    case 'jugar': return inicioAccion('empezar');
    case 'nueva': return inicioAccion('nueva');
    case 'mcrear': return inicioAccion('mcrear');
    case 'perfil': return depHoja('perfil', true);
    case 'amigos': return depAccion('dpSoc');
    case 'ajustes': return depHoja('ajustes', true);
    case 'mas': return depHoja('ajustes', true);
    default: if (DP_K.includes(k)) { if (!depAgarrar(k)) depAbrir(k); }
  }
}

// ======================= teclado y mando =======================
// Las flechas (o la cruceta) van a lo más cercano en esa dirección —las cajas también—; Tab y Mayús+Tab, en orden; Enter o A
// lo elige; Esc o B cierran la hoja o la Lista (y, en un panel, vuelven). Sin foco, la primera flecha va a JUGAR.
const DP_ENCIMA = '#ajustes:not(.oc), #cuDlg:not(.oc), #tut:not(.oc), #pjiVen:not(.oc), #ctlEd:not(.oc), #cfDlg:not(.oc), .mpModal.ve, #carga:not(.oc):not(.fin)';
const depActiva = () => depVisible() && !RB.panel && typeof JUEGO !== 'undefined' && JUEGO.estado === 'principal' && !document.querySelector(DP_ENCIMA) && !(window.__carga && window.__carga.listo === false);
function depFocos() {
  const vis = (e) => e.offsetWidth > 0 && !e.closest('.oc');
  if (DEP.hoja) return [...DEP.hoja.querySelectorAll('button, input')].filter(vis);
  if (DEP.lista) return [...DEP.ui.querySelectorAll('.dpLista button')].filter(vis);
  // (el orden: el perfil, las cajas, Amigos, Ajustes, el mapa y JUGAR)
  const U = DEP.ui, q = (s) => U.querySelector(s);
  return [q('.dpPerfil'), ...DP_K.map((k) => DEP.cajasEl.querySelector('.dpC_' + k)), q('.dpAmigos'), q('.dpAj'), q('.dpMapa'), q('.dpJugar')].filter((e) => e && vis(e));
}
function depRect(e) { let x = 0, y = 0, n = e; while (n && n !== RB.el) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y, w: e.offsetWidth, h: e.offsetHeight }; }
function depMover(dir) {
  const L = depFocos(), act = document.activeElement, i = L.indexOf(act);
  if (dir === 'sig' || dir === 'ant') { const j = i < 0 ? 0 : (i + (dir === 'sig' ? 1 : L.length - 1)) % L.length; L[j].focus(); return; }
  if (i < 0) { (DEP.hoja || DEP.lista ? L[0] : DEP.ui.querySelector('.dpJugar') || L[0]).focus(); return; }
  const rtl = RB.el.dir === 'rtl', d = { izq: [rtl ? 1 : -1, 0], der: [rtl ? -1 : 1, 0], arriba: [0, -1], abajo: [0, 1] }[dir];
  const c = (r) => [r.x + r.w / 2, r.y + r.h / 2], [ax, ay] = c(depRect(act));
  let mejor = null, md = Infinity;
  for (const e of L) {
    if (e === act) continue; const [x, y] = c(depRect(e)), dx = x - ax, dy = y - ay;
    const p = dx * d[0] + dy * d[1], s = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
    if (p <= 4) continue; const dist = p + s * 2.2; if (dist < md) { md = dist; mejor = e; }
  }
  if (mejor) mejor.focus();
}
function depTecla(e) {
  if (!depActiva()) return;
  const k = e.key, t = e.target, enNom = t && t.id === 'rbNombre';
  DEP.tecla = true;
  const dirs = { ArrowLeft: 'izq', ArrowRight: 'der', ArrowUp: 'arriba', ArrowDown: 'abajo' };
  if (k === 'Escape' && (DEP.hoja || DEP.lista)) { e.preventDefault(); e.stopPropagation(); if (DEP.lista) { depListaCerrar(); const g = DEP.ui.querySelector('.dpAj'); if (g) g.focus(); } else depHoja(null, true); return; }
  if (enNom) { if (k === 'Tab' || k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); depMover(k === 'Tab' ? (e.shiftKey ? 'ant' : 'sig') : dirs[k]); } return; }
  if (k === 'Tab') { e.preventDefault(); e.stopPropagation(); depMover(e.shiftKey ? 'ant' : 'sig'); return; }
  if (dirs[k]) { e.preventDefault(); e.stopPropagation(); depMover(dirs[k]); return; }
  if (k === 'Enter' || k === ' ') {
    const a = document.activeElement; e.stopPropagation();
    if (!a || !DEP.el.contains(a)) { e.preventDefault(); depMover('abajo'); }
    return;   // (un botón con el foco lo aprieta el navegador solo)
  }
  if (k === 'Escape' && DEP.el.contains(document.activeElement)) { e.stopPropagation(); document.activeElement.blur(); }
}
// el mando (sólo mientras hay uno conectado): la cruceta o la palanca izquierda mueven el foco, A elige y B vuelve
function depMandoPaso() {
  const P = DEP.pad; if (!P.on) return;
  let pads = []; try { pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch (e) {}
  if (!pads.length) { P.on = false; return; }
  requestAnimationFrame(depMandoPaso);
  const g = pads[0], bt = (i) => !!(g.buttons[i] && g.buttons[i].pressed), ax = (i) => g.axes[i] || 0, ahora = performance.now();
  const est = { arriba: bt(12) || ax(1) < -0.6, abajo: bt(13) || ax(1) > 0.6, izq: bt(14) || ax(0) < -0.6, der: bt(15) || ax(0) > 0.6, a: bt(0), b: bt(1) };
  const nuevo = (k) => est[k] && !P.ant[k];
  if (depActiva()) {
    DEP.tecla = true;
    for (const k of ['arriba', 'abajo', 'izq', 'der']) if (nuevo(k) || (est[k] && ahora > P.rep)) { depMover(k); P.rep = ahora + (nuevo(k) ? 420 : 160); break; }
    if (nuevo('a')) { const a = document.activeElement; if (a && DEP.el.contains(a) && a.tagName === 'BUTTON') a.click(); else depMover('abajo'); }
    if (nuevo('b')) { if (DEP.lista) depListaCerrar(); else if (DEP.hoja) depHoja(null, true); }
  } else if (nuevo('b') && RB.el && RB.panel && rbVisible()) { const v = RB.el.querySelector('.rbPan [data-rb=volver]'); if (v) v.click(); }
  P.ant = est;
}
