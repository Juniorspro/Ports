//! La máquina: el estado, el bucle que corre el código, las llamadas (las de Lua a Lua no usan la pila de Rust: hay
//! una pila de marcos propia, así una corrutina puede ceder aunque esté adentro de un pcall, como en la web), los
//! metamétodos y los errores con «archivo:línea:».
use std::cell::{Cell, RefCell};
use std::mem;
use std::rc::Rc;
use std::time::Instant;

use crate::codigo::*;
use crate::numeros;
use crate::valor::*;
use crate::{Error, TipoError};

/// cuántos marcos de Lua puede haber (más: «stack overflow»)
pub(crate) const MAX_MARCOS: usize = 16000;
/// cuántas veces se puede volver a entrar a la máquina desde Rust (metamétodos, sort, gsub, resume...), por defecto:
/// cada vuelta usa unos 3 a 5 KB de la pila de Rust; con 100 alcanza medio MB (los hilos de Rust tienen 2 MB)
pub(crate) const MAX_PROF: u32 = if cfg!(debug_assertions) { 30 } else { 100 };

#[derive(Clone)]
pub(crate) enum Prot {
    No,
    /// llamado por pcall: al volver se le agrega true adelante (y se ajusta a esa cantidad de resultados)
    Pcall(i32),
    Xpcall(i32, Box<Valor>),
}

pub(crate) struct Marco {
    /// la función que corre: no se cuenta la referencia porque el valor de la función queda en pila[fpos] mientras el
    /// marco vive (ahí la puso quien llamó y recién se pisa con los resultados, cuando el marco ya salió)
    pub(crate) func: *const Funcion,
    pub(crate) base: usize,
    pub(crate) pc: usize,
    pub(crate) fpos: usize,
    pub(crate) nres: i32,
    pub(crate) va_base: usize,
    pub(crate) va_n: usize,
    pub(crate) cbase: usize,
    pub(crate) prot: Prot,
    /// hasta dónde tiene que llegar la pila mientras este marco esté vivo (su ventana y las de los de abajo)
    pub(crate) tope_marco: usize,
}

/// la pila de un hilo (el principal o una corrutina)
#[derive(Default)]
pub struct Hilo {
    pub(crate) pila: Vec<Valor>,
    pub(crate) marcos: Vec<Marco>,
    pub(crate) celdas: Vec<Option<Celda>>,
    pub(crate) tope: usize,
    /// cuántas veces se volvió a entrar a la máquina desde Rust en este hilo (con más de 0 no se puede ceder)
    pub(crate) anidado: u32,
    pub(crate) cesion: Option<(usize, i32)>,
    pub(crate) cedidos: Vec<Valor>,
}

impl Marco {
    #[inline]
    pub(crate) fn funcion(&self) -> &Funcion {
        // SAFETY: ver `func`
        unsafe { &*self.func }
    }
}

#[inline]
pub(crate) fn proto_de(f: &Funcion) -> &Rc<Proto> {
    match &f.tipo { TipoFn::Lua(c) => &c.proto, TipoFn::Nativa(_) => unreachable!() }
}

/// los textos que la máquina usa siempre (nombres de metamétodos)
pub(crate) struct Nombres {
    pub index: Rc<Cadena>,
    pub newindex: Rc<Cadena>,
    pub call: Rc<Cadena>,
    pub add: Rc<Cadena>,
    pub sub: Rc<Cadena>,
    pub mul: Rc<Cadena>,
    pub div: Rc<Cadena>,
    pub mod_: Rc<Cadena>,
    pub pow: Rc<Cadena>,
    pub unm: Rc<Cadena>,
    pub len: Rc<Cadena>,
    pub concat: Rc<Cadena>,
    pub eq: Rc<Cadena>,
    pub lt: Rc<Cadena>,
    pub le: Rc<Cadena>,
    pub tostring: Rc<Cadena>,
    pub metatable: Rc<Cadena>,
    pub pairs: Rc<Cadena>,
    tipos: [Rc<Cadena>; 8],
}

