//! El jugador, como jugador.js de la versión web (las mismas cuentas, para que se juegue igual): una cápsula de esferas
//! de radio 0,45 (los pies a 0,95 m del centro, los ojos a 1,67 m de los pies), camina a 6 m/s (corre ×1,35, agachado
//! ×0,5), salta 1,1 m, sube escalones de 0,45 m como Source, se pega a las rampas al bajar y choca con los triángulos y
//! los cuerpos fijos del mapa. La cámara: los ojos con la hundida al caer, el balanceo al caminar y el agacharse suave.
//! En el agua (aguaJugador de agua.js): a la cintura camina más lento, con el pecho abajo nada hacia donde mira, el aire dura
//! 12 s bajo el agua y después ahoga, y se sale saltando contra un borde bajo. Lo que todavía no: los vehículos y los objetos
//! sueltos (llegan con sus etapas).
use crate::mundo::{add, dot, esc, largo, Mundo, V};

const GRAV: f32 = 9.81;

/// lo que pide el jugador este paso: moverse (x: a la derecha, y: adelante, de -1 a 1), saltar, agacharse, correr
#[derive(Clone, Copy, Default, Debug)]
pub struct Entrada { pub x: f32, pub y: f32, pub saltar: bool, pub agachar: bool, pub correr: bool }

pub struct Jugador {
    pub pos: V, pub vel: V, pub yaw: f32, pub pitch: f32,
    pub suelo: bool, pub suelo_n: V,
    pub radio: f32, pub medio: f32,
    pub vel_max: f32, pub acel: f32, pub salto: f32,
    /// las esferas del cuerpo (alto sobre el centro, si es el pie) parado y agachado
    esf: Vec<(f32, bool)>, esf_ag: Vec<(f32, bool)>,
    pub ojo_alto: f32, ojo_ag: f32, pub tam: f32,
    tiempo_suelo: f32, t_aire: f32, reloj: f32, salto_t: f32,
    ag_col: bool, pub agachado: bool,
    pub noclip: bool,
    // la cámara
    ojo_esc: f32, caida_v: f32, caida_p: f32, bob: f32, bob_k: f32, ag_k: f32,
    /// la gravedad propia del jugador (la de un mod), por la del mapa
    pub grav: f32,
    /// el último golpe al caer (velocidad), para el sonido y el temblor
    pub golpe: f32,
    /// el agua del mapa (cajas: x0, y0, z0, x1, y1, z1 —hasta arriba—), si nada, cuánta agua tiene encima de los pies, lo
    /// que frena el agua al caminar, el aire que le queda y la vida
    pub aguas: Vec<[f32; 6]>, pub nada: bool, pub hondo: f32, pub vadeo: f32, pub aire: f32, ahogo_t: f32, tiempo_salida: f32, pub vida: f32,
}

impl Default for Jugador { fn default() -> Self { Jugador::nuevo() } }

impl Jugador {
    pub fn nuevo() -> Jugador {
        let mut j = Jugador { pos: [0.0, 5.0, 0.0], vel: [0.0; 3], yaw: 0.0, pitch: 0.0, suelo: false, suelo_n: [0.0, 1.0, 0.0], radio: 0.45, medio: 0.5,
            vel_max: 6.0, acel: 18.0, salto: 1.1, esf: vec![(-0.5, true), (0.0, false), (0.5, false)], esf_ag: vec![], ojo_alto: 1.67, ojo_ag: 0.0, tam: 1.0,
            tiempo_suelo: 0.0, t_aire: 0.0, reloj: 0.0, salto_t: -9.0, ag_col: false, agachado: false, noclip: false,
            ojo_esc: 0.0, caida_v: 0.0, caida_p: 0.0, bob: 0.0, bob_k: 0.0, ag_k: 0.0, grav: 1.0, golpe: 0.0,
            aguas: vec![], nada: false, hondo: 0.0, vadeo: 1.0, aire: 12.0, ahogo_t: 0.0, tiempo_salida: 0.0, vida: 100.0 };
        j.ag_esf(); j
    }
    /// agachado (como GMod: el cuerpo mide la mitad y los ojos van bien abajo): jugadorAgEsf
    fn ag_esf(&mut self) {
        let pie = -self.medio - self.radio; let tope = self.esf.last().map(|e| e.0).unwrap_or(0.0) + self.radio;
        let tope_ag = pie + (tope - pie) * 0.5; let alto = tope_ag - self.radio;
        self.esf_ag = if alto > -self.medio + 1e-3 { vec![(-self.medio, true), (alto, false)] } else { vec![(-self.medio, true)] };
        self.ojo_ag = (self.ojo_alto * 0.44).min(tope_ag - pie - 0.18);
    }

