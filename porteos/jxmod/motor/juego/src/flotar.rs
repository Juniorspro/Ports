//! Lo que flota, como agua.js de la versión web (aguaMapa, aguaEn, aguaPuntos y aguaCuerpos): los volúmenes de agua del
//! mapa (cajas, giradas sólo alrededor de la vertical, con el agua hasta arriba y olas en el agua grande) y el empuje y el
//! arrastre del agua sobre los cuerpos de la física, una vez por paso, antes del paso (aguaFisica). Las mismas cuentas y en
//! el mismo orden que el JS (verificado contra la web corriendo en node).
//! Lo que el JS guarda en cada Body (b.dens, b.bote, b.buoy, b.persona, b.snd, b.aguaK, b.aguaP) acá va aparte, por el id
//! del cuerpo (`Aguas::cuerpos`): `fisica::Cuerpo` no lo tiene.
//! Los huecos (botellas, latas, baldes, tachos, bañeras, ollas): una cavidad con boca que se llena cuando la boca queda
//! bajo el agua (y el aire sale en burbujas), que guarda el aire si queda boca abajo, que vuelca el agua al sacarla y
//! que pesa más del lado del agua (se da vuelta). Su densidad sale del material y de cuánta agua tiene: una botella
//! vacía flota y llena se hunde. Lo que sale (burbujas, gotas, agua) lo arma quien juega con `EventoHueco`.
//! No están (todavía): los charcos, nadar (está en jugador.rs) y lo que se ve y se oye debajo del agua.
use crate::fisica::{dot, puntos_forma, rot, rot_inv, Cuerpo, Fisica, Forma, V};
use crate::forma::PrefabFisica;
use crate::paquete::Paquete;
use std::collections::HashMap;

/// AGUA_RHO: la densidad del agua (kg/m³)
pub const AGUA_RHO: f64 = 1000.0;

#[inline] fn clamp(x: f64, a: f64, b: f64) -> f64 { if x < a { a } else if x > b { b } else { x } }

/// un volumen de agua: el pie (centro cx, cz; medio ancho hx, hz; girado: ca, sa = coseno y seno del eje x), el fondo y0
/// y el agua hasta y1; ola: la altura de las olas (0,13 m en el agua grande y honda); ax0…az1: la caja alineada del pie
#[derive(Clone, Debug)]
pub struct Volumen { pub cx: f64, pub cz: f64, pub hx: f64, pub hz: f64, pub ca: f64, pub sa: f64, pub y0: f64, pub y1: f64, pub ola: f64,
    pub ax0: f64, pub ax1: f64, pub az0: f64, pub az1: f64 }
impl Volumen {
    /// aguaVolumen (con su caja)
    pub fn nuevo(cx: f64, cz: f64, hx: f64, hz: f64, ca: f64, sa: f64, y0: f64, y1: f64) -> Volumen {
        let mut v = Volumen { cx, cz, hx, hz, ca, sa, y0, y1, ola: 0.0, ax0: 0.0, ax1: 0.0, az0: 0.0, az1: 0.0 }; v.caja(); v
    }
    /// uno del mapa (gmod.py: una caja lo-hi con el agua hasta arriba), con olas si es grande y hondo (aguaMapa)
    pub fn de_caja(lo: V, hi: V) -> Volumen {
        let mut v = Volumen::nuevo((lo[0] + hi[0]) / 2.0, (lo[2] + hi[2]) / 2.0, (hi[0] - lo[0]) / 2.0, (hi[2] - lo[2]) / 2.0, 1.0, 0.0, lo[1], hi[1]);
        v.ola = if v.hx * v.hz * 4.0 > 400.0 && v.y1 - v.y0 > 0.6 { 0.13 } else { 0.0 };
        v
    }
    /// aguaCaja: la caja alineada que envuelve el pie (para descartar rápido)
    pub fn caja(&mut self) {
        let ex = (self.hx * self.ca).abs() + (self.hz * self.sa).abs(); let ez = (self.hx * self.sa).abs() + (self.hz * self.ca).abs();
        self.ax0 = self.cx - ex; self.ax1 = self.cx + ex; self.az0 = self.cz - ez; self.az1 = self.cz + ez;
    }
    /// aguaPisa: ¿el punto (x, z) cae sobre el pie?
    #[inline] pub fn pisa(&self, x: f64, z: f64) -> bool {
        if x < self.ax0 || x > self.ax1 || z < self.az0 || z > self.az1 { return false; }
        let (dx, dz) = (x - self.cx, z - self.cz);
        (dx * self.ca + dz * self.sa).abs() <= self.hx && (dz * self.ca - dx * self.sa).abs() <= self.hz
    }
    /// aguaOla: cuánto sube o baja la superficie en (x, z) al tiempo t (dos ondas que se cruzan y avanzan, hasta 13 cm)
    #[inline] pub fn ola_en(&self, t: f64, x: f64, z: f64) -> f64 {
        if self.ola != 0.0 { self.ola * ((x * 0.33 + t * 1.15).sin() * 0.6 + (z * 0.27 - t * 0.85 + 1.3).sin() * 0.4) } else { 0.0 }
    }
}

