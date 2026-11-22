//! La mano en 3D que recubre la tuya: una malla liviana (~2000 vértices por mano) armada en cada cuadro a partir de los
//! 21 puntos, en el espacio de la imagen (x, y en píxeles; z en las mismas unidades, positiva lejos de la cámara). Así
//! cae exactamente sobre la mano de la imagen.
//!
//! - **Dedos:** un tubo por dedo que pasa por sus articulaciones con una curva suave (Catmull-Rom), más grueso en la
//!   base y con la punta redondeada justo donde está la punta del dedo. Los grosores son los de una mano de verdad,
//!   proporcionales al ancho de la palma.
//! - **Palma:** una «almohada» (parche de Coons) entre la muñeca, la base del pulgar y los nudillos, más gruesa en el
//!   medio, con el borde redondeado.
//! - **Muñeca:** un tramo de antebrazo que se desvanece.
//!
//! Cada vértice: posición (3), normal (3), opacidad y parte (0 pulgar … 4 meñique, 5 palma, 6 muñeca).
use crate::mano::PUNTOS;

pub const POR_VERTICE: usize = 8;

#[derive(Default)]
pub struct Malla { pub v: Vec<f32>, pub i: Vec<u16> }

#[derive(Clone, Copy, Debug, Default, PartialEq)]
struct V { x: f32, y: f32, z: f32 }
fn v(x: f32, y: f32, z: f32) -> V { V { x, y, z } }
impl V {
    fn de(p: [f32; 3]) -> V { v(p[0], p[1], p[2]) }
    fn mas(self, o: V) -> V { v(self.x + o.x, self.y + o.y, self.z + o.z) }
    fn menos(self, o: V) -> V { v(self.x - o.x, self.y - o.y, self.z - o.z) }
    fn por(self, k: f32) -> V { v(self.x * k, self.y * k, self.z * k) }
    fn punto(self, o: V) -> f32 { self.x * o.x + self.y * o.y + self.z * o.z }
    fn cruz(self, o: V) -> V { v(self.y * o.z - self.z * o.y, self.z * o.x - self.x * o.z, self.x * o.y - self.y * o.x) }
    fn largo(self) -> f32 { self.punto(self).sqrt() }
    fn unit(self) -> V { let l = self.largo(); if l > 1e-6 { self.por(1.0 / l) } else { v(0.0, 0.0, -1.0) } }
    fn mezcla(self, o: V, t: f32) -> V { self.mas(o.menos(self).por(t)) }
}

/// Catmull-Rom uniforme por los puntos `p`, `n` muestras por tramo (incluye el primero y el último)
fn curva(p: &[V], n: usize, sal: &mut Vec<(V, f32)>) {
    let m = p.len();
    for s in 0..m - 1 {
        let (p0, p1, p2, p3) = (p[s.saturating_sub(1)], p[s], p[s + 1], p[(s + 2).min(m - 1)]);
        for k in 0..n {
            if s > 0 && k == 0 { continue; }
            let t = k as f32 / n as f32;
            let (t2, t3) = (t * t, t * t * t);
            let q = p0.por(-0.5 * t3 + t2 - 0.5 * t).mas(p1.por(1.5 * t3 - 2.5 * t2 + 1.0)).mas(p2.por(-1.5 * t3 + 2.0 * t2 + 0.5 * t)).mas(p3.por(0.5 * t3 - 0.5 * t2));
            sal.push((q, s as f32 + t));
        }
    }
    sal.push((p[m - 1], (m - 1) as f32));
}

impl Malla {
    pub fn limpiar(&mut self) { self.v.clear(); self.i.clear(); }
    pub fn vertices(&self) -> usize { self.v.len() / POR_VERTICE }
    fn vert(&mut self, p: V, n: V, alfa: f32, parte: f32) -> u16 {
        let k = self.vertices();
        self.v.extend_from_slice(&[p.x, p.y, p.z, n.x, n.y, n.z, alfa, parte]);
        k as u16
    }

