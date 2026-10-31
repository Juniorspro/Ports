// ---------------------------------------------------------------------------------------------------------
// interfaz: menú de spawn (pestañas Props / Vehicles / Entities / Weapons / Tools como el juego), HUD, menú
// principal con los mapas, personaje y gorro, pausa, ajustes, emotes y chat.
// ---------------------------------------------------------------------------------------------------------
const UI = { abierto: null, tab: 0, sub: 0, dup: false, freeze: false, comoProp: false, herrSel: null, avisoT: 0 };
const TXT_ES = { Props: 'Props', Vehicles: 'Vehículos', Entities: 'Entidades', Weapons: 'Armas', Tools: 'Herramientas' };
function aviso(t, s) { const a = $('aviso'); a.textContent = t; a.classList.add('ve'); UI.avisoT = s || 2; }
function uiIniciar() {
  const ic = (id, n) => { const e = $(id); if (e) e.src = icono(n); };
  ic('iPausa', 'Pause'); ic('iMenu', 'wrench'); ic('iChat', 'Chat'); ic('iEmote', 'body'); ic('iCam', 'Camera_2'); ic('iVida', 'heart');
  ic('iDisp', 'target'); ic('iRotar', 'rotate1'); ic('iSalto', 'Jump'); ic('iUsar', 'Use'); ic('iCerrarSpawn', 'wrench-513'); ic('iLogo', 'c');
  // menú de spawn
  const tabs = $('tabs');
  DATA.menu.forEach((c, i) => {
    const t = document.createElement('div'); t.className = 'tab'; t.innerHTML = `<img src="${icono(c.ic)}">${c.n}`;
    t.onclick = () => { UI.tab = i; UI.sub = 0; UI.q = ''; spawnDibujar(); }; tabs.appendChild(t);
  });
  $('iCerrarSpawn').onclick = () => cerrarPaneles();
  // pausa
  $('bSeguir').onclick = () => cerrarPaneles();
  $('bAjustes').onclick = () => abrirAjustes('pausa');
  $('bLimpiar').onclick = () => { for (const o of OBJS.filter((x) => !x.remoto)) borrarObjeto(o); cerrarPaneles(); aviso('Listo: mapa limpio'); };
  $('bGuardar').onclick = () => { guardarConstruccion(); cerrarPaneles(); };
  $('bCargar').onclick = () => { cargarConstruccion(); cerrarPaneles(); };
  $('bSalirMenu').onclick = () => { cerrarPaneles(); irMenuPrincipal(); };
  $('bEmoCerrar').onclick = () => cerrarPaneles();
  document.body.classList.toggle('sinUI', !!PREFS.ocultarUI);
  // emotes
  const el = $('emoLista');
  emoDibujar();
  hudIniciar(); // (íconos propios y lugares de los botones como el original)
  // chat
  $('chatIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const t = $('chatIn').value.trim(); $('chatIn').value = ''; $('chatIn').classList.add('oc'); if (t) chatEnviar(t); } if (e.key === 'Escape') $('chatIn').classList.add('oc'); });
}
function spawnDibujar() {
  const cats = DATA.menu, C = cats[UI.tab] || cats[0];
  [...$('tabs').children].forEach((t, i) => t.classList.toggle('sel', i === UI.tab));
  const cl = $('cats'), gr = $('grilla'), pie = $('pie'), ins = $('ins');
  cl.innerHTML = ''; gr.innerHTML = ''; ins.classList.add('oc');
  if (C.n === 'Host') { pie.innerHTML = ''; const d = document.createElement('div'); d.className = 'cat sel'; d.textContent = typeof SALA !== 'undefined' && SALA ? SALA.n : Lc('Singleplayer', 'Un jugador'); cl.appendChild(d); hostDibujar(gr); return; }
  if (C.n === 'Tools') {
    // herramientas: lista + inspector de parámetros (como el juego)
    DATA.herr.forEach((h, i) => {
      const d = document.createElement('div'); d.className = 'cat' + (UI.herrSel === i ? ' sel' : ''); d.textContent = h.n;
      d.onclick = () => { UI.herrSel = i; equiparHerramienta(i); spawnDibujar(); }; cl.appendChild(d);
    });
    gr.innerHTML = '<div style="padding:10px;font-size:13px;color:#ccc">Elegí una herramienta. Se usa con la Tool Gun: clic izquierdo para aplicar, derecho para la opción.</div>';
    if (UI.herrSel !== null) inspectorHerramienta(ins);
    pie.innerHTML = '';
    return;
  }
  // buscador (en todas las categorías de la pestaña) y las categorías; en Props, primero la de los mods que ponen cosas
  const subs = spawnSubs(C), q = (UI.q || '').trim().toLowerCase();
  const bus = document.createElement('div'); bus.className = 'spBus'; bus.innerHTML = `${glifo('buscar')}<input id="spQ" maxlength="30" spellcheck="false" placeholder="${esc(T('buscar'))}">`;
  cl.appendChild(bus); const qi = bus.querySelector('input'); qi.value = UI.q || '';
  qi.oninput = () => { UI.q = qi.value; spawnGrilla(C, subs); }; qi.onkeydown = (e) => e.stopPropagation();
  subs.forEach((s, i) => {
    const d = document.createElement('div'); d.className = 'cat' + (i === UI.sub && !q ? ' sel' : '') + (s.mods ? ' catMods' : s.rb ? ' catNueva' : '');
    d.textContent = spawnCatNom(s); d.onclick = () => { UI.sub = i; UI.q = ''; spawnDibujar(); }; cl.appendChild(d);
  });
  spawnGrilla(C, subs);
  if (C.n === 'Weapons') pie.innerHTML = `<label><input type="checkbox" id="chProp" ${UI.comoProp ? 'checked' : ''}>${esc(T('sp.comoProp'))}</label>`;
  else pie.innerHTML = `<label><input type="checkbox" id="chFr" ${UI.freeze ? 'checked' : ''}>${esc(T('sp.congelado'))}</label><span class="spPuso" id="spPuso"></span>`;
  const a = $('chProp'), c = $('chFr');
  if (a) a.onchange = () => (UI.comoProp = a.checked);
  if (c) c.onchange = () => (UI.freeze = c.checked);
}
// las categorías de una pestaña (en Props, la sección Mods primero) y sus nombres
function spawnSubs(C) { return C.n === 'Props' ? [{ n: 'Mods', mods: true, it: modsAssets().map((m) => m.id) }, ...C.sub] : C.sub; }
function spawnCatNom(s) { if (s.mods) return T('mm.mods'); if (s.rb) { const t = T('pc.' + s.n); return t === 'pc.' + s.n ? s.n : t; } return s.n; }
function propNom(it) { const k = 'pr.' + it, t = T(k); return t === k ? it : t; }
// la grilla: la categoría elegida o lo que coincide con la búsqueda en toda la pestaña
function spawnGrilla(C, subs) {
  const gr = $('grilla'); gr.innerHTML = ''; const q = (UI.q || '').trim().toLowerCase();
  $('cats').querySelectorAll('.cat').forEach((d, i) => d.classList.toggle('sel', !q && i === UI.sub));
  const lista = [];
  if (q) { for (const s of subs) for (const it of s.it) { const nom = s.mods ? spawnModNom(it) : propNom(it); if ((nom + ' ' + it).toLowerCase().includes(q) && !lista.some((x) => x.it === it)) lista.push({ it, mods: s.mods }); } }
  else { const S = subs[UI.sub] || subs[0]; if (S) for (const it of S.it) lista.push({ it, mods: S.mods }); }
  // (el terminal secreto de Verity: sólo buscándolo)
  if (/^(terminal|verity)$/.test(q)) { const d = document.createElement('div'); d.className = 'it itMod'; d.innerHTML = `${icoHTML('ico:verity')}<span dir="auto">${esc(T('ver.term.n'))}</span>`; d.onclick = () => { cerrarPaneles(); verTerminalPoner(); }; gr.appendChild(d); }
  for (const { it, mods } of lista.slice(0, 400)) {
    const d = document.createElement('div'); d.className = 'it' + (mods ? ' itMod' : '');
    if (mods) { const m = modsAssets().find((x) => x.id === it); if (!m) continue; d.innerHTML = `${icoHTML(m.icono)}<span dir="auto">${esc(nombreDe(m))}</span>`; d.onclick = () => spawnMod(m); d.dataset.mod = m.id; }
    else {
      const ico = C.n === 'Weapons' ? 'W_' + it : it === 'Box2' ? 'Box2_2' : it;
      d.innerHTML = `<img src="${icono(ico) || icono(it)}" loading="lazy"><span>${esc(propNom(it))}</span>`;
      d.onclick = () => spawnElegir(C.n, it);
    }
    gr.appendChild(d);
  }
  // (la sección Mods vacía: la radio, la tele, el piano y los de la gente se instalan en Mods y mapas)
  if (!lista.length && !gr.children.length) gr.innerHTML = `<div class="spVacio">${esc(T(!q && (subs[UI.sub] || {}).mods ? 'mm.instalaAssets' : 'sinRes'))}</div>`;
}
const spawnModNom = (id) => { const m = modsAssets().find((x) => x.id === id); return m ? nombreDe(m) : id; };
// un mod de assets: los oficiales ponen su entidad (radio, piano, pantalla); los de la gente, sus props
function spawnMod(m) {
  if (JUEGO.estado !== 'juego') return;
  cerrarPaneles();
  if (m.nativo) { entidadPonerMod(m.nativo); return; }
  const ap = (m.efectos && m.efectos.aparecer) || []; if (ap.length) aparecerDelante(ap.slice(0, 60));
}
// abrir el menú de props en la sección Mods (desde el menú MOD), con el elegido marcado
function spawnAbrirMods(id) {
  const i = DATA.menu.findIndex((c) => c.n === 'Props'); if (i < 0) return;
  cerrarPaneles(); UI.tab = i; UI.sub = 0; UI.q = ''; abrirSpawn();
  const d = id && $('grilla').querySelector(`[data-mod="${CSS.escape(id)}"]`); if (d) { d.classList.add('marca'); d.scrollIntoView({ block: 'nearest' }); }
}
function spawnElegir(tab, nombre) {
  if (tab === 'Weapons' && !UI.comoProp) { darArma(nombre); cerrarPaneles(); return; }
  // (el menú queda abierto para poner uno o más: abajo dice qué se puso)
  const o = spawnDelante(nombre, { congelado: UI.freeze }), e = $('spPuso');
  if (o && e) { UI.puestos = (UI.puestos || 0) + 1; e.textContent = `${T('sp.puesto')}: ${propNom(nombre)}${UI.puestos > 1 ? ' (' + UI.puestos + ')' : ''}`; e.classList.remove('ve'); void e.offsetWidth; e.classList.add('ve'); }
}
// crea la cosa donde apunta el jugador (o 4 m adelante), mirándolo
// reglas de la sala (Create Server del juego): Nextbot sí/no, tope de props y de vehículos
let _vehs = null;
function reglaSala(nombre) {
  // la noche en la pizzería: mientras corre no se pone nada (ni para trabar las puertas)
  if (typeof NOC !== 'undefined' && NOC.on && ['intro', 'juega', 'apagon', 'perdiendo'].includes(NOC.estado)) { aviso(T('fn.sinCosas'), 2); return false; }
  if (typeof SALA === 'undefined' || !SALA) return true;
  if (!SALA.nb && /nextbot/i.test(nombre)) { aviso('Nextbot: OFF', 1.5); return false; }
  if (HOST.ds && !soyAnfitrion()) { aviso(Lc('HostDisabledSpawnObjects', 'Host disabled spawn objects'), 2); return false; }
  if (!_vehs) { _vehs = new Set(); const v = DATA.menu.find((c) => c.n === 'Vehicles'); if (v) for (const sc of v.sub) for (const it of sc.it) _vehs.add(typeof it === 'string' ? it : it.n); }
  const mios = OBJS.filter((o) => !o.remoto), nv = mios.filter((o) => _vehs.has(o.nombre)).length;
  if (_vehs.has(nombre) ? nv >= SALA.mv : mios.length - nv >= SALA.mp) { aviso(Lc(_vehs.has(nombre) ? 'MaxVehiclesMessage' : 'MaxPropsMessage', 'Limit'), 2); return false; }
  return true;
}
function spawnDelante(nombre, opt) {
  if (!reglaSala(nombre)) return null;
  const cam = CAM, d = cam.fwd, h = raycast(cam.pos, d, 40, JUG.vehiculo ? JUG.vehiculo.b : null);
  const p = h ? vadd(cam.pos, vscale(d, Math.max(0.5, h.t - 0.05))) : vadd(cam.pos, vscale(d, 6));
  if (!h) { const g = mundoRayo(p, v3(0, -1, 0), 50); if (g) p.y -= g.t; }
  const q = Quat.axis(0, 1, 0, JUG.yaw + Math.PI);
  const o = crearObjeto(nombre, p, q, opt);
  if (o) { DESHACER.push(o); if (typeof redObjeto === 'function') redObjeto(o); }
  return o;
}
function abrirSpawn() { UI.abierto = 'spawn'; UI.puestos = 0; $('spawn').classList.remove('oc'); spawnDibujar(); soltarPuntero(); }
function cerrarPaneles() {
  UI.abierto = null; if (typeof MODM !== 'undefined' && MODM.abierto) modMenuCerrar();
  for (const id of ['spawn', 'pausa', 'ajustes', 'emotes']) $(id).classList.add('oc');
  for (const id of ['radioPan', 'creaPan', 'rolPan', 'smPan', 'verPan', 'verTuto', 'verTerm', 'verCrea']) { const p = $(id); if (p) p.classList.add('oc'); } if (typeof RADIO !== 'undefined') RADIO.e = null; if (typeof SMOD !== 'undefined') SMOD.abierto = false;
  $('chatIn').classList.add('oc');
  if (typeof memePanCerrar === 'function') memePanCerrar();
  if (typeof maqPanelCerrar === 'function') { maqPanelCerrar(); if ($('maqVista') && !$('maqVista').classList.contains('oc')) maqVistaCerrar(); }
}
function soltarPuntero() { if (document.pointerLockElement) document.exitPointerLock(); ENT.disparo = ENT.disparo2 = false; }
function abrirPausa() { UI.abierto = 'pausa'; $('pausa').classList.remove('oc'); soltarPuntero(); }
function abrirEmotes() { UI.abierto = 'emotes'; $('emotes').classList.remove('oc'); soltarPuntero(); }
function abrirChat() { const c = $('chatIn'); c.classList.remove('oc'); c.focus(); soltarPuntero(); UI.abierto = 'chat'; }
const CHAT = [];
function chatMostrar(quien, t) {
  CHAT.push({ t: `${quien}: ${t}`, v: 12 }); if (CHAT.length > 8) CHAT.shift();
}
function chatEnviar(t) { UI.abierto = null; chatMostrar(PREFS.nombre, t); if (typeof redChat === 'function') redChat(t); verChat(t); }
function abrirAjustes(desde) {
  const c = $('ajustesCaja');
  const sel = (id, ops) => `<select id="${id}">${ops.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`;
  c.innerHTML = `<h3>${Lc('Settings', 'Ajustes')}</h3>
  <div class="fila">Gráficos ${sel('aG', [['auto', 'Automático'], ['patata', 'Patata (muy bajo)'], ['bajo', 'Bajo'], ['medio', 'Medio'], ['alto', 'Alto'], ['ultra', 'Ultra (realista)']])}</div>
  <div class="fila">${Lc('Shadow', 'Sombra')} ${sel('aSo', [['auto', 'Según gráficos'], ['0', 'No'], ['1', 'Bajas'], ['2', 'Medias'], ['3', 'Altas (suaves)']])}</div>
  <div class="fila">${Lc('PostProcessing', 'Postprocesado')} ${sel('aPo', [['auto', 'Según gráficos'], ['si', 'Sí'], ['no', 'No']])}</div>
  <div class="fila">${Lc('TextureQuality', 'Calidad de textura')} ${sel('aTq', [['auto', 'Según gráficos'], ['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']])}</div>
  <div class="fila">Motor gráfico ${sel('aM', [['webgl1', 'WebGL 1 (compatible)'], ['webgl2', 'WebGL 2']])}</div>
  <div class="fila">Resolución <input type="range" id="aR" min="35" max="100" step="5"><span id="aRv"></span></div>
  <div class="fila"><label><input type="checkbox" id="aDin"> Resolución dinámica (baja la resolución antes que los efectos para mantener los cuadros)</label></div>
  <div class="fila">Distancia <input type="range" id="aD" min="100" max="1200" step="50"><span id="aDv"></span></div>
  <div class="fila">${Lc('Sensitivity', 'Sensibilidad')} <input type="range" id="aS" min="2" max="40" step="1"></div>
  <div class="fila">Volumen <input type="range" id="aV" min="0" max="100" step="5"></div>
  ${ENT.tactil || COARSE ? `<div class="fila">${esc(T('aj.hud'))} <input type="range" id="aH" min="60" max="120" step="5"><span id="aHv"></span></div>` : ''}
  <div class="fila"><label><input type="checkbox" id="aC"> Contorno (resaltar lo que apuntás)</label></div>
  <div class="fila"><label><input type="checkbox" id="aU"> ${Lc('HideUI', 'Ocultar UI')}</label></div>
  <div class="fila"><label><input type="checkbox" id="aF"> Mostrar FPS</label></div>
  <button class="boton" id="aOk">Listo</button>`;
  $('aM').value = PREFS.motor === 'webgl2' ? 'webgl2' : 'webgl1';
  $('aG').value = PREFS.gfx; $('aSo').value = String(PREFS.sombras); $('aPo').value = PREFS.post; $('aTq').value = PREFS.texQ;
  $('aR').value = PREFS.res; $('aD').value = PREFS.lejos; $('aS').value = PREFS.sens; $('aV').value = PREFS.vol; $('aF').checked = PREFS.fps; $('aC').checked = PREFS.contorno !== false; $('aU').checked = !!PREFS.ocultarUI; $('aDin').checked = PREFS.resDin !== false;
  if ($('aH')) $('aH').value = PREFS.hud || 80;
  const act = () => { $('aRv').textContent = $('aR').value + '%'; $('aDv').textContent = $('aD').value + ' m'; if ($('aH')) $('aHv').textContent = $('aH').value + '%'; };
  act();
  $('aG').onchange = () => { PREFS.gfx = $('aG').value; const p = PERFILES[PREFS.gfx]; if (p) { PREFS.res = p.res; PREFS.lejos = p.lejos; $('aR').value = p.res; $('aD').value = p.lejos; } act(); };
  $('aR').oninput = $('aD').oninput = act;
  // el tamaño de los controles se ve al moverlo
  if ($('aH')) $('aH').oninput = () => { act(); PREFS.hud = +$('aH').value; hudDisponer(); };
  $('aOk').onclick = () => {
    const texAntes = GFX.texMax;
    PREFS.res = +$('aR').value; PREFS.lejos = +$('aD').value; PREFS.sens = +$('aS').value; PREFS.vol = +$('aV').value; PREFS.fps = $('aF').checked;
    PREFS.sombras = $('aSo').value; PREFS.post = $('aPo').value; PREFS.texQ = $('aTq').value; PREFS.contorno = $('aC').checked; PREFS.ocultarUI = $('aU').checked; PREFS.resDin = $('aDin').checked;
    if ($('aH')) PREFS.hud = +$('aH').value;
    const motorAntes = PREFS.motor === 'webgl2' ? 'webgl2' : 'webgl1'; PREFS.motor = $('aM').value;
    guardarPrefs();
    // cambiar de motor necesita empezar de nuevo (el contexto de WebGL no se puede cambiar)
    if (PREFS.motor !== motorAntes) { aviso('Reiniciando con ' + (PREFS.motor === 'webgl2' ? 'WebGL 2' : 'WebGL 1') + '…', 2); setTimeout(() => location.reload(), 600); return; }
    aplicarGfx(); if (GFX.texMax !== texAntes) texturasRecargar();
    document.body.classList.toggle('sinUI', !!PREFS.ocultarUI);
    $('ajustes').classList.add('oc'); if (desde === 'pausa') $('pausa').classList.remove('oc');
  };
  $('ajustes').classList.remove('oc'); if (desde === 'pausa') $('pausa').classList.add('oc');
}
// ---------------- HUD por cuadro ----------------
function hudActualizar(dt) {
  if (UI.abierto !== UI.xVisto) { UI.xVisto = UI.abierto; ponerX(); }
  if (UI.avisoT > 0) { UI.avisoT -= dt; if (UI.avisoT <= 0) $('aviso').classList.remove('ve'); }
  const v = Math.max(0, Math.round(JUG.vida));
  if (hudActualizar.v !== v) { hudActualizar.v = v; $('vidaN').textContent = v; $('vidaB').style.width = Math.max(0, Math.min(100, v / (JUG.vidaMax || 100) * 100)) + '%'; }
  let ch = ''; for (const c of CHAT) { c.v -= dt; if (c.v > 0) ch += `<div>${c.h || c.t.replace(/[<>&]/g, '')}</div>`; }
  if (hudActualizar.ch !== ch) { hudActualizar.ch = ch; $('chat').innerHTML = ch; }
}

// ---------------- menús: una X para cerrar y tocar afuera para volver a jugar ----------------
// (el menú MOD se cierra solo al tocar afuera: modmenu.js; el chat se cierra sin mandar nada)
const PANEL_DE = { spawn: 'spawn', pausa: 'pausa', emotes: 'emotes', memes: 'memePan', maq: 'maqPan', sm: 'smPan', radio: 'radioPan', verity: 'verPan', terminal: 'verTerm' };
const panelAbierto = () => { const id = PANEL_DE[UI.abierto], p = id && $(id); return p && !p.classList.contains('oc') ? p : null; };
// lo que se ve del menú (en los que oscurecen la pantalla, la caja del medio)
const cajaDe = (p) => (p.classList.contains('panel') ? p.querySelector('.caja') || p : p);
addEventListener('pointerdown', (e) => {
  if (!UI.abierto) return;
  const t = e.target;
  if (UI.abierto === 'chat') { if (t !== $('chatIn')) { $('chatIn').classList.add('oc'); $('chatIn').blur(); UI.abierto = null; } return; }
  const p = panelAbierto(); if (!p) return;
  if (t.closest && t.closest('[data-btn], .modmBt')) return;   // (los botones de la pantalla abren y cierran lo suyo)
  if (cajaDe(p).contains(t)) return;
  const aj = $('ajustes'); if (aj && !aj.classList.contains('oc') && aj.contains(t) && t !== aj) return;   // (ajustes, encima de la pausa)
  cerrarPaneles();
}, true);
const X_SVG = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
function ponerX() {
  const p = panelAbierto(); if (!p) return;
  const c = cajaDe(p); if (c.querySelector('.xCerrar, .mmX, .mqX')) return;
  const b = document.createElement('button'); b.className = 'xCerrar'; b.setAttribute('aria-label', T('cerrar')); b.innerHTML = X_SVG;
  b.addEventListener('click', (e) => { e.stopPropagation(); cerrarPaneles(); });
  if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
  c.appendChild(b);
}
