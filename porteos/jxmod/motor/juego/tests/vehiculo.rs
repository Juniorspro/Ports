//! Pruebas de los vehículos (vehiculo.rs) y de lo que flota (flotar.rs), en RB_Construct (el piso de hormigón y el lago):
//! cada vehículo del menú se arma bien (tipo, ruedas con su dibujo, asientos), el auto acelera, dobla para el lado
//! pedido, frena y va marcha atrás sin volcar ni hundir las ruedas en el piso; el bote (el Airboat: el bote inflable con
//! `bote`, como arma la web los de los addons) flota y se maneja en el agua; los props flotan o se hunden según su
//! densidad; subir, bajar y la cámara. Y la traza para comparar con la web en node (`traza_para_comparar_con_js`).
use jxjuego::fisica::*;
use jxjuego::flotar::{Aguas, Flota};
use jxjuego::forma::{cuerpo_de_prefab, nombres_menu, Catalogo};
use jxjuego::mundo::Mundo;
use jxjuego::paquete::Paquete;
use jxjuego::vehiculo::{Evento, Mando, Tipo, Usar, Vehiculos};
use serde_json::{json, Value};
use std::path::Path;
use std::time::Instant;

const WWW: &str = "/tmp/claude-0/jxp_apk/activos/www";
const DT: f64 = 1.0 / 60.0;

/// el Airboat de HL2 no está en el paquete (sale de los addons de GMod: gmvehPrefab lo arma con `bote` y cuatro apoyos sin
/// dibujo en las puntas de abajo del casco); acá, igual que lo arma la web, sobre el casco del bote inflable
pub fn airboat(paq: &Paquete) -> Value { jxjuego::vehiculo::bote_de(paq, "Inflatable_boat").expect("el bote inflable") }

struct Mesa { paq: Paquete, mundo: Mundo, cat: Catalogo }
fn abrir() -> Option<Mesa> {
    if !Path::new(WWW).join("pk.bin").exists() { eprintln!("sin paquete en {WWW}: no se prueba"); return None; }
    let mut paq = Paquete::abrir(Path::new(WWW)).unwrap();
    let mapa = jxjuego::mapa::armar(&mut paq, "RB_Construct", 64, 750.0).unwrap();
    paq.d["pf"]["Airboat#gm"] = airboat(&paq);
    let cat = Catalogo::nuevo(&paq);
    Some(Mesa { paq, mundo: mapa.mundo, cat })
}
/// lo de un mapa con su física, sus vehículos y su agua
struct Juego { fis: Fisica, vehs: Vehiculos, aguas: Aguas }
impl Mesa {
    fn juego(&self) -> Juego { Juego { fis: Fisica::nueva(), vehs: Vehiculos::nuevo(), aguas: Aguas::de_mapa(&self.paq, "RB_Construct") } }
    /// crearObjeto: el cuerpo del prefab con su base en `p`, girado q; si es un vehículo, vehiculoNuevo
    fn crear(&mut self, j: &mut Juego, nombre: &str, p: V, q: Q) -> u32 {
        let pf = self.cat.prefab(&self.paq, nombre).unwrap_or_else(|| panic!("no hay {nombre}"));
        let id = j.fis.agregar(cuerpo_de_prefab(&pf, p, q, false));
        j.aguas.registrar(id, Flota::de_prefab(&pf));
        j.vehs.agregar(&self.paq, &pf, id, &mut j.fis, Some(&mut j.aguas));
        id
    }
}
impl Juego {
    /// un paso como el de la web: los vehículos, el agua, la física (y el reloj de las olas)
    fn paso(&mut self, mundo: &Mundo, m: &Mando) {
        self.vehs.paso(&mut self.fis, mundo, Some(&self.aguas), DT, m);
        self.aguas.paso(&mut self.fis, DT);
        self.fis.paso(mundo, DT);
        self.aguas.avanzar(DT);
    }
}
/// cuánto se hunde (+) o flota (−) cada rueda dibujada (el fondo de su malla: el centro dibujado menos su radio) respecto
/// del piso debajo
fn ruedas_dibujadas(mundo: &Mundo, b: &Cuerpo, v: &jxjuego::vehiculo::Vehiculo) -> Vec<Option<f64>> {
    (0..v.ruedas.len()).map(|k| {
        let p = add(b.pos, rot(b.q, v.centro_rueda(k)?)); let o = [p[0] as f32, p[1] as f32 + 1.0, p[2] as f32];
        mundo.rayo(o, [0.0, -1.0, 0.0], 3.0).map(|g| (o[1] - g.t) as f64 - (p[1] - v.ruedas[k].r_vis))
    }).collect()
}
fn yaw(q: Q) -> f64 { let f = rot(q, [0.0, 0.0, 1.0]); f[0].atan2(f[2]) }
fn sin_nan(c: &Cuerpo) -> bool { c.pos.iter().chain(c.q.iter()).chain(c.vel.iter()).chain(c.ang.iter()).all(|x| x.is_finite()) }

