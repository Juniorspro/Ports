// El sticker: capas (la foto recortada, textos y emojis) sobre 512×512, con el borde de sticker alrededor de todo.
// Lo que pide WhatsApp: 512×512, fondo transparente, WebP de 100 KB como mucho (animado: 500 KB y 10 s), y un margen
// (16 px) para que no se corte. Cada capa se puede animar (latido, temblor, rebote…): el sticker sale animado.
export const LADO = 512, MARGEN = 16, MAX_BYTES = 100 * 1024, MAX_ANIMADO = 500 * 1024;
export const FUENTES = [
  { id: 'LuckiestGuy', nombre: 'Luckiest Guy' }, { id: 'Bangers', nombre: 'Bangers' }, { id: 'Anton', nombre: 'Anton' },
  { id: 'PermanentMarker', nombre: 'Permanent Marker' }, { id: 'Pacifico', nombre: 'Pacifico' }, { id: 'ComicNeue', nombre: 'Comic xD' },
];
export const COLORES = ['#ffffff', '#111111', '#ffd23f', '#ff3e8a', '#3ec7ff', '#4cd964', '#ff7a1a', '#9b5cff', '#ff2d2d', '#ffb21a', '#a8f0ff', '#1f6fff', '#00b37a', '#ff8fc7', '#8b5a2b', '#c0c0c0'];
// (más opciones del texto: grosor del contorno, relleno en degradé, sombra, arco, espaciado; y de cualquier capa: transparencia,
// espejo y, en las fotos, filtros con brillo, contraste y saturación)
export const GROSORES = { fino: 0.12, normal: 0.2, grueso: 0.3 };
export const DEGRADES = { atardecer: ['#ffe14d', '#ff3e8a'], neon: ['#3ec7ff', '#b45cff'], oro: ['#fff3b0', '#ffc93a', '#d97a10'], pasto: ['#d4ff6a', '#1fa35b'],
  fuego: ['#ffe14d', '#ff2d2d'], hielo: ['#ffffff', '#5ec8ff'], arcoiris: ['#ff3e8a', '#ffb21a', '#ffe14d', '#4cd964', '#3ec7ff', '#9b5cff'] };
export const FILTROS = { normal: '', bn: 'grayscale(1)', sepia: 'sepia(.85)', vintage: 'sepia(.35) contrast(1.1) saturate(.85) brightness(1.05)',
  frio: 'hue-rotate(-10deg) saturate(1.15) brightness(1.03)', calido: 'sepia(.22) saturate(1.35) hue-rotate(-6deg)', vivido: 'saturate(1.65) contrast(1.15)', fantasma: 'grayscale(.6) brightness(1.25) contrast(.85)' };
export const filtroCss = (f) => !f ? '' : [FILTROS[f.preset] || '', f.b && f.b !== 1 ? `brightness(${f.b})` : '', f.c && f.c !== 1 ? `contrast(${f.c})` : '', f.s !== undefined && f.s !== 1 ? `saturate(${f.s})` : ''].filter(Boolean).join(' ');
const ARCO = 3.2;   // (radio del arco, en tamaños de letra)
// ---- formas: para recortar una foto (Forma) y para las figuras de fondo (Fondo); centradas en 0,0, de w×h ----
export const FORMAS = [['circulo', 'Círculo'], ['redondeado', 'Redondeado'], ['corazon', 'Corazón'], ['estrella', 'Estrella'], ['nube', 'Nube'],
  ['explosion', 'Explosión'], ['hexagono', 'Hexágono'], ['gota', 'Gota'], ['globo', 'Globo']];
export function formaCamino(g, k, w, h) {
  const W = w / 2, H = h / 2, P = (x, y) => [x * W, y * H], mv = (x, y) => g.moveTo(...P(x, y)), ln = (x, y) => g.lineTo(...P(x, y));
  const bz = (a, b, c, d, e, f) => g.bezierCurveTo(...P(a, b), ...P(c, d), ...P(e, f));
  const redondo = (x0, y0, x1, y1, r) => { const rx = r / W, ry = r / H; mv(x0 + rx, y0); ln(x1 - rx, y0); bz(x1 - rx * 0.45, y0, x1, y0 + ry * 0.45, x1, y0 + ry); ln(x1, y1 - ry); bz(x1, y1 - ry * 0.45, x1 - rx * 0.45, y1, x1 - rx, y1);
    ln(x0 + rx, y1); bz(x0 + rx * 0.45, y1, x0, y1 - ry * 0.45, x0, y1 - ry); ln(x0, y0 + ry); bz(x0, y0 + ry * 0.45, x0 + rx * 0.45, y0, x0 + rx, y0); };
  const puntas = (n, adentro, giro = -Math.PI / 2, mueca = 0) => { for (let i = 0; i < n * 2; i++) { const a = giro + (i * Math.PI) / n, r = i % 2 ? adentro + mueca * Math.sin(i * 2.3) : 1; (i ? ln : mv)(Math.cos(a) * r, Math.sin(a) * r); } };
  g.beginPath();
  if (k === 'circulo') g.ellipse(0, 0, W, H, 0, 0, TAU);
  else if (k === 'redondeado') redondo(-1, -1, 1, 1, Math.min(W, H) * 0.3);
  else if (k === 'corazon') { mv(0, 0.95); bz(-0.2, 0.78, -1, 0.3, -1, -0.32); bz(-1, -0.84, -0.42, -1.08, 0, -0.56); bz(0.42, -1.08, 1, -0.84, 1, -0.32); bz(1, 0.3, 0.2, 0.78, 0, 0.95); }
  else if (k === 'estrella') puntas(5, 0.46);
  else if (k === 'explosion') puntas(12, 0.64, -Math.PI / 2, 0.06);
  else if (k === 'hexagono') { for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; (i ? ln : mv)(Math.cos(a), Math.sin(a)); } }
  else if (k === 'gota') { mv(0, -1); bz(0.2, -0.62, 0.86, -0.12, 0.86, 0.36); bz(0.86, 0.75, 0.46, 1, 0, 1); bz(-0.46, 1, -0.86, 0.75, -0.86, 0.36); bz(-0.86, -0.12, -0.2, -0.62, 0, -1); }
  else if (k === 'nube') { for (const [x, y, rx, ry] of [[-0.5, 0.18, 0.5, 0.46], [0.08, -0.22, 0.56, 0.6], [0.56, 0.16, 0.44, 0.42], [0.02, 0.4, 0.7, 0.42]]) { const [cx, cy] = P(x, y); g.moveTo(cx + rx * W, cy); g.ellipse(cx, cy, rx * W, ry * H, 0, 0, TAU); } }
  else if (k === 'globo') { redondo(-1, -1, 1, 0.62, Math.min(W, H) * 0.34); mv(-0.5, 0.5); ln(-0.62, 1); ln(-0.12, 0.6); }
  else g.rect(-W, -H, w, h);
  g.closePath();
}
// ---- las «más letras» (web/fuentes_extra.json): se bajan del servidor recién cuando se eligen y quedan guardadas en el celu ----
let EXTRA = null, BASE_FUENTES = '';
const cargadas = new Map();
export function servidorFuentes(url) { BASE_FUENTES = url; fuentesExtra(); }
/** {muestras, cols, w, h, fuentes: [{id, nombre, cat, archivo, n, licencia}]} */
export async function fuentesExtra() {
  if (EXTRA) return EXTRA;
  try { const d = await (await fetch('./fuentes_extra.json')).json(); if (Array.isArray(d.fuentes)) EXTRA = d; } catch (e) { /* se reintenta la próxima */ }
  return EXTRA || { fuentes: [] };
}
export const nombreFuente = (id) => ((FUENTES.find((f) => f.id === id) || ((EXTRA && EXTRA.fuentes) || []).find((f) => f.id === id) || {}).nombre || id);
export function cargarFuente(id) {
  if (!id || FUENTES.some((f) => f.id === id)) return Promise.resolve(true);
  if (cargadas.has(id)) return cargadas.get(id);
  const p = (async () => {
    const f = (await fuentesExtra()).fuentes.find((x) => x.id === id); if (!f || !BASE_FUENTES) return false;
    const url = BASE_FUENTES + f.archivo; let datos = null;
    try {
      const cache = await caches.open('sz-fuentes'); let r = await cache.match(url);
      if (!r) { r = await fetch(url); if (!r.ok) throw new Error('no'); await cache.put(url, r.clone()); }
      datos = await r.arrayBuffer();
    } catch (e) { try { const r = await fetch(url); if (r.ok) datos = await r.arrayBuffer(); } catch (er) { /* sin conexión */ } }
    if (!datos) return false;
    const ff = new FontFace(id, datos); await ff.load(); document.fonts.add(ff); return true;
  })().catch(() => false);
  cargadas.set(id, p); p.then((ok) => { if (!ok) cargadas.delete(id); });
  return p;
}
/** antes de dibujar un sticker guardado: que estén sus letras */
export const cargarFuentesDe = (capas) => Promise.all((capas || []).filter((c) => c.tipo === 'texto').map((c) => cargarFuente(c.fuente)));
export async function cargarFuentes(base) {
  await Promise.all(FUENTES.map(async (f) => { try { const ff = new FontFace(f.id, `url(${base}fuentes/${f.id}.ttf)`); await ff.load(); document.fonts.add(ff); } catch (e) { /* sin esa fuente: la del sistema */ } }));
}
export const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

