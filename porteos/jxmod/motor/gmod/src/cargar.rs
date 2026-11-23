//! La capa GMod entera: arrancar el Lua con la API, montar addons (carpetas y .gma) en el orden de GMod, y lo que corre
//! en cada cuadro (gmaPaso, gmaSwepPaso, gmaHUDPaso). Es lo de gmod_cargar.js y gmaIniciar de la web.

use crate::anfitrion::*;
use crate::mates::*;
use crate::motor::*;
use crate::nucleo::*;
use jxlua::{Estado, Tabla, TablaRef, Udata, Valor};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

/// la capa GMod: un Lua con la API de Garry's Mod y los addons montados
pub struct Gmod {
    pub lua: Estado,
    ctx: Rc<Ctx>,
}

/// un choque fuerte de la física de este cuadro (para ENT:PhysicsCollide)
#[derive(Clone, Debug)]
pub struct Choque {
    /// los dos objetos (None: el mundo)
    pub a: ObjId,
    pub b: Option<ObjId>,
    pub pos: V3,
    /// la velocidad del choque (m/s)
    pub vel: f64,
}

impl Gmod {
    /// arranca el Lua con la API de GMod y el prelude (gmaIniciar)
    pub fn nuevo(anfitrion: Box<dyn Anfitrion>) -> Gmod { Gmod::nuevo_con(anfitrion, None) }
    /// lo mismo, con la semilla del azar puesta antes de arrancar (para repetir una partida o comparar trazas)
    pub fn nuevo_con(anfitrion: Box<dyn Anfitrion>, semilla: Option<u64>) -> Gmod {
        let ctx = Rc::new(Ctx { g: RefCell::new(Gma::nuevo()), h: RefCell::new(anfitrion) });
        poner_ctx(Some(ctx.clone()));
        let mut e = Estado::nuevo();
        if let Some(s) = semilla { e.set_semilla(s); }
        e.set_salida(|s| consola(&String::from_utf8_lossy(s).trim_end_matches('\n').to_string()));
        e.set_reloj(Some(Rc::new(|| h(|h| h.reloj()))));
        // (math.randomseed no hace nada, como en la web: el azar es uno solo para el Lua y el motor)
        if let Valor::Tabla(m) = e.global("math") { def(&m, "randomseed", nada); }
        crate::valores::instalar(&mut e);
        crate::entidades::instalar(&mut e);
        crate::libs::instalar(&mut e);
        crate::valores::instalar_faltantes(&mut e);
        crate::valores::instalar_tipos(&mut e);
        match e.compilar(PRELUDE.as_bytes(), "gmod/prelude.lua").and_then(|f| e.llamar(&f, &[])) {
            Ok(_) => {}
            Err(x) => gma_err(&format!("prelude: {}", x.mensaje())),
        }
        e.set_global("SERVER", Valor::Bool(true));
        e.set_global("CLIENT", Valor::Bool(false));
        let (s, c) = (Tabla::nueva_ref(), Tabla::nueva_ref());
        e.set_capa_globales(Some(s.clone()));
        g(|g| { g.ov_s = Some(s); g.ov_c = Some(c); g.cargado_prelude = true; });
        Gmod { lua: e, ctx }
    }
    /// este Gmod pasa a ser el del hilo (hace falta sólo si hay más de uno)
    pub fn activar(&self) { poner_ctx(Some(self.ctx.clone())); }
    /// el juego
    pub fn anfitrion<R>(&self, f: impl FnOnce(&mut dyn Anfitrion) -> R) -> R { self.activar(); h(f) }
    /// los errores de cada addon y los métodos del motor que pidieron y no están
    pub fn errores(&self, addon: usize) -> Vec<String> { self.activar(); g(|g| g.addons.get(addon).map(|a| a.borrow().errores.clone()).unwrap_or_default()) }
    pub fn faltan(&self) -> Vec<(String, u32)> { self.activar(); let mut v: Vec<(String, u32)> = g(|g| g.faltan.iter().map(|(k, n)| (k.clone(), *n)).collect()); v.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0))); v }
    /// las armas (SWEP) y entidades (SENT) que el menú puede poner, de un addon montado
    pub fn sweps(&self, addon: usize) -> Vec<String> { self.activar(); g(|g| g.addons.get(addon).map(|a| a.borrow().sweps.clone()).unwrap_or_default()) }
    pub fn sents(&self, addon: usize) -> Vec<String> { self.activar(); g(|g| g.addons.get(addon).map(|a| a.borrow().sents.clone()).unwrap_or_default()) }
    pub fn lua_corridos(&self, addon: usize) -> usize { self.activar(); g(|g| g.addons.get(addon).map(|a| a.borrow().lua_corridos).unwrap_or(0)) }
    /// el zoom que pidió el Lua (Player:SetFOV; 0: ninguno) y el DrawColorModify del cuadro
    pub fn fov_lua(&self) -> f64 { self.activar(); g(|g| g.fov_lua) }
    pub fn color_modify(&self) -> Option<[f64; 9]> { self.activar(); g(|g| g.pp) }
    /// envuelve cada función nativa de la API (las globales con mayúscula, las bibliotecas que no son las de Lua y los
    /// métodos de las metatablas) para anotar cada llamada con sus argumentos (para comparar con la web)
    #[doc(hidden)]
    pub fn anotar_api(&mut self, anotar: Rc<dyn Fn(String)>) {
        self.activar();
        crate::nucleo::anotar_api(&mut self.lua, anotar);
    }
    /// el número de la última entidad creada (para las pruebas)
    #[doc(hidden)]
    pub fn nid(&self) -> i64 { self.activar(); g(|g| g.nid) }
    /// las luces de los addons (conos o, con `comun`, las dinámicas)
    pub fn luces(&self, comun: bool) -> Vec<crate::resto::Luz> { self.activar(); crate::resto::luces(comun) }
    /// las entidades de los addons que tienen cuerpo en el juego (objeto → clase)
    pub fn objetos_lua(&self) -> Vec<(ObjId, String)> { self.activar(); g(|g| g.ent_por_obj.iter().map(|(o, e)| (*o, ce(e, |x| x.clase.clone()).unwrap_or_default())).collect()) }

    /// montar un addon: corre su Lua en el orden de GMod (gmLuaMontar). Devuelve su número
    pub fn montar(&mut self, addon: Addon) -> usize {
        self.activar();
        let e = &mut self.lua;
        let a = Rc::new(RefCell::new(addon));
        let idx = g(|g| {
            for (r, b) in &a.borrow().archivos { g.arch.entry(r.clone()).or_insert_with(|| b.clone()); }
            g.addons.push(a.clone());
            g.activo = true;
            g.addons.len() - 1
        });
        montar_lua(e, &a);
        idx
    }

    /// un cuadro (gmLuaPaso): timers, red, el jugador, hooks de cada cuadro, armas, entidades. `choques`: los de la física
    pub fn paso(&mut self, dt: f64, choques: &[Choque]) {
        self.activar();
        if !g(|g| g.activo) { return; }
        paso(&mut self.lua, dt, choques);
    }
    /// la HUD de los addons (gmaHUDPaso): HUDPaint y el DrawHUD del arma, como órdenes de dibujo al juego
    pub fn hud(&mut self) { self.activar(); hud(&mut self.lua); }
    /// tocar algo del menú: "gmswep:<clase>" da el arma; "gment:<clase>" pone la entidad con su SpawnFunction
    pub fn spawn_menu(&mut self, item: &str) -> bool { self.activar(); spawn_menu(&mut self.lua, item) }
    /// un arma de un addon al jugador (como desde el menú)
    pub fn dar_arma(&mut self, clase: &str) { self.activar(); dar_arma(&mut self.lua, clase, false); }
    /// un bind de GMod (PlayerBindPress): true si el Lua lo tomó
    pub fn bind(&mut self, b: &str) -> bool {
        self.activar();
        let jug = g(|g| g.jug.clone());
        let r = hook(&mut self.lua, "PlayerBindPress", C, &[jug, cad(b), Valor::Bool(true)]);
        matches!(r.first(), Some(Valor::Bool(true)))
    }
    /// algo del juego le pegó a un objeto que es una entidad de un addon (gmaDanoObj): true si era de un addon
    pub fn dano_objeto(&mut self, o: ObjId, dano: f64, pos: Option<V3>, dir: Option<V3>) -> bool {
        self.activar();
        let Some(ent) = g(|g| g.ent_por_obj.get(&o).cloned()) else { return false };
        let clase = ce(&ent, |x| x.clase.clone()).unwrap_or_default();
        if clase_tabla(&clase, Lado::S).is_none() || g(|g| g.danando) { return false; }
        g(|g| g.danando = true);
        let jug = g(|g| g.jug.clone());
        let d = dmg_info(dano, Some(jug.clone()), Some(jug), pos.map(vv));
        if let Some(dd) = dir { di(&d, |x| x.fuerza = vvd(dd)); }
        hook(&mut self.lua, "EntityTakeDamage", S, &[ent.clone(), d.clone()]);
        metodo(&mut self.lua, &ent, "OnTakeDamage", Lado::S, &[d]);
        g(|g| g.danando = false);
        true
    }
    /// el jugador usa (E) un objeto: si es de un addon, su ENT:Use (gmaUsarObj)
    pub fn usar_objeto(&mut self, o: ObjId) -> bool {
        self.activar();
        let Some(mut ent) = g(|g| g.ent_por_obj.get(&o).cloned()) else { return false };
        for _ in 0..16 { let cl = ce(&ent, |x| x.clase.clone()).unwrap_or_default(); if clase_tabla(&cl, Lado::S).is_some() { break; } match padre_de(&ent) { Some(p) => ent = p, None => break } }
        let cl = ce(&ent, |x| x.clase.clone()).unwrap_or_default();
        if clase_tabla(&cl, Lado::S).is_none() { return false; }
        let jug = g(|g| g.jug.clone());
        usar(&mut self.lua, &ent, &jug);
        true
    }
    /// correr un pedazo de Lua (para probar o desde una consola), con el lado puesto
    pub fn correr(&mut self, src: &str, nombre: &str, cliente: bool) -> Result<Vec<Valor>, String> {
        self.activar();
        let lado = if cliente { Lado::C } else { Lado::S };
        g(|g| g.activo = true);
        en_lado(&mut self.lua, lado, |e| e.compilar(src.as_bytes(), nombre).and_then(|f| e.llamar(&f, &[]))).map_err(|x| x.mensaje())
    }
}


