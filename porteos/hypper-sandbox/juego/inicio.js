// ---------------- HypperX RezoBox: inicio con el aspecto del menú de Garry's Mod ----------------
// Fondo con escenas del juego que pasan solas, menú de texto, botoncitos abajo y paneles claros: bienvenida (idioma y
// nombre), Empezar partida nueva (mapas del juego y de la comunidad) y la tienda de Mods y mapas (buscar, filtrar,
// instalar, publicar). Los mods y mapas son sólo datos (formato.js), validados acá y en el servidor.
const RB = { el: null, panel: null, mapa: null, mapaCom: null, cat: 'todos', hora: 'normal', base: null, fondo: 0, reloj: 0,
  t: { tab: 'mod', vista: 'explorar', q: '', etq: '', orden: 'pop', p: 0, items: [], total: 0, cargando: false, error: false, n: 0 } };
const TIENDA_URL = 'https://rezobox-tienda.holasoyjuniors365.workers.dev/api/';
const MODS = {}; // efectos sumados de los mods activos en la partida (armas y reloj los leen)
const FONDOS_RB = [/*FONDOSRB*/]; // escenas armadas con cosas del juego (van con el paquete, no en el repo)
const LOGO_RB = (document.getElementById('rbLogoIntro') || {}).src || '';
const ICONOS_MOD = ['🧩', '🐉', '🌙', '🦘', '⚡', '♾️', '🛡️', '🐢', '💥', '🔥', '🚀', '👾', '🤖', '🦖', '🏎️', '🔫', '💣', '🧲', '🌪️', '❄️', '👑', '🎉'];
// los mods oficiales, en el mismo formato que los de la gente
const OFICIALES = [['goku', '🐉', ['personajes', 'diversion'], { skin: 'Goku', velocidad: 1.4, salto: 2.5 }], ['luna', '🌙', ['fisica'], { gravedad: 0.35 }],
  ['salto', '🦘', ['jugabilidad'], { salto: 4 }], ['veloz', '⚡', ['jugabilidad'], { velocidad: 1.8 }], ['balas', '♾️', ['armas'], { municionInfinita: true }],
  ['dios', '🛡️', ['jugabilidad'], { invencible: true }], ['lenta', '🐢', ['diversion'], { tiempo: 0.5 }], ['boom', '💥', ['armas', 'diversion'], { explosion: 2.5 }]]
  .map(([id, icono, etiquetas, efectos]) => Object.assign(validarRB({ formato: 'rezobox-mod', nombre: id + ' (RezoBox)', autor: 'RezoBox', icono, etiquetas, efectos }), { id, oficial: true }));
