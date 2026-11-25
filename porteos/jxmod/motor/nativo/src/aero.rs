//! Aero: el kit de los menús nuevos del nativo, con la idea de Windows Vista (el vidrio Aero). El vidrio con el fondo
//! desenfocado detrás, las ventanas con la barra de título que brilla y el botón rojo de cerrar, los botones con brillo, las
//! pestañas, las filas elegidas, las casillas, las barras de progreso y de desplazamiento, los campos y la barra de tareas.
//! Todo dibujado con el pincel (pincel.rs), con colores y formas propias (sólo la idea del estilo), y con las medidas en «u»
//! (1 u = 1 px de la web en el celular de las pruebas: 873 × 393)
use crate::pincel::{self, Cara, Col, Pincel, TEX_MENUS};
use std::f32::consts::PI;

/// la textura del kit: una nube blanca suave (el brillo detrás de los títulos, las sombras y los reflejos)
pub const TEX_AERO: i64 = -2104;
const NUBE: u32 = 64;

/// la unidad de esta pantalla
pub fn unidad(w: f32, h: f32) -> f32 { (h / 393.0).min(w / 873.0).max(0.6) }
pub const fn hex(c: u32) -> Col { pincel::rgba(c, 1.0) }
pub const fn hexa(c: u32, a: f32) -> Col { pincel::rgba(c, a) }
pub const BLANCO: Col = [1.0, 1.0, 1.0, 1.0];
pub const fn blanco(a: f32) -> Col { [1.0, 1.0, 1.0, a] }
pub const fn negro(a: f32) -> Col { [0.0, 0.0, 0.0, a] }
/// los colores del texto de las ventanas (el de siempre, el gris, el título azul de las instrucciones y los enlaces)
pub const TXT: Col = hex(0x1b1b1b);
pub const GRIS: Col = hex(0x6b6f76);
pub const TITULO: Col = hex(0x1c3f94);
pub const ENLACE: Col = hex(0x0a64c8);
pub const LINEA: Col = hex(0xc9d0d9);
fn mezcla(a: Col, b: Col, t: f32) -> Col { [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t] }

/// la nube: blanca, con el borde que se apaga suave (smoothstep de la distancia al centro)
pub fn textura() -> (u32, u32, Vec<u8>) {
    let n = NUBE as usize; let mut px = vec![0u8; n * n * 4];
    for y in 0..n { for x in 0..n {
        let (dx, dy) = ((x as f32 + 0.5) / n as f32 * 2.0 - 1.0, (y as f32 + 0.5) / n as f32 * 2.0 - 1.0);
        let d = (dx * dx + dy * dy).sqrt().min(1.0); let a = 1.0 - d; let a = a * a * (3.0 - 2.0 * a);
        let i = (y * n + x) * 4; px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = (a * 255.0).round() as u8;
    } }
    (NUBE, NUBE, px)
}

/// una foto del fondo desenfocada para el vidrio: achicada a 320 px y tres pasadas de caja de radio 2 (como una gaussiana)
pub fn desenfocar(w: u32, h: u32, px: Vec<u8>) -> (u32, u32, Vec<u8>) {
    let (w, h, mut v) = pincel::achicar(w, h, px, 320); let (wu, hu) = (w as usize, h as usize); const R: i32 = 2;
    if wu < 2 || hu < 2 { return (w, h, v); }
    for _ in 0..3 {
        let mut o = v.clone();
        for y in 0..hu { for x in 0..wu { for c in 0..3 { let mut s = 0u32;
            for k in -R..=R { let xx = (x as i32 + k).clamp(0, wu as i32 - 1) as usize; s += v[(y * wu + xx) * 4 + c] as u32; }
            o[(y * wu + x) * 4 + c] = (s / (2 * R as u32 + 1)) as u8; } } }
        for y in 0..hu { for x in 0..wu { for c in 0..3 { let mut s = 0u32;
            for k in -R..=R { let yy = (y as i32 + k).clamp(0, hu as i32 - 1) as usize; s += o[(yy * wu + x) * 4 + c] as u32; }
            v[(y * wu + x) * 4 + c] = (s / (2 * R as u32 + 1)) as u8; } } }
    }
    for a in v.iter_mut().skip(3).step_by(4) { *a = 255; }
    (w, h, v)
}

/// cuántos tramos lleva cada esquina redondeada
fn pasos(r: [f32; 4]) -> [usize; 4] { r.map(|ra| if ra < 0.5 { 0 } else { ((ra / 1.5).ceil() as usize).clamp(3, 12) }) }
fn camino_n(x: f32, y: f32, w: f32, h: f32, r: [f32; 4], n: [usize; 4]) -> Vec<[f32; 2]> {
    let r = r.map(|v| v.max(0.0).min(w / 2.0).min(h / 2.0));
    let esq = [(x + r[0], y + r[0], r[0], PI), (x + w - r[1], y + r[1], r[1], PI * 1.5), (x + w - r[2], y + h - r[2], r[2], 0.0), (x + r[3], y + h - r[3], r[3], PI * 0.5)];
    let mut v = Vec::with_capacity(n.iter().sum::<usize>() + 4);
    for (i, (cx, cy, ra, a0)) in esq.into_iter().enumerate() {
        if n[i] == 0 { v.push([cx, cy]); continue; }
        for k in 0..=n[i] { let a = a0 + k as f32 / n[i] as f32 * PI / 2.0; v.push([cx + ra * a.cos(), cy + ra * a.sin()]); }
    }
    v
}
/// el borde de un rectángulo redondeado (las esquinas: arriba izq., arriba der., abajo der., abajo izq.), en el sentido del
/// reloj; con r = lado / 2, un círculo
pub fn camino(x: f32, y: f32, w: f32, h: f32, r: [f32; 4]) -> Vec<[f32; 2]> {
    let mut v = camino_n(x, y, w, h, r, pasos(r));
    v.dedup_by(|a, b| (a[0] - b[0]).abs() < 0.01 && (a[1] - b[1]).abs() < 0.01);
    if v.len() > 1 { let (a, b) = (v[0], v[v.len() - 1]); if (a[0] - b[0]).abs() < 0.01 && (a[1] - b[1]).abs() < 0.01 { v.pop(); } }
    v
}
pub fn circulo(cx: f32, cy: f32, r: f32) -> Vec<[f32; 2]> { camino(cx - r, cy - r, r * 2.0, r * 2.0, [r; 4]) }
pub fn dentro(r: [f32; 4], x: f32, y: f32) -> bool { x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3] }
pub fn agrandar(r: [f32; 4], dx: f32, dy: f32) -> [f32; 4] { [r[0] - dx, r[1] - dy, r[2] + 2.0 * dx, r[3] + 2.0 * dy] }