/// el prelude de la web (gmod_prelude.js, GMA_PRELUDE): extensiones de string/table/math, enums, weapon_base...
pub const PRELUDE: &str = include_str!("prelude.lua");

// ---------------- leer addons ----------------
impl Addon {
    /// un addon con sus archivos (rutas como en el .gma: se pasan a minúsculas con /)
    pub fn de_archivos(id: &str, nombre: &str, archivos: Vec<(String, Vec<u8>)>) -> Addon {
        let mut m = HashMap::new();
        for (r, b) in archivos { m.insert(r.to_lowercase().replace('\\', "/"), Rc::from(b.into_boxed_slice())); }
        let mut lua: Vec<String> = m.keys().filter(|r: &&String| r.ends_with(".lua")).cloned().collect();
        lua.sort();
        Addon { id: id.to_string(), nombre: nombre.to_string(), archivos: m, lua, ..Default::default() }
    }
}
/// los archivos de un .gma (ruta, contenido)
pub fn leer_gma(b: &[u8]) -> Option<Vec<(String, Vec<u8>)>> {
    if b.len() < 5 || &b[0..4] != b"GMAD" { return None; }
    let mut p = 4usize;
    let ver = b[p];
    p += 1 + 16;
    let cad = |p: &mut usize| -> Option<String> { let i = b[*p..].iter().position(|c| *c == 0)? + *p; let s = String::from_utf8_lossy(&b[*p..i]).into_owned(); *p = i + 1; Some(s) };
    if ver > 1 { while !cad(&mut p)?.is_empty() {} }
    cad(&mut p)?; cad(&mut p)?; cad(&mut p)?;
    p += 4;
    let mut ents = Vec::new();
    loop {
        let n = u32::from_le_bytes(b.get(p..p + 4)?.try_into().ok()?);
        p += 4;
        if n == 0 { break; }
        let nom = cad(&mut p)?;
        let tam = i64::from_le_bytes(b.get(p..p + 8)?.try_into().ok()?) as usize;
        p += 12;
        ents.push((nom, tam));
    }
    let mut out = Vec::new();
    for (nom, tam) in ents { let d = b.get(p..p + tam)?.to_vec(); p += tam; out.push((nom.to_lowercase().replace('\\', "/"), d)); }
    Some(out)
}
/// los archivos de una carpeta (con lua/ adentro, o con nombres aplanados: lua__autorun__x.lua)
pub fn leer_carpeta(d: &std::path::Path) -> Vec<(String, Vec<u8>)> {
    let mut out = Vec::new();
    fn rec(x: &std::path::Path, rel: &str, out: &mut Vec<(String, Vec<u8>)>) {
        let Ok(rd) = std::fs::read_dir(x) else { return };
        let mut ents: Vec<_> = rd.flatten().collect();
        ents.sort_by_key(|e| e.file_name());
        for en in ents {
            let n = en.file_name().to_string_lossy().into_owned();
            let r = if rel.is_empty() { n.clone() } else { format!("{}/{}", rel, n) };
            let f = en.path();
            if f.is_dir() { rec(&f, &r, out); } else if let Ok(b) = std::fs::read(&f) { out.push((r.to_lowercase(), b)); }
        }
    }
    rec(d, "", &mut out);
    out.into_iter().map(|(r, b)| {
        let base = r.rsplit('/').next().unwrap_or(&r).to_string();
        let q = if ["lua__", "materials__", "models__", "sound__"].iter().any(|p| base.starts_with(p)) { base.replace("__", "/") }
            else if let Some(i) = r.find("lua/") { if i > 0 && r.as_bytes()[i - 1] == b'/' { r[i..].to_string() } else { r.clone() } } else { r.clone() };
        (q, b)
    }).collect()
}

