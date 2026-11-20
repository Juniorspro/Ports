// Stickerazo: las pantallas y lo que hace cada botón.
//  Inicio → (foto) → Recortá → Decorá → Guardar en un pack → el pack (de 3 a 30 stickers) → Agregar a WhatsApp.
import { LADO, MARGEN, FUENTES, COLORES, cargarFuentes, recortarImagen, Sticker, exportarWebP, exportarBandeja } from './editor.js';
import * as P from './puente.js';

const $ = (s, r = document) => r.querySelector(s);
const MAX_ST = 30, MIN_ST = 3, MAX_FOTO = 1280;
export const ENLACE = 'https://play.google.com/store/apps/details?id=com.stickerazo.app';
const EMOJIS = ['😂', '🤣', '😭', '😍', '🥰', '😘', '😎', '🤔', '🙄', '😴', '🤯', '😡', '🥺', '😱', '🤡', '💀', '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '👌',
  '❤️', '💔', '🔥', '✨', '💯', '🎉', '🥳', '⚽', '🏆', '🍕', '🍺', '🧉', '☕', '🐶', '🐱', '💩', '👀', '🙈', '😅', '🤪', '😬', '🤨', '😤', '💤'];
const AYUDA = { tocar: 'Tocá algo para sumarlo o sacarlo', borrar: 'Pasá el dedo por lo que sobra', recuperar: 'Pasá el dedo por lo que falta' };
const capturar = (el, id) => { try { el.setPointerCapture(id); } catch (e) { /* (puntero que ya no está) */ } };
const lim = (v, a, b) => Math.max(a, Math.min(b, v));
const h = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lienzo = (w, hh) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(hh)); return c; };

// ---- íconos (dibujados acá, 24×24, trazo) ----
const ICONOS = {
  mas: '<path d="M12 5v14M5 12h14"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
  sig: '<path d="M9 5l7 7-7 7"/>',
  texto: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  camara: '<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  galeria: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>',
  punto: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
  puntoG: '<circle cx="12" cy="12" r="8" fill="currentColor"/>',
  magia: '<path d="M4 20L15 9"/><path d="M13.5 7.5l3 3"/><path d="M18 3v4M16 5h4M20 12v3M18.5 13.5h3M9 3v2M8 4h2"/>',
  dedo: '<circle cx="12" cy="12" r="2.5" fill="currentColor"/><circle cx="12" cy="12" r="7"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>',
  goma: '<path d="M8.5 19.5h11"/><path d="M5 15.5l9.5-9.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19.5H8.5z"/><path d="M9.5 11l4 4"/>',
  pincel: '<path d="M4 20l1.2-4.2L16 5l3 3L8.2 18.8z"/><path d="M14 7l3 3"/>',
  foto: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>',
  deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  cara: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.2 4.2 0 0 0 7 0"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>',
  borde: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><rect x="8" y="8" width="8" height="8" rx="2" fill="currentColor"/>',
  frente: '<rect x="3" y="3" width="11" height="11" rx="2"/><rect x="10" y="10" width="11" height="11" rx="2" fill="currentColor"/>',
  tacho: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5"/>',
  puntos: '<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>',
  whats: '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"/><path d="M12 8.5v7M8.5 12h7"/>',
  compartir: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
  lapiz: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
function iconos(raiz = document) {
  for (const i of raiz.querySelectorAll('i[data-i]:not([data-hecho])')) {
    i.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[i.dataset.i] || ''}</svg>`;
    i.dataset.hecho = '1';
  }
}

// ---- estado ----
const E = {
  vista: 'vInicio', origen: 'vInicio', packs: [], packId: null,
  foto: null, W: 0, H: 0, mascara: null, corte: null, sil: null, deshacer: [], herr: 'tocar', sucio: false, ocupado: false,
  st: null, desdeRecorte: false, compuesto: null, ultFuente: 'LuckiestGuy', ultColor: '#ffffff', ultContorno: '#111111',
};
// el recorte (los modelos pesan: se cargan una vez, de fondo)
let R = null;
const recorte = () => (R ||= import('./recorte.js').then(async (m) => { await m.preparar(); return m; }).catch((e) => { R = null; throw e; }));

// ---- avisos y hojas ----
let tAviso = 0;
function aviso(texto, ms = 2800) {
  // justo arriba de los botones de abajo de la pantalla (que no tape lo que se acaba de hacer)
  const a = $('#aviso'), piso = $(`#${E.vista} .pie, #${E.vista} .barra`), arriba = piso ? piso.getBoundingClientRect().top : window.innerHeight - 16;
  a.style.bottom = Math.round(window.innerHeight - arriba + 12) + 'px'; a.textContent = texto; a.classList.remove('oc'); clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.add('oc'), ms); }
function modal(html, opc = {}) {
  const m = $('#modal'); m.innerHTML = html; m.className = 'modal' + (opc.claro ? ' claro' : ''); iconos(m);
  m.onclick = (ev) => { if (ev.target === m) cerrarModal(); };
  E.alCerrar = opc.alCerrar || null;
  if (opc.claro) { const cont = $('#' + E.vista + ' .lienzoCont'), hj = $('.hoja', m); if (cont) { const libre = window.innerHeight - cont.getBoundingClientRect().bottom; cont.style.marginBottom = Math.max(0, hj.offsetHeight - libre + 10) + 'px'; } }
  return m;
}
function cerrarModal() { const m = $('#modal'); if (m.classList.contains('oc')) return; m.className = 'modal oc'; m.innerHTML = ''; for (const c of document.querySelectorAll('.lienzoCont')) c.style.marginBottom = ''; const f = E.alCerrar; E.alCerrar = null; if (f) f(); }
const hayModal = () => !$('#modal').classList.contains('oc');
function confirmar(texto, si = 'Sí', peligro = true) {
  return new Promise((ok) => {
    let r = false;
    const m = modal(`<div class="hoja"><h3>${h(texto)}</h3><div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1"${peligro ? ' style="background:var(--rojo);color:#fff"' : ''}>${h(si)}</button></div></div>`, { alCerrar: () => ok(r) });
    m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
    m.querySelector('[data-x="1"]').onclick = () => { r = true; cerrarModal(); };
  });
}
// elegir de 1 a 3 emojis (WhatsApp los usa para sugerir el sticker)
function htmlEmojis(sel) { return `<div class="emojis">${EMOJIS.map((e) => `<button data-v="${e}"${sel.includes(e) ? ' class="act"' : ''}>${e}</button>`).join('')}</div>`; }
function manejarEmojis(cont, sel, alCambiar) {
  cont.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return; const v = b.dataset.v, i = sel.indexOf(v);
    if (i >= 0) sel.splice(i, 1); else { sel.push(v); if (sel.length > 3) sel.shift(); }
    for (const x of cont.children) x.classList.toggle('act', sel.includes(x.dataset.v));
    if (alCambiar) alCambiar();
  };
}

