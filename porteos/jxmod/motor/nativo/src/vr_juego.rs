//! El modo VR (vr.js de la web): el celular adentro de un casco (VR box). La escena se dibuja dos veces, una por ojo, cada una
//! en su mitad de la pantalla, con los ojos separados como los tuyos (6,3 cm); la cabeza mira con el giroscopio del celular
//! (el vector de rotación de Android, sin la brújula: no salta) y el dedo sigue girando como siempre. Se entra y se sale
//! desde la pausa (VR) o desde Partida nueva. Va como hijo de comun.rs.
use super::*;

/// lo del VR: si está prendido, la separación de los ojos (m), el rumbo y la inclinación anteriores de la cabeza, y el sensor
pub struct EnVr {
    pub on: bool, pub sep: f32, rumbo_ant: Option<f32>,
    #[cfg(target_os = "android")] sensor: Option<sensor::Sensor>,
    /// las dos cámaras del último cuadro (vista y proyección, y dónde está cada ojo)
    pub ojos: Option<[([f32; 16], [f32; 3]); 2]>,
}
impl Default for EnVr { fn default() -> Self { EnVr { on: false, sep: 0.063, rumbo_ant: None, #[cfg(target_os = "android")] sensor: None, ojos: None } } }

/// de un giro (x, y, z, w) del celular al mundo (este, norte, arriba), con el celular acostado (la pantalla apaisada): el rumbo
/// (en el sentido de las agujas, rad) y cuánto mira para arriba (rad) de lo que ve la cámara (−z del celular)
pub fn cabeza(q: [f32; 4]) -> (f32, f32) {
    let [x, y, z, w] = q;
    let f = [-2.0 * (x * z + y * w), -2.0 * (y * z - x * w), -(1.0 - 2.0 * (x * x + y * y))];
    (f[0].atan2(f[1]), f[2].clamp(-1.0, 1.0).asin())
}

#[cfg(target_os = "android")]
mod sensor {
    use std::ffi::c_void;
    #[repr(C)] pub struct Evento { version: i32, sensor: i32, tipo: i32, reservado: i32, ts: i64, d: [f32; 16], flags: u32, reservado1: [i32; 3] }
    #[link(name = "android")]
    extern "C" {
        fn ASensorManager_getInstance() -> *mut c_void;
        fn ASensorManager_getDefaultSensor(m: *mut c_void, tipo: i32) -> *const c_void;
        fn ASensorManager_createEventQueue(m: *mut c_void, looper: *mut c_void, ident: i32, cb: *const c_void, data: *mut c_void) -> *mut c_void;
        fn ASensorManager_destroyEventQueue(m: *mut c_void, q: *mut c_void) -> i32;
        fn ASensorEventQueue_enableSensor(q: *mut c_void, s: *const c_void) -> i32;
        fn ASensorEventQueue_setEventRate(q: *mut c_void, s: *const c_void, us: i32) -> i32;
        fn ASensorEventQueue_getEvents(q: *mut c_void, ev: *mut Evento, n: usize) -> isize;
        fn ALooper_forThread() -> *mut c_void;
        fn ALooper_prepare(opts: i32) -> *mut c_void;
    }
    pub struct Sensor { m: *mut c_void, q: *mut c_void }
    impl Sensor {
        pub fn abrir() -> Option<Sensor> { unsafe {
            let m = ASensorManager_getInstance(); if m.is_null() { return None; }
            // (el vector de rotación del juego —15: sin la brújula—; si el celular no lo tiene, el común —11—)
            let mut s = ASensorManager_getDefaultSensor(m, 15); if s.is_null() { s = ASensorManager_getDefaultSensor(m, 11); } if s.is_null() { return None; }
            let mut l = ALooper_forThread(); if l.is_null() { l = ALooper_prepare(0); }
            let q = ASensorManager_createEventQueue(m, l, 7, std::ptr::null(), std::ptr::null_mut()); if q.is_null() { return None; }
            ASensorEventQueue_enableSensor(q, s); ASensorEventQueue_setEventRate(q, s, 10_000);
            Some(Sensor { m, q })
        } }
        /// el último giro que llegó (x, y, z, w)
        pub fn leer(&mut self) -> Option<[f32; 4]> { unsafe {
            let mut ev: [Evento; 8] = std::mem::zeroed(); let mut ult = None;
            loop {
                let n = ASensorEventQueue_getEvents(self.q, ev.as_mut_ptr(), 8); if n <= 0 { break; }
                let e = &ev[n as usize - 1]; let (x, y, z) = (e.d[0], e.d[1], e.d[2]);
                let w = if e.d[3] != 0.0 { e.d[3] } else { (1.0 - x * x - y * y - z * z).max(0.0).sqrt() };
                ult = Some([x, y, z, w]);
            }
            ult
        } }
    }
    impl Drop for Sensor { fn drop(&mut self) { unsafe { ASensorManager_destroyEventQueue(self.m, self.q); } } }
}

impl Juego {
    /// prender o apagar el VR (la pausa y Partida nueva)
    pub fn vr_alternar(&mut self) {
        self.vr.on = !self.vr.on; self.vr.rumbo_ant = None; self.vr.ojos = None;
        #[cfg(target_os = "android")] { self.vr.sensor = if self.vr.on { sensor::Sensor::abrir() } else { None }; }
        let giro = { #[cfg(target_os = "android")] { self.vr.sensor.is_some() } #[cfg(not(target_os = "android"))] { false } };
        self.avisar(if !self.vr.on { "Modo VR apagado".into() } else if giro { "Modo VR: poné el celular en el casco. La cabeza mira con el giroscopio; la pausa lo apaga".into() } else { "Modo VR (sin giroscopio: se mira con el dedo)".into() });
    }
    /// cada cuadro en VR: lo que giró la cabeza (el rumbo, sumado al del dedo) y para dónde mira (la inclinación)
    pub(crate) fn vr_paso(&mut self) {
        if !self.vr.on { return; }
        #[cfg(target_os = "android")]
        if let Some(q) = self.vr.sensor.as_mut().and_then(|s| s.leer()) {
            let (rumbo, arriba) = cabeza(q);
            if let Some(r0) = self.vr.rumbo_ant { let mut d = rumbo - r0; if d > std::f32::consts::PI { d -= std::f32::consts::TAU; } if d < -std::f32::consts::PI { d += std::f32::consts::TAU; } self.jug.yaw -= d; }
            self.vr.rumbo_ant = Some(rumbo); self.jug.pitch = (-arriba).clamp(-1.5, 1.5);
        }
    }
}
/// las dos cámaras: los ojos a los costados de `cam` (derecha = la de la mirada) con la proyección `p` de media pantalla
pub(crate) fn ojos(vr: &EnVr, p: &[f32; 16], cam: [f32; 3], mira: [f32; 3]) -> Option<[([f32; 16], [f32; 3]); 2]> {
    if !vr.on { return None; }
    let l = (mira[0] * mira[0] + mira[2] * mira[2]).sqrt().max(1e-5); let d = [-mira[2] / l * vr.sep * 0.5, 0.0, mira[0] / l * vr.sep * 0.5];
    let ojo = |s: f32| { let c = [cam[0] + d[0] * s, cam[1], cam[2] + d[2] * s]; (m4::mul(p, &m4::mirar(c, [c[0] + mira[0], c[1] + mira[1], c[2] + mira[2]], [0.0, 1.0, 0.0])), c) };
    Some([ojo(-1.0), ojo(1.0)])
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn cabeza_del_giroscopio() {
        // (el celular acostado mirando al norte —su −z al norte—: rumbo 0, horizonte; girado 90° a la derecha —al este—: rumbo π/2)
        let q_norte = { let a = std::f32::consts::FRAC_PI_4; [a.sin(), 0.0, 0.0, a.cos()] };
        let (r, a) = cabeza(q_norte); assert!(r.abs() < 1e-3 && a.abs() < 1e-3, "{r} {a}");
        // (90° alrededor del eje de arriba —z—, hacia el este: rumbo +π/2)
        let qz = { let b = -std::f32::consts::FRAC_PI_4; [0.0, 0.0, b.sin(), b.cos()] };
        let m = |p: [f32; 4], q: [f32; 4]| [p[3] * q[0] + p[0] * q[3] + p[1] * q[2] - p[2] * q[1], p[3] * q[1] - p[0] * q[2] + p[1] * q[3] + p[2] * q[0], p[3] * q[2] + p[0] * q[1] - p[1] * q[0] + p[2] * q[3], p[3] * q[3] - p[0] * q[0] - p[1] * q[1] - p[2] * q[2]];
        let (r2, a2) = cabeza(m(qz, q_norte)); assert!((r2 - std::f32::consts::FRAC_PI_2).abs() < 1e-3 && a2.abs() < 1e-3, "{r2} {a2}");
    }
}
