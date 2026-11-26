//! Lo de nucleares.js que no depende del juego: el radio de cada bomba según su potencia (crece con la raíz cúbica: 15 kt
//! ≈ 40 m, 1 Mt ≈ 160 m, 50 Mt ≈ 590 m), cuánto encandila el destello, el sonido del estruendo, el empujón del viento a lo
//! suelto, los carteles de la bola de fuego, el polvo y el hongo (nukeCarteles: calculados del tiempo, no partículas) y
//! el soplido del viento (ruido filtrado que sube, ruge y se va). Las mismas cuentas que la web (las pruebas de abajo).
use serde_json::Value;

#[inline] fn clamp(x: f64, a: f64, b: f64) -> f64 { if x < a { a } else if x > b { b } else { x } }

/// una bomba (DATA.pf[k][0].nk): nombre, potencia en kilotones, país, año y tipo (aire, bomba, misil, ficcion, torre,
/// suelo, barco, artilleria, agua, subte, espacio)
#[derive(Clone, Debug)]
pub struct Bomba { pub n: String, pub kt: f64, pub p: String, pub a: i64, pub t: String }
impl Bomba {
    /// de los datos del prefab (el primer nodo); None si no es una nuclear
    pub fn de(arb0: &Value) -> Option<Bomba> {
        let x = &arb0["nk"]; if !x.is_object() { return None; }
        Some(Bomba { n: x["n"].as_str().unwrap_or("").to_string(), kt: x["kt"].as_f64().unwrap_or(1.0), p: x["p"].as_str().unwrap_or("").to_string(), a: x["a"].as_i64().unwrap_or(0), t: x["t"].as_str().unwrap_or("suelo").to_string() })
    }
    /// nukeFicha: «Trinity (Gadget) · EE. UU. 1945 · 25 kt»
    pub fn ficha(&self) -> String { format!("{} · {} {} · {}", self.n, self.p, if self.a > 0 { self.a.to_string() } else { String::new() }, potencia(self.kt)) }
}
/// nukeRadio: el radio de la bola y del daño, en metros
pub fn radio(kt: f64) -> f64 { clamp(16.0 * kt.max(0.001).cbrt(), 6.0, 700.0) }
/// (+x.toFixed(n): el número redondeado, sin ceros de más)
fn fijo(x: f64, n: i32) -> String { let k = 10f64.powi(n); let v = (x * k).round() / k; let s = format!("{v}"); s }
/// nukePot: «15 kt», «1.2 Mt», «500 t»
pub fn potencia(kt: f64) -> String {
    if kt >= 1000.0 { format!("{} Mt", fijo(kt / 1000.0, if kt >= 10000.0 { 0 } else { 1 })) }
    else if kt >= 1.0 { format!("{} kt", fijo(kt, if kt >= 10.0 { 0 } else { 1 })) }
    else { format!("{} t", (kt * 1000.0).round()) }
}
/// en el aire (la bola no toca el piso)
pub fn en_aire(t: &str) -> bool { matches!(t, "aire" | "bomba" | "misil" | "ficcion") }
/// las de superficie dejan radiación
pub fn deja_radiacion(t: &str) -> bool { matches!(t, "suelo" | "torre" | "barco" | "artilleria") }
/// nukeDestello: cuánto encandila (1,35 a menos de 4 radios; baja con la distancia, 0,4 como mínimo; si no la mirás, un 35 %)
pub fn destello(d: f64, r: f64, mira: f64, tipo: &str) -> f64 {
    let k = clamp(1.35 - 0.3 * (1.0 + d / (r * if tipo == "espacio" { 30.0 } else { 4.0 })).log2(), 0.4, 1.35);
    k * (0.35 + 0.65 * clamp((mira + 0.2) / 0.8, 0.0, 1.0))
}
/// el estruendo que le toca (nukeSonido)
pub fn estruendo(kt: f64, tipo: &str) -> &'static str {
    if tipo == "subte" { "NK_onda" } else if kt < 1.0 { "NK_davy" } else if kt < 60.0 { if tipo == "torre" { "NK_trinity" } else if kt < 20.0 { "NK_abomb" } else { "NK_fat" } }
    else if kt < 1000.0 { "NK_abomb_big" } else if kt < 20000.0 { "NK_real" } else { "NK_tsar" }
}

