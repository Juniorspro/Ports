// ---------------- la tienda sin saturarla, y lo que se puede pedir sin ella ----------------
// El servidor de la tienda (un Worker de Cloudflare con el plan gratis) tiene un tope de pedidos por día. Al pasarlo,
// Cloudflare corta todo hasta el día siguiente («error code: 1027», 429) y la respuesta ni llega al juego: viene sin
// permiso de otro sitio, así que el navegador la ve como «sin red». Pasó en noviembre de 2026: la tienda, la búsqueda de
// la tele y la de la radio dejaron de andar para todos. Acá:
//  - lo que se pide solo cada tanto (el latido de lo social, los mods del server, la lista y la vida de los servers, los
//    chats) espera cuando la tienda no contesta: con 3 fallas seguidas, 2, 4, 8… hasta 30 minutos sin volver a probar;
//    una respuesta buena lo destraba. Lo que pide la persona (abrir la tienda, buscar) se prueba siempre;
//  - la app de Android pide por su cuenta lo que no necesita de la tienda (Web.java, «/red/<sitio>/<ruta>»): los pedazos
//    de los addons de Steam (eran la mayoría de los pedidos: un addon de 700 MB, unos 700) y la búsqueda de YouTube;
//  - las emisoras de radio se buscan directo en Radio Browser (deja pedir desde cualquier página);
//  - en la tele y la radio, un link de YouTube pegado se pone sin buscar (el título sale de YouTube, sin la tienda).
const TIENDA = { fallas: 0, frenoHasta: 0, ultOk: 0, n: 0 };
const TIENDA_SOLOS = /^(social\/latido|social\/chats|social\/chat\/|mods\?desde=|salas(\/[^/?]+\/vivo)?$)/;
const tiendaFrenada = () => Date.now() < TIENDA.frenoHasta;
function tiendaFalla() { TIENDA.fallas++; if (TIENDA.fallas >= 3) TIENDA.frenoHasta = Date.now() + Math.min(30, 2 ** Math.min(5, TIENDA.fallas - 2)) * 60e3; }
(function () {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.__tiendaRed) return;
  window.__tiendaRed = 1;
  const f0 = window.fetch.bind(window);
  window.fetch = function (u, o) {
    const s = typeof u === 'string' ? u : u && u.url;
    if (typeof TIENDA_URL === 'undefined' || !s || s.indexOf(TIENDA_URL) !== 0) return f0(u, o);
    const ruta = s.slice(TIENDA_URL.length);
    if (tiendaFrenada() && TIENDA_SOLOS.test(ruta)) return Promise.reject(new TypeError('tienda saturada'));
    TIENDA.n++;
    return f0(u, o).then((r) => {
      // (el corte de Cloudflare es texto; los 429 de la tienda misma —topes por persona— son JSON y no frenan nada)
      if (r.status === 429 && !/json/i.test(r.headers.get('content-type') || '')) tiendaFalla();
      else { TIENDA.fallas = 0; TIENDA.frenoHasta = 0; TIENDA.ultOk = Date.now(); }
      return r;
    }, (e) => { tiendaFalla(); throw e; });
  };
})();
// el aviso para la persona cuando algo no anda porque la tienda no contesta
function tiendaAvisoSat() { if (typeof aviso === 'function') aviso(T(tiendaFrenada() ? 'tienda.sat' : 'errRed'), 3.5); }

// ---------------- lo que la app de Android pide por su cuenta ----------------
// (Web.java sirve «/red/<sitio>/<ruta>» pidiéndolo él: sólo algunos sitios —los servidores de Steam, Radio Browser y la
// búsqueda de YouTube— y sólo GET; desde el juego es el mismo sitio, así que no hace falta permiso)
const redApp = () => typeof window !== 'undefined' && !!window.JXNativo && typeof window.JXNativo.red === 'function' && location.host === 'appassets.androidplatform.net';
const redURL = (host, ruta) => location.origin + '/red/' + host + ruta;
// (2: la app además pide a Steam la clave, los detalles, el contenido base y lo requerido de los addons —/red/_steam…—, sin la
// tienda: con la tienda en su tope del día los mods se bajan igual)
const redNivel = () => { try { return redApp() ? +window.JXNativo.red() || 1 : 0; } catch (e) { return 0; } };

