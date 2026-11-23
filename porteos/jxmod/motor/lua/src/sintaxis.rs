//! La sintaxis: de fichas a un árbol con los nombres ya resueltos (cada variable es un local de la función —con un
//! número—, un upvalue o una global), como `luaParsear` de la web. Se anota qué locales capturan las funciones de adentro:
//! ésos van en celdas; los demás, en registros.
use std::rc::Rc;

use crate::lexico::{Ficha, T};
use crate::valor::Cadena;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum OpBin { Mas, Menos, Por, Div, Mod, Pot, Concat, Igual, Distinto, Menor, MenorIg, Mayor, MayorIg, And, Or }
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum OpUn { Neg, Not, Largo }

pub(crate) enum Exp {
    Nil,
    True,
    False,
    Num(f64),
    Cad(Rc<Cadena>),
    Vararg,
    Local(u32),
    Up(u32),
    Global(Rc<Cadena>),
    Indice(Box<Exp>, Box<Exp>),
    Llamada(Box<Exp>, Vec<Exp>),
    Metodo(Box<Exp>, Rc<Cadena>, Vec<Exp>),
    Funcion(Box<FuncAst>),
    Paren(Box<Exp>),
    Tabla(Vec<Campo>),
    Bin(OpBin, Box<Exp>, Box<Exp>),
    /// a .. b .. c (una sola lista: las cadenas largas de `..` no arman un árbol hondo)
    Concat(Vec<Exp>),
    Un(OpUn, Box<Exp>),
}

pub(crate) enum Campo { Pos(Exp), Clave(Exp, Exp) }

pub(crate) enum Sent {
    Local { ids: Vec<u32>, exps: Vec<Exp> },
    LocalFuncion { id: u32, f: Box<FuncAst> },
    Asignar { izq: Vec<Exp>, der: Vec<Exp> },
    Llamada(Exp),
    Do(Vec<Sentencia>),
    While { cond: Exp, cuerpo: Vec<Sentencia> },
    Repeat { cuerpo: Vec<Sentencia>, cond: Exp },
    If { ramas: Vec<(Exp, Vec<Sentencia>)>, otro: Option<Vec<Sentencia>> },
    ForNum { var: u32, ini: Exp, fin: Exp, paso: Option<Exp>, cuerpo: Vec<Sentencia> },
    ForIn { vars: Vec<u32>, exps: Vec<Exp>, cuerpo: Vec<Sentencia> },
    Return(Vec<Exp>),
    Break,
    Continue,
    Goto(Rc<Cadena>),
    Etiqueta(Rc<Cadena>),
    /// module("x", ...) arriba de todo: desde ahí las globales del archivo van a esa tabla
    Modulo(Vec<Exp>),
}

pub(crate) struct Sentencia { pub s: Sent, pub ln: u32 }

pub(crate) struct InfoLocal { pub nombre: Rc<Cadena>, pub capturada: bool }

/// un upvalue: un local de la función de afuera (por su número) o un upvalue de ella
#[derive(Clone)]
pub(crate) struct UpDesc { pub nombre: Rc<Cadena>, pub de_local: bool, pub idx: u32 }

pub(crate) struct FuncAst {
    pub params: Vec<u32>,
    pub es_vararg: bool,
    pub cuerpo: Vec<Sentencia>,
    pub ln: u32,
    pub locales: Vec<InfoLocal>,
    pub ups: Vec<UpDesc>,
    pub con_modulo: bool,
}

struct FuncP {
    locales: Vec<InfoLocal>,
    activos: Vec<(Rc<Cadena>, u32)>,
    ups: Vec<UpDesc>,
    es_vararg: bool,
}

struct Parser<'a> {
    t: Vec<Ficha>,
    p: usize,
    archivo: &'a str,
    fs: Vec<FuncP>,
    /// cuántos bloques hay abiertos en la función principal (module sólo vale arriba de todo)
    prof_bloque: u32,
    con_modulo: bool,
    /// cuántos niveles de expresiones y bloques hay abiertos (como LUAI_MAXCCALLS: más de 200 es un error)
    nivel: u32,
}

