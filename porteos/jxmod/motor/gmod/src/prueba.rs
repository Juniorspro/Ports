//! Un juego de mentira, sin ventana: anota en una traza todo lo que le pide la capa GMod. Hace lo mismo que el juego de
//! mentira del arnés de node (tests/web/traza_web.js), así las dos trazas se pueden comparar línea por línea.

use crate::anfitrion::*;
use crate::mates::{v3, Quat, V3};
use jxlua::numeros::{js_tostring, to_int32, to_precision};
use std::collections::BTreeMap;

/// un número como en la traza (6 cifras significativas)
pub fn fmt_n(x: f64) -> String {
    if x.is_nan() { return "nan".into(); }
    if x.is_infinite() { return if x > 0.0 { "inf".into() } else { "-inf".into() }; }
    if x == x.trunc() { return js_tostring(if x == 0.0 { 0.0 } else { x }); }
    let s = to_precision(x, 6);
    js_tostring(s.parse::<f64>().unwrap_or(x))
}
/// un texto como en la traza (entre comillas, lo que no es ASCII imprimible como \uXXXX)
pub fn fmt_s(s: &str) -> String {
    let mut o = String::from("\"");
    for c in s.encode_utf16() {
        match c {
            0x22 => o.push_str("\\\""),
            0x5c => o.push_str("\\\\"),
            32..=126 => o.push(c as u8 as char),
            _ => o.push_str(&format!("\\u{:04x}", c)),
        }
    }
    o.push('"');
    o
}
pub fn fmt_v(v: V3) -> String { format!("v({},{},{})", fmt_n(v.x), fmt_n(v.y), fmt_n(v.z)) }
pub fn fmt_q(q: Quat) -> String { format!("q({},{},{},{})", fmt_n(q.x), fmt_n(q.y), fmt_n(q.z), fmt_n(q.w)) }
pub fn fmt_on(x: Option<f64>) -> String { x.map(fmt_n).unwrap_or_else(|| "nil".into()) }
pub fn fmt_b(b: bool) -> String { if b { "true".into() } else { "false".into() } }
/// un color de la HUD como lo escribe la web (rgba(r,g,b,a))
pub fn css(c: &Rgba) -> String { format!("rgba({},{},{},{})", c[0], c[1], c[2], js_tostring(c[3])) }

/// el juego de mentira
pub struct AnfitrionPrueba {
    pub t: f64,
    pub dt: f64,
    pub jug: Jugador,
    pub cam: Camara,
    pub ent: Entrada,
    pub armas: Armas,
    /// las armas que existen en el juego (DEF_ARMAS)
    pub def_armas: Vec<String>,
    pub cuerpos: BTreeMap<ObjId, Cuerpo>,
    /// los prefabs de los objetos (para la traza)
    pub nombres: BTreeMap<ObjId, String>,
    pub n_obj: ObjId,
    pub datos: BTreeMap<String, String>,
    /// la traza: «<cuadro> <operación> <args>»
    pub traza: Vec<String>,
    pub cuadro: String,
    pub anotar: bool,
}

impl Default for AnfitrionPrueba {
    fn default() -> Self { AnfitrionPrueba::nuevo() }
}

impl AnfitrionPrueba {
    pub fn nuevo() -> AnfitrionPrueba {
        AnfitrionPrueba {
            t: 0.0, dt: 1.0 / 60.0, jug: Jugador::default(), cam: Camara::default(), ent: Entrada::default(),
            armas: Armas { lista: vec!["Hands".into(), "Pistol".into()], i: 0 }, def_armas: vec!["Hands".into(), "Pistol".into(), "Crowbar".into()],
            cuerpos: BTreeMap::new(), nombres: BTreeMap::new(), n_obj: 0, datos: BTreeMap::new(), traza: Vec::new(), cuadro: "m".into(), anotar: true,
        }
    }
    pub fn l(&mut self, op: &str, args: &[String]) {
        if !self.anotar { return; }
        let mut s = format!("{} {}", self.cuadro, op);
        for a in args { s.push(' '); s.push_str(a); }
        self.traza.push(s);
    }
    fn d2(&mut self, args: Vec<String>) { self.l("d2", &args); }
}

