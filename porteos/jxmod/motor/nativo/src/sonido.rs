//! El sonido, sin Java ni bibliotecas de afuera: los MP3 del paquete (`a:nombre`, los mismos de la web) se decodifican con
//! el decodificador del sistema (MediaCodec del NDK: libmediandk.so) leyendo directo de pk.bin adentro de la APK, y suenan
//! con AAudio (libaaudio.so, Android 8 en adelante), las dos bibliotecas abiertas en el momento. La mezcla es propia:
//! cada voz con su remuestreo (y su tono), el volumen por la distancia y el paneo izquierda/derecha según hacia dónde mira
//! el jugador. En la compu (las pruebas) no suena nada.
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// un sonido decodificado: muestras de 16 bits intercaladas
pub struct Pcm { pub rate: u32, pub ch: u16, pub datos: Vec<i16> }
struct Voz { pcm: Arc<Pcm>, pos: f64, paso: f64, vi: f32, vd: f32, /** los que se repiten (el ambiente): su número */ lazo: u64 }
pub struct Mezcla { voces: Vec<Voz>, pub rate: u32 }
impl Mezcla {
    /// mezcla `n` cuadros estéreo en float (la salida los pide)
    pub fn llenar(&mut self, out: &mut [f32], n: usize) {
        for x in out.iter_mut().take(n * 2) { *x = 0.0; }
        self.voces.retain_mut(|v| {
            let p = &v.pcm; let ch = p.ch as usize; let largo = p.datos.len() / ch.max(1);
            for k in 0..n {
                let mut i = v.pos as usize;
                if i + 1 >= largo { if v.lazo == 0 { return false; } v.pos = 0.0; i = 0; }
                let f = (v.pos - i as f64) as f32;
                let m = |j: usize| -> f32 { if ch == 2 { (p.datos[j * 2] as f32 + p.datos[j * 2 + 1] as f32) * 0.5 } else { p.datos[j] as f32 } };
                let s = (m(i) * (1.0 - f) + m(i + 1) * f) / 32768.0;
                out[k * 2] += s * v.vi; out[k * 2 + 1] += s * v.vd;
                v.pos += v.paso;
            }
            true
        });
        for x in out.iter_mut().take(n * 2) { *x = x.clamp(-1.0, 1.0); }
    }
}

pub struct Sonido {
    pub mezcla: Arc<Mutex<Mezcla>>,
    cache: HashMap<String, Option<Arc<Pcm>>>,
    /// de dónde se leen: el pk.bin de la APK (su descriptor y dónde empieza adentro de la APK) y el índice del paquete
    #[cfg(target_os = "android")] fuente: Option<(std::os::fd::OwnedFd, usize)>,
    idx: HashMap<String, (usize, usize)>,
    #[cfg(target_os = "android")] _salida: Option<android::Salida>,
    /// el oyente: dónde está y hacia dónde mira (para el volumen y el paneo)
    pub oyente: ([f32; 3], f32),
    pub volumen: f32,
    /// los bucles (el ambiente): su clave → número de voz y si se pidió en este cuadro
    bucles: HashMap<String, (u64, bool)>, prox: u64,
}

