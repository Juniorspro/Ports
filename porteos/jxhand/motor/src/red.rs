//! El intérprete de la red neuronal: corre un modelo TFLite (f32, NHWC) con kernels propios pensados para que el
//! compilador los vectorice (SIMD de WebAssembly o de la PC). Al cargar se preparan los pesos en el orden que les
//! conviene a los kernels (los de las convoluciones 1×1 quedan como [entrada][salida], los demás [kh][kw][entrada][salida])
//! y se reserva toda la memoria de una vez: correr no pide memoria nueva.
use crate::tflite::{self, Activacion, Modelo, Op, Relleno, Tipo};

#[derive(Debug)]
enum Paso {
    Conv { e: usize, s: usize, w: usize, b: usize, kh: usize, kw: usize, paso: (usize, usize), dil: (usize, usize), pad: (usize, usize), act: Activacion },
    Depthwise { e: usize, s: usize, w: usize, b: usize, kh: usize, kw: usize, paso: (usize, usize), dil: (usize, usize), pad: (usize, usize), mult: usize, act: Activacion },
    MaxPool { e: usize, s: usize, f: (usize, usize), paso: (usize, usize), pad: (usize, usize) },
    Add { a: usize, b: usize, s: usize, act: Activacion },
    Mul { a: usize, b: usize, s: usize, act: Activacion },
    Concat { e: Vec<usize>, s: usize, eje: usize },
    Copiar { e: usize, s: usize },
    Resize { e: usize, s: usize, esquinas: bool, medio: bool },
    Fc { e: usize, s: usize, w: usize, b: usize, act: Activacion },
    Pad { e: usize, s: usize, p: [(usize, usize); 4] },
    Logistic { e: usize, s: usize },
    Prelu { e: usize, s: usize, alfa: usize },
    Relu { e: usize, s: usize, tope: f32 },
    Mean { e: usize, s: usize },
}

pub struct Red {
    formas: Vec<Vec<usize>>,
    datos: Vec<Vec<f32>>,
    pasos: Vec<Paso>,
    pub entradas: Vec<usize>,
    pub salidas: Vec<usize>,
}

fn salida_tam(entrada: usize, k: usize, paso: usize, dil: usize, rel: Relleno) -> (usize, usize) {
    let ke = (k - 1) * dil + 1;
    match rel {
        Relleno::Same => { let s = (entrada + paso - 1) / paso; let tot = ((s - 1) * paso + ke).saturating_sub(entrada); (s, tot / 2) }
        Relleno::Valid => ((entrada - ke) / paso + 1, 0),
    }
}
#[inline(always)]
fn activar(x: f32, a: Activacion) -> f32 {
    match a { Activacion::Nada => x, Activacion::Relu => x.max(0.0), Activacion::Relu1 => x.clamp(-1.0, 1.0), Activacion::Relu6 => x.clamp(0.0, 6.0), Activacion::Tanh => x.tanh() }
}
fn forma4(f: &[usize]) -> [usize; 4] {
    let mut r = [1usize; 4]; let o = 4 - f.len().min(4); for (i, &d) in f.iter().take(4).enumerate() { r[o + i] = d; } r
}

