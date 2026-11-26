//! Prueba de SteamPipe nativo (steampipe.rs, zstd.rs): con pedazos reales guardados (DIR/<id>_<k>.enc/.dec/.out/.sha y
//! DIR/<id>.clave, sacados con la web) comprueba el descifrado, la descompresión y el SHA-1. Con --bajar ID SALIDA baja el addon
//! entero (HTTP con curl: sólo para la compu). Uso: steampipe_prueba DIR [--bajar ID SALIDA.gma]
use jxmod::steampipe::{self, Aes, Pedazo, Progreso};
use std::sync::Arc;
use std::time::Instant;

fn curl(url: &str) -> Result<(u16, Vec<u8>), String> {
    let tmp = std::env::temp_dir().join(format!("sp_{}_{}", std::process::id(), std::thread::current().name().unwrap_or("h").len() ^ (url.len() * 31)));
    let tmp = tmp.with_extension(format!("{:x}", url.bytes().fold(0u64, |a, b| a.wrapping_mul(131).wrapping_add(b as u64))));
    let o = std::process::Command::new("curl").args(["-s", "-L", "--max-time", "60", "-o"]).arg(&tmp).args(["-w", "%{http_code}", url]).output().map_err(|e| e.to_string())?;
    let c: u16 = String::from_utf8_lossy(&o.stdout).trim().parse().unwrap_or(0);
    let b = std::fs::read(&tmp).unwrap_or_default(); let _ = std::fs::remove_file(&tmp);
    if c == 0 { return Err("sin respuesta".into()); }
    Ok((c, b))
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let dir = std::path::PathBuf::from(&a[1]);
    let mut ok = 0; let mut mal = 0; let mut ms = 0.0f64; let mut mb = 0.0f64;
    let mut ids: Vec<String> = std::fs::read_dir(&dir).unwrap().filter_map(|e| e.ok()).filter_map(|e| e.file_name().to_str().and_then(|n| n.strip_suffix(".clave")).map(String::from)).collect(); ids.sort();
    for id in ids {
        let clave: [u8; 32] = jxmod::firma::de_hex(std::fs::read_to_string(dir.join(format!("{id}.clave"))).unwrap().trim()).unwrap().try_into().unwrap();
        let aes = Aes::nuevo(&clave);
        for k in 0.. {
            let base = dir.join(format!("{id}_{k}")); let Ok(enc) = std::fs::read(base.with_extension("enc")) else { break };
            let dec = std::fs::read(base.with_extension("dec")).unwrap(); let out = std::fs::read(base.with_extension("out")).unwrap();
            let sha = std::fs::read_to_string(base.with_extension("sha")).unwrap();
            let d = aes.steam(&enc).unwrap(); let des_ok = d == dec;
            let p = Pedazo { sha: sha.trim().into(), off: 0, tam: out.len(), comp: dec.len() };
            let t = Instant::now(); let r = steampipe::pedazo(&enc, &aes, &p); ms += t.elapsed().as_secs_f64() * 1000.0; mb += out.len() as f64 / 1e6;
            let igual = r.as_ref().map(|o| *o == out).unwrap_or(false);
            println!("{id}_{k} ({}): descifrado {} · descomprimido {}", String::from_utf8_lossy(&dec[..4]), if des_ok { "igual" } else { "DISTINTO" }, match &r { Ok(_) if igual => "igual y SHA-1 bien".to_string(), Ok(_) => "DISTINTO".to_string(), Err(e) => format!("ERROR {e}") });
            if des_ok && igual { ok += 1 } else { mal += 1 }
        }
    }
    println!("PEDAZOS: {ok} bien, {mal} mal · {:.0} MB/s (descifrar + descomprimir + SHA-1)", mb / (ms / 1000.0));
    if let Some(i) = a.iter().position(|x| x == "--bajar") {
        let (id, sal) = (&a[i + 1], std::path::PathBuf::from(&a[i + 2]));
        let prog = Arc::new(Progreso::default()); let t = Instant::now();
        let p2 = prog.clone(); let fin = Arc::new(std::sync::atomic::AtomicBool::new(false)); let f2 = fin.clone();
        let mirar = std::thread::spawn(move || { while !f2.load(std::sync::atomic::Ordering::Relaxed) { std::thread::sleep(std::time::Duration::from_millis(5000)); let (h, tt) = (p2.hecho.load(std::sync::atomic::Ordering::Relaxed), p2.total.load(std::sync::atomic::Ordering::Relaxed)); eprintln!("  {:.0}/{:.0} MB", h as f64 / 1e6, tt as f64 / 1e6); } });
        let directo = std::env::var_os("SP_DIRECTO").is_some();
        let mut r = steampipe::bajar(Arc::new(curl), jxmod::comun::gmod_juego::TIENDA_URL, id, &sal, directo, prog);
        // (los que Steam da como archivo directo: por la tienda, en LZMA —como gmod_bajar del juego—)
        if let Err(_) = &r { {
            r = curl(&format!("{}gmod/archivo/{}", jxmod::comun::gmod_juego::TIENDA_URL, id)).and_then(|(c, b)| if c == 200 { Ok(b) } else { Err(format!("HTTP {c}")) })
                .and_then(|b| if b.starts_with(b"GMAD") { Ok(b) } else { jxmod::comun::gmod_juego::lzma(&b) })
                .and_then(|b| std::fs::write(&sal, &b).map(|_| sal.clone()).map_err(|e| e.to_string()));
        } }
        fin.store(true, std::sync::atomic::Ordering::Relaxed); let _ = mirar.join();
        match r { Ok(p) => { let b = std::fs::read(&p).unwrap(); println!("BAJADO {} en {:.0} s · {:.1} MB · empieza con {}", p.display(), t.elapsed().as_secs_f64(), b.len() as f64 / 1e6, String::from_utf8_lossy(&b[..4])); } Err(e) => println!("ERROR al bajar: {e}") }
    }
}
