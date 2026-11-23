//! Los valores del Lua: nil, booleanos, números (f64), textos (de bytes, como en GMod), tablas (parte de arreglo y parte
//! de hash con el orden en que se pusieron las claves, como el `Map` de la versión web), funciones (de Lua o nativas),
//! userdata (objetos del juego con su metatabla: Vector, Angle, Entity...) y corrutinas.
use std::any::Any;
use std::borrow::Cow;
use std::cell::{Cell, RefCell};
use std::fmt;
use std::rc::Rc;

use crate::codigo::Proto;
use crate::vm::Hilo;
use crate::{Error, Estado};

// ---------------- textos ----------------

/// Un texto de Lua: bytes (no necesariamente UTF-8). El hash se calcula la primera vez que hace falta.
pub struct Cadena {
    hash: Cell<u32>,
    datos: Box<[u8]>,
}

/// el hash de Lua 5.1 (con paso: los textos largos no se recorren enteros)
fn hash_bytes(b: &[u8]) -> u32 {
    let l = b.len();
    let mut h = l as u32 ^ 0x9e37_79b9;
    let paso = (l >> 5) + 1;
    let mut i = l;
    while i >= paso {
        h ^= (h << 5).wrapping_add(h >> 2).wrapping_add(b[i - 1] as u32);
        i -= paso;
    }
    if h == 0 { 1 } else { h }
}

/// los textos cortos que se repiten (nombres del código y claves de las bibliotecas) se comparten: así una búsqueda por
/// una constante encuentra la clave por el puntero, sin comparar bytes
const LARGO_INTERNO: usize = 40;

thread_local! {
    static INTERNOS: std::cell::RefCell<std::collections::HashMap<Box<[u8]>, Rc<Cadena>>> = std::cell::RefCell::new(std::collections::HashMap::new());
}

impl Cadena {
    /// un texto compartido (para nombres y constantes; los textos largos o hechos en tiempo de ejecución, aparte)
    pub fn interna(b: &[u8]) -> Rc<Cadena> {
        if b.len() > LARGO_INTERNO { return Cadena::nueva(b); }
        INTERNOS.with(|m| {
            let mut m = m.borrow_mut();
            if let Some(c) = m.get(b) { return c.clone(); }
            let c = Cadena::nueva(b);
            c.hash();
            m.insert(b.into(), c.clone());
            c
        })
    }
    pub fn nueva(b: &[u8]) -> Rc<Cadena> { Rc::new(Cadena { hash: Cell::new(0), datos: b.into() }) }
    pub fn desde_vec(v: Vec<u8>) -> Rc<Cadena> { Rc::new(Cadena { hash: Cell::new(0), datos: v.into_boxed_slice() }) }
    #[inline] pub fn bytes(&self) -> &[u8] { &self.datos }
    #[inline] pub fn len(&self) -> usize { self.datos.len() }
    #[inline] pub fn is_empty(&self) -> bool { self.datos.is_empty() }
    /// como texto de Rust (lo que no es UTF-8 queda con el caracter de reemplazo)
    pub fn texto(&self) -> Cow<'_, str> { String::from_utf8_lossy(&self.datos) }
    #[inline(always)]
    pub(crate) fn hash(&self) -> u32 {
        let h = self.hash.get();
        if h != 0 { h } else { self.calcular_hash() }
    }
    #[inline(never)]
    fn calcular_hash(&self) -> u32 {
        let h = hash_bytes(&self.datos);
        self.hash.set(h);
        h
    }
    #[inline(always)]
    pub(crate) fn igual(a: &Rc<Cadena>, b: &Rc<Cadena>) -> bool { Rc::ptr_eq(a, b) || Cadena::igual_contenido(a, b) }
    #[inline(never)]
    fn igual_contenido(a: &Cadena, b: &Cadena) -> bool {
        if a.datos.len() != b.datos.len() { return false; }
        let (ha, hb) = (a.hash.get(), b.hash.get());
        if ha != 0 && hb != 0 && ha != hb { return false; }
        a.datos == b.datos
    }
}

