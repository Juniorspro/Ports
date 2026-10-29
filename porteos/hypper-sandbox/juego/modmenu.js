// ---------------- menú MOD (arriba): usar los mods y prenderlos o apagarlos en cualquier momento ----------------
// Un botón "MOD" (tecla U) despliega dos partes. Arriba, lo que se usa: volar, muñeco y SCP se prenden y apagan, el piano
// se pone, la radio se pone, se lleva en la espalda o se le elige la emisora, y los botones de los mods de código. Abajo,
// todos los mods (los tuyos jugando solo; los del server en una sala) con su interruptor, que se aplica al momento, y la
// fuerza de los que cambian números (gravedad, velocidad, salto, tiempo, explosiones). El micrófono de la sala es otro
// botón chico arriba.
const MODM = { boton: null, el: null, abierto: false, q: '', tFz: 0 };
const NAT_TECLA = { volar: 'G', ragdoll: 'X', scp: 'J', piano: 'K', radio: 'L' };
addEventListener('pointerdown', (e) => { if (MODM.abierto && !(e.target.closest && e.target.closest('#modMenu, .modmBt'))) modMenuCerrar(); }, true);
function modMenuHay() { return JUEGO.estado === 'juego' && !CREA.on; }
function modMenuBoton() {
  let b = MODM.boton;
  if (!b) {
    b = MODM.boton = document.createElement('div'); b.className = 'redondo bt modmBt'; b.innerHTML = '<b>MOD</b><small>(U)</small><i class="mmN"></i>';
    b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); audioIniciar(); modMenuAlternar(); };
    $('arribaIz').appendChild(b);
  }
  const hay = modMenuHay(); b.style.display = hay ? '' : 'none';
  const n = hay ? modsActivosAhora().length : 0, ni = b.querySelector('.mmN'); ni.textContent = n || ''; ni.style.display = n ? '' : 'none';
  if (!hay && MODM.abierto) modMenuCerrar(); else if (MODM.abierto) modMenuLista();
}
function modMenuAlternar() { if (MODM.abierto) modMenuCerrar(); else if (modMenuHay()) modMenuAbrir(); }
function modMenuAbrir() {
  if (!MODM.el) {
    const el = MODM.el = document.createElement('div'); el.id = 'modMenu'; el.className = 'oc';
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { if (e.target.closest('.mmFz')) return; const b = e.target.closest('[data-mm]'); if (!b) return; audioIniciar(); modMenuAccion(b.dataset.mm); });
    el.addEventListener('input', (e) => {
      if (e.target.id === 'mmQ') { MODM.q = e.target.value; modMenuLista(); return; }
      const id = e.target.dataset && e.target.dataset.mf; if (!id) return;
      const v = +e.target.value / 100, o = e.target.parentElement.querySelector('output'); if (o) o.textContent = Math.round(v * 100) + '%';
      // (se aplica mientras se arrastra, como mucho 10 veces por segundo)
      clearTimeout(MODM.tFz); MODM.tFz = setTimeout(() => modFuerzaPoner(id, v), 100);
    });
    document.body.appendChild(el);
  }
  cerrarPaneles(); UI.abierto = 'modm'; MODM.abierto = true; soltarPuntero();
  MODM.el.classList.remove('oc'); MODM.boton.classList.add('on'); modMenuDibujar();
}
function modMenuCerrar() {
  MODM.abierto = false; if (MODM.el) MODM.el.classList.add('oc'); if (MODM.boton) MODM.boton.classList.remove('on');
  if (UI.abierto === 'modm') UI.abierto = null;
}
function modMenuDibujar() {
  if (!MODM.el || !MODM.abierto) return;
  const muchos = modsCatalogo().length > 6;
  MODM.el.innerHTML = `<div class="mmCab"><b>MOD</b><small class="mmCuenta"></small><button class="mmX" data-mm="cerrar">${glifo('no')}</button></div>`
    + (muchos ? `<div class="mmBus">${glifo('buscar')}<input id="mmQ" maxlength="40" spellcheck="false" placeholder="${esc(T('buscar'))}"></div>` : '') + '<div class="mmLista"></div>';
  if (muchos) MODM.el.querySelector('#mmQ').value = MODM.q;
  modMenuLista();
}
// sólo la lista (así el buscador no pierde lo escrito ni el foco)
function modMenuLista() {
  const L = MODM.el && MODM.el.querySelector('.mmLista'); if (!L || !MODM.abierto) return;
  const fila = (ico, nom, tecla, der, k, on, cl) => `<div class="mmIt${on ? ' on' : ''}${cl ? ' ' + cl : ''}"${k ? ` data-mm="${k}"` : ''}><span class="mmIco">${ico}</span><span class="mmTx"><b dir="auto">${esc(nom)}</b>${tecla ? `<small>(${tecla})</small>` : ''}</span>${der}</div>`;
  const sw = '<i class="smSw"></i>', bt = (k, g, t) => `<button class="mmBt" data-mm="${k}">${glifo(g)}<span>${esc(t)}</span></button>`;
  let u = '';
  for (const k of ['volar', 'ragdoll', 'scp']) if (NAT.mods.has(k)) u += fila(icoHTML('ico:' + k), T(k + '.n'), NAT_TECLA[k], sw, 'nat:' + k, k === 'volar' ? NAT.volando : k === 'ragdoll' ? NAT.rag : NAT.scp);
  if (NAT.mods.has('piano')) u += fila(icoHTML('ico:piano'), T('piano.n'), NAT_TECLA.piano, bt('nat:piano', 'punto', T('mm.poner')));
  if (NAT.mods.has('radio')) {
    const e = radioMia();
    u += fila(icoHTML('ico:radio'), T('radio.n'), NAT_TECLA.radio, `<span class="mmBts">${bt('radio:poner', 'punto', T('mm.poner'))}${bt('radio:espalda', 'espalda', T(e && e.prm.ll ? 'ra.soltar' : 'ra.espalda'))}${bt('radio:emisora', 'musica', T('mm.emisora'))}</span>`);
  }
  // los botones de los mods de código ("ico:nombre" muestra la imagen)
  for (const [k, b] of MODAPI.botones) {
    const t = String(b.t || ''), ico = /^ico:[a-z_]{2,20}$/.test(t) ? icoHTML(t) : icoHTML(b.M.icono || 'ico:mod'), nom = /^ico:/.test(t) ? b.M.nombre : sinEmoji(t) || b.M.nombre;
    u += fila(ico, nom, '', nom === b.M.nombre ? '' : `<span class="mmMod" dir="auto">${esc(b.M.nombre)}</span>`, 'api:' + k);
  }
  // todos los mods: los activos primero; el buscador mira nombre, descripción y etiquetas
  const act = modsFuente(), q = MODM.q.trim().toLowerCase();
  const todos = modsCatalogo().filter((m) => !q || (nombreDe(m) + ' ' + (descDe(m) || '') + ' ' + (m.etiquetas || []).map((e) => T('e.' + e)).join(' ')).toLowerCase().includes(q))
    .sort((a, b) => (act[b.id] ? 1 : 0) - (act[a.id] ? 1 : 0));
  let m = '';
  for (const x of todos.slice(0, 200)) {
    const on = !!act[x.id], f = modFuerza(x.id);
    const fz = on && modAjustable(x) ? `<label class="mmFz">${esc(T('mm.fuerza'))}<input type="range" min="0" max="200" step="10" value="${Math.round(f * 100)}" data-mf="${esc(x.id)}"><output>${Math.round(f * 100)}%</output></label>` : '';
    m += `<div class="mmIt mmCat${on ? ' on' : ''}" data-mm="mod:${esc(x.id)}"><span class="mmIco">${icoHTML(x.icono)}</span><span class="mmTx"><b dir="auto">${esc(nombreDe(x))}</b><small dir="auto">${esc(sinEmoji(descDe(x) || (x.oficial ? T('oficial') : T('por') + ' ' + (x.autor || ''))))}</small></span>${sw}${fz}</div>`;
  }
  if (!m) m = `<div class="mmVacio">${esc(T('sinRes'))}</div>`;
  const sm = typeof SALA !== 'undefined' && SALA ? `<button class="mmBt mmSm" data-mm="sm">${icoHTML('ico:mod')}<span>${esc(T('sm.tit'))} (M)</span></button>` : '';
  L.innerHTML = (u ? `<div class="mmSec">${esc(T('mm.usar'))}</div>${u}` : '') + `<div class="mmSec">${esc(T('t.mods'))}</div>${m}${sm}`;
  const c = MODM.el.querySelector('.mmCuenta'); if (c) c.textContent = `${Object.keys(act).filter((id) => modsCatalogo().some((x) => x.id === id)).length} ${T('sm.activos')} · ${T('mm.ayuda')}`;
}
function modMenuAccion(k) {
  const [a, v] = k.split(/:(.*)/s);
  if (a === 'cerrar') { modMenuCerrar(); return; }
  if (JUEGO.estado !== 'juego') return;
  if (a === 'mod') { modAlternar(v); modMenuBoton(); return; }
  if (a === 'sm') { modMenuCerrar(); smAbrir(); return; }
  if (a === 'nat') {
    if (v === 'piano') { modMenuCerrar(); natAccion('piano'); return; }
    natAccion(v); modMenuLista(); return;
  }
  if (a === 'radio') {
    let e = radioMia();
    if (v === 'poner') { modMenuCerrar(); entidadPonerMod('radio'); return; }
    if (!e) { entidadPonerMod('radio', true); e = radioMia(); }
    if (v === 'espalda') { radioEspalda(e, !e.prm.ll); modMenuLista(); return; }
    if (v === 'emisora') { modMenuCerrar(); radioAbrir(e); return; }
  }
  if (a === 'api') { const b = MODAPI.botones.get(v); if (b) modapiA(b.M, 'boton', { id: b.id }); }
}
// el micrófono de la sala: botón chico arriba (sólo en una sala)
function vozBotonPoner(si) {
  let b = $('vozBt');
  if (!b) {
    b = document.createElement('div'); b.id = 'vozBt'; b.className = 'redondo bt vozBt'; b.innerHTML = glifo('micro') + '<small>MIC</small>';
    b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); audioIniciar(); VOZ.on ? vozApagar() : vozActivar(); };
    $('arribaIz').appendChild(b);
  }
  b.style.display = si ? '' : 'none'; b.classList.toggle('on', VOZ.on);
}