    /// un tubo por los centros dados, con su radio y opacidad en cada uno; tapas redondas opcionales
    fn tubo(&mut self, c: &[V], r: &[f32], a: &[f32], parte: f32, tapa_ini: bool, tapa_fin: bool, lados: usize, eje2: Option<(V, f32)>) {
        let n = c.len();
        if n < 2 { return; }
        let t: Vec<V> = (0..n).map(|k| c[(k + 1).min(n - 1)].menos(c[k.saturating_sub(1)]).unit()).collect();
        // marco que se transporta a lo largo del tubo (no se retuerce)
        let mut nn = { let z = v(0.0, 0.0, 1.0); let q = t[0].cruz(z); if q.largo() > 0.2 { q.unit() } else { t[0].cruz(v(0.0, 1.0, 0.0)).unit() } };
        if let Some((ref_eje, _)) = eje2 { let q = ref_eje.menos(t[0].por(ref_eje.punto(t[0]))); if q.largo() > 1e-3 { nn = q.unit(); } }
        let base = self.vertices() as u16;
        for k in 0..n {
            if k > 0 { let q = nn.menos(t[k].por(nn.punto(t[k]))); if q.largo() > 1e-4 { nn = q.unit(); } }
            let b = t[k].cruz(nn).unit();
            let achata = eje2.map(|e| e.1).unwrap_or(1.0);
            for s in 0..lados {
                let th = std::f32::consts::TAU * s as f32 / lados as f32;
                let (co, si) = (th.cos(), th.sin());
                let d = nn.por(co).mas(b.por(si * achata));
                let dn = nn.por(co).mas(b.por(si / achata)).unit();
                self.vert(c[k].mas(d.por(r[k])), dn, a[k], parte);
            }
        }
        for k in 0..n - 1 {
            for s in 0..lados {
                let (a0, a1) = (base + (k * lados + s) as u16, base + (k * lados + (s + 1) % lados) as u16);
                let (b0, b1) = (a0 + lados as u16, a1 + lados as u16);
                self.i.extend_from_slice(&[a0, b0, a1, a1, b0, b1]);
            }
        }
        // tapas: media esfera (4 anillos y el polo)
        for (es_fin, quiere) in [(false, tapa_ini), (true, tapa_fin)] {
            if !quiere { continue; }
            let k = if es_fin { n - 1 } else { 0 };
            let dir = if es_fin { t[k] } else { t[k].por(-1.0) };
            let mut nk = nn; // el marco del extremo: se recalcula igual que arriba para el primero
            if !es_fin { nk = { let z = v(0.0, 0.0, 1.0); let q = t[0].cruz(z); if q.largo() > 0.2 { q.unit() } else { t[0].cruz(v(0.0, 1.0, 0.0)).unit() } }; }
            let bk = t[k].cruz(nk).unit();
            let anillo0 = base + (k * lados) as u16;
            let mut previo = anillo0;
            let anillos = 4;
            for j in 1..anillos {
                let fi = std::f32::consts::FRAC_PI_2 * j as f32 / anillos as f32;
                let ini = self.vertices() as u16;
                for s in 0..lados {
                    let th = std::f32::consts::TAU * s as f32 / lados as f32;
                    let d = nk.por(th.cos()).mas(bk.por(th.sin()));
                    let nor = d.por(fi.cos()).mas(dir.por(fi.sin())).unit();
                    self.vert(c[k].mas(d.por(r[k] * fi.cos())).mas(dir.por(r[k] * fi.sin())), nor, a[k], parte);
                }
                for s in 0..lados {
                    let (a0, a1) = (previo + s as u16, previo + ((s + 1) % lados) as u16);
                    let (b0, b1) = (ini + s as u16, ini + ((s + 1) % lados) as u16);
                    if es_fin { self.i.extend_from_slice(&[a0, b0, a1, a1, b0, b1]); } else { self.i.extend_from_slice(&[a0, a1, b0, a1, b1, b0]); }
                }
                previo = ini;
            }
            let polo = self.vert(c[k].mas(dir.por(r[k])), dir, a[k], parte);
            for s in 0..lados {
                let (a0, a1) = (previo + s as u16, previo + ((s + 1) % lados) as u16);
                if es_fin { self.i.extend_from_slice(&[a0, polo, a1]); } else { self.i.extend_from_slice(&[a0, a1, polo]); }
            }
        }
    }

