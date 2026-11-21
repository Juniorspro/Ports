// La zona social (publicaciones y amigos) y el chat, del lado de la app (el servidor: servidor/social.js).
// - En el inicio, «Social»: lo que publica la gente (o sólo tus amigos), con me gusta y denuncias; «¿Qué contás?» abre
//   para publicar texto con hasta 4 fotos, stickers tuyos o videos cortos (sin sonido: se vuelven un sticker animado).
// - El botón del chat (arriba, con los no leídos): tus chats y los pedidos de amistad. Sólo se chatea con amigos, con
//   texto, pegatinas o tus stickers. Los mensajes de otro se denuncian con un toque largo.
import { api, cuenta, API, avatarHTML, hace, pedirCuenta } from './comunidad.js';
import * as P from './puente.js';
import { PEGATINAS } from './pegatinas.js';
import { webpAnimado } from './editor.js';
let X = null;
const MOTIVOS = [['ofensivo', 'Es ofensivo o discrimina'], ['sexual', 'Contenido sexual'], ['violencia', 'Violencia'], ['acoso', 'Acoso o me molesta'], ['spam', 'Spam o engaño'], ['otro', 'Otra cosa']];
const lienzo = (w, hh) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(hh)); return c; };
const vacio = (pega, t, s) => `<div class="vacio"><div class="vacioIco pegaV"><i class="pegaUI" data-pega="${pega}"></i></div><b>${t}</b><span>${s}</span></div>`;
const aBlob = (c, q) => new Promise((ok) => c.toBlob(ok, 'image/webp', q));
const aB64 = async (b) => { const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
function elegirArchivo(acepta) {
  return new Promise((ok) => { const i = document.createElement('input'); i.type = 'file'; i.accept = acepta; i.style.display = 'none'; document.body.appendChild(i);
    i.onchange = () => { ok(i.files && i.files[0] ? i.files[0] : null); i.remove(); }; i.click(); setTimeout(() => { if (!i.files || !i.files.length) { /* sigue esperando: el usuario elige */ } }, 0); });
}
async function denunciar(texto, ruta) {
  const m = X.modal(`<div class="hoja"><h3>${X.h(texto)}</h3><div class="lista">${MOTIVOS.map(([k, n]) => `<button class="opc" data-m="${k}"><span>${n}</span></button>`).join('')}</div><div class="botones"><button class="sec" data-x="0">Cancelar</button></div></div>`);
  m.onclick = async (ev) => { const b = ev.target.closest('[data-m]'); if (!b) { if (ev.target.closest('[data-x]') || ev.target === m) X.cerrarModal(); return; }
    try { await api(ruta, { method: 'POST', json: { motivo: b.dataset.m } }); X.cerrarModal(); X.aviso('Gracias. Lo vamos a revisar'); } catch (e) { X.aviso(e.message); } };
}

// ================= SOCIAL (el feed de publicaciones) =================
const S = { antes: null, cargando: false, fin: false, filtro: 'todos', n: 0 };
const cabSocial = () => `<div class="soCab"><button class="soNuevo" data-so="nuevo"><i data-i="lapiz"></i><span>¿Qué contás?</span><i data-i="galeria"></i></button>
  <div class="chips soFiltro">${[['todos', 'Todos'], ['amigos', 'Amigos']].map(([k, n]) => `<button class="chip${S.filtro === k ? ' act' : ''}" data-sf="${k}">${n}</button>`).join('')}</div></div><div class="soLista"></div>`;
export function postHTML(p) {
  const yo = cuenta(), mio = yo && p.autor.id === yo.id;
  const media = p.media.length ? `<div class="soMedia n${p.media.length}">${p.media.map((m) => `<img src="${API}/${m.url}" alt="" loading="lazy" class="m_${m.tipo}">`).join('')}</div>` : '';
  return `<article class="soPost" data-post="${p.id}"${mio ? ' data-mio="1"' : ''}><header><button class="autor" data-u="${X.h(p.autor.nombre)}">${avatarHTML(p.autor.avatar)}<span><b>@${X.h(p.autor.nombre)}${p.autor.premium ? '<i class="miniPrem" title="Premium" data-i="chispa"></i>' : ''}</b><small>${hace(p.creado)}</small></span></button>
    <button class="ico soMas" data-so="menu" aria-label="Más"><i data-i="puntos"></i></button></header>${p.texto ? `<p class="soTxt">${X.h(p.texto)}</p>` : ''}${media}
    <footer><button class="soLike${p.yoLike ? ' si' : ''}" data-so="like" aria-label="Me gusta"><i data-i="corazon"></i><span>${p.likes || ''}</span></button></footer></article>`;
}
export async function cargarSocial(lista, reiniciar) {
  if (reiniciar) { S.antes = null; S.fin = false; S.n++; S.cargando = false; lista.innerHTML = cabSocial(); lista.querySelector('.soLista').innerHTML = '<div class="tarjeta esqCab"></div><div class="tarjeta esqGrilla"></div>'; X.iconos(lista); }
  if (S.cargando || S.fin) return; S.cargando = true; const n = S.n;
  try {
    const r = await api(`/api/social/feed?modo=${S.filtro}${S.antes ? '&antes=' + S.antes : ''}`);
    if (n !== S.n) return; const L = lista.querySelector('.soLista'); if (!L) return; if (!S.antes) L.innerHTML = '';
    if (r.necesitaCuenta) L.innerHTML = vacio('ojitos', 'Entrá para ver a tus amigos', 'Con tu cuenta ves lo que publican tus amigos.');
    else if (!r.posts.length && !S.antes) L.innerHTML = vacio('confeti', S.filtro === 'amigos' ? 'Tus amigos no publicaron nada' : 'Todavía no hay publicaciones', 'Tocá «¿Qué contás?» y hacé la primera.');
    L.insertAdjacentHTML('beforeend', r.posts.map(postHTML).join('')); X.iconos(L);
    S.antes = r.sigue; S.fin = !r.sigue;
  } catch (e) { if (n === S.n) { const L = lista.querySelector('.soLista'); if (L && !S.antes) L.innerHTML = vacio('loco', 'Sin conexión con la comunidad', X.h(e.message || '')); } }
  finally { if (n === S.n) S.cargando = false; }
}
/** los toques del feed social (los manda comunidad.js); devuelve true si era de acá */
export async function clickSocial(ev, lista) {
  const f = ev.target.closest('[data-sf]'); if (f) { S.filtro = f.dataset.sf; X.vibrar(6); cargarSocial(lista, true); return true; }
  const b = ev.target.closest('[data-so]'); if (!b) return false;
  const post = b.closest('[data-post]'), id = post && post.dataset.post, que = b.dataset.so; X.vibrar(8);
  if (que === 'nuevo') { abrirPublicar(lista); return true; }
  if (!cuenta()) { pedirCuenta('Entrá con tu cuenta'); return true; }
  if (que === 'like') {
    try { const r = await api(`/api/social/posts/${id}/like`, { method: 'POST' }); b.classList.toggle('si', r.yoLike); b.querySelector('span').textContent = r.likes || ''; if (r.yoLike) { b.classList.remove('pum'); void b.offsetWidth; b.classList.add('pum'); } } catch (e) { X.aviso(e.message); }
  } else if (que === 'menu') {
    const mio = post.dataset.mio, m = X.modal(`<div class="hoja"><div class="lista">${mio ? '<button class="opc" data-a="borrar"><i data-i="tacho"></i><span>Borrar la publicación</span></button>' : '<button class="opc" data-a="denunciar"><i data-i="bandera"></i><span>Denunciar</span></button>'}</div><div class="botones"><button class="sec" data-x="0">Cancelar</button></div></div>`);
    m.onclick = async (e2) => { const a = e2.target.closest('[data-a]'); if (!a) { if (e2.target.closest('[data-x]') || e2.target === m) X.cerrarModal(); return; }
      if (a.dataset.a === 'denunciar') return denunciar('¿Por qué la denunciás?', `/api/social/posts/${id}/reportar`);
      X.cerrarModal(); if (!(await X.confirmar('¿Borrar la publicación?', 'Borrar'))) return;
      try { await api(`/api/social/posts/${id}`, { method: 'DELETE' }); post.remove(); X.aviso('Borrada'); } catch (err) { X.aviso(err.message); } };
  }
  return true;
}
// ---- publicar: texto y hasta 4 fotos, stickers o videos ----
async function fotoAWebP(f) {
  const img = await createImageBitmap(f), k = Math.min(1, 1080 / Math.max(img.width, img.height)), c = lienzo(img.width * k, img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.82, 0.7, 0.55, 0.4]) { const b = await aBlob(c, q); if (b && b.size <= 440 * 1024) return b; }
  throw new Error('La foto quedó muy pesada');
}
// (un video corto → un sticker animado sin sonido: los primeros 4 segundos, a 8 cuadros por segundo y 360 px)
async function videoAWebP(f, avance) {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(f);
  try {
    await new Promise((ok, mal) => { v.onloadeddata = ok; v.onerror = () => mal(new Error('No pude abrir ese video')); });
    const dur = Math.min(4, isFinite(v.duration) ? v.duration : 4), fps = 8, n = Math.max(2, Math.round(dur * fps)), k = 360 / Math.max(v.videoWidth, v.videoHeight), w = Math.round(v.videoWidth * k / 2) * 2, hh = Math.round(v.videoHeight * k / 2) * 2;
    const cuadros = [];
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.min(dur - 0.01, i / fps); await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 1500); });
      const c = lienzo(w, hh); c.getContext('2d').drawImage(v, 0, 0, w, hh); cuadros.push({ x: 0, y: 0, c }); if (avance) avance((i + 1) / n);
    }
    for (const q of [0.7, 0.55, 0.42, 0.3]) { const b = await webpAnimado(cuadros, Math.round(1000 / fps), q, w, hh); if (b.size <= 880 * 1024) return b; }
    throw new Error('El video quedó muy pesado: probá uno más corto');
  } finally { URL.revokeObjectURL(v.src); }
}
async function elegirMiSticker() {
  const packs = await P.leerPacks(), items = [];
  for (const p of packs) for (const s of p.stickers || []) items.push({ p, s, url: await P.urlDe(p.id, s.archivo, p.v) });
  if (!items.length) { X.aviso('Todavía no tenés stickers: hacé uno con el +'); return null; }
  return new Promise((ok) => {
    const m = X.modal(`<div class="hoja hojaPega"><div class="etq" style="margin-top:0">Tus stickers</div><div class="pegaGrid" id="msG">${items.map((x, i) => `<button class="pegaOp" data-k="${i}"><img src="${x.url}" alt="" loading="lazy"></button>`).join('')}</div></div>`, { alCerrar: () => ok(null) });
    m.onclick = async (ev) => { const b = ev.target.closest('[data-k]'); if (!b) { if (ev.target === m) X.cerrarModal(); return; } const x = items[+b.dataset.k];
      try { const blob = await (await fetch(x.url)).blob(); X.E.alCerrar = null; X.cerrarModal(); ok({ blob, anim: !!x.p.animado }); } catch (e) { X.aviso('No pude abrir ese sticker'); } };
  });
}
function abrirPublicar(lista) {
  if (!cuenta()) return pedirCuenta('Entrá para publicar');
  const media = [];
  const m = X.modal(`<div class="hoja hojaPost"><h3>Nueva publicación</h3><textarea id="poTxt" class="campo" maxlength="500" rows="3" placeholder="¿Qué contás?"></textarea>
    <div class="poMedia" id="poMedia"></div>
    <div class="poBotones"><button class="sec" data-po="foto"><i data-i="galeria"></i>Foto</button><button class="sec" data-po="st"><i data-i="pegatina"></i>Sticker</button><button class="sec" data-po="video"><i data-i="video"></i>Video</button></div>
    <p class="nota">Hasta 4. Los videos van sin sonido y duran hasta 4 segundos. Lo ve toda la comunidad: nada de datos personales, y respetá a los demás.</p>
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Publicar</button></div></div>`);
  const pintar = () => { const M = X.$('#poMedia', m); M.innerHTML = media.map((x, i) => `<span class="poIt"><img src="${x.url}" alt=""><button data-q="${i}" aria-label="Sacar"><i data-i="cerrar"></i></button></span>`).join(''); X.iconos(M);
    for (const b of m.querySelectorAll('[data-po]')) b.disabled = media.length >= 4; };
  m.onclick = async (ev) => {
    const q = ev.target.closest('[data-q]'); if (q) { const x = media.splice(+q.dataset.q, 1)[0]; URL.revokeObjectURL(x.url); return pintar(); }
    const b = ev.target.closest('[data-po]');
    if (b) {
      if (media.length >= 4) return; const que = b.dataset.po;
      try {
        if (que === 'foto') { const f = await elegirArchivo('image/*'); if (!f) return; const blob = await fotoAWebP(f); media.push({ tipo: 'img', blob, url: URL.createObjectURL(blob) }); }
        else if (que === 'video') {
          const f = await elegirArchivo('video/*'); if (!f) return; b.disabled = true; const t0 = b.innerHTML; b.textContent = 'Armando… 0 %';
          try { const blob = await videoAWebP(f, (p) => { b.textContent = `Armando… ${Math.round(p * 100)} %`; }); media.push({ tipo: 'anim', blob, url: URL.createObjectURL(blob) }); } finally { b.innerHTML = t0; X.iconos(b); }
        } else { const r = await elegirMiSticker(); if (!r) return; media.push({ tipo: r.anim ? 'anim' : 'st', blob: r.blob, url: URL.createObjectURL(r.blob) }); }
        pintar();
      } catch (e) { X.aviso(e.message || 'No se pudo'); }
      return;
    }
    const x = ev.target.closest('[data-x]'); if (!x) { if (ev.target === m) X.cerrarModal(); return; }
    if (x.dataset.x === '0') return X.cerrarModal();
    const texto = X.$('#poTxt', m).value.trim(); if (!texto && !media.length) return X.aviso('Escribí algo o sumá una foto');
    x.disabled = true; x.textContent = 'Publicando…';
    try {
      const r = await api('/api/social/posts', { method: 'POST', json: { texto, media: await Promise.all(media.map(async (it) => ({ tipo: it.tipo, datos: await aB64(it.blob) }))) } });
      X.cerrarModal(); if (X.agua) X.agua(); X.aviso('¡Publicado!');
      const L = lista.querySelector('.soLista'); if (L) { const vac = L.querySelector('.vacio'); if (vac) vac.remove(); L.insertAdjacentHTML('afterbegin', postHTML(r.post)); X.iconos(L); }
    } catch (e) { x.disabled = false; x.textContent = 'Publicar'; X.aviso(e.message); }
  };
  pintar(); setTimeout(() => X.$('#poTxt', m).focus(), 300);
}

