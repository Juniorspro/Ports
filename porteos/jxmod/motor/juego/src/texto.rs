//! El texto y los rectángulos de la interfaz con el atlas de letras (herramientas/atlas_letras.py): cada letra es un
//! rectángulo con su parte del atlas; los rectángulos lisos usan el cuadrado blanco del atlas. Salen como vértices para la
//! pasada de interfaz del motor (x, y en píxeles; u, v; color).
use serde_json::Value;
use std::collections::HashMap;

pub struct Letras { lado: (f32, f32), tam: f32, pub alto: f32, blanco: (f32, f32), c: HashMap<char, [f32; 7]>, disco: [f32; 4], anillo: [f32; 4] }

impl Letras {
    pub fn de_json(t: &str) -> Result<Letras, String> {
        let v: Value = serde_json::from_str(t).map_err(|e| format!("letras: {e}"))?;
        let f = |x: &Value| x.as_f64().unwrap_or(0.0) as f32;
        let mut c = HashMap::new();
        for (k, m) in v["c"].as_object().ok_or("letras sin caracteres")? {
            if let (Some(ch), Some(a)) = (k.chars().next(), m.as_array()) { let mut x = [0f32; 7]; for (i, e) in a.iter().take(7).enumerate() { x[i] = f(e); } c.insert(ch, x); }
        }
        let r4 = |k: &str| { let b = f(&v["blanco"][0]); let mut r = [b, b, 0.0, 0.0]; if let Some(a) = v[k].as_array() { for (i, e) in a.iter().take(4).enumerate() { r[i] = f(e); } } r };
        Ok(Letras { lado: (f(&v["lado"][0]), f(&v["lado"][1])), tam: f(&v["tam"]), alto: f(&v["alto"]), blanco: (f(&v["blanco"][0]), f(&v["blanco"][1])), c,
            disco: r4("disco"), anillo: r4("anillo") })
    }
    fn quad(v: &mut Vec<f32>, x: f32, y: f32, w: f32, h: f32, u0: f32, v0: f32, u1: f32, v1: f32, col: [f32; 4]) {
        let p = [(x, y, u0, v0), (x + w, y, u1, v0), (x + w, y + h, u1, v1), (x, y, u0, v0), (x + w, y + h, u1, v1), (x, y + h, u0, v1)];
        for (a, b, c, d) in p { v.extend_from_slice(&[a, b, c, d, col[0], col[1], col[2], col[3]]); }
    }
    /// un rectángulo liso
    pub fn rect(&self, v: &mut Vec<f32>, x: f32, y: f32, w: f32, h: f32, col: [f32; 4]) {
        let (u, t) = (self.blanco.0 / self.lado.0, self.blanco.1 / self.lado.1); Self::quad(v, x, y, w, h, u, t, u, t, col);
    }
    /// una parte del atlas (en píxeles del atlas) estirada en el rectángulo
    fn parte(&self, v: &mut Vec<f32>, x: f32, y: f32, w: f32, h: f32, p: [f32; 4], col: [f32; 4]) {
        let (lx, ly) = self.lado; Self::quad(v, x, y, w, h, p[0] / lx, p[1] / ly, (p[0] + p[2]) / lx, (p[1] + p[3]) / ly, col);
    }
    /// un círculo lleno de radio `r` con centro en (cx, cy)
    pub fn disco(&self, v: &mut Vec<f32>, cx: f32, cy: f32, r: f32, col: [f32; 4]) { self.parte(v, cx - r, cy - r, r * 2.0, r * 2.0, self.disco, col); }
    /// un aro (el borde de un círculo)
    pub fn anillo(&self, v: &mut Vec<f32>, cx: f32, cy: f32, r: f32, col: [f32; 4]) { self.parte(v, cx - r, cy - r, r * 2.0, r * 2.0, self.anillo, col); }
    /// un rectángulo con las esquinas redondeadas (radio `ra`): las esquinas son los cuartos del disco
    pub fn caja(&self, v: &mut Vec<f32>, x: f32, y: f32, w: f32, h: f32, ra: f32, col: [f32; 4]) {
        let ra = ra.min(w / 2.0).min(h / 2.0); let d = self.disco; let m = d[2] / 2.0;
        let q = |i: f32, j: f32| [d[0] + i * m, d[1] + j * m, m, m];
        self.parte(v, x, y, ra, ra, q(0.0, 0.0), col); self.parte(v, x + w - ra, y, ra, ra, q(1.0, 0.0), col);
        self.parte(v, x, y + h - ra, ra, ra, q(0.0, 1.0), col); self.parte(v, x + w - ra, y + h - ra, ra, ra, q(1.0, 1.0), col);
        self.rect(v, x + ra, y, w - 2.0 * ra, ra, col); self.rect(v, x, y + ra, w, h - 2.0 * ra, col); self.rect(v, x + ra, y + h - ra, w - 2.0 * ra, ra, col);
    }
    /// el ancho de un texto de `tam` píxeles de alto
    pub fn ancho(&self, tam: f32, s: &str) -> f32 { let k = tam / self.tam; s.chars().map(|ch| self.c.get(&ch).or(self.c.get(&'?')).map(|m| m[6]).unwrap_or(0.0) * k).sum() }
    /// un texto con su borde de arriba en `y`; devuelve el ancho
    pub fn texto(&self, v: &mut Vec<f32>, x: f32, y: f32, tam: f32, col: [f32; 4], s: &str) -> f32 {
        let k = tam / self.tam; let mut px = x;
        for ch in s.chars() {
            let Some(m) = self.c.get(&ch).or(self.c.get(&'?')) else { continue };
            if ch != ' ' { Self::quad(v, px + m[4] * k, y + m[5] * k, m[2] * k, m[3] * k, m[0] / self.lado.0, m[1] / self.lado.1, (m[0] + m[2]) / self.lado.0, (m[1] + m[3]) / self.lado.1, col); }
            px += m[6] * k;
        }
        px - x
    }
    /// un texto con sombra (se lee sobre cualquier fondo)
    pub fn texto_sombra(&self, v: &mut Vec<f32>, x: f32, y: f32, tam: f32, col: [f32; 4], s: &str) -> f32 {
        let d = (tam * 0.06).max(1.0); self.texto(v, x + d, y + d, tam, [0.0, 0.0, 0.0, col[3] * 0.7], s); self.texto(v, x, y, tam, col, s)
    }
}
