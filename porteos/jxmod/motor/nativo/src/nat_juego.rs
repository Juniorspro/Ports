//! Los mods nativos de nativos.js (Props → Opciones y el menú MOD): volar (empuje hacia donde mirás con inercia; el cuerpo
//! se inclina con resortes —adelante al acelerar, de costado al doblar— y las piernas se balancean, como Superman a toda
//! velocidad), muñeco de trapo (te dejás caer; la Physics Gun o la Gravity Gun te agarran) y SCP en cuatro patas (pegado a
//! cualquier superficie —piso, paredes, techo—, corrés rápido y cada pata pisa sola: el pie queda clavado hasta que se
//! aleja de su lugar y da el paso en diagonal con su par). Lo de la red (que otro jugador te agarre en su juego) no está.
use super::*;
use jxjuego::jugador::Entrada;

/// los resortes de la inclinación al volar (P.vuelo)
#[derive(Default, Clone, Copy)]
struct Vuelo { px: f32, pv: f32, rx: f32, rv: f32, lx: f32, lv: f32, yaw: f32, va: V, ar: f32, hay: bool }
/// una pata del SCP (P.marcha.pies): sus huesos, el lado, si es brazo, su grupo (el par en diagonal), dónde pisa, de dónde
/// a dónde va el paso y cuánto lleva
#[derive(Clone)]
struct Pata { iu: Option<usize>, ik: Option<usize>, ia: Option<usize>, s: f32, brazo: bool, g: u8, p: Option<V>, de: V, a: V, t: f32, nuevo: bool }
#[derive(Default)]
pub struct Nat {
    pub volando: bool, pub scp: bool,
    /// tirado como muñeco: el NPC muñeco con el cuerpo (o pedido, esperando el cuadro: None con `pedir_rag`)
    pub rag: Option<u32>, pedir_rag: bool,
    /// la cámara antes del mod (natTercera), el reloj de los pasos del mod
    terc: Option<u8>, acum: f32,
    /// el SCP: arriba (la normal de la superficie), adelante, si está pegado y cuánto falta para volver a pegarse
    up: V, fw: V, pegado: bool, suelta: f32,
    vuelo: Vuelo, patas: Vec<Pata>,
}
const SCP_ALTO: f32 = 0.55; const SCP_R: f32 = 0.42;