// ================= AMIGOS (el botón del perfil) =================
const TXT_AMISTAD = { nada: 'Agregar amigo', enviado: 'Pedido enviado', recibido: 'Aceptar amistad', amigos: 'Chatear' };
export const botonAmistad = (d) => (d.soyYo || !d.amistad ? '' : `<button class="pBoton amistad a_${d.amistad}" data-amistad="${d.amistad}" data-uid="${d.usuario.id}" data-nombre="${X.h(d.usuario.nombre)}"><i data-i="${d.amistad === 'amigos' ? 'globo' : 'persona'}"></i>${TXT_AMISTAD[d.amistad]}</button>`);
async function tocarAmistad(b) {
  if (!cuenta()) return pedirCuenta('Entrá para sumar amigos');
  const id = b.dataset.uid, est = b.dataset.amistad; X.vibrar(8);
  if (est === 'amigos') { const d = X.E.usuarioActual; return abrirConv({ id, nombre: b.dataset.nombre, avatar: d && d.usuario ? d.usuario.avatar : {} }); }
  if (est === 'enviado') { if (!(await X.confirmar('¿Cancelar el pedido de amistad?', 'Cancelar pedido', false))) return; }
  try {
    const r = await api(`/api/amigos/${id}`, { method: est === 'enviado' ? 'DELETE' : 'POST' }), nuevo = r.estado === 'nada' ? 'nada' : r.estado;
    b.dataset.amistad = nuevo; b.className = `pBoton amistad a_${nuevo}`; b.innerHTML = `<i data-i="${nuevo === 'amigos' ? 'globo' : 'persona'}"></i>${TXT_AMISTAD[nuevo]}`; X.iconos(b);
    X.aviso(nuevo === 'amigos' ? '¡Ahora son amigos! Ya pueden chatear' : nuevo === 'enviado' ? 'Le mandaste el pedido' : 'Listo');
    if (X.E.usuarioActual) X.E.usuarioActual.amistad = nuevo;
  } catch (e) { X.aviso(e.message); }
}

