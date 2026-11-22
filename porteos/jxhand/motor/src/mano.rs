//! El camino de MediaPipe Hands, hecho de nuevo en Rust: el detector de palmas (192×192, 2016 anclas SSD, supresión
//! ponderada), el recorte rotado de cada mano (224×224) y el modelo de los 21 puntos (en la imagen y en metros), con el
//! rectángulo del cuadro siguiente sacado de los puntos (así el detector corre sólo cuando hace falta).
use crate::luz::{self, AjusteLuz, Realce};
use crate::red::Red;
use std::f32::consts::PI;

pub const PUNTOS: usize = 21;

#[derive(Clone, Copy, Debug, Default)]
pub struct P3 { pub x: f32, pub y: f32, pub z: f32 }

/// un cuadrado rotado en la imagen (en píxeles): centro, lado y ángulo (radianes; con y hacia abajo, positivo = horario)
#[derive(Clone, Copy, Debug, Default)]
pub struct Roi { pub cx: f32, pub cy: f32, pub lado: f32, pub ang: f32 }

#[derive(Clone, Debug)]
pub struct Palma { pub puntaje: f32, pub caja: [f32; 4], pub claves: [[f32; 2]; 7] } // caja: xc, yc, w, h (px)

#[derive(Clone, Debug)]
pub struct Puntos {
    /// en píxeles de la imagen; z en las mismas unidades (relativa a la muñeca, negativa hacia la cámara)
    pub img: [P3; PUNTOS],
    /// en metros, centrados en la mano (los del modelo, girados como la mano en la imagen)
    pub mundo: [P3; PUNTOS],
    pub presencia: f32,
    /// probabilidad de que tenga la forma de una mano derecha en la imagen tal cual llega (en una imagen espejada, de
    /// selfie, coincide con la mano real; en una sin espejar, es la otra)
    pub derecha: f32,
    pub roi: Roi,
}

pub fn normalizar_ang(a: f32) -> f32 { a - 2.0 * PI * ((a + PI) / (2.0 * PI)).floor() }

/// llena `dst` (tam×tam×3, valores 0..1) muestreando la imagen RGBA con el cuadrado rotado (bilineal). Si el cuadrado
/// es mucho más grande que el recorte (como la imagen entera para el detector), cada píxel del recorte promedia los de
/// la imagen que le tocan (n×n): así no se pierde detalle de golpe y el ruido de la cámara baja n veces.
///
/// Medido con fotos oscurecidas con ruido de cámara: al detector el promedio le sirve muchísimo (con 1/128 de la luz
/// pasa de encontrar la palma 8 de cada 100 veces a casi todas); al modelo de los puntos no (comete más error que con
/// el bilineal), así que sólo lo usa el detector.
pub fn recortar(rgba: &[u8], w: usize, h: usize, roi: &Roi, tam: usize, replicar: bool, promediar: bool, dst: &mut [f32]) {
    let paso = roi.lado / tam as f32;
    // (sólo desde 2 píxeles de imagen por píxel de recorte)
    let n = if promediar && PROMEDIAR.load(std::sync::atomic::Ordering::Relaxed) && paso >= 2.0 { (paso.floor() as usize).clamp(2, 3) } else { 1 };
    // (repartido por filas entre los núcleos: cada trozo escribe sus filas del recorte)
    let pd = crate::hilos::Puntero(dst.as_mut_ptr());
    let filas = if crate::hilos::cuantos() > 1 { tam.div_ceil(crate::hilos::cuantos() * 2) } else { tam };
    crate::hilos::repartir(tam.div_ceil(filas), &|k| {
        let (v0, v1) = (k * filas, ((k + 1) * filas).min(tam));
        let parte = unsafe { pd.parte(v0 * tam * 3, (v1 - v0) * tam * 3) };
        if n >= 2 { recortar_promediando(rgba, w, h, roi, tam, replicar, parte, n, v0, v1) } else { recortar_bilineal(rgba, w, h, roi, tam, replicar, parte, v0, v1) }
    });
}
pub static PROMEDIAR: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);

