//! El pincel de los menús: dibujo 2D sobre la pasada de interfaz del motor (triángulos con textura y color por vértice: x, y,
//! u, v, r, g, b, a). Lo de la web que necesitan los menús (clasico.js, paneles.js): placas, rayas, polígonos (las puntas
//! rotas), degradés (las sombras), la letra condensada del menú (Oswald) y la de los textos con su interletra, los íconos
//! pintados al tamaño justo (iconos.rs), el grano que se repite cada 160 px (el mismo ruido que clTexturas, con la misma
//! semilla) y las fotos. Todo sale en tandas por textura, en el orden en que se dibuja (lo de arriba tapa lo de abajo), con
//! un recorte (lo que se baja en una lista), una transformación (las animaciones: correr, agrandar, inclinar) y una
//! opacidad general.
use std::collections::HashMap;
use jxmotor::escena::{Cabecera, Escena, Tex};
use crate::motor::Motor3d;

/// el atlas de los menús: las letras (herramientas/atlas_menus.py), lo liso, el disco, el grano y las rasgaduras
pub const TEX_MENUS: i64 = -2100;
/// los íconos, pintados al tamaño en que se ven
pub const TEX_ICOS: i64 = -2101;
/// las fotos (fondos, logo, mapas, personajes): TEX_FOTOS - k
pub const TEX_FOTOS: i64 = -2200;

pub type Col = [f32; 4];
/// un color de la web (#rrggbb y opacidad)
pub const fn rgba(c: u32, a: f32) -> Col { [((c >> 16) & 255) as f32 / 255.0, ((c >> 8) & 255) as f32 / 255.0, (c & 255) as f32 / 255.0, a] }
pub fn con_a(c: Col, a: f32) -> Col { [c[0], c[1], c[2], c[3] * a] }

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Cara { O5, O6, S4, S7 }
struct Fuente { tam: f32, asc: f32, desc: f32, c: HashMap<char, [f32; 7]>, k: HashMap<(char, char), f32> }

/// el generador de clasico.js (clAzar: el LCG de Numerical Recipes), para que las rasgaduras y el grano sean los de la web
pub struct Azar(u32);
impl Azar {
    pub fn nuevo(s: u32) -> Azar { Azar(s) }
    pub fn sig(&mut self) -> f32 { self.0 = self.0.wrapping_mul(1664525).wrapping_add(1013904223); (self.0 as f64 / 4294967296.0) as f32 }
}

/// el atlas armado: las medidas de las letras y dónde quedó cada pieza (en píxeles del atlas)
pub struct Atlas { pub w: u32, pub h: u32, blanco: [f32; 2], disco: [f32; 4], anillo: [f32; 4], caras: Vec<Fuente>, pub reg: HashMap<&'static str, [f32; 4]>,
    /// el alfa de las letras de menus.png (ancho, alto, píxeles): de ahí se pintan al tamaño en que se ven
    letras: (u32, u32, Vec<u8>),
    /// (las puntas rotas de la web, en sus unidades: para lo que se toca y las pruebas)
    pub puntas: Vec<Vec<[f32; 2]>>, pub punta_chip: Vec<[f32; 2]>, pub logo_m: Vec<[f32; 2]> }

/// las rasgaduras de clTexturas (clasico.js), con la misma semilla y en el mismo orden: las 4 puntas de las barras (48 × 100),
/// la de las placas chicas (24 × 100), la esquina rota del logo (100 × 100), la cinta y los tramos de la línea gastada
pub struct Rasgaduras { pub puntas: Vec<Vec<[f32; 2]>>, pub chip: Vec<[f32; 2]>, pub logo: Vec<[f32; 2]>, pub cinta: Vec<[f32; 2]>, pub linea: Vec<([f32; 4], f32)> }
pub fn rasgaduras() -> Rasgaduras {
    let mut r = Azar::nuevo(0x4a584d);
    let punta = |r: &mut Azar, an: f32, hondo: f32, mella: f32, n: f32| -> Vec<[f32; 2]> {
        let mut p = vec![[0.0, 0.0]];
        let mut x = 4.0; while x < an - hondo { let y = if r.sig() < 0.35 { r.sig() * mella } else { 0.0 }; p.push([x, y]); x += 4.0 + r.sig() * 7.0; }
        let mut y = 0.0; while y < 100.0 { p.push([an - hondo * (0.15 + 0.85 * r.sig()), y]); y += 5.0 + r.sig() * n; }
        p.push([an - hondo * (0.2 + 0.8 * r.sig()), 100.0]);
        let mut x = an - hondo; while x > 4.0 { let y = if r.sig() < 0.35 { 100.0 - r.sig() * mella } else { 100.0 }; p.push([x, y]); x -= 4.0 + r.sig() * 7.0; }
        p.push([0.0, 100.0]); p
    };
    let puntas = (0..4).map(|_| punta(&mut r, 48.0, 13.0, 3.0, 11.0)).collect();
    let chip = punta(&mut r, 24.0, 6.0, 4.0, 18.0);
    let mut logo = vec![[0.0, 0.0], [60.5, 0.0], [61.4, 11.5], [62.3, 9.4], [63.6, 13.2], [64.8, 0.0], [100.0, 0.0], [100.0, 58.0]];
    let mut y = 58.0; while y < 100.0 { logo.push([100.0 - (y - 58.0) * 0.22 - r.sig() * 4.5, y]); y += 3.0 + r.sig() * 5.0; }
    logo.push([86.0, 100.0]); logo.push([0.0, 100.0]);
    let mut cinta = vec![[0.0, 8.0]]; let mut y = 0.0; while y <= 100.0 { cinta.push([4.0 + r.sig() * 5.0, y]); y += 12.5; }
    let mut q = vec![]; let mut y = 100.0; while y >= 0.0 { q.push([95.0 - r.sig() * 5.0, y]); y -= 12.5; } cinta.extend(q);
    let mut linea = vec![]; let mut x = 0.0;
    while x < 100.0 { let l = 2.0 + r.sig() * 14.0; let a = if r.sig() < 0.12 { 0.35 } else { 1.0 }; let y = r.sig() * 12.0; let h = 88.0 - r.sig() * 20.0; linea.push(([x, y, l, h], a)); x += l + if r.sig() < 0.3 { 0.6 + r.sig() * 2.2 } else { 0.0 }; }
    Rasgaduras { puntas, chip, logo, cinta, linea }
}

