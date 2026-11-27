//! Las herramientas de la Tool Gun de los addons (lua/weapons/gmod_tool/stools): la lista para el Tool Gun del juego,
//! usarlas (LeftClick, RightClick y Reload con la traza de los ojos, en el servidor y en el cliente, como GMod), su Think
//! y su DrawHUD mientras están elegidas, y sus ConVars («<modo>_<nombre>») como ajustes del Tool Gun.
use crate::motor::{apunta, cvar_poner, ojo, traza};
use crate::nucleo::*;
use jxlua::{Estado, TablaRef, Valor};
use std::cell::RefCell;

/// una herramienta de un addon para el Tool Gun del juego
#[derive(Clone, Debug, Default)]
pub struct HerrAddon {
    /// el modo (el nombre del archivo: «weld», «rb655_lightsaber»)
    pub modo: String,
    /// el nombre para mostrar (TOOL.Name o la frase #tool.<modo>.name)
    pub nombre: String,
    pub categoria: String,
    /// sus ConVars del cliente: (nombre sin el modo, valor por defecto)
    pub convars: Vec<(String, String)>,
}

/// un control del panel de opciones de un addon (spawnmenu.AddToolMenuOption), con su valor de ahora
#[derive(Clone, Debug, PartialEq)]
pub enum Control {
    /// una casilla (prendida o no)
    Check { txt: String, on: bool },
    /// un deslizador: el valor, el mínimo, el máximo y los decimales
    Slider { txt: String, v: f64, min: f64, max: f64, dec: u32 },
    /// un texto de ayuda o un título
    Ayuda(String),
    /// un botón
    Boton(String),
    /// una lista para elegir: las opciones y la elegida (desde 1; 0 ninguna)
    Combo { txt: String, ops: Vec<String>, sel: usize },
    /// un cuadro de texto y lo que dice
    Texto { txt: String, v: String },
}
impl Control {
    /// de la lista que devuelve __JXM_OpcArmar / __JXM_OpcLeer (derma.lua)
    pub(crate) fn de_lista(v: Option<&Valor>) -> Vec<Control> {
        let Some(Valor::Tabla(t)) = v else { return vec![] };
        let mut out = vec![];
        for i in 1..=t.borrow().len() {
            let Valor::Tabla(d) = t.borrow().get(&Valor::Num(i as f64)) else { continue };
            let s = |k: &str| { let x = d.borrow().get_str(k); if x.es_nil() { String::new() } else { js_str(&x) } };
            let n = |k: &str| match d.borrow().get_str(k) { Valor::Num(x) => x, _ => 0.0 };
            out.push(match s("t").as_str() {
                "check" => Control::Check { txt: s("txt"), on: d.borrow().get_str("on").es_verdad() },
                "slider" => Control::Slider { txt: s("txt"), v: n("v"), min: n("min"), max: n("max"), dec: n("dec").clamp(0.0, 6.0) as u32 },
                "combo" => { let ops = match d.borrow().get_str("ops") { Valor::Tabla(o) => (1..=o.borrow().len()).map(|k| js_str(&o.borrow().get(&Valor::Num(k as f64)))).collect(), _ => vec![] }; Control::Combo { txt: s("txt"), ops, sel: n("sel").max(0.0) as usize } }
                "texto" => Control::Texto { txt: s("txt"), v: s("v") },
                "boton" => Control::Boton(s("txt")),
                _ => Control::Ayuda(s("txt")),
            });
        }
        out
    }
}

thread_local! { static ACTIVA: RefCell<Option<String>> = const { RefCell::new(None) }; }

/// las tablas TOOL de cada lado (las guarda el montaje)
pub(crate) const TABLA_S: &str = "__RB_Tools";
pub(crate) const TABLA_C: &str = "__RB_ToolsC";

