//! La censura del chat igual que la de la web: los mensajes de datos/censura.json (los arma tests/censura_ref.js con
//! juego/censura.js de verdad) tienen que quedar tapados letra por letra igual.
#[test]
fn igual_que_la_web() {
    let t = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/datos/censura.json")).unwrap();
    let l: Vec<(String, String)> = serde_json::from_str(&t).unwrap();
    let mal: Vec<String> = l.iter().filter_map(|(m, e)| { let r = jxjuego::censura::censurar(m); if &r != e { Some(format!("«{m}»: web «{e}», nativa «{r}»")) } else { None } }).collect();
    assert!(mal.is_empty(), "{} de {} distintos:\n{}", mal.len(), l.len(), mal.join("\n"));
}
