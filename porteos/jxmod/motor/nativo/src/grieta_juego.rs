//! La grieta (evento.js de la web): una grieta en el cielo de los mapas del juego (no en los de GMod, los del Workshop ni la
//! pizzería, que tienen su cielo) y, de vez en cuando, cosas que caen de ella encendidas (de 1 a 6). La grieta es la misma
//! de la web: la forma de la fractura (la quebrada con ramas, semilla 4242), el resplandor difuminado, el estallido de
//! vetas, el núcleo y el fondo oscuro; acá se hornea todo una vez en Rust en dos texturas (lo que brilla, que suma luz, y
//! lo oscuro, que tapa el cielo) y se dibuja en el pase del cielo del motor (FL_CIELO: detrás de todo, en el infinito, sólo
//! gira con la vista). Lo que cae: un objeto del juego que baja por una parábola girando, con estela de fuego y humo, la luz,
//! el silbido, y al pegar el polvo, el temblor y el golpe; queda la cosa de verdad con un poco del envión, o explota. En una
//! sala no caen (lo reparte uno solo y eso todavía no está en la nativa).
use super::*;
use jxjuego::efectos::Tipo;
use jxmotor::escena::{ItemDin, Malla, Mat, FL_CIELO, FL_SIN_SOMBRA};

/// el plano de la grieta va de -S a S (las vetas más largas llegan a ~1,85) y cada unidad es TAM de la vista (a 1 m)
const S: f32 = 1.95;
const TAM: f32 = 0.34;
/// a cuántos metros de la cámara se dibuja (el pase del cielo borra la profundidad: siempre queda detrás del mapa; cerca,
/// la niebla no la tapa)
const LEJOS: f32 = 12.0;
pub const TEX_BRILLO: i64 = -2310;
pub const TEX_FONDO: i64 = -2311;
const MALLA: i64 = -2310;
const MAT_BRILLO: i64 = -2310;
const MAT_FONDO: i64 = -2311;
/// (el pulso cuando empieza a caer algo: la misma luz otra vez encima, más o menos fuerte)
const MAT_PULSO: [i64; 4] = [-2312, -2313, -2314, -2315];
/// las cosas que caen: [nombre, peso, tamaño del fuego, probabilidad de explotar, tamaño de la explosión]
const COSAS: [(&str, u32, f32, f32, f32); 17] = [("CajaMadera", 6, 1.2, 0.0, 0.0), ("Barril", 4, 1.1, 0.0, 0.0), ("Neumatico", 4, 1.0, 0.0, 0.0), ("Roca", 3, 1.8, 0.0, 0.0),
    ("Lavarropas", 3, 1.3, 0.0, 0.0), ("Heladera", 2, 1.4, 0.0, 0.0), ("Sofa", 2, 1.6, 0.0, 0.0), ("Carrito", 2, 1.2, 0.0, 0.0), ("Sandia", 2, 0.7, 0.0, 0.0), ("Cono", 2, 0.7, 0.0, 0.0),
    ("Radiador", 1, 1.0, 0.0, 0.0), ("Arcade", 1, 1.5, 0.0, 0.0), ("Contenedor", 1, 2.6, 0.0, 0.0), ("BarrilExplosivo", 3, 1.0, 0.8, 1.6), ("Garrafa", 2, 0.9, 0.8, 1.3),
    ("BidonNafta", 1, 0.8, 0.8, 1.1), ("Sedan", 1, 2.6, 0.4, 2.2)];
/// ¿este mapa tiene la grieta? (los del juego, salvo los de GMod y la pizzería) ¿y caídas? (no en el espacio)
pub fn con_grieta(m: &str) -> bool { !m.starts_with("WS_") && jxjuego::red::MAPAS_PUBLICA.contains(&m) && !matches!(m, "RB_Construct" | "RB_Flatgrass" | "RB_Pizzeria") }
pub fn con_caidas(m: &str) -> bool { con_grieta(m) && m != "Space" }
fn hash(s: &str) -> f32 { let mut h: u32 = 2166136261; for c in s.encode_utf16() { h ^= c as u32; h = h.wrapping_mul(16777619); } h as f32 / 4294967296.0 }