/// lo que el agua necesita saber de un cuerpo (en la web, campos del Body): la densidad de verdad (rb.dn del prefab; 380
/// en un bote), si suena a madera (los livianos flotan: como mucho 700 kg/m³), el empuje extra (buoy), si es un bote (se
/// desliza: casi sin roce de costado ni de avance) o parte de un muñeco (flota como una persona), y lo último medido:
/// cuánto de él está bajo el agua (aguaK, de 0 a 1)
#[derive(Clone, Debug)]
pub struct Flota { pub dens: Option<f64>, pub madera: bool, pub buoy: f64, pub bote: bool, pub persona: bool, pub agua_k: f64, pub hueco: Option<Hueco> }
impl Default for Flota { fn default() -> Self { Flota { dens: None, madera: true, buoy: 1.0, bote: false, persona: false, agua_k: 0.0, hueco: None } } }
impl Flota {
    /// la de un prefab (crearObjeto: b.dens = rb.dn; b.snd = rb.snd o metal/madera por la masa), y si es hueco
    pub fn de_prefab(pf: &PrefabFisica) -> Flota { Flota { dens: pf.dens.filter(|d| *d != 0.0), madera: pf.snd == "wood", hueco: Hueco::de_prefab(pf), ..Flota::default() } }
}

/// un objeto hueco: la parte del volumen que es cavidad (`cav`), cuánta agua tiene (`lleno`, de 0 a 1) y la densidad del
/// material; el eje de la cavidad (en el marco del cuerpo, hacia la boca), su medio largo, su centro y su radio; la boca
/// (en el marco del cuerpo) y su radio; el volumen de la cavidad (m³)
#[derive(Clone, Debug)]
pub struct Hueco { pub cav: f64, pub lleno: f64, pub rho_casco: f64, pub eje: V, pub l: f64, pub centro: V, pub r: f64, pub boca: V, pub boca_r: f64, pub v_cav: f64, aire: f64, agua: f64, sem: u32 }
/// lo que sale de un hueco en un paso: una burbuja (dónde y su radio), una gota que se ve (el chorro) o una partícula de
/// agua de verdad (cada litro que sale)
#[derive(Clone, Copy, Debug)]
pub enum EventoHueco { Burbuja { p: V, r: f64 }, Gota { p: V, v: V }, Agua { p: V, v: V } }
/// una boca abierta para arriba (el agua de partículas que entra, la llena): dónde, hacia dónde, el radio y lo que le cabe (m³)
#[derive(Clone, Copy, Debug)]
pub struct Boca { pub id: u32, pub p: [f32; 3], pub d: [f32; 3], pub r: f32, pub hondo: f32, pub libre: f32 }
/// (el volumen de una partícula del agua de partículas: 1 litro)
pub const LITRO: f64 = 0.001;

