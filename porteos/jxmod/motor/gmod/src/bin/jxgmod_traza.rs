//! La traza de lo que un addon le pide al juego, con el juego de mentira de jxgmod (prueba.rs). Es el mismo guion que
//! tests/web/traza_web.js corre con la capa GMod de la web: las dos trazas se comparan línea por línea.
//!   jxgmod_traza <addon.gma | carpeta | @lista> [--ticks 120] [--api] [--tiempo] [--n 20]
//! --api: también cada llamada del Lua a la API nativa; --tiempo: en vez de la traza, cuánto tarda cada cuadro;
//! --n: con una lista (@archivo, una ruta por línea), monta los primeros N addons a la vez.

use jxgmod::traza;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let opt = |k: &str| args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).cloned();
    let ticks: u32 = opt("--ticks").and_then(|x| x.parse().ok()).unwrap_or(120);
    let tiempo = args.iter().any(|a| a == "--tiempo");
    let n_addons: usize = opt("--n").and_then(|x| x.parse().ok()).unwrap_or(1);
    let fuente = args.iter().enumerate().find(|(i, a)| !a.starts_with("--") && !(*i > 0 && (args[i - 1] == "--ticks" || args[i - 1] == "--n"))).map(|x| x.1.clone()).expect("falta el addon");
    let fuentes: Vec<String> = match fuente.strip_prefix('@') { Some(l) => std::fs::read_to_string(l).unwrap().lines().filter(|x| !x.trim().is_empty()).take(n_addons).map(String::from).collect(), None => vec![fuente.clone()] };
    let mut addons = Vec::new();
    for f in &fuentes { match traza::leer(f) { Some(a) => addons.push((f.clone(), a)), None => { eprintln!("no es un addon: {}", f); std::process::exit(2) } } }
    let (s, tiempos, montar) = traza::correr(addons, ticks, tiempo, args.iter().any(|a| a == "--api"), args.iter().any(|a| a == "--nid"));
    if tiempo {
        let mut t2 = tiempos.clone();
        t2.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let prom = tiempos.iter().sum::<f64>() / tiempos.len().max(1) as f64;
        let ult: Vec<f64> = tiempos.iter().rev().take(60).copied().collect();
        let prom_ult = ult.iter().sum::<f64>() / ult.len().max(1) as f64;
        println!("addons {} montar {:.1} ms; cuadro: promedio {:.3} ms, mediana {:.3}, p95 {:.3}, máx {:.3}; últimos 60: {:.3} ms", fuentes.len(), montar, prom, t2[t2.len() / 2], t2[(t2.len() * 95) / 100], t2[t2.len() - 1], prom_ult);
        return;
    }
    print!("{}", s);
}
