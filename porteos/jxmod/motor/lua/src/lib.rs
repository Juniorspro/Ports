//! jxlua: el Lua de Garry's Mod de JXMod en Rust, el mismo que `juego/gmod_lua.js` de la versión web: Lua 5.1 (el de
//! GMod, LuaJIT) con la sintaxis que agrega GMod (`!=`, `&&`, `||`, `!`, `//`, `/* */`, `continue`), los mismos valores
//! (nil, booleanos, números f64, textos de bytes, tablas con parte de arreglo y de hash y metatablas, funciones con
//! varargs y varios resultados, userdata con metatabla para los objetos del juego) y la misma biblioteca. Un tope de
//! pasos por llamada corta los bucles infinitos con un error, y cada script sólo ve lo que le da el anfitrión.
//!
//! La web traduce cada archivo a JavaScript; acá se compila a un código de registros (como el de Lua 5.1) que corre una
//! máquina con su propia pila de marcos: las llamadas de Lua a Lua no usan la pila de Rust, y las corrutinas pueden
//! ceder adentro de un pcall (como en la web y en LuaJIT).
//!
//! Uso desde el anfitrión:
//! ```
//! use jxlua::{Estado, Valor};
//! let mut lua = Estado::nuevo();
//! lua.registrar("doble", |_, args| Ok(vec![Valor::Num(args.first().and_then(|v| v.num()).unwrap_or(0.0) * 2.0)]));
//! let r = lua.ejecutar(b"return doble(21)", "prueba.lua").unwrap();
//! assert_eq!(r[0].num(), Some(42.0));
//! ```
pub mod bib;
mod codigo;
mod compilar;
mod lexico;
pub mod numeros;
mod sintaxis;
pub mod valor;
mod vm;

use std::any::Any;
use std::cell::{Cell, RefCell};
use std::fmt;
use std::rc::Rc;

pub use valor::{Cadena, Celda, ClaveMala, FiltroAsignacion, FnNativa, Funcion, Tabla, TablaRef, Udata, Valor};
pub use vm::{Estado, MetodoFaltante, Reloj, Salida};

use valor::{Clausura, Especial, TipoFn};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum TipoError {
    Normal,
    /// el tope de pasos: no lo agarra pcall
    Duro,
    /// coroutine.yield (no es un error: corta hasta resume)
    Cesion,
}

/// Un error de Lua: el valor que se tiró (un texto con «archivo:línea:» casi siempre, o lo que se le pasó a error()).
#[derive(Clone)]
pub struct Error {
    pub valor: Valor,
    pub(crate) tipo: TipoError,
}

impl Error {
    /// un error con este mensaje (sin posición: para la posición, `Estado::error`)
    pub fn nuevo(msg: impl Into<String>) -> Error { Error { valor: Valor::from(msg.into()), tipo: TipoError::Normal } }
    /// un error con cualquier valor (como error(t) con una tabla)
    pub fn con_valor(v: Valor) -> Error { Error { valor: v, tipo: TipoError::Normal } }
    /// ¿es el del tope de pasos? (pcall no lo agarra)
    pub fn es_duro(&self) -> bool { self.tipo == TipoError::Duro }
    /// el mensaje como texto
    pub fn mensaje(&self) -> String {
        match &self.valor {
            Valor::Cad(s) => s.texto().into_owned(),
            Valor::Num(n) => numeros::fmt_num(*n),
            Valor::Nil => "nil".into(),
            Valor::Bool(b) => b.to_string(),
            otro => format!("({})", otro.tipo()),
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str(&self.mensaje()) }
}
impl fmt::Debug for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { write!(f, "Error({:?})", self.mensaje()) }
}
impl std::error::Error for Error {}

impl Estado {
    /// un Lua con la biblioteca de la web (base, string, table, math, os, bit, coroutine, debug; utf8 aparte con
    /// `bib::utf8::abrir`, porque en la web la pone la capa de GMod)
    pub fn nuevo() -> Estado {
        let mut e = Estado::sin_bibliotecas();
        bib::abrir_todas(&mut e);
        e
    }

    // ---------------- globales ----------------
    /// la tabla de globales (_G)
    pub fn globales(&self) -> TablaRef { self.globales.clone() }
    /// leer una global (sin metamétodos ni la capa)
    pub fn global(&self, nombre: &str) -> Valor { self.globales.borrow().get_str(nombre) }
    /// poner una global (sin metamétodos ni la capa)
    pub fn set_global(&mut self, nombre: &str, v: Valor) { self.globales.borrow_mut().set_str(nombre, v); }
    /// leer una global como la lee el código (con la capa del lado que corre y el __index de _G)
    pub fn leer_global_lua(&mut self, nombre: &str) -> Result<Valor, Error> { self.leer_global(&Valor::cadena(nombre)) }
    /// La capa de globales del lado que corre (como R.ov de la web): las globales nuevas que asignan los scripts van a
    /// esta tabla y se leen primero de ella; lo que ya estaba en _G es de todos. None: todo a _G.
    pub fn set_capa_globales(&mut self, capa: Option<TablaRef>) { self.capa = capa; }
    pub fn capa_globales(&self) -> Option<TablaRef> { self.capa.clone() }