impl Hueco {
    /// si el prefab es un recipiente (por su nombre): botellas, cartones y latas (boca chica), baldes, tachos, ollas, tazas
    /// y bañeras (abiertos arriba). El arriba del modelo es la boca
    pub fn de_prefab(pf: &PrefabFisica) -> Option<Hueco> {
        let n = format!("{} {}", pf.nombre, pf.clave).to_lowercase();
        let tiene = |l: &[&str]| l.iter().any(|k| n.contains(k));
        let metal = tiene(&["metal", "steel", "iron", "fierro", "chapa"]);
        // (cavidad, boca abierta —parte del radio— o chica —m—, densidad del material)
        let (cav, boca_k, boca_m, rho): (f64, f64, f64, f64) = if tiene(&["bottle", "botella", "flask", "jug0", "bidon", "bidón"]) { (0.86, 0.0, 0.014, if tiene(&["plastic", "plástic"]) { 950.0 } else { 2500.0 }) }
            else if tiene(&["milkcarton", "milk_carton", "carton0", "juicebox"]) { (0.9, 0.0, 0.016, 700.0) }
            else if tiene(&["popcan", "sodacan", "soda_can", "beercan", "metalcan", "lata", "garbage_can0"]) { (0.92, 0.0, 0.011, 2700.0) }
            else if tiene(&["bathtub", "bañera", "banera", "washtub", "tina"]) { (0.75, 0.82, 0.0, 2400.0) }
            else if tiene(&["bucket", "balde", "cubeta", "pail", "trashbin", "trash_bin", "trashcan", "trash_can", "garbagecan", "tacho", "cookingpot", "olla", "kettle", "mug", "taza", "teacup", "coffeecup", "cup0", "vaso", "bowl", "wateringcan", "regadera", "jarra", "pitcher", "vase", "florero"]) {
                (0.92, 0.85, 0.0, if metal { 7800.0 } else if tiene(&["mug", "taza", "cup", "vase", "florero", "bowl", "jarra", "pitcher"]) { 2400.0 } else { 950.0 })
            } else { return None };
        let up = pf.cap_q.map(|c| rot_inv(c, [0.0, 1.0, 0.0])).unwrap_or([0.0, 1.0, 0.0]);
        let pts = puntos_forma(&pf.forma); if pts.is_empty() { return None; }
        let (mut mn, mut mx, mut rl) = (f64::MAX, f64::MIN, 0.0f64);
        for p in &pts { let a = dot(*p, up); mn = mn.min(a); mx = mx.max(a); rl = rl.max((dot(*p, *p) - a * a).max(0.0).sqrt()); }
        let l = ((mx - mn) / 2.0).max(0.01); let c = (mx + mn) / 2.0;
        let boca_r = if boca_k > 0.0 { boca_k * rl } else { boca_m.min(rl * 0.8) };
        Some(Hueco { cav, lleno: 0.0, rho_casco: rho, eje: up, l: l * 0.92, centro: [up[0] * c, up[1] * c, up[2] * c], r: rl, boca: [up[0] * mx, up[1] * mx, up[2] * mx], boca_r: boca_r.max(0.004),
            v_cav: (cav * forma_volumen(&pf.forma)).max(1e-5), aire: 0.0, agua: 0.0, sem: 0x0b0_7e11 ^ (n.len() as u32) })
    }
    /// la densidad de todo (material + agua adentro; el aire no pesa)
    pub fn rho(&self) -> f64 { self.rho_casco * (1.0 - self.cav) + AGUA_RHO * self.cav * self.lleno }
    fn azar(&mut self) -> f64 {
        self.sem = self.sem.wrapping_add(0x6D2B_79F5); let a = self.sem;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a); t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        (t ^ (t >> 14)) as f64 / 4_294_967_296.0
    }
}

/// aguaPuntos: los puntos de un cuerpo (en su marco) que empuja el agua, cada uno con su parte del volumen (w), el volumen
/// (v) y el alto de la celda de cada punto (cel)
#[derive(Clone, Debug)]
pub struct Puntos { pub pts: Vec<V>, pub w: f64, pub v: f64, pub cel: f64 }

/// un chapuzón (aguaSalpicar): algo cayó al agua con fuerza; dónde (en la superficie) y qué tan fuerte (0,12 a 1). Quien
/// juega lo usa para el sonido (AG_Salpica1..3, volumen 0,3 + 0,7·k) y las gotas
#[derive(Clone, Copy, Debug)]
pub struct Salpicon { pub p: V, pub k: f64 }

/// el agua: los volúmenes, el reloj de las olas (AGUA.t: avanza con cada cuadro, `avanzar`) y lo de cada cuerpo
#[derive(Default)]
pub struct Aguas {
    pub vols: Vec<Volumen>,
    pub t: f64,
    /// lo de cada cuerpo (por su id en la física); el que no está, flota con lo de siempre (`Flota::default`)
    pub cuerpos: HashMap<u32, Flota>,
    puntos: HashMap<u32, Puntos>,
    /// los chapuzones desde la última vez que se miró (los saca quien juega)
    pub salpicones: Vec<Salpicon>,
}

