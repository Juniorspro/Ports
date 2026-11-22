//! La puerta de Android (JNI, sin dependencias): la app en Java le pasa cada cuadro de la cámara tal como sale
//! (YUV 4:2:0 de Camera2, en ByteBuffers directos, sin copiar) y el motor de Rust hace todo lo demás:
//!   1. pasa el cuadro a RGBA derecho (girado según el sensor y espejado si es la cámara de frente), repartido en hilos;
//!   2. si se pide, deja una copia para mostrar (la misma imagen que miró el motor, así el esqueleto cae justo encima;
//!      con «ver de noche», aclarada con una curva medida en el cuadro);
//!   3. corre el motor y escribe la salida en un ByteBuffer de floats.
//!
//! Salida (floats): 8 de cabecera [manos, corrió el detector, inferencias, ms del motor, ms de pasar el cuadro, brillo
//! medio, cuánto se aclaró, hilos] y después `POR_MANO` por mano, como en WebAssembly (ver wasm.rs).
use crate::hilos;
use crate::motor::Motor;
use std::ffi::c_void;
use std::time::Instant;

pub const CABECERA: usize = 8;
pub const POR_MANO: usize = 176;

// ---- lo mínimo de JNI: la tabla de funciones del JNIEnv, por número (jni.h) ----
type Env = *mut *const *const c_void;
type Obj = *mut c_void;
unsafe fn funcion(env: Env, i: usize) -> *const c_void { *(*env).add(i) }
unsafe fn direccion(env: Env, b: Obj) -> *mut u8 {
    if b.is_null() { return std::ptr::null_mut(); }
    let f: extern "system" fn(Env, Obj) -> *mut c_void = std::mem::transmute(funcion(env, 230)); // GetDirectBufferAddress
    f(env, b) as *mut u8
}
unsafe fn capacidad(env: Env, b: Obj) -> usize {
    if b.is_null() { return 0; }
    let f: extern "system" fn(Env, Obj) -> i64 = std::mem::transmute(funcion(env, 231)); // GetDirectBufferCapacity
    f(env, b).max(0) as usize
}
unsafe fn texto(env: Env, s: &str) -> Obj {
    let mut c = s.as_bytes().to_vec(); c.retain(|&b| b != 0); c.push(0);
    let f: extern "system" fn(Env, *const u8) -> Obj = std::mem::transmute(funcion(env, 167)); // NewStringUTF
    f(env, c.as_ptr())
}
unsafe fn bytes<'a>(env: Env, b: Obj) -> &'a [u8] {
    let (p, n) = (direccion(env, b), capacidad(env, b));
    if p.is_null() { &[] } else { std::slice::from_raw_parts(p, n) }
}

struct Estado {
    motor: Motor,
    detector: Vec<u8>, completo: Vec<u8>, liviano: Vec<u8>,
    usa_liviano: bool,
    rgba: Vec<u8>,
    salida: Vec<f32>,
}

static mut ERROR: String = String::new();

/// elige cuántos hilos usar: los núcleos grandes (los de frecuencia máxima cerca de la del más rápido), entre 2 y 4.
/// Los chicos (de bajo consumo) harían esperar a los demás en cada capa.
fn nucleos_grandes() -> (usize, u64) {
    let mut f = Vec::new();
    for i in 0..16 {
        match std::fs::read_to_string(format!("/sys/devices/system/cpu/cpu{}/cpufreq/cpuinfo_max_freq", i)) {
            Ok(t) => f.push(t.trim().parse::<u64>().unwrap_or(0)),
            Err(_) => { if i >= 8 { break; } f.push(0); }
        }
    }
    let tope = f.iter().copied().max().unwrap_or(0);
    if tope == 0 { return (hilos::cuantos().clamp(1, 4), 0); }
    let mut mascara = 0u64; let mut n = 0;
    for (i, &v) in f.iter().enumerate() { if v as f64 >= tope as f64 * 0.8 { mascara |= 1 << i; n += 1; } }
    (n.clamp(2, 4), mascara)
}

#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_crear(env: Env, _c: Obj, det: Obj, completo: Obj, liviano: Obj) -> i64 {
    let (d, c, l) = (bytes(env, det).to_vec(), bytes(env, completo).to_vec(), bytes(env, liviano).to_vec());
    let (n, mascara) = nucleos_grandes();
    hilos::configurar(n);
    hilos::fijar_nucleos(mascara);
    match Motor::nuevo(&d, &c) {
        Ok(motor) => Box::into_raw(Box::new(Estado { motor, detector: d, completo: c, liviano: l, usa_liviano: false, rgba: Vec::new(), salida: vec![0.0; CABECERA] })) as i64,
        Err(e) => { ERROR = e; 0 }
    }
}