impl Red {
    pub fn cargar(bytes: &[u8]) -> Result<Red, String> {
        let m: Modelo = tflite::leer(bytes)?;
        let mut formas: Vec<Vec<usize>> = m.tensores.iter().map(|t| t.forma.clone()).collect();
        let mut datos: Vec<Vec<f32>> = m.tensores.iter().map(|t| t.datos.clone()).collect();
        let constante: Vec<bool> = m.tensores.iter().map(|t| !t.datos.is_empty() || !t.enteros.is_empty()).collect();
        let mut pasos = Vec::new();
        // (primero los Dequantize: así los pesos ya están en f32 cuando se preparan las capas que los usan)
        for o in &m.operadores { if matches!(o.op, Op::Dequantize) { let (e, s) = (o.entradas[0] as usize, o.salidas[0] as usize); datos[s] = datos[e].clone(); } }
        for o in &m.operadores {
            let e = |i: usize| o.entradas[i] as usize;
            let s = o.salidas[0] as usize;
            match &o.op {
                // los pesos en float16 ya se pasaron a f32: la salida del Dequantize es la misma constante
                Op::Dequantize => {}
                Op::Conv { relleno, paso, dil, act } => {
                    let (fe, fw) = (forma4(&formas[e(0)]), formas[e(1)].clone()); // fw: [salida, kh, kw, entrada]
                    let (co, kh, kw, ci) = (fw[0], fw[1], fw[2], fw[3]);
                    let (ho, ph) = salida_tam(fe[1], kh, paso.1, dil.1, *relleno);
                    let (wo, pw) = salida_tam(fe[2], kw, paso.0, dil.0, *relleno);
                    // pesos a [kh][kw][entrada][salida]: así la salida queda contigua (SIMD sobre los canales de salida)
                    let w0 = &datos[e(1)]; let mut w = vec![0f32; w0.len()];
                    for a in 0..co { for y in 0..kh { for x in 0..kw { for c in 0..ci { w[((y * kw + x) * ci + c) * co + a] = w0[((a * kh + y) * kw + x) * ci + c]; } } } }
                    let wi = datos.len(); datos.push(w); formas.push(vec![kh, kw, ci, co]);
                    let bi = if o.entradas.len() > 2 && o.entradas[2] >= 0 { e(2) } else { datos.push(vec![0.0; co]); formas.push(vec![co]); datos.len() - 1 };
                    formas[s] = vec![1, ho, wo, co];
                    pasos.push(Paso::Conv { e: e(0), s, w: wi, b: bi, kh, kw, paso: (paso.1, paso.0), dil: (dil.1, dil.0), pad: (ph, pw), act: *act });
                }
                Op::Depthwise { relleno, paso, dil, mult, act } => {
                    let (fe, fw) = (forma4(&formas[e(0)]), formas[e(1)].clone()); // fw: [1, kh, kw, entrada*mult]
                    let (kh, kw, co) = (fw[1], fw[2], fw[3]);
                    let (ho, ph) = salida_tam(fe[1], kh, paso.1, dil.1, *relleno);
                    let (wo, pw) = salida_tam(fe[2], kw, paso.0, dil.0, *relleno);
                    let bi = if o.entradas.len() > 2 && o.entradas[2] >= 0 { e(2) } else { datos.push(vec![0.0; co]); formas.push(vec![co]); datos.len() - 1 };
                    formas[s] = vec![1, ho, wo, co];
                    pasos.push(Paso::Depthwise { e: e(0), s, w: e(1), b: bi, kh, kw, paso: (paso.1, paso.0), dil: (dil.1, dil.0), pad: (ph, pw), mult: *mult, act: *act });
                }
                Op::MaxPool { relleno, paso, filtro, .. } => {
                    let fe = forma4(&formas[e(0)]);
                    let (ho, ph) = salida_tam(fe[1], filtro.1, paso.1, 1, *relleno);
                    let (wo, pw) = salida_tam(fe[2], filtro.0, paso.0, 1, *relleno);
                    formas[s] = vec![1, ho, wo, fe[3]];
                    pasos.push(Paso::MaxPool { e: e(0), s, f: (filtro.1, filtro.0), paso: (paso.1, paso.0), pad: (ph, pw) });
                }
                Op::Add { act } | Op::Mul { act } => {
                    let (fa, fb) = (formas[e(0)].clone(), formas[e(1)].clone());
                    formas[s] = if fa.iter().product::<usize>() >= fb.iter().product::<usize>() { fa } else { fb };
                    pasos.push(if matches!(o.op, Op::Add { .. }) { Paso::Add { a: e(0), b: e(1), s, act: *act } } else { Paso::Mul { a: e(0), b: e(1), s, act: *act } });
                }
                Op::Concat { eje, .. } => {
                    let ents: Vec<usize> = o.entradas.iter().map(|&i| i as usize).collect();
                    let r = formas[ents[0]].len() as i32; let eje = if *eje < 0 { eje + r } else { *eje } as usize;
                    let mut f = formas[ents[0]].clone(); f[eje] = ents.iter().map(|&i| formas[i][eje]).sum();
                    formas[s] = f;
                    pasos.push(Paso::Concat { e: ents, s, eje });
                }
                Op::Reshape => { pasos.push(Paso::Copiar { e: e(0), s }); }
                Op::ResizeBilinear { esquinas, medio_pixel } => {
                    let fe = forma4(&formas[e(0)]); let t = &m.tensores[e(1)].enteros;
                    formas[s] = vec![1, t[0] as usize, t[1] as usize, fe[3]];
                    pasos.push(Paso::Resize { e: e(0), s, esquinas: *esquinas, medio: *medio_pixel });
                }
                Op::FullyConnected { act } => {
                    let fw = formas[e(1)].clone(); let (co, ci) = (fw[0], fw[1]);
                    // pesos [salida][entrada] → [entrada][salida]
                    let w0 = &datos[e(1)]; let mut w = vec![0f32; w0.len()];
                    for a in 0..co { for c in 0..ci { w[c * co + a] = w0[a * ci + c]; } }
                    let wi = datos.len(); datos.push(w); formas.push(vec![ci, co]);
                    let bi = if o.entradas.len() > 2 && o.entradas[2] >= 0 { e(2) } else { datos.push(vec![0.0; co]); formas.push(vec![co]); datos.len() - 1 };
                    formas[s] = vec![1, co];
                    pasos.push(Paso::Fc { e: e(0), s, w: wi, b: bi, act: *act });
                }
                Op::Pad => {
                    let fe = forma4(&formas[e(0)]); let t = &m.tensores[e(1)].enteros; let mut p = [(0usize, 0usize); 4];
                    for i in 0..4 { p[i] = (t[2 * i] as usize, t[2 * i + 1] as usize); }
                    formas[s] = (0..4).map(|i| fe[i] + p[i].0 + p[i].1).collect();
                    pasos.push(Paso::Pad { e: e(0), s, p });
                }
                Op::Logistic => { formas[s] = formas[e(0)].clone(); pasos.push(Paso::Logistic { e: e(0), s }); }
                Op::Relu | Op::Relu6 => { formas[s] = formas[e(0)].clone(); pasos.push(Paso::Relu { e: e(0), s, tope: if matches!(o.op, Op::Relu6) { 6.0 } else { f32::INFINITY } }); }
                Op::Prelu => { formas[s] = formas[e(0)].clone(); pasos.push(Paso::Prelu { e: e(0), s, alfa: e(1) }); }
                Op::Mean => {
                    let fe = forma4(&formas[e(0)]); let ejes = &m.tensores[e(1)].enteros;
                    if !(ejes.contains(&1) && ejes.contains(&2)) { return Err(format!("Mean sobre {:?}: sólo se hace el promedio espacial", ejes)); }
                    formas[s] = vec![1, fe[3]];
                    pasos.push(Paso::Mean { e: e(0), s });
                }
                otro => return Err(format!("operación que el motor no sabe hacer: {:?}", otro)),
            }
        }
        // memoria para todo lo que se calcula (una sola vez)
        for (i, f) in formas.iter().enumerate() {
            let n: usize = f.iter().product();
            if i < constante.len() && constante[i] { continue; }
            if datos[i].len() != n && (i >= m.tensores.len() || m.tensores[i].tipo == Tipo::F32 || m.tensores[i].tipo == Tipo::F16) { datos[i] = vec![0.0; n]; }
        }
        Ok(Red { formas, datos, pasos, entradas: m.entradas, salidas: m.salidas })
    }

