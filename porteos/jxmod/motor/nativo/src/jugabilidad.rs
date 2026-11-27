//! La jugabilidad que faltaba de la web, como hijo de comun.rs (usa el juego por dentro): la destrucción de los autos
//! (destruccion.js: des_juego.rs), las nucleares y los artefactos (nucleares.js, nuclear_vol.js, artefactos.js:
//! nuk_juego.rs), los mods nativos (nativos.js: volar, muñeco de trapo y SCP, nat_juego.rs), el Cíclope (ciclope.js:
//! cic_juego.rs), Pepe (pepe_vuelve.js: pepe_juego.rs) y acá lo chico: la patada (patadas.js), la linterna (linterna.js),
//! la cámara libre (camlibre.js: L vuela la cámara, R la de Roblox), el menú MOD de arriba (modmenu.js, lo de los mods
//! nativos) y las Opciones de Props (ui.js: volar, muñeco, SCP y Cíclope se prenden ahí). Todo lo que guarda va en
//! `Jugabilidad` (el campo `jg` del juego); las líneas que lo enganchan a comun.rs están en integrar_jugabilidad.py.
use super::*;
use jxjuego::jugador::Entrada;
use jxmotor::escena::{ItemDin, LuzP, Mat, Malla, FL_SIN_SOMBRA};

#[path = "des_juego.rs"] pub mod des_juego;
#[path = "nuk_juego.rs"] pub mod nuk_juego;
#[path = "nat_juego.rs"] pub mod nat_juego;
#[path = "cic_juego.rs"] pub mod cic_juego;
#[path = "pepe_juego.rs"] pub mod pepe_juego;
#[path = "ent_juego.rs"] pub mod ent_juego;
#[path = "agua_juego.rs"] pub mod agua_juego;
pub use nat_juego::{estado, pose_jugador};
/// los ajustes del Mundo en el menú de objetos (Props → Mundo): el ítem, su nombre y su ícono (propios, iconos.rs)
pub const MUNDO: [(&str, &str, &str); 9] = [("mundo:hora:6.5", "Amanecer", "ico_amanecer"), ("mundo:hora:9", "Mañana", "ico_manana"), ("mundo:hora:12", "Mediodía", "ico_dia"),
    ("mundo:hora:15.5", "Tarde", "ico_tarde"), ("mundo:hora:17.5", "Atardecer", "ico_atardecer"), ("mundo:hora:0", "Noche", "ico_noche"),
    ("mundo:mas", "+1 hora", "ico_hora_mas"), ("mundo:menos", "-1 hora", "ico_hora_menos"), ("mundo:ciclo", "Día y noche", "ico_ciclo")];

// ---------------- números propios del motor (lejos de los del paquete y de los de gmod_juego: -5 000 000…) ----------------
pub const ID_JG: i64 = -8_000_000;
/// un cubo de lado 1 centrado (dibujarCaja de la web): lentes, rayos, ojos
pub const CAJA: i64 = ID_JG - 1;
pub const MAT_MARCO: i64 = ID_JG - 10;
/// los de brillo variable van de a 4 niveles (mat_nivel): lentes, ojos, el núcleo del rayo y las dos capas del haz
pub const MAT_LENTE: i64 = ID_JG - 20; pub const MAT_OJO: i64 = ID_JG - 30; pub const MAT_NUCLEO: i64 = ID_JG - 40; pub const MAT_HAZ: i64 = ID_JG - 50; pub const MAT_HAZ2: i64 = ID_JG - 60;
/// la textura de los retratos del panel de la bomba de Rick Prime
pub const TEX_OMEGA: i64 = ID_JG - 100;
/// las mallas de las copias abolladas: ID_DES − 4096·lugar − nodo
pub const ID_DES: i64 = ID_JG - 100_000;

