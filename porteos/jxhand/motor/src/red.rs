//! El intérprete de la red neuronal: corre un modelo TFLite (f32, NHWC) con kernels propios pensados para que el
//! compilador los vectorice (SIMD de WebAssembly o de la PC). Al cargar se preparan los pesos en el orden que les
//! conviene a los kernels (los de las convoluciones 1×1 quedan como [entrada][salida], los demás [kh][kw][entrada][salida])
//! y se reserva toda la memoria de una vez: correr no pide memoria nueva.
use crate::hilos::{self, Puntero};
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
    /// los pesos de las convoluciones 1×1 en float16 ([entrada redondeada a 8][salida]), si el procesador hace cuentas
    /// en float16 (ARMv8.2: casi todos los celulares desde 2018); uno por paso
    #[cfg_attr(not(target_arch = "aarch64"), allow(dead_code))]
    pesos16: Vec<Option<Vec<u16>>>,
    /// la entrada de la capa pasada a float16 (se reusa)
    tmp16: Vec<u16>,
    /// copia en float16 de los tensores que sólo leen capas en float16 (los grandes, «expandidos»): la escribe la capa
    /// que los produce, cuando la salida todavía está en la caché, y las siguientes la leen directo (sin otra pasada
    /// para convertir). Vacía si el tensor no la tiene.
    sombras: Vec<Vec<u16>>,
}

/// si se usan las cuentas en float16 cuando el procesador las tiene (para comparar: se puede apagar)
pub static USAR_F16: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);

/// ¿el procesador hace cuentas en float16? (ARM de 64 bits con FEAT_FP16)
pub fn hay_f16() -> bool {
    #[cfg(target_arch = "aarch64")]
    {
        use std::sync::OnceLock;
        static HAY: OnceLock<bool> = OnceLock::new();
        *HAY.get_or_init(|| std::arch::is_aarch64_feature_detected!("fp16"))
    }
    #[cfg(not(target_arch = "aarch64"))]
    { false }
}
#[cfg_attr(not(target_arch = "aarch64"), allow(dead_code))]
fn f16_activo() -> bool { hay_f16() && USAR_F16.load(std::sync::atomic::Ordering::Relaxed) }

