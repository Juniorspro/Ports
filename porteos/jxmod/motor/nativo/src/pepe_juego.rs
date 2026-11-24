//! Pepe vuelve (pepe_vuelve.js): en cualquier mapa, al entrar hay un 26 % de que en algún momento —entre los 45 s y los
//! 3 min y pico— Pepe (el Engineer, oscuro y un poco deformado) aparezca atrás tuyo, a 14–18 m, con un chasquido de
//! estática. Te sigue (cada vez más rápido; si te alejás mucho, reaparece atrás tuyo) y te habla con su voz de Loquendo
//! (las de ev300_son.js, en datos/pepe; con subtítulo). Cerca, la imagen se vuelve cinta VHS, el grave sube y se oye el
//! corazón. Cuando te alcanza —o a los 32 s— dice «Ahora te toca a vos.» y el screamer: la cara pegada a la pantalla, el
//! grito, rojo y blanco, y negro. Después se va. Sólo lo ves vos. Con un menú abierto o muerto, el reloj no corre.
//! JXM_PEPE=segundos lo fuerza (el ?pepe de la web). La cinta (vhs.js es un sombreador de pantalla) va aproximada con
//! capas del HUD: líneas de barrido, la banda de tracking, la nieve, el ruido de abajo, el rojo, el blanco y el negro.
use super::*;
use std::collections::HashMap;

const PROB: f32 = 0.26; const DESDE: f32 = 45.0; const HASTA: f32 = 200.0;
const NEGRO: [f32; 3] = [0.11, 0.045, 0.045];
const ID_PV: i64 = ID_JG - 1_000_000;
/// las voces (EV3_VOZ: lo que dura cada una y el subtítulo)
const VOCES: [(&str, f32, &str); 8] = [("i1", 2.98, "¿Me escuchás? Soy yo. Pepe."), ("s3", 1.01, "Te estoy mirando."), ("e1", 1.3, "Pepe siempre vuelve."), ("i7", 1.34, "Ahora te toca a vos."),
    ("rSilencio", 1.44, "¿No me vas a contestar?"), ("p5", 1.44, "¿Me vas a pedir perdón?"), ("rTodas", 1.46, "A mí me dolieron todas."), ("f1", 0.53, "")];
