//! El motor para los teléfonos viejos: OpenGL ES 2.0 (GLSL ES 1.00), sólo con lo que ES 2 tiene de fábrica. Dibuja lo
//! mismo que gpu.rs con menos: la luz del juego (sol, cielo y suelo, luz horneada, hasta 4 luces del mapa, niebla y
//! ACES), el terreno de tres capas, las texturas mezcladas, lo recortado, lo transparente y lo que suma, el cielo del mapa
//! (su degradé y el sol) y el HUD. Sin sombras ni oclusión (una placa vieja no llega), sin instancias (un dibujo por cosa)
//! y con la escena a una fracción de la pantalla si se pide (`escala`), estirada al final.
//! Las diferencias con ES 3: los vértices se rearman (las UV en float: ES 2 no lee medio float) y los índices de 32 bits
//! se pasan a 16 si la placa no los tiene (OES_element_index_uint).
use crate::escena::{Cielo, Cuadro, Escena, ItemDin, Mat};
use crate::mat::{self, M4};
use glow::HasContext;
use std::collections::HashMap;

pub const MAX_LUCES2: usize = 4;

#[derive(Clone, Debug)]
pub struct Opciones2 { pub escala: f32, pub retoque: bool }
impl Default for Opciones2 { fn default() -> Self { Opciones2 { escala: 1.0, retoque: true } } }

