// La comunidad: el feed (Para vos, Recién salidos, Seguidos), los packs publicados, los perfiles, publicar tus packs y
// bajar los de otros. Habla con el servidor (servidor/worker.js). Sin conexión, la app sigue andando igual.
import { abrirTermo } from './termo.js';
import * as P from './puente.js';
export const API = (typeof window !== 'undefined' && window.SZ_API) || 'https://rezobox-tienda.holasoyjuniors365.workers.dev/sz';
let X = null; // lo que presta app.js (pantallas, hojas, avisos…)
const MOTIVOS = [['ofensivo', 'Es ofensivo o discrimina'], ['sexual', 'Contenido sexual'], ['violencia', 'Violencia'], ['spam', 'Spam o engaño'], ['otro', 'Otra cosa']];
const ETIQUETAS = ['jaja', 'mate', 'futbol', 'asado', 'amor', 'laburo', 'memes', 'familia', 'amigos', 'animados', 'argentina', 'perros', 'gatos', 'facultad'];

// ---- la cuenta (una llave en el celular; nada de email) ----
const CLAVE = 'sz_cuenta';
export function cuenta() { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } }
function guardarCuenta(c) { try { if (c) localStorage.setItem(CLAVE, JSON.stringify(c)); else localStorage.removeItem(CLAVE); } catch (e) { /* sin lugar */ } }
export async function api(ruta, o = {}) {
  const c = cuenta(), h = { ...(o.headers || {}) };
  if (c) h.Authorization = 'Bearer ' + c.token;
  let body = o.body; if (o.json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(o.json); }
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), o.tiempo || 20000);
  let r;
  try { r = await fetch(API + ruta, { method: o.method || 'GET', headers: h, body, signal: ctrl.signal }); }
  catch (e) { const er = new Error('Uh, no hay conexión. Probá de nuevo en un toque.'); er.red = true; throw er; }
  finally { clearTimeout(t); }
  let j = {}; try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
  if (!r.ok) { const er = new Error(j.error || 'Algo salió mal'); er.st = r.status; throw er; }
  return j;
}
export const media = (pk, a) => `${API}/m/${pk.id}/${encodeURIComponent(a)}?v=${pk.v}`;
export const enlace = (id) => `${API}/p/${id}`;
const hace = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'recién' : s < 3600 ? `hace ${Math.floor(s / 60)} min` : s < 86400 ? `hace ${Math.floor(s / 3600)} h` : s < 86400 * 30 ? `hace ${Math.floor(s / 86400)} d` : new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }); };
const num = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + ' M' : n >= 1e4 ? Math.round(n / 1e3) + ' mil' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + ' mil' : String(n));
// (con su foto si subió una; si no, el emoji sobre su color)
const caraDe = (a) => (a.f ? `<img src="${API}/${X.h(a.f)}" alt="" loading="lazy">` : X.h(a.e));
const avatar = (a, clase = 'av') => `<span class="${clase}${a.f ? ' conFoto' : ''}" style="background:${X.h(a.c)}">${caraDe(a)}</span>`;

// ================= FEED =================
const F = { modo: 'para-vos', desde: 0, cargando: false, fin: false, cache: new Map() };
const esqueletos = (n) => Array.from({ length: n }, () => '<div class="tf esq"><div class="esqCab"></div><div class="esqGrilla"></div><div class="esqPie"></div></div>').join('');
function tarjeta(p, i) {
  F.cache.set(p.id, p);
  const tono = [...p.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 0);
  return `<article class="tf" data-id="${p.id}" style="--i:${i % 8};--tono:${tono}">
    <header><button class="autor" data-u="${X.h(p.autor.nombre)}">${avatar(p.autor.avatar)}<span><b>@${X.h(p.autor.nombre)}</b><small>${hace(p.creado)}</small></span></button>${p.termo ? '<b class="insignia termo">🧉 Elegido del termo</b>' : ''}${p.privado ? '<b class="insignia oculta">🙈 Oculto</b>' : ''}${p.animado ? '<b class="insignia">Animado</b>' : ''}</header>
    <div class="tfGrilla" data-abrir="${p.id}">${p.muestra.slice(0, 6).map((a) => `<img loading="lazy" src="${media(p, a)}" alt="">`).join('')}</div>
    <div class="tfPie"><div class="tfNom"><b>${X.h(p.nombre)}</b><small>${p.n} stickers${p.tags.length ? ' · ' + p.tags.slice(0, 3).map((t) => '#' + X.h(t)).join(' ') : ''}</small></div>
      <button class="accion mg${p.yaLike ? ' si' : ''}" data-like="${p.id}" aria-label="Me gusta"><i data-i="corazon"></i><span>${num(p.likes)}</span></button>
      <button class="accion" data-abrir="${p.id}" aria-label="Agregar"><i data-i="bajar"></i><span>${num(p.descargas)}</span></button>
      <button class="accion" data-compartir="${p.id}" aria-label="Compartir"><i data-i="compartir"></i></button></div>
  </article>`;
}
const vacioFeed = (modo) => modo === 'siguiendo'
  ? '<div class="vacio"><div class="vacioIco">👀</div><b>Todavía no seguís a nadie</b><span>Pegate una vuelta por «Para vos» y seguí a los que más te copen.</span></div>'
  : '<div class="vacio"><div class="vacioIco">🧉</div><b>Está todo muy tranqui</b><span>Todavía no hay packs acá. ¡Publicá el primero y arrancá vos!</span></div>';
