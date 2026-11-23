//! Un mapa del juego armado en Rust, desde el paquete: lo mismo que hacían cargarMapa (mundo.js), Modelo (modelo.js),
//! matGL (gl.js) y lo que el JS le mandaba al motor (gmod_personal.js): las mallas, las texturas, los materiales, el
//! cielo, la luz y la lista de cosas a dibujar con sus matrices.
use crate::paquete::Paquete;
use jxmotor::escena::{Cabecera, Caras, Cielo, Escena, ItemDin, Luz, Malla, Mat, Niebla, Tex};
use jxmotor::mat::{self as m4, M4};
use serde_json::Value;

/// los mapas de Garry's Mod 10 (su cielo es el «painted» de GMod)
pub const MAPAS_GMOD: [&str; 2] = ["RB_Construct", "RB_Flatgrass"];

/// lo que queda armado de un mapa
pub struct Mapa {
    pub nombre: String,
    /// los recursos para el motor (mallas, texturas, materiales, cielo)
    pub esc: Escena,
    /// lo que se dibuja (fijo: el mapa)
    pub items: Vec<ItemDin>,
    /// la luz del cuadro (sol, ambiente, niebla, en lineal: lo que va en la cabecera del cuadro)
    pub luz: Luz,
    /// las luces del mapa (puntuales y focos): posición y radio, color, dirección y coseno del cono
    pub luces: Vec<[f32; 12]>,
    /// dónde aparece el jugador (posición y hacia dónde mira)
    pub spawns: Vec<([f32; 3], Option<f32>)>,
    /// hasta dónde se ve
    pub lejos: f32,
}

fn f(v: &Value) -> f32 { v.as_f64().unwrap_or(0.0) as f32 }
fn v3(v: &Value, d: [f32; 3]) -> [f32; 3] { if v.is_array() { [f(&v[0]), f(&v[1]), f(&v[2])] } else { d } }
fn srgb(c: f32) -> f32 { c.max(0.0).powf(2.2) }
fn srgb3(a: [f32; 3]) -> [f32; 3] { [srgb(a[0]), srgb(a[1]), srgb(a[2])] }

