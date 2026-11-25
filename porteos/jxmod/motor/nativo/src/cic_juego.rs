//! El Cíclope (ciclope.js; la Opción «Cíclope» de Props: el modelo Ciclope y un botón rojo). Tocarlo tira un láser suave
//! desde los ojos (empuja y lastima poco); mantenerlo 1 s lanza la definitiva: una cinemática de 6 s (cae de rodillas,
//! se levanta, se saca los lentes y grita) y 15 s de rayo que destruye todo lo que toca, con el ambiente rojo; si el rayo
//! agarra a alguien lo hace volar y al final lo revienta. Después, 20 s de espera. Lo de la red (que lo vea la sala y la
//! víctima que es otro jugador) no está.
use super::*;

const CARGA: f32 = 1.0; const CINE: f32 = 6.0; const FURIA: f32 = 15.0; const PEGA: f32 = 3.2; const ESPERA: f32 = 20.0; const LARGO: f32 = 400.0;
/// los ojos en el espacio del hueso de la cabeza: medio ancho entre ojos, alto, adelante (párpado), plano de los lentes y
/// tamaño de la cabeza (CIC_OJO)
fn ojo_de(skin: &str) -> [f32; 5] { if skin == "Ciclope" { [0.025, 0.0447, 0.141, 0.173, 1.11] } else { [0.032, 0.03, 0.13, 0.16, 1.0] } }

/// la definitiva (U): dónde y hacia dónde estaba, cuándo empezó, el rayo (dirección, adonde va y dónde pega), la
/// explosión de la punta, el agarrado (NPC y desde cuándo), a quién ignora, cómo estaba la cámara y el arma
pub struct Ult { pos: V, yaw: f32, t0: f32, pub dir: V, dir_meta: Option<V>, hit: Option<V>, t_exp: f32, vic: Option<(u32, f32)>, sin_pegar: f32, ignora: Option<(u32, f32)>, encendido: bool, terc: u8, arma: usize }
/// los lentes tirados (cicPiso): dónde, la velocidad, el giro y si ya están quietos
struct Piso { p: V, v: V, q: Q, quieto: bool }
#[derive(Default)]
pub struct Cic {
    pub apretado: bool, carga: f32, usada: bool, espera: f32, t_laser: f32,
    /// los láseres suaves: de dónde, adónde, cuánto lleva y dura
    rayos: Vec<(V, V, f32, f32)>,
    pub ult: Option<Ult>,
    /// el ambiente rojo (CIC.rojo) y la ayuda ya mostrada; las manos arriba (víctima: no en la nativa sola)
    pub rojo: f32, pub ayudo: bool, pub manos: bool, piso: Option<Piso>,
}
impl Cic { pub fn mia(&self) -> bool { self.ult.is_some() } }
/// el marco de la cabeza (cicMarco): el centro, el giro, la escala y los ojos
#[derive(Clone, Copy)]
pub struct Cabeza { pub c: V, pub q: Q, pub s: f32, pub o: [f32; 5] }
impl Cabeza {
    pub fn en(&self, x: f32, y: f32, z: f32) -> V { add(self.c, qrot(self.q, [x * self.s, y * self.s, z * self.s])) }
    pub fn ojo(&self) -> V { self.en(0.0, self.o[1], self.o[2]) }
    pub fn fw(&self) -> V { qrot(self.q, [0.0, 0.0, 1.0]) }
}
fn cabeza_de(m: &M4, skin: &str) -> Cabeza { Cabeza { c: pos_de(m), q: m4quat(m), s: largo([m[0], m[1], m[2]]), o: ojo_de(skin) } }

