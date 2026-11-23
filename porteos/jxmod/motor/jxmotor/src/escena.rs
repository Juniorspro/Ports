//! La escena que exporta el juego (`jxmCapturar`, juego/gmod_personal.js): «JXE1», u32 con el largo del JSON, el JSON y
//! los datos. Las mallas van como están en el paquete del juego: 14 bytes por vértice (posición u16×3 normalizada dentro
//! de la caja `mn`..`mn + sc`, normal i8×4, UV en media precisión) y, si tienen luz horneada, 4 bytes más por vértice en
//! otro bloque (UV del atlas, u16×2).
use serde::Deserialize;

#[derive(Deserialize, Debug, Clone)]
pub struct Malla { pub v: u32, pub mn: [f32; 3], pub sc: [f32; 3], pub i32: u8, pub ni: u32, pub vo: usize, pub io: usize, pub lo: i64, pub lm: i32 }
#[derive(Deserialize, Debug, Clone)]
pub struct Mat { #[serde(default = "menos1")] pub t2: i32, #[serde(default)] pub terr: Option<Vec<(i32, f32, f32)>>, pub c: [f32; 4], pub st: [f32; 4], pub t: i32, pub blend: u8, pub cut: u8, pub unlit: u8, pub add: u8, pub agua: u8, pub em: [f32; 3] }
#[derive(Deserialize, Debug, Clone)]
pub struct Tex { #[serde(default)] pub n: String, pub w: u32, pub h: u32, #[serde(default)] pub a: u8, pub o: usize }
#[derive(Deserialize, Debug, Clone)]
pub struct Lm { pub w: u32, pub h: u32, pub o: usize }
#[derive(Deserialize, Debug, Clone)]
pub struct Item { pub m: usize, pub s0: u32, pub sn: u32, pub mat: usize, #[serde(rename = "M")] pub mm: [f32; 16], #[serde(default)] pub est: u8 }
#[derive(Deserialize, Debug, Clone)]
pub struct Cam { pub vp: [f32; 16], pub pos: [f32; 3] }
#[derive(Deserialize, Debug, Clone)]
pub struct Niebla { pub c: [f32; 3], pub a: f32, pub b: f32 }
#[derive(Deserialize, Debug, Clone)]
pub struct Luz { pub sol: [f32; 3], #[serde(rename = "solC")] pub sol_c: [f32; 3], #[serde(rename = "ambS")] pub amb_s: [f32; 3], #[serde(rename = "ambG")] pub amb_g: [f32; 3], pub nie: Niebla, pub expo: f32 }
#[derive(Deserialize, Debug, Clone)]
pub struct TexAgua { pub w: u32, pub h: u32, pub o: usize }
#[derive(Deserialize, Debug, Clone)]
pub struct Prof { pub x0: f32, pub z0: f32, pub w: f32, pub h: f32, #[serde(rename = "D")] pub d: f32, pub tex: Option<TexAgua> }
#[derive(Deserialize, Debug, Clone)]
pub struct Agua { pub fog: [f32; 4], pub esc: f32, pub fuerza: f32, pub dist: f32, pub s: [f32; 4], pub largo: f32, pub normal: Option<TexAgua>, pub prof: Option<Prof>, #[serde(default)] pub y: f32 }
#[derive(Deserialize, Debug, Clone)]
pub struct Cabecera { pub mapa: String, pub w: u32, pub h: u32, pub cam: Cam, pub luz: Luz, pub mallas: Vec<Malla>, pub mats: Vec<Mat>, pub texs: Vec<Tex>, pub lms: Vec<Lm>, pub items: Vec<Item>, pub agua: Option<Agua> }

fn menos1() -> i32 { -1 }

pub struct Escena { pub c: Cabecera, pub datos: Vec<u8> }

impl Escena {
    pub fn leer(b: &[u8]) -> Result<Escena, String> {
        if b.len() < 8 || &b[0..4] != b"JXE1" { return Err("no es un JXE1".into()); }
        let n = u32::from_le_bytes([b[4], b[5], b[6], b[7]]) as usize;
        if b.len() < 8 + n { return Err("JXE1 cortado".into()); }
        let c: Cabecera = serde_json::from_slice(&b[8..8 + n]).map_err(|e| format!("cabecera: {e}"))?;
        Ok(Escena { c, datos: b[8 + n..].to_vec() })
    }
    pub fn bloque(&self, o: usize, n: usize) -> &[u8] { &self.datos[o..o + n] }
}
