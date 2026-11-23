//! Los efectos, como efectos.js: partículas en carteles (humo, fuego, chispas, polvo, escombros, brasas), el fogonazo del
//! arma, las trazas de las balas, los impactos según la superficie, las explosiones (con el fuego que queda ardiendo en el
//! piso, de destruccion.js) y las luces que dejan; y las marcas pegadas al piso o a las paredes: las tiras de marcas.js
//! (frenadas y la quemadura de una explosión —desQuemadura—) y, propio del juego nativo, los agujeros de bala.
//! Cada cuadro: `paso` mueve todo, `bloques` arma lo que el motor dibuja —los bloques de `Cuadro.efectos`: las partículas
//! de alfa (de lejos a cerca), las que suman, las trazas y, sólo cuando cambian, las marcas— y `luces` da las luces del
//! momento (el fogonazo y las de las explosiones y el fuego). El atlas de las partículas (efectosAtlas: punto suave,
//! bocanada de humo, llama y anillo) lo arma `atlas`, con el número de textura que buscan los motores (TEX_ATLAS).
//! Los números al azar son de una semilla (mulberry32): con la misma semilla sale lo mismo.
use crate::mundo::{add, cruz, esc, largo, sub, Mundo, V};
use jxmotor::escena::{Cabecera, Escena, Luz, LuzP, Tex, EF_MARCAS, EF_PART_ALFA, EF_PART_SUMA};
use jxmotor::gpu::TEX_ATLAS;
use jxmotor::mat::{self as m4, M4};

/// los números de cada partícula en los bloques (la fila del primer vértice de los 6 de efectos.js)
pub const PART_F: usize = 16;
/// la gravedad de la Tierra (GRAV de fisica.js)
pub const GRAV: f32 = 9.81;
/// lo ancho de una traza: la mitad, por metro de distancia a la cámara (≈ 2 píxeles en una pantalla de 720 de alto)
pub const TRAZA_ANCHO: f32 = 0.0022;
/// el modo de las trazas en la fila (los de efectos.js: 0 cartel, 1 estirada, 2 plana en el piso; 3, propio: una línea del
/// mismo ancho en la pantalla de aP − aS a aP)
pub const MODO_TRAZA: f32 = 3.0;
const TAU: f32 = 6.2832;
/// cuántas tiras de marcas como máximo (marcas.js) y cuántas por calidad
const MARCAS_MAX: usize = 900;
const TOPE_MARCAS: [usize; 5] = [200, 400, 700, 900, 900];
/// los agujeros de bala: cuántos como máximo y por calidad, y los floats de cada uno (30 triángulos de 7 floats por vértice)
const AGUJEROS_MAX: usize = 64;
const TOPE_AGUJEROS: [usize; 5] = [16, 24, 48, 64, 64];
const AGUJERO_F: usize = 30 * 3 * 7;
/// por calidad (Patata, Bajo, Medio, Alto, Ultra: los perfiles de principal.js): GFX.part, GFX.luz y lo lejos que se dibuja
const CALIDAD: [(f32, u8, f32); 5] = [(0.25, 0, 160.0), (0.5, 1, 250.0), (0.8, 2, 450.0), (1.0, 2, 750.0), (1.0, 3, 1100.0)];

/// la clase de partícula: humo y gota (alfa; la gota cae y se ve desde el primer cuadro), fuego, chispa y fog (suman)
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tipo { Humo, Gota, Fuego, Chispa, Fog }
impl Tipo {
    /// si suma luz (las de fuego, chispas y destellos) en vez de taparla
    pub fn suma(self) -> bool { !matches!(self, Tipo::Humo | Tipo::Gota) }
}
/// contra qué fue un impacto: el mapa, un cuerpo (un objeto o una persona) o un golpe cuerpo a cuerpo
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Sup { Mundo, Cuerpo, Golpe }

/// una partícula (lo de efectos.js): `fr` freno del aire, `rampa` fuego que se enfría (blanco → naranja → rojo), `calor`
/// segundos en que el humo sale iluminado por el fuego, `suave` crece rápido y después despacio, `piso` rebota ahí,
/// `estela` deja humo, `t` negativo aparece después, `tile`/`modo` cuadro del atlas (-1: la textura entera) y forma
/// (0 cartel, 1 estirada por su velocidad o por `sv`, 2 plana en el piso), `suelo` se desvanece contra ese piso
#[derive(Clone, Debug)]
pub struct Particula {
    pub p: V, pub v: V, pub vida: f32, pub t: f32, pub tam: f32, pub col: [f32; 4], pub tipo: Tipo, pub crece: f32, pub grav: f32,
    pub rot: f32, pub dr: f32, pub tile: f32, pub modo: u8, pub fr: f32, pub rampa: bool, pub calor: f32, pub suave: bool,
    pub piso: Option<f32>, pub estela: f32, et: f32, pub suelo: Option<f32>, pub sv: Option<V>,
}

/// una luz que dura un rato (luzTemporal): se apaga de a poco
struct LuzT { p: V, r: f32, c: [f32; 3], t: f32, dur: f32 }
struct Traza { a: V, b: V, t: f32 }
/// el fuego que queda en el piso después de una explosión (desFuego de destruccion.js)
struct Fuego { p: V, esc: f32, t: f32, dur: f32, et: f32, ht: f32, lt: f32 }

pub struct Efectos {
    /// las partículas vivas
    pub l: Vec<Particula>,
    /// la calidad (GFX.part: cuántas se crean; GFX.luz: los topes de trazas y lo chico que se salta lejos; lo lejos que se dibuja)
    pub part: f32, pub luz_cal: u8, pub lejos: f32, nivel: usize,
    /// con qué luz se ve el humo (partLuz: el cielo y el sol del momento; de noche, oscuro): `luz_de`
    pub luz: [f32; 3],
    /// el alto de la pantalla en píxeles (lo que mide menos de medio píxel no se manda)
    pub alto_px: f32,
    /// si los impactos contra el mapa dejan un agujero (en la web no hay)
    pub agujeros: bool,
    /// cuántas se mandaron y cuántas se saltaron en el último `bloques` (para medir)
    pub vistas: usize, pub saltadas: usize,
    fog: f32, fog_p: V,
    luces_t: Vec<LuzT>, trazas: Vec<Traza>, fuegos: Vec<Fuego>,
    /// las tiras de marcas (de a 6 vértices de 7 floats, en un anillo como marcas.js) y los agujeros (otro anillo)
    marcas: Vec<f32>, m_n: usize, m_ini: usize,
    aguj: Vec<f32>, a_n: usize, a_ini: usize,
    marcas_sucias: bool,
    cam: V,
    sem: u32,
}