// ---------------- montar (gmLuaMontar) ----------------
fn montar_lua(e: &mut Estado, a: &Rc<RefCell<Addon>>) {
    if a.borrow().lua.is_empty() { return; }
    let id = a.borrow().id.clone();
    g(|g| { g.addon_actual = Some(a.clone()); g.activo = true; });
    { let mut x = a.borrow_mut(); x.errores.clear(); x.sweps.clear(); x.sents.clear(); x.efectos.clear(); x.ef_obj = None; }
    g(|g| g.fantasmas.remove(&id));
    // (los hooks de antes, para correr los de arranque sólo en los nuevos)
    let antes: HashMap<String, Vec<(Valor, Option<Valor>, Option<Valor>)>> = g(|g| g.hooks.v.iter().map(|(ev, hs)| (ev.clone(), hs.iter().map(|(id, h)| (id.clone(), h.s.clone(), h.c.clone())).collect())).collect());
    let l = a.borrow().lua.clone();
    let mut corrido: Vec<String> = Vec::new();
    let ajena = |r: &str| g(|g| g.rutas_corridas.get(r).map(|x| *x != id).unwrap_or(false));
    let correr = |e: &mut Estado, ctx: Lado, r: &str, corrido: &mut Vec<String>| {
        if ajena(r) { return; }
        let b = g(|g| g.arch.get(r).cloned()).or_else(|| a.borrow().archivos.get(r).cloned());
        let Some(b) = b else { return };
        if !corrido.iter().any(|x| x == r) { corrido.push(r.to_string()); }
        g(|g| g.rutas_corridas.insert(r.to_string(), id.clone()));
        en_lado(e, ctx, |e| crate::libs::correr(e, r, &b));
    };
    let un_nivel = |r: &str, pre: &str| r.strip_prefix(pre).map(|x| !x.contains('/') && x.ends_with(".lua")).unwrap_or(false);
    // 1) autorun
    for r in &l { if un_nivel(r, "lua/autorun/") { correr(e, Lado::S, r, &mut corrido); correr(e, Lado::C, r, &mut corrido); } }
    for r in &l { if un_nivel(r, "lua/autorun/server/") { correr(e, Lado::S, r, &mut corrido); } }
    for r in &l { if un_nivel(r, "lua/autorun/client/") { correr(e, Lado::C, r, &mut corrido); } }
    // 2) clases: armas, entidades y efectos
    #[derive(Default, Clone)]
    struct Grupo { tipo: String, nombre: String, solo: Option<String>, init: Option<String>, cl_init: Option<String>, shared: Option<String> }
    let mut grupos: Vec<(String, Grupo)> = Vec::new();
    let mut herramientas: Vec<(String, String)> = Vec::new();
    for r in &l {
        let resto = if let Some(x) = r.strip_prefix("lua/") { Some(x) } else if let Some(x) = r.strip_prefix("gamemodes/") { x.find('/').and_then(|i| x[i + 1..].strip_prefix("entities/")) } else { None };
        let Some(resto) = resto else { continue };
        let partes: Vec<&str> = resto.split('/').collect();
        if partes.len() >= 2 && ["weapons", "entities", "effects"].contains(&partes[0]) {
            let tipo = partes[0];
            if partes.len() == 2 && partes[1].ends_with(".lua") && partes[1].len() > 4 {
                let nombre = &partes[1][..partes[1].len() - 4];
                let k = format!("{}/{}", tipo, nombre);
                match grupos.iter_mut().find(|x| x.0 == k) { Some(x) => x.1.solo = Some(r.clone()), None => grupos.push((k, Grupo { tipo: tipo.into(), nombre: nombre.into(), solo: Some(r.clone()), ..Default::default() })) }
                continue;
            }
            if partes.len() == 3 && ["init.lua", "cl_init.lua", "shared.lua"].contains(&partes[2]) && !partes[1].is_empty() {
                let nombre = partes[1];
                let k = format!("{}/{}", tipo, nombre);
                let gr = match grupos.iter_mut().find(|x| x.0 == k) { Some(x) => &mut x.1, None => { grupos.push((k, Grupo { tipo: tipo.into(), nombre: nombre.into(), ..Default::default() })); &mut grupos.last_mut().unwrap().1 } };
                match partes[2] { "init.lua" => gr.init = Some(r.clone()), "cl_init.lua" => gr.cl_init = Some(r.clone()), _ => gr.shared = Some(r.clone()) }
                continue;
            }
        }
        if r.starts_with("lua/weapons/gmod_tool/stools/") { let n = &r["lua/weapons/gmod_tool/stools/".len()..]; if !n.contains('/') && n.ends_with(".lua") { herramientas.push((n[..n.len() - 4].to_string(), r.clone())); } }
    }
    for tipo in ["weapons", "entities", "effects"] {
        let mut gs: Vec<Grupo> = grupos.iter().filter(|x| x.1.tipo == tipo).map(|x| x.1.clone()).collect();
        gs.sort_by(|a, b| a.nombre.cmp(&b.nombre));
        for gr in gs {
            if gr.nombre == "gmod_tool" && tipo == "weapons" { continue; }
            if [&gr.solo, &gr.init, &gr.shared, &gr.cl_init].iter().any(|r| r.as_ref().map(|r| ajena(r)).unwrap_or(false)) { continue; }
            let nombre = gr.nombre.to_lowercase();
            let v = match tipo { "weapons" => "SWEP", "entities" => "ENT", _ => "EFFECT" };
            let lados: &[Lado] = if tipo == "effects" { &[Lado::C] } else { &[Lado::S, Lado::C] };
            for &ctx in lados {
                let r = gr.solo.clone().or_else(|| if tipo == "effects" { gr.init.clone().or(gr.cl_init.clone()).or(gr.shared.clone()) } else if ctx == Lado::S { gr.init.clone().or(gr.shared.clone()) } else { gr.cl_init.clone().or(gr.shared.clone()) });
                let Some(r) = r else { continue };
                en_lado(e, ctx, |e| {
                    let tt = Tabla::nueva_ref();
                    tt.borrow_mut().set_str("Folder", cad(&format!("{}/{}", tipo, gr.nombre)));
                    if tipo == "weapons" { tt.borrow_mut().set_str("Primary", Valor::Tabla(Tabla::nueva_ref())); tt.borrow_mut().set_str("Secondary", Valor::Tabla(Tabla::nueva_ref())); }
                    let gl = e.globales();
                    let prev = gl.borrow().get_str(v);
                    gl.borrow_mut().set_str(v, Valor::Tabla(tt.clone()));
                    let cc0 = g(|g| std::mem::replace(&mut g.cargando_clase, Some(v)));
                    correr(e, ctx, &r, &mut corrido);
                    g(|g| g.cargando_clase = cc0);
                    let t2 = match gl.borrow().get_str(v) { Valor::Tabla(x) => x, _ => tt.clone() };
                    gl.borrow_mut().set_str(v, prev);
                    match tipo {
                        "weapons" => crate::resto::registrar(e, true, &nombre, &Valor::Tabla(t2)),
                        "entities" => crate::resto::registrar(e, false, &nombre, &Valor::Tabla(t2)),
                        _ => {
                            t2.borrow_mut().set_str("ClassName", cad(&nombre));
                            if t2.borrow().meta().is_none() { if let Valor::Tabla(b) = gl.borrow().get_str("__EFFECT_BASE") { let m = Tabla::nueva_ref(); m.borrow_mut().set_str("__index", Valor::Tabla(b)); t2.borrow_mut().set_meta(Some(m)); } }
                            g(|g| g.efectos.set(&nombre, t2));
                            a.borrow_mut().efectos.push(nombre.clone());
                        }
                    }
                });
            }
        }
    }
    // 3) herramientas de la Tool Gun: se cargan en los dos lados, con TOOL
    let tool_tabla = |e: &mut Estado, n: &str| {
        let tt = Tabla::nueva_ref();
        tt.borrow_mut().set_str("Mode", cad(n));
        tt.borrow_mut().set_str("ClientConVar", Valor::Tabla(Tabla::nueva_ref()));
        tt.borrow_mut().set_str("ServerConVar", Valor::Tabla(Tabla::nueva_ref()));
        if let Valor::Tabla(b) = e.globales().borrow().get_str("__ToolObj") { let m = Tabla::nueva_ref(); m.borrow_mut().set_str("__index", Valor::Tabla(b)); tt.borrow_mut().set_meta(Some(m)); }
        tt
    };
    for (n, r) in &herramientas {
        en_lado(e, Lado::S, |e| {
            let tt = tool_tabla(e, n);
            e.globales().borrow_mut().set_str("TOOL", Valor::Tabla(tt));
            correr(e, Lado::S, r, &mut corrido);
            let ht = e.globales().borrow().get_str("TOOL");
            e.globales().borrow_mut().set_str("TOOL", Valor::Nil);
            if let Valor::Tabla(ht) = ht {
                for k in ["ClientConVar", "ServerConVar"] {
                    if let Valor::Tabla(cv) = tget(&ht, k) {
                        for (c, v) in cv.borrow().pares() { if let Valor::Cad(c) = c { crate::libs::cvar(&format!("{}_{}", n, c.texto()), Some(if v.es_nil() { String::new() } else { js_str(&v) }), Valor::Nil, Valor::Nil, Valor::Nil); } }
                    }
                }
            }
        });
    }
    for (n, r) in &herramientas {
        en_lado(e, Lado::C, |e| {
            let tt = tool_tabla(e, n);
            e.globales().borrow_mut().set_str("TOOL", Valor::Tabla(tt));
            correr(e, Lado::C, r, &mut corrido);
            e.globales().borrow_mut().set_str("TOOL", Valor::Nil);
        });
    }
    // 4) las bases que se registraron después de sus hijas
    enlazar_todo(e);
    // 5) lo que GMod corre al arrancar, para los hooks nuevos de este addon
    for ev in ["PreGamemodeLoaded", "OnGamemodeLoaded", "PostGamemodeLoaded", "Initialize", "InitPostEntity"] { hooks_nuevos(e, &antes, ev, &[]); }
    let jug = g(|g| g.jug.clone());
    hooks_nuevos(e, &antes, "PlayerInitialSpawn", &[jug.clone(), Valor::Bool(false)]);
    hooks_nuevos(e, &antes, "PlayerSpawn", &[jug.clone(), Valor::Bool(false)]);
    hooks_nuevos(e, &antes, "PlayerLoadout", &[jug]);
    g(|g| g.addon_actual = None);
    // lo que va al menú: las entidades y armas que se pueden poner
    let (mut sents, mut sweps) = g(|g| {
        let sp = |c: &ClaseReg, arma: bool| {
            let Some(tt) = c.c.clone().or_else(|| c.s.clone()) else { return false };
            let (s, ad) = (tget(&tt, "Spawnable"), tget(&tt, "AdminSpawnable"));
            let ttt = || { let b = tget(&tt, "Base"); let bs = if js_t(&b) { js_str(&b) } else { String::new() }; bs == "weapon_tttbase" || bs == "weapon_tttbasegrenade" || (!tget(&tt, "CanBuy").es_nil() && !tget(&tt, "Kind").es_nil()) };
            t(&s) || (s.es_nil() && t(&ad)) || (arma && s.es_nil() && ttt())
        };
        let se: Vec<String> = g.clases.v.iter().filter(|(_, c)| c.addon.as_deref() == Some(&id) && sp(c, false)).map(|x| x.0.clone()).collect();
        let sw: Vec<String> = g.armas.v.iter().filter(|(_, c)| c.addon.as_deref() == Some(&id) && sp(c, true)).map(|x| x.0.clone()).collect();
        (se, sw)
    });
    sents.sort();
    sweps.sort();
    let mut x = a.borrow_mut();
    x.sents = sents;
    x.sweps = sweps;
    x.lua_corridos = corrido.len();
}
fn hooks_nuevos(e: &mut Estado, antes: &HashMap<String, Vec<(Valor, Option<Valor>, Option<Valor>)>>, ev: &str, args: &[Valor]) {
    let hs: Vec<(Valor, Option<Valor>, Option<Valor>)> = match g(|g| g.hooks.get(ev).map(|h| h.iter().map(|(id, x)| (id.clone(), x.s.clone(), x.c.clone())).collect::<Vec<_>>())) { Some(v) => v, None => return };
    let viejos = antes.get(ev);
    for (id, s, c) in hs {
        for (lado, f) in [(Lado::S, s), (Lado::C, c)] {
            let Some(f) = f else { continue };
            let viejo = viejos.and_then(|v| v.iter().find(|x| x.0.crudo_igual(&id))).and_then(|x| if lado == Lado::S { x.1.clone() } else { x.2.clone() });
            if viejo.map(|v| v.crudo_igual(&f)).unwrap_or(false) { continue; }
            llamar(e, &f, lado, args);
        }
    }
}
fn enlazar_todo(e: &mut Estado) {
    for arma in [true, false] {
        let cs: Vec<(Option<TablaRef>, Option<TablaRef>)> = g(|g| (if arma { &g.armas } else { &g.clases }).values().map(|c| (c.s.clone(), c.c.clone())).collect());
        for (s, c) in cs {
            for (lado, tt) in [(Lado::S, s), (Lado::C, c)] {
                let Some(tt) = tt else { continue };
                if !matches!(tget(&tt, "BaseClass"), Valor::Tabla(_)) { en_lado(e, lado, |e| crate::resto::enlazar_base(e, &tt, arma)); }
            }
        }
    }
}

