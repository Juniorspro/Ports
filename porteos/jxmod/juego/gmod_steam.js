// ---------------- el contenido base desde Steam: HL2, sus episodios y CS:S, archivo por archivo ----------------
// Lo que no está en la biblioteca de al lado del HTML (gmod_lib.js) se busca en el depósito 4021 del servidor dedicado de
// GMod (app 4020: gratis y anónimo, como lo baja cualquier server): trae sourceengine/ (HL2, sus episodios y CS:S) y los
// .vpk de GMod. La tienda da la clave y el código (/api/gmod/base); acá se baja el manifiesto y los índices de los .vpk
// (unos 3 MB la primera vez; después quedan guardados) y, de cada archivo que pide un addon, sólo los pedazos de 1 MB
// del .vpk donde está (descifrados y descomprimidos como los addons de SteamPipe: gmod_pipe.js). Para la biblioteca es
// una segunda fuente: gmlTiene / gmlTraer la consultan cuando algo no está en la propia.
const GBS = { prom: null, info: null, K: null, archivos: null, idx: null, dirs: [], pedazos: new Map(), orden: [], bytes: 0, n: 0 };
// (por prioridad: lo de GMod primero, como en el juego)
const GBS_VPK = ['garrysmod/garrysmod', 'garrysmod/fallbacks', 'sourceengine/hl2_misc', 'sourceengine/hl2_textures', 'sourceengine/content_hl2', 'sourceengine/content_cstrike', 'sourceengine/hl2_sound_misc', 'sourceengine/hl2_sound_vo_english'];
const GBS_TOPE = 48e6;   // (pedazos ya bajados que se guardan en memoria)
const gbsTiene = (r) => !!(GBS.idx && GBS.idx.has(r));
function gbsIniciar() {
  if (GBS.prom) return GBS.prom;
  return (GBS.prom = (async () => {
    if (typeof TIENDA_URL === 'undefined' || typeof gpManifiesto !== 'function') return null;
    // (en la app, se lo pide ella misma a Steam; si no, la tienda)
    let r = null;
    if (typeof redNivel === 'function' && redNivel() >= 2) { try { r = await gmFetch(redURL('_steambase', ''), null, 45000); if (!r.ok) r = null; } catch (e) { r = null; } }
    if (!r) r = await fetch(TIENDA_URL + 'gmod/base'); if (!r.ok) return null;
    const info = await r.json(); if (!info.clave || !info.man) return null;
    GBS.info = info; GBS.K = await crypto.subtle.importKey('raw', gpDeHex(info.clave), 'AES-CBC', false, ['encrypt', 'decrypt']);
    const ck = 'base:' + info.dep + ':' + info.man + ':';
    let z = typeof gmCacheLeer === 'function' ? await gmCacheLeer(ck + 'man') : null;
    if (!z) { z = await gpPedirCDN(TIENDA_URL, info.cdn, `/depot/${info.dep}/manifest/${info.man}/5` + (info.codigo && info.codigo !== '0' ? '/' + info.codigo : '')); if (typeof gmCacheGuardar === 'function') gmCacheGuardar(ck + 'man', z); }
    GBS.archivos = new Map((await gpManifiesto(z, GBS.K)).map((f) => [f.nombre.toLowerCase(), f]));
    GBS.idx = new Map();
    for (let v = 0; v < GBS_VPK.length; v++) {
      const f = GBS.archivos.get(GBS_VPK[v] + '_dir.vpk'); if (!f) continue;
      let b = typeof gmCacheLeer === 'function' ? await gmCacheLeer(ck + GBS_VPK[v]) : null;
      if (!b) { b = await gbsLeer(f, 0, f.tam); if (typeof gmCacheGuardar === 'function') gmCacheGuardar(ck + GBS_VPK[v], b); }
      try { gbsDir(b, v); } catch (e) { if (typeof gmErr === 'function') gmErr('vpk ' + GBS_VPK[v], e); }
    }
    return GBS.idx;
  })().catch((e) => { GBS.idx = null; if (typeof gmErr === 'function') gmErr('contenido base de Steam', e); return null; }));
}
// el índice de un .vpk (versión 1 o 2): extensión → carpeta → nombre → dónde está
function gbsDir(b, v) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); if (dv.getUint32(0, true) !== 0x55aa1234) throw new Error('no es un vpk');
  const ver = dv.getUint32(4, true), arbol = dv.getUint32(8, true), cab = ver === 2 ? 28 : 12, datos = cab + arbol;
  let i = cab; const td = new TextDecoder('latin1');
  const str = () => { const a = i; while (i < b.length && b[i] !== 0) i++; const s = td.decode(b.subarray(a, i)); i++; return s; };
  GBS.dirs[v] = { pre: GBS_VPK[v], b, datos };
  for (;;) {
    const ext = str(); if (!ext) break;
    for (;;) {
      const car = str(); if (!car) break;
      for (;;) {
        const nom = str(); if (!nom) break;
        const pre = dv.getUint16(i + 4, true), arch = dv.getUint16(i + 6, true), off = dv.getUint32(i + 8, true), len = dv.getUint32(i + 12, true);
        i += 18; const pOff = i; i += pre;
        const ruta = ((car === ' ' ? '' : car + '/') + nom + (ext === ' ' ? '' : '.' + ext)).toLowerCase();
        if (!GBS.idx.has(ruta)) GBS.idx.set(ruta, [v, arch, off, len, pOff, pre]);
      }
    }
  }
}
// un pedazo del depósito (1 MB), bajado una vez y guardado mientras entra en el tope
function gbsPedazo(c) {
  let p = GBS.pedazos.get(c.sha); if (p) return p;
  p = (async () => {
    const enc = await gpPedirCDN(TIENDA_URL, GBS.info.cdn, `/depot/${GBS.info.dep}/chunk/${c.sha}`);
    const d = await gpDescomprimir(await gpDescifrar(GBS.K, enc), c.tam);
    if (d.length !== c.tam) throw new Error('pedazo de tamaño malo');
    GBS.bytes += d.length; GBS.orden.push(c.sha);
    while (GBS.bytes > GBS_TOPE && GBS.orden.length > 4) { const s = GBS.orden.shift(), q = GBS.pedazos.get(s); GBS.pedazos.delete(s); if (q) q.then((x) => { GBS.bytes -= x.length; }).catch(() => {}); }
    return d;
  })();
  GBS.pedazos.set(c.sha, p); p.catch(() => GBS.pedazos.delete(c.sha));
  return p;
}
// los bytes [a, b) de un archivo del depósito: sólo los pedazos que los tocan
async function gbsLeer(f, a, b) {
  const out = new Uint8Array(b - a), L = f.pedazos.filter((c) => c.off < b && c.off + c.tam > a);
  await Promise.all(L.map(async (c) => { const d = await gbsPedazo(c), x0 = Math.max(a, c.off), x1 = Math.min(b, c.off + c.tam); out.set(d.subarray(x0 - c.off, x1 - c.off), x0 - a); }));
  return out;
}
// un archivo de los .vpk: lo que viene adelantado en el índice + lo del paquete (o del final del índice)
async function gbsArchivo(r) {
  const e = GBS.idx && GBS.idx.get(r); if (!e) return null;
  const [v, arch, off, len, pOff, pre] = e, D = GBS.dirs[v]; let cuerpo = new Uint8Array(0);
  if (len) {
    if (arch === 0x7fff) cuerpo = D.b.subarray(D.datos + off, D.datos + off + len);
    else { const f = GBS.archivos.get(D.pre + '_' + String(arch).padStart(3, '0') + '.vpk'); if (!f) return null; cuerpo = await gbsLeer(f, off, off + len); }
  }
  const out = new Uint8Array(pre + cuerpo.length); out.set(D.b.subarray(pOff, pOff + pre), 0); out.set(cuerpo, pre);
  return out;
}
// para la biblioteca: trae las rutas que tiene Steam (de a varias a la vez) y las deja en GML.datos
async function gbsTraer(rutas) {
  if (!GBS.idx) return 0; let n = 0;
  const L = rutas.filter((r) => gbsTiene(r) && !GML.datos.has(r));
  for (let i = 0; i < L.length; i += 12) {
    await Promise.all(L.slice(i, i + 12).map(async (r) => {
      try {
        // (cada archivo bajado queda guardado en el aparato: la próxima vez no se baja nada)
        const ck = 'bf:' + r; let b = typeof gmCacheLeer === 'function' ? await gmCacheLeer(ck) : null;
        if (!b) { b = await gbsArchivo(r); if (b && typeof gmCacheGuardar === 'function') gmCacheGuardar(ck, b); }
        if (b) { GML.datos.set(r, b); n++; GBS.n++; }
      } catch (e) { if (typeof gmErr === 'function') gmErr('steam ' + r, e); }
    }));
  }
  return n;
}
