// ---------------- controles a gusto: teclas, botones del celular (dónde y de qué tamaño), tienda de controles y los que agregan los mods ----------------
// Ajustes → Controles: cada acción con su tecla (se toca y se aprieta la nueva; si estaba en otra acción, se cambian);
// "Editar los botones": se arrastra cada botón de la pantalla a donde se quiera y se agranda o achica (con dos dedos o
// con la barra), a pie o en un vehículo; se guarda en el aparato y se puede publicar en la tienda de controles, donde se
// usan los de otros. Las armas de los mods de GMod agregan sus botones: apuntar (el disparo secundario) y las teclas que
// su Lua mira (E, F, zoom, caminar...), que también se pueden mover.
const CTL = { edit: false, modo: 'pie', borrador: null, sel: null, toques: new Map(), pinch: null, desde: null, capturando: null, teclasMod: new Set(), inMod: 0, modArma: '', modBotones: [] };
// [acción, tecla de fábrica] (las acciones que no son pulsos, como caminar, se leen como tecla en entradaLeer)
const CTL_ACC = [['adelante', 'KeyW'], ['atras', 'KeyS'], ['izq', 'KeyA'], ['der', 'KeyD'], ['saltar', 'Space'], ['agachar', 'ControlLeft'], ['correr', 'ShiftLeft'], ['usar', 'KeyE'],
  ['recargar', 'KeyR'], ['menu', 'KeyQ'], ['chat', 'KeyT'], ['camara', 'KeyV'], ['camLibre', 'KeyJ'], ['emotes', 'KeyB'], ['linterna', 'KeyL'], ['noclip', 'KeyN'], ['deshacer', 'KeyZ'],
  ['salir', 'KeyF'], ['celular', 'KeyO'], ['memes', 'KeyI'], ['modmenu', 'KeyU'], ['servmods', 'KeyM'], ['borrarApuntado', 'Delete'], ['pausa', 'KeyP']];
const CTL_DEF = Object.fromEntries(CTL_ACC);
// la tecla que se apretó → la de fábrica de su acción ('' = ninguna: su acción se pasó a otra tecla)
let _ctlMapa = null;
function ctlMapa() {
  if (_ctlMapa) return _ctlMapa;
  const m = new Map(), P = PREFS.teclas || {};
  for (const [a, d] of CTL_ACC) { const u = P[a]; if (u && u !== d) m.set(u, d); }
  for (const [a, d] of CTL_ACC) { const u = P[a]; if (u && u !== d && !m.has(d)) m.set(d, ''); }
  return (_ctlMapa = m);
}
const ctlCodigo = (c) => (c === 'Escape' ? c : ctlMapa().has(c) ? ctlMapa().get(c) : c);
const ctlTeclaDe = (a) => (PREFS.teclas && PREFS.teclas[a]) || CTL_DEF[a];
const ctlNomTecla = (c) => (!c ? '—' : c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '↑').replace('ControlLeft', 'Ctrl').replace('ControlRight', 'Ctrl D').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'Shift D').replace('AltLeft', 'Alt').replace('Space', T('ctl.espacio')).replace('Delete', 'Supr'));
function ctlPonerTecla(a, c) {
  PREFS.teclas = Object.assign({}, PREFS.teclas);
  // (si la tecla ya era de otra acción, las dos se cambian)
  for (const [o] of CTL_ACC) if (o !== a && ctlTeclaDe(o) === c) PREFS.teclas[o] = ctlTeclaDe(a);
  PREFS.teclas[a] = c;
  for (const [o, d] of CTL_ACC) if (PREFS.teclas[o] === d) delete PREFS.teclas[o];
  _ctlMapa = null; guardarPrefs();
}