// ================= CHAT =================
export async function abrirChat() {
  if (!cuenta()) return pedirCuenta('Entrá para chatear con tus amigos');
  X.ir('vChat'); pintarChat();
}
const filaPersona = (u, extra, attrs) => `<div class="chFila" ${attrs}>${avatarHTML(u.avatar)}<span class="chTxt"><b>@${X.h(u.nombre)}</b>${extra}</span></div>`;
async function pintarChat() {
  const c = X.$('#chCont'); c.innerHTML = '<div class="tarjeta esqCab"></div><div class="tarjeta esqCab"></div>';
  let am, ch; try { [am, ch] = await Promise.all([api('/api/amigos'), api('/api/chat')]); } catch (e) { c.innerHTML = vacio('loco', 'Sin conexión', X.h(e.message)); return; }
  const ultimo = (x) => (!x.ultimo ? '<small>Todavía no hablaron</small>' : `<small>${x.ultimo.st ? 'Sticker' : X.h(x.ultimo.texto)} · ${hace(x.ultimo.cuando)}</small>`);
  c.innerHTML = (am.pedidos.length ? `<div class="etq">Te quieren de amigo</div>${am.pedidos.map((u) => filaPersona(u, '<small>Quiere ser tu amigo</small>', `data-u2="${u.id}"`).replace('</span></div>', `</span><button class="pri chSi" data-acepta="${u.id}">Aceptar</button><button class="ico chNo" data-rechaza="${u.id}" aria-label="Rechazar"><i data-i="cerrar"></i></button></div>`)).join('')}` : '')
    + '<div class="etq">Tus chats</div>' + (ch.chats.length ? ch.chats.map((x) => filaPersona(x, ultimo(x), `data-chat="${x.id}" data-nombre="${X.h(x.nombre)}" role="button" tabindex="0"`).replace('</span></div>', `</span>${x.sinLeer ? `<b class="chSinLeer">${x.sinLeer}</b>` : ''}</div>`)).join('')
      : vacio('ojitos', 'Todavía no tenés amigos', 'Entrá al perfil de alguien y tocá «Agregar amigo». Cuando acepte, pueden chatear.'))
    + (am.enviados.length ? `<div class="etq">Pedidos que mandaste</div>${am.enviados.map((u) => filaPersona(u, '<small>Esperando que acepte</small>', '')).join('')}` : '')
    + '<p class="nota chNota">Sólo podés chatear con tus amigos. Si alguien te molesta, tocá y mantené su mensaje para denunciarlo, o bloquealo desde su perfil.</p>';
  X.iconos(c); C_CHATS = ch.chats; novedades();
}
let C_CHATS = [];
document.addEventListener('click', async (ev) => {
  const am = ev.target.closest('[data-amistad]'); if (am) return tocarAmistad(am);
  if (ev.target.closest('#botonChat')) { X.vibrar(8); return abrirChat(); }
  const ac = ev.target.closest('[data-acepta],[data-rechaza]');
  if (ac) { const id = ac.dataset.acepta || ac.dataset.rechaza; try { await api(`/api/amigos/${id}`, { method: ac.dataset.acepta ? 'POST' : 'DELETE' }); X.aviso(ac.dataset.acepta ? '¡Ahora son amigos!' : 'Rechazado'); } catch (e) { X.aviso(e.message); } return pintarChat(); }
  const ch = ev.target.closest('[data-chat]'); if (ch) { const x = C_CHATS.find((y) => y.id === ch.dataset.chat); return abrirConv(x || { id: ch.dataset.chat, nombre: ch.dataset.nombre, avatar: {} }); }
});
// ---- una conversación ----
const CV = { u: null, ult: 0, reloj: 0, ids: new Set() };
export async function abrirConv(u) {
  CV.u = u; CV.ult = 0; CV.ids = new Set(); X.ir('vConv');
  X.$('#cvNombre').textContent = '@' + u.nombre; X.$('#cvAv').innerHTML = avatarHTML(u.avatar || {}); X.iconos(X.$('#cvAv'));
  X.$('#cvLista').innerHTML = '<p class="nota chNota">Los mensajes son entre ustedes dos. Si algo te molesta, mantené apretado el mensaje para denunciarlo.</p>';
  await traer(true);
  clearInterval(CV.reloj); CV.reloj = setInterval(() => { if (X.E.vista !== 'vConv') { clearInterval(CV.reloj); return; } if (!document.hidden) traer(false); }, 3500);
}
const msgHTML = (x) => {
  const st = x.st ? (x.st.tipo === 'pega' ? `<i class="pegaUI cvPega" data-pega="${X.h(x.st.id)}"></i>` : `<img class="cvSt" src="${API}/${X.h(x.st.url)}" alt="">`) : '';
  return `<div class="cvMsg${x.mio ? ' mio' : ''}${st && !x.texto ? ' soloSt' : ''}" data-msg="${x.id}">${st}${x.texto ? `<span>${X.h(x.texto)}</span>` : ''}<small>${new Date(x.creado).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</small></div>`;
};
async function traer(todo) {
  const u = CV.u; if (!u) return;
  try {
    const r = await api(`/api/chat/${u.id}${todo ? '' : '?desde=' + CV.ult}`); if (CV.u !== u) return;
    agregar(r.mensajes);
  } catch (e) { if (todo) X.aviso(e.message); }
}
function agregar(L) {
  const lista = X.$('#cvLista'), abajo = lista.scrollTop + lista.clientHeight > lista.scrollHeight - 80, nuevos = L.filter((x) => !CV.ids.has(x.id));
  if (!nuevos.length) return;
  for (const x of nuevos) { CV.ids.add(x.id); CV.ult = Math.max(CV.ult, x.id); }
  lista.insertAdjacentHTML('beforeend', nuevos.map(msgHTML).join('')); X.iconos(lista);
  if (abajo || nuevos.some((x) => x.mio)) lista.scrollTop = lista.scrollHeight;
}
async function mandar(cuerpo) {
  try { const r = await api(`/api/chat/${CV.u.id}`, { method: 'POST', json: cuerpo }); agregar([r.mensaje]); X.vibrar(6); return true; } catch (e) { X.aviso(e.message); return false; }
}
function abrirStickersChat() {
  let tab = 'pega';
  const m = X.modal(`<div class="hoja hojaPega"><div class="chips" id="csT"><button class="chip act" data-t="pega">Pegatinas</button><button class="chip" data-t="mios">Mis stickers</button></div><div class="pegaGrid" id="csG"></div></div>`);
  const pintar = async () => {
    for (const b of X.$('#csT', m).children) b.classList.toggle('act', b.dataset.t === tab);
    const G = X.$('#csG', m);
    if (tab === 'pega') { G.innerHTML = PEGATINAS.filter((p) => !p.premium).map((p) => `<button class="pegaOp" data-pega="${p.id}"><i class="pegaUI" data-pega="${p.id}"></i></button>`).join(''); X.iconos(G); return; }
    const packs = await P.leerPacks(), items = []; for (const p of packs) for (const s of p.stickers || []) items.push({ url: await P.urlDe(p.id, s.archivo, p.v) });
    G.innerHTML = items.length ? items.map((x, i) => `<button class="pegaOp" data-mio="${i}"><img src="${x.url}" alt="" loading="lazy"></button>`).join('') : '<p class="nota">Todavía no hiciste stickers.</p>'; G._items = items;
  };
  m.onclick = async (ev) => {
    const t = ev.target.closest('[data-t]'); if (t) { tab = t.dataset.t; return pintar(); }
    const pg = ev.target.closest('button[data-pega]'); if (pg) { X.cerrarModal(); return mandar({ st: { tipo: 'pega', id: pg.dataset.pega } }); }
    const mi = ev.target.closest('[data-mio]'); if (mi) { const x = X.$('#csG', m)._items[+mi.dataset.mio]; X.cerrarModal(); try { const b = await (await fetch(x.url)).blob(); if (b.size > 150 * 1024) return X.aviso('Ese sticker es muy pesado para el chat'); return mandar({ st: { tipo: 'mio', datos: await aB64(b) } }); } catch (e) { return X.aviso('No pude mandar ese sticker'); } }
    if (ev.target === m) X.cerrarModal();
  };
  pintar();
}
function menuConv() {
  const u = CV.u, m = X.modal(`<div class="hoja"><h3>@${X.h(u.nombre)}</h3><div class="lista"><button class="opc" data-a="perfil"><i data-i="persona"></i><span>Ver perfil</span></button>
    <button class="opc" data-a="quitar"><i data-i="cerrar"></i><span>Dejar de ser amigos</span></button><button class="opc" data-a="bloquear"><i data-i="bloquear"></i><span>Bloquear</span></button></div><div class="botones"><button class="sec" data-x="0">Cancelar</button></div></div>`);
  m.onclick = async (ev) => {
    const a = ev.target.closest('[data-a]'); if (!a) { if (ev.target.closest('[data-x]') || ev.target === m) X.cerrarModal(); return; }
    X.cerrarModal();
    if (a.dataset.a === 'perfil') return X.abrirUsuario(u.nombre);
    if (a.dataset.a === 'quitar') { if (!(await X.confirmar(`¿Dejar de ser amigo de @${u.nombre}? Ya no van a poder chatear.`, 'Dejar'))) return; try { await api(`/api/amigos/${u.id}`, { method: 'DELETE' }); X.aviso('Listo'); X.ir('vChat', true); pintarChat(); } catch (e) { X.aviso(e.message); } return; }
    if (!(await X.confirmar(`¿Bloquear a @${u.nombre}? No te va a poder escribir ni ver tus publicaciones.`, 'Bloquear'))) return;
    try { await api(`/api/usuarios/${u.id}/bloquear`, { method: 'POST' }); X.aviso(`Bloqueaste a @${u.nombre}`); X.ir('vChat', true); pintarChat(); } catch (e) { X.aviso(e.message); }
  };
}
// ---- los no leídos y los pedidos, en el botón de arriba (cada 30 s con la app a la vista) ----
export async function novedades() {
  const b = document.querySelector('#botonChat .badge'); if (!b) return;
  if (!cuenta()) { b.classList.add('oc'); return; }
  try { const r = await api('/api/chat/novedades'), n = (r.mensajes || 0) + (r.pedidos || 0); b.textContent = n > 9 ? '9+' : String(n); b.classList.toggle('oc', !n); } catch (e) { /* sin conexión */ }
}
export function iniciarRed(x) {
  X = x;
  const tx = X.$('#cvTxt'), enviar = async () => { const t = tx.value.trim(); if (!t) return; tx.value = ''; if (!(await mandar({ texto: t }))) tx.value = t; tx.focus(); };
  X.$('#cvMandar').onclick = enviar; tx.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); enviar(); } });
  X.$('#cvSt').onclick = () => { X.vibrar(6); abrirStickersChat(); };
  X.$('#cvMenu').onclick = () => { X.vibrar(6); menuConv(); };
  // (un toque largo sobre un mensaje del otro: denunciarlo)
  let largo = 0; const lista = X.$('#cvLista');
  lista.addEventListener('pointerdown', (ev) => { const mm = ev.target.closest('.cvMsg:not(.mio)'); if (!mm) return; clearTimeout(largo); largo = setTimeout(() => { X.vibrar(15); denunciar('¿Por qué denunciás este mensaje?', `/api/chat/mensaje/${mm.dataset.msg}/reportar`); }, 550); });
  for (const e of ['pointerup', 'pointercancel', 'pointerleave']) lista.addEventListener(e, () => clearTimeout(largo));
  novedades(); setInterval(() => { if (!document.hidden) novedades(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) novedades(); });
}
