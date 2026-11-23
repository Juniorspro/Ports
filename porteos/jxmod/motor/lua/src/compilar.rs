//! Del árbol al código de la máquina (lo que en la web es `luaGenerar`, que lo traduce a JavaScript). Los locales van en
//! registros fijos de la función; los temporales, arriba (como una pila); los locales que captura una función de
//! adentro, en celdas. Las condiciones de if/while/repeat saltan directo sin armar booleanos.
use std::collections::HashMap;
use std::rc::Rc;

use crate::codigo::*;
use crate::sintaxis::*;
use crate::valor::{Cadena, ClaveCad, FxBuild, Valor};

type R<X> = Result<X, String>;

#[derive(Clone, Copy)]
enum Ubic { Sin, Reg(u16), Celda(u16) }

#[derive(Hash, PartialEq, Eq)]
enum ClaveK { Nil, Bool(bool), Num(u64), Cad(ClaveCad) }

#[derive(Default)]
struct Lazo { breaks: Vec<usize>, conts: Vec<usize> }

struct BloqueG {
    /// las etiquetas que hay en este bloque (vistas de antemano: un goto puede ir hacia adelante)
    nombres: Vec<Rc<Cadena>>,
    etiquetas: Vec<(Rc<Cadena>, usize)>,
    pendientes: Vec<(Rc<Cadena>, usize)>,
}

struct Gen<'a> {
    ast: &'a FuncAst,
    archivo: Rc<str>,
    con_modulo: bool,
    codigo: Vec<Op>,
    lineas: Vec<u32>,
    k: Vec<Valor>,
    kmap: HashMap<ClaveK, u32, FxBuild>,
    hijos: Vec<Rc<Proto>>,
    nombres: Vec<(u32, u32)>,
    ubic: Vec<Ubic>,
    nact: u16,
    libre: u16,
    max: u16,
    celda_libre: u16,
    celda_max: u16,
    lazos: Vec<Lazo>,
    bloques: Vec<BloqueG>,
    ln: u32,
}

/// compilar la función principal de un archivo
pub(crate) fn compilar(f: &FuncAst, archivo: &Rc<str>) -> R<Rc<Proto>> { compilar_func(f, archivo, f.con_modulo, vec![]) }

fn compilar_func(f: &FuncAst, archivo: &Rc<str>, con_modulo: bool, ups: Vec<(bool, u16)>) -> R<Rc<Proto>> {
    let mut g = Gen {
        ast: f,
        archivo: archivo.clone(),
        con_modulo,
        codigo: Vec::with_capacity(64),
        lineas: Vec::with_capacity(64),
        k: vec![],
        kmap: HashMap::default(),
        hijos: vec![],
        nombres: vec![],
        ubic: vec![Ubic::Sin; f.locales.len()],
        nact: 0,
        libre: 0,
        max: 0,
        celda_libre: 0,
        celda_max: 0,
        lazos: vec![],
        bloques: vec![],
        ln: f.ln,
    };
    let np = f.params.len();
    g.reservar(np)?;
    g.nact = np as u16;
    for (i, &id) in f.params.iter().enumerate() { g.declarar(id, i as u16)?; }
    g.bloque(&f.cuerpo)?;
    g.emit(Op::Retornar(0, 1));
    Ok(Rc::new(Proto {
        codigo: g.codigo,
        lineas: g.lineas,
        k: g.k,
        hijos: g.hijos,
        ups,
        n_params: np,
        es_vararg: f.es_vararg,
        max_regs: (g.max as usize).max(np) + 1,
        n_celdas: g.celda_max as usize,
        archivo: archivo.clone(),
        linea: f.ln,
        nombres: g.nombres,
    }))
}

fn es_multi(e: &Exp) -> bool { matches!(e, Exp::Llamada(..) | Exp::Metodo(..) | Exp::Vararg) }
fn es_llamada(e: &Exp) -> bool { matches!(e, Exp::Llamada(..) | Exp::Metodo(..)) }

/// las cuentas con constantes se hacen al compilar (con las mismas reglas que en la máquina)
fn plegar(op: OpBin, x: f64, y: f64) -> Option<f64> {
    Some(match op {
        OpBin::Mas => x + y,
        OpBin::Menos => x - y,
        OpBin::Por => x * y,
        OpBin::Div => x / y,
        OpBin::Mod => crate::vm::modulo(x, y),
        OpBin::Pot => crate::vm::potencia(x, y),
        _ => return None,
    })
}

