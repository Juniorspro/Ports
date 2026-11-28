//! Las armas, como armas.js: la Physics Gun (en el celular un toque agarra y otro suelta; el «2» congela lo agarrado o
//! descongela lo que se mira; con «Girar» el arrastre gira el objeto; + y − lo alejan y acercan) y la Gravity Gun (el «2»
//! levanta y suelta, el disparo lanza lo agarrado o empuja lo que se mira). Las cuentas son las de fisicaPaso, gravPaso,
//! agarrarFisica, soltarAgarre, gravPrimario y gravSecundario. Lo que suena lo junta en `sonidos` (el juego lo toca).
use jxjuego::fisica::{qeje, qmul, rot, rot_inv, Fisica, Q, V};
use jxjuego::mundo::Mundo;

/// las armas (DEF_ARMAS): el nombre, el que se muestra, el ícono, los sonidos (sacar, sostener, tiro, recarga), el
/// modelo en la mano (el nodo debajo de WalkSway) con sus clips (sacar, quieto, sosteniendo, fuego, recarga), el tipo
/// (fisica, grav, tool, bala, perdigones, cohete, flecha, golpe), el cargador, la cadencia, el daño, la dispersión, si es
/// de un tiro por toque, si tiene mira, el alcance y el empuje de las de golpe, y los clips y sonidos de la palanca
pub struct DefArma { pub n: &'static str, pub nom: &'static str, pub ic: &'static str, pub s_sacar: &'static str, pub s_sosten: &'static str,
    pub nodo: &'static str, /** la pintura de JXMod (armasjx.js: "fisica", "gravedad", "tool", "palanca"; "" sin pintar) */ pub jx: &'static str, pub sacar: &'static str, pub quieto: &'static str, pub sujeta: &'static str, pub fuego: &'static str,
    pub tipo: &'static str, pub car: u32, pub cad: f32, pub dan: f32, pub disp: f32, pub semi: bool, pub mira: bool, pub alcance: f32, pub empuje: f32,
    pub s_f: &'static [&'static str], pub s_r: &'static str, pub recarga: &'static str, pub fuego2: &'static str,
    pub pega: &'static [&'static str], pub falla: &'static [&'static str], pub s_imp: &'static [&'static str], pub s_carne: &'static [&'static str] }
const BASE: DefArma = DefArma { n: "", nom: "", ic: "", s_sacar: "", s_sosten: "", nodo: "", jx: "", sacar: "", quieto: "", sujeta: "", fuego: "", tipo: "", car: 0, cad: 0.1, dan: 0.0, disp: 0.0,
    semi: false, mira: false, alcance: 0.0, empuje: 0.0, s_f: &[], s_r: "", recarga: "", fuego2: "", pega: &[], falla: &[], s_imp: &[], s_carne: &[] };