// ---------------- el panel (Ajustes → Controles) ----------------
function ctlAbrir(desde) {
  CTL.desde = desde || CTL.desde || 'pausa';
  let p = $('ctlPanel');
  if (!p) { p = document.createElement('div'); p.id = 'ctlPanel'; p.className = 'panel oc'; p.innerHTML = '<div class="caja" id="ctlCaja"></div>'; document.body.appendChild(p); }
  $('ajustes').classList.add('oc'); p.classList.remove('oc'); UI.abierto = 'ajustes';
  ctlDibujar();
}
function ctlCerrar() { const p = $('ctlPanel'); if (p) p.classList.add('oc'); CTL.capturando = null; abrirAjustes(CTL.desde); }
function ctlDibujar(tab) {
  CTL.tab = tab || CTL.tab || (ENT.tactil || COARSE ? 'tactil' : 'teclas');
  const c = $('ctlCaja'); if (!c) return;
  const pest = (k, t) => `<button class="boton ctlTab${CTL.tab === k ? ' sel' : ''}" data-ctl="tab:${k}">${esc(T(t))}</button>`;
  let cuerpo = '';
  if (CTL.tab === 'teclas') {
    cuerpo = `<div class="ctlLista">${CTL_ACC.map(([a]) => `<div class="fila ctlFila"><span>${esc(T('ctl.a.' + a))}</span><button class="boton ctlTecla${CTL.capturando === a ? ' esperando' : ''}" data-ctl="tecla:${a}">${CTL.capturando === a ? esc(T('ctl.aprieta')) : esc(ctlNomTecla(ctlTeclaDe(a)))}</button></div>`).join('')}</div>
      <div class="fila"><button class="boton" data-ctl="teclasFab">${esc(T('ctl.fabrica'))}</button></div>`;
  } else if (CTL.tab === 'tactil') {
    cuerpo = `<p class="ctlAyuda">${esc(T('ctl.ayudaTac'))}</p>
      <div class="fila"><button class="boton" data-ctl="editar">${esc(T('ctl.editar'))}</button></div>
      <div class="fila">${esc(T('aj.hud'))} <input type="range" id="ctlTam" min="50" max="160" step="5" value="${+PREFS.hud || 80}"><span id="ctlTamV">${+PREFS.hud || 80}%</span></div>
      <div class="fila">${esc(T('ctl.palanca'))} <input type="range" id="ctlPal" min="60" max="160" step="5" value="${Math.round((+PREFS.palTam || 1) * 100)}"><span id="ctlPalV">${Math.round((+PREFS.palTam || 1) * 100)}%</span></div>
      <div class="fila"><button class="boton" data-ctl="hudFab">${esc(T('ctl.fabrica'))}</button></div>${ctlNuevaHTML()}`;
  } else {
    cuerpo = `<div class="fila"><input id="ctlNom" maxlength="40" placeholder="${esc(T('ctl.nombre'))}"><button class="boton" data-ctl="publicar">${esc(T('ctl.publicar'))}</button></div>
      <div class="fila"><input id="ctlBus" type="search" maxlength="40" placeholder="${esc(T('buscar'))}" value="${esc(CTL.q || '')}"></div>
      <div id="ctlTiendaL" class="ctlLista"><p class="ctlAyuda">${esc(T('cargando'))}</p></div>`;
  }
  c.innerHTML = `<h3>${esc(T('ctl.titulo'))}</h3><div class="fila ctlTabs">${pest('teclas', 'ctl.teclado')}${pest('tactil', 'ctl.pantalla')}${pest('tienda', 'ctl.tienda')}</div>${cuerpo}
    <button class="boton" data-ctl="cerrar">${esc(T('ctl.listo'))}</button>`;
  c.onclick = (e) => { const b = e.target.closest('[data-ctl]'); if (b) ctlAccion(b.dataset.ctl); };
  const tam = $('ctlTam'); if (tam) tam.oninput = () => { PREFS.hud = +tam.value; $('ctlTamV').textContent = tam.value + '%'; hudDisponer(); guardarPrefs(); };
  const pal = $('ctlPal'); if (pal) pal.oninput = () => { PREFS.palTam = +pal.value / 100; $('ctlPalV').textContent = pal.value + '%'; hudDisponer(); guardarPrefs(); };
  const bus = $('ctlBus'); if (bus) { let t = 0; bus.oninput = () => { clearTimeout(t); t = setTimeout(() => { CTL.q = bus.value; ctlTiendaCargar(); }, 350); }; }
  if (CTL.tab === 'tienda') ctlTiendaCargar();
}
function ctlAccion(a) {
  const [k, v] = a.split(':');
  if (k === 'tab') return ctlDibujar(v);
  if (k === 'cerrar') return ctlCerrar();
  if (k === 'tecla') { CTL.capturando = CTL.capturando === v ? null : v; return ctlDibujar(); }
  if (k === 'teclasFab') { PREFS.teclas = {}; _ctlMapa = null; guardarPrefs(); return ctlDibujar(); }
  if (k === 'hudFab') { PREFS.hudPos = { _v: 2 }; PREFS.hud = 80; PREFS.palTam = 1; guardarPrefs(); hudDisponer(); return ctlDibujar(); }
  // (GOLDEN) probar la disposición nueva (la tuya queda guardada aparte) y volver a la tuya
  if (k === 'hudNueva') { const o = PREFS.hudPos || {}; PREFS.hudPosV1 = JSON.parse(JSON.stringify(o)); PREFS.hudPos = o._orden ? { _v: 2, _orden: o._orden } : { _v: 2 }; guardarPrefs(); hudDisponer(); aviso(T('hud.probando'), 3); return ctlDibujar(); }
  if (k === 'hudMia') { if (PREFS.hudPosV1) PREFS.hudPos = PREFS.hudPosV1; delete PREFS.hudPosV1; guardarPrefs(); hudDisponer(); return ctlDibujar(); }
  if (k === 'editar') return ctlEditar();
  if (k === 'publicar') return ctlPublicar();
  if (k === 'usar') return ctlUsarDeTienda(v);
}
// (mientras se espera la tecla nueva, esa tecla no le llega al juego)
addEventListener('keydown', (e) => {
  if (!CTL.capturando) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code !== 'Escape') ctlPonerTecla(CTL.capturando, e.code);
  CTL.capturando = null; ctlDibujar();
}, true);

