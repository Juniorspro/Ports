// ---------------- RezoBox: pantalla de inicio propia (Mapas y Mods), antes del menú del juego ----------------
// Va arriba del menú real (mismo nivel, después en la página) y abajo de los paneles (ajustes, avisos).
const RB = { el: null, panel: 'mapas', mapa: null, hora: 'normal', base: null };
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
  Desert: [['Desierto', 'Desert'], ['Arena, rocas y un camino largo.', 'Sand, rocks and a long road.']],
  DesertV2: [['Desierto II', 'Desert II'], ['El desierto con más construcciones.', 'The desert with more buildings.']],
  FlatGrass: [['Pasto plano', 'Flatgrass'], ['Llano infinito para construir lo que quieras.', 'Endless flat grass to build anything.']],
  City: [['Ciudad', 'City'], ['Calles, edificios y autos.', 'Streets, buildings and cars.']],
  Base: [['Base', 'Base'], ['Una base militar con hangares.', 'A military base with hangars.']],
  BaseV2: [['Base II', 'Base II'], ['La base renovada, más grande.', 'The renewed, bigger base.']],
  Mars: [['Marte', 'Mars'], ['Gravedad 0,38: saltos enormes.', 'Gravity 0.38: huge jumps.']],
  Space: [['Espacio', 'Space'], ['Gravedad 0,16: casi flotás.', 'Gravity 0.16: you almost float.']],
};
const HORAS = [['normal', ['Normal', 'Default']], ['dia', ['Día', 'Day']], ['tarde', ['Atardecer', 'Sunset']], ['noche', ['Noche', 'Night']], ['ciclo', ['Ciclo', 'Cycle']]];
const tr = (par) => (PREFS.idioma === 'SP' ? par[0] : par[1]);
const LOGO_RB = 'data:image/webp;base64,/*LOGORB*/';

