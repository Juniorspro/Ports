//! Los ajustes del jugador (como PREFS de la web): la calidad y lo que la arma (resolución, sombras, oclusión, reflejos,
//! retoque), la sensibilidad, el campo de visión, los fps en pantalla, el volumen y el ambiente. Se guardan en ajustes.txt,
//! en la carpeta de la app: una «clave=valor» por renglón (lo que no se entiende se deja como viene de fábrica).
use jxmotor::gpu::Opciones;

/// las calidades, como PERF_ORDEN de la web
pub const CALIDADES: [&str; 5] = ["Patata", "Bajo", "Medio", "Alto", "Ultra"];
/// la calidad «Personal»: se tocó algo a mano
pub const PERSONAL: usize = 5;
pub const RES: [u32; 5] = [50, 67, 75, 85, 100];
pub const SENS: [u32; 6] = [4, 8, 12, 16, 20, 26];
/// el campo de visión (grados de alto de la imagen, como CAM.fov: 70 el de siempre; la web va de 50 a 110)
pub const FOV: [u32; 6] = [60, 70, 80, 90, 100, 110];
pub const VOL: [u32; 5] = [0, 25, 50, 80, 100];
/// el tamaño de los botones (PREFS.hud de la web: 80 de fábrica; hudTam lo deja entre 60 y 120) y el de la palanca (palTam)
pub const TAM_HUD: [u32; 7] = [60, 70, 80, 90, 100, 110, 120];
pub const TAM_PAL: [u32; 6] = [60, 80, 100, 120, 140, 160];
/// la hora del día (dia.js: los botones del Anfitrión: amanecer, día, atardecer, noche)
pub const HORAS: [(&str, f32); 4] = [("Amanecer", 7.0), ("Día", 12.0), ("Atardecer", 17.5), ("Noche", 0.0)];

#[derive(Clone, Debug, PartialEq)]
pub struct Ajustes {
    /// 0 patata … 4 ultra (o PERSONAL)
    pub calidad: usize,
    /// la resolución de la escena (% de la pantalla)
    pub res: u32,
    pub sombras: bool, pub ao: bool, pub reflejo: bool, pub retoque: bool,
    /// la sensibilidad al mirar (12, la de la web)
    pub sens: u32,
    pub fov: u32,
    /// los fps y los tiempos arriba a la izquierda
    pub fps: bool,
    pub vol: u32, pub ambiente: bool,
    /// la hora del día y si avanza sola (como DIA de la web, no se guardan: cada vez empieza a las 12)
    pub hora: f32, pub ciclo: bool,
    /// Automático (PREFS.gfx 'auto', gfxauto.js): la calidad la elige la medida al entrar al primer mapa de la sesión;
    /// viene prendido, y el que tenía una calidad fija de antes pasa a Automático una vez (gfxAutoUnaVez)
    pub auto: bool,
    /// lo que salió la vez anterior (PREFS.gfxMedido): la calidad y el aparato (si cambia la placa, se vuelve a empezar)
    pub medido: Option<(usize, String)>,
    /// el tamaño de los botones y el de la palanca (en %) y los botones movidos o agrandados en el editor (hud_web.rs:
    /// «clave:ancla x,ancla y,x,y,tamaño;…», como PREFS.hudPos)
    pub hud: u32, pub pal: u32, pub hud_pos: String,
    /// el tutorial ya se vio (PREFS.tutVisto): no sale solo otra vez
    pub tut: bool,
    /// la ventana del contenido (elegir qué bajar) ya se vio: no sale sola otra vez
    pub cont: bool,
    /// la resolución dinámica: si el celular no llega a 45 cuadros por segundo, la escena se dibuja a menos píxeles (y vuelve a
    /// la elegida cuando sobra)
    pub dinamica: bool,
    /// el idioma elegido (su código: «en», «ja»…; si no se eligió, el del celular —o inglés, como la web—)
    pub idioma: Option<String>,
}
impl Default for Ajustes {
    fn default() -> Self { Ajustes { calidad: 4, res: 100, sombras: true, ao: true, reflejo: true, retoque: true, sens: 12, fov: 70, fps: true, vol: 80, ambiente: true, hora: 12.0, ciclo: false, auto: true, medido: None, hud: 80, pal: 100, hud_pos: String::new(), tut: false, cont: false, dinamica: false, idioma: None } }
}

