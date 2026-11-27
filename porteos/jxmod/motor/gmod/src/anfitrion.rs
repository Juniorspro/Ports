//! El puente con el juego: lo que la capa GMod le pide (crear y borrar objetos, sonidos, efectos, daño, trazas, la HUD...)
//! y el estado que comparten (el jugador, la cámara, lo que se aprieta, las armas, los cuerpos de los objetos).
//!
//! Todo va en unidades del juego (metros, Y arriba); jxgmod pasa a las de Source (pulgadas, Z arriba) para el Lua.
//! El estado compartido (`Jugador`, `Camara`, `Entrada`, `Armas`, `Cuerpo`) es como los objetos JUG, CAM, ENT y ARM de la
//! web: el juego lo copia antes de cada cuadro de jxgmod y aplica lo que el Lua cambió después.

use crate::mates::{Quat, V3};

/// un objeto del juego con cuerpo físico (un prop, la entidad de un addon con modelo)
pub type ObjId = u32;
/// una persona del juego (un NPC)
pub type PersonaId = u32;

/// el jugador (JUG de la web). `pos` es el centro de la cápsula: los pies están `medio + radio` más abajo.
#[derive(Clone, Debug)]
pub struct Jugador {
    pub pos: V3,
    pub vel: V3,
    pub vivo: bool,
    pub vida: f64,
    /// a dónde mira (radianes, alrededor de Y; 0 = +Z)
    pub yaw: f64,
    pub pitch: f64,
    pub medio: f64,
    pub radio: f64,
    pub ojo_alto: f64,
    pub suelo: bool,
    pub agachado: bool,
    pub noclip: bool,
    /// el vehículo en el que va (None: a pie)
    pub vehiculo: Option<ObjId>,
    /// en tercera persona (los ojos del personaje no son la cámara)
    pub tercera: bool,
    pub ojo_pos: Option<V3>,
    pub congelado: bool,
    pub bloqueado: bool,
    /// la velocidad de caminar (m/s) y la fuerza del salto, como las pone el Lua (SetWalkSpeed, SetJumpPower)
    pub vel_max: f64,
    pub salto: f64,
    /// primera persona en un vehículo
    pub fp_veh: bool,
    pub tiempo_suelo: f64,
    pub salto_t: f64,
    pub reloj: f64,
}

impl Default for Jugador {
    fn default() -> Jugador {
        Jugador {
            pos: V3 { x: 0.0, y: 0.95, z: 0.0 }, vel: V3::default(), vivo: true, vida: 100.0, yaw: 0.0, pitch: 0.0, medio: 0.5, radio: 0.45,
            ojo_alto: 1.7, suelo: true, agachado: false, noclip: false, vehiculo: None, tercera: false, ojo_pos: None, congelado: false,
            bloqueado: false, vel_max: 6.0, salto: 1.1, fp_veh: false, tiempo_suelo: 0.0, salto_t: 0.0, reloj: 0.0,
        }
    }
}

/// la cámara (CAM de la web)
#[derive(Clone, Debug)]
pub struct Camara {
    pub pos: V3,
    /// adelante, a la derecha y arriba (normalizados)
    pub fwd: V3,
    pub der: V3,
    pub arr: V3,
    pub q: Quat,
    pub fov: f64,
    /// el temblor que pide el Lua (ViewPunch, util.ScreenShake): 0..1
    pub temblor: f64,
    /// dónde está de verdad la cámara con que se dibuja (en tercera persona, atrás del personaje; `pos` son los ojos): las
    /// tiras y los sprites miran hacia acá
    pub vista: Option<V3>,
}

impl Default for Camara {
    fn default() -> Camara {
        Camara { pos: V3 { x: 0.0, y: 1.6, z: 0.0 }, fwd: V3 { x: 0.0, y: 0.0, z: 1.0 }, der: V3 { x: -1.0, y: 0.0, z: 0.0 }, arr: V3 { x: 0.0, y: 1.0, z: 0.0 }, q: Quat::default(), fov: 75.0, temblor: 0.0, vista: None }
    }
}

