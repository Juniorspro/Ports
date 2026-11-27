//! Los modos de juego (gamemodes) de los addons (gmod_modos.js): gamemodes/<modo>/<modo>.txt (título, base, "maps" con
//! los mapas que son suyos, "menusystem", "settings") y gamemodes/<modo>/gamemode/ (init.lua del server, cl_init.lua del
//! cliente, shared.lua). Cada modo deriva de otro (DeriveGamemode o la "base" del .txt: prop_hunt → fretta → base) y
//! hereda lo que no define; el motor llama sus funciones (GM:PlayerSpawn, GM:Think, GM:HUDPaint...) después de los
//! hooks, como hook.Call. Cada lado tiene su tabla: la del server en la capa de globales del server y la del cliente en
//! la del cliente (GM y GAMEMODE).
use crate::nucleo::*;
use jxlua::{Estado, Tabla, TablaRef, Valor};

/// un modo de un addon montado
#[derive(Clone, Debug)]
pub struct ModoInfo { pub n: String, pub titulo: String, pub base: String, pub mapas: Option<String>, pub menu: bool, pub ajustes: Vec<(String, String, String)>, pub addon: String }
/// el modo puesto: su nombre, título, si deriva del sandbox, y la tabla de cada lado
pub struct ModoActivo { pub n: String, pub titulo: String, pub sandbox: bool, pub s: TablaRef, pub c: TablaRef, pub cargando: bool, pub tablas: Vec<(String, Lado, TablaRef)> }

/// gmmRegistrar: los modos de todos los addons montados (en el orden en que se montaron)
pub(crate) fn lista() -> Vec<ModoInfo> {
    let addons = g(|g| g.addons.clone()); let mut v: Vec<ModoInfo> = vec![];
    for a in addons {
        let a = a.borrow(); let mut claves: Vec<&String> = a.archivos.keys().collect(); claves.sort();
        for r in claves {
            let Some(resto) = r.strip_prefix("gamemodes/") else { continue }; let Some((n, f)) = resto.split_once('/') else { continue };
            if f != format!("{n}.txt") { continue; }
            let pre = format!("gamemodes/{n}/gamemode/"); let lua: Vec<&String> = a.archivos.keys().filter(|x| x.starts_with(&pre) && x.ends_with(".lua")).collect();
            if lua.is_empty() || v.iter().any(|m| m.n == n) { continue; }
            let txt = String::from_utf8_lossy(&a.archivos[r]).into_owned();
            let k = crate::formatos::kv(&txt).map(|x| x.1).unwrap_or_default();
            // (la base: lo que dice DeriveGamemode en su código; si no, la del .txt)
            let mut base: Option<String> = None;
            for x in &lua { let s = String::from_utf8_lossy(&a.archivos[*x]); if let Some(i) = s.find("DeriveGamemode") { let resto = &s[i + 14..]; let resto = resto.trim_start().trim_start_matches('(').trim_start();
                let q = resto.chars().next().unwrap_or(' '); if q == '"' || q == '\'' { if let Some(fin) = resto[1..].find(q) { base = Some(resto[1..1 + fin].to_lowercase()); break; } } } }
            let base = base.unwrap_or_else(|| k.txt("base").unwrap_or("base").to_lowercase());
            let mut ajustes = vec![];
            if let Some(b) = k.blq("settings") { for (_, nodo) in &b.0 { if let crate::formatos::Nodo::B(x) = nodo { if let Some(nm) = x.txt("name") {
                ajustes.push((nm.to_string(), x.txt("default").unwrap_or("0").to_string(), x.txt("help").or(x.txt("text")).unwrap_or("").to_string())); } } } }
            v.push(ModoInfo { n: n.to_string(), titulo: k.txt("title").unwrap_or(n).chars().take(60).collect(), base, mapas: k.txt("maps").map(|s| s.to_string()).filter(|s| !s.is_empty()),
                menu: k.txt("menusystem").map(|s| s != "0").unwrap_or(true), ajustes, addon: a.id.clone() });
        }
    }
    v
}
/// el modo que corresponde a un mapa (su "maps" es una expresión regular simple: ^ph_, ^ttt_|^de_…)
pub(crate) fn de_mapa(mapa: &str) -> Option<String> {
    let m = mapa.to_lowercase();
    lista().into_iter().filter(|x| x.menu).find(|x| x.mapas.as_deref().map(|re| re.split('|').any(|alt| { let a = alt.trim().to_lowercase(); let (ini, a) = match a.strip_prefix('^') { Some(r) => (true, r.to_string()), None => (false, a) };
        let a = a.trim_end_matches(".*").trim_end_matches('$').replace("\\_", "_"); if a.is_empty() { return false; } if ini { m.starts_with(&a) } else { m.contains(&a) } })).unwrap_or(false)).map(|x| x.n)
}

