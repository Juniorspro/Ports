# Engancha personajes.rs (gorros, identidad, el panel de Personaje, el accesorio, el arma a gusto, el celular y los emotes
# nuevos: celu_juego.rs, emotes_juego.rs, accesorio.rs, vectores.rs) en comun.rs, y los cambios chicos en otros archivos
# (red_juego.rs, armas.rs, app.rs, pausa_juego.rs; en jxjuego: lib.rs, personaje.rs, vista.rs, paquete.rs, npc.rs; y apk/armar_nativo.py).
# Uso: python3 -I integrar_personajes.py [carpeta motor]  (por omisión, la de arriba de ésta).
# Cada ancla tiene que estar una sola vez; si alguna no está (o está más de una vez) no se escribe nada.
import os, sys
motor = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *p: os.path.join(motor, *p)

COMUN = [
# el módulo, el campo y al arrancar
('#[path = "jugabilidad.rs"] pub mod jugabilidad;\n',
 '#[path = "jugabilidad.rs"] pub mod jugabilidad;\n// (lo de personajes: gorros, identidad, el panel de Personaje, el accesorio, el arma a gusto, el celular y los emotes nuevos)\n#[path = "personajes.rs"] pub mod personajes;\n'),
('    pub jg: jugabilidad::Jugabilidad,\n',
 '    pub jg: jugabilidad::Jugabilidad,\n    /// lo de personajes.rs\n    pub pjs: personajes::Pjs,\n'),
('jg: jugabilidad::Jugabilidad::default(), ', 'jg: jugabilidad::Jugabilidad::default(), pjs: personajes::Pjs::default(), '),
('        if !placa.hecha() { j.aviso = ', '        j.pjs_iniciar();\n        if !placa.hecha() { j.aviso = '),
# los botones propios (el celular y Personaje)
('Jg(jugabilidad::Bj) }', 'Jg(jugabilidad::Bj), Pj(personajes::Bp) }'),
('    jugabilidad::botones(w, h, &mut v);\n', '    jugabilidad::botones(w, h, &mut v);\n    personajes::botones(w, h, &mut v);\n'),
('                Boton::Jg(b) => self.jg_boton(b),\n', '                Boton::Jg(b) => self.jg_boton(b),\n                Boton::Pj(b) => self.pj_boton(b),\n'),
('            Boton::Jg(b) => self.jg_visible(b),\n', '            Boton::Jg(b) => self.jg_visible(b),\n            Boton::Pj(b) => self.pj_visible(b),\n'),
('                Boton::Jg(b) => self.jg_etiqueta(b),\n', '                Boton::Jg(b) => self.jg_etiqueta(b),\n                Boton::Pj(b) => self.pj_etiqueta(b),\n'),
# (el botón de emotes: un toque abre la ruleta; mantener y deslizar elige al soltar —ruleta.js—)
('                Boton::Emotes => { self.emotes_panel = true; self.emo_scroll = 0.0; }\n', '                Boton::Emotes => self.emo_apretar(id, x, y),\n'),
# (con el celular en la mano no hay disparo)
('            Boton::Disparo | Boton::Disparo2 | Boton::Arma | Boton::Objetos | Boton::Volar if self.vehs.jugador.is_some() => false,\n',
 '            Boton::Disparo | Boton::Disparo2 if self.armas.def().tipo == "celu" => false,\n            Boton::Disparo | Boton::Disparo2 | Boton::Arma | Boton::Objetos | Boton::Volar if self.vehs.jugador.is_some() => false,\n'),
# los paneles propios toman los toques; la pantalla del celular en la mano, los que caen en ella
('|| self.jg.panel() { self.dedos.push(', '|| self.jg.panel() || self.pjs.panel() { self.dedos.push('),
('|| self.jg.panel() {\n', '|| self.jg.panel() || self.pjs.panel() {\n'),
('if self.jg.panel() { self.jg_toque(x, y, w, h); }', 'if self.pjs.panel() { self.pj_toque(x, y, w, h); } else if self.jg.panel() { self.jg_toque(x, y, w, h); }'),
('        if self.jg.panel() { if let Some(d) = self.dedos.iter_mut()', '        if self.pj_mueve(id, x, y, h) { return; }\n        if self.jg.panel() { if let Some(d) = self.dedos.iter_mut()'),
('        let ve = |b: Boton| self.boton_visible(b);\n', '        if self.pj_dedo_abajo(id, x, y, w, h) { self.dedos.push(Dedo { id, palanca: false, boton: None, x0: x, y0: y, x, y }); return; }\n        let ve = |b: Boton| self.boton_visible(b);\n'),
('    pub fn dedo_arriba_en(&mut self, id: i32, w: f32, h: f32) {\n', '    pub fn dedo_arriba_en(&mut self, id: i32, w: f32, h: f32) {\n        self.pj_dedo_arriba(id);\n'),
# escribir (los buscadores y el color del gorro)
('pub enum Escribir { Chat, Clave(jxjuego::red::Sala), Nombre, Actitud }', 'pub enum Escribir { Chat, Clave(jxjuego::red::Sala), Nombre, Actitud, Pj }'),
('            Escribir::Actitud => {', '            Escribir::Pj => self.pj_escrito(&t),\n            Escribir::Actitud => {'),
# los emotes nuevos (de captura, del paquete, de la gente)
('    pub fn hacer_emote(&mut self, e: Option<String>) {\n', '    pub fn hacer_emote(&mut self, e: Option<String>) {\n        if self.emo_hacer(&e) { return; }\n'),
# el celular no tiene vista de arma (la mano la dibuja personajes.rs); el arma a gusto (armaaj.js)
('        let d = self.armas.def();\n        if self.vista.as_ref().map(|v| v.nodo != d.nodo).unwrap_or(true) {',
 '        if self.armas.def().tipo == "celu" { self.vista = None; return; }\n        let d = self.armas.def();\n        if self.vista.as_ref().map(|v| v.nodo != d.nodo).unwrap_or(true) {'),
('            if self.camara == 0 && !self.armas.zoom && self.vehs.jugador.is_none() && !self.jg.sin_hud() && !self.gmod_vista_propia() { if let Some(v) = self.vista.as_mut() {',
 '            let aj = self.arma_aj_matriz();\n            if self.camara == 0 && !self.armas.zoom && self.vehs.jugador.is_none() && !self.jg.sin_hud() && !self.gmod_vista_propia() { if let Some(v) = self.vista.as_mut() {'),
('v.ubicar(ojos, qcam(yaw, pitch), self.sway, self.armas.ap_k);', 'v.ubicar_aj(ojos, qcam(yaw, pitch), self.sway, self.armas.ap_k, aj);'),
# cada cuadro, al cambiar de mapa y el mapa nuevo (la plaza JX)
('        unsafe { self.jg_cuadro(m, dt); }\n', '        unsafe { self.jg_cuadro(m, dt); }\n        self.pjs.celu.pantalla = (wf, hf); unsafe { self.pjs_cuadro(m, dt); }\n'),
('self.pila.clear(); self.jg_limpiar();\n', 'self.pila.clear(); self.jg_limpiar(); self.pjs_limpiar();\n'),
('                self.mapa = Some(mp); self.npcs.piso = self.piso().into();\n', '                self.mapa = Some(mp); self.npcs.piso = self.piso().into();\n                self.pjs_mapa(m);\n'),
# el cuerpo: el celular en la mano en tercera persona (después de animar) y de a dos (juntos.js) en su escena
('                jugabilidad::pose_jugador(&mut self.jg, pj, &self.jug, self.mapa.as_ref().map(|m| &m.mundo), self.camara, dt);\n',
 '                jugabilidad::pose_jugador(&mut self.jg, pj, &self.jug, self.mapa.as_ref().map(|m| &m.mundo), self.camara, dt);\n                personajes::pose_jugador(&mut self.pjs, pj, self.armas.def().tipo == "celu", self.emote.is_some(), en_veh.is_some());\n'),
('let b = pj.base_sentado().unwrap_or_else(|| personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw)); pj.items(&b, &mut items);',
 'let b = pj.base_sentado().or_else(|| personajes::emotes_juego::base_escena(&self.pjs)).unwrap_or_else(|| personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw)); pj.items(&b, &mut items);'),
# lo que se dibuja (gorros, accesorios, el celular, la plaza) y la luz de la plaza
('self.jg_items(&mut items, cam);', 'self.jg_items(&mut items, cam); personajes::celu_juego::antes_items(&mut self.pjs.celu, self.ojos_ult, qcam(self.jug.yaw, self.jug.pitch), self.fov_b, wf / hf.max(1.0), self.sway); self.pjs_items(&mut items, cam, ver_cuerpo);'),
('luces.truncate(8); self.jg_luces(&mut luces);', 'luces.truncate(8); self.jg_luces(&mut luces); self.pjs_luces(&mut luces, ojos);'),
# el HUD
('        let jg_tex = self.jg_hud(l, &mut u, wf, hf, t);\n', '        let jg_tex = self.jg_hud(l, &mut u, wf, hf, t);\n        let pj_tex = self.pjs_hud(l, &mut u, wf, hf, t);\n'),
('r.extend(gm_tex); r.extend(jg_tex); r', 'r.extend(gm_tex); r.extend(jg_tex); r.extend(pj_tex); r'),
# (para las pruebas: sin el HUD, para comparar fotos con la web)
('        let Some(l) = &self.letras else { return vec![] };\n', '        let Some(l) = &self.letras else { return vec![] };\n        if self.pjs.prueba_sin_hud { return vec![]; }\n'),
# (con el panel de Personaje abierto no se ve ningún botón: ni los de Ajustes y En línea, que quedarían sobre el escenario)
('let abierto = self.menu.is_some() || self.ajustes.is_some()', 'let abierto = self.pjs.panel.is_some() || self.menu.is_some() || self.ajustes.is_some()'),
('if (abierto && !matches!(b.b, Boton::Ajustes | Boton::Salas))', 'if (abierto && (self.pjs.panel.is_some() || !matches!(b.b, Boton::Ajustes | Boton::Salas)))'),
# los nombres propios de los mapas base (identidad.js)
('Clave::Mapa => self.mapas.iter().map(|m| m.to_string()).collect()', 'Clave::Mapa => self.mapas.iter().map(|m| jxjuego::identidad::nombre_mapa(m)).collect()'),
('let txt = format!("Cargando {}…", self.mapas[self.mapa_i]);', 'let txt = format!("Cargando {}…", jxjuego::identidad::nombre_mapa(&self.mapas[self.mapa_i]));'),
]
RED = [
('    cuerpos: HashMap<String, (Personaje, String)>,\n', '    pub(super) cuerpos: HashMap<String, (Personaje, String)>,\n'),
('l.jug = red::Jugador { skin: self.skin.clone(), gorro: "HatEmpty".into(), ',
 'l.jug = red::Jugador { skin: self.skin.clone(), gorro: self.pjs.prefs.gorro.clone(), gorro_aj: self.pjs.prefs.gorro_aj.as_ref().map(|g| g.json().to_string()).unwrap_or_default(), acc: self.pjs.prefs.acc.as_ref().map(|a| a.json().to_string()).unwrap_or_default(), '),
('            Evento::SalaCreada { sala } => {', '            Evento::Hecho { de, k, d } => self.pjs_hecho(&de, &k, &d),\n            Evento::SalaCreada { sala } => {'),
('let c = r.emote.as_deref().and_then(|e| personaje::ClipEmote::de(&paq.d, e)); pj.emote(c.as_ref()); }',
 'let c = r.emote.as_deref().and_then(|e| personaje::ClipEmote::de(&paq.d, e)); pj.emote(c.as_ref()); personajes::emotes_juego::aplicar_remoto(&mut self.pjs.emo, pj, r.emote.as_deref(), &r.id); }'),
('let b = pj.base_sentado().unwrap_or_else(|| personaje::base([r.pos[0] as f32, r.pos[1] as f32 - 0.95, r.pos[2] as f32], r.yaw as f32));',
 'let b = pj.base_sentado().or_else(|| personajes::emotes_juego::base_escena_remoto(&self.pjs, &r.id)).unwrap_or_else(|| personaje::base([r.pos[0] as f32, r.pos[1] as f32 - 0.95, r.pos[2] as f32], r.yaw as f32));'),
]
ARMAS = [
('pub const ARMAS: [DefArma; 14] = [', 'pub const ARMAS: [DefArma; 15] = ['),
('s_sacar: "grabholster", tipo: "golpe", cad: 0.55, dan: 35.0, alcance: 2.4, ..BASE },\n];',
 's_sacar: "grabholster", tipo: "golpe", cad: 0.55, dan: 35.0, alcance: 2.4, ..BASE },\n    // (el celular: viene instalado y prendido —el mod oficial «Celular», celumano.js—; en la mano lo dibuja personajes.rs)\n    DefArma { n: "Celular", nom: "Celular", ic: "ico:celular", tipo: "celu", cad: 0.3, ..BASE },\n];'),
]
APP = [
('    if let (Some(a), Some(b)) = (activo(&app, "cmu/126_04.bin"), activo(&app, "cmu/79_02.bin")) { j.nado = Some((a, b)); }\n',
 '    if let (Some(a), Some(b)) = (activo(&app, "cmu/126_04.bin"), activo(&app, "cmu/79_02.bin")) { j.nado = Some((a, b)); }\n    // (los emotes de captura: el catálogo y los que vengan en la APK —los demás se bajan—)\n    { let app4 = app.clone(); j.pjs.emo.lector = Some(Box::new(move |n: &str| activo(&app4, &format!("cmu/{n}")))); }\n'),
]
LIB_JUEGO = [
('pub mod censura;\n', 'pub mod celu_ik;\npub mod celulares;\npub mod censura;\n'),
('pub mod fisica;\n', 'pub mod fisica;\npub mod geo;\npub mod gorros;\npub mod identidad;\n'),
]
PERSONAJE = [
('use std::sync::Arc;\n\ntype Q', 'use std::sync::Arc;\n// (los emotes de captura y los nuevos: captura.rs; el celular en la mano de tercera persona: celu_pj.rs)\n#[path = "captura.rs"] mod captura;\npub use captura::{abrir_gz, base64, CapActiva, Captura};\n#[path = "celu_pj.rs"] mod celu_pj;\n\ntype Q'),
('    emo: Option<(ClipEmote, f32)>,\n', '    emo: Option<(ClipEmote, f32)>,\n    /// el emote de captura (captura.rs) y lo que lo levanta del piso (P.emoLift)\n    cap: Option<captura::CapActiva>, emo_lift: f32,\n'),
('nado: None, emo: None,', 'nado: None, emo: None, cap: None, emo_lift: 0.0,'),
('&& self.emo.is_none() && self.sentado.is_none() { if sp > 4.0', '&& !self.en_emo() && self.sentado.is_none() { if sp > 4.0'),
('        if self.emo.is_none() && sentado.is_none() {\n            if let Some(a) = self.accion.as_mut() {', '        if !self.en_emo() && sentado.is_none() {\n            if let Some(a) = self.accion.as_mut() {'),
('let clave = Clave { emo: self.emo.as_ref().map(|x| x.0.clave).unwrap_or(0),', 'let clave = Clave { emo: self.emo.as_ref().map(|x| x.0.clave).or(self.clave_cap()).unwrap_or(0),'),
('let si = pa.is_some() && self.emo.is_none() && sentado.is_none()', 'let si = pa.is_some() && !self.en_emo() && sentado.is_none()'),
('if self.ta_k > 0.0 && self.emo.is_none() && sentado.is_none() {', 'if self.ta_k > 0.0 && !self.en_emo() && sentado.is_none() {'),
('if !e.en_suelo || self.emo.is_some() || sentado.is_some() { 0.0 }', 'if !e.en_suelo || self.en_emo() || sentado.is_some() { 0.0 }'),
('if self.emo.is_some() || self.sentado.is_some() || a.agarre.is_none() { return; }', 'if self.en_emo() || self.sentado.is_some() || a.agarre.is_none() { return; }'),
('        self.animar_humano(dt, e);\n        self.nado_pose(dt, e);\n', '        self.animar_humano(dt, e);\n        self.cap_pose(dt);\n        self.nado_pose(dt, e);\n'),
('        } else if self.emo.is_some() { self.ik = None; }', '        } else if self.cap.as_ref().map_or(false, |c| c.c.cmu()) { self.ik = None; self.aterrizar_cmu(dt); } else if self.en_emo() { self.ik = None; }'),
('    pub fn emote(&mut self, c: Option<&ClipEmote>) { self.emo = c.map(|c| (c.clone(), 0.0)); }', '    pub fn emote(&mut self, c: Option<&ClipEmote>) { self.emo = c.map(|c| (c.clone(), 0.0)); self.cap = None; }'),
('    pub fn en_emote(&self) -> bool { self.emo.is_some() }', '    pub fn en_emote(&self) -> bool { self.en_emo() }'),
('if self.rag || self.sentado.is_some() || self.emo.is_some() { return None; }', 'if self.rag || self.sentado.is_some() || self.en_emo() { return None; }'),
]
VISTA = [
('/// el arma en la mano: el modelo, su pose y el clip que suena\npub struct Vista {\n', '// (el celular en la mano en primera persona —y el arma a gusto—: celu_vista.rs)\n#[path = "celu_vista.rs"] pub mod celu_vista;\n\n/// el arma en la mano: el modelo, su pose y el clip que suena\npub struct Vista {\n'),
]
PAQUETE = [
('    leer: Box<dyn Fn(&str) -> Option<Vec<u8>> + Send>,\n}\n',
 '    leer: Box<dyn Fn(&str) -> Option<Vec<u8>> + Send>,\n    /// teñir algunas texturas al leerlas (identidad.js: la ropa de las skins heredadas): número, ancho, alto y RGBA\n    pub tinte: Option<Box<dyn Fn(usize, u32, u32, &mut [u8]) + Send>>,\n}\n'),
('Ok(Paquete { idx, bloque, d, bin, rbp: HashMap::new(), leer })', 'Ok(Paquete { idx, bloque, d, bin, rbp: HashMap::new(), leer, tinte: None })'),
('rgba = mitad(&rgba, w, h, nw, nh); w = nw; h = nh; }\n        Some((w, h, rgba))', 'rgba = mitad(&rgba, w, h, nw, nh); w = nw; h = nh; }\n        if let Some(t) = &self.tinte { t(i, w, h, &mut rgba); }\n        Some((w, h, rgba))'),
]
NPC = [
('pub fn skin_nom(s: &str) -> &str { match s { "RickPrime" => "Rick Prime", "Jeppy" => "Jeppy Jothers", "UncleJeppy" => "Uncle Jeppy", "BoiledOne" => "The Boiled One", x => x } }',
 '/// (con los nombres propios de las skins heredadas: identidad.js)\npub fn skin_nom(s: &str) -> &str { crate::identidad::nombre_skin(s).unwrap_or(s) }'),
]
APK = [
("for n in ('126_04.bin', '79_02.bin'):", "for n in ('126_04.bin', '79_02.bin', 'catalogo.json'):"),
]
# (la pausa de integrar_menus.py: la tarjeta Personaje, jugando, abre el panel de personajes.rs —con los gorros y el
# accesorio, el escenario en el mapa— y Arma en la mano abre armaaj)
PAUSA = [
('            Pz::Personaje => { self.ini.pz.abierta = false; self.ini.desde_juego = true; self.pn_abrir(PanelIni::Personajes { tab: 0, scroll: 0.0 }); }\n',
 '            Pz::Personaje => { self.ini.pz.abierta = false; if self.mapa.is_some() { self.pj_abrir_desde_pausa(); } else { self.ini.desde_juego = true; self.pn_abrir(PanelIni::Personajes { tab: 0, scroll: 0.0 }); } }\n'),
('            Pz::Arma => self.avisar("«Arma en la mano» todavía no está en la versión nativa".into()),\n',
 '            Pz::Arma => { self.ini.pz.abierta = false; self.arma_aj_abrir(); }\n'),
# (con el panel de Personaje, el de emotes o el del arma abiertos no se ve el botón de pausa, como con los otros paneles)
('let ver_boton = !cargando && self.mapa.is_some()', 'let ver_boton = !cargando && !self.pjs.panel() && self.mapa.is_some()'),
('let libre = self.mapa.is_some()', 'let libre = !self.pjs.panel() && self.mapa.is_some()'),
]

