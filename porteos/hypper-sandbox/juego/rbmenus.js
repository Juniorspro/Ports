// ---------------- Definitive RezoBox: los menús propios (multijugador, crear server y personajes) ----------------
// Reemplazan a los del Hypper original (el LobbyCanvas, que queda armado pero nunca se muestra). Van dentro del inicio
// (#rbInicio) con los mismos paneles claros: la lista de servers (los oficiales, los creados y los que tienen gente, con buscador,
// clave y borrar los tuyos), crear un server (nombre, clave, modo, mapa, PvP, RPG, nextbots y topes) y los personajes
// (skins y gorros) con el tuyo en 3D al costado, que se gira arrastrando.
const RBM = { q: '', clave: null, pjTab: 'skin', arr: null };
RB.srv = { n: '', pw: '', mo: 'Free', pvp: 0, rpg: 0, nb: 0, mp: 1000, mv: 40, m: '' };

// un aviso arriba del inicio (el del menú clásico no se ve)
function rbAviso(t) {
  if (!RB.el) return; let a = RB.el.querySelector('.rbAviso');
  if (!a) { a = document.createElement('div'); a.className = 'rbAviso'; RB.el.appendChild(a); }
  a.textContent = t; a.classList.add('ve'); clearTimeout(RBM.tAviso); RBM.tAviso = setTimeout(() => a.classList.remove('ve'), 2600);
}
const rbVisible = () => !!(RB.el && !RB.el.classList.contains('oc'));

