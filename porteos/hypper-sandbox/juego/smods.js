// ---------------- mods del server (SM) ----------------
// En una sala el juego baja solo todos los mods publicados en la tienda (y cada minuto los nuevos: apenas alguien sube
// uno, el server lo tiene). Cada jugador elige con el botón SMOD (tecla M) cuáles usa él; se aplican al momento, sin
// límite. Todos ven todo: lo que hace cada uno llega por la red (posición, personaje, vuelo, SCP, muñeco, objetos,
// explosiones, piano y radio), lo tenga activado o no el que mira. La elección se guarda aparte de la de un jugador.
const SRV = { mods: new Map(), desde: 0, cargando: false, primera: true, t: 0, falta: false };
const SMOD = { ids: new Set(), nat: '', cod: '', armas: new Set(), q: '', filtro: '', abierto: false, boton: null };
// todos los del server: los oficiales, los de la tienda y los tuyos sin publicar
const smTodos = () => { const L = [...OFICIALES], vistos = new Set(L.map((m) => m.id)); for (const m of SRV.mods.values()) if (!vistos.has(m.id)) { L.push(m); vistos.add(m.id); } for (const m of Object.values(INST.mods)) if (!vistos.has(m.id)) { L.push(m); vistos.add(m.id); } return L; };
const smActivos = () => smTodos().filter((m) => PREFS.modsSrv && PREFS.modsSrv[m.id]);
async function srvModsCargar() {
  if (SRV.cargando) return; SRV.cargando = true; SRV.falta = false;
  const nuevos = [];
  try {
    for (let pag = 0; pag < 400; pag++) {
      const d = await (await fetch(TIENDA_URL + 'mods?desde=' + SRV.desde)).json();
      for (const x of d.items || []) {
        const v = validarRB(x.d); SRV.desde = Math.max(SRV.desde, +x.fecha || 0);
        if (typeof v === 'string' || v.formato !== 'rezobox-mod') continue;
        v.id = x.id; v.remoto = true; if (!SRV.mods.has(x.id)) nuevos.push(v); SRV.mods.set(x.id, v);
      }
      if (Array.isArray(d.vivos)) { const vv = new Set(d.vivos); for (const id of [...SRV.mods.keys()]) if (!vv.has(id)) SRV.mods.delete(id); }
      if (!d.mas || !(d.items || []).length) break;
    }
    if (!SRV.primera && nuevos.length && JUEGO.estado === 'juego' && SALA) aviso(T('sm.nuevo') + ': ' + nuevos.slice(0, 3).map((m) => m.nombre).join(', ') + (nuevos.length > 3 ? ' +' + (nuevos.length - 3) : ''), 4);
    SRV.primera = false;
  } catch (e) { SRV.falta = true; }
  SRV.cargando = false;
  if (SALA && JUEGO.estado === 'juego') smAplicar(false);
  if (SMOD.abierto) smDibujar();
}
// cada cuadro en una sala: busca mods nuevos cada minuto
function smPaso(dt) {
  if (!SALA || JUEGO.estado !== 'juego') return;
  SRV.t -= dt; if (SRV.t > 0) return; SRV.t = SRV.falta ? 15 : 60; srvModsCargar();
}
// ---------------- aplicar al momento lo que elegiste ----------------
function smEfectos(act) {
  const E = { gravedad: 1, velocidad: 1, salto: 1, tiempo: 1, explosion: 1, municionInfinita: false, invencible: false, skin: null, hora: null, armas: [], aparecer: [] };
  for (const m of act) {
    const e = m.efectos; E.gravedad *= e.gravedad; E.velocidad *= e.velocidad; E.salto *= e.salto; E.explosion *= e.explosion;
    E.municionInfinita = E.municionInfinita || e.municionInfinita; E.invencible = E.invencible || e.invencible;
    if (e.skin) E.skin = e.skin; if (e.hora != null) E.hora = e.hora; E.armas.push(...e.armas);
  }
  return E;
}
function smAplicar(primera) {
  if (!RB.base) RB.base = { v: JUG.vel_max, s: JUG.salto };
  const act = smActivos(), E = smEfectos(act);
  // en la sala el mundo y el tiempo son de todos: la gravedad del mod es sólo la tuya (tu salto y tu caída)
  Object.assign(MODS, E); MODS.tiempo = 1; JUG.grav = E.gravedad;
  JUG.vel_max = RB.base.v * E.velocidad; JUG.salto = RB.base.s * E.salto;
  // armas que suman los mods (las que suman se sacan al desactivarlos)
  const antes = ARM.lista[ARM.i];
  for (const a of [...SMOD.armas]) if (!E.armas.includes(a)) { const i = ARM.lista.indexOf(a); if (i >= 0) ARM.lista.splice(i, 1); SMOD.armas.delete(a); }
  for (const a of E.armas) if (DEF_ARMAS[a] && !ARM.lista.includes(a)) { ARM.lista.push(a); SMOD.armas.add(a); }
  if (ARM.lista[ARM.i] !== antes || ARM.i >= ARM.lista.length) { const i = ARM.lista.indexOf(antes); elegirArma(i >= 0 ? i : ARM.lista.length - 1); }
  // personaje del mod (no cambia el tuyo guardado); los demás lo ven porque viaja en tu estado
  const sk = E.skin && RETRATO[E.skin] ? E.skin : null;
  if (sk !== (JUG.skinMod || null)) { JUG.skinMod = sk; if (!primera && JUG.vivo && !NAT.rag && JUG.cuerpo) jugadorCuerpoNuevo(); }
  if (E.hora != null && E.hora !== SMOD.hora) { DIA.ciclo = false; DIA.hora = E.hora; DIA.aplicada = -1; } SMOD.hora = E.hora;
  // lo que hace aparecer un mod: sólo al activarlo
  const ids = new Set(act.map((m) => m.id));
  if (!primera) for (const m of act) if (!SMOD.ids.has(m.id) && m.efectos.aparecer.length) aparecerDelante(m.efectos.aparecer.slice(0, 60));
  SMOD.ids = ids;
  const nat = act.filter((m) => m.nativo).map((m) => m.nativo).sort().join(',');
  if (nat !== SMOD.nat) { SMOD.nat = nat; natIniciar(nat ? nat.split(',') : []); }
  const cods = act.filter((m) => m.codigo), cod = cods.map((m) => m.id).sort().join(',');
  if (cod !== SMOD.cod) { SMOD.cod = cod; modapiCargar(cods); }
  RED.wSucio = true; // los demás ven qué mods usás (en tu etiqueta)
}
function smReiniciar() { SMOD.ids = new Set(); SMOD.nat = null; SMOD.cod = null; SMOD.armas.clear(); SMOD.hora = null; JUG.skinMod = null; JUG.grav = 1; }
// ---------------- botón SMOD y panel ----------------
function smBotonPoner(si) {
  let b = SMOD.boton;
  if (!b) {
    b = SMOD.boton = document.createElement('div'); b.className = 'redondo bt smBt'; b.innerHTML = '<b>SM</b><small>(M)</small>';
    b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); audioIniciar(); smAbrir(); };
    $('arribaIz').appendChild(b);
  }
  b.style.display = si ? '' : 'none';
}
function smAbrir() {
  if (!SALA || JUEGO.estado !== 'juego') return;
  let p = $('smPan');
  if (!p) {
    p = document.createElement('div'); p.id = 'smPan'; p.className = 'panel oc'; document.body.appendChild(p);
    p.innerHTML = `<div class="caja smCaja"><h3>${icoHTML('ico:mod')} <span class="smTit"></span> <small class="smCuenta"></small></h3>
      <div class="smBarra"><input id="smQ" type="search" maxlength="40" spellcheck="false"><button class="boton chico" data-sm="todos"></button><button class="boton chico gris" data-sm="ninguno"></button></div>
      <div class="smFiltros"></div><div id="smLista"></div><div class="smPie"><span class="smInfo"></span><button class="boton chico gris" data-sm="cerrar"></button></div></div>`;
    p.addEventListener('click', (e) => { if (e.target === p) return smCerrar(); const b = e.target.closest('[data-sm]'); if (b) smAccion(b.dataset.sm); });
    p.querySelector('#smQ').addEventListener('input', (e) => { SMOD.q = e.target.value; smDibujar(); });
  }
  cerrarPaneles(); p.classList.remove('oc'); UI.abierto = 'sm'; SMOD.abierto = true; soltarPuntero();
  p.querySelector('#smQ').placeholder = T('buscar'); p.querySelector('#smQ').value = SMOD.q;
  smDibujar();
  if (!SRV.mods.size && !SRV.cargando) srvModsCargar();
}
function smCerrar() { const p = $('smPan'); if (p) p.classList.add('oc'); SMOD.abierto = false; if (UI.abierto === 'sm') UI.abierto = null; }
// cuántos de la sala usan cada mod (lo publica cada uno en su mundo)
function smUsan() {
  const n = new Map(), suma = (id) => n.set(id, (n.get(id) || 0) + 1);
  for (const id of SMOD.ids) suma(id);
  for (const R2 of RED.remotos.values()) for (const id of R2.mods || []) suma(id);
  return n;
}
function smDibujar() {
  const p = $('smPan'); if (!p) return;
  const q = SMOD.q.trim().toLowerCase(), f = SMOD.filtro, usan = smUsan(), act = PREFS.modsSrv || {};
  const todos = smTodos(), lista = todos.filter((m) => (!q || (nombreDe(m) + ' ' + (m.autor || '') + ' ' + descDe(m)).toLowerCase().includes(q))
    && (!f || (f === 'act' ? act[m.id] : f === 'of' ? m.oficial : f === 'cod' ? m.codigo : f === 'usan' ? usan.get(m.id) : (m.etiquetas || []).includes(f))));
  lista.sort((a, b) => (!!act[b.id] - !!act[a.id]) || ((usan.get(b.id) || 0) - (usan.get(a.id) || 0)) || (!!b.oficial - !!a.oficial));
  p.querySelector('.smTit').textContent = T('sm.tit');
  p.querySelector('.smCuenta').textContent = `${todos.length}${SRV.cargando ? ' · ' + T('cargando') : SRV.falta ? ' · ' + T('errRed') : ''}`;
  p.querySelector('[data-sm=todos]').innerHTML = glifo('si') + ' ' + esc(T('sm.todos')); p.querySelector('[data-sm=ninguno]').innerHTML = glifo('no') + ' ' + esc(T('sm.ninguno')); p.querySelector('[data-sm=cerrar]').textContent = T('cerrar');
  const chips = [['', T('e.todas')], ['act', T('sm.activos'), 'si'], ['usan', T('sm.usan'), 'gente'], ['of', T('oficial'), 'estrella'], ['cod', T('sm.codigo'), 'codigo'], ...ETIQUETAS_RB.map((e) => [e, T('e.' + e)])];
  p.querySelector('.smFiltros').innerHTML = chips.map(([k, t, g]) => `<button class="${k === f ? 'sel' : ''}" data-sm="f:${k}">${g ? glifo(g) + ' ' : ''}${esc(t)}</button>`).join('');
  const LZ = p.querySelector('#smLista'), sc = LZ.scrollTop;
  LZ.innerHTML = lista.map((m) => {
    const on = !!act[m.id], u = usan.get(m.id) || 0;
    return `<button class="smIt${on ? ' on' : ''}" data-sm="t:${esc(m.id)}"><span class="smIco">${icoHTML(m.icono)}</span><span class="smTx"><b dir="auto">${esc(nombreDe(m))}</b>
      <small dir="auto">${m.oficial ? glifo('estrella') + ' ' + esc(T('oficial')) : esc(T('por')) + ' ' + esc(m.autor || '')}${m.codigo ? ' · ' + glifo('codigo') : ''}${u ? ` · ${glifo('gente')} ${u}` : ''}</small><em dir="auto">${esc(descDe(m) || '')}</em></span><i class="smSw"></i></button>`;
  }).join('') || `<div class="radioVacio">${esc(SRV.cargando ? T('cargando') : T('sinRes'))}</div>`;
  LZ.scrollTop = sc;
  p.querySelector('.smInfo').innerHTML = `${glifo('si')} ${SMOD.ids.size} ${esc(T('sm.activos'))} · ${glifo('gente')} ${RED.remotos.size + 1}`;
}
// confirmar una vez los que traen código (corren aislados, pero los hizo otra persona)
function smCodigoOk(lista) {
  const PS = PREFS.codigoOk || (PREFS.codigoOk = {}), nuevos = lista.filter((m) => m.codigo && !m.oficial && !PS[m.id]);
  if (!nuevos.length) return true;
  if (!confirm(T('codigoAviso') + (nuevos.length > 1 ? ` (${nuevos.length})` : ''))) return false;
  for (const m of nuevos) PS[m.id] = 1; return true;
}
function smAccion(k) {
  const [a, v] = k.split(/:(.*)/s);
  if (!PREFS.modsSrv) PREFS.modsSrv = {};
  if (a === 'cerrar') return smCerrar();
  if (a === 'f') { SMOD.filtro = v || ''; return smDibujar(); }
  if (a === 't') {
    const m = smTodos().find((x) => x.id === v); if (!m) return;
    if (PREFS.modsSrv[v]) delete PREFS.modsSrv[v]; else { if (!smCodigoOk([m])) return; PREFS.modsSrv[v] = true; }
    // sólo cambia esa tarjeta (si se reordenara la lista, lo que tocaste se movería de lugar)
    guardarPrefs(); smAplicar(false);
    const p = $('smPan'), b = p && [...p.querySelectorAll('.smIt')].find((x) => x.dataset.sm === 't:' + v); if (b) b.classList.toggle('on', !!PREFS.modsSrv[v]);
    if (p) p.querySelector('.smInfo').innerHTML = `${glifo('si')} ${SMOD.ids.size} ${esc(T('sm.activos'))} · ${glifo('gente')} ${RED.remotos.size + 1}`;
    return;
  } else if (a === 'todos') {
    const L = smTodos(); if (!smCodigoOk(L)) return; for (const m of L) PREFS.modsSrv[m.id] = true;
  } else if (a === 'ninguno') PREFS.modsSrv = {};
  guardarPrefs(); smAplicar(false); smDibujar();
}
// los íconos de los mods que usa otro jugador, al lado de su nombre (si no tengo alguno, lo busco en la tienda)
function smDeOtro(R2, ids) {
  R2.mods = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string' && /^[\w-]{1,24}$/.test(x)).slice(0, 200);
  const todos = new Map(smTodos().map((m) => [m.id, m]));
  if (R2.mods.some((id) => !todos.has(id)) && !SRV.cargando) { SRV.t = 0; }
  R2.icos = R2.mods.map((id) => todos.get(id)).filter(Boolean).map((m) => m.icono).slice(0, 4); etiquetaRemota(R2);
  if (SMOD.abierto) smDibujar();
}