impl Sonido {
    /// sin salida (la compu)
    pub fn mudo() -> Sonido {
        Sonido { mezcla: Arc::new(Mutex::new(Mezcla { voces: vec![], rate: 48000 })), cache: HashMap::new(), #[cfg(target_os = "android")] fuente: None, idx: HashMap::new(),
            #[cfg(target_os = "android")] _salida: None, oyente: ([0.0; 3], 0.0), volumen: 1.0, bucles: HashMap::new(), prox: 1 }
    }
    /// con el pk.bin de la APK (descriptor y comienzo) y su índice: abre la salida de AAudio
    #[cfg(target_os = "android")]
    pub fn android(fuente: Option<(std::os::fd::OwnedFd, usize)>, idx: HashMap<String, (usize, usize)>) -> Sonido {
        let mut s = Sonido::mudo(); s.fuente = fuente; s.idx = idx;
        s._salida = unsafe { android::Salida::abrir(s.mezcla.clone()) };
        s
    }
    pub fn suena(&self) -> bool {
        #[cfg(target_os = "android")] { return self._salida.is_some(); }
        #[allow(unreachable_code)] false
    }
    fn pcm(&mut self, nombre: &str) -> Option<Arc<Pcm>> {
        if let Some(p) = self.cache.get(nombre) { return p.clone(); }
        let p = self.decodificar(nombre).map(Arc::new);
        self.cache.insert(nombre.to_string(), p.clone());
        p
    }
    #[cfg(target_os = "android")]
    fn decodificar(&self, nombre: &str) -> Option<Pcm> {
        use std::os::fd::AsRawFd;
        let (fd, base) = self.fuente.as_ref()?; let &(o, n) = self.idx.get(&format!("a:{nombre}"))?;
        unsafe { android::decodificar(fd.as_raw_fd(), (base + o) as i64, n as i64) }
    }
    #[cfg(not(target_os = "android"))]
    fn decodificar(&self, _nombre: &str) -> Option<Pcm> { None }

    /// hace sonar `nombre` con un volumen y un tono (1: el de siempre); con `donde`, en ese lugar (más bajo cuanto más
    /// lejos, y del lado donde está)
    pub fn tocar(&mut self, nombre: &str, vol: f32, tono: f32, donde: Option<[f32; 3]>) {
        if !self.suena() { return; }
        let Some(p) = self.pcm(nombre) else { return };
        let (mut vi, mut vd) = (vol * self.volumen, vol * self.volumen);
        if let Some(d) = donde {
            let (o, yaw) = self.oyente; let v = [d[0] - o[0], d[1] - o[1], d[2] - o[2]]; let dist = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
            if dist > 45.0 { return; }
            let g = (3.0 / dist.max(3.0)).powf(1.1);
            // (la derecha del jugador: -X girado, como en el juego)
            let der = [-yaw.cos(), 0.0, yaw.sin()]; let pan = if dist > 0.01 { ((v[0] * der[0] + v[2] * der[2]) / dist).clamp(-1.0, 1.0) * 0.8 } else { 0.0 };
            vi *= g * ((1.0 - pan) * 0.5).sqrt() * std::f32::consts::SQRT_2; vd *= g * ((1.0 + pan) * 0.5).sqrt() * std::f32::consts::SQRT_2;
        }
        let rate = self.mezcla.lock().map(|m| m.rate).unwrap_or(48000);
        let paso = p.rate as f64 / rate as f64 * tono as f64;
        if let Ok(mut m) = self.mezcla.lock() { if m.voces.len() < 48 { m.voces.push(Voz { pcm: p, pos: 0.0, paso, vi, vd, lazo: 0 }); } }
    }
    /// un sonido que se repite mientras se lo pida cada cuadro (el viento, la ciudad): con `clave`, a este volumen
    pub fn bucle(&mut self, clave: &str, nombre: &str, vol: f32) {
        if !self.suena() { return; }
        let g = vol * self.volumen;
        if let Some(b) = self.bucles.get_mut(clave) {
            b.1 = true; let id = b.0;
            if let Ok(mut m) = self.mezcla.lock() { if let Some(v) = m.voces.iter_mut().find(|v| v.lazo == id) { v.vi = g; v.vd = g; } }
            return;
        }
        let Some(p) = self.pcm(nombre) else { return };
        let id = self.prox; self.prox += 1;
        let rate = self.mezcla.lock().map(|m| m.rate).unwrap_or(48000); let paso = p.rate as f64 / rate as f64;
        if let Ok(mut m) = self.mezcla.lock() { m.voces.push(Voz { pcm: p, pos: 0.0, paso, vi: g, vd: g, lazo: id }); }
        self.bucles.insert(clave.to_string(), (id, true));
    }
    /// al terminar el cuadro: se cortan los bucles que no se pidieron
    pub fn fin_bucles(&mut self) {
        let fuera: Vec<(String, u64)> = self.bucles.iter().filter(|(_, b)| !b.1).map(|(k, b)| (k.clone(), b.0)).collect();
        if !fuera.is_empty() { if let Ok(mut m) = self.mezcla.lock() { m.voces.retain(|v| v.lazo == 0 || !fuera.iter().any(|f| f.1 == v.lazo)); } }
        for (k, _) in fuera { self.bucles.remove(&k); }
        for b in self.bucles.values_mut() { b.1 = false; }
    }
}

#[cfg(target_os = "android")]
mod android {
    use super::{Mezcla, Pcm};
    use std::ffi::{c_char, c_void, CString};
    use std::sync::{Arc, Mutex};

    #[repr(C)] struct BufInfo { offset: i32, size: i32, tiempo: i64, flags: u32 }
    type P = *mut c_void;

    /// las bibliotecas del sistema, abiertas una sola vez
    fn lib(n: &str) -> Option<&'static libloading::Library> {
        static MEDIA: std::sync::OnceLock<Option<libloading::Library>> = std::sync::OnceLock::new();
        static AUDIO: std::sync::OnceLock<Option<libloading::Library>> = std::sync::OnceLock::new();
        let c = if n.contains("media") { &MEDIA } else { &AUDIO };
        c.get_or_init(|| unsafe { libloading::Library::new(n).ok() }).as_ref()
    }
    macro_rules! f { ($l:expr, $n:literal, $t:ty) => { *$l.get::<$t>(concat!($n, "\0").as_bytes()).ok()? } }

