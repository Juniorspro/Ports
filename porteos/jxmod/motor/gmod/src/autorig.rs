//! Los personajes que vienen como prop quieto (juego/gmod_autorig.js): un .mdl sin esqueleto (uno o dos huesos) con forma
//! de persona —de pie, con dos piernas separadas abajo— recibe el esqueleto de Valve por defecto, el mismo para todos,
//! ajustado a la malla (la entrepierna, el ancho de cada pierna, el cuello donde la malla se angosta, los brazos hasta la
//! punta más lejana de cada lado) y cada vértice se reparte entre los huesos más cercanos de su zona (las piernas por
//! lado, los brazos por lado, el resto columna y cabeza). Después es un modelo de jugador más (gmod_pm.rs). Las mismas
//! cuentas que la web (comparado en node: tests/autorig.rs).

use crate::formatos::{Hueso, Mdl, Vertices};

const GM_S: f64 = 0.0254;

/// los ejes del personaje (gmarEjes): z arriba en Source; el costado es el eje horizontal más ancho a la altura del pecho
#[derive(Clone, Copy, Debug)]
pub struct Ejes { pub z0: f64, pub h: f64, pub c: [f64; 2], pub f: [f64; 2], pub l: [f64; 2] }
fn p(v: &Vertices, i: usize) -> [f64; 3] { let x = v.pos[i]; [x[0] as f64, x[1] as f64, x[2] as f64] }