/// una que explotó (E de nukeExplotar): dónde (ya a su altura), el piso debajo, la bomba, el radio, cuánto lleva y dura,
/// hasta dónde llegó la onda, su velocidad y el alcance del daño
#[derive(Clone, Debug)]
pub struct Explosion { pub p: [f64; 3], pub piso: f64, pub kt: f64, pub r: f64, pub tipo: String, pub t: f64, pub dura: f64, pub onda: f64, pub vel: f64, pub alc: f64, pub seed: f64 }
impl Explosion {
    /// nukeExplotar (lo de los números): `p0` la bomba, `piso` el piso debajo (None: no hay); `n` el número de explosión
    pub fn nueva(p0: [f64; 3], piso: Option<f64>, kt: f64, tipo: &str, n: u32) -> Explosion {
        let r = radio(kt); let mut p = p0;
        let piso = match piso { Some(y) if y <= p0[1] + 1.5 => y, _ => p[1] - 1.0 };
        if en_aire(tipo) { p[1] = p[1].max(piso + r * 0.45); }
        if tipo == "espacio" { p[1] = piso + (250.0f64).max(r * 3.0); }
        Explosion { p, piso, kt, r, tipo: tipo.to_string(), t: 0.0, dura: if tipo == "subte" { 25.0 } else { 150.0 }, onda: 0.0, vel: (70.0f64).max(r * 1.7), alc: r * 2.3, seed: n as f64 * 977.0 }
    }
    /// nukeAzar: un número de 0 a 1 fijo para cada cartel
    pub fn azar(&self, i: f64) -> f64 { let x = ((self.seed + i) * 12.9898).sin() * 43758.5453; x - x.floor() }
    /// el empujón del viento a una cosa suelta y liviana (hasta 300 kg) a `l` metros (nukeVientoCosa)
    pub fn viento_cosa(&self, dinamico: bool, masa: f64, l: f64) -> f64 {
        if self.tipo == "espacio" || self.tipo == "subte" || !dinamico || masa > 300.0 { return 0.0; }
        9.0 * clamp(1.0 - l / (self.alc * 3.0), 0.0, 1.0) * (120.0 / masa + 0.2).min(1.0)
    }
    /// nukeCarteles: los carteles de este momento (x, y, z, r, g, b, alfa, tamaño, suma), con `part` la cantidad de
    /// partículas de la calidad (GFX.part)
    pub fn carteles(&self, part: f64, out: &mut Vec<[f64; 9]>) {
        let (t, r, p, piso) = (self.t, self.r, self.p, self.piso); let pocos = part < 0.5; let mas = if part >= 1.0 { 1.4 } else { 1.0 };
        let fin = clamp((self.dura - t) / 20.0, 0.0, 1.0); let pi = std::f64::consts::PI;
        let mut pon = |x: f64, y: f64, z: f64, s: f64, c: [f64; 3], a: f64, suma: bool| out.push([x, y, z, c[0], c[1], c[2], a * fin, s, if suma { 1.0 } else { 0.0 }]);
        let fuego = |k: f64| if k < 0.15 { [1.0, 0.95, 0.8] } else if k < 0.5 { [1.0, 0.7, 0.3] } else { [1.0, 0.42, 0.12] };
        let rnd = |n: f64| (n + 0.5).floor();
        if self.tipo == "espacio" {
            // una esfera que se agranda y se apaga en el cielo
            let rr = r * 2.5 * (1.0 - (-t * 0.8).exp()); let a = clamp(1.0 - t / 25.0, 0.0, 1.0); let n = if pocos { 18 } else { 36 };
            for i in 0..n { let u = self.azar(i as f64) * pi * 2.0; let w = (2.0 * self.azar(i as f64 + 99.0) - 1.0).acos(); pon(p[0] + rr * w.sin() * u.cos(), p[1] + rr * w.cos(), p[2] + rr * w.sin() * u.sin(), r * 0.6, [0.6, 0.85, 1.0], a * 0.5, true); }
            pon(p[0], p[1], p[2], r * 1.2 * (1.0 - (-t * 3.0).exp()), [1.0, 1.0, 1.0], clamp(1.0 - t / 4.0, 0.0, 1.0), true);
            return;
        }
        // bola de fuego (suma luz): crece rápido, sube un poco y se apaga en ~10 s
        if self.tipo != "subte" {
            let rf = r * 0.38 * (1.0 - (-t * 6.0).exp()); let sube = if t > 0.6 { (t - 0.6) * r * 0.05 } else { 0.0 }; let k = clamp(t / 10.0, 0.0, 1.0); let a = clamp(1.4 - t / 8.0, 0.0, 1.0); let c = fuego(k);
            let n = if pocos { 6 } else { rnd(12.0 * mas) as i32 };
            for i in 0..n { let u = self.azar(i as f64) * pi * 2.0; let w = (2.0 * self.azar(i as f64 + 50.0) - 1.0).acos(); let rr = rf * 0.55; pon(p[0] + rr * w.sin() * u.cos(), p[1] + sube + rr * w.cos(), p[2] + rr * w.sin() * u.sin(), rf * 1.1, c, a, true); }
            pon(p[0], p[1] + sube, p[2], rf * 1.8, [1.0, 0.9, 0.7], clamp(1.0 - t / 2.5, 0.0, 1.0), true);
        }
        // el polvo que levanta la onda en el piso (marrón; en el agua, blanco)
        let agua = self.tipo == "agua" || self.tipo == "barco"; let nd = if pocos { 12 } else { rnd(26.0 * mas) as i32 };
        let rs = (self.alc * 0.85).min(self.onda * 0.95); let ad = clamp(1.0 - (t - 4.0) / 14.0, 0.0, 0.8);
        for i in 0..nd { let u = (i as f64 / nd as f64) * pi * 2.0 + self.azar(i as f64 + 200.0) * 0.3; pon(p[0] + u.cos() * rs, piso + r * 0.06, p[2] + u.sin() * rs, r * 0.32, if agua { [0.85, 0.87, 0.9] } else { [0.45, 0.38, 0.3] }, ad, false); }
        if self.tipo == "subte" {
            // subterránea: una cúpula de polvo que se levanta y cae
            let h = r * 0.5 * (t * 0.6).min(pi).sin(); let n = if pocos { 10 } else { 20 };
            for i in 0..n { let u = self.azar(i as f64) * pi * 2.0; let rr = r * 0.4 * self.azar(i as f64 + 7.0); pon(p[0] + u.cos() * rr, piso + h * self.azar(i as f64 + 30.0), p[2] + u.sin() * rr, r * 0.3, [0.5, 0.42, 0.33], clamp(1.0 - t / 22.0, 0.0, 0.8), false); }
            return;
        }
        // el hongo: el tallo y el sombrero (un anillo que rueda), que sube y se queda; iluminado de naranja al principio
        let hh = clamp(r * 1.6 + 25.0, 30.0, 900.0) * if agua { 0.7 } else { 1.0 };
        let hc = (if en_aire(&self.tipo) { p[1] - piso } else { 0.0 }) * 0.3 + hh * (1.0 - (-t / 5.0).exp()); let y0 = piso;
        let luz = clamp(1.0 - t / 14.0, 0.0, 1.0); let gris = if agua { [0.92, 0.93, 0.95] } else { [0.5, 0.45, 0.4] };
        let col = |k: f64| [gris[0] + (1.0 - gris[0]) * luz * k, gris[1] + (0.55 - gris[1]) * luz * k, gris[2] + (0.25 - gris[2]) * luz * k];
        let ns = if pocos { 8 } else { rnd(16.0 * mas) as i32 }; let at = clamp(t / 1.5, 0.0, 0.85);
        for i in 0..ns { let k = i as f64 / (ns - 1) as f64; let y = y0 + k * hc * 0.92; let rr = r * (0.1 + 0.06 * (1.0 - k));
            pon(p[0] + (self.azar(i as f64 + 300.0) - 0.5) * rr, y, p[2] + (self.azar(i as f64 + 330.0) - 0.5) * rr, r * (0.2 + 0.12 * (1.0 - k)), col(0.6 + 0.4 * k), at, false); }
        let rm_ = r * 0.42 * (0.55 + 0.45 * (1.0 - (-t / 4.0).exp())); let rm = r * 0.3; let nc = if pocos { 22 } else { rnd(54.0 * mas) as i32 }; let rueda = t * 0.25;
        for i in 0..nc {
            let u = (i as f64 / nc as f64) * pi * 2.0 * 3.0 + self.azar(i as f64 + 400.0) * 0.6; let w = self.azar(i as f64 + 450.0) * pi * 2.0 + rueda; let rr = rm_ + w.cos() * rm;
            pon(p[0] + u.cos() * rr, y0 + hc + w.sin() * rm * 0.8, p[2] + u.sin() * rr, rm * 1.15, col(if w.sin() < 0.0 { 1.0 } else { 0.5 }), at, false);
        }
        // abajo del sombrero, el resplandor de la bola (los primeros segundos)
        if luz > 0.05 { pon(p[0], y0 + hc - rm * 0.4, p[2], rm_ * 1.6, [1.0, 0.5, 0.15], luz * 0.5, true); }
    }
}
/// el soplido de la ráfaga (nukeSoplido): ruido (rojo) por un pasabajos que sube de 250 a 1400 Hz en 0,2 s y baja a 320 al
/// final, con el volumen que sube en 0,15 s y se apaga; mono a `sr`. `k` la fuerza (0 a 1), `dura` cuánto dura la ráfaga
pub fn soplido(k: f64, dura: f64, sr: f64, semilla: u32) -> Vec<f32> {
    let n = (sr * (dura + 0.8).min(7.0 + 0.8)) as usize; let mut s = semilla.max(1);
    let mut az = || { s ^= s << 13; s ^= s >> 17; s ^= s << 5; s as f64 / 4294967296.0 };
    let v = clamp(0.25 + 0.75 * k, 0.1, 1.0); let mut ult = 0.0;
    let (mut x1, mut x2, mut y1, mut y2) = (0.0, 0.0, 0.0, 0.0); let q = 0.8;
    let rampa = |a: f64, b: f64, t: f64, t0: f64, t1: f64| if t <= t0 { a } else if t >= t1 { b } else { a * (b / a).powf((t - t0) / (t1 - t0)) };
    (0..n).map(|i| {
        let t = i as f64 / sr;
        ult = ult * 0.97 + (az() * 2.0 - 1.0) * 0.03; let x = ult * 9.0;
        let f = if t < 0.2 { rampa(250.0, 1400.0, t, 0.0, 0.2) } else { rampa(1400.0, 320.0, t, 0.2, dura) };
        let g = if t < 0.15 { rampa(0.0001, v, t, 0.0, 0.15) } else { rampa(v, 0.0001, t, 0.15, dura + 0.6) };
        // (el pasabajos de WebAudio: el biquad de la receta de RBJ)
        let w0 = 2.0 * std::f64::consts::PI * f / sr; let al = w0.sin() / (2.0 * q); let c = w0.cos(); let a0 = 1.0 + al;
        let (b0, b1, b2, a1, a2) = ((1.0 - c) / 2.0 / a0, (1.0 - c) / a0, (1.0 - c) / 2.0 / a0, -2.0 * c / a0, (1.0 - al) / a0);
        let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y;
        (y * g).clamp(-1.0, 1.0) as f32
    }).collect()
}