impl Efectos {
    /// vacío, en calidad Alto, con los números al azar de `semilla`
    pub fn nuevo(semilla: u32) -> Efectos {
        let mut e = Efectos { l: Vec::with_capacity(900), part: 1.0, luz_cal: 2, lejos: 750.0, nivel: 3, luz: [1.0; 3], alto_px: 720.0, agujeros: true, vistas: 0, saltadas: 0,
            fog: 0.0, fog_p: [0.0; 3], luces_t: vec![], trazas: vec![], fuegos: vec![],
            marcas: vec![0.0; MARCAS_MAX * 42], m_n: 0, m_ini: 0, aguj: vec![0.0; AGUJEROS_MAX * AGUJERO_F], a_n: 0, a_ini: 0, marcas_sucias: true, cam: [0.0; 3], sem: semilla };
        e.calidad(3); e
    }
    /// la calidad de Ajustes: 0 Patata, 1 Bajo, 2 Medio, 3 Alto, 4 Ultra
    pub fn calidad(&mut self, nivel: usize) {
        let n = nivel.min(4); let (p, l, lj) = CALIDAD[n];
        self.nivel = n; self.part = p; self.luz_cal = l; self.lejos = lj;
    }
    /// la luz del humo desde la del cuadro (en lineal, como la manda el juego: se vuelve a la de gamma con la que la calcula la web)
    pub fn luz_de(&mut self, l: &Luz) {
        let g = |x: f32| x.max(0.0).powf(1.0 / 2.2);
        for j in 0..3 { self.luz[j] = (0.12 + g(l.amb_s[j] / 1.3) * 1.4 + g(l.sol_c[j] / 2.6) * 0.5).min(1.15); }
    }
    /// borra todo (cambio de mapa): partículas, luces, trazas, fuego y marcas (el próximo `bloques` manda las marcas vacías)
    pub fn limpiar(&mut self) {
        self.l.clear(); self.luces_t.clear(); self.trazas.clear(); self.fuegos.clear(); self.fog = 0.0;
        self.limpiar_marcas();
    }
    pub fn limpiar_marcas(&mut self) { self.m_n = 0; self.m_ini = 0; self.a_n = 0; self.a_ini = 0; self.marcas_sucias = true; }
    /// que el próximo `bloques` vuelva a mandar las marcas (otro motor, o el motor se rehízo)
    pub fn reenviar_marcas(&mut self) { self.marcas_sucias = true; }
    pub fn cuantas(&self) -> usize { self.l.len() }

    /// un número al azar entre 0 y 1 (mulberry32)
    pub fn azar(&mut self) -> f64 {
        self.sem = self.sem.wrapping_add(0x6D2B_79F5); let a = self.sem;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        (t ^ (t >> 14)) as f64 / 4_294_967_296.0
    }
    fn az(&mut self, a: f32, b: f32) -> f32 { a + self.azar() as f32 * (b - a) }
    fn tope(&self) -> f32 { (if self.part >= 0.8 { 900.0 } else { 600.0 }) * self.part }

    /// una partícula nueva (si no se llegó al tope de la calidad): para ajustarla, la devuelve
    #[allow(clippy::too_many_arguments)]
    pub fn particula(&mut self, p: V, v: V, vida: f32, tam: f32, col: [f32; 4], tipo: Tipo, crece: f32) -> Option<&mut Particula> {
        if self.nueva(p, v, vida, tam, col, tipo, crece) { self.l.last_mut() } else { None }
    }
    #[allow(clippy::too_many_arguments)]
    fn nueva(&mut self, p: V, v: V, vida: f32, tam: f32, col: [f32; 4], tipo: Tipo, crece: f32) -> bool {
        if self.l.len() as f32 >= self.tope() { return false; }
        let humo = tipo == Tipo::Humo;
        let rot = if humo { (self.azar() as f32 - 0.5) * 1.4 } else { self.azar() as f32 * TAU };
        let dr = (self.azar() as f32 - 0.5) * if humo { 0.5 } else { 1.6 };
        let grav = match tipo { Tipo::Chispa | Tipo::Gota => 1.0, Tipo::Humo => -0.05, _ => 0.0 };
        let tile = match tipo { Tipo::Humo => 1.0, Tipo::Fuego => 2.0, _ => 0.0 };
        self.l.push(Particula { p, v, vida, t: 0.0, tam, col, tipo, crece, grav, rot, dr, tile, modo: (tipo == Tipo::Chispa) as u8, fr: 0.0, rampa: false, calor: 0.0, suave: false,
            piso: None, estela: 0.0, et: 0.0, suelo: None, sv: None });
        true
    }
    /// la última creada (para ajustarla después de `nueva`)
    fn ult(&mut self) -> &mut Particula { self.l.last_mut().unwrap() }

    /// una luz que dura `dur` segundos y se apaga de a poco (las explosiones, el fuego)
    pub fn luz_temporal(&mut self, p: V, r: f32, c: [f32; 3], dur: f32) { self.luces_t.push(LuzT { p, r, c, t: dur, dur }); }