// ---------------- multijugador: la lista de servers ----------------
function panelMulti(P) {
  if (typeof listaConectar === 'function') listaConectar();
  P.innerHTML = `<div class="rbPanCab">${glifo('gente')} ${esc(T('m.multi'))}<small class="mpCuenta"></small><span class="rbEsp"></span>
      <button class="rbBtnG rbChico" data-rb="mcrear">${glifo('mas')} ${esc(T('mp.crear'))}</button></div>
    <div class="rbBarra"><input id="mpBuscar" type="search" placeholder="${esc(T('mp.buscar'))}" value="${esc(RBM.q)}"><span class="mpEst"></span>
      <button class="rbBtnGris rbChico" data-rb="mpRef" title="${esc(T('mp.ref'))}">${glifo('girar')}</button></div>
    <div class="mpLista" id="mpLista"></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span>
      <button class="rbBtnG" data-rb="mpMejor">${glifo('jugar')} ${esc(T('mp.mejor'))}</button></div>`;
  P.querySelector('#mpBuscar').oninput = (e) => { RBM.q = e.target.value; listaDibujar(); };
  if (typeof salasCargar === 'function') salasCargar();
  listaDibujar();
}
// (lo llama listaDibujar de red.js con lo que hay en la lista)
function mpDibujar(L, mias) {
  const cont = RB.el && RB.el.querySelector('#mpLista'); if (!cont) return;
  const q = RBM.q.trim().toLowerCase(), V = L.filter((e) => !q || e.S.n.toLowerCase().includes(q) || mapaNom(e.S.m).toLowerCase().includes(q) || e.S.m.toLowerCase().includes(q));
  const jug = L.reduce((a, e) => a + e.j.length, 0);
  RB.el.querySelector('.mpCuenta').textContent = `${jug} ${T('mp.jug')} · ${L.length} ${T('mp.srv')}`;
  RB.el.querySelector('.mpEst').textContent = LISTA.on ? '' : typeof mqtt === 'undefined' ? T('mp.sinConex') : T('mp.conectando');
  cont.innerHTML = V.map((e) => {
    const S = e.S, mia = !!mias[S.id], vacio = S.rg && !e.j.length ? T('srv.vacio').replace('%', salaQueda(S)) : '';
    return `<div class="mpSala${mia ? ' mia' : ''}${e.j.length ? ' conGente' : ''}" data-id="${esc(S.id)}">
      <i class="mpFoto" style="background-image:url(${icono(MAPA_ICONO[S.m] || MAPA_ICONO.FlatGrass)})"></i>
      <div class="mpInfo"><b dir="auto">${esc(S.n)}${mia ? ` <em>${esc(T('srv.tuyo'))}</em>` : ''}${S.of ? ` <em class="mpOf">${esc(T('oficial'))}</em>` : ''}</b>
        <small>${esc(mapaNom(S.m))} · ${esc(S.mo === 'PvP' ? 'PvP' : T('mp.libre'))}${S.pvp ? '' : ' · ' + esc(T('mp.sinPvp'))}${vacio ? ' · ' + esc(vacio) : ''}</small>
        ${e.j.length ? `<span class="mpGente" dir="auto">${esc(e.j.slice(0, 6).join(', '))}${e.j.length > 6 ? ' +' + (e.j.length - 6) : ''}</span>` : ''}</div>
      <span class="mpN">${glifo('gente')} ${e.j.length}</span>${S.pw ? `<span class="mpCand" title="${esc(T('mp.clave'))}">${glifo('candado')}</span>` : ''}
      ${mia ? `<button class="rbBtnGris rbChico" data-rb="mpBorrar:${esc(S.id)}" title="${esc(T('srv.borrar'))}">${glifo('basura')}</button>` : ''}
      <button class="rbBtnG rbChico" data-rb="mpEntrar:${esc(S.id)}">${esc(T('mp.entrar'))}</button></div>`;
  }).join('') || `<div class="rbVacio">${esc(q ? T('mp.vacio') : T('mp.conectando'))}</div>`;
}
// entrar a un server (si tiene clave, se pide acá)
function mpEntrar(id) {
  const e = listaSalas().find((x) => x.S.id === id); if (!e) { rbAviso(T('errRed')); return; }
  entrarSala(e.S, undefined, e.j.length);
}
function mpPedirClave(S) {
  RBM.clave = S; let m = RB.el.querySelector('.mpModal');
  if (!m) {
    m = document.createElement('div'); m.className = 'mpModal';
    m.innerHTML = `<div class="mpModalC"><button class="mpX" data-rb="mpClaveNo">${glifo('no')}</button><b></b><small dir="auto"></small>
      <input id="mpClaveIn" type="password" maxlength="16" autocomplete="off"><div class="mpModalB"><button class="rbBtnG" data-rb="mpClaveOK"></button></div></div>`;
    RB.el.appendChild(m);
    m.querySelector('#mpClaveIn').addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') mpClaveOK(); if (ev.key === 'Escape') mpClaveNo(); });
  }
  m.querySelector('b').textContent = T('mp.clave'); m.querySelector('small').textContent = S.n; m.querySelector('[data-rb=mpClaveOK]').textContent = T('mp.entrar');
  m.querySelector('#mpClaveIn').value = ''; m.classList.add('ve'); setTimeout(() => m.querySelector('#mpClaveIn').focus(), 30);
}
function mpClaveNo() { const m = RB.el && RB.el.querySelector('.mpModal'); if (m) m.classList.remove('ve'); RBM.clave = null; }
function mpClaveOK() { const i = RB.el.querySelector('#mpClaveIn'); comprobarClave(i ? i.value.trim() : ''); }

