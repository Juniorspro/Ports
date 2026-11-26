//! Lo que comparten las personas que caminan (personas.js y jugador.js de la versión web), para los NPC (npc.rs): la
//! cápsula de esferas que choca con el mapa y con los objetos de la física (jugadorMoverChocar, esferaFuera y
//! empujarDeCuerpo corridos con los datos de otra persona, como npcMover), los rayos contra todo (raycast y mundoRayo), el
//! piso de abajo (pisoBajo), el empujón de un tiro (applyVel), las voces (sonVoz) y el azar.
//! Todo en doble, como en la web (los números de JS), con los triángulos del mapa en float (MUNDO.T es un Float32Array):
//! así la cápsula queda apoyada en el piso igual que allá (en float quedaba un pelo arriba, perdía el piso un cuadro sí y
//! uno no y, al chocar una pared en ese cuadro, la corrección la tiraba para arriba). jugador.rs tiene su propia copia de
//! la cápsula (en float, con las esferas de agachado y los escalones del jugador).
use crate::fisica::{self, add, cruz, dot, esc, largo, sub, Cuerpo, Fisica, V};
use crate::mundo::{Forma, Mundo};

/// el radio de la cápsula: los NPC usan la del jugador (JUG.radio)
pub const RADIO: f64 = 0.45;
/// las esferas del cuerpo (alto sobre el centro, si es el pie): NPC_ESF. Los pies van a 0,95 m del centro
pub const ESF: [(f64, bool); 3] = [(-0.5, true), (0.0, false), (0.5, false)];
/// el grupo de las partes de los muñecos de trapo es 1000 + el número de la persona: ésas no chocan con la gente (noJug)
pub const GRUPO_MUNECO: u32 = 1000;
pub const GRAV: f64 = 9.81;

/// la cápsula de una persona: el centro, la velocidad, si pisa algo y la normal de lo que pisa
#[derive(Clone, Debug)]
pub struct Capsula { pub pos: V, pub vel: V, pub suelo: bool, pub suelo_n: V }

/// lo que se reusa entre cuadros (para no pedir memoria en cada paso)
#[derive(Default)]
pub struct Tmp { ts: Vec<u32>, cs: Vec<u32>, cerca: Vec<u32> }

#[inline] fn vert(m: &Mundo, t: u32, k: usize) -> V { let o = t as usize * 9 + k * 3; [m.t[o] as f64, m.t[o + 1] as f64, m.t[o + 2] as f64] }
#[inline] fn normal(m: &Mundo, t: u32) -> V { let o = t as usize * 3; [m.tn[o] as f64, m.tn[o + 1] as f64, m.tn[o + 2] as f64] }
#[inline] fn f32s(a: V) -> [f32; 3] { [a[0] as f32, a[1] as f32, a[2] as f32] }
#[inline] fn f64s(a: [f32; 3]) -> V { [a[0] as f64, a[1] as f64, a[2] as f64] }

/// el punto del triángulo más cercano a p (triCercano, en doble)
fn tri_cercano(m: &Mundo, t: u32, p: V) -> V {
    let (a, b, c) = (vert(m, t, 0), vert(m, t, 1), vert(m, t, 2));
    let (ab, ac, ap) = (sub(b, a), sub(c, a), sub(p, a));
    let (d1, d2) = (dot(ab, ap), dot(ac, ap)); if d1 <= 0.0 && d2 <= 0.0 { return a; }
    let bp = sub(p, b); let (d3, d4) = (dot(ab, bp), dot(ac, bp)); if d3 >= 0.0 && d4 <= d3 { return b; }
    let vc = d1 * d4 - d3 * d2; if vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0 { let v = d1 / (d1 - d3); return add(a, esc(ab, v)); }
    let cp = sub(p, c); let (d5, d6) = (dot(ab, cp), dot(ac, cp)); if d6 >= 0.0 && d5 <= d6 { return c; }
    let vb = d5 * d2 - d1 * d6; if vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0 { let w = d2 / (d2 - d6); return add(a, esc(ac, w)); }
    let va = d3 * d6 - d5 * d4; if va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0 { let w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return add(b, esc(sub(c, b), w)); }
    let den = 1.0 / (va + vb + vc); let (v, w) = (vb * den, vc * den);
    add(a, add(esc(ab, v), esc(ac, w)))
}