impl Nombres {
    fn nuevos() -> Nombres {
        let c = |s: &str| Cadena::interna(s.as_bytes());
        Nombres {
            index: c("__index"), newindex: c("__newindex"), call: c("__call"), add: c("__add"), sub: c("__sub"),
            mul: c("__mul"), div: c("__div"), mod_: c("__mod"), pow: c("__pow"), unm: c("__unm"), len: c("__len"),
            concat: c("__concat"), eq: c("__eq"), lt: c("__lt"), le: c("__le"), tostring: c("__tostring"),
            metatable: c("__metatable"), pairs: c("__pairs"),
            tipos: [c("nil"), c("boolean"), c("number"), c("string"), c("table"), c("function"), c("userdata"), c("thread")],
        }
    }
    /// el nombre del tipo (ya armado: type() no crea textos)
    pub(crate) fn tipo(&self, v: &Valor) -> &Rc<Cadena> {
        &self.tipos[match v {
            Valor::Nil => 0, Valor::Bool(_) => 1, Valor::Num(_) => 2, Valor::Cad(_) => 3, Valor::Tabla(_) => 4,
            Valor::Func(_) => 5, Valor::Udata(_) => 6, Valor::Hilo(_) => 7,
        }]
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Arit { Sumar, Restar, Mult, Div, Mod, Pot }

/// el % de la web: x - floor(x/y)*y (con y = 0: nan)
#[inline]
pub(crate) fn modulo(x: f64, y: f64) -> f64 { if y == 0.0 { f64::NAN } else { x - numeros::piso(x / y) * y } }
/// Math.pow de JavaScript (1 a la ±infinito da nan)
#[inline]
pub(crate) fn potencia(x: f64, y: f64) -> f64 { if y.is_infinite() && x.abs() == 1.0 { f64::NAN } else { x.powf(y) } }

impl Arit {
    #[inline]
    fn aplicar(self, x: f64, y: f64) -> f64 {
        match self { Arit::Sumar => x + y, Arit::Restar => x - y, Arit::Mult => x * y, Arit::Div => x / y, Arit::Mod => modulo(x, y), Arit::Pot => potencia(x, y) }
    }
}

/// el número de un valor para la aritmética (aNum: números y textos que parecen números)
#[inline]
pub(crate) fn a_num(v: &Valor) -> Option<f64> {
    match v { Valor::Num(n) => Some(*n), Valor::Cad(s) => numeros::texto_a_num(s.bytes()), _ => None }
}

/// de dónde sacar el nombre para «attempt to call 'x'»
#[derive(Clone, Copy)]
pub(crate) enum Nombre { Codigo, Fijo(&'static str) }

pub type Salida = Box<dyn FnMut(&[u8])>;
/// el reloj que pone el anfitrión: (milisegundos desde 1970, segundos para os.clock)
pub type Reloj = Rc<dyn Fn() -> (f64, f64)>;
pub type MetodoFaltante = Rc<dyn Fn(&mut Estado, &Valor, &Rc<Cadena>) -> Option<Valor>>;

/// Un Lua: las globales, la pila y lo que el anfitrión le dio.
pub struct Estado {
    pub(crate) hilo: Hilo,
    pub(crate) globales: TablaRef,
    pub(crate) capa: Option<TablaRef>,
    pub(crate) meta_cad: Option<TablaRef>,
    pub(crate) pasos: u64,
    pub(crate) limite: u64,
    pub(crate) prof: u32,
    pub(crate) max_prof: u32,
    pub(crate) sig_id: u32,
    pub(crate) salida: Salida,
    pub(crate) co_pila: Vec<Rc<RefCell<Corrutina>>>,
    pub(crate) bufs: Vec<Vec<Valor>>,
    pub(crate) metodo_faltante: Option<MetodoFaltante>,
    pub(crate) t0: Instant,
    pub(crate) dumps: Vec<(std::rc::Weak<Funcion>, u32)>,
    pub(crate) n: Nombres,
    pub(crate) azar: u64,
    pub(crate) zona: i64,
    /// el reloj del anfitrión (ms desde 1970, segundos de os.clock); None: el del sistema
    pub(crate) reloj: Option<Reloj>,
    pub(crate) fn_next: Valor,
    /// lo ya compilado (como LUA.cache de la web): por nombre, largo y hash del fuente
    pub(crate) cache: std::collections::HashMap<(Rc<str>, usize, u64), (Rc<Proto>, bool), crate::valor::FxBuild>,
    pub(crate) n_dump: u32,
    pub(crate) fn_ipairs: Valor,
}

impl Estado {
    /// un estado vacío (sin bibliotecas)
    pub fn sin_bibliotecas() -> Estado {
        Estado {
            hilo: Hilo::default(),
            globales: Tabla::nueva_ref(),
            capa: None,
            meta_cad: None,
            pasos: 0,
            limite: 20_000_000,
            prof: 0,
            max_prof: MAX_PROF,
            sig_id: 0x1000_0000,
            salida: Box::new(|s: &[u8]| { use std::io::Write; let mut o = std::io::stdout(); let _ = o.write_all(s); let _ = o.write_all(b"\n"); }),
            co_pila: vec![],
            bufs: vec![],
            metodo_faltante: None,
            t0: Instant::now(),
            dumps: vec![],
            n: Nombres::nuevos(),
            azar: 0x853c_49e6_748f_ea9b ^ (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(1)),
            zona: crate::bib::os::zona_local(),
            reloj: None,
            fn_next: Valor::Nil,
            cache: Default::default(),
            n_dump: 0,
            fn_ipairs: Valor::Nil,
        }
    }

    // ---------------- posiciones y errores ----------------
    /// «archivo:línea» de lo que está corriendo
    pub fn donde(&self) -> String {
        match self.hilo.marcos.last() {
            Some(m) => { let p = proto_de(m.funcion()); format!("{}:{}", p.archivo, p.linea_de(m.pc.saturating_sub(1))) }
            None => "?:0".into(),
        }
    }
    /// un error con la posición de lo que está corriendo («archivo:línea: msg»), como `err` de la web
    #[inline(never)]
    pub fn error(&self, msg: &str) -> Error { Error::nuevo(format!("{}: {}", self.donde(), msg)) }
    #[inline(never)]
    pub(crate) fn error_largo(&self) -> Error {
        Error { valor: Valor::from(format!("{}: el script tardó demasiado (¿bucle infinito?)", self.donde())), tipo: TipoError::Duro }
    }
    #[inline(never)]
    fn error_llamar(&self, f: &Valor, nombre: Nombre) -> Error {
        let n: Option<String> = match nombre {
            Nombre::Fijo(s) => Some(s.to_string()),
            Nombre::Codigo => self.hilo.marcos.last().and_then(|m| {
                proto_de(m.funcion()).nombre_llamada(m.pc.saturating_sub(1)).and_then(|v| v.texto().map(|s| s.into_owned()))
            }),
        };
        match n {
            Some(n) if n != "?" => self.error(&format!("attempt to call '{}' (a {} value)", n, f.tipo())),
            _ => self.error(&format!("attempt to call (a {} value)", f.tipo())),
        }
    }
    #[inline(never)]
    fn error_indexar(&self, o: &Valor, k: &Valor) -> Error {
        let campo = match k { Valor::Cad(s) => format!(" (field '{}')", s.texto()), _ => String::new() };
        self.error(&format!("attempt to index a {} value{}", o.tipo(), campo))
    }

    // ---------------- metatablas ----------------
    #[inline]
    pub(crate) fn meta_de(&self, v: &Valor) -> Option<TablaRef> {
        match v {
            Valor::Tabla(t) => t.borrow().meta.clone(),
            Valor::Udata(u) => u.meta.borrow().clone(),
            Valor::Cad(_) => self.meta_cad.clone(),
            _ => None,
        }
    }
    #[inline]
    pub(crate) fn meta_campo(&self, v: &Valor, ev: &Rc<Cadena>) -> Valor {
        match self.meta_de(v) { Some(m) => m.borrow().get_cad(ev).cloned().unwrap_or(Valor::Nil), None => Valor::Nil }
    }
    /// el id que se muestra en tostring (se reparte la primera vez, de a 0x28, como la web)
    pub(crate) fn id_de(&mut self, v: &Valor) -> u32 {
        let celda_id = |c: &Cell<u32>, sig: &mut u32| { if c.get() == 0 { *sig = sig.wrapping_add(0x28); c.set(*sig); } c.get() };
        match v {
            Valor::Tabla(t) => celda_id(&t.borrow().id, &mut self.sig_id),
            Valor::Func(f) => celda_id(&f.id, &mut self.sig_id),
            Valor::Udata(u) => celda_id(&u.id, &mut self.sig_id),
            Valor::Hilo(h) => celda_id(&h.borrow().id, &mut self.sig_id),
            _ => 0,
        }
    }

    // ---------------- llamadas ----------------
    /// Prepara la llamada a pila[fpos] con nargs argumentos. Si es de Lua empuja su marco y devuelve true (hay que
    /// correrlo); si es nativa la corre y deja los resultados desde fpos.
    #[inline(never)]
    pub(crate) fn precall(&mut self, fpos: usize, mut nargs: usize, nres: i32, nombre: Nombre) -> Result<bool, Error> {
        let mut vueltas = 0;
        loop {
            let f = match &self.hilo.pila[fpos] {
                Valor::Func(f) => f.clone(),
                otro => {
                    let h = self.meta_campo(otro, &self.n.call);
                    if h.es_nil() || vueltas > 8 { return Err(self.error_llamar(&self.hilo.pila[fpos], nombre)); }
                    self.hilo.pila.insert(fpos, h);
                    nargs += 1;
                    vueltas += 1;
                    continue;
                }
            };
            return match &f.tipo {
                TipoFn::Lua(_) => { self.entrar_lua(fpos, nargs, nres, &f, Prot::No)?; Ok(true) }
                TipoFn::Nativa(n) => match n.esp {
                    Especial::Pcall => self.pcall(fpos, nargs, nres, false),
                    Especial::Xpcall => self.pcall(fpos, nargs, nres, true),
                    Especial::Ceder => Err(self.ceder(fpos, nargs, nres)),
                    _ => { self.llamar_nativa(fpos, nargs, nres, &f)?; Ok(false) }
                },
            };
        }
    }

    #[inline]
    pub(crate) fn entrar_lua(&mut self, fpos: usize, nargs: usize, nres: i32, f: &Rc<Funcion>, prot: Prot) -> Result<(), Error> {
        self.entrar_lua_ptr(fpos, nargs, nres, Rc::as_ptr(f), prot)
    }

    /// entrar a una función de Lua cuyo valor está en pila[fpos] (o se mantiene vivo de otra forma mientras corre)
    #[inline(always)]
    pub(crate) fn entrar_lua_ptr(&mut self, fpos: usize, nargs: usize, nres: i32, fptr: *const Funcion, prot: Prot) -> Result<(), Error> {
        self.pasos += 1;
        if self.pasos > self.limite { return Err(self.error_largo()); }
        if self.hilo.marcos.len() >= MAX_MARCOS { return Err(Error::nuevo("stack overflow")); }
        // SAFETY: la función está viva (en pila[fpos] o en quien llama); el Proto es de ella, no de la pila
        let p: &Proto = proto_de(unsafe { &*fptr });
        let np = p.n_params;
        let h = &mut self.hilo;
        let (base, va_base, va_n);
        if p.es_vararg {
            base = fpos + 1 + nargs;
            va_n = nargs.saturating_sub(np);
            va_base = fpos + 1 + np.min(nargs);
            let fin = base + p.max_regs;
            if h.pila.len() < fin { h.pila.resize(fin, Valor::Nil); }
            for i in 0..np {
                let v = if i < nargs { mem::take(&mut h.pila[fpos + 1 + i]) } else { Valor::Nil };
                h.pila[base + i] = v;
            }
        } else {
            base = fpos + 1;
            va_base = base;
            va_n = 0;
            let fin = base + p.max_regs.max(nargs);
            if h.pila.len() < fin { h.pila.resize(fin, Valor::Nil); }
            if nargs < np { for i in nargs..np { h.pila[base + i] = Valor::Nil; } }
        }
        let cbase = h.celdas.len();
        if p.n_celdas > 0 { h.celdas.resize(cbase + p.n_celdas, None); }
        let nres_marco = if matches!(prot, Prot::No) { nres } else { -1 };
        let tope_marco = (base + p.max_regs.max(nargs)).max(h.marcos.last().map(|m| m.tope_marco).unwrap_or(0));
        h.marcos.push(Marco { func: fptr, base, pc: 0, fpos, nres: nres_marco, va_base, va_n, cbase, prot, tope_marco });
        Ok(())
    }

    #[inline]
    fn llamar_nativa(&mut self, fpos: usize, nargs: usize, nres: i32, f: &Rc<Funcion>) -> Result<(), Error> {
        let nat = match &f.tipo { TipoFn::Nativa(n) => n, _ => unreachable!() };
        let mut out = self.bufs.pop().unwrap_or_default();
        let r = if nargs <= 8 {
            // (los argumentos se mueven a un arreglo en la pila de Rust: sin pedir memoria ni tocar lo que no se usa)
            let mut a: [mem::MaybeUninit<Valor>; 8] = [const { mem::MaybeUninit::uninit() }; 8];
            debug_assert!(fpos + nargs < self.hilo.pila.len());
            for (i, x) in a.iter_mut().enumerate().take(nargs) {
                x.write(mem::take(unsafe { self.hilo.pila.get_unchecked_mut(fpos + 1 + i) }));
            }
            // SAFETY: los primeros nargs están escritos
            let args: &[Valor] = unsafe { std::slice::from_raw_parts(a.as_ptr() as *const Valor, nargs) };
            let r = (nat.f)(self, args, &mut out);
            for x in a.iter_mut().take(nargs) { unsafe { x.assume_init_drop() } }
            r
        } else {
            let a: Vec<Valor> = self.hilo.pila[fpos + 1..fpos + 1 + nargs].iter_mut().map(mem::take).collect();
            (nat.f)(self, &a, &mut out)
        };
        if r.is_ok() {
            if nres == 1 && out.len() == 1 {
                let v = out.pop().unwrap();
                poner_en(&mut self.hilo.pila[fpos], v);
            } else {
                self.colocar(fpos, &mut out, nres);
            }
        }
        out.clear();
        self.bufs.push(out);
        r
    }

    /// dejar vals desde pos ajustados a nres (-1: todos, y el tope queda al final)
    #[inline(never)]
    pub(crate) fn colocar(&mut self, pos: usize, vals: &mut Vec<Valor>, nres: i32) {
        let n = vals.len();
        let h = &mut self.hilo;
        if nres < 0 {
            if h.pila.len() < pos + n { h.pila.resize(pos + n, Valor::Nil); }
            for (i, v) in vals.drain(..).enumerate() { h.pila[pos + i] = v; }
            h.tope = pos + n;
        } else {
            let nres = nres as usize;
            if h.pila.len() < pos + nres { h.pila.resize(pos + nres, Valor::Nil); }
            let mut it = vals.drain(..);
            for i in 0..nres { h.pila[pos + i] = it.next().unwrap_or(Valor::Nil); }
        }
    }

    /// pcall y xpcall: si la función es de Lua, un marco protegido (se puede ceder adentro); si no, en Rust
    #[inline(never)]
    fn pcall(&mut self, fpos: usize, nargs: usize, nres: i32, xp: bool) -> Result<bool, Error> {
        let nombre = if xp { "xpcall" } else { "pcall" };
        if nargs == 0 {
            let e = self.error(&format!("attempt to call '{}' (a nil value)", nombre));
            let mut v = vec![Valor::Bool(false), e.valor];
            self.colocar(fpos, &mut v, nres);
            return Ok(false);
        }
        let fn_pos = fpos + 1;
        let mut n = nargs - 1;
        let manejador = if xp {
            let h = if nargs >= 2 { self.hilo.pila.remove(fpos + 2) } else { Valor::Nil };
            self.hilo.pila.push(Valor::Nil);
            n = nargs.saturating_sub(2);
            Some(h)
        } else {
            None
        };
        if let Valor::Func(f) = &self.hilo.pila[fn_pos] {
            if let TipoFn::Lua(_) = &f.tipo {
                let f = f.clone();
                let prot = match manejador { Some(h) => Prot::Xpcall(nres, Box::new(h)), None => Prot::Pcall(nres) };
                self.entrar_lua(fn_pos, n, -1, &f, prot)?;
                return Ok(true);
            }
        }
        // (nativa o con __call)
        let nivel = self.hilo.marcos.len();
        self.hilo.anidado += 1;
        self.prof += 1;
        let r = if self.prof > self.max_prof { Err(Error::nuevo("stack overflow")) } else {
            match self.precall(fn_pos, n, -1, Nombre::Fijo(nombre)) { Ok(true) => self.bucle(nivel), Ok(false) => Ok(()), Err(e) => Err(e) }
        };
        self.prof -= 1;
        self.hilo.anidado -= 1;
        match r {
            Ok(()) => {
                self.hilo.pila[fpos] = Valor::Bool(true);
                let total = self.hilo.tope - fpos;
                if nres >= 0 {
                    let nres = nres as usize;
                    if self.hilo.pila.len() < fpos + nres { self.hilo.pila.resize(fpos + nres, Valor::Nil); }
                    for i in total..nres { self.hilo.pila[fpos + i] = Valor::Nil; }
                }
                Ok(false)
            }
            Err(e) if e.tipo == TipoError::Normal => {
                let mut v = vec![Valor::Bool(false)];
                match manejador {
                    Some(h) => v.extend(self.llamar_v(&h, &[e.valor], "xpcall")?),
                    None => v.push(e.valor),
                }
                self.colocar(fpos, &mut v, nres);
                Ok(false)
            }
            Err(e) => Err(e),
        }
    }

    /// coroutine.yield: guarda dónde van a ir los valores de la vuelta y corta hasta resume
    #[inline(never)]
    fn ceder(&mut self, fpos: usize, nargs: usize, nres: i32) -> Error {
        if self.co_pila.is_empty() { return self.error("attempt to yield from outside a coroutine"); }
        if self.hilo.anidado > 0 { return self.error("attempt to yield across a C-call boundary"); }
        let vals: Vec<Valor> = self.hilo.pila[fpos + 1..fpos + 1 + nargs].iter_mut().map(mem::take).collect();
        self.hilo.cedidos = vals;
        self.hilo.cesion = Some((fpos, nres));
        Error { valor: Valor::Nil, tipo: TipoError::Cesion }
    }

    /// llamar desde Rust (sin cambiar el tope de pasos): todos los resultados
    pub(crate) fn llamar_v(&mut self, f: &Valor, args: &[Valor], nombre: &'static str) -> Result<Vec<Valor>, Error> {
        let fpos = self.llamar_pila(f, args, nombre)?;
        let tope = self.hilo.tope;
        let v: Vec<Valor> = self.hilo.pila.drain(fpos..tope).collect();
        self.hilo.pila.truncate(fpos);
        Ok(v)
    }
    /// llamar desde Rust y quedarse con el primer resultado
    pub(crate) fn llamar_1(&mut self, f: &Valor, args: &[Valor], nombre: &'static str) -> Result<Valor, Error> {
        let fpos = self.llamar_pila(f, args, nombre)?;
        let v = if self.hilo.tope > fpos { mem::take(&mut self.hilo.pila[fpos]) } else { Valor::Nil };
        self.hilo.pila.truncate(fpos);
        Ok(v)
    }
    /// deja los resultados en pila[fpos..tope] (y devuelve fpos)
    fn llamar_pila(&mut self, f: &Valor, args: &[Valor], nombre: &'static str) -> Result<usize, Error> {
        if self.prof >= self.max_prof { return Err(Error::nuevo("stack overflow")); }
        let fpos = self.hilo.pila.len();
        self.hilo.pila.push(f.clone());
        self.hilo.pila.extend_from_slice(args);
        self.prof += 1;
        self.hilo.anidado += 1;
        let nivel = self.hilo.marcos.len();
        let r = match self.precall(fpos, args.len(), -1, Nombre::Fijo(nombre)) {
            Ok(true) => self.bucle(nivel),
            Ok(false) => Ok(()),
            Err(e) => Err(e),
        };
        self.prof -= 1;
        self.hilo.anidado -= 1;
        match r {
            Ok(()) => Ok(fpos),
            Err(e) => { self.hilo.pila.truncate(fpos); Err(e) }
        }
    }

    // ---------------- corrutinas ----------------
    /// coroutine.resume: Ok(Ok(valores)) si anduvo (cedió o terminó), Ok(Err(mensaje)) si dio error
    pub(crate) fn reanudar(&mut self, co: &Rc<RefCell<Corrutina>>, args: Vec<Valor>) -> Result<Result<Vec<Valor>, Valor>, Error> {
        {
            let c = co.borrow();
            match c.estado {
                EstadoCo::Muerta => return Ok(Err(Valor::from("cannot resume dead coroutine"))),
                EstadoCo::Corriendo => return Ok(Err(Valor::from("cannot resume non-suspended coroutine"))),
                EstadoCo::Suspendida => {}
            }
        }
        if self.prof >= self.max_prof { return Err(Error::nuevo("stack overflow")); }
        let (hilo_co, f, iniciada) = {
            let mut c = co.borrow_mut();
            c.estado = EstadoCo::Corriendo;
            let ini = c.iniciada;
            c.iniciada = true;
            (mem::take(&mut c.hilo), c.f.clone(), ini)
        };
        let viejo = mem::replace(&mut self.hilo, hilo_co);
        self.co_pila.push(co.clone());
        let n0 = self.pasos;
        self.prof += 1;
        let r = if !iniciada {
            self.hilo.pila.clear();
            self.hilo.pila.push(f);
            let n = args.len();
            self.hilo.pila.extend(args);
            match self.precall(0, n, -1, Nombre::Fijo("coroutine")) { Ok(true) => self.bucle(0), Ok(false) => Ok(()), Err(e) => Err(e) }
        } else {
            let (pos, nres) = self.hilo.cesion.take().unwrap_or((0, -1));
            let mut a = args;
            self.colocar(pos, &mut a, nres);
            self.bucle(0)
        };
        self.prof -= 1;
        self.pasos = n0;
        self.co_pila.pop();
        let mut hilo_co = mem::replace(&mut self.hilo, viejo);
        let mut c = co.borrow_mut();
        match r {
            Ok(()) => {
                let tope = hilo_co.tope.min(hilo_co.pila.len());
                let vals = hilo_co.pila[..tope].to_vec();
                c.estado = EstadoCo::Muerta;
                Ok(Ok(vals))
            }
            Err(e) if e.tipo == TipoError::Cesion => {
                let vals = mem::take(&mut hilo_co.cedidos);
                c.estado = EstadoCo::Suspendida;
                c.hilo = hilo_co;
                Ok(Ok(vals))
            }
            Err(e) if e.tipo == TipoError::Duro => { c.estado = EstadoCo::Muerta; Err(e) }
            Err(e) => { c.estado = EstadoCo::Muerta; Ok(Err(e.valor)) }
        }
    }

    // ---------------- el bucle ----------------
    /// correr hasta que vuelva el marco número `nivel` (los errores que no agarra un pcall de adentro salen)
    pub(crate) fn bucle(&mut self, nivel: usize) -> Result<(), Error> {
        let mut r = self.correr(nivel);
        loop {
            let e = match r { Ok(()) => return Ok(()), Err(e) => e };
            if e.tipo == TipoError::Cesion { return Err(e); }
            let mut prot = None;
            if e.tipo == TipoError::Normal {
                let mut i = self.hilo.marcos.len();
                while i > nivel {
                    i -= 1;
                    if !matches!(self.hilo.marcos[i].prot, Prot::No) { prot = Some(i); break; }
                }
            }
            let i = match prot {
                None => { self.desenrollar(nivel); return Err(e); }
                Some(i) => i,
            };
            let m = self.hilo.marcos.drain(i..).next().unwrap();
            self.hilo.celdas.truncate(m.cbase);
            let dest = m.fpos - 1;
            let (nres, vals) = match m.prot {
                Prot::Pcall(n) => (n, Ok(vec![Valor::Bool(false), e.valor])),
                Prot::Xpcall(n, h) => (n, self.llamar_v(&*h, &[e.valor], "xpcall").map(|v| { let mut x = vec![Valor::Bool(false)]; x.extend(v); x })),
                Prot::No => unreachable!(),
            };
            match vals {
                Ok(mut vals) => {
                    self.colocar(dest, &mut vals, nres);
                    if let Some(c) = self.hilo.marcos.last() { let ext = c.tope_marco; if self.hilo.pila.len() < ext { self.hilo.pila.resize(ext, Valor::Nil); } }
                    if self.hilo.marcos.len() == nivel { return Ok(()); }
                    r = self.correr(nivel);
                }
                Err(e2) => { r = Err(e2); }
            }
        }
    }
    fn desenrollar(&mut self, nivel: usize) {
        if self.hilo.marcos.len() > nivel {
            let cb = self.hilo.marcos[nivel].cbase;
            self.hilo.marcos.truncate(nivel);
            self.hilo.celdas.truncate(cb);
        }
    }

    fn correr(&mut self, nivel: usize) -> Result<(), Error> {
        'marco: loop {
            let mi = self.hilo.marcos.len() - 1;
            let (fp, base, cbase, pc0) = {
                // SAFETY: mi es el último marco
                let m = unsafe { self.hilo.marcos.get_unchecked(mi) };
                (m.func, m.base, m.cbase, m.pc)
            };
            // SAFETY: la función sigue viva en pila[fpos] mientras corre el marco (ver Marco::func), y `func` (y lo que
            // sale de ella: el código, las
            // constantes, los upvalues) sólo se usa mientras el marco está vivo: después de una llamada o de una vuelta
            // se vuelve a leer todo desde 'marco; si el marco se va (return, error, yield) se sale de este bucle
            let func: &Funcion = unsafe { &*fp };
            let clau = match &func.tipo { TipoFn::Lua(c) => c, TipoFn::Nativa(_) => unreachable!() };
            let proto: &Proto = &clau.proto;
            let codigo = &proto.codigo[..];
            let k = &proto.k[..];
            let ups = &clau.ups[..];
            let mut pc = pc0;
            // (los registros, las constantes y el código se leen sin revisar los límites: el compilador sólo usa registros
            // de 0 a max_regs y la pila mide al menos base + max_regs mientras el marco corre —tope_marco—)
            macro_rules! r {
                ($x:expr) => { *{ let i = base + $x as usize; debug_assert!(i < self.hilo.pila.len()); unsafe { self.hilo.pila.get_unchecked_mut(i) } } };
            }
            macro_rules! rr {
                ($x:expr) => { { let i = base + $x as usize; debug_assert!(i < self.hilo.pila.len()); unsafe { self.hilo.pila.get_unchecked(i) } } };
            }
            macro_rules! kk {
                ($x:expr) => { { let i = $x as usize; debug_assert!(i < k.len()); unsafe { k.get_unchecked(i) } } };
            }
            macro_rules! rk {
                ($x:expr) => { if $x & K_BIT != 0 { kk!($x & !K_BIT) } else { rr!($x) } };
            }
            /// escribir un registro (sin la llamada a drop cuando lo que había no tenía nada que soltar)
            macro_rules! poner {
                ($x:expr, $v:expr) => {{ let v = $v; poner_en(&mut r!($x), v); }};
            }
            macro_rules! guardar {
                () => {{ debug_assert!(mi < self.hilo.marcos.len()); unsafe { self.hilo.marcos.get_unchecked_mut(mi) }.pc = pc; }};
            }
            macro_rules! paso {
                () => {
                    self.pasos += 1;
                    if self.pasos > self.limite { guardar!(); return Err(self.error_largo()); }
                };
            }
            macro_rules! saltar_sig {
                () => {
                    if let Op::Saltar(d) = unsafe { *codigo.get_unchecked(pc) } {
                        pc = (pc as isize + 1 + d as isize) as usize;
                        if d < 0 { paso!(); }
                    } else {
                        pc += 1;
                    }
                };
            }
            macro_rules! kcad { ($x:expr) => { match &k[$x as usize] { Valor::Cad(s) => s, _ => unreachable!() } } }
            macro_rules! arit {
                ($a:expr, $b:expr, $c:expr, $op:expr, $f:expr) => {{
                    let v = if let (Valor::Num(x), Valor::Num(y)) = (rk!($b), rk!($c)) { Valor::Num($f(*x, *y)) } else {
                        guardar!();
                        let (x, y) = (rk!($b).clone(), rk!($c).clone());
                        self.arit($op, &x, &y)?
                    };
                    poner!($a, v);
                }};
            }
            loop {
                debug_assert!(pc < codigo.len());
                let op = unsafe { *codigo.get_unchecked(pc) };
                pc += 1;
                match op {
                    Op::Mover(a, b) => { let v = rr!(b).clone(); poner!(a, v); }
                    Op::CargarK(a, x) => { let v = kk!(x).clone(); poner!(a, v); }
                    Op::CargarNil(a, n) => { for i in 0..n { r!(a + i) = Valor::Nil; } }
                    Op::CargarBool(a, b) => { r!(a) = Valor::Bool(b); }
                    Op::LeerUp(a, u) => { debug_assert!((u as usize) < ups.len()); let v = unsafe { ups.get_unchecked(u as usize) }.borrow().clone(); poner!(a, v); }
                    Op::EscribirUp(u, b) => { let v = rk!(b).clone(); *ups[u as usize].borrow_mut() = v; }
                    Op::CeldaNueva(c, b) => {
                        let v = if b == NINGUNO { Valor::Nil } else { mem::take(&mut r!(b)) };
                        self.hilo.celdas[cbase + c as usize] = Some(Rc::new(RefCell::new(v)));
                    }
                    Op::CeldaLeer(a, c) => {
                        let v = match &self.hilo.celdas[cbase + c as usize] { Some(cl) => cl.borrow().clone(), None => Valor::Nil };
                        r!(a) = v;
                    }
                    Op::CeldaEscribir(c, b) => {
                        let v = rk!(b).clone();
                        let i = cbase + c as usize;
                        match &self.hilo.celdas[i] {
                            Some(cl) => *cl.borrow_mut() = v,
                            None => self.hilo.celdas[i] = Some(Rc::new(RefCell::new(v))),
                        }
                    }
                    Op::LeerGlobal(a, x) => {
                        let v = if self.capa.is_none() {
                            let g = self.globales.borrow();
                            match g.get_cad(kcad!(x)) { Some(v) => Some(v.clone()), None => if g.meta.is_none() { Some(Valor::Nil) } else { None } }
                        } else {
                            None
                        };
                        let v = match v { Some(v) => v, None => { guardar!(); self.leer_global(&k[x as usize])? } };
                        r!(a) = v;
                    }
                    Op::EscribirGlobal(x, b) => {
                        let v = rk!(b).clone();
                        if self.capa.is_none() && self.globales.borrow().meta.is_none() {
                            let _ = self.globales.borrow_mut().set(k[x as usize].clone(), v);
                        } else {
                            guardar!();
                            self.escribir_global(k[x as usize].clone(), v)?;
                        }
                    }
                    Op::LeerGlobalM(a, x) => {
                        guardar!();
                        let m = clau.entorno.as_ref().map(|c| c.borrow().clone()).unwrap_or(Valor::Nil);
                        let v = if let Valor::Tabla(t) = &m {
                            let (v, meta) = { let tb = t.borrow(); (tb.get(&k[x as usize]), tb.meta.is_some()) };
                            if !v.es_nil() || !meta { v } else { self.indexar(&m, &k[x as usize])? }
                        } else {
                            self.leer_global(&k[x as usize])?
                        };
                        r!(a) = v;
                    }
                    Op::EscribirGlobalM(x, b) => {
                        guardar!();
                        let v = rk!(b).clone();
                        let m = clau.entorno.as_ref().map(|c| c.borrow().clone()).unwrap_or(Valor::Nil);
                        if let Valor::Tabla(t) = &m { let _ = t.borrow_mut().set(k[x as usize].clone(), v); } else { self.escribir_global(k[x as usize].clone(), v)?; }
                    }
                    Op::IndexarK(a, b, x) => {
                        let v = match rr!(b) {
                            Valor::Tabla(t) => campo_rapido(t, kcad!(x), &self.n.index),
                            Valor::Udata(u) => campo_udata(u, kcad!(x), &self.n.index),
                            _ => None,
                        };
                        let v = match v { Some(v) => v, None => { guardar!(); let o = rr!(b).clone(); self.indexar(&o, &k[x as usize])? } };
                        r!(a) = v;
                    }
                    Op::Indexar(a, b, c) => {
                        let v = match rr!(b) {
                            Valor::Tabla(t) => {
                                let tb = t.borrow();
                                match tb.get_ref(rk!(c)) { Some(v) => Some(v.clone()), None => if tb.meta.is_none() { Some(Valor::Nil) } else { None } }
                            }
                            _ => None,
                        };
                        let v = match v { Some(v) => v, None => { guardar!(); let (o, key) = (rr!(b).clone(), rk!(c).clone()); self.indexar(&o, &key)? } };
                        r!(a) = v;
                    }
                    Op::AsignarK(a, x, c) => {
                        let hecho = match rr!(a) {
                            Valor::Tabla(t) => {
                                let mut tb = t.borrow_mut();
                                let v = rk!(c);
                                if !v.es_nil() {
                                    if tb.filtro.is_some() { if tb.meta.is_none() { let _ = tb.set(kk!(x).clone(), v.clone()); true } else { false } }
                                    else if let Some(ranura) = tb.mapa.get_cad_mut(kcad!(x)) {
                                        // (la clave ya está: se cambia el valor en el lugar, con o sin metatabla —__newindex no corre—)
                                        poner_en(ranura, v.clone());
                                        true
                                    } else if tb.meta.is_none() { let _ = tb.set(kk!(x).clone(), v.clone()); true } else { false }
                                } else if tb.meta.is_none() { let _ = tb.set(kk!(x).clone(), Valor::Nil); true } else { false }
                            }
                            _ => false,
                        };
                        if !hecho { guardar!(); let (o, v) = (rr!(a).clone(), rk!(c).clone()); self.asignar(&o, k[x as usize].clone(), v)?; }
                    }
                    Op::Asignar(a, b, c) => {
                        let hecho = match rr!(a) {
                            Valor::Tabla(t) => {
                                let mut tb = t.borrow_mut();
                                if tb.meta.is_none() {
                                    let (key, v) = (rk!(b).clone(), rk!(c).clone());
                                    match tb.set(key, v) { Ok(()) => 1, Err(_) => 2 }
                                } else { 0 }
                            }
                            _ => 0,
                        };
                        if hecho != 1 { guardar!(); let (o, key, v) = (rr!(a).clone(), rk!(b).clone(), rk!(c).clone()); self.asignar(&o, key, v)?; }
                    }
                    Op::CampoTabla(a, b, c) => {
                        // (como R.tab de la web: una clave o un valor nil no se ponen)
                        let (key, v) = (rk!(b).clone(), rk!(c).clone());
                        if !key.es_nil() && !v.es_nil() {
                            if let Valor::Tabla(t) = rr!(a) {
                                let r = t.borrow_mut().set(key, v);
                                if let Err(e) = r { guardar!(); return Err(Error::nuevo(e.mensaje())); }
                            }
                        }
                    }
                    Op::NuevaTabla(a, na, nh) => {
                        r!(a) = Valor::Tabla(Rc::new(RefCell::new(Tabla::con_capacidad(na as usize, nh as usize))));
                    }
                    Op::SetLista(a, n, blq) => {
                        let ra = base + a as usize;
                        let n = if n == 0 { self.hilo.tope.saturating_sub(ra + 1) } else { n as usize };
                        let ini = blq as usize * POR_LISTA;
                        if let Valor::Tabla(t) = &self.hilo.pila[ra] {
                            let t = t.clone();
                            let mut tb = t.borrow_mut();
                            for i in 0..n { let v = mem::take(&mut self.hilo.pila[ra + 1 + i]); tb.poner_lista(ini + i + 1, v); }
                            tb.cerrar_lista();
                        }
                    }
                    Op::Metodo(a, b, x) => {
                        let o = rr!(b).clone();
                        let rapido = match &o {
                            Valor::Tabla(t) => campo_rapido(t, kcad!(x), &self.n.index),
                            Valor::Udata(u) => campo_udata(u, kcad!(x), &self.n.index),
                            Valor::Cad(_) => {
                                let m = self.meta_cad.as_ref().and_then(|m| m.borrow().get_cad(&self.n.index).cloned());
                                match m { Some(Valor::Tabla(st)) => st.borrow().get_cad(kcad!(x)).cloned().or(Some(Valor::Nil)), _ => None }
                            }
                            _ => None,
                        };
                        let f = match rapido { Some(f) => f, None => { guardar!(); self.indexar(&o, &k[x as usize])? } };
                        let f = if f.es_nil() && matches!(o, Valor::Udata(_)) && self.metodo_faltante.is_some() {
                            guardar!();
                            let h = self.metodo_faltante.clone().unwrap();
                            h(self, &o, kcad!(x)).unwrap_or(Valor::Nil)
                        } else { f };
                        r!(a + 1) = o;
                        r!(a) = f;
                    }
                    Op::Sumar(a, b, c) => arit!(a, b, c, Arit::Sumar, |x: f64, y: f64| x + y),
                    Op::Restar(a, b, c) => arit!(a, b, c, Arit::Restar, |x: f64, y: f64| x - y),
                    Op::Mult(a, b, c) => arit!(a, b, c, Arit::Mult, |x: f64, y: f64| x * y),
                    Op::Div(a, b, c) => arit!(a, b, c, Arit::Div, |x: f64, y: f64| x / y),
                    Op::Mod(a, b, c) => arit!(a, b, c, Arit::Mod, modulo),
                    Op::Pot(a, b, c) => arit!(a, b, c, Arit::Pot, potencia),
                    Op::Neg(a, b) => {
                        let v = if let Valor::Num(x) = rr!(b) { Valor::Num(-*x) } else { guardar!(); let x = rr!(b).clone(); self.negar(&x)? };
                        r!(a) = v;
                    }
                    Op::Not(a, b) => { let v = !rr!(b).es_verdad(); r!(a) = Valor::Bool(v); }
                    Op::Largo(a, b) => {
                        let v = match rr!(b) {
                            Valor::Cad(s) => Some(s.len()),
                            Valor::Tabla(t) => Some(t.borrow().len()),
                            _ => None,
                        };
                        let v = match v { Some(n) => Valor::Num(n as f64), None => { guardar!(); let x = rr!(b).clone(); self.largo(&x)? } };
                        r!(a) = v;
                    }
                    Op::Concat(a, b, n) => {
                        let ini = base + b as usize;
                        let n = n as usize;
                        let vals = &self.hilo.pila[ini..ini + n];
                        let v = if vals.iter().all(|v| matches!(v, Valor::Cad(_) | Valor::Num(_))) {
                            let cap: usize = vals.iter().map(|v| if let Valor::Cad(s) = v { s.len() } else { 8 }).sum();
                            let mut buf = Vec::with_capacity(cap);
                            for v in vals {
                                match v { Valor::Cad(s) => buf.extend_from_slice(s.bytes()), Valor::Num(x) => numeros::escribir_num(*x, &mut buf), _ => {} }
                            }
                            Valor::Cad(Cadena::desde_vec(buf))
                        } else {
                            guardar!();
                            self.concat_lento(ini, n)?
                        };
                        r!(a) = v;
                    }
                    Op::Igual(a, b, c) => {
                        let v = match igual_rapido(rk!(b), rk!(c)) { Some(v) => v, None => { guardar!(); let (x, y) = (rk!(b).clone(), rk!(c).clone()); self.igual_meta(&x, &y)? } };
                        r!(a) = Valor::Bool(v);
                    }
                    Op::Distinto(a, b, c) => {
                        let v = match igual_rapido(rk!(b), rk!(c)) { Some(v) => v, None => { guardar!(); let (x, y) = (rk!(b).clone(), rk!(c).clone()); self.igual_meta(&x, &y)? } };
                        r!(a) = Valor::Bool(!v);
                    }
                    Op::Menor(a, b, c) => {
                        let v = match menor_rapido(rk!(b), rk!(c)) { Some(v) => v, None => { guardar!(); let (x, y) = (rk!(b).clone(), rk!(c).clone()); self.menor(&x, &y)? } };
                        r!(a) = Valor::Bool(v);
                    }
                    Op::MenorIg(a, b, c) => {
                        let v = match menor_ig_rapido(rk!(b), rk!(c)) { Some(v) => v, None => { guardar!(); let (x, y) = (rk!(b).clone(), rk!(c).clone()); self.menor_ig(&x, &y)? } };
                        r!(a) = Valor::Bool(v);
                    }
                    Op::SiIgual(esp, b, c) => {
                        let v = match igual_rapido(rk!(b), rk!(c)) { Some(v) => v, None => { guardar!(); let (x, y) = (rk!(b).clone(), rk!(c).clone()); self.igual_meta(&x, &y)? } };
                        if v == esp { saltar_sig!(); } else { pc += 1; }
                    }
                    Op::SiMenor(esp, b, c) => {
                        let v = match menor_rapido(rk!(b), rk!(c)) { Some(v) => v, None => { guardar!(); let (x, y) = (rk!(b).clone(), rk!(c).clone()); self.menor(&x, &y)? } };
                        if v == esp { saltar_sig!(); } else { pc += 1; }
                    }
                    Op::SiMenorIg(esp, b, c) => {
                        let v = match menor_ig_rapido(rk!(b), rk!(c)) { Some(v) => v, None => { guardar!(); let (x, y) = (rk!(b).clone(), rk!(c).clone()); self.menor_ig(&x, &y)? } };
                        if v == esp { saltar_sig!(); } else { pc += 1; }
                    }
                    Op::Probar(a, esp) => { if rr!(a).es_verdad() == esp { saltar_sig!(); } else { pc += 1; } }
                    Op::Saltar(d) => {
                        pc = (pc as isize + d as isize) as usize;
                        if d < 0 { paso!(); }
                    }
                    Op::Llamar(a, b, c) => {
                        let fpos = base + a as usize;
                        let nargs = if b != 0 { b as usize - 1 } else { self.hilo.tope - fpos - 1 };
                        guardar!();
                        if let Valor::Func(f) = rr!(a) {
                            if let TipoFn::Lua(_) = f.tipo {
                                let fp = Rc::as_ptr(f);
                                self.entrar_lua_ptr(fpos, nargs, c as i32 - 1, fp, Prot::No)?;
                                continue 'marco;
                            }
                        }
                        if let Valor::Func(f) = rr!(a) {
                            if f.especial() == Especial::No {
                                let f = f.clone();
                                self.llamar_nativa(fpos, nargs, c as i32 - 1, &f)?;
                                continue;
                            }
                        }
                        if self.precall(fpos, nargs, c as i32 - 1, Nombre::Codigo)? { continue 'marco; }
                    }
                    Op::Retornar(a, 2) if {
                        let m = unsafe { self.hilo.marcos.get_unchecked(mi) };
                        matches!(m.prot, Prot::No) && m.nres == 1 && mi > nivel
                    } => {
                        // (el caso de siempre: un valor que vuelve a una llamada de Lua que quiere uno)
                        let v = std::mem::take(&mut r!(a));
                        let (fpos, cb) = { let m = unsafe { self.hilo.marcos.get_unchecked(mi) }; (m.fpos, m.cbase) };
                        let h = &mut self.hilo;
                        // SAFETY: el marco no tiene nada que soltar (Prot::No y un puntero)
                        unsafe { h.marcos.set_len(mi) };
                        if h.celdas.len() > cb { h.celdas.truncate(cb); }
                        debug_assert!(fpos < h.pila.len());
                        poner_en(unsafe { h.pila.get_unchecked_mut(fpos) }, v);
                        continue 'marco;
                    }
                    Op::Retornar(a, b) => {
                        let ini = base + a as usize;
                        let n = if b != 0 { b as usize - 1 } else { self.hilo.tope - ini };
                        let m = self.hilo.marcos.pop().unwrap();
                        let h = &mut self.hilo;
                        if h.celdas.len() > m.cbase { h.celdas.truncate(m.cbase); }
                        let (dest, nres, extra) = match &m.prot { Prot::No => (m.fpos, m.nres, 0), Prot::Pcall(n) | Prot::Xpcall(n, _) => (m.fpos - 1, *n, 1) };
                        if extra == 1 { h.pila[dest] = Valor::Bool(true); }
                        let d0 = dest + extra;
                        for i in 0..n { let v = mem::take(&mut h.pila[ini + i]); h.pila[d0 + i] = v; }
                        let total = n + extra;
                        let fin = if nres < 0 {
                            h.tope = dest + total;
                            h.tope
                        } else {
                            let nres = nres as usize;
                            for i in total..nres { h.pila[dest + i] = Valor::Nil; }
                            dest + nres
                        };
                        if h.marcos.len() == nivel { h.pila.truncate(fin); return Ok(()); }
                        let ext = h.marcos.last().unwrap().tope_marco.max(fin);
                        if h.pila.len() < ext { h.pila.resize(ext, Valor::Nil); }
                        drop(m);
                        continue 'marco;
                    }
                    Op::ForPrep(a, d) => {
                        let ra = base + a as usize;
                        guardar!();
                        let ini = self.num_for(ra)?;
                        let lim = self.num_for(ra + 1)?;
                        let paso = self.num_for(ra + 2)?;
                        let p = &mut self.hilo.pila;
                        p[ra] = Valor::Num(ini);
                        p[ra + 1] = Valor::Num(lim);
                        p[ra + 2] = Valor::Num(paso);
                        if if paso > 0.0 { ini <= lim } else { ini >= lim } {
                            p[ra + 3] = Valor::Num(ini);
                            paso!();
                        } else {
                            pc = (pc as isize + d as isize) as usize;
                        }
                    }
                    Op::ForLoop(a, d) => {
                        let (i, lim, paso) = match (rr!(a), rr!(a + 1), rr!(a + 2)) {
                            (Valor::Num(i), Valor::Num(lim), Valor::Num(paso)) => (*i, *lim, *paso),
                            _ => (0.0, -1.0, 1.0),
                        };
                        let i = i + paso;
                        if if paso > 0.0 { i <= lim } else { i >= lim } {
                            poner!(a, Valor::Num(i));
                            poner!(a + 3, Valor::Num(i));
                            pc = (pc as isize + d as isize) as usize;
                            paso!();
                        }
                    }
                    Op::TForCall(a, n) => {
                        let ra = base + a as usize;
                        guardar!();
                        let esp = match &self.hilo.pila[ra] { Valor::Func(f) => f.especial(), _ => Especial::No };
                        if esp == Especial::Next || esp == Especial::IpairsAux {
                            let kv = if esp == Especial::Next {
                                match &self.hilo.pila[ra + 1] {
                                    Valor::Tabla(t) => t.borrow().siguiente(&self.hilo.pila[ra + 2]),
                                    _ => return Err(self.error("bad argument #1 to next (table expected)")),
                                }
                            } else {
                                let o = self.hilo.pila[ra + 1].clone();
                                let i = a_num(&self.hilo.pila[ra + 2]).unwrap_or(0.0) + 1.0;
                                let v = match &o { Valor::Tabla(t) if t.borrow().meta.is_none() => t.borrow().get(&Valor::Num(i)), _ => self.indexar(&o, &Valor::Num(i))? };
                                if v.es_nil() { None } else { Some((Valor::Num(i), v)) }
                            };
                            let p = &mut self.hilo.pila;
                            match kv {
                                Some((kk, v)) => {
                                    p[ra + 3] = kk;
                                    if n >= 2 { p[ra + 4] = v; }
                                    for i in 2..n as usize { p[ra + 3 + i] = Valor::Nil; }
                                }
                                None => { p[ra + 3] = Valor::Nil; }
                            }
                            continue;
                        }
                        let p = &mut self.hilo.pila;
                        let (f, s, c) = (p[ra].clone(), p[ra + 1].clone(), p[ra + 2].clone());
                        p[ra + 3] = f;
                        p[ra + 4] = s;
                        p[ra + 5] = c;
                        if self.precall(ra + 3, 2, n as i32, Nombre::Fijo("for iterator"))? { continue 'marco; }
                    }
                    Op::TForLoop(a, d) => {
                        let ra = base + a as usize;
                        if !self.hilo.pila[ra + 3].es_nil() {
                            let v = self.hilo.pila[ra + 3].clone();
                            self.hilo.pila[ra + 2] = v;
                            pc = (pc as isize + d as isize) as usize;
                            paso!();
                        }
                    }
                    Op::Clausura(a, p) => {
                        let hp = proto.hijos[p as usize].clone();
                        let mut nuevos: Vec<Celda> = Vec::with_capacity(hp.ups.len());
                        for &(local, i) in &hp.ups {
                            if local {
                                let idx = cbase + i as usize;
                                let c = match &self.hilo.celdas[idx] {
                                    Some(c) => c.clone(),
                                    None => { let c = Rc::new(RefCell::new(Valor::Nil)); self.hilo.celdas[idx] = Some(c.clone()); c }
                                };
                                nuevos.push(c);
                            } else {
                                nuevos.push(ups[i as usize].clone());
                            }
                        }
                        let f = Funcion { tipo: TipoFn::Lua(Clausura { proto: hp, ups: nuevos.into_boxed_slice(), entorno: clau.entorno.clone() }), id: Cell::new(0) };
                        r!(a) = Valor::Func(Rc::new(f));
                    }
                    Op::Vararg(a, b) => {
                        let (vb, vn) = { let m = unsafe { self.hilo.marcos.get_unchecked(mi) }; (m.va_base, m.va_n) };
                        let ra = base + a as usize;
                        let p = &mut self.hilo.pila;
                        if b == 0 {
                            if p.len() < ra + vn { p.resize(ra + vn, Valor::Nil); }
                            for i in 0..vn { let v = p[vb + i].clone(); p[ra + i] = v; }
                            self.hilo.tope = ra + vn;
                        } else {
                            for i in 0..(b - 1) as usize { let v = if i < vn { p[vb + i].clone() } else { Valor::Nil }; p[ra + i] = v; }
                        }
                    }
                    Op::Modulo(a, b) => {
                        let ra = base + a as usize;
                        let n = if b == 0 { self.hilo.tope - ra } else { b as usize - 1 };
                        let args: Vec<Valor> = self.hilo.pila[ra..ra + n].to_vec();
                        guardar!();
                        let t = crate::bib::base::crear_modulo(self, &args)?;
                        if let Some(c) = &clau.entorno { *c.borrow_mut() = Valor::Tabla(t); }
                    }
                }
            }
        }
    }

    #[inline(never)]
    fn num_for(&self, i: usize) -> Result<f64, Error> {
        match a_num(&self.hilo.pila[i]) { Some(x) => Ok(x), None => Err(self.error("'for' necesita un número")) }
    }

    // ---------------- globales ----------------
    /// leer una global con la capa del lado que corre y el __index de _G (R.gg de la web)
    #[inline(never)]
    pub(crate) fn leer_global(&mut self, key: &Valor) -> Result<Valor, Error> {
        if let Some(c) = &self.capa {
            if let Some(v) = c.borrow().get_ref(key) { return Ok(v.clone()); }
        }
        let (v, meta) = { let g = self.globales.borrow(); (g.get(key), g.meta.is_some()) };
        if !v.es_nil() || !meta { return Ok(v); }
        let g = Valor::Tabla(self.globales.clone());
        self.indexar(&g, key)
    }
    /// escribir una global (R.gs): lo nuevo va a la capa si hay una
    #[inline(never)]
    pub(crate) fn escribir_global(&mut self, key: Valor, v: Valor) -> Result<(), Error> {
        if let Some(c) = self.capa.clone() {
            let tiene = c.borrow().get_ref(&key).is_some();
            if tiene || self.globales.borrow().get_ref(&key).is_none() {
                let r = c.borrow_mut().set(key, v);
                return r.map_err(|e| Error::nuevo(e.mensaje()));
            }
        }
        if self.globales.borrow().meta.is_some() {
            let g = Valor::Tabla(self.globales.clone());
            return self.asignar(&g, key, v);
        }
        let r = self.globales.borrow_mut().set(key, v);
        r.map_err(|e| Error::nuevo(e.mensaje()))
    }

    // ---------------- índices ----------------
    /// o[k] con __index (R.ix)
    #[inline(never)]
    pub fn indexar(&mut self, o: &Valor, k: &Valor) -> Result<Valor, Error> {
        let mut o = o.clone();
        for _ in 0..100 {
            let h = match &o {
                Valor::Tabla(t) => {
                    let m = {
                        let tb = t.borrow();
                        if let Some(v) = tb.get_ref(k) { return Ok(v.clone()); }
                        match &tb.meta { None => return Ok(Valor::Nil), Some(m) => m.clone() }
                    };
                    let h = m.borrow().get_cad(&self.n.index).cloned();
                    match h { None => return Ok(Valor::Nil), Some(h) => h }
                }
                otro => {
                    let h = self.meta_campo(otro, &self.n.index);
                    if h.es_nil() { return Err(self.error_indexar(otro, k)); }
                    h
                }
            };
            if let Valor::Func(_) = h { return self.llamar_1(&h, &[o, k.clone()], "__index"); }
            o = h;
        }
        Err(self.error("bucle en '__index'"))
    }
    /// o[k] = v con __newindex (R.sx)
    #[inline(never)]
    pub fn asignar(&mut self, o: &Valor, k: Valor, v: Valor) -> Result<(), Error> {
        let mut o = o.clone();
        for _ in 0..100 {
            let h = match &o {
                Valor::Tabla(t) => {
                    let meta = t.borrow().meta.clone();
                    let h = match &meta { None => Valor::Nil, Some(m) => m.borrow().get_cad(&self.n.newindex).cloned().unwrap_or(Valor::Nil) };
                    if h.es_nil() || t.borrow().get_ref(&k).is_some() {
                        let r = t.borrow_mut().set(k, v);
                        return r.map_err(|e| Error::nuevo(e.mensaje()));
                    }
                    h
                }
                otro => {
                    let h = self.meta_campo(otro, &self.n.newindex);
                    if h.es_nil() { return Err(self.error(&format!("attempt to index a {} value", otro.tipo()))); }
                    h
                }
            };
            if let Valor::Func(_) = h { self.llamar_1(&h, &[o, k, v], "__newindex")?; return Ok(()); }
            o = h;
        }
        Err(self.error("bucle en '__newindex'"))
    }

    // ---------------- aritmética y comparaciones con metamétodos ----------------
    fn evento(&self, op: Arit) -> (&Rc<Cadena>, &'static str) {
        match op {
            Arit::Sumar => (&self.n.add, "__add"),
            Arit::Restar => (&self.n.sub, "__sub"),
            Arit::Mult => (&self.n.mul, "__mul"),
            Arit::Div => (&self.n.div, "__div"),
            Arit::Mod => (&self.n.mod_, "__mod"),
            Arit::Pot => (&self.n.pow, "__pow"),
        }
    }
    #[inline(never)]
    pub(crate) fn arit(&mut self, op: Arit, a: &Valor, b: &Valor) -> Result<Valor, Error> {
        if let (Some(x), Some(y)) = (a_num(a), a_num(b)) { return Ok(Valor::Num(op.aplicar(x, y))); }
        let (ev, nombre) = self.evento(op);
        let ev = ev.clone();
        let mut h = self.meta_campo(a, &ev);
        if h.es_nil() { h = self.meta_campo(b, &ev); }
        if !h.es_nil() { return self.llamar_1(&h, &[a.clone(), b.clone()], nombre); }
        let malo = if a_num(a).is_none() { a } else { b };
        Err(self.error(&format!("attempt to perform arithmetic on a {} value", malo.tipo())))
    }
    #[inline(never)]
    pub(crate) fn negar(&mut self, a: &Valor) -> Result<Valor, Error> {
        if let Some(x) = a_num(a) { return Ok(Valor::Num(-x)); }
        let h = self.meta_campo(a, &self.n.unm.clone());
        if !h.es_nil() { return self.llamar_1(&h, &[a.clone(), a.clone()], "__unm"); }
        Err(self.error(&format!("attempt to perform arithmetic on a {} value", a.tipo())))
    }
    #[inline(never)]
    pub(crate) fn largo(&mut self, a: &Valor) -> Result<Valor, Error> {
        match a {
            Valor::Cad(s) => return Ok(Valor::Num(s.len() as f64)),
            Valor::Tabla(t) => return Ok(Valor::Num(t.borrow().len() as f64)),
            _ => {}
        }
        let h = self.meta_campo(a, &self.n.len.clone());
        if !h.es_nil() { return self.llamar_1(&h, &[a.clone()], "__len"); }
        Err(self.error(&format!("attempt to get length of a {} value", a.tipo())))
    }
    #[inline(never)]
    fn concat_lento(&mut self, ini: usize, n: usize) -> Result<Valor, Error> {
        let vals: Vec<Valor> = self.hilo.pila[ini..ini + n].to_vec();
        let mut acc = vals[n - 1].clone();
        for i in (0..n - 1).rev() { acc = self.concat2(&vals[i], &acc)?; }
        Ok(acc)
    }
    /// a .. b (R.cat)
    #[inline(never)]
    pub(crate) fn concat2(&mut self, a: &Valor, b: &Valor) -> Result<Valor, Error> {
        let es = |v: &Valor| matches!(v, Valor::Cad(_) | Valor::Num(_));
        if es(a) && es(b) {
            let mut buf = Vec::new();
            for v in [a, b] {
                match v { Valor::Cad(s) => buf.extend_from_slice(s.bytes()), Valor::Num(x) => numeros::escribir_num(*x, &mut buf), _ => {} }
            }
            return Ok(Valor::Cad(Cadena::desde_vec(buf)));
        }
        let ev = self.n.concat.clone();
        let mut h = self.meta_campo(a, &ev);
        if h.es_nil() { h = self.meta_campo(b, &ev); }
        if !h.es_nil() { return self.llamar_1(&h, &[a.clone(), b.clone()], "__concat"); }
        let malo = if es(a) { b } else { a };
        Err(self.error(&format!("attempt to concatenate a {} value", malo.tipo())))
    }
    /// a == b con __eq (R.eq)
    pub fn igual(&mut self, a: &Valor, b: &Valor) -> Result<bool, Error> {
        match igual_rapido(a, b) { Some(v) => Ok(v), None => self.igual_meta(a, b) }
    }
    #[inline(never)]
    pub(crate) fn igual_meta(&mut self, a: &Valor, b: &Valor) -> Result<bool, Error> {
        let ev = self.n.eq.clone();
        let h = self.meta_campo(a, &ev);
        if h.es_nil() { return Ok(false); }
        let h2 = self.meta_campo(b, &ev);
        if !h.crudo_igual(&h2) { return Ok(false); }
        Ok(self.llamar_1(&h, &[a.clone(), b.clone()], "__eq")?.es_verdad())
    }
    /// a < b (R.lt)
    #[inline(never)]
    pub fn menor(&mut self, a: &Valor, b: &Valor) -> Result<bool, Error> {
        if let Some(v) = menor_rapido(a, b) { return Ok(v); }
        let ev = self.n.lt.clone();
        let mut h = self.meta_campo(a, &ev);
        if h.es_nil() { h = self.meta_campo(b, &ev); }
        if !h.es_nil() { return Ok(self.llamar_1(&h, &[a.clone(), b.clone()], "__lt")?.es_verdad()); }
        Err(self.error(&format!("attempt to compare {} with {}", a.tipo(), b.tipo())))
    }
    /// a <= b (R.le)
    #[inline(never)]
    pub fn menor_ig(&mut self, a: &Valor, b: &Valor) -> Result<bool, Error> {
        if let Some(v) = menor_ig_rapido(a, b) { return Ok(v); }
        let ev = self.n.le.clone();
        let mut h = self.meta_campo(a, &ev);
        if h.es_nil() { h = self.meta_campo(b, &ev); }
        if !h.es_nil() { return Ok(self.llamar_1(&h, &[a.clone(), b.clone()], "__le")?.es_verdad()); }
        let ev = self.n.lt.clone();
        let mut h = self.meta_campo(a, &ev);
        if h.es_nil() { h = self.meta_campo(b, &ev); }
        if !h.es_nil() { return Ok(!self.llamar_1(&h, &[b.clone(), a.clone()], "__lt")?.es_verdad()); }
        Err(self.error(&format!("attempt to compare {} with {}", a.tipo(), b.tipo())))
    }

    /// tostring (R.tostr): __tostring, números como la web, «table: 0x10000028»
    pub fn tostring(&mut self, v: &Valor) -> Result<Rc<Cadena>, Error> {
        match v {
            Valor::Cad(s) => return Ok(s.clone()),
            Valor::Num(n) => return Ok(Cadena::desde_vec(numeros::fmt_num(*n).into_bytes())),
            Valor::Nil => return Ok(Cadena::nueva(b"nil")),
            Valor::Bool(b) => return Ok(Cadena::nueva(if *b { b"true" } else { b"false" })),
            _ => {}
        }
        let h = self.meta_campo(v, &self.n.tostring.clone());
        if !h.es_nil() {
            let r = self.llamar_1(&h, &[v.clone()], "__tostring")?;
            return Ok(match r {
                Valor::Cad(s) => s,
                Valor::Num(n) => Cadena::desde_vec(numeros::js_tostring(n).into_bytes()),
                Valor::Nil => Cadena::nueva(b"undefined"),
                Valor::Bool(b) => Cadena::nueva(if b { b"true" } else { b"false" }),
                _ => Cadena::nueva(b"[object Object]"),
            });
        }
        let id = self.id_de(v);
        Ok(Cadena::desde_vec(format!("{}: 0x{:08x}", v.tipo(), id).into_bytes()))
    }
}

/// t[k] con k un texto, siguiendo un __index que es una tabla (las clases: Ent.__index = Ent); None si hace falta el
/// camino lento (un __index que es función, o más niveles)
#[inline]
fn campo_rapido(t: &TablaRef, k: &Rc<Cadena>, index: &Rc<Cadena>) -> Option<Valor> {
    let tb = t.borrow();
    if let Some(v) = tb.get_cad(k) { return Some(v.clone()); }
    let m = match &tb.meta { None => return Some(Valor::Nil), Some(m) => m };
    let mb = m.borrow();
    match mb.get_cad(index) {
        None => Some(Valor::Nil),
        Some(Valor::Tabla(t2)) => {
            let t2b = t2.borrow();
            if let Some(v) = t2b.get_cad(k) { return Some(v.clone()); }
            if t2b.meta.is_none() { Some(Valor::Nil) } else { None }
        }
        _ => None,
    }
}

/// lo mismo para un userdata (los métodos de Vector, Entity... en el __index de su metatabla)
#[inline]
fn campo_udata(u: &Udata, k: &Rc<Cadena>, index: &Rc<Cadena>) -> Option<Valor> {
    let m = u.meta.borrow();
    let mb = m.as_ref()?.borrow();
    match mb.get_cad(index) {
        Some(Valor::Tabla(t2)) => {
            let t2b = t2.borrow();
            if let Some(v) = t2b.get_cad(k) { return Some(v.clone()); }
            if t2b.meta.is_none() { Some(Valor::Nil) } else { None }
        }
        _ => None,
    }
}

/// escribir en una ranura de la pila: si lo que había es nil, booleano o número no hace falta soltarlo
#[inline(always)]
pub(crate) fn poner_en(r: &mut Valor, v: Valor) {
    if matches!(r, Valor::Nil | Valor::Bool(_) | Valor::Num(_)) {
        // SAFETY: lo que había no tiene nada que soltar
        unsafe { std::ptr::write(r, v) }
    } else {
        *r = v;
    }
}

#[inline]
pub(crate) fn igual_rapido(a: &Valor, b: &Valor) -> Option<bool> {
    if a.crudo_igual(b) { return Some(true); }
    match (a, b) { (Valor::Tabla(_), Valor::Tabla(_)) | (Valor::Udata(_), Valor::Udata(_)) => None, _ => Some(false) }
}
#[inline]
fn menor_rapido(a: &Valor, b: &Valor) -> Option<bool> {
    match (a, b) { (Valor::Num(x), Valor::Num(y)) => Some(x < y), (Valor::Cad(x), Valor::Cad(y)) => Some(x.bytes() < y.bytes()), _ => None }
}
#[inline]
fn menor_ig_rapido(a: &Valor, b: &Valor) -> Option<bool> {
    match (a, b) { (Valor::Num(x), Valor::Num(y)) => Some(x <= y), (Valor::Cad(x), Valor::Cad(y)) => Some(x.bytes() <= y.bytes()), _ => None }
}