fn voz_mp3(k: &str) -> &'static [u8] {
    match k { "i1" => include_bytes!("../datos/pepe/i1.mp3"), "s3" => include_bytes!("../datos/pepe/s3.mp3"), "e1" => include_bytes!("../datos/pepe/e1.mp3"), "i7" => include_bytes!("../datos/pepe/i7.mp3"),
        "rSilencio" => include_bytes!("../datos/pepe/rSilencio.mp3"), "p5" => include_bytes!("../datos/pepe/p5.mp3"), "rTodas" => include_bytes!("../datos/pepe/rTodas.mp3"), _ => include_bytes!("../datos/pepe/f1.mp3") }
}
/// la cinta (VHS de la web): prendida, lo gastada, el sacudón, el rojo, el blanco y el negro
#[derive(Default, Clone, Copy)]
pub struct Vhs { pub on: bool, pub dano: f32, pub sacudon: f32, pub rojo: f32, pub blanco: f32, pub negro: f32 }
/// Pepe en el mapa (PV.f): su cuerpo, sus materiales oscuros, dónde está, la fase (0 te sigue, 1 el screamer, 2 se va)
struct Fase { pj: Personaje, mats: HashMap<i64, i64>, pos: V, yaw: f32, vel: V, fase: u8, t: f32, lineas: Vec<&'static str>, li: usize, prox: f32, habla: f32, glitch: f32, lat: f32, dijo_fin: f32, fin_dur: f32, def_k: f32, esc_vis: f32, oculto: bool, s0: Option<(usize, V, usize, V)> }
#[derive(Default)]
pub struct Pv { pub nuevo_mapa: bool, cuando: Option<f32>, t: f32, f: Option<Fase>, sub: Option<(&'static str, f32)>, voces: bool, pub vhs: Vhs }
impl Pv {
    /// en el screamer (la pantalla entera para él: sin botones)
    pub fn grita(&self) -> bool { self.f.as_ref().map_or(false, |f| f.fase == 1) }
    /// el jugador no se mueve (JUG.bloqueado en el screamer)
    pub fn bloquea(&self) -> bool { self.grita() }
}

impl Juego {
    /// pvEnPartida: se sortea si esta vez viene y cuándo (JXM_PEPE=s lo fuerza a los s segundos)
    fn pv_sortear(&mut self) {
        let p = &mut self.jg.pv; p.t = 0.0; p.cuando = None;
        let forz = std::env::var("JXM_PEPE").ok().map(|s| s.parse::<f32>().unwrap_or(4.0));
        if let Some(s) = forz { self.jg.pv.cuando = Some(s); return; }
        if self.azar() >= PROB { return; }
        let c = DESDE + self.azar() * (HASTA - DESDE); self.jg.pv.cuando = Some(c);
    }
    /// las voces de Pepe al sonido (una vez: en el celular se decodifican con el del sistema)
    fn pv_voces(&mut self) {
        if self.jg.pv.voces { return; } self.jg.pv.voces = true;
        let Some(dir) = self.datos.as_ref().map(|d| d.join("pepe")) else { return }; let _ = std::fs::create_dir_all(&dir);
        for (k, _, _) in VOCES { let r = dir.join(format!("{k}.mp3")); if !r.exists() { let _ = std::fs::write(&r, voz_mp3(k)); } self.sonido.registrar_archivo(&format!("PV_{k}"), &r); }
        self.sonido.sintetico("PV_electrico", || ev3_son("electrico"), 48000); self.sonido.sintetico("PV_latido", || ev3_son("latido"), 48000);
        self.sonido.sintetico("PV_grito", || ev3_son("grito"), 48000); self.sonido.sintetico("PV_grave", || ev3_son("grave"), 48000);
    }
    /// pvPonerAtras: atrás tuyo, a tantos metros, sobre el piso; si hay una pared en el medio, más cerca
    fn pv_atras(&mut self, dist0: f32) -> (V, f32) {
        let yaw = self.jug.yaw + std::f32::consts::PI + (self.azar() - 0.5) * 1.1; let dir = [yaw.sin(), 0.0, yaw.cos()]; let jp = self.jug.pos; let mut d = dist0;
        if let Some(mp) = &self.mapa { if let Some(h) = mp.mundo.rayo(add(jp, [0.0, 0.6, 0.0]), dir, d) { if h.t < d { d = (h.t - 1.2).max(3.0); } } }
        let (x, z) = (jp[0] + dir[0] * d, jp[2] + dir[2] * d);
        let y = self.mapa.as_ref().and_then(|mp| jxjuego::persona::piso_bajo(&mp.mundo, v64([x, jp[1] - 1.0, z]), 3.5)).map(|y| y as f32).unwrap_or(jp[1] - 1.0);
        ([x, y + 0.96, z], (jp[0] - x).atan2(jp[2] - z))
    }
    /// pvAparecer: Pepe de la nada, atrás tuyo, con su chasquido de estática
    unsafe fn pv_aparecer(&mut self, m: &mut Motor3d) {
        self.pv_voces();
        let Some(paq) = self.paq.as_mut() else { self.jg.pv.cuando = None; return };
        let Ok((pj, mut e)) = personaje::Personaje::cargar(paq, "Engineer", 0, 512, &mut personaje::Cargados::default()) else { self.jg.pv.cuando = None; return };
        // (los materiales oscuros: md.tinte = EV3_NEGRO)
        let mut mats = HashMap::new(); let mut nuevos = vec![];
        for mt in &e.c.mats { let mut x = mt.clone(); x.id = ID_PV - mt.id.abs(); for k in 0..3 { x.c[k] *= NEGRO[k]; } x.em = [0.0; 3]; mats.insert(mt.id, x.id); nuevos.push(x); }
        e.c.mats.extend(nuevos); if m.cargar(&e).is_err() { self.jg.pv.cuando = None; return; }
        let (pos, yaw) = { let d = 14.0 + self.azar() * 4.0; self.pv_atras(d) };
        let mut medio: Vec<&'static str> = vec!["s3", "e1", "rSilencio", "p5", "rTodas"];
        for i in (1..medio.len()).rev() { let j = (self.azar() * (i + 1) as f32) as usize % (i + 1); medio.swap(i, j); }
        let lineas = vec!["i1", medio[0], medio[1]];
        self.jg.pv.f = Some(Fase { pj, mats, pos, yaw, vel: [0.0; 3], fase: 0, t: 0.0, lineas, li: 0, prox: 1.3, habla: 0.0, glitch: 0.45, lat: 0.0, dijo_fin: -1.0, fin_dur: 1.3, def_k: 0.4, esc_vis: 1.0, oculto: false, s0: None });
        self.sonido.tocar("PV_electrico", 0.45, 1.0, None); self.jg.pv.vhs.on = true;
    }
    /// pvVoz: lo que dice, desde donde está él (con subtítulo); devuelve lo que dura
    fn pv_voz(&mut self, k: &'static str) -> f32 {
        let (dur, txt) = VOCES.iter().find(|v| v.0 == k).map(|v| (v.1, v.2)).unwrap_or((1.5, ""));
        if !txt.is_empty() { self.jg.pv.sub = Some((txt, dur + 0.7)); }
        let p = self.jg.pv.f.as_ref().map(|f| add(f.pos, [0.0, 0.7, 0.0]));
        self.sonido.tocar(&format!("PV_{k}"), 1.7, 0.94, p); dur / 0.94
    }
    /// pvPaso: el reloj (sin menú y vivo), seguirte, lo que dice, la cinta, el grave y el corazón, el screamer
    pub(super) unsafe fn pv_paso(&mut self, m: &mut Motor3d, dt: f32) {
        if self.jg.pv.nuevo_mapa { self.jg.pv.nuevo_mapa = false; self.pv_sortear(); }
        if let Some(s) = self.jg.pv.sub.as_mut() { s.1 -= dt; if s.1 <= 0.0 { self.jg.pv.sub = None; } }
        let abierto = self.menu.is_some() || self.ajustes.is_some() || self.jg.panel() || self.emotes_panel || self.npc_panel.is_some();
        if self.jg.pv.f.is_none() {
            let Some(c) = self.jg.pv.cuando else { return };
            if abierto || self.jug.vida <= 0.0 { return; }
            self.jg.pv.t += dt; if self.jg.pv.t >= c { self.jg.pv.cuando = None; self.pv_aparecer(m); }
            return;
        }
        let fase = self.jg.pv.f.as_ref().unwrap().fase;
        match fase { 0 => self.pv_sigue(dt, abierto), 1 => self.pv_grita(dt), _ => { let f = self.jg.pv.f.as_mut().unwrap(); f.t += dt; self.jg.pv.vhs.negro = (1.0 - f.t / 0.6).clamp(0.0, 1.0); if f.t > 0.6 { self.pv_terminar(); return; } } }
        // (la animación: parado o caminando hacia vos, deformado)
        if let Some(f) = self.jg.pv.f.as_mut() {
            let e = personaje::Estado { piso: [f.pos[0], f.pos[1] - 0.96, f.pos[2]], vel: f.vel, yaw: f.yaw, mira: 0.0, en_suelo: true, agachado: false, agua: None };
            f.pj.animar(dt, &e); deformar(f, self.jg.t); f.pj.rehacer();
        }
        if self.jg.pv.vhs.sacudon > 0.0 { self.temblor = self.temblor.max(self.jg.pv.vhs.sacudon * 0.35); }
    }
    fn pv_sigue(&mut self, dt: f32, abierto: bool) {
        if abierto || self.jug.vida <= 0.0 { if let Some(f) = self.jg.pv.f.as_mut() { f.vel = [0.0; 3]; } return; }
        let jp = self.jug.pos; let t = { let f = self.jg.pv.f.as_mut().unwrap(); f.t += dt; f.t };
        let mut d = { let f = self.jg.pv.f.as_ref().unwrap(); [jp[0] - f.pos[0], 0.0, jp[2] - f.pos[2]] }; let mut l = d[0].hypot(d[2]);
        // muy lejos (en auto, corriendo): reaparece atrás tuyo, de la nada
        if l > 38.0 { let dd = 10.0 + self.azar() * 3.0; let (p, y) = self.pv_atras(dd); { let f = self.jg.pv.f.as_mut().unwrap(); f.pos = p; f.yaw = y; f.glitch = 0.35; } self.sonido.tocar("PV_electrico", 0.35, 1.0, None);
            let f = self.jg.pv.f.as_ref().unwrap(); d = [jp[0] - f.pos[0], 0.0, jp[2] - f.pos[2]]; l = d[0].hypot(d[2]); }
        let v: f32 = if t < 5.0 { 1.2 } else if t < 14.0 { 2.3 } else { 3.5 };
        { let f = self.jg.pv.f.as_mut().unwrap();
          if l > 1.25 && f.dijo_fin < 0.0 { let s = v.min((l - 1.2) / dt.max(1e-3)); f.vel = [d[0] / l * s, 0.0, d[2] / l * s]; f.pos[0] += f.vel[0] * dt; f.pos[2] += f.vel[2] * dt; } else { f.vel = [0.0; 3]; }
          if l > 0.01 { f.yaw = d[0].atan2(d[2]); } }
        // el piso (sube escalones de hasta 1,5 m; atraviesa paredes: es Pepe)
        let p = self.jg.pv.f.as_ref().unwrap().pos;
        if let Some(y) = self.mapa.as_ref().and_then(|mp| jxjuego::persona::piso_bajo(&mp.mundo, v64([p[0], p[1] - 0.96, p[2]]), 1.5)) { let f = self.jg.pv.f.as_mut().unwrap(); f.pos[1] += (y as f32 + 0.96 - f.pos[1]) * (dt * 12.0).min(1.0); }
        { let f = self.jg.pv.f.as_mut().unwrap(); f.def_k = 0.35 + 0.15 * (t * 2.3).sin(); }
        // lo que dice
        let (li, n, prox, dijo) = { let f = self.jg.pv.f.as_ref().unwrap(); (f.li, f.lineas.len(), f.prox, f.dijo_fin) };
        if li < n && t >= prox && dijo < 0.0 { let k = self.jg.pv.f.as_ref().unwrap().lineas[li]; let dur = self.pv_voz(k); let f = self.jg.pv.f.as_mut().unwrap(); f.li += 1; f.habla = t + dur; f.prox = t + dur + 2.2; f.glitch = f.glitch.max(0.15); }
        // cerca (o cansado de seguirte): termina lo que estaba diciendo, «Ahora te toca a vos.» y el screamer
        let (habla, dijo) = { let f = self.jg.pv.f.as_ref().unwrap(); (f.habla, f.dijo_fin) };
        if dijo < 0.0 && t >= habla + 0.4 && ((l < 1.5 && t > 3.0) || t > 32.0) {
            let fd = self.pv_voz("i7"); { let f = self.jg.pv.f.as_mut().unwrap(); f.dijo_fin = t; f.fin_dur = fd; }
            if l >= 1.5 { let (c, fw) = (self.jg.cam_ult, self.jg.mira_ult); let lf = fw[0].hypot(fw[2]).max(1e-3); let (x, z) = (jp[0] + fw[0] / lf * 1.4, jp[2] + fw[2] / lf * 1.4); let _ = c;
                let y = self.mapa.as_ref().and_then(|mp| jxjuego::persona::piso_bajo(&mp.mundo, v64([x, jp[1] - 1.0, z]), 2.5)).map(|y| y as f32).unwrap_or(jp[1] - 1.0);
                let f = self.jg.pv.f.as_mut().unwrap(); f.pos = [x, y + 0.96, z]; f.yaw = (jp[0] - x).atan2(jp[2] - z); f.vel = [0.0; 3]; f.glitch = 0.3; }
        }
        let (dijo, fin_dur) = { let f = self.jg.pv.f.as_ref().unwrap(); (f.dijo_fin, f.fin_dur) };
        if dijo >= 0.0 && t - dijo > (1.2f32).max(fin_dur * 0.9) { self.pv_screamer(); return; }
        // cerca: la cinta, el grave y el corazón
        let cerca = (1.0 - (l - 1.5) / 10.0).clamp(0.0, 1.0); let f = self.jg.pv.f.as_mut().unwrap(); f.glitch = (f.glitch - dt).max(0.0); let g = f.glitch;
        let vh = &mut self.jg.pv.vhs; vh.on = cerca > 0.2 || g > 0.0; if vh.on { vh.dano = (0.35 + 0.6 * cerca + if g > 0.0 { 0.5 } else { 0.0 }).min(1.0); vh.sacudon = if g > 0.0 { 0.5 } else { 0.0 }; }
        self.sonido.bucle("pv_grave", "PV_grave", 0.06 + 0.4 * cerca);
        let f = self.jg.pv.f.as_mut().unwrap(); f.lat -= dt;
        if cerca > 0.1 && f.lat <= 0.0 { f.lat = 1.0 - 0.55 * cerca; self.sonido.tocar("PV_latido", 0.35 + 0.4 * cerca, 1.0, None); }
    }
    /// pvScreamer: la cara pegada a la pantalla, el grito y la voz deformada
    fn pv_screamer(&mut self) {
        let (c, d) = (self.jg.cam_ult, self.jg.mira_ult); self.jug.vel = [0.0; 3]; self.jg.pv.sub = None;
        self.sonido.tocar("PV_grito", 1.3, 1.0, None); self.sonido.tocar("PV_f1", 1.4, 0.55, None); self.jg.pv.vhs.on = true;
        let f = self.jg.pv.f.as_mut().unwrap(); f.fase = 1; f.t = 0.0; f.def_k = 1.0; f.esc_vis = 1.15;
        f.pos = [c[0] + d[0] * 0.42, c[1] - 1.32, c[2] + d[2] * 0.42]; f.yaw = (-d[0]).atan2(-d[2]);
    }
    fn pv_grita(&mut self, dt: f32) {
        let (c, d) = (self.jg.cam_ult, self.jg.mira_ult); let f = self.jg.pv.f.as_mut().unwrap(); f.t += dt; let g = f.t;
        f.yaw = (-d[0]).atan2(-d[2]); f.vel = [0.0; 3];
        // (la cara, en el medio de la pantalla y a medio metro: se corrige con la cabeza del cuadro anterior)
        if let Some(h) = f.pj.hueso("Head") { let base = pv_base(f); let hc = pos_de(&m4::mul(&base, &h)); let meta = add(c, esc(d, 0.5)); f.pos = add(f.pos, esc(sub(meta, hc), 0.6)); }
        let vh = &mut self.jg.pv.vhs; vh.sacudon = (1.0 - g / 1.6).clamp(0.3, 1.0); vh.rojo = if (g * 12.0).floor() as i32 % 3 == 0 { 0.45 } else { 0.0 }; vh.blanco = if g < 0.07 { 1.0 } else { 0.0 }; vh.dano = 1.0;
        if g > 1.45 { vh.negro = 1.0; vh.rojo = 0.0; vh.blanco = 0.0; vh.sacudon = 0.0; f.oculto = true; }
        if g > 1.9 { f.fase = 2; f.t = 0.0; }
    }
    /// pvTerminar: se va (una vez por mapa)
    fn pv_terminar(&mut self) { self.jg.pv.f = None; self.jg.pv.vhs = Vhs::default(); self.jg.pv.sub = None; self.jg.pv.cuando = None; }
    /// pvLuces: la cara iluminada de frente en el screamer
    pub(super) fn pv_luz(&self, cam: V) -> Option<LuzP> { if self.jg.pv.grita() { Some([cam[0], cam[1] + 0.25, cam[2], 3.5, 5.5, 5.0, 4.4, 0.0, 0.0, -1.0, 0.0, -2.0]) } else { None } }
    pub(super) fn pv_items(&self, items: &mut Vec<ItemDin>) {
        let Some(f) = &self.jg.pv.f else { return }; if f.oculto || f.fase == 2 { return; }
        let n0 = items.len(); f.pj.items(&pv_base(f), items);
        // (oscuro, salvo en el screamer: ahí se le ve la cara)
        if f.fase == 0 { for it in &mut items[n0..] { if let Some(&m) = f.mats.get(&it.mat) { it.mat = m; } } }
    }
    /// la cinta (aproximada: vhs.js es un sombreador de toda la pantalla): barrido, tracking, nieve, ruido abajo, el rojo
    /// de un golpe, el blanco y el negro
    pub(super) fn pv_hud_fondo(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32) {
        let v = self.jg.pv.vhs; if !v.on && v.negro <= 0.0 { return; }
        let t = self.jg.t; let az = |i: u32| { let x = ((i as f32 * 12.9898 + (t * 60.0).floor() * 78.233).sin() * 43758.547).fract(); x.abs() };
        if v.on {
            let d = v.dano;
            let paso = (hf / 240.0).max(2.0); let mut y = 0.0; while y < hf { l.caja(u, 0.0, y, wf, paso * 0.45, 0.0, [0.0, 0.0, 0.0, 0.12 + 0.1 * d]); y += paso; }
            let ty = ((t * 0.13) % 1.2 - 0.1) * hf; l.caja(u, 0.0, ty, wf, hf * 0.05, 0.0, [0.85, 0.85, 0.9, 0.06 + 0.1 * d]);
            for i in 0..(20.0 + 60.0 * d) as u32 { l.caja(u, az(i) * wf, az(i + 500) * hf, 2.0 + az(i + 900) * 3.0, 1.5, 0.0, [1.0, 1.0, 1.0, 0.25 + 0.35 * d]); }
            for i in 0..14 { let x = az(i + 2000) * wf; l.caja(u, x, hf * (0.955 + az(i + 3000) * 0.04), wf * (0.03 + az(i + 4000) * 0.12), hf * 0.006, 0.0, [0.9, 0.9, 0.9, 0.35 * d]); }
            borde(l, u, wf, hf, [0.0, 0.0, 0.0], 0.9);
            l.caja(u, 0.0, 0.0, wf, hf, 0.0, [0.25, 0.05, 0.3, 0.06 * d]);
        }
        if v.rojo > 0.0 { l.caja(u, 0.0, 0.0, wf, hf, 0.0, [0.8, 0.0, 0.0, v.rojo]); }
        if v.blanco > 0.0 { l.caja(u, 0.0, 0.0, wf, hf, 0.0, [1.0, 1.0, 1.0, v.blanco]); }
        if v.negro > 0.0 { l.caja(u, 0.0, 0.0, wf, hf, 0.0, [0.0, 0.0, 0.0, v.negro]); }
    }
    /// el subtítulo (abajo al medio, con la letra de la cinta)
    pub(super) fn pv_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) {
        let Some((txt, _)) = self.jg.pv.sub else { return }; let tt = (t * 1.15).min(hf * 0.05); let an = l.ancho(tt, txt);
        l.texto(u, (wf - an) / 2.0 + 2.0, hf * 0.8, tt, [1.0, 0.16, 0.16, 0.6], txt); l.texto(u, (wf - an) / 2.0 - 2.0, hf * 0.8, tt, [0.16, 0.86, 1.0, 0.45], txt);
        l.texto_sombra(u, (wf - an) / 2.0, hf * 0.8, tt, [1.0, 0.85, 0.83, 1.0], txt);
    }
}
fn pv_base(f: &Fase) -> M4 { let e = f.esc_vis; mapa::trs([f.pos[0], f.pos[1] - 0.96, f.pos[2]], [0.0, (f.yaw / 2.0).sin(), 0.0, (f.yaw / 2.0).cos()], [e, e, e]) }
/// ev3Deformar: el cuello estirado y la cabeza torcida y alargada, temblando
fn deformar(f: &mut Fase, t: f32) {
    let (Some(h), Some(n)) = (f.pj.indice("Head"), f.pj.indice("Neck")) else { return };
    if f.s0.is_none() { f.s0 = Some((n, f.pj.escala(n), h, f.pj.escala(h))); }
    let (_, sn, _, sh) = f.s0.unwrap(); let kk = f.def_k.max(0.0); let (nx, ny) = (1.0 - 0.3 * kk, 1.0 + 1.45 * kk);
    f.pj.poner_escala(n, [sn[0] * nx, sn[1] * ny, sn[2] * nx]);
    f.pj.poner_escala(h, [sh[0] * (1.0 - 0.16 * kk) / nx, sh[1] * (1.0 + 0.85 * kk) / ny, sh[2] * (1.0 + 0.05 * kk) / nx]);
    if kk > 0.001 {
        let j = kk * kk * ((t * 37.0).sin() * 0.05 + (t * 23.0 + 1.0).sin() * 0.04);
        let q = qnorm(qmul(qmul(f.pj.giro(h), qeje([1.0, 0.0, 0.0], 0.72 * kk + j)), qeje([0.0, 0.0, 1.0], -0.14 * kk + j * 0.6))); f.pj.poner_giro(h, q);
        let qn = qnorm(qmul(qmul(f.pj.giro(n), qeje([1.0, 0.0, 0.0], -0.25 * kk)), qeje([0.0, 0.0, 1.0], -0.1 * kk))); f.pj.poner_giro(n, qn);
    }
}
/// los sonidos del evento hechos acá (ev3Son y ev3Bucle de ev300.js): el chasquido eléctrico, el latido, el grito del
/// screamer (saturado) y el grave del ambiente (en bucle)
fn ev3_son(tipo: &str) -> Vec<f32> {
    let sr = 48000.0f64; let dur = match tipo { "grito" => 1.5, "latido" => 0.5, "grave" => 2.0, _ => 0.6 }; let n = (sr * dur) as usize; let mut d = vec![0f64; n];
    let mut s: u32 = 0xabcdef; let mut ruido = move || { s ^= s << 13; s ^= s >> 17; s ^= s << 5; s as f64 / 2147483648.0 - 1.0 };
    // (la envolvente de ev3Son: sube en 12 ms a `pico` y baja a casi nada en `dur`)
    let env = |t: f64, at: f64, pico: f64, du: f64| -> f64 { let x = t - at; if x < 0.0 || x > du { 0.0 } else if x < 0.012 { 0.0001 * (pico / 0.0001).powf(x / 0.012) } else { pico * (0.0001 / pico).powf((x - 0.012) / (du - 0.012).max(1e-3)) } };
    let osc = |d: &mut Vec<f64>, forma: u8, f0: f64, f1: f64, at: f64, du: f64, pico: f64| { let mut ph = 0.0f64; for i in 0..n { let t = i as f64 / sr; if t < at || t > at + du + 0.05 { continue; }
        let k = ((t - at) / du).min(1.0); let f = if f1 > 0.0 { f0 * (f1 / f0).powf(k) } else { f0 }; ph += f / sr; let x = if forma == 0 { (ph * std::f64::consts::TAU).sin() } else { 2.0 * (ph - (ph + 0.5).floor()) }; d[i] += x * env(t, at, pico, du); } };
    let mut banda = |d: &mut Vec<f64>, at: f64, du: f64, pico: f64, fr: f64, q: f64| { let w0 = std::f64::consts::TAU * fr / sr; let al = w0.sin() / (2.0 * q); let c = w0.cos(); let a0 = 1.0 + al; let (mut x1, mut x2, mut y1, mut y2) = (0.0, 0.0, 0.0, 0.0);
        for i in 0..n { let t = i as f64 / sr; if t < at || t > at + du + 0.05 { continue; } let x = ruido(); let y = (al * x - al * x2 - (-2.0 * c) * y1 - (1.0 - al) * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] += y * env(t, at, pico, du); } };
    match tipo {
        "latido" => { osc(&mut d, 0, 62.0, 40.0, 0.0, 0.16, 0.9); osc(&mut d, 0, 58.0, 38.0, 0.24, 0.14, 0.6); }
        "grito" => { for (f0, f1) in [(220.0, 880.0), (233.0, 940.0), (330.0, 1320.0)] { osc(&mut d, 1, f0, f1, 0.0, 1.3, 0.5); } banda(&mut d, 0.0, 1.4, 1.0, 1500.0, 0.4); banda(&mut d, 0.0, 0.4, 1.0, 300.0, 0.6);
            for x in d.iter_mut() { *x = (*x * 6.0).tanh() * 0.9; } }
        "grave" => { let (mut ph, mut y) = ([0.0f64; 3], 0.0f64); let a = 1.0 - (-std::f64::consts::TAU * 180.0 / sr).exp();
            for i in 0..n { let mut x = 0.0; for (k, f) in [41.0, 41.7, 55.3].into_iter().enumerate() { ph[k] += f / sr; x += 2.0 * (ph[k] - (ph[k] + 0.5).floor()) * 0.22; } y += (x - y) * a; d[i] = y; } }
        _ => { banda(&mut d, 0.0, 0.5, 0.4, 2500.0, 0.5); osc(&mut d, 1, 120.0, 60.0, 0.0, 0.5, 0.15); }
    }
    d.into_iter().map(|x| x.clamp(-1.0, 1.0) as f32).collect()
}
