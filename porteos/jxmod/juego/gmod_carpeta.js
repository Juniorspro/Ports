// ---------------- la carpeta de mods: los addons desarmados, como en garrysmod/addons de la compu ----------------
// (Discord, TerminatorX: «para poder poner los mods manualmente en sus carpetas… no tengo los .gma, tengo una conexión
// pésima y los que tengo están en carpetas»). Una carpeta del aparato donde se pegan los addons con cualquier gestor de
// archivos, cada uno en su carpeta como en GMod (mi_addon/addon.json, lua/, models/, materials/, sound/, maps/…), y también
// .gma sueltos. El juego la lee, arma con cada addon un .gma como el de gmad (la misma tabla de archivos, en minúsculas)
// y lo instala por el mismo camino que un .gma importado: queda en la caché de los addons y en la lista de instalados, se
// monta con gmMontar y aparece en el mismo panel y las mismas categorías. Al abrir el juego se monta de la caché sin leer
// la carpeta; al volver a leerla sólo se copia lo nuevo o lo que cambió (cada addon tiene su firma: las rutas, los tamaños
// y las fechas de sus archivos) y lo que ya no está en la carpeta se quita. Sin internet.
// De dónde se lee (GMK.fuentes; cada addon queda como «carpeta:<k>/<su carpeta>»):
//  - c: la carpeta elegida. En la app de Android, con el selector del sistema (el permiso queda guardado: anda de
//    Android 7 a 15 y en la tarjeta SD; Web.java + Carpeta.java: /carpeta/lista da todos los archivos y /carpeta/paquete
//    los de un addon, uno atrás del otro, en un solo pedido). En la compu (Chrome, Edge), con el selector de carpetas del
//    navegador: el permiso queda guardado y se vuelve a leer sola al abrir el juego si el navegador lo deja;
//  - a: en la app, Android/data/com.jxmod.app/files/addons (sin pedir permisos; en Android 10 o anterior se abre con
//    cualquier gestor, en 11 o más casi ninguno la abre: por eso la principal es la elegida);
//  - i: lo importado de una vez: una carpeta elegida en un navegador que no deja volver a leerla (Firefox, Safari), una
//    carpeta arrastrada o un .zip con la carpeta (en el iPhone no se pueden elegir carpetas: en Archivos se comprime).
//    Eso no se quita solo: se quita desde su ficha.
// Lo que se quita a mano desde su ficha no vuelve en la próxima lectura (PREFS.gmk.fuera) hasta que cambie en la carpeta
// o se toque «Volver a ponerlo».
const GMK = { va: null, filas: null, leyendo: null, dibT: 0, h: undefined, perm: '', err: '', creada: '', nada: false, ultRes: null };
const GMK_DIRS = { lua: 'lua', models: 'mdl vvd vtx phy ani', materials: 'vmt vtf png jpg jpeg raw', sound: 'wav mp3 ogg', maps: 'bsp nav ain lmp png jpg jpeg',
  resource: 'ttf otf properties txt res', particles: 'pcf', scenes: 'vcd', scripts: 'txt', data_static: 'txt dat json xml csv', gamemodes: '*' };
const GMK_TOPS = new Map(Object.entries(GMK_DIRS).map(([k, v]) => [k, v === '*' ? null : new Set(v.split(' '))]));
const GMK_BASURA = /(^|\/)(thumbs\.db|desktop\.ini)$|\.(psd|xcf|blend\d*|max|fbx|smd|qc|dmx|exe|dll|zip|rar|7z|bat|db|vcproj|sln|gma)$/;
const GMK_MAX = 30000;
const gmkApp = () => { try { return !!(window.JXNativo && JXNativo.carpeta && JXNativo.carpeta() >= 1); } catch (e) { return false; } };
const gmkFSA = () => typeof window.showDirectoryPicker === 'function' && window.isSecureContext !== false;
const gmkPrefs = () => { if (!PREFS.gmk || typeof PREFS.gmk !== 'object') PREFS.gmk = {}; if (!PREFS.gmk.fuera) PREFS.gmk.fuera = {}; return PREFS.gmk; };
const gmkEsDe = (id) => /^carpeta:/.test(String(id));

