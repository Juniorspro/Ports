//! Los mapas del Workshop en el juego nativo (gmod_bsp.js, puertas.js, mapaio.js, portales.js, cielo3d.js y dia.js): los
//! .bsp de los addons en la lista de mapas (Ajustes → Mapa, como WS_<nombre>), el mapa armado con el contenido de GMod
//! (materiales, texturas, modelos de los props, la luz horneada, el cielo de seis caras y el cielo 3D), sus choques, las
//! puertas, los trenes, los botones, las zonas, los sonidos del mapa y las puertas portal; y, en todos los mapas, la hora
//! del día (Ajustes → Día). La lógica está en jxjuego (bsp.rs, puertas.rs, portales.rs, dia.rs). Va como hijo de comun.rs.
use super::*;
use jxgmod::formatos as gmf;
use jxjuego::bsp::{self, InfoMat, MatRef, Pieza};
use jxjuego::dia::{Dia, TipoNiebla};
use jxjuego::fisica::{self as fz, Cuerpo, Forma, OpCuerpo};
use jxjuego::mapa::LuzBase;
use jxjuego::portales::Portales;
use jxjuego::puertas::{self as pta, Ev, Jug, PuertaIni, Puertas};
use jxmotor::escena::{Caras, Cielo, ItemDin, Lm, Luz, Malla, Mat, Niebla, FL_CIELO, FL_SIN_SOMBRA};
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::Arc;
/// la gravedad de Source (sv_gravity 600 unidades por segundo²: 15,24 m/s²) sobre la de la Tierra: la de los mapas de Source
pub(crate) const GRAVEDAD_SOURCE: f32 = 600.0 * 0.0254 / 9.81;

/// los números propios de las mallas, materiales y luz horneada de los mapas del Workshop
const ID_WS: i64 = -8_000_000;
const LM_WS: i64 = ID_WS - 1;
const AGUA_WS: i64 = ID_WS - 2;

/// un mapa del Workshop en la lista: su clave (WS_…), el addon y la ruta del .bsp adentro
#[derive(Clone, Debug)]
pub struct WsMapa { pub clave: String, pub addon: PathBuf, pub ruta: String }
/// lo que se mira para «Usar»: una puerta o un botón del mapa
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Usar { Puerta(usize), Boton(usize) }
/// una puerta armada: sus cuerpos de choque (id, centro del casco en su espacio) y lo que se dibuja (en su espacio)
#[derive(Default)]
struct PuertaJ { cuerpos: Vec<(u32, [f64; 3])>, items: Vec<ItemDin> }

#[derive(Default)]
pub struct EnMapas {
    /// los mapas de los addons y los addons ya mirados
    pub ws: Vec<WsMapa>, vistos: Vec<PathBuf>,
    /// las puertas (lógica, cuerpos y dibujo), las puertas portal y lo que se mira para «Usar»
    pub pta: Option<Puertas>, pj: Vec<PuertaJ>, pub por: Portales, pub usar: Option<Usar>, pub usar_txt: Option<&'static str>,
    /// la hora del día: el estado, la luz de base del mapa, su niebla, si es el espacio, cuánto es de noche
    pub dia: Dia, base: Option<LuzBase>, niebla: TipoNiebla, espacio: bool, pub noche: f32, aj_dia: (f32, bool),
    /// el mapa que se vio por última vez (para saber cuándo cambió) y si es un interior sin sombras del sol
    visto: String, pub sin_sombra: bool,
    /// lo armado del último mapa del Workshop (para las pruebas)
    pub info: String,
    /// lo que se dejó armado para el mapa que se está cargando (puertas, portales, niebla)
    pend: Option<(Puertas, Vec<PuertaJ>, Portales, bool, TipoNiebla)>,
}