/// formaVolumen
pub fn forma_volumen(f: &Forma) -> f64 {
    match f {
        Forma::Esfera { r } => 4.18879 * r * r * r,
        Forma::Capsula { r, hh } => std::f64::consts::PI * r * r * 2.0 * hh + 4.18879 * r * r * r,
        Forma::Compuesta { partes, .. } => { let mut s = 0.0; for p in partes { s += forma_volumen(&p.forma); } s }
        Forma::Casco(c) => {
            // (tetraedros desde el centro, cara por cara, en abanico)
            let mut v = 0.0; let p = &c.v;
            for f in &c.f {
                let a = p[f.ix[0]];
                for k in 1..f.ix.len().saturating_sub(1) {
                    let (b, d) = (p[f.ix[k]], p[f.ix[k + 1]]);
                    let cr = [b[1] * d[2] - b[2] * d[1], b[2] * d[0] - b[0] * d[2], b[0] * d[1] - b[1] * d[0]];
                    v += (a[0] * cr[0] + a[1] * cr[1] + a[2] * cr[2]) / 6.0;
                }
            }
            v.abs().max(1e-4)
        }
    }
}
/// dentroForma: ¿el punto (en el marco de la forma) está adentro?
pub fn dentro_forma(f: &Forma, p: V) -> bool {
    match f {
        Forma::Esfera { r } => p[0] * p[0] + p[1] * p[1] + p[2] * p[2] <= r * r,
        Forma::Capsula { r, hh } => { let y = clamp(p[1], -hh, *hh); p[0] * p[0] + (p[1] - y) * (p[1] - y) + p[2] * p[2] <= r * r }
        Forma::Compuesta { partes, .. } => partes.iter().any(|pt| dentro_forma(&pt.forma, rot_inv(pt.q, [p[0] - pt.p[0], p[1] - pt.p[1], p[2] - pt.p[2]]))),
        Forma::Casco(c) => c.f.iter().all(|f| f.n[0] * p[0] + f.n[1] * p[1] + f.n[2] * p[2] - f.d <= 1e-6),
    }
}
/// aguaPuntos: una grilla 3×3×3 en la caja de la forma con los que caen adentro (5×5×5 si quedan menos de 4)
pub fn agua_puntos(f: &Forma) -> Puntos {
    let (mut lo, mut hi) = ([1e9f64; 3], [-1e9f64; 3]);
    for p in puntos_forma(f) { for k in 0..3 { lo[k] = lo[k].min(p[k]); hi[k] = hi[k].max(p[k]); } }
    let d = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]; let v = forma_volumen(f);
    let mut pts: Vec<V> = vec![];
    for n in [3usize, 5] {
        pts.clear(); let nf = n as f64;
        for i in 0..n { for j in 0..n { for k in 0..n {
            let p = [lo[0] + d[0] * (i as f64 + 0.5) / nf, lo[1] + d[1] * (j as f64 + 0.5) / nf, lo[2] + d[2] * (k as f64 + 0.5) / nf];
            if dentro_forma(f, p) { pts.push(p); }
        } } }
        if pts.len() >= 4 { break; }
    }
    if pts.is_empty() { pts.push([0.0; 3]); }
    // (el alto de la celda con n = 5 aunque haya alcanzado la grilla de 3: el for del JS deja n en 5 al salir —su
    // actualización «intento++, n = 5» corre antes de mirar la condición—)
    Puntos { w: v / pts.len() as f64, v, cel: (d[1] / 5.0).max(0.03), pts }
}

impl Aguas {
    /// aguaMapa con las cajas de agua del mapa del paquete (DATA.aj[mapa].agua: lo, hi), con los números del JSON
    pub fn de_mapa(paq: &Paquete, mapa: &str) -> Aguas {
        let mut a = Aguas::default();
        for x in paq.d["aj"][mapa]["agua"].as_array().into_iter().flatten() {
            let v3 = |v: &serde_json::Value| [v[0].as_f64().unwrap_or(0.0), v[1].as_f64().unwrap_or(0.0), v[2].as_f64().unwrap_or(0.0)];
            a.vols.push(Volumen::de_caja(v3(&x["lo"]), v3(&x["hi"])));
        }
        a
    }
    /// con las cajas de `Mapa::aguas` (x0, y0, z0, x1, y1, z1; en f32)
    pub fn de_cajas(cajas: &[[f32; 6]]) -> Aguas {
        let mut a = Aguas::default();
        for c in cajas { let c: Vec<f64> = c.iter().map(|x| *x as f64).collect(); a.vols.push(Volumen::de_caja([c[0], c[1], c[2]], [c[3], c[4], c[5]])); }
        a
    }
    pub fn hay(&self) -> bool { !self.vols.is_empty() }
    /// aguaEn: el volumen con agua en (x, y, z), o hasta `arriba` metros por encima de su superficie
    pub fn en(&self, x: f64, y: f64, z: f64, arriba: f64) -> Option<&Volumen> {
        self.vols.iter().find(|v| !(v.y1 <= v.y0 + 0.002 || y < v.y0 - 0.02 || y > v.y1 + arriba) && v.pisa(x, z))
    }
    /// lo de un cuerpo para el agua (al crearlo)
    pub fn registrar(&mut self, id: u32, f: Flota) { self.cuerpos.insert(id, f); self.puntos.remove(&id); }
    /// al sacarlo de la física
    pub fn olvidar(&mut self, id: u32) { self.cuerpos.remove(&id); self.puntos.remove(&id); }
    /// cuánto del cuerpo está bajo el agua (b.aguaK), de 0 a 1
    pub fn agua_k(&self, id: u32) -> f64 { self.cuerpos.get(&id).map_or(0.0, |f| f.agua_k) }
    /// el reloj de las olas: una vez por cuadro, con el tiempo del cuadro (aguaPaso)
    pub fn avanzar(&mut self, dt: f64) { self.t += dt; }

