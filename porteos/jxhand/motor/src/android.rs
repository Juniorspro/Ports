//! La puerta de Android (JNI, sin dependencias): la app en Java le pasa cada cuadro de la cámara tal como sale
//! (YUV 4:2:0 de Camera2, en ByteBuffers directos, sin copiar) y el motor de Rust hace todo lo demás:
//!   1. pasa el cuadro a RGBA derecho (girado según el sensor y espejado si es la cámara de frente), repartido en hilos;
//!   2. si se pide, deja una copia para mostrar (la misma imagen que miró el motor, así el esqueleto cae justo encima;
//!      con «ver de noche», aclarada con una curva medida en el cuadro);
//!   3. corre el motor y escribe la salida en un ByteBuffer de floats.
//!
//! Salida (floats): 10 de cabecera [manos, corrió el detector, inferencias, ms del motor, ms de pasar el cuadro, brillo
//! medio, cuánto se aclaró, hilos, cuentas en float16 (1/0), libre] y después `POR_MANO` por mano, como en WebAssembly
//! (ver wasm.rs).
use crate::hilos;
use crate::motor::Motor;
use std::ffi::c_void;
use std::time::Instant;

pub const CABECERA: usize = 18;
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
    // para dibujar el último cuadro: la imagen aclarada (con «ver de noche»), su tamaño y las manos en píxeles
    vista: Vec<u8>, vista_noche: bool, dim: (usize, usize),
    para_dibujar: Vec<crate::escena::ManoDibujo>,
    escena: Option<crate::escena::Escena>,
    /// «Cálculo en 8 bits» prendido: se usa si al medirlo en este celular es más rápido que float
    ocho_si: bool,
}

static mut ERROR: String = String::new();