impl Juego {
    fn cic_hay(&self) -> bool { self.jg.activo("ciclope") }
    /// el cuerpo del jugador en el mundo (personaje::base, como lo dibuja el juego)
    fn cic_base(&self) -> M4 { personaje::base([self.jug.pos[0], self.jug.pos[1] - 0.95, self.jug.pos[2]], self.jug.yaw) }
    /// la cabeza del jugador en el mundo (con los huesos del último cuadro)
    pub(super) fn cic_cabeza(&self) -> Option<Cabeza> { let pj = self.pj.as_ref()?; let h = pj.hueso("Head")?; Some(cabeza_de(&m4::mul(&self.cic_base(), &h), &pj.skin)) }
    /// cicOrigen: de dónde sale el rayo (en primera persona, de la cámara, un poco abajo)
    fn cic_origen(&self) -> V {
        if self.camara == 0 && !self.jg.cic.mia() { let (c, f) = (self.jg.cam_ult, self.jg.mira_ult); let arr = norm(cruz(cruz(f, [0.0, 1.0, 0.0]), f)); return add(add(c, esc(f, 0.7)), esc(arr, -0.13)); }
        self.cic_cabeza().map(|h| add(h.ojo(), esc(h.fw(), 0.03))).unwrap_or(add(self.jug.pos, [0.0, 0.6, 0.0]))
    }
    /// cicMira: lo que hay en el centro de la pantalla
    fn cic_mira(&mut self) -> V {
        let (c, f) = (self.jg.cam_ult, self.jg.mira_ult);
        let t = self.mapa.as_ref().and_then(|mp| self.fis.rayo(&mp.mundo, v64(c), v64(f), LARGO as f64, &[])).map(|g| g.t as f32).unwrap_or(LARGO); add(c, esc(f, t))
    }
    fn cic_rayo(&mut self, o: V, d: V, max: f32) -> Option<(f32, V, V, Option<u32>)> {
        let mp = self.mapa.as_ref()?; let g = self.fis.rayo(&mp.mundo, v64(o), v64(d), max as f64, &[])?; Some((g.t as f32, add(o, esc(d, g.t as f32)), v32(g.n), g.cuerpo))
    }
    /// cicApretar: apretar empieza la carga (mantener 1 s: la definitiva); soltar antes, el láser suave
    pub(super) fn cic_apretar(&mut self, si: bool) {
        let hay = self.jg.activo("ciclope"); let c = &mut self.jg.cic;
        if si { if c.apretado || !hay { return; } c.apretado = true; c.carga = 0.0; c.usada = false; return; }
        if !c.apretado { return; } c.apretado = false;
        if !c.usada && !c.mia() { self.cic_laser(); }
    }
    /// cicLaser: un láser suave desde los ojos hacia la mira (empuja y lastima poco)
    fn cic_laser(&mut self) {
        if !self.cic_hay() || self.jg.cic.t_laser > 0.0 || self.jug.vida <= 0.0 || self.vehs.jugador.is_some() { return; }
        self.jg.cic.t_laser = 0.28;
        let o = self.cic_origen(); let d = norm(sub(self.cic_mira(), o)); let h = self.cic_rayo(o, d, 120.0); let p = h.map(|x| x.1).unwrap_or(add(o, esc(d, 120.0)));
        self.jg.cic.rayos.push((o, p, 0.0, 0.3)); self.cic_son_laser(o);
        if let Some((_, p, n, cu)) = h {
            self.ef.impacto(p, n, Sup::Mundo); self.ef.luz_temporal(p, 5.0, [8.0, 0.6, 0.3], 0.25);
            if let Some(c) = cu {
                if let Some(nid) = self.npcs.de_cuerpo(c) { self.npcs.danar(nid, 14.0, p, d, &mut self.fis, Some(npc::Quien::Jugador)); }
                else if let Some(i) = self.objs.iter().position(|o| o.cuerpo == Some(c)) { self.danar_objeto(i, 18.0); if let Some(b) = self.fis.cuerpo_mut(c) { if b.dinamico() { let k = (400.0 / b.masa as f32).min(9.0); for e in 0..3 { b.vel[e] += (d[e] * k) as f64; } b.despertar(); } } }
            }
        }
    }
    /// cicDefinitiva: de rodillas, la cinemática y el rayo
    fn cic_definitiva(&mut self) {
        if self.jg.cic.mia() || self.jug.vida <= 0.0 { return; }
        if self.vehs.jugador.is_some() { if let Some(mp) = self.mapa.as_ref() { if let Some(sl) = self.vehs.salir(&self.fis, &mp.mundo) { self.jug.pos = v32(sl.pos); self.jug.vel = [0.0; 3]; } } }
        if self.jg.nat.volando { self.nat_volar(false); } if self.jg.nat.scp { self.nat_scp(false); } if self.jg.nat.rag.is_some() { self.nat_rag(false); }
        self.armas.soltar(&mut self.fis, false); self.hacer_emote(None);
        let f = [self.jug.yaw.sin(), 0.0, self.jug.yaw.cos()];
        self.jg.cic.ult = Some(Ult { pos: self.jug.pos, yaw: self.jug.yaw, t0: self.jg.t, dir: norm(add(esc(f, 0.55), [0.0, 0.84, 0.0])), dir_meta: None, hit: None, t_exp: 0.0, vic: None, sin_pegar: 0.0, ignora: None, encendido: false, terc: self.camara, arma: self.armas.i });
        self.camara = 1; self.jg.cic.piso = None;
        if let Some(k) = ARMAS.iter().position(|d| d.n == "Hands") { self.armas.elegir(&mut self.fis, k); }
    }
    /// cicTerminar: la cámara y el arma como estaban, y 20 s de espera
    fn cic_terminar(&mut self) {
        let Some(u) = self.jg.cic.ult.take() else { return };
        self.camara = u.terc; self.jg.cic.espera = ESPERA; self.armas.elegir(&mut self.fis, u.arma);
    }
    /// cicFin: apagar todo (se apagó la Opción, otro mapa)
    pub(super) fn cic_fin(&mut self) { self.cic_terminar(); self.jg.cic.rayos.clear(); self.jg.cic.apretado = false; self.jg.cic.rojo = 0.0; }
    /// de rodillas en la definitiva no camina
    pub(super) fn cic_quieto(&self) -> bool { self.jg.cic.mia() }
    /// cicPaso: el botón (la carga), la definitiva, los láseres suaves y el ambiente rojo
    pub(super) unsafe fn cic_paso(&mut self, _m: &mut Motor3d, dt: f32) {
        let hay = self.cic_hay();
        if hay && !self.jg.cic.ayudo { self.jg.cic.ayudo = true; self.avisar("Tocá: láser · Mantené 1 s: definitiva".into()); }
        if !hay { if self.jg.cic.mia() { self.cic_terminar(); } self.jg.cic.apretado = false; }
        let c = &mut self.jg.cic; c.espera = (c.espera - dt).max(0.0); c.t_laser -= dt;
        // (soltó el botón)
        if c.apretado && !self.dedos.iter().any(|d| d.boton == Some(Boton::Jg(Bj::Ciclope))) { self.cic_apretar(false); }
        let c = &mut self.jg.cic;
        if c.apretado {
            c.carga += dt;
            if c.carga >= CARGA && !c.usada { c.usada = true; if c.espera > 0.0 { let e = c.espera.ceil(); self.avisar(format!("Definitiva lista en {e} s")); } else { self.cic_definitiva(); } }
        }
        // (la carga suena mientras dura: un tono que sube)
        if self.jg.cic.apretado && !self.jg.cic.usada { self.sonido.sintetico("CIC_carga", carga_pcm, 48000); self.sonido.bucle("cic_carga", "CIC_carga", 1.0); }
        if self.jg.cic.mia() { self.cic_ult_paso(dt); }
        self.jg.cic.rayos.retain_mut(|r| { r.2 += dt; r.2 < r.3 });
        // el ambiente rojo (mientras dura la definitiva)
        let meta = self.jg.cic.ult.as_ref().map(|u| { let x = self.jg.t - u.t0; ss(4.8, 6.2, x) * (1.0 - ss(CINE + FURIA - 0.4, CINE + FURIA + 1.2, x)) }).unwrap_or(0.0);
        let c = &mut self.jg.cic; c.rojo += (meta - c.rojo) * (dt * 2.5).min(1.0); if c.rojo < 0.002 && meta == 0.0 { c.rojo = 0.0; }
        // (los lentes tirados caen y se quedan)
        if let Some(l) = self.jg.cic.piso.as_mut() { if !l.quieto { l.v[1] -= 9.8 * dt; let s = esc(l.v, dt);
            let h = self.mapa.as_ref().and_then(|mp| mp.mundo.rayo(l.p, norm(s), largo(s) + 0.02)); if let (Some(g), true) = (h, l.v[1] < 0.0) { l.p = add(add(l.p, esc(norm(s), g.t)), [0.0, 0.012, 0.0]); l.quieto = true; l.q = qmul(qeje([0.0, 1.0, 0.0], self.jug.yaw + 0.6), qeje([1.0, 0.0, 0.0], -std::f32::consts::FRAC_PI_2)); }
            else { l.p = add(l.p, s); l.q = qnorm(qmul(l.q, qeje([1.0, 0.3, 0.0], dt * 9.0))); } } }
        self.cic_camara();
    }
    /// cicUltPaso: la definitiva (los lentes, el rayo que sale a los 5,4 s y después va adonde apunto, lo que agarra)
    fn cic_ult_paso(&mut self, dt: f32) {
        let Some(u) = self.jg.cic.ult.as_ref() else { return }; let x = self.jg.t - u.t0;
        if x >= CINE + FURIA { self.cic_terminar(); return; }
        if x >= 4.75 && self.jg.cic.piso.is_none() { if let Some(h) = self.cic_cabeza() { let p0 = self.pj.as_ref().and_then(|pj| pj.hueso("RightHand")).map(|m| pos_de(&m4::mul(&self.cic_base(), &m))).unwrap_or(h.c);
            self.jg.cic.piso = Some(Piso { p: p0, v: add(esc(qrot(qeje([0.0, 1.0, 0.0], self.jug.yaw), [-1.0, 0.0, 0.0]), 0.8), [0.0, 1.2, 0.0]), q: h.q, quieto: false }); } }
        let fuego = x >= 5.4;
        if fuego && !self.jg.cic.ult.as_ref().unwrap().encendido {
            self.jg.cic.ult.as_mut().unwrap().encendido = true; let o = self.cic_origen();
            self.sonido.tocar("GrenadeExplode", 1.6, 0.55, Some(o)); self.temblor = self.temblor.max(0.9); self.ef.luz_temporal(o, 40.0, [60.0, 6.0, 3.0], 1.2);
        }
        // quieto de rodillas; en la cinemática tampoco gira
        let (up, uyaw) = { let u = self.jg.cic.ult.as_ref().unwrap(); (u.pos, u.yaw) };
        self.jug.vel[0] = 0.0; self.jug.vel[2] = 0.0; self.jug.pos[0] = up[0]; self.jug.pos[2] = up[2];
        if x < CINE { self.jug.yaw = uyaw; self.jug.pitch = 0.32; }
        if !fuego { return; }
        self.sonido.sintetico("CIC_rayo", rayo_pcm, 48000); let dc = dist(self.cic_origen(), self.jg.cam_ult); self.sonido.bucle("cic_rayo", "CIC_rayo", (1.4 * (3.0 / dc.max(3.0)).powf(1.1)).min(1.4));
        let o = self.cic_origen();
        if x >= CINE {
            let mira = self.cic_mira(); let mut meta = norm(sub(mira, o)); let t = self.jg.t;
            let vic = { let u = self.jg.cic.ult.as_mut().unwrap(); u.sin_pegar -= dt; u.vic };
            if let Some((v, t0)) = vic { match self.npcs.get(v) { Some(n) if t - t0 <= PEGA => { meta = norm(sub(pecho(n), o)); } _ => { self.cic_soltar(true); } } }
            self.jg.cic.ult.as_mut().unwrap().dir_meta = Some(meta);
        }
        let u = self.jg.cic.ult.as_mut().unwrap(); if let Some(m) = u.dir_meta { u.dir = norm(mezcla(u.dir, m, (dt * if u.vic.is_some() { 9.0 } else { 7.0 }).min(1.0))); }
        let dir = u.dir; let h = self.cic_rayo(o, dir, LARGO); let hit = h.map(|x| x.1).unwrap_or(add(o, esc(dir, LARGO))); self.jg.cic.ult.as_mut().unwrap().hit = Some(hit);
        // si pasa cerca de alguien (a menos de 1,3 m y sin una pared en el medio), lo agarra
        let (vic, sp, ign) = { let u = self.jg.cic.ult.as_ref().unwrap(); (u.vic, u.sin_pegar, u.ignora) };
        if vic.is_none() && sp <= 0.0 && x >= CINE {
            let lim = h.map(|x| x.0).unwrap_or(LARGO); let mut mejor = None; let mut md = 1.3;
            for n in &self.npcs.lista { if !n.vivo || ign.map_or(false, |i| i.0 == n.id && self.jg.t < i.1) || self.jg.nat.rag == Some(n.id) { continue; }
                let c = pecho(n); let t = dot(sub(c, o), dir); if t < 0.8 || t > lim + 1.2 { continue; } let dd = dist(c, add(o, esc(dir, t))); if dd < md { md = dd; mejor = Some(n.id); } }
            if let Some(n) = mejor { self.cic_pegar(n); }
        }
        if let Some(g) = h { self.cic_golpe(g, dt, o); }
        // lo que se ve en la punta: fuego, humo y chispas
        if dist(hit, o) < LARGO - 1.0 {
            for _ in 0..3 { let p = add(hit, [(self.azar() - 0.5) * 0.8, self.azar() * 0.4, (self.azar() - 0.5) * 0.8]); let v = [(self.azar() - 0.5) * 4.0, 2.0 + self.azar() * 5.0, (self.azar() - 0.5) * 4.0]; let (vida, tam, g) = (0.35 + self.azar() * 0.3, 0.5 + self.azar() * 0.5, 0.28 + self.azar() * 0.25);
                self.ef.particula(p, v, vida, tam, [1.0, g, 0.08, 1.0], efx::Tipo::Fuego, 1.1); }
            if self.azar() < 0.35 { let v = [(self.azar() - 0.5) * 2.0, 2.5 + self.azar() * 2.0, (self.azar() - 0.5) * 2.0]; let (vida, tam) = (1.8 + self.azar(), 1.0 + self.azar()); self.ef.particula(add(hit, [0.0, 0.5, 0.0]), v, vida, tam, [0.2, 0.1, 0.09, 0.6], efx::Tipo::Humo, 2.4); }
            for _ in 0..2 { let v = [(self.azar() - 0.5) * 14.0, self.azar() * 10.0, (self.azar() - 0.5) * 14.0]; let vida = 0.4 + self.azar() * 0.4; self.ef.particula(hit, v, vida, 0.04, [1.0, 0.6, 0.3, 1.0], efx::Tipo::Chispa, 0.0); }
        }
    }
    /// cicGolpe: lo que toca el rayo explota, vuela, se rompe; a una persona la agarra
    fn cic_golpe(&mut self, g: (f32, V, V, Option<u32>), dt: f32, _o: V) {
        let (_, p, _, cu) = g; let Some(u) = self.jg.cic.ult.as_ref() else { return }; let (dir, vic, sp) = (u.dir, u.vic, u.sin_pegar);
        let npc_id = cu.and_then(|c| self.npcs.de_cuerpo(c));
        if let (Some(n), None, true) = (npc_id, vic, sp <= 0.0) { if self.jg.nat.rag != Some(n) { self.cic_pegar(n); return; } }
        if let (Some(n), Some((v, _))) = (npc_id, vic) { if n == v {
            // (al agarrado: lo lleva volando)
            let cs: Vec<u32> = self.npcs.get(n).and_then(|x| x.rag.as_ref()).map(|r| r.cuerpos().collect()).unwrap_or_default();
            for c in cs { if let Some(b) = self.fis.cuerpo_mut(c) { let m = add(esc(dir, 17.0), [0.0, 4.5, 0.0]); let k = (dt * 5.0).min(1.0) as f64; for e in 0..3 { b.vel[e] += (m[e] as f64 - b.vel[e]) * k; } b.despertar(); } }
            return;
        } }
        if let Some(c) = cu { if npc_id.is_none() {
            let (a1, a2, a3) = (self.azar() - 0.5, self.azar() - 0.5, self.azar() - 0.5);
            if let Some(b) = self.fis.cuerpo_mut(c) { if b.dinamico() { let k = (3200.0 / b.masa as f32).min(40.0) * dt * 4.0; for e in 0..3 { b.vel[e] += (dir[e] * k) as f64; } b.vel[1] += (9.0 * dt) as f64; b.ang[0] += (a1 * 8.0 * dt) as f64; b.ang[1] += (a2 * 8.0 * dt) as f64; b.ang[2] += (a3 * 8.0 * dt) as f64; b.despertar(); } }
            if self.azar() < dt * 4.0 { if let Some(i) = self.objs.iter().position(|o| o.cuerpo == Some(c)) { self.danar_objeto(i, 40.0); } }
        } }
        let u = self.jg.cic.ult.as_mut().unwrap(); u.t_exp -= dt;
        if u.t_exp <= 0.0 { u.t_exp = 0.3; self.explosion(sub(p, esc(dir, 0.4)), 3.6, 60.0); }
    }
    /// cicPegar: el rayo agarra a alguien: lo tira, lo lastima y grita «no, no, no»
    fn cic_pegar(&mut self, n: u32) {
        let t = self.jg.t; let Some(u) = self.jg.cic.ult.as_mut() else { return }; u.vic = Some((n, t)); let dir = u.dir;
        let Some(p) = self.npcs.get(n).map(|x| x.pos()) else { return };
        self.sonido.tocar("CicNoNo", 1.4, 1.0, Some(p));
        if self.npcs.get(n).map_or(false, |x| x.rag.is_none()) { self.npcs.tumbar(n, add(esc(dir, 14.0), [0.0, 5.0, 0.0]), &mut self.fis); }
        self.npcs.danar(n, 20.0, p, dir, &mut self.fis, Some(npc::Quien::Jugador));
    }
    /// cicSoltar: suelta al agarrado (con `golpe`, el golpe final: explota y 200 de daño)
    fn cic_soltar(&mut self, golpe: bool) {
        let t = self.jg.t; let Some(u) = self.jg.cic.ult.as_mut() else { return }; let v = u.vic.take(); u.sin_pegar = 0.5; let dir = u.dir;
        let Some((n, _)) = v else { return }; u.ignora = Some((n, t + 1.5));
        if !golpe { return; } let Some(c) = self.npcs.get(n).map(pecho) else { return };
        self.explosion(c, 3.0, 120.0); self.npcs.danar(n, 200.0, c, dir, &mut self.fis, Some(npc::Quien::Jugador));
    }
    /// cicCamara: la cinemática (los primeros 6 s) y después sobre el hombro, apuntando con la mira
    fn cic_camara(&mut self) {
        let Some(u) = self.jg.cic.ult.as_ref() else { return }; let x = self.jg.t - u.t0;
        let qy = qeje([0.0, 1.0, 0.0], u.yaw); let (f, izq, up) = (qrot(qy, [0.0, 0.0, 1.0]), qrot(qy, [1.0, 0.0, 0.0]), [0.0, 1.0, 0.0]);
        let hd = self.cic_cabeza(); let hc = hd.map(|h| h.c).unwrap_or(add(self.jug.pos, [0.0, 0.5, 0.0])); let b = self.jug.pos;
        let (mut c, m);
        if x < CINE {
            if x < 1.75 { let k = ss(0.0, 1.75, x); c = add(b, add(esc(f, 2.4 - 0.5 * k), add(esc(izq, 1.45 - 0.35 * k), esc(up, -0.3 - 0.15 * k)))); m = add(b, esc(up, -0.45)); }
            else if x < 3.35 { let k = ss(1.75, 3.35, x); c = add(hc, add(esc(izq, 1.35 - 0.2 * k), add(esc(f, 0.3), esc(up, 0.02)))); m = add(hc, add(esc(f, 0.12), esc(up, -0.1))); }
            else if x < 4.65 { let k = ss(3.35, 4.65, x); c = add(hc, add(esc(f, 0.85 - 0.15 * k), add(esc(up, 0.05), esc(izq, 0.08)))); m = add(hc, esc(up, 0.03)); }
            else { let k = ss(4.65, 6.0, x); c = add(b, add(esc(f, 3.3 + 1.9 * k), add(esc(izq, 0.45), esc(up, -0.5 + 0.3 * k)))); m = add(hc, esc(up, 0.3 + 0.7 * k)); }
            // (que no quede atrás de una pared)
            let dv = sub(c, hc); let l = largo(dv);
            if l > 0.01 { if let Some(g) = self.mapa.as_ref().and_then(|mp| mp.mundo.rayo(hc, esc(dv, 1.0 / l), l + 0.2)) { c = add(hc, esc(dv, (g.t - 0.2).max(0.25) / l)); } }
            self.jg.cam = Some((c, norm(sub(m, c))));
        } else {
            let fw = mira_de(self.jug.yaw, self.jug.pitch); let der = [-self.jug.yaw.cos(), 0.0, self.jug.yaw.sin()]; let piv = add(hc, [0.0, 0.25, 0.0]);
            let atras = add(add(esc(fw, -3.6), esc(der, 1.0)), [0.0, 0.45, 0.0]); let l = largo(atras);
            let t = self.mapa.as_ref().and_then(|mp| mp.mundo.rayo(piv, esc(atras, 1.0 / l), l + 0.3)).map(|g| (g.t - 0.3).max(0.3) / l).unwrap_or(1.0);
            self.jg.cam = Some((add(piv, esc(atras, t)), fw));
        }
    }

