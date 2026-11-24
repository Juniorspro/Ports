//! destruccion.js en el juego: los autos se abollan donde pegó (la copia de la malla de cada nodo tocado, subida al motor
//! una vez por golpe: jxjuego::destruccion), saltan chispas, pedazos, vidrios y polvo, en los choques fuertes se sueltan
//! las ruedas (una rueda de verdad que rueda y rebota, 40 s, hasta 8), el motor echa humo dañado y prende fuego antes de
//! explotar, al explotar la carrocería se infla y queda ardiendo; una explosión cerca hunde el lado de la explosión. El
//! sonido del choque (golpe, fuerte y vidrio, tres variantes de cada uno) se hace acá. Tope de 10 autos abollados a la vez
//! (los más viejos vuelven a su malla). El fuego que queda en el piso después de una explosión está en efectos.rs.
use super::*;
use jxjuego::destruccion::{self as dz, Copia};
use jxjuego::fisica::{forma_prisma, Cuerpo, Golpe, OpCuerpo};
use std::collections::HashMap;

/// un auto golpeado (o.des): la copia de cada nodo tocado (None: no se puede copiar), los que hay que subir, cuándo fue el
/// último golpe, los relojes del humo, del fuego y de la luz, cuándo explotó, su caja (sin las ruedas) y su lugar de mallas
struct Auto { cuerpo: u32, n: HashMap<usize, Option<Copia>>, subir: Vec<usize>, t: f32, ht: f32, ft: f32, lt: f32, roto_t: f32, caja: Option<(V, V)>, abollado: bool, lugar: Option<usize> }
/// una rueda que se soltó: su cuerpo, de qué auto salió (un rato sin chocar con él), las partes de su malla y su matriz
/// desde el cuerpo
struct Pieza { cuerpo: u32, de: Option<u32>, partes: Vec<(i64, u32, u32, i64)>, m: M4, t: f32 }
#[derive(Default)]
pub struct Des {
    /// los choques fuertes de la física de este cuadro (PH.hits)
    pub golpes: Vec<Golpe>,
    autos: Vec<Auto>, piezas: Vec<Pieza>, revisar: f32, sonidos: u32, lugares: Vec<bool>,
}
const TOPE: usize = 10;
const VIDA_MAX: f32 = 400.0;

