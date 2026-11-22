//! El motor: sigue hasta N manos cuadro a cuadro. Cada mano seguida usa el cuadrado sacado de sus puntos del cuadro
//! anterior (el detector de palmas corre sólo si no hay manos, o cada tanto si falta alguna); los puntos pasan por el
//! filtro One Euro (con predicción) y el esqueleto (largos calibrados y articulaciones con límites); además se calcula
//! dónde está la mano en metros frente a la cámara y los gestos.
use crate::esqueleto::{self, AngDedo, Calibracion, Marco, V3};
use crate::filtro::{Filtro3, UnoEuro};
use crate::gestos::{self, Estable, Gesto, Medidas};
use crate::mano::{self, Detector, Puntero, Roi, P3, PUNTOS};

#[derive(Clone, Copy, Debug)]
pub struct Config {
    pub max_manos: usize,
    /// presencia mínima para seguir una mano (si baja, se suelta y se vuelve a buscar)
    pub min_presencia: f32,
    /// puntaje mínimo del detector de palmas
    pub min_palma: f32,
    /// con alguna mano seguida pero menos que el máximo: cada cuánto se busca otra (ms)
    pub cada_busqueda_ms: f64,
    /// cuánto se adelanta la salida con la velocidad (ms): compensa el retraso de la cámara y del cálculo
    pub prediccion_ms: f32,
    /// el campo de visión horizontal de la cámara (grados), para la distancia en metros
    pub fov_grados: f32,
    /// One Euro de los puntos en la imagen (la velocidad se mide en «manos por segundo»)
    pub img_min_corte: f32, pub img_beta: f32, pub img_d_corte: f32,
    /// One Euro de los ángulos de los dedos (radianes)
    pub ang_min_corte: f32, pub ang_beta: f32,
}
impl Default for Config {
    fn default() -> Self {
        Config { max_manos: 2, min_presencia: 0.5, min_palma: 0.5, cada_busqueda_ms: 300.0, prediccion_ms: 50.0, fov_grados: 66.0,
            img_min_corte: 0.08, img_beta: 100.0, img_d_corte: 1.0, ang_min_corte: 1.2, ang_beta: 1.5 }
    }
}

/// lo que el motor da de cada mano
#[derive(Clone, Debug)]
pub struct Mano {
    pub id: u32,
    /// la mano real: true = derecha (según si la imagen venía espejada)
    pub derecha: bool,
    pub presencia: f32,
    /// los 21 puntos en la imagen, filtrados y adelantados (x, y en 0..1; z relativa, en anchos de imagen)
    pub img: [[f32; 3]; PUNTOS],
    /// los 21 puntos en metros, armados con el esqueleto (ejes de la cámara: x derecha, y abajo, z lejos), centrados en la muñeca
    pub mundo: [[f32; 3]; PUNTOS],
    /// el centro de la palma frente a la cámara (metros) y su rotación (cuaternión x, y, z, w)
    pub posicion: [f32; 3],
    pub rotacion: [f32; 4],
    pub normal: [f32; 3],
    pub angulos: [AngDedo; 5],
    pub medidas: Medidas,
    pub gesto: Gesto,
    pub gesto_fuerza: f32,
    pub roi: Roi,
    pub calibrada: bool,
}

struct Pista {
    id: u32, roi: Roi, derecha_ema: f32, geom_derecha: bool,
    f_img: [Filtro3; PUNTOS], f_ang: [[UnoEuro; 4]; 5], f_pos: Filtro3, f_ejes: [Filtro3; 2],
    cal: Calibracion, gesto: Estable, salida: Option<Mano>,
}

pub struct Motor { det: Detector, pun: Puntero, pistas: Vec<Pista>, sig_id: u32, ult_busqueda: f64, pub cfg: Config, pub corrio_detector: bool, pub inferencias: u32 }

fn dist(a: &P3, b: &P3) -> f32 { ((a.x - b.x).powi(2) + (a.y - b.y).powi(2)).sqrt() }

