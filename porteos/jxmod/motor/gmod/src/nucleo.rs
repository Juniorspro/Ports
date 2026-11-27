//! El estado de la capa GMod (el objeto GMA de la web) y lo que usan todas las partes: llamar al Lua con su lado
//! (server/cliente), las clases de entidades y armas, los errores, los valores de Lua de Source (Vector, Angle,
//! entidades) y los ayudantes para definir funciones nativas.

use crate::anfitrion::{Anfitrion, ObjId, PersonaId};
use crate::mates::*;
use jxlua::{Error, Estado, Tabla, TablaRef, Udata, Valor};
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::rc::{Rc, Weak};

pub(crate) type Res = Result<(), Error>;

// ---------------- el estado compartido (uno por hilo: el Gmod que está activo) ----------------
pub(crate) struct Ctx {
    pub g: RefCell<Gma>,
    pub h: RefCell<Box<dyn Anfitrion>>,
}

thread_local! {
    static CTX: RefCell<Option<Rc<Ctx>>> = const { RefCell::new(None) };
}

pub(crate) fn poner_ctx(c: Option<Rc<Ctx>>) { CTX.with(|x| *x.borrow_mut() = c); }
pub(crate) fn cx() -> Rc<Ctx> { CTX.with(|x| x.borrow().clone().expect("jxgmod: no hay un Gmod activo en este hilo")) }
/// el estado (sin llamar al Lua mientras se tiene)
pub(crate) fn g<R>(f: impl FnOnce(&mut Gma) -> R) -> R { let c = cx(); let mut b = c.g.borrow_mut(); f(&mut b) }
/// el juego (sin llamar al Lua mientras se tiene)
pub(crate) fn h<R>(f: impl FnOnce(&mut dyn Anfitrion) -> R) -> R { let c = cx(); let mut b = c.h.borrow_mut(); f(&mut **b) }

/// un lado del Lua: el server o el cliente
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Lado {
    S,
    C,
}
impl Lado {
    pub fn letra(self) -> char { if self == Lado::S { 'S' } else { 'C' } }
}

pub(crate) struct Hook {
    pub s: Option<Valor>,
    pub c: Option<Valor>,
    pub a: Option<String>,
    pub ns: u32,
    pub nc: u32,
}

pub(crate) struct Timer {
    pub d: f64,
    pub r: f64,
    pub f: Valor,
    pub t: f64,
    pub ctx: Lado,
    pub pausa: bool,
    pub resta: Option<f64>,
}

pub(crate) enum Accion {
    Lua(Valor, Vec<Valor>),
    Rust(Box<dyn FnOnce(&mut Estado)>),
}
pub(crate) struct TSimple {
    pub t: f64,
    pub f: Accion,
    pub ctx: Lado,
}

pub(crate) struct Cvar {
    pub n: String,
    pub v: String,
    pub d: String,
    pub h: Valor,
    pub mn: Option<f64>,
    pub mx: Option<f64>,
    pub cbs: Vec<(Valor, Lado)>,
}

#[derive(Default)]
pub(crate) struct ClaseReg {
    pub s: Option<TablaRef>,
    pub c: Option<TablaRef>,
    pub addon: Option<String>,
}

pub(crate) struct NetMsg {
    pub n: String,
    pub v: Vec<Valor>,
    pub lado: Lado,
}

/// las manos de un modelo de jugador (AddValidHands: { model, skin, body, matchBodySkin })
#[derive(Clone, Debug, PartialEq)]
pub struct ManosPm { pub model: String, pub skin: f64, pub body: String, pub match_body_skin: bool }
/// un addon montado
#[derive(Default)]
pub struct Addon {
    pub id: String,
    pub nombre: String,
    /// los archivos (ruta en minúsculas con /)
    pub archivos: HashMap<String, Rc<[u8]>>,
    pub lua: Vec<String>,
    pub sweps: Vec<String>,
    pub sents: Vec<String>,
    pub efectos: Vec<String>,
    pub errores: Vec<String>,
    pub lua_corridos: usize,
    /// la clase del arma de un efecto siempre activo (gmaEfectoObjeto), ya calculada
    pub ef_obj: Option<Option<String>>,
}

/// un mapa con orden de inserción (como Map de JavaScript: poner una clave que ya está no la mueve)
#[derive(Clone)]
pub(crate) struct Orden<K, V> {
    pub v: Vec<(K, V)>,
}
impl<K: PartialEq, V> Default for Orden<K, V> {
    fn default() -> Self { Orden { v: Vec::new() } }
}
impl<K: PartialEq, V> Orden<K, V> {
    pub fn get(&self, k: &K) -> Option<&V> { self.v.iter().find(|x| &x.0 == k).map(|x| &x.1) }
    pub fn set(&mut self, k: K, val: V) { if let Some(x) = self.v.iter_mut().find(|x| x.0 == k) { x.1 = val; } else { self.v.push((k, val)); } }
    pub fn has(&self, k: &K) -> bool { self.v.iter().any(|x| &x.0 == k) }
    pub fn delete(&mut self, k: &K) -> Option<V> { let i = self.v.iter().position(|x| &x.0 == k)?; Some(self.v.remove(i).1) }
    pub fn len(&self) -> usize { self.v.len() }
}