    /// los huecos, una vez por paso de la física (antes de `Fisica::paso`): se llenan con la boca bajo el agua (el aire sale
    /// en burbujas), vuelcan el agua con la boca para abajo fuera del agua y el agua de adentro los gira (pesa de su lado)
    pub fn huecos(&mut self, fis: &mut Fisica, dt: f64, ev: &mut Vec<EventoHueco>) {
        let t = self.t;
        let Aguas { vols, cuerpos, .. } = self;
        for (id, fl) in cuerpos.iter_mut() {
            let Some(h) = fl.hueco.as_mut() else { continue };
            let Some(i) = fis.indice(*id) else { continue };
            let b = &mut fis.cuerpos[i];
            if !b.dinamico() { continue; }
            let a = rot(b.q, h.eje); let ob = rot(b.q, h.boca); let o = [b.pos[0] + ob[0], b.pos[1] + ob[1], b.pos[2] + ob[2]];
            let sup = vols.iter().find(|v| v.pisa(o[0], o[2]) && o[1] > v.y0 - 0.05 && o[1] < v.y1 + v.ola + 0.02).map(|v| v.y1 + v.ola_en(t, o[0], o[2]));
            let area = std::f64::consts::PI * h.boca_r * h.boca_r; let antes = h.lleno;
            match sup {
                Some(y) if o[1] < y => {
                    // la boca bajo el agua: entra agua y sale el aire (si la boca no mira para abajo: si no, el aire queda atrapado)
                    let e = clamp((a[1] + 0.15) / 0.35, 0.0, 1.0);
                    let q = 0.6 * area * (2.0 * 9.81 * (y - o[1] + 0.03)).sqrt();
                    let dv = (q * dt * e).min((1.0 - h.lleno) * h.v_cav);
                    if dv > 0.0 {
                        h.lleno = (h.lleno + dv / h.v_cav).min(1.0); h.aire += dv;
                        let rb = clamp(h.boca_r * 0.7, 0.005, 0.028);
                        for _ in 0..6 {
                            let r = rb * (0.55 + 0.9 * h.azar()); let vb = 4.18879 * r * r * r; if h.aire < vb { break; }
                            h.aire -= vb; let j = [(h.azar() - 0.5) * h.boca_r, (h.azar() - 0.5) * h.boca_r];
                            ev.push(EventoHueco::Burbuja { p: [o[0] + a[0] * 0.01 + j[0], o[1] + a[1] * 0.01, o[2] + a[2] * 0.01 + j[1]], r });
                        }
                        h.aire = h.aire.min(4.18879 * rb * rb * rb * 12.0);
                    }
                }
                _ => {
                    // la boca en el aire: con agua y la boca más abajo que el agua de adentro, se vuelca
                    let (sy, f2) = (a[1], 2.0 * h.lleno - 1.0);
                    if h.lleno > 0.0 && sy < f2 * sy.abs() + 0.25 * f2 * (1.0 - sy.abs()) {
                        let alto = 0.02 + h.l * 2.0 * h.lleno * (1.0 - sy.max(-1.0)) * 0.5;
                        let vs = (2.0 * 9.81 * alto).sqrt(); let dv = (0.6 * area * vs * dt).min(h.lleno * h.v_cav);
                        h.lleno -= dv / h.v_cav; if h.lleno < 1e-4 { h.lleno = 0.0; }
                        h.agua += dv;
                        let vb = [b.vel[0] + a[0] * vs, b.vel[1] + a[1] * vs, b.vel[2] + a[2] * vs];
                        let p = [o[0] + a[0] * 0.02, o[1] + a[1] * 0.02, o[2] + a[2] * 0.02];
                        let j = (h.azar() - 0.5) * 0.3;
                        ev.push(EventoHueco::Gota { p, v: [vb[0] + j, vb[1], vb[2] - j] });
                        while h.agua >= LITRO { h.agua -= LITRO; ev.push(EventoHueco::Agua { p, v: vb }); }
                    }
                }
            }
            if (h.lleno - antes).abs() > 1e-4 && b.duerme { b.despertar(); }
            // el agua de adentro pesa de su lado: un giro (la fuerza neta no cambia: es el mismo peso, en otro lugar)
            if h.lleno > 0.0 && b.despierto() {
                let parte = AGUA_RHO * h.cav * h.lleno / h.rho().max(1.0);
                let abajo = if a[1] > 0.0 { -1.0 } else { 1.0 }; let corre = h.l * (1.0 - h.lleno) * abajo;
                let c = rot(b.q, h.centro); let rw = [c[0] + a[0] * corre, c[1] + a[1] * corre, c[2] + a[2] * corre];
                let fy = -b.masa * 9.81 * parte;
                let tq = [-rw[2] * fy, 0.0, rw[0] * fy];
                let o2 = rot_inv(b.q, tq); let w = rot(b.q, [o2[0] * b.inv_i[0], o2[1] * b.inv_i[1], o2[2] * b.inv_i[2]]);
                for k in 0..3 { b.ang[k] += w[k] * dt; }
            }
        }
    }
    /// las bocas abiertas para arriba que todavía tienen lugar (el agua de partículas que cae adentro las llena)
    pub fn bocas(&self, fis: &Fisica) -> Vec<Boca> {
        let mut o = vec![];
        for (id, fl) in &self.cuerpos {
            let Some(h) = &fl.hueco else { continue }; if h.lleno >= 0.999 { continue; }
            let Some(b) = fis.cuerpo(*id) else { continue };
            let a = rot(b.q, h.eje); if a[1] < 0.3 { continue; }
            let ob = rot(b.q, h.boca);
            o.push(Boca { id: *id, p: [(b.pos[0] + ob[0]) as f32, (b.pos[1] + ob[1]) as f32, (b.pos[2] + ob[2]) as f32], d: [a[0] as f32, a[1] as f32, a[2] as f32], r: h.boca_r as f32, hondo: (h.l * 2.0) as f32, libre: ((1.0 - h.lleno) * h.v_cav) as f32 });
        }
        o
    }
    /// agua que entró a un hueco (m³)
    pub fn llenar(&mut self, id: u32, vol: f64) {
        if let Some(h) = self.cuerpos.get_mut(&id).and_then(|f| f.hueco.as_mut()) { h.lleno = (h.lleno + vol / h.v_cav).min(1.0); }
    }
    /// cuánta agua tiene un hueco (None si no es hueco)
    pub fn lleno(&self, id: u32) -> Option<f64> { self.cuerpos.get(&id).and_then(|f| f.hueco.as_ref()).map(|h| h.lleno) }

