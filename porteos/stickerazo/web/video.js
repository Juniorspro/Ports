// ---------------- el editor de video (como los de video del celular): un video de base y, abajo, la línea de tiempo ----------------
// Arriba la vista previa; abajo las pistas con el cabezal fijo en el medio (la línea de tiempo corre por debajo, como en los
// editores de video): el video con sus cuadritos, los textos (amarillos, con su «T»), las fotos y stickers (violetas) y los
// audios con su onda y el color de dónde salieron: TikTok negro, YouTube rojo, del celular verde. Tocás algo y aparecen
// sus manijas (las flechitas que sobresalen, como papel): arrastrándolas se recorta o se alarga (el audio se repite si se
// estira más que lo que dura); mantenés apretado y lo movés en el tiempo. Pellizcando se acerca o se aleja.
// Sale: un sticker animado para WhatsApp (WebP de 512 y 500 KB como mucho, hasta 10 s), un video con sonido (MP4 a 60
// cuadros) o el sticker con sonido (un video cuadrado: WhatsApp todavía no tiene stickers con sonido para las apps; está
// en prueba en su beta, y cuando lo abra se agrega acá). Todo se hace en el celular.
import { LADO, anmf, recortarCuadro, webpDePartes, aBlob, lienzo, cargarFuente } from './editor.js';

const MAX_ST = 10, MAX_BYTES = 500 * 1024;
const ORIGEN = { tt: { nom: 'TikTok', col: '#121212', borde: '#3a3a3a', ico: 'musica' }, yt: { nom: 'YouTube', col: '#d81f26', borde: '#ff6b6b', ico: 'musica' },
  gal: { nom: 'Del celu', col: '#1fa35b', borde: '#5fe39a', ico: 'musica' }, orig: { nom: 'Sonido original', col: '#1fa35b', borde: '#5fe39a', ico: 'video' } };
const COL = { texto: ['#ffd23f', '#fff0a6'], foto: ['#8f5cff', '#c7a8ff'], sticker: ['#8f5cff', '#c7a8ff'] };
const ALTO = { video: 54, texto: 34, foto: 34, sticker: 34, audio: 40 };
const fmt = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), x = s - m * 60; return `${m}:${x < 10 ? '0' : ''}${x.toFixed(1)}`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let H = null;   // (lo de la app: iconos, aviso, modal, cerrarModal, guardar)
let V = null;   // (el proyecto abierto)

// ---------------- la pantalla ----------------
export function abrirVideo(ayuda, archivo) {
  H = ayuda; cerrar(true);
  const raiz = document.createElement('div'); raiz.id = 'vVideo'; raiz.className = 'vVideo';
  raiz.innerHTML = `<div class="vvCab"><button class="ico" data-a="salir"><i data-i="atras"></i></button><b>Video</b>
      <button class="vvFor" data-a="formato"></button><button class="pri vvSale" data-a="exportar">Exportar</button></div>
    <div class="vvVista"><canvas id="vvLienzo"></canvas><div class="vvVacio" data-a="base"><i data-i="video"></i><b>Elegí un video</b><span>o empezá con texto, fotos y audio</span></div></div>
    <div class="vvCtl"><span id="vvT">0:00.0</span><button class="vvPlay" data-a="play"><i data-i="play"></i></button><span id="vvD">0:00.0</span></div>
    <div class="vvHerr">${[['base', 'video', 'Video'], ['audio', 'musica', 'Audio'], ['texto', 'texto', 'Texto'], ['foto', 'foto', 'Foto'], ['sticker', 'mas', 'Sticker']].map(([a, i, n]) => `<button data-a="${a}"><i data-i="${i}"></i><span>${n}</span></button>`).join('')}</div>
    <div class="vvSel oc" id="vvSel"></div>
    <div class="vvLinea" id="vvLinea"><div class="vvRegla" id="vvRegla"></div><div class="vvPistas" id="vvPistas"></div><div class="vvCabezal"></div></div>
    <input type="file" id="vvArch" hidden>`;
  document.getElementById('app').appendChild(raiz); H.iconos(raiz);
  V = { raiz, lienzo: raiz.querySelector('#vvLienzo'), formato: '9:16', clips: [], dur: 0, t: 0, pps: 60, scroll: 0, sel: null, juega: false, ctx: null, fuentes: [], sig: 1, video: null, base: null, imgs: new Map() };
  raiz.addEventListener('click', (ev) => { const b = ev.target.closest('[data-a]'); if (b && raiz.contains(b)) accion(b.dataset.a, b); });
  linea(); formato('9:16'); interacciones(); bucle();
  window.__vv = () => (V ? Object.assign(V, { irA }) : null);   // (para las pruebas)
  if (archivo) cargarBase(archivo);
  window.__szAtrasVideo = () => { if (!V) return false; if (document.querySelector('#modal:not(.oc)')) { H.cerrarModal(); return true; } salir(); return true; };
}
export function cerrarVideo() { cerrar(); }
function cerrar(silencio) { if (!V) return; pausa(); if (V.video) { V.video.pause(); URL.revokeObjectURL(V.video.src); } if (V.ctx) V.ctx.close(); V.raiz.remove(); V = null; if (!silencio) window.__szAtrasVideo = null; }
async function salir() { if (V.clips.length && !(await H.confirmar('¿Salir sin exportar? Se pierde lo que armaste', 'Salir'))) return; cerrar(); }
function formato(f) { V.formato = f; const [a, b] = f.split(':').map(Number); V.W = a > b ? 960 : Math.round(960 * a / b); V.H = a > b ? Math.round(960 * b / a) : 960; V.lienzo.width = V.W; V.lienzo.height = V.H; V.raiz.querySelector('.vvFor').textContent = f === '1:1' ? 'Sticker 1:1' : 'Video 9:16'; dibujar(); }
function accion(a, b) {
  if (a === 'salir') return salir();
  if (a === 'formato') return formato(V.formato === '1:1' ? '9:16' : '1:1');
  if (a === 'play') return V.juega ? pausa() : jugar();
  if (a === 'base') return elegir('video/*', (f) => cargarBase(f));
  if (a === 'audio') return hojaAudio();
  if (a === 'texto') return hojaTexto(null);
  if (a === 'foto' || a === 'sticker') return elegir('image/*', (f) => agregarImagen(f, a));
  if (a === 'exportar') return hojaExportar();
  if (a.startsWith('sel:')) return accionSel(a.slice(4));
}
function elegir(acepta, fn) { const i = V.raiz.querySelector('#vvArch'); i.accept = acepta; i.value = ''; i.onchange = () => { const f = i.files && i.files[0]; if (f) fn(f); }; i.click(); }