// ---------------- la forma y el horneado (evtForma, evtRaster, evtBorronear, evtLienzo y los sombreadores) ----------------
#[derive(Clone, Copy)]
struct Seg { a: [f32; 2], b: [f32; 2], w: f32, i: f32 }
/// la forma de la fractura: la misma del tráiler y de la web (semilla 4242, los mismos pasos en el mismo orden)
fn forma() -> Vec<Seg> {
    let mut sem: i64 = 4242; let mut rnd = move || { sem = (sem * 16807) % 2147483647; sem as f64 / 2147483647.0 };
    let mut segs = vec![];
    fn rama(segs: &mut Vec<Seg>, rnd: &mut dyn FnMut() -> f64, x: f64, y: f64, ang: f64, l: f64, nivel: usize, ancho: f64, brillo: f64) {
        let (mut a, mut px, mut py, mut rec) = (ang, x, y, 0.0); let paso0 = [0.016, 0.013, 0.011, 0.009][nivel];
        while rec < l {
            let dl = paso0 * (0.55 + rnd() * 0.9);
            a += (if rnd() < 0.22 { (rnd() - 0.5) * 1.6 } else { (rnd() - 0.5) * 0.5 }) + (ang - a) * 0.3;
            let (nx, ny, u) = (px + a.cos() * dl, py + a.sin() * dl, rec / l);
            segs.push(Seg { a: [px as f32, py as f32], b: [nx as f32, ny as f32], w: (ancho * (1.0 - 0.75 * u)) as f32, i: (brillo * (1.0 - 0.45 * u)) as f32 });
            if nivel < 3 && rnd() < [0.05, 0.055, 0.03][nivel] {
                let s = if rnd() < 0.5 { 1.0 } else { -1.0 }; let da = s * (0.35 + rnd() * 0.75); let ll = l * (0.18 + rnd() * 0.32) * (1.0 - u * 0.45);
                rama(segs, rnd, nx, ny, a + da, ll, nivel + 1, ancho * 0.62, brillo * 0.85);
            }
            px = nx; py = ny; rec += dl;
        }
    }
    let ang = -0.62f64;
    rama(&mut segs, &mut rnd, 0.0, 0.0, ang, 1.0, 0, 1.0, 1.0);
    rama(&mut segs, &mut rnd, 0.0, 0.0, ang + std::f64::consts::PI, 0.85, 0, 1.0, 1.0);
    for i in 0..8 { let x = (rnd() - 0.5) * 0.02; let y = (rnd() - 0.5) * 0.02; let a = i as f64 * 0.785 + rnd() * 0.4; let l = 0.04 + rnd() * 0.09; rnd(); rama(&mut segs, &mut rnd, x, y, a, l, 3, 0.7, 0.9); }
    for i in 0..4 { let k = 0.18 + i as f64 * 0.14; let (x, y) = (ang.cos() * k, ang.sin() * k); let a = -1.3 - rnd() * 0.45; let l = 0.35 + rnd() * 0.3; rama(&mut segs, &mut rnd, x, y, a, l, 2, 0.75, 0.85); }
    segs
}
/// cada tramo con su ancho (en unidades del plano) rasterizado: el valor más alto de los que pasan (como «lighten»)
fn raster(segs: &[Seg], n: usize, ancho: impl Fn(&Seg) -> f32, perfil: impl Fn(f32, f32) -> f32) -> Vec<f32> {
    let mut a = vec![0f32; n * n]; let k = n as f32 / (2.0 * S); let px = |p: [f32; 2]| ((p[0] / S * 0.5 + 0.5) * n as f32, (-p[1] / S * 0.5 + 0.5) * n as f32);
    for g in segs {
        let ((ax, ay), (bx, by)) = (px(g.a), px(g.b)); let hw = (ancho(g) * k * 0.5).max(0.3); let (dx, dy) = (bx - ax, by - ay); let l2 = (dx * dx + dy * dy).max(1e-6);
        let m = hw * 3.0 + 1.0; let x0 = (ax.min(bx) - m).floor().max(0.0) as usize; let x1 = ((ax.max(bx) + m).ceil() as usize).min(n - 1);
        let y0 = (ay.min(by) - m).floor().max(0.0) as usize; let y1 = ((ay.max(by) + m).ceil() as usize).min(n - 1);
        for y in y0..=y1 { for x in x0..=x1 {
            let (qx, qy) = (x as f32 + 0.5 - ax, y as f32 + 0.5 - ay); let t = ((qx * dx + qy * dy) / l2).clamp(0.0, 1.0);
            let (ex, ey) = (qx - t * dx, qy - t * dy); let v = perfil((ex * ex + ey * ey).sqrt(), hw) * g.i.max(0.0).min(1.0).max(if g.i > 0.0 { 1.0 } else { 0.0 });
            let i = y * n + x; if v > a[i] { a[i] = v; }
        } }
    }
    a
}
/// difuminado: tres pasadas de caja de radio r, horizontal y vertical (casi una gaussiana)
fn borronear(a: &mut [f32], n: usize, r: usize) {
    if r < 1 { return; } let mut b = vec![0f32; a.len()]; let w = (2 * r + 1) as f32; let ni = n as i64; let ri = r as i64;
    let cl = |v: i64| v.clamp(0, ni - 1) as usize;
    for _ in 0..3 {
        for y in 0..n { let o = y * n; let mut s = 0.0; for x in -ri..=ri { s += a[o + cl(x)]; } for x in 0..n { b[o + x] = s / w; s += a[o + cl(x as i64 + ri + 1)] - a[o + cl(x as i64 - ri)]; } }
        for x in 0..n { let mut s = 0.0; for y in -ri..=ri { s += b[cl(y) * n + x]; } for y in 0..n { a[y * n + x] = s / w; s += b[cl(y as i64 + ri + 1) * n + x] - b[cl(y as i64 - ri) * n + x]; } }
    }
}
// (las cuentas de los sombreadores de la web, en f32 como en la placa)
fn fract(x: f32) -> f32 { x - x.floor() }
fn h11(p: f32) -> f32 { let mut p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; fract(p) }
fn h21(p: [f32; 2]) -> f32 { let mut q = [fract(p[0] * 123.34), fract(p[1] * 456.21)]; let d = q[0] * (q[0] + 45.32) + q[1] * (q[1] + 45.32); q[0] += d; q[1] += d; fract(q[0] * q[1]) }
fn vn(p: [f32; 2]) -> f32 {
    let (i, f) = ([p[0].floor(), p[1].floor()], [fract(p[0]), fract(p[1])]); let f = [f[0] * f[0] * (3.0 - 2.0 * f[0]), f[1] * f[1] * (3.0 - 2.0 * f[1])];
    let mx = |a: f32, b: f32, t: f32| a + (b - a) * t;
    mx(mx(h21(i), h21([i[0] + 1.0, i[1]]), f[0]), mx(h21([i[0], i[1] + 1.0]), h21([i[0] + 1.0, i[1] + 1.0]), f[0]), f[1])
}
fn suave(e0: f32, e1: f32, x: f32) -> f32 { let t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) }
fn rayos(th: f32, r: f32, n: f32, ancho: f32, largo: f32, sem: f32) -> f32 {
    let x = (th / 6.2831853 + 0.5) * n; let c = x.floor().rem_euclid(n); let f = fract(x) - 0.5;
    let (hb, hl, hw) = (h11(c * 1.37 + sem), h11(c * 2.71 + sem * 3.1), h11(c * 5.13 + sem * 1.7));
    let w = ancho * (0.35 + 0.9 * hw); let l = largo * (0.25 + 0.95 * hl * hl);
    (-f * f / (w * w)).exp() * suave(l, l * 0.15, r) * suave(0.015, 0.09, r) * (0.25 + 0.75 * hb * hb)
}
// ---- el tono: la web suma la grieta en luz lineal (HDR) y después pone el tono de la pantalla (ACES con la exposición del
// mapa, 0,66); el motor nativo pone el tono a cada cosa y después la suma. Sobre un cielo claro la web casi no la ve (ACES
// comprime) y la nativa la veía blanca: se hornea lo que la web agrega sobre un cielo como el del juego, ya con su tono ----
const EXPO: f32 = 0.66;
fn aces(x: f32) -> f32 { (x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14)).clamp(0.0, 1.0) }
fn aces_inv(y: f32) -> f32 { let y = y.clamp(0.0, 0.985); let (a, b, c) = (2.43 * y - 2.51, 0.59 * y - 0.03, 0.14 * y); ((-b - (b * b - 4.0 * a * c).max(0.0).sqrt()) / (2.0 * a)).max(0.0) }
/// lo que se ve de una luz lineal (la pantalla de la web) y al revés
fn pantalla(x: f32) -> f32 { aces(x * EXPO).powf(1.0 / 2.2) }
fn lineal(y: f32) -> f32 { aces_inv(y.clamp(0.0, 1.0).powf(2.2)) / EXPO }
/// qué poner en la textura de un material sin luz (que el motor eleva a 2,2, multiplica por 1,4 y pasa por la exposición y
/// ACES) para que en pantalla salga `y`
fn al_motor(y: f32) -> f32 { (lineal(y) / 1.4).min(1.0).powf(1.0 / 2.2) }
/// el cielo del juego al lado de la grieta (de día), en la pantalla
const CIELO: [f32; 3] = [0.37, 0.64, 0.93];
/// la textura intermedia de la web (EVT.tex: las vetas —la raíz—, el resplandor angosto, el ancho y la fase), la fila 0
/// arriba del plano: para compararla con la de la web (la prueba `volcar`)
pub fn capas_web(n: usize) -> Vec<u8> {
    let segs = forma(); let k = n as f32 / (2.0 * S); let lleno = |d: f32, hw: f32| (hw + 0.5 - d).clamp(0.0, 1.0);
    let mut g = raster(&segs, n, |s| (2.5 * s.w + 1.0) / 512.0, lleno); borronear(&mut g, n, ((12.0 * (5.0 / 512.0 * k).powi(2) / 3.0 + 1.0).sqrt() / 2.0).round().max(1.0) as usize);
    let mut bb = raster(&segs, n, |s| (6.0 * s.w + 3.0) / 256.0, lleno); borronear(&mut bb, n, ((12.0 * (22.0 / 512.0 * k).powi(2) / 3.0 + 1.0).sqrt() / 2.0).round().max(2.0) as usize);
    let mut o = vec![0u8; n * n * 4];
    for j in 0..n { for i in 0..n { let id = j * n + i; let (tr, ph) = vetas(n, i, j); o[id * 4] = (tr * 255.0 + 0.5) as u8; o[id * 4 + 1] = (g[id] * 255.0 + 0.5) as u8; o[id * 4 + 2] = (bb[id] * 255.0 + 0.5) as u8; o[id * 4 + 3] = (ph * 255.0 + 0.5) as u8; } }
    o
}
/// las vetas en el píxel (i, j) de una textura de n (FS_EVT_H): la raíz de su brillo y la fase de la veta
fn vetas(n: usize, i: usize, j: usize) -> (f32, f32) {
    let u = [((i as f32 + 0.5) / n as f32 * 2.0 - 1.0) * S, (1.0 - (j as f32 + 0.5) / n as f32 * 2.0) * S];
    let q = [u[0] + 0.02, u[1] - 0.06]; let r = (q[0] * q[0] + q[1] * q[1]).sqrt(); let th0 = q[1].atan2(q[0]);
    let th = th0 + (vn([r * 4.0, th0 * 2.0]) - 0.5) * 0.06;
    let arriba = 0.12 + 0.88 * suave(-0.25, 0.85, (th - 0.95).cos());
    let v = (rayos(th, r, 140.0, 0.16, 1.4, 1.0) + rayos(th, r, 330.0, 0.12, 1.19, 7.0) * 0.8 + rayos(th, r, 55.0, 0.22, 1.54, 13.0) * 0.6) * arriba;
    ((v / 2.4).clamp(0.0, 1.0).sqrt(), h11(((th / 6.2831853 + 0.5) * 140.0).floor().rem_euclid(140.0) * 7.7 + 1.0))
}
/// las dos texturas (n × n, RGBA, la fila 0 arriba del plano): lo que brilla (para sumar) y lo oscuro (para tapar)
pub fn hornear(n: usize) -> (Vec<u8>, Vec<u8>) {
    let segs = forma(); let k = n as f32 / (2.0 * S);
    // (el resplandor angosto y el ancho, como el tráiler)
    let lleno = |d: f32, hw: f32| (hw + 0.5 - d).clamp(0.0, 1.0);
    let mut g = raster(&segs, n, |s| (2.5 * s.w + 1.0) / 512.0, lleno); borronear(&mut g, n, ((12.0 * (5.0 / 512.0 * k).powi(2) / 3.0 + 1.0).sqrt() / 2.0).round().max(1.0) as usize);
    let mut bb = raster(&segs, n, |s| (6.0 * s.w + 3.0) / 256.0, lleno); borronear(&mut bb, n, ((12.0 * (22.0 / 512.0 * k).powi(2) / 3.0 + 1.0).sqrt() / 2.0).round().max(2.0) as usize);
    // (las líneas nítidas de la fractura: el resplandor y el núcleo blanco, con el ancho que tienen en un celular —2,4 y 1,1
    // píxeles de la pantalla; en una de 786 de alto la unidad del plano mide 191—)
    let ppu = 191.0f32; let linea = |ancho_px: f32| move |s: &Seg| s.w * ancho_px / ppu;
    let l1 = raster(&segs, n, linea(2.4), |d, hw| { let x = d / hw.max(0.35); (-x * x * 0.9).exp() });
    let l2 = raster(&segs, n, linea(1.1), |d, hw| { let x = d / hw.max(0.35); (-x * x * 2.2).exp() });
    let mut brillo = vec![0u8; n * n * 4]; let mut fondo = vec![0u8; n * n * 4];
    for j in 0..n { for i in 0..n {
        let u = [((i as f32 + 0.5) / n as f32 * 2.0 - 1.0) * S, (1.0 - (j as f32 + 0.5) / n as f32 * 2.0) * S]; let id = j * n + i;
        let q = [u[0] + 0.02, u[1] - 0.06]; let r2 = q[0] * q[0] + q[1] * q[1]; let r = r2.sqrt(); let th0 = q[1].atan2(q[0]);
        let th = th0 + (vn([r * 4.0, th0 * 2.0]) - 0.5) * 0.06;
        let arriba = 0.12 + 0.88 * suave(-0.25, 0.85, (th - 0.95).cos());
        let v = (rayos(th, r, 140.0, 0.16, 1.4, 1.0) + rayos(th, r, 330.0, 0.12, 1.19, 7.0) * 0.8 + rayos(th, r, 55.0, 0.22, 1.54, 13.0) * 0.6) * arriba;
        let ph = h11(((th / 6.2831853 + 0.5) * 140.0).floor().rem_euclid(140.0) * 7.7 + 1.0); let tr = (v / 2.4).clamp(0.0, 1.0).sqrt();
        let corre = 0.65 + 0.35 * (r * 22.0 + ph * 6.28).sin(); let vv = tr * tr * 2.4 * corre;
        let arriba2 = 0.12 + 0.88 * suave(-0.25, 0.85, (q[0] * 0.5817 + q[1] * 0.8134) / r.max(1e-4));
        let nucleo = (-r2 / 0.0017).exp(); let fo = (-r2 / 0.93).exp() * (0.4 + 0.6 * arriba2);
        let t = suave(0.0, 1.13, r); let colv = [0.55 + (0.06 - 0.55) * t, 1.05 + (0.18 - 1.05) * t, 1.7 + (1.05 - 1.7) * t];
        let (gg, b2) = (g[id], bb[id]); let lu = (l1[id], l2[id]);
        let col = [0usize, 1, 2].map(|c| colv[c] * vv * 1.6 + [0.22, 0.6, 1.4][c] * gg * 0.8 + [0.08, 0.16, 0.85][c] * b2 * 0.85 + [1.2, 1.9, 2.6][c] * nucleo
            + [0.18, 0.55, 1.25][c] * lu.0 * 0.85 + [3.0, 4.0, 5.0][c] * lu.1 * 0.85);
        let borde = 1.0 - suave(S * 0.62, S * 0.97, (u[0] * u[0] + u[1] * u[1]).sqrt());
        // (de día tapa más el cielo, para que se lea —uFondo 0,88—; en la web: cielo × (1 − alfa) + color, en luz lineal)
        let alfa = (fo * 0.88 + gg * 0.25).clamp(0.0, 0.92) * borde;
        let base = [0usize, 1, 2].map(|c| lineal(CIELO[c]) * (1.0 - alfa) + [0.03, 0.012, 0.11][c] * fo * borde);
        // (cuánto se oscurece el cielo en la pantalla —uno solo para los tres colores: el promedio— y lo que la grieta le
        // suma encima a ese cielo oscurecido para que quede como en la web, color por color)
        let oscuro = ([0usize, 1, 2].iter().map(|&c| 1.0 - pantalla(base[c]) / CIELO[c].max(1e-4)).sum::<f32>() / 3.0).clamp(0.0, 1.0);
        for c in 0..3 { let web = pantalla(base[c] + col[c] * borde); let suma = (web - CIELO[c] * (1.0 - oscuro)).max(0.0); brillo[id * 4 + c] = (al_motor(suma) * 255.0 + 0.5) as u8; }
        brillo[id * 4 + 3] = 255;
        fondo[id * 4 + 3] = (oscuro * 255.0 + 0.5) as u8;
    } }
    (brillo, fondo)
}
/// las texturas horneadas (una vez por proceso: la forma no cambia), el cuadrado y los materiales
fn escena() -> Escena {
    static T: std::sync::OnceLock<(Vec<u8>, Vec<u8>)> = std::sync::OnceLock::new(); const N: u32 = 512;
    let (b, f) = T.get_or_init(|| hornear(N as usize));
    // (el cuadrado de -1 a 1 con sus dos caras: posiciones en 16 bits, la normal y las coordenadas en medio flotante)
    let mut vb: Vec<u8> = vec![]; let mut ib: Vec<u8> = vec![];
    for (x, y) in [(0u16, 0u16), (65535, 0), (65535, 65535), (0, 65535)] {
        for v in [x, y, 0u16] { vb.extend_from_slice(&v.to_le_bytes()); } vb.extend_from_slice(&[0, 0, 127, 127]);
        vb.extend_from_slice(&(if x > 0 { 0x3c00u16 } else { 0 }).to_le_bytes()); vb.extend_from_slice(&(if y > 0 { 0u16 } else { 0x3c00 }).to_le_bytes());
    }
    for i in [0u16, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2] { ib.extend_from_slice(&i.to_le_bytes()); }
    let mut datos = vb; while datos.len() % 4 != 0 { datos.push(0); } let io = datos.len(); datos.extend_from_slice(&ib);
    let ot = datos.len(); datos.extend_from_slice(b); let of = datos.len(); datos.extend_from_slice(f);
    let malla = Malla { id: MALLA, v: 4, mn: [-1.0, -1.0, 0.0], sc: [2.0, 2.0, 1.0], i32: 0, ni: 12, vo: 0, io, lo: -1, so: -1, lm: -1 };
    let mat = |id: i64, t: i64, a: f32, add: u8| Mat { ti: [0.0; 12], pbr: [0.5, 0.0, 0.04], fol: 0, id, t2: -1, terr: None, c: [1.0, 1.0, 1.0, a], st: [1.0, 1.0, 0.0, 0.0], t, blend: 1 - add, cut: 0, unlit: 1, add, agua: 0, em: [0.0; 3] };
    let mut mats = vec![mat(MAT_FONDO, TEX_FONDO, 1.0, 0), mat(MAT_BRILLO, TEX_BRILLO, 1.0, 1)];
    for (k, id) in MAT_PULSO.iter().enumerate() { mats.push(mat(*id, TEX_BRILLO, 0.25 * (k + 1) as f32, 1)); }
    let texs = vec![Tex { id: TEX_BRILLO, n: "grieta".into(), w: N, h: N, a: 0, o: ot }, Tex { id: TEX_FONDO, n: "grieta_fondo".into(), w: N, h: N, a: 1, o: of }];
    Escena { c: Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![malla], mats, texs, lms: vec![], items: vec![], agua: None, cielo: None }, datos }
}

