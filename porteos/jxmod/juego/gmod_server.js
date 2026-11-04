// ---------------- addons de GMod del server: Solicitar → aviso a todos → Aceptar → activo en ese server para siempre ----------------
// En el panel SM, la categoría "GMod del server" busca en todo el Workshop. Tocar Solicitar manda un aviso a todos los de la
// sala; tocando el aviso se ve el addon y se acepta o se rechaza. Si la mayoría de los que estaban acepta (o, a los 60 s,
// hay más sí que no), queda activo en ese server para siempre: todos lo bajan y lo montan (modelos, sonidos y Lua), y el que
// entra después también. Así no hace falta instalar todo de una: se activa sólo lo que la gente quiere.
// Dónde queda guardado: un mensaje retenido en la sala (MQTT), una copia en cada navegador que lo vio y, si está el puente
// de la tienda, en su base de datos (/api/gmod/sala/ID). Cualquiera que tenga la lista la vuelve a publicar si falta.
const GMS = { lista: new Map(), votos: new Map(), montados: new Set(), sala: '', q: '', items: [], p: 0, total: 0, cargando: false, n: 0, tPub: 0 };
const gmsClave = () => (typeof SALA !== 'undefined' && SALA ? SALA.id : '');
const gmsLS = (id) => 'rb_gmsala_' + id;
function gmsGuardarLocal() { try { localStorage.setItem(gmsLS(GMS.sala), JSON.stringify([...GMS.lista.values()])); } catch (e) {} }
const gmsItem = (x) => (x && /^\d{3,12}$/.test(String(x.id)) ? { id: String(x.id), n: String(x.n || x.t || x.id).slice(0, 90), img: /^https:\/\//.test(x.img || '') ? String(x.img).slice(0, 300) : '', t: +x.t || Date.now() } : null);

// ---- al entrar a una sala: la lista que ya tenía este server (copia local, retenido de la sala y puente de la tienda) ----
function gmsEntrar() {
  const id = gmsClave(); if (!id || id === GMS.sala) return;
  gmsSalir(); GMS.sala = id; GMS.lista.clear(); GMS.votos.clear();
  try { for (const x of JSON.parse(localStorage.getItem(gmsLS(id)) || '[]')) { const it = gmsItem(x); if (it) GMS.lista.set(it.id, it); } } catch (e) {}
  if (typeof gmApiHay === 'function') gmApiHay().then(async (si) => { if (!si || GMS.sala !== id) return; try { const d = await (await fetch(TIENDA_URL + 'gmod/sala/' + encodeURIComponent(id))).json(); let nuevos = 0; for (const x of d.l || []) { const it = gmsItem(x); if (it && !GMS.lista.has(it.id)) { GMS.lista.set(it.id, it); nuevos++; } } if (nuevos) { gmsGuardarLocal(); gmsMontarTodos(); } } catch (e) {} });
  gmsMontarTodos();
  // (si a los 6 s nadie publicó la lista retenida o le falta algo, la publico yo)
  GMS.tPub = TIEMPO.t + 4 + Math.random() * 4; GMS.vioRetenido = false;
}
function gmsSalir() {
  for (const w of GMS.montados) if (!(PREFS.gmod && PREFS.gmod[w])) { try { gmDesmontar(w); } catch (e) {} }
  GMS.montados.clear(); GMS.sala = ''; const c = $('gmNotis'); if (c) c.innerHTML = '';
}
// bajar (o tomar de la caché) y montar los addons del server; los que ya tengo instalados no se tocan
// (lo que no está en la caché se baja sólo si pesa hasta 300 MB: la lista retenida la puede escribir cualquiera de la sala)
async function gmsMontarTodos() {
  const C = censOficial() && typeof gmCatalogo === 'function' ? await gmCatalogo().catch(() => null) : null;
  for (const it of [...GMS.lista.values()]) {
    if (GMOD.addons.has(it.id) || it.grande) continue;
    // (en un server oficial no se monta un mod censurado aunque esté en la lista: ni por su nombre, ni por el catálogo, ni por sus archivos)
    if (censOficial() && (censModMotivo(it) || censModMotivo(C && C.porId.get(String(it.id))))) { it.cens = true; continue; }
    try {
      let b = await gmCacheLeer(it.id);
      if (!b || !(b instanceof Blob || gmEsGMA(b))) {
        const [d] = await gmDetallesCompactos([it.id]); if (!d) continue;
        if (d.mb > 300) { it.grande = true; continue; }
        aviso(T('gm.bajando') + ': ' + it.n, 2); b = await gmBajar(it.id);
      }
      if (GMS.sala !== gmsClave() || !GMS.lista.has(it.id) || GMOD.addons.has(it.id)) continue;
      const G = await gmaDeCache(it.id, b); if (!G) continue;
      if (censOficial() && censModMotivo({ archivos: G.archivos ? [...G.archivos.keys()] : [] })) { it.cens = true; continue; }
      if (GMOD.addons.has(it.id)) continue;
      gmMontar(it.id, G, { nombre: it.n, img: it.img, srv: true }); GMS.montados.add(it.id);
    } catch (e) { gmErr('server ' + it.id, e); }
  }
  if (SMOD.abierto && SMOD.filtro === 'gmod') smDibujar();
}
// publicar la lista (retenida en la sala) y guardarla en la tienda
function gmsPublicarLista() { publicar('gl', { l: [...GMS.lista.values()].slice(0, 300) }, true); GMS.tPub = 0; }
function gmsActivar(it, guardarTienda) {
  if (!it || GMS.lista.has(it.id)) return;
  GMS.lista.set(it.id, it); gmsGuardarLocal(); gmsMontarTodos();
  if (guardarTienda && typeof gmApiHay === 'function') gmApiHay().then((si) => { if (si) fetch(TIENDA_URL + 'gmod/sala/' + encodeURIComponent(GMS.sala), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, n: it.n }) }).catch(() => {}); });
}