    /// agrega una mano (21 puntos en píxeles de la imagen, z en las mismas unidades). `grosor` escala todo (1 = una
    /// mano de verdad); `esqueleto`: en vez de la mano, huesos finos y articulaciones (para el estilo «Esqueleto»).
    pub fn mano(&mut self, p: &[[f32; 3]; PUNTOS], grosor: f32, esqueleto: bool) {
        if self.vertices() > 60000 { return; }
        let q: [V; PUNTOS] = std::array::from_fn(|i| V::de(p[i]));
        let w = q[5].menos(q[17]).largo().max(4.0);
        let lados = 16;
        if esqueleto { return self.huesos(&q, w * grosor); }
        // ---- los dedos (índice a meñique) y el pulgar ----
        const RADIOS: [[f32; 4]; 5] = [[0.20, 0.165, 0.14, 0.12], [0.15, 0.135, 0.12, 0.105], [0.155, 0.14, 0.125, 0.11], [0.145, 0.13, 0.117, 0.103], [0.125, 0.112, 0.1, 0.09]];
        for d in 0..5 {
            let j = [1 + d * 4, 2 + d * 4, 3 + d * 4, 4 + d * 4];
            let rr: [f32; 4] = std::array::from_fn(|k| RADIOS[d][k] * w * grosor);
            // la punta: el centro de la tapa queda un radio antes del punto, así la tapa termina justo en la punta
            let dir = q[j[3]].menos(q[j[2]]).unit();
            let punta = q[j[3]].menos(dir.por(rr[3]));
            let mut pts = vec![q[j[0]], q[j[1]], q[j[2]], punta];
            let mut rs = vec![rr[0], rr[1], rr[2], rr[3]];
            if d > 0 {
                // la base del dedo se mete un poco en la palma, hacia la muñeca (sin hueco entre los dos; con el dedo
                // doblado, ir hacia atrás del dedo la sacaría por delante o por detrás de la palma)
                let atras = q[j[0]].mas(q[0].menos(q[j[0]]).unit().por(q[j[1]].menos(q[j[0]]).largo() * 0.08));
                pts.insert(0, atras); rs.insert(0, rr[0] * 1.02);
            }
            let mut c = Vec::with_capacity(24); curva(&pts, 5, &mut c);
            let cs: Vec<V> = c.iter().map(|x| x.0).collect();
            let radios: Vec<f32> = c.iter().map(|&(_, s)| { let k = (s.floor() as usize).min(rs.len() - 2); let f = s - k as f32; rs[k] + (rs[k + 1] - rs[k]) * f }).collect();
            let alfas = vec![1.0; cs.len()];
            self.tubo(&cs, &radios, &alfas, d as f32, true, true, lados, None);
        }
        // ---- la palma ----
        // (la palma y la muñeca se corren un poco hacia atrás sólo en profundidad: con la proyección sin perspectiva no se
        // mueven en la imagen, pero donde se cruzan con un dedo gana el dedo, y la unión queda limpia en vez de un serrucho)
        let desde = self.vertices();
        self.palma(&q, w * grosor, w);
        // ---- el comienzo del antebrazo, que se desvanece ----
        let arriba = q[9].menos(q[0]);
        let largo = arriba.largo();
        let abajo = arriba.unit().por(-1.0);
        let ancho = q[5].menos(q[17]).unit();
        let normal = ancho.cruz(arriba.unit()).unit();
        let n = 6;
        let c: Vec<V> = (0..n).map(|k| q[0].mas(arriba.por(0.12)).mas(abajo.por(largo * 0.6 * k as f32 / (n - 1) as f32))).collect();
        let r: Vec<f32> = (0..n).map(|k| w * grosor * (0.40 + 0.03 * k as f32 / (n - 1) as f32)).collect();
        let a: Vec<f32> = (0..n).map(|k| 1.0 - (k as f32 / (n - 1) as f32).powf(1.3)).collect();
        // (elíptico: ancho en el plano de la palma, más fino de frente)
        self.tubo(&c, &r, &a, 6.0, false, false, 14, Some((ancho, 0.62)));
        let _ = normal;
        let atras = 0.2 * w * grosor;
        for k in desde..self.vertices() { self.v[k * POR_VERTICE + 2] += atras; }
    }