    /// aguaFisica / aguaCuerpos: el empuje (por cada punto bajo el agua, el peso del agua que desplaza) y el arrastre
    /// (contra la velocidad de cada punto) en los cuerpos despiertos que tocan agua. Una vez por paso de la física, antes
    /// de `Fisica::paso`. La densidad se toma entre 250 y 9000 kg/m³: un prop con masa de juguete no sale volando
    pub fn paso(&mut self, fis: &mut Fisica, dt: f64) {
        if self.vols.is_empty() { return; }
        let t = self.t;
        let Aguas { vols, cuerpos, puntos, salpicones, .. } = self;
        for b in fis.cuerpos.iter_mut() {
            if !b.dinamico() || b.duerme || b.sin_fisica || b.agarrado { continue; }
            let a = b.geo.aabb;
            let toca = vols.iter().find(|v| !(v.y1 <= v.y0 + 0.002 || a[1] > v.y1 + v.ola || a[4] < v.y0 - 0.05 || a[3] < v.ax0 || a[0] > v.ax1 || a[5] < v.az0 || a[2] > v.az1));
            let fl = cuerpos.entry(b.id).or_default();
            let antes = fl.agua_k;
            let Some(toca) = toca else { fl.agua_k = 0.0; continue };
            let s = puntos.entry(b.id).or_insert_with(|| agua_puntos(&b.forma));
            if let Some((k, sub)) = empujar(b, fl, s, toca, vols, t, dt) {
                fl.agua_k = k;
                if sub <= 0.0 { continue; }
                // al entrar con velocidad, salpica (más cuanto más pesado y más rápido)
                if antes == 0.0 && b.vel[1] < -1.6 { salpicones.push(Salpicon { p: [b.pos[0], toca.y1, b.pos[2]], k: clamp(-b.vel[1] * b.masa.sqrt() / 45.0, 0.12, 1.0) }); }
            }
        }
    }
}