    // ---------------- funciones nativas ----------------
    /// una función de Lua hecha en Rust (recibe los argumentos y devuelve los resultados)
    pub fn funcion<F>(f: F) -> Valor
    where F: Fn(&mut Estado, &[Valor]) -> Result<Vec<Valor>, Error> + 'static {
        Valor::Func(Funcion::nativa(Box::new(move |e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>| { out.extend(f(e, a)?); Ok(()) }), Especial::No))
    }
    /// lo mismo sin armar un Vec por llamada: los resultados se agregan a `out` (para lo que se llama mucho: Vector...)
    pub fn funcion_rapida<F>(f: F) -> Valor
    where F: Fn(&mut Estado, &[Valor], &mut Vec<Valor>) -> Result<(), Error> + 'static {
        Valor::Func(Funcion::nativa(Box::new(f), Especial::No))
    }
    /// poner una función nativa como global
    pub fn registrar<F>(&mut self, nombre: &str, f: F)
    where F: Fn(&mut Estado, &[Valor]) -> Result<Vec<Valor>, Error> + 'static {
        let v = Estado::funcion(f);
        self.set_global(nombre, v);
    }
    /// un userdata (objeto del anfitrión) con su metatabla
    pub fn udata<T: Any>(v: T, meta: Option<TablaRef>) -> Valor { Valor::Udata(Udata::nueva(v, meta)) }
    /// una tabla nueva
    pub fn tabla() -> TablaRef { Tabla::nueva_ref() }

    // ---------------- compilar y correr ----------------
    /// compilar un archivo: devuelve su función principal (o un error con «archivo:línea:»)
    pub fn compilar(&mut self, src: &[u8], nombre: &str) -> Result<Valor, Error> {
        // (lo mismo que ya se compiló con el mismo nombre se reusa, como LUA.cache de la web)
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for &b in src { h = (h ^ b as u64).wrapping_mul(0x100_0000_01b3); }
        let clave: (Rc<str>, usize, u64) = (Rc::from(nombre), src.len(), h);
        let (p, con_modulo) = match self.cache.get(&clave) {
            Some((p, m)) => (p.clone(), *m),
            None => {
                let fichas = lexico::lexico(src, nombre).map_err(Error::nuevo)?;
                let ast = sintaxis::parsear(fichas, nombre).map_err(Error::nuevo)?;
                let p = compilar::compilar(&ast, &clave.0).map_err(Error::nuevo)?;
                if self.cache.len() >= 4000 { self.cache.clear(); }
                self.cache.insert(clave, (p.clone(), ast.con_modulo));
                (p, ast.con_modulo)
            }
        };
        let entorno = if con_modulo { Some(Rc::new(RefCell::new(Valor::Nil))) } else { None };
        Ok(Valor::Func(Rc::new(Funcion { tipo: TipoFn::Lua(Clausura { proto: p, ups: Box::new([]), entorno }), id: Cell::new(0) })))
    }
    /// compilar y correr un archivo (con su propio tope de pasos)
    pub fn ejecutar(&mut self, src: &[u8], nombre: &str) -> Result<Vec<Valor>, Error> {
        let f = self.compilar(src, nombre)?;
        self.llamar(&f, &[])
    }
    /// Llamar a una función de Lua (o nativa) desde el anfitrión, con su propio tope de pasos (como gmLlamar de la
    /// web: el contador vuelve a 0 y al terminar queda como estaba).
    pub fn llamar(&mut self, f: &Valor, args: &[Valor]) -> Result<Vec<Valor>, Error> {
        let n0 = self.pasos;
        self.pasos = 0;
        let r = self.llamar_v(f, args, "callback");
        self.pasos = n0;
        r
    }
    /// Llamar sin reiniciar el tope de pasos (para las nativas que llaman a Lua: comparten el tope de quien las llamó).
    pub fn llamar_aqui(&mut self, f: &Valor, args: &[Valor]) -> Result<Vec<Valor>, Error> { self.llamar_v(f, args, "callback") }
    /// el primer resultado de una llamada (sin armar un Vec)
    pub fn llamar_uno(&mut self, f: &Valor, args: &[Valor]) -> Result<Valor, Error> { self.llamar_1(f, args, "callback") }

    // ---------------- ajustes ----------------
    /// a dónde va lo que imprime print (una línea por llamada, sin el fin de línea)
    pub fn set_salida(&mut self, f: impl FnMut(&[u8]) + 'static) { self.salida = Box::new(f); }
    /// cuántos pasos (entradas a funciones y vueltas de bucles) puede dar una llamada antes de cortarse (2e7, como la web)
    pub fn set_limite_pasos(&mut self, n: u64) { self.limite = n; }
    pub fn pasos(&self) -> u64 { self.pasos }
    /// cuántas veces se puede volver a entrar a Lua desde Rust una dentro de otra (metamétodos que llaman a Lua que usa
    /// metamétodos...; más: «stack overflow»). Cada vuelta usa unos 3 a 5 KB de la pila del hilo: 100 (lo de fábrica)
    /// entra en medio MB; con un hilo de 2 MB se puede subir a 300
    pub fn set_max_anidado(&mut self, n: u32) { self.max_prof = n.max(4); }
    /// lo que se hace cuando un método de un userdata no existe (R.metodoFalta de la web): devuelve la función a llamar
    pub fn set_metodo_faltante(&mut self, f: Option<MetodoFaltante>) { self.metodo_faltante = f; }
    /// la metatabla de los textos (su __index es la tabla string)
    pub fn meta_cadenas(&self) -> Option<TablaRef> { self.meta_cad.clone() }
    /// la diferencia con UTC en segundos para os.date/os.time (por defecto la del sistema)
    pub fn set_zona_horaria(&mut self, segundos: i64) { self.zona = segundos; }
    /// el reloj de os.time/os.date/os.clock (el del juego, o uno fijo para pruebas); None: el del sistema
    pub fn set_reloj(&mut self, r: Option<vm::Reloj>) { self.reloj = r; }
    /// un número al azar en [0, 1): el mismo generador de math.random (para que el anfitrión comparta la secuencia)
    pub fn azar(&mut self) -> f64 { bib::mates::azar(self) }
    /// la semilla del generador de math.random (xorshift64*; 0 no vale)
    pub fn set_semilla(&mut self, s: u64) { self.azar = if s == 0 { 1 } else { s }; }

    // ---------------- conversiones ----------------
    /// tostring de Lua (con __tostring)
    pub fn a_texto(&mut self, v: &Valor) -> Result<String, Error> { Ok(self.tostring(v)?.texto().into_owned()) }
    /// el número de un valor como lo convierte la aritmética (números y textos numéricos)
    pub fn a_numero(v: &Valor) -> Option<f64> { vm::a_num(v) }
}