impl Motor {
    pub fn nuevo(detector: &[u8], puntos: &[u8]) -> Result<Motor, String> {
        Ok(Motor { det: Detector::nuevo(detector)?, pun: Puntero::nuevo(puntos)?, pistas: vec![], sig_id: 1, ult_busqueda: -1e9, cfg: Config::default(), corrio_detector: false, inferencias: 0 })
    }
    pub fn reiniciar(&mut self) { self.pistas.clear(); self.ult_busqueda = -1e9; }
    /// para medir velocidad: sólo un modelo, varias veces
    pub fn banco_puntos(&mut self, rgba: &[u8], w: usize, h: usize, veces: usize) {
        let roi = Roi { cx: w as f32 / 2.0, cy: h as f32 / 2.0, lado: w.min(h) as f32, ang: 0.0 };
        for _ in 0..veces { self.pun.puntos(rgba, w, h, &roi); }
    }
    pub fn banco_detector(&mut self, rgba: &[u8], w: usize, h: usize, veces: usize) { for _ in 0..veces { self.det.detectar(rgba, w, h); } }

    /// procesa un cuadro RGBA (`t_ms`: el reloj de la cámara); `espejada`: si la imagen viene como un espejo (selfie)
    pub fn procesar(&mut self, rgba: &[u8], w: usize, h: usize, t_ms: f64, espejada: bool) -> Vec<Mano> {
        let t = t_ms / 1000.0; self.corrio_detector = false; self.inferencias = 0;
        // 1) las manos que ya se seguían: puntos en su cuadrado
        let mut vivas = Vec::new();
        for mut p in std::mem::take(&mut self.pistas) {
            let r = self.pun.puntos(rgba, w, h, &p.roi); self.inferencias += 1;
            if r.presencia < self.cfg.min_presencia { continue; }
            self.actualizar(&mut p, r, w, h, t, espejada);
            vivas.push(p);
        }
        // 2) buscar manos nuevas: siempre si no hay ninguna; cada tanto si faltan
        if vivas.len() < self.cfg.max_manos && (vivas.is_empty() || t_ms - self.ult_busqueda >= self.cfg.cada_busqueda_ms) {
            self.ult_busqueda = t_ms; self.corrio_detector = true;
            self.det.umbral = self.cfg.min_palma;
            let palmas = self.det.detectar(rgba, w, h);
            for pa in palmas {
                if vivas.len() >= self.cfg.max_manos { break; }
                let (cx, cy) = (pa.caja[0], pa.caja[1]);
                if vivas.iter().any(|v| ((v.roi.cx - cx).powi(2) + (v.roi.cy - cy).powi(2)).sqrt() < v.roi.lado * 0.45) { continue; }
                let roi = mano::roi_de_palma(&pa);
                let r = self.pun.puntos(rgba, w, h, &roi); self.inferencias += 1;
                if r.presencia < self.cfg.min_presencia { continue; }
                let f = Filtro3::nuevo(self.cfg.img_min_corte, self.cfg.img_beta, self.cfg.img_d_corte);
                let a = UnoEuro::nuevo(self.cfg.ang_min_corte, self.cfg.ang_beta, 1.0);
                let mut p = Pista { id: self.sig_id, roi, derecha_ema: r.derecha, geom_derecha: r.derecha < 0.5, f_img: [f; PUNTOS], f_ang: [[a; 4]; 5],
                    f_pos: Filtro3::nuevo(0.6, 3.0, 1.0), f_ejes: [Filtro3::nuevo(1.0, 0.8, 1.0); 2], cal: Calibracion::default(), gesto: Estable::default(), salida: None };
                self.sig_id += 1;
                self.actualizar(&mut p, r, w, h, t, espejada);
                vivas.push(p);
            }
        }
        // 3) si dos pistas terminaron sobre la misma mano, queda la de más presencia
        vivas.sort_by(|a, b| b.salida.as_ref().map(|m| m.presencia).unwrap_or(0.0).partial_cmp(&a.salida.as_ref().map(|m| m.presencia).unwrap_or(0.0)).unwrap());
        let mut fin: Vec<Pista> = Vec::new();
        for p in vivas { if !fin.iter().any(|q| ((q.roi.cx - p.roi.cx).powi(2) + (q.roi.cy - p.roi.cy).powi(2)).sqrt() < q.roi.lado.min(p.roi.lado) * 0.3) { fin.push(p); } }
        fin.sort_by_key(|p| p.id);
        self.pistas = fin;
        self.pistas.iter().filter_map(|p| p.salida.clone()).collect()
    }

