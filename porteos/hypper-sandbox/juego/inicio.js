// ---------------- HypperX RezoBox: inicio propio con el aspecto del menú de Garry's Mod ----------------
// Fondo con escenas del juego que pasan solas, menú de texto a la izquierda, botoncitos abajo y paneles claros
// (Empezar partida nueva con mapas por categoría, Mods). Va arriba del menú real y abajo de los paneles (ajustes).
const RB = { el: null, panel: null, mapa: null, cat: 'todos', hora: 'normal', base: null, fondo: 0, reloj: 0 };
const MODS = {}; // los que quedaron activos al empezar la partida
const MODS_DEF = [
  { id: 'goku', ic: '🐉', n: ['Goku', 'Goku'], d: ['Aparecés como Goku: corrés y saltás como un Saiyajin.', 'Spawn as Goku: run and jump like a Saiyan.'] },
  { id: 'luna', ic: '🌙', n: ['Gravedad lunar', 'Moon gravity'], d: ['Todo cae despacio: saltos largos y props que flotan.', 'Everything falls slowly: long jumps, floating props.'] },
  { id: 'salto', ic: '🦘', n: ['Súper salto', 'Super jump'], d: ['Saltás cuatro veces más alto.', 'Jump four times higher.'] },
  { id: 'veloz', ic: '⚡', n: ['Velocidad', 'Speed'], d: ['Caminás y corrés casi al doble.', 'Walk and run almost twice as fast.'] },
  { id: 'balas', ic: '♾️', n: ['Munición infinita', 'Infinite ammo'], d: ['Las armas nunca se quedan sin balas.', 'Weapons never run out of ammo.'] },
  { id: 'dios', ic: '🛡️', n: ['Modo Dios', 'God mode'], d: ['No recibís daño de nada.', 'You take no damage.'] },
  { id: 'lenta', ic: '🐢', n: ['Cámara lenta', 'Slow motion'], d: ['El mundo va a la mitad de velocidad.', 'The world runs at half speed.'] },
  { id: 'boom', ic: '💥', n: ['Explosiones gigantes', 'Huge explosions'], d: ['Radio y fuerza de las explosiones mucho más grandes.', 'Much bigger explosion radius and force.'] },
];
const MAPA_INFO = {
  Desert: ['Desierto', 'Desert'], DesertV2: ['Desierto II', 'Desert II'], FlatGrass: ['Pasto plano', 'Flatgrass'], City: ['Ciudad', 'City'],
  Base: ['Base', 'Base'], BaseV2: ['Base II', 'Base II'], Mars: ['Marte', 'Mars'], Space: ['Espacio', 'Space'],
};
const MAPA_CATS = [['todos', ['Todos los mapas', 'All maps'], MAPAS], ['tierra', ['Tierra', 'Earth'], ['Desert', 'DesertV2', 'FlatGrass', 'City', 'Base', 'BaseV2']], ['espacio', ['Espacio', 'Space'], ['Mars', 'Space']]];
const HORAS = [['normal', ['Normal', 'Default']], ['dia', ['Día', 'Day']], ['tarde', ['Atardecer', 'Sunset']], ['noche', ['Noche', 'Night']], ['ciclo', ['Ciclo día/noche', 'Day/night cycle']]];
const BANDERA = { SP: '🇪🇸', EN: '🇬🇧', RU: '🇷🇺', PO: '🇧🇷', ID: '🇮🇩', UA: '🇺🇦' };
const tr = (par) => (PREFS.idioma === 'SP' ? par[0] : par[1]);
const LOGO_RB = 'data:image/webp;base64,/*LOGORB*/';
const FONDOS_RB = [/*FONDOSRB*/]; // escenas armadas con cosas del juego (van con el paquete, no en el repo)