// ---------------- los addons de una lista de archivos ----------------
// L: [{ r: 'ruta/como/esta.ext' (con '/'), tam, t }]. Un addon es una carpeta con lua/, models/, materials/, sound/, maps/…
// adentro (sin importar mayúsculas) o con un addon.json; si una carpeta tiene «addons» adentro, se busca ahí (así sirve
// elegir JXMOD o la carpeta garrysmod de una compu). Las carpetas que no son addons se miran hasta 3 niveles más abajo
// (carpetas para ordenar: addons/armas/mi_arma). Devuelve { addons: [ruta], gmas: [i], vacias: [ruta] }
function gmkAgrupar(L) {
  const D = new Map(), dir = (r) => { let x = D.get(r); if (!x) D.set(r, (x = { dirs: new Map(), arch: [] })); return x; };
  dir('');
  L.forEach((f, i) => {
    const p = f.r.split('/'); let pre = '';
    for (let k = 0; k < p.length - 1; k++) { const sig = pre ? pre + '/' + p[k] : p[k]; dir(pre).dirs.set(p[k].toLowerCase(), sig); dir(sig); pre = sig; }
    dir(pre).arch.push(i);
  });
  const esAddon = (r) => { const x = D.get(r); if (!x) return false; for (const k of x.dirs.keys()) if (GMK_TOPS.has(k)) return true; return x.arch.some((i) => /(^|\/)addon\.json$/i.test(L[i].r)); };
  const addons = [], gmas = [], vacias = [];
  const ver = (r, prof) => {
    const x = D.get(r); let algo = false;
    for (const i of x.arch) if (/\.gma$/i.test(L[i].r)) { gmas.push(i); algo = true; }
    const subs = x.dirs.has('addons') ? [x.dirs.get('addons')] : [...x.dirs.values()];
    for (const s of subs) {
      const nom = s.slice(s.lastIndexOf('/') + 1); if (/^(__macosx|\.)/i.test(nom)) continue;
      if (esAddon(s)) { addons.push(s); algo = true; }
      else if (prof < 3 && ver(s, prof + 1)) algo = true;
      else if (!x.dirs.has('addons')) vacias.push(s);
    }
    return algo;
  };
  if (esAddon('') && !D.get('').dirs.has('addons')) addons.push(''); else ver('', 0);
  return { addons, gmas, vacias };
}
// addon.json como lo escribe la gente: con BOM, comentarios, comas de más, claves con mayúsculas; si ni así, el título
// con una expresión regular
function gmkJson(txt) {
  let s = String(txt || '').replace(/^﻿/, '');
  const minus = (o) => { const r = {}; if (o && typeof o === 'object' && !Array.isArray(o)) for (const k of Object.keys(o)) r[k.toLowerCase()] = o[k]; return r; };
  try { return minus(JSON.parse(s)); } catch (e) {}
  // (sin comentarios, fuera de los textos)
  let o = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { o += c; if (c === '\\') { o += s[++i] || ''; } else if (c === '"') q = false; continue; }
    if (c === '"') { q = true; o += c; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; o += '\n'; continue; }
    if (c === '/' && s[i + 1] === '*') { const f = s.indexOf('*/', i + 2); i = f < 0 ? s.length : f + 1; continue; }
    o += c;
  }
  s = o.replace(/,(\s*,)+/g, ',').replace(/([[{]\s*),/g, '$1').replace(/,(\s*[\]}])/g, '$1');
  try { return minus(JSON.parse(s)); } catch (e) {}
  const m = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/i.exec(s); let t = '';
  if (m) { try { t = JSON.parse('"' + m[1] + '"'); } catch (e) { t = m[1]; } }
  return t ? { title: t } : {};
}
// (info.txt de los addons viejos: "AddonInfo" { "name" "…" })
function gmkInfo(txt) {
  try { const kv = GMF.kv(String(txt || '')), b = kv && (kv.addoninfo || kv.AddonInfo || Object.values(kv)[0]); if (b && typeof b === 'object') for (const k of Object.keys(b)) if (k.toLowerCase() === 'name' && typeof b[k] === 'string') return b[k]; } catch (e) {}
  const m = /"name"\s+"([^"]*)"/i.exec(String(txt || '')); return m ? m[1] : '';
}
const gmkGlob = (g) => new RegExp('^' + String(g).toLowerCase().replace(/\\/g, '/').replace(/[.+^${}()|[\]]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
// la huella de algo (FNV-1a de 52 bits, en base 36)
function gmkHuella(s) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = (Math.imul(b, 33) + c) | 0; }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
// lo que va al .gma de un addon: sus archivos de GMod (lua/, models/, materials/, sound/, maps/…, con las extensiones
// que deja gmad; sin la basura de las carpetas: .psd, Thumbs.db…), en minúsculas, sin repetidos y sin lo que su
// addon.json dice que se ignore
function gmkArchivosDe(L, dir, ignorar) {
  const pre = dir ? dir + '/' : '', out = [], ya = new Set(), ig = (ignorar || []).filter((x) => typeof x === 'string' && x.trim()).map(gmkGlob);
  let otros = 0;
  for (let i = 0; i < L.length; i++) {
    const r0 = L[i].r; if (pre && !r0.startsWith(pre)) continue;
    const ruta = r0.slice(pre.length).toLowerCase(), p = ruta.split('/'), top = p[0], ext = ruta.slice(ruta.lastIndexOf('.') + 1);
    if (p.length < 2 || !GMK_TOPS.has(top) || p.some((s) => !s || s === '.' || s === '..' || s.startsWith('.'))) { if (!/^(addon\.json|info\.txt)$/.test(ruta)) otros++; continue; }
    const ok = GMK_TOPS.get(top); if ((ok && !ok.has(ext)) || GMK_BASURA.test(ruta) || ig.some((re) => re.test(ruta)) || ya.has(ruta)) { otros++; continue; }
    ya.add(ruta); out.push({ i, ruta, tam: L[i].tam, t: L[i].t });
  }
  return { arch: out, otros };
}
// los addons de una fuente, listos para comparar con lo guardado: nombre (addon.json → info.txt → la carpeta), archivos,
// firma e id
async function gmkPreparar(F) {
  const L = F.L, R = gmkAgrupar(L), out = [];
  const esp = new Map();   // (addon.json e info.txt de cada uno: se leen todos juntos)
  for (const d of R.addons) {
    const pre = d ? d + '/' : '';
    const j = L.findIndex((f) => f.r.toLowerCase() === (pre + 'addon.json').toLowerCase()), n = L.findIndex((f) => f.r.toLowerCase() === (pre + 'info.txt').toLowerCase());
    esp.set(d, { j, n });
  }
  const pedir = [...esp.values()].flatMap((x) => [x.j, x.n]).filter((i) => i >= 0 && L[i].tam < 262144);
  const leidos = new Map(); if (pedir.length) { const B = await F.leerVarios(pedir); pedir.forEach((i, k) => leidos.set(i, B[k])); }
  const td = new TextDecoder('utf-8');
  for (const d of R.addons) {
    const x = esp.get(d), aj = x.j >= 0 && leidos.get(x.j) ? gmkJson(td.decode(leidos.get(x.j))) : {};
    const info = !aj.title && x.n >= 0 && leidos.get(x.n) ? gmkInfo(td.decode(leidos.get(x.n))) : '';
    const carpeta = d ? d.slice(d.lastIndexOf('/') + 1) : F.nombre || 'addon';
    const nombre = String((typeof aj.title === 'string' && aj.title.trim()) || (info && info.trim()) || carpeta).slice(0, 120);
    const { arch, otros } = gmkArchivosDe(L, d, Array.isArray(aj.ignore) ? aj.ignore : []);
    const tags = Array.isArray(aj.tags) ? aj.tags.filter((t) => typeof t === 'string').slice(0, 8) : [];
    const desc = JSON.stringify({ description: typeof aj.description === 'string' ? aj.description.slice(0, 2000) : '', type: typeof aj.type === 'string' ? aj.type : 'ServerContent', tags });
    const xtra = [x.j, x.n].filter((i) => i >= 0).map((i) => L[i].tam + ':' + L[i].t).join(',');
    const firma = gmkHuella(nombre + '\n' + xtra + '\n' + arch.map((a) => a.ruta + '|' + a.tam + '|' + a.t).join('\n'));
    const clave = (d || carpeta).toLowerCase();
    out.push({ id: 'carpeta:' + F.k + '/' + clave, dir: d || carpeta, nombre, arch, otros, desc, firma, bytes: arch.reduce((s, a) => s + a.tam, 0), vacio: !arch.length });
  }
  for (const i of R.gmas) {
    const f = L[i], clave = f.r.toLowerCase();
    out.push({ id: 'carpeta:' + F.k + '/' + clave, dir: f.r, nombre: f.r.slice(f.r.lastIndexOf('/') + 1).replace(/\.gma$/i, ''), gma: i, firma: gmkHuella('gma\n' + f.tam + '|' + f.t), bytes: f.tam });
  }
  return { grupos: out, vacias: R.vacias };
}
// la cabecera de un .gma (versión 3, como gmad) con esos archivos; atrás van sus bytes en el mismo orden
function gmkCabecera(nombre, desc, autor, arch) {
  const te = new TextEncoder(), P = []; let n = 0;
  const u8 = (a) => { P.push(a); n += a.length; };
  const str = (s) => { u8(te.encode(String(s || '').replace(/\0/g, ''))); u8(new Uint8Array(1)); };
  const u32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); u8(b); };
  const u64 = (v) => { const b = new Uint8Array(8), dv = new DataView(b.buffer); dv.setUint32(0, v % 4294967296, true); dv.setUint32(4, Math.floor(v / 4294967296), true); u8(b); };
  u8(te.encode('GMAD')); u8(new Uint8Array([3])); u64(0); u64(Math.floor(Date.now() / 1000)); u8(new Uint8Array(1));
  str(nombre); str(desc); str(autor); u32(1);
  arch.forEach((a, k) => { u32(k + 1); str(a.ruta); u64(a.tam); u32(0); });
  u32(0);
  const b = new Uint8Array(n); let o = 0; for (const p of P) { b.set(p, o); o += p.length; } return b;
}
// «0-3,7,9-10»
function gmkRangos(L) {
  const out = []; let a = null, b = null;
  for (const x of L) { if (a !== null && x === b + 1) { b = x; continue; } if (a !== null) out.push(a === b ? '' + a : a + '-' + b); a = b = x; }
  if (a !== null) out.push(a === b ? '' + a : a + '-' + b);
  return out.join(',');
}