impl Anfitrion for AnfitrionPrueba {
    fn tiempo(&self) -> f64 { self.t }
    fn dt(&self) -> f64 { self.dt }
    fn reloj(&self) -> (f64, f64) { (1.7e12 + self.t * 1000.0, self.t) }
    fn nombre_jugador(&self) -> String { "Jugador".into() }
    fn nombre_mapa(&self) -> String { "gm_prueba".into() }
    fn apariciones(&self) -> Vec<(V3, Option<f64>)> { vec![(V3::default(), None)] }
    fn jug(&mut self) -> &mut Jugador { &mut self.jug }
    fn cam(&mut self) -> &mut Camara { &mut self.cam }
    fn entrada(&mut self) -> &mut Entrada { &mut self.ent }
    fn armas(&mut self) -> &mut Armas { &mut self.armas }
    fn arma_definida(&self, n: &str) -> bool { self.def_armas.iter().any(|x| x == n) }
    fn registrar_arma(&mut self, n: &str, _base: Option<&str>, _impreso: &str) { if !self.arma_definida(n) { self.def_armas.push(n.to_string()); } }
    fn dar_arma(&mut self, n: &str) {
        self.l("dar_arma", &[fmt_s(n)]);
        if !self.armas.lista.iter().any(|x| x == n) { self.armas.lista.push(n.to_string()); }
        self.armas.i = self.armas.lista.iter().position(|x| x == n).unwrap_or(0);
    }
    fn elegir_arma(&mut self, i: usize) { self.l("elegir_arma", &[i.to_string()]); self.armas.i = i; }
    fn elegir_arma_callado(&mut self, n: &str) {
        self.l("elegir_arma_n", &[fmt_s(n)]);
        if let Some(i) = self.armas.lista.iter().position(|x| x == n) { self.armas.i = i; }
    }
    fn prefab(&mut self, modelo: &str, en_addon: bool) -> Option<Prefab> {
        if en_addon { return Some(Prefab { nombre: format!("gm:{}", modelo), sustituto: false }); }
        let base = modelo.rsplit('/').next().unwrap_or(modelo).trim_end_matches(".mdl");
        Some(Prefab { nombre: "Crate".into(), sustituto: base != "crate" })
    }
    fn modelo_falta(&mut self, _m: &str) { self.aviso("gm.falta", 4.0); }
    fn caja_prefab(&self, p: &str) -> Option<([f64; 3], [f64; 3])> { if p == "Crate" { Some(([-0.4, -0.4, -0.4], [0.8, 0.8, 0.8])) } else { None } }
    fn crear_objeto(&mut self, pf: &str, pos: V3, q: Quat) -> Option<ObjId> {
        self.n_obj += 1;
        let id = self.n_obj;
        self.l("crear_objeto", &[fmt_s(pf), fmt_v(pos), fmt_q(q)]);
        self.cuerpos.insert(id, Cuerpo::nuevo(pos, q));
        self.nombres.insert(id, pf.to_string());
        Some(id)
    }
    fn borrar_objeto(&mut self, o: ObjId) {
        if self.cuerpos.remove(&o).is_some() { self.l("borrar_objeto", &[format!("o#{}", o)]); }
    }
    fn cuerpo(&mut self, o: ObjId) -> Option<&mut Cuerpo> { self.cuerpos.get_mut(&o) }
    fn objetos(&self) -> Vec<ObjId> { self.cuerpos.keys().copied().collect() }
    fn subir_vehiculo(&mut self, o: ObjId) { self.l("subir_vehiculo", &[format!("o#{}", o)]); }
    fn raycast(&mut self, o: V3, d: V3, max: f64, _ign: &[ObjId]) -> Option<Golpe> {
        // (el piso: el plano y = 0)
        if !(d.y < -1e-9) { return None; }
        let t = -o.y / d.y;
        if t < 0.0 || t > max { return None; }
        Some(Golpe { t, p: o.add(d.scale(t)), n: v3(0.0, 1.0, 0.0), obj: None, persona: None })
    }
    fn sonido(&mut self, n: &str, pos: Option<V3>, vol: f64, tono: f64) {
        let p = pos.map(fmt_v).unwrap_or_else(|| "nil".into());
        self.l("sonido", &[fmt_s(n), p, fmt_n(vol), fmt_n(tono)]);
    }
    fn emitir_sonido(&mut self, e: Option<f64>, s: &str, nivel: Option<f64>, tono: Option<f64>, vol: Option<f64>, canal: Option<f64>) {
        self.l("emitir_sonido", &[fmt_on(e), fmt_s(s), fmt_on(nivel), fmt_on(tono), fmt_on(vol), fmt_on(canal)]);
    }
    fn parar_sonido(&mut self, e: Option<f64>, s: &str) { self.l("parar_sonido", &[fmt_on(e), fmt_s(s)]); }
    fn parche_sonido(&mut self, _id: u32, e: Option<f64>, s: &str, on: bool, vol: Option<f64>, tono: Option<f64>, fundido: Option<f64>) {
        self.l("parche_sonido", &[fmt_on(e), fmt_s(s), fmt_b(on), fmt_on(vol), fmt_on(tono), fmt_on(fundido)]);
    }
    fn danar_jugador(&mut self, d: f64) { self.l("danar_jugador", &[fmt_n(d)]); }
    fn danar_objeto(&mut self, o: ObjId, d: f64, p: V3, dir: V3) { self.l("danar_objeto", &[format!("o#{}", o), fmt_n(d), fmt_v(p), fmt_v(dir)]); }
    fn danar_persona(&mut self, pe: PersonaId, d: f64, p: V3, dir: V3) { self.l("danar_persona", &[format!("p#{}", pe), fmt_n(d), fmt_v(p), fmt_v(dir)]); }
    fn matar_jugador(&mut self) { self.l("matar_jugador", &[]); self.jug.vivo = false; }
    fn explosion(&mut self, p: V3, r: f64, m: f64, sin_fx: bool) { self.l("explosion", &[fmt_v(p), fmt_n(r), fmt_n(m), fmt_b(sin_fx)]); }
    fn efecto_impacto(&mut self, p: V3, n: V3, cuerpo: bool) { self.l("efecto_impacto", &[fmt_v(p), fmt_v(n), fmt_s(if cuerpo { "cuerpo" } else { "mundo" })]); }
    fn efecto_explosion(&mut self, p: V3) { self.l("efecto_explosion", &[fmt_v(p)]); }
    fn efecto_traza(&mut self, a: V3, b: V3) { self.l("efecto_traza", &[fmt_v(a), fmt_v(b)]); }
    fn efecto_fogonazo(&mut self) { self.l("efecto_fogonazo", &[]); }
    fn particula(&mut self, p: V3, v: V3, vida: f64, tam: f64, c: [f64; 4], tipo: &str, crece: Option<f64>) {
        let col = format!("[{},{},{},{}]", fmt_n(c[0]), fmt_n(c[1]), fmt_n(c[2]), fmt_n(c[3]));
        self.l("particula", &[fmt_v(p), fmt_v(v), fmt_n(vida), fmt_n(tam), col, fmt_s(tipo), fmt_on(crece)]);
    }
    fn sacudir(&mut self, a: f64) { self.l("sacudir", &[fmt_n(a)]); }
    fn efecto_lua(&mut self, n: &str) { self.l("efecto_lua", &[fmt_s(n)]); }
    fn dibujar_modelo(&mut self, e: f64) { self.l("dibujar_modelo", &[fmt_n(e)]); }
    fn linterna(&mut self, on: bool) { self.l("linterna", &[fmt_b(on)]); }
    fn chat(&mut self, s: &str) { self.l("chat", &[fmt_s(s)]); }
    fn aviso(&mut self, s: &str, d: f64) { self.l("aviso", &[fmt_s(s), fmt_n(d)]); }
    fn consola(&mut self, s: &str) { self.l("consola", &[fmt_s(s)]); }
    fn error_lua(&mut self, s: &str) { self.l("error", &[fmt_s(s)]); }
    fn dibujar_2d(&mut self, c: Cmd2D) {
        let n = fmt_n;
        let v = match c {
            Cmd2D::Guardar => vec![fmt_s("save")],
            Cmd2D::Restaurar => vec![fmt_s("restore")],
            Cmd2D::Mover(x, y) => vec![fmt_s("translate"), n(x), n(y)],
            Cmd2D::Rotar(r) => vec![fmt_s("rotate"), n(r)],
            Cmd2D::Rect { x, y, w, h, color, alfa } => vec![fmt_s("rect"), n(x), n(y), n(w), n(h), fmt_s(&css(&color)), n(alfa)],
            Cmd2D::Borde { x, y, w, h, color, ancho } => vec![fmt_s("srect"), n(x), n(y), n(w), n(h), fmt_s(&css(&color)), n(ancho)],
            Cmd2D::Texto { s, x, y, fuente, color, base } => vec![fmt_s("texto"), fmt_s(&s), n(x), n(y), fmt_s(&fuente), fmt_s(&css(&color)), fmt_s(&base)],
            Cmd2D::TextoBorde { s, x, y, fuente, color, ancho } => vec![fmt_s("stexto"), fmt_s(&s), n(x), n(y), fmt_s(&fuente), fmt_s(&css(&color)), n(ancho)],
            Cmd2D::Camino => vec![fmt_s("path")],
            Cmd2D::Ir(x, y) => vec![fmt_s("mover"), n(x), n(y)],
            Cmd2D::Linea(x, y) => vec![fmt_s("linea"), n(x), n(y)],
            Cmd2D::Curva(a, b, c2, d) => vec![fmt_s("curva"), n(a), n(b), n(c2), n(d)],
            Cmd2D::Arco(x, y, r) => vec![fmt_s("arco"), n(x), n(y), n(r)],
            Cmd2D::Cerrar => vec![fmt_s("cerrar")],
            Cmd2D::Llenar(c) => vec![fmt_s("llenar"), fmt_s(&css(&c))],
            Cmd2D::Trazar(c, w) => vec![fmt_s("trazar"), fmt_s(&css(&c)), n(w)],
            Cmd2D::Imagen { material, .. } => vec![fmt_s("imagen"), fmt_s(&material)],
            Cmd2D::Recorte { x, y, w, h } => vec![fmt_s("recorte"), n(x), n(y), n(w), n(h)],
        };
        self.d2(v);
    }
    fn ancho_texto(&mut self, fuente: &str, s: &str) -> f64 {
        // (el mismo cálculo que el lienzo de mentira del arnés de node)
        let px = fuente.find("px").and_then(|i| {
            let ini = fuente[..i].rfind(|c: char| !(c.is_ascii_digit() || c == '.')).map(|j| j + 1).unwrap_or(0);
            fuente[ini..i].parse::<f64>().ok()
        }).unwrap_or(13.0);
        s.encode_utf16().count() as f64 * px * 0.5
    }
    fn como_any(&mut self) -> Option<&mut dyn std::any::Any> { Some(self) }
    fn dato(&mut self, k: &str) -> Option<String> { self.datos.get(k).cloned() }
    fn poner_dato(&mut self, k: &str, v: Option<&str>) { match v { Some(v) => { self.datos.insert(k.into(), v.into()); } None => { self.datos.remove(k); } } }
}

/// (para que el compilador no se queje si no se usa)
#[allow(dead_code)]
fn _i32(x: f64) -> i32 { to_int32(x) }