    pub fn forma(&self, t: usize) -> &[usize] { &self.formas[t] }
    /// (n, ci, co) de cada convolución 1×1 y las operaciones totales (multiplicación + suma = 2) por tipo
    pub fn cuentas(&self) -> (Vec<(usize, usize, usize)>, f64, f64) {
        let (mut l, mut g, mut otras) = (Vec::new(), 0f64, 0f64);
        for p in &self.pasos {
            match p {
                Paso::Conv { e, s, kh, kw, .. } => { let (fe, fs) = (forma4(&self.formas[*e]), forma4(&self.formas[*s])); let ops = (fs[1] * fs[2] * fs[3] * fe[3] * kh * kw * 2) as f64;
                    if *kh == 1 && *kw == 1 { l.push((fs[1] * fs[2], fe[3], fs[3])); g += ops; } else { otras += ops; } }
                Paso::Depthwise { s, kh, kw, .. } => { let fs = forma4(&self.formas[*s]); otras += (fs[1] * fs[2] * fs[3] * kh * kw * 2) as f64; }
                _ => {}
            }
        }
        (l, g, otras)
    }
    pub fn entrada(&mut self, k: usize) -> &mut [f32] { let i = self.entradas[k]; &mut self.datos[i] }
    pub fn salida(&self, k: usize) -> &[f32] { &self.datos[self.salidas[k]] }

    /// corre la red sobre lo que ya está cargado en la entrada
    pub fn correr(&mut self) {
        for k in 0..self.pasos.len() {
            // (cada paso lee unos tensores y escribe otro: se saca la salida un momento para tener las dos cosas a la vez)
            let s = salida_de(&self.pasos[k]);
            let mut out = std::mem::take(&mut self.datos[s]);
            self.paso(k, &mut out);
            self.datos[s] = out;
        }
    }