// ---------------- las fuentes ----------------
// F: { k, tipo, nombre, ok, completo, L, leerVarios(ids) → [Uint8Array], partes(ids) → [Blob] (los bytes de esos archivos
// en ese orden) }
// (la app: los archivos de las dos carpetas en una lista; los de un addon, de un solo pedido)
async function gmkFuentesApp() {
  const r = await gmFetch('/carpeta/lista', null, 180000); if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json(), gen = j.gen;
  const partes = async (L, ids) => {
    const tot = ids.reduce((s, i) => s + L[i].tam, 0); if (!ids.length) return [];
    const x = await gmFetch('/carpeta/paquete?gen=' + gen + '&i=' + gmkRangos(ids.map((i) => L[i].g)), null, 120000);
    if (x.status === 409) throw new Error(T('gmk.cambioCarp'));
    if (!x.ok) throw new Error('HTTP ' + x.status);
    const b = await x.blob(); if (b.size !== tot) throw new Error('llegaron ' + b.size + ' de ' + tot + ' bytes');
    return [b];
  };
  return (j.raices || []).map((R, ri) => {
    const L = []; (j.a || []).forEach((a, g) => { if (a[0] === ri) L.push({ r: a[1], tam: a[2], t: a[3], g }); });
    return { k: R.k, tipo: 'app', nombre: R.nombre || '', id: R.id || '', ok: !!R.ok, err: R.error || '', sin: !!R.sin, completo: !!R.ok && !j.corto, L,
      partes: (ids) => partes(L, ids), leerVarios: async (ids) => { const [b] = await partes(L, ids); const u = new Uint8Array(await b.arrayBuffer()); let o = 0; return ids.map((i) => { const s = u.subarray(o, o + L[i].tam); o += L[i].tam; return s; }); } };
  });
}
// (archivos del navegador —File—: los de una carpeta elegida, arrastrada o de un .zip)
function gmkFuenteArchivos(k, tipo, nombre, L, completo) {
  return { k, tipo, nombre, ok: true, completo: completo !== false, L,
    partes: async (ids) => { const out = []; for (const i of ids) out.push(await L[i].leer()); return out; },
    leerVarios: async (ids) => { const out = []; for (const i of ids) out.push(new Uint8Array(await (await L[i].leer()).arrayBuffer())); return out; } };
}
// (el selector de carpetas del navegador: se recorre la carpeta; Chrome y Edge)
async function gmkRecorrerFSA(h) {
  const L = []; let corto = false;
  const ir = async (d, pre, prof) => {
    if (prof > 12) { corto = true; return; }
    const hijos = []; for await (const [n, e] of d.entries()) hijos.push([n, e]);
    hijos.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const arch = hijos.filter(([n, e]) => e.kind === 'file' && !n.startsWith('.'));
    const fs = await Promise.all(arch.map(([, e]) => e.getFile().catch(() => null)));
    arch.forEach(([n], k) => { const f = fs[k]; if (!f) return; if (L.length >= GMK_MAX) { corto = true; return; } const r = pre ? pre + '/' + n : n; L.push({ r, tam: f.size, t: f.lastModified, leer: () => Promise.resolve(f) }); });
    for (const [n, e] of hijos) if (e.kind === 'directory' && !n.startsWith('.') && n !== '__MACOSX') await ir(e, pre ? pre + '/' + n : n, prof + 1);
  };
  await ir(h, '', 0);
  return { L, corto };
}
// (lo arrastrado: carpetas por webkitGetAsEntry, que anda en todos los navegadores de compu)
async function gmkRecorrerEntradas(ents) {
  const L = []; let corto = false;
  const archivo = (e) => new Promise((ok) => e.file(ok, () => ok(null)));
  const hijos = (d) => new Promise((ok) => { const rd = d.createReader(), out = []; const sig = () => rd.readEntries((b) => { if (!b.length) ok(out); else { out.push(...b); sig(); } }, () => ok(out)); sig(); });
  const ir = async (e, pre, prof) => {
    if (e.name.startsWith('.') || e.name === '__MACOSX') return;
    const r = pre ? pre + '/' + e.name : e.name;
    if (e.isFile) { const f = await archivo(e); if (!f) return; if (L.length >= GMK_MAX) { corto = true; return; } L.push({ r, tam: f.size, t: f.lastModified, leer: () => Promise.resolve(f) }); return; }
    if (prof > 12) { corto = true; return; }
    const hs = await hijos(e); hs.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const h of hs) await ir(h, r, prof + 1);
  };
  for (const e of ents) await ir(e, '', 0);
  return { L, corto };
}
// (una carpeta elegida con <input webkitdirectory>: webkitRelativePath trae la carpeta elegida adelante)
function gmkListaInput(files) {
  const L = [];
  for (const f of files) { const r = String(f.webkitRelativePath || f.name).replace(/\\/g, '/'); if (r.split('/').some((s) => s.startsWith('.'))) continue; L.push({ r, tam: f.size, t: f.lastModified, leer: () => Promise.resolve(f) }); }
  L.sort((a, b) => (a.r < b.r ? -1 : a.r > b.r ? 1 : 0));
  return L.slice(0, GMK_MAX);
}
// ---------------- .zip (el iPhone no deja elegir carpetas: en Archivos, «Comprimir» la carpeta) ----------------
// el directorio central del .zip (con ZIP64); cada archivo se descomprime cuando se lee (deflate con
// DecompressionStream o, si el navegador no lo tiene, con inflarJS)
async function gmkZip(f) {
  const tam = f.size, cola = new Uint8Array(await f.slice(Math.max(0, tam - 66000)).arrayBuffer()), base = Math.max(0, tam - 66000);
  let e = -1; for (let i = cola.length - 22; i >= 0; i--) if (cola[i] === 0x50 && cola[i + 1] === 0x4b && cola[i + 2] === 5 && cola[i + 3] === 6) { e = i; break; }
  if (e < 0) throw new Error(T('gmk.noZip'));
  const dv = new DataView(cola.buffer); let n = dv.getUint16(e + 10, true), cdT = dv.getUint32(e + 12, true), cdO = dv.getUint32(e + 16, true);
  if ((n === 0xffff || cdO === 0xffffffff) && e >= 20 && dv.getUint32(e - 20, true) === 0x07064b50) {
    const z = Number(dv.getBigUint64(e - 12, true)) - base, z8 = z >= 0 ? new DataView(cola.buffer, z) : new DataView(await f.slice(z + base, z + base + 56).arrayBuffer());
    n = Number(z8.getBigUint64(32, true)); cdT = Number(z8.getBigUint64(40, true)); cdO = Number(z8.getBigUint64(48, true));
  }
  const cd = new Uint8Array(await f.slice(cdO, cdO + cdT).arrayBuffer()), cv = new DataView(cd.buffer), L = [], u8 = new TextDecoder('utf-8', { fatal: true }), l1 = new TextDecoder('latin1');
  let p = 0;
  for (let k = 0; k < n && p + 46 <= cd.length && cv.getUint32(p, true) === 0x02014b50; k++) {
    const fl = cv.getUint16(p + 8, true), met = cv.getUint16(p + 10, true), dt = cv.getUint32(p + 12, true), crc = cv.getUint32(p + 16, true);
    let cs = cv.getUint32(p + 20, true), us = cv.getUint32(p + 24, true), off = cv.getUint32(p + 42, true);
    const nl = cv.getUint16(p + 28, true), el = cv.getUint16(p + 30, true), cl = cv.getUint16(p + 32, true), nb = cd.subarray(p + 46, p + 46 + nl);
    let nom; try { nom = u8.decode(nb); } catch (x) { nom = l1.decode(nb); }
    for (let q = p + 46 + nl; q + 4 <= p + 46 + nl + el;) {   // (ZIP64: los tamaños y el lugar de verdad)
      const id = cv.getUint16(q, true), ln = cv.getUint16(q + 2, true);
      if (id === 1) { let w = q + 4; if (us === 0xffffffff) { us = Number(cv.getBigUint64(w, true)); w += 8; } if (cs === 0xffffffff) { cs = Number(cv.getBigUint64(w, true)); w += 8; } if (off === 0xffffffff) off = Number(cv.getBigUint64(w, true)); }
      q += 4 + ln;
    }
    p += 46 + nl + el + cl;
    nom = nom.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!nom || nom.endsWith('/') || nom.split('/').some((s) => s === '..' || s.startsWith('.') || s === '__MACOSX') || (fl & 1)) continue;
    const leer = async () => {
      const lh = new DataView(await f.slice(off, off + 30).arrayBuffer()), ini = off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true), c = f.slice(ini, ini + cs);
      if (met === 0) return c;
      if (met !== 8) throw new Error('zip: método ' + met);
      if (typeof DecompressionStream === 'function') { try { const b = await new Response(c.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob(); if (b.size === us) return b; } catch (x) {} }
      return new Blob([inflarJS(new Uint8Array(await c.arrayBuffer()), us)]);
    };
    L.push({ r: nom, tam: us, t: dt + '.' + crc, leer });
    if (L.length >= GMK_MAX) break;
  }
  L.sort((a, b) => (a.r < b.r ? -1 : a.r > b.r ? 1 : 0));
  return L;
}
// (la carpeta elegida en la compu: el permiso del navegador queda guardado con ella, en su propia base)
// (algún Chromium se cierra entero al sacar de la base una carpeta guardada —pasa con el de las pruebas, Chrome for
// Testing—: si eso pasara al abrir el juego, se cerraría cada vez. Por eso se anota antes de leerla y se borra la nota al
// terminar; si al abrir la nota sigue ahí, el navegador se cerró leyéndola: se borra la carpeta guardada sin leerla y en
// ese navegador se elige cada vez, sin guardarla)
const GMK_HNOTA = 'jx_gmk_h', gmkUA = () => String(navigator.userAgent || '').slice(0, 160);
const gmkHNota = (v) => { try { if (v === undefined) return localStorage.getItem(GMK_HNOTA); if (v === null) localStorage.removeItem(GMK_HNOTA); else localStorage.setItem(GMK_HNOTA, v); } catch (e) {} return null; };
const gmkHRoto = () => gmkHNota() === 'roto:' + gmkUA();
function gmkDB() { return new Promise((ok, mal) => { try { const r = indexedDB.open('rb-gmcarpeta', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); } catch (e) { mal(e); } }); }
async function gmkHGuardar(h) {
  if (h && gmkHRoto()) return;
  try { const db = await gmkDB(); await new Promise((ok) => { const t = db.transaction('h', 'readwrite'); if (h) t.objectStore('h').put(h, 'c'); else t.objectStore('h').delete('c'); t.oncomplete = t.onerror = t.onabort = ok; }); db.close(); } catch (e) {}
  if (h) gmkHNota('hay'); else if (!gmkHRoto()) gmkHNota(null);
}
async function gmkHLeer() {
  if (GMK.h !== undefined) return GMK.h;
  const nota = gmkHNota();
  if (!nota || gmkHRoto()) return (GMK.h = null);   // (nada guardado: ni se abre la base)
  if (nota === 'leyendo') { gmkHNota('roto:' + gmkUA()); GMK.h = null; GMK.hRoto = true; gmkHGuardar(null); return null; }
  gmkHNota('leyendo');
  try { const db = await gmkDB(); GMK.h = await new Promise((ok) => { try { const q = db.transaction('h').objectStore('h').get('c'); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); } catch (e) { ok(null); } }); db.close(); }
  catch (e) { GMK.h = null; }
  gmkHNota(GMK.h ? 'hay' : null);
  return GMK.h;
}
// las fuentes que se leen con «Volver a leer»: en la app, las dos carpetas; en la compu, la elegida (pidiendo permiso
// otra vez si el navegador lo pide: hace falta el toque, por eso se pide acá, enseguida)
async function gmkFuentes(op) {
  if (gmkApp()) return gmkFuentesApp();
  const h = await gmkHLeer(); if (!h) return [];
  let p = 'granted'; try { p = await h.queryPermission({ mode: 'read' }); if (p !== 'granted' && op && op.toque) p = await h.requestPermission({ mode: 'read' }); } catch (e) { p = 'denied'; }
  GMK.perm = p; if (p !== 'granted') return [{ k: 'c', tipo: 'fsa', nombre: h.name, ok: false, perm: true, L: [] }];
  const { L, corto } = await gmkRecorrerFSA(h);
  return [gmkFuenteArchivos('c', 'fsa', h.name, L, !corto)];
}

