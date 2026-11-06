// ---------------- addons de Garry's Mod en el juego ----------------
// Un addon (.gma del Workshop o propio) se "monta" como en GMod: sus archivos quedan disponibles por su ruta (models/...,
// materials/..., sound/..., lua/...) y lo que trae aparece en el juego. Los modelos se convierten la primera vez que se
// usan (gmod_formatos.js → mallas del juego: 14 bytes por vértice, como las del paquete), con sus materiales (.vmt) y
// texturas (.vtf; las que no trae el addon se buscan entre las de HL2/GMod que ya tiene el juego y si no está, el damero
// violeta de GMod), su casco de choque (.phy, pieza por pieza) y su masa. En el menú de props, la pestaña GMod tiene una
// sección por addon con todos sus modelos (íconos dibujados acá, de costado, como los de GMod).
const GMOD = { addons: new Map(), arch: new Map(), pf: new Map(), tex: new Map(), mats: new Map(), bin: 0, errores: [], iconos: new Map(), colaIco: [], texJuego: null, faltante: -1, blanca: -1, req: new Map() };
const GM_S = 0.0254;
const gmErr = (que, e) => { GMOD.errores.push(que + ': ' + String((e && e.message) || e).slice(0, 120)); if (GMOD.errores.length > 200) GMOD.errores.shift(); };
const gmArchivo0 = (r) => GMOD.arch.get(r) || null;
// ---------------- lo grande de los addons, leído cuando hace falta ----------------
// Un addon grande es casi todo texturas (.vtf: del 50 al 95 % de los packs de armas) y, si trae un mapa, el .bsp. Antes se
// tenía todo en memoria (y al arrancar se montaban todos los instalados): en los celulares la pestaña se cerraba. Ahora
// el .gma queda guardado como Blob en el navegador (en el disco) y de esos archivos se lee sólo lo que hace falta: de una
// textura, hasta el tamaño que se va a usar (en el .vtf los niveles chicos vienen primero); el mapa, al armarlo. Lo leído
// queda en una caché chica (la más vieja sale primero).
const GMPZ = { idx: new Map(), cache: new Map(), lens: new Map(), bytes: 0, pend: new Map(), tope: 0 };
// (lo que queda en el disco —el Blob del addon— y se lee cuando hace falta: texturas, mapas, la geometría de los modelos y
// los sonidos grandes. Con un pack de armas, sólo .vvd/.vtx eran ~70 MB en memoria)
const GM_PEREZOSO = /\.(vtf|bsp|vvd|vtx|wav|mp3|ogg)$/;
const gmPzTope = () => GMPZ.tope || (GMPZ.tope = ((navigator.deviceMemory || 4) <= 2 ? 12 : (navigator.deviceMemory || 4) <= 4 ? 24 : 48) * 1048576);
function gmPzSacar(k) { const u = GMPZ.cache.get(k); if (!u) return; GMPZ.cache.delete(k); GMPZ.bytes -= u.length; const i = k.lastIndexOf('|'), L = GMPZ.lens.get(k.slice(0, i)); if (L) { L.delete(+k.slice(i + 1)); if (!L.size) GMPZ.lens.delete(k.slice(0, i)); } }
function gmPzGuardar(r, u) {
  if (u.length > gmPzTope() / 3) return;
  const k = r + '|' + u.length; gmPzSacar(k);
  GMPZ.cache.set(k, u); GMPZ.bytes += u.length; let L = GMPZ.lens.get(r); if (!L) GMPZ.lens.set(r, (L = new Set())); L.add(u.length);
  for (const c of GMPZ.cache.keys()) { if (GMPZ.bytes <= gmPzTope()) break; if (c !== k) gmPzSacar(c); }
}
// (algún pedazo ya leído desde el principio que tenga al menos n bytes)
function gmPzTrozo(r, n) {
  const L = GMPZ.lens.get(r); if (!L) return null;
  let mejor = 0; for (const l of L) if (l >= n && (!mejor || l < mejor)) mejor = l;
  if (!mejor) return null; const k = r + '|' + mejor, u = GMPZ.cache.get(k); if (!u) return null;
  GMPZ.cache.delete(k); GMPZ.cache.set(k, u); return n < u.length ? u.subarray(0, n) : u;
}
// los primeros n bytes de un archivo (n 0: entero)
function gmPzRango(r, n) {
  const x = GMPZ.idx.get(r); if (!x) return Promise.resolve(null);
  n = n > 0 ? Math.min(n, x.t) : x.t;
  const c = gmPzTrozo(r, n); if (c) return Promise.resolve(c);
  const k = r + '|' + n; let p = GMPZ.pend.get(k); if (p) return p;
  p = x.b.slice(x.o, x.o + n).arrayBuffer().then((ab) => { GMPZ.pend.delete(k); const u = new Uint8Array(ab); gmPzGuardar(r, u); return u; }, (e) => { GMPZ.pend.delete(k); gmErr('leer ' + r, e); return null; });
  GMPZ.pend.set(k, p); return p;
}
const gmPzLeer = (r) => gmPzRango(r, 0);
// una textura hasta el nivel que entra en "max" (la cabecera dice hasta dónde)
async function gmPzVtf(r, max) {
  const x = GMPZ.idx.get(r); if (!x) return null;
  let cab = await gmPzRango(r, Math.min(x.t, 4096)); if (!cab || cab.length < 16) return cab;
  const hs = new DataView(cab.buffer, cab.byteOffset, cab.byteLength).getUint32(12, true);
  if (hs + 16 > cab.length && hs < x.t) cab = await gmPzRango(r, Math.min(x.t, hs + 64));
  let fin = 0; try { fin = GMF.vtfFin(cab, max); } catch (e) { fin = 0; }
  return fin > 0 && fin <= cab.length ? cab.subarray(0, fin) : gmPzRango(r, fin > 0 ? fin : 0);
}
// los bytes de una textura para decodificarla hasta "max", si ya están (los del addon en memoria, o lo ya leído); si no, null
function gmVtfYa(r, max) {
  const b = GMOD.arch.get(r); if (b) return b;
  const x = GMPZ.idx.get(r); if (!x) return gmArchivo(r);
  const cab = gmPzTrozo(r, Math.min(x.t, 64)); if (!cab) return null;
  let fin = 0; try { fin = GMF.vtfFin(gmPzTrozo(r, Math.min(x.t, 4096)) || cab, max); } catch (e) { return null; }
  return gmPzTrozo(r, Math.min(fin, x.t));
}
// (lo de los addons montados; si no, lo de la biblioteca de GMod/HL2: lo bajado, o se pide y llega enseguida)
// (lo leído del disco hace poco y que alguien espera —las partes de un modelo—: queda a mano unos segundos, así lo que lo
// rehace en el cuadro siguiente lo encuentra aunque no entre en la caché)
GMPZ.pin = new Map(); GMPZ.pinB = 0; GMPZ.mdl = new Map();
function gmPzFijar(r, u) {
  if (!u) return; const x = GMPZ.pin.get(r); if (x) { GMPZ.pinB -= x.u.length; }
  GMPZ.pin.set(r, { u, t: performance.now() + 10000 }); GMPZ.pinB += u.length;
  for (const [k, v] of GMPZ.pin) { if (GMPZ.pinB <= 2 * gmPzTope()) break; if (k !== r) { GMPZ.pin.delete(k); GMPZ.pinB -= v.u.length; } }   // (hasta el doble de la caché: 24 MB en un celular de 2 GB)
  if (!GMPZ.pinT) GMPZ.pinT = setTimeout(gmPzSoltar, 2000);
}
function gmPzSoltar() { GMPZ.pinT = 0; const t = performance.now(); for (const [k, v] of GMPZ.pin) if (v.t < t) { GMPZ.pin.delete(k); GMPZ.pinB -= v.u.length; } if (GMPZ.pin.size) GMPZ.pinT = setTimeout(gmPzSoltar, 2000); }
// las partes de un modelo que están en el disco y todavía no se leyeron
function gmModeloFaltan(ruta) {
  const base = ruta.slice(0, -4), vtx = [base + '.dx90.vtx', base + '.vtx', base + '.dx80.vtx', base + '.sw.vtx'].find((r) => GMOD.arch.has(r) || GMPZ.idx.has(r) || (typeof GML !== 'undefined' && GML.datos.has(r)));
  return [base + '.vvd', vtx].filter((r) => r && !GMOD.arch.has(r) && GMPZ.idx.has(r) && !GMPZ.pin.has(r) && !gmPzTrozo(r, GMPZ.idx.get(r).t));
}
// leerlas juntas; cuando están, se rehace lo que esperaba ese modelo (entidades, vista del arma...) y se llama a fn
function gmModeloPedir(ruta, fn) {
  let p = GMPZ.mdl.get(ruta);
  if (!p) {
    const L = gmModeloFaltan(ruta);
    p = Promise.all(L.map((r) => gmPzLeer(r).then((u) => { gmPzFijar(r, u); return !!u; }))).then((ok) => { GMPZ.mdl.delete(ruta); if (ok.every(Boolean) && typeof gmlLlegaron === 'function') { try { gmlLlegaron([ruta]); } catch (e) {} } return ok.every(Boolean); });
    GMPZ.mdl.set(ruta, p);
  }
  if (fn) p.then((ok) => { if (ok) fn(); });
  return p;
}
// (el menú: si lo elegido es un modelo de un addon con la geometría todavía en el disco, se lee y se pone cuando llega)
function gmModeloEsperar(nombre, fn) {
  if (!GMPZ.idx.size) return false;
  let ruta = null; const lst = (n, k) => { const v = typeof gmLista === 'function' ? gmLista(n, k) : null, m = v && v.get && v.get('Model'); return typeof m === 'string' ? m : null; };
  if (/^gm:/.test(nombre)) ruta = nombre.slice(3);
  else if (/^gm(pm|npcm|rag):/.test(nombre)) ruta = nombre.replace(/^gm(pm|npcm|rag):/, '');
  else if (/^gmveh:/.test(nombre)) ruta = lst('Vehicles', nombre.slice(6));
  else if (/^gmnpc:/.test(nombre)) ruta = lst('NPC', nombre.slice(6));
  if (!ruta) return false; ruta = ruta.toLowerCase().replace(/\\/g, '/'); if (!ruta.startsWith('models/')) ruta = 'models/' + ruta;
  if (!/\.mdl$/.test(ruta) || !gmModeloFaltan(ruta).length) return false;
  gmModeloPedir(ruta, fn); return true;
}
const gmArchivo = (r) => {
  const b = GMOD.arch.get(r); if (b) return b;
  { const f = GMPZ.pin.get(r); if (f) return f.u; }
  const x = GMPZ.idx.get(r); if (x) { const c = gmPzTrozo(r, x.t); if (c) return c; gmPzLeer(r); return null; }
  if (typeof GML !== 'undefined') { const d = GML.datos.get(r); if (d) return d; if (gmlTiene(r)) gmlPedir(r); }
  return null;
};
// ¿existe? (sin leerlo)
const gmExiste = (r) => GMOD.arch.has(r) || GMPZ.idx.has(r) || (typeof GML !== 'undefined' && (GML.datos.has(r) || gmlTiene(r)));