/// matriz desde posición, rotación (x, y, z, w) y escala (m4trs de gl.js)
pub fn trs(p: [f32; 3], r: [f32; 4], s: [f32; 3]) -> M4 {
    let (x, y, z, w) = (r[0], r[1], r[2], r[3]); let (sx, sy, sz) = (s[0], s[1], s[2]);
    [(1.0 - 2.0 * (y * y + z * z)) * sx, 2.0 * (x * y + z * w) * sx, 2.0 * (x * z - y * w) * sx, 0.0,
     2.0 * (x * y - z * w) * sy, (1.0 - 2.0 * (x * x + z * z)) * sy, 2.0 * (y * z + x * w) * sy, 0.0,
     2.0 * (x * z + y * w) * sz, 2.0 * (y * z - x * w) * sz, (1.0 - 2.0 * (x * x + y * y)) * sz, 0.0,
     p[0], p[1], p[2], 1.0]
}
fn escala(m: &M4) -> f32 { [0, 4, 8].iter().map(|&o| (m[o] * m[o] + m[o + 1] * m[o + 1] + m[o + 2] * m[o + 2]).sqrt()).fold(0.0, f32::max) }
fn punto(m: &M4, p: [f32; 3]) -> [f32; 3] { [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }

/// la rugosidad, el metal y el reflejo de frente de un material, por su nombre (pbrDe de gl.js)
pub fn pbr_de(nombre: &str) -> [f32; 3] {
    let s = nombre.to_lowercase();
    let hay = |l: &[&str]| l.iter().any(|w| s.contains(w));
    let empieza = |l: &[&str]| l.iter().any(|w| s.starts_with(w));
    if hay(&["glass", "lens", "transp", "windows", "window", "screen", "tv", "monitor"]) { return [0.06, 0.0, 0.06]; }
    if hay(&["rubber", "wheel", "tire", "luggage_cart_wheels"]) || s == "w4" { return [0.88, 0.0, 0.03]; }
    // (/^body|bodyv\d|caterham|4carz|copter|aircraft|police_car|inflatable|^engine|bike2/)
    if empieza(&["body", "engine"]) || bodyv(&s) || hay(&["caterham", "4carz", "copter", "aircraft", "police_car", "inflatable", "bike2"]) { return [0.32, 0.25, 0.05]; }
    if hay(&["akm", "akcolor", "smg", "sniper", "shotgun", "pistol", "revolver", "rocketlauncher", "crossbow", "gravtool", "matter", "scope", "armcolor", "bat", "melee"]) { return [0.5, 0.3, 0.04]; }
    if hay(&["metal", "rail", "catwalk", "container", "fence", "support", "rocket", "scifi", "generator", "oxygen", "barrel", "fireext", "fridge", "battery", "spotlight", "lamp", "traffic", "gaspump", "utility", "wallpanel", "vending", "manhole", "structure", "wire_", "laser", "jumpgate", "sink", "gs_box"]) { return [0.45, 0.45, 0.05]; }
    if hay(&["hair"]) { return [0.5, 0.0, 0.04]; }
    if hay(&["eye", "teeth", "lashes"]) { return [0.25, 0.0, 0.04]; }
    if hay(&["head", "body", "suit", "shoes", "_top", "bottom", "di_", "soldier", "prisoner", "pilot", "engineer", "corpse", "hat", "hands", "gloves", "zombie", "wonamman", "delovoy", "special", "arms", "mask"]) { return [0.66, 0.0, 0.035]; }
    if hay(&["road", "asphalt", "concrete", "sidewalk", "cordon", "parking", "rooftop", "terrain", "desert", "grass", "rock", "sand", "ground", "floor", "wall", "brick", "roof", "bridge", "city", "pixelactive", "warehouse", "tile", "ceiling"]) { return [0.9, 0.0, 0.03]; }
    if hay(&["wood", "plank", "log", "chair", "bench", "table", "desk", "book", "door", "platform", "frames", "meuble", "chevet", "sieges", "petitbureau", "crate", "box", "carton"]) { return [0.78, 0.0, 0.035]; }
    [0.72, 0.0, 0.04]
}
/// (bodyv seguido de un dígito, como /bodyv\d/)
fn bodyv(s: &str) -> bool { s.match_indices("bodyv").any(|(i, _)| s[i + 5..].chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false)) }