impl Capsula {
    pub fn nueva(pos: V) -> Capsula { Capsula { pos, vel: [0.0; 3], suelo: false, suelo_n: [0.0, 1.0, 0.0] } }

    /// moverse en pasos chicos y sacar la cápsula de lo que toque (jugadorMoverChocar con las esferas de un NPC). `propio`:
    /// el cuerpo de la física de esta persona (no choca consigo misma, J.vehiculoCuerpo); tampoco con lo agarrado (held) ni
    /// con las partes de los muñecos de trapo (noJug)
    pub fn mover_chocar(&mut self, m: &Mundo, mut f: Option<&mut Fisica>, dt: f64, tramo: f64, propio: Option<u32>, tmp: &mut Tmp) {
        let pasos = ((largo(self.vel) * dt / tramo).ceil() as usize).max(1);
        self.suelo = false;
        // (los cuerpos que se pueden tocar en todo el movimiento: la caja del recorrido, con el radio y las esferas)
        tmp.cerca.clear();
        if let Some(fz) = f.as_deref_mut() {
            if !fz.cuerpos.is_empty() {
                let (dy0, dy1) = (ESF[0].0, ESF[2].0);
                let (p, r) = (self.pos, RADIO + 0.25); let e = esc(self.vel, dt);
                let l = fz.cerca([p[0].min(p[0] + e[0]) - r, p[1].min(p[1] + e[1]) + dy0 - r, p[2].min(p[2] + e[2]) - r,
                    p[0].max(p[0] + e[0]) + r, p[1].max(p[1] + e[1]) + dy1 + r, p[2].max(p[2] + e[2]) + r]);
                for id in l {
                    if Some(id) == propio { continue; }
                    let Some(b) = fz.cuerpo(id) else { continue };
                    if b.agarrado || b.grupo >= GRUPO_MUNECO || b.sin_fisica { continue; }
                    tmp.cerca.push(id);
                }
            }
        }
        let cerca = std::mem::take(&mut tmp.cerca);
        for _ in 0..pasos {
            self.pos = add(self.pos, esc(self.vel, dt / pasos as f64));
            for _ in 0..2 {
                let mut corr = [0.0f64; 3];
                for &(dy, pie) in &ESF {
                    let mut p = [self.pos[0], self.pos[1] + dy, self.pos[2]];
                    self.esfera_fuera(m, &mut f, &cerca, &mut p, RADIO, &mut corr, pie, tmp);
                    self.pos = [p[0], p[1] - dy, p[2]];
                }
                // quitar la velocidad que va contra lo que chocó
                let cl = largo(corr);
                if cl > 1e-5 { let n = esc(corr, 1.0 / cl); let vn = dot(self.vel, n); if vn < 0.0 { self.vel = add(self.vel, esc(n, -vn)); } } else { break; }
            }
        }
        tmp.cerca = cerca;
    }

