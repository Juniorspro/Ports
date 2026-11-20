// Stickerazo: las pantallas y lo que hace cada botón.
//  Inicio → (foto) → Recortá → Decorá → Guardar en un pack → el pack (de 3 a 30 stickers) → Agregar a WhatsApp.
import { LADO, MARGEN, FUENTES, COLORES, ANIMACIONES, ANIM, cargarFuentes, recortarImagen, Sticker, exportarWebP, exportarBandeja, exportarAnimado, aBlob, ojoDePez, deformar, espejo, quemar, trucha, lentesXD } from './editor.js';
import * as P from './puente.js';
import { LISTOS, armarListo, emojisListo, prepararListo } from './listos.js';
import * as C from './comunidad.js';

const $ = (s, r = document) => r.querySelector(s);
const MAX_ST = 30, MIN_ST = 3, MAX_FOTO = 1280;
export const ENLACE = 'https://play.google.com/store/apps/details?id=com.stickerazo.app';
const EMOJIS = ['😂', '🤣', '😭', '😍', '🥰', '😘', '😎', '🤔', '🙄', '😴', '🤯', '😡', '🥺', '😱', '🤡', '💀', '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '👌',
  '❤️', '💔', '🔥', '✨', '💯', '🎉', '🥳', '⚽', '🏆', '🍕', '🍺', '🧉', '☕', '🐶', '🐱', '💩', '👀', '🙈', '😅', '🤪', '😬', '🤨', '😤', '💤'];
// ideas para el texto (frases nuestras, de acá)
const FRASES = ['DE UNA', 'NI AHÍ', 'QUÉ HACÉS', 'RE QUE SÍ', 'ME MATASTE', 'TODO BIEN', '¿POSTA?', 'NAAA', 'FUA', '¿Y MI MILANESA?', 'HOY NO ME CUIDO', 'ESTOY EN ESO',
  'MAÑANA ARRANCO', 'BANCAME UN TOQUE', 'UN MATE Y ARRANCO', 'NO PASA NADA', 'QUÉ CAPO', 'SE PUDRIÓ TODO', 'ME VOY A DORMIR', 'LA VERDAD QUE NO', 'JAJAJA', 'AGUANTE EL MATE'];
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
  casa: '<path d="M4 11.5L12 4.5l8 7"/><path d="M6 10v9.5h4.5v-5h3v5H18V10"/>',
  persona: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  corazon: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  bajar: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  nube: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.6 4.5 4.5 0 0 0 7 18.5z"/><path d="M12 16v-5.5M9.5 13l2.5-2.5 2.5 2.5"/>',
  bandera: '<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>',
  bloquear: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  candado: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  estrella: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  carpeta: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/>',
  anim: '<path d="M13 5.5a6.5 6.5 0 1 1 0 13"/><circle cx="13" cy="12" r="3.2" fill="currentColor"/><path d="M2.5 8.5h5M1.5 12h6M2.5 15.5h5"/>',
  copias: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/><path d="M14 11v6M11 14h6"/>',
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
  st: null, desdeRecorte: false, compuesto: null, editando: null, modo: 'auto', cabeza: null, mascaraAuto: null, tab: 'Feed', ultFuente: 'LuckiestGuy', ultColor: '#ffffff', ultContorno: '#111111',
};
// el recorte (los modelos pesan: se cargan una vez, de fondo)
let R = null;
const recorte = () => (R ||= import('./recorte.js').then(async (m) => { await m.preparar(); return m; }).catch((e) => { R = null; throw e; }));

// ---- avisos y hojas ----
let tAviso = 0;
function aviso(texto, ms = 2800) {
  // justo arriba de los botones de abajo de la pantalla (que no tape lo que se acaba de hacer)
  const a = $('#aviso'), piso = $(`#${E.vista} .pie, #${E.vista} .barra, #${E.vista} .tabs`), arriba = piso ? piso.getBoundingClientRect().top : window.innerHeight - 16;
  a.style.bottom = Math.round(window.innerHeight - arriba + 12) + 'px'; a.textContent = texto; a.classList.remove('oc'); clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.add('oc'), ms); }
function modal(html, opc = {}) {
  const m = $('#modal'); m.innerHTML = html; m.className = 'modal' + (opc.claro ? ' claro' : ''); iconos(m); $('#aviso').classList.add('oc');
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
// ================= LA TRANSICIÓN LÍQUIDA: bolas de color que salen del dedo, se juntan como líquido y se escurren =================
const LIQ = { c: $('#liquido'), corriendo: false };
let ultimoToque = { x: innerWidth / 2, y: innerHeight * 0.85 };
document.addEventListener('pointerdown', (ev) => { ultimoToque = { x: ev.clientX, y: ev.clientY }; }, true);
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
// (los colores de la marca, de arriba a abajo: rosa → naranja → violeta)
const PALETA = (() => { const p = new Uint8ClampedArray(256 * 3), cs = [[255, 62, 138], [255, 138, 26], [255, 210, 63], [124, 77, 255], [255, 62, 138]];
  for (let i = 0; i < 256; i++) { const t = (i / 255) * (cs.length - 1), k = Math.min(cs.length - 2, Math.floor(t)), f = t - k; for (let j = 0; j < 3; j++) p[i * 3 + j] = cs[k][j] + (cs[k + 1][j] - cs[k][j]) * f; } return p; })();
// cambio(): se llama con la pantalla tapada. soloSalida: ya arranca tapada (para lo que cambia al toque) y se escurre
function liquido(cambio, desde = ultimoToque, soloSalida = false) {
  const c = LIQ.c;
  if (quieto || !c || LIQ.corriendo) { if (cambio) cambio(); return; }
  LIQ.corriendo = true;
  const ES = 4, W = Math.ceil(innerWidth / ES), H = Math.ceil(innerHeight / ES); c.width = W; c.height = H; c.classList.remove('oc');
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, R = 0.55 * Math.hypot(W, H);
  const x0 = desde.x / ES, y0 = desde.y / ES, N = 14;
  const bolas = Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2 + Math.random() * 0.6, dist = (0.25 + Math.random() * 0.45) * Math.hypot(W, H);
    return { tx: Math.min(W, Math.max(0, x0 + Math.cos(a) * dist)), ty: Math.min(H, Math.max(0, y0 + Math.sin(a) * dist)), r: R * (0.16 + Math.random() * 0.3), cae: 0.3 + Math.random() * 0.9, demora: Math.random() * 0.35 }; });
  const T1 = soloSalida ? 0 : 360, T2 = 520, t0 = performance.now(), suave = (t) => 1 - Math.pow(1 - t, 3);
  let cambiado = false;
  const cuadro = (ahora) => {
    const t = ahora - t0, entra = T1 ? Math.min(1, t / T1) : 1, sale = t < T1 ? 0 : Math.min(1, (t - T1) / T2);
    if (!cambiado && entra >= 1) { cambiado = true; if (cambio) cambio(); }
    // (las bolas salen del dedo y crecen; al final del tapado se llena todo; al destapar se escurren hacia abajo)
    const pe = suave(entra), ps = suave(sale), relleno = sale > 0 ? Math.max(0, 1 - ps * 4) * 1.4 : Math.pow(Math.max(0, (pe - 0.8) / 0.2), 2) * 1.4;
    const B = bolas.map((b) => {
      const pb = suave(Math.max(0, Math.min(1, (entra - b.demora) / (1 - b.demora)))), qb = Math.max(0, Math.min(1, (sale - b.demora * 0.6) / (1 - b.demora * 0.6)));
      const x = x0 + (b.tx - x0) * pb, y = y0 + (b.ty - y0) * pb + Math.pow(qb, 1.6) * H * b.cae, r = b.r * (0.1 + 0.9 * pb) * Math.pow(1 - qb, 0.7);
      return [x, y, r * r];
    });
    const corre = Math.floor(t / 6);
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) {
      let f = relleno; for (let k = 0; k < N; k++) { const dx = x - B[k][0], dy = y - B[k][1]; f += B[k][2] / (dx * dx + dy * dy + 1); }
      if (f < 0.8) { d[i + 3] = 0; continue; }
      const p = ((((y + x * 0.35 + corre) / H) * 200) & 255) * 3, luz = Math.min(40, (f - 1) * 6);
      d[i] = PALETA[p] + luz; d[i + 1] = PALETA[p + 1] + luz; d[i + 2] = PALETA[p + 2] + luz; d[i + 3] = Math.min(255, (f - 0.8) * 900);
    }
    g.putImageData(img, 0, 0);
    if (sale < 1) requestAnimationFrame(cuadro); else { c.classList.add('oc'); LIQ.corriendo = false; }
  };
  if (soloSalida) { cambiado = true; if (cambio) cambio(); }
  cuadro(performance.now()); requestAnimationFrame(cuadro);
}