/// el grano de clTexturas: 160 × 160 de puntitos claros y oscuros casi transparentes y 9 raspones en diagonal (RGBA)
pub fn grano() -> Vec<u8> {
    const N: usize = 160; let mut d = vec![0u8; N * N * 4]; let mut r2 = Azar::nuevo(0x6772616e);
    for i in 0..N * N { let r = r2.sig(); let j = i * 4;
        if r < 0.085 { d[j] = 255; d[j + 1] = 255; d[j + 2] = 255; d[j + 3] = (10.0 + r2.sig() * 30.0) as u8; }
        else if r < 0.19 { d[j + 3] = (16.0 + r2.sig() * 30.0) as u8; } }
    // (las rayas: un trazo de canvas con punta redonda, de 0,5 a 1,3 px, también del otro lado del borde para que se repita)
    for k in 0..9 {
        let (x, y, l, a) = (r2.sig() * N as f32, r2.sig() * N as f32, 24.0 + r2.sig() * 70.0, -0.5 + r2.sig() * 0.3); let claro = k % 3 != 2;
        let al = if claro { 0.05 + r2.sig() * 0.06 } else { 0.12 + r2.sig() * 0.1 }; let gw = 0.5 + r2.sig() * 0.8;
        for (ox, oy) in [(0.0, 0.0), (-(N as f32), 0.0), (N as f32, 0.0), (0.0, -(N as f32)), (0.0, N as f32)] {
            let (ax, ay) = (x + ox, y + oy); let (bx, by) = (ax + a.cos() * l, ay + a.sin() * l);
            let (x0, x1) = ((ax.min(bx) - 2.0).max(0.0) as usize, ((ax.max(bx) + 2.0).min(N as f32 - 1.0)).max(0.0) as usize);
            let (y0, y1) = ((ay.min(by) - 2.0).max(0.0) as usize, ((ay.max(by) + 2.0).min(N as f32 - 1.0)).max(0.0) as usize);
            if x0 > x1 || y0 > y1 { continue; }
            for py in y0..=y1 { for px in x0..=x1 {
                let dd = dist_seg([px as f32 + 0.5, py as f32 + 0.5], [ax, ay], [bx, by]); let cob = (gw / 2.0 - dd + 0.5).clamp(0.0, 1.0) * al;
                if cob <= 0.0 { continue; }
                // (source-over sobre lo que había)
                let j = (py * N + px) * 4; let (sc, sa) = (if claro { 255.0 } else { 0.0 }, cob); let da = d[j + 3] as f32 / 255.0; let oa = sa + da * (1.0 - sa);
                for c in 0..3 { let dc = d[j + c] as f32; d[j + c] = (if oa > 0.0 { (sc * sa + dc * da * (1.0 - sa)) / oa } else { 0.0 }) as u8; }
                d[j + 3] = (oa * 255.0) as u8;
            } }
        }
    }
    d
}

