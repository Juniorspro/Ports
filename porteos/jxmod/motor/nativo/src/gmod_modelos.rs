//! Los modelos de los addons en el motor nativo (gmPrefab, gmMaterial y gmTextura de juego/gmod.js; gmvConstruir de
//! gmod_vista.js; gmnbDibujar de gmod_nextbot.js): la malla del .mdl con sus materiales (.vmt) y texturas (.vtf), quieta
//! (en la pose de reposo, para los objetos: se dibuja con los del juego) o con piel (partida en grupos de 56 huesos, para
//! los nextbots y la vista del arma); la forma de choque de su .phy (o el casco de la malla) y su masa; los cuadrados de
//! render.DrawSprite / DrawQuadEasy; la vista del arma del addon delante de la cámara y su modelo de mundo en la mano.
use super::*;
use jxgmod::formatos as gmf;
use jxgmod::modelos::{Dib, Sprite3};
use jxjuego::fisica::{self as fz, Forma};
use jxjuego::forma::PrefabFisica;
use jxmotor::escena::{ItemDin, Malla, Mat};
use objetos::Parte;

/// los números propios de mallas, materiales y texturas de los addons (lejos de los del paquete y de los demás propios)
const ID_GM: i64 = -5_000_000;
const MAX_HUESOS: usize = 56;
/// el cuadrado de los sprites (1×1, de las dos caras)
const QUAD_MALLA: i64 = ID_GM + 1;
const GS: f32 = 0.0254;

/// una malla subida: su número, sus partes (desde, cuántos, material) y, con piel, los huesos del modelo de cada lugar
pub struct MallaGm { pub m: i64, pub partes: Vec<(u32, u32, i64)>, pub huesos: Vec<usize>, pub esf: [f32; 4] }
pub struct ModeloGm { pub quieto: Vec<MallaGm>, pub piel: Option<Vec<MallaGm>>, pub caja: [f32; 6], pub fis: Option<Arc<PrefabFisica>>, mats: Vec<i64> }
#[derive(Default)]
pub struct GmModelos {
    pub modelos: HashMap<String, Option<Rc<ModeloGm>>>,
    /// el nivel de detalle de lejos de cada modelo (las mismas mallas con menos caras: los props lejanos de los mapas)
    pub lejos: HashMap<String, MallaGm>,
    sig: i64,
    texs: HashMap<String, Option<(i64, u32, u32)>>,
    /// lo que ocupan en la placa las texturas subidas (bytes): pasado el presupuesto de la calidad, las que siguen van a la mitad
    bytes: usize,
    mats: HashMap<String, (i64, bool)>,
    /// los materiales de los sprites (con su modo): número del material del motor
    mats_spr: HashMap<String, Option<i64>>,
    /// los objetos que esperan su modelo (uno se arma por cuadro si tarda)
    pub crear: Vec<(ObjId, String)>,
    quad: bool,
    /// lo 3D del último cuadro del Lua
    pub dib: Dib,
    /// lo que tardó armar modelos en este cuadro (ms)
    pub ms_armar: f32,
    /// cuántos modelos y triángulos se armaron (para las pruebas)
    pub armados: u32, pub tris: u32,
    /// lo más que tardó armar un modelo (ms) y cuál
    pub ms_max: (f32, String),
    /// lo que se junta para subir al motor de una vez (en Vulkan cada subida espera a la placa): texturas, materiales y sus datos
    lote: Option<(Vec<Tex>, Vec<Mat>, Vec<u8>)>,
}

/// float → medio float (gmF2H)
fn f2h(v: f32) -> u16 {
    let x = v.to_bits(); let s = ((x >> 16) & 0x8000) as u16; let e = ((x >> 23) & 0xff) as i32 - 112; let m = x & 0x7f_ffff;
    if e <= 0 { return s; } if e >= 31 { return s | 0x7bff; }
    let h = ((e as u32) << 10) + ((m + 0x1000) >> 13); s | (if h > 0x7bff { 0x7bff } else { h as u16 })
}
/// Source (x adelante, y izquierda, z arriba, pulgadas) → el juego (y, z, x; metros)
#[inline] fn a_juego(p: [f32; 3]) -> [f32; 3] { [p[1] * GS, p[2] * GS, p[0] * GS] }
#[inline] fn dir_juego(p: [f32; 3]) -> [f32; 3] { [p[1], p[2], p[0]] }
/// una matriz de piel de Source (3×4, filas) → 3 filas vec4 del juego
fn hueso_juego(s: &[f32; 12], out: &mut Vec<f32>) {
    const P: [usize; 3] = [1, 2, 0];
    for r in 0..3 { for c in 0..3 { out.push(s[P[r] * 4 + P[c]]); } out.push(s[P[r] * 4 + 3] * GS); }
}
/// las superficies de Source → el sonido de los objetos del juego
fn sonido_sup(s: &str) -> &'static str {
    match s { "wood" | "wood_crate" | "wood_box" | "wood_plank" | "wood_furniture" => "wood", "plastic" | "plastic_box" => "plastic", "glass" | "glassbottle" => "glass", "concrete" | "rock" | "brick" => "concrete", "cardboard" | "paper" => "cardboard", "rubber" | "rubbertire" => "rubber", "flesh" | "watermelon" => "flesh", _ => "metal" }
}