function ir(v, volviendo) {
  if (!volviendo && E.vista && E.vista !== v && LIQ.c && !LIQ.corriendo && document.visibilityState === 'visible') liquido(null, ultimoToque, true);
  for (const s of document.querySelectorAll('.vista')) s.classList.toggle('oc', s.id !== v);
  const s = $('#' + v); s.classList.remove('entra', 'vuelve'); void s.offsetWidth; s.classList.add(volviendo ? 'vuelve' : 'entra');
  E.vista = v;
  if (v === 'vRecorte' || v === 'vEditor') $('#aviso').classList.add('oc'); else setTimeout(mostrarOta, 400);
  if (v === 'vInicio') pintarInicio();
  else if (v === 'vRecorte') { marcarHerr(); pedirR(); }
  else if (v === 'vEditor') { pedirE(true); animarVista(); }
  else if (v === 'vPack') pintarPack();
}
async function atras() {
  if (hayModal()) { cerrarModal(); return; }
  if (E.ocupado) return;
  if (E.vista === 'vRecorte') ir(E.origen, true);
  else if (E.vista === 'vEditor') {
    if (E.desdeRecorte) return ir('vRecorte', true);
    if (E.st && E.st.capas.length && !(await confirmar('¿Tirar este sticker?', 'Tirar'))) return;
    E.st = null; ir(E.origen, true);
  } else if (E.vista === 'vPack') { if (E.origenPack) { const o = E.origenPack; E.origenPack = null; return ir(o, true); } E.tab = 'Mios'; ir('vInicio', true); }
  else if (E.vista === 'vPublico') ir(E.origenPublico && E.origenPublico !== 'vPublico' ? E.origenPublico : 'vInicio', true);
  else if (E.vista === 'vUsuario') ir(E.origenUsuario && E.origenUsuario !== 'vUsuario' ? E.origenUsuario : 'vInicio', true);
  else if (E.vista === 'vInicio' && E.tab !== 'Feed') pestaña('Feed');
}
// el botón «atrás» del celular (Java pregunta: true = lo manejó la app; false = salir)
window.__szAtras = () => { const maneja = hayModal() || E.vista !== 'vInicio' || E.tab !== 'Feed'; atras(); return maneja; };
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
$('#bExpress').onclick = () => { const i = $('#archivoVarios'); i.value = ''; i.click(); };
$('#archivoVarios').addEventListener('change', (ev) => { const fs = [...(ev.target.files || [])].slice(0, MAX_ST); if (fs.length) packExpress(fs); });
// muchas fotos de una: cada una recortada sola, con borde, a un pack nuevo (y editables después, como cualquier otro)
async function packExpress(files) {
  const m = modal(`<div class="hoja"><h3>Pack express</h3><div class="progreso"><div class="rueda"></div><b id="xT">Preparando…</b><span>Todo en tu celular: las fotos no salen de acá</span></div><div class="tiraX" id="xL"></div></div>`); m.onclick = null;
  let pack = null, hechos = 0;
  const packs = await P.leerPacks(), nombre = 'Pack express' + (packs.some((p) => /^Pack express/.test(p.nombre)) ? ' ' + (packs.filter((p) => /^Pack express/.test(p.nombre)).length + 1) : '');
  try {
    const rec = await recorte();
    for (let i = 0; i < files.length; i++) {
      $('#xT', m).textContent = `Recortando ${i + 1} de ${files.length}…`;
      try {
        const foto = await cargarImagen(files[i]), W = foto.width, H = foto.height, r = await rec.recortarSolo(foto);
        const t = lienzo(W, H), g = t.getContext('2d', { willReadFrequently: true }); g.drawImage(aCanvas(r), 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H).data, a = new Uint8Array(W * H); let n = 0; for (let j = 0; j < a.length; j++) { a[j] = d[j * 4 + 3]; if (a[j] > 128) n++; }
        let cut = n > a.length * 0.01 ? recortarImagen(foto, a, W, H) : null; if (!cut) cut = foto;
        const s = new Sticker(); s.agregarImagen(achicar(cut)); if (s.seSale() > 30) s.encajar();
        pack = await guardarSticker(s, pack ? pack.id : 'nuevo', nombre, [r.como === 'persona' ? '😎' : '😂']); hechos++;
        const im = new Image(); im.src = s.componer().toDataURL(); $('#xL', m).appendChild(im);
      } catch (e) { console.error(e); }
    }
  } catch (e) { console.error(e); }
  cerrarModal();
  if (!pack) return aviso('No pude armar el pack');
  E.packId = pack.id; ir('vPack'); aviso(hechos < files.length ? `Pack listo: ${hechos} de ${files.length} fotos` : `¡Pack listo! ${hechos} sticker${hechos === 1 ? '' : 's'}`);
}
function menuNuevo(origen) {
  const m = modal(`<div class="hoja"><h3>Otro sticker</h3><div class="lista">
    <button class="opc" data-x="galeria"><i data-i="galeria"></i><span>Elegir una foto</span></button>
    <button class="opc" data-x="camara"><i data-i="camara"></i><span>Sacar una foto</span></button>
    <button class="opc" data-x="texto"><i data-i="texto"></i><span>Sólo texto</span></button></div></div>`);
  m.querySelector('.lista').onclick = (ev) => { const b = ev.target.closest('button'); if (b) { cerrarModal(); crear(b.dataset.x, origen); } };
}