impl PartialEq for Cadena {
    fn eq(&self, o: &Cadena) -> bool { self.datos == o.datos }
}

impl fmt::Debug for Cadena {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { write!(f, "{:?}", self.texto()) }
}

/// un hash rápido (FxHash) para los mapas internos del compilador y del caché
#[derive(Default, Clone, Copy)]
pub(crate) struct Fx(u64);
impl std::hash::Hasher for Fx {
    #[inline]
    fn write(&mut self, b: &[u8]) {
        for c in b.chunks(8) {
            let mut x = [0u8; 8];
            x[..c.len()].copy_from_slice(c);
            self.write_u64(u64::from_le_bytes(x));
        }
    }
    #[inline]
    fn write_u64(&mut self, x: u64) { self.0 = (self.0.rotate_left(5) ^ x).wrapping_mul(0x51_7c_c1_b7_27_22_0a_95); }
    #[inline]
    fn finish(&self) -> u64 { self.0 }
}
pub(crate) type FxBuild = std::hash::BuildHasherDefault<Fx>;

/// un texto como clave de un HashMap (por contenido)
#[derive(Clone)]
pub(crate) struct ClaveCad(pub Rc<Cadena>);
impl PartialEq for ClaveCad { fn eq(&self, o: &ClaveCad) -> bool { Cadena::igual(&self.0, &o.0) } }
impl Eq for ClaveCad {}
impl std::hash::Hash for ClaveCad { fn hash<H: std::hash::Hasher>(&self, h: &mut H) { h.write_u32(self.0.hash()) } }

// ---------------- valores ----------------

pub type TablaRef = Rc<RefCell<Tabla>>;
/// una variable capturada por una clausura (un local de afuera o un upvalue)
pub type Celda = Rc<RefCell<Valor>>;

#[derive(Clone, Default)]
pub enum Valor {
    #[default]
    Nil,
    Bool(bool),
    Num(f64),
    Cad(Rc<Cadena>),
    Tabla(TablaRef),
    Func(Rc<Funcion>),
    Udata(Rc<Udata>),
    Hilo(Rc<RefCell<Corrutina>>),
}

impl Valor {
    #[inline] pub fn es_nil(&self) -> bool { matches!(self, Valor::Nil) }
    /// lo que vale como verdadero en un if: todo menos nil y false
    #[inline] pub fn es_verdad(&self) -> bool { !matches!(self, Valor::Nil | Valor::Bool(false)) }
    pub fn tipo(&self) -> &'static str {
        match self {
            Valor::Nil => "nil",
            Valor::Bool(_) => "boolean",
            Valor::Num(_) => "number",
            Valor::Cad(_) => "string",
            Valor::Tabla(_) => "table",
            Valor::Func(_) => "function",
            Valor::Udata(_) => "userdata",
            Valor::Hilo(_) => "thread",
        }
    }
    #[inline] pub fn num(&self) -> Option<f64> { if let Valor::Num(n) = self { Some(*n) } else { None } }
    #[inline] pub fn cad(&self) -> Option<&Rc<Cadena>> { if let Valor::Cad(s) = self { Some(s) } else { None } }
    #[inline] pub fn tabla(&self) -> Option<&TablaRef> { if let Valor::Tabla(t) = self { Some(t) } else { None } }
    #[inline] pub fn udata(&self) -> Option<&Rc<Udata>> { if let Valor::Udata(u) = self { Some(u) } else { None } }
    /// el texto si es un texto (sin convertir números)
    pub fn texto(&self) -> Option<Cow<'_, str>> { self.cad().map(|s| s.texto()) }
    /// un texto nuevo
    pub fn cadena(s: impl AsRef<[u8]>) -> Valor { Valor::Cad(Cadena::nueva(s.as_ref())) }
    /// una tabla nueva vacía
    pub fn tabla_nueva() -> Valor { Valor::Tabla(Rc::new(RefCell::new(Tabla::nueva()))) }
    /// igualdad cruda (rawequal, y la de las claves de las tablas): números por valor, textos por contenido, lo demás
    /// por identidad
    pub fn crudo_igual(&self, o: &Valor) -> bool {
        match (self, o) {
            (Valor::Nil, Valor::Nil) => true,
            (Valor::Bool(a), Valor::Bool(b)) => a == b,
            (Valor::Num(a), Valor::Num(b)) => a == b,
            (Valor::Cad(a), Valor::Cad(b)) => Cadena::igual(a, b),
            (Valor::Tabla(a), Valor::Tabla(b)) => Rc::ptr_eq(a, b),
            (Valor::Func(a), Valor::Func(b)) => Rc::ptr_eq(a, b),
            (Valor::Udata(a), Valor::Udata(b)) => Rc::ptr_eq(a, b),
            (Valor::Hilo(a), Valor::Hilo(b)) => Rc::ptr_eq(a, b),
            _ => false,
        }
    }
    /// la dirección del objeto (para el hash de las claves)
    #[inline]
    fn puntero(&self) -> usize {
        match self {
            Valor::Tabla(t) => Rc::as_ptr(t) as *const u8 as usize,
            Valor::Func(f) => Rc::as_ptr(f) as *const u8 as usize,
            Valor::Udata(u) => Rc::as_ptr(u) as *const u8 as usize,
            Valor::Hilo(h) => Rc::as_ptr(h) as *const u8 as usize,
            _ => 0,
        }
    }
}