// ---------------- lo que se agrega ----------------
const nuevoId = () => 'c' + (V.sig++);
function durTotal() { V.dur = Math.max(V.base ? V.base.dur : 0, ...V.clips.map((c) => c.t1), 0.5); V.raiz.querySelector('#vvD').textContent = fmt(V.dur); }
async function cargarBase(f) {
  const url = URL.createObjectURL(f), v = document.createElement('video'); v.src = url; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  try { await new Promise((ok, mal) => { v.onloadedmetadata = ok; v.onerror = () => mal(new Error('no se pudo abrir el video')); }); } catch (e) { URL.revokeObjectURL(url); return H.aviso(e.message); }
  if (V.video) { V.video.pause(); URL.revokeObjectURL(V.video.src); }
  V.video = v; V.base = { dur: v.duration || 1, w: v.videoWidth, h: v.videoHeight, tiras: null };
  V.clips = V.clips.filter((c) => c.origen !== 'orig');
  V.raiz.querySelector('.vvVacio').classList.add('oc');
  if (V.formato === '9:16' && v.videoWidth >= v.videoHeight * 0.95) formato('1:1');
  durTotal(); irA(0); linea();
  tiras(v).then((t) => { if (V && V.video === v) { V.base.tiras = t; linea(); } });
  // (su sonido, como un audio más: se puede bajar, recortar o borrar)
  try { const buf = await decodificar(await f.arrayBuffer()); if (V && V.video === v && buf) agregarAudio(buf, 'orig', 'Sonido original', 0); } catch (e) { /* video sin sonido */ }
}
// los cuadritos del video para su pista (uno cada tanto, chiquitos)
async function tiras(v) {
  const n = clamp(Math.round(v.duration / 1.5), 4, 40), alto = 54, ancho = Math.round(alto * v.videoWidth / Math.max(1, v.videoHeight)), c = lienzo(ancho * n, alto), g = c.getContext('2d');
  const w2 = document.createElement('video'); w2.src = v.src; w2.muted = true; w2.playsInline = true; w2.preload = 'auto';
  await new Promise((ok) => { w2.onloadeddata = ok; w2.onerror = ok; });
  for (let i = 0; i < n; i++) { w2.currentTime = (i + 0.5) * v.duration / n; await new Promise((ok) => { w2.onseeked = ok; setTimeout(ok, 1500); }); try { g.drawImage(w2, i * ancho, 0, ancho, alto); } catch (e) { /* nada */ } }
  w2.removeAttribute('src'); w2.load();
  return { c, ancho, n };
}
function audioCtx() { if (!V.ctx) { V.ctx = new (window.AudioContext || window.webkitAudioContext)(); V.master = V.ctx.createGain(); V.master.connect(V.ctx.destination); } return V.ctx; }
async function decodificar(ab) { return await audioCtx().decodeAudioData(ab.slice ? ab.slice(0) : ab); }
// la onda del audio (un pico por cada 1/50 s), para dibujarla en su pista
function onda(buf) { const d = buf.getChannelData(0), paso = Math.max(1, Math.floor(buf.sampleRate / 50)), n = Math.ceil(d.length / paso), o = new Float32Array(n); for (let i = 0; i < n; i++) { let m = 0; for (let j = i * paso, f = Math.min(d.length, j + paso); j < f; j += 4) m = Math.max(m, Math.abs(d[j])); o[i] = m; } return o; }
function agregarAudio(buf, origen, titulo, t0) {
  const t = t0 ?? V.t, c = { id: nuevoId(), pista: 'audio', origen, titulo, buf, onda: onda(buf), off: 0, t0: t, t1: t + Math.min(buf.duration, Math.max(buf.duration, 0.5)), vol: 1 };
  if (origen !== 'orig' && V.base) c.t1 = Math.min(c.t1, Math.max(t + 1, V.base.dur));   // (se ajusta al video; se alarga con la manija)
  V.clips.push(c); V.sel = c.id; durTotal(); linea(); panelSel(); return c;
}
async function agregarImagen(f, tipo) {
  let bmp; try { bmp = await createImageBitmap(f); } catch (e) { return H.aviso('No se pudo abrir la imagen'); }
  const c = { id: nuevoId(), pista: tipo, t0: V.t, t1: V.t + 3, img: bmp, nombre: tipo === 'foto' ? 'Foto' : 'Sticker', x: 0.5, y: 0.45, s: tipo === 'foto' ? 0.6 : 0.42, rot: 0 };
  V.clips.push(c); V.sel = c.id; durTotal(); linea(); panelSel(); dibujar();
}

// ---------------- texto ----------------
function hojaTexto(c) {
  const m = H.modal(`<div class="hoja"><h3>${c ? 'Cambiar el texto' : 'Agregar texto'}</h3><input class="campo" id="vvTx" maxlength="80" placeholder="Escribí algo" value="${c ? esc(c.texto) : ''}">
    <div class="vvColores">${['#ffffff', '#ffd23f', '#ff3e8a', '#3ec7ff', '#4cd964', '#111111'].map((k) => `<button style="background:${k}" data-c="${k}" class="${(c ? c.color : '#ffffff') === k ? 'act' : ''}"></button>`).join('')}</div>
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Listo</button></div></div>`);
  let color = c ? c.color : '#ffffff'; const inp = m.querySelector('#vvTx'); setTimeout(() => inp.focus(), 250);
  m.querySelector('.vvColores').onclick = (ev) => { const b = ev.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; for (const x of m.querySelectorAll('[data-c]')) x.classList.toggle('act', x === b); };
  m.querySelector('[data-x="0"]').onclick = () => H.cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => {
    const t = inp.value.trim(); H.cerrarModal(); if (!t) return;
    if (c) { c.texto = t; c.color = color; c.nombre = t; }
    else V.clips.push(c = { id: nuevoId(), pista: 'texto', t0: V.t, t1: V.t + 3, texto: t, nombre: t, color, x: 0.5, y: 0.78, s: 0.09, rot: 0 });
    V.sel = c.id; durTotal(); linea(); panelSel(); dibujar();
  };
  cargarFuente('LuckiestGuy');
}