    /// aparecer en un punto (sobre el piso, como jugadorAparecer)
    pub fn aparecer(&mut self, m: &Mundo, p: V, yaw: Option<f32>) {
        self.pos = [p[0], p[1] + 1.2, p[2]]; self.vel = [0.0; 3];
        if let Some(y) = yaw { self.yaw = y; }
        self.pitch = 0.0;
        if let Some(h) = m.rayo([self.pos[0], self.pos[1] - self.medio, self.pos[2]], [0.0, -1.0, 0.0], 2.5) {
            if h.n[1] > 0.6 && h.t > self.radio { self.pos[1] -= h.t - self.radio; self.suelo = true; }
        }
    }

    /// saca una esfera (centro c, radio r) del mapa: triángulos y cuerpos fijos (esferaFuera)
    fn esfera_fuera(&mut self, m: &Mundo, c: &mut V, r: f32, corr: &mut V, es_pie: bool, ts: &mut Vec<u32>, cs: &mut Vec<u32>) {
        m.cerca(c[0] - r, c[2] - r, c[0] + r, c[2] + r, ts, cs);
        for &t in ts.iter() {
            // (lejos del plano del triángulo no lo toca)
            let n0 = m.normal(t); let a = m.vert(t, 0);
            let pl = n0[0] * (c[0] - a[0]) + n0[1] * (c[1] - a[1]) + n0[2] * (c[2] - a[2]);
            if pl >= r || pl <= -r { continue; }
            let p = m.tri_cercano(t, *c);
            let (dx, dy, dz) = (c[0] - p[0], c[1] - p[1], c[2] - p[2]); let d2 = dx * dx + dy * dy + dz * dz;
            if d2 >= r * r { continue; }
            let d = d2.sqrt();
            let n = if d > 1e-6 { [dx / d, dy / d, dz / d] } else { n0 };
            let k = r - d;
            // (los pies sobre piso caminable se sacan sólo para arriba: si no, parado en una loma se va resbalando)
            if es_pie && n[1] > 0.6 { let kv = k / n[1]; c[1] += kv; corr[1] += kv; self.suelo = true; self.suelo_n = n; }
            else { for e in 0..3 { c[e] += n[e] * k; corr[e] += n[e] * k; } }
        }
        for &b in cs.iter() {
            let a = m.cuerpos[b as usize].aabb;
            if c[0] + r < a[0] || c[0] - r > a[3] || c[1] + r < a[1] || c[1] - r > a[4] || c[2] + r < a[2] || c[2] - r > a[5] { continue; }
            let Some((n, d)) = m.fuera_de_cuerpo(b as usize, *c, r) else { continue };
            if es_pie && n[1] > 0.6 { let kv = d / n[1]; c[1] += kv; corr[1] += kv; }
            else { for e in 0..3 { c[e] += n[e] * d; corr[e] += n[e] * d; } }
            if es_pie && n[1] > 0.6 { self.suelo = true; self.suelo_n = n; }
        }
    }

