//! Las puertas de los mapas del Workshop (puertas.js) y sus entradas y salidas (mapaio.js): func_door, func_door_rotating,
//! func_movelinear y prop_door_rotating (cerrada → abriéndose → abierta → cerrándose, «Usar» al mirarla, abrirse sola al
//! tocarla si el mapa lo pide, no cerrarse encima de nadie, las dobles juntas), lo que gira (func_rotating), los trenes
//! (func_tracktrain por su camino de path_track, llevando al que está parado arriba), los botones, las zonas, los sonidos
//! del mapa (ambient_generic), los relevos (logic_relay) y lo que pasa al cargar (logic_auto), con sus demoras y sus «veces».
//! Acá va la lógica; los cuerpos de choque, el dibujo y el sonido los pone nativo/mapas_juego.rs.
use crate::bsp::{BotonBsp, CaminoBsp, Io, PuertaDef, Salida, SonidoBsp, ZonaBsp, GM_S};
use std::collections::HashMap;

pub type V = [f32; 3];
pub type Q = [f32; 4];
fn add(a: V, b: V) -> V { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
fn sub(a: V, b: V) -> V { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
fn esc(a: V, k: f32) -> V { [a[0] * k, a[1] * k, a[2] * k] }
fn dot(a: V, b: V) -> f32 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn largo(a: V) -> f32 { dot(a, a).sqrt() }
/// Quat.axis
pub fn q_eje(ax: V, ang: f32) -> Q { let l = largo(ax); let l = if l > 0.0 { l } else { 1.0 }; let s = (ang / 2.0).sin(); [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, (ang / 2.0).cos()] }
pub fn q_mul(a: Q, b: Q) -> Q { [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]] }
pub fn q_rot(q: Q, v: V) -> V {
    let (x, y, z, w) = (q[0], q[1], q[2], q[3]); let t = [2.0 * (y * v[2] - z * v[1]), 2.0 * (z * v[0] - x * v[2]), 2.0 * (x * v[1] - y * v[0])];
    [v[0] + w * t[0] + y * t[2] - z * t[1], v[1] + w * t[1] + z * t[0] - x * t[2], v[2] + w * t[2] + x * t[1] - y * t[0]]
}
const SIGNO: fn(f32) -> f32 = |x| if x > 0.0 { 1.0 } else if x < 0.0 { -1.0 } else { 0.0 };

/// una salida con su número (para contar las «veces»)
#[derive(Clone, Debug)]
pub struct Sal { pub s: Salida, id: usize }
/// un tren (func_tracktrain): dónde está, dónde arrancó, su giro, el punto en que va, su velocidad, la pedida y el sentido
#[derive(Clone, Debug, Default)]
pub struct Tren { pub pos: V, pub pos0: V, pub q: Q, pub cur: Option<usize>, pub vel: f32, pub meta: f32, pub dir: f32 }
/// una puerta (o lo que gira, o un tren)
#[derive(Clone, Debug)]
pub struct Puerta {
    pub def: PuertaDef, pub piv: V, pub q0: Q, pub padre: String,
    /// cuánto está abierta (0..1) y hacia dónde va; para qué lado se abre; el tiempo abierta
    pub k: f32, pub meta: f32, pub sentido: f32, pub t: f32,
    /// el centro de su casco de choque (en su espacio) y si tiene cuerpo (los pone quien arma los cuerpos)
    pub c: V, pub con_cuerpo: bool,
    /// las que se corren: cuánto y para dónde; las que giran: su eje
    pub recorrido: f32, pub dir: V, pub eje: V,
    /// las que se abren juntas y el tren que la lleva
    pub grupo: Vec<usize>, pub tren_padre: Option<usize>,
    /// lo que gira: su ángulo, si anda, para qué lado, a qué parte de su velocidad y su velocidad de ahora
    pub ang: f32, pub on: bool, pub dir_rot: f32, pub vel_k: f32, pub vel_act: f32,
    pub tren: Option<Tren>, pub botones: Vec<usize>,
    /// dónde quedó (su eje y su giro) y si se movió desde la última vez que se miró
    pub pos: V, pub q: Q, pub sucio: bool,
}
#[derive(Clone, Debug)]
pub struct Boton { pub lo: V, pub hi: V, lo0: V, hi0: V, p: Vec<Sal>, i: Vec<Sal>, o: Vec<Sal>, l: Vec<Sal>, tog: bool, pub bloq: bool, pub n: String, pub pa: String, est: bool }
#[derive(Clone, Debug)]
pub struct Zona { pub lo: V, pub hi: V, en: Vec<Sal>, sa: Vec<Sal>, una: bool, pub n: String, pub off: bool, dentro: bool, hecha: bool }
#[derive(Clone, Debug)]
pub struct Camino { pub n: String, pub p: V, sig: String, alt: String, alt_on: bool, off: bool, sal: Vec<Sal>, vel: f32, sf: i32 }
#[derive(Clone, Debug)]
pub struct Snd { pub def: SonidoBsp, pub i: usize, pub on: bool, pub vol: f32, pub tono: f32, pub muerto: bool, pub suena: bool }

/// lo que el juego tiene que hacer: un sonido del juego (la puerta), uno del mapa (un archivo o un guion de Source; con
/// clave, un bucle que hay que mantener este cuadro) y parar uno
#[derive(Clone, Debug, PartialEq)]
pub enum Ev { Juego { n: &'static str, p: V, vol: f32 }, Mapa { s: String, p: Option<V>, vol: f32, tono: f32, bucle: Option<String> }, Parar { snd: usize } }

/// lo que el juego sabe del jugador para las puertas
#[derive(Clone, Copy, Debug)]
pub struct Jug { pub pos: V, pub radio: f32, pub vivo: bool, pub noclip: bool, pub cam: V }

#[derive(Default)]
pub struct Puertas {
    pub l: Vec<Puerta>, pub bot: Vec<Boton>, pub zona: Vec<Zona>, pub caminos: Vec<Camino>, cam_i: HashMap<String, usize>,
    pub snd: Vec<Snd>, relay: Vec<(String, Vec<Sal>, bool)>, pend: Vec<(f32, Sal, bool)>, t: f32, veces: HashMap<usize, i32>, sig: usize,
    /// lo que pasó (sonidos): lo saca el juego cada cuadro
    pub ev: Vec<Ev>,
}

/// una puerta para armar: su definición, su eje, su giro inicial, su casco (en su espacio), su caja y el tren de cascos
pub struct PuertaIni { pub def: PuertaDef, pub piv: V, pub q0: Q, pub caja: Option<(V, V)>, pub casco: Vec<V>, pub padre: String }

impl Puertas {
    fn sales(&mut self, v: &[Salida]) -> Vec<Sal> { v.iter().map(|s| { self.sig += 1; Sal { s: s.clone(), id: self.sig } }).collect() }
    /// puertasIniciar + mioIniciar: las puertas, los botones, las zonas, los caminos y lo de mapaio
    pub fn nuevo(ps: Vec<PuertaIni>, bots: &[BotonBsp], zonas: &[ZonaBsp], caminos: &[CaminoBsp], io: &Io) -> Puertas {
        let mut s = Puertas::default();
        for b in bots { let (p, i, o, l) = (s.sales(&b.p), s.sales(&b.i), s.sales(&b.o), s.sales(&b.l)); s.bot.push(Boton { lo: b.c.0, hi: b.c.1, lo0: b.c.0, hi0: b.c.1, p, i, o, l, tog: b.tog, bloq: b.bloq, n: b.n.clone(), pa: b.pa.clone(), est: false }); }
        for z in zonas { let (en, sa) = (s.sales(&z.en), s.sales(&z.sa)); s.zona.push(Zona { lo: z.c.0, hi: z.c.1, en, sa, una: z.una, n: z.n.clone(), off: z.off, dentro: false, hecha: false }); }
        for c in caminos { let sal = s.sales(&c.sal); if !s.cam_i.contains_key(&c.n) { s.cam_i.insert(c.n.clone(), s.caminos.len()); } s.caminos.push(Camino { n: c.n.clone(), p: c.p, sig: c.sig.clone(), alt: c.alt.clone(), alt_on: false, off: c.sf & 1 != 0, sal, vel: c.vel, sf: c.sf }); }
        for pi in ps {
            let mut def = pi.def; def.nombre = def.nombre.to_lowercase(); def.esclavo = def.esclavo.to_lowercase();
            let mut d = Puerta { k: if def.abierta { 1.0 } else { 0.0 }, meta: if def.abierta { 1.0 } else { 0.0 }, sentido: if def.sentido != 0.0 { def.sentido } else { 1.0 }, t: 0.0, c: [0.0; 3], con_cuerpo: false,
                recorrido: 0.0, dir: def.dir, eje: def.eje, grupo: vec![], tren_padre: None, ang: 0.0, on: def.arranca, dir_rot: if def.rev { -1.0 } else { 1.0 }, vel_k: 1.0, vel_act: 0.0, tren: None, botones: vec![],
                pos: pi.piv, q: pi.q0, sucio: true, piv: pi.piv, q0: pi.q0, padre: pi.padre.to_lowercase(), def };
            if d.def.tren {
                let mut t = Tren { pos: pi.piv, pos0: pi.piv, q: pi.q0, cur: None, vel: 0.0, meta: 0.0, dir: 1.0 };
                // (arranca en su primer punto, como en Source: el origen del tren va al punto —más su "height"—)
                if let Some(&ci) = s.cam_i.get(&d.def.primero) { t.cur = Some(ci); t.pos = s.caminos[ci].p; t.pos[1] += d.def.alto; }
                t.vel = d.def.vel_ini; t.meta = t.vel; if t.vel < 0.0 { t.dir = -1.0; }
                d.tren = Some(t);
                if !d.def.nombre.is_empty() { d.botones = s.bot.iter().enumerate().filter(|(_, b)| b.pa == d.def.nombre).map(|(i, _)| i).collect(); }
            } else if !d.def.giro {
                // (la que se corre, como en Source: lo que mide en su dirección, menos 2 unidades y menos el "lip")
                let pts: Vec<V> = match pi.caja { Some((lo, hi)) => (0..8).map(|i| [if i & 1 != 0 { hi[0] } else { lo[0] }, if i & 2 != 0 { hi[1] } else { lo[1] }, if i & 4 != 0 { hi[2] } else { lo[2] }]).collect(), None => pi.casco.clone() };
                let (mut mn, mut mx) = (1e9f32, -1e9f32); for p in &pts { let v = dot(q_rot(d.q0, *p), d.dir); mn = mn.min(v); mx = mx.max(v); }
                d.recorrido = match d.def.dist_m { Some(x) => x, None => if mx > mn { mx - mn - 2.0 * GM_S - d.def.lip } else { 0.0 } };
            }
            s.l.push(d);
        }
        // (las pegadas a un tren se corren con él; las dobles se abren juntas)
        for i in 0..s.l.len() { if s.l[i].def.tren && !s.l[i].def.nombre.is_empty() { let n = s.l[i].def.nombre.clone(); for x in 0..s.l.len() { if x != i && !s.l[x].def.tren && s.l[x].padre == n { s.l[x].tren_padre = Some(i); } } } }
        for i in 0..s.l.len() {
            let (n, es, cl, piv) = (s.l[i].def.nombre.clone(), s.l[i].def.esclavo.clone(), s.l[i].def.cl.clone(), s.l[i].piv);
            s.l[i].grupo = (0..s.l.len()).filter(|&x| { let xx = &s.l[x]; x != i && xx.def.cl == cl && ((!n.is_empty() && xx.def.nombre == n && largo(sub(xx.piv, piv)) < 3.0) || (!es.is_empty() && xx.def.nombre == es) || (!xx.def.esclavo.is_empty() && !n.is_empty() && xx.def.esclavo == n)) }).collect();
        }
        for i in 0..s.l.len() { s.poner(i); }
        // lo de mapaio: los sonidos (los que empiezan sonando y se repiten, prendidos), los relevos y lo de al cargar
        for (i, d) in io.snd.iter().enumerate() { s.snd.push(Snd { def: d.clone(), i, on: d.ini && d.bucle, vol: d.v, tono: d.tono, muerto: false, suena: false }); }
        for (n, sal, on) in &io.relay { let sal = s.sales(sal); s.relay.push((n.clone(), sal, *on)); }
        let auto = s.sales(&io.auto); s.disparar(&auto, false, None);
        s
    }
    /// puertaPoner / trenPoner: la puerta en su lugar según cuánto está abierta
    pub fn poner(&mut self, i: usize) {
        let tp = self.l[i].tren_padre.and_then(|t| self.l[t].tren.as_ref().map(|x| sub(x.pos, x.pos0)));
        let d = &mut self.l[i];
        if let Some(t) = &d.tren {
            d.pos = t.pos; d.q = t.q; d.sucio = true; let dd = sub(t.pos, t.pos0);
            for &b in &d.botones { let bb = &mut self.bot[b]; bb.lo = add(bb.lo0, dd); bb.hi = add(bb.hi0, dd); }
            let hijos: Vec<usize> = (0..self.l.len()).filter(|&x| self.l[x].tren_padre == Some(i)).collect(); for x in hijos { self.poner(x); }
            return;
        }
        let (p, q) = if d.def.rot { (d.piv, q_mul(q_eje(d.eje, d.ang.to_radians()), d.q0)) }
            else if d.def.giro { let ang = (d.def.dist * d.sentido * d.k).to_radians(); let ax = if d.def.eje_local { q_rot(d.q0, d.eje) } else { d.eje }; (d.piv, q_mul(q_eje(ax, ang), d.q0)) }
            else { (add(d.piv, esc(d.dir, d.recorrido * d.k)), d.q0) };
        d.pos = match tp { Some(x) => add(p, x), None => p }; d.q = q; d.sucio = true;
    }
    /// dónde va el cuerpo de choque de la puerta (su casco está centrado en `c`)
    pub fn pos_cuerpo(&self, i: usize, c: V) -> (V, Q) { let d = &self.l[i]; (add(d.pos, q_rot(d.q, c)), d.q) }
    /// puertaAlternar: abrir o cerrar (sin decir cuál, lo contrario)
    pub fn alternar(&mut self, i: usize, abrir: Option<bool>, jug: V) {
        let d = &mut self.l[i];
        let abrir = abrir.unwrap_or(d.meta < 0.5);
        if abrir && d.def.giro && !d.def.una_via && d.k < 0.02 {
            // (se abre para el lado contrario al de quien la abre, como en Source)
            let ax = if d.def.eje_local { q_rot(d.q0, d.eje) } else { d.eje }; let cerrada = add(d.piv, q_rot(d.q0, d.c));
            let girada = add(d.piv, q_rot(q_mul(q_eje(ax, 0.35 * SIGNO(if d.def.dist != 0.0 { d.def.dist } else { 1.0 })), d.q0), d.c));
            d.sentido = if dot(sub(girada, cerrada), sub(jug, cerrada)) > 0.0 { -1.0 } else { 1.0 };
        }
        d.meta = if abrir { 1.0 } else { 0.0 }; d.t = 0.0;
        if !d.def.silencio { let p = if d.con_cuerpo { add(d.pos, q_rot(d.q, d.c)) } else { d.piv }; self.ev.push(Ev::Juego { n: "fn_puerta", p, vol: 0.55 }); }
    }
    /// puertasPaso: cada cuadro, lo que gira, las que se mueven, se cierran solas o se abren al tocarlas, y las zonas.
    /// `toca(i, margen)`: si la puerta i toca al jugador
    pub fn paso(&mut self, dt: f32, jug: &Jug, toca: &mut dyn FnMut(usize, f32) -> bool) {
        self.mio_paso(dt, jug);
        for i in 0..self.l.len() {
            if self.l[i].def.tren { continue; }
            if self.l[i].def.rot {
                // (arranca y frena en un segundo, como en Source)
                let d = &mut self.l[i]; let meta = if d.on { d.def.vel * d.vel_k } else { 0.0 };
                d.vel_act += SIGNO(meta - d.vel_act) * (meta - d.vel_act).abs().min(d.def.vel * dt);
                if d.vel_act > 0.01 { d.ang = (d.ang + d.vel_act * d.dir_rot * dt) % 360.0; self.poner(i); }
                continue;
            }
            let (k, meta) = (self.l[i].k, self.l[i].meta);
            if k != meta {
                let d = &mut self.l[i];
                let vel = if d.def.giro { d.def.vel.max(20.0) / d.def.dist.abs().max(1.0) } else { (if d.def.vel_m != 0.0 { d.def.vel_m } else { 2.5 }).max(0.3) / d.recorrido.max(0.05) };
                d.k += SIGNO(meta - k) * (meta - k).abs().min(dt * vel);
                self.poner(i);
                // (cerrándose sobre alguien: vuelve a abrirse, como las de Source)
                if meta < k && self.l[i].con_cuerpo && jug.vivo && !jug.noclip && toca(i, 0.0) { self.l[i].k = k; self.poner(i); self.alternar(i, Some(true), jug.pos); }
            } else if meta == 1.0 && self.l[i].def.espera > 0.0 {
                self.l[i].t += dt;
                if self.l[i].t > self.l[i].def.espera && !(self.l[i].con_cuerpo && jug.vivo && !jug.noclip && toca(i, 0.3)) { self.alternar(i, Some(false), jug.pos); }
            }
            let d = &self.l[i];
            if d.def.toca && d.meta == 0.0 && d.k < 0.01 && d.con_cuerpo && jug.vivo && !jug.noclip && toca(i, 0.12) { self.alternar(i, Some(true), jug.pos); }
        }
        // las zonas: al entrar y al salir (el cuerpo entero, de los pies a la cabeza)
        if !self.zona.is_empty() && jug.vivo && !jug.noclip {
            let (p, r) = (jug.pos, if jug.radio > 0.0 { jug.radio } else { 0.45 }); let (y0, y1) = (p[1] - 0.95, p[1] + 0.95);
            for zi in 0..self.zona.len() {
                let z = &mut self.zona[zi];
                let den = p[0] + r > z.lo[0] && p[0] - r < z.hi[0] && p[2] + r > z.lo[2] && p[2] - r < z.hi[2] && y1 > z.lo[1] && y0 < z.hi[1];
                if den == z.dentro { continue; } z.dentro = den;
                if (z.una && z.hecha) || z.off { continue; }
                let l = if den { z.en.clone() } else { z.sa.clone() }; if den { z.hecha = true; }
                self.disparar(&l, false, Some(jug));
            }
        }
    }
    /// el botón del mapa que se mira (su caja, hasta donde llega la mano y sin atravesar paredes)
    pub fn boton_apuntado(&self, o: V, d: V, lejos: f32, tope: f32) -> Option<usize> {
        let mut mejor = None; let mut tm = lejos.min(tope + 0.08);
        for (bi, b) in self.bot.iter().enumerate() {
            let (mut t0, mut t1) = (0f32, tm);
            for k in 0..3 {
                if d[k].abs() < 1e-9 { if o[k] < b.lo[k] - 0.02 || o[k] > b.hi[k] + 0.02 { t0 = 1.0; t1 = 0.0; break; } continue; }
                let (mut a, mut c) = ((b.lo[k] - 0.02 - o[k]) / d[k], (b.hi[k] + 0.02 - o[k]) / d[k]); if a > c { std::mem::swap(&mut a, &mut c); }
                t0 = t0.max(a); t1 = t1.min(c); if t0 > t1 { break; }
            }
            if t0 <= t1 && t0 < tm { tm = t0; mejor = Some(bi); }
        }
        mejor
    }
    /// puertaUsar de una puerta: alternarla, y las de su grupo con ella
    pub fn usar_puerta(&mut self, i: usize, jug: V) {
        self.alternar(i, None, jug);
        let ab = self.l[i].meta > 0.5;
        for x in self.l[i].grupo.clone() { if (self.l[x].meta > 0.5) != ab { self.alternar(x, Some(ab), jug); } }
    }
    /// puertaUsar de un botón (con su ruido)
    pub fn usar_boton(&mut self, b: usize, jug: &Jug) {
        let c = esc(add(self.bot[b].lo, self.bot[b].hi), 0.5); self.ev.push(Ev::Juego { n: "fn_puerta", p: c, vol: 0.25 });
        self.boton(b, true, Some(jug));
    }
    /// mioBoton: OnPressed siempre; los de dos posiciones, OnIn y OnOut una vez cada uno
    fn boton(&mut self, b: usize, local: bool, jug: Option<&Jug>) {
        let bb = self.bot[b].clone();
        if bb.bloq { self.disparar(&bb.l, !local, jug); return; }
        self.disparar(&bb.p, !local, jug);
        if bb.tog { self.bot[b].est = !self.bot[b].est; let l = if self.bot[b].est { bb.i } else { bb.o }; self.disparar(&l, !local, jug); }
        else { self.disparar(&bb.i, !local, jug); }
    }
    /// mioDisparar: cumplir una lista de salidas (con su demora y sus veces)
    fn disparar(&mut self, l: &[Sal], remoto: bool, jug: Option<&Jug>) {
        for o in l {
            if o.s.n > 0 { let n = self.veces.entry(o.id).or_insert(0); if *n >= o.s.n { continue; } *n += 1; }
            if o.s.d > 0.0 { self.pend.push((self.t + o.s.d, o.clone(), remoto)); } else { self.entrada(&o.s.t, &o.s.i, &o.s.v, remoto, jug); }
        }
    }
    /// mioEntrada: lo que llega a las cosas de ese nombre (con * al final, las que empiezan así)
    pub fn entrada(&mut self, t: &str, inp: &str, par: &str, remoto: bool, jug: Option<&Jug>) {
        let igual = |n: &str| if let Some(p) = t.strip_suffix('*') { !n.is_empty() && n.starts_with(p) } else { n == t };
        let jp = jug.map(|j| j.pos).unwrap_or([0.0; 3]);
        for i in 0..self.l.len() {
            if !igual(&self.l[i].def.nombre) { continue; }
            if self.l[i].def.tren { self.tren_entrada(i, inp, par); }
            else if self.l[i].def.rot { self.rot_entrada(i, inp, par); }
            else if !remoto { let m = self.l[i].meta; match inp { "toggle" => self.alternar(i, None, jp), "open" if m < 0.5 => self.alternar(i, Some(true), jp), "close" if m > 0.5 => self.alternar(i, Some(false), jp), _ => {} } }
        }
        for c in self.caminos.iter_mut() { if igual(&c.n) { match inp {
            "enablealternatepath" => c.alt_on = true, "disablealternatepath" => c.alt_on = false, "togglealternatepath" => c.alt_on = !c.alt_on,
            "enablepath" => c.off = false, "disablepath" => c.off = true, "togglepath" => c.off = !c.off, _ => {} } } }
        for s in 0..self.snd.len() { if igual(&self.snd[s].def.n) { self.snd_entrada(s, inp, par, jug); } }
        for r in 0..self.relay.len() {
            if !igual(&self.relay[r].0) { continue; }
            match inp { "trigger" => if self.relay[r].2 { let l = self.relay[r].1.clone(); self.disparar(&l, remoto, jug); }, "enable" => self.relay[r].2 = true, "disable" => self.relay[r].2 = false, "toggle" => self.relay[r].2 = !self.relay[r].2, _ => {} }
        }
        for z in self.zona.iter_mut() { if igual(&z.n) { match inp { "enable" => z.off = false, "disable" => z.off = true, "toggle" => z.off = !z.off, _ => {} } } }
        for b in 0..self.bot.len() { if igual(&self.bot[b].n) { match inp { "lock" => self.bot[b].bloq = true, "unlock" => self.bot[b].bloq = false, "press" if !remoto => self.boton(b, true, jug), _ => {} } } }
    }
    /// rotEntrada: lo que gira
    fn rot_entrada(&mut self, i: usize, inp: &str, par: &str) {
        let d = &mut self.l[i]; let base = if d.def.rev { -1.0 } else { 1.0 };
        match inp {
            "start" => d.on = true, "stop" => d.on = false, "toggle" => d.on = !d.on, "reverse" => d.dir_rot = -d.dir_rot,
            "startforward" => { d.on = true; d.dir_rot = base; } "startbackward" => { d.on = true; d.dir_rot = -base; }
            "setspeed" => { let v = num(par); if v.is_finite() { d.vel_k = v.clamp(0.0, 1.0); d.on = d.vel_k > 0.0; } }
            _ => {}
        }
    }
    /// sndEntrada: un sonido del mapa
    fn snd_entrada(&mut self, s: usize, inp: &str, par: &str, jug: Option<&Jug>) {
        if self.snd[s].muerto { return; }
        let cam = jug.map(|j| j.cam);
        let parar = |me: &mut Puertas| { me.snd[s].on = false; if me.snd[s].suena { me.snd[s].suena = false; me.ev.push(Ev::Parar { snd: s }); } };
        let tocar = |me: &mut Puertas| {
            let x = &me.snd[s]; if x.def.bucle { me.snd[s].on = true; return; }
            let d = if x.def.todo { 0.0 } else { cam.map(|c| largo(sub(x.def.p, c))).unwrap_or(0.0) }; if d > x.def.r { return; }
            let e = Ev::Mapa { s: x.def.s.clone(), p: if x.def.todo { None } else { Some(x.def.p) }, vol: x.vol.max(0.05), tono: x.tono, bucle: None };
            me.snd[s].suena = true; me.ev.push(e);
        };
        match inp {
            "playsound" | "fadein" => tocar(self),
            "stopsound" => parar(self),
            "fadeout" => { let t = num(par).max(0.0); let t = if t.is_finite() { t } else { 0.0 }; if t > 0.0 { self.sig += 1; let n = self.snd[s].def.n.clone(); self.pend.push((self.t + t, Sal { s: Salida { t: n, i: "stopsound".into(), v: String::new(), d: 0.0, n: -1 }, id: self.sig }, false)); } else { parar(self); } }
            "togglesound" => { if self.snd[s].def.bucle { self.snd[s].on = !self.snd[s].on; } else if self.snd[s].suena { parar(self); } else { tocar(self); } }
            "volume" => { let v = num(par); let v = (if v.is_finite() { v } else { 0.0 }).clamp(0.0, 10.0) / 10.0; self.snd[s].vol = v; if v <= 0.0 && !self.snd[s].def.bucle { parar(self); } }
            "pitch" => { let v = num(par); if v > 0.0 { self.snd[s].tono = (v / 100.0).clamp(0.3, 2.5); } }
            "kill" => { parar(self); self.snd[s].muerto = true; }
            _ => {}
        }
    }
    /// mioPaso: lo que tenía demora y los sonidos que se repiten (los 8 más cerca, con lo que llegan)
    fn mio_paso(&mut self, dt: f32, jug: &Jug) {
        self.t += dt;
        if !self.pend.is_empty() {
            let t = self.t; let (ya, resto): (Vec<_>, Vec<_>) = std::mem::take(&mut self.pend).into_iter().partition(|p| p.0 <= t); self.pend = resto;
            for (_, o, r) in ya { self.entrada(&o.s.t, &o.s.i, &o.s.v, r, Some(jug)); }
        }
        let mut cerca: Vec<(f32, usize)> = vec![];
        for (i, s) in self.snd.iter().enumerate() {
            if !s.on || !s.def.bucle || s.muerto || s.vol <= 0.0 { continue; }
            let d = if s.def.todo { 0.0 } else { largo(sub(s.def.p, jug.cam)) }; if d <= s.def.r { cerca.push((d, i)); }
        }
        cerca.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        for &(d, i) in cerca.iter().take(8) {
            let s = &self.snd[i]; let vol = s.vol * if s.def.todo { 1.0 } else { (1.0 - d / s.def.r).max(0.0) } * 0.8;
            self.ev.push(Ev::Mapa { s: s.def.s.clone(), p: if s.def.todo { None } else { Some(s.def.p) }, vol, tono: s.tono, bucle: Some(format!("mio{}", s.i)) });
        }
    }

    // ---------------- trenes ----------------
    /// el siguiente punto del camino (para adelante) o el anterior (para atrás)
    fn tren_sig(&self, n: Option<usize>, dir: f32) -> Option<usize> {
        let n = n?; let nn = &self.caminos[n];
        let k = |m: &Camino| if m.alt_on && !m.alt.is_empty() { m.alt.clone() } else { m.sig.clone() };
        if dir > 0.0 { let kk = k(nn); if kk.is_empty() { return None; } return self.cam_i.get(&kk).copied(); }
        self.caminos.iter().position(|m| k(m) == nn.n)
    }
    fn tren_sonido(&mut self, i: usize, ini: bool) {
        let d = &self.l[i]; let s = if ini { &d.def.s_ini } else { &d.def.s_fin }; if s.is_empty() { return; }
        let e = Ev::Mapa { s: s.clone(), p: Some(d.tren.as_ref().map(|t| t.pos).unwrap_or(d.piv)), vol: 0.8 * d.def.vol, tono: 1.0, bucle: None }; self.ev.push(e);
    }
    /// trenEntrada
    fn tren_entrada(&mut self, i: usize, inp: &str, par: &str) {
        let max = if self.l[i].def.vel_max != 0.0 { self.l[i].def.vel_max } else { 2.5 }; let v = num(par);
        let andar = |me: &mut Puertas, dir: f32, vel: f32| {
            let antes = { let t = me.l[i].tren.as_ref().unwrap(); t.meta.abs() > 0.01 || t.vel.abs() > 0.01 }; let acel = me.l[i].def.acel;
            let t = me.l[i].tren.as_mut().unwrap(); t.dir = dir; t.meta = dir * vel; if acel == 0.0 { t.vel = t.meta; }
            if !antes && vel > 0.0 { me.tren_sonido(i, true); }
        };
        let td = self.l[i].tren.as_ref().map(|t| t.dir).unwrap_or(1.0);
        match inp {
            "startforward" => andar(self, 1.0, max), "startbackward" => andar(self, -1.0, max),
            "stop" => { let t = self.l[i].tren.as_mut().unwrap(); let iba = t.vel.abs() > 0.01; t.vel = 0.0; t.meta = 0.0; if iba { self.tren_sonido(i, false); } }
            "resume" => andar(self, td, max),
            "toggle" => { if self.l[i].tren.as_ref().unwrap().meta.abs() > 0.01 { self.tren_entrada(i, "stop", ""); } else { andar(self, td, max); } }
            "reverse" => { let t = self.l[i].tren.as_mut().unwrap(); t.dir = -t.dir; t.meta = -t.meta; t.vel = -t.vel; }
            "setspeed" if v.is_finite() => andar(self, td, v.clamp(0.0, 1.0) * max),
            "setspeedreal" if v.is_finite() => andar(self, td, v.abs() * GM_S),
            "setspeeddir" | "setspeeddiraccel" if v.is_finite() => andar(self, if v < 0.0 { -1.0 } else { 1.0 }, v.abs().min(1.0) * max),
            "setmaxspeed" if v.is_finite() => self.l[i].def.vel_max = v.abs() * GM_S,
            "teleporttopathtrack" => { if let Some(&n) = self.cam_i.get(&par.to_lowercase()) { let (p, alto) = (self.caminos[n].p, self.l[i].def.alto); let t = self.l[i].tren.as_mut().unwrap(); t.cur = Some(n); t.pos = p; t.pos[1] += alto; self.poner(i); } }
            _ => {}
        }
    }
    /// trenesPaso: cada tren por su camino; devuelve lo que se movió el tren donde está parado el jugador (`pisa`)
    pub fn trenes_paso(&mut self, dt: f32, pisa: Option<usize>, jug: &Jug) -> V {
        let mut mov = [0.0; 3];
        for i in 0..self.l.len() {
            if !self.l[i].def.tren { continue; }
            let a0 = self.l[i].tren.as_ref().unwrap().pos;
            self.tren_paso(i, dt, jug);
            let d = sub(self.l[i].tren.as_ref().unwrap().pos, a0);
            if pisa == Some(i) { mov = d; }
        }
        mov
    }
    fn tren_paso(&mut self, i: usize, dt: f32, jug: &Jug) {
        let (acel, decel, alto, fija, sin_pitch) = (self.l[i].def.acel, self.l[i].def.decel, self.l[i].def.alto, self.l[i].def.fija, self.l[i].def.sin_pitch);
        { let t = self.l[i].tren.as_mut().unwrap(); if t.vel != t.meta { let a = if t.meta.abs() > t.vel.abs() { acel } else { decel }; let a = if a != 0.0 { a } else { 1e9 }; t.vel += SIGNO(t.meta - t.vel) * (t.meta - t.vel).abs().min(a * dt); }
          if t.vel.abs() < 1e-4 { return; } }
        let dir = if self.l[i].tren.as_ref().unwrap().vel > 0.0 { 1.0 } else { -1.0 };
        let mut resto = self.l[i].tren.as_ref().unwrap().vel.abs() * dt;
        for _ in 0..8 {
            if resto <= 1e-6 { break; }
            let cur = self.l[i].tren.as_ref().unwrap().cur; let h = self.tren_sig(cur, dir);
            // (sin camino para ese lado, o el punto apagado: se para, como en Source)
            let Some(h) = h.filter(|&h| !self.caminos[h].off) else { let t = self.l[i].tren.as_mut().unwrap(); t.vel = 0.0; t.meta = 0.0; self.tren_sonido(i, false); break };
            let hp = self.caminos[h].p; let meta = [hp[0], hp[1] + alto, hp[2]];
            let t = self.l[i].tren.as_mut().unwrap(); let d = sub(meta, t.pos); let l = largo(d);
            // (mirando hacia donde va, salvo los de orientación fija —el ascensor—)
            if !fija && l > 0.01 { let f = esc(d, dir / l); let yaw = f[0].atan2(f[2]); let pit = if sin_pitch { 0.0 } else { -f[1].clamp(-1.0, 1.0).asin() }; t.q = q_mul(q_eje([0.0, 1.0, 0.0], yaw), q_eje([1.0, 0.0, 0.0], pit)); }
            if l > resto { t.pos = add(t.pos, esc(d, resto / l)); break; }
            t.pos = meta; resto -= l; t.cur = Some(h);
            // al pasar el punto: sus salidas (OnPass), la velocidad nueva que pide y si para o salta al siguiente
            let (hv, hsf, sal) = (self.caminos[h].vel, self.caminos[h].sf, self.caminos[h].sal.clone());
            if hv > 0.0 { let t = self.l[i].tren.as_mut().unwrap(); t.meta = dir * hv; if acel == 0.0 { t.vel = t.meta; } }
            self.disparar(&sal, false, Some(jug));
            if hsf & 16 != 0 { if let Some(s2) = self.tren_sig(Some(h), dir) { let p2 = self.caminos[s2].p; let t = self.l[i].tren.as_mut().unwrap(); t.pos = [p2[0], p2[1] + alto, p2[2]]; t.cur = Some(s2); } }
            let t = self.l[i].tren.as_mut().unwrap();
            if hsf & 8 != 0 || t.meta.abs() < 1e-4 { let iba = t.vel.abs() > 0.01; t.vel = 0.0; t.meta = 0.0; if iba { self.tren_sonido(i, false); } break; }
        }
        self.poner(i);
        // el ruido mientras anda
        let d = &self.l[i]; let t = d.tren.as_ref().unwrap();
        if !d.def.s_mov.is_empty() && t.vel.abs() > 0.01 { let e = Ev::Mapa { s: d.def.s_mov.clone(), p: Some(t.pos), vol: 0.6 * d.def.vol, tono: 1.0, bucle: Some(format!("tren{i}")) }; self.ev.push(e); }
    }
}
fn num(s: &str) -> f32 { let t = s.trim(); if t.is_empty() { 0.0 } else { t.parse::<f32>().unwrap_or(f32::NAN) } }


#[cfg(test)]
mod prueba {
    use super::*;
    use crate::bsp::{CaminoBsp, PuertaDef};
    fn jug() -> Jug { Jug { pos: [0.0, 1.0, 3.0], radio: 0.45, vivo: true, noclip: false, cam: [0.0, 1.6, 3.0] } }
    /// una puerta corrediza que abre un botón con demora, se abre en su tiempo y se cierra sola
    #[test]
    fn boton_abre_puerta() {
        let def = PuertaDef { cl: "func_door".into(), usa: true, vel: 100.0, vel_m: 100.0 * GM_S, espera: 1.0, nombre: "p1".into(), dir: [0.0, 1.0, 0.0], sentido: 1.0, ..Default::default() };
        let ini = PuertaIni { def, piv: [0.0; 3], q0: [0.0, 0.0, 0.0, 1.0], caja: Some(([-1.0, 0.0, -0.1], [1.0, 2.5, 0.1])), casco: vec![], padre: String::new() };
        let b = BotonBsp { c: ([1.0, 1.0, 1.0], [1.2, 1.2, 1.2]), p: vec![Salida { t: "p1".into(), i: "open".into(), v: String::new(), d: 0.5, n: -1 }], ..Default::default() };
        let mut p = Puertas::nuevo(vec![ini], &[b], &[], &[], &Io::default());
        assert!((p.l[0].recorrido - (2.5 - 2.0 * GM_S)).abs() < 1e-5);
        let j = jug(); p.usar_boton(0, &j);
        let mut no = |_: usize, _: f32| false;
        p.paso(0.4, &j, &mut no); assert_eq!(p.l[0].meta, 0.0);
        p.paso(0.2, &j, &mut no); assert_eq!(p.l[0].meta, 1.0);
        for _ in 0..120 { p.paso(0.01, &j, &mut no); }
        assert!(p.l[0].k > 0.99 && (p.l[0].pos[1] - p.l[0].recorrido).abs() < 1e-3);
        for _ in 0..200 { p.paso(0.01, &j, &mut no); }
        assert_eq!(p.l[0].meta, 0.0);
    }
    /// un ascensor (func_tracktrain de orientación fija) que sube al apretar un botón y se para en el piso de arriba (OnPass
    /// "ascensor,Stop"), llevando al que está parado arriba
    #[test]
    fn tren_ascensor() {
        let def = PuertaDef { cl: "func_tracktrain".into(), tren: true, nombre: "ascensor".into(), primero: "abajo".into(), vel_max: 2.0, fija: true, vol: 1.0, sentido: 1.0, ..Default::default() };
        let ini = PuertaIni { def, piv: [0.0; 3], q0: [0.0, 0.0, 0.0, 1.0], caja: None, casco: vec![], padre: String::new() };
        let cam = |n: &str, y: f32, sig: &str, sal: Vec<Salida>| CaminoBsp { n: n.into(), p: [0.0, y, 0.0], sig: sig.into(), sal, ..Default::default() };
        let parar = vec![Salida { t: "ascensor".into(), i: "stop".into(), v: String::new(), d: 0.0, n: -1 }];
        let cs = [cam("abajo", 0.0, "arriba", vec![]), cam("arriba", 3.0, "techo", parar), cam("techo", 6.0, "", vec![])];
        let b = BotonBsp { c: ([1.0; 3], [1.2; 3]), p: vec![Salida { t: "ascensor".into(), i: "startforward".into(), v: String::new(), d: 0.0, n: -1 }], ..Default::default() };
        let mut p = Puertas::nuevo(vec![ini], &[b], &[], &cs, &Io::default());
        let j = jug(); p.usar_boton(0, &j);
        let mut subio = 0.0;
        for _ in 0..300 { let m = p.trenes_paso(0.01, Some(0), &j); subio += m[1]; }
        let t = p.l[0].tren.as_ref().unwrap();
        assert!((t.pos[1] - 3.0).abs() < 1e-4 && t.vel == 0.0, "{:?}", t); assert!((subio - 3.0).abs() < 1e-3);
        assert_eq!(p.l[0].pos, t.pos);
    }
}