impl Juego {
    fn des_auto(&mut self, cuerpo: u32) -> usize {
        if let Some(i) = self.jg.des.autos.iter().position(|a| a.cuerpo == cuerpo) { return i; }
        self.jg.des.autos.push(Auto { cuerpo, n: HashMap::new(), subir: vec![], t: self.jg.t, ht: 0.0, ft: 0.0, lt: 0.0, roto_t: -1.0, caja: None, abollado: false, lugar: None });
        self.jg.des.autos.len() - 1
    }
    /// la matriz del modelo de un objeto (como se dibuja ahora)
    fn des_base(&self, cuerpo: u32) -> Option<M4> { let o = self.objs.iter().find(|o| o.cuerpo == Some(cuerpo))?; Some(matriz_obj(o, 1.0)) }
    /// los nodos de la carrocería (desCarroceria): con malla, visibles, sin piel ni luz horneada, que no sean una rueda ni un
    /// colisionador, con la malla de cada uno
    fn des_carroceria(&self, cuerpo: u32) -> Vec<(usize, usize)> {
        let (Some(v), Some(paq)) = (self.vehs.de(cuerpo), self.paq.as_ref()) else { return vec![] };
        let arb = &paq.d["pf"][v.clave()]; let mut out = vec![];
        for i in 0..v.n_nodos() {
            let x = &arb[i]; let Some(mi) = x["m"].as_i64().filter(|&m| m >= 0) else { continue };
            if !v.activo(i) || !x["bo"].is_null() || x["n"].as_str().map_or(false, |n| n.to_lowercase().contains("collider")) || !x["mroff"].is_null() { continue; }
            if !paq.d["ms"][mi as usize]["lm"].is_null() { continue; }
            let mut k = i as i64; let mut rueda = false;
            while k >= 0 { if v.ruedas.iter().any(|w| w.vis == Some(k as usize)) || v.sueltas.contains(&(k as usize)) { rueda = true; break; } k = v.padre(k as usize); }
            if !rueda { out.push((i, mi as usize)); }
        }
        out
    }
    /// desCaja: la caja de la carrocería en el marco del cuerpo (sin las ruedas)
    fn des_caja(&mut self, cuerpo: u32) -> (V, V) {
        let a = self.des_auto(cuerpo); if let Some(c) = self.jg.des.autos[a].caja { return c; }
        let (mut mn, mut mx) = ([1e9f32; 3], [-1e9f32; 3]);
        if let (Some(base), Some(b), Some(v), Some(paq)) = (self.des_base(cuerpo), self.fis.cuerpo(cuerpo), self.vehs.de(cuerpo), self.paq.as_ref()) {
            let w = v.matrices(); let (bp, bq) = (v32(b.pos), [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]);
            for (i, mi) in self.des_carroceria(cuerpo) {
                let d = &paq.d["ms"][mi]; let f = |v: &serde_json::Value, k: usize| v[k].as_f64().unwrap_or(0.0) as f32;
                let (dmn, dsc) = ([f(&d["mn"], 0), f(&d["mn"], 1), f(&d["mn"], 2)], [f(&d["sc"], 0), f(&d["sc"], 1), f(&d["sc"], 2)]); let wm = m4::mul(&base, &w[i]);
                for c in 0..8 { let p = pt(&wm, [dmn[0] + dsc[0] * (c & 1) as f32, dmn[1] + dsc[1] * ((c >> 1) & 1) as f32, dmn[2] + dsc[2] * (c >> 2) as f32]); let l = qrot(qconj(bq), sub(p, bp));
                    for k in 0..3 { mn[k] = mn[k].min(l[k]); mx[k] = mx[k].max(l[k]); } }
            }
        }
        if mn[0] > mx[0] { let h = self.fis.cuerpo(cuerpo).map(|b| { let a = b.aabb(); [((a[3] - a[0]) / 2.0) as f32, ((a[4] - a[1]) / 2.0) as f32, ((a[5] - a[2]) / 2.0) as f32] }).unwrap_or([1.0, 0.65, 2.2]); mn = esc(h, -1.0); mx = h; }
        self.jg.des.autos[a].caja = Some((mn, mx)); (mn, mx)
    }
    /// desAbollar: hunde la chapa de los nodos cerca de `pw` (las copias quedan para subir en el cuadro)
    pub(super) fn des_abollar(&mut self, cuerpo: u32, pw: V, dir: V, hondo: f32, radio: f32, inflar: bool) -> f32 {
        if hondo < 0.004 { return 0.0; }
        let Some(base) = self.des_base(cuerpo) else { return 0.0 }; let Some(w) = self.vehs.de(cuerpo).map(|v| v.matrices()) else { return 0.0 };
        let a = self.des_auto(cuerpo); let nodos = self.des_carroceria(cuerpo); let mut total = 0.0;
        for (i, mi) in nodos {
            let Some(paq) = self.paq.as_ref() else { break }; let d = &paq.d["ms"][mi];
            let f = |v: &serde_json::Value, k: usize| v[k].as_f64().unwrap_or(0.0) as f32;
            let (mn, sc) = ([f(&d["mn"], 0), f(&d["mn"], 1), f(&d["mn"], 2)], [f(&d["sc"], 0), f(&d["sc"], 1), f(&d["sc"], 2)]);
            let wm = m4::mul(&base, &w[i]); let s = dz::escala(&wm) as f32; let s = if s != 0.0 { s } else { 1.0 };
            let cw = pt(&wm, [mn[0] + sc[0] / 2.0, mn[1] + sc[1] / 2.0, mn[2] + sc[2] / 2.0]); let rn = largo(sc) / 2.0 * s;
            if dist(cw, pw) > rn + radio { continue; }
            if !self.jg.des.autos[a].n.contains_key(&i) {
                // (la copia: los bytes de la malla como están en el paquete)
                let c = (|| { let bin = paq.bin_de(d)?; let (v, o, ii) = (d["v"].as_u64()? as usize, d["o"].as_u64()? as usize, d["i"].as_u64()? as usize);
                    let i32 = d["i32"].as_bool().unwrap_or(false); let ni = d["sub"].as_array()?.iter().map(|s| s[0].as_u64().unwrap_or(0) + s[1].as_u64().unwrap_or(0)).max()? as usize;
                    Copia::de(bin.get(o..o + v * 14)?, bin.get(ii..ii + ni * if i32 { 4 } else { 2 })?, v, ni, i32, mn, sc) })();
                self.jg.des.autos[a].n.insert(i, c);
            }
            let Some(Some(c)) = self.jg.des.autos[a].n.get_mut(&i) else { continue };
            let t = c.abollar(&wm, v64(pw), v64(dir), hondo as f64, radio as f64, inflar) as f32;
            if t > 0.0 { total += t; if !self.jg.des.autos[a].subir.contains(&i) { self.jg.des.autos[a].subir.push(i); } }
        }
        self.jg.des.autos[a].t = self.jg.t;
        total
    }
    /// sube las copias que cambiaron y las pone en el auto (cada auto abollado tiene su lugar de números de malla)
    unsafe fn des_subir(&mut self, m: &mut Motor3d) {
        for a in 0..self.jg.des.autos.len() {
            if self.jg.des.autos[a].subir.is_empty() { continue; }
            if self.jg.des.lugares.len() < 64 { self.jg.des.lugares.resize(64, false); }
            let lugar = match self.jg.des.autos[a].lugar { Some(l) => l, None => match self.jg.des.lugares.iter().position(|x| !*x) { Some(l) => { self.jg.des.lugares[l] = true; self.jg.des.autos[a].lugar = Some(l); l } None => { self.jg.des.autos[a].subir.clear(); continue; } } };
            let cu = self.jg.des.autos[a].cuerpo;
            for i in std::mem::take(&mut self.jg.des.autos[a].subir) {
                let id = ID_DES - lugar as i64 * 4096 - i as i64;
                let Some(Some(c)) = self.jg.des.autos[a].n.get(&i) else { continue };
                if m.cargar(&c.escena(id)).is_ok() { if let Some(v) = self.vehs.de_mut(cu) { v.abollada.insert(i, id); } }
            }
            self.jg.des.autos[a].abollado = true;
        }
    }
    /// (para las pruebas) cada auto golpeado: su cuerpo, cuántos nodos abollados, lo más hundido y lo hundido en total;
    /// y cuántas ruedas sueltas hay
    pub(super) fn des_info(&self) -> (Vec<(u32, usize, f32, f32)>, usize) {
        (self.jg.des.autos.iter().map(|a| { let (mut n, mut mx, mut tot) = (0, 0.0f32, 0.0f32); for c in a.n.values().flatten() { let m = c.d.iter().fold(0.0f32, |x, y| x.max(*y)); if m > 0.0 { n += 1; } mx = mx.max(m); tot += c.d.iter().sum::<f32>(); } (a.cuerpo, n, mx, tot) }).collect(), self.jg.des.piezas.len())
    }
    /// desSoltar: el auto vuelve a su malla original
    fn des_soltar(&mut self, a: usize) {
        let x = &mut self.jg.des.autos[a]; x.n.clear(); x.subir.clear(); x.abollado = false;
        if let Some(l) = x.lugar.take() { if let Some(b) = self.jg.des.lugares.get_mut(l) { *b = false; } }
        let cu = x.cuerpo; if let Some(v) = self.vehs.de_mut(cu) { v.abollada.clear(); }
    }

