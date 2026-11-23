//! Las armas de fuego y de golpe, como armas.js: disparar (balas con su dispersión y los 8 perdigones de la escopeta, que
//! empujan lo que tocan; cohetes que explotan y flechas que se clavan, como proyectiles), los golpes (la palanca sabe al
//! toque si pega; las manos y el bate pegan 0,12 s después), la recarga, las explosiones (empujan y dañan los objetos y al
//! jugador; los barriles explotan) y el daño al jugador. Es un hijo de comun.rs (usa el juego por dentro).
use super::*;
use jxjuego::vista;

/// un proyectil (lanzarProyectil): el prefab que se dibuja, dónde está, su velocidad, cuánto lo baja la gravedad, el daño,
/// si explota, cuánto le queda y, la flecha, a qué cuerpo quedó clavada (y dónde y cómo en él)
pub struct Proy { pub nombre: String, pub pos: [f32; 3], pub vel: [f32; 3], pub grav: f32, pub dan: f32, pub explota: bool, pub vida: f32, pub clavado: Option<(Option<u32>, [f32; 3], [f32; 4])>, pub q: [f32; 4] }

fn norm(v: [f32; 3]) -> [f32; 3] { let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt(); if l > 1e-9 { [v[0] / l, v[1] / l, v[2] / l] } else { v } }
fn qconj(q: [f32; 4]) -> [f32; 4] { [-q[0], -q[1], -q[2], q[3]] }
fn qrot(q: [f32; 4], v: [f32; 3]) -> [f32; 3] {
    let (x, y, z, w) = (q[0], q[1], q[2], q[3]); let (ix, iy, iz, iw) = (w * v[0] + y * v[2] - z * v[1], w * v[1] + z * v[0] - x * v[2], w * v[2] + x * v[1] - y * v[0], -x * v[0] - y * v[1] - z * v[2]);
    [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]
}
/// el giro que mira hacia `d` (qMirar)
fn q_mirar(d: [f32; 3]) -> [f32; 4] { super::qcam(d[0].atan2(d[2]), d[1].clamp(-1.0, 1.0).asin()) }

