# Engancha en comun.rs lo de los addons de GMod que va con el juego (gmod_pm.rs: los modelos de jugador de GMod como cuerpo
# del jugador y de los NPC; gmod_spawn.rs: NPC y vehículos de las listas; gmod_pill.rs: los Pill Packs).
# Uso: python3 -I integrar_gmod2.py [carpeta src]  (por omisión, la de al lado).
# Cada ancla tiene que estar una sola vez; si alguna no está (o está más de una vez) no se escribe nada.
import os, sys
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')

COMUN = [
# el cuerpo del jugador: con un modelo de GMod puesto (skin «gmpm:…»), ése en la pose del Hero (gmod_pm.rs)
# (el final de la línea del cuerpo, `if ver_cuerpo { if let Some(pj) = &self.pj { … let b = … personaje::base(…); pj.items(…); } }`)
('personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw)); pj.items(&b, &mut items); } }',
 'personaje::base([jp[0], jp[1] - 0.95, jp[2]], self.jug.yaw)); if !self.gmp_items_jugador(&b, &mut items, cam, dt) { pj.items(&b, &mut items); } } }'),
# los NPC con un modelo de GMod (npc.rs no los dibuja)
('self.npcs.items(&mut items); self.red_items(&mut items);', 'self.npcs.items(&mut items); self.gmp_items_npcs(&mut items, cam, dt); self.red_items(&mut items);'),
# los Pill Packs (gmod_pill.rs): transformado, los botones de disparo, el secundario y recargar son sus habilidades (no el
# arma) y la cámara de tercera persona va a la distancia del personaje
('                Boton::Disparo | Boton::Disparo2 | Boton::Recargar if self.gmod_arma_activa() => {}\n',
 '                Boton::Disparo | Boton::Disparo2 | Boton::Recargar if self.gmod_arma_activa() || self.pill_on() => {}\n'),
('            let (cam, mira) = if let Some(c) = cam_veh { c } else { match self.camara {\n                1 => {\n',
 '            let (cam, mira) = if let Some(c) = cam_veh { c } else { match self.camara {\n                1 if self.pill_camara(&mp.mundo, ojos, fw).is_some() => self.pill_camara(&mp.mundo, ojos, fw).unwrap(),\n                1 => {\n'),
]

def aplicar(ruta, cambios):
    s = open(ruta, encoding='utf-8').read(); mal = []
    for a, b in cambios:
        n = s.count(a)
        if n != 1: mal.append('%s: %d veces: %s' % (os.path.basename(ruta), n, a[:90].replace('\n', '⏎')))
        else: s = s.replace(a, b)
    return s, mal

nuevos, errores = {}, []
for nombre, cambios in (('comun.rs', COMUN),):
    ruta = os.path.join(src, nombre); s, mal = aplicar(ruta, cambios); nuevos[ruta] = s; errores += mal
if errores:
    print('NO SE APLICÓ NADA:'); [print('  ' + e) for e in errores]; sys.exit(1)
for ruta, s in nuevos.items(): open(ruta, 'w', encoding='utf-8').write(s)
print('listo: %d cambios en comun.rs' % len(COMUN))
