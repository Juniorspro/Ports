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
    /// sin ninguna mano: buscar 1 de cada tantos cuadros (1 = todos; en un juego, 2: el detector es lo más pesado)
    pub buscar_cada: u32,
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
        Config { max_manos: 2, min_presencia: 0.5, min_palma: 0.5, cada_busqueda_ms: 500.0, buscar_cada: 1, prediccion_ms: 50.0, fov_grados: 66.0,
            // (medido con «banco video» moviendo 8 veces más rápido: con 0,08/100/1 los puntos se quedaban atrás, 1,20 %
            // de la mano contra 0,83 % del modelo solo; con 0,3/200/3 quedan en 0,88 % y quietos tiemblan 0,087 %,
            // 3 veces menos que el modelo solo)
            img_min_corte: 0.3, img_beta: 200.0, img_d_corte: 3.0, ang_min_corte: 1.2, ang_beta: 1.5 }
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

/// cuántos hilos, elegido midiendo en el celular mismo: con la mano a la vista prueba cada cantidad (de `tope` a 1, 12
/// cuadros cada una, sin contar los 2 primeros) y se queda con la de menor mediana; si dos están a menos de 5 %, la de
/// menos hilos (deja núcleos libres). Después, cada minuto, vuelve a probar la elegida y sus vecinas: cambia con la
/// temperatura, una grabación de pantalla o un juego al lado. En un celular con pocos núcleos grandes y otras cosas
/// corriendo, más hilos puede ser más lento: si el sistema saca a uno un momento, los otros lo esperan en cada capa.
#[derive(Default, Debug)]
pub struct AutoHilos { pub activo: bool, pub tope: usize, pub elegido: usize, probar: Vec<usize>, k: usize, muestras: Vec<f32>, res: Vec<(usize, f32)>, t_ult: f64 }

impl AutoHilos {
    fn paso(&mut self, t_ms: f64, ms: Option<f32>) {
        if !self.activo || self.tope == 0 { return; }
        if self.probar.is_empty() {
            let toca = self.elegido == 0 || t_ms - self.t_ult > 60_000.0;
            if toca && ms.is_some() {
                self.probar = if self.elegido == 0 { (1..=self.tope).rev().collect() } else { [self.elegido + 1, self.elegido, self.elegido.saturating_sub(1)].into_iter().filter(|&n| n >= 1 && n <= self.tope).collect() };
                self.k = 0; self.muestras.clear(); self.res.clear(); crate::hilos::configurar(self.probar[0]);
            }
            return;
        }
        let Some(ms) = ms else { return; };
        self.muestras.push(ms);
        if self.muestras.len() < 12 { return; }
        let mut m: Vec<f32> = self.muestras[2..].to_vec(); m.sort_by(|a, b| a.partial_cmp(b).unwrap());
        self.res.push((self.probar[self.k], m[m.len() / 2])); self.muestras.clear(); self.k += 1;
        if self.k < self.probar.len() { crate::hilos::configurar(self.probar[self.k]); return; }
        // el más rápido; con menos de 5 % de diferencia, el de menos hilos
        let mejor = self.res.iter().map(|r| r.1).fold(f32::INFINITY, f32::min);
        let n = self.res.iter().filter(|r| r.1 <= mejor * 1.05).map(|r| r.0).min().unwrap_or(self.tope);
        self.elegido = n; crate::hilos::configurar(n); self.probar.clear(); self.t_ult = t_ms;
    }
    /// lo medido en la última prueba: «4:6.1 3:5.2 2:6.8 1:11.0»
    pub fn texto(&self) -> String { self.res.iter().map(|(n, m)| format!("{}:{:.1}", n, m)).collect::<Vec<_>>().join(" ") }
    pub fn probando(&self) -> bool { !self.probar.is_empty() }
}