function inicioCrear() {
  const el = document.createElement('div'); el.id = 'rbInicio'; el.className = 'oc';
  el.innerHTML = `<div class="rbFondo"></div><div class="rbIzq"><img class="rbLogo" alt="RezoBox" src="${LOGO_RB}"><div class="rbBotones"></div>
    <label class="rbNombre">${tr(['Nombre', 'Name'])} <input maxlength="16" spellcheck="false"></label><div class="rbVer"></div></div><div class="rbDer"></div>`;
  // el nombre se pide acá (el cartel del menú clásico ya no hace falta)
  const inp = el.querySelector('.rbNombre input'); inp.value = PREFS.nombre || '';
  inp.oninput = () => { PREFS.nombre = limpioNombre(inp.value); guardarPrefs(); const nick = nodo('Main/MainMenu/UpPanel/NickNameInputField'); if (nick && nick.inp) nick.inp.value = PREFS.nombre; };
  overlay('NicknamePanel', false); PREFS.nombreOk = true; guardarPrefs();
  document.body.appendChild(el); RB.el = el;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rb]'); if (!b) return;
    audioIniciar(); inicioAccion(b.dataset.rb, b);
  });
  if (!PREFS.mods) PREFS.mods = {};
  RB.mapa = MAPAS.includes(PREFS.mapa) ? PREFS.mapa : 'Desert';
  // el logo del juego en el menú clásico pasa a ser el de RezoBox
  for (const n of Object.values(MENU.por || {})) {
    if (n.txt && /hypper/i.test(n.txt.t || '')) uiTextoPoner(n, n.txt.t.replace(/hypper( sandbox)?/ig, 'RezoBox'));
    if (!/logo/i.test(n.n || '') || !n.el) continue;
    const i = n.el.querySelector('.im'); if (!i) continue;
    i.style.background = `url(${LOGO_RB}) center/contain no-repeat`; i.style.removeProperty('-webkit-mask'); i.style.removeProperty('mask'); i.style.opacity = 1;
  }
  // volver a RezoBox desde el menú clásico
  if (MENU.lienzo && !document.getElementById('rbVolver')) {
    const v = document.createElement('div'); v.id = 'rbVolver'; v.textContent = '◀ RezoBox';
    v.onclick = (e) => { e.stopPropagation(); audioIniciar(); inicioMostrar(true); };
    MENU.el.appendChild(v);
  }
}
function inicioBotones() {
  const B = [['jugar', '▶', ['Jugar', 'Play']], ['mapas', '🗺️', ['Mapas', 'Maps']], ['mods', '🧩', ['Mods', 'Mods']], ['multi', '🌐', ['Multijugador', 'Multiplayer']],
    ['tienda', '👕', ['Personajes', 'Characters']], ['ajustes', '⚙️', ['Ajustes', 'Settings']], ['clasico', '☰', ['Menú clásico', 'Classic menu']]];
  RB.el.querySelector('.rbBotones').innerHTML = B.map(([k, ic, t]) => `<button data-rb="${k}" class="rbB${RB.panel === k ? ' sel' : ''}"><i>${ic}</i>${tr(t)}</button>`).join('');
  const nm = MODS_DEF.filter((m) => PREFS.mods[m.id]).length;
  RB.el.querySelector('.rbVer').textContent = `RezoBox ${VERSION_JUEGO} · ${nm} ${tr(['mods activos', 'mods on'])}`;
}
function inicioFondo() { const f = RB.el.querySelector('.rbFondo'); if (f) f.style.backgroundImage = `url(${icono(MAPA_ICONO[RB.mapa])})`; }
function inicioPanel(p) {
  RB.panel = p; inicioBotones(); inicioFondo();
  const D = RB.el.querySelector('.rbDer');
  if (p === 'mods') {
    D.innerHTML = `<div class="rbCaja"><div class="rbTit">${tr(['Mods', 'Mods'])}<span>${tr(['Se aplican al empezar una partida', 'Applied when a match starts'])}</span></div>
      <div class="rbMods">${MODS_DEF.map((m) => `<div class="rbMod${PREFS.mods[m.id] ? ' on' : ''}" data-rb="mod:${m.id}"><i>${m.ic}</i><div><b>${tr(m.n)}</b><small>${tr(m.d)}</small></div><em></em></div>`).join('')}</div>
      <div class="rbPie"><button class="rbB2" data-rb="modsNada">${tr(['Desactivar todos', 'Disable all'])}</button><button class="rbB2 rbVerde" data-rb="mapas">${tr(['Elegir mapa ▶', 'Choose map ▶'])}</button></div></div>`;
  } else {
    D.innerHTML = `<div class="rbCaja"><div class="rbTit">${tr(['Mapas', 'Maps'])}<span>${tr(['Elegí dónde jugar', 'Choose where to play'])}</span></div>
      <div class="rbMapas">${MAPAS.map((m) => `<div class="rbMapa${m === RB.mapa ? ' sel' : ''}" data-rb="mapa:${m}"><div class="rbFoto" style="background-image:url(${icono(MAPA_ICONO[m])})"></div><b>${tr(MAPA_INFO[m][0])}</b><small>${tr(MAPA_INFO[m][1])}</small></div>`).join('')}</div>
      <div class="rbPie"><span class="rbHoras">${tr(['Hora:', 'Time:'])} ${HORAS.map(([k, t]) => `<button class="rbChip${RB.hora === k ? ' sel' : ''}" data-rb="hora:${k}">${tr(t)}</button>`).join('')}</span>
      <button class="rbB2 rbVerde rbEmpezar" data-rb="empezar">${tr(['Empezar', 'Start'])} ▶</button></div></div>`;
  }
}
function inicioAccion(k, b) {
  if (k === 'jugar' || k === 'mapas') return inicioPanel('mapas');
  if (k === 'mods') return inicioPanel('mods');
  if (k.startsWith('mod:')) { const id = k.slice(4); PREFS.mods[id] = !PREFS.mods[id]; guardarPrefs(); b.classList.toggle('on', !!PREFS.mods[id]); inicioBotones(); return; }
  if (k === 'modsNada') { PREFS.mods = {}; guardarPrefs(); return inicioPanel('mods'); }
  if (k.startsWith('mapa:')) { RB.mapa = k.slice(5); PREFS.mapa = RB.mapa; guardarPrefs(); if (typeof menuMapaMarcar === 'function') menuMapaMarcar(); RB.el.querySelectorAll('.rbMapa').forEach((e) => e.classList.toggle('sel', e.dataset.rb === k)); inicioFondo(); return; }
  if (k.startsWith('hora:')) { RB.hora = k.slice(5); RB.el.querySelectorAll('.rbChip').forEach((e) => e.classList.toggle('sel', e.dataset.rb === k)); return; }
  if (k === 'empezar') { RB.horaPartida = RB.hora; inicioMostrar(false); SALA = null; empezarPartida(RB.mapa); return; }
  if (k === 'multi') { inicioMostrar(false); conectarMultijugador(); return; }
  if (k === 'tienda') { inicioMostrar(false); seccion('Shop'); tienda('Character'); return; }
  if (k === 'ajustes') { abrirAjustes('principal'); return; }
  if (k === 'clasico') { inicioMostrar(false); seccion('MainMenu'); }
}
// muestra el inicio arriba del menú real (que queda armado abajo, con el lobby en 3D de fondo)
function inicioMostrar(si) {
  if (si) { menuMostrar(true); if (!RB.el) inicioCrear(); inicioPanel(RB.panel === 'mods' ? 'mods' : 'mapas'); }
  if (RB.el) RB.el.classList.toggle('oc', !si);
  if (MENU.lienzo) MENU.lienzo.style.visibility = si ? 'hidden' : ''; // el menú clásico no se transparenta abajo
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
