//! El sonido, sin Java ni bibliotecas de afuera: los MP3 del paquete (`a:nombre`, los mismos de la web) se decodifican con
//! el decodificador del sistema (MediaCodec del NDK: libmediandk.so) leyendo directo de pk.bin adentro de la APK, y suenan
//! con AAudio (libaaudio.so, Android 8 en adelante), las dos bibliotecas abiertas en el momento. La mezcla es propia:
//! cada voz con su remuestreo (y su tono), el volumen por la distancia y el paneo izquierda/derecha según hacia dónde mira
//! el jugador. En la compu (las pruebas) no suena nada.
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// un sonido decodificado: muestras de 16 bits intercaladas
pub struct Pcm { pub rate: u32, pub ch: u16, pub datos: Vec<i16> }
/// a mono y, si pasa de 32 kHz, a la mitad de las muestras (promediando de a dos): un tema de 3 minutos queda en ~8 MB
pub fn achicar(p: Pcm) -> Pcm {
    let ch = p.ch.max(1) as usize; let n = p.datos.len() / ch; let mezcla = |i: usize| -> i32 { (0..ch).map(|c| p.datos[i * ch + c] as i32).sum::<i32>() / ch as i32 };
    if p.rate > 32000 { let datos = (0..n / 2).map(|i| ((mezcla(2 * i) + mezcla(2 * i + 1)) / 2) as i16).collect(); Pcm { rate: p.rate / 2, ch: 1, datos } }
    else { Pcm { rate: p.rate, ch: 1, datos: (0..n).map(|i| mezcla(i) as i16).collect() } }
}
/// cómo suena el lugar (acustica.rs la elige): el largo de la cola de la reverberación (0..1), cuánto se apagan los agudos
/// en ella (0..1), cuánto se mezcla, la demora hasta la cola (ms), el eco de una pared lejana (ms y cuánto) y el corte de
/// todo lo del mundo (Hz: bajo el agua, apagado)
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Sala { pub cola: f32, pub amort: f32, pub mezcla: f32, pub pre_ms: f32, pub eco_ms: f32, pub eco: f32, pub corte_hz: f32 }
impl Default for Sala { fn default() -> Self { Sala { cola: 0.3, amort: 0.7, mezcla: 0.06, pre_ms: 30.0, eco_ms: 0.0, eco: 0.0, corte_hz: 20000.0 } } }

/// lo espacial de una voz con lugar: dónde suena, la ganancia de cada oído (la de ahora y a la que va), el filtro de cada
/// oído (la sombra de la cabeza, la distancia y las paredes: coeficiente y estado), la demora de cada oído (muestras: el
/// oído lejos escucha 0,66 ms después) y cuánto va a la reverberación; y si una pared lo tapa (0..1)
struct Esp { donde: [f32; 3], g: [f32; 2], g_t: [f32; 2], a: [f32; 2], z: [f32; 2], itd: [f32; 2], envio: f32, envio_t: f32, pub oclu: f32, revisada: bool }
struct Voz { pcm: Arc<Pcm>, pos: f64, paso: f64, vi: f32, vd: f32, /** los que se repiten (el ambiente): su número */ lazo: u64, /** desde dónde vuelve (en muestras) */ ini: f64,
    /** su número (para taparla) */ id: u64, /** del mundo (con reverberación) o de la interfaz y la música (sin) */ mundo: bool, /** sin lugar: cuánto va a la reverberación */ envio: f32, esp: Option<Esp> }