/// los núcleos grandes, los medianos y los chicos (máscaras de bits). Los chicos (de bajo consumo) harían esperar a los
/// demás en cada capa; los medianos son del mismo tipo que los grandes pero más lentos (el Dimensity 8500 del Poco X8 Pro:
/// 8 Cortex-A725, 4 a 3,2–3,4 GHz y 4 a 2,2): con ellos, los hilos se reparten los trozos de cada capa y suman.
/// Se mira, en este orden:
/// 1. la capacidad de cada núcleo que publica el kernel (`cpu_capacity`, 1024 el más rápido): 80 % o más, grande; 45 % o
///    más (y que no sea de los chicos por su modelo), mediano;
/// 2. qué procesador es cada núcleo (`/proc/cpuinfo`, «CPU part»): Cortex-A53/A55/A35/A510/A520 y los Kryo «Silver»
///    son chicos; entre los otros, por la frecuencia;
/// 3. la frecuencia máxima (como la capacidad).
/// La frecuencia sola no alcanza: en el Snapdragon 460 (TCL 20 SE, Moto G9 Play…) los 4 Cortex-A73 y los 4 A53 van a
/// 1,8 GHz, y el motor ponía hilos en los A53, que frenaban a los demás en cada capa.
pub fn clases_nucleos() -> (u64, u64, u64) {
    let leer = |r: String| std::fs::read_to_string(r).ok().and_then(|t| t.trim().parse::<u64>().ok());
    let n = (0..64).take_while(|i| std::path::Path::new(&format!("/sys/devices/system/cpu/cpu{}", i)).exists()).count().clamp(1, 64);
    let chicos_modelo = std::fs::read_to_string("/proc/cpuinfo").ok().and_then(|t| clases_cpuinfo(&t, n)).map(|r| r.1).unwrap_or(0);
    let cap: Vec<u64> = (0..n).map(|i| leer(format!("/sys/devices/system/cpu/cpu{}/cpu_capacity", i)).unwrap_or(0)).collect();
    let f: Vec<u64> = (0..n).map(|i| leer(format!("/sys/devices/system/cpu/cpu{}/cpufreq/cpuinfo_max_freq", i)).unwrap_or(0)).collect();
    clases_de(&cap, &f, chicos_modelo)
}
/// (la regla de `clases_nucleos`, aparte para probarla)
pub fn clases_de(cap: &[u64], f: &[u64], chicos_modelo: u64) -> (u64, u64, u64) {
    let tres = |v: &[u64], fuera: u64| -> Option<(u64, u64, u64)> {
        let tope = v.iter().enumerate().filter(|(i, _)| fuera >> i & 1 == 0).map(|(_, &x)| x).max()?; if tope == 0 { return None; }
        let (mut g, mut m, mut c) = (0u64, 0u64, fuera);
        for (i, &x) in v.iter().enumerate() {
            if x == 0 || fuera >> i & 1 != 0 { continue; }
            let r = x as f64 / tope as f64;
            if r >= 0.8 { g |= 1 << i; } else if r >= 0.45 { m |= 1 << i; } else { c |= 1 << i; }
        }
        if g == 0 { None } else { Some((g, m, c)) }
    };
    // 1) la capacidad (si separa en clases; los chicos por su modelo no son medianos aunque la capacidad diga que sí)
    if let Some((g, m, c)) = tres(cap, 0) { if m | c != 0 { return (g, m & !chicos_modelo, c | (m & chicos_modelo)); } }
    // 2) el modelo: los chicos aparte, y entre los demás, por la frecuencia
    if chicos_modelo != 0 {
        let otros = !chicos_modelo & ((1u64 << cap.len().max(f.len()).min(63)) - 1);
        return tres(f, chicos_modelo).filter(|r| r.0 != 0).unwrap_or((otros, 0, chicos_modelo));
    }
    // 3) la frecuencia
    tres(f, 0).unwrap_or((0, 0, 0))
}
/// los grandes y los chicos según `/proc/cpuinfo` (implementador y «CPU part» de cada núcleo), si los hay de los dos
pub fn clases_cpuinfo(t: &str, n: usize) -> Option<(u64, u64)> {
    let (mut parte, mut cual): (Vec<u64>, Option<usize>) = (vec![0; n], None);
    let (mut impl_, mut impls) = (0u64, vec![0u64; n]);
    for l in t.lines() {
        let mut kv = l.splitn(2, ':'); let (k, v) = (kv.next().unwrap_or("").trim(), kv.next().unwrap_or("").trim());
        let hex = |s: &str| u64::from_str_radix(s.trim_start_matches("0x"), 16).unwrap_or(0);
        match k { "processor" => cual = v.parse().ok(), "CPU implementer" => impl_ = hex(v), "CPU part" => { if let Some(i) = cual { if i < n { parte[i] = hex(v); impls[i] = impl_; } } } _ => {} }
    }
    // (ARM: A35 d04, A53 d03, A55 d05, A510 d46, A520 d80 · Qualcomm Kryo «Silver»: 801, 803, 805)
    let chico = |imp: u64, p: u64| (imp == 0x41 && matches!(p, 0xd03 | 0xd04 | 0xd05 | 0xd46 | 0xd80)) || (imp == 0x51 && matches!(p, 0x801 | 0x803 | 0x805));
    if !parte.iter().all(|&p| p != 0) { return None; }
    let (mut g, mut c) = (0u64, 0u64);
    for i in 0..n { if chico(impls[i], parte[i]) { c |= 1 << i; } else { g |= 1 << i; } }
    if g != 0 && c != 0 { Some((g, c)) } else { None }
}
#[cfg(test)]
mod prueba_nucleos {
    // el Snapdragon 460 (TCL 20 SE): 4 Kryo 240 Silver (A53, 0x801) y 4 Gold (A73, 0x800), todos a 1,8 GHz
    #[test]
    fn snapdragon_460() {
        let mut t = String::new();
        for i in 0..8 { t += &format!("processor\t: {}\nCPU implementer\t: 0x51\nCPU architecture: 8\nCPU part\t: {}\n\n", i, if i < 4 { "0x801" } else { "0x800" }); }
        assert_eq!(super::clases_cpuinfo(&t, 8), Some((0xf0, 0x0f)));
        // y uno con A55 + A76 (implementador ARM)
        let mut t = String::new();
        for i in 0..8 { t += &format!("processor\t: {}\nCPU implementer\t: 0x41\nCPU part\t: {}\n\n", i, if i < 6 { "0xd05" } else { "0xd0b" }); }
        assert_eq!(super::clases_cpuinfo(&t, 8), Some((0xc0, 0x3f)));
    }
    #[test]
    fn tres_clases() {
        use super::clases_de;
        // Dimensity 8500 (8 A725: 1×3,4 + 3×3,2 + 4×2,2 GHz): 4 grandes y 4 medianos
        let f = [2200000, 2200000, 2200000, 2200000, 3200000, 3200000, 3200000, 3400000];
        let cap = [660, 660, 660, 660, 960, 960, 960, 1024];
        assert_eq!(clases_de(&cap, &f, 0), (0xf0, 0x0f, 0));
        assert_eq!(clases_de(&[0; 8], &f, 0), (0xf0, 0x0f, 0));
        // Snapdragon 460 por el modelo: los A73 grandes y los A53 chicos (todos a 1,8 GHz)
        assert_eq!(clases_de(&[0; 8], &[1800000; 8], 0x0f), (0xf0, 0, 0x0f));
        // un 1+3+4 (X + A7xx + A5xx) con capacidad: el X y los A7xx… según la capacidad
        let cap = [250, 250, 250, 250, 700, 700, 700, 1024];
        assert_eq!(clases_de(&cap, &[0; 8], 0x0f), (0x80, 0x70, 0x0f));
        // los chicos por su modelo no pasan a medianos aunque su capacidad dé
        let cap = [480, 480, 480, 480, 1024, 1024, 1024, 1024];
        assert_eq!(clases_de(&cap, &[0; 8], 0x0f), (0xf0, 0, 0x0f));
        // todos iguales: todos grandes
        assert_eq!(clases_de(&[1024; 8], &[2000000; 8], 0), (0xff, 0, 0));
    }
}
static GRANDES: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
static MEDIANOS: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
static CHICOS: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
fn cuenta(a: &std::sync::atomic::AtomicU32) -> usize { a.load(std::sync::atomic::Ordering::Relaxed) as usize }
/// los hilos para empezar (los núcleos grandes, entre 2 y 4) y la máscara de los grandes; los medianos quedan anotados
/// en `hilos` (se suman cuando se piden más hilos que grandes)
fn nucleos_grandes() -> (usize, u64) {
    let (g, m, c) = clases_nucleos();
    if g == 0 { return (hilos::cuantos().clamp(1, 4), 0); }
    // (el detector que busca manos de fondo va a los chicos, si hay; si no, a los medianos)
    hilos::fijar_chicos(if c != 0 { c } else { m });
    hilos::fijar_medianos(m); hilos::fijar_resto(c);
    GRANDES.store(g.count_ones(), std::sync::atomic::Ordering::Relaxed); MEDIANOS.store(m.count_ones(), std::sync::atomic::Ordering::Relaxed); CHICOS.store(c.count_ones(), std::sync::atomic::Ordering::Relaxed);
    ((g.count_ones() as usize).clamp(2, 4), g)
}
/// hasta cuántos hilos prueba el motor: los grandes y los medianos (hasta 8); `menos`: los que se le dejan al juego
/// (de a 2 si hay medianos, que son más lentos). Sin medianos y sin juego al lado, también los chicos: en un
/// Snapdragon 460 los 4 Cortex-A53 suman algo si el sistema no los está usando (lo decide la medición).
fn tope_hilos(menos: usize) -> usize {
    let (g, m, c) = (cuenta(&GRANDES), cuenta(&MEDIANOS), cuenta(&CHICOS));
    if g == 0 { return hilos::cuantos().clamp(1, 4).saturating_sub(menos).max(1); }
    if m > 0 { (g + m).saturating_sub(2 * menos).clamp(1, 8) } else if menos == 0 && c > 0 { (g + c).clamp(1, 8) } else { g.saturating_sub(menos).clamp(1, 6) }
}