const leerLS = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || '') || def; } catch (e) { return def; } };
const INST = leerLS('rb_instalados', {}); INST.mods = INST.mods || {}; INST.mapas = INST.mapas || {};
const PUBLICADOS = leerLS('rb_publicados', {}), LIKES = leerLS('rb_likes', {});
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { menuAviso('No hay lugar para guardar'); return false; } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const modsTodos = () => [...OFICIALES, ...Object.values(INST.mods)];
const nombreDe = (m) => (m.oficial ? T(m.id + '.n') : m.nombre), descDe = (m) => (m.oficial ? T(m.id + '.d') : m.descripcion);
const icoHTML = (v) => (/^data:image\//.test(v || '') ? `<img src="${esc(v)}" alt="">` : esc(v || '🧩'));
const mapaNom = (m) => T('m.' + m);

function inicioCrear() {
  const el = document.createElement('div'); el.id = 'rbInicio'; el.className = 'oc';
  el.innerHTML = `<div class="rbBg"></div><div class="rbBg"></div><div class="rbSombra"></div>
    <img class="rbLogo" alt="HypperX RezoBox" src="${LOGO_RB}"><div class="rbLista"></div>
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
  RB.mapa = MAPAS.includes(PREFS.mapa) ? PREFS.mapa : 'FlatGrass';
  overlay('NicknamePanel', false); PREFS.nombreOk = true; guardarPrefs();
  // en el menú clásico: el logo y el nombre del juego pasan a ser los nuestros, y un botón para volver
  for (const n of Object.values(MENU.por || {})) {
    if (n.txt && /hypper/i.test(n.txt.t || '')) uiTextoPoner(n, n.txt.t.replace(/hypper( sandbox)?/ig, 'RezoBox'));
    if (!/logo/i.test(n.n || '') || !n.el) continue;
    const i = n.el.querySelector('.im'); if (!i) continue;
    i.style.background = `url(${LOGO_RB}) center/contain no-repeat`; i.style.removeProperty('-webkit-mask'); i.style.removeProperty('mask'); i.style.opacity = 1;
  }
  if (MENU.el && !document.getElementById('rbVolver')) {
    const v = document.createElement('div'); v.id = 'rbVolver'; v.textContent = '◀ RezoBox';
    v.onclick = (e) => { e.stopPropagation(); audioIniciar(); inicioMostrar(true); };
    MENU.el.appendChild(v);
  }
}
// menú de texto como el de GMod: grupos separados por un espacio
function inicioLista() {
  RB.el.dir = PREFS.lang === 'ar' ? 'rtl' : 'ltr';
  const G = [['nueva', 'multi'], ['tienda', 'personajes', 'opciones'], ['clasico', 'salir']];
  RB.el.querySelector('.rbLista').innerHTML = G.map((g) => g.map((k) => `<button class="rbIt" data-rb="${k}">${esc(T('m.' + k))}</button>`).join('')).join('<div class="rbSep"></div>');
  const nm = modsTodos().filter((m) => PREFS.mods[m.id]).length, I = IDIOMAS_RB[PREFS.lang] || IDIOMAS_RB.en;
  RB.el.querySelector('.rbAbajo').innerHTML = `<button class="rbChipG" data-rb="tienda">🧩 ${nm ? `${nm} ${esc(T('modsAct'))}` : 'Sandbox'}</button>
    <button class="rbChipG" data-rb="idioma">${I[1]} ${esc(I[0])}</button>
    <label class="rbChipG">👤 <input id="rbNombre" maxlength="16" spellcheck="false"></label>`;
  const inp = RB.el.querySelector('#rbNombre'); inp.value = PREFS.nombre || '';
  inp.oninput = () => nombrePoner(inp.value);
  RB.el.querySelector('.rbVer').textContent = `HypperX RezoBox ${VERSION_JUEGO}`;
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
  if (!p) return;
  if (p === 'bienvenida') return panelBienvenida(P);
  if (p === 'nueva') return panelNueva(P);
  if (p === 'tienda') return panelTienda(P);
  if (p === 'pubmod') return panelPubMod(P);
  if (p === 'pubmapa') return panelPubMapa(P);
}
// ---------- bienvenida: idioma y nombre (la primera vez, y desde la banderita) ----------
function panelBienvenida(P) {
  P.innerHTML = `<div class="rbBienv"><img class="rbBienvLogo" alt="" src="${LOGO_RB}"><h2>${esc(T('b.tit'))}</h2><div class="rbSub">${esc(T('b.idioma'))}</div>
    <div class="rbIdiomas">${Object.entries(IDIOMAS_RB).map(([k, [n, b]]) => `<button class="rbIdi${k === PREFS.lang ? ' sel' : ''}" data-rb="lang:${k}"><i>${b}</i><span dir="auto">${esc(n)}</span></button>`).join('')}</div>
    <label class="rbCampo rbNomB">${esc(T('b.nombre'))} <input id="rbNombreB" maxlength="16" spellcheck="false"></label>
    <button class="rbBtnG" data-rb="bienvOK">${esc(T('b.seguir'))} ▶</button></div>`;
  const i = P.querySelector('#rbNombreB'); i.value = PREFS.nombre || ''; i.oninput = () => nombrePoner(i.value);
}
// ---------- Empezar partida nueva ----------
function panelNueva(P) {
  const coms = Object.values(INST.mapas), cats = [['todos', MAPAS], ['tierra', ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2']], ['espacio', ['Mars', 'Space']], ['comunidad', coms]];
  const cat = cats.find((c) => c[0] === RB.cat) || cats[0], nm = modsTodos().filter((m) => PREFS.mods[m.id]).length;
  const tarjeta = (m) => typeof m === 'string'
    ? `<div class="rbMapaG${m === RB.mapa && !RB.mapaCom ? ' sel' : ''}" data-rb="mapa:${m}"><div class="rbFoto" style="background-image:url(${icono(MAPA_ICONO[m])})"></div><b>${esc(mapaNom(m))}</b></div>`
    : `<div class="rbMapaG${RB.mapaCom === m.id ? ' sel' : ''}" data-rb="mapacom:${esc(m.id)}"><div class="rbFoto" style="background-image:url(${m.foto ? esc(m.foto) : icono(MAPA_ICONO[m.base])})"></div><b>${esc(m.nombre)}</b><small>${esc(T('por'))} ${esc(m.autor)}</small></div>`;
  const sel = RB.mapaCom && INST.mapas[RB.mapaCom] ? INST.mapas[RB.mapaCom].nombre : mapaNom(RB.mapa);
  P.innerHTML = `<div class="rbPanCab">${esc(T('m.nueva'))}<small>${esc(sel)}</small></div>
    <div class="rbPanCuerpo"><div class="rbCats">${cats.map(([k, l]) => `<button class="rbCat${k === cat[0] ? ' sel' : ''}" data-rb="cat:${k}">${esc(T('c.' + k))}<em>${l.length}</em></button>`).join('')}</div>
    <div class="rbGrid">${cat[1].map(tarjeta).join('') || `<div class="rbVacio">${esc(T('sinRes'))} · <a data-rb="tienda:mapa">${esc(T('m.tienda'))}</a></div>`}</div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">◀ ${esc(T('volver'))}</button>
      <label class="rbCampo">${esc(T('hora'))} <select id="rbHora">${['normal', 'dia', 'tarde', 'noche', 'ciclo'].map((k) => `<option value="${k}"${RB.hora === k ? ' selected' : ''}>${esc(T('h.' + k))}</option>`).join('')}</select></label>
      <button class="rbBtnGris" data-rb="tienda">🧩 ${nm ? `${nm} ${esc(T('modsAct'))}` : esc(T('sinMods'))}</button>
      <span class="rbEsp"></span><span class="rbModo">${esc(T('unJugador'))}</span><button class="rbBtnG" data-rb="empezar">${esc(T('empezar'))}</button></div>`;
}
// ---------- tienda: Mods y Mapas (explorar en el servidor o ver los instalados) ----------
function panelTienda(P) {
  const S = RB.t, mods = S.tab === 'mod';
  P.innerHTML = `<div class="rbPanCab">${esc(T('m.tienda'))}
      <span class="rbTabs"><button class="rbTab${mods ? ' sel' : ''}" data-rb="tab:mod">🧩 ${esc(T('t.mods'))}</button><button class="rbTab${!mods ? ' sel' : ''}" data-rb="tab:mapa">🗺️ ${esc(T('t.mapas'))}</button></span>
      <span class="rbEsp"></span><button class="rbBtnG rbChico" data-rb="${mods ? 'pubmod' : 'pubmapa'}">＋ ${esc(T(mods ? 'p.mod' : 'p.mapa'))}</button>
      <label class="rbBtnGris rbChico">⬆ ${esc(T('p.archivo'))}<input type="file" id="rbArchivo" accept=".rbmod,.rbmapa,.json" hidden></label></div>
    <div class="rbBarra"><input id="rbBuscar" type="search" placeholder="${esc(T('buscar'))}" value="${esc(S.q)}">
      <select id="rbOrden">${['pop', 'nuevo', 'desc'].map((k) => `<option value="${k}"${S.orden === k ? ' selected' : ''}>${esc(T('o.' + k))}</option>`).join('')}</select>
      <span class="rbSeg"><button class="${S.vista === 'explorar' ? 'sel' : ''}" data-rb="vista:explorar">${esc(T('v.tienda'))}</button><button class="${S.vista === 'instalados' ? 'sel' : ''}" data-rb="vista:instalados">${esc(T('v.instalados'))}</button></span></div>
    <div class="rbEtqs"><button class="rbEtq${!S.etq ? ' sel' : ''}" data-rb="etq:">${esc(T('e.todas'))}</button>${ETIQUETAS_RB.map((e) => `<button class="rbEtq${S.etq === e ? ' sel' : ''}" data-rb="etq:${e}">${esc(T('e.' + e))}</button>`).join('')}</div>
    <div class="rbGrid rbTiendaG"></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">◀ ${esc(T('volver'))}</button><span class="rbEsp"></span><span class="rbTotal"></span><button class="rbBtnGris" data-rb="mas">⋯</button>
      <button class="rbBtnG" data-rb="nueva">${esc(T('m.nueva'))} ▶</button></div>`;
  tiendaCargar(true);
}
function tiendaCargar(desdeCero) {
  const S = RB.t, n = ++S.n; if (desdeCero) { S.p = 0; S.items = []; }
  if (S.vista === 'instalados') {
    const q = S.q.toLowerCase(), lista = S.tab === 'mod' ? modsTodos() : Object.values(INST.mapas);
    S.items = lista.filter((m) => (!q || (nombreDe(m) + ' ' + m.autor + ' ' + descDe(m)).toLowerCase().includes(q)) && (!S.etq || (m.etiquetas || []).includes(S.etq)));
    S.total = S.items.length; S.error = false; return tiendaDibujar();
  }
  S.cargando = true; S.error = false; tiendaDibujar();
  fetch(`${TIENDA_URL}lista?tipo=${S.tab}&q=${encodeURIComponent(S.q)}&etq=${S.etq}&orden=${S.orden}&p=${S.p}`).then((r) => r.json()).then((d) => {
    if (n !== S.n) return; S.items = S.items.concat(d.items || []); S.total = d.total || 0; S.cargando = false; tiendaDibujar();
  }).catch(() => { if (n !== S.n) return; S.cargando = false; S.error = true; tiendaDibujar(); });
}
function tiendaDibujar() {
  const S = RB.t, G = RB.el.querySelector('.rbTiendaG'); if (!G) return;
  const inst = (it) => (S.tab === 'mod' ? (it.oficial || INST.mods[it.id]) : INST.mapas[it.id]);
  const tarjeta = (it) => {
    const ins = inst(it), act = S.tab === 'mod' && PREFS.mods[it.id], img = S.tab === 'mod' ? icoHTML(it.icono) : `<img src="${esc(it.icono || it.foto || icono(MAPA_ICONO[it.base] || 'flatgrass'))}" alt="">`;
    const datos = it.oficial ? `<b class="rbOf">${esc(T('oficial'))}</b>` : `${esc(T('por'))} ${esc(it.autor)}${it.descargas != null ? ` · ⬇ ${it.descargas} · ♥ ${it.likes}` : ''}${S.tab === 'mapa' && it.base ? ` · ${esc(mapaNom(it.base))}` : ''}`;
    return `<div class="rbCard${S.tab === 'mapa' ? ' rbCardMapa' : ''}${act ? ' on' : ''}"><div class="rbIco">${img}</div>
      <div class="rbInfo"><b dir="auto">${esc(nombreDe(it))}</b><small dir="auto">${datos}</small><p dir="auto">${esc(descDe(it))}</p>
      <span class="rbEtqsC">${(it.etiquetas || []).map((e) => `<i>${esc(T('e.' + e))}</i>`).join('')}</span></div>
      <div class="rbAcc">${S.tab === 'mod' && ins ? `<button class="rbChk${act ? ' on' : ''}" data-rb="act:${esc(it.id)}"><em></em>${esc(T('activado'))}</button>` : ''}
        ${it.oficial ? '' : ins ? `<button class="rbBtnGris rbChico" data-rb="quitar:${esc(it.id)}">${esc(T('quitar'))}</button>` : `<button class="rbBtnG rbChico" data-rb="instalar:${esc(it.id)}">${esc(T('instalar'))}</button>`}
        ${S.tab === 'mapa' && ins ? `<button class="rbBtnG rbChico" data-rb="jugarcom:${esc(it.id)}">▶ ${esc(T('jugar'))}</button>` : ''}
        ${it.oficial ? '' : `<span class="rbMini">${it.descargas != null ? `<button title="${esc(T('meGusta'))}" class="${LIKES[it.id] ? 'sel' : ''}" data-rb="like:${esc(it.id)}">♥</button><button title="${esc(T('denunciar'))}" data-rb="denunciar:${esc(it.id)}">⚑</button>` : ''}
        ${ins ? `<button title="${esc(T('exportar'))}" data-rb="exportar:${esc(it.id)}">⬇</button>` : ''}${PUBLICADOS[it.id] ? `<button title="✖" data-rb="borrarpub:${esc(it.id)}">✖</button>` : ''}</span>`}</div></div>`;
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
    v.id = id; v.remoto = true; const it = S.items.find((x) => x.id === id); if (it) { v.descargas = it.descargas; v.likes = it.likes; }
    if (v.formato === 'rezobox-mod') { INST.mods[id] = v; PREFS.mods[id] = true; guardarPrefs(); } else INST.mapas[id] = v;
    guardarLS('rb_instalados', INST); menuAviso(T('instalado') + ': ' + v.nombre); tiendaDibujar();
  } catch (e) { menuAviso(T('errRed')); }
}
function descargarArchivo(d) {
  const a = document.createElement('a'), limpio = Object.assign({}, d); delete limpio.remoto; delete limpio.oficial; delete limpio.descargas; delete limpio.likes;
  a.href = URL.createObjectURL(new Blob([JSON.stringify(limpio, null, 1)], { type: 'application/json' }));
  a.download = (d.nombre || 'rezobox').replace(/[^\w\-]+/g, '_') + (d.formato === 'rezobox-mapa' ? '.rbmapa' : '.rbmod'); a.click();
}
function subirArchivo(f) {
  if (!f) return;
  if (f.size > 300000) { menuAviso(T('errFormato')); return; }
  f.text().then((t) => {
    let d; try { d = JSON.parse(t); } catch (e) { menuAviso(T('errFormato')); return; }
    const v = validarRB(d); if (typeof v === 'string') { menuAviso(T('errFormato') + ': ' + v); return; }
    v.id = 'local-' + Math.random().toString(36).slice(2, 10);
    if (v.formato === 'rezobox-mod') { INST.mods[v.id] = v; PREFS.mods[v.id] = true; guardarPrefs(); RB.t.tab = 'mod'; } else { INST.mapas[v.id] = v; RB.t.tab = 'mapa'; }
    guardarLS('rb_instalados', INST); RB.t.vista = 'instalados'; menuAviso(T('instalado') + ': ' + v.nombre); inicioPanel('tienda');
  });
}
async function publicar(d) {
  const v = validarRB(d); if (typeof v === 'string') { menuAviso(v); return; }
  try {
    const r = await (await fetch(TIENDA_URL + 'publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) })).json();
    if (!r.id) { menuAviso(r.error || T('errRed')); return; }
    PUBLICADOS[r.id] = r.clave; guardarLS('rb_publicados', PUBLICADOS);
    v.id = r.id; v.remoto = true; v.descargas = 0; v.likes = 0;
    if (v.formato === 'rezobox-mod') { INST.mods[r.id] = v; PREFS.mods[r.id] = true; guardarPrefs(); } else INST.mapas[r.id] = v;
    guardarLS('rb_instalados', INST);
    menuAviso(`${T('publicado')} ${T('clave')} ${r.clave}`);
    RB.t.tab = v.formato === 'rezobox-mod' ? 'mod' : 'mapa'; RB.t.vista = 'instalados'; inicioPanel('tienda');
  } catch (e) { menuAviso(T('errRed')); }
}
// ---------- crear un mod (sin código: valores, interruptores, personaje, hora y armas) ----------
function panelPubMod(P) {
  const R = [['gravedad', 0.05, 3, 0.05], ['velocidad', 0.3, 4, 0.05], ['salto', 0.3, 8, 0.1], ['tiempo', 0.25, 1, 0.05], ['explosion', 0.5, 5, 0.1]];
  const armas = Object.keys(DEF_ARMAS || {}).filter((a) => !/^(Camera|Hands)$/.test(a));
  P.innerHTML = `<div class="rbPanCab">${esc(T('p.mod'))}</div><div class="rbForm">
    <div class="rbCol"><label class="rbCampo">${esc(T('nombre'))}<input id="pmNom" maxlength="40"></label>
      <label class="rbCampo">${esc(T('desc'))}<textarea id="pmDesc" maxlength="400" rows="3"></textarea></label>
      <div class="rbCampo">${esc(T('icono'))}<span class="rbIconos">${ICONOS_MOD.map((e, i) => `<button class="${i ? '' : 'sel'}" data-rb="pmico:${e}">${e}</button>`).join('')}</span></div>
      <div class="rbCampo">${esc(T('etiquetas'))}<span class="rbEtqs">${ETIQUETAS_RB.map((e) => `<button class="rbEtq" data-rb="pmetq:${e}">${esc(T('e.' + e))}</button>`).join('')}</span></div></div>
    <div class="rbCol">${R.map(([k, a, b, s]) => `<label class="rbRango">${esc(T('f.' + k))}<input type="range" data-rv="${k}" min="${a}" max="${b}" step="${s}" value="1"><output>1.00×</output></label>`).join('')}
      <span class="rbFila"><button class="rbChk" data-rb="pmtog:municionInfinita"><em></em>${esc(T('f.municion'))}</button><button class="rbChk" data-rb="pmtog:invencible"><em></em>${esc(T('f.invencible'))}</button></span>
      <span class="rbFila"><label class="rbCampo">${esc(T('f.skin'))}<select id="pmSkin"><option value="">${esc(T('ninguna'))}</option>${Object.keys(RETRATO).map((s) => `<option>${s}</option>`).join('')}</select></label>
      <label class="rbCampo">${esc(T('f.hora'))}<select id="pmHora"><option value="">${esc(T('ninguna'))}</option>${[...Array(24)].map((_, h) => `<option value="${h}">${h}:00</option>`).join('')}</select></label></span>
      <div class="rbCampo">${esc(T('e.armas'))}<span class="rbEtqs">${armas.map((a) => `<button class="rbEtq" data-rb="pmarma:${a}">${a}</button>`).join('')}</span></div></div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="tienda">◀ ${esc(T('volver'))}</button><span class="rbEsp"></span>
      <button class="rbBtnGris" data-rb="pmexp">⬇ ${esc(T('exportar'))}</button><button class="rbBtnGris" data-rb="pmprobar">✔ ${esc(T('instalar'))}</button><button class="rbBtnG" data-rb="pmpub">⬆ ${esc(T('publicar'))}</button></div>`;
  RB.pm = { icono: ICONOS_MOD[0], etq: new Set(), tog: {}, armas: new Set() };
}
function modDelForm() {
  const P = RB.el.querySelector('.rbPan'), v = (s) => P.querySelector(s).value, ef = {};
  P.querySelectorAll('[data-rv]').forEach((r) => { ef[r.dataset.rv] = +r.value; });
  Object.assign(ef, RB.pm.tog, { skin: v('#pmSkin') || null, hora: v('#pmHora') === '' ? null : +v('#pmHora'), armas: [...RB.pm.armas] });
  return { formato: 'rezobox-mod', nombre: v('#pmNom'), autor: PREFS.nombre, descripcion: v('#pmDesc'), icono: RB.pm.icono, etiquetas: [...RB.pm.etq], efectos: ef };
}
// ---------- publicar una construcción guardada como mapa ----------
function construcciones() {
  return MAPAS.map((m) => ({ m, L: leerLS('hypper_save_' + m, []), foto: (() => { try { return localStorage.getItem('rb_foto_' + m) || null; } catch (e) { return null; } })() })).filter((c) => c.L.length);
}
function panelPubMapa(P) {
  const cs = construcciones(); RB.pmap = RB.pmap && cs.some((c) => c.m === RB.pmap.m) ? RB.pmap : { m: cs.length ? cs[0].m : null, etq: new Set() };
  P.innerHTML = `<div class="rbPanCab">${esc(T('p.mapa'))}</div><div class="rbForm">
    <div class="rbCol"><div class="rbCampo">${esc(T('mapaBase'))}</div><div class="rbGrid rbGridChica">${cs.map((c) => `<div class="rbMapaG${c.m === RB.pmap.m ? ' sel' : ''}" data-rb="pmapa:${c.m}"><div class="rbFoto" style="background-image:url(${c.foto || icono(MAPA_ICONO[c.m])})"></div><b>${esc(mapaNom(c.m))}</b><small>${c.L.length} ${esc(T('objetos'))}</small></div>`).join('') || `<div class="rbVacio">${esc(T('nadaConstr'))}</div>`}</div></div>
    <div class="rbCol"><label class="rbCampo">${esc(T('nombre'))}<input id="paNom" maxlength="40"></label><label class="rbCampo">${esc(T('desc'))}<textarea id="paDesc" maxlength="400" rows="3"></textarea></label>
      <label class="rbCampo">${esc(T('f.hora'))}<select id="paHora"><option value="">${esc(T('ninguna'))}</option>${[...Array(24)].map((_, h) => `<option value="${h}">${h}:00</option>`).join('')}</select></label>
      <div class="rbCampo">${esc(T('etiquetas'))}<span class="rbEtqs">${ETIQUETAS_RB.map((e) => `<button class="rbEtq" data-rb="paetq:${e}">${esc(T('e.' + e))}</button>`).join('')}</span></div></div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="tienda">◀ ${esc(T('volver'))}</button><span class="rbEsp"></span>
      <button class="rbBtnGris" data-rb="paexp">⬇ ${esc(T('exportar'))}</button><button class="rbBtnG" data-rb="papub">⬆ ${esc(T('publicar'))}</button></div>`;
}
function mapaDelForm() {
  const P = RB.el.querySelector('.rbPan'), c = construcciones().find((x) => x.m === RB.pmap.m); if (!c) return null;
  const h = P.querySelector('#paHora').value;
  return { formato: 'rezobox-mapa', nombre: P.querySelector('#paNom').value, autor: PREFS.nombre, descripcion: P.querySelector('#paDesc').value, etiquetas: [...RB.pmap.etq],
    base: c.m, foto: c.foto, hora: h === '' ? null : +h, gravedad: 1, objetos: c.L };
}
function inicioAccion(k, b) {
  const [a, v] = k.split(/:(.*)/s);
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
    case 'quitar': if (RB.t.tab === 'mod') { delete INST.mods[v]; delete PREFS.mods[v]; guardarPrefs(); } else delete INST.mapas[v]; guardarLS('rb_instalados', INST); return RB.t.vista === 'instalados' ? tiendaCargar(true) : tiendaDibujar();
    case 'act': PREFS.mods[v] = !PREFS.mods[v]; if (!PREFS.mods[v]) delete PREFS.mods[v]; guardarPrefs(); return tiendaDibujar();
    case 'like': if (LIKES[v]) return; LIKES[v] = 1; guardarLS('rb_likes', LIKES); fetch(TIENDA_URL + 'like/' + v, { method: 'POST' }).catch(() => {}); { const it = RB.t.items.find((x) => x.id === v); if (it) it.likes++; } return tiendaDibujar();
    case 'denunciar': if (!confirm(T('denunciar') + '?')) return; fetch(TIENDA_URL + 'denunciar/' + v, { method: 'POST' }).catch(() => {}); RB.t.items = RB.t.items.filter((x) => x.id !== v); return tiendaDibujar();
    case 'exportar': return descargarArchivo(RB.t.tab === 'mod' ? INST.mods[v] : INST.mapas[v]);
    case 'borrarpub': if (!confirm('✖ ' + v + '?')) return; fetch(TIENDA_URL + 'borrar/' + v, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave: PUBLICADOS[v] }) }).then((r) => r.json()).then((r) => { if (r.ok) { delete PUBLICADOS[v]; guardarLS('rb_publicados', PUBLICADOS); tiendaCargar(true); } }).catch(() => menuAviso(T('errRed'))); return;
    case 'jugarcom': RB.mapaCom = v; RB.mapa = INST.mapas[v].base; RB.hora = 'normal'; return inicioAccion('empezar', b);
    case 'pubmod': return inicioPanel('pubmod');
    case 'pubmapa': return inicioPanel('pubmapa');
    case 'pmico': RB.pm.icono = v; b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b)); return;
    case 'pmetq': marcar(); return RB.pm.etq.has(v) ? RB.pm.etq.delete(v) : RB.pm.etq.size < 4 ? RB.pm.etq.add(v) : marcar();
    case 'pmarma': marcar(); return RB.pm.armas.has(v) ? RB.pm.armas.delete(v) : RB.pm.armas.add(v);
    case 'pmtog': RB.pm.tog[v] = !RB.pm.tog[v]; b.classList.toggle('on', RB.pm.tog[v]); return;
    case 'pmexp': { const m = validarRB(modDelForm()); return typeof m === 'string' ? menuAviso(m) : descargarArchivo(m); }
    case 'pmprobar': { const m = validarRB(modDelForm()); if (typeof m === 'string') return menuAviso(m); m.id = 'local-' + Math.random().toString(36).slice(2, 10); INST.mods[m.id] = m; PREFS.mods[m.id] = true; guardarPrefs(); guardarLS('rb_instalados', INST); RB.t.tab = 'mod'; RB.t.vista = 'instalados'; menuAviso(T('instalado') + ': ' + m.nombre); return inicioPanel('tienda'); }
    case 'pmpub': return publicar(modDelForm());
    case 'pmapa': RB.pmap.m = v; return inicioPanel('pubmapa');
    case 'paetq': marcar(); return RB.pmap.etq.has(v) ? RB.pmap.etq.delete(v) : RB.pmap.etq.size < 4 ? RB.pmap.etq.add(v) : marcar();
    case 'paexp': { const d = mapaDelForm(); if (!d) return; const m = validarRB(d); return typeof m === 'string' ? menuAviso(m) : descargarArchivo(m); }
    case 'papub': { const d = mapaDelForm(); return d ? publicar(d) : menuAviso(T('nadaConstr')); }
    case 'cat': RB.cat = v; return inicioPanel('nueva');
    case 'mapa': RB.mapa = v; RB.mapaCom = null; PREFS.mapa = v; guardarPrefs(); if (typeof menuMapaMarcar === 'function') menuMapaMarcar(); return inicioPanel('nueva');
    case 'mapacom': if (!INST.mapas[v]) return; RB.mapaCom = v; RB.mapa = INST.mapas[v].base; return inicioPanel('nueva');
    case 'empezar': RB.horaPartida = RB.hora; RB.mapaPartida = RB.mapaCom ? INST.mapas[RB.mapaCom] : null; inicioMostrar(false); SALA = null; empezarPartida(RB.mapa); return;
    case 'multi': inicioMostrar(false); conectarMultijugador(); return;
    case 'personajes': inicioMostrar(false); seccion('Shop'); tienda('Character'); return;
    case 'opciones': abrirAjustes('principal'); return;
    case 'clasico': inicioMostrar(false); seccion('MainMenu'); return;
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
  if (MENU.lienzo) MENU.lienzo.style.visibility = si ? 'hidden' : ''; // el menú clásico no se ve abajo
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
  const act = modsTodos().filter((m) => PREFS.mods && PREFS.mods[m.id]);
  for (const m of act) {
    const e = m.efectos; E.gravedad *= e.gravedad; E.velocidad *= e.velocidad; E.salto *= e.salto; E.tiempo *= e.tiempo; E.explosion *= e.explosion;
    E.municionInfinita = E.municionInfinita || e.municionInfinita; E.invencible = E.invencible || e.invencible;
    if (e.skin) E.skin = e.skin; if (e.hora != null) E.hora = e.hora; E.armas.push(...e.armas); E.aparecer.push(...e.aparecer);
  }
  E.tiempo = Math.max(0.25, E.tiempo); E.gravedad = Math.min(3, Math.max(0.03, E.gravedad));
  Object.assign(MODS, E);
  if (!RB.base) RB.base = { v: JUG.vel_max, s: JUG.salto };
  JUG.vel_max = RB.base.v * Math.min(6, E.velocidad); JUG.salto = RB.base.s * Math.min(12, E.salto);
  const mc = RB.mapaPartida; RB.mapaPartida = null;
  const g = E.gravedad * (mc ? mc.gravedad : 1); if (g !== 1) { MUNDO.gravedad *= g; PH.gscale = MUNDO.gravedad; }
  if (E.skin && RETRATO[E.skin] && PREFS.skin !== E.skin) { PREFS.skin = E.skin; guardarPrefs(); }
  for (const a of E.armas) if (DEF_ARMAS[a] && !ARM.lista.includes(a)) ARM.lista.push(a);
  // hora: la elegida al empezar, si no la del mapa, si no la del mod
  const h = RB.horaPartida; RB.horaPartida = null; let hora = null, ciclo = false;
  if (h && h !== 'normal') { if (h === 'ciclo') ciclo = true; else hora = { dia: 12, tarde: 18.6, noche: 0 }[h]; } else if (mc && mc.hora != null) hora = mc.hora; else if (E.hora != null) hora = E.hora;
  if (ciclo || hora != null) { DIA.ciclo = ciclo; if (hora != null) DIA.hora = hora; DIA.aplicada = -1; }
  if (mc) {
    for (const x of mc.objetos) { const o = crearObjeto(x.n, v3(0, 0, 0), new Quat(x.q[0], x.q[1], x.q[2], x.q[3]), { congelado: !!x.f }); if (o) { o.b.pos.set(x.p[0], x.p[1], x.p[2]); o.b.q.set(x.q[0], x.q[1], x.q[2], x.q[3]); o.b.updateWorld(); } }
    if (mc.aparicion) JUG.pos.set(mc.aparicion[0], mc.aparicion[1], mc.aparicion[2]);
    setTimeout(() => aviso(mc.nombre + ' · ' + T('por') + ' ' + mc.autor, 3), 300);
  }
  if (E.aparecer.length) setTimeout(() => aparecerDelante(E.aparecer.slice(0, 60)), 400);
  const nom = act.map(nombreDe); if (nom.length) setTimeout(() => aviso('Mods: ' + nom.join(', '), 3), 2600);
}