/// un material del juego como lo usa el motor (matGL de gl.js y lo que mandaba gmod_personal.js); None si no se dibuja
pub fn material(d: &Value, i: usize) -> Option<Mat> {
    let x = &d["mt"][i]; let txs = &d["tx"];
    let sh = x["sh"].as_str().unwrap_or(""); let fl = &x["f"]; let tt = &x["tt"]; let nombre = x["n"].as_str().unwrap_or("");
    let mobile = sh.starts_with("Mobile/");
    let mut c = if x["c"].is_array() && !mobile { [f(&x["c"][0]), f(&x["c"][1]), f(&x["c"][2]), f(&x["c"][3])] } else { [1.0; 4] };
    let mut tex: i64 = x["t"].as_i64().unwrap_or(i64::MIN);
    let mut st = [1.0, 1.0, 0.0, 0.0];
    if x["ts"].is_array() { st = [f(&x["ts"][0]), f(&x["ts"][1]), f(&x["to"][0]), f(&x["to"][1])]; }
    let mode = fl["_Mode"].as_f64().unwrap_or(0.0) as i32;
    let (mut blend, mut cut, mut unlit, mut add, mut oculto, mut fol) = (false, false, false, false, false, false);
    if sh == "Standard" && mode >= 2 { blend = true; }
    if sh == "Standard" && mode == 1 { cut = true; }
    // (SH_BLEND de gl.js: /Transparent|Particles|Fade/)
    if ["Transparent", "Particles", "Fade"].iter().any(|k| sh.contains(k)) { blend = true; }
    if ["Unlit", "Particles", "GUI", "Grass"].iter().any(|k| sh.contains(k)) { unlit = true; }
    if sh.contains("Grass") { cut = true; blend = false; fol = true; }
    if sh.contains("Additive") { add = true; }
    if sh.contains("ShadowDrawer") || sh.contains("GUI/Text") { oculto = true; }
    let mut em = [0.0; 3];
    if sh == "Standard" && x["e"].is_array() { em = [f(&x["e"][0]) * 0.6, f(&x["e"][1]) * 0.6, f(&x["e"][2]) * 0.6]; }
    let mut terr: Option<Vec<(i64, f32, f32)>> = None;
    if sh.contains("Terrain To Mesh") && tt["_V_T2M_Control"].is_array() {
        let capa = |k: usize| -> (i64, f32, f32) { let t = &tt[format!("_V_T2M_Splat{k}")]; if !t.is_array() { return (-1, 1.0, 1.0); } let u = fl[format!("_V_T2M_Splat{k}_uvScale")].as_f64().unwrap_or(1.0) as f32; (t[0].as_i64().unwrap_or(-1), f(&t[1]) * u, f(&t[2]) * u) };
        terr = Some(vec![capa(1), capa(2), capa(3)]);
        tex = tt["_V_T2M_Control"][0].as_i64().unwrap_or(-1);
    }
    if tex == i64::MIN && tt["_MainTex"].is_array() { tex = tt["_MainTex"][0].as_i64().unwrap_or(-1); st = [f(&tt["_MainTex"][1]), f(&tt["_MainTex"][2]), f(&tt["_MainTex"][3]), f(&tt["_MainTex"][4])]; }
    if tex == i64::MIN { tex = -1; }
    let alfa_tex = tex >= 0 && txs[tex as usize]["a"].as_i64().unwrap_or(0) != 0;
    if alfa_tex && !blend && ["Cutout", "Vertex", "Standard"].iter().any(|k| sh.contains(k)) && mode != 0 { cut = true; }
    let nl = nombre.to_lowercase();
    if (nl.contains("leaf") || nl.contains("bush") || nl.contains("grass")) && (cut || unlit) { fol = true; }
    let mut pbr = pbr_de(nombre);
    if sh == "Standard" && !fl["_Glossiness"].is_null() { pbr = [(1.0 - f(&fl["_Glossiness"])).clamp(0.05, 1.0), f(&fl["_Metallic"]), 0.04]; }
    let mez = if !x["t2"].is_null() && terr.is_none() { x["t2"].as_i64().unwrap_or(-1) } else { -1 };
    let agua = nombre == "GM_agua" || nombre == "RB_agua";
    if agua { blend = true; cut = false; unlit = false; fol = false; }
    if oculto { return None; }
    if c.iter().any(|v| v.is_nan()) { c = [1.0; 4]; }
    Some(Mat { pbr, fol: fol as u8, id: i as i64, t2: mez, terr, c, st, t: tex, blend: blend as u8, cut: cut as u8, unlit: (unlit && !fol) as u8, add: add as u8, agua: agua as u8, em })
}

/// el cielo «painted» de GMod: un degradé celeste que se aclara hasta casi blanco en el horizonte (cieloPainted de
/// mundo.js): seis caras de L × L, RGBA
pub fn cielo_painted(l: u32) -> [Vec<u8>; 6] {
    const P: [[f32; 3]; 17] = [[126., 189., 255.], [132., 190., 255.], [140., 195., 255.], [148., 199., 255.], [154., 202., 253.], [162., 206., 252.], [170., 210., 250.], [177., 213., 251.], [185., 217., 251.],
        [192., 220., 250.], [198., 223., 247.], [206., 227., 247.], [214., 231., 247.], [222., 235., 247.], [229., 238., 247.], [236., 242., 247.], [244., 246., 244.]];
    let mut lado = vec![0u8; (l * l * 4) as usize]; let mut azul = vec![0u8; (l * l * 4) as usize];
    for y in 0..l {
        let v = (y as f32 + 0.5) / l as f32; let t = (if v <= 0.5 { v } else { 1.0 - v }) * 32.0; let i = (t.floor() as usize).min(15); let fr = t - i as f32;
        let c: Vec<u8> = (0..3).map(|k| (P[i][k] + (P[i + 1][k] - P[i][k]) * fr).round() as u8).collect();
        for x in 0..l { let o = ((y * l + x) * 4) as usize; lado[o..o + 4].copy_from_slice(&[c[0], c[1], c[2], 255]); }
    }
    for p in azul.chunks_exact_mut(4) { p.copy_from_slice(&[126, 188, 255, 255]); }
    [lado.clone(), lado.clone(), azul.clone(), azul, lado.clone(), lado]
}