fn dist_seg(p: [f32; 2], a: [f32; 2], b: [f32; 2]) -> f32 {
    let (dx, dy) = (b[0] - a[0], b[1] - a[1]); let l = dx * dx + dy * dy;
    let t = if l > 0.0 { (((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l).clamp(0.0, 1.0) } else { 0.0 };
    let (x, y) = (a[0] + dx * t - p[0], a[1] + dy * t - p[1]); (x * x + y * y).sqrt()
}
/// la cobertura de un polígono (regla nonzero, 4 × 4 muestras) en una imagen de w × h, con el polígono en unidades de
/// `uw` × `uh` estirado a la imagen (como una máscara SVG con preserveAspectRatio="none")
pub fn mascara(p: &[[f32; 2]], uw: f32, uh: f32, w: usize, h: usize) -> Vec<u8> {
    let q: Vec<[f32; 2]> = p.iter().map(|v| [v[0] / uw * w as f32, v[1] / uh * h as f32]).collect();
    let mut o = vec![0u8; w * h];
    for y in 0..h { for x in 0..w { let mut n = 0;
        for sy in 0..4 { for sx in 0..4 { let s = [x as f32 + (sx as f32 + 0.5) / 4.0, y as f32 + (sy as f32 + 0.5) / 4.0]; if adentro(s, &q) { n += 1; } } }
        o[y * w + x] = (n * 255 / 16) as u8; } }
    o
}
/// nonzero
pub fn adentro(p: [f32; 2], c: &[[f32; 2]]) -> bool {
    let mut w = 0; let n = c.len();
    for i in 0..n { let (a, b) = (c[i], c[(i + 1) % n]); let iz = (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]);
        if a[1] <= p[1] { if b[1] > p[1] && iz > 0.0 { w += 1; } } else if b[1] <= p[1] && iz < 0.0 { w -= 1; } }
    w != 0
}

/// triangulación por orejas de un polígono simple (en cualquier sentido): los índices de los triángulos
pub fn orejas(p: &[[f32; 2]]) -> Vec<[usize; 3]> {
    let n = p.len(); if n < 3 { return vec![]; }
    let area: f32 = (0..n).map(|i| { let (a, b) = (p[i], p[(i + 1) % n]); a[0] * b[1] - b[0] * a[1] }).sum();
    let s = if area >= 0.0 { 1.0 } else { -1.0 };
    let mut idx: Vec<usize> = (0..n).collect(); let mut t = vec![]; let mut guardia = 0;
    let cruz = |a: [f32; 2], b: [f32; 2], c: [f32; 2]| (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    while idx.len() > 3 && guardia < n * n {
        guardia += 1; let m = idx.len(); let mut hecho = false;
        for i in 0..m {
            let (ia, ib, ic) = (idx[(i + m - 1) % m], idx[i], idx[(i + 1) % m]); let (a, b, c) = (p[ia], p[ib], p[ic]);
            let cr = cruz(a, b, c) * s; if cr <= 1e-9 { if cr.abs() <= 1e-9 { idx.remove(i); hecho = true; break; } continue; }
            let tapa = idx.iter().any(|&j| { if j == ia || j == ib || j == ic { return false; } let q = p[j]; cruz(a, b, q) * s > 0.0 && cruz(b, c, q) * s > 0.0 && cruz(c, a, q) * s > 0.0 });
            if tapa { continue; }
            t.push([ia, ib, ic]); idx.remove(i); hecho = true; break;
        }
        if !hecho { break; }
    }
    if idx.len() == 3 { t.push([idx[0], idx[1], idx[2]]); }
    t
}

impl Atlas {
    /// arma el atlas con las letras (menus.json y menus.png) y le agrega abajo las piezas: el grano y las rasgaduras
    /// (devuelve también los píxeles, para subirlo)
    pub fn armar(json: &str, png: Vec<u8>) -> Result<(Atlas, Vec<u8>), String> {
        let v: serde_json::Value = serde_json::from_str(json).map_err(|e| format!("menus.json: {e}"))?;
        let (lw, lh, lpx) = crate::comun::png_rgba(png).ok_or("menus.png no se lee")?;
        let f = |x: &serde_json::Value| x.as_f64().unwrap_or(0.0) as f32;
        let mut caras = vec![];
        for k in ["o5", "o6", "s4", "s7"] {
            let c = &v["caras"][k]; let mut m = HashMap::new(); let mut kk = HashMap::new();
            for (ch, a) in c["c"].as_object().ok_or("menus.json sin letras")? { if let (Some(ch), Some(a)) = (ch.chars().next(), a.as_array()) { let mut x = [0f32; 7]; for (i, e) in a.iter().take(7).enumerate() { x[i] = f(e); } m.insert(ch, x); } }
            if let Some(o) = c["k"].as_object() { for (par, d) in o { let mut it = par.chars(); if let (Some(a), Some(b)) = (it.next(), it.next()) { kk.insert((a, b), f(d)); } } }
            caras.push(Fuente { tam: f(&c["tam"]), asc: f(&c["asc"]), desc: f(&c["desc"]), c: m, k: kk });
        }
        let r4 = |k: &str| { let mut r = [0f32; 4]; if let Some(a) = v[k].as_array() { for (i, e) in a.iter().take(4).enumerate() { r[i] = f(e); } } r };
        let (disco, anillo) = (r4("disco"), r4("anillo"));
        let ra = rasgaduras();
        let mut piezas: Vec<(&'static str, u32, u32, Vec<u8>)> = vec![];
        // (el grano con 2 px repetidos alrededor: se lee con filtro lineal sin costura)
        { let g = grano(); let (n, b) = (160usize, 2usize); let m = n + 2 * b; let mut o = vec![0u8; m * m * 4];
          for y in 0..m { for x in 0..m { let (sx, sy) = ((x + n - b) % n, (y + n - b) % n); o[(y * m + x) * 4..(y * m + x) * 4 + 4].copy_from_slice(&g[(sy * n + sx) * 4..(sy * n + sx) * 4 + 4]); } }
          piezas.push(("grano", m as u32, m as u32, o)); }
        // (las máscaras: blancas, con la cobertura en el alfa; y las mismas con el grano adentro, para la punta de cada placa)
        let blanca = |m: Vec<u8>| -> Vec<u8> { m.iter().flat_map(|&a| [255, 255, 255, a]).collect() };
        let g = grano();
        const NOMBRES: [&str; 4] = ["rasga0", "rasga1", "rasga2", "rasga3"];
        for (i, p) in ra.puntas.iter().enumerate() { let m = mascara(p, 48.0, 100.0, 96, 200); piezas.push((NOMBRES[i], 96, 200, blanca(m))); }
        { let m = mascara(&ra.chip, 24.0, 100.0, 48, 200); piezas.push(("chip", 48, 200, blanca(m))); }
        // (la cinta: el papel con su degradé y el grano, recortado en zigzag)
        { let (cw, ch) = (128usize, 128usize); let m = mascara(&ra.cinta, 100.0, 100.0, cw, ch); let mut o = vec![0u8; cw * ch * 4];
          for y in 0..ch { for x in 0..cw { let t = y as f32 / (ch - 1) as f32; let (r0, g0, b0, a0) = (236.0 + (214.0 - 236.0) * t, 225.0 + (200.0 - 225.0) * t, 190.0 + (160.0 - 190.0) * t, 0.86 + (0.82 - 0.86) * t);
            // (el grano de la cinta: 120 px de tile en 13 29, sobre el papel)
            let s = ((((y * 120 / ch) + 29) % 160) * 160 + ((x * 120 / cw) + 13) % 160) * 4; let ga = g[s + 3] as f32 / 255.0; let gc = g[s] as f32;
            let (r, gg, b) = (r0 * (1.0 - ga) + gc * ga, g0 * (1.0 - ga) + gc * ga, b0 * (1.0 - ga) + gc * ga); let a = (a0 + ga * (1.0 - a0)) * m[y * cw + x] as f32 / 255.0;
            let j = (y * cw + x) * 4; o[j] = r as u8; o[j + 1] = gg as u8; o[j + 2] = b as u8; o[j + 3] = (a * 255.0) as u8; } }
          piezas.push(("cinta", cw as u32, ch as u32, o)); }
        // (la línea amarilla gastada: tramos con huecos, blanca para teñirla)
        { let (lw2, lh2) = (512usize, 16usize); let mut o = vec![0u8; lw2 * lh2 * 4];
          for (r, a) in &ra.linea { let (x0, x1) = ((r[0] / 100.0 * lw2 as f32) as usize, ((r[0] + r[2]) / 100.0 * lw2 as f32).min(lw2 as f32) as usize);
            for y in 0..lh2 { let yy = (y as f32 + 0.5) / lh2 as f32 * 100.0; if yy < r[1] || yy > r[1] + r[3] { continue; }
              for x in x0..x1 { let j = (y * lw2 + x) * 4; o[j] = 255; o[j + 1] = 255; o[j + 2] = 255; o[j + 3] = o[j + 3].max((a * 255.0) as u8); } } }
          piezas.push(("linea", lw2 as u32, lh2 as u32, o)); }
        // (lo liso: el cuadrado blanco y el disco y el anillo de menus.png, arriba de todo)
        let copiar = |r: [f32; 4]| -> Vec<u8> { let (x0, y0, ww, hh) = (r[0] as u32, r[1] as u32, r[2] as u32, r[3] as u32); let mut o = Vec::with_capacity((ww * hh * 4) as usize);
            for y in y0..y0 + hh { let s = ((y * lw + x0) * 4) as usize; o.extend_from_slice(&lpx[s..s + (ww * 4) as usize]); } o };
        piezas.insert(0, ("disco", disco[2] as u32, disco[3] as u32, copiar(disco))); piezas.insert(1, ("anillo", anillo[2] as u32, anillo[3] as u32, copiar(anillo)));
        piezas.insert(0, ("blanco", 16, 16, vec![255u8; 16 * 16 * 4]));
        // acomodar las piezas en estantes (un atlas chico: las letras se pintan aparte, al tamaño justo)
        let w = 1024u32; let (mut x, mut y, mut alto) = (0u32, 0u32, 0u32); let mut lugares = vec![];
        for (n, pw, ph, _) in &piezas { if x + pw > w { x = 0; y += alto + 4; alto = 0; } lugares.push((*n, x, y, *pw, *ph)); x += pw + 4; alto = alto.max(*ph); }
        let h = (y + alto + 4).next_power_of_two();
        let mut px = vec![0u8; (w * h * 4) as usize];
        let mut reg = HashMap::new();
        for ((n, x, y, pw, ph), (_, _, _, d)) in lugares.into_iter().zip(piezas.iter()) {
            for r in 0..ph { let s = (r * pw * 4) as usize; let dd = (((y + r) * w + x) * 4) as usize; px[dd..dd + (pw * 4) as usize].copy_from_slice(&d[s..s + (pw * 4) as usize]); }
            reg.insert(n, [x as f32, y as f32, pw as f32, ph as f32]);
        }
        if let Some(g) = reg.get_mut("grano") { g[0] += 2.0; g[1] += 2.0; g[2] = 160.0; g[3] = 160.0; }
        let b = reg.get("blanco").map(|r| [r[0] + 8.0, r[1] + 8.0]).unwrap_or([8.0, 8.0]);
        let (disco, anillo) = (reg["disco"], reg["anillo"]);
        let letras = (lw, lh, lpx.chunks_exact(4).map(|c| c[3]).collect());
        Ok((Atlas { w, h, blanco: b, disco, anillo, caras, reg, letras, puntas: ra.puntas, punta_chip: ra.chip, logo_m: ra.logo }, px))
    }
    fn cara(&self, c: Cara) -> &Fuente { &self.caras[match c { Cara::O5 => 0, Cara::O6 => 1, Cara::S4 => 2, Cara::S7 => 3 }] }
    /// el ancho de un texto de letra `tam` con `esp` em de espacio entre letras (letter-spacing de CSS: también después de la
    /// última)
    pub fn ancho(&self, c: Cara, tam: f32, esp: f32, s: &str) -> f32 {
        // (la sans va sin espaciado entre letras: como las letras de Vista)
        let esp = if matches!(c, Cara::S4 | Cara::S7) { 0.0 } else { esp };
        let f = self.cara(c); let k = tam / f.tam; let mut w = 0.0; let mut ant: Option<char> = None;
        for ch in s.chars() { let m = f.c.get(&ch).or(f.c.get(&'?')); w += m.map(|m| m[6]).unwrap_or(0.0) * k + esp * tam; if let Some(a) = ant { w += f.k.get(&(a, ch)).copied().unwrap_or(0.0) * k; } ant = Some(ch); }
        w
    }
    /// lo de arriba y lo de abajo de la línea de base que usa el renglón de CSS (en px, con letra `tam`)
    pub fn metricas(&self, c: Cara, tam: f32) -> (f32, f32) { let f = self.cara(c); (f.asc * tam / f.tam, f.desc * tam / f.tam) }
    /// dónde va la línea de base para que un renglón de alto `lh` (line-height en px) quede centrado en `y0..y0+alto`
    pub fn base_centrada(&self, c: Cara, tam: f32, lh: f32, y0: f32, alto: f32) -> f32 { let (a, d) = self.metricas(c, tam); y0 + (alto - lh) / 2.0 + (lh - a - d) / 2.0 + a }
    /// el texto partido en renglones que entren en `ancho`
    pub fn renglones(&self, c: Cara, tam: f32, esp: f32, s: &str, ancho: f32) -> Vec<String> {
        let mut v = vec![];
        for parrafo in s.split('\n') {
            let mut r = String::new();
            for pal in parrafo.split(' ') { let p = if r.is_empty() { pal.to_string() } else { format!("{r} {pal}") }; if self.ancho(c, tam, esp, &p) > ancho && !r.is_empty() { v.push(std::mem::take(&mut r)); r = pal.to_string(); } else { r = p; } }
            v.push(r);
        }
        v
    }
}

/// las letras pintadas al tamaño en que se ven (como el navegador: sin estirar ni achicar en la placa, que con los niveles
/// —mipmaps— las dejaba finas y borrosas): cada una se saca de menus.png promediando lo que cae en cada píxel. Van en
/// estantes de una textura de 1024 × 1024 que se sube cuando hay alguna nueva; si se llena, se empieza de nuevo
pub struct Glifos { lugar: HashMap<(u8, char, u16), [f32; 6]>, px: Vec<u8>, x: u32, y: u32, alto: u32, pub sucio: bool, pub lleno: bool }
pub const TEX_GLIFOS: i64 = -2102;
const GLI_LADO: u32 = 1024;
impl Default for Glifos { fn default() -> Self { Glifos { lugar: HashMap::new(), px: vec![], x: 0, y: 0, alto: 0, sucio: false, lleno: false } } }
impl Glifos {
    /// dónde está (o queda) la letra `ch` de la cara `c` con letra de `tam` px: (x, y, ancho, alto en la textura; corrimiento
    /// de su caja desde el punto de la línea de base, en px)
    fn de(&mut self, at: &Atlas, c: Cara, ch: char, tam: f32) -> Option<[f32; 6]> {
        let q = (tam * 4.0).round().clamp(4.0, 4000.0) as u16; let ci = match c { Cara::O5 => 0u8, Cara::O6 => 1, Cara::S4 => 2, Cara::S7 => 3 };
        if let Some(r) = self.lugar.get(&(ci, ch, q)) { return Some(*r); }
        let f = at.cara(c); let g = *f.c.get(&ch).or(f.c.get(&'?'))?; if ch == ' ' || g[2] <= 1.0 { return None; }
        let t = q as f32 / 4.0; let k = t / f.tam;
        // (la caja en el tamaño pedido, en píxeles enteros desde el punto de la base)
        let (x0, y0) = ((g[4] * k).floor(), (g[5] * k).floor()); let (x1, y1) = (((g[4] + g[2]) * k).ceil(), ((g[5] + g[3]) * k).ceil());
        let (ow, oh) = ((x1 - x0) as u32 + 2, (y1 - y0) as u32 + 2);
        if ow + 2 > GLI_LADO || oh + 2 > GLI_LADO { return None; }
        if self.px.is_empty() { self.px = vec![0u8; (GLI_LADO * GLI_LADO * 4) as usize]; }
        if self.x + ow + 1 > GLI_LADO { self.x = 0; self.y += self.alto + 1; self.alto = 0; }
        if self.y + oh + 1 > GLI_LADO { self.lugar.clear(); self.x = 0; self.y = 0; self.alto = 0; self.px.fill(0); self.lleno = true; }
        let (lw, _lh, la) = (&at.letras.0, &at.letras.1, &at.letras.2);
        let fuente = |sx: i32, sy: i32| -> f32 { if sx < 0 || sy < 0 || sx >= g[2] as i32 || sy >= g[3] as i32 { 0.0 } else { la[((g[1] as i32 + sy) as u32 * lw + g[0] as u32 + sx as u32) as usize] as f32 } };
        let (dx, dy) = (self.x + 1, self.y + 1);
        for j in 0..oh { for i in 0..ow {
            // (el píxel de destino, en píxeles de la letra de menus.png: su área —o, si se agranda, el punto con lineal—)
            let (ax, ay) = ((x0 + i as f32 - 1.0) / k - g[4], (y0 + j as f32 - 1.0) / k - g[5]); let (bx, by) = (ax + 1.0 / k, ay + 1.0 / k);
            let v = if k <= 1.0 {
                let mut sum = 0.0; let mut area = 0.0;
                for sy in ay.floor() as i32..by.ceil() as i32 { let hy = (by.min(sy as f32 + 1.0) - ay.max(sy as f32)).max(0.0); if hy <= 0.0 { continue; }
                    for sx in ax.floor() as i32..bx.ceil() as i32 { let hx = (bx.min(sx as f32 + 1.0) - ax.max(sx as f32)).max(0.0); if hx <= 0.0 { continue; } sum += fuente(sx, sy) * hx * hy; area += hx * hy; } }
                if area > 0.0 { sum / area } else { 0.0 }
            } else {
                let (cx, cy) = ((ax + bx) / 2.0 - 0.5, (ay + by) / 2.0 - 0.5); let (fx, fy) = (cx.floor(), cy.floor()); let (tx, ty) = (cx - fx, cy - fy); let (ix, iy) = (fx as i32, fy as i32);
                fuente(ix, iy) * (1.0 - tx) * (1.0 - ty) + fuente(ix + 1, iy) * tx * (1.0 - ty) + fuente(ix, iy + 1) * (1.0 - tx) * ty + fuente(ix + 1, iy + 1) * tx * ty
            };
            let d = (((dy + j) * GLI_LADO + dx + i) * 4) as usize; self.px[d..d + 4].copy_from_slice(&[255, 255, 255, v.round().clamp(0.0, 255.0) as u8]);
        } }
        let r = [dx as f32, dy as f32, ow as f32, oh as f32, x0 - 1.0, y0 - 1.0];
        self.lugar.insert((ci, ch, q), r); self.x += ow + 1; self.alto = self.alto.max(oh); self.sucio = true;
        Some(r)
    }
    /// sube la textura si cambió (o si `forzar`: el motor se vació)
    pub fn subir(&mut self, m: &mut Motor3d, forzar: bool) {
        if (!self.sucio && !forzar) || self.px.is_empty() { return; }
        self.sucio = false; subir_tex(m, TEX_GLIFOS, GLI_LADO, GLI_LADO, self.px.clone());
    }
}

/// los íconos pintados al tamaño justo (en estantes de una textura de 1024 × 1024; se sube cuando hay uno nuevo)
pub struct Iconos { pub lugar: HashMap<(&'static str, u16, u16), [f32; 4]>, px: Vec<u8>, x: u32, y: u32, alto: u32, pub sucio: bool }
const ICO_LADO: u32 = 1024;
impl Default for Iconos { fn default() -> Self { Iconos { lugar: HashMap::new(), px: vec![], x: 0, y: 0, alto: 0, sucio: false } } }
impl Iconos {
    /// dónde está (o queda) el ícono de `lado` px con trazo `trazo`
    pub fn de(&mut self, n: &'static str, lado: f32, trazo: f32) -> Option<[f32; 4]> {
        let l = (lado.round() as u32).clamp(4, 160); let k = (n, l as u16, (trazo * 100.0) as u16);
        if let Some(r) = self.lugar.get(&k) { return Some(*r); }
        if !crate::iconos::hay(n) { return None; }
        if self.px.is_empty() { self.px = vec![0u8; (ICO_LADO * ICO_LADO * 4) as usize]; }
        if self.x + l + 2 > ICO_LADO { self.x = 0; self.y += self.alto + 2; self.alto = 0; }
        if self.y + l + 2 > ICO_LADO { self.lugar.clear(); self.x = 0; self.y = 0; self.alto = 0; self.px.fill(0); }
        let (x0, y0) = (self.x + 1, self.y + 1);
        if let Some(rgba) = crate::iconos::pintar_color(n, l as usize) {
            for y in 0..l { for x in 0..l { let j = (((y0 + y) * ICO_LADO + x0 + x) * 4) as usize; let s = ((y * l + x) * 4) as usize; self.px[j..j + 4].copy_from_slice(&rgba[s..s + 4]); } }
        } else {
            let a = crate::iconos::pintar(n, l as usize, trazo)?;
            for y in 0..l { for x in 0..l { let j = (((y0 + y) * ICO_LADO + x0 + x) * 4) as usize; let c = a[(y * l + x) as usize]; self.px[j..j + 4].copy_from_slice(&[255, 255, 255, c]); } }
        }
        let r = [x0 as f32, y0 as f32, l as f32, l as f32]; self.lugar.insert(k, r);
        self.x += l + 2; self.alto = self.alto.max(l + 2); self.sucio = true;
        Some(r)
    }
    /// sube la textura si cambió (o si `forzar`: el motor se vació)
    pub fn subir(&mut self, m: &mut Motor3d, forzar: bool) {
        if (!self.sucio && !forzar) || self.px.is_empty() { return; }
        self.sucio = false; subir_tex(m, TEX_ICOS, ICO_LADO, ICO_LADO, self.px.clone());
    }
}

/// una textura RGBA al motor
pub fn subir_tex(m: &mut Motor3d, id: i64, w: u32, h: u32, px: Vec<u8>) -> bool {
    let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id, n: format!("menus{id}"), w, h, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
    unsafe { m.cargar(&Escena { c: cab, datos: px }) }.is_ok()
}
/// una imagen WebP o PNG a RGBA
pub fn decodificar(b: &[u8]) -> Option<(u32, u32, Vec<u8>)> {
    if b.starts_with(b"\x89PNG") { return crate::comun::png_rgba(b.to_vec()); }
    let mut dec = image_webp::WebPDecoder::new(std::io::Cursor::new(b)).ok()?;
    let (w, h) = dec.dimensions(); let alfa = dec.has_alpha();
    let mut px = vec![0u8; dec.output_buffer_size()?]; dec.read_image(&mut px).ok()?;
    Some((w, h, if alfa { px } else { px.chunks_exact(3).flat_map(|c| [c[0], c[1], c[2], 255]).collect() }))
}
/// achica una imagen a la mitad hasta que el lado mayor entre en `max` (promedio de 2 × 2)
pub fn achicar(mut w: u32, mut h: u32, mut px: Vec<u8>, max: u32) -> (u32, u32, Vec<u8>) {
    while w.max(h) > max && w > 1 && h > 1 {
        let (nw, nh) = (w / 2, h / 2); let mut o = vec![0u8; (nw * nh * 4) as usize];
        for y in 0..nh { for x in 0..nw { for c in 0..4 { let s = |xx: u32, yy: u32| px[((yy * w + xx) * 4 + c) as usize] as u32; o[((y * nw + x) * 4 + c) as usize] = ((s(2 * x, 2 * y) + s(2 * x + 1, 2 * y) + s(2 * x, 2 * y + 1) + s(2 * x + 1, 2 * y + 1)) / 4) as u8; } } }
        w = nw; h = nh; px = o;
    }
    (w, h, px)
}

/// un vértice: x, y, u, v, r, g, b, a
type V = [f32; 8];

/// el pincel de un cuadro: junta las tandas por textura en el orden en que se dibuja
pub struct Pincel<'a> {
    pub at: &'a Atlas, pub ic: &'a mut Iconos, pub gl: &'a mut Glifos,
    pub tandas: Vec<(i64, Vec<f32>)>,
    /// el recorte (x, y, ancho, alto en píxeles de la pantalla)
    pub recorte: Option<[f32; 4]>,
    /// la transformación (a, b, c, d, e, f: x' = a x + c y + e, y' = b x + d y + f)
    pub m: [f32; 6],
    /// la opacidad de todo
    pub alfa: f32,
    /// lo que se ve detrás del vidrio Aero (aero.rs): las fotos del fondo desenfocadas y cómo caen en la pantalla
    pub vidrio: Option<Vidrio>,
}
/// el fondo desenfocado para el vidrio: cada capa (su textura, de la pantalla a la UV —u = a x + b, v = c y + d— y su opacidad)
#[derive(Clone, Debug, Default)]
pub struct Vidrio { pub capas: Vec<(i64, [f32; 4], f32)> }
pub const IDENT: [f32; 6] = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
/// m1 después de m2 (primero m2)
pub fn mm(m1: [f32; 6], m2: [f32; 6]) -> [f32; 6] {
    [m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1], m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3], m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5]]
}
/// correr, escalar alrededor de un punto y rotar (grados) alrededor de un punto
pub fn mover(dx: f32, dy: f32) -> [f32; 6] { [1.0, 0.0, 0.0, 1.0, dx, dy] }
pub fn escalar_en(sx: f32, sy: f32, cx: f32, cy: f32) -> [f32; 6] { [sx, 0.0, 0.0, sy, cx - sx * cx, cy - sy * cy] }
pub fn rotar_en(g: f32, cx: f32, cy: f32) -> [f32; 6] { let (s, c) = g.to_radians().sin_cos(); [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy] }

impl<'a> Pincel<'a> {
    pub fn nuevo(at: &'a Atlas, ic: &'a mut Iconos, gl: &'a mut Glifos) -> Pincel<'a> { Pincel { at, ic, gl, tandas: vec![], recorte: None, m: IDENT, alfa: 1.0, vidrio: None } }
    fn tanda(&mut self, tex: i64) -> &mut Vec<f32> {
        if self.tandas.last().map(|t| t.0) != Some(tex) { self.tandas.push((tex, vec![])); }
        &mut self.tandas.last_mut().unwrap().1
    }
    /// un polígono convexo de vértices ya transformados: recortado y en abanico
    fn convexo(&mut self, tex: i64, mut p: Vec<V>) {
        if let Some(r) = self.recorte {
            for (eje, lim, mayor) in [(0usize, r[0], false), (0, r[0] + r[2], true), (1, r[1], false), (1, r[1] + r[3], true)] {
                let fuera = |v: &V| if mayor { v[eje] > lim } else { v[eje] < lim };
                let mut q = vec![]; let n = p.len();
                for i in 0..n { let (a, b) = (p[i], p[(i + 1) % n]); let (fa, fb) = (fuera(&a), fuera(&b));
                    if !fa { q.push(a); }
                    if fa != fb { let t = (lim - a[eje]) / (b[eje] - a[eje]); let mut c = [0f32; 8]; for k in 0..8 { c[k] = a[k] + (b[k] - a[k]) * t; } q.push(c); } }
                p = q; if p.len() < 3 { return; }
            }
        }
        if p.len() < 3 { return; }
        let t = self.tanda(tex);
        for i in 1..p.len() - 1 { for v in [p[0], p[i], p[i + 1]] { t.extend_from_slice(&v); } }
    }
    fn tr(&self, x: f32, y: f32) -> [f32; 2] { let m = self.m; [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] }
    fn vert(&self, x: f32, y: f32, u: f32, v: f32, c: Col) -> V { let p = self.tr(x, y); [p[0], p[1], u, v, c[0], c[1], c[2], c[3] * self.alfa] }
    /// un cuadrilátero con textura (las UV en 0..1 de la textura) y un color por esquina (arriba izq., arriba der., abajo der.,
    /// abajo izq.)
    pub fn quad(&mut self, tex: i64, p: [[f32; 2]; 4], uv: [[f32; 2]; 4], c: [Col; 4]) {
        if c.iter().all(|c| c[3] * self.alfa <= 0.001) { return; }
        let v = (0..4).map(|i| self.vert(p[i][0], p[i][1], uv[i][0], uv[i][1], c[i])).collect(); self.convexo(tex, v);
    }
    fn uv_blanco(&self) -> [f32; 2] { [self.at.blanco[0] / self.at.w as f32, self.at.blanco[1] / self.at.h as f32] }
    /// un rectángulo liso
    pub fn rect(&mut self, x: f32, y: f32, w: f32, h: f32, c: Col) { self.rect4(x, y, w, h, [c; 4]); }
    /// un rectángulo con un color por esquina (los degradés)
    pub fn rect4(&mut self, x: f32, y: f32, w: f32, h: f32, c: [Col; 4]) { if w <= 0.0 || h <= 0.0 { return; } let b = self.uv_blanco(); self.quad(TEX_MENUS, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], [b; 4], c); }
    /// un degradé de izquierda a derecha con paradas (posición 0..1, color)
    pub fn degrade_h(&mut self, x: f32, y: f32, w: f32, h: f32, paradas: &[(f32, Col)]) {
        for i in 1..paradas.len() { let (a, b) = (paradas[i - 1], paradas[i]); self.rect4(x + w * a.0, y, w * (b.0 - a.0), h, [a.1, b.1, b.1, a.1]); }
    }
    /// un degradé de arriba abajo con paradas
    pub fn degrade_v(&mut self, x: f32, y: f32, w: f32, h: f32, paradas: &[(f32, Col)]) {
        for i in 1..paradas.len() { let (a, b) = (paradas[i - 1], paradas[i]); self.rect4(x, y + h * a.0, w, h * (b.0 - a.0), [a.1, a.1, b.1, b.1]); }
    }
    /// el borde de un rectángulo (hacia adentro, de grosor g)
    pub fn borde(&mut self, x: f32, y: f32, w: f32, h: f32, g: f32, c: Col) { self.rect(x, y, w, g, c); self.rect(x, y + h - g, w, g, c); self.rect(x, y + g, g, h - 2.0 * g, c); self.rect(x + w - g, y + g, g, h - 2.0 * g, c); }
    /// una pieza del atlas estirada en un rectángulo
    pub fn pieza(&mut self, n: &str, x: f32, y: f32, w: f32, h: f32, c: Col) { if let Some(r) = self.at.reg.get(n).copied() { self.pieza_r(r, x, y, w, h, c, false); } }
    /// lo mismo, espejado de izquierda a derecha
    pub fn pieza_espejo(&mut self, n: &str, x: f32, y: f32, w: f32, h: f32, c: Col) { if let Some(r) = self.at.reg.get(n).copied() { self.pieza_r(r, x, y, w, h, c, true); } }
    fn pieza_r(&mut self, r: [f32; 4], x: f32, y: f32, w: f32, h: f32, c: Col, espejo: bool) {
        let (aw, ah) = (self.at.w as f32, self.at.h as f32); let (mut u0, v0, mut u1, v1) = ((r[0] + 0.5) / aw, (r[1] + 0.5) / ah, (r[0] + r[2] - 0.5) / aw, (r[1] + r[3] - 0.5) / ah);
        if espejo { std::mem::swap(&mut u0, &mut u1); }
        self.quad(TEX_MENUS, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [c; 4]);
    }
    /// el grano de la web (160 px que se repiten) sobre un rectángulo, con el dibujo corrido (gx, gy) como `background-position`
    pub fn grano(&mut self, x: f32, y: f32, w: f32, h: f32, gx: f32, gy: f32, a: f32) {
        let Some(r) = self.at.reg.get("grano").copied() else { return }; if w <= 0.0 || h <= 0.0 { return; }
        let (gx, gy) = (gx.round(), gy.round());
        let (aw, ah) = (self.at.w as f32, self.at.h as f32); const T: f32 = 160.0;
        // (las celdas del dibujo que tocan el rectángulo)
        let (cx0, cy0) = (((x - gx) / T).floor() as i32, ((y - gy) / T).floor() as i32); let (cx1, cy1) = (((x + w - gx) / T).ceil() as i32, ((y + h - gy) / T).ceil() as i32);
        for cy in cy0..cy1 { for cx in cx0..cx1 {
            let (tx, ty) = (gx + cx as f32 * T, gy + cy as f32 * T);
            let (ax, ay, bx, by) = (x.max(tx), y.max(ty), (x + w).min(tx + T), (y + h).min(ty + T)); if bx <= ax || by <= ay { continue; }
            let uv = |px: f32, py: f32| [(r[0] + px - tx) / aw, (r[1] + py - ty) / ah];
            self.quad(TEX_MENUS, [[ax, ay], [bx, ay], [bx, by], [ax, by]], [uv(ax, ay), uv(bx, ay), uv(bx, by), uv(ax, by)], [[1.0, 1.0, 1.0, a]; 4]);
        } }
    }
    /// una placa con la punta rota a la derecha (las máscaras de clasico.js: `punta` 0–3 las de las barras, 4 la de las placas
    /// chicas, estirada a `ap` px de ancho y al alto de la placa), con el grano de 160 px corrido (gx, gy) encima de las dos
    pub fn placa_rota(&mut self, x: f32, y: f32, w: f32, h: f32, punta: usize, ap: f32, c: Col, grano: Option<(f32, f32, f32)>) {
        let (nombre, poli, uw): (&str, &Vec<[f32; 2]>, f32) = match punta { 0 => ("rasga0", &self.at.puntas[0], 48.0), 1 => ("rasga1", &self.at.puntas[1], 48.0), 2 => ("rasga2", &self.at.puntas[2], 48.0), 3 => ("rasga3", &self.at.puntas[3], 48.0), _ => ("chip", &self.at.punta_chip, 24.0) };
        let xp = x + w - ap; self.rect(x, y, w - ap, h, c);
        if let Some(r) = self.at.reg.get(nombre).copied() { self.pieza_r(r, xp, y, ap, h, c, false); }
        if let Some((gx, gy, a)) = grano {
            self.grano(x, y, w - ap, h, gx, gy, a);
            // (en la punta, el mismo grano dentro del polígono roto: por celdas del dibujo, cada una con su recorte)
            let Some(rg) = self.at.reg.get("grano").copied() else { return };
            let pts: Vec<[f32; 2]> = poli.iter().map(|q| [xp + q[0] / uw * ap, y + q[1] / 100.0 * h]).collect();
            let (gx, gy) = (gx.round(), gy.round()); const T: f32 = 160.0; let (aw, ah) = (self.at.w as f32, self.at.h as f32);
            let (cx0, cy0) = (((xp - gx) / T).floor() as i32, ((y - gy) / T).floor() as i32); let (cx1, cy1) = (((xp + ap - gx) / T).ceil() as i32, ((y + h - gy) / T).ceil() as i32);
            for cy in cy0..cy1 { for cx in cx0..cx1 { let (tx, ty) = (gx + cx as f32 * T, gy + cy as f32 * T);
                self.con_recorte([tx, ty, T, T], |p| p.poli_tex(TEX_MENUS, &pts, |q| [(rg[0] + q[0] - tx) / aw, (rg[1] + q[1] - ty) / ah], [1.0, 1.0, 1.0, a])); } }
        }
    }
    /// un polígono lleno (simple, en cualquier sentido)
    pub fn poli(&mut self, p: &[[f32; 2]], c: Col) {
        let b = self.uv_blanco();
        for t in orejas(p) { let v = t.iter().map(|&i| self.vert(p[i][0], p[i][1], b[0], b[1], c)).collect(); self.convexo(TEX_MENUS, v); }
    }
    /// un polígono con una textura cualquiera (la UV de cada punto la da `uv`)
    pub fn poli_tex(&mut self, tex: i64, p: &[[f32; 2]], uv: impl Fn([f32; 2]) -> [f32; 2], c: Col) {
        for t in orejas(p) { let v = t.iter().map(|&i| { let q = uv(p[i]); self.vert(p[i][0], p[i][1], q[0], q[1], c) }).collect(); self.convexo(tex, v); }
    }
    /// un polígono con una textura y un color por punto (la UV y el color de cada punto los dan `uv` y `col`)
    pub fn poli_gen(&mut self, tex: i64, p: &[[f32; 2]], uv: impl Fn([f32; 2]) -> [f32; 2], col: impl Fn([f32; 2]) -> Col) {
        for t in orejas(p) { let v = t.iter().map(|&i| { let q = uv(p[i]); self.vert(p[i][0], p[i][1], q[0], q[1], col(p[i])) }).collect(); self.convexo(tex, v); }
    }
    /// la UV del blanco liso del atlas (para lo que va sin textura)
    pub fn uv_liso(&self) -> [f32; 2] { self.uv_blanco() }
    /// una raya de `a` a `b` de grosor `g`
    pub fn linea(&mut self, a: [f32; 2], b: [f32; 2], g: f32, c: Col) {
        let (dx, dy) = (b[0] - a[0], b[1] - a[1]); let l = (dx * dx + dy * dy).sqrt(); if l <= 0.0 { return; }
        let (nx, ny) = (-dy / l * g / 2.0, dx / l * g / 2.0); let w = self.uv_blanco();
        self.quad(TEX_MENUS, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], [w; 4], [c; 4]);
    }
    /// un círculo lleno y un aro (los del atlas, con el borde suave)
    pub fn disco(&mut self, cx: f32, cy: f32, r: f32, c: Col) { let d = self.at.disco; self.pieza_r(d, cx - r, cy - r, r * 2.0, r * 2.0, c, false); }
    pub fn anillo(&mut self, cx: f32, cy: f32, r: f32, c: Col) { let d = self.at.anillo; self.pieza_r(d, cx - r, cy - r, r * 2.0, r * 2.0, c, false); }
    /// un rectángulo con las esquinas redondeadas
    pub fn caja(&mut self, x: f32, y: f32, w: f32, h: f32, ra: f32, c: Col) {
        let ra = ra.min(w / 2.0).min(h / 2.0); if ra < 0.5 { self.rect(x, y, w, h, c); return; }
        let d = self.at.disco; let m = d[2] / 2.0; let q = |i: f32, j: f32| [d[0] + i * m, d[1] + j * m, m, m];
        self.pieza_r(q(0.0, 0.0), x, y, ra, ra, c, false); self.pieza_r(q(1.0, 0.0), x + w - ra, y, ra, ra, c, false);
        self.pieza_r(q(0.0, 1.0), x, y + h - ra, ra, ra, c, false); self.pieza_r(q(1.0, 1.0), x + w - ra, y + h - ra, ra, ra, c, false);
        self.rect(x + ra, y, w - 2.0 * ra, ra, c); self.rect(x, y + ra, w, h - 2.0 * ra, c); self.rect(x + ra, y + h - ra, w - 2.0 * ra, ra, c);
    }
    /// un texto con la línea de base en `base`; devuelve el ancho. Cada letra, pintada al tamaño en que se ve (con la escala de
    /// la transformación) y puesta en un píxel entero
    pub fn texto(&mut self, cara: Cara, tam: f32, x: f32, base: f32, c: Col, esp: f32, s: &str) -> f32 {
        let at = self.at; let f = at.cara(cara); let k = tam / f.tam; let mut px = x; let mut ant: Option<char> = None;
        let esp = if matches!(cara, Cara::S4 | Cara::S7) { 0.0 } else { esp };
        let esc = (self.m[0] * self.m[0] + self.m[1] * self.m[1]).sqrt().max(0.01); let t_pant = tam * esc;
        let plano = self.m[1].abs() < 1e-4 && self.m[2].abs() < 1e-4;
        for ch in s.chars() {
            if let Some(a) = ant { px += f.k.get(&(a, ch)).copied().unwrap_or(0.0) * k; } ant = Some(ch);
            let Some(g) = f.c.get(&ch).or(f.c.get(&'?')).copied() else { continue };
            if ch != ' ' && g[2] > 1.0 { if let Some(r) = self.gl.de(at, cara, ch, t_pant) {
                let l = GLI_LADO as f32; let uv = [[r[0] / l, r[1] / l], [(r[0] + r[2]) / l, r[1] / l], [(r[0] + r[2]) / l, (r[1] + r[3]) / l], [r[0] / l, (r[1] + r[3]) / l]];
                if plano {
                    // (sin giro: el punto de la base a un píxel entero de la pantalla y la letra 1:1, nítida)
                    let (ox, oy) = ((self.m[0] * px + self.m[4]).round() + r[4], (self.m[3] * base + self.m[5]).round() + r[5]);
                    let ant_m = self.m; self.m = IDENT;
                    self.quad(TEX_GLIFOS, [[ox, oy], [ox + r[2], oy], [ox + r[2], oy + r[3]], [ox, oy + r[3]]], uv, [c; 4]);
                    self.m = ant_m;
                } else {
                    let (qx, qy, qw, qh) = (px + r[4] / esc, base + r[5] / esc, r[2] / esc, r[3] / esc);
                    self.quad(TEX_GLIFOS, [[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], uv, [c; 4]);
                }
            } }
            px += g[6] * k + esp * tam;
        }
        px - x
    }
    /// un texto centrado en x
    pub fn texto_c(&mut self, cara: Cara, tam: f32, cx: f32, base: f32, c: Col, esp: f32, s: &str) -> f32 { let w = self.at.ancho(cara, tam, esp, s); self.texto(cara, tam, cx - w / 2.0, base, c, esp, s) }
    /// un texto que termina en x (a la derecha)
    pub fn texto_d(&mut self, cara: Cara, tam: f32, x1: f32, base: f32, c: Col, esp: f32, s: &str) -> f32 { let w = self.at.ancho(cara, tam, esp, s); self.texto(cara, tam, x1 - w, base, c, esp, s) }
    /// un texto que no pasa de `max` (si no entra, cortado con «…»)
    pub fn texto_max(&mut self, cara: Cara, tam: f32, x: f32, base: f32, c: Col, esp: f32, s: &str, max: f32) -> f32 {
        if self.at.ancho(cara, tam, esp, s) <= max { return self.texto(cara, tam, x, base, c, esp, s); }
        let mut t: String = s.to_string(); while !t.is_empty() && self.at.ancho(cara, tam, esp, &format!("{t}…")) > max { t.pop(); }
        self.texto(cara, tam, x, base, c, esp, &format!("{}…", t.trim_end()))
    }
    /// un ícono de la web (iconos.rs) en un cuadrado de `lado` px, con el trazo en unidades de 24 (stroke-width)
    pub fn icono(&mut self, n: &'static str, x: f32, y: f32, lado: f32, trazo: f32, c: Col) {
        // (pintado al tamaño de la pantalla: con la transformación de escala, al tamaño final)
        let esc = (self.m[0] * self.m[0] + self.m[1] * self.m[1]).sqrt().max(0.01);
        let Some(r) = self.ic.de(n, lado * esc, trazo) else { return };
        // (los de color —ico_…— van con sus colores: sólo se usa la opacidad)
        let c = if n.starts_with("ico_") { [1.0, 1.0, 1.0, c[3]] } else { c };
        let l = ICO_LADO as f32; let (u0, v0, u1, v1) = (r[0] / l, r[1] / l, (r[0] + r[2]) / l, (r[1] + r[3]) / l);
        // (al píxel: sin estirar el dibujo, centrado en el cuadrado pedido)
        let lado2 = r[2] / esc; let (x0, y0) = (x + (lado - lado2) / 2.0, y + (lado - lado2) / 2.0);
        self.quad(TEX_ICOS, [[x0, y0], [x0 + lado2, y0], [x0 + lado2, y0 + lado2], [x0, y0 + lado2]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [c; 4]);
    }
    /// una foto (textura `tex` de w × h) que cubre el rectángulo sin deformarse (object-fit: cover), corrida por `pos` (0..1:
    /// background-position)
    pub fn foto_cubre(&mut self, tex: i64, tw: f32, th: f32, x: f32, y: f32, w: f32, h: f32, pos: [f32; 2], c: Col) {
        if tw <= 0.0 || th <= 0.0 { return; }
        let k = (w / tw).max(h / th); let (vw, vh) = (w / k / tw, h / k / th);
        let (u0, v0) = ((1.0 - vw) * pos[0], (1.0 - vh) * pos[1]);
        self.quad(tex, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], [[u0, v0], [u0 + vw, v0], [u0 + vw, v0 + vh], [u0, v0 + vh]], [c; 4]);
    }
    /// una foto entera estirada en el rectángulo
    pub fn foto(&mut self, tex: i64, x: f32, y: f32, w: f32, h: f32, c: Col) { self.quad(tex, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]], [c; 4]); }
    /// lo que queda a la vista de un rectángulo con el recorte de ahora (para lo que se toca: lo tapado no se toca)
    pub fn en_recorte(&self, r: [f32; 4]) -> Option<[f32; 4]> {
        let Some(c) = self.recorte else { return Some(r) };
        let (x0, y0) = (r[0].max(c[0]), r[1].max(c[1])); let (x1, y1) = ((r[0] + r[2]).min(c[0] + c[2]), (r[1] + r[3]).min(c[1] + c[3]));
        if x1 - x0 < 4.0 || y1 - y0 < 4.0 { None } else { Some([x0, y0, x1 - x0, y1 - y0]) }
    }
    /// con la transformación `m` sumada mientras dibuja `f`
    pub fn con<R>(&mut self, m: [f32; 6], f: impl FnOnce(&mut Self) -> R) -> R { let ant = self.m; self.m = mm(ant, m); let r = f(self); self.m = ant; r }
    /// con la opacidad multiplicada
    pub fn con_alfa<R>(&mut self, a: f32, f: impl FnOnce(&mut Self) -> R) -> R { let ant = self.alfa; self.alfa *= a; let r = f(self); self.alfa = ant; r }
    /// con un recorte (sumado al que haya)
    pub fn con_recorte<R>(&mut self, r: [f32; 4], f: impl FnOnce(&mut Self) -> R) -> R {
        let ant = self.recorte;
        let n = match ant { Some(a) => { let (x0, y0) = (a[0].max(r[0]), a[1].max(r[1])); let (x1, y1) = ((a[0] + a[2]).min(r[0] + r[2]), (a[1] + a[3]).min(r[1] + r[3])); [x0, y0, (x1 - x0).max(0.0), (y1 - y0).max(0.0)] } None => r };
        self.recorte = Some(n); let s = f(self); self.recorte = ant; s
    }
}