// una foto del celular → un lienzo de 1280 px como mucho (derecho: el navegador respeta la orientación de la cámara)
async function cargarImagen(f) {
  let img;
  try { img = await createImageBitmap(f); } catch (e) {
    img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = URL.createObjectURL(f); });
  }
  const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight, k = Math.min(1, MAX_FOTO / Math.max(w0, h0));
  const foto = lienzo(Math.max(1, Math.round(w0 * k)), Math.max(1, Math.round(h0 * k))), g = foto.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, foto.width, foto.height);
  if (img.close) img.close();
  return foto;
}
async function abrirFoto(f) {
  let foto; try { foto = await cargarImagen(f); } catch (e) { return aviso('No pude abrir esa imagen'); }
  const W = foto.width, H = foto.height, mascara = lienzo(W, H); mascara.getContext('2d', { willReadFrequently: true });
  Object.assign(E, { foto, W, H, mascara, corte: lienzo(W, H), sil: lienzo(W, H), deshacer: [], herr: 'tocar', st: null, desdeRecorte: false, editando: null, sucio: true, modo: 'auto', cabeza: null, mascaraAuto: null });
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
    E.cabeza = r.cabeza || null; E.mascaraAuto = alfa(); E.modo = 'auto';
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
// los modos: automático, sólo la cara, cabezón (la cabeza grande y aparte, para animarla) o la foto entera
function alfaDeCanvas(c) { const t = lienzo(E.W, E.H), g = t.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, E.W, E.H); const d = g.getImageData(0, 0, E.W, E.H).data, a = new Uint8Array(E.W * E.H); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]; return a; }
$('#rModos').onclick = async (ev) => {
  const b = ev.target.closest('button'); if (!b || E.ocupado) return; const m = b.dataset.m;
  if (m === 'auto') { await auto(true); return marcarModo(); }
  if (m === 'entera') { guardarDeshacer(); const g = mctx(); g.fillStyle = '#fff'; g.fillRect(0, 0, E.W, E.H); E.sucio = true; pedirR(); E.modo = 'entera'; ayudaR('La foto entera · Borrar saca lo que sobra'); return marcarModo(); }
  if (!E.cabeza) return aviso('No encontré una cara en esta foto');
  guardarDeshacer();
  if (m === 'cara') { ponerAlfa(alfaDeCanvas(aCanvas(E.cabeza))); ayudaR('Solo la cara · si falta pelo, Recuperar'); }
  else { if (E.mascaraAuto) ponerAlfa(E.mascaraAuto); ayudaR('Cabezón: la cabeza va grande y aparte'); }
  E.modo = m; marcarModo();
};
function marcarModo() { for (const b of $('#rModos').children) b.classList.toggle('act', b.dataset.m === E.modo); }
function marcarHerr() {
  for (const b of $('#rHerr').children) b.classList.toggle('act', b.dataset.h === E.herr);
  $('#rHerr [data-h="deshacer"]').disabled = !E.deshacer.length; marcarModo();
  $('#rPincelCont').classList.toggle('oc', E.herr === 'tocar');
}
$('#rHerr').onclick = (ev) => {
  const b = ev.target.closest('button'); if (!b || E.ocupado) return; const k = b.dataset.h;
  if (k === 'deshacer') deshacer();
  else { E.herr = k; marcarHerr(); ayudaR(AYUDA[k]); pedirR(); }
};
// el cabezón: el cuerpo y la cabeza en dos capas; la cabeza 1,5 veces más grande, apoyada en el cuello
function armarCabezon() {
  const a = alfa(), cab = alfaDeCanvas(aCanvas(E.cabeza)), N = a.length, ca = new Uint8Array(N), cu = new Uint8Array(N);
  for (let i = 0; i < N; i++) { ca[i] = Math.min(a[i], cab[i]); cu[i] = Math.round((a[i] * (255 - cab[i])) / 255); }
  const cH = recortarImagen(E.foto, ca, E.W, E.H), cB = recortarImagen(E.foto, cu, E.W, E.H);
  if (!cH || !cB || cH.width * cH.height < 400) return null;
  const F = 1.5, s = E.st && E.desdeRecorte ? E.st : new Sticker();
  s.capas = s.capas.filter((c) => !c.recorte && !c.cabeza);
  const cuello = { x: cH.origen.x + cH.width / 2, y: cH.origen.y + cH.height };
  const x0 = Math.min(cB.origen.x, cuello.x - (cH.width * F) / 2), x1 = Math.max(cB.origen.x + cB.width, cuello.x + (cH.width * F) / 2);
  const y0 = Math.min(cB.origen.y, cuello.y - cH.height * F), y1 = Math.max(cB.origen.y + cB.height, cuello.y);
  const k = (LADO - 2 * (MARGEN + s.borde + 3)) / Math.max(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, aSt = (x, y) => [LADO / 2 + (x - mx) * k, LADO / 2 + (y - my) * k];
  const [bx, by] = aSt(cB.origen.x + cB.width / 2, cB.origen.y + cB.height / 2), [hx, hy] = aSt(cuello.x, cuello.y - (cH.height * F) / 2);
  const cuerpo = { tipo: 'img', src: achicar(cB), x: bx, y: by, rot: 0, recorte: true }, cabeza = { tipo: 'img', src: achicar(cH), x: hx, y: hy, rot: 0, cabeza: true };
  cuerpo.esc = (k * cB.width) / cuerpo.src.width; cabeza.esc = (k * F * cH.width) / cabeza.src.width;
  s.capas.unshift(cuerpo, cabeza); s.sel = 1;
  return s;
}
const achicar = (c, max = 1024) => { const k = Math.min(1, max / Math.max(c.width, c.height)); if (k >= 1) return c; const x = lienzo(c.width * k, c.height * k), g = x.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, x.width, x.height); return x; };
$('#rSig').onclick = () => {
  if (E.ocupado) return;
  if (E.modo === 'cabezon' && E.cabeza) {
    const s = armarCabezon(); if (!s) return aviso('No pude separar la cabeza: probá con Auto');
    E.st = s; E.desdeRecorte = true; ir('vEditor'); aviso('Probá Animar → Bamboleo: mueve la cabeza 🎎', 4000); return;
  }
  const cut = recortarImagen(E.foto, alfa(), E.W, E.H);
  if (!cut || cut.width * cut.height < 100) return aviso('No quedó nada recortado: tocá lo que querés');
  let src = cut; const k = Math.min(1, 1024 / Math.max(cut.width, cut.height));
  if (k < 1) { src = lienzo(cut.width * k, cut.height * k); const g = src.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cut, 0, 0, src.width, src.height); }
  if (E.st && E.desdeRecorte) E.st.capas = E.st.capas.filter((c) => !c.cabeza);
  const viejo = E.desdeRecorte && E.st && E.st.capas.find((c) => c.recorte);
  if (viejo) { viejo.esc *= viejo.src.width / src.width; viejo.src = src; } // (volvió a recortar: queda en el mismo lugar y del mismo ancho)
  else { if (!E.st || !E.desdeRecorte) E.st = new Sticker(); const c = E.st.agregarImagen(src); c.recorte = true; E.st.capas.unshift(E.st.capas.pop()); E.st.sel = 0; }
  E.desdeRecorte = true; ir('vEditor');
};