pub struct Motor {
    det: Detector, pun: Puntero, pistas: Vec<Pista>, sig_id: u32, ult_busqueda: f64, ult_detector: f64, pub cfg: Config, pub corrio_detector: bool, pub inferencias: u32,
    /// lo que tardó el detector en el cuadro (ms; 0 si no corrió acá)
    ms_det: f32,
    /// las manos que se perdieron hace poco (y cuándo, ms): se las vuelve a buscar en su último lugar, más grande, antes
    /// de correr el detector (un movimiento rápido saca la mano del cuadrado por un cuadro)
    perdidas: Vec<(Pista, f64)>,
    /// cuántos cuadros seguidos van sin mano (para buscar 1 de cada `buscar_cada`)
    sin_mano: u32,
    /// los hilos elegidos midiendo (ver `AutoHilos`)
    pub auto: AutoHilos,
    /// el que busca manos nuevas de fondo cuando ya hay alguna seguida (así no frena el cuadro: antes, cada 300 ms el
    /// cuadro que corría el detector tardaba el doble y se veía un tirón)
    #[cfg(not(target_arch = "wasm32"))]
    buscador: Option<Buscador>,
}

/// un detector en su propio hilo (en los núcleos chicos, sin el grupo de hilos): recibe una copia del cuadro y
/// devuelve las palmas que encontró
#[cfg(not(target_arch = "wasm32"))]
struct Buscador {
    a_hilo: std::sync::mpsc::Sender<(Vec<u8>, usize, usize, f32)>,
    de_hilo: std::sync::mpsc::Receiver<(Vec<mano::Palma>, Vec<u8>)>,
    ocupado: bool,
    libre: Vec<u8>,
}

#[cfg(not(target_arch = "wasm32"))]
impl Buscador {
    fn nuevo(modelo: &[u8]) -> Option<Buscador> {
        let mut det = Detector::nuevo(modelo).ok()?;
        let (tx, rx_hilo) = std::sync::mpsc::channel::<(Vec<u8>, usize, usize, f32)>();
        let (tx_hilo, rx) = std::sync::mpsc::channel();
        std::thread::Builder::new().name("jxhand-buscar".into()).spawn(move || {
            crate::hilos::solo_este_hilo(true);
            crate::hilos::ir_a_chicos();
            // (y con menos prioridad: si no hay núcleos chicos, o están ocupados, que no le saque el núcleo a los que dan
            // cada cuadro)
            crate::hilos::bajar_prioridad(10);
            // (cuando el motor se suelta, se cierra el canal y el hilo termina)
            while let Ok((img, w, h, umbral)) = rx_hilo.recv() {
                det.umbral = umbral;
                let ps = det.detectar(&img, w, h);
                if tx_hilo.send((ps, img)).is_err() { break; }
            }
        }).ok()?;
        Some(Buscador { a_hilo: tx, de_hilo: rx, ocupado: false, libre: Vec::new() })
    }
}

fn dist(a: &P3, b: &P3) -> f32 { ((a.x - b.x).powi(2) + (a.y - b.y).powi(2)).sqrt() }

