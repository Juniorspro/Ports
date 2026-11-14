// ---------------- JXMod: la portada del menú principal ----------------
// Pedido del dueño, con la captura de la pantalla principal de otro juego de tiros: «hagamos una interfaz nueva así, vos
// ordenás y diseñás mejores botones con diseño en los botones». De la captura se toma sólo la distribución y la sensación
// (nada de su nombre, su logo ni su arte): todo lo que se ve es de JXMod (tu personaje en 3D, las fotos de las pantallas
// de carga, las escenas del evento, los renders de las armas y los íconos del juego).
//  · en el centro, tu personaje grande en un escenario: la pantalla gigante del fondo muestra el mapa elegido, con luces
//    y una base con el filo amarillo donde está parado (se gira arrastrando; tocarlo abre Personajes);
//  · arriba a la izquierda, tu perfil: tu personaje, tu nombre (se escribe ahí mismo) y la cuenta de Google;
//  · arriba a la derecha, los contadores que existen de verdad (mods activos y addons de GMod instalados: nada de monedas)
//    y los íconos (amigos, chats, idioma, ajustes y salir);
//  · a la izquierda, las tarjetas con arte: Workshop de GMod | Emotes (con el cartel «Nuevo» hasta que la abrís), el
//    Multijugador con los que están en línea y el Evento de la grieta (se prende y se apaga ahí);
//  · a la derecha, los accesos chicos: el tutorial, Discord, TikTok y Actualizar (sólo si hay cómo);
//  · abajo, las pestañas (Personajes, Mods y mapas, Crear un mapa) y la versión;
//  · abajo a la derecha, el mapa elegido (tocarlo abre Empezar partida nueva: mapa, hora y modo) y JUGAR, que entra
//    directo a ese mapa.
// Los paneles (Nueva partida, Multijugador, Social, la tienda, Crear, Personajes...) son los de siempre: la portada sólo
// reemplaza la lista de texto y los botones de abajo del menú anterior. Se maneja también con el teclado (flechas, Tab y
// Enter) y con un mando (cruceta o palanca, A para elegir y B para volver).
// El costo: el fondo es fijo (degradados y la foto, sin animaciones ni filtros), así que se pinta una sola vez; lo único
// que se mueve es el personaje (el lienzo del juego, a 30 cuadros en el menú como antes), y en los celulares flojos ni
// eso (ver ptdSaltarCuadro). Ver pruebas/menu_nuevo.mjs.
const PTD = { fondo: null, el: null, ui: null, esc: null, arr: null, obs: null, pad: { on: false, ant: {}, rep: 0 } };
// (el personaje en el escenario: de la coronilla al 3,5 % del alto del escenario a los pies al 94 %; ver lobbyEncuadre)
const PT_ESC = { arriba: 0.035, pies: 0.94, ancho: 0.7 };
const ptdVisto = (k) => !!(PREFS.ptVisto && PREFS.ptVisto[k]);
function ptdMarcarVisto(k) { if (ptdVisto(k)) return; PREFS.ptVisto = Object.assign({}, PREFS.ptVisto, { [k]: 1 }); guardarPrefs(); }
// la foto del mapa elegido: la de su pantalla de carga; si no tiene, una escena del juego (siempre la misma para ese mapa)
function ptdFotoMapa() {
  const mc = RB.mapaCom && mapaDe(RB.mapaCom), C = window.__carga;
  if (mc) return mc.foto || icono(MAPA_ICONO[mc.base]) || '';
  const f = C && C.foto && typeof FONDO_MAPA !== 'undefined' && FONDO_MAPA[RB.mapa] ? C.foto(FONDO_MAPA[RB.mapa]) : '';
  if (f) return f;
  if (FONDOS_RB.length) { let h = 0; for (const c of String(RB.mapa)) h = (h * 31 + c.charCodeAt(0)) | 0; return FONDOS_RB[Math.abs(h) % FONDOS_RB.length]; }
  return icono(MAPA_ICONO[RB.mapa]) || '';
}
// las fotos de las tarjetas: una pantalla de carga (o una escena del evento) por tarjeta
const ptdFoto = (carga, escena) => { const C = window.__carga, f = C && C.foto ? C.foto(carga) : ''; return f || FONDOS_RB[escena % Math.max(1, FONDOS_RB.length)] || ''; };
// ---------------- armar ----------------
// el fondo del escenario va detrás del lienzo del juego (que en la portada se borra transparente): así el personaje queda
// parado adelante de la pantalla gigante y de las luces, y los botones (en #rbInicio) adelante de todo
function ptdCrear(home) {
  PTD.el = home;
  home.innerHTML = `<div class="ptEscena lobbyCaja" role="button" tabindex="0" data-rb="personajes"></div><div class="ptUI"></div>`;
  PTD.ui = home.querySelector('.ptUI'); PTD.esc = home.querySelector('.ptEscena'); PTD.esc._esc = PT_ESC;
  const F = document.createElement('div'); F.id = 'ptFondo'; F.className = 'oc'; F.setAttribute('aria-hidden', 'true');
  F.innerHTML = `<div class="ptLed"><img alt="" draggable="false"></div><div class="ptRefl"><img alt="" draggable="false"></div><div class="ptTorre ptTorreI"></div><div class="ptTorre ptTorreD"></div>
    <div class="ptTruss"></div><div class="ptHaz ptHaz1"></div><div class="ptHaz ptHaz2"></div><div class="ptHaz ptHaz3"></div><div class="ptPiso"></div><div class="ptLuz"></div><div class="ptBase"></div>`;
  const cv = document.getElementById('cv'); if (cv && cv.parentNode) cv.parentNode.insertBefore(F, cv); else document.body.prepend(F);
  PTD.fondo = F;
  // girar el personaje arrastrando; un toque (sin arrastrar) abre Personajes
  const E = PTD.esc;
  E.addEventListener('pointerdown', (e) => { PTD.arr = { x: tX(e), x0: tX(e), y0: tY(e), t: performance.now(), id: e.pointerId }; try { E.setPointerCapture(e.pointerId); } catch (er) {} });
  E.addEventListener('pointermove', (e) => { const A = PTD.arr; if (!A || A.id !== e.pointerId) return; const x = tX(e); MENU.yaw -= (x - A.x) * 0.012; A.x = x; });
  const fin = (e) => { const A = PTD.arr; PTD.arr = null; if (!A || A.id !== e.pointerId) return; if (e.type === 'pointerup' && Math.hypot(tX(e) - A.x0, tY(e) - A.y0) < 8 && performance.now() - A.t < 700) { audioIniciar(); inicioAccion('personajes', E); } };
  E.addEventListener('pointerup', fin); E.addEventListener('pointercancel', fin);
  // (el clic del toque ya lo manejó el pointerup: que no lo repita el de #rbInicio)
  E.addEventListener('click', (e) => { if (e.detail) e.stopPropagation(); });
  addEventListener('keydown', ptdTecla, true);
  addEventListener('resize', () => setTimeout(ptdEncajar, 70));
  try { document.fonts.addEventListener('loadingdone', () => { if (ptdVisible()) ptdEncajar(); }); } catch (e) {}
  addEventListener('gamepadconnected', () => { PTD.pad.on = true; ptdMandoPaso(); });
  // (Actualizar de la web —herramientas/codigo_web.mjs— pone su botón en el body cuando hay una versión nueva)
  try { PTD.obs = new MutationObserver(() => { if (ptdVisible()) ptdActualizarVer(); }); PTD.obs.observe(document.body, { childList: true }); } catch (e) {}
}
// todo lo de la portada (se vuelve a armar al cambiar el idioma, el nombre, los mods o el personaje; el escenario no)
function ptdDibujar() {
  if (!PTD.ui) return;
  const I = IDIOMAS_RB[PREFS.lang] || IDIOMAS_RB.en, nm = modsTodos().filter((m) => PREFS.mods[m.id]).length, na = Object.keys(PREFS.gmod || {}).length;
  const gmOk = typeof GM_ICO !== 'undefined';
  const lbl = (t) => `title="${esc(t)}" aria-label="${esc(t)}"`;
  const ico = (rb, gl, t, cls) => `<button class="ptIco${cls ? ' ' + cls : ''}" data-rb="${rb}" ${lbl(t)}><span class="ptIcoF"></span>${gl}</button>`;
  const mini = (rb, gl, t, cls, extra) => `<button class="ptMini${cls ? ' ' + cls : ''}" data-rb="${rb}" ${lbl(t)}${extra || ''}><span class="ptIcoF"></span>${gl}</button>`;
  const nuevo = (k) => (ptdVisto(k) ? '' : `<i class="ptNuevo">${esc(T('pt.nuevo'))}</i>`);
  const pj = typeof pjNomActual === 'function' ? pjNomActual() : PREFS.skin;
  const red = (n) => RED_SOCIAL.find((r) => r[0] === n) || ['', '', ''];
  const tab = (rb, gl, t) => `<button class="ptTab" data-rb="${rb}"><span class="ptTabF"></span>${gl}<span class="ptTabT ptFit">${esc(t)}</span></button>`;
  PTD.ui.innerHTML = `<div class="ptArriba">
      <div class="ptPerfil"><button class="ptAvatar" data-rb="personajes" ${lbl(T('m.personajes'))}><img class="ptAvatarI" src="${esc(retrato(PREFS.skin))}" alt="" draggable="false"></button>
        <label class="ptNomL"><input id="rbNombre" class="ptNom" maxlength="16" spellcheck="false" autocomplete="off" dir="auto" aria-label="${esc(T('b.nombre'))}"><small class="ptPj ptFit" dir="auto">${glifo('persona')}<span>${esc(pj)}</span></small></label>
        <span class="ptCuenta"></span></div>
      <img class="rbLogo ptLogo" alt="JXMod" src="${LOGO_RB}" draggable="false">
      <div class="ptDer">
        <button class="ptCont" data-rb="ptMods" ${lbl(nm ? `${nm} ${T(nm === 1 ? 'modAct1' : 'modsAct')}` : T('sinMods'))}>${icoHTML('ico:mod', 'ptContI')}<b>${nm}</b></button>
        ${gmOk ? `<button class="ptCont" data-rb="ptGm" ${lbl(T('pt.addonsN').replace('{n}', na))}><img class="ico ptContI" src="${GM_ICO}" alt=""><b>${na}</b></button>` : ''}
        <span class="ptSepV"></span>
        ${ico('ptSoc:amigos', glifo('gente'), T('so.amigos'), 'ptAmigos')}${ico('ptSoc:chats', glifo('chat'), T('so.chats'), 'ptChats')}
        ${ico('idioma', glifo('mundo') + `<b class="ptIdi">${esc(I[1])}</b>`, I[0], 'ptIdiB')}${ico('opciones', glifo('ajustes'), T('pz.ajustes'))}${ico('salir', glifo('power'), T('m.salir'), 'ptSalir')}
      </div></div>
    <div class="ptIzq">
      <div class="ptDoble">
        ${gmOk ? `<button class="ptCarta ptWs" data-rb="ptWs"><span class="ptMarco"><span class="ptRelleno"><span class="ptRayas"></span></span></span>
          <img class="ptArte" src="${esc(icono('PhysicsGun') || icono('W_PhysGun'))}" alt="" draggable="false"><img class="ptMarca" src="${GM_ICO}" alt="">
          <span class="ptTxt"><b class="ptCT ptFit">${esc(T('pt.workshop'))}</b><small class="ptCS ptFit">${esc(T('pt.workshopSub'))}</small></span>${nuevo('gmod')}</button>` : ''}
        <button class="ptCarta ptEmo" data-rb="ptEmo"><span class="ptMarco"><span class="ptRelleno"><span class="ptRayas"></span></span></span>
          <span class="ptArteE">${icoHTML('ico:fiesta', 'ptE1')}${icoHTML('ico:emote', 'ptE2')}</span>
          <span class="ptTxt"><b class="ptCT ptFit">${esc(T('t.anims'))}</b><small class="ptCS ptFit">${esc(T('pt.emotesSub'))}</small></span>${nuevo('anim')}</button>
      </div>
      <div class="ptMultiC">
        <button class="ptCarta ptMulti" data-rb="multi"><span class="ptMarco"><span class="ptRelleno"><img class="ptFoto" src="${esc(ptdFoto('rb_city', 1))}" alt="" draggable="false"></span></span>
          <span class="ptAnillo"><b class="ptEnN">0</b></span>
          <span class="ptTxt"><b class="ptCT ptFit">${esc(T('pt.multi'))}</b><small class="ptCS ptFit"><i class="ptLed"></i><span class="ptEnT"></span></small></span>
</button>
        <button class="ptMas" data-rb="mcrear" ${lbl(T('mp.crear'))}><span class="ptIcoF"></span>${glifo('mas')}</button>
      </div>
      <button class="ptCarta ptEvento" data-rb="ptEvento" aria-pressed="false"><span class="ptMarco"><span class="ptRelleno"><img class="ptFoto" src="${esc(FONDOS_RB[4] || ptdFoto('rb_ciudad', 4))}" alt="" draggable="false"></span></span>
        <span class="ptTxt"><b class="ptCT ptFit">${esc(T('pt.evento'))}</b><small class="ptCS ptFit">${esc(T('pt.grieta'))}</small></span><span class="ptSw"><i></i><b></b></span></button>
    </div>
    <div class="ptCol">
      ${typeof tutAbrir === 'function' ? mini('ptTut', glifo('pregunta'), T('pt.tutorial')) : ''}
      ${mini('red', red('Discord')[2], 'Discord', 'ptRed', ` data-url="${esc(red('Discord')[1])}"`)}${mini('red', red('TikTok')[2], 'TikTok', 'ptRed', ` data-url="${esc(red('TikTok')[1])}"`)}
      ${mini('ptAct', glifo('bajar'), T('pt.actualizar'), 'ptAct oc')}
    </div>
    <nav class="ptTabs">${tab('personajes', glifo('persona'), T('pt.tabPj'))}${tab('tienda', icoHTML('ico:mod'), T('pt.tabMods'))}${tab('crear', glifo('martillo'), T('pt.tabCrear'))}</nav>
    <div class="ptVer"></div>
    <div class="ptPartida">
      <span class="ptCartel ptFit"></span>
      <button class="ptModo" data-rb="nueva"><span class="ptModoF"></span><span class="ptModoFoto"><img alt="" draggable="false"></span>
        <span class="ptModoTxt"><span class="ptTags"><em class="ptTag">${esc(T('unJugador'))}</em></span><b class="ptModoN ptFit" dir="auto"></b><small class="ptModoS ptFit" dir="auto"></small></span>${glifo('adelante', 'ptModoFl')}</button>
      <button class="ptJugar" data-rb="jugar"><span class="ptJugarF"></span><span class="ptJugarI">${glifo('jugar')}</span><b class="ptJugarT ptFit">${esc(T('pt.jugar'))}</b><span class="ptJugarR"></span></button>
    </div>`;
  PTD.esc.setAttribute('aria-label', `${T('m.personajes')} · ${T('pj.girar')}`);
  const inp = PTD.ui.querySelector('#rbNombre'); inp.value = PREFS.nombre || '';
  inp.oninput = () => nombrePoner(inp.value);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
  const ver = PTD.ui.querySelector('.ptVer'); ver.innerHTML = `<span dir="ltr">JXMod <b>${esc(VERSION_RB)}</b> <i>${esc(ARMADO_RB.split(' ')[0])}</i></span>`; ver.title = `JXMod ${VERSION_RB} · ${ARMADO_RB}`;
  ptdMapa(); ptdEvento(); ptdEnLinea(); ptdGlobos(); ptdActualizarVer();
  if (typeof cuentaPintar === 'function') cuentaPintar();
  // (ya mismo —con el personaje dibujándose, el próximo cuadro puede tardar— y otra vez cuando termina de llegar la letra
  // de un idioma —el tailandés, el japonés…: la del aparato, que llega después—)
  ptdEncajar(); requestAnimationFrame(ptdEncajar); clearTimeout(PTD.tEnc); PTD.tEnc = setTimeout(ptdEncajar, 400);
}
// el mapa elegido: la tarjeta de abajo a la derecha y la pantalla gigante del escenario
function ptdMapa() {
  if (!PTD.ui) return;
  const mc = RB.mapaCom && mapaDe(RB.mapaCom), nom = mc ? nombreDe(mc) : mapaNom(RB.mapa), foto = ptdFotoMapa();
  const quien = mc ? (mc.oficial ? T('oficial') : `${T('por')} ${mc.autor}`) : MAPAS_GMOD.includes(RB.mapa) ? "Garry's Mod" : 'JXMod';
  const modo = typeof GMM !== 'undefined' && GMM.elegido && GMM.elegido !== 'auto' ? (GMM.elegido === 'sandbox' ? 'Sandbox' : ((typeof gmmElegibles === 'function' && gmmElegibles().find((M) => M.n === GMM.elegido)) || {}).titulo || GMM.elegido) : '';
  const q = (s) => PTD.ui.querySelector(s);
  q('.ptModoN').textContent = nom;
  // (debajo: de quién es, la hora —con el relojito— y el modo de GMod si elegiste uno)
  q('.ptModoS').innerHTML = `<span class="ptModoQ">${esc(quien)}</span>${glifo('reloj')}<span>${esc(T('h.' + (RB.hora || 'normal')))}</span>${modo ? `<span>· ${esc(modo)}</span>` : ''}`;
  q('.ptModoS').title = [quien, `${T('hora')}: ${T('h.' + (RB.hora || 'normal'))}`, modo].filter(Boolean).join(' · ');
  const im = q('.ptModoFoto img'); if (foto) im.src = foto; else im.removeAttribute('src');
  q('.ptModo').title = `${T('pt.mapa')}: ${nom} · ${T('pt.cambiar')}`;
  const nm = modsTodos().filter((m) => PREFS.mods[m.id]).length;
  q('.ptCartel').textContent = nm ? `${nm} ${T(nm === 1 ? 'modAct1' : 'modsAct')}` : `Sandbox · ${T('sinMods')}`;
  if (PTD.fondo && PTD.foto !== foto) { PTD.foto = foto; for (const i of PTD.fondo.querySelectorAll('img')) { if (foto) i.src = foto; else i.removeAttribute('src'); } }
}
function ptdEvento() {
  const b = PTD.ui && PTD.ui.querySelector('.ptEvento'); if (!b) return;
  const on = PREFS.evento !== false; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.querySelector('.ptSw b').textContent = T(on ? 'pt.on' : 'pt.off'); b.title = T('aj.evento');
}
// los que están jugando en línea (la lista de servers de red.js: la llama listaContadores cada vez que cambia)
function ptdEnLinea() {
  const c = PTD.ui && PTD.ui.querySelector('.ptMulti'); if (!c) return;
  const on = typeof LISTA !== 'undefined' && LISTA.on, L = typeof listaSalas === 'function' ? listaSalas() : [], j = L.reduce((a, e) => a + e.j.length, 0);
  c.querySelector('.ptEnN').innerHTML = on ? String(j) : glifo('gente');   // (sin conexión no se sabe cuántos hay)
  c.querySelector('.ptEnT').textContent = on ? `${T('pt.enLinea')} · ${T('pt.servers').replace('{n}', L.length)}` : T('pt.sinRed');
  c.classList.toggle('ptVivo', !!on);
}
// los globitos de Social: las solicitudes de amistad en Amigos y los mensajes sin leer en Chats (social.js)
function ptdGlobos() {
  if (!PTD.ui || typeof SOC === 'undefined') return;
  const pon = (sel, n) => { const b = PTD.ui.querySelector(sel); if (!b) return; let e = b.querySelector('.soBadge'); if (!n) { if (e) e.remove(); return; } if (!e) { e = document.createElement('em'); e.className = 'soBadge'; b.appendChild(e); } e.textContent = n > 99 ? '99+' : n; };
  const sol = SOC.sol || 0; pon('.ptAmigos', sol); pon('.ptChats', Math.max(0, (SOC.badge || 0) - sol));
}
// Actualizar: en la app, buscar una versión nueva (avisa si ya está la última); en la web, sólo si su botón apareció
const ptdActNativo = () => { try { return !!(window.JXNativo && JXNativo.buscarActualizacion); } catch (e) { return false; } };
function ptdActualizarVer() {
  const b = PTD.ui && PTD.ui.querySelector('.ptAct'); if (!b) return;
  const web = !!document.getElementById('jxAct'), si = ptdActNativo() || web, antes = !b.classList.contains('oc');
  b.classList.toggle('oc', !si); b.classList.toggle('ptHay', web);
  if (si !== antes) requestAnimationFrame(ptdEncajar);
}
function ptdActualizar() {
  if (ptdActNativo()) { try { JXNativo.buscarActualizacion(); } catch (e) {} return; }
  const w = document.getElementById('jxAct'); if (w) w.click();
}
// ---------------- mostrar ----------------
const ptdVisible = () => !!(PTD.el && !PTD.el.classList.contains('oc') && RB.el && !RB.el.classList.contains('oc'));
function ptdMostrar(on) {
  if (!PTD.el) return;
  on = !!on; PTD.el.classList.toggle('oc', !on); RB.el.classList.toggle('ptOn', on);
  if (PTD.fondo) PTD.fondo.classList.toggle('oc', !on);
  if (!on) { if (MENU.caja === PTD.esc) MENU.caja = null; return; }
  MENU.caja = PTD.esc;
  if (!MENU.lobby) { MENU.yaw = Math.PI + 0.3; menuLobby(true); }
  ptdEncajar(); requestAnimationFrame(ptdEncajar);
}
// ---------------- el costo en los celulares flojos ----------------
// Con Gráficos bajos o Patata (o si el aparato pide menos movimiento) el personaje de la portada queda quieto: se anima
// mientras recién aparece, mientras saluda o mientras lo girás (y 2,5 s después) y, el resto del tiempo, el lienzo se queda
// con el último cuadro (no se borra ni se vuelve a dibujar; una vez por segundo se redibuja igual, sin moverlo, por si
// terminó de llegar una textura). Así la portada cuesta menos que el menú de antes, que borraba el lienzo 30 veces por
// segundo y movía la foto del fondo (medido en pruebas/menu_nuevo.mjs). En las otras calidades se anima, salvo que el
// aparato no llegue: si el menú anda a menos de 24 cuadros por segundo tres segundos seguidos (pasados los 5 primeros,
// que son de cargar), también queda quieto hasta que se cierre el juego.
const ptdQuieto = () => PTD.lento || (typeof GFX !== 'undefined' && (GFX.nombre === 'bajo' || GFX.nombre === 'patata')) || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
function ptdSaltarCuadro() {
  const P = MENU.lobby; MENU.dt0 = false;
  if (!P || MENU.caja !== PTD.esc || !ptdVisible()) { PTD.firma = ''; PTD.desde = 0; return false; }
  const ahora = performance.now(), E = PTD.esc;
  if (!PTD.desde) { PTD.desde = ahora; PTD.fpsT = ahora; PTD.bajos = 0; }
  if (!PTD.lento && ahora - PTD.fpsT >= 1000) { PTD.fpsT = ahora; PTD.bajos = TIEMPO.fps && TIEMPO.fps < 24 && ahora - PTD.desde > 5000 ? PTD.bajos + 1 : 0; if (PTD.bajos >= 3) PTD.lento = true; }
  if (!ptdQuieto()) { PTD.firma = ''; return false; }
  const f = [MENU.yaw.toFixed(3), R.cv.width, R.cv.height, PREFS.skin, PREFS.gorro, P.md ? 1 : 0, P.altoM ? P.altoM.toFixed(2) : 0, E.offsetLeft, E.offsetTop, E.offsetWidth, E.offsetHeight].join('|');
  if (f !== PTD.firma) { PTD.firma = f; PTD.firmaT = ahora; }
  if (P.emote || ahora - PTD.firmaT < 2500) { PTD.dibT = ahora; return false; }
  if (ahora - (PTD.dibT || 0) > 1000) { PTD.dibT = ahora; MENU.dt0 = true; return false; }
  return true;
}
// ---------------- que todo entre ----------------
// Medido con offsetLeft/Top (con el juego girado en el celular parado, getBoundingClientRect da la pantalla girada).
// 1) los textos que no entran en su lugar se achican de a medio píxel hasta 12 px;
// 2) arriba: si el perfil, el logo y los íconos no entran, primero se va el logo y después la cuenta queda sólo con su ícono;
// 3) la columna de la derecha, si no entra encima del mapa elegido, pasa a dos columnas;
// 4) el escenario va entre las tarjetas (y las pestañas) y el mapa elegido; la base y la luz se ubican donde quedan los pies
function ptdRect(e) { let x = 0, y = 0, n = e; while (n && n !== RB.el) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y, w: e.offsetWidth, h: e.offsetHeight, r: x + e.offsetWidth, b: y + e.offsetHeight }; }
function ptdAjustarTexto(e) {
  e.style.fontSize = ''; if (!e.offsetWidth) return;
  // (hasta 12 px: el piso de la letra en todo el menú)
  const f0 = parseFloat(getComputedStyle(e).fontSize) || 14, min = 12;
  let f = f0;
  while (e.scrollWidth > e.clientWidth + 0.5 && f > min) { f = Math.max(min, f - 0.5); e.style.fontSize = f + 'px'; }
}
function ptdEncajar() {
  if (!ptdVisible() || !PTD.ui.firstElementChild) return;
  const U = PTD.ui, H = RB.el.clientHeight || VH(), W = RB.el.clientWidth || VW(), rtl = RB.el.dir === 'rtl';
  U.classList.remove('ptSinLogo', 'ptCuC', 'ptCol2', 'ptTabsC', 'ptTabsC2', 'ptMultiW');
  for (const c of U.querySelectorAll('.ptSinSub, .ptSwC, .ptModoC, .ptModoC2')) c.classList.remove('ptSinSub', 'ptSwC', 'ptModoC', 'ptModoC2');
  const fitAll = (raiz) => { for (const e of raiz.querySelectorAll('.ptFit')) ptdAjustarTexto(e); };
  const sale = (e) => !!e && e.offsetWidth > 0 && e.scrollWidth > e.clientWidth + 0.5;
  fitAll(U);
  // las tarjetas: en el Evento, si no entra, el interruptor sin su palabra (queda el dibujo prendido o apagado); si la
  // línea de abajo igual no entra, sin ella (el título dice qué es y la línea completa queda en el globito); el título de
  // Multijugador, si no entra ni con 12 px, en dos renglones (no pasa en ninguno de los 14 idiomas)
  if (sale(U.querySelector('.ptMulti .ptCT'))) U.classList.add('ptMultiW');
  { const ev = U.querySelector('.ptEvento'); if (ev && (sale(ev.querySelector('.ptCT')) || sale(ev.querySelector('.ptCS')))) { ev.classList.add('ptSwC'); fitAll(ev); } }
  // (el mapa elegido: si la línea de abajo no entra, sin «de quién es»: queda la hora y el modo)
  { const mo = U.querySelector('.ptModo'), ms = U.querySelector('.ptModoS'); if (sale(ms)) { mo.classList.add('ptModoC'); ptdAjustarTexto(ms); }
    // (si el nombre del mapa igual no entra —«Охровый каньон» en el celular chico—, sin la fotito: el mapa ya está de fondo)
    if (sale(U.querySelector('.ptModoN')) || sale(ms)) { mo.classList.add('ptModoC2'); fitAll(mo); } }
  for (const c of U.querySelectorAll('.ptCarta')) { const cs = c.querySelector('.ptCS'); if (sale(cs)) { c.title = c.textContent.replace(/\s+/g, ' ').trim(); c.classList.add('ptSinSub'); } }
  // arriba
  const per = U.querySelector('.ptPerfil'), der = U.querySelector('.ptDer'), logo = U.querySelector('.ptLogo'), arr = U.querySelector('.ptArriba');
  const choca = () => { const a = ptdRect(per), d = ptdRect(der), l = ptdRect(logo), A = ptdRect(arr); const lv = !U.classList.contains('ptSinLogo') && l.w > 0;
    return a.w + d.w + (lv ? l.w + 16 : 0) + 12 > A.w; };
  if (choca()) U.classList.add('ptSinLogo');
  if (choca()) U.classList.add('ptCuC');
  // las pestañas: si no entran entre el borde y JUGAR, sin los textos largos (ícono arriba, texto chico abajo)
  const tabs = U.querySelector('.ptTabs'), part = U.querySelector('.ptPartida');
  // (y si dejan muy poco lugar para el personaje, también: para que entre de arriba a abajo, el escenario necesita su
  // ancho con los brazos —0,41 de su alto, medido en los personajes del juego— más un poco de aire: 0,53 del alto del
  // escenario; si no, se encuadra más chico)
  const lugar = () => { const iz = ptdRect(U.querySelector('.ptIzq')), tb = ptdRect(tabs), pa = ptdRect(part); return rtl ? Math.min(iz.x, tb.x) - pa.r : pa.x - Math.max(iz.r, tb.r); };
  const necesita = Math.max(0.53 * (H - ptdRect(arr).b - Math.max(6, H * 0.012)), W * 0.15);
  tabs.style.fontSize = '';
  if (tabs.scrollWidth > tabs.clientWidth + 1 || lugar() < necesita) {
    U.classList.add('ptTabsC'); fitAll(tabs);
    // (la letra de las pestañas, de 14 px para abajo —hasta 12— mientras el personaje no tenga un lugar razonable)
    for (let f = 14; f > 12 && (tabs.scrollWidth > tabs.clientWidth + 1 || lugar() < necesita * 0.8); ) { f -= 0.5; tabs.style.fontSize = f + 'px'; }
  }
  // (y si ni así —no pasa en ninguno de los 14 idiomas—, sin los íconos y con el texto en dos renglones)
  if (U.classList.contains('ptTabsC') && (tabs.scrollWidth > tabs.clientWidth + 1 || lugar() < necesita * 0.65)) { U.classList.add('ptTabsC2'); fitAll(tabs); }
  // la columna de la derecha
  const col = U.querySelector('.ptCol'), modo = U.querySelector('.ptCartel');
  const colB = () => { const c = ptdRect(col), m = ptdRect(modo); return c.b > m.y - 6; };
  if (colB()) U.classList.add('ptCol2');
  // el escenario (el hueco donde se dibuja el personaje): entre lo de la izquierda y lo de la derecha
  const iz = ptdRect(U.querySelector('.ptIzq')), tb = ptdRect(tabs), pa = ptdRect(part), ar = ptdRect(arr), cr = ptdRect(col);
  const gap = Math.max(8, H * 0.02);
  let x0, x1;
  if (!rtl) { x0 = Math.max(iz.r, tb.r) + gap; x1 = Math.min(pa.x, cr.x) - gap; }
  else { x0 = Math.max(pa.r, cr.r) + gap; x1 = Math.min(iz.x, tb.x) - gap; }
  const y0 = ar.b + 2, y1 = H - Math.max(4, H * 0.012);
  // (el hueco que se toca nunca se pisa con nada; si queda angosto, el personaje igual se encuadra en uno más ancho —se
  // dibuja detrás de los botones— para que no quede chiquito)
  Object.assign(PTD.esc.style, { left: x0 + 'px', top: y0 + 'px', width: Math.max(40, x1 - x0) + 'px', height: Math.max(60, y1 - y0) + 'px' });
  if (x1 - x0 < W * 0.2) { const c = (x0 + x1) / 2; x0 = c - W * 0.1; x1 = c + W * 0.1; PTD.esc._rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; } else PTD.esc._rect = null;
  // la base del escenario, la luz de arriba y el reflejo: donde van a quedar los pies
  const cx = (x0 + x1) / 2, hh = y1 - y0, pies = y0 + PT_ESC.pies * hh, alto = (PT_ESC.pies - PT_ESC.arriba) * hh;
  const F = PTD.fondo.style; F.setProperty('--px', cx + 'px'); F.setProperty('--py', pies + 'px'); F.setProperty('--pw', Math.max(120, alto * 0.62) + 'px'); F.setProperty('--pa', alto + 'px');
}
// ---------------- acciones (las llama inicioAccion primero) ----------------
function ptdTienda(tab, vista) { RB.t.vista = vista; inicioAccion('tab:' + tab); }
function ptdAccion(a, v) {
  switch (a) {
    case 'jugar': inicioAccion('empezar'); return true;
    case 'ptMods': ptdTienda('mod', 'instalados'); return true;
    case 'ptGm': ptdTienda('gmod', 'instalados'); return true;
    case 'ptWs': ptdMarcarVisto('gmod'); ptdTienda('gmod', 'explorar'); return true;
    case 'ptEmo': ptdMarcarVisto('anim'); ptdTienda('anim', 'explorar'); return true;
    case 'ptSoc': if (typeof SOC !== 'undefined') SOC.tab = v === 'amigos' ? 'amigos' : 'chats'; inicioPanel('social'); return true;
    case 'ptEvento': PREFS.evento = PREFS.evento === false; guardarPrefs(); ptdEvento(); rbAviso(`${T('pt.evento')} · ${T('pt.grieta')}: ${T(PREFS.evento ? 'pt.on' : 'pt.off')}`); return true;
    case 'ptTut': if (typeof tutAbrir === 'function') tutAbrir(); return true;
    case 'ptAct': ptdActualizar(); return true;
  }
  return false;
}
// ---------------- teclado y mando ----------------
// Las flechas (o la cruceta) van al botón más cercano en esa dirección; Tab y Mayús+Tab, en orden; Enter o A, lo
// elige. Sólo en la portada sin nada abierto encima (con un panel o un cartel abierto, las teclas siguen como siempre).
const PT_ENCIMA = '#ajustes:not(.oc), #cuDlg:not(.oc), #tut:not(.oc), #pjiVen:not(.oc), #ctlEd:not(.oc), #cfDlg:not(.oc), .mpModal.ve, #carga:not(.oc):not(.fin)';
const ptdActiva = () => ptdVisible() && !RB.panel && typeof JUEGO !== 'undefined' && JUEGO.estado === 'principal' && !document.querySelector(PT_ENCIMA) && !(window.__carga && window.__carga.listo === false);
function ptdFocos() { return [...PTD.ui.querySelectorAll('button, input')].filter((e) => e.offsetWidth && !e.closest('.oc')).concat(PTD.esc); }
function ptdMover(dir) {
  const L = ptdFocos(), act = document.activeElement, i = L.indexOf(act);
  if (dir === 'sig' || dir === 'ant') { const j = i < 0 ? 0 : (i + (dir === 'sig' ? 1 : L.length - 1)) % L.length; L[j].focus(); return; }
  if (i < 0) { (PTD.ui.querySelector('.ptJugar') || L[0]).focus(); return; }
  const rtl = RB.el.dir === 'rtl', d = { izq: [rtl ? 1 : -1, 0], der: [rtl ? -1 : 1, 0], arriba: [0, -1], abajo: [0, 1] }[dir];
  const c = (r) => [r.x + r.w / 2, r.y + r.h / 2], a = ptdRect(act), [ax, ay] = c(a);
  let mejor = null, md = Infinity;
  for (const e of L) {
    if (e === act) continue; const r = ptdRect(e), [x, y] = c(r), dx = x - ax, dy = y - ay;
    // (en la dirección pedida y no en la de al lado: lo que está en la misma fila o columna, primero)
    const p = dx * d[0] + dy * d[1], s = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
    if (p <= 4) continue; const dist = p + s * 2.2; if (dist < md) { md = dist; mejor = e; }
  }
  if (mejor) mejor.focus();
}
function ptdTecla(e) {
  if (!ptdActiva()) return;
  const k = e.key, t = e.target, enNom = t && t.id === 'rbNombre';
  const dirs = { ArrowLeft: 'izq', ArrowRight: 'der', ArrowUp: 'arriba', ArrowDown: 'abajo' };
  if (enNom) { if (k === 'Tab' || k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); ptdMover(k === 'Tab' ? (e.shiftKey ? 'ant' : 'sig') : dirs[k]); } return; }
  if (k === 'Tab') { e.preventDefault(); e.stopPropagation(); ptdMover(e.shiftKey ? 'ant' : 'sig'); return; }
  if (dirs[k]) { e.preventDefault(); e.stopPropagation(); ptdMover(dirs[k]); return; }
  if (k === 'Enter' || k === ' ') {
    const a = document.activeElement; e.stopPropagation();
    if (a === PTD.esc) { e.preventDefault(); inicioAccion('personajes', a); return; }
    if (!a || !PTD.ui.contains(a)) { e.preventDefault(); (PTD.ui.querySelector('.ptJugar') || {}).focus && PTD.ui.querySelector('.ptJugar').focus(); }
    return;   // (un botón con el foco lo aprieta el navegador solo)
  }
  if (k === 'Escape' && PTD.ui.contains(document.activeElement)) { e.stopPropagation(); document.activeElement.blur(); }
}
// el mando (sólo mientras hay uno conectado): la cruceta o la palanca izquierda mueven el foco, A elige y B vuelve
function ptdMandoPaso() {
  const P = PTD.pad; if (!P.on) return;
  let pads = []; try { pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch (e) {}
  if (!pads.length) { P.on = false; return; }
  requestAnimationFrame(ptdMandoPaso);
  const g = pads[0], bt = (i) => !!(g.buttons[i] && g.buttons[i].pressed), ax = (i) => g.axes[i] || 0, ahora = performance.now();
  const est = { arriba: bt(12) || ax(1) < -0.6, abajo: bt(13) || ax(1) > 0.6, izq: bt(14) || ax(0) < -0.6, der: bt(15) || ax(0) > 0.6, a: bt(0), b: bt(1) };
  const nuevo = (k) => est[k] && !P.ant[k];
  if (ptdActiva()) {
    for (const k of ['arriba', 'abajo', 'izq', 'der']) if (nuevo(k) || (est[k] && ahora > P.rep)) { ptdMover(k); P.rep = ahora + (nuevo(k) ? 420 : 160); break; }
    if (nuevo('a')) { const a = document.activeElement; if (a && PTD.ui.contains(a) && a.tagName === 'BUTTON') a.click(); else if (a === PTD.esc) inicioAccion('personajes', a); else ptdMover('abajo'); }
  } else if (nuevo('b') && RB.el && RB.panel && rbVisible()) { const v = RB.el.querySelector('.rbPan [data-rb=volver]'); if (v) v.click(); }
  P.ant = est;
}