impl Mapa {
    /// las luces del mapa para un cuadro: las `n` más importantes desde la cámara (distancia sobre radio), como
    /// lucesPreparar de gl.js; cada una con posición y radio, color, dirección y coseno del cono
    pub fn luces_cerca(&self, cam: [f32; 3], n: usize) -> Vec<[f32; 12]> {
        let mut l = self.luces.clone();
        let peso = |q: &[f32; 12]| { let (x, y, z) = (q[0] - cam[0], q[1] - cam[1], q[2] - cam[2]); (x * x + y * y + z * z).sqrt() / q[3] };
        if l.len() > n { l.sort_by(|a, b| peso(a).partial_cmp(&peso(b)).unwrap_or(std::cmp::Ordering::Equal)); }
        l.truncate(n); l
    }
}

/// arma el mapa `nombre`: abre su paquete, recorre sus nodos y junta lo que hay que mandarle al motor. `tmax`: el lado
/// mayor de las texturas; `lejos_cal`: hasta dónde se ve en esta calidad (GFX.lejos)
pub fn armar(paq: &mut Paquete, nombre: &str, tmax: u32, lejos_cal: f32) -> Result<Mapa, String> {
    paq.asegurar(&format!("m_{nombre}"))?;
    paq.soltar_menos(&[&format!("m_{nombre}")]);
    let d = &paq.d;
    let raices = d["esc"][nombre].as_array().ok_or(format!("no hay mapa {nombre}"))?;
    let mut datos: Vec<u8> = vec![];
    let mut poner = |b: &[u8]| -> usize { let o = datos.len(); datos.extend_from_slice(b); while datos.len() % 4 != 0 { datos.push(0); } o };
    let (mut mallas, mut mats, mut texs) = (vec![], vec![], vec![]);
    let (mut hay_malla, mut hay_mat, mut hay_tex) = (std::collections::HashSet::new(), std::collections::HashSet::new(), std::collections::HashSet::new());
    let mut items = vec![]; let mut spawns = vec![]; let mut luces = vec![];
    let (mut sol, mut sol_col) = ([0.3f32, 0.8, 0.2], [1.0f32, 0.96, 0.9]);
    let (mut lo, mut hi) = ([1e9f32; 3], [-1e9f32; 3]);
    for arb in raices {
        let arb = arb.as_array().ok_or("nodos raros")?; let n = arb.len();
        // (Modelo: activo si no está apagado y su padre tampoco; la matriz del mundo, la del padre por la propia)
        let mut act = vec![false; n]; let mut w: Vec<M4> = vec![m4::id(); n];
        for (i, x) in arb.iter().enumerate() {
            let pa = x["pa"].as_i64().unwrap_or(-1);
            act[i] = x["off"].is_null() && (pa < 0 || act[pa as usize]);
            let l = trs(v3(&x["p"], [0.0; 3]), if x["r"].is_array() { [f(&x["r"][0]), f(&x["r"][1]), f(&x["r"][2]), f(&x["r"][3])] } else { [0.0, 0.0, 0.0, 1.0] }, v3(&x["s"], [1.0; 3]));
            w[i] = if pa < 0 { l } else { m4::mul(&w[pa as usize], &l) };
        }
        for (i, x) in arb.iter().enumerate() {
            if !act[i] { continue; }
            let wm = w[i]; let nm = x["n"].as_str().unwrap_or("");
            let pa = x["pa"].as_i64().unwrap_or(-1);
            if nm.starts_with("SpawnPoint") || (pa >= 0 && arb[pa as usize]["n"].as_str().unwrap_or("").contains("SpawnPoints")) { spawns.push(([wm[12], wm[13], wm[14]], x["yaw"].as_f64().map(|y| y as f32))); }
            let lz = &x["lz"];
            if lz["t"].as_i64() == Some(1) {
                // (el sol: hacia donde no mira la luz direccional; su color por su intensidad)
                let fw = punto(&[wm[0], wm[1], wm[2], 0.0, wm[4], wm[5], wm[6], 0.0, wm[8], wm[9], wm[10], 0.0, 0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 1.0]);
                sol = m4::norm([-fw[0], -fw[1], -fw[2]]); let it = f(&lz["i"]).max(0.0); let c = v3(&lz["c"], [1.0; 3]); sol_col = [c[0] * it, c[1] * it, c[2] * it];
            }
            if matches!(lz["t"].as_i64(), Some(0) | Some(2)) {
                // (como MUNDO.luces de mundo.js: el color por la intensidad —tal cual, sin pasar a lineal—; la dirección y el
                // cono, sólo las de tipo 0 —focos—)
                let it = if lz["i"].is_null() || f(&lz["i"]) == 0.0 { 1.0 } else { f(&lz["i"]) }; let c = v3(&lz["c"], [1.0; 3]);
                let foco = lz["t"].as_i64() == Some(0);
                let dir = if foco && lz["d"].is_array() { Some(m4::norm(v3(&lz["d"], [0.0, -1.0, 0.0]))) } else { None };
                let r = if lz["r"].is_null() || f(&lz["r"]) == 0.0 { 8.0 } else { f(&lz["r"]) };
                let (dd, cono) = match dir { Some(d) => (d, if foco { f(&lz["k"]) } else { -2.0 }), None => ([0.0, -1.0, 0.0], -2.0) };
                luces.push([wm[12], wm[13], wm[14], r, c[0] * it, c[1] * it, c[2] * it, 0.0, dd[0], dd[1], dd[2], cono]);
            }
            // (lo que choca —triángulos de las mallas de choque y cajas— da el tamaño del mapa, como MUNDO.lo/hi: la niebla
            // de Source se cierra antes si la vista no llega a todo el mapa)
            if let Some(cols) = x["col"].as_array() {
                for cc in cols {
                    if cc["tr"].as_i64().unwrap_or(0) != 0 { continue; }
                    match cc["k"].as_str() {
                        Some("m") => if let Some(cm) = cc["m"].as_i64().filter(|&v| v >= 0) {
                            let md = &d["ms"][cm as usize];
                            if let Some(bin) = paq.bin_de(md) {
                                let (v, o) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize);
                                let (mn, sc) = (v3(&md["mn"], [0.0; 3]), v3(&md["sc"], [1.0; 3]));
                                for k in 0..v {
                                    let b = o + k * 14; if b + 6 > bin.len() { break; }
                                    let q = |j: usize| u16::from_le_bytes([bin[b + j * 2], bin[b + j * 2 + 1]]) as f32 / 65535.0;
                                    let pw = punto(&wm, [mn[0] + q(0) * sc[0], mn[1] + q(1) * sc[1], mn[2] + q(2) * sc[2]]);
                                    for e in 0..3 { lo[e] = lo[e].min(pw[e]); hi[e] = hi[e].max(pw[e]); }
                                }
                            }
                        },
                        Some("b") => {
                            let (cen, tam) = (v3(&cc["c"], [0.0; 3]), v3(&cc["s"], [0.0; 3]));
                            for e in 0..8 {
                                let esq = [cen[0] + tam[0] * if e & 1 != 0 { 0.5 } else { -0.5 }, cen[1] + tam[1] * if e & 2 != 0 { 0.5 } else { -0.5 }, cen[2] + tam[2] * if e & 4 != 0 { 0.5 } else { -0.5 }];
                                let pw = punto(&wm, esq); for k in 0..3 { lo[k] = lo[k].min(pw[k]); hi[k] = hi[k].max(pw[k]); }
                            }
                        }
                        _ => {}
                    }
                }
            }
            // (Modelo.ver: con malla, materiales y sin apagar el render)
            let (Some(mi), Some(mts)) = (x["m"].as_i64(), x["mt"].as_array()) else { continue };
            if mi < 0 || !x["mroff"].is_null() { continue; }
            let md = &d["ms"][mi as usize]; let Some(subs) = md["sub"].as_array() else { continue };
            let Some(bin) = paq.bin_de(md) else { continue };
            // la malla, una vez
            if hay_malla.insert(mi) {
                let (v, o, ii) = (md["v"].as_u64().unwrap_or(0) as usize, md["o"].as_u64().unwrap_or(0) as usize, md["i"].as_u64().unwrap_or(0) as usize);
                let i32 = md["i32"].as_bool().unwrap_or(false); let ni = subs.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0) as usize;
                let vb = bin.get(o..o + v * 14).ok_or("malla cortada")?; let ib = bin.get(ii..ii + ni * if i32 { 4 } else { 2 }).ok_or("índices cortados")?;
                let vo = poner(vb); let io = poner(ib);
                mallas.push(Malla { id: mi, v: v as u32, mn: v3(&md["mn"], [0.0; 3]), sc: v3(&md["sc"], [1.0; 3]), i32: i32 as u8, ni: ni as u32, vo, io, lo: -1, so: -1, lm: -1 });
            }
            let mn = v3(&md["mn"], [0.0; 3]); let sc = v3(&md["sc"], [1.0; 3]);
            let c = [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0]; let r = (sc[0] * sc[0] + sc[1] * sc[1] + sc[2] * sc[2]).sqrt() / 2.0;
            for (k, mt) in mts.iter().enumerate() {
                let Some(mt) = mt.as_i64() else { continue }; if mt < 0 { continue; }
                let Some(s) = subs.get(k) else { continue };
                if hay_mat.insert(mt) { match material(d, mt as usize) { Some(m) => mats.push(m), None => continue } }
                if !mats.iter().any(|m: &Mat| m.id == mt) { continue; }   // (oculto: no se dibuja)
                let cen = punto(&wm, c); let rr = r * escala(&wm);
                items.push(ItemDin { m: mi, s0: s[0].as_u64().unwrap_or(0) as u32, sn: s[1].as_u64().unwrap_or(0) as u32, mat: mt, mm: wm, esf: [cen[0], cen[1], cen[2], rr], fl: 0, h: vec![] });
            }
        }
    }
    // las texturas de los materiales (y las capas del terreno y las mezcladas)
    let quiero: Vec<i64> = mats.iter().flat_map(|m: &Mat| { let mut v = vec![m.t, m.t2]; if let Some(t) = &m.terr { v.extend(t.iter().map(|x| x.0)); } v }).filter(|&t| t >= 0).collect();
    for t in quiero {
        if !hay_tex.insert(t) { continue; }
        if let Some((w, h, px)) = paq.textura(t as usize, tmax) {
            let a = d["tx"][t as usize]["a"].as_i64().unwrap_or(0) as u8; let o = poner(&px);
            texs.push(Tex { id: t, n: d["tx"][t as usize]["n"].as_str().unwrap_or("").to_string(), w, h, a, o });
        }
    }
    // el cielo del mapa (su material: el degradé y sus exponentes) y, en los de GMod, el «painted»
    let aj = &d["aj"][nombre];
    let skym = aj["sky"].as_i64().map(|i| &d["mt"][i as usize]);
    let col = |k: &str, def: [f32; 3]| -> [f32; 3] { skym.map(|m| v3(&m["cc"][k], def)).unwrap_or(def) };
    let top = col("_TopColor", [0.28, 0.64, 1.0]); let mid = col("_MiddleColor", [0.92, 0.92, 0.92]); let bot = col("_BottomColor", [0.53, 0.58, 0.68]);
    let ex = [skym.and_then(|m| m["f"]["_TopExponent"].as_f64()).unwrap_or(0.8) as f32, skym.and_then(|m| m["f"]["_BottomExponent"].as_f64()).unwrap_or(1.0) as f32];
    let ex = [if ex[0] == 0.0 { 0.8 } else { ex[0] }, if ex[1] == 0.0 { 1.0 } else { ex[1] }];
    let mut caras = None;
    if MAPAS_GMOD.contains(&nombre) {
        let l = 64; let o: Vec<usize> = cielo_painted(l).iter().map(|c| poner(c)).collect(); caras = Some(Caras { l, o });
    }
    let cielo = Cielo { top, mid, bot, exp: ex, tinte: [1.0; 3], dia: 1.0, k: 1.0, cubo: caras.is_some() as u8, caras };
    // la luz ambiente como la del cielo en Unity (modo Skybox), y la niebla del mapa (cargarMapa)
    let ai = aj["ai"].as_f64().unwrap_or(1.0) as f32; let ai = if ai == 0.0 { 1.0 } else { ai };
    let mut amb_s = [0, 1, 2].map(|k| (top[k] * 0.4 + mid[k] * 0.6) * ai * 0.72);
    let mut amb_g = [0, 1, 2].map(|k| (mid[k] * 0.45 + bot[k] * 0.3) * ai * 0.62);
    if aj["ambRB"].is_array() { amb_s = v3(&aj["ambRB"][0], amb_s); amb_g = v3(&aj["ambRB"][1], amb_g); }
    let lejos = lejos_cal.max(aj["lejos"].as_f64().unwrap_or(0.0) as f32);
    let fc = v3(&aj["fc"], mid); let (fog, fd, fm, fs, fe) = (aj["fog"].as_i64().unwrap_or(0) != 0, f(&aj["fd"]), aj["fm"].as_i64().unwrap_or(0), f(&aj["fs"]), f(&aj["fe"]));
    let (nie_c, nie_a, nie_b, nie_m) = if fog && fd > 0.0 { (fc, 0.15 / fd, lejos.min(1.9 / fd), 1.0) }
        else if fog && fm == 1 && fe > fs {
            let diag = ((hi[0] - lo[0]).powi(2) + (hi[2] - lo[2]).powi(2)).sqrt();
            let (a, b) = if lejos >= diag { (fs, fe) } else { (fs.min(lejos * 0.5), fe.min(lejos)) };
            (fc, a, b, aj["fmax"].as_f64().map(|x| x as f32).unwrap_or(1.0))
        } else { (mid, lejos * 0.7, lejos, 1.0) };
    // (en lineal, como luzLineal de gl.js: el sol ×2,6; el cielo y el suelo menos saturados)
    let des = |a: [f32; 3], t: f32| { let l = a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11; a.map(|x| l + (x - l) * t) };
    let sol_lin = srgb3(sol_col).map(|x| x * 2.6);
    let luz = Luz { sol, sol_c: sol_lin, amb_s: des(srgb3(amb_s), 0.45).map(|x| x * 1.3), amb_g: des(srgb3(amb_g), 0.6).map(|x| x * 1.25),
        nie: Niebla { c: srgb3(nie_c), a: nie_a, b: nie_b, m: nie_m, s: [sol_lin[0] * 0.35, sol_lin[1] * 0.35, sol_lin[2] * 0.35] }, expo: 0.66 };
    if lo[0] > hi[0] { lo = [0.0; 3]; hi = [0.0; 3]; }
    let _ = (lo, hi);
    let cab = Cabecera { mapa: nombre.to_string(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs, lms: vec![], items: vec![], agua: None, cielo: Some(cielo) };
    Ok(Mapa { nombre: nombre.to_string(), esc: Escena { c: cab, datos }, items, luz, luces, spawns, lejos })
}