/// un mapa con claves de Lua y orden de inserción (Map de JavaScript; las claves se comparan como rawequal)
#[derive(Clone, Default)]
pub(crate) struct OrdenV {
    pub v: Vec<(Valor, Valor)>,
}
impl OrdenV {
    pub fn get(&self, k: &Valor) -> Option<&Valor> { self.v.iter().find(|x| x.0.crudo_igual(k)).map(|x| &x.1) }
    pub fn set(&mut self, k: Valor, val: Valor) { if let Some(x) = self.v.iter_mut().find(|x| x.0.crudo_igual(&k)) { x.1 = val; } else { self.v.push((k, val)); } }
    pub fn has(&self, k: &Valor) -> bool { self.v.iter().any(|x| x.0.crudo_igual(k)) }
}

/// un mapa con claves de texto y orden de inserción, con índice (las clases, los hooks)
pub(crate) struct OrdenS<V> {
    pub v: Vec<(String, V)>,
    pub idx: HashMap<String, usize>,
}
impl<V> Default for OrdenS<V> {
    fn default() -> Self { OrdenS { v: Vec::new(), idx: HashMap::new() } }
}
#[allow(dead_code)]
impl<V> OrdenS<V> {
    pub fn get(&self, k: &str) -> Option<&V> { self.idx.get(k).map(|&i| &self.v[i].1) }
    pub fn get_mut(&mut self, k: &str) -> Option<&mut V> { match self.idx.get(k) { Some(&i) => Some(&mut self.v[i].1), None => None } }
    pub fn set(&mut self, k: &str, val: V) { if let Some(&i) = self.idx.get(k) { self.v[i].1 = val; } else { self.idx.insert(k.to_string(), self.v.len()); self.v.push((k.to_string(), val)); } }
    pub fn has(&self, k: &str) -> bool { self.idx.contains_key(k) }
    pub fn delete(&mut self, k: &str) -> Option<V> {
        let i = self.idx.remove(k)?;
        let r = self.v.remove(i).1;
        for x in self.idx.values_mut() { if *x > i { *x -= 1; } }
        Some(r)
    }
    pub fn len(&self) -> usize { self.v.len() }
    pub fn values(&self) -> impl Iterator<Item = &V> { self.v.iter().map(|x| &x.1) }
}

/// el estado de la capa (GMA)
pub(crate) struct Gma {
    pub ctx: Lado,
    pub oy: f64,
    pub hooks: OrdenS<Vec<(Valor, Hook)>>,
    pub timers: Vec<(String, Rc<RefCell<Timer>>)>,
    pub t_simples: Vec<TSimple>,
    pub net_s: HashMap<String, Valor>,
    pub net_c: HashMap<String, Valor>,
    pub net_cola: Vec<NetMsg>,
    /// las entidades por número, en el orden en que se crearon
    pub ents: Vec<Option<(i64, Valor)>>,
    pub ents_idx: HashMap<i64, usize>,
    pub nid: i64,
    pub clases: OrdenS<ClaseReg>,
    pub armas: OrdenS<ClaseReg>,
    pub efectos: OrdenS<TablaRef>,
    pub cvars: HashMap<String, Rc<RefCell<Cvar>>>,
    pub cmds: HashMap<String, (Valor, Lado)>,
    pub fuentes: HashMap<String, String>,
    pub err_cuenta: HashMap<String, u32>,
    pub ult_err: bool,
    pub jug: Valor,
    pub mundo: Valor,
    pub null: Valor,
    pub swep: Option<Valor>,
    pub armas_jug: Orden<String, Valor>,
    pub armas_juego: HashMap<String, Valor>,
    pub ent_por_obj: HashMap<ObjId, Valor>,
    pub hijos: Vec<Valor>,
    pub hijos_orden: Option<Vec<Valor>>,
    pub mt: Metas,
    pub metas: Orden<String, TablaRef>,
    pub faltan: HashMap<String, u32>,
    pub ov_s: Option<TablaRef>,
    pub ov_c: Option<TablaRef>,
    pub cuadro: u64,
    pub iniciando: Option<Valor>,
    pub ini_c: Option<Valor>,
    pub cargando_clase: Option<&'static str>,
    pub addons: Vec<Rc<RefCell<Addon>>>,
    pub addon_actual: Option<Rc<RefCell<Addon>>>,
    pub hook_addon: Option<String>,
    pub hook_ev: Option<String>,
    /// todos los archivos de los addons montados (GMOD.arch)
    pub arch: HashMap<String, Rc<[u8]>>,
    pub rutas_corridas: HashMap<String, String>,
    pub dir: String,
    pub requeridos: HashMap<String, Valor>,
    pub bases: Orden<String, TablaRef>,
    pub ph_bases: Vec<TablaRef>,
    pub guiones: HashMap<String, (Vec<String>, Valor, Valor)>,
    pub mats: HashMap<String, Valor>,
    pub glob: OrdenV,
    pub globales: HashMap<String, f64>,
    pub tec_ant: u32,
    pub teclas_ant: u32,
    pub bot_ant: Option<Vec<u32>>,
    pub bot_nuevos: Vec<u32>,
    pub jug_vivo: Option<bool>,
    pub armor: f64,
    pub lag_mov: Option<f64>,
    pub walk: Option<f64>,
    pub run: Option<f64>,
    pub jump: Option<f64>,
    pub escalon: Option<f64>,
    pub agachado: Option<f64>,
    pub fov_lua: f64,
    pub fov_arma: Option<Valor>,
    pub n_bala: u64,
    pub balas_prof: u32,
    pub danando: bool,
    pub prof_base: u32,
    pub pedir_recarga: bool,
    pub vm_ent: Option<Valor>,
    pub manos_ent: Option<Valor>,
    pub apar: Option<Vec<Valor>>,
    pub part_cola: Vec<Valor>,
    pub umsg_h: HashMap<String, Valor>,
    pub pts: Vec<Valor>,
    pub dls: Orden<String, TablaRef>,
    pub pp: Option<[f64; 9]>,
    pub dib: Dib,
    pub dibujo_hud: bool,
    pub en_hud_paint: bool,
    pub hud_n: u32,
    pub mov_lua: f64,
    pub activo: bool,
    pub cb_n: u64,
    pub snd_n: u32,
    pub saliente: Option<NetMsg>,
    pub lectura: Option<(Vec<Valor>, usize)>,
    pub um: Option<(String, Vec<Valor>)>,
    pub ancho_cache: HashMap<String, f64>,
    pub cargado_prelude: bool,
    /// las metatablas de herencia de subtablas (SWEP.Primary de la base)
    pub herencias: Vec<std::rc::Weak<RefCell<Tabla>>>,
    /// cuándo se pidió cada DynamicLight (por la dirección de su tabla)
    pub luz_pedida: HashMap<usize, f64>,
    /// el prefab de cada objeto que creó la capa
    pub obj_prefab: HashMap<ObjId, String>,
    pub muerte_muda: bool,
    pub hud_sucio: bool,
    pub mov_n: u64,
    pub modelos_faltan: std::collections::HashSet<String>,
    pub fantasmas: HashMap<String, Option<(Valor, String)>>,
    /// las funciones de dos lados de las metatablas compartidas (server, cliente), por la dirección de la función
    pub dos_lados: HashMap<usize, Rc<RefCell<(Valor, Valor)>>>,
    /// de qué addon es cada entrada de las listas de GMod (list.Set mientras corre su Lua: A.listas de la web)
    pub listas_addon: HashMap<(String, String), String>,
    /// los modelos de jugador y sus manos (player_manager.AddValidModel / AddValidHands: GMA.pmodels, GMA.pmanos), por orden
    pub pmodels: Vec<(String, String)>, pub pmanos: Vec<(String, ManosPm)>, pub pm_v: u32,
    /// el modelo que tiene puesto el jugador (lo pone el juego: Player:GetModel, sus manos)
    pub modelo_jug: String,
    /// las herramientas de la Tool Gun de los addons (sus modos, en el orden en que se montaron)
    pub tools_addon: Vec<String>,
    /// el modo de juego puesto (gamemodes/: gmod_modos.js)
    pub modo: Option<crate::modos::ModoActivo>,
}