function sinConexion(e) {
  return `<div class="vacio"><div class="vacioIco">📡</div><b>${e && e.red ? 'Sin conexión con la comunidad' : 'Se nos complicó'}</b><span>${X.h(e ? e.message : '')}</span><button class="pri" data-reintentar="1">Reintentar</button></div>
    <h2>Mientras tanto <small>· packs listos</small></h2><div class="carrusel" id="feedListos"></div>`;
}
// (los packs que no te interesan: se guardan en el celular y no se muestran más)
const noInteresa = () => { try { return new Set(JSON.parse(localStorage.getItem('sz_noint') || '[]')); } catch (e) { return new Set(); } };
function marcarNoInteresa(id) { const s = noInteresa(); s.add(id); try { localStorage.setItem('sz_noint', JSON.stringify([...s].slice(-500))); } catch (e) { /* nada */ } }
export async function cargarFeed(reiniciar) {
  const lista = X.$('#feedLista');
  if (reiniciar) { F.desde = 0; F.fin = false; lista.innerHTML = esqueletos(3); F.turno = (F.turno || 0) + 1; }
  if (F.cargando && !reiniciar) return; if (F.fin) return;
  const turno = F.turno; F.cargando = true;
  try {
    const r = await api(`/api/feed?modo=${F.modo}&desde=${F.desde}`);
    if (turno !== F.turno) return;
    if (reiniciar || !F.desde) lista.innerHTML = '';
    if (r.necesitaCuenta) lista.innerHTML = '<div class="vacio"><div class="vacioIco">🙋</div><b>Entrá a la comunidad</b><span>Así ves lo nuevo de los que seguís.</span><button class="pri" data-ir-perfil="1">Elegir mi @</button></div>';
    else if (!r.packs.length && !F.desde) lista.innerHTML = vacioFeed(F.modo);
    const fuera = noInteresa(); lista.insertAdjacentHTML('beforeend', r.packs.filter((p) => !fuera.has(p.id)).map((p, i) => tarjeta(p, i)).join(''));
    F.desde = r.sigue ?? F.desde; F.fin = r.sigue == null; X.iconos(lista);
  } catch (e) {
    if (turno !== F.turno) return;
    if (!F.desde) { lista.innerHTML = sinConexion(e); X.carruselListos(X.$('#feedListos')); }
  } finally { if (turno === F.turno) F.cargando = false; }
}
function corazon(sobre, x, y) {
  const c = document.createElement('div'); c.className = 'boom'; c.textContent = '❤️';
  const r = sobre.getBoundingClientRect(); c.style.left = (x ?? r.width / 2) + 'px'; c.style.top = (y ?? r.height / 2) + 'px';
  sobre.appendChild(c); setTimeout(() => c.remove(), 900);
}
async function darLike(id, boton, forzar) {
  if (!cuenta()) return pedirCuenta('Para dar me gusta, elegí tu @');
  const si = forzar ?? !boton.classList.contains('si'), sp = boton.querySelector('span'), n0 = parseInt(sp.textContent) || 0;
  boton.classList.toggle('si', si); boton.classList.remove('late'); void boton.offsetWidth; if (si) boton.classList.add('late');
  if (!/mil|M/.test(sp.textContent)) sp.textContent = String(Math.max(0, n0 + (si ? 1 : -1)));
  X.vibrar(si ? 15 : 8);
  try { const r = await api(`/api/packs/${id}/like`, { method: si ? 'POST' : 'DELETE' }); sp.textContent = num(r.likes); const p = F.cache.get(id); if (p) { p.likes = r.likes; p.yaLike = si; } }
  catch (e) { boton.classList.toggle('si', !si); sp.textContent = num(n0); X.aviso(e.message); }
}
let toqueGrilla = null;
function alTocarFeed(ev) {
  const t = ev.target;
  const like = t.closest('[data-like]'); if (like) return darLike(like.dataset.like, like);
  const comp = t.closest('[data-compartir]'); if (comp) return compartirPack(F.cache.get(comp.dataset.compartir));
  const au = t.closest('[data-u]'); if (au) return abrirUsuario(au.dataset.u);
  if (t.closest('[data-reintentar]')) return cargarFeed(true);
  if (t.closest('[data-ir-perfil]')) return X.pestaña('Perfil');
  const g = t.closest('.tfGrilla');
  if (g) {
    // (doble toque: me gusta, con un corazón; un toque: abre el pack)
    const id = g.dataset.abrir, ahora = performance.now();
    if (toqueGrilla && toqueGrilla.id === id && ahora - toqueGrilla.t < 320) {
      clearTimeout(toqueGrilla.timer); toqueGrilla = null;
      const r = g.getBoundingClientRect(); corazon(g, ev.clientX - r.left, ev.clientY - r.top);
      const b = g.closest('.tf').querySelector('[data-like]'); if (!b.classList.contains('si')) darLike(id, b, true);
      return;
    }
    if (toqueGrilla) clearTimeout(toqueGrilla.timer);
    toqueGrilla = { id, t: ahora, timer: setTimeout(() => { toqueGrilla = null; abrirPublico(id); }, 330) };
    return;
  }
  const ab = t.closest('[data-abrir]'); if (ab) return abrirPublico(ab.dataset.abrir);
}

