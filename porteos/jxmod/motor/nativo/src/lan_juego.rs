//! lan.js en la nativa (lo de la red está en lan.rs): «LAN / Wi-Fi» en Buscar partida hace de anfitrión (el broker en
//! este celular, la sala «Nombre · LAN» con el mapa elegido) y entra; las partidas de la red aparecen arriba en la lista
//! de servers (las de la app web también: el mismo anuncio) y se entra con Entrar, como a cualquiera. Al salir al menú, la
//! partida del anfitrión se cierra (lanSalir).
use super::*;
use crate::lan::{Anfitrion, Buscador};
use jxjuego::red::Sala;

#[derive(Default)]
pub struct EnLan {
    /// la partida que hago yo (y su du)
    pub host: Option<(Anfitrion, String)>,
    busca: Option<Buscador>, fallo_busca: bool,
    /// el candado de multicast de Android (sin él, muchos celulares no reciben los broadcast)
    pub candado: Option<Box<dyn Fn()>>,
}

impl Juego {
    /// empieza a escuchar los anuncios (al abrir Buscar partida)
    pub(crate) fn lan_buscar(&mut self) {
        if self.lan.busca.is_some() || self.lan.fallo_busca { return; }
        if let Some(c) = &self.lan.candado { c(); }
        let mapas = self.mapas.clone();
        match Buscador::empezar(Box::new(move |m| mapas.iter().any(|x| x == m))) { Ok(b) => self.lan.busca = Some(b), Err(_) => self.lan.fallo_busca = true }
    }
    /// las partidas de la red como salas de la lista (con su gente: la que anuncian)
    pub(crate) fn lan_salas(&self) -> Vec<(Sala, Vec<String>)> {
        let Some(b) = &self.lan.busca else { return vec![] };
        let mia = self.lan.host.as_ref().map(|h| h.1.clone());
        b.lista().into_iter().filter(|h| Some(&h.du) != mia.as_ref())
            .map(|h| (Sala::lan(&h.du, &h.n, &h.s, &h.m, &format!("ws://{}:{}/mqtt", h.ip, h.puerto)), vec![String::new(); h.j as usize])).collect()
    }
    /// lanHostear: arma la partida en este celular y devuelve la sala para entrar
    pub(crate) fn lan_hostear(&mut self, mapa: &str) -> Result<Sala, String> {
        self.lan.host = None;
        let nom: String = self.en_red.red.nombre.chars().filter(|c| !c.is_control()).take(16).collect::<String>().trim().to_string();
        let nom = if nom.is_empty() { "Player".to_string() } else { nom };
        let sala: String = format!("{nom} · LAN").chars().take(24).collect();
        let du = self.en_red.red.id.clone();
        let info = serde_json::json!({ "du": du, "n": nom, "s": sala, "m": mapa, "p": crate::lan::PUERTO });
        let a = Anfitrion::empezar(&info).map_err(|e| format!("No se pudo armar la partida en el Wi-Fi ({e})"))?;
        let url = format!("ws://127.0.0.1:{}/mqtt", a.puerto);
        self.lan.host = Some((a, du.clone()));
        Ok(Sala::lan(&du, &nom, &sala, mapa, &url))
    }
    /// lanSalir: si era anfitrión, la partida se cierra
    pub(crate) fn lan_salir(&mut self) { self.lan.host = None; }
    /// la IP para que entren escribiéndola (http://IP:8765/lan.json), si se sabe
    pub fn lan_ip(&self) -> Option<String> { self.lan.host.as_ref().and(crate::lan::ip_local()).map(|i| i.to_string()) }
}