struct Malla2 { vb: glow::Buffer, ib: glow::Buffer, lm: Option<glow::Buffer>, i32: bool, mn: [f32; 3], sc: [f32; 3], lm_id: i64, bytes: usize }
struct Tex2 { t: glow::Texture, bytes: usize }
struct Prog2 { p: glow::Program, u: HashMap<&'static str, glow::UniformLocation> }
impl Prog2 { fn u(&self, n: &str) -> Option<&glow::UniformLocation> { self.u.get(n) } }

const VS_LUZ: &str = r#"
attribute vec3 aP; attribute vec4 aN; attribute vec2 aU; attribute vec2 aL;
uniform mat4 uVP, uM; uniform vec3 uMn, uSc; uniform vec4 uSt;
varying vec3 vW; varying vec3 vN; varying vec2 vU; varying vec2 vL; varying float vMz;
void main() {
  vec4 w = uM * vec4(uMn + aP * uSc, 1.0);
  vW = w.xyz; vN = (uM * vec4(aN.xyz, 0.0)).xyz; vU = aU * uSt.xy + uSt.zw; vL = aL; vMz = aN.w;
  gl_Position = uVP * w;
}"#;
const FS_LUZ: &str = r#"
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uT, uT1, uT2, uT3, uLM; uniform vec4 uS1; uniform vec2 uS3;
uniform vec4 uC; uniform vec3 uSol, uSolC, uAmbS, uAmbG, uNieC, uNieS, uCam, uEm, uMat, uNie; uniform float uExpo; uniform float uModo;
uniform vec4 uLP[4], uLC[4]; uniform float uLN;
varying vec3 vW; varying vec3 vN; varying vec2 vU; varying vec2 vL; varying float vMz;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
bool bit(float m, float b) { return mod(floor(m / b), 2.0) > 0.5; }
// (el retoque final de WebGL en Alto —más color, contraste en S y viñeta—, acá mismo: sin otra pasada)
uniform vec3 uRet;
vec3 retoque(vec3 c) {
  if (uRet.z < 0.5) return c;
  c = pow(c, vec3(2.2)); float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, 1.18), 0.0, 1.0); c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82; c = pow(c, vec3(1.0 / 2.2));
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
void main() {
  vec4 t;
  if (bit(uModo, 16.0)) { vec4 kc = texture2D(uT, vU); t = vec4(texture2D(uT1, vU * uS1.xy).rgb * kc.r + texture2D(uT2, vU * uS1.zw).rgb * kc.g + texture2D(uT3, vU * uS3).rgb * kc.b, 1.0); }
  else if (bit(uModo, 8.0)) t = mix(texture2D(uT, vU), texture2D(uT1, vU), clamp(vMz, 0.0, 1.0));
  else t = texture2D(uT, vU);
  t *= uC;
  if (bit(uModo, 2.0) && t.a < 0.5) discard;
  vec3 col;
  if (bit(uModo, 4.0)) col = pow(t.rgb, vec3(2.2)) * 1.4;
  else {
    vec3 alb = pow(t.rgb, vec3(2.2)); vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
    if (bit(uModo, 64.0)) n = normalize(mix(n, vec3(0.0, 1.0, 0.0), 0.55));
    vec3 v = normalize(uCam - vW); float rough = uMat.x, metal = uMat.y;
    vec3 dif = alb * (1.0 - metal);
    if (bit(uModo, 1.0)) col = dif * pow(texture2D(uLM, vL).rgb, vec3(2.2)) * 4.0;
    else {
      float nl = max(dot(n, uSol), 0.0); vec3 h = normalize(uSol + v);
      float sp = pow(max(dot(n, h), 0.0), mix(256.0, 8.0, rough)) * (1.0 - rough) * 0.6;
      col = (dif + vec3(sp) * mix(vec3(uMat.z), alb, metal) * 4.0) * uSolC * nl + dif * mix(uAmbG, uAmbS, n.y * 0.5 + 0.5);
    }
    for (int i = 0; i < 4; i++) {
      if (float(i) >= uLN) break;
      vec3 L = uLP[i].xyz - vW; float d2 = dot(L, L), r = uLP[i].w;
      if (d2 > r * r) continue;
      float d = sqrt(d2); float at = pow(clamp(1.0 - pow(d / r, 4.0), 0.0, 1.0), 2.0) / (d2 + 1.0);
      col += dif * uLC[i].rgb * max(dot(n, L / d), 0.0) * at;
    }
    col += uEm * 1.6;
  }
  float dist = max(distance(vW, uCam), 1e-3);
  float f = clamp((dist - uNie.x) / max(uNie.y - uNie.x, 0.001), 0.0, 1.0) * uNie.z;
  vec3 vd = (vW - uCam) / dist; vec3 nc = uNieC + uNieS * pow(max(dot(vd, uSol), 0.0), 6.0);
  col = mix(col, nc, f);
  gl_FragColor = vec4(retoque(pow(aces(col * uExpo), vec3(1.0 / 2.2))), t.a);
}"#;
const VS_CIELO: &str = r#"
attribute vec2 aP; varying vec2 vP;
void main() { vP = aP; gl_Position = vec4(aP, 1.0, 1.0); }"#;
const FS_CIELO: &str = r#"
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform mat4 uIVP; uniform vec3 uSol, uNieC, uTop, uMid, uBot, uTinte; uniform vec2 uExp; uniform float uExpo, uTiene, uCieloK, uDia; uniform samplerCube uCubo;
varying vec2 vP;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
// (el retoque final de WebGL en Alto —más color, contraste en S y viñeta—, acá mismo: sin otra pasada)
uniform vec3 uRet;
vec3 retoque(vec3 c) {
  if (uRet.z < 0.5) return c;
  c = pow(c, vec3(2.2)); float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, 1.18), 0.0, 1.0); c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82; c = pow(c, vec3(1.0 / 2.2));
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
void main() {
  vec4 a = uIVP * vec4(vP, -1.0, 1.0), b = uIVP * vec4(vP, 1.0, 1.0); vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  if (uTiene > 0.5) {
    vec3 g = d.y > 0.0 ? mix(uMid, uTop, pow(d.y, uExp.x)) : mix(uMid, uBot, pow(-d.y, uExp.y));
    vec3 cc = g; if (uTiene > 1.5) cc = mix(g, textureCube(uCubo, d).rgb * uTinte, uDia);
    vec3 c = pow(cc, vec3(2.2)) * uCieloK;
    gl_FragColor = vec4(retoque(pow(min(c, vec3(1.0)), vec3(1.0 / 2.2))), 1.0); return;
  }
  vec3 cen = vec3(0.16, 0.36, 0.78), hor = vec3(0.62, 0.74, 0.88);
  vec3 c = d.y >= 0.0 ? mix(hor, cen, pow(clamp(d.y, 0.0, 1.0), 0.45)) : mix(hor, uNieC, clamp(-d.y * 4.0, 0.0, 1.0));
  c += vec3(1.0, 0.92, 0.75) * pow(max(dot(d, uSol), 0.0), 600.0) * 6.0;
  gl_FragColor = vec4(retoque(pow(aces(c * uExpo * 1.1), vec3(1.0 / 2.2))), 1.0);
}"#;
const VS_UI: &str = r#"
attribute vec2 aP; attribute vec2 aU; attribute vec4 aC; uniform vec2 uInv; varying vec2 vU; varying vec4 vC;
void main() { vU = aU; vC = aC; gl_Position = vec4(aP.x * uInv.x * 2.0 - 1.0, 1.0 - aP.y * uInv.y * 2.0, 0.0, 1.0); }"#;
const FS_UI: &str = r#"
precision mediump float; uniform sampler2D uT; varying vec2 vU; varying vec4 vC;
void main() { gl_FragColor = texture2D(uT, vU) * vC; }"#;
const VS_COPIA: &str = r#"
attribute vec2 aP; varying vec2 vU;
void main() { vU = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }"#;
const FS_COPIA: &str = r#"
precision mediump float; uniform sampler2D uT; varying vec2 vU;
void main() { gl_FragColor = texture2D(uT, vU); }"#;