/// lo que devuelve una ventana: dónde quedó todo
#[derive(Clone, Copy, Debug, Default)]
pub struct Ventana { pub r: [f32; 4], pub cliente: [f32; 4], pub cerrar: Option<[f32; 4]>, pub atras: Option<[f32; 4]> }
/// cómo es una ventana
pub struct OpVentana<'s> {
    pub titulo: &'s str, pub ico: Option<&'static str>,
    /// con la flecha azul para volver (la de los asistentes) y con el botón rojo de cerrar
    pub atras: bool, pub cerrar: bool,
    /// con el adentro blanco (si no, todo vidrio)
    pub blanco: bool,
    /// lo que está apretado: 1 cerrar, 2 volver
    pub apretado: u8,
}
pub const BORDE: f32 = 6.0;
pub const ALTO_TITULO: f32 = 28.0;

/// cómo está un botón
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Est { Normal, Apretado, Elegido, Apagado }

pub trait Aero {
    fn relleno(&mut self, c: &[[f32; 2]], col: Col);
    /// un degradé en el camino `c`, en vertical (de a0 a a1 en y) u horizontal (en x), con las paradas (0..1, color)
    fn degrade(&mut self, c: &[[f32; 2]], vertical: bool, a0: f32, a1: f32, paradas: &[(f32, Col)]);
    /// el borde de grosor `g` de un rectángulo redondeado
    fn contorno(&mut self, x: f32, y: f32, w: f32, h: f32, r: [f32; 4], g: f32, col: Col);
    /// la nube suave alrededor de un rectángulo (`m` lo que se esfuma afuera; `centro`: también adentro)
    fn nube(&mut self, x: f32, y: f32, w: f32, h: f32, m: f32, col: Col, centro: bool);
    /// el vidrio: lo que hay detrás desenfocado (o, si no hay fondo, el color `sin`)
    fn vidrio(&mut self, c: &[[f32; 2]], sin: Col);
    /// los reflejos en diagonal del vidrio
    fn reflejos(&mut self, r: [f32; 4], a: f32);
    /// la lente del vidrio líquido: lo de atrás nítido y agrandado `zoom` veces alrededor de `cen` (false si no hay fondo)
    fn lente(&mut self, c: &[[f32; 2]], cen: [f32; 2], zoom: f32) -> bool;
    fn a_pantalla(&self, r: [f32; 4]) -> [f32; 4];
    /// un texto con sombra (el de los menús sobre el fondo)
    fn texto_sombra(&mut self, cara: Cara, tam: f32, x: f32, base: f32, col: Col, s: &str, d: f32) -> f32;
    /// el texto de un título sobre el vidrio: oscuro con el brillo blanco detrás
    fn texto_brillo(&mut self, cara: Cara, tam: f32, x: f32, base: f32, s: &str, max: f32, u: f32) -> f32;
}