    /// desGolpe: un choque de la física contra un auto (`lado` 1: el auto es el otro del choque)
    fn des_golpe(&mut self, cuerpo: u32, h: &Golpe, lado: u8) {
        let Some(b) = self.fis.cuerpo(cuerpo) else { return }; let (bp, bq, bv) = (v32(b.pos), b.q, v32(b.vel));
        let otro = if lado == 1 { Some(h.cuerpo) } else { h.otro };
        let m2 = otro.and_then(|o| self.fis.cuerpo(o)).filter(|o| o.dinamico()).map(|o| if o.masa > 0.0 { o.masa } else { 50.0 }).unwrap_or(1e9);
        let km = if m2 >= 1e8 { 1.0 } else { m2 / (m2 + 250.0) }; let ve = (h.v * (0.35 + 0.65 * km)) as f32;
        if ve < 6.0 { return; }
        let pw = v32(h.p); let dir = if lado == 1 { esc(v32(h.n), -1.0) } else { v32(h.n) };
        let fuerte = ((ve - 6.0) / 22.0).clamp(0.0, 1.0);
        self.des_abollar(cuerpo, pw, dir, ((ve - 5.0) * 0.021).clamp(0.0, 0.5), 0.5 + ve * 0.032, false);
        self.des_chispas(cuerpo, pw, dir, ve);
        let vidrio = ve > 11.0 && self.azar() < 0.85; self.des_sonar(pw, ve, vidrio);
        if self.vehs.jugador.map(|j| j.0) == Some(cuerpo) { self.temblor = self.temblor.max(((ve - 6.0) / 20.0).clamp(0.0, 0.9)); }
        // (el daño: como con las balas y las explosiones)
        if ve > 7.0 && self.vehs.de(cuerpo).map_or(false, |v| !v.roto) { self.vehs.danar(&self.fis, cuerpo, ((ve - 7.0).powf(1.5) * 3.0) as f64); }
        // ruedas que se sueltan: las que están cerca del golpe, en los choques fuertes
        if ve > 15.0 {
            let ruedas: Vec<(V, f32)> = self.vehs.de(cuerpo).map(|v| v.ruedas.iter().map(|w| (v32(w.p), w.r as f32)).collect()).unwrap_or_default();
            let qf = [bq[0] as f32, bq[1] as f32, bq[2] as f32, bq[3] as f32];
            for (p, r) in ruedas {
                let pr = add(bp, qrot(qf, p)); if dist(pr, pw) > r + 0.75 { continue; }
                if self.azar() < (ve - 15.0) / 10.0 { let k = self.vehs.de(cuerpo).and_then(|v| v.ruedas.iter().position(|w| v32(w.p) == p)); if let Some(k) = k { self.des_soltar_rueda(cuerpo, k, esc(dir, -(2.0 + fuerte * 5.0))); } }
            }
        }
        let _ = bv;
    }
    /// desChispas: chispas, pedazos de chapa y de plástico, vidrios (los golpes fuertes) y polvo
    fn des_chispas(&mut self, cuerpo: u32, pw: V, dir: V, ve: f32) {
        let q = self.ef.part; let n = |x: f32| ((x * q).round() as i32).max(1);
        let bv = self.fis.cuerpo(cuerpo).map(|b| v32(b.vel)).unwrap_or([0.0; 3]);
        let fuera = esc(dir, -1.0); let piso = self.mapa.as_ref().and_then(|mp| jxjuego::persona::piso_bajo(&mp.mundo, v64(pw), 3.0)).map(|y| y as f32).unwrap_or(pw[1] - 1.0);
        let f = ((ve - 6.0) / 20.0).clamp(0.0, 1.3);
        let rebote = |j: &mut Juego, k: f32| { let r = add(esc(fuera, j.az(0.4, 1.0)), [j.az(-0.8, 0.8), j.az(0.1, 1.0), j.az(-0.8, 0.8)]); add(esc(norm(r), k), esc(bv, 0.6)) };
        for _ in 0..n(8.0 + f * 30.0) { let k = self.az(3.0, 9.0) * (0.6 + f); let v = rebote(self, k); let vida = self.az(0.25, 0.7); if let Some(x) = self.ef.particula(pw, v, vida, 0.022, [1.0, 0.8, 0.45, 1.0], efx::Tipo::Chispa, 0.0) { x.fr = 0.6; x.piso = Some(piso + 0.02); } }
        // (pedazos: gris oscuro y del color del auto; caen, rebotan y se quedan un rato)
        let col = [0.5, 0.5, 0.52];
        if ve > 10.0 { for _ in 0..n(3.0 + f * 12.0) { let c = if self.azar() < 0.5 { [0.08, 0.08, 0.09, 1.0] } else { [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8, 1.0] }; let k = self.az(2.0, 6.0) * (0.6 + f); let v = rebote(self, k); let (vida, tam) = (self.az(1.4, 2.6), self.az(0.025, 0.06));
            if let Some(x) = self.ef.particula(pw, v, vida, tam, c, efx::Tipo::Gota, 0.0) { x.piso = Some(piso + 0.02); x.fr = 0.3; } } }
        // (vidrios: astillas celestes que brillan y caen, y algunos destellos)
        if ve > 11.0 {
            for _ in 0..n(8.0 + f * 26.0) { let p = add(pw, [self.az(-0.4, 0.4), self.az(0.0, 0.5), self.az(-0.4, 0.4)]); let k = self.az(1.5, 5.0); let v = rebote(self, k); let (vida, tam) = (self.az(1.0, 2.0), self.az(0.012, 0.03));
                if let Some(x) = self.ef.particula(p, v, vida, tam, [0.72, 0.84, 0.9, 0.85], efx::Tipo::Gota, 0.0) { x.piso = Some(piso + 0.015); x.fr = 0.4; } }
            for _ in 0..n(4.0 + f * 8.0) { let k = self.az(1.0, 4.0); let v = rebote(self, k); let vida = self.az(0.3, 0.8); if let Some(x) = self.ef.particula(pw, v, vida, 0.03, [0.75, 0.9, 1.0, 0.9], efx::Tipo::Chispa, 0.0) { x.piso = Some(piso + 0.02); x.modo = 0; } }
        }
        // (polvo y humo del golpe)
        for _ in 0..n(2.0 + f * 6.0) { let k = self.az(0.5, 1.6); let v = add(rebote(self, k), [0.0, 0.4, 0.0]); let (vida, tam) = (self.az(0.9, 1.8), self.az(0.25, 0.5) * (0.6 + f));
            if let Some(x) = self.ef.particula(add(pw, esc(fuera, 0.2)), v, vida, tam, [0.6, 0.57, 0.53, 0.42], efx::Tipo::Humo, 2.2) { x.fr = 2.0; } }
        if ve > 14.0 { self.ef.luz_temporal(pw, 4.0 + f * 4.0, [6.0, 4.0, 2.0], 0.08); }
    }
    /// un número al azar entre a y b
    pub(super) fn az(&mut self, a: f32, b: f32) -> f32 { a + self.azar() * (b - a) }
    /// desSoltarRueda: la rueda `k` deja la física del auto, se esconde la de la carrocería y sale rodando una de verdad
    fn des_soltar_rueda(&mut self, cuerpo: u32, k: usize, empuje: V) {
        let Some(v) = self.vehs.de_mut(cuerpo) else { return }; if k >= v.ruedas.len() { return; }
        let w = v.ruedas.remove(k); let vis = w.vis;
        if let Some(vi) = vis { v.sueltas.push(vi); for j in 0..v.n_nodos() { let mut i = j as i64; while i >= 0 && i as usize != vi { i = v.padre(i as usize); } if i as usize == vi && i >= 0 && !v.ocultos.contains(&j) { v.ocultos.push(j); } } }
        let Some(b) = self.fis.cuerpo(cuerpo) else { return }; let (bp, bv) = (v32(b.pos), v32(b.vel)); let q = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32];
        let pw = add(bp, qrot(q, v32(w.p))); let sx = if w.p[0] > 0.0 { 1.0 } else { -1.0 };
        self.des_chispas(cuerpo, pw, qrot(q, [-sx, 0.0, 0.0]), 16.0);
        let Some(pid) = self.des_rueda_pieza(cuerpo, vis, w.r as f32) else { return };
        let lado = qrot(q, [sx, 0.0, 0.0]);
        let (a1, a2, a3, a4, a5, a6) = (self.azar(), self.azar(), self.azar(), self.azar(), self.azar(), self.azar());
        let vel = add(add(bv, esc(lado, 2.5 + a1 * 3.0)), add(empuje, [0.0, 2.0 + a2 * 2.0, 0.0]));
        let gira = dot(bv, qrot(q, [0.0, 0.0, 1.0])) / if w.r > 0.0 { w.r as f32 } else { 0.35 };
        let ang = add(esc(qrot(q, [1.0, 0.0, 0.0]), gira), [(a3 - 0.5) * 4.0, (a4 - 0.5) * 3.0, (a5 - 0.5) * 4.0]); let _ = a6;
        if let Some(p) = self.fis.cuerpo_mut(pid) { p.vel = v64(vel); p.ang = v64(ang); }
    }
    /// desRuedaPieza: la misma malla de la rueda sobre un cilindro de la física (22 kg) que rueda y rebota
    fn des_rueda_pieza(&mut self, cuerpo: u32, vis: Option<usize>, r: f32) -> Option<u32> {
        let k = vis?; let v = self.vehs.de(cuerpo)?; let paq = self.paq.as_ref()?; let arb = &paq.d["pf"][v.clave()];
        let tiene = |i: usize| arb[i]["m"].as_i64().map_or(false, |m| m >= 0);
        let km = if tiene(k) { k } else { (0..v.n_nodos()).find(|&i| v.padre(i) == k as i64 && tiene(i))? };
        let base = self.des_base(cuerpo)?; let wm = m4::mul(&base, &v.matrices()[km]);
        let d = &paq.d["ms"][arb[km]["m"].as_i64()? as usize]; let f = |x: &serde_json::Value, k: usize| x[k].as_f64().unwrap_or(0.0) as f32;
        let (mn, sc) = ([f(&d["mn"], 0), f(&d["mn"], 1), f(&d["mn"], 2)], [f(&d["sc"], 0), f(&d["sc"], 1), f(&d["sc"], 2)]);
        let b0 = self.fis.cuerpo(cuerpo)?; let q0 = [b0.q[0] as f32, b0.q[1] as f32, b0.q[2] as f32, b0.q[3] as f32]; let eje = qrot(q0, [1.0, 0.0, 0.0]);
        let (mut a0, mut a1, mut c) = (1e9f32, -1e9f32, [0.0f32; 3]);
        for i in 0..8 { let p = pt(&wm, [mn[0] + sc[0] * (i & 1) as f32, mn[1] + sc[1] * ((i >> 1) & 1) as f32, mn[2] + sc[2] * (i >> 2) as f32]); let t = dot(p, eje); a0 = a0.min(t); a1 = a1.max(t); c = add(c, esc(p, 1.0 / 8.0)); }
        let hw = ((a1 - a0) / 2.0).clamp(0.06, 0.3); let r = (if r > 0.0 { r } else { 0.35 }).clamp(0.15, 0.8); let q = qmul(q0, qeje([0.0, 0.0, 1.0], std::f32::consts::FRAC_PI_2));
        let mut b = Cuerpo::nuevo(std::sync::Arc::new(forma_prisma(r as f64, r as f64, hw as f64, 14)), 22.0, OpCuerpo { fric: 0.9, rest: 0.3, ..OpCuerpo::default() });
        b.pos = v64(c); b.q = [q[0] as f64, q[1] as f64, q[2] as f64, q[3] as f64]; b.prev_pos = b.pos; b.prev_q = b.q; b.no_choca.push(cuerpo); b.actualizar();
        let partes: Vec<(i64, u32, u32, i64)> = self.prefabs.get(&self.objs.iter().find(|o| o.cuerpo == Some(cuerpo))?.nombre)?.partes.iter().filter(|p| p.nodo == km).map(|p| (p.m, p.s0, p.sn, p.mat)).collect();
        let id = self.fis.agregar(b); if let Some(b0) = self.fis.cuerpo_mut(cuerpo) { b0.no_choca.push(id); }
        let mm = m4::mul(&m4::inv(&mapa::trs(c, q, [1.0; 3])), &wm);
        if self.jg.des.piezas.len() >= 8 { self.des_pieza_quitar(0); }
        self.jg.des.piezas.push(Pieza { cuerpo: id, de: Some(cuerpo), partes, m: mm, t: self.jg.t });
        Some(id)
    }
    fn des_pieza_quitar(&mut self, i: usize) {
        let p = self.jg.des.piezas.remove(i);
        if let Some(d) = p.de { if let Some(b) = self.fis.cuerpo_mut(d) { b.no_choca.retain(|&x| x != p.cuerpo); } }
        self.fis.quitar(p.cuerpo);
    }
    /// las ruedas sueltas (desDibujar)
    pub(super) fn des_items(&self, items: &mut Vec<ItemDin>) {
        for p in &self.jg.des.piezas {
            let Some(b) = self.fis.cuerpo(p.cuerpo) else { continue };
            let mm = m4::mul(&mapa::trs(v32(b.pos), [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32], [1.0; 3]), &p.m); let c = pos_de(&mm);
            for &(m, s0, sn, mat) in &p.partes { items.push(ItemDin { m, s0, sn, mat, mm, esf: [c[0], c[1], c[2], 1.0], fl: 0, h: vec![] }); }
        }
    }

    // ---------------- explosiones ----------------
    /// desExplosion de todos los autos alcanzados por una explosión en `p` de radio `radio` (lo llama la explosión de
    /// combate.rs, con el mismo alcance: 1,6 radios)
    pub(crate) fn des_explosion_cerca(&mut self, p: V, radio: f32) {
        let l: Vec<(u32, f32)> = self.vehs.lista.iter().filter(|v| v.tipo != veh::Tipo::Asiento).filter_map(|v| { let b = self.fis.cuerpo(v.cuerpo)?; let d = dist(v32(b.pos), p); (d <= radio * 1.6).then(|| (v.cuerpo, 1.0 - d / (radio * 1.6))) }).collect();
        for (c, k) in l { self.des_explosion(c, p, k, radio); }
    }
    /// desExplosion: la chapa se hunde del lado de la explosión (y vuelan vidrios)
    pub(super) fn des_explosion(&mut self, cuerpo: u32, p: V, k: f32, radio: f32) {
        if k <= 0.02 { return; }
        let (mn, mx) = self.des_caja(cuerpo); let Some(b) = self.fis.cuerpo(cuerpo) else { return }; let q = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32];
        let cl = esc(add(mn, mx), 0.5); let cw = add(v32(b.pos), qrot(q, cl)); let d = sub(cw, p); let l = largo(d); if l < 0.6 { return; }
        let dir = esc(d, 1.0 / l); let dl = qrot(qconj(q), esc(dir, -1.0)); let h = esc(sub(mx, mn), 0.5);
        let t = (0..3).map(|e| if dl[e].abs() > 1e-4 { h[e] / dl[e].abs() } else { 1e9 }).fold(1e9f32, f32::min);
        let pw = add(cw, qrot(q, esc(dl, t)));
        self.des_abollar(cuerpo, pw, dir, (k * 0.32).clamp(0.0, 0.32), 1.1 + radio * 0.12, false);
        self.des_chispas(cuerpo, pw, dir, 8.0 + k * 14.0);
    }
    /// desRoto: el auto explotó: la carrocería se infla desde adentro, saltan una o dos ruedas y queda prendido fuego
    pub(crate) fn des_roto(&mut self, cuerpo: u32) {
        let Some(tipo) = self.vehs.de(cuerpo).map(|v| v.tipo) else { return };
        let a = self.des_auto(cuerpo); self.jg.des.autos[a].roto_t = self.jg.t;
        let (mn, mx) = self.des_caja(cuerpo); let Some(b) = self.fis.cuerpo(cuerpo) else { return }; let (bp, q) = (v32(b.pos), [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]);
        let cl = esc(add(mn, mx), 0.5);
        self.des_abollar(cuerpo, add(bp, qrot(q, add(cl, [0.0, (mx[1] - mn[1]) * 0.1, 0.0]))), [0.0, 1.0, 0.0], 0.13, (2.0f32).max((mx[2] - mn[2]) * 0.7), true);
        if tipo == veh::Tipo::Auto {
            let n = self.vehs.de(cuerpo).map(|v| v.ruedas.len()).unwrap_or(0); let cuantas = n.min(1 + (self.azar() < 0.6) as usize);
            for _ in 0..cuantas { let n = self.vehs.de(cuerpo).map(|v| v.ruedas.len()).unwrap_or(0); if n == 0 { break; } let k = (self.azar() * n as f32) as usize % n; self.des_soltar_rueda(cuerpo, k, [0.0, 3.0, 0.0]); }
        }
        self.des_sonar(bp, 30.0, true);
    }

    // ---------------- el sonido ----------------
    /// desSonar: el golpe (o el fuerte) y, si se rompieron, los vidrios (una de las tres variantes de cada uno)
    fn des_sonar(&mut self, p: V, ve: f32, vidrio: bool) {
        let va = (self.azar() * 3.0) as u32 % 3; let tipo = if ve > 14.0 { "fuerte" } else { "golpe" };
        let n = format!("DES_{tipo}{va}"); self.sonido.sintetico(&n, || dz::sonido(tipo, va, 48000.0), 48000);
        let tono = 0.85 + self.azar() * 0.3; self.sonido.tocar(&n, (ve / 14.0).clamp(0.45, 1.7), tono, Some(p));
        if vidrio { let nv = format!("DES_vidrio{va}"); self.sonido.sintetico(&nv, || dz::sonido("vidrio", va, 48000.0), 48000); let t = 0.9 + self.azar() * 0.25; self.sonido.tocar(&nv, (ve / 22.0).clamp(0.35, 1.0), t, Some(p)); }
    }

    // ---------------- cada cuadro ----------------
    /// desPaso: los choques de este cuadro (abolladuras, chispas, daño, ruedas), las ruedas sueltas, el tope de autos
    /// abollados y el humo y el fuego de los autos dañados; después sube las copias que cambiaron
    pub(super) unsafe fn des_paso(&mut self, m: &mut Motor3d, dt: f32) {
        let golpes = std::mem::take(&mut self.jg.des.golpes);
        for h in golpes.iter().take(48) {
            for lado in 0..2u8 {
                let c = if lado == 1 { match h.otro { Some(o) => o, None => continue } } else { h.cuerpo };
                if self.vehs.de(c).map_or(false, |v| v.tipo != veh::Tipo::Asiento) && self.objs.iter().any(|o| o.cuerpo == Some(c)) { self.des_golpe(c, h, lado); }
            }
        }
        // (los 9 sonidos se hacen de a uno por cuadro apenas hay un vehículo: el primer choque no se traba armándolo)
        if self.jg.des.sonidos < 9 && !self.vehs.lista.is_empty() {
            let k = self.jg.des.sonidos; self.jg.des.sonidos += 1; let tipo = ["golpe", "fuerte", "vidrio"][(k / 3) as usize]; let va = k % 3;
            self.sonido.sintetico(&format!("DES_{tipo}{va}"), || dz::sonido(tipo, va, 48000.0), 48000);
        }
        let t = self.jg.t; let mut i = self.jg.des.piezas.len();
        while i > 0 { i -= 1;
            let (de, t0, c) = (self.jg.des.piezas[i].de, self.jg.des.piezas[i].t, self.jg.des.piezas[i].cuerpo);
            if de.is_some() && t - t0 > 0.6 { if let Some(b) = self.fis.cuerpo_mut(c) { b.no_choca.clear(); } if let Some(d) = de { if let Some(b) = self.fis.cuerpo_mut(d) { b.no_choca.retain(|&x| x != c); } } self.jg.des.piezas[i].de = None; }
            if t - t0 > 40.0 || t < t0 || self.fis.cuerpo(c).is_none() { self.des_pieza_quitar(i); }
        }
        // (una vez por segundo: lo que se borró se olvida; y el tope de autos abollados)
        self.jg.des.revisar -= dt;
        if self.jg.des.revisar <= 0.0 {
            self.jg.des.revisar = 1.0;
            let mut i = self.jg.des.autos.len(); while i > 0 { i -= 1; let c = self.jg.des.autos[i].cuerpo; if self.vehs.de(c).is_none() || !self.objs.iter().any(|o| o.cuerpo == Some(c)) { if let Some(l) = self.jg.des.autos[i].lugar { if let Some(b) = self.jg.des.lugares.get_mut(l) { *b = false; } } self.jg.des.autos.remove(i); } }
            let mut ab: Vec<(f32, usize)> = self.jg.des.autos.iter().enumerate().filter(|(_, a)| a.abollado).map(|(i, a)| (a.t, i)).collect();
            ab.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
            if ab.len() > TOPE { for &(_, i) in &ab[..ab.len() - TOPE] { self.des_soltar(i); } }
        }
        if !self.jg.des.autos.is_empty() { self.des_humo(dt); }
        self.des_subir(m);
    }
    /// el humo del motor dañado, las llamas antes de explotar y lo que queda ardiendo después (con su luz)
    fn des_humo(&mut self, dt: f32) {
        let q = self.ef.part; let cam = self.jg.cam_ult; let t = self.jg.t; let mut luces = 0;
        for a in 0..self.jg.des.autos.len() {
            let c = self.jg.des.autos[a].cuerpo; let Some(v) = self.vehs.de(c) else { continue }; let (roto, vida) = (v.roto, v.vida as f32);
            let f = if roto { 0.0 } else { vida / VIDA_MAX }; let rt = self.jg.des.autos[a].roto_t; let tr = if rt >= 0.0 { t - rt } else { -1.0 };
            let arde = (!roto && f < 0.25) || (tr >= 0.0 && tr < 24.0); let humea = arde || f < 0.6 || (tr >= 0.0 && tr < 60.0);
            if !humea { continue; }
            let Some(b) = self.fis.cuerpo(c) else { continue }; let (bp, bv, bq) = (v32(b.pos), v32(b.vel), [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]);
            let dc = dist(cam, bp); if dc > 150.0 { continue; }
            let lejos = if dc > 60.0 { 0.45 } else { 1.0 }; let (mn, mx) = self.des_caja(c);
            // (el motor: adelante, a la altura del capó; ya explotado, de toda la carrocería)
            let motor = |j: &mut Juego| -> V { if tr >= 0.0 { add(bp, qrot(bq, [j.az(mn[0], mx[0]) * 0.7, mn[1] + (mx[1] - mn[1]) * j.az(0.45, 0.8), j.az(mn[2], mx[2]) * 0.75])) }
                else { add(bp, qrot(bq, [j.az(-0.35, 0.35), mn[1] + (mx[1] - mn[1]) * 0.6, mx[2] - (0.85f32).min((mx[2] - mn[2]) * 0.17) + j.az(-0.25, 0.25)])) } };
            let dano = if tr >= 0.0 { if tr < 24.0 { 1.0 } else { (1.0 - (tr - 24.0) / 36.0).clamp(0.0, 1.0) * 0.7 } } else { ((0.6 - f) / 0.6).clamp(0.0, 1.0) };
            self.jg.des.autos[a].ht -= dt * (5.0 + 15.0 * dano) * q * lejos;
            while self.jg.des.autos[a].ht <= 0.0 {
                self.jg.des.autos[a].ht += 1.0; let p = motor(self); let osc = 0.12 + 0.2 * dano;
                let v = add(esc(bv, 0.3), [self.az(-0.3, 0.3), self.az(1.1, 2.1), self.az(-0.3, 0.3)]); let (vida, tam) = (self.az(2.2, 4.0) * (0.7 + dano * 0.6), self.az(0.22, 0.38) * (0.8 + dano * 0.6));
                if let Some(x) = self.ef.particula(p, v, vida, tam, [0.55 - osc, 0.54 - osc, 0.53 - osc, 0.38 + dano * 0.25], efx::Tipo::Humo, 2.4) { x.fr = 0.9; x.calor = if arde { 0.35 } else { 0.0 }; }
            }
            if arde {
                // (llamas chicas y muchas, que suben rápido y se apagan: no bolas naranjas que tapan el auto)
                let k = if tr >= 0.0 { 1.0 + (1.0 - tr / 24.0).clamp(0.0, 1.0) * 0.45 } else { 0.75 };
                self.jg.des.autos[a].ft -= dt * 30.0 * k * q * lejos;
                while self.jg.des.autos[a].ft <= 0.0 { self.jg.des.autos[a].ft += 1.0; let p = motor(self); let v = add(esc(bv, 0.5), [self.az(-0.25, 0.25), self.az(1.8, 3.4), self.az(-0.25, 0.25)]); let (vida, tam) = (self.az(0.3, 0.6), self.az(0.13, 0.26) * k);
                    if let Some(x) = self.ef.particula(p, v, vida, tam, [1.0, 1.0, 1.0, 0.85], efx::Tipo::Fuego, 0.8) { x.rampa = true; x.fr = 1.6; x.grav = -0.1; } }
                self.jg.des.autos[a].lt -= dt;
                if self.jg.des.autos[a].lt <= 0.0 && luces < 4 && dc < 70.0 { self.jg.des.autos[a].lt = 0.09; luces += 1; let al = 0.7 + self.azar() * 0.6; let p = add(motor(self), [0.0, 0.6, 0.0]); self.ef.luz_temporal(p, 6.0 + 3.0 * k, [5.0 * al * k, 2.4 * al * k, 0.7 * al * k], 0.12); }
            }
        }
    }
}