// ---- animaciones: t va de 0 a 1 (una vuelta); en t = 0 la capa está quieta (así el primer cuadro es el sticker normal)
const TAU = Math.PI * 2, campana = (t, c, a) => Math.exp(-(((t - c) / a) ** 2));
export const ANIMACIONES = [
  { id: 'latido', nombre: 'Latido', ico: 'aLatido', dur: 1.2, f: (t) => ({ s: 1 + 0.13 * campana(t, 0.18, 0.05) + 0.09 * campana(t, 0.38, 0.05) }) },
  { id: 'temblor', nombre: 'Temblor', ico: 'aTemblor', dur: 1.2, f: (t) => ({ dx: 5 * Math.sin(TAU * 5 * t) + 2.5 * Math.sin(TAU * 9 * t), dy: 4 * Math.sin(TAU * 7 * t), rot: 0.05 * Math.sin(TAU * 6 * t) }) },
  { id: 'rebote', nombre: 'Rebote', ico: 'aRebote', dur: 1.2, f: (t) => { const h = Math.abs(Math.sin(TAU * t)), apl = Math.max(0, 1 - h * 6); return { dy: -42 * h, sx: 1 + 0.09 * apl, sy: 1 - 0.09 * apl, base: true }; } },
  { id: 'giro', nombre: 'Giro', ico: 'aGiro', dur: 2.4, f: (t) => ({ rot: TAU * t }) },
  { id: 'flotar', nombre: 'Flotar', ico: 'aFlotar', dur: 2.4, f: (t) => ({ dy: -12 * Math.sin(TAU * t), rot: 0.06 * Math.sin(TAU * t + 0.8) }) },
  { id: 'bamboleo', nombre: 'Bamboleo', ico: 'aBamboleo', dur: 1.2, f: (t) => ({ rot: 0.22 * Math.sin(TAU * t), pivote: true }) },
  { id: 'pum', nombre: 'Pum', ico: 'aPum', dur: 1.2, f: (t) => ({ s: 1 + 0.32 * campana(t, 0.55, 0.06), rot: 0.06 * Math.sin(TAU * 4 * t) * campana(t, 0.55, 0.1) }) },
  { id: 'aparecer', nombre: 'Escribir', ico: 'aEscribir', dur: 2.4, soloTexto: true, f: (t) => ({ letras: t < 0.3 ? 1 : t < 0.36 ? 0 : t < 0.86 ? (t - 0.36) / 0.5 : 1 }) },
  { id: 'parpadeo', nombre: 'Parpadeo', ico: 'aParpadeo', dur: 1.2, f: (t) => ({ alfa: t > 0.5 && t < 0.62 ? 0.12 : 1 }) },
  { id: 'arcoiris', nombre: 'Arcoíris', ico: 'aArcoiris', dur: 2.4, f: (t) => ({ tono: 360 * t }) },
];
export const ANIM = Object.fromEntries(ANIMACIONES.map((a) => [a.id, a]));