// ---- vistas ----
function ir(v) {
  for (const s of document.querySelectorAll('.vista')) s.classList.toggle('oc', s.id !== v);
  const s = $('#' + v); s.classList.remove('entra'); void s.offsetWidth; s.classList.add('entra');
  E.vista = v;
  if (v === 'vRecorte' || v === 'vEditor') $('#aviso').classList.add('oc');
  if (v === 'vInicio') pintarInicio();
  else if (v === 'vRecorte') { marcarHerr(); pedirR(); }
  else if (v === 'vEditor') pedirE(true);
  else if (v === 'vPack') pintarPack();
}
async function atras() {
  if (hayModal()) { cerrarModal(); return; }
  if (E.ocupado) return;
  if (E.vista === 'vRecorte') ir(E.origen);
  else if (E.vista === 'vEditor') {
    if (E.desdeRecorte) return ir('vRecorte');
    if (E.st && E.st.capas.length && !(await confirmar('¿Tirar este sticker?', 'Tirar'))) return;
    E.st = null; ir(E.origen);
  } else if (E.vista === 'vPack') ir('vInicio');
}
// el botón «atrás» del celular (Java pregunta: true = lo manejó la app; false = salir)
window.__szAtras = () => { const maneja = hayModal() || E.vista !== 'vInicio'; atras(); return maneja; };
for (const b of document.querySelectorAll('.volver')) b.onclick = () => atras();

// ---- crear: galería, cámara o sólo texto ----
function elegirFoto(cam) { const i = cam ? $('#archivoCam') : $('#archivo'); i.value = ''; i.click(); }
for (const id of ['#archivo', '#archivoCam']) $(id).addEventListener('change', (ev) => { const f = ev.target.files && ev.target.files[0]; if (f) abrirFoto(f); });
function crear(como, origen) {
  E.origen = origen;
  if (como === 'texto') { E.st = new Sticker(); E.desdeRecorte = false; ir('vEditor'); abrirTexto(null); }
  else elegirFoto(como === 'camara');
}
$('#bCrear').onclick = () => crear('galeria', 'vInicio');
$('#bCamara').onclick = () => crear('camara', 'vInicio');
$('#bTexto').onclick = () => crear('texto', 'vInicio');
function menuNuevo(origen) {
  const m = modal(`<div class="hoja"><h3>Otro sticker</h3><div class="lista">
    <button class="opc" data-x="galeria"><i data-i="galeria"></i><span>Elegir una foto</span></button>
    <button class="opc" data-x="camara"><i data-i="camara"></i><span>Sacar una foto</span></button>
    <button class="opc" data-x="texto"><i data-i="texto"></i><span>Sólo texto</span></button></div></div>`);
  m.querySelector('.lista').onclick = (ev) => { const b = ev.target.closest('button'); if (b) { cerrarModal(); crear(b.dataset.x, origen); } };
}

async function abrirFoto(f) {
  let img;
  try { img = await createImageBitmap(f); } catch (e) {
    try { img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = URL.createObjectURL(f); }); } catch (e2) { return aviso('No pude abrir esa imagen'); }
  }
  const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight, k = Math.min(1, MAX_FOTO / Math.max(w0, h0));
  const W = Math.max(1, Math.round(w0 * k)), H = Math.max(1, Math.round(h0 * k));
  const foto = lienzo(W, H), g = foto.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, W, H);
  if (img.close) img.close();
  const mascara = lienzo(W, H); mascara.getContext('2d', { willReadFrequently: true });
  Object.assign(E, { foto, W, H, mascara, corte: lienzo(W, H), sil: lienzo(W, H), deshacer: [], herr: 'tocar', st: null, desdeRecorte: false, sucio: true });
  ayudaR('Buscando qué recortar…'); ir('vRecorte'); await auto(false);
}

