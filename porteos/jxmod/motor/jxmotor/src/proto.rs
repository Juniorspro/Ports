//! Lo que manda el juego, en pedazos: 'R' recursos (JXE1), 'C' un cuadro (JXC1), 'V' vaciar (cambio de mapa) y 'Q' quitar
//! recursos (un byte con el tipo y los números en f64). Es lo mismo que llega por JNI en la APK y lo que se guarda en una
//! grabación (JXG1: 'JXG1' y los pedazos, cada uno con su tipo, u32 con el largo y los bytes) para el banco de pruebas.
use crate::escena::{Cuadro, Escena};
use crate::gpu::Motor;

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
pub unsafe fn aplicar(m: &mut Motor, p: &Pedazo) -> Result<(), String> {
    match p {
        Pedazo::Recursos(d) => m.cargar(&Escena::leer(d)?),
        Pedazo::Cuadro(d) => { m.poner_cuadro(Cuadro::leer(d)?); Ok(()) }
        Pedazo::Vaciar => { m.vaciar(); Ok(()) }
        Pedazo::Quitar(d) => {
            if d.is_empty() { return Ok(()); }
            let ids: Vec<i64> = d[1..].chunks_exact(8).map(|c| f64::from_le_bytes(c.try_into().unwrap()) as i64).collect();
            m.quitar(d[0], &ids); Ok(())
        }
    }
}