/// lo que se aprieta en este cuadro (ENT y CTL de la web)
#[derive(Clone, Debug, Default)]
pub struct Entrada {
    /// el ataque primario y el secundario
    pub disparo: bool,
    pub disparo2: bool,
    /// las teclas apretadas, con los códigos de KeyboardEvent.code ("KeyR", "Space", "ShiftLeft", "Digit1"...)
    pub teclas: Vec<String>,
    pub correr: bool,
    /// corre con la palanca táctil al tope (no aprieta IN_SPEED)
    pub correr_palanca: bool,
    pub saltar: bool,
    pub agachar: bool,
    /// la palanca de caminar: x a la derecha, y adelante (-1..1)
    pub x: f64,
    pub y: f64,
    /// las teclas que aprietan los botones de los mods en la pantalla
    pub teclas_mod: Vec<String>,
    /// un botón del mouse de GMod apretado (MOUSE_*: 107..113) o 0
    pub raton: u32,
    /// bits IN_* que aprietan los botones de los mods
    pub in_mod: u32,
    /// hay un menú del juego abierto (no llegan teclas ni disparos)
    pub ui_abierto: bool,
}

impl Entrada {
    pub fn tiene(&self, c: &str) -> bool { self.teclas.iter().any(|t| t == c) }
}

/// el inventario de armas del juego (ARM de la web): los nombres son los del juego ("Pistol", "Hands"...) y las de los
/// addons, "gm:<clase>"
#[derive(Clone, Debug, Default)]
pub struct Armas {
    pub lista: Vec<String>,
    pub i: usize,
}

impl Armas {
    pub fn actual(&self) -> Option<&str> { self.lista.get(self.i).map(|s| s.as_str()) }
}

/// el cuerpo físico de un objeto (o.b de la web). Lo que el Lua cambia queda acá; el juego lo aplica a su física
/// (`cambios` dice qué se tocó: los bits CUERPO_*)
#[derive(Clone, Debug)]
pub struct Cuerpo {
    pub pos: V3,
    pub q: Quat,
    pub vel: V3,
    /// la velocidad angular (rad/s)
    pub ang: V3,
    pub masa: f64,
    pub congelado: bool,
    pub dormido: bool,
    pub sin_grav: bool,
    pub dinamico: bool,
    /// la caja en el mundo (mínimo, máximo)
    pub aabb: [V3; 2],
    /// del origen del modelo al centro del cuerpo (GetPos da el origen)
    pub c: Option<V3>,
    pub oculto: bool,
    /// es un vehículo del juego
    pub veh: bool,
    /// lo que no choca: con el jugador, con la física, con las trazas
    pub no_jug: bool,
    pub no_phys: bool,
    pub no_ray: bool,
    pub cambios: u32,
}

pub const CUERPO_POS: u32 = 1;
pub const CUERPO_Q: u32 = 2;
pub const CUERPO_VEL: u32 = 4;
pub const CUERPO_ANG: u32 = 8;
pub const CUERPO_MASA: u32 = 16;
pub const CUERPO_CONGELADO: u32 = 32;
pub const CUERPO_DESPERTAR: u32 = 64;
pub const CUERPO_OTROS: u32 = 128;

impl Cuerpo {
    pub fn nuevo(pos: V3, q: Quat) -> Cuerpo {
        let h = V3 { x: 0.25, y: 0.25, z: 0.25 };
        Cuerpo { pos, q, vel: V3::default(), ang: V3::default(), masa: 10.0, congelado: false, dormido: false, sin_grav: false, dinamico: true, aabb: [pos.sub(h), pos.add(h)], c: None, oculto: false, veh: false, no_jug: false, no_phys: false, no_ray: false, cambios: 0 }
    }
    pub fn despertar(&mut self) { self.cambios |= CUERPO_DESPERTAR; }
}