    // ———————————————————————— cada cuadro ————————————————————————
    /// mueve todo `dt` segundos; `gravedad` en m/s² (la de la web: GRAV, 9,81)
    pub fn paso(&mut self, dt: f32, gravedad: f32) {
        // (el fuego que queda en el piso —antes, como desPaso en la web—)
        self.paso_fuegos(dt);
        let mut i = self.l.len();
        while i > 0 {
            i -= 1;
            let q = &mut self.l[i]; q.t += dt;
            if q.t >= q.vida { self.l.swap_remove(i); continue; }
            if q.t < 0.0 { continue; }
            q.v[1] -= gravedad * q.grav * dt;
            if q.fr != 0.0 { q.v = esc(q.v, (-dt * q.fr).exp()); } else if q.tipo == Tipo::Humo { q.v = esc(q.v, (-dt * 1.5).exp()); }
            q.p = add(q.p, esc(q.v, dt)); q.rot += q.dr * dt;
            if let Some(y) = q.piso { if q.p[1] < y && q.v[1] < 0.0 {
                q.p[1] = y; q.v[1] *= -0.3; q.v[0] *= 0.55; q.v[2] *= 0.55;
                if q.tipo == Tipo::Chispa && q.v[1].abs() < 0.8 { q.vida = q.vida.min(q.t + 0.15); }
            } }
            // (cada bocanada de la estela, estirada hasta la anterior: una estela seguida)
            if q.estela > 0.0 {
                q.et -= dt;
                if q.et <= 0.0 && q.t < q.vida * 0.8 {
                    q.et = 0.035; let (p, e, v) = (q.p, q.estela, q.v);
                    if self.nueva(p, [0.0, 0.25, 0.0], 0.6, e, [0.3, 0.29, 0.28, 0.4], Tipo::Humo, 1.6) { let h = self.ult(); h.calor = 0.2; h.dr = 0.0; h.modo = 1; h.sv = Some(esc(v, 0.04)); h.grav = 0.0; }
                }
            }
        }
        if self.fog > 0.0 { self.fog -= dt; }
        self.luces_t.retain_mut(|l| { l.t -= dt; l.t > 0.0 });
        self.trazas.retain_mut(|t| { t.t -= dt; t.t > 0.0 });
    }
    /// el fuego en el piso: llamas chicas que suben y se apagan, su humo y la luz que titila (desPaso de destruccion.js)
    fn paso_fuegos(&mut self, dt: f32) {
        let q = self.part; let cam = self.cam; let mut luces = 0;
        let mut i = self.fuegos.len();
        while i > 0 {
            i -= 1;
            self.fuegos[i].t += dt;
            if self.fuegos[i].t >= self.fuegos[i].dur { self.fuegos.remove(i); continue; }
            let (fp, e, k) = { let f = &self.fuegos[i]; (f.p, f.esc, 1.0 - f.t / f.dur) };
            let dc = largo(sub(cam, fp)); if dc > 150.0 { continue; }
            let lejos = if dc > 60.0 { 0.45 } else { 1.0 };
            self.fuegos[i].et -= dt * 26.0 * k * q * lejos * e.min(2.0);
            while self.fuegos[i].et <= 0.0 {
                self.fuegos[i].et += 1.0;
                let u = self.azar() as f32 * TAU; let r = (self.azar() as f32).sqrt() * 0.9 * e * (0.5 + 0.5 * k);
                let p = [fp[0] + u.cos() * r, fp[1] + 0.05, fp[2] + u.sin() * r];
                let v = [self.az(-0.2, 0.2), self.az(1.4, 2.8), self.az(-0.2, 0.2)];
                let vida = self.az(0.3, 0.6); let tam = self.az(0.12, 0.26) * e.sqrt() * (0.5 + 0.5 * k);
                if self.nueva(p, v, vida, tam, [1.0, 1.0, 1.0, 0.85], Tipo::Fuego, 0.9) { let x = self.ult(); x.rampa = true; x.fr = 1.4; x.grav = -0.06; }
            }
            self.fuegos[i].ht -= dt * 7.0 * q * lejos;
            while self.fuegos[i].ht <= 0.0 {
                self.fuegos[i].ht += 1.0;
                let p = add(fp, [self.az(-0.4, 0.4) * e, 0.5 + self.az(0.0, 0.4), self.az(-0.4, 0.4) * e]);
                let v = [self.az(-0.25, 0.25), self.az(1.5, 2.6), self.az(-0.25, 0.25)];
                let vida = self.az(3.0, 5.0); let tam = self.az(0.35, 0.6) * e;
                if self.nueva(p, v, vida, tam, [0.24, 0.23, 0.22, 0.55 * (0.4 + 0.6 * k)], Tipo::Humo, 2.6) { let x = self.ult(); x.fr = 0.7; x.calor = 0.5; }
            }
            self.fuegos[i].lt -= dt;
            if self.fuegos[i].lt <= 0.0 && luces < 6 && dc < 70.0 {
                self.fuegos[i].lt = 0.1; luces += 1;
                let a = (0.7 + self.azar() as f32 * 0.6) * k;
                self.luz_temporal([fp[0], fp[1] + 0.8, fp[2]], 5.0 + 3.0 * e, [6.0 * a, 2.8 * a, 0.8 * a], 0.13);
            }
        }
    }