fn tabla_de(t: &TablaRef, k: &str) -> Option<TablaRef> { if let Valor::Tabla(x) = t.borrow().get_str(k) { Some(x) } else { None } }
/// GM y GAMEMODE de un lado, en su capa de globales
fn poner_gm(lado: Lado, t: &TablaRef) {
    let capa = g(|g| if lado == Lado::C { g.ov_c.clone() } else { g.ov_s.clone() });
    if let Some(c) = capa { let mut c = c.borrow_mut(); c.set_str("GM", Valor::Tabla(t.clone())); c.set_str("GAMEMODE", Valor::Tabla(t.clone())); }
}
/// la tabla de un modo ya cargado, de un lado (DeriveGamemode y baseclass.Get("gamemode_x") mientras se carga)
pub(crate) fn tabla_cargada(n: &str, lado: Lado) -> Option<TablaRef> {
    g(|g| g.modo.as_ref().and_then(|m| m.tablas.iter().find(|(x, l, _)| x == &n.to_lowercase() && *l == lado).map(|x| x.2.clone())))
}
pub(crate) fn cargando() -> bool { g(|g| g.modo.as_ref().map(|m| m.cargando).unwrap_or(false)) }

/// gmmActivar: carga la cadena de bases de los dos lados, hereda y arranca (equipos, Initialize, el jugador entra)
pub(crate) fn activar(e: &mut Estado, n: &str) -> bool {
    let todos = lista(); let Some(m) = todos.iter().find(|x| x.n == n).cloned() else { return false };
    let mut cadena: Vec<String> = vec![]; let mut x = Some(n.to_string());
    while let Some(k) = x { if cadena.contains(&k) || cadena.len() >= 8 { break; } let Some(info) = todos.iter().find(|y| y.n == k) else { break }; cadena.insert(0, k.clone()); x = Some(info.base.clone()); }
    let raiz = todos.iter().find(|y| y.n == cadena[0]).map(|y| y.base.clone()).unwrap_or_else(|| "base".into());
    let gl = e.globales();
    let sandbox = match gl.borrow().get_str("GM") { Valor::Tabla(t) => t, _ => Tabla::nueva_ref() };
    let base = match gl.borrow().get_str("__GM_BASE") { Valor::Tabla(t) => t, _ => sandbox.clone() };
    let es_sandbox = raiz == "sandbox";
    g(|g| g.modo = Some(ModoActivo { n: n.to_string(), titulo: m.titulo.clone(), sandbox: es_sandbox, s: sandbox.clone(), c: sandbox.clone(), cargando: true,
        tablas: vec![("sandbox".into(), Lado::S, sandbox.clone()), ("sandbox".into(), Lado::C, sandbox.clone()), ("base".into(), Lado::S, base.clone()), ("base".into(), Lado::C, base.clone())] }));
    // (los "settings" de su .txt son ConVars con su valor de fábrica, como las crea GMod al arrancar el modo)
    for k in &cadena { if let Some(info) = todos.iter().find(|y| &y.n == k) { for (cn, d, h) in &info.ajustes {
        let f = gl.borrow().get_str("CreateConVar"); if let Valor::Func(_) = f { llamar(e, &f, Lado::S, &[cad(cn), cad(d), Valor::Num(0.0), cad(h)]); } } } }
    let mut fin: [Option<TablaRef>; 2] = [None, None];
    for (li, lado) in [Lado::S, Lado::C].into_iter().enumerate() {
        let mut b = if es_sandbox { sandbox.clone() } else { base.clone() };
        for x in &cadena {
            let dir = format!("gamemodes/{x}/gamemode/");
            let t = Tabla::nueva_ref();
            { let mut tt = t.borrow_mut(); tt.set_str("FolderName", cad(x)); tt.set_str("Folder", cad(&format!("gamemodes/{x}"))); tt.set_str("Name", cad(&todos.iter().find(|y| &y.n == x).map(|y| y.titulo.clone()).unwrap_or_default())); tt.set_str("BaseClass", Valor::Tabla(b.clone())); }
            g(|g| if let Some(m) = g.modo.as_mut() { m.tablas.push((x.clone(), lado, t.clone())); });
            let archivos: &[&str] = if lado == Lado::S { &["init.lua", "shared.lua"] } else { &["cl_init.lua", "shared.lua"] };
            for a in archivos {
                let r = format!("{dir}{a}"); let Some(bytes) = g(|g| g.arch.get(&r).cloned()) else { continue };
                poner_gm(lado, &t);
                en_lado(e, lado, |e| crate::libs::correr(e, &r, &bytes));
                break;
            }
            // (gamemode.Register de GMod: lo que no definió, de su base; y BaseClass apunta a ella)
            let bf = tabla_de(&t, "BaseClass").filter(|x| !std::rc::Rc::ptr_eq(x, &t)).unwrap_or_else(|| b.clone());
            let pares = bf.borrow().pares();
            { let mut tt = t.borrow_mut(); for (k, v) in pares { if js_str(&k) != "BaseClass" && tt.get(&k).es_nil() { let _ = tt.set(k, v); } } tt.set_str("BaseClass", Valor::Tabla(bf.clone())); }
            let bc = gl.borrow().get_str("baseclass"); if let Valor::Tabla(bc) = bc { let f = bc.borrow().get_str("Set"); if let Valor::Func(_) = f { llamar(e, &f, lado, &[cad(&format!("gamemode_{x}")), Valor::Tabla(t.clone())]); } }
            b = t;
        }
        fin[li] = Some(b);
    }
    let (ms, mc) = (fin[0].clone().unwrap_or_else(|| sandbox.clone()), fin[1].clone().unwrap_or_else(|| sandbox.clone()));
    poner_gm(Lado::S, &ms); poner_gm(Lado::C, &mc);
    g(|g| if let Some(m) = g.modo.as_mut() { m.s = ms.clone(); m.c = mc.clone(); m.cargando = false; });
    let gm = |e: &mut Estado, ev: &str, lado: Lado| { let t = if lado == Lado::S { ms.clone() } else { mc.clone() }; let f = t.borrow().get_str(ev); if let Valor::Func(_) = f { llamar(e, &f, lado, &[Valor::Tabla(t.clone())]); } };
    for lado in [Lado::S, Lado::C] { gm(e, "CreateTeams", lado); }
    for ev in ["PreGamemodeLoaded", "OnGamemodeLoaded", "PostGamemodeLoaded", "Initialize"] { for lado in [Lado::S, Lado::C] { gm(e, ev, lado); } }
    for lado in [Lado::S, Lado::C] { gm(e, "InitPostEntity", lado); }
    // el jugador entra: PlayerInitialSpawn y PlayerSpawn (con los hooks de los addons), sin las armas del sandbox
    if !es_sandbox { h(|h| h.quitar_armas()); }
    let jug = g(|g| g.jug.clone());
    crate::motor::hook(e, "PlayerInitialSpawn", &[Lado::S], &[jug.clone(), Valor::Bool(false)]);
    if h(|h| h.jug().vivo) { g(|g| g.jug_vivo = Some(true)); crate::motor::hook(e, "PlayerSpawn", &[Lado::S], &[jug, Valor::Bool(false)]); }
    true
}
/// sólo la función del modo (si hay uno puesto que no sea el sandbox de siempre)
pub(crate) fn gm_fn(e: &mut Estado, ev: &str, lados: &[Lado], args: &[Valor]) -> Vec<Valor> {
    for &lado in lados {
        let Some(t) = g(|g| g.modo.as_ref().filter(|m| !m.cargando).map(|m| if lado == Lado::S { m.s.clone() } else { m.c.clone() })) else { return vec![] };
        let f = t.borrow().get_str(ev); if !matches!(f, Valor::Func(_)) { continue; }
        let mut v = Vec::with_capacity(args.len() + 1); v.push(Valor::Tabla(t.clone())); v.extend_from_slice(args);
        let r = llamar(e, &f, lado, &v); if !r.is_empty() && !r[0].es_nil() { return r; }
    }
    vec![]
}
/// lo que muestra la barrita de arriba: el título, el equipo (nombre y color) si el modo es por equipos, la ronda y lo
/// que falta (de las globales de red que publican los modos de fretta: RoundNumber, RoundEndTime, InRound, RRText)
pub(crate) fn barra(e: &mut Estado) -> Option<String> {
    let (titulo, s) = g(|g| g.modo.as_ref().map(|m| (m.titulo.clone(), m.s.clone())))?;
    let mut txt = titulo;
    let gl = e.globales();
    let llamar_g = |e: &mut Estado, f: &str, a: &[Valor]| -> Valor { let fv = gl.borrow().get_str(f); if let Valor::Func(_) = fv { primero(&llamar(e, &fv, Lado::C, a)) } else { Valor::Nil } };
    if s.borrow().get_str("TeamBased").es_verdad() {
        let eq = llamar_g(e, "__JX_MiEquipo", &[]); if let Valor::Num(id) = eq { let tm = gl.borrow().get_str("team"); if let Valor::Tabla(tm) = tm { let f = tm.borrow().get_str("GetName"); if let Valor::Func(_) = f { let n = js_str(&primero(&llamar(e, &f, Lado::C, &[Valor::Num(id)]))); if !n.is_empty() { txt += &format!(" · {n}"); } } } }
    }
    let glob = |e: &mut Estado, k: &str| llamar_g(e, "GetGlobalVar", &[cad(k)]);
    if let Valor::Num(n) = glob(e, "RoundNumber") { if n > 0.0 { txt += &format!(" · Ronda {}", n as i64); } }
    let en_ronda = !matches!(glob(e, "InRound"), Valor::Bool(false));
    if let Valor::Num(fin) = glob(e, "RoundEndTime") { if fin > 0.0 && en_ronda { let ahora = h(|h| h.tiempo()); let s = (fin - ahora).max(0.0).round() as i64; txt += &format!(" · {}:{:02}", s / 60, s % 60); } }
    if !en_ronda { if let Valor::Cad(_) = glob(e, "RRText") { let rr = js_str(&glob(e, "RRText")); if !rr.is_empty() { txt += &format!(" · {rr}"); } } }
    Some(txt)
}

