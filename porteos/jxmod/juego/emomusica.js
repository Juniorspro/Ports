// ---------------- música para los emotes (idea de Discord: «emotes con canciones de memes, como en Fortnite») ----------------
// En el panel de emotes cada tarjeta tiene ⋯ arriba: «Música» abre un buscador de YouTube (el mismo de la radio, con su
// filtro y la revisión de la IA), se elige un video y en el editor se marca desde dónde hasta dónde suena (hasta 60 s).
// Al hacer el emote suena esa parte, en bucle mientras dura. Los de la sala la oyen según la distancia: va con el estado
// del jugador ([video, desde, hasta]). Un solo reproductor de YouTube escondido para la música de emote que se oye: la
// tuya o, si no, la del que esté más cerca (hasta 30 m).
const EMU = { m: leerLS('rb_emo_musica', {}), ifr: null, src: null, vid: null, a: 0, b: 0, vol: -1, cur: 0, curT: 0, est: -1, t: 0, seekT: 0, reT: 0, ed: null };
const EMU_MAX = 60, EMU_LEJOS = 30;
const emuDe = (id) => { const x = id && EMU.m[id]; return x && ytId(x.v) === x.v && x.b > x.a ? x : null; };
const emuValida = (m) => Array.isArray(m) && m.length === 3 && typeof m[0] === 'string' && ytId(m[0]) === m[0] && Number.isFinite(+m[1]) && Number.isFinite(+m[2]) && +m[1] >= 0 && +m[1] < 36000 && +m[2] > +m[1] && +m[2] - +m[1] <= EMU_MAX + 1;
const emuMin = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function emuGuardar() { guardarLS('rb_emo_musica', EMU.m); }
// lo que va en el estado del jugador mientras hace un emote con música
function emuRed() { const P = JUG.cuerpo, x = P && P.emote && emuDe(P.emote); return x ? [x.v, +x.a.toFixed(1), +x.b.toFixed(1)] : 0; }
// ---- el reproductor escondido ----
function emuCmd(f, func, args) { try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); } catch (e) {} }
function emuIframe(v, a, b, controles) {
  const f = document.createElement('iframe'); f.allow = 'autoplay; encrypted-media'; f.title = 'YouTube'; f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  f.src = `https://www.youtube-nocookie.com/embed/${v}?autoplay=1&enablejsapi=1&playsinline=1&controls=${controles ? 1 : 0}&rel=0&modestbranding=1&start=${Math.floor(a)}` + (b ? '&end=' + Math.ceil(b) : '') + (/^https?:/.test(location.origin) ? '&origin=' + encodeURIComponent(location.origin) : '');
  f.onload = () => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'emu' }), '*'); } catch (x) {} };
  return f;
}
function emuQuitar() { if (EMU.ifr) EMU.ifr.remove(); EMU.ifr = null; EMU.src = null; EMU.vid = null; EMU.vol = -1; EMU.est = -1; }
function emuCargar(src, m) {
  emuQuitar(); let c = document.getElementById('emuMini'); if (!c) { c = document.createElement('div'); c.id = 'emuMini'; c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c); }
  const f = emuIframe(m[0], +m[1], +m[2], false); f.tabIndex = -1; c.appendChild(f);
  Object.assign(EMU, { ifr: f, src, vid: m[0], a: +m[1], b: +m[2], cur: +m[1], curT: Date.now(), est: -1, vol: -1, seekT: Date.now(), reT: Date.now() });
}
// cada 0,2 s: cuál se oye (la mía o la del más cercano que está haciendo un emote con música), el volumen y el bucle
function emuPaso(dt) {
  EMU.t -= dt; if (EMU.t > 0) return; EMU.t = 0.2;
  if (EMU.ed) { if (EMU.ifr) emuQuitar(); return; }   // (con el editor abierto suena el del editor)
  let src = null, m = null, d = 0;
  if (JUEGO.estado === 'juego' && PREFS.emoMusica !== false) {
    const P = JUG.cuerpo, x = P && P.emote && emuDe(P.emote);
    if (x) { src = 'yo'; m = [x.v, x.a, x.b]; }
    else if (typeof RED !== 'undefined') { let bd = EMU_LEJOS; for (const R2 of RED.remotos.values()) { if (!R2.mu || !R2.P || !R2.P.emote) continue; const dd = R2.P.pos.distTo(CAM.pos); if (dd < bd) { bd = dd; src = R2.id; m = R2.mu; d = dd; } } }
  }
  if (!src) { if (EMU.ifr) emuQuitar(); return; }
  if (src !== EMU.src || m[0] !== EMU.vid || +m[1] !== EMU.a || +m[2] !== EMU.b) emuCargar(src, m);
  const vol = Math.round(100 * clamp((PREFS.vol ?? 100) / 100, 0, 1) * (src === 'yo' ? 1 : Math.pow(clamp(1 - d / EMU_LEJOS, 0, 1), 1.5)));
  if (Math.abs(vol - EMU.vol) >= 2 || (vol === 0) !== (EMU.vol === 0)) { emuCmd(EMU.ifr, 'setVolume', [vol]); EMU.vol = vol; }
  // (en bucle: al llegar al final de la parte elegida vuelve al principio; si el navegador lo frenó, sigue)
  const ahora = Date.now(), va = EMU.cur + (EMU.est === 1 ? (ahora - EMU.curT) / 1000 : 0);
  if ((EMU.est === 0 || (EMU.est === 1 && va >= EMU.b - 0.12)) && ahora - EMU.seekT > 600) { emuCmd(EMU.ifr, 'seekTo', [EMU.a, true]); emuCmd(EMU.ifr, 'playVideo'); EMU.seekT = ahora; EMU.cur = EMU.a; EMU.curT = ahora; }
  else if ((EMU.est === 2 || EMU.est === 5 || EMU.est === -1) && ahora - EMU.reT > 1500) { emuCmd(EMU.ifr, 'playVideo'); EMU.reT = ahora; }
}
addEventListener('message', (ev) => {
  if (!/youtube/.test(ev.origin)) return;
  const S = EMU.ifr && ev.source === EMU.ifr.contentWindow ? EMU : EMU.ed && EMU.ed.ifr && ev.source === EMU.ed.ifr.contentWindow ? EMU.ed : null; if (!S) return;
  let d; try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (x) { return; }
  if (!d || typeof d !== 'object') return;
  if (d.event === 'onStateChange' && typeof d.info === 'number') S.est = d.info;
  if (d.event === 'infoDelivery' && d.info) {
    if (typeof d.info.playerState === 'number') S.est = d.info.playerState;
    if (typeof d.info.currentTime === 'number') { S.cur = d.info.currentTime; S.curT = Date.now(); }
    if (typeof d.info.duration === 'number' && d.info.duration > 0 && S === EMU.ed) { S.dur = d.info.duration; emuEdDur(); }
  }
});
// ---- ⋯ en la tarjeta del emote: Música / Quitar música ----
function emuMenu(btn) {
  const id = btn.dataset.emop, nom = btn.dataset.emn || id; emuMenuCerrar();
  const m = document.createElement('div'); m.id = 'emuMenu'; const r = btn.getBoundingClientRect();
  m.innerHTML = `<button data-emu="mus">${glifo('musica')} ${esc(T('emu.musica'))}</button>` + (emuDe(id) ? `<button data-emu="quitar">${glifo('basura')} ${esc(T('emu.quitar'))}</button>` : '');
  m.style.left = Math.max(4, Math.min(innerWidth - 190, r.left)) + 'px'; m.style.top = Math.min(innerHeight - 90, r.bottom + 4) + 'px';
  m.onclick = (ev) => { ev.stopPropagation(); const b = ev.target.closest('[data-emu]'); if (!b) return; emuMenuCerrar(); if (b.dataset.emu === 'mus') emuAbrir(id, nom); else { delete EMU.m[id]; emuGuardar(); if (typeof emoDibujar === 'function') emoDibujar(); } };
  document.body.appendChild(m); setTimeout(() => addEventListener('pointerdown', emuMenuFuera, true), 0);
}
function emuMenuFuera(ev) { const m = document.getElementById('emuMenu'); if (m && !m.contains(ev.target)) emuMenuCerrar(); }
function emuMenuCerrar() { const m = document.getElementById('emuMenu'); if (m) m.remove(); removeEventListener('pointerdown', emuMenuFuera, true); }
// ---- el panel: buscar en YouTube y recortar ----
function emuPanel() {
  let p = document.getElementById('emuPan'); if (p) return p;
  p = document.createElement('div'); p.id = 'emuPan'; p.className = 'panel oc';
  p.innerHTML = `<div class="caja emuCaja"><div class="emuCab"><h3>${glifo('musica')} <span class="emuEmo"></span></h3><button class="emuX" data-emu="cerrar" aria-label="x">×</button></div>
    <div class="emuBus"><input maxlength="80" spellcheck="false"><button class="boton" data-emu="buscar">${glifo('buscar')}</button></div>
    <div class="emuRes"></div>
    <div class="emuEd oc"><div class="emuVid"></div><b class="emuTit" dir="auto"></b>
      <label class="emuFila"><span class="emuLa"></span><input type="range" class="emuA" min="0" max="60" step="0.5" value="0"><b class="emuAv">0:00</b></label>
      <label class="emuFila"><span class="emuLb"></span><input type="range" class="emuB" min="0" max="60" step="0.5" value="15"><b class="emuBv">0:15</b></label>
      <div class="emuLargo"></div>
      <div class="emuBot"><button class="boton" data-emu="volver"></button><button class="boton" data-emu="probar"></button><button class="boton azul" data-emu="guardar"></button></div></div></div>`;
  document.body.appendChild(p);
  const q = p.querySelector('.emuBus input'); q.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') emuBuscar(q.value); };
  p.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  p.onclick = (ev) => {
    ev.stopPropagation(); if (ev.target === p) { emuCerrar(); return; }
    const b = ev.target.closest('[data-emu]'); if (!b) return; const a = b.dataset.emu;
    if (a === 'cerrar') emuCerrar(); else if (a === 'buscar') emuBuscar(q.value);
    else if (a.startsWith('elegir:')) { const x = EMU.ed && EMU.ed.res[+a.slice(7)]; if (x) emuEditar(x); }
    else if (a === 'volver') emuEditarFin();
    else if (a === 'probar') emuProbar();
    else if (a === 'guardar') emuGuardarEd();
  };
  const A = p.querySelector('.emuA'), B = p.querySelector('.emuB');
  A.oninput = () => { const E = EMU.ed; if (!E) return; E.a = +A.value; if (E.b <= E.a + 1) E.b = Math.min(E.dur || E.a + 1, E.a + 1); if (E.b - E.a > EMU_MAX) E.b = E.a + EMU_MAX; emuEdPintar(); };
  B.oninput = () => { const E = EMU.ed; if (!E) return; E.b = +B.value; if (E.b <= E.a + 1) E.a = Math.max(0, E.b - 1); if (E.b - E.a > EMU_MAX) E.a = E.b - EMU_MAX; emuEdPintar(); };
  A.onchange = B.onchange = () => emuProbar();
  return p;
}
function emuAbrir(id, nom) {
  if (typeof cerrarPaneles === 'function') cerrarPaneles();
  const p = emuPanel(), x = emuDe(id);
  EMU.ed = { id, nom, res: [], n: 0, cargando: false, x: null, a: 0, b: 15, dur: 0, ifr: null, est: -1, cur: 0, curT: 0 };
  p.querySelector('.emuEmo').textContent = T('emu.musica') + ' · ' + nom;
  const q = p.querySelector('.emuBus input'); q.placeholder = T('emu.buscar'); q.value = x ? x.t || '' : '';
  p.querySelector('.emuLa').textContent = T('emu.desde'); p.querySelector('.emuLb').textContent = T('emu.hasta');
  p.querySelector('[data-emu=volver]').textContent = T('emu.volver'); p.querySelector('[data-emu=probar]').textContent = T('emu.probar'); p.querySelector('[data-emu=guardar]').textContent = T('emu.guardar');
  p.classList.remove('oc'); UI.abierto = 'emuPan'; if (typeof soltarPuntero === 'function') soltarPuntero();
  if (x) emuEditar({ id: x.v, t: x.t || '', c: '' }, x); else { emuRes(); setTimeout(() => q.focus(), 50); }
}
function emuCerrar() { emuEditarFin(true); const p = document.getElementById('emuPan'); if (p) p.classList.add('oc'); EMU.ed = null; if (UI.abierto === 'emuPan') UI.abierto = null; }
async function emuBuscar(q) {
  const E = EMU.ed; if (!E) return; q = String(q || '').trim().slice(0, 80); if (!q) return;
  if (ytMalo(q)) { E.res = []; E.bloq = true; emuRes(); aviso(T('yt.bloq'), 2.5); return; }
  E.bloq = false; const n = ++E.n; E.cargando = true; emuRes();
  try { const L = await ytBuscar(q); if (n !== E.n || EMU.ed !== E) return; E.res = ytFiltrar((L || []).filter((x) => ytId(x.id) === x.id)); }
  catch (e) { if (n !== E.n) return; E.res = []; tiendaAvisoSat(); }
  E.cargando = false; emuRes();
  if (E.res.length && typeof ytIA === 'function') { const no = await ytIA(E.res, 9000); if (no && no.size && n === E.n && EMU.ed === E) { E.res = E.res.filter((x) => !no.has(x.id)); emuRes(); } }
}
function emuRes() {
  const E = EMU.ed, R0 = document.querySelector('#emuPan .emuRes'); if (!E || !R0) return;
  R0.innerHTML = E.cargando ? `<div class="radioVacio">${esc(T('cargando'))}</div>` : !E.res.length ? `<div class="radioVacio">${esc(T(E.bloq ? 'yt.bloq' : 'emu.nota'))}</div>`
    : E.res.map((x, i) => `<button class="radioIt" data-emu="elegir:${i}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${x.id}/mqdefault.jpg"><span><b dir="auto">${esc(sinEmoji(x.t))}</b><small dir="auto">${esc(sinEmoji(x.c || ''))}${x.d ? ' · ' + esc(x.d) : ''}</small></span></button>`).join('');
}
// el editor: el video que se ve (con sus controles) y dos marcas, desde y hasta
function emuEditar(x, previo) {
  const E = EMU.ed, p = emuPanel(); if (!E) return;
  E.x = x; E.a = previo ? +previo.a : 0; E.b = previo ? +previo.b : 15; E.dur = 0;
  p.querySelector('.emuRes').classList.add('oc'); p.querySelector('.emuBus').classList.add('oc'); p.querySelector('.emuEd').classList.remove('oc');
  p.querySelector('.emuTit').textContent = sinEmoji(x.t || x.id);
  const v = p.querySelector('.emuVid'); v.innerHTML = ''; E.ifr = emuIframe(x.id, E.a, E.b, true); v.appendChild(E.ifr); E.est = -1;
  emuEdDur(); emuEdPintar();
}
function emuEditarFin(todo) {
  const E = EMU.ed, p = document.getElementById('emuPan'); if (!p) return;
  if (E && E.ifr) { E.ifr.remove(); E.ifr = null; }
  p.querySelector('.emuVid').innerHTML = '';
  if (todo) return;
  p.querySelector('.emuEd').classList.add('oc'); p.querySelector('.emuRes').classList.remove('oc'); p.querySelector('.emuBus').classList.remove('oc'); emuRes();
}
function emuEdDur() {
  const E = EMU.ed, p = document.getElementById('emuPan'); if (!E || !p) return;
  const top = E.dur > 0 ? E.dur : Math.max(60, E.b + 30), A = p.querySelector('.emuA'), B = p.querySelector('.emuB');
  A.max = B.max = String(Math.floor(top * 2) / 2);
  if (E.dur > 0) { E.b = Math.min(E.b, E.dur); E.a = Math.min(E.a, Math.max(0, E.b - 1)); }
  emuEdPintar();
}
function emuEdPintar() {
  const E = EMU.ed, p = document.getElementById('emuPan'); if (!E || !p) return;
  p.querySelector('.emuA').value = E.a; p.querySelector('.emuB').value = E.b;
  p.querySelector('.emuAv').textContent = emuMin(E.a); p.querySelector('.emuBv').textContent = emuMin(E.b);
  p.querySelector('.emuLargo').textContent = T('emu.largo').replace('{s}', Math.round(E.b - E.a)).replace('{m}', EMU_MAX);
}
function emuProbar() { const E = EMU.ed; if (!E || !E.ifr) return; emuCmd(E.ifr, 'seekTo', [E.a, true]); emuCmd(E.ifr, 'playVideo'); E.probarHasta = E.b; }
// (mientras se prueba, al llegar a «hasta» se frena)
setInterval(() => { const E = EMU.ed; if (!E || !E.ifr || !E.probarHasta || E.est !== 1) return; const va = E.cur + (Date.now() - E.curT) / 1000; if (va >= E.probarHasta) { emuCmd(E.ifr, 'pauseVideo'); E.probarHasta = 0; } }, 150);
function emuGuardarEd() {
  const E = EMU.ed; if (!E || !E.x) return;
  const a = Math.max(0, +E.a), b = Math.min(a + EMU_MAX, +E.b); if (!(b > a + 0.5)) return;
  EMU.m[E.id] = { v: E.x.id, t: String(sinEmoji(E.x.t || '')).slice(0, 90), a: +a.toFixed(1), b: +b.toFixed(1) }; emuGuardar();
  aviso(T('emu.lista'), 2.5); emuCerrar();
  if (typeof abrirEmotes === 'function') abrirEmotes(); if (typeof emoDibujar === 'function') emoDibujar();   // (de vuelta en el panel, con la nota musical en la tarjeta)
}
