//! La física rápida (con hilos y sin cuentas de más) tiene que dar lo mismo, bit por bit, que la de siempre: escenas de
//! verdad (las 500 cajas en torres con 50 NPC de la prueba de carga, muñecos de trapo tirados entre cajas, un auto que
//! choca una pila, props y el bote en el lago, una cadena con uniones, el muñeco contra la rampa, cuerpos fijos del mapa,
//! 50 props en montón) corridas con un hilo y con varios, comparando una huella de todos los cuerpos (pos, q, vel, ang,
//! los de antes, si duerme), los contactos y los golpes en cada paso. Y el tiempo de la prueba de carga, sin dibujar.
//!  - `cargo test --release -p jxjuego --test fisica_rapida -- --nocapture`: un hilo contra varios (escenas cortas)
//!  - `JXF_GUARDAR=<carpeta>`: deja las trazas (una huella por paso y el estado final con todos los bits) de todas las
//!    escenas enteras; `JXF_COMPARAR=<carpeta>`: las corre de nuevo (con un hilo y con varios) y las compara
//!    (`-- --ignored trazas`)
//!  - `-- --ignored --nocapture carga_tiempos`: detección y solver por paso a los 2, 4 y 10 s (`JXF_HILOS=n`; otra escena:
//!    `JXF_ESCENA=monton`)
//! Necesitan el paquete (JXF_WWW, si no el de la APK de prueba); sin él no hacen nada.
use jxjuego::fisica::*;
use jxjuego::flotar::{Aguas, Flota};
use jxjuego::forma::{cuerpo_de_prefab, nombres_menu, Catalogo};
use jxjuego::mundo::Mundo;
use jxjuego::npc::{self, Gente, Npcs, Skins};
use jxjuego::paquete::Paquete;
use jxjuego::personaje::Cargados;
use jxjuego::vehiculo::{Mando, Vehiculos};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;

