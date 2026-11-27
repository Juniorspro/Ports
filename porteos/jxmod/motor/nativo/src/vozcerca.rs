//! La voz por cercanía (voz.js de la web, a la manera de la nativa). La web manda el micrófono con WebRTC a los que están
//! cerca; acá no hay WebRTC, así que va por la misma red del juego: el micrófono (Voz.java, 16 kHz) se corta en cuadros de
//! 20 ms, un detector deja pasar sólo cuando hablás (con 0,5 s de cola, así no se cortan las sílabas), se comprime con
//! IMA ADPCM (4 bits por muestra: 64 kbps mientras hablás, nada en silencio) y sale de a 100 ms por ROOM/v/ID. Sólo se
//! manda si hay alguien a menos de 70 m que la escucha (los que mandan «vz» en su estado: la web todavía no). Del otro
//! lado suena desde la cabeza del que habla en el mezclador espacial (sonido.rs: el lado, la distancia, las paredes, el
//! eco del lugar) con un colchón de 140 ms para la red. Arriba se ve quién habla, como en la web.
use std::collections::HashMap;

pub const HZ: u32 = 16000;
/// 20 ms
pub const CUADRO: usize = 320;
/// cuadros por paquete (100 ms)
const POR_PAQUETE: usize = 5;
/// hasta dónde se manda (VOZ_CERCA de la web, en metros)
pub const CERCA: f32 = 70.0;
/// el volumen de las voces (el 1,6 de la web)
pub const VOL: f32 = 1.6;

// —— IMA ADPCM ——
const PASOS: [i32; 89] = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
    130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552,
    1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635,
    13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
const INDICES: [i32; 16] = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

/// un paso del decodificador (también lo usa el codificador, para quedar igual)
#[inline] fn paso_dec(pred: &mut i32, idx: &mut i32, n: u8) {
    let p = PASOS[*idx as usize]; let mut dq = p >> 3;
    if n & 4 != 0 { dq += p; } if n & 2 != 0 { dq += p >> 1; } if n & 1 != 0 { dq += p >> 2; }
    *pred = if n & 8 != 0 { *pred - dq } else { *pred + dq }.clamp(-32768, 32767);
    *idx = (*idx + INDICES[n as usize]).clamp(0, 88);
}
#[inline] fn nibble(pred: &mut i32, idx: &mut i32, x: i32) -> u8 {
    let p = PASOS[*idx as usize]; let mut d = x - *pred; let mut n = 0u8;
    if d < 0 { n = 8; d = -d; }
    if d >= p { n |= 4; d -= p; } if d >= p >> 1 { n |= 2; d -= p >> 1; } if d >= p >> 2 { n |= 1; }
    paso_dec(pred, idx, n); n
}
/// un cuadro: el estado al empezar (así cada uno se decodifica solo, aunque falte el anterior) y dos muestras por byte
pub fn codificar(pcm: &[i16], est: &mut (i32, i32), out: &mut Vec<u8>) {
    out.extend_from_slice(&(est.0 as i16).to_le_bytes()); out.push(est.1 as u8);
    for par in pcm.chunks(2) {
        let a = nibble(&mut est.0, &mut est.1, par[0] as i32);
        let b = if par.len() > 1 { nibble(&mut est.0, &mut est.1, par[1] as i32) } else { 0 };
        out.push(a | (b << 4));
    }
}
/// un paquete: «J», versión, número, cuántos cuadros y los cuadros (3 + 160 bytes cada uno)
pub fn abrir(p: &[u8]) -> Option<(u8, Vec<f32>)> {
    if p.len() < 4 || p[0] != b'J' || p[1] != 1 { return None; }
    let n = p[3] as usize; let largo = 3 + CUADRO / 2;
    if n == 0 || n > 25 || p.len() != 4 + n * largo { return None; }
    let mut o = Vec::with_capacity(n * CUADRO);
    for c in p[4..].chunks(largo) {
        let mut pred = i16::from_le_bytes([c[0], c[1]]) as i32; let mut idx = (c[2] as i32).clamp(0, 88);
        for b in &c[3..] { for n in [b & 15, b >> 4] { paso_dec(&mut pred, &mut idx, n); o.push(pred as f32 / 32768.0); } }
    }
    Some((p[2], o))
}