/// el empuje de un cuerpo que toca el volumen `toca` (devuelve aguaK y la suma de lo sumergido)
fn empujar(b: &mut Cuerpo, fl: &Flota, s: &Puntos, toca: &Volumen, vols: &[Volumen], t: f64, dt: f64) -> Option<(f64, f64)> {
    let (q, m) = (b.q, b.masa);
    // (los muñecos flotan como una persona: con el 85 % del cuerpo bajo el agua, sea cual sea la masa de cada parte)
    // (la madera flota: los props livianos, que suenan a madera, como mucho a 700 kg/m³, como en GMod)
    let rho = if let Some(h) = &fl.hueco { clamp(h.rho(), 60.0, 9000.0) } else { match fl.dens { Some(d) => d, None => clamp(m / s.v, 250.0, if fl.madera { 700.0 } else { 9000.0 }) } };
    let k = if fl.persona { 1.18 * m / (AGUA_RHO * s.v) } else { fl.buoy * m / (rho * s.v) };
    let (mut fx, mut fy, mut fz, mut tx, mut ty, mut tz, mut sub) = (0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64);
    for pl in &s.pts {
        let r = rot(q, *pl); let (x, y, z) = (b.pos[0] + r[0], b.pos[1] + r[1], b.pos[2] + r[2]);
        let v = if y < toca.y1 + toca.ola + s.cel * 0.5 && toca.pisa(x, z) { Some(toca) } else {
            let (yy, arriba) = (y - s.cel * 0.5, s.cel * 0.5);
            vols.iter().find(|v| !(v.y1 <= v.y0 + 0.002 || yy < v.y0 - 0.02 || yy > v.y1 + arriba) && v.pisa(x, z))
        };
        let Some(v) = v else { continue };
        // (la celda del punto, sumergida en parte —sin saltos en la superficie—, con la ola de ese punto)
        let f = clamp((v.y1 + v.ola_en(t, x, z) - y) / s.cel + 0.5, 0.0, 1.0);
        if f <= 0.0 { continue; }
        sub += f;
        let vx = b.vel[0] + b.ang[1] * r[2] - b.ang[2] * r[1]; let vy = b.vel[1] + b.ang[2] * r[0] - b.ang[0] * r[2]; let vz = b.vel[2] + b.ang[0] * r[1] - b.ang[1] * r[0];
        let fu = AGUA_RHO * 9.81 * s.w * f * k; let cd = AGUA_RHO * s.w * f * 1.8 * k;
        // (un bote se desliza: el casco corta el agua —su roce lo pone el bote mismo, vehiculo.rs—)
        let hk = if fl.bote { 0.03 } else { 1.0 };
        let (ffx, ffy, ffz) = (-cd * vx * hk, fu - cd * vy, -cd * vz * hk);
        fx += ffx; fy += ffy; fz += ffz;
        tx += r[1] * ffz - r[2] * ffy; ty += r[2] * ffx - r[0] * ffz; tz += r[0] * ffy - r[1] * ffx;
    }
    let ak = sub / s.pts.len() as f64;
    if sub <= 0.0 { return Some((ak, sub)); }
    let im = dt * b.inv_masa; b.vel[0] += fx * im; b.vel[1] += fy * im; b.vel[2] += fz * im;
    // (invIw: el giro por la inercia inversa en el mundo)
    let o = rot_inv(q, [tx, ty, tz]); let w = rot(q, [o[0] * b.inv_i[0], o[1] * b.inv_i[1], o[2] * b.inv_i[2]]);
    b.ang[0] += w[0] * dt; b.ang[1] += w[1] * dt; b.ang[2] += w[2] * dt;
    // (las olas que hace al moverse se llevan energía: sube y baja menos veces antes de quedarse flotando; y el agua frena
    // los giros aunque toque poco: un sofá que cae girando no sigue dando vueltas al flotar)
    let am = (-dt * 2.2 * ak).exp(); let aa = (-dt * (1.2 + 2.5 * ak)).exp();
    b.vel[1] *= am; b.ang[0] *= aa; b.ang[1] *= if fl.bote { (-dt * 0.4).exp() } else { aa }; b.ang[2] *= aa;
    Some((ak, sub))
}

