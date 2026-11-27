//! JXMod nativo: el juego en Rust, sin WebView ni JavaScript (NativeActivity). Los motores para elegir: Vulkan, OpenGL 3 y
//! OpenGL 2 (para los teléfonos viejos). Etapa 2: la app abre el mapa del paquete del juego con OpenGL 3 (jxmotor::gpu),
//! la cámara se maneja con el tacto y el HUD muestra los cuadros por segundo.
pub mod ajustes;
pub mod armas;
pub mod comun;
/// la partida en la red local (lan.js y Lan.java: el broker del anfitrión y los anuncios)
pub mod lan;
/// los paquetes aparte que se bajan cuando hacen falta (datos.js: rbBajar)
pub mod bajas;
pub mod firma;
pub mod steampipe;
pub mod steambase;
pub mod zstd;
// (el dibujo 2D de los menús y los íconos de la web)
pub mod iconos;
pub mod pincel;
pub mod motor;
pub mod sonido;
/// qué estaba haciendo el juego antes de trabarse (cajanegra.js)
pub mod caja_negra;
#[cfg(target_os = "android")]
mod app;
// (el multijugador en Android: el TLS y el HTTPS de Java por JNI)
#[cfg(target_os = "android")]
mod red_android;