/// las metatablas de los valores de Source
#[derive(Default)]
pub(crate) struct Metas {
    pub vec: Option<TablaRef>,
    pub vec_i: Option<TablaRef>,
    pub ang: Option<TablaRef>,
    pub ang_i: Option<TablaRef>,
    pub col: Option<TablaRef>,
    pub ent: Option<TablaRef>,
    pub ent_m: Option<TablaRef>,
    pub ply_m: Option<TablaRef>,
    pub wep_m: Option<TablaRef>,
    pub npc_m: Option<TablaRef>,
    pub phy_m: Option<TablaRef>,
    pub phy: Option<TablaRef>,
    pub dmg: Option<TablaRef>,
    pub efecto: Option<TablaRef>,
    pub cvar: Option<TablaRef>,
    pub mat: Option<TablaRef>,
    pub snd: Option<TablaRef>,
    pub emisor: Option<TablaRef>,
    pub part: Option<TablaRef>,
    pub vacio: Option<TablaRef>,
    pub matriz: Option<TablaRef>,
    pub um: Option<TablaRef>,
    pub arch: Option<TablaRef>,
    pub pt: Option<TablaRef>,
    pub mov: Option<TablaRef>,
}

/// lo que se está por dibujar en la HUD (GMA.dib)
#[derive(Clone)]
pub(crate) struct Dib {
    pub col: [f64; 4],
    pub tcol: [f64; 4],
    pub mat: Valor,
    pub fuente: String,
    pub tx: f64,
    pub ty: f64,
    pub alfa: Option<f64>,
}