impl Motor {
    pub fn nuevo(detector: &[u8], puntos: &[u8]) -> Result<Motor, String> {
        Ok(Motor { det: Detector::nuevo(detector)?, pun: Puntero::nuevo(puntos)?, pistas: vec![], sig_id: 1, ult_busqueda: -1e9, ult_detector: -1e9, cfg: Config::default(), corrio_detector: false, inferencias: 0, ms_det: 0.0, perdidas: Vec::new(), sin_mano: 0, auto: AutoHilos::default(),
            #[cfg(not(target_arch = "wasm32"))]
            buscador: Buscador::nuevo(detector) })
    }
    /// lo que tardaron las partes del último cuadro (ms): el recorte de las manos (con el realce), la red de los puntos y
    /// el detector (si corrió en el cuadro)
    pub fn tiempos(&mut self) -> (f32, f32, f32) { let r = (self.pun.ms_recorte, self.pun.ms_red, self.ms_det); self.pun.ms_recorte = 0.0; self.pun.ms_red = 0.0; r }
    pub fn reiniciar(&mut self) { self.perdidas.clear(); self.reiniciar_pistas(); }
    /// medir la red de los puntos por tipo de capa (prendido o apagado; al prender empieza de cero)
    pub fn perfil(&mut self, si: bool) { self.pun.perfil = if si { Some(Vec::new()) } else { None }; self.pun.perfil_n = 0; }
    /// lo medido, por corrida: «1x1 2.10 · dw5 0.80 · …» (los 6 que más tardan) y vuelve a empezar
    pub fn perfil_texto(&mut self) -> String {
        let n = self.pun.perfil_n.max(1) as f64;
        let Some(v) = self.pun.perfil.as_mut() else { return String::new(); };
        // (prendido pero sin corridas desde la última vez: «-», que queda lo anterior)
        if self.pun.perfil_n == 0 { return "-".into(); }
        let mut v2: Vec<(String, f64)> = v.iter().map(|(k, d, _)| (k.replace("Conv ", "c").replace("Depthwise ", "dw").replace("/1", "").replace("/2", "s2"), *d / n)).collect();
        v2.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        let tot: f64 = v2.iter().map(|x| x.1).sum();
        let s = format!("red {:.2} ms: {}", tot, v2.iter().take(6).map(|(k, d)| format!("{} {:.2}", k, d)).collect::<Vec<_>>().join(" · "));
        v.clear(); self.pun.perfil_n = 0; s
    }
    fn reiniciar_pistas(&mut self) { self.pistas.clear(); self.ult_busqueda = -1e9; self.ult_detector = -1e9; }
    /// el realce de poca luz: prendido o apagado (para el modelo de los puntos; el detector siempre promedia el ruido)
    pub fn poca_luz(&mut self, activo: bool) { self.pun.luz.activo = activo; self.det.acumular = activo; }
    /// cómo está la luz: (brillo medio del último recorte de una mano, 0..1; cuánto se aclaró, 1 = nada)
    pub fn luz(&self) -> (f32, f32) {
        if self.pistas.is_empty() { (self.det.realce.mediana, 1.0) } else { (self.pun.realce.mediana, self.pun.realce.ganancia) }
    }
    /// para medir velocidad: sólo un modelo, varias veces
    pub fn banco_puntos(&mut self, rgba: &[u8], w: usize, h: usize, veces: usize) {
        let roi = Roi { cx: w as f32 / 2.0, cy: h as f32 / 2.0, lado: w.min(h) as f32, ang: 0.0 };
        for _ in 0..veces { self.pun.puntos(rgba, w, h, &roi); }
    }
    pub fn banco_detector(&mut self, rgba: &[u8], w: usize, h: usize, veces: usize) { for _ in 0..veces { self.det.detectar(rgba, w, h); } }

