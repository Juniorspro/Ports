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
  ic('iDisp', 'target'); ic('iRotar', 'rotate1'); ic('iSalto', 'Jump'); ic('iUsar', 'Use'); ic('iCerrarSpawn', 'wrench-513'); ic('iLogo', 'c'); ic('cargaLogo', 'c');
  // menú de spawn
  const tabs = $('tabs');
  DATA.menu.filter((c) => c.n !== 'Host').forEach((c, i) => {
    const t = document.createElement('div'); t.className = 'tab'; t.innerHTML = `<img src="${icono(c.ic)}">${c.n}`;
    t.onclick = () => { UI.tab = i; UI.sub = 0; spawnDibujar(); }; tabs.appendChild(t);
  });
  $('iCerrarSpawn').onclick = () => cerrarPaneles();
  // pausa
  $('bSeguir').onclick = () => cerrarPaneles();
  $('bAjustes').onclick = () => abrirAjustes('pausa');
  $('bAjustes2').onclick = () => abrirAjustes('principal');
  $('bLimpiar').onclick = () => { for (const o of OBJS.filter((x) => !x.remoto)) borrarObjeto(o); cerrarPaneles(); aviso('Listo: mapa limpio'); };
  $('bGuardar').onclick = () => { guardarConstruccion(); cerrarPaneles(); };
  $('bCargar').onclick = () => { cargarConstruccion(); cerrarPaneles(); };
  $('bSalirMenu').onclick = () => { cerrarPaneles(); irMenuPrincipal(); };
  $('bEmoCerrar').onclick = () => cerrarPaneles();
  $('bSkins').onclick = () => abrirSkins();
  $('bSkinOk').onclick = () => { $('skinsP').classList.add('oc'); guardarPrefs(); };
  $('bJugar').onclick = () => { if (PREFS.modo === 'privada' && !(PREFS.codigo || '').trim()) { PREFS.codigo = Math.random().toString(36).slice(2, 7).toUpperCase(); $('codigo').value = PREFS.codigo; guardarPrefs(); } empezarPartida(PREFS.mapa); };
  const modos = () => { for (const b of $('modos').children) b.classList.toggle('sel', b.dataset.m === PREFS.modo); $('codigo').classList.toggle('oc', PREFS.modo !== 'privada'); };
  for (const b of $('modos').children) b.onclick = () => { PREFS.modo = b.dataset.m; guardarPrefs(); modos(); };
  $('codigo').value = PREFS.codigo || ''; $('codigo').oninput = () => { PREFS.codigo = $('codigo').value.trim(); guardarPrefs(); };
  modos();
  $('nombre').value = PREFS.nombre; $('nombre').oninput = () => { PREFS.nombre = $('nombre').value.trim() || 'Player'; guardarPrefs(); };
  const mp = $('mapas');
  for (const m of MAPAS) {
    const d = document.createElement('div'); d.className = 'mapa' + (m === PREFS.mapa ? ' sel' : ''); d.innerHTML = `<img src="${icono(MAPA_ICONO[m])}">${m}`;
    d.onclick = () => { PREFS.mapa = m; guardarPrefs(); for (const x of mp.children) x.classList.remove('sel'); d.classList.add('sel'); };
    mp.appendChild(d);
  }
  // emotes
  const el = $('emoLista');
  for (const e of DATA.emotes) { const d = document.createElement('div'); d.className = 'skin'; d.innerHTML = `<img src="${icono(e === 'Kick' ? 'Roundhouse_Kick' : e)}" onerror="this.style.visibility='hidden'"><br>${e}`; d.onclick = () => { cerrarPaneles(); if (typeof emote === 'function') emote(e); }; el.appendChild(d); }
  // chat
  $('chatIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const t = $('chatIn').value.trim(); $('chatIn').value = ''; $('chatIn').classList.add('oc'); if (t) chatEnviar(t); } if (e.key === 'Escape') $('chatIn').classList.add('oc'); });
}
function spawnDibujar() {
  const cats = DATA.menu.filter((c) => c.n !== 'Host'), C = cats[UI.tab];
  [...$('tabs').children].forEach((t, i) => t.classList.toggle('sel', i === UI.tab));
  const cl = $('cats'), gr = $('grilla'), pie = $('pie'), ins = $('ins');
  cl.innerHTML = ''; gr.innerHTML = ''; ins.classList.add('oc');
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
  C.sub.forEach((s, i) => { const d = document.createElement('div'); d.className = 'cat' + (i === UI.sub ? ' sel' : ''); d.textContent = s.n; d.onclick = () => { UI.sub = i; spawnDibujar(); }; cl.appendChild(d); });
  const S = C.sub[UI.sub] || C.sub[0];
  if (S) for (const it of S.it) {
    const d = document.createElement('div'); d.className = 'it';
    const ico = C.n === 'Weapons' ? 'W_' + it : it === 'Box2' ? 'Box2_2' : it;
    d.innerHTML = `<img src="${icono(ico) || icono(it)}" loading="lazy">${it}`;
    d.onclick = () => spawnElegir(C.n, it);
    gr.appendChild(d);
  }
  if (C.n === 'Weapons') pie.innerHTML = `<label><input type="checkbox" id="chProp" ${UI.comoProp ? 'checked' : ''}>Spawn As Prop</label>`;
  else pie.innerHTML = `<label><input type="checkbox" id="chDup" ${UI.dup ? 'checked' : ''}>Dup. Spawn</label><label><input type="checkbox" id="chFr" ${UI.freeze ? 'checked' : ''}>Freeze</label>`;
  const a = $('chProp'), b = $('chDup'), c = $('chFr');
  if (a) a.onchange = () => (UI.comoProp = a.checked);
  if (b) b.onchange = () => (UI.dup = b.checked);
  if (c) c.onchange = () => (UI.freeze = c.checked);
}
function spawnElegir(tab, nombre) {
  if (tab === 'Weapons' && !UI.comoProp) { darArma(nombre); if (!UI.dup) cerrarPaneles(); return; }
  spawnDelante(nombre, { congelado: UI.freeze });
  if (!UI.dup) cerrarPaneles();
}
// crea la cosa donde apunta el jugador (o 4 m adelante), mirándolo
function spawnDelante(nombre, opt) {
  const cam = CAM, d = cam.fwd, h = raycast(cam.pos, d, 40, JUG.vehiculo ? JUG.vehiculo.b : null);
  const p = h ? vadd(cam.pos, vscale(d, Math.max(0.5, h.t - 0.05))) : vadd(cam.pos, vscale(d, 6));
  if (!h) { const g = mundoRayo(p, v3(0, -1, 0), 50); if (g) p.y -= g.t; }
  const q = Quat.axis(0, 1, 0, JUG.yaw + Math.PI);
  const o = crearObjeto(nombre, p, q, opt);
  if (o) { DESHACER.push(o); if (typeof redObjeto === 'function') redObjeto(o); }
  return o;
}
function abrirSpawn() { UI.abierto = 'spawn'; $('spawn').classList.remove('oc'); spawnDibujar(); soltarPuntero(); }
function cerrarPaneles() {
  UI.abierto = null;
  for (const id of ['spawn', 'pausa', 'ajustes', 'emotes', 'skinsP']) $(id).classList.add('oc');
  $('chatIn').classList.add('oc');
}
function soltarPuntero() { if (document.pointerLockElement) document.exitPointerLock(); ENT.disparo = ENT.disparo2 = false; }
function abrirPausa() { UI.abierto = 'pausa'; $('pausa').classList.remove('oc'); soltarPuntero(); }
function abrirEmotes() { UI.abierto = 'emotes'; $('emotes').classList.remove('oc'); soltarPuntero(); }
function abrirChat() { const c = $('chatIn'); c.classList.remove('oc'); c.focus(); soltarPuntero(); UI.abierto = 'chat'; }
const CHAT = [];
function chatMostrar(quien, t) {
  CHAT.push({ t: `${quien}: ${t}`, v: 12 }); if (CHAT.length > 8) CHAT.shift();
}
function chatEnviar(t) { UI.abierto = null; chatMostrar(PREFS.nombre, t); if (typeof redChat === 'function') redChat(t); }
function abrirAjustes(desde) {
  const c = $('ajustesCaja');
  c.innerHTML = `<h3>Ajustes</h3>
  <div class="fila">Gráficos <select id="aG"><option value="auto">Automático</option><option value="patata">Patata (muy bajo)</option><option value="bajo">Bajo</option><option value="medio">Medio</option><option value="alto">Alto</option></select></div>
  <div class="fila">Resolución <input type="range" id="aR" min="35" max="100" step="5"><span id="aRv"></span></div>
  <div class="fila">Distancia <input type="range" id="aD" min="100" max="900" step="50"><span id="aDv"></span></div>
  <div class="fila">Sensibilidad <input type="range" id="aS" min="2" max="40" step="1"></div>
  <div class="fila">Volumen <input type="range" id="aV" min="0" max="100" step="5"></div>
  <div class="fila"><label><input type="checkbox" id="aF"> Mostrar FPS</label></div>
  <button class="boton" id="aOk">Listo</button>`;
  $('aG').value = PREFS.gfx; $('aR').value = PREFS.res; $('aD').value = PREFS.lejos; $('aS').value = PREFS.sens; $('aV').value = PREFS.vol; $('aF').checked = PREFS.fps;
  const act = () => { $('aRv').textContent = $('aR').value + '%'; $('aDv').textContent = $('aD').value + ' m'; };
  act();
  $('aG').onchange = () => { PREFS.gfx = $('aG').value; const p = PERFILES[PREFS.gfx]; if (p) { PREFS.res = p.res; PREFS.lejos = p.lejos; $('aR').value = p.res; $('aD').value = p.lejos; } act(); };
  $('aR').oninput = $('aD').oninput = act;
  $('aOk').onclick = () => {
    PREFS.res = +$('aR').value; PREFS.lejos = +$('aD').value; PREFS.sens = +$('aS').value; PREFS.vol = +$('aV').value; PREFS.fps = $('aF').checked;
    guardarPrefs(); aplicarGfx(); $('ajustes').classList.add('oc'); if (desde === 'pausa') $('pausa').classList.remove('oc');
  };
  $('ajustes').classList.remove('oc'); if (desde === 'pausa') $('pausa').classList.add('oc');
}
function abrirSkins() {
  const sl = $('skinLista'), gl = $('gorroLista'); sl.innerHTML = ''; gl.innerHTML = '';
  const retr = { Hero: 'hero', Soldier: 'soldier', Jean: 'jean', Derik: 'derik', Business: 'business', SpecialForcesW: 'specialforce', SpecialForcesM: 'specialforce_2', Prisoner01: 'Prisoner01', PilotFemale: 'PilotFemale', Butcher: 'Butcher', Swat: 'swat', Military: 'Military', Engineer: 'Engineer', Corpse: 'corpse' };
  for (const s of DATA.chars) {
    const d = document.createElement('div'); d.className = 'skin' + (PREFS.skin === s ? ' sel' : ''); d.innerHTML = `<img src="${icono(retr[s] || s)}">${s}`;
    d.onclick = () => { PREFS.skin = s; abrirSkins(); }; sl.appendChild(d);
  }
  for (const h of DATA.hats) {
    const d = document.createElement('div'); d.className = 'skin' + (PREFS.gorro === h ? ' sel' : ''); d.innerHTML = `<img src="${icono(h)}">${h.replace('Hat', '') || 'Nada'}`;
    d.onclick = () => { PREFS.gorro = h; abrirSkins(); }; gl.appendChild(d);
  }
  $('skinsP').classList.remove('oc');
}
// ---------------- HUD por cuadro ----------------
function hudActualizar(dt) {
  if (UI.avisoT > 0) { UI.avisoT -= dt; if (UI.avisoT <= 0) $('aviso').classList.remove('ve'); }
  const v = Math.max(0, Math.round(JUG.vida));
  if (hudActualizar.v !== v) { hudActualizar.v = v; $('vidaN').textContent = v; $('vidaB').style.width = v * 1.5 + 'px'; }
  let ch = ''; for (const c of CHAT) { c.v -= dt; if (c.v > 0) ch += `<div>${c.t.replace(/[<>&]/g, '')}</div>`; }
  if (hudActualizar.ch !== ch) { hudActualizar.ch = ch; $('chat').innerHTML = ch; }
}