// ---------------- audio: YouTube, TikTok o del celular ----------------
const nativo = () => !!(window.SZN && window.SZN.pedirAudio);
function hojaAudio() {
  const m = H.modal(`<div class="hoja vvHojaA"><h3>Agregar audio</h3>
    <button class="vvFuente" data-f="yt"><b class="vvPunto" style="background:${ORIGEN.yt.col}"></b><span><b>Buscar en YouTube</b><small>Escribís el tema y elegís</small></span></button>
    <button class="vvFuente" data-f="tt"><b class="vvPunto" style="background:${ORIGEN.tt.col};border:1px solid #444"></b><span><b>De un TikTok</b><small>Pegás el enlace del video</small></span></button>
    <button class="vvFuente" data-f="gal"><b class="vvPunto" style="background:${ORIGEN.gal.col}"></b><span><b>De tu celu</b><small>Un audio o el sonido de un video tuyo</small></span></button></div>`);
  m.querySelector('.vvHojaA').onclick = (ev) => {
    const b = ev.target.closest('[data-f]'); if (!b) return; const f = b.dataset.f; H.cerrarModal();
    if (f === 'gal') return elegir('audio/*,video/*', async (fl) => { H.aviso('Sacando el audio…'); try { agregarAudio(await decodificar(await fl.arrayBuffer()), 'gal', fl.name.replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 40)); } catch (e) { H.aviso('Ese archivo no tiene un audio que se pueda leer'); } });
    if (!nativo()) return H.aviso('YouTube y TikTok andan en la app de Android');
    if (f === 'yt') return hojaYouTube();
    hojaTikTok();
  };
}
// lo que hace la app (Java): buscar y bajar; contesta llamando a window.__szAudio(id, json)
const esperas = new Map(); let pedidos = 0;
window.__szAudio = (id, json) => { const f = esperas.get(id); if (!f) return; esperas.delete(id); let r = null; try { r = JSON.parse(json); } catch (e) { r = { ok: false, error: 'respuesta rara' }; } f(r); };
function pedir(tipo, arg) { const id = 'a' + (++pedidos); return new Promise((ok) => { esperas.set(id, ok); window.SZN.pedirAudio(id, tipo, arg); }); }
async function bajarYAgregar(tipo, arg, origen, titulo) {
  const m = H.modal(`<div class="hoja"><div class="progreso"><div class="rueda"></div><b>Bajando el audio…</b><span>${esc(titulo || '')}</span></div></div>`);
  const r = await pedir(tipo, arg); H.cerrarModal(); if (!V) return;
  if (!r || !r.ok) return H.aviso(r && r.error ? r.error : 'No se pudo bajar el audio');
  try { const ab = await (await fetch(r.url)).arrayBuffer(); agregarAudio(await decodificar(ab), origen, (r.titulo || titulo || ORIGEN[origen].nom).slice(0, 60)); }
  catch (e) { H.aviso('No se pudo leer ese audio'); }
  void m;
}
function hojaYouTube() {
  const m = H.modal(`<div class="hoja vvYT"><h3>Buscar en YouTube</h3><div class="vvBusca"><input class="campo" id="vvQ" placeholder="Tema, artista o meme" maxlength="80"><button class="pri" id="vvIr">Buscar</button></div><div class="vvRes" id="vvRes"></div></div>`);
  const q = m.querySelector('#vvQ'), res = m.querySelector('#vvRes'); setTimeout(() => q.focus(), 250);
  const buscar = async () => {
    const t = q.value.trim(); if (!t) return; res.innerHTML = '<div class="progreso"><div class="rueda"></div></div>';
    const r = await pedir('ytbuscar', t); if (!r || !r.ok) { res.innerHTML = `<p class="vvNada">${esc((r && r.error) || 'No se pudo buscar')}</p>`; return; }
    res.innerHTML = (r.lista || []).map((x) => `<button class="vvItem" data-id="${esc(x.id)}" data-t="${esc(x.titulo)}"><img src="${esc(x.mini || '')}" alt=""><span><b>${esc(x.titulo)}</b><small>${esc(x.canal || '')} · ${esc(x.dur || '')}</small></span></button>`).join('') || '<p class="vvNada">Nada con eso</p>';
  };
  m.querySelector('#vvIr').onclick = buscar; q.onkeydown = (ev) => { if (ev.key === 'Enter') buscar(); };
  res.onclick = (ev) => { const b = ev.target.closest('[data-id]'); if (b) { H.cerrarModal(); bajarYAgregar('yt', b.dataset.id, 'yt', b.dataset.t); } };
}
function hojaTikTok() {
  const m = H.modal(`<div class="hoja"><h3>Audio de un TikTok</h3><input class="campo" id="vvL" placeholder="https://www.tiktok.com/…" inputmode="url"><p class="vvNota">En TikTok: Compartir → Copiar enlace, y pegalo acá.</p>
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Sacar el audio</button></div></div>`);
  const l = m.querySelector('#vvL'); setTimeout(() => l.focus(), 250);
  m.querySelector('[data-x="0"]').onclick = () => H.cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => { const u = (l.value.match(/https?:\/\/\S*tiktok\.com\/\S+/i) || [])[0]; if (!u) return H.aviso('Pegá un enlace de TikTok'); H.cerrarModal(); bajarYAgregar('tt', u, 'tt', 'TikTok'); };
}

