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
  spawnTabs();
  $('iCerrarSpawn').onclick = () => cerrarPaneles();
  // pausa
  $('bSeguir').onclick = () => cerrarPaneles();
  { const x = $('pzX'); if (x) x.onclick = () => cerrarPaneles(); }
  for (const i of document.querySelectorAll('#pausa i[data-g]')) i.innerHTML = glifo(i.dataset.g);
  $('bAjustes').onclick = () => abrirAjustes('pausa');
  $('bPersonaje').onclick = () => pjjAbrir();   // (cambiar de personaje jugando: los del juego y los de mods)
  { const b = $('bArmaAj'); if (b) b.onclick = () => armaAjAbrir(); }   // (cómo se agarra el arma: armaaj.js)
  // (borrar todo no tiene vuelta atrás: el primer toque pregunta, el segundo —en 3 s— borra)
  $('bLimpiar').onclick = () => {
    const B = $('bLimpiar');
    if (!B.dataset.conf) { B.dataset.conf = '1'; pzTexto('bLimpiar', T('pz.otraVez'), T('pz.otraVezSub')); clearTimeout(B._t); B._t = setTimeout(() => { delete B.dataset.conf; pzTexto('bLimpiar', T('pz.borrar'), T('pz.borrarSub')); }, 3000); return; }
    delete B.dataset.conf; clearTimeout(B._t);
    for (const o of OBJS.filter((x) => !x.remoto)) borrarObjeto(o); cerrarPaneles(); aviso(T('pz.limpio'));
  };
  $('bGuardar').onclick = () => { guardarConstruccion(); cerrarPaneles(); };
  { const b = $('bSocial'); if (b) b.onclick = () => { cerrarPaneles(); RB.desdeJuego = true; inicioMostrar(true); inicioPanel('social'); }; }
  { const b = $('bTutorial'); if (b) b.onclick = () => { cerrarPaneles(); UI.abierto = null; tutAbrir(); }; }
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
// las pestañas del menú de spawn (se rearman cuando aparece una nueva, como la de GMod al instalar un addon)
// la pestaña NPCs (como la del spawnmenu de GMod; Discord: «sección de spawnmenu pa npcs»): los personajes del juego como
// NPC y los NPC de los addons agrupados por su categoría (la de su list.Set("NPC"), si no el nombre del addon), y al final
// los personajes de los addons como NPC. Va antes de Vehículos, como en GMod
function spawnNpcsTab() {
  if (typeof DATA === 'undefined' || !DATA || !DATA.menu) return;
  let C = DATA.menu.find((c) => c.npcs);
  if (!C) { C = { n: 'NPCs', npcs: true, sub: [], icUrl: icoSrc('ico:npcs') }; const i = DATA.menu.findIndex((c) => c.n === 'Vehicles'); DATA.menu.splice(i >= 0 ? i : DATA.menu.length, 0, C); if (typeof UI !== 'undefined' && i >= 0 && UI.tab >= i) UI.tab++; }
  const subs = [{ n: T('sp.npcJuego'), it: (DATA.chars || []).map((s) => 'npc:' + s) }], cats = new Map();
  if (typeof GMOD !== 'undefined') for (const A of GMOD.addons.values()) for (const [k, v] of ((A.listas && A.listas.NPC) || new Map())) {
    const c0 = v && v.get ? v.get('Category') : null, c = typeof c0 === 'string' && c0.trim() ? c0.trim() : A.nombre;
    if (!cats.has(c)) cats.set(c, []); if (!cats.get(c).includes('gmnpc:' + k)) cats.get(c).push('gmnpc:' + k);
  }
  for (const c of [...cats.keys()].sort((x, y) => x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' }))) subs.push({ n: c, it: cats.get(c) });
  const pms = typeof gmpLista === 'function' ? gmpLista() : [];
  if (pms.length) subs.push({ n: T('sp.npcModelos'), it: pms.map((r) => 'gmnpcm:' + r) });
  C.sub = subs;
}
function spawnTabs() {
  spawnNpcsTab();
  const tabs = $('tabs'); if (!tabs) return; tabs.innerHTML = '';
  DATA.menu.forEach((c, i) => {
    const t = document.createElement('div'); t.className = 'tab' + (i === UI.tab ? ' sel' : ''); t.innerHTML = `<img src="${c.icUrl || icono(c.ic)}">${esc(c.n)}`;
    t.onclick = () => { UI.tab = i; UI.sub = 0; UI.q = ''; spawnDibujar(); }; tabs.appendChild(t);
  });
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
      const d = document.createElement('div'); d.className = 'cat' + (UI.herrSel === i ? ' sel' : '') + (h.gmTool ? ' catNueva' : ''); d.textContent = h.nom || (T('her.' + h.n) !== 'her.' + h.n ? T('her.' + h.n) : h.n);
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
    d.textContent = spawnCatNom(s); d.onclick = () => { UI.sub = i; UI.q = ''; if (s.n === 'Nucleares') nukePrecargar(); spawnDibujar(); }; cl.appendChild(d);
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
function propNom(it) { if (/^npc:/.test(it)) return skinNom(it.slice(4)); if (/^gm:/.test(it)) return gmNombre(it); if (/^gmnpcm:/.test(it)) return gmNombre('gm:' + it.slice(7)) + ' (NPC)'; if (/^gmrag:/.test(it)) return gmNombre('gm:' + it.slice(6)) + ' (' + T('gm.muneco') + ')'; if (/^gmpm:/.test(it)) return gmNombre('gm:' + it.slice(5)); if (/^gmnpc:/.test(it)) return gmListaNombre('NPC', it.slice(6)); if (/^gmveh:/.test(it)) return gmListaNombre('Vehicles', it.slice(6)); if (/^gm(ent|swep):/.test(it) && typeof gmaNomClase === 'function') return gmaNomClase(it); if (/^NK_/.test(it) && typeof nukeNom === 'function') return nukeNom(it); const k = 'pr.' + it, t = T(k); return t === k ? it : t; }
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
      if (/^npc:/.test(it)) d.innerHTML = `<img src="${retrato(it.slice(4))}" loading="lazy"><span>${esc(propNom(it))}</span>`;   // (un personaje del juego como NPC)
      else if (/^gm:/.test(it)) d.innerHTML = `<img src="${gmIcono(it)}" data-gm="${esc(it)}" loading="lazy"><span>${esc(propNom(it))}</span>`;
      else if (/^gm(npc|veh):/.test(it)) { const v = gmLista(/^gmnpc/.test(it) ? 'NPC' : 'Vehicles', it.replace(/^gm(npc|veh):/, '')), m = v && v.get('Model'), g = typeof m === 'string' && gmArchivo(m.toLowerCase().replace(/\\/g, '/')) ? 'gm:' + m.toLowerCase().replace(/\\/g, '/') : null; d.innerHTML = `<img src="${g ? gmIcono(g) : GM_ICO}"${g ? ` data-gm="${esc(g)}"` : ''} loading="lazy"><span>${esc(propNom(it))}</span>`; }
      else if (/^gmrag:/.test(it)) { const g = 'gm:' + it.slice(6); d.innerHTML = `<img src="${gmIcono(g)}" data-gm="${esc(g)}" loading="lazy"><span>${esc(propNom(it))}</span>`; }   // (un personaje de un addon como muñeco de trapo)
      else if (/^gmnpcm:/.test(it)) { const g = 'gm:' + it.slice(7); d.innerHTML = `<img src="${gmIcono(g)}" data-gm="${esc(g)}" loading="lazy"><span>${esc(propNom(it))}</span>`; }   // (cualquier modelo de personaje de un addon, como NPC)
      else if (/^gmpm:/.test(it)) { const g = 'gm:' + it.slice(5); d.innerHTML = `<img src="${gmIcono(g)}" data-gm="${esc(g)}" loading="lazy"><span>${esc(propNom(it))}</span>`; d.classList.toggle('sel', PREFS.skin === it); }
      else if (/^gm(ent|swep):/.test(it)) { const ic = gmaIconoClase(it); d.innerHTML = `<img src="${ic.src}"${ic.gm ? ` data-gm="${esc(ic.gm)}"` : ''} loading="lazy"><span>${esc(propNom(it))}</span>`; }
      else d.innerHTML = `<img src="${icono(ico) || icono(it) || icoSrc(/tv|tele|pantalla|screen/i.test(it) ? 'ico:pantalla' : 'ico:mod')}" loading="lazy"><span>${esc(propNom(it))}</span>`;   // (sin dibujo propio, como la TV: un ícono, no la imagen rota)
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
  if (typeof censPermite === 'function' && !censPermite(nombre)) return;   // (en un server oficial, nada de un mod censurado)
  if (typeof gmModeloEsperar === 'function' && gmModeloEsperar(nombre, () => spawnElegir(tab, nombre))) return;   // (un modelo de addon que se está leyendo del disco: se pone al llegar)
  if (/^gmrag:/.test(nombre) || (/^gm:/.test(nombre) && typeof gmEsMuneco === 'function' && gmEsMuneco(nombre.slice(3)))) { const r = nombre.replace(/^gm(rag)?:/, ''); if (JUEGO.estado === 'juego' && gmragModelo(r)) { UI.puestos = (UI.puestos || 0) + 1; const e = $('spPuso'); if (e) { e.textContent = `${T('sp.puesto')}: ${propNom(nombre)}`; e.classList.remove('ve'); void e.offsetWidth; e.classList.add('ve'); } } return; }   // (un muñeco de trapo con huesos, como los prop_ragdoll de GMod)
  if (/^npc:/.test(nombre)) { if (JUEGO.estado === 'juego' && spawnNpc(nombre.slice(4))) { UI.puestos = (UI.puestos || 0) + 1; const e = $('spPuso'); if (e) { e.textContent = `${T('sp.puesto')}: ${propNom(nombre)}${UI.puestos > 1 ? ' (' + UI.puestos + ')' : ''}`; e.classList.remove('ve'); void e.offsetWidth; e.classList.add('ve'); } } return; }
  if (/^gmnpcm:/.test(nombre)) { if (JUEGO.estado === 'juego' && gmnpcModelo(nombre.slice(7))) { UI.puestos = (UI.puestos || 0) + 1; const e = $('spPuso'); if (e) { e.textContent = `${T('sp.puesto')}: ${propNom(nombre)}`; e.classList.remove('ve'); void e.offsetWidth; e.classList.add('ve'); } } return; }   // (un modelo de personaje como NPC)
  if (/^gmnpc:/.test(nombre)) { if (JUEGO.estado === 'juego' && gmnpcCrear(nombre.slice(6))) { UI.puestos = (UI.puestos || 0) + 1; const e = $('spPuso'); if (e) { e.textContent = `${T('sp.puesto')}: ${propNom(nombre)}`; e.classList.remove('ve'); void e.offsetWidth; e.classList.add('ve'); } } return; }   // (un NPC de un addon)
  if (/^gmveh:/.test(nombre) && !gmvehPrefab(nombre.slice(6))) return;   // (un vehículo de un addon: se arma su prefab y se pone como cualquier cosa)
  if (/^gmpm:/.test(nombre)) { PREFS.skin = nombre; guardarPrefs(); if (JUEGO.estado === 'juego' && JUG.vivo) jugadorCuerpoNuevo(); if (typeof redSkin === 'function') redSkin(); aviso(T('gm.pm.puesto').replace('{m}', propNom(nombre)), 3); cerrarPaneles(); return; }   // (un modelo de jugador de GMod: pasa a ser tu personaje)
  if (/^gmswep:/.test(nombre)) { if (JUEGO.estado === 'juego') gmaSpawnMenu(nombre); cerrarPaneles(); return; }   // (un arma de un addon de GMod: a la mano)
  if (/^gment:/.test(nombre)) { if (JUEGO.estado === 'juego' && gmaSpawnMenu(nombre)) { UI.puestos = (UI.puestos || 0) + 1; const e = $('spPuso'); if (e) { e.textContent = `${T('sp.puesto')}: ${propNom(nombre)}`; e.classList.remove('ve'); void e.offsetWidth; e.classList.add('ve'); } } return; }
  if (tab === 'Weapons' && !UI.comoProp) { darArma(nombre); cerrarPaneles(); return; }
  // (el menú queda abierto para poner uno o más: abajo dice qué se puso)
  const o = spawnDelante(nombre, { congelado: UI.freeze }), e = $('spPuso');
  if (o && e) { UI.puestos = (UI.puestos || 0) + 1; e.textContent = `${T('sp.puesto')}: ${propNom(nombre)}${UI.puestos > 1 ? ' (' + UI.puestos + ')' : ''}`; e.classList.remove('ve'); void e.offsetWidth; e.classList.add('ve'); }
}
// un personaje del juego como NPC donde apunta el jugador (o 4 m adelante), mirándolo, con la actitud elegida en la
// herramienta de NPC (si no, la de siempre)
function spawnNpc(skin) {
  if (!reglaSala('npc:' + skin) || typeof npcCrear !== 'function') return false;
  if (NPC.lista.length >= NPC.max) { aviso(T('npc.max') + ' (' + NPC.max + ')', 2); return false; }   // (el mismo tope que la herramienta de NPC)
  const d = CAM.fwd, h = raycast(CAM.pos, d, 40, JUG.vehiculo ? JUG.vehiculo.b : null);
  let p = h ? vadd(CAM.pos, vscale(d, h.t)) : vadd(CAM.pos, vscale(d, 4));
  if (h && h.n && h.n.y < 0.5) { p = vadd(p, vscale(h.n, 0.45)); const g = mundoRayo(vadd(p, v3(0, 0.5, 0)), v3(0, -1, 0), 50); if (g) p.y += 0.5 - g.t; }   // (contra una pared: al pie, un poco afuera)
  else if (!h) { const g = mundoRayo(p, v3(0, -1, 0), 50); if (g) p.y -= g.t; }
  const yaw = Math.atan2(CAM.pos.x - p.x, CAM.pos.z - p.z);
  rbAsegurar(rbDeSkin(skin)).then(() => { const Q = npcCrear(skin, p, yaw, Object.assign({}, NPC.act || {}, { de: (typeof RED !== 'undefined' && RED.ID) || 'yo' })); if (Q && typeof efectoChispas === 'function') efectoChispas(p); });
  return true;
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
  if (typeof RUL !== 'undefined') { RUL.asignar = -1; if (RUL.abierto) rulCerrar(); }   // (la ruleta de emotes)
  for (const id of ['spawn', 'pausa', 'ajustes', 'emotes']) $(id).classList.add('oc');
  { const pj = $('pjJuego'); if (pj) pj.classList.add('oc'); }
  if (typeof EMU !== 'undefined' && EMU.ed && typeof emuCerrar === 'function') emuCerrar();   // (el panel de la música de un emote)
  { const p = $('armaAjPan'); if (p && !p.classList.contains('oc') && typeof armaAjCerrar === 'function') armaAjCerrar(); }
  for (const id of ['radioPan', 'creaPan', 'rolPan', 'smPan', 'verPan', 'verTuto', 'verTerm', 'verCrea', 'emuPan']) { const p = $(id); if (p) p.classList.add('oc'); } if (typeof RADIO !== 'undefined') RADIO.e = null; if (typeof SMOD !== 'undefined') SMOD.abierto = false;
  $('chatIn').classList.add('oc');
  if (typeof memePanCerrar === 'function') memePanCerrar();
  if (typeof celCerrar === 'function') celCerrar();
  if (typeof artOmegaPanelCerrar === 'function') artOmegaPanelCerrar();
  if (typeof npcPanelCerrar === 'function') npcPanelCerrar();
  if (typeof gmmEquiposCerrar === 'function') gmmEquiposCerrar();
  if (typeof GMB !== 'undefined' && GMB.abierto) gmbCerrar();
  if (typeof maqPanelCerrar === 'function') { maqPanelCerrar(); if ($('maqVista') && !$('maqVista').classList.contains('oc')) maqVistaCerrar(); }
}
function soltarPuntero() { if (document.pointerLockElement) document.exitPointerLock(); ENT.disparo = ENT.disparo2 = false; }
// (el menú de pausa: tarjetas con título y una línea abajo; los textos en el idioma elegido cada vez que se abre)
function pzTexto(id, t, sub) { const e = $(id); if (!e) return; const b = e.querySelector('b') || e.querySelector('span'), s = e.querySelector('small'); if (b) b.textContent = t; if (s && sub !== undefined) s.textContent = sub; }
function abrirPausa() {
  pzTexto('bSeguir', T('pz.seguir')); { const t = $('tPausa'); if (t) t.textContent = T('pz.pausa'); }
  pzTexto('bPersonaje', T('pj.boton'), T('pz.skin')); pzTexto('bArmaAj', T('aa.titulo'), T('pz.equipar')); pzTexto('bSocial', T('m.social'), T('pz.amigos'));
  pzTexto('bAjustes', T('pz.ajustes'), T('pz.ajSub')); pzTexto('bTutorial', tutTx(TUT_B.ver), T('pz.tutSub'));
  pzTexto('bLimpiar', T('pz.borrar'), T('pz.borrarSub')); pzTexto('bSalirMenu', T('pz.salir'));
  pzTexto('bGuardar', T('guardar')); pzTexto('bCargar', T('pz.cargar'));
  { const m = $('pzModo'); if (m) m.textContent = typeof SALA !== 'undefined' && SALA ? SALA.n : T('pz.solo'); }
  { const f = $('pzFps'); if (f) f.textContent = Math.round(TIEMPO.fps || 0) + ' fps'; }
  UI.abierto = 'pausa'; $('pausa').classList.remove('oc'); soltarPuntero(); if (ENT.soltarTodo) ENT.soltarTodo();
}
function abrirEmotes() { UI.abierto = 'emotes'; $('emotes').classList.remove('oc'); soltarPuntero(); }
function abrirChat() { const c = $('chatIn'); c.classList.remove('oc'); c.focus(); soltarPuntero(); UI.abierto = 'chat'; }
const CHAT = [];
// (id y de: para corregir el renglón después, si la IA de la censura tapa algo; sólo lo corrige quien lo mandó)
function chatMostrar(quien, t, id, de) {
  const e = { t: `${quien}: ${t}`, v: 12, id, de, quien }; CHAT.push(e); if (CHAT.length > 8) CHAT.shift(); return e;
}
function chatCambiar(id, t, de) { if (!id) return; const e = CHAT.find((x) => x.id === id && x.de === de); if (e) { e.t = `${e.quien}: ${t}`; e.v = Math.max(e.v, 6); } }
// (todo pasa por la censura: filtro local al instante y la IA antes de salir; censura.js)
function chatEnviar(t) { UI.abierto = null; chatEnviarCensurado(t); }
// pasar a otro motor (WebGL 1 o 2): se recarga la página
const MOTOR_NOM = { webgl1: 'WebGL 1', webgl2: 'WebGL 2' };
function motorCambiar(m) {
  aviso('Reiniciando con ' + (MOTOR_NOM[m] || m) + '…', 2);
  setTimeout(() => location.reload(), 600);
}
function abrirAjustes(desde) {
  const c = $('ajustesCaja');
  const sel = (id, ops) => `<select id="${id}">${ops.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`;
  // (como el diseño de la comunidad: oscuro, con pestañas al costado —Gráficos, Renderizado, Controles y audio— y el
  // celular detectado arriba; los controles son los mismos de siempre, así Listo guarda igual)
  const fila = (t, ctl) => `<div class="ajF"><span>${t}</span>${ctl}</div>`, rango = (id, a, b, p, out) => `<span class="ajR"><input type="range" id="${id}" min="${a}" max="${b}" step="${p}">${out ? `<b id="${out}"></b>` : ''}</span>`;
  const sw = (id, t) => `<label class="ajF ajSw"><span>${t}</span><input type="checkbox" id="${id}"><i></i></label>`;
  const motorAct = R.gl1 ? 'webgl1' : 'webgl2';
  const celu = typeof CELU !== 'undefined' && CELU.det ? esc((CELU.det.nom || CELU.det.gpu || '') + (CELU.det.soc ? ' · ' + CELU.det.soc : '') + ' → ' + celuPerfil(CELU.det)) : '';
  c.innerHTML = `<div class="ajCab"><h3>${esc(Lc('Settings', 'Ajustes'))}</h3>${celu ? `<span class="ajCelu" id="aCelu">${celu}</span>` : ''}</div>
  <div class="ajCuerpo"><nav class="ajTabs"><button data-aj="g" class="sel">${glifo('ajustes')}<span>${esc(Lc('Graphics', 'Gráficos'))}</span></button><button data-aj="r">${glifo('video')}<span>${esc(Lc('Rendering', 'Renderizado'))}</span></button><button data-aj="c">${glifo('volumen')}<span>${esc(Lc('ControlsAudio', 'Controles y audio'))}</span></button>${typeof icappSeccion === 'function' ? `<button data-aj="l">${glifo('estrella')}<span>${esc(T('ic.titulo'))}</span></button>` : ''}</nav>
  <div class="ajSecs">
  <section data-ajs="g"><h4>${esc(Lc('Graphics', 'Gráficos'))}</h4>
    ${fila(esc(Lc('GraphicsQuality', 'Calidad gráfica')), sel('aG', [['auto', 'Automático'], ['patata', 'Patata (muy bajo)'], ['bajo', 'Bajo'], ['medio', 'Medio'], ['alto', 'Alto'], ['ultra', 'Ultra (realista)']]))}
    ${fila(esc(Lc('Shadow', 'Sombras')), sel('aSo', [['auto', 'Según gráficos'], ['0', 'No'], ['1', 'Bajas'], ['2', 'Medias'], ['3', 'Altas (suaves)']]))}
    ${fila(esc(Lc('PostProcessing', 'Postprocesado')), sel('aPo', [['auto', 'Según gráficos'], ['si', 'Sí'], ['no', 'No']]))}
    ${fila(esc(Lc('TextureQuality', 'Calidad de textura')), sel('aTq', [['auto', 'Según gráficos'], ['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']]))}
    ${fila(esc(T('aj.motor')), sel('aM', [['webgl2', 'WebGL 2'], ['webgl1', 'WebGL 1 (compatible)']]))}
    <button class="ajBtn gris" id="aBanco">${esc(T('aj.banco'))}</button></section>
  <section data-ajs="r" class="oc"><h4>${esc(Lc('Rendering', 'Renderizado'))}</h4>
    ${fila('Resolución', rango('aR', 35, 100, 5, 'aRv'))}
    ${sw('aDin', 'Resolución dinámica <small>(baja la resolución antes que los efectos para mantener los cuadros)</small>')}
    ${fila('Distancia', rango('aD', 100, 1200, 50, 'aDv'))}
    ${sw('aC', 'Contorno <small>(resaltar lo que apuntás)</small>')}${sw('aF', 'Mostrar FPS')}${sw('aU', esc(Lc('HideUI', 'Ocultar UI')))}${sw('aEv', esc(T('aj.evento')))}</section>
  <section data-ajs="c" class="oc"><h4>${esc(Lc('ControlsAudio', 'Controles y audio'))}</h4>
    ${fila(esc(Lc('Sensitivity', 'Sensibilidad')), rango('aS', 2, 40, 1))}
    ${fila('Volumen', rango('aV', 0, 100, 5))}
    ${ENT.tactil || COARSE ? fila(esc(T('aj.hud')), rango('aH', 60, 120, 5, 'aHv')) : ''}
    ${sw('aEmoR', esc(T('aj.emoRuleta')))}
    <button class="ajBtn gris" id="aCtl">${esc(T('ctl.titulo'))}</button> <button class="ajBtn gris" id="aTut">${esc(tutTx(TUT_B.ver))}</button> <button class="ajBtn gris" id="aReg">${esc(Lc('Error log', 'Registro de fallas'))}</button></section>
  ${typeof icappSeccion === 'function' ? `<section data-ajs="l" class="oc">${icappSeccion()}${typeof milogoSeccion === 'function' ? `<div class="icDiv"></div>${milogoSeccion()}` : ''}</section>` : ''}
  </div></div>
  <div class="ajPie"><button class="ajBtn" id="aOk">Listo</button></div>`;
  c.querySelector('.ajTabs').onclick = (e) => { const b = e.target.closest('[data-aj]'); if (!b) return; for (const x of c.querySelectorAll('[data-aj]')) x.classList.toggle('sel', x === b); for (const x of c.querySelectorAll('[data-ajs]')) x.classList.toggle('oc', x.dataset.ajs !== b.dataset.aj); };
  $('aM').value = motorAct;
  if (typeof icappConectar === 'function') icappConectar();   // (el ícono de la app: iconoapp.js)
  if (typeof milogoConectar === 'function') milogoConectar();   // (tu logo en el juego: milogo.js)
  $('aG').value = PREFS.gfx; $('aSo').value = String(PREFS.sombras); $('aPo').value = PREFS.post; $('aTq').value = PREFS.texQ;
  $('aR').value = PREFS.res; $('aD').value = PREFS.lejos; $('aS').value = PREFS.sens; $('aV').value = PREFS.vol; $('aF').checked = PREFS.fps; $('aC').checked = PREFS.contorno !== false; $('aU').checked = !!PREFS.ocultarUI; $('aDin').checked = PREFS.resDin !== false;
  if ($('aH')) $('aH').value = PREFS.hud || 80;
  $('aEmoR').checked = PREFS.emoRuleta !== false;
  $('aEv').checked = PREFS.evento !== false;
  const act = () => { $('aRv').textContent = $('aR').value + '%'; $('aDv').textContent = $('aD').value + ' m'; if ($('aH')) $('aHv').textContent = $('aH').value + '%'; };
  act();
  $('aG').onchange = () => { PREFS.gfx = $('aG').value; const p = PERFILES[PREFS.gfx]; if (p) { PREFS.res = p.res; PREFS.lejos = p.lejos; $('aR').value = p.res; $('aD').value = p.lejos; } act(); };
  $('aR').oninput = $('aD').oninput = act;
  $('aCtl').onclick = () => ctlAbrir(desde);
  $('aTut').onclick = () => { cerrarPaneles(); UI.abierto = null; tutAbrir(); };
  $('aReg').onclick = () => { if (typeof cnMostrar === 'function') cnMostrar(false); };
  // (comparar los FPS de los motores en la calidad elegida; en automático, Alto)
  $('aBanco').onclick = () => { const g = $('aG').value; bancoEmpezar(g === 'auto' ? 'alto' : g); };
  // el tamaño de los controles se ve al moverlo
  if ($('aH')) $('aH').oninput = () => { act(); PREFS.hud = +$('aH').value; hudDisponer(); };
  $('aOk').onclick = () => {
    const texAntes = GFX.texMax;
    PREFS.res = +$('aR').value; PREFS.lejos = +$('aD').value; PREFS.sens = +$('aS').value; PREFS.vol = +$('aV').value; PREFS.fps = $('aF').checked;
    PREFS.sombras = $('aSo').value; PREFS.post = $('aPo').value; PREFS.texQ = $('aTq').value; PREFS.contorno = $('aC').checked; PREFS.ocultarUI = $('aU').checked; PREFS.resDin = $('aDin').checked;
    if ($('aH')) PREFS.hud = +$('aH').value;
    PREFS.emoRuleta = $('aEmoR').checked;
    PREFS.evento = $('aEv').checked;
    const motorNuevo = $('aM').value; PREFS.motor = motorNuevo;
    guardarPrefs();
    // cambiar de motor necesita empezar de nuevo (el contexto de WebGL no se puede cambiar)
    if (motorNuevo !== motorAct) { motorCambiar(motorNuevo); return; }
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
const PANEL_DE = { celular: 'celular', omega: 'omegaPan', npc: 'npcPan', spawn: 'spawn', pausa: 'pausa', emotes: 'emotes', memes: 'memePan', maq: 'maqPan', sm: 'smPan', radio: 'radioPan', verity: 'verPan', terminal: 'verTerm' };
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
  const c = cajaDe(p); if (c.querySelector('.xCerrar, .mmX, .mqX, .celHome')) return;
  const b = document.createElement('button'); b.className = 'xCerrar'; b.setAttribute('aria-label', T('cerrar')); b.innerHTML = X_SVG;
  b.addEventListener('click', (e) => { e.stopPropagation(); cerrarPaneles(); });
  if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
  c.appendChild(b);
}