// ---------------- cada cuadro (gmaPaso) ----------------
fn paso(e: &mut Estado, dt: f64, choques: &[Choque]) {
    g(|g| g.cuadro += 1);
    let tt = h(|h| h.tiempo());
    armas_suelo(e);
    { let j = g(|g| g.jug.clone()); let k = (1.0 - dt * 9.0).max(0.0); ce(&j, |x| if let Some(p) = &mut x.punch { p[0] *= k; p[1] *= k; p[2] *= k; }); }
    // timers (uno por cuadro como mucho cada uno)
    let ts: Vec<(String, Rc<RefCell<Timer>>)> = g(|g| g.timers.clone());
    for (id, tm) in ts {
        let (f, ctx) = {
            let mut x = tm.borrow_mut();
            if x.pausa || tt < x.t { continue; }
            x.t = tt + x.d;
            if x.r > 0.0 { x.r -= 1.0; if x.r == 0.0 { g(|g| g.timers.retain(|y| y.0 != id)); } }
            (x.f.clone(), x.ctx)
        };
        llamar(e, &f, ctx, &[]);
    }
    if g(|g| !g.t_simples.is_empty()) {
        let l = g(|g| std::mem::take(&mut g.t_simples));
        let mut quedan = Vec::new();
        for x in l {
            if tt < x.t { quedan.push(x); continue; }
            match x.f { Accion::Rust(f) => f(e), Accion::Lua(f, args) => { llamar(e, &f, x.ctx, &args); } }
        }
        g(|g| { let nuevos = std::mem::take(&mut g.t_simples); quedan.extend(nuevos); g.t_simples = quedan; });
    }
    // mensajes de red (en una partida sola: del server al cliente y al revés en el mismo cuadro)
    let cola = g(|g| std::mem::take(&mut g.net_cola));
    for m in cola {
        let f = g(|g| if m.lado == Lado::C { g.net_c.get(&m.n).cloned() } else { g.net_s.get(&m.n).cloned() });
        let Some(f) = f else { continue };
        let l0 = g(|g| std::mem::replace(&mut g.lectura, Some((m.v.clone(), 0))));
        let jug = g(|g| g.jug.clone());
        llamar(e, &f, m.lado, &[Valor::Num((m.v.len() * 32) as f64), jug]);
        g(|g| g.lectura = l0);
    }
    // el jugador: aparecer, morir, teclas
    let vivo = h(|h| h.jug().vivo);
    let jug = g(|g| g.jug.clone());
    match g(|g| g.jug_vivo) {
        None => g(|g| g.jug_vivo = Some(vivo)),
        Some(v0) if v0 != vivo => {
            g(|g| g.jug_vivo = Some(vivo));
            if vivo {
                g(|g| g.fov_lua = 0.0);
                if ce(&jug, |x| x.mov.is_some()).unwrap_or(false) { mov_tipo_jug(2.0); }
                hook(e, "PlayerSpawn", S, &[jug.clone(), Valor::Bool(false)]);
                hook(e, "PlayerLoadout", S, &[jug.clone()]);
            } else if g(|g| std::mem::replace(&mut g.muerte_muda, false)) { hook(e, "PlayerSilentDeath", S, &[jug.clone()]); }
            else {
                let mundo = g(|g| g.mundo.clone());
                let d = dmg_info(100.0, None, None, None);
                hook(e, "DoPlayerDeath", S, &[jug.clone(), mundo.clone(), d]);
                hook(e, "PlayerDeath", S, &[jug.clone(), mundo.clone(), mundo]);
            }
        }
        _ => {}
    }
    let k = if h(|h| h.entrada().ui_abierto) { 0 } else { teclas() };
    let k0 = g(|g| g.teclas_ant);
    g(|g| g.tec_ant = k0);
    if k != k0 {
        let mut bb: u32 = 1;
        while bb <= 16777216 {
            if (k & bb) != 0 && (k0 & bb) == 0 { hook(e, "KeyPress", SC, &[jug.clone(), Valor::Num(bb as f64)]); }
            else if (k & bb) == 0 && (k0 & bb) != 0 { hook(e, "KeyRelease", SC, &[jug.clone(), Valor::Num(bb as f64)]); }
            bb *= 2;
        }
        g(|g| g.teclas_ant = k);
    }
    if ["StartCommand", "SetupMove", "Move", "FinishMove"].iter().any(|x| hay_hook(x)) { movimiento_lua(e, k, k0); }
    {
        let bs = botones();
        let b0 = g(|g| g.bot_ant.clone()).unwrap_or_default();
        let mut nuevos = Vec::new();
        for n in &bs { if !b0.contains(n) { nuevos.push(*n); hook(e, "PlayerButtonDown", SC, &[jug.clone(), Valor::Num(*n as f64)]); } }
        for n in &b0 { if !bs.contains(n) { hook(e, "PlayerButtonUp", SC, &[jug.clone(), Valor::Num(*n as f64)]); } }
        g(|g| { g.bot_nuevos = nuevos; g.bot_ant = Some(bs); });
    }
    // hooks de todos los cuadros
    hook(e, "Tick", SC, &[]);
    hook(e, "Think", SC, &[]);
    hook(e, "PlayerTick", S, &[jug.clone(), Valor::Nil]);
    hook(e, "PlayerPostThink", S, &[jug.clone()]);
    swep_paso(e);
    // choques fuertes → PhysicsCollide
    for c in choques.iter().take(64) {
        for (a, b) in [(Some(c.a), c.b), (c.b, Some(c.a))] {
            let Some(a) = a else { continue };
            let Some(ent) = g(|g| g.ent_por_obj.get(&a).cloned()) else { continue };
            let (vivo, clase, ult, nace) = ce(&ent, |x| (x.vivo, x.clase.clone(), x.ult_choque, x.nace)).unwrap();
            if !vivo || clase_tabla(&clase, Lado::S).is_none() { continue; }
            let otra = match b { Some(b) => ent_de_obj(b), None => g(|g| g.mundo.clone()) };
            let dtc = (tt - ult.or(nace).unwrap_or(-1e3)).min(1e3);
            ce(&ent, |x| x.ult_choque = Some(tt));
            let va = cuerpo(a, |x| (x.vel, x.pos)).unwrap_or_default();
            let vb = b.and_then(|b| cuerpo(b, |x| (x.vel, x.pos)));
            let d = Tabla::nueva_ref();
            {
                let mut x = d.borrow_mut();
                x.set_str("HitPos", vv(c.pos)); x.set_str("HitEntity", otra.clone()); x.set_str("Speed", Valor::Num(c.vel / GS));
                for k in ["HitSpeed", "OurOldVelocity", "OurNewVelocity"] { x.set_str(k, vvd(va.0.scale(1.0 / GS))); }
                for k in ["TheirOldVelocity", "TheirNewVelocity"] { x.set_str(k, vvd(vb.map(|v| v.0.scale(1.0 / GS)).unwrap_or_default())); }
                x.set_str("HitNormal", vvd(vb.map(|v| v.1.sub(va.1).norm()).unwrap_or(v3(0.0, -1.0, 0.0))));
                x.set_str("DeltaTime", Valor::Num(dtc));
                x.set_str("PhysObject", crate::entidades::fis_de(&ent));
                let hit_o = if ent_tipo(&otra) == Some(TipoEnt::Ent) { crate::entidades::fis_de(&otra) } else { crate::entidades::fis_de(&g(|g| g.mundo.clone())) };
                x.set_str("HitObject", hit_o);
                x.set_str("OurOldAngularVelocity", nv(0.0, 0.0, 0.0));
                x.set_str("TheirOldAngularVelocity", nv(0.0, 0.0, 0.0));
            }
            let fo = crate::entidades::fis_de(&ent);
            metodo(e, &ent, "PhysicsCollide", Lado::S, &[Valor::Tabla(d), fo]);
        }
    }
    // entidades de los addons: las que el juego borró, Think del server (5 por segundo o NextThink) y del cliente
    for x in g(|g| g.ents_vivas()) {
        let Some((vivo, creado, tipo, o, clase, solo_c, prox_s)) = ce(&x, |y| (y.vivo, y.creado, y.tipo, y.o, y.clase.clone(), y.solo_c, y.prox_s)) else { continue };
        if !vivo || !creado || tipo != TipoEnt::Ent { continue; }
        if let Some(o) = o { if cuerpo(o, |_| ()).is_none() { quitar(e, &x); continue; } }
        let Some((cs, cc)) = g(|g| g.clases.get(&clase).map(|c| (c.s.clone(), c.c.clone()))) else { continue };
        if !solo_c && tt >= prox_s {
            ce(&x, |y| y.prox = None);
            let r = metodo(e, &x, "Think", Lado::S, &[]);
            let p = ce(&x, |y| y.prox).flatten();
            let nuevo = if matches!(r.first(), Some(Valor::Bool(true))) { p.unwrap_or(tt) } else { tt + 0.2 };
            ce(&x, |y| y.prox_s = nuevo);
        }
        let sep = match (&cc, &cs) { (Some(c1), Some(s1)) => !Rc::ptr_eq(c1, s1), (Some(_), None) => true, _ => false };
        if solo_c || sep { metodo(e, &x, "Think", Lado::C, &[]); }
    }
    hijos_paso(e);
    // partículas de ParticleEmitter
    let q = g(|g| std::mem::take(&mut g.part_cola));
    let ini = q.len().saturating_sub(200);
    for p in &q[ini..] {
        let Valor::Udata(u) = p else { continue };
        let Some((pos, v, vida, t0, t1, a0, c, mat)) = u.con(|x: &crate::libs::Part| (x.p, x.v, x.vida, x.t0, x.t1, x.a0, x.c, x.mat.clone())) else { continue };
        let tipo = if ["smoke", "dust", "fire", "flame"].iter().any(|k| mat.contains(k)) { "humo" } else { "chispa" };
        let vida = jmax(0.05, jmin(8.0, if vida == 0.0 || vida.is_nan() { 1.0 } else { vida }));
        let tam = jmax(0.01, t0 * GS / 2.0);
        let crece = jmax(-1.0, jmin(10.0, t1 / jmax(0.01, t0) - 1.0));
        h(|h| h.particula(pos, v, vida, tam, [c[0] / 255.0, c[1] / 255.0, c[2] / 255.0, jmax(0.0, jmin(1.0, a0 / 255.0))], tipo, Some(crece)));
    }
}