// ================= DECORÁ =================
const EV = { c: $('#eLienzo'), esc: 1, ox: 0, oy: 0, d: 1, raf: 0, p: new Map(), gesto: null, ult: { t: 0, i: -1 }, manija: null };
const tAhora = (s) => { const D = s.duracion(); return ((performance.now() / 1000) % D) / D; };
// mientras haya algo animado, la vista se mueve (unos 20 cuadros por segundo)
let relojAnim = 0;
function animarVista() {
  if (relojAnim) return;
  relojAnim = setInterval(() => { if (E.vista !== 'vEditor' || !E.st || !E.st.animado()) { clearInterval(relojAnim); relojAnim = 0; return; } if (!hayModal() || $('#modal').classList.contains('claro')) pedirE(true); }, 50);
}
function pedirE(recomponer) { if (recomponer) E.compuesto = null; if (!EV.raf) EV.raf = requestAnimationFrame(() => { EV.raf = 0; pintarE(); }); }
function pintarE() {
  if (E.vista !== 'vEditor' || !E.st) return;
  const { w, h: hh, d } = medir(EV.c), g = EV.c.getContext('2d'), lado = Math.max(10, Math.min(w, hh) - 8 * d), esc = lado / LADO, ox = (w - lado) / 2, oy = (hh - lado) / 2, s = E.st;
  Object.assign(EV, { esc, ox, oy, d });
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, hh);
  g.save(); camino(g, ox, oy, lado, lado, 20 * d); g.clip(); damero(g, ox, oy, lado, lado, 14 * d); g.restore();
  g.save(); g.setLineDash([5 * d, 7 * d]); g.lineWidth = d; g.strokeStyle = 'rgba(255,255,255,0.2)'; g.strokeRect(ox + MARGEN * esc, oy + MARGEN * esc, (LADO - 2 * MARGEN) * esc, (LADO - 2 * MARGEN) * esc); g.restore();
  if (!E.compuesto) E.compuesto = s.componer(s.animado() ? tAhora(s) : 0);
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
  else if (k === 'animar') abrirAnimar();
  else if (k === 'xd') abrirXD();
  else if (k === 'frente') { s.alFrente(); pedirE(true); }
  else if (k === 'borrar') { s.borrarSel(); pedirE(true); }
};
const contornoCss = (c) => Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * Math.PI * 2; return `${(Math.cos(a) * 2.5).toFixed(1)}px ${(Math.sin(a) * 2.5).toFixed(1)}px 0 ${c}`; }).join(',');
function abrirTexto(capa) {
  const t = capa ? { texto: capa.texto, fuente: capa.fuente, color: capa.color, contorno: capa.contorno || '', globo: !!capa.globo, filete: !!capa.filete } : { texto: '', fuente: E.ultFuente, color: E.ultColor, contorno: E.ultContorno, globo: false, filete: false };
  const m = modal(`<div class="hoja"><h3>${capa ? 'Cambiar el texto' : 'Agregar texto'}</h3>
    <textarea id="tTx" rows="2" maxlength="80" placeholder="Escribí acá" autocomplete="off" autocapitalize="sentences"></textarea>
    <div class="etq">Ideas</div><div class="ideas" id="tI">${FRASES.map((f) => `<button data-v="${h(f)}">${h(f)}</button>`).join('')}</div>
    <div class="etq">Estilo</div><div class="chips" id="tE"><button class="chip" data-v="">Letras</button><button class="chip" data-v="globo">💬 Globo</button><button class="chip" data-v="filete">🌀 Filete</button></div>
    <div class="etq">Letra</div><div class="chips" id="tF">${FUENTES.map((f) => `<button class="chip" data-v="${f.id}" style="font-family:'${f.id}'">${f.nombre}</button>`).join('')}</div>
    <div class="etq">Color</div><div class="colores" id="tC">${COLORES.map((c) => `<button class="color" data-v="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div>
    <div class="etq">Contorno</div><div class="chips" id="tB">${[['#111111', 'Negro'], ['#ffffff', 'Blanco'], ['', 'Sin contorno']].map(([v, n]) => `<button class="chip" data-v="${v}">${n}</button>`).join('')}</div>
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Listo</button></div></div>`);
  const tx = $('#tTx', m); tx.value = t.texto;
  const marcar = (sel, v) => { for (const b of $(sel, m).children) b.classList.toggle('act', b.dataset.v === v); };
  const vista = () => { tx.style.fontFamily = `'${t.fuente}', sans-serif`; tx.style.color = t.color; tx.style.textShadow = t.contorno ? contornoCss(t.contorno) : 'none'; tx.style.background = t.globo ? '#ffffff' : ''; marcar('#tF', t.fuente); marcar('#tC', t.color); marcar('#tB', t.contorno); marcar('#tE', t.globo ? 'globo' : t.filete ? 'filete' : ''); if (t.filete) { tx.style.color = '#ffc93a'; tx.style.textShadow = contornoCss('#3b0d0a'); } };
  $('#tI', m).onclick = (ev) => { const b = ev.target.closest('button'); if (b) { tx.value = b.dataset.v; tx.focus(); } };
  $('#tE', m).onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; t.globo = b.dataset.v === 'globo'; t.filete = b.dataset.v === 'filete'; if (t.globo) { t.color = '#111111'; t.contorno = ''; } vista(); };
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
    if (t.globo) { E.ultColor = '#ffffff'; E.ultContorno = '#111111'; } // (el globo no se contagia al próximo texto)
    pedirE(true);
  };
  vista(); setTimeout(() => tx.focus(), 80);
}
function abrirAnimar() {
  const s = E.st, c = s.capas[s.sel], objetivo = c ? [c] : s.capas;
  if (!objetivo.length) return aviso('Agregá algo primero');
  const hayTexto = objetivo.some((x) => x.tipo === 'texto');
  const que = c ? (c.tipo === 'texto' ? 'el texto' : c.tipo === 'emoji' ? 'el emoji' : 'la foto') : 'todo';
  const m = modal(`<div class="hoja"><div class="etq" style="margin-top:0">Animar ${que}</div>
    <div class="anims" id="aL"><button class="anim" data-v=""><span>⏸️</span>Quieto</button>${ANIMACIONES.map((a) => `<button class="anim" data-v="${a.id}"${a.soloTexto && !hayTexto ? ' disabled' : ''}><span>${a.ico}</span>${a.nombre}</button>`).join('')}</div>
    <p class="nota">${c ? 'Para animar otra cosa distinto, tocala en el sticker.' : 'Para animar una sola cosa, tocala primero.'} Los animados van en packs animados: WhatsApp no los mezcla con los quietos.</p>
    <div class="botones"><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  const marcar = () => { const a = objetivo.find((x) => x.tipo === 'texto' || !ANIM[x.anim]?.soloTexto) || objetivo[0]; for (const b of $('#aL', m).children) b.classList.toggle('act', b.dataset.v === (a.anim || '')); };
  m.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.x) return cerrarModal();
    const v = b.dataset.v;
    for (const x of objetivo) { if (!v) delete x.anim; else if (!ANIM[v].soloTexto || x.tipo === 'texto') x.anim = v; }
    marcar(); pedirE(true); animarVista();
  };
  marcar();
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
// ---- «xD»: arruinar la foto a propósito (ojo de pez, aplastar, quemar…), como los memes que circulan ----
const EFECTOS_XD = [
  ['ojo', '🐟', 'Ojo de pez'], ['ancho', '↔️', 'Aplastar'], ['alto', '↕️', 'Estirar'], ['quemar', '🔥', 'Quemar'],
  ['trucha', '📉', 'Calidad trucha'], ['espejo', '🪞', 'Espejo'], ['lentes', '😎', 'Lentes'], ['sin', '↩️', 'Sin efectos'],
];
function abrirXD() {
  const s = E.st, foto = () => { const c = s.capas[s.sel]; return c && c.tipo === 'img' && !c.lentes ? c : [...s.capas].reverse().find((x) => x.tipo === 'img' && !x.lentes); };
  const m = modal(`<div class="hoja hojaXD"><div class="etq" style="margin-top:0">Modo xD <small>· a la foto ${foto() ? '' : '(primero poné una)'}</small></div>
    <div class="gridXD">${EFECTOS_XD.map(([k, ico, n]) => `<button class="opXD" data-k="${k}"><span>${ico}</span>${n}</button>`).join('')}</div>
    <div class="botones"><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  let ocupado = false;
  m.onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b || ocupado) return; if (b.dataset.x) return cerrarModal();
    const k = b.dataset.k;
    if (k === 'lentes') { const l = s.agregarImagen(lentesXD()); l.lentes = true; l.esc = 190 / l.src.width; l.y = LADO * 0.36; vibrar(10); pedirE(true); aviso('Movelos a los ojos 😎'); return; }
    const c = foto(); if (!c) return aviso('Primero poné una foto');
    ocupado = true; b.classList.add('girando');
    try {
      if (k === 'sin') { if (c.src0) { c.esc *= Math.sqrt((c.src.width * c.src.height) / (c.src0.width * c.src0.height)); c.src = c.src0; delete c.src0; } }
      else {
        c.src0 = c.src0 || c.src;
        if (k === 'ojo') c.src = ojoDePez(c.src);
        else if (k === 'ancho') { c.src = deformar(c.src, 1.45, 1); c.esc /= Math.sqrt(1.45); }
        else if (k === 'alto') { c.src = deformar(c.src, 1, 1.45); c.esc /= Math.sqrt(1.45); }
        else if (k === 'quemar') c.src = await quemar(c.src);
        else if (k === 'trucha') c.src = await trucha(c.src);
        else if (k === 'espejo') c.src = espejo(c.src);
      }
      vibrar(12); pedirE(true);
    } catch (e) { console.error(e); aviso('No se pudo'); }
    finally { ocupado = false; b.classList.remove('girando'); }
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
  const animado = s.animado(), ed = E.editando;
  let comp = s.componer(); const sale = s.seSale() > 30, packs = packsOrden(E.packs = await P.leerPacks());
  const libres = packs.filter((p) => p.stickers.length < MAX_ST && !!p.animado === animado);
  const edPack = ed && packs.find((p) => p.id === ed.packId), mismoTipo = edPack && !!edPack.animado === animado;
  let destino = mismoTipo ? 'cambiar' : (libres.find((p) => p.id === E.packId) || libres[0] || { id: 'nuevo' }).id;
  const viejo = mismoTipo && edPack.stickers.find((x) => x.archivo === ed.archivo);
  const emojis = viejo ? viejo.emojis.slice() : sugerirEmojis(s);
  const urls = await Promise.all(libres.map((p) => (p.bandeja ? P.urlDe(p.id, p.bandeja, p.v) : '')));
  const tipo = animado ? 'animado' : 'quieto';
  const m = modal(`<div class="hoja"><h3>${ed ? 'Guardar los cambios' : 'Guardar sticker'}</h3>
    <div class="vistaPrevia"><span class="prevCaja"><img id="gImg" src="${comp.toDataURL()}" alt="">${animado ? '<b class="insignia">Animado</b>' : ''}</span><p>Elegí el pack y 1 a 3 emojis: WhatsApp los usa para sugerirte el sticker cuando escribís.</p></div>
    ${sale ? '<div class="alerta" id="gSale"><span>Hay partes que tocan el borde y quedan cortadas</span><button class="chip" id="gEnc">Que entre todo</button></div>' : ''}
    ${ed && !mismoTipo ? `<p class="nota">Ahora está ${tipo} y su pack no: va como sticker nuevo en un pack ${animado ? 'animado' : 'de quietos'}.</p>` : ''}
    <div class="etq">Pack${animado ? ' animado' : ''}</div><div class="lista" id="gP">${mismoTipo ? `<button class="opc" data-v="cambiar"><i data-i="lapiz"></i><span>Cambiar el de «${h(edPack.nombre)}»</span></button>` : ''}${libres.map((p, i) => `<button class="opc" data-v="${h(p.id)}">${urls[i] ? `<img src="${urls[i]}" alt="">` : '<i data-i="galeria"></i>'}<span>${mismoTipo && p.id === edPack.id ? 'Otro más en ' : ''}${h(p.nombre)}</span><small>${p.stickers.length}/${MAX_ST}</small></button>`).join('')}
      <button class="opc" data-v="nuevo"><i data-i="mas"></i><span>Pack ${animado ? 'animado ' : ''}nuevo</span></button></div>
    <div id="gNC"><div class="etq">Nombre del pack nuevo</div><input id="gN" class="campo" maxlength="40" placeholder="Nombre del pack" value="${h(animado ? 'Mis animados' + (packs.some((p) => p.animado) ? ' ' + (packs.filter((p) => p.animado).length + 1) : '') : packs.length ? 'Mis stickers ' + (packs.length + 1) : 'Mis stickers')}"></div>
    <div class="etq">Emojis</div>${htmlEmojis(emojis)}
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Guardar</button></div></div>`);
  const marcar = () => { for (const b of $('#gP', m).children) b.classList.toggle('act', b.dataset.v === destino); $('#gNC', m).classList.toggle('oc', destino !== 'nuevo'); m.querySelector('[data-x="1"]').disabled = !emojis.length; };
  $('#gP', m).onclick = (ev) => { const b = ev.target.closest('button'); if (b) { destino = b.dataset.v; marcar(); if (destino === 'nuevo') $('#gN', m).focus(); } };
  manejarEmojis($('.emojis', m), emojis, marcar);
  if (sale) $('#gEnc', m).onclick = () => { s.encajar(); comp = s.componer(); $('#gImg', m).src = comp.toDataURL(); $('#gSale', m).remove(); pedirE(true); };
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = async () => {
    const nombre = $('#gN', m).value.trim() || (animado ? 'Mis animados' : 'Mis stickers');
    $('.hoja', m).innerHTML = `<div class="progreso"><div class="rueda"></div><b>${animado ? 'Armando la animación…' : 'Guardando…'}</b>${animado ? '<span>Tarda unos segundos</span>' : ''}</div>`;
    m.onclick = null;
    try {
      const pk = await guardarSticker(s, destino === 'cambiar' ? ed.packId : destino, nombre, emojis.slice(), destino === 'cambiar' ? ed.archivo : null);
      cerrarModal(); E.st = null; E.desdeRecorte = false; E.foto = null; E.editando = null; E.packId = pk.id;
      ir('vPack'); aviso(destino === 'cambiar' ? '¡Cambiado!' : '¡Guardado!');
    } catch (e) { console.error(e); cerrarModal(); aviso(String(e.message || e).includes('pesa') ? 'El sticker quedó muy pesado' : 'No se pudo guardar: ' + (e.message || e)); }
  };
  marcar();
};
// las imágenes del proyecto (para volver a editarlo): WebP con transparencia, de 900 px como mucho y menos de 480 KB
async function fuenteWebP(c) {
  const k = Math.min(1, 900 / Math.max(c.width, c.height)); let x = c;
  if (k < 1) { x = lienzo(c.width * k, c.height * k); const g = x.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, x.width, x.height); }
  for (const q of [0.9, 0.8, 0.7, 0.55]) { const b = await aBlob(x, 'image/webp', q); if (b && b.size <= 480 * 1024) return b; }
  throw new Error('la foto pesa demasiado');
}
// guarda el sticker (nuevo, o en lugar de `reemplazar`) con su proyecto; devuelve el pack
async function guardarSticker(st, destino, nombre, emojis, reemplazar) {
  const animado = st.animado(), r = animado ? await exportarAnimado(st) : await exportarWebP(st.componer()), packs = await P.leerPacks();
  let pack = packs.find((p) => p.id === destino);
  if (!pack) { pack = { id: 'p' + Date.now().toString(36), nombre, autor: 'Stickerazo', animado, stickers: [], bandeja: '', v: 0, n: 0, creado: Date.now() }; packs.push(pack); }
  if (!!pack.animado !== animado) throw new Error(animado ? 'ese pack es de stickers quietos' : 'ese pack es animado');
  const viejo = reemplazar ? pack.stickers.find((x) => x.archivo === reemplazar) : null;
  if (!viejo && pack.stickers.length >= MAX_ST) throw new Error('ese pack ya tiene 30 stickers');
  let archivo = reemplazar;
  if (!viejo) { pack.n = (pack.n || 0) + 1; archivo = `s${pack.n}.webp`; }
  await P.guardarArchivo(pack.id, archivo, r.blob);
  // el proyecto: las imágenes aparte (s3_i0.webp…), lo demás en la lista
  const { proyecto, imgs } = st.aProyecto(), base = archivo.replace(/\.webp$/, ''), fuentes = [];
  if (viejo && viejo.proyecto) for (const f of viejo.proyecto.fuentes || []) await P.borrarArchivo(pack.id, f);
  for (let i = 0; i < imgs.length; i++) { const f = `${base}_i${i}.webp`; await P.guardarArchivo(pack.id, f, await fuenteWebP(imgs[i])); fuentes.push(f); }
  if (!pack.bandeja) { const b = await exportarBandeja(st.componer(0)); pack.bandeja = b.type === 'image/png' ? 'bandeja.png' : 'bandeja.webp'; await P.guardarArchivo(pack.id, pack.bandeja, b); }
  const entrada = { archivo, emojis, proyecto: { ...proyecto, fuentes } };
  if (viejo) Object.assign(viejo, entrada); else pack.stickers.push(entrada);
  pack.v = (pack.v || 0) + 1; pack.mod = Date.now();
  await P.guardarPacks(packs); E.packs = packs;
  return pack;
}
// volver a abrir un sticker guardado en el editor
async function editarSticker(pack, st) {
  const pr = st.proyecto; if (!pr) return aviso('Este sticker es de antes: no se puede editar');
  const imgs = await Promise.all((pr.fuentes || []).map(async (f) => { const bl = await P.blobDe(pack.id, f); if (!bl) return null; const bmp = await createImageBitmap(bl), c = lienzo(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); return c; }));
  E.st = Sticker.deProyecto(pr, imgs); E.st.sel = -1; E.editando = { packId: pack.id, archivo: st.archivo }; E.desdeRecorte = false; E.origen = 'vPack';
  ir('vEditor');
}
// los emojis que van con el sticker: los que tiene adentro, y los del texto (palabras que se usan mucho)
// (palabras enteras, con acentos: «sí» sí, «casi» no)
const palabra = (alts) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})(?![\\p{L}\\p{N}])`, 'iu');
const PALABRAS = [
  [palabra('ja(?:ja)+j?|jsjs\\w*|xd+|lol|me muero de risa'), '😂'], [palabra('amor|te quiero|tkm|te amo|beso+s?'), '❤️'], [palabra('mate|matecito|matear'), '🧉'],
  [palabra('no+|ni ahí|ni ahi|nunca|jamás'), '🙅'], [palabra('s[ií]+|de una|dale|obvio|ok|joya|listo'), '👍'], [palabra('hola|buen d[ií]a|buenas'), '👋'],
  [palabra('chau|me voy|nos vemos'), '👋'], [palabra('gracias|grax'), '🙏'], [palabra('fiesta|birra|cerveza|fernet'), '🍻'],
  [palabra('hambre|milanesa|asado|pizza|empanadas?|comida'), '🍕'], [palabra('f[uú]tbol|gol+|campe[oó]n(?:es)?'), '⚽'], [palabra('sueño|dormir|siesta'), '😴'],
  [palabra('llor[oa]r?|triste'), '😭'], [palabra('enojad[oa]|bronca|calentit[oa]'), '😡'], [palabra('crack|genio|[ií]dol[oa]?|fuego'), '🔥'],
  [palabra('plata|guita|sueldo'), '💸'], [palabra('laburo|trabajo|oficina'), '💼'], [palabra('perr[oa]|guau|perrit[oa]'), '🐶'], [palabra('gat[oa]|miau'), '🐱'],
  [palabra('feliz|cumple(?:años)?'), '🥳'], [palabra('me mor[ií]|muerto|muerta'), '💀'], [/\?\s*$|¿/, '🤔'],
];
function sugerirEmojis(s) {
  const out = s.capas.filter((c) => c.tipo === 'emoji').map((c) => c.ch), texto = s.capas.filter((c) => c.tipo === 'texto').map((c) => c.texto).join(' ');
  for (const [re, e] of PALABRAS) if (re.test(texto)) out.push(e);
  const r = out.filter((e, i, a) => a.indexOf(e) === i).slice(0, 3);
  return r.length ? r : ['😂'];
}

// ================= INICIO: pestañas =================
let feedCargado = 0;
function pestaña(t) {
  const antes = E.tab; E.tab = t;
  for (const k of ['Feed', 'Crear', 'Listos', 'Mios', 'Perfil']) { const el = $('#tab' + k); el.classList.toggle('oc', k !== t); if (k === t && antes !== t) { el.classList.remove('aparece'); void el.offsetWidth; el.classList.add('aparece'); } }
  for (const b of $('#tabs').children) b.classList.toggle('act', b.dataset.t === t);
  $('#vInicio .cabInicio').classList.toggle('chica', t !== 'Crear');
  if (t === 'Feed') { if (Date.now() - feedCargado > 120000 || !$('#feedLista').children.length) { feedCargado = Date.now(); C.cargarFeed(true); } }
  else if (t === 'Crear') pintarCarrusel(); else if (t === 'Listos') buscar($('#qBuscar').value); else if (t === 'Perfil') C.pintarPerfil(); else pintarMios();
}
$('#tabs').onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; vibrar(6); if (b.dataset.t === E.tab && b.dataset.t === 'Feed') { $('#tabFeed').scrollTo({ top: 0, behavior: 'smooth' }); feedCargado = Date.now(); return C.cargarFeed(true); } liquido(() => pestaña(b.dataset.t), { x: ev.clientX || ultimoToque.x, y: ev.clientY || ultimoToque.y }); };
function pintarInicio() { pestaña(E.tab); pintarTopInicio(); }

