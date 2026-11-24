//! Los Pill Packs del Workshop (pill_gmod.js): los addons hechos para pk_pills («Parakeet's Pill Pack») hacen
//! require("pk_pills") y registran cada personaje con pk_pills.register(nombre, { printName, model, health, moveSpeed,
//! jumpPower, camera, anims, sounds, attack, attack2, reload… }). El módulo pk_pills es propio (el de verdad arma al
//! personaje con entidades del motor de Source): junta lo registrado, con la herencia de «parent», y el juego hace de cada
//! personaje de tipo «ply» un Pill (nativo/gmod_pill.rs). pk_pills.common.melee y shoot son el golpe y el disparo del
//! juego; una función propia del addon se corre con el jugador.

use crate::nucleo::*;
use jxlua::{Estado, Tabla, TablaRef, Valor};
use std::rc::Rc;

/// un personaje registrado: su nombre, su tabla (sin la herencia) y su pack (nombre, id)
#[derive(Clone)]
pub(crate) struct Forma { pub n: String, pub t: TablaRef, pub pack: (String, String) }
/// un ataque de un personaje (attack, attack2, reload)
#[derive(Clone, Debug)]
pub enum AtaquePill {
    /// pk_pills.common.melee: daño, alcance (unidades), espera (s), cuántas animaciones de golpe
    Golpe { dmg: f64, range: f64, delay: f64, anims: u32 },
    /// pk_pills.common.shoot: daño, balas, dispersión, espera
    Disparo { dmg: f64, num: f64, spread: f64, delay: f64 },
    /// una función del addon (se corre con `correr_ataque`) y su espera
    Lua { delay: f64 },
}
/// lo que el juego necesita de un personaje de un Pill Pack (pillGmDef)
#[derive(Clone, Debug)]
pub struct PillGm {
    pub nombre: String, pub impreso: String, pub pack: String, pub pack_id: String, pub modelo: String,
    pub vida: f64, pub walk: f64, pub run: f64, pub salto: f64, pub cam: f64,
    pub ataques: [Option<AtaquePill>; 3],
    /// sus sonidos: pasos, golpe, golpe que pega, golpe que no pega, disparo
    pub pasos: Vec<String>, pub s_golpe: Vec<String>, pub s_pega: Vec<String>, pub s_falla: Vec<String>, pub s_disparo: Vec<String>,
}

thread_local! {
    static FORMAS: std::cell::RefCell<Vec<Forma>> = const { std::cell::RefCell::new(Vec::new()) };
    static PACK: std::cell::RefCell<Option<(String, String)>> = const { std::cell::RefCell::new(None) };
    /// lo que pidió el Lua (pk_pills.apply / restore): Some(Some(nombre)) ponerse uno, Some(None) volver
    static PEDIDO: std::cell::RefCell<Option<Option<String>>> = const { std::cell::RefCell::new(None) };
    static ACTIVO: std::cell::RefCell<Option<String>> = const { std::cell::RefCell::new(None) };
    static COMUNES: std::cell::RefCell<Option<(Valor, Valor)>> = const { std::cell::RefCell::new(None) };
}

