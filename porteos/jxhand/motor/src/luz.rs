//! Para ver con poca luz: antes de que la red mire el recorte (el de la palma o el de la mano), se mide su brillo y,
//! si está oscuro, se estira como haría un fotógrafo: se baja el negro, se sube el blanco (hasta ×8) y una curva
//! (gamma) lleva los tonos medios a un nivel normal. Con mucha ganancia el ruido de la cámara también sube, así que
//! entonces se suaviza un poco (3×3) antes de pasárselo a la red. Con buena luz no se toca nada.
//!
//! Todo se mide en el recorte mismo, no en la imagen entera: una lámpara o el fondo oscuro no cambian cómo se ve la mano.

/// lo que se hizo con el último recorte (para mostrarlo y para las pruebas)
#[derive(Clone, Copy, Debug, Default)]
pub struct Realce {
    /// brillo medio (mediana de la luminancia, 0..1) y el blanco (percentil 99,5) antes de tocar nada
    pub mediana: f32,
    pub blanco: f32,
    /// cuánto se aclaró en los tonos medios (1 = nada)
    pub ganancia: f32,
    pub suavizado: bool,
}

#[derive(Clone, Copy, Debug)]
pub struct AjusteLuz {
    pub activo: bool,
    /// tope de cuánto se estira el contraste
    pub max_estirar: f32,
    /// a qué nivel se llevan los tonos medios
    pub medio_objetivo: f32,
    /// desde qué ganancia se suaviza el ruido
    pub suavizar_desde: f32,
}
impl Default for AjusteLuz {
    fn default() -> Self { AjusteLuz { activo: true, max_estirar: 8.0, medio_objetivo: 0.40, suavizar_desde: 1.5 } }
}

const BINS: usize = 256;

/// ¿el recorte está oscuro? (la misma regla que usa `realzar` para empezar a actuar, medida rápido: la media y el máximo
/// aproximado de la luminancia, de a un píxel cada 4)
pub fn oscuro(px: &[f32], tam: usize, util: (usize, usize, usize, usize)) -> bool {
    let (x0, y0, x1, y1) = util;
    let (mut suma, mut n, mut hist) = (0f32, 0u32, [0u32; 32]);
    for y in (y0..y1).step_by(4) {
        for p in px[(y * tam + x0) * 3..(y * tam + x1) * 3].chunks_exact(12) {
            let l = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
            suma += l; n += 1; hist[((l * 31.0) as usize).min(31)] += 1;
        }
    }
    if n == 0 { return false; }
    let mut acc = 0; let mut blanco = 1.0;
    for (i, &c) in hist.iter().enumerate() { acc += c; if acc as f32 >= n as f32 * 0.995 { blanco = (i as f32 + 1.0) / 32.0; break; } }
    suma / (n as f32) < 0.22 || blanco < 0.80
}

/// mide y, si hace falta, realza `px` (tam×tam×3, valores 0..1) en el lugar. `util`: el rectángulo con imagen
/// (x0, y0, x1, y1 en píxeles del recorte), para no contar las bandas negras del detector.
pub fn realzar(px: &mut [f32], tam: usize, util: (usize, usize, usize, usize), aj: &AjusteLuz, tmp: &mut Vec<f32>) -> Realce {
    let (x0, y0, x1, y1) = util;
    // 1) histograma de la luminancia (de a un píxel por medio en cada eje: sobra para los percentiles)
    let mut hist = [0u32; BINS];
    let mut n = 0u32;
    for y in (y0..y1).step_by(2) {
        let fila = &px[(y * tam + x0) * 3..(y * tam + x1) * 3];
        for p in fila.chunks_exact(6) {
            let l = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
            hist[((l * (BINS - 1) as f32 + 0.5) as usize).min(BINS - 1)] += 1; n += 1;
        }
    }
    if n == 0 { return Realce { ganancia: 1.0, ..Default::default() }; }
    let pct = |q: f32| -> f32 {
        let meta = (q * n as f32) as u32; let mut acc = 0u32;
        for (i, &c) in hist.iter().enumerate() { acc += c; if acc > meta { return i as f32 / (BINS - 1) as f32; } }
        1.0
    };
    let (negro, mediana, blanco) = (pct(0.005), pct(0.5), pct(0.995));
    let mut r = Realce { mediana, blanco, ganancia: 1.0, suavizado: false };
    if !aj.activo { return r; }
    // 2) ¿está oscuro? Con un blanco de 0,8 o más y medios de 0,2 o más, la imagen es normal. La fuerza crece suave
    //    (sin saltos de un cuadro a otro cuando la luz anda justo en el límite).
    let f_blanco = ((0.80 - blanco) / 0.25).clamp(0.0, 1.0);
    let f_medio = ((0.20 - mediana) / 0.10).clamp(0.0, 1.0);
    let fuerza = f_blanco.max(f_medio);
    if fuerza <= 0.0 { return r; }
    // 3) la curva: negro → 0 (sólo el 80 %: no comerse las sombras), blanco → 0,95, y una gamma que lleva la mediana
    //    a `medio_objetivo`
    let base = negro * 0.8;
    let estirar = (0.95 / (blanco - base).max(1e-3)).clamp(1.0, aj.max_estirar);
    let med_e = ((mediana - base) * estirar).clamp(1e-3, 1.0);
    let gamma = if med_e < aj.medio_objetivo { (aj.medio_objetivo.ln() / med_e.ln()).clamp(0.40, 1.0) } else { 1.0 };
    // la curva final, mezclada con la identidad según la fuerza, en una tabla de 1024 valores
    let mut tabla = [0f32; 1025];
    for (i, t) in tabla.iter_mut().enumerate() {
        let v = i as f32 / 1024.0;
        let c = ((v - base) * estirar).clamp(0.0, 1.0).powf(gamma);
        *t = v + (c - v) * fuerza;
    }
    let g_medios = tabla[((mediana * 1024.0) as usize).min(1024)] / mediana.max(1e-3);
    r.ganancia = g_medios;
    // 4) con mucha ganancia, primero se suaviza el ruido (gaussiano 3×3; el ruido se estira junto con la imagen)
    if g_medios >= aj.suavizar_desde {
        suavizar(px, tam, util, tmp);
        r.suavizado = true;
    }
    for y in y0..y1 {
        for v in px[(y * tam + x0) * 3..(y * tam + x1) * 3].iter_mut() {
            let p = (v.clamp(0.0, 1.0) * 1024.0).min(1023.999);
            let i = p as usize; let f = p - i as f32;
            *v = tabla[i] + (tabla[i + 1] - tabla[i]) * f;
        }
    }
    r
}