// ================= UN PACK PUBLICADO =================
let actual = null;
export async function abrirPublico(id) {
  X.E.origenPublico = X.E.vista === 'vPublico' ? X.E.origenPublico : X.E.vista;
  const c = X.$('#puCont'); c.innerHTML = '<div class="tf esq"><div class="esqCab"></div><div class="esqGrilla alto"></div></div>'; X.$('#puNombre').textContent = '';
  X.ir('vPublico');
  try {
    const { pack: p } = await api('/api/packs/' + id); actual = p; F.cache.set(p.id, p);
    X.$('#puNombre').textContent = p.nombre;
    c.innerHTML = `<div class="puAutor"><button class="autor" data-u="${X.h(p.autor.nombre)}">${avatar(p.autor.avatar)}<span><b>@${X.h(p.autor.nombre)}</b><small>${hace(p.creado)}</small></span></button>
        ${p.esMio ? '<b class="insignia">Tuyo</b>' : `<button class="seguir${p.sigoAutor ? ' si' : ''}" data-seguir="${p.autor.id}">${p.sigoAutor ? 'Siguiendo' : 'Seguir'}</button>`}</div>
      ${p.tags.length || p.animado ? `<div class="chips tagsPu">${p.animado ? '<b class="insignia">Animado</b>' : ''}${p.tags.map((t) => `<button class="chip" data-tag="${X.h(t)}">#${X.h(t)}</button>`).join('')}</div>` : ''}
      <div class="grilla puGrilla">${p.stickers.map((s, i) => `<div class="st" style="--i:${i % 12}"><img src="${media(p, s.archivo)}" alt=""></div>`).join('')}</div>
      <p class="ayuda puStats">❤️ ${num(p.likes)} · ⬇️ ${num(p.descargas)} · ${p.n} stickers</p>`;
    X.iconos(c);
    pintarLike();
  } catch (e) { c.innerHTML = sinConexion(e).replace(/<h2>[\s\S]*$/, ''); }
}
function pintarLike() { const b = X.$('#puLike'); if (!actual) return; b.classList.toggle('si', !!actual.yaLike); X.$('span', b).textContent = actual.yaLike ? 'Te gusta' : 'Me gusta'; }
// bajar un pack publicado a «Mis packs» (si ya estaba, se actualiza): devuelve el pack local
export async function bajarPack(p, avisar = true) {
  const packs = await P.leerPacks(); let local = packs.find((x) => x.origen && x.origen.id === p.id);
  if (local && local.origen.v === p.v) return local;
  const id = local ? local.id : 'd' + p.id, archivos = [...p.stickers.map((s) => s.archivo), p.bandeja];
  for (const a of archivos) {
    const r = await fetch(media(p, a)); if (!r.ok) throw new Error('No pude bajar el pack');
    await P.guardarArchivo(id, a, await r.blob());
  }
  const datos = { id, nombre: p.nombre, autor: '@' + p.autor.nombre, animado: p.animado, stickers: p.stickers.map((s) => ({ archivo: s.archivo, emojis: s.emojis })), bandeja: p.bandeja, n: p.stickers.length, mod: Date.now(), origen: { id: p.id, v: p.v, autor: p.autor.nombre } };
  if (local) { Object.assign(local, datos); local.v = (local.v || 0) + 1; } else { local = { ...datos, v: 1, creado: Date.now() }; packs.push(local); }
  await P.guardarPacks(packs); X.E.packs = packs;
  api(`/api/packs/${p.id}/descarga`, { method: 'POST' }).catch(() => {});
  if (avisar) X.aviso('Guardado en Mis packs');
  return local;
}
async function agregarPublico() {
  if (!actual) return; const b = X.$('#puWhats'), txt = X.$('span', b).textContent;
  b.disabled = true; X.$('span', b).textContent = 'Bajando…';
  try {
    const local = await bajarPack(actual, false); X.vibrar(12);
    const r = await P.agregarAWhatsApp(local);
    if (r === 'ok') { X.confeti(); X.aviso('¡Listo! Ya lo tenés en WhatsApp'); }
    else if (r === 'sin_app') X.aviso('Guardado en Mis packs. A WhatsApp se agrega desde la app del celular', 4000);
    else if (r === 'sin_whatsapp') X.aviso('No encontré WhatsApp en este celular');
    else if (r !== 'cancelado') X.aviso('WhatsApp no lo aceptó: ' + r);
  } catch (e) { X.aviso(e.message); }
  b.disabled = false; X.$('span', b).textContent = txt;
}
export async function compartirPack(p) {
  if (!p) return; X.vibrar(8);
  if (await P.compartir(`Mirá «${p.nombre}», un pack de stickers de @${p.autor.nombre} 🔥 Agregalo a tu WhatsApp:`, enlace(p.id))) { if (!P.esApp && !navigator.share) X.aviso('Copié el enlace'); }
}
function menuPublico() {
  if (!actual) return;
  const m = X.modal(`<div class="hoja"><h3>${X.h(actual.nombre)}</h3><div class="lista">
    <button class="opc" data-x="guardar"><i data-i="bajar"></i><span>Guardar en Mis packs</span></button>
    ${actual.esMio ? `<button class="opc" data-x="privado"><i data-i="${actual.privado ? 'ok' : 'bloquear'}"></i><span>${actual.privado ? 'Mostrarlo otra vez en la comunidad' : 'Ocultarlo de la comunidad'}</span></button><button class="opc peligro" data-x="borrarPub"><i data-i="tacho"></i><span>Sacarlo de la comunidad</span></button>`
      : `<button class="opc" data-x="nointeresa"><i data-i="bloquear"></i><span>No me interesa</span></button>`}${actual.esMio ? '' : `<button class="opc peligro" data-x="reportar"><i data-i="bandera"></i><span>Denunciar el pack</span></button><button class="opc peligro" data-x="bloquear"><i data-i="bloquear"></i><span>Bloquear a @${X.h(actual.autor.nombre)}</span></button>`}</div></div>`);
  X.$('.lista', m).onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return; const x = b.dataset.x; X.cerrarModal();
    if (x === 'guardar') { try { await bajarPack(actual); } catch (e) { X.aviso(e.message); } }
    else if (x === 'reportar') denunciar(actual);
    else if (x === 'nointeresa') { marcarNoInteresa(actual.id); X.aviso('Listo, no te lo mostramos más'); X.atras(); const t = X.$(`#feedLista .tf[data-id="${actual.id}"]`); if (t) t.remove(); }
    else if (x === 'privado') {
      try { const r = await api(`/api/packs/${actual.id}/privado`, { method: 'POST', json: { privado: !actual.privado } }); actual.privado = r.privado; X.aviso(r.privado ? '🙈 Oculto: sólo lo ves vos' : '¡Listo! Se ve otra vez en la comunidad'); X.vibrar(12); } catch (e) { X.aviso(e.message); }
    }
    else if (x === 'borrarPub') {
      if (!(await X.confirmar('¿Sacarlo de la comunidad? Se borra del servidor (los me gusta y descargas también). En tu celular queda igual.', 'Sacarlo'))) return;
      try { await api(`/api/packs/${actual.id}`, { method: 'DELETE' }); const packs = await P.leerPacks(); for (const p of packs) if (p.publicado && p.publicado.id === actual.id) delete p.publicado; await P.guardarPacks(packs); X.aviso('Lo sacamos de la comunidad'); X.atras(); cargarFeed(true); } catch (e) { X.aviso(e.message); }
    }
    else if (x === 'bloquear') bloquear(actual.autor);
  };
}
function denunciar(p) {
  if (!cuenta()) return pedirCuenta('Para denunciar, elegí tu @');
  const m = X.modal(`<div class="hoja"><h3>¿Qué pasa con este pack?</h3><p>Lo revisamos. Con varias denuncias se oculta solo mientras tanto.</p><div class="lista">${MOTIVOS.map(([k, t]) => `<button class="opc" data-m="${k}"><span>${t}</span></button>`).join('')}</div></div>`);
  X.$('.lista', m).onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return; X.cerrarModal();
    try { await api(`/api/packs/${p.id}/reportar`, { method: 'POST', json: { motivo: b.dataset.m } }); X.aviso('Gracias. Lo vamos a revisar 🙏'); } catch (e) { X.aviso(e.message); }
  };
}
async function bloquear(autor) {
  if (!cuenta()) return pedirCuenta('Para bloquear, elegí tu @');
  if (!(await X.confirmar(`¿Bloquear a @${autor.nombre}? No vas a ver más sus packs.`, 'Bloquear'))) return;
  try { await api(`/api/usuarios/${autor.id}/bloquear`, { method: 'POST' }); X.aviso(`Bloqueaste a @${autor.nombre}`); X.atras(); cargarFeed(true); } catch (e) { X.aviso(e.message); }
}
async function seguir(boton) {
  if (!cuenta()) return pedirCuenta('Para seguir gente, elegí tu @');
  const si = !boton.classList.contains('si'); boton.classList.toggle('si', si); boton.textContent = si ? 'Siguiendo' : 'Seguir'; X.vibrar(10);
  try { const r = await api(`/api/usuarios/${boton.dataset.seguir}/seguir`, { method: si ? 'POST' : 'DELETE' }); const s = X.$('#usCont .segN'); if (s && X.E.vista === 'vUsuario') s.textContent = num(r.seguidores); }
  catch (e) { boton.classList.toggle('si', !si); boton.textContent = !si ? 'Siguiendo' : 'Seguir'; X.aviso(e.message); }
}