// ---------------- el editor de los botones de la pantalla ----------------
const CTL_VEH = new Set(['#bgas', '#bfreno', '#bizq', '#bder', '#bmanual', '#bbajar', '#bbocina', '#bturbo']);
const ctlPosiciones = () => (CTL.edit ? CTL.borrador : PREFS.hudPos) || {};
function ctlEditables() {
  return HUD_TACTIL.filter((r) => { const e = document.querySelector(r[0]); return e && (CTL_VEH.has(r[0]) === (CTL.modo === 'veh')); });
}
function ctlEditar() {
  const p = $('ctlPanel'); if (p) p.classList.add('oc');
  CTL.edit = true; CTL.borrador = JSON.parse(JSON.stringify(PREFS.hudPos || {})); CTL.sel = null;
  if (hudVer(CTL.borrador) === 2) CTL.borrador._v = 2; CTL.tacAntes = document.body.classList.contains('tactil');   // (la nueva sigue siendo la nueva aunque se mueva un botón)
  document.body.classList.add('tactil', 'ctlEdit'); if (typeof soltarPuntero === 'function') soltarPuntero();
  let o = $('ctlEd');
  if (!o) {
    o = document.createElement('div'); o.id = 'ctlEd';
    o.innerHTML = `<div class="ctlBarra"><button class="boton" data-ce="modo"></button><span class="ctlTamBox">${esc(T('ctl.tam'))} <input type="range" id="ctlSelTam" min="40" max="260" step="5"></span>
      <button class="boton" data-ce="ordenar">${esc(T('hud.ordenar'))}</button><button class="boton ctlIA" data-ce="ordenarIA">${esc(T('hud.ordenarIA'))}</button>
      <button class="boton" data-ce="fab">${esc(T('ctl.fabrica'))}</button><button class="boton" data-ce="cancelar">${esc(T('ctl.cancelar'))}</button><button class="boton ctlGuardar" data-ce="guardar">${esc(T('ctl.guardar'))}</button></div>`;
    document.body.appendChild(o);
    o.querySelector('.ctlBarra').addEventListener('pointerdown', (e) => e.stopPropagation());
    o.querySelector('.ctlBarra').onclick = (e) => { const b = e.target.closest('[data-ce]'); if (!b) return; const a = b.dataset.ce;
      if (a === 'modo') { CTL.modo = CTL.modo === 'veh' ? 'pie' : 'veh'; CTL.sel = null; ctlMostrar(); }
      else if (a === 'fab') { CTL.borrador = { _v: 2 }; ctlMostrar(); }
      else if (a === 'ordenar' || a === 'ordenarIA') { if (typeof hudOrdenBoton === 'function') hudOrdenBoton(a === 'ordenarIA', b); }
      else if (a === 'cancelar') ctlSalirEditor(false);
      else if (a === 'guardar') ctlSalirEditor(true); };
    o.addEventListener('pointerdown', ctlToqueIni); o.addEventListener('pointermove', ctlToqueMov); o.addEventListener('pointerup', ctlToqueFin); o.addEventListener('pointercancel', ctlToqueFin);
    $('ctlSelTam').oninput = () => { const r = CTL.sel && HUD_TACTIL.find((x) => x[0] === CTL.sel); if (!r) return; const q = ctlPosDe(r); CTL.borrador[r[0]] = [q[0], q[1], Math.round(r[5] * +$('ctlSelTam').value / 10) / 10]; hudDisponer(); };
  }
  o.classList.remove('oc'); ctlMostrar();
}
// a pie o en vehículo: se ven todos los botones de ese modo (aunque el arma o la situación los escondan)
function ctlMostrar() {
  const ver = new Set(ctlEditables().map((r) => r[0]));
  for (const r of HUD_TACTIL) { const e = document.querySelector(r[0]); if (!e) continue; e.classList.toggle('ctlVer', ver.has(r[0])); e.classList.toggle('ctlSel', r[0] === CTL.sel); }
  document.body.classList.toggle('enVeh', CTL.modo === 'veh');
  for (let i = 0; i < 4; i++) { const e = $('bmod' + i); if (e && !e._ctl) e.innerHTML = '<b class="ctlLetra larga">MOD</b>'; }   // (dónde van los botones que agregan las armas de los mods)
  const b = document.querySelector('#ctlEd [data-ce=modo]'); if (b) b.textContent = T(CTL.modo === 'veh' ? 'ctl.enVeh' : 'ctl.aPie');
  const r = CTL.sel && HUD_TACTIL.find((x) => x[0] === CTL.sel), tb = document.querySelector('.ctlTamBox');
  if (tb) tb.style.visibility = r ? '' : 'hidden';
  if (r) $('ctlSelTam').value = Math.round(ctlPosDe(r)[2] / r[5] * 100);
  hudDisponer();
}
const ctlPosDe = (r) => { const o = ctlPosiciones()[r[0]]; return o && o.length === 3 ? o : (typeof HUD !== 'undefined' && HUD.ef && HUD.ef[r[0]]) || [r[3], r[4], r[5]]; };
// el botón que está debajo del dedo (en las coordenadas de la pantalla girada, como los ubica hudDisponer)
function ctlBotonEn(x, y) {
  let mejor = null, md = 1e9;
  for (const r of ctlEditables()) {
    const e = document.querySelector(r[0]); if (!e || !e.style.left) continue;
    const l = parseFloat(e.style.left), t = parseFloat(e.style.top), w = parseFloat(e.style.width), h = parseFloat(e.style.height), cx = l + w / 2, cy = t + h / 2, d = Math.hypot(x - cx, y - cy);
    if (d < Math.max(w, h) / 2 + 10 && d < md) { md = d; mejor = r; }
  }
  return mejor;
}
function ctlToqueIni(e) {
  e.preventDefault(); const x = tX(e), y = tY(e); CTL.toques.set(e.pointerId, { x, y });
  if (CTL.toques.size === 2 && CTL.sel) { const [a, b] = [...CTL.toques.values()]; const r = HUD_TACTIL.find((q) => q[0] === CTL.sel); CTL.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), s0: ctlPosDe(r)[2] }; return; }
  const r = ctlBotonEn(x, y); CTL.sel = r ? r[0] : null; CTL.arr = r ? { id: e.pointerId, x0: x, y0: y, p0: ctlPosDe(r).slice() } : null; ctlMostrar();
}
function ctlToqueMov(e) {
  if (!CTL.toques.has(e.pointerId)) return; e.preventDefault();
  const x = tX(e), y = tY(e); CTL.toques.set(e.pointerId, { x, y });
  const r = CTL.sel && HUD_TACTIL.find((q) => q[0] === CTL.sel); if (!r) return;
  const kb = Math.sqrt((VW() / 1280) * (VH() / 720));
  if (CTL.pinch && CTL.toques.size >= 2) { const [a, b] = [...CTL.toques.values()]; const q = ctlPosDe(r), s = clamp(CTL.pinch.s0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(10, CTL.pinch.d0), r[5] * 0.4, r[5] * 2.6); CTL.borrador[r[0]] = [q[0], q[1], Math.round(s * 10) / 10]; ctlMostrar(); return; }
  if (CTL.arr && CTL.arr.id === e.pointerId) {
    // (x crece a la derecha y y para arriba en la referencia de 1280×720; se queda adentro de la pantalla)
    const nx = CTL.arr.p0[0] + (x - CTL.arr.x0) / kb, ny = CTL.arr.p0[1] - (y - CTL.arr.y0) / kb;
    const cx = r[1] * VW() + nx * kb, cy = VH() - (r[2] * VH() + ny * kb), m = 20;
    if (cx < m || cx > VW() - m || cy < m || cy > VH() - m) return;
    CTL.borrador[r[0]] = [Math.round(nx * 10) / 10, Math.round(ny * 10) / 10, CTL.arr.p0[2]]; hudDisponer();
  }
}
function ctlToqueFin(e) { CTL.toques.delete(e.pointerId); if (CTL.toques.size < 2) CTL.pinch = null; if (CTL.arr && CTL.arr.id === e.pointerId) CTL.arr = null; }
function ctlSalirEditor(guardar) {
  if (guardar) { PREFS.hudPos = CTL.borrador; guardarPrefs(); }
  CTL.edit = false; CTL.borrador = null; CTL.sel = null; CTL.toques.clear(); CTL.pinch = null; CTL.arr = null;
  const o = $('ctlEd'); if (o) o.classList.add('oc');
  for (const r of HUD_TACTIL) { const e = document.querySelector(r[0]); if (e) e.classList.remove('ctlVer', 'ctlSel'); }
  document.body.classList.remove('ctlEdit'); if (!CTL.tacAntes && !ENT.tactil) document.body.classList.remove('tactil');
  document.body.classList.toggle('enVeh', !!(JUG && JUG.vehiculo)); HUD.arma = null; CTL.modArma = null; hudDisponer();
  ctlAbrir(); if (guardar) aviso(T('ctl.guardado'), 2);
}

