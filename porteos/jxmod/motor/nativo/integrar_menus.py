# Engancha el inicio de JXMod y sus menús (inicio_juego.rs: el inicio con el menú clásico; paneles_juego.rs: los paneles;
# pausa_juego.rs: la pausa, su botón y la pantalla de carga; pincel.rs e iconos.rs: el dibujo 2D y los íconos de la web) en
# comun.rs, jugabilidad.rs (el botón MOD en su columna de hudorden.js), app.rs, lib.rs, Cargo.toml, motor/jxmotor/src/vk.rs (la interfaz de Vulkan con niveles —mipmaps—, como OpenGL) y
# apk/armar_nativo.py (el atlas de los menús y las escenas de fondo en la APK).
# Uso: python3 -I integrar_menus.py [carpeta src]  (por omisión, la de al lado).
# Cada ancla tiene que estar una sola vez; si alguna no está (o está más de una vez) no se escribe nada.
import os, sys
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')
nativo = os.path.dirname(os.path.abspath(src))
motor = os.path.dirname(nativo)
jxmod = os.path.dirname(motor)

COMUN = [
# los módulos y el estado
('#[path = "jugabilidad.rs"] pub mod jugabilidad;\n',
 '#[path = "jugabilidad.rs"] pub mod jugabilidad;\n// (el inicio con el menú clásico, sus paneles y la pausa: inicio.js, clasico.js, paneles.js, rbmenus.js, ui.js)\n'
 '#[path = "inicio_juego.rs"] pub mod inicio_juego;\n#[path = "paneles_juego.rs"] pub mod paneles_juego;\n#[path = "pausa_juego.rs"] pub mod pausa_juego;\n'),
('    pub jg: jugabilidad::Jugabilidad,\n',
 '    pub jg: jugabilidad::Jugabilidad,\n    /// el inicio, los paneles y la pausa (inicio_juego.rs)\n    pub ini: inicio_juego::Inicio,\n'),
('jg: jugabilidad::Jugabilidad::default(), ', 'jg: jugabilidad::Jugabilidad::default(), ini: inicio_juego::Inicio::default(), '),
# (otro motor —se eligió otro en Ajustes—: lo del inicio se vuelve a subir)
('    pub fn al_abrir(&mut self) { self.recargar = true; self.ef.reenviar_marcas(); }\n',
 '    pub fn al_abrir(&mut self) { self.recargar = true; self.ef.reenviar_marcas(); self.ini_texturas_perdidas(); }\n'),
# (el motor se vació: las texturas del inicio se vuelven a subir)
('    fn cargar_letras(&self, m: &mut Motor3d) {\n', '    fn cargar_letras(&self, m: &mut Motor3d) {\n        self.ini_texturas_perdidas();\n'),
# el tacto: primero el inicio (o la pausa y sus paneles, jugando)
('    pub fn dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) {\n        self.dedos.retain(|d| d.id != id);\n',
 '    pub fn dedo_abajo(&mut self, id: i32, x: f32, y: f32, w: f32, h: f32) {\n        self.dedos.retain(|d| d.id != id);\n        if self.ini_dedo_abajo(id, x, y, w, h) { return; }\n'),
('    pub fn dedo_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) {\n',
 '    pub fn dedo_mueve(&mut self, id: i32, x: f32, y: f32, h: f32) {\n        if self.ini_dedo_mueve(id, x, y, h) { return; }\n'),
('    pub fn dedo_arriba_en(&mut self, id: i32, w: f32, h: f32) {\n',
 '    pub fn dedo_arriba_en(&mut self, id: i32, w: f32, h: f32) {\n        if self.ini_dedo_arriba(id, w, h) { self.dedo_arriba(id); return; }\n'),
# cada cuadro: con el inicio a la vista, sólo el inicio; jugando, la pausa y lo demás encima del HUD
('    unsafe fn cuadro_dentro(&mut self, m: &mut Motor3d, w: i32, h: i32, placa_txt: &str) -> Result<(), String> {\n',
 '    unsafe fn cuadro_dentro(&mut self, m: &mut Motor3d, w: i32, h: i32, placa_txt: &str) -> Result<(), String> {\n        if self.ini.abierto { return self.ini_cuadro(m, w, h); }\n'),
('        let u = self.hud(w, h, placa_txt);\n        let r = m.dibujar(w, h, self.mapa.is_some(), &u);\n',
 '        let mut u = self.hud(w, h, placa_txt);\n        unsafe { self.ini_hud(m, w, h, &mut u); }\n        let r = m.dibujar(w, h, self.mapa.is_some(), &u);\n'),
]
APP = [
# (la app arranca en el inicio, como la web; lo de los menús se lee de la APK)
('    // (las capturas de nado del cuerpo)\n',
 '    // (el inicio: el atlas de los menús y las escenas de fondo salen de la APK; la app arranca en el menú, como la web)\n'
 '    { let app3 = app.clone(); j.inicio_lector(Box::new(move |n| activo(&app3, n))); }\n    j.inicio_abrir();\n'
 '    // (las capturas de nado del cuerpo)\n'),
# («Salir» del menú cierra la app: al volver de android_main, android-activity termina la actividad)
('        // (se eligió otro motor: se cierra el que está y se abre el nuevo en la misma ventana)\n',
 '        if j.ini.salir { salir = true; }\n        // (se eligió otro motor: se cierra el que está y se abre el nuevo en la misma ventana)\n'),
]
JUGABILIDAD = [
# (hudorden.js: arriba a la izquierda la columna del sistema —la pausa en la esquina— y al lado la de crear, con MOD redondo)
('    v.push(Btn { b: Boton::Jg(Bj::Mod), x: h * 0.14, y: 6.0 + (bh - 8.0) / 2.0, w: h * 0.2, h: bh - 8.0, redondo: false });\n',
 '    { let (x, y, s) = super::pausa_juego::boton_mod(w, h); v.push(Btn { b: Boton::Jg(Bj::Mod), x, y, w: s, h: s, redondo: true }); let _ = bh; }\n'),
]
LIB = [('pub mod comun;\n', 'pub mod comun;\n// (el dibujo 2D de los menús y los íconos de la web)\npub mod iconos;\npub mod pincel;\n')]
CARGO = [('png = "0.17"\n', 'png = "0.17"\n# (las fotos de los menús —el logo, las escenas de fondo—: WebP; ya estaba en Cargo.lock por jxjuego)\nimage-webp = "0.2"\n')]
VK = [
# (la interfaz con el muestreador que tiene niveles, como en OpenGL: las letras y los íconos achicados no titilan)
('                let g = self.grupo_tex1(mi, tv, self.s_cla, 6)?;\n', '                let g = self.grupo_tex1(mi, tv, self.s_rep, 6)?;\n'),
]
ARMAR = [
('    ap.add_argument(\'--conservar\', action=\'store_true\')\n',
 '    ap.add_argument(\'--conservar\', action=\'store_true\')\n'
 '    ap.add_argument(\'--paquete\', default=\'\', help=\'el PAQUETE de la web: sus escenas de fondo (fondos/*) y las fotos de carga (carga/*) van al inicio, en WebP\')\n'),
('        A.correr([sys.executable, \'-I\', os.path.join(os.path.dirname(AQUI), \'herramientas\', \'atlas_letras.py\'), os.path.join(act, \'ui\')], \'atlas de letras\')\n',
 '        A.correr([sys.executable, \'-I\', os.path.join(os.path.dirname(AQUI), \'herramientas\', \'atlas_letras.py\'), os.path.join(act, \'ui\')], \'atlas de letras\')\n'
 '        # (el inicio: el atlas de los menús —Oswald y la letra de los textos— y, con --paquete, las escenas de fondo del inicio\n'
 '        # como fondos/1.webp, 2… —las de FONDOS_RB, en el mismo orden— y las fotos de carga como carga/<nombre>.webp)\n'
 '        A.correr([sys.executable, \'-I\', os.path.join(os.path.dirname(AQUI), \'herramientas\', \'atlas_menus.py\'), os.path.join(act, \'ui\')], \'atlas de los menús\')\n'
 '        if a.paquete:\n'
 '            from PIL import Image\n'
 '            for sub, nombre in ((\'fondos\', lambda i, f: \'%d.webp\' % (i + 1)), (\'carga\', lambda i, f: f.split(\'_\', 1)[-1].rsplit(\'.\', 1)[0] + \'.webp\')):\n'
 '                d = os.path.join(a.paquete, sub)\n'
 '                if not os.path.isdir(d): continue\n'
 '                os.makedirs(os.path.join(act, sub), exist_ok=True)\n'
 '                for i, f in enumerate(sorted(x for x in os.listdir(d) if x.lower().endswith((\'.png\', \'.jpg\', \'.jpeg\', \'.webp\')))):\n'
 '                    Image.open(os.path.join(d, f)).convert(\'RGB\').save(os.path.join(act, sub, nombre(i, f)), \'WEBP\', quality=82, method=6)\n'),
]

