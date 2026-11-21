// La música mientras hacés stickers: buscás (o elegís un género de tu país) en YouTube y suena en la esquina de abajo:
// un disco que gira, una X arriba para cerrarla y el disco mismo para pausar. YouTube pide que mientras suena se vea su
// reproductor oficial (200×200 como mínimo): por eso, sonando, el video está al lado del disco; en pausa se esconde y
// queda sólo el disco quieto, y al tocarlo sigue. Sólo mientras la app está abierta. La búsqueda la hace el servidor
// (el de JXMod, /api/yt).
const GENEROS = {
  ar: ['cumbia argentina', 'rock nacional', 'trap argentino', 'cuarteto', 'folklore argentino'], mx: ['regional mexicano', 'corridos tumbados', 'pop mexicano', 'cumbia sonidera'],
  es: ['éxitos España', 'flamenco pop', 'pop español', 'reggaeton España'], co: ['vallenato', 'reggaeton colombiano', 'salsa colombiana', 'champeta'],
  cl: ['cumbia chilena', 'pop chileno', 'música chilena'], pe: ['cumbia peruana', 'salsa peruana', 'chicha'], ve: ['salsa venezolana', 'gaita zuliana', 'pop venezolano'],
  uy: ['cumbia uruguaya', 'candombe', 'murga uruguaya'], py: ['polka paraguaya', 'cumbia paraguaya'], bo: ['caporales', 'música boliviana'], ec: ['música ecuatoriana', 'cumbia ecuatoriana'],
  cu: ['salsa cubana', 'timba', 'son cubano'], do: ['bachata', 'merengue', 'dembow'], pr: ['reggaeton clásico', 'salsa puertorriqueña'], gt: ['marimba guatemalteca', 'cumbia guatemalteca'],
  hn: ['punta hondureña', 'música hondureña'], sv: ['cumbia salvadoreña', 'música salvadoreña'], ni: ['música nicaragüense', 'palo de mayo'], cr: ['música costarricense', 'cumbia tica'],
  pa: ['típico panameño', 'plena panameña'], us: ['latin hits', 'reggaeton hits', 'regional mexicano USA'], br: ['funk brasileiro', 'sertanejo', 'pagode', 'MPB'],
  gq: ['música de Guinea Ecuatorial', 'afrobeat'], otro: ['música latina éxitos', 'reggaeton', 'cumbia'],
};
const PAIS_EN = { ar: 'Argentina', mx: 'México', es: 'España', co: 'Colombia', cl: 'Chile', pe: 'Perú', ve: 'Venezuela', uy: 'Uruguay', py: 'Paraguay', bo: 'Bolivia', ec: 'Ecuador', cu: 'Cuba', do: 'Rep. Dominicana', pr: 'Puerto Rico', gt: 'Guatemala', hn: 'Honduras', sv: 'El Salvador', ni: 'Nicaragua', cr: 'Costa Rica', pa: 'Panamá', us: 'Estados Unidos', br: 'Brasil', gq: 'Guinea Ecuatorial', otro: '' };
const M = { lista: [], i: -1, yt: null, cargaApi: null, el: null, disco: null, fallas: 0 };
const portada = (v) => `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
// (si la portada no carga, queda el centro de colores)
const ponerTapa = (img, v) => { img.onerror = () => img.removeAttribute('src'); img.src = portada(v); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function buscar(base, q) {
  const r = await fetch(base + '/api/yt?q=' + encodeURIComponent(q)); if (!r.ok) throw new Error('sin conexión');
  return (await r.json()).items || [];
}
// la hoja para elegir: géneros de tu país, un buscador y los resultados
export function abrirMusica({ base, pais, X, saltar }) {
  const g = GENEROS[pais] || GENEROS.otro, nombre = PAIS_EN[pais] || '';
  const el = document.createElement('div'); el.className = 'musicaEl';
  el.innerHTML = `<div class="muCaja"><div class="muCab"><span class="muDisco"></span><div><h2>Música${nombre ? ` de <em>${esc(nombre)}</em>` : ''}</h2><p>Mientras hacés stickers. Si no querés, salteala.</p></div></div>
    <div class="buscar muBuscar"><i data-i="lupa"></i><input type="search" placeholder="Buscá una canción o un artista" enterkeyhint="search"></div>
    <div class="chips muGen">${g.map((x, k) => `<button class="chip${k ? '' : ' act'}" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div class="muLista"></div><div class="botones"><button class="sec muSaltar">${saltar ? 'Saltar' : 'Cerrar'}</button></div></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('entra'));
  const lista = el.querySelector('.muLista'), inp = el.querySelector('input');
  const cerrar = () => { el.classList.add('chau'); setTimeout(() => el.remove(), 350); };
  const cargar = async (q) => {
    lista.innerHTML = Array.from({ length: 5 }, () => '<div class="muIt esq"></div>').join('');
    try {
      const items = await buscar(base, q);
      M.ultimos = items;
      lista.innerHTML = items.length ? items.map((v, k) => `<button class="muIt" data-k="${k}"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"><span><b>${esc(v.t)}</b><small>${esc(v.c)}${v.d ? ' · ' + esc(v.d) : ''}</small></span><i class="muPlay">▶</i></button>`).join('') : '<p class="muNada">No encontré nada. Probá con otra cosa.</p>';
    } catch (e) { lista.innerHTML = '<p class="muNada">Sin conexión: la música necesita internet.</p>'; }
  };
  el.querySelector('.muGen').onclick = (ev) => { const b = ev.target.closest('[data-q]'); if (!b) return; for (const c of b.parentElement.children) c.classList.toggle('act', c === b); X.vibrar(6); cargar(b.dataset.q + ' ' + nombre); };
  inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && inp.value.trim()) { inp.blur(); cargar(inp.value.trim()); } });
  lista.onclick = (ev) => { const b = ev.target.closest('[data-k]'); if (!b) return; X.vibrar(12); M.X = X; M.lista = M.ultimos.slice(); tocar(+b.dataset.k, true); cerrar(); X.aviso('Sonando. Tocá el disco para pausar'); };
  el.querySelector('.muSaltar').onclick = cerrar;
  cargar(g[0] + ' ' + nombre);
}
// ---- el reproductor flotante (el de YouTube, a la vista) ----
function apiYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return (M.cargaApi ||= new Promise((ok, mal) => { window.onYouTubeIframeAPIReady = ok; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = mal; document.head.appendChild(s); }));
}
// (elegido: la tocaste en la lista, así que el reproductor vuelve a la vista; si pasa sola a la siguiente estando
// achicado, queda lista pero sin sonar)
async function tocar(k, elegido = false) {
  if (!M.lista.length) return; M.i = (k + M.lista.length) % M.lista.length; const v = M.lista[M.i];
  armarFlotante(); if (elegido) { M.fallas = 0; agrandar(false); }
  const quieto = M.el.classList.contains('min');
  for (const img of M.el.querySelectorAll('.rfTapa')) ponerTapa(img, v);
  try {
    await apiYT();
    if (M.yt) { if (quieto) M.yt.cueVideoById(v.id); else M.yt.loadVideoById(v.id); return; }
    M.yt = new window.YT.Player(M.el.querySelector('.rfVideo'), { width: 200, height: 200, videoId: v.id, host: 'https://www.youtube-nocookie.com',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onStateChange: (e) => { if (!M.el) return; if (e.data === 1) M.fallas = 0; if (e.data === 0) tocar(M.i + 1); M.el.classList.toggle('sonando', e.data === 1); },
        // (si un video no se puede ver acá, el siguiente; si no anda ninguno, se avisa en vez de dar vueltas)
        onError: () => { if (!M.el) return; if (++M.fallas >= M.lista.length) { avisar('Ninguna de esas canciones se puede escuchar acá'); return; } setTimeout(() => tocar(M.i + 1), 600); },
      } });
  } catch (e) { avisar('No pude cargar YouTube'); }
}
// (el vinilo: los surcos y la portada giran; el brillo queda quieto, como en uno de verdad)
const vinilo = (clase) => `<span class="${clase}"><span class="rfGira"><img class="rfTapa" alt=""></span><span class="rfBrillo"></span></span>`;
const avisar = (t) => { if (M.X && M.X.aviso) M.X.aviso(t, 3); };
// en la esquina de abajo: la X arriba, el video de YouTube (a la vista mientras suena) y el disco que asoma al costado,
// con el botón de pausa en el medio
function armarFlotante() {
  if (M.el) return;
  const el = (M.el = document.createElement('div')); el.className = 'radioFlota';
  el.innerHTML = `<button class="rfX" aria-label="Cerrar la música"><i data-i="cerrar"></i></button><div class="rfCuerpo"><button class="rfDisco" aria-label="Pausar">${vinilo('rfVinilo')}<span class="rfBoton"><i data-i="pausa"></i></span></button><div class="rfCaja"><div class="rfVideo"></div></div></div>`;
  document.body.appendChild(el); if (M.X && M.X.iconos) M.X.iconos(el);
  el.querySelector('.rfDisco').onclick = () => { if (M.X && M.X.vibrar) M.X.vibrar(8); if (el.classList.contains('min')) agrandar(true); else achicar(); };
  el.querySelector('.rfX').onclick = cerrarMusica;
}
function cerrarMusica() {
  try { M.yt && M.yt.destroy(); } catch (e) { /* nada */ } M.yt = null;
  if (M.el) { const el = M.el; M.el = null; el.classList.add('chau'); setTimeout(() => el.remove(), 300); }
}
const iconoBoton = (n) => { if (!M.el) return; const b = M.el.querySelector('.rfBoton'); b.innerHTML = `<i data-i="${n}"></i>`; if (M.X && M.X.iconos) M.X.iconos(b); M.el.querySelector('.rfDisco').setAttribute('aria-label', n === 'play' ? 'Seguir' : 'Pausar'); };
// en pausa: el video se esconde (YouTube no deja que suene escondido) y queda el disco quieto, con «seguir»
function achicar() {
  if (!M.el) return; try { M.yt && M.yt.pauseVideo(); } catch (e) { /* nada */ }
  M.el.classList.add('min'); iconoBoton('play');
}
function agrandar(seguir) {
  if (!M.el || !M.el.classList.contains('min')) return;
  M.el.classList.remove('min'); iconoBoton('pausa'); if (seguir) { try { M.yt && M.yt.playVideo(); } catch (e) { /* nada */ } }
}
export const hayMusica = () => !!M.el && !M.el.classList.contains('min');

