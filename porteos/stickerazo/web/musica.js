// La música mientras hacés stickers: buscás (o elegís un género de tu país) en YouTube y suena en un reproductor que
// queda flotando y se puede mover. Es el reproductor oficial de YouTube, siempre a la vista (200×200 como mínimo, como
// pide YouTube) y sólo mientras la app está abierta. La búsqueda la hace el servidor (el de JXMod, /api/yt).
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
const M = { lista: [], i: -1, yt: null, cargaApi: null, el: null };
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
    <div class="buscar muBuscar"><span>🔎</span><input type="search" placeholder="Buscá una canción o un artista" enterkeyhint="search"></div>
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
  lista.onclick = (ev) => { const b = ev.target.closest('[data-k]'); if (!b) return; X.vibrar(12); M.lista = M.ultimos.slice(); tocar(+b.dataset.k); cerrar(); X.aviso('🎵 Sonando. Mové el reproductor a donde quieras'); };
  el.querySelector('.muSaltar').onclick = cerrar;
  cargar(g[0] + ' ' + nombre);
}
// ---- el reproductor flotante (el de YouTube, a la vista) ----
function apiYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return (M.cargaApi ||= new Promise((ok, mal) => { window.onYouTubeIframeAPIReady = ok; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = mal; document.head.appendChild(s); }));
}
async function tocar(k) {
  if (!M.lista.length) return; M.i = (k + M.lista.length) % M.lista.length; const v = M.lista[M.i];
  armarFlotante(); M.el.querySelector('.rfTit').textContent = v.t; M.el.querySelector('.rfDe').textContent = v.c;
  try {
    await apiYT();
    if (M.yt) { M.yt.loadVideoById(v.id); return; }
    M.yt = new window.YT.Player(M.el.querySelector('.rfVideo'), { width: 200, height: 200, videoId: v.id, host: 'https://www.youtube-nocookie.com',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: { onStateChange: (e) => { if (e.data === 0) tocar(M.i + 1); M.el.classList.toggle('sonando', e.data === 1); }, onError: () => setTimeout(() => tocar(M.i + 1), 600) } });
  } catch (e) { M.el.querySelector('.rfDe').textContent = 'No pude cargar YouTube'; }
}
function armarFlotante() {
  if (M.el) return;
  const el = (M.el = document.createElement('div')); el.className = 'radioFlota';
  el.innerHTML = `<div class="rfBarra"><span class="rfAgarre"></span><span class="rfTxt"><b class="rfTit"></b><small class="rfDe"></small></span><button class="rfSig" aria-label="Siguiente">⏭</button><button class="rfX" aria-label="Cerrar">✕</button></div><div class="rfVideo"></div>`;
  document.body.appendChild(el);
  el.querySelector('.rfSig').onclick = () => tocar(M.i + 1);
  el.querySelector('.rfX').onclick = () => { try { M.yt && M.yt.destroy(); } catch (e) { /* nada */ } M.yt = null; el.remove(); M.el = null; };
  // (se arrastra de la barra y se acomoda al costado más cercano)
  const barra = el.querySelector('.rfBarra'); let d = null;
  barra.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; const r = el.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; barra.setPointerCapture(e.pointerId); el.classList.add('moviendo'); });
  barra.addEventListener('pointermove', (e) => { if (!d) return; el.style.left = Math.min(innerWidth - el.offsetWidth - 6, Math.max(6, e.clientX - d.x)) + 'px'; el.style.top = Math.min(innerHeight - el.offsetHeight - 6, Math.max(6, e.clientY - d.y)) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; });
  barra.addEventListener('pointerup', () => { if (!d) return; d = null; el.classList.remove('moviendo'); const r = el.getBoundingClientRect(); el.style.left = (r.left + r.width / 2 < innerWidth / 2 ? 8 : innerWidth - r.width - 8) + 'px'; });
}
export const hayMusica = () => !!M.el;