// ---------------- montar ----------------
// G: lo que devuelve GMF.gma. id: el del Workshop (o 'local:<nombre>')
// ---------------- las fuentes de letra de los addons (resource/fonts/*.ttf|otf) ----------------
// GMod busca la fuente de surface.CreateFont por su nombre de familia (el de adentro del archivo, no el del archivo) y el
// «size» es el alto de la celda (lo de arriba más lo de abajo de la fuente, como CreateFont de Windows), no el em de CSS:
// por eso cada fuente guarda cuánto mide su em respecto de la celda (k) y dónde cae la línea de base (a).
const GMFU = { fam: new Map(), met: new Map(), n: 0 };
function gmfTTF(b) {
  try {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength); if (b.length < 12) return null;
    const n = v.getUint16(4), T = {};
    for (let i = 0; i < n; i++) { const o = 12 + i * 16; if (o + 16 > b.length) return null; T[String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3])] = { o: v.getUint32(o + 8), l: v.getUint32(o + 12) }; }
    if (!T.head || !T.name) return null;
    const r = { upm: v.getUint16(T.head.o + 18) || 1000, nombres: [] };
    if (T.hhea) { r.asc = v.getInt16(T.hhea.o + 4); r.desc = -v.getInt16(T.hhea.o + 6); }
    if (T['OS/2'] && T['OS/2'].l >= 78) { const o = T['OS/2'].o; r.wAsc = v.getUint16(o + 74); r.wDesc = v.getUint16(o + 76); }
    const no = T.name.o, cnt = v.getUint16(no + 2), so = no + v.getUint16(no + 4);
    for (let i = 0; i < cnt; i++) {
      const o = no + 6 + i * 12, pid = v.getUint16(o), eid = v.getUint16(o + 2), id = v.getUint16(o + 6), len = v.getUint16(o + 8), off = v.getUint16(o + 10);
      if (id !== 1 && id !== 4 && id !== 16) continue;
      let s = '';
      if (pid === 3 || pid === 0) for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(v.getUint16(so + off + k));
      else if (pid === 1 && eid === 0) for (let k = 0; k < len; k++) s += String.fromCharCode(b[so + off + k]);
      s = s.replace(/\0/g, '').trim(); if (s && !r.nombres.includes(s)) r.nombres.push(s);
    }
    const sa = r.wAsc || r.asc || r.upm * 0.8, sd = r.wAsc ? r.wDesc : (r.desc || r.upm * 0.2);
    r.k = r.upm / Math.max(1, sa + sd); r.a = sa / Math.max(1, sa + sd);
    return r;
  } catch (e) { return null; }
}
// (las del addon: se leen al montarlo —así surface.CreateFont ya sabe las medidas— y su Lua corre cuando están cargadas,
// porque hay mods que miden el texto una vez y lo guardan)
function gmfRegistrar(A) {
  const esperas = [];
  for (const [r, b] of A.G.archivos) {
    if (!/^resource\/fonts\/[^/]+\.(ttf|otf)$/i.test(r)) continue;
    const M = gmfTTF(b); if (!M || !M.nombres.length) continue;
    const css = 'gmf' + (++GMFU.n), F = { css, k: M.k, a: M.a };
    for (const nm of [...M.nombres, r.split('/').pop().replace(/\.\w+$/, '')]) if (!GMFU.fam.has(nm.toLowerCase())) GMFU.fam.set(nm.toLowerCase(), F);
    if (typeof FontFace === 'function' && typeof document !== 'undefined' && document.fonts) {
      try { const ff = new FontFace(css, b.slice().buffer); document.fonts.add(ff); esperas.push(Promise.race([ff.load(), new Promise((ok) => setTimeout(ok, 3000))]).catch(() => {})); } catch (e) {}
    }
  }
  return Promise.all(esperas);
}
// (las de Windows que piden los mods sin traerlas: sus medidas, para que el tamaño dé como en GMod aunque se dibuje con otra)
const GMF_SIS = { tahoma: [0.828, 0.829], arial: [0.895, 0.81], verdana: [0.823, 0.828], 'trebuchet ms': [0.858, 0.802], 'courier new': [0.885, 0.737], roboto: [0.853, 0.79], consolas: [0.855, 0.762], 'segoe ui': [0.75, 0.8], coolvetica: [0.86, 0.8], marlett: [1, 0.8] };
function gmfFuente(nombre) {
  const n = String(nombre || 'Tahoma').toLowerCase(), F = GMFU.fam.get(n); if (F) return F;
  const s = GMF_SIS[n] || GMF_SIS[n.replace(/\s+(bold|regular|light|medium)$/, '')] || [0.85, 0.8];
  return { css: null, k: s[0], a: s[1] };
}
function gmMontar(id, G, meta) {
  if (GMOD.addons.has(id)) return GMOD.addons.get(id);
  const A = { id, nombre: (meta && meta.nombre) || G.nombre || id, autor: G.autor, G, modelos: [], lua: [], sonidos: 0, meta: meta || {}, visita: !!(meta && meta.visita) };
  // (¿se puede usar en los servers oficiales? nombre, descripción, etiquetas y rutas de sus archivos; y lo del catálogo cuando llega)
  if (typeof censModMotivo === 'function') {
    const inf = G.info || {}; A.cens = censModMotivo({ nombre: A.nombre, desc: inf.description || '', tags: inf.tags || [], archivos: [...(G.archivos ? G.archivos.keys() : []), ...((G.perezosos && G.perezosos.keys) ? G.perezosos.keys() : [])] });
    if (!A.cens && typeof gmCatalogo === 'function') gmCatalogo().then((C) => { const c = C && C.porId.get(String(id)); if (c && !A.cens) A.cens = censModMotivo(c); }).catch(() => {});
  }
  for (const [r, x] of G.perezosos || []) if (!GMOD.arch.has(r) && !GMPZ.idx.has(r)) GMPZ.idx.set(r, { b: G.blob, o: x.o, t: x.t, id });
  for (const [r, b] of G.archivos) {
    if (!GMOD.arch.has(r)) GMOD.arch.set(r, b);
    if (r.endsWith('.mdl') && r.startsWith('models/')) A.modelos.push(r);
    else if (r.endsWith('.lua')) { if (!A.visita) A.lua.push(r); }   // (de visita: sólo sus archivos, su Lua no corre)
    else if (r.startsWith('sound/')) A.sonidos++;
  }
  // (los modelos de primera persona y los de manos no son props: van con las armas)
  A.props = A.modelos.filter((r) => !/(^|\/)(v_|c_)[^/]*\.mdl$|\/c_arms|_arms\.mdl$|\/arms\//.test(r));
  A.props.sort();
  GMOD.addons.set(id, A);
  if (typeof gbspRegistrar === 'function') gbspRegistrar(A);   // (sus mapas, a la lista)
  if (typeof gmmRegistrar === 'function') gmmRegistrar(A);     // (y sus modos de juego)
  gmMenu();
  // (antes de correr su Lua: lo que pide del contenido base de GMod/HL2)
  A.listo = Promise.all([typeof gmlPreparar === 'function' ? gmlPreparar(A).catch(() => {}) : null, gmfRegistrar(A).catch(() => {})]).then(() => { if (GMOD.addons.get(id) === A && typeof gmLuaMontar === 'function') gmLuaMontar(A); gmMenu(); if (GMOD.addons.get(id) === A && typeof gmbAutoFijar === 'function') try { gmbAutoFijar(A); } catch (e) {} });
  return A;
}
function gmDesmontar(id) {
  const A = GMOD.addons.get(id); if (!A) return;
  GMOD.addons.delete(id); if (typeof gbspQuitar === 'function') gbspQuitar(A); if (typeof gmmQuitar === 'function') gmmQuitar(A);
  for (const [r, x] of [...GMPZ.idx]) if (x.id === id) { GMPZ.idx.delete(r); for (const l of [...(GMPZ.lens.get(r) || [])]) gmPzSacar(r + '|' + l); }
  for (const [r, b] of A.G.archivos) if (GMOD.arch.get(r) === b) { GMOD.arch.delete(r); for (const o of GMOD.addons.values()) { const b2 = o.G.archivos.get(r); if (b2) { GMOD.arch.set(r, b2); break; } } }
  gmMenu();
  if (typeof gmLuaDesmontar === 'function') gmLuaDesmontar(A);
}
// la pestaña GMod del menú de props: una sección por addon
function gmMenu() {
  if (typeof DATA === 'undefined' || !DATA || !DATA.menu) return;
  let C = DATA.menu.find((c) => c.n === 'GMod');
  const pms = typeof gmpLista === 'function' ? new Set(gmpLista()) : new Set();
  const subs = [...GMOD.addons.values()].map((A) => ({ n: A.nombre, it: [...[...pms].filter((r) => A.G.archivos.has(r)).map((r) => 'gmpm:' + r), ...[...pms].filter((r) => A.G.archivos.has(r)).map((r) => 'gmnpcm:' + r), ...[...pms].filter((r) => A.G.archivos.has(r)).map((r) => 'gmrag:' + r), ...[...((A.listas && A.listas.NPC) || new Map()).keys()].map((k) => 'gmnpc:' + k), ...[...((A.listas && A.listas.Vehicles) || new Map()).keys()].map((k) => 'gmveh:' + k), ...(A.sweps || []).map((c) => 'gmswep:' + c), ...(A.sents || []).map((c) => 'gment:' + c), ...gmPropsMenu(A).map((r) => 'gm:' + r)], gm: A.id })).filter((s) => s.it.length);
  const sel = typeof UI !== 'undefined' ? DATA.menu[UI.tab] : null;
  if (!subs.length) { if (C) DATA.menu.splice(DATA.menu.indexOf(C), 1); }
  else {
    if (!C) { C = { n: 'GMod', sub: [], icUrl: GM_ICO }; const i = DATA.menu.findIndex((c) => c.n === 'Weapons'); DATA.menu.splice(i >= 0 ? i + 1 : DATA.menu.length, 0, C); }
    C.sub = subs;
  }
  if (typeof UI !== 'undefined') { const i = DATA.menu.indexOf(sel); UI.tab = i >= 0 ? i : 0; }
  if (typeof spawnTabs === 'function') spawnTabs();
  if (typeof UI !== 'undefined' && UI.abierto === 'spawn' && typeof spawnDibujar === 'function') spawnDibujar();
  if (typeof gmbBoton === 'function' && typeof JUEGO !== 'undefined') gmbBoton();
}
// los props de un addon que van al menú, como el menú de GMod: modelos con física (.phy) que no son otra cosa del
// addon (el modelo en el piso de sus armas, sus modelos de jugador, NPCs y vehículos, que tienen su propio lugar),
// ni manos, ni pedazos rotos. Así no aparecen armas que sólo caen y no se agarran. Si el addon no trae ninguno con
// física (un pack de modelos sueltos), van todos: se ponen quietos donde se apuntó (ver gmPrefab).
function gmPropsMenu(A) {
  const clave = (A.sweps || []).length + ':' + Object.keys(A.listas || {}).map((k) => k + (A.listas[k].size || 0)).join(',');
  if (A._pm && A._pmClave === clave) return A._pm;
  const fuera = new Set(), m = (x) => (typeof x === 'string' && x ? x.toLowerCase().replace(/\\/g, '/') : '');
  if (typeof GMA !== 'undefined' && GMA.armas) for (const [n, c] of GMA.armas) if (c.addon === A) { const t = c.S || c.C; if (t) { fuera.add(m(t.get('WorldModel'))); fuera.add(m(t.get('ViewModel'))); } }
  for (const k of ['NPC', 'Vehicles']) for (const v of ((A.listas && A.listas[k]) || new Map()).values()) if (v && v.get) fuera.add(m(v.get('Model')));
  if (typeof gmpLista === 'function') for (const r of gmpLista()) fuera.add(r);
  const sueltos = A.props.filter((r) => !fuera.has(r) && !/(^|\/)w_[^/]*\.mdl$|^models\/weapons\/|hands?\.mdl$|(^|[\/_])gibs?[\/_\d]|debris|_chunk|shard/i.test(r));
  const conFisica = sueltos.filter((r) => gmArchivo(r.slice(0, -4) + '.phy'));
  A._pm = conFisica.length ? conFisica : sueltos; A._pmClave = clave;
  return A._pm;
}
// (la pestaña: una G blanca en un círculo azul, como el ícono de Garry's Mod; y el cuadrito gris mientras se dibuja un ícono)
const GM_ICO = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#1b8fdc"/><path d="M45 22a15 15 0 1 0 2 13H33v-7h22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>');
const GM_ICO_VACIO = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" rx="1.5" fill="#ffffff14"/></svg>');
const gmNombre = (it) => it.replace(/^gm:/, '').replace(/^.*\//, '').replace(/\.mdl$/, '');

// ---------------- texturas ----------------
function gmTexSubir(px, w, h, n, alfa) {
  const ti = DATA.tx.length; DATA.tx.push({ n, a: alfa ? 1 : 0, w, h, gm: 1 });
  R.tex[ti] = { gl: gmTexGL(px, w, h) };
  return ti;
}
function gmTexGL(px, w, h) {
  const gl = R.gl, tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  const pot = (w & (w - 1)) === 0 && (h & (h - 1)) === 0;
  if (pot || !R.gl1) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
  else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  const rep = pot || !R.gl1 ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rep); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, rep);
  if (R.aniso && GFX.aniso) gl.texParameterf(gl.TEXTURE_2D, R.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(GFX.aniso, R.anisoMax || 16));
  return tx;
}
// una textura de un addon que se lee del disco: hasta que llega, gris; después, la de verdad en el mismo lugar
function gmTexLlenar(ti, u, ruta, max) {
  const t = R.tex[ti]; if (!t || !R.gl) return;
  try {
    if (!u) throw new Error('no se pudo leer');
    const T = GMF.vtf(u, max), px = GMF.vtfRGBA(T);
    let alfa = false; if (T.alfa) for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { alfa = true; break; }
    t.gl = gmTexGL(px, T.w, T.h); const d = DATA.tx[ti]; if (d) { d.a = alfa ? 1 : 0; d.w = T.w; d.h = T.h; }
  } catch (e) { gmErr('vtf ' + ruta, e); const f = R.tex[gmTexFaltante()]; t.gl = f ? f.gl : null; }
}
// con la calidad de textura nueva: la de un addon se vuelve a leer de su .vtf y reemplaza a la vieja en el mismo lugar
// (los materiales la siguen usando por su número); si no se puede, queda la que estaba
function gmTexReleer(ti) {
  const d = DATA.tx[ti], t = R.tex[ti]; if (!d || !t || !/^GMA_/.test(d.n || '') || /^GMA_(faltante|blanca)$/.test(d.n)) return;
  const ruta = d.n.slice(4), rr = 'materials/' + ruta + '.vtf', max = (GFX && GFX.texMax) || 1024;
  const poner = (u) => {
    if (!u || R.tex[ti] !== t) return;
    try {
      const T = GMF.vtf(u, max), px = GMF.vtfRGBA(T), viejo = t.gl;
      t.gl = gmTexGL(px, T.w, T.h); d.w = T.w; d.h = T.h;
      if (viejo && viejo !== t.gl && viejo !== R.texGris && viejo !== R.texBlanca) R.gl.deleteTexture(viejo);
    } catch (e) {}
  };
  const b = GMOD.arch.get(rr) || (GMPZ.idx.has(rr) ? null : gmArchivo(rr));
  if (b) poner(b); else if (GMPZ.idx.has(rr)) gmPzVtf(rr, max).then(poner, () => {});
}
// lo que no se encontró (una textura de otro addon que no se puede bajar, como la pintura de los autos de TDMCars, que
// vive en su Base Pack sin descarga directa): gris claro parejo, como una pieza sin pintar, en vez del damero violeta y
// negro de GMod (de lejos parecía una bola negra). Las pruebas lo siguen contando como faltante.
function gmTexFaltante() {
  if (GMOD.faltante >= 0) return GMOD.faltante;
  const px = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = (y * 16 + x) * 4, v = 168 + ((x * 7 + y * 13) % 5); px[i] = v; px[i + 1] = v; px[i + 2] = v + 4; px[i + 3] = 255; }
  return (GMOD.faltante = gmTexSubir(px, 16, 16, 'GMA_faltante', false));
}
// un material que existe pero no tiene $basetexture (luces, cromados, pintura con $color2): en Source se dibuja blanco,
// teñido por su $color/$color2 (no es una textura que falte)
function gmTexBlanca() {
  if (GMOD.blanca >= 0) return GMOD.blanca;
  return (GMOD.blanca = gmTexSubir(new Uint8Array(4 * 4 * 4).fill(255), 4, 4, 'GMA_blanca', false));
}
// las texturas de HL2/GMod que el juego ya trae (del paquete, por su nombre)
function gmTexDelJuego(ruta) {
  if (!GMOD.texJuego) { GMOD.texJuego = new Map(); DATA.tx.forEach((t, i) => { if (t && t.n && /^GM_/i.test(t.n) && !t.gm) GMOD.texJuego.set(t.n.slice(3).toLowerCase().replace(/\\/g, '/'), i); }); }
  const r = ruta.toLowerCase(); if (GMOD.texJuego.has(r)) return GMOD.texJuego.get(r);
  const c = r.slice(-40); for (const [k, i] of GMOD.texJuego) if (k === c || k.endsWith('/' + r.split('/').pop()) && k.split('/').pop() === r.split('/').pop()) return i;
  return -1;
}
function gmTextura(ruta, ico) {
  const k = ruta + (ico ? '|i' : ''); if (GMOD.tex.has(k)) return GMOD.tex.get(k);
  let res = -1;
  const rr = 'materials/' + ruta + '.vtf', max = ico ? 64 : (GFX && GFX.texMax) || 1024;
  let b = null;
  if (!GMOD.arch.has(rr) && GMPZ.idx.has(rr)) {
    b = gmVtfYa(rr, max);
    if (!b) {
      if (ico) { gmPzVtf(rr, max); return -1; }   // (el ícono, cuando llegue: no se guarda el -1)
      const ti = DATA.tx.length; DATA.tx.push({ n: 'GMA_' + ruta, a: 0, w: 4, h: 4, gm: 1 }); R.tex[ti] = { gl: null };
      GMOD.tex.set(k, ti); gmPzVtf(rr, max).then((u) => gmTexLlenar(ti, u, ruta, max)); return ti;
    }
  } else b = gmArchivo(rr);
  if (b) {
    try {
      const t = GMF.vtf(b, max), px = GMF.vtfRGBA(t);
      let alfa = false; if (t.alfa) for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { alfa = true; break; }
      res = ico ? { w: t.w, h: t.h, px } : gmTexSubir(px, t.w, t.h, 'GMA_' + ruta, alfa);
    } catch (e) { gmErr('vtf ' + ruta, e); }
  }
  if (res === -1 && !ico) { res = gmTexDelJuego(ruta); if (res < 0) res = gmTexFaltante(); }
  GMOD.tex.set(k, res); return res;
}