def aplicar(ruta, cambios):
    s = open(ruta, encoding='utf-8').read(); mal = []
    for a, b in cambios:
        n = s.count(a)
        if n != 1: mal.append('%s: %d veces: %s' % (os.path.basename(ruta), n, a[:90].replace('\n', '⏎')))
        else: s = s.replace(a, b)
    return s, mal

nuevos, errores = {}, []
for ruta, cambios in ((os.path.join(src, 'comun.rs'), COMUN), (os.path.join(src, 'app.rs'), APP), (os.path.join(src, 'jugabilidad.rs'), JUGABILIDAD), (os.path.join(src, 'lib.rs'), LIB), (os.path.join(nativo, 'Cargo.toml'), CARGO),
                      (os.path.join(motor, 'jxmotor', 'src', 'vk.rs'), VK), (os.path.join(jxmod, 'apk', 'armar_nativo.py'), ARMAR)):
    if not os.path.isfile(ruta): errores.append('no está ' + ruta); continue
    s, mal = aplicar(ruta, cambios); nuevos[ruta] = s; errores += mal
if errores:
    print('NO SE APLICÓ NADA:'); [print('  ' + e) for e in errores]; sys.exit(1)
for ruta, s in nuevos.items(): open(ruta, 'w', encoding='utf-8').write(s)
print('listo: %d cambios en comun.rs, %d en jugabilidad.rs, %d en app.rs, %d en lib.rs, %d en Cargo.toml, %d en vk.rs y %d en armar_nativo.py' % (len(COMUN), len(JUGABILIDAD), len(APP), len(LIB), len(CARGO), len(VK), len(ARMAR)))