pub fn ejes(v: &Vertices) -> Option<Ejes> {
    let n = v.n; let (mut z0, mut z1) = (f64::INFINITY, f64::NEG_INFINITY);
    for i in 0..n { let z = p(v, i)[2]; if z < z0 { z0 = z; } if z > z1 { z1 = z; } }
    let h = z1 - z0; if !(h > 0.0) { return None; }
    let (mut ax, mut ay) = ([f64::INFINITY, f64::NEG_INFINITY], [f64::INFINITY, f64::NEG_INFINITY]); let (mut cx, mut cy, mut m) = (0.0, 0.0, 0usize);
    for i in 0..n { let q = p(v, i); let z = (q[2] - z0) / h; if z < 0.6 || z > 0.8 { continue; } let (x, y) = (q[0], q[1]); ax[0] = ax[0].min(x); ax[1] = ax[1].max(x); ay[0] = ay[0].min(y); ay[1] = ay[1].max(y); cx += x; cy += y; m += 1; }
    if m == 0 { return None; }
    let lat_x = ax[1] - ax[0] > ay[1] - ay[0];
    let f = if lat_x { [0.0, 1.0] } else { [1.0, 0.0] };
    let (mut pie, mut tob, mut np, mut nt) = (0.0, 0.0, 0usize, 0usize);
    for i in 0..n { let q = p(v, i); let z = (q[2] - z0) / h; let fw = q[0] * f[0] + q[1] * f[1]; if z < 0.03 { pie += fw; np += 1; } else if z < 0.12 { tob += fw; nt += 1; } }
    let mut sg = 1.0; if np > 0 && nt > 0 { let d = pie / np as f64 - tob / nt as f64; if d.abs() > h * 0.012 { sg = d.signum(); } }
    let ff = [f[0] * sg, f[1] * sg];
    Some(Ejes { z0, h, c: [cx / m as f64, cy / m as f64], f: ff, l: [-ff[1], ff[0]] })
}
/// las piernas (gmarPiernas): el corte del medio, el costado de cada pierna y la entrepierna (en el alto, de 0 a 1)
#[derive(Clone, Copy, Debug)]
pub struct Piernas { pub corte: f64, pub li: f64, pub ld: f64, pub zc: f64 }
pub fn piernas(v: &Vertices, e: &Ejes) -> Option<Piernas> {
    let h = e.h; let cl = e.c[0] * e.l[0] + e.c[1] * e.l[1];
    let lat = |i: usize| { let q = p(v, i); q[0] * e.l[0] + q[1] * e.l[1] - cl };
    let franja = |za: f64, zb: f64| -> Vec<f64> { (0..v.n).filter(|&i| { let z = (p(v, i)[2] - e.z0) / h; z >= za && z < zb }).map(lat).collect() };
    let l = franja(0.06, 0.22); if l.len() < 16 { return None; }
    let (mut a, mut b) = (f64::INFINITY, f64::NEG_INFINITY); for &x in &l { a = a.min(x); b = b.max(x); }
    let ancho = b - a; if ancho < 0.06 * h { return None; }
    const NB: usize = 24; let mut hist = [0usize; NB];
    for &x in &l { hist[(((x - a) / ancho * NB as f64).floor() as usize).min(NB - 1)] += 1; }
    let (mut g0, mut g1) = (-1i64, -1i64);
    let k0 = (NB as f64 * 0.3).floor() as usize; let k1 = (NB as f64 * 0.7).ceil() as usize;
    for k in k0..=k1 { if hist[k] as f64 <= l.len() as f64 * 0.004 { if g0 < 0 { g0 = k as i64; } g1 = k as i64; } }
    if g0 < 0 { return None; }
    let izq: usize = hist[..g0 as usize].iter().sum(); let der: usize = hist[(g1 + 1) as usize..].iter().sum();
    if (izq as f64) < l.len() as f64 * 0.18 || (der as f64) < l.len() as f64 * 0.18 { return None; }
    let corte = a + ((g0 + g1 + 1) as f64 / 2.0) / NB as f64 * ancho;
    let (mut si, mut ni, mut sd, mut nd) = (0.0, 0usize, 0.0, 0usize); for &x in &l { if x < corte { si += x; ni += 1; } else { sd += x; nd += 1; } }
    // la entrepierna: subiendo, la primera franja donde el medio tiene vértices
    let mut zc = 0.22; let mut z = 0.22f64;
    while z < 0.7 { let f2 = franja(z, z + 0.02); if f2.iter().any(|x| (x - corte).abs() < 0.025 * h) { zc = z; break; } zc = z; z += 0.02; }
    Some(Piernas { corte: corte + cl, li: si / ni as f64 + cl, ld: sd / nd as f64 + cl, zc })
}
/// ¿un prop con forma de persona? (gmarEsPersona: de pie, con dos piernas separadas abajo y el cuerpo unido arriba)
pub fn es_persona(m: &Mdl) -> bool {
    let Some(v) = &m.v else { return false }; if v.n < 120 { return false; }
    let Some(e) = ejes(v) else { return false };
    let alto = e.h * GM_S; if !(0.25..=8.0).contains(&alto) { return false; }
    let (mut f0, mut f1, mut l0, mut l1) = (f64::INFINITY, f64::NEG_INFINITY, f64::INFINITY, f64::NEG_INFINITY);
    for i in 0..v.n { let q = p(v, i); let fw = q[0] * e.f[0] + q[1] * e.f[1]; let lt = q[0] * e.l[0] + q[1] * e.l[1]; f0 = f0.min(fw); f1 = f1.max(fw); l0 = l0.min(lt); l1 = l1.max(lt); }
    if e.h < 1.15 * (f1 - f0) || (l1 - l0) < 0.12 * e.h { return false; }
    piernas(v, &e).is_some()
}
/// ¿un .mdl de un addon es un personaje que se puede poner? (gmarDeAddon) 'vb': con esqueleto de Valve; 'auto': un prop
/// quieto con forma de persona (se le arma el rig); None: ninguno. `geo`: el mismo con su geometría (si hace falta mirarla)
pub fn tipo(ruta: &str, m: &Mdl, geo: &dyn Fn() -> Option<std::rc::Rc<Mdl>>) -> Option<&'static str> {
    let r = ruta.to_lowercase();
    if !r.starts_with("models/") || !r.ends_with(".mdl") || fuera(&r) { return None; }
    let hs = &m.huesos; let tiene = |n: &str| hs.iter().any(|h| h.n.eq_ignore_ascii_case(n));
    if tiene("valvebiped.bip01_pelvis") && tiene("valvebiped.bip01_l_thigh") && tiene("valvebiped.bip01_head1") { return Some("vb"); }
    if hs.len() > 2 { return None; }
    let alto = (m.hull[1][2] - m.hull[0][2]) as f64 * GM_S; if alto < 0.25 || alto > 8.0 { return None; }
    let g = geo()?; if es_persona(&g) { Some("auto") } else { None }
}