impl Juego {
    pub(crate) fn gm_id_pub(&mut self) -> i64 { self.gm_id() }
    /// el motor se vació (otro mapa): los modelos, materiales y texturas armados ya no están en él (los prefabs «gm:» tampoco)
    pub(crate) fn gm_olvidar_motor(&mut self) {
        let mm = &mut self.gmod.mods; mm.modelos.clear(); mm.lejos.clear(); mm.texs.clear(); mm.bytes = 0; mm.mats.clear(); mm.mats_spr.clear(); mm.quad = false; mm.lote = None;
        self.gmod.texs.clear();
    }
    fn gm_id(&mut self) -> i64 { self.gmod.mods.sig += 1; ID_GM - 16 - self.gmod.mods.sig }
    fn gm_archivo(&self, r: &str) -> Option<Rc<[u8]>> { self.gmod.gm.as_ref()?.archivo(r) }
    /// una textura de los addons (materials/<ruta>.vtf, o una imagen PNG): su número, ancho y alto
    pub(crate) fn gm_textura(&mut self, m: &mut Motor3d, ruta: &str) -> Option<(i64, u32, u32)> {
        if let Some(x) = self.gmod.mods.texs.get(ruta) { return *x; }
        let res = (|| {
            let (w, h, px) = if ruta.ends_with(".png") { let b = self.gm_archivo(ruta)?; png_rgba(b.to_vec())? } else {
                // (el lado mayor: 512, o 256 pasado el presupuesto de la calidad —los mapas grandes del Workshop traen cientos— y
                // siempre en las calidades bajas; así la placa no se llena: gm_fork pedía 477 MB)
                let q = self.aj.calidad.min(5); let pres = [48usize, 72, 110, 150, 190, 230][q] << 20;
                let tope = if q <= 1 || self.gmod.mods.bytes > pres { 256 } else { 512 };
                let b = self.gm_archivo(&format!("materials/{ruta}.vtf"))?; let t = gmf::vtf(&b, tope).ok()?; (t.w as u32, t.h as u32, gmf::vtf_rgba(&t)) };
            self.gmod.mods.bytes += px.len() * 4 / 3;
            let id = self.gm_id(); let a = px.chunks_exact(4).any(|c| c[3] < 250) as u8;
            let tex = Tex { id, n: format!("gm:{ruta}"), w, h, a, o: 0 };
            if let Some((ts, _, d)) = self.gmod.mods.lote.as_mut() { ts.push(Tex { o: d.len(), ..tex }); d.extend_from_slice(&px); return Some((id, w, h)); }
            let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![tex], lms: vec![], items: vec![], agua: None, cielo: None };
            unsafe { m.cargar(&Escena { c: cab, datos: px }) }.ok()?; Some((id, w, h))
        })();
        self.gmod.mods.texs.insert(ruta.to_string(), res); res
    }
    /// gmVmtRuta + GMF.vmt: el material de una textura del modelo (en sus carpetas)
    pub(crate) fn gm_vmt(&self, tex: &str, carpetas: &[String]) -> Option<gmf::Vmt> {
        let gm = self.gmod.gm.as_ref()?;
        let cs: Vec<String> = if carpetas.is_empty() { vec![String::new()] } else { carpetas.to_vec() };
        for c in cs {
            let r = if c.is_empty() { tex.to_string() } else { format!("{}/{}", c.trim_end_matches('/'), tex) };
            if let Some(b) = gm.archivo(&format!("materials/{r}.vmt")) { return gmf::vmt(&b, &|p: &str| gm.archivo(&format!("materials/{}.vmt", p.trim_end_matches(".vmt")))); }
        }
        None
    }
    /// gmMaterial: el material del motor de una textura del modelo (y si se dibuja de los dos lados)
    pub(crate) fn gm_material(&mut self, m: &mut Motor3d, tex: &str, carpetas: &[String]) -> (i64, bool) {
        let k = format!("{tex}|{}", carpetas.join(","));
        if let Some(x) = self.gmod.mods.mats.get(&k) { return *x; }
        let v = self.gm_vmt(tex, carpetas);
        let t = match &v { Some(v) => v.base.as_ref().and_then(|b| self.gm_textura(m, b)).map(|x| x.0).unwrap_or(-1), None => carpetas.iter().map(|c| format!("{}/{}", c.trim_end_matches('/'), tex)).chain([tex.to_string()]).find_map(|r| self.gm_textura(m, &r)).map(|x| x.0).unwrap_or(-1) };
        let mut c = v.as_ref().and_then(|v| v.color).map(|c| [c[0], c[1], c[2], 1.0]).unwrap_or(if v.is_none() && t < 0 { [0.66, 0.66, 0.68, 1.0] } else { [1.0; 4] });
        let (mut blend, mut cut, mut add, mut unlit) = (0u8, 0u8, 0u8, 0u8);
        if let Some(v) = &v {
            if v.alfa < 0.99 { c[3] = v.alfa.max(0.18); blend = 1; }
            if v.trans { blend = 1; } else if v.corte { cut = 1; }
            if v.suma { add = 1; blend = 0; } else if v.sin_luz && blend == 0 { unlit = 1; }
            if v.shader == "refract" && v.base.is_none() { blend = 1; c[3] = 0.3; }
            if v.nodraw { c[3] = 0.0; blend = 1; }
        }
        let brillo = v.as_ref().map(|v| v.phong || v.env).unwrap_or(false);
        let id = self.gm_id();
        let mat = Mat { ti: [0.0; 12], pbr: if brillo { [0.45, 0.0, 0.04] } else { [0.75, 0.0, 0.04] }, fol: 0, id, t2: -1, terr: None, c, st: [1.0, 1.0, 0.0, 0.0], t, blend, cut, unlit, add, agua: 0, em: [0.0; 3] };
        if let Some((_, ms, _)) = self.gmod.mods.lote.as_mut() { ms.push(mat); } else {
            let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![mat], texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
            let _ = unsafe { m.cargar(&Escena { c: cab, datos: vec![] }) };
        }
        let r = (id, v.map(|v| v.dos_lados).unwrap_or(false)); self.gmod.mods.mats.insert(k, r); r
    }
    /// una malla al motor: vértices (juego), normales, UV, índices por material y, con piel, los huesos (índices locales y pesos)
    pub(crate) fn gm_subir(&mut self, m: &mut Motor3d, p: &[[f32; 3]], nr: &[[f32; 3]], uv: &[[f32; 2]], partes: &[(i64, Vec<u32>)], piel: Option<&[([u8; 4], [u8; 4])]>) -> Option<MallaGm> {
        let n = p.len(); if n == 0 { return None; }
        let (mut mn, mut mx) = ([f32::MAX; 3], [f32::MIN; 3]); for v in p { for k in 0..3 { mn[k] = mn[k].min(v[k]); mx[k] = mx[k].max(v[k]); } }
        let sc = [(mx[0] - mn[0]).max(1e-5), (mx[1] - mn[1]).max(1e-5), (mx[2] - mn[2]).max(1e-5)];
        let mut d: Vec<u8> = Vec::with_capacity(n * 14 + n * 8 + 64);
        for i in 0..n {
            for k in 0..3 { d.extend_from_slice(&((((p[i][k] - mn[k]) / sc[k]).clamp(0.0, 1.0) * 65535.0).round() as u16).to_le_bytes()); }
            d.extend_from_slice(&[(nr[i][0] * 127.0) as i8 as u8, (nr[i][1] * 127.0) as i8 as u8, (nr[i][2] * 127.0) as i8 as u8, 0]);
            d.extend_from_slice(&f2h(uv[i][0]).to_le_bytes()); d.extend_from_slice(&f2h(uv[i][1]).to_le_bytes());
        }
        while d.len() % 4 != 0 { d.push(0); }
        let so = if let Some(s) = piel { let o = d.len(); for (j, w) in s { d.extend_from_slice(j); d.extend_from_slice(w); } o as i64 } else { -1 };
        let i32_ = n > 65535; let io = d.len(); let mut ps = vec![]; let mut ni = 0u32;
        for (mat, ix) in partes { if ix.is_empty() { continue; } ps.push((ni, ix.len() as u32, *mat)); for &x in ix { if i32_ { d.extend_from_slice(&x.to_le_bytes()); } else { d.extend_from_slice(&(x as u16).to_le_bytes()); } } ni += ix.len() as u32; }
        if ni == 0 { return None; }
        let id = self.gm_id();
        let (texs, mats, mut datos) = self.gmod.mods.lote.take().unwrap_or_default();
        while datos.len() % 4 != 0 { datos.push(0); } let b0 = datos.len(); datos.extend_from_slice(&d);
        let malla = Malla { id, v: n as u32, mn, sc, i32: i32_ as u8, ni, vo: b0, io: io + b0, lo: -1, so: if so >= 0 { so + b0 as i64 } else { -1 }, lm: -1 };
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![malla], mats, texs, lms: vec![], items: vec![], agua: None, cielo: None };
        unsafe { m.cargar(&Escena { c: cab, datos }) }.ok()?;
        self.gmod.mods.tris += ni / 3;
        let c = [(mn[0] + mx[0]) / 2.0, (mn[1] + mx[1]) / 2.0, (mn[2] + mx[2]) / 2.0]; let r = (sc[0] * sc[0] + sc[1] * sc[1] + sc[2] * sc[2]).sqrt() / 2.0;
        Some(MallaGm { m: id, partes: ps, huesos: vec![], esf: [c[0], c[1], c[2], r] })
    }
    /// el modelo de los addons de esa ruta, armado (malla quieta, materiales y forma de choque); None si no se puede
    pub(crate) fn gm_modelo(&mut self, m: &mut Motor3d, ruta: &str) -> Option<Rc<ModeloGm>> {
        if let Some(x) = self.gmod.mods.modelos.get(ruta) { return x.clone(); }
        let t0 = Instant::now();
        self.gmod.mods.lote = Some(Default::default());
        let r = self.gm_armar(m, ruta).map(Rc::new);
        // (lo que quedó juntado sin malla —un modelo sin caras—: igual se sube)
        if let Some((texs, mats, datos)) = self.gmod.mods.lote.take() { if !texs.is_empty() || !mats.is_empty() { let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats, texs, lms: vec![], items: vec![], agua: None, cielo: None }; let _ = unsafe { m.cargar(&Escena { c: cab, datos }) }; } }
        self.gmod.mods.modelos.insert(ruta.to_string(), r.clone());
        let ms = t0.elapsed().as_secs_f32() * 1000.0; self.gmod.mods.ms_armar += ms; if ms > self.gmod.mods.ms_max.0 { self.gmod.mods.ms_max = (ms, ruta.to_string()); }
        if let Some(md) = &r { self.gmod.mods.armados += 1; self.prefabs.insert(format!("gm:{ruta}"), objetos::Prefab { nombre: format!("gm:{ruta}"), partes: md.quieto.iter().flat_map(|q| q.partes.iter().map(move |&(s0, sn, mat)| Parte { m: q.m, s0, sn, mat, local: m4::id(), esf: q.esf, nodo: 0 })).collect(), caja: md.caja }); }
        r
    }
    fn gm_armar(&mut self, m: &mut Motor3d, ruta: &str) -> Option<ModeloGm> {
        let tp = Instant::now(); let perfil = std::env::var("JXM_PERFIL").is_ok(); let mut marcas: Vec<(&str, f32)> = vec![];
        let mut marca = |n: &'static str| if perfil { marcas.push((n, tp.elapsed().as_secs_f32() * 1000.0)); };
        let md = self.gmod.gm.as_ref()?.modelo(ruta)?; let mdl = md.m.clone(); marca("mdl");
        let v = mdl.v.as_ref()?; if mdl.mallas.is_empty() { return None; }
        let base = &ruta[..ruta.len().saturating_sub(4)];
        let fphy = self.gm_archivo(&format!("{base}.phy")).map(|b| gmf::phy(&b));
        // (¿la pose de enlace o la del primer cuadro de su primera secuencia? la que mejor calce con su casco de choque)
        let h0 = mdl.hull; let hull_ok = (0..3).any(|c| (h0[1][c] - h0[0][c]).abs() > 1.0);
        let mut rp = if fphy.is_some() || hull_ok { gmf::pose_reposo(&mdl) } else { None };
        let mut vp: Option<(Vec<[f32; 3]>, Vec<[f32; 3]>)> = None;
        if let Some(r) = &rp {
            let caja = |l: &mut dyn Iterator<Item = [f32; 3]>| { let mut a = [f32::MAX, f32::MAX, f32::MAX, f32::MIN, f32::MIN, f32::MIN]; let mut hay = false; for p in l { hay = true; for c in 0..3 { a[c] = a[c].min(p[c]); a[c + 3] = a[c + 3].max(p[c]); } } if hay { Some(a) } else { None } };
            let calce = |a: Option<[f32; 6]>, b: Option<[f32; 6]>| match (a, b) { (Some(a), Some(b)) => (0..6).map(|k| (a[k] - b[k]).abs()).fold(0.0f32, f32::max), _ => f32::MAX };
            let vpp = gmf::posar(&mdl, r); let mut usar = false;
            let cb = caja(&mut v.pos.iter().copied()); let cp = caja(&mut vpp.0.iter().copied());
            if let Some(ph) = &fphy { let fb = calce(cb, caja(&mut gmf::phy_modelo(ph, &mdl, None).into_iter().flatten())); let fp = calce(cp, caja(&mut gmf::phy_modelo(ph, &mdl, Some(r)).into_iter().flatten())); usar = fb > 8.0 && fp < fb * 0.5; }
            if !usar && hull_ok { let hh = Some([h0[0][0], h0[0][1], h0[0][2], h0[1][0], h0[1][1], h0[1][2]]); let hb = calce(cb, hh); let hp = calce(cp, hh); usar = hb > 8.0 && hp < hb * 0.5; }
            if usar { vp = Some(vpp); } else { rp = None; }
        }
        marca("reposo");
        let (pos_s, nor_s) = match &vp { Some((a, b)) => (a.as_slice(), b.as_slice()), None => (v.pos.as_slice(), v.nor.as_slice()) };
        let p: Vec<[f32; 3]> = pos_s.iter().map(|x| a_juego(*x)).collect(); let nr: Vec<[f32; 3]> = nor_s.iter().map(|x| dir_juego(*x)).collect();
        // (las UV de cada malla llevadas cerca de 0, de a enteros: gmUVcorr)
        let mut uv: Vec<[f32; 2]> = v.uv.clone();
        for mm in &mdl.mallas { let (mut mu, mut mv) = (f32::MAX, f32::MAX); for &k in &mm.tris { mu = mu.min(v.uv[k as usize][0]); mv = mv.min(v.uv[k as usize][1]); } if mu > 1e8 { continue; } let (du, dv) = (mu.floor(), mv.floor()); if du == 0.0 && dv == 0.0 { continue; } for &k in &mm.tris { uv[k as usize] = [v.uv[k as usize][0] - du, v.uv[k as usize][1] - dv]; } }
        // las caras por material (piel 0; de cada parte del cuerpo, la primera variante)
        let piel0 = mdl.pieles.first().cloned().unwrap_or_default();
        let mut por_mat: Vec<(i64, Vec<u32>)> = vec![]; let mut mats = vec![];
        for mm in &mdl.mallas {
            if mm.modelo != 0 { continue; }
            let ti = piel0.get(mm.mat as usize).map(|&x| x as usize).unwrap_or(mm.mat as usize);
            let tex = mdl.texturas.get(ti).or_else(|| mdl.texturas.get(mm.mat as usize)).cloned().unwrap_or_else(|| "error".into());
            let (mat, dos) = self.gm_material(m, &tex, &mdl.carpetas); mats.push(mat);
            let l = match por_mat.iter_mut().find(|x| x.0 == mat) { Some(x) => &mut x.1, None => { por_mat.push((mat, vec![])); &mut por_mat.last_mut().unwrap().1 } };
            for t in mm.tris.chunks_exact(3) { l.extend_from_slice(&[t[0], t[2], t[1]]); if dos { l.extend_from_slice(&[t[0], t[1], t[2]]); } }
        }
        // (el nivel de detalle de lejos, si tiene bastantes menos caras: sus partes van detrás en la misma malla)
        let n0 = por_mat.iter().filter(|x| !x.1.is_empty()).count(); let t0: usize = por_mat.iter().map(|x| x.1.len()).sum();
        let mut lejos: Vec<(i64, Vec<u32>)> = vec![];
        for mm in &mdl.mallas_lejos {
            if mm.modelo != 0 { continue; }
            let ti = piel0.get(mm.mat as usize).map(|&x| x as usize).unwrap_or(mm.mat as usize);
            let tex = mdl.texturas.get(ti).or_else(|| mdl.texturas.get(mm.mat as usize)).cloned().unwrap_or_else(|| "error".into());
            let (mat, dos) = self.gm_material(m, &tex, &mdl.carpetas);
            let l = match lejos.iter_mut().find(|x| x.0 == mat) { Some(x) => &mut x.1, None => { lejos.push((mat, vec![])); &mut lejos.last_mut().unwrap().1 } };
            for t in mm.tris.chunks_exact(3) { l.extend_from_slice(&[t[0], t[2], t[1]]); if dos { l.extend_from_slice(&[t[0], t[1], t[2]]); } }
        }
        let tl: usize = lejos.iter().map(|x| x.1.len()).sum(); let con_lejos = tl > 0 && tl * 10 < t0 * 7;
        if con_lejos { por_mat.extend(lejos); }
        marca("materiales");
        let mut quieto = self.gm_subir(m, &p, &nr, &uv, &por_mat, None)?; marca("subir");
        if con_lejos && quieto.partes.len() > n0 { let pl = quieto.partes.split_off(n0); self.gmod.mods.lejos.insert(ruta.to_string(), MallaGm { m: quieto.m, partes: pl, huesos: vec![], esf: quieto.esf }); }
        let (mut mn, mut mx) = ([f32::MAX; 3], [f32::MIN; 3]); for x in &p { for k in 0..3 { mn[k] = mn[k].min(x[k]); mx[k] = mx[k].max(x[k]); } }
        // la forma de choque: las piezas del .phy (hasta 24) o el casco de la malla
        let mut partes: Vec<(fz::Casco, [f64; 3], f64)> = vec![];
        if let Some(ph) = &fphy {
            for f in gmf::phy_modelo(ph, &mdl, rp.as_ref()).into_iter().take(24) {
                if f.len() < 4 || f.iter().any(|q| q.iter().any(|x| !x.is_finite() || x.abs() > 20000.0)) { continue; }
                let pts: Vec<[f64; 3]> = f.iter().map(|q| { let g = a_juego(*q); [g[0] as f64, g[1] as f64, g[2] as f64] }).collect();
                partes.push(jxjuego::forma::casco_de_puntos(&pts, false));
            }
        }
        if partes.is_empty() {
            let paso = (p.len() / 3000).max(1); let pts: Vec<[f64; 3]> = p.iter().step_by(paso).map(|q| [q[0] as f64, q[1] as f64, q[2] as f64]).collect();
            if pts.len() >= 4 { partes.push(jxjuego::forma::casco_de_puntos(&pts, false)); }
        }
        let fis = if partes.is_empty() { None } else {
            let (forma, c) = if partes.len() == 1 { let (h, c, _) = partes.pop().unwrap(); (Forma::Casco(h), c) } else {
                let (mut vt, mut c) = (0.0, [0.0f64; 3]); for (_, pc, vol) in &partes { for k in 0..3 { c[k] += pc[k] * vol; } vt += vol; } for x in c.iter_mut() { *x /= vt.max(1e-9); }
                (fz::forma_compuesta(partes.into_iter().map(|(h, pc, _)| fz::Parte { forma: Forma::Casco(h), p: [pc[0] - c[0], pc[1] - c[1], pc[2] - c[2]], q: fz::QID }).collect()), c)
            };
            let sc = [(mx[0] - mn[0]) as f64, (mx[1] - mn[1]) as f64, (mx[2] - mn[2]) as f64];
            let masa = fphy.as_ref().and_then(|f| f.masa).map(|x| x as f64).unwrap_or_else(|| (sc[0] * sc[1] * sc[2] * 180.0).clamp(1.0, 2000.0));
            let sup = fphy.as_ref().and_then(|f| f.superficie.clone()).unwrap_or_default();
            let snd = sonido_sup(sup.as_str()).to_string();
            // (la física de su material como en Source: surfaceproperties.txt —fricción, rebote y densidad—)
            let (fric, rest, dens) = jxjuego::superficies::para_fisica(if sup.is_empty() { "default" } else { sup.as_str() });
            Some(Arc::new(PrefabFisica { nombre: format!("gm:{ruta}"), clave: format!("gm:{ruta}#gm"), forma: Arc::new(forma), c, eje_cap: None, cap_q: None, partes: 1, masa: masa.clamp(0.5, 50000.0), fric, rest, tipo: "prop", sin_fisica: false, congelado: false, salta: false, snd, dens: if sup.is_empty() { None } else { Some(dens) } }))
        };
        marca("fisica"); if perfil { eprintln!("armar {ruta}: {:?}", marcas); }
        Some(ModeloGm { quieto: vec![quieto], piel: None, caja: [mn[0], mn[1], mn[2], mx[0], mx[1], mx[2]], fis, mats })
    }
    /// la malla con piel (en la pose de enlace), partida en grupos de 56 huesos como mucho
    fn gm_piel(&mut self, m: &mut Motor3d, ruta: &str) -> Option<Rc<ModeloGm>> {
        let md = self.gm_modelo(m, ruta)?; if md.piel.is_some() { return Some(md); }
        let t0 = Instant::now(); let r = self.gm_piel_armar(m, ruta, md); let ms = t0.elapsed().as_secs_f32() * 1000.0; self.gmod.mods.ms_armar += ms;
        if ms > self.gmod.mods.ms_max.0 { self.gmod.mods.ms_max = (ms, format!("{ruta} (piel)")); } r
    }
    fn gm_piel_armar(&mut self, m: &mut Motor3d, ruta: &str, md: Rc<ModeloGm>) -> Option<Rc<ModeloGm>> {
        let mdl = self.gmod.gm.as_ref()?.modelo(ruta)?.m.clone();
        let mallas = self.gm_piel_mallas(m, &mdl, &md.mats)?;
        let nuevo = Rc::new(ModeloGm { quieto: vec![], piel: Some(mallas), caja: md.caja, fis: md.fis.clone(), mats: md.mats.clone() });
        // (se guarda el de antes con la piel: lo quieto queda en el de antes, que usa el objeto)
        let junto = Rc::new(ModeloGm { quieto: md.quieto.iter().map(|q| MallaGm { m: q.m, partes: q.partes.clone(), huesos: vec![], esf: q.esf }).collect(), piel: nuevo.piel.as_ref().map(|l| l.iter().map(|q| MallaGm { m: q.m, partes: q.partes.clone(), huesos: q.huesos.clone(), esf: q.esf }).collect()), caja: md.caja, fis: md.fis.clone(), mats: md.mats.clone() });
        self.gmod.mods.modelos.insert(ruta.to_string(), Some(junto.clone())); Some(junto)
    }
    /// (gmod_pm.rs) la malla con piel de un modelo de jugador
    pub(crate) fn gm_piel_pub(&mut self, m: &mut Motor3d, ruta: &str) -> Option<Rc<ModeloGm>> { self.gm_piel(m, ruta) }
    /// (gmod_pm.rs y gmod_autorig.rs) la malla con piel de otro .mdl con la geometría del de esa ruta (el mismo con su rig
    /// automático: otros huesos y otros pesos), con los materiales del de la ruta; se guarda como «ruta#etiqueta»
    pub(crate) fn gm_piel_de(&mut self, m: &mut Motor3d, ruta: &str, mdl: &gmf::Mdl, etiqueta: &str) -> Option<Rc<ModeloGm>> {
        let k = format!("{ruta}#{etiqueta}"); if let Some(x) = self.gmod.mods.modelos.get(&k) { return x.clone(); }
        let md = self.gm_modelo(m, ruta)?;
        let r = self.gm_piel_mallas(m, mdl, &md.mats).map(|mallas| Rc::new(ModeloGm { quieto: vec![], piel: Some(mallas), caja: md.caja, fis: md.fis.clone(), mats: md.mats.clone() }));
        self.gmod.mods.modelos.insert(k, r.clone()); r
    }
    /// la clave de un modelo con otra piel y otros cuerpos (SetSkin y SetBodyGroups: las manos de un modelo de jugador)
    pub(crate) fn gm_clave_op(ruta: &str, piel: i32, cuerpos: &str) -> String { if piel == 0 && cuerpos.chars().all(|c| c == '0') { ruta.to_string() } else { format!("{ruta}|{piel}|{cuerpos}") } }
    /// la malla con piel de un .mdl con la piel `piel` y en cada cuerpo el modelo que dice `cuerpos` (un dígito en base 36
    /// por cuerpo, como «0100000»; si no lo hay, el primero), como gmvMallas con op: { piel, cuerpos }
    pub(crate) fn gm_piel_op(&mut self, m: &mut Motor3d, ruta: &str, piel: i32, cuerpos: &str) -> Option<Rc<ModeloGm>> {
        let k = Self::gm_clave_op(ruta, piel, cuerpos);
        if k == ruta { let ya = self.gmod.mods.modelos.get(ruta).map(|x| x.as_ref().map(|y| y.piel.is_some()).unwrap_or(true)).unwrap_or(false); return if ya { self.gmod.mods.modelos.get(ruta).cloned().flatten() } else { self.gm_piel(m, ruta) }; }
        if let Some(x) = self.gmod.mods.modelos.get(&k) { return x.clone(); }
        let md = self.gm_modelo(m, ruta)?; let mut mdl = (*self.gmod.gm.as_ref()?.modelo(ruta)?.m).clone();
        let cs: Vec<usize> = cuerpos.chars().map(|c| c.to_digit(36).unwrap_or(0) as usize).collect();
        let tabla = mdl.pieles.get(piel.max(0) as usize).or_else(|| mdl.pieles.first()).cloned().unwrap_or_default();
        // (cada malla del cuerpo elegido pasa a ser la del primero —modelo 0— con la textura de esa piel)
        let elegido = |c: usize, n: usize| { let x = cs.get(c).copied().unwrap_or(0); if x < n { x } else { 0 } };
        let ncuerpo: Vec<usize> = mdl.cuerpos.iter().map(|c| c.modelos.len()).collect();
        mdl.mallas.retain(|x| x.modelo == elegido(x.cuerpo, ncuerpo.get(x.cuerpo).copied().unwrap_or(1)));
        let mut mats = vec![];
        for x in mdl.mallas.iter_mut() {
            let ti = tabla.get(x.mat as usize).map(|&t| t as usize).unwrap_or(x.mat as usize);
            let tex = mdl.texturas.get(ti).or_else(|| mdl.texturas.get(x.mat as usize)).cloned().unwrap_or_else(|| "error".into());
            mats.push(self.gm_material(m, &tex, &mdl.carpetas.clone()).0); x.modelo = 0;
        }
        let r = self.gm_piel_mallas(m, &mdl, &mats).map(|mallas| Rc::new(ModeloGm { quieto: vec![], piel: Some(mallas), caja: md.caja, fis: md.fis.clone(), mats: md.mats.clone() }));
        self.gmod.mods.modelos.insert(k, r.clone()); r
    }
    /// la malla con piel de un .mdl (en la pose de enlace), partida en grupos de 56 huesos como mucho; `mats`: el material
    /// de cada malla del primer modelo de cada cuerpo, en orden
    fn gm_piel_mallas(&mut self, m: &mut Motor3d, mdl: &gmf::Mdl, mats: &[i64]) -> Option<Vec<MallaGm>> {
        let v = mdl.v.as_ref()?; let md_mats = mats;
        let p: Vec<[f32; 3]> = v.pos.iter().map(|x| a_juego(*x)).collect(); let nr: Vec<[f32; 3]> = v.nor.iter().map(|x| dir_juego(*x)).collect();
        let piel0 = mdl.pieles.first().cloned().unwrap_or_default();
        // (grupo: huesos, vértices del modelo → del grupo, y las caras por material)
        struct Grupo { huesos: Vec<usize>, mapa: HashMap<u32, u32>, orig: Vec<u32>, partes: Vec<(i64, Vec<u32>)> }
        let mut grupos: Vec<Grupo> = vec![]; let mut k_mat = 0;
        let hv = |k: u32| -> Vec<usize> { let k = k as usize; (0..3).filter(|&j| v.w[k][j] > 0.0 || j == 0).map(|j| v.hb[k][j] as usize).collect() };
        for mm in &mdl.mallas {
            if mm.modelo != 0 { continue; }
            let mat = md_mats.get(k_mat).copied().unwrap_or(-1); k_mat += 1;
            let _ = piel0.len();
            for t in mm.tris.chunks_exact(3) {
                let mut hs: Vec<usize> = t.iter().flat_map(|&k| hv(k)).collect(); hs.sort_unstable(); hs.dedup();
                let cabe = |g: &Grupo| { let nuevos = hs.iter().filter(|h| !g.huesos.contains(h)).count(); g.huesos.len() + nuevos <= MAX_HUESOS };
                if grupos.last().map(|g| !cabe(g)).unwrap_or(true) { grupos.push(Grupo { huesos: vec![], mapa: HashMap::new(), orig: vec![], partes: vec![] }); }
                let g = grupos.last_mut().unwrap();
                for h in &hs { if !g.huesos.contains(h) { g.huesos.push(*h); } }
                let mut tri = [0u32; 3];
                for (j, &k) in [t[0], t[2], t[1]].iter().enumerate() { let nl = g.orig.len() as u32; let x = *g.mapa.entry(k).or_insert(nl); if x == nl { g.orig.push(k); } tri[j] = x; }
                if g.partes.last().map(|x| x.0 != mat).unwrap_or(true) { g.partes.push((mat, vec![])); }
                g.partes.last_mut().unwrap().1.extend_from_slice(&tri);
            }
        }
        let mut mallas = vec![];
        for g in grupos {
            let pp: Vec<[f32; 3]> = g.orig.iter().map(|&k| p[k as usize]).collect(); let nn: Vec<[f32; 3]> = g.orig.iter().map(|&k| nr[k as usize]).collect(); let uu: Vec<[f32; 2]> = g.orig.iter().map(|&k| v.uv[k as usize]).collect();
            let sk: Vec<([u8; 4], [u8; 4])> = g.orig.iter().map(|&k| { let k = k as usize; let mut j = [0u8; 4]; let mut w = [0u8; 4]; let tot: f32 = v.w[k].iter().sum::<f32>().max(1e-6);
                for c in 0..3 { j[c] = g.huesos.iter().position(|&h| h == v.hb[k][c] as usize).unwrap_or(0) as u8; w[c] = ((v.w[k][c] / tot) * 255.0).round() as u8; }
                if w.iter().map(|&x| x as u32).sum::<u32>() == 0 { w[0] = 255; } (j, w) }).collect();
            if let Some(mut x) = self.gm_subir(m, &pp, &nn, &uu, &g.partes, Some(&sk)) { x.huesos = g.huesos; mallas.push(x); }
        }
        // (la UV como la de la malla quieta: gmUVcorr no se hace con piel; sin mallas, nada)
        if mallas.is_empty() { None } else { Some(mallas) }
    }
    /// crea el objeto de un modelo de los addons ("gm:models/…") para la entidad `oid` del Lua; false si no hay modelo
    pub(crate) fn gm_crear_objeto(&mut self, m: &mut Motor3d, oid: ObjId, nombre: &str, pos: [f32; 3], q: [f32; 4], vel: [f32; 3], cong: bool) -> bool {
        let ruta = nombre.trim_start_matches("gm:");
        let Some(md) = self.gm_modelo(m, ruta) else { return false };
        let id_obj = self.sig_id; self.sig_id += 1;
        let caja = md.caja;
        match &md.fis {
            Some(pfz) => {
                let mut b = jxjuego::forma::cuerpo_de_prefab(pfz, [pos[0] as f64, pos[1] as f64, pos[2] as f64], [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64], true);
                if cong { b.congelado = true; } b.vel = [vel[0] as f64, vel[1] as f64, vel[2] as f64];
                let (bp, bq) = ([b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32], [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]);
                let masa = b.masa as f32; let id = self.fis.agregar(b);
                self.aguas.registrar(id, Flota::de_prefab(pfz));
                self.objs.push(Obj { nombre: nombre.to_string(), pos: bp, q: bq, c: [pfz.c[0] as f32, pfz.c[1] as f32, pfz.c[2] as f32], cuerpo: Some(id), cap_inv: [0.0, 0.0, 0.0, 1.0], ant: (bp, bq), masa, id: id_obj, logica: None, log_base: None, tipo: "prop", vida: 0.0, exploto: false });
            }
            None => { let _ = caja; self.objs.push(Obj { nombre: nombre.to_string(), pos, q, c: [0.0; 3], cuerpo: None, cap_inv: [0.0, 0.0, 0.0, 1.0], ant: (pos, q), masa: 0.0, id: id_obj, logica: None, log_base: None, tipo: "prop", vida: 0.0, exploto: false }); }
        }
        self.pila.push((false, id_obj));
        GM_OBJ.with(|x| x.borrow_mut().insert(oid, id_obj));
        true
    }
    /// después del Lua: los modelos que va a dibujar (se arman de a uno si tardan), los objetos que esperaban el suyo
    pub(crate) fn gm_modelos_paso(&mut self, m: &mut Motor3d) {
        self.gmod.mods.ms_armar = 0.0;
        if !self.gmod.mods.quad { self.gmod.mods.quad = true; self.gm_subir_quad(m); }
        let mut rutas: Vec<(String, bool)> = self.gmod.mods.dib.modelos.iter().map(|d| (d.modelo.clone(), d.huesos.is_some())).collect();
        if let Some(v) = self.gmod.mods.dib.vista.clone() { rutas.push((v.modelo.clone(), true)); if let Some((r, _, sk, body)) = &v.manos { if self.gmod.mods.ms_armar <= 12.0 { self.gm_piel_op(m, r, *sk, body); } } }
        if let Some(w) = self.gm_modelo_mundo() { rutas.push((w, false)); }
        for (r, piel) in rutas {
            if self.gmod.mods.ms_armar > 12.0 { break; }
            if piel { let ya = self.gmod.mods.modelos.get(&r).map(|x| x.as_ref().map(|y| y.piel.is_some()).unwrap_or(true)).unwrap_or(false); if !ya { self.gm_piel(m, &r); } }
            else if !self.gmod.mods.modelos.contains_key(&r) { self.gm_modelo(m, &r); }
        }
        // (cada material con cada color —el del sable, el de un láser—: el color va en el material)
        let mats: Vec<(String, [f32; 4])> = self.gmod.mods.dib.sprites.iter().map(|s| (clave_spr(&s.mat, s.color), s.color)).collect();
        for (k, c) in mats { if !self.gmod.mods.mats_spr.contains_key(&k) && self.gmod.mods.mats_spr.len() < 400 { let x = self.gm_mat_sprite(m, &k, c); self.gmod.mods.mats_spr.insert(k, x); } }
        // (los objetos que esperaban su modelo)
        let pend = std::mem::take(&mut self.gmod.mods.crear);
        for (oid, nombre) in pend {
            if self.gmod.mods.ms_armar > 12.0 && !self.gmod.mods.modelos.contains_key(nombre.trim_start_matches("gm:")) { self.gmod.mods.crear.push((oid, nombre)); continue; }
            self.gm_crear_pendiente(m, oid, &nombre);
        }
    }
    pub(crate) fn gm_crear_pendiente(&mut self, m: &mut Motor3d, oid: ObjId, nombre: &str) {
        let Some((pos, q, vel, cong)) = self.con_puente(|p| p.cuerpos.get(&oid).map(|c| (f3(c.pos), [c.q.x as f32, c.q.y as f32, c.q.z as f32, c.q.w as f32], f3(c.vel), c.congelado))).flatten() else { return };
        if !self.gm_crear_objeto(m, oid, nombre, pos, q, vel, cong) {
            // (el modelo no se pudo leer: la caja, como un modelo que falta)
            let caja = self.con_puente(|p| p.caja.clone()).flatten();
            let aviso = self.aviso.take();
            match caja.map(|c| self.crear(m, &c, pos, q, true, cong)) { Some(Ok(Some(i))) => { let id = self.objs[i].id; GM_OBJ.with(|x| x.borrow_mut().insert(oid, id)); } _ => { self.con_puente(|p| { p.cuerpos.remove(&oid); }); } }
            self.aviso = aviso;
        }
    }
    /// el material de un sprite (render.SetMaterial): su textura, transparente o sumada, sin luz
    fn gm_mat_sprite(&mut self, m: &mut Motor3d, nombre: &str, color: [f32; 4]) -> Option<i64> {
        let nombre = nombre.split('#').next().unwrap_or(nombre);
        let k = nombre.to_lowercase().replace('\\', "/"); let k = k.trim_start_matches("materials/").to_string();
        let (tex, suma) = if k.ends_with(".png") { (self.gm_textura(m, &format!("materials/{k}")).or_else(|| self.gm_textura(m, &k)), false) } else {
            let kb = k.trim_end_matches(".vmt").trim_end_matches(".vtf").to_string();
            let v = self.gm_vmt(&kb, &[]);
            let base = v.as_ref().and_then(|v| v.base.clone()).unwrap_or(kb);
            (self.gm_textura(m, &base), v.map(|v| v.suma).unwrap_or(false))
        };
        let (t, _, _) = tex?;
        let id = self.gm_id();
        let mat = Mat { ti: [0.0; 12], pbr: [0.9, 0.0, 0.04], fol: 0, id, t2: -1, terr: None, c: color, st: [1.0, 1.0, 0.0, 0.0], t, blend: (!suma) as u8, cut: 0, unlit: 1, add: suma as u8, agua: 0, em: [0.0; 3] };
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![mat], texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
        unsafe { m.cargar(&Escena { c: cab, datos: vec![] }) }.ok()?; Some(id)
    }
    fn gm_subir_quad(&mut self, m: &mut Motor3d) {
        // (de (0,0) a (1,1) en x, y; UV igual; las dos caras)
        let mut d: Vec<u8> = vec![];
        for (x, y) in [(0.0f32, 0.0f32), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)] {
            for c in [x, y, 0.0] { d.extend_from_slice(&((c * 65535.0) as u16).to_le_bytes()); }
            d.extend_from_slice(&[0, 0, 127, 0]); d.extend_from_slice(&f2h(x).to_le_bytes()); d.extend_from_slice(&f2h(y).to_le_bytes());
        }
        let io = d.len(); for i in [0u16, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2] { d.extend_from_slice(&i.to_le_bytes()); }
        let malla = Malla { id: QUAD_MALLA, v: 4, mn: [0.0; 3], sc: [1.0, 1.0, 1.0], i32: 0, ni: 12, vo: 0, io, lo: -1, so: -1, lm: -1 };
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![malla], mats: vec![], texs: vec![], lms: vec![], items: vec![], agua: None, cielo: None };
        let _ = unsafe { m.cargar(&Escena { c: cab, datos: d }) };
    }
    /// el WorldModel del arma del addon en la mano (si viene en un addon)
    fn gm_modelo_mundo(&self) -> Option<String> {
        let i = self.gmod.arma?; let gm = self.gmod.gm.as_ref()?;
        let clase = self.con_puente(|p| p.gm_armas.get(i).map(|a| a.0.clone())).flatten()?;
        let w = gm.mundo_arma(&clase)?; let r = jxgmod::modelos::ruta_mdl(&w); gm.archivo(&r)?; Some(r)
    }
    /// ¿el objeto no se ve? (SetNoDraw, un Draw que no llama DrawModel, o lo dibuja animado gmod_items)
    pub fn gmod_oculto(&self, o: &Obj) -> bool {
        let d = &self.gmod.mods.dib; if d.ocultos.is_empty() { return false; }
        GM_OBJ.with(|x| { let x = x.borrow(); d.ocultos.iter().any(|oid| x.get(oid) == Some(&o.id)) })
    }
    /// ¿la vista del arma es la del addon (y no la del arma del juego que presta la suya)?
    pub fn gmod_vista_propia(&self) -> bool { self.gmod.arma.is_some() && self.gmod.mods.dib.vista.as_ref().map(|v| self.gmod.mods.modelos.get(&v.modelo).map(|x| x.as_ref().map(|y| y.piel.is_some()).unwrap_or(false)).unwrap_or(false)).unwrap_or(false) }
    /// ¿el personaje tiene en la mano el modelo de mundo del arma del addon (y no el del juego)?
    pub fn gmod_arma_mundo(&self) -> bool { self.gmod.arma.is_some() && self.gm_modelo_mundo().map(|r| self.gmod.mods.modelos.get(&r).map(|x| x.is_some()).unwrap_or(false)).unwrap_or(false) }
    fn gm_items_modelo(md: &ModeloGm, base: &M4, huesos: Option<&[[f32; 12]]>, out: &mut Vec<ItemDin>) {
        let esc = [0, 4, 8].iter().map(|&o| (base[o] * base[o] + base[o + 1] * base[o + 1] + base[o + 2] * base[o + 2]).sqrt()).fold(0.0f32, f32::max);
        match (huesos, &md.piel) {
            (Some(hs), Some(gr)) => for g in gr {
                let mut h = Vec::with_capacity(g.huesos.len() * 12); for &i in &g.huesos { match hs.get(i) { Some(s) => hueso_juego(s, &mut h), None => h.extend_from_slice(&[1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0]) } }
                let c = [base[0] * g.esf[0] + base[4] * g.esf[1] + base[8] * g.esf[2] + base[12], base[1] * g.esf[0] + base[5] * g.esf[1] + base[9] * g.esf[2] + base[13], base[2] * g.esf[0] + base[6] * g.esf[1] + base[10] * g.esf[2] + base[14]];
                for &(s0, sn, mat) in &g.partes { out.push(ItemDin { m: g.m, s0, sn, mat, mm: *base, esf: [c[0], c[1], c[2], g.esf[3] * esc * 2.0 + 1.0], fl: 0, h: h.clone() }); }
            },
            _ => for g in &md.quieto {
                let c = [base[0] * g.esf[0] + base[4] * g.esf[1] + base[8] * g.esf[2] + base[12], base[1] * g.esf[0] + base[5] * g.esf[1] + base[9] * g.esf[2] + base[13], base[2] * g.esf[0] + base[6] * g.esf[1] + base[10] * g.esf[2] + base[14]];
                for &(s0, sn, mat) in &g.partes { out.push(ItemDin { m: g.m, s0, sn, mat, mm: *base, esf: [c[0], c[1], c[2], g.esf[3] * esc], fl: 0, h: vec![] }); }
            },
        }
    }
    /// lo 3D de los addons en el cuadro: los modelos animados (nextbots) y sueltos, los sprites, la vista del arma del addon
    /// (en primera persona) y su modelo de mundo en la mano (en tercera)
    pub fn gmod_items(&self, ojos: [f32; 3], yaw: f32, pitch: f32, items: &mut Vec<ItemDin>) {
        let d = &self.gmod.mods.dib; let mods = &self.gmod.mods.modelos;
        let t_fis = (self.acum_fis / PASO_FIS).clamp(0.0, 1.0);
        // (la vista del arma en este cuadro: dónde está y la matriz con que se dibuja —su campo visual y su espejo—; lo que el
        // Lua dibuja en la pasada de la vista va con ella: se lleva al espacio de la cámara y se dibuja con esa matriz)
        let vista_base = self.gmod_vista_base(ojos, yaw, pitch);
        for x in &d.modelos {
            let Some(Some(md)) = mods.get(&x.modelo) else { continue };
            if x.vista && vista_base.is_none() { continue; }
            let es = x.escala as f32;
            let base = match x.obj.and_then(|oid| GM_OBJ.with(|g| g.borrow().get(&oid).copied())).and_then(|gid| self.objs.iter().find(|o| o.id == gid)) {
                Some(o) => m4::mul(&matriz_obj(o, t_fis), &mapa::trs([0.0; 3], [0.0, 0.0, 0.0, 1.0], [es; 3])),
                None => mapa::trs([x.pos.x as f32, x.pos.y as f32, x.pos.z as f32], [x.q.x as f32, x.q.y as f32, x.q.z as f32, x.q.w as f32], [es; 3]),
            };
            // (EnableMatrix("RenderMultiply"): en el espacio del modelo, de Source al juego —gmrMatrizJuego—)
            let base = match &x.matriz { Some(mm) => m4::mul(&base, &matriz_juego(mm)), None => base };
            let n0 = items.len();
            match (x.vista, &vista_base) { (true, Some((vb, vinv))) => Self::gm_items_modelo(md, &m4::mul(vb, &m4::mul(vinv, &base)), x.huesos.as_deref(), items), _ => Self::gm_items_modelo(md, &base, x.huesos.as_deref(), items) }
            if x.vista { for it in &mut items[n0..] { it.fl |= FL_SIN_SOMBRA_GM | jxmotor::escena::FL_ARMA; it.esf[3] = -1.0; } }
        }
        for s in &d.sprites {
            let Some(Some(mat)) = self.gmod.mods.mats_spr.get(&clave_spr(&s.mat, s.color)) else { continue };
            if s.vista && vista_base.is_none() { continue; }
            let a_v = |p: [f32; 3]| match (s.vista, &vista_base) { (true, Some((vb, vinv))) => { let m = m4::mul(vb, vinv); [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] } _ => p };
            let [a, b, _c, dd] = s.esq.map(|p| a_v([p.x as f32, p.y as f32, p.z as f32]));
            let (ux, uy) = ([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [dd[0] - a[0], dd[1] - a[1], dd[2] - a[2]]);
            let nz = [ux[1] * uy[2] - ux[2] * uy[1], ux[2] * uy[0] - ux[0] * uy[2], ux[0] * uy[1] - ux[1] * uy[0]]; let ln = (nz[0] * nz[0] + nz[1] * nz[1] + nz[2] * nz[2]).sqrt().max(1e-6);
            let mm = [ux[0], ux[1], ux[2], 0.0, uy[0], uy[1], uy[2], 0.0, nz[0] / ln * 0.01, nz[1] / ln * 0.01, nz[2] / ln * 0.01, 0.0, a[0], a[1], a[2], 1.0];
            let r = ((ux[0] * ux[0] + ux[1] * ux[1] + ux[2] * ux[2]).sqrt() + (uy[0] * uy[0] + uy[1] * uy[1] + uy[2] * uy[2]).sqrt()) * 0.5 + 0.01;
            items.push(ItemDin { m: QUAD_MALLA, s0: 0, sn: 12, mat: *mat, mm, esf: [a[0] + (ux[0] + uy[0]) / 2.0, a[1] + (ux[1] + uy[1]) / 2.0, a[2] + (ux[2] + uy[2]) / 2.0, r], fl: FL_SIN_SOMBRA_GM, h: vec![] });
        }
        // la vista del arma del addon (primera persona): los huesos en los ejes de la cámara, con su campo visual
        if self.camara_ef() == 0 && !self.armas.zoom && self.vehs.jugador.is_none() && self.gmod.arma.is_some() && !self.muerto {
            if let Some(v) = &d.vista { if let Some(Some(md)) = mods.get(&v.modelo) { if md.piel.is_some() {
                let Some((base, _)) = self.gmod_vista_base(ojos, yaw, pitch) else { return };
                let n0 = items.len(); Self::gm_items_modelo(md, &base, Some(&v.huesos), items);
                // (las manos: c_arms con los huesos de la vista)
                if let Some((r, hs, sk, body)) = &v.manos { if let Some(Some(mh)) = mods.get(&Self::gm_clave_op(r, *sk, body)) { if mh.piel.is_some() { Self::gm_items_modelo(mh, &base, Some(hs), items); } } }
                for it in &mut items[n0..] { it.fl |= FL_SIN_SOMBRA_GM | jxmotor::escena::FL_ARMA; it.esf[3] = -1.0; }
            } } }
        }
        // el modelo de mundo en la mano (tercera persona): con el agarre del arma del juego que presta su lugar
        if self.camara_ef() != 0 && self.gmod_arma_mundo() {
            if let (Some(r), Some(base)) = (self.gm_modelo_mundo(), self.gm_base_mano()) {
                if let Some(Some(md)) = mods.get(&r) { Self::gm_items_modelo(md, &base, None, items); }
            }
        }
    }
    /// dónde va el modelo de mundo del arma del addon en la mano (en el juego): la mano del personaje con el agarre del
    /// arma del juego que presta su lugar
    pub(crate) fn gm_base_mano(&self) -> Option<M4> {
        let (pj, paq) = (self.pj.as_ref()?, self.paq.as_ref()?);
        let (mut fm, l) = pj.mano_marco(0)?;
        let gm = &paq.d["gm"]; let g = &gm["armas"][self.armas.def().n]["G"]; let ml = gm["manoR"]["L"].as_f64().unwrap_or(0.0);
        if !g.is_array() || ml <= 0.0 { return None; }
        let k = (l / ml).clamp(0.3, 2.6) as f32; for i in 0..12 { if i % 4 != 3 { fm[i] *= k; } }
        let mut gg = [0.0f32; 16]; for (i, e) in gg.iter_mut().enumerate() { *e = g[i].as_f64().unwrap_or(0.0) as f32; }
        Some(m4::mul(&self.gm_base_pj(pj), &m4::mul(&fm, &gg)))
    }
    /// el lugar del personaje del jugador en el mundo (parado o sentado)
    fn gm_base_pj(&self, pj: &Personaje) -> M4 { let jp = self.jug.pos; pj.base_sentado().unwrap_or_else(|| personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw)) }
    /// los huesos del personaje del jugador con los nombres de GMod (el Lua los pide: LookupBone, GetBonePosition...) y el
    /// arma en la mano (sus enganches: la hoja del sable). Los ejes de Source: adelante a lo largo del hueso —el Y de
    /// Mixamo—, izquierda y arriba
    pub(crate) fn gm_huesos_jug(&self) -> (Vec<(String, jxgmod::mates::V3, [jxgmod::mates::V3; 3])>, Option<(jxgmod::mates::V3, jxgmod::mates::Quat)>) {
        use jxgmod::mates::V3 as V;
        const VB: [(&str, &str); 21] = [("Hips", "Pelvis"), ("Spine", "Spine"), ("Spine1", "Spine1"), ("Spine2", "Spine2"), ("Spine2", "Spine4"), ("Neck", "Neck1"), ("Head", "Head1"),
            ("LeftShoulder", "L_Clavicle"), ("LeftArm", "L_UpperArm"), ("LeftForeArm", "L_Forearm"), ("LeftHand", "L_Hand"), ("RightShoulder", "R_Clavicle"), ("RightArm", "R_UpperArm"),
            ("RightForeArm", "R_Forearm"), ("RightHand", "R_Hand"), ("LeftUpLeg", "L_Thigh"), ("LeftLeg", "L_Calf"), ("LeftFoot", "L_Foot"), ("RightUpLeg", "R_Thigh"), ("RightLeg", "R_Calf"), ("RightFoot", "R_Foot")];
        let Some(pj) = self.pj.as_ref() else { return (Vec::new(), None) };
        let b = self.gm_base_pj(pj);
        let col = |w: &M4, c: usize, k: f64| { let v = V { x: w[c * 4] as f64 * k, y: w[c * 4 + 1] as f64 * k, z: w[c * 4 + 2] as f64 * k }; v.norm() };
        let mut l = Vec::with_capacity(VB.len());
        for (n, vb) in VB { if let Some(m) = pj.hueso(n) { let w = m4::mul(&b, &m); l.push((format!("ValveBiped.Bip01_{vb}"), V { x: w[12] as f64, y: w[13] as f64, z: w[14] as f64 }, [col(&w, 1, 1.0), col(&w, 0, -1.0), col(&w, 2, 1.0)])); } }
        let am = self.gm_base_mano().map(|m| (V { x: m[12] as f64, y: m[13] as f64, z: m[14] as f64 }, quat_de(&m)));
        (l, am)
    }
}
/// la clave de un material de sprite con su color (de a 1/32 para no armar uno por cada matiz)
fn clave_spr(mat: &str, c: [f32; 4]) -> String { let q = |x: f32| (x.clamp(0.0, 1.0) * 32.0).round() as u8; format!("{}#{}.{}.{}.{}", mat, q(c[0]), q(c[1]), q(c[2]), q(c[3])) }
/// el giro de una matriz (sin su escala)
fn quat_de(m: &M4) -> jxgmod::mates::Quat {
    let c = |k: usize| { let (x, y, z) = (m[k * 4] as f64, m[k * 4 + 1] as f64, m[k * 4 + 2] as f64); let l = (x * x + y * y + z * z).sqrt().max(1e-9); [x / l, y / l, z / l] };
    let (a, b, d) = (c(0), c(1), c(2));
    // (columnas a, b, d: r[fila][col])
    let (r00, r11, r22) = (a[0], b[1], d[2]); let tr = r00 + r11 + r22;
    let (x, y, z, w) = if tr > 0.0 { let s = (tr + 1.0).sqrt() * 2.0; ((b[2] - d[1]) / s, (d[0] - a[2]) / s, (a[1] - b[0]) / s, 0.25 * s) }
        else if r00 > r11 && r00 > r22 { let s = (1.0 + r00 - r11 - r22).sqrt() * 2.0; (0.25 * s, (b[0] + a[1]) / s, (d[0] + a[2]) / s, (b[2] - d[1]) / s) }
        else if r11 > r22 { let s = (1.0 + r11 - r00 - r22).sqrt() * 2.0; ((b[0] + a[1]) / s, 0.25 * s, (d[1] + b[2]) / s, (d[0] - a[2]) / s) }
        else { let s = (1.0 + r22 - r00 - r11).sqrt() * 2.0; ((d[0] + a[2]) / s, (d[1] + b[2]) / s, 0.25 * s, (a[1] - b[0]) / s) };
    jxgmod::mates::Quat::new(x, y, z, w).norm()
}
/// una VMatrix de Source (filas, pulgadas) a una matriz del juego (columnas, metros): gmrMatrizJuego
fn matriz_juego(m: &[f32; 16]) -> M4 {
    const E: [usize; 3] = [1, 2, 0]; let mut o = [0.0f32; 16];
    for j in 0..3 { for i in 0..3 { o[j * 4 + i] = m[E[i] * 4 + E[j]]; } }
    for i in 0..3 { o[12 + i] = m[E[i] * 4 + 3] * GS; } o[15] = 1.0; o
}
impl Juego {
    /// la vista del arma del addon (primera persona): la matriz con que se dibuja (su lugar, su campo visual y su espejo) y
    /// la inversa de su lugar (para llevar a ella lo que el Lua dibuja en la pasada de la vista); None si no se ve
    pub(crate) fn gmod_vista_base(&self, ojos: [f32; 3], yaw: f32, pitch: f32) -> Option<(M4, M4)> {
        if !(self.camara_ef() == 0 && !self.armas.zoom && self.vehs.jugador.is_none() && self.gmod.arma.is_some() && !self.muerto) { return None; }
        let v = self.gmod.mods.dib.vista.as_ref()?; let md = self.gmod.mods.modelos.get(&v.modelo)?.as_ref()?; md.piel.as_ref()?;
        let fov = if self.fov_b > 0.0 { self.fov_b } else { self.aj.fov as f32 };
        let kf = (fov.to_radians() / 2.0).tan() / ((v.fov.clamp(20.0, 120.0) as f32).to_radians() / 2.0).tan() / 0.75;
        let fx = if v.flip { -1.0 } else { 1.0 };
        let (p0, q0) = match v.lugar { Some((p, q)) => ([p.x as f32, p.y as f32, p.z as f32], [q.x as f32, q.y as f32, q.z as f32, q.w as f32]), None => (ojos, qcam(yaw, pitch)) };
        let lugar = mapa::trs(p0, q0, [1.0; 3]);
        Some((m4::mul(&lugar, &mapa::trs([0.0; 3], [0.0, 0.0, 0.0, 1.0], [kf * fx, kf, 1.0])), m4::inv(&lugar)))
    }
}
/// (los sprites y la vista no hacen sombra)
const FL_SIN_SOMBRA_GM: u32 = jxmotor::escena::FL_SIN_SOMBRA;
#[allow(dead_code)]
fn _usar(_s: &Sprite3) {}