// ---------------- crear un server ----------------
function panelMultiCrear(P) {
  const C = RB.srv; if (!C.n) C.n = (PREFS.nombre || 'Player') + "'s server"; if (!mapaValido(C.m)) C.m = RB.mapa || 'FlatGrass';
  const chk = (k, t) => `<button class="rbChk${C[k] ? ' on' : ''}" data-rb="mpTg:${k}"><em></em>${esc(T(t))}</button>`;
  const rango = (k, t, a, b, paso) => `<label class="rbRango">${esc(T(t))}<input type="range" min="${a}" max="${b}" step="${paso}" value="${C[k]}" data-mp="${k}"><output>${C[k]}</output></label>`;
  P.innerHTML = `<div class="rbPanCab">${glifo('mas')} ${esc(T('mp.crear'))}<small>${esc(mapaNom(C.m))}</small></div>
    <div class="rbForm"><div class="rbCol">
      <label class="rbCampo">${esc(T('mp.nombre'))}<input id="mpNom" maxlength="24" spellcheck="false"></label>
      <label class="rbCampo">${esc(T('mp.claveOpc'))}<input id="mpClaveN" maxlength="16" autocomplete="off" spellcheck="false"></label>
      <div class="rbSub">${esc(T('mp.modo'))}</div>
      <span class="rbSeg"><button class="${C.mo === 'Free' ? 'sel' : ''}" data-rb="mpModo:Free">${esc(T('mp.libre'))}</button><button class="${C.mo === 'PvP' ? 'sel' : ''}" data-rb="mpModo:PvP">PvP</button></span>
      <div class="rbFila">${chk('pvp', 'mp.pvp')}${chk('rpg', 'mp.rpg')}${chk('nb', 'mp.nb')}</div>
      ${rango('mp', 'mp.props', 0, 5000, 100)}${rango('mv', 'mp.autos', 0, 200, 5)}
    </div><div class="rbCol"><div class="rbSub">${esc(T('mapaBase'))}</div>
      <div class="rbGrid rbGridChica">${[...MAPAS, ...MAPAS_RB].map((m) => `<div class="rbMapaG${m === C.m ? ' sel' : ''}" data-rb="mpMapa:${m}"><div class="rbFoto" style="background-image:url(${icono(MAPA_ICONO[m])})"></div><b>${esc(mapaNom(m))}</b></div>`).join('')}</div>
    </div></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="multi">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span>
      <button class="rbBtnG" data-rb="mpCrearOK">${glifo('jugar')} ${esc(T('mp.crearOK'))}</button></div>`;
  const nom = P.querySelector('#mpNom'), cl = P.querySelector('#mpClaveN'); nom.value = C.n; cl.value = C.pw;
  nom.oninput = () => { C.n = nom.value; }; cl.oninput = () => { C.pw = cl.value; };
  P.querySelectorAll('[data-mp]').forEach((r) => { r.oninput = () => { C[r.dataset.mp] = +r.value; r.nextElementSibling.textContent = r.value; }; });
}

// ---------------- personajes: skins y gorros, con el tuyo en 3D al costado ----------------
function panelPersonajes(P) {
  RB.el.classList.add('rb3d'); if (!MENU.lobby) MENU.yaw = Math.PI + 0.45; menuLobby(true);
  const skin = RBM.pjTab === 'skin', lista = skin ? DATA.chars : DATA.hats;
  P.innerHTML = `<div class="rbPanCab">${glifo('persona')} ${esc(T('m.personajes'))}
      <span class="rbTabs"><button class="rbTab${skin ? ' sel' : ''}" data-rb="pjTab:skin">${esc(T('pj.skins'))}</button><button class="rbTab${skin ? '' : ' sel'}" data-rb="pjTab:hat">${esc(T('pj.gorros'))}</button></span></div>
    <div class="pjGrid">${lista.map((s) => {
      const sel = skin ? PREFS.skin === s : (PREFS.gorro || 'HatEmpty') === s, ic = skin ? RETRATO[s] || s : s;
      const img = DATA.ico[ic] ? icono(ic) : skin ? '' : icono('western-hat');
      return `<button class="pjCelda${sel ? ' sel' : ''}" data-rb="pjSel:${esc(s)}"><i style="${img ? `background-image:url(${img})` : ''}">${s === 'HatEmpty' ? glifo('no') : img ? '' : glifo('persona')}</i><b>${esc(s === 'HatEmpty' ? T('pj.sin') : skin ? skinNom(s) : s.replace(/^Hat/, ''))}</b></button>`;
    }).join('')}</div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span><span class="rbModo">${glifo('girar')} ${esc(T('pj.girar'))}</span></div>`;
}
function pjElegir(s) {
  if (RBM.pjTab === 'skin') PREFS.skin = s; else PREFS.gorro = s;
  guardarPrefs(); menuLobby(true, true); inicioPanel('personajes');
}
// girar el personaje arrastrando en el espacio libre (fuera del panel)
function rbArrastre() {
  RB.el.addEventListener('pointerdown', (e) => { if (RB.panel !== 'personajes' || e.target.closest('.rbPan, .rbAbajo, button')) return; RBM.arr = e.clientX; });
  addEventListener('pointermove', (e) => { if (RBM.arr === null || RB.panel !== 'personajes') return; MENU.yaw -= (e.clientX - RBM.arr) * 0.012; RBM.arr = e.clientX; });
  addEventListener('pointerup', () => { RBM.arr = null; });
}