const MAX_NIVEL: u32 = 200;

const PRI: fn(&T) -> Option<(u8, u8, OpBin)> = |t| {
    Some(match t {
        T::Or => (1, 1, OpBin::Or),
        T::And => (2, 2, OpBin::And),
        T::Menor => (3, 3, OpBin::Menor),
        T::Mayor => (3, 3, OpBin::Mayor),
        T::MenorIg => (3, 3, OpBin::MenorIg),
        T::MayorIg => (3, 3, OpBin::MayorIg),
        T::Distinto => (3, 3, OpBin::Distinto),
        T::Igual2 => (3, 3, OpBin::Igual),
        T::Concat => (5, 4, OpBin::Concat),
        T::Mas => (6, 6, OpBin::Mas),
        T::Menos => (6, 6, OpBin::Menos),
        T::Por => (7, 7, OpBin::Por),
        T::Barra => (7, 7, OpBin::Div),
        T::Porc => (7, 7, OpBin::Mod),
        T::Pot => (10, 9, OpBin::Pot),
        _ => return None,
    })
};

type R<X> = Result<X, String>;

pub(crate) fn parsear(t: Vec<Ficha>, archivo: &str) -> R<FuncAst> {
    let mut p = Parser { t, p: 0, archivo, fs: vec![], prof_bloque: 0, con_modulo: false, nivel: 0 };
    p.fs.push(FuncP { locales: vec![], activos: vec![], ups: vec![], es_vararg: true });
    let cuerpo = p.bloque()?;
    if !matches!(p.tipo(), T::Eof) { return p.err("se esperaba fin del archivo"); }
    let f = p.fs.pop().unwrap();
    Ok(FuncAst { params: vec![], es_vararg: true, cuerpo, ln: 0, locales: f.locales, ups: f.ups, con_modulo: p.con_modulo })
}

impl<'a> Parser<'a> {
    #[inline] fn tipo(&self) -> &T { &self.t[self.p].t }
    #[inline] fn ln(&self) -> u32 { self.t[self.p].ln }
    fn err<X>(&self, m: &str) -> R<X> {
        Err(format!("{}:{}: {} cerca de {}", self.archivo, self.ln(), m, self.tipo().mostrar()))
    }
    fn esp(&mut self, t: T) -> R<()> {
        if *self.tipo() != t { return self.err(&format!("se esperaba '{}'", t.nombre())); }
        self.p += 1;
        Ok(())
    }
    fn opt(&mut self, t: T) -> bool { if *self.tipo() == t { self.p += 1; true } else { false } }
    fn nombre(&mut self) -> R<Rc<Cadena>> {
        if let T::Nom(s) = self.tipo() { let s = s.clone(); self.p += 1; Ok(s) } else { self.err("se esperaba 'nom'") }
    }
    fn fin_bloque(&self) -> bool { matches!(self.tipo(), T::Else | T::Elseif | T::End | T::Until | T::Eof) }

    // ---- ámbitos y nombres ----
    fn f(&mut self) -> &mut FuncP { self.fs.last_mut().unwrap() }
    fn declarar(&mut self, nombre: Rc<Cadena>) -> u32 {
        let f = self.f();
        let id = f.locales.len() as u32;
        f.locales.push(InfoLocal { nombre, capturada: false });
        id
    }
    fn activar(&mut self, id: u32) {
        let f = self.f();
        let n = f.locales[id as usize].nombre.clone();
        f.activos.push((n, id));
    }
    fn resolver(&mut self, nombre: &Rc<Cadena>) -> Exp {
        let n = self.fs.len() - 1;
        if let Some(id) = buscar_activo(&self.fs[n], nombre) { return Exp::Local(id); }
        match self.buscar_up(n, nombre) { Some(u) => Exp::Up(u), None => Exp::Global(nombre.clone()) }
    }
    fn buscar_up(&mut self, fi: usize, nombre: &Rc<Cadena>) -> Option<u32> {
        if let Some(i) = self.fs[fi].ups.iter().position(|u| Cadena::igual(&u.nombre, nombre)) { return Some(i as u32); }
        if fi == 0 { return None; }
        let padre = fi - 1;
        let desc = if let Some(id) = buscar_activo(&self.fs[padre], nombre) {
            self.fs[padre].locales[id as usize].capturada = true;
            UpDesc { nombre: nombre.clone(), de_local: true, idx: id }
        } else {
            let u = self.buscar_up(padre, nombre)?;
            UpDesc { nombre: nombre.clone(), de_local: false, idx: u }
        };
        self.fs[fi].ups.push(desc);
        Some(self.fs[fi].ups.len() as u32 - 1)
    }

