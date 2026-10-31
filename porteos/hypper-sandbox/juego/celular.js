// ---------------- el celular (como el de GTA 5): sube desde abajo a la derecha con sus apps ----------------
// Objetos (como el celu de Simple Sandbox 2: tocás uno y aparece adelante, el celular sigue abierto), Memes (el pad),
// Jugadores (los de la sala; el dueño del server puede echar a alguien), Emotes, Cámara, Mods y Ajustes. Se puede seguir
// caminando con el celular en la mano; tocar afuera (o la X, o el botón de inicio) lo guarda.
const CEL = { app: null, cat: 0, q: '', echados: new Set() };
const CEL_APPS = [
  ['props', '#2f80ed', '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M4.3 7.6L12 12l7.7-4.4M12 12v8.8" fill="none" stroke="#fff" stroke-width="1.6"/>'],
  ['memes', '#e53935', '<rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="9.2" cy="9.2" r="2.1" fill="#fff"/><circle cx="14.8" cy="9.2" r="2.1" fill="#fff"/><circle cx="9.2" cy="14.8" r="2.1" fill="#fff"/><circle cx="14.8" cy="14.8" r="2.1" fill="#fff" opacity=".55"/>'],
  ['gente', '#27ae60', '<circle cx="9" cy="8.5" r="3" fill="#fff"/><path d="M3.5 19c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2z" fill="#fff"/><circle cx="16.5" cy="9.5" r="2.4" fill="#fff" opacity=".8"/><path d="M14.6 14.3c2.6-.6 5.3.8 5.9 4.7h-4.4" fill="#fff" opacity=".8"/>'],
  ['emotes', '#f2994a', '<circle cx="12" cy="4.8" r="2.2" fill="#fff"/><path d="M12 7.8v6.4M12 9.6l-4.8-3.3M12 9.6l4.5 1.3 2.7-3.8M12 14.2l-3.5 6.2M12 14.2l3.1 6.4" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'],
  ['camara', '#56606e', '<path d="M3.5 8.5h3l1.6-2.5h7.8l1.6 2.5h3v10h-17z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13.3" r="3.2" fill="none" stroke="#fff" stroke-width="2"/>'],
  ['mods', '#8e44ad', '<path d="M10 3h4v3.2l2.3 1 2.3-2.3 2.8 2.8-2.3 2.3 1 2.3H23v4h-2.9l-1 2.3 2.3 2.3-2.8 2.8-2.3-2.3-2.3 1V24h-4v-2.9l-2.3-1-2.3 2.3-2.8-2.8 2.3-2.3-1-2.3H1v-4h2.9l1-2.3-2.3-2.3 2.8-2.8 2.3 2.3 2.3-1z" transform="scale(.82) translate(2.6 1.4)" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12.6" r="2.6" fill="#fff"/>'],
  ['ajustes', '#3d4450', '<path d="M4 7h16M4 12h16M4 17h16" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="7" r="2.2" fill="#3d4450" stroke="#fff" stroke-width="2"/><circle cx="15" cy="12" r="2.2" fill="#3d4450" stroke="#fff" stroke-width="2"/><circle cx="8" cy="17" r="2.2" fill="#3d4450" stroke="#fff" stroke-width="2"/>'],
];
const celSvg = (g) => `<svg viewBox="0 0 24 24">${g}</svg>`;
function celEl() {
  let c = $('celular'); if (c) return c;
  c = document.createElement('div'); c.id = 'celular'; c.className = 'oc';
  c.innerHTML = `<div class="celMarco"><div class="celPantalla"><div class="celBarra"><b class="celHora"></b><span class="celRed"></span></div><div class="celCont"></div><button class="celHome" data-cel="home"></button></div></div>`;
  document.body.appendChild(c);
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) c.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  c.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cel]'); if (!b) return;
    const [a, x] = b.dataset.cel.split('|'); audioIniciar();
    if (a === 'home') { if (CEL.app) celApp(null); else celCerrar(); }
    else if (a === 'app') celApp(x);
    else if (a === 'cat') { CEL.cat = +x; celDibujar(); }
    else if (a === 'poner') celPoner(x);
    else if (a === 'meme') memeTocar(x);
    else if (a === 'mtab') { MEME.tab = x; celDibujar(); }
    else if (a === 'magregar') memePan().querySelector('.mmArch').click();
    else if (a === 'echar') celEchar(x);
  });
  c.addEventListener('input', (e) => { if (e.target.classList.contains('celBus')) { CEL.q = e.target.value.trim().toLowerCase(); celGrilla(); } });
  return c;
}
function celAbrir(app) {
  if (JUEGO.estado !== 'juego') return;
  if (UI.abierto && UI.abierto !== 'celular') cerrarPaneles();
  const c = celEl(); CEL.app = app || null; c.classList.remove('oc'); void c.offsetWidth; c.classList.add('arriba');
  UI.abierto = 'celular'; soltarPuntero(); sonar('UI_blip', null, 0.35); celDibujar();
}
function celCerrar() { const c = $('celular'); if (c) { c.classList.remove('arriba'); c.classList.add('oc'); } if (UI.abierto === 'celular') UI.abierto = null; }
function celApp(a) {
  CEL.app = a; CEL.q = '';
  if (a === 'camara') { celCerrar(); const i = ARM.lista.indexOf('Camera'); if (i >= 0) elegirArma(i); return; }
  if (a === 'ajustes') { celCerrar(); abrirAjustes('juego'); return; }
  if (a === 'mods') { celCerrar(); if (typeof modMenuAbrir === 'function') modMenuAbrir(); return; }
  if (a === 'emotes') { celCerrar(); abrirEmotes(); return; }
  if (a === 'memes') rbPedir('a_memes');
  celDibujar();
}
const celHora = () => { const h = (typeof DIA !== 'undefined' ? DIA.hora : 12) || 0; return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0'); };
function celDibujar() {
  const c = celEl(), k = c.querySelector('.celCont');
  c.querySelector('.celHora').textContent = celHora();
  c.querySelector('.celRed').innerHTML = `<i class="${RED.on ? 'on' : ''}"></i><i class="${RED.on ? 'on' : ''}"></i><i class="on"></i><em></em>`;
  const tit = (t) => `<div class="celTit"><button data-cel="home">‹</button><b>${esc(t)}</b></div>`;
  if (!CEL.app) {
    k.innerHTML = `<div class="celApps">${CEL_APPS.map(([id, col, g]) => `<button class="celApp" data-cel="app|${id}"><span style="--c:${col}">${celSvg(g)}</span><small>${esc(T('cel.' + id))}</small></button>`).join('')}</div>`;
  } else if (CEL.app === 'props') {
    const cats = celCats();
    k.innerHTML = tit(T('cel.props')) + `<input class="celBus" maxlength="30" placeholder="${esc(T('buscar'))}" value="${esc(CEL.q)}"><div class="celChips">${cats.map((x, i) => `<button class="${i === CEL.cat ? 'sel' : ''}" data-cel="cat|${i}">${esc(x.n)}</button>`).join('')}</div><div class="celGrilla"></div><div class="celPuso"></div>`;
    celGrilla();
  } else if (CEL.app === 'memes') {
    k.innerHTML = tit(T('mm.tit')) + `<div class="celChips">${['rb', 'mios'].map((t) => `<button class="${MEME.tab === t ? 'sel' : ''}" data-cel="mtab|${t}">${esc(T('mm.t_' + t))}</button>`).join('')}${MEME.tab === 'mios' ? `<button data-cel="magregar">+ ${esc(T('mm.agregar'))}</button>` : ''}</div><div class="celMemes"></div>`;
    (MEME.tab === 'mios' ? memeMios() : Promise.resolve(memeIncluidos())).then((L) => {
      const g = k.querySelector('.celMemes'); if (!g) return;
      g.innerHTML = L.length ? L.map((m) => `<button class="celMeme" data-cel="meme|${m.id}"><span style="--c:${/^#[0-9a-f]{6}$/i.test(m.c) ? m.c : '#888'}"></span><small>${esc(memeNom(m))}</small></button>`).join('') : `<p class="celVacio">${esc(T('mm.vacio'))}</p>`;
    });
  } else if (CEL.app === 'gente') {
    const dueño = soyAnfitrion() && typeof SALA !== 'undefined' && SALA && !SALA.of;
    const L = [...RED.remotos.values()];
    k.innerHTML = tit(T('cel.gente')) + `<div class="celGente"><div class="celPers yo"><img src="${icono(RETRATO[PREFS.skin] || 'hero')}" alt=""><b>${esc(PREFS.nombre)}</b><small>${esc(T('cel.vos'))}</small></div>` +
      L.map((R2) => `<div class="celPers"><img src="${icono(RETRATO[R2.skinReal || R2.skin] || 'hero')}" alt=""><b dir="auto">${esc(R2.nombre || '?')}</b>${dueño ? `<button data-cel="echar|${esc(R2.id)}">${esc(T('cel.echar'))}</button>` : ''}</div>`).join('') +
      (L.length ? '' : `<p class="celVacio">${esc(T(typeof SALA !== 'undefined' && SALA ? 'cel.solo' : 'cel.sinSala'))}</p>`) + `</div>`;
  }
}
// las categorías de "Objetos": las de props (sin la de mods), los vehículos y las entidades del menú de props
function celCats() {
  if (CEL.cats) return CEL.cats;
  const out = [];
  for (const C of DATA.menu) { if (!/^(Props|Vehicles|Entities)$/.test(C.n)) continue; for (const s of C.sub || []) if ((s.it || []).length) out.push({ n: spawnCatNom(s), tab: C.n, it: s.it.map((x) => (typeof x === 'string' ? x : x.n)) }); }
  return (CEL.cats = out);
}
function celGrilla() {
  const g = $('celular') && $('celular').querySelector('.celGrilla'); if (!g) return;
  const cats = celCats(), q = CEL.q;
  const L = q ? cats.flatMap((c) => c.it.filter((n) => (n + ' ' + propNom(n)).toLowerCase().includes(q))).slice(0, 80) : (cats[CEL.cat] || cats[0]).it;
  g.innerHTML = L.map((n) => `<button class="celIt" data-cel="poner|${esc(n)}">${DATA.ico[n] ? `<img src="${icono(n)}" alt="">` : '<i></i>'}<small>${esc(propNom(n))}</small></button>`).join('');
}
// poner uno adelante (como el menú de props) sin cerrar el celular
function celPoner(n) {
  const o = spawnDelante(n, { congelado: UI.freeze }), e = $('celular') && $('celular').querySelector('.celPuso');
  if (o && e) { CEL.puestos = (CEL.puestos || 0) + 1; e.textContent = `${T('sp.puesto')}: ${propNom(n)}`; e.classList.remove('ve'); void e.offsetWidth; e.classList.add('ve'); sonar('UI_blip', null, 0.3, 1.2); }
}
// ---------------- echar a alguien de tu server (el dueño) ----------------
// le llega el aviso, sale de la sala y no puede volver a entrar a esa sala por 30 minutos; si igual aparece, se lo vuelve
// a echar y no se lo dibuja
function celEchar(id) {
  if (!soyAnfitrion() || !RED.on) return;
  const R2 = RED.remotos.get(id); CEL.echados.add(id);
  publicar('a', { k: 'echar', to: id });
  if (R2) { quitarRemoto(R2); RED.remotos.delete(id); chatMostrar('RezoBox', (R2.nombre || '?') + ' ' + T('cel.fueEchado')); }
  celDibujar();
}
function celEchadoRed(d) {
  if (d.to !== RED.ID || typeof SALA === 'undefined' || !SALA || SALA.of || !SALA.du || d.i !== SALA.du) return;   // (sólo vale si lo manda el dueño de la sala)
  try { const m = JSON.parse(localStorage.getItem('rb_echado') || '{}'); m[SALA.id] = Date.now(); localStorage.setItem('rb_echado', JSON.stringify(m)); } catch (e) {}
  irMenuPrincipal(); setTimeout(() => aviso(T('cel.teEcharon'), 4), 300);
}
// ¿me echaron de esta sala hace menos de 30 minutos?
function celMeEcharon(id) { try { const m = JSON.parse(localStorage.getItem('rb_echado') || '{}'); return m[id] && Date.now() - m[id] < 30 * 60 * 1000; } catch (e) { return false; } }