// ---------------- materiales ----------------
// tex: el nombre de la textura del modelo; carpetas: sus $cdmaterials. Devuelve { mi, vmt }
function gmVmtRuta(tex, carpetas) {
  for (const c of carpetas.length ? carpetas : ['']) { const r = (c ? c.replace(/\/?$/, '/') : '') + tex; if (gmArchivo('materials/' + r + '.vmt')) return r; }
  return null;
}
function gmMaterial(tex, carpetas) {
  const k = tex + '|' + carpetas.join(','); if (GMOD.mats.has(k)) return GMOD.mats.get(k);
  const rv = gmVmtRuta(tex, carpetas);
  let v = null;
  if (rv) try { v = GMF.vmt(gmArchivo('materials/' + rv + '.vmt'), (p) => gmArchivo('materials/' + p.replace(/\.vmt$/, '') + '.vmt')); } catch (e) { gmErr('vmt ' + rv, e); }
  let ti;
  if (v && v.base) ti = gmTextura(v.base);
  else if (v) ti = gmTexBlanca();
  else { ti = -1; for (const c of carpetas.length ? carpetas : ['']) { const r = (c ? c.replace(/\/?$/, '/') : '') + tex; if (gmExiste('materials/' + r + '.vtf')) { ti = gmTextura(r); break; } } if (ti < 0) { ti = gmTexDelJuego((carpetas[0] || '') + tex); if (ti < 0) ti = gmTexFaltante(); } }
  const color = v && v.color ? [v.color[0], v.color[1], v.color[2], 1] : [1, 1, 1, 1];
  let modo = 'op';
  if (v) {
    if (v.alfa < 0.99) { color[3] = Math.max(0.18, v.alfa); modo = 'blend'; }
    if (v.trans) modo = 'blend'; else if (v.corte) modo = 'cut';
    if (v.suma) modo = 'add'; else if (v.sinLuz && modo === 'op') modo = 'unlit';
    if (v.shader === 'refract' && !v.base) { modo = 'blend'; color[3] = 0.3; }   // (vidrio que refracta: se ve a través)
  }
  const mi = DATA.mt.length, m = { n: 'GMA_' + tex, t: ti, ts: [1, 1], to: [0, 0], tt: { _MainTex: [ti, 1, 1, 0, 0] }, cc: { _Color: color }, c: color, f: {}, gm: 1 };
  if (modo === 'cut') { m.sh = 'Standard'; m.f = { _Mode: 1, _Glossiness: v && v.phong ? 0.35 : 0.15, _Metallic: 0 }; }
  else if (modo === 'blend') m.sh = 'Legacy Shaders/Transparent/Diffuse';
  else if (modo === 'add') m.sh = 'Particles/Additive';
  else if (modo === 'unlit') m.sh = 'Unlit/Texture';
  else { m.sh = 'Standard'; m.f = { _Mode: 0, _Glossiness: v && (v.phong || v.env) ? 0.4 : 0.12, _Metallic: 0 }; }
  if (v && v.nodraw) m.sh = 'ShadowDrawer';   // ($no_draw: la pieza no se dibuja, como en Source)
  const res = { mi, vmt: v, dos: !!(v && v.dosLados) }; DATA.mt.push(m);
  GMOD.mats.set(k, res); return res;
}