#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_crear(env: Env, _c: Obj, det: Obj, completo: Obj, liviano: Obj) -> i64 {
    let (d, c, l) = (bytes(env, det).to_vec(), bytes(env, completo).to_vec(), bytes(env, liviano).to_vec());
    let (n, mascara) = nucleos_grandes();
    hilos::configurar(n);
    hilos::fijar_nucleos(mascara);
    match Motor::nuevo(&d, &c) {
        Ok(mut motor) => {
            // (los hilos, elegidos midiendo: de los núcleos grandes —hasta 4— a 1)
            motor.auto.activo = true; motor.auto.tope = if mascara == 0 { n } else { tope_hilos(0) }; motor.auto.ocho_medir = true; motor.auto.dw_medir = crate::red::hay_f16(); motor.auto.base = cuenta(&GRANDES); Box::into_raw(Box::new(Estado { ocho_si: true, motor, detector: d, completo: c, liviano: l, usa_liviano: false, rgba: Vec::new(), salida: vec![0.0; CABECERA],
            vista: Vec::new(), vista_noche: false, dim: (0, 0), para_dibujar: Vec::new(), escena: None })) as i64
        }
        Err(e) => { ERROR = e; 0 }
    }
}

#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_error(env: Env, _c: Obj) -> Obj {
    let e = &*std::ptr::addr_of!(ERROR);
    texto(env, e)
}

