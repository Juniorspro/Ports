//! El código de la máquina: instrucciones de registros como las de Lua 5.1 (cada función tiene su ventana de registros
//! en la pila; los operandos "RK" son un registro o, con el bit 0x8000, una constante).
use std::rc::Rc;

use crate::valor::Valor;

/// un registro o una constante (bit alto)
pub(crate) type RK = u16;
pub(crate) const K_BIT: u16 = 0x8000;
/// "ningún registro" (CeldaNueva sin valor inicial)
pub(crate) const NINGUNO: u16 = u16::MAX;
/// cuántos valores junta el constructor de tablas antes de pasarlos a la tabla
pub(crate) const POR_LISTA: usize = 50;

#[derive(Clone, Copy, Debug)]
pub(crate) enum Op {
    /// R(a) = R(b)
    Mover(u16, u16),
    /// R(a) = K(k)
    CargarK(u16, u32),
    /// R(a..a+n) = nil
    CargarNil(u16, u16),
    CargarBool(u16, bool),
    /// R(a) = Up(u)
    LeerUp(u16, u16),
    /// Up(u) = RK(b)
    EscribirUp(u16, RK),
    /// celda c del marco = una celda nueva con R(b) (o nil si b es NINGUNO)
    CeldaNueva(u16, u16),
    /// R(a) = celda c
    CeldaLeer(u16, u16),
    /// celda c = RK(b)
    CeldaEscribir(u16, RK),
    /// R(a) = _G[K(k)]
    LeerGlobal(u16, u32),
    /// _G[K(k)] = RK(b)
    EscribirGlobal(u32, RK),
    /// las mismas en un archivo con module(): primero la tabla del módulo
    LeerGlobalM(u16, u32),
    EscribirGlobalM(u32, RK),
    /// R(a) = R(b)[RK(c)]
    Indexar(u16, u16, RK),
    /// R(a) = R(b)[K(k)] (k: un texto)
    IndexarK(u16, u16, u16),
    /// R(a)[RK(b)] = RK(c)
    Asignar(u16, RK, RK),
    /// R(a)[K(k)] = RK(c)
    AsignarK(u16, u16, RK),
    /// en el constructor de tablas: R(a)[RK(b)] = RK(c) sin metamétodos, salvo que la clave o el valor sean nil
    CampoTabla(u16, RK, RK),
    /// R(a) = {} (con lugar para narr y nhash)
    NuevaTabla(u16, u16, u16),
    /// R(a)[blq*50 + i] = R(a+i) para i = 1..n (n = 0: hasta el tope)
    SetLista(u16, u16, u16),
    /// R(a+1) = R(b); R(a) = R(b)[K(k)]
    Metodo(u16, u16, u16),
    Sumar(u16, RK, RK),
    Restar(u16, RK, RK),
    Mult(u16, RK, RK),
    Div(u16, RK, RK),
    Mod(u16, RK, RK),
    Pot(u16, RK, RK),
    Neg(u16, u16),
    Not(u16, u16),
    Largo(u16, u16),
    /// R(a) = R(b) .. ... .. R(b+n-1)
    Concat(u16, u16, u16),
    /// R(a) = RK(b) == RK(c), etc. (los valores de las comparaciones)
    Igual(u16, RK, RK),
    Distinto(u16, RK, RK),
    Menor(u16, RK, RK),
    MenorIg(u16, RK, RK),
    /// si (RK(b) == RK(c)) == esp, salta con la instrucción siguiente (un Saltar); si no, la saltea
    SiIgual(bool, RK, RK),
    SiMenor(bool, RK, RK),
    SiMenorIg(bool, RK, RK),
    /// si R(a) es verdad == esp, salta con la siguiente; si no, la saltea
    Probar(u16, bool),
    /// pc += d (desde la instrucción siguiente); hacia atrás cuenta un paso
    Saltar(i32),
    /// R(a..a+c-2) = R(a)(R(a+1..a+b-1)); b = 0: los argumentos hasta el tope; c = 0: todos los resultados
    Llamar(u16, u16, u16),
    /// return R(a..a+b-2); b = 0: hasta el tope
    Retornar(u16, u16),
    /// for numérico: R(a) índice, R(a+1) límite, R(a+2) paso, R(a+3) la variable; si no entra, salta d
    ForPrep(u16, i32),
    ForLoop(u16, i32),
    /// R(a+3..a+2+n) = R(a)(R(a+1), R(a+2))
    TForCall(u16, u16),
    /// si R(a+3) ~= nil: R(a+2) = R(a+3) y salta d
    TForLoop(u16, i32),
    /// R(a) = una clausura de la función hija p
    Clausura(u16, u32),
    /// R(a..a+b-2) = ... (b = 0: todos, hasta el tope)
    Vararg(u16, u16),
    /// module(R(a..a+n-1)): la tabla del módulo pasa a ser el entorno del archivo
    Modulo(u16, u16),
}

/// una función compilada
pub(crate) struct Proto {
    pub(crate) codigo: Vec<Op>,
    pub(crate) lineas: Vec<u32>,
    pub(crate) k: Vec<Valor>,
    pub(crate) hijos: Vec<Rc<Proto>>,
    /// (de una celda del marco de afuera, índice) o (de un upvalue de la de afuera, índice)
    pub(crate) ups: Vec<(bool, u16)>,
    pub(crate) n_params: usize,
    pub(crate) es_vararg: bool,
    pub(crate) max_regs: usize,
    pub(crate) n_celdas: usize,
    pub(crate) archivo: Rc<str>,
    pub(crate) linea: u32,
    /// el nombre de lo que se llama en cada Llamar (para «attempt to call 'x'»): (pc, constante)
    pub(crate) nombres: Vec<(u32, u32)>,
}

impl Proto {
    pub(crate) fn linea_de(&self, pc: usize) -> u32 { self.lineas.get(pc).copied().unwrap_or(self.linea) }
    pub(crate) fn nombre_llamada(&self, pc: usize) -> Option<&Valor> {
        self.nombres.binary_search_by_key(&(pc as u32), |x| x.0).ok().map(|i| &self.k[self.nombres[i].1 as usize])
    }
}