/// el CMoveData del cuadro y StartCommand, SetupMove, Move y FinishMove (gmaMovimientoLua)
pub(crate) struct Mv { pub b: u32, pub b0: u32, pub vel: Option<[f64; 3]>, pub org: Option<[f64; 3]>, pub ang: Option<Valor>, pub ang_m: Option<Valor>, pub max: Option<f64>, pub fwd: Option<f64>, pub side: Option<f64>, pub up: Option<f64> }
fn mt_mov(e: &mut Estado) -> TablaRef {
    if let Some(m) = g(|g| g.mt.mov.clone()) { return m; }
    let m = Tabla::nueva_ref();
    m.borrow_mut().set_str("__index", Valor::Tabla(m.clone()));
    m.borrow_mut().set_str("MetaName", cad("CMoveData"));
    fn mv<X>(v: &Valor, f: impl FnOnce(&mut Mv) -> X) -> Option<X> { match v { Valor::Udata(u) => u.con_mut(f), _ => None } }
    let gl = e.globales();
    let ang = move |e: &mut Estado| -> Result<Valor, jxlua::Error> { let f = gl.borrow().get_str("EyeAngles"); if let Valor::Func(_) = f { Ok(primero(&e.llamar_aqui(&f, &[])?)) } else { Ok(Valor::Nil) } };
    let vmax = |m: &Mv| m.max.unwrap_or_else(|| if h(|h| h.entrada().correr) { g(|g| g.run).filter(|x| *x != 0.0).unwrap_or(400.0) } else { g(|g| g.walk).filter(|x| *x != 0.0).unwrap_or(200.0) });
    let u = |v: &Valor| i32_de(mas(v)) as u32;
    def(&m, "GetButtons", |_, a, o| { o.push(Valor::Num(mv(&ar(a, 0), |m| m.b).unwrap_or(0) as f64)); Ok(()) });
    def(&m, "GetOldButtons", |_, a, o| { o.push(Valor::Num(mv(&ar(a, 0), |m| m.b0).unwrap_or(0) as f64)); Ok(()) });
    def(&m, "SetButtons", move |_, a, _| { let x = u(&ar(a, 1)); mv(&ar(a, 0), |m| m.b = x); Ok(()) });
    def(&m, "SetOldButtons", move |_, a, _| { let x = u(&ar(a, 1)); mv(&ar(a, 0), |m| m.b0 = x); Ok(()) });
    def(&m, "KeyDown", move |_, a, o| { let x = u(&ar(a, 1)); o.push(Valor::Bool(mv(&ar(a, 0), |m| m.b & x != 0).unwrap_or(false))); Ok(()) });
    def(&m, "KeyPressed", move |_, a, o| { let x = u(&ar(a, 1)); o.push(Valor::Bool(mv(&ar(a, 0), |m| m.b & x != 0 && m.b0 & x == 0).unwrap_or(false))); Ok(()) });
    def(&m, "KeyReleased", move |_, a, o| { let x = u(&ar(a, 1)); o.push(Valor::Bool(mv(&ar(a, 0), |m| m.b & x == 0 && m.b0 & x != 0).unwrap_or(false))); Ok(()) });
    def(&m, "KeyWasDown", move |_, a, o| { let x = u(&ar(a, 1)); o.push(Valor::Bool(mv(&ar(a, 0), |m| m.b0 & x != 0).unwrap_or(false))); Ok(()) });
    for k in ["GetVelocity", "GetFinalIdealVelocity"] { def(&m, k, |_, a, o| { let v = mv(&ar(a, 0), |m| m.vel).flatten(); o.push(match v { Some(v) => nva(v), None => vvr(h(|h| h.jug().vel)) }); Ok(()) }); }
    def(&m, "SetVelocity", |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { if (v[0] + v[1] + v[2]).is_finite() { mv(&ar(a, 0), |m| m.vel = Some(v)); } } Ok(()) });
    def(&m, "GetOrigin", |_, a, o| { let v = mv(&ar(a, 0), |m| m.org).flatten(); o.push(match v { Some(v) => nva(v), None => { let j = g(|g| g.jug.clone()); vv(ent_pos(&j)) } }); Ok(()) });
    def(&m, "SetOrigin", |_, a, _| { if let Some(v) = vec_de(&ar(a, 1)) { if (v[0] + v[1] + v[2]).is_finite() { mv(&ar(a, 0), |m| m.org = Some(v)); } } Ok(()) });
    let ang2 = Rc::new(ang);
    for (k, cual) in [("GetAngles", 0), ("GetMoveAngles", 1), ("GetAbsMoveAngles", 1)] {
        let ang3 = ang2.clone();
        def(&m, k, move |e, a, o| { let v = mv(&ar(a, 0), |m| if cual == 0 { m.ang.clone() } else { m.ang_m.clone() }).flatten(); o.push(match v.and_then(|v| ang_de(&v)) { Some(x) => naa(x), None => ang3(e)? }); Ok(()) });
    }
    def(&m, "SetAngles", |_, a, _| { let x = ar(a, 1); if ang_de(&x).is_some() { mv(&ar(a, 0), |m| m.ang = Some(x)); } Ok(()) });
    def(&m, "SetMoveAngles", |_, a, _| { let x = ar(a, 1); if ang_de(&x).is_some() { mv(&ar(a, 0), |m| m.ang_m = Some(x)); } Ok(()) });
    for k in ["GetMaxSpeed", "GetMaxClientSpeed"] { def(&m, k, move |_, a, o| { o.push(Valor::Num(mv(&ar(a, 0), |m| vmax(m)).unwrap_or(200.0))); Ok(()) }); }
    for k in ["SetMaxSpeed", "SetMaxClientSpeed"] { def(&m, k, |_, a, _| { let x = mas(&ar(a, 1)); let x = if x.is_nan() { 0.0 } else { x }; mv(&ar(a, 0), |m| m.max = Some(x)); Ok(()) }); }
    def(&m, "GetForwardSpeed", move |_, a, o| { let y = h(|h| h.entrada().y); o.push(Valor::Num(mv(&ar(a, 0), |m| m.fwd.unwrap_or_else(|| y * vmax(m))).unwrap_or(0.0))); Ok(()) });
    def(&m, "GetSideSpeed", move |_, a, o| { let x = h(|h| h.entrada().x); o.push(Valor::Num(mv(&ar(a, 0), |m| m.side.unwrap_or_else(|| x * vmax(m))).unwrap_or(0.0))); Ok(()) });
    def(&m, "GetUpSpeed", |_, a, o| { o.push(Valor::Num(mv(&ar(a, 0), |m| m.up.unwrap_or(0.0)).unwrap_or(0.0))); Ok(()) });
    let z = |v: &Valor| { let x = mas(v); if x.is_nan() { 0.0 } else { x } };
    def(&m, "SetForwardSpeed", move |_, a, _| { let x = z(&ar(a, 1)); mv(&ar(a, 0), |m| m.fwd = Some(x)); Ok(()) });
    def(&m, "SetSideSpeed", move |_, a, _| { let x = z(&ar(a, 1)); mv(&ar(a, 0), |m| m.side = Some(x)); Ok(()) });
    def(&m, "SetUpSpeed", move |_, a, _| { let x = z(&ar(a, 1)); mv(&ar(a, 0), |m| m.up = Some(x)); Ok(()) });
    for k in ["GetImpulseCommand", "GetConstraintRadius"] { def(&m, k, |_, _, o| { o.push(Valor::Num(0.0)); Ok(()) }); }
    def(&m, "GetFinalJumpVelocity", |_, _, o| { o.push(nv(0.0, 0.0, 0.0)); Ok(()) });
    def(&m, "GetFinalStepHeight", |_, _, o| { o.push(Valor::Num(18.0)); Ok(()) });
    for k in ["SetImpulseCommand", "SetConstraintRadius", "SetFinalIdealVelocity", "SetFinalJumpVelocity", "SetFinalStepHeight"] { def(&m, k, nada); }
    def(&m, "AddKey", move |_, a, _| { let x = u(&ar(a, 1)); mv(&ar(a, 0), |m| m.b |= x); Ok(()) });
    def(&m, "RemoveKey", move |_, a, _| { let x = u(&ar(a, 1)); mv(&ar(a, 0), |m| m.b &= !x); Ok(()) });
    g(|g| g.mt.mov = Some(m.clone()));
    m
}
fn movimiento_lua(e: &mut Estado, k: u32, k0: u32) {
    let mt = mt_mov(e);
    let mv = Valor::Udata(Udata::nueva(Mv { b: k, b0: k0, vel: None, org: None, ang: None, ang_m: None, max: None, fwd: None, side: None, up: None }, Some(mt)));
    let jug = g(|g| g.jug.clone());
    let gc = g(|g| g.mt.ply_m.clone()).map(|p| tget(&p, "GetCurrentCommand")).unwrap_or(Valor::Nil);
    let cmd = if let Valor::Func(_) = gc { primero(&llamar(e, &gc, Lado::S, &[jug.clone()])) } else { Valor::Nil };
    hook(e, "StartCommand", SC, &[jug.clone(), cmd.clone()]);
    hook(e, "SetupMove", SC, &[jug.clone(), mv.clone(), cmd]);
    let rm = hook(e, "Move", SC, &[jug.clone(), mv.clone()]);
    hook(e, "FinishMove", SC, &[jug.clone(), mv.clone()]);
    let (vivo, veh) = h(|h| (h.jug().vivo, h.jug().vehiculo.is_some()));
    if !vivo || veh { return; }
    let (org, vel) = match &mv { Valor::Udata(u) => u.con(|m: &Mv| (m.org, m.vel)).unwrap(), _ => return };
    let tt = h(|h| h.tiempo());
    g(|g| g.mov_lua = if t(&primero(&rm)) && (org.is_some() || vel.is_some()) { tt } else { 0.0 });
    if let Some(o) = org {
        let p = a_juego(o);
        if p.sub(ent_pos(&jug)).len() > 1e-3 { h(|h| { let j = h.jug(); j.pos = v3(p.x, p.y + j.medio, p.z); if vel.is_none() { j.suelo = false; } }); g(|g| g.mov_n += 1); }
    }
    if let Some(v) = vel { let v = vgr(v); if v.sub(h(|h| h.jug().vel)).len() > 0.05 { g(|g| g.mov_n += 1); } vel_jugador(v, true); }
}

