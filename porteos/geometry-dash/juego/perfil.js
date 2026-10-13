// El perfil del jugador (GameManager / GameStatsManager): íconos, colores, opciones, progreso de
// los niveles, estrellas, monedas y estadísticas. Todo en el almacenamiento del navegador.
'use strict';
// colores del jugador (GameManager::colorForIdx)
GD.COLORES = [[125, 255, 0], [0, 255, 0], [0, 255, 125], [0, 255, 255], [0, 125, 255], [0, 0, 255], [125, 0, 255], [255, 0, 255], [255, 0, 125], [255, 0, 0],
  [255, 125, 0], [255, 255, 0], [255, 255, 255], [185, 0, 255], [255, 185, 0], [0, 0, 0], [0, 200, 255], [175, 175, 175], [90, 90, 90], [255, 125, 125],
  [0, 175, 75], [0, 125, 125], [0, 75, 175], [75, 0, 175], [125, 0, 125], [175, 0, 75], [175, 75, 0], [125, 125, 0], [75, 175, 0], [255, 75, 0],
  [150, 50, 0], [150, 100, 0], [100, 150, 0], [0, 150, 100], [0, 100, 150], [100, 0, 150], [150, 0, 100], [150, 0, 0], [0, 150, 0], [0, 0, 150],
  [125, 255, 175], [125, 125, 255], [255, 250, 127], [250, 127, 255], [0, 255, 192], [80, 50, 14], [205, 165, 118], [184, 127, 61], [255, 223, 157], [64, 48, 33],
  [255, 0, 75], [255, 75, 75], [255, 185, 150], [0, 65, 30], [0, 85, 60], [100, 255, 100], [140, 255, 200], [220, 140, 255], [255, 210, 120], [255, 100, 0],
  [200, 255, 0], [255, 160, 220], [180, 255, 120], [0, 255, 100], [60, 0, 120], [125, 0, 60], [0, 60, 60], [80, 80, 160], [40, 40, 40], [210, 210, 210]];
const DEF = {
  cubo: 1, nave: 1, bola: 1, ovni: 1, onda: 1, robot: 1, arana: 1, columpio: 1, jetpack: 1, c1: 0, c2: 3, cGlow: 3, brillo: false, estela: 1, muerte: 1, modoIcono: 'cubo',
  nombre: 'Player', vMus: 1, vSfx: 1, progreso: {}, estrellas: 0, lunas: 0, diamantes: 0, orbes: 0, monedas: {}, stats: {}, opciones: {},
  dualDividido: false, cuentaNiveles: 0, completados: {}, desbloqueos: {},
};
const P = GD.perfil = Object.assign({}, DEF, GD.G.leer('perfil', {}));
for (const k in DEF) if (P[k] === undefined) P[k] = JSON.parse(JSON.stringify(DEF[k]));
P.guardar = () => { const o = {}; for (const k in DEF) o[k] = P[k]; GD.G.escribir('perfil', o); };
P.c1rgb = () => GD.COLORES[P.c1] || GD.COLORES[0];
P.c2rgb = () => GD.COLORES[P.c2] || GD.COLORES[3];
P.cGlowrgb = () => GD.COLORES[P.cGlow] || P.c2rgb();
P.sumar = (k, n) => { P.stats[k] = (P.stats[k] || 0) + n; P.guardar(); };
P.opcion = (k, def = false) => P.opciones[k] === undefined ? def : P.opciones[k];
// progreso de un nivel: {normal: %, practica: %, intentos, saltos, monedas: [..], hecho}
P.nivel = id => P.progreso[id] || (P.progreso[id] = { normal: 0, practica: 0, intentos: 0, saltos: 0, monedas: [], hecho: false });