impl<'a> Aero for Pincel<'a> {
    fn relleno(&mut self, c: &[[f32; 2]], col: Col) { let uv = self.uv_liso(); self.poli_gen(TEX_MENUS, c, |_| uv, |_| col); }
    fn degrade(&mut self, c: &[[f32; 2]], vertical: bool, a0: f32, a1: f32, paradas: &[(f32, Col)]) {
        if paradas.is_empty() { return; } if paradas.len() == 1 || (a1 - a0).abs() < 0.01 { self.relleno(c, paradas[0].1); return; }
        let uv = self.uv_liso(); let m = self.m; let plano = m[1].abs() < 1e-4 && m[2].abs() < 1e-4;
        let eje = |q: [f32; 2]| if vertical { q[1] } else { q[0] };
        if !plano {
            // (girado: sin los cortes, cada punto con su color)
            let col = |q: [f32; 2]| { let t = ((eje(q) - a0) / (a1 - a0)).clamp(0.0, 1.0); let mut c = paradas[0].1;
                for w in paradas.windows(2) { if t >= w[0].0 && t <= w[1].0 { let k = if w[1].0 > w[0].0 { (t - w[0].0) / (w[1].0 - w[0].0) } else { 1.0 }; c = mezcla(w[0].1, w[1].1, k); break; } else if t > w[1].0 { c = w[1].1; } }
                c };
            self.poli_gen(TEX_MENUS, c, |_| uv, col); return;
        }
        // (en franjas: cada una recortada y con su color lineal —exacto—; antes de la primera y después de la última, lisos)
        let a_pant = |v: f32| if vertical { m[3] * v + m[5] } else { m[0] * v + m[4] };
        let franja = |s0: f32, s1: f32| { let (lo, hi) = (s0.min(s1), s0.max(s1)); if vertical { [-1e5, lo, 2e5, hi - lo] } else { [lo, -1e5, hi - lo, 2e5] } };
        let n = paradas.len(); let pos = |i: usize| a0 + paradas[i].0 * (a1 - a0);
        let (p0, pn) = (pos(0), pos(n - 1)); let (c0, cn) = (paradas[0].1, paradas[n - 1].1);
        let lejos = if (a1 > a0) == (m[if vertical { 3 } else { 0 }] > 0.0) { 1e5 } else { -1e5 };
        self.con_recorte(franja(a_pant(p0) - lejos, a_pant(p0)), |p| p.poli_gen(TEX_MENUS, c, |_| uv, |_| c0));
        for i in 0..n - 1 {
            let (pa, pb) = (pos(i), pos(i + 1)); if (pb - pa).abs() < 0.01 { continue; }
            let (ca, cb) = (paradas[i].1, paradas[i + 1].1);
            self.con_recorte(franja(a_pant(pa), a_pant(pb)), |p| p.poli_gen(TEX_MENUS, c, |_| uv, |q| mezcla(ca, cb, (eje(q) - pa) / (pb - pa))));
        }
        self.con_recorte(franja(a_pant(pn), a_pant(pn) + lejos), |p| p.poli_gen(TEX_MENUS, c, |_| uv, |_| cn));
    }
    fn contorno(&mut self, x: f32, y: f32, w: f32, h: f32, r: [f32; 4], g: f32, col: Col) {
        if w <= 0.0 || h <= 0.0 { return; }
        let n = pasos(r); let a = camino_n(x, y, w, h, r, n); let b = camino_n(x + g, y + g, (w - 2.0 * g).max(0.0), (h - 2.0 * g).max(0.0), r.map(|v| (v - g).max(0.0)), n);
        let uv = self.uv_liso();
        for i in 0..a.len() { let j = (i + 1) % a.len(); self.quad(TEX_MENUS, [a[i], a[j], b[j], b[i]], [uv; 4], [col; 4]); }
    }
    fn nube(&mut self, x: f32, y: f32, w: f32, h: f32, m: f32, col: Col, centro: bool) {
        let xs = [x - m, x, x + w, x + w + m]; let ys = [y - m, y, y + h, y + h + m];
        let e = 0.5 / NUBE as f32; let us = [e, 0.5, 0.5, 1.0 - e];
        for j in 0..3 { for i in 0..3 {
            if i == 1 && j == 1 && !centro { continue; } if xs[i + 1] - xs[i] <= 0.0 || ys[j + 1] - ys[j] <= 0.0 { continue; }
            self.quad(TEX_AERO, [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]], [[us[i], us[j]], [us[i + 1], us[j]], [us[i + 1], us[j + 1]], [us[i], us[j + 1]]], [col; 4]);
        } }
    }
    fn vidrio(&mut self, c: &[[f32; 2]], sin: Col) {
        match self.vidrio.clone() {
            Some(v) if !v.capas.is_empty() => {
                self.relleno(c, hex(0x1a1d24)); let m = self.m;
                for (tex, k, a) in v.capas.iter() { let (k, a) = (*k, *a);
                    self.poli_gen(*tex, c, |q| { let (sx, sy) = (m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]); [k[0] * sx + k[1], k[2] * sy + k[3]] }, |_| [1.0, 1.0, 1.0, a]); }
            }
            _ => self.relleno(c, sin),
        }
    }
    fn lente(&mut self, c: &[[f32; 2]], cen: [f32; 2], zoom: f32) -> bool {
        let Some(v) = self.vidrio.clone() else { return false }; if v.nitidas.is_empty() { return false; }
        self.relleno(c, hex(0x1a1d24)); let m = self.m; let cs = [m[0] * cen[0] + m[2] * cen[1] + m[4], m[1] * cen[0] + m[3] * cen[1] + m[5]];
        for (tex, k, a) in v.nitidas.iter() { let (k, a) = (*k, *a);
            self.poli_gen(*tex, c, |q| { let (sx, sy) = (m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]);
                let (lx, ly) = (cs[0] + (sx - cs[0]) / zoom, cs[1] + (sy - cs[1]) / zoom); [k[0] * lx + k[1], k[2] * ly + k[3]] }, |_| [1.0, 1.0, 1.0, a]); }
        true
    }
    fn reflejos(&mut self, r: [f32; 4], a: f32) {
        let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let uv = self.uv_liso(); let rp = self.a_pantalla(r);
        self.con_recorte(rp, |p| {
            for (pos, ancho, k) in [(0.16f32, 0.09f32, 1.0f32), (0.27, 0.035, 0.8), (0.63, 0.13, 0.7), (0.84, 0.05, 0.6)] {
                let (xt, xb, bw) = (x + pos * w + h * 0.45, x + pos * w - h * 0.45, ancho * w.max(h)); let c = blanco(a * k); let z = blanco(0.0);
                p.quad(TEX_MENUS, [[xt - bw / 2.0, y], [xt, y], [xb, y + h], [xb - bw / 2.0, y + h]], [uv; 4], [z, c, c, z]);
                p.quad(TEX_MENUS, [[xt, y], [xt + bw / 2.0, y], [xb + bw / 2.0, y + h], [xb, y + h]], [uv; 4], [c, z, z, c]);
            }
        });
    }
    fn a_pantalla(&self, r: [f32; 4]) -> [f32; 4] {
        let m = self.m; let (x0, y0) = (m[0] * r[0] + m[4], m[3] * r[1] + m[5]); let (x1, y1) = (m[0] * (r[0] + r[2]) + m[4], m[3] * (r[1] + r[3]) + m[5]);
        [x0.min(x1), y0.min(y1), (x1 - x0).abs(), (y1 - y0).abs()]
    }
    fn texto_sombra(&mut self, cara: Cara, tam: f32, x: f32, base: f32, col: Col, s: &str, d: f32) -> f32 {
        self.texto(cara, tam, x + d * 0.5, base + d, negro(0.55 * col[3]), 0.0, s); self.texto(cara, tam, x, base, col, 0.0, s)
    }
    fn texto_brillo(&mut self, cara: Cara, tam: f32, x: f32, base: f32, s: &str, max: f32, u: f32) -> f32 {
        let w = self.at.ancho(cara, tam, 0.0, s).min(max); let (a, _) = self.at.metricas(cara, tam);
        self.nube(x + 2.0 * u, base - a * 0.85, (w - 4.0 * u).max(0.0), a * 0.9, 9.0 * u, blanco(0.62), true);
        self.texto_max(cara, tam, x, base, negro(0.9), 0.0, s, max)
    }
}