/// el prefab con que el juego dibuja un modelo de Source
#[derive(Clone, Debug)]
pub struct Prefab {
    pub nombre: String,
    /// el modelo no está y se usa otra cosa (una caja)
    pub sustituto: bool,
}

/// lo que tocó una traza
#[derive(Clone, Debug)]
pub struct Golpe {
    /// la distancia desde el origen
    pub t: f64,
    pub p: V3,
    /// la normal de la superficie
    pub n: V3,
    /// el objeto o la persona que tocó (ninguno: el mundo)
    pub obj: Option<ObjId>,
    pub persona: Option<PersonaId>,
}

/// un color de la HUD: r, g, b (0..255, enteros) y alfa (0..1)
pub type Rgba = [f64; 4];

/// una orden de dibujo 2D de la HUD (las de un lienzo: el juego las dibuja en orden encima de la imagen)
#[derive(Clone, Debug, PartialEq)]
pub enum Cmd2D {
    Guardar,
    Restaurar,
    Mover(f64, f64),
    Rotar(f64),
    /// un rectángulo lleno (con el alfa global)
    Rect { x: f64, y: f64, w: f64, h: f64, color: Rgba, alfa: f64 },
    /// el borde de un rectángulo
    Borde { x: f64, y: f64, w: f64, h: f64, color: Rgba, ancho: f64 },
    /// un texto (fuente CSS: "normal 13px \"Tahoma\", Tahoma, sans-serif"; base: "top" o "alphabetic")
    Texto { s: String, x: f64, y: f64, fuente: String, color: Rgba, base: String },
    TextoBorde { s: String, x: f64, y: f64, fuente: String, color: Rgba, ancho: f64 },
    /// un camino: empezar, ir, línea, curva cuadrática, arco (círculo entero), cerrar, llenar, trazar
    Camino,
    Ir(f64, f64),
    Linea(f64, f64),
    Curva(f64, f64, f64, f64),
    Arco(f64, f64, f64),
    Cerrar,
    Llenar(Rgba),
    Trazar(Rgba, f64),
    /// una imagen (un material cargado) en un rectángulo, con su recorte (u0, v0, u1, v1) en píxeles de la imagen
    Imagen { material: String, x: f64, y: f64, w: f64, h: f64, recorte: [f64; 4], alfa: f64 },
    /// lo que se dibuja después queda dentro de este rectángulo (en la pantalla, sin mover) hasta el próximo Restaurar
    Recorte { x: f64, y: f64, w: f64, h: f64 },
}

/// lo que el juego sabe de un material (para la HUD)
#[derive(Clone, Debug, Default)]
pub struct InfoMaterial {
    /// existe en algún lado (IsError es lo contrario)
    pub existe: bool,
    /// ya tiene la imagen cargada (si no, se dibuja un rectángulo del color)
    pub cargado: bool,
    pub ancho: f64,
    pub alto: f64,
    /// no hay nada que mostrar (una refracción): no se dibuja
    pub nada: bool,
}

/// el juego, visto desde la capa GMod
pub trait Anfitrion {
    // ---- tiempo y pantalla ----
    /// el tiempo del juego (CurTime) y el del cuadro
    fn tiempo(&self) -> f64;
    fn dt(&self) -> f64;
    /// el reloj real: (milisegundos desde 1970, segundos desde que arrancó) para os.time, os.clock, SysTime, RealTime
    fn reloj(&self) -> (f64, f64);
    /// el tamaño de la pantalla en puntos (ScrW, ScrH)
    fn pantalla(&self) -> (f64, f64) { (1280.0, 720.0) }
    /// el nombre del jugador (Nick)
    fn nombre_jugador(&self) -> String { "Player".into() }
    /// el mapa (game.GetMap) y sus puntos de aparición (posición y, si tiene, hacia dónde mira)
    fn nombre_mapa(&self) -> String { "gm_flatgrass".into() }
    fn apariciones(&self) -> Vec<(V3, Option<f64>)> { Vec::new() }

