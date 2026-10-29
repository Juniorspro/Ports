// ---------------- emotes nuevos (bailes, gestos y acrobacias) y los que hace la gente ----------------
// Cada uno es una lista de rotaciones locales de los huesos del juego (y el movimiento de la cadera) cuadro a cuadro,
// sacada de animaciones de un esqueleto tipo mixamo (herramientas/emote_meshy.py) o hecha en el editor de animaciones.
// Se ponen encima de la animación de parado (los dedos y lo que el clip no mueve siguen igual), con entrada y salida
// suaves; los bailes se repiten y los de un tiro terminan solos. Se llaman "rb:Id" (los del paquete) o "u:Id" (hechos
// por la gente, guardados o bajados de la tienda).
const EMO = { clips: {}, remotos: {}, cat: 'todos', pedidos: {}, ti: { items: [], cargando: false, error: false, q: '', n: 0 } };
// un clip del paquete ("rb:"), uno instalado o hecho por vos ("u:": INST.anims) o el de otro jugador que llegó por la red
function emoClip(id) {
  if (EMO.clips[id]) return EMO.clips[id];
  let c = null;
  if (id.startsWith('rb:') && DATA.emo && DATA.emo[id.slice(3)]) c = DATA.emo[id.slice(3)];
  else if (id.startsWith('u:')) { const k = id.slice(2), v = (typeof INST !== 'undefined' && INST.anims && INST.anims[k]) || EMO.remotos[k]; if (v && v.clip) c = Object.assign({ n: v.nombre }, v.clip); }
  if (!c) return null;
  const a16 = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Int16Array(u.buffer); };
  const r = typeof c.r === 'string' ? a16(c.r) : Int16Array.from(c.r), h = c.h ? (typeof c.h === 'string' ? a16(c.h) : Int16Array.from(c.h)) : null;
  return (EMO.clips[id] = { id, n: c.n, fps: c.fps || 20, nf: c.nf, b: c.b, r, h, loop: !!c.loop, d: (c.nf - 1) / (c.fps || 20) });
}
const emoOlvidar = (id) => { delete EMO.clips[id]; };
const emoValido = (e) => typeof e === 'string' && (DATA.emotes.includes(e) || !!emoClip(e));
// índices de los huesos del clip en un personaje (por nombre, sin el prefijo de mixamo)
function emoIndices(P, C) {
  const D = P.D, k = C.b.join(',');
  if (!D.emoI) D.emoI = {};
  if (D.emoI[k]) return D.emoI[k];
  const porNombre = {}; D.sub.forEach((n, i) => { const m = /^mixamorig\d*:(.*)$/.exec(n.n); if (m && porNombre[m[1]] === undefined) porNombre[m[1]] = i; });
  return (D.emoI[k] = C.b.map((b) => (porNombre[b] === undefined ? -1 : porNombre[b])));
}
const _qe = new Quat(), _qf = new Quat(), _qg = new Quat();
// la pose del emote en el cuadro de ahora (lo llama animarPersona después de la animación de parado)
function emoPose(P, dt) {
  const e = P.emote; if (!e || !(e.startsWith('rb:') || e.startsWith('u:'))) return;
  const C = emoClip(e); if (!C) return;
  const t = P.emoteT || 0, md = P.md, idx = emoIndices(P, C), nb = C.b.length;
  if (!C.loop && t >= C.d) { if (P === JUG.cuerpo || !P.remoto) P.emote = null; return; }
  let w = ss01(clamp(t / 0.25, 0, 1)); if (!C.loop) w *= 1 - ss01(clamp((t - (C.d - 0.3)) / 0.3, 0, 1));
  let f = t * C.fps; if (C.loop) f %= (C.nf - 1); else f = Math.min(f, C.nf - 1.001);
  const f0 = Math.floor(f), f1 = Math.min(C.nf - 1, f0 + 1), a = f - f0, R = C.r;
  for (let k = 0; k < nb; k++) {
    const i = idx[k]; if (i < 0) continue;
    const o0 = (f0 * nb + k) * 4, o1 = (f1 * nb + k) * 4;
    _qe.set(R[o0] / 32767, R[o0 + 1] / 32767, R[o0 + 2] / 32767, R[o0 + 3] / 32767).norm();
    _qf.set(R[o1] / 32767, R[o1 + 1] / 32767, R[o1 + 2] / 32767, R[o1 + 3] / 32767).norm();
    _qe.slerpTo(_qf, a);
    const r = md.r[i]; _qg.set(r[0], r[1], r[2], r[3]).slerpTo(_qe, w); r[0] = _qg.x; r[1] = _qg.y; r[2] = _qg.z; r[3] = _qg.w;
  }
  // la cadera: su lugar de reposo más lo que se mueve en el clip
  const hi = idx[C.b.indexOf('Hips')];
  if (C.h && hi >= 0) {
    const b0 = P.D.sub[hi].p, o0 = f0 * 3, o1 = f1 * 3, p = md.p[hi];
    for (let c = 0; c < 3; c++) { const v = (C.h[o0 + c] + (C.h[o1 + c] - C.h[o0 + c]) * a) / 1000; p[c] = p[c] + (b0[c] + v - p[c]) * w; }
  }
  md.sucio = true;
}
// ---------------- el panel de emotes: categorías, miniaturas, los tuyos y los de la tienda ----------------
const EMO_CATS = ['todos', 'baile', 'gesto', 'accion', 'clasico', 'mio', 'tienda'];
const emoNom = (id, n) => { const k = id.startsWith('rb:') ? 'em.' + id.slice(3) : 'emc.' + id, t = T(k); return t === k ? n || id : t; };
// los que se pueden elegir: los del juego (clásicos), los nuevos del paquete y los tuyos (hechos o bajados de la tienda)
function emoLista() {
  const l = DATA.emotes.map((e) => ({ id: e, n: emoNom(e, e), cat: 'clasico', ico: 'emo_' + e }));
  for (const [k, c] of Object.entries(DATA.emo || {})) l.push({ id: 'rb:' + k, n: emoNom('rb:' + k, c.n), cat: c.cat || (c.loop ? 'baile' : 'gesto'), ico: 'emo_' + k });
  for (const [k, v] of Object.entries((typeof INST !== 'undefined' && INST.anims) || {})) l.push({ id: 'u:' + k, n: v.nombre, cat: v.cat || 'baile', mio: true, foto: v.foto, local: /^local-/.test(k), autor: v.autor });
  return l;
}
const emoIcoCat = (c) => icoHTML('ico:' + (c === 'gesto' ? 'emote' : c === 'accion' ? 'salto' : 'musica'));
function emoTarjeta(e) {
  const img = e.foto ? `<img src="${esc(e.foto)}" alt="">` : DATA.ico[e.ico] ? `<img src="${icono(e.ico)}" alt="" loading="lazy">` : emoIcoCat(e.cat);
  const k = e.mio ? e.id.slice(2) : '';
  return `<div class="emoIt${e.mio ? ' mio' : ''}" data-emo="${esc(e.id)}">${img}<b dir="auto">${esc(e.n)}</b>${e.mio ? `<small>${esc(e.local ? T('emo.hecho') : T('por') + ' ' + (e.autor || ''))}</small>
    <span class="emoMis"><button data-emed="${esc(k)}" title="${esc(T('emo.editar'))}">${glifo('lapiz')}</button><button data-emdel="${esc(k)}" title="${esc(T('quitar'))}">${glifo('basura')}</button></span>` : ''}</div>`;
}
function emoDibujar() {
  const el = $('emoLista'); if (!el) return;
  const pan = $('emotes'), tabs = pan.querySelector('.emoTabs');
  if (tabs && !tabs.childElementCount) {
    tabs.innerHTML = EMO_CATS.map((c) => `<button data-emc="${c}">${esc(T('emo.' + c))}</button>`).join('');
    tabs.onclick = (ev) => { const b = ev.target.closest('[data-emc]'); if (!b) return; EMO.cat = b.dataset.emc; emoDibujar(); };
    el.onclick = (ev) => {
      const b = ev.target.closest('[data-emi]'); if (b) { ev.stopPropagation(); emoInstalar(b.dataset.emi); return; }
      const ed = ev.target.closest('[data-emed]'); if (ed) { ev.stopPropagation(); cerrarPaneles(); edaAbrir(ed.dataset.emed); return; }
      const del = ev.target.closest('[data-emdel]'); if (del) { ev.stopPropagation(); if (!confirm(T('quitar') + '?')) return; delete INST.anims[del.dataset.emdel]; emoOlvidar('u:' + del.dataset.emdel); guardarLS('rb_instalados', INST); emoDibujar(); return; }
      const x = ev.target.closest('[data-emo]'); if (!x) return; cerrarPaneles(); if (typeof emote === 'function') emote(x.dataset.emo);
    };
    const cr = $('bEmoCrear'); if (cr) cr.onclick = () => { cerrarPaneles(); if (typeof edaAbrir === 'function') edaAbrir(); };
  }
  if (tabs) tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.emc === EMO.cat));
  const cr = $('bEmoCrear'); if (cr) cr.innerHTML = `${glifo('lapiz')} ${esc(T('emo.crear'))}`;
  const cer = $('bEmoCerrar'); if (cer) cer.textContent = T('cerrar');
  if (EMO.cat === 'tienda') { emoTienda(el); return; }
  const L = emoLista().filter((e) => EMO.cat === 'todos' || (EMO.cat === 'mio' ? e.mio : e.cat === EMO.cat && !(e.mio && EMO.cat === 'clasico')));
  el.innerHTML = L.map(emoTarjeta).join('') || `<div class="emoVacio">${esc(T(EMO.cat === 'mio' ? 'emo.sinMios' : 'sinRes'))}</div>`;
}
// la tienda adentro del juego: las animaciones que publicó la gente (se instalan y quedan en "Míos")
function emoTienda(el) {
  const S = EMO.ti;
  if (!el.querySelector('.emoBus')) {
    el.innerHTML = `<div class="emoBus">${glifo('buscar')}<input maxlength="40" spellcheck="false" placeholder="${esc(T('buscar'))}"></div><div class="emoTi"></div>`;
    const q = el.querySelector('input'); q.value = S.q; q.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') { S.q = q.value.trim(); emoTiendaCargar(); } };
    if (!S.items.length && !S.cargando) emoTiendaCargar();
  }
  const G = el.querySelector('.emoTi'), inst = (typeof INST !== 'undefined' && INST.anims) || {};
  G.innerHTML = S.cargando ? `<div class="emoVacio">${esc(T('cargando'))}</div>` : S.error ? `<div class="emoVacio">${esc(T('errRed'))}</div>` : !S.items.length ? `<div class="emoVacio">${esc(T('sinRes'))}</div>`
    : S.items.map((it) => `<div class="emoIt" ${inst[it.id] ? `data-emo="u:${esc(it.id)}"` : ''}>${it.icono ? `<img src="${esc(it.icono)}" alt="">` : emoIcoCat(it.base)}<b dir="auto">${esc(it.nombre)}</b><small dir="auto">${esc(T('por') + ' ' + it.autor)} · ${glifo('bajar')}${it.descargas}</small>
      ${inst[it.id] ? `<i class="emoYa">${glifo('si')}</i>` : `<button class="emoInst" data-emi="${esc(it.id)}">${glifo('bajar')} ${esc(T('instalar'))}</button>`}</div>`).join('');
}
function emoTiendaCargar() {
  const S = EMO.ti, n = ++S.n; S.cargando = true; S.error = false; emoDibujar();
  fetch(`${TIENDA_URL}lista?tipo=anim&q=${encodeURIComponent(S.q)}&orden=pop&p=0`).then((r) => r.json()).then((d) => { if (n !== S.n) return; S.items = (d.items || []).filter((x) => /^[a-z0-9]{8}$/.test(x.id)); S.cargando = false; if (EMO.cat === 'tienda') emoDibujar(); })
    .catch(() => { if (n !== S.n) return; S.cargando = false; S.error = true; if (EMO.cat === 'tienda') emoDibujar(); });
}
// bajar una animación de la tienda (validada) y dejarla instalada
async function emoInstalar(id) {
  try {
    const v = validarRB(await (await fetch(TIENDA_URL + 'item/' + id)).json());
    if (typeof v === 'string' || v.formato !== 'rezobox-anim') { aviso(T('errFormato'), 2); return null; }
    v.id = id; v.remoto = true; INST.anims[id] = v; guardarLS('rb_instalados', INST); emoOlvidar('u:' + id);
    aviso(T('instalado') + ': ' + v.nombre, 2); if (UI.abierto === 'emotes') emoDibujar(); return v;
  } catch (e) { aviso(T('errRed'), 2); return null; }
}
// ---------------- en la sala: los emotes hechos por la gente viajan como datos ----------------
// Los de la tienda se bajan de ahí; los que hiciste vos y no publicaste se los pasás al que los pide (una vez).
const EMO_ID = /^u:[a-z0-9-]{3,30}$/;
function emoPedir(id, de) {
  const k = id.slice(2); if (emoClip(id) || EMO.pedidos[k] > TIEMPO.t) return;
  EMO.pedidos[k] = TIEMPO.t + 20;
  if (/^[a-z0-9]{8}$/.test(k)) fetch(TIENDA_URL + 'item/' + k).then((r) => r.json()).then((d) => { const v = validarRB(d); if (typeof v === 'object' && v.formato === 'rezobox-anim') { EMO.remotos[k] = v; emoOlvidar(id); } }).catch(() => {});
  else if (typeof publicar === 'function') publicar('a', { k: 'animq', a: k, to: de });
}
function emoRed(d) {
  if (d.k === 'animq' && d.to === RED.ID && typeof d.a === 'string') {
    const v = INST.anims[d.a]; if (!v || !v.clip) return;
    const js = JSON.stringify(v.clip); if (js.length > 200000) return; // (las muy largas sólo por la tienda)
    publicar('a', { k: 'anim', a: d.a, d: { nombre: v.nombre, cat: v.cat, clip: v.clip } });
  } else if (d.k === 'anim' && typeof d.a === 'string' && /^[a-z0-9-]{3,30}$/.test(d.a) && d.d && !EMO.remotos[d.a]) {
    const v = validarRB(Object.assign({}, d.d, { formato: 'rezobox-anim', nombre: d.d.nombre || 'anim' }));
    if (typeof v === 'object') { EMO.remotos[d.a] = v; emoOlvidar('u:' + d.a); }
  }
}