/// una ventana de vidrio: la sombra, el vidrio con su brillo y sus reflejos, los bordes, la barra de título (la flecha para
/// volver, el ícono, el título con su brillo y el botón rojo de cerrar) y el adentro blanco
pub fn ventana(p: &mut Pincel, r: [f32; 4], u: f32, o: &OpVentana) -> Ventana {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let (b, t) = (BORDE * u, ALTO_TITULO * u);
    let g = (0.75 * u).max(1.0);
    p.nube(x, y + 3.0 * u, w, h, 16.0 * u, negro(0.5), false);
    let rr = [7.0 * u, 7.0 * u, 5.0 * u, 5.0 * u]; let c = camino(x, y, w, h, rr);
    p.vidrio(&c, hexa(0x1e2b39, 0.9));
    p.relleno(&c, hexa(0x24405e, 0.30));
    p.degrade(&c, true, y, y + h, &[(0.0, blanco(0.36)), ((t / h).min(1.0), blanco(0.15)), (1.0, blanco(0.07))]);
    p.reflejos(r, 0.10);
    p.contorno(x, y, w, h, rr, g, negro(0.7));
    p.contorno(x + g, y + g, w - 2.0 * g, h - 2.0 * g, rr.map(|v| (v - g).max(0.0)), g, blanco(0.42));
    let cli = [x + b, y + t, w - 2.0 * b, h - t - b];
    if o.blanco {
        p.contorno(cli[0] - 2.0 * g, cli[1] - 2.0 * g, cli[2] + 4.0 * g, cli[3] + 4.0 * g, [0.0; 4], g, blanco(0.35));
        p.contorno(cli[0] - g, cli[1] - g, cli[2] + 2.0 * g, cli[3] + 2.0 * g, [0.0; 4], g, negro(0.55));
        p.degrade_v(cli[0], cli[1], cli[2], cli[3], &[(0.0, hex(0xffffff)), (1.0, hex(0xf3f6fa))]);
    }
    // —— la barra de título ——
    let mut x0 = x + 9.0 * u; let mut atras = None;
    if o.atras {
        let d = 22.0 * u; let ra = [x0 - 2.0 * u, y + (t - d) / 2.0, d, d];
        flecha_volver(p, ra, u, o.apretado == 2); atras = Some(agrandar(ra, 6.0 * u, 3.0 * u)); x0 += d + 7.0 * u;
    }
    if let Some(i) = o.ico { p.icono(i, x0, y + (t - 16.0 * u) / 2.0, 16.0 * u, 2.0, BLANCO); x0 += 21.0 * u; }
    let (bw, bh) = (42.0 * u, 19.0 * u); let bx = x + w - b - bw;
    let tam = 13.0 * u; let base = p.at.base_centrada(Cara::S4, tam, t, y, t);
    p.texto_brillo(Cara::S4, tam, x0, base, o.titulo, (if o.cerrar { bx } else { x + w - b }) - x0 - 8.0 * u, u);
    let mut cerrar = None;
    if o.cerrar { let rc = [bx, y + g, bw, bh]; boton_cerrar(p, rc, u, o.apretado == 1); cerrar = Some([bx - 8.0 * u, y, bw + 8.0 * u + b, bh + 9.0 * u]); }
    Ventana { r, cliente: cli, cerrar, atras }
}

/// el botón rojo de cerrar (la mitad de arriba clara, la de abajo roja, un brillo naranja abajo y la cruz blanca)
pub fn boton_cerrar(p: &mut Pincel, r: [f32; 4], u: f32, apretado: bool) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let rr = [0.0, 0.0, 4.0 * u, 4.0 * u]; let c = camino(x, y, w, h, rr); let g = (0.75 * u).max(1.0);
    let par: [(f32, Col); 4] = if apretado { [(0.0, hex(0xd28a7c)), (0.48, hex(0xb5543f)), (0.52, hex(0x8e1d08)), (1.0, hex(0xb2401f))] }
        else { [(0.0, hex(0xeaa999)), (0.48, hex(0xd6806e)), (0.52, hex(0xc13b25)), (1.0, hex(0xd65b3b))] };
    p.degrade(&c, true, y, y + h, &par);
    p.con_recorte(p.a_pantalla(r), |p| p.nube(x + w * 0.3, y + h * 0.86, w * 0.4, h * 0.2, h * 0.35, hexa(0xffb25a, if apretado { 0.3 } else { 0.55 }), true));
    p.contorno(x, y, w, h, rr, g, hexa(0x3a0a02, 0.85));
    p.contorno(x + g, y + g, w - 2.0 * g, h - 2.0 * g, rr.map(|v| (v - g).max(0.0)), g, blanco(0.32));
    let (cx, cy, s, gr) = (x + w / 2.0, y + h / 2.0, 4.4 * u, 2.1 * u);
    for (d, col) in [(0.7 * u, hexa(0x3a0a02, 0.6)), (0.0, BLANCO)] {
        p.linea([cx - s, cy - s + d], [cx + s, cy + s + d], gr, col); p.linea([cx + s, cy - s + d], [cx - s, cy + s + d], gr, col);
    }
}