impl<'a> Gen<'a> {
    fn error<X>(&self, m: &str) -> R<X> { Err(format!("{}:{}: {}", self.archivo, self.ln, m)) }
    #[inline]
    fn emit(&mut self, op: Op) -> usize {
        self.codigo.push(op);
        self.lineas.push(self.ln);
        self.codigo.len() - 1
    }
    fn aqui(&self) -> usize { self.codigo.len() }
    fn saltar(&mut self) -> usize { self.emit(Op::Saltar(0)) }
    fn parchear(&mut self, j: usize, destino: usize) { self.codigo[j] = Op::Saltar((destino as i64 - (j as i64 + 1)) as i32); }
    fn parchear_aqui(&mut self, js: Vec<usize>) { let t = self.aqui(); for j in js { self.parchear(j, t); } }
    fn reservar(&mut self, n: usize) -> R<u16> {
        let r = self.libre;
        let nuevo = self.libre as usize + n;
        if nuevo > 30000 { return self.error("función o expresión demasiado compleja"); }
        self.libre = nuevo as u16;
        if self.libre > self.max { self.max = self.libre; }
        Ok(r)
    }
    fn celda_nueva(&mut self) -> R<u16> {
        let c = self.celda_libre;
        if c >= 30000 { return self.error("demasiadas variables capturadas"); }
        self.celda_libre += 1;
        if self.celda_libre > self.celda_max { self.celda_max = self.celda_libre; }
        Ok(c)
    }
    fn declarar(&mut self, id: u32, r: u16) -> R<()> {
        if self.ast.locales[id as usize].capturada {
            let c = self.celda_nueva()?;
            self.emit(Op::CeldaNueva(c, r));
            self.ubic[id as usize] = Ubic::Celda(c);
        } else {
            self.ubic[id as usize] = Ubic::Reg(r);
        }
        Ok(())
    }

    // ---- constantes ----
    fn k_de(&mut self, clave: ClaveK, v: impl FnOnce() -> Valor) -> u32 {
        if let Some(&i) = self.kmap.get(&clave) { return i; }
        let i = self.k.len() as u32;
        self.k.push(v());
        self.kmap.insert(clave, i);
        i
    }
    fn k_num(&mut self, n: f64) -> u32 { self.k_de(ClaveK::Num(n.to_bits()), || Valor::Num(n)) }
    fn k_cad(&mut self, s: &Rc<Cadena>) -> u32 { let s2 = s.clone(); self.k_de(ClaveK::Cad(ClaveCad(s.clone())), move || Valor::Cad(s2)) }
    fn k_exp(&mut self, e: &Exp) -> Option<u32> {
        Some(match e {
            Exp::Num(n) => self.k_num(*n),
            Exp::Cad(s) => self.k_cad(s),
            Exp::Nil => self.k_de(ClaveK::Nil, || Valor::Nil),
            Exp::True => self.k_de(ClaveK::Bool(true), || Valor::Bool(true)),
            Exp::False => self.k_de(ClaveK::Bool(false), || Valor::Bool(false)),
            _ => return None,
        })
    }
    /// una clave de texto constante que entra en IndexarK/AsignarK
    fn clave_k(&mut self, e: &Exp) -> Option<u16> {
        if let Exp::Cad(s) = e { let k = self.k_cad(s); if k <= u16::MAX as u32 { return Some(k as u16); } }
        None
    }
    fn nombre_de(&mut self, e: &Exp) -> Option<u32> {
        let n = match e {
            Exp::Global(n) => n.clone(),
            Exp::Local(id) => self.ast.locales[*id as usize].nombre.clone(),
            Exp::Up(u) => self.ast.ups[*u as usize].nombre.clone(),
            Exp::Indice(_, k) => match &**k { Exp::Cad(s) => s.clone(), _ => return None },
            _ => return None,
        };
        Some(self.k_cad(&n))
    }

    // ---- bloques ----
    fn abrir_bloque(&mut self, stmts: &[Sentencia]) {
        let nombres = stmts.iter().filter_map(|s| if let Sent::Etiqueta(n) = &s.s { Some(n.clone()) } else { None }).collect();
        self.bloques.push(BloqueG { nombres, etiquetas: vec![], pendientes: vec![] });
    }
    fn cerrar_bloque(&mut self) { self.bloques.pop(); }
    fn bloque(&mut self, stmts: &[Sentencia]) -> R<()> {
        let (nact0, celda0) = (self.nact, self.celda_libre);
        self.abrir_bloque(stmts);
        for s in stmts { self.sent(s)?; }
        self.cerrar_bloque();
        self.nact = nact0;
        self.libre = nact0;
        self.celda_libre = celda0;
        Ok(())
    }