// ---------------- las escenas (las mismas en la traza para la web) ----------------
/// un tramo de mando: hasta qué paso, la palanca (x, y), freno, agachar, turbo
type Tramo = (usize, f64, f64, bool, bool, bool);
struct Escena { n: &'static str, objs: Vec<(&'static str, V, f64)>, maneja: Option<usize>, pasos: usize, tramos: Vec<Tramo> }
fn escenas() -> Vec<Escena> {
    let piso = -3.7;
    vec![
        // el auto (en el hormigón abierto: x de −20 a 32, z de −72 a 8): acelera 2 s, dobla a la derecha 1,5 s, frena 1,5 s,
        // marcha atrás 2,5 s, atrás doblando 1,5 s, suelta 1 s
        Escena { n: "auto", objs: vec![("Sedan", [28.0, piso, -70.0], 0.0)], maneja: Some(0), pasos: 660,
            tramos: vec![(30, 0.0, 0.0, false, false, false), (150, 0.0, 1.0, false, false, false), (240, 0.6, 1.0, false, false, false), (330, 0.0, 0.0, true, false, false),
                (480, 0.0, -1.0, false, false, false), (570, -0.6, -1.0, false, false, false), (660, 0.0, 0.0, false, false, false)] },
        // la moto: acelera, dobla, frena
        Escena { n: "moto", objs: vec![("Moto", [-4.0, piso, -66.0], 0.0)], maneja: Some(0), pasos: 480,
            tramos: vec![(30, 0.0, 0.0, false, false, false), (180, 0.0, 1.0, false, false, false), (300, -0.4, 0.8, false, false, false), (420, 0.0, 0.0, true, false, false), (480, 0.0, 0.0, false, false, false)] },
        // el helicóptero: prende el motor, sube, avanza y gira
        Escena { n: "heli", objs: vec![("CityCopter", [4.0, piso, -20.0], 0.5)], maneja: Some(0), pasos: 480,
            tramos: vec![(120, 0.0, 0.0, false, false, false), (240, 0.0, 0.0, true, false, false), (360, 0.3, 0.6, false, false, false), (480, 0.0, 0.0, false, true, false)] },
        // el bote en lo hondo del lago: se asienta, acelera 3 s, dobla a la izquierda 1,5 s, frena 1 s, marcha atrás 3 s
        // (lo hondo: x de 92 a 112 y z de −56 a 0; hay un bajo en x 80-88, z −24..−16 y la costa este en x 120)
        Escena { n: "bote", objs: vec![("Airboat", [96.0, -4.064, -54.0], 0.0)], maneja: Some(0), pasos: 660,
            tramos: vec![(60, 0.0, 0.0, false, false, false), (210, 0.0, 1.0, false, false, false), (300, -0.6, 1.0, false, false, false), (360, 0.0, 0.0, true, false, false),
                (540, 0.0, -1.0, false, false, false), (660, 0.0, 0.0, false, false, false)] },
        // el avión: acelera (saltar) en la pista y tira para arriba
        Escena { n: "avion", objs: vec![("Aircraft", [10.0, piso, -66.0], 0.0)], maneja: Some(0), pasos: 240,
            tramos: vec![(180, 0.0, 0.0, true, false, false), (240, 0.0, 0.6, true, false, false)] },
        // la bici con cohete: pedalea 1 s, cohete 1,5 s, suelta
        Escena { n: "bici", objs: vec![("BiciCohete", [0.0, piso, -66.0], 0.0)], maneja: Some(0), pasos: 240,
            tramos: vec![(60, 0.0, 1.0, false, false, false), (150, 0.0, 1.0, false, false, true), (240, 0.0, 0.0, false, false, false)] },
        // la moto contra la pared del edificio (x −32): choque de frente, el piloto sale despedido
        Escena { n: "choque", objs: vec![("Moto", [-8.0, piso, 22.0], -std::f64::consts::FRAC_PI_2)], maneja: Some(0), pasos: 240,
            tramos: vec![(240, 0.0, 1.0, false, false, false)] },
        // estacionados, sin nadie: el auto, la moto, la silla de ruedas, el helicóptero y el avión (la física sola y la
        // suspensión)
        Escena { n: "quietos", objs: vec![("Sedan", [-10.0, piso, -60.0], 0.2), ("Moto", [-4.0, piso, -60.0], 0.0), ("Wheelchair", [0.0, piso, -60.0], 0.0),
                ("CityCopter", [8.0, piso, -60.0], 0.5), ("Aircraft", [20.0, piso, -60.0], 0.0), ("Derby5", [-10.0, piso, -50.0], 3.0)],
            maneja: None, pasos: 300, tramos: vec![(300, 0.0, 0.0, false, false, false)] },
        // props que caen al lago: los de madera flotan, los pesados se hunden
        Escena { n: "props", objs: vec![("Crate", [70.0, -2.0, -50.0], 0.0), ("Barril", [74.0, -2.0, -50.0], 0.4), ("Box1", [78.0, -2.5, -50.0], 0.0), ("Sofa", [83.0, -2.0, -50.0], 1.0),
                ("Tire", [88.0, -2.5, -50.0], 0.0), ("Fireext", [92.0, -2.5, -50.0], 0.0), ("Oxygen_tank", [96.0, -2.5, -50.0], 0.0), ("TableRound", [101.0, -2.0, -50.0], 0.2)],
            maneja: None, pasos: 600, tramos: vec![(600, 0.0, 0.0, false, false, false)] },
    ]
}
fn escena(n: &str) -> Escena { escenas().into_iter().find(|e| e.n == n).unwrap() }
fn mando_en(e: &Escena, i: usize) -> Mando {
    let t = e.tramos.iter().find(|t| i < t.0).unwrap_or(e.tramos.last().unwrap());
    Mando { x: t.1, y: t.2, freno: t.3, agachar: t.4, turbo: t.5 }
}
/// corre una escena; `cada` llama con el paso, los ids y la física
fn correr(mesa: &mut Mesa, e: &Escena, mut cada: impl FnMut(usize, &Juego, &[u32])) -> (Juego, Vec<u32>) {
    let mut j = mesa.juego();
    let ids: Vec<u32> = e.objs.iter().map(|(n, p, a)| mesa.crear(&mut j, n, *p, qeje([0.0, 1.0, 0.0], *a))).collect();
    if let Some(k) = e.maneja { assert!(j.vehs.subir(&j.fis, ids[k])); }
    cada(0, &j, &ids);
    for i in 0..e.pasos { let m = mando_en(e, i); j.paso(&mesa.mundo, &m); cada(i + 1, &j, &ids); }
    (j, ids)
}