    fn actualizar(&self, p: &mut Pista, r: mano::Puntos, w: usize, h: usize, t: f64, espejada: bool) {
        let c = &self.cfg;
        // derecha o izquierda: promedio con histéresis (no salta por un cuadro dudoso)
        p.derecha_ema += (r.derecha - p.derecha_ema) * 0.25;
        if p.geom_derecha && p.derecha_ema > 0.65 { p.geom_derecha = false; } else if !p.geom_derecha && p.derecha_ema < 0.35 { p.geom_derecha = true; }
        let real_derecha = if espejada { !p.geom_derecha } else { p.geom_derecha };
        // el cuadrado del cuadro siguiente
        p.roi = mano::roi_de_puntos(&r.img);
        // puntos en la imagen: filtrados (velocidad relativa al tamaño de la mano) y adelantados
        let lado = r.roi.lado.max(1.0); let pred = c.prediccion_ms / 1000.0;
        let mut img = [[0f32; 3]; PUNTOS];
        for i in 0..PUNTOS {
            p.f_img[i].filtrar([r.img[i].x, r.img[i].y, r.img[i].z], t, lado);
            let v = p.f_img[i].predecir(pred);
            img[i] = [v[0] / w as f32, v[1] / h as f32, v[2] / w as f32];
        }
        // el esqueleto: marco de la palma (ejes filtrados), ángulos con límites (filtrados) y la mano armada con los largos
        let wv: [V3; PUNTOS] = std::array::from_fn(|i| V3::de(&r.mundo[i]));
        let m0 = esqueleto::marco_palma(&wv, p.geom_derecha);
        if r.presencia > 0.9 { p.cal.sumar(&wv, &m0); }
        let ex = p.f_ejes[0].filtrar([m0.x.x, m0.x.y, m0.x.z], t, 1.0); let ey = p.f_ejes[1].filtrar([m0.y.x, m0.y.y, m0.y.z], t, 1.0);
        let y = V3::n(ey[0], ey[1], ey[2]).unit(); let xt = V3::n(ex[0], ex[1], ex[2]);
        let x = xt.menos(y.por(xt.punto(y))).unit();
        let m = Marco { o: V3::default(), x, y, z: x.cruz(y).unit(), pz: m0.pz };
        let wl: [V3; PUNTOS] = std::array::from_fn(|i| wv[i].menos(wv[0]));
        let mut ang = esqueleto::angulos(&wl, &m);
        for d in 0..5 {
            let f = &mut p.f_ang[d];
            ang[d] = AngDedo { flex: f[0].filtrar(ang[d].flex, t, 1.0), abre: f[1].filtrar(ang[d].abre, t, 1.0), medio: f[2].filtrar(ang[d].medio, t, 1.0), punta: f[3].filtrar(ang[d].punta, t, 1.0) };
        }
        let armada: [V3; PUNTOS] = if p.cal.lista { esqueleto::armar(&m, &p.cal, &ang) } else { wl };
        // dónde está la mano: Z = f · largo real / largo en píxeles (con la proyección de los huesos de la palma, así una
        // palma inclinada no parece más lejos)
        let fpx = (w as f32 / 2.0) / (c.fov_grados.to_radians() / 2.0).tan();
        let (mut real, mut px) = (0f32, 0f32);
        for &(a, b) in &[(0usize, 5usize), (0, 17), (5, 17), (0, 9), (9, 13)] {
            let v = wv[b].menos(wv[a]); real += (v.x * v.x + v.y * v.y).sqrt(); px += dist(&r.img[a], &r.img[b]);
        }
        let z = if px > 1.0 { fpx * real / px } else { 0.5 };
        let (u, v) = ([0, 5, 9, 13, 17].iter().map(|&i| r.img[i].x).sum::<f32>() / 5.0, [0, 5, 9, 13, 17].iter().map(|&i| r.img[i].y).sum::<f32>() / 5.0);
        p.f_pos.filtrar([(u - w as f32 / 2.0) * z / fpx, (v - h as f32 / 2.0) * z / fpx, z], t, 0.1);
        let pos = p.f_pos.predecir(pred);
        // gestos
        let cierre = esqueleto::cierre(&ang);
        let tam = if p.cal.lista { p.cal.largos[8] } else { wv[9].menos(wv[0]).largo() };
        let (med, g) = gestos::medir(&armada, cierre, &ang, tam, V3::n(0.0, -1.0, 0.0));
        p.gesto.pasar(g);
        let n = esqueleto::normal_palma(&m);
        p.salida = Some(Mano {
            id: p.id, derecha: real_derecha, presencia: r.presencia, img,
            mundo: std::array::from_fn(|i| [armada[i].x, armada[i].y, armada[i].z]),
            posicion: pos, rotacion: m.cuaternion(), normal: [n.x, n.y, n.z], angulos: ang, medidas: med,
            gesto: p.gesto.actual, gesto_fuerza: p.gesto.fuerza, roi: r.roi, calibrada: p.cal.lista,
        });
    }
}