/// la flecha redonda azul para volver (la de los asistentes)
pub fn flecha_volver(p: &mut Pincel, r: [f32; 4], u: f32, apretado: bool) {
    let (x, y, d) = (r[0], r[1], r[2]); let (cx, cy, ra) = (x + d / 2.0, y + d / 2.0, d / 2.0); let c = circulo(cx, cy, ra);
    let k = if apretado { 0.78 } else { 1.0 }; let f = |c: u32| { let v = hex(c); [v[0] * k, v[1] * k, v[2] * k, 1.0] };
    p.degrade(&c, true, y, y + d, &[(0.0, f(0x63aef0)), (0.5, f(0x2c74c8)), (0.5, f(0x1a5ab0)), (1.0, f(0x4aa0ea))]);
    let ci = circulo(cx, cy - ra * 0.38, ra * 0.62); p.degrade(&ci, true, cy - ra, cy, &[(0.0, blanco(0.6)), (1.0, blanco(0.05))]);
    p.contorno(x, y, d, d, [ra; 4], (0.8 * u).max(1.0), hexa(0x0b2a5a, 0.9));
    let (s, g) = (ra * 0.48, 2.3 * u);
    p.linea([cx - s, cy], [cx + s, cy], g, BLANCO); p.linea([cx - s - g * 0.3, cy + g * 0.3], [cx, cy - s * 0.9], g, BLANCO); p.linea([cx - s - g * 0.3, cy - g * 0.3], [cx, cy + s * 0.9], g, BLANCO);
}

/// un botón de los de las ventanas: gris con la mitad de arriba más clara; apretado, celeste; el elegido, con el borde azul
pub fn boton(p: &mut Pincel, r: [f32; 4], u: f32, txt: &str, ico: Option<&'static str>, e: Est) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let rr = [3.0 * u; 4]; let c = camino(x, y, w, h, rr); let g = (0.75 * u).max(1.0);
    let (par, borde): ([(f32, Col); 4], Col) = match e {
        Est::Apretado => ([(0.0, hex(0xe4f3fb)), (0.5, hex(0xc4e4f5)), (0.5, hex(0x98d0ee)), (1.0, hex(0x6ab4dc))], hex(0x2c628b)),
        Est::Apagado => ([(0.0, hex(0xf4f4f4)), (0.5, hex(0xf4f4f4)), (0.5, hex(0xf4f4f4)), (1.0, hex(0xf4f4f4))], hex(0xadb2b5)),
        Est::Elegido => ([(0.0, hex(0xf2f8fc)), (0.5, hex(0xe6f1f9)), (0.5, hex(0xcfe5f5)), (1.0, hex(0xb9daf1))], hex(0x3c7fb1)),
        Est::Normal => ([(0.0, hex(0xf6f6f6)), (0.5, hex(0xebebeb)), (0.5, hex(0xdcdcdc)), (1.0, hex(0xcdcdcd))], hex(0x707070)),
    };
    p.degrade(&c, true, y, y + h, &par);
    p.contorno(x, y, w, h, rr, g, borde);
    p.contorno(x + g, y + g, w - 2.0 * g, h - 2.0 * g, rr.map(|v| (v - g).max(0.0)), g, blanco(if e == Est::Apagado { 0.0 } else { 0.75 }));
    let col = if e == Est::Apagado { hex(0x8a8a8a) } else { TXT };
    let tam = (13.0 * u).min(h * 0.5); let base = p.at.base_centrada(Cara::S4, tam, h, y, h);
    let tw = p.at.ancho(Cara::S4, tam, 0.0, txt); let iw = if ico.is_some() { 16.0 * u + if txt.is_empty() { 0.0 } else { 6.0 * u } } else { 0.0 };
    let x0 = x + (w - tw - iw) / 2.0;
    if let Some(i) = ico { p.icono(i, x0, y + (h - 16.0 * u) / 2.0, 16.0 * u, 2.0, if i.starts_with("ico_") { BLANCO } else { col }); }
    p.texto_max(Cara::S4, tam, x0 + iw, base, col, 0.0, txt, w - 8.0 * u - iw);
}

/// el botón principal sobre el vidrio oscuro: azul con brillo (la mitad de arriba clara) y un resplandor celeste abajo
pub fn boton_azul(p: &mut Pincel, r: [f32; 4], u: f32, apretado: bool) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let rr = [3.0 * u; 4]; let c = camino(x, y, w, h, rr); let g = (0.75 * u).max(1.0);
    let k = if apretado { 0.78 } else { 1.0 }; let f = |c: u32| { let v = hex(c); [v[0] * k, v[1] * k, v[2] * k, 1.0] };
    p.degrade(&c, true, y, y + h, &[(0.0, f(0x86c6ff)), (0.5, f(0x3a8ee6)), (0.5, f(0x1b6acc)), (1.0, f(0x3d97f0))]);
    p.con_recorte(p.a_pantalla(r), |p| p.nube(x + w * 0.2, y + h * 0.88, w * 0.6, h * 0.12, h * 0.45, hexa(0xa8e4ff, if apretado { 0.3 } else { 0.5 }), true));
    p.contorno(x, y, w, h, rr, g, hex(0x0a2b5e));
    p.contorno(x + g, y + g, w - 2.0 * g, h - 2.0 * g, rr.map(|v| (v - g).max(0.0)), g, blanco(0.42));
}

/// un botón de vidrio (los de la barra de tareas y los que van sobre el vidrio)
pub fn boton_vidrio(p: &mut Pincel, r: [f32; 4], u: f32, apretado: bool, activo: bool) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let rr = [3.0 * u; 4]; let c = camino(x, y, w, h, rr); let g = (0.75 * u).max(1.0);
    let k = if apretado { 0.55 } else if activo { 1.25 } else { 1.0 };
    p.degrade(&c, true, y, y + h, &[(0.0, blanco(0.30 * k)), (0.5, blanco(0.12 * k)), (0.5, blanco(0.03 * k)), (1.0, blanco(0.14 * k))]);
    if apretado { p.relleno(&c, negro(0.25)); }
    if activo || apretado { p.con_recorte(p.a_pantalla(r), |p| p.nube(x + w * 0.2, y + h * 0.9, w * 0.6, h * 0.1, h * 0.5, hexa(0x9fd6ff, 0.55), true)); }
    p.contorno(x, y, w, h, rr, g, negro(0.6));
    p.contorno(x + g, y + g, w - 2.0 * g, h - 2.0 * g, rr.map(|v| (v - g).max(0.0)), g, blanco(0.32));
}