/// lo que cambia con los modos en las globales: DeriveGamemode (mientras se carga, la base de este lado), BroadcastLua, y
/// lo que el Lua le pide al juego (aparecer, morir callado, espectador, sin armas) y la tabla de un modo para baseclass
pub(crate) fn instalar(gl: &TablaRef) {
    def(gl, "DeriveGamemode", |e, a, _| {
        if !cargando() { return Ok(()); } let lado = g(|g| g.ctx); let n = js_str(&ar(a, 0));
        let capa = g(|g| if lado == Lado::C { g.ov_c.clone() } else { g.ov_s.clone() });
        let gm = capa.and_then(|c| if let Valor::Tabla(t) = c.borrow().get_str("GM") { Some(t) } else { None }).or_else(|| if let Valor::Tabla(t) = e.globales().borrow().get_str("GM") { Some(t) } else { None });
        if let (Some(t), Some(b)) = (gm, tabla_cargada(&n, lado)) { if !std::rc::Rc::ptr_eq(&t, &b) { t.borrow_mut().set_str("BaseClass", Valor::Tabla(b)); } }
        Ok(())
    });
    def(gl, "BroadcastLua", |e, a, _| { let f = e.globales().borrow().get_str("RunString"); if let Valor::Func(_) = f { llamar(e, &f, Lado::C, &[ar(a, 0), cad("BroadcastLua")]); } Ok(()) });
    def(gl, "__jx_modo_tabla", |_, a, o| { let n = js_str(&ar(a, 0)); let lado = g(|g| g.ctx); o.push(n.strip_prefix("gamemode_").and_then(|x| tabla_cargada(x, lado)).map(Valor::Tabla).unwrap_or(Valor::Nil)); Ok(()) });
    def(gl, "__jx_reaparecer", |e, _, _| {
        // (gmmAparecer: aparecer ya, en un punto de aparición, sin las armas del sandbox si el modo no es de él, y avisar)
        let sin_armas = g(|g| g.modo.as_ref().map(|m| !m.sandbox).unwrap_or(false));
        h(|h| h.reaparecer()); if sin_armas { h(|h| h.quitar_armas()); } h(|h| h.espectador(false));
        g(|g| g.jug_vivo = Some(true)); let jug = g(|g| g.jug.clone());
        crate::motor::hook(e, "PlayerSpawn", &[Lado::S], &[jug.clone(), Valor::Bool(false)]);
        if g(|g| g.modo.is_none()) { crate::motor::hook(e, "PlayerLoadout", &[Lado::S], &[jug]); }
        Ok(())
    });
    def(gl, "__jx_matar_callado", |_, _, _| { if h(|h| h.jug().vivo) { g(|g| g.muerte_muda = true); h(|h| h.matar_jugador()); } Ok(()) });
    def(gl, "__jx_espectador", |_, a, _| { let on = ar(a, 0).es_verdad(); h(|h| h.espectador(on)); Ok(()) });
    def(gl, "__jx_quitar_armas", |_, _, _| { if g(|g| g.modo.as_ref().map(|m| !m.sandbox).unwrap_or(false)) { h(|h| h.quitar_armas()); } Ok(()) });
    def(gl, "__jx_modo", |_, _, o| { o.push(g(|g| g.modo.as_ref().map(|m| cad(&m.n))).unwrap_or(Valor::Nil)); Ok(()) });
}