impl From<f64> for Valor { fn from(n: f64) -> Valor { Valor::Num(n) } }
impl From<i32> for Valor { fn from(n: i32) -> Valor { Valor::Num(n as f64) } }
impl From<i64> for Valor { fn from(n: i64) -> Valor { Valor::Num(n as f64) } }
impl From<usize> for Valor { fn from(n: usize) -> Valor { Valor::Num(n as f64) } }
impl From<bool> for Valor { fn from(b: bool) -> Valor { Valor::Bool(b) } }
impl From<&str> for Valor { fn from(s: &str) -> Valor { Valor::cadena(s) } }
impl From<String> for Valor { fn from(s: String) -> Valor { Valor::Cad(Cadena::desde_vec(s.into_bytes())) } }
impl From<&[u8]> for Valor { fn from(s: &[u8]) -> Valor { Valor::cadena(s) } }
impl From<Vec<u8>> for Valor { fn from(s: Vec<u8>) -> Valor { Valor::Cad(Cadena::desde_vec(s)) } }
impl From<Rc<Cadena>> for Valor { fn from(s: Rc<Cadena>) -> Valor { Valor::Cad(s) } }
impl From<TablaRef> for Valor { fn from(t: TablaRef) -> Valor { Valor::Tabla(t) } }
impl From<Rc<Udata>> for Valor { fn from(u: Rc<Udata>) -> Valor { Valor::Udata(u) } }
impl<T: Into<Valor>> From<Option<T>> for Valor { fn from(o: Option<T>) -> Valor { o.map(Into::into).unwrap_or(Valor::Nil) } }

impl fmt::Debug for Valor {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Valor::Nil => write!(f, "nil"),
            Valor::Bool(b) => write!(f, "{b}"),
            Valor::Num(n) => write!(f, "{}", crate::numeros::fmt_num(*n)),
            Valor::Cad(s) => write!(f, "{:?}", s.texto()),
            otro => write!(f, "{}: {:#x}", otro.tipo(), otro.puntero()),
        }
    }
}

// ---------------- el hash de las claves ----------------

#[inline]
fn mezclar64(x: u64) -> u32 {
    let h = x.wrapping_mul(0x9E37_79B9_7F4A_7C15);
    (h >> 32) as u32 ^ h as u32
}

#[inline]
fn hash_clave(k: &Valor) -> u32 {
    match k {
        Valor::Num(n) => mezclar64((*n + 0.0).to_bits()),
        Valor::Cad(s) => s.hash(),
        Valor::Bool(b) => *b as u32 + 1,
        Valor::Nil => 0,
        otro => mezclar64(otro.puntero() as u64),
    }
}