// ---------------- la tienda de controles ----------------
// (v 2: la de «Mejores botones»; en hud va «_v: 2» si es la disposición nueva. Las de antes —v 1, sin «_v»— se siguen viendo como se
// publicaron: hudVer las reconoce y les pone los de fábrica de antes alrededor)
const ctlDatos = () => ({ v: 2, hud: PREFS.hudPos || {}, tam: +PREFS.hud || 80, pal: +PREFS.palTam || 1, teclas: PREFS.teclas || {} });
// (Ajustes → Controles → Pantalla táctil: si tenés tus botones guardados de antes, la nueva se puede probar y volver)
function ctlNuevaHTML() {
  if (typeof hudVer !== 'function') return '';
  if (hudVer(PREFS.hudPos) === 1) return `<div class="fila ctlNueva"><span>${esc(T('hud.nueva'))}</span><button class="boton" data-ctl="hudNueva">${esc(T('hud.probar'))}</button></div>`;
  if (PREFS.hudPosV1) return `<div class="fila ctlNueva"><span>${esc(T('hud.probando'))}</span><button class="boton" data-ctl="hudMia">${esc(T('hud.volverMia'))}</button></div>`;
  return '';
}
async function ctlPublicar() {
  const nom = ($('ctlNom') && $('ctlNom').value.trim()) || '';
  if (nom.length < 2) { aviso(T('ctl.ponNombre'), 2); return; }
  try {
    const r = await fetch(TIENDA_URL + 'controles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nom, autor: PREFS.nombre || '', datos: ctlDatos() }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status);
    aviso(T('ctl.publicado'), 2); CTL.q = ''; ctlDibujar('tienda');
  } catch (e) { aviso(T('ctl.sinTienda') + ' (' + ((e && e.message) || e) + ')', 3); }
}
async function ctlTiendaCargar() {
  const L = $('ctlTiendaL'); if (!L) return;
  try {
    const r = await fetch(TIENDA_URL + 'controles?q=' + encodeURIComponent(CTL.q || '')); if (!r.ok) throw new Error(r.status);
    const it = (await r.json()).items || [];
    if (!$('ctlTiendaL')) return;
    L.innerHTML = it.length ? it.map((x) => `<div class="fila ctlFila"><span><b dir="auto">${esc(x.nombre)}</b> <small>${esc(x.autor || '')} · ${x.usos | 0} ${esc(T('ctl.usos'))}</small></span><button class="boton" data-ctl="usar:${esc(x.id)}">${esc(T('ctl.usar'))}</button></div>`).join('') : `<p class="ctlAyuda">${esc(T('sinRes'))}</p>`;
  } catch (e) { L.innerHTML = `<p class="ctlAyuda">${esc(T('ctl.sinTienda'))}</p>`; }
}
async function ctlUsarDeTienda(id) {
  try {
    const r = await fetch(TIENDA_URL + 'controles/' + encodeURIComponent(id)); if (!r.ok) throw new Error(r.status);
    const d = (await r.json()).datos || {};
    PREFS.hudPos = d.hud || {}; PREFS.hud = d.tam || 80; PREFS.palTam = d.pal || 1; PREFS.teclas = d.teclas || {}; _ctlMapa = null;
    guardarPrefs(); hudDisponer(); aviso(T('ctl.aplicado'), 2); ctlDibujar();
  } catch (e) { aviso(T('ctl.sinTienda'), 2); }
}

// el Lua sin comentarios (--[[ ]], --, /* */ y //): lo que está comentado no cuenta como tecla que el mod usa
function luaSinComentarios(s) { return String(s).replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(--|\/\/)[^\n]*/g, ' '); }
// ---------------- los botones que agregan las armas de los mods ----------------
// Se lee el Lua del arma (y el de su base): las teclas y los IN_ que mira son los botones que necesita en el celular.
const CTL_IN = { USE: ['E', 'KeyE'], ZOOM: ['Zoom', 0x80000], WALK: ['ctl.caminar', 0x40000], SPEED: ['ctl.a.correr', 0x20000], GRENADE1: ['G1', 0x800000], GRENADE2: ['G2', 0x1000000], ALT1: ['Alt', 0x4000], ALT2: ['Alt2', 0x8000] };
const _ctlLeidos = new Map();
function ctlBotonesDeArma(clase) {
  if (_ctlLeidos.has(clase)) return _ctlLeidos.get(clase);
  const td = new TextDecoder('latin1'), fuentes = [], vistas = new Set();
  const juntar = (c) => {
    if (!c || vistas.has(c)) return; vistas.add(c);
    for (const A of GMOD.addons.values()) for (const r of A.lua) if (new RegExp('^lua/weapons/' + c.replace(/[^\w-]/g, '') + '(\\.lua|/)').test(r)) { const b = A.G.archivos.get(r); if (b) fuentes.push(td.decode(b)); }
    const t = typeof claseTabla === 'function' ? claseTabla(c, 'S') : null, base = t && t.get('Base'); if (typeof base === 'string') juntar(base.toLowerCase());
  };
  juntar(clase);
  const s = luaSinComentarios(fuentes.join('\n')), out = [];
  for (const m of s.matchAll(/\bIN_(USE|ZOOM|WALK|SPEED|GRENADE1|GRENADE2|ALT1|ALT2)\b/g)) { const d = CTL_IN[m[1]]; if (d && !out.some((x) => x.id === 'IN_' + m[1])) out.push({ id: 'IN_' + m[1], t: /^ctl\./.test(d[0]) ? T(d[0]) : d[0], tecla: typeof d[1] === 'string' ? d[1] : null, bit: typeof d[1] === 'number' ? d[1] : 0 }); }
  // (la rueda y los botones de costado del mouse: MOUSE_MIDDLE, MOUSE_4 y MOUSE_5)
  for (const m of s.matchAll(/\bMOUSE_(MIDDLE|4|5)\b/g)) { const r = { MIDDLE: 109, 4: 110, 5: 111 }[m[1]]; if (!out.some((x) => x.raton === r)) out.push({ id: 'MOUSE_' + m[1], t: m[1] === 'MIDDLE' ? 'M3' : 'M' + m[1], tecla: null, bit: 0, raton: r }); }
  for (const m of s.matchAll(/\bKEY_([A-Z]|[0-9]|SPACE|LALT|TAB)\b/g)) {
    const k = m[1], code = /^[A-Z]$/.test(k) ? 'Key' + k : /^[0-9]$/.test(k) ? 'Digit' + k : k === 'SPACE' ? 'Space' : k === 'LALT' ? 'AltLeft' : 'Tab';
    if (!out.some((x) => x.tecla === code)) out.push({ id: 'KEY_' + k, t: k === 'SPACE' ? T('ctl.espacio') : k === 'LALT' ? 'Alt' : k, tecla: code, bit: 0 });
  }
  if (/PlayerBindPress/.test(s)) for (const m of s.matchAll(/bind\s*==\s*["'](impulse \d+|\+reload|\+use|\+menu|\+menu_context|\+zoom|\+attack3|\+walk|invnext|invprev)["']/g)) {
    const bd = m[1]; if (!out.some((x) => x.bind === bd)) out.unshift({ id: 'BIND_' + bd, t: (typeof GMB_BIND_NOM !== 'undefined' && GMB_BIND_NOM[bd]) || bd, tecla: null, bit: 0, bind: bd });
  }
  // (qué hace cada una, para el ícono y el nombre del botón: acciones.js, con el Lua tal cual —los comentarios ayudan—)
  if (typeof accDe === 'function') { const crudo = fuentes.join('\n');
    for (const b of out) { const k = b.bind ? 'bind:' + b.bind : /^IN_/.test(b.id) ? 'in:' + b.id.slice(3) : b.tecla ? 'key:' + b.tecla : '';
      if (!k) continue; const tok = b.bind ? '"' + b.bind + '"' : b.id; try { b.acc = accDe(k, accVentanasDe(crudo, tok)); } catch (e) { b.acc = null; } } }
  // (primero las que más se usan con el pulgar: zoom, apuntar, recargar; después el resto)
  out.sort((a, b) => ((b.acc && b.acc.prio) || 0) - ((a.acc && a.acc.prio) || 0));
  // (dos teclas que hacen lo mismo —«Enfocar» con I y con ENTER—: un solo botón)
  const ya = new Set(), r = out.filter((b) => { const id = b.acc && b.acc.id; if (!id) return true; if (ya.has(id)) return false; ya.add(id); return true; }).slice(0, 4); _ctlLeidos.set(clase, r); return r;
}
// cada cuadro del HUD: con un arma de mod en la mano se ven apuntar (secundario) y sus botones; si no, se esconden
function ctlPasoMod(arma) {
  const D = typeof DEF_ARMAS !== 'undefined' && DEF_ARMAS[arma], clase = D && D.tipo === 'gmswep' ? D.gm : '';
  if (clase === CTL.modArma) return;
  CTL.modArma = clase; CTL.teclasMod.clear(); CTL.inMod = 0; CTL.raton = 0;
  const L = clase ? ctlBotonesDeArma(clase) : [];
  for (let i = 0; i < 4; i++) {
    const e = $('bmod' + i), b = L[i]; if (!e) continue;
    e.classList.toggle('oc', !b); e._ctl = b || null;
    if (b) { const t = String(b.t).slice(0, 7); e.classList.toggle('accBt', !!b.acc); e.innerHTML = b.acc && typeof accBotonHTML === 'function' ? accBotonHTML(b.acc, t) : `<b class="ctlLetra${t.length > 2 ? ' larga' : ''}">${esc(t)}</b>`; e.title = b.acc ? accNombre(b.acc) + ' (' + t + ')' : t; }
  }
  const d2 = $('bdisp2'); if (d2 && clase) { d2.classList.remove('oc'); const im = d2.querySelector('img'); if (im) im.src = hudIco('mira'); }
}
function ctlIniciar() {
  HUD_SVG.mira = '<circle cx="12" cy="12" r="7" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.6" fill="#fff"/>';
  const t = $('tactil'); if (!t) return;
  for (let i = 0; i < 4; i++) {
    if ($('bmod' + i)) continue;
    const d = document.createElement('div'); d.className = 'bt-t oc'; d.id = 'bmod' + i; t.appendChild(d);
    const ap = (on) => { const b = d._ctl; if (!b) return; if (b.raton) { CTL.raton = on ? b.raton : 0; d.classList.toggle('ap', on); return; } if (b.bind) { if (on && typeof gmbBind === 'function') gmbBind(b.bind); d.classList.toggle('ap', on); return; } if (b.tecla) { if (on) CTL.teclasMod.add(b.tecla); else CTL.teclasMod.delete(b.tecla); } if (b.bit) CTL.inMod = on ? CTL.inMod | b.bit : CTL.inMod & ~b.bit; d.classList.toggle('ap', on); };
    d.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); ENT.tactil = true; ap(true); }, { passive: false });
    for (const ev of ['touchend', 'touchcancel']) d.addEventListener(ev, (e) => { e.preventDefault(); ap(false); }, { passive: false });
    d.addEventListener('mousedown', () => ap(true)); d.addEventListener('mouseup', () => ap(false)); d.addEventListener('mouseleave', () => ap(false));
    // (en arco arriba del disparo, al alcance del pulgar derecho)
    const P = [[-335, 390], [-215, 412], [-470, 338], [-585, 270]][i]; HUD_TACTIL.push(['#bmod' + i, 1, 0, P[0], P[1], 90, 38]);
  }
}