/// una fila elegida (o apretada: más fuerte) en una lista: celeste con el borde azul
pub fn fila_sel(p: &mut Pincel, r: [f32; 4], u: f32, fuerte: bool) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let rr = [3.0 * u; 4]; let c = camino(x, y, w, h, rr); let g = (0.75 * u).max(1.0);
    if fuerte { p.degrade(&c, true, y, y + h, &[(0.0, hex(0xdcebfc)), (1.0, hex(0xc1dcfc))]); p.contorno(x, y, w, h, rr, g, hex(0x7da2ce)); }
    else { p.degrade(&c, true, y, y + h, &[(0.0, hex(0xf4f9fe)), (1.0, hex(0xe0eefd))]); p.contorno(x, y, w, h, rr, g, hex(0xa9cbf2)); }
    p.contorno(x + g, y + g, w - 2.0 * g, h - 2.0 * g, rr.map(|v| (v - g).max(0.0)), g, blanco(0.7));
}

/// una fila elegida sobre el vidrio (la del menú de inicio)
pub fn fila_vidrio(p: &mut Pincel, r: [f32; 4], u: f32, fuerte: bool) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let rr = [4.0 * u; 4]; let c = camino(x, y, w, h, rr); let g = (0.75 * u).max(1.0);
    p.vidrio(&c, hexa(0x203040, 0.0));
    let k = if fuerte { 1.3 } else { 1.0 };
    p.relleno(&c, hexa(0x3a6ea8, 0.22 * k));
    p.degrade(&c, true, y, y + h, &[(0.0, blanco(0.30 * k)), (0.5, blanco(0.10 * k)), (0.5, blanco(0.04 * k)), (1.0, blanco(0.12 * k))]);
    p.contorno(x, y, w, h, rr, g, negro(0.55));
    p.contorno(x + g, y + g, w - 2.0 * g, h - 2.0 * g, rr.map(|v| (v - g).max(0.0)), g, blanco(0.5));
}

/// las pestañas (como las de las hojas de propiedades): devuelve dónde quedó cada una. La de `sel` está delante, blanca y un
/// poco más alta; abajo, la raya del borde de la hoja
pub fn pestanas(p: &mut Pincel, x: f32, y: f32, w: f32, u: f32, nombres: &[&str], sel: usize, apretada: Option<usize>) -> Vec<[f32; 4]> {
    let h = 26.0 * u; let tam = 12.5 * u; let pad = 12.0 * u; let g = (0.75 * u).max(1.0);
    let anchos: Vec<f32> = nombres.iter().map(|n| p.at.ancho(Cara::S4, tam, 0.0, n) + pad * 2.0).collect();
    let total: f32 = anchos.iter().sum(); let k = if total > w - 4.0 * u { (w - 4.0 * u) / total } else { 1.0 };
    let mut xs = vec![]; let mut cx = x + 2.0 * u; for a in &anchos { xs.push(cx); cx += a * k; }
    let base_y = y + h;
    p.rect(x, base_y - g, w, g, hex(0x898c95));
    let mut rects = vec![[0.0f32; 4]; nombres.len()];
    for pase in 0..2 { for (i, n) in nombres.iter().enumerate() {
        let es = i == sel; if (pase == 0) == es { continue; }
        let (tx, tw) = (xs[i] - if es { 2.0 * u } else { 0.0 }, anchos[i] * k + if es { 4.0 * u } else { 0.0 });
        let ty = if es { y } else { y + 2.0 * u }; let th = base_y - ty + if es { g } else { 0.0 };
        let rr = [3.0 * u, 3.0 * u, 0.0, 0.0]; let c = camino(tx, ty, tw, th, rr);
        if es { p.relleno(&c, hex(0xffffff)); }
        else if apretada == Some(i) { p.degrade(&c, true, ty, ty + th, &[(0.0, hex(0xeaf6fd)), (1.0, hex(0xa7d9f5))]); }
        else { p.degrade(&c, true, ty, ty + th, &[(0.0, hex(0xf6f6f6)), (0.5, hex(0xeaeaea)), (1.0, hex(0xd9d9d9))]); }
        let b = if apretada == Some(i) && !es { hex(0x3c7fb1) } else { hex(0x898c95) };
        p.rect(tx, ty + 3.0 * u, g, th - 3.0 * u - if es { g } else { 0.0 }, b); p.rect(tx + tw - g, ty + 3.0 * u, g, th - 3.0 * u - if es { g } else { 0.0 }, b);
        p.contorno(tx, ty, tw, 3.0 * u + g, [3.0 * u, 3.0 * u, 0.0, 0.0], g, b);
        p.rect(tx + 3.0 * u, ty, tw - 6.0 * u, g, b);
        let base = p.at.base_centrada(Cara::S4, tam, th, ty, th);
        p.texto_max(Cara::S4, tam, tx + pad * k.max(0.5), base, if es { TXT } else { hex(0x30343a) }, 0.0, n, tw - pad);
        rects[i] = [tx, ty, tw, th];
    } }
    rects
}

