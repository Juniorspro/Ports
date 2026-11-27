//! Los mapas del Workshop: el .bsp de Source leído en Rust (gmod_bsp.js). Acá va lo que no depende de GMod ni del
//! motor: los lumps (con LZMA), las entidades, el zip de adentro, las caras del mundo y de las entidades de bloques
//! (puertas, paredes), los displacements (con la segunda textura de los terrenos), por material y en pedazos de 64 m, los
//! choques (esas caras, las del cielo, las invisibles y las brochas sin caras), el agua, el cielo 3D, la luz horneada (el
//! atlas), los props (los estáticos del game lump y los de entidades), las apariciones, el sol, el ambiente, la niebla,
//! los botones, las zonas, los caminos de los trenes, los sonidos y relevos (mapaio.js) y las puertas portal. Los
//! materiales, las texturas y los modelos los resuelve quien llama (nativo/mapas_juego.rs), con el contenido de GMod.
use std::collections::HashMap;

/// pulgadas de Source → metros del juego
pub const GM_S: f32 = 0.0254;
/// (m: cada pedazo de mundo es una malla aparte, con su propia caja y precisión)
pub const CELDA: f32 = 64.0;
const SURF_LIGHT: i32 = 0x1; const SURF_SKY2D: i32 = 0x2; const SURF_SKY: i32 = 0x4; const SURF_WARP: i32 = 0x8; const SURF_TRIGGER: i32 = 0x40; const SURF_NODRAW: i32 = 0x80;
const SURF_HINT: i32 = 0x100; const SURF_SKIP: i32 = 0x200; const SURF_NOLIGHT: i32 = 0x400; const SURF_BUMP: i32 = 0x800;
/// (sólido, ventana, reja, movible y playerclip: lo que frena a un jugador)
const BR_CHOCA: i32 = 0x1 | 0x2 | 0x8 | 0x4000 | 0x10000;

pub type V = [f32; 3];
/// Source (x adelante, y izquierda, z arriba, pulgadas) → el juego (gbspG)
#[inline] pub fn g(x: f32, y: f32, z: f32) -> V { [y * GM_S, z * GM_S, x * GM_S] }
#[inline] fn gv(p: V) -> V { g(p[0], p[1], p[2]) }

// ---------------- leer ----------------
#[inline] fn rd<const N: usize>(u: &[u8], o: usize) -> [u8; N] { u.get(o..o + N).map(|s| s.try_into().unwrap()).unwrap_or([0; N]) }
#[inline] fn i32a(u: &[u8], o: usize) -> i32 { i32::from_le_bytes(rd(u, o)) }
#[inline] fn u32a(u: &[u8], o: usize) -> u32 { u32::from_le_bytes(rd(u, o)) }
#[inline] fn u16a(u: &[u8], o: usize) -> u16 { u16::from_le_bytes(rd(u, o)) }
#[inline] fn i16a(u: &[u8], o: usize) -> i16 { i16::from_le_bytes(rd(u, o)) }
#[inline] fn f32a(u: &[u8], o: usize) -> f32 { f32::from_le_bytes(rd(u, o)) }
fn latin1(b: &[u8]) -> String { b.iter().map(|&c| c as char).collect() }
fn cad(u: &[u8], o: usize) -> String { let e = u[o.min(u.len())..].iter().position(|&c| c == 0).map(|k| o + k).unwrap_or(u.len()); latin1(&u[o.min(u.len())..e]) }

/// el decodificador de LZMA («alone»: 5 bytes de propiedades, 8 del tamaño y los datos)
pub type Lzma<'a> = &'a dyn Fn(&[u8]) -> Result<Vec<u8>, String>;
/// un lump comprimido: "LZMA", tamaño real, tamaño comprimido, 5 bytes de propiedades → al formato «alone» (gbspLzma)
pub fn deslzma(d: &[u8], lzma: Lzma) -> Option<Vec<u8>> {
    if !(d.len() > 17 && &d[0..4] == b"LZMA") { return None; }
    let (real, comp) = (u32a(d, 4) as usize, u32a(d, 8) as usize);
    let mut a = Vec::with_capacity(13 + comp); a.extend_from_slice(&d[12..17]); a.extend_from_slice(&(real as u32).to_le_bytes()); a.extend_from_slice(&[0; 4]);
    a.extend_from_slice(&d[17..(17 + comp).min(d.len())]);
    let mut o = lzma(&a).ok()?; o.truncate(real); Some(o)
}

