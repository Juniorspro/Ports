//! Los ajustes del jugador (como PREFS de la web): la calidad y lo que la arma (resolución, sombras, oclusión, reflejos,
//! retoque), la sensibilidad, el campo de visión, los fps en pantalla, el volumen y el ambiente. Se guardan en ajustes.txt,
//! en la carpeta de la app: una «clave=valor» por renglón (lo que no se entiende se deja como viene de fábrica).
use jxmotor::gpu::Opciones;

/// las calidades, como PERF_ORDEN de la web
/// (Definitivo, arriba de Ultra, es propio de la nativa: el cielo con nubes, el resplandor, el color de película y la luz en
/// el aire más fina)
pub const CALIDADES: [&str; 6] = ["Patata", "Bajo", "Medio", "Alto", "Ultra", "Definitivo"];
/// la calidad «Personal»: se tocó algo a mano
pub const PERSONAL: usize = 6;
/// la resolución de la escena (% de la pantalla): aparte de la calidad —tocarla no cambia la luz ni pasa a «Personal»—; 0 es
/// Automática (la de cada calidad: RES_CALIDAD). Con menos de 100 la imagen se estira con el filtro de reescalado del motor
pub const RES: [u32; 11] = [0, 10, 20, 30, 40, 50, 60, 67, 75, 85, 100];
/// la resolución de cada calidad con la resolución en Automática (Patata, Bajo, Medio, Alto, Ultra, Definitivo, Personal)
pub const RES_CALIDAD: [u32; 7] = [50, 67, 85, 100, 100, 100, 100];
pub const SENS: [u32; 6] = [4, 8, 12, 16, 20, 26];
/// el campo de visión (grados de alto de la imagen, como CAM.fov: 70 el de siempre; la web va de 50 a 110)
pub const FOV: [u32; 6] = [60, 70, 80, 90, 100, 110];
pub const VOL: [u32; 5] = [0, 25, 50, 80, 100];
/// el tamaño de los botones (PREFS.hud de la web: 80 de fábrica; hudTam lo deja entre 60 y 120) y el de la palanca (palTam)
pub const TAM_HUD: [u32; 7] = [60, 70, 80, 90, 100, 110, 120];
pub const TAM_PAL: [u32; 6] = [60, 80, 100, 120, 140, 160];
/// el tamaño de los menús (aero::ESCALA)
pub const TAM_MENUS: [u32; 6] = [60, 70, 80, 90, 100, 110];
/// la hora del día (dia.js: los botones del Anfitrión: amanecer, día, atardecer, noche)
pub const HORAS: [(&str, f32); 4] = [("Amanecer", 7.0), ("Día", 12.0), ("Atardecer", 17.5), ("Noche", 0.0)];