/// el detector de voz: el nivel de cada cuadro contra el piso de ruido (que baja rápido y sube despacio); habla si pasa
/// 3 veces el piso (y un mínimo), y sigue 0,5 s después de la última vez
pub struct Habla { piso: f32, cola: f32, pub nivel: f32 }
impl Default for Habla { fn default() -> Self { Habla { piso: 0.003, cola: 0.0, nivel: 0.0 } } }
impl Habla {
    pub fn cuadro(&mut self, c: &[i16]) -> bool {
        let n = c.len().max(1) as f32; let m = c.iter().map(|&x| x as f32).sum::<f32>() / n;
        let rms = (c.iter().map(|&x| { let d = x as f32 - m; d * d }).sum::<f32>() / n).sqrt() / 32768.0;
        self.nivel = rms;
        if rms < self.piso { self.piso += (rms - self.piso) * 0.2; } else { self.piso += (rms - self.piso) * 0.004; }
        self.piso = self.piso.clamp(0.0003, 0.05);
        if rms > (self.piso * 3.0).max(0.006) { self.cola = 0.5; } else { self.cola -= c.len() as f32 / HZ as f32; }
        self.cola > 0.0
    }
}

/// el micrófono del celular (Voz.java)
pub trait Micro {
    /// 1: prendido; 0: esperando el permiso; -1: no se pudo
    fn prender(&self) -> i32;
    fn apagar(&self);
    fn leer(&self) -> Vec<i16>;
}

/// uno que habla: su número en el mezclador, hace cuánto llegó lo último, si una pared lo tapa (y cuándo se mira de nuevo)
/// y hasta cuándo se muestra que habla
pub struct Oyendo { pub mez: u64, pub ult: f32, pub oclu: f32, pub t_oclu: f32, pub habla: f32 }

#[derive(Default)]
pub struct VozCerca {
    pub micro: Option<Box<dyn Micro>>,
    /// el micrófono prendido (el botón) y, mientras se espera el permiso, cuánto falta para dejar de esperar
    pub on: bool, pub esperando: f32,
    pend: Vec<i16>, est: (i32, i32), pub habla: Habla, paquete: Vec<u8>, nfr: u8, seq: u8, antes: Option<Vec<i16>>,
    /// hasta cuándo me muestro hablando
    pub yo_habla: f32,
    pub oyendo: HashMap<String, Oyendo>,
    /// lo mandado (bytes), para medir
    pub mandado: usize,
}

impl VozCerca {
    /// lo que dio el micrófono: lo corta en cuadros, mira si hablás y arma los paquetes para mandar (si `mandar` —hay
    /// alguien cerca que escucha—; si no, nada)
    pub fn micro_paso(&mut self, muestras: &[i16], mandar: bool) -> Vec<Vec<u8>> {
        let mut salida = vec![];
        self.pend.extend_from_slice(muestras);
        if self.pend.len() > HZ as usize { let sobra = self.pend.len() - HZ as usize; self.pend.drain(..sobra); }
        while self.pend.len() >= CUADRO {
            let c: Vec<i16> = self.pend.drain(..CUADRO).collect();
            let habla = self.habla.cuadro(&c);
            if habla { self.yo_habla = 0.45; }
            if habla && mandar {
                // (el cuadro de antes de empezar: el principio de la sílaba)
                if self.nfr == 0 && self.paquete.is_empty() { if let Some(a) = self.antes.take() { self.agregar(&a); } }
                self.agregar(&c);
                if self.nfr as usize >= POR_PAQUETE { salida.push(self.cerrar()); }
            } else {
                if self.nfr > 0 { salida.push(self.cerrar()); }
                self.est = (0, 0); self.antes = Some(c);
            }
        }
        self.mandado += salida.iter().map(|p| p.len()).sum::<usize>();
        salida
    }
    fn agregar(&mut self, c: &[i16]) {
        if self.paquete.is_empty() { self.paquete.extend_from_slice(&[b'J', 1, self.seq, 0]); }
        codificar(c, &mut self.est, &mut self.paquete); self.nfr += 1;
    }
    fn cerrar(&mut self) -> Vec<u8> {
        let mut p = std::mem::take(&mut self.paquete); p[3] = self.nfr; self.nfr = 0; self.seq = self.seq.wrapping_add(1); p
    }
    pub fn apagar(&mut self) {
        if let Some(m) = &self.micro { m.apagar(); }
        self.on = false; self.esperando = 0.0; self.pend.clear(); self.paquete.clear(); self.nfr = 0; self.antes = None; self.yo_habla = 0.0;
    }
}
/// el número en el mezclador de uno que habla (su ID)
pub fn numero(id: &str) -> u64 { let mut h: u64 = 0xcbf29ce484222325; for b in id.bytes() { h ^= b as u64; h = h.wrapping_mul(0x100000001b3); } h | 1 << 63 }