    /// procesa un cuadro RGBA (`t_ms`: el reloj de la cámara); `espejada`: si la imagen viene como un espejo (selfie)
    pub fn procesar(&mut self, rgba: &[u8], w: usize, h: usize, t_ms: f64, espejada: bool) -> Vec<Mano> {
        let t = t_ms / 1000.0; self.corrio_detector = false; self.inferencias = 0; self.ms_det = 0.0; self.pun.ms_recorte = 0.0; self.pun.ms_red = 0.0;
        // 1) las manos que ya se seguían: puntos en su cuadrado
        let mut vivas = Vec::new();
        for mut p in std::mem::take(&mut self.pistas) {
            let mut r = self.pun.puntos(rgba, w, h, &p.roi); self.inferencias += 1;
            if r.presencia < self.cfg.min_presencia {
                // (se salió del cuadrado, casi siempre por un movimiento rápido: otra vez, en el mismo cuadro, con el
                // cuadrado más grande)
                let mut g = p.roi; g.lado *= 1.4;
                r = self.pun.puntos(rgba, w, h, &g); self.inferencias += 1;
                if r.presencia < self.cfg.min_presencia { self.perdidas.push((p, t_ms)); continue; }
            }
            self.actualizar(&mut p, r, w, h, t, espejada);
            vivas.push(p);
        }
        // 1b) las que se perdieron hace menos de 0,4 s: en su último lugar con el cuadrado más grande. Sigue la misma
        //     mano (sus filtros y su número) y cuesta una pasada de la red chica, no el detector
        self.perdidas.retain(|(_, t0)| t_ms - t0 < 400.0 && t_ms >= *t0);
        if vivas.len() < self.cfg.max_manos && !self.perdidas.is_empty() {
            for (mut p, t0) in std::mem::take(&mut self.perdidas) {
                if vivas.len() >= self.cfg.max_manos || t0 == t_ms { self.perdidas.push((p, t0)); continue; }
                let mut g = p.roi; g.lado *= 1.5;
                let r = self.pun.puntos(rgba, w, h, &g); self.inferencias += 1;
                if r.presencia < self.cfg.min_presencia { self.perdidas.push((p, t0)); continue; }
                self.actualizar(&mut p, r, w, h, t, espejada);
                vivas.push(p);
            }
        }
        if !vivas.is_empty() { self.sin_mano = 0; }
        // 2) buscar manos nuevas: siempre si no hay ninguna (acá mismo, con todos los núcleos: es lo más rápido para
        //    encontrar la primera); si ya hay alguna y faltan, cada tanto y de fondo (no frena el cuadro)
        // (sin mano y buscando 1 de cada N cuadros: en los otros no se corre nada)
        let saltar = vivas.is_empty() && { self.sin_mano += 1; self.cfg.buscar_cada > 1 && (self.sin_mano - 1) % self.cfg.buscar_cada != 0 };
        if !saltar && vivas.len() < self.cfg.max_manos && (vivas.is_empty() || t_ms - self.ult_busqueda >= self.cfg.cada_busqueda_ms) {
            #[allow(unused_mut)]
            let mut aca = vivas.is_empty();
            #[cfg(not(target_arch = "wasm32"))]
            if !aca {
                match self.buscador.as_mut() {
                    Some(b) => {
                        if !b.ocupado {
                            let mut buf = std::mem::take(&mut b.libre); buf.clear(); buf.extend_from_slice(rgba);
                            if b.a_hilo.send((buf, w, h, self.cfg.min_palma)).is_ok() { b.ocupado = true; }
                        }
                        self.ult_busqueda = t_ms;
                    }
                    None => aca = true,
                }
            }
            #[cfg(target_arch = "wasm32")]
            { aca = true; }
            if aca {
                self.ult_busqueda = t_ms; self.corrio_detector = true;
                self.det.umbral = self.cfg.min_palma;
                // (con poca luz el detector promedia con los cuadros anteriores, si vienen seguidos)
                self.det.seguido = t_ms - self.ult_detector < 120.0; self.ult_detector = t_ms;
                #[cfg(not(target_arch = "wasm32"))]
                let t0 = std::time::Instant::now();
                let palmas = self.det.detectar(rgba, w, h);
                #[cfg(not(target_arch = "wasm32"))]
                { self.ms_det = t0.elapsed().as_secs_f32() * 1e3; }
                self.sumar_palmas(palmas, &mut vivas, rgba, w, h, t, espejada);
            }
        }
        // 2b) lo que encontró el buscador de fondo (en un cuadro de hace un momento: la mano se movió poco, y el
        //     cuadrado se reacomoda solo con los puntos)
        #[cfg(not(target_arch = "wasm32"))]
        {
            let mut de_fondo = Vec::new();
            if let Some(b) = self.buscador.as_mut() {
                if b.ocupado { if let Ok((ps, buf)) = b.de_hilo.try_recv() { b.ocupado = false; b.libre = buf; de_fondo = ps; } }
            }
            if !de_fondo.is_empty() && vivas.len() < self.cfg.max_manos { self.sumar_palmas(de_fondo, &mut vivas, rgba, w, h, t, espejada); }
        }
        // 3) si dos pistas terminaron sobre la misma mano, queda la de más presencia
        vivas.sort_by(|a, b| b.salida.as_ref().map(|m| m.presencia).unwrap_or(0.0).partial_cmp(&a.salida.as_ref().map(|m| m.presencia).unwrap_or(0.0)).unwrap());
        let mut fin: Vec<Pista> = Vec::new();
        for p in vivas { if !fin.iter().any(|q| ((q.roi.cx - p.roi.cx).powi(2) + (q.roi.cy - p.roi.cy).powi(2)).sqrt() < q.roi.lado.min(p.roi.lado) * 0.3) { fin.push(p); } }
        fin.sort_by_key(|p| p.id);
        self.pistas = fin;
        // (los hilos elegidos midiendo: cuadros con mano, sin el detector en el cuadro; lo que tarda cada pasada de la red)
        #[cfg(not(target_arch = "wasm32"))]
        {
            let ms = if !self.pistas.is_empty() && !self.corrio_detector && self.inferencias > 0 { Some((self.pun.ms_recorte + self.pun.ms_red) / self.inferencias as f32) } else { None };
            self.auto.paso(t_ms, ms);
        }
        self.pistas.iter().filter_map(|p| p.salida.clone()).collect()
    }