/// copiar y mezclar tablas como table.Copy y table.Merge (la herencia de «parent»)
fn copiar(t: &TablaRef, prof: u32) -> TablaRef {
    let c = Tabla::nueva_ref();
    for (k, v) in t.borrow().pares() { let v = match &v { Valor::Tabla(x) if prof < 12 => Valor::Tabla(copiar(x, prof + 1)), _ => v }; let _ = c.borrow_mut().set(k, v); }
    c
}
fn mezclar(dst: &TablaRef, src: &TablaRef, prof: u32) {
    for (k, v) in src.borrow().pares() {
        let d = dst.borrow().get(&k);
        if let (Valor::Tabla(a), Valor::Tabla(b), true) = (&d, &v, prof < 12) { mezclar(a, b, prof + 1); } else { let _ = dst.borrow_mut().set(k, v); }
    }
}
/// la tabla de un personaje con lo de sus padres
fn forma(n: &str, prof: u32) -> Option<TablaRef> {
    let f = FORMAS.with(|x| x.borrow().iter().find(|f| f.n == n).cloned())?;
    if let Valor::Cad(_) = tget(&f.t, "parent") { let p = js_str(&tget(&f.t, "parent")); if p != n && prof < 12 { if let Some(pt) = forma(&p, prof + 1) { let m = copiar(&pt, 0); mezclar(&m, &f.t, 0); m.borrow_mut().set_str("parent", Valor::Nil); return Some(m); } } }
    Some(f.t)
}
fn lista(v: &Valor) -> Vec<String> { match v { Valor::Cad(_) => vec![js_str(v)], Valor::Tabla(t) => t.borrow().pares().into_iter().filter_map(|(_, x)| if let Valor::Cad(_) = x { Some(js_str(&x)) } else { None }).filter(|s| !s.is_empty()).collect(), _ => vec![] } }
fn numero(v: &Valor, d: f64) -> f64 { match v { Valor::Num(x) if x.is_finite() => *x, _ => d } }
fn ruta(m: &str) -> String { let r = m.to_lowercase().replace('\\', "/"); if !r.is_empty() && !r.starts_with("models/") { format!("models/{r}") } else { r } }

