//! El solver con hilos da lo mismo, bit por bit, que con uno: un paso de verdad guardado (JXF_PASO=<archivo>: cuántos
//! cuerpos, contactos y uniones, dt, subpasos, gravedad y vueltas, y después los tres arreglos, todo en f64 little endian)
//! o, si no hay, cajas en columnas armadas acá; y cuánto tarda cada uno.
use jxfisica::{paso_con, Equipo, CO, CU, UN};
use std::time::Instant;

/// (cuerpos, contactos, uniones, dt, subpasos, gravedad, vueltas de velocidades)
type Paso = (Vec<f64>, Vec<f64>, Vec<f64>, f64, usize, f64, usize);
fn leer(ruta: &str) -> Option<Paso> {
    let b = std::fs::read(ruta).ok()?; let f: Vec<f64> = b.chunks_exact(8).map(|c| f64::from_le_bytes(c.try_into().unwrap())).collect();
    let (nb, nc, nu) = (f[0] as usize, f[1] as usize, f[2] as usize); let o = 7;
    Some((f[o..o + nb * CU].to_vec(), f[o + nb * CU..o + nb * CU + nc * CO].to_vec(), f[o + nb * CU + nc * CO..o + nb * CU + nc * CO + nu * UN].to_vec(), f[3], f[4] as usize, f[5], f[6] as usize))
}
/// cajas de 1 m en 12 columnas de 8 (cada columna, una isla), apenas metidas una en otra, con sus contactos de cara (4 por
/// par), unas que se rozan de costado (de a dos columnas: la misma isla) y una cadena de 6 colgada de la última (uniones)
fn pila() -> Paso {
    let (mut cu, mut co, mut un) = (vec![], vec![], vec![]);
    let caja = |cu: &mut Vec<f64>, p: [f64; 3], m: f64| {
        let mut c = vec![0.0; CU]; c[0] = p[0]; c[1] = p[1]; c[2] = p[2]; c[6] = 1.0; c[13] = p[0]; c[14] = p[1]; c[15] = p[2]; c[19] = 1.0;
        if m > 0.0 { c[20] = 1.0 / m; for k in 21..24 { c[k] = 6.0 / m; } c[24] = 1.0; } c[25] = 0.6; c[26] = 0.15; cu.extend(c);
    };
    let mut k = 0usize;
    for col in 0..12 { for f in 0..8 {
        caja(&mut cu, [col as f64 * 1.02 + f as f64 * 0.01, 0.499 + f as f64 * 0.998, (col % 3) as f64 * 0.01], 10.0);
        for (x, z) in [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)] {
            let mut c = vec![0.0; CO]; c[0] = k as f64; c[3] = x; c[4] = -0.5; c[5] = z; c[10] = 1.0; c[12] = 0.002;
            if f == 0 { c[1] = -1.0; c[2] = 1.0; c[6] = col as f64 * 1.02 + x; c[7] = 0.0; c[8] = z; } else { c[1] = (k - 1) as f64; c[6] = x; c[7] = 0.5; c[8] = z; }
            co.extend(c);
        }
        if col % 2 == 1 { let mut c = vec![0.0; CO]; c[0] = k as f64; c[1] = (k - 8) as f64; c[3] = -0.5; c[6] = 0.5; c[9] = 1.0; c[12] = -0.01; co.extend(c); }
        k += 1;
    } }
    let mut ant = k - 1;
    for e in 0..6 { caja(&mut cu, [9.0 * 1.02 + 0.6 + e as f64 * 0.4, 8.0, 0.0], 1.0);
        let mut u = vec![0.0; UN]; u[0] = ant as f64; u[1] = k as f64; u[2] = 0.5; u[5] = -0.2; u[8] = 1.0; u[11] = 1.0; u[15] = 1.0; u[18] = 1.0; u[26] = 0.8; u[27] = 0.5; un.extend(u); ant = k; k += 1; }
    (cu, co, un, 1.0 / 60.0, 10, 1.0, 2)
}

#[test]
fn hilos_igual_que_uno() {
    let (cu0, co0, un0, dt, sub, gs, vi) = std::env::var("JXF_PASO").ok().and_then(|r| leer(&r)).unwrap_or_else(pila);
    println!("{} cuerpos, {} contactos, {} uniones, {} subpasos", cu0.len() / CU, co0.len() / CO, un0.len() / UN, sub);
    let correr = |eq: Option<&Equipo>| { let (mut cu, mut co) = (cu0.clone(), co0.clone()); let t = Instant::now(); let g = paso_con(&mut cu, &mut co, &un0, dt, sub, gs, vi, eq, 0); (cu, co, g, t.elapsed().as_secs_f64() * 1000.0) };
    let r1 = correr(None);
    let veces: usize = std::env::var("JXF_VECES").ok().and_then(|s| s.parse().ok()).unwrap_or(3);
    for h in [2usize, 3, 4] {
        let eq = Equipo::nuevo(h); let mut ms = vec![]; let mut ms1 = vec![];
        for _ in 0..veces {
            let r = correr(Some(&eq)); ms.push(r.3); ms1.push(correr(None).3);
            let igual = r.0.iter().zip(&r1.0).all(|(a, b)| a.to_bits() == b.to_bits()) && r.1.iter().zip(&r1.1).all(|(a, b)| a.to_bits() == b.to_bits()) && r.2 == r1.2;
            assert!(igual, "{h} hilos: distinto de uno solo");
        }
        let med = |v: &mut Vec<f64>| { v.sort_by(|a, b| a.partial_cmp(b).unwrap()); v[v.len() / 2] };
        println!("{h} hilos: {:.3} ms (uno solo: {:.3} ms), igual bit por bit", med(&mut ms), med(&mut ms1));
    }
}
