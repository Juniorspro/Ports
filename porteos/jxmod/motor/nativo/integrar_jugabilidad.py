# Engancha jugabilidad.rs (destrucción, nucleares, artefactos, patada, linterna, cámara libre, mods nativos, Cíclope y
# Pepe) en comun.rs y combate.rs. Uso: python3 -I integrar_jugabilidad.py [carpeta src]  (por omisión, la de al lado).
# Cada ancla tiene que estar una sola vez; si alguna no está (o está más de una vez) no se escribe nada.
import os, sys
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')

COMUN = [
# el módulo y el campo
('#[path = "gmod_juego.rs"] pub mod gmod_juego;\n',
 '#[path = "gmod_juego.rs"] pub mod gmod_juego;\n// (lo de jugabilidad: destrucción, nucleares, artefactos, patada, linterna, cámara libre, mods nativos, Cíclope y Pepe)\n#[path = "jugabilidad.rs"] pub mod jugabilidad;\n'),
('    pub gmod: gmod_juego::EnGmod,\n',
 '    pub gmod: gmod_juego::EnGmod,\n    /// lo de jugabilidad.rs\n    pub jg: jugabilidad::Jugabilidad,\n'),
('her: Herramientas::default(), en_red, gmod, ', 'her: Herramientas::default(), en_red, gmod, jg: jugabilidad::Jugabilidad::default(), '),
# los botones propios
('Turbo, Salas, Chat, Emotes }', 'Turbo, Salas, Chat, Emotes, Jg(jugabilidad::Bj) }'),
('    v.push(Btn { b: Boton::Turbo, x: w - h * 0.68, y: h - h * 0.62, w: r * 1.3, h: r * 1.3, redondo: true });\n',
 '    v.push(Btn { b: Boton::Turbo, x: w - h * 0.68, y: h - h * 0.62, w: r * 1.3, h: r * 1.3, redondo: true });\n    jugabilidad::botones(w, h, &mut v);\n'),
('                Boton::Deshacer => { self.deshacer(); }\n',
 '                Boton::Deshacer => { self.deshacer(); }\n                Boton::Jg(b) => self.jg_boton(b),\n'),
('            Boton::Chat => self.en_red.en_sala(),\n',
 '            Boton::Chat => self.en_red.en_sala(),\n            Boton::Jg(b) => self.jg_visible(b),\n'),
('        // (con la barra de armas abierta, sólo ella',
 '        if self.jg.sin_hud() { return false; }\n        // (con la barra de armas abierta, sólo ella'),
('                Boton::Turbo => ("Turbo", ',
 '                Boton::Jg(b) => self.jg_etiqueta(b),\n                Boton::Turbo => ("Turbo", '),
('            Boton::Usar => self.usar_ve || self.vehs.jugador.is_some(),',
 '            Boton::Usar => self.usar_ve || self.vehs.jugador.is_some() || self.jg.usar_txt.is_some(),'),
('                Boton::Usar => (if self.vehs.jugador.is_some() { "Bajar" } else { "Subir" }, false),',
 '                Boton::Usar => (if self.vehs.jugador.is_some() { "Bajar" } else if let (Some(t), false) = (self.jg.usar_txt, self.usar_ve) { t } else { "Subir" }, false),'),
('    fn usar(&mut self) {\n', '    fn usar(&mut self) {\n        if self.jg_usar() { return; }\n'),
# los paneles propios (el menú MOD y la bomba de Rick Prime) toman los toques
('|| self.gmod.panel || self.emotes_panel { self.dedos.push(', '|| self.gmod.panel || self.emotes_panel || self.jg.panel() { self.dedos.push('),
('|| self.gmod.panel || self.emotes_panel {\n', '|| self.gmod.panel || self.emotes_panel || self.jg.panel() {\n'),
('if self.emotes_panel { self.toque_emotes(x, y, w, h); }', 'if self.jg.panel() { self.jg_toque(x, y, w, h); } else if self.emotes_panel { self.toque_emotes(x, y, w, h); }'),
('        if self.emotes_panel { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { self.emo_scroll',
 '        if self.jg.panel() { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { let dy = y - d.y; d.x = x; d.y = y; self.jg.mover(dy); } return; }\n        if self.emotes_panel { if let Some(d) = self.dedos.iter_mut().find(|d| d.id == id) { self.emo_scroll'),
# las Opciones de Props
('    pub fn poner(&mut self, m: &mut Motor3d, nombre: &str, ojos: [f32; 3], fw: [f32; 3]) -> Result<(), String> {\n',
 '    pub fn poner(&mut self, m: &mut Motor3d, nombre: &str, ojos: [f32; 3], fw: [f32; 3]) -> Result<(), String> {\n        if self.jg_poner(nombre) { return Ok(()); }\n'),
('npc::skin_de_item(it).map(npc::skin_nom).unwrap_or(it).chars()', 'npc::skin_de_item(it).map(npc::skin_nom).unwrap_or_else(|| self.jg.nombre_item(it)).chars()'),
# otro mapa
('self.npcs.olvidar(); self.npc_skins.olvidar(); self.vehs = Vehiculos::nuevo(); self.pila.clear();\n',
 'self.npcs.olvidar(); self.npc_skins.olvidar(); self.vehs = Vehiculos::nuevo(); self.pila.clear(); self.jg_limpiar();\n'),
# cada cuadro: la entrada, el jugador que mueve un mod, los choques de la física y lo de jugabilidad
('        let ent = self.entrada(hf);\n', '        let ent = self.entrada(hf);\n        let ent = self.jg_entrada(ent, dt);\n'),
('while self.acum >= PASO { self.jug.paso_con(&mp.mundo, Some(&mut self.fis), PASO, &ent);',
 'while self.acum >= PASO { if !self.jg.mueve_jugador() { self.jug.paso_con(&mp.mundo, Some(&mut self.fis), PASO, &ent); }'),
('                self.fis.paso(&mp.mundo, PASO_FIS as f64); self.acum_fis -= PASO_FIS;\n',
 '                self.fis.paso(&mp.mundo, PASO_FIS as f64); self.acum_fis -= PASO_FIS;\n                self.jg.des.golpes.extend(self.fis.golpes.iter().cloned());\n'),
('        self.gmod_tam(wf, hf); self.gmod_cuadro(m, dt);\n', '        self.gmod_tam(wf, hf); self.gmod_cuadro(m, dt);\n        unsafe { self.jg_cuadro(m, dt); }\n'),
# el cuerpo del jugador: se ve pateando en primera persona y no tirado como muñeco; la pose de los mods
('        let ver_cuerpo = self.camara != 0 || (en_veh.is_some() && !self.vehs.primera);\n',
 '        let ver_cuerpo = (self.camara != 0 || (en_veh.is_some() && !self.vehs.primera) || self.jg.cuerpo_en_primera()) && !self.jg.sin_cuerpo();\n'),
('                pj.animar(dt, &e);\n',
 '                let e = jugabilidad::estado(&self.jg, e); pj.animar(dt, &e);\n                jugabilidad::pose_jugador(&mut self.jg, pj, &self.jug, self.mapa.as_ref().map(|m| &m.mundo), self.camara, dt);\n'),
# la cámara (la libre, la cinemática) y la luz roja del Cíclope
('            } };\n            // (el temblor de las explosiones)\n',
 '            } };\n            let (cam, mira) = jugabilidad::camara(&mut self.jg, cam, mira);\n            // (el temblor de las explosiones)\n'),
('            let mut luz = mp.luz;\n', '            let mut luz = mp.luz; jugabilidad::luz(&self.jg, &mut luz);\n'),
('if self.camara == 0 && !self.armas.zoom && self.vehs.jugador.is_none()', 'if self.camara == 0 && !self.armas.zoom && self.vehs.jugador.is_none() && !self.jg.sin_hud()'),
# lo que se dibuja, los carteles de las nucleares y las luces
('self.npcs.items(&mut items); self.red_items(&mut items);', 'self.npcs.items(&mut items); self.red_items(&mut items); self.jg_items(&mut items, cam);'),
('            let efectos = self.ef.bloques(&vpm, cam);\n', '            let mut efectos = self.ef.bloques(&vpm, cam); self.jg_efectos(&mut efectos, &vpm, cam);\n'),
('self.herramientas_items(&mut items, &mut luces); luces.truncate(8);', 'self.herramientas_items(&mut items, &mut luces); luces.truncate(8); self.jg_luces(&mut luces);'),
('luces, esp: vec![], items, efectos };', 'luces, esp: self.jg_esp(cam, mira), items, efectos };'),
# los vehículos que se rompen: como vehiculoRoto (explosion(p, 5, 60)) y desRoto (se infla, saltan ruedas, arde)
('                veh::Evento::Roto { p, .. } => self.explosion([p[0] as f32, p[1] as f32, p[2] as f32], 6.0, 100.0),',
 '                veh::Evento::Roto { p, cuerpo } => { self.explosion([p[0] as f32, p[1] as f32, p[2] as f32], 5.0, 60.0); self.des_roto(cuerpo); }'),
# el HUD: lo que tapa la pantalla (debajo de los botones) y lo de arriba (paneles, subtítulos)
# (en el screamer de Pepe, sin la mira ni la vida: body.pvGrita)
('        if !abierto && self.mapa.is_some() { l.disco(&mut u, wf / 2.0, hf / 2.0, hf * 0.006', '        if !abierto && self.mapa.is_some() && !self.jg.sin_hud() { l.disco(&mut u, wf / 2.0, hf / 2.0, hf * 0.006'),
('        if !abierto && self.mapa.is_some() {\n            let k = hf / 590.0 * 1.4;', '        if !abierto && self.mapa.is_some() && !self.jg.sin_hud() {\n            let k = hf / 590.0 * 1.4;'),
('        let gm_tex = self.gmod_hud(l, &mut u, wf, hf, t);\n', '        let gm_tex = self.gmod_hud(l, &mut u, wf, hf, t);\n        self.jg_hud_fondo(l, &mut u, wf, hf);\n'),
('        let mut r = vec![(TEX_LETRAS, u), (TEX_ICONOS, ic), (TEX_ARMAS, ia)]; r.extend(gm_tex); r',
 '        let jg_tex = self.jg_hud(l, &mut u, wf, hf, t);\n        let mut r = vec![(TEX_LETRAS, u), (TEX_ICONOS, ic), (TEX_ARMAS, ia)]; r.extend(gm_tex); r.extend(jg_tex); r'),
]
COMBATE = [
# la chapa de los autos se hunde del lado de la explosión (desExplosion) y, en la definitiva del Cíclope, no te lastima
('        for (id, dk) in danos { if let Some(i) = self.objs.iter().position(|o| o.cuerpo == Some(id)) { self.danar_objeto(i, dk); } self.vehs.danar(&self.fis, id, dk as f64); }\n',
 '        for (id, dk) in danos { if let Some(i) = self.objs.iter().position(|o| o.cuerpo == Some(id)) { self.danar_objeto(i, dk); } self.vehs.danar(&self.fis, id, dk as f64); }\n        self.des_explosion_cerca(p, radio);\n'),
('        if dj < radio * 1.4 {\n', '        if dj < radio * 1.4 && !self.jg.inmune() {\n'),
]

def aplicar(ruta, cambios):
    s = open(ruta, encoding='utf-8').read(); mal = []
    for a, b in cambios:
        n = s.count(a)
        if n != 1: mal.append('%s: %d veces: %s' % (os.path.basename(ruta), n, a[:90].replace('\n', '⏎')))
        else: s = s.replace(a, b)
    return s, mal

nuevos, errores = {}, []
for nombre, cambios in (('comun.rs', COMUN), ('combate.rs', COMBATE)):
    ruta = os.path.join(src, nombre); s, mal = aplicar(ruta, cambios); nuevos[ruta] = s; errores += mal
if errores:
    print('NO SE APLICÓ NADA:'); [print('  ' + e) for e in errores]; sys.exit(1)
for ruta, s in nuevos.items(): open(ruta, 'w', encoding='utf-8').write(s)
print('listo: %d cambios en comun.rs y %d en combate.rs' % (len(COMUN), len(COMBATE)))