impl Gma {
    pub fn nuevo() -> Gma {
        Gma {
            ctx: Lado::S, oy: 0.0, hooks: OrdenS::default(), timers: Vec::new(), t_simples: Vec::new(), net_s: HashMap::new(), net_c: HashMap::new(), net_cola: Vec::new(),
            ents: Vec::new(), ents_idx: HashMap::new(), nid: 1000, clases: OrdenS::default(), armas: OrdenS::default(), efectos: OrdenS::default(), cvars: HashMap::new(),
            cmds: HashMap::new(), fuentes: HashMap::new(), err_cuenta: HashMap::new(), ult_err: false, jug: Valor::Nil, mundo: Valor::Nil, null: Valor::Nil, swep: None,
            armas_jug: Orden::default(), armas_juego: HashMap::new(), ent_por_obj: HashMap::new(), hijos: Vec::new(), hijos_orden: None,
            mt: Metas::default(), metas: Orden::default(), faltan: HashMap::new(), ov_s: None, ov_c: None, modo: None, cuadro: 0, iniciando: None, ini_c: None, cargando_clase: None,
            addons: Vec::new(), addon_actual: None, hook_addon: None, hook_ev: None, arch: HashMap::new(), rutas_corridas: HashMap::new(), dir: String::new(),
            requeridos: HashMap::new(), bases: Orden::default(), ph_bases: Vec::new(), guiones: HashMap::new(), mats: HashMap::new(), glob: OrdenV::default(), globales: HashMap::new(),
            tec_ant: 0, teclas_ant: 0, bot_ant: None, bot_nuevos: Vec::new(), jug_vivo: None, armor: 0.0, lag_mov: None, walk: None, run: None, jump: None, escalon: None,
            agachado: None, fov_lua: 0.0, fov_arma: None, n_bala: 0, balas_prof: 0, danando: false, prof_base: 0, pedir_recarga: false, vm_ent: None, manos_ent: None, apar: None,
            part_cola: Vec::new(), umsg_h: HashMap::new(), pts: Vec::new(), dls: Orden::default(), pp: None,
            dib: Dib { col: [255.0; 4], tcol: [255.0; 4], mat: Valor::Nil, fuente: "13px Tahoma, sans-serif".into(), tx: 0.0, ty: 0.0, alfa: None },
            dibujo_hud: false, en_hud_paint: false, hud_n: 0, mov_lua: 0.0, activo: false, cb_n: 0, snd_n: 0, saliente: None, lectura: None, um: None,
            ancho_cache: HashMap::new(), tools_addon: Vec::new(), cargado_prelude: false, herencias: Vec::new(), luz_pedida: HashMap::new(), obj_prefab: HashMap::new(), muerte_muda: false, hud_sucio: false, mov_n: 0, modelos_faltan: Default::default(), fantasmas: HashMap::new(), dos_lados: HashMap::new(), listas_addon: HashMap::new(), pmodels: Vec::new(), pmanos: Vec::new(), pm_v: 0, modelo_jug: String::new(),
        }
    }
    pub fn ent_get(&self, id: i64) -> Option<Valor> { self.ents_idx.get(&id).and_then(|&i| self.ents[i].as_ref().map(|x| x.1.clone())) }
    pub fn ent_set(&mut self, id: i64, v: Valor) {
        if let Some(&i) = self.ents_idx.get(&id) { self.ents[i] = Some((id, v)); return; }
        self.ents_idx.insert(id, self.ents.len());
        self.ents.push(Some((id, v)));
    }
    pub fn ent_delete(&mut self, id: i64) {
        if let Some(i) = self.ents_idx.remove(&id) { self.ents[i] = None; }
        // (de vez en cuando se compacta)
        if self.ents.len() > 64 && self.ents_idx.len() * 2 < self.ents.len() {
            self.ents.retain(|x| x.is_some());
            self.ents_idx.clear();
            for (i, x) in self.ents.iter().enumerate() { if let Some((k, _)) = x { self.ents_idx.insert(*k, i); } }
        }
    }
    pub fn ents_vivas(&self) -> Vec<Valor> { self.ents.iter().filter_map(|x| x.as_ref().map(|y| y.1.clone())).collect() }
}

// ---------------- entidades ----------------
/// qué es una entidad
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TipoEnt {
    Ent,
    Jug,
    Arma,
    Npc,
    Vm,
    Null,
    Mundo,
    Manos,
}

/// una entidad de Lua (LEnt): vive en un userdata; los demás la nombran por ese userdata
pub(crate) struct Ent {
    pub id: i64,
    pub clase: String,
    pub clase_nom: Option<String>,
    pub tipo: TipoEnt,
    pub tabla: TablaRef,
    pub tabla_c: Option<TablaRef>,
    pub nw: OrdenV,
    pub o: Option<ObjId>,
    /// la persona del juego (un NPC) que es esta entidad (todavía no se usa: ver los pendientes)
    #[allow(dead_code)]
    pub persona: Option<PersonaId>,
    pub pos: V3,
    pub q: Quat,
    pub vivo: bool,
    pub vida: f64,
    pub vida_max: f64,
    pub color: [f64; 4],
    pub modelo: String,
    pub o_modelo: Option<String>,
    pub prox: Option<f64>,
    pub prox_s: f64,
    pub creado: bool,
    pub solo_c: bool,
    pub cs: bool,
    pub dueno: Option<Valor>,
    pub creador: Option<Valor>,
    pub fis: Option<Valor>,
    pub dt: Option<TablaRef>,
    pub dt_l: Option<TablaRef>,
    pub dt_slot: HashMap<String, Valor>,
    pub dt_listo: bool,
    pub padre: Option<Valor>,
    pub soldado_a: Option<Valor>,
    pub padre_off: Option<V3>,
    pub padre_q: Option<Quat>,
    pub pos_antes: Option<V3>,
    pub material: Valor,
    pub skin: Valor,
    pub no_draw: bool,
    pub limites: Option<[[f64; 3]; 2]>,
    pub escala: f64,
    pub solido_t: Option<i32>,
    pub no_solido: bool,
    pub grupo_col: i32,
    pub mov: Option<f64>,
    pub fijo_ns: bool,
    pub kv: OrdenV,
    pub sf: Option<i32>,
    pub nombre: Valor,
    pub fuego: f64,
    pub manip: HashMap<i64, [[f64; 3]; 3]>,
    pub cbs: HashMap<String, Orden<u64, Valor>>,
    pub sub_mat: Option<HashMap<i64, String>>,
    pub r_origen: Option<[f64; 3]>,
    pub r_ang: Option<[f64; 3]>,
    /// EnableMatrix("RenderMultiply", m): la matriz (filas, Source) que se aplica al modelo en su espacio
    pub matriz: Option<[f64; 16]>,
    pub vel_anim: f64,
    pub vista_ent: Option<Valor>,
    pub vista_off: Option<[f64; 3]>,
    pub punch: Option<[f64; 3]>,
    pub enemigo: Option<Valor>,
    pub conds: Vec<i32>,
    pub npc_estado: Option<i32>,
    pub congelado: bool,
    pub clip1: Option<f64>,
    pub clip2: Option<f64>,
    pub next_p: f64,
    pub next_s: f64,
    pub recarga: f64,
    pub prev_p: bool,
    pub prev_s: bool,
    pub prev_r: bool,
    pub tec_w: Option<u32>,
    pub hold: Valor,
    pub vm: Valor,
    pub wm: Valor,
    pub ult_tiro: f64,
    pub vm_apagada: bool,
    pub arma_suelo: Option<String>,
    pub nace: Option<f64>,
    pub ult_choque: Option<f64>,
    pub juego: Option<String>,
    pub noclip_lua: bool,
    pub sin_mira: bool,
}