// ---------------- dibujar la vista ----------------
function encajar(g, img, iw, ih, W, Hh, cubrir) { const k = cubrir ? Math.max(W / iw, Hh / ih) : Math.min(W / iw, Hh / ih), w = iw * k, h = ih * k; g.drawImage(img, (W - w) / 2, (Hh - h) / 2, w, h); }
function componer(g, W, Hh, t, vid) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
  if (vid && V.base && t <= V.base.dur + 0.05 && vid.readyState >= 2) encajar(g, vid, V.base.w, V.base.h, W, Hh, true);
  for (const c of V.clips) {
    if (c.pista === 'audio' || t < c.t0 || t > c.t1) continue;
    // (entra con un pop y sale apagándose: 0,2 s)
    const e = clamp((t - c.t0) / 0.2, 0, 1), s = clamp((c.t1 - t) / 0.2, 0, 1), k = 0.7 + 0.3 * (1 - (1 - e) ** 3) + (e < 1 ? Math.sin(e * Math.PI) * 0.08 : 0);
    g.save(); g.globalAlpha = Math.min(1, e * 1.5) * s; g.translate(c.x * W, c.y * Hh); g.rotate(c.rot || 0); g.scale(k, k);
    if (c.img) { const w = c.s * W, h = w * c.img.height / c.img.width; if (c.pista === 'foto') { g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 18; } g.drawImage(c.img, -w / 2, -h / 2, w, h); }
    else if (c.pista === 'texto') {
      const px = Math.round(c.s * Math.min(W, Hh)); g.font = `${px}px LuckiestGuy, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lineas = partir(g, c.texto, W * 0.86); lineas.forEach((l, i) => { const y = (i - (lineas.length - 1) / 2) * px * 1.05; g.lineJoin = 'round'; g.lineWidth = px * 0.22; g.strokeStyle = c.color === '#111111' ? '#fff' : '#111'; g.strokeText(l, 0, y); g.fillStyle = c.color; g.fillText(l, 0, y); });
    }
    g.restore();
  }
}
function partir(g, t, max) { const ps = t.split(/\s+/), o = []; let l = ''; for (const p of ps) { const x = l ? l + ' ' + p : p; if (g.measureText(x).width > max && l) { o.push(l); l = p; } else l = x; } if (l) o.push(l); return o; }
function dibujar() { if (!V) return; componer(V.lienzo.getContext('2d'), V.W, V.H, V.t, V.video); }

// ---------------- reproducir ----------------
let fuentesAudio = [];
function jugar(desde) {
  if (V.juega) pausa();
  const ctx = audioCtx(); ctx.resume(); if (V.t >= V.dur - 0.05) irA(0);
  const t0 = desde ?? V.t, when = ctx.currentTime + 0.06; V.juega = { t0, when };
  fuentesAudio = programar(ctx, V.master, t0, when);
  if (V.video && t0 < V.base.dur) { V.video.currentTime = t0; V.video.play().catch(() => {}); }
  V.raiz.querySelector('.vvPlay i').dataset.i = 'pausa'; H.iconos(V.raiz.querySelector('.vvPlay'));
}
function programar(ctx, salida, t0, when) {
  const L = [];
  for (const c of V.clips) {
    if (c.pista !== 'audio' || c.t1 <= t0) continue;
    const g = ctx.createGain(); g.gain.value = c.vol; g.connect(salida);
    const s = ctx.createBufferSource(); s.buffer = c.buf; s.connect(g);
    const largo = c.buf.duration - c.off; if (c.t1 - c.t0 > largo + 0.01) { s.loop = true; s.loopStart = c.off; s.loopEnd = c.buf.duration; }
    const empieza = Math.max(0, c.t0 - t0), dentro = Math.max(0, t0 - c.t0), off = c.off + (largo > 0 ? dentro % largo : 0);
    s.start(when + empieza, off, c.t1 - Math.max(t0, c.t0)); L.push(s);
  }
  return L;
}
function pausa() { if (!V || !V.juega) return; for (const s of fuentesAudio) { try { s.stop(); } catch (e) { /* ya paró */ } } fuentesAudio = []; V.juega = false; if (V.video) V.video.pause(); const b = V.raiz.querySelector('.vvPlay i'); if (b) { b.dataset.i = 'play'; H.iconos(V.raiz.querySelector('.vvPlay')); } }
function irA(t) { V.t = clamp(t, 0, V.dur); V.scroll = V.t * V.pps; V.raiz.querySelector('#vvT').textContent = fmt(V.t); if (V.video && !V.juega) { const vt = Math.min(V.t, V.base.dur - 0.03); if (Math.abs(V.video.currentTime - vt) > 0.02) V.video.currentTime = vt; } posLinea(); dibujar(); }
function bucle() {
  if (!V) return; requestAnimationFrame(bucle);
  if (V.juega) {
    const t = V.juega.t0 + (V.ctx.currentTime - V.juega.when);
    if (t >= V.dur) { pausa(); irA(V.dur); return; }
    if (t >= 0) { V.t = t; V.scroll = t * V.pps; V.raiz.querySelector('#vvT').textContent = fmt(t); posLinea(); }
    if (V.video && t < V.base.dur && Math.abs(V.video.currentTime - t) > 0.18) V.video.currentTime = t;
  }
  dibujar();
}

// ---------------- la línea de tiempo ----------------
// (las filas: el video, cada texto/foto/sticker en su fila de capas y los audios abajo; todo se dibuja con divs que se
// corren con el desplazamiento: el cabezal queda quieto en el medio)
function filas() {
  const F = [];
  if (V.base) F.push({ tipo: 'video', clips: [{ id: 'base', pista: 'video', t0: 0, t1: V.base.dur }] });
  const capas = V.clips.filter((c) => c.pista !== 'audio'), audios = V.clips.filter((c) => c.pista === 'audio');
  const repartir = (L, tipo) => { const R = []; for (const c of L.slice().sort((a, b) => a.t0 - b.t0)) { let r = R.find((x) => x.fin <= c.t0 + 1e-3 && x.tipo === tipo); if (!r) R.push(r = { tipo, fin: 0, clips: [] }); r.clips.push(c); r.fin = c.t1; } return R; };
  F.push(...repartir(capas, 'capa'), ...repartir(audios, 'audio'));
  return F;
}
function linea() {
  if (!V) return; const P = V.raiz.querySelector('#vvPistas'); P.innerHTML = '';
  for (const f of filas()) {
    const fila = document.createElement('div'); fila.className = 'vvFila ' + f.tipo; fila.style.height = (f.tipo === 'video' ? ALTO.video : f.tipo === 'audio' ? ALTO.audio : ALTO.texto) + 'px';
    for (const c of f.clips) fila.appendChild(clipDiv(c));
    P.appendChild(fila);
  }
  const vacio = document.createElement('div'); vacio.className = 'vvPista0'; vacio.innerHTML = '<i data-i="mas"></i> Tocá «Audio», «Texto» o «Foto» para sumar'; if (!V.clips.length && !V.base) P.appendChild(vacio);
  H.iconos(P); regla(); posLinea(); panelSel();
}
function clipDiv(c) {
  const d = document.createElement('div'); d.className = 'vvClip ' + c.pista + (V.sel === c.id ? ' sel' : ''); d.dataset.id = c.id;
  if (c.pista === 'video') {
    d.classList.add('video'); if (V.base && V.base.tiras) { const cv = V.base.tiras.c; d.style.backgroundImage = `url(${cv.toDataURL('image/jpeg', 0.6)})`; d.style.backgroundSize = `auto 100%`; }
    d.innerHTML = '<span class="vvEt"><i data-i="video"></i></span>';
  } else if (c.pista === 'audio') {
    const o = ORIGEN[c.origen]; d.style.setProperty('--c', o.col); d.style.setProperty('--b', o.borde);
    d.innerHTML = `<canvas class="vvOnda"></canvas><span class="vvEt"><i data-i="${o.ico}"></i>${esc(c.titulo)}</span>`;
  } else {
    const [col, b] = COL[c.pista]; d.style.setProperty('--c', col); d.style.setProperty('--b', b);
    d.innerHTML = `<span class="vvEt">${c.pista === 'texto' ? '<b class="vvT">T</b>' : `<i data-i="${c.pista === 'foto' ? 'foto' : 'mas'}"></i>`}${esc(c.nombre || '')}</span>`;
  }
  if (V.sel === c.id && c.pista !== 'video') d.insertAdjacentHTML('beforeend', '<b class="vvManija izq" data-m="i"><svg viewBox="0 0 10 20"><path d="M7 4 2 10l5 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></b><b class="vvManija der" data-m="d"><svg viewBox="0 0 10 20"><path d="M3 4l5 6-5 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></b>');
  return d;
}
function posLinea() {
  if (!V) return; const L = V.raiz.querySelector('#vvLinea'), mitad = L.clientWidth / 2, x0 = mitad - V.scroll;
  for (const d of L.querySelectorAll('.vvClip')) {
    const c = d.dataset.id === 'base' ? { t0: 0, t1: V.base.dur } : V.clips.find((x) => x.id === d.dataset.id); if (!c) continue;
    const x = x0 + c.t0 * V.pps, w = Math.max(6, (c.t1 - c.t0) * V.pps); d.style.transform = `translateX(${x}px)`; d.style.width = w + 'px';
    const cv = d.querySelector('.vvOnda'); if (cv && c.onda) ondaDib(cv, c, w);
  }
  const r = V.raiz.querySelector('#vvRegla'); r.style.transform = `translateX(${x0}px)`;
}
function ondaDib(cv, c, w) {
  const h = ALTO.audio - 8, wr = Math.min(Math.round(w), 4096); if (cv.width !== wr) cv.width = wr; cv.height = h;
  const g = cv.getContext('2d'); g.clearRect(0, 0, wr, h); g.fillStyle = 'rgba(255,255,255,.55)';
  const largo = c.buf.duration - c.off;
  for (let x = 0; x < wr; x += 2) { const t = (x / V.pps), tt = c.off + (largo > 0 ? t % largo : 0), i = Math.floor(tt * 50), a = (c.onda[i] || 0) * (h - 4) * 0.5 * Math.min(1, c.vol); g.fillRect(x, h / 2 - a - 1, 1.4, a * 2 + 2); }
  if (c.t1 - c.t0 > largo + 0.01) { g.fillStyle = 'rgba(0,0,0,.28)'; for (let k = 1; k * largo < c.t1 - c.t0; k++) g.fillRect(Math.round(k * largo * V.pps), 0, 2, h); }
}
function regla() {
  const r = V.raiz.querySelector('#vvRegla'), paso = V.pps > 120 ? 0.5 : V.pps > 40 ? 1 : V.pps > 15 ? 5 : 10; let html = '';
  for (let t = 0; t <= V.dur + 0.001; t += paso) html += `<span style="left:${t * V.pps}px">${Number.isInteger(t) ? fmt(t).replace(/\.0$/, '') : '·'}</span>`;
  r.innerHTML = html;
}
// el tacto en la línea: arrastrar = correr el tiempo (con inercia); tocar = elegir; mantener = mover; manijas = recortar
function interacciones() {
  const L = V.raiz.querySelector('#vvLinea'), pts = new Map(); let g = null, inercia = 0;
  window.__vvG = () => g && g.tipo;   // (para las pruebas)
  const clipDe = (id) => V.clips.find((c) => c.id === id);
  const iman = (t, sin) => { const lim = 10 / V.pps, cand = [V.t, 0, V.dur, ...V.clips.filter((c) => c.id !== sin).flatMap((c) => [c.t0, c.t1])]; let m = t; let best = lim; for (const x of cand) { const d = Math.abs(x - t); if (d < best) { best = d; m = x; } } return m; };
  L.addEventListener('pointerdown', (ev) => {
    L.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); inercia = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; g = { tipo: 'zoom', d0: Math.hypot(a.x - b.x, a.y - b.y), pps0: V.pps }; return; }
    const m = ev.target.closest('.vvManija'), cd = ev.target.closest('.vvClip'), c = cd && clipDe(cd.dataset.id);
    if (V.juega) pausa();
    if (m && c) { g = { tipo: 'manija', lado: m.dataset.m, c, x0: ev.clientX, t0: c.t0, t1: c.t1, off: c.off || 0 }; return; }
    g = { tipo: 'pan', x0: ev.clientX, s0: V.scroll, ult: [[performance.now(), ev.clientX]], c, movio: false };
    if (c) g.largo = setTimeout(() => { if (g && g.tipo === 'pan' && !g.movio) { g = { tipo: 'mover', c, x0: ev.clientX, t0: c.t0, t1: c.t1 }; V.sel = c.id; linea(); const d = L.querySelector(`.vvClip[data-id="${c.id}"]`); if (d) d.classList.add('levanta'); if (navigator.vibrate) navigator.vibrate(12); } }, 380);
  });
  L.addEventListener('pointermove', (ev) => {
    if (!pts.has(ev.pointerId)) return; pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); if (!g) return;
    if (g.tipo === 'zoom' && pts.size >= 2) { const [a, b] = [...pts.values()]; V.pps = clamp(g.pps0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(20, g.d0), 8, 400); V.scroll = V.t * V.pps; regla(); posLinea(); return; }
    const dx = ev.clientX - g.x0;
    if (g.tipo === 'pan') { if (Math.abs(dx) > 6) g.movio = true; V.scroll = clamp(g.s0 - dx, 0, V.dur * V.pps); g.ult.push([performance.now(), ev.clientX]); if (g.ult.length > 5) g.ult.shift(); const t = V.scroll / V.pps; V.t = t; V.raiz.querySelector('#vvT').textContent = fmt(t); posLinea(); buscarVideo(); return; }
    const dt = dx / V.pps, c = g.c;
    if (g.tipo === 'mover') { const largo = g.t1 - g.t0; let n = Math.max(0, g.t0 + dt); const a = iman(n, c.id), b = iman(n + largo, c.id); n = a !== n ? a : b !== n + largo ? b - largo : n; c.t0 = Math.max(0, n); c.t1 = c.t0 + largo; }
    else if (g.tipo === 'manija') {
      if (g.lado === 'i') { let n = iman(clamp(g.t0 + dt, 0, g.t1 - 0.2), c.id); if (c.pista === 'audio') { const mn = g.t0 - g.off; n = Math.max(n, mn); c.off = g.off + (n - g.t0); } c.t0 = n; }
      else c.t1 = iman(Math.max(c.t0 + 0.2, g.t1 + dt), c.id);
    }
    durTotal(); posLinea(); dibujar();
  });
  const fin = (ev) => {
    pts.delete(ev.pointerId); if (!g) return; clearTimeout(g.largo);
    if (g.tipo === 'pan') {
      if (!g.movio) { V.sel = g.c ? g.c.id : null; linea(); panelSel(); }
      else { const u = g.ult; if (u.length > 1) { const [t1, x1] = u[u.length - 1], [t0, x0] = u[0]; inercia = -(x1 - x0) / Math.max(16, t1 - t0) * 16; deslizar(); } }
    } else if (g.tipo !== 'zoom') { linea(); }
    if (pts.size === 0) g = null;
  };
  L.addEventListener('pointerup', fin); L.addEventListener('pointercancel', fin);
  const deslizar = () => { if (Math.abs(inercia) < 0.5 || g) return; V.scroll = clamp(V.scroll + inercia, 0, V.dur * V.pps); inercia *= 0.93; const t = V.scroll / V.pps; V.t = t; V.raiz.querySelector('#vvT').textContent = fmt(t); posLinea(); buscarVideo(); requestAnimationFrame(deslizar); };
  let pendiente = 0; const buscarVideo = () => { if (!V.video || pendiente) return; pendiente = requestAnimationFrame(() => { pendiente = 0; const vt = Math.min(V.t, V.base.dur - 0.03); if (Math.abs(V.video.currentTime - vt) > 0.04) V.video.currentTime = vt; }); };
  // (arrastrar lo elegido en la vista: mover el texto o la foto; con dos dedos, agrandar y girar)
  const Lz = V.lienzo, pv = new Map(); let gv = null;
  Lz.addEventListener('pointerdown', (ev) => { const c = clipDe(V.sel); if (!c || c.pista === 'audio') return; Lz.setPointerCapture(ev.pointerId); pv.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); const r = Lz.getBoundingClientRect();
    if (pv.size === 1) gv = { c, x0: ev.clientX, y0: ev.clientY, cx: c.x, cy: c.y, r }; else { const [a, b] = [...pv.values()]; gv = { c, d0: Math.hypot(a.x - b.x, a.y - b.y), a0: Math.atan2(b.y - a.y, b.x - a.x), s0: c.s, rot0: c.rot || 0 }; } });
  Lz.addEventListener('pointermove', (ev) => { if (!gv || !pv.has(ev.pointerId)) return; pv.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); const c = gv.c;
    if (pv.size >= 2 && gv.d0) { const [a, b] = [...pv.values()]; c.s = clamp(gv.s0 * Math.hypot(a.x - b.x, a.y - b.y) / gv.d0, 0.03, 2); c.rot = gv.rot0 + Math.atan2(b.y - a.y, b.x - a.x) - gv.a0; }
    else if (gv.r) { c.x = clamp(gv.cx + (ev.clientX - gv.x0) / gv.r.width, 0, 1); c.y = clamp(gv.cy + (ev.clientY - gv.y0) / gv.r.height, 0, 1); }
    dibujar(); });
  const finV = (ev) => { pv.delete(ev.pointerId); if (!pv.size) gv = null; }; Lz.addEventListener('pointerup', finV); Lz.addEventListener('pointercancel', finV);
}
// (lo que se puede hacer con lo elegido: volumen, dividir en el cabezal, duplicar, cambiar el texto, borrar)
function panelSel() {
  if (!V) return; const p = V.raiz.querySelector('#vvSel'), c = V.clips.find((x) => x.id === V.sel);
  if (!c) { p.classList.add('oc'); return; }
  const b = (a, i, n) => `<button data-a="sel:${a}"><i data-i="${i}"></i><span>${n}</span></button>`;
  p.innerHTML = (c.pista === 'audio' ? `<label class="vvVol"><i data-i="musica"></i><input type="range" min="0" max="200" value="${Math.round(c.vol * 100)}" id="vvVolR"><b>${Math.round(c.vol * 100)}%</b></label>` : '')
    + (c.pista === 'texto' ? b('editar', 'texto', 'Editar') : '') + b('dividir', 'tijera', 'Dividir') + b('duplicar', 'copias', 'Duplicar') + b('borrar', 'tacho', 'Borrar');
  p.classList.remove('oc'); H.iconos(p);
  const r = p.querySelector('#vvVolR'); if (r) r.oninput = () => { c.vol = r.value / 100; r.nextElementSibling.textContent = r.value + '%'; posLinea(); };
}
function accionSel(a) {
  const c = V.clips.find((x) => x.id === V.sel); if (!c) return;
  if (a === 'borrar') { V.clips = V.clips.filter((x) => x !== c); V.sel = null; }
  else if (a === 'editar') return hojaTexto(c);
  else if (a === 'duplicar') { const n = { ...c, id: nuevoId(), t0: c.t1, t1: c.t1 + (c.t1 - c.t0) }; V.clips.push(n); V.sel = n.id; }
  else if (a === 'dividir') {
    if (V.t <= c.t0 + 0.05 || V.t >= c.t1 - 0.05) return H.aviso('Poné el cabezal en el medio de eso');
    const n = { ...c, id: nuevoId(), t0: V.t }; if (c.pista === 'audio') { const largo = c.buf.duration - c.off; n.off = c.off + ((V.t - c.t0) % largo); } c.t1 = V.t; V.clips.push(n); V.sel = n.id;
  }
  durTotal(); linea(); dibujar();
}

// ---------------- exportar ----------------
function hojaExportar() {
  if (!V.base && !V.clips.length) return H.aviso('Agregá un video, una foto o un texto primero');
  const largo = Math.min(MAX_ST, V.dur - V.t > 1 ? V.dur - V.t : V.dur);
  const m = H.modal(`<div class="hoja vvHojaA"><h3>Exportar</h3>
    <button class="vvFuente" data-e="st"><b class="vvPunto" style="background:var(--ama)"></b><span><b>Sticker animado</b><small>Para WhatsApp: ${largo.toFixed(1)} s desde ${V.t > 0.05 && V.dur - V.t > 1 ? 'el cabezal' : 'el principio'} (hasta 10 s)</small></span></button>
    <button class="vvFuente" data-e="publicar"><b class="vvPunto" style="background:var(--ama)"></b><span><b>Publicar con sonido en WhatsApp</b><small>Lo subimos nosotros y te damos un código: lo buscás en los stickers de WhatsApp y sale con sonido</small></span></button>
    <button class="vvFuente" data-e="clip"><b class="vvPunto" style="background:var(--verde)"></b><span><b>Clip con sonido para el buscador de WhatsApp</b><small>Cuadrado, 30 cuadros y hasta 10 s: se sube a KLIPY o GIPHY y aparece con sonido en los stickers de WhatsApp</small></span></button>
    <button class="vvFuente" data-e="wa5"><b class="vvPunto" style="background:var(--rosa)"></b><span><b>Sticker con sonido (WhatsApp)</b><small>5 s en movimiento con su audio: WhatsApp le deja el sonido al hacerlo sticker</small></span></button>
    <button class="vvFuente" data-e="wa10"><b class="vvPunto" style="background:#ff7a1a"></b><span><b>Sticker quieto con 10 s de audio</b><small>La imagen del cabezal y su audio, listos para el editor de WhatsApp</small></span></button>
    <button class="vvFuente" data-e="mp4"><b class="vvPunto" style="background:#3ec7ff"></b><span><b>Video con sonido</b><small>MP4 a 60 cuadros, ${fmt(V.dur)}</small></span></button></div>`);
  m.querySelector('.vvHojaA').onclick = async (ev) => {
    const b = ev.target.closest('[data-e]'); if (!b) return; H.cerrarModal();
    const desde = V.dur - V.t > 1 ? V.t : 0;
    if (b.dataset.e === 'st') return exportarSticker(desde, largo);
    if (b.dataset.e === 'publicar') return publicarConSonido(desde);
    if (b.dataset.e === 'clip') return exportarVideo(true, { desde, max: 10, nombre: 'clip_con_sonido', fps: 30, lado: 720, guia: 'clip' });
    if (b.dataset.e === 'wa5') return exportarVideo(true, { desde, max: 5, nombre: 'wa_sticker_sonido' });
    if (b.dataset.e === 'wa10') return exportarQuietoConAudio(desde);
    return exportarVideo(false);
  };
}
// un cuadro de la composición en un momento (el video, buscado a ese momento)
async function cuadroEn(t, W, Hh, vid) {
  if (vid && V.base && t < V.base.dur) { vid.currentTime = Math.min(t, V.base.dur - 0.03); await new Promise((ok) => { const f = () => { vid.removeEventListener('seeked', f); ok(); }; vid.addEventListener('seeked', f); setTimeout(f, 1200); }); }
  const c = lienzo(W, Hh); componer(c.getContext('2d'), W, Hh, t, vid); return c;
}
export async function exportarSticker(desde, largo) { const r = await hacerWebP(desde, largo); if (r) await H.guardar(r); }
async function hacerWebP(desde, largo) {
  pausa(); const vid = V.video ? Object.assign(document.createElement('video'), { src: V.video.src, muted: true, playsInline: true, preload: 'auto' }) : null;
  if (vid) await new Promise((ok) => { vid.onloadeddata = ok; vid.onerror = ok; });
  const m = H.modal(`<div class="hoja"><div class="progreso"><div class="rueda"></div><b id="vvP">Armando el sticker…</b><span>Todo en tu celular</span></div></div>`), txt = m.querySelector('#vvP');
  try {
    // (lo más fluido que entre en 500 KB con buena calidad: se prueba con 4 cuadros de muestra)
    let elegido = null;
    for (const fps of [15, 12, 10, 8, 6]) {
      const n = Math.max(2, Math.round(largo * fps)), ms = 1000 * largo / n, muestras = [0, 0.33, 0.66, 0.95].map((k) => Math.floor(k * (n - 1)));
      for (const q of [0.82, 0.72, 0.62]) {
        let suma = 0; for (const k of muestras) { const cr = recortarCuadro(await cuadroEn(desde + k * largo / n, LADO, LADO, vid)); suma += (await anmf(cr, ms, q)).length; }
        if (suma / muestras.length * n * 1.12 < MAX_BYTES) { elegido = { fps, n, ms, q }; break; }
      }
      if (elegido) break;
    }
    if (!elegido) { const n = Math.max(2, Math.round(largo * 5)); elegido = { fps: 5, n, ms: 1000 * largo / n, q: 0.5 }; }
    let blob = null;
    for (let intento = 0; intento < 4 && !blob; intento++) {
      const partes = [];
      for (let k = 0; k < elegido.n; k++) { txt.textContent = `Armando el sticker… ${Math.round(k / elegido.n * 100)}%`; partes.push(await anmf(recortarCuadro(await cuadroEn(desde + k * largo / elegido.n, LADO, LADO, vid)), elegido.ms, elegido.q)); }
      const b = webpDePartes(partes); if (b.size <= MAX_BYTES) blob = b; else elegido.q = Math.max(0.3, elegido.q - 0.12);
    }
    if (!blob) throw new Error('no entró en 500 KB: probá con un pedazo más corto');
    const tapa = await cuadroEn(desde, LADO, LADO, vid); H.cerrarModal();
    return { blob, tapa, segundos: largo, fps: elegido.fps };
  } catch (e) { H.cerrarModal(); H.aviso('No se pudo: ' + e.message); return null; }
}
// el video con sonido, grabando la composición en tiempo real (60 cuadros por segundo) con el audio mezclado
async function exportarVideo(cuadrado, op = {}) {
  const desde = op.desde || 0;
  pausa(); const lado = op.lado || 512, fps = op.fps || 60, W = cuadrado ? lado : 720, Hh = cuadrado ? lado : (V.formato === '1:1' ? 720 : 1280);
  const tipos = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'], tipo = tipos.find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported(x));
  if (!tipo) return H.aviso('Este celular no sabe grabar video desde la app');
  const largo = Math.max(0.5, Math.min(V.dur - desde, op.max || (cuadrado ? MAX_ST : V.dur))), c = lienzo(W, Hh), g = c.getContext('2d'), ctx = audioCtx(); await ctx.resume();
  const dest = ctx.createMediaStreamDestination(), flujo = c.captureStream(fps); for (const pista of dest.stream.getAudioTracks()) flujo.addTrack(pista);
  const rec = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: op.bits || (cuadrado ? (lado > 512 ? 4_000_000 : 2_500_000) : 8_000_000), audioBitsPerSecond: 160_000 }), trozos = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) trozos.push(e.data); };
  const m = H.modal(`<div class="hoja"><div class="progreso"><div class="rueda"></div><b id="vvP">Grabando el video…</b><span>Tarda lo que dura el video</span></div></div>`), txt = m.querySelector('#vvP');
  const vid = V.video; const when = ctx.currentTime + 0.25, srcs = programar(ctx, dest, desde, when);
  rec.start(250);
  if (vid && desde < V.base.dur) { vid.currentTime = desde; await new Promise((ok) => setTimeout(ok, 220)); vid.play().catch(() => {}); }
  await new Promise((ok) => {
    const paso = () => {
      const t = ctx.currentTime - when;
      const ta = desde + Math.max(0, t); if (vid && ta < V.base.dur && Math.abs(vid.currentTime - ta) > 0.2) vid.currentTime = ta;
      componer(g, W, Hh, ta, vid); txt.textContent = `Grabando el video… ${Math.round(clamp(t / largo, 0, 1) * 100)}%`;
      if (t >= largo) return ok(); requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
  for (const s of srcs) { try { s.stop(); } catch (e) { /* ya paró */ } } if (vid) vid.pause();
  await new Promise((ok) => { rec.onstop = ok; rec.stop(); });
  const blob = new Blob(trozos, { type: tipo.split(';')[0] }); H.cerrarModal();
  if (op.devolver) return blob;
  const ok = await H.guardarVideo(blob, op.nombre || (cuadrado ? 'sticker_con_sonido' : 'video'));
  if (ok && op.guia === 'clip') guiaClip(); else if (op.nombre && ok) guiaWhatsApp('video');
}
// ---------------- stickers con sonido en WhatsApp ----------------
// (WhatsApp todavía no deja que las apps agreguen stickers con sonido a sus packs —su equipo dijo que está en sus planes—;
// su editor sí los hace: de un video se queda con 5 s de sonido, y a una imagen se le pueden poner hasta 10 s de audio.
// Acá se deja todo listo y primero en la galería, y se abre WhatsApp con los pasos)
async function exportarQuietoConAudio(desde) {
  pausa(); const largo = Math.max(0.5, Math.min(10, V.dur - desde));
  const m = H.modal(`<div class="hoja"><div class="progreso"><div class="rueda"></div><b>Preparando la imagen y el audio…</b></div></div>`); void m;
  const vid = V.video ? Object.assign(document.createElement('video'), { src: V.video.src, muted: true, playsInline: true, preload: 'auto' }) : null;
  if (vid) await new Promise((ok) => { vid.onloadeddata = ok; vid.onerror = ok; });
  const png = await aBlob(await cuadroEn(desde, LADO, LADO, vid), 'image/png');
  const sr = 44100, off = new OfflineAudioContext(2, Math.ceil(largo * sr), sr); programar(off, off.destination, desde, 0);
  const wav = wavDe(await off.startRendering());
  const a = await H.guardarArchivo(png, 'wa_sticker_imagen', 'png'), b = await H.guardarArchivo(wav, 'wa_sticker_audio', 'wav'); H.cerrarModal();
  if (a && b) guiaWhatsApp('quieto'); else H.aviso('No se pudo guardar');
}
function wavDe(buf) {
  const n = buf.length, ch = buf.numberOfChannels, d = new DataView(new ArrayBuffer(44 + n * ch * 2)), txt = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); d.setUint32(4, 36 + n * ch * 2, true); txt(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, ch, true);
  d.setUint32(24, buf.sampleRate, true); d.setUint32(28, buf.sampleRate * ch * 2, true); d.setUint16(32, ch * 2, true); d.setUint16(34, 16, true); txt(36, 'data'); d.setUint32(40, n * ch * 2, true);
  const cs = Array.from({ length: ch }, (_, k) => buf.getChannelData(k)); let o = 44;
  for (let i = 0; i < n; i++) for (let k = 0; k < ch; k++) { d.setInt16(o, Math.round(clamp(cs[k][i], -1, 1) * 32767), true); o += 2; }
  return new Blob([d.buffer], { type: 'audio/wav' });
}
function guiaWhatsApp(tipo) {
  const pasos = tipo === 'video'
    ? ['Abrí un chat y tocá el ícono de stickers', 'Tocá «Crear» y elegí el video de Stickerazo (es el primero de la galería)', 'Recortalo si querés y guardalo: WhatsApp le deja el sonido']
    : ['Abrí un chat, tocá el ícono de stickers y después «Crear»', 'Elegí la imagen de Stickerazo (la primera de la galería)', 'Tocá el ícono de ondas → «Elegir audio» → el de Stickerazo', 'Guardalo y mandalo: suena al tocarlo'];
  const m = H.modal(`<div class="hoja vvGuia"><h3>¡Listo para WhatsApp!</h3><p class="vvNota">Ya está ${tipo === 'video' ? 'el video' : 'la imagen y el audio'} en tu celu. En WhatsApp:</p>
    <ol>${pasos.map((p) => `<li>${p}</li>`).join('')}</ol><p class="vvNota">WhatsApp lo está habilitando de a poco: si no ves el ícono de ondas, todavía no te llegó.</p>
    <div class="botones"><button class="sec" data-x="0">Después</button><button class="pri" data-x="1">Abrir WhatsApp</button></div></div>`);
  m.querySelector('[data-x="0"]').onclick = () => H.cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => { H.cerrarModal(); if (window.SZN && window.SZN.abrirWhatsApp) window.SZN.abrirWhatsApp(); else H.aviso('Abrí WhatsApp desde el celular'); };
}

// ---------------- clips con sonido para el buscador de WhatsApp ----------------
// WhatsApp (desde la 2.26.46) arma stickers con sonido con los clips de GIPHY y de KLIPY: en el buscador de stickers pide
// api.giphy.com/v1/videos/search y api.klipy.com/…/clips/search, usa la vista WebP y revisa que el MP4 tenga sonido. Así
// que un clip nuestro subido ahí le aparece con sonido a cualquiera que lo busque, sin crear nada y sin vincular cuentas.
// KLIPY deja subir a cualquiera (klipy.com/create, «Create Clip»: MP4/MOV/WebM, con revisión antes de ser público, 20 por
// día); GIPHY Clips, a canales de marca o artista aprobados (giphy.com/upload: 24 o 30 cuadros, con sonido, ≤ 30 s).
function guiaClip() {
  const pasos = ['Entrá a KLIPY (klipy.com/create) → «Create Clip» y subí el video de Stickerazo (está en Películas › Stickerazo)',
    'Ponele un título y etiquetas: son las palabras con las que lo van a buscar (sumá «stickerazo»)',
    'KLIPY lo revisa y lo hace público; desde ahí, en WhatsApp: ícono de stickers → buscar → aparece con sonido'];
  const m = H.modal(`<div class="hoja vvGuia"><h3>Clip listo para publicar</h3><p class="vvNota">Ya está en tu galería. Para que salga en el buscador de stickers de WhatsApp:</p>
    <ol>${pasos.map((p) => `<li>${p}</li>`).join('')}</ol>
    <p class="vvNota">Queda público: cualquiera lo puede encontrar. Subí sólo lo que quieras compartir y que sea tuyo (imagen y sonido). WhatsApp está habilitando los stickers con sonido de a poco.</p>
    <div class="botones"><button class="sec" data-x="0">Después</button><a class="pri" data-x="1" href="https://klipy.com/create" target="_blank" rel="noopener">Abrir KLIPY</a></div></div>`);
  m.querySelector('[data-x="0"]').onclick = () => H.cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => H.cerrarModal();
}

// ---------------- publicar con sonido (servidor/clips.js): lo subimos nosotros al canal de Stickerazo ----------------
// El clip va al servidor de la comunidad; lo revisamos y lo publicamos en el canal de Stickerazo (GIPHY/KLIPY) con un código
// propio. Ese código, escrito en el buscador de stickers de WhatsApp, trae el sticker con sonido. Sin vincular WhatsApp.
const ESTADOS = { revision: 'En revisión', aprobado: 'Aprobado: lo estamos subiendo', publicado: 'Publicado', rechazado: 'No se publicó' };
function copiar(t) { try { navigator.clipboard.writeText(t); H.aviso('Código copiado'); } catch (e) { H.aviso('Tu código: ' + t); } }
async function publicarConSonido(desde) {
  if (!H.cuenta || !H.cuenta()) return H.aviso('Para publicar con sonido entrá con tu cuenta (pestaña Perfil)');
  const m = H.modal(`<div class="hoja vvGuia"><h3>Publicar con sonido</h3>
    <p class="vvNota">Lo revisamos y lo subimos al canal de Stickerazo. Te damos un código: lo escribís en el buscador de stickers de WhatsApp y te sale con sonido. No hace falta vincular nada.</p>
    <input class="campo" id="vvTit" maxlength="60" placeholder="Título (ej.: Che, ¿vamos?)">
    <input class="campo" id="vvEt" maxlength="120" placeholder="Palabras para encontrarlo: jaja, mate, gol">
    <label class="vvAcepto"><input type="checkbox" id="vvMio"> Es mío o tengo permiso (la imagen y el sonido)</label>
    <label class="vvAcepto"><input type="checkbox" id="vvPub"> Entiendo que va a ser público</label>
    <div class="botones"><button class="sec" data-x="2">Mis clips</button><button class="pri" data-x="1" disabled>Publicar</button></div></div>`);
  const tit = m.querySelector('#vvTit'), bt = m.querySelector('[data-x="1"]'), chk = [m.querySelector('#vvMio'), m.querySelector('#vvPub')];
  const valido = () => { bt.disabled = !(tit.value.trim() && chk.every((c) => c.checked)); };
  tit.oninput = valido; for (const c of chk) c.onchange = valido;
  m.querySelector('[data-x="2"]').onclick = () => { H.cerrarModal(); misClips(); };
  bt.onclick = async () => {
    const titulo = tit.value.trim(), etiquetas = m.querySelector('#vvEt').value; H.cerrarModal();
    const clip = await exportarVideo(true, { desde, max: 10, fps: 30, lado: 720, bits: 2_500_000, devolver: true });
    if (!(clip instanceof Blob)) return;
    const mm = H.modal(`<div class="hoja"><div class="progreso"><div class="rueda"></div><b id="vvP">Subiendo…</b><span>No cierres la app</span></div></div>`), txt = mm.querySelector('#vvP');
    try {
      const r = await H.api('/api/clips', { method: 'POST', json: { titulo, etiquetas, n: clip.size, tipo: clip.type } });
      const total = Math.ceil(clip.size / r.parte);
      for (let k = 0; k < total; k++) {
        txt.textContent = `Subiendo… ${Math.round(k / total * 100)}%`;
        await H.api(`/api/clips/${r.id}/partes/${k}`, { method: 'PUT', body: clip.slice(k * r.parte, (k + 1) * r.parte), headers: { 'Content-Type': 'application/octet-stream' }, tiempo: 90000 });
      }
      await H.api(`/api/clips/${r.id}/listo`, { method: 'POST' }); H.cerrarModal();
      hojaCodigo(r.codigo);
    } catch (e) { H.cerrarModal(); H.aviso(e.message || 'No se pudo subir'); }
  };
}
function hojaCodigo(codigo) {
  const m = H.modal(`<div class="hoja vvGuia"><h3>¡Mandado!</h3><p class="vvNota">Tu código:</p><div class="vvCodigo">${esc(codigo)}</div>
    <ol><li>Lo revisamos (suele ser en el día) y lo publicamos</li><li>En WhatsApp: ícono de stickers → buscar → escribí <b>${esc(codigo)}</b></li><li>Te sale con sonido: mandalo o guardalo en favoritos</li></ol>
    <p class="vvNota">WhatsApp está habilitando los stickers con sonido de a poco. El estado lo ves en «Mis clips».</p>
    <div class="botones"><button class="sec" data-x="0">Copiar código</button><button class="pri" data-x="1">Listo</button></div></div>`);
  m.querySelector('[data-x="0"]').onclick = () => copiar(codigo);
  m.querySelector('[data-x="1"]').onclick = () => H.cerrarModal();
}
async function misClips() {
  const m = H.modal(`<div class="hoja vvGuia"><h3>Mis clips con sonido</h3><div id="vvMis"><div class="progreso"><div class="rueda"></div></div></div><div class="botones"><button class="pri" data-x="0">Cerrar</button></div></div>`);
  m.querySelector('[data-x="0"]').onclick = () => H.cerrarModal();
  const caja = m.querySelector('#vvMis');
  try {
    const { clips } = await H.api('/api/clips');
    caja.innerHTML = clips.length ? `<div class="vvRes">${clips.map((c) => `<div class="vvItem vvClipItem" data-c="${esc(c.codigo)}"><span><b>${esc(c.titulo)}</b><small>${esc(ESTADOS[c.estado] || c.estado)} · <b class="vvCod">${esc(c.codigo)}</b></small></span></div>`).join('')}</div><p class="vvNota">Tocá uno para copiar su código.</p>` : '<p class="vvNada">Todavía no publicaste ninguno.</p>';
    caja.onclick = (ev) => { const x = ev.target.closest('[data-c]'); if (x) copiar(x.dataset.c); };
  } catch (e) { caja.innerHTML = `<p class="vvNada">${esc(e.message)}</p>`; }
}