    // ---- sentencias ----
    fn sent(&mut self, st: &Sentencia) -> R<()> {
        self.ln = st.ln;
        match &st.s {
            Sent::Local { ids, exps } => {
                let base = self.libre;
                self.explist_n(exps, ids.len())?;
                for (i, &id) in ids.iter().enumerate() { self.declarar(id, base + i as u16)?; }
                self.nact = base + ids.len() as u16;
            }
            Sent::LocalFuncion { id, f } => {
                let r = self.reservar(1)?;
                self.nact = self.libre;
                if self.ast.locales[*id as usize].capturada {
                    let c = self.celda_nueva()?;
                    self.emit(Op::CeldaNueva(c, NINGUNO));
                    self.ubic[*id as usize] = Ubic::Celda(c);
                    let p = self.hijo(f)?;
                    self.emit(Op::Clausura(r, p));
                    self.emit(Op::CeldaEscribir(c, r));
                } else {
                    self.ubic[*id as usize] = Ubic::Reg(r);
                    let p = self.hijo(f)?;
                    self.emit(Op::Clausura(r, p));
                }
            }
            Sent::Asignar { izq, der } => {
                if izq.len() == 1 && der.len() == 1 { self.asignar1(&izq[0], &der[0])?; } else { self.asignar_varios(izq, der)?; }
            }
            Sent::Llamada(e) => { self.llamada(e, 0)?; }
            Sent::Modulo(args) => {
                let base = self.libre;
                let abierta = self.explist_abierta(args)?;
                let b = if abierta { 0 } else { self.libre - base + 1 };
                self.emit(Op::Modulo(base, b));
            }
            Sent::Do(b) => self.bloque(b)?,
            Sent::If { ramas, otro } => {
                let mut fin = vec![];
                let n = ramas.len();
                for (i, (c, b)) in ramas.iter().enumerate() {
                    let f = self.cond_falso(c)?;
                    self.bloque(b)?;
                    if i + 1 < n || otro.is_some() { fin.push(self.saltar()); }
                    self.parchear_aqui(f);
                }
                if let Some(o) = otro { self.bloque(o)?; }
                self.parchear_aqui(fin);
            }
            Sent::While { cond, cuerpo } => {
                let inicio = self.aqui();
                let salida = self.cond_falso(cond)?;
                self.lazos.push(Lazo::default());
                self.bloque(cuerpo)?;
                let j = self.saltar();
                self.parchear(j, inicio);
                let lz = self.lazos.pop().unwrap();
                let fin = self.aqui();
                for j in salida.into_iter().chain(lz.breaks) { self.parchear(j, fin); }
                for j in lz.conts { self.parchear(j, inicio); }
            }
            Sent::Repeat { cuerpo, cond } => {
                let inicio = self.aqui();
                let (nact0, celda0) = (self.nact, self.celda_libre);
                self.lazos.push(Lazo::default());
                self.abrir_bloque(cuerpo);
                for s in cuerpo { self.sent(s)?; }
                self.ln = st.ln;
                let cont = self.aqui();
                let falsos = self.cond_falso(cond)?;
                for j in falsos { self.parchear(j, inicio); }
                self.cerrar_bloque();
                self.nact = nact0;
                self.libre = nact0;
                self.celda_libre = celda0;
                let lz = self.lazos.pop().unwrap();
                for j in lz.conts { self.parchear(j, cont); }
                let fin = self.aqui();
                for j in lz.breaks { self.parchear(j, fin); }
            }
            Sent::ForNum { var, ini, fin, paso, cuerpo } => {
                let (nact0, celda0) = (self.nact, self.celda_libre);
                let base = self.reservar(3)?;
                self.exp_a(ini, base)?;
                self.exp_a(fin, base + 1)?;
                match paso {
                    Some(p) => self.exp_a(p, base + 2)?,
                    None => { let k = self.k_num(1.0); self.emit(Op::CargarK(base + 2, k)); }
                }
                self.nact = self.libre;
                let prep = self.emit(Op::ForPrep(base, 0));
                let r = self.reservar(1)?;
                self.nact = self.libre;
                let cuerpo_ini = self.aqui();
                self.declarar(*var, r)?;
                self.lazos.push(Lazo::default());
                self.abrir_bloque(cuerpo);
                for s in cuerpo { self.sent(s)?; }
                self.cerrar_bloque();
                let lz = self.lazos.pop().unwrap();
                self.ln = st.ln;
                let lp = self.emit(Op::ForLoop(base, 0));
                self.codigo[lp] = Op::ForLoop(base, (cuerpo_ini as i64 - (lp as i64 + 1)) as i32);
                let salida = self.aqui();
                self.codigo[prep] = Op::ForPrep(base, (salida as i64 - (prep as i64 + 1)) as i32);
                for j in lz.conts { self.parchear(j, lp); }
                for j in lz.breaks { self.parchear(j, salida); }
                self.nact = nact0;
                self.libre = nact0;
                self.celda_libre = celda0;
            }
            Sent::ForIn { vars, exps, cuerpo } => {
                let (nact0, celda0) = (self.nact, self.celda_libre);
                let base = self.libre;
                self.explist_n(exps, 3)?;
                self.nact = self.libre;
                let salto = self.saltar();
                let nv = vars.len();
                self.reservar(nv.max(3))?;
                self.nact = base + 3 + nv as u16;
                self.libre = self.nact;
                let cuerpo_ini = self.aqui();
                for (i, &v) in vars.iter().enumerate() { self.declarar(v, base + 3 + i as u16)?; }
                self.lazos.push(Lazo::default());
                self.abrir_bloque(cuerpo);
                for s in cuerpo { self.sent(s)?; }
                self.cerrar_bloque();
                let lz = self.lazos.pop().unwrap();
                self.ln = st.ln;
                let llamada = self.aqui();
                self.parchear(salto, llamada);
                self.emit(Op::TForCall(base, nv as u16));
                let lp = self.emit(Op::TForLoop(base, 0));
                self.codigo[lp] = Op::TForLoop(base, (cuerpo_ini as i64 - (lp as i64 + 1)) as i32);
                let salida = self.aqui();
                for j in lz.conts { self.parchear(j, llamada); }
                for j in lz.breaks { self.parchear(j, salida); }
                self.nact = nact0;
                self.libre = nact0;
                self.celda_libre = celda0;
            }
            Sent::Return(exps) => {
                if exps.len() == 1 {
                    if let Exp::Local(id) = &exps[0] {
                        if let Ubic::Reg(r) = self.ubic[*id as usize] { self.emit(Op::Retornar(r, 2)); return Ok(()); }
                    }
                }
                let base = self.libre;
                let abierta = self.explist_abierta(exps)?;
                let b = if abierta { 0 } else { self.libre - base + 1 };
                self.emit(Op::Retornar(base, b));
            }
            Sent::Break => {
                if self.lazos.is_empty() { return self.error("'break' fuera de un bucle"); }
                let j = self.saltar();
                self.lazos.last_mut().unwrap().breaks.push(j);
            }
            Sent::Continue => self.continuar()?,
            Sent::Goto(n) => {
                let mut hecho = false;
                for bi in (0..self.bloques.len()).rev() {
                    if self.bloques[bi].nombres.iter().any(|x| Cadena::igual(x, n)) {
                        let ya = self.bloques[bi].etiquetas.iter().find(|(x, _)| Cadena::igual(x, n)).map(|x| x.1);
                        let j = self.saltar();
                        match ya {
                            Some(pc) => self.parchear(j, pc),
                            None => self.bloques[bi].pendientes.push((n.clone(), j)),
                        }
                        hecho = true;
                        break;
                    }
                }
                if !hecho {
                    // (el «goto continue» sin la etiqueta: el siguiente paso del bucle, como la web)
                    let b = n.bytes();
                    if b.len() >= 4 && b[..4].eq_ignore_ascii_case(b"cont") { self.continuar()?; } else {
                        return self.error(&format!("no visible label '{}' for goto", n.texto()));
                    }
                }
            }
            Sent::Etiqueta(n) => {
                let pc = self.aqui();
                let b = self.bloques.last_mut().unwrap();
                b.etiquetas.push((n.clone(), pc));
                let pend: Vec<usize> = b.pendientes.iter().filter(|(x, _)| Cadena::igual(x, n)).map(|x| x.1).collect();
                b.pendientes.retain(|(x, _)| !Cadena::igual(x, n));
                for j in pend { self.parchear(j, pc); }
            }
        }
        self.libre = self.nact;
        Ok(())
    }
    fn continuar(&mut self) -> R<()> {
        if self.lazos.is_empty() { return self.error("continue fuera de un bucle"); }
        let j = self.saltar();
        self.lazos.last_mut().unwrap().conts.push(j);
        Ok(())
    }
    fn asignar1(&mut self, x: &Exp, v: &Exp) -> R<()> {
        match x {
            Exp::Local(id) => match self.ubic[*id as usize] {
                Ubic::Reg(r) => self.exp_a(v, r)?,
                Ubic::Celda(c) => { let rv = self.exp_rk(v)?; self.emit(Op::CeldaEscribir(c, rv)); }
                Ubic::Sin => return self.error("local sin declarar"),
            },
            Exp::Up(u) => { let rv = self.exp_rk(v)?; self.emit(Op::EscribirUp(*u as u16, rv)); }
            Exp::Global(n) => {
                let rv = self.exp_rk(v)?;
                let k = self.k_cad(n);
                self.emit(if self.con_modulo { Op::EscribirGlobalM(k, rv) } else { Op::EscribirGlobal(k, rv) });
            }
            Exp::Indice(t, key) => {
                let rt = self.exp_r(t)?;
                if let Some(kc) = self.clave_k(key) {
                    let rv = self.exp_rk(v)?;
                    self.emit(Op::AsignarK(rt, kc, rv));
                } else {
                    let rk = self.exp_rk(key)?;
                    let rv = self.exp_rk(v)?;
                    self.emit(Op::Asignar(rt, rk, rv));
                }
            }
            _ => return self.error("no se puede asignar"),
        }
        Ok(())
    }
    fn asignar_varios(&mut self, izq: &[Exp], der: &[Exp]) -> R<()> {
        // (primero lo de la izquierda que se evalúa: tablas y claves, en temporales; después todo lo de la derecha)
        let mut dest: Vec<(u16, u16)> = Vec::with_capacity(izq.len());
        for x in izq {
            if let Exp::Indice(t, key) = x {
                let rt = self.exp_nuevo(t)?;
                let rk = match self.k_exp(key) { Some(k) if k < K_BIT as u32 => K_BIT | k as u16, _ => self.exp_nuevo(key)? };
                dest.push((rt, rk));
            } else {
                dest.push((0, 0));
            }
        }
        let base = self.libre;
        self.explist_n(der, izq.len())?;
        for (i, x) in izq.iter().enumerate() {
            let v = base + i as u16;
            match x {
                Exp::Local(id) => match self.ubic[*id as usize] {
                    Ubic::Reg(r) => { self.emit(Op::Mover(r, v)); }
                    Ubic::Celda(c) => { self.emit(Op::CeldaEscribir(c, v)); }
                    Ubic::Sin => return self.error("local sin declarar"),
                },
                Exp::Up(u) => { self.emit(Op::EscribirUp(*u as u16, v)); }
                Exp::Global(n) => {
                    let k = self.k_cad(n);
                    self.emit(if self.con_modulo { Op::EscribirGlobalM(k, v) } else { Op::EscribirGlobal(k, v) });
                }
                Exp::Indice(..) => { let (rt, rk) = dest[i]; self.emit(Op::Asignar(rt, rk, v)); }
                _ => return self.error("no se puede asignar"),
            }
        }
        Ok(())
    }

