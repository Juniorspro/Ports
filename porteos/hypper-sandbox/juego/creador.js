// ---------------- modo creador de mapas ----------------
// Volás libre sobre un mapa del juego y armás el tuyo: props (con el menú de siempre), puntos de aparición con su rol,
// roles (nombre, color, personaje, vida, velocidad, salto, armas), entidades (piano, radio, mega rampa, botón de
// autos, teletransporte, zona de muerte, cartel, luz, impulso, meta, música) y los datos del mapa. Se guarda como
// .rbmapa (queda en "Comunidad"), se prueba al toque y se publica en la tienda.
const CREA = { on: false, mapa: null, tipo: null, sel: null, rol: '', bar: null, pan: null, tFoto: 0 };
// qué se puede tocar de cada entidad: [clave, tipo, mín, máx, paso]
const ENT_PRM = {
  piano: [['n', 'num', 5, 61, 1], ['o', 'num', 0, 7, 1], ['a', 'num', 0.4, 4, 0.1], ['l', 'num', 1, 20, 0.5]],
  radio: [['v', 'yt'], ['vol', 'num', 0, 1, 0.05], ['r', 'num', 5, 300, 1]],
  musica: [['v', 'yt'], ['r', 'num', 5, 400, 5]],
  rampa: [['alto', 'num', 10, 600, 5], ['ancho', 'num', 6, 80, 1], ['ang', 'num', 15, 80, 1], ['salto', 'bool']],
  boton_autos: [['auto', 'auto'], ['a', 'aqui'], ['ini', 'bool']],
  teleport: [['a', 'aqui']],
  zona_muerte: [['s', 'vec', 0.5, 500, 0.5]],
  cartel: [['texto', 'txt'], ['color', 'color']],
  luz: [['color', 'color'], ['r', 'num', 1, 80, 1], ['i', 'num', 0.05, 6, 0.05]],
  impulso: [['f', 'num', 0, 200, 1], ['d', 'num', 0, 200, 1]],
  meta: [['texto', 'txt']],
};
const ROL_COLORES = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1'];
function creadorNuevo(base) { return { formato: 'rezobox-mapa', nombre: '', descripcion: '', etiquetas: [], base, hora: null, gravedad: 1, aparicion: null, roles: [], spawns: [], entidades: [], objetos: [] }; }
// desde el inicio: arranca la partida en modo creador (con un mapa nuevo o uno guardado para seguir editándolo)
function creadorEmpezar(base, datos) {
  CREA.mapa = datos ? JSON.parse(JSON.stringify(datos)) : creadorNuevo(base); CREA.mapa.base = base;
  CREA.on = true; CREA.tipo = null; CREA.sel = null; CREA.rol = '';
  RB.horaPartida = 'normal'; RB.mapaPartida = null; SALA = null; inicioMostrar(false); empezarPartida(base);
}
// lo llama aplicarMods en modo creador: carga lo que había y prepara el HUD
function creadorIniciar() {
  const m = CREA.mapa;
  for (const x of m.objetos || []) { const o = crearObjeto(x.n, v3(0, 0, 0), new Quat(x.q[0], x.q[1], x.q[2], x.q[3]), { congelado: !!x.f }); if (o) { o.b.pos.set(x.p[0], x.p[1], x.p[2]); o.b.q.set(x.q[0], x.q[1], x.q[2], x.q[3]); o.b.updateWorld(); } }
  entidadesCargar(m.entidades);
  if (m.aparicion) JUG.pos.set(m.aparicion[0], m.aparicion[1], m.aparicion[2]);
  if (m.gravedad && m.gravedad !== 1) { MUNDO.gravedad *= m.gravedad; PH.gscale = MUNDO.gravedad; }
  if (m.hora != null) { DIA.ciclo = false; DIA.hora = m.hora; DIA.aplicada = -1; }
  JUG.noclip = true; MODS.invencible = true;
  creadorBarra(); setTimeout(() => aviso(T('cr.hola'), 4), 400);
}
function creadorSalir() { CREA.on = false; CREA.tipo = null; CREA.sel = null; if (CREA.bar) { CREA.bar.remove(); CREA.bar = null; } creadorPanelCerrar(); }
// ---------------- barra de herramientas ----------------
function creadorBarra() {
  if (CREA.bar) CREA.bar.remove();
  const b = document.createElement('div'); b.id = 'creaBar'; $('hud').appendChild(b); CREA.bar = b;
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); const x = e.target.closest('[data-cr]'); if (!x) return; e.preventDefault(); audioIniciar(); creadorAccion(x.dataset.cr); });
  creadorBarraDibujar();
}
function creadorBarraDibujar() {
  const b = CREA.bar; if (!b) return;
  const rol = CREA.mapa.roles.find((r) => r.id === CREA.rol), bt = (k, t, extra) => `<button class="crBt${extra || ''}" data-cr="${k}">${t}</button>`;
  let h = bt('paleta', glifo('mas') + ' ' + esc(T('cr.entidad'))) + bt('punto', `${glifo('punto')} ${esc(T('cr.punto'))}${rol ? ` <i style="background:${rol.color}"></i>` : ''}`) + bt('roles', glifo('gente')) + bt('mapa', glifo('ajustes')) + bt('guardar', glifo('guardar')) + bt('probar', glifo('jugar')) + bt('publicar', glifo('subir'));
  if (CREA.tipo) h += `<span class="crSep"></span><span class="crTxt">${icoHTML('ico:' + ENT_INFO[CREA.tipo][0])} ${esc(T('ent.' + CREA.tipo))}</span>` + bt('poner', glifo('si') + ' ' + esc(T('cr.poner')), ' crSi') + bt('cancelar', glifo('no'));
  else if (CREA.sel) h += `<span class="crSep"></span><span class="crTxt">${CREA.sel.e ? icoHTML('ico:' + ENT_INFO[CREA.sel.e.t][0]) + ' ' + esc(T('ent.' + CREA.sel.e.t)) : glifo('punto') + ' ' + esc(T('cr.punto'))}</span>` + (CREA.sel.e && ENT_PRM[CREA.sel.e.t] ? bt('editar', glifo('lapiz')) : '') + bt('girar', glifo('girar')) + bt('traer', glifo('traer')) + bt('borrar', glifo('basura'), ' crNo');
  b.innerHTML = h;
}
function creadorAccion(k) {
  const m = CREA.mapa;
  if (k === 'paleta') return creadorPaleta();
  if (k === 'punto') return creadorPonerPunto();
  if (k === 'roles') return creadorRoles();
  if (k === 'mapa') return creadorDatosPanel();
  if (k === 'guardar') { const v = creadorGuardar(); if (v) aviso(T('cr.guardado'), 2); return; }
  if (k === 'probar') { const v = creadorGuardar(); if (!v) return; creadorSalir(); RB.mapaCom = v.id; RB.mapaPartida = v; RB.horaPartida = 'normal'; empezarPartida(v.base); return; }
  if (k === 'publicar') return creadorPublicar();
  if (k === 'poner') return creadorPoner();
  if (k === 'cancelar') { CREA.tipo = null; return creadorBarraDibujar(); }
  const S = CREA.sel; if (!S) return;
  if (k === 'borrar') { if (S.e) entidadQuitar(S.e); else m.spawns.splice(S.s, 1); CREA.sel = null; return creadorBarraDibujar(); }
  if (k === 'editar' && S.e) return creadorEditar(S.e);
  if (k === 'girar') { if (S.e) { const d = entidadDatos(S.e); d.yaw = ((d.yaw + Math.PI / 4) % TAU); creadorRehacer(S.e, d); } else m.spawns[S.s].yaw = ((m.spawns[S.s].yaw || 0) + Math.PI / 4) % TAU; return; }
  if (k === 'traer') { const p = creadorPunto(); if (S.e) { const d = entidadDatos(S.e); d.p = [p.x, p.y, p.z]; creadorRehacer(S.e, d); } else m.spawns[S.s].p = [p.x, p.y, p.z]; }
}
function creadorRehacer(e, d) { entidadQuitar(e); const n = entidadCrear(d); CREA.sel = { e: n }; creadorBarraDibujar(); return n; }
// adonde apunta la cámara (o 8 m adelante si no hay nada)
function creadorPunto() { const h = raycast(CAM.pos, CAM.fwd, 250, null); return h ? h.p : vadd(CAM.pos, vscale(CAM.fwd, 8)); }
function creadorPoner() {
  if (!CREA.tipo) return; const p = creadorPunto(), t = CREA.tipo, prm = {};
  if (t === 'teleport') prm.a = [+JUG.pos.x.toFixed(2), +(JUG.pos.y - 1).toFixed(2), +JUG.pos.z.toFixed(2)];
  const e = entidadCrear({ t, p: [p.x, p.y, p.z], yaw: JUG.yaw, prm });
  if (e) { CREA.sel = { e }; sonar('Click', null, 0.6); if (t === 'teleport' || t === 'boton_autos') aviso(T('cr.fijar'), 3); }
  CREA.tipo = null; creadorBarraDibujar();
}
function creadorPonerPunto() {
  const p = creadorPunto(), m = CREA.mapa; if (m.spawns.length >= 256) return;
  m.spawns.push({ p: [p.x, p.y, p.z].map((x) => +x.toFixed(2)), yaw: +JUG.yaw.toFixed(3), rol: CREA.rol || null });
  CREA.sel = { s: m.spawns.length - 1 }; sonar('Click', null, 0.6); creadorBarraDibujar();
}
// lo que tengo en la mira (entidad o punto) para elegirlo
function creadorApuntado() {
  let best = null, bd = 1;
  const o = CAM.pos, d = CAM.fwd, probar = (p, x) => { const v = vsub(p, o), t = vdot(v, d); if (t < 0.3 || t > 90) return; const q = vsub(v, vscale(d, t)).len() / (0.6 + t * 0.06); if (q < bd) { bd = q; best = x; } };
  for (const e of ENTS.lista) if (!e.red && e.dueno === 'yo') probar(vadd(entPos(e), v3(0, 0.6, 0)), { e });
  CREA.mapa.spawns.forEach((s, i) => probar(v3(s.p[0], s.p[1] + 1, s.p[2]), { s: i }));
  return best;
}
// cada cuadro: elegir lo apuntado (clic o disparo) y poner (con la entidad elegida)
function creadorPaso() {
  if (!CREA.on || UI.abierto) return false;
  const tocar = ENT.disparo && !CREA.disAnt; CREA.disAnt = ENT.disparo;
  if (ARM.lista[ARM.i] === 'PhysicsGun' && !CREA.tipo) return false;
  if (tocar) {
    if (CREA.tipo) creadorPoner();
    else { const a = creadorApuntado(); CREA.sel = a; creadorBarraDibujar(); }
    if (!ENT.tactil) ENT.disparo = false;
  }
  return true; // en el creador las armas no disparan (salvo la pistola de física)
}
addEventListener('keydown', (e) => {
  if (!CREA.on || e.repeat || UI.abierto || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
  const k = { Enter: 'poner', Delete: 'borrar', Backspace: 'borrar', KeyM: 'paleta', KeyO: 'punto', KeyY: 'girar' }[e.code];
  if (k) { creadorAccion(k === 'poner' && !CREA.tipo ? '' : k); e.preventDefault(); }
});
// marcadores: puntos de aparición (con el color del rol), lo elegido y lo que se va a poner
function creadorDibujar() {
  if (!CREA.on) return;
  const m = CREA.mapa, mk = matPropio('marca', [1, 1, 1], { pbr: [0.5, 0, 0.04] });
  m.spawns.forEach((s, i) => {
    const r = m.roles.find((x) => x.id === s.rol), c = colorRGB(r ? r.color : '#ffffff'), sel = CREA.sel && CREA.sel.s === i, p = v3(s.p[0], s.p[1], s.p[2]);
    dibujarCaja(vadd(p, v3(0, 0.9, 0)), [0.5, 1.8, 0.5], null, mk, { c: [c[0], c[1], c[2], 1], em: c.map((x) => x * (sel ? 1.6 : 0.5)) });
    linea(vadd(p, v3(0, 1, 0)), vadd(p, v3(Math.sin(s.yaw || 0) * 1.6, 1, Math.cos(s.yaw || 0) * 1.6)), [c[0], c[1], c[2], 1]);
  });
  for (const e of ENTS.lista) if (e.dueno === 'yo' && !e.red && !['piano', 'rampa', 'radio', 'boton_autos', 'cartel', 'meta', 'impulso', 'teleport'].includes(e.t)) dibujarCaja(vadd(e.p, v3(0, 0.4, 0)), [0.5, 0.5, 0.5], e.q, mk, { c: [0.9, 0.6, 1, 1], em: [0.6, 0.3, 0.8] });
  if (CREA.sel && CREA.sel.e) { const p = entPos(CREA.sel.e); for (const [a, b] of [[v3(-1, 0, 0), v3(1, 0, 0)], [v3(0, 0, 0), v3(0, 3, 0)], [v3(0, 0, -1), v3(0, 0, 1)]]) linea(vadd(p, a), vadd(p, b), [1, 0.85, 0.2, 1]); }
  if (CREA.tipo) { const p = creadorPunto(); dibujarCaja(vadd(p, v3(0, 0.3, 0)), [0.6, 0.6, 0.6], Quat.axis(0, 1, 0, JUG.yaw), mk, { c: [0.3, 1, 0.5, 1], em: [0.2, 1, 0.4] }); linea(p, vadd(p, v3(Math.sin(JUG.yaw) * 2, 0.3, Math.cos(JUG.yaw) * 2)), [0.3, 1, 0.5, 1]); }
}
// ---------------- paneles ----------------
function creadorPanel(html) {
  let p = $('creaPan'); if (!p) { p = document.createElement('div'); p.id = 'creaPan'; p.className = 'panel oc'; document.body.appendChild(p);
    p.addEventListener('click', (e) => { if (e.target === p) creadorPanelCerrar(); const b = e.target.closest('[data-cp]'); if (b) creadorPanelAccion(b.dataset.cp, b); }); }
  cerrarPaneles(); p.innerHTML = `<div class="caja creaCaja">${html}</div>`; p.classList.remove('oc'); UI.abierto = 'crea'; soltarPuntero(); CREA.pan = p; return p;
}
function creadorPanelCerrar() { const p = $('creaPan'); if (p) p.classList.add('oc'); if (UI.abierto === 'crea') UI.abierto = null; }
function creadorPaleta() {
  creadorPanel(`<h3>${glifo('mas')} ${esc(T('cr.entidad'))}</h3><div class="crPaleta">${Object.keys(ENT_INFO).map((t) => `<button data-cp="tipo:${t}"><b>${icoHTML('ico:' + ENT_INFO[t][0])}</b>${esc(T('ent.' + t))}</button>`).join('')}</div>
    <p class="crAyuda">${esc(T('cr.ayudaPoner'))}</p><button class="boton gris" data-cp="cerrar">${esc(T('cerrar'))}</button>`);
}
function creadorEditar(e) {
  const campo = ([k, tipo, a, b, s]) => {
    const v = e.prm[k], L = esc(T('ep.' + k));
    if (tipo === 'num') return `<label class="crCampo">${L}<input type="number" data-k="${k}" min="${a}" max="${b}" step="${s}" value="${+v}"></label>`;
    if (tipo === 'bool') return `<label class="crCampo crChk"><input type="checkbox" data-k="${k}"${v !== false ? ' checked' : ''}>${L}</label>`;
    if (tipo === 'txt') return `<label class="crCampo">${L}<input data-k="${k}" maxlength="120" value="${esc(v || '')}"></label>`;
    if (tipo === 'color') return `<label class="crCampo">${L}<input type="color" data-k="${k}" value="${/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#ffffff'}"></label>`;
    if (tipo === 'yt') return `<label class="crCampo">${L}<input data-k="${k}" maxlength="120" placeholder="https://youtu.be/…" value="${esc(v || '')}"></label>`;
    if (tipo === 'vec') return `<label class="crCampo">${L}<span class="crVec">${[0, 1, 2].map((i) => `<input type="number" data-k="${k}" data-i="${i}" min="${a}" max="${b}" step="${s}" value="${(v || [1, 1, 1])[i]}">`).join('')}</span></label>`;
    if (tipo === 'auto') return `<label class="crCampo">${L}<select data-k="${k}"><option value="">?</option>${listaAutos().map((n) => `<option${n === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    if (tipo === 'aqui') return `<div class="crCampo">${L}<span>${Array.isArray(v) ? v.map((x) => (+x).toFixed(1)).join(', ') : '—'}</span><button class="boton chico" data-cp="aqui:${k}">${glifo('punto')} ${esc(T('cr.aqui'))}</button></div>`;
    return '';
  };
  CREA.edit = e;
  creadorPanel(`<h3>${icoHTML('ico:' + ENT_INFO[e.t][0])} ${esc(T('ent.' + e.t))}</h3><div class="crForm">${(ENT_PRM[e.t] || []).map(campo).join('')}</div>
    <div class="crPie"><button class="boton gris chico" data-cp="cerrar">${esc(T('cerrar'))}</button><button class="boton chico" data-cp="aplicar">${glifo('si')} ${esc(T('cr.aplicar'))}</button></div>`);
}
function creadorRoles() {
  const m = CREA.mapa, armas = Object.keys(DEF_ARMAS || {}).filter((a) => !/^(Camera)$/.test(a));
  const fila = (r, i) => `<div class="crRol" data-i="${i}"><input type="color" data-rk="color" value="${r.color}"><input data-rk="nombre" maxlength="30" value="${esc(r.nombre)}">
      <select data-rk="skin"><option value="">-</option>${Object.keys(RETRATO).map((s) => `<option${s === r.skin ? ' selected' : ''}>${s}</option>`).join('')}</select>
      <label>${glifo('corazon')}<input type="number" data-rk="vida" min="1" max="100000" value="${r.vida}"></label><label>${glifo('rayo')}<input type="number" data-rk="velocidad" min="0" max="100" step="0.1" value="${r.velocidad}"></label><label>${glifo('salto')}<input type="number" data-rk="salto" min="0" max="100" step="0.1" value="${r.salto}"></label>
      <span class="crArmas">${armas.map((a) => `<button class="${r.armas.includes(a) ? 'sel' : ''}" data-cp="arma:${i}:${a}">${a}</button>`).join('')}</span>
      <button class="boton chico ${CREA.rol === r.id ? '' : 'gris'}" data-cp="usarRol:${i}">${glifo('punto')}</button><button class="boton chico gris" data-cp="quitarRol:${i}">${glifo('basura')}</button></div>`;
  creadorPanel(`<h3>${glifo('gente')} ${esc(T('cr.roles'))}</h3><p class="crAyuda">${esc(T('cr.ayudaRoles'))}</p><div class="crRoles">${m.roles.map(fila).join('') || `<div class="crAyuda">—</div>`}</div>
    <div class="crPie"><button class="boton chico" data-cp="nuevoRol">${glifo('mas')} ${esc(T('cr.nuevoRol'))}</button><button class="boton chico ${CREA.rol ? 'gris' : ''}" data-cp="sinRol">${glifo('punto')} ${esc(T('cr.sinRol'))}</button><button class="boton gris chico" data-cp="cerrarRoles">${esc(T('cerrar'))}</button></div>`);
}
function creadorRolesLeer() {
  const p = $('creaPan'), m = CREA.mapa; if (!p) return;
  p.querySelectorAll('.crRol').forEach((f) => { const r = m.roles[+f.dataset.i]; if (!r) return; f.querySelectorAll('[data-rk]').forEach((x) => { const k = x.dataset.rk; r[k] = x.type === 'number' ? +x.value : k === 'skin' ? x.value || null : x.value; }); });
}
function creadorDatosPanel() {
  const m = CREA.mapa;
  creadorPanel(`<h3>${glifo('ajustes')} ${esc(T('cr.datos'))}</h3><div class="crForm">
    <label class="crCampo">${esc(T('nombre'))}<input id="crNom" maxlength="40" value="${esc(m.nombre)}"></label>
    <label class="crCampo">${esc(T('desc'))}<textarea id="crDesc" maxlength="2000" rows="3">${esc(m.descripcion)}</textarea></label>
    <label class="crCampo">${esc(T('f.hora'))}<select id="crHora"><option value="">${esc(T('ninguna'))}</option>${[...Array(24)].map((_, h) => `<option value="${h}"${m.hora === h ? ' selected' : ''}>${h}:00</option>`).join('')}</select></label>
    <label class="crCampo">${esc(T('f.gravedad'))}<input id="crGrav" type="number" min="-50" max="100" step="0.05" value="${m.gravedad}"></label>
    <div class="crCampo">${esc(T('etiquetas'))}<span class="crEtqs">${ETIQUETAS_RB.map((e) => `<button class="${m.etiquetas.includes(e) ? 'sel' : ''}" data-cp="etq:${e}">${esc(T('e.' + e))}</button>`).join('')}</span></div>
    <div class="crCampo">${esc(T('cr.aparicion'))}<span>${m.aparicion ? m.aparicion.map((x) => (+x).toFixed(1)).join(', ') : '—'}</span><button class="boton chico" data-cp="aparicion">${glifo('punto')} ${esc(T('cr.aqui'))}</button></div>
    <p class="crAyuda">${glifo('punto')} ${m.spawns.length} · ${glifo('gente')} ${m.roles.length} · ${glifo('cosa')} ${ENTS.lista.filter((e) => e.dueno === 'yo' && !e.red).length} · ${glifo('caja')} ${OBJS.filter((o) => o.dueno === 'yo').length}</p></div>
    <div class="crPie"><button class="boton chico gris" data-cp="exportar">${glifo('bajar')} ${esc(T('exportar'))}</button><button class="boton chico gris" data-cp="salirCrea">${glifo('salir')} ${esc(T('cr.salir'))}</button><button class="boton chico" data-cp="datosOk">${glifo('si')} ${esc(T('cr.aplicar'))}</button></div>`);
}
function creadorDatosLeer() {
  const p = $('creaPan'), m = CREA.mapa; if (!p || !p.querySelector('#crNom')) return;
  m.nombre = p.querySelector('#crNom').value; m.descripcion = p.querySelector('#crDesc').value;
  const h = p.querySelector('#crHora').value; m.hora = h === '' ? null : +h; m.gravedad = +p.querySelector('#crGrav').value || 1;
}
function creadorPanelAccion(k, b) {
  const [a, v, w] = k.split(':'), m = CREA.mapa;
  if (a === 'cerrar') return creadorPanelCerrar();
  if (a === 'tipo') { CREA.tipo = v; CREA.sel = null; creadorPanelCerrar(); creadorBarraDibujar(); aviso(T('cr.ayudaPoner'), 3); return; }
  if (a === 'aplicar') {
    const e = CREA.edit; if (!e || !ENTS.lista.includes(e)) return creadorPanelCerrar();
    const d = entidadDatos(e);
    $('creaPan').querySelectorAll('[data-k]').forEach((x) => {
      const key = x.dataset.k;
      if (x.dataset.i !== undefined) { d.prm[key] = Array.isArray(d.prm[key]) ? d.prm[key] : [1, 1, 1]; d.prm[key][+x.dataset.i] = +x.value; }
      else if (x.type === 'checkbox') d.prm[key] = x.checked;
      else if (x.type === 'number') d.prm[key] = +x.value;
      else d.prm[key] = key === 'v' ? ytId(x.value) : x.value;
    });
    creadorRehacer(e, d); return creadorPanelCerrar();
  }
  if (a === 'aqui') {
    const e = CREA.edit; if (!e) return; const d = entidadDatos(e);
    d.prm[v] = [+JUG.pos.x.toFixed(2), +(JUG.pos.y - (e.t === 'boton_autos' ? 0.6 : 1)).toFixed(2), +JUG.pos.z.toFixed(2)]; if (e.t === 'boton_autos') d.prm.ya = +JUG.yaw.toFixed(3);
    const n = creadorRehacer(e, d); return creadorEditar(n);
  }
  if (a === 'nuevoRol') { creadorRolesLeer(); if (m.roles.length >= 32) return; const i = m.roles.length; m.roles.push({ id: 'rol' + Date.now().toString(36).slice(-4) + i, nombre: T('cr.rol') + ' ' + (i + 1), color: ROL_COLORES[i % ROL_COLORES.length], skin: null, armas: [], vida: 100, velocidad: 1, salto: 1 }); return creadorRoles(); }
  if (a === 'quitarRol') { creadorRolesLeer(); const r = m.roles.splice(+v, 1)[0]; if (r) { for (const s of m.spawns) if (s.rol === r.id) s.rol = null; if (CREA.rol === r.id) CREA.rol = ''; } creadorBarraDibujar(); return creadorRoles(); }
  if (a === 'usarRol') { creadorRolesLeer(); CREA.rol = (m.roles[+v] || {}).id || ''; creadorBarraDibujar(); return creadorRoles(); }
  if (a === 'sinRol') { creadorRolesLeer(); CREA.rol = ''; creadorBarraDibujar(); return creadorRoles(); }
  if (a === 'arma') { creadorRolesLeer(); const r = m.roles[+v]; if (!r) return; const i = r.armas.indexOf(w); if (i >= 0) r.armas.splice(i, 1); else r.armas.push(w); b.classList.toggle('sel'); return; }
  if (a === 'cerrarRoles') { creadorRolesLeer(); creadorBarraDibujar(); return creadorPanelCerrar(); }
  if (a === 'etq') { const i = m.etiquetas.indexOf(v); if (i >= 0) m.etiquetas.splice(i, 1); else if (m.etiquetas.length < 6) m.etiquetas.push(v); b.classList.toggle('sel', m.etiquetas.includes(v)); return; }
  if (a === 'aparicion') { creadorDatosLeer(); m.aparicion = [JUG.pos.x, JUG.pos.y, JUG.pos.z].map((x) => +x.toFixed(2)); return creadorDatosPanel(); }
  if (a === 'datosOk') { creadorDatosLeer(); return creadorPanelCerrar(); }
  if (a === 'exportar') { creadorDatosLeer(); const v2 = creadorGuardar(); if (v2) descargarArchivo(v2); return; }
  if (a === 'salirCrea') { creadorDatosLeer(); creadorGuardar(); creadorPanelCerrar(); irMenuPrincipal(); }
}
// arma el .rbmapa con lo que hay en el mundo y lo guarda en "Comunidad"
function creadorDatos() {
  const m = CREA.mapa;
  return Object.assign({}, m, { formato: 'rezobox-mapa', autor: PREFS.nombre, base: MUNDO.nombre,
    objetos: OBJS.filter((o) => o.dueno === 'yo').slice(0, 20000).map((o) => ({ n: o.nombre, p: [o.b.pos.x, o.b.pos.y, o.b.pos.z].map((x) => +x.toFixed(3)), q: [o.b.q.x, o.b.q.y, o.b.q.z, o.b.q.w].map((x) => +x.toFixed(4)), f: o.b.frozen ? 1 : 0 })),
    entidades: ENTS.lista.filter((e) => e.dueno === 'yo' && !e.red).map(entidadDatos) });
}
function creadorGuardar() {
  const d = creadorDatos(); if (!d.nombre || d.nombre.trim().length < 3) d.nombre = (T('cr.miMapa') + ' ' + new Date().toLocaleDateString()).slice(0, 40);
  const v = validarRB(d); if (typeof v === 'string') { aviso(v, 3); return null; }
  const id = CREA.mapa.id || 'crea-' + Math.random().toString(36).slice(2, 10);
  v.id = id; v.creado = true; v.foto = CREA.mapa.foto || null; CREA.mapa.id = id; CREA.mapa.nombre = v.nombre;
  INST.mapas[id] = v; guardarLS('rb_instalados', INST);
  // una foto chica del lugar para la tarjeta
  JUEGO.fotoCb = () => { try { const c = document.createElement('canvas'); c.width = 320; c.height = 180; c.getContext('2d').drawImage(R.cv, 0, 0, 320, 180); const f = c.toDataURL('image/jpeg', 0.6); if (f.length < 120000) { CREA.mapa.foto = f; if (INST.mapas[id]) { INST.mapas[id].foto = f; guardarLS('rb_instalados', INST); } } } catch (x) {} };
  JUEGO.foto = 2;
  return v;
}
async function creadorPublicar() {
  const v = creadorGuardar(); if (!v) return;
  if (!confirm(T('publicar') + ': ' + v.nombre + '?')) return;
  try {
    const env = Object.assign({}, v); delete env.id; delete env.creado;
    const r = await (await fetch(TIENDA_URL + 'publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(env) })).json();
    if (!r.id) { aviso(r.error || T('errRed'), 3); return; }
    PUBLICADOS[r.id] = r.clave; guardarLS('rb_publicados', PUBLICADOS);
    aviso(`${T('publicado')} ${T('clave')} ${r.clave}`, 8);
  } catch (e) { aviso(T('errRed'), 3); }
}
// ---------------- roles al jugar un mapa ----------------
const ROL = { el: null, mapa: null, rol: null };
function rolesPreparar(mc) {
  ROL.mapa = mc; ROL.rol = null;
  const sp = (mc.spawns || []).map((s) => Object.assign(v3(s.p[0], s.p[1] + 1.05, s.p[2]), { yaw: s.yaw || 0, rol: s.rol }));
  ROL.spawns = sp;
  if (mc.roles && mc.roles.length) setTimeout(() => rolElegirPanel(), 300);
  else if (sp.length) { MUNDO.spawns = sp; jugadorAparecer(); }
}
function rolElegirPanel() {
  const mc = ROL.mapa; if (!mc || JUEGO.estado !== 'juego') return;
  let p = $('rolPan'); if (!p) { p = document.createElement('div'); p.id = 'rolPan'; p.className = 'panel oc'; document.body.appendChild(p); p.addEventListener('click', (e) => { const b = e.target.closest('[data-rol]'); if (b) rolElegir(+b.dataset.rol); }); }
  cerrarPaneles(); p.innerHTML = `<div class="caja rolCaja"><h3>${glifo('gente')} ${esc(T('cr.elegirRol'))}</h3>${mc.roles.map((r, i) => `<button class="rolIt" data-rol="${i}"><i style="background:${r.color}"></i><b dir="auto">${esc(r.nombre)}</b><small>${glifo('corazon')} ${r.vida} · ${glifo('rayo')} ${r.velocidad}× · ${glifo('salto')} ${r.salto}×${r.armas.length ? ' · ' + glifo('mira') + ' ' + r.armas.length : ''}</small></button>`).join('')}</div>`;
  p.classList.remove('oc'); UI.abierto = 'rol'; soltarPuntero();
}
function rolElegir(i) {
  const r = ROL.mapa.roles[i]; if (!r) return; ROL.rol = r;
  const p = $('rolPan'); if (p) p.classList.add('oc'); if (UI.abierto === 'rol') UI.abierto = null;
  const sp = ROL.spawns.filter((s) => s.rol === r.id), libres = ROL.spawns.filter((s) => !s.rol);
  if (sp.length || libres.length) MUNDO.spawns = sp.length ? sp : libres;
  JUG.vidaMax = r.vida; JUG.vel_max = (RB.base ? RB.base.v : 6) * (MODS.velocidad || 1) * r.velocidad; JUG.salto = (RB.base ? RB.base.s : 1.1) * (MODS.salto || 1) * r.salto;
  JUG.colorRol = r.color;
  if (r.armas.length) { ARM.lista = r.armas.filter((a) => DEF_ARMAS[a]); if (!ARM.lista.length) ARM.lista = ['Hands']; ARM.balas = {}; elegirArma(0); }
  JUG.skinRol = r.skin && RETRATO[r.skin] ? r.skin : null;
  jugadorAparecer(); jugadorCuerpoNuevo();
  aviso(r.nombre, 2);
}
function rolCerrar() { ROL.mapa = null; ROL.rol = null; const p = $('rolPan'); if (p) p.classList.add('oc'); if (UI.abierto === 'rol') UI.abierto = null; }