    /// como `correr`, midiendo cuánto tarda cada tipo de capa (sólo nativo: en WebAssembly no hay reloj)
    #[cfg(not(target_arch = "wasm32"))]
    pub fn correr_midiendo(&mut self) -> Vec<(String, f64, usize)> {
        let mut t: std::collections::BTreeMap<String, (f64, usize)> = Default::default();
        for k in 0..self.pasos.len() {
            let nombre = match &self.pasos[k] {
                Paso::Conv { kh, kw, paso, .. } => format!("Conv {}x{}/{}", kh, kw, paso.0),
                Paso::Depthwise { kh, kw, paso, .. } => format!("Depthwise {}x{}/{}", kh, kw, paso.0),
                otro => format!("{:?}", otro).split(|c: char| c == ' ' || c == '{').next().unwrap().to_string(),
            };
            let s = salida_de(&self.pasos[k]);
            let mut out = std::mem::take(&mut self.datos[s]);
            let t0 = std::time::Instant::now(); self.paso(k, &mut out); let d = t0.elapsed().as_secs_f64() * 1e3;
            self.datos[s] = out;
            let e = t.entry(nombre).or_insert((0.0, 0)); e.0 += d; e.1 += 1;
        }
        let mut v: Vec<(String, f64, usize)> = t.into_iter().map(|(k, (d, n))| (k, d, n)).collect();
        v.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap()); v
    }

    fn paso(&self, k: usize, out: &mut [f32]) {
        let d = &self.datos; let f = &self.formas;
        match &self.pasos[k] {
            Paso::Conv { e, s, w, b, kh, kw, paso, dil, pad, act } => {
                conv(&d[*e], forma4(&f[*e]), &d[*w], &d[*b], out, forma4(&f[*s]), *kh, *kw, *paso, *dil, *pad, *act)
            }
            Paso::Depthwise { e, s, w, b, kh, kw, paso, dil, pad, mult, act } => {
                depthwise(&d[*e], forma4(&f[*e]), &d[*w], &d[*b], out, forma4(&f[*s]), *kh, *kw, *paso, *dil, *pad, *mult, *act)
            }
            Paso::MaxPool { e, s, f: fl, paso, pad } => {
                let (fe, fs) = (forma4(&f[*e]), forma4(&f[*s])); let (h, wd, c) = (fe[1], fe[2], fe[3]);
                for y in 0..fs[1] { for x in 0..fs[2] {
                    let o = &mut out[(y * fs[2] + x) * c..(y * fs[2] + x + 1) * c]; o.fill(f32::NEG_INFINITY);
                    for dy in 0..fl.0 { for dx in 0..fl.1 {
                        let (yy, xx) = ((y * paso.0 + dy) as isize - pad.0 as isize, (x * paso.1 + dx) as isize - pad.1 as isize);
                        if yy < 0 || xx < 0 || yy >= h as isize || xx >= wd as isize { continue; }
                        let i = &d[*e][((yy as usize) * wd + xx as usize) * c..][..c];
                        for (a, &v) in o.iter_mut().zip(i) { *a = a.max(v); }
                    } }
                } }
            }
            Paso::Add { a, b, act, .. } | Paso::Mul { a, b, act, .. } => {
                let suma = matches!(self.pasos[k], Paso::Add { .. });
                let (x, y) = (&d[*a], &d[*b]);
                let (largo, corto) = if x.len() >= y.len() { (x, y) } else { (y, x) };
                let n = corto.len().max(1);
                // (de a trozos del largo del corto: sin un % por elemento, que lo hacía 10 veces más lento)
                for (o, l) in out.chunks_exact_mut(n).zip(largo.chunks_exact(n)) {
                    if suma { for ((o, &a), &b) in o.iter_mut().zip(l).zip(corto) { *o = a + b; } } else { for ((o, &a), &b) in o.iter_mut().zip(l).zip(corto) { *o = a * b; } }
                }
                if *act != Activacion::Nada { for o in out.iter_mut() { *o = activar(*o, *act); } }
            }
            Paso::Concat { e, s, eje } => {
                let fs = &f[*s]; let exterior: usize = fs[..*eje].iter().product(); let interior: usize = fs[*eje + 1..].iter().product();
                let mut p = 0;
                for o in 0..exterior { for &t in e { let n = f[t][*eje] * interior; out[p..p + n].copy_from_slice(&d[t][o * n..(o + 1) * n]); p += n; } }
            }
            Paso::Copiar { e, .. } => out.copy_from_slice(&d[*e]),
            Paso::Resize { e, s, esquinas, medio } => {
                let (fe, fs) = (forma4(&f[*e]), forma4(&f[*s])); let (h, wd, c) = (fe[1], fe[2], fe[3]);
                let esc = |i: usize, o: usize| if *esquinas && o > 1 { (i - 1) as f32 / (o - 1) as f32 } else { i as f32 / o as f32 };
                let (ey, ex) = (esc(h, fs[1]), esc(wd, fs[2]));
                for y in 0..fs[1] {
                    let sy = if *medio { ((y as f32 + 0.5) * ey - 0.5).max(0.0) } else { y as f32 * ey };
                    let (y0, fy) = (sy.floor() as usize, sy - sy.floor()); let y0 = y0.min(h - 1); let y1 = (y0 + 1).min(h - 1);
                    for x in 0..fs[2] {
                        let sx = if *medio { ((x as f32 + 0.5) * ex - 0.5).max(0.0) } else { x as f32 * ex };
                        let (x0, fx) = (sx.floor() as usize, sx - sx.floor()); let x0 = x0.min(wd - 1); let x1 = (x0 + 1).min(wd - 1);
                        let o = &mut out[(y * fs[2] + x) * c..][..c];
                        let (a, b2, cc, dd) = (&d[*e][(y0 * wd + x0) * c..][..c], &d[*e][(y0 * wd + x1) * c..][..c], &d[*e][(y1 * wd + x0) * c..][..c], &d[*e][(y1 * wd + x1) * c..][..c]);
                        for i in 0..c { let t = a[i] + (b2[i] - a[i]) * fx; let u = cc[i] + (dd[i] - cc[i]) * fx; o[i] = t + (u - t) * fy; }
                    }
                }
            }
            Paso::Fc { e, w, b, act, .. } => {
                let (x, w, b) = (&d[*e], &d[*w], &d[*b]); let co = b.len();
                out.copy_from_slice(b);
                for (c, &v) in x.iter().enumerate() { let fila = &w[c * co..(c + 1) * co]; for (o, &p) in out.iter_mut().zip(fila) { *o += v * p; } }
                for o in out.iter_mut() { *o = activar(*o, *act); }
            }
            Paso::Pad { e, s, p } => {
                let (fe, fs) = (forma4(&f[*e]), forma4(&f[*s])); let c = fe[3];
                out.fill(0.0);
                for y in 0..fe[1] { let o = ((y + p[1].0) * fs[2] + p[2].0) * fs[3] + p[3].0;
                    if p[3] == (0, 0) { out[o..o + fe[2] * c].copy_from_slice(&d[*e][y * fe[2] * c..(y + 1) * fe[2] * c]); }
                    else { for x in 0..fe[2] { let o2 = ((y + p[1].0) * fs[2] + p[2].0 + x) * fs[3] + p[3].0; out[o2..o2 + c].copy_from_slice(&d[*e][(y * fe[2] + x) * c..][..c]); } }
                }
            }
            Paso::Logistic { e, .. } => for (o, &v) in out.iter_mut().zip(&d[*e]) { *o = 1.0 / (1.0 + (-v).exp()); },
            Paso::Relu { e, tope, .. } => for (o, &v) in out.iter_mut().zip(&d[*e]) { *o = v.clamp(0.0, *tope); },
            Paso::Prelu { e, alfa, .. } => {
                let a = &d[*alfa]; let n = a.len();
                for (o, x) in out.chunks_exact_mut(n).zip(d[*e].chunks_exact(n)) { for ((o, &v), &k) in o.iter_mut().zip(x).zip(a) { *o = if v >= 0.0 { v } else { v * k }; } }
            }
            Paso::Mean { e, s } => {
                let fe = forma4(&f[*e]); let c = fe[3]; let n = fe[1] * fe[2]; let _ = s;
                out.fill(0.0);
                for p in 0..n { for (o, &v) in out.iter_mut().zip(&d[*e][p * c..(p + 1) * c]) { *o += v; } }
                for o in out.iter_mut() { *o /= n as f32; }
            }
        }
    }
}