#[allow(clippy::too_many_arguments)]
fn recortar_promediando(rgba: &[u8], w: usize, h: usize, roi: &Roi, tam: usize, replicar: bool, dst: &mut [f32], n: usize, va: usize, vb: usize) {
    let (c, s) = (roi.ang.cos(), roi.ang.sin());
    let paso = roi.lado / tam as f32;
    let (ux, uy) = (c * paso, s * paso);
    let (vx, vy) = (-s * paso, c * paso);
    // el centro de cada sub-muestra dentro del píxel del recorte
    let x00 = roi.cx - (ux + vx) * (tam as f32 * 0.5) - 0.5;
    let y00 = roi.cy - (uy + vy) * (tam as f32 * 0.5) - 0.5;
    let k = 1.0 / (255.0 * (n * n) as f32);
    let (wi, hi) = (w as isize, h as isize);
    let mut subs = [(0f32, 0f32); 16];
    for j in 0..n { for i in 0..n {
        let (a, b) = ((i as f32 + 0.5) / n as f32, (j as f32 + 0.5) / n as f32);
        subs[j * n + i] = (ux * a + vx * b, uy * a + vy * b);
    } }
    let subs = &subs[..n * n];
    for v in va..vb {
        let (mut x, mut y) = (x00 + vx * v as f32, y00 + vy * v as f32);
        let fila = &mut dst[(v - va) * tam * 3..(v - va + 1) * tam * 3];
        for u in 0..tam {
            let o = &mut fila[u * 3..u * 3 + 3];
            let (cx, cy) = (x + (ux + vx) * 0.5, y + (uy + vy) * 0.5);
            if !replicar && (cx < -0.5 || cy < -0.5 || cx > w as f32 - 0.5 || cy > h as f32 - 0.5) { o[0] = 0.0; o[1] = 0.0; o[2] = 0.0; }
            else {
                // (sub-muestras con el píxel más cercano y sumas enteras: es para el detector, donde importa juntar ruido y
                // no el detalle fino, y así cuesta ~1 ms en vez de ~10 con bilineales)
                let (mut r, mut g, mut b) = (0u32, 0u32, 0u32);
                for &(dx, dy) in subs {
                    let xi = ((x + dx + 0.5) as isize).clamp(0, wi - 1) as usize; let yi = ((y + dy + 0.5) as isize).clamp(0, hi - 1) as usize;
                    let p = (yi * w + xi) * 4;
                    r += rgba[p] as u32; g += rgba[p + 1] as u32; b += rgba[p + 2] as u32;
                }
                o[0] = r as f32 * k; o[1] = g as f32 * k; o[2] = b as f32 * k;
            }
            x += ux; y += uy;
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn recortar_bilineal(rgba: &[u8], w: usize, h: usize, roi: &Roi, tam: usize, replicar: bool, dst: &mut [f32], va: usize, vb: usize) {
    let (c, s) = (roi.ang.cos(), roi.ang.sin());
    let paso = roi.lado / tam as f32;
    let (ux, uy) = (c * paso, s * paso); // una columna del recorte en la imagen
    let (vx, vy) = (-s * paso, c * paso); // una fila
    let x00 = roi.cx - (ux + vx) * (tam as f32 * 0.5 - 0.5) - 0.5;
    let y00 = roi.cy - (uy + vy) * (tam as f32 * 0.5 - 0.5) - 0.5;
    let (wm, hm) = (w as f32 - 1.0, h as f32 - 1.0);
    let k = 1.0 / 255.0;
    for v in va..vb {
        let (mut x, mut y) = (x00 + vx * v as f32, y00 + vy * v as f32);
        let fila = &mut dst[(v - va) * tam * 3..(v - va + 1) * tam * 3];
        for u in 0..tam {
            let o = &mut fila[u * 3..u * 3 + 3];
            if !replicar && (x < -0.5 || y < -0.5 || x > wm + 0.5 || y > hm + 0.5) { o[0] = 0.0; o[1] = 0.0; o[2] = 0.0; }
            else {
                let (xc, yc) = (x.clamp(0.0, wm), y.clamp(0.0, hm));
                let (x0, y0) = (xc as usize, yc as usize); let (x1, y1) = ((x0 + 1).min(w - 1), (y0 + 1).min(h - 1));
                let (fx, fy) = (xc - x0 as f32, yc - y0 as f32);
                let (a, b, cc, d) = ((y0 * w + x0) * 4, (y0 * w + x1) * 4, (y1 * w + x0) * 4, (y1 * w + x1) * 4);
                for i in 0..3 {
                    let t = rgba[a + i] as f32 + (rgba[b + i] as f32 - rgba[a + i] as f32) * fx;
                    let bb = rgba[cc + i] as f32 + (rgba[d + i] as f32 - rgba[cc + i] as f32) * fx;
                    o[i] = (t + (bb - t) * fy) * k;
                }
            }
            x += ux; y += uy;
        }
    }
}

// ---- el detector de palmas ----
pub struct Detector {
    red: Red, anclas: Vec<[f32; 2]>, pub umbral: f32,
    /// el lado de la imagen que mira (192 el de MediaPipe; más chico, menos cuentas: ver `nuevo_tam`)
    pub tam: usize,
    /// el mejor puntaje de la última imagen (aunque no pase el umbral)
    pub mejor: f32,
    /// el realce para la poca luz y lo que hizo en la última imagen. En el detector viene apagado: medido, con el ruido
    /// de una cámara a oscuras lo empeora (el detector aguanta bien lo oscuro; lo que no aguanta es el ruido).
    pub luz: AjusteLuz, pub realce: Realce, tmp: Vec<f32>,
    /// con poca luz, el detector promedia su entrada con la de los cuadros anteriores (el ruido baja; la mano, mientras
    /// se la busca, casi no se mueve). `seguido`: el que llama avisa si este cuadro viene justo después del anterior.
    pub acumular: bool, pub seguido: bool, acum: Vec<f32>, acum_n: u32,
}

fn anclas_palma(tam: usize) -> Vec<[f32; 2]> {
    // SSD de MediaPipe para la palma (192): 4 capas, pasos 8,16,16,16, 2 anclas por capa y celda, tamaño fijo
    let pasos = [8usize, 16, 16, 16];
    let mut r = Vec::with_capacity(2016);
    let mut i = 0;
    while i < pasos.len() {
        let mut j = i; let mut n = 0;
        while j < pasos.len() && pasos[j] == pasos[i] { n += 2; j += 1; }
        let lado = (tam + pasos[i] - 1) / pasos[i];
        for y in 0..lado { for x in 0..lado { for _ in 0..n { r.push([(x as f32 + 0.5) / lado as f32, (y as f32 + 0.5) / lado as f32]); } } }
        i = j;
    }
    r
}

fn iou(a: &[f32; 4], b: &[f32; 4]) -> f32 {
    let (ax0, ay0, ax1, ay1) = (a[0] - a[2] / 2.0, a[1] - a[3] / 2.0, a[0] + a[2] / 2.0, a[1] + a[3] / 2.0);
    let (bx0, by0, bx1, by1) = (b[0] - b[2] / 2.0, b[1] - b[3] / 2.0, b[0] + b[2] / 2.0, b[1] + b[3] / 2.0);
    let iw = (ax1.min(bx1) - ax0.max(bx0)).max(0.0); let ih = (ay1.min(by1) - ay0.max(by0)).max(0.0);
    let inter = iw * ih; let u = a[2] * a[3] + b[2] * b[3] - inter;
    if u <= 0.0 { 0.0 } else { inter / u }
}

impl Detector {
    pub fn nuevo(modelo: &[u8]) -> Result<Detector, String> { Detector::nuevo_tam(modelo, 192) }
    /// con la imagen a `tam` × `tam` (múltiplo de 16): las anclas se rehacen para esas grillas
    pub fn nuevo_tam(modelo: &[u8], tam: usize) -> Result<Detector, String> {
        let red = if tam == 192 { Red::cargar(modelo)? } else { Red::cargar_tam(modelo, Some((tam, tam)))? };
        let anclas = anclas_palma(tam);
        let n = red.salida(1).len();
        if anclas.len() != n { return Err(format!("anclas: {} para {} salidas", anclas.len(), n)); }
        Ok(Detector { red, anclas, umbral: 0.5, tam, mejor: 0.0, luz: AjusteLuz { activo: false, ..AjusteLuz::default() }, realce: Realce::default(), tmp: Vec::new(), acumular: true, seguido: false, acum: Vec::new(), acum_n: 0 })
    }
    /// las palmas de la imagen (en píxeles), ya sin repetidas
    pub fn detectar(&mut self, rgba: &[u8], w: usize, h: usize) -> Vec<Palma> {
        // la imagen entera con bandas (sin deformar) en tam × tam
        let t = self.tam; let tf = t as f32;
        let esc = tf / (w.max(h) as f32);
        let roi = Roi { cx: w as f32 / 2.0, cy: h as f32 / 2.0, lado: w.max(h) as f32, ang: 0.0 };
        recortar(rgba, w, h, &roi, t, false, true, self.red.entrada(0));
        // (el realce mira sólo la parte con imagen, no las bandas negras)
        let (iw, ih) = (w as f32 * esc, h as f32 * esc);
        let util = (((tf - iw) / 2.0).ceil() as usize, ((tf - ih) / 2.0).ceil() as usize, ((tf + iw) / 2.0).floor() as usize, ((tf + ih) / 2.0).floor() as usize);
        // poca luz y cuadros seguidos: promedio con los anteriores (el último pesa 1/2, hasta ~3 cuadros) antes del realce
        let oscuro = self.acumular && luz::oscuro(self.red.entrada(0), t, util);
        if oscuro && self.seguido && self.acum_n > 0 && self.acum.len() == t * t * 3 {
            // (sólo lo que está quieto: un píxel que cambió más que el ruido —la mano que se mueve— toma el valor nuevo.
            // Antes se promediaba todo y una mano en movimiento quedaba como un fantasma borroso que el detector no veía;
            // y la regla de «poca luz» se prende en cualquier pieza sin blancos fuertes)
            let a = 1.0 / (self.acum_n as f32 + 1.0).min(2.0);
            for (m, v) in self.acum.chunks_exact_mut(3).zip(self.red.entrada(0).chunks_exact(3)) {
                let d = (v[0] - m[0]).abs() + (v[1] - m[1]).abs() + (v[2] - m[2]).abs();
                if d < 0.15 { for i in 0..3 { m[i] += (v[i] - m[i]) * a; } } else { m.copy_from_slice(v); }
            }
            self.red.entrada(0).copy_from_slice(&self.acum); self.acum_n += 1;
        } else if oscuro {
            self.acum.clear(); self.acum.extend_from_slice(self.red.entrada(0)); self.acum_n = 1;
        } else { self.acum_n = 0; }
        self.realce = luz::realzar(self.red.entrada(0), t, util, &self.luz, &mut self.tmp);
        self.red.correr();
        let (reg, pun) = (self.red.salida(0), self.red.salida(1));
        let (ox, oy) = (roi.cx - roi.lado / 2.0, roi.cy - roi.lado / 2.0);
        let mut cand: Vec<Palma> = Vec::new(); self.mejor = 0.0;
        for (i, a) in self.anclas.iter().enumerate() {
            let s = 1.0 / (1.0 + (-pun[i].clamp(-100.0, 100.0)).exp()); self.mejor = self.mejor.max(s);
            if s < self.umbral { continue; }
            let r = &reg[i * 18..i * 18 + 18];
            let px = |v: f32, base: f32| (v / tf + base) * tf / esc;
            let caja = [px(r[0], a[0]) + ox, px(r[1], a[1]) + oy, r[2] / esc, r[3] / esc];
            let mut claves = [[0f32; 2]; 7];
            for k in 0..7 { claves[k] = [px(r[4 + 2 * k], a[0]) + ox, px(r[5 + 2 * k], a[1]) + oy]; }
            cand.push(Palma { puntaje: s, caja, claves });
        }
        // supresión ponderada (la de MediaPipe): se juntan las que se pisan más de 0,3 y se promedian con su puntaje
        cand.sort_by(|a, b| b.puntaje.partial_cmp(&a.puntaje).unwrap());
        let mut res = Vec::new();
        while !cand.is_empty() {
            let base = cand[0].caja;
            let (grupo, resto): (Vec<Palma>, Vec<Palma>) = cand.into_iter().partition(|p| iou(&p.caja, &base) > 0.3);
            cand = resto;
            let tot: f32 = grupo.iter().map(|p| p.puntaje).sum();
            let mut m = Palma { puntaje: grupo[0].puntaje, caja: [0.0; 4], claves: [[0.0; 2]; 7] };
            for p in &grupo {
                let k = p.puntaje / tot;
                for i in 0..4 { m.caja[i] += p.caja[i] * k; }
                for i in 0..7 { m.claves[i][0] += p.claves[i][0] * k; m.claves[i][1] += p.claves[i][1] * k; }
            }
            res.push(m);
        }
        res
    }
}

/// el cuadrado de la mano a partir de la palma (girado para que los dedos queden arriba, ×2,6 y corrido hacia los dedos)
pub fn roi_de_palma(p: &Palma) -> Roi {
    let (x0, y0, x1, y1) = (p.claves[0][0], p.claves[0][1], p.claves[2][0], p.claves[2][1]);
    let ang = normalizar_ang(PI / 2.0 - (-(y1 - y0)).atan2(x1 - x0));
    transformar(p.caja[0], p.caja[1], p.caja[2], p.caja[3], ang, 2.6, -0.5)
}

fn transformar(cx: f32, cy: f32, w: f32, h: f32, ang: f32, escala: f32, corr_y: f32) -> Roi {
    let (c, s) = (ang.cos(), ang.sin());
    let (dx, dy) = (-h * corr_y * s, h * corr_y * c);
    Roi { cx: cx + dx, cy: cy + dy, lado: w.max(h) * escala, ang }
}

/// el cuadrado del cuadro siguiente a partir de los puntos (el de MediaPipe: muñeca, pulgar y nudillos)
pub fn roi_de_puntos(img: &[P3; PUNTOS]) -> Roi {
    const PARTE: [usize; 12] = [0, 1, 2, 3, 5, 6, 9, 10, 13, 14, 17, 18];
    let (x0, y0) = (img[0].x, img[0].y);
    let x1 = ((img[5].x + img[13].x) / 2.0 + img[9].x) / 2.0; let y1 = ((img[5].y + img[13].y) / 2.0 + img[9].y) / 2.0;
    let ang = normalizar_ang(PI / 2.0 - (-(y1 - y0)).atan2(x1 - x0));
    let (mut mnx, mut mxx, mut mny, mut mxy) = (f32::MAX, f32::MIN, f32::MAX, f32::MIN);
    for &i in &PARTE { mnx = mnx.min(img[i].x); mxx = mxx.max(img[i].x); mny = mny.min(img[i].y); mxy = mxy.max(img[i].y); }
    let (acx, acy) = ((mnx + mxx) / 2.0, (mny + mxy) / 2.0);
    let (c, s) = ((-ang).cos(), (-ang).sin());
    let (mut a, mut b, mut cc, mut d) = (f32::MAX, f32::MIN, f32::MAX, f32::MIN);
    for &i in &PARTE {
        let (ox, oy) = (img[i].x - acx, img[i].y - acy);
        let (px, py) = (ox * c - oy * s, ox * s + oy * c);
        a = a.min(px); b = b.max(px); cc = cc.min(py); d = d.max(py);
    }
    let (pcx, pcy) = ((a + b) / 2.0, (cc + d) / 2.0);
    let (c2, s2) = (ang.cos(), ang.sin());
    let (cx, cy) = (pcx * c2 - pcy * s2 + acx, pcx * s2 + pcy * c2 + acy);
    transformar(cx, cy, b - a, d - cc, ang, 2.0, -0.1)
}

// ---- el modelo de los 21 puntos ----
/// `tam`: el lado del recorte que mira la red (224 es el de MediaPipe; el modelo liviano anda también más chico, ver
/// `Red::cargar_tam`). `div`: en qué unidades da los puntos (los de MediaPipe, en píxeles de un recorte de 224)
pub struct Puntero { red: Red, pub luz: AjusteLuz, pub realce: Realce, tmp: Vec<f32>, pub tam: usize, pub div: f32,
    /// lo que tardaron, sumado desde la última vez que se leyó (ms): el recorte con el realce y la red
    pub ms_recorte: f32, pub ms_red: f32,
    /// medir cada tipo de capa (para ver en el celular dónde se va el tiempo): (nombre, ms acumulados, veces)
    pub perfil: Option<Vec<(String, f64, usize)>>, pub perfil_n: usize }

impl Puntero {
    pub fn nuevo(modelo: &[u8]) -> Result<Puntero, String> { Puntero::nuevo_tam(modelo, 224, 224.0) }
    /// (pruebas) la red, para medirla o cambiarla
    pub fn red_mut(&mut self) -> &mut Red { &mut self.red }
    pub fn nuevo_tam(modelo: &[u8], tam: usize, div: f32) -> Result<Puntero, String> {
        let mut red = if tam == 224 { Red::cargar(modelo)? } else { Red::cargar_tam(modelo, Some((tam, tam)))? };
        red.con_ocho = true;
        Ok(Puntero { red, luz: AjusteLuz::default(), realce: Realce::default(), tmp: Vec::new(), tam, div, ms_recorte: 0.0, ms_red: 0.0, perfil: None, perfil_n: 0 })
    }
    pub fn puntos(&mut self, rgba: &[u8], w: usize, h: usize, roi: &Roi) -> Puntos {
        let t = self.tam;
        #[cfg(not(target_arch = "wasm32"))]
        let t0 = std::time::Instant::now();
        // (directo en la entrada de la red: una copia de 600 kB menos por cuadro)
        recortar(rgba, w, h, roi, t, true, false, self.red.entrada(0));
        self.realce = luz::realzar(self.red.entrada(0), t, (0, 0, t, t), &self.luz, &mut self.tmp);
        #[cfg(not(target_arch = "wasm32"))]
        let t1 = std::time::Instant::now();
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Some(acum) = self.perfil.as_mut() {
                for (k, d, n) in self.red.correr_midiendo() { match acum.iter_mut().find(|x| x.0 == k) { Some(x) => { x.1 += d; x.2 += n; } None => acum.push((k, d, n)) } }
                self.perfil_n += 1;
            } else { self.red.correr(); }
        }
        #[cfg(target_arch = "wasm32")]
        self.red.correr();
        #[cfg(not(target_arch = "wasm32"))]
        { self.ms_recorte += (t1 - t0).as_secs_f32() * 1e3; self.ms_red += t1.elapsed().as_secs_f32() * 1e3; }
        let (scr, pres, mano, mundo) = (self.red.salida(0), self.red.salida(1)[0], self.red.salida(2)[0], self.red.salida(3));
        let (c, s) = (roi.ang.cos(), roi.ang.sin());
        let mut img = [P3::default(); PUNTOS]; let mut mw = [P3::default(); PUNTOS];
        for i in 0..PUNTOS {
            let (x, y, z) = (scr[i * 3] / self.div - 0.5, scr[i * 3 + 1] / self.div - 0.5, scr[i * 3 + 2] / self.div);
            img[i] = P3 { x: roi.cx + (x * c - y * s) * roi.lado, y: roi.cy + (x * s + y * c) * roi.lado, z: z * roi.lado };
            let (wx, wy, wz) = (mundo[i * 3], mundo[i * 3 + 1], mundo[i * 3 + 2]);
            mw[i] = P3 { x: wx * c - wy * s, y: wx * s + wy * c, z: wz };
        }
        Puntos { img, mundo: mw, presencia: pres, derecha: mano, roi: *roi }
    }
}
