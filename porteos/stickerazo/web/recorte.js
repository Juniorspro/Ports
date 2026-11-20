// El recorte: separa lo que importa del fondo, en el celular (sin mandar la foto a ningún lado).
//  · Personas, solo: el modelo «selfie multiclase» de MediaPipe (pelo, cara, cuerpo, ropa y accesorios contra el fondo).
//  · Cualquier cosa (mascotas, comida, objetos), tocándola: el modelo «magic touch» de MediaPipe recorta lo que hay
//    alrededor del punto tocado.
// Devuelve una máscara (Uint8ClampedArray, 0 = fondo, 255 = adentro) del tamaño de la imagen que se le pasa.
import { FilesetResolver, ImageSegmenter, InteractiveSegmenter } from './terceros/mediapipe/vision_bundle.mjs';

const BASE = new URL('./terceros/', import.meta.url).href;
let vision = null, persona = null, toque = null;

async function base() {
  if (!vision) vision = await FilesetResolver.forVisionTasks(BASE + 'mediapipe');
  return vision;
}
export async function preparar() {
  const v = await base();
  if (!persona) persona = await ImageSegmenter.createFromOptions(v, { baseOptions: { modelAssetPath: BASE + 'modelos/selfie_multiclass_256x256.tflite', delegate: 'CPU' }, runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true });
  if (!toque) toque = await InteractiveSegmenter.createFromOptions(v, { baseOptions: { modelAssetPath: BASE + 'modelos/magic_touch.tflite', delegate: 'CPU' }, outputCategoryMask: false, outputConfidenceMasks: true });
}

// de probabilidades (0..1) a máscara, con el borde suave (de bajo a alto) y sin manchitas sueltas lejos de lo principal
function aMascara(prob, w, h, bajo = 0.35, alto = 0.65) {
  const m = new Uint8ClampedArray(w * h);
  for (let i = 0; i < m.length; i++) { const t = (prob[i] - bajo) / (alto - bajo); m[i] = t <= 0 ? 0 : t >= 1 ? 255 : Math.round(t * t * (3 - 2 * t) * 255); }
  return limpiar(m, w, h);
}
// se quedan las partes conectadas que suman lo grande (se van los puntitos del fondo que el modelo dudó)
function limpiar(m, w, h) {
  const et = new Int32Array(w * h).fill(-1), tam = [], cola = new Int32Array(w * h);
  for (let i = 0; i < m.length; i++) {
    if (m[i] < 128 || et[i] >= 0) continue;
    const id = tam.length; let n = 0, a = 0, b = 0; cola[b++] = i; et[i] = id;
    while (a < b) { const j = cola[a++]; n++; const x = j % w, y = (j / w) | 0;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (k >= 0 && et[k] < 0 && m[k] >= 128) { et[k] = id; cola[b++] = k; } }
    tam.push(n);
  }
  if (!tam.length) return m;
  const max = Math.max(...tam), bien = tam.map((n) => n >= max * 0.08);
  for (let i = 0; i < m.length; i++) if (m[i] >= 128 && !bien[et[i]]) m[i] = 0;
  // (y lo poco opaco que quedó lejos de lo que quedó: también afuera)
  return m;
}