    /// un MP3 (o lo que el sistema sepa leer) de un pedazo de archivo a PCM de 16 bits, con MediaCodec
    pub unsafe fn decodificar(fd: i32, off: i64, len: i64) -> Option<Pcm> {
        let l = lib("libmediandk.so")?;
        let ex_new = f!(l, "AMediaExtractor_new", unsafe extern "C" fn() -> P);
        let ex_fd = f!(l, "AMediaExtractor_setDataSourceFd", unsafe extern "C" fn(P, i32, i64, i64) -> i32);
        let ex_n = f!(l, "AMediaExtractor_getTrackCount", unsafe extern "C" fn(P) -> usize);
        let ex_fmt = f!(l, "AMediaExtractor_getTrackFormat", unsafe extern "C" fn(P, usize) -> P);
        let ex_sel = f!(l, "AMediaExtractor_selectTrack", unsafe extern "C" fn(P, usize) -> i32);
        let ex_leer = f!(l, "AMediaExtractor_readSampleData", unsafe extern "C" fn(P, *mut u8, usize) -> isize);
        let ex_t = f!(l, "AMediaExtractor_getSampleTime", unsafe extern "C" fn(P) -> i64);
        let ex_sig = f!(l, "AMediaExtractor_advance", unsafe extern "C" fn(P) -> bool);
        let ex_del = f!(l, "AMediaExtractor_delete", unsafe extern "C" fn(P) -> i32);
        let fm_str = f!(l, "AMediaFormat_getString", unsafe extern "C" fn(P, *const c_char, *mut *const c_char) -> bool);
        let fm_int = f!(l, "AMediaFormat_getInt32", unsafe extern "C" fn(P, *const c_char, *mut i32) -> bool);
        let fm_del = f!(l, "AMediaFormat_delete", unsafe extern "C" fn(P) -> i32);
        let co_new = f!(l, "AMediaCodec_createDecoderByType", unsafe extern "C" fn(*const c_char) -> P);
        let co_conf = f!(l, "AMediaCodec_configure", unsafe extern "C" fn(P, P, P, P, u32) -> i32);
        let co_start = f!(l, "AMediaCodec_start", unsafe extern "C" fn(P) -> i32);
        let co_in = f!(l, "AMediaCodec_dequeueInputBuffer", unsafe extern "C" fn(P, i64) -> isize);
        let co_inbuf = f!(l, "AMediaCodec_getInputBuffer", unsafe extern "C" fn(P, usize, *mut usize) -> *mut u8);
        let co_q = f!(l, "AMediaCodec_queueInputBuffer", unsafe extern "C" fn(P, usize, i64, usize, u64, u32) -> i32);
        let co_out = f!(l, "AMediaCodec_dequeueOutputBuffer", unsafe extern "C" fn(P, *mut BufInfo, i64) -> isize);
        let co_outbuf = f!(l, "AMediaCodec_getOutputBuffer", unsafe extern "C" fn(P, usize, *mut usize) -> *mut u8);
        let co_rel = f!(l, "AMediaCodec_releaseOutputBuffer", unsafe extern "C" fn(P, usize, bool) -> i32);
        let co_ofmt = f!(l, "AMediaCodec_getOutputFormat", unsafe extern "C" fn(P) -> P);
        let co_stop = f!(l, "AMediaCodec_stop", unsafe extern "C" fn(P) -> i32);
        let co_del = f!(l, "AMediaCodec_delete", unsafe extern "C" fn(P) -> i32);
        let (k_mime, k_rate, k_ch) = (CString::new("mime").unwrap(), CString::new("sample-rate").unwrap(), CString::new("channel-count").unwrap());
        let ex = ex_new(); if ex.is_null() { return None; }
        if ex_fd(ex, fd, off, len) != 0 || ex_n(ex) == 0 { ex_del(ex); return None; }
        let fmt = ex_fmt(ex, 0); let mut mime: *const c_char = std::ptr::null();
        if !fm_str(fmt, k_mime.as_ptr(), &mut mime) || mime.is_null() { fm_del(fmt); ex_del(ex); return None; }
        let (mut rate, mut ch) = (44100i32, 1i32); fm_int(fmt, k_rate.as_ptr(), &mut rate); fm_int(fmt, k_ch.as_ptr(), &mut ch);
        ex_sel(ex, 0);
        let co = co_new(mime); if co.is_null() { fm_del(fmt); ex_del(ex); return None; }
        if co_conf(co, fmt, std::ptr::null_mut(), std::ptr::null_mut(), 0) != 0 || co_start(co) != 0 { co_del(co); fm_del(fmt); ex_del(ex); return None; }
        fm_del(fmt);
        let mut datos: Vec<i16> = vec![]; let (mut fin_in, mut fin_out) = (false, false); let mut vueltas = 0;
        while !fin_out && vueltas < 20000 {
            vueltas += 1;
            if !fin_in {
                let i = co_in(co, 2000);
                if i >= 0 {
                    let mut cap = 0usize; let b = co_inbuf(co, i as usize, &mut cap);
                    let n = ex_leer(ex, b, cap);
                    if n < 0 { co_q(co, i as usize, 0, 0, 0, 4); fin_in = true; }
                    else { co_q(co, i as usize, 0, n as usize, ex_t(ex).max(0) as u64, 0); ex_sig(ex); }
                }
            }
            let mut info = BufInfo { offset: 0, size: 0, tiempo: 0, flags: 0 };
            let o = co_out(co, &mut info, 2000);
            if o >= 0 {
                let mut cap = 0usize; let b = co_outbuf(co, o as usize, &mut cap);
                if !b.is_null() && info.size > 0 {
                    let s = std::slice::from_raw_parts(b.add(info.offset as usize) as *const i16, info.size as usize / 2); datos.extend_from_slice(s);
                }
                co_rel(co, o as usize, false);
                if info.flags & 4 != 0 { fin_out = true; }
            } else if o == -2 {
                // (cambió el formato de la salida: la frecuencia y los canales de verdad)
                let f2 = co_ofmt(co); fm_int(f2, k_rate.as_ptr(), &mut rate); fm_int(f2, k_ch.as_ptr(), &mut ch); fm_del(f2);
            }
        }
        co_stop(co); co_del(co); ex_del(ex);
        if datos.is_empty() { return None; }
        Some(Pcm { rate: rate.max(8000) as u32, ch: ch.clamp(1, 2) as u16, datos })
    }