/// el archivo abierto: los lumps (los comprimidos, ya descomprimidos)
pub struct Bsp<'a> { pub b: &'a [u8], pub ver: i32, lumps: Vec<std::borrow::Cow<'a, [u8]>>, lvers: Vec<i32> }
impl<'a> Bsp<'a> {
    pub fn abrir(b: &'a [u8], lzma: Lzma) -> Result<Bsp<'a>, String> {
        if u32a(b, 0) != 0x5053_4256 { return Err("no es un .bsp".into()); }
        let ver = i32a(b, 4);
        let mut lumps = vec![]; let mut lvers = vec![];
        for i in 0..64 {
            let (o, l) = (i32a(b, 8 + i * 16), i32a(b, 12 + i * 16)); lvers.push(i32a(b, 16 + i * 16));
            if l <= 0 || o < 0 || o as usize + l as usize > b.len() { lumps.push(std::borrow::Cow::Borrowed(&b[0..0])); continue; }
            let d = &b[o as usize..o as usize + l as usize];
            lumps.push(match deslzma(d, lzma) { Some(v) => std::borrow::Cow::Owned(v), None => std::borrow::Cow::Borrowed(d) });
        }
        Ok(Bsp { b, ver, lumps, lvers })
    }
    pub fn lump(&self, i: usize) -> &[u8] { &self.lumps[i] }
    pub fn lver(&self, i: usize) -> i32 { self.lvers[i] }
}

// ---------------- las entidades ----------------
/// una entidad: sus claves en minúsculas, en orden; la primera vez gana, salvo las salidas (on…), que se juntan
#[derive(Clone, Debug, Default)]
pub struct Ent { pub kv: Vec<(String, Vec<String>)> }
impl Ent {
    pub fn get(&self, k: &str) -> Option<&str> { self.kv.iter().find(|x| x.0 == k).map(|x| x.1[0].as_str()) }
    pub fn s(&self, k: &str) -> &str { self.get(k).unwrap_or("") }
    /// como +e.k de JS (vacío: 0; sin la clave o raro: NaN)
    pub fn n(&self, k: &str) -> f32 { match self.get(k) { Some(s) => num(s), None => f32::NAN } }
    /// como +e.k || d
    pub fn o(&self, k: &str, d: f32) -> f32 { let v = self.n(k); if v == 0.0 || v.is_nan() { d } else { v } }
    pub fn cl(&self) -> &str { self.s("classname") }
    pub fn sf(&self) -> i32 { let v = self.n("spawnflags"); if v.is_finite() { v as i32 } else { 0 } }
    /// "x y z" → números (lo que falta o no es número: NaN, como split(/\s+/).map(Number))
    pub fn v3(&self, k: &str) -> Option<[f32; 3]> { let s = self.get(k)?; let v: Vec<f32> = s.split_whitespace().map(num).collect(); Some([v.first().copied().unwrap_or(f32::NAN), v.get(1).copied().unwrap_or(f32::NAN), v.get(2).copied().unwrap_or(f32::NAN)]) }
    /// como String(e.k || '0 0 0').split(/\s+/).map(Number) con «|| 0» en cada uno
    pub fn v3_0(&self, k: &str) -> [f32; 3] { let v = self.v3(k).unwrap_or([0.0; 3]); v.map(|x| if x.is_nan() { 0.0 } else { x }) }
}
fn num(s: &str) -> f32 { let t = s.trim(); if t.is_empty() { 0.0 } else { t.parse::<f32>().unwrap_or(f32::NAN) } }
/// el lump de entidades (gbspEntidades)
pub fn entidades(u8s: &[u8]) -> Vec<Ent> {
    let s = latin1(u8s); let b = s.as_bytes(); let mut out = vec![]; let mut i = 0;
    while i < b.len() {
        if b[i] != b'{' { i += 1; continue; }
        let Some(fin) = b[i + 1..].iter().position(|&c| c == b'{' || c == b'}').map(|k| i + 1 + k) else { break };
        if b[fin] == b'{' { i = fin; continue; }
        let cuerpo = &s[i + 1..fin];
        // (las cadenas entre comillas y lo que hay entre una y otra: un par si sólo hay espacio en el medio)
        let mut q: Vec<(usize, usize)> = vec![]; let cb = cuerpo.as_bytes(); let mut k = 0;
        while k < cb.len() { if cb[k] == b'"' { match cb[k + 1..].iter().position(|&c| c == b'"') { Some(e) => { q.push((k + 1, k + 1 + e)); k = k + 2 + e; } None => break } } else { k += 1; } }
        let mut e = Ent::default(); let mut j = 0;
        while j + 1 < q.len() {
            let medio = &cuerpo[q[j].1 + 1..q[j + 1].0 - 1];
            if !medio.is_empty() && medio.chars().all(|c| c.is_whitespace()) {
                let kk = cuerpo[q[j].0..q[j].1].to_lowercase(); let v = cuerpo[q[j + 1].0..q[j + 1].1].to_string();
                match e.kv.iter_mut().find(|x| x.0 == kk) {
                    None => e.kv.push((kk, vec![v])),
                    Some(x) => if kk.len() > 2 && kk.starts_with("on") && kk.as_bytes()[2].is_ascii_lowercase() { x.1.push(v); },
                }
                j += 2;
            } else { j += 1; }
        }
        out.push(e); i = fin + 1;
    }
    out
}
/// una salida de Source: [destino, entrada, valor, demora, veces]
#[derive(Clone, Debug, PartialEq)]
pub struct Salida { pub t: String, pub i: String, pub v: String, pub d: f32, pub n: i32 }
/// las salidas de las claves que cumplen `k` (como salidas() de gbspPreparar)
pub fn salidas(e: &Ent, k: &dyn Fn(&str) -> bool) -> Vec<Salida> {
    let mut o = vec![];
    for (kk, vs) in &e.kv { if !k(kk) { continue; } for v in vs {
        let s: Vec<&str> = v.split([',', '\x1b']).collect(); let t = s.first().unwrap_or(&"").trim().to_lowercase(); let i = s.get(1).unwrap_or(&"").trim().to_lowercase();
        if t.is_empty() || i.is_empty() { continue; }
        let d = s.get(3).map(|x| num(x)).filter(|x| x.is_finite()).unwrap_or(0.0);
        let n = match s.get(4) { Some(x) if !x.is_empty() => { let v = num(x); if v.is_finite() { v as i32 } else { -1 } } _ => -1 };
        o.push(Salida { t, i, v: s.get(2).unwrap_or(&"").to_string(), d, n });
    } }
    o
}

// ---------------- el zip de adentro (lump 40) ----------------
/// los archivos del pakfile (materiales, modelos y sonidos propios del mapa); los cubemaps no hacen falta (gbspPak)
pub fn pak(u: &[u8]) -> Vec<(String, Vec<u8>)> {
    use std::io::Read;
    let mut out = vec![]; if u.len() < 22 { return out; }
    let mut e = None; let fin = u.len().saturating_sub(65557);
    let mut i = u.len() - 22; loop { if u32a(u, i) == 0x0605_4b50 { e = Some(i); break; } if i == 0 || i <= fin { break; } i -= 1; }
    let Some(e) = e else { return out };
    let n = u16a(u, e + 10) as usize; let mut p = u32a(u, e + 16) as usize;
    for _ in 0..n {
        if p + 46 > u.len() || u32a(u, p) != 0x0201_4b50 { break; }
        let (met, cs, us, ln, lx, lc, lo) = (u16a(u, p + 10), u32a(u, p + 20) as usize, u32a(u, p + 24) as usize, u16a(u, p + 28) as usize, u16a(u, p + 30) as usize, u16a(u, p + 32) as usize, u32a(u, p + 42) as usize);
        let nom = latin1(&u[p + 46..(p + 46 + ln).min(u.len())]).to_lowercase().replace('\\', "/"); p += 46 + ln + lx + lc;
        if nom.ends_with('/') || es_cubemap(&nom) || lo + 30 > u.len() || u32a(u, lo) != 0x0403_4b50 { continue; }
        let ini = lo + 30 + u16a(u, lo + 26) as usize + u16a(u, lo + 28) as usize; let Some(d) = u.get(ini..ini + cs) else { continue };
        if met == 0 { out.push((nom, d.to_vec())); }
        else if met == 8 { let mut v = Vec::with_capacity(us); if flate2::read::DeflateDecoder::new(d).read_to_end(&mut v).is_ok() { out.push((nom, v)); } }
    }
    out
}
/// (/\/c-?\d+_-?\d+_-?\d+(\.hdr)?\.vtf$|cubemapdefault/)
fn es_cubemap(n: &str) -> bool {
    if n.contains("cubemapdefault") { return true; }
    let Some(b) = n.strip_suffix(".vtf") else { return false }; let b = b.strip_suffix(".hdr").unwrap_or(b);
    let Some(i) = b.rfind('/') else { return false }; let s = &b[i + 1..]; let Some(s) = s.strip_prefix('c') else { return false };
    let p: Vec<&str> = s.split('_').collect();
    p.len() == 3 && p.iter().all(|x| { let x = x.strip_prefix('-').unwrap_or(x); !x.is_empty() && x.bytes().all(|c| c.is_ascii_digit()) })
}

// ---------------- ángulos de Source ----------------
const RAD: f32 = std::f32::consts::PI / 180.0;
/// Angle → (adelante, izquierda, arriba) de Source (angMat)
pub fn ang_mat(a: V) -> [V; 3] {
    let (sp, cp) = ((a[0] * RAD).sin(), (a[0] * RAD).cos()); let (sy, cy) = ((a[1] * RAD).sin(), (a[1] * RAD).cos()); let (sr, cr) = ((a[2] * RAD).sin(), (a[2] * RAD).cos());
    [[cp * cy, cp * sy, -sp], [sr * sp * cy - cr * sy, sr * sp * sy + cr * cy, sr * cp], [cr * sp * cy + sr * sy, cr * sp * sy - sr * cy, cr * cp]]
}
/// el giro del juego de un Angle de Source (angQuat): x, y, z, w
pub fn ang_quat(a: V) -> [f32; 4] {
    let [f, l, u] = ang_mat(a); let d = |v: V| [v[1], v[2], v[0]]; let (ff, lf, uu) = (d(f), d(l), d(u));
    let m = [[lf[0], uu[0], ff[0]], [lf[1], uu[1], ff[1]], [lf[2], uu[2], ff[2]]];
    let t = m[0][0] + m[1][1] + m[2][2];
    let (x, y, z, w) = if t > 0.0 { let s = (t + 1.0).sqrt() * 2.0; ((m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, 0.25 * s) }
        else if m[0][0] > m[1][1] && m[0][0] > m[2][2] { let s = (1.0 + m[0][0] - m[1][1] - m[2][2]).sqrt() * 2.0; (0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s) }
        else if m[1][1] > m[2][2] { let s = (1.0 + m[1][1] - m[0][0] - m[2][2]).sqrt() * 2.0; ((m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s) }
        else { let s = (1.0 + m[2][2] - m[0][0] - m[1][1]).sqrt() * 2.0; ((m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s, (m[1][0] - m[0][1]) / s) };
    let l = (x * x + y * y + z * z + w * w).sqrt().max(1e-12); [x / l, y / l, z / l, w / l]
}
/// el giro que lleva (0, 0, 1) a la dirección f (gbspQuatDe)
pub fn quat_de(f: V) -> [f32; 4] {
    let d = f[2];
    if d > 0.9999 { return [0.0, 0.0, 0.0, 1.0]; } if d < -0.9999 { return [0.0, 1.0, 0.0, 0.0]; }
    let a = [-f[1], f[0], 0.0]; let l = (a[0] * a[0] + a[1] * a[1]).sqrt().max(1e-12); let ang = d.clamp(-1.0, 1.0).acos(); let s = (ang / 2.0).sin();
    [a[0] / l * s, a[1] / l * s, 0.0, (ang / 2.0).cos()]
}
fn dir_g(v: V) -> V { let g = [v[1], v[2], v[0]]; let l = (g[0] * g[0] + g[1] * g[1] + g[2] * g[2]).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; g.map(|x| x / l) }

// ---------------- puertas, lo que gira y trenes (gbspPuertaDe, gbspTrenDe) ----------------
/// lo que se sabe de una puerta de Source (en unidades del juego) para puertas.rs
#[derive(Clone, Debug, Default)]
pub struct PuertaDef {
    pub cl: String, pub giro: bool, pub rot: bool, pub tren: bool, pub usa: bool, pub pasa: bool, pub silencio: bool,
    pub vel: f32, pub espera: f32, pub toca: bool, pub nombre: String, pub esclavo: String, pub abierta: bool, pub una_via: bool, pub sentido: f32, pub sf: i32,
    /// las que giran: los grados (con signo), el eje (en el juego) y si es el de arriba del modelo
    pub dist: f32, pub eje: V, pub eje_local: bool,
    /// las que se corren: la dirección, el "lip" y la velocidad en metros, y lo que se corre un func_movelinear
    pub dir: V, pub lip: f32, pub vel_m: f32, pub dist_m: Option<f32>,
    /// func_rotating: al revés y si arranca andando
    pub rev: bool, pub arranca: bool,
    /// func_tracktrain: su primer punto, velocidades (m/s), su "height", orientación fija, sin inclinar, aceleración manual, sonidos
    pub primero: String, pub vel_max: f32, pub vel_ini: f32, pub alto: f32, pub fija: bool, pub sin_pitch: bool, pub acel: f32, pub decel: f32,
    pub s_ini: String, pub s_fin: String, pub s_mov: String, pub vol: f32,
}
pub fn puerta_de(e: &Ent, cl: &str) -> Option<PuertaDef> {
    let sf = e.sf();
    if cl == "func_rotating" {
        return Some(PuertaDef { cl: cl.into(), giro: true, rot: true, usa: false, silencio: true, vel: e.o("maxspeed", 100.0), rev: sf & 2 != 0, arranca: sf & 1 != 0, pasa: sf & 64 != 0,
            eje: dir_g(if sf & 4 != 0 { [1.0, 0.0, 0.0] } else if sf & 8 != 0 { [0.0, 1.0, 0.0] } else { [0.0, 0.0, 1.0] }), espera: -1.0, nombre: e.s("targetname").into(), sentido: 1.0, ..Default::default() });
    }
    if cl == "func_tracktrain" || cl == "func_tanktrain" {
        let man = e.get("manualspeedchanges").unwrap_or("0") == "1";
        let vol = match e.get("volume") { Some(v) if !v.is_empty() => num(v), _ => 10.0 }.clamp(0.0, 10.0) / 10.0;
        return Some(PuertaDef { cl: cl.into(), tren: true, silencio: true, espera: -1.0, nombre: e.s("targetname").into(), primero: e.s("target").to_lowercase(), sentido: 1.0,
            vel_max: e.o("startspeed", 100.0).abs() * GM_S, vel_ini: e.o("speed", 0.0) * GM_S, alto: e.o("height", 0.0) * GM_S, fija: sf & 16 != 0, sin_pitch: sf & 1 != 0, pasa: sf & 8 != 0,
            acel: if man { e.o("manualaccelspeed", 0.0).max(1.0) * GM_S } else { 0.0 }, decel: if man { e.o("manualdecelspeed", 0.0).max(1.0) * GM_S } else { 0.0 },
            s_ini: e.s("startsound").into(), s_fin: e.s("stopsound").into(), s_mov: e.s("movesound").into(), vol, ..Default::default() });
    }
    if !matches!(cl, "func_door" | "func_door_rotating" | "func_movelinear" | "prop_door_rotating") { return None; }
    let giro = cl != "func_door" && cl != "func_movelinear"; let prop = cl == "prop_door_rotating";
    let espera = if e.get("wait").is_some() { e.n("wait") } else if e.get("returndelay").is_some() { e.n("returndelay") } else if prop { -1.0 } else { 4.0 };
    let od = e.n("opendir");
    let mut p = PuertaDef { cl: cl.into(), giro, sf, vel: e.o("speed", 100.0), espera, toca: cl == "func_door" && sf & 1024 != 0, usa: true, pasa: !prop && sf & 8 != 0,
        nombre: e.s("targetname").into(), esclavo: e.s("slavename").into(), abierta: if prop { e.n("spawnpos") == 1.0 } else { sf & 1 != 0 }, silencio: sf & 4096 != 0,
        una_via: sf & 16 != 0 || od == 1.0 || od == 2.0, sentido: if od == 2.0 { -1.0 } else { 1.0 }, ..Default::default() };
    if !prop && sf & 32 != 0 { p.espera = -1.0; }
    if giro {
        p.dist = e.o("distance", 90.0).abs() * if sf & 2 != 0 { -1.0 } else { 1.0 };
        p.eje = dir_g(if prop { [0.0, 0.0, 1.0] } else if sf & 64 != 0 { [1.0, 0.0, 0.0] } else if sf & 128 != 0 { [0.0, 1.0, 0.0] } else { [0.0, 0.0, 1.0] });
        p.eje_local = prop;
    } else {
        let f = ang_mat(e.v3_0("movedir"))[0];
        p.dir = dir_g(f); p.lip = e.o("lip", 0.0) * GM_S; p.vel_m = p.vel * GM_S;
        if cl == "func_movelinear" { p.dist_m = Some(e.o("movedistance", 100.0) * GM_S); p.toca = false; }
    }
    Some(p)
}

// ---------------- las brochas (lumps 18 y 19) ----------------
struct Brochas<'a> { nd: &'a [u8], hj: &'a [u8], lb: &'a [u8], br: &'a [u8], bs: &'a [u8], pl: &'a [u8], ti: &'a [u8], mo: &'a [u8], hs: usize }
impl Brochas<'_> {
    fn n(u: &[u8], t: usize) -> usize { u.len() / t }
    /// las brochas de un modelo de bloques, recorriendo su árbol
    fn de_modelo(&self, m: usize) -> Vec<usize> {
        if m >= Self::n(self.mo, 48) { return vec![]; }
        let (nn, nh, nlb, nbr) = (Self::n(self.nd, 32), Self::n(self.hj, self.hs), Self::n(self.lb, 2), Self::n(self.br, 12));
        let mut l = vec![]; let mut vistas = std::collections::HashSet::new(); let mut pila = vec![i32a(self.mo, m * 48 + 36)];
        let mut k = 0;
        while let Some(n) = pila.pop() {
            k += 1; if k > 200_000 { break; }
            if n >= 0 { if (n as usize) < nn { pila.push(i32a(self.nd, n as usize * 32 + 4)); pila.push(i32a(self.nd, n as usize * 32 + 8)); } continue; }
            let h = (-1 - n) as usize; if h >= nh { continue; }
            let (f, c) = (u16a(self.hj, h * self.hs + 24) as usize, u16a(self.hj, h * self.hs + 26) as usize);
            for i in f..(f + c).min(nlb) { let b = u16a(self.lb, i * 2) as usize; if b < nbr && vistas.insert(b) { l.push(b); } }
        }
        l
    }
    /// ¿tiene algún lado que el compilador deja como cara? (con textura que se ve, o del cielo, o de agua: esas ya chocan)
    fn con_cara(&self, b: usize, tex_nom: &[String]) -> bool {
        let (f, n) = (i32a(self.br, b * 12) as usize, i32a(self.br, b * 12 + 4) as usize); let (nbs, nti) = (Self::n(self.bs, 8), Self::n(self.ti, 72));
        for i in f..(f + n).min(nbs) {
            if self.bs[i * 8 + 6] != 0 { continue; }
            let t = i16a(self.bs, i * 8 + 2); if t < 0 || t as usize >= nti { continue; }
            let fl = i32a(self.ti, t as usize * 72 + 64); let nom = tex_nom.get(i32a(self.ti, t as usize * 72 + 68) as usize).map(|s| s.as_str()).unwrap_or("");
            if fl & (SURF_NODRAW | SURF_TRIGGER | SURF_HINT | SURF_SKIP) == 0 && (!nom.starts_with("tools/") || nom.contains("toolsblack") || nom.contains("toolsskybox")) { return true; }
        }
        false
    }
    fn contenido(&self, b: usize) -> i32 { i32a(self.br, b * 12 + 8) }
    /// los lados de la brocha: cada plano recortado por los demás (adentro: n·p ≤ d)
    fn lados(&self, b: usize) -> Vec<(V, Vec<V>)> {
        let (f, n) = (i32a(self.br, b * 12) as usize, i32a(self.br, b * 12 + 4) as usize); let (nbs, npl) = (Self::n(self.bs, 8), Self::n(self.pl, 20));
        let mut pp: Vec<([f32; 4], bool)> = vec![];
        for i in f..(f + n).min(nbs) { if pp.len() >= 64 { break; } let pi = u16a(self.bs, i * 8) as usize; if pi >= npl { continue; } pp.push(([f32a(self.pl, pi * 20), f32a(self.pl, pi * 20 + 4), f32a(self.pl, pi * 20 + 8), f32a(self.pl, pi * 20 + 12)], self.bs[i * 8 + 6] != 0)); }
        let mut out = vec![];
        for i in 0..pp.len() {
            if pp[i].1 { continue; }
            let [nx, ny, nz, d] = pp[i].0; let ax = if nx.abs() < 0.9 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] };
            let (mut ux, mut uy, mut uz) = (ny * ax[2] - nz * ax[1], nz * ax[0] - nx * ax[2], nx * ax[1] - ny * ax[0]); let ul = (ux * ux + uy * uy + uz * uz).sqrt(); let ul = if ul > 0.0 { ul } else { 1.0 }; ux /= ul; uy /= ul; uz /= ul;
            let (vx, vy, vz) = (ny * uz - nz * uy, nz * ux - nx * uz, nx * uy - ny * ux); let s = 32768.0; let (cx, cy, cz) = (nx * d, ny * d, nz * d);
            let mut poly: Vec<V> = vec![[cx + (ux + vx) * s, cy + (uy + vy) * s, cz + (uz + vz) * s], [cx + (ux - vx) * s, cy + (uy - vy) * s, cz + (uz - vz) * s], [cx - (ux + vx) * s, cy - (uy + vy) * s, cz - (uz + vz) * s], [cx - (ux - vx) * s, cy - (uy - vy) * s, cz - (uz - vz) * s]];
            for j in 0..pp.len() {
                if poly.len() < 3 { break; }
                if j == i { continue; } let q = pp[j].0;
                if q[0] * nx + q[1] * ny + q[2] * nz > 0.9999 && (q[3] - d).abs() < 0.01 { if j < i { poly.clear(); break; } continue; }
                let sd: Vec<f32> = poly.iter().map(|p| q[0] * p[0] + q[1] * p[1] + q[2] * p[2] - q[3]).collect(); let mut nue = vec![];
                for k in 0..poly.len() {
                    let (a, b2, sa, sb) = (poly[k], poly[(k + 1) % poly.len()], sd[k], sd[(k + 1) % poly.len()]);
                    if sa <= 0.01 { nue.push(a); }
                    if (sa <= 0.01) != (sb <= 0.01) { let t = sa / (sa - sb); nue.push([a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, a[2] + (b2[2] - a[2]) * t]); }
                }
                poly = nue;
            }
            if poly.len() >= 3 { out.push(([nx, ny, nz], poly)); }
        }
        out
    }
}

// ---------------- el resultado ----------------
/// el material de una cara: el de su textura (el número del texdata), la segunda textura de un terreno, o el agua
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum MatRef { Tex(u32), Tex2(u32), Agua }
/// lo que quien llama sabe del material de una textura: si se dibuja (hay material), si es agua y si tiene segunda textura
#[derive(Clone, Copy, Debug, Default)]
pub struct InfoMat { pub dibuja: bool, pub agua: bool, pub segunda: bool }
/// un pedazo de geometría: vértices (en el juego), normales, UV, de dónde sale su luz horneada (rectángulo r —−1: la media
/// del mapa, −2: una que brilla— y luxel), los índices por material, los triángulos que chocan (de a 3 puntos), los que
/// sólo frenan al jugador y, en un tren, sus cascos
#[derive(Clone, Debug, Default)]
pub struct Pieza { pub p: Vec<V>, pub n: Vec<V>, pub uv: Vec<[f32; 2]>, pub lm: Vec<(i32, f32, f32)>, pub por: Vec<(MatRef, Vec<u32>)>, pub c: Vec<V>, pub cc: Vec<V>, pub h: Vec<Vec<V>>, pub tren: bool }
impl Pieza {
    fn cara(&mut self, pts: &[V], nrm: Option<&[V]>, uvs: Option<&[[f32; 2]]>, tris: &[[u32; 3]], mi: Option<MatRef>, dibuja: bool, choca: bool, agua: bool, lmv: Option<&[(i32, f32, f32)]>) {
        if let (true, Some(mi), Some(nrm), Some(uvs)) = (dibuja, mi, nrm, uvs) {
            let base = self.p.len() as u32;
            let k = match self.por.iter().position(|x| x.0 == mi) { Some(k) => k, None => { self.por.push((mi, vec![])); self.por.len() - 1 } };
            for i in 0..pts.len() { self.p.push(pts[i]); self.n.push(nrm[i]); self.uv.push(uvs[i]); self.lm.push(lmv.map(|l| l[i]).unwrap_or((-1, 0.0, 0.0))); }
            for t in tris { self.por[k].1.extend_from_slice(&[base + t[0], base + t[1], base + t[2]]); }
        }
        if choca && !agua { for t in tris { for &i in t { self.c.push(pts[i as usize]); } } }
    }
}
/// una puerta (o lo que gira, o un tren) en su pieza: su eje (el origen de la entidad, en el juego), la malla alrededor de
/// él, su casco de choque (o uno por brocha, el tren), su caja en su espacio, el nombre de su padre y si choca
#[derive(Clone, Debug, Default)]
pub struct PuertaBsp { pub def: PuertaDef, pub piv: V, pub pieza: Pieza, pub casco: Vec<V>, pub cascos: Vec<Vec<V>>, pub caja: Option<(V, V)>, pub padre: String, pub solida: bool, pub nombre: String }
/// un prop del mapa: el modelo, dónde (Source), su giro (Angle), si choca, su escala, si es suelto, si es una puerta, su padre
#[derive(Clone, Debug, Default)]
pub struct PropBsp { pub modelo: String, pub o: V, pub a: V, pub solido: bool, pub esc: f32, pub fisico: bool, pub puerta: Option<PuertaDef>, pub padre: String,
    /// hasta dónde se dibuja (FadeMaxDist del mapa, en metros; 0: siempre)
    pub fade: f32 }
/// el atlas de la luz horneada (RGBA, en gamma hasta 4 veces el blanco)
#[derive(Clone, Debug, Default)]
pub struct Atlas { pub w: u32, pub h: u32, pub f: u32, pub pos: Vec<[u32; 2]>, pub px: Vec<u8>, pub medio: [f32; 3] }
/// un botón del mapa (func_button): su caja, sus salidas (al apretar, OnIn, OnOut, trabado), si es de dos posiciones, si arranca trabado
#[derive(Clone, Debug, Default)]
pub struct BotonBsp { pub c: (V, V), pub p: Vec<Salida>, pub i: Vec<Salida>, pub o: Vec<Salida>, pub l: Vec<Salida>, pub tog: bool, pub bloq: bool, pub n: String, pub pa: String }
/// una zona (trigger_multiple / trigger_once): su caja, lo que dispara al entrar y al salir
#[derive(Clone, Debug, Default)]
pub struct ZonaBsp { pub c: (V, V), pub en: Vec<Salida>, pub sa: Vec<Salida>, pub una: bool, pub n: String, pub off: bool }
/// un punto del camino de un tren (path_track)
#[derive(Clone, Debug, Default)]
pub struct CaminoBsp { pub n: String, pub p: V, pub sig: String, pub alt: String, pub sal: Vec<Salida>, pub vel: f32, pub sf: i32 }
/// un sonido del mapa (ambient_generic)
#[derive(Clone, Debug, Default)]
pub struct SonidoBsp { pub n: String, pub s: String, pub v: f32, pub r: f32, pub p: V, pub todo: bool, pub ini: bool, pub bucle: bool, pub tono: f32 }
/// lo de mapaio.js: los sonidos, los relevos (nombre, salidas, prendido) y lo que pasa al cargar
#[derive(Clone, Debug, Default)]
pub struct Io { pub snd: Vec<SonidoBsp>, pub relay: Vec<(String, Vec<Salida>, bool)>, pub auto: Vec<Salida> }
/// una puerta portal (linked_portal_door): centro, adelante, derecha, arriba (en el juego), la mitad del ancho y del alto
#[derive(Clone, Debug, Default)]
pub struct PortalBsp { pub n: String, pub par: String, pub o: V, pub f: V, pub r: V, pub u: V, pub w: f32, pub h: f32 }
/// el cielo 3D: dónde está su cámara (en el juego), cuánto se agranda, hasta dónde llega su sala y su niebla (color, desde, hasta, tope)
#[derive(Clone, Debug, Default)]
pub struct Cielo3d { pub o: V, pub s: f32, pub lejos: f32, pub fog: Option<([f32; 3], f32, f32, f32)> }
/// la niebla del mapa (env_fog_controller): desde, hasta (m), color y cuánto tapa como mucho
#[derive(Clone, Copy, Debug, Default)]
pub struct Niebla { pub fs: f32, pub fe: f32, pub c: [f32; 3], pub max: f32 }

/// el mapa armado (lo que gbspPreparar deja en DATA.esc y DATA.aj)
#[derive(Default)]
pub struct Armado {
    /// los pedazos del mundo (celda de 64 m), los de la sala del cielo 3D y las puertas
    pub pedazos: Vec<((i32, i32), Pieza)>, pub cielo3: Vec<Pieza>, pub puertas: Vec<PuertaBsp>,
    pub props: Vec<PropBsp>, pub atlas: Option<Atlas>,
    /// los nombres de las texturas y lo que se supo de cada material
    pub tex_nom: Vec<String>, pub mats: HashMap<u32, InfoMat>,
    /// los volúmenes de agua (x0, y0, z0, x1, y1, z1)
    pub aguas: Vec<[f32; 6]>,
    pub spawns: Vec<(V, Option<f32>)>,
    /// el sol (hacia dónde va su luz, en el juego) y su color (en gamma, por su brillo); la luz de relleno (arriba, abajo)
    pub sol: Option<(V, [f32; 3])>, pub amb: Option<([f32; 3], [f32; 3])>, pub sin_sombra: bool,
    pub niebla: Option<Niebla>, pub portales: Vec<PortalBsp>, pub cielo3d: Option<Cielo3d>,
    /// el nombre del cielo 2D (skyname) y las rutas de sus caras
    pub cielo: String,
    pub lejos: f32,
    pub botones: Vec<BotonBsp>, pub zonas: Vec<ZonaBsp>, pub caminos: Vec<CaminoBsp>, pub io: Io,
    /// cuántas brochas sin caras chocan y cuántos cascos de trenes
    pub brochas: (u32, u32),
}

/// las caras del cielo 2D (skybox/<nombre><sufijo>)
pub const CARAS_CIELO: [&str; 6] = ["up", "dn", "ft", "bk", "lf", "rt"];

/// los nombres de las texturas (texdata → su nombre en minúsculas) y sus tamaños
pub fn texturas(bsp: &Bsp) -> (Vec<String>, Vec<[f32; 2]>) {
    let (td, sd, st) = (bsp.lump(2), bsp.lump(43), bsp.lump(44));
    let (mut n, mut t) = (vec![], vec![]);
    for i in 0..td.len() / 32 {
        let sid = i32a(td, i * 32 + 12); let off = if sid >= 0 && sid as usize * 4 + 4 <= st.len() { i32a(st, sid as usize * 4) } else { -1 };
        n.push(if off >= 0 { cad(sd, off as usize).to_lowercase().replace('\\', "/") } else { "tools/toolsnodraw".into() });
        let (w, h) = (i32a(td, i * 32 + 16), i32a(td, i * 32 + 20)); t.push([if w != 0 { w as f32 } else { 512.0 }, if h != 0 { h as f32 } else { 512.0 }]);
    }
    (n, t)
}

fn escala_prop(x: f32) -> f32 { if x > 0.001 && x < 100.0 { x } else { 1.0 } }
/// los props del mapa: los estáticos (game lump "sprp") y los de entidades (gbspProps)
pub fn props(bsp: &Bsp, ents: &[Ent], lzma: Lzma) -> Vec<PropBsp> {
    let mut out = vec![]; let gl = bsp.lump(35);
    let n = i32a(gl, 0).max(0) as usize;
    for i in 0..n {
        let o = 4 + i * 16; if o + 16 > gl.len() { break; }
        if u32a(gl, o) != 0x7370_7270 { continue; }
        let (fo, fl) = (i32a(gl, o + 8), i32a(gl, o + 12)); if fo < 0 || fl < 0 || (fo + fl) as usize > bsp.b.len() { continue; }
        let crudo = &bsp.b[fo as usize..(fo + fl) as usize]; let dd = deslzma(crudo, lzma); let d: &[u8] = dd.as_deref().unwrap_or(crudo);
        let mut p = 0usize;
        let nd = i32a(d, p).max(0) as usize; p += 4; let mut dic = vec![];
        for _ in 0..nd { if p + 128 > d.len() { break; } dic.push(cad(d, p).to_lowercase().replace('\\', "/")); p += 128; }
        let nl = i32a(d, p).max(0) as usize; p += 4 + nl * 2;
        let np = i32a(d, p); p += 4; if np <= 0 { break; }
        let paso = (d.len().saturating_sub(p)) / np as usize; if paso < 32 { break; }
        let ver = u16a(gl, o + 6); let con_escala = ver >= 11 && paso >= 80;
        for _ in 0..np {
            if p + paso > d.len() { break; }
            let ti = u16a(d, p + 24) as usize; let sol = d[p + 30];
            if let Some(m) = dic.get(ti).filter(|m| !m.is_empty()) {
                let esc = if con_escala { f32a(d, p + paso - 4) } else { 1.0 };
                // (desde la versión 4: FadeMinDist y FadeMaxDist después del skin; Source deja de dibujarlo en FadeMaxDist)
                let fmax = if paso >= 44 { f32a(d, p + 40) } else { 0.0 }; let fade = if fmax.is_finite() && fmax > 0.0 { fmax * GM_S } else { 0.0 };
                out.push(PropBsp { modelo: m.clone(), o: [f32a(d, p), f32a(d, p + 4), f32a(d, p + 8)], a: [f32a(d, p + 12), f32a(d, p + 16), f32a(d, p + 20)], solido: sol != 0, esc: if esc > 0.01 && esc < 100.0 { esc } else { 1.0 }, fade, ..Default::default() });
            }
            p += paso;
        }
    }
    for e in ents {
        let cl = e.cl();
        if !matches!(cl, "prop_dynamic" | "prop_dynamic_override" | "prop_physics" | "prop_physics_multiplayer" | "prop_physics_override" | "prop_static" | "prop_door_rotating") { continue; }
        let m = e.s("model"); if !m.to_lowercase().ends_with(".mdl") { continue; } let Some(o) = e.v3("origin") else { continue };
        let puerta = if cl == "prop_door_rotating" { puerta_de(e, cl) } else { None };
        let fmax = e.n("fademaxdist"); let fade = if fmax.is_finite() && fmax > 0.0 { fmax * GM_S } else { 0.0 };
        out.push(PropBsp { esc: escala_prop(e.n("modelscale")), modelo: m.to_lowercase().replace('\\', "/"), o, a: e.v3_0("angles"), solido: e.get("solid") != Some("0"), fisico: cl.starts_with("prop_physics"), puerta, padre: e.s("parentname").to_lowercase(), fade });
    }
    out.truncate(4000);
    out
}

/// la caja (en Source) de la sala del cielo 3D: las hojas del área de la cámara del cielo (gbspCajaCielo)
pub fn caja_cielo(bsp: &Bsp, o: V, apar: &[V]) -> Option<[f32; 6]> {
    let (pl, nd, hj) = (bsp.lump(1), bsp.lump(5), bsp.lump(10)); if pl.is_empty() || nd.is_empty() || hj.is_empty() { return None; }
    let hs = if bsp.lver(10) == 0 { 56 } else { 32 }; let (nh, nn, np) = (hj.len() / hs, nd.len() / 32, pl.len() / 20);
    let (mut n, mut k) = (0i32, 0);
    while n >= 0 {
        if n as usize >= nn || k > 4096 { return None; } k += 1;
        let pi = i32a(nd, n as usize * 32); if pi < 0 || pi as usize >= np { return None; } let pi = pi as usize;
        let d = f32a(pl, pi * 20) * o[0] + f32a(pl, pi * 20 + 4) * o[1] + f32a(pl, pi * 20 + 8) * o[2] - f32a(pl, pi * 20 + 12);
        n = i32a(nd, n as usize * 32 + if d >= 0.0 { 4 } else { 8 });
    }
    let h = (-1 - n) as usize; if h >= nh || i32a(hj, h * hs) & 1 != 0 { return None; }
    let area = |i: usize| i16a(hj, i * hs + 6) & 0x1ff; let a = area(h); let mut c = [1e9f32, 1e9, 1e9, -1e9, -1e9, -1e9];
    let (mut na, mut ntot) = (0, 0);
    for i in 0..nh {
        if i32a(hj, i * hs) & 1 != 0 { continue; } ntot += 1;
        if area(i) != a { continue; } na += 1;
        for j in 0..3 { c[j] = c[j].min(i16a(hj, i * hs + 8 + j * 2) as f32); c[3 + j] = c[3 + j].max(i16a(hj, i * hs + 14 + j * 2) as f32); }
    }
    if na == 0 || (apar.is_empty() && na as f32 > ntot as f32 * 0.4) { return None; }
    for q in apar { if q[0] >= c[0] && q[0] <= c[3] && q[1] >= c[1] && q[1] <= c[4] && q[2] >= c[2] && q[2] <= c[5] { return None; } }
    Some(c)
}

/// el atlas de la luz horneada (gbspAtlasLuz): cada rectángulo de luxels (RGB + exponente) en su lugar, con un borde
/// repetido; arriba a la izquierda, la luz media del mapa y una que brilla. Si no entra en el tope, cada cara a la mitad
fn atlas_luz(lit: &[u8], r: &[Rect], tope: u32) -> Option<Atlas> {
    let pot: Vec<f32> = (0..256).map(|i| 2f32.powi(i - 128)).collect();
    let lin = |o: usize| -> [f32; 3] { let e = lit.get(o + 3).copied().unwrap_or(0) as i8 as i32; let k = pot[(e + 128) as usize] / 255.0; [lit.get(o).copied().unwrap_or(0) as f32 * k, lit.get(o + 1).copied().unwrap_or(0) as f32 * k, lit.get(o + 2).copied().unwrap_or(0) as f32 * k] };
    let enc = |x: f32| -> u8 { ((x.max(0.0) / 4.0).min(1.0).powf(1.0 / 2.2) * 255.0).round() as u8 };
    let mut f = 1u32;
    while f <= 8 {
        let s: Vec<[u32; 2]> = r.iter().map(|q| [q.w.div_ceil(f) + 2, q.h.div_ceil(f) + 2]).collect();
        let mut area = 64u64; for q in &s { area += (q[0] * q[1]) as u64; }
        let mut w = 64u32; while (((w as u64) * (w as u64)) as f64) < (area as f64) * 1.2 && w < tope { w *= 2; }
        let mut ord: Vec<usize> = (0..r.len()).collect(); ord.sort_by(|&a, &b| s[b][1].cmp(&s[a][1]).then(s[b][0].cmp(&s[a][0])));
        let mut pos = vec![[0u32; 2]; r.len()]; let (mut x, mut y, mut sh, mut cabe) = (8u32, 0u32, 4u32, true);
        for &i in &ord { let [ww, hh] = s[i]; if ww > w { cabe = false; break; } if x + ww > w { y += sh; x = 0; sh = 0; } pos[i] = [x, y]; x += ww; if hh > sh { sh = hh; } }
        let mut h = 4u32; while h < y + sh { h *= 2; }
        if !cabe || h > tope { f *= 2; continue; }
        let mut px = vec![0u8; (w * h * 4) as usize]; let mut suma = [0f64; 3]; let mut cuenta = 0u64;
        let pon = |px: &mut Vec<u8>, xx: u32, yy: u32, c: [u8; 3]| { let o = ((yy * w + xx) * 4) as usize; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; };
        for i in 0..r.len() {
            let q = &r[i]; let [x0, y0] = pos[i]; let (ww, hh) = (s[i][0] - 2, s[i][1] - 2);
            for b in 0..hh { for a in 0..ww {
                let mut c = [0f32; 3]; let mut n = 0;
                for yy in b * f..(q.h).min(b * f + f) { for xx in a * f..(q.w).min(a * f + f) { let o = ((yy * q.w + xx) * 4) as usize; for &of in &q.offs { let l = lin(of + o); c[0] += l[0]; c[1] += l[1]; c[2] += l[2]; } n += 1; } }
                if n > 0 { for v in c.iter_mut() { *v /= n as f32; } suma[0] += c[0] as f64; suma[1] += c[1] as f64; suma[2] += c[2] as f64; cuenta += 1; }
                pon(&mut px, x0 + 1 + a, y0 + 1 + b, [enc(c[0]), enc(c[1]), enc(c[2])]);
            } }
            // (el borde: copia de la orilla de adentro, también en las esquinas)
            for b in -1..=hh as i32 { for a in -1..=ww as i32 {
                if a >= 0 && a < ww as i32 && b >= 0 && b < hh as i32 { continue; }
                let (sa, sb) = (a.clamp(0, ww as i32 - 1) as u32, b.clamp(0, hh as i32 - 1) as u32);
                let so = (((y0 + 1 + sb) * w + x0 + 1 + sa) * 4) as usize; let d = ((((y0 as i32 + 1 + b) as u32) * w + (x0 as i32 + 1 + a) as u32) * 4) as usize;
                px[d] = px[so]; px[d + 1] = px[so + 1]; px[d + 2] = px[so + 2]; px[d + 3] = 255;
            } }
        }
        let medio = if cuenta > 0 { [(suma[0] / cuenta as f64) as f32, (suma[1] / cuenta as f64) as f32, (suma[2] / cuenta as f64) as f32] } else { [0.5; 3] };
        for b in 0..4 { for a in 0..4 { pon(&mut px, a, b, medio.map(enc)); pon(&mut px, 4 + a, b, [enc(1.25); 3]); } }
        return Some(Atlas { w, h, f, pos, px, medio });
    }
    None
}
struct Rect { lo: i32, w: u32, h: u32, offs: Vec<usize> }

/// las UV de la luz horneada de una pieza en el atlas (lmUV)
pub fn lm_uv(p: &Pieza, a: &Atlas) -> Vec<[f32; 2]> {
    let (w, h, f) = (a.w as f32, a.h as f32, a.f as f32);
    p.lm.iter().map(|&(r, s, t)| {
        if r >= 0 { if let Some(q) = a.pos.get(r as usize) { return [(q[0] as f32 + 1.0 + (s + 0.5) / f) / w, (q[1] as f32 + 1.0 + (t + 0.5) / f) / h]; } }
        [(if r == -2 { 6.0 } else { 2.0 }) / w, 2.0 / h]
    }).collect()
}

/// las UV de una cara llevadas cerca de 0 por un entero (gbspUVcorr; sin dar vuelta la v: las texturas de Source van
/// derechas en el motor, como las de los modelos)
fn uv_corr(uvs: &mut [[f32; 2]]) {
    let (mut mu, mut mv, mut xu, mut xv) = (1e9f32, 1e9f32, -1e9f32, -1e9f32);
    for u in uvs.iter() { mu = mu.min(u[0]); xu = xu.max(u[0]); mv = mv.min(u[1]); xv = xv.max(u[1]); }
    let ancha = xu - mu > 2.0 || xv - mv > 2.0; let du = (if ancha { (mu + xu) / 2.0 } else { mu }).floor(); let dv = (if ancha { (mv + xv) / 2.0 } else { mv }).floor();
    for u in uvs.iter_mut() { u[0] -= du; u[1] -= dv; }
}
/// ¿el nombre de la textura es de agua? (/(^|\/)(water|liquids?)[^/]*\/|water/ y no una cascada ni lo de abajo del agua)
pub fn es_agua_nom(nom: &str) -> bool {
    let liq = { let seg: Vec<&str> = nom.split('/').collect(); seg.len() > 1 && seg[..seg.len() - 1].iter().any(|s| s.starts_with("water") || s.starts_with("liquid")) };
    (nom.contains("water") || liq) && !nom.contains("waterfall") && !nom.contains("underwater")
}
fn caja_mo(mo: &[u8], e: &Ent) -> Option<(V, V)> {
    let m = e.s("model").strip_prefix('*')?.parse::<usize>().ok()?; if m >= mo.len() / 48 { return None; }
    let i = m * 48; let o = e.v3_0("origin");
    let a = g(f32a(mo, i) + o[0], f32a(mo, i + 4) + o[1], f32a(mo, i + 8) + o[2]); let b = g(f32a(mo, i + 12) + o[0], f32a(mo, i + 16) + o[1], f32a(mo, i + 20) + o[2]);
    Some(([a[0].min(b[0]), a[1].min(b[1]), a[2].min(b[2])], [a[0].max(b[0]), a[1].max(b[1]), a[2].max(b[2])]))
}
fn cross(a: V, b: V) -> V { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
fn dot(a: V, b: V) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
/// los triángulos de un abanico, mirando para el lado de `ng`
fn abanico(pts: &[V], ng: V) -> Vec<[u32; 3]> {
    let mut tris = vec![];
    for k in 1..pts.len().saturating_sub(1) {
        let n = cross(sub(pts[k], pts[0]), sub(pts[k + 1], pts[0]));
        tris.push(if dot(n, ng) < 0.0 { [0, k as u32 + 1, k as u32] } else { [0, k as u32, k as u32 + 1] });
    }
    tris
}

type Pedazos = Vec<((i32, i32), Pieza)>;
/// la pieza donde va una cara (ponerCara): la de su puerta, o el pedazo de 64 m (del mundo o del cielo 3D) de su centro
#[allow(clippy::too_many_arguments)]
fn destino<'p>(pieza: Option<usize>, cielo: bool, pts: &[V], piezas: &'p mut [Pieza], ped: &'p mut Pedazos, ped_i: &mut HashMap<(i32, i32), usize>, pedc: &'p mut Pedazos, pedc_i: &mut HashMap<(i32, i32), usize>) -> &'p mut Pieza {
    if let Some(i) = pieza { return &mut piezas[i]; }
    let n = pts.len() as f32; let c = pts.iter().fold([0.0; 3], |a, q| [a[0] + q[0], a[1] + q[1], a[2] + q[2]]);
    let (v, idx) = if cielo { (pedc, pedc_i) } else { (ped, ped_i) };
    let k = ((c[0] / n / CELDA).floor() as i32, (c[2] / n / CELDA).floor() as i32);
    let i = *idx.entry(k).or_insert_with(|| { v.push((k, Pieza::default())); v.len() - 1 }); &mut v[i].1
}
/// una entidad de bloques en uso (usoMo): su modelo, dónde, su giro (adelante, izquierda, arriba), sin choque, invisible,
/// la puerta que es, su nombre, su padre y la pieza donde van sus caras
struct Uso { i: usize, o: V, rot: Option<[V; 3]>, sin_choque: bool, sin_dibujo: bool, puerta: Option<PuertaDef>, nombre: String, padre: String, pieza: Option<usize> }