def aplicar(ruta, cambios):
    s = open(ruta, encoding='utf-8').read(); mal = []
    for a, b in cambios:
        n = s.count(a)
        if n != 1: mal.append('%s: %d veces: %s' % (os.path.relpath(ruta, motor), n, a[:90].replace('\n', '⏎')))
        else: s = s.replace(a, b)
    return s, mal

trabajos = [(J('nativo', 'src', 'comun.rs'), COMUN), (J('nativo', 'src', 'red_juego.rs'), RED), (J('nativo', 'src', 'armas.rs'), ARMAS), (J('nativo', 'src', 'app.rs'), APP),
            (J('juego', 'src', 'lib.rs'), LIB_JUEGO), (J('juego', 'src', 'personaje.rs'), PERSONAJE), (J('juego', 'src', 'vista.rs'), VISTA), (J('juego', 'src', 'paquete.rs'), PAQUETE),
            (J('juego', 'src', 'npc.rs'), NPC), (J('..', 'apk', 'armar_nativo.py'), APK), (J('nativo', 'src', 'pausa_juego.rs'), PAUSA)]
nuevos, errores = {}, []
for ruta, cambios in trabajos:
    s, mal = aplicar(ruta, cambios); nuevos[ruta] = s; errores += mal
if errores:
    print('NO SE APLICÓ NADA:'); [print('  ' + e) for e in errores]; sys.exit(1)
for ruta, s in nuevos.items(): open(ruta, 'w', encoding='utf-8').write(s)
print('listo: ' + ', '.join('%s %d' % (os.path.basename(r), len(c)) for r, c in trabajos))