const U_LUZ: [&str; 33] = ["uVP", "uM", "uMn", "uSc", "uSt", "uT", "uT1", "uT2", "uT3", "uLM", "uS1", "uS3", "uC", "uSol", "uSolC", "uAmbS", "uAmbG", "uNieC", "uNieS", "uCam", "uEm", "uMat", "uNie", "uExpo", "uModo", "uLP", "uLC", "uLN", "uIVP", "uTop", "uMid", "uBot", "uExp"];
const U_OTROS: [&str; 7] = ["uTiene", "uCieloK", "uInv", "uRet", "uTinte", "uDia", "uCubo"];

unsafe fn programa(gl: &glow::Context, vs: &str, fs: &str, atrs: &[&str]) -> Result<Prog2, String> {
    let p = gl.create_program()?;
    let mut sh = vec![];
    for (t, src) in [(glow::VERTEX_SHADER, vs), (glow::FRAGMENT_SHADER, fs)] {
        let s = gl.create_shader(t)?; gl.shader_source(s, src); gl.compile_shader(s);
        if !gl.get_shader_compile_status(s) { return Err(format!("sombreador: {}", gl.get_shader_info_log(s))); }
        gl.attach_shader(p, s); sh.push(s);
    }
    for (i, a) in atrs.iter().enumerate() { gl.bind_attrib_location(p, i as u32, a); }
    gl.link_program(p);
    if !gl.get_program_link_status(p) { return Err(format!("programa: {}", gl.get_program_info_log(p))); }
    for s in sh { gl.delete_shader(s); }
    let mut u = HashMap::new();
    for n in U_LUZ.iter().chain(U_OTROS.iter()) {
        let q = if *n == "uLP" || *n == "uLC" { format!("{n}[0]") } else { n.to_string() };
        if let Some(l) = gl.get_uniform_location(p, &q) { u.insert(*n, l); }
    }
    Ok(Prog2 { p, u })
}

/// medio float (IEEE 754 de 16 bits) a float
fn de_medio(h: u16) -> f32 {
    let s = if h & 0x8000 != 0 { -1.0 } else { 1.0 }; let e = ((h >> 10) & 0x1f) as i32; let m = (h & 0x3ff) as f32;
    if e == 0 { s * m * 2f32.powi(-24) } else if e == 31 { s * f32::INFINITY } else { s * (1.0 + m / 1024.0) * 2f32.powi(e - 15) }
}

pub struct Motor {
    pub gl: glow::Context,
    pub op: Opciones2,
    p_luz: Prog2, p_cielo: Prog2, p_ui: Prog2, p_copia: Prog2,
    tri: glow::Buffer, ui_buf: glow::Buffer, blanca: glow::Texture,
    cubo: Option<glow::Texture>,
    mallas: HashMap<i64, Malla2>, mats: HashMap<i64, Mat>, texs: HashMap<i64, Tex2>, lms: HashMap<i64, Tex2>, cielo: Option<Cielo>,
    pub c: Option<Cuadro>, items: Vec<ItemDin>, opacos: Vec<usize>, transp: Vec<usize>,
    uint32: bool, npot: bool,
    escena_rt: Option<(glow::Framebuffer, glow::Texture, glow::Renderbuffer, i32, i32)>,
    pub dibujos: u32, pub memoria: usize, pub mapa: String,
}