    /// lo que el motor dibuja este cuadro (`Cuadro.efectos`), visto con `vp` desde `cam`: las partículas de alfa (de lejos a
    /// cerca) y las que suman —cada bloque con la derecha y el arriba de la cámara y 16 floats por partícula—, las trazas
    /// (otro bloque de alfa, encima) y, si cambiaron, las marcas (EF_MARCAS: triángulos de 7 floats por vértice). Lo que
    /// está fuera de la vista, lo que mide menos de medio píxel y, en Patata y Bajo, lo chico pasado el 60 % de lo lejos que
    /// se dibuja, no se manda
    pub fn bloques(&mut self, vp: &M4, cam: V) -> Vec<(u32, Vec<f32>)> {
        self.cam = cam;
        // (la derecha y el arriba de la cámara: las filas de la vista dentro de vp —una proyección simétrica—)
        let (f0, f1) = ([vp[0], vp[4], vp[8]], [vp[1], vp[5], vp[9]]);
        let (der, arr) = (m4::norm(f0), m4::norm(f1));
        let px = largo(f1) * self.alto_px * 0.5;
        let pl = m4::planos(vp);
        let lejos_b = if self.luz_cal < 2 { self.lejos * 0.6 } else { 1e9 };
        let luz = self.luz;
        let mut out = Vec::with_capacity(4);
        self.vistas = 0; self.saltadas = 0;
        let mut orden: Vec<(f32, usize)> = Vec::with_capacity(self.l.len());
        for aditivo in [false, true] {
            orden.clear();
            for (i, q) in self.l.iter().enumerate() {
                if q.t < 0.0 || q.tipo.suma() != aditivo { continue; }
                // (el radio que cubre todo lo dibujado: el cartel girado mide hasta s·√2 y la chispa se estira media velocidad·0,06)
                let w = if q.modo == 1 { Some(q.sv.unwrap_or(q.v)) } else { None };
                let sm = q.tam * (1.0 + q.crece.max(0.0)) * 1.42 + w.map(|w| largo(w) * if q.sv.is_some() { 0.5 } else { 0.03 }).unwrap_or(0.0) + 0.3;
                let dv = sub(q.p, cam); let d2 = dv[0] * dv[0] + dv[1] * dv[1] + dv[2] * dv[2]; let d = d2.sqrt();
                if (d > sm && !m4::esfera_dentro(&pl, &[q.p[0], q.p[1], q.p[2], sm])) || sm * px < 0.5 * d || (d > lejos_b && sm < 1.2) { self.saltadas += 1; continue; }
                orden.push((d2, i)); self.vistas += 1;
            }
            if orden.is_empty() { continue; }
            // (las de alfa de lejos a cerca, para que se encimen bien)
            if !aditivo && orden.len() > 1 && orden.len() < 700 { orden.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal)); }
            let n = orden.len().min(900);
            let mut b = Vec::with_capacity(6 + n * PART_F);
            b.extend_from_slice(&[der[0], der[1], der[2], arr[0], arr[1], arr[2]]);
            for &(_, i) in &orden[..n] {
                let q = &self.l[i];
                let k = q.t / q.vida; let c = q.col;
                let (mut r, mut g, mut bb) = (c[0], c[1], c[2]); let a;
                if q.tipo == Tipo::Gota { a = c[3] * (1.0 - k * k); }
                else if !aditivo {
                    a = c[3] * (k * 7.0).min(1.0) * (1.0 - k * k); r *= luz[0]; g *= luz[1]; bb *= luz[2];
                    // (el humo que sale del fuego, iluminado por él al principio)
                    if q.calor > 0.0 && q.t < q.calor { let h = (1.0 - q.t / q.calor).powi(2); r += (1.0 - r) * h * 0.9; g += (0.48 - g) * h * 0.9; bb += (0.16 - bb) * h * 0.9; }
                } else if q.rampa { let rc = rampa(k); r *= rc[0]; g *= rc[1]; bb *= rc[2]; a = c[3] * (1.0 - k).powf(1.2); }
                else { a = c[3] * (1.0 - k); }
                let s = q.tam * (1.0 + q.crece * if q.suave { 1.0 - (1.0 - k) * (1.0 - k) } else { k });
                // (las chispas, estiradas a lo largo de su velocidad; el humo que toca el piso se desvanece contra él en vez de cortarse)
                let (modo, sx, sy, sz) = if q.modo == 1 { let (e, w) = match q.sv { Some(sv) => (1.0, sv), None => (0.06, q.v) }; (1.0, w[0] * e, w[1] * e, w[2] * e) }
                    else { (q.modo as f32, q.suelo.unwrap_or(0.0), if q.suelo.is_some() { 1.0 } else { 0.0 }, 0.0) };
                b.extend_from_slice(&[q.p[0], q.p[1], q.p[2], r, g, bb, a, -1.0, -1.0, s, q.rot, q.tile, modo, sx, sy, sz]);
            }
            out.push((if aditivo { EF_PART_SUMA } else { EF_PART_ALFA }, b));
        }
        // las trazas de las balas: líneas finas encima de todo (en la web, líneas de un píxel), de color claro que se borra
        if !self.trazas.is_empty() {
            let mut b = Vec::with_capacity(6 + self.trazas.len() * PART_F);
            b.extend_from_slice(&[der[0], der[1], der[2], arr[0], arr[1], arr[2]]);
            for t in &self.trazas {
                let d = sub(t.b, t.a); let c = esc(add(t.a, t.b), 0.5);
                if !m4::esfera_dentro(&pl, &[c[0], c[1], c[2], largo(d) * 0.5 + 0.3]) { continue; }
                b.extend_from_slice(&[t.b[0], t.b[1], t.b[2], 1.0, 0.92, 0.6, 0.8 * t.t / 0.06, -1.0, -1.0, TRAZA_ANCHO, 0.0, 0.0, MODO_TRAZA, d[0], d[1], d[2]]);
            }
            if b.len() > 6 { out.push((EF_PART_ALFA, b)); }
        }
        if self.marcas_sucias { self.marcas_sucias = false; out.push((EF_MARCAS, self.marcas_juntas())); }
        out
    }
    /// las marcas en orden (de la más vieja a la más nueva) y después los agujeros: triángulos de 7 floats por vértice
    fn marcas_juntas(&self) -> Vec<f32> {
        let mut v = Vec::with_capacity(self.m_n * 42 + self.a_n * AGUJERO_F);
        for j in 0..self.m_n { let o = (self.m_ini + j) % MARCAS_MAX * 42; v.extend_from_slice(&self.marcas[o..o + 42]); }
        for j in 0..self.a_n { let o = (self.a_ini + j) % AGUJEROS_MAX * AGUJERO_F; v.extend_from_slice(&self.aguj[o..o + AGUJERO_F]); }
        v
    }
    /// las luces del momento: el fogonazo (en la boca del arma) y las que duran un rato, que se apagan de a poco (posición y
    /// radio, color, 0, dirección y cono —-2: sin cono—: como `Cuadro.luces`)
    pub fn luces(&self) -> Vec<LuzP> {
        let mut v = Vec::with_capacity(self.luces_t.len() + 1);
        if self.fog > 0.0 { let p = self.fog_p; v.push([p[0], p[1], p[2], 7.0, 6.0, 4.2, 2.0, 0.0, 0.0, -1.0, 0.0, -2.0]); }
        for l in &self.luces_t { let k = l.t / l.dur; v.push([l.p[0], l.p[1], l.p[2], l.r, l.c[0] * k, l.c[1] * k, l.c[2] * k, 0.0, 0.0, -1.0, 0.0, -2.0]); }
        v
    }

    // ———————————————————————— los efectos ————————————————————————
    /// el fogonazo del arma en `boca` (la boca del arma): un destello y su luz por 0,05 s
    pub fn fogonazo(&mut self, boca: V) {
        self.fog = 0.05; self.fog_p = boca;
        self.nueva(boca, [0.0; 3], 0.06, 0.12, [1.0, 0.8, 0.4, 1.0], Tipo::Fog, 1.2);
    }
    /// la traza de una bala de `a` a `b` (0,06 s; con tope por calidad: en Patata 12 a la vez, en Bajo 24; arriba, 64)
    pub fn traza(&mut self, a: V, b: V) {
        let tope = if self.luz_cal < 1 { 12 } else if self.luz_cal < 2 { 24 } else { 64 };
        if self.trazas.len() >= tope { self.trazas.remove(0); }
        self.trazas.push(Traza { a, b, t: 0.06 });
    }
    /// un impacto en `p` con normal `n`: chispas y una bocanada de polvo (más rojiza contra un cuerpo); contra el mapa, si
    /// `agujeros`, el agujero de la bala
    pub fn impacto(&mut self, p: V, n: V, tipo: Sup) {
        let k = if self.part > 0.5 { 6 } else { 2 };
        for _ in 0..k {
            let s = 1.5 + self.azar() as f32 * 2.0;
            let r = [(self.azar() as f32 - 0.5) * 2.0, self.azar() as f32 * 1.5, (self.azar() as f32 - 0.5) * 2.0];
            let v = add(esc(n, s), r); let vida = 0.25 + self.azar() as f32 * 0.2;
            self.nueva(add(p, esc(n, 0.03)), v, vida, 0.025, [1.0, 0.85, 0.5, 1.0], Tipo::Chispa, 0.0);
        }
        let col = if tipo == Sup::Cuerpo { [0.6, 0.55, 0.5, 0.5] } else { [0.75, 0.7, 0.62, 0.55] };
        self.nueva(add(p, esc(n, 0.05)), esc(n, 0.4), 0.7, 0.12, col, Tipo::Humo, 1.8);
        if tipo == Sup::Mundo && self.agujeros { self.agujero(p, n); }
    }
    /// el hielo de la herramienta de congelar: destellos celestes alrededor de `c` (radio `r`)
    pub fn congelar(&mut self, c: V, r: f32) {
        for _ in 0..8 {
            let p = [c[0] + (self.azar() as f32 - 0.5) * r, c[1] + (self.azar() as f32 - 0.5) * r, c[2] + (self.azar() as f32 - 0.5) * r];
            self.nueva(p, [0.0, 0.4, 0.0], 0.6, 0.08, [0.5, 0.85, 1.0, 1.0], Tipo::Fog, 0.5);
        }
    }
    fn dir(&mut self, en_piso: bool) -> V {
        let d = [self.az(-1.0, 1.0), self.az(if en_piso { -0.15 } else { -1.0 }, 1.0), self.az(-1.0, 1.0)];
        if largo(d) < 0.05 { [0.0, 1.0, 0.0] } else { m4::norm(d) }
    }
    /// una explosión en `p` de tamaño `esc` (1: una granada de HL2; hasta 6), con el piso de abajo si lo hay (`piso_bajo`:
    /// su altura y su normal). Destello corto (sin quemar la pantalla) con un núcleo caliente, la onda de choque (un anillo
    /// que se abre muy rápido), bola de fuego que sale rápido, frena y se enfría, humo iluminado por el fuego que sube y se
    /// abre y, detrás, la columna que sigue subiendo; chispas que caen y rebotan; en Bajo y más, la onda en el piso, el polvo
    /// que corre por el suelo, la quemadura y fuego que queda ardiendo un rato; en Medio y más, escombros con estela de
    /// humo; en Alto y más, brasas que flotan (efectoExplosion). El temblor de la cámara: `temblor`
    pub fn explosion(&mut self, p: V, escala: f32, piso: Option<(f32, V)>) {
        let e = if escala > 0.0 { escala.min(6.0) } else { 1.0 };
        let q = self.part; let n = |x: f32| ((x * q).round() as i32).max(1);
        let en_piso = piso.map(|(y, _)| p[1] - y < 2.5 * e).unwrap_or(false);
        let py = piso.map(|x| x.0).unwrap_or(p[1] - 1.0);
        let n_piso = match piso { Some((_, nn)) if nn[1] > 0.5 => nn, _ => [0.0, 1.0, 0.0] };
        let se = e.sqrt(); let col_k = if q >= 0.8 { 1.0 } else { 0.7 };
        // destello (un instante: chico, para que no blanquee la pantalla de cerca) y el núcleo caliente que dura un poco más
        self.nueva(p, [0.0; 3], 0.11, 3.0 * e, [1.0, 0.93, 0.78, 1.0], Tipo::Fog, 0.9);
        if self.nueva(p, [0.0; 3], 0.24, 1.5 * e, [1.0, 0.82, 0.5, 1.0], Tipo::Fuego, 1.6) { let x = self.ult(); x.rampa = true; x.suave = true; }
        // la onda de choque: un anillo claro que se abre en un cuarto de segundo
        if self.nueva(p, [0.0; 3], 0.26, 0.7 * e, [1.0, 0.96, 0.88, 0.32], Tipo::Fog, 10.0) { let x = self.ult(); x.tile = 3.0; x.suave = true; x.dr = 0.0; }
        for _ in 0..n(24.0) {
            let d = self.dir(en_piso);
            let pp = add(p, esc(d, self.az(0.0, 0.45) * e)); let v = add(esc(d, self.az(3.0, 10.5) * e), [0.0, self.az(0.5, 2.2), 0.0]);
            let vida = self.az(0.45, 1.0); let tam = self.az(0.65, 1.3) * e;
            if self.nueva(pp, v, vida, tam, [1.0, 1.0, 1.0, 1.0], Tipo::Fuego, 1.7) { let x = self.ult(); x.fr = 4.2; x.rampa = true; x.suave = true; x.suelo = Some(py); }
        }
        // (el humo: gris oscuro iluminado por el cielo, sube como columna y se abre; no tapa toda la pantalla)
        for _ in 0..n(16.0) {
            let d = self.dir(en_piso);
            let pp = add(p, esc(d, self.az(0.2, 0.8) * e)); let v = add(esc(d, self.az(1.2, 4.0) * e), [0.0, self.az(1.8, 3.6), 0.0]);
            let vida = self.az(3.0, 6.0) * col_k; let tam = self.az(0.8, 1.35) * e;
            if self.nueva(pp, v, vida, tam, [0.3, 0.29, 0.28, 0.72], Tipo::Humo, 1.9) { let t = -self.az(0.03, 0.28); let x = self.ult(); x.fr = 1.5; x.calor = 0.85; x.suave = true; x.t = t; x.grav = -0.2; x.suelo = Some(py); }
        }
        // (la columna: bocanadas que salen después de la bola de fuego y siguen subiendo, más oscuras arriba)
        for _ in 0..n(9.0) {
            let pp = add(p, [self.az(-0.35, 0.35) * e, self.az(0.0, 0.8) * e, self.az(-0.35, 0.35) * e]);
            let v = [self.az(-0.4, 0.4), self.az(3.0, 5.5) * se, self.az(-0.4, 0.4)];
            let vida = self.az(4.0, 7.0) * col_k; let tam = self.az(0.7, 1.1) * e;
            if self.nueva(pp, v, vida, tam, [0.22, 0.21, 0.2, 0.62], Tipo::Humo, 2.6) { let t = -self.az(0.12, 0.9); let x = self.ult(); x.t = t; x.fr = 0.55; x.calor = 0.6; x.grav = -0.1; x.suave = true; }
        }
        for _ in 0..n(28.0) {
            let d = self.dir(en_piso); let v = esc(d, self.az(8.0, 22.0) * se); let vida = self.az(0.5, 1.4);
            if self.nueva(p, v, vida, 0.032 * se, [1.0, 0.78, 0.4, 1.0], Tipo::Chispa, 0.0) { let x = self.ult(); x.fr = 0.7; x.piso = Some(py + 0.02); }
        }
        if en_piso && q >= 0.5 {
            if self.nueva([p[0], py + 0.07, p[2]], [0.0; 3], 0.5, 1.2 * e, [0.78, 0.68, 0.55, 0.5], Tipo::Humo, 8.0) { let x = self.ult(); x.tile = 3.0; x.modo = 2; x.suave = true; x.calor = 0.12; x.fr = 0.0; x.grav = 0.0; x.dr = 0.0; }
            for _ in 0..n(14.0) {
                let u = self.azar() as f32 * TAU; let d = [u.cos(), 0.0, u.sin()];
                let pp = add([p[0], py + 0.35 * e, p[2]], esc(d, 0.8 * e)); let v = esc(d, self.az(5.0, 11.0) * e);
                let vida = self.az(1.6, 3.0); let tam = self.az(0.55, 1.0) * e;
                if self.nueva(pp, v, vida, tam, [0.55, 0.48, 0.4, 0.5], Tipo::Humo, 2.4) { let t = -self.az(0.0, 0.08); let x = self.ult(); x.fr = 2.6; x.grav = -0.02; x.suave = true; x.t = t; x.suelo = Some(py); }
            }
            self.quemadura([p[0], py, p[2]], n_piso, e.min(2.5));
            self.fuego([p[0], py, p[2]], e.min(2.5));
        }
        // (escombros: pedazos oscuros que vuelan, caen y rebotan; los grandes con estela de humo)
        if q >= 0.5 { for i in 0..n(if q >= 0.8 { 16.0 } else { 8.0 }) {
            let mut d = self.dir(en_piso); d[1] = d[1].abs() + 0.4; let g = i % 3 == 0;
            let v = esc(m4::norm(d), self.az(7.0, 16.0) * se); let vida = self.az(1.2, 2.4);
            let tam = (if g { self.az(0.07, 0.12) } else { self.az(0.03, 0.06) }) * e;
            if self.nueva(p, v, vida, tam, [0.07, 0.06, 0.05, 1.0], Tipo::Gota, 0.0) {
                let dr = self.az(-6.0, 6.0);
                let x = self.ult(); x.piso = Some(py + 0.03); if g && q >= 0.8 { x.estela = 0.16 * e; } x.tile = 1.0; x.dr = dr; x.fr = 0.25;
            }
        } }
        // (brasas que flotan y se apagan despacio)
        if q >= 0.8 { for _ in 0..n(22.0) {
            let d = self.dir(en_piso); let pp = add(p, esc(d, self.az(0.3, 1.6) * e)); let v = [self.az(-1.2, 1.2), self.az(0.6, 2.6), self.az(-1.2, 1.2)];
            let vida = self.az(2.0, 4.5); let tam = self.az(0.02, 0.035);
            if self.nueva(pp, v, vida, tam, [1.0, 0.55, 0.15, 1.0], Tipo::Chispa, 0.0) { let t = -self.az(0.15, 0.9); let x = self.ult(); x.grav = -0.03; x.fr = 1.2; x.modo = 0; x.t = t; }
        } }
        // (la luz: fuerte un instante y la del fuego que se apaga despacio; sin lavar todo de blanco)
        self.luz_temporal(add(p, [0.0, 1.0, 0.0]), 22.0 * e, [34.0, 19.0, 7.0], 0.6);
        self.luz_temporal(add(p, [0.0, 0.6, 0.0]), 9.0 * e, [7.0, 3.0, 1.0], 2.2);
    }
    /// fuego que queda en el piso después de una explosión (se va apagando) y su humo (desFuego; a lo sumo 6)
    pub fn fuego(&mut self, p: V, escala: f32) {
        if self.part < 0.3 { return; }
        if self.fuegos.len() >= 6 { self.fuegos.remove(0); }
        let dur = 4.0 + escala * 2.2 + self.azar() as f32 * 2.0;
        self.fuegos.push(Fuego { p, esc: escala, t: 0.0, dur, et: 0.0, ht: 0.0, lt: 0.0 });
    }

    // ———————————————————————— las marcas ————————————————————————
    /// una tira de marca (marcaTramo de marcas.js) de `a` a `b` sobre una superficie de normal `n`, de ancho `w` y fuerza `k`
    /// (0..1): las frenadas y la quemadura. En un anillo con tope por calidad (Patata 200 tiras, Bajo 400, Medio 700; 900)
    pub fn marca(&mut self, a: V, b: V, n: V, w: f32, k: f32) {
        let d = sub(b, a); let l = largo(d); if !(0.02..=3.0).contains(&l) { return; }
        let lado = esc(m4::norm(cruz(n, d)), w / 2.0); let e = esc(n, 0.02); let al = k.clamp(0.15, 1.0) * 0.55;
        let p = [add(add(a, lado), e), add(sub(a, lado), e), add(sub(b, lado), e), add(add(b, lado), e)];
        let tope = MARCAS_MAX.min(TOPE_MARCAS[self.nivel]);
        if self.m_n >= tope && self.m_n < MARCAS_MAX { self.m_ini = (self.m_ini + 1) % MARCAS_MAX; self.m_n -= 1; }
        let i = (self.m_ini + self.m_n) % MARCAS_MAX; if self.m_n < MARCAS_MAX { self.m_n += 1; } else { self.m_ini = (self.m_ini + 1) % MARCAS_MAX; }
        let mut o = i * 42;
        for q in [p[0], p[1], p[2], p[0], p[2], p[3]] { self.marcas[o..o + 7].copy_from_slice(&[q[0], q[1], q[2], 0.05, 0.05, 0.05, al]); o += 7; }
        self.marcas_sucias = true;
    }
    /// la quemadura de una explosión en el piso: tiras oscuras en estrella desde el centro y el centro más quemado (desQuemadura)
    pub fn quemadura(&mut self, p: V, n: V, escala: f32) {
        let c = [p[0], p[1] + 0.01, p[2]]; let m = 9 + (escala * 2.0).round() as usize;
        for i in 0..m {
            let u = (i as f32 / m as f32) * std::f32::consts::PI * 2.0 + self.azar() as f32 * 0.4;
            let l = 2.9f32.min((0.75 + self.azar() as f32 * 0.75) * escala); let d = [u.cos(), 0.0, u.sin()];
            let w = l * (0.55 + self.azar() as f32 * 0.25); let k = 0.55 + self.azar() as f32 * 0.3;
            self.marca(sub(c, esc(d, 0.15 * escala)), add(c, esc(d, l)), n, w, k);
        }
        for _ in 0..3 {
            let u = self.azar() as f32 * std::f32::consts::PI; let d = [u.cos(), 0.0, u.sin()]; let l = 2.9f32.min(0.7 * escala);
            self.marca(sub(c, esc(d, l / 2.0)), add(c, esc(d, l / 2.0)), n, l * 0.8, 0.8);
        }
    }
    /// el agujero de una bala en `p` sobre una superficie de normal `n` (propio del juego nativo: en la web no hay): un
    /// hueco oscuro e irregular de unos 2,5 cm, un halo de hollín que se aclara y el borde que se borra, girado al azar (sólo
    /// colores oscuros: las marcas no tienen luz y uno claro brillaría de noche). En otro anillo (Patata 16, Bajo 24, Medio
    /// 48; 64)
    pub fn agujero(&mut self, p: V, n: V) {
        let n = m4::norm(n);
        let t0 = if n[1].abs() < 0.9 { [0.0, 1.0, 0.0] } else { [1.0, 0.0, 0.0] };
        let u = m4::norm(cruz(n, t0)); let w = cruz(n, u);
        let giro = self.azar() as f32 * TAU; let r = 0.05 * (0.85 + 0.3 * self.azar() as f32);
        let c = add(p, esc(n, 0.012));
        let (mut ri, mut rm, mut re) = ([[0f32; 3]; 6], [[0f32; 3]; 6], [[0f32; 3]; 6]);
        for k in 0..6 {
            let a = giro + k as f32 * TAU / 6.0; let d = add(esc(u, a.cos()), esc(w, a.sin()));
            ri[k] = add(c, esc(d, r * 0.26 * (0.75 + 0.5 * self.azar() as f32)));
            rm[k] = add(c, esc(d, r * 0.55 * (0.8 + 0.4 * self.azar() as f32)));
            re[k] = add(c, esc(d, r * (0.75 + 0.5 * self.azar() as f32)));
        }
        let (cc, ci, cm, ce) = ([0.015, 0.015, 0.015, 0.95], [0.02, 0.019, 0.018, 0.9], [0.05, 0.046, 0.042, 0.5], [0.08, 0.075, 0.07, 0.0]);
        let tope = AGUJEROS_MAX.min(TOPE_AGUJEROS[self.nivel]);
        if self.a_n >= tope { self.a_ini = (self.a_ini + 1) % AGUJEROS_MAX; self.a_n -= 1; }
        let i = (self.a_ini + self.a_n) % AGUJEROS_MAX; self.a_n += 1;
        let mut o = i * AGUJERO_F;
        let mut pon = |q: V, col: [f32; 4]| { self.aguj[o..o + 7].copy_from_slice(&[q[0], q[1], q[2], col[0], col[1], col[2], col[3]]); o += 7; };
        for k in 0..6 {
            let k1 = (k + 1) % 6;
            pon(c, cc); pon(ri[k], ci); pon(ri[k1], ci);
            pon(ri[k], ci); pon(rm[k], cm); pon(rm[k1], cm);
            pon(ri[k], ci); pon(rm[k1], cm); pon(ri[k1], ci);
            pon(rm[k], cm); pon(re[k], ce); pon(re[k1], ce);
            pon(rm[k], cm); pon(re[k1], ce); pon(rm[k1], cm);
        }
        self.marcas_sucias = true;
    }
}