// la foto recortada → un lienzo del tamaño de lo que quedó (con la máscara como transparencia)
export function recortarImagen(img, mascara, mw, mh) {
  const c = lienzo(mw, mh), g = c.getContext('2d'); g.drawImage(img, 0, 0, mw, mh);
  const d = g.getImageData(0, 0, mw, mh); let x0 = mw, y0 = mh, x1 = -1, y1 = -1;
  for (let y = 0, i = 0; y < mh; y++) for (let x = 0; x < mw; x++, i++) { const a = mascara ? mascara[i] : 255; d.data[i * 4 + 3] = a; if (a > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  g.putImageData(d, 0, 0);
  if (x1 < 0) return null;
  const out = lienzo(x1 - x0 + 1, y1 - y0 + 1); out.getContext('2d').drawImage(c, -x0, -y0);
  out.origen = { x: x0, y: y0 }; // (dónde estaba en la foto: para el cabezón)
  return out;
}

// el globo de diálogo detrás de un texto (w × h del texto, en coordenadas de la capa)
function globo(g, w, h) {
  const pw = w / 2 + 26, ph = h / 2 + 14, r = Math.min(ph, 46);
  g.beginPath(); g.moveTo(-pw + r, -ph); g.arcTo(pw, -ph, pw, ph, r); g.arcTo(pw, ph, -pw, ph, r);
  g.lineTo(-pw * 0.18, ph); g.lineTo(-pw * 0.42, ph + 34); g.lineTo(-pw * 0.42 - 2, ph); // (la colita)
  g.arcTo(-pw, ph, -pw, -ph, r); g.arcTo(-pw, -ph, pw, -ph, r); g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#111111'; g.lineJoin = 'round'; g.stroke();
}

// el fileteado (dibujo nuestro, al estilo del filete porteño): a cada lado del texto, una voluta que sale y se enrosca,
// con su hoja y su flor; colores de filete (rojo, verde, dorado, celeste) con contorno negro y un brillo blanco
const ROJO_F = '#e8352b', VERDE_F = '#2f9e4a', CELESTE_F = '#3aa8e0';
function voluta(g, x0, h, k, col) {
  // (k: tamaño; la espiral se enrosca hacia arriba, afuera del texto)
  const R0 = 38 * k, cx = x0 + 54 * k, cy = -12 * k, pts = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60, th = Math.PI * (0.95 + 2.3 * t), r = R0 * (1 - 0.78 * t); pts.push([cx + Math.cos(th) * r, cy + Math.sin(th) * r]); }
  const camino = () => { g.beginPath(); g.moveTo(x0, h * 0.18); g.quadraticCurveTo(x0 + 8 * k, cy + R0 * 0.2, pts[0][0], pts[0][1]); for (const [x, y] of pts) g.lineTo(x, y); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  camino(); g.strokeStyle = '#111'; g.lineWidth = 19 * k; g.stroke();
  camino(); g.strokeStyle = col; g.lineWidth = 12 * k; g.stroke();
  camino(); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2.8 * k; g.stroke();
  // la hoja (de acanto, simplificada) y la flor
  g.save(); g.translate(x0 + 20 * k, h * 0.22 + 4 * k); g.rotate(0.45); g.scale(1.45, 1.45);
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(14 * k, -16 * k, 34 * k, -8 * k, 40 * k, 6 * k); g.bezierCurveTo(26 * k, 2 * k, 12 * k, 10 * k, 0, 0); g.closePath();
  g.fillStyle = VERDE_F; g.fill(); g.lineWidth = 3.5 * k; g.strokeStyle = '#111'; g.stroke();
  g.beginPath(); g.moveTo(4 * k, 1 * k); g.quadraticCurveTo(20 * k, -4 * k, 36 * k, 4 * k); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.6 * k; g.stroke(); g.restore();
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * 8.5 * k, cy + Math.sin(a) * 8.5 * k, 6 * k, 0, Math.PI * 2); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 2 * k; g.strokeStyle = '#111'; g.stroke(); }
  g.beginPath(); g.arc(cx, cy, 4.5 * k, 0, Math.PI * 2); g.fillStyle = ROJO_F; g.fill();
}
const ORN = 118; // (lo que agrega el fileteado a cada lado, en tamaño 96)
// arriba, una flor de filete; abajo, una guarda que ondula (así el cartel no queda tan finito)
function guarda(g, w, y, k) {
  const camino = () => { g.beginPath(); g.moveTo(-w / 2, y); const n = 4, p = w / n; for (let i = 0; i < n; i++) g.quadraticCurveTo(-w / 2 + p * (i + 0.5), y + (i % 2 ? -14 : 14) * k, -w / 2 + p * (i + 1), y); };
  g.lineCap = 'round'; camino(); g.strokeStyle = '#111'; g.lineWidth = 17 * k; g.stroke(); camino(); g.strokeStyle = CELESTE_F; g.lineWidth = 10 * k; g.stroke(); camino(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.8 * k; g.stroke();
  for (const sx of [-1, 1]) { g.beginPath(); g.arc((sx * w) / 2, y, 9 * k, 0, Math.PI * 2); g.fillStyle = ROJO_F; g.fill(); g.lineWidth = 3 * k; g.strokeStyle = '#111'; g.stroke(); }
}
function flor(g, y, k) {
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.save(); g.translate(0, y); g.rotate(a); g.beginPath(); g.ellipse(0, -14 * k, 8 * k, 13 * k, 0, 0, Math.PI * 2); g.fillStyle = i % 2 ? ROJO_F : '#ffd23f'; g.fill(); g.lineWidth = 3 * k; g.strokeStyle = '#111'; g.stroke(); g.restore(); }
  g.beginPath(); g.arc(0, y, 8 * k, 0, Math.PI * 2); g.fillStyle = VERDE_F; g.fill(); g.lineWidth = 3 * k; g.strokeStyle = '#111'; g.stroke();
}