impl Juego {
    /// natAccion: el botón (o la fila del menú MOD) de cada mod
    pub(super) fn nat_accion(&mut self, k: &str) {
        if self.mapa.is_none() { return; }
        match k { "volar" => { let v = !self.jg.nat.volando; self.nat_volar(v) } "ragdoll" => { let v = self.jg.nat.rag.is_none() && !self.jg.nat.pedir_rag; self.nat_rag(v) } "scp" => { let v = !self.jg.nat.scp; self.nat_scp(v) } _ => {} }
    }
    /// natTercera: tercera persona mientras dura (y vuelve como estaba)
    fn nat_tercera(&mut self, si: bool) {
        let n = &mut self.jg.nat;
        if si { if n.terc.is_none() { n.terc = Some(self.camara); } self.camara = 1; }
        else if !n.volando && n.rag.is_none() && !n.pedir_rag && !n.scp { if let Some(c) = n.terc.take() { self.camara = c; } }
    }
    pub(super) fn nat_volar(&mut self, si: bool) {
        if si && (self.jug.vida <= 0.0 || self.vehs.jugador.is_some()) { return; }
        if si && (self.jg.nat.rag.is_some() || self.jg.nat.pedir_rag) { self.nat_rag(false); } if si && self.jg.nat.scp { self.nat_scp(false); }
        self.jg.nat.volando = si; self.jg.nat.vuelo.hay = false;
        if si { self.jug.noclip = false; self.jug.vel[1] = self.jug.vel[1].max(3.0); self.avisar("¡A volar! (Shift: más rápido)".into()); }
        self.nat_tercera(si);
    }
    pub(super) fn nat_scp(&mut self, si: bool) {
        if si && (self.jg.nat.rag.is_some() || self.jg.nat.pedir_rag) { self.nat_rag(false); } if si && self.jg.nat.volando { self.nat_volar(false); }
        let n = &mut self.jg.nat; n.scp = si; n.up = [0.0, 1.0, 0.0]; n.pegado = false; n.suelta = 0.0; n.patas.clear();
        if si { n.fw = [self.jug.yaw.sin(), 0.0, self.jug.yaw.cos()]; self.jug.noclip = false; } else { self.jug.pos[1] += 0.5; }
        self.nat_tercera(si);
    }
    /// natRag: tirarse como muñeco (en el cuadro se arma el muñeco con tu cuerpo) o levantarse donde quedó la cadera
    pub(super) fn nat_rag(&mut self, si: bool) {
        if si {
            if self.jg.nat.rag.is_some() || self.jg.nat.pedir_rag || self.jug.vida <= 0.0 || self.vehs.jugador.is_some() || self.pj.is_none() { return; }
            if self.jg.nat.volando { self.nat_volar(false); } if self.jg.nat.scp { self.nat_scp(false); }
            self.armas.soltar(&mut self.fis, false); self.jg.nat.pedir_rag = true; self.nat_tercera(true);
        } else {
            self.jg.nat.pedir_rag = false;
            if let Some(id) = self.jg.nat.rag.take() {
                let h = self.npcs.get(id).map(|n| n.pos()).unwrap_or(self.jug.pos); self.npcs.quitar(id, &mut self.fis);
                if self.jug.vida > 0.0 {
                    let y = self.mapa.as_ref().and_then(|mp| jxjuego::persona::piso_bajo(&mp.mundo, v64(h), 1.2)).map(|y| y as f32);
                    self.jug.pos = [h[0], match y { Some(y) if h[1] - y < 2.5 => y + 1.02, _ => h[1] + 0.6 }, h[2]]; self.jug.vel = [0.0; 3];
                }
            }
            self.nat_tercera(false);
        }
    }
    /// natPaso y natMover: cada cuadro, lo que mueve al jugador el mod (a pasos de 1/120 s, como el jugador)
    pub(super) unsafe fn nat_paso(&mut self, m: &mut Motor3d, dt: f32) {
        if self.jg.nat.volando && (self.jug.vida <= 0.0 || self.vehs.jugador.is_some()) { self.nat_volar(false); }
        if (self.jg.nat.rag.is_some() || self.jg.nat.pedir_rag) && self.jug.vida <= 0.0 { self.nat_rag(false); }
        if self.jg.nat.scp && self.vehs.jugador.is_some() { self.nat_scp(false); }
        // (el muñeco: tu cuerpo, tirado con la velocidad que llevabas)
        if self.jg.nat.pedir_rag {
            self.jg.nat.pedir_rag = false;
            let skin = self.pj.as_ref().map(|p| p.skin.clone()).unwrap_or_else(|| self.skin.clone());
            if let Some(paq) = self.paq.as_mut() { if let Ok((c, e)) = self.npc_skins.pedir(paq, &skin, &mut self.pj_cargados) {
                if let Some(e) = e { let _ = m.cargar(&e); }
                let jp = self.jug.pos;
                if let Some(id) = self.npcs.crear_muneco(c, [jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw, &mut self.fis) {
                    self.jg.nat.rag = Some(id); let v = esc(self.jug.vel, 1.0);
                    let cs: Vec<u32> = self.npcs.get(id).and_then(|n| n.rag.as_ref()).map(|r| r.cuerpos().collect()).unwrap_or_default();
                    for c in cs { if let Some(b) = self.fis.cuerpo_mut(c) { for e in 0..3 { b.vel[e] += v[e] as f64; } b.despertar(); } }
                } else { self.avisar(format!("Ya hay {} NPC (el máximo)", self.npcs.max)); self.nat_tercera(false); }
            } }
        }
        if !self.jg.mueve_jugador() { self.jg.nat.acum = 0.0; return; }
        if let Some(id) = self.jg.nat.rag {
            let Some(n) = self.npcs.get(id) else { self.jg.nat.rag = None; self.nat_tercera(false); return };
            let h = n.pos(); let v = n.cuerpo.and_then(|c| self.fis.cuerpo(c)).map(|b| v32(b.vel)).unwrap_or([0.0; 3]);
            self.jug.pos = add(h, [0.0, 0.15, 0.0]); self.jug.vel = v; self.jug.suelo = false; return;
        }
        let ent = self.jg.ent; let paso = 1.0 / 120.0;
        self.jg.nat.acum = (self.jg.nat.acum + dt).min(paso * 12.0);
        while self.jg.nat.acum >= paso {
            self.jg.nat.acum -= paso;
            if self.jg.nat.volando { self.nat_volar_paso(paso, &ent); } else if self.jg.nat.scp { self.nat_scp_paso(paso, &ent); }
        }
    }
    /// natVolarPaso: empuje hacia donde mirás (y saltar/agacharse para subir y bajar), con inercia; casi sin gravedad
    fn nat_volar_paso(&mut self, dt: f32, ent: &Entrada) {
        let Some(mp) = self.mapa.as_ref() else { return }; let j = &mut self.jug;
        let fv = mira_de(j.yaw, j.pitch); let rgt = [-j.yaw.cos(), 0.0, j.yaw.sin()];
        let mut wish = [fv[0] * ent.y + rgt[0] * ent.x, fv[1] * ent.y + ent.saltar as i32 as f32 - ent.agachar as i32 as f32, fv[2] * ent.y + rgt[2] * ent.x];
        let wl = largo(wish).min(1.0); if wl > 1e-3 { wish = esc(wish, 1.0 / largo(wish)); }
        let (vmax, ac) = if ent.correr { (46.0, 38.0) } else { (20.0, 24.0) };
        let dv = sub(esc(wish, vmax * wl), j.vel); let dl = largo(dv); let mx = (if wl > 0.01 { ac } else { 10.0 }) * dt;
        if dl > 0.0 { j.vel = add(j.vel, esc(dv, (mx / dl).min(1.0))); }
        j.vel[1] -= efx::GRAV * mp.mundo.gravedad * dt * 0.04;
        j.mover_chocar_ext(&mp.mundo, Some(&mut self.fis), dt);
    }
    /// natScpPaso: una esfera que se pega a la superficie que pisa; «arriba» es la normal de esa superficie
    fn nat_scp_paso(&mut self, dt: f32, ent: &Entrada) {
        let Some(mp) = self.mapa.as_ref() else { return }; let mundo = &mp.mundo; let (yaw, pitch) = (self.jug.yaw, self.jug.pitch);
        let mut up = self.jg.nat.up; if largo(up) < 0.5 { up = [0.0, 1.0, 0.0]; }
        // adelante: en pisos y techos según adonde mira (sin inclinar); en paredes, con la inclinación de la cámara
        let mut fw = if up[1].abs() > 0.7 { [yaw.sin(), 0.0, yaw.cos()] } else { mira_de(yaw, pitch) };
        fw = sub(fw, esc(up, dot(fw, up)));
        if largo(fw) < 0.2 { fw = sub([0.0, 1.0, 0.0], esc(up, up[1])); if largo(fw) < 0.2 { fw = [yaw.sin(), 0.0, yaw.cos()]; } }
        let fw = norm(fw); let rt = norm(cruz(fw, up));
        let mut wish = add(esc(fw, ent.y), esc(rt, ent.x)); let wl = largo(wish).min(1.0); if wl > 1e-3 { wish = esc(wish, 1.0 / largo(wish)); }
        let vmax = self.jug.vel_max * if ent.correr { 2.9 } else { 1.3 };
        let n = &mut self.jg.nat; let j = &mut self.jug; n.suelta -= dt;
        if n.pegado {
            let vn = dot(j.vel, up); let mut vt = sub(j.vel, esc(up, vn)); let dv = sub(esc(wish, vmax * wl), vt); let dl = largo(dv); let mx = (if wl > 0.01 { 55.0 } else { 40.0 }) * dt;
            if dl > 0.0 { vt = add(vt, esc(dv, (mx / dl).min(1.0))); }
            j.vel = add(vt, esc(up, vn.min(0.0) - 6.0 * dt));
            if ent.saltar && n.suelta < -0.15 { j.vel = add(j.vel, esc(up, 7.0)); j.vel[1] += 2.5; n.pegado = false; n.suelta = 0.35; }
        } else {
            j.vel[1] -= efx::GRAV * mundo.gravedad * j.grav * dt;
            let dv = sub(esc(wish, vmax * wl), [j.vel[0], 0.0, j.vel[2]]); j.vel[0] += dv[0] * (dt * 1.5).min(1.0); j.vel[2] += dv[2] * (dt * 1.5).min(1.0);
            up = norm(mezcla(up, [0.0, 1.0, 0.0], (dt * 3.0).min(1.0)));
        }
        // moverse en pasos chicos sacando la esfera de lo que toca
        let pasos = ((largo(j.vel) * dt / 0.2).ceil() as usize).max(1); let mut toco: Option<V> = None;
        for _ in 0..pasos {
            j.pos = add(j.pos, esc(j.vel, dt / pasos as f32));
            let mut c = j.pos; let corr = esfera_fuera(mundo, &self.fis, &mut c, SCP_R);
            j.pos = c; let cl = largo(corr);
            if cl > 1e-5 { let nn = esc(corr, 1.0 / cl); let vn = dot(j.vel, nn); if vn < 0.0 { j.vel = sub(j.vel, esc(nn, vn)); } toco = Some(nn); }
        }
        // la superficie: abajo; una pared adelante (para trepar); o, al pasar un borde, la cara de la vuelta
        let mov = sub(j.vel, esc(up, dot(j.vel, up))); let ml = largo(mov); let dm = if wl > 0.1 { Some(wish) } else if ml > 0.3 { Some(esc(mov, 1.0 / ml)) } else { None };
        let mut meta: Option<V> = None; let pos = j.pos;
        let rayo = |fis: &mut Fisica, o: V, d: V, max: f32| fis.rayo(mundo, v64(o), v64(d), max as f64, &[]).map(|g| (g.t as f32, v32(g.n)));
        if n.suelta <= 0.0 {
            let ha = rayo(&mut self.fis, pos, esc(up, -1.0), SCP_ALTO + 0.9); if let Some(h) = ha { meta = Some(h.1); }
            if let Some(d) = dm { if let Some(hf) = rayo(&mut self.fis, pos, d, 0.9) { if dot(hf.1, up) < 0.6 { meta = Some(hf.1); } } }
            if ha.is_none() && n.pegado { if let Some(d) = dm { if let Some(hb) = rayo(&mut self.fis, add(pos, add(esc(up, -0.95), esc(d, 0.55))), esc(d, -1.0), 1.4) { meta = Some(hb.1); } } }
            if meta.is_none() && !n.pegado { meta = toco; }
        }
        if let Some(nm) = meta {
            up = norm(mezcla(up, nm, (dt * 10.0).min(1.0)));
            if let Some(hs) = rayo(&mut self.fis, j.pos, esc(nm, -1.0), SCP_ALTO + 1.0) { j.pos = add(j.pos, esc(nm, (SCP_ALTO - hs.0) * (dt * 18.0).min(1.0))); let vn = dot(j.vel, nm); if vn > 0.0 && n.pegado { j.vel = sub(j.vel, esc(nm, vn * (dt * 10.0).min(1.0))); } n.pegado = true; }
            else { n.pegado = false; }
        } else { n.pegado = false; }
        j.suelo = n.pegado; n.up = up;
        let f0 = if largo(n.fw) > 0.1 { n.fw } else { fw };
        let mut nf = if let (Some(d), true) = (dm, n.pegado) { mezcla(f0, d, (dt * 10.0).min(1.0)) } else if wl < 0.01 { mezcla(f0, fw, (dt * 4.0).min(1.0)) } else { f0 };
        nf = sub(nf, esc(up, dot(nf, up))); if largo(nf) < 1e-3 { nf = fw; } n.fw = norm(nf);
    }

    /// lo que se dibuja (nada: el muñeco es un NPC y el cuerpo del jugador se dibuja con su pose)
    pub(super) fn nat_items(&self, _items: &mut Vec<ItemDin>) {}
}

/// esferaFuera (y empujarDeCuerpo, sin empujar): saca la esfera de centro `c` del mapa y de los cuerpos; devuelve la corrección
fn esfera_fuera(m: &jxjuego::mundo::Mundo, fis: &Fisica, c: &mut V, r: f32) -> V {
    let mut corr = [0.0f32; 3]; let (mut ts, mut cs) = (vec![], vec![]);
    m.cerca(c[0] - r, c[2] - r, c[0] + r, c[2] + r, &mut ts, &mut cs);
    for &t in &ts {
        let n0 = m.normal(t); let a = m.vert(t, 0); let pl = dot(n0, sub(*c, a)); if pl >= r || pl <= -r { continue; }
        let p = m.tri_cercano(t, *c); let d = sub(*c, p); let d2 = dot(d, d); if d2 >= r * r { continue; }
        let dd = d2.sqrt(); let n = if dd > 1e-6 { esc(d, 1.0 / dd) } else { n0 }; let k = r - dd; *c = add(*c, esc(n, k)); corr = add(corr, esc(n, k));
    }
    for &b in &cs { let a = m.cuerpos[b as usize].aabb; if c[0] + r < a[0] || c[0] - r > a[3] || c[1] + r < a[1] || c[1] - r > a[4] || c[2] + r < a[2] || c[2] - r > a[5] { continue; }
        if let Some((n, d)) = m.fuera_de_cuerpo(b as usize, *c, r) { *c = add(*c, esc(n, d)); corr = add(corr, esc(n, d)); } }
    for b in &fis.cuerpos {
        if b.agarrado || b.grupo >= jxjuego::persona::GRUPO_MUNECO || b.sin_fisica { continue; }
        let a = b.aabb(); let (lo, hi) = ([c[0] - r, c[1] - r, c[2] - r].map(|x| x as f64), [c[0] + r, c[1] + r, c[2] + r].map(|x| x as f64)); if hi[0] < a[0] || lo[0] > a[3] || hi[1] < a[1] || lo[1] > a[4] || hi[2] < a[2] || lo[2] > a[5] { continue; }
        for k in 0..fis.partes(b.id).max(1) { if let Some((n, d)) = fis.empuje(b.id, k, v64(*c), r as f64) { let (n, d) = (v32(n), d as f32); *c = add(*c, esc(n, d)); corr = add(corr, esc(n, d)); } }
    }
    corr
}

// ---------------- las poses del jugador (después de animar) ----------------
/// el estado de la animación con el mod: volando o en cuatro patas no corre ni cae (P.suelo, P.vel = 0)
pub fn estado(jg: &Jugabilidad, e: personaje::Estado) -> personaje::Estado {
    if jg.nat.volando || jg.nat.scp { personaje::Estado { vel: [0.0; 3], en_suelo: true, ..e } } else { e }
}
/// lo que se agrega a la pose del jugador después de `animar`: la inclinación y los brazos al volar, las cuatro patas del
/// SCP, la cabeza y los brazos achicados pateando en primera persona y la definitiva del Cíclope
pub fn pose_jugador(jg: &mut Jugabilidad, pj: &mut Personaje, jug: &Jugador, mundo: Option<&jxjuego::mundo::Mundo>, camara: u8, dt: f32) {
    // (lo achicado del cuadro anterior vuelve a su tamaño)
    for (i, s) in jg.pat.escalas.drain(..) { pj.poner_escala(i, s); }
    let mut cambio = false;
    if jg.nat.volando { natural_vuelo(jg, pj, jug, dt); cambio = true; }
    else { jg.nat.vuelo.hay = false; }
    // (en cuatro patas no lleva el arma: personas.js, P.arma && !P.cuad)
    if jg.nat.scp { pj.armar(None); if let Some(m) = mundo { scp_pose(jg, pj, jug, m, dt); cambio = true; } }
    if jg.cic.mia() || jg.cic.manos { cic_juego::pose(jg, pj, jug, mundo); cambio = true; }
    // (pateando en primera persona: la cabeza y los brazos achicados a nada, se ve la pierna)
    if jg.pat.activa && camara == 0 {
        for n in ["Head", "LeftShoulder", "RightShoulder"] { if let Some(i) = pj.indice(n) { let s = pj.escala(i); jg.pat.escalas.push((i, s)); pj.poner_escala(i, esc(s, 0.001)); } }
        cambio = true;
    }
    if cambio { pj.rehacer(); }
}
/// natInclinar y natVueloPose: el cuerpo inclinado con resortes (pivote en la cadera) y, a toda velocidad, el brazo
/// derecho adelante, el izquierdo pegado y las piernas juntas que se balancean
fn natural_vuelo(jg: &mut Jugabilidad, pj: &mut Personaje, jug: &Jugador, dt: f32) {
    let vel = jug.vel; let yaw = jug.yaw; let v = &mut jg.nat.vuelo;
    if !v.hay { *v = Vuelo { yaw, va: vel, hay: true, ..Vuelo::default() }; }
    let (fy, ry) = ([yaw.sin(), 0.0, yaw.cos()], [-yaw.cos(), 0.0, yaw.sin()]); let (vf, vr) = (dot(vel, fy), dot(vel, ry));
    let dy = ang_dif(yaw - v.yaw); v.yaw = yaw; let yr = if dt > 0.0 { dy / dt } else { 0.0 };
    let acc = esc(sub(vel, v.va), 1.0 / dt.max(1e-3)); v.va = vel; let (af, ar) = (dot(acc, fy).clamp(-60.0, 60.0), dot(acc, ry).clamp(-60.0, 60.0));
    v.ar += (ar - v.ar) * (dt * 8.0).min(1.0);
    let tp = (vf.atan2(7.0) * 1.15 - vel[1].clamp(-20.0, 20.0) * 0.012).clamp(-0.55, 1.42); let tr = (v.ar * 0.05 - yr.clamp(-6.0, 6.0) * 0.12 + vr * 0.004).clamp(-0.9, 0.9);
    let k = dt.min(0.05);
    v.pv += ((tp - v.px) * 38.0 - v.pv * 6.5) * k; v.px += v.pv * k;
    v.rv += ((tr - v.rx) * 34.0 - v.rv * 6.0) * k; v.rx += v.rv * k;
    v.lv += (((-af * 0.025).clamp(-0.7, 0.7) - v.lx) * 26.0 - v.lv * 2.6) * k; v.lx += v.lv * k;
    let incl = qmul(qeje([1.0, 0.0, 0.0], v.px), qeje([0.0, 0.0, 1.0], v.rx));
    // (la raíz: girada con el pivote en la cadera —1 m arriba de los pies, menos en los bajitos—)
    let h = 0.95 * pj.tam; let d = qrot(incl, [0.0, -h, 0.0]); pj.poner_raiz(mapa::trs([d[0], h + d[1], d[2]], incl, [1.0; 3])); pj.rehacer_matrices();
    let (up, fw, iz) = (qrot(incl, [0.0, 1.0, 0.0]), qrot(incl, [0.0, 0.0, 1.0]), qrot(incl, [1.0, 0.0, 0.0]));
    let k = ((largo(vel) - 3.0) / 12.0).clamp(0.0, 1.0);
    let (ra, rf, rh, la, lf, lh) = (pj.indice("RightArm"), pj.indice("RightForeArm"), pj.indice("RightHand"), pj.indice("LeftArm"), pj.indice("LeftForeArm"), pj.indice("LeftHand"));
    hueso_apuntar(pj, ra, rf, up, 0.92 * k); hueso_apuntar(pj, rf, rh, up, 0.92 * k);
    let bajo = norm(add(esc(up, -0.9), esc(iz, 0.25)));
    hueso_apuntar(pj, la, lf, bajo, 0.7 * k); hueso_apuntar(pj, lf, lh, bajo, 0.7 * k);
    for (u, l, f, s) in [("LeftUpLeg", "LeftLeg", "LeftFoot", 1.0f32), ("RightUpLeg", "RightLeg", "RightFoot", -1.0)] {
        let d = norm(add(add(esc(up, -1.0), esc(fw, v.lx * 0.8 + (1.0 - k) * 0.25)), esc(iz, s * 0.04)));
        let (iu, il, i_f) = (pj.indice(u), pj.indice(l), pj.indice(f));
        hueso_apuntar(pj, iu, il, d, 0.75 + 0.2 * k); hueso_apuntar(pj, il, i_f, norm(add(d, esc(fw, -0.35 * (1.0 - k)))), 0.7 + 0.25 * k);
    }
}
/// natCuadPose: la pose en cuatro patas y el paso procedural (en el mundo y llevado al espacio del personaje)
fn scp_pose(jg: &mut Jugabilidad, pj: &mut Personaje, jug: &Jugador, m: &jxjuego::mundo::Mundo, dt: f32) {
    let Some(hips) = pj.indice("Hips") else { return };
    let base = personaje::base([jug.pos[0], jug.pos[1] - 0.95, jug.pos[2]], jug.yaw); let qy = qeje([0.0, 1.0, 0.0], jug.yaw);
    // (la pose de reposo, con la raíz en el origen: de ahí sale dónde está la cadera)
    for i in 0..pj.n_nodos() { pj.poner_giro(i, pj.giro_base(i)); } pj.poner_raiz(m4::id()); pj.rehacer_matrices();
    let rp = pos_de(&pj.mundo(hips));
    let up = norm(jg.nat.up); let fw0 = if largo(jg.nat.fw) > 0.1 { jg.nat.fw } else { [jug.yaw.sin(), 0.0, jug.yaw.cos()] };
    let x = norm(cruz(up, fw0)); let fw = norm(cruz(x, up));
    let qs = q_base(x, up, fw); let qr = qmul(qs, qeje([1.0, 0.0, 0.0], std::f32::consts::FRAC_PI_2));
    let vt = sub(jug.vel, esc(up, dot(jug.vel, up))); let sp = largo(vt);
    let tam = pj.tam;
    if jg.nat.patas.is_empty() {
        for (u, k, a, s, brazo, g) in [("LeftArm", "LeftForeArm", "LeftHand", 1.0, true, 0u8), ("RightArm", "RightForeArm", "RightHand", -1.0, true, 1), ("LeftUpLeg", "LeftLeg", "LeftFoot", 1.0, false, 1), ("RightUpLeg", "RightLeg", "RightFoot", -1.0, false, 0)] {
            jg.nat.patas.push(Pata { iu: pj.indice(u), ik: pj.indice(k), ia: pj.indice(a), s, brazo, g, p: None, de: [0.0; 3], a: [0.0; 3], t: 1.0, nuevo: false });
        }
    }
    let en_paso = jg.nat.patas.iter().any(|f| f.t < 1.0);
    let hips_w = add(add(jug.pos, esc(fw, -0.3)), esc(up, if en_paso { 0.025 } else { 0.0 }));
    let raiz_w = sub(hips_w, qrot(qr, rp));
    // (en el espacio del personaje: la base es el piso y el giro)
    let qr_pj = qmul(qconj(qy), qr); pj.poner_raiz(mapa::trs(al_pj(&base, raiz_w), qr_pj, [1.0; 3])); pj.rehacer_matrices();
    // cabeza: mira adelante (el cuello y la cabeza se levantan)
    let eje_c = dir_al_pj(&base, esc(x, -1.0)); let (cu, ca) = (pj.indice("Neck"), pj.indice("Head")); girar_mundo(pj, cu, eje_c, 0.75); girar_mundo(pj, ca, eje_c, 0.55); pj.rehacer_matrices();
    let en_aire = !jg.nat.pegado;
    let largo_p = (0.3 + sp * 0.055).clamp(0.3, 1.05); let dur = (0.27 - sp * 0.009).clamp(0.1, 0.27); let alto = 0.09 + (sp * 0.012).min(0.2);
    let mundo_de = |pj: &Personaje, i: usize| pt(&base, pos_de(&pj.mundo(i)));
    for k in 0..jg.nat.patas.len() {
        let f = jg.nat.patas[k].clone(); let (Some(iu), Some(_), Some(_)) = (f.iu, f.ik, f.ia) else { continue };
        let raiz_p = mundo_de(pj, iu); let mut lead = esc(vt, if f.brazo { 0.11 } else { 0.09 }); if largo(lead) > 0.5 { lead = esc(lead, 0.5 / largo(lead)); }
        let casa0 = add(add(raiz_p, esc(x, f.s * if f.brazo { 0.12 } else { 0.07 } * tam)), lead);
        let hit = if en_aire { None } else { m.rayo(add(casa0, esc(up, 0.3)), esc(up, -1.0), 1.7).map(|g| add(add(casa0, esc(up, 0.3)), esc(up, -g.t))) };
        let casa = hit.unwrap_or(sub(casa0, esc(up, 0.45)));
        let otro = jg.nat.patas.iter().any(|g| g.g != f.g && g.t < 1.0);
        let p = &mut jg.nat.patas[k];
        if p.p.map_or(true, |q| dist(q, raiz_p) > 2.2) { p.p = Some(casa); p.t = 1.0; }
        if hit.is_none() { p.p = Some(mezcla(p.p.unwrap(), casa, (dt * 10.0).min(1.0))); p.t = 1.0; }
        else if p.t >= 1.0 && dist(p.p.unwrap(), casa) > largo_p && !otro {
            let g = p.g; for q in jg.nat.patas.iter_mut() { if q.g == g && q.t >= 1.0 { if let Some(pp) = q.p { q.de = pp; q.t = 0.0; q.nuevo = true; } } }
        }
        let p = &mut jg.nat.patas[k];
        if p.nuevo { p.a = casa; p.nuevo = false; }
        if p.t < 1.0 { p.t = (p.t + dt / dur).min(1.0); let u = p.t * p.t * (3.0 - 2.0 * p.t); p.p = Some(add(mezcla(p.de, p.a, u), esc(up, (std::f32::consts::PI * p.t).sin() * alto))); p.a = mezcla(p.a, casa, (dt * 6.0).min(1.0)); }
    }
    // brazos y piernas hasta cada pie (manos apoyadas con la palma abajo, pies planos)
    let q_mi = q_base(fw, up, cruz(fw, up)); let mfw = esc(fw, -1.0); let q_md = q_base(mfw, up, cruz(mfw, up));
    for f in jg.nat.patas.clone() {
        let Some(p) = f.p else { continue };
        let t = add(p, esc(up, if f.brazo { 0.05 } else { 0.09 }));
        let polo = if f.brazo { add(esc(fw, -1.0), esc(x, f.s * 0.7)) } else { add(fw, esc(up, -0.35)) };
        let q_fin_w = qmul(if f.brazo { if f.s > 0.0 { q_mi } else { q_md } } else { qs }, f.ia.map(|i| pj.giro_reposo(i)).unwrap_or([0.0, 0.0, 0.0, 1.0]));
        ik2(pj, f.iu, f.ik, f.ia, al_pj(&base, t), dir_al_pj(&base, polo), Some(qmul(qconj(qy), q_fin_w)));
    }
}
