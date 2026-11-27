//! Lo que manda el juego (juego/gmod_personal.js):
//!  - recursos (JXE1: 'JXE1', u32 con el largo del JSON, el JSON y los datos): mallas como están en el paquete del juego
//!    —14 bytes por vértice: posición u16×3 normalizada dentro de la caja `mn`..`mn + sc`, normal i8×4 (su 4.º byte es el
//!    peso de la mezcla de dos texturas), UV en media precisión—, la UV de la luz horneada (u16×2) y los huesos (4 índices
//!    u8 y 4 pesos u8) en otros bloques; materiales, texturas, luces horneadas y el agua de HL2. Cada cosa con su número del
//!    juego (`id`), así se mandan sólo las nuevas;
//!  - el cuadro (`Cuadro::leer`): cámara, luz y lo que se dibuja (malla, parte, material, matriz y, si tiene, sus huesos).
use serde::Deserialize;

fn menos1() -> i64 { -1 }
/// (rugosidad, metal y reflejo de frente: lo de pbrDe en gl.js para lo que no se reconoce)
fn pbr0() -> [f32; 3] { [0.72, 0.0, 0.04] }

#[derive(Deserialize, Debug, Clone)]
pub struct Malla { #[serde(default = "menos1")] pub id: i64, pub v: u32, pub mn: [f32; 3], pub sc: [f32; 3], pub i32: u8, pub ni: u32, pub vo: usize, pub io: usize, pub lo: i64, #[serde(default = "menos1")] pub so: i64, pub lm: i64 }
#[derive(Deserialize, Debug, Clone)]
pub struct Mat { #[serde(default = "pbr0")] pub pbr: [f32; 3], #[serde(default)] pub fol: u8, #[serde(default = "menos1")] pub id: i64, #[serde(default = "menos1")] pub t2: i64, #[serde(default)] pub terr: Option<Vec<(i64, f32, f32)>>, pub c: [f32; 4], pub st: [f32; 4], pub t: i64, pub blend: u8, pub cut: u8, pub unlit: u8, pub add: u8, pub agua: u8, pub em: [f32; 3],
    /// la pintura (dos tonos: cuerpo, acentos y brillo de los acentos; ceros: sin pintura)
    #[serde(default)] pub ti: [f32; 12] }
#[derive(Deserialize, Debug, Clone)]
pub struct Tex { #[serde(default = "menos1")] pub id: i64, #[serde(default)] pub n: String, pub w: u32, pub h: u32, #[serde(default)] pub a: u8, pub o: usize }
#[derive(Deserialize, Debug, Clone)]
pub struct Lm { #[serde(default = "menos1")] pub id: i64, pub w: u32, pub h: u32, pub o: usize }
#[derive(Deserialize, Debug, Clone)]
pub struct Item { pub m: i64, pub s0: u32, pub sn: u32, pub mat: i64, #[serde(rename = "M")] pub mm: [f32; 16], #[serde(default)] pub est: u8 }
#[derive(Deserialize, Debug, Clone)]
pub struct Cam { pub vp: [f32; 16], pub pos: [f32; 3] }
#[derive(Deserialize, Debug, Clone, Copy, Default)]
pub struct Niebla { pub c: [f32; 3], pub a: f32, pub b: f32, #[serde(default)] pub m: f32, #[serde(default)] pub s: [f32; 3] }
#[derive(Deserialize, Debug, Clone, Copy, Default)]
pub struct Luz { pub sol: [f32; 3], #[serde(rename = "solC")] pub sol_c: [f32; 3], #[serde(rename = "ambS")] pub amb_s: [f32; 3], #[serde(rename = "ambG")] pub amb_g: [f32; 3], pub nie: Niebla, pub expo: f32 }
#[derive(Deserialize, Debug, Clone)]
pub struct TexAgua { pub w: u32, pub h: u32, pub o: usize, /** los cuadros de la animación, uno abajo del otro (0 o 1: quieto) */ #[serde(default)] pub n: u32 }
#[derive(Deserialize, Debug, Clone)]
pub struct Prof { pub x0: f32, pub z0: f32, pub w: f32, pub h: f32, #[serde(rename = "D")] pub d: f32, pub tex: Option<TexAgua> }
#[derive(Deserialize, Debug, Clone)]
pub struct Agua { pub fog: [f32; 4], pub esc: f32, pub fuerza: f32, pub dist: f32, #[serde(default = "medio")] pub refr: f32, pub s: [f32; 4], pub largo: f32, pub normal: Option<TexAgua>, pub prof: Option<Prof>, #[serde(default)] pub y: f32,
    /// 1: el agua de Source tal cual su material (el mapa de normales de Valve, $refracttint, $reflecttint, la niebla hasta $fogend);
    /// los tintes del fondo y del reflejo
    #[serde(default)] pub fuente: u8, #[serde(default = "blanco3")] pub t_refr: [f32; 3], #[serde(default = "blanco3")] pub t_refl: [f32; 3] }
fn blanco3() -> [f32; 3] { [1.0; 3] }
/// el cielo: el degradé del mapa (colores en gamma) y, si tiene, la caja de seis caras (L×L RGBA cada una) con su tinte
/// y cuánto se ve (de noche, el degradé)
#[derive(Deserialize, Debug, Clone)]
pub struct Caras { pub l: u32, pub o: Vec<usize> }
#[derive(Deserialize, Debug, Clone)]
pub struct Cielo { pub top: [f32; 3], pub mid: [f32; 3], pub bot: [f32; 3], pub exp: [f32; 2], #[serde(default = "uno3")] pub tinte: [f32; 3], #[serde(default)] pub dia: f32, #[serde(default = "uno")] pub k: f32, #[serde(default)] pub cubo: u8, pub caras: Option<Caras> }
fn uno() -> f32 { 1.0 }
fn medio() -> f32 { 0.5 }
fn uno3() -> [f32; 3] { [1.0; 3] }
#[derive(Deserialize, Debug, Clone)]
pub struct Cabecera {
    #[serde(default)] pub mapa: String, #[serde(default)] pub w: u32, #[serde(default)] pub h: u32,
    pub cam: Option<Cam>, pub luz: Option<Luz>,
    #[serde(default)] pub mallas: Vec<Malla>, #[serde(default)] pub mats: Vec<Mat>, #[serde(default)] pub texs: Vec<Tex>, #[serde(default)] pub lms: Vec<Lm>,
    #[serde(default)] pub items: Vec<Item>, pub agua: Option<Agua>, pub cielo: Option<Cielo>,
}

pub struct Escena { pub c: Cabecera, pub datos: Vec<u8> }

impl Escena {
    pub fn leer(b: &[u8]) -> Result<Escena, String> {
        if b.len() < 8 || &b[0..4] != b"JXE1" { return Err("no es un JXE1".into()); }
        let n = u32::from_le_bytes([b[4], b[5], b[6], b[7]]) as usize;
        if b.len() < 8 + n { return Err("JXE1 cortado".into()); }
        let mut c: Cabecera = serde_json::from_slice(&b[8..8 + n]).map_err(|e| format!("cabecera: {e}"))?;
        // (sin números del juego —el banco de pruebas—: el lugar en la lista; los negativos que no son -1 son números propios,
        // como el atlas de las partículas)
        for (i, m) in c.mallas.iter_mut().enumerate() { if m.id == -1 { m.id = i as i64; } }
        for (i, m) in c.mats.iter_mut().enumerate() { if m.id == -1 { m.id = i as i64; } }
        for (i, m) in c.texs.iter_mut().enumerate() { if m.id == -1 { m.id = i as i64; } }
        for (i, m) in c.lms.iter_mut().enumerate() { if m.id == -1 { m.id = i as i64; } }
        Ok(Escena { c, datos: b[8 + n..].to_vec() })
    }
    pub fn bloque(&self, o: usize, n: usize) -> &[u8] { &self.datos[o..o + n] }
    /// el cuadro guardado en la escena (el banco de pruebas: una foto del juego)
    pub fn cuadro(&self) -> Option<Cuadro> {
        let cam = self.c.cam.as_ref()?;
        Some(Cuadro { vp: cam.vp, pos: cam.pos, luz: self.c.luz.unwrap_or_default(), agua_y: self.c.agua.as_ref().map(|a| a.y), suelo_y: None, tiempo: 0.0, luces: vec![], esp: vec![], efectos: vec![],
            items: self.c.items.iter().map(|it| ItemDin { m: it.m, s0: it.s0, sn: it.sn, mat: it.mat, mm: it.mm, esf: [0.0, 0.0, 0.0, -1.0], fl: 0, h: Vec::new() }).collect() })
    }
}

/// una cosa a dibujar en el cuadro: malla, parte (primer índice y cuántos), material, matriz, su esfera en el mundo (radio
/// negativo: sin esfera, siempre se dibuja), banderas (1: no hace sombra) y los huesos (3 filas vec4 por hueso)
#[derive(Clone, Debug)]
pub struct ItemDin { pub m: i64, pub s0: u32, pub sn: u32, pub mat: i64, pub mm: [f32; 16], pub esf: [f32; 4], pub fl: u32, pub h: Vec<f32> }
pub const FL_SIN_SOMBRA: u32 = 1;
/// la maqueta del cielo 3D de los mapas del Workshop (cielo3d.js): se dibuja primero, detrás de todo, y después se borra la
/// profundidad (el mapa queda siempre adelante aunque la maqueta agrandada se meta en él)
pub const FL_CIELO: u32 = 2;
/// el arma y las manos en primera persona (pegadas a la cámara): OpenGL 3 las dibuja en una franja propia de la profundidad
/// (de 0 a 0,01: no se meten en las paredes) y OpenGL 2 con una marca en el alfa; así JX Turbo las corre con su propio movimiento
pub const FL_ARMA: u32 = 4;
/// luces del cuadro: posición y radio, color, dirección y coseno del cono (-2: sin cono)
pub type LuzP = [f32; 12];
#[derive(Clone, Debug)]
/// (suelo_y: la altura del piso que hay debajo de la cámara —el reflejo del piso de OpenGL 2—)
pub struct Cuadro { pub vp: [f32; 16], pub pos: [f32; 3], pub luz: Luz, pub agua_y: Option<f32>, pub suelo_y: Option<f32>, pub tiempo: f32, pub luces: Vec<LuzP>, pub esp: Vec<LuzP>, pub items: Vec<ItemDin>, pub efectos: Vec<(u32, Vec<f32>)> }
/// los bloques de efectos que van después de las cosas: tipo, cuántos floats y los floats
pub const EF_PART_ALFA: u32 = 1; pub const EF_PART_SUMA: u32 = 2; pub const EF_MARCAS: u32 = 3;
/// el hongo con volumen de una nuclear (jxjuego::nucleares::Explosion::nv_bloque, 28 números): hongo.rs
pub const EF_HONGO: u32 = 4;
/// el agua del cuadro: [bajo el agua (0/1), 0, 0, 0] y hasta 8 ondas [x, z, cuándo, fuerza] (las que dejan el jugador y lo que cae)
pub const EF_ONDAS: u32 = 5;
/// la luz global de Definitivo (nativo/luz_global.rs): [origen x, y, z, paso, nx, ny, nz, versión] cada cuadro y, cuando
/// cambia, sus datos (EF_GI_DATOS: RGBA por sonda, de 0 a 255)
pub const EF_GI: u32 = 6; pub const EF_GI_DATOS: u32 = 7;
/// el agua de partículas (jxjuego::fluido): [radio, cuántas, 0, 0, derecha de la cámara (3), 0, arriba (3), 0, color del
/// agua (rgba), color del cielo que refleja (rgb) y cuánto refleja, sol (dirección) y brillo] y por partícula [x, y, z,
/// espuma, nx, ny, nz, cuánto es superficie] (`FLU_POR` números), de lejos a cerca. Se dibujan como esferas (con su profundidad en OpenGL 3) mezcladas: donde hay más, más honda
pub const EF_FLUIDO: u32 = 8;
/// las olas simuladas del agua (jxjuego::olas): [x0, z0, lado, N, y, 0, 0, 0] y por celda la pendiente en x y en z (N × N)
pub const EF_OLAS: u32 = 9;
/// (los números de la cabecera del bloque de agua de partículas)
pub const FLU_CAB: usize = 24;
/// (los números de cada partícula)
pub const FLU_POR: usize = 8;

pub const CAB_CUADRO: usize = 47;
pub const POR_ITEM: usize = 26;

impl Cuadro {
    /// el cuadro del juego (floats en little endian): 'JXC1' (sus bits), n, vp(16), pos(3), sol(3), solC(3), ambS(3), ambG(3),
    /// nieC(3), nieA, nieB, expo, aguaY (NaN = sin agua), tiempo, luces puntuales, luces especiales, cuánto tapa la niebla
    /// como máximo, el color del sol en la niebla(3) —la luz en lineal, como la usa WebGL—; 12 floats por luz; y por
    /// cosa: malla, desde, cuántos, material, matriz(16), esfera(4), banderas, cuántos floats de huesos (negativo: los de
    /// otra cosa anterior, la -n-1) y los huesos
    pub fn leer(b: &[u8]) -> Result<Cuadro, String> {
        if b.len() % 4 != 0 || b.len() < 4 * CAB_CUADRO { return Err("cuadro cortado".into()); }
        let f: Vec<f32> = b.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
        Cuadro::de_floats(&f)
    }
    pub fn de_floats(f: &[f32]) -> Result<Cuadro, String> { Cuadro::de_floats_con(f, &mut Vec::new()) }
    /// lo mismo con la tabla de lugares del motor (los cuadros JXC2: cada cosa tiene un lugar fijo y sólo llega lo que cambió)
    pub fn leer_con(b: &[u8], ranuras: &mut Vec<Option<ItemDin>>) -> Result<Cuadro, String> {
        if b.len() % 4 != 0 || b.len() < 4 * CAB_CUADRO { return Err("cuadro cortado".into()); }
        let f: Vec<f32> = b.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
        Cuadro::de_floats_con(&f, ranuras)
    }
    /// JXC2 (después de las luces): cuántas cambiaron y cada una [lugar, malla, desde, cuántos, material, matriz(16),
    /// esfera(4), banderas]; cuántas se ven y sus lugares; cuántas con huesos y cada una [lugar, n, n floats] (n negativo:
    /// los huesos del lugar -n-1, ya mandados en este cuadro); y los efectos
    pub fn de_floats_con(f: &[f32], ranuras: &mut Vec<Option<ItemDin>>) -> Result<Cuadro, String> {
        let dos = f.len() >= CAB_CUADRO && f[0].to_bits() == u32::from_le_bytes(*b"JXC2");
        if f.len() < CAB_CUADRO || (!dos && f[0].to_bits() != u32::from_le_bytes(*b"JXC1")) { return Err("no es un cuadro".into()); }
        let n = f[1] as usize; let mut k = 2usize;
        let mut tomar = |m: usize| -> Result<&[f32], String> { if k + m > f.len() { return Err("cuadro cortado".into()); } let s = &f[k..k + m]; k += m; Ok(s) };
        let vp: [f32; 16] = tomar(16)?.try_into().unwrap(); let pos: [f32; 3] = tomar(3)?.try_into().unwrap();
        let v3 = |s: &[f32]| [s[0], s[1], s[2]];
        let sol = v3(tomar(3)?); let sol_c = v3(tomar(3)?); let amb_s = v3(tomar(3)?); let amb_g = v3(tomar(3)?); let nie_c = v3(tomar(3)?);
        let r = tomar(11)?; let (nie_a, nie_b, expo, ay, tiempo, nl, ne) = (r[0], r[1], r[2], r[3], r[4], r[5] as usize, r[6] as usize);
        let luz = Luz { sol, sol_c, amb_s, amb_g, nie: Niebla { c: nie_c, a: nie_a, b: nie_b, m: r[7], s: [r[8], r[9], r[10]] }, expo };
        let mut luces = Vec::with_capacity(nl); for _ in 0..nl.min(16) { luces.push(tomar(12)?.try_into().unwrap()); }
        let mut esp = Vec::with_capacity(ne); for _ in 0..ne.min(16) { esp.push(tomar(12)?.try_into().unwrap()); }
        let mut items = Vec::with_capacity(n);
        if dos {
            let nu = tomar(1)?[0] as usize;
            for _ in 0..nu {
                let c = tomar(26)?; let r = c[0] as usize; if r > 1_000_000 { return Err("lugar fuera de rango".into()); }
                if ranuras.len() <= r { ranuras.resize(r + 1, None); }
                ranuras[r] = Some(ItemDin { m: c[1] as i64, s0: c[2] as u32, sn: c[3] as u32, mat: c[4] as i64, mm: c[5..21].try_into().unwrap(), esf: c[21..25].try_into().unwrap(), fl: c[25] as u32, h: Vec::new() });
            }
            let nv = tomar(1)?[0] as usize; let vis: Vec<usize> = tomar(nv)?.iter().map(|&x| x as usize).collect();
            let mut donde = std::collections::HashMap::with_capacity(nv);
            for r in vis { if let Some(Some(it)) = ranuras.get(r) { donde.insert(r, items.len()); let mut it = it.clone(); it.h.clear(); items.push(it); } }
            let nh = tomar(1)?[0] as usize;
            for _ in 0..nh {
                let c = tomar(2)?; let (r, n) = (c[0] as usize, c[1]);
                let h = if n < 0.0 { let j = (-n - 1.0) as usize; donde.get(&j).map(|&i| items[i].h.clone()).unwrap_or_default() } else { tomar(n as usize)?.to_vec() };
                if let Some(&i) = donde.get(&r) { items[i].h = h; }
            }
        } else { for _ in 0..n {
            let c = tomar(POR_ITEM)?; let mm: [f32; 16] = c[4..20].try_into().unwrap(); let esf: [f32; 4] = c[20..24].try_into().unwrap();
            let (m, s0, sn, mat, fl, nh) = (c[0] as i64, c[1] as u32, c[2] as u32, c[3] as i64, c[24] as u32, c[25]);
            // (huesos: los floats; negativo, los mismos que la cosa número -nh-1 —las partes de un mismo personaje—)
            let h = if nh < 0.0 { let j = (-nh - 1.0) as usize; items.get(j).map(|x: &ItemDin| x.h.clone()).unwrap_or_default() } else { tomar(nh as usize)?.to_vec() };
            items.push(ItemDin { m, s0, sn, mat, mm, esf, fl, h });
        } }
        // (los efectos: partículas —con la derecha y el arriba de la cámara para los carteles— y las marcas de frenada)
        let mut efectos = vec![];
        while let Ok(c) = tomar(2) { let (t, m) = (c[0] as u32, c[1] as usize); let d = tomar(m)?.to_vec(); efectos.push((t, d)); }
        Ok(Cuadro { vp, pos, luz, agua_y: if ay.is_nan() { None } else { Some(ay) }, suelo_y: None, tiempo, luces, esp, items, efectos })
    }
}

#[cfg(test)]
mod prueba {
    use super::*;
    /// JXC2: dos cosas en sus lugares; en el cuadro siguiente sólo cambia una, se ve una sola y la otra trae huesos
    #[test]
    fn lugares_fijos() {
        let cab = |n: f32| { let mut f = vec![0f32; CAB_CUADRO]; f[0] = f32::from_bits(u32::from_le_bytes(*b"JXC2")); f[1] = n; f[39] = f32::NAN; f };
        let cosa = |r: f32, m: f32| { let mut c = vec![0f32; 26]; c[0] = r; c[1] = m; c[3] = 6.0; c[5] = 1.0; c[10] = 1.0; c[15] = 1.0; c[20] = 1.0; c[24] = -1.0; c };
        let mut t = Vec::new();
        let mut f = cab(2.0); f.push(2.0); f.extend(cosa(0.0, 7.0)); f.extend(cosa(3.0, 9.0)); f.extend([2.0, 0.0, 3.0]); f.push(0.0);
        let c = Cuadro::de_floats_con(&f, &mut t).unwrap();
        assert_eq!(c.items.iter().map(|i| i.m).collect::<Vec<_>>(), vec![7, 9]);
        let mut f = cab(1.0); f.push(1.0); f.extend(cosa(3.0, 11.0)); f.extend([1.0, 3.0]); f.extend([1.0, 3.0, 12.0]); f.extend((0..12).map(|i| i as f32));
        let c = Cuadro::de_floats_con(&f, &mut t).unwrap();
        assert_eq!(c.items.len(), 1); assert_eq!(c.items[0].m, 11); assert_eq!(c.items[0].h.len(), 12);
        assert_eq!(t[0].as_ref().unwrap().m, 7);
    }
    /// un cuadro con dos cosas de un mismo personaje: la segunda copia los huesos de la primera
    #[test]
    fn huesos_compartidos() {
        let mut f = vec![0f32; CAB_CUADRO];
        f[0] = f32::from_bits(u32::from_le_bytes(*b"JXC1")); f[1] = 3.0; f[39] = f32::NAN;
        let cosa = |m: f32, nh: f32| { let mut c = vec![0f32; POR_ITEM]; c[0] = m; c[3] = 1.0; c[5] = 1.0; c[23] = 1.0; c[25] = nh; c };
        f.extend(cosa(7.0, 12.0)); f.extend((0..12).map(|i| i as f32));
        f.extend(cosa(8.0, 0.0));
        f.extend(cosa(9.0, -1.0));
        let c = Cuadro::de_floats(&f).unwrap();
        assert_eq!(c.items.len(), 3);
        assert_eq!(c.items[0].h.len(), 12); assert!(c.items[1].h.is_empty()); assert_eq!(c.items[2].h, c.items[0].h);
        assert_eq!(c.items[2].m, 9); assert!(c.agua_y.is_none());
    }
}
