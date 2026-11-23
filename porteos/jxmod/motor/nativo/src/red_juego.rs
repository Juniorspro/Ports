//! El multijugador en el juego (jxjuego::red, el protocolo de red.js): el panel de salas, lo que se manda de este
//! jugador y sus cosas cada cuadro, los demás jugadores (su cuerpo con el arma y sentados en los autos, su nombre y el
//! globo del chat) y las cosas de los demás (congeladas donde dice su dueño, o libres si las agarré yo). Va como hijo de
//! comun.rs para ver los campos del juego (como herramientas.rs y combate.rs).
use super::*;
use jxjuego::red::{self, Evento, Local, NpcLocal, NuevaSala, ObjLocal, Puente, Red, Sala, SimRemoto};
use std::collections::HashSet;
use jxmotor::escena::ItemDin;

/// lo del multijugador del juego
pub struct EnRed {
    pub red: Red,
    /// la conexión de verdad (en Android, el TLS y el HTTPS de Java: red_android.rs); sin ella no se juega en línea
    pub puente: Option<Puente>,
    local: Local,
    /// el cuerpo de cada uno de los demás (por su número) y con qué skin se cargó
    cuerpos: HashMap<String, (Personaje, String)>,
    /// las cosas de los demás: su clave → el Obj.id que la dibuja (y al revés, cuáles son de otros)
    cosas: HashMap<String, u32>, de_otros: HashSet<u32>,
    /// el panel de salas abierto (y cuánto se bajó la lista)
    pub panel: bool, pub scroll: f32,
    /// conectarse a la sala cuando termine de cargar su mapa
    empezar: bool, habia_mapa: bool,
    /// el reloj de la física del jugador (J.reloj) y si ya se le dieron los mapas y los prefabs del juego
    reloj: f64, listo: bool,
    /// cuántas cosas mías y congeladas había (si cambia: `objeto_cambio`)
    firma: (usize, usize),
    /// mientras se hace la explosión de otro (no se vuelve a mandar)
    pub desde_red: bool,
    datos: Option<std::path::PathBuf>,
    /// el chat de la sala (abajo a la izquierda, como el de la web): lo que dijeron y cuándo (tiempo del juego)
    chat: Vec<(String, f64)>,
}

/// lo que se toca en el panel de salas
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum BtnSala { Sala(usize), Crear, Nombre, Salir, Cerrar }

/// dónde va el panel de salas y cada cosa (con `n` salas y bajado `scroll`): el marco y los botones
pub fn panel_salas_geo(w: f32, h: f32, n: usize, scroll: f32, en_sala: bool) -> ([f32; 4], Vec<(BtnSala, [f32; 4])>) {
    let pw = (w * 0.84).min(h * 2.0); let (x0, y0, ph) = ((w - pw) / 2.0, h * 0.05, h * 0.9);
    let mx = h * 0.03; let fh = h * 0.085; let y_lista = y0 + h * 0.13; let alto = ph - h * 0.13 - h * 0.13;
    let mut v = vec![(BtnSala::Cerrar, [x0 + pw - h * 0.09, y0 + h * 0.012, h * 0.07, h * 0.06])];
    for k in 0..n {
        let y = y_lista + k as f32 * fh - scroll;
        if y < y_lista - 1.0 || y + fh > y_lista + alto + 1.0 { continue; }
        v.push((BtnSala::Sala(k), [x0 + mx, y + 3.0, pw - mx * 2.0, fh - 6.0]));
    }
    let yb = y0 + ph - h * 0.11; let bw = (pw - mx * 4.0) / 3.0;
    v.push((BtnSala::Crear, [x0 + mx, yb, bw, h * 0.08]));
    v.push((BtnSala::Nombre, [x0 + mx * 2.0 + bw, yb, bw, h * 0.08]));
    if en_sala { v.push((BtnSala::Salir, [x0 + mx * 3.0 + bw * 2.0, yb, bw, h * 0.08])); }
    ([x0, y0, pw, ph], v)
}

