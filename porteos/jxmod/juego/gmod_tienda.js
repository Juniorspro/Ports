// ---------------- la tienda de GMod: el Workshop de Steam entero dentro de "Mods y mapas" ----------------
// Busca de verdad en el Workshop (texto, categoría y orden, de a 30), muestra la ficha de cada addon (foto, suscriptos,
// tamaño, etiquetas, descripción) y lo instala (baja, descomprime en otro hilo, monta modelos, texturas, sonidos y Lua).
// Steam no deja que una página le pida nada: va por el puente de la tienda (/api/gmod/*) y, si todavía no está, por uno
// público. Los addons sin archivo directo (más o menos la mitad) bajan por SteamPipe con la tienda (gmod_pipe.js); si no
// se puede, se importan desde la compu (.gma).
const GM_CAT = 'gm_cat.56ecba085b.bin';   // (el catálogo del Workshop en web/rb/: lo escribe herramientas/gmod_catalogo.mjs)
const GM_TAGS_UI = ['Weapon', 'Entity', 'NPC', 'Vehicle', 'Tool', 'Model', 'Effects', 'Fun', 'Roleplay', 'Realism', 'Cartoon', 'Scenic', 'Build'];
const GM_ORDENES = ['subs', 'pop', 'votos', 'nuevo', 'act'];
const GM_ORDEN_STEAM = { pop: 'trend', nuevo: 'mostrecent', subs: 'totaluniquesubscribers', votos: 'toprated', act: 'lastupdated' };
const gmCompactoCli = (x) => ({ id: String(x.publishedfileid), t: String(x.title || '').slice(0, 90), img: /^https:\/\//.test(x.preview_url || '') ? x.preview_url : '', mb: Math.round((+x.file_size || 0) / 1e5) / 10, subs: x.subscriptions | 0, fav: x.favorited | 0,
  d: String(x.description || '').replace(/\[[^\]]{0,40}\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400), tags: (x.tags || []).map((t) => String(t.tag).slice(0, 20)).slice(0, 8), dir: !!x.file_url, act: x.time_updated | 0 });