/// GMAR_FUERA: lo que no es un personaje por su ruta (modelos de jugador, vistas, armas, pedazos, animaciones, manos, brazos)
pub fn fuera(r: &str) -> bool {
    let r = r.to_lowercase(); if r.starts_with("models/player/") { return true; }
    let pal = |c: Option<char>| c.map(|c| c.is_ascii_alphanumeric() || c == '_').unwrap_or(false);
    // (una palabra con «s» opcional y que termina ahí: hands?\b, arms?\b, _anims?\b)
    let termina = |resto: &str| { let mut c = resto.chars(); let a = c.next(); if a == Some('s') && !pal(c.clone().next()) { return true; } !pal(a) };
    for (i, _) in r.match_indices('/') {
        let x = &r[i + 1..];
        if x.starts_with("v_") || x.starts_with("w_") || x.starts_with("c_") || x.starts_with("gib/") || x.starts_with("gibs/") { return true; }
        if let Some(y) = x.strip_prefix("hand") { if termina(y) { return true; } }
        if let Some(y) = x.strip_prefix("arm") { if termina(y) { return true; } }
        for (k, _) in x.match_indices("gib") { if x[k + 3..].chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) { return true; } }
        for (k, _) in x.match_indices("_anim") { if termina(&x[k + 5..]) { return true; } }
    }
    false
}
/// gmarRig: el esqueleto de Valve por defecto ajustado a la malla y los pesos de cada vértice. El .mdl nuevo tiene esos
/// huesos (sin secuencias ni animaciones) y la misma geometría
pub fn rig(m: &Mdl) -> Option<Mdl> {
    let v = m.v.as_ref()?; let e = ejes(v)?; let pr = piernas(v, &e)?;
    let (h, z0, f, l) = (e.h, e.z0, e.f, e.l);
    let cl = e.c[0] * l[0] + e.c[1] * l[1]; let cf = e.c[0] * f[0] + e.c[1] * f[1];
    let w_ = |fw: f64, lt: f64, z: f64| [f[0] * fw + l[0] * lt, f[1] * fw + l[1] * lt, z0 + z * h];
    let lat = |i: usize| { let q = p(v, i); q[0] * l[0] + q[1] * l[1] }; let fwd = |i: usize| { let q = p(v, i); q[0] * f[0] + q[1] * f[1] }; let alt = |i: usize| (p(v, i)[2] - z0) / h;
    let _ = cl;
    let zc = pr.zc; let (lat_d, lat_i) = (pr.li, pr.ld); let lat_c = (lat_d + lat_i) / 2.0;
    let ancho_en = |za: f64, zb: f64| -> Option<[f64; 2]> {
        let mut xs: Vec<f64> = (0..v.n).filter(|&i| { let z = alt(i); z >= za && z < zb }).map(|i| lat(i) - lat_c).collect();
        xs.sort_by(|a, b| a.partial_cmp(b).unwrap()); if xs.len() < 4 { return None; }
        let mut k = match xs.iter().position(|&x| x >= 0.0) { Some(k) => k, None => xs.len() - 1 };
        let (mut a, mut b) = (k, k); while a > 0 && xs[a] - xs[a - 1] < 0.04 * h { a -= 1; } while b < xs.len() - 1 && xs[b + 1] - xs[b] < 0.04 * h { b += 1; }
        k = 0; let _ = k; Some([xs[a], xs[b]])
    };
    // el cuello: lo más angosto entre el 62 y el 94 % del alto (si no se angosta, al 82 %)
    let (mut zn, mut wmin, mut wmed) = (0.82f64, f64::INFINITY, vec![]);
    let mut z = 0.62f64; while z < 0.94 { if let Some(a) = ancho_en(z, z + 0.02) { let w = a[1] - a[0]; wmed.push(w); if w < wmin { wmin = w; zn = z + 0.01; } } z += 0.02; }
    wmed.sort_by(|a, b| a.partial_cmp(b).unwrap()); if !(!wmed.is_empty() && wmin < 0.85 * wmed[wmed.len() >> 1]) { zn = 0.82; }
    zn = zn.max(zc + 0.2);
    let zp = zc + 0.04; let zhombro = (zp + 0.12).max(zn - 0.05); let ah = ancho_en(zhombro - 0.06, zhombro).unwrap_or([-0.12 * h, 0.12 * h]);
    let hombro = (0.06 * h).max((0.2 * h).min((-ah[0]).min(ah[1]) * 0.9));
    let j_hom_i = [cf, lat_c + hombro, zhombro]; let j_hom_d = [cf, lat_c - hombro, zhombro];
    let mano = |s: f64, jh: [f64; 3]| -> Option<[f64; 3]> {
        let (mut best, mut bd) = (None, 0.0);
        for i in 0..v.n { let lt = lat(i) - lat_c; if s * lt < hombro * 1.05 || alt(i) < zc { continue; } let d = ((fwd(i) - jh[0]).powi(2) + (lt + lat_c - jh[1]).powi(2) + ((alt(i) - jh[2]) * h / h).powi(2)).sqrt(); if d > bd { bd = d; best = Some([fwd(i), lt + lat_c, alt(i)]); } }
        best
    };
    struct Brazo { co: [f64; 3], mu: [f64; 3], tip: [f64; 3] }
    let brazo = |jh: [f64; 3], tip: Option<[f64; 3]>, s: f64| -> Brazo {
        let tip = match tip { Some(t) if ((t[0] - jh[0]).powi(2) + ((t[1] - jh[1]) / h).powi(2) + (t[2] - jh[2]).powi(2)).sqrt() >= 0.04 => t, _ => [jh[0], jh[1] + s * 0.04 * h, (zc + 0.05).max(jh[2] - 0.3)] };
        let mu = [jh[0] + (tip[0] - jh[0]) * 0.85, jh[1] + (tip[1] - jh[1]) * 0.85, jh[2] + (tip[2] - jh[2]) * 0.85];
        let co = [(jh[0] + mu[0]) / 2.0 - 0.02 * h, (jh[1] + mu[1]) / 2.0, (jh[2] + mu[2]) / 2.0]; Brazo { co, mu, tip }
    };
    let bi = brazo(j_hom_i, mano(1.0, j_hom_i), 1.0); let bd = brazo(j_hom_d, mano(-1.0, j_hom_d), -1.0);
    let zt = 0.03f64.max(0.08f64.min(zc * 0.12));
    struct Pierna { ca: [f64; 3], ro: [f64; 3], to: [f64; 3], pu: [f64; 3] }
    let pierna = |lc: f64| Pierna { ca: [cf, lc, zc], ro: [cf + 0.015 * h, lc, (zc + zt) / 2.0], to: [cf, lc, zt], pu: [cf + 0.07 * h, lc, 0.01] };
    let (pi_, pd) = (pierna(lat_i), pierna(lat_d));
    let zs = |k: f64| zp + (zn - zp) * k; let zcab = zn + (1.0 - zn) * 0.35;
    let mut j: Vec<(String, i32, [f64; 3])> = vec![("ValveBiped.Bip01_Pelvis".into(), -1, [cf, lat_c, zp]), ("ValveBiped.Bip01_Spine".into(), 0, [cf, lat_c, zs(0.18)]), ("ValveBiped.Bip01_Spine1".into(), 1, [cf, lat_c, zs(0.38)]),
        ("ValveBiped.Bip01_Spine2".into(), 2, [cf, lat_c, zs(0.58)]), ("ValveBiped.Bip01_Spine4".into(), 3, [cf, lat_c, zs(0.8)]), ("ValveBiped.Bip01_Neck1".into(), 4, [cf, lat_c, zn]), ("ValveBiped.Bip01_Head1".into(), 5, [cf, lat_c, zcab])];
    for (vn, b, pn, s) in [("L", &bi, &pi_, 1.0f64), ("R", &bd, &pd, -1.0)] {
        let cla = j.len() as i32;
        j.push((format!("ValveBiped.Bip01_{vn}_Clavicle"), 4, [cf, lat_c + s * 0.03 * h, zhombro])); j.push((format!("ValveBiped.Bip01_{vn}_UpperArm"), cla, if s > 0.0 { j_hom_i } else { j_hom_d }));
        j.push((format!("ValveBiped.Bip01_{vn}_Forearm"), cla + 1, b.co)); j.push((format!("ValveBiped.Bip01_{vn}_Hand"), cla + 2, b.mu));
        let mu = j.len() as i32;
        j.push((format!("ValveBiped.Bip01_{vn}_Thigh"), 0, pn.ca)); j.push((format!("ValveBiped.Bip01_{vn}_Calf"), mu, pn.ro)); j.push((format!("ValveBiped.Bip01_{vn}_Foot"), mu + 1, pn.to)); j.push((format!("ValveBiped.Bip01_{vn}_Toe0"), mu + 2, pn.pu));
    }
    let pm: Vec<[f64; 3]> = j.iter().map(|x| w_(x.2[0], x.2[1], x.2[2])).collect();
    let huesos: Vec<Hueso> = j.iter().enumerate().map(|(i, (n, pa, _))| {
        let pp = pm[i]; let q = if *pa >= 0 { pm[*pa as usize] } else { [0.0; 3] };
        Hueso { n: n.clone(), pa: *pa, pos: [(pp[0] - q[0]) as f32, (pp[1] - q[1]) as f32, (pp[2] - q[2]) as f32], q: [0.0, 0.0, 0.0, 1.0], rot: [0.0; 3], ps: [0.0; 3], rs: [0.0; 3],
            p2b: [1.0, 0.0, 0.0, -pp[0] as f32, 0.0, 1.0, 0.0, -pp[1] as f32, 0.0, 0.0, 1.0, -pp[2] as f32], superficie: String::new(), proc: None }
    }).collect();
    // ---- pesos: cada vértice entre los huesos de su zona, según la distancia a cada segmento (hueso → su punta) ----
    let ix = |n: &str| j.iter().position(|x| x.0 == format!("ValveBiped.Bip01_{n}")).unwrap();
    let mut punta: Vec<Option<usize>> = vec![None; j.len()]; for (i, x) in j.iter().enumerate() { if x.1 >= 0 && punta[x.1 as usize].is_none() { punta[x.1 as usize] = Some(i); } }
    let p_punta = |i: usize| -> [f64; 3] {
        let n = &j[i].0;
        if n.ends_with("_Hand") { let b = if n.contains("_L_") { &bi } else { &bd }; return w_(b.tip[0], b.tip[1], b.tip[2]); }
        if n.ends_with("Head1") { return w_(cf, lat_c, 1.0); }
        if n.ends_with("Toe0") { let q = pm[i]; return [q[0] + f[0] * 0.03 * h, q[1] + f[1] * 0.03 * h, q[2]]; }
        pm[punta[i].unwrap_or(i)]
    };
    let seg: Vec<([f64; 3], [f64; 3])> = (0..j.len()).map(|i| (pm[i], p_punta(i))).collect();
    let d_seg = |q: [f64; 3], s: &([f64; 3], [f64; 3])| { let (a, b) = s; let ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; let ap = [q[0] - a[0], q[1] - a[1], q[2] - a[2]]; let l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]; let l2 = if l2 == 0.0 { 1e-9 } else { l2 }; let t = ((ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l2).clamp(0.0, 1.0); ((ap[0] - ab[0] * t).powi(2) + (ap[1] - ab[1] * t).powi(2) + (ap[2] - ab[2] * t).powi(2)).sqrt() };
    let tronco: Vec<usize> = ["Pelvis", "Spine", "Spine1", "Spine2", "Spine4", "Neck1", "Head1", "L_Clavicle", "R_Clavicle", "L_Thigh", "R_Thigh"].iter().map(|n| ix(n)).collect();
    let zona = |k: &str, v: &str| -> Vec<usize> { if k == "b" { ["Spine4".to_string(), format!("{v}_Clavicle"), format!("{v}_UpperArm"), format!("{v}_Forearm"), format!("{v}_Hand")].iter().map(|n| ix(n)).collect() } else { ["Pelvis".to_string(), format!("{v}_Thigh"), format!("{v}_Calf"), format!("{v}_Foot"), format!("{v}_Toe0")].iter().map(|n| ix(n)).collect() } };
    let (b_l, b_r, p_l, p_r) = (zona("b", "L"), zona("b", "R"), zona("p", "L"), zona("p", "R"));
    let eps = (0.02 * h).powi(2);
    let mut hb = vec![[0u8; 3]; v.n]; let mut w = vec![[0f32; 3]; v.n];
    for i in 0..v.n {
        let q = p(v, i); let zz = alt(i); let lt = lat(i) - lat_c;
        let zn_: &Vec<usize> = if zz < zc - 0.015 { if lat(i) > pr.corte { &p_l } else { &p_r } } else if lt.abs() > hombro * 0.95 && zz > zc + 0.02 { if lt > 0.0 { &b_l } else { &b_r } } else { &tronco };
        let mut d: Vec<(usize, f64)> = zn_.iter().map(|&k| (k, d_seg(q, &seg[k]))).collect();
        d.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap()); d.truncate(3);
        let ws: Vec<f64> = d.iter().map(|x| 1.0 / (x.1 * x.1 + eps).powi(2)).collect(); let tot: f64 = ws.iter().sum();
        for k in 0..3 { hb[i][k] = d.get(k).map(|x| x.0 as u8).unwrap_or(0); w[i][k] = if d.get(k).is_some() { (ws[k] / tot) as f32 } else { 0.0 }; }
    }
    let mut v2 = v.clone(); v2.hb = hb; v2.w = w;
    Some(Mdl { version: m.version, nombre: m.nombre.clone(), hull: m.hull, flags: m.flags, huesos, texturas: m.texturas.clone(), carpetas: m.carpetas.clone(), pieles: m.pieles.clone(), adjuntos: vec![], cuerpos: m.cuerpos.clone(),
        anims: vec![], secuencias: vec![], pose_params: vec![], pose_rangos: vec![], ani_nom: String::new(), bloques: vec![], b: m.b.clone(), ani: None, v: Some(v2), mallas: m.mallas.clone(), mallas_lejos: vec![] })
}
