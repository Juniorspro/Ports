//! Los celulares de gama baja y media (celulares.js): el modelo de cada uno, su chip y la RAM más chica que trae; cada chip
//! con el puntaje de su GPU y el texto que muestra su GPU. Sirve para elegir la calidad de gráficos la primera vez. Las
//! tablas son las mismas de la web (se leen de juego/celulares.js al compilar: una sola copia).
use serde_json::Value;
use std::collections::HashMap;
use std::sync::OnceLock;

const JS: &str = include_str!("../../../juego/celulares.js");
/// un chip (CEL_SOC): nombre, puntaje de la GPU, el texto de WebGL y el nombre de la GPU
#[derive(Clone, Debug)]
pub struct Soc { pub n: String, pub puntaje: f64, pub gl: String, pub gpu: String }
/// lo que se sabe de un aparato (CELU.det)
#[derive(Clone, Debug, PartialEq)]
pub struct Det { pub fuente: &'static str, pub modelo: String, pub nom: String, pub soc: String, pub gpu: String, pub puntaje: f64, pub ram: f64 }
struct Tablas { soc: Vec<Soc>, mapa: HashMap<String, (usize, f64, String)>, sams: HashMap<String, (usize, f64, String)> }

fn norm(s: &str) -> String { s.to_lowercase().chars().filter(|c| !(c.is_whitespace() || matches!(c, '-' | '_' | '.' | '/'))).collect() }
/// CEL_MARCAS: la marca de adelante («Tecno Mobile », «Xiaomi »…)
fn sin_marca(s: &str) -> String {
    let l = s.to_lowercase();
    for m in ["tecno mobile", "tecno", "infinix", "itel", "zte", "vivo", "realme", "oppo", "xiaomi", "redmi", "poco", "samsung", "motorola", "moto", "nokia", "honor", "huawei", "lenovo", "alcatel", "tcl", "lava", "umidigi", "doogee", "ulefone"] {
        if l.starts_with(m) && l[m.len()..].starts_with(|c: char| c.is_whitespace()) { return s[m.len()..].trim_start().to_string(); }
    }
    s.to_string()
}
/// Samsung: SM-A055F/DS → a055
fn sams(s: &str) -> Option<String> {
    let l = s.trim().to_lowercase(); let r = l.strip_prefix("sm")?; let r = r.strip_prefix('-').unwrap_or(r);
    let c: Vec<char> = r.chars().collect(); if c.len() >= 4 && c[0].is_ascii_lowercase() && c[1..4].iter().all(|x| x.is_ascii_digit()) { Some(c[..4].iter().collect()) } else { None }
}
fn tablas() -> &'static Tablas {
    static T: OnceLock<Tablas> = OnceLock::new();
    T.get_or_init(|| {
        let ini = JS.find("const CEL_SOC = ").map(|i| i + 16).unwrap_or(0); let fin = JS[ini..].find(";\n").map(|f| ini + f).unwrap_or(ini);
        let v: Value = serde_json::from_str(&JS[ini..fin]).unwrap_or(Value::Null);
        let soc: Vec<Soc> = v.as_array().map(|a| a.iter().map(|x| Soc { n: x[0].as_str().unwrap_or("").into(), puntaje: x[1].as_f64().unwrap_or(0.0), gl: x[2].as_str().unwrap_or("").into(), gpu: x[3].as_str().unwrap_or("").into() }).collect()).unwrap_or_default();
        let ini = JS.find("const CEL_MOD = \"").map(|i| i + 17).unwrap_or(0); let fin = JS[ini..].find('"').map(|f| ini + f).unwrap_or(ini);
        let (mut mapa, mut sm) = (HashMap::new(), HashMap::new());
        for lin in JS[ini..fin].split('|') {
            let p: Vec<&str> = lin.splitn(4, ':').collect(); if p.len() < 4 { continue; }
            let e = (p[1].parse::<usize>().unwrap_or(0), p[2].parse::<f64>().unwrap_or(0.0), p[3].to_string());
            for c in p[0].split(',') {
                mapa.insert(norm(c), e.clone()); let s = sin_marca(c); if s != c { mapa.entry(norm(&s)).or_insert_with(|| e.clone()); }
                if let Some(k) = sams(c) { sm.entry(k).or_insert_with(|| e.clone()); }
            }
        }
        Tablas { soc, mapa, sams: sm }
    })
}
/// celuBuscar: el modelo (como lo da el sistema: Build.MODEL) → su chip, su GPU y su RAM
pub fn buscar(modelo: &str) -> Option<Det> {
    if modelo.is_empty() { return None; }
    let t = tablas(); let e = t.mapa.get(&norm(modelo)).or_else(|| t.mapa.get(&norm(&sin_marca(modelo)))).or_else(|| sams(modelo).and_then(|k| t.sams.get(&k)))?;
    let s = t.soc.get(e.0)?;
    Some(Det { fuente: "modelo", modelo: modelo.into(), nom: e.2.clone(), soc: s.n.clone(), gpu: s.gpu.clone(), puntaje: s.puntaje, ram: e.1 })
}
/// celuPorGPU: sin el modelo, por la GPU (el nombre entero; varias placas comparten GPU: la mediana de sus puntajes)
pub fn por_gpu(gpu: &str) -> Option<Det> {
    let g = gpu.to_lowercase(); if g.is_empty() { return None; }
    let entero = |t: &str| { let mut k = g.find(t); while let Some(i) = k { let c = g[i + t.len()..].chars().next(); if !c.map(|c| c.is_ascii_digit() || c.is_ascii_lowercase()).unwrap_or(false) { return true; } k = g[i + 1..].find(t).map(|j| i + 1 + j); } false };
    let mut largo = 0; let mut l: Vec<&Soc> = vec![];
    for s in &tablas().soc { let t = s.gl.to_lowercase(); if t.is_empty() || !entero(&t) { continue; } if t.len() > largo { largo = t.len(); l = vec![s]; } else if t.len() == largo { l.push(s); } }
    if l.is_empty() {
        let num = |pre: &str| -> Option<u32> { let i = g.find(pre)? + pre.len(); let d: String = g[i..].chars().take(3).collect(); if d.len() == 3 && d.chars().all(|c| c.is_ascii_digit()) { d.parse().ok() } else { None } };
        let alta = g.contains("immortalis") || num("adreno (tm) ").map(|n| n >= 640).unwrap_or(false) || num("mali-g").map(|n| n >= 610).unwrap_or(false);
        return if alta { Some(Det { fuente: "gpu", modelo: String::new(), nom: String::new(), soc: String::new(), gpu: gpu.into(), puntaje: 150.0, ram: 0.0 }) } else { None };
    }
    let mut p: Vec<f64> = l.iter().map(|s| s.puntaje).collect(); p.sort_by(|a, b| a.partial_cmp(b).unwrap()); let med = p[p.len() / 2];
    Some(Det { fuente: "gpu", modelo: String::new(), nom: String::new(), soc: if l.len() == 1 { l[0].n.clone() } else { String::new() }, gpu: l[0].gpu.clone(), puntaje: med, ram: 0.0 })
}
/// celuPerfil: la calidad (0 patata … 4 ultra) por el puntaje de la GPU, con tope por memoria (la del modelo o la del
/// aparato en GB, la mayor)
pub fn perfil(d: &Det, ram_aparato: f64) -> usize {
    let p = d.puntaje; let perf = if p < 25.0 { 0 } else if p < 48.0 { 1 } else if p < 70.0 { 2 } else { 3 };
    let ram = d.ram.max(ram_aparato);
    let tope = if ram > 0.0 && ram <= 1.0 { 0 } else if ram > 0.0 && ram <= 2.0 { 1 } else if ram > 0.0 && ram <= 3.0 { 2 } else { 4 };
    perf.min(tope)
}
/// celuCpuChico: sólo núcleos chicos (el juego arranca con lo que no se nota hecho menos seguido)
pub fn cpu_chico(d: Option<&Det>, tactil: bool, nucleos: usize, ram: f64) -> bool {
    if let Some(d) = d { if !d.soc.is_empty() {
        let s = &d.soc; let helio = |p: &str| s.contains(&format!("Helio {p}"));
        return s.contains("MT6739") || ["A2", "P2", "G2", "G3"].iter().any(|p| (0..10).any(|k| helio(&format!("{p}{k}")))) || helio("P35") || (420..460).any(|n| s.contains(&format!("Snapdragon {n}")))
            || s.contains("SC98") || s.contains("Exynos 7870") || s.contains("Exynos 850") || s.contains("JR510") || s.contains("T310") || ["MT8127", "MT8163", "MT8168"].iter().any(|x| s.contains(x));
    } if d.puntaje > 0.0 && d.puntaje < 20.0 { return true; } }
    tactil && (nucleos <= 4 || ram <= 2.0)
}