#[derive(Clone, Debug, PartialEq)]
pub struct Ajustes {
    /// 0 patata … 4 ultra (o PERSONAL)
    pub calidad: usize,
    /// la resolución de la escena (% de la pantalla; 0: Automática, la de la calidad) — `res_efectiva`
    pub res: u32,
    pub sombras: bool, pub ao: bool, pub reflejo: bool, pub retoque: bool,
    /// la sensibilidad al mirar (12, la de la web)
    pub sens: u32,
    pub fov: u32,
    /// los fps y los tiempos arriba a la izquierda
    pub fps: bool,
    pub vol: u32, pub ambiente: bool,
    /// el sonido espacial (acustica.rs): eco y reverberación del lugar, paredes que tapan, la cabeza
    pub espacial: bool,
    /// la voz por cercanía de los demás (vozcerca.rs): oírla
    pub voces: bool,
    /// el límite de NPC (como en la web: 24, 50, 100, 200 o sin límite —0—)
    pub npc_max: usize,
    /// ocultar la interfaz (queda sólo la pausa: para capturas y videos)
    pub sin_ui: bool,
    /// las fichas de arriba con quién está hablando por la voz
    pub quien: bool,
    /// el botón de emotes abre la ruleta (si no, la lista de emotes)
    pub ruleta: bool,
    /// la munición limitada (como en GMod: Props → Munición)
    pub mun_lim: bool,
    /// el límite de cuadros por segundo: 0 al ritmo de la pantalla (sincronizado); si no, sin sincronizar y frenado en ese
    /// número (FPS_MAX; 9999: sin límite —JX Turbo suma un intermedio por cada cuadro real aunque la pantalla no los muestre—)
    pub fps_max: u32,
    /// la reconstrucción temporal: con la resolución baja, juntar varios cuadros corridos (se ve como más resolución)
    pub taa: bool,
    /// el cielo: 0 automático (el Frutiger propio en los mapas que traen el fondo de Windows 7), 1 el del mapa, 2 Frutiger siempre
    pub cielo: u8,
    /// el gráfico Simple (en Calidad, después de Definitivo): sombras y nada más, para los celulares más flojos
    pub simple: bool,
    /// la distancia de dibujo de los props de los mapas (%: 50 más liviano … 150 más lejos)
    pub dist: u32,
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
    /// JX Turbo: los cuadros intermedios (se dibuja uno de verdad y el siguiente se arma corriéndolo a la cámara nueva)
    pub turbo: bool,
    /// el idioma elegido (su código: «en», «ja»…; si no se eligió, el del celular —o inglés, como la web—)
    pub idioma: Option<String>,
    /// la música del menú (musica_juego.rs: la estación Casual)
    pub musica: bool,
    /// el tamaño de los menús (aero.rs: el inicio, la pausa, el menú de objetos y las ventanas), en %
    pub menus: u32,
}
impl Default for Ajustes {
    fn default() -> Self { Ajustes { calidad: 4, res: 0, sombras: true, ao: true, reflejo: true, retoque: true, sens: 12, fov: 70, fps: true, vol: 80, ambiente: true, espacial: true, voces: true, npc_max: 24, sin_ui: false, quien: true, ruleta: true, mun_lim: false, fps_max: 0, taa: true, cielo: 0, simple: false, dist: 100, hora: 12.0, ciclo: false, auto: true, medido: None, hud: 80, pal: 100, hud_pos: String::new(), tut: false, cont: false, dinamica: true, turbo: true, idioma: None, musica: true, menus: 80 } }
}