    /// saca una esfera (centro c, radio r) del mapa (triángulos y cuerpos fijos: esferaFuera) y de los objetos sueltos
    /// (empujarDeCuerpo: los fijos y congelados la sacan; los que se mueven se corren según su masa)
    #[allow(clippy::too_many_arguments)]
    fn esfera_fuera(&mut self, m: &Mundo, f: &mut Option<&mut Fisica>, cerca: &[u32], c: &mut V, r: f64, corr: &mut V, es_pie: bool, tmp: &mut Tmp) {
        m.cerca((c[0] - r) as f32, (c[2] - r) as f32, (c[0] + r) as f32, (c[2] + r) as f32, &mut tmp.ts, &mut tmp.cs);
        for &t in tmp.ts.iter() {
            // (lejos del plano del triángulo no lo toca)
            let n0 = normal(m, t); let a = vert(m, t, 0);
            let pl = n0[0] * (c[0] - a[0]) + n0[1] * (c[1] - a[1]) + n0[2] * (c[2] - a[2]);
            if pl >= r || pl <= -r { continue; }
            let p = tri_cercano(m, t, *c);
            let (dx, dy, dz) = (c[0] - p[0], c[1] - p[1], c[2] - p[2]); let d2 = dx * dx + dy * dy + dz * dz;
            if d2 >= r * r { continue; }
            let d = d2.sqrt();
            let n = if d > 1e-6 { [dx / d, dy / d, dz / d] } else { n0 };
            let k = r - d;
            // (los pies sobre piso caminable se sacan sólo para arriba: si no, parado en una loma se va resbalando)
            if es_pie && n[1] > 0.6 { let kv = k / n[1]; c[1] += kv; corr[1] += kv; self.suelo = true; self.suelo_n = n; }
            else { for e in 0..3 { c[e] += n[e] * k; corr[e] += n[e] * k; } }
        }
        for &b in tmp.cs.iter() {
            let a = m.cuerpos[b as usize].aabb; let (cf, rf) = (f32s(*c), r as f32);
            if cf[0] + rf < a[0] || cf[0] - rf > a[3] || cf[1] + rf < a[1] || cf[1] - rf > a[4] || cf[2] + rf < a[2] || cf[2] - rf > a[5] { continue; }
            let Some((n, d)) = m.fuera_de_cuerpo(b as usize, cf, rf) else { continue };
            let (n, d) = (f64s(n), d as f64);
            if es_pie && n[1] > 0.6 { let kv = d / n[1]; c[1] += kv; corr[1] += kv; } else { for e in 0..3 { c[e] += n[e] * d; corr[e] += n[e] * d; } }
            if es_pie && n[1] > 0.6 { self.suelo = true; self.suelo_n = n; }
        }
        let Some(fz) = f.as_deref_mut() else { return };
        for &id in cerca {
            let Some(b) = fz.cuerpo(id) else { continue };
            let (din, masa) = (b.dinamico(), b.masa);
            for k in 0..fz.partes(id) {
                let Some((n, d)) = fz.empuje(id, k, *c, r) else { continue };
                if din {
                    // (el objeto también se corre según su masa: un auto casi no, una caja sí)
                    let kk = 80.0 / (80.0 + masa);
                    for e in 0..3 { c[e] += n[e] * d * (1.0 - kk); corr[e] += n[e] * d * (1.0 - kk); }
                    if n[1] < 0.6 {
                        let emp = (d * 30.0).min(2.0) * kk;
                        if let Some(i) = fz.indice(id) { let bm = &mut fz.cuerpos[i]; bm.despertar(); for e in 0..3 { bm.vel[e] -= n[e] * emp; } }
                    }
                } else if es_pie && n[1] > 0.6 { let kv = d / n[1]; c[1] += kv; corr[1] += kv; }
                else { for e in 0..3 { c[e] += n[e] * d; corr[e] += n[e] * d; } }
                if es_pie && n[1] > 0.6 { self.suelo = true; self.suelo_n = n; }
            }
        }
    }
}

// ---------------- los rayos ----------------
/// lo que tocó un rayo: a qué distancia, la normal, el punto y el cuerpo de la física (None: el mapa)
#[derive(Clone, Copy, Debug)]
pub struct Toque { pub t: f64, pub n: V, pub p: V, pub cuerpo: Option<u32> }

