//! jxlua: correr archivos de Lua con el Lua de JXMod (para probar y medir).
//!  - `jxlua archivo.lua...`: corre cada uno (lo que imprime sale por la salida; un error, «ERROR: mensaje»);
//!  - `jxlua --tiempo archivo.lua`: lo mismo y dice cuánto tardó;
//!  - `jxlua --parsear ruta...`: compila todos los .lua (y los de adentro de los .gma) de esas carpetas y cuenta.
use std::path::Path;

use jxlua::Estado;

fn correr(ruta: &str, tiempo: bool) -> bool {
    let src = match std::fs::read(ruta) { Ok(s) => s, Err(e) => { eprintln!("{ruta}: {e}"); return false; } };
    let mut lua = Estado::nuevo();
    let nombre = Path::new(ruta).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| ruta.to_string());
    let t0 = std::time::Instant::now();
    let r = lua.ejecutar(&src, &nombre);
    let dt = t0.elapsed();
    let ok = match r {
        Ok(_) => true,
        Err(e) => { println!("ERROR: {}", e.mensaje()); false }
    };
    if tiempo { eprintln!("{}: {:.1} ms", ruta, dt.as_secs_f64() * 1000.0); }
    ok
}

/// los .lua de adentro de un .gma: (nombre, contenido)
fn leer_gma(b: &[u8]) -> Option<Vec<(String, Vec<u8>)>> {
    if b.len() < 5 || &b[..4] != b"GMAD" { return None; }
    let mut p = 5usize;
    let cstr = |p: &mut usize| -> Option<String> {
        let ini = *p;
        while *p < b.len() && b[*p] != 0 { *p += 1; }
        if *p >= b.len() { return None; }
        let s = String::from_utf8_lossy(&b[ini..*p]).into_owned();
        *p += 1;
        Some(s)
    };
    p += 8 + 8; // steamid, fecha
    if b[4] > 1 { while !cstr(&mut p)?.is_empty() {} }
    cstr(&mut p)?; cstr(&mut p)?; cstr(&mut p)?;
    p += 4;
    let mut entradas = vec![];
    loop {
        if p + 4 > b.len() { return None; }
        let n = u32::from_le_bytes(b[p..p + 4].try_into().ok()?);
        p += 4;
        if n == 0 { break; }
        let nombre = cstr(&mut p)?;
        if p + 12 > b.len() { return None; }
        let tam = i64::from_le_bytes(b[p..p + 8].try_into().ok()?) as usize;
        p += 12;
        entradas.push((nombre, tam));
    }
    let mut out = vec![];
    for (nombre, tam) in entradas {
        if p + tam > b.len() { break; }
        if nombre.to_lowercase().ends_with(".lua") { out.push((nombre, b[p..p + tam].to_vec())); }
        p += tam;
    }
    Some(out)
}

fn juntar(ruta: &Path, out: &mut Vec<(String, Vec<u8>)>) {
    if ruta.is_dir() {
        let mut hijos: Vec<_> = match std::fs::read_dir(ruta) { Ok(d) => d.flatten().map(|e| e.path()).collect(), Err(_) => return };
        hijos.sort();
        for h in hijos { juntar(&h, out); }
        return;
    }
    let n = ruta.to_string_lossy().to_string();
    if n.to_lowercase().ends_with(".lua") {
        if let Ok(b) = std::fs::read(ruta) { out.push((n, b)); }
    } else if n.to_lowercase().ends_with(".gma") {
        if let Ok(b) = std::fs::read(ruta) { if let Some(v) = leer_gma(&b) { for (k, c) in v { out.push((format!("{n}!{k}"), c)); } } }
    }
}