    fn palma(&mut self, q: &[V; PUNTOS], w: f32, w_real: f32) {
        let a = q[5].menos(q[17]).unit(); // hacia el lado del índice
        let arriba = q[9].menos(q[0]).unit();
        let n = a.cruz(arriba).unit();
        // el borde de arriba de la palma: un poco más allá de los nudillos, hacia los dedos (como la membrana entre los
        // dedos de una mano de verdad), así no quedan muescas donde empiezan los dedos
        let sube = |m: usize| q[m].mezcla(q[m + 1], 0.2);
        let k5 = sube(5).mas(a.por(0.10 * w));
        let k17 = sube(17).menos(a.por(0.10 * w));
        let wr = q[0].mas(a.por(0.36 * w_real)).mas(arriba.por(0.05 * w_real));
        let wu = q[0].menos(a.por(0.32 * w_real)).mas(arriba.por(0.05 * w_real));
        let mut arr = Vec::new(); curva(&[k5, sube(9), sube(13), k17], 4, &mut arr);
        let top: Vec<V> = arr.iter().map(|x| x.0).collect();
        // el lado del pulgar pasa por la eminencia tenar (entre la base del pulgar y el índice)
        let tenar = q[1].mezcla(q[2], 0.35).mezcla(q[5], 0.25);
        let membrana = q[2].mezcla(q[5], 0.62);
        let mut lr = Vec::new(); curva(&[wr, tenar, membrana, k5], 3, &mut lr);
        let rad: Vec<V> = lr.iter().map(|x| x.0).collect();
        let hipo = wu.mezcla(k17, 0.5).menos(a.por(0.07 * w));
        let mut lu = Vec::new(); curva(&[wu, hipo, k17], 5, &mut lu);
        let uln: Vec<V> = lu.iter().map(|x| x.0).collect();
        let muestra = |l: &Vec<V>, t: f32| -> V { let f = t * (l.len() - 1) as f32; let k = (f.floor() as usize).min(l.len() - 2); l[k].mezcla(l[k + 1], f - k as f32) };
        let (nu, nv) = (28usize, 14usize);
        let espesor = 0.17 * w;
        let centro = q[0].mezcla(q[9], 0.5);
        for lado in [1.0f32, -1.0] {
            let ini = self.vertices() as u16;
            let mut pos = Vec::with_capacity((nu + 1) * (nv + 1));
            for j in 0..=nv {
                let vv = j as f32 / nv as f32;
                for i in 0..=nu {
                    let u = i as f32 / nu as f32;
                    // Coons: abajo la muñeca (de wr a wu), arriba los nudillos, a los costados el tenar y el hipotenar
                    let b = wr.mezcla(wu, u); let k = muestra(&top, u); let sr = muestra(&rad, vv); let su = muestra(&uln, vv);
                    let p = b.por(1.0 - vv).mas(k.por(vv)).mas(sr.por(1.0 - u)).mas(su.por(u))
                        .menos(wr.por((1.0 - u) * (1.0 - vv)).mas(wu.por(u * (1.0 - vv))).mas(k5.por((1.0 - u) * vv)).mas(k17.por(u * vv)));
                    let h = espesor * (1.0 - (2.0 * u - 1.0).abs().powi(3)).max(0.0).sqrt() * (1.0 - (2.0 * vv - 1.0).abs().powi(3)).max(0.0).sqrt();
                    pos.push(p.mas(n.por(h * lado)));
                }
            }
            // normales: de los triángulos, y en el borde hacia afuera (así se ve redondeado)
            let mut nor = vec![V::default(); pos.len()];
            let idx = |i: usize, j: usize| j * (nu + 1) + i;
            for j in 0..nv { for i in 0..nu {
                let (p00, p10, p01, p11) = (idx(i, j), idx(i + 1, j), idx(i, j + 1), idx(i + 1, j + 1));
                for &(x, y, z) in &[(p00, p10, p01), (p10, p11, p01)] {
                    let f = pos[y].menos(pos[x]).cruz(pos[z].menos(pos[x]));
                    for &k in &[x, y, z] { nor[k] = nor[k].mas(f); }
                }
            } }
            for j in 0..=nv { for i in 0..=nu {
                let k = idx(i, j);
                let mut nk = nor[k].unit();
                if nk.punto(n.por(lado)) < 0.0 { nk = nk.por(-1.0); }
                if i == 0 || j == 0 || i == nu || j == nv {
                    let fuera = pos[k].menos(centro); let fuera = fuera.menos(n.por(fuera.punto(n))).unit();
                    nk = fuera.mas(n.por(lado * 0.25)).unit();
                }
                self.vert(pos[k], nk, 1.0, 5.0);
            } }
            for j in 0..nv { for i in 0..nu {
                let (p00, p10, p01, p11) = (ini + idx(i, j) as u16, ini + idx(i + 1, j) as u16, ini + idx(i, j + 1) as u16, ini + idx(i + 1, j + 1) as u16);
                if lado > 0.0 { self.i.extend_from_slice(&[p00, p10, p01, p10, p11, p01]); } else { self.i.extend_from_slice(&[p00, p01, p10, p10, p01, p11]); }
            } }
        }
    }