// ---------------- cuentas ----------------
pub type V = [f32; 3];
pub type Q = [f32; 4];
#[inline] pub fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
#[inline] pub fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
#[inline] pub fn esc(a: V, k: f32) -> V { [a[0] * k, a[1] * k, a[2] * k] }
#[inline] pub fn dot(a: V, b: V) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
#[inline] pub fn cruz(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
#[inline] pub fn largo(a: V) -> f32 { dot(a, a).sqrt() }
#[inline] pub fn dist(a: V, b: V) -> f32 { largo(sub(a, b)) }
pub fn norm(a: V) -> V { let l = largo(a); if l > 1e-9 { esc(a, 1.0 / l) } else { a } }
pub fn mezcla(a: V, b: V, k: f32) -> V { [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k] }
#[inline] pub fn ss(a: f32, b: f32, x: f32) -> f32 { let t = ((x - a) / (b - a)).clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) }
pub fn v32(v: [f64; 3]) -> V { [v[0] as f32, v[1] as f32, v[2] as f32] }
pub fn v64(v: V) -> [f64; 3] { [v[0] as f64, v[1] as f64, v[2] as f64] }
pub fn qeje(e: V, a: f32) -> Q { let n = norm(e); let s = (a / 2.0).sin(); [n[0] * s, n[1] * s, n[2] * s, (a / 2.0).cos()] }
pub fn qmul(a: Q, b: Q) -> Q { [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]] }
pub fn qconj(q: Q) -> Q { [-q[0], -q[1], -q[2], q[3]] }
pub fn qnorm(q: Q) -> Q { let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt().max(1e-12); [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }
pub fn qrot(q: Q, v: V) -> V { let u = [q[0], q[1], q[2]]; let t = esc(cruz(u, v), 2.0); add(add(v, esc(t, q[3])), cruz(u, t)) }
/// el giro que lleva `a` a `b` (rotEntre)
pub fn rot_entre(a: V, b: V) -> Q {
    let (a, b) = (norm(a), norm(b)); let d = dot(a, b);
    if d < -0.999999 { let mut e = cruz([1.0, 0.0, 0.0], a); if largo(e) < 1e-6 { e = cruz([0.0, 1.0, 0.0], a); } return qeje(e, std::f32::consts::PI); }
    let c = cruz(a, b); qnorm([c[0], c[1], c[2], 1.0 + d])
}
/// el giro de una matriz (sin su escala)
pub fn m4quat(m: &M4) -> Q {
    let c = |o: usize| norm([m[o], m[o + 1], m[o + 2]]); let (x, y, z) = (c(0), c(4), c(8));
    let (m00, m11, m22) = (x[0], y[1], z[2]); let tr = m00 + m11 + m22;
    let q = if tr > 0.0 { let s = (tr + 1.0).sqrt() * 2.0; [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, 0.25 * s] }
        else if m00 > m11 && m00 > m22 { let s = (1.0 + m00 - m11 - m22).sqrt() * 2.0; [0.25 * s, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s] }
        else if m11 > m22 { let s = (1.0 + m11 - m00 - m22).sqrt() * 2.0; [(y[0] + x[1]) / s, 0.25 * s, (z[1] + y[2]) / s, (z[0] - x[2]) / s] }
        else { let s = (1.0 + m22 - m00 - m11).sqrt() * 2.0; [(z[0] + x[2]) / s, (z[1] + y[2]) / s, 0.25 * s, (x[1] - y[0]) / s] };
    qnorm(q)
}
/// qBase: el giro de una base (sus columnas)
pub fn q_base(x: V, y: V, z: V) -> Q { let mut m = m4::id(); m[0..3].copy_from_slice(&x); m[4..7].copy_from_slice(&y); m[8..11].copy_from_slice(&z); m4quat(&m) }
pub fn pt(m: &M4, p: V) -> V { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
pub fn pos_de(m: &M4) -> V { [m[12], m[13], m[14]] }
/// adelante con un giro y una inclinación (la de la nativa: positiva para arriba)
pub fn mira_de(yaw: f32, pitch: f32) -> V { [yaw.sin() * pitch.cos(), pitch.sin(), yaw.cos() * pitch.cos()] }
pub fn ang_dif(a: f32) -> f32 { let t = std::f32::consts::TAU; ((a + std::f32::consts::PI) % t + t) % t - std::f32::consts::PI }

// ---------------- las poses (huesoApuntar, girarMundo, ik2 de nativos.js), en el espacio del personaje ----------------
/// gira el nodo `i` en el mundo del personaje alrededor de `eje` (girarMundo)
pub fn girar_mundo(pj: &mut Personaje, i: Option<usize>, eje: V, ang: f32) {
    let Some(i) = i else { return }; pj.rehacer_matrices();
    let qw = qmul(qeje(eje, ang), m4quat(&pj.mundo(i))); let pa = pj.padre(i);
    let qp = if pa >= 0 { m4quat(&pj.mundo(pa as usize)) } else { m4quat(&pj.raiz()) };
    pj.poner_giro(i, qnorm(qmul(qconj(qp), qw)));
}
/// apunta el hueso `i` (hacia su hijo `j`) en la dirección `dir`, con peso `k` (huesoApuntar)
pub fn hueso_apuntar(pj: &mut Personaje, i: Option<usize>, j: Option<usize>, dir: V, k: f32) {
    let (Some(i), Some(j)) = (i, j) else { return }; if k <= 0.001 { return; }
    pj.rehacer_matrices(); let cur = sub(pos_de(&pj.mundo(j)), pos_de(&pj.mundo(i))); if largo(cur) < 1e-5 { return; } let cur = norm(cur);
    let des = add(esc(cur, 1.0 - k), esc(dir, k)); if largo(des) < 1e-5 { return; } let des = norm(des);
    let qw = qmul(rot_entre(cur, des), m4quat(&pj.mundo(i))); let pa = pj.padre(i);
    let qp = if pa >= 0 { m4quat(&pj.mundo(pa as usize)) } else { m4quat(&pj.raiz()) };
    pj.poner_giro(i, qnorm(qmul(qconj(qp), qw)));
}
/// dos huesos hasta el punto `t`, el codo o la rodilla hacia `polo` y la punta con el giro `q_fin` (ik2)
pub fn ik2(pj: &mut Personaje, iu: Option<usize>, ik: Option<usize>, ia: Option<usize>, t: V, polo: V, q_fin: Option<Q>) {
    let (Some(iu), Some(ik), Some(ia)) = (iu, ik, ia) else { return }; pj.rehacer_matrices();
    let (hp, kp, ap) = (pos_de(&pj.mundo(iu)), pos_de(&pj.mundo(ik)), pos_de(&pj.mundo(ia))); let (a, b) = (dist(kp, hp), dist(ap, kp));
    let d = dist(t, hp).clamp((a - b).abs() + 1e-3, a + b - 1e-3); let dir = norm(sub(t, hp));
    let x = (a * a - b * b + d * d) / (2.0 * d); let hh = (a * a - x * x).max(0.0).sqrt();
    let mut pl = sub(polo, esc(dir, dot(polo, dir))); if largo(pl) < 1e-5 { pl = sub(kp, hp); } let pl = norm(pl);
    let kn = add(hp, add(esc(dir, x), esc(pl, hh))); let tn = add(hp, esc(dir, d));
    let (qu, qk) = (m4quat(&pj.mundo(iu)), m4quat(&pj.mundo(ik))); let pa = pj.padre(iu);
    let qpu = if pa >= 0 { m4quat(&pj.mundo(pa as usize)) } else { m4quat(&pj.raiz()) };
    let r1 = rot_entre(sub(kp, hp), sub(kn, hp)); let qun = qmul(r1, qu); let a2 = add(hp, qrot(r1, sub(ap, hp)));
    let qkn = qmul(qmul(rot_entre(sub(a2, kn), sub(tn, kn)), r1), qk);
    pj.poner_giro(iu, qnorm(qmul(qconj(qpu), qun))); pj.poner_giro(ik, qnorm(qmul(qconj(qun), qkn)));
    if let Some(qf) = q_fin { pj.poner_giro(ia, qnorm(qmul(qconj(qkn), qf))); }
}
/// del mundo al espacio del personaje dibujado con `base` (personaje::base: el piso y el giro)
pub fn al_pj(base: &M4, p: V) -> V { let d = sub(p, pos_de(base)); [base[0] * d[0] + base[1] * d[1] + base[2] * d[2], base[4] * d[0] + base[5] * d[1] + base[6] * d[2], base[8] * d[0] + base[9] * d[1] + base[10] * d[2]] }
pub fn dir_al_pj(base: &M4, d: V) -> V { [base[0] * d[0] + base[1] * d[1] + base[2] * d[2], base[4] * d[0] + base[5] * d[1] + base[6] * d[2], base[8] * d[0] + base[9] * d[1] + base[10] * d[2]] }
pub fn dir_al_mundo(base: &M4, d: V) -> V { [base[0] * d[0] + base[4] * d[1] + base[8] * d[2], base[1] * d[0] + base[5] * d[1] + base[9] * d[2], base[2] * d[0] + base[6] * d[1] + base[10] * d[2]] }

// ---------------- los botones del HUD ----------------
/// los botones propios (Boton::Jg): el menú MOD, la linterna, la cámara libre con sus dos modos, la patada y el Cíclope
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Bj { Mod, Linterna, CamLibre, CamL, CamR, Patada, Ciclope, /** las teclas del arma de un mod (teclas_mod.rs) */ Tecla(u8) }

/// la patada (PAT de patadas.js): desde cuándo se puede de nuevo y si ya pegó
#[derive(Default)]
pub struct Pat { pub t: f32, pub pego: bool, pub activa: bool, pub escalas: Vec<(usize, V)> }
/// la cámara libre (CLIB): el menú desplegado, el modo ('L' o 'R'), la cámara y lo que pide la palanca
#[derive(Default)]
pub struct Clib { pub menu: bool, pub modo: Option<char>, pub pos: V, pub yaw: f32, pub pitch: f32, pub cam0: u8, pub mx: f32, pub my: f32, pub sube: f32, pub rapido: bool, pub yaw_ant: f32, pub pitch_ant: f32 }

/// todo lo de jugabilidad.rs
#[derive(Default)]
pub struct Jugabilidad {
    pub des: des_juego::Des, pub nuk: nuk_juego::Nuk, pub art: nuk_juego::Art, pub nat: nat_juego::Nat, pub cic: cic_juego::Cic, pub pv: pepe_juego::Pv,
    pub pat: Pat, pub clib: Clib,
    /// las entidades del mapa y de los mods (entidades.js: piano, mega rampa, botón de autos, teletransporte…)
    pub ents: ent_juego::Ents,
    /// el agua de partículas, los huecos y la manguera (agua_juego.rs)
    pub agua: agua_juego::Agua,
    /// la linterna prendida (LINT.on)
    pub lint: bool,
    /// las Opciones prendidas (los mods nativos de esta parte: volar, ragdoll, scp, ciclope)
    pub mods: Vec<&'static str>,
    /// el panel del menú MOD, el de la bomba de Rick Prime (y su lista) y lo bajado de la lista
    pub panel_mod: bool, pub scroll: f32,
    /// el reloj del juego (TIEMPO.t) y lo que dura este cuadro
    pub t: f32, pub dt: f32,
    /// la cámara que manda (la libre, la cinemática del Cíclope, el screamer): dónde y hacia dónde
    pub cam: Option<(V, V)>, pub cam_ult: V, pub mira_ult: V,
    /// lo que hace Usar mirando algo de acá (Armar, Disparar, Elegir)
    pub usar_txt: Option<&'static str>,
    /// lo cargado en el motor (el cubo y los materiales), las Opciones ya en el menú y los nombres de las nucleares
    pub listo: bool, nombres: HashMap<String, String>,
    /// la entrada del cuadro tal cual (antes de que la cámara libre o un mod la cambien)
    pub ent: Entrada,
    /// el skin puesto por el Cíclope (y el que había antes)
    pub skin_pedido: Option<String>, pub skin_antes: Option<String>,
}
impl Jugabilidad {
    /// algún panel propio abierto (toma los toques)
    pub fn panel(&self) -> bool { self.panel_mod || self.art.panel.is_some() }
    /// con el panel abierto, arrastrar baja la lista
    pub fn mover(&mut self, dy: f32) { self.scroll = (self.scroll - dy).max(0.0); }
    /// el jugador lo mueve un mod (volar, muñeco, SCP): no corre el paso de jugador.rs
    pub fn mueve_jugador(&self) -> bool { self.nat.volando || self.nat.rag.is_some() || self.nat.scp }
    /// no se dibuja el cuerpo del jugador (tirado como muñeco: se ve el muñeco)
    pub fn sin_cuerpo(&self) -> bool { self.nat.rag.is_some() }
    /// se ve el cuerpo aunque esté en primera persona (pateando: la pierna)
    pub fn cuerpo_en_primera(&self) -> bool { self.pat.activa }
    /// sin botones (el screamer de Pepe)
    pub fn sin_hud(&self) -> bool { self.pv.grita() }
    /// no lo lastima nada (en la definitiva del Cíclope: CIC.inmune)
    pub fn inmune(&self) -> bool { self.cic.mia() }
    /// el nombre de una cosa del menú (las nucleares con su nombre de verdad; las Opciones)
    pub fn nombre_item<'a>(&'a self, it: &'a str) -> &'a str {
        if let Some(m) = MUNDO.iter().find(|m| m.0 == it) { return m.1; }
        if let Some(a) = agua_juego::ITEMS.iter().find(|a| a.0 == it) { return a.1; }
        match it { "opc:piano" => "Piano gigante", "opc:volar" => "Volar", "opc:ragdoll" => "Muñeco de trapo", "opc:scp" => "SCP en cuatro patas", "opc:ciclope" => "Cíclope", _ => self.nombres.get(it).map(|s| s.as_str()).unwrap_or(it) }
    }
    pub fn activo(&self, k: &str) -> bool { self.mods.contains(&k) }
}

impl Juego {
    // ---------------- lo que se carga una vez ----------------
    /// el cubo y los materiales propios; las Opciones al principio de Props; los nombres de las nucleares
    unsafe fn jg_preparar(&mut self, m: &mut Motor3d) {
        if self.jg.listo { return; }
        self.jg.listo = true;
        // (un cubo de lado 1 centrado: 24 vértices con su normal por cara)
        let mut vb: Vec<u8> = vec![]; let mut ib: Vec<u8> = vec![]; let q = |x: f32| (((x + 0.5).clamp(0.0, 1.0)) * 65535.0).round() as u16;
        let caras: [(V, V, V); 6] = [([1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]), ([-1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, -1.0]), ([0.0, 1.0, 0.0], [0.0, 0.0, 1.0], [1.0, 0.0, 0.0]), ([0.0, -1.0, 0.0], [0.0, 0.0, -1.0], [1.0, 0.0, 0.0]), ([0.0, 0.0, 1.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]), ([0.0, 0.0, -1.0], [-1.0, 0.0, 0.0], [0.0, 1.0, 0.0])];
        for (k, (n, u, w)) in caras.iter().enumerate() {
            for (a, b) in [(-1.0f32, -1.0f32), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)] {
                let p = add(esc(*n, 0.5), add(esc(*u, a * 0.5), esc(*w, b * 0.5)));
                for c in p { vb.extend_from_slice(&q(c).to_le_bytes()); }
                vb.extend_from_slice(&[(n[0] * 127.0) as i8 as u8, (n[1] * 127.0) as i8 as u8, (n[2] * 127.0) as i8 as u8, 127, 0, 0, 0, 0]);
            }
            let o = (k * 4) as u16; let (c, d) = if dot(cruz(*u, *w), *n) > 0.0 { ([0u16, 1, 2], [0u16, 2, 3]) } else { ([0u16, 2, 1], [0u16, 3, 2]) };
            for i in c.iter().chain(d.iter()) { ib.extend_from_slice(&(o + i).to_le_bytes()); }
        }
        let mut datos = vb; let io = datos.len(); datos.extend_from_slice(&ib);
        let malla = Malla { id: CAJA, v: 24, mn: [-0.5; 3], sc: [1.0; 3], i32: 0, ni: 36, vo: 0, io, lo: -1, so: -1, lm: -1 };
        let mat = |id: i64, c: [f32; 4], pbr: [f32; 3], em: [f32; 3], unlit: u8, add: u8, blend: u8| Mat { ti: [0.0; 12], pbr, fol: 0, id, t2: -1, terr: None, c, st: [1.0, 1.0, 0.0, 0.0], t: -1, blend, cut: 0, unlit, add, agua: 0, em };
        // (los de ciclope.js: marco, lentes rubí, los ojos que brillan, el núcleo blanco del rayo y el haz rojo que suma luz)
        let mut mats = vec![mat(MAT_MARCO, [0.06, 0.06, 0.07, 1.0], [0.3, 0.8, 0.05], [0.0; 3], 0, 0, 0)];
        for (j, f) in [0.1f32, 0.4, 0.7, 1.0].into_iter().enumerate() { let j = j as i64; let b = 3.9 * f;
            mats.push(mat(MAT_LENTE - j, [0.45, 0.02, 0.03, 1.0], [0.08, 0.2, 0.06], [1.4 * b, 0.08 * b, 0.06 * b], 0, 0, 0));
            mats.push(mat(MAT_OJO - j, [1.0, 0.4, 0.35, 1.0], [0.5, 0.0, 0.04], [3.6 * f, 0.35 * f, 0.22 * f], 1, 0, 0));
            mats.push(mat(MAT_NUCLEO - j, [1.0, 0.86, 0.82, 1.0], [0.5, 0.0, 0.04], [9.0 * f, 3.0 * f, 2.6 * f], 1, 0, 0));
            mats.push(mat(MAT_HAZ - j, [1.0, 0.16, 0.08, 0.32 * f], [0.5, 0.0, 0.04], [0.0; 3], 1, 1, 1));
            mats.push(mat(MAT_HAZ2 - j, [1.0, 0.07, 0.04, 0.09 * f], [0.5, 0.0, 0.04], [0.0; 3], 1, 1, 1)); }
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![malla], mats, texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
        let _ = m.cargar(&Escena { c: cab, datos });
        // (las Opciones de JXMod, primeras en Props: ui.js, spawnSubs; las de los mods nativos de esta parte)
        if !self.catalogo.iter().any(|c| c.0 == "Opciones") { self.catalogo.insert(0, ("Opciones".into(), ["opc:volar", "opc:ragdoll", "opc:scp", "opc:ciclope", "opc:piano"].iter().map(|s| s.to_string()).collect())); }
        // (el agua de partículas: un balde, un montón, una canilla, la manguera y secar)
        // (la categoría Agua de los props ya existe —cubeta, tina, bañeras—: las opciones del agua van primero, y la categoría,
        // al lado de Opciones)
        { let mut its: Vec<String> = agua_juego::ITEMS.iter().map(|a| a.0.to_string()).collect();
          if let Some(i) = self.catalogo.iter().position(|c| c.0 == "Agua") { let (_, viejos) = self.catalogo.remove(i); for v in viejos { if !its.contains(&v) { its.push(v); } } }
          let k = self.catalogo.iter().position(|c| c.0 == "Opciones").map_or(0, |i| i + 1);
          self.catalogo.insert(k, ("Agua".into(), its)); }
        // (los ajustes del mundo: la hora del día —tocar una la pone ya— y el ciclo de día y noche)
        if !self.catalogo.iter().any(|c| c.0 == "Mundo") { let k = self.catalogo.iter().position(|c| c.0 == "Opciones").map_or(0, |i| i + 1);
            self.catalogo.insert(k, ("Mundo".into(), MUNDO.iter().map(|m| m.0.to_string()).collect())); }
        if let Some(paq) = &self.paq { if let Some(pf) = paq.d["pf"].as_object() { for (k, a) in pf { if let Some(b) = jxjuego::nucleares::Bomba::de(&a[0]) { self.jg.nombres.insert(k.split('#').next().unwrap_or(k).to_string(), b.n.clone()); } } } }
    }

    // ---------------- cada cuadro ----------------
    /// la entrada de este cuadro: la cámara libre la toma (L: la palanca mueve la cámara; R: el personaje camina hacia la
    /// palanca) y algunos estados la anulan (de rodillas en la definitiva del Cíclope, el screamer)
    pub(super) fn jg_entrada(&mut self, mut ent: Entrada, _dt: f32) -> Entrada {
        self.jg.ent = ent;
        if self.mapa.is_none() { return ent; }
        self.clib_vigente();
        if let Some(modo) = self.jg.clib.modo.filter(|_| self.vehs.jugador.is_none()) {
            // (mirar con el dedo gira la cámara libre, no al personaje: clibMirar)
            let c = &mut self.jg.clib; let (dy, dp) = (self.jug.yaw - c.yaw_ant, self.jug.pitch - c.pitch_ant);
            c.yaw += dy; c.pitch = (c.pitch + dp).clamp(-1.4, if modo == 'R' { 0.6 } else { 1.55 }); self.jug.yaw = c.yaw_ant; self.jug.pitch = c.pitch_ant;
            if modo == 'L' { c.mx = ent.x; c.my = ent.y; c.sube = (ent.saltar as i32 - ent.agachar as i32) as f32; c.rapido = ent.correr; ent = Entrada::default(); }
            else { let m = ent.x.hypot(ent.y).min(1.0); if m > 0.05 { let meta = c.yaw + (-ent.x).atan2(ent.y); let d = ang_dif(meta - self.jug.yaw); self.jug.yaw += d * 0.3; ent.y = m; ent.x = 0.0; } }
            self.jg.clib.yaw_ant = self.jug.yaw; self.jg.clib.pitch_ant = self.jug.pitch;
        }
        if self.cic_quieto() || self.jg.pv.bloquea() { ent.x = 0.0; ent.y = 0.0; ent.saltar = false; }
        ent
    }
    /// todo lo de acá en este cuadro (antes de la cámara): los choques de los autos, las nucleares, los artefactos, la
    /// patada, la linterna, la cámara libre, los mods nativos, el Cíclope y Pepe
    pub(super) unsafe fn jg_cuadro(&mut self, m: &mut Motor3d, dt: f32) {
        if self.mapa.is_none() { return; }
        self.jg_preparar(m);
        // (el agua de Source del mapa: la textura de Valve y su material)
        self.agua_src_paso(m);
        let dt = if self.ajustes.is_some() { 0.0 } else { dt };
        self.jg.t += dt; self.jg.dt = dt; self.jg.cam = None;
        self.des_paso(m, dt);
        self.ent_cuadro(m, dt);
        self.nuk_paso(m, dt); self.art_paso(m, dt);
        if self.jg.lint && self.jug.vida <= 0.0 { self.jg.lint = false; }
        self.pat_paso();
        self.nat_paso(m, dt);
        self.cic_paso(m, dt);
        self.pv_paso(m, dt);
        self.clib_camara(dt);
        self.jg_skin(m);
        self.jg.usar_txt = self.mirado_txt();
    }
    /// el skin del jugador que pide una Opción (el Cíclope: smEfectos.skin) o que vuelva el de antes
    unsafe fn jg_skin(&mut self, m: &mut Motor3d) {
        let quiero = if self.jg.activo("ciclope") { Some("Ciclope".to_string()) } else { None };
        if quiero == self.jg.skin_pedido { return; }
        let antes = self.jg.skin_pedido.take(); self.jg.skin_pedido = quiero.clone();
        if antes.is_none() && self.jg.skin_antes.is_none() { self.jg.skin_antes = Some(self.skin.clone()); }
        let skin = quiero.or_else(|| self.jg.skin_antes.take()).unwrap_or_else(|| self.skin.clone());
        let Some(paq) = self.paq.as_mut() else { return };
        if let Ok((mut pj, e)) = personaje::Personaje::cargar(paq, &skin, 0, 512, &mut self.pj_cargados) {
            if let Some((a, b)) = &self.nado { let _ = pj.nado(a, b); }
            if m.cargar(&e).is_ok() { self.pj = Some(pj); }
        }
    }

    // ---------------- los botones ----------------
    pub(super) fn jg_visible(&self, b: Bj) -> bool {
        let pie = self.vehs.jugador.is_none();
        match b {
            Bj::Mod => self.mapa.is_some(),
            Bj::Linterna | Bj::CamLibre => self.mapa.is_some(),
            Bj::CamL | Bj::CamR => self.jg.clib.menu,
            Bj::Patada => pie && self.mapa.is_some(),
            Bj::Ciclope => self.jg.activo("ciclope") && pie,
            Bj::Tecla(i) => pie && self.gmod_arma_activa() && (i as usize) < self.gmod.teclas.len(),
        }
    }
    pub(super) fn jg_etiqueta(&self, b: Bj) -> (&'static str, bool) {
        match b {
            Bj::Mod => ("MOD", self.jg.panel_mod),
            Bj::Linterna => ("Linterna", self.jg.lint),
            Bj::CamLibre => ("Cám. libre", self.jg.clib.menu),
            Bj::CamL => ("L", self.jg.clib.modo == Some('L')),
            Bj::CamR => ("R", self.jg.clib.modo == Some('R')),
            Bj::Patada => ("Patada", self.jg.pat.activa),
            Bj::Ciclope => ("Cíclope", self.jg.cic.apretado || self.jg.cic.mia()),
            Bj::Tecla(i) => ("", self.apretado(super::Boton::Jg(Bj::Tecla(i)))),
        }
    }
    pub(super) fn jg_boton(&mut self, b: Bj) {
        match b {
            Bj::Mod => { self.jg.panel_mod = !self.jg.panel_mod; self.jg.scroll = 0.0; }
            Bj::Linterna => self.linterna(None),
            Bj::CamLibre => { self.jg.clib.menu = !self.jg.clib.menu; if !self.jg.clib.menu { self.clib_elegir(None); } }
            Bj::CamL => self.clib_elegir(Some('L')),
            Bj::CamR => self.clib_elegir(Some('R')),
            Bj::Patada => self.patear(),
            Bj::Ciclope => self.cic_apretar(true),
            // (se aprietan mientras se tocan: teclas_mod_apretadas)
            Bj::Tecla(_) => {}
        }
    }
    /// Usar (la E) mirando una nuclear (la arma), la catapulta (la dispara) o la bomba de Rick Prime (elegir a quién)
    pub(super) fn jg_usar(&mut self) -> bool {
        if self.vehs.jugador.is_some() { return false; }
        let Some(i) = self.mirado() else { return false };
        self.nuk_usar(i) || self.art_usar(i)
    }
    /// el objeto que se mira de cerca (a 4,5 m, como la pista de la E de herramientas.js)
    pub(super) fn mirado(&mut self) -> Option<usize> {
        let mp = self.mapa.as_ref()?; let (o, f) = (self.ojos_ult, self.mira());
        let g = self.fis.rayo(&mp.mundo, v64(o), v64(f), 4.5, &[])?; let c = g.cuerpo?;
        self.objs.iter().position(|x| x.cuerpo == Some(c))
    }
    fn mirado_txt(&mut self) -> Option<&'static str> {
        if self.vehs.jugador.is_some() { return None; }
        let i = self.mirado()?; let o = &self.objs[i];
        if self.nuk_bomba(&o.nombre).is_some() { return if self.jg.nuk.armadas.iter().any(|a| a.id == o.id) { None } else { Some("Armar") }; }
        match self.art_tipo(&o.nombre) { Some("catapulta") => Some("Disparar"), Some("omega") => Some("Elegir"), _ => None }
    }
    /// un ajuste del Mundo (menú de objetos → Props → Mundo): la hora, una hora más o menos, o el ciclo de día y noche; queda
    /// guardado en los ajustes
    fn mundo_poner(&mut self, k: &str) {
        match k {
            "ciclo" => { self.aj.ciclo = !self.aj.ciclo; self.avisar(if self.aj.ciclo { "Día y noche: el tiempo corre" } else { "Día y noche: la hora queda quieta" }.to_string()); }
            "mas" | "menos" => { let h = self.mj.dia.hora.rem_euclid(24.0); let n = ((h + if k == "mas" { 1.0 } else { -1.0 }).round()).rem_euclid(24.0); self.aj.hora = n; self.avisar(format!("Hora: {:02}:00", n as u32)); }
            _ => if let Some(h) = k.strip_prefix("hora:").and_then(|x| x.parse::<f32>().ok()) { self.aj.hora = h; self.avisar(format!("Hora: {:02}:{:02}", h as u32, ((h.fract()) * 60.0).round() as u32)); },
        }
        if let Some(d) = &self.datos { let _ = std::fs::write(d.join("ajustes.txt"), self.aj.texto()); }
    }
    /// poner algo del menú: las Opciones se prenden y apagan (ui.js: modAlternar)
    pub(super) fn jg_poner(&mut self, nombre: &str) -> bool {
        if let Some(k) = nombre.strip_prefix("mundo:") { self.mundo_poner(k); return true; }
        if let Some(k) = nombre.strip_prefix("agua:") { return self.agua_poner(k); }
        let Some(k) = nombre.strip_prefix("opc:") else { return false };
        // (el piano gigante: se pone delante —o se trae, si ya está—; entidadPonerMod)
        if k == "piano" { self.jg.ents.poner = Some("piano"); self.avisar("Piano: pisá las teclas (también con un auto o tirándoles cosas)".into()); return true; }
        let k: &'static str = match k { "volar" => "volar", "ragdoll" => "ragdoll", "scp" => "scp", "ciclope" => "ciclope", _ => return true };
        if let Some(i) = self.jg.mods.iter().position(|x| *x == k) {
            self.jg.mods.remove(i);
            // (natIniciar: lo que se apaga se corta)
            match k { "volar" if self.jg.nat.volando => self.nat_volar(false), "ragdoll" if self.jg.nat.rag.is_some() => self.nat_rag(false), "scp" if self.jg.nat.scp => self.nat_scp(false), "ciclope" => self.cic_fin(), _ => {} }
            self.avisar(format!("{}: apagado", self.jg.nombre_item(nombre)));
        } else {
            self.jg.mods.push(k); self.avisar(format!("{}: prendido (menú MOD)", self.jg.nombre_item(nombre)));
            if k == "scp" { self.nat_scp(true); }
            if k == "ciclope" { self.jg.cic.ayudo = false; }
        }
        true
    }

    // ---------------- la linterna (linterna.js) ----------------
    /// linternaAlternar: prende o apaga (sólo vivo)
    pub(super) fn linterna(&mut self, forzar: Option<bool>) {
        let nuevo = forzar.unwrap_or(!self.jg.lint); if nuevo == self.jg.lint { return; }
        if nuevo && self.jug.vida <= 0.0 { return; }
        self.jg.lint = nuevo; self.sonido.tocar("IT_linterna", 0.5, if nuevo { 1.05 } else { 0.9 }, None);
    }
    /// las luces especiales del cuadro (Cuadro.esp): la linterna (un cono de 30 m desde los ojos hacia donde mirás; con la
    /// cámara afuera, desde el personaje hacia su mira) y la del screamer de Pepe
    pub(super) fn jg_esp(&self, cam: V, mira: V) -> Vec<LuzP> {
        let mut v = vec![];
        if self.jg.lint && self.jug.vida > 0.0 && self.mapa.is_some() {
            let afuera = self.jg.cam.is_some(); let tercera = self.camara != 0 && !afuera;
            let f = if afuera { self.mira() } else { mira }; let f = norm(f);
            let der = norm(cruz(f, [0.0, 1.0, 0.0])); let der = esc(der, -1.0);
            let ojo = if tercera && self.pj.is_some() { add(self.jug.pos, [0.0, 0.62, 0.0]) } else if afuera { self.ojos_ult } else { cam };
            let mut o = add(add(ojo, esc(f, 0.15)), esc(der, 0.12)); o[1] -= 0.12;
            // (sin el mapa de sombra de la linterna —la nativa no lo tiene—, en primera persona la luz sale de los ojos)
            let p = if !afuera && !tercera { add(cam, esc(f, 0.02)) } else { o };
            v.push([p[0], p[1], p[2], 30.0, 6.8, 6.5, 5.9, 0.0, f[0], f[1], f[2], 0.42f32.cos()]);
        }
        if let Some(l) = self.pv_luz(cam) { v.push(l); }
        v
    }
    /// las luces puntuales de acá (los ojos y el rayo del Cíclope, la catapulta…): adelante, para que no las corte el tope;
    /// en OpenGL 2 (sin luces especiales) la linterna va como una luz donde pega
    pub(super) fn jg_luces(&self, luces: &mut Vec<LuzP>) {
        let mut mias = self.cic_luces(); mias.extend(self.ent_luces());
        if self.en_uso == Placa::Gl2 && self.jg.lint && self.jug.vida > 0.0 {
            if let Some(mp) = &self.mapa { let (o, f) = (self.jg.cam_ult, self.jg.mira_ult);
                let t = mp.mundo.rayo(o, f, 30.0).map(|g| g.t).unwrap_or(30.0); let p = add(o, esc(f, (t - 0.6).max(0.3)));
                let k = (1.0 - t / 30.0).max(0.15); mias.insert(0, [p[0], p[1], p[2], 3.0 + t * 0.35, 6.8 * k, 6.5 * k, 5.9 * k, 0.0, 0.0, -1.0, 0.0, -2.0]); }
        }
        for (k, l) in mias.into_iter().enumerate() { luces.insert(k, l); }
        luces.truncate(8);
    }

    // ---------------- la patada (patadas.js) ----------------
    /// patear: el tramo del golpe del clip Kick (0,64 s); a los 0,2 s empuja, lastima y tira lo que tiene adelante
    pub(super) fn patear(&mut self) {
        if self.jug.vida <= 0.0 || self.vehs.jugador.is_some() || self.jug.nada || self.jg.nat.rag.is_some() || (self.jg.pat.t > 0.0 && self.jg.t - self.jg.pat.t < 0.75) { return; }
        let (Some(pj), Some(paq)) = (self.pj.as_mut(), self.paq.as_ref()) else { return };
        let Some(c) = personaje::ClipEmote::de(&paq.d, "Patada") else { return };
        pj.emote(Some(&c)); self.emote = None;
        self.jg.pat.t = self.jg.t; self.jg.pat.pego = false; self.jg.pat.activa = true;
        let tono = 0.85 + self.azar() * 0.1; self.sonido.tocar("CB_Swing", 0.55, tono, None);
    }
    /// patadasPaso: el golpe en su momento (al estirar la pierna, a los 0,2 s)
    fn pat_paso(&mut self) {
        let u = self.jg.t - self.jg.pat.t;
        if self.jg.pat.activa && (u > (1.95 - 0.55) / 2.2 || !self.pj.as_ref().map_or(false, |p| p.en_emote())) { self.jg.pat.activa = false; }
        if !self.jg.pat.activa || self.jg.pat.pego || u < 0.2 { return; }
        self.jg.pat.pego = true;
        let tk = self.pj.as_ref().map(|p| p.tam).unwrap_or(1.0); let y = self.jug.yaw; let f = [y.sin(), 0.0, y.cos()];
        let pie = add(self.jug.pos, [f[0] * 0.85 * tk, -0.95 + 0.75 * tk, f[2] * 0.85 * tk]); let r = 0.75 * tk;
        let mut pego: Option<(V, bool)> = None;
        // los props: empujón hacia adelante y un poco arriba (como mucho 9 m/s; a lo liviano más)
        let ids: Vec<u32> = self.objs.iter().filter_map(|o| o.cuerpo).collect();
        for id in ids {
            let Some(b) = self.fis.cuerpo_mut(id) else { continue }; if b.sin_fisica || b.congelado { continue; }
            let bp = v32(b.pos); if dist(bp, pie) > r + b.r as f32 { continue; }
            let mut d = sub(bp, self.jug.pos); d[1] = 0.0; if dot(d, f) < 0.0 { continue; }
            let dv = (600.0 / (b.masa as f32).max(1.0)).min(9.0);
            b.despertar(); for e in 0..3 { b.vel[e] += (f[e] * dv) as f64; } b.vel[1] += (dv * 0.35) as f64;
            let ax = cruz([0.0, 1.0, 0.0], f); for e in 0..3 { b.ang[e] += (ax[e] * dv * 0.4) as f64; }
            if pego.is_none() { pego = Some((bp, false)); }
        }
        // la gente (NPC) y los muñecos tirados
        let gente: Vec<(u32, V, bool, f32, bool)> = self.npcs.lista.iter().map(|n| (n.id, n.pos(), n.rag.is_some(), n.tam as f32, n.vivo)).collect();
        for (id, p, rag, tam, vivo) in gente {
            let c = [p[0], p[1] - 0.95 + 0.9 * tam, p[2]]; let mut d = sub(c, self.jug.pos); d[1] = 0.0;
            if dist(c, pie) > r + 0.45 * tam || dot(d, f) < 0.0 { continue; }
            if rag { let cs: Vec<u32> = self.npcs.get(id).and_then(|n| n.rag.as_ref()).map(|r| r.cuerpos().collect()).unwrap_or_default();
                for cid in cs { if let Some(b) = self.fis.cuerpo_mut(cid) { b.despertar(); for e in 0..3 { b.vel[e] += (f[e] * 6.0) as f64; } b.vel[1] += 2.5; } } }
            else { self.npcs.danar(id, 20.0, c, f, &mut self.fis, Some(npc::Quien::Jugador)); if vivo { self.npcs.tumbar(id, [f[0] * 6.0, 3.0, f[2] * 6.0], &mut self.fis); } }
            pego = Some((c, true));
        }
        if let Some((p, carne)) = pego {
            let l: &[&str] = if carne { &["CB_Flesh1", "CB_Flesh2", "CB_Flesh3"] } else { &["CB_Impact1", "CB_Impact2"] };
            let s = l[(self.azar() * l.len() as f32) as usize % l.len()]; self.sonido.tocar(s, 0.85, 1.0, Some(p));
            self.ef.impacto(p, esc(f, -1.0), if carne { Sup::Cuerpo } else { Sup::Golpe }); self.temblor = self.temblor.max(0.12);
        }
    }

    // ---------------- la cámara libre (camlibre.js) ----------------
    /// clibElegir: el modo (tocar el activo, o None, vuelve a la cámara normal)
    pub(super) fn clib_elegir(&mut self, m: Option<char>) {
        let c = &mut self.jg.clib;
        if m.is_none() || c.modo == m { if c.modo.is_some() { self.camara = c.cam0; c.modo = None; } return; }
        if c.modo.is_none() { c.cam0 = self.camara; }
        c.modo = m; c.yaw = self.jug.yaw; c.pitch = if m == Some('R') { -0.3 } else { self.jug.pitch }; c.pos = self.jg.cam_ult;
        c.yaw_ant = self.jug.yaw; c.pitch_ant = self.jug.pitch;
        self.camara = 1;   // (el cuerpo propio se ve y no el arma de primera persona)
    }
    /// clibVigente: algo pasó a primera persona (el botón de la cámara): se suelta y la vista vuelve a los ojos, mirando
    /// hacia donde miraba la cámara libre
    fn clib_vigente(&mut self) {
        let c = &mut self.jg.clib; let Some(modo) = c.modo else { return };
        if self.camara != 0 { return; }
        self.jug.yaw = c.yaw; if modo == 'L' { self.jug.pitch = c.pitch.clamp(-1.5, 1.5); }
        c.modo = None;
    }
    /// clibCamara: L vuela hacia donde mira; R alrededor de la cabeza del personaje, sin atravesar paredes
    fn clib_camara(&mut self, dt: f32) {
        let Some(modo) = self.jg.clib.modo else { return }; if self.vehs.jugador.is_some() { return; }
        let c = &mut self.jg.clib; let f = mira_de(c.yaw, c.pitch);
        if modo == 'L' {
            let r = [-c.yaw.cos(), 0.0, c.yaw.sin()]; let v = (if c.rapido { 20.0 } else { 8.0 }) * dt;
            c.pos = add(add(add(c.pos, esc(f, c.my * v)), esc(r, c.mx * v)), [0.0, c.sube * v, 0.0]);
            self.jg.cam = Some((c.pos, f));
        } else {
            let centro = add(self.jug.pos, [0.0, 0.35, 0.0]); let d = 7.0; let dir = esc(f, -1.0);
            let t = self.mapa.as_ref().and_then(|mp| mp.mundo.rayo(centro, dir, d)).map(|g| (g.t - 0.3).max(0.6)).unwrap_or(d);
            c.pos = add(centro, esc(dir, t)); self.jg.cam = Some((c.pos, f));
        }
    }
    // ---------------- lo que se dibuja ----------------
    /// las cosas de acá: las ruedas sueltas, el brazo de la catapulta, los lentes y los rayos del Cíclope, Pepe
    pub(super) fn jg_items(&self, items: &mut Vec<ItemDin>, cam: V) {
        self.des_items(items); self.ent_items(items); self.art_items(items); self.cic_items(items, cam); self.pv_items(items); self.nat_items(items);
    }
    /// los carteles de las nucleares (bola de fuego, polvo y hongo), como bloques de partículas del motor
    pub(super) fn jg_efectos(&self, ef: &mut Vec<(u32, Vec<f32>)>, vp: &M4, cam: V) { self.nuk_bloques(ef, vp, cam); }

    // ---------------- el HUD ----------------
    /// lo que tapa la pantalla (debajo de los botones): el destello de la nuclear, la radiación, el verde de la bomba de Rick
    /// Prime, el rojo del Cíclope y la cinta de Pepe
    pub(super) fn jg_hud_fondo(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32) {
        if self.mapa.is_none() { return; }
        self.ent_hud(l, u, wf, hf);
        self.pv_hud_fondo(l, u, wf, hf);
        self.cic_hud_fondo(l, u, wf, hf);
        let rad = self.jg.nuk.rad; if rad > 0.0 { borde(l, u, wf, hf, [90.0 / 255.0, 1.0, 60.0 / 255.0], rad * 0.55 * 0.55); }
        let f = self.jg.art.flash; if f > 0.0 { let cerca = self.jg.art.flash_p.map(|p| (1.0 - dist(p, self.jg.cam_ult) / 120.0).clamp(0.25, 1.0)).unwrap_or(1.0);
            l.caja(u, 0.0, 0.0, wf, hf, 0.0, [0.45, 1.0, 0.45, (f * cerca * 0.8).min(1.0)]); }
        let n = self.jg.nuk.flash; if n > 0.0 { l.caja(u, 0.0, 0.0, wf, hf, 0.0, [1.0, 1.0, 1.0, n.min(1.0)]); }
    }
    /// encima: el anillo de carga del Cíclope, las Opciones prendidas en el menú, los paneles (MOD y la bomba de Rick
    /// Prime) y el subtítulo de Pepe; devuelve las tandas con otras texturas (los retratos)
    pub(super) fn jg_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) -> Vec<(i64, Vec<f32>)> {
        let mut otras = vec![];
        if self.mapa.is_none() { return otras; }
        self.cic_hud(l, u, wf, hf, t);
        self.pv_hud(l, u, wf, hf, t);
        // (las Opciones en el menú de Props: el ícono y la luz de prendida —opcLuz—)
        if let (Some(mm), None) = (&self.menu, self.ini.rec.atlas.as_ref()) { if mm.pestana == 0 && self.catalogo.get(mm.sub).map_or(false, |c| c.0 == "Opciones") {
            let p = panel(wf, hf, self.catalogo.len());
            for (k, it) in self.catalogo[mm.sub].1.iter().enumerate() {
                let (col, fila) = (k % p.cols, k / p.cols); let (x, y) = (p.gx + col as f32 * p.celda, p.gy + fila as f32 * p.celda - mm.scroll);
                if y + p.celda < p.gy || y > p.gy + p.gh { continue; }
                let k2 = it.trim_start_matches("opc:"); let on = self.jg.activo(k2);
                let g = match k2 { "volar" => "✈", "ragdoll" => "☠", "scp" => "SCP", _ => "◉" };
                let tt = p.celda * if g.chars().count() > 1 { 0.18 } else { 0.32 }; let an = l.ancho(tt, g);
                l.texto(u, x + (p.celda - an) / 2.0, y + p.celda * 0.25, tt, if on { [0.55, 1.0, 0.5, 1.0] } else { [1.0, 1.0, 1.0, 0.8] }, g);
                l.disco(u, x + p.celda - p.celda * 0.14, y + p.celda * 0.14, p.celda * 0.05, if on { [0.35, 1.0, 0.35, 1.0] } else { [0.4, 0.4, 0.4, 0.8] });
            }
        } }
        // (el Agua en este menú —sin el kit Aero—: el nombre corto de cada opción del agua)
        if let (Some(mm), None) = (&self.menu, self.ini.rec.atlas.as_ref()) { if mm.pestana == 0 && self.catalogo.get(mm.sub).map_or(false, |c| c.0 == "Agua") {
            let p = panel(wf, hf, self.catalogo.len());
            for (k, it) in self.catalogo[mm.sub].1.iter().enumerate() {
                let Some(g) = it.strip_prefix("agua:").map(|x| match x { "balde" => "Balde", "pileta" => "Montón", "canilla" => "Canilla", "manguera" => "Manguera", _ => "Secar" }) else { continue };
                let (col, fila) = (k % p.cols, k / p.cols); let (x, y) = (p.gx + col as f32 * p.celda, p.gy + fila as f32 * p.celda - mm.scroll);
                if y + p.celda < p.gy || y > p.gy + p.gh { continue; }
                let on = it == "agua:manguera" && self.jg.agua.manguera;
                let tt = p.celda * 0.17; let an = l.ancho(tt, g);
                l.texto(u, x + (p.celda - an) / 2.0, y + p.celda * 0.3, tt, if on { [0.55, 1.0, 0.5, 1.0] } else { [0.6, 0.85, 1.0, 0.95] }, g);
            }
        } }
        // (el Mundo en este menú —sin el kit Aero—: la hora escrita y la luz de puesta)
        if let (Some(mm), None) = (&self.menu, self.ini.rec.atlas.as_ref()) { if mm.pestana == 0 && self.catalogo.get(mm.sub).map_or(false, |c| c.0 == "Mundo") {
            let p = panel(wf, hf, self.catalogo.len());
            for (k, it) in self.catalogo[mm.sub].1.iter().enumerate() {
                let (col, fila) = (k % p.cols, k / p.cols); let (x, y) = (p.gx + col as f32 * p.celda, p.gy + fila as f32 * p.celda - mm.scroll);
                if y + p.celda < p.gy || y > p.gy + p.gh { continue; }
                let on = if it == "mundo:ciclo" { self.aj.ciclo } else { it.strip_prefix("mundo:hora:").and_then(|x| x.parse::<f32>().ok()).map_or(false, |h| !self.aj.ciclo && (self.aj.hora - h).abs() < 0.01) };
                let g = match it.as_str() { "mundo:mas" => "+1 h".to_string(), "mundo:menos" => "-1 h".to_string(), "mundo:ciclo" => "Ciclo".to_string(),
                    _ => it.strip_prefix("mundo:hora:").and_then(|x| x.parse::<f32>().ok()).map_or(String::new(), |h| format!("{:02}:{:02}", h as u32, (h.fract() * 60.0) as u32)) };
                let tt = p.celda * 0.2; let an = l.ancho(tt, &g);
                l.texto(u, x + (p.celda - an) / 2.0, y + p.celda * 0.3, tt, if on { [0.55, 1.0, 0.5, 1.0] } else { [1.0, 1.0, 1.0, 0.85] }, &g);
                l.disco(u, x + p.celda - p.celda * 0.14, y + p.celda * 0.14, p.celda * 0.05, if on { [0.35, 1.0, 0.35, 1.0] } else { [0.4, 0.4, 0.4, 0.8] });
            }
        } }
        if self.jg.panel_mod { self.panel_mod(l, u, wf, hf, t); }
        if let Some(v) = self.art_panel(l, u, wf, hf, t) { otras.push(v); }
        otras
    }
    /// el menú MOD (modmenu.js): «Usar» con volar, muñeco y SCP (se prenden y apagan) y el Cíclope (cómo se usa)
    fn panel_mod(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) {
        let (x0, y0, pw, ph) = (wf * 0.04, hf * 0.15, wf * 0.46, hf * 0.68);
        l.caja(u, x0, y0, pw, ph, hf * 0.025, [0.07, 0.08, 0.11, 0.95]);
        l.texto(u, x0 + hf * 0.03, y0 + hf * 0.02, t * 1.1, [1.0, 1.0, 1.0, 1.0], "MOD");
        let an = l.ancho(t, "X"); l.texto(u, x0 + pw - hf * 0.05 - an / 2.0, y0 + hf * 0.02, t, [1.0, 1.0, 1.0, 1.0], "X");
        let mut y = y0 + hf * 0.1 - self.jg.scroll;
        l.texto(u, x0 + hf * 0.03, y, t * 0.75, [0.7, 0.75, 0.85, 1.0], "Usar"); y += t * 1.3;
        let filas = self.filas_mod();
        if filas.is_empty() { for r in partir(l, t * 0.7, "Prendé Volar, Muñeco de trapo, SCP en cuatro patas o Cíclope en Objetos → Props → Opciones y usalos desde acá.", pw - hf * 0.06) { l.texto(u, x0 + hf * 0.03, y, t * 0.7, [1.0, 1.0, 1.0, 0.8], &r); y += t * 0.95; } }
        for (k, nom, tecla, on, ayuda) in filas {
            let fh = hf * 0.085; l.caja(u, x0 + hf * 0.02, y, pw - hf * 0.04, fh, hf * 0.015, if on { [0.25, 0.45, 0.25, 0.9] } else { [1.0, 1.0, 1.0, 0.07] });
            l.texto(u, x0 + hf * 0.04, y + fh * 0.18, t * 0.8, [1.0; 4], &format!("{nom} ({tecla})"));
            if let Some(a) = ayuda { l.texto(u, x0 + hf * 0.04, y + fh * 0.58, t * 0.55, [1.0, 1.0, 1.0, 0.75], a); }
            else { let (sx, sy) = (x0 + pw - hf * 0.1, y + fh * 0.5); l.caja(u, sx - hf * 0.035, sy - hf * 0.018, hf * 0.07, hf * 0.036, hf * 0.018, if on { [0.3, 0.85, 0.35, 1.0] } else { [0.35, 0.35, 0.38, 1.0] }); l.disco(u, sx + if on { hf * 0.017 } else { -hf * 0.017 }, sy, hf * 0.015, [1.0; 4]); }
            let _ = k; y += fh + hf * 0.012;
        }
    }
    /// las filas del menú MOD: clave, nombre, tecla, prendido y la ayuda (el Cíclope no se prende acá)
    fn filas_mod(&self) -> Vec<(&'static str, &'static str, &'static str, bool, Option<&'static str>)> {
        let mut v = vec![];
        if self.jg.activo("volar") { v.push(("volar", "Volar", "G", self.jg.nat.volando, None)); }
        if self.jg.activo("ragdoll") { v.push(("ragdoll", "Muñeco de trapo", "X", self.jg.nat.rag.is_some(), None)); }
        if self.jg.activo("scp") { v.push(("scp", "SCP en cuatro patas", "J", self.jg.nat.scp, None)); }
        if self.jg.activo("ciclope") { v.push(("ciclope", "Cíclope", "H", false, Some("Tocá: láser · Mantené 1 s: definitiva"))); }
        v
    }
    /// un toque con un panel propio abierto
    pub(super) fn jg_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        if self.jg.art.panel.is_some() { self.art_toque(x, y, w, h); return; }
        let (x0, y0, pw, ph) = (w * 0.04, h * 0.15, w * 0.46, h * 0.68);
        if x < x0 || x > x0 + pw || y < y0 || y > y0 + ph || (x > x0 + pw - h * 0.1 && y < y0 + h * 0.08) { self.jg.panel_mod = false; return; }
        let t = h * 0.032; let mut yy = y0 + h * 0.1 - self.jg.scroll + t * 1.3;
        for (k, _, _, _, ayuda) in self.filas_mod() {
            let fh = h * 0.085;
            if y >= yy && y <= yy + fh && ayuda.is_none() { self.sonido.tocar("Click", 0.4, 1.0, None); self.nat_accion(k); return; }
            yy += fh + h * 0.012;
        }
    }

    // ---------------- al cambiar de mapa ----------------
    /// lo de un mundo no sigue en el otro (nukeLimpiar, desSoltar, natFin, cicFin, pvTerminar)
    pub(super) fn jg_limpiar(&mut self) {
        // (las Opciones siguen prendidas; el personaje del mapa nuevo es el de siempre: el del Cíclope se vuelve a pedir)
        let mods = std::mem::take(&mut self.jg.mods); let antes = self.jg.skin_antes.take();
        // (el mapa de la Comunidad que se pidió sigue: se arma sobre el mapa base nuevo)
        let pend = self.jg.ents.pend.take();
        self.jg = Jugabilidad { mods, skin_antes: antes, ..Jugabilidad::default() };
        self.jg.ents.pend = pend;
        self.jg.pv.nuevo_mapa = true;
    }
}

