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
    /// lo que choca (los triángulos de las mallas de choque y los cuerpos fijos), para el jugador y los rayos
    pub mundo: crate::mundo::Mundo,
    /// la altura de la superficie del agua del mapa (si tiene) y todas sus cajas de agua (x0, y0, z0, x1, y1, z1)
    pub agua_y: Option<f32>, pub aguas: Vec<[f32; 6]>,
    /// hasta dónde se ve
    pub lejos: f32,
    /// la luz del mapa en gamma (de donde sale `luz`): la mueve la hora del día (dia.rs)
    pub base: LuzBase,
}

/// la luz de un mapa como la deja cargarMapa (R.sol, R.solCol, R.ambS, R.ambG, R.niebla y el cielo, en gamma)
#[derive(Clone, Debug)]
pub struct LuzBase { pub sol: [f32; 3], pub sol_col: [f32; 3], pub amb_s: [f32; 3], pub amb_g: [f32; 3], pub nie: Niebla, pub cielo: Cielo }
/// la luz del cuadro en lineal (luzLineal de gl.js: el sol ×2,6, el cielo y el suelo menos saturados); `expo_k`: R.expoK
pub fn luz_lineal(b: &LuzBase, expo_k: f32) -> Luz {
    let des = |a: [f32; 3], t: f32| { let l = a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11; a.map(|x| l + (x - l) * t) };
    let sol_lin = srgb3(b.sol_col).map(|x| x * 2.6);
    Luz { sol: b.sol, sol_c: sol_lin, amb_s: des(srgb3(b.amb_s), 0.45).map(|x| x * 1.3), amb_g: des(srgb3(b.amb_g), 0.6).map(|x| x * 1.25),
        nie: Niebla { c: srgb3(b.nie.c), s: [sol_lin[0] * 0.35, sol_lin[1] * 0.35, sol_lin[2] * 0.35], ..b.nie }, expo: 0.66 * expo_k }
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
/// el mapa de normales del agua (propio): olitas de senos cruzados con un número entero de vueltas en el cuadro (se repite
/// sin costura) y un poco de ruido suave; la normal en RGB como los de Source (inclinan poco: unos 0,04 de promedio)
/// el mapa de normales animado del agua, como dev/water_normal de HL2 (que pasa sus cuadros a 30 por segundo —el proxy
/// AnimatedTexture— y lleva en el alfa cuánto corre el reflejo y el fondo): `cuadros` de `lado` × `lado`, uno abajo del otro.
/// Olas que viajan con números de onda enteros (se repite en el cuadro sin costura) y que dan vueltas enteras en la animación
/// (se repite en el tiempo sin salto), las largas más lentas (como el agua honda: la velocidad con la raíz del número de onda);
/// el alfa, más fuerte donde la ola es más empinada
pub fn normales_agua_hl2(lado: u32, cuadros: u32) -> Vec<u8> {
    let tau = std::f32::consts::TAU;
    // (número de onda x, y; alto; fase)
    let ondas: [(f32, f32, f32, f32); 12] = [(2.0, 1.0, 0.30, 0.0), (-1.0, 3.0, 0.24, 1.3), (3.0, -2.0, 0.18, 2.1), (1.0, 5.0, 0.13, 0.7), (-5.0, -2.0, 0.11, 4.0), (6.0, 3.0, 0.08, 2.8),
        (-3.0, 7.0, 0.07, 5.1), (8.0, -5.0, 0.05, 1.9), (-9.0, 4.0, 0.04, 3.3), (4.0, 11.0, 0.035, 0.4), (-12.0, -7.0, 0.025, 2.2), (13.0, 9.0, 0.02, 4.6)];
    let vueltas: Vec<f32> = ondas.iter().enumerate().map(|(i, o)| { let k = (o.0 * o.0 + o.1 * o.1).sqrt(); (k.sqrt() * 1.2).round().max(1.0) * if i % 3 == 2 { -1.0 } else { 1.0 } }).collect();
    let (l, nf) = (lado as usize, cuadros.max(1) as usize); let mut o = vec![0u8; l * l * nf * 4];
    let mut pend = vec![0f32; l * l * 2];
    for f in 0..nf {
        let t = f as f32 / nf as f32; let mut maxp = 1e-6f32;
        for j in 0..l { for i in 0..l {
            let (x, y) = (i as f32 / l as f32, j as f32 / l as f32); let (mut dx, mut dy) = (0f32, 0f32);
            for (k, &(a, b, h, ph)) in ondas.iter().enumerate() { let ang = tau * (a * x + b * y - vueltas[k] * t) + ph; let c = ang.cos() * h * tau; dx += c * a; dy += c * b; }
            let q = (j * l + i) * 2; pend[q] = dx; pend[q + 1] = dy; maxp = maxp.max((dx * dx + dy * dy).sqrt());
        } }
        for j in 0..l { for i in 0..l {
            let q = (j * l + i) * 2; let (dx, dy) = (pend[q] / l as f32 * 3.2, pend[q + 1] / l as f32 * 3.2);
            let (nx, ny, nz) = (-dx, -dy, 1.0f32); let m = (nx * nx + ny * ny + nz * nz).sqrt();
            let a = 0.45 + 0.55 * ((pend[q] * pend[q] + pend[q + 1] * pend[q + 1]).sqrt() / maxp).clamp(0.0, 1.0);
            let k = ((f * l + j) * l + i) * 4;
            o[k] = ((nx / m * 0.5 + 0.5) * 255.0).round() as u8; o[k + 1] = ((ny / m * 0.5 + 0.5) * 255.0).round() as u8; o[k + 2] = ((nz / m * 0.5 + 0.5) * 255.0).round() as u8; o[k + 3] = (a * 255.0).round() as u8;
        } }
    }
    o
}
#[allow(dead_code)]
fn normales_agua(n: u32) -> Vec<u8> {
    let tau = std::f32::consts::TAU;
    let ondas: [(f32, f32, f32, f32); 7] = [(3.0, 1.0, 0.35, 0.0), (-2.0, 3.0, 0.28, 1.7), (5.0, -2.0, 0.18, 0.4), (1.0, 6.0, 0.15, 2.9), (-7.0, -4.0, 0.09, 4.1), (9.0, 5.0, 0.07, 0.8), (-4.0, 11.0, 0.05, 3.3)];
    // (ruido suave que se repite en el cuadro: rompe lo regular de las ondas, como las olitas de HL2)
    let hash = |i: i32, j: i32, s: u32| -> f32 { let mut h = (i as u32).wrapping_mul(374761393) ^ (j as u32).wrapping_mul(668265263) ^ s.wrapping_mul(2246822519); h = (h ^ (h >> 13)).wrapping_mul(1274126177); (h ^ (h >> 16)) as f32 / u32::MAX as f32 * 2.0 - 1.0 };
    let ruido = |x: f32, y: f32, f: i32, s: u32| -> f32 {
        let (fx, fy) = (x * f as f32, y * f as f32); let (i, j) = (fx.floor() as i32, fy.floor() as i32); let (u, v) = (fx - i as f32, fy - j as f32);
        let (u, v) = (u * u * (3.0 - 2.0 * u), v * v * (3.0 - 2.0 * v)); let w = |a: i32| a.rem_euclid(f);
        let (a, b, c, d) = (hash(w(i), w(j), s), hash(w(i + 1), w(j), s), hash(w(i), w(j + 1), s), hash(w(i + 1), w(j + 1), s));
        a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
    };
    let alto = |x: f32, y: f32| -> f32 { ondas.iter().map(|&(a, b, k, f)| k * (tau * (a * x + b * y) + f).sin()).sum::<f32>() + ruido(x, y, 8, 1) * 0.06 + ruido(x, y, 16, 2) * 0.03 + ruido(x, y, 32, 3) * 0.012 };
    let mut o = vec![0u8; (n * n * 4) as usize]; let e = 1.0 / n as f32; let fuerza = 0.9;
    for j in 0..n { for i in 0..n {
        let (x, y) = (i as f32 * e, j as f32 * e);
        let dx = (alto(x + e, y) - alto(x - e, y)) / (2.0 * e) * e * fuerza; let dy = (alto(x, y + e) - alto(x, y - e)) / (2.0 * e) * e * fuerza;
        let (nx, ny, nz) = (-dx * 8.0, -dy * 8.0, 1.0); let l = (nx * nx + ny * ny + nz * nz).sqrt();
        let k = ((j * n + i) * 4) as usize;
        o[k] = ((nx / l * 0.5 + 0.5) * 255.0).round() as u8; o[k + 1] = ((ny / l * 0.5 + 0.5) * 255.0).round() as u8; o[k + 2] = ((nz / l * 0.5 + 0.5) * 255.0).round() as u8; o[k + 3] = 255;
    } }
    o
}
/// un triángulo sin área o una aguja (menos de 1 mm de alto): no sirve para chocar (triFino de mundo.js)
pub fn tri_fino(a: [f32; 3], b: [f32; 3], c: [f32; 3]) -> bool {
    let (u, w) = ([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
    let cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    let a2 = (cr[0] * cr[0] + cr[1] * cr[1] + cr[2] * cr[2]).sqrt();
    let l = |v: [f32; 3]| (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    let lm = l(u).max(l(w)).max(l([w[0] - u[0], w[1] - u[1], w[2] - u[2]]));
    !(a2 > 1e-9) || a2 / lm < 1e-3
}
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
    Some(Mat { ti: [0.0; 12], pbr, fol: fol as u8, id: i as i64, t2: mez, terr, c, st, t: tex, blend: blend as u8, cut: cut as u8, unlit: (unlit && !fol) as u8, add: add as u8, agua: agua as u8, em })
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

/// el material de agua de Source de un mapa (lo que dice su .vmt): el color de la niebla (sRGB, 0 a 1) y hasta dónde llega
/// (unidades), $refractamount y $refracttint, $reflectamount y $reflecttint, cuánto mide un mosaico del mapa de normales
/// (m, de la escala de la textura en la cara del agua) y su $bumptransform (lo que corre por segundo, en mosaicos)
#[derive(Clone, Debug)]
pub struct MatAguaSrc { pub niebla: [f32; 3], pub niebla_fin: f32, pub refract: f32, pub t_refr: [f32; 3], pub reflect: f32, pub t_refl: [f32; 3], pub mosaico: f32, pub corre: [f32; 2] }
/// el agua de cada mapa, de su material de Source: gm_construct usa nature/water_canals03 (con la escala de su cara: 4
/// píxeles por unidad, un mosaico de 64 unidades); los demás, la de la costa de HL2 (nature/water_wasteland002a)
pub fn mat_agua_source(mapa: &str) -> MatAguaSrc {
    // ($bumptransform: TextureScroll a 0,05 por segundo, a 45°)
    let corre = [0.05 * std::f32::consts::FRAC_1_SQRT_2, 0.05 * std::f32::consts::FRAC_1_SQRT_2];
    if mapa.to_lowercase().contains("construct") {
        MatAguaSrc { niebla: [20.0 / 255.0, 42.0 / 255.0, 39.0 / 255.0], niebla_fin: 330.0, refract: 4.0, t_refr: [0.68, 0.76, 0.76], reflect: 2.5, t_refl: [1.0, 0.95, 0.85], mosaico: 64.0 * 0.0254, corre }
    } else {
        MatAguaSrc { niebla: [23.0 / 255.0, 37.0 / 255.0, 47.0 / 255.0], niebla_fin: 800.0, refract: 3.0, t_refr: [1.0, 1.0, 1.0], reflect: 1.0, t_refl: [1.0, 1.0, 1.0], mosaico: 64.0 * 0.0254, corre }
    }
}
/// el agua de Source sobre la de un mapa: su mapa de normales de verdad (los cuadros RGBA, `n` de w × h, en `o` de los datos)
/// y lo de su material
pub fn agua_source(a: &mut jxmotor::escena::Agua, m: &MatAguaSrc, w: u32, h: u32, n: u32, o: usize) {
    a.fuente = 1; a.normal = Some(jxmotor::escena::TexAgua { w, h, o, n });
    a.esc = 1.0 / m.mosaico.max(0.05); a.s = [m.corre[0], m.corre[1], 0.0, 0.0];
    a.fog = [srgb(m.niebla[0]), srgb(m.niebla[1]), srgb(m.niebla[2]), a.fog[3]]; a.largo = (m.niebla_fin * 0.0254).max(0.5);
    // (cuánto corre la imagen: lo del material, a la escala de la pantalla del motor —medido mirando el mapa—)
    a.dist = m.reflect * 0.16; a.refr = m.refract * 0.16; a.t_refr = m.t_refr; a.t_refl = m.t_refl;
}

/// el agua (el volumen más grande del mapa): como el agua de HL2 de la versión personal (jxpAguaHL2), con un mapa de
/// normales propio y lo hondo medido con rayos (jxpAguaFondo); sus datos se suman a `datos`. Devuelve el agua y su altura
pub fn agua_hl2(aguas: &[[f32; 6]], mundo: &crate::mundo::Mundo, datos: &mut Vec<u8>) -> (Option<jxmotor::escena::Agua>, Option<f32>) {
    let Some(v) = aguas.iter().max_by(|a, b| ((a[3] - a[0]) * (a[5] - a[2])).partial_cmp(&((b[3] - b[0]) * (b[5] - b[2]))).unwrap_or(std::cmp::Ordering::Equal)) else { return (None, None) };
    let (lo, hi) = ([v[0], v[1], v[2]], [v[3], v[4], v[5]]);
    while datos.len() % 4 != 0 { datos.push(0); }
    let (n, cuadros) = (128u32, 40u32); let nrm = normales_agua_hl2(n, cuadros); let o = datos.len(); datos.extend_from_slice(&nrm);
    let pn = 64usize; let dd = (hi[1] - lo[1]).max(0.5); let (w, h) = (hi[0] - lo[0], hi[2] - lo[2]);
    let mut px = vec![0u8; pn * pn * 4];
    for j in 0..pn { for i in 0..pn {
        let (x, z) = (lo[0] + (i as f32 + 0.5) / pn as f32 * w, lo[2] + (j as f32 + 0.5) / pn as f32 * h);
        let p = mundo.rayo([x, hi[1] + 0.05, z], [0.0, -1.0, 0.0], dd + 1.0).map(|g| (g.t - 0.05).max(0.0)).unwrap_or(dd);
        let k = (j * pn + i) * 4; px[k] = ((p / dd).clamp(0.0, 1.0) * 255.0).round() as u8; px[k + 3] = 255;
    } }
    let op = datos.len(); datos.extend_from_slice(&px);
    // (el agua de la costa de HL2: niebla de este color, 400 unidades de largo, sin $refractamount ni $reflectamount)
    let fs = [0.08f32, 0.19, 0.2]; let fin = 400.0f32; let turbia = (1.05 - fin / 1500.0).clamp(0.55, 0.92);
    (Some(jxmotor::escena::Agua { fog: [srgb(fs[0]), srgb(fs[1]), srgb(fs[2]), turbia], esc: 0.38, fuerza: 0.55, dist: 0.4 * 0.5, refr: 0.5, s: [0.021, 0.016, -0.018, 0.024],
        largo: (fin * 0.0254 / 2.5).max(1.5), normal: Some(jxmotor::escena::TexAgua { w: n, h: n, o, n: cuadros }),
        prof: Some(jxmotor::escena::Prof { x0: lo[0], z0: lo[2], w, h, d: dd, tex: Some(jxmotor::escena::TexAgua { w: pn as u32, h: pn as u32, o: op, n: 1 }) }), y: hi[1], fuente: 0, t_refr: [1.0; 3], t_refl: [1.0; 3] }), Some(hi[1]))
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
/// los triángulos de cada submalla grande, ordenados por celdas del espacio (de ~20 m) y partidos en trozos de al menos 400
/// triángulos, cada uno con su caja: así la cámara, las sombras y el reflejo dibujan sólo los trozos que ven (antes cada
/// material del mapa era una sola cosa de punta a punta y siempre se dibujaba entero). Reescribe el orden de los índices de cada
/// submalla (los mismos triángulos) y devuelve, por submalla, sus trozos: (desde, cuántos índices, lo y hi locales)
pub fn trocear(vb: &[u8], ib: &mut [u8], i32: bool, subs: &[(usize, usize)], mn: [f32; 3], sc: [f32; 3]) -> Vec<Vec<(u32, u32, [f32; 3], [f32; 3])>> {
    const CELDA: f32 = 20.0; const MIN_TRIS: usize = 400;
    let nv = vb.len() / 14;
    let pos = |k: usize| -> [f32; 3] { let b = k * 14; let q = |j: usize| u16::from_le_bytes([vb[b + j * 2], vb[b + j * 2 + 1]]) as f32 / 65535.0; [mn[0] + q(0) * sc[0], mn[1] + q(1) * sc[1], mn[2] + q(2) * sc[2]] };
    let tam = if i32 { 4 } else { 2 };
    let leer = |ib: &[u8], k: usize| -> usize { let b = k * tam; if i32 { u32::from_le_bytes([ib[b], ib[b + 1], ib[b + 2], ib[b + 3]]) as usize } else { u16::from_le_bytes([ib[b], ib[b + 1]]) as usize } };
    let caja = |ib: &[u8], s0: usize, sn: usize| { let (mut lo, mut hi) = ([f32::MAX; 3], [f32::MIN; 3]);
        for k in s0..s0 + sn { let v = leer(ib, k); if v >= nv { continue; } let p = pos(v); for e in 0..3 { lo[e] = lo[e].min(p[e]); hi[e] = hi[e].max(p[e]); } }
        if lo[0] > hi[0] { (mn, mn) } else { (lo, hi) } };
    let mut out = vec![];
    for &(s0, sn) in subs {
        if s0 + sn > ib.len() / tam || sn < 3 { out.push(vec![]); continue; }
        let nt = sn / 3; let (lo, hi) = caja(ib, s0, sn);
        if nt < MIN_TRIS * 2 || (hi[0] - lo[0]).max(hi[1] - lo[1]).max(hi[2] - lo[2]) < CELDA * 1.5 { out.push(vec![(s0 as u32, sn as u32, lo, hi)]); continue; }
        let n = [0, 1, 2].map(|e| (((hi[e] - lo[e]) / CELDA).ceil() as usize).clamp(1, 64));
        // (cada triángulo a la celda de su centro; ordenados por celda —estable: dentro de cada celda, como venían—)
        let mut tris: Vec<(usize, usize)> = (0..nt).map(|t| {
            let (a, b, c) = (leer(ib, s0 + t * 3), leer(ib, s0 + t * 3 + 1), leer(ib, s0 + t * 3 + 2));
            if a >= nv || b >= nv || c >= nv { return (0, t); }
            let (pa, pb, pc) = (pos(a), pos(b), pos(c));
            let cel = [0, 1, 2].map(|e| ((((pa[e] + pb[e] + pc[e]) / 3.0 - lo[e]) / (hi[e] - lo[e]).max(1e-6) * n[e] as f32) as usize).min(n[e] - 1));
            ((cel[0] * n[1] + cel[1]) * n[2] + cel[2], t)
        }).collect();
        tris.sort_by_key(|x| x.0);
        let viejo = ib[s0 * tam..(s0 + sn) * tam].to_vec();
        for (j, &(_, t)) in tris.iter().enumerate() { let (d, o) = ((s0 + j * 3) * tam, t * 3 * tam); ib[d..d + 3 * tam].copy_from_slice(&viejo[o..o + 3 * tam]); }
        // (los trozos: las celdas seguidas, juntando hasta tener al menos MIN_TRIS triángulos)
        let mut tz = vec![]; let mut ini = 0;
        while ini < nt {
            let mut fin = ini; let mut cuenta = 0;
            while fin < nt { let c = tris[fin].0; let mut e = fin; while e < nt && tris[e].0 == c { e += 1; } cuenta += e - fin; fin = e; if cuenta >= MIN_TRIS { break; } }
            let (a, b) = (s0 + ini * 3, (fin - ini) * 3); let (l, h) = caja(ib, a, b); tz.push((a as u32, b as u32, l, h)); ini = fin;
        }
        // (el último, si quedó chico, con el anterior)
        if tz.len() >= 2 && (tz[tz.len() - 1].1 as usize) < MIN_TRIS * 3 / 2 { let u = tz.pop().unwrap(); let p = tz.last_mut().unwrap(); p.1 += u.1; for e in 0..3 { p.2[e] = p.2[e].min(u.2[e]); p.3[e] = p.3[e].max(u.3[e]); } }
        out.push(tz);
    }
    out
}

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
    // (los trozos de cada malla: por submalla, (desde, cuántos índices, lo y hi locales))
    let mut trozos_de: std::collections::HashMap<i64, Vec<Vec<(u32, u32, [f32; 3], [f32; 3])>>> = std::collections::HashMap::new();
    let (mut sol, mut sol_col) = ([0.3f32, 0.8, 0.2], [1.0f32, 0.96, 0.9]);
    let (mut lo, mut hi) = ([1e9f32; 3], [-1e9f32; 3]);
    let (mut tris, mut cuerpos): (Vec<f32>, Vec<crate::mundo::Cuerpo>) = (vec![], vec![]);
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
                                let mut pw = Vec::with_capacity(v);
                                for k in 0..v {
                                    let b = o + k * 14; if b + 6 > bin.len() { break; }
                                    let q = |j: usize| u16::from_le_bytes([bin[b + j * 2], bin[b + j * 2 + 1]]) as f32 / 65535.0;
                                    let p = punto(&wm, [mn[0] + q(0) * sc[0], mn[1] + q(1) * sc[1], mn[2] + q(2) * sc[2]]);
                                    for e in 0..3 { lo[e] = lo[e].min(p[e]); hi[e] = hi[e].max(p[e]); }
                                    pw.push(p);
                                }
                                // (los triángulos, como cargarMapa: con escala negativa —espejo— se dan vuelta; sin área, fuera)
                                let ii = md["i"].as_u64().unwrap_or(0) as usize; let i32b = md["i32"].as_bool().unwrap_or(false);
                                let ni = md["sub"].as_array().map(|ss| ss.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max().unwrap_or(0)).unwrap_or(0) as usize;
                                let idx = |k: usize| -> usize { if i32b { let b = ii + k * 4; bin.get(b..b + 4).map(|x| u32::from_le_bytes([x[0], x[1], x[2], x[3]]) as usize).unwrap_or(usize::MAX) } else { let b = ii + k * 2; bin.get(b..b + 2).map(|x| u16::from_le_bytes([x[0], x[1]]) as usize).unwrap_or(usize::MAX) } };
                                let det = wm[0] * (wm[5] * wm[10] - wm[6] * wm[9]) - wm[4] * (wm[1] * wm[10] - wm[2] * wm[9]) + wm[8] * (wm[1] * wm[6] - wm[2] * wm[5]);
                                let mut k = 0;
                                while k + 2 < ni {
                                    let (a, mut b, mut c) = (idx(k), idx(k + 1), idx(k + 2)); k += 3;
                                    if det < 0.0 { std::mem::swap(&mut b, &mut c); }
                                    let (Some(pa), Some(pb), Some(pc)) = (pw.get(a), pw.get(b), pw.get(c)) else { continue };
                                    if tri_fino(*pa, *pb, *pc) { continue; }
                                    tris.extend_from_slice(&[pa[0], pa[1], pa[2], pb[0], pb[1], pb[2], pc[0], pc[1], pc[2]]);
                                }
                            }
                        },
                        Some("b") => {
                            let (cen, tam) = (v3(&cc["c"], [0.0; 3]), v3(&cc["s"], [0.0; 3]));
                            for e in 0..8 {
                                let esq = [cen[0] + tam[0] * if e & 1 != 0 { 0.5 } else { -0.5 }, cen[1] + tam[1] * if e & 2 != 0 { 0.5 } else { -0.5 }, cen[2] + tam[2] * if e & 4 != 0 { 0.5 } else { -0.5 }];
                                let pw = punto(&wm, esq); for k in 0..3 { lo[k] = lo[k].min(pw[k]); hi[k] = hi[k].max(pw[k]); }
                            }
                            // (la caja orientada: los ejes de la matriz, la escala en los medios lados)
                            let ej: Vec<[f32; 3]> = [0usize, 4, 8].iter().map(|&o| [wm[o], wm[o + 1], wm[o + 2]]).collect();
                            let es: Vec<f32> = ej.iter().map(|e| (e[0] * e[0] + e[1] * e[1] + e[2] * e[2]).sqrt().max(1e-9)).collect();
                            let e = [0, 1, 2].map(|k| [ej[k][0] / es[k], ej[k][1] / es[k], ej[k][2] / es[k]]);
                            let h = [0, 1, 2].map(|k| (tam[k] * es[k]).abs() / 2.0 + 1e-3);
                            let f = crate::mundo::Forma::Caja { c: punto(&wm, cen), e, h };
                            cuerpos.push(crate::mundo::Cuerpo { aabb: crate::mundo::aabb_de(&f), f });
                        }
                        Some(k @ ("s" | "c")) => {
                            let e = escala(&wm); let rr = f(&cc["r"]) * e; let cen = punto(&wm, v3(&cc["c"], [0.0; 3]));
                            let f = if k == "s" { crate::mundo::Forma::Esfera { c: cen, r: rr } } else {
                                // (el eje de la cápsula: el de la matriz que dice d —0 x, 1 y, 2 z—)
                                let dd = cc["d"].as_i64().unwrap_or(1).clamp(0, 2) as usize; let o = dd * 4;
                                let ax = m4::norm([wm[o], wm[o + 1], wm[o + 2]]); let hl = (f(&cc["h"]) * e / 2.0 - rr).max(0.0);
                                crate::mundo::Forma::Capsula { a: [cen[0] - ax[0] * hl, cen[1] - ax[1] * hl, cen[2] - ax[2] * hl], b: [cen[0] + ax[0] * hl, cen[1] + ax[1] * hl, cen[2] + ax[2] * hl], r: rr }
                            };
                            cuerpos.push(crate::mundo::Cuerpo { aabb: crate::mundo::aabb_de(&f), f });
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
                let sub2: Vec<(usize, usize)> = subs.iter().map(|s| (s[0].as_u64().unwrap_or(0) as usize, s[1].as_u64().unwrap_or(0) as usize)).collect();
                let mut ib2 = ib.to_vec(); let tz = trocear(vb, &mut ib2, i32, &sub2, v3(&md["mn"], [0.0; 3]), v3(&md["sc"], [1.0; 3]));
                trozos_de.insert(mi, tz);
                let vo = poner(vb); let io = poner(&ib2);
                mallas.push(Malla { id: mi, v: v as u32, mn: v3(&md["mn"], [0.0; 3]), sc: v3(&md["sc"], [1.0; 3]), i32: i32 as u8, ni: ni as u32, vo, io, lo: -1, so: -1, lm: -1 });
            }
            let mn = v3(&md["mn"], [0.0; 3]); let sc = v3(&md["sc"], [1.0; 3]);
            let c = [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0]; let r = (sc[0] * sc[0] + sc[1] * sc[1] + sc[2] * sc[2]).sqrt() / 2.0;
            for (k, mt) in mts.iter().enumerate() {
                let Some(mt) = mt.as_i64() else { continue }; if mt < 0 { continue; }
                let Some(s) = subs.get(k) else { continue };
                if hay_mat.insert(mt) { match material(d, mt as usize) { Some(m) => mats.push(m), None => continue } }
                if !mats.iter().any(|m: &Mat| m.id == mt) { continue; }   // (oculto: no se dibuja)
                // (una cosa por trozo —la parte de la malla de una celda del espacio—: los motores dejan afuera las que no ven)
                match trozos_de.get(&mi).and_then(|t| t.get(k)).filter(|t| t.len() > 1) {
                    Some(tz) => for &(s0, sn, lo, hi) in tz {
                        let cl = [(lo[0] + hi[0]) / 2.0, (lo[1] + hi[1]) / 2.0, (lo[2] + hi[2]) / 2.0]; let rl = ((hi[0] - lo[0]).powi(2) + (hi[1] - lo[1]).powi(2) + (hi[2] - lo[2]).powi(2)).sqrt() / 2.0;
                        let cen = punto(&wm, cl); items.push(ItemDin { m: mi, s0, sn, mat: mt, mm: wm, esf: [cen[0], cen[1], cen[2], rl * escala(&wm) + 0.01], fl: 0, h: vec![] });
                    },
                    None => { let cen = punto(&wm, c); let rr = r * escala(&wm);
                        items.push(ItemDin { m: mi, s0: s[0].as_u64().unwrap_or(0) as u32, sn: s[1].as_u64().unwrap_or(0) as u32, mat: mt, mm: wm, esf: [cen[0], cen[1], cen[2], rr], fl: 0, h: vec![] }); }
                }
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
    let base = LuzBase { sol, sol_col, amb_s, amb_g, nie: Niebla { c: nie_c, a: nie_a, b: nie_b, m: nie_m, s: [0.0; 3] }, cielo: Cielo { caras: None, ..cielo.clone() } };
    let luz = luz_lineal(&base, 1.0);
    if lo[0] > hi[0] { lo = [0.0; 3]; hi = [0.0; 3]; }
    let _ = (lo, hi);
    let grav = d["aj"][nombre]["grav"].as_f64().map(|g| g as f32).filter(|g| *g != 0.0).unwrap_or(1.0);
    let mundo = crate::mundo::Mundo::nuevo(tris, cuerpos, grav);
    let aguas: Vec<[f32; 6]> = aj["agua"].as_array().map(|vs| vs.iter().map(|v| { let (a, b) = (v3(&v["lo"], [0.0; 3]), v3(&v["hi"], [0.0; 3])); [a[0], a[1], a[2], b[0], b[1], b[2]] }).collect()).unwrap_or_default();
    let (agua, agua_y) = agua_hl2(&aguas, &mundo, &mut datos);
    let cab = Cabecera { mapa: nombre.to_string(), w: 0, h: 0, cam: None, luz: None, mallas, mats, texs, lms: vec![], items: vec![], agua, cielo: Some(cielo) };
    Ok(Mapa { nombre: nombre.to_string(), esc: Escena { c: cab, datos }, items, luz, luces, spawns, lejos, mundo, agua_y, aguas, base })
}