/// arma el mapa: `mat` dice, de cada textura (su número de texdata y su nombre), si se dibuja, si es agua y si tiene
/// segunda textura; `tope_lm`: el lado más grande del atlas de la luz horneada
pub fn armar(bsp: &Bsp, ents: &[Ent], mut props: Vec<PropBsp>, mat: &mut dyn FnMut(u32, &str) -> InfoMat, tope_lm: u32) -> Armado {
    let mut a = Armado::default();
    let (pl, vt, ti, fc, ed, se, mo, di, dvs) = (bsp.lump(1), bsp.lump(3), bsp.lump(6), bsp.lump(7), bsp.lump(12), bsp.lump(13), bsp.lump(14), bsp.lump(26), bsp.lump(33));
    let (tex_nom, tex_tam) = texturas(bsp);
    // el cielo 3D: la sala aparte con el paisaje en miniatura; lo que cae adentro no es parte del mundo
    let skc = ents.iter().find(|e| e.cl() == "sky_camera" && e.get("origin").is_some());
    let es_apar = |c: &str| c.starts_with("info_player_") || c == "gmod_player_start";
    let apar0: Vec<V> = ents.iter().filter(|e| es_apar(e.cl()) && e.get("origin").is_some()).map(|e| e.v3("origin").unwrap()).collect();
    let cc3 = skc.and_then(|s| caja_cielo(bsp, s.v3("origin").unwrap(), &apar0));
    let en_cielo = |q: V| cc3.map(|c| q[0] >= c[0] && q[0] <= c[3] && q[1] >= c[1] && q[1] <= c[4] && q[2] >= c[2] && q[2] <= c[5]).unwrap_or(false);
    // la luz horneada: la de rango normal o, si sólo trae la HDR, ésa; sin las luces que arrancan apagadas
    let lit: &[u8] = if !bsp.lump(8).is_empty() { bsp.lump(8) } else { bsp.lump(53) };
    let con_lm = !lit.is_empty();
    let lm_apagado: std::collections::HashSet<i32> = ents.iter().filter(|e| e.cl().starts_with("light") && e.sf() & 1 != 0 && e.n("style") > 0.0).map(|e| e.n("style") as i32).collect();
    let mut lm_r: Vec<Rect> = vec![]; let mut lm_por: HashMap<i32, usize> = HashMap::new();
    let nvt = vt.len() / 12; let vx = |i: usize| [f32a(vt, i * 12), f32a(vt, i * 12 + 4), f32a(vt, i * 12 + 8)];
    let mut mats: HashMap<u32, InfoMat> = HashMap::new();
    let mut info = |i: u32, mats: &mut HashMap<u32, InfoMat>| -> InfoMat { *mats.entry(i).or_insert_with(|| mat(i, tex_nom.get(i as usize).map(|s| s.as_str()).unwrap_or(""))) };
    // los pedazos: por celda de 64 m (dibujo y choque), los del cielo 3D aparte
    let mut ped: Vec<((i32, i32), Pieza)> = vec![]; let mut ped_i: HashMap<(i32, i32), usize> = HashMap::new();
    let mut pedc: Vec<((i32, i32), Pieza)> = vec![]; let mut pedc_i: HashMap<(i32, i32), usize> = HashMap::new();
    fn pedazo<'p>(v: &'p mut Vec<((i32, i32), Pieza)>, idx: &mut HashMap<(i32, i32), usize>, x: f32, z: f32) -> &'p mut Pieza {
        let k = ((x / CELDA).floor() as i32, (z / CELDA).floor() as i32);
        let i = *idx.entry(k).or_insert_with(|| { v.push((k, Pieza::default())); v.len() - 1 }); &mut v[i].1
    }
    let mut agua: Vec<Vec<V>> = vec![];
    // los modelos de bloques: el 0 es el mundo; los demás, de entidades (puertas, paredes), en su lugar
    let nmo = mo.len() / 48; let mut uso = vec![Uso { i: 0, o: [0.0; 3], rot: None, sin_choque: false, sin_dibujo: false, puerta: None, nombre: String::new(), padre: String::new(), pieza: None }];
    const NO_DIBUJO: [&str; 21] = ["trigger_", "func_areaportal", "func_occluder", "func_precipitation", "func_buyzone", "func_bomb_target", "func_hostage_rescue", "func_nobuild", "func_ladderendpoint", "func_dustcloud", "func_smokevolume", "env_", "info_", "func_viscluster", "func_vehicleclip", "func_respawnroom", "func_nogrenades", "func_regenerate", "func_capturezone", "", ""];
    for e in ents {
        let Some(m) = e.s("model").strip_prefix('*').and_then(|x| x.parse::<usize>().ok()) else { continue }; let cl = e.cl();
        if NO_DIBUJO.iter().filter(|p| !p.is_empty()).any(|p| cl.starts_with(p)) { continue; }
        if (cl.starts_with("func_brush") || cl.starts_with("func_wall_toggle")) && e.get("startdisabled") == Some("1") { continue; }
        let no_solido = cl.starts_with("func_illusionary") || cl.starts_with("func_clip_vphysics") || (cl.starts_with("func_brush") && e.get("solidity") == Some("1"));
        let rm = e.get("rendermode"); let invisible = cl.starts_with("func_clip") || rm == Some("10") || (rm.map(|r| !r.is_empty() && r != "0").unwrap_or(false) && e.get("renderamt") == Some("0"));
        let ang = e.v3_0("angles");
        uso.push(Uso { i: m, o: e.v3_0("origin"), rot: if ang.iter().any(|&x| x != 0.0) { Some(ang_mat(ang)) } else { None }, sin_choque: no_solido, sin_dibujo: invisible, puerta: puerta_de(e, cl), nombre: e.s("targetname").to_lowercase(), padre: e.s("parentname").to_lowercase(), pieza: None });
    }
    // (las puertas de bloques van aparte, cada una en su pieza, para poder moverlas)
    let mut piezas: Vec<Pieza> = vec![]; let mut pta_nom: HashMap<String, usize> = HashMap::new();
    for (k, u) in uso.iter_mut().enumerate() { if let Some(p) = &u.puerta { piezas.push(Pieza { tren: p.tren, ..Default::default() }); u.pieza = Some(piezas.len() - 1); if !u.nombre.is_empty() { pta_nom.entry(u.nombre.clone()).or_insert(k); } } }
    for k in 0..uso.len() { if uso[k].puerta.is_none() && !uso[k].padre.is_empty() { if let Some(&d) = pta_nom.get(&uso[k].padre) { uso[k].pieza = uso[d].pieza; } } }
    let nfc = fc.len() / 56; let ndi = di.len() / 176;
    let br = { let (nd, hj, lb, b18, b19) = (bsp.lump(5), bsp.lump(10), bsp.lump(17), bsp.lump(18), bsp.lump(19)); if nd.is_empty() || hj.is_empty() || lb.is_empty() || b18.is_empty() || b19.is_empty() { None } else { Some(Brochas { nd, hj, lb, br: b18, bs: b19, pl, ti, mo, hs: if bsp.lver(10) == 0 { 56 } else { 32 } }) } };
    let (mut n_inv, mut n_tren) = (0u32, 0u32);
    for u in &uso {
        if u.i >= nmo { continue; }
        let ff = i32a(mo, u.i * 48 + 40).max(0) as usize; let nf = i32a(mo, u.i * 48 + 44).max(0) as usize;
        let tr = |p: V| -> V { match u.rot { None => [p[0] + u.o[0], p[1] + u.o[1], p[2] + u.o[2]], Some([f, l, up]) => [u.o[0] + f[0] * p[0] + l[0] * p[1] + up[0] * p[2], u.o[1] + f[1] * p[0] + l[1] * p[1] + up[1] * p[2], u.o[2] + f[2] * p[0] + l[2] * p[1] + up[2] * p[2]] } };
        let tr_n = |n: V| -> V { match u.rot { None => n, Some([f, l, up]) => [f[0] * n[0] + l[0] * n[1] + up[0] * n[2], f[1] * n[0] + l[1] * n[1] + up[1] * n[2], f[2] * n[0] + l[2] * n[1] + up[2] * n[2]] } };
        let tren = u.pieza.map(|i| piezas[i].tren).unwrap_or(false);
        for f in ff..(ff + nf).min(nfc) {
            let o = f * 56; let tix = i16a(fc, o + 10); if tix < 0 || tix as usize * 72 + 72 > ti.len() { continue; } let tix = tix as usize;
            let fl = i32a(ti, tix * 72 + 64); let tdi = i32a(ti, tix * 72 + 68); if fl & (SURF_TRIGGER | SURF_HINT | SURF_SKIP) != 0 { continue; }
            let nom = tex_nom.get(tdi.max(0) as usize).map(|s| s.as_str()).unwrap_or(""); let herr = nom.starts_with("tools/") && !nom.contains("toolsblack");
            let es_agua = fl & SURF_WARP != 0 || es_agua_nom(nom);
            let dibuja = !u.sin_dibujo && fl & (SURF_SKY | SURF_SKY2D | SURF_NODRAW) == 0 && !herr; let choca = !u.sin_choque && !tren;
            if !dibuja && !choca { continue; }
            let (pn, fe, ne, dix) = (u16a(fc, o) as usize, i32a(fc, o + 4), i16a(fc, o + 8), i16a(fc, o + 12));
            let mut poly: Vec<V> = vec![];
            for k in 0..ne.max(0) as i32 { let s = i32a(se, ((fe + k).max(0) as usize) * 4); let vi = if s >= 0 { u16a(ed, s as usize * 4) } else { u16a(ed, (-s) as usize * 4 + 2) } as usize; if vi < nvt { poly.push(vx(vi)); } }
            if poly.len() < 3 { continue; }
            let es_cielo = cc3.is_some() && { let n = poly.len() as f32; let c = poly.iter().fold([0.0; 3], |a, q| [a[0] + q[0], a[1] + q[1], a[2] + q[2]]); en_cielo(tr([c[0] / n, c[1] / n, c[2] / n])) };
            if es_cielo && !dibuja { continue; }
            let choca_c = choca && !es_cielo;
            // hacia dónde mira la cara: la vuelta de sus vértices (en sentido horario vista de frente) contra su plano
            let mut ns = [f32a(pl, pn * 20), f32a(pl, pn * 20 + 4), f32a(pl, pn * 20 + 8)];
            { let mut w = [0f32; 3]; for k in 0..poly.len() { let (p, c) = (poly[k], poly[(k + 1) % poly.len()]); w[0] += (p[1] - c[1]) * (p[2] + c[2]); w[1] += (p[2] - c[2]) * (p[0] + c[0]); w[2] += (p[0] - c[0]) * (p[1] + c[1]); }
              if -(dot(w, ns)) < 0.0 { ns = ns.map(|x| -x); } }
            let ns = tr_n(ns);
            let tv: Vec<f32> = (0..8).map(|k| f32a(ti, tix * 72 + k * 4)).collect(); let [tw, th] = tex_tam.get(tdi.max(0) as usize).copied().unwrap_or([512.0, 512.0]);
            let uv_de = |p: V| [(tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2] + tv[3]) / tw, (tv[4] * p[0] + tv[5] * p[1] + tv[6] * p[2] + tv[7]) / th];
            let im = if dibuja { info(tdi as u32, &mut mats) } else { InfoMat::default() };
            let ng = [ns[1], ns[2], ns[0]];
            // (el agua de Source trae la cara de arriba y la de abajo en el mismo plano: el agua del motor se ve de los dos
            // lados, con la de arriba alcanza; con las dos se pisaban)
            let mi = if dibuja && im.dibuja && !(im.agua && ng[1] < -0.5) { Some(if im.agua { MatRef::Agua } else { MatRef::Tex(tdi as u32) }) } else { None };
            // la luz horneada de la cara: su rectángulo de luxels y dónde cae cada punto (en el espacio del modelo)
            let lm_de: Option<Box<dyn Fn(V) -> (i32, f32, f32)>> = if con_lm && dibuja {
                let (lo, sty, m0, m1, w, h) = (i32a(fc, o + 20), fc[o + 16], i32a(fc, o + 28) as f32, i32a(fc, o + 32) as f32, i32a(fc, o + 36) + 1, i32a(fc, o + 40) + 1);
                let lv: Vec<f32> = (8..16).map(|k| f32a(ti, tix * 72 + k * 4)).collect();
                if lo >= 0 && sty != 255 && fl & SURF_NOLIGHT == 0 && w > 0 && h > 0 && w <= 512 && h <= 512 && lo as usize + (w * h * 4) as usize <= lit.len() {
                    let bump = fl & SURF_BUMP != 0; let blk = (w * h * 4) as usize * if bump { 4 } else { 1 }; let mut offs = vec![];
                    for k in 0..4 { let s = fc[o + 16 + k]; if s == 255 { break; } if !lm_apagado.contains(&(s as i32)) && lo as usize + k * blk + (w * h * 4) as usize <= lit.len() { offs.push(lo as usize + k * blk); } }
                    let r = *lm_por.entry(lo).or_insert_with(|| { lm_r.push(Rect { lo, w: w as u32, h: h as u32, offs }); lm_r.len() - 1 }) as i32;
                    let _ = lm_r[r as usize].lo;
                    let (wf, hf) = ((w - 1) as f32, (h - 1) as f32);
                    Some(Box::new(move |q: V| (r, (lv[0] * q[0] + lv[1] * q[1] + lv[2] * q[2] + lv[3] - m0).clamp(0.0, wf), (lv[4] * q[0] + lv[5] * q[1] + lv[6] * q[2] + lv[7] - m1).clamp(0.0, hf))))
                } else { let r = if fl & SURF_LIGHT != 0 { -2 } else { -1 }; Some(Box::new(move |_| (r, 0.0, 0.0))) }
            } else { None };
            if dix >= 0 && (dix as usize) < ndi && poly.len() == 4 {
                // displacement: la grilla sobre las 4 esquinas, desde la esquina más cerca de su punto de inicio
                let q = dix as usize * 176; let sp = [f32a(di, q), f32a(di, q + 4), f32a(di, q + 8)]; let v0 = i32a(di, q + 12).max(0) as usize; let pw = i32a(di, q + 20).clamp(0, 5); let n = (1usize << pw) + 1;
                let mut i0 = 0; let mut dm = f32::MAX; for (i, p) in poly.iter().enumerate() { let d = (p[0] - sp[0]).powi(2) + (p[1] - sp[1]).powi(2) + (p[2] - sp[2]).powi(2); if d < dm { dm = d; i0 = i; } }
                let c: Vec<V> = (0..4).map(|k| poly[(i0 + k) % 4]).collect(); let lerp = |a: V, b: V, t: f32| [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
                let (mut pts, mut uvs, mut lmv, mut alfa) = (vec![], vec![], vec![], vec![]);
                for i in 0..n { let a0 = lerp(c[0], c[1], i as f32 / (n - 1) as f32); let b0 = lerp(c[3], c[2], i as f32 / (n - 1) as f32);
                    for j in 0..n {
                        let base = lerp(a0, b0, j as f32 / (n - 1) as f32); let w = (v0 + i * n + j) * 20; let mut pp = base;
                        if w + 20 <= dvs.len() { let d = f32a(dvs, w + 12); pp = [base[0] + f32a(dvs, w) * d, base[1] + f32a(dvs, w + 4) * d, base[2] + f32a(dvs, w + 8) * d]; alfa.push(f32a(dvs, w + 16) / 255.0); } else { alfa.push(0.0); }
                        pts.push(gv(tr(pp))); uvs.push(uv_de(base)); if let Some(l) = &lm_de { lmv.push(l(base)); }
                    } }
                let mut tris: Vec<[u32; 3]> = vec![];
                for i in 0..n - 1 { for j in 0..n - 1 { let (a1, b1, c1, d1) = ((i * n + j) as u32, ((i + 1) * n + j) as u32, ((i + 1) * n + j + 1) as u32, (i * n + j + 1) as u32); tris.push([a1, b1, c1]); tris.push([a1, c1, d1]); } }
                let mut nrm = vec![[0f32; 3]; pts.len()];
                for t in tris.iter_mut() {
                    let mut nn = cross(sub(pts[t[1] as usize], pts[t[0] as usize]), sub(pts[t[2] as usize], pts[t[0] as usize]));
                    if dot(nn, ng) < 0.0 { t.swap(1, 2); nn = nn.map(|x| -x); }
                    for &k in t.iter() { for e in 0..3 { nrm[k as usize][e] += nn[e]; } }
                }
                for v in nrm.iter_mut() { let l = dot(*v, *v).sqrt(); let l = if l > 0.0 { l } else { 1.0 }; *v = v.map(|x| x / l); }
                uv_corr(&mut uvs);
                let lmo = if lm_de.is_some() { Some(&lmv) } else { None };
                // (un terreno de dos texturas —WorldVertexTransition—: cada triángulo con la que más pesa; los del borde se cortan
                // justo donde la mezcla vale 0,5)
                let m2 = mi.is_some() && im.segunda && !im.agua;
                if m2 && alfa.iter().any(|&x| x > 0.01) {
                    let (mut t1, mut t2) = (vec![], vec![]); let hi = |k: u32, alfa: &Vec<f32>| alfa[k as usize] >= 0.5;
                    let mut lmv2 = lmv.clone();
                    let mut medio = |i: u32, j: u32, pts: &mut Vec<V>, nrm: &mut Vec<V>, uvs: &mut Vec<[f32; 2]>, alfa: &mut Vec<f32>| -> u32 {
                        let (i, j) = (i as usize, j as usize); let d = alfa[j] - alfa[i]; let t = ((0.5 - alfa[i]) / if d != 0.0 { d } else { 1e-6 }).clamp(0.0, 1.0); let l = |x: f32, y: f32| x + (y - x) * t;
                        let (pi, pj, ni, nj) = (pts[i], pts[j], nrm[i], nrm[j]); let nn = [l(ni[0], nj[0]), l(ni[1], nj[1]), l(ni[2], nj[2])]; let nl = dot(nn, nn).sqrt(); let nl = if nl > 0.0 { nl } else { 1.0 };
                        pts.push([l(pi[0], pj[0]), l(pi[1], pj[1]), l(pi[2], pj[2])]); nrm.push(nn.map(|x| x / nl)); uvs.push([l(uvs[i][0], uvs[j][0]), l(uvs[i][1], uvs[j][1])]);
                        if !lmv2.is_empty() { let (a, b) = (lmv2[i], lmv2[j]); lmv2.push((a.0, l(a.1, b.1), l(a.2, b.2))); }
                        alfa.push(0.5); (pts.len() - 1) as u32
                    };
                    for t in &tris {
                        let h = [hi(t[0], &alfa), hi(t[1], &alfa), hi(t[2], &alfa)]; let n2 = h.iter().filter(|x| **x).count();
                        if n2 == 0 { t1.push(*t); continue; } if n2 == 3 { t2.push(*t); continue; }
                        let k = if n2 == 1 { h.iter().position(|x| *x).unwrap() } else { h.iter().position(|x| !*x).unwrap() };
                        let (sv, o1, o2) = (t[k], t[(k + 1) % 3], t[(k + 2) % 3]);
                        let p1 = medio(sv, o1, &mut pts, &mut nrm, &mut uvs, &mut alfa); let p2 = medio(sv, o2, &mut pts, &mut nrm, &mut uvs, &mut alfa);
                        let (solo, resto) = if h[k] { (&mut t2, &mut t1) } else { (&mut t1, &mut t2) };
                        solo.push([sv, p1, p2]); resto.push([p1, o1, o2]); resto.push([p1, o2, p2]);
                    }
                    let lmo2 = if lm_de.is_some() { Some(lmv2.as_slice()) } else { None };
                    let pza = destino(u.pieza, es_cielo, &pts, &mut piezas, &mut ped, &mut ped_i, &mut pedc, &mut pedc_i);
                    if !t1.is_empty() { pza.cara(&pts, Some(&nrm), Some(&uvs), &t1, mi, true, false, es_agua, lmo2); }
                    if !t2.is_empty() { pza.cara(&pts, Some(&nrm), Some(&uvs), &t2, Some(MatRef::Tex2(tdi as u32)), true, false, es_agua, lmo2); }
                    if choca_c { pza.cara(&pts, None, None, &tris, None, false, true, es_agua, None); }
                } else { let pza = destino(u.pieza, es_cielo, &pts, &mut piezas, &mut ped, &mut ped_i, &mut pedc, &mut pedc_i); pza.cara(&pts, Some(&nrm), Some(&uvs), &tris, mi, dibuja, choca_c, es_agua, lmo.map(|v| v.as_slice())); }
                continue;
            }
            let pts: Vec<V> = poly.iter().map(|p| gv(tr(*p))).collect(); let mut uvs: Vec<[f32; 2]> = poly.iter().map(|p| uv_de(*p)).collect(); let nrm = vec![ng; pts.len()];
            let tris = abanico(&pts, ng);
            uv_corr(&mut uvs);
            let lmv: Option<Vec<(i32, f32, f32)>> = lm_de.as_ref().map(|l| poly.iter().map(|q| l(*q)).collect());
            let pza = destino(u.pieza, es_cielo, &pts, &mut piezas, &mut ped, &mut ped_i, &mut pedc, &mut pedc_i);
            pza.cara(&pts, Some(&nrm), Some(&uvs), &tris, mi, dibuja, choca_c, es_agua, lmv.as_deref());
            if es_agua && dibuja && !es_cielo && ng[1].abs() > 0.9 { agua.push(pts); }
        }
        // las brochas que chocan y no dejaron caras (nodraw, clip, playerclip, invisibles): sus lados, sólo para chocar. En
        // un tren, cada brocha es un casco que se mueve con él
        if let (Some(b), false) = (&br, u.sin_choque) {
            for bi in b.de_modelo(u.i) {
                if b.contenido(bi) & BR_CHOCA == 0 || (!tren && b.con_cara(bi, &tex_nom)) { continue; }
                let ls = b.lados(bi); if ls.len() < 4 { continue; }
                if cc3.is_some() { let (mut s, mut n) = ([0f32; 3], 0.0); for l in &ls { for q in &l.1 { for k in 0..3 { s[k] += q[k]; } n += 1.0; } } if en_cielo(tr([s[0] / n, s[1] / n, s[2] / n])) { continue; } }
                if tren { let h: Vec<V> = ls.iter().flat_map(|l| l.1.iter().map(|q| gv(tr(*q)))).collect(); piezas[u.pieza.unwrap()].h.push(h); n_tren += 1; continue; }
                for (nn, lp) in &ls {
                    let pts: Vec<V> = lp.iter().map(|q| gv(tr(*q))).collect(); let ngg = { let t = tr_n(*nn); [t[1], t[2], t[0]] }; let tris = abanico(&pts, ngg);
                    // (las que sólo frenan al jugador —playerclip— o son rejas: van aparte)
                    if u.pieza.is_none() && b.contenido(bi) & (0x1 | 0x2 | 0x4000) == 0 {
                        let n = pts.len() as f32; let c = pts.iter().fold([0.0; 3], |a, q| [a[0] + q[0], a[1] + q[1], a[2] + q[2]]);
                        let pc = pedazo(&mut ped, &mut ped_i, c[0] / n, c[2] / n); for t in &tris { for &i in t { pc.cc.push(pts[i as usize]); } }
                    } else {
                        let pza = match u.pieza { Some(i) => &mut piezas[i], None => { let n = pts.len() as f32; let c = pts.iter().fold([0.0; 3], |a, q| [a[0] + q[0], a[1] + q[1], a[2] + q[2]]); pedazo(&mut ped, &mut ped_i, c[0] / n, c[2] / n) } };
                        pza.cara(&pts, None, None, &tris, None, false, true, false, None);
                    }
                }
                n_inv += 1;
            }
        }
    }
    a.brochas = (n_inv, n_tren);
    // el atlas de la luz horneada
    a.atlas = if con_lm && !lm_r.is_empty() { atlas_luz(lit, &lm_r, tope_lm) } else { None };
    // las puertas: la malla alrededor de su eje, lo que mide en su espacio y su casco de choque
    for u in &uso {
        let (Some(pi), Some(def)) = (u.pieza, &u.puerta) else { continue };
        let mut p = std::mem::take(&mut piezas[pi]);
        let piv = gv(u.o); let (mut lo, mut hi) = ([1e9f32; 3], [-1e9f32; 3]);
        let caja = |pts: &[V], lo: &mut V, hi: &mut V| for q in pts { for j in 0..3 { let v = q[j] - piv[j]; lo[j] = lo[j].min(v); hi[j] = hi[j].max(v); } };
        caja(&p.p, &mut lo, &mut hi); caja(&p.c, &mut lo, &mut hi);
        // (una puerta que choca con bloques invisibles: su caja de choque es la del modelo de bloques)
        if p.c.len() < 3 && !u.sin_choque && u.i > 0 && u.i < nmo {
            let i = u.i * 48; for c in 0..8 { p.c.push(g(f32a(mo, i + if c & 1 != 0 { 12 } else { 0 }) + u.o[0], f32a(mo, i + 4 + if c & 2 != 0 { 12 } else { 0 }) + u.o[1], f32a(mo, i + 8 + if c & 4 != 0 { 12 } else { 0 }) + u.o[2])); }
            caja(&p.c.clone(), &mut lo, &mut hi);
        }
        for q in p.p.iter_mut() { for j in 0..3 { q[j] -= piv[j]; } }
        // (el casco: hasta 300 puntos repartidos entre todos)
        let r3 = |x: f32| (x * 1000.0).round() / 1000.0;
        let nc = p.c.len(); let paso = (nc as f64 / 300.0).max(1.0); let mut casco = vec![]; let mut q = 0f64;
        while (q as usize) < nc && casco.len() < 300 { let k = q.floor() as usize; casco.push([r3(p.c[k][0] - piv[0]), r3(p.c[k][1] - piv[1]), r3(p.c[k][2] - piv[2])]); q += paso; }
        let cascos: Vec<Vec<V>> = if def.tren { p.h.iter().map(|h| h.iter().map(|v| [r3(v[0] - piv[0]), r3(v[1] - piv[1]), r3(v[2] - piv[2])]).collect()).collect() } else { vec![] };
        if def.tren { casco.clear(); }
        p.c.clear(); p.h.clear();
        a.puertas.push(PuertaBsp { def: def.clone(), piv, pieza: p, casco, cascos, caja: if lo[0] < 1e9 { Some((lo, hi)) } else { None }, padre: u.padre.clone(), solida: !u.sin_choque && !def.pasa, nombre: u.nombre.clone() });
    }
    // los botones y las zonas (trigger_*) que avisan por nombre
    for e in ents {
        let cl = e.cl();
        if cl == "func_button" || cl == "func_rot_button" {
            let (p, i, o, l) = (salidas(e, &|k| k == "onpressed"), salidas(e, &|k| k == "onin"), salidas(e, &|k| k == "onout"), salidas(e, &|k| k == "onuselocked"));
            if p.len() + i.len() + o.len() > 0 { if let Some(c) = caja_mo(mo, e) { a.botones.push(BotonBsp { c, p, i, o, l, tog: e.sf() & 32 != 0, bloq: e.sf() & 2048 != 0, n: e.s("targetname").to_lowercase(), pa: e.s("parentname").to_lowercase() }); } }
        } else if cl == "trigger_multiple" || cl == "trigger_once" {
            let en = salidas(e, &|k| matches!(k, "onstarttouch" | "ontrigger" | "onstarttouchall")); let sa = salidas(e, &|k| matches!(k, "onendtouch" | "onendtouchall"));
            if !en.is_empty() || !sa.is_empty() { if let Some(c) = caja_mo(mo, e) { a.zonas.push(ZonaBsp { c, en, sa, una: cl == "trigger_once", n: e.s("targetname").to_lowercase(), off: e.get("startdisabled") == Some("1") }); } }
        }
    }
    a.botones.truncate(300); a.zonas.truncate(300);
    // los caminos de los trenes (path_track)
    if a.puertas.iter().any(|p| p.def.tren) { for e in ents {
        if e.cl() != "path_track" || e.s("targetname").is_empty() || a.caminos.len() >= 2000 { continue; } let Some(o) = e.v3("origin") else { continue };
        a.caminos.push(CaminoBsp { n: e.s("targetname").to_lowercase(), p: gv(o), sig: e.s("target").to_lowercase(), alt: e.s("altpath").to_lowercase(), sal: salidas(e, &|k| k == "onpass"), vel: e.o("speed", 0.0) * GM_S, sf: e.sf() });
    } }
    // los sonidos del mapa, los relevos y lo que pasa al cargar
    for e in ents {
        let cl = e.cl();
        if cl == "ambient_generic" && !e.s("message").is_empty() && e.get("origin").is_some() && a.io.snd.len() < 200 {
            let sf = e.sf(); let v = match e.get("health") { Some(h) if !h.is_empty() => num(h), _ => 10.0 };
            a.io.snd.push(SonidoBsp { n: e.s("targetname").to_lowercase(), s: e.s("message").into(), v: v.clamp(0.0, 10.0) / 10.0, r: e.o("radius", 1250.0).max(64.0) * GM_S, p: gv(e.v3("origin").unwrap()),
                todo: sf & 1 != 0, ini: sf & 16 == 0, bucle: sf & 32 == 0, tono: e.o("pitch", 100.0).clamp(30.0, 250.0) / 100.0 });
        } else if cl == "logic_relay" && !e.s("targetname").is_empty() { a.io.relay.push((e.s("targetname").to_lowercase(), salidas(e, &|k| k == "ontrigger"), e.get("startdisabled") != Some("1"))); }
        else if cl == "logic_auto" { a.io.auto.extend(salidas(e, &|k| k == "onmapspawn" || k == "onnewgame")); }
    }
    // apariciones (las de GMod, HL2DM, CS:S, TF2…), mirando hacia donde mira la aparición
    const AP: [&str; 7] = ["info_player_start", "info_player_deathmatch", "info_player_combine", "info_player_rebel", "info_player_terrorist", "info_player_counterterrorist", "info_player_teamspawn"];
    for e in ents.iter().filter(|e| (AP.contains(&e.cl()) || e.cl() == "gmod_player_start" || e.cl() == "info_spawnpoint") && e.get("origin").is_some()).take(64) {
        let o = e.v3("origin").unwrap(); a.spawns.push((g(o[0], o[1], o[2] + 16.0), Some(e.v3_0("angles")[1] * RAD)));
    }
    // el sol y la luz ambiente (light_environment)
    let le = ents.iter().find(|e| e.cl() == "light_environment");
    if let Some(le) = le {
        let an = le.v3_0("angles"); let pit = if le.get("pitch").is_some() { le.n("pitch") } else { an[0] }; let pit = if pit == 0.0 || pit.is_nan() { -45.0 } else { pit };
        let f = ang_mat([pit, an[1], 0.0])[0]; let fg = dir_g(f);
        let lz: Vec<f32> = le.get("_light").filter(|s| !s.is_empty()).unwrap_or("255 255 255 200").split_whitespace().map(num).collect(); let l = |k: usize| lz.get(k).copied().unwrap_or(f32::NAN);
        let it = ((if l(3).is_nan() || l(3) == 0.0 { 200.0 } else { l(3) }) / 220.0).clamp(0.4, 1.6).powf(1.0 / 2.2);
        a.sol = Some(([-fg[0], -fg[1], -fg[2]], [l(0) / 255.0 * it, l(1) / 255.0 * it, l(2) / 255.0 * it]));
        let am: Vec<f32> = le.s("_ambient").split_whitespace().map(num).collect();
        if am.len() >= 3 && am.iter().all(|x| x.is_finite()) { let k = (if am.get(3).copied().unwrap_or(0.0) != 0.0 { am[3] } else { 20.0 } / 60.0).clamp(0.25, 1.2); let c = [0, 1, 2].map(|i| (am[i] / 255.0 * k + 0.12).clamp(0.08, 0.9)); a.amb = Some((c, c.map(|x| x * 0.75))); }
    }
    // (sin sol —un interior—: la luz de relleno sale de la media de lo horneado, y sin sombras del sol)
    if let (Some(at), None) = (&a.atlas, le) { let c = at.medio.map(|x| (x.powf(1.0 / 2.2) * 0.85).clamp(0.12, 0.85)); a.amb = Some((c, c.map(|x| x * 0.8))); a.sin_sombra = true; }
    // la niebla (env_fog_controller)
    if let Some(fo) = ents.iter().find(|e| e.cl() == "env_fog_controller" && e.get("fogenable") != Some("0")) {
        if fo.n("fogend") > fo.n("fogstart") { let c: Vec<f32> = fo.get("fogcolor").unwrap_or("200 200 200").split_whitespace().map(|x| num(x) / 255.0).collect();
            let mx = fo.get("fogmaxdensity").map(num).filter(|x| x.is_finite()).map(|x| x.clamp(0.0, 1.0)).unwrap_or(1.0);
            a.niebla = Some(Niebla { fs: fo.n("fogstart") * GM_S, fe: fo.n("fogend") * GM_S, c: [c.first().copied().unwrap_or(0.0), c.get(1).copied().unwrap_or(0.0), c.get(2).copied().unwrap_or(0.0)], max: mx }); }
    }
    // las puertas portal (linked_portal_door)
    for e in ents.iter().filter(|e| e.cl() == "linked_portal_door" && e.get("origin").is_some() && !e.s("targetname").is_empty() && !e.s("partnername").is_empty() && e.get("startactive") != Some("0")).take(64) {
        let o = e.v3("origin").unwrap(); let [f, l, u] = ang_mat(e.v3_0("angles")); let gg = |v: V| [v[1], v[2], v[0]]; let ll = gg(l);
        let d = PortalBsp { n: e.s("targetname").into(), par: e.s("partnername").into(), o: gv(o), f: gg(f), r: [-ll[0], -ll[1], -ll[2]], u: gg(u), w: e.o("width", 64.0) * GM_S, h: e.o("height", 64.0) * GM_S };
        if d.o.iter().all(|x| x.is_finite()) && d.w > 0.0 && d.h > 0.0 { a.portales.push(d); }
    }
    // el cielo 3D: dónde está su cámara, cuánto se agranda, su niebla y hasta dónde llega su sala
    if let (Some(c), Some(s)) = (cc3, skc) {
        let o = s.v3("origin").unwrap(); let sc = s.o("scale", 16.0).max(1.0);
        let fc: Vec<f32> = s.get("fogcolor").unwrap_or("255 255 255").split_whitespace().map(|x| { let v = num(x); (if v.is_finite() { v } else { 0.0 } / 255.0).clamp(0.0, 1.0) }).collect();
        let fog = if s.get("fogenable") == Some("1") && s.n("fogend") > s.n("fogstart") { Some(([fc.first().copied().unwrap_or(1.0), fc.get(1).copied().unwrap_or(1.0), fc.get(2).copied().unwrap_or(1.0)], s.o("fogstart", 0.0) * GM_S / sc, s.o("fogend", 1.0) * GM_S / sc, s.get("fogmaxdensity").map(num).filter(|x| x.is_finite()).map(|x| x.clamp(0.0, 1.0)).unwrap_or(1.0))) } else { None };
        a.cielo3d = Some(Cielo3d { o: gv(o), s: sc, lejos: ((c[3] - c[0]).powi(2) + (c[4] - c[1]).powi(2) + (c[5] - c[2]).powi(2)).sqrt() * GM_S * 1.2 + 10.0, fog });
    }
    let ws = ents.iter().find(|e| e.cl() == "worldspawn");
    a.cielo = ws.and_then(|w| w.get("skyname")).unwrap_or("sky_day01_01").to_lowercase();
    // hasta dónde se ve: lo que mide el mapa (con tope)
    let (mut lo, mut hi) = ([i32::MAX; 2], [i32::MIN; 2]); for (k, _) in &ped { lo = [lo[0].min(k.0), lo[1].min(k.1)]; hi = [hi[0].max(k.0 + 1), hi[1].max(k.1 + 1)]; }
    if lo[0] < i32::MAX { a.lejos = (((hi[0] - lo[0]) as f32).hypot((hi[1] - lo[1]) as f32) * CELDA).clamp(120.0, 1600.0); }
    // el agua: un volumen bajo cada superficie de agua; el fondo, lo más bajo de lo que choca debajo
    // (hasta 600 caras: el mar de un mapa grande viene en cientos; el fondo, mirando sólo los pedazos de al lado)
    for pts in agua.iter().take(600) {
        let (mut x0, mut x1, mut z0, mut z1, mut y) = (1e9f32, -1e9f32, 1e9f32, -1e9f32, 0f32);
        for p in pts { x0 = x0.min(p[0]); x1 = x1.max(p[0]); z0 = z0.min(p[2]); z1 = z1.max(p[2]); y += p[1]; } y /= pts.len() as f32;
        let (ci0, ci1, cj0, cj1) = ((x0 / CELDA).floor() as i32 - 1, (x1 / CELDA).floor() as i32 + 1, (z0 / CELDA).floor() as i32 - 1, (z1 / CELDA).floor() as i32 + 1);
        let mut yb = 1e9f32; for (k, p) in &ped { if k.0 < ci0 || k.0 > ci1 || k.1 < cj0 || k.1 > cj1 { continue; } for c in &p.c { if c[0] >= x0 && c[0] <= x1 && c[2] >= z0 && c[2] <= z1 && c[1] < y - 0.05 && c[1] < yb { yb = c[1]; } } }
        a.aguas.push([x0, if yb < 1e8 { yb } else { y - 4.0 }, z0, x1, y, z1]);
    }
    // (sin apariciones: arriba del primer pedazo que choca)
    if a.spawns.is_empty() { if let Some((_, p)) = ped.iter().find(|(_, p)| p.c.len() >= 3) {
        let (mut mn, mut mx) = ([1e9f32; 3], [-1e9f32; 3]); for q in &p.c { for k in 0..3 { mn[k] = mn[k].min(q[k]); mx[k] = mx[k].max(q[k]); } }
        a.spawns.push(([(mn[0] + mx[0]) / 2.0, mx[1] + 2.0, (mn[2] + mx[2]) / 2.0], None));
    } }
    // los props: los de la sala del cielo 3D van a la maqueta
    for p in props.iter_mut() { if en_cielo(p.o) { p.padre = "\u{1}cielo".into(); } }
    a.props = props;
    a.pedazos = ped.into_iter().filter(|(_, p)| !p.por.is_empty() || p.c.len() >= 3 || p.cc.len() >= 3).collect();
    a.cielo3 = if a.cielo3d.is_some() { pedc.into_iter().map(|x| x.1).filter(|p| !p.por.is_empty()).collect() } else { vec![] };
    a.tex_nom = tex_nom; a.mats = mats;
    a
}
/// (el padre que marca un prop de la maqueta del cielo 3D)
pub const PADRE_CIELO: &str = "\u{1}cielo";