#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_error(env: Env, _c: Obj) -> Obj {
    let e = &*std::ptr::addr_of!(ERROR);
    texto(env, e)
}

#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_soltar(_env: Env, _c: Obj, m: i64) {
    if m != 0 { drop(Box::from_raw(m as *mut Estado)); }
}

/// ajustes: 0 máximo de manos · 1 presencia mínima · 2 puntaje mínimo de palma · 3 cada cuánto buscar otra mano (ms)
/// · 4 predicción (ms) · 5 campo de visión (grados) · 6, 7 filtro de los puntos (corte mínimo, beta) · 8, 9 filtro de
/// los ángulos · 10 modelo liviano (1) o completo (0) · 11 realce de poca luz (1/0) · 12 hilos · 13 reiniciar
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_config(_env: Env, _c: Obj, m: i64, clave: i32, valor: f32) {
    if m == 0 { return; }
    let e = &mut *(m as *mut Estado);
    let c = &mut e.motor.cfg;
    match clave {
        0 => c.max_manos = valor.max(1.0) as usize, 1 => c.min_presencia = valor, 2 => c.min_palma = valor, 3 => c.cada_busqueda_ms = valor as f64,
        4 => c.prediccion_ms = valor, 5 => c.fov_grados = valor, 6 => c.img_min_corte = valor, 7 => c.img_beta = valor, 8 => c.ang_min_corte = valor, 9 => c.ang_beta = valor,
        10 => {
            let liv = valor > 0.5;
            if liv != e.usa_liviano && !(liv && e.liviano.is_empty()) {
                let cfg = e.motor.cfg;
                if let Ok(mut nuevo) = Motor::nuevo(&e.detector, if liv { &e.liviano } else { &e.completo }) { nuevo.cfg = cfg; e.motor = nuevo; e.usa_liviano = liv; }
            }
        }
        11 => e.motor.poca_luz(valor > 0.5),
        12 => hilos::configurar(valor.max(1.0) as usize),
        13 => e.motor.reiniciar(),
        _ => {}
    }
}

/// pasa el cuadro YUV a RGBA derecho: `rot` = cuántos grados girar en sentido horario (0, 90, 180, 270), `espejo` = dar
/// vuelta izquierda/derecha después. Colores BT.601 de rango completo (los de Camera2), en enteros.
#[allow(clippy::too_many_arguments)]
fn yuv_a_rgba(y: &[u8], u: &[u8], v: &[u8], w: usize, h: usize, fila_y: usize, fila_uv: usize, paso_uv: usize, rot: u32, espejo: bool, out: &mut [u8]) -> (usize, usize) {
    let (ow, oh) = if rot == 90 || rot == 270 { (h, w) } else { (w, h) };
    let po = OutPtr(out.as_mut_ptr());
    let filas_por = oh.div_ceil(hilos::cuantos() * 4).max(8);
    hilos::repartir(oh.div_ceil(filas_por), &|t| {
        let (a, b) = (t * filas_por, ((t + 1) * filas_por).min(oh));
        for oy in a..b {
            // SAFETY: cada trozo escribe sus filas
            let fila = unsafe { std::slice::from_raw_parts_mut(po.p().add(oy * ow * 4), ow * 4) };
            for ox in 0..ow {
                let ex = if espejo { ow - 1 - ox } else { ox };
                // del píxel de salida (ex, oy) al de la cámara (sx, sy)
                let (sx, sy) = match rot { 90 => (oy, h - 1 - ex), 180 => (w - 1 - ex, h - 1 - oy), 270 => (w - 1 - oy, ex), _ => (ex, oy) };
                let yy = y[sy * fila_y + sx] as i32;
                let k = (sy / 2) * fila_uv + (sx / 2) * paso_uv;
                let (cb, cr) = (u[k] as i32 - 128, v[k] as i32 - 128);
                // (×1024) R = Y + 1,402 Cr · G = Y − 0,344 Cb − 0,714 Cr · B = Y + 1,772 Cb
                let r = yy + ((1436 * cr) >> 10); let g = yy - ((352 * cb + 731 * cr) >> 10); let bl = yy + ((1815 * cb) >> 10);
                let o = &mut fila[ox * 4..ox * 4 + 4];
                o[0] = r.clamp(0, 255) as u8; o[1] = g.clamp(0, 255) as u8; o[2] = bl.clamp(0, 255) as u8; o[3] = 255;
            }
        }
    });
    (ow, oh)
}
#[derive(Clone, Copy)]
struct OutPtr(*mut u8);
unsafe impl Send for OutPtr {}
unsafe impl Sync for OutPtr {}
impl OutPtr { fn p(self) -> *mut u8 { self.0 } }