function inicioCrear() {
  const el = document.createElement('div'); el.id = 'rbInicio'; el.className = 'oc';
  el.innerHTML = `<div class="rbBg"></div><div class="rbBg"></div><div class="rbSombra"></div>
    <img class="rbLogo" alt="HypperX RezoBox" src="${LOGO_RB}"><div class="rbLista"></div>
    <div class="rbAbajo"></div><div class="rbVer"></div><div class="rbPan oc"></div>`;
  document.body.appendChild(el); RB.el = el;
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-rb]'); if (!b) return; e.preventDefault(); audioIniciar(); inicioAccion(b.dataset.rb, b); });
  el.addEventListener('change', (e) => { if (e.target.id === 'rbHora') RB.hora = e.target.value; });
  if (!PREFS.mods) PREFS.mods = {};
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
  const G = [[['nueva', ['Empezar partida nueva', 'Start New Game']], ['multi', ['Buscar partida multijugador', 'Find Multiplayer Game']]],
    [['mods', ['Mods', 'Mods']], ['tienda', ['Personajes', 'Characters']], ['ajustes', ['Opciones', 'Options']]],
    [['clasico', ['Menú clásico', 'Classic menu']], ['salir', ['Salir', 'Quit']]]];
  RB.el.querySelector('.rbLista').innerHTML = G.map((g) => g.map(([k, t]) => `<button class="rbIt" data-rb="${k}">${tr(t)}</button>`).join('')).join('<div class="rbSep"></div>');
  const nm = MODS_DEF.filter((m) => PREFS.mods[m.id]).length;
  RB.el.querySelector('.rbAbajo').innerHTML = `<button class="rbChipG" data-rb="mods">🧩 ${nm ? `${nm} mods` : 'Sandbox'}</button>
    <button class="rbChipG" data-rb="idioma" title="Idioma">${BANDERA[PREFS.idioma] || '🌐'}</button>
    <label class="rbChipG">👤 <input id="rbNombre" maxlength="16" spellcheck="false"></label>`;
  const inp = RB.el.querySelector('#rbNombre'); inp.value = PREFS.nombre || '';
  inp.oninput = () => { PREFS.nombre = limpioNombre(inp.value); guardarPrefs(); const nick = nodo('Main/MainMenu/UpPanel/NickNameInputField'); if (nick && nick.inp) nick.inp.value = PREFS.nombre; };
  RB.el.querySelector('.rbVer').textContent = `HypperX RezoBox ${VERSION_JUEGO}`;
}
function inicioFondoPasar() {
  const capas = RB.el.querySelectorAll('.rbBg'), lista = FONDOS_RB.length ? FONDOS_RB : MAPAS.map((m) => icono(MAPA_ICONO[m]));
  const sig = capas[RB.fondo % 2 ? 0 : 1], act = capas[RB.fondo % 2];
  sig.style.backgroundImage = `url(${lista[RB.fondo % lista.length]})`; sig.classList.add('on'); act.classList.remove('on'); RB.fondo++;
}
function inicioPanel(p) {
  RB.panel = p; const P = RB.el.querySelector('.rbPan');
  P.classList.toggle('oc', !p); RB.el.querySelector('.rbLista').classList.toggle('oc', !!p);
  RB.el.querySelector('.rbLogo').classList.toggle('oc', !!p); RB.el.querySelector('.rbAbajo').classList.toggle('oc', !!p);
  if (!p) return;
  if (p === 'mods') {
    P.innerHTML = `<div class="rbPanCab">${tr(['Mods', 'Mods'])}<small>${tr(['Se aplican al empezar una partida', 'Applied when a match starts'])}</small></div>
      <div class="rbPanCuerpo"><div class="rbGrid rbModsG">${MODS_DEF.map((m) => `<div class="rbModG${PREFS.mods[m.id] ? ' on' : ''}" data-rb="mod:${m.id}"><i>${m.ic}</i><span><b>${tr(m.n)}</b><small>${tr(m.d)}</small></span><em></em></div>`).join('')}</div></div>
      <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">◀ ${tr(['Volver', 'Back'])}</button><button class="rbBtnGris" data-rb="modsNada">${tr(['Desactivar todos', 'Disable all'])}</button><span class="rbEsp"></span><button class="rbBtnG" data-rb="nueva">${tr(['Empezar partida nueva', 'Start New Game'])} ▶</button></div>`;
    return;
  }
  const cat = MAPA_CATS.find((c) => c[0] === RB.cat) || MAPA_CATS[0], nm = MODS_DEF.filter((m) => PREFS.mods[m.id]).length;
  P.innerHTML = `<div class="rbPanCab">${tr(['Empezar partida nueva', 'Start New Game'])}<small>${tr(MAPA_INFO[RB.mapa])}</small></div>
    <div class="rbPanCuerpo"><div class="rbCats">${MAPA_CATS.map(([k, t, l]) => `<button class="rbCat${k === cat[0] ? ' sel' : ''}" data-rb="cat:${k}">${tr(t)}<em>${l.length}</em></button>`).join('')}</div>
    <div class="rbGrid">${cat[2].map((m) => `<div class="rbMapaG${m === RB.mapa ? ' sel' : ''}" data-rb="mapa:${m}"><div class="rbFoto" style="background-image:url(${icono(MAPA_ICONO[m])})"></div><b>${tr(MAPA_INFO[m])}</b></div>`).join('')}</div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">◀ ${tr(['Volver', 'Back'])}</button>
      <label class="rbCampo">${tr(['Hora', 'Time'])} <select id="rbHora">${HORAS.map(([k, t]) => `<option value="${k}"${RB.hora === k ? ' selected' : ''}>${tr(t)}</option>`).join('')}</select></label>
      <button class="rbBtnGris" data-rb="mods">🧩 ${nm ? `${nm} ${tr(['mods activos', 'mods on'])}` : tr(['Sin mods', 'No mods'])}</button>
      <span class="rbEsp"></span><span class="rbModo">${tr(['Un jugador', 'Single Player'])}</span><button class="rbBtnG" data-rb="empezar">${tr(['Empezar partida', 'Start Game'])}</button></div>`;
}
function inicioAccion(k, b) {
  if (k === 'nueva') return inicioPanel('nueva');
  if (k === 'mods') return inicioPanel('mods');
  if (k === 'volver') { inicioLista(); return inicioPanel(null); }
  if (k.startsWith('mod:')) { const id = k.slice(4); PREFS.mods[id] = !PREFS.mods[id]; guardarPrefs(); b.classList.toggle('on', !!PREFS.mods[id]); return; }
  if (k === 'modsNada') { PREFS.mods = {}; guardarPrefs(); return inicioPanel('mods'); }
  if (k.startsWith('cat:')) { RB.cat = k.slice(4); return inicioPanel('nueva'); }
  if (k.startsWith('mapa:')) { RB.mapa = k.slice(5); PREFS.mapa = RB.mapa; guardarPrefs(); if (typeof menuMapaMarcar === 'function') menuMapaMarcar(); return inicioPanel('nueva'); }
  if (k === 'empezar') { RB.horaPartida = RB.hora; inicioMostrar(false); SALA = null; empezarPartida(RB.mapa); return; }
  if (k === 'multi') { inicioMostrar(false); conectarMultijugador(); return; }
  if (k === 'tienda') { inicioMostrar(false); seccion('Shop'); tienda('Character'); return; }
  if (k === 'ajustes') { abrirAjustes('principal'); return; }
  if (k === 'clasico') { inicioMostrar(false); seccion('MainMenu'); return; }
  if (k === 'idioma') { PREFS.idioma = IDIOMAS[(IDIOMAS.indexOf(PREFS.idioma) + 1) % IDIOMAS.length]; guardarPrefs(); menuTextosVivos(); inicioLista(); if (RB.panel) inicioPanel(RB.panel); return; }
  if (k === 'salir') { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); menuAviso(tr(['Para salir, cerrá la pestaña', 'To quit, close the tab'])); }
}
// muestra el inicio arriba del menú real (que queda armado abajo)
function inicioMostrar(si) {
  if (si) {
    menuMostrar(true); if (!RB.el) inicioCrear(); inicioLista(); inicioPanel(null);
    if (!RB.reloj) { inicioFondoPasar(); RB.reloj = setInterval(() => { if (!RB.el.classList.contains('oc')) inicioFondoPasar(); }, 9000); }
  }
  if (RB.el) RB.el.classList.toggle('oc', !si);
  if (MENU.lienzo) MENU.lienzo.style.visibility = si ? 'hidden' : ''; // el menú clásico no se ve abajo
}
// los mods de la partida: se llama al empezar, después de cargar el mapa y aparecer
function aplicarMods() {
  const P = PREFS.mods || {};
  for (const m of MODS_DEF) MODS[m.id] = !!P[m.id];
  if (!RB.base) RB.base = { v: JUG.vel_max, s: JUG.salto };
  JUG.vel_max = RB.base.v * (MODS.veloz ? 1.8 : 1) * (MODS.goku ? 1.4 : 1);
  JUG.salto = RB.base.s * (MODS.salto ? 4 : 1) * (MODS.goku ? 2.5 : 1);
  if (MODS.luna) { MUNDO.gravedad *= 0.35; PH.gscale = MUNDO.gravedad; }
  if (MODS.goku && PREFS.skin !== 'Goku') { PREFS.skin = 'Goku'; guardarPrefs(); }
  const h = RB.horaPartida; RB.horaPartida = null;
  if (h && h !== 'normal') { DIA.ciclo = h === 'ciclo'; if (h !== 'ciclo') DIA.hora = h === 'dia' ? 12 : h === 'tarde' ? 18.6 : 0; DIA.aplicada = -1; }
  const act = MODS_DEF.filter((m) => MODS[m.id]).map((m) => tr(m.n));
  if (act.length) setTimeout(() => aviso('Mods: ' + act.join(', '), 3), 2600);
}