/// la cámara que manda este cuadro (la libre, la cinemática del Cíclope): se llama con la que calculó el juego; guarda la
/// última (para la linterna, la cámara libre y lo que mira la cámara)
pub fn camara(jg: &mut Jugabilidad, cam: V, mira: V) -> (V, V) { let r = jg.cam.unwrap_or((cam, mira)); jg.cam_ult = r.0; jg.mira_ult = norm(r.1); r }
/// la luz del cuadro con el ambiente rojo de la definitiva del Cíclope (cicCielo: el sol, el cielo, el suelo y la niebla)
pub fn luz(jg: &Jugabilidad, l: &mut jxmotor::escena::Luz) {
    let k = jg.cic.rojo; if k <= 0.0 { return; }
    let lin = |c: [f32; 3]| c.map(|x| x.max(0.0).powf(2.2)); let m = |a: [f32; 3], b: [f32; 3], k: f32| [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    l.sol_c = m(l.sol_c, esc(lin([1.25, 0.24, 0.1]), 2.6), k * 0.85); l.amb_s = m(l.amb_s, esc(lin([0.62, 0.12, 0.07]), 1.3), k * 0.8); l.amb_g = m(l.amb_g, esc(lin([0.34, 0.06, 0.035]), 1.3), k * 0.8);
    l.nie.c = m(l.nie.c, lin([0.5, 0.08, 0.04]), k * 0.75);
}
/// para las pruebas (examples/jugabilidad_foto.rs): órdenes sueltas con un lugar y un nombre; algunas devuelven un lugar
impl Juego {
    pub fn jg_prueba(&mut self, orden: &str, p: [f32; 3], n: &str) -> Option<[f32; 3]> {
        let obj = |j: &Juego| j.objs.iter().rposition(|o| o.nombre == n);
        match orden {
            "explotar" => self.nuk_explotar(p, n),
            "explosion" => self.explosion(p, 6.0, 100.0),
            "usar" => { let i = obj(self)?; if !self.nuk_usar(i) { self.art_usar(i); } }
            "opcion" => { self.jg_poner(&format!("opc:{n}")); }
            "accion" => self.nat_accion(n),
            "boton" => self.jg_boton(match n { "mod" => Bj::Mod, "linterna" => Bj::Linterna, "libre" => Bj::CamLibre, "L" => Bj::CamL, "R" => Bj::CamR, "patada" => Bj::Patada, _ => Bj::Ciclope }),
            "omega" => { let i = obj(self)?; let id = self.objs[i].id; let s = self.pj.as_ref().map(|p| p.skin.clone()).unwrap_or_default(); let s = if p[0] > 0.5 { s } else { "Engineer".into() }; self.art_omega_armar(id, &s); }
            "cuchara" => { let i = obj(self)?; let id = self.objs[i].id; return self.art_cuchara(id); }
            "brazo" => { let i = obj(self)?; let id = self.objs[i].id; return self.art_angulo(id).map(|a| [a, 0.0, 0.0]); }
            "camara" => return Some(self.jg.cam_ult),
            _ => {}
        }
        None
    }
    /// (para las pruebas) lo de los autos: cuerpo, nodos abollados, lo más hundido, lo hundido en total; ruedas sueltas
    pub fn jg_des_info(&self) -> (Vec<(u32, usize, f32, f32)>, usize) { self.des_info() }
    /// (para las pruebas) el destello y la radiación de las nucleares, cuántas siguen
    pub fn jg_nuk_info(&self) -> (f32, f32) { (self.jg.nuk.flash, self.jg.nuk.rad) }
}
/// el borde de la pantalla de un color (la radiación: transparente al medio, verde en los bordes)
pub fn borde(l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, c: [f32; 3], a: f32) {
    let n = 20; for k in 0..n { let f = k as f32 / n as f32; let aa = a * (1.0 - f).powi(2) * 0.2; let (dx, dy) = (wf * 0.3 * f, hf * 0.3 * f); let gx = wf * 0.3 / n as f32; let gy = hf * 0.3 / n as f32;
        l.caja(u, dx, dy, wf - dx * 2.0, gy, 0.0, [c[0], c[1], c[2], aa]); l.caja(u, dx, hf - dy - gy, wf - dx * 2.0, gy, 0.0, [c[0], c[1], c[2], aa]);
        l.caja(u, dx, dy + gy, gx, hf - 2.0 * dy - 2.0 * gy, 0.0, [c[0], c[1], c[2], aa]); l.caja(u, wf - dx - gx, dy + gy, gx, hf - 2.0 * dy - 2.0 * gy, 0.0, [c[0], c[1], c[2], aa]); }
}
/// un texto partido en renglones de hasta `ancho`
pub fn partir(l: &Letras, tt: f32, txt: &str, ancho: f32) -> Vec<String> {
    let mut v = vec![]; let mut r = String::new();
    for pal in txt.split(' ') { let p = if r.is_empty() { pal.to_string() } else { format!("{r} {pal}") }; if l.ancho(tt, &p) > ancho && !r.is_empty() { v.push(std::mem::replace(&mut r, pal.to_string())); } else { r = p; } }
    if !r.is_empty() { v.push(r); } v
}
/// una caja de lado `t` (x, y, z) girada `q` con centro en `c` (dibujarCaja)
pub fn caja(c: V, t: V, q: Q, mat: i64, out: &mut Vec<ItemDin>) {
    let (x, y, z) = (qrot(q, [t[0], 0.0, 0.0]), qrot(q, [0.0, t[1], 0.0]), qrot(q, [0.0, 0.0, t[2]]));
    let mm = [x[0], x[1], x[2], 0.0, y[0], y[1], y[2], 0.0, z[0], z[1], z[2], 0.0, c[0], c[1], c[2], 1.0];
    out.push(ItemDin { m: CAJA, s0: 0, sn: 36, mat, mm, esf: [c[0], c[1], c[2], largo(t) * 0.5 + 0.01], fl: FL_SIN_SOMBRA, h: vec![] });
}