/// las seis caras del cielo 2D de Source pasadas a las caras del cubo del motor (gbspCieloCubo): `leer(sufijo)` da la
/// imagen (ancho, alto, RGBA); la cara que falte, del color medio de las otras. L × L, RGBA
pub fn cielo_cubo(l: u32, leer: &mut dyn FnMut(&str) -> Option<(u32, u32, Vec<u8>)>) -> Option<[Vec<u8>; 6]> {
    let mut c: HashMap<&str, (u32, u32, Vec<u8>)> = HashMap::new(); let mut suma = [0f64; 3]; let mut ns = 0f64;
    for suf in ["rt", "bk", "lf", "ft", "up", "dn"] {
        if let Some(im) = leer(suf) {
            if suf != "up" && suf != "dn" { for p in im.2.chunks_exact(16) { suma[0] += p[0] as f64; suma[1] += p[1] as f64; suma[2] += p[2] as f64; ns += 1.0; } }
            c.insert(suf, im);
        }
    }
    if !c.contains_key("rt") && !c.contains_key("lf") && !c.contains_key("bk") && !c.contains_key("ft") { return None; }
    let medio = suma.map(|x| if ns > 0.0 { (x / ns) as u8 } else { 128 });
    let leer_px = |suf: &str, s: f32, t: f32| -> [u8; 3] {
        let Some((w, h, px)) = c.get(suf) else { return medio };
        let (w, h) = (*w as i32, *h as i32);
        let fil = if suf != "up" && suf != "dn" && h * 2 == w { (1.0 - t) * h as f32 - 0.5 } else { (1.0 - t) / 2.0 * h as f32 - 0.5 }; let col = (s + 1.0) / 2.0 * w as f32 - 0.5;
        let (x0, y0) = (col.floor() as i32, fil.floor() as i32); let (fx, fy) = (col - x0 as f32, fil - y0 as f32);
        let (xx0, yy0) = (x0.clamp(0, w - 1), y0.clamp(0, h - 1)); let (xx1, yy1) = ((xx0 + 1).min(w - 1), (y0 + 1).clamp(0, h - 1));
        let at = |x: i32, y: i32, k: usize| px[((y * w + x) * 4) as usize + k] as f32;
        [0, 1, 2].map(|k| (at(xx0, yy0, k) * (1.0 - fx) * (1.0 - fy) + at(xx1, yy0, k) * fx * (1.0 - fy) + at(xx0, yy1, k) * (1.0 - fx) * fy + at(xx1, yy1, k) * fx * fy) as u8)
    };
    const CUBO: [[V; 3]; 6] = [[[1.0, 0.0, 0.0], [0.0, 0.0, -1.0], [0.0, -1.0, 0.0]], [[-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, -1.0, 0.0]], [[0.0, 1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0]], [[0.0, -1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, -1.0]], [[0.0, 0.0, 1.0], [1.0, 0.0, 0.0], [0.0, -1.0, 0.0]], [[0.0, 0.0, -1.0], [-1.0, 0.0, 0.0], [0.0, -1.0, 0.0]]];
    let caras: Vec<Vec<u8>> = CUBO.iter().map(|[f, r, a]| {
        let mut out = vec![0u8; (l * l * 4) as usize];
        for j in 0..l { for i in 0..l {
            let (u, v) = ((i as f32 + 0.5) / l as f32 * 2.0 - 1.0, (j as f32 + 0.5) / l as f32 * 2.0 - 1.0);
            // (del juego a Source: x = z del juego, y = x, z = y)
            let (x, y, z) = (f[2] + u * r[2] + v * a[2], f[0] + u * r[0] + v * a[0], f[1] + u * r[1] + v * a[1]); let (ax, ay, az) = (x.abs(), y.abs(), z.abs());
            let c = if ax >= ay && ax >= az { if x > 0.0 { leer_px("rt", -y / ax, z / ax) } else { leer_px("lf", y / ax, z / ax) } }
                else if ay >= az { if y > 0.0 { leer_px("bk", x / ay, z / ay) } else { leer_px("ft", -x / ay, z / ay) } }
                else if z > 0.0 { leer_px("up", -y / az, -x / az) } else { leer_px("dn", -x / az, y / az) };
            let o = ((j * l + i) * 4) as usize; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
        } }
        out
    }).collect();
    caras.try_into().ok()
}