/// lo que se puede tocar en el menú, un renglón cada uno
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Clave { Calidad, Res, Dinamica, Sombras, Ao, Reflejo, Retoque, Sens, Fov, Fps, Vol, Ambiente, Motor, Mapa, Hora, Ciclo, TamBotones, TamPalanca, Botones }
/// las pestañas del menú y sus renglones
pub const PESTANAS: [&str; 6] = ["Gráficos", "Controles", "Sonido", "Motor", "Mapa", "Día"];
pub fn claves(pestana: usize) -> &'static [Clave] {
    match pestana {
        0 => &[Clave::Calidad, Clave::Res, Clave::Dinamica, Clave::Sombras, Clave::Ao, Clave::Reflejo, Clave::Retoque],
        1 => &[Clave::Sens, Clave::Fov, Clave::Fps, Clave::TamBotones, Clave::TamPalanca, Clave::Botones],
        2 => &[Clave::Vol, Clave::Ambiente],
        3 => &[Clave::Motor],
        5 => &[Clave::Hora, Clave::Ciclo],
        _ => &[Clave::Mapa],
    }
}
pub fn nombre(c: Clave) -> &'static str {
    match c {
        Clave::Calidad => "Calidad", Clave::Res => "Resolución", Clave::Dinamica => "Resolución dinámica", Clave::Sombras => "Sombras", Clave::Ao => "Oclusión ambiental", Clave::Reflejo => "Reflejos del agua",
        Clave::Retoque => "Retoque de color", Clave::Sens => "Sensibilidad", Clave::Fov => "Campo de visión", Clave::Fps => "Mostrar fps", Clave::Vol => "Volumen",
        Clave::Ambiente => "Sonido del ambiente", Clave::Motor => "Motor", Clave::Mapa => "Mapa", Clave::Hora => "Hora", Clave::Ciclo => "Ciclo (2 horas por minuto)",
        Clave::TamBotones => "Tamaño de los botones", Clave::TamPalanca => "Tamaño de la palanca", Clave::Botones => "Botones de la pantalla",
    }
}
const NO_SI: [&str; 2] = ["No", "Sí"];