fn parsear(rutas: &[String]) {
    let mut todos = vec![];
    for r in rutas {
        if let Some(l) = r.strip_prefix('@') {
            for x in std::fs::read_to_string(l).unwrap_or_default().lines() { if !x.is_empty() { juntar(Path::new(x), &mut todos); } }
        } else {
            juntar(Path::new(r), &mut todos);
        }
    }
    let mut ok = 0;
    let mut bytes = 0usize;
    let t0 = std::time::Instant::now();
    let mut lua = Estado::nuevo();
    let mut malos = vec![];
    for (n, src) in &todos {
        bytes += src.len();
        // (como gmaCorrer de la web: sin el BOM)
        let src = src.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(src);
        match lua.compilar(src, n) { Ok(_) => ok += 1, Err(e) => malos.push(e.mensaje()) }
    }
    let dt = t0.elapsed();
    for m in &malos { println!("MAL {m}"); }
    println!("compilados {}/{} archivos ({:.1} MB) en {:.0} ms", ok, todos.len(), bytes as f64 / 1e6, dt.as_secs_f64() * 1000.0);
}

/// correr cada archivo con el GMod de mentira (tests/web/stub_gmod.lua): una línea por archivo, como addons_web.js
fn correr_stub(stub: &str, rutas: &[String]) {
    use std::cell::RefCell;
    use std::rc::Rc;
    let stub_src = std::fs::read(stub).unwrap();
    let mut todos = vec![];
    for r in rutas {
        if let Some(l) = r.strip_prefix('@') {
            for x in std::fs::read_to_string(l).unwrap_or_default().lines() { if !x.is_empty() { juntar(Path::new(x), &mut todos); } }
        } else {
            juntar(Path::new(r), &mut todos);
        }
    }
    let t0 = std::time::Instant::now();
    let mut salida: Vec<u8> = vec![];
    for (n, src) in &todos {
        let src = src.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(src);
        let mut lua = Estado::nuevo();
        jxlua::bib::utf8::abrir(&mut lua);
        let f = match lua.compilar(src, n) { Ok(f) => f, Err(e) => { salida.extend_from_slice(b"MAL "); salida.extend_from_slice(&jxlua::bib::js_texto(&e.valor)); salida.push(b'\n'); continue; } };
        let out = Rc::new(RefCell::new(Vec::<Vec<u8>>::new()));
        let o = out.clone();
        lua.set_salida(move |s| o.borrow_mut().push(s.to_vec()));
        lua.set_limite_pasos(1_000_000);
        let r = lua.ejecutar(&stub_src, "stub_gmod.lua").and_then(|_| lua.llamar(&f, &[]));
        match r { Ok(_) => out.borrow_mut().push(b"ok".to_vec()), Err(e) => { let mut m = b"ERROR: ".to_vec(); m.extend(jxlua::bib::js_texto(&e.valor)); out.borrow_mut().push(m); } }
        salida.extend_from_slice(n.as_bytes());
        salida.extend_from_slice(b" => ");
        salida.extend_from_slice(&out.borrow().join(&b" | "[..]));
        salida.push(b'\n');
    }
    use std::io::Write;
    let _ = std::io::stdout().write_all(&salida);
    eprintln!("corridos {} archivos en {:.0} ms", todos.len(), t0.elapsed().as_secs_f64() * 1000.0);
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(|s| s.as_str()) == Some("--parsear") { parsear(&args[1..]); return; }
    if args.first().map(|s| s.as_str()) == Some("--correr-stub") { correr_stub(&args[1], &args[2..]); return; }
    if args.first().map(|s| s.as_str()) == Some("--ops") {
        let src = std::fs::read(&args[1]).unwrap();
        let mut lua = Estado::nuevo();
        match lua.compilar(&src, &args[1]) { Ok(f) => print!("{}", Estado::desensamblar(&f)), Err(e) => println!("ERROR: {}", e) }
        return;
    }
    let tiempo = args.first().map(|s| s.as_str()) == Some("--tiempo");
    let mut todo_bien = true;
    for a in args.iter().skip(if tiempo { 1 } else { 0 }) { todo_bien &= correr(a, tiempo); }
    if !todo_bien { std::process::exit(1); }
}
