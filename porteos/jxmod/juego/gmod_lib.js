// ---------------- el contenido base de GMod y HL2 que usan los addons (web/rb/gm_lib.*) ----------------
// Los addons dan por hecho lo que trae GMod (y HL2): los brazos c_arms, las armas c_/w_ de HL2 y de CS:S, las manos de
// CS:S, munición y objetos, props de HL2 y de PHX, sprites, efectos, partículas, estelas y sonidos. Eso está en una
// biblioteca al lado del HTML (herramientas/gmod_base.py): un índice chico y los archivos en trozos. Cuando se monta un
// addon se buscan las rutas que pide (en su Lua, en sus .vmt y en sus .mdl) y se bajan sólo esas, con pedidos de rango
// (Range) juntando las que están cerca; después las de segundo nivel (los materiales de esos modelos, las texturas de
// esos materiales). Si algo se pide en pleno juego y no estaba, se baja en el momento y, cuando llega, se rehace lo que
// lo esperaba (texturas, materiales, modelos de entidades). Para el juego es un addon más, el último en prioridad.
const GM_LIB = 'gm_lib.b481aeb12b.idx';   // (lo escribe herramientas/gmod_base.py)
const GML = { idx: null, prom: null, datos: new Map(), cola: new Set(), trozos: new Map(), timer: 0, bajando: 0, n: 0, bytes: 0, esperan: new Set() };
function gmlIniciar() {
  if (GML.prom) return GML.prom;
  GML.prom = (async () => {
    if (!GM_LIB || typeof rbBajar !== 'function') return null;
    const u8 = await rbBajar(GM_LIB); if (!u8) throw new Error('sin índice');
    GML.idx = JSON.parse(new TextDecoder().decode(await desgz(u8)));
    return GML.idx;
  })().catch((e) => { GML.idx = null; return null; });
  return GML.prom;
}
const gmlTiene = (r) => !!(GML.idx && GML.idx.f[r]) || (typeof gbsTiene === 'function' && gbsTiene(r));   // (la propia o Steam: gmod_steam.js)
// un pedazo de un trozo: con Range si el servidor sabe; si no, el trozo entero (una vez) y se corta acá
// (un trozo entero —el servidor no sabe de rangos— queda sólo mientras se lo usa: a los 15 s se suelta; lo que se sacó de
// él ya está copiado. Antes quedaban para siempre: dos de 38 MB con tres addons, mucho para un celular de 2 GB)
function gmlSoltarTrozos() { clearTimeout(GML.tSoltar); GML.tSoltar = setTimeout(() => { GML.trozos.clear(); }, 15000); }
async function gmlRango(trozo, a, b) {
  const nom = GML.idx.t[trozo];
  if (GML.trozos.has(nom)) { const t = await GML.trozos.get(nom); gmlSoltarTrozos(); if (t) return t.subarray(a, b); }
  for (const base of RBP.bases) {
    if (location.protocol === 'file:' && !/^https?:/.test(base)) continue;
    const url = new URL(base + nom, location.href).href;
    try {
      const r = await fetch(url, { headers: { Range: 'bytes=' + a + '-' + (b - 1) } });
      if (r.status === 206) { const u = new Uint8Array(await r.arrayBuffer()); if (u.length === b - a) { GML.bytes += u.length; return u; } }
      else if (r.ok) { const p = r.arrayBuffer().then((x) => new Uint8Array(x)); GML.trozos.set(nom, p); gmlSoltarTrozos(); const t = await p; GML.bytes += t.length; return t.subarray(a, b); }
    } catch (e) {}
  }
  return null;
}
// bajar una lista de rutas (las que están en la biblioteca y todavía no se tienen)
async function gmlTraer(rutas) {
  await gmlIniciar();
  // (lo que no está en la propia y sí en Steam)
  const deSteam = typeof gbsTraer === 'function' ? gbsTraer(rutas.filter((r) => !(GML.idx && GML.idx.f[r]))) : Promise.resolve(0);
  if (!GML.idx) return deSteam;
  const F = GML.idx.f, por = new Map();
  for (const r of rutas) { if (GML.datos.has(r) || !F[r]) continue; const x = F[r]; if (!por.has(x[0])) por.set(x[0], []); por.get(x[0]).push([r, x]); }
  let n = 0;
  await Promise.all([...por].map(async ([t, L]) => {
    L.sort((p, q) => p[1][1] - q[1][1]);
    // (rangos juntos: si dos archivos están a menos de 96 KB, un solo pedido)
    const grupos = []; let g = null;
    for (const it of L) { const o = it[1][1], e = o + it[1][2]; if (g && o - g.b < 98304 && e - g.a < 8e6) { g.b = Math.max(g.b, e); g.L.push(it); } else { g = { a: o, b: e, L: [it] }; grupos.push(g); } }
    for (const G of grupos) {
      const u = await gmlRango(t, G.a, G.b); if (!u) continue;
      for (const [r, x] of G.L) {
        let d = u.subarray(x[1] - G.a, x[1] - G.a + x[2]);
        if (x[3]) { try { d = await desgz(d); } catch (e) { continue; } } else d = d.slice();
        GML.datos.set(r, d); n++; GML.n++;
      }
    }
  }));
  return n + (await deSteam);
}
// las rutas que un archivo pide: strings del Lua, la textura de un .vmt, los materiales de un .mdl
const _gmlStr = /["']([A-Za-z0-9_\-./\\ ]{3,120})["']/g;
function gmlCandidatos(s, out) {
  s = s.toLowerCase().replace(/\\/g, '/').trim().replace(/^\/+/, '');
  for (const c of [s, 'materials/' + s, 'materials/' + s + '.vmt', 'materials/' + s + '.vtf', 'sound/' + s, 'models/' + s]) if (gmlTiene(c)) out.add(c);
}
function gmlRefs(r, b, out) {
  try {
    if (/\.(lua|txt|vmt)$/.test(r)) { const s = new TextDecoder('latin1').decode(b); for (const m of s.matchAll(_gmlStr)) gmlCandidatos(m[1], out);
      if (r.endsWith('.vmt')) for (const m of s.matchAll(/\$(basetexture2?|include)"?\s+"?([^"\r\n]+)/gi)) { const v = m[2].trim().toLowerCase().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.(vtf|vmt)$/, ''); gmlCandidatos(v.startsWith('materials/') ? v.slice(10) : v, out); } }
    else if (r.endsWith('.mdl')) {
      const M = GMF.mdl(b); const base = r.slice(0, -4);
      for (const e of ['.vvd', '.phy', '.dx90.vtx', '.vtx', '.dx80.vtx', '.sw.vtx']) if (gmlTiene(base + e)) out.add(base + e);
      for (const t of M.texturas) for (const c of M.carpetas.length ? M.carpetas : ['']) { const p = 'materials/' + (c ? c.replace(/\/?$/, '/') : '') + t + '.vmt'; if (gmlTiene(p)) out.add(p); }
    }
  } catch (e) {}
}
// antes de correr un addon: lo que pide de la biblioteca (y lo que piden esas cosas), en tres pasadas
async function gmlPreparar(A) {
  await Promise.all([gmlIniciar(), typeof gbsIniciar === 'function' ? gbsIniciar() : null]); if (!GML.idx && !(typeof GBS !== 'undefined' && GBS.idx)) return;
  const t0 = performance.now(); let pedir = new Set();
  for (const [r, b] of A.G.archivos) if (/\.(lua|txt|vmt|mdl)$/.test(r)) gmlRefs(r, b, pedir);
  // (de Steam se baja de a pedazos de 1 MB: de entrada sólo lo que nombran las armas, que se ven apenas se agarran; lo
  // demás, cuando se usa: gmArchivo lo pide y gmlLlegaron rehace lo que lo esperaba)
  const deArmas = new Set(); for (const [r, b] of A.G.archivos) if (/^lua\/weapons\//.test(r)) gmlRefs(r, b, deArmas);
  for (const r of [...pedir]) if (!(GML.idx && GML.idx.f[r]) && !deArmas.has(r)) pedir.delete(r);
  if ([...A.G.archivos.keys()].some((r) => r.startsWith('lua/weapons/'))) for (const r of ['models/weapons/c_arms_citizen.mdl']) if (gmlTiene(r)) pedir.add(r);   // (las manos de GMod para las armas con UseHands)
  for (let k = 0; k < 3 && pedir.size; k++) {
    const L = [...pedir].filter((r) => !GML.datos.has(r) && !gmArchivo0(r) && !GMPZ.idx.has(r)); if (!L.length) break;
    await gmlTraer(L); const nuevo = new Set();
    for (const r of L) { const b = GML.datos.get(r); if (b && /\.(vmt|mdl)$/.test(r)) gmlRefs(r, b, nuevo); }
    pedir = nuevo;   // (los de segundo nivel sí: los materiales y texturas de lo que se bajó)
  }
  A.libMs = Math.round(performance.now() - t0);
}
// en pleno juego: algo de la biblioteca que no se había bajado (se pide; cuando llega se rehace lo que esperaba)
function gmlPedir(r) {
  if (!gmlTiene(r) || GML.datos.has(r) || GML.cola.has(r)) return;
  GML.cola.add(r);
  if (!GML.timer) GML.timer = setTimeout(gmlPedirAhora, 30);
}
async function gmlPedirAhora() {
  GML.timer = 0; const L = [...GML.cola]; GML.cola.clear(); if (!L.length) return;
  await gmlTraer(L);
  // (lo de segundo nivel: materiales de esos modelos y texturas de esos materiales)
  for (let k = 0; k < 2; k++) { const s = new Set(); for (const r of L) { const b = GML.datos.get(r); if (b && /\.(vmt|mdl)$/.test(r)) gmlRefs(r, b, s); } const L2 = [...s].filter((r) => !GML.datos.has(r)); if (!L2.length) break; await gmlTraer(L2); L.push(...L2); }
  gmlLlegaron(L);
}
// lo que esperaba: texturas y materiales que se habían dado por faltantes, modelos de entidades puestos con la caja
function gmlLlegaron(L) {
  const set = new Set(L), tocaMat = (tex, carpetas) => { for (const c of carpetas.length ? carpetas : ['']) { const r = 'materials/' + (c ? c.replace(/\/?$/, '/') : '') + tex; if (set.has(r + '.vmt') || set.has(r + '.vtf')) return true; } return false; };
  // texturas que se habían dado por faltantes: se vuelven a buscar
  for (const k of [...GMOD.tex.keys()]) { const r = k.replace(/\|i$/, ''); if (set.has('materials/' + r + '.vtf')) GMOD.tex.delete(k); }
  // materiales de modelos: se rehacen en el mismo lugar (las mallas que ya los usan los ven al toque)
  for (const [k, v] of [...GMOD.mats]) {
    const i = k.lastIndexOf('|'), tex = k.slice(0, i), carpetas = k.slice(i + 1) ? k.slice(i + 1).split(',') : [];
    if (!v || !tocaMat(tex, carpetas)) continue;
    GMOD.mats.delete(k); const n = gmMaterial(tex, carpetas), viejo = DATA.mt[v.mi], nuevo = DATA.mt[n.mi];
    if (viejo && nuevo) { Object.assign(viejo, { t: nuevo.t, tt: nuevo.tt, c: nuevo.c, cc: nuevo.cc, sh: nuevo.sh, f: nuevo.f }); if (R.mats) R.mats[v.mi] = undefined; }
    GMOD.mats.set(k, v);
  }
  // los Material() del Lua (HUD y dibujo 3D)
  if (GMA.mats) for (const m of GMA.mats.values()) {
    const k = String(m.n || '').toLowerCase().replace(/\\/g, '/').replace(/^materials\//, '').replace(/\.(vmt|vtf)$/, '');
    if (set.has('materials/' + k + '.vmt') || set.has('materials/' + k + '.vtf') || set.has('materials/' + k)) { m.r3 = null; if (typeof gmaMatCargar === 'function') gmaMatCargar(m); }
  }
  // los modelos de las entidades que se habían puesto con la caja, y los del cliente
  if (GMA.ents) for (const e of GMA.ents.values()) if (e.modelo && set.has(String(e.modelo).toLowerCase()) && e.creado && typeof gmaRehacer === 'function') gmaRehacer(e);
  for (const e of GML.esperan) { if (e.mdCS && set.has(String(e.modelo).toLowerCase())) e.mdCS = null; } GML.esperan.clear();
  if (typeof GMV !== 'undefined') for (const [k, v] of [...GMV.cache]) if (v === null && set.has(k.split('|')[0])) GMV.cache.delete(k);
}
if (typeof module !== 'undefined') module.exports = { GML, gmlIniciar, gmlTraer, gmlPreparar, gmlPedir, gmlTiene };
