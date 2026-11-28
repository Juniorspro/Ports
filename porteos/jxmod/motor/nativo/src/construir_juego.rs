//! El modo construcción (pedido del Discord para armar servers y mapas rápido): Props → Opciones → «Modo construcción».
//! - Volás libre como espectador (sin chocar) y se ve una cuadrícula del tamaño del prop con el que trabajás, donde apuntás.
//! - Lo que soltás con la Physics Gun queda acomodado en la cuadrícula: derecho, girado de a 90°, pegado a los de al lado
//!   (la cuadrícula es del tamaño de ese prop) y congelado.
//! - La Tool Gun copia: le pegás a un prop y aparece su contorno (el holograma). Con los botones Z (al costado), X (adelante
//!   y atrás) o Y (arriba y abajo) el holograma se mueve sólo en ese eje según adónde mirás, de a un prop por vez y sin
//!   desviarse; con ZXY va adonde apuntes (acomodado en la cuadrícula). El disparo pone la copia y la próxima sale desde
//!   ahí (así se arma una fila, una pared o una torre en segundos); el «2» suelta la copia.
use super::*;
use super::herramientas::{Logica, Valor};

/// lo que se copia: el nombre del prop, su giro, su tamaño, desde dónde sale la próxima y su lógica (las de la Tool Gun)
#[derive(Clone)]
pub struct Fuente { pub nombre: String, pub q: [f32; 4], pub tam: [f32; 3], pub base: [f32; 3], pub log: Option<(String, HashMap<String, Valor>)>,
    /// de su centro a la raíz del modelo (donde se pone) y lo del modelo para dibujarlo (como matriz_obj)
    pub off: [f32; 3], cap: [f32; 4], c: [f32; 3] }

#[derive(Default)]
pub struct Cons {
    pub activo: bool, noclip_antes: bool,
    /// el eje del holograma: 0 Z (al costado), 1 X (adelante y atrás), 2 Y (arriba y abajo), 3 ZXY (libre)
    pub eje: u8, dir: [f32; 3],
    pub fuente: Option<Fuente>,
    /// dónde va el holograma este cuadro y cuánto se corrió sobre el eje
    pub holo: Option<[f32; 3]>, t: f32,
    /// lo que tenía agarrado la Physics Gun el cuadro anterior (para acomodarlo al soltarlo) y el tamaño de la cuadrícula
    tenido: Option<u32>, pub paso: [f32; 3],
    /// lo que se apunta este cuadro: el punto y la cara (para la cuadrícula y el holograma libre)
    punto: Option<([f32; 3], [f32; 3])>,
    /// Repetir (como «Save index»): después de poner una copia, el holograma salta solo al siguiente lugar —lo que se corrió
    /// la última vez— y cada disparo sigue la fila en orden, sin volver a ubicarlo; un eje o apagar Repetir vuelve a apuntar
    pub repetir: bool, pub delta: Option<[f32; 3]>,
}