#[cfg(test)]
mod medir_huecos {
    use super::*;
    use crate::fisica::{forma_prisma, qeje, qmul};
    use crate::forma::{cuerpo_de_prefab, PrefabFisica};
    use crate::mundo::Mundo;
    use std::sync::Arc;
    fn prefab(nombre: &str, r: f64, hy: f64, masa: f64) -> PrefabFisica {
        PrefabFisica { nombre: nombre.into(), clave: format!("{nombre}#x"), forma: Arc::new(forma_prisma(r, r, hy, 12)), c: [0.0; 3], eje_cap: None, cap_q: None, partes: 0, masa, fric: 0.6, rest: 0.1,
            tipo: "prop", sin_fisica: false, congelado: false, salta: false, snd: "metal".into(), dens: None }
    }
    /// una pileta de 6 × 6 m con agua de 2 m (el piso en −2, la superficie en 0)
    fn pileta() -> (Mundo, Aguas) {
        let h = 3.0f32; let y = -2.0f32;
        let t = vec![-h, y, -h, h, y, -h, h, y, h, -h, y, -h, h, y, h, -h, y, h];
        (Mundo::nuevo(t, vec![], 1.0), Aguas::de_cajas(&[[-3.0, -2.0, -3.0, 3.0, 0.0, 3.0]]))
    }
    /// corre `s` segundos y devuelve (altura del centro, lleno, burbujas, litros que salieron)
    fn correr(fis: &mut Fisica, m: &Mundo, ag: &mut Aguas, id: u32, s: f64) -> (f64, f64, usize, usize) {
        let (mut bur, mut lit) = (0, 0); let mut ev = vec![];
        for _ in 0..(s * 60.0) as usize {
            ev.clear(); ag.huecos(fis, 1.0 / 60.0, &mut ev); ag.paso(fis, 1.0 / 60.0); fis.paso(m, 1.0 / 60.0); ag.avanzar(1.0 / 60.0);
            for e in &ev { match e { EventoHueco::Burbuja { .. } => bur += 1, EventoHueco::Agua { .. } => lit += 1, _ => {} } }
        }
        (fis.cuerpo(id).unwrap().pos[1], ag.lleno(id).unwrap(), bur, lit)
    }
    fn poner(fis: &mut Fisica, ag: &mut Aguas, pf: &PrefabFisica, p: V, q: [f64; 4]) -> u32 {
        let b = cuerpo_de_prefab(pf, p, q, true); let id = fis.agregar(b); ag.registrar(id, Flota::de_prefab(pf)); id
    }
    #[test]
    fn huecos() {
        let botella = prefab("garbage_glassbottle001a", 0.04, 0.13, 0.5);
        let balde = prefab("metalbucket01a", 0.15, 0.16, 1.5);
        assert!(Flota::de_prefab(&botella).hueco.is_some() && Flota::de_prefab(&balde).hueco.is_some());
        let parado = [0.0, 0.0, 0.0, 1.0]; let acostado = qeje([0.0, 0.0, 1.0], std::f64::consts::FRAC_PI_2); let boca_abajo = qeje([1.0, 0.0, 0.0], std::f64::consts::PI);
        // 1) la botella vacía parada: flota y no se llena (la boca queda afuera)
        let (m, mut ag) = pileta(); let mut fis = Fisica::nueva(); let id = poner(&mut fis, &mut ag, &botella, [0.0, 0.3, 0.0], parado);
        let (y, ll, bu, _) = correr(&mut fis, &m, &mut ag, id, 6.0);
        eprintln!("botella vacía parada: centro {y:.3} (superficie 0) lleno {:.0} % burbujas {bu}", ll * 100.0);
        assert!(y > -0.15 && ll < 0.05);
        // 2) acostada flota con la boca afuera (no se llena); sumergida con la mano (la palanca) 3 s se llena largando
        // burbujas y, al soltarla, se va al fondo
        let (m, mut ag) = pileta(); let mut fis = Fisica::nueva(); let id = poner(&mut fis, &mut ag, &botella, [0.0, 0.05, 0.0], acostado);
        let (y, ll, _, _) = correr(&mut fis, &m, &mut ag, id, 4.0);
        eprintln!("botella acostada flotando: centro {y:.3} lleno {:.0} %", ll * 100.0);
        assert!(y > -0.1 && ll < 0.1);
        let mut bur = 0;
        for _ in 0..180 { fis.poner(id, [0.0, -0.6, 0.0], acostado); if let Some(c) = fis.cuerpo_mut(id) { c.vel = [0.0; 3]; c.ang = [0.0; 3]; } let (_, _, b, _) = correr(&mut fis, &m, &mut ag, id, 1.0 / 60.0); bur += b; }
        let ll_suelta = ag.lleno(id).unwrap(); fis.despertar(id);
        let mut t_fondo = None;
        for k in 0..20 { let (y, _, b, _) = correr(&mut fis, &m, &mut ag, id, 0.5); bur += b; if y < -1.8 && t_fondo.is_none() { t_fondo = Some(0.5 * (k + 1) as f64); } }
        let (y, ll, _, _) = correr(&mut fis, &m, &mut ag, id, 0.1);
        eprintln!("botella sumergida 3 s: llena {:.0} % al soltarla, {:.0} % al final, burbujas {bur}, llegó al fondo a los {:?} s (centro {y:.2}, fondo −2)", ll_suelta * 100.0, ll * 100.0, t_fondo);
        assert!(ll > 0.9 && y < -1.8 && bur > 10);
        // 3) el balde boca abajo: el aire queda atrapado y flota
        let (m, mut ag) = pileta(); let mut fis = Fisica::nueva(); let id = poner(&mut fis, &mut ag, &balde, [0.0, 0.2, 0.0], boca_abajo);
        let (y, ll, bu, _) = correr(&mut fis, &m, &mut ag, id, 8.0);
        eprintln!("balde boca abajo: centro {y:.3} lleno {:.0} % burbujas {bu}", ll * 100.0);
        assert!(y > -0.3 && ll < 0.1);
        // 4) el balde boca arriba lleno, afuera del agua, se da vuelta: se vacía en litros de agua de partículas
        let (_, mut ag) = pileta(); let piso = Mundo::nuevo(vec![-3.0, 2.0, -3.0, 3.0, 2.0, -3.0, 3.0, 2.0, 3.0, -3.0, 2.0, -3.0, 3.0, 2.0, 3.0, -3.0, 2.0, 3.0], vec![], 1.0);
        let mut fis = Fisica::nueva(); let id = poner(&mut fis, &mut ag, &balde, [0.0, 2.17, 0.0], parado);
        ag.llenar(id, 1.0); let cap = ag.cuerpos[&id].hueco.as_ref().unwrap().v_cav;
        let (_, ll0, _, l0) = correr(&mut fis, &piso, &mut ag, id, 1.0);
        let q = fis.cuerpo(id).unwrap().q; fis.poner(id, [0.0, 2.6, 0.0], qmul(boca_abajo, q));
        let (_, ll, _, lit) = correr(&mut fis, &piso, &mut ag, id, 4.0);
        eprintln!("balde lleno parado: {:.0} % (salieron {l0} L) → dado vuelta: {:.0} %, salieron {lit} L de {:.1} L", ll0 * 100.0, ll * 100.0, cap * 1000.0);
        assert!(ll0 > 0.95 && l0 == 0 && ll < 0.05 && lit as f64 >= cap * 1000.0 * 0.9);
    }
}