pub(crate) fn instalar(e: &mut Estado) {
    FORMAS.with(|x| x.borrow_mut().clear()); PACK.with(|x| *x.borrow_mut() = None); PEDIDO.with(|x| *x.borrow_mut() = None); ACTIVO.with(|x| *x.borrow_mut() = None);
    let m = Tabla::nueva_ref();
    def(&m, "packStart", |_, a, _| {
        let n = { let s = js_str(&ar(a, 0)); let s = s.trim(); if s.is_empty() { "Pills".to_string() } else { s.chars().take(40).collect() } };
        PACK.with(|x| *x.borrow_mut() = Some((n, js_str(&ar(a, 1))))); Ok(())
    });
    def(&m, "packRequireGame", nada);
    def(&m, "hasPack", |_, a, o| { let n = js_str(&ar(a, 0)).to_lowercase(); o.push(Valor::Bool(FORMAS.with(|x| x.borrow().iter().any(|f| f.pack.1.to_lowercase() == n)))); Ok(()) });
    def(&m, "getPacks", |_, _, o| { let mut v: Vec<String> = FORMAS.with(|x| x.borrow().iter().map(|f| f.pack.1.clone()).collect()); v.dedup(); o.push(cad(&v.join(" "))); Ok(()) });
    def(&m, "register", |_, a, _| {
        let (n, t) = (ar(a, 0), ar(a, 1)); let (Valor::Cad(_), Valor::Tabla(t)) = (&n, &t) else { return Ok(()) };
        let n = js_str(&n); t.borrow_mut().set_str("name", cad(&n));
        let pack = PACK.with(|x| x.borrow().clone()).unwrap_or_else(|| { let a = g(|g| g.addon_actual.as_ref().map(|x| x.borrow().nombre.clone())).unwrap_or_else(|| "Pills".into()); (a, "pills".into()) });
        FORMAS.with(|x| { let mut x = x.borrow_mut(); x.retain(|f| f.n != n); x.push(Forma { n, t: t.clone(), pack }); });
        Ok(())
    });
    def(&m, "getPillTable", |_, a, o| { if let Some(t) = forma(&js_str(&ar(a, 0)), 0) { o.push(Valor::Tabla(t)); } Ok(()) });
    def(&m, "getFormCount", |_, _, o| { o.push(Valor::Num(FORMAS.with(|x| x.borrow().len()) as f64)); Ok(()) });
    def(&m, "getRandomForm", |e, _, o| { let l: Vec<String> = FORMAS.with(|x| x.borrow().iter().map(|f| f.n.clone()).collect()); if !l.is_empty() { let i = ((e.azar() * l.len() as f64) as usize).min(l.len() - 1); o.push(cad(&l[i])); } Ok(()) });
    // (quién usa qué: el personaje del jugador)
    def(&m, "getMappedEnt", |_, a, o| { if ACTIVO.with(|x| x.borrow().is_some()) && ar(a, 0).crudo_igual(&g(|g| g.jug.clone())) { o.push(g(|g| g.jug.clone())); } Ok(()) });
    for k in ["mapEnt", "unmapEnt", "registerDrive", "registerVox", "setAiTeam", "handeDeathCommon", "registerAttachment"] { def(&m, k, nada); }
    for k in ["getAiTeam", "getDrive"] { def(&m, k, nada); }
    def(&m, "apply", |_, a, o| { let n = ar(a, 1); if ar(a, 0).crudo_igual(&g(|g| g.jug.clone())) { if let Valor::Cad(_) = n { PEDIDO.with(|x| *x.borrow_mut() = Some(Some(js_str(&n)))); o.push(g(|g| g.jug.clone())); } } Ok(()) });
    def(&m, "restore", |_, a, o| { let si = ar(a, 0).crudo_igual(&g(|g| g.jug.clone())) && ACTIVO.with(|x| x.borrow().is_some()); if si { PEDIDO.with(|x| *x.borrow_mut() = Some(None)); } o.push(Valor::Bool(si)); Ok(()) });
    let hl = Tabla::nueva_ref();
    def(&hl, "makeList", |_, a, o| {
        let s = js_str(&ar(a, 0)); let (mut n1, mut n2) = (num(&ar(a, 1), 1.0), ar(a, 2)); if n2.es_nil() { n2 = Valor::Num(n1); n1 = 1.0; }
        let t = Tabla::nueva_ref(); let (d, h) = (n1.max(1.0) as i64, num(&n2, 0.0) as i64); let mut k = 1;
        for i in d..=h.min(d + 256) { t.borrow_mut().set(Valor::Num(k as f64), cad(&s.replace('#', &i.to_string()))).ok(); k += 1; }
        o.push(Valor::Tabla(t)); Ok(())
    });
    m.borrow_mut().set_str("helpers", Valor::Tabla(hl));
    // (los ataques comunes: se reconocen por la función)
    let c = Tabla::nueva_ref(); def(&c, "melee", nada); def(&c, "shoot", nada);
    COMUNES.with(|x| *x.borrow_mut() = Some((c.borrow().get_str("melee"), c.borrow().get_str("shoot"))));
    m.borrow_mut().set_str("common", Valor::Tabla(c));
    m.borrow_mut().set_str("convars", Valor::Tabla(Tabla::nueva_ref())); m.borrow_mut().set_str("_restricted", Valor::Tabla(Tabla::nueva_ref()));
    e.globales().borrow_mut().set_str("pk_pills", Valor::Tabla(m.clone()));
    // require("pk_pills"): el propio (el de verdad, si el pack base está instalado, no se corre)
    g(|g| g.requeridos.insert("pk_pills".into(), Valor::Tabla(m)));
}

