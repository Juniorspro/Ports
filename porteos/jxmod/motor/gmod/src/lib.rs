//! jxgmod: la capa GMod de JXMod en Rust. Corre addons de Garry's Mod (Lua) sobre jxlua con la API de GMod que tiene
//! la web (juego/gmod_api.js, gmod_prelude.js, gmod_cargar.js) y le pide al juego lo que hace falta por el rasgo
//! [`Anfitrion`] (crear objetos, sonidos, efectos, daño, trazas, la HUD...).
//!
//! Uso: `Gmod::nuevo(Box::new(mi_juego))`, `montar(Addon::de_archivos(..))` por cada addon y en cada cuadro
//! `paso(dt, &choques)` y `hud()`. Un solo Gmod activo por hilo (`activar` si hay más de uno).

pub mod anfitrion;
pub mod autorig;
pub mod formatos;
pub mod modelos;
pub mod sonidos;
pub mod mates;
pub mod prueba;
#[doc(hidden)]
pub mod traza;
mod cargar;
mod dibujo;
mod entidades;
mod herramientas;
pub use herramientas::HerrAddon;
pub mod jugadores;
mod libs;
mod matriz;
pub mod pills;
mod motor;
mod nucleo;
mod resto;
mod valores;

pub use anfitrion::*;
pub use cargar::{leer_carpeta, leer_gma, Choque, Gmod, Snpc, PRELUDE};
pub use nucleo::{Addon, LAng, LVec, Lado, ManosPm};
pub use pills::{AtaquePill, PillGm};
pub use resto::Luz;
