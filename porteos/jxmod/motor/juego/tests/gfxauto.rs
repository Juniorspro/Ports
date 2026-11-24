//! La búsqueda de la calidad automática igual que la de la web: los 400 casos de datos/gfxauto.json (los arma
//! tests/gfxauto_ref.js con gfxBuscar de juego/gfxauto.js de verdad) tienen que elegir lo mismo y medir lo mismo.
use jxjuego::gfxauto::{paso, Medidas, Paso, N};
#[test]
fn igual_que_la_web() {
    let t = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/datos/gfxauto.json")).unwrap();
    let l: Vec<serde_json::Value> = serde_json::from_str(&t).unwrap();
    let mut mal = vec![];
    for c in &l {
        let fps: Vec<Option<f32>> = c["fps"].as_array().unwrap().iter().map(|v| v.as_f64().map(|x| x as f32)).collect();
        let (ini, m, eleg_web) = (c["inicio"].as_u64().unwrap() as usize, c["m"].as_u64().unwrap() as usize, c["elegida"].as_u64().unwrap() as usize);
        let med_web: Vec<String> = c["med"].as_array().unwrap().iter().map(|v| v.to_string()).collect();
        let mut med: Medidas = [None; N]; let mut n = 0;
        let eleg = loop { match paso(ini, &med, 57.0, n >= m) { Paso::Medir(k) => { med[k] = Some(fps[k]); n += 1; } Paso::Listo(e) => break e } };
        let med_nat: Vec<String> = med.iter().map(|x| match x { None => "\"x\"".into(), Some(None) => "null".into(), Some(Some(f)) => serde_json::json!(f).to_string() }).collect();
        // (los números: los mismos valores de la tabla, así que se comparan como texto después de pasar por f32)
        let norm = |v: &Vec<String>| v.iter().map(|s| s.parse::<f32>().map(|f| format!("{f}")).unwrap_or(s.clone())).collect::<Vec<_>>();
        if eleg != eleg_web || norm(&med_nat) != norm(&med_web) { mal.push(format!("{c}: nativa {eleg} {med_nat:?}")); }
    }
    assert!(mal.is_empty(), "{} de {} distintos:\n{}", mal.len(), l.len(), mal.join("\n"));
}