    /// las palmas nuevas que no caen sobre una mano ya seguida pasan a ser pistas (con sus primeros puntos)
    #[allow(clippy::too_many_arguments)]
    fn sumar_palmas(&mut self, palmas: Vec<mano::Palma>, vivas: &mut Vec<Pista>, rgba: &[u8], w: usize, h: usize, t: f64, espejada: bool) {
        for pa in palmas {
            if vivas.len() >= self.cfg.max_manos { break; }
            let (cx, cy) = (pa.caja[0], pa.caja[1]);
            if vivas.iter().any(|v| ((v.roi.cx - cx).powi(2) + (v.roi.cy - cy).powi(2)).sqrt() < v.roi.lado * 0.45) { continue; }
            let roi = mano::roi_de_palma(&pa);
            let r = self.pun.puntos(rgba, w, h, &roi); self.inferencias += 1;
            if r.presencia < self.cfg.min_presencia { continue; }
            let f = Filtro3::nuevo(self.cfg.img_min_corte, self.cfg.img_beta, self.cfg.img_d_corte);
            let a = UnoEuro::nuevo(self.cfg.ang_min_corte, self.cfg.ang_beta, 1.0);
            let mut p = Pista { id: self.sig_id, roi, derecha_ema: r.derecha, geom_derecha: r.derecha > 0.5, f_img: [f; PUNTOS], f_ang: [[a; 4]; 5],
                f_pos: Filtro3::nuevo(0.6, 3.0, 1.0), f_ejes: [Filtro3::nuevo(1.0, 0.8, 1.0); 2], cal: Calibracion::default(), gesto: Estable::default(), salida: None };
            self.sig_id += 1;
            self.actualizar(&mut p, r, w, h, t, espejada);
            vivas.push(p);
        }
    }

    fn actualizar(&self, p: &mut Pista, r: mano::Puntos, w: usize, h: usize, t: f64, espejada: bool) {
        let c = &self.cfg;
        // derecha o izquierda: promedio con histéresis (no salta por un cuadro dudoso)
        p.derecha_ema += (r.derecha - p.derecha_ema) * 0.25;
        if p.geom_derecha && p.derecha_ema < 0.35 { p.geom_derecha = false; } else if !p.geom_derecha && p.derecha_ema > 0.65 { p.geom_derecha = true; }
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