#[inline]
fn clave_igual(a: &Valor, b: &Valor) -> bool {
    match (a, b) {
        (Valor::Cad(x), Valor::Cad(y)) => Cadena::igual(x, y),
        (Valor::Num(x), Valor::Num(y)) => x == y,
        _ => a.crudo_igual(b),
    }
}

/// La parte de hash de una tabla: un mapa que recuerda el orden en que se pusieron las claves (como el `Map` de JS que
/// usa la web, así `pairs` recorre en el mismo orden). Borrar deja la entrada muerta (la clave sigue ahí para que `next`
/// pueda seguir desde ella); volver a poner una clave borrada la agrega al final, como `Map.set` después de `delete`.
#[derive(Default)]
pub(crate) struct Mapa {
    ent: Vec<(Valor, Valor)>,
    idx: Vec<u32>,
    bits: u32,
    pub(crate) vivas: usize,
}

const VACIA: u32 = 0;

impl Mapa {
    fn con_capacidad(n: usize) -> Mapa {
        let mut m = Mapa::default();
        if n > 0 {
            let mut bits = 2;
            while (1usize << bits) * 3 / 4 < n { bits += 1; }
            m.bits = bits;
            m.idx = vec![VACIA; 1 << bits];
            m.ent.reserve(n);
        }
        m
    }
    #[inline]
    fn ranura(&self, h: u32) -> usize { (h.wrapping_mul(0x9E37_79B9) >> (32 - self.bits)) as usize }
    /// la posición en `idx` de la clave (Ok) o de la ranura vacía donde iría (Err)
    #[inline]
    fn buscar_ranura(&self, k: &Valor, h: u32) -> Result<usize, usize> {
        let mask = self.idx.len() - 1;
        let mut i = self.ranura(h);
        loop {
            let e = self.idx[i];
            if e == VACIA { return Err(i); }
            if clave_igual(&self.ent[(e - 1) as usize].0, k) { return Ok(i); }
            i = (i + 1) & mask;
        }
    }
    /// la entrada de la clave (viva o muerta)
    #[inline]
    pub(crate) fn entrada(&self, k: &Valor) -> Option<usize> {
        if self.idx.is_empty() { return None; }
        match self.buscar_ranura(k, hash_clave(k)) { Ok(i) => Some((self.idx[i] - 1) as usize), Err(_) => None }
    }
    #[inline]
    pub(crate) fn get(&self, k: &Valor) -> Option<&Valor> {
        let e = self.entrada(k)?;
        let v = &self.ent[e].1;
        if v.es_nil() { None } else { Some(v) }
    }
    /// búsqueda rápida por texto
    #[inline(always)]
    pub(crate) fn get_cad(&self, k: &Rc<Cadena>) -> Option<&Valor> {
        let e = self.entrada_cad(k)?;
        // SAFETY: entrada_cad devuelve un índice de `ent`
        let v = unsafe { &self.ent.get_unchecked(e).1 };
        if v.es_nil() { None } else { Some(v) }
    }
    /// la entrada de una clave de texto (viva o muerta)
    #[inline(always)]
    fn entrada_cad(&self, k: &Rc<Cadena>) -> Option<usize> {
        if self.idx.is_empty() { return None; }
        let mask = self.idx.len() - 1;
        let mut i = self.ranura(k.hash());
        loop {
            // SAFETY: i está enmascarado al largo de idx; las entradas de idx apuntan a `ent`
            let e = unsafe { *self.idx.get_unchecked(i) };
            if e == VACIA { return None; }
            let ent = (e - 1) as usize;
            if let Valor::Cad(c) = unsafe { &self.ent.get_unchecked(ent).0 } {
                if Cadena::igual(c, k) { return Some(ent); }
            }
            i = (i + 1) & mask;
        }
    }
    /// el valor de una clave de texto que está (viva), para cambiarlo en el lugar
    #[inline(always)]
    pub(crate) fn get_cad_mut(&mut self, k: &Rc<Cadena>) -> Option<&mut Valor> {
        let e = self.entrada_cad(k)?;
        let v = unsafe { &mut self.ent.get_unchecked_mut(e).1 };
        if v.es_nil() { None } else { Some(v) }
    }
    /// sacar una clave (devuelve el valor que tenía)
    pub(crate) fn quitar(&mut self, k: &Valor) -> Valor {
        if let Some(e) = self.entrada(k) {
            let v = std::mem::take(&mut self.ent[e].1);
            if !v.es_nil() { self.vivas -= 1; }
            v
        } else {
            Valor::Nil
        }
    }
    /// poner un valor que no es nil (la clave ya se revisó: ni nil ni NaN)
    pub(crate) fn poner(&mut self, k: Valor, v: Valor) {
        if !self.idx.is_empty() {
            let h = hash_clave(&k);
            match self.buscar_ranura(&k, h) {
                Ok(i) => {
                    let e = (self.idx[i] - 1) as usize;
                    if !self.ent[e].1.es_nil() { self.ent[e].1 = v; return; }
                    // (estaba borrada: va al final, como en el Map de JS)
                    if self.ent.len() < self.idx.len() * 3 / 4 {
                        self.ent[e].0 = Valor::Nil;
                        self.ent.push((k, v));
                        self.idx[i] = self.ent.len() as u32;
                        self.vivas += 1;
                        return;
                    }
                    // (no entra: se rehace, la muerta se va y se agrega abajo)
                    self.ent[e].0 = Valor::Nil;
                }
                Err(i) => {
                    if self.ent.len() < self.idx.len() * 3 / 4 {
                        self.ent.push((k, v));
                        self.idx[i] = self.ent.len() as u32;
                        self.vivas += 1;
                        return;
                    }
                }
            }
        }
        self.rehacer(self.vivas + 1);
        let h = hash_clave(&k);
        let i = match self.buscar_ranura(&k, h) { Ok(i) | Err(i) => i };
        self.ent.push((k, v));
        self.idx[i] = self.ent.len() as u32;
        self.vivas += 1;
    }
    /// compactar (sin las entradas muertas) y agrandar para que entren `n` claves con lugar de sobra
    fn rehacer(&mut self, n: usize) {
        let mut bits = 2;
        while (1usize << bits) * 3 / 4 < n * 2 { bits += 1; }
        let viejas = std::mem::take(&mut self.ent);
        self.bits = bits;
        self.idx = vec![VACIA; 1 << bits];
        self.ent = Vec::with_capacity((1usize << bits) * 3 / 4);
        for (k, v) in viejas {
            if v.es_nil() { continue; }
            let i = match self.buscar_ranura(&k, hash_clave(&k)) { Ok(i) | Err(i) => i };
            self.ent.push((k, v));
            self.idx[i] = self.ent.len() as u32;
        }
        self.vivas = self.ent.len();
    }
    /// la primera entrada viva desde la posición `i`
    #[inline]
    pub(crate) fn desde(&self, mut i: usize) -> Option<(usize, &Valor, &Valor)> {
        while i < self.ent.len() {
            let (k, v) = &self.ent[i];
            if !v.es_nil() { return Some((i, k, v)); }
            i += 1;
        }
        None
    }
    pub(crate) fn limpiar(&mut self) { *self = Mapa::default(); }
}