/// el fuego que se enfría: blanco → naranja → rojo (partRampa)
fn rampa(k: f32) -> [f32; 3] {
    const R: [[f32; 4]; 4] = [[0.0, 1.0, 0.97, 0.86], [0.12, 1.0, 0.8, 0.38], [0.42, 0.96, 0.4, 0.09], [1.0, 0.32, 0.07, 0.02]];
    let mut i = 1; while i < 3 && k > R[i][0] { i += 1; }
    let (a, b) = (R[i - 1], R[i]); let f = ((k - a[0]) / (b[0] - a[0])).clamp(0.0, 1.0);
    [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]
}

/// el piso abajo de una explosión en `p` de tamaño `escala` (el rayo de efectoExplosion: desde medio metro arriba hasta
/// 6·escala + 0,5 abajo): su altura y su normal
pub fn piso_bajo(mundo: &Mundo, p: V, escala: f32) -> Option<(f32, V)> {
    let e = if escala > 0.0 { escala.min(6.0) } else { 1.0 };
    mundo.rayo([p[0], p[1] + 0.5, p[2]], [0.0, -1.0, 0.0], 6.0 * e + 0.5).map(|g| (p[1] + 0.5 - g.t, g.n))
}
/// cuánto tiembla la cámara en `cam` por una explosión en `p` de tamaño `escala` (0..1: CAM.temblor de la web)
pub fn temblor(p: V, escala: f32, cam: V) -> f32 { let e = if escala > 0.0 { escala.min(6.0) } else { 1.0 }; (1.3 - largo(sub(cam, p)) / (28.0 * e)).clamp(0.0, 1.0) }

