// Stickerazo: las pantallas y lo que hace cada botón.
//  Inicio → (foto) → Recortá → Decorá → Guardar en un pack → el pack (de 3 a 30 stickers) → Agregar a WhatsApp.
import { ICONOS_MAS } from './iconos.js';
import { LADO, MARGEN, FUENTES, COLORES, DEGRADES, FILTROS, ANIMACIONES, ANIM, cargarFuentes, cargarFuente, cargarFuentesDe, fuentesExtra, servidorFuentes, nombreFuente, recortarImagen, Sticker, exportarWebP, exportarBandeja, exportarAnimado, aBlob, ojoDePez, deformar, espejo, quemar, trucha, lentesXD, FORMAS, formaCamino, EFECTOS_VIDEO, SUAVES } from './editor.js';
import { PEGATINAS, PEGA, PEGA_CATS, dibujarPega } from './pegatinas.js';
import * as P from './puente.js';
import { LISTOS, armarListo, emojisListo, prepararListo } from './listos.js';
import { LISTA_PAISES, elegirPaisMapa } from './mapa_pais.js';
import { abrirMusica, hayMusica } from './musica.js';
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

// ---- íconos propios (dibujados acá, 24×24): trazo grueso y redondo, y una «mancha» de color corrida un poquito, como
// un sticker mal pegado (la clase r). En la barra de abajo la mancha se prende cuando la pestaña está elegida ----
const RI = (d) => `<path class="r" d="${d}"/>`;
const ICONOS = {
  mas: RI('M12 3.6c5 0 8.4 3.5 8.4 8.4s-3.4 8.4-8.4 8.4S3.6 17 3.6 12 7 3.6 12 3.6z') + '<path d="M12 7v10M7 12h10"/>',
  atras: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  sig: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  texto: RI('M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z') + '<path d="M7 8V6.5h10V8M12 6.5v11M9.5 17.5h5"/>',
  camara: RI('M4.5 8.5h2.8l1.9-2.6h5.6l1.9 2.6h2.8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-8a1.5 1.5 0 0 1 1.5-1.5z') + '<path d="M4.5 8.5h2.8l1.9-2.6h5.6l1.9 2.6h2.8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-8a1.5 1.5 0 0 1 1.5-1.5z"/><circle cx="12" cy="13.6" r="3.3"/>',
  galeria: RI('M3.5 7.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z') + '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M4 16.5l4.6-4.6 3.6 3.6 2.6-2.6 4.7 4.7"/><circle cx="15.8" cy="8.8" r="1.4" fill="currentColor"/>',
  punto: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
  puntoG: '<circle cx="12" cy="12" r="8" fill="currentColor"/>',
  magia: RI('M15 4.5l1.1 2.4 2.4 1.1-2.4 1.1L15 11.5l-1.1-2.4-2.4-1.1 2.4-1.1z') + '<path d="M4.5 19.5L13 11"/><path d="M15 4.5l1.1 2.4 2.4 1.1-2.4 1.1L15 11.5l-1.1-2.4-2.4-1.1 2.4-1.1z"/><path d="M19 14.5v3M17.5 16h3M7.5 4v2.4M6.3 5.2h2.4"/>',
  dedo: RI('M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z') + '<circle cx="12" cy="12" r="2.4" fill="currentColor"/><circle cx="12" cy="12" r="6.6"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"/>',
  goma: RI('M5.2 15.3l9.3-9.3a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19.5H8.6z') + '<path d="M8.5 19.5h11"/><path d="M5.2 15.3l9.3-9.3a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19.5H8.6z"/><path d="M9.6 11l3.9 3.9"/>',
  pincel: RI('M4.5 19.5l1.2-4.4L16 4.8l3.2 3.2L8.9 18.3z') + '<path d="M4.5 19.5l1.2-4.4L16 4.8l3.2 3.2L8.9 18.3z"/><path d="M13.9 6.9l3.2 3.2"/>',
  foto: RI('M3.5 7.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z') + '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M4 16.5l4.6-4.6 3.6 3.6 2.6-2.6 4.7 4.7"/>',
  deshacer: '<path d="M9 14.5L4.5 10 9 5.5"/><path d="M4.5 10h10a5 5 0 0 1 0 10H11"/>',
  rehacer: '<path d="M15 14.5L19.5 10 15 5.5"/><path d="M19.5 10h-10a5 5 0 0 0 0 10H13"/>',
  capas: RI('M12 4l8.5 4.5L12 13 3.5 8.5z') + '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/><path d="M3.5 16.5L12 21l8.5-4.5"/>',
  alinear: RI('M5 6.5h14v4.5H5zM7.5 13.5h9V18h-9z') + '<path d="M12 3v18"/><rect x="5" y="6.5" width="14" height="4.5" rx="1.5"/><rect x="7.5" y="13.5" width="9" height="4.5" rx="1.5"/>',
  forma: RI('M12 19s-6-3.7-6-8.1A3.4 3.4 0 0 1 12 8.9a3.4 3.4 0 0 1 6 2c0 4.4-6 8.1-6 8.1z') + '<path d="M12 19s-6-3.7-6-8.1A3.4 3.4 0 0 1 12 8.9a3.4 3.4 0 0 1 6 2c0 4.4-6 8.1-6 8.1z"/><rect x="3" y="3" width="18" height="18" rx="4" stroke-dasharray="3 2.6"/>',
  fondo: RI('M12 2.8l1.9 3.5 3.8-1.3-.8 3.9 3.6 1.7-2.9 2.6 2.2 3.3-4 .3-.6 4-3.2-2.4-3.2 2.4-.6-4-4-.3 2.2-3.3-2.9-2.6 3.6-1.7-.8-3.9 3.8 1.3z') + '<path d="M12 2.8l1.9 3.5 3.8-1.3-.8 3.9 3.6 1.7-2.9 2.6 2.2 3.3-4 .3-.6 4-3.2-2.4-3.2 2.4-.6-4-4-.3 2.2-3.3-2.9-2.6 3.6-1.7-.8-3.9 3.8 1.3z"/>',
  neon: RI('M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z') + '<path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/><path d="M9.5 18.5h5M10.5 21h3"/>',
  kf: RI('M12 3.5l4.5 4.5-4.5 4.5L7.5 8z') + '<path d="M12 3.5l4.5 4.5-4.5 4.5L7.5 8z"/><path d="M3 18.5h18"/><path d="M6 15.5v6M18 15.5v6"/><circle cx="12" cy="18.5" r="1.6" fill="currentColor"/>',
  video: RI('M3.5 7.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z') + '<rect x="3.5" y="5.5" width="13" height="13" rx="2"/><path d="M16.5 10l4-2.5v9l-4-2.5"/><path d="M7.5 9.5l1 2 2 .5-2 .8-1 2-.8-2-2-.8 2-.5z" fill="currentColor"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pausa: '<path d="M8 5.5v13M16 5.5v13" stroke-width="3"/>',
  dibujo: RI('M14.5 4.5l5 5-8.2 8.2a3 3 0 0 1-2.1.9H6v-3.2a3 3 0 0 1 .9-2.1z') + '<path d="M14.5 4.5l5 5-8.2 8.2a3 3 0 0 1-2.1.9H6v-3.2a3 3 0 0 1 .9-2.1z"/><path d="M12.5 6.5l5 5"/><path d="M3 21.5c2.6 0 3.2-1.4 3.2-2.9"/>',
  ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  ojoNo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" opacity=".45"/><path d="M4.5 19.5l15-15"/>',
  subir: '<path d="M12 19V5M6.5 10.5L12 5l5.5 5.5"/>',
  bajarC: '<path d="M12 5v14M6.5 13.5L12 19l5.5-5.5"/>',
  cara: RI('M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z') + '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 14.2c.9 1.5 2.2 2.3 3.7 2.3s2.8-.8 3.7-2.3"/><circle cx="9" cy="10" r="1.1" fill="currentColor"/><circle cx="15" cy="10" r="1.1" fill="currentColor"/>',
  borde: RI('M4 9a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z') + '<rect x="4" y="4" width="16" height="16" rx="5" stroke-dasharray="3 2.6"/><path d="M9.5 12.5l1.8 1.8 3.3-3.6"/>',
  ajustes: RI('M5 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z') + '<path d="M4 7.5h8.5M17.5 7.5H20M4 16.5h2.5M11.5 16.5H20"/><circle cx="15" cy="7.5" r="2.4"/><circle cx="9" cy="16.5" r="2.4"/>',
  frente: RI('M12.5 10h6a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-6a2.5 2.5 0 0 1-2.5-2.5v-6a2.5 2.5 0 0 1 2.5-2.5z') + '<path d="M10 14H5.5A2.5 2.5 0 0 1 3 11.5v-6A2.5 2.5 0 0 1 5.5 3h6A2.5 2.5 0 0 1 14 5.5V10" stroke-dasharray="2.2 2.4"/><rect x="10" y="10" width="11" height="11" rx="2.5"/>',
  tacho: RI('M6.6 7.5h10.8l-.9 11.1a2 2 0 0 1-2 1.9H9.5a2 2 0 0 1-2-1.9z') + '<path d="M4.5 7.5h15M9.6 7.5V5.4c0-.5.4-.9.9-.9h3c.5 0 .9.4.9.9v2.1"/><path d="M6.6 7.5l.9 11.1a2 2 0 0 0 2 1.9h5a2 2 0 0 0 2-1.9l.9-11.1"/><path d="M10.4 11.2v5.3M13.6 11.2v5.3"/>',
  puntos: '<circle cx="12" cy="5.5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="18.5" r="1.8" fill="currentColor"/>',
  whats: RI('M12 4a8 8 0 0 1 0 16c-1.4 0-2.7-.3-3.8-.9L4 20l1-4A8 8 0 0 1 12 4z') + '<path d="M12 4a8 8 0 0 1 0 16c-1.4 0-2.7-.3-3.8-.9L4 20l1-4A8 8 0 0 1 12 4z"/><path d="M12 8.6v6.8M8.6 12h6.8"/>',
  compartir: RI('M5.5 12.5h13v5a2.5 2.5 0 0 1-2.5 2.5H8a2.5 2.5 0 0 1-2.5-2.5z') + '<path d="M12 14.5V4.5M8.3 8.2L12 4.5l3.7 3.7"/><path d="M5.5 12.5v5A2.5 2.5 0 0 0 8 20h8a2.5 2.5 0 0 0 2.5-2.5v-5"/>',
  lapiz: RI('M15 5l4 4-9.6 9.6-4.9.9.9-4.9z') + '<path d="M15 5l4 4-9.6 9.6-4.9.9.9-4.9z"/><path d="M12.8 7.2l4 4"/>',
  casa: RI('M6.5 10.5L12 6l5.5 4.5V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19z') + '<path d="M4 11.4L12 5l8 6.4"/><path d="M6.5 10v8.8A1.7 1.7 0 0 0 8.2 20.5h7.6a1.7 1.7 0 0 0 1.7-1.7V10"/><path d="M12 17.9s-2.4-1.5-2.4-3.1a1.2 1.2 0 0 1 2.4-.5 1.2 1.2 0 0 1 2.4.5c0 1.6-2.4 3.1-2.4 3.1z" fill="currentColor" stroke-width="1"/>',
  persona: RI('M12 4.6a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4zM5 19.8c.9-3.6 3.6-5.6 7-5.6s6.1 2 7 5.6z') + '<circle cx="12" cy="8.3" r="3.7"/><path d="M5 19.8c.9-3.6 3.6-5.6 7-5.6s6.1 2 7 5.6"/>',
  corazon: RI('M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z') + '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  bajar: RI('M5.5 14.5h13v3a2.5 2.5 0 0 1-2.5 2.5H8a2.5 2.5 0 0 1-2.5-2.5z') + '<path d="M12 4.5v10M8.3 10.8l3.7 3.7 3.7-3.7"/><path d="M5.5 14.5v3A2.5 2.5 0 0 0 8 20h8a2.5 2.5 0 0 0 2.5-2.5v-3"/>',
  nube: RI('M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.6 4.5 4.5 0 0 0 7 18.5z') + '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.6 4.5 4.5 0 0 0 7 18.5z"/><path d="M12 16v-5.5M9.6 12.9l2.4-2.4 2.4 2.4"/>',
  bandera: RI('M5.5 4.5h11l-2 4 2 4h-11z') + '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
  bloquear: RI('M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z') + '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  candado: RI('M5 12.5a2.5 2.5 0 0 1 2.5-2.5h9a2.5 2.5 0 0 1 2.5 2.5V18a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18z') + '<rect x="5" y="10" width="14" height="10.5" rx="2.5"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/><circle cx="12" cy="15.2" r="1.3" fill="currentColor"/>',
  ok: '<path d="M5.5 12.5l4.2 4.2L18.5 7.5"/>',
  lupa: RI('M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z') + '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4l4.6 4.6"/><path d="M8 8.6a3 3 0 0 1 2.5-1.4" stroke-width="1.6"/>',
  estrella: RI('M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z') + '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  carpeta: RI('M4.5 9.5a2.5 2.5 0 0 1 2.5-2.5h8a2.5 2.5 0 0 1 2.5 2.5v6.2l-4 4H7a2.5 2.5 0 0 1-2.5-2.5z') + '<path d="M8 4.5h8.5A3 3 0 0 1 19.5 7.5V15"/><path d="M4.5 9.5A2.5 2.5 0 0 1 7 7h8a2.5 2.5 0 0 1 2.5 2.5v6.2l-4 4H7a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M17.5 15.7h-2.3a1.7 1.7 0 0 0-1.7 1.7v2.3"/>',
  anim: RI('M13 5.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z') + '<path d="M13 5.5a6.5 6.5 0 1 1 0 13"/><circle cx="13" cy="12" r="3" fill="currentColor"/><path d="M2.5 8.5h5M1.5 12h6M2.5 15.5h5"/>',
  copias: RI('M8 10.5A2.5 2.5 0 0 1 10.5 8h7A2.5 2.5 0 0 1 20 10.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 8 17.5z') + '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/><path d="M14 11v6M11 14h6"/>',
  mundo: RI('M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z') + '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5s1.2-6.2 3.6-8.5z"/>',
};
Object.assign(ICONOS, ICONOS_MAS);   // (los propios de iconos.js: nada de emojis como íconos)
function iconos(raiz = document) {
  for (const i of raiz.querySelectorAll('i[data-i]:not([data-hecho])')) {
    i.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[i.dataset.i] || ''}</svg>`;
    i.dataset.hecho = '1';
  }
  // (las decoraciones grandes —pantallas vacías, bienvenida, avisos— son pegatinas: dibujos de pegatinas.js)
  for (const i of raiz.querySelectorAll('i[data-pega]:not([data-hecho])')) {
    const p = PEGA[i.dataset.pega]; i.dataset.hecho = '1'; if (!p) continue;
    const t = Math.round((parseFloat(getComputedStyle(i).width) || 72) * DPR()), c = lienzo(t, t);
    dibujarPega(c.getContext('2d'), p, t); i.appendChild(c);
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
  const a = $('#aviso'), piso = (hayModal() && $('#modal .hoja')) || $(`#${E.vista} .pie, #${E.vista} .barra, #${E.vista} .tabs`), rf = document.querySelector('.radioFlota');
  // (y arriba de la música de la esquina, que no tape el video de YouTube ni quede tapado)
  const arriba = Math.min(piso ? piso.getBoundingClientRect().top : window.innerHeight - 16, rf ? rf.getBoundingClientRect().top : Infinity);
  a.style.bottom = Math.round(window.innerHeight - arriba + 12) + 'px'; a.textContent = texto; a.classList.remove('oc'); clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.add('oc'), ms); }