/// el hongo con volumen (nuclear_vol.js): el del tráiler es una de R ≈ 260 m; todo se mide en «metros del tráiler» (R / 260)
pub const NV_R0: f64 = 260.0;
/// las que hacen hongo con volumen (la subterránea y la del espacio siguen con los carteles)
pub fn nv_tipo(t: &str) -> bool { matches!(t, "aire" | "bomba" | "misil" | "ficcion" | "torre" | "suelo" | "artilleria" | "agua" | "barco") }
/// la forma del hongo en un momento (nvEstado): la escala, el sombrero (altura, radio del anillo, grosor, giro), el tallo
/// (radio abajo, arriba, alto, corrimiento), la falda de polvo (radio, alto, ancho, cuánto hay), el fuego (brillo, color,
/// cuánto se enfrió, la luz que da), las densidades (sombrero, tallo, falda, cuánto subió el tallo) y la caja (radio, alto)
#[derive(Clone, Debug)]
pub struct NvEstado { pub s: f64, pub cap: [f64; 4], pub tallo: [f64; 4], pub falda: [f64; 4], pub fuego_v: [f64; 4], pub dens: [f64; 4], pub caja: [f64; 2], pub agua: bool }
impl Explosion {
    /// nvEstado: la forma del tráiler, a la escala de esta bomba (las grandes, más despacio)
    pub fn nv_estado(&self) -> NvEstado {
        let e = f64::exp; let sv = |x: f64| x * x * (3.0 - 2.0 * x); let tr = |t: f64, a: f64, b: f64| clamp((t - a) / (b - a), 0.0, 1.0); let mx = |a: f64, b: f64, k: f64| a + (b - a) * k;
        let s = self.r / NV_R0; let ts = 1.5 * clamp(s.powf(0.35), 0.6, 1.9); let tau = self.t / ts;
        let aire = en_aire(&self.tipo); let agua = self.tipo == "agua" || self.tipo == "barco";
        // (en el aire: la bola nace a su altura —en metros del tráiler— y el tallo tarda en subir del piso)
        let hb = if aire { ((self.p[1] - self.piso) / s - 25.0).max(0.0) } else { 0.0 }; let tallo0 = if aire { 1.2 } else { 0.0 };
        let rf = 95.0 * (1.0 - e(-tau * 4.0));
        let h = 25.0 + hb + if tau > 0.15 { 430.0 * (1.0 - e(-(tau - 0.15) / 2.4)) } else { 0.0 };
        let m = sv(tr(tau, 0.45, 2.6));
        let rm = m * 140.0 * (1.0 - e(-tau / 2.5));
        let rn = mx(rf, 58.0 + 30.0 * (1.0 - e(-tau / 3.0)), m).max(1.0);
        let top = (h - 0.4 * rn).min(160.0 * (tau - 0.4 - tallo0).max(0.0));
        let rb = 30.0 + 400.0 * (1.0 - e(-tau / 2.2)); let hb2 = 12.0 + 30.0 * (1.0 - e(-tau / 2.0)); let wb = 40.0 + 50.0 * (1.0 - e(-tau / 3.0));
        // (el fuego dura más que en el tráiler: en el juego se lo mira un rato)
        let mut fuego = 60.0 * e(-tau * 3.5) + 8.0 * e(-tau * 0.6) + 2.0 * e(-tau / 5.0); if agua { fuego *= 0.55; }
        // (se va: en los últimos 40 s se adelgaza; el polvo del piso y el tallo se van mucho antes que el sombrero)
        let fin = clamp((self.dura - self.t) / 40.0, 0.0, 1.0);
        let sz = s.max(0.05).sqrt(); let fin_f = 1.0 - sv(tr(self.t, 8.0 + 6.0 * sz, 25.0 + 20.0 * sz)); let fin_t = 1.0 - sv(tr(self.t, 40.0 + 20.0 * sz, 80.0 + 30.0 * sz));
        NvEstado {
            s, cap: [h, rm, rn, (self.seed % 7.0) + 0.33 * tau],
            tallo: [28.0 + 14.0 * (1.0 - e(-tau / 3.0)), 20.0 + 14.0 * (1.0 - e(-tau / 3.0)), top.max(1.0), 32.0 * tau],
            falda: [rb, hb2, wb, sv(tr(tau, 0.1, 0.6)) * (1.0 - 0.4 * sv(tr(tau, 4.0, 8.0))) * if aire { 0.7 } else { 1.0 } * (0.55 + 0.45 * fin_f)],
            fuego_v: [fuego, 0.25 + 0.8 * e(-tau * 1.4), sv(tr(tau, 0.15, 1.5)), fuego * 0.12],
            dens: [0.1 * fin, 0.06 * fin * fin_t, 0.04 * fin * fin_f, sv(tr(tau, 0.4 + tallo0, 1.2 + tallo0))],
            caja: [(rb + 30.0).max(rm + rn * 1.4 + 40.0), h + rn * 1.6 + 40.0], agua,
        }
    }
    /// el bloque del hongo para el motor (EF_HONGO): el origen (x, piso, z), la escala, el sombrero, el tallo, la falda, el
    /// fuego, las densidades, la caja, la semilla y si es en el agua (28 números); None si ésta no hace hongo o ya terminó
    pub fn nv_bloque(&self) -> Option<Vec<f32>> {
        if !nv_tipo(&self.tipo) || self.t > self.dura { return None; }
        let n = self.nv_estado(); let mut b = vec![self.p[0], self.piso, self.p[2], n.s];
        for a in [n.cap, n.tallo, n.falda, n.fuego_v, n.dens] { b.extend_from_slice(&a); }
        b.extend_from_slice(&[n.caja[0], n.caja[1], (self.seed % 977.0) * 7.31, if n.agua { 1.0 } else { 0.0 }]);
        Some(b.into_iter().map(|x| x as f32).collect())
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    /// los números de la web (nucleares.js en node, /tmp/claude-0/jugabilidad/nuk_ref.js)
    #[test]
    fn como_la_web() {
        assert!((radio(15.0) - 39.45939318928752).abs() < 1e-9 && (radio(1000.0) - 160.0).abs() < 1e-9 && (radio(50000.0) - 589.4450397824619).abs() < 1e-9, "{} {}", radio(15.0), radio(50000.0));
        assert_eq!(potencia(25.0), "25 kt"); assert_eq!(potencia(1200.0), "1.2 Mt"); assert_eq!(potencia(0.02), "20 t"); assert_eq!(potencia(2.5), "2.5 kt"); assert_eq!(potencia(50000.0), "50 Mt");
        assert!((destello(300.0, 60.0, 0.4, "suelo") - 0.8366813433876192).abs() < 1e-12, "{}", destello(300.0, 60.0, 0.4, "suelo"));
        let mut e = Explosion::nueva([10.0, 5.0, -3.0], Some(4.0), 1000.0, "suelo", 3); e.t = 7.5; e.onda = 300.0;
        let mut l = vec![]; e.carteles(1.0, &mut l);
        assert_eq!(l.len(), 153);
        let r = [l[0][0], l[20][1], l[60][2], l[146][7], l[100][3], l[100][6], l[5][0], l[140][1]];
        let w = [-20.982150309281433, 13.6, -0.3249048102713594, 55.199999999999996, 0.6160714285714286, 0.85, -16.53475664135367, 204.64440842768641];
        for k in 0..8 { assert!((r[k] - w[k]).abs() < 1e-9, "{k}: {} {}", r[k], w[k]); }
        let mut e2 = Explosion::nueva([0.0, 80.0, 0.0], Some(0.0), 1000.0, "aire", 3); e2.p = [0.0, 80.0, 0.0]; e2.t = 2.0; e2.onda = 300.0;
        let mut l2 = vec![]; e2.carteles(0.25, &mut l2); assert_eq!(l2.len(), 50);
        let r2 = [l2[0][0], l2[3][1], l2[20][7], l2[30][6]]; let w2 = [-30.981959948370775, 122.85985735086963, 48.45714285714286, 0.85];
        for k in 0..4 { assert!((r2[k] - w2[k]).abs() < 1e-9, "aire {k}: {} {}", r2[k], w2[k]); }
    }
    /// el hongo con volumen: los números de nvEstado (nuclear_vol.js en node)
    #[test]
    fn hongo_como_la_web() {
        let casos: [(f64, f64, &str, f64, f64, f64, [f64; 23]); 3] = [
            (160.0, 7.5, "suelo", 5.0, 4.0, 3.0 * 977.0, [0.6153846153846154, 416.25202314881415, 126.91843450999083, 83.83868117185449, 6.955611678318242, 40.058051213532096, 32.058051213532096, 382.7165506800724, 189.63507183692045, 402.9473613025378, 40.450163588784086, 83.06446861975746, 0.8110805551514283, 0.8398590826702137, 0.2501995036663359, 1.0, 0.10078308992042564, 0.1, 0.06, 0.04, 1.0, 432.9473613025378, 590.3939130237814]),
            (300.0, 30.0, "aire", 150.0, 0.0, 5.0 * 977.0, [1.1538461538461537, 559.8346929396728, 139.93057747650465, 87.94712323362631, 12.277578731069077, 41.975324175692286, 33.975324175692286, 524.6558436462223, 608.7349072551833, 429.92972492625177, 41.99778008316209, 89.91187205604388, 0.32960679549382627, 0.04462484761608519, 0.25000000000217215, 1.0, 0.005354981713930223, 0.1, 0.06, 0.020869163067476465, 1.0, 459.92972492625177, 740.5500901134749]),
            (60.0, 120.0, "agua", 1.0, 0.0, 977.0, [0.23076923076923078, 455.0, 140.0, 88.0, 48.00000000000001, 42.0, 34.0, 419.8, 4266.666666666667, 430.0, 42.0, 90.0, 0.33, 2.8854031466362244e-12, 0.25, 1.0, 3.462483775963469e-13, 0.07500000000000001, 0.0, 0.0, 1.0, 460.0, 635.8]),
        ];
        for (r, t, tipo, y, piso, seed, w) in casos {
            let mut e = Explosion::nueva([0.0, y, 0.0], Some(piso), 1000.0, tipo, 1); e.r = r; e.t = t; e.p[1] = y; e.piso = piso; e.seed = seed; e.dura = 150.0;
            let n = e.nv_estado(); let mut v = vec![n.s]; for a in [n.cap, n.tallo, n.falda, n.fuego_v] { v.extend_from_slice(&a); } v.extend_from_slice(&n.dens[..3]); v.extend_from_slice(&n.caja);
            let w: Vec<f64> = w.iter().enumerate().filter(|(k, _)| *k != 20).map(|(_, x)| *x).collect();
            for k in 0..w.len() { assert!((v[k] - w[k]).abs() < 1e-6 * w[k].abs().max(1.0), "{tipo} {k}: {} {}", v[k], w[k]); }
            assert_eq!(e.nv_bloque().map(|b| b.len()), Some(28));
        }
    }
}
