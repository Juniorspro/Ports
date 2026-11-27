//! Lo del menú que se ve jugando: el botón de pausa arriba a la izquierda (el primero de la fila del sistema de hudorden.js,
//! en la esquina, redondo y con su ícono, como el de hud.js) y la pausa (ui.js abrirPausa y #pausa de template.html: Seguir
//! en amarillo; las tarjetas Personaje, Arma en la mano, Social, Ajustes, Ver el tutorial y Borrar todo; abajo Salir al
//! menú, Guardar, Cargar, VR, Grabar y los cuadros por segundo). Desde la pausa se abren los paneles del inicio (Personajes,
//! Social) encima del juego y «Volver» vuelve a la pausa. Y la pantalla de carga al empezar una partida (la foto del mapa,
//! el logo y su nombre).
use super::*;
use super::inicio_juego::{AMA, TX};
use super::paneles_juego::PanelIni;
use crate::pincel::{rgba, con_a, Cara, Col, Pincel};


/// lo que se toca en la pausa
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Pz { Boton, Seguir, Cerrar, Personaje, Arma, Social, Ajustes, Tutorial, Borrar, Salir, Guardar, Cargar, Vr, Grabar }

#[derive(Default)]
pub struct Pausa { pub abierta: bool, t0: f32, zonas: Vec<([f32; 4], Pz)>, dedo: Option<(i32, Option<Pz>)>, apretado: Option<Pz>, golpe: Option<(Pz, f32)> }

/// el botón de pausa: el primero de la columna del sistema (hudorden.js), en la esquina —20 unidades del borde—, redondo, de
/// 96 unidades y nunca menos de 44 px (hud_web.rs: la zona de arriba a la izquierda de la web)
pub fn boton_pausa(w: f32, h: f32) -> (f32, f32, f32) {
    let [x, y, s] = super::hud_web::disposicion(w, h, 0).1; (x, y, s)
}
/// el botón MOD (el menú MOD de jugabilidad.rs): en el grupo de crear, después de Objetos (hud_web.rs)
pub fn boton_mod(w: f32, h: f32) -> (f32, f32, f32) {
    super::hud_web::disposicion(w, h, 0).0.into_iter().find(|b| b.b == super::Boton::Jg(super::jugabilidad::Bj::Mod)).map(|b| (b.x, b.y, b.w)).unwrap_or((0.0, 0.0, 0.0))
}