// ================= RECORTÁ =================
const RV = { c: $('#rLienzo'), esc: 1, ox: 0, oy: 0, d: 1, raf: 0, lupa: null, cursor: null, trazo: null };
const mctx = () => E.mascara.getContext('2d', { willReadFrequently: true });
function medir(c) {
  const r = c.getBoundingClientRect(), d = Math.min(3, window.devicePixelRatio || 1), w = Math.max(1, Math.round(r.width * d)), hh = Math.max(1, Math.round(r.height * d));
  if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
  return { w, h: hh, d };
}
function camino(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
let patron = null;
function damero(g, x, y, w, hh, t) {
  if (!patron || patron.t !== t) { const c = lienzo(t * 2, t * 2), q = c.getContext('2d'); q.fillStyle = '#2a2639'; q.fillRect(0, 0, t * 2, t * 2); q.fillStyle = '#211e2e'; q.fillRect(0, 0, t, t); q.fillRect(t, t, t, t); patron = { t, p: g.createPattern(c, 'repeat') }; }
  g.save(); g.translate(x, y); g.fillStyle = patron.p; g.fillRect(0, 0, w, hh); g.restore();
}
function ayudaR(t) { $('#rAyuda').textContent = t; }
function pedirR() { if (!RV.raf) RV.raf = requestAnimationFrame(() => { RV.raf = 0; pintarR(); }); }
function actualizarCorte() {
  const { W, H } = E, c = E.corte.getContext('2d'), s = E.sil.getContext('2d');
  c.globalCompositeOperation = 'copy'; c.drawImage(E.foto, 0, 0); c.globalCompositeOperation = 'destination-in'; c.drawImage(E.mascara, 0, 0); c.globalCompositeOperation = 'source-over';
  s.globalCompositeOperation = 'copy'; s.drawImage(E.mascara, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#ffd23f'; s.fillRect(0, 0, W, H); s.globalCompositeOperation = 'source-over';
}
// la foto oscurecida, el contorno amarillo y lo recortado encima (en coordenadas de la foto; o = grosor del contorno)
function escenaR(g, o) {
  g.drawImage(E.foto, 0, 0); g.fillStyle = 'rgba(14,12,22,0.74)'; g.fillRect(0, 0, E.W, E.H);
  for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; g.drawImage(E.sil, Math.cos(t) * o, Math.sin(t) * o); }
  g.drawImage(E.corte, 0, 0);
}
const pincel = () => +$('#rPincel').value;
function pintarR() {
  if (E.vista !== 'vRecorte' || !E.foto) return;
  if (E.sucio) { actualizarCorte(); E.sucio = false; }
  const { w, h: hh, d } = medir(RV.c), g = RV.c.getContext('2d'), pad = 4 * d;
  const esc = Math.min((w - 2 * pad) / E.W, (hh - 2 * pad) / E.H), ox = (w - E.W * esc) / 2, oy = (hh - E.H * esc) / 2;
  Object.assign(RV, { esc, ox, oy, d });
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, hh);
  g.save(); camino(g, ox, oy, E.W * esc, E.H * esc, 16 * d); g.clip(); g.setTransform(esc, 0, 0, esc, ox, oy); escenaR(g, (2.4 * d) / esc); g.restore();
  const conPincel = E.herr !== 'tocar';
  if (conPincel && RV.cursor && !RV.lupa) { g.lineWidth = 1.5 * d; g.strokeStyle = '#fff'; g.beginPath(); g.arc(RV.cursor.sx, RV.cursor.sy, (pincel() * d) / 2, 0, Math.PI * 2); g.stroke(); }
  if (RV.lupa) {
    // la lupa: lo que tapa el dedo, al doble, en una esquina
    const L = 64 * d, z = 2, lx = RV.lupa.sx < w / 2 ? w - L - 8 * d : L + 8 * d, ly = L + 8 * d;
    g.save(); g.beginPath(); g.arc(lx, ly, L, 0, Math.PI * 2); g.fillStyle = '#14121c'; g.fill(); g.clip();
    g.setTransform(esc * z, 0, 0, esc * z, lx - (RV.lupa.sx - ox) * z, ly - (RV.lupa.sy - oy) * z); escenaR(g, (2.4 * d) / (esc * z)); g.restore();
    g.lineWidth = 3 * d; g.strokeStyle = '#fff'; g.beginPath(); g.arc(lx, ly, L, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.5 * d; g.strokeStyle = E.herr === 'borrar' ? '#ff5a5f' : '#4cd964'; g.beginPath(); g.arc(lx, ly, (pincel() * d * z) / 2, 0, Math.PI * 2); g.stroke();
  }
}
function enFoto(ev) {
  const r = RV.c.getBoundingClientRect(), sx = (ev.clientX - r.left) * RV.d, sy = (ev.clientY - r.top) * RV.d;
  return { x: (sx - RV.ox) / RV.esc, y: (sy - RV.oy) / RV.esc, sx, sy };
}
// la máscara como alfa (para deshacer y para el recorte final)
function alfa() { const d = mctx().getImageData(0, 0, E.W, E.H).data, a = new Uint8Array(E.W * E.H); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]; return a; }
function ponerAlfa(a) {
  const g = mctx(), im = g.createImageData(E.W, E.H), d = im.data;
  for (let i = 0; i < a.length; i++) { const j = i * 4; d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = a[i]; }
  g.putImageData(im, 0, 0); E.sucio = true; pedirR();
}
function cuanto() { const a = alfa(); let n = 0; for (let i = 0; i < a.length; i++) if (a[i] > 128) n++; return n / a.length; }
function guardarDeshacer() { E.deshacer.push(alfa()); if (E.deshacer.length > 12) E.deshacer.shift(); marcarHerr(); }
function deshacer() { const a = E.deshacer.pop(); if (a) ponerAlfa(a); marcarHerr(); }
function aCanvas(r) {
  const t = lienzo(r.w, r.h), g = t.getContext('2d'), im = g.createImageData(r.w, r.h), d = im.data;
  for (let i = 0; i < r.mascara.length; i++) { const j = i * 4; d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = r.mascara[i]; }
  g.putImageData(im, 0, 0); return t;
}
let tGira = 0;
function ocupado(si, texto) {
  E.ocupado = si; clearTimeout(tGira);
  if (si) { $('#rGira span').textContent = texto || 'Recortando…'; tGira = setTimeout(() => $('#rGira').classList.remove('oc'), 160); }
  else $('#rGira').classList.add('oc');
}
async function auto(conDeshacer = true) {
  ocupado(true, 'Recortando…');
  try {
    const m = await recorte(), r = await m.recortarSolo(E.foto);
    if (conDeshacer) guardarDeshacer();
    const g = mctx(); g.clearRect(0, 0, E.W, E.H); g.imageSmoothingQuality = 'high'; g.drawImage(aCanvas(r), 0, 0, E.W, E.H);
    E.sucio = true; E.herr = 'tocar'; marcarHerr(); pedirR();
    ayudaR(cuanto() < 0.003 ? 'No encontré qué recortar: tocá lo que querés' : r.como === 'persona' ? '¡Listo! Si falta o sobra algo, tocalo' : 'Recorté lo del medio · tocá algo para sumarlo');
  } catch (e) { console.error(e); ayudaR('No pude recortar solo: tocá lo que querés'); }
  finally { ocupado(false); }
}
async function tocarEn(p) {
  if (p.x < 0 || p.y < 0 || p.x >= E.W || p.y >= E.H) return;
  const adentro = mctx().getImageData(p.x | 0, p.y | 0, 1, 1).data[3] > 128;
  ocupado(true, adentro ? 'Sacando…' : 'Recortando…');
  try {
    const m = await recorte(), r = await m.recortarTocando(E.foto, p.x / E.W, p.y / E.H);
    guardarDeshacer();
    const g = mctx(); g.save(); g.globalCompositeOperation = adentro ? 'destination-out' : 'source-over'; g.imageSmoothingQuality = 'high'; g.drawImage(aCanvas(r), 0, 0, E.W, E.H); g.restore();
    E.sucio = true; pedirR(); ayudaR(adentro ? 'Saqué eso · Deshacer lo vuelve a poner' : 'Sumado · tocá otra cosa o seguí');
  } catch (e) { console.error(e); aviso('No pude recortar ahí'); }
  finally { ocupado(false); }
}
function pincelar(a, b) {
  const g = mctx(); g.save(); g.globalCompositeOperation = E.herr === 'borrar' ? 'destination-out' : 'source-over';
  g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round'; g.lineWidth = (pincel() * RV.d) / RV.esc;
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x + 0.01, b.y); g.stroke(); g.restore(); E.sucio = true; pedirR();
}
RV.c.addEventListener('pointerdown', (ev) => {
  if (E.ocupado || RV.trazo) return;
  const p = enFoto(ev);
  if (E.herr === 'tocar') { tocarEn(p); return; }
  capturar(RV.c, ev.pointerId); guardarDeshacer();
  RV.trazo = { id: ev.pointerId, ult: p }; if (ev.pointerType !== 'mouse') RV.lupa = p; pincelar(p, p);
});
RV.c.addEventListener('pointermove', (ev) => {
  const p = enFoto(ev);
  if (RV.trazo && RV.trazo.id === ev.pointerId) { pincelar(RV.trazo.ult, p); RV.trazo.ult = p; if (RV.lupa) RV.lupa = p; }
  else if (ev.pointerType === 'mouse') { RV.cursor = p; pedirR(); }
});
for (const t of ['pointerup', 'pointercancel']) RV.c.addEventListener(t, (ev) => { if (RV.trazo && RV.trazo.id === ev.pointerId) { RV.trazo = null; RV.lupa = null; pedirR(); } });
RV.c.addEventListener('pointerleave', () => { RV.cursor = null; pedirR(); });
$('#rPincel').addEventListener('input', () => { RV.cursor = { sx: RV.c.width / 2, sy: RV.c.height / 2 }; pedirR(); });
function marcarHerr() {
  for (const b of $('#rHerr').children) b.classList.toggle('act', b.dataset.h === E.herr);
  $('#rHerr [data-h="deshacer"]').disabled = !E.deshacer.length;
  $('#rPincelCont').classList.toggle('oc', E.herr === 'tocar');
}
$('#rHerr').onclick = (ev) => {
  const b = ev.target.closest('button'); if (!b || E.ocupado) return; const k = b.dataset.h;
  if (k === 'auto') auto(true);
  else if (k === 'entera') { guardarDeshacer(); const g = mctx(); g.fillStyle = '#fff'; g.fillRect(0, 0, E.W, E.H); E.sucio = true; pedirR(); ayudaR('La foto entera · Borrar saca lo que sobra'); }
  else if (k === 'deshacer') deshacer();
  else { E.herr = k; marcarHerr(); ayudaR(AYUDA[k]); pedirR(); }
};
$('#rSig').onclick = () => {
  if (E.ocupado) return;
  const cut = recortarImagen(E.foto, alfa(), E.W, E.H);
  if (!cut || cut.width * cut.height < 100) return aviso('No quedó nada recortado: tocá lo que querés');
  let src = cut; const k = Math.min(1, 1024 / Math.max(cut.width, cut.height));
  if (k < 1) { src = lienzo(cut.width * k, cut.height * k); const g = src.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cut, 0, 0, src.width, src.height); }
  const viejo = E.desdeRecorte && E.st && E.st.capas.find((c) => c.recorte);
  if (viejo) { viejo.esc *= viejo.src.width / src.width; viejo.src = src; } // (volvió a recortar: queda en el mismo lugar y del mismo ancho)
  else { if (!E.st || !E.desdeRecorte) E.st = new Sticker(); const c = E.st.agregarImagen(src); c.recorte = true; E.st.capas.unshift(E.st.capas.pop()); E.st.sel = 0; }
  E.desdeRecorte = true; ir('vEditor');
};

