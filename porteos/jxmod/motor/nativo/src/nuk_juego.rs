//! Las nucleares (nucleares.js) y los artefactos (artefactos.js) en el juego.
//! Nucleares (Props → Nucleares): Usar (E) arma la bomba (sirena y cuenta regresiva de 10 s, 15 en las de megatones);
//! armada, también explota si se la golpea fuerte. La explosión (los números en jxjuego::nucleares): destello que
//! encandila, bola de fuego, onda que avanza y empuja, rompe y lastima lo que alcanza (muerte segura en la bola), el
//! estruendo con la demora del sonido, el viento (la ráfaga hacia afuera, el polvo del frente y el retorno), el hongo
//! que sube y queda, y las de superficie dejan radiación. El hongo va con volumen como en la web (nuclear_vol.js:
//! jxmotor::hongo, en OpenGL 3 y 2 con la calidad en Bajo o más); en Patata, en Vulkan o si la placa no puede, con los
//! carteles de nukeCarteles.
//! Artefactos (Props → Diversión): la catapulta (Usar: el brazo gira y lo que está en la cuchara sale volando) y la
//! bomba de Rick Prime (Usar: se elige a qué personaje borrar; 5 s con pitidos y luz verde, y elimina a todos los que
//! tienen ese personaje).
use super::*;
use jxjuego::nucleares::{self as nk, Bomba, Explosion};
use std::collections::{HashMap, HashSet};