// ---- Movimiento: cómo se pasa de un punto clave al otro ----
export const SUAVES = [['suave', 'Suave'], ['lineal', 'Parejo'], ['rebote', 'Rebote'], ['golpe', 'De golpe']];
const soloPose = (f) => ({ x: f.x, y: f.y, esc: f.esc, rot: f.rot, alfa: f.alfa === undefined ? 1 : f.alfa });
function suavizar(u, k) {
  u = Math.max(0, Math.min(1, u));
  if (k === 'lineal') return u;
  if (k === 'golpe') return u < 1 ? 0 : 1;
  if (k === 'rebote') { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2; }
  return u * u * (3 - 2 * u);
}
// ---- efectos de video: a todo el sticker (con el borde), cuadro por cuadro; reciben el dibujo y t (0 a 1) ----
const nuevo = () => { const c = lienzo(LADO, LADO); return [c, c.getContext('2d')]; };
const alCentro = (g, f) => { g.translate(LADO / 2, LADO / 2); f(); g.translate(-LADO / 2, -LADO / 2); };
function canal(src, col) {
  const [c, g] = nuevo(); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, LADO, LADO);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0); return c;
}
const azar = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const EFECTOS_VIDEO = [
  { id: 'temblor', nombre: 'Temblor', ico: 'aTemblor', dur: 0.8, f: (s, t) => { const [c, g] = nuevo(); alCentro(g, () => { g.rotate(0.04 * Math.sin(TAU * 7 * t)); g.translate(7 * Math.sin(TAU * 9 * t), 5 * Math.sin(TAU * 11 * t)); }); g.drawImage(s, 0, 0); return c; } },
  { id: 'latidoV', nombre: 'Latido', ico: 'aLatido', dur: 1.0, f: (s, t) => { const [c, g] = nuevo(), k = 1 + 0.1 * campana(t, 0.2, 0.06) + 0.07 * campana(t, 0.42, 0.06); alCentro(g, () => g.scale(k, k)); g.drawImage(s, 0, 0); return c; } },
  { id: 'arcoiris', nombre: 'Arcoíris', ico: 'aArcoiris', dur: 1.6, f: (s, t) => { const [c, g] = nuevo(); g.filter = `hue-rotate(${Math.round(360 * t)}deg) saturate(1.4)`; g.drawImage(s, 0, 0); return c; } },
  { id: 'giro', nombre: 'Giro', ico: 'vGiro', dur: 1.6, f: (s, t) => { const [c, g] = nuevo(); alCentro(g, () => { g.rotate(TAU * t); const k = 0.82; g.scale(k, k); }); g.drawImage(s, 0, 0); return c; } },
  { id: 'zoom', nombre: 'Zoom', ico: 'vZoom', dur: 1.2, premium: true, f: (s, t) => { const [c, g] = nuevo(), k = 0.86 + 0.2 * campana(t, 0.5, 0.12); alCentro(g, () => g.scale(k, k)); g.drawImage(s, 0, 0); return c; } },
  { id: 'gelatina', nombre: 'Gelatina', ico: 'vGelatina', dur: 1.0, premium: true, f: (s, t) => { const [c, g] = nuevo(), a = 0.07 * Math.sin(TAU * 2 * t) * (1 - t * 0.5); g.translate(LADO / 2, LADO * 0.9); g.scale(1 + a, 1 - a); g.translate(-LADO / 2, -LADO * 0.9); g.drawImage(s, 0, 0); return c; } },
  { id: 'brillo', nombre: 'Brillo', ico: 'chispa', dur: 1.4, premium: true, f: (s, t) => {
    const [c, g] = nuevo(); g.drawImage(s, 0, 0); const x = -LADO + 3 * LADO * Math.min(1, t / 0.7);
    const gr = g.createLinearGradient(x - 90, x - 160, x + 90, x + 20); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, LADO, LADO); return c; } },
  { id: 'parpadeo', nombre: 'Flash', ico: 'rayo', dur: 1.0, premium: true, f: (s, t) => { const [c, g] = nuevo(); g.drawImage(s, 0, 0); const a = Math.max(campana(t, 0.1, 0.03), campana(t, 0.26, 0.03)); if (a > 0.02) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(255,255,255,${0.85 * a})`; g.fillRect(0, 0, LADO, LADO); } return c; } },
  { id: 'glitch', nombre: 'Glitch', ico: 'vGlitch', dur: 1.2, premium: true, f: (s, t) => {
    const [c, g] = nuevo(), cuadro = Math.floor(t * 14), fuerte = azar(cuadro) > 0.45, d = fuerte ? 6 + 10 * azar(cuadro + 7) : 2;
    g.globalCompositeOperation = 'lighter'; g.drawImage(canal(s, '#ff0000'), -d, 0); g.drawImage(canal(s, '#00ff00'), 0, 0); g.drawImage(canal(s, '#0000ff'), d, 0);
    if (fuerte) { g.globalCompositeOperation = 'source-over'; for (let k = 0; k < 4; k++) { const y = Math.floor(azar(cuadro * 3 + k) * LADO), hh = 6 + Math.floor(azar(cuadro * 5 + k) * 26), dx = (azar(cuadro * 7 + k) - 0.5) * 60; const [f, fg] = nuevo(); fg.drawImage(c, 0, y, LADO, hh, 0, 0, LADO, hh); g.clearRect(0, y, LADO, hh); g.drawImage(f, 0, 0, LADO, hh, dx, y, LADO, hh); } }
    return c; } },
  { id: 'vhs', nombre: 'VHS', ico: 'vVhs', dur: 1.2, premium: true, f: (s, t) => {
    const [c, g] = nuevo(), cuadro = Math.floor(t * 12), j = (azar(cuadro) - 0.5) * 3;
    g.globalCompositeOperation = 'lighter'; g.drawImage(canal(s, '#ff0000'), -3 + j, 0); g.drawImage(canal(s, '#00ff00'), j, 0); g.drawImage(canal(s, '#0000ff'), 3 + j, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = (cuadro % 2); y < LADO; y += 4) g.fillRect(0, y, LADO, 1.5);
    const by = ((t * 1.6) % 1) * LADO; g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, by, LADO, 18); return c; } },
  { id: 'neonV', nombre: 'Neón vivo', ico: 'neon', dur: 1.6, premium: true, f: (s, t) => {
    const [c, g] = nuevo(), col = `hsl(${Math.round(360 * t)}, 100%, 60%)`; g.save(); g.shadowColor = col; g.shadowOffsetX = LADO * 2;
    for (const r of [8, 18 + 10 * Math.sin(TAU * t)]) { g.shadowBlur = r; g.drawImage(s, -LADO * 2, 0); } g.restore(); g.drawImage(s, 0, 0); return c; } },
];
export const EFECTOS_VIDEO_K = Object.fromEntries(EFECTOS_VIDEO.map((e) => [e.id, e]));

export class Sticker {
  constructor() { this.capas = []; this.borde = 12; this.colorBorde = '#ffffff'; this.sombra = true; this.sel = -1; }
  // ---- capas ----
  agregarImagen(src) {
    // (con lugar para el borde y la sombra, que cae 4 px para abajo)
    const lugar = LADO - 2 * (MARGEN + this.borde + 4), esc = Math.min(lugar / src.width, lugar / src.height);
    this.capas.push({ tipo: 'img', src, x: LADO / 2, y: LADO / 2, esc, rot: 0 }); this.sel = this.capas.length - 1; return this.capas[this.sel];
  }
  agregarTexto(o) {
    const c = { tipo: 'texto', texto: o.texto || 'Texto', fuente: o.fuente || 'LuckiestGuy', color: o.color || '#ffffff', contorno: o.contorno === undefined ? '#111111' : o.contorno, globo: !!o.globo, filete: !!o.filete, tam: 96, x: LADO / 2, y: LADO / 2, esc: 1, rot: 0 };
    if (c.globo) { c.color = '#111111'; c.contorno = ''; c.filete = false; }
    this.ajustarTexto(c, !this.capas.length);
    this.capas.push(c); this.sel = this.capas.length - 1; return c;
  }
  // que entre a lo ancho; si ya hay algo, abajo (el globo, arriba), apoyado adentro del margen
  ajustarTexto(c, centrado) {
    const m = this.medidas(c), maxW = LADO - 2 * (MARGEN + this.borde) - 8; c.esc = Math.min(1, maxW / m.w);
    if (centrado) return;
    const alto = (m.h * c.esc) / 2;
    c.y = c.globo ? MARGEN + this.borde + 6 + alto : LADO - MARGEN - this.borde - 6 - alto;
  }
  agregarEmoji(ch) { this.capas.push({ tipo: 'emoji', ch, tam: 140, x: LADO - 120, y: 130, esc: 1, rot: -0.15 }); this.sel = this.capas.length - 1; return this.capas[this.sel]; }
  borrarSel() { if (this.sel >= 0) { this.capas.splice(this.sel, 1); this.sel = -1; } }
  alFrente() { if (this.sel >= 0) { const c = this.capas.splice(this.sel, 1)[0]; this.capas.push(c); this.sel = this.capas.length - 1; } }
  // tamaño de la capa sin su escala ni giro (con el globo, si tiene)
  medidas(c) {
    if (c.tipo === 'img') return { w: c.src.width, h: c.src.height };
    if (c.tipo === 'figura') return { w: c.w, h: c.h };
    const g = Sticker._g || (Sticker._g = lienzo(4, 4).getContext('2d'));
    const fuente = c.tipo === 'emoji' ? `${c.tam}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif` : `${c.tam}px "${c.fuente}", sans-serif`;
    g.font = fuente; const lineas = c.tipo === 'emoji' ? [c.ch] : String(c.texto).split('\n');
    if ('letterSpacing' in g) g.letterSpacing = c.tipo === 'texto' && c.espaciado ? `${c.espaciado * c.tam}px` : '0px';
    let w = Math.max(...lineas.map((l) => g.measureText(l).width)) + (c.tipo === 'texto' ? c.tam * 0.3 : 0), h = lineas.length * c.tam * 1.08 + c.tam * 0.18;
    // (en arco: un poco más alto, lo que baja la punta)
    if (c.tipo === 'texto' && c.curva && lineas.length === 1 && !c.globo && !c.filete) { const R = c.tam * ARCO, th = Math.min(Math.PI * 1.2, (w - c.tam * 0.3) / R); h += R * (1 - Math.cos(th / 2)); }
    if (c.tipo === 'texto' && c.sombraT === 'dura') { w += c.tam * 0.06; h += c.tam * 0.08; }
    if (c.globo) { w += 52 + 6; h += 28 + 34 + 6; }
    const tw = w; if (c.filete) { w += 2 * ORN * (c.tam / 96); h += 24 * (c.tam / 96) + 2 * 40 * (c.tam / 96); }
    return { w, h, fuente, lineas, tw };
  }
  // ---- animación ----
  // (Movimiento: los puntos clave —keyframes— de una capa; con dos o más, la capa va de uno al otro en kfDur segundos.
  // Efectos de video: a todo el sticker, encima del borde)
  hayKf() { return this.capas.some((c) => c.kf && c.kf.length > 1 && !c.oculto); }
  animado() { return this.capas.some((c) => c.anim && ANIM[c.anim]) || this.hayKf() || !!(this.efecto && EFECTOS_VIDEO_K[this.efecto]); }
  duracion() {
    if (this.hayKf()) return this.kfDur || 2;
    return Math.max(1.2, ...this.capas.filter((c) => c.anim && ANIM[c.anim]).map((c) => ANIM[c.anim].dur), this.efecto && EFECTOS_VIDEO_K[this.efecto] ? EFECTOS_VIDEO_K[this.efecto].dur : 0);
  }
  // dónde está la capa en el momento t (0 a 1 de la duración): con puntos clave, entre el de antes y el de después
  pose(c, t = 0) {
    const L = c.kf, b = { x: c.x, y: c.y, esc: c.esc, rot: c.rot, alfa: c.alfa === undefined ? 1 : c.alfa };
    if (!L || !L.length) return b;
    if (L.length === 1 || t <= L[0].t) return { ...b, ...soloPose(L[0]) };
    const z = L[L.length - 1]; if (t >= z.t) return { ...b, ...soloPose(z) };
    let i = 0; while (i < L.length - 2 && L[i + 1].t < t) i++;
    const a = L[i], d = L[i + 1], u = suavizar((t - a.t) / Math.max(1e-6, d.t - a.t), d.ease);
    const mezcla = (k) => a[k] + (d[k] - a[k]) * u;
    return { x: mezcla('x'), y: mezcla('y'), esc: mezcla('esc'), rot: mezcla('rot'), alfa: mezcla('alfa') };
  }
  mov(c, t) {
    const a = c.anim && ANIM[c.anim]; if (!a) return null;
    const vueltas = Math.max(1, Math.round(this.duracion() / a.dur)); return a.f((t * vueltas) % 1);
  }
  dibujarCapa(g, c, t = 0) {
    if (c.oculto) return;
    if (c.kf && c.kf.length) c = { ...c, ...this.pose(c, t) };
    const m = this.mov(c, t) || {}, md = this.medidas(c);
    g.save(); g.translate(c.x + (m.dx || 0), c.y + (m.dy || 0)); g.rotate(c.rot);
    // (el bamboleo gira desde abajo, como un muñeco; el rebote se aplasta contra el piso)
    const piso = (md.h * c.esc) / 2;
    if (m.pivote || m.base) g.translate(0, piso);
    g.rotate(m.rot || 0);
    const s = m.s || 1; g.scale(c.esc * s * (m.sx || 1), c.esc * s * (m.sy || 1));
    if (m.pivote || m.base) g.translate(0, -piso / c.esc);
    if (c.espejo) g.scale(-1, 1);
    g.globalAlpha = (m.alfa === undefined ? 1 : m.alfa) * (c.alfa === undefined ? 1 : c.alfa);
    const filtro = [c.tipo === 'img' ? filtroCss(c.filtro) : '', m.tono && c.tipo !== 'texto' ? `hue-rotate(${m.tono}deg) saturate(1.4)` : ''].filter(Boolean).join(' ');
    if (filtro) g.filter = filtro;
    if (c.tipo === 'img') {
      const w = c.src.width, hh = c.src.height;
      if (c.forma) { g.save(); formaCamino(g, c.forma, w, hh); g.clip(); g.drawImage(c.src, -w / 2, -hh / 2); g.restore(); } else g.drawImage(c.src, -w / 2, -hh / 2);
    } else if (c.tipo === 'figura') {
      // (una figura de fondo: círculo, estrella, explosión…, lisa o en degradé, con su trazo si tiene)
      formaCamino(g, c.fig, c.w, c.h); let col = c.color;
      if (c.degrade && DEGRADES[c.degrade]) { const st = DEGRADES[c.degrade], gr = g.createLinearGradient(0, -c.h / 2, 0, c.h / 2); st.forEach((x, k) => gr.addColorStop(k / (st.length - 1), x)); col = gr; }
      g.fillStyle = col; g.fill(); if (c.trazo) { g.lineJoin = 'round'; g.lineWidth = Math.min(c.w, c.h) * 0.045; g.strokeStyle = c.trazo; g.stroke(); }
    } else {
      g.font = md.fuente; g.textAlign = 'center'; g.textBaseline = 'middle';
      const alto = c.tam * 1.08, y0 = -((md.lineas.length - 1) * alto) / 2 - (c.globo ? 17 : 0);
      if (c.globo) { g.save(); g.translate(0, -17); globo(g, md.w - 58, md.h - 68); g.restore(); }
      if (c.filete) {
        // (las volutas, una de cada lado; los colores van cambiando según el texto)
        const k = c.tam / 96, x0 = md.tw / 2 - 4 * k, hh = md.h - 24 * k - 80 * k, n = [...String(c.texto)].length, alto2 = (md.lineas.length * c.tam * 1.08) / 2;
        g.save(); voluta(g, x0, hh, k, [ROJO_F, CELESTE_F, VERDE_F][n % 3]); g.scale(-1, 1); voluta(g, x0, hh, k, [CELESTE_F, ROJO_F, VERDE_F][n % 3]); g.restore();
        flor(g, -alto2 - 16 * k, k); guarda(g, md.tw * 0.86, alto2 + 14 * k, k);
      }
      let color = c.tipo === 'texto' && m.tono ? `hsl(${m.tono}, 95%, 60%)` : c.color;
      if (c.filete && !m.tono) { const gr = g.createLinearGradient(0, -c.tam * 0.5, 0, c.tam * 0.5); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.45, '#ffc93a'); gr.addColorStop(1, '#d97a10'); color = gr; }
      else if (c.tipo === 'texto' && c.degrade && DEGRADES[c.degrade] && !m.tono) {
        const st = DEGRADES[c.degrade], arriba = y0 - c.tam * 0.5, abajo = y0 + (md.lineas.length - 1) * alto + c.tam * 0.5;
        const gr = g.createLinearGradient(0, arriba, 0, abajo); st.forEach((col, k) => gr.addColorStop(k / (st.length - 1), col)); color = gr;
      }
      const texto = c.tipo === 'texto', grosor = c.filete ? 0.24 : GROSORES[c.grosor] || GROSORES.normal, esp = texto && c.espaciado ? c.espaciado * c.tam : 0;
      if ('letterSpacing' in g) g.letterSpacing = `${esp}px`;
      // (una tira de letras en x, y: contorno, relleno y el brillo del filete; «sombra 3D»: la misma tira, oscura y corrida)
      const pintar = (ver, x, y, oscuro) => {
        if (texto && (c.contorno || c.filete || oscuro)) { g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = c.tam * grosor; g.strokeStyle = oscuro ? 'rgba(0,0,0,0.55)' : c.filete ? '#3b0d0a' : c.contorno; if (c.contorno || c.filete) g.strokeText(ver, x, y); }
        g.fillStyle = oscuro ? 'rgba(0,0,0,0.55)' : texto ? color : '#000'; g.fillText(ver, x, y);
        if (c.filete && !oscuro) { g.save(); g.globalCompositeOperation = 'source-atop'; g.lineWidth = c.tam * 0.03; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.strokeText(ver, x - c.tam * 0.02, y - c.tam * 0.035); g.restore(); }
      };
      const curvo = texto && c.curva && md.lineas.length === 1 && !c.globo && !c.filete;
      const tira = (ver, l, i, oscuro) => {
        if (!curvo) { const x = ver.length < l.length ? -g.measureText(l).width / 2 + g.measureText(ver).width / 2 : 0; return pintar(ver, x, y0 + i * alto, oscuro); }
        // (en arco: letra por letra sobre un círculo; para arriba ∩ o para abajo ∪)
        const R = c.tam * ARCO, sg = c.curva > 0 ? 1 : -1, ch = [...l];
        if ('letterSpacing' in g) g.letterSpacing = '0px';
        const anchos = ch.map((x) => g.measureText(x).width + esp), total = anchos.reduce((a, b2) => a + b2, 0) - esp, th = Math.min(Math.PI * 1.2, total / R), sag = R * (1 - Math.cos(th / 2));
        let acc = 0; const n = [...ver].length;
        ch.forEach((x, k) => {
          const a = -th / 2 + ((acc + anchos[k] / 2) / total) * th; acc += anchos[k];
          if (k >= n) return;
          g.save(); g.translate(R * Math.sin(a), y0 + sg * (R * (1 - Math.cos(a)) - sag / 2)); g.rotate(sg * a); pintar(x, 0, 0, oscuro); g.restore();
        });
        if ('letterSpacing' in g) g.letterSpacing = `${esp}px`;
      };
      const renglones = (oscuro) => {
        let q = m.letras === undefined ? Infinity : Math.round(m.letras * md.lineas.reduce((n, l) => n + [...l].length, 0));
        md.lineas.forEach((l, i) => { const ch = [...l], ver = ch.slice(0, Math.max(0, q)).join(''); q -= ch.length; if (ver) tira(ver, l, i, oscuro); });
      };
      if (texto && c.sombraT === 'dura') { g.save(); g.translate(c.tam * 0.06, c.tam * 0.08); renglones(true); g.restore(); }
      if (texto && c.sombraT === 'suave') {
        // (la sombra no sigue la escala del lienzo: se calcula con la escala de este momento; y se pinta de nuevo encima, así
        // la sombra del relleno no ensucia el contorno)
        const T = g.getTransform(), k = Math.hypot(T.a, T.b);
        g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = c.tam * 0.16 * k; g.shadowOffsetY = c.tam * 0.07 * k; renglones(false); g.restore();
      }
      renglones(false);
    }
    g.restore();
  }
  // ---- el dibujo entero en el momento t: las capas, y alrededor el borde de sticker (dilatando la silueta) y una sombra ----
  // (rapido: el borde con menos copias —miniaturas y la vista animada en celulares flojos—; lo que se guarda, completo)
  componer(t = 0, rapido = false) {
    const base = lienzo(LADO, LADO), g = base.getContext('2d'); let brillo = null;
    for (const c of this.capas) {
      if (c.oculto) continue;
      // (Neón: el borde de sticker sigue la forma de verdad —el brillo no lo agranda— y el brillo va encima del borde, alrededor)
      if (c.neon) {
        const tmp = lienzo(LADO, LADO); this.dibujarCapa(tmp.getContext('2d'), c, t);
        const b = (brillo ||= lienzo(LADO, LADO)).getContext('2d'); b.save(); b.shadowColor = c.neon; b.shadowOffsetX = LADO * 2;
        for (const r of [10, 22, 40]) { b.shadowBlur = r; b.drawImage(tmp, -LADO * 2, 0); } b.restore();
        g.drawImage(tmp, 0, 0);
      } else this.dibujarCapa(g, c, t);
    }
    if (!this.borde && !this.sombra && !brillo) return this.efectoVideo(base, t);
    const out = lienzo(LADO, LADO), o = out.getContext('2d');
    if (this.borde > 0) {
      const sil = lienzo(LADO, LADO), s = sil.getContext('2d'); s.drawImage(base, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = this.colorBorde; s.fillRect(0, 0, LADO, LADO);
      const ani = lienzo(LADO, LADO), a = ani.getContext('2d'), r = this.borde;
      const anillos = rapido ? [1, 0.5] : [1, 0.66, 0.33], vueltas = rapido ? 12 : 24;
      for (const f of anillos) for (let k = 0; k < vueltas; k++) { const th = (k / vueltas) * TAU; a.drawImage(sil, Math.cos(th) * r * f, Math.sin(th) * r * f); }
      a.drawImage(sil, 0, 0);
      if (this.sombra) { o.save(); o.shadowColor = 'rgba(0,0,0,0.38)'; o.shadowBlur = 10; o.shadowOffsetY = 4; o.drawImage(ani, 0, 0); o.restore(); }
      else o.drawImage(ani, 0, 0);
    } else if (this.sombra) { o.save(); o.shadowColor = 'rgba(0,0,0,0.38)'; o.shadowBlur = 10; o.shadowOffsetY = 4; o.drawImage(base, 0, 0); o.restore(); }
    if (brillo) { o.drawImage(brillo, 0, 0); o.drawImage(brillo, 0, 0); }   // (encima del borde: el color se ve como un tubo de neón alrededor)
    o.drawImage(base, 0, 0);
    return this.efectoVideo(out, t);
  }
  efectoVideo(c, t) {
    const e = this.efecto && EFECTOS_VIDEO_K[this.efecto]; if (!e) return c;
    const vueltas = Math.max(1, Math.round(this.duracion() / e.dur)); return e.f(c, (t * vueltas) % 1);
  }
  // ¿qué capa hay en (x, y)? la de más arriba
  tocada(x, y, t = 0) {
    for (let i = this.capas.length - 1; i >= 0; i--) {
      let c = this.capas[i]; if (c.oculto || c.bloq) continue;
      if (c.kf && c.kf.length) c = { ...c, ...this.pose(c, t) };
      const m = this.medidas(c), dx = x - c.x, dy = y - c.y, cs = Math.cos(-c.rot), sn = Math.sin(-c.rot);
      const lx = (dx * cs - dy * sn) / c.esc, ly = (dx * sn + dy * cs) / c.esc, pad = 18 / c.esc;
      if (Math.abs(lx) <= m.w / 2 + pad && Math.abs(ly) <= m.h / 2 + pad) return i;
    }
    return -1;
  }
  // dónde está lo dibujado (sin el borde), aunque se salga del cuadro, en todo el movimiento: { x0, y0, x1, y1 }
  caja() {
    const k = 0.25, T = LADO * 3, c = lienzo(T * k, T * k), g = c.getContext('2d', { willReadFrequently: true });
    const ts = this.animado() ? Array.from({ length: 12 }, (_, i) => i / 12) : [0];
    g.scale(k, k); g.translate(LADO, LADO); for (const t of ts) for (const capa of this.capas) this.dibujarCapa(g, capa, t);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return null;
    return { x0: x0 / k - LADO, y0: y0 / k - LADO, x1: (x1 + 1) / k - LADO, y1: (y1 + 1) / k - LADO };
  }
  // que entre todo (con el borde, y en todo el movimiento) adentro del margen: achica lo justo y lo corre lo justo
  encajar() {
    const c = this.caja(); if (!c) return false;
    const b = this.borde + 3, lo = MARGEN + b, hi = LADO - MARGEN - b, cw = c.x1 - c.x0, ch = c.y1 - c.y0;
    const s = Math.min(1, (hi - lo) / cw, (hi - lo) / ch), cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    const nx0 = cx - (cw * s) / 2, ny0 = cy - (ch * s) / 2;
    const dx = nx0 < lo ? lo - nx0 : nx0 + cw * s > hi ? hi - (nx0 + cw * s) : 0, dy = ny0 < lo ? lo - ny0 : ny0 + ch * s > hi ? hi - (ny0 + ch * s) : 0;
    for (const capa of this.capas) { capa.x = cx + (capa.x - cx) * s + dx; capa.y = cy + (capa.y - cy) * s + dy; capa.esc *= s; }
    return true;
  }
  // cuánto se sale del lugar seguro (para avisar): 0 si entra todo (si está animado, en todo el movimiento)
  seSale() {
    const ts = this.animado() ? Array.from({ length: 8 }, (_, i) => i / 8) : [0]; let n = 0;
    for (const t of ts) {
      const d = this.componer(t).getContext('2d').getImageData(0, 0, LADO, LADO).data;
      for (let y = 0; y < LADO; y++) for (let x = 0; x < LADO; x++) if ((x < MARGEN - 4 || x >= LADO - MARGEN + 4 || y < MARGEN - 4 || y >= LADO - MARGEN + 4) && d[(y * LADO + x) * 4 + 3] > 40) n++;
    }
    return Math.round(n / ts.length);
  }
  // ---- el proyecto (para volver a editarlo): todo menos las imágenes, que van aparte ----
  aProyecto() {
    const imgs = [], capas = this.capas.map((c) => {
      const { src, src0, xd, ...resto } = c;   // (src0 y xd: la foto sin los efectos xD y cuáles tiene, sólo mientras se edita)
      if (c.tipo === 'img') { let i = imgs.indexOf(src); if (i < 0) { imgs.push(src); i = imgs.length - 1; } return { ...resto, img: i }; }
      return resto;
    });
    return { proyecto: { v: 1, borde: this.borde, colorBorde: this.colorBorde, sombra: this.sombra, efecto: this.efecto || undefined, kfDur: this.kfDur || undefined, capas }, imgs };
  }
  static deProyecto(p, imgs) {
    const s = new Sticker(); s.borde = p.borde; s.colorBorde = p.colorBorde; s.sombra = p.sombra; if (p.efecto) s.efecto = p.efecto; if (p.kfDur) s.kfDur = p.kfDur;
    s.capas = p.capas.filter((c) => c.tipo !== 'img' || imgs[c.img]).map((c) => { const { img, ...resto } = c; const k = c.tipo === 'img' ? { ...resto, src: imgs[img] } : { ...resto }; if (c.filtro) k.filtro = { ...c.filtro }; if (c.kf) k.kf = c.kf.map((f) => ({ ...f })); return k; });
    return s;
  }
}

// ---- exportar ----
export const aBlob = (c, tipo, q) => new Promise((ok) => c.toBlob(ok, tipo, q));

// ---- los efectos «xD»: cada uno devuelve una foto nueva (la de antes no se toca); lo transparente sigue transparente ----
// ojo de pez: agranda lo del medio, como un celu pegado a la cara (k < 1: más fuerte)
export function ojoDePez(c, cx = 0.5, cy = 0.42, r = 0.58, k = 0.42) {
  const w = c.width, h = c.height, src = c.getContext('2d').getImageData(0, 0, w, h).data, o = lienzo(w, h), og = o.getContext('2d'), out = og.createImageData(w, h), d = out.data;
  const x0 = cx * w, y0 = cy * h, R = r * Math.min(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - x0, dy = y - y0, dist = Math.hypot(dx, dy); let sx = x, sy = y;
    if (dist < R) { const f = Math.pow(dist / R + 1e-6, 1 - k); sx = x0 + dx * f; sy = y0 + dy * f; }
    const i = (y * w + x) * 4, j = (Math.min(h - 1, Math.max(0, Math.round(sy))) * w + Math.min(w - 1, Math.max(0, Math.round(sx)))) * 4;
    d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2]; d[i + 3] = src[j + 3];
  }
  og.putImageData(out, 0, 0); return o;
}
// más ancha o más alta
export function deformar(c, fx, fy) { const o = lienzo(c.width * fx, c.height * fy), g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, o.width, o.height); return o; }
// la mitad izquierda, repetida en espejo
export function espejo(c) {
  const o = lienzo(c.width, c.height), g = o.getContext('2d'), m = Math.floor(c.width / 2);
  g.drawImage(c, 0, 0, m, c.height, 0, 0, m, c.height);
  g.save(); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0, m, c.height, 0, 0, m, c.height); g.restore(); return o;
}
// pasar por JPEG feo (y achicar) sin perder lo transparente
async function aplastarCalidad(c, chico, q) {
  const t = lienzo(Math.max(8, c.width * chico), Math.max(8, c.height * chico)), tg = t.getContext('2d'); tg.fillStyle = '#808080'; tg.fillRect(0, 0, t.width, t.height); tg.drawImage(c, 0, 0, t.width, t.height);
  const b = await aBlob(t, 'image/jpeg', q), bmp = await createImageBitmap(b), o = lienzo(c.width, c.height), g = o.getContext('2d');
  g.imageSmoothingEnabled = chico > 0.3; g.drawImage(bmp, 0, 0, o.width, o.height);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(c, 0, 0); return o;
}
// quemada: colores pasados, contraste y calidad de JPEG feo
export async function quemar(c) {
  const t = lienzo(c.width, c.height), g = t.getContext('2d'); g.filter = 'saturate(2.4) contrast(1.45) brightness(1.05)'; g.drawImage(c, 0, 0); g.filter = 'none';
  return aplastarCalidad(t, 0.6, 0.12);
}
// trucha: como una foto reenviada mil veces
export function trucha(c) { return aplastarCalidad(c, 0.2, 0.3); }
// los anteojos negros pixelados de los memes (dibujados acá): una capa más, para mover y poner donde quieras
export function lentesXD() {
  const p = 24, o = lienzo(14 * p, 3 * p), g = o.getContext('2d'); g.fillStyle = '#000';
  const negros = [...Array(14).keys()].map((i) => [i, 0]).concat([1, 2, 3, 4, 5, 8, 9, 10, 11, 12].map((i) => [i, 1]), [2, 3, 4, 9, 10, 11].map((i) => [i, 2]));
  for (const [i, j] of negros) g.fillRect(i * p, j * p, p, p);
  g.fillStyle = '#fff'; for (const [i, j] of [[2, 1], [9, 1]]) g.fillRect(i * p, j * p, p, p);
  return o;
}
// el WebP de 512×512 de 100 KB como mucho (bajando la calidad de a poco si hace falta)
export async function exportarWebP(c) {
  for (const q of [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4, 0.3]) {
    const b = await aBlob(c, 'image/webp', q);
    if (!b || b.type !== 'image/webp') throw new Error('este navegador no hace WebP');
    if (b.size <= MAX_BYTES) return { blob: b, q };
  }
  throw new Error('el sticker pesa demasiado');
}
// el ícono del pack en WhatsApp: 96×96, PNG de 50 KB como mucho (también en los packs animados: quieto)
export async function exportarBandeja(c) {
  const t = lienzo(96, 96), g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, 96, 96);
  const b = await aBlob(t, 'image/png'); if (b.size <= 50 * 1024) return b;
  return aBlob(t, 'image/webp', 0.8);
}

// ---- WebP animado (el navegador sólo sabe hacer WebP quietos: cada cuadro se hace quieto y acá se arma la animación) ----
// Formato: RIFF 'WEBP' · VP8X (con animación y transparencia) · ANIM (fondo transparente, vueltas infinitas) · un ANMF por
// cuadro con los trozos ALPH/VP8 de un WebP quieto. Cada cuadro va recortado a lo que tiene dibujado (pesa y tarda mucho
// menos que 512×512 entero) y se borra al pasar al siguiente, así no quedan restos del anterior.
const ascii = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));
function trozosWebP(buf) {
  const v = new DataView(buf), id = (o) => String.fromCharCode(...new Uint8Array(buf, o, 4));
  if (id(0) !== 'RIFF' || id(8) !== 'WEBP') throw new Error('no es un WebP');
  const out = []; let o = 12;
  while (o + 8 <= buf.byteLength) { const n = v.getUint32(o + 4, true); out.push({ id: id(o), datos: new Uint8Array(buf, o + 8, n) }); o += 8 + n + (n & 1); }
  return out;
}
function trozo(id, datos) {
  const n = datos.length, b = new Uint8Array(8 + n + (n & 1)); b.set(ascii(id), 0); new DataView(b.buffer).setUint32(4, n, true); b.set(datos, 8); return b;
}
const u24 = (b, o, v) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; };
const unir = (partes) => { const n = partes.reduce((s, x) => s + x.length, 0), u = new Uint8Array(n); let o = 0; for (const x of partes) { u.set(x, o); o += x.length; } return u; };
// lo dibujado de un cuadro: { x, y (pares, como pide el formato), c: el lienzo recortado }
export function recortarCuadro(c) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 1; } // (cuadro vacío: uno de 2×2 transparente)
  x0 -= x0 & 1; y0 -= y0 & 1;
  const out = lienzo(x1 - x0 + 1, y1 - y0 + 1); out.getContext('2d').drawImage(c, -x0, -y0);
  return { x: x0, y: y0, c: out };
}
export async function anmf(cr, ms, q) {
  const b = await aBlob(cr.c, 'image/webp', q); if (!b || b.type !== 'image/webp') throw new Error('este navegador no hace WebP');
  const ts = trozosWebP(await b.arrayBuffer()).filter((x) => x.id === 'ALPH' || x.id === 'VP8 ' || x.id === 'VP8L');
  if (!ts.some((x) => x.id !== 'ALPH')) throw new Error('cuadro sin imagen');
  const cab = new Uint8Array(16); u24(cab, 0, cr.x / 2); u24(cab, 3, cr.y / 2); u24(cab, 6, cr.c.width - 1); u24(cab, 9, cr.c.height - 1);
  u24(cab, 12, Math.max(8, Math.round(ms))); cab[15] = 0x03; // (sin mezclar con el anterior; al terminar, se borra)
  return trozo('ANMF', unir([cab, ...ts.map((x) => trozo(x.id, x.datos))]));
}
// arma el WebP animado con cuadros ya codificados (anmf): el editor de video los codifica de a uno, sin tenerlos todos en memoria
export function webpDePartes(partes, W = LADO, H = LADO) {
  const vp8x = new Uint8Array(10); vp8x[0] = 0x02 | 0x10; u24(vp8x, 4, W - 1); u24(vp8x, 7, H - 1);
  const cuerpo = unir([ascii('WEBP'), trozo('VP8X', vp8x), trozo('ANIM', new Uint8Array(6)), ...partes]);
  const riff = new Uint8Array(8 + cuerpo.length); riff.set(ascii('RIFF'), 0); new DataView(riff.buffer).setUint32(4, cuerpo.length, true); riff.set(cuerpo, 8);
  return new Blob([riff], { type: 'image/webp' });
}
export async function webpAnimado(cuadros, ms, q, W = LADO, H = LADO) {
  const crs = cuadros.map((c) => (c.c ? c : recortarCuadro(c))), partes = [];
  for (const cr of crs) partes.push(await anmf(cr, ms, q));
  const vp8x = new Uint8Array(10); vp8x[0] = 0x02 | 0x10; u24(vp8x, 4, W - 1); u24(vp8x, 7, H - 1);
  const anim = new Uint8Array(6); // (fondo transparente; vueltas: 0 = siempre)
  const cuerpo = unir([ascii('WEBP'), trozo('VP8X', vp8x), trozo('ANIM', anim), ...partes]);
  const riff = new Uint8Array(8 + cuerpo.length); riff.set(ascii('RIFF'), 0); new DataView(riff.buffer).setUint32(4, cuerpo.length, true); riff.set(cuerpo, 8);
  return new Blob([riff], { type: 'image/webp' });
}
// el sticker animado de 500 KB como mucho. La calidad se elige midiendo 4 cuadros de muestra (la más alta que, según
// ellos, entra con un 10 % de margen). Antes que bajar de 0,6 de calidad, menos cuadros por segundo (12 → 10 → 8).
export async function exportarAnimado(st) {
  // (con fotos que se mueven todo el tiempo —Movimiento, Glitch, VHS— cada cuadro pesa: se prueba con menos cuadros por
  // segundo hasta 5, y más comprimido, antes de decir que no entra en los 500 KB de WhatsApp. Para elegir, alcanzan 4
  // cuadros de muestra por velocidad; todos los cuadros se dibujan sólo para la elegida)
  const D = st.duracion(), Q = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38, 0.3, 0.22], MIN_Q = 0.6, cands = [];
  for (const fps of [12, 10, 8, 6, 5]) {
    const n = Math.max(2, Math.round(D * fps)), ms = Math.round((1000 * D) / n);
    const muestra = [0, 1, 2, 3].map((k) => recortarCuadro(st.componer(Math.floor((k * n) / 4) / n)));
    let i = 0;
    for (; i < Q.length - 1; i++) {
      let peso = 0; for (const cr of muestra) peso += (await anmf(cr, ms, Q[i])).length;
      if ((peso / muestra.length) * n + 64 <= MAX_ANIMADO * 0.9) break;
    }
    cands.push({ fps, n, ms, i });
    if (Q[i] >= MIN_Q) break;
  }
  cands.sort((a, b) => a.i - b.i || b.fps - a.fps);   // (la de mejor calidad; empatadas, la más fluida)
  for (const c of cands) {
    const cuadros = Array.from({ length: c.n }, (_, k) => recortarCuadro(st.componer(k / c.n)));
    for (let i = c.i; i < Q.length; i++) {
      const blob = await webpAnimado(cuadros, c.ms, Q[i]);
      if (blob.size <= MAX_ANIMADO) return { blob, cuadros: c.n, ms: c.ms, q: Q[i], fps: c.fps };
    }
  }
  throw new Error('el sticker animado pesa demasiado');
}