impl EnRed {
    /// con el número de la vez anterior (así los demás saben que volví) y el nombre guardados
    pub fn nueva(datos: Option<&std::path::Path>) -> EnRed {
        let leer = |n: &str| datos.and_then(|d| std::fs::read_to_string(d.join(n)).ok()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let nombre = leer("nombre.txt").unwrap_or_else(|| "Nativo".into());
        let mut red = Red::nueva(leer("red_id.txt").as_deref(), &nombre);
        if let Some(d) = datos { let _ = std::fs::write(d.join("red_id.txt"), &red.id); }
        if let Some(s) = leer("salas.json") { red.poner_mias_json(&s); }
        EnRed { red, puente: None, local: Local::default(), cuerpos: HashMap::new(), cosas: HashMap::new(), de_otros: HashSet::new(), panel: false, scroll: 0.0,
            empezar: false, habia_mapa: false, reloj: 0.0, listo: false, firma: (0, 0), desde_red: false, datos: datos.map(|d| d.to_path_buf()), chat: vec![] }
    }
    /// ¿estoy en una sala?
    pub fn en_sala(&self) -> bool { self.red.sala.is_some() && self.red.room.len() > 0 }
    /// mi nombre (el que ven los demás), guardado para la próxima
    pub fn poner_nombre(&mut self, n: &str) { self.red.nombre = n.to_string(); if let Some(d) = &self.datos { let _ = std::fs::write(d.join("nombre.txt"), n); } }
    /// un renglón en el chat (quedan los últimos 6)
    pub(super) fn al_chat(&mut self, t: String) { let ahora = self.red.t; self.chat.push((t, ahora)); if self.chat.len() > 6 { self.chat.remove(0); } }
    /// la cosa de otro que es este Obj (su clave)
    fn clave_de(&self, id: u32) -> Option<&String> { self.cosas.iter().find(|(_, v)| **v == id).map(|(k, _)| k) }
    /// se borró el Obj `id`: si era de otro, se olvida y da su clave
    pub(super) fn olvidar_cosa(&mut self, id: u32) -> Option<String> { if !self.de_otros.remove(&id) { return None; } let c = self.clave_de(id).cloned()?; self.cosas.remove(&c); Some(c) }
}

impl Juego {
    /// abrir el panel de salas (conectarse a la lista)
    pub(super) fn abrir_salas(&mut self) {
        self.en_red.panel = true; self.en_red.scroll = 0.0; self.menu = None;
        if self.en_red.puente.is_none() { self.avisar("Sin conexión: el multijugador anda en el celular".into()); }
        self.en_red.red.conectar_lista(); self.en_red.red.cargar_salas();
    }
    /// un toque en el panel de salas
    pub(super) fn toque_salas(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let salas = self.en_red.red.lista_salas(); let en = self.en_red.en_sala();
        let (c, bs) = panel_salas_geo(w, h, salas.len(), self.en_red.scroll, en);
        if x < c[0] || x > c[0] + c[2] || y < c[1] || y > c[1] + c[3] { self.en_red.panel = false; return; }
        let Some(b) = bs.iter().find(|(_, r)| x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]).map(|x| x.0) else { return };
        self.sonido.tocar("Click", 0.5, 1.0, None);
        match b {
            BtnSala::Cerrar => self.en_red.panel = false,
            BtnSala::Salir => { self.en_red.red.dejar(); self.avisar("Saliste de la sala".into()); }
            BtnSala::Nombre => { let n = self.en_red.red.nombre.clone(); self.pedir_texto(Escribir::Nombre, "Tu nombre", &n, 20, false); }
            BtnSala::Crear => {
                let m = self.mapas.get(self.mapa_i).cloned().unwrap_or_default();
                let n = format!("Sala de {}", self.en_red.red.nombre);
                self.en_red.red.crear_servidor(&NuevaSala { n, pw: String::new(), m: m.clone(), mo: "Free".into(), pvp: true, rpg: true, nb: true, mp: 1000.0, mv: 40.0, mw: None }, None);
                self.avisar(format!("Creando la sala en {m}…"));
            }
            BtnSala::Sala(k) => {
                let Some((s, _)) = salas.get(k) else { return };
                let s = s.clone();
                if s.pw && self.en_red.red.entrar(&s, None).is_err() { let t = format!("Contraseña de {}", s.n); self.pedir_texto(Escribir::Clave(s), &t, "", 40, true); return; }
                self.entrar_sala(&s);
            }
        }
    }
    /// entrar a una sala: su mapa (si es otro, cargarlo) y después conectarse
    fn entrar_sala(&mut self, s: &Sala) { self.entrar_sala_con(s, None); }
    /// lo mismo con la contraseña escrita
    pub(super) fn entrar_sala_con(&mut self, s: &Sala, clave: Option<&str>) {
        if self.en_red.puente.is_none() { self.avisar("Sin conexión: el multijugador anda en el celular".into()); return; }
        if self.en_red.red.entrar(s, clave).is_err() { self.avisar(if clave.is_some() { "Contraseña incorrecta".into() } else { "Esa sala pide contraseña".into() }); return; }
        self.en_red.panel = false;
        let actual = self.mapas.get(self.mapa_i).cloned().unwrap_or_default();
        if s.m != actual { if !self.poner_mapa(&s.m) { self.avisar(format!("No tengo el mapa {}", s.m)); self.en_red.red.dejar(); return; } }
        self.en_red.empezar = true; self.avisar(format!("Entrando a {}…", s.n));
    }