    fn hijo(&mut self, f: &FuncAst) -> R<u32> {
        let mut ups = Vec::with_capacity(f.ups.len());
        for u in &f.ups {
            if u.de_local {
                match self.ubic[u.idx as usize] {
                    Ubic::Celda(c) => ups.push((true, c)),
                    _ => return self.error("upvalue de un local sin celda"),
                }
            } else {
                ups.push((false, u.idx as u16));
            }
        }
        let p = compilar_func(f, &self.archivo, self.con_modulo, ups)?;
        self.hijos.push(p);
        Ok(self.hijos.len() as u32 - 1)
    }

    // ---- expresiones ----
    /// poner el valor de e en el registro dst
    fn exp_a(&mut self, e: &Exp, dst: u16) -> R<()> {
        match e {
            Exp::Nil => { self.emit(Op::CargarNil(dst, 1)); }
            Exp::True => { self.emit(Op::CargarBool(dst, true)); }
            Exp::False => { self.emit(Op::CargarBool(dst, false)); }
            Exp::Num(n) => { let k = self.k_num(*n); self.emit(Op::CargarK(dst, k)); }
            Exp::Cad(s) => { let k = self.k_cad(s); self.emit(Op::CargarK(dst, k)); }
            Exp::Vararg => { self.emit(Op::Vararg(dst, 2)); }
            Exp::Local(id) => match self.ubic[*id as usize] {
                Ubic::Reg(r) => { if r != dst { self.emit(Op::Mover(dst, r)); } }
                Ubic::Celda(c) => { self.emit(Op::CeldaLeer(dst, c)); }
                Ubic::Sin => { self.emit(Op::CargarNil(dst, 1)); }
            },
            Exp::Up(u) => { self.emit(Op::LeerUp(dst, *u as u16)); }
            Exp::Global(n) => {
                let k = self.k_cad(n);
                self.emit(if self.con_modulo { Op::LeerGlobalM(dst, k) } else { Op::LeerGlobal(dst, k) });
            }
            Exp::Indice(t, key) => {
                let f0 = self.libre;
                let rt = self.exp_r(t)?;
                if let Some(kc) = self.clave_k(key) {
                    self.emit(Op::IndexarK(dst, rt, kc));
                } else {
                    let rk = self.exp_rk(key)?;
                    self.emit(Op::Indexar(dst, rt, rk));
                }
                self.libre = f0;
            }
            Exp::Llamada(..) | Exp::Metodo(..) => {
                let f0 = self.libre;
                let base = self.llamada(e, 1)?;
                if base != dst { self.emit(Op::Mover(dst, base)); }
                self.libre = f0;
            }
            Exp::Funcion(f) => { let p = self.hijo(f)?; self.emit(Op::Clausura(dst, p)); }
            Exp::Paren(x) => self.exp_a(x, dst)?,
            Exp::Tabla(c) => {
                if dst < self.nact || dst + 1 != self.libre {
                    let f0 = self.libre;
                    let t = self.reservar(1)?;
                    self.tabla(c, t)?;
                    self.emit(Op::Mover(dst, t));
                    self.libre = f0;
                } else {
                    self.tabla(c, dst)?;
                }
            }
            Exp::Bin(op, a, b) => self.binaria(*op, a, b, dst)?,
            Exp::Concat(l) => {
                let f0 = self.libre;
                let base = self.libre;
                for o in l { self.exp_nuevo(o)?; }
                if l.len() > u16::MAX as usize { return self.error("expresión demasiado larga"); }
                self.emit(Op::Concat(dst, base, l.len() as u16));
                self.libre = f0;
            }
            Exp::Un(op, a) => {
                let f0 = self.libre;
                let r = self.exp_r(a)?;
                self.emit(match op { OpUn::Neg => Op::Neg(dst, r), OpUn::Not => Op::Not(dst, r), OpUn::Largo => Op::Largo(dst, r) });
                self.libre = f0;
            }
        }
        Ok(())
    }
    fn binaria(&mut self, op: OpBin, a: &Exp, b: &Exp, dst: u16) -> R<()> {
        match op {
            OpBin::And | OpBin::Or => {
                if dst < self.nact {
                    let f0 = self.libre;
                    let t = self.reservar(1)?;
                    self.binaria(op, a, b, t)?;
                    self.emit(Op::Mover(dst, t));
                    self.libre = f0;
                    return Ok(());
                }
                self.exp_a(a, dst)?;
                self.emit(Op::Probar(dst, op == OpBin::Or));
                let j = self.saltar();
                self.exp_a(b, dst)?;
                self.parchear_aqui(vec![j]);
            }
            OpBin::Concat => {
                let mut ops: Vec<&Exp> = vec![a];
                let mut x = b;
                while let Exp::Bin(OpBin::Concat, l, r) = x { ops.push(l); x = r; }
                ops.push(x);
                let f0 = self.libre;
                let base = self.libre;
                for o in &ops { self.exp_nuevo(o)?; }
                self.emit(Op::Concat(dst, base, ops.len() as u16));
                self.libre = f0;
            }
            OpBin::Igual | OpBin::Distinto | OpBin::Menor | OpBin::MenorIg | OpBin::Mayor | OpBin::MayorIg => {
                let f0 = self.libre;
                let rb = self.exp_rk(a)?;
                let rc = self.exp_rk(b)?;
                self.emit(match op {
                    OpBin::Igual => Op::Igual(dst, rb, rc),
                    OpBin::Distinto => Op::Distinto(dst, rb, rc),
                    OpBin::Menor => Op::Menor(dst, rb, rc),
                    OpBin::MenorIg => Op::MenorIg(dst, rb, rc),
                    OpBin::Mayor => Op::Menor(dst, rc, rb),
                    _ => Op::MenorIg(dst, rc, rb),
                });
                self.libre = f0;
            }
            _ => {
                if let (Exp::Num(x), Exp::Num(y)) = (a, b) {
                    if let Some(v) = plegar(op, *x, *y) { let k = self.k_num(v); self.emit(Op::CargarK(dst, k)); return Ok(()); }
                }
                let f0 = self.libre;
                let rb = self.exp_rk(a)?;
                let rc = self.exp_rk(b)?;
                self.emit(match op {
                    OpBin::Mas => Op::Sumar(dst, rb, rc),
                    OpBin::Menos => Op::Restar(dst, rb, rc),
                    OpBin::Por => Op::Mult(dst, rb, rc),
                    OpBin::Div => Op::Div(dst, rb, rc),
                    OpBin::Mod => Op::Mod(dst, rb, rc),
                    _ => Op::Pot(dst, rb, rc),
                });
                self.libre = f0;
            }
        }
        Ok(())
    }
    /// un registro con el valor de e: el del local si es uno, o un temporal nuevo
    fn exp_r(&mut self, e: &Exp) -> R<u16> {
        let mut x = e;
        while let Exp::Paren(y) = x { x = y; }
        if let Exp::Local(id) = x { if let Ubic::Reg(r) = self.ubic[*id as usize] { return Ok(r); } }
        self.exp_nuevo(e)
    }
    /// e en un temporal nuevo (el siguiente libre)
    fn exp_nuevo(&mut self, e: &Exp) -> R<u16> {
        if es_llamada(e) { return self.llamada(e, 1); }
        let r = self.reservar(1)?;
        self.exp_a(e, r)?;
        Ok(r)
    }
    /// un operando: constante si se puede, si no un registro
    fn exp_rk(&mut self, e: &Exp) -> R<u16> {
        if let Some(k) = self.k_exp(e) { if k < K_BIT as u32 { return Ok(K_BIT | k as u16); } }
        self.exp_r(e)
    }
    /// una llamada con la función en un registro nuevo (base); deja nres resultados desde base (-1: todos, hasta el tope)
    fn llamada(&mut self, e: &Exp, nres: i32) -> R<u16> {
        let base = self.reservar(1)?;
        let (args, nombre) = match e {
            Exp::Llamada(f, args) => {
                self.exp_a(f, base)?;
                let n = self.nombre_de(f);
                (args, n)
            }
            Exp::Metodo(o, m, args) => {
                let ro = self.exp_r(o)?;
                let k = self.k_cad(m);
                if k > u16::MAX as u32 { return self.error("demasiadas constantes"); }
                self.libre = base + 1;
                self.reservar(1)?;
                self.emit(Op::Metodo(base, ro, k as u16));
                (args, Some(k))
            }
            _ => unreachable!(),
        };
        let abierta = self.explist_abierta(args)?;
        let b = if abierta { 0 } else { self.libre - base };
        let pc = self.emit(Op::Llamar(base, b, (nres + 1) as u16));
        if let Some(k) = nombre { self.nombres.push((pc as u32, k)); }
        self.libre = base;
        if nres > 0 { self.reservar(nres as usize)?; }
        Ok(base)
    }
    /// los argumentos (o lo que se devuelve) en registros seguidos desde el libre; true si el último deja todos sus
    /// valores (hasta el tope)
    fn explist_abierta(&mut self, es: &[Exp]) -> R<bool> {
        for (i, e) in es.iter().enumerate() {
            if i + 1 == es.len() {
                match e {
                    Exp::Llamada(..) | Exp::Metodo(..) => { self.llamada(e, -1)?; return Ok(true); }
                    Exp::Vararg => { let r = self.libre; self.emit(Op::Vararg(r, 0)); return Ok(true); }
                    _ => {}
                }
            }
            self.exp_nuevo(e)?;
        }
        Ok(false)
    }
    /// exactamente n valores en registros nuevos seguidos (local, asignación múltiple, for in)
    fn explist_n(&mut self, es: &[Exp], n: usize) -> R<()> {
        for (i, e) in es.iter().enumerate() {
            let ultimo = i + 1 == es.len();
            if ultimo && i < n && es_multi(e) {
                let falta = n - i;
                if let Exp::Vararg = e {
                    let r = self.reservar(falta)?;
                    self.emit(Op::Vararg(r, (falta + 1) as u16));
                } else {
                    self.llamada(e, falta as i32)?;
                }
                return Ok(());
            }
            if i < n {
                self.exp_nuevo(e)?;
            } else {
                let f0 = self.libre;
                if es_llamada(e) { self.llamada(e, 0)?; } else { self.exp_nuevo(e)?; }
                self.libre = f0;
            }
        }
        if es.len() < n {
            let falta = n - es.len();
            let r = self.reservar(falta)?;
            self.emit(Op::CargarNil(r, falta as u16));
        }
        Ok(())
    }
    /// el constructor, como R.tab de la web: primero los posicionales (al arreglo, en orden), después las claves
    fn tabla(&mut self, campos: &[Campo], t: u16) -> R<()> {
        let npos = campos.iter().filter(|c| matches!(c, Campo::Pos(_))).count();
        let nhash = campos.len() - npos;
        self.emit(Op::NuevaTabla(t, npos.min(u16::MAX as usize) as u16, nhash.min(u16::MAX as usize) as u16));
        let mut pend = 0usize;
        let mut blq = 0usize;
        let n = campos.len();
        for (i, c) in campos.iter().enumerate() {
            if let Campo::Pos(e) = c {
                if i + 1 == n && es_multi(e) {
                    if let Exp::Vararg = e { let r = self.libre; self.emit(Op::Vararg(r, 0)); } else { self.llamada(e, -1)?; }
                    if blq > u16::MAX as usize { return self.error("tabla demasiado grande"); }
                    self.emit(Op::SetLista(t, 0, blq as u16));
                    self.libre = t + 1;
                    pend = 0;
                    break;
                }
                self.exp_nuevo(e)?;
                pend += 1;
                if pend == POR_LISTA {
                    if blq > u16::MAX as usize { return self.error("tabla demasiado grande"); }
                    self.emit(Op::SetLista(t, pend as u16, blq as u16));
                    blq += 1;
                    pend = 0;
                    self.libre = t + 1;
                }
            }
        }
        if pend > 0 {
            if blq > u16::MAX as usize { return self.error("tabla demasiado grande"); }
            self.emit(Op::SetLista(t, pend as u16, blq as u16));
            self.libre = t + 1;
        }
        for c in campos {
            if let Campo::Clave(k, v) = c {
                let f0 = self.libre;
                let rk = self.exp_rk(k)?;
                let rv = self.exp_rk(v)?;
                self.emit(Op::CampoTabla(t, rk, rv));
                self.libre = f0;
            }
        }
        Ok(())
    }