/// un rayo contra un triángulo del mapa (rayTri: Möller–Trumbore de los dos lados), la distancia o nada
fn rayo_tri(m: &Mundo, o: V, d: V, t: u32, tmax: f64) -> Option<f64> {
    let a = vert(m, t, 0); let (e1, e2) = (sub(vert(m, t, 1), a), sub(vert(m, t, 2), a));
    let p = cruz(d, e2); let det = dot(e1, p); if det.abs() < 1e-9 { return None; }
    let inv = 1.0 / det; let s = sub(o, a); let u = dot(s, p) * inv; if !(0.0..=1.0).contains(&u) { return None; }
    let q = cruz(s, e1); let v = dot(d, q) * inv; if v < 0.0 || u + v > 1.0 { return None; }
    let tt = dot(e2, q) * inv; if tt >= 0.0 && tt <= tmax { Some(tt) } else { None }
}
/// un rayo contra una esfera (raySphere)
fn rayo_esfera(c: V, r: f64, o: V, d: V, tmax: f64) -> Option<(f64, V)> {
    let m = sub(o, c); let b = dot(m, d); let cc = dot(m, m) - r * r; if cc > 0.0 && b > 0.0 { return None; }
    let disc = b * b - cc; if disc < 0.0 { return None; } let t = -b - disc.sqrt(); if t < 0.0 || t > tmax { return None; }
    Some((t, fisica::norm(sub(add(o, esc(d, t)), c))))
}
/// el rayo contra el mapa (mundoRayo, en doble): lo primero que toca hasta `max` (los triángulos y los cuerpos fijos), con
/// la normal hacia el rayo
pub fn rayo_mundo(m: &Mundo, o: V, d: V, max: f64) -> Option<(f64, V)> {
    let fin = add(o, esc(d, max));
    let (mut ts, mut cs) = (vec![], vec![]);
    m.cerca(o[0].min(fin[0]) as f32, o[2].min(fin[2]) as f32, o[0].max(fin[0]) as f32, o[2].max(fin[2]) as f32, &mut ts, &mut cs);
    let mut mejor: Option<(f64, V)> = None; let mut best = max;
    for &t in &ts { if let Some(tt) = rayo_tri(m, o, d, t, best) { best = tt; let mut n = normal(m, t); if dot(n, d) > 0.0 { n = esc(n, -1.0); } mejor = Some((tt, n)); } }
    for &b in &cs {
        let h = match &m.cuerpos[b as usize].f {
            Forma::Esfera { c, r } => rayo_esfera(f64s(*c), *r as f64, o, d, best),
            Forma::Capsula { a, b, r } => {
                let (a, b) = (f64s(*a), f64s(*b)); let mut h: Option<(f64, V)> = None;
                for p in [a, esc(add(a, b), 0.5), b] { if let Some(k) = rayo_esfera(p, *r as f64, o, d, h.map_or(best, |x| x.0)) { h = Some(k); } }
                h
            }
            Forma::Caja { c, e, h } => {
                // (las placas de la caja en sus ejes: se entra por la cara que mira contra el rayo)
                let oc = sub(o, f64s(*c)); let (mut t0, mut t1) = (0.0f64, best); let mut n = [0.0; 3]; let mut ok = true;
                for k in 0..3 {
                    let ek = f64s(e[k]); let hk = h[k] as f64; let (oo, dd) = (dot(oc, ek), dot(d, ek));
                    if dd.abs() < 1e-9 { if oo.abs() > hk { ok = false; break; } continue; }
                    let (mut a, mut bb) = ((-hk - oo) / dd, (hk - oo) / dd); if a > bb { std::mem::swap(&mut a, &mut bb); }
                    if a > t0 { t0 = a; n = esc(ek, if dd > 0.0 { -1.0 } else { 1.0 }); }
                    if bb < t1 { t1 = bb; }
                    if t0 > t1 { ok = false; break; }
                }
                if ok && t0 > 0.0 { Some((t0, n)) } else { None }
            }
        };
        if let Some(h) = h { if h.0 < best { best = h.0; mejor = Some(h); } }
    }
    mejor
}
/// el rayo sólo contra los triángulos del mapa: la distancia, la normal hacia el rayo y si tocó la cara de atrás (el que
/// arranca adentro de algo cerrado —una pared, el piso— la ve de atrás; la luz global lo usa para no contar esas sondas)
pub fn rayo_tris(m: &Mundo, o: V, d: V, max: f64, ts: &mut Vec<u32>, cs: &mut Vec<u32>) -> Option<(f64, V, bool)> {
    let fin = add(o, esc(d, max)); ts.clear(); cs.clear();
    m.cerca(o[0].min(fin[0]) as f32, o[2].min(fin[2]) as f32, o[0].max(fin[0]) as f32, o[2].max(fin[2]) as f32, ts, cs);
    let mut mejor: Option<(f64, V, bool)> = None; let mut best = max;
    for &t in ts.iter() { if let Some(tt) = rayo_tri(m, o, d, t, best) { best = tt; let n = normal(m, t); let atras = dot(n, d) > 0.0; mejor = Some((tt, if atras { esc(n, -1.0) } else { n }, atras)); } }
    mejor
}
/// el rayo contra todo (raycast): el mapa y los cuerpos de la física menos los de `ignorar`; d de largo 1
pub fn rayo(m: &Mundo, fis: &mut Fisica, o: V, d: V, max: f64, ignorar: &[u32]) -> Option<Toque> {
    let g = rayo_mundo(m, o, d, max);
    let lim = g.map(|g| g.0).unwrap_or(max);
    // (los cuerpos: los que están antes de lo que tocó del mapa)
    let b = fis.rayo(m, o, d, lim, ignorar).filter(|h| h.cuerpo.is_some() && h.t < lim);
    match (b, g) {
        (Some(h), _) => Some(Toque { t: h.t, n: h.n, p: h.p, cuerpo: h.cuerpo }),
        (None, Some((t, n))) => Some(Toque { t, n, p: add(o, esc(d, t)), cuerpo: None }),
        _ => None,
    }
}

