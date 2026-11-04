// ---------------- social: perfil con ID, buscar jugador, amigos, chats y grupos, invitar a partida ----------------
// Con los diseños de la comunidad (GOLDEN): un panel con cuatro pestañas (Chats, Amigos, Buscar, Perfil) en el menú
// principal y en la pausa. Todo pasa por la tienda (tienda/social.js) con la sesión de Google. Cada 30 s el juego "late"
// (en línea, y en qué server está) y se entera de lo nuevo: el globito del menú y un aviso jugando cuando llega un
// mensaje. Con un chat abierto se pregunta cada 2,5 s. Lo que se escribe pasa por la censura local antes de salir y lo
// que llega se muestra censurado.
const SOC = { tab: 'chats', sub: 'amigos', yo: null, amigos: null, chats: null, chat: null, info: null, msgs: [], ultId: 0, lei: 0, esc: [], sel: null, busc: null, badge: 0, sol: 0, ultAviso: 0, q: '' };
const socApi = async (ruta, o) => { const r = await cuApi('social/' + ruta, o); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.status), { st: r.status }); return j; };
const socRec = () => { try { return JSON.parse(localStorage.getItem('jx_soc_rec') || '[]').slice(0, 6); } catch (e) { return []; } };
const socT = (f) => { if (!f) return ''; const d = new Date(f), h = new Date(); if (d.toDateString() === h.toDateString()) return d.toLocaleTimeString(PREFS.lang || undefined, { hour: '2-digit', minute: '2-digit' }); if (h - d < 2 * 864e5) return T('so.ayer'); return d.toLocaleDateString(PREFS.lang || undefined, { weekday: 'short' }); };
const socHace = (f) => { if (!f) return ''; const s = (Date.now() - f) / 1000; return T('so.hace').replace('{t}', s < 3600 ? Math.max(1, Math.round(s / 60)) + ' min' : s < 86400 ? Math.round(s / 3600) + ' h' : Math.round(s / 86400) + ' d'); };
const socEstado = (p) => (p.online ? (p.sala ? T('so.jugando') + ' · ' + mapaNomSeguro(p.sala.m) : T('so.enLinea')) : socHace(p.visto) || T('so.desc'));
const mapaNomSeguro = (m) => { try { return typeof mapaNom === 'function' ? mapaNom(m) : m; } catch (e) { return m; } };
const socAvatar = (skin, on, grande) => `<span class="soAv${grande ? ' g' : ''}"><img src="${retrato(skin || 'Hero')}" alt="">${on !== undefined ? `<i class="${on ? 'on' : ''}"></i>` : ''}</span>`;
const socTexto = (t) => esc(typeof censurar === 'function' ? censurar(String(t || '')) : String(t || ''));
const socResumen = (u) => (u.tipo === 'inv' ? T('so.invPartida') : u.tipo === 'sis' && u.k ? T('so.sis_' + u.k).replace('{n}', u.texto || '?') : typeof censurar === 'function' ? censurar(String(u.texto || '')) : String(u.texto || ''));
const socSala = () => (typeof SALA !== 'undefined' && SALA && typeof RED !== 'undefined' && RED.on ? { id: SALA.id, n: SALA.n, m: SALA.m, mods: (typeof GMS !== 'undefined' && GMS.activos ? GMS.activos.length : 0) } : null);

// ---- el latido: cada 30 s con sesión ----
function socIniciar() {
  if (SOC.iniciado) return; SOC.iniciado = true;
  const latir = async () => {
    if (!cuDentro() || !cuRequerida()) return;
    try {
      if (!SOC.yo) { try { const y = await socApi('yo'); SOC.yo = y.perfil; SOC.estado = y.estado; } catch (e) {} }
      const j = await socApi('latido', { method: 'POST', body: { sala: socSala(), skin: PREFS.skin } });
      SOC.badge = (j.noLeidos || 0) + (j.solicitudes || 0); SOC.sol = j.solicitudes || 0; socGlobito();
      const u = j.ultimo; if (u && u.id > SOC.ultAviso) { const viendo = SOC.chat === u.chat && RB.panel === 'social' && rbVisible && rbVisible(); if (SOC.ultAviso && !viendo) cuAviso((u.tipo === 'sis' ? '' : (u.nombre || '?') + ': ') + socResumen(u).slice(0, 80)); SOC.ultAviso = u.id; }
    } catch (e) {}
  };
  SOC.latir = latir; setTimeout(latir, 4000); setInterval(latir, 30000);
}
function socGlobito() {
  const b = typeof RB !== 'undefined' && RB.el && RB.el.querySelector('.rbIt[data-rb=social]'); if (!b) return;
  let e = b.querySelector('.soBadge'); if (!SOC.badge) { if (e) e.remove(); return; }
  if (!e) { e = document.createElement('em'); e.className = 'soBadge'; b.appendChild(e); } e.textContent = SOC.badge > 99 ? '99+' : SOC.badge;
}