    /// moverse en pasos chicos y sacar la cápsula de lo que toque (jugadorMoverChocar)
    fn mover_chocar(&mut self, m: &Mundo, dt: f32, tramo: f32) {
        let pasos = ((largo(self.vel) * dt / tramo).ceil() as usize).max(1);
        self.suelo = false;
        let esf = if self.ag_col { self.esf_ag.clone() } else { self.esf.clone() };
        let (mut ts, mut cs) = (Vec::with_capacity(64), Vec::with_capacity(8));
        for _ in 0..pasos {
            self.pos = add(self.pos, esc(self.vel, dt / pasos as f32));
            for _ in 0..2 {
                let mut corr = [0.0f32; 3];
                for &(dy, pie) in &esf {
                    let mut p = [self.pos[0], self.pos[1] + dy, self.pos[2]];
                    let r = self.radio;
                    self.esfera_fuera(m, &mut p, r, &mut corr, pie, &mut ts, &mut cs);
                    self.pos = [p[0], p[1] - dy, p[2]];
                }
                // quitar la velocidad que va contra lo que chocó
                let cl = largo(corr);
                if cl > 1e-5 { let n = esc(corr, 1.0 / cl); let vn = dot(self.vel, n); if vn < 0.0 { self.vel = add(self.vel, esc(n, -vn)); } } else { break; }
            }
        }
    }

    /// ¿se puede parar? (agachado bajo un techo se queda agachado hasta salir)
    fn cabe_parado(&mut self, m: &Mundo) -> bool {
        let ya = self.esf_ag.last().map(|e| e.0).unwrap_or(0.0);
        let (mut ts, mut cs) = (vec![], vec![]);
        let (suelo, sn) = (self.suelo, self.suelo_n);
        let esf = self.esf.clone(); let mut ok = true;
        for (dy, _) in esf {
            if dy <= ya + 1e-3 { continue; }
            let mut c = [self.pos[0], self.pos[1] + dy, self.pos[2]]; let mut corr = [0.0; 3];
            let r = self.radio * 0.96;
            self.esfera_fuera(m, &mut c, r, &mut corr, false, &mut ts, &mut cs);
            if largo(corr) > 0.01 { ok = false; break; }
        }
        self.suelo = suelo; self.suelo_n = sn; ok
    }