/// una bomba armada: el objeto, cuánto le queda, el próximo pitido y la velocidad del cuadro anterior (golpes)
pub struct Armada { pub id: u32, t: f32, bip: f32, v_ant: Option<f32>, bum: bool }
/// el viento de una explosión que me alcanzó (cuándo, con qué fuerza, cuánto dura, si ya sonó el soplido)
#[derive(Default)]
struct Viento { t0: Option<f32>, k: f32, dura: f32, sop: bool }
/// una que explotó: los números, la bomba, lo que ya tocó la onda, si ya me alcanzó, si ya sonó, el viento
struct Viva { e: Explosion, tocados: HashSet<u32>, jug: bool, son: bool, viento: Viento }
/// una zona con radiación: dónde, el radio y cuánto le queda
struct Zona { p: V, r: f32, t: f32 }
#[derive(Default)]
pub struct Nuk {
    pub armadas: Vec<Armada>, vivas: Vec<Viva>, zonas: Vec<Zona>,
    /// el destello (la capa blanca) y la radiación (el borde verde)
    pub flash: f32, flash_i: f32, flash_t: f32, pub rad: f32, rad_aviso: bool, rad_t: f32,
    /// si el motor dibuja el hongo con volumen (lo dice cada cuadro: Motor3d::hongo_listo)
    pub vol: bool,
    n: u32, sonidos: bool, objs_vistos: usize,
    /// los sonidos que vienen después (el rumor y el «después»): cuándo, cuál y el volumen
    luego: Vec<(f32, &'static str, f32)>,
}

const CAT_REPOSO: f32 = -0.3; const CAT_TIRO: f32 = 1.5; const CAT_SUELTA: f32 = 0.8; const CAT_VEL: f32 = 17.0;
const OMEGA_CUENTA: f32 = 5.0;
/// el brazo de la catapulta (CatapultaBrazo): sus partes, el eje largo hacia la cuchara, la argolla y la cuchara
#[derive(Clone)]
pub struct Brazo { partes: Vec<objetos::Parte>, ac: V, arg: V, cuch: V }
/// una catapulta: el ángulo del brazo, cuándo tiró, si está tirando y si ya soltó; el eje de giro (alto), adelante de la
/// base, el giro del brazo en reposo y el eje de costado; lo que no choca con la base por medio segundo
pub struct Cat { a: f32, t: f32, tiro: bool, lanzo: bool, eje: f32, f: V, q0: Q, lat: V, ign: Vec<u32>, ign_t: f32 }
/// la bomba de Rick Prime armada: a quién borra, cuánto falta y el último segundo que sonó
pub struct Omega { skin: String, cuenta: f32, ult: i32 }
/// el panel para elegir a quién borrar (la bomba, la lista con los de cerca primero y si el atlas de retratos está)
pub struct PanelOmega { pub obj: u32, lista: Vec<(String, bool)>, atlas: bool, atlas_h: u32 }
#[derive(Default)]
pub struct Art {
    cat: HashMap<u32, Cat>, omega: HashMap<u32, Omega>, brazo: Option<Option<Brazo>>, brazo_esc: Option<Escena>,
    /// el destello verde (y dónde fue)
    pub flash: f32, pub flash_p: Option<V>,
    pub panel: Option<PanelOmega>,
}

impl Juego {
    // ---------------- nucleares ----------------
    /// la bomba de un prefab (DATA.pf[k][0].nk)
    pub(super) fn nuk_bomba(&self, nombre: &str) -> Option<Bomba> { if !nombre.starts_with("NK_") { return None; } let paq = self.paq.as_ref()?; Bomba::de(&paq.d["pf"][self.nombres.get(nombre)?][0]) }
    /// nukePrecargar: los sonidos de las bombas vienen en un paquete aparte (p_nuk): se anotan una vez (en el celular se
    /// decodifican con el del sistema)
    fn nuk_precargar(&mut self) {
        if self.jg.nuk.sonidos { return; } self.jg.nuk.sonidos = true;
        let Some(paq) = self.paq.as_mut() else { return }; let _ = paq.asegurar("p_nuk");
        let Some(dir) = self.datos.as_ref().map(|d| d.join("nuk")) else { return }; let _ = std::fs::create_dir_all(&dir);
        for n in ["NK_abomb", "NK_abomb_big", "NK_alarma", "NK_davy", "NK_despues", "NK_fat", "NK_onda", "NK_real", "NK_rumble", "NK_sirena", "NK_trinity", "NK_tsar"] {
            let Some(b) = paq.parte(&format!("a:{n}")) else { continue }; let r = dir.join(format!("{n}.mp3"));
            if !r.exists() { let _ = std::fs::write(&r, b); }
            self.sonido.registrar_archivo(n, &r);
        }
    }
    /// Usar sobre el objeto `i`: si es una nuclear sin armar, la arma (nukeUsar)
    pub(super) fn nuk_usar(&mut self, i: usize) -> bool {
        let o = &self.objs[i]; let Some(b) = self.nuk_bomba(&o.nombre) else { return false };
        if self.jg.nuk.armadas.iter().any(|a| a.id == o.id) { return true; }
        let (id, p) = (o.id, o.pos); let cuenta = if b.kt >= 1000.0 { 15.0 } else { 10.0 };
        self.nuk_precargar();
        self.jg.nuk.armadas.push(Armada { id, t: cuenta, bip: cuenta.ceil(), v_ant: None, bum: false });
        self.sonido.tocar("NK_sirena", 1.2, 1.0, Some(p)); self.avisar(format!("¡Armada! Explota en {} s · {}", cuenta.ceil(), b.ficha()));
        true
    }
    /// nukePaso: las armadas (cuenta regresiva o un golpe fuerte), las que explotaron (la onda y el viento), la radiación y
    /// el destello que se apaga
    pub(super) unsafe fn nuk_paso(&mut self, _m: &mut Motor3d, dt: f32) {
        if self.objs.len() != self.jg.nuk.objs_vistos { self.jg.nuk.objs_vistos = self.objs.len(); if self.objs.iter().any(|o| o.nombre.starts_with("NK_")) { self.nuk_precargar(); } }
        let mut k = 0;
        while k < self.jg.nuk.armadas.len() {
            let id = self.jg.nuk.armadas[k].id; let Some(i) = self.objs.iter().position(|o| o.id == id) else { self.jg.nuk.armadas.remove(k); continue };
            let (p, v) = (self.objs[i].pos, self.objs[i].cuerpo.and_then(|c| self.fis.cuerpo(c)).map(|b| largo(v32(b.vel))).unwrap_or(0.0));
            let a = &mut self.jg.nuk.armadas[k]; a.t -= dt; let golpe = a.v_ant.map_or(false, |va| va - v > 9.0); a.v_ant = Some(v);
            let mut bip = None; if a.t < a.bip - 1.0 { a.bip = a.t.ceil(); bip = Some(if a.t < 3.0 { 1.6 } else { 1.2 }); }
            let bum = (a.t <= 0.0 || golpe) && !a.bum; if bum { a.bum = true; }
            if let Some(t) = bip { self.sonido.tocar("UI_blip", 0.9, t, Some(p)); }
            if bum { let nombre = self.objs[i].nombre.clone(); let c = self.objs[i].cuerpo.and_then(|c| self.fis.cuerpo(c)).map(|b| v32(b.pos)).unwrap_or(p);
                self.jg.nuk.armadas.remove(k); self.borrar_obj(i); self.nuk_explotar(c, &nombre); continue; }
            k += 1;
        }
        let mut i = self.jg.nuk.vivas.len();
        while i > 0 { i -= 1; self.jg.nuk.vivas[i].e.t += dt as f64; self.nuk_onda(i, dt); self.nuk_viento(i, dt); if self.jg.nuk.vivas[i].e.t > self.jg.nuk.vivas[i].e.dura { self.jg.nuk.vivas.remove(i); } }
        self.nuk_radiacion(dt);
        // (los sonidos que vienen después)
        let t = self.jg.t; let ya: Vec<(&'static str, f32)> = self.jg.nuk.luego.iter().filter(|x| x.0 <= t).map(|x| (x.1, x.2)).collect(); self.jg.nuk.luego.retain(|x| x.0 > t);
        for (s, v) in ya { self.sonido.tocar(s, v, 1.0, None); }
        // (el destello: al máximo 0,12 s y después se apaga en un par de segundos)
        let n = &mut self.jg.nuk; if n.flash > 0.0 { n.flash_t += dt; n.flash = n.flash_i * if n.flash_t < 0.12 { 1.0 } else { (-(n.flash_t - 0.12) * 1.7).exp() }; if n.flash < 0.004 { n.flash = 0.0; } }
    }
    /// nukeExplotar: la explosión de la bomba `nombre` en `p0`
    pub(super) fn nuk_explotar(&mut self, p0: V, nombre: &str) {
        let Some(b) = self.nuk_bomba(nombre) else { return }; self.nuk_precargar();
        let piso = self.mapa.as_ref().and_then(|mp| jxjuego::persona::piso_bajo(&mp.mundo, v64([p0[0], p0[1] + 1.0, p0[2]]), 1.0));
        self.jg.nuk.n += 1; let e = Explosion::nueva(v64(p0), piso, b.kt, &b.t, self.jg.nuk.n); let (p, r) = (v32(e.p), e.r as f32);
        // el destello blanco: de cerca encandila del todo; de lejos baja pero no se apaga, y aunque no la mires (menos)
        let cam = self.jg.cam_ult; let d = dist(cam, p); let mira = dot(norm(sub(p, cam)), self.jg.mira_ult);
        if b.t != "subte" { let i = nk::destello(d as f64, r as f64, mira as f64, &b.t) as f32; if i > self.jg.nuk.flash { self.jg.nuk.flash_i = i; self.jg.nuk.flash_t = 0.0; self.jg.nuk.flash = i; } }
        let subte = b.t == "subte";
        self.ef.luz_temporal(add(p, [0.0, r * 0.3, 0.0]), r * 4.0, if subte { [6.0, 4.0, 2.0] } else { [900.0, 600.0, 300.0] }, if subte { 0.5 } else { 2.5 });
        if nk::deja_radiacion(&b.t) { self.jg.nuk.zonas.push(Zona { p: [p[0], e.piso as f32, p[2]], r: r * 0.85, t: 100.0 }); }
        self.jg.nuk.vivas.push(Viva { e, tocados: HashSet::new(), jug: false, son: false, viento: Viento::default() });
    }
    /// (el banco de pruebas: una explosión ya empezada —`t` segundos— en `p`, sin la bomba ni el destello)
    pub fn nuk_prueba(&mut self, p: V, kt: f64, tipo: &str, t: f64) {
        let piso = self.mapa.as_ref().and_then(|mp| jxjuego::persona::piso_bajo(&mp.mundo, v64([p[0], p[1] + 1.0, p[2]]), 50.0));
        self.jg.nuk.n += 1; let mut e = Explosion::nueva(v64(p), piso, kt, tipo, self.jg.nuk.n); e.t = t; e.onda = e.alc * 3.0;
        self.jg.nuk.vivas.push(Viva { e, tocados: HashSet::new(), jug: true, son: true, viento: Viento::default() });
    }
    /// nukeOnda: la onda avanza con su velocidad y a cada cosa la alcanza una vez
    fn nuk_onda(&mut self, i: usize, dt: f32) {
        if self.jg.nuk.vivas[i].e.tipo == "espacio" { self.nuk_sonido(i); return; }
        let e = &mut self.jg.nuk.vivas[i].e; let r0 = e.onda; e.onda = e.alc.min(e.onda + e.vel * dt as f64);
        let (r1, rr, p, alc, subte) = (e.onda as f32, e.r as f32, v32(e.p), e.alc as f32, e.tipo == "subte"); let ev = e.clone();
        if r1 > r0 as f32 {
            let ids: Vec<u32> = self.fis.cuerpos.iter().filter(|b| b.dinamico() || b.congelado).map(|b| b.id).collect();
            let mut danos = vec![];
            for id in ids {
                if self.jg.nuk.vivas[i].tocados.contains(&id) { continue; }
                let es_obj = self.objs.iter().any(|o| o.cuerpo == Some(id));
                let (a1, a2, a3) = (self.azar() - 0.5, self.azar() - 0.5, self.azar() - 0.5);
                let Some(b) = self.fis.cuerpo_mut(id) else { continue };
                let dv = sub(v32(b.pos), p); let l = largo(dv); if l > r1 { continue; }
                self.jg.nuk.vivas[i].tocados.insert(id);
                let k = (1.0 - l / alc).clamp(0.0, 1.0).powf(1.4); let dir = if l > 0.01 { esc(dv, 1.0 / l) } else { [0.0, 1.0, 0.0] };
                if b.congelado && es_obj && l < rr { b.congelado = false; }   // (como en HBOMBS: lo congelado cerca se suelta)
                b.despertar();
                if b.dinamico() {
                    let m = b.masa as f32; let fz = (18.0 + rr * 0.12) * k * (400.0 / m + 0.2).min(1.0);
                    for e in 0..3 { b.vel[e] += (dir[e] * fz) as f64; } b.vel[1] += (fz * 0.35 + if subte { 6.0 * k } else { 0.0 }) as f64;
                    b.ang[0] += (a1 * 8.0 * k) as f64; b.ang[1] += (a2 * 8.0 * k) as f64; b.ang[2] += (a3 * 8.0 * k) as f64;
                    // (y el viento que viene con la onda —nukeVientoCosa—: el empujón no salta en el borde del daño)
                    let fv = ev.viento_cosa(true, m as f64, l as f64) as f32;
                    if fv > 0.0 { let (hx, hz) = (b.pos[0] as f32 - p[0], b.pos[2] as f32 - p[2]); let hl = hx.hypot(hz).max(1e-6); b.vel[0] += (hx / hl * fv) as f64; b.vel[2] += (hz / hl * fv) as f64; b.vel[1] += (fv * 0.25) as f64; }
                }
                danos.push((id, if l < rr * 0.35 { 9999.0 } else { 600.0 * k }, if l < rr * 0.35 { 9999.0 } else { 260.0 * k }, v32(b.pos), dir, k));
            }
            for (id, d_obj, d_per, pos, dir, k) in danos {
                if let Some(j) = self.objs.iter().position(|o| o.cuerpo == Some(id)) { self.danar_objeto(j, d_obj); self.vehs.danar(&self.fis, id, d_obj as f64); }
                if let Some(n) = self.npcs.de_cuerpo(id) { if self.npcs.get(n).map_or(false, |x| x.en_pie()) { self.npcs.danar(n, d_per, pos, dir, &mut self.fis, Some(npc::Quien::Jugador));
                    if self.npcs.get(n).map_or(false, |x| x.rag.is_none() && x.vivo) { self.npcs.tumbar(n, add(esc(dir, 20.0 * k), [0.0, 8.0 * k, 0.0]), &mut self.fis); } } }
            }
            // yo
            let dj = dist(self.jug.pos, p);
            if !self.jg.nuk.vivas[i].jug && dj <= r1 {
                self.jg.nuk.vivas[i].jug = true; let k = (1.0 - dj / alc).clamp(0.0, 1.0).powf(1.4);
                if self.jug.vida > 0.0 && !self.jg.inmune() {
                    self.danar_jugador(if dj < rr * 0.35 { 99999.0 } else { 240.0 * k });
                    if self.vehs.jugador.is_none() { let n = norm(sub(self.jug.pos, p)); for e in 0..3 { self.jug.vel[e] += n[e] * 30.0 * k; } self.jug.vel[1] += 9.0 * k; }
                }
                self.temblor = self.temblor.max((0.4 + k * 1.6).clamp(0.0, 1.5));
            }
        }
        self.nuk_sonido(i);
    }
    /// nukeSonido: el estruendo con la demora del sonido (340 m/s) y el rumor que sigue
    fn nuk_sonido(&mut self, i: usize) {
        let e = &self.jg.nuk.vivas[i].e; let d = dist(self.jg.cam_ult, v32(e.p));
        if self.jg.nuk.vivas[i].son || (e.t as f32) < d / 340.0 { return; }
        let (kt, r, alc, s) = (e.kt, e.r as f32, e.alc as f32, nk::estruendo(e.kt, &e.tipo)); self.jg.nuk.vivas[i].son = true;
        let v = (1.5 - d / (r * 9.0)).clamp(0.3, 1.5); let t = self.jg.t;
        self.sonido.tocar(s, v, 1.0, None); self.jg.nuk.luego.push((t + 1.2, "NK_rumble", v * 0.8)); if kt >= 50.0 { self.jg.nuk.luego.push((t + 6.5, "NK_despues", v * 0.6)); }
        if d < alc * 1.6 { self.temblor = self.temblor.max(0.6); }
    }
    /// nukeViento: la ráfaga hacia afuera cuando me llega (me empuja, tiembla, polvo y basuritas que vuelan y el soplido) y,
    /// mientras sube el hongo, el viento de vuelta; el polvo del frente cerca de la cámara; lo suelto y liviano de afuera
    fn nuk_viento(&mut self, i: usize, dt: f32) {
        let e = self.jg.nuk.vivas[i].e.clone(); if e.tipo == "espacio" || e.tipo == "subte" { return; }
        let (rr, p, alc, vel, t) = (e.r as f32, v32(e.p), e.alc as f32, e.vel as f32, e.t as f32); let alc_v = alc * 3.0; let frente = alc_v.min(vel * t);
        let jp = self.jug.pos; let dj = (jp[0] - p[0]).hypot(jp[2] - p[2]);
        { let w = &mut self.jg.nuk.vivas[i].viento; if w.t0.is_none() && frente >= dj && dj < alc_v { w.t0 = Some(t); w.k = (1.0 - dj / alc_v).clamp(0.0, 1.0).powf(1.2); w.dura = (1.5 + rr / 60.0).clamp(1.5, 6.0); } }
        let (mut k, mut sale) = (0.0f32, 1.0f32); let w = &self.jg.nuk.vivas[i].viento; let (wk, wd, sop) = (w.k, w.dura, w.sop);
        if let Some(t0) = w.t0 {
            let u = t - t0;
            if u < wd { k = wk * (u / 0.15).min(1.0) * (1.0 - u / wd); }   // la ráfaga: sube en 0,15 s y se apaga
            else if t < 40.0 { sale = -1.0; k = wk * 0.28 * ((u - wd) / 3.0).clamp(0.0, 1.0) * ((40.0 - t) / 10.0).clamp(0.0, 1.0); }   // el retorno
            if !sop && wk > 0.02 { self.jg.nuk.vivas[i].viento.sop = true; self.nuk_soplido(wk, wd); }
        }
        let dirj = if dj > 0.5 { [(jp[0] - p[0]) / dj, (jp[2] - p[2]) / dj] } else { [1.0, 0.0] };
        let agua = e.tipo == "agua" || e.tipo == "barco"; let q = self.ef.part;
        if k > 0.002 {
            let (dx, dz) = (dirj[0] * sale, dirj[1] * sale);
            if self.jug.vida > 0.0 && self.vehs.jugador.is_none() && !self.jg.inmune() { let a = (if self.jug.suelo { 75.0 } else { 25.0 }) * k; self.jug.vel[0] += dx * a * dt; self.jug.vel[2] += dz * a * dt; }
            if sale > 0.0 { self.temblor = self.temblor.max(0.25 * k); }
            // (basuritas y polvo que pasan volando al lado de la cámara: unas 45 por segundo con la ráfaga a pleno)
            let lam = q * 45.0 * k * dt; let n = lam.floor() as i32 + (self.azar() < lam.fract()) as i32;
            for _ in 0..n {
                let lat = (self.azar() - 0.5) * 40.0; let adel = -sale * (10.0 + self.azar() * 25.0); let pq = [jp[0] + dx * adel - dz * lat, jp[1] - 1.0 + self.azar() * 2.5, jp[2] + dz * adel + dx * lat];
                let vv = (25.0 + 30.0 * k) * (0.7 + self.azar() * 0.6); let chico = self.azar() < 0.45;
                let (vy, tam) = if chico { (self.azar() * 3.0, 0.08 + self.azar() * 0.12) } else { (1.0 + self.azar() * 2.0, 1.5 + self.azar() * 2.5) }; let dr = (self.azar() - 0.5) * 9.0;
                let h = if chico { self.ef.particula(pq, [dx * vv, vy, dz * vv], 1.1, tam, if agua { [0.8, 0.83, 0.86, 0.9] } else { [0.22, 0.19, 0.16, 0.95] }, efx::Tipo::Humo, 0.0) }
                    else { self.ef.particula(pq, [dx * vv * 0.6, vy, dz * vv * 0.6], 2.2, tam, if agua { [0.85, 0.87, 0.9, 0.35] } else { [0.62, 0.52, 0.4, 0.38] }, efx::Tipo::Humo, 2.2) };
                if let Some(h) = h { h.fr = 0.3; h.grav = if chico { 0.3 } else { 0.0 }; if chico { h.dr = dr; } }
            }
        }
        // (el frente que avanza: el polvo que levanta a ras del piso, en la parte cerca de la cámara)
        if frente > alc * 0.6 && frente < alc_v && t < 60.0 {
            let cam = self.jg.cam_ult; let dc = (cam[0] - p[0]).hypot(cam[2] - p[2]);
            if (dc - frente).abs() < 140.0 {
                let lam = q * 25.0 * dt; let m = lam.floor() as i32 + (self.azar() < lam.fract()) as i32; let ang0 = (cam[2] - p[2]).atan2(cam[0] - p[0]);
                for _ in 0..m {
                    let a = ang0 + (self.azar() - 0.5) * (1.4f32).min(160.0 / frente.max(1.0)); let (cx, cz) = (p[0] + a.cos() * frente, p[2] + a.sin() * frente);
                    let (y, vy, tam) = (e.piso as f32 + 0.5 + self.azar() * 1.5, 2.0 + self.azar() * 4.0, 4.0 + self.azar() * 5.0);
                    if let Some(h) = self.ef.particula([cx, y, cz], [a.cos() * vel * 0.35, vy, a.sin() * vel * 0.35], 3.0, tam, if agua { [0.88, 0.9, 0.93, 0.35] } else { [0.6, 0.5, 0.38, 0.4] }, efx::Tipo::Humo, 2.6) { h.fr = 0.8; h.grav = 0.0; }
                }
            }
        }
        // (lo suelto y liviano entre el daño y el final del viento: un empujón al pasar el frente)
        if frente > alc && frente < alc_v {
            let r0 = alc.max(frente - vel * dt);
            let ids: Vec<u32> = self.fis.cuerpos.iter().filter(|b| b.dinamico() && b.masa <= 300.0).map(|b| b.id).collect();
            for id in ids {
                if self.jg.nuk.vivas[i].tocados.contains(&id) { continue; }
                let Some(b) = self.fis.cuerpo_mut(id) else { continue }; let (ddx, ddz) = (b.pos[0] as f32 - p[0], b.pos[2] as f32 - p[2]); let l = ddx.hypot(ddz);
                if l < r0 || l > frente { continue; }
                let fz = e.viento_cosa(true, b.masa, l as f64) as f32; b.despertar(); b.vel[0] += (ddx / l * fz) as f64; b.vel[2] += (ddz / l * fz) as f64; b.vel[1] += (fz * 0.25) as f64;
                self.jg.nuk.vivas[i].tocados.insert(id);
            }
        }
    }
    /// nukeSoplido: el ruido del viento que sube, ruge y se va (hecho acá: de a pocas variantes de fuerza y duración)
    fn nuk_soplido(&mut self, k: f32, dura: f32) {
        let (kq, dq) = ((k * 10.0).round() / 10.0, (dura * 2.0).round() / 2.0); let n = format!("NK_soplido_{kq:.1}_{dq:.1}");
        self.sonido.sintetico(&n, || nk::soplido(kq as f64, dq as f64, 48000.0, 0x5eed + (kq * 10.0) as u32), 48000); self.sonido.tocar(&n, 1.0, 1.0, None);
    }
    /// nukeRadiacion: adentro de la zona de una de superficie, el borde verde, el aviso, el daño y el contador Geiger
    fn nuk_radiacion(&mut self, dt: f32) {
        let jp = self.jug.pos; let mut rad = 0.0f32;
        self.jg.nuk.zonas.retain_mut(|z| { z.t -= dt; if z.t <= 0.0 { return false; } let d = dist(jp, z.p); if d < z.r { rad = rad.max((1.0 - d / z.r) * (z.t / 20.0).min(1.0)); } true });
        self.jg.nuk.rad = rad;
        if rad > 0.02 && !self.jg.nuk.rad_aviso { self.jg.nuk.rad_aviso = true; self.avisar("Radiación: salí de la zona".into()); } else if rad <= 0.02 { self.jg.nuk.rad_aviso = false; }
        if rad > 0.02 && self.jug.vida > 0.0 {
            self.jg.nuk.rad_t += dt; if self.jg.nuk.rad_t > 1.0 { self.jg.nuk.rad_t = 0.0; self.danar_jugador((6.0 * rad).ceil()); }
            if self.azar() < dt * (3.0 + 25.0 * rad) { let t = 2.6 + self.azar(); self.sonido.tocar("UI_blip", 0.12 + 0.2 * rad, t, None); }
        }
    }
    /// los carteles de las nucleares (nukeDibujar): de lejos a cerca, los de alfa y los que suman (×3 de brillo); lo que
    /// queda más allá de lo que se dibuja del mapa se acerca hasta el borde, del mismo tamaño en la pantalla (al fondo)
    pub(super) fn nuk_bloques(&self, ef: &mut Vec<(u32, Vec<f32>)>, vp: &M4, cam: V) {
        if self.jg.nuk.vivas.is_empty() { return; }
        // (las más cercanas que hacen hongo van con volumen —nuclear_vol.js—: 3 en Alto y Ultra, 2 si no; las demás, carteles)
        let vol: Vec<usize> = if self.jg.nuk.vol {
            let mut l: Vec<(f32, usize)> = self.jg.nuk.vivas.iter().enumerate().filter(|(_, v)| nk::nv_tipo(&v.e.tipo) && v.e.t <= v.e.dura)
                .map(|(i, v)| (dist([v.e.p[0] as f32, v.e.p[1] as f32, v.e.p[2] as f32], cam), i)).collect();
            l.sort_by(|a, b| a.0.total_cmp(&b.0)); l.truncate(if self.aj.calidad >= 3 { 3 } else { 2 }); l.into_iter().map(|x| x.1).collect()
        } else { vec![] };
        for &i in &vol { if let Some(b) = self.jg.nuk.vivas[i].e.nv_bloque() { ef.push((jxmotor::escena::EF_HONGO, b)); } }
        let mut l = vec![]; let part = self.ef.part as f64; for (i, v) in self.jg.nuk.vivas.iter().enumerate() { if !vol.contains(&i) { v.e.carteles(part, &mut l); } }
        if l.is_empty() { return; }
        let (der, arr) = (norm([vp[0], vp[4], vp[8]]), norm([vp[1], vp[5], vp[9]])); let lejos = self.mapa.as_ref().map(|m| m.lejos).unwrap_or(300.0) * 0.95; let luz = self.ef.luz;
        let mut idx: Vec<(f32, usize)> = l.iter().enumerate().map(|(i, c)| (dist([c[0] as f32, c[1] as f32, c[2] as f32], cam), i)).collect();
        idx.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        for suma in [false, true] {
            let mut b = vec![der[0], der[1], der[2], arr[0], arr[1], arr[2]];
            for &(d, i) in &idx {
                let c = l[i]; if (c[8] > 0.5) != suma || c[6] <= 0.002 { continue; }
                let (mut p, mut s) = ([c[0] as f32, c[1] as f32, c[2] as f32], c[7] as f32);
                if d > lejos { let k = lejos / d; p = add(cam, esc(sub(p, cam), k)); s *= k; }
                let (r, g, bb) = if suma { (c[3] as f32 * 3.0, c[4] as f32 * 3.0, c[5] as f32 * 3.0) } else { (c[3] as f32 * luz[0], c[4] as f32 * luz[1], c[5] as f32 * luz[2]) };
                b.extend_from_slice(&[p[0], p[1], p[2], r, g, bb, c[6] as f32, -1.0, -1.0, s, i as f32 * 2.39996, if suma { 2.0 } else { 1.0 }, 0.0, 0.0, 0.0, 0.0]);
            }
            if b.len() > 6 { ef.push((if suma { jxmotor::escena::EF_PART_SUMA } else { jxmotor::escena::EF_PART_ALFA }, b)); }
        }
    }

    // ---------------- artefactos ----------------
    /// de qué artefacto es un prefab (rb.art: catapulta, omega)
    pub(super) fn art_tipo(&self, nombre: &str) -> Option<&'static str> {
        let paq = self.paq.as_ref()?; match paq.d["pf"][self.nombres.get(nombre)?][0]["rb"]["art"].as_str()? { "catapulta" => Some("catapulta"), "omega" => Some("omega"), _ => None }
    }
    /// artUsar: la catapulta tira; la bomba de Rick Prime abre el panel para elegir a quién
    pub(super) fn art_usar(&mut self, i: usize) -> bool {
        let (id, nombre) = (self.objs[i].id, self.objs[i].nombre.clone());
        match self.art_tipo(&nombre) { Some("catapulta") => { self.art_tirar(id); true } Some("omega") => { self.art_omega_elegir(id); true } _ => false }
    }
    /// artBrazo: el brazo de la catapulta (el largo en su eje horizontal más largo; la cuchara en la punta más ancha)
    fn art_brazo(&mut self) -> Option<Brazo> {
        if let Some(b) = &self.jg.art.brazo { return b.clone(); }
        let r = (|| {
            let paq = self.paq.as_mut()?; let k = self.nombres.get("CatapultaBrazo")?.clone();
            let (pf, escena) = objetos::armar(paq, &self.nombres, "CatapultaBrazo", 512, &mut objetos::Cargados::default()).ok()?;
            let n = paq.d["pf"][&k].as_array()?.iter().find(|x| x["m"].as_i64().map_or(false, |m| m >= 0))?; let mi = n["m"].as_i64()? as usize;
            let d = &paq.d["ms"][mi]; let f = |x: &serde_json::Value, k: usize| x[k].as_f64().unwrap_or(0.0) as f32;
            let (mn, sc) = ([f(&d["mn"], 0), f(&d["mn"], 1), f(&d["mn"], 2)], [f(&d["sc"], 0), f(&d["sc"], 1), f(&d["sc"], 2)]);
            let a = if sc[0] >= sc[2] { [1.0, 0.0, 0.0] } else { [0.0, 0.0, 1.0] }; let (l, h) = (sc[0].max(sc[2]), sc[1]);
            let bin = paq.bin_de(d)?; let (v, o) = (d["v"].as_u64()? as usize, d["o"].as_u64()? as usize); let (mut wa, mut wb) = (0.0f32, 0.0f32);
            for k in 0..v { let q = |e: usize| u16::from_le_bytes([bin[o + k * 14 + e * 2], bin[o + k * 14 + e * 2 + 1]]) as f32 / 65535.0; let (px, pz) = (mn[0] + q(0) * sc[0], mn[2] + q(2) * sc[2]);
                let t = px * a[0] + pz * a[2]; let w = (px * a[2] - pz * a[0]).abs(); if t > l * 0.3 { wa = wa.max(w); } else if t < -l * 0.3 { wb = wb.max(w); } }
            let s = if wa >= wb { 1.0 } else { -1.0 }; let ac = esc(a, s);
            Some((pf, escena, Brazo { partes: vec![], ac, arg: add(esc(ac, -l * 0.44), [0.0, h * 0.45, 0.0]), cuch: add(esc(ac, l * 0.4), [0.0, h * 0.75, 0.0]) }))
        })();
        // (las mallas del brazo, al motor: en el cuadro, con art_paso)
        let b = r.map(|(pf, esc, mut b)| { b.partes = pf.partes.clone(); self.jg.art.brazo_esc = Some(esc); b });
        self.jg.art.brazo = Some(b.clone()); b
    }
    /// artCat: la catapulta del objeto `id` (el brazo con la cuchara hacia atrás)
    fn art_cat(&mut self, id: u32) -> Option<&mut Cat> {
        if !self.jg.art.cat.contains_key(&id) {
            let br = self.art_brazo();
            let paq = self.paq.as_ref()?; let k = self.nombres.get("Catapulta")?; let n = paq.d["pf"][k].as_array()?.iter().find(|x| x["m"].as_i64().map_or(false, |m| m >= 0))?;
            let d = &paq.d["ms"][n["m"].as_i64()? as usize]; let sc = [d["sc"][0].as_f64().unwrap_or(1.0) as f32, d["sc"][1].as_f64().unwrap_or(1.0) as f32, d["sc"][2].as_f64().unwrap_or(1.0) as f32];
            let f = if sc[0] >= sc[2] { [1.0, 0.0, 0.0] } else { [0.0, 0.0, 1.0] }; let yaw = |v: V| v[0].atan2(v[2]);
            let q0 = qeje([0.0, 1.0, 0.0], yaw(esc(f, -1.0)) - yaw(br.as_ref().map(|b| b.ac).unwrap_or(f)));
            self.jg.art.cat.insert(id, Cat { a: CAT_REPOSO, t: -9.0, tiro: false, lanzo: false, eje: sc[1] * 0.88, f, q0, lat: norm(cruz([0.0, 1.0, 0.0], f)), ign: vec![], ign_t: 0.0 });
        }
        self.jg.art.cat.get_mut(&id)
    }
    /// artBrazoMatriz: la base · el eje · el giro · la argolla en el eje
    fn art_brazo_matriz(&self, o: &Obj, c: &Cat, br: &Brazo, a: f32) -> M4 {
        let base = matriz_obj(o, 1.0); let q = qmul(qeje(c.lat, a), c.q0); let off = qrot(q, br.arg);
        m4::mul(&base, &mapa::trs([-off[0], c.eje - off[1], -off[2]], q, [1.0; 3]))
    }
    fn art_tirar(&mut self, id: u32) {
        if self.art_brazo().is_none() { return; } let t = self.jg.t;
        let Some(c) = self.art_cat(id) else { return }; if c.tiro || t - c.t < 1.2 { return; }
        c.tiro = true; c.t = t; c.lanzo = false;
        let p = self.objs.iter().find(|o| o.id == id).map(|o| o.pos);
        self.sonido.tocar("CB_Swing", 0.9, 0.55, p); self.sonido.tocar("PS_wood2", 0.8, 0.7, p);
    }
    /// artCatapultaLanzar: lo que estaba en la cuchara (cosas, gente, vos) sale para adelante y arriba a 17 m/s
    fn art_lanzar(&mut self, id: u32) {
        let (Some(br), Some(i)) = (self.art_brazo(), self.objs.iter().position(|o| o.id == id)) else { return };
        let Some(c) = self.jg.art.cat.get(&id) else { return }; let o = &self.objs[i]; let base_id = o.cuerpo;
        let p = pt(&self.art_brazo_matriz(o, c, &br, CAT_REPOSO), br.cuch); let f = qrot(o.q, c.f); let dir = norm([f[0] * 0.72, 0.7, f[2] * 0.72]); let r = 1.1;
        let mut n = 0; let mut ign = vec![];
        let ids: Vec<u32> = self.fis.cuerpos.iter().filter(|b| Some(b.id) != base_id && b.dinamico() && !b.agarrado).map(|b| b.id).collect();
        for bid in ids { let Some(b) = self.fis.cuerpo_mut(bid) else { continue }; if dist(v32(b.pos), p) > r + if b.r > 0.0 { b.r as f32 } else { 0.3 } { continue; }
            b.vel = v64(esc(dir, CAT_VEL)); b.despertar(); n += 1; if let Some(bi) = base_id { b.no_choca.push(bi); } ign.push(bid); }
        if let Some(bi) = base_id { if let Some(b) = self.fis.cuerpo_mut(bi) { b.no_choca.extend(ign.iter().copied()); } }
        if let Some(c) = self.jg.art.cat.get_mut(&id) { c.ign.extend(ign); c.ign_t = 0.5; }
        // yo (si estoy en la cuchara) y la gente
        let pies = [self.jug.pos[0], self.jug.pos[1] - 0.6, self.jug.pos[2]];
        if self.vehs.jugador.is_none() && dist(pies, p) < r + 0.4 { self.jug.vel = esc(dir, CAT_VEL); self.jug.suelo = false; n += 1; }
        let gente: Vec<(u32, V, bool)> = self.npcs.lista.iter().map(|q| (q.id, q.pos(), q.rag.is_some())).collect();
        for (nid, pp, rag) in gente { if dist(pp, p) >= r + 0.6 { continue; }
            if !rag { self.npcs.tumbar(nid, esc(dir, CAT_VEL), &mut self.fis); }
            let cs: Vec<u32> = self.npcs.get(nid).and_then(|q| q.rag.as_ref()).map(|r| r.cuerpos().collect()).unwrap_or_default();
            for c in cs { if let Some(b) = self.fis.cuerpo_mut(c) { b.vel = v64(esc(dir, CAT_VEL)); b.despertar(); } } n += 1; }
        if n > 0 { self.sonido.tocar("CB_Impact1", 0.6, 0.7, Some(p)); }
    }
    /// dónde está la cuchara de la catapulta `id` con el brazo en reposo (para las pruebas)
    pub(super) fn art_cuchara(&mut self, id: u32) -> Option<V> {
        let br = self.art_brazo()?; self.art_cat(id)?; let c = self.jg.art.cat.get(&id)?; let o = self.objs.iter().find(|o| o.id == id)?;
        Some(pt(&self.art_brazo_matriz(o, c, &br, CAT_REPOSO), br.cuch))
    }
    /// el ángulo del brazo de la catapulta `id`
    pub(super) fn art_angulo(&self, id: u32) -> Option<f32> { self.jg.art.cat.get(&id).map(|c| c.a) }
    /// la bomba de Rick Prime: los personajes que hay cerca primero (la gente y vos), después todos
    fn art_omega_elegir(&mut self, id: u32) {
        if self.jg.art.omega.contains_key(&id) { return; }
        let mut hay: Vec<String> = vec![]; if let Some(pj) = &self.pj { hay.push(pj.skin.clone()); }
        for n in &self.npcs.lista { if n.rag.is_none() && !hay.contains(&n.skin) { hay.push(n.skin.clone()); } }
        let todos: Vec<String> = self.paq.as_ref().and_then(|p| p.d["chars"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())).unwrap_or_default();
        let mut lista: Vec<(String, bool)> = hay.iter().map(|s| (s.clone(), true)).collect(); for s in todos { if !hay.contains(&s) { lista.push((s, false)); } }
        self.jg.art.panel = Some(PanelOmega { obj: id, lista, atlas: false, atlas_h: 0 }); self.jg.scroll = 0.0; self.menu = None;
    }
    pub(super) fn art_omega_armar(&mut self, id: u32, skin: &str) {
        self.jg.art.omega.insert(id, Omega { skin: skin.to_string(), cuenta: OMEGA_CUENTA, ult: 99 });
        self.avisar(format!("Bomba armada: {}", npc::skin_nom(skin)));
    }
    /// artOmegaEfecto: el destello verde que elimina a todos los de ese personaje (y a vos si sos ese)
    fn art_omega_efecto(&mut self, p: V, skin: &str) {
        self.sonido.tocar("GrenadeExplode", 1.0, 0.55, Some(p)); self.jg.art.flash = 1.0; self.jg.art.flash_p = Some(p);
        let l: Vec<(u32, V)> = self.npcs.lista.iter().filter(|n| n.rag.is_none() && n.vivo && n.skin == skin).map(|n| (n.id, n.pos())).collect();
        for (n, q) in l { self.npcs.danar(n, 9999.0, q, [0.0, 1.0, 0.0], &mut self.fis, Some(npc::Quien::Jugador)); }
        if self.pj.as_ref().map_or(false, |pj| pj.skin == skin) && self.jug.vida > 0.0 { self.danar_jugador(9999.0); }
        self.avisar(format!("La bomba de Rick Prime borró a todos los {}", npc::skin_nom(skin)));
    }
    /// artPaso: las catapultas, las bombas armadas y el destello verde; el atlas de retratos del panel
    pub(super) unsafe fn art_paso(&mut self, m: &mut Motor3d, dt: f32) {
        if let Some(e) = self.jg.art.brazo_esc.take() { let _ = m.cargar(&e); }
        let ids: Vec<u32> = self.jg.art.cat.keys().copied().collect();
        for id in ids {
            if !self.objs.iter().any(|o| o.id == id) { self.jg.art.cat.remove(&id); continue; }
            let mut lanzar = false; let mut soltar = vec![];
            if let Some(c) = self.jg.art.cat.get_mut(&id) {
                if c.tiro { c.a = CAT_TIRO.min(c.a + dt * 9.0); if !c.lanzo && c.a > CAT_SUELTA { c.lanzo = true; lanzar = true; } if c.a >= CAT_TIRO { c.tiro = false; } }
                else { c.a = CAT_REPOSO.max(c.a - dt * 0.9); }   // (vuelve despacio)
                if !c.ign.is_empty() { c.ign_t -= dt; if c.ign_t <= 0.0 { soltar = std::mem::take(&mut c.ign); } }
            }
            if lanzar { self.art_lanzar(id); }
            if !soltar.is_empty() { let base = self.objs.iter().find(|o| o.id == id).and_then(|o| o.cuerpo);
                for b in &soltar { if let Some(x) = self.fis.cuerpo_mut(*b) { x.no_choca.retain(|c| Some(*c) != base); } }
                if let Some(bi) = base { if let Some(x) = self.fis.cuerpo_mut(bi) { x.no_choca.retain(|c| !soltar.contains(c)); } } }
        }
        // (las catapultas nuevas: su brazo listo)
        let nuevas: Vec<u32> = self.objs.iter().filter(|o| !self.jg.art.cat.contains_key(&o.id) && o.nombre == "Catapulta").map(|o| o.id).collect();
        for id in nuevas { let _ = self.art_cat(id); }
        let ids: Vec<u32> = self.jg.art.omega.keys().copied().collect();
        for id in ids {
            let Some(i) = self.objs.iter().position(|o| o.id == id) else { self.jg.art.omega.remove(&id); continue };
            let p = self.objs[i].pos; let Some(s) = self.jg.art.omega.get_mut(&id) else { continue };
            s.cuenta = (s.cuenta - dt).max(0.0); let seg = s.cuenta.ceil() as i32; let mut bip = None;
            if seg != s.ult { s.ult = seg; if seg > 0 { bip = Some(1.0 + (OMEGA_CUENTA - seg as f32) * 0.12); } }
            let fin = s.cuenta <= 0.0; let skin = s.skin.clone();
            if let Some(t) = bip { self.sonido.tocar("UI_blip", 0.9, t, Some(p)); }
            if fin { self.jg.art.omega.remove(&id); self.borrar_obj(i); self.art_omega_efecto(p, &skin); }
        }
        if self.jg.art.flash > 0.0 { self.jg.art.flash = (self.jg.art.flash - dt * 0.7).max(0.0); }
        // (el panel: los retratos de los personajes en un atlas, una vez)
        if let Some(pn) = self.jg.art.panel.as_mut() { if !pn.atlas { pn.atlas = true; if let Some(paq) = self.paq.as_ref() {
            let n = pn.lista.len() as u32; let filas = n.div_ceil(ICO_COLS).max(1); let (aw, ah) = (1024u32, (filas * ICO).next_power_of_two().min(4096)); let mut px = vec![0u8; (aw * ah * 4) as usize];
            for (k, (s, _)) in pn.lista.iter().enumerate() { let (cx, cy) = ((k as u32 % ICO_COLS) * ICO, (k as u32 / ICO_COLS) * ICO); if cy + ICO > ah { break; }
                // (el retrato: el del personaje o su nombre en minúsculas —RETRATO y retrato() de menu.js—)
                let Some(ic) = objetos::icono(paq, s, ICO).or_else(|| objetos::icono(paq, &s.to_lowercase(), ICO)) else { continue }; for y in 0..ICO { let d = (((cy + y) * aw + cx) * 4) as usize; let o = (y * ICO * 4) as usize; px[d..d + (ICO * 4) as usize].copy_from_slice(&ic[o..o + (ICO * 4) as usize]); } }
            let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id: TEX_OMEGA, n: "omega".into(), w: aw, h: ah, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
            let _ = m.cargar(&Escena { c: cab, datos: px }); pn.atlas_h = ah; } } }
    }
    /// artDibujar: el brazo de cada catapulta
    pub(super) fn art_items(&self, items: &mut Vec<ItemDin>) {
        let Some(Some(br)) = &self.jg.art.brazo else { return };
        for o in &self.objs { let Some(c) = self.jg.art.cat.get(&o.id) else { continue }; let mm0 = self.art_brazo_matriz(o, c, br, c.a);
            for p in &br.partes { let mm = m4::mul(&mm0, &p.local); let cc = pt(&mm, [p.esf[0], p.esf[1], p.esf[2]]); items.push(ItemDin { m: p.m, s0: p.s0, sn: p.sn, mat: p.mat, mm, esf: [cc[0], cc[1], cc[2], p.esf[3] * 1.5], fl: 0, h: vec![] }); } }
    }
    /// la luz verde de la bomba de Rick Prime armada: late cada vez más rápido (o.md.extra.rim de la web)
    pub(super) fn art_luces(&self, out: &mut Vec<LuzP>) {
        for (id, s) in &self.jg.art.omega { let Some(o) = self.objs.iter().find(|o| o.id == *id) else { continue };
            let k = 2.4 * (0.5 + 0.5 * (self.jg.t * (6.0 + (OMEGA_CUENTA - s.cuenta) * 4.0)).sin()); let p = o.pos;
            out.push([p[0], p[1] + 0.4, p[2], 3.5, 0.2 * k, 2.4 * k * 0.6, 0.4 * k, 0.0, 0.0, -1.0, 0.0, -2.0]); }
    }
    /// el panel de la bomba (artOmegaElegir): el título, la ayuda y la grilla de personajes con su retrato
    pub(super) fn art_panel(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) -> Option<(i64, Vec<f32>)> {
        let pn = self.jg.art.panel.as_ref()?; let (x0, y0, pw, ph) = (wf * 0.08, hf * 0.08, wf * 0.84, hf * 0.86);
        l.caja(u, x0, y0, pw, ph, hf * 0.025, [0.07, 0.08, 0.11, 0.96]);
        l.texto(u, x0 + hf * 0.03, y0 + hf * 0.02, t * 1.05, [0.49, 1.0, 0.42, 1.0], "Bomba de Rick Prime");
        l.texto(u, x0 + hf * 0.03, y0 + hf * 0.075, t * 0.6, [0.75, 0.75, 0.75, 1.0], "Elimina a todos los que tengan ese personaje, y a nadie más. En 5 segundos.");
        let an = l.ancho(t, "X"); l.texto(u, x0 + pw - hf * 0.05 - an / 2.0, y0 + hf * 0.02, t, [1.0; 4], "X");
        let (gx, gy, gw, gh) = (x0 + hf * 0.03, y0 + hf * 0.12, pw - hf * 0.06, ph - hf * 0.14); let cols = ((gw / (hf * 0.16)).floor() as usize).max(1); let celda = gw / cols as f32;
        let mut ic = vec![]; let ah = pn.atlas_h.max(1) as f32;
        for (k, (s, cerca)) in pn.lista.iter().enumerate() {
            let (x, y) = (gx + (k % cols) as f32 * celda, gy + (k / cols) as f32 * celda - self.jg.scroll); if y + celda < gy || y > gy + gh - celda * 0.2 { continue; }
            l.caja(u, x + 3.0, y + 3.0, celda - 6.0, celda - 6.0, hf * 0.012, if *cerca { [0.37, 0.86, 0.31, 0.35] } else { [0.2, 0.21, 0.24, 1.0] });
            let tt = (celda * 0.12).min(t * 0.55); let nom: String = npc::skin_nom(s).chars().take(14).collect(); let a = l.ancho(tt, &nom); l.texto(u, x + (celda - a) / 2.0, y + celda - tt * 1.5, tt, [1.0; 4], &nom);
            if pn.atlas && ((k as u32 / ICO_COLS) * ICO + ICO) as f32 <= ah { let (cx, cy) = ((k as u32 % ICO_COLS) * ICO, (k as u32 / ICO_COLS) * ICO); let lado = celda - tt * 2.4;
                rect_uv(&mut ic, x + (celda - lado) / 2.0, y + 5.0, lado, lado - 4.0, [cx as f32 / 1024.0, cy as f32 / ah, (cx + ICO) as f32 / 1024.0, (cy + ICO) as f32 / ah], [1.0; 4]); }
        }
        Some((TEX_OMEGA, ic))
    }
    pub(super) fn art_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(pn) = self.jg.art.panel.as_ref() else { return }; let (x0, y0, pw, ph) = (w * 0.08, h * 0.08, w * 0.84, h * 0.86);
        if x < x0 || x > x0 + pw || y < y0 || y > y0 + ph || (x > x0 + pw - h * 0.1 && y < y0 + h * 0.08) { self.jg.art.panel = None; return; }
        let (gx, gy, gw) = (x0 + h * 0.03, y0 + h * 0.12, pw - h * 0.06); let cols = ((gw / (h * 0.16)).floor() as usize).max(1); let celda = gw / cols as f32;
        if y < gy || x < gx { return; }
        let (c, f) = (((x - gx) / celda) as usize, ((y - gy + self.jg.scroll) / celda) as usize); if c >= cols { return; }
        let Some((s, _)) = pn.lista.get(f * cols + c).cloned() else { return }; let id = pn.obj; self.jg.art.panel = None;
        if self.objs.iter().any(|o| o.id == id) { self.art_omega_armar(id, &s); }
    }
}