// ================= PERFILES =================
// las portadas: degradés y los banners del inicio (el número viaja con el avatar)
export const PORTADAS = ['linear-gradient(135deg,#ff3e8a,#ff8a1a)', 'linear-gradient(135deg,#7c4dff,#ff3e8a)', 'linear-gradient(135deg,#00c9a7,#3ec7ff)',
  'linear-gradient(135deg,#ffd23f,#ff7a1a)', 'linear-gradient(135deg,#1d1b2b,#3a2c6b)', "url('banners/xd.webp') center/cover", "url('banners/latam.webp') center/cover", "url('banners/pack.webp') center/cover"];
const portadaDe = (u) => (u.avatar && u.avatar.b ? `url('${API}/${u.avatar.b}') center/cover` : PORTADAS[(u.avatar && u.avatar.p) || 0] || PORTADAS[0]);
function perfilHTML(d, propio) {
  const u = d.usuario, botones = propio ? '<button class="pBoton" data-editar="1"><i data-i="lapiz"></i>Editar perfil</button>'
    : d.soyYo ? '' : `<button class="seguir pBoton${d.sigo ? ' si' : ''}" data-seguir="${u.id}">${d.sigo ? 'Siguiendo' : 'Seguir'}</button>`;
  // (en la portada flotan algunos de sus stickers)
  const flotan = d.packs.filter((p) => !p.privado).flatMap((p) => p.muestra.slice(0, 2).map((a) => media(p, a))).slice(0, 4);
  return `<div class="perfilTop"><div class="portadaP" style="background:${portadaDe(u)}"><i class="brilloP"></i>${flotan.map((f, k) => `<img class="flotaP" src="${f}" alt="" style="--k:${k}">`).join('')}</div>
    <div class="perfilFila"><span class="avG anilloAv${u.avatar.f ? ' conFoto' : ''}" style="background:${X.h(u.avatar.c)}">${caraDe(u.avatar)}</span><div class="pBotones">${botones}<button class="pBoton ico2" data-compartir-u="${X.h(u.nombre)}" aria-label="Compartir perfil"><i data-i="compartir"></i></button></div></div>
    <h2 class="arroba">@${X.h(u.nombre)}</h2>${(u.insignias || []).includes('termo') ? '<span class="chipInsignia">🧉 Elegido del termo</span>' : ''}${u.bio ? `<p class="bio">${X.h(u.bio)}</p>` : propio ? '<p class="bio vacia">Tocá «Editar perfil» y contá algo de vos</p>' : ''}
    <div class="stats"><span><b data-cuenta="${u.packs}">${num(u.packs)}</b>packs</span><span><b class="segN" data-cuenta="${u.seguidores}">${num(u.seguidores)}</b>seguidores</span><span><b data-cuenta="${u.descargas}">${num(u.descargas)}</b>descargas</span><span><b data-cuenta="${u.likes}">${num(u.likes)}</b>me gusta</span></div></div>
    ${propio ? '<div class="seg perfilSeg"><button data-pt="pub" class="act">Publicados</button><button data-pt="bajados">Bajados</button></div>' : '<h2>Packs</h2>'}
    <div class="feedLista" id="${propio ? 'perfilLista' : 'usLista'}">${listaPublicados(d, propio)}</div>`;
}
const listaPublicados = (d, propio) => d.packs.length ? d.packs.map((p, i) => tarjeta(p, i)).join('') : `<div class="vacio"><span>${propio ? 'Todavía no publicaste nada. Abrí un pack tuyo y tocá «Publicar en la comunidad».' : 'Todavía no publicó nada.'}</span></div>`;
// (los packs que bajaste de la comunidad: están en tu celular)
async function listaBajados() {
  const packs = (X.E.packs = await P.leerPacks()).filter((p) => p.origen);
  if (!packs.length) return '<div class="vacio"><span>Todavía no bajaste ningún pack de la comunidad. Mirá el inicio y tocá uno que te guste.</span></div>';
  const tiras = await Promise.all(packs.map((p) => Promise.all(p.stickers.slice(0, 4).map((s) => P.urlDe(p.id, s.archivo, p.v)))));
  return packs.map((p, i) => `<button class="packItem" data-mio="${X.h(p.id)}"><span class="tira">${tiras[i].map((u) => `<img src="${u}" alt="">`).join('')}</span><span class="pnom"><b>${X.h(p.nombre)}</b><small>${p.stickers.length} stickers · de ${X.h(p.autor || '')}</small></span></button>`).join('');
}
async function compartirPerfil(nombre) {
  X.vibrar(8);
  if (await P.compartir(`Seguime en Stickerazo: @${nombre} 🔥 Hago stickers y memes para WhatsApp`, API + '/')) { if (!P.esApp && !navigator.share) X.aviso('Copié el enlace'); }
}
function contar(raiz) {
  for (const b of raiz.querySelectorAll('[data-cuenta]')) {
    const fin = +b.dataset.cuenta; if (!(fin > 0 && fin < 10000)) continue; const t0 = performance.now();
    const paso = (t) => { const k = Math.min(1, (t - t0) / 900); b.textContent = Math.round(fin * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(paso); }; requestAnimationFrame(paso);
  }
}
export async function abrirUsuario(nombre) {
  if (cuenta() && cuenta().nombre === nombre) return X.pestaña('Perfil');
  X.E.origenUsuario = X.E.vista === 'vUsuario' ? X.E.origenUsuario : X.E.vista;
  const c = X.$('#usCont'); c.innerHTML = '<div class="heroe"><span class="avG esq"></span></div>'; X.$('#usNombre').textContent = '@' + nombre; X.ir('vUsuario');
  try { const d = await api('/api/usuarios/' + encodeURIComponent(nombre)); X.E.usuarioActual = d; c.innerHTML = perfilHTML(d, false); X.iconos(c); contar(c); }
  catch (e) { c.innerHTML = sinConexion(e).replace(/<h2>[\s\S]*$/, ''); }
}

// ---- mi perfil (o elegir mi @) ----
export async function pintarPerfil() {
  const c = X.$('#tabPerfil'), yo = cuenta();
  if (!yo) {
    c.innerHTML = `<div class="bienvenida"><div class="burbujas"><span>🧉</span><span>😂</span><span>🔥</span><span>⚽</span></div><h2 class="titulo2">Sumate a la comunidad</h2>
      <p>Publicá tus packs, seguí a los que más te copen y bajate los mejores stickers del país. Sin email y sin vueltas.</p>
      <div class="arrobaCampo"><span>@</span><input id="regNombre" maxlength="20" placeholder="como te dicen" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
      <p class="nota" id="regNota">De 3 a 20 letras minúsculas, números, punto o guion bajo.</p>
      <button class="grande" id="regEntrar"><i data-i="ok"></i>Entrar</button>
      <p class="nota">Al entrar aceptás las <a href="${API}/terminos" data-ext="1">reglas de la comunidad</a> y la <a href="${API}/privacidad" data-ext="1">privacidad</a>. Tenés que tener 13 años o más.</p>
      <p class="hecho">Hecho en Argentina 🇦🇷</p></div>`;
    X.iconos(c);
    const inp = X.$('#regNombre'), nota = X.$('#regNota');
    inp.oninput = () => { inp.value = inp.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''); const okk = /^[a-z0-9_.]{3,20}$/.test(inp.value) && !/^[._]|[._]$|\.\./.test(inp.value); nota.classList.toggle('mal', !okk && inp.value.length > 0); nota.textContent = !inp.value ? 'De 3 a 20 letras minúsculas, números, punto o guion bajo.' : okk ? `Vas a ser @${inp.value}` : 'De 3 a 20 letras minúsculas, números, punto o guion bajo.'; };
    X.$('#regEntrar').onclick = async () => {
      const b = X.$('#regEntrar'); b.disabled = true;
      try { const r = await api('/api/registro', { method: 'POST', json: { nombre: inp.value } }); guardarCuenta({ token: r.token, id: r.usuario.id, nombre: r.usuario.nombre }); X.confeti(); X.vibrar(20); X.aviso(`¡Bienvenido/a, @${r.usuario.nombre}!`); pintarPerfil(); }
      catch (e) { nota.textContent = e.message; nota.classList.add('mal'); b.disabled = false; }
    };
    return;
  }
  c.innerHTML = '<div class="heroe"><span class="avG esq"></span></div>';
  try {
    const d = await api('/api/usuarios/' + encodeURIComponent(yo.nombre)); X.E.miPerfil = d;
    const pais = X.paisActual();
    c.innerHTML = perfilHTML(d, true) + `<h2>Ajustes</h2><div class="lista ajustes"><button class="opc" data-x="tema"><i class="emo">${{ oscuro: '🌙', claro: '☀️', auto: '📱' }[X.temaActual()]}</i><span>Modo: ${{ oscuro: 'oscuro', claro: 'claro', auto: 'como el celular' }[X.temaActual()]}</span></button><button class="opc" data-x="musica"><i class="emo">🎵</i><span>Música de mi país</span></button><button class="opc" data-x="pais"><i class="emo">${pais ? pais[1] : '🌎'}</i><span>Mi país: ${pais ? pais[2] : 'elegir'}</span></button><a class="opc" href="${API}/terminos" data-ext="1"><i data-i="bandera"></i><span>Reglas de la comunidad</span></a><a class="opc" href="${API}/privacidad" data-ext="1"><i data-i="candado"></i><span>Privacidad</span></a>
      <button class="opc" data-x="salir"><i data-i="atras"></i><span>Salir de esta cuenta</span></button><button class="opc peligro" data-x="borrar"><i data-i="tacho"></i><span>Borrar mi cuenta</span></button></div><p class="hecho">Hecho en Argentina 🇦🇷</p>`;
    X.iconos(c); contar(c);
  } catch (e) {
    if (e.st === 404 || e.st === 401) { guardarCuenta(null); return pintarPerfil(); }
    c.innerHTML = sinConexion(e).replace(/<h2>[\s\S]*$/, '');
  }
}
// (una imagen del celular recortada al medio y achicada: la foto, cuadrada; la portada, 3 a 1)
async function recortarImagen(archivo, ancho, alto, maxBytes) {
  const bmp = await createImageBitmap(archivo), r = Math.max(ancho / bmp.width, alto / bmp.height), w = bmp.width * r, h = bmp.height * r;
  const c = document.createElement('canvas'); c.width = ancho; c.height = alto; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, (ancho - w) / 2, (alto - h) / 2, w, h);
  for (const q of [0.86, 0.78, 0.7, 0.6, 0.5]) { const b = await new Promise((ok) => c.toBlob(ok, 'image/webp', q)); if (b && b.size <= maxBytes) return { blob: b, url: URL.createObjectURL(b) }; }
  throw new Error('No pude achicar esa imagen');
}
const elegirArchivo = () => new Promise((ok) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => ok(i.files[0] || null); i.click(); });
function editarPerfil() {
  const d = X.E.miPerfil; if (!d) return; const u = d.usuario, sel = { ...u.avatar };
  const EMOJIS = ['😎', '🧉', '🤠', '😜', '🥳', '🤩', '😺', '🐶', '🦊', '🐸', '👽', '🤖', '💀', '🔥', '⚽', '🎸', '🍕', '🌈', '🦄', '🐧'];
  const COLS = ['#ff3e8a', '#ffd23f', '#3ec7ff', '#4cd964', '#ff7a1a', '#9b5cff', '#2c2840', '#74acdf'];
  // (lo nuevo que elige: se sube recién al guardar)
  const nuevo = { foto: null, portada: null, quitarFoto: false, quitarPortada: false };
  sel.p = sel.p || 0;
  const m = X.modal(`<div class="hoja"><h3>Tu perfil</h3><div class="prevAv" id="epPrev"><span class="avG" id="epAv"></span></div>
    <div class="etq">Foto de perfil</div><div class="dos"><button class="sec" id="epFoto"><i data-i="galeria"></i>Elegir foto</button><button class="sec" id="epSinFoto">😎 Usar emoji</button></div>
    <div class="etq">Emoji</div><div class="emojis" id="epE">${EMOJIS.map((e) => `<button data-v="${e}">${e}</button>`).join('')}</div>
    <div class="etq">Color</div><div class="colores" id="epC">${COLS.map((c) => `<button class="color" data-v="${c}" style="background:${c}"></button>`).join('')}</div>
    <div class="etq">Portada</div><div class="portadas" id="epP"><button class="subirP" id="epPortada" aria-label="Elegir una imagen">📷<small>Tu imagen</small></button>${PORTADAS.map((f, i) => `<button data-v="${i}" style="background:${f}" aria-label="Portada ${i + 1}"></button>`).join('')}</div>
    <div class="etq">Bio</div><input id="epBio" class="campo" maxlength="120" placeholder="Contá algo de vos (opcional)">
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Guardar</button></div></div>`);
  X.$('#epBio', m).value = u.bio || '';
  const fotoActual = () => (nuevo.foto ? nuevo.foto.url : !nuevo.quitarFoto && sel.f ? `${API}/${sel.f}` : null);
  const portadaActual = () => (nuevo.portada ? `url('${nuevo.portada.url}') center/cover` : !nuevo.quitarPortada && sel.b ? `url('${API}/${sel.b}') center/cover` : PORTADAS[sel.p]);
  const marcar = () => {
    const av = X.$('#epAv', m), f = fotoActual(); av.classList.toggle('conFoto', !!f); av.innerHTML = f ? `<img src="${f}" alt="">` : X.h(sel.e); av.style.background = sel.c;
    X.$('#epPrev', m).style.background = portadaActual();
    for (const b of X.$('#epE', m).children) b.classList.toggle('act', !f && b.dataset.v === sel.e);
    for (const b of X.$('#epC', m).children) b.classList.toggle('act', b.dataset.v === sel.c);
    const urlP = nuevo.portada ? nuevo.portada.url : !nuevo.quitarPortada && sel.b ? `${API}/${sel.b}` : null, propia = !!urlP, pt = X.$('#epPortada', m);
    pt.classList.toggle('act', propia); pt.classList.toggle('conImg', propia); pt.style.backgroundImage = propia ? `url('${urlP}')` : '';
    for (const b of X.$('#epP', m).querySelectorAll('[data-v]')) b.classList.toggle('act', !propia && +b.dataset.v === sel.p);
  };
  X.$('#epFoto', m).onclick = async () => {
    const a = await elegirArchivo(); if (!a) return;
    try { nuevo.foto = await recortarImagen(a, 400, 400, 190 * 1024); nuevo.quitarFoto = false; X.vibrar(10); marcar(); } catch (e) { X.aviso('No pude abrir esa imagen'); }
  };
  X.$('#epSinFoto', m).onclick = () => { nuevo.foto = null; nuevo.quitarFoto = true; marcar(); };
  X.$('#epPortada', m).onclick = async () => {
    const a = await elegirArchivo(); if (!a) return;
    try { nuevo.portada = await recortarImagen(a, 1200, 560, 380 * 1024); nuevo.quitarPortada = false; X.vibrar(10); marcar(); } catch (e) { X.aviso('No pude abrir esa imagen'); }
  };
  X.$('#epE', m).onclick = (ev) => { const b = ev.target.closest('button'); if (b) { sel.e = b.dataset.v; if (sel.f || nuevo.foto) { nuevo.foto = null; nuevo.quitarFoto = true; } marcar(); } };
  X.$('#epC', m).onclick = (ev) => { const b = ev.target.closest('button'); if (b) { sel.c = b.dataset.v; marcar(); } };
  X.$('#epP', m).onclick = (ev) => { const b = ev.target.closest('[data-v]'); if (b) { sel.p = +b.dataset.v; nuevo.portada = null; if (sel.b) nuevo.quitarPortada = true; marcar(); } };
  m.querySelector('[data-x="0"]').onclick = () => X.cerrarModal();
  m.querySelector('[data-x="1"]').onclick = async () => {
    const boton = m.querySelector('[data-x="1"]'); boton.disabled = true; boton.textContent = 'Guardando…';
    try {
      const subir = async (que, b) => { const r = await fetch(`${API}/api/yo/${que}`, { method: 'PUT', headers: { 'Content-Type': 'image/webp', Authorization: 'Bearer ' + cuenta().token }, body: b }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'No se pudo subir'); };
      if (nuevo.foto) await subir('foto', nuevo.foto.blob);
      if (nuevo.portada) await subir('portada', nuevo.portada.blob);
      await api('/api/yo', { method: 'PATCH', json: { bio: X.$('#epBio', m).value, avatar: { e: sel.e, c: sel.c, p: sel.p, quitarFoto: nuevo.quitarFoto && !nuevo.foto, quitarPortada: nuevo.quitarPortada && !nuevo.portada } } });
      X.cerrarModal(); X.aviso('¡Joya! Quedó tu perfil'); pintarPerfil();
    } catch (e) { X.aviso(e.message); boton.disabled = false; boton.textContent = 'Guardar'; }
  };
  marcar();
}
async function alTocarPerfil(ev) {
  const t = ev.target;
  if (t.closest('[data-editar]')) return editarPerfil();
  const cu = t.closest('[data-compartir-u]'); if (cu) return compartirPerfil(cu.dataset.compartirU);
  const pt = t.closest('[data-pt]');
  if (pt) {
    for (const b of pt.parentElement.children) b.classList.toggle('act', b === pt); X.vibrar(6);
    const l = X.$('#perfilLista'); l.classList.remove('aparece'); void l.offsetWidth; l.classList.add('aparece');
    l.innerHTML = pt.dataset.pt === 'pub' ? listaPublicados(X.E.miPerfil, true) : await listaBajados(); X.iconos(l); return;
  }
  const mio = t.closest('[data-mio]'); if (mio) { X.E.packId = mio.dataset.mio; return X.ir('vPack'); }
  const x = t.closest('[data-x]');
  if (x && x.dataset.x === 'pais') return X.elegirPais(() => pintarPerfil());
  if (x && x.dataset.x === 'tema') return X.elegirTema(() => pintarPerfil());
  if (x && x.dataset.x === 'musica') return X.musica();
  if (x && x.dataset.x === 'salir') {
    if (await X.confirmar('¿Salir? Sin tu llave no vas a poder volver a esta cuenta desde otro celular.', 'Salir')) { guardarCuenta(null); pintarPerfil(); }
    return;
  }
  if (x && x.dataset.x === 'borrar') {
    if (!(await X.confirmar('¿Borrar tu cuenta? Se borran tus packs publicados, tus me gusta y a quién seguís. Los stickers de tu celular quedan.', 'Borrar todo'))) return;
    try { await api('/api/yo', { method: 'DELETE' }); guardarCuenta(null); await desmarcarPublicados(); X.aviso('Listo, borramos tu cuenta'); pintarPerfil(); } catch (e) { X.aviso(e.message); }
    return;
  }
  return alTocarFeed(ev);
}
async function desmarcarPublicados() { const packs = await P.leerPacks(); for (const p of packs) delete p.publicado; await P.guardarPacks(packs); X.E.packs = packs; }
// ---- el evento del termo ----
let EVENTO = null;
export async function pintarEvento() {
  const c = X.$('#eventoCard'); if (!c) return;
  try { EVENTO = await api('/api/evento'); } catch (e) { c.classList.add('oc'); return; }
  const ev = EVENTO, pct = Math.min(100, Math.round((ev.cuentas / ev.meta) * 100));
  c.classList.remove('oc');
  c.innerHTML = ev.sorteado ? `<i class="mini"></i><span><b>¡El termo eligió!</b><small>Mirá los 5 stickers ganadores del primer evento</small></span><i data-i="sig"></i>`
    : `<i class="mini"></i><span><b>Evento del termo 🧉</b><small>${ev.cuentas} de ${ev.meta} cuentas: con ${ev.meta} se sortean 5 recomendados</small><div class="tBarra"><i style="width:${pct}%"></i></div></span><i data-i="sig"></i>`;
  X.iconos(c);
}
export function verTermo() {
  if (!EVENTO) return;
  abrirTermo({ ev: EVENTO, media, X, al: (que, quien) => {
    if (que === 'usuario') abrirUsuario(quien);
    else if (que === 'publicar') { X.pestaña('Mios'); X.aviso('Abrí un pack tuyo (de 3 stickers o más) y tocá «Publicar en la comunidad»'); }
  } });
}
export function pedirCuenta(texto) { X.aviso(texto); X.pestaña('Perfil'); }