// ---------------- mallas ----------------
const _f2hB = new Float32Array(1), _f2hI = new Uint32Array(_f2hB.buffer);
function gmF2H(v) {
  _f2hB[0] = v; const x = _f2hI[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
  if (e <= 0) return s; if (e >= 31) return s | 0x7c00;
  return s | (e << 10) | ((m + 0x1000) >>> 13);
}
// una malla del juego en un bloque propio (registrado como paquete ya bajado): posiciones en 16 bits sobre la caja,
// normal en 8, UV en medio float; los triángulos por material
// niveles de detalle (LOD) de una malla de addon: la mayoría de los modelos del Workshop no trae los suyos (en 755
// modelos medidos, 72) y los más pesados (personajes de 20-31 mil triángulos) nunca. Se arman juntando los vértices
// por celdas de una grilla: cada celda queda en su vértice más cercano al promedio, así que los vértices (con su piel)
// son los mismos y sólo cambian los índices. Medido con Trevor (GTA V), Master Chief y SCP-096: juntar sólo por
// posición conserva la silueta (98-100 % del área con celdas de 4 cm) mientras que separar por islas de la malla la
// encoge (79-95 %) con la misma cantidad de triángulos. Cada nivel guarda su celda (en metros) y el dibujo elige el
// más simple cuyo error en la pantalla no pase de GFX.lodPx píxeles. Metas: la mitad, un quinto y un catorceavo.
const GM_LOD_MIN = 1200;
function gmLodGen(P, N, U, porSub) {
  let T = 0; for (const L of porSub) T += L.length / 3;
  if (T < GM_LOD_MIN) return null;
  const n = P.length / 3, usado = new Uint8Array(n), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const L of porSub) for (let t = 0; t < L.length; t++) usado[L[t]] = 1;
  for (let k = 0; k < n; k++) if (usado[k]) for (let c = 0; c < 3; c++) { const v = P[k * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  const tam = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]); if (!(tam > 0)) return null;
  // (tabla hash propia: celda → grupo)
  let cap = 1; while (cap < n * 2) cap <<= 1; const sh = 32 - Math.log2(cap), mk = cap - 1;
  const kc = new Int32Array(cap), val = new Int32Array(cap), cl = new Int32Array(n), S = new Float64Array(n * 4), mejor = new Float64Array(n), quien = new Int32Array(n), rep = new Int32Array(n);
  const juntar = (g) => {
    const inv = Math.min(g, 1023) / tam; val.fill(-1); let nc = 0;
    for (let k = 0; k < n; k++) {
      if (!usado[k]) continue;
      const ix = Math.min(1023, ((P[k * 3] - mn[0]) * inv) | 0), iy = Math.min(1023, ((P[k * 3 + 1] - mn[1]) * inv) | 0), iz = Math.min(1023, ((P[k * 3 + 2] - mn[2]) * inv) | 0);
      const cel = (ix << 20) | (iy << 10) | iz;
      let h = Math.imul(cel, 0x9e3779b1) >>> sh;
      while (val[h] !== -1 && kc[h] !== cel) h = (h + 1) & mk;
      if (val[h] === -1) { kc[h] = cel; val[h] = nc; S[nc * 4] = S[nc * 4 + 1] = S[nc * 4 + 2] = S[nc * 4 + 3] = 0; mejor[nc] = 1e30; nc++; }
      const c = cl[k] = val[h]; S[c * 4] += P[k * 3]; S[c * 4 + 1] += P[k * 3 + 1]; S[c * 4 + 2] += P[k * 3 + 2]; S[c * 4 + 3]++;
    }
    for (let k = 0; k < n; k++) {
      if (!usado[k]) continue;
      const c = cl[k], w = S[c * 4 + 3], dx = P[k * 3] - S[c * 4] / w, dy = P[k * 3 + 1] - S[c * 4 + 1] / w, dz = P[k * 3 + 2] - S[c * 4 + 2] / w, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < mejor[c]) { mejor[c] = d2; quien[c] = k; }
    }
    for (let k = 0; k < n; k++) if (usado[k]) rep[k] = quien[cl[k]];
    let nt = 0; for (const L of porSub) for (let t = 0; t + 2 < L.length; t += 3) { const a = rep[L[t]], b = rep[L[t + 1]], c = rep[L[t + 2]]; if (a !== b && b !== c && a !== c) nt++; }
    return nt;
  };
  const armar = (g) => { const out = porSub.map((L) => { const o = []; for (let t = 0; t + 2 < L.length; t += 3) { const a = rep[L[t]], b = rep[L[t + 1]], c = rep[L[t + 2]]; if (a !== b && b !== c && a !== c) o.push(a, b, c); } return o; }); let nt = 0; for (const o of out) nt += o.length / 3; return { s: tam / Math.min(g, 1023), nt, sub: out }; };
  // (la cantidad de triángulos crece como g²: se apunta con una medida y se corrige bajando la grilla)
  const lods = []; const g0 = 64, n0 = juntar(g0);
  for (const meta of [0.5, 0.2, 0.07]) {
    const objetivo = T * meta; if (objetivo < 60) break;
    let g = Math.max(4, Math.min(1023, Math.floor(g0 * Math.sqrt(objetivo / Math.max(1, n0))))), nt = juntar(g);
    for (let i = 0; i < 6 && nt > objetivo && g > 4; i++) { g = Math.max(4, Math.floor(g * 0.82)); nt = juntar(g); }
    if (nt > objetivo || nt < 40) break;
    if (lods.length && nt >= lods[lods.length - 1].nt * 0.8) continue;
    lods.push(armar(g));
  }
  return lods.length ? lods : null;
}
// LM (opcional): las coordenadas de la luz horneada (lightmap) de cada vértice, 0..1 en el atlas lmT del mapa
function gmMallaNueva(nombre, P, N, U, porSub, conLod, LM, lmT) {
  const n = P.length / 3, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) { const v = P[k * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  const sc = mx.map((v, c) => Math.max(1e-6, v - mn[c]));
  let lods = null; if (conLod) try { lods = gmLodGen(P, N, U, porSub); } catch (e) { lods = null; }
  let ni = 0; for (const L of porSub) ni += L.length;
  if (lods) for (const l of lods) for (const L of l.sub) ni += L.length;
  const i32 = n > 65535, vb = n * 14, io = (vb + 3) & ~3, fi = io + ni * (i32 ? 4 : 2), lo = LM ? (fi + 3) & ~3 : fi, buf = new Uint8Array(lo + (LM ? n * 4 : 0)), dv = new DataView(buf.buffer);
  if (LM) for (let k = 0; k < n * 2; k++) dv.setUint16(lo + k * 2, Math.max(0, Math.min(65535, Math.round(LM[k] * 65535))), true);
  for (let k = 0; k < n; k++) {
    const o = k * 14;
    for (let c = 0; c < 3; c++) dv.setUint16(o + c * 2, Math.round((P[k * 3 + c] - mn[c]) / sc[c] * 65535), true);
    for (let c = 0; c < 3; c++) dv.setInt8(o + 6 + c, Math.max(-127, Math.min(127, Math.round(N[k * 3 + c] * 127))));
    dv.setUint16(o + 10, gmF2H(U[k * 2]), true); dv.setUint16(o + 12, gmF2H(U[k * 2 + 1]), true);
  }
  const sub = []; let q = 0;
  const poner = (L, dest) => { dest.push([q, L.length]); for (const i of L) { if (i32) dv.setUint32(io + q * 4, i, true); else dv.setUint16(io + q * 2, i, true); q++; } };
  for (const L of porSub) poner(L, sub);
  const lod = lods ? lods.map((l) => { const s = []; for (const L of l.sub) poner(L, s); return { s: l.s, nt: l.nt, sub: s }; }) : undefined;
  const key = 'gm' + ++GMOD.bin; RBP.bins[key] = buf; RBP.est[key] = 'ok';
  const mi = DATA.ms.length, d = { n: nombre, o: 0, v: n, mn, sc, i: io, i32, sub, k: key, lod }; if (LM) { d.lm = lo; d.lmT = lmT; }
  DATA.ms.push(d);
  return mi;
}
// una "malla" sólo con los puntos de un casco de choque (para objetos.js: d.hp)
function gmCascoNuevo(nombre, pts) {
  const n = pts.length / 3, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) { const v = pts[k * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  const sc = mx.map((v, c) => Math.max(1e-6, v - mn[c])), hp = [];
  for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) hp.push(Math.round((pts[k * 3 + c] - mn[c]) / sc[c] * 65535));
  const mi = DATA.ms.length; DATA.ms.push({ n: nombre, mn, sc, hp, v: 0, sub: [] });
  return mi;
}
// el modelo leído (con su geometría) y en coordenadas del juego, para un cuerpo (bodygroup 0 de cada parte) y piel 0
function gmLeerModelo(ruta) {
  // (su geometría todavía en el disco: se pide y, cuando llega, se rehace lo que lo esperaba; mientras tanto, "pendiente")
  if (GMPZ.idx.size && gmModeloFaltan(ruta).length) { gmModeloPedir(ruta); const e = new Error('pendiente: ' + ruta); e.pendiente = true; throw e; }
  const base = ruta.slice(0, -4), A = { get: gmArchivo };   // (de los addons o de la biblioteca de GMod/HL2)
  const vtx = A.get(base + '.dx90.vtx') || A.get(base + '.vtx') || A.get(base + '.dx80.vtx') || A.get(base + '.sw.vtx');
  const M = GMF.mdl(A.get(ruta), A.get(base + '.vvd'), vtx);
  if (!M.v || !M.mallas) throw new Error('sin geometría');
  return M;
}
const _gmSup = { metal: 'metal', metal_box: 'metal', metalpanel: 'metal', solidmetal: 'metal', canister: 'metal', metalvehicle: 'metal', wood: 'madera', wood_crate: 'madera', wood_box: 'madera', wood_plank: 'madera', wood_furniture: 'madera', plastic: 'plastico', plastic_box: 'plastico', glass: 'vidrio', glassbottle: 'vidrio', concrete: 'concreto', rock: 'concreto', brick: 'concreto', cardboard: 'carton', paper: 'carton', rubber: 'goma', rubbertire: 'goma', flesh: 'carne', watermelon: 'carne', computer: 'plastico', tile: 'concreto', porcelain: 'vidrio' };
// las UV de cada malla de Source llevadas cerca de 0 (hay modelos con UV entre 4 y 5: se repite igual, pero así no se
// pierde precisión en la GPU; cada malla tiene sus propios vértices, así que se corre entera por un entero)
function gmUVcorr(M) {
  const V = M.v, n = V.n, o = new Float32Array(n * 2);
  for (const m of M.mallas) {
    const T = m.tris; let mu = 1e9, mv = 1e9;
    for (let t = 0; t < T.length; t++) { const k = T[t]; if (V.uv[k * 2] < mu) mu = V.uv[k * 2]; if (V.uv[k * 2 + 1] < mv) mv = V.uv[k * 2 + 1]; }
    if (mu > 1e8) continue; const du = Math.floor(mu), dv = Math.floor(mv); if (!du && !dv) continue;
    for (let t = 0; t < T.length; t++) { const k = T[t]; o[k * 2] = du; o[k * 2 + 1] = dv; }
  }
  return o;
}
function gmPrefab(nombre) {
  if (DATA.pfPorNombre[nombre]) return nombre;
  const ruta = nombre.replace(/^gm:/, '');
  if (!gmArchivo(ruta)) return null;
  let M;
  try { M = gmLeerModelo(ruta); } catch (e) { if (!e.pendiente) gmErr('mdl ' + ruta, e); return null; }
  const V = M.v, n = V.n, P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), Uc = gmUVcorr(M);
  // (¿la pose de enlace del .vvd o la del primer cuadro de su primera secuencia? Casi siempre son iguales; si no, la que
  // mejor calce con su casco de choque: en los aviones WAC la raíz va girada −90° en la secuencia y el casco está en esa
  // pose —con la de enlace el avión se veía de costado—; en los mangos de los sables el casco calza con la de enlace)
  const phy = gmArchivo(ruta.slice(0, -4) + '.phy'); let Fphy = null; try { Fphy = phy ? GMF.phy(phy) : null; } catch (e) { Fphy = null; }
  // (la caja que guarda el .mdl la arma el compilador con la secuencia, no con la pose de enlace: si calza con la pose y no
  // con la de enlace, ésa es la que GMod muestra. Las camas del Liminal Hotel tienen la raíz girada 90° en «idle» y sin
  // esto quedaban atravesando la pared de cada habitación)
  const H0 = M.hull, hullOk = H0 && [0, 1, 2].some((c) => Math.abs(H0[1][c] - H0[0][c]) > 1);
  let RP = GMF.poseReposo && (Fphy || hullOk) ? GMF.poseReposo(M) : null, VP = V;
  if (RP) {
    const calce = (pos, piezas) => { const a = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9], b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (let k = 0; k < pos.length; k += 3) for (let c = 0; c < 3; c++) { a[c] = Math.min(a[c], pos[k + c]); a[c + 3] = Math.max(a[c + 3], pos[k + c]); } let hay = false; for (const x of piezas) for (let k = 0; k < x.pts.length; k += 3) { hay = true; for (let c = 0; c < 3; c++) { b[c] = Math.min(b[c], x.pts[k + c]); b[c + 3] = Math.max(b[c + 3], x.pts[k + c]); } } return hay ? Math.max(...[0, 1, 2].map((c) => Math.abs(a[c] - b[c]) + Math.abs(a[c + 3] - b[c + 3]))) : 1e9; };
    const calceH = (pos) => calce(pos, [{ pts: [H0[0][0], H0[0][1], H0[0][2], H0[1][0], H0[1][1], H0[1][2]] }]);
    try {
      const VPp = GMF.posar(M, RP); let usar = false;
      if (Fphy) { const fB = calce(V.pos, GMF.phyModelo(Fphy, M, null)), fP = calce(VPp.pos, GMF.phyModelo(Fphy, M, RP)); usar = fB > 8 && fP < fB * 0.5; }
      if (!usar && hullOk) { const hB = calceH(V.pos), hP = calceH(VPp.pos); usar = hB > 8 && hP < hB * 0.5; }
      if (usar) VP = VPp; else RP = null;
    } catch (e) { RP = null; }
  }
  // (x, y, z) de Source → (y, z, x) del juego, en metros; la V de las texturas, al revés
  for (let k = 0; k < n; k++) {
    P[k * 3] = VP.pos[k * 3 + 1] * GM_S; P[k * 3 + 1] = VP.pos[k * 3 + 2] * GM_S; P[k * 3 + 2] = VP.pos[k * 3] * GM_S;
    N[k * 3] = VP.nor[k * 3 + 1]; N[k * 3 + 1] = VP.nor[k * 3 + 2]; N[k * 3 + 2] = VP.nor[k * 3];
    U[k * 2] = V.uv[k * 2] - Uc[k * 2]; U[k * 2 + 1] = 1 - (V.uv[k * 2 + 1] - Uc[k * 2 + 1]);
  }
  // las caras por material (piel 0; de cada parte del cuerpo, la primera variante)
  const porMat = new Map(), piel = M.pieles[0] || [];
  for (const m of M.mallas) {
    if (m.modelo !== 0) continue;
    const ti = piel[m.mat] !== undefined ? piel[m.mat] : m.mat, tex = M.texturas[ti] || M.texturas[m.mat] || 'error';
    const mat = gmMaterial(tex, M.carpetas);
    let L = porMat.get(mat.mi); if (!L) porMat.set(mat.mi, (L = []));
    const T = m.tris;
    for (let t = 0; t + 2 < T.length; t += 3) { L.push(T[t], T[t + 2], T[t + 1]); if (mat.dos) L.push(T[t], T[t + 1], T[t + 2]); }   // (Source va al revés)
  }
  if (!porMat.size) { gmErr('mdl ' + ruta, 'sin caras'); return null; }
  const mats = [...porMat.keys()], mi = gmMallaNueva('GMA_' + ruta, P, N, U, mats.map((k) => porMat.get(k)), true);
  // choques: las piezas del .phy (o el casco de la malla)
  const col = []; let masa = null, sup = null;
  if (Fphy) {
    try {
      const F = Fphy; masa = F.masa; sup = F.superficie;
      for (const pz of GMF.phyModelo(F, M, RP).slice(0, 24)) {
        const f = pz.pts, g = new Float32Array(f.length);
        // (piezas rotas del .phy, con puntos fuera de todo tamaño: se saltean; si no queda ninguna, el casco de la malla)
        let mal = f.length < 12; for (let k = 0; k < f.length && !mal; k++) if (!Number.isFinite(f[k]) || Math.abs(f[k]) > 20000) mal = true;
        if (mal) continue;
        for (let k = 0; k < f.length; k += 3) { g[k] = f[k + 1] * GM_S; g[k + 1] = f[k + 2] * GM_S; g[k + 2] = f[k] * GM_S; }
        col.push({ k: 'm', m: gmCascoNuevo('GMA_col_' + ruta, g), cv: 2, tr: 0 });
      }
    } catch (e) { gmErr('phy ' + ruta, e); col.length = 0; }
  }
  if (!col.length) col.push({ k: 'm', m: mi, cv: 2, tr: 0 });
  if (!masa) { const d = DATA.ms[mi]; masa = clamp(d.sc[0] * d.sc[1] * d.sc[2] * 180, 1, 2000); }
  const key = nombre + '#gm';
  DATA.pf[key] = [{ n: nombre, p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], pa: -1, m: mi, mt: mats, col, rb: { m: clamp(masa, 0.5, 50000), d: 0, k: 0, g: 1, snd: _gmSup[sup] || 'metal' }, mb: ['Prop'], gm: ruta }];
  DATA.pfPorNombre[nombre] = key;
  GMOD.pf.set(nombre, { ruta, M });
  return nombre;
}

