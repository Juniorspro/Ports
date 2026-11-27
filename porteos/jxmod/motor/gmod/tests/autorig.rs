//! El rig automático de los props con forma de persona (gmod_autorig.js → autorig.rs): una persona de cajas (piernas
//! separadas, torso, cuello angosto, cabeza y brazos abiertos) se reconoce y recibe el esqueleto de Valve con los huesos en
//! el mismo lugar que en la web (los números de abajo salen de correr juego/gmod_autorig.js en node con la misma malla) y
//! los mismos pesos; una tabla no es persona. Y las rutas que no son personajes (vistas, armas, pedazos, manos, animaciones).
use jxgmod::autorig;
use jxgmod::formatos::{Mdl, Vertices};
use std::rc::Rc;

/// una caja llena de puntos (x adelante, y izquierda, z arriba; en pulgadas)
fn caja(v: &mut Vec<[f32; 3]>, mn: [f32; 3], mx: [f32; 3], n: usize) {
    for i in 0..=n { for j in 0..=n { for k in 0..=n {
        let f = |a: f32, b: f32, t: usize| a + (b - a) * t as f32 / n as f32;
        let p = [f(mn[0], mx[0], i), f(mn[1], mx[1], j), f(mn[2], mx[2], k)];
        // (sólo la cáscara)
        if i == 0 || i == n || j == 0 || j == n || k == 0 || k == n { v.push(p); }
    } } }
}
fn mdl(pos: Vec<[f32; 3]>) -> Mdl {
    let n = pos.len();
    let v = Vertices { n, nor: vec![[0.0, 0.0, 1.0]; n], uv: vec![[0.0; 2]; n], hb: vec![[0; 3]; n], w: vec![[1.0, 0.0, 0.0]; n], pos };
    Mdl { version: 48, nombre: "prueba".into(), hull: [[-20.0, -20.0, 0.0], [20.0, 20.0, 72.0]], flags: 0, huesos: vec![], texturas: vec![], carpetas: vec![], pieles: vec![], adjuntos: vec![], cuerpos: vec![],
        anims: vec![], secuencias: vec![], pose_params: vec![], pose_rangos: vec![], ani_nom: String::new(), bloques: vec![], b: Rc::from(vec![0u8; 4].into_boxed_slice()), ani: None, v: Some(v), mallas: vec![], mallas_lejos: vec![] }
}
/// una persona de 72 pulgadas (1,83 m) mirando a +x
fn persona() -> Mdl {
    let mut v = vec![];
    caja(&mut v, [-3.0, 2.0, 0.0], [3.0, 7.0, 33.0], 8);     // pierna izquierda
    caja(&mut v, [-3.0, -7.0, 0.0], [3.0, -2.0, 33.0], 8);   // pierna derecha
    caja(&mut v, [-1.0, 2.0, 0.0], [6.0, 7.0, 2.0], 6);      // pie izquierdo (para adelante)
    caja(&mut v, [-1.0, -7.0, 0.0], [6.0, -2.0, 2.0], 6);    // pie derecho
    caja(&mut v, [-4.0, -8.0, 33.0], [4.0, 8.0, 58.0], 10);  // torso
    caja(&mut v, [-1.5, -2.0, 58.0], [1.5, 2.0, 62.0], 4);   // cuello
    caja(&mut v, [-4.0, -4.0, 62.0], [4.0, 4.0, 72.0], 8);   // cabeza
    caja(&mut v, [-2.0, 8.0, 54.0], [2.0, 28.0, 57.0], 10);  // brazo izquierdo (en T)
    caja(&mut v, [-2.0, -28.0, 54.0], [2.0, -8.0, 57.0], 10); // brazo derecho
    mdl(v)
}