impl Motor {
    pub unsafe fn nuevo(gl: glow::Context, op: Opciones2) -> Result<Motor, String> {
        let ext = gl.supported_extensions();
        let uint32 = ext.contains("GL_OES_element_index_uint"); let npot = ext.contains("GL_OES_texture_npot") || ext.contains("GL_ARB_texture_non_power_of_two");
        let p_luz = programa(&gl, VS_LUZ, FS_LUZ, &["aP", "aN", "aU", "aL"])?;
        let p_cielo = programa(&gl, VS_CIELO, FS_CIELO, &["aP"])?;
        let p_ui = programa(&gl, VS_UI, FS_UI, &["aP", "aU", "aC"])?;
        let p_copia = programa(&gl, VS_COPIA, FS_COPIA, &["aP"])?;
        let tri = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(tri));
        let v: [f32; 6] = [-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]; gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32b(&v), glow::STATIC_DRAW);
        let ui_buf = gl.create_buffer()?;
        let blanca = gl.create_texture()?; gl.bind_texture(glow::TEXTURE_2D, Some(blanca));
        gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, 1, 1, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(&[255, 255, 255, 255])));
        gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR as i32);
        Ok(Motor { gl, op, cubo: None, p_luz, p_cielo, p_ui, p_copia, tri, ui_buf, blanca, mallas: HashMap::new(), mats: HashMap::new(), texs: HashMap::new(), lms: HashMap::new(), cielo: None,
            c: None, items: vec![], opacos: vec![], transp: vec![], uint32, npot, escena_rt: None, dibujos: 0, memoria: 0, mapa: String::new() })
    }

    /// una textura RGBA8 (con sus niveles si `mips`); si la placa no tiene texturas de lados que no son potencia de 2, se
    /// estira a la potencia de 2 de abajo
    unsafe fn textura(&self, w: u32, h: u32, px: &[u8], mips: bool) -> Result<(glow::Texture, usize), String> {
        let gl = &self.gl; let (mut w, mut h, mut px) = (w, h, std::borrow::Cow::Borrowed(px));
        let pot = |x: u32| x.is_power_of_two();
        if !self.npot && (!pot(w) || !pot(h)) {
            let (nw, nh) = (1 << (31 - w.max(1).leading_zeros()), 1 << (31 - h.max(1).leading_zeros()));
            let mut o = vec![0u8; (nw * nh * 4) as usize];
            for y in 0..nh { for x in 0..nw { let (sx, sy) = (x * w / nw, y * h / nh); let s = ((sy * w + sx) * 4) as usize; let d = ((y * nw + x) * 4) as usize; o[d..d + 4].copy_from_slice(&px[s..s + 4]); } }
            w = nw; h = nh; px = std::borrow::Cow::Owned(o);
        }
        let t = gl.create_texture()?; gl.bind_texture(glow::TEXTURE_2D, Some(t));
        gl.pixel_store_i32(glow::UNPACK_ALIGNMENT, 1);
        gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, w as i32, h as i32, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(&px)));
        let rep = if mips { glow::REPEAT } else { glow::CLAMP_TO_EDGE } as i32;
        gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_S, rep); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_T, rep);
        gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MAG_FILTER, glow::LINEAR as i32);
        if mips { gl.generate_mipmap(glow::TEXTURE_2D); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR_MIPMAP_LINEAR as i32); }
        else { gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR as i32); }
        Ok((t, (w * h * 4) as usize * if mips { 4 } else { 3 } / 3))
    }

    pub unsafe fn cargar(&mut self, esc: &Escena) -> Result<(), String> {
        let rango = |o: usize, n: usize| -> Result<&[u8], String> { esc.datos.get(o..o + n).ok_or_else(|| format!("bloque fuera ({o}+{n} de {})", esc.datos.len())) };
        for m in &esc.c.mallas {
            // (los vértices de a 20 bytes: posición u16×3 y uno libre, normal i8×4, UV en float×2)
            let src = rango(m.vo, m.v as usize * 14)?; let mut vv = vec![0u8; m.v as usize * 20];
            for (i, c) in src.chunks_exact(14).enumerate() {
                let o = i * 20; vv[o..o + 6].copy_from_slice(&c[0..6]); vv[o + 8..o + 12].copy_from_slice(&c[6..10]);
                let (u, v) = (de_medio(u16::from_le_bytes([c[10], c[11]])), de_medio(u16::from_le_bytes([c[12], c[13]])));
                vv[o + 12..o + 16].copy_from_slice(&u.to_le_bytes()); vv[o + 16..o + 20].copy_from_slice(&v.to_le_bytes());
            }
            let ib_src = rango(m.io, m.ni as usize * if m.i32 != 0 { 4 } else { 2 })?;
            // (índices de 32 bits en una placa que no los tiene: a 16 si entran; si no, la malla no se puede dibujar)
            let (ib_bytes, i32b): (std::borrow::Cow<[u8]>, bool) = if m.i32 != 0 && !self.uint32 {
                if m.v > 65536 { continue; }
                (std::borrow::Cow::Owned(ib_src.chunks_exact(4).flat_map(|c| (u32::from_le_bytes([c[0], c[1], c[2], c[3]]) as u16).to_le_bytes()).collect()), false)
            } else { (std::borrow::Cow::Borrowed(ib_src), m.i32 != 0) };
            let gl = &self.gl;
            let vb = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(vb)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, &vv, glow::STATIC_DRAW);
            let ib = gl.create_buffer()?; gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(ib)); gl.buffer_data_u8_slice(glow::ELEMENT_ARRAY_BUFFER, &ib_bytes, glow::STATIC_DRAW);
            let lm = if m.lo >= 0 { let b = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(b)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, rango(m.lo as usize, m.v as usize * 4)?, glow::STATIC_DRAW); Some(b) } else { None };
            let bytes = vv.len() + ib_bytes.len();
            if let Some(v) = self.mallas.insert(m.id, Malla2 { vb, ib, lm, i32: i32b, mn: m.mn, sc: m.sc, lm_id: m.lm, bytes }) { self.soltar_malla(v); }
            self.memoria += bytes;
        }
        for t in &esc.c.texs {
            let (tx, b) = self.textura(t.w, t.h, rango(t.o, (t.w * t.h * 4) as usize)?, true)?;
            if let Some(v) = self.texs.insert(t.id, Tex2 { t: tx, bytes: b }) { self.memoria -= v.bytes; self.gl.delete_texture(v.t); }
            self.memoria += b;
        }
        for t in &esc.c.lms {
            let (tx, b) = self.textura(t.w, t.h, rango(t.o, (t.w * t.h * 4) as usize)?, false)?;
            if let Some(v) = self.lms.insert(t.id, Tex2 { t: tx, bytes: b }) { self.memoria -= v.bytes; self.gl.delete_texture(v.t); }
            self.memoria += b;
        }
        for m in &esc.c.mats { self.mats.insert(m.id, m.clone()); }
        if let Some(c) = &esc.c.cielo {
            // (la caja del cielo: las seis caras —+X, -X, +Y, -Y, +Z, -Z—)
            if let Some(cr) = &c.caras {
                let n = (cr.l * cr.l * 4) as usize; let gl = &self.gl;
                if let Some(t) = self.cubo.take() { gl.delete_texture(t); }
                let t = gl.create_texture()?; gl.bind_texture(glow::TEXTURE_CUBE_MAP, Some(t));
                for (k, &o) in cr.o.iter().take(6).enumerate() {
                    gl.tex_image_2d(glow::TEXTURE_CUBE_MAP_POSITIVE_X + k as u32, 0, glow::RGBA as i32, cr.l as i32, cr.l as i32, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(rango(o, n)?)));
                }
                for (k, v) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_CUBE_MAP, k, v as i32); }
                self.cubo = Some(t);
            }
            let mut c2 = c.clone(); c2.caras = None; self.cielo = Some(c2);
        }
        if !esc.c.mapa.is_empty() { self.mapa = esc.c.mapa.clone(); }
        Ok(())
    }
    unsafe fn soltar_malla(&mut self, m: Malla2) {
        self.gl.delete_buffer(m.vb); self.gl.delete_buffer(m.ib); if let Some(b) = m.lm { self.gl.delete_buffer(b); }
        self.memoria = self.memoria.saturating_sub(m.bytes);
    }
    pub unsafe fn vaciar(&mut self) {
        for (_, m) in self.mallas.drain().collect::<Vec<_>>() { self.soltar_malla(m); }
        let mut ts: Vec<Tex2> = self.texs.drain().map(|x| x.1).collect(); ts.extend(self.lms.drain().map(|x| x.1));
        for t in ts { self.gl.delete_texture(t.t); }
        if let Some(t) = self.cubo.take() { self.gl.delete_texture(t); }
        self.mats.clear(); self.cielo = None; self.memoria = 0; self.c = None; self.items.clear();
    }

    pub fn poner_cuadro(&mut self, mut c: Cuadro) {
        let pl = mat::planos(&c.vp);
        self.items = std::mem::take(&mut c.items);
        self.opacos.clear(); self.transp.clear();
        for (i, it) in self.items.iter().enumerate() {
            let (Some(_), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { continue };
            if !mat::esfera_dentro(&pl, &it.esf) || mt.agua != 0 { continue; }
            if mt.blend != 0 || mt.add != 0 { self.transp.push(i) } else { self.opacos.push(i) }
        }
        let (mats, items) = (&self.mats, &self.items);
        self.opacos.sort_by_key(|&i| { let it = &items[i]; (mats[&it.mat].t, it.m, it.mat) });
        let d2 = |it: &ItemDin| { let e = it.esf; let (x, y, z) = (e[0] - c.pos[0], e[1] - c.pos[1], e[2] - c.pos[2]); x * x + y * y + z * z };
        self.transp.sort_by(|&a, &b| d2(&items[b]).partial_cmp(&d2(&items[a])).unwrap_or(std::cmp::Ordering::Equal));
        self.c = Some(c);
    }

    /// un cuadro: la escena (a la escala pedida) en `salida` de w × h
    pub unsafe fn dibujar(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32) {
        self.dibujos = 0;
        let (ew, eh) = (((w as f32) * self.op.escala).round().max(16.0) as i32, ((h as f32) * self.op.escala).round().max(16.0) as i32);
        let escalada = self.op.escala < 0.999;
        if escalada && self.escena_rt.as_ref().map(|r| r.3 != ew || r.4 != eh).unwrap_or(true) {
            let gl = &self.gl;
            if let Some((f, t, r, _, _)) = self.escena_rt.take() { gl.delete_framebuffer(f); gl.delete_texture(t); gl.delete_renderbuffer(r); }
            let t = gl.create_texture().unwrap(); gl.bind_texture(glow::TEXTURE_2D, Some(t));
            gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, ew, eh, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(None));
            for (k, v) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, v as i32); }
            let r = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(r)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT16, ew, eh);
            let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f));
            gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(t), 0);
            gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(r));
            self.escena_rt = Some((f, t, r, ew, eh));
        }
        let gl = &self.gl;
        let destino = if escalada { self.escena_rt.as_ref().map(|r| r.0) } else { salida };
        gl.bind_framebuffer(glow::FRAMEBUFFER, destino); gl.viewport(0, 0, if escalada { ew } else { w }, if escalada { eh } else { h });
        gl.clear_color(0.0, 0.0, 0.0, 1.0); gl.clear_depth_f32(1.0); gl.depth_mask(true); gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT);
        if self.c.is_none() { return; }
        gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::LEQUAL); gl.disable(glow::CULL_FACE); gl.disable(glow::BLEND);
        let vp = self.c.as_ref().unwrap().vp;
        let (rw, rh) = if escalada { (ew, eh) } else { (w, h) };
        for p in [&self.p_luz, &self.p_cielo] { gl.use_program(Some(p.p)); gl.uniform_3_f32(p.u("uRet"), 1.0 / rw as f32, 1.0 / rh as f32, if self.op.retoque { 1.0 } else { 0.0 }); }
        self.luces(&vp);
        let opacos = self.opacos.clone(); for i in opacos { self.dibujar_item(i); }
        self.cielo_dibujar(&vp);
        // lo transparente (sin escribir la profundidad), de lo más lejos a lo más cerca
        let gl = &self.gl; gl.enable(glow::BLEND); gl.depth_mask(false); gl.use_program(Some(self.p_luz.p));
        let tr = self.transp.clone();
        for i in tr { let add = self.mats[&self.items[i].mat].add != 0; let gl = &self.gl; if add { gl.blend_func(glow::SRC_ALPHA, glow::ONE); } else { gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); } self.dibujar_item(i); }
        let gl = &self.gl; gl.depth_mask(true); gl.disable(glow::BLEND);
        // (la escena chica, estirada a la pantalla)
        if escalada {
            let (_, t, _, _, _) = *self.escena_rt.as_ref().unwrap();
            gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(0, 0, w, h); gl.disable(glow::DEPTH_TEST);
            gl.use_program(Some(self.p_copia.p)); gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(t));
            gl.uniform_1_i32(self.p_copia.u("uT"), 0);
            gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.tri)); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 2, glow::FLOAT, false, 8, 0);
            gl.draw_arrays(glow::TRIANGLES, 0, 3); gl.enable(glow::DEPTH_TEST);
        }
    }

    fn sol(&self) -> [f32; 3] { mat::norm(self.c.as_ref().map(|c| c.luz.sol).unwrap_or([0.3, 0.8, 0.2])) }
    unsafe fn luces(&self, vp: &M4) {
        let gl = &self.gl; let p = &self.p_luz; let c = self.c.as_ref().unwrap(); let l = &c.luz; let s = self.sol();
        gl.use_program(Some(p.p));
        gl.uniform_matrix_4_f32_slice(p.u("uVP"), false, vp);
        gl.uniform_3_f32(p.u("uSol"), s[0], s[1], s[2]); gl.uniform_3_f32(p.u("uSolC"), l.sol_c[0], l.sol_c[1], l.sol_c[2]);
        gl.uniform_3_f32(p.u("uAmbS"), l.amb_s[0], l.amb_s[1], l.amb_s[2]); gl.uniform_3_f32(p.u("uAmbG"), l.amb_g[0], l.amb_g[1], l.amb_g[2]);
        gl.uniform_3_f32(p.u("uNieC"), l.nie.c[0], l.nie.c[1], l.nie.c[2]); gl.uniform_3_f32(p.u("uNie"), l.nie.a, l.nie.b, if l.nie.m > 0.0 { l.nie.m } else { 1.0 });
        gl.uniform_3_f32(p.u("uNieS"), l.nie.s[0], l.nie.s[1], l.nie.s[2]);
        gl.uniform_3_f32(p.u("uCam"), c.pos[0], c.pos[1], c.pos[2]); gl.uniform_1_f32(p.u("uExpo"), l.expo);
        let n = c.luces.len().min(MAX_LUCES2); let (mut lp, mut lc) = ([0f32; 16], [0f32; 16]);
        for (i, q) in c.luces.iter().take(n).enumerate() { lp[i * 4..i * 4 + 4].copy_from_slice(&q[0..4]); lc[i * 4..i * 4 + 4].copy_from_slice(&q[4..8]); }
        gl.uniform_4_f32_slice(p.u("uLP"), &lp); gl.uniform_4_f32_slice(p.u("uLC"), &lc); gl.uniform_1_f32(p.u("uLN"), n as f32);
        for (k, nm) in ["uT", "uT1", "uT2", "uT3", "uLM"].iter().enumerate() { gl.uniform_1_i32(p.u(nm), k as i32); }
    }
    unsafe fn tex(&self, id: i64) -> glow::Texture { self.texs.get(&id).map(|t| t.t).unwrap_or(self.blanca) }
    unsafe fn dibujar_item(&mut self, i: usize) {
        let it = &self.items[i]; let (Some(m), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { return };
        let gl = &self.gl; let p = &self.p_luz;
        let lm = self.lms.get(&m.lm_id).map(|t| t.t);
        let mut modo = lm.is_some() as i32 | if mt.cut != 0 { 2 } else { 0 } | if mt.unlit != 0 { 4 } else { 0 } | if mt.fol != 0 { 64 } else { 0 };
        let mut capas = [self.tex(mt.t), self.blanca, self.blanca, self.blanca, lm.unwrap_or(self.blanca)];
        if let Some(tr) = mt.terr.as_ref().filter(|t| t.len() == 3) {
            modo |= 16; for k in 0..3 { capas[1 + k] = self.tex(tr[k].0); }
            gl.uniform_4_f32(p.u("uS1"), tr[0].1, tr[0].2, tr[1].1, tr[1].2); gl.uniform_2_f32(p.u("uS3"), tr[2].1, tr[2].2);
        } else if mt.t2 >= 0 { modo |= 8; capas[1] = self.tex(mt.t2); }
        for (k, t) in capas.iter().enumerate() { gl.active_texture(glow::TEXTURE0 + k as u32); gl.bind_texture(glow::TEXTURE_2D, Some(*t)); }
        gl.uniform_1_f32(p.u("uModo"), modo as f32);
        gl.uniform_matrix_4_f32_slice(p.u("uM"), false, &it.mm);
        gl.uniform_3_f32(p.u("uMn"), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u("uSc"), m.sc[0], m.sc[1], m.sc[2]);
        gl.uniform_4_f32(p.u("uSt"), mt.st[0], mt.st[1], mt.st[2], mt.st[3]); gl.uniform_4_f32(p.u("uC"), mt.c[0], mt.c[1], mt.c[2], mt.c[3]);
        gl.uniform_3_f32(p.u("uEm"), mt.em[0], mt.em[1], mt.em[2]); gl.uniform_3_f32(p.u("uMat"), mt.pbr[0], mt.pbr[1], mt.pbr[2]);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(m.vb));
        gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 3, glow::UNSIGNED_SHORT, true, 20, 0);
        gl.enable_vertex_attrib_array(1); gl.vertex_attrib_pointer_f32(1, 4, glow::BYTE, true, 20, 8);
        gl.enable_vertex_attrib_array(2); gl.vertex_attrib_pointer_f32(2, 2, glow::FLOAT, false, 20, 12);
        match m.lm { Some(b) => { gl.bind_buffer(glow::ARRAY_BUFFER, Some(b)); gl.enable_vertex_attrib_array(3); gl.vertex_attrib_pointer_f32(3, 2, glow::UNSIGNED_SHORT, true, 4, 0); }
            None => { gl.disable_vertex_attrib_array(3); gl.vertex_attrib_2_f32(3, 0.0, 0.0); } }
        gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(m.ib));
        let (tipo, tam) = if m.i32 { (glow::UNSIGNED_INT, 4) } else { (glow::UNSIGNED_SHORT, 2) };
        gl.draw_elements(glow::TRIANGLES, it.sn as i32, tipo, (it.s0 * tam) as i32);
        self.dibujos += 1;
    }
    unsafe fn cielo_dibujar(&mut self, vp: &M4) {
        let gl = &self.gl; let p = &self.p_cielo; let s = self.sol(); let l = &self.c.as_ref().unwrap().luz;
        gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u("uIVP"), false, &mat::inv(vp));
        gl.uniform_3_f32(p.u("uSol"), s[0], s[1], s[2]); gl.uniform_3_f32(p.u("uNieC"), l.nie.c[0], l.nie.c[1], l.nie.c[2]); gl.uniform_1_f32(p.u("uExpo"), l.expo);
        match &self.cielo {
            Some(c) => {
                let cubo = c.cubo != 0 && self.cubo.is_some();
                gl.uniform_1_f32(p.u("uTiene"), if cubo { 2.0 } else { 1.0 });
                gl.uniform_3_f32(p.u("uTinte"), c.tinte[0], c.tinte[1], c.tinte[2]); gl.uniform_1_f32(p.u("uDia"), c.dia);
                if cubo { gl.active_texture(glow::TEXTURE5); gl.bind_texture(glow::TEXTURE_CUBE_MAP, self.cubo); gl.uniform_1_i32(p.u("uCubo"), 5); gl.active_texture(glow::TEXTURE0); } gl.uniform_3_f32(p.u("uTop"), c.top[0], c.top[1], c.top[2]); gl.uniform_3_f32(p.u("uMid"), c.mid[0], c.mid[1], c.mid[2]); gl.uniform_3_f32(p.u("uBot"), c.bot[0], c.bot[1], c.bot[2]); gl.uniform_2_f32(p.u("uExp"), c.exp[0], c.exp[1]); gl.uniform_1_f32(p.u("uCieloK"), c.k); }
            None => gl.uniform_1_f32(p.u("uTiene"), 0.0),
        }
        gl.depth_mask(false);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.tri)); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 2, glow::FLOAT, false, 8, 0);
        for a in 1..4 { gl.disable_vertex_attrib_array(a); }
        gl.draw_arrays(glow::TRIANGLES, 0, 3); gl.depth_mask(true);
        self.dibujos += 1;
    }

    /// el HUD: rectángulos del atlas (x, y en píxeles; u, v; color), con la textura `tex`
    pub unsafe fn ui(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32, tex: i64, v: &[f32]) {
        if v.len() < 8 { return; }
        let gl = &self.gl; let p = &self.p_ui;
        gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(0, 0, w, h);
        gl.disable(glow::DEPTH_TEST); gl.enable(glow::BLEND); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA);
        gl.use_program(Some(p.p)); gl.uniform_2_f32(p.u("uInv"), 1.0 / w as f32, 1.0 / h as f32);
        gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(self.tex(tex))); gl.uniform_1_i32(p.u("uT"), 0);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.ui_buf)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32b(v), glow::STREAM_DRAW);
        gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 2, glow::FLOAT, false, 32, 0);
        gl.enable_vertex_attrib_array(1); gl.vertex_attrib_pointer_f32(1, 2, glow::FLOAT, false, 32, 8);
        gl.enable_vertex_attrib_array(2); gl.vertex_attrib_pointer_f32(2, 4, glow::FLOAT, false, 32, 16);
        gl.disable_vertex_attrib_array(3);
        gl.draw_arrays(glow::TRIANGLES, 0, (v.len() / 8) as i32);
        gl.disable(glow::BLEND); gl.enable(glow::DEPTH_TEST);
    }

    pub fn resumen(&self) -> String {
        format!("mapa {} · {} mallas · {} texturas · {} materiales · {:.1} MB en la placa · {} cosas ({} opacas, {} transparentes) · OpenGL ES 2",
            self.mapa, self.mallas.len(), self.texs.len(), self.mats.len(), self.memoria as f64 / 1e6, self.items.len(), self.opacos.len(), self.transp.len())
    }
}

fn f32b(v: &[f32]) -> &[u8] { unsafe { std::slice::from_raw_parts(v.as_ptr() as *const u8, v.len() * 4) } }