/// float → medio float (gmF2H)
fn f2h(v: f32) -> u16 {
    let x = v.to_bits(); let s = ((x >> 16) & 0x8000) as u16; let e = ((x >> 23) & 0xff) as i32 - 112; let m = x & 0x7f_ffff;
    if e <= 0 { return s; } if e >= 31 { return s | 0x7bff; }
    let h = ((e as u32) << 10) + ((m + 0x1000) >> 13); s | (if h > 0x7bff { 0x7bff } else { h as u16 })
}
/// la clave de un mapa (gbspClave): WS_ y el nombre sin «maps/» ni «.bsp», sólo letras, números y _, hasta 40
pub fn clave_ws(ruta: &str) -> String {
    let r = ruta.strip_prefix("maps/").unwrap_or(ruta); let r = r.strip_suffix(".bsp").unwrap_or(r);
    format!("WS_{}", r.chars().map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' }).take(40).collect::<String>())
}
/// los .bsp de un addon (un .gma: sólo su índice, sin leer los archivos; una carpeta: maps/*.bsp)
fn bsps_de(ruta: &Path) -> Vec<String> {
    if ruta.is_dir() {
        let Ok(rd) = std::fs::read_dir(ruta.join("maps")) else { return vec![] };
        let mut v: Vec<String> = rd.flatten().filter_map(|e| { let n = e.file_name().to_string_lossy().to_lowercase(); n.ends_with(".bsp").then(|| format!("maps/{n}")) }).collect(); v.sort(); return v;
    }
    use std::io::Read;
    let Ok(f) = std::fs::File::open(ruta) else { return vec![] };
    for tope in [1usize << 20, 16 << 20, usize::MAX] {
        let mut b = vec![]; if f.try_clone().ok().map(|g| g.take(tope as u64).read_to_end(&mut b).is_err()).unwrap_or(true) { return vec![]; }
        if let Some(v) = indice_gma(&b) { return v.into_iter().filter(|n| n.starts_with("maps/") && n.ends_with(".bsp") && !n[5..].contains('/')).collect(); }
        if b.len() < tope { break; }
    }
    vec![]
}
/// los nombres de los archivos de un .gma (como leer_gma de jxgmod, sin los datos); None si el pedazo no alcanza
fn indice_gma(b: &[u8]) -> Option<Vec<String>> {
    if b.len() < 5 || &b[0..4] != b"GMAD" { return None; }
    let ver = b[4]; let mut p = 5 + 16;
    let cad = |p: &mut usize| -> Option<String> { let i = b.get(*p..)?.iter().position(|c| *c == 0)? + *p; let s = String::from_utf8_lossy(&b[*p..i]).into_owned(); *p = i + 1; Some(s) };
    if ver > 1 { while !cad(&mut p)?.is_empty() {} }
    cad(&mut p)?; cad(&mut p)?; cad(&mut p)?; p += 4;
    let mut v = vec![];
    loop { let n = u32::from_le_bytes(b.get(p..p + 4)?.try_into().ok()?); p += 4; if n == 0 { break; } v.push(cad(&mut p)?.to_lowercase().replace('\\', "/")); p += 12; if p > b.len() { return None; } }
    Some(v)
}
/// la malla de una pieza para el motor (gmMallaNueva: 14 bytes por vértice, la UV de la luz aparte, los índices por parte)
pub(super) fn malla_de(id: i64, pz: &Pieza, lm: Option<(&bsp::Atlas, i64)>, mat: &dyn Fn(MatRef) -> Option<i64>, datos: &mut Vec<u8>) -> Option<(Malla, Vec<(u32, u32, i64)>, [f32; 4])> {
    let n = pz.p.len(); if n == 0 { return None; }
    let (mut mn, mut mx) = ([f32::MAX; 3], [f32::MIN; 3]); for v in &pz.p { for k in 0..3 { mn[k] = mn[k].min(v[k]); mx[k] = mx[k].max(v[k]); } }
    let sc = [(mx[0] - mn[0]).max(1e-5), (mx[1] - mn[1]).max(1e-5), (mx[2] - mn[2]).max(1e-5)];
    while datos.len() % 4 != 0 { datos.push(0); }
    let vo = datos.len();
    for i in 0..n {
        for k in 0..3 { datos.extend_from_slice(&((((pz.p[i][k] - mn[k]) / sc[k]).clamp(0.0, 1.0) * 65535.0).round() as u16).to_le_bytes()); }
        let nr = pz.n[i]; datos.extend_from_slice(&[(nr[0] * 127.0) as i8 as u8, (nr[1] * 127.0) as i8 as u8, (nr[2] * 127.0) as i8 as u8, 0]);
        datos.extend_from_slice(&f2h(pz.uv[i][0]).to_le_bytes()); datos.extend_from_slice(&f2h(pz.uv[i][1]).to_le_bytes());
    }
    while datos.len() % 4 != 0 { datos.push(0); }
    let (lo, lm_id) = match lm { Some((a, lid)) => { let o = datos.len(); for u in bsp::lm_uv(pz, a) { for x in u { datos.extend_from_slice(&((x.clamp(0.0, 1.0) * 65535.0).round() as u16).to_le_bytes()); } } (o as i64, lid) } None => (-1, -1) };
    let i32_ = n > 65535; let io = datos.len(); let mut partes = vec![]; let mut ni = 0u32;
    for (mr, ix) in &pz.por { let Some(mt) = mat(*mr) else { continue }; if ix.is_empty() { continue; } partes.push((ni, ix.len() as u32, mt)); for &x in ix { if i32_ { datos.extend_from_slice(&x.to_le_bytes()); } else { datos.extend_from_slice(&(x as u16).to_le_bytes()); } } ni += ix.len() as u32; }
    if ni == 0 { return None; }
    let c = [(mn[0] + mx[0]) / 2.0, (mn[1] + mx[1]) / 2.0, (mn[2] + mx[2]) / 2.0]; let r = (sc[0] * sc[0] + sc[1] * sc[1] + sc[2] * sc[2]).sqrt() / 2.0;
    Some((Malla { id, v: n as u32, mn, sc, i32: i32_ as u8, ni, vo, io, lo, so: -1, lm: lm_id }, partes, [c[0], c[1], c[2], r]))
}
fn punto(m: &M4, p: [f32; 3]) -> [f32; 3] { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
fn escala(m: &M4) -> f32 { [0, 4, 8].iter().map(|&o| (m[o] * m[o] + m[o + 1] * m[o + 1] + m[o + 2] * m[o + 2]).sqrt()).fold(0.0, f32::max) }
/// los puntos (en el espacio del modelo) de cada pieza de choque de un prefab de GMod
fn piezas_fis(pf: &jxjuego::forma::PrefabFisica) -> Vec<(Vec<[f32; 3]>, Vec<Vec<usize>>)> {
    let c = pf.c; let mut out = vec![];
    let mut una = |f: &Forma, p: [f64; 3], q: [f64; 4]| if let Forma::Casco(h) = f { out.push((h.v.iter().map(|v| { let r = fz::rot(q, *v); [(c[0] + p[0] + r[0]) as f32, (c[1] + p[1] + r[1]) as f32, (c[2] + p[2] + r[2]) as f32] }).collect(), h.f.iter().map(|x| x.ix.clone()).collect())); };
    match &*pf.forma { Forma::Compuesta { partes, .. } => for pt in partes { una(&pt.forma, pt.p, pt.q); }, f => una(f, [0.0; 3], fz::QID) }
    out
}
fn hipot3(a: [f32; 3]) -> f32 { (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]).sqrt() }

impl Juego {
    /// cada cuadro: los mapas de los addons a la lista (los nuevos) y los de los apagados fuera
    fn mapas_registrar(&mut self) {
        for a in &self.gmod.addons {
            if !a.prendido || self.mj.vistos.contains(&a.ruta) { continue; }
            self.mj.vistos.push(a.ruta.clone());
            for r in bsps_de(&a.ruta) {
                let k = clave_ws(&r); if self.mj.ws.iter().any(|w| w.clave == k) { continue; }
                self.mj.ws.push(WsMapa { clave: k.clone(), addon: a.ruta.clone(), ruta: r });
                if !self.mapas.contains(&k) { self.mapas.push(k); }
            }
        }
        // (gbspQuitar: los de un addon que se apagó; el que se está jugando queda)
        let apagados: Vec<PathBuf> = self.gmod.addons.iter().filter(|a| !a.prendido).map(|a| a.ruta.clone()).collect();
        if apagados.iter().any(|r| self.mj.vistos.contains(r)) {
            let actual = self.mapas.get(self.mapa_i).cloned().unwrap_or_default();
            let fuera: Vec<String> = self.mj.ws.iter().filter(|w| apagados.contains(&w.addon) && w.clave != actual).map(|w| w.clave.clone()).collect();
            self.mj.ws.retain(|w| !fuera.contains(&w.clave)); self.mapas.retain(|m| !fuera.contains(m));
            self.mapa_i = self.mapas.iter().position(|m| *m == actual).unwrap_or(0);
            self.mj.vistos.retain(|r| !apagados.contains(r) || self.mj.ws.iter().any(|w| w.addon == *r));
        }
    }
    /// el motor se vació para otro mapa: lo armado de los addons ya no está en él, ni lo de este mapa
    pub(crate) fn mapas_vaciado(&mut self) {
        self.gm_olvidar_motor();
        self.mj.pta = None; self.mj.pj.clear(); self.mj.por = Portales::default(); self.mj.usar = None; self.mj.usar_txt = None; self.mj.pend = None; self.mj.sin_sombra = false;
        self.mj.visto.clear();
    }

    /// arma un mapa del Workshop (gbspPreparar + cargarMapa + gbspTrasCargar): todo al motor y a la física
    pub(crate) fn mapa_ws(&mut self, m: &mut Motor3d, nombre: &str) -> Result<Mapa, String> {
        let t0 = Instant::now();
        let w = self.mj.ws.iter().find(|w| w.clave == nombre).cloned().ok_or("mapa no instalado")?;
        self.gmod_asegurar(); self.gmod_montar_ya(&w.addon);
        let b = self.gmod_archivo(&w.ruta).ok_or(format!("falta {}", w.ruta))?;
        let lz = |d: &[u8]| gmod_juego::lzma(d);
        let bs = bsp::Bsp::abrir(&b, &lz)?;
        let ents = bsp::entidades(bs.lump(0));
        // (el zip de adentro: materiales, modelos y sonidos propios del mapa)
        let pak = bsp::pak(bs.lump(40)); let n_pak = pak.len();
        self.gmod_sumar_archivos(pak.into_iter().map(|(k, v)| (k, Rc::from(v.into_boxed_slice()))).collect());
        let props = bsp::props(&bs, &ents, &lz);
        // los materiales del mapa (el de cada textura, una vez): el agua de Source va con el agua del motor
        let mut tex_mat: HashMap<u32, i64> = HashMap::new(); let mut tex2: HashMap<u32, Option<String>> = HashMap::new();
        // (el material del agua del mapa —el primero—: su mapa de normales y su niebla, para el agua de verdad)
        let mut agua_vmt: Option<gmf::AguaVmt> = None;
        let mut armado = {
            let mut f = |i: u32, nom: &str| -> InfoMat {
                let v = self.gm_vmt(nom, &[]);
                // (sin su .vmt —el contenido de HL2 que la web trae de Steam—, el agua se reconoce por el nombre)
                if v.as_ref().map(|v| v.shader.contains("water")).unwrap_or_else(|| bsp::es_agua_nom(nom)) {
                    if agua_vmt.is_none() { agua_vmt = v.as_ref().and_then(|v| v.agua.clone()); }
                    return InfoMat { dibuja: true, agua: true, segunda: false };
                }
                let (id, _) = self.gm_material(m, nom, &[]); tex_mat.insert(i, id);
                let b2 = v.and_then(|v| v.base2); let seg = b2.is_some(); tex2.insert(i, b2);
                InfoMat { dibuja: true, agua: false, segunda: seg }
            };
            bsp::armar(&bs, &ents, props, &mut f, 2048)
        };
        let t_geo = t0.elapsed().as_secs_f32();
        // (la segunda textura de los terrenos de dos —WorldVertexTransition—: su material)
        let mut mats: Vec<Mat> = vec![]; let mut sig = 10i64; let mut mat2: HashMap<u32, i64> = HashMap::new();
        let todas: Vec<&Pieza> = armado.pedazos.iter().map(|x| &x.1).chain(armado.cielo3.iter()).chain(armado.puertas.iter().map(|d| &d.pieza)).collect();
        let usados2: std::collections::BTreeSet<u32> = todas.iter().flat_map(|p| p.por.iter().filter_map(|x| if let MatRef::Tex2(i) = x.0 { Some(i) } else { None })).collect();
        let hay_agua = todas.iter().any(|p| p.por.iter().any(|x| x.0 == MatRef::Agua));
        for i in usados2 { if let Some(Some(b2)) = tex2.get(&i) { let t = self.gm_textura(m, b2).map(|x| x.0).unwrap_or(-1); sig += 1; let id = ID_WS - sig; mats.push(Mat { ti: [0.0; 12], pbr: [0.75, 0.0, 0.04], fol: 0, id, t2: -1, terr: None, c: [1.0; 4], st: [1.0, 1.0, 0.0, 0.0], t, blend: 0, cut: 0, unlit: 0, add: 0, agua: 0, em: [0.0; 3] }); mat2.insert(i, id); } }
        if hay_agua { mats.push(Mat { ti: [0.0; 12], pbr: jxjuego::mapa::pbr_de("GM_agua"), fol: 0, id: AGUA_WS, t2: -1, terr: None, c: [0.22, 0.36, 0.42, 0.72], st: [1.0, 1.0, 0.0, 0.0], t: -1, blend: 1, cut: 0, unlit: 0, add: 0, agua: 1, em: [0.0; 3] }); }
        let mat_de = |r: MatRef| -> Option<i64> { match r { MatRef::Tex(i) => tex_mat.get(&i).copied(), MatRef::Tex2(i) => mat2.get(&i).copied().or_else(|| tex_mat.get(&i).copied()), MatRef::Agua => Some(AGUA_WS) } };
        // las mallas del mundo (un pedazo de 64 m cada una) con su luz horneada, y lo que choca
        let mut datos: Vec<u8> = vec![]; let mut mallas = vec![]; let mut items = vec![]; let mut lms = vec![];
        let lm = armado.atlas.as_ref().map(|a| (a, LM_WS));
        if let Some(a) = &armado.atlas { while datos.len() % 4 != 0 { datos.push(0); } let o = datos.len(); datos.extend_from_slice(&a.px); lms.push(Lm { id: LM_WS, w: a.w, h: a.h, o }); }
        let mut nm = 100i64;
        let mut tris: Vec<f32> = vec![]; let (mut lo, mut hi) = ([1e9f32; 3], [-1e9f32; 3]);
        let mut chocar = |pts: &[[f32; 3]], tris: &mut Vec<f32>| for t in pts.chunks_exact(3) { if jxjuego::mapa::tri_fino(t[0], t[1], t[2]) { continue; } for p in t { tris.extend_from_slice(p); for k in 0..3 { lo[k] = lo[k].min(p[k]); hi[k] = hi[k].max(p[k]); } } };
        for (_, p) in &armado.pedazos {
            if let Some((ml, partes, esf)) = malla_de(ID_WS - nm, p, lm, &mat_de, &mut datos) { nm += 1; for (s0, sn, mat) in partes { items.push(ItemDin { m: ml.id, s0, sn, mat, mm: m4::id(), esf, fl: 0, h: vec![] }); } mallas.push(ml); }
            chocar(&p.c, &mut tris); chocar(&p.cc, &mut tris);
        }
        // el cielo 3D: la maqueta agrandada alrededor de su cámara (lo mismo que mirarla desde la cámara del cielo más lo que
        // se movió el jugador dividido por la escala), sin sombra y detrás de todo (FL_CIELO: el motor la dibuja primero y borra
        // la profundidad)
        let c3 = armado.cielo3d.clone();
        let m_cielo = c3.as_ref().map(|c| { let s = c.s; [s, 0.0, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, 0.0, s, 0.0, -s * c.o[0], -s * c.o[1], -s * c.o[2], 1.0] });
        let mut lejos_cielo = 0f32;
        if let Some(mc) = m_cielo { for p in &armado.cielo3 { if let Some((ml, partes, esf)) = malla_de(ID_WS - nm, p, lm, &mat_de, &mut datos) { nm += 1;
            let cc = punto(&mc, [esf[0], esf[1], esf[2]]); let r = esf[3] * escala(&mc); lejos_cielo = lejos_cielo.max(hipot3(cc) + r);
            for (s0, sn, mat) in partes { items.push(ItemDin { m: ml.id, s0, sn, mat, mm: mc, esf: [cc[0], cc[1], cc[2], r], fl: FL_SIN_SOMBRA | FL_CIELO, h: vec![] }); } mallas.push(ml); } } }
        // las puertas de bloques: su pieza alrededor de su eje
        let mut ini: Vec<PuertaIni> = vec![]; let mut pj: Vec<PuertaJ> = vec![]; let mut cascos: Vec<Vec<[f32; 3]>> = vec![]; let mut cascos_t: Vec<Vec<Vec<[f32; 3]>>> = vec![]; let mut solida = vec![]; let mut hijos = vec![];
        let mut por_nombre: HashMap<String, usize> = HashMap::new();
        for d in &armado.puertas {
            let mut x = PuertaJ::default();
            if let Some((ml, partes, esf)) = malla_de(ID_WS - nm, &d.pieza, lm, &mat_de, &mut datos) { nm += 1; for (s0, sn, mat) in partes { x.items.push(ItemDin { m: ml.id, s0, sn, mat, mm: m4::id(), esf, fl: 0, h: vec![] }); } mallas.push(ml); }
            if !d.nombre.is_empty() { por_nombre.entry(d.nombre.clone()).or_insert(pj.len()); }
            ini.push(PuertaIni { def: d.def.clone(), piv: d.piv, q0: [0.0, 0.0, 0.0, 1.0], caja: d.caja, casco: d.casco.clone(), padre: d.padre.clone() });
            cascos.push(d.casco.clone()); cascos_t.push(d.cascos.clone()); solida.push(d.solida); hijos.push(0usize); pj.push(x);
        }
        // los props: los estáticos (con sus cascos de choque), los de la maqueta del cielo, los sueltos, las puertas de
        // modelo y los pegados a una puerta
        let (mut n_props, mut n_falta, mut fisicos) = (0, 0, vec![]); let n_mundo = tris.len() / 9; let n_dib = armado.pedazos.iter().filter(|(_, p)| !p.por.is_empty()).count(); let mut faltan: Vec<String> = vec![];
        let props = std::mem::take(&mut armado.props);
        for pr in &props {
            let Some(md) = self.gm_modelo(m, &pr.modelo) else { n_falta += 1; if faltan.len() < 8 && !faltan.contains(&pr.modelo) { faltan.push(pr.modelo.clone()); } continue };
            let pos = bsp::g(pr.o[0], pr.o[1], pr.o[2]); let q = bsp::ang_quat(pr.a); let es = pr.esc;
            let mm = jxjuego::mapa::trs(pos, q, [es; 3]);
            let poner = |mm: &M4, fl: u32, out: &mut Vec<ItemDin>| for qm in &md.quieto { let cc = punto(mm, [qm.esf[0], qm.esf[1], qm.esf[2]]); let r = qm.esf[3] * escala(mm); for &(s0, sn, mat) in &qm.partes { out.push(ItemDin { m: qm.m, s0, sn, mat, mm: *mm, esf: [cc[0], cc[1], cc[2], r], fl, h: vec![] }); } };
            if pr.padre == bsp::PADRE_CIELO { if let Some(mc) = m_cielo { let w = m4::mul(&mc, &mm); poner(&w, FL_SIN_SOMBRA | FL_CIELO, &mut items); } continue; }
            if pr.fisico { if fisicos.len() < 300 { fisicos.push((pr.modelo.clone(), pos, q)); } continue; }
            let fis_pts: Vec<(Vec<[f32; 3]>, Vec<Vec<usize>>)> = md.fis.as_ref().map(|f| piezas_fis(f)).unwrap_or_default();
            let padre = if !pr.padre.is_empty() && pr.puerta.is_none() { por_nombre.get(&pr.padre).copied() } else { None };
            if let Some(di) = padre {
                // (en el espacio de la puerta: su eje es el origen)
                let piv = ini[di].piv; let lp = [pos[0] - piv[0], pos[1] - piv[1], pos[2] - piv[2]]; let lm4 = jxjuego::mapa::trs(lp, q, [es; 3]);
                poner(&lm4, 0, &mut pj[di].items); hijos[di] += 1;
                if pr.solido {
                    let r3 = |x: f32| (x * 1000.0).round() / 1000.0; let ptl = |v: [f32; 3]| { let r = pta::q_rot(q, v); [r3(r[0] * es + lp[0]), r3(r[1] * es + lp[1]), r3(r[2] * es + lp[2])] };
                    if ini[di].def.tren { for (pts, _) in &fis_pts { let h: Vec<[f32; 3]> = pts.iter().take(200).map(|v| ptl(*v)).collect(); if h.len() >= 4 { cascos_t[di].push(h); } } }
                    else {
                        let n0 = cascos[di].len();
                        for (pts, _) in &fis_pts { let paso = (pts.len() as f32 / 120.0).max(1.0); let mut t = 0f32; while (t as usize) < pts.len() && cascos[di].len() < 500 { cascos[di].push(ptl(pts[t as usize])); t += paso; } }
                        if cascos[di].len() == n0 { let c = md.caja; for i in 0..8 { cascos[di].push(ptl([if i & 1 != 0 { c[3] } else { c[0] }, if i & 2 != 0 { c[4] } else { c[1] }, if i & 4 != 0 { c[5] } else { c[2] }])); } }
                    }
                }
                continue;
            }
            if let Some(def) = &pr.puerta {
                // (su choque: los cascos de su .phy en el espacio del modelo; la puerta los gira con ella)
                let casco: Vec<[f32; 3]> = fis_pts.iter().flat_map(|(p, _)| p.iter().map(|v| [v[0] * es, v[1] * es, v[2] * es])).take(300).collect();
                let mut x = PuertaJ::default(); poner(&jxjuego::mapa::trs([0.0; 3], [0.0, 0.0, 0.0, 1.0], [es; 3]), 0, &mut x.items);
                ini.push(PuertaIni { def: def.clone(), piv: pos, q0: q, caja: None, casco: casco.clone(), padre: String::new() });
                cascos.push(casco); cascos_t.push(vec![]); solida.push(true); hijos.push(1); pj.push(x);
                continue;
            }
            poner(&mm, 0, &mut items); n_props += 1;
            if !pr.solido { continue; }
            // (choque: sus cascos del .phy, ya puestos en su lugar, como triángulos del mapa)
            for (pts, caras) in &fis_pts {
                let w: Vec<[f32; 3]> = pts.iter().map(|v| punto(&mm, *v)).collect();
                for c in caras { for k in 1..c.len().saturating_sub(1) { chocar(&[w[c[0]], w[c[k]], w[c[k + 1]]], &mut tris); } }
            }
        }
        // (las puertas que quedan: con algo que dibujar, o un tren con cascos)
        let mut quedan = vec![];
        for i in 0..ini.len() {
            let d = &mut ini[i]; let tiene = !pj[i].items.is_empty();
            if d.def.tren { solida[i] = solida[i] && !cascos_t[i].is_empty(); if tiene || !cascos_t[i].is_empty() { quedan.push(i); } continue; }
            if tiene { if d.caja.is_none() && hijos[i] > 0 && i < armado.puertas.len() { solida[i] = solida[i] && cascos[i].len() >= 4; } d.casco = cascos[i].clone(); quedan.push(i); }
        }
        // (en el orden de la web: primero las de modelo, después las de bloques)
        quedan.sort_by_key(|&i| i < armado.puertas.len());
        // sus cuerpos de choque (fijos: se mueven a mano)
        let mut ini2 = vec![]; let mut pj2 = vec![]; let mut centros = vec![];
        for i in quedan {
            let mut x = std::mem::take(&mut pj[i]); let d = &ini[i]; let mut cen = [0.0f32; 3];
            let mut cuerpo = |pts: &[[f32; 3]], x: &mut PuertaJ| -> Option<[f64; 3]> {
                if pts.len() < 4 { return None; }
                let p64: Vec<[f64; 3]> = pts.iter().map(|v| [v[0] as f64, v[1] as f64, v[2] as f64]).collect(); let (h, c, _) = jxjuego::forma::casco_de_puntos(&p64, false);
                let mut b = Cuerpo::nuevo(Arc::new(Forma::Casco(h)), 0.0, OpCuerpo::default()); let r = fz::rot([d.q0[0] as f64, d.q0[1] as f64, d.q0[2] as f64, d.q0[3] as f64], c);
                b.pos = [d.piv[0] as f64 + r[0], d.piv[1] as f64 + r[1], d.piv[2] as f64 + r[2]]; b.q = [d.q0[0] as f64, d.q0[1] as f64, d.q0[2] as f64, d.q0[3] as f64];
                let id = self.fis.agregar(b); x.cuerpos.push((id, c)); Some(c)
            };
            if solida[i] { if d.def.tren { for h in &cascos_t[i] { if let Some(c) = cuerpo(h, &mut x) { if cen == [0.0; 3] { cen = [c[0] as f32, c[1] as f32, c[2] as f32]; } } } } else if let Some(c) = cuerpo(&cascos[i], &mut x) { cen = [c[0] as f32, c[1] as f32, c[2] as f32]; } }
            centros.push(cen); pj2.push(x);
            ini2.push(PuertaIni { def: ini[i].def.clone(), piv: ini[i].piv, q0: ini[i].q0, caja: ini[i].caja, casco: std::mem::take(&mut ini[i].casco), padre: ini[i].padre.clone() });
        }
        let mut puertas = Puertas::nuevo(ini2, &armado.botones, &armado.zonas, &armado.caminos, &armado.io);
        for (i, d) in puertas.l.iter_mut().enumerate() { d.c = centros[i]; d.con_cuerpo = !pj2[i].cuerpos.is_empty(); }
        for i in 0..puertas.l.len() { puertas.poner(i); }
        // los props sueltos del mapa (prop_physics)
        let mut n_fis = 0;
        for (r, p, q) in fisicos { if self.mapas_suelto(m, &r, p, q) { n_fis += 1; } }
        // el cielo 2D (sus seis caras al cubo) y su color (el promedio de las caras de su caja)
        let cielo_n = armado.cielo.clone(); let lc = 512u32;
        let leer_cara = |me: &Juego, suf: &str, l: usize| -> Option<(u32, u32, Vec<u8>)> {
            let v = me.gm_vmt(&format!("skybox/{cielo_n}{suf}"), &[]);
            let tb = v.and_then(|v| v.base).and_then(|b| me.gmod_archivo(&format!("materials/{b}.vtf"))).or_else(|| me.gmod_archivo(&format!("materials/skybox/{cielo_n}{suf}.vtf")))?;
            let t = jxgmod::formatos::vtf(&tb, l).ok()?; Some((t.w as u32, t.h as u32, jxgmod::formatos::vtf_rgba(&t)))
        };
        let cubo = if cielo_n != "painted" { bsp::cielo_cubo(lc, &mut |s| leer_cara(self, s, lc as usize)) } else { None };
        let pintado = cubo.is_none();
        let (cl, caras) = match cubo { Some(c) => (lc, c), None => (64, jxjuego::mapa::cielo_painted(64)) };
        let media = |suf: &str| -> Option<[f32; 3]> { let (_, _, px) = leer_cara(self, suf, 16)?; let n = (px.len() / 4).max(1) as f32; let mut s = [0f32; 3]; for p in px.chunks_exact(4) { for k in 0..3 { s[k] += p[k] as f32; } } Some(s.map(|x| x / n / 255.0)) };
        let (mut up, mut dn) = (media("up"), media("dn")); let lados: Vec<[f32; 3]> = ["ft", "bk", "lf", "rt"].iter().filter_map(|s| media(s)).collect();
        let mut mid = if lados.is_empty() { None } else { Some([0, 1, 2].map(|k| lados.iter().map(|x| x[k]).sum::<f32>() / lados.len() as f32)) };
        if cielo_n == "painted" || (up.is_none() && mid.is_none() && pintado) { up = Some([126.0 / 255.0, 189.0 / 255.0, 1.0]); mid = Some([244.0 / 255.0, 246.0 / 255.0, 244.0 / 255.0]); dn = up; }
        let (top, mid, bot) = if up.is_some() || mid.is_some() { (up.or(mid).unwrap(), mid.or(up).unwrap(), dn.or(mid).or(up).unwrap()) } else { ([0.28, 0.64, 1.0], [0.92, 0.92, 0.92], [0.53, 0.58, 0.68]) };
        let o_caras: Vec<usize> = caras.iter().map(|c| { while datos.len() % 4 != 0 { datos.push(0); } let o = datos.len(); datos.extend_from_slice(c); o }).collect();
        let cielo = Cielo { top, mid, bot, exp: [0.8, 1.0], tinte: [1.0; 3], dia: 1.0, k: 1.0, cubo: 1, caras: Some(Caras { l: cl, o: o_caras }) };
        // la luz (cargarMapa): el sol, el relleno (el de Source, o como el cielo de Unity), la niebla del mapa
        let (sol, sol_col) = armado.sol.unwrap_or(([0.3, 0.8, 0.2], [1.0, 0.96, 0.9]));
        let (amb_s, amb_g) = armado.amb.unwrap_or(([0, 1, 2].map(|k| (top[k] * 0.4 + mid[k] * 0.6) * 0.72), [0, 1, 2].map(|k| (mid[k] * 0.45 + bot[k] * 0.3) * 0.62)));
        let lejos = 750f32.max(armado.lejos);
        if lo[0] > hi[0] { lo = [0.0; 3]; hi = [0.0; 3]; }
        let nie = match armado.niebla { Some(f) if f.fe > f.fs => {
                let diag = ((hi[0] - lo[0]).powi(2) + (hi[2] - lo[2]).powi(2)).sqrt();
                let (a, b) = if lejos >= diag { (f.fs, f.fe) } else { (f.fs.min(lejos * 0.5), f.fe.min(lejos)) };
                Niebla { c: f.c, a, b, m: f.max, s: [0.0; 3] } }
            _ => Niebla { c: mid, a: lejos * 0.7, b: lejos, m: 1.0, s: [0.0; 3] } };
        let base = LuzBase { sol, sol_col, amb_s, amb_g, nie, cielo: Cielo { caras: None, ..cielo.clone() } };
        let luz: Luz = jxjuego::mapa::luz_lineal(&base, 1.0);
        let n_tris = tris.len() / 9;
        // (la gravedad de Source —sv_gravity 600 unidades/s², 15,2 m/s²—: en sus mapas todo cae, salta y rueda como allá)
        let mundo = jxjuego::mundo::Mundo::nuevo(tris, vec![], GRAVEDAD_SOURCE);
        let aguas = armado.aguas.clone();
        let (mut agua, agua_y) = jxjuego::mapa::agua_hl2(&aguas, &mundo, &mut datos);
        // el agua de verdad: el mapa de normales animado de su material (el .vtf de Valve, todos sus cuadros, uno abajo del
        // otro) y su niebla ($fogcolor, $fogend); si no está, el agua de HL2 hecha acá
        if let (Some(a), Some(av)) = (agua.as_mut(), agua_vmt.as_ref()) {
            if let Some(b) = av.normal.as_ref().and_then(|n| self.gmod_archivo(&format!("materials/{n}.vtf"))) {
                if let Ok(cs) = gmf::vtf_cuadros(&b, 256) {
                    let cs: Vec<_> = cs.into_iter().take(64).collect();
                    if let Some(c0) = cs.first() { if c0.w == c0.h && c0.w >= 16 {
                        while datos.len() % 4 != 0 { datos.push(0); } let o = datos.len();
                        for c in &cs { datos.extend_from_slice(&gmf::vtf_rgba(c)); }
                        a.normal = Some(jxmotor::escena::TexAgua { w: c0.w as u32, h: c0.h as u32, o, n: cs.len() as u32 });
                        // (el agua de Source con lo de su material: lo que corre la imagen —$reflectamount, $refractamount— y el
                        // mosaico de 64 unidades)
                        if cs.len() > 1 { a.fuente = 1; a.esc = 1.0 / (64.0 * 0.0254); a.s = [0.0354, 0.0354, 0.0, 0.0];
                            if av.reflejo > 0.0 { a.dist = av.reflejo.min(4.0) * 0.16; } if av.refraccion > 0.0 { a.refr = av.refraccion.min(5.0) * 0.16; } }
                    } }
                }
            }
            if let Some(c) = av.niebla { let lin = |x: f32| if x <= 0.04045 { x / 12.92 } else { ((x + 0.055) / 1.055).powf(2.4) }; a.fog[0] = lin(c[0]); a.fog[1] = lin(c[1]); a.fog[2] = lin(c[2]); }
            if let Some(fin) = av.niebla_fin.filter(|f| *f > 1.0) { a.fog[3] = (1.05 - fin / 1500.0).clamp(0.55, 0.92); a.largo = if a.fuente == 1 { (fin * 0.0254).max(0.5) } else { (fin * 0.0254 / 2.5).max(1.5) }; }
        }
        let cab = Cabecera { mapa: nombre.to_string(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs: vec![], lms, items: vec![], agua, cielo: Some(cielo) };
        let n_items = items.len();
        self.mj.info = format!("{}: {:.1} MB, {} pedazos ({} con dibujo, {} triángulos del mundo; faltan {:?}), {} puertas, {} botones, {} zonas, {} sonidos, {} props ({} sin modelo, {} sueltos), {} triángulos de choque, {} brochas invisibles, luz {}, cielo {} ({}), cielo 3D {}, {} portales, {} del zip, {} cosas; {:.2} s (geometría {:.2} s)",
            nombre, b.len() as f64 / 1e6, armado.pedazos.len(), n_dib, n_mundo, faltan, puertas.l.len(), puertas.bot.len(), puertas.zona.len(), puertas.snd.len(), n_props, n_falta, n_fis, n_tris, armado.brochas.0,
            armado.atlas.as_ref().map(|a| format!("{}×{} (÷{})", a.w, a.h, a.f)).unwrap_or("no".into()), cielo_n, if pintado { "pintado" } else { "caras" }, if c3.is_some() { "sí" } else { "no" }, armado.portales.len(), n_pak, n_items, t0.elapsed().as_secs_f32(), t_geo);
        let por = Portales::nuevo(&armado.portales);
        self.mj.pend = Some((puertas, pj2, por, armado.sin_sombra, if armado.niebla.is_some() { TipoNiebla::Lineal } else { TipoNiebla::Cielo }));
        Ok(Mapa { nombre: nombre.to_string(), esc: Escena { c: cab, datos }, items, luz, luces: vec![], spawns: armado.spawns.clone(), mundo, agua_y, aguas, lejos: lejos.max(lejos_cielo.min(6000.0)), base })
    }
    /// un prop suelto del mapa (prop_physics): un objeto con su forma del .phy, como los de los addons
    fn mapas_suelto(&mut self, m: &mut Motor3d, ruta: &str, pos: [f32; 3], q: [f32; 4]) -> bool {
        let Some(md) = self.gm_modelo(m, ruta) else { return false }; let Some(pfz) = md.fis.clone() else { return false };
        let nombre = format!("gm:{ruta}"); let id_obj = self.sig_id; self.sig_id += 1;
        let b = jxjuego::forma::cuerpo_de_prefab(&pfz, [pos[0] as f64, pos[1] as f64, pos[2] as f64], [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64], true);
        let (bp, bq) = ([b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32], [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]);
        let masa = b.masa as f32; let id = self.fis.agregar(b); self.aguas.registrar(id, Flota::de_prefab(&pfz));
        self.objs.push(Obj { nombre, pos: bp, q: bq, c: [pfz.c[0] as f32, pfz.c[1] as f32, pfz.c[2] as f32], cuerpo: Some(id), cap_inv: [0.0, 0.0, 0.0, 1.0], ant: (bp, bq), masa, id: id_obj, logica: None, log_base: None, tipo: "prop", vida: 0.0, exploto: false });
        true
    }

    /// cada cuadro: la lista de mapas, la hora del día, las puertas, los trenes, lo del mapa, los portales y qué se mira
    pub(crate) unsafe fn mapas_cuadro(&mut self, m: &mut Motor3d, dt: f32) {
        self.mapas_registrar();
        let Some(nom) = self.mapa.as_ref().map(|mp| mp.nombre.clone()) else { return };
        if nom != self.mj.visto {
            // otro mapa: lo que dejó armado (si es del Workshop) y la luz de base para la hora del día
            self.mj.visto = nom.clone();
            let (niebla, espacio) = match self.mj.pend.take() {
                Some((p, pj, por, ss, nt)) => { self.mj.pta = Some(p); self.mj.pj = pj; self.mj.por = por; self.mj.sin_sombra = ss; (nt, false) }
                None => { let aj = self.paq.as_ref().map(|p| p.d["aj"][nom.as_str()].clone()).unwrap_or_default(); let f = |k: &str| aj[k].as_f64().unwrap_or(0.0);
                    (if aj["fog"].as_i64().unwrap_or(0) != 0 && f("fd") > 0.0 { TipoNiebla::Exp } else if aj["fog"].as_i64().unwrap_or(0) != 0 && aj["fm"].as_i64() == Some(1) && f("fe") > f("fs") { TipoNiebla::Lineal } else { TipoNiebla::Cielo }, nom == "Space" || !aj["espacio"].is_null() && aj["espacio"].as_bool() != Some(false)) }
            };
            self.mj.niebla = niebla; self.mj.espacio = espacio; self.mj.base = self.mapa.as_ref().map(|mp| mp.base.clone()); self.mj.dia.aplicada = -1.0;
        }
        // la hora del día (la de Ajustes → Día, y si avanza sola)
        if (self.aj.hora, self.aj.ciclo) != self.mj.aj_dia { if self.aj.hora != self.mj.aj_dia.0 || self.mj.dia.aplicada < 0.0 { self.mj.dia.hora = self.aj.hora; } self.mj.aj_dia = (self.aj.hora, self.aj.ciclo); self.mj.dia.ciclo = self.aj.ciclo; self.mj.dia.aplicada = -1.0; }
        if self.ajustes.is_none() && self.mj.dia.paso(dt) || self.mj.dia.aplicada < 0.0 {
            if let Some(b) = self.mj.base.clone() {
                let a = self.mj.dia.aplicar(&b, self.mj.niebla, self.mj.espacio); self.mj.noche = a.noche;
                let luz = jxjuego::mapa::luz_lineal(&a.base, a.expo_k);
                if let Some(mp) = self.mapa.as_mut() { mp.luz = luz; }
                self.ef.luz_de(&luz);
                let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![], lms: vec![], items: vec![], agua: None, cielo: Some(a.base.cielo) };
                let _ = m.cargar(&Escena { c: cab, datos: vec![] });
            }
        }
        if self.mj.sin_sombra { let mut o = self.aj.opciones(); o.sombras = false; m.opciones(&o); }
        if self.ajustes.is_some() { self.mj.usar = None; self.mj.usar_txt = None; return; }
        // las puertas, los trenes y lo del mapa
        let jug = Jug { pos: self.jug.pos, radio: self.jug.radio, vivo: self.jug.vida > 0.0, noclip: self.jug.noclip, cam: self.ojos_ult };
        if let Some(mut p) = self.mj.pta.take() {
            let cuerpos: Vec<Vec<u32>> = self.mj.pj.iter().map(|x| x.cuerpos.iter().map(|c| c.0).collect()).collect();
            let (fis, jp, r) = (&self.fis, self.jug.pos, self.jug.radio as f64);
            let mut toca = |i: usize, marg: f32| cuerpos[i].iter().any(|&id| [-0.5f32, 0.0, 0.5].iter().any(|dy| fis.empuje(id, 0, [jp[0] as f64, (jp[1] + dy) as f64, jp[2] as f64], r + marg as f64).is_some()));
            p.paso(dt, &jug, &mut toca);
            // (el tren donde está parado el jugador lo lleva)
            let pisa = if p.l.iter().any(|d| d.def.tren) && self.jug.suelo {
                self.mapa.as_ref().and_then(|mp| self.fis.rayo(&mp.mundo, [jp[0] as f64, (jp[1] - self.jug.medio) as f64, jp[2] as f64], [0.0, -1.0, 0.0], (self.jug.radio + 0.35) as f64, &[]))
                    .and_then(|g| g.cuerpo).and_then(|id| cuerpos.iter().position(|c| c.contains(&id)))
            } else { None };
            let mov = p.trenes_paso(dt, pisa, &jug);
            if mov != [0.0; 3] && self.vehs.jugador.is_none() { for k in 0..3 { self.jug.pos[k] += mov[k]; } }
            // (los cuerpos de choque, donde quedó cada puerta)
            for i in 0..p.l.len() { if !p.l[i].sucio { continue; } p.l[i].sucio = false; for &(id, c) in &self.mj.pj[i].cuerpos { let (pp, q) = p.pos_cuerpo(i, [c[0] as f32, c[1] as f32, c[2] as f32]); self.fis.poner(id, [pp[0] as f64, pp[1] as f64, pp[2] as f64], [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64]); } }
            for e in std::mem::take(&mut p.ev) { self.mapas_evento(e); }
            self.mj.pta = Some(p);
        }
        // las puertas portal (en un vehículo no: el addon lleva a las personas)
        if let Some((np, nv, ny)) = self.mj.por.paso(self.jug.pos, self.jug.vel, self.jug.yaw, self.vehs.jugador.is_some() || self.jug.vida <= 0.0) { self.jug.pos = np; self.jug.vel = nv; self.jug.yaw = ny; }
        // lo que se mira para «Usar» (hasta 2,6 m, desde los ojos; un botón, sin atravesar paredes)
        self.mj.usar = None; self.mj.usar_txt = None;
        if let (Some(p), Some(mp)) = (self.mj.pta.as_ref(), self.mapa.as_ref()) {
            if (!p.l.is_empty() || !p.bot.is_empty()) && self.vehs.jugador.is_none() {
                let (o, f) = (self.ojos_ult, self.mira()); let lejos = 2.6 + if self.camara == 1 { 3.1 } else { 0.0 };
                let g = self.fis.rayo(&mp.mundo, [o[0] as f64, o[1] as f64, o[2] as f64], [f[0] as f64, f[1] as f64, f[2] as f64], lejos as f64, &[]);
                let d = g.as_ref().and_then(|g| g.cuerpo).and_then(|id| self.mj.pj.iter().position(|x| x.cuerpos.iter().any(|c| c.0 == id))).filter(|&i| p.l[i].def.usa);
                self.mj.usar = match d { Some(i) => Some(Usar::Puerta(i)), None => p.boton_apuntado(o, f, lejos, g.map(|g| g.t as f32).unwrap_or(lejos)).map(Usar::Boton) };
                self.mj.usar_txt = self.mj.usar.map(|u| match u { Usar::Boton(_) => "Botón", Usar::Puerta(i) => if p.l[i].meta > 0.5 { "Cerrar" } else { "Abrir" } });
            }
        }
    }
    /// un sonido de las puertas o del mapa
    fn mapas_evento(&mut self, e: Ev) {
        match e {
            Ev::Juego { n, p, vol } => self.sonido.tocar(n, vol, 1.0, Some(p)),
            Ev::Mapa { s, p, vol, tono, bucle } => {
                let Some((clave, v, t)) = self.gmod_sonido_clave(&s, vol, tono) else { return };
                match bucle { Some(k) => self.sonido.bucle(&k, &clave, v), None => self.sonido.tocar(&clave, v, t, p) }
            }
            Ev::Parar { .. } => {}
        }
    }
    /// «Usar» con una puerta o un botón del mapa a la vista (puertaUsar); false si no hay
    pub(crate) fn mapas_usar(&mut self) -> bool {
        if self.usar_ve || self.vehs.jugador.is_some() { return false; }
        let (Some(u), Some(p)) = (self.mj.usar, self.mj.pta.as_mut()) else { return false };
        let jug = Jug { pos: self.jug.pos, radio: self.jug.radio, vivo: true, noclip: self.jug.noclip, cam: self.ojos_ult };
        match u { Usar::Puerta(i) => p.usar_puerta(i, self.jug.pos), Usar::Boton(b) => p.usar_boton(b, &jug) }
        let ev = std::mem::take(&mut p.ev); for e in ev { self.mapas_evento(e); }
        true
    }
    /// lo que se dibuja de las puertas (donde quedó cada una)
    pub(crate) fn mapas_items(&self, items: &mut Vec<ItemDin>) {
        let Some(p) = self.mj.pta.as_ref() else { return };
        for (i, x) in self.mj.pj.iter().enumerate() {
            let Some(d) = p.l.get(i) else { continue }; if x.items.is_empty() { continue; }
            let w = jxjuego::mapa::trs(d.pos, d.q, [1.0; 3]);
            for it in &x.items { let mm = m4::mul(&w, &it.mm); let c = punto(&w, [it.esf[0], it.esf[1], it.esf[2]]); items.push(ItemDin { mm, esf: [c[0], c[1], c[2], it.esf[3]], ..it.clone() }); }
        }
    }
}

#[cfg(test)]
mod prueba {
    use super::*;
    #[test]
    fn claves_y_gma() {
        assert_eq!(clave_ws("maps/gm_construct 13-beta.bsp"), "WS_gm_construct_13_beta");
        let mut g = b"GMAD\x03".to_vec(); g.extend_from_slice(&[0; 16]); g.extend_from_slice(b"\0nombre\0desc\0autor\0"); g.extend_from_slice(&[1, 0, 0, 0]);
        for (i, n) in ["maps/gm_x.bsp", "materials/a.vmt"].iter().enumerate() { g.extend_from_slice(&(i as u32 + 1).to_le_bytes()); g.extend_from_slice(n.as_bytes()); g.push(0); g.extend_from_slice(&[0; 12]); }
        g.extend_from_slice(&[0; 4]);
        assert_eq!(indice_gma(&g).unwrap(), vec!["maps/gm_x.bsp".to_string(), "materials/a.vmt".to_string()]);
        assert!(indice_gma(&g[..g.len() - 6]).is_none());
    }
}
