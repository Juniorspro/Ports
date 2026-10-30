// ---------------- Definitive RezoBox: inicio con el aspecto del menú de Garry's Mod ----------------
// Fondo con escenas del juego que pasan solas, menú de texto, botoncitos abajo y paneles claros: bienvenida (idioma y
// nombre), Empezar partida nueva (mapas del juego y de la comunidad), la tienda de Mods y mapas (buscar, filtrar,
// instalar, publicar), multijugador, crear server y personajes (rbmenus.js). Los mods y mapas son sólo datos
// (formato.js), validados acá y en el servidor.
const RB = { el: null, panel: null, mapa: null, mapaCom: null, cat: 'todos', hora: 'normal', base: null, fondo: 0, reloj: 0,
  t: { tab: 'mod', vista: 'explorar', q: '', etq: '', orden: 'pop', p: 0, items: [], total: 0, cargando: false, error: false, n: 0 } };
const TIENDA_URL = 'https://rezobox-tienda.holasoyjuniors365.workers.dev/api/';
const MODS = {}; // efectos sumados de los mods activos en la partida (armas y reloj los leen)
const FONDOS_RB = [/*FONDOSRB*/]; // escenas armadas con cosas del juego (van con el paquete, no en el repo)
// el logo: la R de Rezona y el nombre (el mismo de la pantalla de carga)
const LOGO_RB = (document.querySelector('#carga .dLogo img') || {}).src || '';
const VERSION_RB = '1.0';
const ICONOS_MOD = ['mod', ...ICO_LISTA.filter((n) => n !== 'mod' && !['cartel', 'meta', 'zona_muerte', 'boton_autos', 'teleport', 'impulso'].includes(n))].map((n) => 'ico:' + n);
// los mods oficiales, en el mismo formato que los de la gente
const OFICIALES = [['goku', 'ico:energia', ['personajes', 'diversion'], { skin: 'Goku', velocidad: 1.4, salto: 2.5 }], ['luna', 'ico:luna', ['fisica'], { gravedad: 0.35 }],
  ['salto', 'ico:salto', ['jugabilidad'], { salto: 4 }], ['veloz', 'ico:veloz', ['jugabilidad'], { velocidad: 1.8 }], ['balas', 'ico:balas', ['armas'], { municionInfinita: true }],
  ['dios', 'ico:dios', ['jugabilidad'], { invencible: true }], ['lenta', 'ico:lenta', ['diversion'], { tiempo: 0.5 }], ['boom', 'ico:boom', ['armas', 'diversion'], { explosion: 2.5 }],
  // nativos: suman un botón al HUD (nativos.js y entidades.js)
  ['volar', 'ico:volar', ['jugabilidad', 'diversion'], {}, 'volar'], ['ragdoll', 'ico:ragdoll', ['fisica', 'diversion', 'pvp'], {}, 'ragdoll'], ['scp', 'ico:scp', ['personajes', 'diversion'], {}, 'scp'],
  ['piano', 'ico:piano', ['diversion', 'construccion'], {}, 'piano'], ['radio', 'ico:radio', ['diversion'], {}, 'radio'], ['pantalla', 'ico:pantalla', ['diversion', 'construccion'], {}, 'pantalla'],
  ['ciclope', 'ico:ciclope', ['personajes', 'diversion', 'pvp'], { skin: 'Ciclope' }, 'ciclope'], ['verity', 'ico:verity', ['personajes', 'diversion', 'aventura'], {}, 'verity']]
  .map(([id, icono, etiquetas, efectos, nativo]) => Object.assign(validarRB({ formato: 'rezobox-mod', nombre: id + ' (RezoBox)', autor: 'RezoBox', icono, etiquetas, efectos }), { id, oficial: true, nativo }));
