//! Un dibujante de íconos vectoriales chico (para los íconos SVG de la web: los de las apps del celular): caminos con M, L,
//! H, V, C, S, Z (y en minúscula, relativos), rellenos (regla distinta de cero) y trazos con uniones y puntas redondas,
//! círculos y rectángulos redondeados, con 4×4 muestras por píxel. Todo en las coordenadas del viewBox (24 × 24).
pub struct Lienzo { pub lado: usize, k: f32, cob: Vec<f32>, pub px: Vec<[f32; 4]> }
const SS: usize = 4;

/// lee un camino SVG («d»): una lista de tramos (cada uno una polilínea; `cerrado`)
pub fn camino(d: &str) -> Vec<(Vec<[f32; 2]>, bool)> {
    let mut t: Vec<String> = vec![]; let mut num = String::new();
    let fin = |num: &mut String, t: &mut Vec<String>| { if !num.is_empty() { t.push(std::mem::take(num)); } };
    for ch in d.chars() {
        if ch.is_ascii_alphabetic() && ch != 'e' { fin(&mut num, &mut t); t.push(ch.to_string()); }
        else if ch == '-' && !num.is_empty() && !num.ends_with('e') { fin(&mut num, &mut t); num.push(ch); }
        else if ch == '.' && num.contains('.') && !num.ends_with('e') { fin(&mut num, &mut t); num.push('0'); num.push(ch); }
        else if ch == ',' || ch.is_whitespace() { fin(&mut num, &mut t); }
        else { num.push(ch); }
    }
    fin(&mut num, &mut t);
    let mut out: Vec<(Vec<[f32; 2]>, bool)> = vec![]; let mut cur: Vec<[f32; 2]> = vec![];
    let (mut p, mut ini, mut ctrl) = ([0.0f32; 2], [0.0f32; 2], None::<[f32; 2]>); let mut i = 0; let mut cmd = 'M';
    let n = |i: &mut usize| -> f32 { let v = t.get(*i).and_then(|x| x.parse().ok()).unwrap_or(0.0); *i += 1; v };
    let bez = |a: [f32; 2], b: [f32; 2], c: [f32; 2], d: [f32; 2], cur: &mut Vec<[f32; 2]>| { for k in 1..=12 { let s = k as f32 / 12.0; let u = 1.0 - s; cur.push([u * u * u * a[0] + 3.0 * u * u * s * b[0] + 3.0 * u * s * s * c[0] + s * s * s * d[0], u * u * u * a[1] + 3.0 * u * u * s * b[1] + 3.0 * u * s * s * c[1] + s * s * s * d[1]]); } };
    while i < t.len() {
        if let Some(c) = t[i].chars().next().filter(|c| c.is_ascii_alphabetic()) { cmd = c; i += 1; if c == 'z' || c == 'Z' { if !cur.is_empty() { out.push((std::mem::take(&mut cur), true)); } p = ini; ctrl = None; continue; } }
        let rel = cmd.is_ascii_lowercase(); let o = if rel { p } else { [0.0, 0.0] };
        match cmd.to_ascii_uppercase() {
            'M' => { if !cur.is_empty() { out.push((std::mem::take(&mut cur), false)); } p = [o[0] + n(&mut i), o[1] + n(&mut i)]; ini = p; cur.push(p); cmd = if rel { 'l' } else { 'L' }; ctrl = None; }
            'L' => { p = [o[0] + n(&mut i), o[1] + n(&mut i)]; cur.push(p); ctrl = None; }
            'H' => { p = [if rel { p[0] } else { 0.0 } + n(&mut i), p[1]]; cur.push(p); ctrl = None; }
            'V' => { p = [p[0], if rel { p[1] } else { 0.0 } + n(&mut i)]; cur.push(p); ctrl = None; }
            'C' => { let b = [o[0] + n(&mut i), o[1] + n(&mut i)]; let c = [o[0] + n(&mut i), o[1] + n(&mut i)]; let d = [o[0] + n(&mut i), o[1] + n(&mut i)]; bez(p, b, c, d, &mut cur); ctrl = Some(c); p = d; }
            'S' => { let b = match ctrl { Some(c) => [2.0 * p[0] - c[0], 2.0 * p[1] - c[1]], None => p }; let c = [o[0] + n(&mut i), o[1] + n(&mut i)]; let d = [o[0] + n(&mut i), o[1] + n(&mut i)]; bez(p, b, c, d, &mut cur); ctrl = Some(c); p = d; }
            _ => { i += 1; }
        }
    }
    if !cur.is_empty() { out.push((cur, false)); }
    out
}