// ---------------- las pruebas ----------------
/// todos los del menú «Vehicles» se arman: qué son, sus ruedas (cada una con su dibujo), sus asientos, rotores y toberas
#[test]
fn vehiculos_del_menu() {
    let Some(mut mesa) = abrir() else { return };
    let mut j = mesa.juego();
    let lista = nombres_menu(&mesa.paq, "Vehicles");
    assert!(lista.len() >= 20, "{lista:?}");
    for (k, n) in lista.iter().enumerate() {
        let id = mesa.crear(&mut j, n, [(k as f64) * 12.0 - 100.0, -3.7, -100.0], QID);
        let v = j.vehs.de(id).unwrap_or_else(|| panic!("{n}: no es vehículo"));
        let dib = v.ruedas.iter().filter(|w| w.vis.is_some()).count();
        println!("{n:<18} {:<8} ruedas {} (con dibujo {dib}) asientos {} rotores {} toberas {} bocina {:?} esc {:?}", v.tipo.nombre(), v.ruedas.len(), v.asientos.len(), v.rotores.len(), v.jets.len(), v.bocina_tipo(),
            v.ruedas.iter().map(|w| (w.esc * 100.0).round() / 100.0).collect::<Vec<_>>());
        match n.as_str() {
            "Luggage" => { assert_eq!(v.tipo, Tipo::Auto); assert_eq!(v.ruedas.len(), 3); assert_eq!(dib, 3); }
            "Sedan" | "Derby5" | "Derby6" | "Derby7" | "Sofie" | "police_car_v4" | "police_car_v5" | "police_car_v6" | "police_car_v7" | "Wheelchair" => {
                assert_eq!(v.tipo, Tipo::Auto); assert_eq!(v.ruedas.len(), 4, "{n}"); assert_eq!(dib, 4, "{n}: ruedas sin dibujo");
                assert_eq!(v.ruedas.iter().filter(|w| w.del).count(), 2, "{n}: dos de adelante");
                // (el conductor entre los ejes)
                let (zf, zr) = (v.ruedas.iter().map(|w| w.p[2]).fold(-1e9, f64::max), v.ruedas.iter().map(|w| w.p[2]).fold(1e9, f64::min));
                assert!(v.asientos[0][2] < zf && v.asientos[0][2] > zr, "{n}: el conductor afuera");
            }
            "Moto" | "BiciCohete" => { assert_eq!(v.tipo, Tipo::Moto); assert_eq!(v.ruedas.len(), 2); }
            "CityCopter" | "AW119" | "Gyrocopter" => { assert_eq!(v.tipo, Tipo::Heli); assert!(!v.rotores.is_empty(), "{n}: sin rotores"); }
            // (las toberas del avión están bajo «Particles», que viene apagado: en la web tampoco tiene llamas)
            "Aircraft" => { assert_eq!(v.tipo, Tipo::Avion); assert!(!v.rotores.is_empty()); }
            _ => assert_eq!(v.tipo, Tipo::Asiento, "{n}"),
        }
        if n == "BiciCohete" { assert_eq!(v.bocina_tipo(), Some("timbre")); assert!(v.tobera().is_some()); }
        if n.starts_with("police") { assert_eq!(v.bocina_tipo(), Some("policia")); }
    }
}