// ---------------- tablas ----------------

/// Una tabla de Lua: la parte de arreglo (claves 1..n, sin nil al final; puede tener huecos en el medio, como la web) y
/// la de hash (en el orden en que se pusieron las claves).
#[derive(Default)]
pub struct Tabla {
    pub(crate) arr: Vec<Valor>,
    pub(crate) mapa: Mapa,
    pub(crate) meta: Option<TablaRef>,
    pub(crate) id: Cell<u32>,
    /// el filtro de asignación (ver `set_filtro`)
    pub(crate) filtro: Option<FiltroAsignacion>,
}

/// un filtro para poner una función con nombre en una tabla: recibe la clave, la función y lo que había; si devuelve
/// algo, eso es lo que queda en la tabla (la capa GMod lo usa para que el server y el cliente tengan cada uno su versión
/// de un método de una metatabla compartida, como LuaTablaLados de la web)
pub type FiltroAsignacion = Rc<dyn Fn(&Valor, &Valor, &Valor) -> Option<Valor>>;

/// por qué no se puede usar una clave
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ClaveMala { Nil, NaN }

impl ClaveMala {
    pub fn mensaje(self) -> &'static str { match self { ClaveMala::Nil => "table index is nil", ClaveMala::NaN => "table index is NaN" } }
}

