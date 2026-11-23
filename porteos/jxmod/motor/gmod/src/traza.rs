//! El guion de las pruebas de trazas (el mismo de tests/web/traza_web.js): el jugador aparece, se ponen las entidades
//! del addon, saca cada arma (ataque primario, secundario, recarga) y corren los cuadros con el juego de mentira.

use crate::prueba::*;
use crate::*;
use std::time::Instant;

fn prueba(gm: &Gmod) -> &'static mut AnfitrionPrueba {
    // (el anfitrión vive lo que vive el Gmod: se devuelve con su vida para anotar desde acá)
    gm.anfitrion(|h| { let p = h.como_any().unwrap().downcast_mut::<AnfitrionPrueba>().unwrap() as *mut AnfitrionPrueba; unsafe { &mut *p } })
}

/// los archivos de un addon (.gma o carpeta)
pub fn leer(f: &str) -> Option<Vec<(String, Vec<u8>)>> {
    let p = std::path::Path::new(f);
    if p.is_dir() { Some(leer_carpeta(p)) } else { leer_gma(&std::fs::read(p).ok()?) }
}

fn foto(p: &mut AnfitrionPrueba) -> Vec<(String, String)> {
    let j = p.jug.clone();
    let mut f = vec![
        ("jug.pos".into(), fmt_v(j.pos)), ("jug.vel".into(), fmt_v(j.vel)), ("jug.vida".into(), fmt_n(j.vida)), ("jug.vivo".into(), fmt_b(j.vivo)),
        ("jug.yaw".into(), fmt_n(j.yaw)), ("jug.pitch".into(), fmt_n(j.pitch)), ("jug.congelado".into(), fmt_b(j.congelado)), ("jug.bloqueado".into(), fmt_b(j.bloqueado)),
        ("jug.vel_max".into(), fmt_n(j.vel_max)), ("jug.salto".into(), fmt_n(j.salto)), ("jug.fpVeh".into(), fmt_b(j.fp_veh)), ("jug.suelo".into(), fmt_b(j.suelo)),
        ("cam.temblor".into(), fmt_n(p.cam.temblor)),
        ("arm.lista".into(), format!("[{}]", p.armas.lista.iter().map(|x| fmt_s(x)).collect::<Vec<_>>().join(","))),
        ("arm.i".into(), p.armas.i.to_string()),
    ];
    for (id, b) in &p.cuerpos {
        f.push((format!("o#{}", id), format!("{} {} {} {} {} {} {}", fmt_v(b.pos), fmt_q(b.q), fmt_v(b.vel), fmt_v(b.ang), fmt_n(b.masa), fmt_b(b.congelado), fmt_b(b.oculto))));
    }
    f
}
fn cambios(p: &mut AnfitrionPrueba, ant: &mut Vec<(String, String)>) {
    let f = foto(p);
    for (k, v) in &f { if ant.iter().find(|x| &x.0 == k).map(|x| &x.1) != Some(v) { p.l("cambio", &[fmt_s(&format!("{} {}", k, v))]); } }
    for (k, _) in ant.iter() { if !f.iter().any(|x| &x.0 == k) { p.l("cambio", &[fmt_s(&format!("{} -", k))]); } }
    *ant = f;
}

/// corre el guion con los addons dados (nombre, archivos) y devuelve la traza (o, con `tiempo`, los ms de cada cuadro)
pub fn correr(addons: Vec<(String, Vec<(String, Vec<u8>)>)>, ticks: u32, tiempo: bool, api: bool, nid: bool) -> (String, Vec<f64>, f64) {
    let args: Vec<String> = [if api { "--api" } else { "" }, if nid { "--nid" } else { "" }].iter().filter(|x| !x.is_empty()).map(|x| x.to_string()).collect();
    let fuentes: Vec<String> = addons.iter().map(|x| x.0.clone()).collect();
    let mut arch_de: Vec<Option<Vec<(String, Vec<u8>)>>> = addons.into_iter().map(|x| Some(x.1)).collect();
    let mut gm = Gmod::nuevo_con(Box::new(AnfitrionPrueba::nuevo()), Some(0x2545_f491_4f6c_dd1d ^ 0x5eed));
    let p = prueba(&gm);
    p.anotar = !tiempo;
    if args.iter().any(|a| a == "--api") {
        let pp = p as *mut AnfitrionPrueba;
        gm.anotar_api(std::rc::Rc::new(move |s: String| { let p = unsafe { &mut *pp }; if p.anotar { let c = p.cuadro.clone(); p.traza.push(format!("{} {}", c, s)); } }));
    }
    let t0 = Instant::now();
    let mut idx = Vec::new();
    let mut con_lua = true;
    for (i, f) in fuentes.iter().enumerate() {
        let arch = arch_de[i].take().unwrap_or_default();
        let nom = std::path::Path::new(f).file_name().map(|x| x.to_string_lossy().into_owned()).unwrap_or_default();
        let ad = Addon::de_archivos(if fuentes.len() == 1 { "addon" } else { &nom }, &nom, arch);
        if idx.is_empty() { con_lua = !ad.lua.is_empty(); }
        idx.push(gm.montar(ad));
    }
    let t_montar = t0.elapsed();
    let (sweps, sents) = (gm.sweps(idx[0]), gm.sents(idx[0]));
    let lista = |v: &[String]| format!("[{}]", v.iter().map(|x| fmt_s(x)).collect::<Vec<_>>().join(","));
    // (un addon sin Lua: la web no llega a armar sus listas)
    if con_lua { p.l("montado", &[gm.lua_corridos(idx[0]).to_string(), lista(&sweps), lista(&sents)]); } else { p.l("montado", &["0".into(), "nil".into(), "nil".into()]); }
    let mut ant = foto(p);
    cambios(p, &mut ant);
    let sents: Vec<String> = sents.into_iter().take(6).collect();
    let v = 10.max((ticks.saturating_sub(10)) / 1.max(sweps.len() as u32));
    let mut tiempos = Vec::new();
    for k in 1..=ticks {
        p.cuadro = k.to_string();
        p.t = k as f64 / 60.0;
        p.dt = 1.0 / 60.0;
        p.ent.disparo = false;
        p.ent.disparo2 = false;
        p.ent.teclas.clear();
        let tc = Instant::now();
        if k >= 2 && ((k - 2) as usize) < sents.len() { gm.spawn_menu(&format!("gment:{}", sents[(k - 2) as usize])); }
        if k >= 10 {
            let (j, r) = ((k - 10) / v, (k - 10) % v);
            if (j as usize) < sweps.len() {
                if r == 0 { gm.spawn_menu(&format!("gmswep:{}", sweps[j as usize])); }
                else if r >= 2 && r < 2 + v / 3 { p.ent.disparo = true; }
                else if r >= 2 + v / 3 && r < 2 + (2 * v) / 3 { p.ent.disparo2 = true; }
                else if r == v - 2 { p.ent.teclas.push("KeyR".into()); }
            }
        }
        gm.paso(1.0 / 60.0, &[]);
        gm.hud();
        tiempos.push(tc.elapsed().as_secs_f64() * 1000.0);
        if !tiempo { cambios(p, &mut ant); }
        if args.iter().any(|a| a == "--nid") { let n = gm.nid(); p.l("nid", &[n.to_string()]); }
    }
    let mut s = if tiempo { String::new() } else { p.traza.join("\n") };
    if !tiempo { s.push('\n'); }
    (s, tiempos, t_montar.as_secs_f64() * 1000.0)
}