/// el auto en el hormigón de RB_Construct: se asienta con las cuatro ruedas en el piso, acelera, dobla a la derecha
/// (palanca + x: el auto va para −x), frena, va marcha atrás y no vuelca ni hunde las ruedas
#[test]
fn auto_maneja() {
    let Some(mut mesa) = abrir() else { return };
    let e = &escena("auto");
    let (mut y0, mut v_max, mut v_atras, mut yaw_doblar, mut arriba_min, mut tocan_min, mut rueda_hundida, mut rueda_flota) = (0.0, 0.0f64, 0.0f64, (0.0, 0.0), 1.0f64, 4usize, 0.0f64, 0.0f64);
    let (mut menos_de_3, mut tocan_quieto) = (0usize, 0usize);
    let mut v_freno = (0.0, 0.0); let mut ms = vec![];
    let mundo = Mundo::nuevo(mesa.mundo.t.clone(), vec![], 1.0);
    let (j, ids) = correr(&mut mesa, e, |i, j, ids| {
        let b = j.fis.cuerpo(ids[0]).unwrap(); let v = j.vehs.de(ids[0]).unwrap(); assert!(sin_nan(b));
        let vz = dot(b.vel, rot(b.q, [0.0, 0.0, 1.0]));
        if i == 30 { y0 = b.pos[1]; println!("asentado: y {:.4}, ruedas que tocan {}, compresión {:?}", b.pos[1], v.ruedas.iter().filter(|w| w.toca).count(), v.ruedas.iter().map(|w| ((w.comp_vis + w.sd * 0.5) * 1000.0).round() / 1000.0).collect::<Vec<_>>()); }
        if i >= 30 && i <= 240 { v_max = v_max.max(vz); }
        if i == 150 { yaw_doblar.0 = yaw(b.q); }
        if i == 240 { yaw_doblar.1 = yaw(b.q); v_freno.0 = vz; }
        if i == 330 { v_freno.1 = vz; }
        if i > 330 { v_atras = v_atras.min(vz); }
        arriba_min = f64::min(arriba_min, rot(b.q, [0.0, 1.0, 0.0])[1]);
        let tocan = v.ruedas.iter().filter(|w| w.toca).count();
        if i == 30 { tocan_quieto = tocan; }
        if i >= 30 { tocan_min = tocan_min.min(tocan); if tocan < 3 { menos_de_3 += 1; } }
        // (la rueda que se ve: el centro de su malla, con la suspensión y la vuelta, a un radio del piso; + hundida, − flota)
        if i >= 30 && v.ruedas.iter().all(|w| w.toca) {
            for (k, g) in ruedas_dibujadas(&mundo, b, v).iter().enumerate() { if let Some(g) = g { rueda_hundida = rueda_hundida.max(*g); rueda_flota = rueda_flota.max(-*g); if i == 30 { println!("  rueda {k} dibujada: {:+.1} cm", g * 100.0); } } }
        }
        if i % 60 == 0 { println!("t {:>5.2}  pos {:>7.2} {:>6.3} {:>7.2}  yaw {:>6.3}  v {:>6.2}  motor {:.2} giro {:+.3} rpm {:.2}", i as f64 * DT, b.pos[0], b.pos[1], b.pos[2], yaw(b.q), vz, v.motor, v.giro, v.rpm); }
    });
    // el costo: lo mismo, midiendo el paso de los vehículos solo
    {
        let mut j2 = mesa.juego(); let id = mesa.crear(&mut j2, "Sedan", [16.0, -3.7, -66.0], QID); j2.vehs.subir(&j2.fis, id);
        for i in 0..300 { let m = mando_en(e, i); let t = Instant::now(); j2.vehs.paso(&mut j2.fis, &mesa.mundo, Some(&j2.aguas), DT, &m); ms.push(t.elapsed().as_secs_f64() * 1000.0); j2.aguas.paso(&mut j2.fis, DT); j2.fis.paso(&mesa.mundo, DT); }
    }
    let prom = ms.iter().sum::<f64>() / ms.len() as f64;
    println!("asentado y {y0:.3}; v máx {v_max:.2} m/s; dobló {:.3} rad (de {:.3} a {:.3}); frenando de {:.2} a {:.2} m/s; atrás hasta {v_atras:.2} m/s; arriba mín {arriba_min:.3}; ruedas que tocan mín {tocan_min} (con menos de 3: {menos_de_3} pasos, sobre el lomo de burro); rueda dibujada hundida máx {:.1} cm, flotando máx {:.1} cm; vehiculos.paso {prom:.4} ms",
        yaw_doblar.1 - yaw_doblar.0, yaw_doblar.0, yaw_doblar.1, v_freno.0, v_freno.1, rueda_hundida * 100.0, rueda_flota * 100.0);
    assert!(v_max > 18.0, "no acelera: {v_max}");
    assert!(yaw_doblar.1 - yaw_doblar.0 < -0.5, "no dobló a la derecha");
    assert!(v_freno.1 < v_freno.0 - 8.0, "no frena: {v_freno:?}");
    assert!(v_atras < -6.0, "no va marcha atrás: {v_atras}");
    assert!(arriba_min > 0.9, "volcó: {arriba_min}");
    // (el camino pasa por el lomo de burro de RB_Construct —35 cm, de z −64 a −52—: a 14 m/s las de adelante se despegan
    // un momento, igual que en la web)
    assert_eq!(tocan_quieto, 4, "estacionado con una rueda en el aire");
    assert!(tocan_min >= 2 && menos_de_3 < 30, "demasiado en el aire: {menos_de_3} pasos");
    // (la rueda dibujada del Sedan queda 3,6 cm sobre el piso estacionado: es lo de la web —la pose del modelo más
    // compVis = x − sd/2—; manejando, hasta ~7 cm un instante al pasar el lomo)
    assert!(rueda_hundida < 0.04 && rueda_flota < 0.08, "la rueda dibujada no apoya: hundida {rueda_hundida}, flota {rueda_flota}");
    assert!(prom < 0.1, "lento: {prom} ms");
    // bajar: al costado, en el piso
    let mut j = j; let s = j.vehs.salir(&j.fis, &mesa.mundo).expect("bajar");
    let b = j.fis.cuerpo(ids[0]).unwrap();
    println!("bajó en {:?} (el auto en {:?})", s.pos, b.pos);
    assert!((largo(sub(s.pos, b.pos)) - 1.7).abs() < 0.3 && (s.pos[1] - 0.95 - -3.7).abs() < 0.2, "la salida {:?}", s.pos);
    assert!(j.vehs.eventos.iter().any(|e| matches!(e, Evento::Sonido { nombre: "Engine_Off", .. })));
}