    /// cada cuadro, después de la física y antes de armar lo que se dibuja: lo que llega, lo que mando y los demás
    pub(super) unsafe fn red_cuadro(&mut self, m: &mut Motor3d, dt: f32) {
        if !self.en_red.listo { if self.paq.is_some() {
            self.en_red.listo = true; self.en_red.red.mapas = self.mapas.clone();
            self.en_red.red.prefabs = Some(self.nombres.keys().cloned().collect());
        } }
        // (sin mapa: lo de los demás se va con él; al volver, si estoy en una sala, me conecto de nuevo)
        if self.mapa.is_none() { if self.en_red.habia_mapa { self.en_red.habia_mapa = false; self.en_red.cuerpos.clear(); self.en_red.cosas.clear(); self.en_red.de_otros.clear(); if self.en_red.en_sala() { self.en_red.empezar = true; } } return; }
        if !self.en_red.habia_mapa { self.en_red.habia_mapa = true; }
        let Some(mut pu) = self.en_red.puente.take() else { return };
        if self.en_red.panel { self.en_red.red.mirando_lista(); }
        if self.en_red.empezar && !self.recargar { self.en_red.empezar = false; self.en_red.red.empezar(None); }
        self.en_red.red.cfg.mapa = self.mapas.get(self.mapa_i).cloned().unwrap_or_default();
        pu.bombear(&mut self.en_red.red);
        if self.en_red.en_sala() {
            self.red_reclamos();
            self.red_local(dt);
            let local = std::mem::take(&mut self.en_red.local);
            self.en_red.red.paso(dt as f64, &local);
            self.en_red.local = local;
        } else { let local = Local::default(); self.en_red.red.paso(dt as f64, &local); }
        for e in self.en_red.red.eventos() { self.red_evento(m, e); }
        pu.bombear(&mut self.en_red.red);
        self.en_red.puente = Some(pu);
        self.red_cosas();
        self.red_cuerpos(m, dt);
    }

    /// lo mío para mandar (lo de «e», «w» y «m»): el jugador, mis cosas, las de otros que muevo yo
    fn red_local(&mut self, dt: f32) {
        self.en_red.reloj += dt as f64;
        let red_id = self.en_red.red.id.clone();
        let veh = self.vehs.jugador.and_then(|(id, a)| {
            let o = self.objs.iter().find(|o| o.cuerpo == Some(id))?;
            let clave = self.en_red.clave_de(o.id).cloned().unwrap_or_else(|| self.en_red.red.clave_propia(o.id));
            Some((clave, a as i32))
        });
        let j = &self.jug; let p64 = |v: [f32; 3]| [v[0] as f64, v[1] as f64, v[2] as f64];
        let mut l = std::mem::take(&mut self.en_red.local);
        l.jug = red::Jugador { skin: self.skin.clone(), gorro: "HatEmpty".into(), pos: p64(j.pos), yaw: j.yaw as f64, pitch: -j.pitch as f64, vel: p64(j.vel),
            suelo: j.suelo, agachado: j.agachado, vivo: !self.muerto, bits: if j.noclip { 16 } else { 0 }, arma: Some(self.armas.def().n.to_string()), vida: j.vida as f64,
            vehiculo: veh, reloj: self.en_red.reloj, ..Default::default() };
        l.objs.clear(); l.simulo.clear();
        let (mut n, mut cong) = (0, 0);
        for o in &self.objs {
            let Some(b) = o.cuerpo.and_then(|id| self.fis.cuerpo(id)) else { continue };
            if self.en_red.de_otros.contains(&o.id) {
                // (una de otro que agarré: la muevo yo y la mando)
                if let Some(c) = self.en_red.clave_de(o.id) { if self.en_red.red.objeto(c).map(|x| x.auth == red_id).unwrap_or(false) { l.simulo.push(SimRemoto { clave: c.clone(), pos: b.pos, q: b.q, duerme: b.duerme }); } }
                continue;
            }
            n += 1; if b.congelado { cong += 1; }
            l.objs.push(ObjLocal { id: o.id, nombre: o.nombre.clone(), pos: b.pos, q: b.q, duerme: b.duerme, congelado: b.congelado, ..Default::default() });
        }
        // (mis NPC: npcRedMandar —cada 0,15 s lo manda red.rs—)
        l.npcs.clear();
        for p in &self.npcs.lista {
            let f = (p.cap.suelo as i32) | if p.rag.is_some() { 2 } else { 0 } | if !p.vivo { 4 } else { 0 } | if p.act.hostil { 8 } else { 0 } | if p.act.modo == npc::Modo::Defender { 16 } else { 0 };
            l.npcs.push(NpcLocal { id: p.id as i32, skin: p.skin.clone(), pos: p.cap.pos, yaw: p.yaw, vel: p.cap.vel, f, emote: p.emote.clone().unwrap_or_default(), arma: p.arma.map(|a| a.nombre().to_string()).unwrap_or_default(), tiros: 0, mira: None });
        }
        self.en_red.local = l;
        if (n, cong) != self.en_red.firma { self.en_red.firma = (n, cong); self.en_red.red.objeto_cambio(); }
    }