fn salida_de(p: &Paso) -> usize {
    match p {
        Paso::Conv { s, .. } | Paso::Depthwise { s, .. } | Paso::MaxPool { s, .. } | Paso::Add { s, .. } | Paso::Mul { s, .. } | Paso::Concat { s, .. }
        | Paso::Copiar { s, .. } | Paso::Resize { s, .. } | Paso::Fc { s, .. } | Paso::Pad { s, .. } | Paso::Logistic { s, .. } | Paso::Prelu { s, .. }
        | Paso::Relu { s, .. } | Paso::Mean { s, .. } => *s,
    }
}

/// convolución: para cada píxel de salida, suma sobre la ventana; los canales de salida van contiguos (SIMD)
#[allow(clippy::too_many_arguments)]
fn conv(x: &[f32], fe: [usize; 4], w: &[f32], b: &[f32], out: &mut [f32], fs: [usize; 4], kh: usize, kw: usize, paso: (usize, usize), dil: (usize, usize), pad: (usize, usize), act: Activacion) {
    let (h, wd, ci) = (fe[1], fe[2], fe[3]); let (ho, wo, co) = (fs[1], fs[2], fs[3]);
    if kh == 1 && kw == 1 && paso == (1, 1) {
        #[cfg(target_arch = "wasm32")]
        { if co % 4 == 0 { unsafe { simd::gemm(x, w, b, out, ho * wo, ci, co); } } else { gemm(x, w, b, out, ho * wo, ci, co); } }
        #[cfg(not(target_arch = "wasm32"))]
        gemm(x, w, b, out, ho * wo, ci, co);
    } else {
        for y in 0..ho { for xo in 0..wo {
            let o = &mut out[(y * wo + xo) * co..][..co]; o.copy_from_slice(b);
            for dy in 0..kh {
                let yy = (y * paso.0 + dy * dil.0) as isize - pad.0 as isize; if yy < 0 || yy >= h as isize { continue; }
                for dx in 0..kw {
                    let xx = (xo * paso.1 + dx * dil.1) as isize - pad.1 as isize; if xx < 0 || xx >= wd as isize { continue; }
                    let xp = &x[((yy as usize) * wd + xx as usize) * ci..][..ci]; let wb = &w[(dy * kw + dx) * ci * co..];
                    for c in 0..ci { let a = xp[c]; let fila = &wb[c * co..(c + 1) * co]; for j in 0..co { o[j] += a * fila[j]; } }
                }
            }
        } }
    }
    if act != Activacion::Nada { for v in out.iter_mut() { *v = activar(*v, act); } }
}