/// una casilla para marcar
pub fn casilla(p: &mut Pincel, x: f32, y: f32, u: f32, marcada: bool, apretada: bool) {
    let s = 16.0 * u; let g = (0.75 * u).max(1.0);
    p.rect(x, y, s, s, if apretada { hex(0x2c628b) } else { hex(0x8f8f8f) });
    p.rect(x + g, y + g, s - 2.0 * g, s - 2.0 * g, hex(0xf4f4f4));
    let i = 3.0 * u; let c = [x + i, y + i, s - 2.0 * i, s - 2.0 * i];
    if apretada { p.degrade_v(c[0], c[1], c[2], c[3], &[(0.0, hex(0xc4e4f5)), (1.0, hex(0xeaf6fd))]); } else { p.degrade_v(c[0], c[1], c[2], c[3], &[(0.0, hex(0xd8dbe0)), (1.0, hex(0xfafafa))]); }
    if marcada { let gr = 2.4 * u; let col = hex(0x1f3a7a);
        p.linea([x + s * 0.24, y + s * 0.52], [x + s * 0.43, y + s * 0.72], gr, col); p.linea([x + s * 0.41, y + s * 0.73], [x + s * 0.78, y + s * 0.28], gr, col); }
}

/// una barra de progreso (verde con brillo, y el destello que la recorre)
pub fn progreso(p: &mut Pincel, r: [f32; 4], u: f32, frac: f32, t: f32, error: bool) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let rr = [2.0 * u; 4]; let g = (0.75 * u).max(1.0);
    let c = camino(x, y, w, h, rr); p.degrade(&c, true, y, y + h, &[(0.0, hex(0xe6e6e6)), (1.0, hex(0xf8f8f8))]);
    let fw = (w - 2.0 * g) * frac.clamp(0.0, 1.0);
    if fw > 0.5 {
        let (bx, by, bh) = (x + g, y + g, h - 2.0 * g); let cb = camino(bx, by, fw, bh, [1.5 * u; 4]);
        let par: [(f32, Col); 4] = if error { [(0.0, hex(0xf4a0a0)), (0.45, hex(0xd83a3a)), (0.5, hex(0xc41f1f)), (1.0, hex(0xe46060))] }
            else { [(0.0, hex(0xb4f2ad)), (0.45, hex(0x3ccb45)), (0.5, hex(0x22b22d)), (1.0, hex(0x5fd866))] };
        p.degrade(&cb, true, by, by + bh, &par);
        // (el destello que corre de izquierda a derecha cada 2,5 s)
        let k = (t % 2.5) / 2.5; let sx = bx - w * 0.25 + k * (fw + w * 0.5);
        p.con_recorte(p.a_pantalla([bx, by, fw, bh]), |p| p.nube(sx, by + bh * 0.15, w * 0.04, bh * 0.7, w * 0.08, blanco(0.45), true));
    }
    p.contorno(x, y, w, h, rr, g, hex(0xb2b2b2));
}

/// una barra de desplazamiento vertical: `desde` y `cuanto` (0..1) de lo que se ve
pub fn barra_desplazar(p: &mut Pincel, r: [f32; 4], u: f32, desde: f32, cuanto: f32) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let g = (0.75 * u).max(1.0);
    p.rect(x, y, w, h, hex(0xeeeeee)); p.rect(x, y, g, h, hex(0xe0e0e0));
    if cuanto >= 0.999 { return; }
    let th = (h * cuanto).max(18.0 * u).min(h); let ty = y + (h - th) * (desde / (1.0 - cuanto).max(0.001)).clamp(0.0, 1.0);
    let (tx, tw) = (x + 2.0 * u, w - 4.0 * u); let rr = [2.0 * u; 4]; let c = camino(tx, ty, tw, th, rr);
    p.degrade(&c, false, tx, tx + tw, &[(0.0, hex(0xf1f3f6)), (0.5, hex(0xe2e6ec)), (0.5, hex(0xd4dae3)), (1.0, hex(0xc8cfd9))]);
    p.contorno(tx, ty, tw, th, rr, g, hex(0x9aa3b0));
    let cy = ty + th / 2.0; for k in -1..=1 { let yy = cy + k as f32 * 2.5 * u; p.rect(tx + tw * 0.3, yy, tw * 0.4, g, hex(0x7f8896)); p.rect(tx + tw * 0.3, yy + g, tw * 0.4, g, blanco(0.8)); }
}

/// un campo para escribir (blanco con el borde gris; vacío, el texto de ayuda en gris)
pub fn campo(p: &mut Pincel, r: [f32; 4], u: f32, txt: &str, ayuda: &str, apretado: bool) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let g = (0.75 * u).max(1.0);
    p.rect(x, y, w, h, hex(0xffffff)); p.borde(x, y, w, h, g, if apretado { hex(0x3c7fb1) } else { hex(0xabadb3) }); p.rect(x + g, y + g, w - 2.0 * g, g, hex(0xe3e9ef));
    let tam = 13.0 * u; let base = p.at.base_centrada(Cara::S4, tam, h, y, h);
    if txt.is_empty() { p.texto_max(Cara::S4, tam, x + 7.0 * u, base, hex(0x8d9199), 0.0, ayuda, w - 14.0 * u); } else { p.texto_max(Cara::S4, tam, x + 7.0 * u, base, TXT, 0.0, txt, w - 14.0 * u); }
}

/// la barra de tareas: vidrio negro con el brillo arriba
pub fn barra_tareas(p: &mut Pincel, r: [f32; 4], u: f32) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let c = camino(x, y, w, h, [0.0; 4]); let g = (0.75 * u).max(1.0);
    p.vidrio(&c, hexa(0x0b0d10, 0.88));
    p.relleno(&c, negro(0.64));
    p.degrade(&c, true, y, y + h, &[(0.0, blanco(0.20)), (0.5, blanco(0.07)), (0.5, blanco(0.0)), (1.0, blanco(0.04))]);
    p.reflejos(r, 0.05);
    p.rect(x, y, w, g, blanco(0.38)); p.rect(x, y + g, w, g, negro(0.6));
}