/// lo medido por tipo de capa desde la última vez (con PERFIL prendido), o ""
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_perfil(env: Env, _c: Obj, m: i64) -> Obj {
    if m == 0 { return texto(env, ""); }
    let e = &mut *(m as *mut Estado);
    let s = e.motor.perfil_texto();
    // (con el perfil prendido, en otra línea lo que midió para elegir los hilos y 8 bits o float)
    if s.is_empty() || s == "-" { return texto(env, &s); }
    texto(env, &format!("{}\n{}", s, e.motor.auto.texto()))
}

#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_soltar(_env: Env, _c: Obj, m: i64) {
    if m != 0 { drop(Box::from_raw(m as *mut Estado)); }
}

/// ajustes: 0 máximo de manos · 1 presencia mínima · 2 puntaje mínimo de palma · 3 cada cuánto buscar otra mano (ms)
/// · 4 predicción (ms) · 5 campo de visión (grados) · 6, 7 filtro de los puntos (corte mínimo, beta) · 8, 9 filtro de
/// los ángulos · 10 modelo liviano (1) o completo (0) · 11 realce de poca luz (1/0) · 12 hilos · 13 reiniciar
/// · 14 cuentas en float16 si el procesador las tiene (1/0) · 15 hilos: los núcleos grandes menos éstos (entre 2 y 3;
/// para dejarle uno al juego) · 16 medir cada tipo de capa (1/0; ver perfil()) · 17 sin manos, buscar 1 de cada N cuadros
/// · 18 hilos elegidos midiendo (1/0) · 19 las 1×1 de la red de los puntos en 8 bits si el procesador tiene SDOT (1/0)
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
                if let Ok(mut nuevo) = Motor::nuevo(&e.detector, if liv { &e.liviano } else { &e.completo }) { nuevo.cfg = cfg; nuevo.auto.activo = e.motor.auto.activo; nuevo.auto.tope = e.motor.auto.tope; nuevo.auto.base = e.motor.auto.base;
                    // (con otro modelo, 8 bits contra float se vuelve a medir)
                    nuevo.auto.ocho_medir = e.ocho_si; if e.ocho_si { crate::red::USAR_8.store(true, std::sync::atomic::Ordering::Relaxed); }
                    nuevo.auto.dw_medir = crate::red::hay_f16(); crate::red::DW_RAPIDO.store(true, std::sync::atomic::Ordering::Relaxed);
                    e.motor = nuevo; e.usa_liviano = liv; }
            }
        }
        11 => e.motor.poca_luz(valor > 0.5),
        12 => { e.motor.auto.activo = false; hilos::configurar(valor.max(1.0) as usize) }
        13 => e.motor.reiniciar(),
        14 => crate::red::USAR_F16.store(valor > 0.5, std::sync::atomic::Ordering::Relaxed),
        16 => e.motor.perfil(valor > 0.5),
        17 => e.motor.cfg.buscar_cada = valor.max(1.0) as u32,
        15 => { let n = tope_hilos(valor.max(0.0) as usize);
            // (el tope; los hilos se eligen midiendo, de ahí para abajo)
            hilos::configurar(n); e.motor.auto.tope = n; e.motor.auto.base = cuenta(&GRANDES).saturating_sub(valor.max(0.0) as usize).max(1); e.motor.auto.elegido = 0; e.motor.auto.activo = true; }
        18 => e.motor.auto.activo = valor > 0.5,
        19 => { e.ocho_si = valor > 0.5; crate::red::USAR_8.store(e.ocho_si, std::sync::atomic::Ordering::Relaxed);
            if e.ocho_si { e.motor.auto.ocho_medir = true; } else { e.motor.auto.ocho_parar(); } }
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
    // la vista: la misma imagen (aclarada con «ver de noche»): a un ByteBuffer de Java si lo pasan, y si no queda acá
    // para `dibujar`
    let pvista = direccion(env, vista);
    e.vista_noche = vista_noche != 0; e.dim = (ow, oh);
    if e.vista_noche {
        let tabla = crate::luz::tabla_rgba(&e.rgba);
        if e.vista.len() != e.rgba.len() { e.vista = vec![0u8; e.rgba.len()]; }
        for (d, s) in e.vista.chunks_exact_mut(4).zip(e.rgba.chunks_exact(4)) { d[0] = tabla[s[0] as usize]; d[1] = tabla[s[1] as usize]; d[2] = tabla[s[2] as usize]; d[3] = 255; }
    }
    if !pvista.is_null() && capacidad(env, vista) >= ow * oh * 4 {
        let dst = std::slice::from_raw_parts_mut(pvista, ow * oh * 4);
        dst.copy_from_slice(if e.vista_noche { &e.vista } else { &e.rgba });
    }
    let t1 = Instant::now();
    let manos = e.motor.procesar(&e.rgba, ow, oh, t_ns as f64 / 1e6, espejo != 0);
    let t_motor = t1.elapsed().as_secs_f64() * 1e3;
    let (brillo, ganancia) = e.motor.luz();
    e.para_dibujar.clear();
    for x in &manos { e.para_dibujar.push(crate::escena::ManoDibujo { pts: std::array::from_fn(|i| [x.img[i][0] * ow as f32, x.img[i][1] * oh as f32, x.img[i][2] * ow as f32]) }); }
    let s = &mut e.salida; s.clear();
    let f16 = crate::red::hay_f16() && crate::red::USAR_F16.load(std::sync::atomic::Ordering::Relaxed);
    // (cabecera: manos, corrió el detector en el cuadro, inferencias, ms del motor, ms de YUV, brillo, ganancia, hilos,
    // float16, núcleos grandes, ms del recorte, ms de la red de puntos, ms del detector, núcleos chicos, producto punto
    // de 8 bits —0 no hay, 1 hay, 2 en uso, 3 en uso con i8mm—, hilos elegidos midiendo —0 no, 1 sí, 2 probando—,
    // núcleos medianos, libre)
    let (ms_rec, ms_red, ms_det) = e.motor.tiempos();
    s.extend_from_slice(&[manos.len() as f32, e.motor.corrio_detector as u8 as f32, e.motor.inferencias as f32, t_motor as f32, t_yuv as f32, brillo, ganancia, hilos::cuantos() as f32, f16 as u8 as f32,
        GRANDES.load(std::sync::atomic::Ordering::Relaxed) as f32, ms_rec, ms_red, ms_det, CHICOS.load(std::sync::atomic::Ordering::Relaxed) as f32,
        if crate::red::i8mm_en_uso() { 3.0 } else if crate::red::ocho_en_uso() { 2.0 } else if crate::red::hay_dot() { 1.0 } else { 0.0 },
        if e.motor.auto.activo { if e.motor.auto.probando() { 2.0 } else { 1.0 } } else { 0.0 },
        MEDIANOS.load(std::sync::atomic::Ordering::Relaxed) as f32, 0.0]);
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