// ---- arriba del feed: buscar, «¿de dónde sos?», historias (packs en círculos) y banners que pasan solos ----
const PAISES = [['ar', '🇦🇷', 'Argentina'], ['mx', '🇲🇽', 'México'], ['cl', '🇨🇱', 'Chile'], ['co', '🇨🇴', 'Colombia'], ['pe', '🇵🇪', 'Perú'], ['uy', '🇺🇾', 'Uruguay'], ['ve', '🇻🇪', 'Venezuela'], ['py', '🇵🇾', 'Paraguay']];
const miPais = () => { try { return localStorage.getItem('sz_pais') || ''; } catch (e) { return ''; } };
// (los packs de tu país primero; después los memes y los de Argentina)
function ordenarPorPais() {
  const p = miPais() || 'ar', pos = new Map(LISTOS.map((x, i) => [x.id, i]));
  const peso = (x) => (x.pais === p ? 0 : x.meme && x.pais === 'ar' ? 1 : !x.pais || x.pais === 'ar' ? 2 : 3);
  LISTOS.sort((a, b) => peso(a) - peso(b) || pos.get(a.id) - pos.get(b.id));
}
ordenarPorPais();
const BANNERS = [
  { img: 'banners/xd.webp', t: 'Modo <em>xD</em>', s: 'Ojo de pez, quemado, calidad trucha… arruiná tus fotos a propósito', b: 'Probalo', a: () => $('#bCrear').click() },
  { img: 'banners/latam.webp', t: 'Memes de <em>toda Latinoamérica</em>', s: 'Argentina, México, Chile, Perú, Colombia, Venezuela, Uruguay', b: 'Ver packs', a: () => liquido(() => pestaña('Listos')) },
  { img: 'banners/pack.webp', t: 'Tu pack en <em>un minuto</em>', s: 'Elegís hasta 30 fotos y te lo armo entero', b: 'Armar', a: () => $('#bExpress').click() },
];
let relojBanner = 0;
function pintarTopInicio() {
  const hi = $('#historias');
  if (!hi.children.length) {
    const corto = (n) => n.replace(/^(Los |Las |El |La )/, '').split(/ y | de /)[0];
    hi.innerHTML = LISTOS.slice(0, 16).map((pk) => `<button class="hist" data-l="${pk.id}"><span class="anillo${pk.meme ? ' xd' : ''}">${imgListo(pk, 0)}</span><small>${h(corto(pk.nombre))}</small></button>`).join('');
    llenarPrevias(hi);
  }
  const bn = $('#banners');
  if (!bn.children.length) {
    bn.innerHTML = `<div class="bTira">${BANNERS.map((b, i) => `<button class="banner" data-i="${i}" style="--fondo:url('${b.img}')"><span class="bTxt"><b>${b.t}</b><small>${h(b.s)}</small><span class="bBoton">${b.b} →</span></span></button>`).join('')}</div><div class="bPuntos">${BANNERS.map((_, i) => `<i class="${i ? '' : 'act'}"></i>`).join('')}</div>`;
    const tira = $('.bTira', bn), puntos = [...bn.querySelectorAll('.bPuntos i')];
    const actual = () => Math.round(tira.scrollLeft / Math.max(1, tira.clientWidth));
    tira.addEventListener('scroll', () => { const k = actual(); puntos.forEach((p, i) => p.classList.toggle('act', i === k)); for (const [i, b] of [...tira.children].entries()) b.classList.toggle('visto', i === k); }, { passive: true });
    tira.children[0].classList.add('visto');
    clearInterval(relojBanner);
    relojBanner = setInterval(() => { if (E.vista !== 'vInicio' || E.tab !== 'Feed' || document.hidden) return; const k = (actual() + 1) % BANNERS.length; tira.scrollTo({ left: k * tira.clientWidth, behavior: 'smooth' }); }, 4500);
    bn.onclick = (ev) => { const b = ev.target.closest('.banner'); if (b) { vibrar(8); BANNERS[+b.dataset.i].a(); } };
  }
  const pc = $('#paisCard');
  if (!miPais()) {
    pc.innerHTML = `<b>¿De dónde sos?</b><small>Así te muestro primero los memes de tu país</small><div class="banderas">${PAISES.map(([k, f, n]) => `<button data-p="${k}" aria-label="${n}"><span>${f}</span><small>${n}</small></button>`).join('')}</div>`;
    pc.classList.remove('oc');
  }
}
$('#irBuscar').onclick = () => liquido(() => { pestaña('Listos'); setTimeout(() => $('#qBuscar').focus(), 60); });
$('#historias').onclick = (ev) => { const b = ev.target.closest('.hist'); if (!b) return; vibrar(6); const pk = LISTOS.find((x) => x.id === b.dataset.l); if (pk) { b.classList.add('visto'); hojaListo(pk); } };
$('#paisCard').onclick = (ev) => {
  const b = ev.target.closest('[data-p]'); if (!b) return;
  try { localStorage.setItem('sz_pais', b.dataset.p); } catch (e) { /* sin guardar: igual se ordena ahora */ }
  vibrar(15); confeti(); ordenarPorPais(); const n = PAISES.find((x) => x[0] === b.dataset.p);
  $('#paisCard').classList.add('chau'); setTimeout(() => { $('#paisCard').classList.add('oc'); $('#historias').innerHTML = ''; $('#carrusel').innerHTML = ''; pintarTopInicio(); }, 380);
  aviso(`¡Listo! Primero los de ${n ? n[2] : 'tu país'} ${n ? n[1] : ''}`);
};