Object.assign(IDI3, {
  'ctl.titulo': ['Controles', 'Controls', 'Controles', 'Kontrol', 'Kawalan', 'Mga kontrol', '操作', 'การควบคุม', 'Kontroller', 'التحكم', 'Управление', 'Керування', 'Commandes', 'Steuerung'],
  'ctl.teclado': ['Teclado', 'Keyboard', 'Teclado', 'Keyboard', 'Papan kekunci', 'Keyboard', 'キーボード', 'คีย์บอร์ด', 'Klavye', 'لوحة المفاتيح', 'Клавиатура', 'Клавіатура', 'Clavier', 'Tastatur'],
  'ctl.pantalla': ['Pantalla táctil', 'Touch screen', 'Tela de toque', 'Layar sentuh', 'Skrin sentuh', 'Touch screen', 'タッチ画面', 'หน้าจอสัมผัส', 'Dokunmatik ekran', 'شاشة اللمس', 'Сенсорный экран', 'Сенсорний екран', 'Écran tactile', 'Touchscreen'],
  'ctl.tienda': ['Tienda de controles', 'Controls store', 'Loja de controles', 'Toko kontrol', 'Kedai kawalan', 'Tindahan ng kontrol', '操作ストア', 'ร้านการควบคุม', 'Kontrol mağazası', 'متجر التحكم', 'Магазин управления', 'Магазин керування', 'Boutique de commandes', 'Steuerungs-Shop'],
  'ctl.aprieta': ['Apretá una tecla…', 'Press a key…', 'Aperte uma tecla…', 'Tekan tombol…', 'Tekan kekunci…', 'Pumindot ng key…', 'キーを押して…', 'กดปุ่ม…', 'Bir tuşa bas…', 'اضغط مفتاحًا…', 'Нажми клавишу…', 'Натисни клавішу…', 'Appuie sur une touche…', 'Drück eine Taste…'],
  'ctl.fabrica': ['Volver a los de fábrica', 'Reset to default', 'Voltar ao padrão', 'Kembali ke bawaan', 'Kembali ke asal', 'Ibalik sa default', '初期設定に戻す', 'คืนค่าเริ่มต้น', 'Varsayılana dön', 'إعادة الافتراضي', 'Сбросить', 'Скинути', 'Par défaut', 'Zurücksetzen'],
  'ctl.ayudaTac': ['Mové cada botón a donde quieras y hacelo más grande o más chico (con dos dedos o con la barra).', 'Move each button wherever you want and make it bigger or smaller (two fingers or the slider).', 'Mova cada botão para onde quiser e aumente ou diminua (dois dedos ou a barra).', 'Pindahkan tiap tombol ke mana saja dan perbesar atau perkecil (dua jari atau slider).', 'Alihkan setiap butang ke mana-mana dan besarkan atau kecilkan (dua jari atau peluncur).', 'Ilipat ang bawat button kahit saan at palakihin o paliitin (dalawang daliri o slider).', 'ボタンを好きな場所に動かし、大きさを変えられます(2本指かスライダー)。', 'ย้ายปุ่มไปที่ใดก็ได้และปรับขนาด (สองนิ้วหรือแถบเลื่อน)', 'Her düğmeyi istediğin yere taşı, büyüt ya da küçült (iki parmak ya da kaydırıcı).', 'حرّك كل زر لأي مكان وكبّره أو صغّره (بإصبعين أو بالشريط).', 'Перетащи кнопки куда хочешь и меняй размер (двумя пальцами или ползунком).', 'Перетягни кнопки куди хочеш і змінюй розмір (двома пальцями або повзунком).', 'Déplace chaque bouton où tu veux et agrandis-le ou réduis-le (deux doigts ou le curseur).', 'Verschieb jeden Knopf, wohin du willst, und mach ihn größer oder kleiner (zwei Finger oder Regler).'],
  'ctl.editar': ['Editar los botones', 'Edit buttons', 'Editar botões', 'Edit tombol', 'Sunting butang', 'I-edit ang mga button', 'ボタンを編集', 'แก้ไขปุ่ม', 'Düğmeleri düzenle', 'تعديل الأزرار', 'Изменить кнопки', 'Змінити кнопки', 'Modifier les boutons', 'Knöpfe bearbeiten'],
  'ctl.palanca': ['Tamaño de la palanca', 'Joystick size', 'Tamanho do joystick', 'Ukuran joystick', 'Saiz joystick', 'Laki ng joystick', 'スティックの大きさ', 'ขนาดจอยสติ๊ก', 'Joystick boyutu', 'حجم عصا التحكم', 'Размер джойстика', 'Розмір джойстика', 'Taille du joystick', 'Joystick-Größe'],
  'ctl.nombre': ['Nombre de tus controles', 'Name of your controls', 'Nome dos seus controles', 'Nama kontrolmu', 'Nama kawalan anda', 'Pangalan ng iyong kontrol', '操作の名前', 'ชื่อการควบคุม', 'Kontrollerinin adı', 'اسم إعداداتك', 'Название управления', 'Назва керування', 'Nom de tes commandes', 'Name deiner Steuerung'],
  'ctl.publicar': ['Publicar los míos', 'Publish mine', 'Publicar os meus', 'Terbitkan punyaku', 'Terbitkan saya', 'I-publish ang akin', '自分のを公開', 'เผยแพร่ของฉัน', 'Benimkini yayınla', 'انشر إعداداتي', 'Опубликовать мои', 'Опублікувати мої', 'Publier les miens', 'Meine veröffentlichen'],
  'ctl.cancelar': ['Cancelar', 'Cancel', 'Cancelar', 'Batal', 'Batal', 'Kanselahin', 'キャンセル', 'ยกเลิก', 'İptal', 'إلغاء', 'Отмена', 'Скасувати', 'Annuler', 'Abbrechen'],
  'ctl.listo': ['Listo', 'Done', 'Pronto', 'Selesai', 'Siap', 'Tapos', '完了', 'เสร็จ', 'Tamam', 'تم', 'Готово', 'Готово', 'OK', 'Fertig'],
  'ctl.tam': ['Tamaño', 'Size', 'Tamanho', 'Ukuran', 'Saiz', 'Laki', '大きさ', 'ขนาด', 'Boyut', 'الحجم', 'Размер', 'Розмір', 'Taille', 'Größe'],
  'ctl.guardar': ['Guardar', 'Save', 'Salvar', 'Simpan', 'Simpan', 'I-save', '保存', 'บันทึก', 'Kaydet', 'حفظ', 'Сохранить', 'Зберегти', 'Enregistrer', 'Speichern'],
  'ctl.guardado': ['Controles guardados', 'Controls saved', 'Controles salvos', 'Kontrol disimpan', 'Kawalan disimpan', 'Na-save ang kontrol', '保存しました', 'บันทึกแล้ว', 'Kaydedildi', 'تم الحفظ', 'Сохранено', 'Збережено', 'Enregistré', 'Gespeichert'],
  'ctl.aPie': ['A pie', 'On foot', 'A pé', 'Jalan kaki', 'Berjalan', 'Naglalakad', '徒歩', 'เดินเท้า', 'Yaya', 'سيرًا', 'Пешком', 'Пішки', 'À pied', 'Zu Fuß'],
  'ctl.enVeh': ['En vehículo', 'In vehicle', 'No veículo', 'Di kendaraan', 'Dalam kenderaan', 'Sa sasakyan', '乗り物', 'ในยานพาหนะ', 'Araçta', 'في المركبة', 'В машине', 'У машині', 'En véhicule', 'Im Fahrzeug'],
  'ctl.ponNombre': ['Ponele un nombre', 'Give it a name', 'Dê um nome', 'Beri nama', 'Beri nama', 'Bigyan ng pangalan', '名前を付けて', 'ตั้งชื่อ', 'Bir ad ver', 'اكتب اسمًا', 'Дай название', 'Дай назву', 'Donne-lui un nom', 'Gib ihm einen Namen'],
  'ctl.publicado': ['Publicado en la tienda de controles', 'Published to the controls store', 'Publicado na loja', 'Diterbitkan ke toko', 'Diterbitkan ke kedai', 'Na-publish sa tindahan', 'ストアに公開しました', 'เผยแพร่แล้ว', 'Mağazada yayınlandı', 'نُشر في المتجر', 'Опубликовано', 'Опубліковано', 'Publié', 'Veröffentlicht'],
  'ctl.sinTienda': ['La tienda de controles no responde', "Controls store isn't responding", 'A loja não responde', 'Toko tidak merespons', 'Kedai tidak menjawab', 'Hindi sumasagot ang tindahan', 'ストアが応答しません', 'ร้านไม่ตอบสนอง', 'Mağaza yanıt vermiyor', 'المتجر لا يستجيب', 'Магазин не отвечает', 'Магазин не відповідає', 'La boutique ne répond pas', 'Shop antwortet nicht'],
  'ctl.usos': ['usos', 'uses', 'usos', 'dipakai', 'guna', 'gamit', '回使用', 'ครั้ง', 'kullanım', 'استخدام', 'исп.', 'вик.', 'utilisations', 'Nutzungen'],
  'ctl.usar': ['Usar', 'Use', 'Usar', 'Pakai', 'Guna', 'Gamitin', '使う', 'ใช้', 'Kullan', 'استخدم', 'Взять', 'Взяти', 'Utiliser', 'Nutzen'],
  'ctl.aplicado': ['Controles puestos', 'Controls applied', 'Controles aplicados', 'Kontrol diterapkan', 'Kawalan digunakan', 'Nailapat ang kontrol', '適用しました', 'ใช้แล้ว', 'Uygulandı', 'تم التطبيق', 'Применено', 'Застосовано', 'Appliqué', 'Übernommen'],
  'ctl.espacio': ['Espacio', 'Space', 'Espaço', 'Spasi', 'Ruang', 'Space', 'スペース', 'เว้นวรรค', 'Boşluk', 'مسافة', 'Пробел', 'Пробіл', 'Espace', 'Leertaste'],
  'ctl.caminar': ['Caminar', 'Walk', 'Andar', 'Jalan', 'Jalan', 'Lakad', '歩く', 'เดิน', 'Yürü', 'مشي', 'Шаг', 'Крок', 'Marcher', 'Gehen'],
  'ctl.a.adelante': ['Adelante', 'Forward', 'Frente', 'Maju', 'Depan', 'Pasulong', '前', 'หน้า', 'İleri', 'أمام', 'Вперёд', 'Вперед', 'Avancer', 'Vorwärts'],
  'ctl.a.atras': ['Atrás', 'Back', 'Trás', 'Mundur', 'Belakang', 'Paatras', '後ろ', 'หลัง', 'Geri', 'خلف', 'Назад', 'Назад', 'Reculer', 'Rückwärts'],
  'ctl.a.izq': ['Izquierda', 'Left', 'Esquerda', 'Kiri', 'Kiri', 'Kaliwa', '左', 'ซ้าย', 'Sol', 'يسار', 'Влево', 'Ліворуч', 'Gauche', 'Links'],
  'ctl.a.der': ['Derecha', 'Right', 'Direita', 'Kanan', 'Kanan', 'Kanan', '右', 'ขวา', 'Sağ', 'يمين', 'Вправо', 'Праворуч', 'Droite', 'Rechts'],
  'ctl.a.saltar': ['Saltar', 'Jump', 'Pular', 'Lompat', 'Lompat', 'Tumalon', 'ジャンプ', 'กระโดด', 'Zıpla', 'قفز', 'Прыжок', 'Стрибок', 'Sauter', 'Springen'],
  'ctl.a.agachar': ['Agacharse', 'Crouch', 'Agachar', 'Jongkok', 'Bongkok', 'Yumuko', 'しゃがむ', 'ย่อ', 'Eğil', 'انحناء', 'Присесть', 'Присісти', "S'accroupir", 'Ducken'],
  'ctl.a.correr': ['Correr', 'Run', 'Correr', 'Lari', 'Lari', 'Tumakbo', '走る', 'วิ่ง', 'Koş', 'ركض', 'Бег', 'Біг', 'Courir', 'Rennen'],
  'ctl.a.usar': ['Usar', 'Use', 'Usar', 'Pakai', 'Guna', 'Gamitin', '使う', 'ใช้', 'Kullan', 'استخدام', 'Использовать', 'Використати', 'Utiliser', 'Benutzen'],
  'ctl.a.recargar': ['Recargar', 'Reload', 'Recarregar', 'Isi ulang', 'Isi semula', 'Reload', 'リロード', 'รีโหลด', 'Şarjör', 'إعادة تعبئة', 'Перезарядка', 'Перезарядка', 'Recharger', 'Nachladen'],
  'ctl.a.menu': ['Menú de props', 'Props menu', 'Menu de props', 'Menu props', 'Menu prop', 'Menu ng props', 'プロップメニュー', 'เมนูพร็อพ', 'Prop menüsü', 'قائمة العناصر', 'Меню пропов', 'Меню пропів', 'Menu des props', 'Prop-Menü'],
  'ctl.a.chat': ['Chat', 'Chat', 'Chat', 'Obrolan', 'Sembang', 'Chat', 'チャット', 'แชท', 'Sohbet', 'الدردشة', 'Чат', 'Чат', 'Chat', 'Chat'],
  'ctl.a.camara': ['Cámara', 'Camera', 'Câmera', 'Kamera', 'Kamera', 'Camera', 'カメラ', 'กล้อง', 'Kamera', 'الكاميرا', 'Камера', 'Камера', 'Caméra', 'Kamera'],
  'ctl.a.camLibre': ['Cámara libre', 'Free camera', 'Câmera livre', 'Kamera bebas', 'Kamera bebas', 'Malayang camera', 'フリーカメラ', 'กล้องอิสระ', 'Serbest kamera', 'كاميرا حرة', 'Свободная камера', 'Вільна камера', 'Caméra libre', 'Freie Kamera'],
  'ctl.a.emotes': ['Emotes', 'Emotes', 'Emotes', 'Emote', 'Emote', 'Emotes', 'エモート', 'อีโมต', 'İfadeler', 'الحركات', 'Эмоции', 'Емоції', 'Emotes', 'Emotes'],
  'ctl.a.linterna': ['Linterna', 'Flashlight', 'Lanterna', 'Senter', 'Lampu suluh', 'Flashlight', 'ライト', 'ไฟฉาย', 'El feneri', 'مصباح', 'Фонарик', 'Ліхтарик', 'Lampe', 'Taschenlampe'],
  'ctl.a.noclip': ['Volar (noclip)', 'Fly (noclip)', 'Voar (noclip)', 'Terbang (noclip)', 'Terbang (noclip)', 'Lumipad (noclip)', '飛ぶ(noclip)', 'บิน (noclip)', 'Uç (noclip)', 'طيران', 'Полёт (noclip)', 'Політ (noclip)', 'Voler (noclip)', 'Fliegen (Noclip)'],
  'ctl.a.deshacer': ['Deshacer', 'Undo', 'Desfazer', 'Urungkan', 'Buat asal', 'I-undo', '元に戻す', 'เลิกทำ', 'Geri al', 'تراجع', 'Отменить', 'Скасувати', 'Annuler', 'Rückgängig'],
  'ctl.a.salir': ['Bajar del vehículo', 'Exit vehicle', 'Sair do veículo', 'Keluar kendaraan', 'Keluar kenderaan', 'Bumaba sa sasakyan', '降りる', 'ลงจากรถ', 'Araçtan in', 'النزول', 'Выйти из машины', 'Вийти з машини', 'Descendre', 'Aussteigen'],
  'ctl.a.celular': ['Celular', 'Phone', 'Celular', 'Ponsel', 'Telefon', 'Cellphone', 'スマホ', 'มือถือ', 'Telefon', 'الهاتف', 'Телефон', 'Телефон', 'Téléphone', 'Handy'],
  'ctl.a.memes': ['Memes', 'Memes', 'Memes', 'Meme', 'Meme', 'Memes', 'ミーム', 'มีม', 'Mimler', 'ميمز', 'Мемы', 'Меми', 'Mèmes', 'Memes'],
  'ctl.a.modmenu': ['Menú MOD', 'MOD menu', 'Menu MOD', 'Menu MOD', 'Menu MOD', 'MOD menu', 'MODメニュー', 'เมนู MOD', 'MOD menüsü', 'قائمة المودات', 'Меню модов', 'Меню модів', 'Menu MOD', 'MOD-Menü'],
  'ctl.a.servmods': ['Mods del server', 'Server mods', 'Mods do servidor', 'Mod server', 'Mod pelayan', 'Mods ng server', 'サーバーMOD', 'ม็อดเซิร์ฟเวอร์', 'Sunucu modları', 'مودات الخادم', 'Моды сервера', 'Моди сервера', 'Mods du serveur', 'Server-Mods'],
  'ctl.a.borrarApuntado': ['Borrar lo apuntado', 'Delete aimed', 'Apagar o mirado', 'Hapus yang dibidik', 'Padam yang dibidik', 'Burahin ang tinutok', '狙った物を消す', 'ลบที่เล็ง', 'Nişanlananı sil', 'احذف المستهدف', 'Удалить цель', 'Видалити ціль', 'Supprimer la cible', 'Anvisiertes löschen'],
  'ctl.a.pausa': ['Pausa', 'Pause', 'Pausa', 'Jeda', 'Jeda', 'Pause', 'ポーズ', 'หยุด', 'Duraklat', 'إيقاف مؤقت', 'Пауза', 'Пауза', 'Pause', 'Pause'],
});