const DT: f64 = 1.0 / 60.0;
fn www() -> PathBuf { PathBuf::from(std::env::var("JXF_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into())) }

/// lo que se carga una vez: el paquete, los dos mapas y el catálogo de formas
struct Mesa { paq: Paquete, flat: Mundo, sp: [f32; 3], cons: Mundo, cat: Catalogo, skins: Skins, ya: Cargados }
fn abrir() -> Option<Mesa> {
    let w = www(); if !w.join("pk.bin").exists() { eprintln!("sin paquete en {w:?}: no se prueba"); return None; }
    let mut paq = Paquete::abrir(&w).ok()?;
    let fl = jxjuego::mapa::armar(&mut paq, "RB_Flatgrass", 64, 750.0).ok()?;
    let co = jxjuego::mapa::armar(&mut paq, "RB_Construct", 64, 750.0).ok()?;
    paq.d["pf"]["Airboat#gm"] = jxjuego::vehiculo::bote_de(&paq, "Inflatable_boat")?;
    let sp = fl.spawns.first().map(|s| s.0).unwrap_or([0.0; 3]);
    let cat = Catalogo::nuevo(&paq);
    Some(Mesa { paq, flat: fl.mundo, sp, cons: co.mundo, cat, skins: Skins::nuevo(2, 64), ya: Cargados::default() })
}
fn gente(p: V) -> Gente { Gente { pos: p, vivo: true, esf: vec![-0.5, 0.0, 0.5], radio: 0.45, tam: 1.0, id: "yo".into() } }
fn piso(m: &Mundo, x: f64, y: f64, z: f64) -> f64 { m.rayo([x as f32, y as f32 + 50.0, z as f32], [0.0, -1.0, 0.0], 200.0).map(|g| y + 50.0 - g.t as f64).unwrap_or(y) }

/// un juego sin dibujar: la física, los vehículos, el agua y los NPC, con el paso en el orden de comun.rs
struct Juego<'a> { fis: Fisica, vehs: Vehiculos, aguas: Aguas, npcs: Option<Npcs>, jug: Gente, mundo: &'a Mundo }
impl<'a> Juego<'a> {
    fn crear(&mut self, mesa: &mut Mesa, nombre: &str, p: V, q: Q, exacto: bool) -> u32 {
        let pf = mesa.cat.prefab(&mesa.paq, nombre).unwrap_or_else(|| panic!("no hay {nombre}"));
        let id = self.fis.agregar(cuerpo_de_prefab(&pf, p, q, exacto));
        self.aguas.registrar(id, Flota::de_prefab(&pf));
        if pf.tipo == "vehiculo" { self.vehs.agregar(&mesa.paq, &pf, id, &mut self.fis, Some(&mut self.aguas)); }
        id
    }
    fn paso(&mut self, m: &Mando) {
        self.vehs.paso(&mut self.fis, self.mundo, Some(&self.aguas), DT, m);
        self.aguas.paso(&mut self.fis, DT);
        self.fis.paso(self.mundo, DT);
        self.aguas.avanzar(DT);
        if let Some(n) = &mut self.npcs { let p = self.jug.pos; n.paso(DT as f32, self.mundo, &mut self.fis, &self.jug, [p[0] as f32, p[1] as f32 + 0.7, p[2] as f32]); n.eventos(); }
    }
}

/// la huella de todo lo que sale de un paso (FNV-1a sobre los bits)
struct Fnv(u64);
impl Fnv {
    fn u(&mut self, x: u64) { for b in x.to_le_bytes() { self.0 ^= b as u64; self.0 = self.0.wrapping_mul(0x100_0000_01b3); } }
    fn v(&mut self, v: &[f64]) { for x in v { self.u(x.to_bits()); } }
}
fn huella(f: &Fisica) -> u64 {
    let mut h = Fnv(0xcbf2_9ce4_8422_2325);
    h.u(f.cuerpos.len() as u64);
    for c in &f.cuerpos {
        h.u(c.id as u64); h.v(&c.pos); h.v(&c.q); h.v(&c.vel); h.v(&c.ang); h.v(&c.prev_pos); h.v(&c.prev_q);
        h.v(&[c.sleep_t, c.spec, c.ult_golpe]); h.u(c.duerme as u64 | (c.calmo as u64) << 1 | (c.muerto as u64) << 2 | (c.congelado as u64) << 3);
    }
    h.u(f.contactos.len() as u64);
    for c in &f.contactos {
        h.u(c.a as u64); h.u(c.b.map_or(u64::MAX, |b| b as u64)); h.v(&c.ra); h.v(&c.rb); h.v(&c.wb.unwrap_or([f64::NAN; 3])); h.v(&c.n);
        h.v(&[c.depth, c.lam, c.vn_pre]); h.u(c.activo as u64 | (c.hit as u64) << 1);
    }
    h.u(f.golpes.len() as u64);
    for g in &f.golpes { h.u(g.cuerpo as u64); h.u(g.otro.map_or(u64::MAX, |b| b as u64)); h.v(&[g.v]); h.v(&g.p); h.v(&g.n); }
    h.0
}
/// el estado final de todos los cuerpos con todos los bits
fn estado(f: &Fisica) -> String {
    let b = |v: &[f64]| v.iter().map(|x| format!("{:016x}", x.to_bits())).collect::<Vec<_>>().join(" ");
    f.cuerpos.iter().map(|c| format!("cuerpo {} {} {} {} {} duerme {}\n", c.id, b(&c.pos), b(&c.q), b(&c.vel), b(&c.ang), c.duerme)).collect()
}

/// las escenas: cada una arma su juego, lo corre `pasos` pasos y llama a `cada` después de cada uno
const ESCENAS: [&str; 9] = ["carga", "munecos", "auto", "agua", "monton", "cadena", "rampa", "fijos", "pila"];
fn correr(mesa: &mut Mesa, nombre: &str, pasos: usize, cfg: &dyn Fn(&mut Fisica), cada: &mut dyn FnMut(usize, &Fisica)) {
    let rapida = |n: &str| npc::Actitud::rapida(n, None);
    match nombre {
        // la prueba de carga de foto.rs: 500 cajas en 10 torres de 50 y 50 NPC, con 10 subpasos (Ultra)
        "carga" | "munecos" => {
            let flat = std::mem::replace(&mut mesa.flat, Mundo::nuevo(vec![], vec![], 1.0));
            {
                let sp = mesa.sp; let y0 = piso(&flat, sp[0] as f64, sp[1] as f64, sp[2] as f64);
                let p0 = [sp[0] as f64, y0 + 0.95, sp[2] as f64];
                let mut j = Juego { fis: Fisica::nueva(), vehs: Vehiculos::nuevo(), aguas: Aguas::de_mapa(&mesa.paq, "RB_Flatgrass"), npcs: Some(Npcs::nuevo(&mesa.paq.d, 0x5eed)), jug: gente(p0), mundo: &flat };
                j.fis.sub = 10; cfg(&mut j.fis);
                let caja = nombres_menu(&mesa.paq, "Props").into_iter().find(|n| n.to_lowercase().contains("crate")).expect("una caja");
                let (n_cajas, alto) = if nombre == "carga" { (500, 50) } else { (60, 6) };
                for k in 0..n_cajas { let (c, f) = (k % 10, k / 10); let p = [p0[0] + (c % 5) as f64 * 2.5 - 5.0, p0[1] + 0.5 + f as f64 * 0.9, p0[2] + 8.0 + (c / 5) as f64 * 2.5]; let _ = alto; j.crear(mesa, &caja, p, QID, true); }
                let mut ids = vec![];
                { let n = j.npcs.as_mut().unwrap(); n.max = 60; }
                let cuantos = if nombre == "carga" { 50 } else { 14 };
                for k in 0..cuantos {
                    let (c, _) = mesa.skins.pedir(&mut mesa.paq, "Hero", &mut mesa.ya).unwrap();
                    let a = k as f64 * 0.7;
                    let (o, fw) = ([p0[0] + a.cos() * 3.0, p0[1] + 0.72, p0[2] - 6.0 + a.sin() * 3.0], [a.cos(), -0.3, a.sin()]);
                    let (p, yaw) = npc::donde_poner(&flat, &mut j.fis, [o[0] as f32, o[1] as f32, o[2] as f32], [fw[0] as f32, fw[1] as f32, fw[2] as f32]);
                    let act = if nombre == "carga" { None } else { [rapida("agresivo"), rapida("paseo"), None][k % 3].clone() };
                    if let Some(id) = j.npcs.as_mut().unwrap().crear(c, p, yaw, act, &mut j.fis) { ids.push(id); }
                }
                for i in 0..pasos {
                    // (los muñecos: tirados de una patada, después algunos muertos a los tiros y otra patada a los demás)
                    if nombre == "munecos" {
                        let n = j.npcs.as_mut().unwrap();
                        if i == 20 { for (k, id) in ids.iter().enumerate() { let a = k as f32 * 0.9; n.tumbar(*id, [a.cos() * 6.0, 3.0, 8.0 + a.sin() * 6.0], &mut j.fis); } }
                        if i == 150 { for id in ids.iter().step_by(3) { n.danar(*id, 150.0, [p0[0] as f32, p0[1] as f32, p0[2] as f32], [0.0, 0.0, 1.0], &mut j.fis, None); } }
                        if i == 330 { for (k, id) in ids.iter().enumerate() { n.tumbar(*id, [0.0, 5.0, if k % 2 == 0 { 9.0 } else { -9.0 }], &mut j.fis); } }
                    }
                    j.paso(&Mando::default()); cada(i + 1, &j.fis);
                }
            }
            mesa.flat = flat;
        }
        // el auto acelera, choca una pila de cajas y dobla; otros estacionados (RB_Construct)
        "auto" | "agua" => {
            let cons = std::mem::replace(&mut mesa.cons, Mundo::nuevo(vec![], vec![], 1.0));
            {
                let mut j = Juego { fis: Fisica::nueva(), vehs: Vehiculos::nuevo(), aguas: Aguas::de_mapa(&mesa.paq, "RB_Construct"), npcs: None, jug: gente([0.0; 3]), mundo: &cons };
                cfg(&mut j.fis);
                let tramos: Vec<(usize, Mando)>;
                if nombre == "auto" {
                    let id = j.crear(mesa, "Sedan", [28.0, -3.7, -70.0], QID, false);
                    for (k, n) in ["Derby5", "Moto", "Wheelchair", "police_car_v4"].iter().enumerate() { j.crear(mesa, n, [-12.0 + k as f64 * 7.0, -3.7, -60.0], qeje([0.0, 1.0, 0.0], k as f64 * 0.4), false); }
                    for k in 0..24 { j.crear(mesa, ["Crate", "Box1", "Barril", "Box2"][k % 4], [27.0 + (k % 3) as f64 * 1.1, -3.2 + (k / 3) as f64 * 1.0, -44.0], QID, false); }
                    assert!(j.vehs.subir(&j.fis, id));
                    tramos = vec![(30, Mando::default()), (150, Mando { y: 1.0, ..Mando::default() }), (240, Mando { x: 0.6, y: 1.0, ..Mando::default() }), (330, Mando { freno: true, ..Mando::default() }),
                        (480, Mando { y: -1.0, ..Mando::default() }), (600, Mando { x: -0.6, y: -1.0, ..Mando::default() })];
                } else {
                    let id = j.crear(mesa, "Airboat", [96.0, -4.064, -54.0], QID, false);
                    for (k, n) in ["Crate", "Barril", "Box1", "Sofa", "Tire", "Fireext", "Oxygen_tank", "TableRound"].iter().enumerate() { j.crear(mesa, n, [70.0 + k as f64 * 4.0, -2.0, -50.0], qeje([0.2, 1.0, 0.1], k as f64 * 0.5), false); }
                    for k in 0..30 { j.crear(mesa, ["Crate", "Box1", "Barril"][k % 3], [100.0 + (k % 5) as f64 * 1.5, -2.0 + (k / 5) as f64 * 1.2, -30.0 + (k % 2) as f64 * 0.3], qeje([1.0, 0.0, 0.3], k as f64 * 0.3), false); }
                    assert!(j.vehs.subir(&j.fis, id));
                    tramos = vec![(60, Mando::default()), (210, Mando { y: 1.0, ..Mando::default() }), (300, Mando { x: -0.6, y: 1.0, ..Mando::default() }), (360, Mando { freno: true, ..Mando::default() }),
                        (540, Mando { y: -1.0, ..Mando::default() }), (600, Mando::default())];
                }
                for i in 0..pasos { let m = &tramos.iter().find(|t| i < t.0).unwrap_or(tramos.last().unwrap()).1; j.paso(m); cada(i + 1, &j.fis); }
            }
            mesa.cons = cons;
        }
        // 50 props del menú en montón (compuestos, cápsulas, cascos de todo tipo) en RB_Flatgrass
        "monton" => {
            let flat = std::mem::replace(&mut mesa.flat, Mundo::nuevo(vec![], vec![], 1.0));
            {
                let sp = mesa.sp; let sp = [sp[0] as f64, sp[1] as f64, sp[2] as f64];
                let mut f = Fisica::nueva(); cfg(&mut f);
                let validos: Vec<String> = nombres_menu(&mesa.paq, "Props").into_iter().filter(|n| mesa.cat.prefab(&mesa.paq, n).map_or(false, |p| !p.congelado && !p.sin_fisica)).collect();
                for i in 0..50 {
                    let pf = mesa.cat.prefab(&mesa.paq, &validos[(i * 7) % validos.len()]).unwrap();
                    let (cx, cz, alto) = ((i % 5) as f64 * 1.2, ((i / 5) % 5) as f64 * 1.2, (i / 25) as f64 * 2.5);
                    f.agregar(cuerpo_de_prefab(&pf, [sp[0] + cx, sp[1] + 1.0 + alto, sp[2] + 30.0 + cz], qeje([0.2, 1.0, 0.3], i as f64 * 0.7), false));
                }
                for i in 0..pasos { f.paso(&flat, DT); cada(i + 1, &f); }
            }
            mesa.flat = flat;
        }
        // las de tests/fisica.rs: una cadena con uniones (esférica y bisagra), el muñeco que no cruza la rampa, los cuerpos
        // fijos del mapa y una pila de cajas que se cae cuando se saca la de abajo
        "cadena" | "rampa" | "fijos" | "pila" => {
            let cuadro = |a: V, b: V, c: V, d: V| -> Vec<f32> { [a, b, c, a, c, d].iter().flat_map(|p| p.iter().map(|x| *x as f32)).collect() };
            let con = |forma: Forma, masa: f64, pos: V, q: Q, grupo: u32| { let mut c = Cuerpo::nuevo(Arc::new(forma), masa, OpCuerpo { grupo, ..OpCuerpo::default() }); c.pos = pos; c.q = q; c };
            let l = 20.0; let mut f = Fisica::nueva(); cfg(&mut f);
            let th = 20f64.to_radians(); let h = |x: f64| -th.tan() * x;
            let mundo = match nombre {
                "rampa" => Mundo::nuevo(cuadro([-10.0, h(-10.0), -10.0], [-10.0, h(-10.0), 10.0], [40.0, h(40.0), 10.0], [40.0, h(40.0), -10.0]), vec![], 1.0),
                "fijos" => {
                    use jxjuego::mundo::{aabb_de, Cuerpo as CuerpoMundo, Forma as FormaMundo};
                    let f32v = |v: V| [v[0] as f32, v[1] as f32, v[2] as f32]; let q = qeje([0.0, 0.0, 1.0], 0.25);
                    let formas = vec![FormaMundo::Caja { c: [2.0, 1.0, 0.0], e: [f32v(rot(q, [1.0, 0.0, 0.0])), f32v(rot(q, [0.0, 1.0, 0.0])), f32v(rot(q, [0.0, 0.0, 1.0]))], h: [1.5, 0.2, 1.5] },
                        FormaMundo::Esfera { c: [-3.0, 0.5, 0.0], r: 0.8 }, FormaMundo::Capsula { a: [1.0, 0.3, 4.0], b: [-1.0, 0.3, 4.0], r: 0.3 }];
                    Mundo::nuevo(cuadro([-l, 0.0, -l], [-l, 0.0, l], [l, 0.0, l], [l, 0.0, -l]), formas.into_iter().map(|f| CuerpoMundo { aabb: aabb_de(&f), f }).collect(), 1.0)
                }
                _ => Mundo::nuevo(cuadro([-l, 0.0, -l], [-l, 0.0, l], [l, 0.0, l], [l, 0.0, -l]), vec![], 1.0),
            };
            let mut quitar = None;
            match nombre {
                "cadena" => {
                    let anc = f.agregar(con(forma_caja(0.2, 0.2, 0.2), 0.0, [0.0, 5.0, 0.0], QID, 1));
                    let b1 = f.agregar(con(forma_caja(0.1, 0.5, 0.1), 2.0, [0.6, 5.0, 0.0], qeje([0.0, 0.0, 1.0], std::f64::consts::FRAC_PI_2), 1));
                    f.unir(anc, b1, [0.1, 5.0, 0.0], [1.0, 0.0, 0.0], OpUnion { swing: 0.6, twist: 0.3, ..OpUnion::default() }).unwrap();
                    let b2 = f.agregar(con(forma_capsula(0.1, 0.4), 1.5, [1.7, 5.0, 0.05], qeje([0.0, 0.0, 1.0], std::f64::consts::FRAC_PI_2), 1));
                    f.unir(b1, b2, [1.15, 5.0, 0.02], [1.0, 0.0, 0.0], OpUnion { bisagra: true, eje_bisagra: Some([0.0, 0.0, 1.0]), lo: -1.2, hi: 0.3, ..OpUnion::default() }).unwrap();
                    // (y otra cadena de 6 eslabones colgada, con cajas que le caen encima)
                    let mut ant = f.agregar(con(forma_caja(0.2, 0.2, 0.2), 0.0, [-4.0, 6.0, 0.0], QID, 2));
                    for k in 0..6 { let b = f.agregar(con(forma_capsula(0.08, 0.25), 1.0, [-4.0 + 0.5 * (k + 1) as f64, 6.0, 0.0], qeje([0.0, 0.0, 1.0], std::f64::consts::FRAC_PI_2), 2));
                        f.unir(ant, b, [-4.0 + 0.5 * k as f64 + 0.2, 6.0, 0.0], [1.0, 0.0, 0.0], OpUnion { swing: 0.9, twist: 0.4, ..OpUnion::default() }).unwrap(); ant = b; }
                    for k in 0..6 { f.agregar(con(forma_caja(0.2, 0.2, 0.2), 3.0, [-3.5 + 0.4 * k as f64, 8.0 + k as f64 * 0.5, 0.05 * k as f64], QID, 0)); }
                }
                "rampa" => {
                    let c1 = f.agregar(con(forma_capsula(0.15, 0.3), 3.0, [0.0, 2.0, 0.0], QID, 7));
                    let c2 = f.agregar(con(forma_esfera(0.2), 2.0, [0.0, 2.8, 0.1], QID, 7));
                    let c3 = f.agregar(con(forma_caja(0.2, 0.1, 0.3), 2.0, [0.1, 1.3, 0.0], QID, 7));
                    f.unir(c1, c2, [0.0, 2.5, 0.05], [0.0, 1.0, 0.0], OpUnion { swing: 0.9, twist: 0.5, ..OpUnion::default() });
                    f.unir(c1, c3, [0.05, 1.5, 0.0], [0.0, -1.0, 0.0], OpUnion { swing: 0.5, twist: 0.2, ..OpUnion::default() });
                    for id in [c1, c2, c3] { let c = f.cuerpo_mut(id).unwrap(); c.no_cruza = true; c.vel = [3.0, -25.0, 1.0]; c.ang = [2.0, 0.0, 5.0]; }
                    for k in 0..8 { f.agregar(con(if k % 2 == 0 { forma_esfera(0.3) } else { forma_caja(0.3, 0.2, 0.25) }, 2.0, [1.0 + k as f64 * 0.7, 3.0, -1.0 + (k % 3) as f64], qeje([0.3, 1.0, 0.0], k as f64), 0)); }
                }
                "fijos" => {
                    f.agregar(con(forma_caja(0.3, 0.3, 0.3), 5.0, [2.2, 3.0, 0.1], QID, 0));
                    f.agregar(con(forma_esfera(0.3), 2.0, [-2.9, 3.0, 0.05], QID, 0));
                    f.agregar(con(forma_compuesta(vec![
                        Parte { forma: forma_caja(0.4, 0.1, 0.4), p: [0.0, -0.2, 0.0], q: QID },
                        Parte { forma: forma_esfera(0.25), p: [0.2, 0.2, 0.0], q: QID },
                        Parte { forma: forma_capsula(0.1, 0.3), p: [-0.2, 0.1, 0.0], q: qeje([1.0, 0.0, 0.0], 1.2) },
                    ]), 4.0, [0.1, 3.0, 4.05], QID, 0));
                    for k in 0..10 { f.agregar(con(forma_capsula(0.12, 0.2), 1.0, [-1.0 + (k % 5) as f64 * 0.6, 5.0 + (k / 5) as f64, 3.8], qeje([1.0, 0.0, 0.0], 1.0 + k as f64 * 0.3), 0)); }
                }
                _ => {
                    let ids: Vec<u32> = (0..12).map(|i| f.agregar(con(forma_caja(0.5, 0.5, 0.5), 10.0, [0.02 * (i % 4) as f64 + (i / 4) as f64 * 3.0, 0.5 + 1.005 * (i % 4) as f64, -0.01 * i as f64], QID, 0))).collect();
                    quitar = Some(ids[4]);
                }
            }
            for i in 0..pasos {
                if i == 360 { if let Some(id) = quitar { f.quitar(id); } }
                f.paso(&mundo, DT); cada(i + 1, &f);
            }
        }
        _ => panic!("no hay escena {nombre}"),
    }
}
fn pasos_de(n: &str) -> usize { match n { "carga" | "munecos" | "auto" | "agua" | "monton" | "pila" => 600, _ => 300 } }

/// la traza de una escena: la huella de cada paso y el estado final
fn traza(mesa: &mut Mesa, n: &str, pasos: usize, cfg: &dyn Fn(&mut Fisica)) -> (Vec<u64>, String) {
    let mut hs = vec![]; let mut fin = String::new();
    correr(mesa, n, pasos, cfg, &mut |i, f| { hs.push(huella(f)); if i == pasos { fin = estado(f); } });
    (hs, fin)
}
fn texto(hs: &[u64], fin: &str) -> String { hs.iter().enumerate().map(|(i, h)| format!("paso {} {:016x}\n", i + 1, h)).collect::<String>() + fin }

/// las trazas: JXF_GUARDAR deja las de la física como está; JXF_COMPARAR las compara con un hilo y con varios
#[test]
#[ignore]
fn trazas() {
    let Some(mut mesa) = abrir() else { return };
    let solo: Option<Vec<String>> = std::env::var("JXF_ESCENAS").ok().map(|s| s.split(',').map(|x| x.to_string()).collect());
    let escenas: Vec<&str> = ESCENAS.iter().copied().filter(|n| solo.as_ref().map_or(true, |s| s.iter().any(|x| x == n))).collect();
    if let Ok(d) = std::env::var("JXF_GUARDAR") {
        std::fs::create_dir_all(&d).unwrap();
        for n in &escenas {
            let t = Instant::now(); let (hs, fin) = traza(&mut mesa, n, pasos_de(n), &|_| {});
            std::fs::write(Path::new(&d).join(format!("{n}.txt")), texto(&hs, &fin)).unwrap();
            println!("{n}: {} pasos guardados ({:.1} s)", hs.len(), t.elapsed().as_secs_f64());
        }
    }
    if let Ok(d) = std::env::var("JXF_COMPARAR") {
        let mut mal = vec![];
        for n in &escenas {
            let Ok(ref_) = std::fs::read_to_string(Path::new(&d).join(format!("{n}.txt"))) else { println!("{n}: sin traza guardada"); continue };
            for (nom, cfg) in variantes() {
                let t = Instant::now(); let (hs, fin) = traza(&mut mesa, n, pasos_de(n), &*cfg);
                let s = texto(&hs, &fin);
                let primero = s.lines().zip(ref_.lines()).position(|(a, b)| a != b);
                let ok = s == ref_;
                println!("{n} [{nom}]: {} ({} pasos, {} cuerpos al final, {:.1} s){}", if ok { "IGUAL bit por bit" } else { "DISTINTO" }, hs.len(), fin.lines().count(), t.elapsed().as_secs_f64(),
                    primero.map_or(String::new(), |k| format!(" — primera diferencia en la línea {}", k + 1)));
                if !ok { mal.push(format!("{n} [{nom}]")); }
            }
        }
        assert!(mal.is_empty(), "distintas: {mal:?}");
    }
}

/// las formas de correr la física que tienen que dar lo mismo: un hilo, varios (siempre en paralelo, hasta con escenas
/// chicas) y lo de siempre
fn variantes() -> Vec<(&'static str, Box<dyn Fn(&mut Fisica)>)> {
    vec![("1 hilo", Box::new(|f: &mut Fisica| { f.hilos = 1; })), ("4 hilos siempre", Box::new(|f: &mut Fisica| { f.hilos = 4; f.min_paralelo = 0; })),
        ("3 hilos siempre", Box::new(|f: &mut Fisica| { f.hilos = 3; f.min_paralelo = 0; })), ("como viene", Box::new(|_: &mut Fisica| {}))]
}

/// un hilo contra varios en todas las escenas (más cortas): todo igual, bit por bit, en cada paso
#[test]
fn hilos_igual_que_uno() {
    let Some(mut mesa) = abrir() else { return };
    for n in ESCENAS {
        let pasos = if n == "carga" { 240 } else { pasos_de(n).min(400) };
        let vs = variantes(); let (r1, f1) = traza(&mut mesa, n, pasos, &*vs[0].1);
        for (nom, cfg) in &vs[1..3] {
            let (r, f) = traza(&mut mesa, n, pasos, &**cfg);
            let k = r.iter().zip(&r1).position(|(a, b)| a != b);
            println!("{n}: [{nom}] {}", k.map_or("igual en todos los pasos".to_string(), |k| format!("DISTINTO desde el paso {}", k + 1)));
            assert!(k.is_none() && f == f1, "{n} [{nom}]: distinto desde el paso {:?}", k.map(|k| k + 1));
        }
    }
}

/// lo que tarda la prueba de carga (500 cajas en torres y 50 NPC, Ultra: 10 subpasos), sin dibujar: detección y solver
/// por paso a los 2, 4 y 10 s, y lo peor y el promedio de cada tramo
#[test]
#[ignore]
fn carga_tiempos() {
    let Some(mut mesa) = abrir() else { return };
    let hilos: Option<usize> = std::env::var("JXF_HILOS").ok().and_then(|s| s.parse().ok());
    let pasos: usize = std::env::var("JXF_PASOS").ok().and_then(|s| s.parse().ok()).unwrap_or(600);
    let escena = std::env::var("JXF_ESCENA").unwrap_or("carga".into());
    let cfg = move |f: &mut Fisica| { if let Some(h) = hilos { set_hilos(f, h); } };
    let (mut det, mut sol, mut dorm, mut fases) = (vec![], vec![], vec![], vec![]);
    let t = Instant::now();
    correr(&mut mesa, &escena, pasos, &cfg, &mut |i, f| {
        det.push(f.ms_det); sol.push(f.ms_sol); dorm.push(f.cuerpos.iter().filter(|b| b.duerme).count()); fases.push(f.ms_fases);
        if i == 121 || i == 240 || i == 600 { println!("  paso {i}: detección {:.2} ms · solver {:.2} ms · {} dormidos de {} · contactos {}", f.ms_det, f.ms_sol, dorm[i - 1], f.cuerpos.len(), f.contactos.len()); }
    });
    println!("{escena} ({:.1} s en total):", t.elapsed().as_secs_f64());
    for (a, b) in [(0, 60), (60, 120), (120, 240), (240, 360), (360, 600)] {
        if b > det.len() { break; }
        let p = |v: &[f64]| v.iter().sum::<f64>() / v.len() as f64; let m = |v: &[f64]| v.iter().cloned().fold(0.0, f64::max);
        let tot: Vec<f64> = (a..b).map(|i| det[i] + sol[i]).collect();
        println!("  {:>4.1}–{:>4.1} s: detección prom {:.2} máx {:.2} · solver prom {:.2} máx {:.2} · total prom {:.2} máx {:.2} ms · dormidos {}",
            a as f64 / 60.0, b as f64 / 60.0, p(&det[a..b]), m(&det[a..b]), p(&sol[a..b]), m(&sol[a..b]), p(&tot), m(&tot), dorm[b - 1]);
        let pf: Vec<String> = (0..6).map(|k| format!("{:.2}", fases[a..b].iter().map(|f| f[k]).sum::<f64>() / (b - a) as f64)).collect();
        println!("      por partes (mapa, paresCerca, choques, juntar, armar solver, subpasos): {}", pf.join(" · "));
    }
}
fn set_hilos(f: &mut Fisica, h: usize) { f.hilos = h; }