/// procesa un cuadro. `y`, `u`, `v`: los planos de Camera2 (ByteBuffers directos); `salida`: ByteBuffer directo de
/// floats (orden nativo); `vista`: si no es null, ahí queda la imagen RGBA que miró el motor (ancho × alto × 4, ya
/// girada), aclarada si `vista_noche`. Devuelve cuántas manos hay; la cabecera de la salida dice además ancho y alto
/// de la imagen girada en los lugares 6 y 7 si se pide la vista (para dibujarla).
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_procesar(env: Env, _c: Obj, m: i64, y: Obj, u: Obj, v: Obj, w: i32, h: i32, fila_y: i32, fila_uv: i32, paso_uv: i32,
    rot: i32, espejo: u8, t_ns: i64, salida: Obj, vista: Obj, vista_noche: u8) -> i32 {
    if m == 0 { return 0; }
    let e = &mut *(m as *mut Estado);
    let (w, h) = (w.max(1) as usize, h.max(1) as usize);
    let (py, pu, pv) = (bytes(env, y), bytes(env, u), bytes(env, v));
    let (fy, fuv, puv) = (fila_y as usize, fila_uv as usize, paso_uv.max(1) as usize);
    // que los planos alcancen (si no, el cuadro viene raro: se saltea)
    if py.len() < (h - 1) * fy + w || pu.len() < (h / 2 - 1) * fuv + (w / 2 - 1) * puv + 1 || pv.len() < (h / 2 - 1) * fuv + (w / 2 - 1) * puv + 1 { return -1; }
    let t0 = Instant::now();
    if e.rgba.len() != w * h * 4 { e.rgba = vec![0u8; w * h * 4]; }
    let rot = match rot.rem_euclid(360) { 90 => 90, 180 => 180, 270 => 270, _ => 0 };
    let (ow, oh) = yuv_a_rgba(py, pu, pv, w, h, fy, fuv, puv, rot, espejo != 0, &mut e.rgba);
    let t_yuv = t0.elapsed().as_secs_f64() * 1e3;
    // la vista: la misma imagen (aclarada con «ver de noche»)
    let pvista = direccion(env, vista);
    if !pvista.is_null() && capacidad(env, vista) >= ow * oh * 4 {
        let dst = std::slice::from_raw_parts_mut(pvista, ow * oh * 4);
        if vista_noche != 0 {
            let tabla = crate::luz::tabla_rgba(&e.rgba);
            for (d, s) in dst.chunks_exact_mut(4).zip(e.rgba.chunks_exact(4)) { d[0] = tabla[s[0] as usize]; d[1] = tabla[s[1] as usize]; d[2] = tabla[s[2] as usize]; d[3] = 255; }
        } else { dst.copy_from_slice(&e.rgba); }
    }
    let t1 = Instant::now();
    let manos = e.motor.procesar(&e.rgba, ow, oh, t_ns as f64 / 1e6, espejo != 0);
    let t_motor = t1.elapsed().as_secs_f64() * 1e3;
    let (brillo, ganancia) = e.motor.luz();
    let s = &mut e.salida; s.clear();
    s.extend_from_slice(&[manos.len() as f32, e.motor.corrio_detector as u8 as f32, e.motor.inferencias as f32, t_motor as f32, t_yuv as f32, brillo, ganancia, hilos::cuantos() as f32]);
    for x in &manos {
        let b = s.len(); s.resize(b + POR_MANO, 0.0); let o = &mut s[b..];
        o[0] = x.id as f32; o[1] = x.derecha as u8 as f32; o[2] = x.presencia; o[3] = x.calibrada as u8 as f32;
        o[4..7].copy_from_slice(&x.posicion); o[7..11].copy_from_slice(&x.rotacion); o[11..14].copy_from_slice(&x.normal);
        for i in 0..21 { o[14 + i * 3..17 + i * 3].copy_from_slice(&x.img[i]); o[77 + i * 3..80 + i * 3].copy_from_slice(&x.mundo[i]); }
        for d in 0..5 { let a = &x.angulos[d]; o[140 + d * 4..144 + d * 4].copy_from_slice(&[a.flex, a.abre, a.medio, a.punta]); }
        o[160..165].copy_from_slice(&x.medidas.cierre);
        o[165] = x.medidas.pinza; o[166] = x.medidas.agarre; o[167] = x.medidas.dedos as f32; o[168] = x.gesto as u8 as f32; o[169] = x.gesto_fuerza;
        o[170..174].copy_from_slice(&[x.roi.cx, x.roi.cy, x.roi.lado, x.roi.ang]);
        o[174] = ow as f32; o[175] = oh as f32;
    }
    let ps = direccion(env, salida) as *mut f32;
    let cap = capacidad(env, salida) / 4;
    if !ps.is_null() {
        let n = s.len().min(cap);
        std::ptr::copy_nonoverlapping(s.as_ptr(), ps, n);
    }
    manos.len() as i32
}