impl Juego {
    /// disparar (armas.js): el arma en la mano, si no está ocupada ni esperando la cadencia
    pub(super) unsafe fn disparar(&mut self, m: &mut Motor3d) {
        let i = self.armas.i; let d = &ARMAS[i];
        if self.armas.ocup > 0.0 || self.armas.t > 0.0 || !matches!(d.tipo, "bala" | "perdigones" | "cohete" | "flecha" | "golpe") { return; }
        if d.car > 0 && self.armas.balas.get(i).copied().unwrap_or(d.car) == 0 { self.recargar(); return; }
        self.armas.t = d.cad;
        if let Some(pj) = self.pj.as_mut() { pj.accion(personaje::Gesto::Tiro); }   // (humAccion 'tiro')
        // (en una sala: el tiro a los demás, desde mis ojos hacia donde apunto)
        if self.en_red.en_sala() { let (o, f) = (self.ojos_ult, self.mira()); self.en_red.red.disparo(d.n, [o[0] as f64, o[1] as f64, o[2] as f64], [f[0] as f64, f[1] as f64, f[2] as f64]); }
        let (o, dir) = (self.ojos_ult, self.mira());
        let sf = if d.s_f.is_empty() { "" } else { d.s_f[(self.armas.azar01() * d.s_f.len() as f32) as usize % d.s_f.len()] };
        match d.tipo {
            "bala" | "perdigones" => {
                if let Some(b) = self.armas.balas.get_mut(i) { *b = b.saturating_sub(1); }
                let k = if d.tipo == "perdigones" { 8 } else { 1 };
                let disp = if d.tipo == "perdigones" { 0.06 } else { (if d.disp > 0.0 { d.disp } else { 0.004 }) * if self.armas.zoom { 0.2 } else { 1.0 } * (1.0 - 0.6 * self.armas.ap_k) };
                for _ in 0..k {
                    let mut r = dir; for e in 0..3 { r[e] += (self.armas.azar01() - 0.5) * disp * 2.0; } let r = norm(r);
                    self.impacto_bala(o, r, d.dan);
                }
                self.armas.anim = Some(d.fuego); if !sf.is_empty() { self.sonido.tocar(sf, 0.8, 1.0, None); }
                // (el fogonazo en la boca del arma, con su luz)
                let boca = self.vista.as_ref().filter(|_| self.camara == 0).and_then(|v| v.punta()).unwrap_or([o[0] + dir[0] * 0.5, o[1] - 0.2, o[2] + dir[2] * 0.5]); self.ef.fogonazo(boca);
                // (el arma sube la mira)
                self.jug.pitch = (self.jug.pitch + if d.tipo == "perdigones" { 0.04 } else if d.dan > 50.0 { 0.03 } else { 0.008 }).min(1.55); self.armas.retro = 1.0;
            }
            "cohete" | "flecha" => {
                if let Some(b) = self.armas.balas.get_mut(i) { *b = b.saturating_sub(1); }
                self.armas.anim = Some(d.fuego); if !sf.is_empty() { self.sonido.tocar(sf, 0.8, 1.0, None); }
                // (sale 0,8 m adelante de los ojos sobre la mira; pegado a una pared, de los ojos)
                let mut p = [o[0] + dir[0] * 0.8, o[1] + dir[1] * 0.8, o[2] + dir[2] * 0.8];
                if self.mapa.as_ref().and_then(|mp| mp.mundo.rayo(o, dir, 0.8)).is_some() { p = o; }
                let (nom, vel, grav, ex) = if d.tipo == "cohete" { ("RPG Rocket", 38.0, 0.0, true) } else { ("Arrow", 70.0, 1.0, false) };
                self.lanzar(m, nom, p, dir, vel, grav, d.dan, ex);
            }
            _ => {
                // los golpes: la palanca sabe en el momento si pega (y elige la animación); las manos y el bate, 0,12 s después
                if !d.pega.is_empty() {
                    let pega = self.rayo_obj(o, dir, d.alcance).is_some();
                    let l = if pega { d.pega } else { d.falla }; let c = l[(self.armas.azar01() * l.len() as f32) as usize % l.len()];
                    self.armas.anim = Some(c);
                    if pega { self.golpe_aplicar(i); } else if !sf.is_empty() { self.sonido.tocar(sf, 0.7, 1.0, None); }
                } else {
                    let c = if !d.fuego2.is_empty() && self.armas.azar01() < 0.5 { d.fuego2 } else { d.fuego }; self.armas.anim = Some(c);
                    if !sf.is_empty() { self.sonido.tocar(sf, 0.6, 1.0, None); }
                    self.armas.golpe_t = 0.12;
                }
            }
        }
    }
    /// recargar: con la duración del clip de recarga del arma
    pub(super) fn recargar(&mut self) {
        let d = self.armas.def();
        let dur = self.paq.as_ref().and_then(|p| self.clips.de(&p.d, d.recarga)).map(|c| c.d).unwrap_or(0.0);
        let antes = self.armas.recargando; self.armas.recargar(dur);
        if self.armas.recargando > 0.0 && antes <= 0.0 { if let Some(pj) = self.pj.as_mut() { pj.accion(personaje::Gesto::Recarga); } }
    }
    /// el rayo del mapa y de los objetos (raycast): la distancia, el punto, la normal y el cuerpo, si lo hay
    fn rayo_obj(&mut self, o: [f32; 3], d: [f32; 3], max: f32) -> Option<(f32, [f32; 3], [f32; 3], Option<u32>)> {
        let mp = self.mapa.as_ref()?;
        let g = self.fis.rayo(&mp.mundo, [o[0] as f64, o[1] as f64, o[2] as f64], [d[0] as f64, d[1] as f64, d[2] as f64], max as f64, &[])?;
        Some((g.t as f32, [g.p[0] as f32, g.p[1] as f32, g.p[2] as f32], [g.n[0] as f32, g.n[1] as f32, g.n[2] as f32], g.cuerpo))
    }
    /// impactoBala: el rayo hasta 400 m; la traza desde la boca del arma; lo que toca lo empuja (según su masa) y lo daña
    fn impacto_bala(&mut self, o: [f32; 3], d: [f32; 3], dan: f32) {
        let h = self.rayo_obj(o, d, 400.0);
        let fin = h.map(|x| x.1).unwrap_or([o[0] + d[0] * 400.0, o[1] + d[1] * 400.0, o[2] + d[2] * 400.0]);
        let boca = self.vista.as_ref().filter(|_| self.camara == 0).and_then(|v| v.punta()).unwrap_or([o[0], o[1] - 0.2, o[2]]);
        self.ef.traza(boca, fin);
        // (el impacto: polvo y un agujero en el mapa; chispas en un cuerpo)
        if let Some((_, p, n, cu)) = h { self.ef.impacto(p, n, if cu.is_some() { Sup::Cuerpo } else { Sup::Mundo }); }
        let Some((_, p, _n, Some(id))) = h else { return };
        if let Some(b) = self.fis.cuerpo_mut(id) {
            b.despertar();
            if b.dinamico() { let k = (dan * 0.6 / (b.masa as f32 * 0.05).max(1.0)).min(8.0); let r = [p[0] as f64 - b.pos[0], p[1] as f64 - b.pos[1], p[2] as f64 - b.pos[2]]; b.aplicar_vel([(d[0] * k) as f64, (d[1] * k) as f64, (d[2] * k) as f64], r, 1.0); }
        }
        if let Some(i) = self.objs.iter().position(|x| x.cuerpo == Some(id)) { self.danar_objeto(i, dan); }
        if let Some(n) = self.npcs.de_cuerpo(id) { self.npcs.danar(n, dan, p, d, &mut self.fis, Some(npc::Quien::Jugador)); }
        self.vehs.danar(&self.fis, id, dan as f64);
    }
    /// golpeAplicar: lo que se apuntó, a alcance del golpe: el sonido (metal o carne), el empujón (la palanca como en HL2)
    /// y el daño
    pub(super) fn golpe_aplicar(&mut self, i: usize) {
        let d = &ARMAS[i]; let (o, f) = (self.ojos_ult, self.mira());
        let Some((_, p, nn, cu)) = self.rayo_obj(o, f, d.alcance) else { return };
        self.ef.impacto(p, nn, Sup::Golpe);
        let s = if d.s_imp.is_empty() { "Melee1" } else { d.s_imp[(self.armas.azar01() * d.s_imp.len() as f32) as usize % d.s_imp.len()] };
        self.sonido.tocar(s, 0.8, 1.0, Some(p));
        let Some(id) = cu else { return };
        if let Some(b) = self.fis.cuerpo_mut(id) {
            b.despertar();
            if b.dinamico() {
                let k = if d.empuje > 0.0 { d.empuje.min(b.masa as f32 * 7.0) } else { (d.dan * 4.0 / (b.masa as f32 * 0.2).max(1.0)).min(10.0) };
                let r = [p[0] as f64 - b.pos[0], p[1] as f64 - b.pos[1], p[2] as f64 - b.pos[2]]; b.aplicar_vel([(f[0] * k) as f64, (f[1] * k) as f64, (f[2] * k) as f64], r, 1.0);
            }
        }
        if let Some(k) = self.objs.iter().position(|x| x.cuerpo == Some(id)) { self.danar_objeto(k, d.dan); }
        if let Some(n) = self.npcs.de_cuerpo(id) { self.npcs.danar(n, d.dan, p, f, &mut self.fis, Some(npc::Quien::Jugador)); }
    }
    /// lanzarProyectil (el modelo del prefab, si está)
    unsafe fn lanzar(&mut self, m: &mut Motor3d, nombre: &str, p: [f32; 3], d: [f32; 3], vel: f32, grav: f32, dan: f32, explota: bool) {
        if !self.prefabs.contains_key(nombre) { if let Some(paq) = self.paq.as_mut() { if let Ok((pf, esc)) = objetos::armar(paq, &self.nombres, nombre, 512, &mut self.cargados) { if m.cargar(&esc).is_ok() { self.prefabs.insert(nombre.to_string(), pf); } } } }
        self.proys.push(Proy { nombre: nombre.to_string(), pos: p, vel: [d[0] * vel, d[1] * vel, d[2] * vel], grav, dan, explota, vida: 6.0, clavado: None, q: q_mirar(d) });
    }
    /// proyectilesPaso: caen, chocan (el cohete explota; la flecha se clava, empuja y daña) y se van a los 6 s (clavadas, 20)
    pub(super) fn proyectiles_paso(&mut self, dt: f32) {
        let g = self.mapa.as_ref().map(|mp| mp.mundo.gravedad).unwrap_or(1.0) * 9.81;
        let mut explotan = vec![]; let mut k = 0;
        while k < self.proys.len() {
            self.proys[k].vida -= dt; if self.proys[k].vida <= 0.0 { self.proys.remove(k); continue; }
            if let Some((cu, rl, ql)) = self.proys[k].clavado {
                if let Some(b) = cu.and_then(|id| self.fis.cuerpo(id)) { let bq = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]; let r = qrot(bq, rl); self.proys[k].pos = [b.pos[0] as f32 + r[0], b.pos[1] as f32 + r[1], b.pos[2] as f32 + r[2]]; self.proys[k].q = qmul32(bq, ql); }
                k += 1; continue;
            }
            let (pos, mut vel, gr) = (self.proys[k].pos, self.proys[k].vel, self.proys[k].grav);
            vel[1] -= g * gr * dt; self.proys[k].vel = vel;
            let v = (vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]).sqrt(); let d = norm(vel);
            if let Some((_, p, _n, cu)) = self.rayo_obj(pos, d, v * dt) {
                self.proys[k].pos = p;
                if self.proys[k].explota { explotan.push((p, self.proys[k].dan)); self.proys.remove(k); continue; }
                // (la flecha: queda clavada; empuja y daña lo que toca)
                self.sonido.tocar("Melee1", 0.5, 1.4, Some(p)); self.ef.impacto(p, _n, Sup::Golpe);
                let dan = self.proys[k].dan;
                if let Some(id) = cu {
                    if let Some(b) = self.fis.cuerpo_mut(id) {
                        b.despertar(); let r = [p[0] as f64 - b.pos[0], p[1] as f64 - b.pos[1], p[2] as f64 - b.pos[2]]; b.aplicar_vel([(d[0] * 3.0) as f64, (d[1] * 3.0) as f64, (d[2] * 3.0) as f64], r, 1.0);
                        let bq = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]; let rl = qrot(qconj(bq), [p[0] - b.pos[0] as f32, p[1] - b.pos[1] as f32, p[2] - b.pos[2] as f32]);
                        self.proys[k].clavado = Some((Some(id), rl, qmul32(qconj(bq), q_mirar(d))));
                    }
                    if let Some(i) = self.objs.iter().position(|x| x.cuerpo == Some(id)) { self.danar_objeto(i, dan); }
                } else { self.proys[k].clavado = Some((None, [0.0; 3], [0.0, 0.0, 0.0, 1.0])); }
                self.proys[k].vida = 20.0; k += 1; continue;
            }
            self.proys[k].pos = [pos[0] + vel[0] * dt, pos[1] + vel[1] * dt, pos[2] + vel[2] * dt]; self.proys[k].q = q_mirar(d);
            // (el cohete deja humo)
            if self.proys[k].explota && self.armas.azar01() < 0.7 { let pp = self.proys[k].pos; self.ef.particula(pp, [-vel[0] * 0.05, -vel[1] * 0.05, -vel[2] * 0.05], 0.6, 0.35, [0.7, 0.7, 0.7, 0.5], efx::Tipo::Humo, 0.0); }
            k += 1;
        }
        for (p, dan) in explotan { self.explosion(p, 6.0, dan); }
        // (los barriles que les llegó la hora de explotar —60 ms después del golpe—)
        let ahora = self.t0.elapsed().as_secs_f32();
        let listos: Vec<u32> = self.por_explotar.iter().filter(|x| ahora >= x.1).map(|x| x.0).collect();
        self.por_explotar.retain(|x| ahora < x.1);
        for id in listos { if let Some(i) = self.objs.iter().position(|o| o.id == id) { let p = self.objs[i].pos; self.borrar_obj(i); self.explosion(p, 6.0, 100.0); } }
    }
    /// explosion: el sonido, el temblor, los cuerpos empujados (y girados) según la distancia, el daño a los objetos y al
    /// jugador (que también sale empujado)
    pub(super) fn explosion(&mut self, p: [f32; 3], radio: f32, dan: f32) {
        // (una que nace acá, en una sala: a los demás; la que llega de otro no se vuelve a mandar)
        if !self.en_red.desde_red && self.en_red.en_sala() { self.en_red.red.explosion([p[0] as f64, p[1] as f64, p[2] as f64], radio as f64, dan as f64, None); }
        self.sonido.tocar("GrenadeExplode", 1.4, 1.0, Some(p));
        // (el fuego, el humo, las chispas, la luz y la quemadura en el piso: efectoExplosion)
        let esc = (radio / 6.0).clamp(0.6, 3.0); let piso = self.mapa.as_ref().and_then(|mp| efx::piso_bajo(&mp.mundo, p, esc)); self.ef.explosion(p, esc, piso);
        let ids: Vec<u32> = self.fis.cuerpos.iter().filter(|b| b.dinamico() || b.congelado).map(|b| b.id).collect();
        let mut danos = vec![];
        for id in ids {
            let (az1, az2, az3) = (self.armas.azar01() - 0.5, self.armas.azar01() - 0.5, self.armas.azar01() - 0.5);
            let Some(b) = self.fis.cuerpo_mut(id) else { continue };
            let d = [b.pos[0] as f32 - p[0], b.pos[1] as f32 - p[1], b.pos[2] as f32 - p[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
            if l > radio * 1.6 { continue; }
            let k = 1.0 - l / (radio * 1.6); b.despertar();
            if b.dinamico() {
                let f = k * 22.0 * (300.0 / b.masa as f32 + 0.15).min(1.0); let l1 = l.max(1e-3);
                for e in 0..3 { b.vel[e] += (d[e] / l1 * f) as f64; } b.vel[1] += (k * 6.0) as f64;
                b.ang[0] += (az1 * k * 6.0) as f64; b.ang[1] += (az2 * k * 6.0) as f64; b.ang[2] += (az3 * k * 6.0) as f64;
            }
            danos.push((id, dan * k));
        }
        for (id, dk) in danos { if let Some(i) = self.objs.iter().position(|o| o.cuerpo == Some(id)) { self.danar_objeto(i, dk); } self.vehs.danar(&self.fis, id, dk as f64); }
        // (los NPC de pie en el radio: daño y, si es fuerte, al piso)
        let cerca: Vec<(u32, [f32; 3])> = self.npcs.lista.iter().filter(|n| n.en_pie()).map(|n| (n.id, n.pos())).collect();
        for (n, q) in cerca {
            let d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]; let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt(); if l > radio * 1.6 { continue; }
            let k = 1.0 - l / (radio * 1.6); let nd = norm(d);
            self.npcs.danar(n, dan * k, q, nd, &mut self.fis, Some(npc::Quien::Jugador));
        }
        let jp = self.jug.pos; let dj = ((jp[0] - p[0]).powi(2) + (jp[1] - p[1]).powi(2) + (jp[2] - p[2]).powi(2)).sqrt();
        if dj < radio * 1.4 {
            let k = 1.0 - dj / (radio * 1.4); self.danar_jugador(dan * k);
            let n = norm([jp[0] - p[0], jp[1] - p[1], jp[2] - p[2]]); for e in 0..3 { self.jug.vel[e] += n[e] * 12.0 * k; } self.jug.vel[1] += 4.0;
        }
        self.temblor = self.temblor.max((1.5 - dj / 30.0).clamp(0.0, 1.0));
    }
    /// danarObjeto: los explosivos pierden vida (dan/40) y, al llegar a 0, explotan 60 ms después
    pub(super) fn danar_objeto(&mut self, i: usize, dan: f32) {
        let ahora = self.t0.elapsed().as_secs_f32();
        let o = &mut self.objs[i];
        if o.tipo == "explota" && !o.exploto { o.vida -= dan / 40.0; if o.vida <= 0.0 { o.exploto = true; self.por_explotar.push((o.id, ahora + 0.06)); } }
    }
    /// danarJugador: la vida (a 0, vuelve a aparecer)
    pub(super) fn danar_jugador(&mut self, dan: f32) {
        if dan <= 0.0 { return; }
        self.jug.vida -= dan; self.golpe_t = 0.4;
        if let Some(pj) = self.pj.as_mut() { pj.accion(personaje::Gesto::Golpe); }
        if self.jug.vida <= 0.0 { self.jug.vida = 0.0; self.muerto = true; }
    }
    /// los proyectiles para dibujar (dibujarProyectiles) y las trazas de las balas
    pub(super) fn proyectiles_items(&self, items: &mut Vec<jxmotor::escena::ItemDin>) {
        for p in &self.proys {
            let Some(pf) = self.prefabs.get(&p.nombre) else { continue };
            pf.items(&mapa::trs(p.pos, p.q, [1.0; 3]), items);
        }
        let _ = vista::TUBO_MAT;
    }
}