// ———————————————————————— el atlas ————————————————————————
/// el lado del atlas de las partículas
pub const ATLAS_N: u32 = 256;
/// los píxeles (RGBA, la primera fila es la de v = 0) del atlas de efectos.js —256×256, cuadros de 128—: 0 punto suave,
/// 1 bocanada de humo (ruido fractal, más clara arriba), 2 llama (ruido turbulento con el centro caliente y los bordes
/// deshilachados), 3 anillo (la onda en el piso). Con las mismas cuentas y la misma semilla que la web: sale igual byte a byte
pub fn atlas_px() -> Vec<u8> {
    const N: usize = 256; const T: usize = 128; const G: usize = 32;
    let mut px = vec![0u8; N * N * 4];
    let mut sem: u64 = 1_234_567;
    let tab: Vec<f32> = (0..G * G).map(|_| { sem = sem * 16807 % 2_147_483_647; (sem as f64 / 2_147_483_647.0) as f32 }).collect();
    let vr = |x: f64, y: f64| -> f64 {
        let (xi, yi) = (x.floor(), y.floor()); let (fx, fy) = (x - xi, y - yi);
        let (sx, sy) = (fx * fx * (3.0 - 2.0 * fx), fy * fy * (3.0 - 2.0 * fy)); let (xi, yi) = (xi as i64, yi as i64);
        let g = |a: i64, b: i64| tab[((b & (G as i64 - 1)) * G as i64 + (a & (G as i64 - 1))) as usize] as f64;
        (g(xi, yi) * (1.0 - sx) + g(xi + 1, yi) * sx) * (1.0 - sy) + (g(xi, yi + 1) * (1.0 - sx) + g(xi + 1, yi + 1) * sx) * sy
    };
    let fbm = |x: f64, y: f64, o: usize| { let (mut s, mut a, mut f, mut t) = (0.0, 0.5, 1.0, 0.0); for _ in 0..o { s += a * vr(x * f, y * f); t += a; f *= 2.03; a *= 0.5; } s / t };
    let ss = |a: f64, b: f64, x: f64| { let t = ((x - a) / (b - a)).clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) };
    let mut pon = |tx: usize, ty: usize, f: &dyn Fn(f64, f64) -> [f64; 4]| {
        for y in 0..T { for x in 0..T {
            let c = f((x as f64 + 0.5) / T as f64 * 2.0 - 1.0, (y as f64 + 0.5) / T as f64 * 2.0 - 1.0); let o = ((ty * T + y) * N + tx * T + x) * 4;
            for k in 0..4 { px[o + k] = (c[k].clamp(0.0, 1.0) * 255.0).round() as u8; }
        } }
    };
    pon(0, 0, &|x, y| { let d = x.hypot(y); [1.0, 1.0, 1.0, if d >= 1.0 { 0.0 } else if d < 0.45 { 1.0 - d } else { 0.55 * (1.0 - (d - 0.45) / 0.55) }] });
    pon(1, 0, &|x, y| {
        let d = x.hypot(y); let n = fbm(x * 2.1 + 5.0, y * 2.1 + 9.0, 5); let m = ss(1.0, 0.3, d + (n - 0.5) * 0.6); let a = ss(0.1, 0.62, m * (0.5 + n * 0.8));
        let l = 0.6 + 0.4 * ss(0.25, 0.8, n) + 0.16 * y; [l, l, l * 0.98, a]
    });
    pon(0, 1, &|x, y| {
        let d = x.hypot(y); let n = fbm(x * 2.8 + 17.0, y * 2.8 + 3.0, 5); let t = 1.0 - (fbm(x * 4.5 + 40.0, y * 4.5 + 11.0, 4) * 2.0 - 1.0).abs(); let m = ss(1.0, 0.15, d + (n - 0.5) * 0.75);
        let a = ss(0.04, 0.7, m * (0.3 + 0.7 * n) + t * 0.3 * m); let l = 0.55 + 0.45 * ss(0.25, 0.85, m * n + t * 0.35); [l, l, l, a]
    });
    pon(1, 1, &|x, y| { let d = x.hypot(y); let n = fbm(x * 5.0 + 70.0, y * 5.0 + 2.0, 3); [1.0, 1.0, 1.0, if d > 1.0 { 0.0 } else { (1.0 - (d - 0.76).abs() / 0.22).max(0.0).powi(2) * (0.55 + 0.45 * n) }] });
    px
}
/// el atlas como recursos para el motor (`cargar`): la textura TEX_ATLAS que leen las partículas de los tres motores.
/// Hay que volver a cargarlo después de cada `vaciar` del motor (cambio de mapa), como las letras
pub fn atlas() -> Escena {
    let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![],
        texs: vec![Tex { id: TEX_ATLAS, n: "atlas_particulas".into(), w: ATLAS_N, h: ATLAS_N, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
    Escena { c: cab, datos: atlas_px() }
}

#[cfg(test)]
mod prueba {
    use super::*;
    fn vp_de(ojo: V, mira: V) -> M4 {
        let t = 1.0 / (0.6f32).tan(); let (n, f) = (0.1, 500.0); let mut p = [0.0; 16];
        p[0] = t / 1.6; p[5] = t; p[10] = (f + n) / (n - f); p[11] = -1.0; p[14] = 2.0 * f * n / (n - f);
        m4::mul(&p, &m4::mirar(ojo, mira, [0.0, 1.0, 0.0]))
    }
    /// una explosión en el piso: crea lo de la web en Alto, todo se mueve, se apaga y desaparece; los bloques tienen 16
    /// floats por partícula, las de alfa van de lejos a cerca y la quemadura deja marcas
    #[test]
    fn explosion_completa() {
        let mut e = Efectos::nuevo(7);
        e.explosion([0.0, 0.5, 0.0], 1.0, Some((0.0, [0.0, 1.0, 0.0])));
        // (3 destellos, 24 de fuego, 16 + 9 de humo, 28 chispas, la onda en el piso, 14 de polvo, 16 escombros y 22 brasas)
        assert_eq!(e.cuantas(), 133);
        let vp = vp_de([0.0, 2.0, 15.0], [0.0, 1.0, 0.0]);
        for _ in 0..30 { e.paso(1.0 / 60.0, GRAV); }
        let b = e.bloques(&vp, [0.0, 2.0, 15.0]);
        let alfa = b.iter().find(|x| x.0 == EF_PART_ALFA).unwrap(); let suma = b.iter().find(|x| x.0 == EF_PART_SUMA).unwrap();
        assert_eq!((alfa.1.len() - 6) % PART_F, 0); assert_eq!((suma.1.len() - 6) % PART_F, 0);
        let d: Vec<f32> = alfa.1[6..].chunks(PART_F).map(|f| f[0] * f[0] + (f[1] - 2.0).powi(2) + (f[2] - 15.0).powi(2)).collect();
        assert!(d.windows(2).all(|w| w[0] >= w[1]), "las de alfa de lejos a cerca");
        let m = b.iter().find(|x| x.0 == EF_MARCAS).unwrap(); assert!(m.1.len() >= 12 * 42, "la quemadura: {}", m.1.len() / 42);
        assert!(!e.luces().is_empty());
        // (las marcas sólo se mandan cuando cambian)
        assert!(e.bloques(&vp, [0.0, 2.0, 15.0]).iter().all(|x| x.0 != EF_MARCAS));
        for _ in 0..60 * 20 { e.paso(1.0 / 60.0, GRAV); }
        assert_eq!(e.cuantas(), 0); assert!(e.luces().is_empty());
    }
    /// en Patata se crean muchas menos y no hay fuego en el piso
    #[test]
    fn calidad_patata() {
        let mut e = Efectos::nuevo(7); e.calidad(0);
        e.explosion([0.0, 0.5, 0.0], 1.0, Some((0.0, [0.0, 1.0, 0.0])));
        assert!(e.cuantas() <= 150 && e.cuantas() > 20, "{}", e.cuantas());
        assert!(e.fuegos.is_empty());
    }
    /// impactos, trazas y fogonazo: las trazas van en su bloque (modo 3) y se borran a los 0,06 s; el agujero es una marca
    #[test]
    fn impacto_traza_fogonazo() {
        let mut e = Efectos::nuevo(1);
        let vp = vp_de([0.0, 1.7, 0.0], [0.0, 1.0, -10.0]);
        e.fogonazo([0.2, 1.5, -0.6]); e.traza([0.2, 1.5, -0.6], [0.0, 1.0, -10.0]); e.impacto([0.0, 1.0, -10.0], [0.0, 0.0, 1.0], Sup::Mundo);
        assert_eq!(e.luces().len(), 1);
        let b = e.bloques(&vp, [0.0, 1.7, 0.0]);
        let tr = b.iter().filter(|x| x.0 == EF_PART_ALFA).last().unwrap(); assert_eq!(tr.1.len(), 6 + PART_F); assert_eq!(tr.1[6 + 12], MODO_TRAZA);
        assert_eq!(b.iter().find(|x| x.0 == EF_MARCAS).unwrap().1.len(), AGUJERO_F);
        for _ in 0..5 { e.paso(1.0 / 60.0, GRAV); }
        assert!(e.luces().is_empty() && e.trazas.is_empty());
    }
    /// el anillo de las marcas: con el tope de la calidad, las viejas se van
    #[test]
    fn marcas_con_tope() {
        let mut e = Efectos::nuevo(1); e.calidad(0);
        for i in 0..250 { let x = i as f32 * 0.1; e.marca([x, 0.0, 0.0], [x, 0.0, 1.0], [0.0, 1.0, 0.0], 0.2, 1.0); }
        assert_eq!(e.marcas_juntas().len(), 200 * 42);
        // (la más vieja que queda es la 50)
        assert!((e.marcas_juntas()[0] - (5.0 + 0.1)).abs() < 1e-4);
    }
}