// ---- el panel ----
function panelSocial(P) {
  clearInterval(SOC.tPoll); SOC.tPoll = 0;
  const tabs = [['chats', 'so.chats', 'chat'], ['amigos', 'so.amigos', 'gente'], ['buscar', 'so.buscarT', 'buscar'], ['perfil', 'so.perfil', 'persona']];
  const cab = `<div class="rbPanCab">${glifo('gente')} ${esc(T('m.social'))}<span class="rbTabs">${tabs.map(([k, t, g]) => `<button class="rbTab${SOC.tab === k ? ' sel' : ''}" data-rb="soc:tab|${k}">${glifo(g)} ${esc(T(t))}${k === 'amigos' && SOC.sol ? ` <em class="soBadge">${SOC.sol}</em>` : ''}</button>`).join('')}</span></div>`;
  const pie = `<div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbEsp"></span><small class="soPie"></small></div>`;
  if (!cuRequerida()) { P.innerHTML = cab + `<div class="cuPanel"><p>${esc(T('so.noConfig'))}</p></div>` + pie; return; }
  if (!cuDentro()) { P.innerHTML = cab + `<div class="cuPanel"><p>${esc(T('so.paraSocial'))}</p><button class="cuGoogle" data-rb="soc:entrar">${CU_G}<span>${esc(T('cu.entrar'))}</span></button></div>` + pie; return; }
  socIniciar();
  P.innerHTML = cab + `<div class="soCuerpo"><div class="soIzq"></div><div class="soDer"></div></div>` + pie;
  P.querySelector('.soCuerpo').addEventListener('keydown', (e) => e.stopPropagation());
  socDibujar(true);
}
const socP = () => (typeof RB !== 'undefined' && RB.panel === 'social' && RB.el ? RB.el.querySelector('.rbPan') : null);
async function socDibujar(cargar) {
  const P = socP(); if (!P) return; const I = P.querySelector('.soIzq'), D = P.querySelector('.soDer'); if (!I) return;
  // (si mientras llegaba la respuesta se cerró el panel o se cambió de pestaña, no se dibuja nada: antes el perfil, que
  // llegaba tarde con internet lento, dejaba el personaje en 3D y el fondo crema encima del menú principal)
  const tab = SOC.tab, sigue = () => I.isConnected && socP() === P && SOC.tab === tab;
  try {
    if (tab === 'perfil') { if (cargar || !SOC.yo) { const j = await socApi('yo'); SOC.yo = j.perfil; SOC.estado = j.estado; } if (sigue()) socPerfil(I, D); }
    else if (tab === 'buscar') socBuscar(I, D);
    else if (tab === 'amigos') { if (cargar || !SOC.amigos) SOC.amigos = await socApi('amigos'); if (sigue()) socAmigos(I, D); }
    else { if (cargar || !SOC.chats) SOC.chats = (await socApi('chats')).chats; if (!sigue()) return; socChats(I, D); if (SOC.chat) await socChatCargar(true); if (sigue()) SOC.tPoll = SOC.tPoll || setInterval(socPoll, 2500); }
  } catch (e) { if (!sigue()) return; if (e.st === 401) { cuSesionVencida(); inicioPanel('social'); return; } I.innerHTML = `<p class="soVacio">${esc(T('so.error'))}</p>`; }
}
async function socPoll() {
  if (!socP() || SOC.tab !== 'chats') { clearInterval(SOC.tPoll); SOC.tPoll = 0; return; }
  SOC.pollN = (SOC.pollN || 0) + 1;
  try { if (SOC.chat) await socChatCargar(false); if (SOC.pollN % 3 === 0) { SOC.chats = (await socApi('chats')).chats; const I = socP() && socP().querySelector('.soIzq'); if (I) socListaChats(I); } } catch (e) {}
}
// -- perfil --
function socPerfil(I, D) {
  const y = SOC.yo || {};
  I.innerHTML = `<div class="soCard soYo">${socAvatar(PREFS.skin, y.online !== false, true)}<div><div class="soNom"><input class="soNomIn" maxlength="24" value="${esc(y.nombre || PREFS.nombre)}" spellcheck="false"> ${glifo('lapiz')}</div>
      <div class="soEst ${SOC.estado === 'off' ? '' : 'on'}">${esc(SOC.estado === 'off' ? T('so.desc') : T('so.enLinea'))}</div><div class="soId">ID: <b>${esc(y.pid || '…')}</b> <button class="rbBtnGris rbChico" data-rb="soc:copiar|${esc(y.pid || '')}">${glifo('copiar')} ${esc(T('so.copiar'))}</button></div></div></div>
    <div class="soCard"><div class="soSub">${esc(T('so.buscarId'))}</div><div class="soFila"><input class="soBusIn" inputmode="numeric" maxlength="8" placeholder="${esc(T('so.escribeId'))}"><button class="rbBtnG" data-rb="soc:buscarDesde">${esc(T('so.buscarBtn'))}</button></div></div>
    <div class="soCard"><div class="soSub">${esc(T('so.estado'))}</div><span class="rbSeg"><button class="${SOC.estado !== 'off' ? 'sel' : ''}" data-rb="soc:estado|on">● ${esc(T('so.enLinea'))}</button><button class="${SOC.estado === 'off' ? 'sel' : ''}" data-rb="soc:estado|off">● ${esc(T('so.desc'))}</button></span></div>`;
  D.innerHTML = `<div class="soVista"><span class="soTag">${esc(T('so.vistaPrevia'))}</span><div class="soVista3d"></div><button class="soBtnB" data-rb="soc:fondo">${glifo('mundo')} ${esc(T('so.cambiarFondo'))}</button></div>`;
  // (el personaje en 3D del menú, detrás del lado derecho)
  RB.el.classList.add('rb3d'); I.closest('.rbPan').classList.add('soP3d'); if (typeof menuLobby === 'function') menuLobby(true);
  const n = I.querySelector('.soNomIn'); n.addEventListener('change', () => { const v = limpioNombre(n.value); n.value = v; if (typeof nombrePoner === 'function') nombrePoner(v); socApi('perfil', { method: 'POST', body: { nombre: v } }).then((j) => { SOC.yo = j.perfil; }).catch(() => {}); });
  const b = I.querySelector('.soBusIn'); b.addEventListener('keydown', (e) => { if (e.key === 'Enter') socAccion('buscarDesde'); });
}
function socEstadoPintar() {
  const P = socP(); if (!P) return; const on = SOC.estado !== 'off';
  P.querySelectorAll('[data-rb^="soc:estado|"]').forEach((x) => x.classList.toggle('sel', (x.dataset.rb === 'soc:estado|on') === on));
  const e = P.querySelector('.soYo .soEst'); if (e) { e.classList.toggle('on', on); e.textContent = on ? T('so.enLinea') : T('so.desc'); }
  const pu = P.querySelector('.soYo .soAv i'); if (pu) pu.classList.toggle('on', on); if (SOC.yo) SOC.yo.online = on;
}
// -- la gente de tu sala: agregarlos de amigo sin escribir su ID (viene por la red) --
SOC.sala = {};   // pid → { rel, t } (lo que se sabe de cada uno; se pregunta a la tienda una vez por minuto)
function socSalaGente() { return typeof RED === 'undefined' ? [] : [...RED.remotos.values()].filter((R2) => R2.sp && (!SOC.yo || R2.sp !== SOC.yo.pid)); }
function socSalaRel(pid) {
  const x = SOC.sala[pid]; if (x && performance.now() - x.t < 60e3) return x.rel;
  if (!x || !x.pidiendo) { SOC.sala[pid] = Object.assign(x || { rel: null }, { pidiendo: true, t: x ? x.t : 0 });
    socApi('buscar?pid=' + pid).then((j) => { SOC.sala[pid] = { rel: j.rel, t: performance.now() }; socSalaRepintar(); }, () => { SOC.sala[pid] = { rel: { nada: true }, t: performance.now() }; }); }
  return x ? x.rel : null;
}
function socSalaRepintar() { if (typeof celDibujar === 'function' && typeof CEL !== 'undefined' && CEL.app === 'gente') celDibujar(); if (socP() && SOC.tab === 'amigos') socDibujar(false); }
// (el botón para la fila de alguien: Agregar / Solicitud enviada / Amigo / Aceptar)
function socAmigoSala(pid, enMenu) {
  if (typeof cuDentro !== 'function' || !cuDentro()) return '';
  const r = socSalaRel(pid), at = enMenu ? 'data-rb="soc:sala|' : 'data-cel="amigo|';
  if (!r) return '';
  if (r.amigos) return `<span class="soOk">${esc(T('so.amigo'))}</span>`;
  if (r.pedi) return `<span class="soOk">${esc(T('so.pedido'))}</span>`;
  if (r.bloquee || r.meBloqueo || r.nada) return '';
  return `<button ${enMenu ? 'class="rbBtnG rbChico" ' : 'class="celAmigo" '}${at}${pid}">${glifo('mas')} ${esc(T(r.mePidio ? 'so.aceptar' : 'so.agregar'))}</button>`;
}
async function socPedirSala(pid) {
  const r = (SOC.sala[pid] || {}).rel || {};
  try { const j = await socApi('amigo', { method: 'POST', body: { pid, accion: r.mePidio ? 'aceptar' : 'pedir' } }); SOC.sala[pid] = { rel: j.rel || { pedi: true }, t: performance.now() }; SOC.amigos = null; cuAviso(T(j.rel && j.rel.amigos ? 'so.amigo' : 'so.pedido')); }
  catch (e) { cuAviso(T('so.error')); }
  socSalaRepintar();
}
// -- buscar --
function socBuscar(I, D) {
  const r = SOC.busc, rec = socRec();
  I.innerHTML = `<div class="soFila"><input class="soBusIn" inputmode="numeric" maxlength="8" placeholder="${esc(T('so.escribeId'))}" value="${esc(SOC.q)}"><button class="rbBtnG" data-rb="soc:buscar">${esc(T('so.buscarBtn'))}</button></div>
    ${r === 0 ? `<p class="soVacio">${esc(T('so.noExiste'))}</p>` : r ? `<div class="soSub">${esc(T('so.resultado'))}</div><div class="soCard soRes">${socAvatar(r.perfil.skin, r.perfil.online, true)}<div class="soResI"><b>${esc(r.perfil.nombre)}</b><small class="${r.perfil.online ? 'on' : ''}">${esc(socEstado(r.perfil))}</small><small>ID: ${esc(r.perfil.pid)}</small></div>
      <div class="soResB">${r.rel.amigos ? `<span class="soOk">${esc(T('so.amigo'))}</span>` : r.rel.pedi ? `<span class="soOk">${esc(T('so.pedido'))}</span>` : r.rel.mePidio ? `<button class="rbBtnG" data-rb="soc:amigo|aceptar|${r.perfil.pid}">${esc(T('so.aceptar'))}</button>` : r.rel.bloquee ? `<button class="rbBtnGris" data-rb="soc:amigo|desbloquear|${r.perfil.pid}">${esc(T('so.desbloquear'))}</button>` : `<button class="rbBtnG" data-rb="soc:amigo|pedir|${r.perfil.pid}">${glifo('mas')} ${esc(T('so.agregar'))}</button>`}
      <button class="rbBtnGris" data-rb="soc:ver|${r.perfil.pid}">${esc(T('so.verPerfil'))}</button></div></div>` : ''}
    ${rec.length ? `<div class="soSub">${esc(T('so.recientes'))}</div><div class="soLista">${rec.map((x) => `<div class="soIt" data-rb="soc:buscarId|${esc(x.pid)}">${socAvatar(x.skin)}<span><b>${esc(x.nombre)}</b><small>ID: ${esc(x.pid)}</small></span><button class="soX" data-rb="soc:recBorrar|${esc(x.pid)}">✕</button></div>`).join('')}</div>` : ''}`;
  socTarjeta(D, r ? r.perfil : null, r && r.rel);
  const b = I.querySelector('.soBusIn'); b.addEventListener('input', () => { SOC.q = b.value.replace(/\D/g, '').slice(0, 8); b.value = SOC.q; }); b.addEventListener('keydown', (e) => { if (e.key === 'Enter') socAccion('buscar'); });
}
// (la tarjeta de la derecha: el perfil de alguien, con lo que se puede hacer)
function socTarjeta(D, p, rel) {
  if (!p) { D.innerHTML = `<div class="soVista soVacia"><span class="soTag">${esc(T('so.vistaPrevia'))}</span></div>`; return; }
  const am = rel ? rel.amigos : true;
  D.innerHTML = `<div class="soVista ${am ? '' : 'violeta'}"><span class="soTag">${esc(am ? T('so.amigo') : T('so.vistaPrevia'))}</span>${socAvatar(p.skin, undefined, true)}<h3>${esc(p.nombre)}</h3><span class="soEstB ${p.online ? 'on' : ''}">${esc(p.online ? T('so.enLinea') : T('so.desc'))}</span><small>${esc(p.online && p.sala ? socEstado(p) : (!p.online && p.visto ? socHace(p.visto) + ' · ' : '') + 'ID: ' + p.pid)}</small>
    ${am ? `<div class="soAcc"><button class="soBtnB" data-rb="soc:invitar|${p.pid}">${glifo('mas')} ${esc(T('so.invitarPartida'))}</button><button class="soBtnB" data-rb="soc:dm|${p.pid}">${glifo('chat')} ${esc(T('so.mensaje'))}</button>
      <span class="soAcc2"><button class="rbBtnGris rbChico" data-rb="soc:amigo|borrar|${p.pid}">${esc(T('so.eliminar'))}</button><button class="rbBtnGris rbChico" data-rb="soc:amigo|bloquear|${p.pid}">${esc(T('so.bloquear'))}</button></span></div>` : ''}</div>`;
}
// -- amigos --
function socAmigos(I, D) {
  const A = SOC.amigos || { amigos: [], recibidas: [], enviadas: [], bloqueados: [] }, q = (SOC.qa || '').toLowerCase(), f = (L) => L.filter((x) => !q || x.nombre.toLowerCase().includes(q));
  const subs = [['amigos', 'so.amigos', A.amigos.length], ['sol', 'so.solicitudes', A.recibidas.length], ['bloq', 'so.bloqueados', A.bloqueados.length]];
  const fila = (p, der) => `<div class="soIt${SOC.sel === p.pid ? ' sel' : ''}" data-rb="soc:sel|${p.pid}">${socAvatar(p.skin, p.online)}<span><b>${esc(p.nombre)}</b><small class="${p.online ? 'on' : ''}">${esc(socEstado(p))}</small></span>${der}</div>`;
  let h = `<span class="rbSeg soSubs">${subs.map(([k, t, n]) => `<button class="${SOC.sub === k ? 'sel' : ''}" data-rb="soc:sub|${k}">${esc(T(t))} ${n}</button>`).join('')}</span><input class="soBusIn soQa" type="search" placeholder="${esc(T('so.buscarAmigo'))}" value="${esc(SOC.qa || '')}">`;
  if (SOC.sub === 'amigos') {
    const G = socSalaGente();
    if (G.length) h += `<div class="soSec on">${esc(T('so.enSala'))} · ${G.length}</div>` + G.map((R2) => `<div class="soIt">${socAvatar(R2.skinReal || R2.skin, true)}<span><b dir="auto">${esc(R2.nombre || '?')}</b><small>ID: ${esc(R2.sp)}</small></span>${socAmigoSala(R2.sp, true)}</div>`).join('');
    const on = f(A.amigos.filter((x) => x.online)), off = f(A.amigos.filter((x) => !x.online)), inv = (p) => `<button class="rbBtnG rbChico" data-rb="soc:invitar|${p.pid}">${esc(T('so.invitar'))}</button>`;
    h += !A.amigos.length ? `<p class="soVacio">${esc(T('so.sinAmigos'))}</p>` : `<div class="soSec on">${esc(T('so.enLinea'))} · ${on.length}</div>${on.map((p) => fila(p, inv(p))).join('')}<div class="soSec">${esc(T('so.desc'))} · ${off.length}</div>${off.map((p) => fila(p, `<span class="soReloj">${glifo('reloj')}</span>`)).join('')}`;
  } else if (SOC.sub === 'sol') {
    h += [...f(A.recibidas).map((p) => fila(p, `<button class="rbBtnG rbChico" data-rb="soc:amigo|aceptar|${p.pid}">${esc(T('so.aceptar'))}</button><button class="rbBtnGris rbChico" data-rb="soc:amigo|rechazar|${p.pid}">✕</button>`)),
      ...f(A.enviadas).map((p) => fila(p, `<small>${esc(T('so.pedido'))}</small><button class="rbBtnGris rbChico" data-rb="soc:amigo|rechazar|${p.pid}">✕</button>`))].join('') || `<p class="soVacio">—</p>`;
  } else h += f(A.bloqueados).map((p) => fila(p, `<button class="rbBtnGris rbChico" data-rb="soc:amigo|desbloquear|${p.pid}">${esc(T('so.desbloquear'))}</button>`)).join('') || `<p class="soVacio">—</p>`;
  I.innerHTML = h;
  const qa = I.querySelector('.soQa'); qa.addEventListener('input', () => { SOC.qa = qa.value; const pos = qa.selectionStart; socAmigos(I, D); const n = I.querySelector('.soQa'); n.focus(); n.setSelectionRange(pos, pos); });
  const p = A.amigos.find((x) => x.pid === SOC.sel) || A.amigos[0]; socTarjeta(D, p || null, p ? { amigos: true } : null);
}
// -- chats --
function socListaChats(I) {
  const L = (SOC.chats || []).filter((c) => !SOC.qc || c.nombre.toLowerCase().includes(SOC.qc.toLowerCase())), l = I.querySelector('.soLista');
  const h = L.map((c) => `<div class="soIt soChatIt${SOC.chat === c.id ? ' sel' : ''}" data-rb="soc:abrir|${c.id}">${c.tipo === 'dm' && c.otro ? socAvatar(c.otro.skin, c.otro.online) : `<span class="soAv soGrupo">${glifo('gente')}</span>`}<span><b>${esc(c.nombre)}</b><small>${c.ultimo ? (c.ultimo.tipo === 'inv' || c.ultimo.tipo === 'sis' ? '' : c.tipo === 'grupo' && c.ultimo.de ? esc(c.ultimo.de) + ': ' : '') + esc(socResumen(c.ultimo)) : ''}</small></span><span class="soHora">${esc(c.ultimo ? socT(c.ultimo.fecha) : '')}${c.noLeidos ? `<em class="soBadge">${c.noLeidos}</em>` : ''}</span></div>`).join('') || `<p class="soVacio">${esc(T('so.sinChats'))}</p>`;
  if (l) l.innerHTML = h; return h;
}
function socChats(I, D) {
  I.innerHTML = `<div class="soFila"><input class="soBusIn soQc" type="search" placeholder="${esc(T('so.buscarChat'))}" value="${esc(SOC.qc || '')}"><button class="rbBtnGris rbChico" data-rb="soc:grupoNuevo" title="${esc(T('so.grupoNuevo'))}">${glifo('mas')} ${glifo('gente')}</button></div><div class="soLista"></div>`;
  socListaChats(I);
  const qc = I.querySelector('.soQc'); qc.addEventListener('input', () => { SOC.qc = qc.value; socListaChats(I); });
  socConversacion(D);
}
function socConversacion(D) {
  const c = SOC.chat && (SOC.chats || []).find((x) => x.id === SOC.chat);
  if (!c) { D.innerHTML = `<div class="soVista soVacia"><span class="soTag">${esc(T('so.chats'))}</span><p>${esc(T('so.elegiChat'))}</p></div>`; return; }
  const sub = c.tipo === 'dm' ? (c.otro && c.otro.online ? T('so.enLinea') : socHace(c.otro && c.otro.visto)) : T('so.miembrosN').replace('{n}', c.miembros).replace('{e}', c.enLinea || 0);
  D.innerHTML = `<div class="soConv"><div class="soConvCab">${c.tipo === 'dm' && c.otro ? socAvatar(c.otro.skin, c.otro.online) : `<span class="soAv soGrupo">${glifo('gente')}</span>`}<span><b>${esc(c.nombre)}</b><small class="${c.tipo === 'dm' && c.otro && c.otro.online ? 'on' : ''}">${esc(sub)}</small></span><span class="rbEsp"></span>
      ${c.tipo === 'grupo' ? `<button class="rbBtnGris rbChico" data-rb="soc:miembros">${glifo('gente')} ${esc(T('so.miembros'))}</button>` : ''}<button class="rbBtnG rbChico" data-rb="soc:${c.tipo === 'grupo' ? 'agregarGrupo' : 'invitarChat'}">${glifo('mas')} ${esc(T('so.invitar'))}</button></div>
    <div class="soMsgs"></div><div class="soEsc"></div>
    <div class="soEnviar"><button class="rbBtnGris rbChico" data-rb="soc:invitarChat" title="${esc(T('so.invitarPartida'))}">${glifo('mas')}</button><input class="soMsgIn" maxlength="500" placeholder="${esc(T('so.escribir'))}" dir="auto"><button class="rbBtnG rbChico" data-rb="soc:enviar">${glifo('enviar')}</button></div></div>`;
  const inp = D.querySelector('.soMsgIn'); let tEsc = 0;
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') socAccion('enviar'); });
  inp.addEventListener('input', () => { const t = Date.now(); if (t - tEsc > 3000) { tEsc = t; socApi('chat/' + SOC.chat + '/escribe', { method: 'POST' }).catch(() => {}); } });
  socMsgsDibujar();
}
async function socChatCargar(nuevo) {
  const id = SOC.chat; if (!id) return; if (nuevo) { SOC.msgs = []; SOC.ultId = 0; }
  const j = await socApi('chat/' + id + '?desde=' + SOC.ultId); if (SOC.chat !== id) return;
  if (j.mensajes.length) {
    SOC.msgs = SOC.msgs.concat(j.mensajes).slice(-200); const u = SOC.msgs[SOC.msgs.length - 1]; SOC.ultId = u.id;
    // (la lista de la izquierda muestra al toque el último mensaje de este chat)
    const c = (SOC.chats || []).find((x) => x.id === id), I = socP() && socP().querySelector('.soIzq');
    if (c && (!c.ultimo || c.ultimo.fecha <= u.fecha)) { c.ultimo = { texto: u.tipo === 'inv' ? '' : u.texto, tipo: u.tipo, k: u.datos && u.datos.k, de: u.de && u.de.nombre, fecha: u.fecha }; c.noLeidos = 0; if (I) socListaChats(I); }
  }
  const cambio = j.mensajes.length || nuevo || SOC.lei !== j.leidoHasta || String(SOC.esc) !== String(j.escribiendo);
  SOC.lei = j.leidoHasta; SOC.esc = j.escribiendo || []; SOC.info = j.chat;
  const c = (SOC.chats || []).find((x) => x.id === id); if (c && c.noLeidos) { c.noLeidos = 0; const I = socP() && socP().querySelector('.soIzq'); if (I) socListaChats(I); }
  if (cambio) socMsgsDibujar();
}
function socMsgsDibujar() {
  const P = socP(), M = P && P.querySelector('.soMsgs'); if (!M) return;
  const abajo = M.scrollHeight - M.scrollTop - M.clientHeight < 40, grupo = SOC.info && SOC.info.tipo === 'grupo';
  let dia = '';
  M.innerHTML = SOC.msgs.map((m) => {
    const d = new Date(m.fecha).toDateString(), sep = d !== dia ? (dia = d, `<div class="soDia">${esc(d === new Date().toDateString() ? T('so.hoy') : new Date(m.fecha).toLocaleDateString(PREFS.lang || undefined))}</div>`) : '';
    if (m.tipo === 'sis') return sep + `<div class="soSis">${m.datos && m.datos.k ? esc(T('so.sis_' + m.datos.k).replace('{n}', m.texto || '?')) : socTexto(m.texto)}</div>`;
    const hora = `<small>${esc(socT(m.fecha))}${m.mio ? ` <i class="${m.id <= SOC.lei ? 'leido' : ''}">✓✓</i>` : ''}</small>`;
    const cuerpo = m.tipo === 'inv' && m.datos ? `<div class="soInv"><b>${esc(T('so.invPartida'))}</b><small>${esc(mapaNomSeguro(m.datos.m))}${m.datos.mods ? ' · ' + m.datos.mods + ' mods' : ''} · ${esc(m.datos.n)}</small>${m.mio ? '' : `<button class="rbBtnG rbChico" data-rb="soc:unirse|${m.id}">${esc(T('so.entrar'))}</button>`}</div>` : socTexto(m.texto);
    return sep + `<div class="soMsg${m.mio ? ' mio' : ''}">${!m.mio ? socAvatar(m.de.skin) : ''}<div class="soBur">${grupo && !m.mio ? `<b class="soDe" style="color:hsl(${[...(m.de.pid || '')].reduce((a, c) => a + c.charCodeAt(0) * 37, 0) % 360},55%,40%)">${esc(m.de.nombre)}</b>` : ''}${cuerpo}${hora}</div></div>`;
  }).join('');
  const E = P.querySelector('.soEsc'); if (E) E.textContent = SOC.esc.length ? T('so.escribiendo').replace('{n}', SOC.esc.join(', ')) : '';
  if (abajo || !SOC.vistoAbajo) { M.scrollTop = M.scrollHeight; SOC.vistoAbajo = true; }
}
// ---- las acciones (data-rb="soc:acción|valor|…") ----
async function socAccion(v) {
  const [a, b, c] = String(v || '').split('|'), P = socP();
  try {
    switch (a) {
      case 'entrar': return cuentaEntrar(() => inicioPanel('social'));
      case 'tab': SOC.tab = b; if (b !== 'perfil') RB.el.classList.remove('rb3d'); return inicioPanel('social');
      case 'sub': SOC.sub = b; return socDibujar(false);
      case 'sel': SOC.sel = b; return socDibujar(false);
      case 'copiar': try { await navigator.clipboard.writeText(b); } catch (e) {} return cuAviso(T('so.copiado') + ': ' + b);
      case 'estado': {   // (al toque en pantalla; el aviso a la tienda va atrás y, si falla, vuelve como estaba)
        const antes = SOC.estado; if (antes === b) return; SOC.estado = b; socEstadoPintar();
        socApi('perfil', { method: 'POST', body: { estado: b } }).catch(() => { SOC.estado = antes; socEstadoPintar(); cuAviso(T('so.error')); });
        return;
      }
      case 'fondo': { const L = [[0.945, 0.925, 0.875], [0.62, 0.78, 0.92], [0.78, 0.7, 0.92], [0.18, 0.2, 0.25], [0.8, 0.9, 0.78]]; PREFS.fondoPj = ((PREFS.fondoPj || 0) + 1) % L.length; LOBBY_LUZ.fondo = L[PREFS.fondoPj]; guardarPrefs(); return; }
      case 'buscarDesde': { const i = P && P.querySelector('.soBusIn'); SOC.q = i ? i.value.replace(/\D/g, '') : ''; SOC.tab = 'buscar'; inicioPanel('social'); return socAccion('buscar'); }
      case 'buscarId': SOC.q = b; // (sigue)
      case 'buscar': {
        const pid = (SOC.q || '').replace(/\D/g, ''); if (pid.length !== 8) { SOC.busc = 0; return socDibujar(false); }
        try { SOC.busc = await socApi('buscar?pid=' + pid); const R = socRec().filter((x) => x.pid !== pid); R.unshift({ pid, nombre: SOC.busc.perfil.nombre, skin: SOC.busc.perfil.skin }); try { localStorage.setItem('jx_soc_rec', JSON.stringify(R.slice(0, 6))); } catch (e) {} }
        catch (e) { if (e.st === 404) SOC.busc = 0; else throw e; }
        return socDibujar(false);
      }
      case 'recBorrar': try { localStorage.setItem('jx_soc_rec', JSON.stringify(socRec().filter((x) => x.pid !== b))); } catch (e) {} return socDibujar(false);
      case 'ver': { SOC.sel = b; const v = P && P.querySelector('.soDer .soVista'); if (v) { v.classList.remove('soFlash'); void v.offsetWidth; v.classList.add('soFlash'); } return; }
      case 'sala': return socPedirSala(b);
      case 'amigo': {
        const hacer = async () => { const j = await socApi('amigo', { method: 'POST', body: { pid: c, accion: b } }); if (SOC.busc && SOC.busc.perfil && SOC.busc.perfil.pid === c) SOC.busc.rel = j.rel; SOC.amigos = null; return socDibujar(SOC.tab === 'amigos'); };
        if (b === 'bloquear' || b === 'borrar') return confirmar(T(b === 'bloquear' ? 'so.seguroBloq' : 'so.seguroBorrar'), T(b === 'bloquear' ? 'so.bloquear' : 'so.eliminar'), hacer);
        return hacer();
      }
      case 'dm': { const j = await socApi('chat', { method: 'POST', body: { pid: b } }); SOC.tab = 'chats'; SOC.chat = j.id; SOC.chats = null; return inicioPanel('social'); }
      case 'abrir': SOC.chat = b; SOC.vistoAbajo = false; socConversacion(P.querySelector('.soDer')); await socChatCargar(true); return;
      case 'enviar': {
        const i = P && P.querySelector('.soMsgIn'); if (!i || !i.value.trim() || !SOC.chat) return;
        const t = typeof censurar === 'function' ? censurar(i.value.trim()) : i.value.trim(); i.value = '';
        await socApi('chat/' + SOC.chat + '/enviar', { method: 'POST', body: { texto: t } }); return socChatCargar(false);
      }
      case 'invitar': case 'invitarChat': {
        const S = socSala(); if (!S) return cuAviso(T('so.entraServer'));
        let id = SOC.chat; if (a === 'invitar') id = (await socApi('chat', { method: 'POST', body: { pid: b } })).id;
        await socApi('chat/' + id + '/enviar', { method: 'POST', body: { inv: S } }); cuAviso(T('so.invEnviada')); if (id === SOC.chat) return socChatCargar(false); return;
      }
      case 'unirse': {
        const m = SOC.msgs.find((x) => String(x.id) === b), d = m && m.datos; if (!d) return;
        // (el server sale de la lista, con su clave si tiene: si la lista no estaba conectada, se conecta y se espera un poco)
        const hallar = () => (typeof listaSalas === 'function' ? listaSalas().find((x) => x.S.id === d.id) : null);
        let e = hallar();
        if (!e) { if (typeof listaConectar === 'function') listaConectar(); if (typeof salasCargar === 'function') salasCargar(); for (let i = 0; i < 12 && !e; i++) { await new Promise((r) => setTimeout(r, 400)); e = hallar(); } }
        if (!e) return cuAviso(T('so.yaNo'));
        // (desde la pausa: se deja bien la partida de ahora antes de entrar a la otra)
        if (RB.desdeJuego) { RB.desdeJuego = false; if (JUEGO.estado === 'juego' && typeof irMenuPrincipal === 'function') irMenuPrincipal(); }
        return entrarSala(e.S, undefined, e.j.length);
      }
      case 'grupoNuevo': case 'agregarGrupo': {
        if (!SOC.amigos) SOC.amigos = await socApi('amigos');
        return socElegirAmigos(a === 'grupoNuevo', async (nombre, pids) => {
          if (a === 'grupoNuevo') { const j = await socApi('grupo', { method: 'POST', body: { nombre, pids } }); SOC.chat = j.id; }
          else await socApi('chat/' + SOC.chat + '/invitar', { method: 'POST', body: { pids } });
          SOC.chats = null; inicioPanel('social');
        });
      }
      case 'miembros': { const j = await socApi('chat/' + SOC.chat + '/miembros'); return confirmarLista(T('so.miembros'), j.miembros.map((p) => `${socAvatar(p.skin, p.online)} <b>${esc(p.nombre)}</b> <small>${esc(socEstado(p))}</small>`), T('so.salirGrupo'), async () => { await socApi('chat/' + SOC.chat + '/salir', { method: 'POST' }); SOC.chat = null; SOC.chats = null; inicioPanel('social'); }); }
    }
  } catch (e) { if (e.st === 401) { cuSesionVencida(); inicioPanel('social'); } else cuAviso(String(e.message || e).slice(0, 80)); }
}
// (un cartel con la lista de amigos para tildar; con nombre si es un grupo nuevo)
function socElegirAmigos(conNombre, hecho) {
  const A = (SOC.amigos && SOC.amigos.amigos) || []; let D = document.getElementById('cfDlg');
  if (!D) { D = document.createElement('div'); D.id = 'cfDlg'; document.body.appendChild(D); D.addEventListener('pointerdown', (e) => e.stopPropagation()); }
  D.innerHTML = `<div class="cuCaja soElegir"><h3>${esc(T(conNombre ? 'so.grupoNuevo' : 'so.agregarGrupo'))}</h3>${conNombre ? `<input class="soBusIn soGN" maxlength="30" placeholder="${esc(T('so.nombreGrupo'))}">` : ''}
    <div class="soLista">${A.map((p) => `<label class="soIt">${socAvatar(p.skin, p.online)}<span><b>${esc(p.nombre)}</b></span><input type="checkbox" value="${p.pid}"></label>`).join('') || `<p class="soVacio">${esc(T('so.sinAmigos'))}</p>`}</div>
    <div class="cuBotones"><button class="cuBtn gris" data-cf="no">${esc(T('cancelar'))}</button><button class="cuBtn" data-cf="si">${esc(T(conNombre ? 'so.crear' : 'so.invitar'))}</button></div></div>`;
  D.onclick = (e) => { e.stopPropagation(); const b = e.target.closest('[data-cf]'); if (!b && e.target !== D) return;
    if (b && b.dataset.cf === 'si') { const n = conNombre ? D.querySelector('.soGN').value.trim() : ''; if (conNombre && n.length < 2) return; hecho(n, [...D.querySelectorAll('input[type=checkbox]:checked')].map((x) => x.value)); }
    D.className = 'oc'; };
  D.addEventListener('keydown', (e) => e.stopPropagation()); D.className = '';
}
function confirmarLista(tit, filas, okTxt, ok) {
  confirmar('', okTxt, ok); const C = document.querySelector('#cfDlg .cuCaja');
  C.querySelector('p').outerHTML = `<h3>${esc(tit)}</h3><div class="soLista">${filas.map((f) => `<div class="soIt">${f}</div>`).join('')}</div>`;
  C.querySelector('[data-cf=no]').textContent = T('volver');
}