#[test]
fn persona_de_cajas() {
    let m = persona();
    assert!(autorig::es_persona(&m), "no la reconoció");
    let r = autorig::rig(&m).expect("sin rig");
    assert_eq!(r.huesos.len(), 23);
    // la posición de cada hueso en el modelo (sumando las de sus padres), igual que la web
    let mut p: Vec<[f32; 3]> = vec![];
    for h in &r.huesos { let b = if h.pa >= 0 { p[h.pa as usize] } else { [0.0; 3] }; p.push([b[0] + h.pos[0], b[1] + h.pos[1], b[2] + h.pos[2]]); }
    const WEB: [(&str, [f32; 3]); 23] = [("Pelvis", [0.0, 0.0, 34.560]), ("Spine", [0.0, 0.0, 39.096]), ("Spine1", [0.0, 0.0, 44.136]), ("Spine2", [0.0, 0.0, 49.176]),
        ("Spine4", [0.0, 0.0, 54.720]), ("Neck1", [0.0, 0.0, 59.760]), ("Head1", [0.0, 0.0, 64.044]),
        ("L_Clavicle", [0.0, 2.160, 56.160]), ("L_UpperArm", [0.0, 14.400, 56.160]), ("L_Forearm", [-2.290, 20.180, 55.242]), ("L_Hand", [-1.700, 25.960, 54.324]),
        ("L_Thigh", [0.0, 4.500, 31.680]), ("L_Calf", [1.080, 4.500, 17.741]), ("L_Foot", [0.0, 4.500, 3.802]), ("L_Toe0", [5.040, 4.500, 0.720]),
        ("R_Clavicle", [0.0, -2.160, 56.160]), ("R_UpperArm", [0.0, -14.400, 56.160]), ("R_Forearm", [-2.290, -20.180, 55.242]), ("R_Hand", [-1.700, -25.960, 54.324]),
        ("R_Thigh", [0.0, -4.500, 31.680]), ("R_Calf", [1.080, -4.500, 17.741]), ("R_Foot", [0.0, -4.500, 3.802]), ("R_Toe0", [5.040, -4.500, 0.720])];
    for (i, (n, w)) in WEB.iter().enumerate() {
        assert_eq!(r.huesos[i].n, format!("ValveBiped.Bip01_{n}"));
        let d = (0..3).map(|k| (p[i][k] - w[k]).abs()).fold(0.0f32, f32::max);
        assert!(d < 0.002, "{n}: {:?} y en la web {:?}", p[i], w);
    }
    // (los pesos: cada vértice suma 1, y la misma firma que la web —el hueso y el peso principal de uno de cada 97—)
    let v = r.v.as_ref().unwrap();
    for k in 0..v.n { let s: f32 = v.w[k].iter().sum(); assert!((s - 1.0).abs() < 1e-3, "pesos {s}"); }
    let firma: i64 = (0..v.n).step_by(97).map(|i| v.hb[i][0] as i64 * 1000 + (v.w[i][0] * 1000.0).round() as i64).sum();
    assert_eq!(firma, 479810);
    assert_eq!(v.hb[0], [12, 13, 14]);
    assert!((v.w[0][0] - 0.4573).abs() < 1e-3 && (v.w[0][2] - 0.0855).abs() < 1e-3, "{:?}", v.w[0]);
}

#[test]
fn no_personas() {
    // una tabla: chata
    let mut v = vec![]; caja(&mut v, [-20.0, -20.0, 0.0], [20.0, 20.0, 2.0], 12);
    assert!(!autorig::es_persona(&mdl(v)));
}

#[test]
fn rutas_que_no_son_personajes() {
    for r in ["models/player/kleiner.mdl", "models/weapons/v_pistol.mdl", "models/weapons/w_pistol.mdl", "models/weapons/c_arms.mdl", "models/props/gibs/pedazo.mdl", "models/x/zombie_gib3.mdl", "models/x/hands.mdl", "models/x/arms/brazo.mdl", "models/x/m_anims.mdl"] {
        assert!(autorig::fuera(r), "{r} debería quedar afuera");
    }
    for r in ["models/x/estatua.mdl", "models/humans/group01/male_07.mdl", "models/x/handsome_guy.mdl", "models/x/gibson.mdl", "models/x/armadillo.mdl"] {
        assert!(!autorig::fuera(r), "{r} no debería quedar afuera");
    }
}