// ================= PUBLICAR UN PACK MÍO =================
export function estadoPublicado(pack) {
  if (pack.origen) return { puede: false, texto: `Pack de @${pack.origen.autor}` };
  if (!pack.publicado) return { puede: pack.stickers.length >= 3, texto: 'Publicar en la comunidad' };
  return { puede: true, texto: pack.v > pack.publicado.vLocal ? 'Actualizar en la comunidad' : 'Publicado ✓ · Ver', ver: pack.v <= pack.publicado.vLocal };
}
export async function publicar(pack) {
  const est = estadoPublicado(pack);
  if (est.ver) return abrirPublico(pack.publicado.id);
  if (!cuenta()) return pedirCuenta('Para publicar, primero elegí tu @');
  if (pack.stickers.length < 3) return X.aviso('Para publicar, el pack necesita 3 stickers');
  const textos = pack.stickers.map((s) => (s.proyecto ? s.proyecto.capas.filter((c) => c.tipo === 'texto').map((c) => c.texto.replace(/\n/g, ' ')).join(' ') : '')).join(' ');
  const sug = [...new Set([...ETIQUETAS.filter((t) => X.norm(textos + ' ' + pack.nombre).includes(t)), ...(pack.animado ? ['animados'] : []), 'jaja', 'memes', 'amigos'])].slice(0, 8);
  const tags = new Set((pack.publicado && pack.publicado.tags) || sug.slice(0, 2));
  const m = X.modal(`<div class="hoja"><h3>${pack.publicado ? 'Actualizar' : 'Publicar'} en la comunidad</h3><p>Lo van a poder ver, bajar y agregar a su WhatsApp. Sólo se suben los stickers terminados: tus fotos quedan en tu celular.</p>
    <div class="etq">Nombre</div><input id="pbN" class="campo" maxlength="40">
    <div class="etq">Etiquetas (hasta 5)</div><div class="chips" id="pbT">${[...new Set([...sug, ...tags])].map((t) => `<button class="chip" data-v="${X.h(t)}">#${X.h(t)}</button>`).join('')}</div>
    <input id="pbOtra" class="campo" maxlength="20" placeholder="+ otra etiqueta" style="margin-top:10px">
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">${pack.publicado ? 'Actualizar' : 'Publicar'}</button></div></div>`);
  X.$('#pbN', m).value = pack.nombre;
  const marcar = () => { for (const b of X.$('#pbT', m).children) b.classList.toggle('act', tags.has(b.dataset.v)); };
  X.$('#pbT', m).onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; const v = b.dataset.v; if (tags.has(v)) tags.delete(v); else if (tags.size < 5) tags.add(v); marcar(); };
  X.$('#pbOtra', m).onkeydown = (ev) => { if (ev.key !== 'Enter') return; const v = X.norm(ev.target.value).replace(/[^a-z0-9ñ]/g, ''); if (v.length >= 2 && tags.size < 5) { tags.add(v); X.$('#pbT', m).insertAdjacentHTML('beforeend', `<button class="chip" data-v="${X.h(v)}">#${X.h(v)}</button>`); marcar(); } ev.target.value = ''; };
  m.querySelector('[data-x="0"]').onclick = () => X.cerrarModal();
  m.querySelector('[data-x="1"]').onclick = async () => {
    const otra = X.norm(X.$('#pbOtra', m).value).replace(/[^a-z0-9ñ]/g, ''); if (otra.length >= 2 && tags.size < 5) tags.add(otra);
    const nombre = X.$('#pbN', m).value.trim() || pack.nombre;
    X.$('.hoja', m).innerHTML = '<div class="progreso"><div class="rueda"></div><b>Subiendo tus stickers…</b><span>Sólo los stickers, no tus fotos</span></div>'; m.onclick = null;
    try {
      const f = new FormData();
      f.set('meta', JSON.stringify({ nombre, tags: [...tags], textos, animado: !!pack.animado, bandeja: pack.bandeja.replace(/\.webp$/, '.png'), stickers: pack.stickers.map((s) => ({ archivo: s.archivo, emojis: s.emojis })) }));
      for (const s of pack.stickers) f.set(s.archivo, await P.blobDe(pack.id, s.archivo), s.archivo);
      f.set(pack.bandeja, await P.blobDe(pack.id, pack.bandeja), pack.bandeja);
      const r = await api(pack.publicado ? '/api/packs/' + pack.publicado.id : '/api/packs', { method: pack.publicado ? 'PUT' : 'POST', body: f, tiempo: 90000 });
      const packs = await P.leerPacks(), loc = packs.find((x) => x.id === pack.id);
      loc.publicado = { id: r.pack.id, v: r.pack.v, vLocal: loc.v, tags: [...tags] }; await P.guardarPacks(packs); X.E.packs = packs;
      X.cerrarModal(); X.confeti(); X.vibrar(25);
      const ok2 = X.modal(`<div class="hoja centro"><div class="grandote">🎉</div><h3>¡${pack.publicado ? 'Actualizado' : 'Publicado'}!</h3><p>Ya está en la comunidad. Mandalo al grupo así lo agregan a su WhatsApp.</p>
        <div class="botones"><button class="sec" data-x="ver">Verlo</button><button class="pri" data-x="comp"><i data-i="compartir"></i> Compartir</button></div></div>`);
      ok2.querySelector('[data-x="ver"]').onclick = () => { X.cerrarModal(); abrirPublico(r.pack.id); };
      ok2.querySelector('[data-x="comp"]').onclick = () => { X.cerrarModal(); compartirPack(r.pack); };
      X.pintarPack();
    } catch (e) { X.cerrarModal(); X.aviso(e.message, 4000); }
  };
  marcar();
}