/// la altura del piso del mapa abajo de p, mirando desde `alto` arriba de p (pisoBajo)
pub fn piso_bajo(m: &Mundo, p: V, alto: f64) -> Option<f64> {
    rayo_mundo(m, [p[0], p[1] + alto, p[2]], [0.0, -1.0, 0.0], 400.0).map(|h| p[1] + alto - h.0)
}

/// suma una velocidad a un cuerpo en el punto r (relativo a su centro), como Body.applyVel(p, r, 1): sólo si se mueve
pub fn aplicar_vel(b: &mut Cuerpo, p: V, r: V) {
    if !b.despierto() { return; }
    for e in 0..3 { b.vel[e] += p[e] * b.inv_masa; }
    // (el giro: la inercia inversa en el mundo, R · I⁻¹ · Rᵀ, por r × p)
    let l = fisica::rot_inv(b.q, cruz(r, p)); let w = fisica::rot(b.q, [l[0] * b.inv_i[0], l[1] * b.inv_i[1], l[2] * b.inv_i[2]]);
    for e in 0..3 { b.ang[e] += w[e]; }
}

// ---------------- el azar ----------------
/// el azar (Math.random) con semilla: mulberry32, el mismo que se le pone a la web en las pruebas
#[derive(Clone, Debug)]
pub struct Azar(pub u32);
impl Azar {
    /// un número en [0, 1)
    pub fn f(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6D2B79F5); let mut t = self.0;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        (t ^ (t >> 14)) as f64 / 4294967296.0
    }
    /// uno de una lista (azarDe: de una lista siempre se tira el azar, aunque tenga uno solo)
    pub fn de<'a>(&mut self, l: &'a [String]) -> Option<&'a str> { if l.is_empty() { None } else { Some(&l[((self.f() * l.len() as f64) as usize).min(l.len() - 1)]) } }
}

// ---------------- las voces (sonidos.js) ----------------
/// la clase de voz de un skin (VOZ_CLASE): h hombre, m mujer, r robot, z zombi
pub fn voz_clase(skin: &str) -> char {
    match skin {
        "SpecialForcesW" | "PilotFemale" | "Bombera" => 'm',
        "Robot" | "Freddy" | "Bonnie" | "Chica" | "Foxy" | "Bon" | "Sha" | "V1" | "V2" => 'r',
        "Zombi" | "Corpse" | "BoiledOne" | "Sunman" | "Filbus" | "Alternate" | "Partygoer" | "Bacteria" => 'z',
        _ => 'h',
    }
}
/// el sonido de una voz (sonVoz): «dolor», «muere», «hola», «ay»…; devuelve el nombre y el tono (None: esa clase no
/// tiene esa voz). El que llama cuida que no hable más de una vez cada 0,45 s (salvo al morir)
pub fn voz(skin: &str, tipo: &str, azar: &mut Azar) -> Option<(String, f32)> {
    let c = voz_clase(skin);
    let n = |t: &str| -> u32 {
        match c {
            'z' => match t { "dolor" => 6, "muere" => 3, _ => 0 },
            'r' => match t { "dolor" => 2, "muere" => 1, _ => 0 },
            _ => match t { "dolor" => 9, "ay" => 2, "hola" => 2, "bien" => 2, "no" => 2, "ayuda" => 1, "ok" => 1, _ => 0 },
        }
    };
    let nombre = if tipo == "muere" && (c == 'h' || c == 'm') { format!("VZ_{c}_dolor{}", 7 + (azar.f() * 3.0) as u32) }   // (las más largas)
        else { let k = n(tipo); if k == 0 { return None; } format!("VZ_{c}_{tipo}{}", 1 + (azar.f() * k as f64) as u32) };
    let tono = if c == 'z' || c == 'r' { 0.95 + azar.f() * 0.1 } else { 0.97 + azar.f() * 0.06 };
    Some((nombre, tono as f32))
}