pub const ARMAS: [DefArma; 15] = [
    DefArma { n: "PhysicsGun", jx: "fisica", nom: "Physics Gun", ic: "W_PhysGun", s_sacar: "genericReadyNew_1", s_sosten: "PG_Hold", nodo: "GM_PhysGun", sacar: "PG_draw", quieto: "PG_idle", sujeta: "PG_hold", fuego: "PG_fire", tipo: "fisica", ..BASE },
    DefArma { n: "GravityGun", jx: "gravedad", nom: "Gravity Gun", ic: "W_GravGun", s_sacar: "GG_Open", s_sosten: "GG_Hold", nodo: "GM_GravGun", sacar: "GG_draw", quieto: "GG_idle", sujeta: "GG_hold", fuego: "GG_fire", tipo: "grav", cad: 0.5, ..BASE },
    DefArma { n: "ToolBaton", jx: "tool", nom: "Tool Gun", ic: "W_ToolGun", s_sacar: "genericReadyNew_1", nodo: "GM_ToolGun", sacar: "TG_draw", quieto: "TG_idle", sujeta: "TG_idle", fuego: "TG_fire", tipo: "tool", cad: 0.35, ..BASE },
    DefArma { n: "Crowbar", jx: "palanca", nom: "Palanca", ic: "W_Crowbar", nodo: "Crowbar", fuego: "CB_miss1", sacar: "CB_draw", quieto: "CB_idle", tipo: "golpe", cad: 0.4, dan: 25.0, empuje: 70.0, alcance: 1.95,
        s_f: &["CB_Swing"], pega: &["CB_hit1", "CB_hit2", "CB_hit3"], falla: &["CB_miss1", "CB_miss2"], s_imp: &["CB_Impact1", "CB_Impact2"], s_carne: &["CB_Flesh1", "CB_Flesh2", "CB_Flesh3", "CB_Flesh4", "CB_Flesh5"], ..BASE },
    DefArma { n: "Hands", nom: "Manos", ic: "Hands", nodo: "Hands", fuego: "Punch", fuego2: "Hook", sacar: "Draw", s_f: &["Arm_Swing_edited"], tipo: "golpe", cad: 0.45, dan: 15.0, alcance: 2.0, ..BASE },
    DefArma { n: "Pistol", nom: "Pistola", ic: "W_Pistol", nodo: "Pistol", fuego: "pistolfire", sacar: "pistolready", recarga: "pistolreload", s_f: &["pistol2Fire_1"], s_sacar: "PistolReady2", s_r: "pistolreload", car: 12, cad: 0.18, dan: 25.0, tipo: "bala", semi: true, ..BASE },
    DefArma { n: "Revolver", nom: "Revólver", ic: "W_Revolver", nodo: "Revolver", fuego: "revolverFire", sacar: "revolverReady", recarga: "revolvertoreload", s_f: &["revolverfire2"], s_sacar: "revolverready", s_r: "pistolreload", car: 6, cad: 0.45, dan: 55.0, tipo: "bala", semi: true, ..BASE },
    DefArma { n: "Smg", nom: "SMG", ic: "W_Smg", nodo: "Smg", fuego: "smgfire", sacar: "smgready", recarga: "smgreload", s_f: &["smgfire"], s_sacar: "smgready", s_r: "smgreload", car: 30, cad: 0.075, dan: 14.0, tipo: "bala", disp: 0.025, ..BASE },
    DefArma { n: "Akm", nom: "AKM", ic: "W_Akm", nodo: "Akm", fuego: "AKmFire", sacar: "AKmReady", recarga: "AKmReloadclip", s_f: &["AkFire3"], s_sacar: "Akready", s_r: "Akreloadcliponly", car: 30, cad: 0.1, dan: 24.0, tipo: "bala", disp: 0.018, ..BASE },
    DefArma { n: "Shotgun", nom: "Escopeta", ic: "W_Shotgun", nodo: "Shotgun", fuego: "shotgunFire", sacar: "shotgunReady", recarga: "shotgunToReload", s_f: &["shotgunFire"], s_sacar: "ShotgunReady2", s_r: "ShotgunReloadOnceCut", car: 8, cad: 0.85, dan: 12.0, tipo: "perdigones", semi: true, ..BASE },
    DefArma { n: "Sniper", nom: "Francotirador", ic: "W_Sniper", nodo: "Sniper", fuego: "sniperFire", sacar: "sniperready", recarga: "sniperreload", s_f: &["sniperfire2"], s_sacar: "genericReady", s_r: "sniperreload", car: 5, cad: 1.1, dan: 100.0, tipo: "bala", semi: true, mira: true, ..BASE },
    DefArma { n: "RPG", nom: "RPG", ic: "W_RPG", nodo: "RPG", fuego: "rocketlauncherFire", sacar: "rocketlauncherReady", recarga: "rocketlauncherReload", s_f: &["RocketlauncherFire2"], s_sacar: "RocketLauncherReady", s_r: "RocketLauncherReload", car: 1, cad: 0.6, dan: 120.0, tipo: "cohete", semi: true, ..BASE },
    DefArma { n: "Crossbow", nom: "Ballesta", ic: "W_Crossbow", nodo: "Crossbow", fuego: "crossbowfire", sacar: "crossbowready", recarga: "crossbowreload", s_f: &["crossbowfire"], s_sacar: "genericReady", s_r: "crossbowreload", car: 1, cad: 0.4, dan: 90.0, tipo: "flecha", semi: true, ..BASE },
    DefArma { n: "Bat", nom: "Bate", ic: "W_Bat", nodo: "Bat", fuego: "bathit1", sacar: "batReady", s_f: &["Arm_Swing_edited"], s_sacar: "grabholster", tipo: "golpe", cad: 0.55, dan: 35.0, alcance: 2.4, ..BASE },
    // (el celular: viene instalado y prendido —el mod oficial «Celular», celumano.js—; en la mano lo dibuja personajes.rs)
    DefArma { n: "Celular", nom: "Celular", ic: "ico:celular", tipo: "celu", cad: 0.3, ..BASE },
];