impl Lienzo {
    pub fn nuevo(lado: usize) -> Lienzo { Lienzo { lado, k: (lado * SS) as f32 / 24.0, cob: vec![0.0; lado * lado * SS * SS], px: vec![[0.0; 4]; lado * lado] } }
    fn limpiar_cob(&mut self) { self.cob.iter_mut().for_each(|c| *c = 0.0); }
    /// pinta lo cubierto con un color (y su opacidad): encima de lo que había
    fn pintar(&mut self, c: [f32; 3], op: f32) {
        let l = self.lado;
        for y in 0..l { for x in 0..l {
            let mut s = 0.0; for j in 0..SS { for i in 0..SS { s += self.cob[(y * SS + j) * l * SS + x * SS + i]; } }
            let a = s / (SS * SS) as f32 * op; if a <= 0.0 { continue; }
            let d = &mut self.px[y * l + x]; let na = a + d[3] * (1.0 - a);
            for k in 0..3 { d[k] = (c[k] * a + d[k] * d[3] * (1.0 - a)) / na.max(1e-6); } d[3] = na;
        } }
        self.limpiar_cob();
    }
    /// marca lo de adentro de unos polígonos (distinto de cero)
    fn cubrir_poly(&mut self, polis: &[Vec<[f32; 2]>]) {
        let n = self.lado * SS; let k = self.k;
        for y in 0..n { let py = y as f32 + 0.5;
            let mut cortes: Vec<(f32, i32)> = vec![];
            for p in polis { for e in 0..p.len() { let (a, b) = (p[e], p[(e + 1) % p.len()]); let (ay, by) = (a[1] * k, b[1] * k);
                if (ay <= py && by > py) || (by <= py && ay > py) { let x = a[0] * k + (py - ay) / (by - ay) * (b[0] * k - a[0] * k); cortes.push((x, if by > ay { 1 } else { -1 })); } } }
            cortes.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
            let mut w = 0; for c in 0..cortes.len() { let w0 = w; w += cortes[c].1; if w0 != 0 && c > 0 { let (x0, x1) = (cortes[c - 1].0, cortes[c].0); for x in (x0.max(0.0).round() as usize)..(x1.min(n as f32).round() as usize) { self.cob[y * n + x] = 1.0; } } }
        }
    }
    /// marca un disco (en unidades del viewBox)
    fn cubrir_disco(&mut self, c: [f32; 2], r: f32) {
        let n = self.lado * SS; let k = self.k; let (cx, cy, rr) = (c[0] * k, c[1] * k, r * k);
        for y in ((cy - rr).floor().max(0.0) as usize)..((cy + rr).ceil().min(n as f32) as usize) { for x in ((cx - rr).floor().max(0.0) as usize)..((cx + rr).ceil().min(n as f32) as usize) {
            let (dx, dy) = (x as f32 + 0.5 - cx, y as f32 + 0.5 - cy); if dx * dx + dy * dy <= rr * rr { self.cob[y * n + x] = 1.0; } } }
    }
    /// marca un trazo (uniones y puntas redondas)
    fn cubrir_trazo(&mut self, p: &[[f32; 2]], cerrado: bool, ancho: f32) {
        let m = p.len(); if m == 0 { return; } let h = ancho / 2.0;
        let lados = if cerrado { m } else { m - 1 };
        for e in 0..lados { let (a, b) = (p[e], p[(e + 1) % m]); let (dx, dy) = (b[0] - a[0], b[1] - a[1]); let l = (dx * dx + dy * dy).sqrt().max(1e-6); let (nx, ny) = (-dy / l * h, dx / l * h);
            self.cubrir_poly(&[vec![[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]]); }
        for q in p { self.cubrir_disco(*q, h); }
    }
    pub fn rellenar(&mut self, d: &str, c: [f32; 3], op: f32) { let t: Vec<Vec<[f32; 2]>> = camino(d).into_iter().map(|x| x.0).collect(); self.cubrir_poly(&t); self.pintar(c, op); }
    pub fn trazar(&mut self, d: &str, ancho: f32, c: [f32; 3]) { for (p, cer) in camino(d) { self.cubrir_trazo(&p, cer, ancho); } self.pintar(c, 1.0); }
    /// lo mismo con los puntos ya transformados
    pub fn trazar_pts(&mut self, tramos: &[(Vec<[f32; 2]>, bool)], ancho: f32, c: [f32; 3]) { for (p, cer) in tramos { self.cubrir_trazo(p, *cer, ancho); } self.pintar(c, 1.0); }
    pub fn disco(&mut self, c: [f32; 2], r: f32, col: [f32; 3], op: f32) { self.cubrir_disco(c, r); self.pintar(col, op); }
    pub fn aro(&mut self, c: [f32; 2], r: f32, ancho: f32, col: [f32; 3]) { let p: Vec<[f32; 2]> = (0..48).map(|k| { let a = k as f32 / 48.0 * std::f32::consts::TAU; [c[0] + a.cos() * r, c[1] + a.sin() * r] }).collect(); self.cubrir_trazo(&p, true, ancho); self.pintar(col, 1.0); }
    /// un rectángulo redondeado (trazado)
    pub fn caja_trazo(&mut self, x: f32, y: f32, w: f32, h: f32, rx: f32, ancho: f32, col: [f32; 3]) {
        let mut p = vec![]; let n = 8;
        for (cx, cy, a0) in [(x + w - rx, y + rx, -90.0f32), (x + w - rx, y + h - rx, 0.0), (x + rx, y + h - rx, 90.0), (x + rx, y + rx, 180.0)] {
            for k in 0..=n { let a = (a0 + 90.0 * k as f32 / n as f32).to_radians(); p.push([cx + a.cos() * rx, cy + a.sin() * rx]); } }
        self.cubrir_trazo(&p, true, ancho); self.pintar(col, 1.0);
    }
    /// RGBA de 8 bits
    pub fn rgba(&self) -> Vec<u8> { self.px.iter().flat_map(|c| [c[0], c[1], c[2], c[3]].map(|v| (v * 255.0).round().clamp(0.0, 255.0) as u8)).collect() }
}

/// los íconos de las apps del celular (CEL_APPS de celular.js), blancos: props, memes, gente, emotes, cámara, mods, ajustes;
/// y el del botón del celular (hud.js)
pub fn icono(n: &str, lado: usize) -> Vec<u8> {
    let b = [1.0, 1.0, 1.0]; let mut l = Lienzo::nuevo(lado);
    match n {
        "props" => { l.trazar("M12 3l8 4.5v9L12 21l-8-4.5v-9z", 2.0, b); l.trazar("M4.3 7.6L12 12l7.7-4.4M12 12v8.8", 1.6, b); }
        "memes" => { l.caja_trazo(4.0, 4.0, 16.0, 16.0, 3.5, 2.0, b); for (c, op) in [([9.2, 9.2], 1.0), ([14.8, 9.2], 1.0), ([9.2, 14.8], 1.0), ([14.8, 14.8], 0.55)] { l.disco(c, 2.1, b, op); } }
        "gente" => { l.disco([9.0, 8.5], 3.0, b, 1.0); l.rellenar("M3.5 19c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2z", b, 1.0); l.disco([16.5, 9.5], 2.4, b, 0.8); l.rellenar("M14.6 14.3c2.6-.6 5.3.8 5.9 4.7h-4.4", b, 0.8); }
        "emotes" => { l.disco([12.0, 4.8], 2.2, b, 1.0); l.trazar("M12 7.8v6.4M12 9.6l-4.8-3.3M12 9.6l4.5 1.3 2.7-3.8M12 14.2l-3.5 6.2M12 14.2l3.1 6.4", 2.1, b); }
        "camara" => { l.trazar("M3.5 8.5h3l1.6-2.5h7.8l1.6 2.5h3v10h-17z", 2.0, b); l.aro([12.0, 13.3], 3.2, 2.0, b); }
        "mods" => {
            let t: Vec<(Vec<[f32; 2]>, bool)> = camino("M10 3h4v3.2l2.3 1 2.3-2.3 2.8 2.8-2.3 2.3 1 2.3H23v4h-2.9l-1 2.3 2.3 2.3-2.8 2.8-2.3-2.3-2.3 1V24h-4v-2.9l-2.3-1-2.3 2.3-2.8-2.8 2.3-2.3-1-2.3H1v-4h2.9l1-2.3-2.3-2.3 2.8-2.8 2.3 2.3 2.3-1z")
                .into_iter().map(|(p, c)| (p.into_iter().map(|q| [0.82 * (q[0] + 2.6), 0.82 * (q[1] + 1.4)]).collect(), c)).collect();
            l.trazar_pts(&t, 2.0 * 0.82, b); l.disco([12.0, 12.6], 2.6, b, 1.0);
        }
        "ajustes" => { l.trazar("M4 7h16M4 12h16M4 17h16", 2.0, b); for c in [[9.0, 7.0], [15.0, 12.0], [8.0, 17.0]] { l.disco(c, 2.2 + 1.0, b, 1.0); l.disco(c, 2.2 - 1.0, [0.239, 0.267, 0.314], 1.0); } }
        "celular" => { l.caja_trazo(6.5, 2.5, 11.0, 19.0, 2.4, 2.0, b); l.trazar("M10 5.2h4", 1.6, b); l.disco([12.0, 18.2], 1.1, b, 1.0); }
        _ => {}
    }
    l.rgba()
}