/// el índice del arreglo (0..len) si k es un entero de 1 a len
#[inline]
fn indice_arr(n: f64, len: usize) -> Option<usize> {
    if n >= 1.0 && n <= len as f64 {
        let i = n as usize;
        if i as f64 == n { return Some(i - 1); }
    }
    None
}

impl Tabla {
    pub fn nueva() -> Tabla { Tabla::default() }
    pub fn con_capacidad(narr: usize, nhash: usize) -> Tabla {
        Tabla { arr: Vec::with_capacity(narr), mapa: Mapa::con_capacidad(nhash), meta: None, id: Cell::new(0), filtro: None }
    }
    /// la tabla nueva ya envuelta para usarla como valor
    pub fn nueva_ref() -> TablaRef { Rc::new(RefCell::new(Tabla::nueva())) }
    /// leer sin metamétodos (nil si no está)
    #[inline]
    pub fn get(&self, k: &Valor) -> Valor { self.get_ref(k).cloned().unwrap_or(Valor::Nil) }
    /// leer sin metamétodos, por referencia (None si no está o es nil)
    #[inline]
    pub fn get_ref(&self, k: &Valor) -> Option<&Valor> {
        match k {
            Valor::Num(n) => {
                if let Some(i) = indice_arr(*n, self.arr.len()) {
                    let v = &self.arr[i];
                    return if v.es_nil() { None } else { Some(v) };
                }
                if *n == 0.0 { return self.mapa.get(&Valor::Num(0.0)); }
                self.mapa.get(k)
            }
            Valor::Cad(s) => self.mapa.get_cad(s),
            Valor::Nil => None,
            _ => self.mapa.get(k),
        }
    }
    #[inline]
    pub fn get_cad(&self, k: &Rc<Cadena>) -> Option<&Valor> { self.mapa.get_cad(k) }
    /// leer por nombre (crea el texto: para el anfitrión, no para el bucle caliente)
    pub fn get_str(&self, k: &str) -> Valor { self.get(&Valor::Cad(Cadena::interna(k.as_bytes()))) }
    #[inline]
    pub fn get_int(&self, i: i64) -> Valor {
        if i >= 1 && (i as usize) <= self.arr.len() { return self.arr[i as usize - 1].clone(); }
        self.get(&Valor::Num(i as f64))
    }
    /// escribir sin metamétodos (como LuaTable.set de la web)
    pub fn set(&mut self, k: Valor, v: Valor) -> Result<(), ClaveMala> {
        let v = match &self.filtro {
            Some(f) if matches!(k, Valor::Cad(_)) && matches!(v, Valor::Func(_)) => { let prev = self.get(&k); f(&k, &v, &prev).unwrap_or(v) }
            _ => v,
        };
        match &k {
            Valor::Num(n) => {
                let n = *n;
                if n.is_nan() { return Err(ClaveMala::NaN); }
                let len = self.arr.len();
                if n >= 1.0 && n <= (len + 1) as f64 && n <= i32::MAX as f64 {
                    let i = n as usize;
                    if i as f64 == n {
                        if i <= len {
                            let borrar = v.es_nil() && i == len;
                            self.arr[i - 1] = v;
                            if borrar { while matches!(self.arr.last(), Some(Valor::Nil)) { self.arr.pop(); } }
                            return Ok(());
                        }
                        // i == len + 1
                        if v.es_nil() { self.mapa.quitar(&k); return Ok(()); }
                        self.arr.push(v);
                        if self.mapa.vivas > 0 {
                            self.mapa.quitar(&k);
                            self.migrar();
                        }
                        return Ok(());
                    }
                }
                if n == 0.0 {
                    if v.es_nil() { self.mapa.quitar(&Valor::Num(0.0)); } else { self.mapa.poner(Valor::Num(0.0), v); }
                    return Ok(());
                }
            }
            Valor::Nil => return Err(ClaveMala::Nil),
            _ => {}
        }
        if v.es_nil() { self.mapa.quitar(&k); } else { self.mapa.poner(k, v); }
        Ok(())
    }
    /// lo que estaba en la parte de hash a continuación del arreglo pasa al arreglo
    pub(crate) fn migrar(&mut self) {
        while self.mapa.vivas > 0 {
            let k = Valor::Num((self.arr.len() + 1) as f64);
            let x = self.mapa.quitar(&k);
            if x.es_nil() { break; }
            self.arr.push(x);
        }
    }
    /// el constructor de tablas: el valor posicional número i (1..) va derecho al arreglo, aunque sea nil
    pub(crate) fn poner_lista(&mut self, i: usize, v: Valor) {
        let len = self.arr.len();
        if i <= len { self.arr[i - 1] = v; return; }
        if i > len + 1 { self.arr.resize(i - 1, Valor::Nil); }
        self.arr.push(v);
    }
    /// al terminar el constructor: sin nil al final, y lo del hash que sigue al arreglo pasa a él
    pub(crate) fn cerrar_lista(&mut self) {
        while matches!(self.arr.last(), Some(Valor::Nil)) { self.arr.pop(); }
        if self.mapa.vivas > 0 {
            for i in 0..self.arr.len() {
                if self.mapa.vivas == 0 { break; }
                self.mapa.quitar(&Valor::Num((i + 1) as f64));
            }
            self.migrar();
        }
    }
    /// escribir con clave de texto
    pub fn set_str(&mut self, k: &str, v: Valor) { let _ = self.set(Valor::Cad(Cadena::interna(k.as_bytes())), v); }
    /// el largo (#t): el de la parte de arreglo, como la web
    #[inline] pub fn len(&self) -> usize { self.arr.len() }
    #[inline] pub fn is_empty(&self) -> bool { self.arr.is_empty() && self.mapa.vivas == 0 }
    pub fn meta(&self) -> Option<TablaRef> { self.meta.clone() }
    /// pone (o saca) el filtro de asignación de funciones con nombre de texto (ver `FiltroAsignacion`)
    pub fn set_filtro(&mut self, f: Option<FiltroAsignacion>) { self.filtro = f; }
    pub fn set_meta(&mut self, m: Option<TablaRef>) { self.meta = m; }
    /// la clave siguiente a `k` (next): primero el arreglo, después el hash en orden. None al final (o si la clave no
    /// está: la web termina el recorrido en ese caso)
    pub fn siguiente(&self, k: &Valor) -> Option<(Valor, Valor)> {
        let mut i_arr = 0usize;
        let mut i_hash = 0usize;
        match k {
            Valor::Nil => {}
            Valor::Num(n) if indice_arr(*n, self.arr.len()).is_some() => i_arr = *n as usize,
            _ => match self.mapa.entrada(k) {
                Some(e) => { i_arr = usize::MAX; i_hash = e + 1; }
                None => {
                    // (un entero que estaba en el arreglo y se achicó mientras se recorría)
                    if let Valor::Num(n) = k {
                        if *n >= 1.0 && n.fract() == 0.0 && *n < 1e15 { i_arr = *n as usize; } else { return None; }
                    } else {
                        return None;
                    }
                }
            },
        }
        if i_arr != usize::MAX {
            while i_arr < self.arr.len() {
                if !self.arr[i_arr].es_nil() { return Some((Valor::Num((i_arr + 1) as f64), self.arr[i_arr].clone())); }
                i_arr += 1;
            }
        }
        self.mapa.desde(i_hash).map(|(_, k, v)| (k.clone(), v.clone()))
    }
    /// recorrer todo (arreglo y hash) sin metamétodos
    pub fn pares(&self) -> Vec<(Valor, Valor)> {
        let mut out = Vec::with_capacity(self.arr.len() + self.mapa.vivas);
        for (i, v) in self.arr.iter().enumerate() {
            if !v.es_nil() { out.push((Valor::Num((i + 1) as f64), v.clone())); }
        }
        let mut i = 0;
        while let Some((j, k, v)) = self.mapa.desde(i) { out.push((k.clone(), v.clone())); i = j + 1; }
        out
    }
    /// vaciar (para cortar ciclos al cerrar el estado)
    pub(crate) fn vaciar(&mut self) -> Vec<Valor> {
        let mut out: Vec<Valor> = std::mem::take(&mut self.arr);
        for (k, v) in std::mem::take(&mut self.mapa.ent) { out.push(k); out.push(v); }
        self.mapa.limpiar();
        if let Some(m) = self.meta.take() { out.push(Valor::Tabla(m)); }
        out
    }
}