/// lo que se puede tocar en el menú, un renglón cada uno
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Clave { Calidad, Res, Taa, Dinamica, Turbo, FpsMax, Sombras, Ao, Reflejo, Retoque, Sens, Fov, Fps, Vol, Ambiente, Espacial, Voces, Quien, Ruleta, Logo, NpcMax, Dist, MiMusica, SinUi, Musica, TamMenus, Motor, Comparar, Mapa, Hora, Ciclo, TamBotones, TamPalanca, Botones, Cielo }
/// las pestañas del menú y sus renglones
pub const DIST: [u32; 4] = [50, 75, 100, 150];
/// los límites de fps (0: el de la pantalla, sincronizado; 9999: sin límite)
pub const FPS_MAX: [u32; 8] = [0, 30, 60, 90, 120, 144, 240, 9999];
pub const PESTANAS: [&str; 6] = ["Gráficos", "Controles", "Sonido", "Motor", "Mapa", "Día"];
pub fn claves(pestana: usize) -> &'static [Clave] {
    match pestana {
        0 => &[Clave::Calidad, Clave::Res, Clave::Taa, Clave::Dinamica, Clave::Turbo, Clave::FpsMax, Clave::Sombras, Clave::Ao, Clave::Reflejo, Clave::Retoque, Clave::NpcMax, Clave::Dist, Clave::Cielo],
        1 => &[Clave::Sens, Clave::Fov, Clave::Fps, Clave::SinUi, Clave::Ruleta, Clave::Logo, Clave::TamMenus, Clave::TamBotones, Clave::TamPalanca, Clave::Botones],
        2 => &[Clave::Vol, Clave::MiMusica, Clave::Ambiente, Clave::Espacial, Clave::Voces, Clave::Quien, Clave::Musica],
        3 => &[Clave::Motor, Clave::Comparar],
        5 => &[Clave::Hora, Clave::Ciclo],
        _ => &[Clave::Mapa],
    }
}
pub fn nombre(c: Clave) -> &'static str {
    match c {
        Clave::Calidad => "Calidad", Clave::Res => "Resolución", Clave::Dinamica => "Resolución dinámica", Clave::Turbo => "JX Turbo (más fps)", Clave::Sombras => "Sombras", Clave::Ao => "Oclusión ambiental", Clave::Reflejo => "Reflejos del agua",
        Clave::Retoque => "Post-procesado (retoque de color)", Clave::Sens => "Sensibilidad", Clave::Fov => "Campo de visión", Clave::Fps => "Mostrar fps", Clave::Vol => "Volumen",
        Clave::Ambiente => "Sonido del ambiente", Clave::Espacial => "Sonido espacial (eco y paredes)", Clave::Voces => "Escuchar la voz de los demás", Clave::NpcMax => "Límite de NPC", Clave::Quien => "Mostrar quién habla", Clave::FpsMax => "Límite de fps", Clave::Taa => "Reconstrucción temporal (resolución baja nítida)", Clave::Cielo => "Cielo", Clave::Logo => "Tu logo", Clave::Ruleta => "El botón de emotes abre la ruleta", Clave::Dist => "Distancia de dibujo", Clave::SinUi => "Ocultar la interfaz (queda la pausa)", Clave::MiMusica => "Mi música (tu lista de YouTube)", Clave::Musica => "Música del menú", Clave::Motor => "Motor", Clave::Comparar => "Comparar los motores", Clave::Mapa => "Mapa", Clave::Hora => "Hora", Clave::Ciclo => "Ciclo (2 horas por minuto)",
        Clave::TamMenus => "Tamaño de los menús", Clave::TamBotones => "Tamaño de los botones", Clave::TamPalanca => "Tamaño de la palanca", Clave::Botones => "Botones de la pantalla",
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
                // (calidad: la de antes de Definitivo, con Personal en 5; calidad2: la de ahora, que va después y manda)
                "calidad" => if let Some(n) = n { a.calidad = if n >= 5 { PERSONAL } else { n as usize } },
                "calidad2" => if let Some(n) = n { a.calidad = (n as usize).min(PERSONAL) },
                // («res» era la de la calidad —la ponía cada calidad—: ahora va aparte en «res2»; la de antes queda en Automática)
                "res2" => if let Some(n) = n { a.res = if n == 0 { 0 } else { n.clamp(10, 100) } },
                "sombras" => a.sombras = b, "ao" => a.ao = b, "reflejo" => a.reflejo = b, "retoque" => a.retoque = b,
                "sens" => if let Some(n) = n { a.sens = n.clamp(1, 40) },
                "fov" => if let Some(n) = n { a.fov = n.clamp(50, 110) },
                "fps" => a.fps = b, "musica" => a.musica = b, "menus" => if let Some(n) = n { a.menus = n.clamp(50, 120) }, "vol" => if let Some(n) = n { a.vol = n.min(100) }, "ambiente" => a.ambiente = b, "espacial" => a.espacial = b, "voces" => a.voces = b, "sinui" => a.sin_ui = b, "quien" => a.quien = b, "ruleta" => a.ruleta = b, "munlim" => a.mun_lim = b, "taa" => a.taa = b, "cielo" => if let Some(n) = n { a.cielo = n.min(2) as u8 }, "simple" => a.simple = b, "fpsmax" => if let Some(n) = n { a.fps_max = if FPS_MAX.contains(&n) { n } else { 0 } }, "dist" => if let Some(n) = n { a.dist = if DIST.contains(&n) { n } else { 100 } }, "npcmax" => if let Some(n) = n { a.npc_max = if [0, 24, 50, 100, 200].contains(&(n as usize)) { n as usize } else { 24 } },
                "auto" => a.auto = b,
                "hud" => if let Some(n) = n { a.hud = n.clamp(60, 120) }, "pal" => if let Some(n) = n { a.pal = n.clamp(60, 160) },
                "hudpos" => a.hud_pos = v.to_string(), "idioma" => if jxjuego::idiomas::de_codigo(v).is_some() { a.idioma = Some(v.to_string()) }, "tut" => a.tut = b, "cont" => a.cont = b, "din2" => a.dinamica = b, "turbo" => a.turbo = b,
                "medido" => if let Some((q, g)) = v.split_once('|') { if let Ok(q) = q.parse::<usize>() { if q < 5 { a.medido = Some((q, g.to_string())) } } },
                _ => {}
            }
        }
        a
    }
    pub fn texto(&self) -> String {
        let b = |x: bool| if x { 1 } else { 0 };
        let mut t = format!("calidad={}\nres2={}\nsombras={}\nao={}\nreflejo={}\nretoque={}\nsens={}\nfov={}\nfps={}\nvol={}\nambiente={}\nauto={}\n",
            if self.calidad >= 5 { if self.calidad == PERSONAL { 5 } else { 4 } } else { self.calidad }, self.res, b(self.sombras), b(self.ao), b(self.reflejo), b(self.retoque), self.sens, self.fov, b(self.fps), self.vol, b(self.ambiente), b(self.auto));
        if let Some((q, g)) = &self.medido { t += &format!("medido={q}|{}\n", g.replace('\n', " ")); }
        t += &format!("hud={}\npal={}\ntut={}\ncont={}\ndin2={}\nturbo={}\nmusica={}\nmenus={}\n", self.hud, self.pal, b(self.tut), b(self.cont), b(self.dinamica), b(self.turbo), b(self.musica), self.menus); t += &format!("espacial={}\nvoces={}\nnpcmax={}\nsinui={}\nquien={}\ndist={}\nruleta={}\nmunlim={}\nfpsmax={}\ntaa={}\ncielo={}\nsimple={}\n", b(self.espacial), b(self.voces), self.npc_max, b(self.sin_ui), b(self.quien), self.dist, b(self.ruleta), b(self.mun_lim), self.fps_max, b(self.taa), self.cielo, b(self.simple)); if !self.hud_pos.is_empty() { t += &format!("hudpos={}\n", self.hud_pos.replace('\n', "")); }
        if let Some(i) = &self.idioma { t += &format!("idioma={i}\n"); }
        // (la calidad con Definitivo: va al final para mandar sobre «calidad»; ésa queda para las versiones de antes —Personal en 5—)
        t += &format!("calidad2={}\n", self.calidad);
        t
    }
    /// pone una calidad entera (como gfx de la web: cada una con su resolución y sus pasadas)
    /// (la resolución queda como está: va aparte)
    pub fn poner_calidad(&mut self, k: usize) {
        // (como Hyper Sandbox —sin sondas de reflejo en las bajas—: Patata y Bajo sin el reflejo del piso, que dibuja la escena otra
        // vez; de Medio para arriba sí —medido: a un tercio y cada 2 cuadros casi no cuesta—)
        let (so, ao, re, rt) = match k { 0 | 1 => (false, false, false, false), 2 | 3 => (true, false, true, true), _ => (true, true, true, true) };
        self.calidad = k.min(CALIDADES.len() - 1); self.sombras = so; self.ao = ao; self.reflejo = re; self.retoque = rt;
    }
    /// la resolución con la que se dibuja la escena (% de la pantalla): la elegida o, en Automática, la de la calidad
    pub fn res_efectiva(&self) -> u32 { if self.res == 0 { RES_CALIDAD[self.calidad.min(RES_CALIDAD.len() - 1)] } else { self.res.clamp(10, 100) } }
    /// lo que va al motor: con calidad media o menos, la sombra de 1024 y el reflejo a un cuarto; hasta Ultra la sombra y el
    /// reflejo se rehacen un cuadro sí y uno no (los celulares flojos: el TCL 20 SE); Definitivo, todo cada cuadro
    pub fn opciones(&self) -> Opciones {
        // (las sombras por calidad, como los niveles de Hyper Sandbox —«Low Shadow» 15 m y «Simple» 20 m con una sola cascada;
        // «Hight Shadow» con dos—: Patata y Bajo —si se prenden— y Simple, una sola cascada centrada y chica; de Medio para
        // arriba, las dos. Definitivo: el reflejo del piso cada 2 cuadros y la sombra hasta 50 m)
        let k = self.calidad.min(5); let muy = k <= 1;
        let mut o = Opciones { escala: self.res_efectiva() as f32 / 100.0, sombras: self.sombras, sombra_px: [512, 512, 1024, 1024, 2048, 2048][k], sombra_cada: [3, 3, 2, 2, 2, 1][k], sombra_radio: [20.0, 25.0, 35.0, 45.0, 45.0, 50.0][k], cascadas: [1, 1, 2, 2, 2, 2][k],
            reflejo: self.reflejo, reflejo_div: if muy { 4 } else if k == 5 { 2 } else { 3 }, reflejo_cada: 2, ao: self.ao, ao_fuerza: if self.calidad == 5 { 1.0 } else { 0.6 }, retoque: self.retoque, adapta: self.retoque, prepaso: true, rayos: self.calidad >= 4, hongo: self.calidad.min(4) as u8, aaa: self.calidad == 5, turbo: self.turbo, taa: self.taa, cielo_frutiger: self.cielo == 2, simple: self.simple };
        // (Simple —como Hyper Sandbox—: sólo la sombra del sol, chica y cada 3 cuadros; sin reflejos, oclusión, rayos, retoque,
        // exposición, resplandor ni luces de las cosas —comun.rs—: lo más liviano que sigue viéndose con sombras)
        if self.simple { o.sombras = true; o.sombra_px = 512; o.sombra_cada = 3; o.sombra_radio = 20.0; o.cascadas = 1; o.reflejo = false; o.ao = false; o.retoque = false; o.adapta = false; o.rayos = false; o.hongo = 1; o.aaa = false; }
        o
    }
    /// el volumen para el mezclador (80, el de fábrica, es 1: como quedó medido contra la web)
    pub fn volumen(&self) -> f32 { self.vol as f32 / 80.0 }
    /// lo que se puede elegir en un renglón (Motor y Mapa los arma el juego)
    pub fn valores(c: Clave) -> Vec<String> {
        let num = |v: &[u32], suf: &str| v.iter().map(|x| format!("{x}{suf}")).collect();
        match c {
            // (como el selector de la web: Automático primero y después las cinco)
            Clave::Calidad => std::iter::once("Automático").chain(CALIDADES).chain(std::iter::once("Simple")).map(|s| s.to_string()).collect(),
            Clave::Res => RES.iter().map(|x| if *x == 0 { "Automática".to_string() } else { format!("{x}%") }).collect(), Clave::Sens => num(&SENS, ""), Clave::Fov => num(&FOV, "°"), Clave::Vol => num(&VOL, "%"),
            Clave::Dinamica | Clave::Turbo | Clave::Sombras | Clave::Ao | Clave::Reflejo | Clave::Retoque | Clave::Fps | Clave::Ambiente | Clave::Espacial | Clave::Voces | Clave::Quien | Clave::Ruleta | Clave::Taa | Clave::SinUi | Clave::Musica | Clave::Ciclo => NO_SI.iter().map(|s| s.to_string()).collect(),
            Clave::Cielo => vec!["Automático".into(), "El del mapa".into(), "Frutiger".into()],
            Clave::Hora => HORAS.iter().map(|h| h.0.to_string()).collect(),
            Clave::TamMenus => num(&TAM_MENUS, "%"), Clave::TamBotones => num(&TAM_HUD, "%"), Clave::TamPalanca => num(&TAM_PAL, "%"),
            // (el primero abre el editor —lo hace el juego—; el segundo vuelve todo a como viene)
            Clave::Botones => vec!["Mover y agrandar".into(), "De fábrica".into()],
            Clave::NpcMax => ["24", "50", "100", "200", "Sin límite"].iter().map(|x| x.to_string()).collect(),
            Clave::MiMusica => vec!["Abrir".into()], Clave::Logo => vec!["Elegir una imagen".into(), "El de JXMod".into(), "Acceso directo".into()], Clave::FpsMax => FPS_MAX.iter().map(|x| match *x { 0 => "Pantalla".to_string(), 9999 => "Sin límite".to_string(), n => n.to_string() }).collect(), Clave::Dist => num(&DIST, "%"),
            Clave::Motor | Clave::Mapa => vec![],
            // (la comparación de FPS entre los motores: la arranca el juego, banco_juego.rs)
            Clave::Comparar => vec!["Empezar".into()],
        }
    }
    /// cuál está elegido en un renglón (ninguno si el valor guardado no es uno de la lista)
    pub fn elegido(&self, c: Clave) -> Option<usize> {
        let pos = |v: &[u32], x: u32| v.iter().position(|y| *y == x);
        match c {
            Clave::Calidad => if self.simple { Some(CALIDADES.len() + 1) } else if self.auto { Some(0) } else if self.calidad < PERSONAL { Some(self.calidad + 1) } else { None },
            Clave::Res => pos(&RES, self.res), Clave::Sens => pos(&SENS, self.sens), Clave::Fov => pos(&FOV, self.fov), Clave::Vol => pos(&VOL, self.vol),
            Clave::Dinamica => Some(self.dinamica as usize), Clave::Turbo => Some(self.turbo as usize), Clave::Sombras => Some(self.sombras as usize), Clave::Ao => Some(self.ao as usize), Clave::Reflejo => Some(self.reflejo as usize),
            Clave::Retoque => Some(self.retoque as usize), Clave::Fps => Some(self.fps as usize), Clave::Ambiente => Some(self.ambiente as usize), Clave::Espacial => Some(self.espacial as usize), Clave::Voces => Some(self.voces as usize), Clave::NpcMax => [24usize, 50, 100, 200, 0].iter().position(|x| *x == self.npc_max), Clave::SinUi => Some(self.sin_ui as usize), Clave::Quien => Some(self.quien as usize), Clave::Taa => Some(self.taa as usize), Clave::Cielo => Some(self.cielo.min(2) as usize), Clave::FpsMax => FPS_MAX.iter().position(|x| *x == self.fps_max), Clave::Ruleta => Some(self.ruleta as usize), Clave::Dist => DIST.iter().position(|x| *x == self.dist), Clave::Musica => Some(self.musica as usize),
            Clave::Hora => HORAS.iter().position(|h| h.1 == self.hora), Clave::Ciclo => Some(self.ciclo as usize),
            Clave::TamMenus => pos(&TAM_MENUS, self.menus), Clave::TamBotones => pos(&TAM_HUD, self.hud), Clave::TamPalanca => pos(&TAM_PAL, self.pal),
            Clave::Motor | Clave::MiMusica | Clave::Logo | Clave::Mapa | Clave::Botones | Clave::Comparar => None,
        }
    }
    /// elige el valor `k` de un renglón (tocar algo de la calidad a mano la deja en «Personal»)
    pub fn elegir(&mut self, c: Clave, k: usize) {
        let toma = |v: &[u32]| v[k.min(v.len() - 1)]; let antes = self.calidad;
        match c {
            Clave::Calidad => if k == CALIDADES.len() + 1 { self.simple = true; self.auto = false; self.poner_calidad(1); self.sombras = true; } else { self.simple = false; if k == 0 { self.auto = true } else { self.auto = false; self.poner_calidad(k - 1) } },
            // (la resolución va aparte: no toca la calidad ni Automático)
            Clave::Res => self.res = toma(&RES),
            Clave::Dinamica => self.dinamica = k == 1,
            Clave::Turbo => self.turbo = k == 1,
            Clave::Sombras => { self.sombras = k == 1; self.calidad = PERSONAL; self.auto = false; }
            Clave::Ao => { self.ao = k == 1; self.calidad = PERSONAL; self.auto = false; }
            Clave::Reflejo => { self.reflejo = k == 1; self.calidad = PERSONAL; self.auto = false; }
            Clave::Retoque => { self.retoque = k == 1; self.calidad = PERSONAL; self.auto = false; }
            Clave::Sens => self.sens = toma(&SENS), Clave::Fov => self.fov = toma(&FOV), Clave::Vol => self.vol = toma(&VOL),
            Clave::Fps => self.fps = k == 1, Clave::Ambiente => self.ambiente = k == 1, Clave::Espacial => self.espacial = k == 1, Clave::Voces => self.voces = k == 1, Clave::NpcMax => self.npc_max = [24usize, 50, 100, 200, 0][k.min(4)], Clave::SinUi => self.sin_ui = k == 1, Clave::Quien => self.quien = k == 1, Clave::Taa => self.taa = k == 1, Clave::Cielo => self.cielo = k.min(2) as u8, Clave::FpsMax => self.fps_max = FPS_MAX[k.min(FPS_MAX.len() - 1)], Clave::Ruleta => self.ruleta = k == 1, Clave::Dist => self.dist = DIST[k.min(DIST.len() - 1)], Clave::Musica => self.musica = k == 1,
            Clave::Hora => self.hora = HORAS[k.min(HORAS.len() - 1)].1, Clave::Ciclo => self.ciclo = k == 1,
            Clave::TamMenus => self.menus = toma(&TAM_MENUS), Clave::TamBotones => self.hud = toma(&TAM_HUD), Clave::TamPalanca => self.pal = toma(&TAM_PAL),
            // (De fábrica: los lugares, el tamaño y la palanca como vienen —hudFab de la web—)
            Clave::Botones => if k == 1 { self.hud_pos.clear(); self.hud = 80; self.pal = 100; },
            Clave::Motor | Clave::MiMusica | Clave::Logo | Clave::Mapa | Clave::Comparar => {}
        }
        // (si lo tocado a mano coincide con una calidad entera, vuelve a ser esa)
        if self.calidad == PERSONAL {
            // (primero la que estaba; si no, de la más alta a la más baja —Medio y Alto prenden lo mismo, cambia el tamaño de la sombra
            // y del reflejo: queda Alto—; Definitivo sólo si era Definitivo: prende lo mismo que Ultra y pesa más)
            let orden = std::iter::once(antes).filter(|q| *q < CALIDADES.len()).chain((0..CALIDADES.len() - 1).rev());
            for q in orden { let mut p = self.clone(); p.poner_calidad(q); let mut yo = self.clone(); yo.calidad = q; if p == yo { self.calidad = q; break; } }
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
        // (la resolución va aparte: tocarla no cambia la calidad; 10 % es lo menos; Automática es la de la calidad)
        let q = a.calidad; a.elegir(Clave::Res, 1); assert_eq!((a.calidad, a.res, a.res_efectiva()), (q, 10, 10)); assert_eq!(Ajustes::leer(Some(&a.texto())).res, 10);
        a.elegir(Clave::Calidad, 1); assert_eq!(a.res_efectiva(), 10, "la calidad no pisa la resolución elegida");
        a.elegir(Clave::Res, 0); assert_eq!(a.res_efectiva(), 50); a.elegir(Clave::Calidad, 5); assert_eq!(a.res_efectiva(), 100);
        let mut x = Ajustes::default(); x.elegir(Clave::Calidad, 6); x.elegir(Clave::Res, 3); assert_eq!(x.calidad, 5, "Definitivo sigue siendo Definitivo");
        let mut y = Ajustes::default(); y.elegir(Clave::Calidad, 5); y.elegir(Clave::Ao, 0); y.elegir(Clave::Ao, 1); assert_eq!(y.calidad, 4, "Ultra no pasa a Definitivo");
        assert_eq!(Ajustes::leer(Some("basura\nres2=999\nfov=5")).res, 100); assert_eq!(Ajustes::leer(Some("res=67")).res, 0); assert_eq!(Ajustes::leer(Some("res2=5")).res, 10);
        // (Automático: viene prendido, el que no lo tenía guardado pasa a Automático, tocar una calidad lo apaga)
        assert!(Ajustes::default().auto && Ajustes::leer(Some("calidad=2")).auto);
        let mut c = Ajustes::default(); c.elegir(Clave::Calidad, 3); assert!(!c.auto && c.calidad == 2 && c.elegido(Clave::Calidad) == Some(3));
        c.medido = Some((3, "OpenGL 3|Adreno 640|2340x1080".into())); let d = Ajustes::leer(Some(&c.texto())); assert_eq!(c, d);
        c.elegir(Clave::Calidad, 0); assert!(c.auto && c.elegido(Clave::Calidad) == Some(0));
    }
}