// ---------------- el estado ----------------
struct Caida { nombre: String, suelo: [f32; 3], hasta: [f32; 3], desde: [f32; 3], t0: f32, t1: f32, sz: f32, ex: f32, veh: bool, estado: u8,
    obj: Option<u32>, q0: [f32; 4], giro: [f32; 3], v0: [f32; 3], ult: Option<[f32; 3]>, acf: f32, ach: f32, silbo: bool, tpego: f32, p: [f32; 3], v: [f32; 3] }
/// la grieta del mapa: si hay, para dónde (la dirección y los dos ejes del plano), el pulso, el reloj, cuándo cae lo próximo,
/// lo que está cayendo y lo que ya cayó (las 12 últimas quedan)
#[derive(Default)]
pub struct Grieta { mapa: String, pub on: bool, caidas: bool, pub dir: [f32; 3], e1: [f32; 3], e2: [f32; 3], pub pulso: f32, t: f32, prox: f32, cola: Vec<Caida>, vivos: Vec<u32>, pub cargada: bool, sonidos: bool }

fn norm(v: [f32; 3]) -> [f32; 3] { let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt().max(1e-9); [v[0] / l, v[1] / l, v[2] / l] }
fn cruz(a: [f32; 3], b: [f32; 3]) -> [f32; 3] { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
fn punto(a: [f32; 3], b: [f32; 3]) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn mas(a: [f32; 3], b: [f32; 3], k: f32) -> [f32; 3] { [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k] }
fn q_eje(e: [f32; 3], a: f32) -> [f32; 4] { let l = (e[0] * e[0] + e[1] * e[1] + e[2] * e[2]).sqrt(); if l < 1e-6 { return [0.0, 0.0, 0.0, 1.0]; } let s = (a / 2.0).sin() / l; [e[0] * s, e[1] * s, e[2] * s, (a / 2.0).cos()] }

/// (sonidos hechos acá, como los de Web Audio de la web: ruido por un filtro de estado variable que se mueve)
fn ruido_filtrado(dur: f32, hz: f32, frec: impl Fn(f32) -> f32, q: f32, pasa_bajos: bool, env: impl Fn(f32) -> f32, sem: &mut u32) -> Vec<f32> {
    let n = (dur * hz) as usize; let (mut lo, mut ba) = (0f32, 0f32); let mut out = Vec::with_capacity(n);
    for i in 0..n { let t = i as f32 / hz; *sem ^= *sem << 13; *sem ^= *sem >> 17; *sem ^= *sem << 5; let x = (*sem as f32 / u32::MAX as f32) * 2.0 - 1.0;
        let f = (2.0 * (std::f32::consts::PI * frec(t) / hz).sin()).min(1.4); let hi = x - lo - ba / q; ba += f * hi; lo += f * ba;
        out.push((if pasa_bajos { lo } else { ba }) * env(t)); }
    out
}

impl Juego {
    /// al entrar a un mapa: si tiene grieta, para dónde (hacia adelante de la aparición, corrida según el mapa, a 24–31° de
    /// altura y lejos del sol) y cuándo cae lo primero (al rato: de 35 a 75 s)
    fn grieta_iniciar(&mut self) {
        let m = self.mapas.get(self.mapa_i).cloned().unwrap_or_default(); let g = &mut self.gr;
        g.mapa = m.clone(); g.on = con_grieta(&m); g.caidas = con_caidas(&m); g.cola.clear(); g.vivos.clear(); g.pulso = 0.0;
        g.prox = g.t + 35.0 + 40.0 * hash(&format!("{m}{}", g.t));
        if !g.on { return; }
        let (s0, sol) = self.mapa.as_ref().map(|mp| (mp.spawns.first().and_then(|s| s.1).unwrap_or(0.0), mp.luz.sol)).unwrap_or((0.0, [0.0, 1.0, 0.0]));
        let h = hash(&m); let mut az = s0 + (h - 0.5) * 1.1; let el = 0.42 + 0.12 * hash(&format!("{m}#"));
        let dir_de = |a: f32| norm([el.cos() * a.sin(), el.sin(), el.cos() * a.cos()]);
        let mut c = dir_de(az); if punto(c, norm(sol)) > 0.8 { az += 1.25; c = dir_de(az); }
        let giro = -0.25 + 0.5 * hash(&format!("{m}@")); let e1 = norm(cruz([0.0, 1.0, 0.0], c)); let e2 = norm(cruz(c, e1)); let (cg, sg) = (giro.cos(), giro.sin());
        let g = &mut self.gr; g.dir = c; g.e1 = norm([e1[0] * cg + e2[0] * sg, e1[1] * cg + e2[1] * sg, e1[2] * cg + e2[2] * sg]); g.e2 = norm([-e1[0] * sg + e2[0] * cg, -e1[1] * sg + e2[1] * cg, -e1[2] * sg + e2[2] * cg]);
    }
    /// cada cuadro: el mapa nuevo, el pulso, si toca una caída y lo que está cayendo
    pub(super) fn grieta_paso(&mut self, m: &mut Motor3d, dt: f32) {
        self.gr.t += dt; let mapa = self.mapas.get(self.mapa_i).cloned().unwrap_or_default();
        if self.mapa.is_none() { self.gr.mapa.clear(); return; }
        if self.gr.mapa != mapa { self.grieta_iniciar(); }
        if self.gr.on && !self.gr.cargada { self.gr.cargada = unsafe { m.cargar(&escena()) }.is_ok(); }
        if !self.gr.sonidos { self.gr.sonidos = true; self.grieta_sonidos(); }
        if self.gr.pulso > 0.0 { self.gr.pulso = (self.gr.pulso - dt * 0.45).max(0.0); }
        let t = self.gr.t;
        // (de 1 a 6: casi siempre pocas, a veces muchas; cada 100 a 260 s; en una sala, no)
        if self.gr.caidas && t >= self.gr.prox {
            self.gr.prox = t + 100.0 + 160.0 * self.azar();
            if !self.en_red.en_sala() { let r = self.azar(); let n = if r < 0.34 { 1 } else if r < 0.58 { 2 } else if r < 0.74 { 3 } else if r < 0.85 { 4 } else if r < 0.93 { 5 } else { 6 }; self.grieta_lanzar(n); }
        }
        if self.gr.cola.is_empty() { return; }
        let cam = self.ojos_ult; let mut cola = std::mem::take(&mut self.gr.cola);
        for c in cola.iter_mut() {
            if t < c.t0 || c.estado == 3 { continue; }
            if c.estado == 0 {
                // (aparece arriba, quieto para la física: se lo lleva por la parábola hasta el piso)
                let q0 = c.q0; let r = self.crear(m, &c.nombre.clone(), c.desde, q0, true, true).ok().flatten();
                let id = r.and_then(|i| self.objs.get(i)).and_then(|o| o.cuerpo); c.obj = id;
                let rad = id.and_then(|i| self.fis.cuerpo(i)).map(|b| { let a = b.aabb(); (((a[3] - a[0]).powi(2) + (a[4] - a[1]).powi(2) + (a[5] - a[2]).powi(2)).sqrt() * 0.5) as f32 }).unwrap_or(0.5);
                c.hasta = [c.suelo[0], c.suelo[1] + rad * 0.8, c.suelo[2]];
                let tt = c.t1 - c.t0; let d = [c.hasta[0] - c.desde[0], c.hasta[1] - c.desde[1], c.hasta[2] - c.desde[2]]; c.v0 = [d[0] / tt, (d[1] + 0.5 * 16.0 * tt * tt) / tt, d[2] / tt];
                c.estado = 1;
            }
            if c.estado == 1 {
                let tt = t.min(c.t1); let s = tt - c.t0; let p = [c.desde[0] + c.v0[0] * s, c.desde[1] + c.v0[1] * s - 8.0 * s * s, c.desde[2] + c.v0[2] * s]; let v = [c.v0[0], c.v0[1] - 16.0 * s, c.v0[2]];
                let gl = (c.giro[0] * c.giro[0] + c.giro[1] * c.giro[1] + c.giro[2] * c.giro[2]).sqrt(); let q = qmul32(c.q0, q_eje(c.giro, gl * s)); c.p = p; c.v = v;
                if let Some(b) = c.obj.and_then(|id| self.fis.cuerpo_mut(id)) { b.pos = [p[0] as f64, p[1] as f64, p[2] as f64]; b.q = [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64]; b.vel = [0.0; 3]; b.ang = [0.0; 3]; }
                // la estela: puntos a lo largo del camino desde el cuadro anterior (más espaciados lejos de la cámara)
                if let Some(u) = c.ult {
                    let seg = [p[0] - u[0], p[1] - u[1], p[2] - u[2]]; let l = punto(seg, seg).sqrt(); let dc = punto([p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]], [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]]).sqrt();
                    let esp = (dc * 0.025).clamp(0.45 * c.sz, 5.0) / 0.5; let kz = (dc / 40.0).max(1.0); c.acf += l; c.ach += l;
                    while c.acf >= esp { c.acf -= esp; let k = c.acf / l.max(1e-6); self.grieta_llama(mas(p, seg, -k), v, c.sz * kz, 1.0, true); }
                    while c.ach >= esp * 3.0 { c.ach -= esp * 3.0; let k = c.ach / l.max(1e-6); self.grieta_humo(mas(p, seg, -k), v, c.sz * kz); }
                }
                c.ult = Some(p); self.ef.luz_temporal(p, 10.0 * c.sz, [5.0, 2.4, 0.8], 0.05);
                if !c.silbo && c.t1 - t < 1.7 { c.silbo = true; self.sonido.tocar("GR_silbido", 0.9, 1.0, Some(c.hasta)); }
                if t >= c.t1 { self.grieta_pega(c); }
            } else if c.estado == 2 {
                // (ardiendo un rato en el piso)
                let e = t - c.tpego; let p = c.obj.and_then(|id| self.fis.cuerpo(id)).map(|b| [b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32]).unwrap_or(c.hasta); let k = (1.0 - e / 3.5).max(0.0);
                if k > 0.0 && self.azar() < dt * 22.0 * k * 0.5 { self.grieta_llama([p[0], p[1] + 0.3, p[2]], [0.0; 3], c.sz * 0.8, k, false); }
                if k > 0.0 && self.azar() < dt * 8.0 * k * 0.5 { self.grieta_humo([p[0], p[1] + 0.6, p[2]], [0.0; 3], c.sz); }
                if k <= 0.0 { c.estado = 3; }
            }
        }
        cola.retain(|c| c.estado != 3); cola.extend(std::mem::take(&mut self.gr.cola)); self.gr.cola = cola;
    }
    /// una caída nueva: n cosas, cerca del jugador, desde la grieta (pero más desde arriba: que llueva). Devuelve cuántas
    pub fn grieta_lanzar(&mut self, n: usize) -> usize {
        if !self.gr.caidas { return 0; }
        let desde_dir = norm(mas(self.gr.dir, [0.0, 1.3, 0.0], 1.0)); let jug = self.jug.pos; let t = self.gr.t; let mut nuevas = vec![];
        for i in 0..n {
            let Some((nombre, sz, ex)) = self.grieta_cosa() else { break };
            let Some(p) = self.grieta_lugar(jug, desde_dir) else { continue };
            let lat = norm(cruz(desde_dir, [0.0, 1.0, 0.0])); let desde = mas(mas(p, desde_dir, 150.0), lat, (self.azar() - 0.5) * 30.0);
            let veh = self.cat_veh.iter().any(|c| c.1.iter().any(|x| *x == nombre)); let az = self.azar() * 6.28;
            let q0 = if veh { q_eje([0.0, 1.0, 0.0], az) } else { qmul32(q_eje([0.0, 1.0, 0.0], az), q_eje([1.0, 0.0, 0.0], self.azar() * 2.0 - 1.0)) };
            let giro = if veh { [0.0, self.azar() * 1.6 - 0.8, 0.0] } else { [self.azar() * 6.0 - 3.0, self.azar() * 6.0 - 3.0, self.azar() * 6.0 - 3.0] };
            let t0 = t + 1.4 + i as f32 * 0.45 + self.azar() * 0.7; let dur = 2.7 + self.azar() * 0.6;
            nuevas.push(Caida { nombre, suelo: p, hasta: p, desde, t0, t1: t0 + dur, sz, ex, veh, estado: 0, obj: None, q0, giro, v0: [0.0; 3], ult: None, acf: 0.0, ach: 0.0, silbo: false, tpego: 0.0, p: desde, v: [0.0; 3] });
        }
        if nuevas.is_empty() { return 0; }
        self.gr.pulso = 1.0; self.sonido.tocar("GR_zumbido", 0.8, 1.0, None); let k = nuevas.len(); self.gr.cola.extend(nuevas); k
    }
    /// cuál cae (por peso, de las que están en el catálogo; las que explotan, a veces explotan)
    fn grieta_cosa(&mut self) -> Option<(String, f32, f32)> {
        let hay = |n: &str| self.catalogo.iter().chain(self.cat_veh.iter()).any(|c| c.1.iter().any(|x| x == n));
        let l: Vec<_> = COSAS.iter().filter(|c| hay(c.0)).collect(); if l.is_empty() { return None; }
        let tot: u32 = l.iter().map(|c| c.1).sum(); let mut r = self.azar() * tot as f32;
        let c = l.iter().find(|c| { r -= c.1 as f32; r <= 0.0 }).copied().unwrap_or(l[l.len() - 1]);
        let ex = if c.3 > 0.0 && self.azar() < c.3 { c.4 } else { 0.0 }; Some((c.0.to_string(), c.2, ex))
    }
    /// dónde cae: cerca del jugador (9 a 32 m), en el piso, a más de 8 m y con el cielo libre de donde viene
    fn grieta_lugar(&mut self, jug: [f32; 3], desde_dir: [f32; 3]) -> Option<[f32; 3]> {
        for _ in 0..14 {
            let a = self.azar() * 6.2832; let d = 9.0 + self.azar() * 23.0; let (x, z) = (jug[0] + a.cos() * d, jug[2] + a.sin() * d); let alto = jug[1] + 70.0;
            let mp = self.mapa.as_ref()?; let Some(h) = mp.mundo.rayo([x, alto, z], [0.0, -1.0, 0.0], 160.0) else { continue };
            let y = alto - h.t; if (y - jug[1]).abs() > 18.0 { continue; }
            let p = [x, y, z]; if mp.mundo.rayo([x, y + 0.6, z], desde_dir, 140.0).is_some() { continue; }
            return Some(p);
        }
        None
    }
    fn grieta_llama(&mut self, p: [f32; 3], v: [f32; 3], sz: f32, k: f32, estela: bool) {
        let mut az = |a: f32, b: f32| a + self.ef.azar() as f32 * (b - a);
        let (rx, ry, rz) = (az(-0.35, 0.35) * sz, az(-0.35, 0.35) * sz, az(-0.35, 0.35) * sz); let (vx, vy, vz) = (az(-1.2, 1.2), az(-1.2, 1.2), az(-1.2, 1.2)); let (vida, tam) = (az(0.3, 0.65), az(0.45, 0.9) * sz * k);
        if let Some(x) = self.ef.particula([p[0] + rx, p[1] + ry, p[2] + rz], [v[0] * 0.12 + vx, v[1] * 0.12 + vy + 1.2, v[2] * 0.12 + vz], vida, tam, if estela { [1.0, 0.8, 0.55, 0.6] } else { [1.0; 4] }, Tipo::Fuego, 1.3) { x.rampa = true; x.fr = 3.0; x.suave = true; }
    }
    fn grieta_humo(&mut self, p: [f32; 3], v: [f32; 3], sz: f32) {
        let mut az = |a: f32, b: f32| a + self.ef.azar() as f32 * (b - a);
        let (rx, ry, rz) = (az(-0.3, 0.3) * sz, az(-0.3, 0.3) * sz, az(-0.3, 0.3) * sz); let (vx, vy, vz) = (az(-0.8, 0.8), az(-0.8, 0.8), az(-0.8, 0.8)); let (vida, tam) = (az(0.9, 1.6), az(0.45, 0.75) * sz);
        if let Some(x) = self.ef.particula([p[0] + rx, p[1] + ry, p[2] + rz], [v[0] * 0.04 + vx, v[1] * 0.04 + vy + 1.0, v[2] * 0.04 + vz], vida, tam, [0.32, 0.29, 0.28, 0.42], Tipo::Humo, 1.8) { x.calor = 0.35; x.fr = 1.1; }
    }
    /// el golpe: explota, o queda la cosa con un poco del envión (y el polvo, el temblor y el ruido)
    fn grieta_pega(&mut self, c: &mut Caida) {
        c.estado = 2; c.tpego = self.gr.t; let p = c.p;
        if c.ex > 0.0 {
            if let Some(i) = c.obj.and_then(|id| self.objs.iter().position(|o| o.cuerpo == Some(id))) { self.borrar_obj(i); } c.obj = None;
            self.explosion([c.suelo[0], c.suelo[1] + 0.5, c.suelo[2]], 4.5 * c.ex, 55.0 * c.ex); return;
        }
        let d = ((p[0] - self.ojos_ult[0]).powi(2) + (p[1] - self.ojos_ult[1]).powi(2) + (p[2] - self.ojos_ult[2]).powi(2)).sqrt(); self.temblor = self.temblor.max((1.0 - d / 40.0).clamp(0.0, 0.6));
        self.sonido.tocar("GR_golpe", 1.0, 1.0, Some(p));
        if let Some(x) = self.ef.particula([c.suelo[0], c.suelo[1] + 0.2, c.suelo[2]], [0.0; 3], 0.6, 2.2 * c.sz, [0.78, 0.68, 0.55, 0.55], Tipo::Humo, 4.0) { x.tile = 3.0; x.modo = 2; x.suave = true; x.grav = 0.0; }
        for _ in 0..6 { let v = [self.azar() * 6.0 - 3.0, 2.0 + self.azar() * 3.0, self.azar() * 6.0 - 3.0]; let vida = 0.9 + self.azar() * 0.6;
            if let Some(y) = self.ef.particula([c.suelo[0], c.suelo[1] + 0.3, c.suelo[2]], v, vida, 0.6 * c.sz, [0.55, 0.48, 0.4, 0.5], Tipo::Humo, 2.2) { y.fr = 2.4; y.suave = true; } }
        // (la de verdad: apoyada en el piso, suelta, con un poco del envión)
        let (veh, v) = (c.veh, c.v); let ang = [self.azar() * 6.0 - 3.0, self.azar() * 6.0 - 3.0, self.azar() * 6.0 - 3.0];
        let Some(id) = c.obj else { return };
        if let Some(b) = self.fis.cuerpo_mut(id) {
            let a = b.aabb(); let abajo = b.pos[1] - a[1]; b.pos = [p[0] as f64, c.suelo[1] as f64 + abajo + 0.02, p[2] as f64];
            let k = if veh { 0.04 } else { 0.12 }; b.vel = [(v[0] * k) as f64, if veh { 0.0 } else { (v[1].abs() * 0.08) as f64 }, (v[2] * k) as f64];
            b.ang = if veh { [0.0; 3] } else { [ang[0] as f64, ang[1] as f64, ang[2] as f64] }; b.congelado = false; b.despertar();
        }
        self.gr.vivos.push(id);
        // (no se juntan para siempre: las más viejas se van)
        while self.gr.vivos.len() > 12 { let v = self.gr.vivos.remove(0); if let Some(i) = self.objs.iter().position(|o| o.cuerpo == Some(v)) { self.borrar_obj(i); } }
    }
    /// el zumbido grave de la grieta, el silbido de lo que viene y el golpe (hechos acá, como los de la web)
    fn grieta_sonidos(&mut self) {
        let hz = 22050u32; let h = hz as f32; let mut sem = 0x9e3779b9u32;
        let zumbido = ruido_filtrado(3.2, h, |_| 90.0, 6.0, true, |t| if t < 0.6 { (t / 0.6).powi(2) } else { (1.0 - (t - 0.6) / 2.6).max(0.0).powi(2) } * 0.9 * 3.0, &mut sem);
        let silbido = ruido_filtrado(1.7, h, |t| 2400.0 * (380.0f32 / 2400.0).powf(t / 1.7), 2.5, false, |t| (t / 1.53).min(1.0).powi(2) * if t > 1.53 { 1.0 - (t - 1.53) / 0.17 } else { 1.0 } * 0.55, &mut sem);
        let mut golpe = ruido_filtrado(0.9, h, |t| 900.0 * (120.0f32 / 900.0).powf((t / 0.5).min(1.0)), 0.8, true, |t| 1.4 * (-t * 6.0).exp(), &mut sem);
        let mut fase = 0.0f32; for (i, s) in golpe.iter_mut().enumerate() { let t = i as f32 / h; let f = 70.0 * (38.0f32 / 70.0).powf((t / 0.6).min(1.0)); fase += f / h * std::f32::consts::TAU; *s += fase.sin() * 1.2 * (-t * 5.5).exp(); }
        let lim = |v: Vec<f32>| v.into_iter().map(|x| x.clamp(-1.0, 1.0)).collect::<Vec<f32>>();
        self.sonido.sintetico("GR_zumbido", move || lim(zumbido), hz); self.sonido.sintetico("GR_silbido", move || lim(silbido), hz); self.sonido.sintetico("GR_golpe", move || lim(golpe), hz);
    }
    /// lo que se dibuja: el cuadrado en el cielo (lo oscuro, lo que brilla y el pulso), mientras no quede detrás de la vista
    pub(super) fn grieta_items(&self, items: &mut Vec<ItemDin>, cam: [f32; 3], fw: [f32; 3]) {
        let g = &self.gr; if !g.on || !g.cargada || punto(fw, g.dir) < -0.25 { return; }
        let c = mas(cam, g.dir, LEJOS); let s = S * TAM * LEJOS;
        let mm = [g.e1[0] * s, g.e1[1] * s, g.e1[2] * s, 0.0, g.e2[0] * s, g.e2[1] * s, g.e2[2] * s, 0.0, -g.dir[0], -g.dir[1], -g.dir[2], 0.0, c[0], c[1], c[2], 1.0];
        let it = |mat: i64| ItemDin { m: MALLA, s0: 0, sn: 12, mat, mm, esf: [c[0], c[1], c[2], s * 1.5], fl: FL_CIELO | FL_SIN_SOMBRA, h: vec![] };
        items.push(it(MAT_FONDO)); items.push(it(MAT_BRILLO));
        if g.pulso > 0.02 { items.push(it(MAT_PULSO[((g.pulso * 4.0).ceil() as usize).clamp(1, 4) - 1])); }
    }
    /// (para las pruebas: dónde va cada cosa que cae, si ya pegó y si quedó la de verdad)
    pub fn grieta_cayendo(&self) -> Vec<(String, [f32; 3], u8, bool)> { self.gr.cola.iter().map(|c| (c.nombre.clone(), if c.estado == 0 { c.suelo } else { c.p }, c.estado, c.obj.is_some())).collect() }
    /// (para las pruebas: que caiga ya)
    pub fn grieta_forzar(&mut self, n: usize) -> usize { self.gr.prox = self.gr.t + 100.0; self.grieta_lanzar(n.clamp(1, 6)) }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    /// (con GRIETA_VOLCAR=archivo: la textura intermedia de 512, como la de la web, para compararlas)
    #[test]
    fn volcar() { if let Ok(p) = std::env::var("GRIETA_VOLCAR") { std::fs::write(p, capas_web(512)).unwrap(); } }
    #[test]
    fn forma_y_horneado() {
        let s = forma(); assert!(s.len() > 400 && s.len() < 1200, "tramos {}", s.len());
        let (b, f) = hornear(128);
        // (el núcleo brilla, el borde no; lo oscuro tapa en el medio y nada en las esquinas)
        let px = |v: &[u8], x: usize, y: usize, c: usize| v[(y * 128 + x) * 4 + c];
        let (cx, cy) = (((-0.02 / S) * 0.5 + 0.5) * 128.0, ((-0.06 / S) * 0.5 + 0.5) * 128.0);
        // (el núcleo queda blanco: sobre el cielo celeste suma sobre todo rojo y verde —el azul ya está casi lleno—)
        let nu = px(&b, cx as usize, cy as usize, 0); assert!(nu > 100 && nu > px(&b, cx as usize, cy as usize, 2), "núcleo {:?}", (0..3).map(|c| px(&b, cx as usize, cy as usize, c)).collect::<Vec<_>>());
        assert!(px(&b, 1, 1, 2) < 5 && px(&f, 1, 1, 3) < 5, "esquina");
        // (lo oscuro: en la pantalla tapa como la web sobre el cielo celeste, un poco —58/255 en el medio—, nada en las esquinas)
        assert!(px(&f, 64, 64, 3) > 40 && px(&f, 64, 64, 3) > px(&f, 64, 10, 3), "fondo {}", px(&f, 64, 64, 3));
        assert!(con_grieta("Desert") && con_grieta("RB_Llanura") && !con_grieta("RB_Construct") && !con_grieta("RB_Pizzeria") && con_caidas("City") && !con_caidas("Space"));
    }
}