    // ---- estado compartido ----
    fn jug(&mut self) -> &mut Jugador;
    /// los huesos del jugador como los dibuja el juego, con su nombre de GMod («ValveBiped.Bip01_R_Hand»...): el lugar
    /// (en el juego) y los ejes de Source del hueso —adelante, izquierda, arriba— en direcciones del juego
    fn huesos_jugador(&mut self) -> Vec<(String, V3, [V3; 3])> { Vec::new() }
    /// dónde va el modelo de mundo del arma en la mano (en el juego: el lugar y el giro), si el juego lo sabe
    fn arma_mundo(&mut self) -> Option<(V3, Quat)> { None }
    fn cam(&mut self) -> &mut Camara;
    fn entrada(&mut self) -> &mut Entrada;
    fn armas(&mut self) -> &mut Armas;

    // ---- armas ----
    /// ¿el juego tiene esa arma? ("Pistol", "Hands", "gm:<clase>"...)
    fn arma_definida(&self, nombre: &str) -> bool;
    /// un arma de un addon pasa a ser un arma del juego ("gm:<clase>"), con la vista y el ícono de `base` (un arma del juego)
    fn registrar_arma(&mut self, nombre: &str, base: Option<&str>, impreso: &str);
    /// dar un arma y ponerla en la mano (si ya la tiene, sólo elegirla)
    fn dar_arma(&mut self, nombre: &str);
    /// poner en la mano la i-ésima del inventario (sin dársela)
    fn elegir_arma(&mut self, i: usize);
    /// poner en la mano la que se llama así, sin el ruido de sacarla
    fn elegir_arma_callado(&mut self, nombre: &str);

    // ---- objetos ----
    /// el prefab del juego para un modelo de Source ("models/x.mdl"): `en_addon` si el archivo viene en un addon
    /// (None: no hay cómo dibujarlo y la entidad queda sin cuerpo)
    fn prefab(&mut self, modelo: &str, en_addon: bool) -> Option<Prefab>;
    /// se puso una entidad cuyo modelo no está (se ve con un sustituto)
    fn modelo_falta(&mut self, modelo: &str) { let b = modelo.rsplit('/').next().unwrap_or(modelo).to_string(); self.aviso(&format!("Falta el modelo {}", b), 4.0); }
    /// la caja del modelo de un prefab, en el juego: (mínimo, tamaño)
    fn caja_prefab(&self, _prefab: &str) -> Option<([f64; 3], [f64; 3])> { None }
    fn crear_objeto(&mut self, prefab: &str, pos: V3, q: Quat) -> Option<ObjId>;
    fn borrar_objeto(&mut self, o: ObjId);
    /// el cuerpo de un objeto vivo
    fn cuerpo(&mut self, o: ObjId) -> Option<&mut Cuerpo>;
    /// todos los objetos del mundo (para ents.GetAll: los del mapa y los del juego también son entidades)
    fn objetos(&self) -> Vec<ObjId>;
    /// subirse a un objeto que es un vehículo (o un asiento)
    fn subir_vehiculo(&mut self, _o: ObjId) {}

    // ---- el mundo ----
    /// una traza desde `o` en la dirección `d` (normalizada) hasta `max` metros, sin tocar los cuerpos de `ignorar`
    fn raycast(&mut self, o: V3, d: V3, max: f64, ignorar: &[ObjId]) -> Option<Golpe>;
    /// dónde cae un punto del mundo en la pantalla (x, y, delante de la cámara)
    fn a_pantalla(&self, _p: V3) -> Option<(f64, f64, bool)> { None }