/// [n × ci] · [ci × co] + sesgo, con bloques de 4 filas × 16 columnas que quedan en registros (SIMD de 4: 16 registros)
fn gemm(x: &[f32], w: &[f32], b: &[f32], out: &mut [f32], n: usize, ci: usize, co: usize) {
    const F: usize = 4; const C: usize = 16;
    let mut j0 = 0;
    while j0 < co {
        let cb = C.min(co - j0);
        if cb == C {
            let bb: &[f32; C] = b[j0..j0 + C].try_into().unwrap();
            let mut p = 0;
            while p + F <= n {
                let mut acc = [[0f32; C]; F];
                for f in 0..F { acc[f] = *bb; }
                let (x0, x1, x2, x3) = (&x[p * ci..(p + 1) * ci], &x[(p + 1) * ci..(p + 2) * ci], &x[(p + 2) * ci..(p + 3) * ci], &x[(p + 3) * ci..(p + 4) * ci]);
                for c in 0..ci {
                    let wf: &[f32; C] = w[c * co + j0..c * co + j0 + C].try_into().unwrap();
                    let (a0, a1, a2, a3) = (x0[c], x1[c], x2[c], x3[c]);
                    for k in 0..C { acc[0][k] += a0 * wf[k]; acc[1][k] += a1 * wf[k]; acc[2][k] += a2 * wf[k]; acc[3][k] += a3 * wf[k]; }
                }
                for f in 0..F { out[(p + f) * co + j0..(p + f) * co + j0 + C].copy_from_slice(&acc[f]); }
                p += F;
            }
            while p < n {
                let mut acc = *bb; let xp = &x[p * ci..(p + 1) * ci];
                for c in 0..ci { let wf: &[f32; C] = w[c * co + j0..c * co + j0 + C].try_into().unwrap(); let a = xp[c]; for k in 0..C { acc[k] += a * wf[k]; } }
                out[p * co + j0..p * co + j0 + C].copy_from_slice(&acc); p += 1;
            }
        } else {
            for p in 0..n {
                let xp = &x[p * ci..(p + 1) * ci]; let o = &mut out[p * co + j0..p * co + j0 + cb]; o.copy_from_slice(&b[j0..j0 + cb]);
                for c in 0..ci { let a = xp[c]; let wf = &w[c * co + j0..c * co + j0 + cb]; for k in 0..cb { o[k] += a * wf[k]; } }
            }
        }
        j0 += cb;
    }
}