// ---- packs listos: las vistas previas se arman de a una (sin trabar la pantalla) y quedan guardadas ----
const previas = new Map();
function previa(pk, i) {
  const k = pk.id + ':' + i;
  if (!previas.has(k)) { const c = armarListo(pk.stickers[i], i).componer(0), t = lienzo(192, 192), g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, 192, 192); previas.set(k, t.toDataURL('image/webp', 0.85)); }
  return previas.get(k);
}
// (cada lista lleva su cuenta: abrir una hoja no frena las miniaturas de la lista de atrás)
async function llenarPrevias(raiz) {
  const mio = (raiz._turno = (raiz._turno || 0) + 1);
  for (const im of raiz.querySelectorAll('img[data-l]')) {
    if (raiz._turno !== mio || !im.isConnected) return;
    const [id, i] = im.dataset.l.split(':'), pk = LISTOS.find((x) => x.id === id);
    if (pk.meme) { await prepararListo(pk); if (raiz._turno !== mio || !im.isConnected) return; }
    im.src = previa(pk, +i); im.removeAttribute('data-l');
    await new Promise((ok) => setTimeout(ok, 0));
  }
}
const imgListo = (pk, i) => `<img data-l="${pk.id}:${i}" alt="">`;
function carruselListos(c) {
  if (c && !c.children.length) {
    c.innerHTML = LISTOS.map((pk) => `<button class="tarjeta" data-l="${pk.id}">${pk.animado ? '<b class="insignia">Animado</b>' : ''}<div class="mosaico">${[0, 1, 2, 3].filter((i) => i < pk.stickers.length).map((i) => imgListo(pk, i)).join('')}</div><b>${h(pk.nombre)}</b><small>${pk.stickers.length} stickers</small></button>`).join('');
    llenarPrevias(c);
  }
}
function pintarCarrusel() { carruselListos($('#carrusel')); pintarPortada(); }
// la portada de Crear: cinco stickers de los packs listos, torcidos y flotando
function pintarPortada() {
  const c = $('#portada'); if (c.querySelector('img')) return;
  const elegidos = [['respuestas', 0], ['mate', 0], ['animados', 0], ['filete', 0], ['asado', 0]];
  c.insertAdjacentHTML('afterbegin', elegidos.map(([id, i]) => `<img data-l="${id}:${i}" alt="">`).join(''));
  llenarPrevias(c);
}
document.addEventListener('click', (ev) => { const b = ev.target.closest('.carrusel [data-l]'); if (b) hojaListo(LISTOS.find((x) => x.id === b.dataset.l)); });
function htmlListo(pk, solo) {
  const idx = solo || pk.stickers.map((_, i) => i);
  return `<button class="listo" data-l="${pk.id}"><div class="packCab"><b>${h(pk.nombre)}</b>${pk.animado ? '<b class="insignia">Animado</b>' : ''}<small>${pk.stickers.length} stickers</small></div><p>${h(pk.desc)}</p><div class="tira">${idx.slice(0, 5).map((i) => `<span>${imgListo(pk, i)}</span>`).join('')}</div></button>`;
}
$('#listos').onclick = (ev) => { const b = ev.target.closest('.listo'); if (b) hojaListo(LISTOS.find((x) => x.id === b.dataset.l)); };
function hojaListo(pk) {
  const m = modal(`<div class="hoja"><h3>${h(pk.nombre)} ${pk.animado ? '<b class="insignia">Animado</b>' : ''}</h3><p>${h(pk.desc)}. Tocá uno para cambiarle lo que quieras antes de guardarlo.</p>
    <div class="hojaGrilla">${pk.stickers.map((_, i) => `<button data-i="${i}">${imgListo(pk, i)}</button>`).join('')}</div>
    <div class="botones"><button class="sec" data-x="0">Cerrar</button><button class="pri" data-x="1">Agregar el pack</button></div></div>`);
  llenarPrevias(m);
  $('.hojaGrilla', m).onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return; const i = +b.dataset.i; cerrarModal();
    await prepararListo(pk); E.st = armarListo(pk.stickers[i], i); E.editando = null; E.desdeRecorte = false; E.origen = 'vInicio'; ir('vEditor'); aviso('Cambiale lo que quieras y guardalo');
  };
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => agregarListo(pk);
}
async function agregarListo(pk) {
  const m = modal(`<div class="hoja"><h3>${h(pk.nombre)}</h3><div class="progreso"><div class="rueda"></div><b id="lT">Armando…</b>${pk.animado ? '<span>Los animados tardan unos segundos cada uno</span>' : ''}</div></div>`); m.onclick = null;
  let pack = null;
  try {
    await prepararListo(pk);
    for (let i = 0; i < pk.stickers.length; i++) {
      $('#lT', m).textContent = `Armando ${i + 1} de ${pk.stickers.length}…`;
      pack = await guardarSticker(armarListo(pk.stickers[i], i), pack ? pack.id : 'nuevo', pk.nombre, emojisListo(pk.stickers[i]));
    }
  } catch (e) { console.error(e); }
  cerrarModal();
  if (!pack) return aviso('No se pudo agregar');
  E.packId = pack.id; ir('vPack'); aviso('¡Listo! Ya está en Mis packs');
}
// ---- buscar: en los packs listos y en tus stickers (por lo que dicen o por emoji) ----
const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
let tBuscar = 0;
$('#qBuscar').addEventListener('input', () => { clearTimeout(tBuscar); tBuscar = setTimeout(() => buscar($('#qBuscar').value), 180); });
function buscarTag(t) { pestaña('Listos'); $('#qBuscar').value = t; buscar(t); }
async function buscar(q) {
  C.buscarComunidad(q, $('#resCom'));
  const n = norm(q).trim(), res = $('#resBuscar'), lis = $('#listos');
  if (!n) { res.innerHTML = ''; lis.innerHTML = LISTOS.map((pk) => htmlListo(pk)).join(''); return llenarPrevias(lis); }
  const dice = (d) => norm(String(d.texto || '').replace(/[\n|]/g, ' ')).includes(n) || (d.emoji && q.trim() === d.emoji);
  const listos = LISTOS.map((pk) => ({ pk, idx: pk.stickers.map((d, i) => (dice(d) ? i : -1)).filter((i) => i >= 0), todo: norm(pk.nombre + ' ' + pk.desc + ' ' + pk.tags).includes(n) })).filter((x) => x.todo || x.idx.length);
  const packs = E.packs = await P.leerPacks(), mios = [];
  for (const p of packs) for (const st of p.stickers) {
    const textos = st.proyecto ? st.proyecto.capas.filter((c) => c.tipo === 'texto').map((c) => c.texto).join(' ') : '';
    if (norm(textos + ' ' + p.nombre).includes(n) || st.emojis.includes(q.trim())) mios.push({ p, st });
  }
  const urls = await Promise.all(mios.slice(0, 24).map((x) => P.urlDe(x.p.id, x.st.archivo, x.p.v)));
  res.innerHTML = `<div class="res">${mios.length ? `<h3>En tus packs (${mios.length})</h3><div class="grilla">${mios.slice(0, 24).map((x, i) => `<button class="st" data-p="${h(x.p.id)}"><img src="${urls[i]}" alt=""></button>`).join('')}</div>` : ''}
    ${listos.length ? '<h3>Packs listos</h3>' : ''}${!mios.length && !listos.length ? `<p class="nada2">No encontré nada con «${h(q.trim())}». Probá con otra palabra o un emoji.</p>` : ''}</div>`;
  lis.innerHTML = listos.map((x) => htmlListo(x.pk, x.todo ? null : x.idx)).join(''); llenarPrevias(lis);
}
$('#resCom').onclick = (ev) => { const t = ev.target.closest('[data-tag]'); if (t) return buscarTag(t.dataset.tag); const u = ev.target.closest('[data-u]'); if (u && u.classList.contains('persona')) return C.abrirUsuario(u.dataset.u); return alTocarFeedDe(ev); };
const alTocarFeedDe = (ev) => { const lista = ev.target.closest('.feedLista'); if (lista && lista !== $('#feedLista')) { const f = $('#feedLista').onclick; if (f) f(ev); } };
$('#resBuscar').onclick = (ev) => { const b = ev.target.closest('[data-p]'); if (b) { E.packId = b.dataset.p; ir('vPack'); } };