// ---------------- íconos (el modelo de costado, dibujado en 2D con su textura y luz, como los spawnicons de GMod) ----------------
function gmIcono(nombre) {
  if (GMOD.iconos.has(nombre)) return GMOD.iconos.get(nombre) || GM_ICO_VACIO;   // ('' = no se pudo dibujar: GMOD.icoFallo)
  if (!GMOD.colaIco.includes(nombre)) { GMOD.colaIco.push(nombre); if (GMOD.colaIco.length === 1) setTimeout(gmIconosPaso, 30); }
  return GM_ICO_VACIO;
}
function gmIconosPaso() {
  const t0 = performance.now();
  while (GMOD.colaIco.length && performance.now() - t0 < 25) {
    const nombre = GMOD.colaIco.shift(); let url = '';
    // (no está a mano: si es del contenido base de GMod/HL2 se está pidiendo —gmArchivo lo pide— y se vuelve a probar; si
    // no, el addon ya no está montado)
    if (!gmArchivo(nombre.replace(/^gm:/, ''))) {
      const I = GMOD.icoIntentos || (GMOD.icoIntentos = new Map()), n = I.get(nombre) || 0;
      if (gmExiste(nombre.replace(/^gm:/, '')) && n < 30) { I.set(nombre, n + 1); setTimeout(() => { GMOD.colaIco.push(nombre); if (GMOD.colaIco.length === 1) setTimeout(gmIconosPaso, 16); }, 500); }
      continue;
    }
    // (las texturas del modelo que están en el disco: primero se leen —sólo su nivel chico— y el ícono vuelve a la cola)
    const falta = GMOD.icoEspera && GMOD.icoEspera.has(nombre) ? [] : gmIconoTexturasFaltan(nombre.replace(/^gm:/, ''));
    if (falta.length) { (GMOD.icoEspera || (GMOD.icoEspera = new Set())).add(nombre); Promise.all(falta.map((r) => gmPzVtf(r, 64))).then(() => { GMOD.colaIco.push(nombre); if (GMOD.colaIco.length === 1) setTimeout(gmIconosPaso, 16); }); continue; }
    try { url = gmIconoDibujar(nombre.replace(/^gm:/, '')); } catch (e) { if (e.pendiente) { gmModeloPedir(nombre.replace(/^gm:/, ''), () => { GMOD.colaIco.push(nombre); if (GMOD.colaIco.length === 1) setTimeout(gmIconosPaso, 16); }); continue; } gmErr('ícono ' + nombre, e); }
    GMOD.iconos.set(nombre, url);
    if (!url) (GMOD.icoFallo || (GMOD.icoFallo = new Set())).add(nombre);
    // (en los menús: la foto y su marco, que deja el dibujo de relleno)
    if (url) for (const img of document.querySelectorAll(`img[data-gm="${CSS.escape(nombre)}"]`)) { img.src = url; const f = img.parentElement; if (f && f.classList.contains('ph')) { f.classList.remove('ph'); f.classList.add('mod'); } }
  }
  if (GMOD.colaIco.length) setTimeout(gmIconosPaso, 16);
}
function gmIconoTexturasFaltan(ruta) {
  const out = [];
  try {
    const M = gmLeerModelo(ruta), piel = M.pieles[0] || []; GMOD.icoM = { ruta, M };   // (el ícono lo vuelve a usar enseguida)
    for (const m of M.mallas) {
      if (m.modelo !== 0) continue; const ti = piel[m.mat] !== undefined ? piel[m.mat] : m.mat, rv = gmVmtRuta(M.texturas[ti] || '', M.carpetas); if (!rv) continue;
      const v = GMF.vmt(gmArchivo('materials/' + rv + '.vmt')), r = v && v.base ? 'materials/' + v.base + '.vtf' : null;
      if (r && GMPZ.idx.has(r) && !gmVtfYa(r, 64) && !out.includes(r)) out.push(r);
    }
  } catch (e) {}
  return out;
}
function gmIconoDibujar(ruta) {
  const M = GMOD.icoM && GMOD.icoM.ruta === ruta ? GMOD.icoM.M : gmLeerModelo(ruta), V = M.v, L = 128, cv = document.createElement('canvas'); cv.width = cv.height = L; GMOD.icoM = null;
  const g = cv.getContext('2d'), a = -0.9, b = 0.35, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  // (de costado y un poco desde arriba, como mira GMod)
  const n = V.n, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let k = 0; k < n; k++) {
    const sx = V.pos[k * 3], sy = V.pos[k * 3 + 1], sz = V.pos[k * 3 + 2];
    const rx = sx * ca - sy * sa, ry = sx * sa + sy * ca;   // giro alrededor de Z
    X[k] = ry; Y[k] = sz * cb - rx * sb; Z[k] = sz * sb + rx * cb;
    if (X[k] < x0) x0 = X[k]; if (X[k] > x1) x1 = X[k]; if (Y[k] < y0) y0 = Y[k]; if (Y[k] > y1) y1 = Y[k];
  }
  const esc = (L * 0.86) / Math.max(1e-3, x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const tris = [], piel = M.pieles[0] || [], texs = new Map();
  for (const m of M.mallas) {
    if (m.modelo !== 0) continue;
    const ti = piel[m.mat] !== undefined ? piel[m.mat] : m.mat, tex = M.texturas[ti] || '';
    let T = texs.get(tex);
    if (T === undefined) { T = null; const rv = gmVmtRuta(tex, M.carpetas); let base = null; if (rv) try { const v = GMF.vmt(gmArchivo('materials/' + rv + '.vmt')); base = v && v.base; } catch (e) {} if (base) { const r = gmTextura(base, true); if (r && r !== -1) T = r; } texs.set(tex, T); }
    const I = m.tris, paso = Math.max(1, Math.floor(I.length / 3 / 5000));
    for (let t = 0; t + 2 < I.length; t += 3 * paso) {
      const i0 = I[t], i1 = I[t + 1], i2 = I[t + 2];
      const ux = X[i1] - X[i0], uy = Y[i1] - Y[i0], uz = Z[i1] - Z[i0], vx = X[i2] - X[i0], vy = Y[i2] - Y[i0], vz = Z[i2] - Z[i0];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      let c = [150, 150, 150];
      if (T) { const u = (V.uv[i0 * 2] + V.uv[i1 * 2] + V.uv[i2 * 2]) / 3, w = (V.uv[i0 * 2 + 1] + V.uv[i1 * 2 + 1] + V.uv[i2 * 2 + 1]) / 3; const px = Math.floor(((u % 1) + 1) % 1 * T.w), py = Math.floor(((w % 1) + 1) % 1 * T.h), q = (py * T.w + px) * 4; c = [T.px[q], T.px[q + 1], T.px[q + 2]]; if (T.px[q + 3] < 40) continue; }
      const luz = 0.45 + 0.7 * Math.abs(nx * 0.35 + ny * 0.75 + nz * 0.55);
      tris.push([(Z[i0] + Z[i1] + Z[i2]) / 3, i0, i1, i2, c.map((v) => Math.min(255, v * luz | 0))]);
    }
  }
  tris.sort((p, q) => q[0] - p[0]);
  const sx = (k) => (X[k] - cx) * esc + L / 2, sy = (k) => L / 2 - (Y[k] - cy) * esc;
  for (const [, i0, i1, i2, c] of tris) {
    g.fillStyle = g.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.beginPath(); g.moveTo(sx(i0), sy(i0)); g.lineTo(sx(i1), sy(i1)); g.lineTo(sx(i2), sy(i2)); g.closePath(); g.fill(); g.lineWidth = 0.6; g.stroke();
  }
  return cv.toDataURL('image/webp', 0.85);
}

