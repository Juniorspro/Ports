// ---------------------------------------------------------------------------------------------------------
// menú principal real: el LobbyCanvas del juego (lo exporta herramientas/menuexp.py: rectángulos con anclas,
// colores, textos, íconos, botones y campos) dibujado con HTML, a la escala del CanvasScaler del juego
// (1280×720, mezcla ancho/alto 0.5). Los textos pasan por la tabla Localization del juego (EN RU PO ID UA SP).
// Atrás está el lobby: el fondo crema de la cámara y, en la tienda, el personaje elegido en 3D.
// ---------------------------------------------------------------------------------------------------------
const MENU = { el: null, lienzo: null, por: {}, sec: 'MainMenu', mp: 'Main', tab: 'Character', lobby: null, yaw: Math.PI, salaPw: null, tg: {}, sel: {}, ent: {} };
const IDIOMAS = ['EN', 'RU', 'PO', 'ID', 'UA', 'SP'];
const MAPA_UI = { Flat: 'FlatGrass', City: 'City', Base_V2: 'BaseV2', Desert: 'Desert', DesertV2: 'DesertV2', Base: 'Base', Mars: 'Mars', Space: 'Space' };
const SECCIONES = ['MainMenu', 'Shop', 'Multiplayer', 'SinglePlayer', 'InfoPanel'];
const VERSION_JUEGO = 'ver. 0.5.0.7';
function Lc(k, def) { const e = DATA.loc && DATA.loc[k]; return (e && (e[PREFS.idioma] || e.EN)) || def; }
const rgba = (c) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3]})`;
const FUENTES = { 'OpenSans-Light': ["'Open Sans',Roboto,Arial,sans-serif", 300], 'OpenSans-Bold': ["'Open Sans',Roboto,Arial,sans-serif", 700],
  'OpenSans-ExtraBold': ["'Open Sans',Roboto,Arial,sans-serif", 800], 'RobotoCondensed-Bold': ["'Roboto Condensed','Arial Narrow',Roboto,sans-serif", 700] };
// ---------------- dibujar un nodo (RectTransform + Image + Text) ----------------
function uiNodo(n, ruta) {
  const e = document.createElement('div'); e.className = 'ug'; n.el = e; n.ruta = ruta ? ruta + '/' + n.n : n.n;
  if (MENU.por[n.ruta] === undefined) MENU.por[n.ruta] = n;
  if (n.a) {
    const [ax0, ay0, ax1, ay1] = n.a, [px, py] = n.p, [sx, sy] = n.s, [vx, vy] = n.pv;
    const l = px - sx * vx, r = px + sx * (1 - vx), b = py - sy * vy, t = py + sy * (1 - vy);
    e.style.cssText = `left:calc(${ax0 * 100}% + ${l}px);right:calc(${(1 - ax1) * 100}% - ${r}px);bottom:calc(${ay0 * 100}% + ${b}px);top:calc(${(1 - ay1) * 100}% - ${t}px)`;
    if (n.sc || n.rz) { e.style.transformOrigin = `${vx * 100}% ${(1 - vy) * 100}%`; e.style.transform = (n.sc ? `scale(${n.sc[0]},${n.sc[1]})` : '') + (n.rz ? ` rotate(${-2 * Math.atan2(n.rz, n.rw)}rad)` : ''); }
  }
  if (n.off) e.style.display = 'none';
  if (n.img && !n.img.off) uiImagen(e, n.img);
  if (n.txt && !n.txt.off) uiTexto(e, n);
  const k = n.k || [];
  if (k.includes('Button') || k.includes('Toggle')) { e.classList.add('bt'); e.dataset.r = n.ruta; }
  if (k.includes('Mask') || k.includes('RectMask2D')) e.style.overflow = 'hidden';
  if (k.includes('ScrollRect')) { e.style.overflowY = 'auto'; e.style.overflowX = 'hidden'; }
  for (const c of n.ch || []) e.appendChild(uiNodo(c, n.ruta));
  if (k.includes('InputField')) uiCampo(n);
  if (k.includes('Dropdown')) uiLista(n);
  return e;
}
function uiImagen(e, im) {
  const i = document.createElement('i'); i.className = 'im'; e.appendChild(i);
  const u = im.sp && DATA.ico[im.sp] ? icono(im.sp) : '', c = im.c, blanco = c[0] > 0.98 && c[1] > 0.98 && c[2] > 0.98;
  const plano = !u || /^CornerPanelRadius_[01]px_Fill$/.test(im.sp);
  if (plano) { i.style.background = rgba(c); return; }
  if (im.t === 1 && im.bd) {
    const [L, B, R2, T] = im.bd, rb = `${T} ${R2} ${B} ${L}`, w = `${T}px ${R2}px ${B}px ${L}px`;
    if (blanco) { i.style.borderImage = `url(${u}) ${rb} fill / ${w} stretch`; i.style.opacity = c[3]; }
    else { i.style.background = rgba(c); i.style.setProperty('-webkit-mask-box-image', `url(${u}) ${rb} / ${w} stretch`); i.style.setProperty('mask-border', `url(${u}) ${rb} fill / ${w} stretch`); }
    return;
  }
  if (blanco) { i.style.backgroundImage = `url(${u})`; i.style.opacity = c[3]; }
  else { i.style.background = rgba(c); i.style.setProperty('-webkit-mask', `url(${u}) center/100% 100% no-repeat`); i.style.setProperty('mask', `url(${u}) center/100% 100% no-repeat`); }
}
function uiTexto(e, n) {
  const t = n.txt, s = document.createElement('b'); s.className = 'tx';
  const al = t.al || 0, h = al % 3, v = (al / 3) | 0, f = FUENTES[t.f] || ['Arial,Roboto,sans-serif', 400];
  s.style.cssText = `font-size:${t.fs}px;color:${rgba(t.c)};justify-content:${['flex-start', 'center', 'flex-end'][h]};align-items:${['flex-start', 'center', 'flex-end'][v]};text-align:${['left', 'center', 'right'][h]};font-family:${f[0]};font-weight:${t.st & 1 ? 700 : f[1]};font-style:${t.st & 2 ? 'italic' : 'normal'};white-space:${t.ho ? 'pre' : 'pre-wrap'}`;
  if (n.sh) s.style.textShadow = `${n.sh[1][0]}px ${-n.sh[1][1]}px 0 ${rgba(n.sh[0])}`;
  if (n.ol) { const d = n.ol[1][0], c = rgba(n.ol[0]); s.style.textShadow = `${d}px ${d}px 0 ${c},${-d}px ${d}px 0 ${c},${d}px ${-d}px 0 ${c},${-d}px ${-d}px 0 ${c}`; }
  e.appendChild(s); n.tx = s; uiTextoPoner(n);
}
function uiTextoPoner(n, txt) {
  if (!n || !n.tx) return;
  if (txt !== undefined) n.txtFijo = txt;
  const t = n.txtFijo !== undefined ? n.txtFijo : (n.k && n.k.includes('LocalizationText') ? Lc(n.n, n.txt.t) : n.txt.t);
  n.tx.textContent = t;
}
const hijo = (n, nombre) => n && (n.ch || []).find((c) => c.n === nombre);
function buscar(n, nombre) { if (!n) return null; if (n.n === nombre) return n; for (const c of n.ch || []) { const r = buscar(c, nombre); if (r) return r; } return null; }
const nodo = (r) => MENU.por[r];
function verNodo(n, si) { if (n && n.el) { n.el.style.display = si ? '' : 'none'; n.off = !si; } }
// campos de texto: un <input> de verdad con la letra del Text del juego
function uiCampo(n) {
  const tx = hijo(n, 'Text'), ph = hijo(n, 'Placeholder'), inp = document.createElement('input');
  inp.className = 'campo'; inp.maxLength = 24; inp.spellcheck = false; inp.autocomplete = 'off';
  if (tx && tx.txt) { const t = tx.txt, f = FUENTES[t.f] || ['Arial,Roboto,sans-serif', 400]; inp.style.cssText = `font-size:${t.fs}px;color:${rgba(t.c)};font-family:${f[0]};font-weight:${f[1]};text-align:${['left', 'center', 'right'][(t.al || 0) % 3]}`; inp.value = t.t || ''; }
  if (ph && ph.txt) inp.placeholder = ph.txt.t && ph.txt.t !== 'Enter text...' ? ph.txt.t : '';
  verNodo(tx, false); verNodo(ph, false);
  n.el.appendChild(inp); n.inp = inp; MENU.ent[n.n] = inp;
  inp.addEventListener('keydown', (e) => e.stopPropagation());
}
// listas desplegables: un <select> invisible encima (en el celular abre el selector del sistema)
const OPCIONES = { GameModeDropdown: ['Free', 'PvP'], PlayersDropdown: ['2', '4', '6', '8', '10', '12', '16', '20'], MaxPlayersDropdown: ['1'], MapDropdown: MAPAS };
function uiLista(n) {
  const op = OPCIONES[n.n] || [], s = document.createElement('select'), lab = hijo(n, 'Label');
  s.className = 'lista'; for (const o of op) { const x = document.createElement('option'); x.value = x.textContent = o; s.appendChild(x); }
  if (lab && lab.txt && op.includes(lab.txt.t)) s.value = lab.txt.t;
  s.onchange = () => { MENU.sel[n.n] = s.value; uiTextoPoner(lab, s.value); };
  MENU.sel[n.n] = s.value; n.el.appendChild(s); n.sel = s;
}
// ---------------- armar el menú ----------------
function menuIniciar() {
  if (!DATA.ui) return false;
  if (!PREFS.idioma) PREFS.idioma = 'SP';
  const raiz = document.createElement('div'); raiz.id = 'menuReal'; raiz.className = 'oc';
  const L = document.createElement('div'); L.className = 'lienzo'; raiz.appendChild(L);
  document.body.appendChild(raiz); MENU.el = raiz; MENU.lienzo = L;
  for (const c of DATA.ui.ui.ch || []) L.appendChild(uiNodo(c, ''));
  // lo que el juego llena mientras corre
  verNodo(nodo('Connecting'), false); verNodo(nodo('FPS'), false);
  verNodo(nodo('Main/MainMenu/UpPanel/Settings'), true);
  for (const r of ['Main/Multiplayer/ServerList/UpPanel/Text (2)', 'Main/Multiplayer/ServerList/UpPanel/Text (3)']) verNodo(nodo(r), false);
  uiTextoPoner(nodo('Main/MainMenu/Version'), VERSION_JUEGO);
  for (const n of Object.values(MENU.por)) {
    if (!n.tx || !/^Main\/(Multiplayer\/ServerCreate|SinglePlayer)\//.test(n.ruta) || /UpPanel|Button|Dropdown\/Label/.test(n.ruta)) continue;
    const c = n.txt.c; if (c[0] > 0.9 && c[1] > 0.9 && c[2] > 0.9 && n.txt.fs >= 30) n.tx.style.color = 'rgba(0,0,0,.55)';
  }
  menuMapas(); menuToggles(); menuTextosVivos();
  const nick = nodo('Main/MainMenu/UpPanel/NickNameInputField');
  if (nick && nick.inp) { verNodo(hijo(nick, 'TextForIcon'), false); nick.inp.value = PREFS.nombre; nick.inp.oninput = () => { PREFS.nombre = limpioNombre(nick.inp.value); guardarPrefs(); }; }
  const nn = MENU.ent.NameInputField; if (nn) { nn.value = PREFS.nombre; nn.oninput = () => { PREFS.nombre = limpioNombre(nn.value); if (nick && nick.inp) nick.inp.value = PREFS.nombre; guardarPrefs(); }; }
  const fs = MENU.ent.FindServerInputField; if (fs) { fs.placeholder = T('buscar'); fs.oninput = () => listaDibujar(); }
  // (los textos del juego que eran un ícono de su letra, como la lupa del buscador, no se muestran: el campo ya dice qué es)
  for (const n of Object.values(MENU.por)) if (n.tx && /^[\s\u2600-\u27BF\u{1F000}-\u{1FAFF}]+$/u.test(n.tx.textContent)) { uiTextoPoner(n, ''); verNodo(n, false); }
  for (const [k, v] of [['ServerNameFieldNew', ''], ['MaxPropInputField', '1000'], ['MaxVechiclesInputField', '40']]) if (MENU.ent[k] && !MENU.ent[k].value) MENU.ent[k].value = v;
  if (MENU.ent.ServerNameFieldNew) MENU.ent.ServerNameFieldNew.placeholder = Lc('Name', 'Name');
  for (const k of ['MaxPropInputField', 'MaxVechiclesInputField']) if (MENU.ent[k]) MENU.ent[k].inputMode = 'numeric';
  if (MENU.ent.Password) MENU.ent.Password.placeholder = '1234';
  // la tienda: girar el personaje arrastrando
  const tp = nodo('Main/Shop/Character/TouchPad');
  if (tp) { let x0 = null; tp.el.addEventListener('pointerdown', (e) => { x0 = e.clientX + e.clientY; tp.el.setPointerCapture(e.pointerId); }); tp.el.addEventListener('pointermove', (e) => { if (x0 === null) return; const x = e.clientX + e.clientY; MENU.yaw -= (x - x0) * 0.012; x0 = x; }); tp.el.addEventListener('pointerup', () => (x0 = null)); }
  L.addEventListener('click', (e) => { const b = e.target.closest('.bt'); if (b && !e.target.closest('input,select')) { audioIniciar(); menuAccion(b.dataset.r); } });
  addEventListener('resize', menuEscala); menuEscala();
  if (!PREFS.nombreOk) { overlay('NicknamePanel', true); PREFS.nombreOk = true; guardarPrefs(); }
  return true;
}
const limpioNombre = (s) => String(s || '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').trim().slice(0, 16) || 'Player';
function menuEscala() {
  if (!MENU.lienzo) return;
  const w = VW(), h = VH(), k = Math.sqrt((w / 1280) * (h / 720));
  const L = MENU.lienzo.style; L.width = w / k + 'px'; L.height = h / k + 'px'; L.transform = `scale(${k})`;
}
function menuTextosVivos() {
  uiTextoPoner(nodo('Main/MainMenu/GuestAccountText'), 'ID: ' + (RED.ID || (RED.ID = idRed())).toUpperCase());
  const fl = nodo('Main/MainMenu/Language'); if (fl && fl.el.firstChild) fl.el.firstChild.style.backgroundImage = `url(${icono(PREFS.idioma)})`;
  for (const n of Object.values(MENU.por)) if (n.tx && n.k && n.k.includes('LocalizationText')) uiTextoPoner(n);
  listaContadores();
}
// los 8 mapas en las dos grillas (un jugador y crear servidor), con su foto y el nombre
function menuMapas() {
  if (!MAPAS.includes(PREFS.mapa)) PREFS.mapa = 'Desert';
  for (const r of ['Main/SinglePlayer/MapList', 'Main/Multiplayer/ServerCreate/ServerCreate/MapListNew']) {
    const ml = nodo(r); if (!ml) continue;
    const g = buscar(ml, 'Group'); if (!g) continue;
    (g.ch || []).forEach((c, i) => {
      const m = MAPA_UI[c.n]; if (!m) return;
      const x = 60.5 + (i % 3) * 115, y = -67.5 - ((i / 3) | 0) * 130;
      c.el.style.left = `calc(0% + ${x - 52.5}px)`; c.el.style.right = ''; c.el.style.width = '105px'; c.el.style.top = `${-(y + 62.5)}px`; c.el.style.bottom = ''; c.el.style.height = '125px';
      const im = c.el.querySelector('.im'); if (im) { im.style.backgroundImage = `url(${icono(MAPA_ICONO[m])})`; im.style.backgroundSize = 'cover'; im.style.borderRadius = '6px'; }
      const et = document.createElement('b'); et.className = 'mapaEt'; et.textContent = m; c.el.appendChild(et);
      c.mapa = m;
    });
    g.el.style.height = Math.ceil((g.ch || []).length / 3) * 130 + 10 + 'px'; g.el.style.bottom = '';
    const mk = buscar(ml, 'Mask'); if (mk) mk.el.style.overflowY = 'auto';
    const sb = hijo(ml, 'Scrollbar'); verNodo(sb, false);
  }
  menuMapaMarcar();
}
function menuMapaMarcar() {
  for (const r of ['Main/SinglePlayer/MapList', 'Main/Multiplayer/ServerCreate/ServerCreate/MapListNew']) {
    const g = buscar(nodo(r), 'Group'); if (!g) continue;
    for (const c of g.ch || []) c.el.classList.toggle('mapaSel', c.mapa === PREFS.mapa);
  }
}
// tildes de las reglas del servidor
function menuToggles() {
  for (const n of Object.values(MENU.por)) {
    if (!n.k || !n.k.includes('Toggle') || /Item$/.test(n.n)) continue;
    const bg = hijo(n, 'Background'); let ck = buscar(n, 'Checkmark');
    if (!ck && bg) { const i = document.createElement('i'); i.className = 'tilde'; i.style.backgroundImage = `url(${icono('Checkmark')})`; bg.el.appendChild(i); ck = { el: i }; }
    MENU.tg[n.n] = n.n !== 'PublicMechToogle';
    n.ck = ck; if (ck) ck.el.style.display = MENU.tg[n.n] ? '' : 'none';
  }
}
// ---------------- navegar ----------------
function seccion(s) {
  MENU.sec = s;
  for (const x of SECCIONES) verNodo(nodo('Main/' + x), x === s);
  if (s === 'Multiplayer') subMp(MENU.mp === 'Main' || !MENU.mp ? 'Main' : MENU.mp);
  if (s === 'Shop') tienda(MENU.tab);
  menuLobby(s === 'Shop');
}
function subMp(s) { MENU.mp = s; for (const x of ['Main', 'ServerList', 'ServerCreate']) verNodo(nodo('Main/Multiplayer/' + x), x === s); if (s === 'ServerList') listaDibujar(); }
function overlay(nombre, si) { verNodo(nodo('Main/' + nombre), si); }
function menuAviso(t) {
  if (!MENU.el || MENU.el.classList.contains('oc')) { if (typeof aviso === 'function') aviso(t, 2.5); return; }
  let a = MENU.avisoEl; if (!a) { a = MENU.avisoEl = document.createElement('div'); a.className = 'menuAviso'; MENU.lienzo.appendChild(a); }
  a.textContent = t; a.classList.add('ve'); clearTimeout(MENU.avisoT); MENU.avisoT = setTimeout(() => a.classList.remove('ve'), 2500);
}
const ACCIONES = [
  [/MainMenu\/UpPanel\/Category\/PlayMenu$/, () => seccion('MainMenu')],
  [/MainMenu\/UpPanel\/Category\/Shop$/, () => seccion('Shop')],
  [/MainMenu\/UpPanel\/Category\/Info$/, () => seccion('InfoPanel')],
  [/MainMenu\/UpPanel\/Settings$/, () => abrirAjustes('principal')],
  [/\/Language$/, () => { PREFS.idioma = IDIOMAS[(IDIOMAS.indexOf(PREFS.idioma) + 1) % IDIOMAS.length]; guardarPrefs(); menuTextosVivos(); }],
  [/MainMenu\/Music$/, () => { PREFS.mudo = !PREFS.mudo; guardarPrefs(); if (AUD.master) AUD.master.gain.value = PREFS.mudo ? 0 : PREFS.vol / 100; nodo('Main/MainMenu/Music').el.style.opacity = PREFS.mudo ? 0.4 : 1; }],
  [/MainMenu\/(Discord|PrivatePolicy)$/, () => menuAviso('No disponible en esta versión')],
  [/MainMenu\/Multiplayer$/, () => conectarMultijugador()],
  [/MainMenu\/Singleplayer$/, () => seccion('SinglePlayer')],
  [/MainMenu\/Quit$/, () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); menuAviso('Para salir, cerrá la pestaña'); }],
  [/Multiplayer\/Main\/Server List$/, () => { subMp('ServerList'); listaPedir(); }],
  [/Multiplayer\/Main\/Create Server$/, () => subMp('ServerCreate')],
  [/Multiplayer\/(ServerList|ServerCreate)\/UpPanel\/Category\/Back$/, () => subMp('Main')],
  [/Multiplayer\/Main\/UpPanel\/Category\/Back$/, () => seccion('MainMenu')],
  [/ServerList\/UpPanel\/(Refresh|Players|Servers)$/, () => listaPedir()],
  [/ServerCreate\/ServerCreate\/CreateServerButton$/, () => crearServidor()],
  [/SinglePlayer\/CreateServerButton$/, () => { SALA = null; empezarPartida(PREFS.mapa); }],
  [/SelectSaveFileButton$/, () => abrirGuardados()],
  [/(SinglePlayer|InfoPanel|Shop)\/UpPanel\/Category\/Back$/, () => seccion('MainMenu')],
  [/Shop\/UpPanel\/Category\/Character$/, () => tienda('Character')],
  [/Shop\/Character\/Category\/Root\/Image \(2\)$/, () => tienda('Character')],
  [/Shop\/Character\/Category\/Root\/Image \((3|4)\)$/, () => tienda('Hat')],
  [/PasswordPanel\/Password\/Join$/, () => comprobarClave()],
  [/PasswordPanel\/Password\/Close$/, () => overlay('PasswordPanel', false)],
  [/SavesPanel\/SavesPanel\/Close$/, () => overlay('SavesPanel', false)],
  [/NicknamePanel\/Panel\/OK$/, () => overlay('NicknamePanel', false)],
  [/LostConnection\/Button$/, () => location.reload()],
  [/\/Group\/([^/]+)$/, (r, m) => { if (MAPA_UI[m[1]]) { PREFS.mapa = MAPA_UI[m[1]]; guardarPrefs(); menuMapaMarcar(); } }],
];
function menuAccion(r) {
  const n = nodo(r);
  if (n && n.k && n.k.includes('Toggle') && n.ck) { MENU.tg[n.n] = !MENU.tg[n.n]; n.ck.el.style.display = MENU.tg[n.n] ? '' : 'none'; return; }
  for (const [re, fn] of ACCIONES) { const m = re.exec(r); if (m) { fn(r, m); return; } }
}
// ---------------- tienda: personajes y gorros, con el personaje en 3D ----------------
const RETRATO = { Hero: 'hero', Soldier: 'soldier', Jean: 'jean', Derik: 'derik', Business: 'business', SpecialForcesW: 'specialforce', SpecialForcesM: 'specialforce_2', Prisoner01: 'Prisoner01', PilotFemale: 'PilotFemale', Butcher: 'Butcher', Swat: 'swat', Military: 'Military', Engineer: 'Engineer', Corpse: 'corpse', Goku: 'goku' };
function tienda(tab) {
  MENU.tab = tab;
  const cat = buscar(nodo('Main/Shop/Character'), 'Root');
  if (cat) for (const c of cat.ch || []) if (c.el.querySelector('.im')) c.el.classList.toggle('tabSel', (tab === 'Character') === (c.n === 'Image (2)'));
  const inv = nodo('Main/Shop/Character/Inventory/Root'); if (!inv) return;
  inv.el.innerHTML = ''; inv.el.classList.add('inventario');
  const lista = tab === 'Character' ? DATA.chars : DATA.hats;
  for (const s of lista) {
    const d = document.createElement('div'), sel = tab === 'Character' ? PREFS.skin === s : PREFS.gorro === s;
    d.className = 'celda' + (sel ? ' sel' : '');
    const ic = tab === 'Character' ? RETRATO[s] || s : s;
    d.innerHTML = `<i style="background-image:url(${DATA.ico[ic] ? icono(ic) : icono('western-hat')})"></i><b>${s === 'HatEmpty' ? '—' : s.replace(/^Hat/, '')}</b>`;
    d.onclick = () => { if (tab === 'Character') PREFS.skin = s; else PREFS.gorro = s; guardarPrefs(); tienda(tab); menuLobby(true, true); };
    inv.el.appendChild(d);
  }
  // iconos de las pestañas
  if (cat) { const ic = { 'Image (2)': 'Clothes', 'Image (4)': 'western-hat' }; for (const c of cat.ch || []) if (ic[c.n] && !c.ico) { c.ico = 1; const i = document.createElement('i'); i.className = 'tabIco'; i.style.backgroundImage = `url(${icono(ic[c.n])})`; c.el.appendChild(i); } }
}
// el personaje del lobby: a la izquierda y mirando a cámara como en la escena del menú; la cámara va derecha
// (la del juego mira 8° hacia abajo y con el personaje en el borde se ve torcido) y el personaje entra entero
function menuLobby(si, rehacer) {
  if (MENU.lobby && (!si || rehacer)) { borrarPersona(MENU.lobby); MENU.lobby = null; }
  if (si && !MENU.lobby) { MENU.lobby = crearPersona(PREFS.skin, PREFS.gorro, { nombre: '' }); MENU.lobby.lobby = true; if (rehacer) { MENU.lobby.emote = 'Hi'; MENU.lobby.emoteT = 0; } }
}
const LOBBY_CAM = v3(0, 600, 0), LOBBY_PIES = v3(1.45, -1.25, 2.9);
function lobbyCamara(out) { out.pos.copy(LOBBY_CAM); out.q.copy(Quat.euler(0, 0)); CAM.fov = 60; return out; }
function dibujarLobby() {
  const P = MENU.lobby; if (!P) return;
  P.pos.set(LOBBY_CAM.x + LOBBY_PIES.x, LOBBY_CAM.y + LOBBY_PIES.y + 1, LOBBY_CAM.z + LOBBY_PIES.z); P.yaw = MENU.yaw; P.vel.set(0, 0, 0); P.suelo = true;
  if (P.emote && P.emoteT > 3) P.emote = null;
  animarPersona(P, TIEMPO.dt); dibujarPersona(P);
}
// ---------------- guardados (construcciones por mapa) ----------------
function abrirGuardados() {
  const raiz = buscar(nodo('Main/SavesPanel'), 'Scroll'), root = raiz && hijo(raiz, 'Root');
  overlay('SavesPanel', true);
  if (!root) return;
  root.el.innerHTML = ''; root.el.classList.add('guardados');
  let n = 0;
  for (const m of MAPAS) {
    let L = []; try { L = JSON.parse(localStorage.getItem('hypper_save_' + m) || '[]'); } catch (e) {}
    if (!L.length) continue; n++;
    const d = document.createElement('div'); d.className = 'guardado';
    d.innerHTML = `<i style="background-image:url(${icono(MAPA_ICONO[m])})"></i><b>${m}</b><span>${L.length} props</span>`;
    d.onclick = () => { PREFS.mapa = m; guardarPrefs(); menuMapaMarcar(); MENU.cargarGuardado = true; overlay('SavesPanel', false); menuAviso(m + ': se carga al empezar'); };
    root.el.appendChild(d);
  }
  verNodo(buscar(nodo('Main/SavesPanel'), 'EmptySaveList'), !n);
}
// ---------------- mostrar / ocultar todo el menú ----------------
function menuMostrar(si) {
  if (!MENU.el) return;
  MENU.el.classList.toggle('oc', !si);
  if (si) { seccion(MENU.sec === 'Multiplayer' ? 'Multiplayer' : MENU.sec); menuTextosVivos(); listaConectar(); }
  else menuLobby(false);
}
