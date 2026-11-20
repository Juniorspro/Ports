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

// las personas: fondo = categoría 0; adentro = 1 - fondo. Devuelve { mascara, cuanto } (cuánto de la foto es persona)
export async function recortarPersona(img) {
  await preparar();
  const r = persona.segment(img), M = r.confidenceMasks, fondo = M[0].getAsFloat32Array(), w = M[0].width, h = M[0].height;
  // (las categorías: 0 fondo, 1 pelo, 2 piel del cuerpo, 3 piel de la cara, 4 ropa, 5 otros —accesorios—)
  const cat = M.map((m) => m.getAsFloat32Array()), parte = new Float32Array(6);
  const prob = new Float32Array(fondo.length); let n = 0;
  for (let i = 0; i < prob.length; i++) {
    prob[i] = 1 - fondo[i]; if (prob[i] > 0.5) n++;
    let k = 0, mx = -1; for (let c = 0; c < cat.length; c++) if (cat[c][i] > mx) { mx = cat[c][i]; k = c; }
    parte[k]++;
  }
  for (const m of M) m.close();
  const N = prob.length;
  return { mascara: aMascara(prob, w, h), w, h, cuanto: n / N, pelo: parte[1] / N, piel: parte[2] / N, cara: parte[3] / N, ropa: parte[4] / N };
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
  return { ...t, como: 'medio' };
}
// sumar o restar una máscara a otra (tocar otra cosa más, o el borrador)
export function unir(a, b) { const m = new Uint8ClampedArray(a.length); for (let i = 0; i < a.length; i++) m[i] = Math.max(a[i], b[i]); return m; }
