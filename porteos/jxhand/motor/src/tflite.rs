//! Lector de modelos TFLite (FlatBuffers) hecho a mano, sin dependencias: sólo lo que usan los modelos de manos de
//! MediaPipe. Lee los tensores (forma, tipo, datos), los operadores con sus opciones y las entradas y salidas del grafo.
//! Los pesos en float16 se pasan a f32 al cargar.

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Tipo { F32, F16, I32, U8, I64, I8, Otro(u8) }

#[derive(Debug, Clone)]
pub struct Tensor {
    pub nombre: String,
    pub forma: Vec<usize>,
    pub tipo: Tipo,
    /// los datos constantes (pesos, sesgos, formas), ya en f32 si eran float; vacío si se calcula al correr
    pub datos: Vec<f32>,
    pub enteros: Vec<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Activacion { Nada, Relu, Relu1, Relu6, Tanh }

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Relleno { Same, Valid }

#[derive(Debug, Clone)]
pub enum Op {
    Conv { relleno: Relleno, paso: (usize, usize), dil: (usize, usize), act: Activacion },
    Depthwise { relleno: Relleno, paso: (usize, usize), dil: (usize, usize), mult: usize, act: Activacion },
    MaxPool { relleno: Relleno, paso: (usize, usize), filtro: (usize, usize), act: Activacion },
    AvgPool { relleno: Relleno, paso: (usize, usize), filtro: (usize, usize), act: Activacion },
    Add { act: Activacion },
    Mul { act: Activacion },
    Concat { eje: i32, act: Activacion },
    Reshape,
    ResizeBilinear { esquinas: bool, medio_pixel: bool },
    FullyConnected { act: Activacion },
    Pad,
    Logistic,
    Relu,
    Relu6,
    Prelu,
    Dequantize,
    Mean,
    Otro(i32),
}

#[derive(Debug, Clone)]
pub struct Operador {
    pub op: Op,
    pub entradas: Vec<i32>,
    pub salidas: Vec<i32>,
}

#[derive(Debug, Clone)]
pub struct Modelo {
    pub tensores: Vec<Tensor>,
    pub operadores: Vec<Operador>,
    pub entradas: Vec<usize>,
    pub salidas: Vec<usize>,
}

// ---- FlatBuffers ----
struct Fb<'a> { b: &'a [u8] }
impl<'a> Fb<'a> {
    fn u8(&self, p: usize) -> u8 { self.b[p] }
    fn u16(&self, p: usize) -> u16 { u16::from_le_bytes([self.b[p], self.b[p + 1]]) }
    fn u32(&self, p: usize) -> u32 { u32::from_le_bytes(self.b[p..p + 4].try_into().unwrap()) }
    fn i32(&self, p: usize) -> i32 { self.u32(p) as i32 }
    /// dónde está el campo `i` de la tabla `t` (None si no está)
    fn campo(&self, t: usize, i: usize) -> Option<usize> {
        let vt = (t as i64 - self.i32(t) as i64) as usize;
        let largo = self.u16(vt) as usize;
        let o = 4 + 2 * i;
        if o + 2 > largo { return None; }
        let off = self.u16(vt + o) as usize;
        if off == 0 { None } else { Some(t + off) }
    }
    fn ref_(&self, p: usize) -> usize { p + self.u32(p) as usize }
    fn tabla(&self, t: usize, i: usize) -> Option<usize> { self.campo(t, i).map(|p| self.ref_(p)) }
    /// (cantidad, dónde empieza el primer elemento)
    fn vector(&self, t: usize, i: usize) -> Option<(usize, usize)> { self.tabla(t, i).map(|v| (self.u32(v) as usize, v + 4)) }
    fn tablas(&self, t: usize, i: usize) -> Vec<usize> {
        match self.vector(t, i) { Some((n, p)) => (0..n).map(|k| self.ref_(p + 4 * k)).collect(), None => vec![] }
    }
    fn enteros(&self, t: usize, i: usize) -> Vec<i32> {
        match self.vector(t, i) { Some((n, p)) => (0..n).map(|k| self.i32(p + 4 * k)).collect(), None => vec![] }
    }
    fn texto(&self, t: usize, i: usize) -> String {
        match self.vector(t, i) { Some((n, p)) => String::from_utf8_lossy(&self.b[p..p + n]).into_owned(), None => String::new() }
    }
    fn byte(&self, t: usize, i: usize, def: u8) -> u8 { self.campo(t, i).map(|p| self.u8(p)).unwrap_or(def) }
    fn int(&self, t: usize, i: usize, def: i32) -> i32 { self.campo(t, i).map(|p| self.i32(p)).unwrap_or(def) }
    fn uint(&self, t: usize, i: usize, def: u32) -> u32 { self.campo(t, i).map(|p| self.u32(p)).unwrap_or(def) }
}

pub fn f16_a_f32(h: u16) -> f32 {
    let s = ((h >> 15) & 1) as u32;
    let e = ((h >> 10) & 0x1f) as u32;
    let m = (h & 0x3ff) as u32;
    let bits = if e == 0 {
        if m == 0 { s << 31 } else {
            // subnormal: se normaliza
            let mut e2 = 127 - 15 + 1;
            let mut m2 = m;
            while m2 & 0x400 == 0 { m2 <<= 1; e2 -= 1; }
            (s << 31) | ((e2 as u32) << 23) | ((m2 & 0x3ff) << 13)
        }
    } else if e == 31 { (s << 31) | (0xff << 23) | (m << 13) } else { (s << 31) | ((e + 127 - 15) << 23) | (m << 13) };
    f32::from_bits(bits)
}