#[allow(clippy::too_many_arguments)]
fn depthwise(x: &[f32], fe: [usize; 4], w: &[f32], b: &[f32], out: &mut [f32], fs: [usize; 4], kh: usize, kw: usize, paso: (usize, usize), dil: (usize, usize), pad: (usize, usize), mult: usize, act: Activacion) {
    let (h, wd, ci) = (fe[1], fe[2], fe[3]); let (ho, wo, co) = (fs[1], fs[2], fs[3]);
    for y in 0..ho { for xo in 0..wo {
        let o = &mut out[(y * wo + xo) * co..(y * wo + xo + 1) * co]; o.copy_from_slice(b);
        let (y0, x0) = ((y * paso.0) as isize - pad.0 as isize, (xo * paso.1) as isize - pad.1 as isize);
        let adentro = mult == 1 && y0 >= 0 && x0 >= 0 && y0 as usize + (kh - 1) * dil.0 < h && x0 as usize + (kw - 1) * dil.1 < wd;
        if adentro {
            // (el caso común: toda la ventana adentro de la imagen, sin revisar bordes)
            for dy in 0..kh {
                let fila = (y0 as usize + dy * dil.0) * wd;
                for dx in 0..kw {
                    let xp = &x[(fila + x0 as usize + dx * dil.1) * ci..(fila + x0 as usize + dx * dil.1 + 1) * ci];
                    let wk = &w[(dy * kw + dx) * co..(dy * kw + dx + 1) * co];
                    #[cfg(target_arch = "wasm32")]
                    { if co % 4 == 0 { unsafe { simd::fma_fila(o, xp, wk); } continue; } }
                    for ((o, &a), &k) in o.iter_mut().zip(xp).zip(wk) { *o += a * k; }
                }
            }
            continue;
        }
        for dy in 0..kh {
            let yy = y0 + (dy * dil.0) as isize; if yy < 0 || yy >= h as isize { continue; }
            for dx in 0..kw {
                let xx = x0 + (dx * dil.1) as isize; if xx < 0 || xx >= wd as isize { continue; }
                let xp = &x[((yy as usize) * wd + xx as usize) * ci..][..ci]; let wk = &w[(dy * kw + dx) * co..][..co];
                if mult == 1 { for j in 0..co { o[j] += xp[j] * wk[j]; } } else { for j in 0..co { o[j] += xp[j / mult] * wk[j]; } }
            }
        }
    } }
    if act != Activacion::Nada { for v in out.iter_mut() { *v = activar(*v, act); } }
}

/// los kernels con SIMD explícito de WebAssembly (f32x4); con `relaxed-simd` (Chrome 114+) usan FMA
#[cfg(target_arch = "wasm32")]
mod simd {
    use core::arch::wasm32::*;
    #[inline(always)]
    unsafe fn madd(a: v128, b: v128, c: v128) -> v128 {
        #[cfg(target_feature = "relaxed-simd")] { f32x4_relaxed_madd(a, b, c) }
        #[cfg(not(target_feature = "relaxed-simd"))] { f32x4_add(f32x4_mul(a, b), c) }
    }
    #[inline(always)] unsafe fn ld(p: *const f32) -> v128 { v128_load(p as *const v128) }
    const USAR16: bool = false;
    #[inline(always)] unsafe fn st(p: *mut f32, v: v128) { v128_store(p as *mut v128, v) }

    /// o += x · w (los tres del mismo largo, múltiplo de 4)
    #[inline(always)]
    pub unsafe fn fma_fila(o: &mut [f32], x: &[f32], w: &[f32]) {
        let n = o.len(); let (po, px, pw) = (o.as_mut_ptr(), x.as_ptr(), w.as_ptr());
        let mut j = 0;
        while j < n { st(po.add(j), madd(ld(px.add(j)), ld(pw.add(j)), ld(po.add(j)))); j += 4; }
    }