/// un panel de vidrio sin barra de título (los «gadgets» de la derecha del inicio)
pub fn tarjeta(p: &mut Pincel, r: [f32; 4], u: f32, apretada: bool) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let rr = [6.0 * u; 4]; let c = camino(x, y, w, h, rr); let g = (0.75 * u).max(1.0);
    p.nube(x, y + 2.0 * u, w, h, 10.0 * u, negro(0.4), false);
    p.vidrio(&c, hexa(0x1e2b39, 0.85));
    p.relleno(&c, if apretada { hexa(0x10243c, 0.5) } else { hexa(0x14263c, 0.36) });
    p.degrade(&c, true, y, y + h, &[(0.0, blanco(0.22)), (0.35, blanco(0.06)), (1.0, blanco(0.03))]);
    p.reflejos(r, 0.07);
    p.contorno(x, y, w, h, rr, g, negro(0.6));
    p.contorno(x + g, y + g, w - 2.0 * g, h - 2.0 * g, rr.map(|v| (v - g).max(0.0)), g, blanco(0.35));
}

/// el orbe de JXMod (el botón redondo de la barra de tareas: vidrio oscuro con el brillo arriba y «JX»)
pub fn orbe(p: &mut Pincel, cx: f32, cy: f32, ra: f32, u: f32, apretado: bool) {
    let c = circulo(cx, cy, ra); let k = if apretado { 0.8 } else { 1.0 };
    let f = |c: u32| { let v = hex(c); [v[0] * k, v[1] * k, v[2] * k, 1.0] };
    p.nube(cx - ra * 0.6, cy - ra * 0.6, ra * 1.2, ra * 1.2, ra * 0.7, hexa(0x7fc8ff, if apretado { 0.5 } else { 0.32 }), false);
    p.degrade(&c, true, cy - ra, cy + ra, &[(0.0, f(0x3d4d63)), (0.5, f(0x18212e)), (0.5, f(0x0a0f16)), (1.0, f(0x1f6b9e))]);
    p.con_recorte(p.a_pantalla([cx - ra, cy - ra, ra * 2.0, ra * 2.0]), |p| p.nube(cx - ra * 0.35, cy + ra * 0.55, ra * 0.7, ra * 0.25, ra * 0.5, hexa(0x6fd0ff, 0.7), true));
    let ci = circulo(cx, cy - ra * 0.42, ra * 0.7); p.degrade(&ci, true, cy - ra * 1.1, cy + ra * 0.1, &[(0.0, blanco(0.5)), (1.0, blanco(0.02))]);
    p.contorno(cx - ra, cy - ra, ra * 2.0, ra * 2.0, [ra; 4], (0.9 * u).max(1.0), negro(0.75));
    p.contorno(cx - ra + u, cy - ra + u, ra * 2.0 - 2.0 * u, ra * 2.0 - 2.0 * u, [ra - u; 4], (0.75 * u).max(1.0), blanco(0.3));
    let tam = ra * 0.95; let base = p.at.base_centrada(Cara::O6, tam, ra * 2.0, cy - ra, ra * 2.0);
    p.texto_c(Cara::O6, tam, cx + ra * 0.03, base + u * 0.6, negro(0.6), 0.02, "JX"); p.texto_c(Cara::O6, tam, cx, base, BLANCO, 0.02, "JX");
}

/// un recuadro de vidrio líquido (las opciones del menú): una cápsula con la sombra suave, el borde de vidrio grueso
/// (desenfocado), el centro como una lente (lo de atrás nítido y un poco agrandado), un velo blanco leve, el brillo de arriba,
/// el filo con luz (fuerte arriba, tenue abajo) y un reflejo chico. Jugando (sin fondo de fotos), vidrio liso translúcido
pub fn vidrio_liquido(p: &mut Pincel, r: [f32; 4], u: f32, apretado: bool) {
    let (x, y, w, h) = (r[0], r[1], r[2], r[3]); let ra = h * 0.5; let rr = [ra; 4]; let c = camino(x, y, w, h, rr); let g = (0.9 * u).max(1.0);
    p.nube(x + 3.0 * u, y + 4.0 * u, w - 6.0 * u, h - 4.0 * u, 9.0 * u, negro(0.28), false);
    p.vidrio(&c, hexa(0x1c2a3c, 0.5));
    let e = (h * 0.16).min(5.0 * u); let ci = camino(x + e, y + e, w - 2.0 * e, h - 2.0 * e, [ra - e; 4]);
    p.lente(&ci, [x + w / 2.0, y + h / 2.0], 1.12);
    // (un velo oscuro para que la letra blanca se lea sobre un cielo claro, y el blanco del vidrio encima)
    p.relleno(&c, hexa(0x0c1420, if apretado { 0.12 } else { 0.30 }));
    p.relleno(&c, blanco(if apretado { 0.20 } else { 0.05 }));
    p.degrade(&c, true, y, y + h, &[(0.0, blanco(0.22)), (0.42, blanco(0.05)), (0.55, blanco(0.0)), (1.0, blanco(0.05))]);
    let rp = p.a_pantalla(r);
    p.con_recorte([rp[0] - 2.0, rp[1] - 2.0, rp[2] + 4.0, rp[3] * 0.5 + 2.0], |p| p.contorno(x, y, w, h, rr, g, blanco(0.78)));
    p.con_recorte([rp[0] - 2.0, rp[1] + rp[3] * 0.5, rp[2] + 4.0, rp[3] * 0.5 + 2.0], |p| p.contorno(x, y, w, h, rr, g, blanco(0.32)));
    p.contorno(x - g, y - g, w + 2.0 * g, h + 2.0 * g, rr.map(|v| v + g), g, negro(0.22));
    p.con_recorte(rp, |p| p.nube(x + ra * 0.9, y + h * 0.14, (w * 0.22).min(60.0 * u), h * 0.06, h * 0.18, blanco(0.45), true));
}