// ================= MIS PACKS =================
async function pintarMios() {
  const packs = packsOrden(E.packs = await P.leerPacks()), cont = $('#packs');
  if (!packs.length) {
    cont.innerHTML = '<div class="vacio"><div class="vacioIco"><i data-i="magia"></i></div><b>Todavía no hiciste ningún pack</b><span>Elegí una foto: Stickerazo la recorta solo y en un minuto tenés tu primer sticker.</span></div>';
    return iconos(cont);
  }
  const tiras = await Promise.all(packs.map((p) => Promise.all(p.stickers.slice(0, 5).map((s) => P.urlDe(p.id, s.archivo, p.v)))));
  cont.innerHTML = packs.map((p, i) => {
    const n = p.stickers.length, celdas = Array.from({ length: 5 }, (_, k) => (k === 4 && n > 5 ? `<span class="masN">+${n - 4}</span>` : tiras[i][k] ? `<span><img src="${tiras[i][k]}" alt=""></span>` : '<span class="nada"></span>')).join('');
    return `<button class="packItem" data-p="${h(p.id)}"><div class="packCab"><b>${h(p.nombre)}</b>${p.animado ? '<b class="insignia">Animado</b>' : ''}${p.publicado ? '<b class="insignia verde">Publicado</b>' : ''}${p.origen ? `<b class="insignia gris">@${h(p.origen.autor)}</b>` : ''}<small class="${n < MIN_ST ? 'falta' : ''}">${n} sticker${n === 1 ? '' : 's'}${n < MIN_ST ? ` · faltan ${MIN_ST - n}` : ''}</small></div><div class="tira">${celdas}</div></button>`;
  }).join('');
}
$('#packs').onclick = (ev) => { const b = ev.target.closest('.packItem'); if (b) { E.packId = b.dataset.p; ir('vPack'); } };