    /// agarrar con la Physics Gun o la Gravity Gun una cosa de otro (o una mía que mueve otro): reclamarla
    fn red_reclamos(&mut self) {
        let ids: Vec<u32> = [self.armas.agarre.as_ref().map(|a| a.id), self.armas.grav.as_ref().map(|g| g.id)].into_iter().flatten().collect();
        let red_id = self.en_red.red.id.clone();
        for cid in ids {
            let Some(o) = self.objs.iter().find(|o| o.cuerpo == Some(cid)) else { continue };
            let clave = match self.en_red.clave_de(o.id) {
                Some(c) => { if self.en_red.red.objeto(c).map(|x| x.auth == red_id).unwrap_or(true) { continue; } c.clone() }
                None => { if self.en_red.red.auth_propio(o.id).is_none() { continue; } self.en_red.red.clave_propia(o.id) }
            };
            if let Some(cong) = self.en_red.red.reclamar(&clave) { if let Some(b) = self.fis.cuerpo_mut(cid) { b.congelado = cong; b.despertar(); } }
        }
    }

    /// las cosas de otros donde dice su dueño (congeladas), y las mías que mueve otro donde dice él
    fn red_cosas(&mut self) {
        let red_id = self.en_red.red.id.clone();
        for (clave, oid) in self.en_red.cosas.clone() {
            let Some(x) = self.en_red.red.objeto(&clave) else { continue };
            let Some(cid) = self.objs.iter().find(|o| o.id == oid).and_then(|o| o.cuerpo) else { continue };
            if x.auth == red_id { continue; }
            let (p, q) = (x.pos, x.q);
            if let Some(b) = self.fis.cuerpo_mut(cid) { b.congelado = true; b.vel = [0.0; 3]; b.ang = [0.0; 3]; }
            self.fis.poner(cid, p, q);
        }
        for (id, p, q) in self.en_red.red.cedidos() {
            let Some(cid) = self.objs.iter().find(|o| o.id == id).and_then(|o| o.cuerpo) else { continue };
            if let Some(b) = self.fis.cuerpo_mut(cid) { b.congelado = true; b.vel = [0.0; 3]; b.ang = [0.0; 3]; }
            self.fis.poner(cid, p, q);
        }
        // (y su pose dibujada: la de la física)
        for o in self.objs.iter_mut() { if self.en_red.de_otros.contains(&o.id) { if let Some(b) = o.cuerpo.and_then(|id| self.fis.cuerpo(id)) { o.pos = [b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32]; o.q = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]; } } }
    }

    /// lo que pasó en la red
    unsafe fn red_evento(&mut self, m: &mut Motor3d, e: Evento) {
        match e {
            Evento::Conectado { sala } => self.en_red.al_chat(format!("Conectado: {sala}")),
            Evento::Desconectado => self.avisar("Se cortó la conexión (reconectando…)".into()),
            Evento::Entro { nombre, .. } => self.en_red.al_chat(format!("{nombre} entró")),
            Evento::Salio { nombre, id } => { self.en_red.cuerpos.remove(&id); self.en_red.al_chat(format!("{nombre} salió")); }
            Evento::Chat { nombre, texto, .. } => self.en_red.al_chat(format!("{nombre}: {texto}")),
            Evento::Aviso(t) => self.avisar(t),
            Evento::Disparo { arma, o, dir, .. } => {
                // (la traza desde sus ojos hasta lo que toca, y el sonido de su arma ahí)
                let o32 = [o[0] as f32, o[1] as f32, o[2] as f32];
                let t = self.mapa.as_ref().and_then(|mp| self.fis.rayo(&mp.mundo, o, dir, 80.0, &[])).map(|g| g.t).unwrap_or(80.0) as f32;
                let fin = [o32[0] + dir[0] as f32 * t, o32[1] + dir[1] as f32 * t, o32[2] + dir[2] as f32 * t];
                self.ef.traza(o32, fin);
                if let Some(d) = arma.as_deref().and_then(|a| ARMAS.iter().find(|x| x.n == a)) { if !d.s_f.is_empty() { self.sonido.tocar(d.s_f[0], 0.8, 1.0, Some(o32)); } }
            }
            Evento::Explosion { p, r, dano, .. } => { self.en_red.desde_red = true; self.explosion([p[0] as f32, p[1] as f32, p[2] as f32], r as f32, dano as f32); self.en_red.desde_red = false; }
            Evento::Dano { dano, empuje, .. } => {
                if self.en_red.red.sala.as_ref().map(|s| s.pvp).unwrap_or(false) { self.danar_jugador(dano as f32); if let Some(v) = empuje { for k in 0..3 { self.jug.vel[k] += v[k] as f32; } } }
            }
            Evento::ObjetoNuevo { clave, nombre, pos, q, .. } => {
                if self.en_red.cosas.contains_key(&clave) { return; }
                let (aviso, pila) = (self.aviso.clone(), self.pila.len());
                let r = self.crear(m, &nombre, [pos[0] as f32, pos[1] as f32, pos[2] as f32], [q[0] as f32, q[1] as f32, q[2] as f32, q[3] as f32], true, true);
                self.aviso = aviso; self.pila.truncate(pila);   // (no es mía: ni el cartel de «Puesto» ni deshacer)
                if let Ok(Some(k)) = r { let id = self.objs[k].id; if let Some(c) = self.objs[k].cuerpo { self.fis.poner(c, pos, q); } self.en_red.cosas.insert(clave, id); self.en_red.de_otros.insert(id); }
            }
            Evento::ObjetoBorrado { clave } => {
                if let Some(id) = self.en_red.cosas.remove(&clave) { self.en_red.de_otros.remove(&id); if let Some(i) = self.objs.iter().position(|o| o.id == id) { self.borrar_obj(i); } }
            }
            Evento::PropioReclamado { .. } => {}
            Evento::PropioBorrado { id } => { if let Some(i) = self.objs.iter().position(|o| o.id == id && !self.en_red.de_otros.contains(&o.id)) { self.borrar_obj(i); } }
            Evento::Limpiar => { let mias: Vec<u32> = self.objs.iter().filter(|o| !self.en_red.de_otros.contains(&o.id)).map(|o| o.id).collect(); for id in mias { if let Some(i) = self.objs.iter().position(|o| o.id == id) { self.borrar_obj(i); } } self.avisar("El anfitrión limpió el mapa".into()); }
            Evento::MapaAnfitrion { m: mapa, .. } => {
                let actual = self.mapas.get(self.mapa_i).cloned().unwrap_or_default();
                if mapa != actual { if self.poner_mapa(&mapa) { self.en_red.empezar = true; self.avisar(format!("El anfitrión juega en {mapa}")); } else { self.avisar(format!("No tengo el mapa {mapa}")); } }
            }
            Evento::Echado => { self.en_red.red.dejar(); self.avisar("Te echaron de la sala".into()); }
            Evento::SalaCerrada { nombre } => { self.en_red.red.dejar(); self.avisar(format!("Se cerró la sala {nombre}")); }
            Evento::Mias => { if let Some(d) = &self.en_red.datos { let _ = std::fs::write(d.join("salas.json"), self.en_red.red.mias_json()); } }
            // (a mis NPC: les pegó otro, o les cambió la actitud; de los de otros: se fue uno)
            Evento::NpcDano { n, dano, v, tumba, .. } => {
                let (id, p) = (n as u32, self.npcs.get(n as u32).map(|x| x.pos()));
                if let Some(p) = p { let d = [v[0] as f32, v[1] as f32, v[2] as f32]; self.npcs.danar(id, dano as f32, p, d, &mut self.fis, None); if tumba { self.npcs.tumbar(id, d, &mut self.fis); } }
            }
            Evento::NpcAct { n, a, .. } => { let act = npc::Actitud::normal(&a, None); self.npcs.aplicar(n as u32, act); }
            Evento::NpcFin { clave } => { self.en_red.cuerpos.remove(&format!("npc:{clave}")); }
            Evento::SalaCreada { sala } => { let s = sala.clone(); let _ = self.en_red.red.entrar(&s, Some(&s.clave)); self.entrar_sala(&s); }
            _ => {}
        }
    }

    /// los cuerpos de los demás: cargados con su skin (si no está, el Hero), con su arma, sentados en su vehículo y animados
    unsafe fn red_cuerpos(&mut self, m: &mut Motor3d, dt: f32) {
        let rem: Vec<red::Remoto> = self.en_red.red.remotos().iter().filter(|r| r.visible).cloned().collect();
        let nps: Vec<red::NpcRemoto> = self.en_red.red.npcs_remotos().iter().filter(|n| !n.oculto).cloned().collect();
        self.en_red.cuerpos.retain(|id, _| rem.iter().any(|r| &r.id == id) || nps.iter().any(|n| id.strip_prefix("npc:") == Some(n.clave.as_str())));
        let Some(paq) = self.paq.as_mut() else { return };
        for r in &rem {
            if self.en_red.cuerpos.get(&r.id).map(|c| c.1 != r.skin).unwrap_or(true) {
                let c = Personaje::cargar(paq, &r.skin, 0, 512, &mut self.pj_cargados).or_else(|_| Personaje::cargar(paq, "Hero", 0, 512, &mut self.pj_cargados));
                match c { Ok((pj, esc)) => { if m.cargar(&esc).is_err() { continue; } self.en_red.cuerpos.insert(r.id.clone(), (pj, r.skin.clone())); } Err(_) => continue }
            }
            let Some((pj, _)) = self.en_red.cuerpos.get_mut(&r.id) else { continue };
            let arma = if r.veh.is_some() { None } else { r.arma.as_deref().filter(|a| ARMAS.iter().any(|d| d.n == *a)) };
            if let Some(e) = pj.poner_arma(paq, arma, &mut self.pj_cargados) { let _ = m.cargar(&e); }
            let pos = [r.pos[0] as f32, r.pos[1] as f32, r.pos[2] as f32];
            // (en un vehículo: el asiento; la clave es la de una cosa mía o la de otro)
            let asiento = r.veh.as_ref().and_then(|(clave, a)| {
                let oid = self.en_red.cosas.get(clave).copied().or_else(|| clave.strip_prefix(&format!("{}:", self.en_red.red.id)).and_then(|n| n.parse().ok()))?;
                let o = self.objs.iter().find(|o| o.id == oid)?; let cid = o.cuerpo?;
                let manejando = *a == 0 && self.vehs.de(cid)?.tipo != veh::Tipo::Asiento;
                let cab = self.vehs.cabina(paq, cid, (*a).max(0) as usize);
                Some(personaje::Asiento { pos, veh: o.pos, q: o.q, manejando, cab })
            });
            pj.sentar(paq, asiento);
            let e = personaje::Estado { piso: [pos[0], pos[1] - 0.95, pos[2]], vel: [r.vel[0] as f32, r.vel[1] as f32, r.vel[2] as f32], yaw: r.yaw as f32, mira: r.mira as f32, en_suelo: r.suelo, agachado: r.agachado, agua: None };
            pj.animar(dt, &e);
        }
        // (los NPC de otros: su cuerpo con su arma, donde los manda su dueño)
        for n in &nps {
            let k = format!("npc:{}", n.clave);
            if self.en_red.cuerpos.get(&k).map(|c| c.1 != n.skin).unwrap_or(true) {
                let c = Personaje::cargar(paq, &n.skin, 0, 512, &mut self.pj_cargados).or_else(|_| Personaje::cargar(paq, "Hero", 0, 512, &mut self.pj_cargados));
                match c { Ok((pj, esc)) => { if m.cargar(&esc).is_err() { continue; } self.en_red.cuerpos.insert(k.clone(), (pj, n.skin.clone())); } Err(_) => continue }
            }
            let Some((pj, _)) = self.en_red.cuerpos.get_mut(&k) else { continue };
            let arma = n.arma.as_deref().filter(|a| ARMAS.iter().any(|d| d.n == *a));
            if let Some(e) = pj.poner_arma(paq, arma, &mut self.pj_cargados) { let _ = m.cargar(&e); }
            let pos = [n.pos[0] as f32, n.pos[1] as f32, n.pos[2] as f32];
            let e = personaje::Estado { piso: [pos[0], pos[1] - 0.95, pos[2]], vel: [n.vel[0] as f32, n.vel[1] as f32, n.vel[2] as f32], yaw: n.yaw as f32, mira: 0.0, en_suelo: n.suelo, agachado: false, agua: None };
            pj.animar(dt, &e);
        }
    }

    /// el jugador de otro que toca un rayo antes de `max` (su cápsula: 0,35 m de radio, de los pies a 1,8 m): quién y a
    /// qué distancia (para los tiros con PvP)
    pub(super) fn red_rayo_jugador(&self, o: [f32; 3], d: [f32; 3], max: f32) -> Option<(String, f32)> {
        if !self.en_red.en_sala() || !self.en_red.red.sala.as_ref().map(|s| s.pvp).unwrap_or(false) { return None; }
        let mut mejor: Option<(String, f32)> = None;
        for r in self.en_red.red.remotos() {
            if !r.visible || !r.vivo { continue; }
            let (a, b) = ([r.pos[0] as f32, r.pos[1] as f32 - 0.6, r.pos[2] as f32], [r.pos[0] as f32, r.pos[1] as f32 + 0.5, r.pos[2] as f32]);
            if let Some(t) = rayo_capsula(o, d, a, b, 0.35) { if t < max && mejor.as_ref().map(|m| t < m.1).unwrap_or(true) { mejor = Some((r.id.clone(), t)); } }
        }
        mejor
    }
    /// lo que se dibuja de los demás
    pub(super) fn red_items(&self, items: &mut Vec<ItemDin>) {
        for n in self.en_red.red.npcs_remotos() {
            let Some((pj, _)) = self.en_red.cuerpos.get(&format!("npc:{}", n.clave)) else { continue };
            pj.items(&personaje::base([n.pos[0] as f32, n.pos[1] as f32 - 0.95, n.pos[2] as f32], n.yaw as f32), items);
        }
        for r in self.en_red.red.remotos() {
            let Some((pj, _)) = self.en_red.cuerpos.get(&r.id) else { continue };
            let b = pj.base_sentado().unwrap_or_else(|| personaje::base([r.pos[0] as f32, r.pos[1] as f32 - 0.95, r.pos[2] as f32], r.yaw as f32));
            pj.items(&b, items);
        }
    }

    /// el nombre de cada uno arriba de la cabeza (y el globo del chat mientras dura)
    pub(super) fn red_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) {
        let v = &self.vp_ult; let ahora = self.en_red.red.t;
        // (el chat: los últimos renglones, que se van apagando a los 12 s)
        let tc = t * 0.62; let mut y = hf * 0.62;
        for (txt, cuando) in self.en_red.chat.iter().rev() {
            let k = (1.0 - ((ahora - cuando) as f32 - 10.0) / 2.0).clamp(0.0, 1.0); if k <= 0.0 { continue; }
            let an = l.ancho(tc, txt).min(wf * 0.4);
            l.caja(u, tc * 0.5, y - tc * 0.25, an + tc, tc * 1.5, tc * 0.3, [0.0, 0.0, 0.0, 0.45 * k]);
            l.texto(u, tc, y, tc, [1.0, 1.0, 1.0, k], txt); y -= tc * 1.7;
        }
        for r in self.en_red.red.remotos() {
            if !r.visible { continue; }
            let g = [r.pos[0] as f32, r.pos[1] as f32 + 1.05, r.pos[2] as f32];
            let cw = v[3] * g[0] + v[7] * g[1] + v[11] * g[2] + v[15]; if cw < 0.1 { continue; }
            let (cx, cy) = ((v[0] * g[0] + v[4] * g[1] + v[8] * g[2] + v[12]) / cw, (v[1] * g[0] + v[5] * g[1] + v[9] * g[2] + v[13]) / cw);
            if cx.abs() > 1.2 || cy.abs() > 1.2 { continue; }
            let (sx, sy) = ((cx * 0.5 + 0.5) * wf, (0.5 - cy * 0.5) * hf);
            let tt = t * 0.75 * (8.0 / cw).clamp(0.65, 1.0); let an = l.ancho(tt, &r.nombre);
            l.texto_sombra(u, sx - an / 2.0, sy - tt, tt, [1.0, 1.0, 1.0, 0.95], &r.nombre);
            if let (Some(txt), true) = (&r.globo, r.globo_hasta > ahora) {
                let tg = t * 0.7; let ag = l.ancho(tg, txt).min(wf * 0.4);
                l.caja(u, sx - ag / 2.0 - tg * 0.5, sy - tt - tg * 1.9, ag + tg, tg * 1.5, tg * 0.4, [1.0, 1.0, 1.0, 0.92]);
                l.texto(u, sx - ag / 2.0, sy - tt - tg * 1.65, tg, [0.0, 0.0, 0.0, 1.0], txt);
            }
        }
    }

    /// el panel de salas: la lista (oficiales, las de los jugadores y quién está), crear una y salir
    pub(super) fn red_panel(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) {
        if !self.en_red.panel { return; }
        let bl = [1.0, 1.0, 1.0, 1.0];
        let salas = self.en_red.red.lista_salas(); let en = self.en_red.en_sala();
        let (c, bs) = panel_salas_geo(wf, hf, salas.len(), self.en_red.scroll, en);
        l.caja(u, c[0], c[1], c[2], c[3], hf * 0.03, [0.07, 0.08, 0.11, 0.94]);
        let estado = if self.en_red.puente.is_none() { "sin conexión".to_string() } else if en { self.en_red.red.estado() } else if self.en_red.red.lista_on { "conectado".into() } else { "conectando…".into() };
        l.texto(u, c[0] + hf * 0.03, c[1] + hf * 0.02, t * 0.9, bl, &format!("Multijugador · {estado}"));
        l.texto(u, c[0] + hf * 0.03, c[1] + hf * 0.08, t * 0.6, [1.0, 1.0, 1.0, 0.7], &format!("Te ven como «{}» · con los de la web en la misma sala", self.en_red.red.nombre));
        let tt = t * 0.72;
        for (b, r) in &bs {
            let (txt, der, sel, rojo): (String, String, bool, bool) = match *b {
                BtnSala::Cerrar => ("X".into(), String::new(), false, true),
                BtnSala::Crear => ("Crear sala en este mapa".into(), String::new(), false, false),
                BtnSala::Nombre => (format!("Nombre: {}", self.en_red.red.nombre), String::new(), false, false),
                BtnSala::Salir => ("Salir de la sala".into(), String::new(), false, true),
                BtnSala::Sala(k) => {
                    let (s, js) = &salas[k];
                    let aqui = en && self.en_red.red.sala.as_ref().map(|x| x.id == s.id).unwrap_or(false);
                    let mapa = s.m.strip_prefix("RB_").unwrap_or(&s.m);
                    (if s.n.to_lowercase().contains(&mapa.to_lowercase()) { s.n.clone() } else { format!("{} · {}", s.n, mapa) }, format!("{}{}", if js.is_empty() { "vacía".to_string() } else { format!("{} jugando", js.len()) }, if s.pw { " · con clave" } else { "" }), aqui, false)
                }
            };
            l.caja(u, r[0], r[1], r[2], r[3], hf * 0.012, if rojo { [0.6, 0.15, 0.12, 0.95] } else if sel { [0.95, 0.66, 0.1, 0.92] } else { [1.0, 1.0, 1.0, 0.1] });
            let col = if sel { [0.0, 0.0, 0.0, 1.0] } else { bl };
            if der.is_empty() {
                let mut ts = tt; while l.ancho(ts, &txt) > r[2] - 8.0 && ts > tt * 0.4 { ts *= 0.9; }
                let an = l.ancho(ts, &txt); l.texto(u, r[0] + (r[2] - an) / 2.0, r[1] + (r[3] - ts) / 2.0 - hf * 0.004, ts, col, &txt);
            } else {
                let ad = l.ancho(tt * 0.85, &der);
                l.texto(u, r[0] + hf * 0.02, r[1] + (r[3] - tt) / 2.0 - hf * 0.004, tt, col, &txt);
                l.texto(u, r[0] + r[2] - ad - hf * 0.02, r[1] + (r[3] - tt * 0.85) / 2.0 - hf * 0.004, tt * 0.85, if sel { col } else { [1.0, 1.0, 1.0, 0.7] }, &der);
            }
        }
        if salas.is_empty() { l.texto(u, c[0] + hf * 0.03, c[1] + hf * 0.16, tt, [1.0, 1.0, 1.0, 0.7], "Buscando salas…"); }
    }
}