/// lo agarrado con la Physics Gun: el cuerpo, a qué distancia, el punto agarrado (en el cuerpo), el giro relativo a la
/// cámara y dónde estaba (agarreInicio)
pub struct Agarre { pub id: u32, pub dist: f32, rl: V, qrel: Q }
/// lo levantado con la Gravity Gun
pub struct Grav { pub id: u32 }

#[derive(Default)]
pub struct Armas {
    /// el arma en la mano (ARMAS)
    pub i: usize,
    pub agarre: Option<Agarre>, pub grav: Option<Grav>,
    /// girando lo agarrado (el botón Girar: el arrastre gira el objeto en vez de la cámara)
    pub rotar: bool,
    /// la barra de armas abierta (se cierra sola a los 2,5 s)
    pub barra_t: f32,
    /// lo que tiene que sonar (nombre, volumen) y los avisos, para el juego
    pub sonidos: Vec<(String, f32)>, pub avisos: Vec<String>,
    /// el clip que tiene que tocar el arma en la mano (sacar al elegirla, fuego al lanzar): lo pone el juego
    pub anim: Option<&'static str>,
    /// la Tool Gun disparó (true: el «2»): lo hace el juego, que tiene los objetos
    pub herr: Option<bool>,
    /// las balas en el cargador de cada una, lo que falta para el próximo tiro (ARM.t), ocupada (sacando o recargando),
    /// recargando, el retroceso, apuntando (y cuánto: 0 a 1), la mira del francotirador y el golpe que va a pegar
    pub balas: Vec<u32>, pub t: f32, pub ocup: f32, pub recargando: f32, pub retro: f32, pub apunta: bool, pub ap_k: f32, pub zoom: bool, pub golpe_t: f32,
    /// cada vez que se empieza a apuntar (el arma calcula dónde va con la pose de ese momento: ARM.apTok)
    pub ap_tok: u32,
    azar: u32,
    /// la munición limitada (como en GMod, municion.js): prendida, cada tipo tiene su reserva (MUN), que se gasta al recargar
    pub limitada: bool, pub res: [u32; 7],
}
/// los tipos de munición de las armas del juego: nombre, cuánto da una caja y con cuánto se empieza (MUN_TIPOS de la web)
pub const MUN: [(&str, u32, u32); 7] = [("pistol", 20, 60), ("smg1", 45, 90), ("ar2", 20, 60), ("buckshot", 20, 16), ("357", 6, 12), ("xbowbolt", 6, 5), ("rpg_round", 1, 2)];
/// la munición que usa un arma (MUN_NATIVAS; las otras con cargador, la de SMG)
pub fn mun_de(d: &DefArma) -> Option<usize> { if d.car == 0 { return None; } Some(match d.n { "Pistol" => 0, "Revolver" => 4, "Smg" => 1, "Akm" | "Sniper" => 2, "Shotgun" => 3, "RPG" => 6, "Crossbow" => 5, _ => 1 }) }

fn v64(a: [f32; 3]) -> V { [a[0] as f64, a[1] as f64, a[2] as f64] }
fn qconj(q: Q) -> Q { [-q[0], -q[1], -q[2], q[3]] }

