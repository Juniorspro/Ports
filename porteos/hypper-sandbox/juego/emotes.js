// ---------------- emotes nuevos (bailes, gestos y acrobacias) y los que hace la gente ----------------
// Cada uno es una lista de rotaciones locales de los huesos del juego (y el movimiento de la cadera) cuadro a cuadro,
// sacada de animaciones de un esqueleto tipo mixamo (herramientas/emote_meshy.py) o hecha en el editor de animaciones.
// Se ponen encima de la animación de parado (los dedos y lo que el clip no mueve siguen igual), con entrada y salida
// suaves; los bailes se repiten y los de un tiro terminan solos. Se llaman "rb:Id" (los del paquete) o "u:Id" (hechos
// por la gente, guardados o bajados de la tienda).
const EMO = { clips: {}, remotos: {}, cat: 'todos', pedidos: {}, ti: { items: [], cargando: false, error: false, q: '', n: 0 }, cargas: {}, q: '', lim: 120 };
// ---------------- los de captura de movimiento (CMU, 2548): fuera del HTML, se bajan cuando se eligen ----------------
// El catálogo (id, nombre, categoría, duración, si se repite) va adentro; cada uno es un archivo chico (herramientas/
// emote_bvh.py) que se busca al lado del HTML (en githack es la misma rama) o en githack, y queda guardado en el navegador
const CMU_CAT = /*CMUCAT*/null;
const CMU_I = CMU_CAT ? Object.fromEntries(CMU_CAT.items.map((x) => [x[0], x])) : {};
const EMO_BASES = ['emotes/cmu/', 'https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/hypper/emotes/cmu/', 'https://raw.githack.com/Juniorspro/Ports/main/hypper/emotes/cmu/'];
async function emoBajar(k) {
  let cache = null; try { if (window.caches && location.protocol === 'https:') cache = await caches.open('rb-emotes-1'); } catch (e) {}
  for (const b of EMO_BASES) {
    if (location.protocol === 'file:' && !/^https?:/.test(b)) continue;   // (abierto como archivo, el navegador no deja leer al lado)
    const url = new URL(b + k + '.bin', location.href).href;
    try {
      let r = cache && (await cache.match(url));
      if (!r) { r = await fetch(url); if (!r.ok) continue; if (cache) cache.put(url, r.clone()).catch(() => {}); }
      return await desgz(new Uint8Array(await r.arrayBuffer()));
    } catch (e) {}
  }
  return null;
}
// 'RBE2', cuadros (u16), fps, se repite, huesos (índices en CMU_CAT.huesos); las rotaciones (×8191) y la cadera (mm) como
// diferencias int16 con los bytes en planos (todos los bajos, después los altos)
function emoBin(k, u) {
  if (!u || u.length < 10 || u[0] !== 82 || u[1] !== 66 || u[2] !== 69 || u[3] !== 50) return null;
  const nf = u[4] | u[5] << 8, fps = u[6], nb = u[8], H = CMU_CAT.huesos, b = [];
  for (let i = 0; i < nb; i++) b.push(H[u[9 + i]]);
  const n = nf * nb * 4, m = nf * 3, o = 9 + nb, F = nb * 4;
  if (u.length < o + (n + m) * 2) return null;
  const r = new Int16Array(n), h = new Int16Array(m), acc = new Int16Array(F);
  for (let i = 0; i < n; i++) { const d = (u[o + i] | u[o + n + i] << 8) << 16 >> 16, j = i % F; acc[j] += d; r[i] = acc[j] * 4; }   // (se envuelve igual que al guardar)
  const o2 = o + 2 * n; let a0 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < m; i++) { const d = (u[o2 + i] | u[o2 + m + i] << 8) << 16 >> 16, c = i % 3; h[i] = c === 0 ? (a0 = (a0 + d) << 16 >> 16) : c === 1 ? (a1 = (a1 + d) << 16 >> 16) : (a2 = (a2 + d) << 16 >> 16); }
  return { id: 'c:' + k, n: CMU_I[k][1], fps, nf, b, r, h, loop: !!u[7], d: (nf - 1) / fps };
}
function emoCargar(id) {
  if (EMO.clips[id]) return Promise.resolve(EMO.clips[id]);
  if (EMO.cargas[id]) return EMO.cargas[id];
  const k = id.slice(2); if (!CMU_I[k]) return Promise.resolve(null);
  return (EMO.cargas[id] = emoBajar(k).then((u) => { const c = emoBin(k, u); delete EMO.cargas[id]; if (c) EMO.clips[id] = c; return c; }));
}
// un clip del paquete ("rb:"), uno instalado o hecho por vos ("u:": INST.anims) o el de otro jugador que llegó por la red
function emoClip(id) {
  if (EMO.clips[id]) return EMO.clips[id];
  if (id.startsWith('c:')) { emoCargar(id); return null; }
  let c = null;
  if (id.startsWith('rb:') && DATA.emo && DATA.emo[id.slice(3)]) c = DATA.emo[id.slice(3)];
  else if (id.startsWith('u:')) { const k = id.slice(2), v = (typeof INST !== 'undefined' && INST.anims && INST.anims[k]) || EMO.remotos[k]; if (v && v.clip) c = Object.assign({ n: v.nombre }, v.clip); }
  if (!c) return null;
  const a16 = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Int16Array(u.buffer); };
  const r = typeof c.r === 'string' ? a16(c.r) : Int16Array.from(c.r), h = c.h ? (typeof c.h === 'string' ? a16(c.h) : Int16Array.from(c.h)) : null;
  return (EMO.clips[id] = { id, n: c.n, fps: c.fps || 20, nf: c.nf, b: c.b, r, h, loop: !!c.loop, d: (c.nf - 1) / (c.fps || 20) });
}
const emoOlvidar = (id) => { delete EMO.clips[id]; };
const emoValido = (e) => typeof e === 'string' && (DATA.emotes.includes(e) || (e.startsWith('c:') && !!CMU_I[e.slice(2)]) || !!emoClip(e));
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
  const e = P.emote; if (!e || !(e.startsWith('rb:') || e.startsWith('u:') || e.startsWith('c:'))) return;
  const C = emoClip(e); if (!C) return;
  const t = P.emoteT || 0;
  if (!C.loop && t >= C.d) { if (P === JUG.cuerpo || !P.remoto) P.emote = null; return; }
  let w = ss01(clamp(t / 0.25, 0, 1)); if (!C.loop) w *= 1 - ss01(clamp((t - (C.d - 0.3)) / 0.3, 0, 1));
  let f = t * C.fps; if (C.loop) f %= (C.nf - 1); else f = Math.min(f, C.nf - 1.001);
  emoAplicar(P, C, f, w);
}
// el cuadro f (con fracción) de un clip sobre la pose que ya tiene la persona, con peso w
function emoAplicar(P, C, f, w) {
  const md = P.md, idx = emoIndices(P, C), nb = C.b.length;
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
// ---------------- nadar ----------------
// dos capturas de CMU: la brazada de pecho acostado (126_04, sobre un banquito) y la brazada parado (79_02: flotando en
// el lugar), mezcladas por la velocidad; cada una en el tramo que mejor se repite (el cuadro de la vuelta, parecido al
// del principio)
const NADO = { nada: 'c:126_04', flota: 'c:79_02' };
function emoBucle(C) {
  if (C.bucle) return C.bucle;
  const nb = C.b.length, R = C.r, min = Math.round(1.5 * C.fps), K = 1 / (32767 * 32767); let mejor = 1e9, par = [0, C.nf - 1];
  for (let a = 0; a < C.nf; a += 2) for (let b = a + min; b < C.nf; b += 2) {
    let s = 0; for (let k = 0; k < nb; k++) { const o0 = (a * nb + k) * 4, o1 = (b * nb + k) * 4; s += 1 - Math.abs(R[o0] * R[o1] + R[o0 + 1] * R[o1 + 1] + R[o0 + 2] * R[o1 + 2] + R[o0 + 3] * R[o1 + 3]) * K; }
    if (s < mejor) { mejor = s; par = [a, b]; }
  }
  return (C.bucle = par);
}
function nadoPose(P, dt) {
  const k = P.nadoK || 0; if (k < 0.001 || P.emote) return;
  const A = emoClip(NADO.nada), B = emoClip(NADO.flota); if (!A || !B) return;   // (se bajan la primera vez)
  const sp = Math.hypot(P.vel.x, P.vel.z), ws = clamp((sp - 0.3) / 1.2, 0, 1);
  P.nadoW = (P.nadoW || 0) + (ws - (P.nadoW || 0)) * Math.min(1, dt * 4);
  P.nadoT = (P.nadoT || 0) + dt * (0.8 + Math.min(sp, 4) * 0.12);
  for (const [C, w] of [[B, 1], [A, P.nadoW]]) {
    if (w <= 0.001) continue;
    const [a, b] = emoBucle(C); emoAplicar(P, C, a + (P.nadoT * C.fps) % (b - a), w * k);
  }
}
// ---------------- el panel de emotes: categorías, miniaturas, los tuyos y los de la tienda ----------------
const EMO_CATS = ['todos', 'fav', 'rec', 'clasico', 'baile', 'gesto', 'accion', 'pelea', 'deporte', 'acrobacia', 'animal', 'caminar', 'otro', 'mio', 'tienda'];
const emoNom = (id, n) => { const k = id.startsWith('rb:') ? 'em.' + id.slice(3) : 'emc.' + id, t = T(k); return t === k ? n || id : t; };
// favoritos (la estrella) y los últimos que usaste, guardados en el navegador
const emoGuardados = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch (e) { return []; } };
EMO.fav = new Set(emoGuardados('rb_emo_fav')); EMO.rec = emoGuardados('rb_emo_rec');
function emoUsado(id) { EMO.rec = [id, ...EMO.rec.filter((x) => x !== id)].slice(0, 30); guardarLS('rb_emo_rec', EMO.rec); }
// los que se pueden elegir: los del juego (clásicos), los nuevos del paquete, los de captura de movimiento y los tuyos
function emoLista() {
  const l = DATA.emotes.map((e) => ({ id: e, n: emoNom(e, e), cat: 'clasico', ico: 'emo_' + e }));
  for (const [k, c] of Object.entries(DATA.emo || {})) l.push({ id: 'rb:' + k, n: emoNom('rb:' + k, c.n), cat: c.cat || (c.loop ? 'baile' : 'gesto'), ico: 'emo_' + k });
  for (const x of CMU_CAT ? CMU_CAT.items : []) l.push({ id: 'c:' + x[0], n: x[1].charAt(0).toUpperCase() + x[1].slice(1), cat: x[2], dur: x[3], cmu: true });
  for (const [k, v] of Object.entries((typeof INST !== 'undefined' && INST.anims) || {})) l.push({ id: 'u:' + k, n: v.nombre, cat: v.cat || 'baile', mio: true, foto: v.foto, local: /^local-/.test(k), autor: v.autor });
  return l;
}
const EMO_ICO = { gesto: 'emote', clasico: 'emote', accion: 'salto', pelea: 'boom', deporte: 'meta', acrobacia: 'impulso', animal: 'dino', caminar: 'veloz', otro: 'animacion' };
const emoIcoCat = (c) => icoHTML('ico:' + (EMO_ICO[c] || 'musica'));
function emoTarjeta(e) {
  const img = e.foto ? `<img src="${esc(e.foto)}" alt="">` : DATA.ico[e.ico] ? `<img src="${icono(e.ico)}" alt="" loading="lazy">` : `<div class="emoCatIco">${emoIcoCat(e.cat)}</div>`;
  const k = e.mio ? e.id.slice(2) : '', fav = EMO.fav.has(e.id);
  return `<div class="emoIt${e.mio ? ' mio' : ''}${e.cmu ? ' cmu' : ''}" data-emo="${esc(e.id)}">${img}<b dir="auto" title="${esc(e.n)}">${esc(e.n)}</b>${e.cmu ? `<small>${esc(T('emo.' + e.cat))} · ${Math.max(1, Math.round(e.dur))} s</small>` : ''}${e.mio ? `<small>${esc(e.local ? T('emo.hecho') : T('por') + ' ' + (e.autor || ''))}</small>
    <span class="emoMis"><button data-emed="${esc(k)}" title="${esc(T('emo.editar'))}">${glifo('lapiz')}</button><button data-emdel="${esc(k)}" title="${esc(T('quitar'))}">${glifo('basura')}</button></span>` : ''}<button class="emoEst${fav ? ' si' : ''}" data-emfav="${esc(e.id)}" title="${esc(T('emo.fav'))}">${glifo('estrella')}</button></div>`;
}
function emoDibujar() {
  const el = $('emoLista'); if (!el) return;
  const pan = $('emotes'), tabs = pan.querySelector('.emoTabs');
  if (tabs && !tabs.childElementCount) {
    tabs.innerHTML = EMO_CATS.map((c) => `<button data-emc="${c}">${esc(T('emo.' + c))}</button>`).join('');
    tabs.onclick = (ev) => { const b = ev.target.closest('[data-emc]'); if (!b) return; EMO.cat = b.dataset.emc; EMO.lim = 120; el.scrollTop = 0; emoDibujar(); };
    // el buscador (en todas las secciones menos la tienda, que busca en internet)
    const bus = document.createElement('div'); bus.className = 'emoBusca'; bus.innerHTML = `${glifo('buscar')}<input maxlength="40" spellcheck="false" placeholder="${esc(T('buscar'))}"><span class="emoCuenta"></span>`;
    tabs.parentNode.after(bus); const q = bus.querySelector('input');
    q.oninput = () => { EMO.q = q.value.trim().toLowerCase(); EMO.lim = 120; el.scrollTop = 0; emoDibujar(); }; q.onkeydown = (ev) => ev.stopPropagation();
    el.onclick = (ev) => {
      const fv = ev.target.closest('[data-emfav]'); if (fv) { ev.stopPropagation(); const id = fv.dataset.emfav; if (EMO.fav.has(id)) EMO.fav.delete(id); else EMO.fav.add(id); guardarLS('rb_emo_fav', [...EMO.fav]); fv.classList.toggle('si', EMO.fav.has(id)); if (EMO.cat === 'fav') emoDibujar(); return; }
      if (ev.target.closest('.emoMas')) { EMO.lim += 240; emoDibujar(); return; }
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
  const bus = pan.querySelector('.emoBusca'); if (bus) bus.style.display = EMO.cat === 'tienda' ? 'none' : '';
  if (EMO.cat === 'tienda') { emoTienda(el); return; }
  const todos = emoLista(), por = new Map(todos.map((e) => [e.id, e])), q = EMO.q;
  let L = EMO.cat === 'fav' ? [...EMO.fav].map((id) => por.get(id)).filter(Boolean) : EMO.cat === 'rec' ? EMO.rec.map((id) => por.get(id)).filter(Boolean)
    : todos.filter((e) => EMO.cat === 'todos' || (EMO.cat === 'mio' ? e.mio : e.cat === EMO.cat && !(e.mio && EMO.cat === 'clasico')));
  if (q) L = L.filter((e) => e.n.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
  const c = pan.querySelector('.emoCuenta'); if (c) c.textContent = L.length.toLocaleString(document.documentElement.lang || undefined) + ' ' + T('emo.n');
  // de a tandas (miles de tarjetas juntas traban el celular)
  el.innerHTML = L.slice(0, EMO.lim).map(emoTarjeta).join('') + (L.length > EMO.lim ? `<button class="boton emoMas">${esc(T('emo.mas'))} (${L.length - EMO.lim})</button>` : '')
    || `<div class="emoVacio">${esc(T(EMO.cat === 'mio' ? 'emo.sinMios' : EMO.cat === 'fav' ? 'emo.sinFav' : 'sinRes'))}</div>`;
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