    /// el agua en (x, y, z): la caja que la tiene (aguaEn)
    fn agua_en(&self, x: f32, y: f32, z: f32) -> Option<[f32; 6]> {
        self.aguas.iter().copied().find(|v| v[4] > v[1] + 0.002 && y >= v[1] - 0.02 && y <= v[4] && x >= v[0] && x <= v[3] && z >= v[2] && z <= v[5])
    }
    /// el jugador en el agua (aguaJugador): devuelve si nada (entonces ya se movió)
    fn agua_paso(&mut self, m: &Mundo, dt: f32, ent: &Entrada) -> bool {
        let pies = self.pos[1] - 0.95; let alto = 1.9 * self.tam; let v = self.agua_en(self.pos[0], pies + 0.02, self.pos[2]);
        self.hondo = v.map(|v| (v[4] - pies).max(0.0)).unwrap_or(0.0); let ojos = pies + self.ojo_alto;
        self.vadeo = 1.0 - 0.45 * (self.hondo / (0.62 * alto)).clamp(0.0, 1.0);   // (con el agua a la cintura, 55 % más lento)
        // el aire: con los ojos bajo el agua dura 12 s; después se ahoga de a 10 por segundo, como en HL2
        if let Some(v) = v.filter(|v| ojos < v[4] - 0.03) {
            let _ = v; self.aire -= dt;
            if self.aire < 0.0 { self.ahogo_t -= dt; if self.ahogo_t <= 0.0 { self.ahogo_t = 1.0; self.vida -= 10.0; } }
        } else { self.aire = (self.aire + dt * 4.0).min(12.0); self.ahogo_t = 0.0; }
        self.nada = v.is_some() && self.hondo > 0.66 * alto && !self.noclip;   // (el agua pasa el pecho)
        if !self.nada { return false; }
        let v = v.unwrap();
        // como en Source: se nada hacia donde mira la cámara; el salto sube y agacharse baja (hasta 20° para abajo se sigue
        // por la superficie: en el celular la cámara casi nunca queda derecha)
        let fv = [self.yaw.sin() * self.pitch.cos(), self.pitch.sin(), self.yaw.cos() * self.pitch.cos()]; let rgt = [-self.yaw.cos(), 0.0, self.yaw.sin()];
        let dz = 0.34; let fy = if fv[1].abs() < dz { 0.0 } else { (fv[1] - fv[1].signum() * dz) / (1.0 - dz) };
        let mut w = [fv[0] * ent.y + rgt[0] * ent.x, fy * ent.y + if ent.saltar { 1.0 } else { 0.0 } - if ent.agachar { 1.0 } else { 0.0 }, fv[2] * ent.y + rgt[2] * ent.x];
        let wl = largo(w).min(1.0); if wl > 1e-3 { w = esc(w, 1.0 / largo(w)); }
        let vm = self.vel_max * 0.62 * if ent.correr { 1.3 } else { 1.0 };
        let mut ty = w[1] * vm * wl;
        // (sin apretar nada flota con la cara justo afuera; nadando derecho cerca de la superficie, se queda ahí)
        if wl < 0.05 || (w[1].abs() < 0.05 && ojos > v[4] - 0.45) { ty = ((v[4] + 0.12 - ojos) * 2.2).clamp(-0.8, 1.6); }
        if ojos > v[4] + 0.3 && ty > 0.0 { ty = 0.0; }
        let kv = (dt * (3.2 + self.vel[1].abs() * 0.9)).min(1.0);   // (al caer rápido el agua frena enseguida)
        self.vel[0] += (w[0] * vm * wl - self.vel[0]) * kv; self.vel[1] += (ty - self.vel[1]) * kv; self.vel[2] += (w[2] * vm * wl - self.vel[2]) * kv;
        // salir del agua: con el salto, en la superficie y contra un borde a menos de un metro sobre el agua
        if ent.saltar && ojos > v[4] - 0.35 && self.tiempo_salida <= 0.0 {
            let f = [self.yaw.sin(), 0.0, self.yaw.cos()];
            let pared = m.rayo([self.pos[0], v[4] - 0.1, self.pos[2]], f, self.radio + 0.6).is_some();
            let libre = m.rayo([self.pos[0], v[4] + 1.05, self.pos[2]], f, self.radio + 0.7).is_none();
            if pared && libre { self.vel = [f[0] * 2.2, 6.4, f[2] * 2.2]; self.tiempo_salida = 0.6; }
        }
        self.tiempo_salida -= dt;
        self.mover_chocar(m, dt, 0.25);
        self.tiempo_suelo = 0.0; self.bob_k *= (-dt * 8.0).exp();
        true
    }