// ---------------- YouTube: buscar ----------------
const YTB = { cache: new Map() };
// un link de YouTube (o youtu.be): el id del video
function ytDeLink(q) {
  const m = /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:[^#\s]*&)?v=)([\w-]{11})(?![\w-])/i.exec(String(q || ''));
  return m ? m[1] : null;
}
// título y canal de un video sin la tienda (oEmbed de YouTube deja pedir desde cualquier página)
async function ytOembed(id) {
  try {
    const c = typeof AbortController === 'function' ? new AbortController() : null, t = c ? setTimeout(() => c.abort(), 8000) : 0;
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id), c ? { signal: c.signal } : undefined);
    if (t) clearTimeout(t);
    if (r.ok) { const d = await r.json(); return { id, t: String(d.title || id).slice(0, 120), c: String(d.author_name || '').slice(0, 60), d: '' }; }
  } catch (e) {}
  return { id, t: id, c: '', d: '' };
}
// la página de resultados de YouTube, leída como hace la tienda (sólo en la app: el navegador no deja leerla)
function ytLeerResultados(h) {
  const i = h.indexOf('ytInitialData = '); if (i < 0) return [];
  const j = h.indexOf(';</script>', i); if (j < 0) return [];
  let datos; try { datos = JSON.parse(h.slice(i + 16, j)); } catch (e) { return []; }
  const out = [], txt = (o) => (o ? o.simpleText || (o.runs || []).map((x) => x.text).join('') : '');
  const recorrer = (o, prof) => {
    if (!o || typeof o !== 'object' || out.length >= 15 || prof > 40) return;
    if (o.videoRenderer && /^[\w-]{11}$/.test(o.videoRenderer.videoId || '')) {
      const v = o.videoRenderer; out.push({ id: v.videoId, t: txt(v.title).slice(0, 120), c: txt(v.ownerText || v.longBylineText).slice(0, 60), d: txt(v.lengthText).slice(0, 12) }); return;
    }
    for (const k in o) recorrer(o[k], prof + 1);
  };
  recorrer(datos, 0);
  return out;
}
async function ytBuscarApp(q) {
  const c = typeof AbortController === 'function' ? new AbortController() : null, t = c ? setTimeout(() => c.abort(), 15000) : 0;
  try {
    const r = await fetch(redURL('www.youtube.com', '/results?sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(q)), c ? { signal: c.signal } : undefined);
    if (!r.ok) throw new Error('youtube ' + r.status);
    return ytLeerResultados(await r.text());
  } finally { if (t) clearTimeout(t); }
}
// buscar: un link se pone directo; si no, la app busca sola y si no puede (o en la web) pregunta a la tienda
async function ytBuscar(q) {
  q = String(q || '').trim().slice(0, 200); if (!q) return [];
  const id = ytDeLink(q); if (id) return [await ytOembed(id)];
  q = q.slice(0, 80);
  const k = q.toLowerCase(), c = YTB.cache.get(k); if (c && Date.now() - c.t < 3600e3) return c.items;
  let items = null, err = null;
  if (redApp()) { try { items = await ytBuscarApp(q); } catch (e) { err = e; } }
  if (!items || !items.length) {
    try { const d = await (await fetch(TIENDA_URL + 'yt?q=' + encodeURIComponent(q))).json(); items = (d.items || []).map((x) => ({ id: x.id, t: x.t, c: x.c, d: x.d })); }
    catch (e) { if (!items) throw Object.assign(e || err || new Error('yt'), { sat: tiendaFrenada() }); }
  }
  items = items.filter((x) => x && /^[\w-]{11}$/.test(x.id || ''));
  if (items.length) { YTB.cache.set(k, { t: Date.now(), items }); if (YTB.cache.size > 200) YTB.cache.delete(YTB.cache.keys().next().value); }
  return items;
}

// ---------------- emisoras de radio: directo en Radio Browser ----------------
const RB_SITIOS = ['de1', 'de2', 'fi1', 'nl1', 'at1'];
const RB_CODECS = /^(MP3|AAC|AAC\+|OGG|OPUS|VORBIS)$/i;
const rbEstOk = (x) => x && /^[0-9a-f-]{36}$/.test(x.stationuuid || '') && /^https?:\/\//.test(x.url_resolved || '') && !x.hls && RB_CODECS.test(x.codec || '') && x.lastcheckok === 1;
const estTxt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
async function estPedir(ruta) {
  let err = null; const ini = (RB_SITIOS.n = ((RB_SITIOS.n || 0) + 1) % RB_SITIOS.length);
  for (let k = 0; k < RB_SITIOS.length; k++) {
    const h = RB_SITIOS[(ini + k) % RB_SITIOS.length];
    try {
      const c = typeof AbortController === 'function' ? new AbortController() : null, t = c ? setTimeout(() => c.abort(), 7000) : 0;
      const r = await fetch(`https://${h}.api.radio-browser.info${ruta}`, c ? { signal: c.signal } : undefined); if (t) clearTimeout(t);
      if (r.ok) return await r.json(); err = new Error('radio ' + r.status);
    } catch (e) { err = e; }
  }
  throw err || new Error('radio');
}
const RBC = new Map();
async function radioBuscarDirecto(q, tag) {
  q = estTxt(q, 60); tag = estTxt(tag, 30).toLowerCase();
  const k = q.toLowerCase() + '|' + tag, c = RBC.get(k); if (c && Date.now() - c.t < 1800e3) return c.items;
  const base = '/json/stations/search?limit=80&hidebroken=true&order=clickcount&reverse=true';
  let L = await estPedir(base + (tag ? '&tag=' + encodeURIComponent(tag) : '') + (q ? '&name=' + encodeURIComponent(q) : ''));
  if (q && !tag && Array.isArray(L) && !L.filter(rbEstOk).length) L = await estPedir(base + '&tag=' + encodeURIComponent(q.toLowerCase()));
  const vistos = new Set(), items = [];
  for (const x of Array.isArray(L) ? L : []) {
    if (!rbEstOk(x)) continue; const n = String(x.name || '').toLowerCase().trim(); if (vistos.has(n)) continue; vistos.add(n);
    items.push({ id: x.stationuuid, t: estTxt(x.name, 80), c: estTxt(x.countrycode, 4), g: estTxt(String(x.tags || '').split(',').slice(0, 2).join(', '), 40),
      b: Math.max(0, Math.min(999, x.bitrate | 0)), k: estTxt(x.codec, 8), i: /^https:\/\/[^\s"'<>]{4,300}$/.test(x.favicon || '') ? x.favicon : '' });
    if (items.length >= 30) break;
  }
  if (items.length) RBC.set(k, { t: Date.now(), items });
  return items;
}
// la dirección del audio de una emisora (y cuenta la escucha en Radio Browser, como pide su API)
async function radioUrlDirecta(id) {
  const d = await estPedir('/json/url/' + id);
  return d && /^https?:\/\//.test(d.url || '') ? d.url : '';
}