impl Juego {
    /// lo del menú encima del juego (después del HUD): el botón de pausa, la pausa, un panel abierto desde la pausa y la
    /// pantalla de carga; también carga el cuerpo nuevo si se eligió otro personaje
    pub(super) unsafe fn ini_hud(&mut self, m: &mut Motor3d, w: i32, h: i32, u: &mut Vec<(i64, Vec<f32>)>) {
        let (wf, hf) = (w as f32, h as f32);
        if self.ini.cuerpo_nuevo && self.mapa.is_some() { self.ini.cuerpo_nuevo = false; self.pz_cuerpo(m); }
        // (también mientras se miden los gráficos automáticos: gfxauto.js lo hace detrás de la carga)
        let cargando = (self.recargar && self.mapa.is_none()) || self.gfxa.midiendo();
        let ver_boton = !cargando && !self.pjs.panel() && self.mapa.is_some() && self.menu.is_none() && self.ajustes.is_none() && self.npc_panel.is_none() && !self.en_red.panel && !self.gmod.panel && !self.emotes_panel && !self.jg.panel() && !self.jg.sin_hud();
        // (el menú de objetos también va con este pincel: menu_objetos.rs)
        let menu_on = !cargando && self.mapa.is_some() && self.menu.is_some() && !self.jg.sin_hud();
        if !ver_boton && !menu_on && !self.ini.pz.abierta && self.ini.panel.is_none() && !cargando { return; }
        self.ini_recursos(m);
        if cargando { for k in self.pz_foto_carga() { self.ini_pedir_foto(&k); } self.ini_pedir_foto("logo"); self.ini_recursos(m); }
        let dt = 1.0 / 60.0f32.max(self.fps); self.ini.reloj += dt.min(0.1);
        let atlas = self.ini.rec.atlas.take(); let mut ico = std::mem::take(&mut self.ini.rec.ico); let mut gl = std::mem::take(&mut self.ini.rec.gl);
        if let Some(at) = atlas.as_ref() {
            let mut p = Pincel::nuevo(at, &mut ico, &mut gl);
            if cargando { self.pz_carga(&mut p, wf, hf); }
            else {
                if menu_on { self.mo_dibujar(&mut p, wf, hf); }
                if self.ini.pz.abierta && self.ini.panel.is_none() { self.pz_dibujar(&mut p, wf, hf); }
                if let Some(pn) = self.ini.panel.clone() { p.rect(0.0, 0.0, wf, hf, rgba(0x050608, 0.55)); self.pn_dibujar(&mut p, &pn, wf, hf); }
            }
            u.extend(p.tandas);
        }
        self.ini.rec.atlas = atlas; self.ini.rec.ico = ico; self.ini.rec.gl = gl;
        self.ini.rec.ico.subir(m, false); self.ini.rec.gl.subir(m, false);
    }
    /// el cuerpo del personaje elegido (como en cargar_mapa: si la skin no está, el Hero)
    unsafe fn pz_cuerpo(&mut self, m: &mut Motor3d) {
        let Some(paq) = self.paq.as_mut() else { return };
        let r = Personaje::cargar(paq, &self.skin, 0, 512, &mut self.pj_cargados).or_else(|_| Personaje::cargar(paq, "Hero", 0, 512, &mut self.pj_cargados));
        if let Ok((mut pj, esc)) = r { if let Some((a, b)) = &self.nado { let _ = pj.nado(a, b); } if m.cargar(&esc).is_ok() { self.pj = Some(pj); } }
    }
    /// el botón de pausa: si se ve y si está apretado (lo dibuja hud_web.rs, con los demás botones y el ícono de la web)
    pub(super) fn pausa_boton(&self) -> Option<bool> {
        let cargando = (self.recargar && self.mapa.is_none()) || self.gfxa.midiendo();
        let ver = !cargando && !self.pjs.panel() && self.mapa.is_some() && self.menu.is_none() && self.ajustes.is_none() && self.npc_panel.is_none() && !self.en_red.panel && !self.gmod.panel && !self.emotes_panel && !self.jg.panel() && !self.jg.sin_hud() && !self.ini.pz.abierta && self.ini.panel.is_none();
        ver.then_some(self.ini.pz.apretado == Some(Pz::Boton))
    }
    /// la pausa: el velo, la caja, Seguir, las tarjetas y el pie
    /// la pausa como el menú de escape de GMod: el juego oscurecido detrás, el logo y la lista grande a la izquierda (Seguir
    /// jugando y Salir al menú arriba), un panel de vidrio con la partida a la derecha y la barra de tareas de vidrio abajo
    /// (el orbe sigue jugando; Guardar, Cargar, VR y Grabar; el modo y los cuadros por segundo)
    fn pz_dibujar(&mut self, p: &mut Pincel, w: f32, h: f32) {
        use super::aero::{self, blanco, hex, negro, Aero, BLANCO};
        use super::inicio_aero::{botones_barra, lista_gmod, Op};
        let mut z = vec![]; let t = self.ini.reloj - self.ini.pz.t0; let u = aero::unidad(w, h); let ins = self.ini.ins;
        let anim = self.ini.nivel != inicio_juego::Nivel::Quieto;
        let ent = |d: f32, dur: f32| if anim { let k = inicio_juego::prog(t, d, dur); 1.0 - (1.0 - k).powi(3) } else { 1.0 };
        let k = ent(0.0, 0.25); let apr = |pz: Pz| self.ini.pz.apretado == Some(pz);
        p.rect(0.0, 0.0, w, h, negro(0.5 * k)); p.degrade_h(0.0, 0.0, w, h, &[(0.0, negro(0.45 * k)), (0.55, negro(0.0))]);
        let x0 = ins[0] + 30.0 * u; let y_top = ins[2] + 16.0 * u; let tb = 34.0 * u; let y_tb = h - ins[3] - tb; let alto_logo = 54.0 * u;
        if let Some((id, lw, lh)) = self.ini_foto("logo") { let an = alto_logo * lw / lh; p.con_alfa(k, |p| p.foto(id, x0 - 2.0 * u, y_top - (1.0 - k) * 8.0 * u, an, alto_logo, BLANCO)); }
        // (la lista)
        let ops: [(Pz, &str, usize, Col); 8] = [(Pz::Seguir, "Seguir jugando", 0, BLANCO), (Pz::Salir, "Salir al menú", 0, BLANCO), (Pz::Personaje, "Personaje", 1, BLANCO),
            (Pz::Arma, "Arma en la mano", 1, BLANCO), (Pz::Social, "Social", 1, BLANCO), (Pz::Ajustes, "Opciones", 2, BLANCO), (Pz::Tutorial, "Ver el tutorial", 2, BLANCO), (Pz::Borrar, "Borrar todo", 3, hex(0xff9a8e))];
        let lista: Vec<Op> = ops.iter().map(|o| Op { txt: o.1, grupo: o.2, col: o.3, apretada: apr(o.0) }).collect();
        let y_l = y_top + alto_logo + 14.0 * u;
        let (rs, ancho) = lista_gmod(p, u, x0, y_l, y_tb - 8.0 * u - y_l, &lista, &ent);
        for (r, o) in rs.into_iter().zip(ops.iter()) { z.push((r, o.0)); }
        // (la partida, a la derecha)
        let modo = if self.en_red.en_sala() { self.en_red.red.sala.as_ref().map(|s| s.n.clone()).unwrap_or_default() } else { "Un solo jugador".into() };
        let gw = 206.0 * u; let gx = w - ins[1] - 16.0 * u - gw;
        if gx > x0 + ancho + 40.0 * u {
            let kg = ent(0.3, 0.45); let r = [gx + (1.0 - kg) * 30.0 * u, y_top, gw, 74.0 * u];
            let mapa = self.mapas.get(self.mapa_i).map(|m| super::paneles_juego::nombre_mapa(m)).unwrap_or_default();
            p.con_alfa(kg, |p| {
                aero::tarjeta(p, r, u, false);
                p.icono("mapa", r[0] + 10.0 * u, r[1] + 8.0 * u, 14.0 * u, 2.2, hex(0x8cc8ff));
                p.texto_sombra(Cara::S7, 12.5 * u, r[0] + 30.0 * u, r[1] + 19.5 * u, BLANCO, "Partida", u);
                p.rect(r[0] + 10.0 * u, r[1] + 27.0 * u, gw - 20.0 * u, (0.75 * u).max(1.0), blanco(0.22));
                p.texto_max(Cara::S7, 13.0 * u, r[0] + 11.0 * u, r[1] + 46.0 * u, BLANCO, 0.0, &mapa, gw - 22.0 * u);
                p.texto_max(Cara::S4, 11.5 * u, r[0] + 11.0 * u, r[1] + 63.0 * u, blanco(0.78), 0.0, &modo, gw - 22.0 * u);
            });
        }
        // (la barra de tareas)
        aero::barra_tareas(p, [0.0, y_tb, w, h - y_tb], u);
        let (ocx, ocy, ora) = (ins[0] + 25.0 * u, y_tb + tb / 2.0 - 1.5 * u, 17.0 * u);
        aero::orbe(p, ocx, ocy, ora, u, apr(Pz::Seguir)); z.push(([ocx - ora - 6.0 * u, y_tb, ora * 2.0 + 12.0 * u, tb], Pz::Seguir));
        let tn = 11.5 * u; let fps = format!("{:.0} FPS", self.fps);
        let rw = p.at.ancho(Cara::S4, tn, 0.0, &modo).min(150.0 * u).max(p.at.ancho(Cara::S4, 10.5 * u, 0.0, &fps)) + 24.0 * u; let ax = w - ins[1] - rw; let g = (0.75 * u).max(1.0);
        p.rect(ax, y_tb + 2.0 * g, rw + ins[1], tb - 2.0 * g, negro(0.22)); p.rect(ax, y_tb + 2.0 * g, g, tb - 2.0 * g, negro(0.5)); p.rect(ax + g, y_tb + 2.0 * g, g, tb - 2.0 * g, blanco(0.16));
        p.texto_max(Cara::S4, tn, ax + 12.0 * u, y_tb + tb * 0.45, BLANCO, 0.0, &modo, 150.0 * u);
        p.texto(Cara::S4, 10.5 * u, ax + 12.0 * u, y_tb + tb * 0.83, blanco(0.78), 0.0, &fps);
        let bh = 26.0 * u; let by = y_tb + (tb - bh) / 2.0 + 0.5 * u;
        let bt = [(Pz::Guardar, "guardar", "Guardar"), (Pz::Cargar, "subir", "Cargar"), (Pz::Vr, "vr", "VR"), (Pz::Grabar, "video", "Grabar")];
        let datos: Vec<(&'static str, &str, bool)> = bt.iter().map(|b| (b.1, b.2, apr(b.0))).collect();
        let rs = botones_barra(p, u, ocx + ora + 12.0 * u, ax - 8.0 * u, by, bh, &datos);
        for (r, b) in rs.into_iter().zip(bt.iter()) { z.push((r, b.0)); }
        self.ini.pz.zonas = z;
    }
    /// las fotos de la pantalla de carga: la del mapa (carga/x.webp) o su ícono
    fn pz_foto_carga(&self) -> Vec<String> {
        let m = self.mapas.get(self.mapa_i).cloned().unwrap_or_default();
        let mut v = vec![]; if let Some(c) = super::paneles_juego::fondo_mapa(&m) { v.push(format!("a:carga/{c}.webp")); } v.push(format!("i:mapa_{m}")); v
    }
    /// la pantalla de carga (#carga): la foto del mapa de fondo, oscurecida, el logo, «Sandbox» y el nombre del mapa
    fn pz_carga(&self, p: &mut Pincel, w: f32, h: f32) {
        p.rect(0.0, 0.0, w, h, [0.0, 0.0, 0.0, 1.0]);
        if let Some((id, tw, th)) = self.pz_foto_carga().iter().find_map(|k| self.ini_foto(k)) { p.foto_cubre(id, tw, th, 0.0, 0.0, w, h, [0.5, 0.5], [1.0; 4]); }
        p.degrade_v(0.0, 0.0, w, h, &[(0.0, [0.0, 0.0, 0.0, 0.55]), (0.45, [0.0, 0.0, 0.0, 0.2]), (1.0, [0.0, 0.0, 0.0, 0.85])]);
        let vh = h / 100.0; let lh = (12.0 * vh).clamp(40.0, 110.0); let m = (5.0 * vh).max(12.0);
        if let Some((id, _, _)) = self.ini_foto("logo") { p.foto(id, m, m, lh * 1155.0 / 360.0, lh, [1.0; 4]); }
        let f = (2.9 * vh).max(14.0); let y = m + lh + f * 0.8;
        let ws = p.texto(Cara::O5, f, m, y + f, AMA, 0.1, "SANDBOX"); p.texto(Cara::O5, f, m + ws + f * 0.6, y + f, con_a(TX, 0.68), 0.05, &format!("v{}", self.ini.version));
        let nom = super::paneles_juego::nombre_mapa(&self.mapas.get(self.mapa_i).cloned().unwrap_or_default()).to_uppercase(); let fg = (6.4 * vh).clamp(22.0, 50.0);
        p.texto(Cara::O6, fg, m, y + f * 1.6 + fg, TX, 0.02, &nom);
        // (abajo: el estado y una barra que se llena —acá el mapa se arma de una vez—)
        let fb = (2.6 * vh).max(13.0); let by = h - m - 6.0;
        let midiendo = self.gfxa.midiendo();
        // (si se está bajando el paquete del mapa: cuánto va, en MB, y la barra con eso)
        let mb = |x: u64| format!("{:.1}", x as f64 / 1048576.0).replace('.', ",");
        let (txt, lleno) = match self.bajada { Some((va, tot, _)) if !midiendo && self.base_bajando() => (if tot > 0 { format!("BAJANDO TEXTURAS Y MODELOS DE HL2… {va} DE {tot}") } else { "CONECTANDO CON STEAM…".to_string() }, if tot > 0 { (va as f32 / tot as f32).clamp(0.02, 1.0) } else { 0.03 }),
            Some((va, tot, _)) if !midiendo => (if tot > 0 { format!("BAJANDO EL MAPA… {} DE {} MB", mb(va), mb(tot)) } else { "BAJANDO EL MAPA…".to_string() }, if tot > 0 { (va as f32 / tot as f32).clamp(0.02, 1.0) } else { 0.05 }),
            _ => ((if midiendo { "AJUSTANDO LOS GRÁFICOS…" } else { "CARGANDO EL MAPA…" }).to_string(), if midiendo { 0.9 } else { 0.35 }) };
        p.texto(Cara::O5, fb, m, by - fb * 0.9, con_a(TX, 0.85), 0.06, &txt); p.texto_d(Cara::O5, fb, w - m, by - fb * 0.9, con_a(TX, 0.6), 0.1, "JXSTUDIOS");
        p.rect(m, by, w - 2.0 * m, 4.0, rgba(0xefede7, 0.15)); p.rect(m, by, (w - 2.0 * m) * lleno, 4.0, AMA);
    }

    // —— el tacto jugando: el botón de pausa, la pausa y los paneles abiertos desde ella ——
    fn pz_en(&self, x: f32, y: f32) -> Option<Pz> { self.ini.pz.zonas.iter().rev().find(|(r, _)| x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]).map(|z| z.1) }
    pub(super) fn pz_dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) -> bool {
        if self.ini.panel.is_some() { self.pn_dedo_abajo(id, x, y, w, h); return true; }
        if self.ini.pz.abierta { let pz = self.pz_en(x, y); self.ini.pz.apretado = pz; if let Some(pz) = pz { self.ini.pz.golpe = Some((pz, self.ini.reloj)); } self.ini.pz.dedo = Some((id, pz)); return true; }
        // (el botón de pausa, si se ve: sólo jugando, sin otro menú abierto)
        let libre = !self.pjs.panel() && self.mapa.is_some() && self.menu.is_none() && self.ajustes.is_none() && self.npc_panel.is_none() && !self.en_red.panel && !self.gmod.panel && !self.emotes_panel && !self.jg.panel() && !self.jg.sin_hud();
        let (cx, cy, s) = boton_pausa(w, h);
        if libre && (x - cx).powi(2) + (y - cy).powi(2) <= (s / 2.0 + 4.0).powi(2) { self.ini.pz.apretado = Some(Pz::Boton); self.ini.pz.dedo = Some((id, Some(Pz::Boton))); return true; }
        false
    }
    pub(super) fn pz_dedo_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) -> bool {
        if self.ini.panel.is_some() { self.pn_dedo_mueve(id, x, y, h); return true; }
        if let Some((d, pz)) = self.ini.pz.dedo { if d == id { if self.ini.pz.abierta && self.pz_en(x, y) != pz { self.ini.pz.apretado = None; } return true; } }
        self.ini.pz.abierta
    }
    pub(super) fn pz_dedo_arriba(&mut self, id: i32, w: f32, h: f32) -> bool {
        if self.ini.panel.is_some() { self.pn_dedo_arriba(id, w, h); return true; }
        let Some((d, pz)) = self.ini.pz.dedo else { return self.ini.pz.abierta }; if d != id { return true; }
        self.ini.pz.dedo = None; let suelto = self.ini.pz.apretado.take();
        if let (Some(a), Some(b)) = (pz, suelto) { if a == b { self.sonido.tocar("Click", 0.5, 1.0, None); self.pz_accion(a); } }
        true
    }
    /// abrir la pausa (abrirPausa)
    pub fn pz_abrir(&mut self) { self.ini_pedir_foto("logo"); self.ini.pz.abierta = true; self.ini.pz.t0 = self.ini.reloj; self.dedos.clear(); }
    fn pz_accion(&mut self, a: Pz) {
        match a {
            Pz::Boton => self.pz_abrir(),
            Pz::Seguir | Pz::Cerrar => self.ini.pz.abierta = false,
            Pz::Personaje => { self.ini.pz.abierta = false; if self.mapa.is_some() { self.pj_abrir_desde_pausa(); } else { self.ini.desde_juego = true; self.pn_abrir(PanelIni::Personajes { tab: 0, scroll: 0.0 }); } }
            Pz::Social => { self.ini.pz.abierta = false; self.ini.desde_juego = true; self.pn_abrir(PanelIni::Social { tab: 0 }); }
            // (el mismo Ajustes del menú principal, como la web; Volver vuelve a la pausa)
            Pz::Ajustes => { self.ini.pz.abierta = false; self.ini.desde_juego = true; self.pn_abrir(super::paneles_juego::PanelIni::Opciones { tab: 0, scroll: 0.0 }); }
            Pz::Borrar => { self.pz_borrar_todo(); self.ini.pz.abierta = false; self.avisar("Se borró todo".into()); }
            Pz::Salir => { self.ini.pz.abierta = false; self.lan_salir(); self.inicio_abrir(); }
            Pz::Arma => { self.ini.pz.abierta = false; self.arma_aj_abrir(); }
            Pz::Tutorial => self.tut_abrir(),
            Pz::Guardar => { self.ini.pz.abierta = false; self.pz_guardar(); }
            Pz::Cargar => { self.ini.pz.abierta = false; self.pz_cargar(); }
            Pz::Vr => self.avisar("El modo VR todavía no está en la versión nativa".into()),
            Pz::Grabar => self.avisar("Grabar todavía no está en la versión nativa".into()),
        }
    }
    /// el archivo de lo guardado de este mapa (guardarConstruccion de la web: jx_save_<mapa>)
    fn pz_archivo_guardado(&self) -> Option<std::path::PathBuf> {
        let mp = self.mapa.as_ref()?; let n: String = mp.nombre.chars().map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' }).collect();
        self.datos.as_ref().map(|d| d.join(format!("guardado_{n}.json")))
    }
    /// Guardar: lo que puso el jugador (los objetos, con su lugar, su giro y si quedó congelado), en la carpeta de la app
    fn pz_guardar(&mut self) {
        let Some(f) = self.pz_archivo_guardado() else { self.avisar("No se pudo guardar".into()); return };
        let r3 = |x: f64, k: f64| (x * k).round() / k;
        let l: Vec<serde_json::Value> = self.objs.iter().filter_map(|o| { let b = self.fis.cuerpo(o.cuerpo?)?;
            Some(serde_json::json!({ "n": o.nombre, "p": [r3(b.pos[0], 1000.0), r3(b.pos[1], 1000.0), r3(b.pos[2], 1000.0)], "q": [r3(b.q[0], 1e4), r3(b.q[1], 1e4), r3(b.q[2], 1e4), r3(b.q[3], 1e4)], "f": if b.congelado { 1 } else { 0 } })) }).collect();
        let n = l.len();
        match std::fs::write(&f, serde_json::Value::Array(l).to_string()) { Ok(_) => self.avisar(format!("Guardado ({n} cosas)")), Err(_) => self.avisar("No se pudo guardar".into()) }
    }
    /// Cargar: lo guardado de este mapa vuelve a su lugar (se pone en el cuadro siguiente, con el motor a mano)
    fn pz_cargar(&mut self) {
        let l: Vec<serde_json::Value> = self.pz_archivo_guardado().and_then(|f| std::fs::read(f).ok()).and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
        let num = |v: &serde_json::Value, k: usize| v.get(k).and_then(|x| x.as_f64()).unwrap_or(0.0) as f32;
        for x in &l { let (Some(n), p, q) = (x["n"].as_str(), &x["p"], &x["q"]) else { continue };
            self.por_cargar.push((n.to_string(), [num(p, 0), num(p, 1), num(p, 2)], [num(q, 0), num(q, 1), num(q, 2), if q.get(3).is_some() { num(q, 3) } else { 1.0 }], x["f"].as_i64().unwrap_or(0) != 0)); }
        self.avisar(if l.is_empty() { "No hay nada guardado en este mapa".into() } else { format!("Cargado ({} cosas)", l.len()) });
    }
    /// «Borrar todo» (limpiar el mapa): los objetos, los vehículos y los NPC puestos
    fn pz_borrar_todo(&mut self) {
        let Some(mp) = self.mapa.as_ref() else { return };
        for o in std::mem::take(&mut self.objs) { if let Some(id) = o.cuerpo { let _ = self.vehs.quitar(id, &self.fis, &mp.mundo); self.fis.quitar(id); self.aguas.olvidar(id); } }
        self.npcs.todos(&mut self.fis); self.pila.clear(); self.proys.clear(); self.por_explotar.clear();
    }
}
impl super::inicio_juego::Inicio {
    /// (para las pruebas) dónde está algo de la pausa
    pub fn pz_zona(&self, p: Pz) -> Option<[f32; 4]> { self.pz.zonas.iter().find(|z| z.1 == p).map(|z| z.0) }
}