    /// un paso de la física del jugador (jugadorPaso)
    pub fn paso(&mut self, m: &Mundo, dt: f32, ent: &Entrada) {
        self.reloj += dt; self.golpe = 0.0;
        if !self.aguas.is_empty() && !self.noclip && self.agua_paso(m, dt, ent) { return; }
        let (sy, cy) = (self.yaw.sin(), self.yaw.cos());
        // (adelante +Z girado; la derecha es -X girado, como en el juego)
        let f = [sy, 0.0, cy]; let rgt = [-cy, 0.0, sy];
        let mut wish = [f[0] * ent.y + rgt[0] * ent.x, 0.0, f[2] * ent.y + rgt[2] * ent.x];
        let wl = largo(wish).min(1.0); if wl > 1e-3 { wish = esc(wish, 1.0 / largo(wish)); }
        if ent.agachar || self.noclip { self.ag_col = !self.noclip && ent.agachar; } else if self.ag_col && self.cabe_parado(m) { self.ag_col = false; }
        let agachado = ent.agachar || self.ag_col; self.agachado = agachado;
        let vmax = self.vel_max * if ent.correr { 1.35 } else { 1.0 } * if agachado { 0.5 } else { 1.0 } * self.vadeo;
        if self.noclip {
            let fv = [self.yaw.sin() * self.pitch.cos(), self.pitch.sin(), self.yaw.cos() * self.pitch.cos()];
            let sube = if ent.saltar { 1.0 } else { 0.0 } - if ent.agachar { 1.0 } else { 0.0 };
            self.vel = [(fv[0] * ent.y + rgt[0] * ent.x) * vmax * 2.0, (fv[1] * ent.y + sube) * vmax * 2.0, (fv[2] * ent.y + rgt[2] * ent.x) * vmax * 2.0];
            self.pos = add(self.pos, esc(self.vel, dt)); return;
        }
        let acel = if self.suelo { self.acel } else { self.acel * 0.35 };
        let (tx, tz) = (wish[0] * vmax * wl, wish[2] * vmax * wl);
        let (dvx, dvz) = (tx - self.vel[0], tz - self.vel[2]); let dl = (dvx * dvx + dvz * dvz).sqrt();
        let mx = acel * dt * if self.suelo || wl > 0.0 { 1.0 } else { 0.2 };
        if dl > 0.0 { let k = (mx / dl).min(1.0); self.vel[0] += dvx * k; self.vel[2] += dvz * k; }
        let g = GRAV * m.gravedad * self.grav;
        // (también recién despegado del piso, 0,12 s: en una escalera el pie toca las puntas y no siempre está «en el piso»)
        if ent.saltar && ((self.suelo && self.tiempo_suelo > 0.05) || (!self.suelo && self.t_aire < 0.12 && self.reloj - self.salto_t > 0.4 && self.vel[1] < 1.0)) {
            self.vel[1] = (2.0 * g.abs() * self.salto).sqrt() * if g < 0.0 { -1.0 } else { 1.0 }; self.suelo = false; self.tiempo_suelo = 0.0; self.salto_t = self.reloj;
        }
        if !self.suelo { self.vel[1] -= g * dt; } else if self.vel[1] < 0.0 { self.vel[1] = -0.5; }
        let (vy_antes, era_suelo) = (self.vel[1], self.suelo);
        let (p0, v0) = (self.pos, self.vel);
        self.mover_chocar(m, dt, 0.25);
        if !ent.saltar && (era_suelo || (self.t_aire < 0.25 && self.vel[1] < 1.0)) { self.escalon(m, dt, p0, v0, tx, tz); }
        // (caminando —sin haber saltado—, chocar con la punta de un escalón no lanza para arriba)
        if !ent.saltar && self.reloj - self.salto_t > 0.35 && (era_suelo || self.t_aire < 0.25) && g > 0.0 && self.vel[1] > 0.0 { self.vel[1] = 0.0; }
        self.t_aire = if self.suelo { 0.0 } else { self.t_aire + dt };
        // pegarse al piso al bajar rampas (si estaba en el piso y no saltó)
        if !self.suelo && era_suelo && self.vel[1] <= 0.0 {
            if let Some(h) = m.rayo([self.pos[0], self.pos[1] - self.medio, self.pos[2]], [0.0, -1.0, 0.0], self.radio + 0.35) {
                if h.n[1] > 0.6 { self.pos[1] -= h.t - self.radio; self.suelo = true; self.vel[1] = -0.5; self.mover_chocar(m, 0.0, 0.25); self.suelo = true; }
            }
        }
        if self.suelo { self.tiempo_suelo += dt; if wl < 0.01 { let k = (-dt * 12.0).exp(); self.vel[0] *= k; self.vel[2] *= k; } } else { self.tiempo_suelo = 0.0; }
        // la cámara: golpe al caer y balanceo al caminar
        if !era_suelo && self.suelo && vy_antes < -3.0 { self.caida_v = self.caida_v.max((-vy_antes * 0.36).min(3.0)); self.golpe = -vy_antes; }
        let vh = (self.vel[0] * self.vel[0] + self.vel[2] * self.vel[2]).sqrt();
        if self.suelo { self.bob += vh * dt * 1.75; }
        self.bob_k += ((if self.suelo { (vh / 6.0).min(1.0) } else { 0.0 }) - self.bob_k) * (dt * 8.0).min(1.0);
        self.ag_k += ((if agachado { 1.0 } else { 0.0 }) - self.ag_k) * (dt * 12.0).min(1.0);
    }