/// los personajes de tipo «ply» con nombre y modelo (pillGmDef)
pub(crate) fn pills(e: &mut Estado) -> Vec<PillGm> {
    let comunes = COMUNES.with(|x| x.borrow().clone());
    let es = |f: &Valor, k: usize| comunes.as_ref().map(|c| f.crudo_igual(if k == 0 { &c.0 } else { &c.1 })).unwrap_or(false);
    let formas = FORMAS.with(|x| x.borrow().clone());
    let mut out = vec![];
    for f in formas {
        let Some(t) = forma(&f.n, 0) else { continue };
        let impreso = tget(&t, "printName"); let Valor::Cad(_) = impreso else { continue };
        let tipo = tget(&t, "type"); if !tipo.es_nil() && js_str(&tipo) != "ply" { continue; }
        let mut m = tget(&t, "model");
        // (el que elige entre varios —options—: el primero)
        if !matches!(m, Valor::Cad(_)) { if let Valor::Func(_) = tget(&t, "options") { if let Ok(r) = e.llamar(&tget(&t, "options"), &[]) { if let Some(Valor::Tabla(l)) = r.first() { if let Valor::Tabla(x) = l.borrow().get(&Valor::Num(1.0)) { m = tget(&x, "model"); } } } } }
        let modelo = if let Valor::Cad(_) = m { ruta(&js_str(&m)) } else { continue };
        if !modelo.ends_with(".mdl") || !existe(&modelo) { continue; }
        let mv = tget(&t, "moveSpeed"); let walk = (match &mv { Valor::Tabla(x) => numero(&tget(x, "walk"), 200.0), _ => 200.0 }).clamp(20.0, 800.0);
        let run = (match &mv { Valor::Tabla(x) => numero(&tget(x, "run"), walk), _ => walk }).clamp(walk, 1200.0);
        let cam = match tget(&t, "camera") { Valor::Tabla(x) => numero(&tget(&x, "dist"), 100.0), _ => 100.0 };
        let snd = tget(&t, "sounds"); let s = |k: &str| match &snd { Valor::Tabla(x) => lista(&tget(x, k)), _ => vec![] };
        let ataque = |v: Valor| -> Option<AtaquePill> {
            match v {
                Valor::Func(_) => Some(AtaquePill::Lua { delay: 1.0 }),
                Valor::Tabla(a) => {
                    let f = tget(&a, "func"); if !matches!(f, Valor::Func(_)) { return None; }
                    if es(&f, 0) { return Some(AtaquePill::Golpe { dmg: numero(&tget(&a, "dmg"), 25.0), range: numero(&tget(&a, "range"), 40.0), delay: numero(&tget(&a, "delay"), 0.5), anims: numero(&tget(&a, "animCount"), 0.0) as u32 }); }
                    if es(&f, 1) { return Some(AtaquePill::Disparo { dmg: numero(&tget(&a, "damage"), 10.0), num: numero(&tget(&a, "num"), 1.0), spread: numero(&tget(&a, "spread"), 0.01), delay: numero(&tget(&a, "delay"), 0.15) }); }
                    Some(AtaquePill::Lua { delay: numero(&tget(&a, "delay"), 0.5) })
                }
                _ => None,
            }
        };
        out.push(PillGm { nombre: f.n.clone(), impreso: js_str(&impreso).chars().take(40).collect(), pack: f.pack.0.clone(), pack_id: f.pack.1.clone(), modelo,
            vida: numero(&tget(&t, "health"), 100.0), walk, run, salto: numero(&tget(&t, "jumpPower"), 200.0), cam,
            ataques: [ataque(tget(&t, "attack")), ataque(tget(&t, "attack2")), ataque(tget(&t, "reload"))],
            pasos: s("step"), s_golpe: s("melee"), s_pega: s("melee_hit"), s_falla: s("melee_miss"), s_disparo: s("shoot") });
    }
    out
}
/// corre el ataque propio del addon (attack, attack2, reload: el número 0, 1 o 2) con el jugador (y el jugador como
/// la entidad del Pill: lo que use del motor que acá no hay, falla sin romper)
pub(crate) fn correr_ataque(e: &mut Estado, nombre: &str, k: usize) -> bool {
    let Some(t) = forma(nombre, 0) else { return false };
    let v = tget(&t, ["attack", "attack2", "reload"][k.min(2)]);
    let f = match &v { Valor::Func(_) => v.clone(), Valor::Tabla(a) => tget(a, "func"), _ => return false };
    if !matches!(f, Valor::Func(_)) { return false; }
    let jug = g(|g| g.jug.clone());
    let mut args = vec![jug.clone(), jug]; if let Valor::Tabla(_) = &v { args.push(v.clone()); }
    if let Err(x) = e.llamar(&f, &args) { gma_err(&x.mensaje()); }
    true
}
pub(crate) fn pedido() -> Option<Option<String>> { PEDIDO.with(|x| x.borrow_mut().take()) }
pub(crate) fn poner_activo(n: Option<String>) { ACTIVO.with(|x| *x.borrow_mut() = n); }
#[allow(dead_code)]
fn _usar(_: Rc<()>) {}