    // ---------------- lo que se dibuja ----------------
    /// cicDibujar: los lentes (en la cara, en la mano o en el piso), los ojos que brillan, el rayo grueso y los láseres
    pub(super) fn cic_items(&self, out: &mut Vec<ItemDin>, cam: V) {
        if !self.cic_hay() && !self.jg.cic.mia() && self.jg.cic.rayos.is_empty() { return; }
        let ver_cuerpo = self.camara != 0 && self.jg.nat.rag.is_none();
        if let (Some(h), true, true) = (self.cic_cabeza(), ver_cuerpo, self.pj.as_ref().map_or(false, |p| p.skin == "Ciclope")) {
            let x = self.jg.cic.ult.as_ref().map(|u| self.jg.t - u.t0).unwrap_or(-1.0);
            let carga = if self.jg.cic.apretado && !self.jg.cic.usada { (self.jg.cic.carga / CARGA).clamp(0.0, 1.0) } else { 0.0 }; let laser = (self.jg.cic.t_laser / 0.28).clamp(0.0, 1.0);
            let st = if x < 0.0 || x < 3.35 { 0 } else if x < 4.75 { 1 } else { 2 };
            if st == 0 { lentes(&h, true, out, 0.35 + 2.5 * carga + 3.0 * laser); }
            else if st == 1 {
                // (agarrados del puente, pasando la muñeca hacia los dedos; al principio salen de la cara)
                if let (Some(pj), true) = (self.pj.as_ref(), true) { if let (Some(mh), Some(mf)) = (pj.hueso("RightHand"), pj.hueso("RightForeArm")) {
                    let base = self.cic_base(); let cm = pos_de(&m4::mul(&base, &mh)); let dm = norm(sub(cm, pos_de(&m4::mul(&base, &mf)))); let k = ss(3.35, 3.7, x);
                    let pm = add(cm, esc(dm, 0.05 * h.s)); let qm = qmul(qeje([0.0, 1.0, 0.0], self.jug.yaw), qeje([1.0, 0.0, 0.0], 0.35));
                    let pc = h.en(0.0, h.o[1], h.o[3]); let pp = mezcla(pc, pm, k); let qq = slerp(h.q, qm, k);
                    lentes(&Cabeza { c: sub(pp, qrot(qq, [0.0, h.o[1] * h.s, h.o[3] * h.s])), q: qq, s: h.s, o: h.o }, false, out, 0.3);
                } }
            } else if let Some(l) = &self.jg.cic.piso { lentes(&Cabeza { c: sub(l.p, qrot(l.q, [0.0, h.o[1] * h.s, h.o[3] * h.s])), q: l.q, s: h.s, o: h.o }, false, out, 0.25); }
            // ojos que brillan: sin lentes (desde que se los saca) y al cargar
            let brillo = (if x >= 3.6 { ss(3.6, 4.6, x) } else { 0.0 }).max(carga * 0.6);
            if brillo > 0.01 { for s in [1.0, -1.0] { caja(h.en(s * h.o[0], h.o[1] - 0.001, h.o[2] + 0.003), [0.021 * h.s, 0.008 * h.s, 0.005 * h.s], h.q, mat_nivel(MAT_OJO, brillo), out); } }
        }
        // la definitiva: el rayo grueso
        if let Some(u) = &self.jg.cic.ult { let x = self.jg.t - u.t0; if x >= 5.4 { if let Some(hit) = u.hit {
            let k = ss(5.4, 5.75, x) * (1.0 - ss(CINE + FURIA - 0.4, CINE + FURIA, x));
            if k > 0.01 { haz(self.cic_origen(), hit, (0.42 + 0.06 * (self.jg.t * 37.0).sin()) * k, k, self.jg.t, cam, out); } } } }
        // los láseres suaves
        for r in &self.jg.cic.rayos { let k = 1.0 - r.2 / r.3; haz(r.0, r.1, 0.06 * k + 0.02, k * 0.8, self.jg.t, cam, out); }
    }
    /// cicLuces: la luz de los ojos (adelante de la cara), sobre el rayo y en la punta
    pub(super) fn cic_luces(&self) -> Vec<LuzP> {
        let mut v = vec![];
        if let Some(u) = &self.jg.cic.ult { let x = self.jg.t - u.t0;
            if (3.6..5.4).contains(&x) { if let Some(h) = self.cic_cabeza() { let p = add(h.ojo(), esc(h.fw(), 0.5)); v.push([p[0], p[1], p[2], 1.4, 1.2, 0.08, 0.05, 0.0, 0.0, -1.0, 0.0, -2.0]); } }
            if x >= 5.4 { let p = add(self.cic_origen(), esc(u.dir, 1.5)); v.push([p[0], p[1], p[2], 14.0, 26.0, 2.6, 1.4, 0.0, 0.0, -1.0, 0.0, -2.0]);
                if let Some(hit) = u.hit { let k = (dist(hit, self.jg.cam_ult) / 9.0).clamp(0.06, 1.0); v.push([hit[0], hit[1] + 1.0, hit[2], 18.0, 40.0 * k, 5.0 * k, 2.0 * k, 0.0, 0.0, -1.0, 0.0, -2.0]); } }
        }
        for r in &self.jg.cic.rayos { let k = 1.0 - r.2 / r.3; v.push([r.1[0], r.1[1], r.1[2], 5.0, 6.0 * k, 0.5, 0.3, 0.0, 0.0, -1.0, 0.0, -2.0]); }
        v.extend(self.art_luces_v());
        v
    }
    fn art_luces_v(&self) -> Vec<LuzP> { let mut v = vec![]; self.art_luces(&mut v); v }
    /// el tinte rojo de todo (#cicRojo: multiplica; acá, una capa roja)
    pub(super) fn cic_hud_fondo(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32) {
        let r = self.jg.cic.rojo * 0.5; if r > 0.003 { l.caja(u, 0.0, 0.0, wf, hf, 0.0, [1.0, 0.32, 0.21, r * 0.55]); }
    }
    /// el anillo de la carga alrededor del botón y los segundos de espera
    pub(super) fn cic_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) {
        if !self.cic_hay() || self.vehs.jugador.is_some() { return; }
        let Some(b) = botones(wf, hf).into_iter().find(|b| b.b == Boton::Jg(Bj::Ciclope)) else { return }; let (x, y, r) = (b.x, b.y, b.w / 2.0);
        let k = if self.jg.cic.apretado && !self.jg.cic.usada { (self.jg.cic.carga / CARGA).clamp(0.0, 1.0) } else { 0.0 };
        if k > 0.0 { let n = 32; for i in 0..((n as f32 * k) as usize) { let a = -std::f32::consts::FRAC_PI_2 + i as f32 / n as f32 * std::f32::consts::TAU; l.disco(u, x + a.cos() * (r + hf * 0.012), y + a.sin() * (r + hf * 0.012), hf * 0.008, [1.0, 0.23, 0.19, 1.0]); } }
        if self.jg.cic.espera > 0.0 { let s = format!("{}", self.jg.cic.espera.ceil()); let tt = t * 0.9; let an = l.ancho(tt, &s); l.disco(u, x, y, r, [0.0, 0.0, 0.0, 0.45]); l.texto_sombra(u, x - an / 2.0, y - tt * 0.55, tt, [1.0; 4], &s); }
    }
}
/// el pecho de alguien (de pie o tirado)
fn pecho(n: &npc::Npc) -> V { if n.rag.is_some() { n.pos() } else { add(n.pos(), [0.0, 0.25, 0.0]) } }
fn slerp(a: Q, b: Q, t: f32) -> Q { let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; let s = if d < 0.0 { -1.0 } else { 1.0 }; qnorm([a[0] + (b[0] * s - a[0]) * t, a[1] + (b[1] * s - a[1]) * t, a[2] + (b[2] * s - a[2]) * t, a[3] + (b[3] * s - a[3]) * t]) }
/// el material de brillo más parecido (los materiales del motor tienen la emisión fija: hay de a niveles)
pub fn mat_nivel(base: i64, k: f32) -> i64 { base - ((k.clamp(0.0, 1.0) * 3.0).round() as i64) }
/// cicLentes: la barra de los vidrios, el marco arriba, el puente y las patillas hasta las orejas (en la cara, la mano o el
/// piso: plegadas)
fn lentes(f: &Cabeza, en_cara: bool, out: &mut Vec<ItemDin>, brillo: f32) {
    let o = if en_cara { f.o } else { [0.025, 0.0447, 0.141, 0.173, 1.11] }; let t = o[4]; let y = o[1] + 0.001 * t; let z = o[3]; let k = f.s * t; let q = f.q;
    caja(f.en(0.0, y, z), [0.15 * k, 0.03 * k, 0.009 * k], q, mat_nivel(MAT_LENTE, (brillo / 3.9).clamp(0.0, 1.0)), out);
    caja(f.en(0.0, y + 0.018 * t, z - 0.001 * t), [0.156 * k, 0.007 * k, 0.013 * k], q, MAT_MARCO, out);
    caja(f.en(0.0, y - 0.006 * t, z + 0.006 * t), [0.014 * k, 0.016 * k, 0.005 * k], q, MAT_MARCO, out);
    if en_cara { for s in [1.0, -1.0] { caja(f.en(s * 0.083 * t, y + 0.012 * t, z - 0.066 * t), [0.006 * k, 0.008 * k, 0.128 * k], q, MAT_MARCO, out); } }
}
/// cicHazDibujar: el centro blanco y capas rojas que suman luz, giradas alrededor del eje (parece redondo); cerca de la
/// cámara se corta
fn haz(a: V, b: V, grosor: f32, k: f32, t: f32, cam: V, out: &mut Vec<ItemDin>) {
    let dc = dist(b, cam).min(dist(a, cam) + 99.0); let cortar = if dc < 2.2 { 2.2 - dc } else { 0.0 };
    let b = if cortar > 0.0 { add(a, esc(sub(b, a), (1.0 - cortar / dist(b, a).max(0.01)).max(0.0))) } else { b };
    let d = sub(b, a); let l = largo(d); if l < 0.05 { return; }
    let dn = esc(d, 1.0 / l); let c = add(a, esc(d, 0.5)); let q = qmul(qeje([0.0, 1.0, 0.0], dn[0].atan2(dn[2])), qeje([1.0, 0.0, 0.0], -dn[1].clamp(-1.0, 1.0).asin()));
    caja(c, [grosor * 0.28, grosor * 0.28, l], q, mat_nivel(MAT_NUCLEO, k), out);
    for i in 0..3 { let qi = qmul(q, qeje([0.0, 0.0, 1.0], i as f32 * std::f32::consts::PI / 3.0 + t * 2.0));
        caja(c, [grosor * 0.75, grosor * 0.75, l], qi, mat_nivel(MAT_HAZ, k), out); caja(c, [grosor * 1.9, grosor * 1.9, l], qi, mat_nivel(MAT_HAZ2, k), out); }
}
/// el tono de la carga: un triángulo de 90 a 350 Hz en 1 s (cicSonCarga)
fn carga_pcm() -> Vec<f32> { let sr = 48000.0; let mut ph = 0.0f64; (0..48000).map(|i| { let t = i as f64 / sr; ph += (90.0 + 260.0 * t) / sr; let x = 4.0 * (ph - (ph + 0.5).floor()).abs() - 1.0; (x * 0.12 * (1.0 - (-t / 0.15).exp())) as f32 }).collect() }
/// el rugido del rayo (cicSonRayo): ruido por un pasabajos de 700 Hz y dos sierras (52 y 78,5 Hz) que tiemblan a 13 Hz
fn rayo_pcm() -> Vec<f32> {
    let sr = 48000.0f64; let n = 96000; let mut s: u32 = 0x1234567; let (mut x1, mut x2, mut y1, mut y2) = (0.0, 0.0, 0.0, 0.0);
    let w0 = 2.0 * std::f64::consts::PI * 700.0 / sr; let al = w0.sin() / (2.0 * 2.0); let c = w0.cos(); let a0 = 1.0 + al;
    (0..n).map(|i| { let t = i as f64 / sr; s ^= s << 13; s ^= s >> 17; s ^= s << 5; let x = s as f64 / 2147483648.0 - 1.0;
        let y = ((1.0 - c) / 2.0 * x + (1.0 - c) * x1 + (1.0 - c) / 2.0 * x2 - (-2.0 * c) * y1 - (1.0 - al) * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y;
        let saw = |f: f64| 2.0 * (t * f - (t * f + 0.5).floor());
        ((y + saw(52.0) + saw(78.5)) * (0.75 + 0.25 * (2.0 * std::f64::consts::PI * 13.0 * t).sin()) * 0.35) as f32 }).collect()
}
/// cicSonLaser: dos osciladores (sierra y cuadrada) que bajan de 1500 a 220 Hz en 0,24 s
fn laser_pcm() -> Vec<f32> { let sr = 48000.0f64; let (mut p1, mut p2) = (0.0f64, 0.0f64); (0..(0.3 * sr) as usize).map(|i| { let t = i as f64 / sr; let k = (t / 0.24).min(1.0); let (f1, f2) = (1500.0 * (220.0f64 / 1500.0).powf(k), 1520.0 * (230.0f64 / 1520.0).powf(k)); p1 += f1 / sr; p2 += f2 / sr;
    let g = if t < 0.012 { 0.0001 * (0.4f64 / 0.0001).powf(t / 0.012) } else { 0.4 * (0.0001f64 / 0.4).powf(((t - 0.012) / (0.28 - 0.012)).min(1.0)) };
    ((2.0 * (p1 - (p1 + 0.5).floor()) + if p2.fract() < 0.5 { 1.0 } else { -1.0 }) * g * 0.5) as f32 }).collect() }
impl Juego { fn cic_son_laser(&mut self, o: V) { self.sonido.sintetico("CIC_laser", laser_pcm, 48000); self.sonido.tocar("CIC_laser", 1.0, 1.0, Some(o)); } }

/// cicPoseDef: de rodillas, agachado con las manos en el piso, la mano a la cara (los lentes), brazos abiertos y el grito;
/// la cabeza sigue al rayo (en el espacio del personaje: adelante +Z, la izquierda +X)
pub fn pose(jg: &mut Jugabilidad, pj: &mut Personaje, jug: &Jugador, _m: Option<&jxjuego::mundo::Mundo>) {
    let Some(u) = jg.cic.ult.as_ref() else { return }; let x = jg.t - u.t0; let fin = CINE + FURIA;
    let base = personaje::base([jug.pos[0], jug.pos[1] - 0.95, jug.pos[2]], jug.yaw); let dir_u = dir_al_pj(&base, u.dir);
    let (up, fw, izq) = ([0.0, 1.0, 0.0], [0.0, 0.0, 1.0], [1.0, 0.0, 0.0]); let lado = cruz(up, fw);
    let wk = ss(0.05, 0.9, x) * (1.0 - ss(fin - 0.1, fin + 0.6, x)); let wb = ss(0.25, 1.1, x) * (1.0 - ss(1.75, 2.7, x)); let wm = ss(2.55, 3.2, x) * (1.0 - ss(4.3, 4.9, x));
    let wf = ss(3.35, 4.25, x); let ws = ss(4.6, 5.3, x) * (1.0 - ss(fin - 0.1, fin + 0.6, x)); let wcab = ss(1.7, 2.2, x) * (1.0 - ss(2.8, 3.4, x));
    let wgrito = ss(4.7, 5.3, x) * (1.0 - ss(5.9, 6.6, x)); let wapunta = ss(5.5, 6.6, x) * (1.0 - ss(fin - 0.1, fin + 0.6, x));
    let piso = 0.0;
    let (x_head, x_hips, x_leftfoot, x_leftleg, x_leftupleg, x_neck, x_rightarm, x_rightfoot, x_rightforearm, x_righthand, x_rightleg, x_rightupleg, x_spine, x_spine1, x_spine2) = (pj.indice("Head"), pj.indice("Hips"), pj.indice("LeftFoot"), pj.indice("LeftLeg"), pj.indice("LeftUpLeg"), pj.indice("Neck"), pj.indice("RightArm"), pj.indice("RightFoot"), pj.indice("RightForeArm"), pj.indice("RightHand"), pj.indice("RightLeg"), pj.indice("RightUpLeg"), pj.indice("Spine"), pj.indice("Spine1"), pj.indice("Spine2"));
    let (iul, ill, iru, irl, ilf, irf) = (x_leftupleg, x_leftleg, x_rightupleg, x_rightleg, x_leftfoot, x_rightfoot);
    let (Some(ul), Some(ll), Some(ru)) = (iul, ill, iru) else { return }; let Some(lf) = ilf else { return };
    pj.rehacer_matrices(); let w = |pj: &Personaje, i: usize| pos_de(&pj.mundo(i));
    let (a, b, alfrente) = (dist(w(pj, ul), w(pj, ll)), dist(w(pj, ll), w(pj, lf)), 0.12f32);
    let ycad = piso + 0.07 + (a * a - alfrente * alfrente).max(0.01).sqrt(); let bajar = (w(pj, ul)[1].min(w(pj, ru)[1]) - ycad) * wk;
    let mut r = pj.raiz(); r[13] -= bajar; pj.poner_raiz(r); pj.rehacer_matrices();
    if wb > 0.01 { girar_mundo(pj, x_hips, lado, 0.6 * wb); pj.rehacer_matrices(); }
    if wk > 0.01 { for (iu, ik, ia) in [(iul, ill, ilf), (iru, irl, irf)] { let (Some(u0), Some(a0)) = (iu, ia) else { continue }; pj.rehacer_matrices();
        let hh = w(pj, u0); let kp = [hh[0] + fw[0] * alfrente, piso + 0.07, hh[2] + fw[2] * alfrente]; let sb = 0.2f32;
        let aj = add(kp, add(esc(fw, -b * sb.cos()), [0.0, b * sb.sin(), 0.0])); let t = mezcla(w(pj, a0), aj, wk);
        let qf = qmul(qeje([1.0, 0.0, 0.0], 2.0 * wk), pj.giro_reposo(a0)); ik2(pj, iu, ik, ia, t, fw, Some(qf)); } pj.rehacer_matrices(); }
    let dobla = 0.75 * wb - 0.24 * wgrito;
    if dobla.abs() > 0.001 { girar_mundo(pj, x_spine, lado, dobla * 0.4); girar_mundo(pj, x_spine1, lado, dobla * 0.35); girar_mundo(pj, x_spine2, lado, dobla * 0.25); }
    let cabeza = |pj: &mut Personaje| -> Option<Cabeza> { pj.rehacer_matrices(); let i = pj.indice("Head")?; Some(cabeza_de(&pj.mundo(i), &pj.skin)) };
    let wcara = ss(0.3, 0.9, x) * (1.0 - ss(5.5, 6.2, x));
    if wcara > 0.01 { if let Some(hd) = cabeza(pj) { let ax = cruz(hd.fw(), fw); let sn = largo(ax); let ang = sn.atan2(dot(hd.fw(), fw)) * wcara;
        if sn > 1e-5 { let ax = esc(ax, 1.0 / sn); girar_mundo(pj, x_neck, ax, ang * 0.4); girar_mundo(pj, x_head, ax, ang * 0.6); } } }
    let cab = 0.55 * wcab + 0.3 * wb - 1.05 * wgrito;
    if cab.abs() > 0.001 { girar_mundo(pj, x_neck, lado, cab * 0.4); girar_mundo(pj, x_head, lado, cab * 0.6); }
    if wapunta > 0.01 { if let Some(hd) = cabeza(pj) { let dd = norm(add(esc(hd.fw(), 1.0 - wapunta), esc(dir_u, wapunta))); let ax = cruz(hd.fw(), dd); let s = largo(ax); let ang = s.atan2(dot(hd.fw(), dd));
        if s > 1e-5 { let ax = esc(ax, 1.0 / s); let a2 = ang.min(1.6); girar_mundo(pj, x_spine1, ax, a2 * 0.2); girar_mundo(pj, x_spine2, ax, a2 * 0.2); girar_mundo(pj, x_neck, ax, a2 * 0.25); girar_mundo(pj, x_head, ax, a2 * 0.35); } } }
    pj.rehacer_matrices();
    // brazos
    for (s, na, nf, nh) in [(1.0f32, "LeftArm", "LeftForeArm", "LeftHand"), (-1.0, "RightArm", "RightForeArm", "RightHand")] {
        let (ia, i_f, ih) = (pj.indice(na), pj.indice(nf), pj.indice(nh)); let (Some(a0), Some(h0)) = (ia, ih) else { continue }; let lat = esc(izq, s);
        if wb > 0.01 { pj.rehacer_matrices(); let sp = w(pj, a0); let t = [sp[0] + fw[0] * 0.2 + lat[0] * 0.07, piso + 0.04, sp[2] + fw[2] * 0.2 + lat[2] * 0.07];
            ik2(pj, ia, i_f, ih, mezcla(w(pj, h0), t, wb), add(esc(fw, -0.4), add(lat, esc(up, 0.3))), None); }
        if ws > 0.01 { hueso_apuntar(pj, ia, i_f, norm(add(add(esc(up, -0.8), esc(lat, 0.52)), esc(fw, -0.14))), ws * 0.9); hueso_apuntar(pj, i_f, ih, norm(add(add(esc(up, -0.86), esc(lat, 0.3)), esc(fw, 0.12))), ws * 0.85); }
    }
    // la mano derecha: a la cara (agarra los lentes) y se los lleva para el costado
    if wm > 0.01 { if let (Some(hd), Some(ra), Some(rh)) = (cabeza(pj), x_rightarm, x_righthand) {
        let cara = add(add(hd.ojo(), esc(hd.fw(), 0.07)), esc(izq, -0.05)); let afuera = add(add(w(pj, ra), esc(izq, -0.45)), add(esc(fw, 0.06), [0.0, -0.18, 0.0]));
        let t = mezcla(cara, afuera, wf); ik2(pj, Some(ra), x_rightforearm, Some(rh), mezcla(w(pj, rh), t, wm), add(esc(up, -0.7), add(esc(izq, -0.6), esc(fw, 0.1))), None);
    } }
}