impl Ent {
    fn nueva(id: i64, clase: &str, tipo: TipoEnt) -> Ent {
        Ent {
            id, clase: clase.to_string(), clase_nom: None, tipo, tabla: Tabla::nueva_ref(), tabla_c: None, nw: OrdenV::default(), o: None, persona: None,
            pos: V3::default(), q: Quat::default(), vivo: true, vida: 100.0, vida_max: 100.0, color: [255.0; 4], modelo: String::new(), o_modelo: None,
            prox: None, prox_s: 0.0, creado: false, solo_c: false, cs: false, dueno: None, creador: None, fis: None, dt: None, dt_l: None, dt_slot: HashMap::new(),
            dt_listo: false, padre: None, soldado_a: None, padre_off: None, padre_q: None, pos_antes: None, material: Valor::Nil, skin: Valor::Nil, no_draw: false,
            limites: None, escala: 1.0, solido_t: None, no_solido: false, grupo_col: 0, mov: None, fijo_ns: false, kv: OrdenV::default(), sf: None, nombre: Valor::Nil,
            fuego: 0.0, manip: HashMap::new(), cbs: HashMap::new(), sub_mat: None, r_origen: None, r_ang: None, matriz: None, vel_anim: 1.0, vista_ent: None, vista_off: None,
            punch: None, enemigo: None, conds: Vec::new(), npc_estado: None, congelado: false, clip1: None, clip2: None, next_p: 0.0, next_s: 0.0, recarga: 0.0,
            prev_p: false, prev_s: false, prev_r: false, tec_w: None, hold: Valor::Nil, vm: Valor::Nil, wm: Valor::Nil, ult_tiro: 0.0, vm_apagada: false,
            arma_suelo: None, nace: None, ult_choque: None, juego: None, noclip_lua: false, sin_mira: false,
        }
    }
}

/// una entidad nueva (new LEnt): con el número siguiente y anotada en GMA.ents
pub(crate) fn nueva_ent(clase: &str, tipo: TipoEnt) -> Valor {
    let (id, mt) = g(|g| { g.nid += 1; (g.nid, g.mt.ent.clone()) });
    let v = Valor::Udata(Udata::nueva(Ent::nueva(id, if clase.is_empty() { "prop_physics" } else { clase }, tipo), mt));
    if std::env::var_os("JXGMOD_ENTS").is_some() { eprintln!("ent {} {}", id, clase); }
    g(|g| g.ent_set(id, v.clone()));
    v
}
/// la entidad NULL (no está en GMA.ents)
pub(crate) fn ent_null(mt: Option<TablaRef>) -> Valor {
    let mut e = Ent::nueva(0, "NULL", TipoEnt::Null);
    e.vivo = false;
    Valor::Udata(Udata::nueva(e, mt))
}

#[inline]
pub(crate) fn es_ent(v: &Valor) -> bool { matches!(v, Valor::Udata(u) if u.es::<Ent>()) }
/// algo de una entidad (None si no es una)
#[inline]
pub(crate) fn ce<R>(v: &Valor, f: impl FnOnce(&mut Ent) -> R) -> Option<R> {
    match v { Valor::Udata(u) => u.con_mut(f), _ => None }
}
pub(crate) fn ent_id(v: &Valor) -> Option<i64> { ce(v, |e| e.id) }
pub(crate) fn ent_tipo(v: &Valor) -> Option<TipoEnt> { ce(v, |e| e.tipo) }
pub(crate) fn mismo(a: &Valor, b: &Valor) -> bool { a.crudo_igual(b) }
pub(crate) fn es_jug(v: &Valor) -> bool { g(|g| mismo(v, &g.jug)) }
pub(crate) fn null() -> Valor { g(|g| g.null.clone()) }
pub(crate) fn opt_null(v: &Option<Valor>) -> Valor { v.clone().unwrap_or_else(null) }

/// entValida
pub(crate) fn ent_valida(v: &Valor) -> bool {
    let Some((vivo, tipo, o)) = ce(v, |e| (e.vivo, e.tipo, e.o)) else { return false };
    if !vivo { return false; }
    if tipo != TipoEnt::Ent { return true; }
    match o { None => true, Some(o) => h(|h| h.cuerpo(o).is_some()) }
}

/// la tabla de la entidad del lado que corre (gmaTablaDe)
pub(crate) fn tabla_de(v: &Valor) -> Option<TablaRef> {
    let lado = g(|g| g.ctx);
    ce(v, |e| if lado == Lado::C { e.tabla_c.get_or_insert_with(Tabla::nueva_ref).clone() } else { e.tabla.clone() })
}