// ---- la canción del perfil (como en Instagram) ----
// Elegirla: el mismo buscador, en una hoja; devuelve { id, t, c }, null si la saca o undefined si cierra.
export function elegirCancion({ base, X, actual }) {
  return new Promise((listo) => {
    const el = document.createElement('div'); el.className = 'musicaEl cancionEl';
    el.innerHTML = `<div class="muCaja"><div class="muCab"><span class="muDisco"></span><div><h2>Canción de tu perfil</h2><p>Suena cuando alguien la toca en tu perfil.</p></div></div>
      <div class="buscar muBuscar"><i data-i="lupa"></i><input type="search" placeholder="Buscá una canción o un artista" enterkeyhint="search"></div>
      <div class="muLista"><p class="muNada">Escribí el nombre de una canción.</p></div><div class="botones">${actual ? '<button class="sec ceSacar">Sacar la canción</button>' : ''}<button class="sec muSaltar">Cerrar</button></div></div>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('entra'));
    const lista = el.querySelector('.muLista'), inp = el.querySelector('input'); let items = [];
    const cerrar = (r) => { el.classList.add('chau'); setTimeout(() => el.remove(), 350); listo(r); };
    const cargar = async (q) => {
      lista.innerHTML = Array.from({ length: 5 }, () => '<div class="muIt esq"></div>').join('');
      try { items = await buscar(base, q); lista.innerHTML = items.length ? items.map((v, k) => `<button class="muIt" data-k="${k}"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"><span><b>${esc(v.t)}</b><small>${esc(v.c)}${v.d ? ' · ' + esc(v.d) : ''}</small></span></button>`).join('') : '<p class="muNada">No encontré nada con eso.</p>'; }
      catch (e) { lista.innerHTML = '<p class="muNada">Sin conexión: la música necesita internet.</p>'; }
    };
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && inp.value.trim()) { inp.blur(); cargar(inp.value.trim()); } });
    lista.onclick = (ev) => { const b = ev.target.closest('[data-k]'); if (!b) return; X.vibrar(12); const v = items[+b.dataset.k]; cerrar({ id: v.id, t: String(v.t || '').slice(0, 100), c: String(v.c || '').slice(0, 60) }); };
    el.querySelector('.muSaltar').onclick = () => cerrar(undefined);
    const sacar = el.querySelector('.ceSacar'); if (sacar) sacar.onclick = () => cerrar(null);
    setTimeout(() => inp.focus(), 350);
  });
}
// Tocarla en un perfil: una tarjeta adentro del perfil con el reproductor de YouTube a la vista (200×200) y el disco que
// gira. Si la radio estaba sonando, queda en pausa. Al salir del perfil (o al tocarla de nuevo) se corta.
const CP = { yt: null, el: null, id: '' };
export const cancionSonando = () => (CP.el ? CP.id : '');
export async function tocarCancionPerfil(v, lugar) {
  const repetida = CP.id === v.id && CP.el; pararCancionPerfil(); if (repetida) return;
  if (M.el && !M.el.classList.contains('min')) achicar();
  const el = (CP.el = document.createElement('div')); CP.id = v.id; el.className = 'cancionTarjeta';
  el.innerHTML = `<div class="cpVideo"></div><div class="cpLado">${vinilo('cpVinilo')}<b>${esc(v.t)}</b><small>${esc(v.c)}</small><button class="cpX sec"><i data-i="cerrar"></i>Parar</button></div>`;
  lugar.appendChild(el); ponerTapa(el.querySelector('.rfTapa'), v);
  el.querySelector('.cpX').onclick = pararCancionPerfil;
  try {
    await apiYT(); if (CP.el !== el) return;
    CP.yt = new window.YT.Player(el.querySelector('.cpVideo'), { width: 200, height: 200, videoId: v.id, host: 'https://www.youtube-nocookie.com',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: { onStateChange: (e) => el.classList.toggle('sonando', e.data === 1), onError: () => { el.querySelector('small').textContent = 'Esta canción no se puede escuchar acá'; } } });
  } catch (e) { el.querySelector('small').textContent = 'No pude cargar YouTube'; }
}
export function pararCancionPerfil() {
  if (!CP.el) return; try { CP.yt && CP.yt.destroy(); } catch (e) { /* nada */ }
  CP.yt = null; CP.el.remove(); CP.el = null; CP.id = '';
  for (const b of document.querySelectorAll('.cancionChip.sonando')) { b.classList.remove('sonando'); const ic = b.querySelector(':scope > i[data-i]'); if (ic) ic.outerHTML = '<i data-i="play"></i>'; }
}