/// dibuja el último cuadro (la imagen y la mano en 3D) con el contexto de OpenGL ES que la app dejó activo en este hilo.
/// `estilo`: 0 cristal · 1 piel · 2 robot · 3 esqueleto. Devuelve 0, o −1 si no se pudo armar (ver error()).
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_dibujar(_env: Env, _c: Obj, m: i64, ancho: i32, alto: i32, estilo: i32, grosor: f32, tiempo: f32) -> i32 {
    if m == 0 { return -1; }
    let e = &mut *(m as *mut Estado);
    if e.dim.0 == 0 || ancho <= 0 || alto <= 0 { return 0; }
    if e.escena.is_none() {
        match crate::escena::Escena::nueva() { Ok(x) => e.escena = Some(x), Err(x) => { ERROR = x; return -1; } }
    }
    let img: &[u8] = if e.vista_noche && e.vista.len() == e.rgba.len() { &e.vista } else { &e.rgba };
    if let Some(esc) = e.escena.as_mut() { esc.dibujar(img, e.dim.0, e.dim.1, &e.para_dibujar, estilo, grosor, ancho as usize, alto as usize, tiempo); }
    0
}

/// el contexto de OpenGL se perdió (o se va a borrar): `borrar` = 1 si todavía está activo y se pueden borrar las cosas
#[no_mangle]
pub unsafe extern "system" fn Java_com_jxapps_jxhand_Motor_soltarEscena(_env: Env, _c: Obj, m: i64, borrar: u8) {
    if m == 0 { return; }
    let e = &mut *(m as *mut Estado);
    if let Some(mut esc) = e.escena.take() { if borrar != 0 { esc.soltar(); } }
}