impl Ajustes {
    /// lee ajustes.txt (si no está o algo no se entiende: lo de fábrica)
    pub fn leer(txt: Option<&str>) -> Ajustes {
        let mut a = Ajustes::default();
        let Some(t) = txt else { return a };
        for l in t.lines() {
            let Some((k, v)) = l.split_once('=') else { continue };
            let (k, v) = (k.trim(), v.trim()); let n = v.parse::<u32>().ok(); let b = v == "1";
            match k {
                "calidad" => if let Some(n) = n { a.calidad = (n as usize).min(PERSONAL) },
                "res" => if let Some(n) = n { a.res = n.clamp(25, 100) },
                "sombras" => a.sombras = b, "ao" => a.ao = b, "reflejo" => a.reflejo = b, "retoque" => a.retoque = b,
                "sens" => if let Some(n) = n { a.sens = n.clamp(1, 40) },
                "fov" => if let Some(n) = n { a.fov = n.clamp(50, 110) },
                "fps" => a.fps = b, "vol" => if let Some(n) = n { a.vol = n.min(100) }, "ambiente" => a.ambiente = b,
                "auto" => a.auto = b,
                "hud" => if let Some(n) = n { a.hud = n.clamp(60, 120) }, "pal" => if let Some(n) = n { a.pal = n.clamp(60, 160) },
                "hudpos" => a.hud_pos = v.to_string(), "idioma" => if jxjuego::idiomas::de_codigo(v).is_some() { a.idioma = Some(v.to_string()) }, "tut" => a.tut = b, "cont" => a.cont = b, "din" => a.dinamica = b,
                "medido" => if let Some((q, g)) = v.split_once('|') { if let Ok(q) = q.parse::<usize>() { if q < 5 { a.medido = Some((q, g.to_string())) } } },
                _ => {}
            }
        }
        a
    }
    pub fn texto(&self) -> String {
        let b = |x: bool| if x { 1 } else { 0 };
        let mut t = format!("calidad={}\nres={}\nsombras={}\nao={}\nreflejo={}\nretoque={}\nsens={}\nfov={}\nfps={}\nvol={}\nambiente={}\nauto={}\n",
            self.calidad, self.res, b(self.sombras), b(self.ao), b(self.reflejo), b(self.retoque), self.sens, self.fov, b(self.fps), self.vol, b(self.ambiente), b(self.auto));
        if let Some((q, g)) = &self.medido { t += &format!("medido={q}|{}\n", g.replace('\n', " ")); }
        t += &format!("hud={}\npal={}\ntut={}\ncont={}\ndin={}\n", self.hud, self.pal, b(self.tut), b(self.cont), b(self.dinamica)); if !self.hud_pos.is_empty() { t += &format!("hudpos={}\n", self.hud_pos.replace('\n', "")); }
        if let Some(i) = &self.idioma { t += &format!("idioma={i}\n"); }
        t
    }
    /// pone una calidad entera (como gfx de la web: cada una con su resolución y sus pasadas)
    pub fn poner_calidad(&mut self, k: usize) {
        let (res, so, ao, re, rt) = match k { 0 => (50, false, false, false, false), 1 => (67, false, false, true, false), 2 => (85, true, false, true, true), 3 => (100, true, false, true, true), _ => (100, true, true, true, true) };
        self.calidad = k.min(4); self.res = res; self.sombras = so; self.ao = ao; self.reflejo = re; self.retoque = rt;
    }
    /// lo que va al motor: con calidad media o menos, la sombra de 1024 cada 2 cuadros y el reflejo a un cuarto
    pub fn opciones(&self) -> Opciones {
        let flojo = self.calidad <= 2; let muy = self.calidad <= 1;
        Opciones { escala: self.res as f32 / 100.0, sombras: self.sombras, sombra_px: if flojo { 1024 } else { 2048 }, sombra_cada: if flojo { 2 } else { 1 }, sombra_radio: if flojo { 35.0 } else { 45.0 },
            reflejo: self.reflejo, reflejo_div: if muy { 4 } else { 2 }, reflejo_cada: if muy { 2 } else { 1 }, ao: self.ao, ao_fuerza: 0.6, retoque: self.retoque, prepaso: true }
    }
    /// el volumen para el mezclador (80, el de fábrica, es 1: como quedó medido contra la web)
    pub fn volumen(&self) -> f32 { self.vol as f32 / 80.0 }
    /// lo que se puede elegir en un renglón (Motor y Mapa los arma el juego)
    pub fn valores(c: Clave) -> Vec<String> {
        let num = |v: &[u32], suf: &str| v.iter().map(|x| format!("{x}{suf}")).collect();
        match c {
            // (como el selector de la web: Automático primero y después las cinco)
            Clave::Calidad => std::iter::once("Automático").chain(CALIDADES).map(|s| s.to_string()).collect(),
            Clave::Res => num(&RES, "%"), Clave::Sens => num(&SENS, ""), Clave::Fov => num(&FOV, "°"), Clave::Vol => num(&VOL, "%"),
            Clave::Dinamica | Clave::Sombras | Clave::Ao | Clave::Reflejo | Clave::Retoque | Clave::Fps | Clave::Ambiente | Clave::Ciclo => NO_SI.iter().map(|s| s.to_string()).collect(),
            Clave::Hora => HORAS.iter().map(|h| h.0.to_string()).collect(),
            Clave::TamBotones => num(&TAM_HUD, "%"), Clave::TamPalanca => num(&TAM_PAL, "%"),
            // (el primero abre el editor —lo hace el juego—; el segundo vuelve todo a como viene)
            Clave::Botones => vec!["Mover y agrandar".into(), "De fábrica".into()],
            Clave::Motor | Clave::Mapa => vec![],
        }
    }
    /// cuál está elegido en un renglón (ninguno si el valor guardado no es uno de la lista)
    pub fn elegido(&self, c: Clave) -> Option<usize> {
        let pos = |v: &[u32], x: u32| v.iter().position(|y| *y == x);
        match c {
            Clave::Calidad => if self.auto { Some(0) } else if self.calidad < PERSONAL { Some(self.calidad + 1) } else { None },
            Clave::Res => pos(&RES, self.res), Clave::Sens => pos(&SENS, self.sens), Clave::Fov => pos(&FOV, self.fov), Clave::Vol => pos(&VOL, self.vol),
            Clave::Dinamica => Some(self.dinamica as usize), Clave::Sombras => Some(self.sombras as usize), Clave::Ao => Some(self.ao as usize), Clave::Reflejo => Some(self.reflejo as usize),
            Clave::Retoque => Some(self.retoque as usize), Clave::Fps => Some(self.fps as usize), Clave::Ambiente => Some(self.ambiente as usize),
            Clave::Hora => HORAS.iter().position(|h| h.1 == self.hora), Clave::Ciclo => Some(self.ciclo as usize),
            Clave::TamBotones => pos(&TAM_HUD, self.hud), Clave::TamPalanca => pos(&TAM_PAL, self.pal),
            Clave::Motor | Clave::Mapa | Clave::Botones => None,
        }
    }
    /// elige el valor `k` de un renglón (tocar algo de la calidad a mano la deja en «Personal»)
    pub fn elegir(&mut self, c: Clave, k: usize) {
        let toma = |v: &[u32]| v[k.min(v.len() - 1)];
        match c {
            Clave::Calidad => if k == 0 { self.auto = true } else { self.auto = false; self.poner_calidad(k - 1) },
            Clave::Res => { self.res = toma(&RES); self.calidad = PERSONAL; self.auto = false; }
            Clave::Dinamica => self.dinamica = k == 1,
            Clave::Sombras => { self.sombras = k == 1; self.calidad = PERSONAL; self.auto = false; }
            Clave::Ao => { self.ao = k == 1; self.calidad = PERSONAL; self.auto = false; }
            Clave::Reflejo => { self.reflejo = k == 1; self.calidad = PERSONAL; self.auto = false; }
            Clave::Retoque => { self.retoque = k == 1; self.calidad = PERSONAL; self.auto = false; }
            Clave::Sens => self.sens = toma(&SENS), Clave::Fov => self.fov = toma(&FOV), Clave::Vol => self.vol = toma(&VOL),
            Clave::Fps => self.fps = k == 1, Clave::Ambiente => self.ambiente = k == 1,
            Clave::Hora => self.hora = HORAS[k.min(HORAS.len() - 1)].1, Clave::Ciclo => self.ciclo = k == 1,
            Clave::TamBotones => self.hud = toma(&TAM_HUD), Clave::TamPalanca => self.pal = toma(&TAM_PAL),
            // (De fábrica: los lugares, el tamaño y la palanca como vienen —hudFab de la web—)
            Clave::Botones => if k == 1 { self.hud_pos.clear(); self.hud = 80; self.pal = 100; },
            Clave::Motor | Clave::Mapa => {}
        }
        // (si lo tocado a mano coincide con una calidad entera, vuelve a ser esa)
        if self.calidad == PERSONAL {
            for q in 0..5 { let mut p = self.clone(); p.poner_calidad(q); let mut yo = self.clone(); yo.calidad = q; if p == yo { self.calidad = q; break; } }
        }
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn ida_y_vuelta() {
        let mut a = Ajustes::default(); a.elegir(Clave::Sens, 4); a.elegir(Clave::Ao, 0); a.elegir(Clave::Vol, 1);
        assert_eq!(a.calidad, 3, "ultra sin oclusión es alto"); let b = Ajustes::leer(Some(&a.texto())); assert_eq!(a, b);
        a.elegir(Clave::Res, 0); assert_eq!(a.calidad, PERSONAL);
        assert_eq!(Ajustes::leer(Some("basura\nres=999\nfov=5")).res, 100);
        // (Automático: viene prendido, el que no lo tenía guardado pasa a Automático, tocar una calidad lo apaga)
        assert!(Ajustes::default().auto && Ajustes::leer(Some("calidad=2")).auto);
        let mut c = Ajustes::default(); c.elegir(Clave::Calidad, 3); assert!(!c.auto && c.calidad == 2 && c.elegido(Clave::Calidad) == Some(3));
        c.medido = Some((3, "OpenGL 3|Adreno 640|2340x1080".into())); let d = Ajustes::leer(Some(&c.texto())); assert_eq!(c, d);
        c.elegir(Clave::Calidad, 0); assert!(c.auto && c.elegido(Clave::Calidad) == Some(0));
    }
}