// ---------------- Vector y Angle ----------------
/// un Vector de Lua (en unidades de Source)
#[derive(Clone, Copy, Debug)]
pub struct LVec(pub [f64; 3]);
/// un Angle de Lua (p, y, r en grados)
#[derive(Clone, Copy, Debug)]
pub struct LAng(pub [f64; 3]);

pub(crate) fn nv(x: f64, y: f64, z: f64) -> Valor { let m = g(|g| g.mt.vec.clone()); Valor::Udata(Udata::nueva(LVec([x, y, z]), m)) }
pub(crate) fn nva(v: [f64; 3]) -> Valor { nv(v[0], v[1], v[2]) }
pub(crate) fn na(p: f64, y: f64, r: f64) -> Valor { let m = g(|g| g.mt.ang.clone()); Valor::Udata(Udata::nueva(LAng([p, y, r]), m)) }
pub(crate) fn naa(a: [f64; 3]) -> Valor { na(a[0], a[1], a[2]) }
pub(crate) fn vec_de(v: &Valor) -> Option<[f64; 3]> { match v { Valor::Udata(u) => u.con(|x: &LVec| x.0), _ => None } }
pub(crate) fn ang_de(v: &Valor) -> Option<[f64; 3]> { match v { Valor::Udata(u) => u.con(|x: &LAng| x.0), _ => None } }
/// GMA.V: una posición del juego como Vector de Source
pub(crate) fn vv(p: V3) -> Valor { let oy = g(|g| g.oy); nva(vs(p, oy)) }
/// GMA.Vr: algo que no es una posición
pub(crate) fn vvr(p: V3) -> Valor { nva(vsr(p)) }
/// GMA.Vd: una dirección
pub(crate) fn vvd(p: V3) -> Valor { nva(ds(p)) }
/// vG de un Vector de Lua
pub(crate) fn a_juego(v: [f64; 3]) -> V3 { let oy = g(|g| g.oy); vg(v, oy) }
pub(crate) fn a_source(p: V3) -> [f64; 3] { let oy = g(|g| g.oy); vs(p, oy) }

// ---------------- argumentos ----------------
#[inline]
pub(crate) fn ar(a: &[Valor], i: usize) -> Valor { a.get(i).cloned().unwrap_or(Valor::Nil) }
/// num(v, d) de la web: un número, o lo que da tonumber, o d
pub(crate) fn num(v: &Valor, d: f64) -> f64 { match v { Valor::Num(n) => *n, _ => Estado::a_numero(v).unwrap_or(d) } }
/// +x de JavaScript
pub(crate) fn mas(v: &Valor) -> f64 {
    match v {
        Valor::Num(n) => *n,
        Valor::Nil => f64::NAN,
        Valor::Bool(b) => if *b { 1.0 } else { 0.0 },
        Valor::Cad(s) => jxlua::numeros::js_texto_a_numero(s.bytes()),
        _ => f64::NAN,
    }
}
/// x | 0 de JavaScript
pub(crate) fn i32_de(x: f64) -> i32 { jxlua::numeros::to_int32(x) }
/// String(x) de JavaScript con un valor de Lua
pub(crate) fn js_str(v: &Valor) -> String { String::from_utf8_lossy(&jxlua::bib::js_texto(v)).into_owned() }
/// Math.min y Math.max de JavaScript (NaN se contagia)
pub(crate) fn jmin(a: f64, b: f64) -> f64 { if a.is_nan() || b.is_nan() { f64::NAN } else { a.min(b) } }
pub(crate) fn jmax(a: f64, b: f64) -> f64 { if a.is_nan() || b.is_nan() { f64::NAN } else { a.max(b) } }
/// verdadero en JavaScript (0, NaN y "" son falsos)
pub(crate) fn js_t(v: &Valor) -> bool {
    match v { Valor::Nil => false, Valor::Bool(b) => *b, Valor::Num(n) => *n != 0.0 && !n.is_nan(), Valor::Cad(c) => !c.is_empty(), _ => true }
}
/// R.T: verdadero en Lua
#[inline]
pub(crate) fn t(v: &Valor) -> bool { v.es_verdad() }
pub(crate) fn cad(s: &str) -> Valor { Valor::cadena(s) }
pub(crate) fn tab_de(v: Vec<Valor>) -> Valor {
    let t = Tabla::nueva_ref();
    { let mut b = t.borrow_mut(); for (i, x) in v.into_iter().enumerate() { let _ = b.set(Valor::Num((i + 1) as f64), x); } }
    Valor::Tabla(t)
}
pub(crate) fn tabla_kv(kv: Vec<(&str, Valor)>) -> Valor {
    let t = Tabla::nueva_ref();
    { let mut b = t.borrow_mut(); for (k, x) in kv { b.set_str(k, x); } }
    Valor::Tabla(t)
}
pub(crate) fn tget(t: &TablaRef, k: &str) -> Valor { t.borrow().get_str(k) }
/// los elementos de la parte de lista de una tabla (t.a de la web)
pub(crate) fn lista(t: &TablaRef) -> Vec<Valor> {
    let b = t.borrow();
    let n = b.len();
    (1..=n).map(|i| b.get_int(i as i64)).collect()
}