// ---------------- la HUD (gmaHUDPaso) ----------------
fn hud(e: &mut Estado) {
    if !g(|g| g.activo) { return; }
    let w = g(|g| g.swep.clone());
    let hay_arma = w.as_ref().map(|w| ce(w, |x| (x.vivo, x.clase.clone())).map(|(v, c)| v && clase_tabla(&c, Lado::C).is_some()).unwrap_or(false)).unwrap_or(false);
    let hay = |ev: &str| g(|g| g.hooks.get(ev).map(|hs| hs.iter().any(|x| x.1.c.is_some())).unwrap_or(false));
    let hay_ef = hay("RenderScreenspaceEffects");
    let hay_hooks = hay_ef || hay("HUDPaint") || hay("HUDPaintBackground") || hay("PostDrawHUD") || hay("DrawOverlay");
    g(|g| g.pp = None);
    if !hay_hooks && !hay_arma && !g(|g| g.hud_sucio) { return; }
    g(|g| g.hud_sucio = false);
    if !hay_hooks && !hay_arma { return; }
    g(|g| { g.dibujo_hud = true; g.hud_sucio = true; g.hud_n = 0; });
    if hay_ef { hook(e, "RenderScreenspaceEffects", C, &[]); }
    if hay_hooks {
        hook(e, "HUDPaintBackground", C, &[]);
        g(|g| g.en_hud_paint = true);
        hook(e, "HUDPaint", C, &[]);
        g(|g| g.en_hud_paint = false);
        hook(e, "PostDrawHUD", C, &[]);
    }
    if hay_arma && h(|h| h.jug().vivo) { if let Some(w) = &w { metodo(e, w, "DrawHUD", Lado::C, &[]); } }
    if hay_hooks { hook(e, "DrawOverlay", C, &[]); }
    g(|g| g.dibujo_hud = false);
}