/// el bote en el lago: flota (con un tercio del casco abajo, densidad 380), acelera hasta ~20 m/s, dobla, frena y va atrás
#[test]
fn bote_en_el_lago() {
    let Some(mut mesa) = abrir() else { return };
    let e = &escena("bote");
    let sup = -4.064;
    let (mut k_asentado, mut y_asentado, mut v_max, mut v_atras, mut yaw_a, mut arriba_min, mut k_min) = (0.0, 0.0, 0.0f64, 0.0f64, (0.0, 0.0), 1.0f64, 1.0f64);
    let (j, ids) = correr(&mut mesa, e, |i, j, ids| {
        let b = j.fis.cuerpo(ids[0]).unwrap(); let v = j.vehs.de(ids[0]).unwrap(); assert!(sin_nan(b));
        let vz = dot(b.vel, rot(b.q, [0.0, 0.0, 1.0]));
        if i == 60 { k_asentado = j.aguas.agua_k(ids[0]); y_asentado = b.pos[1]; }
        if i <= 300 { v_max = v_max.max(vz); }
        if i == 210 { yaw_a.0 = yaw(b.q); } if i == 300 { yaw_a.1 = yaw(b.q); }
        if i > 360 { v_atras = v_atras.min(vz); }
        if i > 60 { k_min = k_min.min(j.aguas.agua_k(ids[0])); }
        arriba_min = f64::min(arriba_min, rot(b.q, [0.0, 1.0, 0.0])[1]);
        if i % 60 == 0 { println!("t {:>5.2}  pos {:>7.2} {:>7.3} {:>7.2}  yaw {:>6.3}  v {:>6.2}  aguaK {:.3}  motor {:.2}", i as f64 * DT, b.pos[0], b.pos[1], b.pos[2], yaw(b.q), vz, j.aguas.agua_k(ids[0]), v.motor); }
    });
    let b = j.fis.cuerpo(ids[0]).unwrap();
    println!("asentado: aguaK {k_asentado:.3}, centro {:.3} m sobre el agua; v máx {v_max:.2}; dobló {:.3} rad; atrás {v_atras:.2}; arriba mín {arriba_min:.3}; aguaK mín {k_min:.3}; final {:?}", y_asentado - sup, yaw_a.1 - yaw_a.0, b.pos);
    assert!(k_min > 0.08, "salió del agua (encalló o saltó): aguaK {k_min}");
    assert!(k_asentado > 0.15 && k_asentado < 0.6, "no flota bien: {k_asentado}");
    assert!(v_max > 15.0, "no anda: {v_max}");
    assert!(yaw_a.1 - yaw_a.0 > 0.8, "no dobló a la izquierda");
    assert!(v_atras < -3.0, "no va atrás: {v_atras}");
    assert!(arriba_min > 0.85, "volcó");
    assert!(b.pos[1] > sup - 1.0 && b.pos[1] < sup + 1.0, "se hundió o voló");
}

