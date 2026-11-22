//! La puerta de WebAssembly: funciones `extern "C"` sin dependencias (nada de wasm-bindgen). JavaScript reserva memoria,
//! copia los modelos y cada cuadro RGBA, llama a `jx_procesar` y lee la salida como un Float32Array.
//!
//! Salida: [cantidad de manos, corrió el detector (0/1), inferencias, 0] y después, por mano, `POR_MANO` números:
//!   0 id · 1 derecha (1/0) · 2 presencia · 3 calibrada · 4..7 posición (m) · 7..11 rotación (cuaternión) · 11..14 normal
//!   14..77 puntos en la imagen (21 × x, y, z) · 77..140 puntos en metros (21 × 3) · 140..160 ángulos (5 dedos × base,
//!   apertura, media, punta) · 160..165 cierre de cada dedo · 165 pinza · 166 agarre · 167 dedos estirados · 168 gesto
//!   · 169 fuerza del gesto · 170..174 cuadrado (cx, cy, lado, ángulo) · 174, 175 libres
use crate::motor::Motor;

pub const POR_MANO: usize = 176;

struct Estado { motor: Option<Motor>, imagen: Vec<u8>, salida: Vec<f32>, error: String }
static mut ESTADO: *mut Estado = std::ptr::null_mut();

fn estado() -> &'static mut Estado {
    unsafe {
        if ESTADO.is_null() { ESTADO = Box::into_raw(Box::new(Estado { motor: None, imagen: Vec::new(), salida: vec![0.0; 4], error: String::new() })); }
        &mut *ESTADO
    }
}

#[no_mangle]
pub extern "C" fn jx_reservar(n: usize) -> *mut u8 { let mut v = vec![0u8; n]; let p = v.as_mut_ptr(); std::mem::forget(v); p }

#[no_mangle]
pub extern "C" fn jx_liberar(p: *mut u8, n: usize) { if !p.is_null() { unsafe { drop(Vec::from_raw_parts(p, n, n)); } } }

/// carga los dos modelos (ya copiados a memoria reservada con jx_reservar); 0 = bien, 1 = error (ver jx_error)
#[no_mangle]
pub extern "C" fn jx_crear(d: *const u8, dn: usize, p: *const u8, pn: usize) -> i32 {
    let e = estado();
    let (dm, pm) = unsafe { (std::slice::from_raw_parts(d, dn), std::slice::from_raw_parts(p, pn)) };
    match Motor::nuevo(dm, pm) { Ok(m) => { e.motor = Some(m); 0 } Err(x) => { e.error = x; 1 } }
}

#[no_mangle]
pub extern "C" fn jx_error() -> *const u8 { estado().error.as_ptr() }
#[no_mangle]
pub extern "C" fn jx_error_largo() -> usize { estado().error.len() }

/// dónde copiar el próximo cuadro (w × h × 4 bytes, RGBA)
#[no_mangle]
pub extern "C" fn jx_imagen(w: u32, h: u32) -> *mut u8 {
    let e = estado(); let n = (w * h * 4) as usize;
    if e.imagen.len() != n { e.imagen = vec![0u8; n]; }
    e.imagen.as_mut_ptr()
}

/// procesa el cuadro copiado; devuelve cuántas manos hay (la salida queda en jx_salida)
#[no_mangle]
pub extern "C" fn jx_procesar(w: u32, h: u32, t_ms: f64, espejada: u32) -> u32 {
    let e = estado();
    let Some(m) = e.motor.as_mut() else { return 0 };
    let manos = m.procesar(&e.imagen, w as usize, h as usize, t_ms, espejada != 0);
    let s = &mut e.salida; s.clear();
    s.extend_from_slice(&[manos.len() as f32, m.corrio_detector as u8 as f32, m.inferencias as f32, 0.0]);
    for x in &manos {
        let b = s.len(); s.resize(b + POR_MANO, 0.0); let o = &mut s[b..];
        o[0] = x.id as f32; o[1] = x.derecha as u8 as f32; o[2] = x.presencia; o[3] = x.calibrada as u8 as f32;
        o[4..7].copy_from_slice(&x.posicion); o[7..11].copy_from_slice(&x.rotacion); o[11..14].copy_from_slice(&x.normal);
        for i in 0..21 { o[14 + i * 3..17 + i * 3].copy_from_slice(&x.img[i]); o[77 + i * 3..80 + i * 3].copy_from_slice(&x.mundo[i]); }
        for d in 0..5 { let a = &x.angulos[d]; o[140 + d * 4..144 + d * 4].copy_from_slice(&[a.flex, a.abre, a.medio, a.punta]); }
        o[160..165].copy_from_slice(&x.medidas.cierre);
        o[165] = x.medidas.pinza; o[166] = x.medidas.agarre; o[167] = x.medidas.dedos as f32; o[168] = x.gesto as u8 as f32; o[169] = x.gesto_fuerza;
        o[170..174].copy_from_slice(&[x.roi.cx, x.roi.cy, x.roi.lado, x.roi.ang]);
    }
    manos.len() as u32
}

#[no_mangle]
pub extern "C" fn jx_salida() -> *const f32 { estado().salida.as_ptr() }

#[no_mangle]
pub extern "C" fn jx_reiniciar() { if let Some(m) = estado().motor.as_mut() { m.reiniciar(); } }

/// ajustes: 0 máximo de manos · 1 presencia mínima · 2 puntaje mínimo de palma · 3 cada cuánto buscar otra mano (ms)
/// · 4 predicción (ms) · 5 campo de visión (grados) · 6, 7 filtro de los puntos (corte mínimo, beta) · 8, 9 filtro de
/// los ángulos (corte mínimo, beta)
#[no_mangle]
pub extern "C" fn jx_config(clave: u32, valor: f32) {
    let Some(m) = estado().motor.as_mut() else { return };
    let c = &mut m.cfg;
    match clave {
        0 => c.max_manos = valor.max(1.0) as usize, 1 => c.min_presencia = valor, 2 => c.min_palma = valor, 3 => c.cada_busqueda_ms = valor as f64,
        4 => c.prediccion_ms = valor, 5 => c.fov_grados = valor, 6 => c.img_min_corte = valor, 7 => c.img_beta = valor, 8 => c.ang_min_corte = valor, 9 => c.ang_beta = valor,
        _ => {}
    }
}

/// para medir: corre sólo el modelo de los puntos sobre el cuadro copiado, `veces` veces (JavaScript toma el tiempo)
#[no_mangle]
pub extern "C" fn jx_banco_puntos(w: u32, h: u32, veces: u32) {
    let e = estado(); let Some(m) = e.motor.as_mut() else { return };
    m.banco_puntos(&e.imagen, w as usize, h as usize, veces as usize);
}
#[no_mangle]
pub extern "C" fn jx_banco_detector(w: u32, h: u32, veces: u32) {
    let e = estado(); let Some(m) = e.motor.as_mut() else { return };
    m.banco_detector(&e.imagen, w as usize, h as usize, veces as usize);
}
