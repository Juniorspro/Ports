// ---------------- menú MOD (arriba): los mods activos en una lista, en vez de una columna de botones al costado ----------------
// Un botón "MOD" (tecla U) despliega la lista: volar, muñeco y SCP se prenden y apagan; el piano se pone (o se trae); la
// radio se pone, se lleva en la espalda o se le elige la emisora; los mods de código suman sus botones. El micrófono de
// la sala es otro botón chico arriba.
const MODM = { boton: null, el: null, abierto: false };
const NAT_TECLA = { volar: 'G', ragdoll: 'X', scp: 'J', piano: 'K', radio: 'L' };
addEventListener('pointerdown', (e) => { if (MODM.abierto && !(e.target.closest && e.target.closest('#modMenu, .modmBt'))) modMenuCerrar(); }, true);
function modMenuHay() { return JUEGO.estado === 'juego' && (NAT.mods.size > 0 || MODAPI.botones.size > 0); }
function modMenuBoton() {
  let b = MODM.boton;
  if (!b) {
    b = MODM.boton = document.createElement('div'); b.className = 'redondo bt modmBt'; b.innerHTML = '<b>MOD</b><small>(U)</small>';
    b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); audioIniciar(); modMenuAlternar(); };
    $('arribaIz').appendChild(b);
  }
  const hay = modMenuHay(); b.style.display = hay ? '' : 'none';
  if (!hay && MODM.abierto) modMenuCerrar(); else if (MODM.abierto) modMenuDibujar();
}
function modMenuAlternar() { if (MODM.abierto) modMenuCerrar(); else if (modMenuHay()) modMenuAbrir(); }
function modMenuAbrir() {
  if (!MODM.el) {
    const el = MODM.el = document.createElement('div'); el.id = 'modMenu'; el.className = 'oc';
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-mm]'); if (!b) return; audioIniciar(); modMenuAccion(b.dataset.mm); });
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
  const fila = (ico, nom, tecla, der, k, on) => `<div class="mmIt${on ? ' on' : ''}"${k ? ` data-mm="${k}"` : ''}><span class="mmIco">${ico}</span><span class="mmTx"><b dir="auto">${esc(nom)}</b>${tecla ? `<small>(${tecla})</small>` : ''}</span>${der}</div>`;
  const sw = '<i class="smSw"></i>', bt = (k, g, t) => `<button class="mmBt" data-mm="${k}">${glifo(g)}<span>${esc(t)}</span></button>`;
  let h = '';
  for (const k of ['volar', 'ragdoll', 'scp']) if (NAT.mods.has(k)) h += fila(icoHTML('ico:' + k), T(k + '.n'), NAT_TECLA[k], sw, 'nat:' + k, k === 'volar' ? NAT.volando : k === 'ragdoll' ? NAT.rag : NAT.scp);
  if (NAT.mods.has('piano')) h += fila(icoHTML('ico:piano'), T('piano.n'), NAT_TECLA.piano, bt('nat:piano', 'punto', T('mm.poner')));
  if (NAT.mods.has('radio')) {
    const e = radioMia();
    h += fila(icoHTML('ico:radio'), T('radio.n'), NAT_TECLA.radio, `<span class="mmBts">${bt('radio:poner', 'punto', T('mm.poner'))}${bt('radio:espalda', 'espalda', T(e && e.prm.ll ? 'ra.soltar' : 'ra.espalda'))}${bt('radio:emisora', 'musica', T('mm.emisora'))}</span>`);
  }
  // los botones de los mods de código ("ico:nombre" muestra la imagen)
  for (const [k, b] of MODAPI.botones) {
    const t = String(b.t || ''), ico = /^ico:[a-z_]{2,20}$/.test(t) ? icoHTML(t) : icoHTML(b.M.icono || 'ico:mod'), nom = /^ico:/.test(t) ? b.M.nombre : sinEmoji(t) || b.M.nombre;
    h += fila(ico, nom, '', nom === b.M.nombre ? '' : `<span class="mmMod" dir="auto">${esc(b.M.nombre)}</span>`, 'api:' + k);
  }
  MODM.el.innerHTML = `<div class="mmCab"><b>MOD</b><small>${esc(T('mm.ayuda'))}</small><button class="mmX" data-mm="cerrar">${glifo('no')}</button></div><div class="mmLista">${h}</div>`;
}
function modMenuAccion(k) {
  const [a, v] = k.split(/:(.*)/s);
  if (a === 'cerrar') { modMenuCerrar(); return; }
  if (JUEGO.estado !== 'juego') return;
  if (a === 'nat') {
    if (v === 'piano') { modMenuCerrar(); natAccion('piano'); return; }
    natAccion(v); modMenuDibujar(); return;
  }
  if (a === 'radio') {
    let e = radioMia();
    if (v === 'poner') { modMenuCerrar(); entidadPonerMod('radio'); return; }
    if (!e) { entidadPonerMod('radio', true); e = radioMia(); }
    if (v === 'espalda') { radioEspalda(e, !e.prm.ll); modMenuDibujar(); return; }
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