    /// subir un escalón (como Source: StepSize de 0,45 m): si el paso avanzó menos del 92 % de lo que quería, se prueba
    /// subir, avanzar y bajar; si así avanza más y queda parado en piso caminable, vale ese (jugadorEscalon)
    fn escalon(&mut self, m: &Mundo, dt: f32, p0: V, v0: V, tx: f32, tz: f32) {
        let quiere_mas = (tx * tx + tz * tz).sqrt() > (v0[0] * v0[0] + v0[2] * v0[2]).sqrt();
        let (vx, vz) = if quiere_mas { (tx, tz) } else { (v0[0], v0[2]) };
        let quiero = (vx * vx + vz * vz).sqrt() * dt; if quiero < 1e-4 || self.noclip { return; }
        let hecho = ((self.pos[0] - p0[0]).powi(2) + (self.pos[2] - p0[2]).powi(2)).sqrt(); if hecho > quiero * 0.92 { return; }
        let (gp, gv, gn, gs) = (self.pos, self.vel, self.suelo_n, self.suelo);
        let alto = 0.45 * self.tam.clamp(0.6, 1.0);
        self.pos = p0; self.vel = [0.0, alto / dt, 0.0]; self.mover_chocar(m, dt, 0.25);
        let subio = self.pos[1] - p0[1];
        if subio > 0.04 {
            self.vel = [vx, 0.0, vz]; self.mover_chocar(m, dt, 0.25);
            // (la bajada en pasitos de 4 cm: de a más el pie atravesaba la punta del escalón)
            self.vel = [0.0, -(subio + 0.06) / dt, 0.0]; self.mover_chocar(m, dt, 0.04);
            let avance = ((self.pos[0] - p0[0]).powi(2) + (self.pos[2] - p0[2]).powi(2)).sqrt(); let dh = self.pos[1] - p0[1];
            if self.suelo && avance > hecho + quiero * 0.08 && dh > -0.02 && dh < alto + 0.02 { self.vel = [vx, -0.5, vz]; self.ojo_esc += dh.max(0.0); return; }
        }
        self.pos = gp; self.vel = gv; self.suelo_n = gn; self.suelo = gs;
    }

    /// dónde van los ojos este cuadro (con la hundida al caer, el balanceo y el agacharse suave), y la inclinación del
    /// balanceo (jugadorCamara, primera persona)
    pub fn ojos(&mut self, dt: f32) -> (V, f32) {
        let dt = dt.clamp(0.0, 0.05);
        self.caida_v += (-self.caida_p * 90.0 - self.caida_v * 13.0) * dt; self.caida_p += self.caida_v * dt;
        let ag = if self.noclip { 0.0 } else { self.ag_k };
        let dy = -self.caida_p * 0.45 + self.bob.sin().abs() * 0.035 * self.bob_k - 0.015 * self.bob_k;
        self.ojo_esc *= (-dt * 10.0).exp();
        let oy = self.pos[1] - 0.95 + self.ojo_alto + (self.ojo_ag - self.ojo_alto) * ag + dy - self.ojo_esc;
        ([self.pos[0], oy, self.pos[2]], self.bob.sin() * 0.006 * self.bob_k)
    }
}