// ---------------- entrar a una partida con la pantalla de carga (como al entrar a un server) ----------------
// el nombre del server y la captura de su mapa; "Recuperando la info del server", "Cargando el mapa" (lo pesado, con
// la pantalla ya dibujada) y, en un server, "Enviando la info del cliente" hasta que conecta (o 4 s como mucho)
const FONDO_MAPA = { FlatGrass: 'rb_flatgrass', City: 'rb_city', Desert: 'rb_desert', DesertV2: 'rb_desert', Mars: 'rb_mars', RB_Pizzeria: 'rb_pizzeria', RB_Construct: 'rb_construct', RB_Flatgrass: 'rb_gmflatgrass' };
const cuadroLibre = () => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));
async function entrarConCarga(titulo, mapa, jugar, red) {
  const C = window.__carga;
  if (TEST || !C || !C.abrir) { jugar(); return; }
  C.abrir(titulo, FONDO_MAPA[mapa] || '', 'rb_' + String(mapa).toLowerCase());
  if (red) { C.set(0.15, T('ld.info')); await cuadroLibre(); C.log(T('ld.info'), titulo); }
  C.set(0.35, T('ld.mapa')); await cuadroLibre(); await cuadroLibre();
  const t = performance.now();
  try { jugar(); } catch (e) { console.error(e); }
  C.log(T('ld.mapa'), mapaNom(mapa) + ' · ' + ((performance.now() - t) / 1000).toFixed(2) + ' s');
  if (red) {
    C.set(0.75, T('ld.cliente')); const t0 = Date.now();
    while (SALA && !RED.on && Date.now() - t0 < 4000) await new Promise((ok) => setTimeout(ok, 120));
    C.log(T('ld.cliente'), RED.on ? 'ok' : '-');
  }
  C.fin();
}

// ---------------- las acciones de estos paneles (las llama inicioAccion primero) ----------------
function rbMenusAccion(a, v) {
  switch (a) {
    case 'multi': inicioPanel('multi'); return true;
    case 'mcrear': inicioPanel('mcrear'); return true;
    case 'personajes': inicioPanel('personajes'); return true;
    case 'mpRef': listaPedir(); salasCargar(); return true;
    case 'mpEntrar': mpEntrar(v); return true;
    case 'mpBorrar': { const e = listaSalas().find((x) => x.S.id === v); if (e) borrarServidor(e.S); return true; }
    case 'mpMejor': { const e = listaSalas().find((x) => x.j.length) || listaSalas()[0]; if (e) entrarSala(e.S, undefined, e.j.length); return true; }
    case 'mpClaveOK': mpClaveOK(); return true;
    case 'mpClaveNo': mpClaveNo(); return true;
    case 'mpModo': RB.srv.mo = v; if (v === 'PvP') RB.srv.pvp = 1; inicioPanel('mcrear'); return true;
    case 'mpTg': RB.srv[v] = RB.srv[v] ? 0 : 1; inicioPanel('mcrear'); return true;
    case 'mpMapa': RB.srv.m = v; inicioPanel('mcrear'); return true;
    case 'mpCrearOK': crearServidor(Object.assign({}, RB.srv)); return true;
    case 'pjTab': RBM.pjTab = v; inicioPanel('personajes'); return true;
    case 'pjSel': pjElegir(v); return true;
  }
  return false;
}