// ================= DECORÁ =================
const EV = { c: $('#eLienzo'), esc: 1, ox: 0, oy: 0, d: 1, raf: 0, p: new Map(), gesto: null, ult: { t: 0, i: -1 }, manija: null };
function pedirE(recomponer) { if (recomponer) E.compuesto = null; if (!EV.raf) EV.raf = requestAnimationFrame(() => { EV.raf = 0; pintarE(); }); }
function pintarE() {
  if (E.vista !== 'vEditor' || !E.st) return;
  const { w, h: hh, d } = medir(EV.c), g = EV.c.getContext('2d'), lado = Math.max(10, Math.min(w, hh) - 8 * d), esc = lado / LADO, ox = (w - lado) / 2, oy = (hh - lado) / 2, s = E.st;
  Object.assign(EV, { esc, ox, oy, d });
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, hh);
  g.save(); camino(g, ox, oy, lado, lado, 20 * d); g.clip(); damero(g, ox, oy, lado, lado, 14 * d); g.restore();
  g.save(); g.setLineDash([5 * d, 7 * d]); g.lineWidth = d; g.strokeStyle = 'rgba(255,255,255,0.2)'; g.strokeRect(ox + MARGEN * esc, oy + MARGEN * esc, (LADO - 2 * MARGEN) * esc, (LADO - 2 * MARGEN) * esc); g.restore();
  if (!E.compuesto) E.compuesto = s.componer();
  g.drawImage(E.compuesto, ox, oy, lado, lado);
  EV.manija = null;
  const c = s.capas[s.sel];
  if (c) {
    const m = s.medidas(c), W2 = (m.w * c.esc / 2 + 8) * esc, H2 = (m.h * c.esc / 2 + 8) * esc, cx = ox + c.x * esc, cy = oy + c.y * esc;
    g.save(); g.translate(cx, cy); g.rotate(c.rot);
    g.lineWidth = 2 * d; g.strokeStyle = '#ffd23f'; g.setLineDash([7 * d, 5 * d]); g.strokeRect(-W2, -H2, W2 * 2, H2 * 2); g.restore();
    // la manija (agrandar y girar), donde se vea
    const cs = Math.cos(c.rot), sn = Math.sin(c.rot), r = 15 * d;
    const mx = lim(cx + W2 * cs - H2 * sn, r + 2, w - r - 2), my = lim(cy + W2 * sn + H2 * cs, r + 2, hh - r - 2);
    EV.manija = { x: mx, y: my };
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1c1503'; g.lineWidth = 2.2 * d; g.lineCap = 'round'; g.beginPath(); g.arc(mx, my, 6.5 * d, -0.4, 3.9); g.stroke();
    const fx = mx + 6.5 * d * Math.cos(3.9), fy = my + 6.5 * d * Math.sin(3.9);
    g.beginPath(); g.moveTo(fx - 4 * d, fy - 1 * d); g.lineTo(fx, fy); g.lineTo(fx + 1 * d, fy - 4.5 * d); g.stroke();
  }
  if (!s.capas.length) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = `600 ${15 * d}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillText('Agregá un texto o un emoji', w / 2, hh / 2); }
  marcarEditor();
}
function marcarEditor() {
  const s = E.st, c = s && s.capas[s.sel];
  for (const k of ['frente', 'borrar']) $(`#vEditor [data-e="${k}"]`).disabled = !c;
  $('#eAyuda').textContent = !s || !s.capas.length ? 'Sumale un texto o un emoji' : !c ? 'Tocá algo para moverlo' : c.tipo === 'texto' ? 'Tocá dos veces el texto para cambiarlo' : 'Arrastrá para mover · la manija agranda y gira';
}
function enSt(ev) {
  const r = EV.c.getBoundingClientRect(), sx = (ev.clientX - r.left) * EV.d, sy = (ev.clientY - r.top) * EV.d;
  return { x: (sx - EV.ox) / EV.esc, y: (sy - EV.oy) / EV.esc, sx, sy };
}
const escala = (c, e) => { const m = E.st.medidas(c), l = Math.max(m.w, m.h) || 1; return lim(e, 40 / l, (LADO * 2.2) / l); };
const imantar = (r) => { const a = ((((r + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI; return Math.abs(a) < 0.06 ? 0 : a; };
function empezarPinza() {
  const s = E.st, [a, b] = [...EV.p.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  let i = s.sel; if (i < 0) i = s.tocada(mx, my); if (i < 0) i = s.capas.findIndex((c) => c.tipo === 'img');
  if (i < 0) { EV.gesto = null; return; }
  s.sel = i; const c = s.capas[i];
  EV.gesto = { tipo: 'pinza', c, d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, a0: Math.atan2(b.y - a.y, b.x - a.x), esc0: c.esc, rot0: c.rot, mx0: mx, my0: my, x0: c.x, y0: c.y };
}
EV.c.addEventListener('pointerdown', (ev) => {
  const s = E.st; if (!s) return;
  capturar(EV.c, ev.pointerId); const p = enSt(ev); EV.p.set(ev.pointerId, p);
  if (EV.p.size === 2) { empezarPinza(); pedirE(); return; }
  if (EV.p.size > 2) return;
  const c = s.capas[s.sel];
  if (c && EV.manija && Math.hypot(p.sx - EV.manija.x, p.sy - EV.manija.y) < 26 * EV.d) {
    EV.gesto = { tipo: 'manija', c, d0: Math.hypot(p.x - c.x, p.y - c.y) || 1, a0: Math.atan2(p.y - c.y, p.x - c.x), esc0: c.esc, rot0: c.rot }; return;
  }
  const i = s.tocada(p.x, p.y), ahora = performance.now();
  if (i >= 0 && i === EV.ult.i && ahora - EV.ult.t < 350 && s.capas[i].tipo === 'texto') { EV.p.clear(); EV.gesto = null; EV.ult = { t: 0, i: -1 }; abrirTexto(s.capas[i]); return; }
  EV.ult = { t: ahora, i }; s.sel = i;
  EV.gesto = i >= 0 ? { tipo: 'mover', c: s.capas[i], dx: p.x - s.capas[i].x, dy: p.y - s.capas[i].y } : null;
  pedirE();
});
EV.c.addEventListener('pointermove', (ev) => {
  if (!EV.p.has(ev.pointerId)) return;
  const p = enSt(ev); EV.p.set(ev.pointerId, p); const G = EV.gesto; if (!G) return; const c = G.c;
  if (G.tipo === 'mover') { c.x = lim(p.x - G.dx, 0, LADO); c.y = lim(p.y - G.dy, 0, LADO); }
  else if (G.tipo === 'manija') { c.esc = escala(c, (G.esc0 * Math.hypot(p.x - c.x, p.y - c.y)) / G.d0); c.rot = imantar(G.rot0 + Math.atan2(p.y - c.y, p.x - c.x) - G.a0); }
  else if (G.tipo === 'pinza' && EV.p.size >= 2) {
    const [a, b] = [...EV.p.values()];
    c.esc = escala(c, (G.esc0 * Math.hypot(b.x - a.x, b.y - a.y)) / G.d0); c.rot = imantar(G.rot0 + Math.atan2(b.y - a.y, b.x - a.x) - G.a0);
    c.x = lim(G.x0 + (a.x + b.x) / 2 - G.mx0, 0, LADO); c.y = lim(G.y0 + (a.y + b.y) / 2 - G.my0, 0, LADO);
  }
  pedirE(true);
});
function soltar(ev) {
  if (!EV.p.delete(ev.pointerId)) return;
  if (EV.p.size === 1 && EV.gesto && EV.gesto.tipo === 'pinza') { const p = [...EV.p.values()][0], c = EV.gesto.c; EV.gesto = { tipo: 'mover', c, dx: p.x - c.x, dy: p.y - c.y }; }
  else if (!EV.p.size) EV.gesto = null;
}
EV.c.addEventListener('pointerup', soltar); EV.c.addEventListener('pointercancel', soltar);
EV.c.addEventListener('wheel', (ev) => {
  const s = E.st, c = s && s.capas[s.sel]; if (!c) return; ev.preventDefault();
  if (ev.shiftKey) c.rot = imantar(c.rot + ev.deltaY * 0.003); else c.esc = escala(c, c.esc * Math.exp(-ev.deltaY * 0.0015));
  pedirE(true);
}, { passive: false });

$('#vEditor .barra').onclick = (ev) => {
  const b = ev.target.closest('button'); if (!b || !E.st) return; const s = E.st;
  const k = b.dataset.e;
  if (k === 'texto') abrirTexto(null);
  else if (k === 'emoji') abrirEmoji();
  else if (k === 'borde') abrirBorde();
  else if (k === 'frente') { s.alFrente(); pedirE(true); }
  else if (k === 'borrar') { s.borrarSel(); pedirE(true); }
};
const contornoCss = (c) => Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * Math.PI * 2; return `${(Math.cos(a) * 2.5).toFixed(1)}px ${(Math.sin(a) * 2.5).toFixed(1)}px 0 ${c}`; }).join(',');
function abrirTexto(capa) {
  const t = capa ? { texto: capa.texto, fuente: capa.fuente, color: capa.color, contorno: capa.contorno || '' } : { texto: '', fuente: E.ultFuente, color: E.ultColor, contorno: E.ultContorno };
  const m = modal(`<div class="hoja"><h3>${capa ? 'Cambiar el texto' : 'Agregar texto'}</h3>
    <textarea id="tTx" rows="2" maxlength="80" placeholder="Escribí acá" autocomplete="off" autocapitalize="sentences"></textarea>
    <div class="etq">Letra</div><div class="chips" id="tF">${FUENTES.map((f) => `<button class="chip" data-v="${f.id}" style="font-family:'${f.id}'">${f.nombre}</button>`).join('')}</div>
    <div class="etq">Color</div><div class="colores" id="tC">${COLORES.map((c) => `<button class="color" data-v="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div>
    <div class="etq">Contorno</div><div class="chips" id="tB">${[['#111111', 'Negro'], ['#ffffff', 'Blanco'], ['', 'Sin contorno']].map(([v, n]) => `<button class="chip" data-v="${v}">${n}</button>`).join('')}</div>
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Listo</button></div></div>`);
  const tx = $('#tTx', m); tx.value = t.texto;
  const marcar = (sel, v) => { for (const b of $(sel, m).children) b.classList.toggle('act', b.dataset.v === v); };
  const vista = () => { tx.style.fontFamily = `'${t.fuente}', sans-serif`; tx.style.color = t.color; tx.style.textShadow = t.contorno ? contornoCss(t.contorno) : 'none'; marcar('#tF', t.fuente); marcar('#tC', t.color); marcar('#tB', t.contorno); };
  const elegir = (sel, k) => { $(sel, m).onclick = (ev) => { const b = ev.target.closest('button'); if (b) { t[k] = b.dataset.v; vista(); } }; };
  elegir('#tF', 'fuente'); elegir('#tC', 'color'); elegir('#tB', 'contorno');
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => {
    t.texto = tx.value.replace(/\s+$/g, '').replace(/^\s+/g, ''); cerrarModal(); const s = E.st;
    Object.assign(E, { ultFuente: t.fuente, ultColor: t.color, ultContorno: t.contorno });
    if (!t.texto) { if (capa) { s.capas.splice(s.capas.indexOf(capa), 1); s.sel = -1; } pedirE(true); return; }
    if (capa) {
      Object.assign(capa, t); const md = s.medidas(capa), maxW = LADO - 2 * (MARGEN + s.borde) - 8;
      if (md.w * capa.esc > maxW) capa.esc = maxW / md.w; s.sel = s.capas.indexOf(capa);
    } else s.agregarTexto(t);
    pedirE(true);
  };
  vista(); setTimeout(() => tx.focus(), 80);
}
const LUGARES_EMOJI = [[392, 128], [120, 128], [392, 384], [120, 384]];
function abrirEmoji() {
  const m = modal(`<div class="hoja"><h3>Emoji</h3>${htmlEmojis([])}</div>`);
  $('.emojis', m).onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return; cerrarModal();
    const n = E.st.capas.filter((c) => c.tipo === 'emoji').length, c = E.st.agregarEmoji(b.dataset.v), [x, y] = LUGARES_EMOJI[n % 4];
    c.x = x; c.y = y; c.rot = x > LADO / 2 ? -0.15 : 0.15; pedirE(true);
  };
}
function abrirBorde() {
  const s = E.st;
  const m = modal(`<div class="hoja">
    <div class="etq" style="margin-top:0">Borde</div><div class="chips" id="bG">${[[0, 'Sin'], [7, 'Fino'], [12, 'Normal'], [18, 'Grueso']].map(([v, n]) => `<button class="chip" data-v="${v}">${n}</button>`).join('')}</div>
    <div class="etq">Color del borde</div><div class="colores" id="bC">${['#ffffff', '#111111', '#ffd23f', '#ff3e8a', '#3ec7ff'].map((c) => `<button class="color" data-v="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div>
    <div class="botones"><button class="sec chipSombra" id="bS"><i data-i="ok"></i>Sombra</button><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  const marcar = () => {
    for (const b of $('#bG', m).children) b.classList.toggle('act', +b.dataset.v === s.borde);
    for (const b of $('#bC', m).children) b.classList.toggle('act', b.dataset.v === s.colorBorde);
    $('#bS', m).classList.toggle('act', s.sombra);
  };
  m.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return; const grupo = b.parentElement.id;
    if (grupo === 'bG') s.borde = +b.dataset.v; else if (grupo === 'bC') s.colorBorde = b.dataset.v; else if (b.id === 'bS') s.sombra = !s.sombra; else if (b.dataset.x) return cerrarModal();
    marcar(); pedirE(true);
  };
  marcar();
}

// ---- guardar el sticker en un pack ----
const packsOrden = (packs) => packs.slice().sort((a, b) => (b.mod || 0) - (a.mod || 0));
$('#eGuardar').onclick = async () => {
  const s = E.st; if (!s) return;
  if (!s.capas.length) return aviso('Agregale algo primero');
  s.sel = -1; pedirE(true);
  let comp = s.componer(); const sale = s.seSale() > 30, packs = packsOrden(E.packs = await P.leerPacks()), libres = packs.filter((p) => p.stickers.length < MAX_ST);
  let destino = (libres.find((p) => p.id === E.packId) || libres[0] || { id: 'nuevo' }).id;
  const emojis = s.capas.filter((c) => c.tipo === 'emoji').map((c) => c.ch).filter((e, i, a) => a.indexOf(e) === i).slice(0, 3);
  if (!emojis.length) emojis.push('😂');
  const urls = await Promise.all(libres.map((p) => (p.bandeja ? P.urlDe(p.id, p.bandeja, p.v) : '')));
  const m = modal(`<div class="hoja"><h3>Guardar sticker</h3>
    <div class="vistaPrevia"><img id="gImg" src="${comp.toDataURL()}" alt=""><p>Elegí el pack y 1 a 3 emojis: WhatsApp los usa para sugerirte el sticker cuando escribís.</p></div>
    ${sale ? '<div class="alerta" id="gSale"><span>Hay partes que tocan el borde y quedan cortadas</span><button class="chip" id="gEnc">Que entre todo</button></div>' : ''}
    ${libres.length ? `<div class="etq">Pack</div><div class="lista" id="gP">${libres.map((p, i) => `<button class="opc" data-v="${h(p.id)}">${urls[i] ? `<img src="${urls[i]}" alt="">` : '<i data-i="galeria"></i>'}<span>${h(p.nombre)}</span><small>${p.stickers.length}/${MAX_ST}</small></button>`).join('')}
      <button class="opc" data-v="nuevo"><i data-i="mas"></i><span>Pack nuevo</span></button></div>` : ''}
    <div id="gNC"><div class="etq">${libres.length ? 'Nombre del pack nuevo' : 'Nombre del pack'}</div><input id="gN" class="campo" maxlength="40" placeholder="Nombre del pack" value="${h(packs.length ? 'Mis stickers ' + (packs.length + 1) : 'Mis stickers')}"></div>
    <div class="etq">Emojis</div>${htmlEmojis(emojis)}
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Guardar</button></div></div>`);
  const marcar = () => { if ($('#gP', m)) for (const b of $('#gP', m).children) b.classList.toggle('act', b.dataset.v === destino); $('#gNC', m).classList.toggle('oc', destino !== 'nuevo'); m.querySelector('[data-x="1"]').disabled = !emojis.length; };
  if ($('#gP', m)) $('#gP', m).onclick = (ev) => { const b = ev.target.closest('button'); if (b) { destino = b.dataset.v; marcar(); if (destino === 'nuevo') $('#gN', m).focus(); } };
  manejarEmojis($('.emojis', m), emojis, marcar);
  if (sale) $('#gEnc', m).onclick = () => { s.encajar(); comp = s.componer(); $('#gImg', m).src = comp.toDataURL(); $('#gSale', m).remove(); pedirE(true); };
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = async (ev) => {
    ev.target.disabled = true;
    const nombre = $('#gN', m).value.trim() || 'Mis stickers';
    try { await guardarSticker(comp, destino, nombre, emojis.slice()); } catch (e) { console.error(e); aviso(String(e.message || e).includes('pesa') ? 'El sticker quedó muy pesado' : 'No se pudo guardar: ' + (e.message || e)); ev.target.disabled = false; }
  };
  marcar();
};
async function guardarSticker(comp, destino, nombre, emojis) {
  const { blob } = await exportarWebP(comp), packs = await P.leerPacks();
  let pack = packs.find((p) => p.id === destino);
  if (!pack) { pack = { id: 'p' + Date.now().toString(36), nombre, autor: 'Stickerazo', stickers: [], bandeja: '', v: 0, n: 0, creado: Date.now() }; packs.push(pack); }
  if (pack.stickers.length >= MAX_ST) throw new Error('ese pack ya tiene 30 stickers');
  pack.n = (pack.n || 0) + 1; const archivo = `s${pack.n}.webp`;
  await P.guardarArchivo(pack.id, archivo, blob);
  if (!pack.bandeja) { const b = await exportarBandeja(comp); pack.bandeja = b.type === 'image/png' ? 'bandeja.png' : 'bandeja.webp'; await P.guardarArchivo(pack.id, pack.bandeja, b); }
  pack.stickers.push({ archivo, emojis }); pack.v = (pack.v || 0) + 1; pack.mod = Date.now();
  await P.guardarPacks(packs); E.packs = packs;
  cerrarModal(); E.st = null; E.desdeRecorte = false; E.foto = null; E.packId = pack.id;
  ir('vPack');
  aviso('¡Guardado!');
}

// ================= INICIO =================
async function pintarInicio() {
  const packs = packsOrden(E.packs = await P.leerPacks()), cont = $('#packs');
  if (!packs.length) {
    cont.innerHTML = '<div class="vacio"><div class="vacioIco"><i data-i="magia"></i></div><b>Todavía no hiciste ningún pack</b><span>Elegí una foto: Stickerazo la recorta solo y en un minuto tenés tu primer sticker.</span></div>';
    return iconos(cont);
  }
  const tiras = await Promise.all(packs.map((p) => Promise.all(p.stickers.slice(0, 5).map((s) => P.urlDe(p.id, s.archivo, p.v)))));
  cont.innerHTML = packs.map((p, i) => {
    const n = p.stickers.length, celdas = Array.from({ length: 5 }, (_, k) => (k === 4 && n > 5 ? `<span class="masN">+${n - 4}</span>` : tiras[i][k] ? `<span><img src="${tiras[i][k]}" alt=""></span>` : '<span class="nada"></span>')).join('');
    return `<button class="packItem" data-p="${h(p.id)}"><div class="packCab"><b>${h(p.nombre)}</b><small class="${n < MIN_ST ? 'falta' : ''}">${n} sticker${n === 1 ? '' : 's'}${n < MIN_ST ? ` · faltan ${MIN_ST - n}` : ''}</small></div><div class="tira">${celdas}</div></button>`;
  }).join('');
}
$('#packs').onclick = (ev) => { const b = ev.target.closest('.packItem'); if (b) { E.packId = b.dataset.p; ir('vPack'); } };

// ================= EL PACK =================
const packActual = () => E.packs.find((p) => p.id === E.packId);
async function pintarPack() {
  E.packs = await P.leerPacks(); const pack = packActual(); if (!pack) return ir('vInicio');
  $('#pNombre').textContent = pack.nombre; const n = pack.stickers.length;
  const urls = await Promise.all(pack.stickers.map((s) => P.urlDe(pack.id, s.archivo, pack.v)));
  $('#pGrilla').innerHTML = pack.stickers.map((s, i) => `<button class="st" data-n="${i}"><img src="${urls[i]}" alt="Sticker ${i + 1}"></button>`).join('') +
    (n < MAX_ST ? '<button class="st nuevo" data-nuevo="1" aria-label="Otro sticker"><i data-i="mas"></i></button>' : '');
  iconos($('#pGrilla'));
  $('#pFalta').textContent = n < MIN_ST ? `${MIN_ST - n === 1 ? 'Te falta 1 sticker' : `Te faltan ${MIN_ST - n} stickers`} para pasarlo a WhatsApp (pide 3 como mínimo)` : `${n} de ${MAX_ST} stickers`;
  const bw = $('#pWhats'), ya = n >= MIN_ST && (await P.estaEnWhatsApp(pack.id));
  bw.disabled = n < MIN_ST; bw.classList.toggle('ya', ya); $('span', bw).textContent = ya ? 'Ya está en WhatsApp' : 'Agregar a WhatsApp';
  $('#pMas').disabled = n >= MAX_ST;
}
async function cambiarPack(f) {
  const packs = await P.leerPacks(), pack = packs.find((p) => p.id === E.packId); if (!pack) return;
  await f(pack, packs); pack.v = (pack.v || 0) + 1; pack.mod = Date.now(); await P.guardarPacks(packs); E.packs = packs;
}
$('#pGrilla').onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.nuevo) return menuNuevo('vPack'); hojaSticker(+b.dataset.n); };
$('#pMas').onclick = () => menuNuevo('vPack');
async function hojaSticker(i) {
  const pack = packActual(), s = pack && pack.stickers[i]; if (!s) return;
  const url = await P.urlDe(pack.id, s.archivo, pack.v);
  const m = modal(`<div class="hoja"><div class="stGrande"><img src="${url}" alt=""></div><div class="stEmojis">${s.emojis.join(' ')}</div><div class="lista">
    <button class="opc" data-x="emojis"><i data-i="cara"></i><span>Cambiar los emojis</span></button>
    <button class="opc" data-x="icono"><i data-i="galeria"></i><span>Usarlo de ícono del pack</span></button>
    <button class="opc peligro" data-x="borrar"><i data-i="tacho"></i><span>Borrar el sticker</span></button></div></div>`);
  $('.lista', m).onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return; const x = b.dataset.x;
    if (x === 'emojis') return elegirEmojisDe(i);
    if (x === 'icono') {
      cerrarModal();
      const bl = await P.blobDe(pack.id, s.archivo), bmp = await createImageBitmap(bl), c = lienzo(LADO, LADO); c.getContext('2d').drawImage(bmp, 0, 0, LADO, LADO);
      const t = await exportarBandeja(c);
      await cambiarPack(async (p) => { p.bandeja = t.type === 'image/png' ? 'bandeja.png' : 'bandeja.webp'; await P.guardarArchivo(p.id, p.bandeja, t); });
      aviso('Listo: ése es el ícono del pack'); return pintarPack();
    }
    if (x === 'borrar') {
      if (!(await confirmar('¿Borrar este sticker?', 'Borrar'))) return;
      await cambiarPack(async (p) => { const k = p.stickers.findIndex((z) => z.archivo === s.archivo); if (k >= 0) p.stickers.splice(k, 1); await P.borrarArchivo(p.id, s.archivo); });
      pintarPack();
    }
  };
}
function elegirEmojisDe(i) {
  const pack = packActual(), sel = pack.stickers[i].emojis.slice();
  const m = modal(`<div class="hoja"><h3>Emojis del sticker</h3><p>De 1 a 3. WhatsApp te sugiere el sticker cuando escribís uno de éstos.</p>${htmlEmojis(sel)}
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Listo</button></div></div>`);
  manejarEmojis($('.emojis', m), sel, () => { m.querySelector('[data-x="1"]').disabled = !sel.length; });
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = async () => { cerrarModal(); await cambiarPack((p) => { p.stickers[i].emojis = sel; }); pintarPack(); };
}
$('#pMenu').onclick = () => {
  const m = modal(`<div class="hoja"><h3>${h(packActual().nombre)}</h3><div class="lista">
    <button class="opc" data-x="nombre"><i data-i="lapiz"></i><span>Cambiarle el nombre</span></button>
    <button class="opc peligro" data-x="borrar"><i data-i="tacho"></i><span>Borrar el pack</span></button></div></div>`);
  $('.lista', m).onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.x === 'nombre') {
      const k = modal(`<div class="hoja"><h3>Nombre del pack</h3><input id="nN" class="campo" maxlength="40" value="${h(packActual().nombre)}"><div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Listo</button></div></div>`);
      const inp = $('#nN', k); setTimeout(() => { inp.focus(); inp.select(); }, 80);
      k.querySelector('[data-x="0"]').onclick = () => cerrarModal();
      k.querySelector('[data-x="1"]').onclick = async () => { const v = inp.value.trim(); cerrarModal(); if (v) { await cambiarPack((p) => { p.nombre = v; }); pintarPack(); } };
    } else if (await confirmar(`¿Borrar «${packActual().nombre}» con todos sus stickers?`, 'Borrar')) {
      const id = E.packId, packs = (await P.leerPacks()).filter((p) => p.id !== id);
      await P.borrarPack(id); await P.guardarPacks(packs); E.packs = packs; E.packId = null; ir('vInicio'); aviso('Pack borrado');
    }
  };
};
$('#pWhats').onclick = async () => {
  const pack = packActual(); if (!pack || pack.stickers.length < MIN_ST) return;
  const r = await P.agregarAWhatsApp(pack);
  if (r === 'ok') { aviso('¡Listo! Ya lo tenés en WhatsApp'); pintarPack(); }
  else if (r === 'cancelado') { /* nada */ }
  else if (r === 'sin_whatsapp') aviso('No encontré WhatsApp en este celular');
  else if (r === 'sin_app') modal('<div class="hoja"><h3>Desde la app</h3><p>WhatsApp sólo acepta packs que le pasa una app instalada. Bajate Stickerazo en el celular y lo agregás con este botón.</p><div class="botones"><button class="pri" data-x="1">Entendido</button></div></div>').querySelector('[data-x="1"]').onclick = () => cerrarModal();
  else aviso('WhatsApp no lo aceptó: ' + r);
};
$('#pCompartir').onclick = async () => { if (await P.compartir('Mirá los stickers que hago con Stickerazo 😎 Hacé los tuyos:', ENLACE)) { if (!P.esApp && !navigator.share) aviso('Copié el enlace'); } };

// ---- arranque ----
// (en la app, Java ya deja el lugar de las barras del sistema y del teclado: acá no se suma otra vez)
if (P.esApp) { document.documentElement.style.setProperty('--arriba', '0px'); document.documentElement.style.setProperty('--abajo', '0px'); }
iconos();
cargarFuentes('./').then(() => pedirE(true));
const alCambiarTam = () => { if (E.vista === 'vRecorte') pedirR(); else if (E.vista === 'vEditor') pedirE(); };
window.addEventListener('resize', alCambiarTam); if (window.ResizeObserver) { const ro = new ResizeObserver(alCambiarTam); ro.observe(RV.c); ro.observe(EV.c); }
pintarInicio();
setTimeout(() => recorte().catch(() => {}), 1200); // (los modelos, de fondo, para que el primer recorte salga enseguida)
window.__sz = { E, ir, atras, abrirFoto, recorte, aviso };