    /// la salida de AAudio: un flujo estéreo en float que pide la mezcla desde su propio hilo
    pub struct Salida { stream: P, close: unsafe extern "C" fn(P) -> i32, _m: Box<Arc<Mutex<Mezcla>>> }
    unsafe impl Send for Salida {}
    impl Drop for Salida { fn drop(&mut self) { unsafe { (self.close)(self.stream); } } }

    unsafe extern "C" fn llamada(_s: P, user: *mut c_void, datos: *mut c_void, n: i32) -> i32 {
        let m = &*(user as *const Arc<Mutex<Mezcla>>); let out = std::slice::from_raw_parts_mut(datos as *mut f32, n as usize * 2);
        // (si el juego justo la tiene tomada, este pedacito sale en silencio: nunca se espera en el hilo del sonido)
        match m.try_lock() { Ok(mut g) => g.llenar(out, n as usize), Err(_) => { for x in out.iter_mut() { *x = 0.0; } } }
        0
    }

    impl Salida {
        pub unsafe fn abrir(m: Arc<Mutex<Mezcla>>) -> Option<Salida> {
            let l = lib("libaaudio.so")?;
            let crear = f!(l, "AAudio_createStreamBuilder", unsafe extern "C" fn(*mut P) -> i32);
            let formato = f!(l, "AAudioStreamBuilder_setFormat", unsafe extern "C" fn(P, i32));
            let canales = f!(l, "AAudioStreamBuilder_setChannelCount", unsafe extern "C" fn(P, i32));
            let modo = f!(l, "AAudioStreamBuilder_setPerformanceMode", unsafe extern "C" fn(P, i32));
            let cb = f!(l, "AAudioStreamBuilder_setDataCallback", unsafe extern "C" fn(P, unsafe extern "C" fn(P, *mut c_void, *mut c_void, i32) -> i32, *mut c_void));
            let abrir = f!(l, "AAudioStreamBuilder_openStream", unsafe extern "C" fn(P, *mut P) -> i32);
            let borrar = f!(l, "AAudioStreamBuilder_delete", unsafe extern "C" fn(P) -> i32);
            let empezar = f!(l, "AAudioStream_requestStart", unsafe extern "C" fn(P) -> i32);
            let rate = f!(l, "AAudioStream_getSampleRate", unsafe extern "C" fn(P) -> i32);
            let close = f!(l, "AAudioStream_close", unsafe extern "C" fn(P) -> i32);
            let mut b: P = std::ptr::null_mut(); if crear(&mut b) != 0 || b.is_null() { return None; }
            let caja = Box::new(m.clone());
            formato(b, 2); canales(b, 2); modo(b, 12);   // (float, estéreo, baja latencia)
            cb(b, llamada, &*caja as *const Arc<Mutex<Mezcla>> as *mut c_void);
            let mut s: P = std::ptr::null_mut(); let r = abrir(b, &mut s); borrar(b);
            if r != 0 || s.is_null() { return None; }
            if let Ok(mut g) = m.lock() { g.rate = rate(s).max(8000) as u32; }
            if empezar(s) != 0 { close(s); return None; }
            Some(Salida { stream: s, close, _m: caja })
        }
    }
}