// ---------------- textos (es|en|pt|id|ms|fil|ja|th|tr|ar|ru|uk|fr|de) ----------------
(() => { const L = {
  'm.social': 'Social|Social|Social|Sosial|Sosial|Social|ソーシャル|โซเชียล|Sosyal|اجتماعي|Друзья|Друзі|Social|Sozial',
  'so.sis_creo': '{n} creó el grupo|{n} created the group|{n} criou o grupo|{n} membuat grup|{n} mencipta kumpulan|Ginawa ni {n} ang grupo|{n}がグループを作成しました|{n} สร้างกลุ่ม|{n} grubu oluşturdu|أنشأ {n} المجموعة|{n} создал(а) группу|{n} створив(ла) групу|{n} a créé le groupe|{n} hat die Gruppe erstellt',
  'so.sis_unio': '{n} se unió al grupo|{n} joined the group|{n} entrou no grupo|{n} bergabung ke grup|{n} menyertai kumpulan|Sumali si {n} sa grupo|{n}がグループに参加しました|{n} เข้าร่วมกลุ่ม|{n} gruba katıldı|انضم {n} إلى المجموعة|{n} присоединился(ась) к группе|{n} приєднався(лася) до групи|{n} a rejoint le groupe|{n} ist der Gruppe beigetreten',
  'so.sis_salio': '{n} salió del grupo|{n} left the group|{n} saiu do grupo|{n} keluar dari grup|{n} keluar daripada kumpulan|Umalis si {n} sa grupo|{n}がグループを退出しました|{n} ออกจากกลุ่ม|{n} gruptan ayrıldı|غادر {n} المجموعة|{n} вышел(ла) из группы|{n} вийшов(ла) з групи|{n} a quitté le groupe|{n} hat die Gruppe verlassen',
  'so.chats': 'Chats|Chats|Conversas|Obrolan|Sembang|Mga chat|チャット|แชท|Sohbetler|الدردشات|Чаты|Чати|Discussions|Chats',
  'so.amigos': 'Amigos|Friends|Amigos|Teman|Rakan|Mga kaibigan|フレンド|เพื่อน|Arkadaşlar|الأصدقاء|Друзья|Друзі|Amis|Freunde',
  'so.buscarT': 'Buscar jugador|Find player|Buscar jogador|Cari pemain|Cari pemain|Hanapin ang player|プレイヤー検索|ค้นหาผู้เล่น|Oyuncu bul|ابحث عن لاعب|Найти игрока|Знайти гравця|Chercher un joueur|Spieler suchen',
  'so.perfil': 'Perfil|Profile|Perfil|Profil|Profil|Profile|プロフィール|โปรไฟล์|Profil|الملف الشخصي|Профиль|Профіль|Profil|Profil',
  'so.noConfig': 'Lo social se activa cuando la tienda tenga el inicio de sesión con Google.|Social turns on when the store has Google sign-in set up.|O social é ativado quando a loja tiver o login com Google.|Fitur sosial aktif setelah toko menyiapkan masuk dengan Google.|Sosial aktif apabila kedai menyediakan log masuk Google.|Gagana ang social kapag naka-set up na ang Google sign-in ng tindahan.|ストアでGoogleログインが設定されるとソーシャルが使えます。|ฟีเจอร์โซเชียลจะใช้ได้เมื่อร้านตั้งค่าการเข้าสู่ระบบ Google|Mağazada Google ile giriş ayarlanınca sosyal açılır.|يتفعّل القسم الاجتماعي عندما يُعدّ المتجر تسجيل الدخول بـ Google.|Раздел заработает, когда в магазине настроят вход через Google.|Розділ запрацює, коли в магазині налаштують вхід через Google.|Le social s’active quand la boutique a la connexion Google.|Sozial wird aktiv, sobald der Shop die Google-Anmeldung hat.',
  'so.paraSocial': 'Para hablar con amigos iniciá sesión con tu cuenta de Google.|Sign in with your Google account to chat with friends.|Para falar com amigos, entre com sua conta Google.|Masuk dengan akun Google untuk mengobrol dengan teman.|Log masuk dengan akaun Google untuk bersembang dengan rakan.|Mag-sign in gamit ang Google para makipag-chat sa mga kaibigan.|フレンドと話すにはGoogleでログインしてください。|ลงชื่อเข้าใช้ด้วย Google เพื่อคุยกับเพื่อน|Arkadaşlarla konuşmak için Google ile giriş yap.|سجّل الدخول بحساب Google للدردشة مع الأصدقاء.|Войдите через Google, чтобы общаться с друзьями.|Увійдіть через Google, щоб спілкуватися з друзями.|Connecte-toi avec Google pour parler à tes amis.|Melde dich mit Google an, um mit Freunden zu chatten.',
  'so.error': 'No se pudo conectar. Probá de nuevo.|Could not connect. Try again.|Não foi possível conectar. Tente de novo.|Gagal terhubung. Coba lagi.|Gagal menyambung. Cuba lagi.|Hindi makakonekta. Subukan ulit.|接続できませんでした。もう一度お試しください。|เชื่อมต่อไม่ได้ ลองอีกครั้ง|Bağlanılamadı. Tekrar dene.|تعذّر الاتصال. حاول مجددًا.|Не удалось подключиться. Попробуйте ещё раз.|Не вдалося підключитися. Спробуйте ще раз.|Connexion impossible. Réessaie.|Keine Verbindung. Versuch es erneut.',
  'so.ayer': 'ayer|yesterday|ontem|kemarin|semalam|kahapon|昨日|เมื่อวาน|dün|أمس|вчера|учора|hier|gestern',
  'so.hace': 'hace {t}|{t} ago|há {t}|{t} lalu|{t} lalu|{t} ang nakalipas|{t}前|{t} ที่แล้ว|{t} önce|منذ {t}|{t} назад|{t} тому|il y a {t}|vor {t}',
  'so.jugando': 'Jugando|Playing|Jogando|Bermain|Bermain|Naglalaro|プレイ中|กำลังเล่น|Oynuyor|يلعب|Играет|Грає|En jeu|Spielt',
  'so.enLinea': 'En línea|Online|Online|Online|Dalam talian|Online|オンライン|ออนไลน์|Çevrimiçi|متصل|В сети|У мережі|En ligne|Online',
  'so.desc': 'Desconectado|Offline|Offline|Offline|Luar talian|Offline|オフライン|ออฟไลน์|Çevrimdışı|غير متصل|Не в сети|Не в мережі|Hors ligne|Offline',
  'so.invPartida': 'Invitación a partida|Game invite|Convite para partida|Undangan main|Jemputan permainan|Imbitasyon sa laro|ゲームへの招待|คำเชิญเข้าเกม|Oyun daveti|دعوة إلى لعبة|Приглашение в игру|Запрошення до гри|Invitation à jouer|Spieleinladung',
  'so.copiar': 'Copiar|Copy|Copiar|Salin|Salin|Kopyahin|コピー|คัดลอก|Kopyala|نسخ|Копировать|Копіювати|Copier|Kopieren',
  'so.copiado': 'ID copiado|ID copied|ID copiado|ID disalin|ID disalin|Nakopya ang ID|IDをコピーしました|คัดลอก ID แล้ว|ID kopyalandı|تم نسخ المعرّف|ID скопирован|ID скопійовано|ID copié|ID kopiert',
  'so.buscarId': 'Buscar jugador por ID|Find player by ID|Buscar jogador por ID|Cari pemain lewat ID|Cari pemain mengikut ID|Hanapin ang player ayon sa ID|IDでプレイヤー検索|ค้นหาผู้เล่นด้วย ID|ID ile oyuncu bul|ابحث عن لاعب بالمعرّف|Найти игрока по ID|Знайти гравця за ID|Chercher un joueur par ID|Spieler per ID suchen',
  'so.escribeId': 'Escribí un ID…|Type an ID…|Digite um ID…|Ketik ID…|Taip ID…|Mag-type ng ID…|IDを入力…|พิมพ์ ID…|Bir ID yaz…|اكتب معرّفًا…|Введите ID…|Введіть ID…|Saisis un ID…|ID eingeben…',
  'so.buscarBtn': 'Buscar|Search|Buscar|Cari|Cari|Hanapin|検索|ค้นหา|Ara|بحث|Найти|Знайти|Chercher|Suchen',
  'so.estado': 'Estado de conexión|Connection status|Status de conexão|Status koneksi|Status sambungan|Status ng koneksyon|接続状態|สถานะการเชื่อมต่อ|Bağlantı durumu|حالة الاتصال|Статус|Статус|Statut de connexion|Verbindungsstatus',
  'so.vistaPrevia': 'Vista previa|Preview|Prévia|Pratinjau|Pratonton|Preview|プレビュー|ตัวอย่าง|Önizleme|معاينة|Предпросмотр|Попередній перегляд|Aperçu|Vorschau',
  'so.cambiarFondo': 'Cambiar fondo|Change background|Mudar fundo|Ganti latar|Tukar latar|Palitan ang background|背景を変更|เปลี่ยนพื้นหลัง|Arka planı değiştir|تغيير الخلفية|Сменить фон|Змінити фон|Changer le fond|Hintergrund ändern',
  'so.noExiste': 'No hay ningún jugador con ese ID.|No player has that ID.|Nenhum jogador com esse ID.|Tidak ada pemain dengan ID itu.|Tiada pemain dengan ID itu.|Walang player na may ganyang ID.|そのIDのプレイヤーはいません。|ไม่มีผู้เล่นที่ใช้ ID นี้|Bu ID ile oyuncu yok.|لا يوجد لاعب بهذا المعرّف.|Игрока с таким ID нет.|Гравця з таким ID немає.|Aucun joueur avec cet ID.|Kein Spieler mit dieser ID.',
  'so.resultado': 'Resultado|Result|Resultado|Hasil|Hasil|Resulta|結果|ผลลัพธ์|Sonuç|النتيجة|Результат|Результат|Résultat|Ergebnis',
  'so.enSala': 'En esta sala|In this room|Nesta sala|Di ruangan ini|Dalam bilik ini|Sa room na ito|この部屋|ในห้องนี้|Bu odada|في هذه الغرفة|В этой комнате|У цій кімнаті|Dans ce salon|In diesem Raum',
  'so.amigo': 'Amigo|Friend|Amigo|Teman|Rakan|Kaibigan|フレンド|เพื่อน|Arkadaş|صديق|Друг|Друг|Ami|Freund',
  'so.pedido': 'Solicitud enviada|Request sent|Pedido enviado|Permintaan terkirim|Permintaan dihantar|Naipadala ang request|申請済み|ส่งคำขอแล้ว|İstek gönderildi|تم إرسال الطلب|Заявка отправлена|Запит надіслано|Demande envoyée|Anfrage gesendet',
  'so.aceptar': 'Aceptar|Accept|Aceitar|Terima|Terima|Tanggapin|承認|ยอมรับ|Kabul et|قبول|Принять|Прийняти|Accepter|Annehmen',
  'so.desbloquear': 'Desbloquear|Unblock|Desbloquear|Buka blokir|Nyahsekat|I-unblock|ブロック解除|เลิกบล็อก|Engeli kaldır|إلغاء الحظر|Разблокировать|Розблокувати|Débloquer|Entsperren',
  'so.agregar': 'Agregar amigo|Add friend|Adicionar amigo|Tambah teman|Tambah rakan|Idagdag na kaibigan|フレンド追加|เพิ่มเพื่อน|Arkadaş ekle|إضافة صديق|Добавить в друзья|Додати в друзі|Ajouter en ami|Als Freund hinzufügen',
  'so.verPerfil': 'Ver perfil|View profile|Ver perfil|Lihat profil|Lihat profil|Tingnan ang profile|プロフィールを見る|ดูโปรไฟล์|Profili gör|عرض الملف|Профиль|Профіль|Voir le profil|Profil ansehen',
  'so.recientes': 'Búsquedas recientes|Recent searches|Buscas recentes|Pencarian terbaru|Carian terkini|Mga kamakailang hinanap|最近の検索|การค้นหาล่าสุด|Son aramalar|عمليات البحث الأخيرة|Недавние поиски|Нещодавні пошуки|Recherches récentes|Letzte Suchen',
  'so.invitarPartida': 'Invitar a partida|Invite to game|Convidar para partida|Undang main|Jemput bermain|Imbitahan sa laro|ゲームに招待|ชวนเข้าเกม|Oyuna davet et|دعوة إلى اللعبة|Пригласить в игру|Запросити до гри|Inviter à jouer|Zum Spiel einladen',
  'so.mensaje': 'Mensaje|Message|Mensagem|Pesan|Mesej|Mensahe|メッセージ|ข้อความ|Mesaj|رسالة|Сообщение|Повідомлення|Message|Nachricht',
  'so.eliminar': 'Eliminar amigo|Remove friend|Remover amigo|Hapus teman|Buang rakan|Alisin sa kaibigan|フレンド解除|ลบเพื่อน|Arkadaşlıktan çıkar|إزالة الصديق|Удалить из друзей|Видалити з друзів|Retirer des amis|Freund entfernen',
  'so.bloquear': 'Bloquear|Block|Bloquear|Blokir|Sekat|I-block|ブロック|บล็อก|Engelle|حظر|Заблокировать|Заблокувати|Bloquer|Blockieren',
  'so.solicitudes': 'Solicitudes|Requests|Pedidos|Permintaan|Permintaan|Mga request|申請|คำขอ|İstekler|الطلبات|Заявки|Запити|Demandes|Anfragen',
  'so.bloqueados': 'Bloqueados|Blocked|Bloqueados|Diblokir|Disekat|Naka-block|ブロック中|ที่บล็อก|Engellenenler|المحظورون|Заблокированные|Заблоковані|Bloqués|Blockiert',
  'so.buscarAmigo': 'Buscar amigo…|Search friend…|Buscar amigo…|Cari teman…|Cari rakan…|Hanapin ang kaibigan…|フレンドを検索…|ค้นหาเพื่อน…|Arkadaş ara…|ابحث عن صديق…|Поиск друга…|Пошук друга…|Chercher un ami…|Freund suchen…',
  'so.invitar': 'Invitar|Invite|Convidar|Undang|Jemput|Imbitahan|招待|เชิญ|Davet et|دعوة|Пригласить|Запросити|Inviter|Einladen',
  'so.sinAmigos': 'Todavía no tenés amigos: buscalos por su ID.|No friends yet: find them by their ID.|Ainda sem amigos: busque pelo ID.|Belum ada teman: cari lewat ID mereka.|Belum ada rakan: cari dengan ID mereka.|Wala pang kaibigan: hanapin sila sa ID.|まだフレンドがいません。IDで探しましょう。|ยังไม่มีเพื่อน ค้นหาด้วย ID ได้เลย|Henüz arkadaş yok: ID ile bul.|لا أصدقاء بعد: ابحث عنهم بالمعرّف.|Пока нет друзей: найдите их по ID.|Поки немає друзів: знайдіть їх за ID.|Pas encore d’amis : cherche-les par ID.|Noch keine Freunde: per ID suchen.',
  'so.sinChats': 'Todavía no tenés chats: abrí uno desde Amigos.|No chats yet: open one from Friends.|Ainda sem conversas: abra uma em Amigos.|Belum ada obrolan: buka dari Teman.|Belum ada sembang: buka dari Rakan.|Wala pang chat: magbukas mula sa Mga kaibigan.|チャットはまだありません。フレンドから始めましょう。|ยังไม่มีแชท เปิดจากหน้าเพื่อน|Henüz sohbet yok: Arkadaşlar’dan aç.|لا دردشات بعد: افتح واحدة من الأصدقاء.|Чатов пока нет: начните в «Друзьях».|Чатів поки немає: почніть у «Друзях».|Pas encore de discussions : ouvre-en une depuis Amis.|Noch keine Chats: starte einen bei Freunde.',
  'so.buscarChat': 'Buscar chat…|Search chat…|Buscar conversa…|Cari obrolan…|Cari sembang…|Hanapin ang chat…|チャットを検索…|ค้นหาแชท…|Sohbet ara…|ابحث في الدردشات…|Поиск чата…|Пошук чату…|Chercher…|Chat suchen…',
  'so.grupoNuevo': 'Grupo nuevo|New group|Novo grupo|Grup baru|Kumpulan baharu|Bagong grupo|新しいグループ|กลุ่มใหม่|Yeni grup|مجموعة جديدة|Новая группа|Нова група|Nouveau groupe|Neue Gruppe',
  'so.agregarGrupo': 'Agregar al grupo|Add to group|Adicionar ao grupo|Tambah ke grup|Tambah ke kumpulan|Idagdag sa grupo|グループに追加|เพิ่มเข้ากลุ่ม|Gruba ekle|إضافة إلى المجموعة|Добавить в группу|Додати до групи|Ajouter au groupe|Zur Gruppe hinzufügen',
  'so.nombreGrupo': 'Nombre del grupo|Group name|Nome do grupo|Nama grup|Nama kumpulan|Pangalan ng grupo|グループ名|ชื่อกลุ่ม|Grup adı|اسم المجموعة|Название группы|Назва групи|Nom du groupe|Gruppenname',
  'so.crear': 'Crear|Create|Criar|Buat|Cipta|Gumawa|作成|สร้าง|Oluştur|إنشاء|Создать|Створити|Créer|Erstellen',
  'so.elegiChat': 'Elegí un chat de la lista.|Pick a chat from the list.|Escolha uma conversa da lista.|Pilih obrolan dari daftar.|Pilih sembang daripada senarai.|Pumili ng chat sa listahan.|リストからチャットを選んでください。|เลือกแชทจากรายการ|Listeden bir sohbet seç.|اختر دردشة من القائمة.|Выберите чат в списке.|Виберіть чат у списку.|Choisis une discussion.|Wähle einen Chat aus der Liste.',
  'so.miembrosN': '{n} miembros · {e} en línea|{n} members · {e} online|{n} membros · {e} online|{n} anggota · {e} online|{n} ahli · {e} dalam talian|{n} miyembro · {e} online|{n}人 · {e}人オンライン|สมาชิก {n} · ออนไลน์ {e}|{n} üye · {e} çevrimiçi|{n} أعضاء · {e} متصل|{n} участн. · {e} в сети|{n} учасн. · {e} у мережі|{n} membres · {e} en ligne|{n} Mitglieder · {e} online',
  'so.miembros': 'Miembros|Members|Membros|Anggota|Ahli|Mga miyembro|メンバー|สมาชิก|Üyeler|الأعضاء|Участники|Учасники|Membres|Mitglieder',
  'so.escribir': 'Escribí un mensaje…|Type a message…|Digite uma mensagem…|Ketik pesan…|Taip mesej…|Mag-type ng mensahe…|メッセージを入力…|พิมพ์ข้อความ…|Bir mesaj yaz…|اكتب رسالة…|Напишите сообщение…|Напишіть повідомлення…|Écris un message…|Nachricht schreiben…',
  'so.hoy': 'Hoy|Today|Hoje|Hari ini|Hari ini|Ngayon|今日|วันนี้|Bugün|اليوم|Сегодня|Сьогодні|Aujourd’hui|Heute',
  'so.escribiendo': '{n} está escribiendo…|{n} is typing…|{n} está digitando…|{n} sedang mengetik…|{n} sedang menaip…|Nagta-type si {n}…|{n}が入力中…|{n} กำลังพิมพ์…|{n} yazıyor…|{n} يكتب…|{n} печатает…|{n} друкує…|{n} écrit…|{n} schreibt…',
  'so.entraServer': 'Entrá a un server para invitar.|Join a server to invite.|Entre num servidor para convidar.|Masuk ke server untuk mengundang.|Masuk pelayan untuk menjemput.|Pumasok sa server para mag-imbita.|招待するにはサーバーに入ってください。|เข้าเซิร์ฟเวอร์ก่อนจึงจะเชิญได้|Davet için bir sunucuya gir.|ادخل خادمًا لتدعو.|Зайдите на сервер, чтобы пригласить.|Зайдіть на сервер, щоб запросити.|Rejoins un serveur pour inviter.|Tritt einem Server bei, um einzuladen.',
  'so.invEnviada': 'Invitación enviada|Invite sent|Convite enviado|Undangan terkirim|Jemputan dihantar|Naipadala ang imbitasyon|招待を送りました|ส่งคำเชิญแล้ว|Davet gönderildi|تم إرسال الدعوة|Приглашение отправлено|Запрошення надіслано|Invitation envoyée|Einladung gesendet',
  'so.yaNo': 'Ese server ya no está.|That server is gone.|Esse servidor não existe mais.|Server itu sudah tidak ada.|Pelayan itu sudah tiada.|Wala na ang server na iyon.|そのサーバーはもうありません。|เซิร์ฟเวอร์นั้นไม่มีแล้ว|O sunucu artık yok.|ذلك الخادم لم يعد موجودًا.|Этого сервера больше нет.|Цього сервера вже немає.|Ce serveur n’existe plus.|Dieser Server ist weg.',
  'so.seguroBloq': '¿Bloquear a este jugador? No te va a poder escribir ni agregar.|Block this player? They won’t be able to message or add you.|Bloquear este jogador? Ele não poderá te escrever nem adicionar.|Blokir pemain ini? Dia tidak bisa mengirim pesan atau menambahmu.|Sekat pemain ini? Dia tidak boleh mesej atau menambah anda.|I-block ang player na ito? Hindi ka na niya mame-message o maidadagdag.|このプレイヤーをブロックしますか？メッセージも申請もできなくなります。|บล็อกผู้เล่นนี้ไหม? เขาจะส่งข้อความหรือเพิ่มคุณไม่ได้|Bu oyuncu engellensin mi? Sana yazamaz ve ekleyemez.|حظر هذا اللاعب؟ لن يتمكن من مراسلتك أو إضافتك.|Заблокировать? Он не сможет писать и добавлять вас.|Заблокувати? Він не зможе писати й додавати вас.|Bloquer ce joueur ? Il ne pourra plus t’écrire ni t’ajouter.|Diesen Spieler blockieren? Er kann dir nicht mehr schreiben oder dich hinzufügen.',
  'so.seguroBorrar': '¿Eliminar a este amigo?|Remove this friend?|Remover este amigo?|Hapus teman ini?|Buang rakan ini?|Alisin ang kaibigang ito?|このフレンドを解除しますか？|ลบเพื่อนคนนี้ไหม?|Bu arkadaş silinsin mi?|إزالة هذا الصديق؟|Удалить из друзей?|Видалити з друзів?|Retirer cet ami ?|Diesen Freund entfernen?',
  'so.salirGrupo': 'Salir del grupo|Leave group|Sair do grupo|Keluar grup|Keluar kumpulan|Umalis sa grupo|グループを退出|ออกจากกลุ่ม|Gruptan çık|مغادرة المجموعة|Выйти из группы|Вийти з групи|Quitter le groupe|Gruppe verlassen',
  'so.entrar': 'Entrar|Join|Entrar|Masuk|Masuk|Sumali|参加|เข้าร่วม|Katıl|انضمام|Войти|Увійти|Rejoindre|Beitreten'
}; for (const [k, v] of Object.entries(L)) IDI3[k] = v.split('|'); })();