// ================= BUSCAR EN LA COMUNIDAD =================
export async function buscarComunidad(q, cont) {
  if (!q.trim()) {
    try { const { tags } = await api('/api/tendencias'); const ts = [...new Set([...tags, ...ETIQUETAS])].slice(0, 14); cont.innerHTML = `<div class="res"><h3>🔥 Lo más picante</h3><div class="chips tendencias">${ts.map((t) => `<button class="chip" data-tag="${X.h(t)}">#${X.h(t)}</button>`).join('')}</div></div>`; }
    catch (e) { cont.innerHTML = `<div class="res"><h3>Etiquetas</h3><div class="chips tendencias">${ETIQUETAS.map((t) => `<button class="chip" data-tag="${X.h(t)}">#${X.h(t)}</button>`).join('')}</div></div>`; }
    return;
  }
  cont.innerHTML = '<div class="res"><h3>En la comunidad</h3>' + esqueletos(1) + '</div>';
  try {
    const r = await api('/api/buscar?q=' + encodeURIComponent(q));
    cont.innerHTML = `<div class="res">${r.usuarios.length ? `<h3>Gente</h3><div class="gente">${r.usuarios.map((u) => `<button class="persona" data-u="${X.h(u.nombre)}">${avatar(u.avatar, 'avM')}<b>@${X.h(u.nombre)}</b><small>${num(u.seguidores)} seg.</small></button>`).join('')}</div>` : ''}
      ${r.packs.length ? `<h3>En la comunidad (${r.packs.length})</h3><div class="feedLista">${r.packs.map((p, i) => tarjeta(p, i)).join('')}</div>` : ''}</div>`;
    X.iconos(cont);
  } catch (e) { cont.innerHTML = ''; }
}

// ================= ARRANQUE =================
export function iniciar(ctx) {
  X = ctx;
  X.$('#feedSeg').onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; F.modo = b.dataset.m; for (const x of X.$('#feedSeg').children) x.classList.toggle('act', x === b); X.vibrar(6); cargarFeed(true); };
  X.$('#feedLista').onclick = alTocarFeed;
  X.$('#puCont').onclick = (ev) => { const s = ev.target.closest('[data-seguir]'); if (s) return seguir(s); const t = ev.target.closest('[data-tag]'); if (t) return X.buscarTag(t.dataset.tag); alTocarFeed(ev); };
  X.$('#usCont').onclick = (ev) => { const s = ev.target.closest('[data-seguir]'); if (s) return seguir(s); const cu = ev.target.closest('[data-compartir-u]'); if (cu) return compartirPerfil(cu.dataset.compartirU); alTocarFeed(ev); };
  X.$('#tabPerfil').onclick = alTocarPerfil;
  X.$('#puWhats').onclick = agregarPublico;
  X.$('#puLike').onclick = async () => { if (!actual) return; const b = X.$('#puLike'); if (!cuenta()) return pedirCuenta('Para dar me gusta, elegí tu @'); const si = !actual.yaLike; actual.yaLike = si; pintarLike(); if (si) corazon(X.$('#puCont'), null, 160); X.vibrar(si ? 15 : 8); try { const r = await api(`/api/packs/${actual.id}/like`, { method: si ? 'POST' : 'DELETE' }); actual.likes = r.likes; } catch (e) { actual.yaLike = !si; pintarLike(); X.aviso(e.message); } };
  X.$('#puCompartir').onclick = () => compartirPack(actual);
  X.$('#puMenu').onclick = menuPublico;
  X.$('#usMenu').onclick = () => { const d = X.E.usuarioActual; if (!d || d.soyYo) return; const m = X.modal(`<div class="hoja"><h3>@${X.h(d.usuario.nombre)}</h3><div class="lista"><button class="opc peligro" data-x="r"><i data-i="bandera"></i><span>Denunciar el perfil (foto o portada)</span></button><button class="opc peligro" data-x="b"><i data-i="bloquear"></i><span>Bloquear</span></button></div></div>`); X.$('.lista', m).onclick = async (ev) => { const b = ev.target.closest('[data-x]'); if (!b) return; X.cerrarModal(); if (b.dataset.x === 'b') return bloquear(d.usuario); if (!cuenta()) return pedirCuenta('Para denunciar, elegí tu @'); try { await api(`/api/usuarios/${d.usuario.id}/reportar`, { method: 'POST', json: { motivo: 'ofensivo' } }); X.aviso('Gracias. Lo vamos a revisar 🙏'); } catch (e) { X.aviso(e.message); } }; };
  // (el feed carga más al llegar abajo, y se actualiza tirando para abajo)
  const tf = X.$('#tabFeed');
  tf.addEventListener('scroll', () => { if (tf.scrollTop + tf.clientHeight > tf.scrollHeight - 600) cargarFeed(false); }, { passive: true });
  let y0 = null; const tirar = X.$('#tirar');
  tf.addEventListener('touchstart', (ev) => { y0 = tf.scrollTop <= 0 ? ev.touches[0].clientY : null; }, { passive: true });
  tf.addEventListener('touchmove', (ev) => { if (y0 == null) return; const d = Math.max(0, ev.touches[0].clientY - y0); tirar.style.height = Math.min(70, d * 0.5) + 'px'; tirar.classList.toggle('listo', d > 110); }, { passive: true });
  tf.addEventListener('touchend', () => { if (y0 == null) return; const ya = tirar.classList.contains('listo'); tirar.style.height = ''; tirar.classList.remove('listo'); y0 = null; if (ya) { X.vibrar(10); cargarFeed(true); } });
  document.addEventListener('click', (ev) => { const a = ev.target.closest('a[data-ext]'); if (a) { ev.preventDefault(); if (P.esApp) location.href = a.href; else window.open(a.href, '_blank'); } });
}