// las personas: fondo = categoría 0; adentro = 1 - fondo. Devuelve { mascara, cuanto, … y cabeza } (cuánto de la foto es
// persona y, si hay una cara, la máscara de la cabeza: pelo + cara + accesorios cerca de la cara, como anteojos o gorra)
export async function recortarPersona(img) {
  await preparar();
  const r = persona.segment(img), M = r.confidenceMasks, fondo = M[0].getAsFloat32Array(), w = M[0].width, h = M[0].height;
  // (las categorías: 0 fondo, 1 pelo, 2 piel del cuerpo, 3 piel de la cara, 4 ropa, 5 otros —accesorios—)
  const cat = M.map((m) => m.getAsFloat32Array()), parte = new Float32Array(6), clase = new Uint8Array(fondo.length);
  const prob = new Float32Array(fondo.length); let n = 0;
  for (let i = 0; i < prob.length; i++) {
    prob[i] = 1 - fondo[i]; if (prob[i] > 0.5) n++;
    let k = 0, mx = -1; for (let c = 0; c < cat.length; c++) if (cat[c][i] > mx) { mx = cat[c][i]; k = c; }
    parte[k]++; clase[i] = k;
  }
  const cabeza = mascaraCabeza(cat, clase, w, h);
  for (const m of M) m.close();
  const N = prob.length;
  return { mascara: aMascara(prob, w, h), w, h, cuanto: n / N, pelo: parte[1] / N, piel: parte[2] / N, cara: parte[3] / N, ropa: parte[4] / N, cabeza };
}
// la cabeza: alrededor de la cara más grande (lo que el modelo marca como piel de la cara), el pelo, la cara y los
// accesorios, dentro de una caja que sube para el pelo y el sombrero y baja un poco para el mentón
function mascaraCabeza(cat, clase, w, h) {
  const et = new Int32Array(w * h).fill(-1), cola = new Int32Array(w * h); let mejor = null;
  for (let i = 0; i < clase.length; i++) {
    if (clase[i] !== 3 || et[i] >= 0) continue;
    let a = 0, b = 0, x0 = w, y0 = h, x1 = -1, y1 = -1; cola[b++] = i; et[i] = i;
    while (a < b) {
      const j = cola[a++], x = j % w, y = (j / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (k >= 0 && et[k] < 0 && clase[k] === 3) { et[k] = i; cola[b++] = k; }
    }
    if (!mejor || b > mejor.n) mejor = { n: b, x0, y0, x1, y1 };
  }
  if (!mejor || mejor.n < w * h * 0.004) return null;
  const fw = mejor.x1 - mejor.x0 + 1, fh = mejor.y1 - mejor.y0 + 1;
  const cx0 = Math.max(0, mejor.x0 - fw * 0.55), cx1 = Math.min(w - 1, mejor.x1 + fw * 0.55), cy0 = Math.max(0, mejor.y0 - fh * 0.9), cy1 = Math.min(h - 1, mejor.y1 + fh * 0.12);
  const prob = new Float32Array(w * h);
  for (let y = Math.floor(cy0); y <= cy1; y++) for (let x = Math.floor(cx0); x <= cx1; x++) { const i = y * w + x; prob[i] = cat[1][i] + cat[3][i] + cat[5][i]; }
  return { mascara: aMascara(prob, w, h, 0.3, 0.6), w, h, caja: { x0: cx0 / w, y0: cy0 / h, x1: cx1 / w, y1: cy1 / h } };
}
// cualquier cosa tocándola: x, y entre 0 y 1
export async function recortarTocando(img, x, y) {
  await preparar();
  const r = toque.segment(img, { keypoint: { x, y } }), M = r.confidenceMasks, p = M[0].getAsFloat32Array(), w = M[0].width, h = M[0].height;
  const prob = Float32Array.from(p); for (const m of M) m.close();
  return { mascara: aMascara(prob, w, h), w, h };
}
// automático: si hay una cara, el de personas (el pelo y varias personas juntas le salen mejor); si no (mascotas, comida,
// cosas, una mano), lo que hay en el medio con el de tocar. El de personas toma por «persona» también a perros y comida
// (medido: un labrador da 28 % de «ropa» y una hamburguesa 19 %), pero ninguno tiene cara (≤ 0,6 %; un retrato, 3,5-11 %)
export async function recortarSolo(img) {
  const p = await recortarPersona(img);
  if (p.cara >= 0.012) return { ...p, como: 'persona' };
  const t = await recortarTocando(img, 0.5, 0.5);
  return { ...t, como: 'medio', cabeza: p.cabeza };
}
// sumar o restar una máscara a otra (tocar otra cosa más, o el borrador)
export function unir(a, b) { const m = new Uint8ClampedArray(a.length); for (let i = 0; i < a.length; i++) m[i] = Math.max(a[i], b[i]); return m; }