impl Drop for Estado {
    /// corta los ciclos (tablas que se apuntan, funciones que capturan tablas que las guardan...) para que Rc libere todo
    fn drop(&mut self) {
        let mut pend: Vec<Valor> = vec![Valor::Tabla(self.globales.clone())];
        if let Some(m) = self.meta_cad.take() { pend.push(Valor::Tabla(m)); }
        if let Some(c) = self.capa.take() { pend.push(Valor::Tabla(c)); }
        pend.extend(self.hilo.pila.drain(..));
        for c in self.hilo.celdas.drain(..).flatten() { pend.push(std::mem::take(&mut *c.borrow_mut())); }
        self.hilo.marcos.clear();
        let mut vistos = std::collections::HashSet::new();
        while let Some(v) = pend.pop() {
            match v {
                Valor::Tabla(t) => {
                    if vistos.insert(Rc::as_ptr(&t) as usize) { let vals = t.borrow_mut().vaciar(); pend.extend(vals); }
                }
                Valor::Func(f) => {
                    if vistos.insert(Rc::as_ptr(&f) as *const u8 as usize) {
                        if let TipoFn::Lua(c) = &f.tipo {
                            for u in c.ups.iter() { pend.push(std::mem::take(&mut *u.borrow_mut())); }
                            if let Some(e) = &c.entorno { pend.push(std::mem::take(&mut *e.borrow_mut())); }
                        }
                    }
                }
                Valor::Udata(u) => {
                    if vistos.insert(Rc::as_ptr(&u) as *const u8 as usize) { if let Some(m) = u.meta.borrow_mut().take() { pend.push(Valor::Tabla(m)); } }
                }
                Valor::Hilo(h) => {
                    if vistos.insert(Rc::as_ptr(&h) as *const u8 as usize) {
                        if let Ok(mut c) = h.try_borrow_mut() {
                            pend.push(std::mem::take(&mut c.f));
                            pend.extend(c.hilo.pila.drain(..));
                            for x in c.hilo.celdas.drain(..).flatten() { pend.push(std::mem::take(&mut *x.borrow_mut())); }
                            c.hilo.marcos.clear();
                        }
                    }
                }
                _ => {}
            }
        }
    }
}

impl Estado {
    /// el código de una función de Lua (para depurar el compilador)
    #[doc(hidden)]
    pub fn desensamblar(f: &Valor) -> String {
        fn uno(p: &codigo::Proto, out: &mut String, prof: usize) {
            let sang = "  ".repeat(prof);
            out.push_str(&format!("{}función (línea {}, params {}, vararg {}, regs {}, celdas {}, ups {:?})\n", sang, p.linea, p.n_params, p.es_vararg, p.max_regs, p.n_celdas, p.ups));
            for (i, op) in p.codigo.iter().enumerate() { out.push_str(&format!("{}  {:3} [{}] {:?}\n", sang, i, p.lineas[i], op)); }
            out.push_str(&format!("{}  k: {:?}\n", sang, p.k));
            for h in &p.hijos { uno(h, out, prof + 1); }
        }
        let mut s = String::new();
        if let Valor::Func(f) = f { if let TipoFn::Lua(c) = &f.tipo { uno(&c.proto, &mut s, 0); } }
        s
    }
}