// ================= EL PACK =================
const packActual = () => E.packs.find((p) => p.id === E.packId);
async function pintarPack() {
  E.packs = await P.leerPacks(); const pack = packActual(); if (!pack) return ir('vInicio');
  $('#pNombre').textContent = pack.nombre; const n = pack.stickers.length;
  $('#pTipo').classList.toggle('oc', !pack.animado);
  const est = C.estadoPublicado(pack), bp = $('#pPublicar'); bp.classList.toggle('oc', !est.puede && !pack.origen); bp.disabled = !est.puede; bp.classList.toggle('hecho', !!est.ver || !!pack.origen); $('span', bp).textContent = est.texto;
  const urls = await Promise.all(pack.stickers.map((s) => P.urlDe(pack.id, s.archivo, pack.v)));
  $('#pGrilla').innerHTML = pack.stickers.map((s, i) => `<button class="st" data-n="${i}"><img src="${urls[i]}" alt="Sticker ${i + 1}"></button>`).join('') +
    (n < MAX_ST ? '<button class="st nuevo" data-nuevo="1" aria-label="Otro sticker"><i data-i="mas"></i></button>' : '');
  iconos($('#pGrilla'));
  $('#pFalta').textContent = n < MIN_ST ? `${MIN_ST - n === 1 ? 'Te falta 1 sticker' : `Te faltan ${MIN_ST - n} stickers`} para pasarlo a WhatsApp (pide 3 como mínimo)` : `${n} de ${MAX_ST} stickers`;
  const bc = $('#pCompletar'); bc.classList.toggle('oc', !(n >= 1 && n < MIN_ST)); $('span', bc).textContent = `Completar con ${MIN_ST - n} variaci${MIN_ST - n === 1 ? 'ón' : 'ones'}`;
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
$('#pCompletar').onclick = () => completar();
async function hojaSticker(i) {
  const pack = packActual(), s = pack && pack.stickers[i]; if (!s) return;
  const url = await P.urlDe(pack.id, s.archivo, pack.v);
  const m = modal(`<div class="hoja"><div class="stGrande"><img src="${url}" alt=""></div><div class="stEmojis">${s.emojis.join(' ')}</div><div class="lista">
    ${s.proyecto ? '<button class="opc" data-x="editar"><i data-i="lapiz"></i><span>Editarlo</span></button>' : ''}
    <button class="opc" data-x="emojis"><i data-i="cara"></i><span>Cambiar los emojis</span></button>
    <button class="opc" data-x="icono"><i data-i="galeria"></i><span>Usarlo de ícono del pack</span></button>
    <button class="opc peligro" data-x="borrar"><i data-i="tacho"></i><span>Borrar el sticker</span></button></div></div>`);
  $('.lista', m).onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return; const x = b.dataset.x;
    if (x === 'emojis') return elegirEmojisDe(i);
    if (x === 'editar') { cerrarModal(); return editarSticker(pack, s); }
    if (x === 'icono') {
      cerrarModal();
      const bl = await P.blobDe(pack.id, s.archivo), bmp = await createImageBitmap(bl), c = lienzo(LADO, LADO); c.getContext('2d').drawImage(bmp, 0, 0, LADO, LADO);
      const t = await exportarBandeja(c);
      await cambiarPack(async (p) => { p.bandeja = t.type === 'image/png' ? 'bandeja.png' : 'bandeja.webp'; await P.guardarArchivo(p.id, p.bandeja, t); });
      aviso('Listo: ése es el ícono del pack'); return pintarPack();
    }
    if (x === 'borrar') {
      if (!(await confirmar('¿Borrar este sticker?', 'Borrar'))) return;
      await cambiarPack(async (p) => { const k = p.stickers.findIndex((z) => z.archivo === s.archivo); if (k >= 0) p.stickers.splice(k, 1); await P.borrarArchivo(p.id, s.archivo); for (const f of (s.proyecto && s.proyecto.fuentes) || []) await P.borrarArchivo(p.id, f); });
      pintarPack();
    }
  };
}
// «te faltan 2»: variaciones del último sticker (espejado y de otro color; con otra animación o con un ¡JAJAJA!)
async function completar() {
  const pack = packActual(); if (!pack || !pack.stickers.length) return;
  const falta = MIN_ST - pack.stickers.length; if (falta <= 0) return;
  const ult = pack.stickers[pack.stickers.length - 1];
  modal('<div class="hoja"><div class="progreso"><div class="rueda"></div><b>Haciendo las variaciones…</b></div></div>'); $('#modal').onclick = null;
  try {
    let base;
    if (ult.proyecto) {
      const imgs = await Promise.all((ult.proyecto.fuentes || []).map(async (f) => { const bl = await P.blobDe(pack.id, f); if (!bl) return null; const bmp = await createImageBitmap(bl), c = lienzo(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); return c; }));
      base = () => Sticker.deProyecto(ult.proyecto, imgs);
    } else {
      const bmp = await createImageBitmap(await P.blobDe(pack.id, ult.archivo)), c = lienzo(LADO, LADO); c.getContext('2d').drawImage(bmp, 0, 0, LADO, LADO);
      base = () => { const s = new Sticker(); s.borde = 0; s.sombra = false; const k = s.agregarImagen(c); k.esc = 1; if (pack.animado) k.anim = 'latido'; return s; };
    }
    const variantes = [
      (s) => { espejar(s); s.colorBorde = '#ffd23f'; if (!s.borde) s.borde = 8; },
      (s) => {
        if (pack.animado) { for (const c of s.capas) if (c.anim) c.anim = c.anim === 'temblor' ? 'rebote' : 'temblor'; }
        else if (!s.capas.some((c) => c.tipo === 'texto')) { const t = s.agregarTexto({ texto: 'JAJAJA', fuente: 'LuckiestGuy', color: '#ffd23f' }); t.rot = -0.06; }
        else { const e = s.agregarEmoji('😂'); e.x = 400; e.y = 118; }
        s.colorBorde = '#3ec7ff'; if (!s.borde) s.borde = 8; s.encajar();
      },
    ];
    for (let k = 0; k < falta; k++) { const s = base(); variantes[k % variantes.length](s); await guardarSticker(s, pack.id, pack.nombre, ult.emojis.slice()); }
    cerrarModal(); aviso(`¡Listo! ${falta === 1 ? 'Una variación' : falta + ' variaciones'} más`); pintarPack();
  } catch (e) { console.error(e); cerrarModal(); aviso('No pude hacer las variaciones'); }
}
function espejar(s) {
  for (const c of s.capas) {
    c.x = LADO - c.x; c.rot = -c.rot;
    if (c.tipo === 'img') { const m = lienzo(c.src.width, c.src.height), g = m.getContext('2d'); g.translate(m.width, 0); g.scale(-1, 1); g.drawImage(c.src, 0, 0); c.src = m; }
  }
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
$('#pPublicar').onclick = async () => { const p = packActual(); if (p) C.publicar(p); };
$('#pCompartir').onclick = async () => {
  const pk = packActual();
  if (pk && pk.publicado) return C.compartirPack({ id: pk.publicado.id, nombre: pk.nombre, autor: { nombre: (C.cuenta() || {}).nombre || 'stickerazo' } });
  if (pk && pk.origen) return C.compartirPack({ id: pk.origen.id, nombre: pk.nombre, autor: { nombre: pk.origen.autor } }); if (await P.compartir('Mirá los stickers que hago con Stickerazo 😎 Hacé los tuyos:', ENLACE)) { if (!P.esApp && !navigator.share) aviso('Copié el enlace'); } };

// ---- confeti (al publicar, al entrar, al agregar a WhatsApp) y vibración ----
function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* sin vibración */ } }
function confeti() {
  const c = document.createElement('canvas'), d = Math.min(2, devicePixelRatio || 1); c.className = 'confeti'; c.width = innerWidth * d; c.height = innerHeight * d; document.body.appendChild(c);
  const g = c.getContext('2d'), cols = ['#ffd23f', '#ff3e8a', '#3ec7ff', '#4cd964', '#ff7a1a', '#9b5cff', '#ffffff', '#74acdf'], ps = [];
  for (let i = 0; i < 140; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7, v = (9 + Math.random() * 11) * d; ps.push({ x: c.width / 2, y: c.height * 0.62, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: (6 + Math.random() * 7) * d, h: (3 + Math.random() * 5) * d, c: cols[i % cols.length] }); }
  const t0 = performance.now();
  const paso = (t) => {
    const k = (t - t0) / 1700; g.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.vy += 0.42 * d; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.globalAlpha = Math.max(0, 1 - k * k); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
    if (k < 1) requestAnimationFrame(paso); else c.remove();
  };
  requestAnimationFrame(paso);
}
// (lo que usa la comunidad de acá)
C.iniciar({ $, h, modal, cerrarModal, aviso, ir, iconos, E, confirmar, vibrar, confeti, pestaña, carruselListos, norm, buscarTag, pintarPack: () => pintarPack(), atras });
// ---- versión nueva (se bajó sola): avisar cuando no está creando ----
let otaPendiente = null;
window.__szOta = (v) => { otaPendiente = v; mostrarOta(); };
function mostrarOta() {
  if (!otaPendiente || hayModal() || E.vista === 'vRecorte' || E.vista === 'vEditor') return;
  otaPendiente = null;
  const m = modal(`<div class="hoja centro"><div class="grandote">✨</div><h3>¡Stickerazo nuevo!</h3><p>Ya se bajó la versión nueva. Abrila ahora o se abre sola la próxima vez que entres.</p>
    <div class="botones"><button class="sec" data-x="0">Después</button><button class="pri" data-x="1">Abrir ahora</button></div></div>`);
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => { cerrarModal(); if (window.SZN && window.SZN.reiniciar) window.SZN.reiniciar(); else location.reload(); };
}
// los enlaces «stickerazo://pack/ID» (de la página para compartir) abren el pack
window.__szAbrir = (ruta) => { const m = /pack\/([a-z0-9]{10})/.exec(String(ruta || '')); if (m) C.abrirPublico(m[1]); };

// ---- arranque ----
// (en la app, Java ya deja el lugar de las barras del sistema y del teclado: acá no se suma otra vez)
if (P.esApp) { document.documentElement.style.setProperty('--arriba', '0px'); document.documentElement.style.setProperty('--abajo', '0px'); }
iconos();
cargarFuentes('./').then(() => pedirE(true));
const alCambiarTam = () => { if (E.vista === 'vRecorte') pedirR(); else if (E.vista === 'vEditor') pedirE(); };
window.addEventListener('resize', alCambiarTam); if (window.ResizeObserver) { const ro = new ResizeObserver(alCambiarTam); ro.observe(RV.c); ro.observe(EV.c); }
pintarInicio();
if (P.esApp && window.SZN.enlaceInicial) { const e = window.SZN.enlaceInicial(); if (e) window.__szAbrir(e); }
setTimeout(() => recorte().catch(() => {}), 1200); // (los modelos, de fondo, para que el primer recorte salga enseguida)
window.__sz = { LIQ, liquido, E, ir, atras, abrirFoto, recorte, aviso, pestaña, C };