/// los props que caen al lago: flotan los de menos de 1000 kg/m³ (la madera, a lo sumo 700) y se hunden los demás
#[test]
fn props_flotan() {
    let Some(mut mesa) = abrir() else { return };
    let e = &escena("props"); let sup = -4.064;
    let (j, ids) = correr(&mut mesa, e, |_, j, ids| { for id in ids { assert!(sin_nan(j.fis.cuerpo(*id).unwrap())); } });
    let mut sal = 0;
    for ((n, _, _), id) in e.objs.iter().zip(&ids) {
        let pf = mesa.cat.prefab(&mesa.paq, n).unwrap(); let b = j.fis.cuerpo(*id).unwrap();
        let vol = jxjuego::flotar::forma_volumen(&pf.forma);
        let rho = pf.dens.unwrap_or((pf.masa / vol).clamp(250.0, if pf.snd == "wood" { 700.0 } else { 9000.0 }));
        let k = j.aguas.agua_k(*id); let flota = rho < 1000.0;
        println!("{n:<12} masa {:>6.1} vol {:>6.3} rho {:>6.0} ({}) → y {:>7.3} (agua {sup}) aguaK {k:.2} v {:.3} dormido {}", pf.masa, vol, rho, pf.snd, b.pos[1], largo(b.vel), b.duerme);
        if flota { assert!(k < 0.99 && b.pos[1] > sup - 0.6, "{n} debería flotar"); assert!((k - rho / 1000.0).abs() < 0.3, "{n}: aguaK {k} con rho {rho}"); }
        else { assert!(b.pos[1] < sup - 0.3, "{n} debería hundirse"); }
        sal += j.aguas.salpicones.len();
    }
    assert!(sal > 0, "sin salpicones");
}