// ---------------- sonidos de los addons (por su ruta: "weapons/x/disparo.wav" → sound/weapons/x/disparo.wav) ----------------
function gmSonido(ruta) {
  const r = ruta.toLowerCase().replace(/\\/g, '/').replace(/^[)^#*@!<>?~&]+/, '').replace(/^sound\//, ''), n = 'gm:' + r;
  if (PK.extra['a:' + n]) return n;
  const poner = (b) => { try { PK.extra['a:' + n] = r.endsWith('.wav') ? GMF.wav(b) : b; if (!DATA.son.includes(n)) DATA.son.push(n); if (typeof audioBuf === 'function') audioBuf(n); return true; } catch (e) { gmErr('sonido ' + r, e); return false; } };
  // (un sonido grande que quedó en el disco: se lee ahora y se registra al llegar; el primer disparo puede salir mudo)
  if (!GMOD.arch.has('sound/' + r) && GMPZ.idx.has('sound/' + r)) { const c = gmPzTrozo('sound/' + r, GMPZ.idx.get('sound/' + r).t); if (c) return poner(c) ? n : null; if (!GMOD.sonPend) GMOD.sonPend = new Set(); if (!GMOD.sonPend.has(n)) { GMOD.sonPend.add(n); gmPzLeer('sound/' + r).then((u) => { GMOD.sonPend.delete(n); if (u) poner(u); }); } return n; }
  const b = gmArchivo('sound/' + r); if (!b) return null;
  return poner(b) ? n : null;
}

// ---------------- dependencias: las bases de armas y librerías que un addon usa sin traerlas ----------------
// (lo que en el Workshop serían los "Required items": muchos addons viejos lo dicen sólo en la descripción; acá se
// reconoce en su Lua: SWEP.Base/ENT.Base de una base conocida que el addon no trae, o una librería global conocida)
const GM_BASES = { fas2_base: '180507408', fas2_base_shotgun: '180507408', bobs_gun_base: '144982052', bobs_scoped_base: '144982052', bobs_shotty_base: '144982052', wac_hc_base: '953396297', wac_pl_base: '953396297', wac_hc_base_c: '953396297',
  tfa_gun_base: '415143062', tfa_bash_base: '415143062', tfa_melee_base: '415143062', tfa_nade_base: '415143062', tfa_shotty_base: '415143062', tfa_scoped_base: '415143062', cw_base: '349050451', cw_grenade_base: '349050451', arccw_base: '2131057232', arc9_base: '2910505837', mg_base: '2459720887', weapon_cs_base2: '' };
// (bases viejas que el Workshop todavía pide como "Required item" y que ya reemplaza otra: la de los aviones WAC original
// —104990330— trae los mismos archivos que la actual y, con las dos, la cámara de WAC tiraba error)
const GM_EQUIV = { '104990330': '953396297' };
const GM_GLOBALES = [[/\bcreateManagedCModel\b|\bFAS2_/, '180507408'], [/\bwac\.(aircraft|pod|hook|keyboard)\b/, '953396297'], [/\bTFA\.\w+/, '415143062'], [/\bCustomizableWeaponry\b/, '349050451'], [/\bArcCW\b/, '2131057232'], [/\bARC9\b/, '2910505837'], [/\bsimfphys\b/, '771487490']];
function gmDependencias(A) {
  const propias = new Set(), usadas = new Set(), out = new Set(), td = new TextDecoder('latin1');
  for (const r of A.lua) { const m = /^lua\/(weapons|entities)\/([^/]+?)(\.lua|\/)/.exec(r); if (m) propias.add(m[2].toLowerCase()); }
  for (const r of A.lua) {
    const b = A.G.archivos.get(r); if (!b) continue; const s = td.decode(b);
    for (const m of s.matchAll(/\b(?:SWEP|ENT)\.Base\s*=\s*["']([\w-]+)["']/g)) usadas.add(m[1].toLowerCase());
    for (const [re, id] of GM_GLOBALES) if (re.test(s)) out.add(id);
  }
  for (const n of usadas) if (!propias.has(n) && GM_BASES[n]) out.add(GM_BASES[n]);
  // (si la base la trae el mismo addon, la librería también: no se pide)
  for (const [n, id] of Object.entries(GM_BASES)) if (propias.has(n)) out.delete(id);
  return [...out].filter(Boolean);
}
// ---------------- bajar e instalar (con caché en el navegador) ----------------
// los addons bajados quedan en IndexedDB (no se vuelven a bajar); la lista de instalados, en PREFS.gmod
// ---- nada de esperar para siempre: tiempo máximo para cada paso de una descarga (en algunos celulares la base de datos
// de la caché no contesta, o una conexión se queda colgada sin cortar, y la descarga quedaba en 0 % para siempre) ----
function gmTiempo(p, ms, msg) {
  let t = 0; const tope = new Promise((_, mal) => { t = setTimeout(() => mal(Object.assign(new Error(msg || 'tardó demasiado'), { trabado: true })), ms); });
  return Promise.race([p, tope]).finally(() => clearTimeout(t));
}
// fetch con tiempo máximo hasta que contesta (no para el cuerpo: eso lo cuida gmLeerCuerpo)
async function gmFetch(url, opt, ms) {
  const c = typeof AbortController === 'function' ? new AbortController() : null, t = c ? setTimeout(() => c.abort(), ms || 25000) : 0;
  try { return await fetch(url, c ? Object.assign({}, opt || {}, { signal: c.signal }) : opt); }
  catch (e) { if (c && c.signal.aborted) throw Object.assign(new Error('sin respuesta de ' + String(url).split('/')[2]), { trabado: true }); throw e; }
  finally { if (t) clearTimeout(t); }
}
// el cuerpo de una respuesta en pedazos, con el avance; si pasan 30 s sin que llegue nada, se corta (y se reintenta)
async function gmLeerCuerpo(r, tot, prog) {
  if (!(r.body && r.body.getReader)) return new Uint8Array(await gmTiempo(r.arrayBuffer(), 120000, 'la descarga se trabó'));
  const rd = r.body.getReader(), ps = []; let n = 0;
  for (;;) {
    let x; try { x = await gmTiempo(rd.read(), 30000, 'la descarga se trabó'); } catch (e) { try { rd.cancel(); } catch (e2) {} throw e; }
    if (x.done) break; ps.push(x.value); n += x.value.length; if (prog) prog(n / (tot || n * 2), n);
  }
  const b = new Uint8Array(n); let o = 0; for (const p of ps) { b.set(p, o); o += p.length; } return b;
}
const GMDB = { db: null, roto: 0 };
// La caché de los addons (IndexedDB). Dos maneras de pedirle algo:
//  - con paciencia (lo de siempre: montar lo instalado al arrancar, el contenido base, guardar): se espera lo que tarde.
//    En un celular con muchos mods la caché puede tardar varios segundos en contestar, y en la 2.9-prueba8 eso se tomaba
//    como «no está»: los mods y los mapas que traen no se montaban y parecía que se habían perdido;
//  - con tope (sólo para ver si un mod que se va a bajar ya está): si no contesta, se baja igual y por 2 minutos las
//    descargas no la vuelven a esperar. Nunca se da nada por perdido por eso.
function gmDB() {
  if (GMDB.db) return GMDB.db;
  const p = new Promise((ok, mal) => { try { const r = indexedDB.open('rb-gmod', 1); r.onupgradeneeded = () => r.result.createObjectStore('gma'); r.onsuccess = () => { const db = r.result; db.onclose = () => { GMDB.db = null; }; db.onversionchange = () => { try { db.close(); } catch (e) {} GMDB.db = null; }; ok(db); }; r.onerror = () => mal(r.error); } catch (e) { mal(e); } });
  GMDB.db = p.catch((e) => { GMDB.db = null; throw e; });
  return GMDB.db;
}
const gmDBget = (db, id) => new Promise((ok, mal) => { try { const q = db.transaction('gma').objectStore('gma').get(id); q.onsuccess = () => ok(q.result === undefined ? null : q.result); q.onerror = () => mal(q.error || new Error('no se pudo leer')); } catch (e) { mal(e); } });
// lo guardado con esa clave (null si no está); con «tope» (ms), null también si la caché no contesta a tiempo
async function gmCacheLeer(id, tope) {
  if (!tope) { try { return await gmDBget(await gmDB(), id); } catch (e) { return null; } }
  if (GMDB.roto && Date.now() - GMDB.roto < 120000) return null;
  try { return await gmTiempo((async () => gmDBget(await gmDB(), id))(), tope, 'la caché no contesta'); }
  catch (e) { if (e && e.trabado) GMDB.roto = Date.now(); return null; }
}
// como gmCacheLeer con paciencia, pero distingue «no está» (null) de «la caché falló» (undefined)
async function gmCacheLeerSeguro(id) { try { return await gmDBget(await gmDB(), id); } catch (e) { return undefined; } }
// (guardar sí tiene tope: si la caché no contesta, lo bajado se usa igual desde la memoria y, si no se llegó a guardar,
// el próximo arranque lo vuelve a bajar solo)
const gmCacheRota = () => GMDB.roto && Date.now() - GMDB.roto < 120000;
async function gmCacheGuardar(id, b) { if (gmCacheRota()) return; try { await gmTiempo((async () => { const db = await gmDB(); await new Promise((ok) => { const t = db.transaction('gma', 'readwrite'); t.objectStore('gma').put(b, id); t.oncomplete = ok; t.onerror = ok; t.onabort = ok; }); })(), 30000, 'la caché no contesta'); } catch (e) { if (e && e.trabado) GMDB.roto = Date.now(); } }
// el .gma de un addon se guarda como Blob (el navegador lo deja en el disco) y se devuelve el guardado; si el navegador no
// guarda Blobs, como antes (los bytes) y null
async function gmCacheGuardarGMA(id, b) {
  try {
    if (gmCacheRota()) throw new Error('caché no disponible');
    const bl = b instanceof Blob ? b : new Blob([b]);
    const ok = await gmTiempo((async () => { const db = await gmDB(); return new Promise((res, mal) => { try { const t = db.transaction('gma', 'readwrite'); t.objectStore('gma').put(bl, id); t.oncomplete = () => res(true); t.onerror = () => res(false); t.onabort = () => res(false); } catch (e) { mal(e); } }); })(), 30000, 'la caché no contesta');
    if (!ok) throw new Error('no se guardó');
    const r = await gmCacheLeer(id, 15000); return r instanceof Blob ? r : null;
  } catch (e) { if (e && e.trabado) GMDB.roto = Date.now(); if (!(b instanceof Blob)) await gmCacheGuardar(id, b); return null; }
}
// un .gma desde un Blob: la tabla de archivos y lo chico se leen; las texturas y los mapas quedan en el Blob
async function gmaDesdeBlob(bl) {
  let n = Math.min(bl.size, 262144), T = null;
  for (;;) {
    const cab = new Uint8Array(await bl.slice(0, n).arrayBuffer());
    if (!gmEsGMA(cab)) throw new Error('no es un .gma');
    T = GMF.gmaTabla(cab); if (T || n >= bl.size) break;
    n = Math.min(bl.size, n * 4);
  }
  if (!T) throw new Error('gma cortado');
  const archivos = new Map(), perezosos = new Map(), tramos = []; let q = T.ini, tr = null;
  for (const [ruta, t] of T.A) {
    if (ruta.includes('..')) tr = null;
    else if (t >= 65536 && GM_PEREZOSO.test(ruta)) { perezosos.set(ruta, { o: q, t }); tr = null; }
    else { if (!tr || tr.fin !== q) tramos.push((tr = { ini: q, fin: q, f: [] })); tr.f.push([ruta, q, t]); tr.fin = q + t; }
    q += t;
  }
  if (q > bl.size) throw new Error('gma cortado');
  for (const x of tramos) { const u = new Uint8Array(await bl.slice(x.ini, x.fin).arrayBuffer()); for (const [ruta, o, t] of x.f) archivos.set(ruta, u.subarray(o - x.ini, o - x.ini + t)); }
  return { nombre: T.nombre, autor: T.autor, info: T.info, archivos, perezosos, blob: bl };
}
// lo guardado (Blob, o bytes de antes) a un G para montar; los bytes de antes se pasan a Blob (para la próxima)
async function gmaDeCache(id, c) {
  if (!c) return null;
  if (c instanceof Blob) return gmaDesdeBlob(c);
  let b = c instanceof Uint8Array ? c : new Uint8Array(c); if (!gmEsGMA(b)) return null;
  const bl = await gmCacheGuardarGMA(id, b);
  if (bl) { try { return await gmaDesdeBlob(bl); } catch (e) {} }
  return GMF.gma(b);
}
async function gmCacheBorrar(id) { try { const db = await gmDB(); await new Promise((ok) => { const t = db.transaction('gma', 'readwrite'); t.objectStore('gma').delete(id); t.oncomplete = ok; t.onerror = ok; }); } catch (e) {} }

// ---------------- Steam Workshop: detalles y archivos ----------------
// Steam no deja que una página le pida cosas directo (sin CORS): se pasa por la tienda (cuando tiene el puente /gmod/) o
// por un puente público. Los addons sin archivo directo (file_url, ~la mitad de los populares) bajan por SteamPipe con
// la tienda (gmod_pipe.js); si la tienda no está, se importan desde la compu (el .gma de garrysmod/addons).
const GM_PUENTES = ['https://cors.eu.org/'];
async function gmPedir(url, opt) {
  let ult = null;
  for (const p of GM_PUENTES) { try { const r = await gmFetch(p + url, opt, 25000); if (r.ok) return r; ult = new Error('HTTP ' + r.status); } catch (e) { ult = e; } }
  throw ult || new Error('sin conexión');
}
async function gmDetalles(ids) {
  const out = new Map(); ids = [...new Set(ids.map(String))].filter((x) => /^\d{3,12}$/.test(x));
  for (let i = 0; i < ids.length; i += 100) {
    const ch = ids.slice(i, i + 100), body = 'itemcount=' + ch.length + ch.map((x, k) => `&publishedfileids[${k}]=${x}`).join('');
    const d = await (await gmPedir('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })).json();
    for (const x of (d.response && d.response.publishedfiledetails) || []) if (x.result === 1) out.set(x.publishedfileid, x);
  }
  return out;
}
// descomprimir LZMA en otro hilo (un .gma de 50 MB tarda unos segundos: el juego sigue andando)
function gmLZMA(b, prog) {
  return new Promise((ok, mal) => {
    let w = null;
    try {
      const src = 'const GMF={};GMF.lzma=' + GMF.lzma.toString() + ';onmessage=(e)=>{try{const o=GMF.lzma(e.data,(a,t)=>postMessage({p:a/t}));postMessage({o},[o.buffer])}catch(x){postMessage({e:String(x&&x.message||x)})}}';
      w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch (e) { w = null; }
    if (!w) { try { ok(GMF.lzma(b)); } catch (e) { mal(e); } return; }
    // (si el hilo se queda 60 s sin avisar nada, se corta: la cola lo vuelve a intentar)
    let vig = 0; const vigilar = () => { clearTimeout(vig); vig = setTimeout(() => { w.terminate(); mal(Object.assign(new Error('se trabó al descomprimir'), { trabado: true })); }, 60000); }; vigilar();
    w.onmessage = (e) => { const d = e.data; if (d.p !== undefined) { vigilar(); if (prog) prog(d.p); return; } clearTimeout(vig); w.terminate(); if (d.e) mal(new Error(d.e)); else ok(d.o); };
    w.onerror = (e) => { clearTimeout(vig); w.terminate(); try { ok(GMF.lzma(b)); } catch (x) { mal(x); } };
    const c = b.slice(); w.postMessage(c, [c.buffer]);
  });
}
const gmEsGMA = (b) => b && b[0] === 0x47 && b[1] === 0x4d && b[2] === 0x41 && b[3] === 0x44;
// ¿llegó entero? (la tabla de archivos del .gma dice cuánto pesa cada uno: un .gma cortado a la mitad se instalaba roto)
function gmaCompleto(b) {
  try {
    let o = 5 + 16; const str = () => { const e = b.indexOf(0, o); if (e < 0) throw 0; o = e + 1; };
    if (b[4] > 1) { for (;;) { const e = b.indexOf(0, o); if (e < 0) return false; const vacio = e === o; o = e + 1; if (vacio) break; } }
    str(); str(); str(); o += 4;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let tot = 0;
    for (;;) { if (o + 4 > b.length) return false; const n = dv.getUint32(o, true); o += 4; if (!n) break; str(); tot += dv.getUint32(o, true) + dv.getInt32(o + 4, true) * 4294967296; o += 12; }
    return b.length >= o + tot;
  } catch (e) { return false; }
}
// el .gma de un addon del Workshop (de la caché o bajado de Steam), ya sin comprimir. Orden: el archivo directo por la
// tienda, el del catálogo, SteamPipe por la tienda (los que no tienen archivo directo: gmod_pipe.js) y, si la tienda no
// tiene el puente, el archivo directo por un puente público
async function gmBajar(wid, prog) {
  const c = await gmCacheLeer(String(wid), 10000); if (c && (c instanceof Blob || gmEsGMA(c))) return c;
  let r = null, tot = 0, sinDir = false, b = null, errPipe = null;
  if (typeof gmApiHay === 'function' && (await gmApiHay())) {
    try { const x = await gmFetch(TIENDA_URL + 'gmod/archivo/' + wid, null, 25000); if (x.ok) { r = x; tot = +x.headers.get('content-length') || 0; } else if (x.status === 409) sinDir = true; else if (x.status === 404) throw new Error(T('gm.noExiste')); }
    catch (e) { if (e.message === T('gm.noExiste')) throw e; }
  }
  // (el servidor de archivos de Steam deja bajar desde una página: con la dirección del catálogo, sin ningún puente)
  if (!r && !sinDir && typeof gmCatalogo === 'function') {
    const C = await gmCatalogo(), x = C && C.porId.get(String(wid));
    if (x && x.f) { try { const y = await gmFetch(x.f, null, 25000); if (y.ok) { r = y; tot = +y.headers.get('content-length') || Math.round(x.mb * 1e6); } } catch (e) {} }
  }
  if (!r && typeof gpBajar === 'function') {
    try { b = await gpBajar(wid, prog); } catch (e) { if (e.noExiste) throw e; errPipe = e; }
  }
  if (!r && !b) {
    if (sinDir) throw errPipe && !errPipe.sinPuente ? errPipe : Object.assign(new Error(T('gm.sinArchivo')), { sinArchivo: true });
    const det = (await gmDetalles([wid])).get(String(wid));
    if (!det) throw new Error(T('gm.noExiste'));
    if (!det.file_url) throw errPipe && !errPipe.sinPuente ? errPipe : Object.assign(new Error(T('gm.sinArchivo')), { sinArchivo: true });
    try { const y = await gmFetch(det.file_url, null, 25000); if (y.ok) r = y; } catch (e) {}
    if (!r) r = await gmPedir(det.file_url);
    tot = +r.headers.get('content-length') || +det.file_size || 0;
  }
  if (!b) b = await gmLeerCuerpo(r, tot, (p) => prog && prog(0.7 * p, 'bajando'));
  if (!gmEsGMA(b)) b = await gmLZMA(b, (p) => prog && prog(0.7 + 0.3 * p, 'descomprimiendo'));
  if (!gmEsGMA(b)) throw new Error('no es un .gma');
  if (!gmaCompleto(b)) throw Object.assign(new Error('llegó cortado'), { trabado: true });
  // (guardado como Blob y devuelto el guardado: lo bajado no queda en memoria)
  return (await gmCacheGuardarGMA(String(wid), b)) || b;
}
// los "Required items" de la página del Workshop (lo que el autor marcó que hace falta: la base, las texturas...): por la
// cuánto pesa un addon del Workshop (MB), sin bajarlo: del catálogo o de lo que dice la tienda por SteamPipe; null si no
// se sabe. Y cuánto contenido pedido por un addon se baja solo (en celulares con poca memoria, menos)
async function gmPesoMB(wid) {
  try { const d = typeof gmCatalogo === 'function' ? await gmCatalogo() : null, x = d && (d.porId ? d.porId.get(String(wid)) || d.porId.get(+wid) : null); if (x && x.mb) return +x.mb; } catch (e) {}
  try { const c = new AbortController(), t = setTimeout(() => c.abort(), 8000), r = await fetch(TIENDA_URL + 'gmod/pipe/' + wid, { signal: c.signal }); clearTimeout(t); if (r.ok) { const j = await r.json(); if (j && j.tam) return j.tam / 1e6; } } catch (e) {}
  return null;
}
const GM_TOPE_DEPS_MB = () => (navigator.deviceMemory && navigator.deviceMemory <= 4 ? 60 : 200);
// tienda o, si no está, leyendo la página con el lector
async function gmRequeridos(wid) {
  // (con tope de tiempo: si no contesta, el addon queda instalado igual, sin lo que pide)
  const pedir = async (u, ms) => { const c = typeof AbortController === 'function' ? new AbortController() : null, t = c ? setTimeout(() => c.abort(), ms) : 0; try { return await fetch(u, c ? { signal: c.signal } : undefined); } finally { if (t) clearTimeout(t); } };
  if (typeof gmApiHay === 'function' && (await gmApiHay())) {
    try { const r = await pedir(TIENDA_URL + 'gmod/requiere/' + wid, 8000); if (r.ok) return ((await r.json()).ids || []).map(String).filter((x) => /^\d{3,12}$/.test(x)); } catch (e) {}
  }
  if (typeof GM_LECTOR === 'undefined') return [];
  const h = await (await pedir(GM_LECTOR + 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + wid, 8000)).text(), i = h.indexOf('Required items');
  if (i < 0) return [];
  let t = h.slice(i, i + 4000); const f = t.search(/Created by|\nDescription\n/); if (f > 0) t = t.slice(0, f);
  return [...new Set([...t.matchAll(/filedetails\/\?id=(\d{3,12})/g)].map((m) => m[1]))].filter((x) => x !== String(wid)).slice(0, 20);
}
// instalar: bajar (o tomar los bytes dados), montar y anotarlo como instalado
async function gmInstalar(wid, meta, bytes, prog) {
  wid = String(wid);
  if (GMOD.addons.has(wid)) {
    // (estaba de visita —el modelo de otro jugador— y ahora lo instala uno: pasa a ser suyo, con su Lua y en su lista)
    const A0 = GMOD.addons.get(wid);
    if (A0.visita && !(meta && meta.visita)) {
      A0.visita = false; A0.lua = [...A0.G.archivos.keys()].filter((r) => r.endsWith('.lua'));
      PREFS.gmod = PREFS.gmod || {}; PREFS.gmod[wid] = { n: A0.nombre, t: Date.now(), img: (meta && meta.img) || '' }; guardarPrefs();
      if (typeof gmLuaMontar === 'function') try { gmLuaMontar(A0); } catch (e) { gmErr('lua ' + wid, e); }
      gmMenu();
    }
    return A0;
  }
  // (lo que pide su página se pregunta una vez y queda anotado con el addon, así reinstalarlo desde la caché no pide nada;
  // se pregunta mientras baja, para no sumar demora)
  const prof = (meta && meta.prof) || 0, reqAnt = (PREFS.gmod && PREFS.gmod[wid] && PREFS.gmod[wid].req) || GMOD.req.get(wid);
  const sinDeps = !!(meta && meta.sinDeps), reqP = sinDeps || prof >= 2 || !/^\d+$/.test(wid) ? Promise.resolve([]) : reqAnt ? Promise.resolve(reqAnt) : gmRequeridos(wid).catch(() => null);
  let b = bytes || (await gmBajar(wid, prog)), G = null;
  if (b instanceof Blob) G = await gmaDesdeBlob(b);
  else {
    if (!gmEsGMA(b)) b = await gmLZMA(b, prog);
    // (guardado como Blob y montado desde ahí: lo grande —texturas, mapas— no queda en memoria)
    const bl = await gmCacheGuardarGMA(wid, b);
    if (bl) { try { G = await gmaDesdeBlob(bl); } catch (e) { G = null; } }
    if (!G) G = GMF.gma(b);
  }
  b = null;
  // (si la cola ya dio este intento por trabado y empezó otro, el aviso de avance corta acá: no se monta dos veces)
  if (prog) prog(0.99, 'montando');
  const A = gmMontar(wid, G, meta);
  await A.listo;
  // (las bases que usa y no trae, y los "Required items" de su página del Workshop (texturas, bases): se instalan antes y
  // se vuelve a cargar el Lua en orden, como las dependencias del Workshop; hasta dos niveles)
  const req = await reqP;
  if (Array.isArray(req) && /^\d+$/.test(wid)) GMOD.req.set(wid, req);
  const deps0 = new Set([...gmDependencias(A), ...(req || [])]), deps = [...deps0].filter((d) => d !== wid && !GMOD.addons.has(d) && !(GM_EQUIV[d] && (GMOD.addons.has(GM_EQUIV[d]) || deps0.has(GM_EQUIV[d]))));
  if (deps.length && prof < 2 && !sinDeps) {
    A.deps = []; A.depsGrandes = [];
    // (con tope de peso: un modo de juego pedía 150 + 117 MB de contenido y el navegador se quedaba sin memoria; lo que no
    // entra en el tope no se baja solo, queda anotado y avisado para instalarlo aparte desde la tienda)
    let resto = GM_TOPE_DEPS_MB();
    for (const d of deps) {
      const mb = await gmPesoMB(d);
      if (mb !== null && mb > resto) { A.depsGrandes.push({ id: d, mb: Math.round(mb) }); continue; }
      try { const B = await gmInstalar(d, { prof: prof + 1 }); A.deps.push(B.nombre); resto -= mb || 0; } catch (e) { gmErr('dependencia ' + d, e); }
    }
    if (A.depsGrandes.length && typeof aviso === 'function') aviso(T('gm.depGrande').replace('{n}', A.depsGrandes.length).replace('{mb}', A.depsGrandes.reduce((x, y) => x + y.mb, 0)), 6);
    if (A.deps.length) { GMOD.addons.delete(wid); GMOD.addons.set(wid, A); if (typeof gmLuaDesmontar === 'function') gmLuaDesmontar(); }
  }
  if (A.visita) return A;   // (de visita no queda entre los instalados: la próxima vez se toma de la caché si hace falta)
  PREFS.gmod = PREFS.gmod || {}; PREFS.gmod[wid] = { n: A.nombre, t: Date.now(), img: (meta && meta.img) || '' }; if (Array.isArray(req) && /^\d+$/.test(wid)) PREFS.gmod[wid].req = req.slice(0, 20); guardarPrefs();
  return A;
}
// el addon que trae un archivo (el de un modelo de jugador, para decirles a los demás cuál bajar)
function gmAddonDe(ruta) { for (const A of GMOD.addons.values()) if (A.G.archivos.has(ruta) || (A.G.perezosos && A.G.perezosos.has(ruta))) return A; return null; }
// el modelo de jugador de otro (multijugador): se baja de visita —sólo sus archivos, sin su Lua y sin sumarlo a tus mods—
// si está en el catálogo, pesa poco y no está censurado; de a uno, y una sola vez por addon
const GMVIS = { cola: Promise.resolve(), pedidos: new Map(), topeMB: 60 };
function gmVisita(wid, op) {
  wid = String(wid); if (!/^\d{3,12}$/.test(wid)) return Promise.resolve(null);
  if (GMOD.addons.has(wid)) { const A = GMOD.addons.get(wid); return Promise.resolve(A.listo).then(() => A); }
  if (GMVIS.pedidos.has(wid)) return GMVIS.pedidos.get(wid);
  const pr = (GMVIS.cola = GMVIS.cola.catch(() => {}).then(async () => {
    if (typeof PREFS !== 'undefined' && PREFS.verModsOtros === false) return null;
    const C = typeof gmCatalogo === 'function' ? await gmCatalogo() : null;
    let c = C && C.porId.get(wid);
    // (si no está en el catálogo —un modelo que el otro encontró buscando en el Workshop—, sus datos se le piden a Steam:
    // antes no se bajaba y los demás lo veían con el Hero)
    if (!c && typeof gmDetalles === 'function') {
      try { const x = (await gmDetalles([wid])).get(wid); if (x) c = { id: wid, t: x.title || wid, img: x.preview_url || '', mb: (+x.file_size || 0) / 1048576, tags: (x.tags || []).map((g) => g.tag), d: String(x.description || '').slice(0, 500) }; } catch (e) { c = null; }
    }
    if (!c || !(c.mb <= ((op && op.topeMB) || GMVIS.topeMB)) || (typeof censModMotivo === 'function' && censModMotivo(c))) return null;
    const A = await gmInstalar(wid, { nombre: c.t, img: c.img, visita: true, sinDeps: true }, null, op && op.prog);
    if (A && typeof censModMotivo === 'function' && A.cens) return null;
    return A;
  })).catch((e) => { gmErr('visita ' + wid, e); return null; });
  // (si no se pudo —sin conexión, Steam ocupado—, se puede volver a pedir al rato)
  pr.then((A) => { if (!A) setTimeout(() => { if (GMVIS.pedidos.get(wid) === pr) GMVIS.pedidos.delete(wid); }, 20000); });
  GMVIS.pedidos.set(wid, pr); return pr;
}
function gmQuitar(wid) { wid = String(wid); gmDesmontar(wid); if (PREFS.gmod) { delete PREFS.gmod[wid]; guardarPrefs(); } gmCacheBorrar(wid); }
// Habilitado o deshabilitado, como en el menú de addons de GMod (Discord: «opciones para habilitar/deshabilitar y
// habilitar/deshabilitar todos los mods»). Deshabilitado sigue instalado y guardado, pero no se monta: ni su Lua, ni sus
// armas, entidades, NPCs, modelos o mapas. Se aplica al toque, también jugando. Si un server donde estoy lo pide, sigue
// montado hasta salir de la sala; y el modelo de otro jugador que viene de ese addon se sigue viendo (de visita, sin Lua).
const gmHabilitado = (wid) => !(PREFS.gmod && PREFS.gmod[String(wid)] && PREFS.gmod[String(wid)].off);
async function gmHabilitar(wid, on) {
  wid = String(wid); const P = PREFS.gmod && PREFS.gmod[wid]; if (!P || gmHabilitado(wid) === !!on) return false;
  if (on) delete P.off; else P.off = 1;
  guardarPrefs();
  if (!on) {
    if (typeof GMS !== 'undefined' && GMS.sala && GMS.lista.has(wid) && GMOD.addons.has(wid)) GMS.montados.add(wid);
    else gmDesmontar(wid);
    return true;
  }
  const A0 = GMOD.addons.get(wid);
  if (A0) {
    // (estaba montado de visita —el modelo de otro jugador—: pasa a ser suyo otra vez, con su Lua)
    if (A0.visita) { A0.visita = false; A0.lua = [...A0.G.archivos.keys()].filter((r) => r.endsWith('.lua')); if (typeof gmLuaMontar === 'function') try { gmLuaMontar(A0); } catch (e) { gmErr('lua ' + wid, e); } gmMenu(); }
    return true;
  }
  // (de la caché, como al arrancar; si no estaba guardado, se vuelve a bajar)
  try {
    const c = await gmCacheLeerSeguro(wid);
    if (!gmHabilitado(wid) || GMOD.addons.has(wid)) return true;
    const G = c ? await gmaDeCache(wid, c) : null;
    if (!gmHabilitado(wid) || GMOD.addons.has(wid)) return true;
    if (G) { if (typeof cnPaso === 'function') cnPaso('montando el mod ' + (P.n || wid), wid); const A = gmMontar(wid, G, { nombre: P.n }); if (typeof cnPaso === 'function') cnPaso(''); await gmTiempo(A.listo, 60000).catch(() => {}); }
    else if (/^\d+$/.test(wid) && typeof gmcPoner === 'function') gmcPoner(wid, { nombre: P.n, img: P.img, callado: true });
  } catch (e) { gmErr('habilitar ' + wid, e); }
  return true;
}
// todos los instalados (de a uno: montar varios a la vez traba el celular); prog(i, n) para mostrar cuánto va
async function gmHabilitarTodos(on, prog) {
  const L = Object.keys(PREFS.gmod || {}).filter((w) => gmHabilitado(w) !== !!on);
  for (let i = 0; i < L.length; i++) { if (prog) prog(i, L.length); await gmHabilitar(L[i], on); }
  if (prog) prog(L.length, L.length);
  return L.length;
}
// importar un .gma de la compu (el id es una huella del contenido: el mismo archivo, el mismo addon)
async function gmImportarArchivo(f) {
  let b = new Uint8Array(await f.arrayBuffer()); if (!gmEsGMA(b)) b = await gmLZMA(b);
  let h = 2166136261; for (let i = 0; i < b.length; i += Math.max(1, b.length >> 16)) h = Math.imul(h ^ b[i], 16777619);
  const G = GMF.gma(b), id = 'local:' + (h >>> 0).toString(36) + '_' + b.length.toString(36);
  return gmInstalar(id, { nombre: G.nombre || f.name.replace(/\.gma$/i, ''), local: true }, b);
}
// al arrancar: los instalados (de la caché, sin bajar nada)
async function gmArrancar(otraVez) {
  // (modo seguro: la app lo pide después de varios cuelgues seguidos; los mods quedan instalados pero no se cargan)
  if (Q.get('seguro') && !otraVez && !gmArrancar.forzar) { if (typeof cnAnotar === 'function') cnAnotar('seguro', 'mods sin cargar'); return; }
  if (!otraVez && typeof cnCuarentena === 'function') cnCuarentena();   // (el mod que trabó el juego la vez anterior: sin cargar)
  // (los instalados se montan uno por uno, esperando a la caché lo que tarde. Si uno de verdad no está guardado —una
  // descarga que no llegó a guardarse—, se vuelve a bajar solo; si la caché falló, se reintenta en un rato. La lista de
  // instalados no se toca nunca acá)
  const reintentar = [];
  for (const wid of Object.keys(PREFS.gmod || {})) {
    if (GMOD.addons.has(wid) || !gmHabilitado(wid)) continue;   // (los deshabilitados quedan instalados sin montar)
    try {
      const c = await gmCacheLeerSeguro(wid);
      if (c === undefined) { reintentar.push(wid); continue; }
      const G = c ? await gmaDeCache(wid, c) : null;
      // (el paso riesgoso se anota sólo mientras se monta: esperando a la caché el juego no está trabado)
      if (G) { if (typeof cnPaso === 'function') cnPaso('montando el mod ' + ((PREFS.gmod[wid] && PREFS.gmod[wid].n) || wid), wid); gmMontar(wid, G, { nombre: PREFS.gmod[wid].n }); if (typeof cnPaso === 'function') cnPaso(''); }
      else if (/^\d+$/.test(wid) && typeof gmcPoner === 'function') { gmErr('arranque ' + wid, 'no estaba en la caché: se vuelve a bajar'); gmcPoner(wid, { nombre: PREFS.gmod[wid].n, img: PREFS.gmod[wid].img, callado: true }); }
    } catch (e) { gmErr('arranque ' + wid, e); }
  }
  if (typeof cnPaso === 'function') cnPaso('');
  if (reintentar.length) setTimeout(() => { GMDB.db = null; gmArrancar(true); }, 15000);
  // (y lo que quedó a medio bajar la última vez: un rato después, para no sumarle trabajo al arranque en el celular)
  if (!otraVez && typeof gmcReanudar === 'function') setTimeout(gmcReanudar, 3000);
}