/// def: una función nativa en una tabla
pub(crate) fn def(t: &TablaRef, n: &str, f: impl Fn(&mut Estado, &[Valor], &mut Vec<Valor>) -> Res + 'static) {
    t.borrow_mut().set_str(n, Estado::funcion_rapida(f));
}
pub(crate) fn fnat(f: impl Fn(&mut Estado, &[Valor], &mut Vec<Valor>) -> Res + 'static) -> Valor { Estado::funcion_rapida(f) }
/// una biblioteca (la crea si no está)
pub(crate) fn lib(e: &mut Estado, n: &str) -> TablaRef {
    let gl = e.globales();
    let v = gl.borrow().get_str(n);
    if let Valor::Tabla(t) = v { return t; }
    let t = Tabla::nueva_ref();
    gl.borrow_mut().set_str(n, Valor::Tabla(t.clone()));
    t
}
pub(crate) fn nada(_: &mut Estado, _: &[Valor], _: &mut Vec<Valor>) -> Res { Ok(()) }

// ---------------- errores ----------------
/// un error del Lua: a la consola del juego (las 3 primeras veces de cada uno)
pub(crate) fn gma_err(m: &str) {
    let n = g(|g| {
        g.ult_err = true;
        if let Some(a) = &g.addon_actual { let mut a = a.borrow_mut(); if a.errores.len() < 50 { a.errores.push(m.to_string()); } }
        if g.err_cuenta.len() > 500 { g.err_cuenta.clear(); }
        let c = g.err_cuenta.entry(m.to_string()).or_insert(0);
        *c += 1;
        *c
    });
    if n > 3 { return; }
    h(|h| h.error_lua(m));
}
pub(crate) fn consola(s: &str) { h(|h| h.consola(s)); }

// ---------------- el lado y llamar al Lua ----------------
/// SERVER, CLIENT y las globales de cada lado (gmaLado)
pub(crate) fn poner_lado(e: &mut Estado, ctx: Lado) {
    let gl = e.globales();
    { let mut b = gl.borrow_mut(); b.set_str("SERVER", Valor::Bool(ctx == Lado::S)); b.set_str("CLIENT", Valor::Bool(ctx == Lado::C)); }
    let capa = g(|g| if g.ov_s.is_some() { Some(if ctx == Lado::C { g.ov_c.clone() } else { g.ov_s.clone() }) } else { None });
    if let Some(c) = capa { e.set_capa_globales(c); }
}

/// gmLlamar: una función de Lua con su lado, el tope de pasos de nuevo y los errores a la consola
pub(crate) fn llamar(e: &mut Estado, f: &Valor, ctx: Lado, args: &[Valor]) -> Vec<Valor> {
    if !matches!(f, Valor::Func(_)) { return Vec::new(); }
    let c0 = g(|g| std::mem::replace(&mut g.ctx, ctx));
    poner_lado(e, ctx);
    let r = e.llamar(f, args);
    g(|g| g.ctx = c0);
    poner_lado(e, c0);
    match r {
        Ok(v) => v,
        Err(x) => { gma_err(&x.mensaje()); Vec::new() }
    }
}
pub(crate) fn primero(r: &[Valor]) -> Valor { r.first().cloned().unwrap_or(Valor::Nil) }

/// gmaEnLado: correr algo con el lado puesto
pub(crate) fn en_lado<R>(e: &mut Estado, ctx: Lado, f: impl FnOnce(&mut Estado) -> R) -> R {
    let c0 = g(|g| std::mem::replace(&mut g.ctx, ctx));
    poner_lado(e, ctx);
    let r = f(e);
    g(|g| g.ctx = c0);
    poner_lado(e, c0);
    r
}

/// claseTabla: la tabla de la clase (ENT/SWEP) del lado pedido
pub(crate) fn clase_tabla(nombre: &str, ctx: Lado) -> Option<TablaRef> {
    g(|g| {
        let c = g.clases.get(nombre).or_else(|| g.armas.get(nombre))?;
        if ctx == Lado::C && c.c.is_some() { c.c.clone() } else { c.s.clone().or_else(|| c.c.clone()) }
    })
}
/// buscarEnClase: en la clase y sus BaseClass (20 niveles)
pub(crate) fn buscar_en_clase(t: &TablaRef, k: &str) -> Valor {
    let mut t = t.clone();
    for _ in 0..20 {
        let v = tget(&t, k);
        if !v.es_nil() { return v; }
        match tget(&t, "BaseClass") { Valor::Tabla(b) => t = b, _ => return Valor::Nil }
    }
    Valor::Nil
}
/// metodo: el método de la clase de la entidad, llamado con su lado
pub(crate) fn metodo(e: &mut Estado, ent: &Valor, nombre: &str, ctx: Lado, args: &[Valor]) -> Vec<Valor> {
    let Some(clase) = ce(ent, |x| x.clase.clone()) else { return Vec::new() };
    let Some(t) = clase_tabla(&clase, ctx) else { return Vec::new() };
    let f = buscar_en_clase(&t, nombre);
    if !matches!(f, Valor::Func(_)) { return Vec::new(); }
    let mut a = Vec::with_capacity(args.len() + 1);
    a.push(ent.clone());
    a.extend_from_slice(args);
    llamar(e, &f, ctx, &a)
}

// ---------------- archivos ----------------
/// gmArchivo: un archivo de los addons montados o del contenido base del juego
pub(crate) fn archivo(r: &str) -> Option<Rc<[u8]>> {
    if let Some(b) = g(|g| g.arch.get(r).cloned()) { return Some(b); }
    h(|h| h.archivo(r)).map(|v| Rc::from(v.into_boxed_slice()))
}
pub(crate) fn existe(r: &str) -> bool { g(|g| g.arch.contains_key(r)) || h(|h| h.existe(r)) }

// ---------------- otros ----------------
/// una referencia débil a una entidad (el PhysObj no la mantiene viva)
pub(crate) fn debil(v: &Valor) -> Weak<Udata> { match v { Valor::Udata(u) => Rc::downgrade(u), _ => Weak::new() } }
pub(crate) fn fuerte(w: &Weak<Udata>) -> Valor { w.upgrade().map(Valor::Udata).unwrap_or(Valor::Nil) }

/// un contador para cosas con número (CSoundPatch)
pub(crate) fn sig_snd() -> u32 { g(|g| { g.snd_n += 1; g.snd_n }) }

/// un número entero de una celda compartida (para los Fn que la cierran)
#[allow(dead_code)]
pub(crate) type Contador = Rc<Cell<u64>>;

// ---------------- anotar las llamadas a la API (pruebas) ----------------
fn fmt_arg(x: &Valor) -> String {
    use crate::prueba::{fmt_n, fmt_s};
    match x {
        Valor::Nil => "nil".into(),
        Valor::Bool(b) => if *b { "true".into() } else { "false".into() },
        Valor::Num(n) => fmt_n(*n),
        Valor::Cad(c) => { let t = c.texto(); let u: Vec<u16> = t.encode_utf16().collect(); if u.len() > 60 { fmt_s(&String::from_utf16_lossy(&u[..60])) } else { fmt_s(&t) } }
        Valor::Tabla(_) => "table".into(),
        Valor::Func(_) => "function".into(),
        Valor::Udata(_) => {
            if let Some(v) = vec_de(x) { return format!("v({},{},{})", fmt_n(v[0]), fmt_n(v[1]), fmt_n(v[2])); }
            if let Some(v) = ang_de(x) { return format!("a({},{},{})", fmt_n(v[0]), fmt_n(v[1]), fmt_n(v[2])); }
            if let Some(id) = ent_id(x) { return format!("e#{}", id); }
            "userdata".into()
        }
        _ => "userdata".into(),
    }
}
pub(crate) fn anotar_api(e: &mut Estado, anotar: Rc<dyn Fn(String)>) {
    let mut vistas: Vec<TablaRef> = Vec::new();
    let envolver = |t: &TablaRef, pre: &str, vistas: &mut Vec<TablaRef>| {
        if vistas.iter().any(|x| Rc::ptr_eq(x, t)) { return; }
        vistas.push(t.clone());
        let mut ks: Vec<(String, Valor)> = t.borrow().pares().into_iter().filter_map(|(k, v)| match k { Valor::Cad(c) => Some((c.texto().into_owned(), v)), _ => None }).collect();
        ks.sort_by(|a, b| a.0.encode_utf16().cmp(b.0.encode_utf16()));
        for (k, f) in ks {
            let Valor::Func(ff) = &f else { continue };
            if !ff.es_nativa() || k.starts_with("__") || g(|g| g.dos_lados.contains_key(&(Rc::as_ptr(ff) as *const u8 as usize))) { continue; }
            let n = format!("{}{}", pre, k);
            let an = anotar.clone();
            let w = fnat(move |e, a, o| { let mut s = format!("api {}", crate::prueba::fmt_s(&n)); for x in a { s.push(' '); s.push_str(&fmt_arg(x)); } an(s); o.extend(e.llamar_aqui(&f, a)?); Ok(()) });
            t.borrow_mut().set_str(&k, w);
        }
    };
    let metas = g(|g| g.metas.v.clone());
    for n in ["Entity", "Player", "Weapon", "NPC", "Vehicle", "PhysObj", "Vector", "Angle"] {
        if let Some((_, t)) = metas.iter().find(|x| x.0 == n) { envolver(t, &format!("{}:", n), &mut vistas); }
    }
    let mi = |m: Option<TablaRef>| m.and_then(|m| match m.borrow().get_str("__index") { Valor::Tabla(t) => Some(t), _ => None });
    let (col, cv, dmg, ef, snd) = g(|g| (g.mt.col.clone(), g.mt.cvar.clone(), g.mt.dmg.clone(), g.mt.efecto.clone(), g.mt.snd.clone()));
    for (n, t) in [("Color", col), ("ConVar", cv), ("CTakeDamageInfo", mi(dmg)), ("CEffectData", mi(ef)), ("CSoundPatch", mi(snd))] { if let Some(t) = t { envolver(&t, &format!("{}:", n), &mut vistas); } }
    let gl = e.globales();
    let mut ks: Vec<(String, Valor)> = gl.borrow().pares().into_iter().filter_map(|(k, v)| match k { Valor::Cad(c) => Some((c.texto().into_owned(), v)), _ => None }).collect();
    ks.sort_by(|a, b| a.0.encode_utf16().cmp(b.0.encode_utf16()));
    const STD: [&str; 12] = ["string", "table", "math", "os", "coroutine", "debug", "bit", "utf8", "io", "_G", "package", "jit"];
    for (k, v) in &ks { if let Valor::Tabla(t) = v { if !STD.contains(&k.as_str()) { envolver(t, &format!("{}.", k), &mut vistas); } } }
    let t = Tabla::nueva_ref();
    for (k, v) in &ks { if matches!(v, Valor::Func(_)) && k.as_bytes().first().map(|c| c.is_ascii_uppercase()).unwrap_or(false) { t.borrow_mut().set_str(k, v.clone()); } }
    envolver(&t, "", &mut Vec::new());
    for (k, v) in t.borrow().pares() { let _ = gl.borrow_mut().set(k, v); }
}