/// el giro sólo alrededor de la vertical, de a 90° (el más cercano al de `q`)
pub fn q_recto(q: [f32; 4]) -> [f32; 4] {
    let (x, y, z, w) = (q[0], q[1], q[2], q[3]);
    // (adónde apunta el frente —el eje z— girado por q)
    let f = [2.0 * (x * z + w * y), 2.0 * (y * z - w * x), 1.0 - 2.0 * (x * x + y * y)];
    let yaw = f[0].atan2(f[2]); let r = (yaw / std::f32::consts::FRAC_PI_2).round() * std::f32::consts::FRAC_PI_2;
    [0.0, (r * 0.5).sin(), 0.0, (r * 0.5).cos()]
}
/// un número llevado a la cuadrícula de paso `s` con los bordes del prop (de tamaño `s`) en las líneas
pub fn a_grilla(x: f32, s: f32) -> f32 { let s = s.max(0.05); ((x - s * 0.5) / s).round() * s + s * 0.5 }
/// la altura del piso de un prop llevada a su cuadrícula si queda cerca (apilar sin huecos); si no, a 5 cm (un piso que no
/// coincide con la cuadrícula no lo deja flotando ni hundido)
pub fn a_grilla_y(abajo: f32, s: f32) -> f32 { let s = s.max(0.05); let c = (abajo / s).round() * s; if (c - abajo).abs() < 0.3 * s { c } else { (abajo / 0.05).round() * 0.05 } }
/// el eje del mundo (±x o ±z) más parecido a una dirección horizontal
pub fn eje_mundo(d: [f32; 3]) -> [f32; 3] { if d[0].abs() >= d[2].abs() { [d[0].signum(), 0.0, 0.0] } else { [0.0, 0.0, d[2].signum()] } }
/// cuánto se corre sobre la recta `base + d·t` el punto más cercano al rayo `o + f·s` (None: casi paralelos)
pub fn t_en_eje(base: [f32; 3], d: [f32; 3], o: [f32; 3], f: [f32; 3]) -> Option<f32> {
    let w0 = [base[0] - o[0], base[1] - o[1], base[2] - o[2]];
    let dot = |a: [f32; 3], b: [f32; 3]| a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    let (b, dd, e) = (dot(d, f), dot(d, w0), dot(f, w0)); let den = 1.0 - b * b;
    if den < 1e-4 { return None; }
    Some((b * e - dd) / den)
}