impl Armas {
    pub fn def(&self) -> &'static DefArma { &ARMAS[self.i.min(ARMAS.len() - 1)] }
    fn son(&mut self, n: &str, v: f32) { self.sonidos.push((n.to_string(), v)); }
    /// elegirArma: suelta lo que tenía y saca la otra
    pub fn elegir(&mut self, fis: &mut Fisica, i: usize) {
        self.soltar(fis, false); self.soltar_grav(fis);
        self.i = i.min(ARMAS.len() - 1); self.barra_t = 0.0;
        if self.balas.len() != ARMAS.len() { self.balas = ARMAS.iter().map(|a| a.car).collect(); }
        self.recargando = 0.0; self.zoom = false; self.apunta = false; self.ap_k = 0.0; self.golpe_t = 0.0;
        let s = self.def().s_sacar; if s.is_empty() { self.son("UI_arma", 0.35); } else { self.son(s, 0.6); }
        self.anim = Some(self.def().sacar); self.ocup = if self.def().sacar.is_empty() { 0.2 } else { 0.5 };
    }
    /// el punto agarrado en el mundo (la punta del rayo)
    pub fn punto_agarrado(&self, fis: &Fisica) -> Option<[f32; 3]> {
        let a = self.agarre.as_ref()?; let b = fis.cuerpo(a.id)?; let r = rot(b.q, a.rl);
        Some([(b.pos[0] + r[0]) as f32, (b.pos[1] + r[1]) as f32, (b.pos[2] + r[2]) as f32])
    }
    /// el disparo (en el celular, al apoyar el dedo)
    pub fn disparo(&mut self, fis: &mut Fisica, mundo: &Mundo, ojo: [f32; 3], dir: [f32; 3], yaw: f32) {
        if self.ocup > 0.0 && self.def().tipo != "fisica" { return; }
        match self.def().n {
            "PhysicsGun" => { if self.agarre.is_some() { self.soltar(fis, false); } else { self.agarrar(fis, mundo, ojo, dir, yaw); } }
            "ToolBaton" => self.herramienta(false),
            "GravityGun" => self.grav_primario(fis, mundo, ojo, dir),
            _ => {}
        }
    }
    /// el «2»
    pub fn disparo2(&mut self, fis: &mut Fisica, mundo: &Mundo, ojo: [f32; 3], dir: [f32; 3]) {
        match self.def().n {
            "PhysicsGun" => {
                if self.agarre.is_some() { self.soltar(fis, true); return; }
                // (sin nada agarrado: descongela lo que se mira)
                let Some(id) = fis.rayo(mundo, v64(ojo), v64(dir), 50.0, &[]).and_then(|h| h.cuerpo) else { return };
                if let Some(b) = fis.cuerpo_mut(id) { if b.congelado && b.masa > 0.0 { b.congelado = false; b.despertar(); self.avisos.push("Descongelado".into()); } }
            }
            "ToolBaton" => self.herramienta(true),
            "GravityGun" => self.grav_secundario(fis, mundo, ojo, dir),
            // (las de fuego: el «2» apunta —el arma al centro y la vista más cerrada—; el francotirador mira por la mira)
            _ => { let d = self.def(); if d.mira { self.zoom = !self.zoom; } else if d.tipo == "bala" || d.tipo == "perdigones" { self.apunta = !self.apunta; if self.apunta && self.ap_k <= 0.02 { self.ap_tok += 1; } } }
        }
    }
    /// la Tool Gun: el tiro (con su sonido de HL2 y la animación de fuego)
    fn herramienta(&mut self, alt: bool) {
        self.herr = Some(alt); self.anim = Some(self.def().fuego);
        let s = format!("TG_Fire{}", 1 + self.azar() % 2); self.son(&s, 0.6);
    }
    /// agarrarFisica: lo que se mira (hasta 50 m), si se mueve
    fn agarrar(&mut self, fis: &mut Fisica, mundo: &Mundo, ojo: [f32; 3], dir: [f32; 3], yaw: f32) {
        let Some(h) = fis.rayo(mundo, v64(ojo), v64(dir), 50.0, &[]) else { return };
        let Some(id) = h.cuerpo else { return };
        let Some(b) = fis.cuerpo_mut(id) else { return };
        if b.masa <= 0.0 { return; }
        b.congelado = false; b.despertar(); b.agarrado = true;
        let cam = qeje([0.0, 1.0, 0.0], yaw as f64);
        let rl = rot_inv(b.q, [h.p[0] - b.pos[0], h.p[1] - b.pos[1], h.p[2] - b.pos[2]]);
        self.agarre = Some(Agarre { id, dist: h.t as f32, rl, qrel: qmul(qconj(cam), b.q) });
    }
    /// soltarAgarre: suelto o congelado ahí
    pub fn soltar(&mut self, fis: &mut Fisica, congelar: bool) {
        let Some(a) = self.agarre.take() else { return };
        self.rotar = false;
        if let Some(b) = fis.cuerpo_mut(a.id) {
            b.agarrado = false;
            if congelar { b.congelado = true; b.vel = [0.0; 3]; b.ang = [0.0; 3]; } else { b.despertar(); }
        }
        if congelar { self.son("Click", 0.6); }
        self.son("PG_Off", 0.5);
    }
    fn grav_primario(&mut self, fis: &mut Fisica, mundo: &Mundo, ojo: [f32; 3], dir: [f32; 3]) {
        let f = v64(dir);
        let lanza = format!("GG_Launch{}", 1 + self.azar() % 4);
        if let Some(g) = self.grav.take() {
            if let Some(b) = fis.cuerpo_mut(g.id) { b.agarrado = false; b.despertar(); let k = (2500.0 / b.masa.max(10.0)).min(50.0); for e in 0..3 { b.vel[e] += f[e] * k; } }
            self.son(&lanza, 0.7); self.anim = Some(self.def().fuego); return;
        }
        if let Some(id) = fis.rayo(mundo, v64(ojo), f, 10.0, &[]).and_then(|h| h.cuerpo) {
            if let Some(b) = fis.cuerpo_mut(id) { if b.dinamico() { b.despertar(); let k = (1500.0 / b.masa.max(10.0)).min(50.0); for e in 0..3 { b.vel[e] += f[e] * k; } self.son(&lanza, 0.7); self.anim = Some(self.def().fuego); return; } }
        }
        self.son("GG_Dry", 0.6);
    }
    fn grav_secundario(&mut self, fis: &mut Fisica, mundo: &Mundo, ojo: [f32; 3], dir: [f32; 3]) {
        if self.grav.is_some() { self.soltar_grav(fis); self.son("GG_Drop", 0.5); return; }
        if let Some(id) = fis.rayo(mundo, v64(ojo), v64(dir), 25.0, &[]).and_then(|h| h.cuerpo) {
            if let Some(b) = fis.cuerpo_mut(id) {
                if b.masa > 0.0 && b.masa < 2000.0 { b.congelado = false; b.agarrado = true; b.despertar(); self.grav = Some(Grav { id }); self.son("GG_Pickup", 0.6); return; }
            }
        }
        self.son("GG_Dry", 0.5);
    }
    fn soltar_grav(&mut self, fis: &mut Fisica) {
        if let Some(g) = self.grav.take() { if let Some(b) = fis.cuerpo_mut(g.id) { b.agarrado = false; b.despertar(); } }
    }
    /// fisicaPaso y gravPaso: lo agarrado va adonde se mira (antes de cada paso de la física)
    pub fn paso(&mut self, fis: &mut Fisica, dt: f32, ojo: [f32; 3], dir: [f32; 3], yaw: f32) {
        if dt <= 0.0 { return; }
        let (o, f, dt) = (v64(ojo), v64(dir), dt as f64);
        if let Some(a) = &self.agarre {
            let Some(b) = fis.cuerpo_mut(a.id) else { self.agarre = None; return };
            let meta = [o[0] + f[0] * a.dist as f64, o[1] + f[1] * a.dist as f64, o[2] + f[2] * a.dist as f64];
            let r = rot(b.q, a.rl); let dv = [meta[0] - b.pos[0] - r[0], meta[1] - b.pos[1] - r[1], meta[2] - b.pos[2] - r[2]];
            b.agarrado = true; b.congelado = false; b.despertar();
            let k = (1.0 / dt).min(14.0); b.vel = [dv[0] * k, dv[1] * k, dv[2] * k];
            let vm = (b.vel[0] * b.vel[0] + b.vel[1] * b.vel[1] + b.vel[2] * b.vel[2]).sqrt(); if vm > 40.0 { for e in 0..3 { b.vel[e] *= 40.0 / vm; } }
            // (el giro: el mismo relativo a la cámara que cuando se agarró, o el que se le dio girándolo)
            let qm = qmul(qeje([0.0, 1.0, 0.0], yaw as f64), a.qrel);
            let mut dq = qmul(qm, qconj(b.q)); if dq[3] < 0.0 { dq = [-dq[0], -dq[1], -dq[2], -dq[3]]; }
            let k = 2.0 / dt * 0.35; b.ang = [dq[0] * k, dq[1] * k, dq[2] * k];
        }
        if let Some(g) = &self.grav {
            let Some(b) = fis.cuerpo_mut(g.id) else { self.grav = None; return };
            let d = 2.5 + b.r; let meta = [o[0] + f[0] * d, o[1] + f[1] * d, o[2] + f[2] * d];
            let k = (1.0 / dt).min(12.0); b.vel = [(meta[0] - b.pos[0]) * k, (meta[1] - b.pos[1]) * k, (meta[2] - b.pos[2]) * k];
            for e in 0..3 { b.ang[e] *= 0.8; } b.agarrado = true; b.despertar();
        }
    }
    /// girar lo agarrado con el arrastre (en píxeles de la pantalla, alto `h`): como ENT.rdx/rdy de la web
    pub fn rotar_por(&mut self, dx: f32, dy: f32, h: f32) {
        let Some(a) = self.agarre.as_mut() else { return };
        let k = 0.006 * 800.0 / h.max(1.0);
        let qy = qeje([0.0, 1.0, 0.0], (-dx * k) as f64); let qx = qeje([1.0, 0.0, 0.0], (dy * k) as f64);
        a.qrel = qmul(qmul(qy, qx), a.qrel);
    }
    /// los botones + y −: 1,5 m más lejos o más cerca (entre 1,5 y 50)
    pub fn distancia(&mut self, d: f32) { if let Some(a) = self.agarre.as_mut() { a.dist = (a.dist + d).clamp(1.5, 50.0); } }
    /// lo que suena en bucle mientras sostiene algo (sSosten)
    pub fn sosten(&self) -> Option<&'static str> { if (self.agarre.is_some() || self.grav.is_some()) && !self.def().s_sosten.is_empty() { Some(self.def().s_sosten) } else { None } }
    /// otro mapa: nada agarrado
    pub fn olvidar(&mut self) { self.agarre = None; self.grav = None; self.rotar = false; }
    /// los relojes de las armas (armasPaso): el próximo tiro, ocupada, la recarga (al terminar llena el cargador), el
    /// retroceso y el apuntar (entra y sale en ~0,2 s). Devuelve true si el golpe atrasado (las manos, el bate) pega ahora
    pub fn relojes(&mut self, dt: f32) -> bool {
        self.t -= dt; if self.ocup > 0.0 { self.ocup -= dt; }
        if self.recargando > 0.0 { self.recargando -= dt; if self.recargando <= 0.0 { let i = self.i; let lim = self.limitada; let m = mun_de(&ARMAS[i]); if let Some(b) = self.balas.get_mut(i) {
            // (limitada: toma de la reserva lo que falta para llenar el cargador)
            if let (true, Some(m)) = (lim, m) { let toma = (ARMAS[i].car.saturating_sub(*b)).min(self.res[m]); self.res[m] -= toma; *b += toma; } else { *b = ARMAS[i].car; } } } }
        self.retro *= (-dt * 14.0).exp();
        let d = self.def(); let si = self.apunta && (d.tipo == "bala" || d.tipo == "perdigones") && !d.mira && self.recargando <= 0.0;
        self.ap_k += ((si as u8 as f32) - self.ap_k) * (dt * 14.0).min(1.0); if self.ap_k < 0.002 && !si { self.ap_k = 0.0; }
        if self.golpe_t > 0.0 { self.golpe_t -= dt; if self.golpe_t <= 0.0 { return true; } }
        false
    }
    /// recargar: si le faltan balas, el clip de recarga (lo que dura, entre 0,6 y 4 s) y su sonido
    pub fn recargar(&mut self, dur_clip: f32) {
        let i = self.i; let d = &ARMAS[i];
        if d.car == 0 || self.balas.get(i).copied().unwrap_or(0) >= d.car || self.recargando > 0.0 { return; }
        if self.limitada && mun_de(d).is_some_and(|m| self.res[m] == 0) { return; }
        self.recargando = if dur_clip > 0.0 { dur_clip } else { 1.2 }.clamp(0.6, 4.0); self.ocup = self.recargando;
        if !d.recarga.is_empty() { self.anim = Some(d.recarga); }
        if !d.s_r.is_empty() { self.son(d.s_r, 0.7); }
    }
    /// munReiniciar: cada tipo vuelve a lo del principio (al aparecer)
    pub fn mun_reiniciar(&mut self) { for (k, m) in MUN.iter().enumerate() { self.res[k] = m.2; } }
    /// una caja de munición: la de un tipo (None: el cajón con todo —tres cajas de cada una—); sin munición limitada, llena el cargador
    pub fn mun_caja(&mut self, tipo: Option<usize>) {
        if !self.limitada { let i = self.i; if let Some(b) = self.balas.get_mut(i) { *b = ARMAS[i].car; } return; }
        for (k, m) in MUN.iter().enumerate() { if tipo.is_none_or(|t| t == k) { self.res[k] = (self.res[k] + m.1 * if tipo.is_none() { 3 } else { 1 }).min(9999); } }
    }
    /// lo que se ve al lado del cargador: la reserva, o ∞
    pub fn mun_texto(&self, i: usize) -> String { match (self.limitada, mun_de(&ARMAS[i])) { (true, Some(m)) => self.res[m].to_string(), _ => "∞".into() } }
    /// un número al azar entre 0 y 1
    pub fn azar01(&mut self) -> f32 { (self.azar() % 10000) as f32 / 10000.0 }
    fn azar(&mut self) -> u32 { self.azar = self.azar.wrapping_mul(1664525).wrapping_add(1013904223); self.azar >> 16 }
}

#[cfg(test)]
mod pruebas_municion {
    use super::*;
    /// la munición limitada: recargar toma de la reserva lo que falta; sin reserva no recarga; las cajas la llenan
    #[test]
    fn municion_limitada() {
        let mut a = Armas { balas: ARMAS.iter().map(|d| d.car).collect(), ..Default::default() };
        let i = ARMAS.iter().position(|d| d.n == "Pistol").unwrap(); a.i = i; let car = ARMAS[i].car;
        a.limitada = true; a.mun_reiniciar(); assert_eq!(a.res[0], 60);
        a.balas[i] = 2; a.recargar(1.0); for _ in 0..80 { a.relojes(0.02); }
        assert_eq!(a.balas[i], car); assert_eq!(a.res[0], 60 - (car - 2));
        a.res[0] = 0; a.balas[i] = 0; a.recargar(1.0); assert!(a.recargando <= 0.0, "sin reserva no recarga");
        a.mun_caja(Some(0)); assert_eq!(a.res[0], 20); a.mun_caja(None); assert_eq!(a.res[0], 80); assert_eq!(a.res[6], 2 + 3);
        assert_eq!(a.mun_texto(i), "80"); a.limitada = false; assert_eq!(a.mun_texto(i), "∞");
    }
}