    // ---- sonidos ----
    /// un sonido suelto (ruta de Source ya resuelta), en un lugar o en la cabeza; vol 0.05..2, tono 0.3..2.5 (1 normal)
    fn sonido(&mut self, ruta: &str, pos: Option<V3>, vol: f64, tono: f64);
    /// Entity:EmitSound (con los guiones de sonido de GMod, los bucles y los canales: gmod_sonidos.js en la web)
    fn emitir_sonido(&mut self, ent: Option<f64>, s: &str, nivel: Option<f64>, tono: Option<f64>, vol: Option<f64>, canal: Option<f64>);
    fn parar_sonido(&mut self, ent: Option<f64>, s: &str);
    /// un CSoundPatch (CreateSound) que se prende o se apaga
    fn parche_sonido(&mut self, id: u32, ent: Option<f64>, s: &str, prender: bool, vol: Option<f64>, tono: Option<f64>, fundido: Option<f64>);

    // ---- daño ----
    fn danar_jugador(&mut self, dano: f64);
    fn danar_objeto(&mut self, o: ObjId, dano: f64, pos: V3, dir: V3);
    fn danar_persona(&mut self, p: PersonaId, dano: f64, pos: V3, dir: V3);
    fn matar_jugador(&mut self);
    /// una explosión del juego (empuja, daña y, si no `sin_fx`, se ve y se oye)
    fn explosion(&mut self, pos: V3, radio: f64, magnitud: f64, sin_fx: bool);

    // ---- efectos ----
    fn efecto_impacto(&mut self, pos: V3, normal: V3, cuerpo: bool);
    fn efecto_explosion(&mut self, pos: V3);
    fn efecto_traza(&mut self, desde: V3, hasta: V3);
    fn efecto_fogonazo(&mut self);
    /// una partícula: tipo "chispa", "fuego", "humo" o "gota"; crece: cuánto cambia el tamaño en su vida (None: lo normal)
    fn particula(&mut self, pos: V3, vel: V3, vida: f64, tam: f64, color: [f64; 4], tipo: &str, crece: Option<f64>);
    /// la cámara tiembla (0..1)
    fn sacudir(&mut self, fuerza: f64);
    /// un efecto de Lua de un addon (lua/effects): lo arma y lo dibuja el que dibuja (gmod_render.js en la web)
    fn efecto_lua(&mut self, _nombre: &str) {}
    /// ENT:DrawModel de una entidad
    fn dibujar_modelo(&mut self, _ent: f64) {}
    fn linterna(&mut self, _prender: bool) {}
    /// SendWeaponAnim del arma en la mano: "fuego", "fuego2", "recarga", "sacar" o "quieto" (la vista del juego lo toca)
    fn animar_vista(&mut self, _clip: &str) {}

    // ---- mensajes ----
    fn chat(&mut self, s: &str);
    fn aviso(&mut self, s: &str, segundos: f64);
    /// lo que imprime el Lua (print, Msg) y sus errores
    fn consola(&mut self, _s: &str) {}
    fn error_lua(&mut self, _s: &str) {}

    // ---- la HUD ----
    fn dibujar_2d(&mut self, c: Cmd2D);
    /// el ancho de un texto con una fuente CSS
    fn ancho_texto(&mut self, fuente: &str, s: &str) -> f64;
    fn material(&mut self, _ruta: &str) -> InfoMaterial { InfoMaterial::default() }

    // ---- archivos y datos guardados ----
    /// un archivo del contenido base (GMod/HL2) que no viene en los addons
    fn archivo(&mut self, _ruta: &str) -> Option<Vec<u8>> { None }
    fn existe(&mut self, _ruta: &str) -> bool { false }
    /// lo que guarda el Lua para la próxima vez (file.Write en data/, PData, cookies)
    fn dato(&mut self, _clave: &str) -> Option<String> { None }
    fn poner_dato(&mut self, _clave: &str, _valor: Option<&str>) {}

    /// para llegar al tipo de verdad del anfitrión (las pruebas)
    fn como_any(&mut self) -> Option<&mut dyn std::any::Any> { None }
}