// el mapa oficial: Mega rampa en Pasto plano (rampa gigante desde el cielo, autos para elegir arriba con su botón)
function mapaMegaRampa() {
  const H = 140, Z0 = -230, Y0 = 0.53, top = (x, z) => [x, Y0 + H, Z0 + z], ent = [];
  ent.push({ t: 'rampa', p: [0, Y0, Z0], yaw: 0, prm: { alto: H, ancho: 16, ang: 52, salto: true } });
  // los autos en abanico mirando a la boca de la rampa; su botón detrás de cada uno
  ['Sedan', 'police_car_v5', 'Derby5', 'Wheelchair', 'Moto', 'Sofie'].forEach((auto, i) => {
    const a = (-55 + i * 22) * Math.PI / 180, en = (r) => top(+(r * Math.sin(a)).toFixed(2), +(-r * Math.cos(a) - 1).toFixed(2));
    ent.push({ t: 'boton_autos', p: en(21), yaw: -a, prm: { auto, i, a: en(12.5), ya: -a, ini: true } });
  });
  ent.push({ t: 'cartel', p: top(0, -35.3), yaw: Math.PI, prm: { texto: 'MEGA RAMPA', color: '#ffd23f', ico: 'rampa' } });
  for (const [x, z] of [[-40, 6], [40, 6], [-30, 320], [30, 320]]) { ent.push({ t: 'teleport', p: [x, Y0, Z0 + z], yaw: 0, prm: { a: top(0, -30) } }); ent.push({ t: 'cartel', p: [x, Y0, Z0 + z - 4], yaw: Math.PI, prm: { texto: 'MEGA RAMPA', color: '#7fe3ff', ico: 'teleport' } }); }
  ent.push({ t: 'luz', p: top(0, -12).map((v, i) => (i === 1 ? v + 6 : v)), yaw: 0, prm: { color: '#ffe2b0', r: 30, i: 1.2 } });
  const spawns = [-6, -2, 2, 6].map((x) => ({ p: top(x, -31), yaw: 0, rol: null }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d8be0"/><stop offset="1" stop-color="#cfe6f7"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#c)"/><rect y="150" width="200" height="50" fill="#6aa83a"/><path d="M8 34 L44 34 C78 34 92 70 104 104 C114 132 124 150 150 150 L178 150 L196 140" fill="none" stroke="#3a3d44" stroke-width="9" stroke-linejoin="round"/>
    <path d="M8 29 L44 29 C78 29 92 65 104 99 C114 127 124 145 150 145 L178 145 L196 135" fill="none" stroke="#f0c419" stroke-width="3"/><g fill="#7a7a7a"><rect x="20" y="38" width="5" height="112"/><rect x="40" y="38" width="5" height="112"/><rect x="88" y="78" width="5" height="72"/><rect x="108" y="122" width="5" height="28"/></g>
    <g><rect x="12" y="22" width="14" height="7" rx="2" fill="#e74c3c"/><rect x="29" y="22" width="14" height="7" rx="2" fill="#2e86de"/><circle cx="15" cy="30" r="2" fill="#111"/><circle cx="23" cy="30" r="2" fill="#111"/><circle cx="32" cy="30" r="2" fill="#111"/><circle cx="40" cy="30" r="2" fill="#111"/></g>
    <g transform="translate(150 112) rotate(-14)"><rect width="18" height="8" rx="2" fill="#f5f5f5"/><circle cx="4" cy="9" r="2.4" fill="#111"/><circle cx="14" cy="9" r="2.4" fill="#111"/></g></svg>`;
  return Object.assign(validarRB({ formato: 'rezobox-mapa', nombre: 'Mega rampa', autor: 'RezoBox', descripcion: '', etiquetas: ['vehiculos', 'diversion'], base: 'FlatGrass', gravedad: 1, objetos: [], spawns, entidades: ent }),
    { id: 'megarampa', oficial: true, foto: 'data:image/svg+xml;base64,' + btoa(svg.replace(/\s+/g, ' ')) });
}
const OFICIALES_MAPAS = [mapaMegaRampa()];
const mapaDe = (id) => INST.mapas[id] || OFICIALES_MAPAS.find((m) => m.id === id) || null;
const mapasCom = () => [...OFICIALES_MAPAS, ...Object.values(INST.mapas)];
const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || '') || def; } catch (e) { return def; } };
const INST = leerLS('rb_instalados', {}); INST.mods = INST.mods || {}; INST.mapas = INST.mapas || {}; INST.anims = INST.anims || {};
const PUBLICADOS = leerLS('rb_publicados', {}), LIKES = leerLS('rb_likes', {});
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { menuAviso('No hay lugar para guardar'); return false; } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const modsTodos = () => [...OFICIALES, ...Object.values(INST.mods)];
// los emotes que vienen con el juego, como tarjetas de la tienda (incluidos)
const animsOficiales = () => Object.entries(DATA.emo || {}).map(([k, c]) => ({ id: 'rb:' + k, oficial: true, emo: true, nombre: emoNom('rb:' + k, c.n), autor: 'RezoBox', cat: c.cat, icono: DATA.ico['emo_' + k] ? icono('emo_' + k) : '' }));
const nombreDe = (m) => (m.emo ? m.nombre : m.oficial ? T(m.id + '.n') : m.nombre), descDe = (m) => (m.emo ? '' : m.oficial ? T(m.id + '.d') : m.descripcion);
const mapaNom = (m) => T('m.' + m);

function inicioCrear() {
  const el = document.createElement('div'); el.id = 'rbInicio'; el.className = 'oc';
  el.innerHTML = `<div class="rbBg"></div><div class="rbBg"></div><div class="rbSombra"></div>
    <img class="rbLogo" alt="Definitive RezoBox" src="${LOGO_RB}"><div class="rbLista"></div>
    <div class="rbAbajo"></div><div class="rbVer"></div><div class="rbPan oc"></div>`;
  document.body.appendChild(el); RB.el = el;
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-rb]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return; audioIniciar(); inicioAccion(b.dataset.rb, b, e); });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'rbHora') RB.hora = t.value;
    else if (t.id === 'rbOrden') { RB.t.orden = t.value; tiendaCargar(true); }
    else if (t.id === 'rbArchivo') subirArchivo(t.files && t.files[0]);
  });
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'rbBuscar') { RB.t.q = t.value; clearTimeout(RB.tBus); RB.tBus = setTimeout(() => tiendaCargar(true), 350); }
    else if (t.dataset.rv) { const s = t.parentElement.querySelector('output'); if (s) s.textContent = (+t.value).toFixed(2) + '×'; }
  });
  if (!PREFS.mods) PREFS.mods = {};
  if (!PREFS.lang) PREFS.lang = { SP: 'es', EN: 'en', PO: 'pt', ID: 'id', RU: 'ru', UA: 'uk' }[PREFS.bienvenida ? PREFS.idioma : ''] || idiomaDelAparato();
  RB.mapa = mapaValido(PREFS.mapa) ? PREFS.mapa : 'FlatGrass';
  overlay('NicknamePanel', false); PREFS.nombreOk = true; guardarPrefs();
  rbArrastre();
}
// menú de texto como el de GMod: grupos separados por un espacio
function inicioLista() {
  RB.el.dir = PREFS.lang === 'ar' ? 'rtl' : 'ltr';
  const G = [['nueva', 'multi'], ['tienda', 'crear', 'personajes', 'opciones'], ['salir']];
  RB.el.querySelector('.rbLista').innerHTML = G.map((g) => g.map((k) => `<button class="rbIt" data-rb="${k}">${esc(T('m.' + k))}</button>`).join('')).join('<div class="rbSep"></div>');
  const nm = modsTodos().filter((m) => PREFS.mods[m.id]).length, I = IDIOMAS_RB[PREFS.lang] || IDIOMAS_RB.en;
  RB.el.querySelector('.rbAbajo').innerHTML = `<button class="rbChipG" data-rb="tienda">${icoHTML('ico:mod')} ${nm ? `${nm} ${esc(T('modsAct'))}` : 'Sandbox'}</button>
    <button class="rbChipG" data-rb="idioma"><i class="lcod">${I[1]}</i> ${esc(I[0])}</button>
    <label class="rbChipG">${glifo('persona')} <input id="rbNombre" maxlength="16" spellcheck="false"></label>`;
  const inp = RB.el.querySelector('#rbNombre'); inp.value = PREFS.nombre || '';
  inp.oninput = () => nombrePoner(inp.value);
  RB.el.querySelector('.rbVer').textContent = `Definitive RezoBox ${VERSION_RB}`;
}
function nombrePoner(v) { PREFS.nombre = limpioNombre(v); guardarPrefs(); const nick = nodo('Main/MainMenu/UpPanel/NickNameInputField'); if (nick && nick.inp) nick.inp.value = PREFS.nombre; }
function inicioFondoPasar() {
  const capas = RB.el.querySelectorAll('.rbBg'), lista = FONDOS_RB.length ? FONDOS_RB : MAPAS.map((m) => icono(MAPA_ICONO[m]));
  const sig = capas[RB.fondo % 2 ? 0 : 1], act = capas[RB.fondo % 2];
  sig.style.backgroundImage = `url(${lista[RB.fondo % lista.length]})`; sig.classList.add('on'); act.classList.remove('on'); RB.fondo++;
}
function inicioPanel(p) {
  RB.panel = p; const P = RB.el.querySelector('.rbPan');
  for (const s of ['.rbLista', '.rbLogo', '.rbAbajo']) RB.el.querySelector(s).classList.toggle('oc', !!p);
  P.classList.toggle('oc', !p); P.className = 'rbPan' + (p ? ' rbPan_' + p : ' oc');
  // (el personaje en 3D sólo en personajes: en el resto, el fondo de siempre)
  if (p !== 'personajes') { RB.el.classList.remove('rb3d'); menuLobby(false); }
  if (p !== 'multi' && typeof mpClaveNo === 'function') mpClaveNo();
  if (!p) return;
  if (p === 'multi') return panelMulti(P);
  if (p === 'mcrear') return panelMultiCrear(P);
  if (p === 'personajes') return panelPersonajes(P);
  if (p === 'bienvenida') return panelBienvenida(P);
  if (p === 'nueva') return panelNueva(P);
  if (p === 'tienda') return panelTienda(P);
  if (p === 'pubmod') return panelPubMod(P);
  if (p === 'pubmapa') return panelPubMapa(P);
  if (p === 'crear') return panelCrear(P);
}
// ---------- crear un mapa: elegir el mapa base (o seguir uno guardado) y entrar al modo creador ----------
function panelCrear(P) {
  if (!mapaValido(RB.creaBase)) RB.creaBase = RB.mapa || 'FlatGrass';
  const mios = Object.values(INST.mapas).filter((m) => m.creado);
  P.innerHTML = `<div class="rbPanCab">${glifo('martillo')} ${esc(T('m.crear'))}<small>${esc(mapaNom(RB.creaBase))}</small></div>
    <div class="rbPanCuerpo rbCrear"><div class="rbSub">${esc(T('mapaBase'))}</div>
    <div class="rbGrid rbGridChica">${[...MAPAS, ...MAPAS_RB].map((m) => `<div class="rbMapaG${m === RB.creaBase ? ' sel' : ''}" data-rb="creaBase:${m}"><div class="rbFoto" style="background-image:url(${icono(MAPA_ICONO[m])})"></div><b>${esc(mapaNom(m))}</b></div>`).join('')}</div>
    ${mios.length ? `<div class="rbSub">${esc(T('cr.misMapas'))}</div><div class="rbGrid rbGridChica">${mios.map((m) => `<div class="rbMapaG" data-rb="creaEditar:${esc(m.id)}"><div class="rbFoto" style="background-image:url(${m.foto ? esc(m.foto) : icono(MAPA_ICONO[m.base])})"></div><b>${esc(m.nombre)}</b><small>${glifo('lapiz')} ${esc(mapaNom(m.base))}</small></div>`).join('')}</div>` : ''}
    <p class="rbAyudaC">${esc(T('cr.intro'))}</p></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span><button class="rbBtnG" data-rb="creaNuevo">${glifo('martillo')} ${esc(T('cr.empezar'))}</button></div>`;
}
// ---------- bienvenida: idioma y nombre (la primera vez, y desde la banderita) ----------
function panelBienvenida(P) {
  P.innerHTML = `<div class="rbBienv"><img class="rbBienvLogo" alt="" src="${LOGO_RB}"><h2>${esc(T('b.tit'))}</h2><div class="rbSub">${esc(T('b.idioma'))}</div>
    <div class="rbIdiomas">${Object.entries(IDIOMAS_RB).map(([k, [n, b]]) => `<button class="rbIdi${k === PREFS.lang ? ' sel' : ''}" data-rb="lang:${k}"><i class="lcod">${b}</i><span dir="auto">${esc(n)}</span></button>`).join('')}</div>
    <label class="rbCampo rbNomB">${esc(T('b.nombre'))} <input id="rbNombreB" maxlength="16" spellcheck="false"></label>
    <button class="rbBtnG" data-rb="bienvOK">${esc(T('b.seguir'))} ${glifo('adelante')}</button></div>`;
  const i = P.querySelector('#rbNombreB'); i.value = PREFS.nombre || ''; i.oninput = () => nombrePoner(i.value);
}
// ---------- Empezar partida nueva ----------
function panelNueva(P) {
  const coms = mapasCom(), cats = [['todos', [...MAPAS, ...MAPAS_RB]], ['tierra', ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2']], ['espacio', ['Mars', 'Space', 'RB_Luna']], ['rezobox', MAPAS_RB], ['comunidad', coms]];
  const cat = cats.find((c) => c[0] === RB.cat) || cats[0], nm = modsTodos().filter((m) => PREFS.mods[m.id]).length;
  const tarjeta = (m) => typeof m === 'string'
    ? `<div class="rbMapaG${m === RB.mapa && !RB.mapaCom ? ' sel' : ''}" data-rb="mapa:${m}"><div class="rbFoto" style="background-image:url(${icono(MAPA_ICONO[m])})"></div><b>${esc(mapaNom(m))}</b></div>`
    : `<div class="rbMapaG${RB.mapaCom === m.id ? ' sel' : ''}" data-rb="mapacom:${esc(m.id)}"><div class="rbFoto" style="background-image:url(${m.foto ? esc(m.foto) : icono(MAPA_ICONO[m.base])})"></div><b>${esc(nombreDe(m))}</b><small>${m.oficial ? `<b class="rbOf">${esc(T('oficial'))}</b>` : `${esc(T('por'))} ${esc(m.autor)}`}</small></div>`;
  const sel = RB.mapaCom && mapaDe(RB.mapaCom) ? nombreDe(mapaDe(RB.mapaCom)) : mapaNom(RB.mapa);
  P.innerHTML = `<div class="rbPanCab">${esc(T('m.nueva'))}<small>${esc(sel)}</small></div>
    <div class="rbPanCuerpo"><div class="rbCats">${cats.map(([k, l]) => `<button class="rbCat${k === cat[0] ? ' sel' : ''}" data-rb="cat:${k}">${esc(T('c.' + k))}<em>${l.length}</em></button>`).join('')}</div>
    <div class="rbGrid">${cat[1].map(tarjeta).join('') || `<div class="rbVacio">${esc(T('sinRes'))} · <a data-rb="tienda:mapa">${esc(T('m.tienda'))}</a></div>`}</div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button>
      <label class="rbCampo">${esc(T('hora'))} <select id="rbHora">${['normal', 'dia', 'tarde', 'noche', 'ciclo'].map((k) => `<option value="${k}"${RB.hora === k ? ' selected' : ''}>${esc(T('h.' + k))}</option>`).join('')}</select></label>
      <button class="rbBtnGris" data-rb="tienda">${icoHTML('ico:mod')} ${nm ? `${nm} ${esc(T('modsAct'))}` : esc(T('sinMods'))}</button>
      <span class="rbEsp"></span><span class="rbModo">${esc(T('unJugador'))}</span><button class="rbBtnG" data-rb="empezar">${esc(T('empezar'))}</button></div>`;
}
// ---------- tienda: Mods y Mapas (explorar en el servidor o ver los instalados) ----------
function panelTienda(P) {
  const S = RB.t, mods = S.tab === 'mod', anims = S.tab === 'anim', tab = (k, ic, t) => `<button class="rbTab${S.tab === k ? ' sel' : ''}" data-rb="tab:${k}">${ic} ${esc(T(t))}</button>`;
  const etqs = anims ? CATS_ANIM_RB : ETIQUETAS_RB, etqNom = (e) => T(anims ? 'emo.' + e : 'e.' + e);
  P.innerHTML = `<div class="rbPanCab">${esc(T('m.tienda'))}
      <span class="rbTabs">${tab('mod', icoHTML('ico:mod'), 't.mods')}${tab('mapa', glifo('mapa'), 't.mapas')}${tab('anim', icoHTML('ico:animacion'), 't.anims')}</span>
      <span class="rbEsp"></span><button class="rbBtnG rbChico" data-rb="${mods ? 'pubmod' : anims ? 'crearanim' : 'pubmapa'}">${glifo('mas')} ${esc(T(mods ? 'p.mod' : anims ? 'emo.crear' : 'p.mapa'))}</button>
      <label class="rbBtnGris rbChico">${glifo('subir')} ${esc(T('p.archivo'))}<input type="file" id="rbArchivo" accept=".rbmod,.rbmapa,.rbanim,.json" hidden></label></div>
    <div class="rbBarra"><input id="rbBuscar" type="search" placeholder="${esc(T('buscar'))}" value="${esc(S.q)}">
      <select id="rbOrden">${['pop', 'nuevo', 'desc'].map((k) => `<option value="${k}"${S.orden === k ? ' selected' : ''}>${esc(T('o.' + k))}</option>`).join('')}</select>
      <span class="rbSeg"><button class="${S.vista === 'explorar' ? 'sel' : ''}" data-rb="vista:explorar">${esc(T('v.tienda'))}</button><button class="${S.vista === 'instalados' ? 'sel' : ''}" data-rb="vista:instalados">${esc(T('v.instalados'))}</button></span></div>
    <div class="rbEtqs"><button class="rbEtq${!S.etq ? ' sel' : ''}" data-rb="etq:">${esc(T('e.todas'))}</button>${etqs.map((e) => `<button class="rbEtq${S.etq === e ? ' sel' : ''}" data-rb="etq:${e}">${esc(etqNom(e))}</button>`).join('')}</div>
    <div class="rbGrid rbTiendaG"></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span><span class="rbTotal"></span><button class="rbBtnGris" data-rb="mas">${glifo('mas3')}</button>
      <button class="rbBtnG" data-rb="nueva">${esc(T('m.nueva'))} ${glifo('jugar')}</button></div>`;
  tiendaCargar(true);
}
function tiendaCargar(desdeCero) {
  const S = RB.t, n = ++S.n; if (desdeCero) { S.p = 0; S.items = []; }
  if (S.vista === 'instalados') {
    const q = S.q.toLowerCase(), lista = S.tab === 'mod' ? modsTodos() : S.tab === 'anim' ? [...animsOficiales(), ...Object.values(INST.anims)] : mapasCom();
    S.items = lista.filter((m) => (!q || (nombreDe(m) + ' ' + m.autor + ' ' + descDe(m)).toLowerCase().includes(q)) && (!S.etq || (S.tab === 'anim' ? m.cat === S.etq : (m.etiquetas || []).includes(S.etq))));
    S.total = S.items.length; S.error = false; return tiendaDibujar();
  }
  S.cargando = true; S.error = false; tiendaDibujar();
  // (en Emotes, primero los del juego: ya están incluidos)
  if (S.tab === 'anim' && !S.p) { const q = S.q.toLowerCase(); S.items = animsOficiales().filter((m) => (!q || nombreDe(m).toLowerCase().includes(q)) && (!S.etq || m.cat === S.etq)); }
  fetch(`${TIENDA_URL}lista?tipo=${S.tab}&q=${encodeURIComponent(S.q)}&${S.tab === 'anim' ? 'cat' : 'etq'}=${S.etq}&orden=${S.orden}&p=${S.p}`).then((r) => r.json()).then((d) => {
    if (n !== S.n) return; S.items = S.items.concat((d.items || []).map((x) => (S.tab === 'anim' ? Object.assign(x, { cat: x.base }) : x))); S.total = (d.total || 0) + (S.tab === 'anim' ? S.items.filter((x) => x.oficial).length : 0); S.cargando = false; tiendaDibujar();
  }).catch(() => { if (n !== S.n) return; S.cargando = false; S.error = true; tiendaDibujar(); });
}
function tiendaDibujar() {
  const S = RB.t, G = RB.el.querySelector('.rbTiendaG'); if (!G) return;
  const inst = (it) => it.oficial || (S.tab === 'mod' ? INST.mods[it.id] : S.tab === 'anim' ? INST.anims[it.id] : INST.mapas[it.id]);
  const tarjeta = (it) => {
    const an = S.tab === 'anim', ins = inst(it), act = S.tab === 'mod' && PREFS.mods[it.id] && modTipo(it) !== 'asset';
    const img = S.tab === 'mod' ? icoHTML(it.icono) : an ? (it.icono || it.foto ? `<img src="${esc(it.icono || it.foto)}" alt="">` : icoHTML('ico:animacion')) : `<img src="${esc(it.icono || it.foto || icono(MAPA_ICONO[it.base] || 'flatgrass'))}" alt="">`;
    const datos = (it.oficial ? `<b class="rbOf">${esc(T(an ? 'emo.incluido' : 'oficial'))}</b>` : `${esc(T('por'))} ${esc(it.autor)}${it.descargas != null ? ` · ${glifo('bajar')} ${it.descargas} · ${glifo('corazon')} ${it.likes}` : ''}${S.tab === 'mapa' && it.base ? ` · ${esc(mapaNom(it.base))}` : ''}`)
      + (an && it.cat ? ` · ${esc(T('emo.' + it.cat))}` : '') + (S.tab === 'mod' ? ` · ${esc(T(modTipo(it) === 'asset' ? 'mm.assets' : 'mm.juego'))}` : '');
    return `<div class="rbCard${S.tab === 'mapa' ? ' rbCardMapa' : an ? ' rbCardAnim' : ''}${act ? ' on' : ''}"><div class="rbIco">${img}</div>
      <div class="rbInfo"><b dir="auto">${esc(nombreDe(it))}</b><small dir="auto">${it.codigo ? '<b class="rbCod">&lt;/&gt;</b> ' : ''}${datos}</small><p dir="auto">${esc(descDe(it))}</p>
      <span class="rbEtqsC">${(it.etiquetas || []).map((e) => `<i>${esc(T('e.' + e))}</i>`).join('')}</span></div>
      <div class="rbAcc">${S.tab === 'mod' && ins && modTipo(it) !== 'asset' ? `<button class="rbChk${act ? ' on' : ''}" data-rb="act:${esc(it.id)}"><em></em>${esc(T('activado'))}</button>` : ''}
        ${it.oficial ? '' : ins ? `<button class="rbBtnGris rbChico" data-rb="quitar:${esc(it.id)}">${esc(T('quitar'))}</button>` : `<button class="rbBtnG rbChico" data-rb="instalar:${esc(it.id)}">${esc(T('instalar'))}</button>`}
        ${S.tab === 'mapa' && ins ? `<button class="rbBtnG rbChico" data-rb="jugarcom:${esc(it.id)}">${glifo('jugar')} ${esc(T('jugar'))}</button>` : ''}
        ${it.oficial ? '' : `<span class="rbMini">${it.descargas != null ? `<button title="${esc(T('meGusta'))}" class="${LIKES[it.id] ? 'sel' : ''}" data-rb="like:${esc(it.id)}">${glifo('corazon')}</button><button title="${esc(T('denunciar'))}" data-rb="denunciar:${esc(it.id)}">${glifo('bandera')}</button>` : ''}
        ${ins ? `<button title="${esc(T('exportar'))}" data-rb="exportar:${esc(it.id)}">${glifo('bajar')}</button>` : ''}${PUBLICADOS[it.id] ? `<button title="${esc(T('quitar'))}" data-rb="borrarpub:${esc(it.id)}">${glifo('basura')}</button>` : ''}</span>`}</div></div>`;
  };
  G.innerHTML = S.items.map(tarjeta).join('') + (S.cargando ? `<div class="rbVacio">${esc(T('cargando'))}</div>` : S.error ? `<div class="rbVacio">${esc(T('errRed'))}</div>` : !S.items.length ? `<div class="rbVacio">${esc(T('sinRes'))}</div>` : '');
  const tot = RB.el.querySelector('.rbTotal'); if (tot) tot.textContent = S.total ? `${S.items.length} / ${S.total}` : '';
  const mas = RB.el.querySelector('[data-rb=mas]'); if (mas) mas.style.visibility = S.vista === 'explorar' && S.items.length < S.total ? '' : 'hidden';
}
async function instalar(id) {
  const S = RB.t;
  try {
    const d = await (await fetch(TIENDA_URL + 'item/' + id)).json(), v = validarRB(d);
    if (typeof v === 'string') { menuAviso(T('errFormato') + ': ' + v); return; }
    if (v.codigo && !confirm(T('codigoAviso'))) return;
    v.id = id; v.remoto = true; const it = S.items.find((x) => x.id === id); if (it) { v.descargas = it.descargas; v.likes = it.likes; }
    if (v.formato === 'rezobox-mod') { INST.mods[id] = v; PREFS.mods[id] = true; guardarPrefs(); } else if (v.formato === 'rezobox-anim') { INST.anims[id] = v; emoOlvidar('u:' + id); } else INST.mapas[id] = v;
    guardarLS('rb_instalados', INST); menuAviso(T('instalado') + ': ' + v.nombre); tiendaDibujar();
  } catch (e) { menuAviso(T('errRed')); }
}
function descargarArchivo(d) {
  const a = document.createElement('a'), limpio = Object.assign({}, d); delete limpio.remoto; delete limpio.oficial; delete limpio.descargas; delete limpio.likes;
  a.href = URL.createObjectURL(new Blob([JSON.stringify(limpio, null, 1)], { type: 'application/json' }));
  a.download = (d.nombre || 'rezobox').replace(/[^\w\-]+/g, '_') + (d.formato === 'rezobox-mapa' ? '.rbmapa' : d.formato === 'rezobox-anim' ? '.rbanim' : '.rbmod'); a.click();
}
function subirArchivo(f) {
  if (!f) return;
  if (f.size > 8e6) { menuAviso(T('errFormato')); return; }
  f.text().then((t) => {
    let d; try { d = JSON.parse(t); } catch (e) { menuAviso(T('errFormato')); return; }
    const v = validarRB(d); if (typeof v === 'string') { menuAviso(T('errFormato') + ': ' + v); return; }
    if (v.codigo && !confirm(T('codigoAviso'))) return;
    v.id = 'local-' + Math.random().toString(36).slice(2, 10);
    if (v.formato === 'rezobox-mod') { INST.mods[v.id] = v; PREFS.mods[v.id] = true; guardarPrefs(); RB.t.tab = 'mod'; } else if (v.formato === 'rezobox-anim') { INST.anims[v.id] = v; RB.t.tab = 'anim'; } else { INST.mapas[v.id] = v; RB.t.tab = 'mapa'; }
    guardarLS('rb_instalados', INST); RB.t.vista = 'instalados'; menuAviso(T('instalado') + ': ' + v.nombre); inicioPanel('tienda');
  });
}
async function tiendaPublicar(d) {
  const v = validarRB(d); if (typeof v === 'string') { menuAviso(v); return; }
  try {
    const r = await (await fetch(TIENDA_URL + 'publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) })).json();
    if (!r.id) { menuAviso(r.error || T('errRed')); return; }
    PUBLICADOS[r.id] = r.clave; guardarLS('rb_publicados', PUBLICADOS);
    v.id = r.id; v.remoto = true; v.descargas = 0; v.likes = 0;
    if (v.formato === 'rezobox-mod') { INST.mods[r.id] = v; PREFS.mods[r.id] = true; guardarPrefs(); } else if (v.formato === 'rezobox-anim') INST.anims[r.id] = v; else INST.mapas[r.id] = v;
    guardarLS('rb_instalados', INST);
    if (v.formato === 'rezobox-anim') return r; // (el editor de animaciones avisa solo)
    menuAviso(`${T('publicado')} ${T('clave')} ${r.clave}`);
    RB.t.tab = v.formato === 'rezobox-mod' ? 'mod' : 'mapa'; RB.t.vista = 'instalados'; inicioPanel('tienda');
  } catch (e) { menuAviso(T('errRed')); }
}
// ---------- crear un mod (sin código: valores, interruptores, personaje, hora y armas) ----------
function panelPubMod(P) {
  const R = [['gravedad', -2, 10, 0.05], ['velocidad', 0, 20, 0.1], ['salto', 0, 40, 0.1], ['tiempo', 0.05, 4, 0.05], ['explosion', 0, 30, 0.1]];
  const armas = Object.keys(DEF_ARMAS || {}).filter((a) => !/^(Camera|Hands)$/.test(a));
  P.innerHTML = `<div class="rbPanCab">${esc(T('p.mod'))}</div><div class="rbForm">
    <div class="rbCol"><label class="rbCampo">${esc(T('nombre'))}<input id="pmNom" maxlength="40"></label>
      <label class="rbCampo">${esc(T('desc'))}<textarea id="pmDesc" maxlength="400" rows="3"></textarea></label>
      <div class="rbCampo">${esc(T('icono'))}<span class="rbIconos">${ICONOS_MOD.map((e, i) => `<button class="${i ? '' : 'sel'}" data-rb="pmico:${e}">${icoHTML(e)}</button>`).join('')}</span></div>
      <div class="rbCampo">${esc(T('etiquetas'))}<span class="rbEtqs">${ETIQUETAS_RB.map((e) => `<button class="rbEtq" data-rb="pmetq:${e}">${esc(T('e.' + e))}</button>`).join('')}</span></div>
      <div class="rbCampo">${esc(T('f.tipo'))}<span class="rbEtqs"><button class="rbEtq sel" data-rb="pmtipo:juego">${esc(T('mm.juego'))}</button><button class="rbEtq" data-rb="pmtipo:asset">${esc(T('mm.assets'))}</button></span><small class="rbAyuda pmTipoAy">${esc(T('f.tipoJuego'))}</small></div>
      <div class="rbCampo pmAsset oc">${esc(T('f.aparecer'))}<input id="pmPropQ" maxlength="30" spellcheck="false" placeholder="${esc(T('buscar'))}"><span class="rbEtqs pmProps"></span></div></div>
    <div class="rbCol">${R.map(([k, a, b, s]) => `<label class="rbRango">${esc(T('f.' + k))}<input type="range" data-rv="${k}" min="${a}" max="${b}" step="${s}" value="1"><output>1.00×</output></label>`).join('')}
      <span class="rbFila"><button class="rbChk" data-rb="pmtog:municionInfinita"><em></em>${esc(T('f.municion'))}</button><button class="rbChk" data-rb="pmtog:invencible"><em></em>${esc(T('f.invencible'))}</button></span>
      <span class="rbFila"><label class="rbCampo">${esc(T('f.skin'))}<select id="pmSkin"><option value="">${esc(T('ninguna'))}</option>${Object.keys(RETRATO).map((s) => `<option>${s}</option>`).join('')}</select></label>
      <label class="rbCampo">${esc(T('f.hora'))}<select id="pmHora"><option value="">${esc(T('ninguna'))}</option>${[...Array(24)].map((_, h) => `<option value="${h}">${h}:00</option>`).join('')}</select></label></span>
      <div class="rbCampo">${esc(T('e.armas'))}<span class="rbEtqs">${armas.map((a) => `<button class="rbEtq" data-rb="pmarma:${a}">${a}</button>`).join('')}</span></div>
      <label class="rbCampo">${esc(T('codigo'))}<textarea id="pmCod" rows="6" spellcheck="false" class="rbCodigo" placeholder="rb.on('inicio', () => rb.aviso('¡Hola!'));&#10;rb.boton('salto', 'ico:salto');&#10;rb.on('boton', (b) => rb.jugador({ vel: [0, 30, 0] }));"></textarea><small class="rbAyuda">rb.on(inicio|tick|boton|tecla|muerte) · rb.jugador({...}) · rb.mundo({...}) · rb.crear(n, [x,y,z]) · rb.mover · rb.borrar · rb.objetos() · rb.explosion · rb.arma · rb.sonido · rb.nota(hz) · rb.rayo · rb.boton(id, texto) · rb.guardar/leer · rb.entidad(piano|radio|rampa|…, [x,y,z], {…}) · rb.nativo(volar|ragdoll|scp)</small></label></div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="tienda">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span>
      <button class="rbBtnGris" data-rb="pmexp">${glifo('bajar')} ${esc(T('exportar'))}</button><button class="rbBtnGris" data-rb="pmprobar">${glifo('si')} ${esc(T('instalar'))}</button><button class="rbBtnG" data-rb="pmpub">${glifo('subir')} ${esc(T('publicar'))}</button></div>`;
  RB.pm = { icono: ICONOS_MOD[0], etq: new Set(), tog: {}, armas: new Set(), tipo: 'juego', ap: new Set() };
  const pq = P.querySelector('#pmPropQ'); pq.oninput = () => pmProps(P); pmProps(P);
}
// los props que puede poner un mod de assets (busca en todos; los elegidos primero)
function pmProps(P) {
  const q = (P.querySelector('#pmPropQ').value || '').trim().toLowerCase(), C = DATA.menu.find((c) => c.n === 'Props'), todos = [];
  if (C) for (const sc of C.sub) for (const it of sc.it) if (!todos.includes(it)) todos.push(it);
  const L = [...RB.pm.ap, ...todos.filter((x) => !RB.pm.ap.has(x) && (!q || (x + ' ' + propNom(x)).toLowerCase().includes(q)))].slice(0, 80);
  P.querySelector('.pmProps').innerHTML = L.map((x) => `<button class="rbEtq${RB.pm.ap.has(x) ? ' sel' : ''}" data-rb="pmprop:${esc(x)}">${esc(propNom(x))}</button>`).join('');
}
function modDelForm() {
  const P = RB.el.querySelector('.rbPan'), v = (s) => P.querySelector(s).value, ef = {};
  P.querySelectorAll('[data-rv]').forEach((r) => { ef[r.dataset.rv] = +r.value; });
  Object.assign(ef, RB.pm.tog, { skin: v('#pmSkin') || null, hora: v('#pmHora') === '' ? null : +v('#pmHora'), armas: [...RB.pm.armas] });
  if (RB.pm.tipo === 'asset') ef.aparecer = [...RB.pm.ap].map((n, i) => ({ n, d: 3 + Math.floor(i / 3) * 2, lado: ((i % 3) - 1) * 2 }));
  return { formato: 'rezobox-mod', nombre: v('#pmNom'), autor: PREFS.nombre, descripcion: v('#pmDesc'), icono: RB.pm.icono, etiquetas: [...RB.pm.etq], efectos: ef, codigo: v('#pmCod'), tipo: RB.pm.tipo };
}
// ---------- publicar una construcción guardada como mapa ----------
function construcciones() {
  return [...MAPAS_RB, ...MAPAS].map((m) => ({ m, L: leerLS('hypper_save_' + m, []), foto: (() => { try { return localStorage.getItem('rb_foto_' + m) || null; } catch (e) { return null; } })() })).filter((c) => c.L.length);
}
function panelPubMapa(P) {
  const cs = construcciones(); RB.pmap = RB.pmap && cs.some((c) => c.m === RB.pmap.m) ? RB.pmap : { m: cs.length ? cs[0].m : null, etq: new Set() };
  P.innerHTML = `<div class="rbPanCab">${esc(T('p.mapa'))}</div><div class="rbForm">
    <div class="rbCol"><div class="rbCampo">${esc(T('mapaBase'))}</div><div class="rbGrid rbGridChica">${cs.map((c) => `<div class="rbMapaG${c.m === RB.pmap.m ? ' sel' : ''}" data-rb="pmapa:${c.m}"><div class="rbFoto" style="background-image:url(${c.foto || icono(MAPA_ICONO[c.m])})"></div><b>${esc(mapaNom(c.m))}</b><small>${c.L.length} ${esc(T('objetos'))}</small></div>`).join('') || `<div class="rbVacio">${esc(T('nadaConstr'))}</div>`}</div></div>
    <div class="rbCol"><label class="rbCampo">${esc(T('nombre'))}<input id="paNom" maxlength="40"></label><label class="rbCampo">${esc(T('desc'))}<textarea id="paDesc" maxlength="400" rows="3"></textarea></label>
      <label class="rbCampo">${esc(T('f.hora'))}<select id="paHora"><option value="">${esc(T('ninguna'))}</option>${[...Array(24)].map((_, h) => `<option value="${h}">${h}:00</option>`).join('')}</select></label>
      <div class="rbCampo">${esc(T('etiquetas'))}<span class="rbEtqs">${ETIQUETAS_RB.map((e) => `<button class="rbEtq" data-rb="paetq:${e}">${esc(T('e.' + e))}</button>`).join('')}</span></div></div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="tienda">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span>
      <button class="rbBtnGris" data-rb="paexp">${glifo('bajar')} ${esc(T('exportar'))}</button><button class="rbBtnG" data-rb="papub">${glifo('subir')} ${esc(T('publicar'))}</button></div>`;
}
function mapaDelForm() {
  const P = RB.el.querySelector('.rbPan'), c = construcciones().find((x) => x.m === RB.pmap.m); if (!c) return null;
  const h = P.querySelector('#paHora').value;
  return { formato: 'rezobox-mapa', nombre: P.querySelector('#paNom').value, autor: PREFS.nombre, descripcion: P.querySelector('#paDesc').value, etiquetas: [...RB.pmap.etq],
    base: c.m, foto: c.foto, hora: h === '' ? null : +h, gravedad: 1, objetos: c.L };
}
function inicioAccion(k, b) {
  const [a, v] = k.split(/:(.*)/s);
  if (rbMenusAccion(a, v)) return; // (multijugador, crear server y personajes: rbmenus.js)
  const marcar = () => b.classList.toggle('sel');
  switch (a) {
    case 'nueva': return inicioPanel('nueva');
    case 'tienda': if (v) RB.t.tab = v; return inicioPanel('tienda');
    case 'volver': inicioLista(); return inicioPanel(null);
    case 'tab': RB.t.tab = v; RB.t.etq = ''; return inicioPanel('tienda');
    case 'vista': RB.t.vista = v; return inicioPanel('tienda');
    case 'etq': RB.t.etq = v; return inicioPanel('tienda');
    case 'mas': RB.t.p++; return tiendaCargar(false);
    case 'instalar': return instalar(v);
    case 'quitar': if (RB.t.tab === 'mod') { delete INST.mods[v]; delete PREFS.mods[v]; guardarPrefs(); } else if (RB.t.tab === 'anim') { delete INST.anims[v]; emoOlvidar('u:' + v); } else delete INST.mapas[v]; guardarLS('rb_instalados', INST); return RB.t.vista === 'instalados' ? tiendaCargar(true) : tiendaDibujar();
    case 'act': PREFS.mods[v] = !PREFS.mods[v]; if (!PREFS.mods[v]) delete PREFS.mods[v]; guardarPrefs(); return tiendaDibujar();
    case 'like': if (LIKES[v]) return; LIKES[v] = 1; guardarLS('rb_likes', LIKES); fetch(TIENDA_URL + 'like/' + v, { method: 'POST' }).catch(() => {}); { const it = RB.t.items.find((x) => x.id === v); if (it) it.likes++; } return tiendaDibujar();
    case 'denunciar': if (!confirm(T('denunciar') + '?')) return; fetch(TIENDA_URL + 'denunciar/' + v, { method: 'POST' }).catch(() => {}); RB.t.items = RB.t.items.filter((x) => x.id !== v); return tiendaDibujar();
    case 'exportar': return descargarArchivo(RB.t.tab === 'mod' ? INST.mods[v] : RB.t.tab === 'anim' ? INST.anims[v] : INST.mapas[v]);
    case 'crearanim': RB.horaPartida = 'normal'; RB.mapaPartida = null; RB.mapaCom = null; SALA = null; inicioMostrar(false); empezarPartida('FlatGrass'); setTimeout(() => edaAbrir(), 900); return;
    case 'borrarpub': if (!confirm(T('quitar') + ' ' + v + '?')) return; fetch(TIENDA_URL + 'borrar/' + v, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave: PUBLICADOS[v] }) }).then((r) => r.json()).then((r) => { if (r.ok) { delete PUBLICADOS[v]; guardarLS('rb_publicados', PUBLICADOS); tiendaCargar(true); } }).catch(() => menuAviso(T('errRed'))); return;
    case 'jugarcom': if (!mapaDe(v)) return; RB.mapaCom = v; RB.mapa = mapaDe(v).base; RB.hora = 'normal'; return inicioAccion('empezar', b);
    case 'pubmod': return inicioPanel('pubmod');
    case 'pubmapa': return inicioPanel('pubmapa');
    case 'pmico': RB.pm.icono = v; b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b)); return;
    case 'pmetq': marcar(); return RB.pm.etq.has(v) ? RB.pm.etq.delete(v) : RB.pm.etq.size < 4 ? RB.pm.etq.add(v) : marcar();
    case 'pmarma': marcar(); return RB.pm.armas.has(v) ? RB.pm.armas.delete(v) : RB.pm.armas.add(v);
    case 'pmtog': RB.pm.tog[v] = !RB.pm.tog[v]; b.classList.toggle('on', RB.pm.tog[v]); return;
    case 'pmtipo': { RB.pm.tipo = v === 'asset' ? 'asset' : 'juego'; const P = RB.el.querySelector('.rbPan'); b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
      P.querySelector('.pmAsset').classList.toggle('oc', RB.pm.tipo !== 'asset'); P.querySelector('.pmTipoAy').textContent = T(RB.pm.tipo === 'asset' ? 'f.tipoAsset' : 'f.tipoJuego'); return; }
    case 'pmprop': { if (RB.pm.ap.has(v)) RB.pm.ap.delete(v); else if (RB.pm.ap.size < 30) RB.pm.ap.add(v); return pmProps(RB.el.querySelector('.rbPan')); }
    case 'pmexp': { const m = validarRB(modDelForm()); return typeof m === 'string' ? menuAviso(m) : descargarArchivo(m); }
    case 'pmprobar': { const m = validarRB(modDelForm()); if (typeof m === 'string') return menuAviso(m); m.id = 'local-' + Math.random().toString(36).slice(2, 10); INST.mods[m.id] = m; PREFS.mods[m.id] = true; guardarPrefs(); guardarLS('rb_instalados', INST); RB.t.tab = 'mod'; RB.t.vista = 'instalados'; menuAviso(T('instalado') + ': ' + m.nombre); return inicioPanel('tienda'); }
    case 'pmpub': return tiendaPublicar(modDelForm());
    case 'pmapa': RB.pmap.m = v; return inicioPanel('pubmapa');
    case 'paetq': marcar(); return RB.pmap.etq.has(v) ? RB.pmap.etq.delete(v) : RB.pmap.etq.size < 4 ? RB.pmap.etq.add(v) : marcar();
    case 'paexp': { const d = mapaDelForm(); if (!d) return; const m = validarRB(d); return typeof m === 'string' ? menuAviso(m) : descargarArchivo(m); }
    case 'papub': { const d = mapaDelForm(); return d ? tiendaPublicar(d) : menuAviso(T('nadaConstr')); }
    case 'cat': RB.cat = v; return inicioPanel('nueva');
    case 'mapa': RB.mapa = v; RB.mapaCom = null; PREFS.mapa = v; guardarPrefs(); if (typeof menuMapaMarcar === 'function') menuMapaMarcar(); return inicioPanel('nueva');
    case 'mapacom': if (!mapaDe(v)) return; RB.mapaCom = v; RB.mapa = mapaDe(v).base; return inicioPanel('nueva');
    case 'empezar': RB.horaPartida = RB.hora; RB.mapaPartida = RB.mapaCom ? mapaDe(RB.mapaCom) : null; SALA = null; CREA.on = false;
      entrarConCarga(RB.mapaPartida ? nombreDe(RB.mapaPartida) : T('ld.solo'), RB.mapa, () => { inicioMostrar(false); empezarPartida(RB.mapa); }); return;
    case 'crear': return inicioPanel('crear');
    case 'creaBase': RB.creaBase = v; return inicioPanel('crear');
    case 'creaNuevo': return creadorEmpezar(RB.creaBase, null);
    case 'creaEditar': { const m = INST.mapas[v]; if (m) creadorEmpezar(m.base, m); return; }
    case 'opciones': abrirAjustes('principal'); return;
    case 'idioma': return inicioPanel('bienvenida');
    case 'lang': idiomaAplicar(v); inicioLista(); return inicioPanel('bienvenida');
    case 'bienvOK': PREFS.bienvenida = true; guardarPrefs(); inicioLista(); return inicioPanel(null);
    case 'salir': if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); menuAviso(T('salirAviso'));
  }
}
// muestra el inicio arriba del menú real (que queda armado abajo); la primera vez, la bienvenida
function inicioMostrar(si) {
  if (si) {
    menuMostrar(true); if (!RB.el) inicioCrear(); idiomaAplicar(PREFS.lang); inicioLista(); inicioPanel(PREFS.bienvenida ? null : 'bienvenida');
    if (!RB.reloj) { inicioFondoPasar(); RB.reloj = setInterval(() => { if (!RB.el.classList.contains('oc')) inicioFondoPasar(); }, 9000); }
  }
  if (RB.el) RB.el.classList.toggle('oc', !si);
  if (!si && RB.el) { RB.el.classList.remove('rb3d'); menuLobby(false); }
}
// al guardar una construcción, también una foto chica para publicarla como mapa
function fotoConstruccion() {
  JUEGO.fotoCb = () => { try { const c = document.createElement('canvas'); c.width = 320; c.height = 180; c.getContext('2d').drawImage(R.cv, 0, 0, 320, 180); localStorage.setItem('rb_foto_' + MUNDO.nombre, c.toDataURL('image/jpeg', 0.62)); } catch (e) {} };
  JUEGO.foto = 2;
}
// cosas que un mod hace aparecer delante del jugador
function aparecerDelante(lista) {
  const yaw = JUG.yaw, f = [Math.sin(yaw), Math.cos(yaw)], l = [Math.cos(yaw), -Math.sin(yaw)], o = JUG.pos;
  for (const it of lista) { const x = o.x + f[0] * it.d + l[0] * it.lado, z = o.z + f[1] * it.d + l[1] * it.lado; crearObjeto(it.n, v3(x, o.y + 1.5, z), Quat.euler(yaw, 0)); }
}
// los mods y el mapa de la comunidad: se llama al empezar la partida (con el mapa cargado, el jugador puesto y sus armas)
function aplicarMods() {
  const E = { gravedad: 1, velocidad: 1, salto: 1, tiempo: 1, explosion: 1, municionInfinita: false, invencible: false, skin: null, hora: null, armas: [], aparecer: [] };
  if (!RB.base) RB.base = { v: JUG.vel_max, s: JUG.salto };
  // modo creador: sin mods (volás libre, sin morir y con munición) y con lo que había en el mapa que se edita
  smReiniciar();
  // en una sala: los mods del server que elegiste con SM (se aplican también en el medio de la partida)
  if (typeof SALA !== 'undefined' && SALA && !CREA.on) {
    RB.mapaPartida = null; RB.horaPartida = null; smAplicar(true); SRV.t = SRV.mods.size ? 60 : 0;
    setTimeout(() => { if (SALA && JUEGO.estado === 'juego') aviso(T('sm.hint'), 4); }, 3200); return;
  }
  if (CREA.on) { Object.assign(MODS, E, { municionInfinita: true, invencible: true }); JUG.vel_max = RB.base.v; JUG.salto = RB.base.s; RB.mapaPartida = null; RB.horaPartida = null; modapiCargar([]); creadorIniciar(); return; }
  // un jugador: los mods se aplican igual que en una sala (y se prenden y apagan en el medio desde el menú MOD).
  // La gravedad de los mods se suma a la del mapa; el personaje del mod no cambia el tuyo guardado.
  const mc = RB.mapaPartida; RB.mapaPartida = null;
  RB.gravMapa = MUNDO.gravedad * (mc ? mc.gravedad : 1);
  RB.codMapa = mc && mc.codigo ? [{ id: 'mapa-' + (mc.id || 'local'), nombre: mc.nombre, codigo: mc.codigo }] : [];
  smAplicar(true);
  const act = modsActivosAhora();
  // hora: la elegida al empezar, si no la del mapa, si no la del mod
  const h = RB.horaPartida; RB.horaPartida = null; let hora = null, ciclo = false;
  if (h && h !== 'normal') { if (h === 'ciclo') ciclo = true; else hora = { dia: 12, tarde: 18.6, noche: 0 }[h]; } else if (mc && mc.hora != null) hora = mc.hora; else if (MODS.hora != null) hora = MODS.hora;
  if (ciclo || hora != null) { DIA.ciclo = ciclo; if (hora != null) DIA.hora = hora; DIA.aplicada = -1; }
  if (mc) {
    for (const x of mc.objetos) { const o = crearObjeto(x.n, v3(0, 0, 0), new Quat(x.q[0], x.q[1], x.q[2], x.q[3]), { congelado: !!x.f }); if (o) { o.b.pos.set(x.p[0], x.p[1], x.p[2]); o.b.q.set(x.q[0], x.q[1], x.q[2], x.q[3]); o.b.updateWorld(); } }
    if (mc.aparicion) JUG.pos.set(mc.aparicion[0], mc.aparicion[1], mc.aparicion[2]);
    entidadesCargar(mc.entidades);
    if ((mc.spawns && mc.spawns.length) || (mc.roles && mc.roles.length)) rolesPreparar(mc);
    setTimeout(() => aviso(nombreDe(mc) + ' · ' + T('por') + ' ' + mc.autor, 3), 300);
  }
  const ap = act.flatMap((m) => m.efectos.aparecer); if (ap.length) setTimeout(() => aparecerDelante(ap.slice(0, 60)), 400);
  const nom = act.map(nombreDe); if (nom.length) setTimeout(() => aviso('Mods: ' + nom.join(', '), 3), 2600);
}