    /// [n × ci] · [ci × co] + sesgo (co múltiplo de 4): bloques de 4 píxeles × 16 canales (16 acumuladores), después de
    /// 4 × 8 y 4 × 4 para lo que sobra; las filas de x que sobran (menos de 4) de a una
    pub unsafe fn gemm(x: &[f32], w: &[f32], b: &[f32], out: &mut [f32], n: usize, ci: usize, co: usize) {
        let (px, pw, pb, po) = (x.as_ptr(), w.as_ptr(), b.as_ptr(), out.as_mut_ptr());
        let mut p = 0;
        while p + 4 <= n {
            let (x0, x1, x2, x3) = (px.add(p * ci), px.add((p + 1) * ci), px.add((p + 2) * ci), px.add((p + 3) * ci));
            let mut j = 0;
            // (4 × 8: 8 acumuladores + 2 pesos + 4 copias = 14 registros: entra también en las PC con 16)
            while j + 8 <= co {
                let (b0, b1) = (ld(pb.add(j)), ld(pb.add(j + 4)));
                let mut a = [b0, b1, b0, b1, b0, b1, b0, b1];
                for c in 0..ci {
                    let wr = pw.add(c * co + j); let (w0, w1) = (ld(wr), ld(wr.add(4)));
                    let (s0, s1, s2, s3) = (f32x4_splat(*x0.add(c)), f32x4_splat(*x1.add(c)), f32x4_splat(*x2.add(c)), f32x4_splat(*x3.add(c)));
                    a[0] = madd(s0, w0, a[0]); a[1] = madd(s0, w1, a[1]); a[2] = madd(s1, w0, a[2]); a[3] = madd(s1, w1, a[3]);
                    a[4] = madd(s2, w0, a[4]); a[5] = madd(s2, w1, a[5]); a[6] = madd(s3, w0, a[6]); a[7] = madd(s3, w1, a[7]);
                }
                for f in 0..4 { let o = po.add((p + f) * co + j); st(o, a[f * 2]); st(o.add(4), a[f * 2 + 1]); }
                j += 8;
            }
            while USAR16 && j + 16 <= co {
                let (b0, b1, b2, b3) = (ld(pb.add(j)), ld(pb.add(j + 4)), ld(pb.add(j + 8)), ld(pb.add(j + 12)));
                let mut a = [b0, b1, b2, b3, b0, b1, b2, b3, b0, b1, b2, b3, b0, b1, b2, b3];
                for c in 0..ci {
                    let wr = pw.add(c * co + j);
                    let (w0, w1, w2, w3) = (ld(wr), ld(wr.add(4)), ld(wr.add(8)), ld(wr.add(12)));
                    let (s0, s1, s2, s3) = (f32x4_splat(*x0.add(c)), f32x4_splat(*x1.add(c)), f32x4_splat(*x2.add(c)), f32x4_splat(*x3.add(c)));
                    a[0] = madd(s0, w0, a[0]); a[1] = madd(s0, w1, a[1]); a[2] = madd(s0, w2, a[2]); a[3] = madd(s0, w3, a[3]);
                    a[4] = madd(s1, w0, a[4]); a[5] = madd(s1, w1, a[5]); a[6] = madd(s1, w2, a[6]); a[7] = madd(s1, w3, a[7]);
                    a[8] = madd(s2, w0, a[8]); a[9] = madd(s2, w1, a[9]); a[10] = madd(s2, w2, a[10]); a[11] = madd(s2, w3, a[11]);
                    a[12] = madd(s3, w0, a[12]); a[13] = madd(s3, w1, a[13]); a[14] = madd(s3, w2, a[14]); a[15] = madd(s3, w3, a[15]);
                }
                for f in 0..4 { let o = po.add((p + f) * co + j); st(o, a[f * 4]); st(o.add(4), a[f * 4 + 1]); st(o.add(8), a[f * 4 + 2]); st(o.add(12), a[f * 4 + 3]); }
                j += 16;
            }
            while j + 4 <= co {
                let bb = ld(pb.add(j)); let mut a = [bb; 4];
                for c in 0..ci {
                    let w0 = ld(pw.add(c * co + j));
                    a[0] = madd(f32x4_splat(*x0.add(c)), w0, a[0]); a[1] = madd(f32x4_splat(*x1.add(c)), w0, a[1]);
                    a[2] = madd(f32x4_splat(*x2.add(c)), w0, a[2]); a[3] = madd(f32x4_splat(*x3.add(c)), w0, a[3]);
                }
                for f in 0..4 { st(po.add((p + f) * co + j), a[f]); }
                j += 4;
            }
            p += 4;
        }
        while p < n {
            let xr = px.add(p * ci); let mut j = 0;
            while j + 4 <= co {
                let mut a = ld(pb.add(j));
                for c in 0..ci { a = madd(f32x4_splat(*xr.add(c)), ld(pw.add(c * co + j)), a); }
                st(po.add(p * co + j), a); j += 4;
            }
            p += 1;
        }
    }
}
