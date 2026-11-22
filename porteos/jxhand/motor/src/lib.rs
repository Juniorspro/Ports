//! JX Hand Engine: seguimiento de manos en Rust puro (nativo y WebAssembly), con los modelos de MediaPipe Hands
//! (Apache 2.0) corridos por un intérprete propio. Ver LEEME.md.
pub mod hilos;
pub mod tflite;
pub mod red;
pub mod luz;
pub mod malla;
pub mod mano;
pub mod filtro;
pub mod esqueleto;
pub mod gestos;
pub mod motor;
#[cfg(target_arch = "wasm32")]
pub mod wasm;
#[cfg(any(target_os = "android", feature = "jni"))]
pub mod android;
#[cfg(any(target_os = "android", feature = "gl"))]
pub mod escena;
pub use motor::{Config, Mano, Motor};