const gmIdsDePaginaCli = (h) => [...new Set([...h.matchAll(/publishedfileid\\?"\s*[:=]\s*\\?"(\d{3,12})/g)].map((x) => x[1]))].slice(0, 30);
// ---- el catálogo del Workshop que va al lado del HTML (web/rb/gm_cat.*.bin): busca sin pedirle nada a Steam ----
let _gmCat = null;
function gmCatalogo() {
  if (_gmCat) return _gmCat;
  if (!GM_CAT || typeof rbBajar !== 'function') return Promise.resolve(null);
  return (_gmCat = (async () => {
    const u8 = await rbBajar(GM_CAT); if (!u8) throw new Error('sin catálogo');
    const d = JSON.parse(new TextDecoder().decode(await desgz(u8))), url = (x, pre) => (!x ? '' : /^https?:/.test(x) ? x : pre + x);
    const L = d.l.map(([id, t, img, f, mb10, subs, fav, tg, dias, desc]) => ({ id, t, img: url(img, d.img), f: url(f, d.cdn), mb: mb10 / 10, subs, fav, tags: tg.map((i) => d.tags[i]), act: dias * 86400, d: desc, dir: true, bus: (t + ' ' + desc).toLowerCase() }));
    return { fecha: d.fecha, L, porId: new Map(L.map((x) => [x.id, x])) };
  })().catch(() => { _gmCat = null; return null; }));
}
async function gmBuscarCat(o) {
  const C = await gmCatalogo(); if (!C) throw new Error('sin catálogo');
  const q = String(o.q || '').toLowerCase().trim(), pal = q.split(/\s+/).filter(Boolean);
  let L = C.L.filter((x) => (!o.tag || x.tags.includes(o.tag)) && pal.every((p) => x.bus.includes(p)));
  if (o.orden === 'votos') L = L.slice().sort((a, b) => b.fav - a.fav);
  else if (o.orden === 'nuevo' || o.orden === 'act') L = L.slice().sort((a, b) => b.act - a.act);
  if (q) { const enT = (x) => (x.t.toLowerCase().includes(q) ? 0 : pal.every((p) => x.t.toLowerCase().includes(p)) ? 1 : 2); L = L.map((x, i) => [enT(x), i, x]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]); }
  const p = o.p || 1; return { items: L.slice((p - 1) * 30, p * 30), total: L.length, p, cat: C.fecha };
}
// ---- todo el Workshop en vivo sin el puente propio: la página de búsqueda de Steam leída por r.jina.ai (deja pedir desde
// una página); cada resultado se completa con el catálogo (si se baja directo, tamaño, suscriptos) ----
const GM_LECTOR = 'https://r.jina.ai/';
function gmLeerPagina(h) {
  const L = [], vistos = new Set(), re = /\[!\[Image \d+: (.*?)\]\((https:\/\/images\.steamusercontent\.com\/ugc\/[^)?\s]+)[^)]*\)\]\(https:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/\?id=(\d{3,12})\)/g;
  let m; while ((m = re.exec(h))) {
    if (vistos.has(m[3])) continue; vistos.add(m[3]);
    const resto = h.slice(re.lastIndex, re.lastIndex + 600), a = /\[By ([^\]]{1,40})\]\(https:\/\/steamcommunity\.com\//.exec(resto);
    L.push({ id: m[3], t: m[1].replace(/\\([\[\]])/g, '$1').slice(0, 90), img: m[2], autor: a ? a[1] : '' });
  }
  const tm = /([\d,.]+)\s+entries/i.exec(h);
  return { L, total: tm ? parseInt(tm[1].replace(/[,.]/g, ''), 10) : L.length };
}
async function gmBuscarVivo(o) {
  const p = o.p || 1, ord = GM_ORDEN_STEAM[o.orden] || 'totaluniquesubscribers';
  let u = `https://steamcommunity.com/workshop/browse/?appid=4000&section=readytouseitems&browsesort=${ord}&actualsort=${ord}&p=${p}&numperpage=30&requiredtags%5B%5D=Addon`;
  if (o.tag) u += '&requiredtags%5B%5D=' + encodeURIComponent(o.tag);
  if (o.q) u += '&searchtext=' + encodeURIComponent(o.q); if (ord === 'trend') u += '&days=' + (o.q ? -1 : 7);
  const ctl = typeof AbortController === 'function' ? new AbortController() : null, tt = ctl && setTimeout(() => ctl.abort(), 20000);
  let r; try { r = await fetch(GM_LECTOR + u, ctl ? { signal: ctl.signal } : undefined); } finally { if (tt) clearTimeout(tt); }
  if (!r.ok) throw new Error('lector ' + r.status);
  const { L, total } = gmLeerPagina(await r.text()); if (!L.length && total) throw new Error('lector sin resultados');
  const C = await gmCatalogo();
  return { items: L.map((x) => { const c = C && C.porId.get(x.id); return c ? Object.assign({}, c, { autor: x.autor }) : Object.assign(x, { subs: 0, fav: 0, mb: 0, tags: o.tag ? [o.tag] : [], d: '', dir: undefined }); }), total, p, vivo: true };
}
// la ficha de uno que no está en el catálogo: su página (etiquetas, tamaño, suscriptos, favoritos y descripción)
function gmLeerFicha(h) {
  const o = {}, tg = /Addon Tags:(.*)/.exec(h); if (tg) o.tags = [...tg[1].matchAll(/\[([^\]]{1,24})\]\(/g)].map((x) => x[1]).slice(0, 8);
  const tm = /File Size[\s\S]{0,80}?\n\s*([\d.,]+)\s*(KB|MB|GB)\s*\n/i.exec(h); if (tm) o.mb = Math.round(parseFloat(tm[1].replace(/,/g, '')) * ({ KB: 0.001, MB: 1, GB: 1000 })[tm[2].toUpperCase()] * 10) / 10;
  const su = /([\d,]+)\s+Current Subscribers/.exec(h); if (su) o.subs = +su[1].replace(/,/g, '');
  const fa = /([\d,]+)\s+Current Favorites/.exec(h); if (fa) o.fav = +fa[1].replace(/,/g, '');
  const i = h.lastIndexOf('\nDescription\n'); if (i >= 0) { let d = h.slice(i + 13); const f = d.search(/\n\d+\s+Comments|\n\[<\]|\nPopular Discussions|\nView All \(/); if (f > 0) d = d.slice(0, f);
    o.d = d.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_#>`]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600); }
  return o;
}
async function gmFichaVivo(it) {
  if (it.detVivo || (it.d && it.subs)) return; it.detVivo = true;
  try { const r = await fetch(GM_LECTOR + 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + it.id); if (!r.ok) return; const o = gmLeerFicha(await r.text()); for (const k in o) if (o[k] !== undefined && (o[k] || !it[k])) it[k] = o[k]; }
  catch (e) {}
  if (RB.t && RB.t.ficha === it.id) gmTiendaDibujar();
}
// ¿está el puente propio en la tienda? (se pregunta una vez; si no, el lector y el catálogo; para detalles sueltos, el puente público)
let _gmApi = null;
function gmApiHay() {
  if (_gmApi) return _gmApi;
  // (con tiempo máximo; si no contestó, se vuelve a preguntar en un minuto en vez de quedar en «no» para siempre)
  return (_gmApi = (async () => { try { const r = await gmFetch(TIENDA_URL + 'gmod/detalles?ids=0', null, 10000); return r.ok && Array.isArray((await gmTiempo(r.json(), 10000)).items); } catch (e) { setTimeout(() => { _gmApi = null; }, 60000); return false; } })());
}
async function gmBuscar(o) {
  const p = o.p || 1;
  if (await gmApiHay()) {
    try { const r = await fetch(`${TIENDA_URL}gmod/buscar?q=${encodeURIComponent(o.q || '')}&tag=${o.tag || ''}&orden=${o.orden || 'pop'}&p=${p}`); if (r.ok) return await r.json(); } catch (e) {}
  }
  if (o.soloDir) { try { return await gmBuscarCat(o); } catch (e) {} }   // (sólo los que se bajan directo: el catálogo, al instante)
  try { return await gmBuscarVivo(o); } catch (e) {}
  try { return await gmBuscarCat(o); } catch (e) {}
  const ord = GM_ORDEN_STEAM[o.orden] || 'trend';
  let u = `https://steamcommunity.com/workshop/browse/?appid=4000&section=readytouseitems&browsesort=${ord}&actualsort=${ord}&p=${p}&numperpage=30&requiredtags%5B%5D=Addon`;
  if (o.tag) u += '&requiredtags%5B%5D=' + encodeURIComponent(o.tag);
  if (o.q) u += '&searchtext=' + encodeURIComponent(o.q); if (ord === 'trend') u += '&days=' + (o.q ? -1 : 7);
  const h = await (await gmPedir(u)).text(), ids = gmIdsDePaginaCli(h), tm = /([\d,.]+)\s+entries/i.exec(h);
  const det = await gmDetalles(ids);
  return { items: ids.map((i) => det.get(i)).filter(Boolean).map(gmCompactoCli), total: tm ? parseInt(tm[1].replace(/[,.]/g, ''), 10) : ids.length, p };
}
async function gmDetallesCompactos(ids) {
  if (await gmApiHay()) { try { const r = await fetch(TIENDA_URL + 'gmod/detalles?ids=' + ids.join(',')); if (r.ok) return (await r.json()).items; } catch (e) {} }
  const C = await gmCatalogo(); if (C && ids.every((i) => C.porId.has(String(i)))) return ids.map((i) => C.porId.get(String(i)));
  const d = await gmDetalles(ids); return ids.map((i) => d.get(String(i))).filter(Boolean).map(gmCompactoCli);
}
const gmCifra = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(n | 0));
const gmNoCompat = () => false;   // (los mapas ya se juegan y los modos de juego cargan su contenido: nada se marca como no compatible)
const gmInstalado = (id) => GMOD.addons.has(String(id)) || !!(PREFS.gmod && PREFS.gmod[id]);

// ---------------- la pestaña GMod de la tienda (menú principal) ----------------
function gmTiendaPanel(P) {
  const S = RB.t; if (!GM_ORDENES.includes(S.gmOrden)) S.gmOrden = 'subs'; if (S.gmDir === undefined) S.gmDir = false;
  const tab = (k, ic, t) => `<button class="rbTab${S.tab === k ? ' sel' : ''}" data-rb="tab:${k}">${ic} ${esc(T(t))}</button>`;
  P.innerHTML = `<div class="rbPanCab">${esc(T('m.tienda'))}
      <span class="rbTabs">${tab('mod', icoHTML('ico:mod'), 't.mods')}${tab('mapa', glifo('mapa'), 't.mapas')}${tab('anim', icoHTML('ico:animacion'), 't.anims')}${tab('gmod', `<img class="rbGmIco" src="${GM_ICO}" alt="">`, 't.gmod')}</span>
      <span class="rbEsp"></span><label class="rbBtnGris rbChico">${glifo('subir')} ${esc(T('gm.importar'))}<input type="file" id="gmArchivo" accept=".gma,.bin" hidden></label></div>
    <div class="rbBarra"><input id="rbBuscar" type="search" placeholder="${esc(T('buscar'))} · ${esc(T('gm.tit'))}" value="${esc(S.q)}">
      <select id="rbOrden">${GM_ORDENES.map((k) => `<option value="${k}"${S.gmOrden === k ? ' selected' : ''}>${esc(T('gm.o.' + k))}</option>`).join('')}</select>
      <span class="rbSeg"><button class="${S.vista === 'explorar' ? 'sel' : ''}" data-rb="vista:explorar">${esc(T('v.tienda'))}</button><button class="${S.vista === 'instalados' ? 'sel' : ''}" data-rb="vista:instalados">${esc(T('v.instalados'))}</button></span></div>
    <div class="rbEtqs"><button class="rbEtq${!S.etq ? ' sel' : ''}" data-rb="etq:">${esc(T('e.todas'))}</button>${GM_TAGS_UI.map((e) => `<button class="rbEtq${S.etq === e ? ' sel' : ''}" data-rb="etq:${e}">${esc(T('gm.t.' + e))}</button>`).join('')}<button class="rbChk gmDir${S.gmDir ? ' on' : ''}" data-rb="gmdir"><em></em>${esc(T('gm.soloDir'))}</button></div>
    <p class="gmPMnota">${esc(T('pjm.nota'))} <button class="rbBtnGris" data-rb="pjMods">${esc(T('m.personajes'))} → ${esc(T('pjm.tab'))}</button></p>
    <div class="rbGrid rbTiendaG"></div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="volver">${glifo('atras')} ${esc(T('volver'))}</button><span class="rbHab"></span><span class="gmSelPie"></span><span class="rbEsp"></span><span class="rbTotal"></span><button class="rbBtnGris" data-rb="mas">${glifo('mas3')}</button>
      <button class="rbBtnG" data-rb="nueva">${esc(T('m.nueva'))} ${glifo('jugar')}</button></div>`;
  P.querySelector('#rbOrden').addEventListener('change', (e) => { S.gmOrden = e.target.value; });   // (antes que el de inicio.js, que vuelve a cargar)
  P.querySelector('#gmArchivo').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) gmTiendaImportar(f); });
  gmTiendaCargar(true);
}
function gmTiendaCargar(desdeCero) {
  const S = RB.t, n = ++S.n; if (!GM_ORDENES.includes(S.gmOrden)) S.gmOrden = 'subs'; if (S.gmDir === undefined) S.gmDir = false;
  if (desdeCero) { S.p = 0; S.items = []; S.vistosGM = 0; }
  if (S.vista === 'instalados') {
    const q = S.q.toLowerCase();
    S.items = Object.entries(PREFS.gmod || {}).map(([id, x]) => Object.assign({ id, t: x.n, img: x.img || '', tags: x.tags || [], subs: x.subs || 0, mb: x.mb || 0, dir: !/^local:/.test(id), d: x.d || '' }, S.det && S.det[id] ? S.det[id] : {}))
      .filter((x) => (!q || String(x.t).toLowerCase().includes(q)) && (!S.etq || (x.tags || []).includes(S.etq))).sort((a, b) => String(a.t).localeCompare(String(b.t), undefined, { numeric: true, sensitivity: 'base' }));   // (con los números en su lugar: 2 antes que 10)
    S.total = S.items.length; S.error = false; S.cargando = false; return gmTiendaDibujar();
  }
  S.cargando = true; S.error = false; gmTiendaDibujar();
  // (con "sólo descarga directa": se siguen pidiendo páginas, hasta 5, hasta juntar 12 nuevos que se puedan instalar)
  (async () => {
    const antes = S.items.length;
    for (let k = 0; k < (S.gmDir ? 8 : 1); k++) {
      const d = await gmBuscar({ q: S.q, tag: S.etq, orden: S.gmOrden, p: S.p + 1, soloDir: S.gmDir }); if (n !== S.n) return;
      // (los modelos de jugador no se mezclan con los mods: están en Personajes → Mods)
      const vistos = new Set(S.items.map((x) => x.id)), L = (d.items || []).filter((x) => !vistos.has(x.id) && !(typeof gmEsPM === 'function' && gmEsPM(x)));
      S.vistosGM = (S.vistosGM || 0) + (d.items || []).length; S.items = S.items.concat(S.gmDir ? L.filter((x) => x.dir === true) : L);
      S.total = Math.max(d.total || 0, S.items.length); S.finGM = !(d.items || []).length || S.vistosGM >= S.total;
      if (S.items.length - antes >= 12 || S.finGM) break;
      S.p++;
    }
    S.cargando = false; gmTiendaDibujar();
  })().catch(() => { if (n !== S.n) return; S.cargando = false; S.error = !S.items.length; S.total = S.items.length; gmTiendaDibujar(); });
}
// lo que se puede abrir al toque de un addon instalado: sus mapas (Jugar), lo que se pone en el juego (Probar: arranca una
// partida —o sigue la de ahora— y abre el panel GMod en ese addon) y sus personajes (Ponérmelo)
function gmFichaAbrir(A) {
  if (!A) return '';
  const mapas = typeof GBSP !== 'undefined' ? [...GBSP.mapas].filter(([, m]) => m.id === A.id).slice(0, 3) : [];
  const pms = typeof gmpLista === 'function' ? gmpLista().filter((r) => A.G && A.G.archivos.has(r)).slice(0, 2) : [];
  const cosas = (A.sweps || []).length + (A.sents || []).length + (A.listas && A.listas.NPC ? A.listas.NPC.size : 0) + (A.listas && A.listas.Vehicles ? A.listas.Vehicles.size : 0) + (typeof gmPropsMenu === 'function' ? gmPropsMenu(A).length : 0) + pms.length;
  let h = mapas.map(([k, m]) => `<button class="rbBtnG rbFichaGrande" data-rb="jugarGm:${esc(k)}">${glifo('jugar')} ${esc(T('gm.jugar'))}${mapas.length > 1 ? ' · ' + esc(m.nombre) : ''}</button>`).join('');
  if (cosas) h += `<button class="rbBtnG${mapas.length ? '' : ' rbFichaGrande'}" data-rb="probarGm:${esc(A.id)}">${glifo('jugar')} ${esc(T('gm.probar'))}</button>`;
  h += pms.map((r) => `<button class="rbBtnGris" data-rb="pmGm:${esc(r)}">${glifo('persona')} ${esc(T('gm.ponerme'))}${pms.length > 1 ? ' · ' + esc(gmNombre('gm:' + r)) : ''}</button>`).join('');
  return h;
}
function gmTiendaDibujar() {
  const S = RB.t, G = RB.el && RB.el.querySelector('.rbTiendaG'); if (!G || S.tab !== 'gmod') return;
  const img = (it) => (it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<img src="${GM_ICO}" alt="">`);
  const it = S.ficha && S.items.find((x) => x.id === S.ficha);
  G.classList.toggle('rbFichaModo', !!it);
  for (const s of ['.rbBarra', '.rbEtqs']) { const e = RB.el.querySelector(s); if (e) e.classList.toggle('oc', !!it); }
  if (it) {
    if (!it.detVivo && (!it.d || !it.subs) && /^\d+$/.test(it.id)) gmFichaVivo(it);
    const ins = gmInstalado(it.id), A = GMOD.addons.get(String(it.id)), pr = gmcDe(it.id), off = ins && !gmHabilitado(it.id);
    const cont = A ? [`${A.props.length} ${T('gm.modelos')}`, A.sweps && A.sweps.length ? `${A.sweps.length} ${T('gm.t.Weapon')}` : '', A.sents && A.sents.length ? `${A.sents.length} ${T('gm.t.Entity')}` : '', A.lua.length ? `${A.lua.length} ${T('gm.lua')}` : '', A.luaErr && A.luaErr.length ? `${A.luaErr.length} ${T('gm.errLua')}` : ''].filter(Boolean).join(' · ') : '';
    const acc = pr ? `<div class="gmProg"><i style="width:${Math.round(pr.p * 100)}%"></i><span>${esc(T(pr.estado === 'espera' ? 'gmc.espera' : pr.fase === 'descomprimiendo' ? 'gm.descomp' : 'gm.bajando'))}${pr.estado === 'espera' ? '' : ' ' + Math.round(pr.p * 100) + '%'}</span></div><button class="rbBtnGris" data-rb="cancelarGm:${esc(it.id)}">${esc(T('cancelar'))}</button>`
      : ins ? gmFichaAbrir(A) + `<button class="rbBtnGris" data-rb="quitar:${esc(it.id)}">${glifo('basura')} ${esc(T('quitar'))}</button>`
      : it.sinPipe ? `<label class="rbBtnG rbFichaGrande">${glifo('subir')} ${esc(T('gm.importar'))}<input type="file" class="gmImpFicha" accept=".gma,.bin" hidden></label>`
      : `<button class="rbBtnG rbFichaGrande" data-rb="instalar:${esc(it.id)}">${glifo('bajar')} ${esc(T('instalar'))}${it.mb ? ` <small>${it.mb} MB</small>` : ''}</button>`;
    G.innerHTML = `<div class="rbFicha${ins && !off ? ' on' : ''}${off ? ' off' : ''}"><button class="rbBtnGris rbChico rbFichaX" data-rb="fichaNo">${glifo('atras')} ${esc(T('volver'))}</button>
      <div class="rbFichaCuerpo"><div class="rbFichaIco">${img(it)}</div>
        <div class="rbFichaInfo"><h3 dir="auto">${esc(it.t)}</h3><small>${[it.subs ? `${glifo('gente')} ${gmCifra(it.subs)} ${esc(T('gm.subs'))}` : '', it.fav ? `${glifo('corazon')} ${gmCifra(it.fav)}` : '', it.mb ? it.mb + ' MB' : '', it.autor ? esc(T('por')) + ' ' + esc(it.autor) : ''].filter(Boolean).join(' · ')}</small>
          <span class="rbEtqsC">${(it.tags || []).filter((t) => t !== 'Addon').map((e) => `<i>${esc(T('gm.t.' + e) !== 'gm.t.' + e ? T('gm.t.' + e) : e)}</i>`).join('')}</span>
          ${off ? `<p class="gmAviso rbOffAyuda">${glifo('prohibido')} ${esc(T('hab.offGm'))}</p>` : ''}${gmNoCompat(it) ? `<p class="gmAviso">${esc(T('gm.noCompat'))}</p>` : ''}${it.sinPipe && !ins ? `<p class="gmAviso">${esc(T('gm.sinArchivo'))}</p>` : ''}
          ${cont ? `<p class="gmCont"><b>${esc(T('gm.contenido'))}:</b> ${esc(cont)}</p>` : ''}${A && A.faltanModelos && A.faltanModelos.length ? `<p class="gmAviso">${esc(T('gm.otroAddon').replace('{n}', A.faltanModelos.length))}: ${esc(A.faltanModelos.slice(0, 3).map((m) => m.replace(/^.*\//, '')).join(', '))}${A.faltanModelos.length > 3 ? '…' : ''}</p>` : ''}
          <p dir="auto">${esc(it.d || '')}</p>
          <div class="rbFichaAcc">${acc}${/^\d+$/.test(it.id) ? `<a class="rbBtnGris" href="https://steamcommunity.com/sharedfiles/filedetails/?id=${it.id}" target="_blank" rel="noopener">${esc(T('gm.steam'))}</a>` : ''}</div></div></div></div>`;
    const fi = G.querySelector('.gmImpFicha'); if (fi) fi.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) gmTiendaImportar(f, it); });
  } else {
    if (S.sel) return gmSelDibujar(G, img);
    const tile = (x) => `<button class="rbTile${gmInstalado(x.id) ? ' inst' : ''}${gmInstalado(x.id) && !gmHabilitado(x.id) ? ' off' : ''}" data-rb="ver:${esc(x.id)}"><span class="rbTileIco">${img(x)}</span><b dir="auto">${esc(x.t)}</b><small class="gmTileD">${x.subs ? `${glifo('gente')} ${gmCifra(x.subs)}` : esc(x.autor || '')}${x.dir ? ` · ${glifo('bajar')}` : x.dir === false ? ' · .gma' : ''}</small>${gmInstalado(x.id) ? (gmHabilitado(x.id) ? '<i class="rbTileOk"></i>' : '<i class="rbTileOff"></i>') : gmcDe(x.id) ? `<i class="rbTileBaja" style="width:${Math.round(gmcDe(x.id).p * 100)}%"></i>` : ''}</button>`;
    const fin = S.cargando ? `<div class="rbVacio">${esc(T('cargando'))}</div>` : S.error ? `<div class="rbVacio">${esc(T('gm.puente'))}</div>` : !S.items.length ? `<div class="rbVacio">${esc(T(S.gmDir && S.vista === 'explorar' && S.vistosGM ? 'gm.ningunoDir' : 'sinRes'))}</div>` : '';
    G.innerHTML = S.items.map(tile).join('') + fin;
  }
  const tot = RB.el.querySelector('.rbTotal'); if (tot) tot.textContent = S.total && !it ? `${S.items.length} / ${gmCifra(S.total)}` : '';
  const mas = RB.el.querySelector('[data-rb=mas]'); if (mas) mas.style.display = !it && S.vista === 'explorar' && !S.finGM && S.items.length < S.total && !S.cargando ? '' : 'none';   // (sin ocupar lugar: en un celular chico el pie entra en un renglón)
  const hab = RB.el.querySelector('.rbHab'); if (hab) hab.innerHTML = habBotones(it ? (PREFS.gmod && PREFS.gmod[it.id] ? it.id : null) : undefined, Object.keys(PREFS.gmod || {}), gmHabilitado, 'Gm', S.habVa);
  gmSelModo(false);
  // (en Instalados, «Borrar varios»: en una pantalla chica, sólo el tacho)
  const sp = RB.el.querySelector('.gmSelPie'); if (sp) sp.innerHTML = !it && S.vista === 'instalados' && !S.habVa && S.items.length > 1 ? `<button class="rbBtnGris gmSelBtn" data-rb="selGm" title="${esc(T('sel.boton'))}" aria-label="${esc(T('sel.boton'))}">${glifo('basura')}<span>${esc(T('sel.boton'))}</span></button>` : '';
}
// (eligiendo: sin «Empezar partida nueva» ni el total, para que el pie entre en un renglón)
// (en Instalados, en una pantalla chica, sin el total —«2 / 2»—: el pie con «Borrar varios» entra en un renglón)
function gmSelModo(on) { const P = RB.el && RB.el.querySelector('.rbPan'); if (P) { P.classList.toggle('gmSelModo', !!on); P.classList.toggle('gmInst', RB.t.vista === 'instalados'); } }
// ---------------- borrar varios a la vez ----------------
// Discord: «poder borrar varios mods a la vez; los chicos hasta unos 20, los medianos 10 y los grandes 3 a 5». En
// Instalados, «Borrar varios» deja marcar varios; cada uno ocupa del cupo según lo que pesa (chico ≤ 15 MB: 1, mediano
// ≤ 100 MB: 2, grande: 5) y por vez entran 20: 20 chicos, 10 medianos, 4 grandes o mezclados. Así un celular flojo no se
// traba sacando de golpe cientos de MB de la caché. Se borran de a uno, con el avance en el botón.
const GM_SEL_CUPO = 20;
const gmSelClase = (mb) => (!(mb > 0) || mb <= 15 ? 'chico' : mb <= 100 ? 'mediano' : 'grande');
const gmSelPuntos = (mb) => ({ chico: 1, mediano: 2, grande: 5 })[gmSelClase(mb)];
// lo que pesa uno instalado (MB): lo guardado en la caché (anotado al instalar), si no el del Workshop; si no se sabe, se
// cuenta como mediano (null)
function gmSelMB(id) {
  const P = (PREFS.gmod && PREFS.gmod[id]) || {}, A = GMOD.addons.get(String(id)), bl = A && A.G && A.G.blob;
  if (P.mbG != null) return P.mbG; if (bl && bl.size) return bl.size / 1048576; if (P.mb > 0) return P.mb;
  const c = RB.t.cat && RB.t.cat.porId.get(String(id)); return c && c.mb > 0 ? c.mb : null;
}
const gmSelPts = (id) => { const mb = gmSelMB(id); return mb === null ? 2 : gmSelPuntos(mb); };
// (el tamaño escrito: los de menos de 1 MB en KB; si no se sabe, «?»)
const gmTamTxt = (mb) => (mb === null ? '? MB' : mb < 1 ? Math.max(1, Math.round(mb * 1024)) + ' KB' : (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + ' MB');
function gmSelUsado() { let p = 0, mb = 0; for (const id of RB.t.sel.ids) { p += gmSelPts(id); mb += gmSelMB(id) || 0; } return { p, mb }; }
function gmSelDibujar(G, img) {
  const S = RB.t, u = gmSelUsado();
  const tile = (x) => { const on = S.sel.ids.has(x.id), mb = gmSelMB(x.id), no = !on && u.p + gmSelPts(x.id) > GM_SEL_CUPO;
    return `<button class="rbTile gmSelT${on ? ' sel' : ''}${no ? ' bloq' : ''}" data-rb="ver:${esc(x.id)}"><span class="rbTileIco">${img(x)}</span><b dir="auto">${esc(x.t)}</b><small class="gmTileD gmSel_${mb === null ? 'mediano' : gmSelClase(mb)}">${gmTamTxt(mb)}</small><i class="gmSelMarca"></i></button>`; };
  G.innerHTML = `<p class="gmSelRegla">${esc(T('sel.regla'))}</p>` + (S.items.map(tile).join('') || `<div class="rbVacio">${esc(T('sinRes'))}</div>`);
  const tot = RB.el.querySelector('.rbTotal'); if (tot) tot.textContent = '';
  const mas = RB.el.querySelector('[data-rb=mas]'); if (mas) mas.style.display = 'none';
  const hab = RB.el.querySelector('.rbHab'), sp = RB.el.querySelector('.gmSelPie'); if (!hab || !sp) return;
  gmSelModo(true); hab.innerHTML = '';
  const n = S.sel.ids.size, va = S.sel.va;
  sp.innerHTML = va ? `<button class="rbBtnGris" disabled>${esc(T('sel.borrando').replace('{i}', Math.min(va.i + 1, va.n)).replace('{n}', va.n))}</button>`
    : `<button class="rbBtnGris" data-rb="selNo">${esc(T('cancelar'))}</button><span class="gmSelInfo">${esc(T('sel.info').replace('{n}', n).replace('{mb}', u.mb < 1 && u.mb > 0 ? '<1' : Math.round(u.mb)).replace('{p}', u.p))}</span>`
      + `<button class="rbBtnGris gmSelBorrar" data-rb="selBorrar"${n ? '' : ' disabled'}>${glifo('basura')} ${esc(T('sel.borrar').replace('{n}', n))}</button>`;
}
function gmSelTocar(id) {
  const S = RB.t, L = S.sel.ids; if (S.sel.va) return;
  if (L.has(id)) L.delete(id);
  else if (gmSelUsado().p + gmSelPts(id) > GM_SEL_CUPO) { menuAviso(T('sel.regla')); return; }
  else L.add(id);
  gmTiendaDibujar();
}
function gmSelPreguntar() {
  const S = RB.t, ids = [...S.sel.ids]; if (!ids.length || S.sel.va) return;
  const u = gmSelUsado(), nom = (id) => (PREFS.gmod && PREFS.gmod[id] && PREFS.gmod[id].n) || ((S.items.find((x) => x.id === id) || {}).t) || id;
  const filas = ids.map((id) => `<b dir="auto">${esc(nom(id))}</b> <small>${gmTamTxt(gmSelMB(id))}</small>`);
  const ok = () => gmSelBorrar(ids, u.mb);
  if (typeof confirmarLista === 'function') { confirmarLista(T('sel.tit').replace('{n}', ids.length) + ' · ' + gmTamTxt(u.mb), filas, T('sel.borrar').replace('{n}', ids.length), ok); const si = document.querySelector('#cfDlg [data-cf=si]'); if (si) si.classList.add('rojo'); }
  else if (confirm(T('sel.tit').replace('{n}', ids.length))) ok();
}
async function gmSelBorrar(ids, mb) {
  const S = RB.t; S.sel.va = { i: 0, n: ids.length }; gmTiendaDibujar();
  for (let i = 0; i < ids.length; i++) {
    S.sel.va = { i, n: ids.length }; gmTiendaDibujar();
    const id = String(ids[i]);
    try { gmDesmontar(id); } catch (e) { gmErr('desmontar ' + id, e); }
    if (PREFS.gmod) delete PREFS.gmod[id];
    await gmCacheBorrar(id);
    await new Promise((r) => setTimeout(r, 0));   // (que el panel se vea avanzar)
  }
  guardarPrefs(); if (typeof gmMenu === 'function') try { gmMenu(); } catch (e) {}
  S.sel = null; menuAviso(T('sel.listo').replace('{n}', ids.length).replace('{mb}', mb < 1 ? '<1' : Math.round(mb)));
  if (S.tab === 'gmod') gmTiendaCargar(true);
}
// Habilitar / Deshabilitar (Discord: «opciones para habilitar/deshabilitar, deshabilitar todos/habilitar todos los mods»),
// en el pie del panel como en el dibujo que mandaron. En la ficha de un mod, sólo el de ese mod (el que corresponde); en la
// lista, «Deshabilitar todo» y «Habilitar todo» (el que no tiene a cuál aplicarse queda gris). Lo usa también la pestaña Mods.
// id: el de la ficha (null: ficha de algo no instalado; undefined: la lista); ids: los instalados; on(id): si está habilitado
function habBotones(id, ids, on, suf, va) {
  if (va) return `<button class="rbBtnGris" disabled>${esc(T(va.on ? 'hab.vaSi' : 'hab.vaNo').replace('{i}', Math.min(va.i + 1, va.n)).replace('{n}', va.n))}</button>`;
  const no = (d, k, a) => `<button class="rbBtnGris rbHabNo" data-rb="${a}"${d ? ' disabled' : ''}>${glifo('prohibido')} ${esc(T(k))}</button>`;
  const si = (d, k, a) => `<button class="rbBtnGris rbHabSi" data-rb="${a}"${d ? ' disabled' : ''}>${glifo('si')} ${esc(T(k))}</button>`;
  if (id === null) return '';
  if (id !== undefined) return on(id) ? no(false, 'hab.no', `des${suf}:${id}`) : si(false, 'hab.si', `hab${suf}:${id}`);
  if (!ids.length) return '';
  const nOn = ids.filter(on).length;
  return no(!nOn, 'hab.todoNo', `desTodo${suf}`) + si(nOn === ids.length, 'hab.todoSi', `habTodo${suf}`);
}
async function gmTiendaHab(ids, on) {
  const S = RB.t; if (S.habVa) return;
  const todos = ids === null, L = todos ? Object.keys(PREFS.gmod || {}).filter((w) => gmHabilitado(w) !== on) : [ids];
  S.habVa = { i: 0, n: L.length, on }; gmTiendaDibujar();
  try { for (let i = 0; i < L.length; i++) { S.habVa = { i, n: L.length, on }; gmTiendaDibujar(); await gmHabilitar(L[i], on); } }
  finally { S.habVa = null; }
  const nom = !todos && ((S.items.find((x) => x.id === ids) || {}).t || (PREFS.gmod[ids] || {}).n || ids);
  menuAviso(todos ? T(on ? 'hab.okSi' : 'hab.okNo').replace('{n}', L.length) : `${nom}: ${T(on ? 'hab.on' : 'hab.off')}`);
  gmTiendaDibujar();
}
// (a la cola de descargas: se pueden poner varios, cerrar la tienda y jugar mientras bajan; ver gmod_cola.js)
async function gmTiendaInstalar(id) {
  const S = RB.t, it = S.items.find((x) => x.id === id); if (gmcDe(id)) return;
  const pr = gmcPoner(id, it ? { nombre: it.t, img: it.img } : null); gmTiendaDibujar();
  try {
    await pr;
    if (it && PREFS.gmod && PREFS.gmod[id]) { Object.assign(PREFS.gmod[id], { tags: it.tags, subs: it.subs, mb: it.mb, d: it.d.slice(0, 200) }); guardarPrefs(); }
  } catch (e) { if (e && e.sinArchivo && it) it.sinPipe = true; }
  gmTiendaDibujar();
}
async function gmTiendaImportar(f, it) {
  try { const A = await gmImportarArchivo(f); menuAviso(T('instalado') + ': ' + A.nombre); if (it && PREFS.gmod && PREFS.gmod[A.id]) { PREFS.gmod[A.id].img = it.img; guardarPrefs(); } }
  catch (e) { menuAviso(T('errFormato') + ': ' + String((e && e.message) || e)); }
  if (RB.t.tab === 'gmod') { if (RB.t.vista === 'instalados') gmTiendaCargar(true); else gmTiendaDibujar(); }
}
// las acciones de la pestaña (las demás las maneja inicio.js como siempre)
function gmTiendaAccion(a, v) {
  const S = RB.t; if (S.tab !== 'gmod') return false;
  switch (a) {
    case 'vista': S.vista = v; S.ficha = null; S.sel = null; inicioPanel('tienda'); return true;
    case 'etq': S.etq = v; S.ficha = null; inicioPanel('tienda'); return true;
    case 'ver': if (S.sel) { gmSelTocar(v); return true; } S.ficha = v; gmTiendaDibujar(); return true;
    case 'selGm': S.sel = { ids: new Set(), va: null }; S.ficha = null; gmCatalogo().then((C) => { S.cat = C; if (S.sel) gmTiendaDibujar(); }); gmTiendaDibujar(); return true;
    case 'selNo': if (S.sel && !S.sel.va) S.sel = null; gmTiendaDibujar(); return true;
    case 'selBorrar': gmSelPreguntar(); return true;
    case 'fichaNo': S.ficha = null; gmTiendaDibujar(); return true;
    case 'gmdir': S.gmDir = !S.gmDir; S.ficha = null; inicioPanel('tienda'); return true;
    case 'mas': S.p++; gmTiendaCargar(false); return true;
    case 'instalar': gmTiendaInstalar(v); return true;
    case 'cancelarGm': gmcCancelar(v); gmTiendaDibujar(); return true;
    case 'jugarGm': { if (typeof GBSP === 'undefined' || !GBSP.mapas.has(v)) return true; RB.desdeJuego = false; SALA = null; RB.mapa = v; RB.mapaCom = null; RB.mapaPartida = null; if (typeof CREA !== 'undefined') CREA.on = false;
      entrarConCarga(mapaNom(v), v, () => { inicioMostrar(false); return empezarPartida(v); }); return true; }
    case 'probarGm': {
      const abrir = () => setTimeout(() => { if (typeof gmbAbrir === 'function') gmbAbrir(v); }, 600);
      if (JUEGO.estado === 'juego') { RB.desdeJuego = false; inicioMostrar(false); abrir(); return true; }
      const m = RB.mapa || PREFS.mapa || 'FlatGrass'; SALA = null;
      entrarConCarga(T('ld.solo'), m, () => { inicioMostrar(false); const r = empezarPartida(m); Promise.resolve(r).then(abrir); return r; }); return true;
    }
    case 'pmGm': PREFS.skin = 'gmpm:' + v; guardarPrefs(); if (JUEGO.estado === 'juego' && JUG.vivo && typeof jugadorCuerpoNuevo === 'function') jugadorCuerpoNuevo(); if (typeof redSkin === 'function') redSkin(); menuAviso(T('gm.pm.puesto').replace('{m}', propNom('gmpm:' + v))); return true;
    case 'habGm': case 'desGm': gmTiendaHab(v, a === 'habGm'); return true;
    case 'habTodoGm': case 'desTodoGm': gmTiendaHab(null, a === 'habTodoGm'); return true;
    case 'quitar': gmQuitar(v); menuAviso(T('quitar') + ': ' + ((S.items.find((x) => x.id === v) || {}).t || v)); if (S.vista === 'instalados') { S.ficha = null; gmTiendaCargar(true); } else gmTiendaDibujar(); return true;
  }
  return false;
}

// ---------------- textos (es, en, pt, id, ms, fil, ja, th, tr, ar, ru, uk, fr, de) ----------------
Object.assign(IDI3, {
  // (borrar varios a la vez)
  'sel.boton': ['Borrar varios', 'Delete several', 'Apagar vários', 'Hapus beberapa', 'Padam beberapa', 'Burahin ang ilan', '複数削除', 'ลบหลายรายการ', 'Birkaçını sil', 'حذف عدة', 'Удалить несколько', 'Видалити кілька', 'Supprimer plusieurs', 'Mehrere löschen'],
  'sel.borrar': ['Borrar ({n})', 'Delete ({n})', 'Apagar ({n})', 'Hapus ({n})', 'Padam ({n})', 'Burahin ({n})', '削除 ({n})', 'ลบ ({n})', 'Sil ({n})', 'حذف ({n})', 'Удалить ({n})', 'Видалити ({n})', 'Supprimer ({n})', 'Löschen ({n})'],
  'sel.regla': ['Por vez: hasta 20 chicos, 10 medianos o 4 grandes', 'At once: up to 20 small, 10 medium or 4 large', 'Por vez: até 20 pequenos, 10 médios ou 4 grandes', 'Sekaligus: hingga 20 kecil, 10 sedang, atau 4 besar', 'Sekali gus: sehingga 20 kecil, 10 sederhana atau 4 besar', 'Sabay-sabay: hanggang 20 maliit, 10 katamtaman o 4 malaki', '一度に：小20個、中10個、大4個まで', 'ต่อครั้ง: เล็กได้ 20 กลาง 10 หรือใหญ่ 4', 'Tek seferde: en fazla 20 küçük, 10 orta veya 4 büyük', 'في المرة الواحدة: حتى 20 صغيرًا أو 10 متوسطة أو 4 كبيرة', 'За раз: до 20 маленьких, 10 средних или 4 больших', 'За раз: до 20 малих, 10 середніх або 4 великих', 'À la fois : jusqu’à 20 petits, 10 moyens ou 4 gros', 'Auf einmal: bis zu 20 kleine, 10 mittlere oder 4 große'],
  'sel.info': ['{n} elegidos · {mb} MB · cupo {p}/20', '{n} selected · {mb} MB · {p}/20 used', '{n} selecionados · {mb} MB · cota {p}/20', '{n} dipilih · {mb} MB · kuota {p}/20', '{n} dipilih · {mb} MB · kuota {p}/20', '{n} napili · {mb} MB · {p}/20', '{n}個選択 · {mb} MB · 枠 {p}/20', 'เลือก {n} · {mb} MB · โควตา {p}/20', '{n} seçili · {mb} MB · kota {p}/20', '{n} محدد · {mb} م.ب · الحصة {p}/20', 'Выбрано: {n} · {mb} МБ · лимит {p}/20', 'Вибрано: {n} · {mb} МБ · ліміт {p}/20', '{n} sélectionnés · {mb} Mo · quota {p}/20', '{n} ausgewählt · {mb} MB · Kontingent {p}/20'],
  'sel.tit': ['Borrar {n} mods', 'Delete {n} mods', 'Apagar {n} mods', 'Hapus {n} mod', 'Padam {n} mod', 'Burahin ang {n} mod', '{n}個のMODを削除', 'ลบ {n} ม็อด', '{n} modu sil', 'حذف {n} مودات', 'Удалить модов: {n}', 'Видалити модів: {n}', 'Supprimer {n} mods', '{n} Mods löschen'],
  'sel.borrando': ['Borrando {i}/{n}…', 'Deleting {i}/{n}…', 'Apagando {i}/{n}…', 'Menghapus {i}/{n}…', 'Memadam {i}/{n}…', 'Binubura {i}/{n}…', '削除中 {i}/{n}…', 'กำลังลบ {i}/{n}…', 'Siliniyor {i}/{n}…', 'جارٍ الحذف {i}/{n}…', 'Удаление {i}/{n}…', 'Видалення {i}/{n}…', 'Suppression {i}/{n}…', 'Lösche {i}/{n}…'],
  'sel.listo': ['Borrados: {n} ({mb} MB)', 'Deleted: {n} ({mb} MB)', 'Apagados: {n} ({mb} MB)', 'Dihapus: {n} ({mb} MB)', 'Dipadam: {n} ({mb} MB)', 'Nabura: {n} ({mb} MB)', '削除済み: {n} ({mb} MB)', 'ลบแล้ว: {n} ({mb} MB)', 'Silindi: {n} ({mb} MB)', 'تم الحذف: {n} ({mb} م.ب)', 'Удалено: {n} ({mb} МБ)', 'Видалено: {n} ({mb} МБ)', 'Supprimés : {n} ({mb} Mo)', 'Gelöscht: {n} ({mb} MB)'],
  // (habilitar / deshabilitar mods: es, en, pt, id, ms, fil, ja, th, tr, ar, ru, uk, fr, de)
  'hab.si': ['Habilitar', 'Enable', 'Habilitar', 'Aktifkan', 'Dayakan', 'I-enable', '有効にする', 'เปิดใช้', 'Etkinleştir', 'تفعيل', 'Включить', 'Увімкнути', 'Activer', 'Aktivieren'],
  'hab.no': ['Deshabilitar', 'Disable', 'Desabilitar', 'Nonaktifkan', 'Nyahdayakan', 'I-disable', '無効にする', 'ปิดใช้', 'Devre dışı bırak', 'تعطيل', 'Отключить', 'Вимкнути', 'Désactiver', 'Deaktivieren'],
  'hab.todoSi': ['Habilitar todo', 'Enable all', 'Habilitar tudo', 'Aktifkan semua', 'Dayakan semua', 'I-enable lahat', 'すべて有効', 'เปิดใช้ทั้งหมด', 'Tümünü etkinleştir', 'تفعيل الكل', 'Включить все', 'Увімкнути все', 'Tout activer', 'Alle aktivieren'],
  'hab.todoNo': ['Deshabilitar todo', 'Disable all', 'Desabilitar tudo', 'Nonaktifkan semua', 'Nyahdayakan semua', 'I-disable lahat', 'すべて無効', 'ปิดใช้ทั้งหมด', 'Tümünü devre dışı bırak', 'تعطيل الكل', 'Отключить все', 'Вимкнути все', 'Tout désactiver', 'Alle deaktivieren'],
  'hab.on': ['habilitado', 'enabled', 'habilitado', 'aktif', 'didayakan', 'naka-enable', '有効', 'เปิดใช้แล้ว', 'etkin', 'مفعّل', 'включён', 'увімкнено', 'activé', 'aktiviert'],
  'hab.off': ['deshabilitado', 'disabled', 'desabilitado', 'nonaktif', 'dinyahdayakan', 'naka-disable', '無効', 'ปิดใช้แล้ว', 'devre dışı', 'معطّل', 'отключён', 'вимкнено', 'désactivé', 'deaktiviert'],
  'hab.okSi': ['Mods habilitados: {n}', 'Mods enabled: {n}', 'Mods habilitados: {n}', 'Mod diaktifkan: {n}', 'Mod didayakan: {n}', 'Na-enable na mod: {n}', '有効にしたMOD：{n}', 'เปิดใช้ม็อดแล้ว: {n}', 'Etkinleştirilen mod: {n}', 'المودات المفعّلة: {n}', 'Включено модов: {n}', 'Увімкнено модів: {n}', 'Mods activés : {n}', 'Aktivierte Mods: {n}'],
  'hab.okNo': ['Mods deshabilitados: {n}', 'Mods disabled: {n}', 'Mods desabilitados: {n}', 'Mod dinonaktifkan: {n}', 'Mod dinyahdayakan: {n}', 'Na-disable na mod: {n}', '無効にしたMOD：{n}', 'ปิดใช้ม็อดแล้ว: {n}', 'Devre dışı bırakılan mod: {n}', 'المودات المعطّلة: {n}', 'Отключено модов: {n}', 'Вимкнено модів: {n}', 'Mods désactivés : {n}', 'Deaktivierte Mods: {n}'],
  'hab.vaSi': ['Habilitando {i}/{n}…', 'Enabling {i}/{n}…', 'Habilitando {i}/{n}…', 'Mengaktifkan {i}/{n}…', 'Mendayakan {i}/{n}…', 'Ine-enable {i}/{n}…', '有効化中 {i}/{n}…', 'กำลังเปิดใช้ {i}/{n}…', 'Etkinleştiriliyor {i}/{n}…', 'جارٍ التفعيل {i}/{n}…', 'Включение {i}/{n}…', 'Увімкнення {i}/{n}…', 'Activation {i}/{n}…', 'Aktiviere {i}/{n}…'],
  'hab.vaNo': ['Deshabilitando {i}/{n}…', 'Disabling {i}/{n}…', 'Desabilitando {i}/{n}…', 'Menonaktifkan {i}/{n}…', 'Menyahdayakan {i}/{n}…', 'Dine-disable {i}/{n}…', '無効化中 {i}/{n}…', 'กำลังปิดใช้ {i}/{n}…', 'Devre dışı bırakılıyor {i}/{n}…', 'جارٍ التعطيل {i}/{n}…', 'Отключение {i}/{n}…', 'Вимкнення {i}/{n}…', 'Désactivation {i}/{n}…', 'Deaktiviere {i}/{n}…'],
  'hab.offGm': ['Deshabilitado: sigue instalado, pero no se carga (ni su Lua, ni sus armas, entidades, modelos o mapas).', 'Disabled: still installed, but not loaded (no Lua, weapons, entities, models or maps).', 'Desabilitado: continua instalado, mas não é carregado (nem Lua, armas, entidades, modelos ou mapas).', 'Nonaktif: tetap terpasang, tapi tidak dimuat (tanpa Lua, senjata, entitas, model, atau peta).', 'Dinyahdayakan: masih dipasang, tetapi tidak dimuatkan (tiada Lua, senjata, entiti, model atau peta).', 'Naka-disable: naka-install pa rin, pero hindi nilo-load (walang Lua, armas, entity, model o mapa).', '無効：インストールされたままですが、読み込まれません（Lua、武器、エンティティ、モデル、マップなし）。', 'ปิดใช้: ยังติดตั้งอยู่ แต่ไม่ถูกโหลด (ไม่มี Lua อาวุธ เอนทิตี โมเดล หรือแผนที่)', 'Devre dışı: yüklü kalır ama yüklenmez (Lua, silah, varlık, model veya harita yok).', 'معطّل: لا يزال مثبتًا لكنه لا يُحمَّل (بلا Lua أو أسلحة أو كيانات أو نماذج أو خرائط).', 'Отключён: остаётся установленным, но не загружается (без Lua, оружия, сущностей, моделей и карт).', 'Вимкнено: лишається встановленим, але не завантажується (без Lua, зброї, сутностей, моделей і мап).', 'Désactivé : toujours installé, mais pas chargé (ni Lua, ni armes, entités, modèles ou cartes).', 'Deaktiviert: bleibt installiert, wird aber nicht geladen (kein Lua, keine Waffen, Entities, Modelle oder Karten).'],
  'hab.offMod': ['Deshabilitado: sigue instalado, pero no se usa en la partida.', 'Disabled: still installed, but not used in the game.', 'Desabilitado: continua instalado, mas não é usado na partida.', 'Nonaktif: tetap terpasang, tapi tidak dipakai dalam permainan.', 'Dinyahdayakan: masih dipasang, tetapi tidak digunakan dalam permainan.', 'Naka-disable: naka-install pa rin, pero hindi ginagamit sa laro.', '無効：インストールされたままですが、ゲームでは使われません。', 'ปิดใช้: ยังติดตั้งอยู่ แต่ไม่ถูกใช้ในเกม', 'Devre dışı: yüklü kalır ama oyunda kullanılmaz.', 'معطّل: لا يزال مثبتًا لكنه لا يُستخدم في اللعب.', 'Отключён: остаётся установленным, но не используется в игре.', 'Вимкнено: лишається встановленим, але не використовується в грі.', 'Désactivé : toujours installé, mais pas utilisé en jeu.', 'Deaktiviert: bleibt installiert, wird im Spiel aber nicht verwendet.'],
  't.gmod': ['GMod', 'GMod', 'GMod', 'GMod', 'GMod', 'GMod', 'GMod', 'GMod', 'GMod', 'GMod', 'GMod', 'GMod', 'GMod', 'GMod'],
  'gm.tit': ["Addons de Garry's Mod del Workshop", "Garry's Mod addons from the Workshop", "Addons do Garry's Mod da Oficina", "Addon Garry's Mod dari Workshop", "Addon Garry's Mod dari Workshop", "Mga addon ng Garry's Mod mula sa Workshop", "ワークショップのGarry's Modアドオン", "แอดออน Garry's Mod จาก Workshop", "Atölyeden Garry's Mod eklentileri", "إضافات Garry's Mod من الورشة", "Аддоны Garry's Mod из Мастерской", "Аддони Garry's Mod з Майстерні", "Addons Garry's Mod du Workshop", "Garry's-Mod-Addons aus dem Workshop"],
  'gm.o.pop': ['Tendencia', 'Trending', 'Em alta', 'Sedang tren', 'Sohor kini', 'Trending', '人気急上昇', 'มาแรง', 'Trend', 'الرائج', 'В тренде', 'У тренді', 'Tendances', 'Im Trend'],
  'gm.o.subs': ['Más suscritos', 'Most subscribed', 'Mais inscritos', 'Paling banyak dilanggan', 'Paling ramai pelanggan', 'Pinakamaraming subscriber', '購読数順', 'ผู้ติดตามมากสุด', 'En çok abone', 'الأكثر اشتراكًا', 'Больше подписок', 'Найбільше підписок', "Plus d'abonnés", 'Meiste Abos'],
  'gm.o.votos': ['Mejor votados', 'Top rated', 'Mais bem avaliados', 'Nilai tertinggi', 'Penilaian tertinggi', 'Pinakamataas ang rating', '高評価', 'คะแนนสูงสุด', 'En yüksek puan', 'الأعلى تقييمًا', 'Лучшие оценки', 'Найкращі оцінки', 'Mieux notés', 'Bestbewertet'],
  'gm.o.nuevo': ['Nuevos', 'Newest', 'Novos', 'Terbaru', 'Terbaharu', 'Pinakabago', '新着', 'ใหม่ล่าสุด', 'En yeni', 'الأحدث', 'Новые', 'Нові', 'Nouveaux', 'Neueste'],
  'gm.o.act': ['Actualizados', 'Recently updated', 'Atualizados', 'Baru diperbarui', 'Baru dikemas kini', 'Bagong update', '最近更新', 'อัปเดตล่าสุด', 'Yeni güncellenen', 'المحدّثة مؤخرًا', 'Обновлённые', 'Оновлені', 'Mis à jour', 'Aktualisiert'],
  'gm.t.Weapon': ['Armas', 'Weapons', 'Armas', 'Senjata', 'Senjata', 'Armas', '武器', 'อาวุธ', 'Silahlar', 'أسلحة', 'Оружие', 'Зброя', 'Armes', 'Waffen'],
  'gm.t.Entity': ['Entidades', 'Entities', 'Entidades', 'Entitas', 'Entiti', 'Mga entity', 'エンティティ', 'เอนทิตี', 'Varlıklar', 'كيانات', 'Сущности', 'Сутності', 'Entités', 'Entities'],
  'gm.t.NPC': ['NPC', 'NPCs', 'NPCs', 'NPC', 'NPC', 'Mga NPC', 'NPC', 'NPC', "NPC'ler", 'شخصيات NPC', 'NPC', 'NPC', 'PNJ', 'NPCs'],
  'gm.t.Vehicle': ['Vehículos', 'Vehicles', 'Veículos', 'Kendaraan', 'Kenderaan', 'Mga sasakyan', '乗り物', 'ยานพาหนะ', 'Taşıtlar', 'مركبات', 'Транспорт', 'Транспорт', 'Véhicules', 'Fahrzeuge'],
  'gm.t.Tool': ['Herramientas', 'Tools', 'Ferramentas', 'Alat', 'Alat', 'Mga tool', 'ツール', 'เครื่องมือ', 'Aletler', 'أدوات', 'Инструменты', 'Інструменти', 'Outils', 'Werkzeuge'],
  'gm.t.Model': ['Modelos', 'Models', 'Modelos', 'Model', 'Model', 'Mga model', 'モデル', 'โมเดล', 'Modeller', 'نماذج', 'Модели', 'Моделі', 'Modèles', 'Modelle'],
  'gm.t.Effects': ['Efectos', 'Effects', 'Efeitos', 'Efek', 'Kesan', 'Mga effect', 'エフェクト', 'เอฟเฟกต์', 'Efektler', 'مؤثرات', 'Эффекты', 'Ефекти', 'Effets', 'Effekte'],
  'gm.t.Fun': ['Diversión', 'Fun', 'Diversão', 'Seru', 'Seronok', 'Katuwaan', 'おもしろ', 'สนุก', 'Eğlence', 'مرح', 'Веселье', 'Розваги', 'Fun', 'Spaß'],
  'gm.t.Roleplay': ['Rol', 'Roleplay', 'RP', 'Roleplay', 'Main peranan', 'Roleplay', 'ロールプレイ', 'โรลเพลย์', 'Rol yapma', 'لعب أدوار', 'Ролевые', 'Рольові', 'Jeu de rôle', 'Rollenspiel'],
  'gm.t.Realism': ['Realismo', 'Realism', 'Realismo', 'Realisme', 'Realisme', 'Realismo', 'リアル', 'สมจริง', 'Gerçekçilik', 'واقعية', 'Реализм', 'Реалізм', 'Réalisme', 'Realismus'],
  'gm.t.Cartoon': ['Caricatura', 'Cartoon', 'Desenho', 'Kartun', 'Kartun', 'Cartoon', 'カートゥーン', 'การ์ตูน', 'Çizgi film', 'كرتون', 'Мультяшное', 'Мультяшне', 'Cartoon', 'Cartoon'],
  'gm.t.Scenic': ['Escenarios', 'Scenic', 'Cenários', 'Pemandangan', 'Pemandangan', 'Tanawin', '風景', 'ฉาก', 'Manzara', 'مناظر', 'Декорации', 'Декорації', 'Décors', 'Szenerie'],
  'gm.t.Build': ['Construcción', 'Build', 'Construção', 'Bangunan', 'Binaan', 'Pagbuo', '建築', 'สร้าง', 'İnşa', 'بناء', 'Стройка', 'Будівництво', 'Construction', 'Bauen'],
  'gm.modo': ['Modo', 'Mode', 'Modo', 'Mode', 'Mod', 'Mode', 'モード', 'โหมด', 'Mod', 'الوضع', 'Режим', 'Режим', 'Mode', 'Modus'],
  'gm.modoAuto': ['Automático (el del mapa)', 'Automatic (the map’s)', 'Automático (o do mapa)', 'Otomatis (sesuai peta)', 'Automatik (ikut peta)', 'Awtomatiko (ayon sa mapa)', '自動(マップに合わせる)', 'อัตโนมัติ (ตามแผนที่)', 'Otomatik (haritanınki)', 'تلقائي (حسب الخريطة)', 'Авто (по карте)', 'Авто (за мапою)', 'Automatique (celui de la carte)', 'Automatisch (der der Karte)'],
  'gm.equipo': ['Elegí tu equipo', 'Choose your team', 'Escolha seu time', 'Pilih timmu', 'Pilih pasukan anda', 'Piliin ang team mo', 'チームを選んでください', 'เลือกทีมของคุณ', 'Takımını seç', 'اختر فريقك', 'Выбери команду', 'Обери команду', 'Choisis ton équipe', 'Wähle dein Team'],
  'gm.equipoAuto': ['Automático', 'Auto', 'Automático', 'Otomatis', 'Automatik', 'Awtomatiko', '自動', 'อัตโนมัติ', 'Otomatik', 'تلقائي', 'Авто', 'Авто', 'Auto', 'Automatisch'],
  'gm.ronda': ['Ronda', 'Round', 'Rodada', 'Ronde', 'Pusingan', 'Round', 'ラウンド', 'รอบ', 'Tur', 'الجولة', 'Раунд', 'Раунд', 'Manche', 'Runde'],
  'gmb.addons': ['addons', 'addons', 'addons', 'addon', 'addon', 'addon', 'アドオン', 'แอดออน', 'eklenti', 'إضافات', 'аддонов', 'аддонів', 'addons', 'Addons'],
  'gmb.tienda': ['Instalar más', 'Install more', 'Instalar mais', 'Pasang lagi', 'Pasang lagi', 'Mag-install pa', 'もっと入れる', 'ติดตั้งเพิ่ม', 'Daha fazla kur', 'تثبيت المزيد', 'Установить ещё', 'Встановити ще', 'En installer', 'Mehr installieren'],
  'gmb.tiendaPausa': ['La tienda de GMod está en el menú', 'The GMod store is in the menu', 'A loja do GMod está no menu', 'Toko GMod ada di menu', 'Kedai GMod ada di menu', 'Nasa menu ang GMod store', 'GModストアはメニューにあります', 'ร้าน GMod อยู่ในเมนู', 'GMod mağazası menüde', 'متجر GMod في القائمة', 'Магазин GMod в меню', 'Магазин GMod у меню', 'La boutique GMod est dans le menu', 'Der GMod-Shop ist im Menü'],
  'gmb.vacio': ['Todavía no instalaste mods de GMod. Bajá armas, NPCs, mapas y modos del Workshop.', 'You have no GMod mods yet. Get weapons, NPCs, maps and gamemodes from the Workshop.', 'Você ainda não tem mods do GMod. Baixe armas, NPCs, mapas e modos da Oficina.', 'Belum ada mod GMod. Ambil senjata, NPC, peta, dan mode dari Workshop.', 'Belum ada mod GMod. Ambil senjata, NPC, peta dan mod dari Workshop.', 'Wala ka pang GMod mods. Kumuha ng armas, NPC, mapa at mode sa Workshop.', 'まだGModのMODがありません。ワークショップから武器・NPC・マップ・モードを入手しよう。', 'ยังไม่มีม็อด GMod ดาวน์โหลดอาวุธ NPC แผนที่และโหมดจาก Workshop', 'Henüz GMod modun yok. Atölyeden silah, NPC, harita ve mod indir.', 'لا توجد إضافات GMod بعد. احصل على أسلحة وشخصيات وخرائط وأنماط من الورشة.', 'Модов GMod пока нет. Скачай оружие, NPC, карты и режимы из Мастерской.', 'Модів GMod поки немає. Завантаж зброю, NPC, мапи й режими з Майстерні.', 'Aucun mod GMod pour l’instant. Récupère armes, PNJ, cartes et modes dans le Workshop.', 'Noch keine GMod-Mods. Hol dir Waffen, NPCs, Karten und Modi aus dem Workshop.'],
  'gmb.mods': ['Mods', 'Mods', 'Mods', 'Mod', 'Mod', 'Mga mod', 'MOD', 'ม็อด', 'Modlar', 'المودات', 'Моды', 'Моди', 'Mods', 'Mods'],
  'gmb.tEfecto': ['Efecto de pantalla', 'Screen effect', 'Efeito de tela', 'Efek layar', 'Kesan skrin', 'Epekto sa screen', '画面エフェクト', 'เอฟเฟกต์หน้าจอ', 'Ekran efekti', 'تأثير الشاشة', 'Эффект экрана', 'Ефект екрана', "Effet d'écran", 'Bildschirmeffekt'],
  'gmb.tHerr': ['Herramientas', 'Tools', 'Ferramentas', 'Alat', 'Alat', 'Mga tool', 'ツール', 'เครื่องมือ', 'Araçlar', 'أدوات', 'Инструменты', 'Інструменти', 'Outils', 'Werkzeuge'],
  'gmb.tScript': ['Script', 'Script', 'Script', 'Skrip', 'Skrip', 'Script', 'スクリプト', 'สคริปต์', 'Betik', 'سكربت', 'Скрипт', 'Скрипт', 'Script', 'Skript'],
  'gmb.tMapa': ['Mapas', 'Maps', 'Mapas', 'Peta', 'Peta', 'Mga mapa', 'マップ', 'แผนที่', 'Haritalar', 'خرائط', 'Карты', 'Мапи', 'Cartes', 'Karten'],
  'gmb.activado': ['Activado', 'On', 'Ativado', 'Aktif', 'Aktif', 'Naka-on', 'オン', 'เปิด', 'Açık', 'مفعّل', 'Включено', 'Увімкнено', 'Activé', 'An'],
  'gmb.desactivado': ['Desactivado', 'Off', 'Desativado', 'Nonaktif', 'Tidak aktif', 'Naka-off', 'オフ', 'ปิด', 'Kapalı', 'معطّل', 'Выключено', 'Вимкнено', 'Désactivé', 'Aus'],
  'gmb.siempre': ['Siempre activo', 'Always on', 'Sempre ativo', 'Selalu aktif', 'Sentiasa aktif', 'Laging naka-on', '常にオン', 'เปิดตลอด', 'Her zaman açık', 'مفعّل دائمًا', 'Всегда включено', 'Завжди увімкнено', 'Toujours actif', 'Immer aktiv'],
  'gmb.siempreAyuda': ['El efecto se ve siempre, sin tener el objeto en la mano. Apagalo para usarlo sólo cuando lo agarrás.', 'The effect is always shown, without holding the item. Turn it off to use it only while you hold it.', 'O efeito aparece sempre, sem segurar o objeto. Desative para usá-lo só quando estiver segurando.', 'Efeknya selalu tampil tanpa memegang bendanya. Matikan agar hanya aktif saat kamu memegangnya.', 'Kesannya sentiasa dipaparkan tanpa memegang objek itu. Matikan untuk menggunakannya hanya semasa anda memegangnya.', 'Laging nakikita ang epekto kahit hindi hawak ang item. I-off para gumana lang kapag hawak mo ito.', 'アイテムを持っていなくても常に効果が表示されます。オフにすると、持っている間だけ使えます。', 'เอฟเฟกต์จะแสดงตลอดโดยไม่ต้องถือไอเทม ปิดเพื่อให้ทำงานเฉพาะตอนที่ถืออยู่', 'Efekt, eşyayı tutmadan her zaman görünür. Yalnızca tutarken kullanmak için kapat.', 'يظهر التأثير دائمًا دون حمل الغرض. أوقفه لاستخدامه فقط أثناء حمله.', 'Эффект виден всегда, даже без предмета в руках. Выключите, чтобы он работал только когда предмет в руках.', 'Ефект видно завжди, навіть без предмета в руках. Вимкніть, щоб він працював лише коли предмет у руках.', "L'effet est toujours affiché, sans tenir l'objet. Désactivez-le pour l'utiliser seulement quand vous le tenez.", 'Der Effekt ist immer zu sehen, ohne den Gegenstand in der Hand. Schalte es aus, um ihn nur beim Halten zu nutzen.'],
  'gmb.efectoAyuda': ['Se aplica a la pantalla mientras está activado. Sus ajustes, abajo.', 'It is applied to the screen while it is on. Its settings are below.', 'É aplicado à tela enquanto estiver ativado. Os ajustes ficam abaixo.', 'Diterapkan ke layar selama aktif. Pengaturannya di bawah.', 'Dikenakan pada skrin selagi aktif. Tetapannya di bawah.', 'Nakalapat sa screen habang naka-on. Nasa ibaba ang settings.', 'オンの間、画面にかかります。設定は下にあります。', 'ใช้กับหน้าจอขณะเปิดอยู่ การตั้งค่าอยู่ด้านล่าง', 'Açıkken ekrana uygulanır. Ayarları aşağıda.', 'يُطبَّق على الشاشة ما دام مفعّلًا. إعداداته في الأسفل.', 'Применяется к экрану, пока включено. Настройки ниже.', 'Застосовується до екрана, поки увімкнено. Налаштування нижче.', "S'applique à l'écran tant qu'il est activé. Ses réglages sont en dessous.", 'Wird auf den Bildschirm angewendet, solange es an ist. Die Einstellungen stehen darunter.'],
  'gmb.onAyuda': ['Apagado, el mod no corre lo suyo (lo que dibuja y lo que hace solo); lo que ya pusiste se queda.', 'When off, the mod does not run its own stuff (what it draws and does by itself); what you already placed stays.', 'Desligado, o mod não roda o que é dele (o que desenha e faz sozinho); o que você já colocou fica.', 'Saat mati, mod tidak menjalankan miliknya (yang digambar dan dilakukan sendiri); yang sudah kamu taruh tetap ada.', 'Apabila mati, mod tidak menjalankan miliknya (yang dilukis dan dibuat sendiri); yang sudah anda letak kekal.', 'Kapag naka-off, hindi tumatakbo ang sariling gawa ng mod; nananatili ang mga nailagay mo na.', 'オフにすると、MOD自身の処理(描画や自動の動作)は止まります。置いた物は残ります。', 'เมื่อปิด ม็อดจะไม่ทำงานของตัวเอง (สิ่งที่วาดและทำเอง) ของที่วางไว้แล้วยังอยู่', 'Kapalıyken mod kendi işlerini (çizdiklerini ve kendi yaptıklarını) çalıştırmaz; koyduğun şeyler kalır.', 'عند الإيقاف لا يشغّل المود ما يخصه (ما يرسمه وما يفعله وحده)؛ وما وضعته يبقى.', 'Когда выключено, мод не выполняет своё (то, что рисует и делает сам); поставленное остаётся.', 'Коли вимкнено, мод не виконує своє (те, що малює і робить сам); поставлене лишається.', "Désactivé, le mod ne fait plus tourner ce qui lui est propre (ce qu'il dessine et fait seul) ; ce que tu as posé reste.", 'Aus: Der Mod führt sein Eigenes nicht aus (was er zeichnet und selbst tut); was du schon gesetzt hast, bleibt.'],
  'gmb.modoAyuda': ['Es un modo de juego: elegilo al crear la partida (Modo de juego).', 'It is a gamemode: pick it when you create the game (Gamemode).', 'É um modo de jogo: escolha ao criar a partida (Modo de jogo).', 'Ini mode permainan: pilih saat membuat permainan (Mode permainan).', 'Ini mod permainan: pilih semasa mencipta permainan (Mod permainan).', 'Isa itong gamemode: piliin kapag gumagawa ng laro (Gamemode).', 'ゲームモードです。ゲーム作成時に選んでください(ゲームモード)。', 'นี่คือโหมดเกม: เลือกตอนสร้างเกม (โหมดเกม)', 'Bu bir oyun modu: oyunu oluştururken seç (Oyun modu).', 'هذا نمط لعب: اختره عند إنشاء اللعبة (نمط اللعب).', 'Это игровой режим: выбери его при создании игры (Режим).', 'Це ігровий режим: обери його під час створення гри (Режим).', "C'est un mode de jeu : choisis-le en créant la partie (Mode de jeu).", 'Das ist ein Spielmodus: Wähle ihn beim Erstellen des Spiels (Spielmodus).'],
  'gmb.mapasAparte': ['%n mods de mapas: están en Mapas.', '%n map mods: they are in Maps.', '%n mods de mapas: estão em Mapas.', '%n mod peta: ada di Peta.', '%n mod peta: ada di Peta.', '%n map mod: nasa Mga mapa.', 'マップMOD %n 個:マップにあります。', 'ม็อดแผนที่ %n รายการ: อยู่ในแผนที่', '%n harita modu: Haritalar bölümünde.', '%n من مودات الخرائط: موجودة في الخرائط.', 'Модов с картами: %n — они в «Картах».', 'Модів із мапами: %n — вони в «Мапах».', '%n mods de cartes : ils sont dans Cartes.', '%n Karten-Mods: Sie sind unter Karten.'],
  'gmb.traeMapas': ['Este mod también trae mapas: están en Mapas.', 'This mod also has maps: they are in Maps.', 'Este mod também traz mapas: estão em Mapas.', 'Mod ini juga berisi peta: ada di Peta.', 'Mod ini juga ada peta: ada di Peta.', 'May kasama ring mapa ang mod na ito: nasa Mga mapa.', 'このMODにはマップもあります:マップにあります。', 'ม็อดนี้มีแผนที่ด้วย: อยู่ในแผนที่', 'Bu modda haritalar da var: Haritalar bölümünde.', 'هذا المود فيه خرائط أيضًا: موجودة في الخرائط.', 'В этом моде есть и карты: они в «Картах».', 'У цьому моді є й мапи: вони в «Мапах».', 'Ce mod a aussi des cartes : elles sont dans Cartes.', 'Dieser Mod hat auch Karten: Sie sind unter Karten.'],
  'gmb.funciones': ['Funciones', 'Functions', 'Funções', 'Fungsi', 'Fungsi', 'Mga function', '機能', 'ฟังก์ชัน', 'İşlevler', 'الوظائف', 'Функции', 'Функції', 'Fonctions', 'Funktionen'],
  'gmb.funcAyuda': ['Prendé o apagá por separado cada cosa que el mod hace por su cuenta. Si algo no anda (la HUD tapa, la cámara se rompe), apagá sólo eso.', 'Turn each thing the mod does by itself on or off separately. If something breaks (the HUD covers the screen, the camera goes wrong), turn off just that.', 'Ligue ou desligue separadamente cada coisa que o mod faz sozinho. Se algo não funcionar (a HUD cobre, a câmera quebra), desligue só isso.', 'Nyalakan atau matikan terpisah tiap hal yang dilakukan mod sendiri. Kalau ada yang rusak (HUD menutupi, kamera kacau), matikan itu saja.', 'Hidupkan atau matikan secara berasingan setiap perkara yang mod buat sendiri. Jika ada yang rosak (HUD menutup, kamera rosak), matikan itu sahaja.', 'I-on o i-off nang hiwalay ang bawat gawa ng mod. Kapag may sira (tinatakpan ng HUD, nasira ang camera), iyon lang ang i-off.', 'MODが自分で行うことを個別にオン・オフできます。不具合があれば(HUDが画面をふさぐ、カメラが壊れる)それだけをオフに。', 'เปิดหรือปิดแยกกันแต่ละอย่างที่ม็อดทำเอง ถ้ามีอะไรเสีย (HUD บังจอ กล้องเพี้ยน) ปิดแค่อันนั้น', 'Modun kendi yaptığı her şeyi ayrı ayrı aç veya kapat. Bir şey bozuksa (HUD ekranı kapatıyor, kamera bozuluyor) sadece onu kapat.', 'شغّل أو أوقف كل شيء يفعله المود وحده بشكل منفصل. إذا تعطّل شيء (الواجهة تغطي الشاشة، الكاميرا تخرب) أوقف ذلك فقط.', 'Включай и выключай по отдельности всё, что мод делает сам. Если что-то ломается (HUD закрывает экран, камера сбоит), выключи только это.', 'Вмикай і вимикай окремо все, що мод робить сам. Якщо щось ламається (HUD закриває екран, камера збоїть), вимкни лише це.', "Active ou désactive séparément chaque chose que le mod fait seul. Si quelque chose ne va pas (le HUD couvre l'écran, la caméra se dérègle), désactive seulement ça.", 'Schalte alles, was der Mod selbst tut, einzeln an oder aus. Wenn etwas kaputt ist (HUD verdeckt, Kamera spinnt), schalte nur das aus.'],
  'gmb.f.pantalla': ['Efectos de pantalla', 'Screen effects', 'Efeitos de tela', 'Efek layar', 'Kesan skrin', 'Mga epekto sa screen', '画面エフェクト', 'เอฟเฟกต์หน้าจอ', 'Ekran efektleri', 'تأثيرات الشاشة', 'Эффекты экрана', 'Ефекти екрана', "Effets d'écran", 'Bildschirmeffekte'],
  'gmb.f.hud': ['HUD (lo que dibuja encima)', 'HUD (what it draws on top)', 'HUD (o que desenha por cima)', 'HUD (yang digambar di atas)', 'HUD (yang dilukis di atas)', 'HUD (ginuguhit sa ibabaw)', 'HUD(上に描くもの)', 'HUD (สิ่งที่วาดทับ)', 'HUD (üstüne çizdikleri)', 'الواجهة (ما يرسمه فوق الشاشة)', 'HUD (что рисует поверх)', 'HUD (що малює поверх)', 'HUD (ce qu’il dessine par-dessus)', 'HUD (was darüber gezeichnet wird)'],
  'gmb.f.camara': ['Cámara y mira', 'Camera and view', 'Câmera e mira', 'Kamera dan pandangan', 'Kamera dan pandangan', 'Camera at tingin', 'カメラと視点', 'กล้องและมุมมอง', 'Kamera ve görüş', 'الكاميرا والرؤية', 'Камера и вид', 'Камера і вигляд', 'Caméra et vue', 'Kamera und Sicht'],
  'gmb.f.mov': ['Movimiento y animaciones', 'Movement and animations', 'Movimento e animações', 'Gerakan dan animasi', 'Pergerakan dan animasi', 'Galaw at animasyon', '移動とアニメーション', 'การเคลื่อนไหวและแอนิเมชัน', 'Hareket ve animasyonlar', 'الحركة والرسوم', 'Движение и анимации', 'Рух і анімації', 'Mouvement et animations', 'Bewegung und Animationen'],
  'gmb.f.teclas': ['Teclas', 'Keys', 'Teclas', 'Tombol', 'Kekunci', 'Mga key', 'キー', 'ปุ่ม', 'Tuşlar', 'المفاتيح', 'Клавиши', 'Клавіші', 'Touches', 'Tasten'],
  'gmb.f.mundo': ['Dibujos en el mundo', 'Drawing in the world', 'Desenhos no mundo', 'Gambar di dunia', 'Lukisan di dunia', 'Mga guhit sa mundo', 'ワールド内の描画', 'ภาพวาดในโลก', 'Dünyada çizimler', 'رسوم في العالم', 'Рисунки в мире', 'Малюнки у світі', 'Dessins dans le monde', 'Zeichnungen in der Welt'],
  'gmb.f.dano': ['Daño y muertes', 'Damage and deaths', 'Dano e mortes', 'Kerusakan dan kematian', 'Kerosakan dan kematian', 'Pinsala at pagkamatay', 'ダメージと死亡', 'ความเสียหายและการตาย', 'Hasar ve ölümler', 'الضرر والموت', 'Урон и смерти', 'Шкода і смерті', 'Dégâts et morts', 'Schaden und Tode'],
  'gmb.f.chat': ['Chat y voz', 'Chat and voice', 'Chat e voz', 'Chat dan suara', 'Sembang dan suara', 'Chat at boses', 'チャットとボイス', 'แชทและเสียง', 'Sohbet ve ses', 'الدردشة والصوت', 'Чат и голос', 'Чат і голос', 'Chat et voix', 'Chat und Stimme'],
  'gmb.f.aparecer': ['Al aparecer y poner cosas', 'On spawn and placing things', 'Ao aparecer e colocar coisas', 'Saat muncul dan menaruh barang', 'Semasa muncul dan meletak barang', 'Sa pag-spawn at paglalagay', '出現時と物を置く時', 'ตอนเกิดและวางของ', 'Doğarken ve eşya koyarken', 'عند الظهور ووضع الأشياء', 'При появлении и установке', 'При появі й розміщенні', 'À l’apparition et en posant des objets', 'Beim Erscheinen und Platzieren'],
  'gmb.f.cuadro': ['Cada cuadro (lo que hace solo)', 'Every frame (what it does on its own)', 'Cada quadro (o que faz sozinho)', 'Setiap frame (yang dilakukan sendiri)', 'Setiap bingkai (yang dibuat sendiri)', 'Bawat frame (kusang ginagawa)', '毎フレーム(自動の処理)', 'ทุกเฟรม (สิ่งที่ทำเอง)', 'Her karede (kendi yaptığı)', 'كل إطار (ما يفعله وحده)', 'Каждый кадр (что делает сам)', 'Щокадру (що робить сам)', 'À chaque image (ce qu’il fait seul)', 'Jedes Bild (was er selbst tut)'],
  'gmb.f.permisos': ['Permisos (agarrar, usar, herramientas)', 'Permissions (grab, use, tools)', 'Permissões (pegar, usar, ferramentas)', 'Izin (ambil, pakai, alat)', 'Kebenaran (ambil, guna, alat)', 'Pahintulot (hawak, gamit, tool)', '権限(つかむ・使う・ツール)', 'สิทธิ์ (หยิบ ใช้ เครื่องมือ)', 'İzinler (tutma, kullanma, araçlar)', 'الأذونات (الإمساك، الاستخدام، الأدوات)', 'Разрешения (хватать, использовать, инструменты)', 'Дозволи (хапати, використовувати, інструменти)', 'Permissions (attraper, utiliser, outils)', 'Rechte (greifen, benutzen, Werkzeuge)'],
  'gmb.f.otros': ['Otras funciones', 'Other functions', 'Outras funções', 'Fungsi lain', 'Fungsi lain', 'Iba pang function', 'その他の機能', 'ฟังก์ชันอื่น', 'Diğer işlevler', 'وظائف أخرى', 'Другие функции', 'Інші функції', 'Autres fonctions', 'Andere Funktionen'],
  'gmb.noAndan': ['No andan · %n', "Don't work · %n", 'Não funcionam · %n', 'Tidak jalan · %n', 'Tidak berfungsi · %n', 'Hindi gumagana · %n', '動かない · %n', 'ใช้ไม่ได้ · %n', 'Çalışmıyor · %n', 'لا تعمل · %n', 'Не работают · %n', 'Не працюють · %n', 'Ne marchent pas · %n', 'Funktionieren nicht · %n'],
  'gmb.noAndanAyuda': ['Les faltan archivos: el modelo no viene en el mod (es de otro mod o de un juego) o no se pudo leer. Pueden no aparecer o verse mal.', 'Files are missing: the model is not in the mod (it comes from another mod or game) or could not be read. They may not appear or may look wrong.', 'Faltam arquivos: o modelo não vem no mod (é de outro mod ou jogo) ou não pôde ser lido. Podem não aparecer ou ficar estranhos.', 'File hilang: modelnya tidak ada di mod (dari mod atau game lain) atau tidak bisa dibaca. Bisa tidak muncul atau tampak aneh.', 'Fail hilang: model tiada dalam mod (dari mod atau permainan lain) atau tidak dapat dibaca. Mungkin tidak muncul atau nampak pelik.', 'Kulang ang file: wala sa mod ang model (galing sa ibang mod o laro) o hindi mabasa. Baka hindi lumabas o mukhang mali.', 'ファイルが足りません:モデルがMODに入っていない(別のMODやゲームのもの)か読めませんでした。出ないか、おかしく見えるかもしれません。', 'ไฟล์ขาด: โมเดลไม่ได้อยู่ในม็อด (มาจากม็อดหรือเกมอื่น) หรืออ่านไม่ได้ อาจไม่ปรากฏหรือดูผิด', 'Dosyalar eksik: model modda yok (başka bir mod ya da oyundan) veya okunamadı. Görünmeyebilir ya da bozuk görünebilir.', 'ملفات ناقصة: النموذج غير موجود في المود (من مود أو لعبة أخرى) أو تعذّرت قراءته. قد لا يظهر أو يبدو خاطئًا.', 'Не хватает файлов: модели нет в моде (она из другого мода или игры) или её не удалось прочитать. Могут не появиться или выглядеть неправильно.', 'Бракує файлів: моделі немає в моді (вона з іншого моду чи гри) або її не вдалося прочитати. Можуть не з’явитися або виглядати неправильно.', 'Il manque des fichiers : le modèle n’est pas dans le mod (il vient d’un autre mod ou jeu) ou n’a pas pu être lu. Ils peuvent ne pas apparaître ou mal s’afficher.', 'Dateien fehlen: Das Modell ist nicht im Mod (es stammt aus einem anderen Mod oder Spiel) oder ließ sich nicht lesen. Sie erscheinen evtl. nicht oder sehen falsch aus.'],
  'gmb.faltaModelo': ['falta el modelo', 'model missing', 'falta o modelo', 'model hilang', 'model hilang', 'kulang ang model', 'モデルなし', 'ไม่มีโมเดล', 'model yok', 'النموذج ناقص', 'нет модели', 'немає моделі', 'modèle manquant', 'Modell fehlt'],
  'gmb.modeloRoto': ['el modelo no se pudo leer', 'model could not be read', 'o modelo não pôde ser lido', 'model tidak bisa dibaca', 'model tidak dapat dibaca', 'hindi mabasa ang model', 'モデルを読めない', 'อ่านโมเดลไม่ได้', 'model okunamadı', 'تعذّرت قراءة النموذج', 'модель не читается', 'модель не читається', 'modèle illisible', 'Modell unlesbar'],
  'gmb.noCargo': ['su código no cargó', 'its code did not load', 'o código não carregou', 'kodenya tidak termuat', 'kodnya tidak dimuatkan', 'hindi nag-load ang code', 'コードが読み込めない', 'โค้ดโหลดไม่ได้', 'kodu yüklenmedi', 'لم تُحمَّل شيفرته', 'код не загрузился', 'код не завантажився', 'son code n’a pas chargé', 'Code nicht geladen'],
  'gmb.armas': ['Armas', 'Weapons', 'Armas', 'Senjata', 'Senjata', 'Armas', '武器', 'อาวุธ', 'Silahlar', 'أسلحة', 'Оружие', 'Зброя', 'Armes', 'Waffen'],
  'gmb.ents': ['Entidades', 'Entities', 'Entidades', 'Entitas', 'Entiti', 'Entities', 'エンティティ', 'เอนทิตี', 'Varlıklar', 'كيانات', 'Сущности', 'Сутності', 'Entités', 'Entitäten'],
  'gmb.npcs': ['NPCs', 'NPCs', 'NPCs', 'NPC', 'NPC', 'NPC', 'NPC', 'NPC', "NPC'ler", 'شخصيات', 'NPC', 'NPC', 'PNJ', 'NPCs'],
  'gmb.vehs': ['Vehículos', 'Vehicles', 'Veículos', 'Kendaraan', 'Kenderaan', 'Sasakyan', '乗り物', 'ยานพาหนะ', 'Araçlar', 'مركبات', 'Транспорт', 'Транспорт', 'Véhicules', 'Fahrzeuge'],
  'gmb.pms': ['Personajes', 'Characters', 'Personagens', 'Karakter', 'Watak', 'Mga karakter', 'キャラクター', 'ตัวละคร', 'Karakterler', 'شخصيات اللاعب', 'Персонажи', 'Персонажі', 'Personnages', 'Charaktere'],
  'gmb.props': ['Props', 'Props', 'Props', 'Properti', 'Prop', 'Props', 'プロップ', 'พร็อพ', 'Eşyalar', 'أشياء', 'Пропы', 'Пропи', 'Props', 'Props'],
  'gmb.herr': ['Herramientas (Tool Gun)', 'Tools (Tool Gun)', 'Ferramentas (Tool Gun)', 'Alat (Tool Gun)', 'Alat (Tool Gun)', 'Mga tool (Tool Gun)', 'ツール(ツールガン)', 'เครื่องมือ (Tool Gun)', 'Araçlar (Tool Gun)', 'أدوات (Tool Gun)', 'Инструменты (Tool Gun)', 'Інструменти (Tool Gun)', 'Outils (Tool Gun)', 'Werkzeuge (Tool Gun)'],
  'gmb.usar': ['Usar', 'Use', 'Usar', 'Pakai', 'Guna', 'Gamitin', '使う', 'ใช้', 'Kullan', 'استخدام', 'Взять', 'Взяти', 'Utiliser', 'Benutzen'],
  'gmb.hab': ['Habilidades y teclas', 'Abilities & keys', 'Habilidades e teclas', 'Kemampuan & tombol', 'Kebolehan & kekunci', 'Abilidad at keys', 'スキルとキー', 'ทักษะและปุ่ม', 'Yetenekler ve tuşlar', 'قدرات ومفاتيح', 'Способности и клавиши', 'Здібності й клавіші', 'Capacités et touches', 'Fähigkeiten & Tasten'],
  'gmb.habAyuda': ['Lo que el mod espera del teclado. Mantené apretado para usar; la chinche lo deja como botón en la pantalla.', 'What the mod expects from the keyboard. Hold to use; the pin puts it on screen as a button.', 'O que o mod espera do teclado. Segure para usar; o alfinete coloca como botão na tela.', 'Yang diharapkan mod dari keyboard. Tahan untuk memakai; pin menaruhnya sebagai tombol di layar.', 'Apa yang mod jangka dari papan kekunci. Tahan untuk guna; pin letakkannya sebagai butang di skrin.', 'Ang hinihintay ng mod sa keyboard. Pindutin nang matagal para gamitin; inilalagay ng pin bilang button sa screen.', 'MODがキーボードで待っている操作。長押しで使用、ピンで画面にボタンとして置けます。', 'สิ่งที่ม็อดต้องการจากคีย์บอร์ด กดค้างเพื่อใช้ หมุดจะวางเป็นปุ่มบนจอ', 'Modun klavyeden beklediği şeyler. Kullanmak için basılı tut; raptiye ekrana tuş olarak koyar.', 'ما ينتظره المود من لوحة المفاتيح. اضغط مطولًا للاستخدام؛ الدبوس يضعه زرًا على الشاشة.', 'Что мод ждёт с клавиатуры. Удерживай, чтобы использовать; кнопка-булавка выносит на экран.', 'Що мод чекає з клавіатури. Утримуй, щоб використати; шпилька виносить на екран.', 'Ce que le mod attend du clavier. Maintiens pour l’utiliser ; l’épingle le met en bouton à l’écran.', 'Was der Mod von der Tastatur erwartet. Halten zum Benutzen; die Nadel legt es als Taste auf den Bildschirm.'],
  'gmb.autoFijo': ['%n botones de %a en la pantalla (se quitan con la chinche en el panel GMod)', '%n buttons from %a on screen (remove them with the pin in the GMod panel)', '%n botões de %a na tela (tire com o alfinete no painel GMod)', '%n tombol dari %a di layar (hapus dengan pin di panel GMod)', '%n butang daripada %a di skrin (buang dengan pin di panel GMod)', '%n button mula sa %a sa screen (alisin gamit ang pin sa GMod panel)', '%a のボタン %n 個を画面に(GModパネルのピンで外せます)', 'ปุ่ม %n ปุ่มจาก %a บนจอ (เอาออกด้วยหมุดในแผง GMod)', '%a için %n düğme ekranda (GMod panelindeki iğneyle kaldır)', '%n أزرار من %a على الشاشة (أزلها بالدبوس في لوحة GMod)', '%n кнопок из %a на экране (убираются булавкой в панели GMod)', '%n кнопок з %a на екрані (прибираються шпилькою в панелі GMod)', '%n boutons de %a à l\'écran (retire-les avec l\'épingle du panneau GMod)', '%n Knöpfe von %a auf dem Bildschirm (mit der Nadel im GMod-Panel entfernen)'],
  'gmb.fijar': ['Fijar en la pantalla', 'Pin to screen', 'Fixar na tela', 'Sematkan di layar', 'Sematkan di skrin', 'I-pin sa screen', '画面に固定', 'ปักหมุดบนจอ', 'Ekrana sabitle', 'تثبيت على الشاشة', 'Закрепить на экране', 'Закріпити на екрані', 'Épingler à l’écran', 'Anheften'],
  'gmb.cmds': ['Comandos', 'Commands', 'Comandos', 'Perintah', 'Arahan', 'Mga utos', 'コマンド', 'คำสั่ง', 'Komutlar', 'أوامر', 'Команды', 'Команди', 'Commandes', 'Befehle'],
  'gmb.arg': ['argumento', 'argument', 'argumento', 'argumen', 'argumen', 'argumento', '引数', 'อาร์กิวเมนต์', 'argüman', 'وسيط', 'аргумент', 'аргумент', 'argument', 'Argument'],
  'gmb.ajustes': ['Ajustes', 'Settings', 'Ajustes', 'Pengaturan', 'Tetapan', 'Settings', '設定', 'การตั้งค่า', 'Ayarlar', 'الإعدادات', 'Настройки', 'Налаштування', 'Réglages', 'Einstellungen'],
  'gmb.info': ['Info', 'Info', 'Info', 'Info', 'Info', 'Info', '情報', 'ข้อมูล', 'Bilgi', 'معلومات', 'Инфо', 'Інфо', 'Infos', 'Info'],
  'gmb.archivos': ['Archivos', 'Files', 'Arquivos', 'Berkas', 'Fail', 'Mga file', 'ファイル', 'ไฟล์', 'Dosyalar', 'ملفات', 'Файлы', 'Файли', 'Fichiers', 'Dateien'],
  'gmb.lua': ['Lua corrido', 'Lua run', 'Lua executado', 'Lua dijalankan', 'Lua dijalankan', 'Lua na tumakbo', '実行したLua', 'Lua ที่รัน', 'Çalışan Lua', 'Lua المنفّذ', 'Lua запущено', 'Lua запущено', 'Lua exécuté', 'Lua ausgeführt'],
  'gmb.errores': ['Errores de Lua', 'Lua errors', 'Erros de Lua', 'Galat Lua', 'Ralat Lua', 'Mga error sa Lua', 'Luaエラー', 'ข้อผิดพลาด Lua', 'Lua hataları', 'أخطاء Lua', 'Ошибки Lua', 'Помилки Lua', 'Erreurs Lua', 'Lua-Fehler'],
  'gmb.modelosFaltan': ['Modelos que faltan', 'Missing models', 'Modelos faltando', 'Model hilang', 'Model hilang', 'Kulang na model', '足りないモデル', 'โมเดลที่ขาด', 'Eksik modeller', 'نماذج مفقودة', 'Нет моделей', 'Бракує моделей', 'Modèles manquants', 'Fehlende Modelle'],
  'gmb.equipo': ['Equipo', 'Team', 'Time', 'Tim', 'Pasukan', 'Team', 'チーム', 'ทีม', 'Takım', 'الفريق', 'Команда', 'Команда', 'Équipe', 'Team'],
  'gmb.ayuda': ['Ayuda', 'Help', 'Ajuda', 'Bantuan', 'Bantuan', 'Tulong', 'ヘルプ', 'ช่วยเหลือ', 'Yardım', 'مساعدة', 'Помощь', 'Довідка', 'Aide', 'Hilfe'],
  'gm.mapaMal': ['No se pudo armar ese mapa: se juega en Pasto plano', 'That map could not be built: playing on Flatgrass', 'Não deu para montar esse mapa: jogando em Flatgrass', 'Peta itu gagal dibuat: main di Flatgrass', 'Peta itu tidak dapat dibina: main di Flatgrass', 'Hindi nabuo ang mapang iyon: maglalaro sa Flatgrass', 'そのマップを作れませんでした。Flatgrassで遊びます', 'สร้างแผนที่นั้นไม่ได้: เล่นที่ Flatgrass แทน', 'Bu harita kurulamadı: Flatgrass’ta oynanıyor', 'تعذّر بناء هذه الخريطة: اللعب في Flatgrass', 'Не удалось собрать карту: игра на Flatgrass', 'Не вдалося зібрати мапу: гра на Flatgrass', 'Impossible de construire cette carte : partie sur Flatgrass', 'Diese Karte ließ sich nicht aufbauen: gespielt wird auf Flatgrass'],
  'gm.depGrande': ['Este addon pide {n} contenido(s) pesados ({mb} MB): no se bajaron solos para no llenar la memoria; buscalos en la tienda si los querés', 'This addon needs {n} heavy content pack(s) ({mb} MB): not downloaded automatically to save memory; find them in the store if you want them', 'Este addon pede {n} conteúdo(s) pesado(s) ({mb} MB): não foram baixados sozinhos para não lotar a memória; procure na loja se quiser', 'Addon ini butuh {n} konten berat ({mb} MB): tidak diunduh otomatis agar memori tidak penuh; cari di toko jika mau', 'Addon ini memerlukan {n} kandungan berat ({mb} MB): tidak dimuat turun sendiri supaya memori tidak penuh; cari di kedai jika mahu', 'Kailangan ng addon na ito ang {n} mabigat na content ({mb} MB): hindi kusang na-download para hindi mapuno ang memory; hanapin sa tindahan kung gusto mo', 'このアドオンは重いコンテンツ{n}個（{mb} MB）が必要です。メモリ節約のため自動では入れません。必要ならストアで探してください', 'แอดออนนี้ต้องใช้คอนเทนต์หนัก {n} รายการ ({mb} MB): ไม่ดาวน์โหลดอัตโนมัติเพื่อไม่ให้หน่วยความจำเต็ม หาได้ในร้านค้าถ้าต้องการ', 'Bu eklenti {n} ağır içerik istiyor ({mb} MB): bellek dolmasın diye otomatik indirilmedi; istersen mağazada bul', 'هذه الإضافة تحتاج {n} محتوى ثقيل ({mb} ميغابايت): لم يُنزَّل تلقائيًا كي لا تمتلئ الذاكرة؛ ابحث عنه في المتجر إن أردت', 'Этому аддону нужно {n} тяжёлых пакета(ов) ({mb} МБ): не скачаны сами, чтобы не забить память; найдите их в магазине, если нужно', 'Цьому аддону потрібно {n} важких пакетів ({mb} МБ): не завантажені самі, щоб не заповнити пам’ять; знайдіть їх у магазині, якщо треба', 'Cet addon demande {n} contenu(s) lourd(s) ({mb} Mo) : pas téléchargés tout seuls pour ne pas saturer la mémoire ; cherche-les dans la boutique si tu veux', 'Dieses Addon braucht {n} schwere Inhaltspakete ({mb} MB): nicht automatisch geladen, um den Speicher zu schonen; such sie im Shop, wenn du willst'],
  'gm.subs': ['suscritos', 'subscribers', 'inscritos', 'pelanggan', 'pelanggan', 'subscriber', '購読者', 'ผู้ติดตาม', 'abone', 'مشترك', 'подписчиков', 'підписників', 'abonnés', 'Abonnenten'],
  'gm.sinArchivo': ['Steam no da el archivo de este directo: importá su .gma desde tu compu', "Steam doesn't give this file directly: import its .gma from your computer", 'A Steam não entrega este arquivo direto: importe o .gma do seu computador', 'Steam tidak memberi file ini langsung: impor .gma-nya dari komputermu', 'Steam tidak memberi fail ini terus: import .gma daripada komputer anda', 'Hindi direktang binibigay ng Steam ang file na ito: i-import ang .gma mula sa computer mo', 'Steamはこのファイルを直接配布していません。PCから.gmaを読み込んでください', 'Steam ไม่ให้ไฟล์นี้โดยตรง: นำเข้า .gma จากคอมพิวเตอร์ของคุณ', 'Steam bu dosyayı doğrudan vermiyor: .gma dosyasını bilgisayarından içe aktar', 'لا يوفّر Steam هذا الملف مباشرة: استورد ملف ‎.gma من حاسوبك', 'Steam не отдаёт этот файл напрямую: импортируй .gma с компьютера', "Steam не віддає цей файл напряму: імпортуй .gma з комп'ютера", 'Steam ne fournit pas ce fichier directement : importe son .gma depuis ton ordinateur', 'Steam liefert diese Datei nicht direkt: importiere die .gma von deinem Computer'],
  'gm.sinRed': ['No hay conexión con Steam ahora (el servidor de mods está saturado): probá de nuevo en un rato', "Can't reach Steam right now (the mod server is busy): try again in a while", 'Sem conexão com a Steam agora (o servidor de mods está sobrecarregado): tente de novo daqui a pouco', 'Tidak bisa terhubung ke Steam sekarang (server mod sedang sibuk): coba lagi nanti', 'Tidak dapat berhubung dengan Steam sekarang (pelayan mod sibuk): cuba lagi sebentar lagi', 'Hindi maabot ang Steam ngayon (abala ang server ng mods): subukan ulit mamaya', '今はSteamにつながりません（MODサーバーが混雑中）。しばらくしてからもう一度試してください', 'ตอนนี้เชื่อมต่อ Steam ไม่ได้ (เซิร์ฟเวอร์ม็อดไม่ว่าง): ลองใหม่อีกครั้งในภายหลัง', 'Şu an Steam’e bağlanılamıyor (mod sunucusu yoğun): biraz sonra tekrar dene', 'تعذّر الوصول إلى Steam الآن (خادم التعديلات مشغول): حاول مرة أخرى بعد قليل', 'Сейчас нет связи со Steam (сервер модов перегружен): попробуй позже', 'Зараз немає зв’язку зі Steam (сервер модів перевантажений): спробуй пізніше', 'Impossible de joindre Steam pour l’instant (serveur de mods saturé) : réessaie dans un moment', 'Steam ist gerade nicht erreichbar (Mod-Server ausgelastet): versuch es gleich noch mal'],
  'gm.noExiste': ['No existe en el Workshop', 'Not found on the Workshop', 'Não existe na Oficina', 'Tidak ada di Workshop', 'Tiada dalam Workshop', 'Wala sa Workshop', 'ワークショップに見つかりません', 'ไม่พบใน Workshop', 'Atölyede bulunamadı', 'غير موجود في الورشة', 'Нет в Мастерской', 'Немає в Майстерні', 'Introuvable sur le Workshop', 'Nicht im Workshop gefunden'],
  'gm.importar': ['Importar .gma', 'Import .gma', 'Importar .gma', 'Impor .gma', 'Import .gma', 'I-import ang .gma', '.gmaを読み込む', 'นำเข้า .gma', '.gma içe aktar', 'استيراد ‎.gma', 'Импорт .gma', 'Імпорт .gma', 'Importer un .gma', '.gma importieren'],
  'gm.steam': ['Ver en Steam', 'View on Steam', 'Ver na Steam', 'Lihat di Steam', 'Lihat di Steam', 'Tingnan sa Steam', 'Steamで見る', 'ดูใน Steam', "Steam'de gör", 'عرض في Steam', 'Открыть в Steam', 'Відкрити в Steam', 'Voir sur Steam', 'Auf Steam ansehen'],
  'gm.bajando': ['Bajando', 'Downloading', 'Baixando', 'Mengunduh', 'Memuat turun', 'Nagda-download', 'ダウンロード中', 'กำลังดาวน์โหลด', 'İndiriliyor', 'جارٍ التنزيل', 'Скачивание', 'Завантаження', 'Téléchargement', 'Wird geladen'],
  'gm.descomp': ['Descomprimiendo', 'Unpacking', 'Descompactando', 'Membongkar', 'Menyahmampat', 'Ina-unpack', '展開中', 'กำลังแตกไฟล์', 'Açılıyor', 'جارٍ فك الضغط', 'Распаковка', 'Розпакування', 'Décompression', 'Entpacken'],
  'gm.noCompat': ['Mapa o modo de juego: todavía no anda en JXMod', "Map or gamemode: doesn't work in JXMod yet", 'Mapa ou modo de jogo: ainda não funciona no JXMod', 'Peta atau mode permainan: belum bisa di JXMod', 'Peta atau mod permainan: belum berfungsi dalam JXMod', 'Mapa o gamemode: hindi pa gumagana sa JXMod', 'マップ／ゲームモード：JXModではまだ使えません', 'แผนที่หรือโหมดเกม: ยังใช้ใน JXMod ไม่ได้', "Harita ya da oyun modu: JXMod'ta henüz çalışmıyor", 'خريطة أو نمط لعب: لا يعمل في JXMod بعد', 'Карта или режим: в JXMod пока не работает', 'Мапа або режим: у JXMod поки не працює', 'Carte ou mode de jeu : ne marche pas encore dans JXMod', 'Karte oder Spielmodus: läuft in JXMod noch nicht'],
  'gm.contenido': ['Trae', 'Includes', 'Inclui', 'Berisi', 'Mengandungi', 'Laman', '内容', 'ประกอบด้วย', 'İçerik', 'يحتوي', 'Внутри', 'Містить', 'Contient', 'Enthält'],
  'gm.modelos': ['modelos', 'models', 'modelos', 'model', 'model', 'model', 'モデル', 'โมเดล', 'model', 'نموذج', 'моделей', 'моделей', 'modèles', 'Modelle'],
  'gm.lua': ['scripts Lua', 'Lua scripts', 'scripts Lua', 'skrip Lua', 'skrip Lua', 'Lua script', 'Luaスクリプト', 'สคริปต์ Lua', 'Lua betiği', 'سكربتات Lua', 'Lua-скриптов', 'Lua-скриптів', 'scripts Lua', 'Lua-Skripte'],
  'gm.errLua': ['errores de Lua', 'Lua errors', 'erros de Lua', 'galat Lua', 'ralat Lua', 'error sa Lua', 'Luaエラー', 'ข้อผิดพลาด Lua', 'Lua hatası', 'أخطاء Lua', 'ошибок Lua', 'помилок Lua', 'erreurs Lua', 'Lua-Fehler'],
  'gm.puente': ['El Workshop de Steam no responde: probá de nuevo en un rato', "Steam Workshop isn't responding: try again in a bit", 'A Oficina da Steam não responde: tente de novo daqui a pouco', 'Workshop Steam tidak merespons: coba lagi sebentar lagi', 'Workshop Steam tidak menjawab: cuba lagi sebentar', 'Hindi sumasagot ang Steam Workshop: subukan ulit mamaya', 'Steamワークショップが応答しません。しばらくして再試行してください', 'Steam Workshop ไม่ตอบสนอง: ลองใหม่อีกสักพัก', 'Steam Atölyesi yanıt vermiyor: biraz sonra tekrar dene', 'ورشة Steam لا تستجيب: حاول بعد قليل', 'Мастерская Steam не отвечает: попробуй чуть позже', 'Майстерня Steam не відповідає: спробуй трохи згодом', 'Le Workshop Steam ne répond pas : réessaie dans un moment', 'Steam-Workshop antwortet nicht: versuch es gleich nochmal'],
  'gm.soloDir': ['Sólo descarga directa', 'Direct download only', 'Só download direto', 'Hanya unduhan langsung', 'Muat turun terus sahaja', 'Direktang download lang', '直接ダウンロードのみ', 'ดาวน์โหลดตรงเท่านั้น', 'Yalnızca doğrudan indirme', 'التنزيل المباشر فقط', 'Только прямая загрузка', 'Лише пряме завантаження', 'Téléchargement direct seulement', 'Nur Direkt-Download'],
  'gm.ningunoDir': ['Ninguno de estos se baja directo de Steam: probá «Más suscritos» o sacá el filtro (los demás se importan como .gma)', "None of these download directly from Steam: try 'Most subscribed' or turn off the filter (others are imported as .gma)", 'Nenhum destes baixa direto da Steam: tente «Mais inscritos» ou tire o filtro (os outros se importam como .gma)', 'Tidak ada yang bisa diunduh langsung dari Steam: coba «Paling banyak dilanggan» atau matikan filter (lainnya diimpor sebagai .gma)', 'Tiada yang boleh dimuat turun terus dari Steam: cuba «Paling ramai pelanggan» atau tutup penapis (yang lain diimport sebagai .gma)', 'Wala sa mga ito ang direktang nada-download sa Steam: subukan ang «Pinakamaraming subscriber» o alisin ang filter (ini-import ang iba bilang .gma)', 'Steamから直接ダウンロードできるものはありません：「購読数順」にするかフィルターを外してください（他は.gmaで読み込み）', 'ไม่มีรายการที่ดาวน์โหลดตรงจาก Steam ได้: ลอง «ผู้ติดตามมากสุด» หรือปิดตัวกรอง (อื่น ๆ นำเข้าเป็น .gma)', "Bunların hiçbiri Steam'den doğrudan inmiyor: «En çok abone»yi dene ya da filtreyi kapat (diğerleri .gma olarak içe aktarılır)", 'لا شيء من هذه يُنزَّل مباشرة من Steam: جرّب «الأكثر اشتراكًا» أو أوقف المرشّح (الباقي يُستورد كملف ‎.gma)', 'Ничего из этого не скачивается напрямую из Steam: попробуй «Больше подписок» или убери фильтр (остальное импортируется как .gma)', 'Нічого з цього не завантажується напряму зі Steam: спробуй «Найбільше підписок» або вимкни фільтр (інше імпортується як .gma)', "Aucun ne se télécharge directement depuis Steam : essaie « Plus d'abonnés » ou enlève le filtre (les autres s'importent en .gma)", 'Keins davon lädt direkt von Steam: probier „Meiste Abos" oder schalte den Filter aus (andere werden als .gma importiert)'],
  'gm.jugar': ['Jugar', 'Play', 'Jogar', 'Main', 'Main', 'Laruin', 'プレイ', 'เล่น', 'Oyna', 'العب', 'Играть', 'Грати', 'Jouer', 'Spielen'],
  'gm.probar': ['Probar', 'Try it', 'Experimentar', 'Coba', 'Cuba', 'Subukan', '試す', 'ลองใช้', 'Dene', 'جرّبه', 'Попробовать', 'Спробувати', 'Essayer', 'Ausprobieren'],
  'gm.ponerme': ['Ponérmelo', 'Wear it', 'Usar', 'Pakai', 'Pakai', 'Isuot', '着る', 'สวมใส่', 'Giy', 'ارتدِه', 'Надеть', 'Одягнути', 'Le porter', 'Anziehen'],
  'gm.muneco': ['muñeco', 'ragdoll', 'boneco', 'ragdoll', 'ragdoll', 'ragdoll', 'ラグドール', 'แร็กดอลล์', 'ragdoll', 'دمية', 'рэгдолл', 'реґдол', 'ragdoll', 'Ragdoll'],
  'gm.pm.puesto': ['Ahora sos {m}', 'You are now {m}', 'Agora você é {m}', 'Sekarang kamu {m}', 'Kini anda {m}', 'Ikaw na ngayon si {m}', '{m} になりました', 'ตอนนี้คุณคือ {m}', 'Artık {m} oldun', 'أنت الآن {m}', 'Теперь ты {m}', 'Тепер ти {m}', 'Tu es maintenant {m}', 'Du bist jetzt {m}'],
  'gm.falta': ['Este addon necesita otro: falta {m}', 'This addon needs another one: {m} is missing', 'Este addon precisa de outro: falta {m}', 'Addon ini butuh addon lain: {m} tidak ada', 'Addon ini perlukan addon lain: {m} tiada', 'Kailangan ng addon na ito ang iba: wala ang {m}', 'このアドオンには別のアドオンが必要です：{m} がありません', 'แอดออนนี้ต้องใช้แอดออนอื่น: ไม่มี {m}', 'Bu eklenti başka birine ihtiyaç duyuyor: {m} eksik', 'تحتاج هذه الإضافة إلى أخرى: {m} مفقود', 'Этому аддону нужен другой: нет {m}', 'Цьому аддону потрібен інший: немає {m}', 'Cet addon en nécessite un autre : {m} manque', 'Dieses Addon braucht ein anderes: {m} fehlt'],
  'gm.otroAddon': ['Necesita otros addons (faltan {n} modelos)', 'Needs other addons ({n} models missing)', 'Precisa de outros addons (faltam {n} modelos)', 'Butuh addon lain ({n} model tidak ada)', 'Perlukan addon lain ({n} model tiada)', 'Kailangan ng ibang addon ({n} model ang wala)', '他のアドオンが必要です（モデル{n}個が不足）', 'ต้องใช้แอดออนอื่น (ขาดโมเดล {n} ชิ้น)', 'Başka eklentiler gerekiyor ({n} model eksik)', 'تحتاج إضافات أخرى ({n} نماذج مفقودة)', 'Нужны другие аддоны (нет {n} моделей)', 'Потрібні інші аддони (немає {n} моделей)', "Nécessite d'autres addons ({n} modèles manquants)", 'Braucht andere Addons ({n} Modelle fehlen)'],
  'gm.solicitar': ['Solicitar', 'Request', 'Solicitar', 'Minta', 'Minta', 'Hilingin', 'リクエスト', 'ขอ', 'İste', 'طلب', 'Запросить', 'Запитати', 'Demander', 'Anfragen'],
  'gm.pide': ['{j} quiere activar {n} en el server', '{j} wants to enable {n} on the server', '{j} quer ativar {n} no servidor', '{j} ingin mengaktifkan {n} di server', '{j} mahu mengaktifkan {n} di pelayan', 'Gustong i-on ni {j} ang {n} sa server', '{j}がサーバーで{n}を有効にしたいそうです', '{j} ต้องการเปิด {n} ในเซิร์ฟเวอร์', '{j}, sunucuda {n} eklentisini açmak istiyor', '{j} يريد تفعيل {n} في الخادم', '{j} хочет включить {n} на сервере', '{j} хоче увімкнути {n} на сервері', '{j} veut activer {n} sur le serveur', '{j} möchte {n} auf dem Server aktivieren'],
  'gm.toca': ['Tocá para responder', 'Tap to answer', 'Toque para responder', 'Ketuk untuk menjawab', 'Ketik untuk menjawab', 'Pindutin para sumagot', 'タップして回答', 'แตะเพื่อตอบ', 'Yanıtlamak için dokun', 'المس للرد', 'Нажми, чтобы ответить', 'Натисни, щоб відповісти', 'Touche pour répondre', 'Tippen zum Antworten'],
  'gm.aceptar': ['Aceptar', 'Accept', 'Aceitar', 'Terima', 'Terima', 'Tanggapin', '承認', 'ยอมรับ', 'Kabul et', 'قبول', 'Принять', 'Прийняти', 'Accepter', 'Annehmen'],
  'gm.rechazar': ['Rechazar', 'Decline', 'Recusar', 'Tolak', 'Tolak', 'Tanggihan', '拒否', 'ปฏิเสธ', 'Reddet', 'رفض', 'Отклонить', 'Відхилити', 'Refuser', 'Ablehnen'],
  'gm.activado': ['Activado en el server para siempre', 'Enabled on the server for good', 'Ativado no servidor para sempre', 'Aktif di server untuk seterusnya', 'Diaktifkan di pelayan untuk selamanya', 'Naka-on na sa server habambuhay', 'サーバーで永久に有効化', 'เปิดในเซิร์ฟเวอร์ถาวรแล้ว', 'Sunucuda kalıcı olarak açıldı', 'فُعّل في الخادم نهائيًا', 'Включено на сервере навсегда', 'Увімкнено на сервері назавжди', 'Activé sur le serveur pour de bon', 'Dauerhaft auf dem Server aktiviert'],
  'gm.rechazado': ['No se activó', 'Not enabled', 'Não foi ativado', 'Tidak diaktifkan', 'Tidak diaktifkan', 'Hindi na-on', '有効化されませんでした', 'ไม่ได้เปิด', 'Açılmadı', 'لم يُفعَّل', 'Не включено', 'Не увімкнено', 'Pas activé', 'Nicht aktiviert'],
  'gm.enServer': ['Activo en el server', 'On the server', 'Ativo no servidor', 'Aktif di server', 'Aktif di pelayan', 'Naka-on sa server', 'サーバーで有効', 'เปิดในเซิร์ฟเวอร์', 'Sunucuda açık', 'مفعّل في الخادم', 'Есть на сервере', 'Є на сервері', 'Actif sur le serveur', 'Auf dem Server aktiv'],
  'gm.votando': ['Votando', 'Voting', 'Votando', 'Pemungutan suara', 'Mengundi', 'Bumoboto', '投票中', 'กำลังโหวต', 'Oylanıyor', 'تصويت جارٍ', 'Голосование', 'Голосування', 'Vote en cours', 'Abstimmung'],
  'gm.yaPedido': ['Ya se está votando', 'Already being voted on', 'Já está em votação', 'Sedang divoting', 'Sedang diundi', 'Binoboto na', 'すでに投票中です', 'กำลังโหวตอยู่แล้ว', 'Zaten oylanıyor', 'قيد التصويت بالفعل', 'Уже голосуют', 'Вже голосують', 'Déjà en vote', 'Wird schon abgestimmt'],
  'gm.pedido': ['Pedido enviado a todos', 'Request sent to everyone', 'Pedido enviado a todos', 'Permintaan dikirim ke semua', 'Permintaan dihantar kepada semua', 'Naipadala sa lahat ang hiling', '全員にリクエストを送りました', 'ส่งคำขอถึงทุกคนแล้ว', 'İstek herkese gönderildi', 'أُرسل الطلب للجميع', 'Запрос отправлен всем', 'Запит надіслано всім', 'Demande envoyée à tous', 'Anfrage an alle gesendet'],
  'gm.srvTit': ['GMod del server', 'Server GMod addons', 'GMod do servidor', 'GMod server', 'GMod pelayan', 'GMod ng server', 'サーバーのGMod', 'GMod ของเซิร์ฟเวอร์', "Sunucu GMod'u", 'GMod الخادم', 'GMod сервера', 'GMod сервера', 'GMod du serveur', 'Server-GMod'],
  'gm.srvAyuda': ['Buscá cualquier addon y tocá Solicitar: todos reciben un aviso y, si la mayoría acepta, queda activo en este server para siempre.', 'Find any addon and tap Request: everyone gets a notice, and if most accept, it stays enabled on this server for good.', 'Procure qualquer addon e toque em Solicitar: todos recebem um aviso e, se a maioria aceitar, ele fica ativo neste servidor para sempre.', 'Cari addon apa saja lalu ketuk Minta: semua dapat pemberitahuan, dan jika mayoritas menerima, addon aktif di server ini seterusnya.', 'Cari mana-mana addon dan ketik Minta: semua menerima notis, dan jika majoriti terima, ia kekal aktif di pelayan ini.', 'Maghanap ng kahit anong addon at pindutin ang Hilingin: lahat ay aabisuhan, at kung tatanggapin ng karamihan, mananatili itong naka-on sa server na ito.', '好きなアドオンを探してリクエストをタップ：全員に通知が届き、過半数が承認するとこのサーバーで永久に有効になります。', 'ค้นหาแอดออนใดก็ได้แล้วแตะ ขอ: ทุกคนจะได้รับแจ้ง และถ้าคนส่วนใหญ่ยอมรับ จะเปิดในเซิร์ฟเวอร์นี้ถาวร', "Herhangi bir eklentiyi bul ve İste'ye dokun: herkese bildirim gider, çoğunluk kabul ederse bu sunucuda kalıcı olarak açık kalır.", 'ابحث عن أي إضافة والمس طلب: يصل إشعار للجميع، وإذا وافق الأغلبية تبقى مفعّلة في هذا الخادم نهائيًا.', 'Найди любой аддон и нажми «Запросить»: всем придёт уведомление, и если большинство примет, он останется на этом сервере навсегда.', 'Знайди будь-який аддон і натисни «Запитати»: усім прийде сповіщення, і якщо більшість прийме, він залишиться на цьому сервері назавжди.', "Cherche n'importe quel addon et touche Demander : tout le monde reçoit une notification et, si la majorité accepte, il reste actif sur ce serveur pour de bon.", 'Such ein beliebiges Addon und tippe auf Anfragen: Alle bekommen eine Meldung, und wenn die Mehrheit annimmt, bleibt es auf diesem Server dauerhaft aktiv.'],
});
if (typeof module !== 'undefined') module.exports = { gmBuscar, gmCompactoCli, gmIdsDePaginaCli };