// ---------------- funciones ----------------

/// la firma de las funciones nativas: el estado, los argumentos y dónde dejar los resultados
pub type FnNativa = dyn Fn(&mut Estado, &[Valor], &mut Vec<Valor>) -> Result<(), Error>;

/// las nativas que la máquina trata aparte
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum Especial { No, Pcall, Xpcall, Ceder, Next, IpairsAux }

pub(crate) struct Nativa {
    pub(crate) f: Box<FnNativa>,
    pub(crate) esp: Especial,
}

pub(crate) struct Clausura {
    pub(crate) proto: Rc<Proto>,
    pub(crate) ups: Box<[Celda]>,
    /// el módulo del archivo (module("x", package.seeall)): las globales de las funciones del archivo van ahí
    pub(crate) entorno: Option<Celda>,
}

pub(crate) enum TipoFn { Lua(Clausura), Nativa(Nativa) }

pub struct Funcion {
    pub(crate) tipo: TipoFn,
    pub(crate) id: Cell<u32>,
}

impl Funcion {
    pub(crate) fn nativa(f: Box<FnNativa>, esp: Especial) -> Rc<Funcion> {
        Rc::new(Funcion { tipo: TipoFn::Nativa(Nativa { f, esp }), id: Cell::new(0) })
    }
    pub fn es_nativa(&self) -> bool { matches!(self.tipo, TipoFn::Nativa(_)) }
    pub(crate) fn especial(&self) -> Especial { if let TipoFn::Nativa(n) = &self.tipo { n.esp } else { Especial::No } }
}