#[cfg(test)]
mod prueba {
    use super::*;
    #[test]
    fn entidades_y_salidas() {
        let t = br#"{ "classname" "func_button" "OnPressed" "puerta,Open,,0,-1" "targetname" "b1" "OnPressed" "luz,Toggle,,2,1" }
{ "classname" "worldspawn" "skyname" "sky_day01_05" }"#;
        let e = entidades(t);
        assert_eq!(e.len(), 2); assert_eq!(e[0].cl(), "func_button"); assert_eq!(e[1].s("skyname"), "sky_day01_05");
        let s = salidas(&e[0], &|k| k == "onpressed");
        assert_eq!(s.len(), 2); assert_eq!(s[1], Salida { t: "luz".into(), i: "toggle".into(), v: String::new(), d: 2.0, n: 1 });
    }
    #[test]
    fn cubemaps_y_agua() {
        assert!(es_cubemap("materials/maps/x/c-12_34_-5.vtf")); assert!(es_cubemap("materials/maps/x/c1_2_3.hdr.vtf")); assert!(!es_cubemap("materials/x/cara.vtf"));
        assert!(es_agua_nom("nature/water_canals_water2")); assert!(es_agua_nom("liquids/slime")); assert!(!es_agua_nom("nature/waterfall01"));
    }
    #[test]
    fn angulos() {
        // (yaw 90: adelante de Source es +y → x del juego)
        let q = ang_quat([0.0, 90.0, 0.0]); let v = [0.0f32, 0.0, 1.0];
        let r = { let (x, y, z, w) = (q[0], q[1], q[2], q[3]); let t = [2.0 * (y * v[2] - z * v[1]), 2.0 * (z * v[0] - x * v[2]), 2.0 * (x * v[1] - y * v[0])]; [v[0] + w * t[0] + y * t[2] - z * t[1], v[1] + w * t[1] + z * t[0] - x * t[2], v[2] + w * t[2] + x * t[1] - y * t[0]] };
        assert!((r[0] - 1.0).abs() < 1e-5 && r[2].abs() < 1e-5);
        let q = quat_de([1.0, 0.0, 0.0]); assert!((q[1] - (std::f32::consts::FRAC_PI_4).sin()).abs() < 1e-5);
    }
}
