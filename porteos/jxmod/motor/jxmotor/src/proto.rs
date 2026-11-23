//! Lo que manda el juego, en pedazos: 'R' recursos (JXE1), 'C' un cuadro (JXC1), 'V' vaciar (cambio de mapa) y 'Q' quitar
//! recursos (un byte con el tipo y los números en f64). Es lo mismo que llega por JNI en la APK y lo que se guarda en una
//! grabación (JXG1: 'JXG1' y los pedazos, cada uno con su tipo, u32 con el largo y los bytes) para el banco de pruebas.
use crate::escena::{Cuadro, Escena, ItemDin};

/// lo que sabe hacer un motor con lo que manda el juego (el de GLES y el de wgpu)
pub trait Dibujante {
    fn cargar_r(&mut self, e: &Escena) -> Result<(), String>;
    fn poner_cuadro_r(&mut self, c: Cuadro);
    fn vaciar_r(&mut self);
    fn quitar_r(&mut self, tipo: u8, ids: &[i64]);
    fn ranuras_r(&mut self) -> &mut Vec<Option<ItemDin>>;
}
impl Dibujante for crate::gpu::Motor {
    fn cargar_r(&mut self, e: &Escena) -> Result<(), String> { unsafe { self.cargar(e) } }
    fn poner_cuadro_r(&mut self, c: Cuadro) { self.poner_cuadro(c) }
    fn vaciar_r(&mut self) { unsafe { self.vaciar() } }
    fn quitar_r(&mut self, tipo: u8, ids: &[i64]) { unsafe { self.quitar(tipo, ids) } }
    fn ranuras_r(&mut self) -> &mut Vec<Option<ItemDin>> { &mut self.ranuras }
}
impl Dibujante for crate::wg::Motor {
    fn cargar_r(&mut self, e: &Escena) -> Result<(), String> { self.cargar(e) }
    fn poner_cuadro_r(&mut self, c: Cuadro) { self.poner_cuadro(c) }
    fn vaciar_r(&mut self) { self.vaciar() }
    fn quitar_r(&mut self, tipo: u8, ids: &[i64]) { self.quitar(tipo, ids) }
    fn ranuras_r(&mut self) -> &mut Vec<Option<ItemDin>> { &mut self.ranuras }
}

pub enum Pedazo<'a> { Recursos(&'a [u8]), Cuadro(&'a [u8]), Vaciar, Quitar(&'a [u8]) }

/// los pedazos de una grabación
pub fn pedazos(b: &[u8]) -> Result<Vec<Pedazo<'_>>, String> {
    if b.len() < 4 || &b[0..4] != b"JXG1" { return Err("no es una grabación JXG1".into()); }
    let mut v = vec![]; let mut k = 4;
    while k + 5 <= b.len() {
        let t = b[k]; let n = u32::from_le_bytes([b[k + 1], b[k + 2], b[k + 3], b[k + 4]]) as usize; k += 5;
        if k + n > b.len() { return Err("grabación cortada".into()); }
        let d = &b[k..k + n]; k += n;
        v.push(match t { b'R' => Pedazo::Recursos(d), b'C' => Pedazo::Cuadro(d), b'V' => Pedazo::Vaciar, b'Q' => Pedazo::Quitar(d), _ => return Err(format!("pedazo desconocido {t}")) });
    }
    Ok(v)
}

/// aplica un pedazo al motor (los recursos se suben a la placa: tiene que estar el contexto de GL activo)
pub unsafe fn aplicar<M: Dibujante>(m: &mut M, p: &Pedazo) -> Result<(), String> {
    match p {
        Pedazo::Recursos(d) => m.cargar_r(&Escena::leer(d)?),
        Pedazo::Cuadro(d) => { let mut r = std::mem::take(m.ranuras_r()); let c = Cuadro::leer_con(d, &mut r); *m.ranuras_r() = r; m.poner_cuadro_r(c?); Ok(()) }
        Pedazo::Vaciar => { m.vaciar_r(); Ok(()) }
        Pedazo::Quitar(d) => {
            if d.is_empty() { return Ok(()); }
            let ids: Vec<i64> = d[1..].chunks_exact(8).map(|c| f64::from_le_bytes(c.try_into().unwrap()) as i64).collect();
            m.quitar_r(d[0], &ids); Ok(())
        }
    }
}