/// gaussiano 3×3 (1 2 1) en el rectángulo útil, separable, con los bordes repetidos
fn suavizar(px: &mut [f32], tam: usize, util: (usize, usize, usize, usize), tmp: &mut Vec<f32>) {
    let (x0, y0, x1, y1) = util;
    if x1 <= x0 + 2 || y1 <= y0 + 2 { return; }
    tmp.resize(px.len(), 0.0);
    // horizontal → tmp
    for y in y0..y1 {
        for x in x0..x1 {
            let (a, c) = (x.saturating_sub(1).max(x0), (x + 1).min(x1 - 1));
            for k in 0..3 {
                tmp[(y * tam + x) * 3 + k] = (px[(y * tam + a) * 3 + k] + 2.0 * px[(y * tam + x) * 3 + k] + px[(y * tam + c) * 3 + k]) * 0.25;
            }
        }
    }
    // vertical → px
    for y in y0..y1 {
        let (a, c) = (y.saturating_sub(1).max(y0), (y + 1).min(y1 - 1));
        for x in x0..x1 {
            for k in 0..3 {
                px[(y * tam + x) * 3 + k] = (tmp[(a * tam + x) * 3 + k] + 2.0 * tmp[(y * tam + x) * 3 + k] + tmp[(c * tam + x) * 3 + k]) * 0.25;
            }
        }
    }
}

/// para mostrar la imagen con «ver de noche»: la misma idea que `realzar` pero como una tabla de 256 valores para los
/// canales RGBA de la imagen entera (medida de a un píxel cada 5, sin suavizar: es para mirar, no para la red)
pub fn tabla_rgba(rgba: &[u8]) -> [u8; 256] {
    let mut hist = [0u32; 256]; let mut n = 0u32;
    for p in rgba.chunks_exact(4).step_by(5) {
        let l = (77 * p[0] as u32 + 150 * p[1] as u32 + 29 * p[2] as u32) >> 8;
        hist[l as usize] += 1; n += 1;
    }
    let mut t = [0u8; 256];
    for (i, v) in t.iter_mut().enumerate() { *v = i as u8; }
    if n == 0 { return t; }
    let pct = |q: f32| { let meta = (q * n as f32) as u32; let mut acc = 0; for (i, &c) in hist.iter().enumerate() { acc += c; if acc > meta { return i as f32 / 255.0; } } 1.0 };
    let (negro, mediana, blanco) = (pct(0.005), pct(0.5), pct(0.995));
    let fuerza = ((0.80 - blanco) / 0.25).clamp(0.0, 1.0).max(((0.30 - mediana) / 0.15).clamp(0.0, 1.0));
    if fuerza <= 0.0 { return t; }
    let base = negro * 0.8;
    let estirar = (0.97 / (blanco - base).max(1e-3)).clamp(1.0, 10.0);
    let med_e = ((mediana - base) * estirar).clamp(1e-3, 1.0);
    let gamma = if med_e < 0.45 { (0.45f32.ln() / med_e.ln()).clamp(0.35, 1.0) } else { 1.0 };
    for (i, v) in t.iter_mut().enumerate() {
        let x = i as f32 / 255.0;
        let c = ((x - base) * estirar).clamp(0.0, 1.0).powf(gamma);
        *v = ((x + (c - x) * fuerza) * 255.0 + 0.5).clamp(0.0, 255.0) as u8;
    }
    t
}