// ---------------- leer: comparar con lo guardado, copiar lo nuevo, quitar lo que ya no está ----------------
// op: { fuentes (una importación: no quita nada), callado (al abrir el juego: un aviso sólo si cambió algo), toque }
function gmkLeer(op) {
  op = op || {};
  if (GMK.leyendo) return GMK.leyendo;
  const p = (async () => {
    const P = gmkPrefs(), res = { nuevos: 0, cambiados: 0, quitados: 0, iguales: 0, errores: 0, vacios: 0, fuera: 0, ms: 0, copiadoMB: 0 }, t0 = performance.now();
    GMK.err = ''; GMK.nada = false; GMK.va = { fase: 'listando', i: 0, n: 0 }; gmkDibujar();
    let fuentes;
    const TT = GMK.t = { listar: 0, preparar: 0, leer: 0, guardar: 0, montar: 0 }; let tq = performance.now();
    try { fuentes = op.fuentes || (await gmkFuentes(op)); TT.listar = performance.now() - tq; }
    catch (e) { GMK.err = String((e && e.message) || e).slice(0, 160); GMK.va = null; gmkDibujar(); res.error = GMK.err; return res; }
    const filas = op.fuentes && GMK.filas ? GMK.filas.filter((f) => f.k !== 'i') : [], plan = [], vistos = new Set();
    for (const F of fuentes) {
      if (!F.ok) { filas.push({ k: F.k, raiz: true, nombre: F.nombre, perm: F.perm, sin: F.sin, err: F.err }); continue; }
      tq = performance.now(); const { grupos, vacias } = await gmkPreparar(F); TT.preparar += performance.now() - tq;
      for (const g of grupos) {
        vistos.add(g.id);
        const P0 = PREFS.gmod && PREFS.gmod[g.id], fz = P.fuera[g.id]; if (g.gma != null && ((P0 && P0.n) || (fz && fz.n))) g.nombre = (P0 && P0.n) || fz.n;
        const fila = { id: g.id, k: F.k, nombre: g.nombre, dir: g.dir, n: g.gma != null ? 1 : g.arch.length, mb: g.bytes / 1048576, gma: g.gma != null, otros: g.otros || 0, raizNom: F.nombre };
        filas.push(fila);
        if (g.vacio) { fila.estado = 'vacio'; res.vacios++; continue; }
        if (fz) { if ((fz.f || fz) === g.firma) { fila.estado = 'quitado'; res.fuera++; continue; } delete P.fuera[g.id]; }
        // (igual que lo guardado y montado —o guardado y deshabilitado, o guardado sin montar todavía—: no se copia)
        const igual = P0 && P0.firma === g.firma && (GMOD.addons.has(g.id) || (await gmCacheLeerSeguro(g.id)));
        if (igual) { fila.estado = gmHabilitado(g.id) ? 'igual' : 'off'; res.iguales++; continue; }
        fila.estado = 'espera'; fila.antes = !!P0; plan.push({ F, g, fila });
      }
      for (const v of vacias) { filas.push({ k: F.k, nombre: v.slice(v.lastIndexOf('/') + 1), dir: v, estado: 'vacio', raizNom: F.nombre }); res.vacios++; }
    }
    // lo que ya no está en su carpeta (sólo de las carpetas fijas que se pudieron leer enteras: si se perdió el permiso o
    // no se pudo leer, no se toca nada)
    if (!op.fuentes) for (const F of fuentes) {
      if (!(F.ok && F.completo && (F.k === 'c' || F.k === 'a'))) continue;
      for (const [id, x] of Object.entries(PREFS.gmod || {})) if (x && x.carpeta === F.k && !vistos.has(id)) { gmkSacar(id); res.quitados++; }
      for (const id of Object.keys(P.fuera)) if (id.startsWith('carpeta:' + F.k + '/') && !vistos.has(id)) delete P.fuera[id];
    }
    // (primero las bases —su Lua tiene que correr antes que el de los que las usan—, después por nombre)
    const esBase = (g) => (g.arch || []).some((a) => /^lua\/(weapons|entities)\/[^/]*base[^/]*(\/|\.lua$)|^lua\/[^/]*_base\//.test(a.ruta)) || /\bbase\b/i.test(g.nombre);
    plan.sort((a, b) => (esBase(b.g) ? 1 : 0) - (esBase(a.g) ? 1 : 0) || a.g.nombre.localeCompare(b.g.nombre));
    GMK.filas = filas;
    for (let i = 0; i < plan.length; i++) {
      const { F, g, fila } = plan[i];
      GMK.va = { fase: 'copiando', i, n: plan.length, nombre: g.nombre, mb: g.bytes / 1048576 }; fila.estado = 'copiando'; gmkDibujar();
      try { await gmkPoner(F, g); fila.nombre = g.nombre; fila.estado = fila.antes ? 'cambio' : 'nuevo'; res[fila.antes ? 'cambiados' : 'nuevos']++; res.copiadoMB += g.bytes / 1048576; }
      catch (e) { fila.estado = 'error'; fila.err = String((e && e.message) || e).slice(0, 140); res.errores++; gmErr('carpeta ' + g.id, e); }
      gmkDibujar();
    }
    for (const f of filas) if (f.id && GMOD.addons.has(f.id)) f.faltan = gmkFaltan(GMOD.addons.get(f.id));
    GMK.filas = filas; GMK.va = null;
    if (!op.fuentes && fuentes.some((F) => F.ok)) P.ult = Date.now();
    GMK.nada = fuentes.some((F) => F.ok) && !filas.some((f) => f.id);
    guardarPrefs();
    res.ms = Math.round(performance.now() - t0); res.t = Object.fromEntries(Object.entries(TT).map(([k, v]) => [k, Math.round(v)])); GMK.ultRes = res;
    if (res.nuevos || res.cambiados || res.quitados) { try { gmMenu(); } catch (e) {} try { if (typeof RB !== 'undefined' && RB.t && RB.t.tab === 'gmod' && RB.t.vista === 'instalados' && !RB.t.carpeta && RB.panel === 'tienda') gmTiendaCargar(true); if (typeof pjmDibujar === 'function') pjmDibujar(); } catch (e) {} }
    gmkDibujar();
    // (el mensaje se arma al dibujar: si se cambia el idioma, cambia con él)
    GMK.msj = res.error ? '' : () => gmkResumen(res);
    if (!gmkVisible() && (!op.callado || res.nuevos || res.cambiados || res.quitados || res.errores)) menuAviso(gmkResumen(res));
    return res;
  })();
  GMK.leyendo = p; p.finally(() => { GMK.leyendo = null; gmkDibujar(); });
  return p;
}
function gmkResumen(r) {
  if (r.error) return T('gmk.errLeer').replace('{e}', r.error);
  // (con 1, en singular: «1 nuevo», no «1 nuevos»)
  const n = (x, k, k1) => x && T(x === 1 ? k1 : k).replace('{n}', x);
  const p = [n(r.nuevos, 'gmk.nNuevos', 'gmk.nNuevo1'), n(r.cambiados, 'gmk.nCambio', 'gmk.nCambio1'), n(r.quitados, 'gmk.nQuitados', 'gmk.nQuitado1'), n(r.errores, 'gmk.nErrores', 'gmk.nErrores')].filter(Boolean);
  return T('gmk.titulo') + ': ' + (p.length ? p.join(' · ') : T('gmk.sinCambios'));
}
// copiar uno: el .gma (armado o el suelto) a la caché de los addons y montarlo como uno importado
async function gmkPoner(F, g) {
  let bl; const TT = GMK.t || {}, t0 = performance.now();
  if (g.gma != null) {
    bl = (await F.partes([g.gma]))[0];
    if (!gmEsGMA(new Uint8Array(await bl.slice(0, 4).arrayBuffer()))) { const b = await gmLZMA(new Uint8Array(await bl.arrayBuffer())); if (!gmEsGMA(b)) throw new Error(T('gmk.noGma')); bl = new Blob([b]); }
    const T0 = GMF.gmaTabla(new Uint8Array(await bl.slice(0, Math.min(bl.size, 1048576)).arrayBuffer())); if (T0 && T0.nombre) g.nombre = T0.nombre;
  } else {
    const partes = await F.partes(g.arch.map((a) => a.i)), cab = gmkCabecera(g.nombre, g.desc, '', g.arch);
    bl = new Blob([cab, ...partes], { type: 'application/octet-stream' });
    if (bl.size !== cab.length + g.bytes) throw new Error('el addon cambió mientras se leía');
  }
  const id = g.id, P0 = PREFS.gmod && PREFS.gmod[id], off = !!(P0 && P0.off);
  if (GMOD.addons.has(id)) gmDesmontar(id);
  if (GMK.va) { GMK.va.fase = 'guardando'; gmkDibujar(); }
  GMDB.sinLugar = null;
  TT.leer = (TT.leer || 0) + performance.now() - t0; let t1 = performance.now();
  const guardado = await gmCacheGuardarGMA(id, bl);
  TT.guardar = (TT.guardar || 0) + performance.now() - t1; t1 = performance.now();
  const marcar = () => {
    PREFS.gmod = PREFS.gmod || {}; const X = PREFS.gmod[id] || (PREFS.gmod[id] = { n: g.nombre, t: Date.now(), img: '' });
    Object.assign(X, { n: g.nombre, carpeta: F.k, ruta: g.dir, firma: g.firma, nArch: g.gma != null ? 0 : g.arch.length, mbG: Math.round(bl.size / 1048.576) / 1000 });
    if (off) X.off = 1;
    if (!guardado) X.sinGuardar = Math.round(bl.size / 1048576); else delete X.sinGuardar;
    guardarPrefs();
  };
  if (off) { marcar(); return null; }   // (deshabilitado: queda guardado sin montar, como los otros)
  if (GMK.va) { GMK.va.fase = 'montando'; gmkDibujar(); }
  // (como gmInstalar con un .gma importado, desde lo guardado —lo grande queda en el disco—, pero sin esperar a que corra
  // su Lua para copiar el siguiente: el Lua de cada uno corre después, en orden, como al abrir el juego. Antes de correr,
  // el montaje espera hasta 12 s el contenido base de GMod que pide el addon: sin internet o con una conexión mala, 7
  // addons esperando de a uno eran 45 s de «Copiando…». Lo que pide del Workshop no se baja solo: ver gmkFaltan)
  const G = await gmaDesdeBlob(guardado || bl);
  const A = gmMontar(id, G, { nombre: g.nombre });
  marcar(); TT.montar = (TT.montar || 0) + performance.now() - t1;
  if (!guardado) gmkAvisar(() => T('gm.sinLugar').replace('%m', g.nombre).replace('%n', Math.round(bl.size / 1048576)));
  return A;
}
// sacar uno de la carpeta (se borró de la carpeta, o se olvida la carpeta): como quitarlo, sin anotarlo como quitado
function gmkSacar(id) { try { gmDesmontar(id); } catch (e) { gmErr('carpeta sacar ' + id, e); } if (PREFS.gmod) delete PREFS.gmod[id]; gmCacheBorrar(id); }
// (lo llama gmQuitar: quitado a mano desde su ficha, no vuelve en la próxima lectura hasta que cambie en la carpeta)
function gmkQuitado(id) { const x = PREFS.gmod && PREFS.gmod[id]; if (x && x.firma && x.carpeta) gmkPrefs().fuera[id] = { f: x.firma, n: x.n }; if (GMK.filas) for (const f of GMK.filas) if (f.id === id) f.estado = 'quitado'; }
// las bases de armas o entidades que usa y que no trae ningún mod montado (TFA, ArcCW, CW 2.0…: se pueden bajar del Workshop)
function gmkFaltan(A) {
  if (!A || !A.lua || typeof GM_BASES === 'undefined') return [];
  const hay = new Set(), td = new TextDecoder('latin1'), out = new Map();
  for (const B of GMOD.addons.values()) for (const r of (B.lua || [])) { const m = /^lua\/(weapons|entities)\/([^/]+?)(\.lua|\/)/.exec(r); if (m) hay.add(m[2].toLowerCase()); }
  for (const r of A.lua) {
    const b = A.G.archivos.get(r); if (!b || b.length > 400000) continue;
    for (const m of td.decode(b).matchAll(/\b(?:SWEP|ENT)\.Base\s*=\s*["']([\w-]+)["']/g)) { const n = m[1].toLowerCase(); if (!hay.has(n) && GM_BASES[n]) out.set(GM_BASES[n], n); }
  }
  return [...out].map(([w, n]) => ({ w, n })).filter((x) => x.w && !GMOD.addons.has(x.w));
}
// «Volver a ponerlo»: el que se quitó a mano vuelve en la próxima lectura
function gmkPonerOtraVez(id) { delete gmkPrefs().fuera[id]; guardarPrefs(); return gmkLeer({ toque: true }); }

// ---------------- elegir y olvidar la carpeta ----------------
function gmkElegir() {
  if (gmkApp()) { try { JXNativo.carpetaElegir(); } catch (e) { menuAviso(String(e.message || e)); } return; }
  if (gmkFSA()) {
    window.showDirectoryPicker({ id: 'jxmod-mods', mode: 'read' }).then(async (h) => { GMK.h = h; GMK.perm = 'granted'; await gmkHGuardar(h); GMK.filas = null; gmkLeer({ toque: true }); }).catch((e) => { if (e && e.name !== 'AbortError') menuAviso(String(e.message || e)); });
    return;
  }
  gmkElegirInput(true);
}
// (un <input> para elegir una carpeta —webkitdirectory— o un .zip/.gma; se toca enseguida, dentro del toque)
function gmkElegirInput(carpeta) {
  const i = document.createElement('input'); i.type = 'file'; i.hidden = true;
  if (carpeta) { i.webkitdirectory = true; i.multiple = true; } else { i.accept = '.zip,.gma,application/zip'; i.multiple = true; }
  i.addEventListener('change', () => { const fs = [...(i.files || [])]; i.remove(); if (fs.length) gmkImportar(fs, carpeta); });
  document.body.appendChild(i); i.click();
}
// importar archivos sueltos: los de una carpeta (webkitdirectory), .zip o .gma
async function gmkImportar(fs, carpeta) {
  if (carpeta) { const L = gmkListaInput(fs); return gmkLeer({ fuentes: [gmkFuenteArchivos('i', 'input', '', L)], toque: true }); }
  for (const f of fs) {
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
      try { const L = await gmkZip(f); await gmkLeer({ fuentes: [gmkFuenteArchivos('i', 'zip', f.name.replace(/\.zip$/i, ''), L)], toque: true }); }
      catch (e) { menuAviso(T('gmk.errLeer').replace('{e}', String((e && e.message) || e))); }
    } else if (/\.gma$/i.test(f.name) && typeof gmTiendaImportar === 'function') await gmTiendaImportar(f);
  }
}
// lo que llega soltado (una o varias carpetas, .zip o .gma): las entradas se piden durante el evento (después ya no están)
function gmkSoltar(dt) {
  const ents = [], sueltos = [];
  for (const it of [...(dt.items || [])]) { if (it.kind !== 'file') continue; const e = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null; if (e && e.isDirectory) ents.push(e); else { const f = it.getAsFile(); if (f) sueltos.push(f); } }
  if (!ents.length && !sueltos.length) for (const f of [...(dt.files || [])]) sueltos.push(f);
  (async () => {
    if (ents.length) { const { L, corto } = await gmkRecorrerEntradas(ents); await gmkLeer({ fuentes: [gmkFuenteArchivos('i', 'arrastre', ents[0].name, L, !corto)], toque: true }); }
    if (sueltos.length) await gmkImportar(sueltos.filter((f) => /\.(zip|gma)$/i.test(f.name)), false);
  })().catch((e) => menuAviso(T('gmk.errLeer').replace('{e}', String((e && e.message) || e))));
  return ents.length + sueltos.length;
}
// (la app avisa lo que se eligió en el selector del sistema; si la carpeta está vacía se le crea «addons» adentro, con
// un LEEME para el que la abre con el gestor de archivos)
window.__jxCarpeta = (j) => {
  let o = {}; try { o = typeof j === 'string' ? JSON.parse(j) : j || {}; } catch (e) {}
  if (!o.ok) { gmkDibujar(); return; }
  GMK.filas = null; GMK.creada = '';
  gmkLeer({ toque: true }).then((r) => {
    if (!r || r.error) return;
    const F = (GMK.filas || []).filter((f) => f.k === 'c' && f.id);
    if (F.length || !gmkApp() || !JXNativo.carpetaCrear) return;
    let x = ''; try { x = JXNativo.carpetaCrear('addons', T('gmk.leeme')); } catch (e) {}
    if (x === 'ok') { GMK.creada = o.nombre || ''; gmkDibujar(); }
  });
};
function gmkEstadoApp() { try { return JSON.parse(JXNativo.carpetaEstado() || '{}'); } catch (e) { return {}; } }
function gmkOlvidar() {
  const ids = Object.keys(PREFS.gmod || {}).filter((id) => PREFS.gmod[id].carpeta === 'c');
  const si = async () => {
    if (gmkApp()) { try { JXNativo.carpetaOlvidar(); } catch (e) {} } else { GMK.h = null; await gmkHGuardar(null); }
    for (const id of ids) gmkSacar(id);
    const P = gmkPrefs(); for (const id of Object.keys(P.fuera)) if (id.startsWith('carpeta:c/')) delete P.fuera[id];
    delete P.ult; guardarPrefs(); GMK.filas = GMK.filas ? GMK.filas.filter((f) => f.k !== 'c') : null; GMK.creada = '';
    try { gmMenu(); } catch (e) {}
    gmkAvisar(() => T(ids.length === 1 ? 'gmk.olvidada1' : 'gmk.olvidada').replace('{n}', ids.length));
  };
  const txt = T(ids.length === 1 ? 'gmk.olvidarP1' : 'gmk.olvidarP').replace('{n}', ids.length);
  if (typeof confirmar === 'function') { confirmar(txt, T('gmk.olvidar'), si); const b = document.querySelector('#cfDlg [data-cf=si]'); if (b) b.classList.add('rojo'); } else if (window.confirm(txt)) si();
}
// al abrir el juego (después de montar lo guardado): la carpeta se vuelve a leer sola si se puede sin preguntar nada (la
// app, o la compu si el navegador dejó el permiso guardado)
function gmkArranque() {
  const P = gmkPrefs(); if (P.auto === false) return;
  // (en la app, siempre: leer Android/data vacía tarda nada y así esa carpeta ya existe para el que la busca)
  if (gmkApp()) { gmkLeer({ callado: true }); return; }
  if (!gmkFSA()) return;
  gmkHLeer().then(async (h) => {
    if (!h) return;
    let p = 'prompt'; try { p = await h.queryPermission({ mode: 'read' }); } catch (e) {}
    GMK.perm = p; if (p === 'granted') gmkLeer({ callado: true }); else gmkDibujar();
  });
}

// ---------------- el panel: en Mods y mapas → GMod (botón «Carpeta de mods») y en Ajustes → Mods ----------------
const GMK_EST = { nuevo: ['si', 've'], cambio: ['girar', 've'], igual: ['si', 'ok'], off: ['prohibido', 'gr'], copiando: ['bajar', 'va'], espera: ['reloj', 'gr'], error: ['aviso', 'ro'], vacio: ['info', 'gr'], quitado: ['basura', 'gr'] };
const gmkMB = (mb) => (mb < 0.1 ? Math.max(1, Math.round(mb * 1024)) + ' KB' : (mb < 10 ? (+mb.toFixed(1)).toLocaleString(PREFS.lang || undefined) : Math.round(mb)) + ' MB');
// (cómo se llama la carpeta elegida: «Almacenamiento interno › JXMOD», «Tarjeta SD › Mods»)
function gmkNombreRaiz(e) {
  const id = String((e && e.arbol) || ''), m = /^([^:]*):(.*)$/.exec(id);
  if (!m) return (e && e.nombre) || id;
  const vol = m[1] === 'primary' ? T('gmk.interno') : m[1] === 'home' ? T('gmk.documentos') : /^[0-9A-F]{4}-[0-9A-F]{4}$/i.test(m[1]) ? T('gmk.sd') : m[1];
  return vol + (m[2] ? ' › ' + m[2].replace(/\//g, ' › ') : '');
}
// las filas: lo que encontró la última lectura y, si no se leyó en esta vez, lo guardado de antes
function gmkFilas() {
  const F = (GMK.filas || []).slice(), ya = new Set(F.map((f) => f.id).filter(Boolean));
  for (const [id, x] of Object.entries(PREFS.gmod || {})) if (x && x.carpeta && !ya.has(id)) F.push({ id, k: x.carpeta, nombre: x.n, dir: x.ruta, n: x.nArch, mb: x.mbG || 0, gma: /\.gma$/i.test(x.ruta || ''), estado: gmHabilitado(id) ? 'igual' : 'off', guardado: true });
  for (const f of F) if (f.id && PREFS.gmod && PREFS.gmod[f.id]) { const x = PREFS.gmod[f.id]; if (x.mbG) f.mbG = x.mbG; if (f.estado === 'igual' && !gmHabilitado(f.id)) f.estado = 'off'; }
  return F;
}
function gmkHTML(lugar) {
  const aj = lugar === 'aj', B = aj ? 'ajBtn gris' : 'rbBtnGris', BP = aj ? 'ajBtn' : 'rbBtnG', P = gmkPrefs(), app = gmkApp(), fsa = !app && gmkFSA(), ios = !app && typeof IOS !== 'undefined' && IOS;
  const E = app ? gmkEstadoApp() : null, va = GMK.va || (GMK.leyendo ? { fase: 'listando' } : null), ocupado = !!va;
  const filas = gmkFilas(), inst = filas.filter((f) => f.id && f.estado !== 'quitado' && f.estado !== 'vacio' && PREFS.gmod && PREFS.gmod[f.id]);
  const mbG = inst.reduce((s, f) => s + (f.mbG || 0), 0), tieneC = app ? !!(E && E.arbol) : fsa ? !!GMK.h : false;
  const btn = (cls, acc, ico, txt, dis) => `<button class="${cls}" data-gmk="${esc(acc)}"${dis ? ' disabled' : ''}>${glifo(ico)}<span>${esc(txt)}</span></button>`;
  // (arriba: la carpeta, qué hay guardado y los botones)
  let raiz = '';
  if (app) raiz = tieneC ? gmkNombreRaiz(E) : T('gmk.sinElegir');
  else if (fsa) raiz = GMK.h ? GMK.h.name : T('gmk.sinElegir');
  else raiz = T(ios ? 'gmk.sinFSAi' : 'gmk.sinFSA');
  const avisos = [];
  if (app && E && E.arbol && E.permiso === false) avisos.push(['aviso', T('gmk.sinPermiso')]);
  if (fsa && GMK.h && GMK.perm && GMK.perm !== 'granted') avisos.push(['info', T('gmk.permiso')]);
  const roto = fsa && (GMK.hRoto || gmkHRoto()); if (roto) avisos.push(['info', T('gmk.noGuarda')]);
  if (GMK.err) avisos.push(['aviso', T('gmk.errLeer').replace('{e}', GMK.err)]);
  if (GMK.creada) avisos.push(['si', T('gmk.creada').replace('{c}', GMK.creada)]);
  else if (GMK.nada && !ocupado && (!app || tieneC)) avisos.push(['info', T('gmk.nada')]);
  for (const f of filas) if (f.raiz && f.k === 'c' && f.err && !f.sin && !(app && E && E.permiso === false)) avisos.push(['aviso', /permiso/i.test(f.err) ? T('gmk.sinPermiso') : T('gmk.errLeer').replace('{e}', f.err)]);
  const vaTxt = !va ? '' : va.fase === 'listando' ? T('gmk.leyendo') : T('gmk.copiando').replace('{i}', va.i + 1).replace('{n}', va.n).replace('{m}', va.nombre || '') + (va.mb ? ' · ' + gmkMB(va.mb) : '');
  const porK = { c: 0, a: 0, i: 0 }; for (const f of inst) porK[f.k] = (porK[f.k] || 0) + 1;
  const deCada = Object.values(porK).filter(Boolean).length > 1 ? ' (' + ['c', 'a', 'i'].filter((k) => porK[k]).map((k) => T('gmk.en' + k.toUpperCase()).replace('{n}', porK[k])).join(' · ') + ')' : '';
  const res = `<span class="gmkRes">${esc(inst.length ? T(inst.length === 1 ? 'gmk.resumen1' : 'gmk.resumen').replace('{n}', inst.length).replace('{mb}', gmkMB(mbG)) + deCada : T('gmk.ninguno'))}${P.ult ? ' · ' + esc(T('gmk.ult').replace('{f}', new Date(P.ult).toLocaleString(PREFS.lang || undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))) : ''}</span>`;
  const acc = [];
  if (app || fsa) {
    if (tieneC) acc.push(btn(BP + ' gmkLeer', 'leer', 'girar', T('gmk.leer'), ocupado));
    acc.push(btn(tieneC ? B : BP, 'elegir', 'carpeta', T(tieneC ? 'gmk.cambiar' : app ? 'gmk.elegir' : 'gmk.elegirW'), ocupado));
    if (app && !tieneC) acc.push(btn(B, 'leer', 'girar', T('gmk.leer'), ocupado));   // (Android/data se lee aunque no haya ninguna elegida)
  } else if (!ios) acc.push(btn(BP, 'elegirI', 'carpeta', T('gmk.elegirW'), ocupado));
  if (!app) acc.push(btn(ios ? BP : B, 'zip', 'subir', T('gmk.zip'), ocupado));
  if (tieneC) acc.push(btn(B + ' gmkOlvidar', 'olvidar', 'basura', T('gmk.olvidar'), ocupado));
  const auto = (app || fsa) ? `<label class="gmkAuto"><input type="checkbox" data-gmk="auto"${P.auto === false ? '' : ' checked'}><i></i><span>${esc(T('gmk.auto'))}</span></label>` : '';
  const cab = `<div class="gmkCaja"><div class="gmkRaiz">${glifo('carpeta')}<div><b dir="auto">${esc(raiz)}</b>${res}</div></div>
    ${va ? `<div class="gmkVa"><i style="width:${va.n ? Math.round(((va.i + (va.fase === 'montando' ? 0.8 : va.fase === 'guardando' ? 0.5 : 0.15)) / va.n) * 100) : 8}%"></i><span>${esc(vaTxt)}</span></div>` : ''}
    ${avisos.map(([g, t]) => `<p class="gmkAviso">${glifo(g)}<span>${esc(t)}</span></p>`).join('')}${GMK.msj && !va ? `<p class="gmkHecho" role="status">${glifo('si')}<span>${esc(gmkMsj())}</span></p>` : ''}
    <div class="gmkAcc">${acc.join('')}${auto}</div></div>`;
  // (cómo se usa, en tres pasos)
  const pasos = app ? [T('gmk.p1A'), T('gmk.p2'), T('gmk.p3A')] : fsa ? [T('gmk.p1W'), T('gmk.p2'), T(roto ? 'gmk.p3N' : 'gmk.p3W')] : ios ? [T('gmk.p1I'), T('gmk.p2'), T('gmk.p3I')] : [T('gmk.p1N'), T('gmk.p2'), T('gmk.p3N')];
  const ayuda = `<ol class="gmkPasos">${pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>${app && E && E.app ? `<p class="gmkNota">${glifo('info')}<span>${esc(T('gmk.appDir').replace('{r}', E.app))}</span></p>` : ''}${!app ? `<div class="gmkSoltar">${glifo('subir')}<span>${esc(T('gmk.soltar'))}</span></div>` : ''}`;
  // (lo encontrado, por carpeta)
  const fila = (f) => {
    const [g, c] = GMK_EST[f.estado] || GMK_EST.igual, A = f.id && GMOD.addons.get(f.id), foto = gmkFoto(A);
    const det = [f.gma ? T('gmk.gmaSuelto') : f.n ? T(f.n === 1 ? 'gmk.archivo' : 'gmk.archivos').replace('{n}', f.n) : '', f.mbG || f.mb ? gmkMB(f.mbG || f.mb) : ''].filter(Boolean).join(' · ');
    const extra = f.estado === 'vacio' ? T('gmk.vacioAy') : f.estado === 'error' ? f.err || '' : f.estado === 'quitado' ? T('gmk.quitadoAy') : '';
    const bt = [];
    if (f.estado === 'quitado') bt.push(`<button class="${B} gmkMini" data-gmk="poner:${esc(f.id)}"${ocupado ? ' disabled' : ''}>${glifo('mas')}<span>${esc(T('gmk.poner'))}</span></button>`);
    else if (A && !aj) bt.push(`<button class="${B} gmkMini" data-rb="ver:${esc(f.id)}">${glifo('adelante')}<span>${esc(T('gmk.ver'))}</span></button>`);
    for (const x of f.faltan || []) bt.push(`<button class="${B} gmkMini" data-gmk="bajar:${esc(x.w)}" title="${esc(T('gmk.falta').replace('{b}', x.n))}">${glifo('bajar')}<span>${esc(T('gmk.bajarBase').replace('{b}', x.n))}</span></button>`);
    return `<div class="gmkFila gmk_${esc(f.estado)}"><img alt="" src="${esc(foto.src)}"${foto.gm ? ` data-gm="${esc(foto.gm)}"` : ''}><div class="gmkFilaT"><b dir="auto">${esc(f.nombre || '')}</b><small dir="auto">${esc(f.dir || '')}${det ? ' · ' + esc(det) : ''}</small>${extra ? `<small class="gmkExtra" dir="auto">${esc(extra)}</small>` : ''}${(f.faltan || []).length ? `<small class="gmkExtra">${esc(f.faltan.map((x) => T('gmk.falta').replace('{b}', x.n)).join(' · '))}</small>` : ''}</div>
      <i class="gmkEst gmkE_${c}">${glifo(g)}<span>${esc(T('gmk.e.' + f.estado))}</span></i>${bt.join('')}</div>`;
  };
  const grupos = [['c', app ? T('gmk.deC') : fsa ? T('gmk.deC') : ''], ['a', T('gmk.deA')], ['i', T('gmk.deI')]];
  const lista = grupos.map(([k, t]) => { const L = filas.filter((f) => f.k === k && !f.raiz); if (!L.length) return ''; L.sort((a, b) => (a.estado === 'vacio') - (b.estado === 'vacio') || String(a.nombre).localeCompare(String(b.nombre), undefined, { numeric: true, sensitivity: 'base' })); return `<div class="rbSecc gmkSecc">${esc(t || T('gmk.encontrados'))}<em>${inst.filter((f) => f.k === k).length}</em></div>${L.map(fila).join('')}`; }).join('');
  return `<div class="gmk${aj ? ' gmkAj' : ''}">${aj ? '' : `<div class="gmkTit"><button class="rbBtnGris rbFichaX" data-rb="fichaNo" title="${esc(T('volver'))}">${glifo('atras')}<span>${esc(T('t.gmod'))}</span></button><h3>${glifo('carpeta')} ${esc(T('gmk.titulo'))}</h3></div>`}${cab}${lista ? `<div class="gmkLista">${lista}</div>` : ''}<details class="gmkAyuda"${lista ? '' : ' open'}><summary>${esc(T('gmk.como'))}</summary>${ayuda}</details></div>`;
}
// (la foto de un addon montado: la de lo primero que trae —arma, NPC, vehículo, entidad, personaje o prop—; si su ícono
// todavía se está dibujando, la G y data-gm para que gmIconosPaso la cambie cuando esté)
function gmkFoto(A) {
  if (!A) return { src: GM_ICO };
  const u = PREFS.gmod && PREFS.gmod[A.id] && PREFS.gmod[A.id].img; if (u) return { src: u };
  if (typeof gmbItems !== 'function') return { src: GM_ICO };
  const I = gmbItems(A), it = I.armas[0] || I.npcs[0] || I.vehs[0] || I.ents[0] || I.pms[0] || I.props[0];
  if (!it) return { src: GM_ICO };
  const f = gmbFoto(it); return f.k !== 'ph' ? { src: f.src } : { src: GM_ICO, gm: f.gm };
}
// ¿está a la vista la carpeta (en la tienda o en Ajustes)? Entonces lo que pasa se dice adentro del panel, no con el aviso
// de abajo, que tapaba las filas
function gmkVisible() {
  const t = typeof RB !== 'undefined' && RB.t && RB.t.carpeta && RB.t.tab === 'gmod' && RB.panel === 'tienda' && typeof rbVisible === 'function' && rbVisible();
  const a = document.querySelector('#ajustesCaja .gmkCont'), aj = document.getElementById('ajustes');
  return !!(t || (a && a.offsetParent !== null && aj && !aj.classList.contains('oc')));
}
// (t: el texto, o una función que lo arma en el idioma de ese momento)
function gmkAvisar(t) { GMK.msj = t; if (gmkVisible()) gmkDibujar(); else menuAviso(gmkMsj()); }
const gmkMsj = () => (typeof GMK.msj === 'function' ? GMK.msj() : String(GMK.msj || ''));
// dibujar donde esté abierto (la tienda y/o Ajustes); de a uno por cuadro
function gmkDibujar() {
  if (GMK.dibT) return; GMK.dibT = requestAnimationFrame(() => {
    GMK.dibT = 0;
    if (typeof RB !== 'undefined' && RB.t && RB.t.carpeta && RB.t.tab === 'gmod' && RB.panel === 'tienda' && typeof gmTiendaDibujar === 'function') gmTiendaDibujar();
    const a = document.querySelector('#ajustesCaja .gmkCont'); if (a && a.offsetParent !== null) gmkPintar(a, 'aj');
  });
}
function gmkPintar(el, lugar) {
  const d = el.querySelector('details.gmkAyuda'), abierto = d ? d.open : null;
  el.innerHTML = gmkHTML(lugar);
  const d2 = el.querySelector('details.gmkAyuda'); if (d2 && abierto !== null) d2.open = abierto;
  if (!el.__gmk) {
    el.__gmk = true;
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-gmk]'); if (!b || b.tagName === 'INPUT') return; e.stopPropagation(); gmkAccion(b.dataset.gmk); });
    el.addEventListener('change', (e) => { const b = e.target.closest('input[data-gmk=auto]'); if (!b) return; gmkPrefs().auto = b.checked; guardarPrefs(); });
  }
}
// (lo de la tienda: la vista de la carpeta en lugar de la grilla, con el ancho de una ficha)
function gmkTiendaDibujar(G) {
  G.classList.add('rbFichaModo'); tiFichaModo(true); gmkPintar(G, 'tienda');
  const R = RB.el; for (const s of ['.rbHab', '.gmSelPie', '.rbTotal']) { const e = R.querySelector(s); if (e) e.innerHTML = ''; }
  const mas = R.querySelector('[data-rb=mas]'); if (mas) mas.style.display = 'none';
  const cu = R.querySelector('.tiCuantos'); if (cu) cu.textContent = '';
  if (!GMK.vio && !GMK.leyendo && !GMK.va) { GMK.vio = true; if (!gmkApp() && gmkFSA()) gmkHLeer().then(async (h) => { if (h) { try { GMK.perm = await h.queryPermission({ mode: 'read' }); } catch (e) {} } gmkDibujar(); }); }
  tiEncajar();
}
function gmkAccion(a) {
  const [k, v] = String(a).split(/:(.*)/s);
  switch (k) {
    case 'elegir': return gmkElegir();
    case 'elegirI': return gmkElegirInput(true);
    case 'zip': return gmkElegirInput(false);
    case 'leer': return gmkLeer({ toque: true });
    case 'olvidar': return gmkOlvidar();
    case 'poner': return gmkPonerOtraVez(v);
    case 'bajar': if (typeof gmcPoner === 'function') { gmcPoner(v).then(() => { for (const f of GMK.filas || []) if (f.id && GMOD.addons.has(f.id)) f.faltan = gmkFaltan(GMOD.addons.get(f.id)); gmkDibujar(); }).catch(() => {}); gmkAvisar(() => T('gmk.bajando')); } return;
  }
}
// soltar carpetas, .zip o .gma sobre la pestaña GMod de la tienda (una vez por panel)
function gmkSoltarConectar(P) {
  if (P.__gmkSoltar) return; P.__gmkSoltar = true;
  const hay = (e) => RB.t.tab === 'gmod' && e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  P.addEventListener('dragover', (e) => { if (!hay(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; P.classList.add('gmkArrastre'); });
  P.addEventListener('dragleave', (e) => { if (e.target === P || !P.contains(e.relatedTarget)) P.classList.remove('gmkArrastre'); });
  P.addEventListener('drop', (e) => {
    P.classList.remove('gmkArrastre'); if (!hay(e)) return; e.preventDefault();
    if (gmkSoltar(e.dataTransfer)) { RB.t.carpeta = true; RB.t.ficha = null; gmTiendaDibujar(); }
  });
}
