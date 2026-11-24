# Engancha mapas_juego.rs (los mapas del Workshop —gmod_bsp.js—, sus puertas, botones, zonas, sonidos, trenes y puertas
# portal —puertas.js, mapaio.js, portales.js—, el cielo 3D y la hora del día —dia.js—) en comun.rs.
# Uso: python3 -I integrar_mapas.py [carpeta src]  (por omisión, la de al lado). Anda antes o después de
# integrar_jugabilidad.py. Cada ancla tiene que estar una sola vez; si alguna no está (o está más de una vez) no se escribe
# nada. Si ya está aplicado, no hace nada.
import os, sys
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')

COMUN = [
# el módulo, el campo y su valor al empezar
('#[path = "gmod_juego.rs"] pub mod gmod_juego;\n',
 '#[path = "gmod_juego.rs"] pub mod gmod_juego;\n// (los mapas del Workshop —sus puertas, botones, zonas, sonidos, trenes y puertas portal— y la hora del día)\n#[path = "mapas_juego.rs"] pub mod mapas_juego;\n'),
('    pub gmod: gmod_juego::EnGmod,\n',
 '    pub gmod: gmod_juego::EnGmod,\n    /// los mapas del Workshop y la hora del día (mapas_juego.rs)\n    pub mj: mapas_juego::EnMapas,\n'),
('her: Herramientas::default(), en_red, gmod, ', 'her: Herramientas::default(), en_red, gmod, mj: Default::default(), '),
# otro mapa: el motor se vació (lo armado de los addons ya no está) y los WS_ se arman del .bsp
('        unsafe { m.vaciar(); }\n        let Some(paq) = self.paq.as_mut() else { return };\n',
 '        unsafe { m.vaciar(); }\n        self.mapas_vaciado();\n        let Some(paq) = self.paq.as_mut() else { return };\n'),
('        match mapa::armar(paq, nombre, 1024, 750.0) {',
 '        match if nombre.starts_with("WS_") { self.mapa_ws(m, nombre) } else { mapa::armar(paq, nombre, 1024, 750.0) } {'),
# cada cuadro: la hora del día, las puertas, los trenes, lo del mapa, los portales y qué se mira
('        self.gmod_tam(wf, hf); self.gmod_cuadro(m, dt);\n',
 '        self.gmod_tam(wf, hf); self.gmod_cuadro(m, dt);\n        unsafe { self.mapas_cuadro(m, dt); }\n'),
# lo que se dibuja: las puertas donde quedaron
('self.npcs.items(&mut items); self.red_items(&mut items);', 'self.npcs.items(&mut items); self.red_items(&mut items); self.mapas_items(&mut items);'),
# «Usar» con una puerta o un botón del mapa a la vista
('            Boton::Recargar => self.armas.def().car > 0 && self.vehs.jugador.is_none(),\n',
 '            Boton::Recargar => self.armas.def().car > 0 && self.vehs.jugador.is_none(),\n            Boton::Usar if self.mj.usar.is_some() && self.vehs.jugador.is_none() => true,\n'),
('                Boton::Recargar => ("R", self.armas.recargando > 0.0),\n',
 '                Boton::Recargar => ("R", self.armas.recargando > 0.0),\n                Boton::Usar if !self.usar_ve && self.vehs.jugador.is_none() && self.mj.usar_txt.is_some() => (self.mj.usar_txt.unwrap_or(""), false),\n'),
('    fn usar(&mut self) {\n', '    fn usar(&mut self) {\n        if self.mapas_usar() { return; }\n'),
]

def aplicar(ruta, cambios):
    s = open(ruta, encoding='utf-8').read(); mal = []
    if 'pub mod mapas_juego;' in s: return None, []
    for a, b in cambios:
        n = s.count(a)
        if n != 1: mal.append('%s: %d veces: %s' % (os.path.basename(ruta), n, a[:90].replace('\n', '⏎')))
        else: s = s.replace(a, b)
    return s, mal

ruta = os.path.join(src, 'comun.rs'); s, errores = aplicar(ruta, COMUN)
if s is None: print('ya estaba aplicado'); sys.exit(0)
if errores:
    print('NO SE APLICÓ NADA:'); [print('  ' + e) for e in errores]; sys.exit(1)
open(ruta, 'w', encoding='utf-8').write(s)
print('listo: %d cambios en comun.rs' % len(COMUN))
# (la prueba con fotos —examples/mapas_foto.rs— necesita los cambios: espera en examples/apoyo hasta ahora)
ej = os.path.join(src, '..', 'examples'); de, a = os.path.join(ej, 'apoyo', 'mapas_foto.rs'), os.path.join(ej, 'mapas_foto.rs')
if os.path.isfile(de) and not os.path.exists(a): open(a, 'w', encoding='utf-8').write(open(de, encoding='utf-8').read()); print('y examples/mapas_foto.rs')