fn activacion(a: u8) -> Activacion {
    match a { 1 => Activacion::Relu, 2 => Activacion::Relu1, 3 => Activacion::Relu6, 4 => Activacion::Tanh, _ => Activacion::Nada }
}
fn relleno(p: u8) -> Relleno { if p == 1 { Relleno::Valid } else { Relleno::Same } }

pub fn leer(bytes: &[u8]) -> Result<Modelo, String> {
    if bytes.len() < 8 { return Err("archivo demasiado chico".into()); }
    if &bytes[4..8] != b"TFL3" { return Err("no es un modelo TFLite (falta TFL3)".into()); }
    let fb = Fb { b: bytes };
    let raiz = fb.ref_(0);
    // los códigos de operador: max(deprecated_builtin_code, builtin_code)
    let codigos: Vec<i32> = fb.tablas(raiz, 1).iter().map(|&c| (fb.byte(c, 0, 0) as i32).max(fb.int(c, 3, 0))).collect();
    let buffers = fb.tablas(raiz, 4);
    let sub = *fb.tablas(raiz, 2).first().ok_or("el modelo no tiene subgrafos")?;
    let mut tensores = Vec::new();
    for t in fb.tablas(sub, 0) {
        let forma: Vec<usize> = fb.enteros(t, 0).iter().map(|&d| d.max(1) as usize).collect();
        let tipo = match fb.byte(t, 1, 0) { 0 => Tipo::F32, 1 => Tipo::F16, 2 => Tipo::I32, 3 => Tipo::U8, 4 => Tipo::I64, 9 => Tipo::I8, x => Tipo::Otro(x) };
        let nb = fb.uint(t, 2, 0) as usize;
        let (mut datos, mut enteros) = (Vec::new(), Vec::new());
        if nb > 0 && nb < buffers.len() {
            if let Some((n, p)) = fb.vector(buffers[nb], 0) {
                let d = &bytes[p..p + n];
                match tipo {
                    Tipo::F32 => datos = d.chunks_exact(4).map(|c| f32::from_le_bytes(c.try_into().unwrap())).collect(),
                    Tipo::F16 => datos = d.chunks_exact(2).map(|c| f16_a_f32(u16::from_le_bytes([c[0], c[1]]))).collect(),
                    Tipo::I32 => enteros = d.chunks_exact(4).map(|c| i32::from_le_bytes(c.try_into().unwrap())).collect(),
                    Tipo::I64 => enteros = d.chunks_exact(8).map(|c| i64::from_le_bytes(c.try_into().unwrap()) as i32).collect(),
                    _ => {}
                }
            }
        }
        tensores.push(Tensor { nombre: fb.texto(t, 3), forma, tipo, datos, enteros });
    }
    let mut operadores = Vec::new();
    for o in fb.tablas(sub, 3) {
        let codigo = codigos.get(fb.uint(o, 0, 0) as usize).copied().unwrap_or(-1);
        let opt = fb.tabla(o, 4);
        let b = |i: usize, d: u8| opt.map(|t| fb.byte(t, i, d)).unwrap_or(d);
        let n = |i: usize, d: i32| opt.map(|t| fb.int(t, i, d)).unwrap_or(d);
        let op = match codigo {
            3 => Op::Conv { relleno: relleno(b(0, 0)), paso: (n(1, 1) as usize, n(2, 1) as usize), act: activacion(b(3, 0)), dil: (n(4, 1) as usize, n(5, 1) as usize) },
            4 => Op::Depthwise { relleno: relleno(b(0, 0)), paso: (n(1, 1) as usize, n(2, 1) as usize), mult: n(3, 1).max(1) as usize, act: activacion(b(4, 0)), dil: (n(5, 1) as usize, n(6, 1) as usize) },
            17 => Op::MaxPool { relleno: relleno(b(0, 0)), paso: (n(1, 1) as usize, n(2, 1) as usize), filtro: (n(3, 1) as usize, n(4, 1) as usize), act: activacion(b(5, 0)) },
            1 => Op::AvgPool { relleno: relleno(b(0, 0)), paso: (n(1, 1) as usize, n(2, 1) as usize), filtro: (n(3, 1) as usize, n(4, 1) as usize), act: activacion(b(5, 0)) },
            0 => Op::Add { act: activacion(b(0, 0)) },
            18 => Op::Mul { act: activacion(b(0, 0)) },
            2 => Op::Concat { eje: n(0, 0), act: activacion(b(1, 0)) },
            22 => Op::Reshape,
            23 => Op::ResizeBilinear { esquinas: b(2, 0) != 0, medio_pixel: b(3, 0) != 0 },
            9 => Op::FullyConnected { act: activacion(b(0, 0)) },
            34 => Op::Pad,
            14 => Op::Logistic,
            19 => Op::Relu,
            21 => Op::Relu6,
            54 => Op::Prelu,
            6 => Op::Dequantize,
            40 => Op::Mean,
            x => Op::Otro(x),
        };
        operadores.push(Operador { op, entradas: fb.enteros(o, 1), salidas: fb.enteros(o, 2) });
    }
    let entradas = fb.enteros(sub, 1).iter().map(|&i| i as usize).collect();
    let salidas = fb.enteros(sub, 2).iter().map(|&i| i as usize).collect();
    Ok(Modelo { tensores, operadores, entradas, salidas })
}
