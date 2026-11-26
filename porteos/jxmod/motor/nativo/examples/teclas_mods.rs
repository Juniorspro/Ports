//! Las teclas que pide cada arma de los addons de una carpeta y qué hace cada una (teclas_mod.rs), para revisar a mano.
//! Uso: teclas_mods CARPETA_CON_GMA
use std::collections::BTreeMap;
fn main() {
    let dir = std::env::args().nth(1).expect("falta la carpeta");
    let mut n = 0;
    for e in std::fs::read_dir(&dir).unwrap().flatten() {
        let p = e.path(); if p.extension().and_then(|x| x.to_str()) != Some("gma") { continue; }
        let Some(arch) = std::fs::read(&p).ok().and_then(|b| jxgmod::leer_gma(&b)) else { continue };
        let mut armas: BTreeMap<String, String> = BTreeMap::new();
        for (r, b) in arch.iter() {
            let r = r.to_lowercase(); if !r.ends_with(".lua") { continue; } let todo = std::env::var("JXM_TODO").is_ok(); let x = match r.strip_prefix("lua/weapons/") { Some(x) => x, None if todo => "todo", None => continue };
            let c = x.split('/').next().unwrap().trim_end_matches(".lua").to_string(); if c == "gmod_tool" { continue; }
            let t = armas.entry(c).or_default(); t.push_str(&String::from_utf8_lossy(b)); t.push('\n');
        }
        for (c, src) in armas {
            let v = jxmod::comun::teclas_mod::leer(&src); if v.is_empty() { continue; } n += 1;
            let s: Vec<String> = v.iter().map(|b| format!("{} → {}", b.t, b.acc.as_ref().map(|a| a.es.as_str()).unwrap_or("(letra)"))).collect();
            println!("{} · {c}: {}", p.file_name().unwrap().to_string_lossy(), s.join(" · "));
        }
    }
    println!("{n} armas con teclas");
}
