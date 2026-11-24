//! Los formatos de Source con los modelos de addons de verdad (JXM_ADDONS: una carpeta con .gma o carpetas de addons;
//! sin ella, la prueba no hace nada)
use jxgmod::formatos as gmf;
use std::collections::HashMap;
use std::rc::Rc;

#[test]
fn modelos_de_addons() {
    let Ok(d) = std::env::var("JXM_ADDONS") else { return };
    let mut arch: HashMap<String, Rc<[u8]>> = HashMap::new();
    for e in std::fs::read_dir(&d).unwrap().flatten() {
        let p = e.path();
        let l = if p.extension().map(|x| x == "gma").unwrap_or(false) { jxgmod::leer_gma(&std::fs::read(&p).unwrap()).unwrap_or_default() } else if p.is_dir() { jxgmod::leer_carpeta(&p) } else { vec![] };
        for (r, b) in l { arch.insert(r.to_lowercase(), Rc::from(b.into_boxed_slice())); }
    }
    // (JXM_VOLCAR: cada .vtf de los addons a PPM para mirarlo)
    if let Ok(dir) = std::env::var("JXM_VOLCAR") {
        for (r, b) in arch.iter().filter(|(r, _)| r.ends_with(".vtf")) {
            let Ok(t) = gmf::vtf(b, 256) else { continue }; let px = gmf::vtf_rgba(&t);
            let mut o = format!("P6 {} {} 255\n", t.w, t.h).into_bytes(); for c in px.chunks_exact(4) { o.extend_from_slice(&c[..3]); }
            let _ = std::fs::write(format!("{dir}/{}.ppm", r.replace('/', "_")), o);
        }
    }
    let mut n = 0;
    let mut rutas: Vec<&String> = arch.keys().filter(|r| r.ends_with(".mdl")).collect(); rutas.sort();
    for r in rutas {
        let base = &r[..r.len() - 4];
        let vtx = arch.get(&format!("{base}.dx90.vtx")).or_else(|| arch.get(&format!("{base}.vtx")));
        let t0 = std::time::Instant::now();
        let m = gmf::mdl(arch[r].clone(), arch.get(&format!("{base}.vvd")).map(|b| &b[..]), vtx.map(|b| &b[..]));
        match m {
            Ok(m) => {
                let tris: usize = m.mallas.iter().map(|x| x.tris.len() / 3).sum();
                let mut texs = vec![];
                for t in &m.texturas { for c in if m.carpetas.is_empty() { vec![String::new()] } else { m.carpetas.clone() } {
                    let rv = format!("materials/{c}{t}.vmt");
                    if let Some(b) = arch.get(&rv) { let v = gmf::vmt(b, &|_| None); let base = v.as_ref().and_then(|v| v.base.clone()).unwrap_or_default();
                        let tx = arch.get(&format!("materials/{base}.vtf")).map(|b| match gmf::vtf(b, 512) { Ok(t) => { let px = gmf::vtf_rgba(&t); format!("{}x{} f{} {}", t.w, t.h, t.fmt, px[0..4].iter().map(|x| x.to_string()).collect::<Vec<_>>().join(",")) } Err(e) => e }).unwrap_or("-".into());
                        texs.push(format!("{t}→{base} [{tx}]")); }
                } }
                let ph = arch.get(&format!("{base}.phy")).map(|b| gmf::phy(b));
                let rp = gmf::pose_reposo(&m);
                let piezas = ph.as_ref().map(|p| gmf::phy_modelo(p, &m, rp.as_ref()).len()).unwrap_or(0);
                let ps = if m.anims.is_empty() { None } else { Some(gmf::pose(&m, 0, 0).ok) };
                println!("{r}: v{} huesos {} vert {} tris {} mats {:?} secs {} anims {} pose0 {:?} phy {} piezas (masa {:?}) reposo {} adj {} · {:.1} ms\n   {}", m.version, m.huesos.len(), m.v.as_ref().map(|v| v.n).unwrap_or(0), tris, m.texturas, m.secuencias.len(), m.anims.len(), ps, piezas, ph.as_ref().and_then(|p| p.masa), rp.is_some(), m.adjuntos.len(), t0.elapsed().as_secs_f64() * 1000.0, texs.join(" | "));
                for (k, s) in m.secuencias.iter().enumerate().take(8) { println!("     sec {k} {} {} anim {} dur {:.2}", s.n, s.act, s.anim, gmf::sec_dur(&m, k, &|_| None)); }
                n += 1;
            }
            Err(e) => println!("{r}: ERROR {e}"),
        }
    }
    assert!(n > 0);
}