    // ---- bloques y sentencias ----
    fn bloque(&mut self) -> R<Vec<Sentencia>> {
        let n0 = self.f().activos.len();
        self.prof_bloque += 1;
        self.nivel += 1;
        let r = if self.nivel > MAX_NIVEL { self.err("demasiados niveles de anidamiento") } else { self.bloque_sin_ambito() };
        self.nivel -= 1;
        self.prof_bloque -= 1;
        self.f().activos.truncate(n0);
        r
    }
    fn bloque_sin_ambito(&mut self) -> R<Vec<Sentencia>> {
        let mut l = Vec::new();
        while !self.fin_bloque() {
            if matches!(self.tipo(), T::Return) {
                let ln = self.ln();
                self.p += 1;
                let ex = if self.fin_bloque() || matches!(self.tipo(), T::PuntoComa) { vec![] } else { self.explist()? };
                self.opt(T::PuntoComa);
                l.push(Sentencia { s: Sent::Return(ex), ln });
                break;
            }
            if let Some(s) = self.sentencia()? { l.push(s); }
        }
        Ok(l)
    }
    fn sentencia(&mut self) -> R<Option<Sentencia>> {
        let ln = self.ln();
        let s = match self.tipo() {
            T::PuntoComa => { self.p += 1; return Ok(None); }
            T::If => {
                self.p += 1;
                let mut ramas = vec![];
                let c = self.expr(0)?;
                self.esp(T::Then)?;
                let b = self.bloque()?;
                ramas.push((c, b));
                while matches!(self.tipo(), T::Elseif) {
                    self.p += 1;
                    let c = self.expr(0)?;
                    self.esp(T::Then)?;
                    let b = self.bloque()?;
                    ramas.push((c, b));
                }
                let otro = if self.opt(T::Else) { Some(self.bloque()?) } else { None };
                self.esp(T::End)?;
                Sent::If { ramas, otro }
            }
            T::While => {
                self.p += 1;
                let cond = self.expr(0)?;
                self.esp(T::Do)?;
                let cuerpo = self.bloque()?;
                self.esp(T::End)?;
                Sent::While { cond, cuerpo }
            }
            T::Do => { self.p += 1; let b = self.bloque()?; self.esp(T::End)?; Sent::Do(b) }
            T::For => {
                self.p += 1;
                let n1 = self.nombre()?;
                if self.opt(T::Asig) {
                    let ini = self.expr(0)?;
                    self.esp(T::Coma)?;
                    let fin = self.expr(0)?;
                    let paso = if self.opt(T::Coma) { Some(self.expr(0)?) } else { None };
                    self.esp(T::Do)?;
                    let n0 = self.f().activos.len();
                    let var = self.declarar(n1);
                    self.activar(var);
                    let cuerpo = self.bloque();
                    self.f().activos.truncate(n0);
                    let cuerpo = cuerpo?;
                    self.esp(T::End)?;
                    Sent::ForNum { var, ini, fin, paso, cuerpo }
                } else {
                    let mut ns = vec![n1];
                    while self.opt(T::Coma) { ns.push(self.nombre()?); }
                    self.esp(T::In)?;
                    let exps = self.explist()?;
                    self.esp(T::Do)?;
                    let n0 = self.f().activos.len();
                    let vars: Vec<u32> = ns.into_iter().map(|n| self.declarar(n)).collect();
                    for &v in &vars { self.activar(v); }
                    let cuerpo = self.bloque();
                    self.f().activos.truncate(n0);
                    let cuerpo = cuerpo?;
                    self.esp(T::End)?;
                    Sent::ForIn { vars, exps, cuerpo }
                }
            }
            T::Repeat => {
                self.p += 1;
                // (la condición ve los locales del cuerpo)
                let n0 = self.f().activos.len();
                self.prof_bloque += 1;
                let cuerpo = self.bloque_sin_ambito();
                let r = match cuerpo {
                    Ok(cuerpo) => match self.esp(T::Until).and_then(|_| self.expr(0)) { Ok(cond) => Ok(Sent::Repeat { cuerpo, cond }), Err(e) => Err(e) },
                    Err(e) => Err(e),
                };
                self.prof_bloque -= 1;
                self.f().activos.truncate(n0);
                r?
            }
            T::Function => {
                self.p += 1;
                let n1 = self.nombre()?;
                let mut n = self.resolver(&n1);
                let mut met = false;
                while matches!(self.tipo(), T::Punto | T::DosPuntos) {
                    let dos = matches!(self.tipo(), T::DosPuntos);
                    self.p += 1;
                    let k = self.nombre()?;
                    n = Exp::Indice(Box::new(n), Box::new(Exp::Cad(k)));
                    if dos { met = true; break; }
                }
                let f = self.cuerpo(met, ln)?;
                Sent::Asignar { izq: vec![n], der: vec![Exp::Funcion(Box::new(f))] }
            }
            T::Local => {
                self.p += 1;
                if self.opt(T::Function) {
                    let nm = self.nombre()?;
                    let id = self.declarar(nm);
                    self.activar(id);
                    let f = self.cuerpo(false, ln)?;
                    Sent::LocalFuncion { id, f: Box::new(f) }
                } else {
                    let mut ns = vec![self.nombre()?];
                    self.atributo()?;
                    while self.opt(T::Coma) { ns.push(self.nombre()?); self.atributo()?; }
                    let exps = if self.opt(T::Asig) { self.explist()? } else { vec![] };
                    let ids: Vec<u32> = ns.into_iter().map(|n| self.declarar(n)).collect();
                    for &id in &ids { self.activar(id); }
                    Sent::Local { ids, exps }
                }
            }
            T::Return => return self.err("return en medio del bloque"),
            T::Break => { self.p += 1; Sent::Break }
            T::Continue => { self.p += 1; Sent::Continue }
            T::Goto => {
                self.p += 1;
                let l = if matches!(self.tipo(), T::Continue) { self.p += 1; Cadena::interna(b"continue") } else { self.nombre()? };
                Sent::Goto(l)
            }
            T::DosDos => {
                self.p += 1;
                let l = if matches!(self.tipo(), T::Continue) { self.p += 1; Cadena::interna(b"continue") } else { self.nombre()? };
                self.esp(T::DosDos)?;
                Sent::Etiqueta(l)
            }
            _ => {
                // asignación o llamada
                let e = self.sufijo()?;
                if matches!(self.tipo(), T::Asig | T::Coma) {
                    let mut izq = vec![e];
                    while self.opt(T::Coma) { izq.push(self.sufijo()?); }
                    self.esp(T::Asig)?;
                    let der = self.explist()?;
                    for x in &izq {
                        if !matches!(x, Exp::Local(_) | Exp::Up(_) | Exp::Global(_) | Exp::Indice(..)) { return self.err("no se puede asignar"); }
                    }
                    Sent::Asignar { izq, der }
                } else {
                    if !matches!(e, Exp::Llamada(..) | Exp::Metodo(..)) { return self.err("sentencia rara"); }
                    // module("x", package.seeall) arriba de todo
                    let es_mod = self.fs.len() == 1 && self.prof_bloque == 1
                        && matches!(&e, Exp::Llamada(f, _) if matches!(&**f, Exp::Global(n) if n.bytes() == b"module"));
                    if es_mod {
                        self.con_modulo = true;
                        if let Exp::Llamada(_, args) = e { Sent::Modulo(args) } else { unreachable!() }
                    } else {
                        Sent::Llamada(e)
                    }
                }
            }
        };
        Ok(Some(Sentencia { s, ln }))
    }
    /// los atributos de Lua 5.4 (<const>, <close>): se ignoran
    fn atributo(&mut self) -> R<()> {
        if matches!(self.tipo(), T::Menor) {
            if let Some(Ficha { t: T::Nom(_), .. }) = self.t.get(self.p + 1) {
                if let Some(Ficha { t: T::Mayor, .. }) = self.t.get(self.p + 2) { self.p += 3; }
            }
        }
        Ok(())
    }
    fn cuerpo(&mut self, met: bool, ln: u32) -> R<FuncAst> {
        self.fs.push(FuncP { locales: vec![], activos: vec![], ups: vec![], es_vararg: false });
        let r = self.cuerpo_interno(met);
        let f = self.fs.pop().unwrap();
        let (params, cuerpo) = r?;
        Ok(FuncAst { params, es_vararg: f.es_vararg, cuerpo, ln, locales: f.locales, ups: f.ups, con_modulo: false })
    }
    fn cuerpo_interno(&mut self, met: bool) -> R<(Vec<u32>, Vec<Sentencia>)> {
        self.esp(T::AbreP)?;
        let mut params = vec![];
        if met { let id = self.declarar(Cadena::interna(b"self")); self.activar(id); params.push(id); }
        if !matches!(self.tipo(), T::CierraP) {
            loop {
                if matches!(self.tipo(), T::Tres) { self.p += 1; self.f().es_vararg = true; break; }
                let n = self.nombre()?;
                let id = self.declarar(n);
                self.activar(id);
                params.push(id);
                if !self.opt(T::Coma) { break; }
            }
        }
        self.esp(T::CierraP)?;
        let prof0 = self.prof_bloque;
        self.prof_bloque = 100;
        let b = self.bloque();
        self.prof_bloque = prof0;
        let b = b?;
        self.esp(T::End)?;
        Ok((params, b))
    }
    fn explist(&mut self) -> R<Vec<Exp>> {
        let mut l = vec![self.expr(0)?];
        while self.opt(T::Coma) { l.push(self.expr(0)?); }
        Ok(l)
    }
    fn primario(&mut self) -> R<Exp> {
        if let T::Nom(n) = self.tipo() { let n = n.clone(); self.p += 1; return Ok(self.resolver(&n)); }
        if self.opt(T::AbreP) {
            let e = self.expr(0)?;
            self.esp(T::CierraP)?;
            return Ok(Exp::Paren(Box::new(e)));
        }
        self.err("expresión rara")
    }
    fn sufijo(&mut self) -> R<Exp> {
        let mut e = self.primario()?;
        loop {
            match self.tipo() {
                T::Punto => { self.p += 1; let k = self.nombre()?; e = Exp::Indice(Box::new(e), Box::new(Exp::Cad(k))); }
                T::AbreC => { self.p += 1; let i = self.expr(0)?; self.esp(T::CierraC)?; e = Exp::Indice(Box::new(e), Box::new(i)); }
                T::DosPuntos => {
                    self.p += 1;
                    let m = self.nombre()?;
                    let a = self.args()?;
                    e = Exp::Metodo(Box::new(e), m, a);
                }
                T::AbreP | T::Cad(_) | T::AbreL => { let a = self.args()?; e = Exp::Llamada(Box::new(e), a); }
                _ => return Ok(e),
            }
        }
    }
    fn args(&mut self) -> R<Vec<Exp>> {
        if let T::Cad(s) = self.tipo() { let s = s.clone(); self.p += 1; return Ok(vec![Exp::Cad(s)]); }
        if matches!(self.tipo(), T::AbreL) { return Ok(vec![self.tabla()?]); }
        self.esp(T::AbreP)?;
        if self.opt(T::CierraP) { return Ok(vec![]); }
        let l = self.explist()?;
        self.esp(T::CierraP)?;
        Ok(l)
    }
    fn tabla(&mut self) -> R<Exp> {
        self.esp(T::AbreL)?;
        let mut items = vec![];
        while !matches!(self.tipo(), T::CierraL) {
            if matches!(self.tipo(), T::AbreC) {
                self.p += 1;
                let k = self.expr(0)?;
                self.esp(T::CierraC)?;
                self.esp(T::Asig)?;
                items.push(Campo::Clave(k, self.expr(0)?));
            } else if matches!(self.tipo(), T::Nom(_)) && matches!(self.t[self.p + 1].t, T::Asig) {
                let k = self.nombre()?;
                self.p += 1;
                items.push(Campo::Clave(Exp::Cad(k), self.expr(0)?));
            } else {
                items.push(Campo::Pos(self.expr(0)?));
            }
            if !self.opt(T::Coma) && !self.opt(T::PuntoComa) { break; }
        }
        self.esp(T::CierraL)?;
        Ok(Exp::Tabla(items))
    }
    fn simple(&mut self) -> R<Exp> {
        let e = match self.tipo() {
            T::Num(n) => Exp::Num(*n),
            T::Cad(s) => Exp::Cad(s.clone()),
            T::Nil => Exp::Nil,
            T::True => Exp::True,
            T::False => Exp::False,
            T::Tres => {
                if !self.fs.last().unwrap().es_vararg {
                    return Err(format!("{}: no se puede usar '...' fuera de una función con '...'", self.archivo));
                }
                Exp::Vararg
            }
            T::AbreL => return self.tabla(),
            T::Function => { let ln = self.ln(); self.p += 1; return Ok(Exp::Funcion(Box::new(self.cuerpo(false, ln)?))); }
            _ => return self.sufijo(),
        };
        self.p += 1;
        Ok(e)
    }
    fn expr(&mut self, lim: u8) -> R<Exp> {
        self.nivel += 1;
        let r = if self.nivel > MAX_NIVEL { self.err("demasiados niveles de anidamiento") } else { self.expr_interna(lim) };
        self.nivel -= 1;
        r
    }
    fn expr_interna(&mut self, lim: u8) -> R<Exp> {
        let mut e = match self.tipo() {
            T::Not => { self.p += 1; Exp::Un(OpUn::Not, Box::new(self.expr(8)?)) }
            T::Menos => {
                self.p += 1;
                let x = self.expr(8)?;
                // (los números negativos quedan como constantes)
                if let Exp::Num(n) = x { Exp::Num(-n) } else { Exp::Un(OpUn::Neg, Box::new(x)) }
            }
            T::Numeral => { self.p += 1; Exp::Un(OpUn::Largo, Box::new(self.expr(8)?)) }
            _ => self.simple()?,
        };
        let mut largo = 0u32;
        loop {
            let (izq, der, op) = match PRI(self.tipo()) { Some(x) => x, None => return Ok(e) };
            if izq <= lim { return Ok(e); }
            self.p += 1;
            if op == OpBin::Concat {
                // a .. b .. c: los operandos en una lista (es asociativo a la derecha; se evalúan en orden igual)
                let _ = der;
                let mut l = vec![e, self.expr(5)?];
                while matches!(self.tipo(), T::Concat) {
                    self.p += 1;
                    l.push(self.expr(5)?);
                }
                e = Exp::Concat(l);
                continue;
            }
            let d = self.expr(der)?;
            largo += 1;
            if largo > MAX_NIVEL { return self.err("expresión demasiado larga"); }
            e = Exp::Bin(op, Box::new(e), Box::new(d));
        }
    }
}

fn buscar_activo(f: &FuncP, nombre: &Rc<Cadena>) -> Option<u32> {
    f.activos.iter().rev().find(|(n, _)| Cadena::igual(n, nombre)).map(|(_, id)| *id)
}