/// f32 → float16 (los bits), redondeando al par más cercano
pub fn a_f16(x: f32) -> u16 {
    let b = x.to_bits();
    let signo = ((b >> 16) & 0x8000) as u16;
    let exp = ((b >> 23) & 0xff) as i32; let man = b & 0x7f_ffff;
    if exp == 0xff { return signo | 0x7c00 | if man != 0 { 0x200 } else { 0 }; }
    let e = exp - 127 + 15;
    if e >= 0x1f { return signo | 0x7c00; }
    if e <= 0 {
        if e < -10 { return signo; }
        let m = man | 0x80_0000; let corr = (14 - e) as u32;
        let medio = m >> corr; let resto = m & ((1 << corr) - 1); let mitad = 1 << (corr - 1);
        let r = if resto > mitad || (resto == mitad && (medio & 1) == 1) { medio + 1 } else { medio };
        return signo | r as u16;
    }
    let medio = ((e as u32) << 10) | (man >> 13); let resto = man & 0x1fff;
    let r = if resto > 0x1000 || (resto == 0x1000 && (medio & 1) == 1) { medio + 1 } else { medio };
    signo | r as u16
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
        let mut pesos16 = Vec::with_capacity(pasos.len());
        for p in &pasos {
            let mut w16 = None;
            if hay_f16() {
                if let Paso::Conv { e, s, w, kh: 1, kw: 1, paso: (1, 1), .. } = p {
                    let (ci, co) = (forma4(&formas[*e])[3], forma4(&formas[*s])[3]);
                    if co % 8 == 0 {
                        let ci8 = ci.div_ceil(8) * 8;
                        let mut v = vec![0u16; ci8 * co];
                        for (d, &x) in v.iter_mut().zip(datos[*w].iter()) { *d = a_f16(x); }
                        w16 = Some(v);
                    }
                }
                // las depthwise: [kh·kw][canales], como vienen
                if let Paso::Depthwise { s, w, kh, kw, mult: 1, .. } = p {
                    let co = forma4(&formas[*s])[3];
                    if co % 8 == 0 && kh * kw <= 64 { w16 = Some(datos[*w].iter().map(|&x| a_f16(x)).collect()); }
                }
            }
            pesos16.push(w16);
        }
        // qué tensores tienen copia en float16: los produce una capa en float16 y sólo los leen capas en float16 (por su
        // entrada principal), con los canales en múltiplos de 8, y no son una salida de la red
        let mut sombras: Vec<Vec<u16>> = vec![Vec::new(); datos.len()];
        if hay_f16() {
            let entradas_de = |p: &Paso| -> Vec<usize> { match p {
                Paso::Conv { e, .. } | Paso::Depthwise { e, .. } | Paso::MaxPool { e, .. } | Paso::Copiar { e, .. } | Paso::Resize { e, .. } | Paso::Fc { e, .. }
                | Paso::Pad { e, .. } | Paso::Logistic { e, .. } | Paso::Prelu { e, .. } | Paso::Relu { e, .. } | Paso::Mean { e, .. } => vec![*e],
                Paso::Add { a, b, .. } | Paso::Mul { a, b, .. } => vec![*a, *b],
                Paso::Concat { e, .. } => e.clone(),
            } };
            for (k, p) in pasos.iter().enumerate() {
                if pesos16[k].is_none() { continue; }
                let t = salida_de(p);
                if m.salidas.contains(&t) || forma4(&formas[t])[3] % 8 != 0 { continue; }
                let lectores: Vec<usize> = (0..pasos.len()).filter(|&j| entradas_de(&pasos[j]).contains(&t)).collect();
                let ok = !lectores.is_empty() && lectores.iter().all(|&j| pesos16[j].is_some() && matches!(&pasos[j], Paso::Conv { e, .. } | Paso::Depthwise { e, .. } if *e == t));
                if ok { sombras[t] = vec![0u16; datos[t].len()]; }
            }
        }
        Ok(Red { formas, datos, pasos, entradas: m.entradas, salidas: m.salidas, pesos16, tmp16: Vec::new(), sombras })
    }

    pub fn forma(&self, t: usize) -> &[usize] { &self.formas[t] }
    /// (capas en float16, tensores con copia en float16)
    pub fn cuentas16(&self) -> (usize, usize) { (self.pesos16.iter().filter(|p| p.is_some()).count(), self.sombras.iter().filter(|s| !s.is_empty()).count()) }
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
        // (se decide una vez por corrida: así una capa no lee una copia en float16 vieja si se cambia en el medio)
        let f16 = f16_activo();
        for k in 0..self.pasos.len() {
            // (cada paso lee unos tensores y escribe otro: se saca la salida un momento para tener las dos cosas a la vez)
            let s = salida_de(&self.pasos[k]);
            let mut out = std::mem::take(&mut self.datos[s]);
            let mut t16 = std::mem::take(&mut self.tmp16);
            let mut s16 = std::mem::take(&mut self.sombras[s]);
            self.paso(k, &mut out, &mut t16, &mut s16, f16);
            self.sombras[s] = s16;
            self.tmp16 = t16;
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
            let mut t16 = std::mem::take(&mut self.tmp16);
            let mut s16 = std::mem::take(&mut self.sombras[s]);
            let t0 = std::time::Instant::now(); self.paso(k, &mut out, &mut t16, &mut s16, f16_activo()); let d = t0.elapsed().as_secs_f64() * 1e3;
            self.sombras[s] = s16;
            self.tmp16 = t16;
            self.datos[s] = out;
            let e = t.entry(nombre).or_insert((0.0, 0)); e.0 += d; e.1 += 1;
        }
        let mut v: Vec<(String, f64, usize)> = t.into_iter().map(|(k, (d, n))| (k, d, n)).collect();
        v.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap()); v
    }

    #[cfg_attr(not(target_arch = "aarch64"), allow(unused_variables))]
    #[allow(clippy::too_many_arguments)]
    fn paso(&self, k: usize, out: &mut [f32], t16: &mut Vec<u16>, s16: &mut [u16], f16: bool) {
        let d = &self.datos; let f = &self.formas;
        match &self.pasos[k] {
            Paso::Conv { e, s, w, b, kh, kw, paso, dil, pad, act } => {
                let (fe, fs) = (forma4(&f[*e]), forma4(&f[*s]));
                let (x, w, b, act) = (&d[*e][..], &d[*w][..], &d[*b][..], *act);
                let (ci, co) = (fe[3], fs[3]);
                let po = Puntero(out.as_mut_ptr());
                #[cfg(target_arch = "aarch64")]
                if let (Some(w16), true) = (self.pesos16[k].as_ref(), f16) {
                    // 1×1 en float16: cada trozo pasa sus filas de la entrada a float16 (si no vienen ya en float16) y
                    // multiplica de a 8 por instrucción; si la salida tiene copia en float16, la escribe ahí mismo
                    let n = fs[1] * fs[2]; let ci8 = ci.div_ceil(8) * 8;
                    let entrada16 = &self.sombras[*e];
                    let ya16 = !entrada16.is_empty() && ci8 == ci;
                    if !ya16 && t16.len() < n * ci8 { t16.resize(n * ci8, 0); }
                    let p16 = if ya16 { PunteroU16(entrada16.as_ptr() as *mut u16) } else { PunteroU16(t16.as_mut_ptr()) };
                    let ps16 = PunteroU16(s16.as_mut_ptr()); let con_sombra = !s16.is_empty();
                    let filas = filas_por_trozo(n, n * ci * co, 4);
                    let pw16 = w16.as_ptr() as usize;
                    hilos::repartir(n.div_ceil(filas), &|t| {
                        let (p0, p1) = (t * filas, ((t + 1) * filas).min(n));
                        unsafe {
                            let x16 = p16.p().add(p0 * ci8);
                            if !ya16 { for q in p0..p1 { neon16::a_medio(x.as_ptr().add(q * ci), p16.p().add(q * ci8), ci, ci8); } }
                            let o = po.parte(p0 * co, (p1 - p0) * co);
                            neon16::gemm(x16, ci8, pw16 as *const u16, co, b.as_ptr(), o.as_mut_ptr(), p1 - p0);
                            activar_todo(o, act);
                            if con_sombra { neon16::a_medio(o.as_ptr(), ps16.p().add(p0 * co), (p1 - p0) * co, (p1 - p0) * co); }
                        }
                    });
                    return;
                }
                if *kh == 1 && *kw == 1 && *paso == (1, 1) {
                    // 1×1: una multiplicación de matrices [píxeles × entrada] · [entrada × salida], repartida por píxeles
                    let n = fs[1] * fs[2];
                    let filas = filas_por_trozo(n, n * ci * co, 4);
                    hilos::repartir(n.div_ceil(filas), &|t| {
                        let (p0, p1) = (t * filas, ((t + 1) * filas).min(n));
                        // SAFETY: cada trozo escribe sus filas [p0, p1) de la salida, que no se pisan
                        let o = unsafe { po.parte(p0 * co, (p1 - p0) * co) };
                        gemm_auto(&x[p0 * ci..p1 * ci], w, b, o, p1 - p0, ci, co);
                        activar_todo(o, act);
                    });
                } else {
                    let ho = fs[1];
                    let filas = filas_por_trozo(ho, ho * fs[2] * co * ci * kh * kw, 1);
                    hilos::repartir(ho.div_ceil(filas), &|t| {
                        let (y0, y1) = (t * filas, ((t + 1) * filas).min(ho));
                        let o = unsafe { po.parte(y0 * fs[2] * co, (y1 - y0) * fs[2] * co) };
                        conv(x, fe, w, b, o, fs, *kh, *kw, *paso, *dil, *pad, act, y0, y1);
                    });
                }
            }
            Paso::Depthwise { e, s, w, b, kh, kw, paso, dil, pad, mult, act } => {
                let (fe, fs) = (forma4(&f[*e]), forma4(&f[*s]));
                let (x, w, b, act) = (&d[*e][..], &d[*w][..], &d[*b][..], *act);
                let po = Puntero(out.as_mut_ptr());
                #[cfg(target_arch = "aarch64")]
                if let (Some(w16), true, 1) = (self.pesos16[k].as_ref(), f16, *mult) {
                    // en float16: la entrada en float16 (si no viene ya así, toda, por filas y en paralelo), después cada
                    // trozo de filas de la salida con las sumas en registros, de a 32 canales
                    let (h, wd, c) = (fe[1], fe[2], fe[3]);
                    let n_in = h * wd * c;
                    let entrada16 = &self.sombras[*e];
                    let p16 = if !entrada16.is_empty() { PunteroU16(entrada16.as_ptr() as *mut u16) } else {
                        if t16.len() < n_in { t16.resize(n_in, 0); }
                        let p16 = PunteroU16(t16.as_mut_ptr());
                        let fe_ = filas_por_trozo(h, n_in * 2, 1);
                        hilos::repartir(h.div_ceil(fe_), &|t| {
                            let (a, z) = (t * fe_, ((t + 1) * fe_).min(h));
                            unsafe { neon16::a_medio(x.as_ptr().add(a * wd * c), p16.p().add(a * wd * c), (z - a) * wd * c, (z - a) * wd * c); }
                        });
                        p16
                    };
                    let ps16 = PunteroU16(s16.as_mut_ptr()); let con_sombra = !s16.is_empty();
                    let ho = fs[1];
                    let filas = filas_por_trozo(ho, ho * fs[2] * c * kh * kw * 2, 1);
                    let pw16 = w16.as_ptr() as usize;
                    hilos::repartir(ho.div_ceil(filas), &|t| {
                        let (y0, y1) = (t * filas, ((t + 1) * filas).min(ho));
                        let o = unsafe { po.parte(y0 * fs[2] * c, (y1 - y0) * fs[2] * c) };
                        unsafe { neon16::depthwise(p16.p() as *const u16, h, wd, c, pw16 as *const u16, b.as_ptr(), o.as_mut_ptr(), fs[2], *kh, *kw, *paso, *dil, *pad, y0, y1); }
                        activar_todo(o, act);
                        if con_sombra { let k0 = y0 * fs[2] * c; unsafe { neon16::a_medio(o.as_ptr(), ps16.p().add(k0), o.len(), o.len()); } }
                    });
                    return;
                }
                let ho = fs[1];
                let filas = filas_por_trozo(ho, ho * fs[2] * fs[3] * kh * kw * 4, 1);
                hilos::repartir(ho.div_ceil(filas), &|t| {
                    let (y0, y1) = (t * filas, ((t + 1) * filas).min(ho));
                    let o = unsafe { po.parte(y0 * fs[2] * fs[3], (y1 - y0) * fs[2] * fs[3]) };
                    depthwise(x, fe, w, b, o, fs, *kh, *kw, *paso, *dil, *pad, *mult, act, y0, y1);
                });
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
                let act = *act;
                // (de a trozos del largo del corto: sin un % por elemento, que lo hacía 10 veces más lento; los trozos
                // se reparten entre los hilos)
                elemento_a_elemento(out, n, &|o: &mut [f32], desde: usize| {
                    let l = &largo[desde..desde + o.len()];
                    for (o, l) in o.chunks_exact_mut(n).zip(l.chunks_exact(n)) {
                        if suma { for ((o, &a), &b) in o.iter_mut().zip(l).zip(corto) { *o = a + b; } } else { for ((o, &a), &b) in o.iter_mut().zip(l).zip(corto) { *o = a * b; } }
                    }
                    activar_todo(o, act);
                });
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
            Paso::Relu { e, tope, .. } => { let (x, tope) = (&d[*e], *tope); elemento_a_elemento(out, 1, &|o: &mut [f32], desde: usize| for (o, &v) in o.iter_mut().zip(&x[desde..]) { *o = v.clamp(0.0, tope); }); }
            Paso::Prelu { e, alfa, .. } => {
                let (a, x) = (&d[*alfa], &d[*e]); let n = a.len().max(1);
                elemento_a_elemento(out, n, &|o: &mut [f32], desde: usize| {
                    for (o, x) in o.chunks_exact_mut(n).zip(x[desde..].chunks_exact(n)) { for ((o, &v), &k) in o.iter_mut().zip(x).zip(a) { *o = if v >= 0.0 { v } else { v * k }; } }
                });
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

/// cuántas filas por trozo: unos 3 trozos por hilo (así los rápidos se llevan más), múltiplo de `de_a`, y nada de
/// repartir si la capa es tan chica que repartirla cuesta más que hacerla (`trabajo`: multiplicaciones aproximadas)
fn filas_por_trozo(filas: usize, trabajo: usize, de_a: usize) -> usize {
    let h = hilos::cuantos();
    if h <= 1 || trabajo < 150_000 { return filas.max(1); }
    let t = filas.div_ceil(h * 3).max(1);
    t.div_ceil(de_a) * de_a
}

/// una operación elemento a elemento sobre `out`, repartida en trozos que son múltiplo de `bloque` (el largo de lo que se
/// repite, como los canales de un PReLU); `f(trozo, desde)` hace el trozo que empieza en la posición `desde`
fn elemento_a_elemento(out: &mut [f32], bloque: usize, f: &(dyn Fn(&mut [f32], usize) + Sync)) {
    let total = out.len(); let filas = total / bloque.max(1);
    let por = filas_por_trozo(filas, total * 6, 1) * bloque;
    if por >= total { return f(out, 0); }
    let po = Puntero(out.as_mut_ptr());
    hilos::repartir(total.div_ceil(por), &|t| {
        let (a, b) = (t * por, ((t + 1) * por).min(total));
        f(unsafe { po.parte(a, b - a) }, a);
    });
}

fn activar_todo(o: &mut [f32], act: Activacion) { if act != Activacion::Nada { for v in o.iter_mut() { *v = activar(*v, act); } } }

/// [n × ci] · [ci × co] + sesgo con el mejor kernel que haya: NEON en ARM de 64 bits, SIMD en WebAssembly, y si no el
/// genérico (que el compilador vectoriza con lo que tenga la PC)
#[inline]
fn gemm_auto(x: &[f32], w: &[f32], b: &[f32], out: &mut [f32], n: usize, ci: usize, co: usize) {
    #[cfg(target_arch = "aarch64")]
    { if co % 4 == 0 { unsafe { neon::gemm(x, w, b, out, n, ci, co); } return; } }
    #[cfg(target_arch = "wasm32")]
    { if co % 4 == 0 { unsafe { simd::gemm(x, w, b, out, n, ci, co); } return; } }
    gemm(x, w, b, out, n, ci, co)
}

/// o += x · w (fila de canales)
#[inline(always)]
fn fma_fila_auto(o: &mut [f32], x: &[f32], w: &[f32]) {
    #[cfg(target_arch = "aarch64")]
    { if o.len() % 4 == 0 { unsafe { neon::fma_fila(o, x, w); } return; } }
    #[cfg(target_arch = "wasm32")]
    { if o.len() % 4 == 0 { unsafe { simd::fma_fila(o, x, w); } return; } }
    for ((o, &a), &k) in o.iter_mut().zip(x).zip(w) { *o += a * k; }
}

/// convolución general (no 1×1), filas de salida [y0, y1) en `out` (que empieza en la fila y0): para cada píxel de
/// salida suma sobre la ventana; los canales de salida van contiguos (SIMD)
#[allow(clippy::too_many_arguments)]
fn conv(x: &[f32], fe: [usize; 4], w: &[f32], b: &[f32], out: &mut [f32], fs: [usize; 4], kh: usize, kw: usize, paso: (usize, usize), dil: (usize, usize), pad: (usize, usize), act: Activacion, y0: usize, y1: usize) {
    let (h, wd, ci) = (fe[1], fe[2], fe[3]); let (wo, co) = (fs[2], fs[3]);
    #[cfg(target_arch = "aarch64")]
    {
        // con NEON: las sumas de cada píxel quedan en registros (4·K canales) y se escriben una vez
        let r = unsafe { match co {
            16 => { neon::conv::<4>(x, fe, w, b, out, fs, kh, kw, paso, dil, pad, y0, y1); true }
            24 => { neon::conv::<6>(x, fe, w, b, out, fs, kh, kw, paso, dil, pad, y0, y1); true }
            32 => { neon::conv::<8>(x, fe, w, b, out, fs, kh, kw, paso, dil, pad, y0, y1); true }
            48 => { neon::conv::<12>(x, fe, w, b, out, fs, kh, kw, paso, dil, pad, y0, y1); true }
            64 => { neon::conv::<16>(x, fe, w, b, out, fs, kh, kw, paso, dil, pad, y0, y1); true }
            _ => false,
        } };
        if r { activar_todo(out, act); return; }
    }
    for y in y0..y1 { for xo in 0..wo {
        let o = &mut out[((y - y0) * wo + xo) * co..][..co]; o.copy_from_slice(b);
        for dy in 0..kh {
            let yy = (y * paso.0 + dy * dil.0) as isize - pad.0 as isize; if yy < 0 || yy >= h as isize { continue; }
            for dx in 0..kw {
                let xx = (xo * paso.1 + dx * dil.1) as isize - pad.1 as isize; if xx < 0 || xx >= wd as isize { continue; }
                let xp = &x[((yy as usize) * wd + xx as usize) * ci..][..ci]; let wb = &w[(dy * kw + dx) * ci * co..];
                for c in 0..ci { let a = xp[c]; let fila = &wb[c * co..(c + 1) * co]; for j in 0..co { o[j] += a * fila[j]; } }
            }
        }
    } }
    activar_todo(out, act);
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

/// depthwise (cada canal con su ventana), filas de salida [y0, y1) en `out` (que empieza en la fila y0)
#[allow(clippy::too_many_arguments)]
fn depthwise(x: &[f32], fe: [usize; 4], w: &[f32], b: &[f32], out: &mut [f32], fs: [usize; 4], kh: usize, kw: usize, paso: (usize, usize), dil: (usize, usize), pad: (usize, usize), mult: usize, act: Activacion, ya: usize, yb: usize) {
    let (h, wd, ci) = (fe[1], fe[2], fe[3]); let (wo, co) = (fs[2], fs[3]);
    for y in ya..yb { for xo in 0..wo {
        let o = &mut out[((y - ya) * wo + xo) * co..((y - ya) * wo + xo + 1) * co]; o.copy_from_slice(b);
        let (y0, x0) = ((y * paso.0) as isize - pad.0 as isize, (xo * paso.1) as isize - pad.1 as isize);
        let adentro = mult == 1 && y0 >= 0 && x0 >= 0 && y0 as usize + (kh - 1) * dil.0 < h && x0 as usize + (kw - 1) * dil.1 < wd;
        if adentro {
            // (el caso común: toda la ventana adentro de la imagen, sin revisar bordes)
            for dy in 0..kh {
                let fila = (y0 as usize + dy * dil.0) * wd;
                for dx in 0..kw {
                    let xp = &x[(fila + x0 as usize + dx * dil.1) * ci..(fila + x0 as usize + dx * dil.1 + 1) * ci];
                    let wk = &w[(dy * kw + dx) * co..(dy * kw + dx + 1) * co];
                    fma_fila_auto(o, xp, wk);
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
    activar_todo(out, act);
}

#[derive(Clone, Copy)]
struct PunteroU16(*mut u16);
unsafe impl Send for PunteroU16 {}
unsafe impl Sync for PunteroU16 {}
impl PunteroU16 { #[allow(dead_code)] fn p(self) -> *mut u16 { self.0 } }

/// las cuentas en float16 (ARMv8.2, FEAT_FP16): el doble de números por instrucción que en float32. Las sumas se hacen
/// en float16 de a bloques de 128 canales y cada bloque se pasa a float32 para seguir sumando (así no se pierde
/// precisión en las capas con muchos canales). La entrada y los pesos se redondean a float16 (11 bits de mantisa).
#[cfg(target_arch = "aarch64")]
mod neon16 {
    use core::arch::aarch64::*;
    use core::arch::asm;

    /// una fila de `n` floats a float16, rellenando con ceros hasta `n8`
    #[target_feature(enable = "fp16")]
    pub unsafe fn a_medio(src: *const f32, dst: *mut u16, n: usize, n8: usize) {
        let mut i = 0;
        while i + 8 <= n {
            let (a, b) = (vld1q_f32(src.add(i)), vld1q_f32(src.add(i + 4)));
            let o: float32x4_t;
            asm!("fcvtn {o:v}.4h, {a:v}.4s", "fcvtn2 {o:v}.8h, {b:v}.4s", a = in(vreg) a, b = in(vreg) b, o = out(vreg) o, options(pure, nomem, nostack));
            vst1q_f32(dst.add(i) as *mut f32, o);
            i += 8;
        }
        while i < n { *dst.add(i) = super::a_f16(*src.add(i)); i += 1; }
        while i < n8 { *dst.add(i) = 0; i += 1; }
    }

    macro_rules! fmla { ($acc:expr, $w:expr, $x:expr, $l:literal) => {
        asm!("fmla {a:v}.8h, {w:v}.8h, {x:v}.h[{l}]", a = inout(vreg) $acc, w = in(vreg) $w, x = in(vreg_low16) $x, l = const $l, options(pure, nomem, nostack));
    } }

    /// suma el acumulador de float16 (8 valores) a la salida en float32 (o la inicia con el sesgo)
    #[inline(always)]
    unsafe fn volcar(acc: float32x4_t, o: *mut f32, b: *const f32, primero: bool) {
        let (lo, hi): (float32x4_t, float32x4_t);
        asm!("fcvtl {lo:v}.4s, {a:v}.4h", "fcvtl2 {hi:v}.4s, {a:v}.8h", a = in(vreg) acc, lo = out(vreg) lo, hi = out(vreg) hi, options(pure, nomem, nostack));
        let (b0, b1) = if primero { (vld1q_f32(b), vld1q_f32(b.add(4))) } else { (vld1q_f32(o), vld1q_f32(o.add(4))) };
        vst1q_f32(o, vaddq_f32(b0, lo)); vst1q_f32(o.add(4), vaddq_f32(b1, hi));
    }

    // (medido con qemu: con bloques de 32 el error baja de 0,51 % a 0,41 % de la palma, casi nada: el error viene de
    // redondear a float16, no de las sumas; con 128 se vuelca menos seguido)
    const BLOQUE: usize = 128;

    macro_rules! fmla_v { ($acc:expr, $x:expr, $w:expr) => {
        asm!("fmla {a:v}.8h, {x:v}.8h, {w:v}.8h", a = inout(vreg) $acc, x = in(vreg) $x, w = in(vreg) $w, options(pure, nomem, nostack));
    } }

    /// depthwise en float16: entrada [h × wd × c] en float16, pesos [kh·kw][c] en float16, salida (filas [ya, yb)) en
    /// float32 con el sesgo. c múltiplo de 8; kh·kw ≤ 64.
    #[target_feature(enable = "fp16")]
    #[allow(clippy::too_many_arguments)]
    pub unsafe fn depthwise(x: *const u16, h: usize, wd: usize, c: usize, w: *const u16, b: *const f32, out: *mut f32, wo: usize,
                            kh: usize, kw: usize, paso: (usize, usize), dil: (usize, usize), pad: (usize, usize), ya: usize, yb: usize) {
        let z = vdupq_n_f32(0.0);
        let mut toques = [(0usize, 0usize); 64];
        let ld = |p: *const u16| vld1q_f32(p as *const f32);
        for y in ya..yb {
            for xo in 0..wo {
                let o = out.add(((y - ya) * wo + xo) * c);
                // las partes de la ventana que caen adentro de la imagen
                let (y0, x0) = ((y * paso.0) as isize - pad.0 as isize, (xo * paso.1) as isize - pad.1 as isize);
                let mut n = 0;
                for dy in 0..kh {
                    let yy = y0 + (dy * dil.0) as isize; if yy < 0 || yy >= h as isize { continue; }
                    for dx in 0..kw {
                        let xx = x0 + (dx * dil.1) as isize; if xx < 0 || xx >= wd as isize { continue; }
                        toques[n] = (((yy as usize) * wd + xx as usize) * c, (dy * kw + dx) * c); n += 1;
                    }
                }
                let mut j = 0;
                while j + 32 <= c {
                    let (mut a0, mut a1, mut a2, mut a3) = (z, z, z, z);
                    for &(xi, wi) in &toques[..n] {
                        let (xp, wp) = (x.add(xi + j), w.add(wi + j));
                        fmla_v!(a0, ld(xp), ld(wp)); fmla_v!(a1, ld(xp.add(8)), ld(wp.add(8)));
                        fmla_v!(a2, ld(xp.add(16)), ld(wp.add(16))); fmla_v!(a3, ld(xp.add(24)), ld(wp.add(24)));
                    }
                    volcar(a0, o.add(j), b.add(j), true); volcar(a1, o.add(j + 8), b.add(j + 8), true);
                    volcar(a2, o.add(j + 16), b.add(j + 16), true); volcar(a3, o.add(j + 24), b.add(j + 24), true);
                    j += 32;
                }
                while j < c {
                    let mut a0 = z;
                    for &(xi, wi) in &toques[..n] { fmla_v!(a0, ld(x.add(xi + j)), ld(w.add(wi + j))); }
                    volcar(a0, o.add(j), b.add(j), true);
                    j += 8;
                }
            }
        }
    }

    /// [n × ci8] (float16) · [ci8 × co] (float16) + sesgo → [n × co] float32. co múltiplo de 8, ci8 de 8.
    #[target_feature(enable = "fp16")]
    pub unsafe fn gemm(x: *const u16, ci8: usize, w: *const u16, co: usize, b: *const f32, out: *mut f32, n: usize) {
        let z = vdupq_n_f32(0.0);
        let mut p = 0;
        while p + 4 <= n {
            let xs = [x.add(p * ci8), x.add((p + 1) * ci8), x.add((p + 2) * ci8), x.add((p + 3) * ci8)];
            let mut j = 0;
            while j < co {
                let ancho2 = j + 16 <= co; // 16 canales (dos registros) o los últimos 8
                let mut kb = 0;
                while kb < ci8 {
                    let fin = (kb + BLOQUE).min(ci8);
                    let (mut a0, mut a1, mut a2, mut a3, mut c0, mut c1, mut c2, mut c3) = (z, z, z, z, z, z, z, z);
                    let mut c = kb;
                    while c < fin {
                        let x0 = vld1q_f32(xs[0].add(c) as *const f32); let x1 = vld1q_f32(xs[1].add(c) as *const f32);
                        let x2 = vld1q_f32(xs[2].add(c) as *const f32); let x3 = vld1q_f32(xs[3].add(c) as *const f32);
                        macro_rules! carril { ($l:literal) => {{
                            let wr = w.add((c + $l) * co + j);
                            let w0 = vld1q_f32(wr as *const f32);
                            fmla!(a0, w0, x0, $l); fmla!(a1, w0, x1, $l); fmla!(a2, w0, x2, $l); fmla!(a3, w0, x3, $l);
                            if ancho2 {
                                let w1 = vld1q_f32(wr.add(8) as *const f32);
                                fmla!(c0, w1, x0, $l); fmla!(c1, w1, x1, $l); fmla!(c2, w1, x2, $l); fmla!(c3, w1, x3, $l);
                            }
                        }}; }
                        carril!(0); carril!(1); carril!(2); carril!(3); carril!(4); carril!(5); carril!(6); carril!(7);
                        c += 8;
                    }
                    let primero = kb == 0;
                    let os = [out.add(p * co + j), out.add((p + 1) * co + j), out.add((p + 2) * co + j), out.add((p + 3) * co + j)];
                    volcar(a0, os[0], b.add(j), primero); volcar(a1, os[1], b.add(j), primero); volcar(a2, os[2], b.add(j), primero); volcar(a3, os[3], b.add(j), primero);
                    if ancho2 {
                        volcar(c0, os[0].add(8), b.add(j + 8), primero); volcar(c1, os[1].add(8), b.add(j + 8), primero);
                        volcar(c2, os[2].add(8), b.add(j + 8), primero); volcar(c3, os[3].add(8), b.add(j + 8), primero);
                    }
                    kb = fin;
                }
                j += if ancho2 { 16 } else { 8 };
            }
            p += 4;
        }
        // las filas que sobran, de a una
        while p < n {
            let xr = x.add(p * ci8);
            let mut j = 0;
            while j < co {
                let mut kb = 0;
                while kb < ci8 {
                    let fin = (kb + BLOQUE).min(ci8);
                    let mut a0 = z; let mut c = kb;
                    while c < fin {
                        let x0 = vld1q_f32(xr.add(c) as *const f32);
                        macro_rules! carril1 { ($l:literal) => {{ let w0 = vld1q_f32(w.add((c + $l) * co + j) as *const f32); fmla!(a0, w0, x0, $l); }}; }
                        carril1!(0); carril1!(1); carril1!(2); carril1!(3); carril1!(4); carril1!(5); carril1!(6); carril1!(7);
                        c += 8;
                    }
                    volcar(a0, out.add(p * co + j), b.add(j), kb == 0);
                    kb = fin;
                }
                j += 8;
            }
            p += 1;
        }
    }
}

/// los kernels con NEON de ARM de 64 bits (todos los celulares de los últimos años): FMA de 4 en 4, y el producto de
/// matrices en bloques de 4 píxeles × 16 canales con el valor de cada píxel tomado de un carril del registro (sin
/// copiarlo a los 4): 16 acumuladores + 4 pesos + 4 entradas = 24 de los 32 registros
#[cfg(target_arch = "aarch64")]
mod neon {
    use core::arch::aarch64::*;

    /// o += x · w (largo múltiplo de 4)
    #[inline(always)]
    pub unsafe fn fma_fila(o: &mut [f32], x: &[f32], w: &[f32]) {
        let n = o.len(); let (po, px, pw) = (o.as_mut_ptr(), x.as_ptr(), w.as_ptr());
        let mut j = 0;
        while j + 8 <= n {
            let (a0, a1) = (vld1q_f32(po.add(j)), vld1q_f32(po.add(j + 4)));
            vst1q_f32(po.add(j), vfmaq_f32(a0, vld1q_f32(px.add(j)), vld1q_f32(pw.add(j))));
            vst1q_f32(po.add(j + 4), vfmaq_f32(a1, vld1q_f32(px.add(j + 4)), vld1q_f32(pw.add(j + 4))));
            j += 8;
        }
        while j < n { vst1q_f32(po.add(j), vfmaq_f32(vld1q_f32(po.add(j)), vld1q_f32(px.add(j)), vld1q_f32(pw.add(j)))); j += 4; }
    }

    /// un bloque de 4 píxeles × (4·K) canales a partir del canal j
    #[inline(always)]
    unsafe fn bloque<const K: usize>(xs: [*const f32; 4], pw: *const f32, pb: *const f32, po: [*mut f32; 4], ci: usize, co: usize, j: usize) {
        let mut acc = [[vdupq_n_f32(0.0); K]; 4];
        for k in 0..K { let bk = vld1q_f32(pb.add(j + 4 * k)); for r in 0..4 { acc[r][k] = bk; } }
        let mut c = 0;
        while c + 4 <= ci {
            let a = [vld1q_f32(xs[0].add(c)), vld1q_f32(xs[1].add(c)), vld1q_f32(xs[2].add(c)), vld1q_f32(xs[3].add(c))];
            macro_rules! carril { ($l:literal) => {{
                let wr = pw.add((c + $l) * co + j);
                let mut wv = [vdupq_n_f32(0.0); K];
                for k in 0..K { wv[k] = vld1q_f32(wr.add(4 * k)); }
                for r in 0..4 { for k in 0..K { acc[r][k] = vfmaq_laneq_f32::<$l>(acc[r][k], wv[k], a[r]); } }
            }}; }
            carril!(0); carril!(1); carril!(2); carril!(3);
            c += 4;
        }
        while c < ci {
            let wr = pw.add(c * co + j);
            for k in 0..K { let wv = vld1q_f32(wr.add(4 * k)); for r in 0..4 { acc[r][k] = vfmaq_n_f32(acc[r][k], wv, *xs[r].add(c)); } }
            c += 1;
        }
        for r in 0..4 { for k in 0..K { vst1q_f32(po[r].add(j + 4 * k), acc[r][k]); } }
    }

    /// convolución general con 4·K canales de salida: las sumas de cada píxel en K registros
    #[allow(clippy::too_many_arguments)]
    pub unsafe fn conv<const K: usize>(x: &[f32], fe: [usize; 4], w: &[f32], b: &[f32], out: &mut [f32], fs: [usize; 4], kh: usize, kw: usize,
                                       paso: (usize, usize), dil: (usize, usize), pad: (usize, usize), y0: usize, y1: usize) {
        let (h, wd, ci) = (fe[1], fe[2], fe[3]); let (wo, co) = (fs[2], fs[3]);
        let (px, pw, pb, po) = (x.as_ptr(), w.as_ptr(), b.as_ptr(), out.as_mut_ptr());
        for y in y0..y1 { for xo in 0..wo {
            let mut acc = [vdupq_n_f32(0.0); K];
            for k in 0..K { acc[k] = vld1q_f32(pb.add(4 * k)); }
            for dy in 0..kh {
                let yy = (y * paso.0 + dy * dil.0) as isize - pad.0 as isize; if yy < 0 || yy >= h as isize { continue; }
                for dx in 0..kw {
                    let xx = (xo * paso.1 + dx * dil.1) as isize - pad.1 as isize; if xx < 0 || xx >= wd as isize { continue; }
                    let xp = px.add(((yy as usize) * wd + xx as usize) * ci); let wb = pw.add((dy * kw + dx) * ci * co);
                    for c in 0..ci {
                        let a = *xp.add(c); let wr = wb.add(c * co);
                        for k in 0..K { acc[k] = vfmaq_n_f32(acc[k], vld1q_f32(wr.add(4 * k)), a); }
                    }
                }
            }
            let o = po.add(((y - y0) * wo + xo) * co);
            for k in 0..K { vst1q_f32(o.add(4 * k), acc[k]); }
        } }
    }

    /// [n × ci] · [ci × co] + sesgo (co múltiplo de 4)
    pub unsafe fn gemm(x: &[f32], w: &[f32], b: &[f32], out: &mut [f32], n: usize, ci: usize, co: usize) {
        let (px, pw, pb, po) = (x.as_ptr(), w.as_ptr(), b.as_ptr(), out.as_mut_ptr());
        let mut p = 0;
        while p + 4 <= n {
            let xs = [px.add(p * ci), px.add((p + 1) * ci), px.add((p + 2) * ci), px.add((p + 3) * ci)];
            let os = [po.add(p * co), po.add((p + 1) * co), po.add((p + 2) * co), po.add((p + 3) * co)];
            let mut j = 0;
            while j + 16 <= co { bloque::<4>(xs, pw, pb, os, ci, co, j); j += 16; }
            while j + 8 <= co { bloque::<2>(xs, pw, pb, os, ci, co, j); j += 8; }
            while j + 4 <= co { bloque::<1>(xs, pw, pb, os, ci, co, j); j += 4; }
            p += 4;
        }
        while p < n {
            let xr = px.add(p * ci); let mut j = 0;
            while j + 4 <= co {
                let mut a = vld1q_f32(pb.add(j));
                for c in 0..ci { a = vfmaq_n_f32(a, vld1q_f32(pw.add(c * co + j)), *xr.add(c)); }
                vst1q_f32(po.add(p * co + j), a); j += 4;
            }
            p += 1;
        }
    }
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
