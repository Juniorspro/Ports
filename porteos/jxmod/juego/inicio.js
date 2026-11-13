// ---------------- JXMod: inicio con el aspecto del menú de Garry's Mod ----------------
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
let LOGO_RB = (document.querySelector('#carga .dLogo img') || {}).src || '';   // (o el tuyo: milogo.js)
const VERSION_RB = JX_VERSION, ARMADO_RB = '__ARMADO__';
const ICONOS_MOD = ['mod', ...ICO_LISTA.filter((n) => n !== 'mod' && !['cartel', 'meta', 'zona_muerte', 'boton_autos', 'teleport', 'impulso'].includes(n))].map((n) => 'ico:' + n);
// los mods oficiales, en el mismo formato que los de la gente
const OFICIALES = [['goku', 'ico:energia', ['personajes', 'diversion'], { skin: 'Goku', velocidad: 1.4, salto: 2.5 }], ['luna', 'ico:luna', ['fisica'], { gravedad: 0.35 }],
  ['salto', 'ico:salto', ['jugabilidad'], { salto: 4 }], ['veloz', 'ico:veloz', ['jugabilidad'], { velocidad: 1.8 }], ['balas', 'ico:balas', ['armas'], { municionInfinita: true }],
  ['dios', 'ico:dios', ['jugabilidad'], { invencible: true }], ['lenta', 'ico:lenta', ['diversion'], { tiempo: 0.5 }], ['boom', 'ico:boom', ['armas', 'diversion'], { explosion: 2.5 }],
  // nativos: suman un botón al HUD (nativos.js y entidades.js)
  ['volar', 'ico:volar', ['jugabilidad', 'diversion'], {}, 'volar'], ['ragdoll', 'ico:ragdoll', ['fisica', 'diversion', 'pvp'], {}, 'ragdoll'], ['scp', 'ico:scp', ['personajes', 'diversion'], {}, 'scp'],
  ['piano', 'ico:piano', ['diversion', 'construccion'], {}, 'piano'], ['radio', 'ico:radio', ['diversion'], {}, 'radio'], ['pantalla', 'ico:pantalla', ['diversion', 'construccion'], {}, 'pantalla'],
  ['ciclope', 'ico:ciclope', ['personajes', 'diversion', 'pvp'], { skin: 'Ciclope' }, 'ciclope'],
   // (Verity está desactivada: no aparece como mod; ver VER_APAGADA en verity.js)
  // el celular: un arma que se ve en la mano en primera persona (celumano.js); viene instalado y prendido
  ['celular', 'ico:celular', ['jugabilidad', 'diversion'], { armas: ['Celular'] }]]
  .map(([id, icono, etiquetas, efectos, nativo]) => Object.assign(validarRB({ formato: 'rezobox-mod', nombre: id + ' (JXMod)', autor: 'JXMod', icono, etiquetas, efectos }), { id, oficial: true, nativo }));
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
  return Object.assign(validarRB({ formato: 'rezobox-mapa', nombre: 'Mega rampa', autor: 'JXMod', descripcion: '', etiquetas: ['vehiculos', 'diversion'], base: 'FlatGrass', gravedad: 1, objetos: [], spawns, entidades: ent }),
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
// Los oficiales también se instalan desde la tienda (antes venían todos puestos y la tienda quedaba vacía): INST.of guarda
// cuáles tenés (la primera vez con esto, los que ya tenías prendidos: inicioCrear); uno prendido cuenta como instalado.
const ofInstalado = (id) => !!((INST.of && INST.of[id]) || (PREFS.mods && PREFS.mods[id]));
// orden de los oficiales en la tienda: lo más buscado primero (Verity, personajes, la radio y la tele), después cómo se
// juega, la física y lo de armas
const ORDEN_OF = ['verity', 'celular', 'goku', 'radio', 'pantalla', 'piano', 'volar', 'ciclope', 'ragdoll', 'scp', 'salto', 'veloz', 'luna', 'dios', 'lenta', 'balas', 'boom'];
const ofOrden = (m) => { const i = ORDEN_OF.indexOf(m.id); return i < 0 ? 99 : i; };
// los tuyos: los prendidos primero y después por nombre
const porNombre = (a, b) => nombreDe(a).localeCompare(nombreDe(b), PREFS.lang || 'es', { sensitivity: 'base' });
const modsTodos = () => [...OFICIALES.filter((m) => ofInstalado(m.id)), ...Object.values(INST.mods)];
// los emotes que vienen con el juego, como tarjetas de la tienda (incluidos)
const animsOficiales = () => Object.entries(DATA.emo || {}).map(([k, c]) => ({ id: 'rb:' + k, oficial: true, emo: true, nombre: emoNom('rb:' + k, c.n), autor: 'JXMod', cat: c.cat, icono: DATA.ico['emo_' + k] ? icono('emo_' + k) : '' }));
const nombreDe = (m) => (m.emo ? m.nombre : m.oficial ? T(m.id + '.n') : m.nombre), descDe = (m) => (m.emo ? '' : m.oficial ? T(m.id + '.d') : m.descripcion);
const mapaNom = (m) => (typeof GBSP !== 'undefined' && GBSP.mapas.has(m) ? GBSP.mapas.get(m).nombre : T('m.' + m));   // (los del Workshop, con su nombre)

// las redes de JXStudios (íconos: Simple Icons, CC0)
const RED_SOCIAL = [['Discord', 'https://discord.gg/bsdThEjje', '<svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="#fff" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>'], ['TikTok', 'https://www.tiktok.com/@jxstudios1', '<svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="#fff" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>']];
function abrirRed(u) { try { if (window.JXNativo && JXNativo.abrir) { JXNativo.abrir(u); return; } } catch (e) {} window.open(u, '_blank', 'noopener'); }
function inicioCrear() {
  const el = document.createElement('div'); el.id = 'rbInicio'; el.className = 'oc';
  el.innerHTML = `<div class="rbBg"></div><div class="rbBg"></div><div class="rbSombra"></div>
    <img class="rbLogo" alt="JXMod" src="${LOGO_RB}"><div class="rbLista"></div>
    <div class="rbAbajo"></div><div class="rbVer"></div><div class="rbPan oc"></div>`;
  document.body.appendChild(el); RB.el = el;
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-rb]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return; audioIniciar(); inicioAccion(b.dataset.rb, b, e); });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'rbHora') RB.hora = t.value;
    else if (t.id === 'rbModoJ' && typeof GMM !== 'undefined') GMM.elegido = t.value;
    else if (t.id === 'rbOrden') { RB.t.orden = t.value; tiendaCargar(true); }
    else if (t.id === 'rbArchivo') subirArchivo(t.files && t.files[0]);
  });
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'rbBuscar') { RB.t.q = t.value; clearTimeout(RB.tBus); RB.tBus = setTimeout(() => tiendaCargar(true), 350); }
    else if (t.dataset.rv) { const s = t.parentElement.querySelector('output'); if (s) s.textContent = (+t.value).toFixed(2) + '×'; }
  });
  if (!PREFS.mods) PREFS.mods = {};
  if (!INST.of) { INST.of = {}; for (const m of OFICIALES) if (PREFS.mods[m.id]) INST.of[m.id] = true; guardarLS('rb_instalados', INST); }
  // (el celular ahora es un mod: viene instalado y prendido una vez; después cada uno lo apaga si quiere)
  if (!PREFS.celuMod) { PREFS.celuMod = 1; INST.of.celular = true; PREFS.mods.celular = true; guardarLS('rb_instalados', INST); guardarPrefs(); }
  if (!PREFS.lang) PREFS.lang = { SP: 'es', EN: 'en', PO: 'pt', ID: 'id', RU: 'ru', UA: 'uk' }[PREFS.bienvenida ? PREFS.idioma : ''] || idiomaDelAparato();
  RB.mapa = mapaValido(PREFS.mapa) ? PREFS.mapa : 'FlatGrass';
  overlay('NicknamePanel', false); PREFS.nombreOk = true; guardarPrefs();
  rbArrastre();
}
// menú de texto como el de GMod: grupos separados por un espacio
function inicioLista() {
  RB.el.dir = PREFS.lang === 'ar' ? 'rtl' : 'ltr';
  const G = [['nueva', 'multi', 'social'], ['tienda', 'crear', 'personajes', 'opciones'], ['salir']];
  // (la 3.0: «Empezar partida nueva» es el botón principal, en el color de acento)
  RB.el.querySelector('.rbLista').innerHTML = G.map((g) => g.map((k) => `<button class="rbIt${k === 'nueva' ? ' rbPri' : ''}" data-rb="${k}">${esc(T('m.' + k))}</button>`).join('')).join('<div class="rbSep"></div>');
  const nm = modsTodos().filter((m) => PREFS.mods[m.id]).length, I = IDIOMAS_RB[PREFS.lang] || IDIOMAS_RB.en;
  // abajo, placas del mismo alto: los mods, el idioma (el globo y el código; el nombre entero en la bienvenida), tu nombre
  // y las redes (sólo el ícono)
  RB.el.querySelector('.rbAbajo').innerHTML = `<button class="rbChipG" data-rb="tienda">${glifo('caja')} ${nm ? `${nm} ${esc(T(nm === 1 ? 'modAct1' : 'modsAct'))}` : 'Sandbox'}</button>
    <button class="rbChipG" data-rb="idioma" title="${esc(I[0])}">${glifo('mundo')} ${esc(I[1])}</button>
    <label class="rbChipG">${glifo('persona')} <input id="rbNombre" maxlength="16" spellcheck="false"></label>
    ${RED_SOCIAL.map(([n, u, ic]) => `<button class="rbChipG rbRed" data-rb="red" data-url="${u}" title="${n}" aria-label="${n}">${ic}</button>`).join('')}`;
  const inp = RB.el.querySelector('#rbNombre'); inp.value = PREFS.nombre || '';
  inp.oninput = () => nombrePoner(inp.value);
  // la versión (JXMod 3.0) y el día del armado; tocándola o con el mouse encima, también la hora
  const ver = RB.el.querySelector('.rbVer'); ver.innerHTML = `JXMod <b>${esc(VERSION_RB)}</b> <i>${esc(ARMADO_RB.split(' ')[0])}</i>`; ver.title = `JXMod ${VERSION_RB} · ${ARMADO_RB}`;
  if (typeof cuentaPintar === 'function') cuentaPintar();   // (el chip de la cuenta de Google)
  if (typeof socGlobito === 'function') socGlobito();   // (lo nuevo de lo social: mensajes y solicitudes)
  inicioEncajar();
}
// la lista entre el logo y los botones de abajo, sin pisarse (en un celular apaisado de 360 de alto la lista entera no
// entraba y «Salir» quedaba debajo de los chips): si no entra, las letras y los espacios se achican juntos (--rbK) hasta
// donde se lee bien (14 px); si ni así entra, la lista se desliza. Con el tamaño del diseño, en una pantalla alta no
// cambia nada. Medido con offsetTop/offsetHeight: con la pantalla girada por el juego, getBoundingClientRect no sirve
function inicioEncajar() {
  const el = RB.el; if (!el || el.classList.contains('oc')) return;
  const L = el.querySelector('.rbLista'), logo = el.querySelector('.rbLogo'), ab = el.querySelector('.rbAbajo'); if (!L || !logo || !ab || L.classList.contains('oc')) return;
  const H = el.clientHeight || VH(), gap = Math.max(8, H * 0.025);
  const arriba = logo.offsetTop + logo.offsetHeight + gap, abajo = (ab.offsetHeight ? ab.offsetTop : H) - gap, lugar = Math.max(60, abajo - arriba);
  el.style.setProperty('--rbK', '1'); L.style.top = arriba + 'px'; L.style.maxHeight = ''; L.classList.remove('rbDesliza');
  const alto = L.offsetHeight;
  if (alto > lugar) {
    const it = L.querySelector('.rbIt'), f0 = it ? parseFloat(getComputedStyle(it).fontSize) || 16 : 16, kMin = Math.min(1, 14 / f0);
    // (un poco menos de lo justo: los altos se redondean a píxeles enteros y por medio píxel la lista se deslizaba)
    let k = Math.max(kMin, 0.985 * lugar / alto); el.style.setProperty('--rbK', k.toFixed(3));
    for (let i = 0; i < 5 && L.offsetHeight > lugar && k > kMin; i++) { k = Math.max(kMin, 0.985 * k * lugar / L.offsetHeight); el.style.setProperty('--rbK', k.toFixed(3)); }
    if (L.offsetHeight > lugar + 1) { L.style.maxHeight = lugar + 'px'; L.classList.add('rbDesliza'); }
  }
  // (centrada en el lugar que queda, si sobra: no pegada al logo con un hueco grande abajo)
  const sobra = lugar - L.offsetHeight; if (sobra > gap * 2) L.style.top = (arriba + Math.min(sobra / 2, H * 0.04)) + 'px';
}
addEventListener('resize', () => setTimeout(inicioEncajar, 60));
function nombrePoner(v) { PREFS.nombre = limpioNombre(v); guardarPrefs(); const nick = nodo('Main/MainMenu/UpPanel/NickNameInputField'); if (nick && nick.inp) nick.inp.value = PREFS.nombre; }
function inicioFondoPasar() {
  const capas = RB.el.querySelectorAll('.rbBg'), lista = FONDOS_RB.length ? FONDOS_RB : MAPAS.map((m) => icono(MAPA_ICONO[m]));
  const sig = capas[RB.fondo % 2 ? 0 : 1], act = capas[RB.fondo % 2];
  sig.style.backgroundImage = `url(${lista[RB.fondo % lista.length]})`; sig.classList.add('on'); act.classList.remove('on'); RB.fondo++;
}
function inicioPanel(p) {
  RB.panel = p; const P = RB.el.querySelector('.rbPan');
  for (const s of ['.rbLista', '.rbLogo', '.rbAbajo']) RB.el.querySelector(s).classList.toggle('oc', !!p);
  if (!p) requestAnimationFrame(inicioEncajar);
  // (crear un mod y publicar una construcción se abren desde la tienda: llevan su mismo estilo)
  P.classList.toggle('oc', !p); P.className = 'rbPan' + (p ? ' rbPan_' + p + (p === 'pubmod' || p === 'pubmapa' ? ' rbPan_tienda tiForm' : '') : ' oc');
  // (la versión de abajo a la derecha se asomaba por debajo del panel de la tienda, que llega casi hasta el borde)
  RB.el.querySelector('.rbVer').classList.toggle('oc', P.classList.contains('rbPan_tienda'));
  // (el personaje en 3D sólo en personajes: en el resto, el fondo de siempre)
  if (p !== 'personajes') { RB.el.classList.remove('rb3d'); menuLobby(false); MENU.caja = null; }
  if (p !== 'multi' && typeof mpClaveNo === 'function') mpClaveNo();
  if (!p) return;
  if (p === 'multi') return panelMulti(P);
  if (p === 'lan' && typeof panelLan === 'function') return panelLan(P);   // (partida en la red local: lan.js)
  if (p === 'social' && typeof panelSocial === 'function') return panelSocial(P);
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
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="${RB.creaVuelve ? 'tienda:mapa' : 'volver'}">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span><button class="rbBtnG" data-rb="creaNuevo">${glifo('martillo')} ${esc(T('cr.empezar'))}</button></div>`;
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
// (3.0) el elegido en grande a la izquierda: la foto del juego de ese mapa (la de la pantalla de carga, si tiene; si no,
// su ícono), de qué grupo es y quién lo hizo; los grupos como pestañas arriba y las tarjetas al costado. Elegir otro
// vuelve a armar el panel: la grilla queda donde estaba (antes saltaba arriba y había que buscar de nuevo)
function panelNueva(P) {
  const coms = mapasCom(), cats = [['todos', [...MAPAS, ...MAPAS_RB]], ['tierra', ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2']], ['espacio', ['Mars', 'Space', 'RB_Luna']], ['rezobox', MAPAS_RB.filter((m) => !MAPAS_GMOD.includes(m))], ['gmod', MAPAS_GMOD], ['comunidad', coms]];
  const cat = cats.find((c) => c[0] === RB.cat) || cats[0], nm = modsTodos().filter((m) => PREFS.mods[m.id]).length;
  const tarjeta = (m) => typeof m === 'string'
    ? `<div class="rbMapaG${m === RB.mapa && !RB.mapaCom ? ' sel' : ''}" data-rb="mapa:${m}"><div class="rbFoto" style="background-image:url(${icono(MAPA_ICONO[m])})"></div><b>${esc(mapaNom(m))}</b></div>`
    : `<div class="rbMapaG${RB.mapaCom === m.id ? ' sel' : ''}" data-rb="mapacom:${esc(m.id)}"><div class="rbFoto" style="background-image:url(${m.foto ? esc(m.foto) : icono(MAPA_ICONO[m.base])})"></div><b>${esc(nombreDe(m))}</b><small>${m.oficial ? `<b class="rbOf">${esc(T('oficial'))}</b>` : `${esc(T('por'))} ${esc(m.autor)}`}</small></div>`;
  const mc = RB.mapaCom && mapaDe(RB.mapaCom), sel = mc ? nombreDe(mc) : mapaNom(RB.mapa);
  const C = window.__carga, fotoCarga = !mc && C && C.foto && typeof FONDO_MAPA !== 'undefined' && FONDO_MAPA[RB.mapa] ? C.foto(FONDO_MAPA[RB.mapa]) : '';
  const foto = fotoCarga || (mc ? mc.foto || icono(MAPA_ICONO[mc.base]) : icono(MAPA_ICONO[RB.mapa]));
  const grupo = mc ? 'comunidad' : (cats.slice(1, -1).find((c) => c[1].includes(RB.mapa)) || cats[0])[0];
  const quien = mc ? (mc.oficial ? T('oficial') : `${T('por')} ${mc.autor}`) : MAPAS_GMOD.includes(RB.mapa) ? "Garry's Mod" : 'JXMod';
  const g0 = P.querySelector('.rbGrid[data-nv]'), desliz = g0 && g0.dataset.nv === cat[0] ? g0.scrollTop : 0;
  const modos = typeof gmmElegibles === 'function' ? gmmElegibles() : [];   // (los modos de juego de los addons de GMod)
  P.innerHTML = `<div class="rbPanCab">${esc(T('m.nueva'))}<small>${esc(sel)}</small></div>
    <div class="rbCats">${cats.map(([k, l]) => `<button class="rbCat${k === cat[0] ? ' sel' : ''}" data-rb="cat:${k}">${esc(T('c.' + k))}<em>${l.length}</em></button>`).join('')}</div>
    <div class="rbPanCuerpo"><div class="nvHero"><div class="nvFoto" style="background-image:url(${esc(foto)})"></div><div class="nvInfo"><small>${esc(T('c.' + grupo))}</small><b dir="auto">${esc(sel)}</b><span dir="auto">${esc(quien)}</span></div></div>
    <div class="rbGrid" data-nv="${cat[0]}">${cat[1].map(tarjeta).join('') || `<div class="rbVacio">${esc(T('sinRes'))} · <a data-rb="tienda:mapa">${esc(T('m.tienda'))}</a></div>`}</div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button>
      <label class="rbCampo">${esc(T('hora'))} <select id="rbHora">${['normal', 'dia', 'tarde', 'noche', 'ciclo'].map((k) => `<option value="${k}"${RB.hora === k ? ' selected' : ''}>${esc(T('h.' + k))}</option>`).join('')}</select></label>
      ${modos.length ? `<label class="rbCampo">${esc(T('gm.modo'))} <select id="rbModoJ">${[['auto', T('gm.modoAuto')], ['sandbox', 'Sandbox'], ...modos.map((M) => [M.n, M.titulo])].map(([k, l]) => `<option value="${esc(k)}"${GMM.elegido === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
      <button class="rbBtnGris nvMods" data-rb="tienda" data-n="${nm || ''}" title="${esc(nm ? `${nm} ${T(nm === 1 ? 'modAct1' : 'modsAct')}` : T('sinMods'))}">${icoHTML('ico:mod')} <span>${nm ? `${nm} ${esc(T(nm === 1 ? 'modAct1' : 'modsAct'))}` : esc(T('sinMods'))}</span></button>
      <span class="rbEsp"></span><span class="rbModo">${esc(T('unJugador'))}</span><button class="rbBtnG" data-rb="empezar">${glifo('jugar')} ${esc(T('empezar'))}</button></div>`;
  if (desliz) P.querySelector('.rbGrid').scrollTop = desliz;
  nvEncajar();
}
// el pie de Nueva partida en un renglón: si no entra (celular, un idioma largo, el selector de modos de GMod) se achica por
// pasos —sin «Un jugador»; los mods como ícono con el número; sin las palabras «Hora» y «Modo» (los selectores ya dicen lo
// elegido)— hasta que entra. Medido con offsetTop (con el juego girado, getBoundingClientRect da la pantalla girada)
function nvEncajar() {
  const pie = RB.el && !RB.el.classList.contains('oc') && RB.el.querySelector('.rbPan_nueva .rbPanPie'); if (!pie) return;
  const pasos = ['nvC1', 'nvC2', 'nvC3']; pie.classList.remove(...pasos);
  const dos = () => { const h = [...pie.children].filter((e) => e.offsetHeight && !e.classList.contains('rbEsp')); const t0 = Math.min(...h.map((e) => e.offsetTop)), b0 = Math.min(...h.map((e) => e.offsetTop + e.offsetHeight)); return h.some((e) => e.offsetTop >= b0 - 1 && e.offsetTop > t0 + 4); };
  for (const c of pasos) { if (!dos()) break; pie.classList.add(c); }
  // (en el último paso el selector queda angosto: «Automático (el del mapa)» pasa a «Automático», que entra entero)
  const o = pie.classList.contains('nvC3') && pie.querySelector('#rbModoJ option[value=auto]'); if (o) o.textContent = o.textContent.replace(/\s*[(（].*[)）]\s*$/, '');
}
addEventListener('resize', () => setTimeout(() => { if (RB.panel === 'nueva') nvEncajar(); }, 80));
// ---------- tienda: Mods y Mapas (explorar en el servidor o ver los instalados) ----------
// (el concepto de GOLDEN en el Discord: «Mejor interfaz en el apartado de mods»). Panel oscuro con el amarillo de acento:
// arriba el título, las pestañas (la elegida en amarillo) y las acciones de la pestaña; a la izquierda las categorías;
// el buscador, el orden y Explorar/Instalados arriba de la grilla; tarjetas con la imagen, el nombre, una línea de datos
// y el botón a lo ancho (amarillo: lo que se puede hacer; verde con contorno: ya está). Tocar la tarjeta abre la ficha.
// Lo usa también la pestaña GMod (gmod_tienda.js). o: { acc (las acciones de arriba a la derecha), ph (el buscador),
// orden ([valor, texto]), ordenSel, cats ([valor, texto]; la primera, «Todas»), lado (debajo de las categorías, fijo), nota
// (arriba de la grilla, se va con ella al deslizar), pie (lo de más en el pie, después de habilitar/deshabilitar) }
function tiendaMarco(P, o) {
  const S = RB.t, tab = (k, ic, t) => `<button class="rbTab${S.tab === k ? ' sel' : ''}" data-rb="tab:${k}" title="${esc(T(t))}">${ic}<span>${esc(T(t))}</span></button>`;
  // (cambiar de categoría vuelve a armar el panel: la lista de categorías queda donde estaba —en el celular se desliza—)
  const lado0 = P.querySelector('.tiCats'), desliz = lado0 && lado0.dataset.tab === S.tab ? lado0.scrollTop : 0;
  P.innerHTML = `<div class="rbPanCab tiCab"><b class="tiTit">${esc(T('m.tienda'))}</b>
      <span class="rbTabs tiTabs">${tab('mod', icoHTML('ico:mod'), 't.mods')}${tab('mapa', glifo('mapa'), 't.mapas')}${tab('anim', icoHTML('ico:animacion'), 't.anims')}${typeof GM_ICO !== 'undefined' ? tab('gmod', `<img class="rbGmIco" src="${GM_ICO}" alt="">`, 't.gmod') : ''}</span>
      <span class="rbEsp"></span><span class="tiAcc">${o.acc}</span></div>
    <div class="tiCuerpo"><nav class="tiLado"><div class="tiLadoTit">${esc(T('ti.cats'))}</div>
        <div class="tiCats" data-tab="${S.tab}">${o.cats.map(([k, t]) => `<button class="rbEtq tiCat${(S.etq || '') === k ? ' sel' : ''}" data-rb="etq:${esc(k)}">${esc(t)}</button>`).join('')}</div>${o.lado || ''}</nav>
      <div class="tiMain"><div class="rbBarra"><label class="tiBus">${glifo('buscar')}<input id="rbBuscar" type="search" placeholder="${esc(o.ph)}" value="${esc(S.q)}"></label>
          <select id="rbOrden">${o.orden.map(([k, t]) => `<option value="${esc(k)}"${o.ordenSel === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <span class="rbSeg"><button class="${S.vista === 'explorar' ? 'sel' : ''}" data-rb="vista:explorar">${esc(T('v.tienda'))}</button><button class="${S.vista === 'instalados' ? 'sel' : ''}" data-rb="vista:instalados">${esc(T('v.instalados'))}</button></span></div>
        <div class="tiDesliza">${o.nota || ''}<div class="rbGrid rbTiendaG"></div></div></div></div>
    <div class="rbPanPie"><button class="rbBtnGris tiVolver" data-rb="volver" title="${esc(T('volver'))}">${glifo('atras')}<span>${esc(T('volver'))}</span></button><span class="rbHab"></span>${o.pie || ''}<span class="rbEsp"></span><span class="rbTotal"></span><button class="rbBtnGris tiMas" data-rb="mas" aria-label="+">${glifo('mas3')}</button>
      <button class="rbBtnG tiNueva" data-rb="nueva"><span class="tiNuevaL">${esc(T('m.nueva'))}</span><span class="tiNuevaC">${esc(T('ti.nuevaC'))}</span>${glifo('jugar')}</button></div>`;
  if (desliz) P.querySelector('.tiCats').scrollTop = desliz;
  S.deslizA = null; S.grillaEn = 0;
  // (las tarjetas son <div> con botón adentro: con el teclado, Enter o espacio la abren como un clic)
  P.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('tiCard')) { e.preventDefault(); e.target.click(); } };
}
function panelTienda(P) {
  if (RB.t.tab === 'gmod' && typeof gmTiendaPanel === 'function') return gmTiendaPanel(P);
  const S = RB.t, mods = S.tab === 'mod', anims = S.tab === 'anim';
  const etqs = anims ? CATS_ANIM_RB : ETIQUETAS_RB, etqNom = (e) => T(anims ? 'emo.' + e : 'e.' + e);
  // «Subir archivo» en grande y abajo, chiquito, qué archivos (los mismos de siempre: el juego se fija qué es cada uno)
  const subir = T('p.archivo').replace(/\s*[(（].*$/, '');
  tiendaMarco(P, {
    acc: `<button class="rbBtnG tiPri" data-rb="${mods ? 'pubmod' : anims ? 'crearanim' : 'pubmapa'}" title="${esc(T(mods ? 'p.mod' : anims ? 'emo.crear' : 'p.mapa'))}">${glifo('mas')}<span>${esc(T(mods ? 'p.mod' : anims ? 'emo.crear' : 'p.mapa'))}</span></button>
      <label class="rbBtnGris tiSubir" title="${esc(T('p.archivo'))}">${glifo('subir')}<span><b>${esc(subir)}</b><small>${anims ? '.rbanim' : '.rbmod / .rbmapa'}</small></span><input type="file" id="rbArchivo" accept=".rbmod,.rbmapa,.rbanim,.json" hidden></label>`,
    ph: T('buscar'), orden: ['pop', 'nuevo', 'desc'].map((k) => [k, T('o.' + k)]), ordenSel: S.orden,
    cats: [['', T('e.todas')], ...etqs.map((e) => [e, etqNom(e)])],
  });
  tiendaCargar(true);
}
// «Equipar» un emote desde la tienda: va a la ruleta de emotes (ruleta.js). El de la tienda con su nombre de emote: los
// del juego ya lo traen («rb:…»); los de la gente, «u:» + el suyo
const emoDeTienda = (id) => (/^rb:/.test(id) ? id : 'u:' + id);
// si hay un lugar vacío, ahí; si la ruleta está llena, entra primero y sale el del último lugar (así, equipando varios
// seguidos quedan todos y no se pisan entre ellos). Devuelve el que salió, si salió alguno
function emoEquipar(id, on) {
  if (typeof rulSlots !== 'function') return null;
  const L = rulSlots(), eid = emoDeTienda(id), i = L.indexOf(eid); let sale = null;
  if (!on) { if (i < 0) return null; L[i] = null; }
  else { if (i >= 0) return null; const j = L.indexOf(null); if (j >= 0) L[j] = eid; else { sale = L.pop(); L.unshift(eid); } }
  PREFS.ruleta = L; guardarPrefs(); return sale;
}
// una tarjeta de la grilla. o: { id, img, nombre, meta (la línea de datos, HTML), btn (el botón de abajo, HTML), cls }
function tiTarjeta(o) {
  return `<div class="rbTile tiCard${o.cls ? ' ' + o.cls : ''}" data-rb="ver:${esc(o.id)}" role="button" tabindex="0"><span class="rbTileIco">${o.img}</span><b dir="auto" title="${esc(o.nombre)}">${esc(o.nombre)}</b>${o.meta ? `<small class="gmTileD tiMeta">${o.meta}</small>` : ''}${o.btn}</div>`;
}
// el botón a lo ancho de la tarjeta. tipo: 'si' (amarillo: instalar, activar, jugar), 'ok' (verde con contorno: ya está;
// abre la ficha), 'va' (bajando, con la barra de avance)
const tiBtn = (tipo, accion, ico, txt, extra) => `<button class="tiBtn tiBtn_${tipo}" data-rb="${esc(accion)}"${extra || ''}>${ico}<span>${esc(txt)}</span></button>`;
// la ficha de uno (todo lo que es y los botones), con el mismo estilo. o: { cls, img, titulo, meta, chips, avisos, acc,
// extra (debajo de los botones), desc }. Primero lo que se hace (los botones) y después la descripción; arriba de la
// imagen, en su columna, el botón para volver a la lista (dice a cuál: «Mods», «Mapas»…; el «Volver» del pie sale del
// panel): en el celular acostado los botones se ven sin deslizar
function tiFicha(o) {
  const lista = T({ mod: 't.mods', mapa: 't.mapas', anim: 't.anims', gmod: 't.gmod' }[RB.t.tab] || 'volver');
  return `<div class="rbFicha tiFicha${o.cls || ''}"><div class="rbFichaCuerpo"><div class="tiFichaIzq"><button class="rbBtnGris rbFichaX" data-rb="fichaNo" title="${esc(T('volver'))}">${glifo('atras')}<span>${esc(lista)}</span></button><div class="rbFichaIco">${o.img}</div></div>
      <div class="rbFichaInfo"><h3 dir="auto">${esc(o.titulo)}</h3>${o.meta ? `<small dir="auto">${o.meta}</small>` : ''}${o.chips ? `<span class="rbEtqsC">${o.chips}</span>` : ''}${o.avisos || ''}
        <div class="rbFichaAcc">${o.acc}</div>${o.extra || ''}<p dir="auto">${o.desc || ''}</p></div></div></div>`;
}
// con la ficha abierta, sin las categorías, el buscador ni la nota (la ficha usa todo el ancho)
function tiFichaModo(on) {
  const P = RB.el && RB.el.querySelector('.rbPan'); if (!P) return;
  // (al abrir una ficha se anota por dónde iba la grilla: al volver queda ahí, no arriba de todo; la ficha, desde arriba)
  const D = P.querySelector('.tiDesliza'), antes = P.classList.contains('tiConFicha');
  if (D && !!on !== antes) { if (on) RB.t.grillaEn = D.scrollTop; RB.t.deslizA = on ? 0 : RB.t.grillaEn || 0; }
  P.classList.toggle('tiConFicha', !!on);
  for (const s of ['.rbBarra', '.tiLado']) { const e = P.querySelector(s); if (e) e.classList.toggle('oc', !!on); }
}
// arriba y el pie, en un renglón: si no entran (celular, un idioma largo) se achican por pasos hasta que entran.
// Arriba: tiC1 sin el título, tiC2 «Subir archivo» sólo con el ícono, tiC3 las pestañas no elegidas sólo con el ícono,
// tiC4 la acción de la pestaña sólo con el ícono. El pie: tiP1 sin el total, tiP2 «Volver» sólo con la flecha,
// tiP3 «Nueva partida» en vez de «Empezar partida nueva», tiP4 «Borrar varios» sólo con el tacho, tiP5 habilitar y
// deshabilitar sólo con el ícono. Medido con scrollWidth (con el juego girado, getBoundingClientRect da la pantalla girada)
function tiEncajar() {
  const P = RB.el && !RB.el.classList.contains('oc') && RB.panel === 'tienda' && RB.el.querySelector('.rbPan_tienda'); if (!P || !P.offsetWidth) return;
  // (lo llaman al terminar de dibujar: la grilla, donde quedó pendiente —al abrir o cerrar una ficha, tiFichaModo—)
  if (RB.t.deslizA != null) { const D = P.querySelector('.tiDesliza'); if (D) D.scrollTop = RB.t.deslizA; RB.t.deslizA = null; }
  const pasos = (el, cls, sub) => {
    if (!el) return; el.classList.remove(...cls);
    const sobra = () => el.scrollWidth > el.clientWidth + 1 || (sub && sub.scrollWidth > sub.clientWidth + 1);
    for (const c of cls) { if (!sobra()) break; el.classList.add(c); }
  };
  const cab = P.querySelector('.tiCab'); pasos(cab, ['tiC1', 'tiC2', 'tiC3', 'tiC4'], cab && cab.querySelector('.tiTabs'));
  pasos(P.querySelector('.rbPanPie'), ['tiP1', 'tiP2', 'tiP3', 'tiP4', 'tiP5']);
}
addEventListener('resize', () => setTimeout(() => { if (RB.panel === 'tienda') tiEncajar(); }, 80));
function tiendaCargar(desdeCero) {
  if (RB.t.tab === 'gmod' && typeof gmTiendaCargar === 'function') return gmTiendaCargar(desdeCero);
  const S = RB.t, n = ++S.n; if (desdeCero) { S.p = 0; S.items = []; }
  if (S.vista === 'instalados') {
    const q = S.q.toLowerCase(), lista = S.tab === 'mod' ? modsTodos() : S.tab === 'anim' ? [...animsOficiales(), ...Object.values(INST.anims)] : mapasCom();
    S.items = lista.filter((m) => (!q || (nombreDe(m) + ' ' + m.autor + ' ' + descDe(m)).toLowerCase().includes(q)) && (!S.etq || (S.tab === 'anim' ? m.cat === S.etq : (m.etiquetas || []).includes(S.etq))));
    if (S.tab === 'mod') S.items.sort((a, b) => (PREFS.mods[b.id] ? 1 : 0) - (PREFS.mods[a.id] ? 1 : 0) || porNombre(a, b)); else if (S.tab !== 'anim') S.items.sort((a, b) => (b.oficial ? 1 : 0) - (a.oficial ? 1 : 0) || porNombre(a, b));
    S.total = S.items.length; S.error = false; return tiendaDibujar();
  }
  S.cargando = true; S.error = false; tiendaDibujar();
  // (en Emotes, primero los del juego: ya están incluidos; en Mods, los oficiales: se instalan como los de la gente)
  if (S.tab === 'anim' && !S.p) { const q = S.q.toLowerCase(); S.items = animsOficiales().filter((m) => (!q || nombreDe(m).toLowerCase().includes(q)) && (!S.etq || m.cat === S.etq)); }
  if (S.tab === 'mod' && !S.p) { const q = S.q.toLowerCase(); S.items = OFICIALES.filter((m) => (!q || (nombreDe(m) + ' ' + descDe(m)).toLowerCase().includes(q)) && (!S.etq || (m.etiquetas || []).includes(S.etq))).sort((a, b) => ofOrden(a) - ofOrden(b)); }
  fetch(`${TIENDA_URL}lista?tipo=${S.tab}&q=${encodeURIComponent(S.q)}&${S.tab === 'anim' ? 'cat' : 'etq'}=${S.etq}&orden=${S.orden}&p=${S.p}`).then((r) => r.json()).then((d) => {
    if (n !== S.n) return; S.items = S.items.concat((d.items || []).map((x) => (S.tab === 'anim' ? Object.assign(x, { cat: x.base }) : x))); S.total = (d.total || 0) + (S.tab !== 'mapa' ? S.items.filter((x) => x.oficial).length : 0); S.cargando = false; tiendaDibujar();
  }).catch(() => { if (n !== S.n) return; S.cargando = false; S.error = !S.items.length; S.total = S.items.length; tiendaDibujar(); });
}
// la tienda en tarjetas, por secciones (para que no agobie): el botón de cada una hace lo principal (instalar, activar,
// jugar) y tocar la tarjeta abre su ficha con todo y los botones
function tiendaDibujar() {
  if (RB.t.tab === 'gmod' && typeof gmTiendaDibujar === 'function') return gmTiendaDibujar();
  const S = RB.t, G = RB.el.querySelector('.rbTiendaG'); if (!G) return;
  const an = S.tab === 'anim', esMod = S.tab === 'mod', esMapa = S.tab === 'mapa';
  const inst = (it) => (esMod ? (it.oficial ? ofInstalado(it.id) : INST.mods[it.id]) : it.oficial || (an ? INST.anims[it.id] : INST.mapas[it.id]));
  const fijo = (it) => it.oficial && !esMod; // (los emotes del juego y la Mega rampa vienen incluidos)
  const activo = (it) => esMod && PREFS.mods[it.id] && modTipo(it) !== 'asset';
  // (en Emotes, «Equipar» lo pone en la ruleta de emotes —ruleta.js— y «Equipado» dice que ya está en uno de sus lugares)
  const rul = an && typeof rulSlots === 'function' ? rulSlots() : [], equipado = (it) => rul.includes(emoDeTienda(it.id));
  const img = (it) => (esMod ? icoHTML(it.icono) : an ? (it.icono || it.foto ? `<img src="${esc(it.icono || it.foto)}" alt="">` : icoHTML('ico:animacion')) : `<img src="${esc(it.icono || it.foto || icono(MAPA_ICONO[it.base] || 'flatgrass'))}" alt="">`);
  const datos = (it) => (it.oficial ? `<b class="rbOf">${esc(T(an ? 'emo.incluido' : 'oficial'))}</b>` : `${esc(T('por'))} ${esc(it.autor)}${it.descargas != null ? ` · ${glifo('bajar')} ${it.descargas} · ${glifo('corazon')} ${it.likes}` : ''}${esMapa && it.base ? ` · ${esc(mapaNom(it.base))}` : ''}`)
    + (an && it.cat ? ` · ${esc(T('emo.' + it.cat))}` : '') + (esMod ? ` · ${esc(T(modTipo(it) === 'asset' ? 'mm.assets' : 'mm.juego'))}` : '');
  // (en Mapas, arriba «Mis mapas»: los que hiciste con el creador o publicaste —también en Explorar— y la tarjeta para
  // hacer uno nuevo desde cero)
  const q = S.q.toLowerCase(), mio = (m) => !!(m.creado || PUBLICADOS[m.id]);
  const mios = esMapa ? Object.values(INST.mapas).filter((m) => mio(m) && (!q || (nombreDe(m) + ' ' + m.autor + ' ' + descDe(m)).toLowerCase().includes(q)) && (!S.etq || (m.etiquetas || []).includes(S.etq))).sort(porNombre) : [];
  const resto = esMapa ? S.items.filter((x) => !mios.some((m) => m.id === x.id)) : S.items;
  const fin = S.cargando ? `<div class="rbVacio">${esc(T('cargando'))}</div>` : S.error ? `<div class="rbVacio">${esc(T('errRed'))}</div>` : !resto.length && (!esMapa || q || S.etq) ? `<div class="rbVacio">${esc(T('sinRes'))}</div>` : '';
  const it = S.ficha && (S.items.find((x) => x.id === S.ficha) || mios.find((x) => x.id === S.ficha));
  G.classList.toggle('rbFichaModo', !!it); tiFichaModo(!!it);
  if (it) {
    const ins = inst(it), act = activo(it), b = (cl, a, g, t) => `<button class="${cl}" data-rb="${a}:${esc(it.id)}">${glifo(g)} ${esc(T(t))}</button>`;
    G.innerHTML = tiFicha({ cls: act ? ' on' : esMod && ins && modTipo(it) !== 'asset' ? ' off' : '', img: img(it), titulo: nombreDe(it),
      meta: `${it.codigo ? '<b class="rbCod">&lt;/&gt;</b> ' : ''}${datos(it)}`, chips: (it.etiquetas || []).map((e) => `<i>${esc(T('e.' + e))}</i>`).join(''),
      avisos: esMod && ins && modTipo(it) !== 'asset' && !act ? `<p class="gmAviso rbOffAyuda">${glifo('prohibido')} ${esc(T('hab.offMod'))}</p>` : '',
      acc: (esMapa && ins ? b('rbBtnG rbFichaGrande', 'jugarcom', 'jugar', 'jugar') : '')
        + (ins ? '' : b('rbBtnG rbFichaGrande', 'instalar', 'bajar', 'instalar'))
        + (an && ins ? (equipado(it) ? `<span class="rbFichaIncl">${glifo('si')} ${esc(T('ti.equipado'))}</span>` + b('rbBtnGris', 'desequipar', 'no', 'ti.desequipar') : b('rbBtnG rbFichaGrande', 'equipar', 'mas', 'ti.equipar')) : '')
        + (esMapa && it.creado && INST.mapas[it.id] ? b('rbBtnGris', 'creaEditar', 'lapiz', 'emo.editar') : '')
        + (it.oficial ? '' : (it.descargas != null ? `<button class="rbBtnGris${LIKES[it.id] ? ' sel' : ''}" data-rb="like:${esc(it.id)}">${glifo('corazon')} ${esc(T('meGusta'))}</button>` + b('rbBtnGris', 'denunciar', 'bandera', 'denunciar') : '')
          + (ins ? b('rbBtnGris', 'exportar', 'bajar', 'exportar') : '') + (PUBLICADOS[it.id] ? b('rbBtnGris tiRojo', 'borrarpub', 'basura', 'quitar') : ''))
        + (ins && !fijo(it) ? b('rbBtnGris tiRojo', 'quitar', 'basura', 'quitar') : ''),
      desc: esc(descDe(it) || '') });
  } else {
    const tile = (x) => {
      const ins = inst(x), act = activo(x), asset = esMod && modTipo(x) === 'asset', off = esMod && ins && !act && !asset, id = x.id;
      // el botón: lo que se puede hacer en amarillo; lo que ya está, verde con contorno (abre la ficha: ahí se saca o se apaga)
      const btn = esMapa ? (ins ? tiBtn('si', 'jugarcom:' + id, glifo('jugar'), T('jugar')) : tiBtn('si', 'instalar:' + id, glifo('bajar'), T('instalar')))
        : !ins ? tiBtn('si', 'instalar:' + id, glifo('bajar'), T('instalar'))
        : an ? (equipado(x) ? tiBtn('ok', 'ver:' + id, `<i class="rbTileOn">${glifo('si')}</i>`, T('ti.equipado')) : tiBtn('si', 'equipar:' + id, glifo('mas'), T('ti.equipar')))
        : off ? tiBtn('si', 'habMod:' + id, `<i class="rbTileOff">${glifo('mas')}</i>`, T('ti.activar'))
        : act ? tiBtn('ok', 'ver:' + id, `<i class="rbTileOn">${glifo('si')}</i>`, T('ti.activado'))
        : tiBtn('ok', 'ver:' + id, `<i class="rbTileOk">${glifo('si')}</i>`, T('instalado'));
      // (la línea de datos: los de la gente, cuántos lo bajaron y los «me gusta»; tus mapas, sobre qué mapa están)
      const meta = x.oficial ? '' : esMapa && mio(x) && x.base ? `<i>${glifo('mapa')} ${esc(mapaNom(x.base))}</i>` : x.descargas != null ? `<i>${glifo('bajar')} ${x.descargas | 0}</i><i>${glifo('corazon')} ${x.likes | 0}</i>` : x.autor ? `<i>${glifo('persona')} ${esc(x.autor)}</i>` : '';
      return tiTarjeta({ id, img: img(x), nombre: nombreDe(x), meta, btn, cls: `${act ? 'on' : ''}${ins && !fijo(x) ? ' inst' : ''}${off ? ' off' : ''}${esMapa ? ' rbTileMapa' : ''}` });
    };
    const secc = (n, L, extra) => `<div class="rbSecc">${esc(n)}<em>${L.length}</em></div>` + L.map(tile).join('') + (extra || '');
    // secciones: en Mods, de jugar / los que ponen cosas / de la gente; en Mapas, los tuyos, oficiales y de la gente;
    // en Emotes (sin filtro), por categoría
    let grupos;
    if (esMod) grupos = [[T('mm.juego'), resto.filter((x) => x.oficial && modTipo(x) !== 'asset')], [T('mm.assets'), resto.filter((x) => x.oficial && modTipo(x) === 'asset')], [T('c.comunidad'), resto.filter((x) => !x.oficial)]];
    else if (an && !S.etq) { const m = new Map(); for (const x of resto) { const c = x.cat || 'otros'; if (!m.has(c)) m.set(c, []); m.get(c).push(x); } grupos = [...m].map(([c, L]) => [T('emo.' + c) !== 'emo.' + c ? T('emo.' + c) : c, L]); }
    else grupos = [[T('oficial'), resto.filter((x) => x.oficial)], [T('c.comunidad'), resto.filter((x) => !x.oficial)]];
    grupos = grupos.filter((g) => g[1].length);
    const nuevo = esMapa ? `<button class="tiNuevo" data-rb="crear:tienda"><i>${glifo('mas')}</i><b>${esc(T('ti.nuevoMapa'))}</b><small>${esc(T('ti.desdeCero'))}</small></button>` : '';
    G.innerHTML = (esMapa ? secc(T('cr.misMapas'), mios, nuevo) : '') + (grupos.length > 1 || esMapa ? grupos.map(([n, L]) => secc(n, L)).join('') : resto.map(tile).join('')) + fin;
  }
  const tot = RB.el.querySelector('.rbTotal'); if (tot) tot.textContent = S.total && !it ? `${S.items.length} / ${S.total}` : '';
  const mas = RB.el.querySelector('[data-rb=mas]'); if (mas) mas.style.display = !it && S.vista === 'explorar' && S.items.length < S.total ? '' : 'none';   // (sin ocupar lugar: en un celular chico el pie entra en un renglón)
  const hab = RB.el.querySelector('.rbHab');
  if (hab) { const ids = esMod && typeof habBotones === 'function' ? modsHabilitables() : []; hab.innerHTML = ids.length || (it && esMod) ? habBotones(it ? (ids.includes(it.id) ? it.id : null) : undefined, ids, (id) => !!PREFS.mods[id], 'Mod') : ''; }
  tiEncajar();
}
// los mods instalados que se pueden habilitar o deshabilitar (los que ponen cosas —radio, piano, props— están siempre)
const modsHabilitables = () => modsTodos().filter((m) => modTipo(m) !== 'asset').map((m) => m.id);
function modsHabilitar(ids, on) {
  for (const id of ids) { if (on) PREFS.mods[id] = true; else delete PREFS.mods[id]; }
  guardarPrefs(); inicioLista();
  // (si la tienda se abrió jugando solo, se aplica al toque, como desde el menú MOD)
  if (typeof smAplicar === 'function' && typeof JUEGO !== 'undefined' && JUEGO.estado === 'juego' && !SALA) try { smAplicar(false); } catch (e) {}
}
async function instalar(id) {
  const S = RB.t, of = OFICIALES.find((m) => m.id === id);
  // un oficial: viene con el juego, se instala al toque (y si cambia cómo jugás, queda prendido)
  if (of) { INST.of = INST.of || {}; INST.of[id] = true; if (modTipo(of) !== 'asset') PREFS.mods[id] = true; guardarPrefs(); guardarLS('rb_instalados', INST); menuAviso(T('instalado') + ': ' + nombreDe(of)); inicioLista(); return tiendaDibujar(); }
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
  return [...MAPAS_RB, ...MAPAS].map((m) => ({ m, L: leerLS('jx_save_' + m, []), foto: (() => { try { return localStorage.getItem('rb_foto_' + m) || null; } catch (e) { return null; } })() })).filter((c) => c.L.length);
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
  if (typeof gmTiendaAccion === 'function' && gmTiendaAccion(a, v)) return; // (la pestaña GMod de la tienda: gmod_tienda.js)
  const marcar = () => b.classList.toggle('sel');
  switch (a) {
    case 'nueva': return inicioPanel('nueva');
    case 'tienda': if (v) RB.t.tab = v; return inicioPanel('tienda');
    case 'volver': RB.t.sel = null; if (RB.desdeJuego === 'pausa' && typeof pjjVolverPausa === 'function') return pjjVolverPausa(); if (RB.desdeJuego && typeof gmbVolverAlJuego === 'function') return gmbVolverAlJuego(); inicioLista(); return inicioPanel(null);
    case 'tab': RB.t.tab = v; RB.t.etq = ''; RB.t.ficha = null; RB.t.sel = null; if (v !== 'gmod' && !['pop', 'nuevo', 'desc'].includes(RB.t.orden)) RB.t.orden = 'pop'; return inicioPanel('tienda');
    case 'vista': RB.t.vista = v; RB.t.ficha = null; return inicioPanel('tienda');
    case 'etq': RB.t.etq = v; RB.t.ficha = null; return inicioPanel('tienda');
    case 'ver': RB.t.ficha = v; return tiendaDibujar();   // (la ficha de uno: todo lo que es y los botones)
    case 'fichaNo': RB.t.ficha = null; return tiendaDibujar();
    case 'mas': RB.t.p++; return tiendaCargar(false);
    case 'instalar': return instalar(v);
    // (Emotes: a la ruleta de emotes o fuera de ella; avisa cuál salió si estaba llena)
    case 'equipar': case 'desequipar': { const on = a === 'equipar', it = RB.t.items.find((x) => x.id === v), n = it ? nombreDe(it) : v, sale = emoEquipar(v, on), s = sale && typeof rulInfo === 'function' && rulInfo(sale);
      menuAviso(T(on ? 'ti.enRuleta' : 'ti.fueraRuleta').replace('{n}', n) + (s ? ` (${T('ti.salio').replace('{m}', s.n)})` : '')); return tiendaDibujar(); }
    case 'quitar': if (RB.t.tab === 'mod') { delete INST.mods[v]; if (INST.of) delete INST.of[v]; delete PREFS.mods[v]; guardarPrefs(); inicioLista(); } else if (RB.t.tab === 'anim') { emoEquipar(v, false); delete INST.anims[v]; emoOlvidar('u:' + v); } else delete INST.mapas[v]; guardarLS('rb_instalados', INST); return RB.t.vista === 'instalados' ? tiendaCargar(true) : tiendaDibujar();
    case 'habMod': case 'desMod': { modsHabilitar([v], a === 'habMod'); const m = modsTodos().find((x) => x.id === v); menuAviso(`${m ? nombreDe(m) : v}: ${T(a === 'habMod' ? 'hab.on' : 'hab.off')}`); return tiendaDibujar(); }
    case 'habTodoMod': case 'desTodoMod': { const on = a === 'habTodoMod', L = modsHabilitables().filter((id) => !!PREFS.mods[id] !== on); modsHabilitar(L, on); menuAviso(T(on ? 'hab.okSi' : 'hab.okNo').replace('{n}', L.length)); return RB.t.vista === 'instalados' ? tiendaCargar(true) : tiendaDibujar(); }
    case 'act': PREFS.mods[v] = !PREFS.mods[v]; if (!PREFS.mods[v]) delete PREFS.mods[v]; guardarPrefs(); return tiendaDibujar();
    case 'like': if (LIKES[v]) return; LIKES[v] = 1; guardarLS('rb_likes', LIKES); fetch(TIENDA_URL + 'like/' + v, { method: 'POST' }).catch(() => {}); { const it = RB.t.items.find((x) => x.id === v); if (it) it.likes++; } return tiendaDibujar();
    case 'denunciar': if (!confirm(T('denunciar') + '?')) return; fetch(TIENDA_URL + 'denunciar/' + v, { method: 'POST' }).catch(() => {}); RB.t.items = RB.t.items.filter((x) => x.id !== v); RB.t.ficha = null; return tiendaDibujar();
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
      entrarConCarga(RB.mapaPartida ? nombreDe(RB.mapaPartida) : T('ld.solo'), RB.mapa, () => { inicioMostrar(false); return empezarPartida(RB.mapa); }); return;
    case 'crear': RB.creaVuelve = v === 'tienda'; return inicioPanel('crear');   // (desde «Nuevo mapa» de la tienda, Volver vuelve a la tienda)
    case 'creaBase': RB.creaBase = v; return inicioPanel('crear');
    case 'creaNuevo': return creadorEmpezar(RB.creaBase, null);
    case 'creaEditar': { const m = INST.mapas[v]; if (m) creadorEmpezar(m.base, m); return; }
    case 'opciones': abrirAjustes('principal'); return;
    case 'idioma': return inicioPanel('bienvenida');
    case 'lang': idiomaAplicar(v); inicioLista(); return inicioPanel('bienvenida');
    case 'bienvOK': PREFS.bienvenida = true; guardarPrefs(); inicioLista(); return inicioPanel(null);
    case 'red': return abrirRed(b.dataset.url);
    case 'salir': if (window.JXNativo && JXNativo.salir) { JXNativo.salir(); return; } if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); menuAviso(T('salirAviso'));
  }
}
// muestra el inicio arriba del menú real (que queda armado abajo); la primera vez, la bienvenida
function inicioMostrar(si) {
  if (si) {
    menuMostrar(true); if (!RB.el) inicioCrear(); idiomaAplicar(PREFS.lang); inicioLista(); inicioPanel(PREFS.bienvenida ? null : 'bienvenida');
    if (!RB.reloj) { inicioFondoPasar(); RB.reloj = setInterval(() => { if (!RB.el.classList.contains('oc')) inicioFondoPasar(); }, 9000); }
  }
  if (RB.el) RB.el.classList.toggle('oc', !si);
  if (si) requestAnimationFrame(() => { inicioEncajar(); tiEncajar(); });
  // (en la partida, con el menú abierto la HUD táctil no se ve: si no, se asoma por las partes transparentes del menú)
  document.body.classList.toggle('rbAbierto', !!si);
  if (!si && RB.el) { RB.el.classList.remove('rb3d'); menuLobby(false); MENU.caja = null; }
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