/// lo que cuesta: un auto manejando, 10 estacionados (la suspensión los mantiene despiertos, como en la web), el bote y 6
/// props en el lago; el tiempo de cada parte por paso
#[test]
fn costo_por_paso() {
    let Some(mut mesa) = abrir() else { return };
    let mut j = mesa.juego();
    let id = mesa.crear(&mut j, "Sedan", [28.0, -3.7, -30.0], QID);
    for k in 0..10 { mesa.crear(&mut j, ["Sedan", "Derby5", "police_car_v4", "Sofie", "Moto"][k % 5], [-14.0 + (k % 5) as f64 * 7.0, -3.7, -40.0 + (k / 5) as f64 * 9.0], QID); }
    let bote = mesa.crear(&mut j, "Airboat", [96.0, -4.064, -40.0], QID);
    for (k, n) in ["Crate", "Barril", "Sofa", "Tire", "TableRound", "Box1"].iter().enumerate() { mesa.crear(&mut j, n, [90.0 + k as f64 * 2.5, -3.0, -30.0], QID); }
    j.vehs.subir(&j.fis, id);
    let (mut tv, mut ta, mut tf) = (0.0, 0.0, 0.0); let n = 600;
    for i in 0..n {
        let m = Mando { y: 1.0, x: if (i / 120) % 2 == 1 { 0.5 } else { 0.0 }, ..Mando::default() };
        let t = Instant::now(); j.vehs.paso(&mut j.fis, &mesa.mundo, Some(&j.aguas), DT, &m); tv += t.elapsed().as_secs_f64();
        let t = Instant::now(); j.aguas.paso(&mut j.fis, DT); ta += t.elapsed().as_secs_f64();
        let t = Instant::now(); j.fis.paso(&mesa.mundo, DT); tf += t.elapsed().as_secs_f64(); j.aguas.avanzar(DT);
    }
    let ms = |x: f64| x * 1000.0 / n as f64;
    println!("12 vehículos (11 con ruedas) + 6 props: vehiculos.paso {:.4} ms, aguas.paso {:.4} ms, fis.paso {:.4} ms por paso; {} cuerpos dormidos; bote aguaK {:.2}",
        ms(tv), ms(ta), ms(tf), j.fis.cuerpos.iter().filter(|b| b.duerme).count(), j.aguas.agua_k(bote));
    assert!(ms(tv) < 0.2 && ms(ta) < 0.2, "lento");
}

/// subir con el botón de usar (mirando el auto), la cámara de adentro (tercera y primera persona), los sonidos y bajar
#[test]
fn subir_camara_y_bajar() {
    let Some(mut mesa) = abrir() else { return };
    let mut j = mesa.juego();
    let id = mesa.crear(&mut j, "Sedan", [0.0, -3.7, -40.0], QID);
    for _ in 0..30 { j.paso(&mesa.mundo, &Mando::default()); }
    // (de pie a 3 m, mirando el auto)
    let ojo = [3.0, -3.7 + 1.67, -40.0];
    assert!(matches!(j.vehs.usar(&mut j.fis, &mesa.mundo, ojo, [-1.0, -0.2, 0.0]), Usar::Subio(x) if x == id));
    assert!(j.vehs.eventos.iter().any(|e| matches!(e, Evento::Sonido { nombre: "Engine_On", .. })));
    let b = j.fis.cuerpo(id).unwrap().clone();
    let c = j.vehs.camara(&mesa.mundo, b.pos, b.q, 0.0, -0.15).unwrap();
    println!("tercera: {:?} mira {:?}; ojos {:?}; jugador {:?}", c.pos, c.adelante(), c.ojo, c.jugador);
    assert!((largo(sub(c.pos, add(b.pos, [0.0, 1.6, 0.0]))) - 6.5).abs() < 0.01 && c.pos[2] < b.pos[2], "la cámara atrás, a 6,5 m");
    assert!(c.adelante()[1] < 0.0, "mira un poco abajo");
    j.vehs.primera = true;
    let c1 = j.vehs.camara(&mesa.mundo, b.pos, b.q, 0.0, 0.0).unwrap();
    assert_eq!(c1.pos, c1.ojo); assert!(largo(sub(c1.ojo, b.pos)) < 2.0);
    // el motor suena con el tono que sube con las vueltas
    for _ in 0..60 { j.paso(&mesa.mundo, &Mando { y: 1.0, ..Mando::default() }); }
    let bu = j.vehs.bucles(&j.fis); println!("bucles: {bu:?}");
    assert!(bu.iter().any(|x| x.nombre == "Big4Stroke" && x.tono > 0.8));
    assert_eq!(j.vehs.bocina(&j.fis, true).map(|x| x.0), Some("auto"));
    let pcm = jxjuego::vehiculo::bocina_pcm("auto", 44100); assert_eq!(pcm.len(), 44100); assert!(pcm.iter().all(|x| x.abs() < 1.0) && pcm.iter().any(|x| x.abs() > 0.1));
    // bajar con el mismo botón
    assert!(matches!(j.vehs.usar(&mut j.fis, &mesa.mundo, ojo, [1.0, 0.0, 0.0]), Usar::Salio(_)));
    assert!(j.vehs.jugador.is_none());
    j.vehs.quitar(id, &j.fis, &mesa.mundo); j.fis.quitar(id); j.aguas.olvidar(id);
    assert!(j.vehs.lista.is_empty());
}

