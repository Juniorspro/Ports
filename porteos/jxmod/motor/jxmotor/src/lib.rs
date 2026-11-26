//! JX Motor: el motor nativo de JXMod en Rust. Dibuja (GLES 3.0) lo que manda el juego: recursos que llegan de a poco y
//! un cuadro con la cámara, la luz y la lista de lo que se ve (ver LEEME.md).
pub mod escena;
pub mod gl2;
pub mod gpu;
pub mod hongo;
pub mod mat;
pub mod proto;
pub mod wg;
pub mod wgsl;
#[cfg(feature = "vk")]
pub mod vk;