// ---------------- el menú (gmaSpawnMenu) ----------------
fn spawn_menu(e: &mut Estado, it: &str) -> bool {
    let (arma, n) = if let Some(n) = it.strip_prefix("gmswep:") { (true, n) } else if let Some(n) = it.strip_prefix("gment:") { (false, n) } else { return false };
    let tt = g(|g| (if arma { &g.armas } else { &g.clases }).get(n).and_then(|c| c.c.clone().or_else(|| c.s.clone())));
    let Some(tt) = tt else { return false };
    let jug = g(|g| g.jug.clone());
    if arma {
        let r = hook(e, "PlayerGiveSWEP", S, &[jug.clone(), cad(n), Valor::Tabla(tt)]);
        if matches!(r.first(), Some(Valor::Bool(false))) { return false; }
        let w = dar_arma(e, n, false);
        hook(e, "PlayerSpawnedSWEP", S, &[jug, w]);
        return true;
    }
    let r0 = hook(e, "PlayerSpawnSENT", S, &[jug.clone(), cad(n)]);
    if matches!(r0.first(), Some(Valor::Bool(false))) { return false; }
    let cam = h(|h| h.cam().clone());
    let tr = traza(cam.pos, cam.fwd, 4096.0 * GS, &[], None);
    if let Valor::Tabla(trt) = &tr {
        if !t(&tget(trt, "Hit")) {
            let j = h(|h| h.jug().clone());
            let f = v3(cam.fwd.x, 0.0, cam.fwd.z).norm();
            let medio = if j.medio == 0.0 { 0.9 } else { j.medio };
            let p = v3(j.pos.x, j.pos.y - medio, j.pos.z).add(f.scale(4.0));
            let mut x = trt.borrow_mut();
            x.set_str("Hit", Valor::Bool(true)); x.set_str("HitWorld", Valor::Bool(true)); x.set_str("HitPos", vv(p)); x.set_str("HitNormal", nv(0.0, 0.0, 1.0)); x.set_str("Fraction", Valor::Num(0.01)); x.set_str("Entity", g(|g| g.mundo.clone()));
        }
    }
    let s = clase_tabla(n, Lado::S);
    let sf = s.as_ref().map(|s| buscar_en_clase(s, "SpawnFunction")).unwrap_or(Valor::Nil);
    let mut ent = Valor::Nil;
    if let (Valor::Func(_), Some(s)) = (&sf, &s) {
        let gl = e.globales();
        let c0 = gl.borrow().get_str("ClassName");
        gl.borrow_mut().set_str("ClassName", cad(n));
        ent = primero(&llamar(e, &sf, Lado::S, &[Valor::Tabla(s.clone()), jug.clone(), tr, cad(n)]));
        gl.borrow_mut().set_str("ClassName", c0);
    }
    if !es_ent(&ent) { return false; }
    let m = ce(&ent, |x| { x.creador = Some(jug.clone()); x.modelo.clone() }).unwrap_or_default();
    if !m.is_empty() && g(|g| g.modelos_faltan.contains(&m.to_lowercase())) { h(|h| h.modelo_falta(&m)); }
    hook(e, "PlayerSpawnedSENT", S, &[jug, ent]);
    true
}
