// ---------------- íconos: dibujados para el juego (juego/iconos/*.svg, herramientas/iconos.py) y trazos para los botones ----------------
// Nada de emojis: los mods traen "ico:nombre" (o su propia imagen); los emojis de mods viejos se cambian por la imagen
// que más se parece (ICO_EMOJI_RB en formato.js). Los botones usan trazos SVG del color del texto.
const ICO_IMG = {/*ICONOSRB*/};
const ICO_LISTA = Object.keys(ICO_IMG);
const ICO_DATA = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;
function icoSrc(v) { if (typeof v === 'string' && ICO_DATA.test(v)) return v; return ICO_IMG[icoNombreRB(v)] || ICO_IMG.mod || ''; }
function icoHTML(v, cl) { const s = icoSrc(v); return s ? `<img class="ico${cl ? ' ' + cl : ''}" src="${s}" alt="" draggable="false">` : ''; }
// dibujos de 24×24 con trazo (o relleno donde hace falta)
const GLIFOS = {
  mas: '<path d="M12 5v14M5 12h14"/>',
  candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.2"/>',
  props: '<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/>',
  punto: '<path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  gente: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.1c2.9.3 5.2 2.5 5.2 5.9"/>',
  ajustes: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.6"/>',
  guardar: '<path d="M5 3.5h11l3.5 3.5v13.5H5z"/><path d="M8 3.5v5h7.5v-5M8 20.5v-6.5h8v6.5"/>',
  jugar: '<path d="M7.5 4.8v14.4L19 12z" fill="currentColor"/>',
  subir: '<path d="M12 15.5V4M6.5 9.5 12 4l5.5 5.5M4.5 20h15"/>',
  bajar: '<path d="M12 4v11.5M6.5 10 12 15.5 17.5 10M4.5 20h15"/>',
  si: '<path d="m4.5 12.5 5 5 10-10.5"/>',
  no: '<path d="m6 6 12 12M18 6 6 18"/>',
  lapiz: '<path d="m4 20 1.2-4.8L15.8 4.6a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8L8.8 18.8z"/><path d="m13.8 6.6 3.6 3.6"/>',
  girar: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v4.6h-4.6"/>',
  traer: '<path d="M12 3.5v9M8 8.5l4 4 4-4"/><circle cx="12" cy="17.5" r="3"/>',
  basura: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5"/>',
  dado: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  corazon: '<path d="M12 20s-7.8-4.7-7.8-10.3A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.8 2.5C19.8 15.3 12 20 12 20z"/>',
  rayo: '<path d="M13.5 2.5 5 13.5h6l-1.5 8 9-11.5h-6z"/>',
  salto: '<path d="m6 12.5 6-6 6 6M6 19l6-6 6 6"/>',
  mira: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
  estrella: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  aviso: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 9.5v5M12 17.3v.2"/>',
  martillo: '<path d="M13.5 4.5 19.5 10.5 17 13 11 7z"/><path d="m14.5 9.5-10 10"/>',
  salir: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  caja: '<path d="M3.5 7.5 12 3.2l8.5 4.3v9L12 20.8l-8.5-4.3z"/><path d="M3.5 7.5 12 11.8l8.5-4.3M12 11.8v9"/>',
  cosa: '<path d="M12 3.5 14.6 9.4l5.9 2.6-5.9 2.6L12 20.5l-2.6-5.9L3.5 12l5.9-2.6z"/>',
  buscar: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
  parar: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor"/>',
  volumen: '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4M19 6.3a8 8 0 0 1 0 11.4"/>',
  micro: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  atras: '<path d="m15 5-7 7 7 7"/>',
  adelante: '<path d="m9 5 7 7-7 7"/>',
  abajo: '<path d="M5 8.5h14l-7 9z" fill="currentColor"/>',
  mapa: '<path d="m3.5 6 5.5-2 6 2 5.5-2v14l-5.5 2-6-2-5.5 2z"/><path d="M9 4v14M15 6v14"/>',
  bandera: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
  radio: '<rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="8.5" cy="14" r="3"/><path d="M14 12h4M14 15.5h4M6.5 8l10-5"/>',
  musica: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  espalda: '<path d="M7 9a5 5 0 0 1 10 0v11.5H7z"/><path d="M9.5 4.6V3h5v1.6M7 13.5h10M10 13.5v3h4v-3"/>',
  mas3: '<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>',
  codigo: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
  mundo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.4 3.6 8.5s-1 5.9-3.6 8.5c-2.6-2.6-3.6-5.4-3.6-8.5s1-5.9 3.6-8.5z"/>',
  video: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>',
};
function glifo(n, cl) { return `<svg class="gli${cl ? ' ' + cl : ''}" viewBox="0 0 24 24" aria-hidden="true">${GLIFOS[n] || ''}</svg>`; }
// texto de botón de un mod de código: "ico:nombre" muestra la imagen; si no, el texto (sin emojis)
const SIN_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu;
const sinEmoji = (s) => String(s == null ? '' : s).replace(SIN_EMOJI, '').trim();