fn global_tabla(e: &mut Estado, n: &str) -> TablaRef {
    let gl = e.globales();
    if let Valor::Tabla(t) = gl.borrow().get_str(n) { return t; }
    let t = jxlua::Tabla::nueva_ref(); gl.borrow_mut().set_str(n, Valor::Tabla(t.clone())); t
}
/// guardar la tabla TOOL de un modo en su lado
pub(crate) fn guardar(e: &mut Estado, modo: &str, lado: Lado, t: Valor) {
    let r = global_tabla(e, if lado == Lado::S { TABLA_S } else { TABLA_C });
    r.borrow_mut().set_str(modo, t);
    if lado == Lado::S { g(|g| if !g.tools_addon.iter().any(|x| x == modo) { g.tools_addon.push(modo.to_string()); }); }
}
fn tabla(e: &mut Estado, modo: &str, lado: Lado) -> Option<TablaRef> {
    match global_tabla(e, if lado == Lado::S { TABLA_S } else { TABLA_C }).borrow().get_str(modo) { Valor::Tabla(t) => Some(t), _ => None }
}
/// el objeto de herramienta de un lado (uno por modo, con su dueño, sus objetos y su etapa)
fn objeto(e: &mut Estado, modo: &str, lado: Lado) -> Option<Valor> {
    let cache = global_tabla(e, if lado == Lado::S { "__RB_ToolObjS" } else { "__RB_ToolObjC" });
    let v = cache.borrow().get_str(modo);
    if let Valor::Tabla(_) = v { return Some(v); }
    let t = tabla(e, modo, lado)?;
    let f = e.globales().borrow().get_str("__RB_ToolNuevo");
    if !matches!(f, Valor::Func(_)) { return None; }
    let o = llamar(e, &f, lado, &[Valor::Tabla(t), cad(modo)]).into_iter().next().filter(|x| matches!(x, Valor::Tabla(_)))?;
    cache.borrow_mut().set_str(modo, o.clone());
    Some(o)
}
/// un campo del objeto como lo lee el Lua (con su __index: la tabla TOOL y después el objeto de herramienta de GMod)
fn metodo_de(e: &mut Estado, o: &Valor, k: &str) -> Valor { e.indexar(o, &cad(k)).unwrap_or(Valor::Nil) }
/// la lista para el Tool Gun del juego
pub(crate) fn lista(e: &mut Estado) -> Vec<HerrAddon> {
    let modos = g(|g| g.tools_addon.clone());
    let mut out = Vec::new();
    for modo in modos {
        let Some(t) = tabla(e, &modo, Lado::S).or_else(|| tabla(e, &modo, Lado::C)) else { continue };
        let tc = tabla(e, &modo, Lado::C);
        let campo = |k: &str| { let v = tget(&t, k); if v.es_nil() { tc.as_ref().map(|c| tget(c, k)).unwrap_or(Valor::Nil) } else { v } };
        let mut nombre = js_str(&campo("Name"));
        if nombre.is_empty() || nombre.starts_with('#') {
            let frase = if nombre.starts_with('#') { nombre[1..].to_string() } else { format!("tool.{}.name", modo) };
            let f = e.globales().borrow().get_str("language");
            let p = if let Valor::Tabla(l) = f { let gp = l.borrow().get_str("GetPhrase"); llamar(e, &gp, Lado::C, &[cad(&frase)]).into_iter().next().map(|x| js_str(&x)).unwrap_or_default() } else { String::new() };
            // (la frase de su nombre; si no hay, el texto sin «#» —«#RT Camera»—, o «tool.<modo>.name», o el modo)
            nombre = if !p.is_empty() && p != frase { p } else if !nombre.is_empty() && !frase.contains('.') { frase } else {
                let k = format!("tool.{}.name", modo);
                let f = e.globales().borrow().get_str("language");
                let p2 = if let Valor::Tabla(l) = f { let gp = l.borrow().get_str("GetPhrase"); llamar(e, &gp, Lado::C, &[cad(&k)]).into_iter().next().map(|x| js_str(&x)).unwrap_or_default() } else { String::new() };
                if !p2.is_empty() && p2 != k { p2 } else { modo.clone() }
            };
        }
        let mut convars = Vec::new();
        if let Valor::Tabla(cv) = campo("ClientConVar") { for (k, v) in cv.borrow().pares() { if let Valor::Cad(k) = k { convars.push((k.texto().into_owned(), if v.es_nil() { String::new() } else { js_str(&v) })); } } }
        convars.sort();
        out.push(HerrAddon { modo, nombre, categoria: js_str(&campo("Category")), convars });
    }
    out
}
/// elegir (o soltar) la herramienta de un addon: su Deploy y Holster, y su Think y DrawHUD mientras está
pub(crate) fn activar(e: &mut Estado, modo: Option<&str>) {
    let ant = ACTIVA.with(|a| a.borrow().clone());
    if ant.as_deref() == modo { return; }
    for lado in [Lado::S, Lado::C] {
        if let Some(a) = &ant { if let Some(o) = objeto(e, a, lado) { let f = metodo_de(e, &o, "Holster"); if matches!(f, Valor::Func(_)) { llamar(e, &f, lado, &[o.clone()]); } } }
        if let Some(m) = modo { if let Some(o) = objeto(e, m, lado) { let f = metodo_de(e, &o, "Deploy"); if matches!(f, Valor::Func(_)) { llamar(e, &f, lado, &[o.clone()]); } } }
    }
    if let Some(m) = modo { cvar_poner(e, "gmod_toolmode", m); }
    ACTIVA.with(|a| *a.borrow_mut() = modo.map(|x| x.to_string()));
}
/// el clic: «LeftClick», «RightClick» o «Reload» con la traza de los ojos, en el servidor y después en el cliente; si
/// hizo algo (devolvió verdadero en alguno de los dos)
pub(crate) fn usar(e: &mut Estado, modo: &str, met: &str) -> bool {
    let mut hizo = false;
    for lado in [Lado::S, Lado::C] {
        let Some(o) = objeto(e, modo, lado) else { continue };
        let f = metodo_de(e, &o, met);
        if !matches!(f, Valor::Func(_)) { continue; }
        let tr = traza(ojo(), apunta(), 300.0, &[], None);
        let r = llamar(e, &f, lado, &[o.clone(), tr]);
        if r.first().map(|x| x.es_verdad()).unwrap_or(false) { hizo = true; }
    }
    hizo
}
/// cada cuadro: el Think de la herramienta elegida (en los dos lados)
pub(crate) fn paso(e: &mut Estado) {
    let Some(m) = ACTIVA.with(|a| a.borrow().clone()) else { return };
    for lado in [Lado::S, Lado::C] {
        if let Some(o) = objeto(e, &m, lado) { let f = metodo_de(e, &o, "Think"); if matches!(f, Valor::Func(_)) { llamar(e, &f, lado, &[o.clone()]); } }
    }
}
/// en la HUD: el DrawHUD de la herramienta elegida (del cliente)
pub(crate) fn hud(e: &mut Estado) {
    let Some(m) = ACTIVA.with(|a| a.borrow().clone()) else { return };
    if let Some(o) = objeto(e, &m, Lado::C) { let f = metodo_de(e, &o, "DrawHUD"); if matches!(f, Valor::Func(_)) { llamar(e, &f, Lado::C, &[o.clone()]); } }
}
pub(crate) fn hay_activa() -> bool { ACTIVA.with(|a| a.borrow().is_some()) }
