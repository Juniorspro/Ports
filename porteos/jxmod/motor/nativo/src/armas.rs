//! Las armas, como armas.js: la Physics Gun (en el celular un toque agarra y otro suelta; el «2» congela lo agarrado o
//! descongela lo que se mira; con «Girar» el arrastre gira el objeto; + y − lo alejan y acercan) y la Gravity Gun (el «2»
//! levanta y suelta, el disparo lanza lo agarrado o empuja lo que se mira). Las cuentas son las de fisicaPaso, gravPaso,
//! agarrarFisica, soltarAgarre, gravPrimario y gravSecundario. Lo que suena lo junta en `sonidos` (el juego lo toca).
use jxjuego::fisica::{qeje, qmul, rot, rot_inv, Fisica, Q, V};
use jxjuego::mundo::Mundo;

/// las armas: el nombre (DEF_ARMAS), el que se muestra, el ícono, el sonido al sacarla y el de sostener
pub struct DefArma { pub n: &'static str, pub nom: &'static str, pub ic: &'static str, pub s_sacar: &'static str, pub s_sosten: &'static str }
pub const ARMAS: [DefArma; 2] = [
    DefArma { n: "PhysicsGun", nom: "Physics Gun", ic: "W_PhysGun", s_sacar: "genericReadyNew_1", s_sosten: "PG_Hold" },
    DefArma { n: "GravityGun", nom: "Gravity Gun", ic: "W_GravGun", s_sacar: "GG_Open", s_sosten: "GG_Hold" },
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
    azar: u32,
}

fn v64(a: [f32; 3]) -> V { [a[0] as f64, a[1] as f64, a[2] as f64] }
fn qconj(q: Q) -> Q { [-q[0], -q[1], -q[2], q[3]] }

impl Armas {
    pub fn def(&self) -> &'static DefArma { &ARMAS[self.i.min(ARMAS.len() - 1)] }
    fn son(&mut self, n: &str, v: f32) { self.sonidos.push((n.to_string(), v)); }
    /// elegirArma: suelta lo que tenía y saca la otra
    pub fn elegir(&mut self, fis: &mut Fisica, i: usize) {
        self.soltar(fis, false); self.soltar_grav(fis);
        self.i = i.min(ARMAS.len() - 1); self.barra_t = 0.0;
        let s = self.def().s_sacar; self.son(s, 0.6);
    }
    /// el disparo (en el celular, al apoyar el dedo)
    pub fn disparo(&mut self, fis: &mut Fisica, mundo: &Mundo, ojo: [f32; 3], dir: [f32; 3], yaw: f32) {
        match self.def().n {
            "PhysicsGun" => { if self.agarre.is_some() { self.soltar(fis, false); } else { self.agarrar(fis, mundo, ojo, dir, yaw); } }
            _ => self.grav_primario(fis, mundo, ojo, dir),
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
            _ => self.grav_secundario(fis, mundo, ojo, dir),
        }
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
            self.son(&lanza, 0.7); return;
        }
        if let Some(id) = fis.rayo(mundo, v64(ojo), f, 10.0, &[]).and_then(|h| h.cuerpo) {
            if let Some(b) = fis.cuerpo_mut(id) { if b.dinamico() { b.despertar(); let k = (1500.0 / b.masa.max(10.0)).min(50.0); for e in 0..3 { b.vel[e] += f[e] * k; } self.son(&lanza, 0.7); return; } }
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
    pub fn sosten(&self) -> Option<&'static str> { if self.agarre.is_some() || self.grav.is_some() { Some(self.def().s_sosten) } else { None } }
    /// otro mapa: nada agarrado
    pub fn olvidar(&mut self) { self.agarre = None; self.grav = None; self.rotar = false; }
    fn azar(&mut self) -> u32 { self.azar = self.azar.wrapping_mul(1664525).wrapping_add(1013904223); self.azar >> 16 }
}