/// la traza para comparar con la web: deja en $JXV_SALIDA los triángulos del mapa (tris.bin), las escenas (escenas.json) y
/// el Airboat (airboat.json), e imprime cada 10 pasos el lugar y el giro de cada objeto con todos los dígitos
/// (`JXV_SALIDA=<carpeta> cargo test --release -p jxjuego --test vehiculo -- --ignored --nocapture traza`)
#[test]
#[ignore]
fn traza_para_comparar_con_js() {
    let Ok(sal) = std::env::var("JXV_SALIDA") else { eprintln!("falta JXV_SALIDA"); return };
    let Some(mut mesa) = abrir() else { return };
    std::fs::write(Path::new(&sal).join("tris.bin"), mesa.mundo.t.iter().flat_map(|x| x.to_le_bytes()).collect::<Vec<u8>>()).unwrap();
    std::fs::write(Path::new(&sal).join("airboat.json"), mesa.paq.d["pf"]["Airboat#gm"].to_string()).unwrap();
    std::fs::write(Path::new(&sal).join("tn.bin"), mesa.mundo.tn.iter().flat_map(|x| x.to_le_bytes()).collect::<Vec<u8>>()).unwrap();
    let es: Vec<Value> = escenas().iter().map(|e| json!({ "n": e.n, "objs": e.objs.iter().map(|(n, p, a)| { let q = qeje([0.0, 1.0, 0.0], *a); json!([n, p, q]) }).collect::<Vec<_>>(),
        "maneja": e.maneja.map_or(-1, |k| k as i64), "pasos": e.pasos, "tramos": e.tramos.iter().map(|t| json!([t.0, t.1, t.2, t.3, t.4, t.5])).collect::<Vec<_>>() })).collect();
    std::fs::write(Path::new(&sal).join("escenas.json"), Value::Array(es).to_string()).unwrap();
    let solo = std::env::var("JXV_ESCENA").ok();
    // (JXV_SOLO=0,3: sólo esos objetos de la escena, para buscar dónde empieza una diferencia)
    let filtro: Option<Vec<usize>> = std::env::var("JXV_SOLO").ok().map(|s| s.split(',').filter_map(|x| x.parse().ok()).collect());
    let f = |x: f64| format!("{:.14e}", x);
    for mut e in escenas() {
        if solo.as_deref().map_or(false, |s| s != e.n) { continue; }
        if let Some(f) = &filtro { e.objs = e.objs.iter().enumerate().filter(|(k, _)| f.contains(k)).map(|(_, o)| *o).collect(); if e.maneja.map_or(false, |m| !f.contains(&m)) { e.maneja = None; } else if let Some(m) = e.maneja { e.maneja = Some(f.iter().position(|x| *x == m).unwrap()); } }
        correr(&mut mesa, &e, |i, j, ids| {
            if i % 10 != 0 && std::env::var("JXV_CADA").is_err() { return; }
            for (k, id) in ids.iter().enumerate() {
                let b = j.fis.cuerpo(*id).unwrap();
                println!("{}{k} {i} {}", e.n, [b.pos[0], b.pos[1], b.pos[2], b.q[0], b.q[1], b.q[2], b.q[3], b.vel[0], b.vel[1], b.vel[2]].iter().map(|x| f(*x)).collect::<Vec<_>>().join(" "));
                if let Some(v) = j.vehs.de(*id) { println!("{}v{k} {i} {} {} {} {} {} {}", e.n, f(v.motor), f(v.giro), f(v.vel), f(v.rpm), f(j.aguas.agua_k(*id)), if j.vehs.jugador.is_some() { 1 } else { 0 }); }
                else { println!("{}k{k} {i} {}", e.n, f(j.aguas.agua_k(*id))); }
            }
        });
    }
}

/// el piso a lo largo del camino del auto (para ver escalones)
#[test]
#[ignore]
fn perfil_del_piso() {
    let Some(mesa) = abrir() else { return };
    for x in [27.0f32, 28.0, 29.0] { let mut l = String::new(); for k in 0..60 { let z = -72.0 + k as f32 * 0.5; let o = [x, 10.0, z]; let y = mesa.mundo.rayo(o, [0.0, -1.0, 0.0], 30.0).map(|g| 10.0 - g.t).unwrap_or(f32::NAN); l += &format!("{:.3} ", y); } println!("x {x}: {l}"); }
}