impl Juego {
    /// prender o apagar el modo construcción (Props → Opciones)
    pub fn cons_alternar(&mut self) {
        let c = &mut self.cons;
        if c.activo { c.activo = false; self.jug.noclip = c.noclip_antes; c.fuente = None; c.holo = None; self.avisar("Modo construcción: apagado".into()); }
        else {
            c.activo = true; c.repetir = true; c.noclip_antes = self.jug.noclip; self.jug.noclip = true; if c.paso[0] <= 0.0 { c.paso = [1.0; 3]; }
            self.avisar("Construcción: la Physics Gun acomoda, la Tool Gun copia".into());
        }
    }
    /// el botón de un eje (Z, X, Y o ZXY): el eje queda fijo según adónde mirabas al elegirlo
    pub fn cons_eje(&mut self, k: u8) {
        let f = self.mira(); let h = [f[0], 0.0, f[2]];
        if k == 4 { self.cons.repetir = !self.cons.repetir; self.cons.delta = None; return; }
        self.cons.eje = k.min(3); self.cons.t = 0.0; self.cons.delta = None;
        self.cons.dir = match k { 0 => eje_mundo([h[2], 0.0, -h[0]]), 1 => eje_mundo(h), 2 => [0.0, 1.0, 0.0], _ => [0.0; 3] };
    }
    /// cada cuadro: acomodar lo que se soltó con la Physics Gun y llevar el holograma
    pub(crate) fn cons_paso(&mut self) {
        if !self.cons.activo { return; }
        if self.mapa.is_none() { self.cons.activo = false; return; }
        self.jug.noclip = true;
        let ahora = self.armas.agarre.as_ref().map(|a| a.id);
        if let Some(id) = ahora { if let Some(b) = self.fis.cuerpo(id) { let a = b.aabb(); self.cons.paso = [(a[3] - a[0]) as f32, (a[4] - a[1]) as f32, (a[5] - a[2]) as f32]; } }
        if let Some(id) = self.cons.tenido.filter(|t| Some(*t) != ahora) { self.cons_acomodar(id); }
        self.cons.tenido = ahora;
        let (o, d) = (self.ojos_ult, self.mira());
        self.cons.punto = self.mapa.as_ref().and_then(|mp| self.fis.rayo(&mp.mundo, [o[0] as f64, o[1] as f64, o[2] as f64], [d[0] as f64, d[1] as f64, d[2] as f64], 60.0, &[]))
            .map(|g| ([g.p[0] as f32, g.p[1] as f32, g.p[2] as f32], [g.n[0] as f32, g.n[1] as f32, g.n[2] as f32]));
        self.cons.holo = self.cons_holo();
    }
    /// un prop a la cuadrícula: derecho, de a 90°, sus bordes en las líneas y congelado
    fn cons_acomodar(&mut self, id: u32) {
        let Some(b) = self.fis.cuerpo_mut(id) else { return };
        let q = q_recto([b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]);
        b.q = [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64]; b.vel = [0.0; 3]; b.ang = [0.0; 3]; b.actualizar();
        let a = b.aabb(); let tam = [(a[3] - a[0]) as f32, (a[4] - a[1]) as f32, (a[5] - a[2]) as f32];
        let (cx, cz) = (((a[0] + a[3]) * 0.5) as f32, ((a[2] + a[5]) * 0.5) as f32); let abajo = a[1] as f32;
        let (nx, nz, ny) = (a_grilla(cx, tam[0]), a_grilla(cz, tam[2]), a_grilla_y(abajo, tam[1]));
        b.pos = [b.pos[0] + (nx - cx) as f64, b.pos[1] + (ny - abajo) as f64, b.pos[2] + (nz - cz) as f64];
        b.prev_pos = b.pos; b.prev_q = b.q; b.congelado = true; b.actualizar();
        self.cons.paso = tam; self.sonido.tocar("Click", 0.35, 1.2, None);
    }
    /// dónde va el holograma: sobre el eje elegido —de a un prop— o, con ZXY, donde apuntás (en la cuadrícula)
    fn cons_holo(&self) -> Option<[f32; 3]> {
        let f = self.cons.fuente.as_ref()?; let (o, d) = (self.ojos_ult, self.mira());
        if let (true, Some(dl)) = (self.cons.repetir, self.cons.delta) { return Some([f.base[0] + dl[0], f.base[1] + dl[1], f.base[2] + dl[2]]); }
        if self.cons.eje < 3 {
            let k = if self.cons.eje == 2 { 1 } else if self.cons.dir[0] != 0.0 { 0 } else { 2 };
            let t = t_en_eje(f.base, self.cons.dir, o, d).unwrap_or(self.cons.t).clamp(-60.0, 60.0);
            let s = f.tam[k].max(0.05); let t = (t / s).round() * s;
            return Some([f.base[0] + self.cons.dir[0] * t, f.base[1] + self.cons.dir[1] * t, f.base[2] + self.cons.dir[2] * t]);
        }
        let (p, n) = self.cons.punto?;
        // (apoyado en la cara que apuntás, corrido medio prop hacia afuera)
        let c = [p[0] + n[0] * f.tam[0] * 0.5, p[1] + n[1] * f.tam[1] * 0.5, p[2] + n[2] * f.tam[2] * 0.5];
        let abajo = a_grilla_y(c[1] - f.tam[1] * 0.5, f.tam[1]);
        Some([a_grilla(c[0], f.tam[0]), abajo + f.tam[1] * 0.5, a_grilla(c[2], f.tam[2])])
    }
    /// la Tool Gun en el modo construcción: el primer disparo elige qué copiar; los siguientes ponen la copia en el holograma;
    /// el «2» la suelta. true si lo usó
    pub unsafe fn cons_disparo(&mut self, m: &mut Motor3d, alt: bool) -> bool {
        if !self.cons.activo { return false; }
        if alt { if self.cons.fuente.take().is_some() { self.cons.holo = None; self.avisar("Copia soltada".into()); return true; } return false; }
        if let (Some(f), Some(p)) = (self.cons.fuente.clone(), self.cons.holo) {
            match self.crear(m, &f.nombre, [p[0] + f.off[0], p[1] + f.off[1], p[2] + f.off[2]], f.q, true, true) {
                Ok(Some(k)) => {
                    if let Some((t, pr)) = f.log { self.objs[k].logica = Some(Logica { tipo: t, params: pr, entradas: vec![], salida: false, t: 0.0, luz: false, texto: String::new(), color: String::new() }); }
                    let dl = [p[0] - f.base[0], p[1] - f.base[1], p[2] - f.base[2]];
                    if dl.iter().any(|x| x.abs() > 1e-3) { self.cons.delta = Some(dl); }
                    if let Some(x) = self.cons.fuente.as_mut() { x.base = p; } self.cons.t = 0.0;
                    self.ef.chispas(p); self.sonido.tocar("Click", 0.5, 1.6, None);
                }
                Ok(None) => {}
                Err(e) => self.avisar(format!("No se pudo copiar: {e}")),
            }
            return true;
        }
        let (o, d) = (self.ojos_ult, self.mira());
        let Some(mp) = self.mapa.as_ref() else { return true };
        let r = self.fis.rayo(&mp.mundo, [o[0] as f64, o[1] as f64, o[2] as f64], [d[0] as f64, d[1] as f64, d[2] as f64], 80.0, &[]);
        let Some(i) = r.and_then(|g| g.cuerpo).and_then(|c| self.objs.iter().position(|x| x.cuerpo == Some(c))) else { self.avisar("Pegale a un prop para copiarlo".into()); return true };
        let Some(b) = self.objs[i].cuerpo.and_then(|c| self.fis.cuerpo(c)) else { return true };
        let a = b.aabb();
        let f = Fuente { nombre: self.objs[i].nombre.clone(), q: q_recto([b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]),
            tam: [(a[3] - a[0]) as f32, (a[4] - a[1]) as f32, (a[5] - a[2]) as f32], base: [((a[0] + a[3]) * 0.5) as f32, ((a[1] + a[4]) * 0.5) as f32, ((a[2] + a[5]) * 0.5) as f32],
            log: self.objs[i].logica.as_ref().map(|l| (l.tipo.clone(), l.params.clone())),
            off: [(b.pos[0] - (a[0] + a[3]) * 0.5) as f32, (b.pos[1] - (a[1] + a[4]) * 0.5) as f32, (b.pos[2] - (a[2] + a[5]) * 0.5) as f32], cap: self.objs[i].cap_inv, c: self.objs[i].c };
        let n = self.jg.nombre_item(&f.nombre).to_string(); self.cons.paso = f.tam; self.cons.fuente = Some(f); self.cons.delta = None; if self.cons.eje < 3 { let e = self.cons.eje; self.cons_eje(e); }
        self.avisar(format!("Copiando {n}: elegí el eje y disparo pone"));
        true
    }
    /// lo que se ve: la cuadrícula donde apuntás, y el holograma (el contorno de la copia) con la línea desde donde sale
    pub(super) fn cons_items(&self, items: &mut Vec<jxmotor::escena::ItemDin>) {
        if !self.cons.activo { return; }
        {
            if let Some((g, _)) = self.cons.punto {
                let s = self.cons.paso; let (sx, sz) = (s[0].max(0.25), s[2].max(0.25)); let y = g[1] + 0.015;
                let (bx, bz) = ((g[0] / sx).floor() * sx, (g[2] / sz).floor() * sz); const N: i32 = 6;
                for i in -N..=N + 1 {
                    let x = bx + i as f32 * sx; jxjuego::vista::tramo([x, y, bz - N as f32 * sz], [x, y, bz + (N + 1) as f32 * sz], 0.006, jxjuego::vista::TUBO_AZUL, items);
                    let z = bz + i as f32 * sz; jxjuego::vista::tramo([bx - N as f32 * sx, y, z], [bx + (N + 1) as f32 * sx, y, z], 0.006, jxjuego::vista::TUBO_AZUL, items);
                }
            }
        }
        if let (Some(f), Some(p)) = (self.cons.fuente.as_ref(), self.cons.holo) {
            // (la copia transparente: la malla del prop con el material del holograma, sin sombra)
            if let Some(pf) = self.prefabs.get(&f.nombre) {
                let r = [p[0] + f.off[0], p[1] + f.off[1], p[2] + f.off[2]];
                let b = mapa::trs(r, qmul32(f.q, f.cap), [1.0; 3]); let mm = m4::mul(&b, &mapa::trs([-f.c[0], -f.c[1], -f.c[2]], [0.0, 0.0, 0.0, 1.0], [1.0; 3]));
                let n0 = items.len(); pf.items(&mm, items);
                for it in items[n0..].iter_mut() { it.mat = super::jugabilidad::MAT_HOLO; it.fl |= jxmotor::escena::FL_SIN_SOMBRA; }
            }
            let h = [f.tam[0] * 0.5, f.tam[1] * 0.5, f.tam[2] * 0.5];
            let v = |sx: f32, sy: f32, sz: f32| [p[0] + sx * h[0], p[1] + sy * h[1], p[2] + sz * h[2]];
            for (a, b) in [((-1., -1., -1.), (1., -1., -1.)), ((-1., 1., -1.), (1., 1., -1.)), ((-1., -1., 1.), (1., -1., 1.)), ((-1., 1., 1.), (1., 1., 1.)),
                           ((-1., -1., -1.), (-1., 1., -1.)), ((1., -1., -1.), (1., 1., -1.)), ((-1., -1., 1.), (-1., 1., 1.)), ((1., -1., 1.), (1., 1., 1.)),
                           ((-1., -1., -1.), (-1., -1., 1.)), ((1., -1., -1.), (1., -1., 1.)), ((-1., 1., -1.), (-1., 1., 1.)), ((1., 1., -1.), (1., 1., 1.))] {
                jxjuego::vista::tramo(v(a.0, a.1, a.2), v(b.0, b.1, b.2), 0.014, jxjuego::vista::TUBO_VERDE, items);
            }
            jxjuego::vista::tramo(f.base, p, 0.006, jxjuego::vista::TUBO_AMBAR, items);
        }
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn cuadricula_y_ejes() {
        // (un prop de 2 m: sus bordes en las líneas cada 2 m —el centro en los impares—)
        assert_eq!(a_grilla(0.2, 2.0), 1.0); assert_eq!(a_grilla(2.9, 2.0), 3.0); assert_eq!(a_grilla(-0.4, 2.0), -1.0);
        // (apilar: el piso cerca de la cuadrícula va a ella; lejos, a 5 cm)
        assert!((a_grilla_y(1.95, 1.0) - 2.0).abs() < 1e-5 && (a_grilla_y(0.52, 1.0) - 0.5).abs() < 1e-5);
        assert_eq!(eje_mundo([0.3, 0.0, -0.9]), [0.0, 0.0, -1.0]); assert_eq!(eje_mundo([-0.8, 0.0, 0.1]), [-1.0, 0.0, 0.0]);
        // (girado 100° → 90°)
        let a = 100f32.to_radians(); let q = q_recto([0.0, (a * 0.5).sin(), 0.0, (a * 0.5).cos()]);
        assert!((q[1] - (45f32.to_radians()).sin()).abs() < 1e-4 && (q[3] - (45f32.to_radians()).cos()).abs() < 1e-4, "{q:?}");
        // (mirando desde 5 m al costado de la recta x hacia el punto x=3: el holograma va a 3)
        let t = t_en_eje([0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [3.0, 0.0, 5.0], [0.0, 0.0, -1.0]).unwrap(); assert!((t - 3.0).abs() < 1e-4, "{t}");
        assert!(t_en_eje([0.0; 3], [1.0, 0.0, 0.0], [0.0, 0.0, 5.0], [1.0, 0.0, 0.0]).is_none());
    }
}