function modal(html, opc = {}) {
  const m = $('#modal'); m.innerHTML = html; m.className = 'modal' + (opc.claro ? ' claro' : ''); iconos(m); $('#aviso').classList.add('oc');
  // (el «click» de soltar el dedo que la abrió no la cierra: la hoja todavía está subiendo)
  const abierta = performance.now(); m.onclick = (ev) => { if (ev.target === m && performance.now() - abierta > 450) cerrarModal(); };
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
// (celulares flojos: 4 núcleos o menos, o 2 GB de memoria o menos, o «reducir el movimiento»: sin el agua, sin desenfoques
// de fondo, sombras más simples y la vista del editor con menos píxeles)
const LIVIANO = quieto || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2;
const DPR = () => Math.min(LIVIANO ? 1.5 : 3, window.devicePixelRatio || 1);
if (LIVIANO) document.documentElement.classList.add('liviano');
// (los colores de la marca, de arriba a abajo: rosa → naranja → violeta)
const PALETA = (() => { const p = new Uint8ClampedArray(256 * 3), cs = [[255, 62, 138], [255, 138, 26], [255, 210, 63], [124, 77, 255], [255, 62, 138]];
  for (let i = 0; i < 256; i++) { const t = (i / 255) * (cs.length - 1), k = Math.min(cs.length - 2, Math.floor(t)), f = t - k; for (let j = 0; j < 3; j++) p[i * 3 + j] = cs[k][j] + (cs[k + 1][j] - cs[k][j]) * f; } return p; })();
// cambio(): se llama con la pantalla tapada. soloSalida: ya arranca tapada (para lo que cambia al toque) y se escurre
function liquido(cambio, desde = ultimoToque, soloSalida = false) {
  const c = LIQ.c;
  if (LIVIANO || !c || LIQ.corriendo) { if (cambio) cambio(); return; }
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

// (agua: sólo en los momentos importantes —se guardó el sticker, se publicó, ya sos Premium—, no en cada pantalla)
function ir(v, volviendo, agua = false) {
  if (v !== E.vista) C.pararCancionPerfil();   // (la canción de un perfil se corta al salir del perfil)
  if (agua && !volviendo && E.vista && E.vista !== v && LIQ.c && !LIQ.corriendo && document.visibilityState === 'visible') liquido(null, ultimoToque, true);
  for (const s of document.querySelectorAll('.vista')) s.classList.toggle('oc', s.id !== v);
  const s = $('#' + v); s.classList.remove('entra', 'vuelve'); void s.offsetWidth; s.classList.add(volviendo ? 'vuelve' : 'entra');
  E.vista = v;
  bannerSegunVista(v);
  if (v === 'vRecorte' || v === 'vEditor') $('#aviso').classList.add('oc'); else { setTimeout(mostrarOta, 400); setTimeout(mostrarApk, 900); }
  if (v === 'vInicio') pintarInicio();
  else if (v === 'vRecorte') { marcarHerr(); pedirR(); }
  else if (v === 'vEditor') { histReset(); pedirE(true); animarVista(); }
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
  else if (E.vista === 'vConv') { ir('vInicio', true); pestaña('Chat'); }
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
  const r = c.getBoundingClientRect(), d = DPR(), w = Math.max(1, Math.round(r.width * d)), hh = Math.max(1, Math.round(r.height * d));
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
// (el momento que se ve: con la hoja de Movimiento abierta, el del cabezal; si no, el que va pasando)
const tVista = (s) => (E.kf ? E.kf.t : s.animado() ? tAhora(s) : 0);
// mientras haya algo animado, la vista se mueve (unos 20 cuadros por segundo)
let relojAnim = 0;
function animarVista() {
  if (relojAnim) return;
  relojAnim = setInterval(() => { if (E.vista !== 'vEditor' || !E.st || !E.st.animado()) { clearInterval(relojAnim); relojAnim = 0; return; } if (E.kf) return; if (!hayModal() || $('#modal').classList.contains('claro')) pedirE('reloj'); }, LIVIANO ? 84 : 50);
}
function pedirE(recomponer) { if (recomponer) { E.compuesto = null; if (recomponer !== 'reloj') histProgramar(); } if (!EV.raf) EV.raf = requestAnimationFrame(() => { EV.raf = 0; pintarE(); }); }
function pintarE() {
  if (E.vista !== 'vEditor' || !E.st) return;
  const { w, h: hh, d } = medir(EV.c), g = EV.c.getContext('2d'), lado = Math.max(10, Math.min(w, hh) - 8 * d), esc = lado / LADO, ox = (w - lado) / 2, oy = (hh - lado) / 2, s = E.st;
  Object.assign(EV, { esc, ox, oy, d });
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, hh);
  g.save(); camino(g, ox, oy, lado, lado, 20 * d); g.clip(); damero(g, ox, oy, lado, lado, 14 * d); g.restore();
  g.save(); g.setLineDash([5 * d, 7 * d]); g.lineWidth = d; g.strokeStyle = 'rgba(255,255,255,0.2)'; g.strokeRect(ox + MARGEN * esc, oy + MARGEN * esc, (LADO - 2 * MARGEN) * esc, (LADO - 2 * MARGEN) * esc); g.restore();
  const tv = tVista(s);
  if (!E.compuesto) E.compuesto = s.componer(tv, LIVIANO && s.animado());
  g.drawImage(E.compuesto, ox, oy, lado, lado);
  if (E.dib) { g.drawImage(E.dib.c, ox, oy, lado, lado); marcarEditor(); return; }   // (dibujando: lo que va quedando, sin la selección)
  EV.manija = null;
  const c0 = s.capas[s.sel], c = c0 && { ...c0, ...s.pose(c0, tv) };
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
  for (const k of ['ajustes', 'borrar']) $(`#vEditor [data-e="${k}"]`).disabled = !c;
  $('#vEditor [data-e="forma"]').disabled = !s || !s.capas.some((x) => x.tipo === 'img' && !x.lentes && !x.dibujo);
  for (const b of document.querySelectorAll('#vEditor .hist')) b.classList.toggle('oc', !!E.dib);
  $('#eAyuda').textContent = !s || !s.capas.length ? 'Sumale un texto o un emoji' : !c ? 'Tocá algo para moverlo' : c.tipo === 'texto' ? 'Tocá dos veces el texto para cambiarlo' : 'Arrastrá para mover · la manija agranda y gira';
}
function enSt(ev) {
  const r = EV.c.getBoundingClientRect(), sx = (ev.clientX - r.left) * EV.d, sy = (ev.clientY - r.top) * EV.d;
  return { x: (sx - EV.ox) / EV.esc, y: (sy - EV.oy) / EV.esc, sx, sy };
}
const escala = (c, e) => { const m = E.st.medidas(c), l = Math.max(m.w, m.h) || 1; return lim(e, 40 / l, (LADO * 2.2) / l); };
const imantar = (r) => { const a = ((((r + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI; return Math.abs(a) < 0.06 ? 0 : a; };
// (con puntos clave, el gesto cambia la pose del momento: con la hoja de Movimiento, el punto del cabezal —o uno nuevo—;
// sin ella, corre todo el recorrido junto)
function ponerPose(c, n) {
  const s = E.st;
  if (!c.kf || !c.kf.length) { c.x = n.x; c.y = n.y; c.esc = n.esc; c.rot = n.rot; return; }
  if (E.kf) return kfPoner(c, E.kf.t, n);
  const P = s.pose(c, tVista(s)), dx = n.x - P.x, dy = n.y - P.y, k = n.esc / (P.esc || 1), dr = n.rot - P.rot;
  c.kf = c.kf.map((f) => ({ ...f, x: f.x + dx, y: f.y + dy, esc: f.esc * k, rot: f.rot + dr }));
  c.x += dx; c.y += dy; c.esc *= k; c.rot += dr;
}
function empezarPinza() {
  const s = E.st, [a, b] = [...EV.p.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, tv = tVista(s);
  let i = s.sel; if (i < 0) i = s.tocada(mx, my, tv); if (i < 0) i = s.capas.findIndex((c) => c.tipo === 'img' && !c.bloq && !c.oculto);
  if (i < 0) { EV.gesto = null; return; }
  s.sel = i; const c = s.capas[i], P = s.pose(c, tv);
  EV.gesto = { tipo: 'pinza', c, d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, a0: Math.atan2(b.y - a.y, b.x - a.x), esc0: P.esc, rot0: P.rot, mx0: mx, my0: my, x0: P.x, y0: P.y };
}
EV.c.addEventListener('pointerdown', (ev) => {
  const s = E.st; if (!s) return;
  if (E.dib) { capturar(EV.c, ev.pointerId); dibTrazo(enSt(ev), true); return; }
  capturar(EV.c, ev.pointerId); const p = enSt(ev); EV.p.set(ev.pointerId, p);
  if (EV.p.size === 2) { empezarPinza(); pedirE(); return; }
  if (EV.p.size > 2) return;
  const c = s.capas[s.sel], tv = tVista(s);
  if (c && EV.manija && Math.hypot(p.sx - EV.manija.x, p.sy - EV.manija.y) < 26 * EV.d) {
    const P = s.pose(c, tv);
    EV.gesto = { tipo: 'manija', c, d0: Math.hypot(p.x - P.x, p.y - P.y) || 1, a0: Math.atan2(p.y - P.y, p.x - P.x), esc0: P.esc, rot0: P.rot }; return;
  }
  const i = s.tocada(p.x, p.y, tv), ahora = performance.now();
  if (i >= 0 && i === EV.ult.i && ahora - EV.ult.t < 350 && s.capas[i].tipo === 'texto' && !E.kf) { EV.p.clear(); EV.gesto = null; EV.ult = { t: 0, i: -1 }; abrirTexto(s.capas[i]); return; }
  EV.ult = { t: ahora, i }; if (!E.kf || i >= 0) s.sel = i;
  const P = i >= 0 && s.pose(s.capas[i], tv);
  EV.gesto = i >= 0 ? { tipo: 'mover', c: s.capas[i], dx: p.x - P.x, dy: p.y - P.y } : null;
  if (E.kf && E.kf.alElegir) E.kf.alElegir();
  pedirE();
});
EV.c.addEventListener('pointermove', (ev) => {
  if (E.dib) { if (E.dib.trazo) dibTrazo(enSt(ev), false); return; }
  if (!EV.p.has(ev.pointerId)) return;
  const p = enSt(ev); EV.p.set(ev.pointerId, p); const G = EV.gesto; if (!G) return; const c = G.c, P = E.st.pose(c, tVista(E.st)), n = { ...P };
  if (G.tipo === 'mover') { n.x = lim(p.x - G.dx, 0, LADO); n.y = lim(p.y - G.dy, 0, LADO); }
  else if (G.tipo === 'manija') { n.esc = escala(c, (G.esc0 * Math.hypot(p.x - P.x, p.y - P.y)) / G.d0); n.rot = imantar(G.rot0 + Math.atan2(p.y - P.y, p.x - P.x) - G.a0); }
  else if (G.tipo === 'pinza' && EV.p.size >= 2) {
    const [a, b] = [...EV.p.values()];
    n.esc = escala(c, (G.esc0 * Math.hypot(b.x - a.x, b.y - a.y)) / G.d0); n.rot = imantar(G.rot0 + Math.atan2(b.y - a.y, b.x - a.x) - G.a0);
    n.x = lim(G.x0 + (a.x + b.x) / 2 - G.mx0, 0, LADO); n.y = lim(G.y0 + (a.y + b.y) / 2 - G.my0, 0, LADO);
  }
  ponerPose(c, n); pedirE(true);
});
function soltar(ev) {
  if (E.dib) { E.dib.trazo = null; return; }
  if (!EV.p.delete(ev.pointerId)) return;
  if (EV.p.size === 1 && EV.gesto && EV.gesto.tipo === 'pinza') { const p = [...EV.p.values()][0], c = EV.gesto.c, P = E.st.pose(c, tVista(E.st)); EV.gesto = { tipo: 'mover', c, dx: p.x - P.x, dy: p.y - P.y }; }
  else if (!EV.p.size) EV.gesto = null;
}
EV.c.addEventListener('pointerup', soltar); EV.c.addEventListener('pointercancel', soltar);
EV.c.addEventListener('wheel', (ev) => {
  const s = E.st, c = s && s.capas[s.sel]; if (!c) return; ev.preventDefault();
  const P = s.pose(c, tVista(s)), n = { ...P };
  if (ev.shiftKey) n.rot = imantar(P.rot + ev.deltaY * 0.003); else n.esc = escala(c, P.esc * Math.exp(-ev.deltaY * 0.0015));
  ponerPose(c, n); pedirE(true);
}, { passive: false });

$('#vEditor .barra').onclick = (ev) => {
  const b = ev.target.closest('button'); if (!b || !E.st) return; const s = E.st;
  const k = b.dataset.e;
  if (k === 'texto') abrirTexto(null);
  else if (k === 'emoji') abrirEmoji();
  else if (k === 'borde') abrirBorde();
  else if (k === 'animar') abrirAnimar();
  else if (k === 'xd') abrirXD();
  else if (k === 'ajustes') abrirAjustes();
  else if (k === 'dibujar') abrirDibujo();
  else if (k === 'forma') abrirForma();
  else if (k === 'fondo') abrirFondo();
  else if (k === 'neon') abrirNeon();
  else if (k === 'capas') abrirCapas();
  else if (k === 'alinear') abrirAlinear();
  else if (k === 'mov') abrirMovimiento();
  else if (k === 'pegatinas') abrirPegatinas();
  else if (k === 'plantillas') abrirPlantillas();
  else if (k === 'efectos') abrirEfectos();
  else if (k === 'borrar') { s.borrarSel(); pedirE(true); }
};
const contornoCss = (c) => Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * Math.PI * 2; return `${(Math.cos(a) * 2.5).toFixed(1)}px ${(Math.sin(a) * 2.5).toFixed(1)}px 0 ${c}`; }).join(',');
// ---- el texto: la hoja con la vista de cómo queda, y las pestañas Letra · Color · Contorno · Efectos ----
const CONTORNOS = [['#111111', 'Negro'], ['#ffffff', 'Blanco'], ['#ff3e8a', 'Rosa'], ['#3ec7ff', 'Celeste'], ['#ffd23f', 'Amarillo'], ['#9b5cff', 'Violeta'], ['#ff2d2d', 'Rojo'], ['#1fa35b', 'Verde']];
const NOMBRES_DEG = { atardecer: 'Atardecer', neon: 'Neón', oro: 'Oro', pasto: 'Pasto', fuego: 'Fuego', hielo: 'Hielo', arcoiris: 'Arcoíris' };
const fondoDeg = (k) => `linear-gradient(180deg, ${DEGRADES[k].join(', ')})`;
const leerRecientes = () => { try { return JSON.parse(localStorage.getItem('sz_letras') || '[]').filter((x) => typeof x === 'string').slice(0, 8); } catch (e) { return []; } };
function usarLetra(id) {
  if (FUENTES.some((f) => f.id === id)) return;
  try { localStorage.setItem('sz_letras', JSON.stringify([id, ...leerRecientes().filter((x) => x !== id)].slice(0, 8))); } catch (e) { /* sin lugar */ }
}
const DEF_TEXTO = { degrade: '', grosor: 'normal', sombraT: '', curva: 0, espaciado: 0 };
function abrirTexto(capa) {
  const base = capa || { texto: '', fuente: E.ultFuente, color: E.ultColor, contorno: E.ultContorno, globo: false, filete: false, ...(E.ultEstilo || {}) };
  const t = { texto: base.texto, fuente: base.fuente, color: base.color, contorno: base.contorno || '', globo: !!base.globo, filete: !!base.filete };
  for (const k in DEF_TEXTO) t[k] = base[k] ?? DEF_TEXTO[k];
  const recientes = leerRecientes(); if (!FUENTES.some((f) => f.id === t.fuente) && !recientes.includes(t.fuente)) recientes.unshift(t.fuente);
  const chipLetra = (id) => `<button class="chip" data-v="${h(id)}" style="font-family:'${h(id)}', sans-serif">${h(nombreFuente(id))}</button>`;
  const m = modal(`<div class="hoja hojaTexto"><h3>${capa ? 'Cambiar el texto' : 'Agregar texto'}</h3>
    <canvas class="tVista" id="tV" aria-hidden="true"></canvas>
    <textarea id="tTx" rows="2" maxlength="80" placeholder="Escribí acá" autocomplete="off" autocapitalize="sentences"></textarea>
    <div class="ideas" id="tI">${FRASES.map((f) => `<button data-v="${h(f)}">${h(f)}</button>`).join('')}</div>
    <div class="chips tEstilo" id="tE"><button class="chip" data-v="">Letras</button><button class="chip" data-v="globo"><i data-i="globo"></i>Globo</button><button class="chip" data-v="filete"><i data-i="aGiro"></i>Filete</button></div>
    <div class="tPest" id="tP"><button data-p="letra" class="act">Letra</button><button data-p="color">Color</button><button data-p="borde">Contorno</button><button data-p="mas">Efectos</button></div>
    <div class="tPan" data-p="letra"><div class="chips" id="tF">${FUENTES.map((f) => chipLetra(f.id)).join('')}${recientes.map(chipLetra).join('')}</div>
      <button class="tMas" id="tMas"><b>＋</b> Más letras <small id="tMasN"></small></button></div>
    <div class="tPan oc" data-p="color"><div class="colores" id="tC">${COLORES.map((c) => `<button class="color" data-v="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}<label class="color tPropio" aria-label="Elegir otro color"><input type="color" id="tCP"></label></div>
      <div class="etq">Degradé</div><div class="colores" id="tD">${Object.keys(DEGRADES).map((k) => `<button class="color" data-v="${k}" style="background:${fondoDeg(k)}" aria-label="Degradé ${NOMBRES_DEG[k]}"></button>`).join('')}</div></div>
    <div class="tPan oc" data-p="borde"><div class="colores" id="tB">${CONTORNOS.map(([c, n]) => `<button class="color" data-v="${c}" style="background:${c}" aria-label="Contorno ${n}"></button>`).join('')}<button class="color sin" data-v="" aria-label="Sin contorno"></button></div>
      <div class="etq">Grosor</div><div class="chips" id="tG"><button class="chip" data-v="fino">Fino</button><button class="chip" data-v="normal">Normal</button><button class="chip" data-v="grueso">Grueso</button></div></div>
    <div class="tPan oc" data-p="mas"><div class="etq">Sombra</div><div class="chips" id="tS"><button class="chip" data-v="">Sin sombra</button><button class="chip" data-v="suave">Suave</button><button class="chip" data-v="dura">3D</button></div>
      <div class="etq">Forma</div><div class="chips" id="tA"><button class="chip" data-v="0">Recta</button><button class="chip" data-v="1"><i data-i="arco"></i>En arco</button><button class="chip" data-v="-1">◡ Sonrisa</button></div>
      <div class="etq">Espacio entre letras</div><div class="chips" id="tL"><button class="chip" data-v="-0.04">Juntas</button><button class="chip" data-v="0">Normal</button><button class="chip" data-v="0.12">Separadas</button></div></div>
    <div class="botones"><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Listo</button></div></div>`);
  const tx = $('#tTx', m), cv = $('#tV', m); tx.value = t.texto;
  // (la vista: la capa de texto tal cual, con su contorno, sombra y arco, sobre el fondo de la hoja)
  const st = new Sticker();
  const dibujar = () => {
    const d = Math.min(3, window.devicePixelRatio || 1), W = cv.clientWidth || 300, H = cv.clientHeight || 110;
    if (cv.width !== Math.round(W * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const c = { tipo: 'texto', ...t, texto: tx.value.trim() || 'Escribí acá', tam: 96, x: 0, y: 0, esc: 1, rot: 0 }, md = st.medidas(c);
    const k = Math.min((W * 0.94) / md.w, (H * 0.88) / md.h, 1.1) * d;
    g.translate((W * d) / 2, (H * d) / 2); g.scale(k, k); st.dibujarCapa(g, c);
  };
  let cuadro = 0; const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = 0; dibujar(); }); };
  const marcar = (sel, v) => { for (const b of $(sel, m).children) if (b.dataset) b.classList.toggle('act', b.dataset.v === String(v)); };
  const vista = () => {
    tx.style.fontFamily = `'${t.fuente}', sans-serif`;
    marcar('#tF', t.fuente); marcar('#tC', t.degrade ? '-' : t.color); marcar('#tD', t.degrade); marcar('#tB', t.contorno); marcar('#tG', t.grosor);
    marcar('#tS', t.sombraT); marcar('#tA', t.curva); marcar('#tL', t.espaciado); marcar('#tE', t.globo ? 'globo' : t.filete ? 'filete' : '');
    // (el arco va con un solo renglón y sin globo ni filete; con globo, el color y el contorno los pone el globo)
    const sinArco = t.globo || t.filete || tx.value.includes('\n');
    for (const b of $('#tA', m).children) b.disabled = sinArco && b.dataset.v !== '0';
    $('#tP', m).classList.toggle('conGlobo', t.globo);
    pedir();
  };
  const ponerLetra = async (id) => {
    t.fuente = id; vista();
    if (!(await cargarFuente(id))) { aviso('No se pudo bajar esa letra. Fijate la conexión'); return; }
    usarLetra(id);
    if (!$(`#tF [data-v="${CSS.escape(id)}"]`, m)) $('#tF', m).insertAdjacentHTML('beforeend', chipLetra(id));
    vista();
  };
  // (las letras de antes: se cargan para verse con su forma en los botones)
  for (const id of recientes) cargarFuente(id).then(pedir);
  fuentesExtra().then((l) => { const n = $('#tMasN', m); if (n && l.fuentes.length) n.textContent = `(${l.fuentes.length})`; });
  $('#tP', m).onclick = (ev) => {
    const b = ev.target.closest('[data-p]'); if (!b) return; vibrar(5);
    for (const x of $('#tP', m).children) x.classList.toggle('act', x === b);
    for (const p of m.querySelectorAll('.tPan')) p.classList.toggle('oc', p.dataset.p !== b.dataset.p);
  };
  $('#tI', m).onclick = (ev) => { const b = ev.target.closest('button'); if (b) { tx.value = b.dataset.v; vista(); } };
  tx.addEventListener('input', vista);
  $('#tE', m).onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; t.globo = b.dataset.v === 'globo'; t.filete = b.dataset.v === 'filete'; if (t.globo) { t.color = '#111111'; t.contorno = ''; t.degrade = ''; } vista(); };
  const elegir = (sel, k, conv = (v) => v, despues) => { $(sel, m).onclick = (ev) => { const b = ev.target.closest('button'); if (!b || b.disabled) return; t[k] = conv(b.dataset.v); if (despues) despues(); vibrar(4); vista(); }; };
  $('#tF', m).onclick = (ev) => { const b = ev.target.closest('button'); if (b) ponerLetra(b.dataset.v); };
  elegir('#tC', 'color', String, () => { t.degrade = ''; });
  elegir('#tD', 'degrade', String, () => { if (t.globo) t.globo = false; });
  elegir('#tB', 'contorno'); elegir('#tG', 'grosor'); elegir('#tS', 'sombraT'); elegir('#tA', 'curva', Number); elegir('#tL', 'espaciado', Number);
  const cp = $('#tCP', m); cp.value = /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#ffffff';
  cp.addEventListener('input', () => { t.color = cp.value; t.degrade = ''; vista(); });
  $('#tMas', m).onclick = async () => { vibrar(6); const id = await elegirLetra(t.fuente, tx.value.trim()); if (id) ponerLetra(id); };
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => {
    t.texto = tx.value.replace(/\s+$/g, '').replace(/^\s+/g, ''); if (t.texto.includes('\n')) t.curva = 0;
    cerrarModal(); const s = E.st;
    Object.assign(E, { ultFuente: t.fuente, ultColor: t.color, ultContorno: t.contorno, ultEstilo: { degrade: t.degrade, grosor: t.grosor, sombraT: t.sombraT, espaciado: t.espaciado } });
    if (!t.texto) { if (capa) { s.capas.splice(s.capas.indexOf(capa), 1); s.sel = -1; } pedirE(true); return; }
    if (capa) {
      Object.assign(capa, t); const md = s.medidas(capa), maxW = LADO - 2 * (MARGEN + s.borde) - 8;
      if (md.w * capa.esc > maxW) capa.esc = maxW / md.w; s.sel = s.capas.indexOf(capa);
    } else Object.assign(s.agregarTexto(t), { degrade: t.degrade, grosor: t.grosor, sombraT: t.sombraT, curva: t.curva, espaciado: t.espaciado });
    if (!capa) s.ajustarTexto(s.capas[s.sel], s.capas.length === 1);
    if (t.globo) { E.ultColor = '#ffffff'; E.ultContorno = '#111111'; } // (el globo no se contagia al próximo texto)
    pedirE(true);
  };
  vista(); setTimeout(() => { dibujar(); tx.focus(); }, 80);
}
// ---- el selector de las «más letras»: todas con su forma (una imagen de muestras por tipo, que se baja recién cuando
// se ve alguna de ese tipo), por tipo y con buscador ----
const CATS_LETRA = [['', 'Todas'], ['divertidas', 'Divertidas'], ['manuscritas', 'A mano'], ['gruesas', 'Gruesas'], ['retro', 'Retro'], ['elegantes', 'Elegantes'], ['modernas', 'Modernas']];
const muestras = new Map();
function muestraDe(l, cat) {
  if (muestras.has(cat)) return muestras.get(cat);
  const m = l.muestras && l.muestras[cat]; if (!m) return Promise.resolve(null);
  const url = `${C.API}/fuentes/${m.archivo}`;
  const p = (async () => {
    let bl = null;
    try {
      const cache = await caches.open('sz-fuentes'); let r = await cache.match(url);
      if (!r) { r = await fetch(url); if (!r.ok) throw new Error('no'); await cache.put(url, r.clone()); }
      bl = await r.blob();
    } catch (e) { try { const r = await fetch(url); if (r.ok) bl = await r.blob(); } catch (er) { /* sin conexión: quedan los nombres en letra común */ } }
    return bl ? URL.createObjectURL(bl) : null;
  })();
  muestras.set(cat, p); p.then((u) => { if (!u) muestras.delete(cat); });
  return p;
}
const sinTildes = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function elegirLetra(actual) {
  return new Promise(async (listo) => {
    const l = await fuentesExtra();
    if (!l.fuentes.length) { aviso('No se pudo traer la lista de letras'); return listo(null); }
    const el = document.createElement('div'); el.className = 'letrasEl';
    el.innerHTML = `<div class="leCaja"><div class="leCab"><h3>Letras <small>${l.fuentes.length}</small></h3><button class="leX" aria-label="Cerrar"><i data-i="cerrar"></i></button></div>
      <div class="buscar leBuscar"><i data-i="lupa"></i><input type="search" placeholder="Buscá una letra" enterkeyhint="search"></div>
      <div class="chips leCat">${CATS_LETRA.map(([k, n], i) => `<button class="chip${i ? '' : ' act'}" data-c="${k}">${n}</button>`).join('')}</div>
      <div class="leLista"></div><p class="leNota">Todas con licencia libre de Google Fonts (<a data-ext href="${C.API}/fuentes/LICENCIAS.txt">licencias</a>). Se bajan al elegirlas y quedan guardadas.</p></div>`;
    el.style.setProperty('--ancho', `${l.cols * l.w}px`);
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('entra'));
    const lista = el.querySelector('.leLista'), inp = el.querySelector('input'); let cat = '';
    const cerrar = (id) => { el.classList.add('chau'); setTimeout(() => el.remove(), 300); obs.disconnect(); listo(id); };
    // (cuando aparece en pantalla una de un tipo, se baja la imagen de ese tipo y se prenden todas las de ese tipo)
    const prender = (c, u) => { el.style.setProperty(`--m-${c}`, `url("${u}")`); for (const b of lista.querySelectorAll(`.leIt[data-cat="${c}"]`)) b.classList.add('listo'); };
    const obs = new IntersectionObserver((vistas) => {
      for (const v of vistas) if (v.isIntersecting) { const c = v.target.dataset.cat; obs.unobserve(v.target); muestraDe(l, c).then((u) => { if (u) prender(c, u); }); }
    }, { root: lista, rootMargin: '300px 0px' });
    const pintar = () => {
      const q = sinTildes(inp.value.trim());
      const vis = l.fuentes.filter((f) => (!cat || f.cat === cat) && (!q || sinTildes(f.nombre).includes(q)));
      obs.disconnect();
      lista.innerHTML = vis.length ? vis.map((f) => {
        const x = (f.m % l.cols) * l.w, y = Math.floor(f.m / l.cols) * l.h;
        return `<button class="leIt${f.id === actual ? ' act' : ''}" data-id="${h(f.id)}" data-cat="${f.cat}" aria-label="${h(f.nombre)}"><span class="leM" style="--mm:var(--m-${f.cat});-webkit-mask-position:-${x}px -${y}px;mask-position:-${x}px -${y}px"></span><span class="leT">${h(f.nombre)}</span></button>`;
      }).join('') : '<p class="muNada">No hay ninguna con ese nombre.</p>';
      for (const b of lista.querySelectorAll('.leIt')) { if (el.style.getPropertyValue(`--m-${b.dataset.cat}`)) b.classList.add('listo'); else obs.observe(b); }
    };
    el.querySelector('.leCat').onclick = (ev) => { const b = ev.target.closest('[data-c]'); if (!b) return; vibrar(5); cat = b.dataset.c; for (const x of b.parentElement.children) x.classList.toggle('act', x === b); lista.scrollTop = 0; pintar(); };
    inp.addEventListener('input', pintar);
    el.querySelector('.leX').onclick = () => cerrar(null);
    el.onclick = (ev) => { if (ev.target === el) cerrar(null); };
    lista.onclick = async (ev) => {
      const b = ev.target.closest('[data-id]'); if (!b || b.classList.contains('cargando')) return; vibrar(8);
      b.classList.add('cargando'); const ok = await cargarFuente(b.dataset.id); b.classList.remove('cargando');
      if (!ok) return aviso('No se pudo bajar esa letra. Fijate la conexión');
      cerrar(b.dataset.id);
    };
    pintar();
  });
}
// ---- «Ajustes» de lo que está tocado: adelante o atrás, duplicar, espejo, opacidad y, en las fotos, filtros ----
const NOMBRES_F = { normal: 'Normal', bn: 'B y N', sepia: 'Sepia', vintage: 'Vintage', frio: 'Frío', calido: 'Cálido', vivido: 'Vívido', fantasma: 'Fantasma' };
function abrirAjustes() {
  const s = E.st, c = s.capas[s.sel]; if (!c) return aviso('Tocá algo del sticker primero');
  const esImg = c.tipo === 'img', que = c.tipo === 'texto' ? 'del texto' : c.tipo === 'emoji' ? 'del emoji' : 'de la foto';
  const desl = (k, nombre, min, max, v) => `<label class="ajDesl"><span>${nombre}</span><input type="range" min="${min}" max="${max}" value="${v}" data-k="${k}"><b></b></label>`;
  const f = c.filtro || {};
  const m = modal(`<div class="hoja hojaAjustes"><div class="etq" style="margin-top:0">Ajustes ${que}</div>
    <div class="ajCapa"><button data-a="frente"><i data-i="frente"></i>Al frente</button><button data-a="fondo"><i data-i="atrasCapa"></i>Al fondo</button><button data-a="dup"><i data-i="duplicar"></i>Duplicar</button><button data-a="espejo"><i data-i="xEspejo"></i>Espejo</button></div>
    ${desl('alfa', 'Opacidad', 15, 100, Math.round((c.alfa ?? 1) * 100))}
    ${esImg ? `<div class="etq">Filtros</div><div class="ajFiltros">${Object.keys(FILTROS).map((k) => `<button data-f="${k}"><canvas width="112" height="112"></canvas><span>${NOMBRES_F[k]}</span></button>`).join('')}</div>
      ${desl('b', 'Brillo', 50, 150, Math.round((f.b ?? 1) * 100))}${desl('c', 'Contraste', 50, 150, Math.round((f.c ?? 1) * 100))}${desl('s', 'Color', 0, 200, Math.round((f.s ?? 1) * 100))}` : ''}
    <div class="botones"><button class="sec" data-x="r">Como estaba</button><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  const antes = { alfa: c.alfa, espejo: c.espejo, filtro: c.filtro ? { ...c.filtro } : undefined };
  const marcar = () => {
    for (const b of m.querySelectorAll('[data-f]')) b.classList.toggle('act', (c.filtro?.preset || 'normal') === b.dataset.f);
    $('[data-a="espejo"]', m).classList.toggle('act', !!c.espejo);
    for (const r of m.querySelectorAll('input[type=range]')) { r.nextElementSibling.textContent = r.value + '%'; r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%'); }
  };
  // (las miniaturas de los filtros, con la foto de verdad)
  if (esImg) for (const b of m.querySelectorAll('[data-f]')) {
    const cv = $('canvas', b), g = cv.getContext('2d'), k = Math.min(112 / c.src.width, 112 / c.src.height);
    g.filter = FILTROS[b.dataset.f] || 'none'; g.drawImage(c.src, (112 - c.src.width * k) / 2, (112 - c.src.height * k) / 2, c.src.width * k, c.src.height * k);
  }
  m.addEventListener('input', (ev) => {
    const r = ev.target.closest('input[type=range]'); if (!r) return; const v = r.value / 100;
    if (r.dataset.k === 'alfa') { if (v >= 1) delete c.alfa; else c.alfa = v; }
    else { c.filtro = { ...(c.filtro || {}), [r.dataset.k]: v }; }
    marcar(); pedirE(true);
  });
  m.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return; vibrar(6);
    if (b.dataset.x === '1') return cerrarModal();
    if (b.dataset.x === 'r') {
      Object.assign(c, antes); for (const k of ['alfa', 'espejo', 'filtro']) if (c[k] === undefined) delete c[k];
      for (const r of m.querySelectorAll('input[type=range]')) r.value = Math.round((r.dataset.k === 'alfa' ? c.alfa ?? 1 : c.filtro?.[r.dataset.k] ?? 1) * 100);
      marcar(); return pedirE(true);
    }
    if (b.dataset.f) { c.filtro = { ...(c.filtro || {}), preset: b.dataset.f === 'normal' ? '' : b.dataset.f }; marcar(); return pedirE(true); }
    const a = b.dataset.a; if (!a) return;
    if (a === 'espejo') { c.espejo = !c.espejo; if (!c.espejo) delete c.espejo; }
    else if (a === 'frente') { s.alFrente(); aviso('Quedó adelante de todo'); }
    else if (a === 'fondo') { s.capas.splice(s.capas.indexOf(c), 1); s.capas.unshift(c); s.sel = 0; aviso('Quedó atrás de todo'); }
    else if (a === 'dup') {
      const k = { ...c, x: lim(c.x + 28, 0, LADO), y: lim(c.y + 28, 0, LADO) }; if (c.filtro) k.filtro = { ...c.filtro };
      s.capas.splice(s.capas.indexOf(c) + 1, 0, k); s.sel = s.capas.indexOf(k); cerrarModal(); aviso('Listo, ahí está la copia: movela');
    }
    marcar(); pedirE(true);
  };
  marcar();
}
function abrirAnimar() {
  const s = E.st, c = s.capas[s.sel], objetivo = c ? [c] : s.capas;
  if (!objetivo.length) return aviso('Agregá algo primero');
  const hayTexto = objetivo.some((x) => x.tipo === 'texto');
  const que = c ? (c.tipo === 'texto' ? 'el texto' : c.tipo === 'emoji' ? 'el emoji' : 'la foto') : 'todo';
  const m = modal(`<div class="hoja"><div class="etq" style="margin-top:0">Animar ${que}</div>
    <div class="anims" id="aL"><button class="anim" data-v=""><span><i data-i="pausa"></i></span>Quieto</button>${ANIMACIONES.map((a) => `<button class="anim" data-v="${a.id}"${a.soloTexto && !hayTexto ? ' disabled' : ''}><span><i data-i="${a.ico}"></i></span>${a.nombre}</button>`).join('')}</div>
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
// ---- «xD»: arruinar la foto a propósito (ojo de pez, aplastar, quemar…), como los memes que circulan. Cada efecto se pone y
// se saca de a uno (la foto se rehace desde la original con los que quedan); los lentes son una capa que se pone y se saca ----
const EFECTOS_XD = [
  ['ojo', 'xOjo', 'Ojo de pez'], ['ancho', 'xAncho', 'Aplastar'], ['alto', 'xAlto', 'Estirar'], ['quemar', 'llama', 'Quemar'],
  ['trucha', 'pixeles', 'Calidad trucha'], ['espejo', 'xEspejo', 'Espejo'], ['lentes', 'lentes', 'Lentes'], ['sin', 'deshacer', 'Sacar todo'],
];
async function aplicarXD(c, lista) {
  const base = c.src0 || c.src, ant = c.src; let x = base;
  for (const k of lista) {
    if (k === 'ojo') x = ojoDePez(x); else if (k === 'ancho') x = deformar(x, 1.45, 1); else if (k === 'alto') x = deformar(x, 1, 1.45);
    else if (k === 'quemar') x = await quemar(x); else if (k === 'trucha') x = await trucha(x); else if (k === 'espejo') x = espejo(x);
  }
  c.esc *= Math.sqrt((ant.width * ant.height) / (x.width * x.height));   // (el mismo tamaño a la vista)
  if (lista.length) { c.src0 = base; c.src = x; c.xd = lista.slice(); } else { c.src = base; delete c.src0; delete c.xd; }
}
function abrirXD() {
  const s = E.st, foto = () => { const c = s.capas[s.sel]; return c && c.tipo === 'img' && !c.lentes && !c.dibujo ? c : [...s.capas].reverse().find((x) => x.tipo === 'img' && !x.lentes && !x.dibujo); };
  const m = modal(`<div class="hoja hojaXD"><div class="etq" style="margin-top:0">Modo xD <small>· tocá de nuevo para sacar ${foto() ? '' : '(primero poné una foto)'}</small></div>
    <div class="gridXD">${EFECTOS_XD.map(([k, ico, n]) => `<button class="opXD" data-k="${k}"><span><i data-i="${ico}"></i></span><b>${n}</b></button>`).join('')}</div>
    <div class="botones"><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  const marcar = () => {
    const c = foto(), l = (c && c.xd) || [], lentes = s.capas.some((x) => x.lentes);
    for (const b of m.querySelectorAll('.opXD')) { const k = b.dataset.k, on = k === 'lentes' ? lentes : l.includes(k); b.classList.toggle('act', on); if (k === 'lentes') b.querySelector('b').textContent = lentes ? 'Sacar lentes' : 'Lentes'; if (k === 'sin') b.disabled = !l.length && !lentes; }
  };
  let ocupado = false;
  m.onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b || ocupado) return; if (b.dataset.x) return cerrarModal();
    const k = b.dataset.k;
    if (k === 'lentes') {
      const i = s.capas.findIndex((x) => x.lentes);
      if (i >= 0) { s.capas.splice(i, 1); s.sel = -1; aviso('Lentes afuera'); }
      else { const l = s.agregarImagen(lentesXD()); l.lentes = true; l.esc = 190 / l.src.width; l.y = LADO * 0.36; aviso('Movelos a los ojos'); }
      vibrar(10); marcar(); pedirE(true); return;
    }
    const c = foto();
    if (k === 'sin') { s.capas = s.capas.filter((x) => !x.lentes); s.sel = -1; }
    if (!c) { marcar(); pedirE(true); return k === 'sin' ? null : aviso('Primero poné una foto'); }
    ocupado = true; b.classList.add('girando');
    try {
      const l = c.xd || [];
      await aplicarXD(c, k === 'sin' ? [] : l.includes(k) ? l.filter((x) => x !== k) : [...l, k]);
      vibrar(12); pedirE(true);
    } catch (e) { console.error(e); aviso('Uh, no salió. Probá otra vez'); }
    finally { ocupado = false; b.classList.remove('girando'); marcar(); }
  };
  marcar();
}
// ---- deshacer y rehacer (arriba): cada cambio que se ve queda en la historia; se guarda cuando dejás de tocar ----
const HIST = { pila: [], i: -1, st: null, t: 0 };
const IDS_IMG = new WeakMap(); let sigImg = 1;
const idImg = (o) => { let k = IDS_IMG.get(o); if (!k) { k = sigImg++; IDS_IMG.set(o, k); } return k; };
const copiarCapa = (c) => { const o = {}; for (const [k, v] of Object.entries(c)) o[k] = Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? { ...x } : x)) : v && typeof v === 'object' && !('width' in v) ? { ...v } : v; return o; };
function fotoHist(s) {
  const capas = s.capas.map(copiarCapa), extra = { borde: s.borde, colorBorde: s.colorBorde, sombra: s.sombra, efecto: s.efecto || '', kfDur: s.kfDur || 0 };
  const firma = JSON.stringify([extra, capas], (k, v) => (v && typeof v === 'object' && !Array.isArray(v) && 'width' in v && 'height' in v ? '#' + idImg(v) : v));
  return { capas, extra, firma };
}
function histReset() { if (HIST.st === E.st) return; HIST.st = E.st; HIST.pila = E.st ? [fotoHist(E.st)] : []; HIST.i = HIST.pila.length - 1; marcarHist(); }
function histProgramar() { clearTimeout(HIST.t); HIST.t = setTimeout(() => (EV.p.size || E.dib ? histProgramar() : histTomar()), 380); }
function histTomar() {
  clearTimeout(HIST.t); const s = E.st; if (!s || HIST.st !== s) return;
  const f = fotoHist(s); if (HIST.pila[HIST.i] && HIST.pila[HIST.i].firma === f.firma) return;
  HIST.pila.splice(HIST.i + 1); HIST.pila.push(f); if (HIST.pila.length > 60) HIST.pila.shift(); HIST.i = HIST.pila.length - 1; marcarHist();
}
function histIr(d) {
  if (E.dib || !E.st) return; histTomar();
  const i = HIST.i + d; if (i < 0 || i >= HIST.pila.length) return;
  if (hayModal()) cerrarModal();   // (las hojas abiertas apuntan a las capas de antes)
  HIST.i = i; const f = HIST.pila[i], s = E.st;
  s.capas = f.capas.map(copiarCapa); Object.assign(s, f.extra); if (!s.efecto) delete s.efecto; if (!s.kfDur) delete s.kfDur;
  if (s.sel >= s.capas.length) s.sel = -1;
  vibrar(8); marcarHist(); E.compuesto = null; pedirE(); animarVista();
}
function marcarHist() { const a = $('#eDeshacer'), b = $('#eRehacer'); if (a) a.disabled = HIST.i <= 0; if (b) b.disabled = HIST.i >= HIST.pila.length - 1; }
$('#eDeshacer').onclick = () => histIr(-1);
$('#eRehacer').onclick = () => histIr(1);
document.addEventListener('keydown', (ev) => {
  if (E.vista !== 'vEditor' || !(ev.ctrlKey || ev.metaKey) || /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '')) return;
  const k = ev.key.toLowerCase(); if (k === 'z') { ev.preventDefault(); histIr(ev.shiftKey ? 1 : -1); } else if (k === 'y') { ev.preventDefault(); histIr(1); }
});
// ---- dibujar a mano: sobre el sticker, con color y grosor; al terminar queda como una capa más (se mueve, se anima…) ----
function abrirDibujo() {
  const s = E.st; if (s.sel >= 0) s.sel = -1;
  E.dib = { c: lienzo(LADO, LADO), color: E.ultColor === '#ffffff' ? '#ff3e8a' : E.ultColor, gros: 14, trazos: [], trazo: null, goma: false };
  const D = E.dib, pinta = () => { const g = D.c.getContext('2d'); g.clearRect(0, 0, LADO, LADO); for (const t of D.trazos) dibPintar(g, t); pedirE(); };
  D.pintarTodo = pinta;
  const m = modal(`<div class="hoja hojaDib"><div class="etq" style="margin-top:0">Dibujar <small>· con el dedo sobre el sticker</small></div>
    <div class="colores" id="dC">${COLORES.slice(0, 12).map((c) => `<button class="color" data-v="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}<button class="color goma" data-v="goma" aria-label="Goma"><i data-i="goma"></i></button></div>
    <div class="fila"><span class="etqChica">Grosor</span><input type="range" id="dG" min="4" max="48" value="${D.gros}" aria-label="Grosor"><b id="dGv" class="gotaG"></b></div>
    <div class="botones"><button class="sec" id="dDes"><i data-i="deshacer"></i>Trazo</button><button class="sec" data-x="0">Cancelar</button><button class="pri" data-x="1">Listo</button></div></div>`,
  { claro: true, alCerrar: () => { E.dib = null; pedirE(true); } });
  const marcar = () => { for (const b of $('#dC', m).children) b.classList.toggle('act', D.goma ? b.dataset.v === 'goma' : b.dataset.v === D.color); const g = $('#dGv', m); g.style.width = g.style.height = Math.max(6, D.gros * 0.6) + 'px'; g.style.background = D.goma ? 'transparent' : D.color; $('#dDes', m).disabled = !D.trazos.length; };
  $('#dC', m).onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.v === 'goma') D.goma = true; else { D.goma = false; D.color = b.dataset.v; } marcar(); };
  $('#dG', m).oninput = (ev) => { D.gros = +ev.target.value; marcar(); };
  $('#dDes', m).onclick = () => { D.trazos.pop(); pinta(); marcar(); };
  D.marcar = marcar;
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => {
    const caja = cajaAlfa(D.c); E.dib = null;
    if (caja) {
      const pad = 2, w = caja.x1 - caja.x0 + pad * 2, hh = caja.y1 - caja.y0 + pad * 2, src = lienzo(w, hh);
      src.getContext('2d').drawImage(D.c, -caja.x0 + pad, -caja.y0 + pad);
      s.capas.push({ tipo: 'img', src, x: caja.x0 - pad + w / 2, y: caja.y0 - pad + hh / 2, esc: 1, rot: 0, dibujo: true }); s.sel = s.capas.length - 1;
    }
    cerrarModal(); pedirE(true);
  };
  marcar(); pedirE();
}
function dibPintar(g, t) {
  g.save(); g.lineCap = g.lineJoin = 'round'; g.lineWidth = t.gros; g.strokeStyle = t.color;
  if (t.goma) g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(t.p[0].x, t.p[0].y); if (t.p.length === 1) g.lineTo(t.p[0].x + 0.01, t.p[0].y);
  for (let i = 1; i < t.p.length - 1; i++) { const a = t.p[i], b = t.p[i + 1]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
  if (t.p.length > 1) { const z = t.p[t.p.length - 1]; g.lineTo(z.x, z.y); }
  g.stroke(); g.restore();
}
function dibTrazo(p, empieza) {
  const D = E.dib; if (!D) return;
  if (empieza) { D.trazo = { p: [p], color: D.color, gros: D.gros, goma: D.goma }; D.trazos.push(D.trazo); }
  else { const u = D.trazo.p[D.trazo.p.length - 1]; if (Math.hypot(p.x - u.x, p.y - u.y) < 1.5) return; D.trazo.p.push(p); }
  D.pintarTodo(); if (D.marcar) D.marcar();
}
function cajaAlfa(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
// ---- dibujitos de las formas (para elegir) ----
function htmlFormas(sel, sin) {
  return `<div class="formas">${sin ? `<button class="formaOp${!sel ? ' act' : ''}" data-v=""><canvas width="56" height="56" data-f=""></canvas><small>${sin}</small></button>` : ''}${FORMAS.map(([k, n]) => `<button class="formaOp${sel === k ? ' act' : ''}" data-v="${k}"><canvas width="56" height="56" data-f="${k}"></canvas><small>${n}</small></button>`).join('')}</div>`;
}
function pintarFormas(raiz, color) {
  for (const cv of raiz.querySelectorAll('canvas[data-f]')) {
    const g = cv.getContext('2d'), k = cv.dataset.f; g.clearRect(0, 0, 56, 56); g.save(); g.translate(28, 28);
    if (!k) { g.strokeStyle = '#8d86a3'; g.lineWidth = 3; g.setLineDash([5, 4]); g.strokeRect(-19, -19, 38, 38); }
    else { formaCamino(g, k, 40, 40); g.fillStyle = color || '#ffd23f'; g.fill(); }
    g.restore();
  }
}
// ---- Forma: la foto recortada con forma de corazón, estrella, círculo… ----
function abrirForma() {
  const s = E.st, foto = () => { const c = s.capas[s.sel]; return c && c.tipo === 'img' && !c.lentes && !c.dibujo ? c : [...s.capas].reverse().find((x) => x.tipo === 'img' && !x.lentes && !x.dibujo); };
  const c = foto(); if (!c) return aviso('Primero poné una foto');
  const m = modal(`<div class="hoja"><div class="etq" style="margin-top:0">Forma de la foto</div>${htmlFormas(c.forma || '', 'Sin forma')}
    <div class="botones"><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  pintarFormas(m, '#ff3e8a');
  m.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return; if (b.dataset.x) return cerrarModal();
    if (b.dataset.v === undefined) return; if (b.dataset.v) c.forma = b.dataset.v; else delete c.forma;
    for (const x of m.querySelectorAll('.formaOp')) x.classList.toggle('act', x === b); vibrar(8); pedirE(true);
  };
}
// ---- Fondo: una figura atrás de todo (círculo, explosión, nube…), de un color o en degradé ----
const NOMBRES_DEG2 = { atardecer: 'Atardecer', neon: 'Neón', oro: 'Oro', pasto: 'Pasto', fuego: 'Fuego', hielo: 'Hielo', arcoiris: 'Arcoíris' };
function abrirFondo() {
  const s = E.st; let c = s.capas[s.sel] && s.capas[s.sel].tipo === 'figura' ? s.capas[s.sel] : null;
  const m = modal(`<div class="hoja"><div class="etq" style="margin-top:0">Fondo <small>· una figura atrás de todo</small></div>${htmlFormas(c ? c.fig : '', c ? 'Sacar' : '')}
    <div class="etq">Color</div><div class="colores" id="fC">${COLORES.map((x) => `<button class="color" data-v="${x}" style="background:${x}" aria-label="Color ${x}"></button>`).join('')}</div>
    <div class="chips" id="fD">${Object.keys(DEGRADES).map((k) => `<button class="chip deg" data-d="${k}" style="--deg:linear-gradient(90deg, ${DEGRADES[k].join(', ')})">${NOMBRES_DEG2[k] || k}</button>`).join('')}</div>
    <div class="botones"><button class="sec" id="fT">Con trazo</button><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  const marcar = () => {
    pintarFormas(m, c ? (c.degrade ? DEGRADES[c.degrade][0] : c.color) : '#ffd23f');
    for (const b of m.querySelectorAll('.formaOp')) b.classList.toggle('act', !!c && b.dataset.v === c.fig);
    for (const b of $('#fC', m).children) b.classList.toggle('act', !!c && !c.degrade && b.dataset.v === c.color);
    for (const b of $('#fD', m).children) b.classList.toggle('act', !!c && b.dataset.d === c.degrade);
    $('#fT', m).classList.toggle('act', !!c && !!c.trazo); $('#fT', m).disabled = !c;
  };
  m.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return; if (b.dataset.x) return cerrarModal();
    if (b.classList.contains('formaOp')) {
      const k = b.dataset.v;
      if (!k) { if (c) { s.capas.splice(s.capas.indexOf(c), 1); c = null; s.sel = -1; } }
      else if (c) c.fig = k;
      else { c = { tipo: 'figura', fig: k, color: '#ffd23f', w: 420, h: 420, x: LADO / 2, y: LADO / 2, esc: 1, rot: 0 }; s.capas.unshift(c); s.sel = 0; }
    } else if (!c) return aviso('Elegí una figura');
    else if (b.dataset.v) { c.color = b.dataset.v; delete c.degrade; }
    else if (b.dataset.d) c.degrade = b.dataset.d;
    else if (b.id === 'fT') { if (c.trazo) delete c.trazo; else c.trazo = c.color === '#111111' ? '#ffffff' : '#111111'; }
    vibrar(8); marcar(); pedirE(true);
  };
  marcar();
}
// ---- Neón: un brillo de color alrededor de lo elegido (o de todo) ----
const NEONES = ['#3ec7ff', '#ff3e8a', '#ffd23f', '#4cd964', '#b45cff', '#ffffff', '#ff2d2d'];
function abrirNeon() {
  const s = E.st, c = s.capas[s.sel], obj = c ? [c] : s.capas;
  if (!obj.length) return aviso('Agregá algo primero');
  const m = modal(`<div class="hoja"><div class="etq" style="margin-top:0">Neón <small>· ${c ? 'a lo elegido' : 'a todo'}</small></div>
    <div class="colores" id="nC"><button class="color sinC" data-v="" aria-label="Sin neón"><i data-i="cerrar"></i></button>${NEONES.map((x) => `<button class="color neonC" data-v="${x}" style="background:${x};--n:${x}" aria-label="Neón ${x}"></button>`).join('')}</div>
    <p class="nota">${c ? 'Para ponérselo a todo, tocá afuera del sticker antes.' : 'Para uno solo, tocalo primero.'}</p>
    <div class="botones"><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  const marcar = () => { const v = obj[0].neon || ''; for (const b of $('#nC', m).children) b.classList.toggle('act', b.dataset.v === v); };
  m.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return; if (b.dataset.x) return cerrarModal(); if (b.dataset.v === undefined) return;
    for (const x of obj) { if (b.dataset.v) x.neon = b.dataset.v; else delete x.neon; }
    vibrar(8); marcar(); pedirE(true);
  };
  marcar();
}
// ---- Capas: qué va adelante, esconder, trabar (que no se mueva sin querer), duplicar y sacar ----
const nombreCapa = (c) => c.tipo === 'texto' ? `«${String(c.texto).split('\n')[0].slice(0, 18)}»` : c.tipo === 'emoji' ? `Emoji ${c.ch}` : c.tipo === 'figura' ? `Fondo · ${(FORMAS.find((f) => f[0] === c.fig) || [0, 'figura'])[1]}` : c.lentes ? 'Lentes' : c.dibujo ? 'Dibujo' : c.pega ? 'Pegatina' : 'Foto';
function abrirCapas() {
  const s = E.st; if (!s.capas.length) return aviso('Todavía no hay nada');
  const m = modal(`<div class="hoja hojaCapas"><div class="etq" style="margin-top:0">Capas <small>· la de arriba va adelante</small></div><div class="capasL" id="cL"></div>
    <div class="botones"><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  const pintar = () => {
    const L = $('#cL', m), n = s.capas.length;
    L.innerHTML = s.capas.map((c, i) => [c, i]).reverse().map(([c, i]) => `<div class="capaF${i === s.sel ? ' act' : ''}${c.oculto ? ' oculta' : ''}" data-i="${i}"><canvas width="88" height="88"></canvas><span>${h(nombreCapa(c))}</span>
      <button data-a="ver" aria-label="${c.oculto ? 'Mostrar' : 'Esconder'}"><i data-i="${c.oculto ? 'ojoNo' : 'ojo'}"></i></button><button data-a="bloq" class="${c.bloq ? 'on' : ''}" aria-label="${c.bloq ? 'Destrabar' : 'Trabar'}"><i data-i="candado"></i></button>
      <button data-a="sub" aria-label="Adelante"${i === n - 1 ? ' disabled' : ''}><i data-i="subir"></i></button><button data-a="baj" aria-label="Atrás"${i === 0 ? ' disabled' : ''}><i data-i="bajarC"></i></button>
      <button data-a="dup" aria-label="Duplicar"><i data-i="copias"></i></button><button data-a="borrar" aria-label="Sacar"><i data-i="tacho"></i></button></div>`).join('');
    iconos(L);
    for (const f of L.querySelectorAll('.capaF')) {
      const c = s.capas[+f.dataset.i], cv = f.querySelector('canvas'), g = cv.getContext('2d'), md = s.medidas(c), k = 72 / Math.max(md.w, md.h, 1);
      g.save(); g.translate(44, 44); s.dibujarCapa(g, { ...c, x: 0, y: 0, rot: 0, esc: k, anim: undefined, kf: undefined, oculto: false }, 0); g.restore();
    }
  };
  m.onclick = (ev) => {
    const b = ev.target.closest('button'), f = ev.target.closest('.capaF');
    if (b && b.dataset.x) return cerrarModal(); if (!f) return;
    const i = +f.dataset.i, c = s.capas[i], a = b && b.dataset.a;
    if (!a) s.sel = c.oculto ? -1 : i;
    else if (a === 'ver') { c.oculto = !c.oculto; if (!c.oculto) delete c.oculto; if (s.sel === i) s.sel = -1; }
    else if (a === 'bloq') { c.bloq = !c.bloq; if (!c.bloq) delete c.bloq; if (s.sel === i) s.sel = -1; }
    else if (a === 'sub' || a === 'baj') { const j = a === 'sub' ? i + 1 : i - 1; [s.capas[i], s.capas[j]] = [s.capas[j], s.capas[i]]; if (s.sel === i) s.sel = j; else if (s.sel === j) s.sel = i; }
    else if (a === 'dup') { const d = copiarCapa(c); d.x = Math.min(LADO, c.x + 26); d.y = Math.min(LADO, c.y + 26); delete d.bloq; s.capas.splice(i + 1, 0, d); s.sel = i + 1; }
    else if (a === 'borrar') { s.capas.splice(i, 1); s.sel = -1; if (!s.capas.length) { pedirE(true); return cerrarModal(); } }
    vibrar(8); pintar(); pedirE(true);
  };
  pintar();
}
// ---- Premium: lo que es de Premium se ve con la corona y, sin Premium, abre la hoja para hacerse Premium ----
function pidePremium(que) {
  if (C.esPremium()) return false;
  if (hayModal()) cerrarModal();
  aviso(`${que} es de Premium`); setTimeout(() => C.abrirPremium(), 350); return true;
}
// ---- Movimiento (Premium): puntos clave como en los editores de video. Elegís algo, ponés el cabezal en un momento y lo
// movés, agrandás o girás en el sticker: queda un punto ◆; entre punto y punto se mueve solo ----
function kfPoner(c, t, n) {
  const L = (c.kf || []).map((f) => ({ ...f })), i = L.findIndex((f) => Math.abs(f.t - t) < 0.02);
  const f = { t: i >= 0 ? L[i].t : Math.round(t * 1000) / 1000, x: n.x, y: n.y, esc: n.esc, rot: n.rot, alfa: n.alfa === undefined ? 1 : n.alfa, ease: i >= 0 ? L[i].ease || 'suave' : (E.kf && E.kf.ease) || 'suave' };
  if (i >= 0) L[i] = f; else L.push(f); L.sort((a, b) => a.t - b.t); c.kf = L;
}
const DURS = [1, 2, 3, 5];
function abrirMovimiento() {
  if (pidePremium('Movimiento')) return;
  const s = E.st; if (!s.capas.length) return aviso('Agregá algo primero');
  if (s.sel < 0) s.sel = s.capas.length - 1;
  E.kf = { t: 0, play: false, ease: 'suave', raf: 0 };
  const K = E.kf, D = () => s.kfDur || 2;
  const m = modal(`<div class="hoja hojaKf"><div class="etq" style="margin-top:0">Movimiento <small id="kQue"></small><i class="premiumTag" data-i="corona"></i></div>
    <div class="kfFila"><button class="ico kfPlay" id="kPlay" aria-label="Reproducir"><i data-i="play"></i></button>
      <div class="kfPista" id="kPista"><div class="kfRiel"></div><div class="kfPuntos" id="kPuntos"></div><div class="kfCab" id="kCab"><b id="kSeg"></b></div></div></div>
    <div class="botones kfBot"><button class="sec" id="kPunto"><i data-i="rombo"></i>Punto</button><button class="sec" id="kBorrar"><i data-i="romboMenos"></i>Borrar</button><button class="sec" id="kBucle"><i data-i="bucle"></i>Repetir</button></div>
    <div class="fila"><span class="etqChica">Opacidad</span><input type="range" id="kAlfa" min="0" max="100" value="100" aria-label="Opacidad en este momento"></div>
    <div class="etq">Dura</div><div class="chips" id="kDur">${DURS.map((d) => `<button class="chip" data-d="${d}">${d} s</button>`).join('')}</div>
    <div class="etq">Cómo llega al punto</div><div class="chips" id="kEase">${SUAVES.map(([k, n]) => `<button class="chip" data-e="${k}">${n}</button>`).join('')}</div>
    <p class="nota">Elegí algo, poné el cabezal y movelo, agrandalo o giralo en el sticker: queda un punto clave. Con dos o más, se mueve solo.</p>
    <div class="botones"><button class="sec" id="kSacar">Sacar movimiento</button><button class="pri" data-x="1">Listo</button></div></div>`,
  { claro: true, alCerrar: () => { cancelAnimationFrame(K.raf); E.kf = null; pedirE(true); animarVista(); } });
  const sel = () => s.capas[s.sel];
  const enPunto = (c) => c && c.kf ? c.kf.findIndex((f) => Math.abs(f.t - K.t) < 0.02) : -1;
  const marcar = () => {
    const c = sel(), L = (c && c.kf) || [], i = enPunto(c);
    $('#kQue', m).textContent = c ? '· ' + nombreCapa(c) : '· tocá algo del sticker';
    $('#kPuntos', m).innerHTML = L.map((f, j) => `<button class="kfP${j === i ? ' act' : ''}" data-j="${j}" style="left:${(f.t * 100).toFixed(2)}%" aria-label="Punto ${j + 1}"></button>`).join('');
    $('#kCab', m).style.left = (K.t * 100).toFixed(2) + '%'; $('#kSeg', m).textContent = (K.t * D()).toFixed(1).replace('.', ',') + ' s';
    $('#kPunto', m).disabled = !c; $('#kBorrar', m).disabled = i < 0; $('#kBucle', m).disabled = !L.length; $('#kSacar', m).disabled = !L.length;
    for (const b of $('#kDur', m).children) b.classList.toggle('act', +b.dataset.d === D());
    const e = i >= 0 ? L[i].ease || 'suave' : K.ease; for (const b of $('#kEase', m).children) b.classList.toggle('act', b.dataset.e === e);
    $('#kAlfa', m).value = c ? Math.round(s.pose(c, K.t).alfa * 100) : 100; $('#kAlfa', m).disabled = !c;
    const pl = $('#kPlay', m); pl.innerHTML = `<i data-i="${K.play ? 'pausa' : 'play'}"></i>`; iconos(pl);
  };
  K.alElegir = () => setTimeout(marcar, 0);
  const irA = (t) => { K.t = Math.max(0, Math.min(1, t)); E.compuesto = null; pedirE(); marcar(); };
  const pista = $('#kPista', m); let arrastra = false;
  const tDe = (ev) => { const r = pista.getBoundingClientRect(); return (ev.clientX - r.left) / r.width; };
  pista.onpointerdown = (ev) => { const p = ev.target.closest('.kfP'); if (p) { const c = sel(); irA(c.kf[+p.dataset.j].t); return; } arrastra = true; pista.setPointerCapture(ev.pointerId); if (K.play) parar(); irA(tDe(ev)); };
  pista.onpointermove = (ev) => { if (arrastra) irA(tDe(ev)); };
  pista.onpointerup = pista.onpointercancel = () => { arrastra = false; };
  const parar = () => { K.play = false; cancelAnimationFrame(K.raf); marcar(); };
  const tocar = () => { K.play = true; const t0 = performance.now() - K.t * D() * 1000; const paso = () => { if (!E.kf || !K.play) return; K.t = (((performance.now() - t0) / 1000) % D()) / D(); E.compuesto = null; pedirE('reloj'); $('#kCab', m).style.left = (K.t * 100).toFixed(2) + '%'; $('#kSeg', m).textContent = (K.t * D()).toFixed(1).replace('.', ',') + ' s'; K.raf = requestAnimationFrame(paso); }; K.raf = requestAnimationFrame(paso); marcar(); };
  $('#kPlay', m).onclick = () => (K.play ? parar() : tocar());
  $('#kPunto', m).onclick = () => { const c = sel(); if (!c) return; kfPoner(c, K.t, s.pose(c, K.t)); vibrar(10); pedirE(true); marcar(); if (c.kf.length === 1) aviso('Ahora mové el cabezal y movelo a otro lugar'); };
  $('#kBorrar', m).onclick = () => { const c = sel(), i = enPunto(c); if (i < 0) return; c.kf = c.kf.filter((_, j) => j !== i); if (!c.kf.length) delete c.kf; pedirE(true); marcar(); };
  $('#kBucle', m).onclick = () => { const c = sel(); if (!c || !c.kf) return; kfPoner(c, 1, { ...c.kf[0] }); irA(1); pedirE(true); aviso('Termina donde empezó: se repite sin saltos'); };
  $('#kSacar', m).onclick = () => { const c = sel(); if (!c || !c.kf) return; const P = s.pose(c, 0); Object.assign(c, { x: P.x, y: P.y, esc: P.esc, rot: P.rot }); delete c.kf; pedirE(true); marcar(); };
  $('#kAlfa', m).oninput = (ev) => { const c = sel(); if (!c) return; const P = s.pose(c, K.t), a = +ev.target.value / 100; if (c.kf && c.kf.length) kfPoner(c, K.t, { ...P, alfa: a }); else c.alfa = a; pedirE(true); };
  $('#kAlfa', m).onchange = () => marcar();
  $('#kDur', m).onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; s.kfDur = +b.dataset.d; pedirE(true); marcar(); };
  $('#kEase', m).onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; K.ease = b.dataset.e; const c = sel(), i = enPunto(c); if (i >= 0) { c.kf = c.kf.map((f, j) => (j === i ? { ...f, ease: K.ease } : f)); pedirE(true); } marcar(); };
  m.querySelector('[data-x="1"]').onclick = () => cerrarModal();
  // (cada gesto en el sticker cambia el punto del cabezal: la lista de puntos se redibuja al soltar)
  const vigila = setInterval(() => { if (!E.kf) return clearInterval(vigila); if (!EV.p.size && !K.play) marcar(); }, 400);
  marcar(); pedirE(true);
}
// ---- Efectos de video: a todo el sticker (temblor, giro, glitch, VHS…); algunos son de Premium ----
function abrirEfectos() {
  const s = E.st; if (!s.capas.length) return aviso('Agregá algo primero');
  const m = modal(`<div class="hoja"><div class="etq" style="margin-top:0">Efectos de video <small>· a todo el sticker</small></div>
    <div class="gridXD" id="vfL"><button class="opXD" data-v=""><span><i data-i="bloquear"></i></span><b>Ninguno</b></button>${EFECTOS_VIDEO.map((e) => `<button class="opXD${e.premium ? ' conCorona' : ''}" data-v="${e.id}"><span><i data-i="${e.ico}"></i></span><b>${e.nombre}</b>${e.premium && !C.esPremium() ? '<em class="corona"><i data-i="corona"></i></em>' : ''}</button>`).join('')}</div>
    <p class="nota">Con un efecto, el sticker sale animado (va en un pack animado).</p>
    <div class="botones"><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  const marcar = () => { for (const b of $('#vfL', m).children) b.classList.toggle('act', b.dataset.v === (s.efecto || '')); };
  m.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return; if (b.dataset.x) return cerrarModal(); if (b.dataset.v === undefined) return;
    const e = EFECTOS_VIDEO.find((x) => x.id === b.dataset.v);
    if (e && e.premium && pidePremium('El efecto ' + e.nombre)) return;
    if (e) s.efecto = e.id; else delete s.efecto;
    vibrar(8); marcar(); pedirE(true); animarVista();
  };
  marcar();
}
// ---- Pegatinas: dibujos propios (pegatinas.js) que se suman como una capa más ----
function pegaLienzo(p, lado = 360) {
  const c = lienzo(lado, lado); dibujarPega(c.getContext('2d'), p, lado);
  const k = cajaAlfa(c); if (!k) return c;
  const pad = 4, o = lienzo(k.x1 - k.x0 + 2 * pad, k.y1 - k.y0 + 2 * pad); o.getContext('2d').drawImage(c, -k.x0 + pad, -k.y0 + pad); return o;
}
function ponerPega(s, p, x, y, tam = 170, rot = 0, alFondo = false) {
  const src = pegaLienzo(p), c = { tipo: 'img', src, x, y, esc: tam / Math.max(src.width, src.height), rot, pega: p.id };
  if (alFondo) s.capas.unshift(c); else s.capas.push(c);
  s.sel = s.capas.indexOf(c); return c;
}
function abrirPegatinas() {
  const s = E.st; let cat = E.pegaCat || 'caras';
  const m = modal(`<div class="hoja hojaPega"><div class="etq" style="margin-top:0">Pegatinas <small>· dibujos de Stickerazo</small></div>
    <div class="chips" id="pgC">${PEGA_CATS.map(([k, n]) => `<button class="chip" data-c="${k}">${n}</button>`).join('')}</div><div class="pegaGrid" id="pgG"></div></div>`);
  const pintar = () => {
    for (const b of $('#pgC', m).children) b.classList.toggle('act', b.dataset.c === cat);
    const G = $('#pgG', m); G.innerHTML = PEGATINAS.filter((p) => p.cat === cat).map((p) => `<button class="pegaOp" data-p="${p.id}" aria-label="${h(p.nombre)}"><canvas width="144" height="144"></canvas>${p.premium && !C.esPremium() ? '<em class="corona"><i data-i="corona"></i></em>' : ''}</button>`).join('');
    iconos(G); for (const b of G.children) dibujarPega(b.querySelector('canvas').getContext('2d'), PEGA[b.dataset.p], 144);
  };
  m.onclick = (ev) => {
    if (ev.target === m) return cerrarModal();
    const ch = ev.target.closest('[data-c]'); if (ch) { cat = E.pegaCat = ch.dataset.c; return pintar(); }
    const b = ev.target.closest('[data-p]'); if (!b) return; const p = PEGA[b.dataset.p];
    if (p.premium && pidePremium('Esa pegatina')) return;
    cerrarModal(); const n = s.capas.filter((c) => c.pega).length, [x, y] = LUGARES_EMOJI[n % 4];
    ponerPega(s, p, x, y, 170, x > LADO / 2 ? -0.12 : 0.12); vibrar(10); pedirE(true);
  };
  pintar();
}
// ---- Plantillas: un diseño entero de un toque (textos, figuras, pegatinas y efectos) alrededor de la foto ----
function txtP(s, texto, o = {}) {
  const c = s.agregarTexto({ texto, fuente: o.fuente || 'LuckiestGuy', color: o.color || '#ffffff', contorno: o.contorno === undefined ? '#111111' : o.contorno, globo: o.globo });
  for (const k of ['degrade', 'curva', 'sombraT', 'grosor', 'anim', 'neon', 'espaciado']) if (o[k] !== undefined) c[k] = o[k];
  s.ajustarTexto(c, true); if (o.esc) c.esc *= o.esc; c.x = o.x || LADO / 2; c.y = o.y || LADO / 2; if (o.rot) c.rot = o.rot; return c;
}
const fig = (s, k, o) => { const c = { tipo: 'figura', fig: k, color: '#ffd23f', w: 420, h: 420, x: LADO / 2, y: LADO / 2, esc: 1, rot: 0, ...o }; s.capas.unshift(c); return c; };
const fotoDe = (s) => s.capas.find((c) => c.tipo === 'img' && !c.pega && !c.lentes && !c.dibujo);
const PLANTILLAS = [
  { id: 'meme', nombre: 'Meme', f: (s) => { txtP(s, 'CUANDO PONEN', { fuente: 'Anton', y: 62 }); txtP(s, 'LA PAVA', { fuente: 'Anton', y: 452 }); } },
  { id: 'globo', nombre: 'Te hablo', f: (s) => { txtP(s, '¡HOLA!', { globo: true, x: 360, y: 96, esc: 0.62 }); } },
  { id: 'noticia', nombre: 'Noticia', f: (s) => { s.capas.push({ tipo: 'figura', fig: 'redondeado', color: '#ff2d2d', w: 470, h: 96, x: LADO / 2, y: 438, esc: 1, rot: 0 }); txtP(s, 'ÚLTIMO MOMENTO', { fuente: 'Anton', y: 438, esc: 0.62, contorno: '' }); } },
  { id: 'oferta', nombre: 'Oferta', f: (s) => { fig(s, 'explosion', { color: '#ffd23f', trazo: '#111111' }); txtP(s, '¡OFERTA!', { color: '#ff2d2d', curva: 1, y: 92, grosor: 'grueso' }); } },
  { id: 'cumple', nombre: 'Cumple', f: (s) => { txtP(s, '¡FELIZ CUMPLE!', { curva: 1, degrade: 'arcoiris', y: 88, sombraT: 'dura' }); ponerPega(s, PEGA.confeti, 90, 400, 150, 0.2); ponerPega(s, PEGA.globoF, 432, 380, 150, -0.15); } },
  { id: 'amor', nombre: 'Amor', f: (s) => { ponerPega(s, PEGA.corazon, 96, 110, 110, -0.25); ponerPega(s, PEGA.corazon, 420, 150, 80, 0.3); txtP(s, 'Te quiero', { fuente: 'Pacifico', color: '#ff3e8a', contorno: '#ffffff', y: 444, anim: 'latido' }); } },
  { id: 'enojo', nombre: 'Enojo', f: (s) => { ponerPega(s, PEGA.fuego, 84, 396, 140, -0.2); ponerPega(s, PEGA.fuego, 428, 396, 140, 0.2); txtP(s, '¡NOOO!', { color: '#ff2d2d', y: 74, grosor: 'grueso' }); s.efecto = 'temblor'; } },
  { id: 'buendia', nombre: 'Buen día', f: (s) => { ponerPega(s, PEGA.sol, 94, 96, 150, -0.1); ponerPega(s, PEGA.mate, 424, 404, 150, 0.12); txtP(s, '¡BUEN DÍA!', { fuente: 'Bangers', color: '#ffd23f', y: 452 }); } },
  { id: 'polaroid', nombre: 'Polaroid', f: (s) => { const f0 = fotoDe(s); fig(s, 'redondeado', { color: '#ffffff', w: 440, h: 490, y: 262, trazo: '#dddddd' }); if (f0) { f0.y = 220; f0.esc *= 0.86; } txtP(s, 'qué día', { fuente: 'PermanentMarker', color: '#222222', contorno: '', y: 452, esc: 0.7 }); } },
  { id: 'jaja', nombre: 'Jajaja', f: (s) => { ponerPega(s, PEGA.g_jaja, 380, 92, 190, 0.1); ponerPega(s, PEGA.risa, 92, 420, 130, -0.15); } },
  { id: 'campeon', nombre: 'Campeón', premium: true, f: (s) => { ponerPega(s, PEGA.corona, LADO / 2, 64, 190, 0); txtP(s, 'CAMPEÓN', { degrade: 'oro', y: 452, sombraT: 'dura' }); } },
  { id: 'glitch', nombre: 'Error 404', premium: true, f: (s) => { txtP(s, 'ERROR 404', { fuente: 'Anton', color: '#3ec7ff', y: 450 }); s.efecto = 'glitch'; } },
  { id: 'neon', nombre: 'Neón', premium: true, f: (s) => { const f0 = fotoDe(s); if (f0) f0.neon = '#ff3e8a'; txtP(s, 'NEÓN', { degrade: 'neon', y: 450, neon: '#3ec7ff' }); s.efecto = 'neonV'; } },
  { id: 'vhs', nombre: 'Recuerdo', premium: true, f: (s) => { const f0 = fotoDe(s); if (f0) f0.filtro = { preset: 'vintage' }; txtP(s, 'REC ●', { fuente: 'Anton', color: '#ff2d2d', contorno: '', x: 120, y: 56, esc: 0.5 }); s.efecto = 'vhs'; } },
];
function previaPlantilla(pl) {
  const s = new Sticker(), base = lienzo(260, 320), g = base.getContext('2d');
  g.fillStyle = '#8d86a3'; g.beginPath(); g.arc(130, 110, 72, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(130, 320, 120, 120, 0, Math.PI, 0); g.fill();
  s.agregarImagen(base); pl.f(s); s.sel = -1; return s.componer(0);
}
function abrirPlantillas() {
  const s = E.st;
  const m = modal(`<div class="hoja hojaPega"><div class="etq" style="margin-top:0">Plantillas <small>· se suman a tu foto</small></div><div class="pegaGrid plantG" id="plG">${PLANTILLAS.map((p) => `<button class="pegaOp plantOp" data-p="${p.id}"><canvas width="160" height="160"></canvas><small>${h(p.nombre)}</small>${p.premium && !C.esPremium() ? '<em class="corona"><i data-i="corona"></i></em>' : ''}</button>`).join('')}</div>
    <p class="nota">Después cambiale lo que quieras: tocá dos veces un texto para escribir el tuyo.</p></div>`);
  setTimeout(() => { for (const b of $('#plG', m).children) { const pl = PLANTILLAS.find((x) => x.id === b.dataset.p); try { b.querySelector('canvas').getContext('2d').drawImage(previaPlantilla(pl), 0, 0, 160, 160); } catch (e) { console.error(e); } } }, 30);
  m.onclick = (ev) => {
    if (ev.target === m) return cerrarModal();
    const b = ev.target.closest('[data-p]'); if (!b) return; const pl = PLANTILLAS.find((x) => x.id === b.dataset.p);
    if (pl.premium && pidePremium('La plantilla ' + pl.nombre)) return;
    cerrarModal(); pl.f(s); s.sel = -1; vibrar(12); pedirE(true); animarVista(); aviso('Tocá dos veces un texto para cambiarlo');
  };
}
// ---- Alinear: centrar, enderezar, adelante o atrás, y que entre todo ----
function abrirAlinear() {
  const s = E.st; if (!s.capas.length) return aviso('Todavía no hay nada');
  const OPS = [['h', 'alH', 'Centrar'], ['v', 'alV', 'Al medio'], ['c', 'alC', 'Centro'], ['r', 'alR', 'Derecho'], ['f', 'frente', 'Adelante'], ['a', 'atrasCapa', 'Atrás'], ['e', 'alE', 'Que entre todo']];
  const m = modal(`<div class="hoja"><div class="etq" style="margin-top:0">Alinear <small id="alQ"></small></div><div class="gridXD">${OPS.map(([k, ico, n]) => `<button class="opXD" data-k="${k}"><span><i data-i="${ico}"></i></span><b>${n}</b></button>`).join('')}</div>
    <div class="botones"><button class="pri" data-x="1">Listo</button></div></div>`, { claro: true });
  const marcar = () => { const c = s.capas[s.sel]; $('#alQ', m).textContent = c ? '· ' + nombreCapa(c) : '· tocá algo (o «Que entre todo»)'; for (const b of m.querySelectorAll('.opXD')) b.disabled = !c && b.dataset.k !== 'e'; };
  m.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return; if (b.dataset.x) return cerrarModal();
    const k = b.dataset.k, c = s.capas[s.sel];
    if (k === 'e') { s.encajar(); }
    else if (!c) return;
    else if (k === 'h') c.x = LADO / 2; else if (k === 'v') c.y = LADO / 2; else if (k === 'c') { c.x = LADO / 2; c.y = LADO / 2; } else if (k === 'r') c.rot = 0;
    else if (k === 'f') s.alFrente();
    else if (k === 'a') { const i = s.sel, x = s.capas.splice(i, 1)[0]; s.capas.unshift(x); s.sel = 0; }
    vibrar(8); marcar(); pedirE(true);
  };
  marcar();
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
      ir('vPack', false, true); aviso(destino === 'cambiar' ? '¡Cambiado!' : '¡Guardado!');
    } catch (e) { console.error(e); cerrarModal(); aviso(String(e.message || e).includes('pesa') ? 'El sticker quedó muy pesado' : 'Uh, no se guardó: ' + (e.message || e)); }
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
  await cargarFuentesDe(pr.capas);
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
  if (t !== E.tab) C.pararCancionPerfil();
  const antes = E.tab; E.tab = t;
  for (const k of ['Feed', 'Crear', 'Listos', 'Social', 'Chat', 'Mios', 'Perfil']) { const el = $('#tab' + k); el.classList.toggle('oc', k !== t); if (k === t && antes !== t) { el.classList.remove('aparece'); void el.offsetWidth; el.classList.add('aparece'); } }
  for (const b of $('#tabs').children) b.classList.toggle('act', b.dataset.t === t);
  $('#vInicio .cabInicio').classList.toggle('chica', t !== 'Crear');
  if (t === 'Feed') { if (Date.now() - feedCargado > 120000 || !$('#feedLista').children.length) { feedCargado = Date.now(); C.cargarFeed(true); } }
  else if (t === 'Crear') pintarCarrusel(); else if (t === 'Listos') buscar($('#qBuscar').value); else if (t === 'Social') C.tabSocial(); else if (t === 'Chat') C.tabChat(); else if (t === 'Perfil') C.pintarPerfil(); else pintarMios();
}
$('#tabs').onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; vibrar(6); if (b.dataset.t === E.tab && b.dataset.t === 'Feed') { $('#tabFeed').scrollTo({ top: 0, behavior: 'smooth' }); feedCargado = Date.now(); return C.cargarFeed(true); } pestaña(b.dataset.t); };   // (sin agua: va sólo en los momentos importantes)
function pintarInicio() { pestaña(E.tab); pintarTopInicio(); }

// ---- arriba del feed: buscar, «¿de dónde sos?», historias (packs en círculos) y banners que pasan solos ----
const PAISES = LISTA_PAISES.map((p) => [p.k, p.f, p.n]);
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
  { img: 'banners/latam.webp', t: 'Memes de <em>toda Latinoamérica</em>', s: 'Argentina, México, Chile, Perú, Colombia, Venezuela, Uruguay', b: 'Ver packs', a: () => ((f) => f())(() => pestaña('Listos')) },
  { img: 'banners/pack.webp', t: 'Tu pack en <em>un minuto</em>', s: 'Elegís hasta 30 fotos y te lo armo entero', b: 'Armar', a: () => $('#bExpress').click() },
];
let relojBanner = 0;
function pintarTopInicio() {
  C.pintarEvento();
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
    pc.innerHTML = `<i data-i="mundo"></i><span><b>¿De dónde sos?</b><small>Elegí tu país y te muestro primero sus memes</small></span><i data-i="sig"></i>`; iconos(pc);
    pc.classList.remove('oc');
  }
}
$('#eventoCard').onclick = () => { vibrar(10); C.verTermo(); };
// ---- la música de tu país ----
function musica(saltar) { abrirMusica({ base: C.API.replace(/\/sz$/, ''), pais: miPais() || 'ar', X: { vibrar, aviso }, saltar }); }
$('#botonMusica').onclick = () => { vibrar(8); musica(false); };
setInterval(() => $('#botonMusica').classList.toggle('sonando', hayMusica()), 1500);
// ---- modo claro, oscuro o como el celular (con un círculo que se abre desde el dedo) ----
const TEMAS = [['oscuro', 'luna', 'Oscuro'], ['claro', 'sol', 'Claro'], ['auto', 'celular', 'Como el celular']];
function temaActual() { try { return localStorage.getItem('sz_tema') || 'oscuro'; } catch (e) { return 'oscuro'; } }
const claroDelCelu = matchMedia('(prefers-color-scheme: light)');
function aplicarTema(t) { document.documentElement.dataset.tema = (t === 'auto' ? (claroDelCelu.matches ? 'claro' : 'oscuro') : t); }
claroDelCelu.addEventListener('change', () => { if (temaActual() === 'auto') aplicarTema('auto'); });
function cambiarTema(t, desde) {
  try { localStorage.setItem('sz_tema', t); } catch (e) { /* igual se cambia ahora */ }
  const raiz = document.documentElement; raiz.style.setProperty('--cx', desde.x + 'px'); raiz.style.setProperty('--cy', desde.y + 'px');
  if (document.startViewTransition && !quieto) document.startViewTransition(() => aplicarTema(t)); else liquido(() => aplicarTema(t), desde);
}
function elegirTema(despues) {
  const t0 = temaActual();
  const m = modal(`<div class="hoja"><h3>¿Cómo la querés ver?</h3><div class="temas">${TEMAS.map(([k, e, n]) => `<button class="tema t_${k}${k === t0 ? ' act' : ''}" data-t="${k}"><span class="muestra"><i></i><i></i><i></i></span><b><i data-i="${e}"></i>${n}</b></button>`).join('')}</div></div>`);
  m.querySelector('.temas').onclick = (ev) => { const b = ev.target.closest('[data-t]'); if (!b) return; vibrar(10); const r = b.getBoundingClientRect(); cerrarModal(); cambiarTema(b.dataset.t, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); if (despues) setTimeout(despues, 700); };
}
$('#irBuscar').onclick = () => { pestaña('Listos'); setTimeout(() => $('#qBuscar').focus(), 60); };
$('#historias').onclick = (ev) => { const b = ev.target.closest('.hist'); if (!b) return; vibrar(6); const pk = LISTOS.find((x) => x.id === b.dataset.l); if (pk) { b.classList.add('visto'); hojaListo(pk); } };
function paisActual() { return PAISES.find((x) => x[0] === miPais()) || null; }
function ponerPais(k) {
  try { localStorage.setItem('sz_pais', k); } catch (e) { /* sin guardar: igual se ordena ahora */ }
  ordenarPorPais(); $('#historias').innerHTML = ''; $('#carrusel').innerHTML = ''; $('#paisCard').classList.add('oc');
  const n = PAISES.find((x) => x[0] === k), hay = LISTOS.some((x) => x.pais === k);
  aviso(k === 'otro' ? '¡Listo! Bienvenido/a 🌎' : hay ? `¡Listo! Primero los de ${n[2]} ${n[1]}` : `¡Bienvenido/a desde ${n ? n[2] + ' ' + n[1] : 'tu país'}!`);
}
// (elegir o cambiar el país: el mapa a pantalla completa)
function elegirPais(despues) {
  elegirPaisMapa({ inicial: miPais() || 'ar', vibrar, cerrar: () => {}, listo: (k) => { confeti(); ponerPais(k); if (despues) despues(); } });
}
$('#paisCard').onclick = () => { vibrar(8); elegirPais(() => pintarTopInicio()); };

// ---- packs listos: las vistas previas se arman sólo cuando se ven (las de la pantalla primero), en los ratos libres, y
// quedan guardadas en el celular para la próxima vez (con una huella del dibujo: si el pack cambia, se arma de nuevo) ----
const previas = new Map(), CACHE_PREV = 'sz-previas-1';
const huellaTxt = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
let cachePrev = null;
const abrirCachePrev = () => (cachePrev ||= (window.caches ? caches.open(CACHE_PREV).catch(() => null) : Promise.resolve(null)));
async function previaUrl(pk, i) {
  const k = pk.id + ':' + i; if (previas.has(k)) return previas.get(k);
  const def = pk.stickers[i], clave = `/previa/${encodeURIComponent(pk.id)}/${i}/${huellaTxt(JSON.stringify(def))}`, cache = await abrirCachePrev();
  if (cache) { try { const r = await cache.match(clave); if (r) { const u = URL.createObjectURL(await r.blob()); previas.set(k, u); return u; } } catch (e) { /* sin caché */ } }
  if (pk.meme) await prepararListo(pk);
  const c = armarListo(def, i).componer(0, true), t = lienzo(192, 192), g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, 192, 192);
  const blob = await new Promise((ok) => t.toBlob(ok, 'image/webp', 0.85)), u = blob ? URL.createObjectURL(blob) : t.toDataURL('image/webp', 0.85);
  previas.set(k, u);
  if (cache && blob) cache.put(clave, new Response(blob, { headers: { 'Content-Type': 'image/webp' } })).catch(() => {});
  return u;
}
// (una fila para todas las listas: de a una, cuando el navegador está libre)
const COLA_PREV = []; let colaPrevCorre = false;
const libre = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 16));
function correrColaPrev() {
  if (colaPrevCorre) return; colaPrevCorre = true;
  const paso = async () => {
    const im = COLA_PREV.shift(); if (!im) { colaPrevCorre = false; return; }
    if (im.isConnected && im.dataset.l) {
      const [id, i] = im.dataset.l.split(':'), pk = LISTOS.find((x) => x.id === id);
      try { if (pk) { const u = await previaUrl(pk, +i); if (im.isConnected) { im.src = u; im.removeAttribute('data-l'); } } } catch (e) { console.error(e); }
    }
    libre(paso);
  };
  libre(paso);
}
const VE_PREV = window.IntersectionObserver ? new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) { VE_PREV.unobserve(e.target); if (e.target.dataset.l) COLA_PREV.push(e.target); }
  correrColaPrev();
}, { rootMargin: '240px' }) : null;
function llenarPrevias(raiz) {
  for (const im of raiz.querySelectorAll('img[data-l]')) { if (VE_PREV) VE_PREV.observe(im); else COLA_PREV.push(im); }
  if (!VE_PREV) correrColaPrev();
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
  if (!pack) return aviso('Uh, no se pudo agregar. Probá de nuevo');
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
    cont.innerHTML = '<div class="vacio"><div class="vacioIco pegaV"><i class="pegaUI" data-pega="chispas"></i></div><b>Todavía no hiciste ningún pack</b><span>Elegí una foto: Stickerazo la recorta solo y en un minuto tenés tu primer sticker.</span></div>';
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
      await cargarFuentesDe(ult.proyecto.capas);
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
      await P.borrarPack(id); await P.guardarPacks(packs); E.packs = packs; E.packId = null; ir('vInicio'); aviso('Chau pack 👋');
    }
  };
};
$('#pWhats').onclick = async () => {
  const pack = packActual(); if (!pack || pack.stickers.length < MIN_ST) return;
  const r = await P.agregarAWhatsApp(pack);
  if (r === 'ok') { aviso('¡Listo! Ya lo tenés en WhatsApp'); pintarPack(); setTimeout(pausaAnuncio, 1600); }
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
C.iniciar({ agua: (f) => liquido(f || null, { x: innerWidth / 2, y: innerHeight / 2 }, !f), $, h, modal, cerrarModal, aviso, ir, iconos, E, confirmar, vibrar, confeti, pestaña, carruselListos, norm, buscarTag, pintarPack: () => pintarPack(), atras, paisActual, elegirPais, elegirTema, temaActual, musica: () => musica(false), recargarPacks: () => { if (E.vista === 'vInicio') pintarInicio(); } });
// ---- los anuncios (si el APK los trae): el banner de abajo no mientras recortás o editás, y uno de pantalla completa sólo
//  en pausas naturales (Java decide si ya pasó un rato desde el último) ----
// (con Premium, nada de anuncios)
const hayAnuncios = () => !!(window.SZN && window.SZN.hayAnuncios && window.SZN.hayAnuncios()) && !C.esPremium();
function bannerSegunVista(v) { if (hayAnuncios()) window.SZN.anuncioBanner(v !== 'vRecorte' && v !== 'vEditor'); }
function pausaAnuncio() { if (hayAnuncios() && !hayModal()) window.SZN.anuncioPausa(); }
// ---- versión nueva (se bajó sola): avisar cuando no está creando ----
let otaPendiente = null;
window.__szOta = (v) => { otaPendiente = v; mostrarOta(); };
function mostrarOta() {
  if (!otaPendiente || hayModal() || E.vista === 'vRecorte' || E.vista === 'vEditor') return;
  otaPendiente = null;
  const m = modal(`<div class="hoja centro"><div class="grandote"><i class="pegaUI" data-pega="brillo"></i></div><h3>¡Stickerazo nuevo!</h3><p>Ya se bajó la versión nueva. Abrila ahora o se abre sola la próxima vez que entres.</p>
    <div class="botones"><button class="sec" data-x="0">Después</button><button class="pri" data-x="1">Abrir ahora</button></div></div>`);
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = () => { cerrarModal(); if (window.SZN && window.SZN.reiniciar) window.SZN.reiniciar(); else location.reload(); };
}
// ---- APK nuevo: sólo cuando cambió algo de Java (la página se actualiza sola; el APK, no). Lo dice /app.json ----
//  Del APK de la página (canal «web»): se baja y se instala desde acá. Los APK viejos (0.6, sin «Actualizar» en el
//  puente): se baja de la página y se instala encima. Los de las tiendas no avisan: los actualiza su tienda, que además
//  puede tardar días en aprobar una versión (avisar antes confundiría).
const nombreMayor = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); if (x.some(isNaN) || y.some(isNaN)) return false; for (let i = 0; i < Math.max(x.length, y.length); i++) { const p = x[i] || 0, q = y[i] || 0; if (p !== q) return p > q; } return false; };
let apkInfo = null, apkMostrado = false;
const bajarDeLaPagina = () => { cerrarModal(); location.href = `${C.API}/descargar`; };
async function revisarApk() {
  const S = window.SZN; if (!S || !S.version) return;
  if (S.canal && S.canal() !== 'web') return;
  try {
    const r = await fetch(`${C.API}/app.json`, { cache: 'no-store' }); if (!r.ok) return;
    const a = await r.json(), nueva = S.codigoApk ? +a.v > +S.codigoApk() : nombreMayor(a.nombre, S.version());
    if (!nueva) return;
    // (una vez por día, no cada vez que la abre)
    let antes = 0; try { antes = +localStorage.getItem('sz_apk_' + a.v) || 0; } catch (e) { /* nada */ }
    if (Date.now() - antes < 20 * 3600e3) return;
    apkInfo = a; mostrarApk();
  } catch (e) { /* sin internet: la próxima vez */ }
}
function mostrarApk() {
  if (!apkInfo || apkMostrado || hayModal() || E.vista === 'vRecorte' || E.vista === 'vEditor') return;
  apkMostrado = true; try { localStorage.setItem('sz_apk_' + apkInfo.v, String(Date.now())); } catch (e) { /* nada */ }
  const S = window.SZN, canal = S.canal ? S.canal() : 'viejo', mb = Math.round(apkInfo.n / 1048576);
  const tienda = { play: 'Google Play', galaxy: 'Galaxy Store', huawei: 'AppGallery', uptodown: 'Uptodown' }[canal];
  const texto = tienda ? `Ya está en ${tienda}. Tocá «Actualizar» y se abre ahí.`
    : canal === 'web' ? `Pesa ${mb} MB. Se baja y se instala desde acá. Tus stickers y tu cuenta quedan como están.`
      : `Pesa ${mb} MB. Se baja de nuestra página: abrila y tocá «Instalar». Tus stickers y tu cuenta quedan como están.`;
  const m = modal(`<div class="hoja centro actApk"><div class="grandote"><i class="pegaUI" data-pega="regalo"></i></div><h3>Llegó Stickerazo ${h(apkInfo.nombre)}</h3><p>${texto}</p>
    <div class="barraApk oc"><i></i></div><p class="estApk"></p>
    <div class="botones"><button class="sec" data-x="0">Después</button><button class="pri" data-x="1">Actualizar</button></div></div>`);
  m.querySelector('[data-x="0"]').onclick = () => cerrarModal();
  m.querySelector('[data-x="1"]').onclick = (ev) => { if (S.actualizarApp) { ev.currentTarget.disabled = true; S.actualizarApp(); } else bajarDeLaPagina(); };
}
// (lo que va pasando en Java: permiso, bajando N %, instalando, la ventanita de Android, listo o error)
window.__szApkEstado = (estado, d) => {
  const TX = { permiso: 'Activá «Permitir de esta fuente» y volvé: sigue sola.', sinpermiso: 'Sin ese permiso no se puede instalar desde acá. Bajala de la página.',
    bajando: `Bajando… ${d}%`, instalando: 'Instalando…', confirmar: 'Tocá «Actualizar» en la ventanita de Android.', listo: '¡Listo! Abrí Stickerazo de nuevo.',
    cancelado: 'La cancelaste. Podés actualizar cuando quieras.', aldia: 'Ya tenés la última 👌', error: d || 'No se pudo.', tienda: '' };
  const m = document.querySelector('#modal .actApk');
  if (!m) { if (estado === 'error' || estado === 'sinpermiso' || estado === 'aldia') aviso(TX[estado]); return; }
  const est = m.querySelector('.estApk'), barra = m.querySelector('.barraApk'), boton = m.querySelector('[data-x="1"]');
  est.textContent = TX[estado] ?? '';
  barra.classList.toggle('oc', estado !== 'bajando'); barra.firstElementChild.style.width = (+d || 0) + '%';
  boton.disabled = ['bajando', 'instalando', 'confirmar', 'permiso'].includes(estado);
  if (estado === 'error' || estado === 'sinpermiso') { boton.textContent = 'Bajar de la página'; boton.onclick = bajarDeLaPagina; }
  if (estado === 'tienda' || estado === 'aldia') setTimeout(cerrarModal, estado === 'aldia' ? 1200 : 0);
};
setTimeout(revisarApk, 6000);
// los enlaces «stickerazo://pack/ID» (de la página para compartir) abren el pack
window.__szAbrir = (ruta) => { if (/pack\/entrar/.test(String(ruta || ''))) return C.revisarEntrada(); if (/pack\/premium/.test(String(ruta || ''))) return C.revisarPremium(); const m = /pack\/([a-z0-9]{10})/.exec(String(ruta || '')); if (m) C.abrirPublico(m[1]); };
// (volvió de Google al celular: que pregunte ya si entró; y si la app se reinició en el medio, que siga esperando)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { C.revisarEntrada(); C.revisarPremium(); } });
setTimeout(() => C.revisarEntrada(), 1500);

// ---- arranque ----
// (en la app, Java ya deja el lugar de las barras del sistema y del teclado: acá no se suma otra vez)
if (P.esApp) { document.documentElement.style.setProperty('--arriba', '0px'); document.documentElement.style.setProperty('--abajo', '0px'); }
iconos();
for (const el of [document.getElementById('app'), ...document.querySelectorAll('.vista')]) if (el) el.addEventListener('scroll', () => { if (el.scrollLeft) el.scrollLeft = 0; }, { passive: true });
// (lo que dibujan después las otras partes —comunidad, música, termo, mapa— también lleva sus íconos)
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches('i[data-i]:not([data-hecho]), i[data-pega]:not([data-hecho])')) iconos(n.parentNode); else if (n.querySelector('i[data-i]:not([data-hecho]), i[data-pega]:not([data-hecho])')) iconos(n); } }).observe(document.body, { childList: true, subtree: true });
cargarFuentes('./').then(() => pedirE(true));
servidorFuentes(`${C.API}/fuentes/`);
const alCambiarTam = () => { if (E.vista === 'vRecorte') pedirR(); else if (E.vista === 'vEditor') pedirE(); };
window.addEventListener('resize', alCambiarTam); if (window.ResizeObserver) { const ro = new ResizeObserver(alCambiarTam); ro.observe(RV.c); ro.observe(EV.c); }
pintarInicio();
// ---- la bienvenida (la primera vez): tres pantallas animadas y el país; después entra con el líquido ----
function bienvenidaVista() { try { return !!localStorage.getItem('sz_bienvenida'); } catch (e) { return true; } }
function mostrarBienvenida() {
  const fotos = [], M = LISTOS.filter((x) => x.meme); for (let i = 0; i < 7 && M.length; i++) { const pk = M[(i * 5) % M.length]; fotos.push(pk.stickers[i % pk.stickers.length].img); }
  const b = document.createElement('div'); b.id = 'bienvenidaApp'; b.className = 'bvApp';
  b.innerHTML = `<button class="bvSaltar" id="bvSaltar">Saltear</button><div class="bvTira" id="bvTira">
    <section class="bvPag"><div class="bvCollage">${fotos.map((f, i) => `<img src="${f}" alt="" style="--i:${i}">`).join('')}</div>
      <h2>Stickers con <em>onda</em>, al toque</h2><p>Con una foto, un texto o un meme. Para tu WhatsApp, gratis y sin marca de agua.</p></section>
    <section class="bvPag"><div class="bvBanner" style="--fondo:url('banners/xd.webp')"></div><span class="bvXD">xD</span>
      <h2>Arruiná tus fotos <em>a propósito</em></h2><p>Ojo de pez, quemada, calidad trucha… como los memes que circulan por el grupo.</p></section>
</div>
    <div class="bvPie"><div class="bvPuntos">${[0, 1, 2].map((i) => `<i class="${i ? '' : 'act'}"></i>`).join('')}</div><button class="grande" id="bvSig">Dale</button></div>`;
  document.body.appendChild(b);
  let pag = 0; const tira = b.querySelector('#bvTira'), sig = b.querySelector('#bvSig');
  const irA = (k, quieto = false) => { pag = k; tira.style.transform = `translateX(${-100 * k}%)`; [...b.querySelectorAll('.bvPuntos i')].forEach((p, i) => p.classList.toggle('act', i === k)); [...tira.children].forEach((p, i) => p.classList.toggle('activa', i === k)); if (!quieto) vibrar(6); };
  const cerrar = () => { try { localStorage.setItem('sz_bienvenida', '1'); } catch (e) { /* igual se cierra */ } liquido(() => { b.remove(); pintarTopInicio(); }, { x: innerWidth / 2, y: innerHeight - 60 }); };
  // (después de las dos pantallas, el mapa: «¿De dónde sos?»)
  const alMapa = () => { b.querySelectorAll('.bvPuntos i').forEach((p, i) => p.classList.toggle('act', i === 2)); elegirPaisMapa({ inicial: miPais() || 'ar', vibrar, listo: (k) => { confeti(); ponerPais(k); setTimeout(cerrar, 250); setTimeout(() => musica(true), 1100); } }); };
  sig.onclick = () => (pag < 1 ? irA(pag + 1) : alMapa());
  b.querySelector('#bvSaltar').onclick = cerrar;
  // (deslizar con el dedo también cambia de pantalla)
  let x0 = null; tira.addEventListener('touchstart', (ev) => { x0 = ev.touches[0].clientX; }, { passive: true });
  tira.addEventListener('touchend', (ev) => { if (x0 == null) return; const d = ev.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(d) > 50) { if (d < 0 && pag === 1) alMapa(); else irA(Math.max(0, Math.min(1, pag + (d < 0 ? 1 : -1)))); } });
  irA(0, true);
}
if (!bienvenidaVista()) mostrarBienvenida();

// ---- «pop»: lo que aparece en las listas entra rebotando, de a uno (hasta 14 por tanda) ----
const LISTAS_POP = '.feedLista, .listos, .packs, .grilla, #pGrilla, .hojaGrilla, .carrusel, .historias, .lista, .stats, .emojis, .gridXD, .chips, .tira, #puCont .puGrilla';
const obsPop = new MutationObserver((cambios) => {
  const tandas = new Map();
  for (const c of cambios) for (const n of c.addedNodes) {
    if (n.nodeType !== 1 || !n.parentElement || !n.parentElement.matches(LISTAS_POP) || n.classList.contains('esq')) continue;
    const k = tandas.get(n.parentElement) || 0; tandas.set(n.parentElement, k + 1);
    if (k < 14) { n.style.setProperty('--n', k); n.classList.add('pop'); n.addEventListener('animationend', () => n.classList.remove('pop'), { once: true }); }
  }
});
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) obsPop.observe(document.body, { childList: true, subtree: true });

// ---- vidrio líquido: el brillo sigue al dedo ----
const VIDRIO = '.tabs, .sec, .buscarFalso, .pBoton, .seg, .paisCard, .chip';
document.addEventListener('pointerdown', (ev) => {
  const v = ev.target.closest(VIDRIO); if (!v) return;
  const r = v.getBoundingClientRect(); v.classList.add('vl', 'brilla'); v.style.setProperty('--mx', ev.clientX - r.left + 'px'); v.style.setProperty('--my', ev.clientY - r.top + 'px');
  const fin = () => { v.classList.remove('brilla'); removeEventListener('pointerup', fin); removeEventListener('pointercancel', fin); };
  addEventListener('pointerup', fin); addEventListener('pointercancel', fin);
}, true);
document.addEventListener('pointermove', (ev) => { const v = ev.target.closest && ev.target.closest('.vl.brilla'); if (!v) return; const r = v.getBoundingClientRect(); v.style.setProperty('--mx', ev.clientX - r.left + 'px'); v.style.setProperty('--my', ev.clientY - r.top + 'px'); }, { passive: true });

// ---- la burbuja de la pestaña elegida se desliza (y se estira un toque) ----
const indicador = document.createElement('i'); indicador.className = 'indicador'; $('#tabs').prepend(indicador);
function moverIndicador() {
  const b = $('#tabs button.act:not(.centro)'); if (!b) { indicador.style.opacity = 0; return; }
  const r = b.getBoundingClientRect(), rt = $('#tabs').getBoundingClientRect(), w = Math.min(70, r.width - 4);
  indicador.style.opacity = 1; indicador.style.width = w + 'px'; indicador.style.left = r.left - rt.left + (r.width - w) / 2 + 'px';
}
new MutationObserver(moverIndicador).observe($('#tabs'), { subtree: true, attributes: true, attributeFilter: ['class'] });
addEventListener('resize', moverIndicador); setTimeout(moverIndicador, 50);
if (P.esApp && window.SZN.enlaceInicial) { const e = window.SZN.enlaceInicial(); if (e) window.__szAbrir(e); }
// (los modelos de recorte, de fondo, para que el primer recorte salga enseguida; en un celular flojo recién cuando va a
// crear —toca «+»—: cargarlos traba el arranque)
if (!LIVIANO) setTimeout(() => recorte().catch(() => {}), 1200);
else document.addEventListener('pointerdown', function pre(ev) { if (ev.target.closest('[data-t="Crear"], #bCrear, #bCam, #bExpress, .centro')) { document.removeEventListener('pointerdown', pre, true); recorte().catch(() => {}); } }, true);
window.__sz = { LIQ, liquido, E, ir, atras, abrirFoto, recorte, aviso, pestaña, C, pedirE };
// (la oferta de bienvenida de Premium: unos segundos después de entrar, si corresponde —comunidad.js—)
setTimeout(() => C.ofertaAlEntrar().catch(() => {}), 4500);