// ---- votación ----
function gmsSolicitar(x) {
  if (!SALA || !RED.on) { aviso(T('sm.tit'), 2); return; }
  const it = gmsItem(x); if (!it) return;
  if (censOficial() && censModMotivo(x)) { censModAviso(); return; }   // (en los oficiales no se pide un mod censurado)
  if (GMS.lista.has(it.id)) { aviso(T('gm.enServer'), 2); return; }
  if ([...GMS.votos.values()].some((v) => v.w === it.id && !v.fin)) { aviso(T('gm.yaPedido'), 2); return; }
  const v = Math.random().toString(36).slice(2, 10), e = [RED.ID, ...RED.remotos.keys()].slice(0, 64);
  const d = { k: 'pide', v, w: it.id, n: it.n, img: it.img, mb: +x.mb || 0, j: PREFS.nombre, e };
  publicar('g', d); gmsRecibirPide(Object.assign({ i: RED.ID }, d), true);
  aviso(T('gm.pedido'), 2.5);
}
function gmsRecibirPide(d, mio) {
  const it = gmsItem({ id: d.w, n: d.n, img: d.img }); if (!it || GMS.lista.has(it.id) || GMS.votos.has(d.v) || !/^[a-z0-9]{4,12}$/.test(String(d.v))) return;
  if (censOficial() && censModMotivo({ n: d.n })) return;
  if ([...GMS.votos.values()].filter((v) => v.de === d.i && !v.fin).length >= 3) return;   // (como mucho tres pedidos abiertos por jugador)
  const e = new Set((Array.isArray(d.e) ? d.e : []).filter((x) => typeof x === 'string').slice(0, 64)); e.add(d.i);
  const V = { v: d.v, w: it.id, it, mb: +d.mb || 0, j: limpio(d.j, 16), de: d.i, e, si: new Set([d.i]), no: new Set(), t0: TIEMPO.t, fin: false, mio: !!mio, yo: mio ? 'si' : '' };
  GMS.votos.set(d.v, V); gmsNoti(V); gmsDecidir(V);
}
function gmsVotar(v, si) {
  const V = GMS.votos.get(v); if (!V || V.fin || V.yo) return;
  V.yo = si ? 'si' : 'no'; (si ? V.si : V.no).add(RED.ID); V.e.add(RED.ID);
  publicar('g', { k: 'voto', v, si: !!si }); gmsNoti(V); gmsDecidir(V);
}
function gmsDecidir(V, porTiempo) {
  if (V.fin) return;
  const n = V.e.size, si = V.si.size, no = V.no.size;
  let ok = null;
  if (si > n / 2) ok = true; else if (no >= n / 2 && n > 1) ok = false;
  else if (porTiempo) ok = si > no;
  if (ok === null) return;
  V.fin = true; V.ok = ok;
  // (el que pidió avisa el resultado a todos; los demás llegan solos a lo mismo con los mismos votos)
  if (V.mio) publicar('g', { k: 'fin', v: V.v, ok, w: V.w, n: V.it.n, img: V.it.img });
  if (ok) { gmsActivar(V.it, V.mio); if (V.mio) gmsPublicarLista(); aviso(T('gm.activado') + ': ' + V.it.n, 4); sonar('Click', null, 0.7, 1.35); }
  else aviso(T('gm.rechazado') + ': ' + V.it.n, 3);
  gmsNoti(V); setTimeout(() => { const el = document.querySelector(`.gmNoti[data-v="${V.v}"]`); if (el) el.remove(); }, 5000);
  if (SMOD.abierto && SMOD.filtro === 'gmod') smDibujar();
}
// mensajes de la sala (red.js): pide, voto, fin, y la lista retenida
function gmSrvMensaje(c, d) {
  if (!GMS.sala) gmsEntrar();
  if (c === 'gl') {
    GMS.vioRetenido = true; let nuevos = 0; const suya = new Set();
    for (const x of Array.isArray(d.l) ? d.l.slice(0, 300) : []) { const it = gmsItem(x); if (!it) continue; suya.add(it.id); if (!GMS.lista.has(it.id)) { GMS.lista.set(it.id, it); nuevos++; } }
    if (nuevos) { gmsGuardarLocal(); gmsMontarTodos(); }
    if ([...GMS.lista.keys()].some((k) => !suya.has(k))) GMS.tPub = TIEMPO.t + 1 + Math.random() * 3;   // (a la retenida le falta algo: la completo)
    else GMS.tPub = 0;
    return;
  }
  if (d.k === 'pide') gmsRecibirPide(d, false);
  else if (d.k === 'voto') { const V = GMS.votos.get(d.v); if (!V || V.fin) return; V.e.add(d.i); (d.si ? V.si : V.no).add(d.i); (d.si ? V.no : V.si).delete(d.i); gmsNoti(V); gmsDecidir(V); }
  else if (d.k === 'fin') {
    const V = GMS.votos.get(d.v); if (V && V.de !== d.i) return;   // (sólo vale el del que pidió)
    if (V) { if (!V.fin) { V.fin = true; V.ok = !!d.ok; if (V.ok) { gmsActivar(V.it, false); aviso(T('gm.activado') + ': ' + V.it.n, 4); } else aviso(T('gm.rechazado') + ': ' + V.it.n, 3); gmsNoti(V); setTimeout(() => { const el = document.querySelector(`.gmNoti[data-v="${V.v}"]`); if (el) el.remove(); }, 5000); } }
    else if (d.ok) gmsActivar(gmsItem({ id: d.w, n: d.n, img: d.img }), false);
  }
}
// cada cuadro: entrar/salir de la sala, votaciones que vencen (60 s) y republicar la lista si hace falta
function gmsPaso() {
  const id = gmsClave();
  if (id && RED.on && id !== GMS.sala) gmsEntrar(); else if (!id && GMS.sala) gmsSalir();
  if (!GMS.sala) return;
  for (const V of GMS.votos.values()) {
    if (!V.fin && TIEMPO.t - V.t0 > 60) gmsDecidir(V, true);
    if (!V.fin) { const b = document.querySelector(`.gmNoti[data-v="${V.v}"] .gmNotiT`); if (b) b.textContent = Math.max(0, Math.ceil(60 - (TIEMPO.t - V.t0))) + 's'; }
  }
  if (GMS.tPub && TIEMPO.t > GMS.tPub && RED.on) { if (GMS.lista.size) gmsPublicarLista(); GMS.tPub = 0; }
}