// —— la reverberación (la de Freeverb, más chica: 4 peines y 2 pasatodos por oído), la demora y el eco ——
struct Peine { b: Vec<f32>, i: usize, z: f32 }
impl Peine { fn nuevo(n: usize) -> Peine { Peine { b: vec![0.0; n.max(1)], i: 0, z: 0.0 } }
    #[inline] fn paso(&mut self, x: f32, fb: f32, am: f32) -> f32 { let y = self.b[self.i]; self.z = cero(y * (1.0 - am) + self.z * am); self.b[self.i] = cero(x + self.z * fb); self.i += 1; if self.i == self.b.len() { self.i = 0; } y } }
struct Pasa { b: Vec<f32>, i: usize }
impl Pasa { fn nuevo(n: usize) -> Pasa { Pasa { b: vec![0.0; n.max(1)], i: 0 } }
    #[inline] fn paso(&mut self, x: f32) -> f32 { let b = self.b[self.i]; let y = b - x; self.b[self.i] = cero(x + b * 0.5); self.i += 1; if self.i == self.b.len() { self.i = 0; } y } }
pub struct Reverb { peines: [Vec<Peine>; 2], pasas: [Vec<Pasa>; 2], pre: Vec<f32>, pre_i: usize, eco: [Vec<f32>; 2], eco_i: usize, rate: u32,
    /// la sala de ahora (se acerca a la pedida de a poco: sin saltos) y la pedida
    pub ahora: Sala, pub meta: Sala, lp: [f32; 2] }
impl Reverb {
    pub fn nueva(rate: u32) -> Reverb {
        let k = rate as f32 / 44100.0; let l = |n: usize| ((n as f32) * k) as usize;
        let pe = |sp: usize| [1116usize, 1188, 1277, 1356].iter().map(|&n| Peine::nuevo(l(n + sp))).collect();
        let pa = |sp: usize| [556usize, 441].iter().map(|&n| Pasa::nuevo(l(n + sp))).collect();
        Reverb { peines: [pe(0), pe(23)], pasas: [pa(0), pa(23)], pre: vec![0.0; (rate as usize / 10).max(8)], pre_i: 0, eco: [vec![0.0; (rate as f32 * 1.3) as usize], vec![0.0; (rate as f32 * 1.3) as usize]], eco_i: 0, rate,
            ahora: Sala::default(), meta: Sala::default(), lp: [0.0; 2] }
    }
    /// un bloque: entra lo enviado (mono) y salen la cola y el eco (estéreo), sumados a `wet`
    pub fn bloque(&mut self, envio: &[f32], wet: &mut [f32]) {
        let n = envio.len(); if n == 0 { return; }
        // (la sala se acerca a la pedida: ~0,3 s para cambiar)
        let f = (n as f32 / self.rate as f32 / 0.3).min(1.0); let (a, m) = (&mut self.ahora, &self.meta);
        let mez = |x: &mut f32, y: f32| *x += (y - *x) * f; mez(&mut a.cola, m.cola); mez(&mut a.amort, m.amort); mez(&mut a.mezcla, m.mezcla); mez(&mut a.pre_ms, m.pre_ms); mez(&mut a.eco, m.eco); mez(&mut a.corte_hz, m.corte_hz);
        if (a.eco_ms - m.eco_ms).abs() > 60.0 { a.eco_ms = m.eco_ms; } else { mez(&mut a.eco_ms, m.eco_ms); }
        let fb = 0.70 + a.cola.clamp(0.0, 1.0) * 0.28; let am = 0.05 + a.amort.clamp(0.0, 1.0) * 0.6; let wet_g = a.mezcla.clamp(0.0, 1.0) * 3.0;
        let pre_n = ((a.pre_ms.max(0.0) / 1000.0 * self.rate as f32) as usize).min(self.pre.len() - 1);
        let eco_n = ((a.eco_ms / 1000.0 * self.rate as f32) as usize).clamp(1, self.eco[0].len() - 1); let eco_g = a.eco.clamp(0.0, 0.6);
        let (lp, pl) = (self.pre.len(), self.eco[0].len());
        for k in 0..n {
            let x = envio[k] * 0.03;
            // (la demora antes de la cola)
            self.pre[self.pre_i] = x; let xp = self.pre[(self.pre_i + lp - pre_n) % lp]; self.pre_i = (self.pre_i + 1) % lp;
            let mut o = [0.0f32; 2];
            for c in 0..2 { let mut s = 0.0; for p in self.peines[c].iter_mut() { s += p.paso(xp, fb, am); } for p in self.pasas[c].iter_mut() { s = p.paso(s); } o[c] = s * wet_g; }
            // (el eco: lo enviado vuelve de la pared, de un lado y del otro, y otra vez más bajo)
            if eco_g > 0.001 { let j = (self.eco_i + pl - eco_n) % pl; let (e0, e1) = (self.eco[0][j], self.eco[1][j]);
                self.eco[0][self.eco_i] = cero(envio[k] * 0.5 + e1 * 0.35); self.eco[1][self.eco_i] = cero(envio[k] * 0.5 + e0 * 0.35); o[0] += e0 * eco_g; o[1] += e1 * eco_g; }
            else { self.eco[0][self.eco_i] = 0.0; self.eco[1][self.eco_i] = 0.0; }
            self.eco_i = (self.eco_i + 1) % pl;
            wet[k * 2] += o[0]; wet[k * 2 + 1] += o[1];
        }
    }
}
/// lo que ya no se oye, a cero (los números diminutos —«subnormales»— hacen lentísima la cuenta cuando un sonido se apaga)
#[inline] fn cero(x: f32) -> f32 { if x.abs() < 1e-15 { 0.0 } else { x } }
/// el coeficiente de un filtro de un polo para el corte `hz`
#[inline] pub fn coef(hz: f32, rate: u32) -> f32 { 1.0 - (-2.0 * std::f32::consts::PI * hz.min(rate as f32 * 0.45) / rate as f32).exp() }

pub struct Mezcla { voces: Vec<Voz>, pub rate: u32, /** grabando: lo que sale (estéreo intercalado), hasta que el juego lo lleve */ pub grab: Option<Vec<f32>>,
    /// la reverberación del lugar y lo del mundo de este bloque (lo seco estéreo y lo enviado a la cola), con el filtro de
    /// bajo el agua
    pub rev: Option<Reverb>, mundo: Vec<f32>, envio: Vec<f32>, lp: [f32; 2] }
impl Mezcla {
    pub fn nueva(rate: u32) -> Mezcla { Mezcla { voces: vec![], rate, grab: None, rev: None, mundo: vec![], envio: vec![], lp: [0.0; 2] } }
    /// mezcla `n` cuadros estéreo en float (la salida los pide)
    pub fn llenar(&mut self, out: &mut [f32], n: usize) {
        let n = n.min(out.len() / 2);
        for x in out.iter_mut().take(n * 2) { *x = 0.0; }
        if self.rev.as_ref().map_or(true, |r| r.rate != self.rate) { self.rev = Some(Reverb::nueva(self.rate)); }
        self.mundo.clear(); self.mundo.resize(n * 2, 0.0); self.envio.clear(); self.envio.resize(n, 0.0);
        let (mundo, envio) = (&mut self.mundo, &mut self.envio);
        self.voces.retain_mut(|v| {
            let p = &v.pcm; let ch = p.ch as usize; let largo = p.datos.len() / ch.max(1);
            let m = |j: usize| -> f32 { if ch == 2 { (p.datos[j * 2] as f32 + p.datos[j * 2 + 1] as f32) * 0.5 } else { p.datos[j] as f32 } };
            // (una muestra en una posición —con la de al lado—; antes del principio, silencio)
            let leer = |x: f64| -> f32 { if x < 0.0 { return 0.0; } let i = x as usize; if i + 1 >= largo { return 0.0; } let f = (x - i as f64) as f32; (m(i) * (1.0 - f) + m(i + 1) * f) / 32768.0 };
            let nf = n.max(1) as f32;
            for k in 0..n {
                let mut i = v.pos as usize;
                if i + 1 >= largo { if v.lazo == 0 { return false; } v.pos = if v.ini + 1.0 < largo as f64 { v.ini } else { 0.0 }; i = v.pos as usize; }
                let f = (v.pos - i as f64) as f32;
                match v.esp.as_mut() {
                    None => {
                        let s = (m(i) * (1.0 - f) + m(i + 1) * f) / 32768.0;
                        if v.mundo { mundo[k * 2] += s * v.vi; mundo[k * 2 + 1] += s * v.vd; envio[k] += s * (v.vi + v.vd) * 0.5 * v.envio; }
                        else { out[k * 2] += s * v.vi; out[k * 2 + 1] += s * v.vd; }
                    }
                    Some(e) => {
                        let t = k as f32 / nf;
                        let (sl, sr) = (leer(v.pos - e.itd[0] as f64), leer(v.pos - e.itd[1] as f64));
                        e.z[0] = cero(e.z[0] + e.a[0] * (sl - e.z[0])); e.z[1] = cero(e.z[1] + e.a[1] * (sr - e.z[1]));
                        let gl = e.g[0] + (e.g_t[0] - e.g[0]) * t; let gr = e.g[1] + (e.g_t[1] - e.g[1]) * t;
                        mundo[k * 2] += e.z[0] * gl; mundo[k * 2 + 1] += e.z[1] * gr;
                        envio[k] += (e.z[0] + e.z[1]) * 0.5 * (e.envio + (e.envio_t - e.envio) * t);
                    }
                }
                v.pos += v.paso;
            }
            if let Some(e) = v.esp.as_mut() { e.g = e.g_t; e.envio = e.envio_t; }
            true
        });
        // (lo del mundo: bajo el agua se apaga —el corte de la sala—; después, la cola y el eco del lugar)
        let rev = self.rev.as_mut().unwrap();
        let corte = rev.ahora.corte_hz; let a = coef(corte, self.rate);
        for k in 0..n {
            let (mut l, mut r) = (self.mundo[k * 2], self.mundo[k * 2 + 1]);
            if corte < 18000.0 { self.lp[0] = cero(self.lp[0] + a * (l - self.lp[0])); self.lp[1] = cero(self.lp[1] + a * (r - self.lp[1])); l = self.lp[0]; r = self.lp[1]; } else { self.lp = [l, r]; }
            out[k * 2] += l; out[k * 2 + 1] += r;
        }
        let mut wet = vec![0.0f32; n * 2]; rev.bloque(&self.envio, &mut wet);
        if corte < 18000.0 { for k in 0..n { for c in 0..2 { rev.lp[c] = cero(rev.lp[c] + a * (wet[k * 2 + c] - rev.lp[c])); out[k * 2 + c] += rev.lp[c]; } } }
        else { for k in 0..n * 2 { out[k] += wet[k]; } }
        for x in out.iter_mut().take(n * 2) { *x = x.clamp(-1.0, 1.0); }
        if let Some(g) = self.grab.as_mut() { if g.len() < 48000 * 2 * 4 { g.extend_from_slice(&out[..(n * 2).min(out.len())]); } }
    }
}

/// lo espacial de un sonido en `donde` para el oyente (lugar, rumbo): la ganancia de cada oído, el corte de cada uno, la
/// demora de cada uno (s) y cuánto va a la reverberación. La cabeza: el paneo de igual potencia, el oído del otro lado más
/// apagado (la sombra de la cabeza, hasta 2,5 kHz) y 0,66 ms después; de atrás, algo más apagado (la oreja). La distancia:
/// más bajo y menos agudos (el aire). Una pared en el medio (`oclu`): mucho menos agudos, más bajo y más reverberación
pub fn espacio(oyente: ([f32; 3], f32), donde: [f32; 3], vol: f32, oclu: f32, sala_mezcla: f32) -> ([f32; 2], [f32; 2], [f32; 2], f32) {
    let (o, yaw) = oyente; let v = [donde[0] - o[0], donde[1] - o[1], donde[2] - o[2]]; let dist = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if dist > 60.0 { return ([0.0; 2], [20000.0; 2], [0.0; 2], 0.0); }
    let aten = (3.0 / dist.max(3.0)).powf(1.1);
    let der = [-yaw.cos(), 0.0, yaw.sin()]; let ade = [yaw.sin(), 0.0, yaw.cos()];
    let (pan, frente) = if dist > 0.05 { (((v[0] * der[0] + v[2] * der[2]) / dist).clamp(-1.0, 1.0), ((v[0] * ade[0] + v[2] * ade[2]) / dist).clamp(-1.0, 1.0)) } else { (0.0, 1.0) };
    let p = pan * 0.85; let ocl = oclu.clamp(0.0, 1.0);
    let g0 = vol * aten * (1.0 - 0.55 * ocl);
    let g = [g0 * ((1.0 - p) * 0.5).sqrt() * std::f32::consts::SQRT_2, g0 * ((1.0 + p) * 0.5).sqrt() * std::f32::consts::SQRT_2];
    let base = 20000.0 / (1.0 + dist / 45.0) * if frente < 0.0 { 1.0 - 0.35 * -frente } else { 1.0 } * (1.0 - 0.93 * ocl);
    let sombra = |lejos: bool| if lejos { base * (1.0 - 0.85 * pan.abs()) } else { base };
    let corte = [sombra(pan > 0.0), sombra(pan < 0.0)];
    let d = pan.abs() * 0.00066; let itd = [if pan > 0.0 { d } else { 0.0 }, if pan < 0.0 { d } else { 0.0 }];
    let envio = vol * aten.sqrt() * (1.0 + 0.8 * ocl) * (0.6 + sala_mezcla);
    (g, corte, itd, envio)
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
    /// el ambiente de ahora (su número en acustica::AMBIENTES; usize::MAX: el auto) y si el sonido espacial está prendido
    pub sala: usize, pub espacial: bool,
}

impl Sonido {
    /// sin salida (la compu)
    pub fn mudo() -> Sonido {
        Sonido { mezcla: Arc::new(Mutex::new(Mezcla::nueva(48000))), sala: 0, espacial: true, cache: HashMap::new(), #[cfg(target_os = "android")] fuente: None, idx: HashMap::new(),
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
        let id = self.prox; self.prox += 1;
        let v = self.voz_nueva(p, vol * self.volumen, tono, 0, 0.0, donde, !es_interfaz(nombre), id);
        if let Some(v) = v { if let Ok(mut m) = self.mezcla.lock() { if m.voces.len() < 48 { m.voces.push(v); } } }
    }
    /// una voz: sin lugar (la interfaz y la música sin reverberación; lo del mundo, como los disparos propios, con un poco)
    /// o con lugar (lo espacial: espacio() para el oyente de ahora)
    fn voz_nueva(&self, p: Arc<Pcm>, g: f32, tono: f32, lazo: u64, ini: f64, donde: Option<[f32; 3]>, mundo: bool, id: u64) -> Option<Voz> {
        let rate = self.mezcla.lock().map(|m| m.rate).unwrap_or(48000);
        let paso = p.rate as f64 / rate as f64 * tono as f64;
        let esp = match donde {
            Some(d) if self.espacial => {
                let mez = self.mezcla.lock().ok().and_then(|m| m.rev.as_ref().map(|r| r.meta.mezcla)).unwrap_or(0.1);
                let (gg, c, itd, env) = espacio(self.oyente, d, g, 0.0, mez);
                if gg[0] + gg[1] < 1e-4 && lazo == 0 { return None; }
                Some(Esp { donde: d, g: gg, g_t: gg, a: [coef(c[0], rate), coef(c[1], rate)], z: [0.0; 2], itd: [itd[0] * rate as f32, itd[1] * rate as f32], envio: env, envio_t: env, oclu: 0.0, revisada: false })
            }
            Some(d) => { let (gg, _, _, _) = espacio(self.oyente, d, g, 0.0, 0.0); if gg[0] + gg[1] < 1e-4 && lazo == 0 { return None; }
                return Some(Voz { pcm: p, pos: 0.0, paso, vi: gg[0], vd: gg[1], lazo, ini, id, mundo: false, envio: 0.0, esp: None }); }
            None => None,
        };
        Some(Voz { pcm: p, pos: 0.0, paso, vi: g, vd: g, lazo, ini, id, mundo: mundo && self.espacial, envio: 0.35, esp })
    }
    /// cada cuadro: lo espacial de las voces con lugar para el oyente de ahora (se movió o giró) y lo tapado
    pub fn actualizar(&mut self) {
        if !self.suena() || !self.espacial { return; }
        let o = self.oyente; let Ok(mut m) = self.mezcla.lock() else { return }; let rate = m.rate;
        let mez = m.rev.as_ref().map(|r| r.meta.mezcla).unwrap_or(0.1);
        for v in m.voces.iter_mut() { if let Some(e) = v.esp.as_mut() {
            let gv = (v.vi + v.vd) * 0.5; let (g, c, itd, env) = espacio(o, e.donde, gv, e.oclu, mez);
            e.g_t = g; e.envio_t = env; e.a = [coef(c[0], rate), coef(c[1], rate)]; e.itd = [itd[0] * rate as f32, itd[1] * rate as f32];
        } }
    }
    /// las voces con lugar que todavía no se miró si una pared las tapa (las nuevas; los bucles cada tanto): número y lugar
    pub fn para_ocluir(&mut self, max: usize) -> Vec<(u64, [f32; 3])> {
        let Ok(mut m) = self.mezcla.lock() else { return vec![] }; let mut l = vec![];
        for v in m.voces.iter_mut() { if l.len() >= max { break; } if let Some(e) = v.esp.as_mut() { if !e.revisada { e.revisada = true; l.push((v.id, e.donde)); } } }
        l
    }
    /// cuánto tapa una pared a esa voz (0 nada, 1 del todo); se acerca de a poco
    pub fn ocluir(&mut self, id: u64, f: f32) { if let Ok(mut m) = self.mezcla.lock() { if let Some(e) = m.voces.iter_mut().find(|v| v.id == id).and_then(|v| v.esp.as_mut()) { e.oclu = if e.oclu == 0.0 && f > 0.0 { f } else { e.oclu + (f - e.oclu) * 0.5 }; } } }
    /// que los bucles con lugar se vuelvan a revisar (cada medio segundo)
    pub fn reocluir(&mut self) { if let Ok(mut m) = self.mezcla.lock() { for v in m.voces.iter_mut() { if v.lazo != 0 { if let Some(e) = v.esp.as_mut() { e.revisada = false; } } } } }
    /// la sala del lugar (acustica.rs)
    pub fn poner_sala(&mut self, n: usize, s: Sala) { self.sala = n; if let Ok(mut m) = self.mezcla.lock() { if m.rev.is_none() { let r = m.rate; m.rev = Some(Reverb::nueva(r)); } if let Some(r) = m.rev.as_mut() { r.meta = s; } } }
    /// un sonido hecho acá (la bocina): `hacer` da las muestras mono en [-1, 1] a `hz`; se arma una sola vez
    /// si ese sonido ya está (decodificado o anotado como que no se puede)
    pub fn tiene(&self, nombre: &str) -> bool { self.cache.contains_key(nombre) }
    /// un sonido comprimido en un archivo (los MP3 y OGG de los addons de GMod) con el decodificador del sistema
    /// (MediaCodec); en la compu no hay: queda mudo
    pub fn registrar_archivo(&mut self, nombre: &str, ruta: &std::path::Path) -> bool {
        if let Some(p) = self.cache.get(nombre) { return p.is_some(); }
        #[cfg(target_os = "android")] {
            use std::os::fd::AsRawFd;
            let p = std::fs::File::open(ruta).ok().and_then(|f| { let n = f.metadata().map(|m| m.len()).unwrap_or(0) as i64; unsafe { android::decodificar(f.as_raw_fd(), 0, n) } });
            let ok = p.is_some(); self.cache.insert(nombre.to_string(), p.map(Arc::new)); return ok;
        }
        #[allow(unreachable_code)] { let _ = ruta; self.cache.insert(nombre.to_string(), None); false }
    }
    pub fn sintetico(&mut self, nombre: &str, hacer: impl FnOnce() -> Vec<f32>, hz: u32) {
        if self.cache.contains_key(nombre) { return; }
        let datos = hacer().iter().map(|x| (x.clamp(-1.0, 1.0) * 32767.0).round() as i16).collect();
        self.cache.insert(nombre.to_string(), Some(Arc::new(Pcm { rate: hz, ch: 1, datos })));
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
        if let Ok(mut m) = self.mezcla.lock() { m.voces.push(Voz { pcm: p, pos: 0.0, paso, vi: g, vd: g, lazo: id, ini: 0.0, id, mundo: self.espacial, envio: 0.25, esp: None }); }
        self.bucles.insert(clave.to_string(), (id, true));
    }
    /// un bucle con tono, en un lugar (más bajo lejos y del lado donde está) y que vuelve desde `desde` segundos (los .wav
    /// de Source con un punto "cue": suenan enteros y después repiten desde ahí). Se pide cada cuadro como `bucle`
    pub fn bucle_ex(&mut self, clave: &str, nombre: &str, vol: f32, tono: f32, desde: f32, donde: Option<[f32; 3]>) {
        if !self.suena() { return; }
        let g = vol * self.volumen;
        let rate = self.mezcla.lock().map(|m| m.rate).unwrap_or(48000);
        if let Some(b) = self.bucles.get_mut(clave) {
            b.1 = true; let id = b.0; let (o, esp) = (self.oyente, self.espacial);
            if let Ok(mut m) = self.mezcla.lock() { if let Some(v) = m.voces.iter_mut().find(|v| v.lazo == id) {
                v.paso = v.pcm.rate as f64 / rate as f64 * tono as f64;
                match (donde, v.esp.as_mut()) {
                    (Some(d), Some(e)) => { e.donde = d; v.vi = g; v.vd = g; }
                    (Some(d), None) if !esp => { let (gg, _, _, _) = espacio(o, d, g, 0.0, 0.0); v.vi = gg[0]; v.vd = gg[1]; }
                    _ => { v.vi = g; v.vd = g; }
                }
            } }
            return;
        }
        let Some(p) = self.pcm(nombre) else { return };
        let id = self.prox; self.prox += 1; let ini = (desde.max(0.0) as f64) * p.rate as f64;
        let Some(mut v) = self.voz_nueva(p, g, tono, id, ini, donde, true, id) else { return };
        if v.esp.is_some() { v.vi = g; v.vd = g; }
        if let Ok(mut m) = self.mezcla.lock() { m.voces.push(v); }
        self.bucles.insert(clave.to_string(), (id, true));
    }
    /// una voz larga que maneja el que la pone (la música del menú, musica_juego.rs): desde `desde_s` segundos, al volumen
    /// `vol` (sin el general); devuelve su número para cambiarle el volumen, saber por dónde va o sacarla
    pub fn voz_larga(&mut self, pcm: Arc<Pcm>, desde_s: f32, vol: f32) -> u64 {
        let id = self.prox; self.prox += 1;
        if let Ok(mut m) = self.mezcla.lock() { let paso = pcm.rate as f64 / m.rate as f64; let pos = (desde_s.max(0.0) as f64 * pcm.rate as f64).min((pcm.datos.len() / pcm.ch.max(1) as usize) as f64 - 2.0).max(0.0);
            m.voces.push(Voz { pcm, pos, paso, vi: vol, vd: vol, lazo: id, ini: 0.0, id, mundo: false, envio: 0.0, esp: None }); }
        id
    }
    pub fn voz_vol(&self, id: u64, vol: f32) { if let Ok(mut m) = self.mezcla.lock() { if let Some(v) = m.voces.iter_mut().find(|v| v.lazo == id) { v.vi = vol; v.vd = vol; } } }
    /// por dónde va (segundos) o None si ya no está
    pub fn voz_pos(&self, id: u64) -> Option<f32> { self.mezcla.lock().ok()?.voces.iter().find(|v| v.lazo == id).map(|v| (v.pos / v.pcm.rate as f64) as f32) }
    pub fn voz_quitar(&self, id: u64) { if let Ok(mut m) = self.mezcla.lock() { m.voces.retain(|v| v.lazo != id); } }
    /// un pedazo de un archivo comprimido (Opus, MP3…) a PCM con el decodificador del sistema; mono y a la mitad de las
    /// muestras si es largo (la música: menos memoria). En la compu no hay
    pub fn decodificar_trozo(ruta: &std::path::Path, off: u64, len: u64) -> Option<Pcm> {
        #[cfg(target_os = "android")] {
            use std::os::fd::AsRawFd;
            let f = std::fs::File::open(ruta).ok()?; let p = unsafe { android::decodificar(f.as_raw_fd(), off as i64, len as i64) }?;
            return Some(achicar(p));
        }
        #[allow(unreachable_code)] { let _ = (ruta, off, len); None }
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

/// los sonidos de la interfaz (sin lugar ni reverberación)
fn es_interfaz(n: &str) -> bool { matches!(n, "Click" | "UI_blip") || n.starts_with("UI_") }

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::acustica::AMBIENTES;
    /// un golpe corto de ruido (10 ms) a 48 kHz
    fn golpe() -> Arc<Pcm> { let mut x = 12345u32; Arc::new(Pcm { rate: 48000, ch: 1, datos: (0..48000).map(|i| if i < 480 { x ^= x << 13; x ^= x >> 17; x ^= x << 5; (x % 20000) as i16 - 10000 } else { 0 }).collect() }) }
    /// la mezcla de un golpe en `donde` (o sin lugar, del mundo) con la sala `sala`: n cuadros estéreo
    fn mezclar(sala: Sala, donde: Option<[f32; 3]>, n: usize) -> Vec<f32> {
        let mut m = Mezcla::nueva(48000); m.rev = Some(Reverb::nueva(48000)); let r = m.rev.as_mut().unwrap(); r.meta = sala; r.ahora = sala;
        let esp = donde.map(|d| { let (g, c, itd, env) = espacio(([0.0; 3], 0.0), d, 1.0, 0.0, sala.mezcla); Esp { donde: d, g, g_t: g, a: [coef(c[0], 48000), coef(c[1], 48000)], z: [0.0; 2], itd: [itd[0] * 48000.0, itd[1] * 48000.0], envio: env, envio_t: env, oclu: 0.0, revisada: true } });
        m.voces.push(Voz { pcm: golpe(), pos: 0.0, paso: 1.0, vi: 1.0, vd: 1.0, lazo: 0, ini: 0.0, id: 1, mundo: true, envio: 0.35, esp });
        let mut out = vec![0.0f32; n * 2]; for b in out.chunks_mut(512) { let k = b.len() / 2; m.llenar(b, k); } out
    }
    fn energia(o: &[f32], desde: usize, hasta: usize) -> f32 { o[desde * 2..hasta * 2].iter().map(|x| x * x).sum::<f32>() }
    #[test]
    fn la_sala_se_oye() {
        let sala = |n: &str| AMBIENTES.iter().find(|a| a.0 == n).unwrap().1;
        // (la cola después del golpe —de 0,1 a 1 s—: en una iglesia mucho más que en el campo)
        let campo = energia(&mezclar(sala("Campo abierto"), Some([0.0, 0.0, 4.0]), 48000), 4800, 48000);
        let iglesia = energia(&mezclar(sala("Iglesia"), Some([0.0, 0.0, 4.0]), 48000), 4800, 48000);
        let bano = energia(&mezclar(sala("Baño"), Some([0.0, 0.0, 4.0]), 48000), 4800, 48000);
        assert!(iglesia > campo * 20.0 && bano > campo * 3.0, "campo {campo} iglesia {iglesia} baño {bano}");
        // (el eco del cañón: vuelve a los ~200 ms)
        let mut c = sala("Cañón (eco)"); c.eco_ms = 200.0; let o = mezclar(c, Some([0.0, 0.0, 4.0]), 24000);
        assert!(energia(&o, 9400, 10400) > energia(&o, 6000, 7000) * 4.0, "eco {} vs antes {}", energia(&o, 9400, 10400), energia(&o, 6000, 7000));
        // (nada se pasa de 1 ni es NaN)
        assert!(o.iter().all(|x| x.is_finite() && x.abs() <= 1.0));
    }
    #[test]
    fn la_cabeza() {
        // (a la derecha —-X girado—: más fuerte en el oído derecho y el izquierdo llega ~0,66 ms después)
        let o = mezclar(Sala { mezcla: 0.0, ..Sala::default() }, Some([-3.0, 0.0, 0.0]), 4800);
        let (l, r) = (energia(&o.iter().step_by(2).flat_map(|x| [*x, 0.0]).collect::<Vec<_>>(), 0, 2400), energia(&o.iter().skip(1).step_by(2).flat_map(|x| [*x, 0.0]).collect::<Vec<_>>(), 0, 2400));
        assert!(r > l * 3.0, "der {r} izq {l}");
        let primero = |c: usize| (0..2400).find(|&k| o[k * 2 + c].abs() > 1e-4).unwrap_or(9999);
        let (pl, pr) = (primero(0), primero(1)); assert!(pr < pl && (pl - pr) >= 25 && (pl - pr) <= 40, "izq empieza {pl}, der {pr}");
    }
    #[test]
    fn bajo_el_agua_se_apaga() {
        // (los agudos: la energía de la diferencia entre muestras seguidas, bajo el agua mucho menor)
        let agudos = |o: &[f32]| o.chunks(2).collect::<Vec<_>>().windows(2).map(|w| (w[1][0] - w[0][0]).powi(2)).sum::<f32>();
        let aire = mezclar(Sala::default(), None, 4800); let agua = mezclar(AMBIENTES.iter().find(|a| a.0 == "Bajo el agua").unwrap().1, None, 4800);
        assert!(agudos(&agua) < agudos(&aire) * 0.1, "agua {} aire {}", agudos(&agua), agudos(&aire));
    }
    #[test]
    fn cuesta_poco() {
        // (48 voces con lugar y la sala más larga: un segundo de sonido tiene que mezclarse en mucho menos de un segundo)
        let mut m = Mezcla::nueva(48000); let mut r = Reverb::nueva(48000); r.meta = AMBIENTES[22].1; m.rev = Some(r); let p = golpe();
        for i in 0..48 { let d = [i as f32 - 24.0, 0.0, 5.0]; let (g, c, itd, env) = espacio(([0.0; 3], 0.0), d, 0.5, 0.3, 0.4);
            m.voces.push(Voz { pcm: p.clone(), pos: 0.0, paso: 1.0, vi: 0.5, vd: 0.5, lazo: i + 1, ini: 0.0, id: i + 1, mundo: true, envio: 0.35, esp: Some(Esp { donde: d, g, g_t: g, a: [coef(c[0], 48000), coef(c[1], 48000)], z: [0.0; 2], itd: [itd[0] * 48000.0, itd[1] * 48000.0], envio: env, envio_t: env, oclu: 0.3, revisada: true }) }); }
        let t = std::time::Instant::now(); let mut out = vec![0.0f32; 1024]; for _ in 0..(48000 / 512) { m.llenar(&mut out, 512); }
        let ms = t.elapsed().as_secs_f32() * 1000.0; println!("48 voces espaciales + sala: {ms:.1} ms por segundo de sonido");
        let mut m2 = Mezcla::nueva(48000); let mut r2 = Reverb::nueva(48000); r2.meta = AMBIENTES[22].1; m2.rev = Some(r2); let t2 = std::time::Instant::now(); for _ in 0..(48000 / 512) { m2.llenar(&mut out, 512); }
        println!("  sólo la sala: {:.1} ms", t2.elapsed().as_secs_f32() * 1000.0); assert!(ms < 250.0, "{ms} ms");
    }
}