    // ---- condiciones ----
    /// los saltos que se toman cuando e es falso (si es verdadero sigue de largo)
    fn cond_falso(&mut self, e: &Exp) -> R<Vec<usize>> {
        match e {
            Exp::Nil | Exp::False => Ok(vec![self.saltar()]),
            Exp::True | Exp::Num(_) | Exp::Cad(_) => Ok(vec![]),
            Exp::Paren(x) => self.cond_falso(x),
            Exp::Un(OpUn::Not, a) => self.cond_verdad(a),
            Exp::Bin(OpBin::And, a, b) => { let mut f = self.cond_falso(a)?; f.extend(self.cond_falso(b)?); Ok(f) }
            Exp::Bin(OpBin::Or, a, b) => {
                let t = self.cond_verdad(a)?;
                let f = self.cond_falso(b)?;
                self.parchear_aqui(t);
                Ok(f)
            }
            Exp::Bin(op @ (OpBin::Igual | OpBin::Distinto | OpBin::Menor | OpBin::MenorIg | OpBin::Mayor | OpBin::MayorIg), a, b) => {
                Ok(vec![self.cond_cmp(*op, a, b, false)?])
            }
            _ => {
                let f0 = self.libre;
                let r = self.exp_r(e)?;
                self.emit(Op::Probar(r, false));
                let j = self.saltar();
                self.libre = f0;
                Ok(vec![j])
            }
        }
    }
    /// los saltos que se toman cuando e es verdadero
    fn cond_verdad(&mut self, e: &Exp) -> R<Vec<usize>> {
        match e {
            Exp::Nil | Exp::False => Ok(vec![]),
            Exp::True | Exp::Num(_) | Exp::Cad(_) => Ok(vec![self.saltar()]),
            Exp::Paren(x) => self.cond_verdad(x),
            Exp::Un(OpUn::Not, a) => self.cond_falso(a),
            Exp::Bin(OpBin::Or, a, b) => { let mut t = self.cond_verdad(a)?; t.extend(self.cond_verdad(b)?); Ok(t) }
            Exp::Bin(OpBin::And, a, b) => {
                let f = self.cond_falso(a)?;
                let t = self.cond_verdad(b)?;
                self.parchear_aqui(f);
                Ok(t)
            }
            Exp::Bin(op @ (OpBin::Igual | OpBin::Distinto | OpBin::Menor | OpBin::MenorIg | OpBin::Mayor | OpBin::MayorIg), a, b) => {
                Ok(vec![self.cond_cmp(*op, a, b, true)?])
            }
            _ => {
                let f0 = self.libre;
                let r = self.exp_r(e)?;
                self.emit(Op::Probar(r, true));
                let j = self.saltar();
                self.libre = f0;
                Ok(vec![j])
            }
        }
    }
    /// una comparación que salta cuando su resultado es `esp`
    fn cond_cmp(&mut self, op: OpBin, a: &Exp, b: &Exp, esp: bool) -> R<usize> {
        let f0 = self.libre;
        let ra = self.exp_rk(a)?;
        let rb = self.exp_rk(b)?;
        self.emit(match op {
            OpBin::Igual => Op::SiIgual(esp, ra, rb),
            OpBin::Distinto => Op::SiIgual(!esp, ra, rb),
            OpBin::Menor => Op::SiMenor(esp, ra, rb),
            OpBin::MenorIg => Op::SiMenorIg(esp, ra, rb),
            OpBin::Mayor => Op::SiMenor(esp, rb, ra),
            _ => Op::SiMenorIg(esp, rb, ra),
        });
        let j = self.saltar();
        self.libre = f0;
        Ok(j)
    }
}