// ---- el aviso que llega a todos: tocarlo muestra el addon con Aceptar y Rechazar ----
function gmsNoti(V) {
  let c = $('gmNotis'); if (!c) { c = document.createElement('div'); c.id = 'gmNotis'; document.body.appendChild(c); c.addEventListener('pointerdown', (e) => { e.stopPropagation(); const b = e.target.closest('[data-gms]'); const n = e.target.closest('.gmNoti'); if (b) { e.preventDefault(); const [a, v] = b.dataset.gms.split(':'); if (a === 'si') gmsVotar(v, true); else if (a === 'no') gmsVotar(v, false); else if (a === 'x') { const el = c.querySelector(`.gmNoti[data-v="${v}"]`); if (el) el.remove(); } return; } if (n) n.classList.toggle('abierta'); }); }
  let el = c.querySelector(`.gmNoti[data-v="${V.v}"]`);
  if (!el) { el = document.createElement('div'); el.className = 'gmNoti'; el.dataset.v = V.v; c.prepend(el); while (c.children.length > 4) c.lastChild.remove(); if (!V.mio) sonar('Click', null, 0.6, 1.1); }
  const n = V.e.size, img = V.it.img ? `<img src="${esc(V.it.img)}" alt="" referrerpolicy="no-referrer">` : `<img src="${GM_ICO}" alt="">`;
  const estado = V.fin ? `<b class="${V.ok ? 'ok' : 'mal'}">${esc(T(V.ok ? 'gm.activado' : 'gm.rechazado'))}</b>` : `${glifo('si')} ${V.si.size} · ${glifo('no')} ${V.no.size} · ${glifo('gente')} ${n} <i class="gmNotiT"></i>`;
  el.classList.toggle('fin', V.fin);
  el.innerHTML = `<div class="gmNotiCab">${img}<span><b dir="auto">${esc(T('gm.pide').replace('{j}', V.j || '?').replace('{n}', V.it.n))}</b><small>${V.fin || V.yo ? estado : esc(T('gm.toca')) + ' · ' + estado}</small></span><button class="gmNotiX" data-gms="x:${V.v}">×</button></div>
    <div class="gmNotiCuerpo">${img}<div><b dir="auto">${esc(V.it.n)}</b><small>${V.mb ? V.mb + ' MB · ' : ''}${esc(T('gm.votando'))}</small>
      ${V.fin || V.yo ? `<p>${estado}</p>` : `<div class="gmNotiBt"><button class="boton" data-gms="si:${V.v}">${glifo('si')} ${esc(T('gm.aceptar'))}</button><button class="boton gris" data-gms="no:${V.v}">${glifo('no')} ${esc(T('gm.rechazar'))}</button></div>`}</div></div>`;
}

