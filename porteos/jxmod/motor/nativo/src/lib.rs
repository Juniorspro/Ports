//! JXMod nativo: el juego en Rust, sin WebView ni JavaScript (NativeActivity). Los motores para elegir: Vulkan, OpenGL 3 y
//! OpenGL 2 (para los teléfonos viejos). Etapa 2: la app abre el mapa del paquete del juego con OpenGL 3 (jxmotor::gpu),
//! la cámara se maneja con el tacto y el HUD muestra los cuadros por segundo.
pub mod ajustes;
pub mod armas;
pub mod comun;
// (el dibujo 2D de los menús y los íconos de la web)
pub mod iconos;
pub mod pincel;
pub mod motor;
pub mod sonido;
#[cfg(target_os = "android")]
mod app;
// (el multijugador en Android: el TLS y el HTTPS de Java por JNI)
#[cfg(target_os = "android")]
mod red_android;