    /// el estilo «Esqueleto»: huesos finos y una bolita en cada articulación (más grande en las puntas)
    fn huesos(&mut self, q: &[V; PUNTOS], w: f32) {
        const HUESOS: [(usize, usize, f32); 21] = [(0, 1, 0.0), (1, 2, 0.0), (2, 3, 0.0), (3, 4, 0.0), (0, 5, 5.0), (5, 9, 5.0), (9, 13, 5.0), (13, 17, 5.0), (0, 17, 5.0),
            (5, 6, 1.0), (6, 7, 1.0), (7, 8, 1.0), (9, 10, 2.0), (10, 11, 2.0), (11, 12, 2.0), (13, 14, 3.0), (14, 15, 3.0), (15, 16, 3.0), (17, 18, 4.0), (18, 19, 4.0), (19, 20, 4.0)];
        for &(a, b, parte) in &HUESOS {
            let r = 0.045 * w;
            self.tubo(&[q[a], q[b]], &[r, r], &[1.0, 1.0], parte, false, false, 8, None);
        }
        for i in 0..PUNTOS {
            let punta = i > 0 && i % 4 == 0;
            let r = if punta { 0.11 * w } else { 0.075 * w };
            let parte = if i == 0 { 5.0 } else { ((i - 1) / 4) as f32 };
            // una esfera: un tubo de largo cero con las dos tapas
            let d = v(0.0, -1e-3, 0.0);
            self.tubo(&[q[i].menos(d), q[i].mas(d)], &[r, r], &[1.0, 1.0], parte, true, true, 10, None);
        }
    }
}