// ---- la categoría "GMod del server" del panel SM: lo activo y el buscador del Workshop con Solicitar ----
function gmsBuscar(desdeCero) {
  const n = ++GMS.n; if (desdeCero) { GMS.p = 0; GMS.items = []; }
  GMS.cargando = true; GMS.error = false;
  (async () => {
    for (let k = 0; k < 4; k++) {
      const d = await gmBuscar({ q: GMS.q, orden: 'subs', p: GMS.p + 1, soloDir: true }); if (n !== GMS.n) return;
      const vistos = new Set(GMS.items.map((x) => x.id)); GMS.items = GMS.items.concat((d.items || []).filter((x) => x.dir === true && !vistos.has(x.id) && !(typeof gmNoCompat === 'function' && gmNoCompat(x))));
      GMS.total = d.total || 0; GMS.p++; if (GMS.items.length >= 12 * (1 + Math.floor(GMS.p / 4)) || !(d.items || []).length) break;
    }
    GMS.cargando = false; if (SMOD.abierto && SMOD.filtro === 'gmod') smDibujar();
  })().catch(() => { if (n !== GMS.n) return; GMS.cargando = false; GMS.error = true; if (SMOD.abierto && SMOD.filtro === 'gmod') smDibujar(); });
}
function gmsListaHTML() {
  const q = SMOD.q.trim();
  if (q !== GMS.q) { clearTimeout(GMS.tq); GMS.tq = setTimeout(() => { GMS.q = q; gmsBuscar(true); }, 450); }
  else if (!GMS.items.length && !GMS.cargando && !GMS.error) gmsBuscar(true);
  const votando = new Set([...GMS.votos.values()].filter((v) => !v.fin).map((v) => v.w));
  const fila = (x, act) => `<div class="smIt gmsIt${act ? ' on' : ''}"><span class="smIco">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<img src="${GM_ICO}" alt="">`}</span><span class="smTx"><b dir="auto">${esc(x.n || x.t)}</b>
    <small>${x.subs ? `${glifo('gente')} ${gmCifra(x.subs)} · ` : ''}${x.mb ? x.mb + ' MB' : ''}</small></span>
    ${act ? `<em class="gmsEst">${esc(T('gm.enServer'))}</em>` : votando.has(x.id) ? `<em class="gmsEst">${esc(T('gm.votando'))}</em>` : `<button class="boton chico" data-sm="gms:${esc(x.id)}">${esc(T('gm.solicitar'))}</button>`}</div>`;
  const act = [...GMS.lista.values()];
  return `<p class="gmsAyuda">${esc(T('gm.srvAyuda'))}</p>`
    + (act.length ? `<div class="gmsSecc">${esc(T('gm.enServer'))} <em>${act.length}</em></div>` + act.map((x) => fila(x, true)).join('') : '')
    + `<div class="gmsSecc">${esc(T('gm.tit'))}${GMS.total ? ` <em>${gmCifra(GMS.total)}</em>` : ''}</div>`
    + GMS.items.filter((x) => !GMS.lista.has(x.id)).map((x) => fila(x, false)).join('')
    + (GMS.cargando ? `<div class="radioVacio">${esc(T('cargando'))}</div>` : GMS.error ? `<div class="radioVacio">${esc(T('gm.puente'))}</div>` : `<button class="boton chico gris gmsMas" data-sm="gmsmas">${glifo('mas3')}</button>`);
}
function gmsAccion(a, v) {
  if (a === 'gms') { const x = GMS.items.find((y) => y.id === v); if (x) gmsSolicitar(Object.assign({}, x, { n: x.t })); smDibujar(); return true; }
  if (a === 'gmsmas') { gmsBuscar(false); smDibujar(); return true; }
  return false;
}
if (typeof module !== 'undefined') module.exports = { GMS, gmsDecidir, gmSrvMensaje };