impl super::Juego {
    /// el botón del micrófono: prenderlo (pide el permiso la primera vez) o apagarlo
    pub(super) fn vz_boton(&mut self) {
        if self.vz.on || self.vz.esperando > 0.0 { self.vz.apagar(); self.avisar("Micrófono apagado".into()); return; }
        let Some(m) = &self.vz.micro else { self.avisar("Acá no hay micrófono".into()); return };
        match m.prender() {
            1 => { self.vz.on = true; self.avisar("Micrófono prendido: te escuchan los que están cerca".into()); }
            0 => { self.vz.esperando = 30.0; self.avisar("Dale permiso al micrófono".into()); }
            _ => self.avisar("No se pudo abrir el micrófono".into()),
        }
    }
    /// un pedazo de la voz de otro
    pub(super) fn vz_llego(&mut self, de: &str, datos: &[u8]) {
        if !self.aj.voces || self.vz.oyendo.len() >= 16 && !self.vz.oyendo.contains_key(de) { return; }
        let Some((_, m)) = abrir(datos) else { return };
        let mez = numero(de);
        self.sonido.charla(mez, &m, HZ);
        let o = self.vz.oyendo.entry(de.to_string()).or_insert(Oyendo { mez, ult: 0.0, oclu: 0.0, t_oclu: 0.0, habla: 0.0 });
        o.ult = 0.0;
    }
    /// cada cuadro: el micrófono (lo que grabó, a quién mandárselo), el lugar de cada voz que suena y quién habla
    pub(super) fn vz_paso(&mut self, dt: f32) {
        let en_sala = self.en_red.en_sala();
        // (esperando el permiso: se prueba de nuevo cada medio segundo)
        if self.vz.esperando > 0.0 {
            self.vz.esperando -= dt;
            if (self.vz.esperando * 2.0).fract() < (dt * 2.0).min(1.0) { if let Some(m) = &self.vz.micro { match m.prender() { 1 => { self.vz.on = true; self.vz.esperando = 0.0; self.avisar("Micrófono prendido".into()); } -1 => { self.vz.esperando = 0.0; } _ => {} } } }
            if self.vz.esperando <= 0.0 && !self.vz.on { self.vz.esperando = 0.0; }
        }
        if self.vz.on && !en_sala { self.vz.apagar(); }
        let yo = { let p = self.jug.pos; [p[0], p[1] + 0.7, p[2]] };
        if self.vz.on {
            let muestras = self.vz.micro.as_ref().map(|m| m.leer()).unwrap_or_default();
            let mandar = self.en_red.red.remotos().iter().any(|r| r.voz && { let d = [r.pos[0] as f32 - yo[0], r.pos[1] as f32 + 0.7 - yo[1], r.pos[2] as f32 - yo[2]]; (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt() < CERCA });
            for p in self.vz.micro_paso(&muestras, mandar) { self.en_red.red.publicar_voz(p); }
        }
        self.vz.yo_habla = (self.vz.yo_habla - dt).max(0.0);
        // (las voces: desde la boca de cada uno; una pared en el medio cada 0,3 s; si se fue o hace 4 s que no manda, afuera)
        let ojos = self.sonido.oyente.0;
        let mut fuera = vec![];
        for (id, o) in self.vz.oyendo.iter_mut() {
            o.ult += dt; o.habla = (o.habla - dt).max(0.0);
            let Some(r) = self.en_red.red.remoto(id) else { fuera.push(id.clone()); continue };
            if o.ult > 4.0 || !self.aj.voces { fuera.push(id.clone()); continue; }
            let boca = [r.pos[0] as f32, r.pos[1] as f32 + 0.7, r.pos[2] as f32];
            o.t_oclu -= dt;
            if o.t_oclu <= 0.0 { o.t_oclu = 0.3; if let Some(mp) = self.mapa.as_ref() {
                let v = [boca[0] - ojos[0], boca[1] - ojos[1], boca[2] - ojos[2]]; let d = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
                o.oclu = if d < 0.6 { 0.0 } else { match mp.mundo.rayo(ojos, [v[0] / d, v[1] / d, v[2] / d], d) { Some(g) if g.t < d - 0.5 => 1.0, _ => 0.0 } };
            } }
            let nivel = self.sonido.charla_lugar(o.mez, boca, o.oclu, VOL);
            if nivel > 0.004 || o.ult < 0.15 && nivel > 0.0005 { o.habla = 0.45; }
        }
        for id in fuera { if let Some(o) = self.vz.oyendo.remove(&id) { self.sonido.charla_fin(o.mez); } }
        if !en_sala && !self.vz.oyendo.is_empty() { for (_, o) in self.vz.oyendo.drain() { self.sonido.charla_fin(o.mez); } }
    }
    /// quién habla (como el panel de la web): arriba al medio, una ficha por cada uno con un punto verde que late; vos
    /// también, mientras tu micrófono manda
    pub(super) fn vz_hud(&self, l: &jxjuego::texto::Letras, u: &mut Vec<f32>, wf: f32, t: f32) {
        let mut quien: Vec<String> = self.vz.oyendo.iter().filter(|(_, o)| o.habla > 0.0).filter_map(|(id, _)| self.en_red.red.remoto(id).map(|r| jxjuego::censura::censurar(&r.nombre))).collect();
        quien.sort();
        if self.vz.yo_habla > 0.0 { quien.insert(0, format!("{} (vos)", jxjuego::censura::censurar(&self.en_red.red.nombre))); }
        if quien.is_empty() { return; }
        let tt = t * 0.62; let alto = tt * 1.7; let y = alto * 0.7;
        let anchos: Vec<f32> = quien.iter().take(5).map(|n| l.ancho(tt, n) + alto * 1.3).collect();
        let total: f32 = anchos.iter().sum::<f32>() + (anchos.len() as f32 - 1.0) * tt * 0.5; let mut x = (wf - total) / 2.0;
        let late = 0.75 + 0.25 * (self.t0.elapsed().as_secs_f32() * 6.0).sin();
        for (n, a) in quien.iter().take(5).zip(anchos) {
            l.caja(u, x, y, a, alto, alto * 0.5, [0.05, 0.08, 0.06, 0.72]);
            let r = alto * 0.26; l.caja(u, x + alto * 0.5 - r, y + alto * 0.5 - r, r * 2.0, r * 2.0, r, [0.25, 0.9, 0.4, late]);
            l.texto(u, x + alto * 0.95, y + (alto - tt) * 0.5, tt, [1.0; 4], n); x += a + tt * 0.5;
        }
        if quien.len() > 5 { let m = format!("+{}", quien.len() - 5); l.texto_sombra(u, x, y + (alto - tt) * 0.5, tt, [1.0; 4], &m); }
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    /// una voz de prueba: tonos que cambian, con su volumen subiendo y bajando (como sílabas)
    fn voz(seg: f32) -> Vec<i16> {
        (0..(seg * HZ as f32) as usize).map(|i| { let t = i as f32 / HZ as f32; let env = (t * 3.0 * std::f32::consts::PI).sin().abs();
            ((t * 2.0 * std::f32::consts::PI * (180.0 + 60.0 * (t * 2.0).sin())).sin() * 0.6 + (t * 2.0 * std::f32::consts::PI * 900.0).sin() * 0.2) * env * 12000.0 }).map(|x| x as i16).collect()
    }
    #[test]
    fn el_codec_se_parece() {
        let v = voz(0.4); let mut est = (0, 0); let mut out = vec![b'J', 1, 0, 0];
        let mut n = 0; for c in v.chunks(CUADRO) { if c.len() == CUADRO { codificar(c, &mut est, &mut out); n += 1; } } out[3] = n;
        assert_eq!(out.len(), 4 + n as usize * 163);
        let (_, d) = abrir(&out).unwrap(); assert_eq!(d.len(), n as usize * CUADRO);
        let (mut se, mut sr) = (0f64, 0f64);
        for (a, b) in v.iter().zip(&d) { let a = *a as f64 / 32768.0; se += a * a; sr += (a - *b as f64).powi(2); }
        let snr = 10.0 * (se / sr).log10(); eprintln!("ADPCM: {snr:.1} dB"); assert!(snr > 18.0, "{snr}");
        // (lo roto no pasa)
        assert!(abrir(&out[..out.len() - 1]).is_none()); assert!(abrir(b"hola").is_none());
        let mut mal = out.clone(); mal[3] = 200; assert!(abrir(&mal).is_none());
    }
    #[test]
    fn habla_y_silencio() {
        let mut vc = VozCerca::default();
        // (1 s de ruido bajito: no manda nada)
        let mut x = 99u32; let ruido: Vec<i16> = (0..HZ).map(|_| { x ^= x << 13; x ^= x >> 17; x ^= x << 5; (x % 200) as i16 - 100 }).collect();
        assert!(vc.micro_paso(&ruido, true).is_empty(), "el ruido no se manda");
        // (hablando: de a 100 ms, 5 cuadros cada uno, con el cuadro de antes)
        let p = vc.micro_paso(&voz(1.0), true); assert!(p.len() >= 8, "{}", p.len());
        for q in &p { assert!(abrir(q).is_some()); }
        // (después, silencio: corta a los 0,5 s)
        let s = vc.micro_paso(&vec![0i16; HZ as usize], true); let ms: usize = s.iter().map(|q| q[3] as usize).sum::<usize>() * 20; assert!(ms <= 600, "{ms}");
        assert!(vc.micro_paso(&vec![0i16; HZ as usize], true).is_empty());
        // (sin nadie cerca, nada)
        assert!(vc.micro_paso(&voz(1.0), false).is_empty());
        let kbps = vc.mandado as f32 * 8.0 / 1000.0 / 1.6; eprintln!("{} bytes ≈ {kbps:.0} kbps hablando", vc.mandado); assert!(kbps < 80.0);
    }
    #[test]
    fn suena_en_el_mezclador() {
        // (lo que llega de a 100 ms suena después del colchón, del lado del que habla, y se calla cuando deja de llegar)
        let mut s = crate::sonido::Sonido::mudo(); s.oyente = ([0.0, 1.6, 0.0], 0.0);
        let v = voz(0.6); let mut est = (0, 0); let mut paquetes = vec![];
        for b in v.chunks(CUADRO * 5) { let mut out = vec![b'J', 1, 0, 0]; let mut n = 0; for c in b.chunks(CUADRO) { if c.len() == CUADRO { codificar(c, &mut est, &mut out); n += 1; } } out[3] = n; paquetes.push(out); }
        let id = numero("abc"); let mut salida = vec![0f32; 4800 * 2]; let (mut l, mut r) = (0f32, 0f32);
        for (i, p) in paquetes.iter().enumerate() {
            let (_, m) = abrir(p).unwrap(); s.charla(id, &m, HZ); s.charla_lugar(id, [3.0, 1.6, 0.0], 0.0, VOL);
            let mut mz = s.mezcla.lock().unwrap(); mz.llenar(&mut salida, 4800);
            if i >= 2 { for k in 0..4800 { l += salida[k * 2].abs(); r += salida[k * 2 + 1].abs(); } }
        }
        eprintln!("izq {l:.1} der {r:.1}"); assert!(l > 1.0 || r > 1.0, "suena");
        // (a la derecha del oyente que mira a +z con rumbo 0: el oído que más suena es el de ese lado)
        let der = [-(0f32).cos(), 0.0, 0f32.sin()]; if der[0] > 0.0 { assert!(r > l * 1.5); } else { assert!(l > r * 1.5); }
        // (sin más paquetes se vacía y se calla)
        let mut mz = s.mezcla.lock().unwrap(); for _ in 0..8 { mz.llenar(&mut salida, 4800); } let resto: f32 = salida.iter().map(|x| x.abs()).sum(); assert!(resto < (l + r) * 0.002, "{resto}");
        assert!(mz.charlas_vacias(), "se vació");
    }
}