/// dónde entra un rayo (origen `o`, dirección `d` de largo 1) en una cápsula vertical de `a` a `b` con radio `r` (lo más
/// cerca: el cilindro o las tapas, como esferas)
fn rayo_capsula(o: [f32; 3], d: [f32; 3], a: [f32; 3], b: [f32; 3], r: f32) -> Option<f32> {
    let esfera = |c: [f32; 3]| -> Option<f32> {
        let m = [o[0] - c[0], o[1] - c[1], o[2] - c[2]]; let bb = m[0] * d[0] + m[1] * d[1] + m[2] * d[2]; let cc = m[0] * m[0] + m[1] * m[1] + m[2] * m[2] - r * r;
        let disc = bb * bb - cc; if disc < 0.0 { return None; } let t = -bb - disc.sqrt(); if t >= 0.0 { Some(t) } else { None }
    };
    let mut mejor = [esfera(a), esfera(b)].into_iter().flatten().fold(f32::MAX, f32::min);
    // (el cilindro vertical: en el plano XZ)
    let (ox, oz) = (o[0] - a[0], o[2] - a[2]); let (qa, qb, qc) = (d[0] * d[0] + d[2] * d[2], ox * d[0] + oz * d[2], ox * ox + oz * oz - r * r);
    if qa > 1e-9 { let disc = qb * qb - qa * qc; if disc >= 0.0 { let t = (-qb - disc.sqrt()) / qa; let y = o[1] + d[1] * t; if t >= 0.0 && y >= a[1] && y <= b[1] { mejor = mejor.min(t); } } }
    if mejor < f32::MAX { Some(mejor) } else { None }
}