// ---------------- userdata ----------------

/// Un objeto del anfitrión (Vector, Angle, Entity...) con su metatabla.
pub struct Udata {
    datos: RefCell<Box<dyn Any>>,
    pub(crate) meta: RefCell<Option<TablaRef>>,
    pub(crate) id: Cell<u32>,
}

impl Udata {
    pub fn nueva<T: Any>(v: T, meta: Option<TablaRef>) -> Rc<Udata> {
        Rc::new(Udata { datos: RefCell::new(Box::new(v)), meta: RefCell::new(meta), id: Cell::new(0) })
    }
    pub fn es<T: Any>(&self) -> bool { self.datos.borrow().is::<T>() }
    /// mirar los datos (None si no son de ese tipo)
    pub fn con<T: Any, R>(&self, f: impl FnOnce(&T) -> R) -> Option<R> { self.datos.borrow().downcast_ref::<T>().map(f) }
    /// cambiar los datos (None si no son de ese tipo)
    pub fn con_mut<T: Any, R>(&self, f: impl FnOnce(&mut T) -> R) -> Option<R> { self.datos.borrow_mut().downcast_mut::<T>().map(f) }
    /// una copia de los datos
    pub fn copia<T: Any + Clone>(&self) -> Option<T> { self.con(|x: &T| x.clone()) }
    pub fn meta(&self) -> Option<TablaRef> { self.meta.borrow().clone() }
    pub fn set_meta(&self, m: Option<TablaRef>) { *self.meta.borrow_mut() = m; }
}

// ---------------- corrutinas ----------------

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum EstadoCo { Suspendida, Corriendo, Muerta }

pub struct Corrutina {
    pub(crate) estado: EstadoCo,
    pub(crate) hilo: Hilo,
    pub(crate) f: Valor,
    pub(crate) iniciada: bool,
    pub(crate) id: Cell<u32>,
}
