//! El motor para los teléfonos viejos: OpenGL ES 2.0 (GLSL ES 1.00), sólo con lo que ES 2 tiene de fábrica. Dibuja lo
//! mismo que gpu.rs con menos: la luz del juego (sol, cielo y suelo, luz horneada, hasta 4 luces del mapa, niebla y
//! ACES), el terreno de tres capas, las texturas mezcladas, lo recortado, lo transparente y lo que suma, el cielo del mapa
//! (su degradé y el sol), el agua (olas con su mapa de normales, Fresnel con el color del cielo y transparente; sin reflejo)
//! y el HUD. Sin sombras ni oclusión (una placa vieja no llega), sin instancias (un dibujo por cosa)
//! y con la escena a una fracción de la pantalla si se pide (`escala`), estirada al final.
//! Las partículas de efectos.js y las marcas como gpu.rs: sin instancias, cada partícula se arma en la CPU (`part_vertices`:
//! sus 4 esquinas con las mismas cuentas que VS_PART) y van todas en un búfer con índices de 16 bits; las marcas, después de lo
//! opaco y antes de lo transparente, despegadas con glPolygonOffset. Como no hay pasada final, el retoque se les hace en su
//! sombreador (a lo que suma, sólo la viñeta).
//! Las diferencias con ES 3: los vértices se rearman (las UV en float: ES 2 no lee medio float) y los índices de 32 bits
//! se pasan a 16 si la placa no los tiene (OES_element_index_uint).
//! Lo que tiene huesos (personajes, NPC, el arma en la mano) se deforma en la CPU: una placa de ES 2 suele tener 128
//! vectores de uniformes para el vértice y los 56 huesos piden 168. Cada malla con su pose una vez por cuadro (todas
//! sus partes la reusan), con las mismas cuentas que VS_LUZ de gpu.rs, y va a un búfer que se reusa de un cuadro a otro.
use crate::escena::{Cielo, Cuadro, Escena, ItemDin, Mat, FL_CIELO, EF_MARCAS, EF_PART_ALFA, EF_PART_SUMA};
use crate::mat::{self, M4};
use glow::HasContext;
use std::collections::HashMap;

pub const MAX_LUCES2: usize = 4;
/// a lo sumo cuántos huesos por malla (como gpu.rs y WebGL)
const MAX_HUESOS2: usize = 56;

#[derive(Clone, Debug)]
pub struct Opciones2 { pub escala: f32, pub retoque: bool }
impl Default for Opciones2 { fn default() -> Self { Opciones2 { escala: 1.0, retoque: true } } }

struct Malla2 { vb: glow::Buffer, ib: glow::Buffer, lm: Option<glow::Buffer>, i32: bool, mn: [f32; 3], sc: [f32; 3], lm_id: i64, bytes: usize, piel: Option<Box<PielCpu>> }
/// lo que hace falta para deformar una malla con huesos en la CPU: posición y normal sueltas, huesos y pesos por vértice
/// y los vértices armados (para copiar las UV y el byte de la normal que no se toca)
struct PielCpu { p: Vec<[f32; 3]>, n: Vec<[f32; 3]>, j: Vec<[u8; 4]>, w: Vec<[f32; 4]>, vv: Vec<u8> }
/// una malla ya deformada en este cuadro: su id, la pose, el búfer y la caja de sus posiciones
struct Pose2 { m: i64, h: Vec<f32>, vb: glow::Buffer, mn: [f32; 3], sc: [f32; 3] }
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
uniform vec4 uC, uTi, uTi2, uTi3; uniform vec3 uSol, uSolC, uAmbS, uAmbG, uNieC, uNieS, uCam, uEm, uMat, uNie; uniform float uExpo; uniform float uModo;
uniform vec4 uLP[4], uLC[4]; uniform float uLN;
// (las banderas del material ya separadas: terreno, dos texturas, recorte, sin luz · luz horneada, hojas)
uniform vec4 uBan; uniform vec2 uBan2;
varying vec3 vW; varying vec3 vN; varying vec2 vU; varying vec2 vL; varying float vMz;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
// (x^2,2 y x^(1/2,2) con tres raíces en vez de pow: el mismo color —menos de 0,2 de un nivel de 8 bits— y mucho menos trabajo)
vec3 dec(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return x * x * (0.73929934 * b + 0.34228227 * c - 0.0593772 * a - 0.0226474); }
vec3 enc(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return 0.93020244 * a + 0.14337668 * b - 0.02588437 * c - 0.04836126 * x; }

// (el retoque final de WebGL en Alto —más color, contraste en S y viñeta—, acá mismo: sin otra pasada)
uniform vec3 uRet;
vec3 retoque(vec3 c) {
  if (uRet.z < 0.5) return c;
  c = dec(c); float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, 1.18), 0.0, 1.0); c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82; c = enc(c);
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
void main() {
  vec4 t;
  if (uBan.x > 0.5) { vec4 kc = texture2D(uT, vU); t = vec4(texture2D(uT1, vU * uS1.xy).rgb * kc.r + texture2D(uT2, vU * uS1.zw).rgb * kc.g + texture2D(uT3, vU * uS3).rgb * kc.b, 1.0); }
  else if (uBan.y > 0.5) t = mix(texture2D(uT, vU), texture2D(uT1, vU), clamp(vMz, 0.0, 1.0));
  else t = texture2D(uT, vU);
  t *= uC;
  // la pintura en dos tonos (las armas de JXMod, armasjx.js): lo gris de la textura con un color y lo de color (los
  // acentos) con otro, que además brilla; con un solo tono, el brillo de la textura de ese color (Modelo.tinte)
  vec3 emAc = vec3(0.0);
  if (uTi2.a > 0.0) {
    float lu = dot(t.rgb, vec3(0.299, 0.587, 0.114)), sat = max(t.r, max(t.g, t.b)) - min(t.r, min(t.g, t.b));
    float kA = smoothstep(uTi3.a, uTi3.a + 0.16, sat);
    vec3 cu = mix(t.rgb, vec3(lu) * uTi.rgb, uTi.a), ac = mix(t.rgb, vec3(lu) * uTi2.rgb, uTi2.a);
    t.rgb = mix(cu, ac, kA); emAc = ac * kA * uTi3.rgb;
  } else if (uTi.a > 0.0) t.rgb = mix(t.rgb, vec3(dot(t.rgb, vec3(0.299, 0.587, 0.114))) * uTi.rgb, uTi.a);
#ifdef CORTE
  // (sólo en el programa de lo recortado: un sombreador que puede descartar no deja probar la profundidad antes de pintar)
  if (uBan.z > 0.5 && t.a < 0.5) discard;
#endif
  vec3 col;
  if (uBan.w > 0.5) col = dec(t.rgb) * 1.4;
  else {
    vec3 alb = dec(t.rgb); vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
    if (uBan2.y > 0.5) n = normalize(mix(n, vec3(0.0, 1.0, 0.0), 0.55));
    vec3 v = normalize(uCam - vW); float rough = uMat.x, metal = uMat.y;
    vec3 dif = alb * (1.0 - metal);
    if (uBan2.x > 0.5) col = dif * dec(texture2D(uLM, vL).rgb) * 4.0;
    else {
      float nl = max(dot(n, uSol), 0.0); vec3 h = normalize(uSol + v);
      float sp = pow(max(dot(n, h), 0.0), mix(256.0, 8.0, rough)) * (1.0 - rough) * 0.6;
      col = (dif + vec3(sp) * mix(vec3(uMat.z), alb, metal) * 4.0) * uSolC * nl + dif * mix(uAmbG, uAmbS, n.y * 0.5 + 0.5);
    }
    for (int i = 0; i < 4; i++) {
      if (float(i) >= uLN) break;
      vec3 L = uLP[i].xyz - vW; float d2 = dot(L, L), r = uLP[i].w;
      if (d2 > r * r) continue;
      float d = sqrt(d2), q = d2 / (r * r), cae = clamp(1.0 - q * q, 0.0, 1.0); float at = cae * cae / (d2 + 1.0);
      col += dif * uLC[i].rgb * max(dot(n, L / d), 0.0) * at;
    }
    col += uEm * 1.6;
  }
  col += emAc;
  float dist = max(distance(vW, uCam), 1e-3);
  float f = clamp((dist - uNie.x) / max(uNie.y - uNie.x, 0.001), 0.0, 1.0) * uNie.z;
  vec3 vd = (vW - uCam) / dist; float sd = max(dot(vd, uSol), 0.0), sd2 = sd * sd; vec3 nc = uNieC + uNieS * (sd2 * sd2 * sd2);
  col = mix(col, nc, f);
  gl_FragColor = vec4(retoque(enc(aces(col * uExpo))), t.a);
}"#;
// la caja de la oclusión: sólo se prueba contra la profundidad
const VS_CAJA: &str = r#"
attribute vec3 aP; uniform mat4 uVP; uniform vec3 uMn, uSc; void main() { gl_Position = uVP * vec4(uMn + aP * uSc, 1.0); }"#;
const FS_CAJA: &str = r#"
precision mediump float; void main() { gl_FragColor = vec4(1.0); }"#;
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
vec3 dec(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return x * x * (0.73929934 * b + 0.34228227 * c - 0.0593772 * a - 0.0226474); }
vec3 enc(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return 0.93020244 * a + 0.14337668 * b - 0.02588437 * c - 0.04836126 * x; }
uniform vec3 uRet;
vec3 retoque(vec3 c) {
  if (uRet.z < 0.5) return c;
  c = dec(c); float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, 1.18), 0.0, 1.0); c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82; c = enc(c);
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
void main() {
  vec4 a = uIVP * vec4(vP, -1.0, 1.0), b = uIVP * vec4(vP, 1.0, 1.0); vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  if (uTiene > 0.5) {
    bool ar = d.y > 0.0; vec3 g = mix(uMid, ar ? uTop : uBot, pow(abs(d.y), ar ? uExp.x : uExp.y));
    vec3 cc = g; if (uTiene > 1.5) cc = mix(g, textureCube(uCubo, d).rgb * uTinte, uDia);
    vec3 c = dec(cc) * uCieloK;
    gl_FragColor = vec4(retoque(enc(min(c, vec3(1.0)))), 1.0); return;
  }
  vec3 cen = vec3(0.16, 0.36, 0.78), hor = vec3(0.62, 0.74, 0.88);
  vec3 c = d.y >= 0.0 ? mix(hor, cen, pow(clamp(d.y, 0.0, 1.0), 0.45)) : mix(hor, uNieC, clamp(-d.y * 4.0, 0.0, 1.0));
  c += vec3(1.0, 0.92, 0.75) * pow(max(dot(d, uSol), 0.0), 600.0) * 6.0;
  gl_FragColor = vec4(retoque(enc(aces(c * uExpo * 1.1))), 1.0);
}"#;
const VS_AGUA: &str = r#"
attribute vec3 aP; uniform mat4 uVP, uM; uniform vec3 uMn, uSc; varying vec3 vW;
void main() { vec4 w = uM * vec4(uMn + aP * uSc, 1.0); vW = w.xyz; gl_Position = uVP * w; }"#;
const FS_AGUA: &str = r#"
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uN; uniform vec4 uF, uH, uS; uniform vec3 uCam, uSol, uSolC, uAmbS, uAmbG, uTop, uMid; uniform float uTiempo, uExpo;
varying vec3 vW;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  float dCam = distance(vW, uCam); vec3 v = normalize(uCam - vW); vec2 q = vW.xz * uH.x;
  vec3 n1 = texture2D(uN, q + uTiempo * uS.xy).rgb * 2.0 - 1.0, n2 = texture2D(uN, q * 0.71 + vec2(0.37, 0.61) + uTiempo * uS.zw).rgb * 2.0 - 1.0;
  float lejos = 1.0 / (1.0 + dCam * 0.012); vec2 d = (n1.xy + n2.xy) * uH.y * lejos; vec3 n = normalize(vec3(d.x, 1.0, d.y));
  float fq = 1.0 - abs(dot(n, v)), fq2 = fq * fq; float fr = 0.02 + 0.98 * (fq2 * fq2 * fq);
  vec3 cuerpo = pow(aces(uF.rgb * (mix(uAmbG, uAmbS, 0.8) + uSolC * max(uSol.y, 0.0) * 0.5) * 1.6 * uExpo), vec3(1.0 / 2.2));
  vec3 rf = reflect(-v, n); vec3 cielo = mix(uMid, uTop, pow(clamp(rf.y, 0.0, 1.0), 0.5));
  float rv = max(dot(rf, uSol), 0.0); float sp = pow(rv, mix(900.0, 260.0, 1.0 - lejos)) * 2.2 * step(0.0, uSol.y);
  gl_FragColor = vec4(mix(cuerpo, cielo, fr) + uSolC * sp, mix(max(uF.a, 0.82), 1.0, fr));
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

// las partículas, ya armadas en la CPU (posición, UV del atlas, color y lo del humo contra el piso), y las marcas (color por vértice)
const VS_PART: &str = r#"
attribute vec3 aP; attribute vec2 aU; attribute vec4 aC; attribute vec2 aF; uniform mat4 uVP; varying vec4 vC; varying vec2 vU; varying vec2 vF;
void main() { vC = aC; vU = aU; vF = aF; gl_Position = uVP * vec4(aP, 1.0); }"#;
const FS_PART: &str = r#"
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uT; uniform float uSuma; varying vec4 vC; varying vec2 vU; varying vec2 vF;
vec3 dec(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return x * x * (0.73929934 * b + 0.34228227 * c - 0.0593772 * a - 0.0226474); }
vec3 enc(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return 0.93020244 * a + 0.14337668 * b - 0.02588437 * c - 0.04836126 * x; }
uniform vec3 uRet;
vec3 retoque(vec3 c) {
  if (uRet.z < 0.5) return c;
  c = dec(c); float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, 1.18), 0.0, 1.0); c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82; c = enc(c);
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
void main() {
  vec4 t = texture2D(uT, vU); vec4 o = vec4(vC.rgb * t.rgb, vC.a * t.a * clamp(vF.x / vF.y, 0.0, 1.0));
  // (lo que suma, sólo la viñeta: el retoque entero en cada capa —medido— se aparta más de gpu.rs, que lo hace una vez sobre
  // la suma, ya saturada en blanco)
  if (uSuma > 0.5) { if (uRet.z > 0.5) { vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; o.rgb *= 1.0 - dot(q, q) * 0.32; } }
  else o.rgb = retoque(o.rgb);
  gl_FragColor = o;
}"#;
const VS_LIN: &str = r#"
attribute vec3 aP; attribute vec4 aC; uniform mat4 uVP; varying vec4 vC;
void main() { vC = aC; gl_Position = uVP * vec4(aP, 1.0); }"#;
const FS_LIN: &str = r#"
precision mediump float; varying vec4 vC;
vec3 dec(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return x * x * (0.73929934 * b + 0.34228227 * c - 0.0593772 * a - 0.0226474); }
vec3 enc(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return 0.93020244 * a + 0.14337668 * b - 0.02588437 * c - 0.04836126 * x; }
uniform vec3 uRet;
vec3 retoque(vec3 c) {
  if (uRet.z < 0.5) return c;
  c = dec(c); float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, 1.18), 0.0, 1.0); c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82; c = enc(c);
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
void main() { gl_FragColor = vec4(retoque(vC.rgb), vC.a); }"#;
/// los floats de cada vértice de una partícula armada (x, y, z, u, v, r, g, b, a y lo del humo contra el piso)
pub const PART_V2: usize = 11;
/// a lo sumo cuántas partículas por cuadro (los índices son de 16 bits: 4 vértices cada una)
const PART_MAX2: usize = 16383;

const U_LUZ: [&str; 38] = ["uBan", "uBan2", "uTi", "uTi2", "uTi3", "uVP", "uM", "uMn", "uSc", "uSt", "uT", "uT1", "uT2", "uT3", "uLM", "uS1", "uS3", "uC", "uSol", "uSolC", "uAmbS", "uAmbG", "uNieC", "uNieS", "uCam", "uEm", "uMat", "uNie", "uExpo", "uModo", "uLP", "uLC", "uLN", "uIVP", "uTop", "uMid", "uBot", "uExp"];
const U_OTROS: [&str; 14] = ["uTiene", "uCieloK", "uInv", "uRet", "uTinte", "uDia", "uCubo", "uN", "uF", "uH", "uS", "uTiempo", "uSolC", "uSuma"];

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

/// las 4 esquinas de una partícula (`f`: la fila de 16 floats de efectos.js) con las mismas cuentas que VS_PART de gpu.rs
/// —carteles que giran hacia la cámara (`der`, `arr`), chispas estiradas, ondas planas en el piso y las trazas (modo 3)—:
/// PART_V2 floats por vértice en `o`, en el orden (-1,-1), (1,-1), (1,1), (-1,1)
pub fn part_vertices(f: &[f32], der: [f32; 3], arr: [f32; 3], cam: [f32; 3], o: &mut Vec<f32>) {
    let (ap, s, rot, tile, modo, a_s) = ([f[0], f[1], f[2]], f[9], f[10], f[11], f[12], [f[13], f[14], f[15]]);
    let (c, sn) = (rot.cos(), rot.sin());
    let ad = |a: [f32; 3], b: [f32; 3], k: f32| [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
    let nz = |a: [f32; 3]| { let b = [a[0] + 1e-6, a[1] + 1e-6, a[2] + 1e-6]; let l = mat::punto(b, b).sqrt().max(1e-30); [b[0] / l, b[1] / l, b[2] / l] };
    for e in [[-1.0f32, -1.0], [1.0, -1.0], [1.0, 1.0], [-1.0, 1.0]] {
        let r = [e[0] * c - e[1] * sn, e[0] * sn + e[1] * c];
        let mut uv = if modo > 2.5 { [e[0] * 0.5 + 0.5, 0.5] } else { [e[0] * 0.5 + 0.5, e[1] * 0.5 + 0.5] };
        if tile >= -0.5 { uv = [((tile - 2.0 * (tile * 0.5).floor()) + uv[0] * 0.96 + 0.02) * 0.5, ((tile * 0.5).floor() + uv[1] * 0.96 + 0.02) * 0.5]; }
        let p = if modo > 2.5 {
            let q = if e[1] < 0.0 { ad(ap, a_s, -1.0) } else { ap };
            let dn = nz(a_s); let qc = mat::sub(q, cam); let a = nz(mat::cruz(dn, qc));
            ad(q, a, e[0] * s * mat::punto(qc, qc).sqrt())
        } else if modo > 1.5 { [ap[0] + r[0] * s, ap[1], ap[2] + r[1] * s] }
        else if modo > 0.5 {
            let l = mat::punto(a_s, a_s).sqrt(); let dn = if l > 0.00001 { [a_s[0] / l, a_s[1] / l, a_s[2] / l] } else { arr };
            let a = nz(mat::cruz(dn, mat::sub(ap, cam)));
            ad(ad(ad(ap, a, e[0] * s), dn, e[1] * (l * 0.5 + s)), a_s, -0.5)
        } else { ad(ad(ap, der, r[0] * s), arr, r[1] * s) };
        let fz = if modo < 0.5 && a_s[1] > 0.5 { [p[1] - a_s[0], s * 0.45] } else { [1.0, 0.001] };
        o.extend_from_slice(&[p[0], p[1], p[2], uv[0], uv[1], f[3], f[4], f[5], f[6], fz[0], fz[1]]);
    }
}

pub struct Motor {
    pub gl: glow::Context,
    pub op: Opciones2,
    /// la oclusión (sólo con un contexto ES 3 o más, donde las pruebas son del núcleo): por cosa, su prueba, si está en
    /// camino, si la última la vio y en qué cuadro; la caja y su programa; el número de cuadro
    oclu: Option<(HashMap<u64, (glow::Query, bool, bool, u64)>, Prog2, glow::Buffer, glow::Buffer)>, n_cuadro: u64,
    p_luz: Prog2, p_luz_c: Prog2, p_cielo: Prog2, p_ui: Prog2, p_copia: Prog2, p_agua: Prog2, p_part: Prog2, p_lin: Prog2,
    /// las partículas: el búfer de vértices, el de índices (para cuántas alcanza) y lo armado en la CPU; las marcas: su búfer,
    /// cuántos vértices y las que llegaron y todavía no se subieron
    part_vb: glow::Buffer, part_ib: glow::Buffer, part_cap: usize, part_v: Vec<f32>,
    marcas_vb: glow::Buffer, marcas_n: i32, marcas_nuevas: Option<Vec<f32>>,
    agua: Option<crate::escena::Agua>, agua_n: Option<glow::Texture>, aguas: Vec<usize>,
    tri: glow::Buffer, ui_buf: glow::Buffer, blanca: glow::Texture,
    cubo: Option<glow::Texture>,
    mallas: HashMap<i64, Malla2>, mats: HashMap<i64, Mat>, texs: HashMap<i64, Tex2>, lms: HashMap<i64, Tex2>, cielo: Option<Cielo>,
    pub c: Option<Cuadro>, items: Vec<ItemDin>, opacos: Vec<usize>, transp: Vec<usize>,
    uint32: bool, npot: bool,
    escena_rt: Option<(glow::Framebuffer, glow::Texture, glow::Renderbuffer, i32, i32)>,
    pub dibujos: u32, pub memoria: usize, pub mapa: String,
    /// (JXM_FASES: lo que tardó cada parte del cuadro, sumado)
    pub fases: Option<(std::time::Instant, Vec<(&'static str, f64)>)>,
    poses: Vec<Pose2>, poses_n: usize, pose_p: Vec<[f32; 3]>, pose_v: Vec<u8>,
}

impl Motor {
    pub unsafe fn nuevo(gl: glow::Context, op: Opciones2) -> Result<Motor, String> {
        let ext = gl.supported_extensions();
        let uint32 = ext.contains("GL_OES_element_index_uint"); let npot = ext.contains("GL_OES_texture_npot") || ext.contains("GL_ARB_texture_non_power_of_two");
        let p_luz = programa(&gl, VS_LUZ, FS_LUZ, &["aP", "aN", "aU", "aL"])?;
        // (lo recortado aparte: sólo ese programa puede descartar, así lo demás prueba la profundidad antes de pintar)
        let p_luz_c = programa(&gl, VS_LUZ, &format!("#define CORTE\n{FS_LUZ}"), &["aP", "aN", "aU", "aL"])?;
        let p_cielo = programa(&gl, VS_CIELO, FS_CIELO, &["aP"])?;
        let p_ui = programa(&gl, VS_UI, FS_UI, &["aP", "aU", "aC"])?;
        let p_copia = programa(&gl, VS_COPIA, FS_COPIA, &["aP"])?;
        let p_agua = programa(&gl, VS_AGUA, FS_AGUA, &["aP"])?;
        let p_part = programa(&gl, VS_PART, FS_PART, &["aP", "aU", "aC", "aF"])?;
        let p_lin = programa(&gl, VS_LIN, FS_LIN, &["aP", "aC"])?;
        let (part_vb, part_ib, marcas_vb) = (gl.create_buffer()?, gl.create_buffer()?, gl.create_buffer()?);
        let tri = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(tri));
        let v: [f32; 6] = [-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]; gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32b(&v), glow::STATIC_DRAW);
        let ui_buf = gl.create_buffer()?;
        let blanca = gl.create_texture()?; gl.bind_texture(glow::TEXTURE_2D, Some(blanca));
        gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, 1, 1, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(&[255, 255, 255, 255])));
        gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR as i32);
        // (la oclusión: si el contexto es ES 3 —las pruebas son del núcleo—; la caja de 0 a 1 con 36 índices)
        let oclu = if gl.version().major >= 3 && std::env::var_os("JXM_GL2_SIN_OCLU").is_none() {
            let pc = programa(&gl, VS_CAJA, FS_CAJA, &["aP"])?;
            let v: Vec<f32> = (0..8).flat_map(|k: u32| [(k & 1) as f32, (k >> 1 & 1) as f32, (k >> 2 & 1) as f32]).collect();
            let caras: [u16; 36] = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
            let vb = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(vb)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32b(&v), glow::STATIC_DRAW);
            let ib = gl.create_buffer()?; gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(ib)); let ibb: Vec<u8> = caras.iter().flat_map(|x| x.to_le_bytes()).collect(); gl.buffer_data_u8_slice(glow::ELEMENT_ARRAY_BUFFER, &ibb, glow::STATIC_DRAW);
            Some((HashMap::new(), pc, vb, ib))
        } else { None };
        Ok(Motor { oclu, n_cuadro: 0, fases: std::env::var("JXM_FASES").is_ok().then(|| (std::time::Instant::now(), vec![])), gl, op, cubo: None, p_luz, p_luz_c, p_cielo, p_ui, p_copia, p_agua, p_part, p_lin, part_vb, part_ib, part_cap: 0, part_v: Vec::new(), marcas_vb, marcas_n: 0, poses: vec![], poses_n: 0, pose_p: vec![], pose_v: vec![], marcas_nuevas: None, agua: None, agua_n: None, aguas: vec![], tri, ui_buf, blanca, mallas: HashMap::new(), mats: HashMap::new(), texs: HashMap::new(), lms: HashMap::new(), cielo: None,
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
            let mut bytes = vv.len() + ib_bytes.len();
            // (con huesos: la copia para deformarla en la CPU)
            let piel = if m.so >= 0 {
                let sk = rango(m.so as usize, m.v as usize * 8)?;
                let p = src.chunks_exact(14).map(|c| { let q = |k: usize| u16::from_le_bytes([c[k], c[k + 1]]) as f32 / 65535.0; [m.mn[0] + q(0) * m.sc[0], m.mn[1] + q(2) * m.sc[1], m.mn[2] + q(4) * m.sc[2]] }).collect::<Vec<_>>();
                let n = src.chunks_exact(14).map(|c| [(c[6] as i8 as f32 / 127.0).max(-1.0), (c[7] as i8 as f32 / 127.0).max(-1.0), (c[8] as i8 as f32 / 127.0).max(-1.0)]).collect();
                let j = sk.chunks_exact(8).map(|c| [c[0], c[1], c[2], c[3]]).collect();
                let w = sk.chunks_exact(8).map(|c| [c[4] as f32 / 255.0, c[5] as f32 / 255.0, c[6] as f32 / 255.0, c[7] as f32 / 255.0]).collect();
                bytes += vv.len() * 2 + p.len() * 32;
                Some(Box::new(PielCpu { p, n, j, w, vv: vv.clone() }))
            } else { None };
            if let Some(v) = self.mallas.insert(m.id, Malla2 { vb, ib, lm, i32: i32b, mn: m.mn, sc: m.sc, lm_id: m.lm, bytes, piel }) { self.soltar_malla(v); }
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
        if let Some(a) = &esc.c.agua {
            if let Some(n) = &a.normal { let (t, _) = self.textura(n.w, n.h, rango(n.o, (n.w * n.h * 4) as usize)?, true)?; if let Some(v) = self.agua_n.replace(t) { self.gl.delete_texture(v); } }
            let mut a2 = a.clone(); a2.normal = None; a2.prof = None; self.agua = Some(a2);
        }
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
        if let Some(t) = self.agua_n.take() { self.gl.delete_texture(t); } self.agua = None;
        self.mats.clear(); self.cielo = None; self.memoria = 0; self.c = None; self.items.clear();
        for e in self.poses.drain(..) { self.gl.delete_buffer(e.vb); } self.poses_n = 0;
    }

    pub fn poner_cuadro(&mut self, mut c: Cuadro) {
        let pl = mat::planos(&c.vp);
        self.items = std::mem::take(&mut c.items);
        // (las marcas llegan sólo cuando cambian: se suben en el próximo dibujo y quedan en su búfer)
        while let Some(i) = c.efectos.iter().position(|e| e.0 == EF_MARCAS) { self.marcas_nuevas = Some(c.efectos.remove(i).1); }
        self.opacos.clear(); self.transp.clear(); self.aguas.clear();
        for (i, it) in self.items.iter().enumerate() {
            let (Some(_), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { continue };
            if !mat::esfera_dentro(&pl, &it.esf) { continue; }
            if mt.agua != 0 { self.aguas.push(i) } else if mt.blend != 0 || mt.add != 0 { self.transp.push(i) } else { self.opacos.push(i) }
        }
        let (mats, items) = (&self.mats, &self.items);
        self.opacos.sort_by_key(|&i| { let it = &items[i]; (mats[&it.mat].t, it.m, it.mat) });
        let d2 = |it: &ItemDin| { let e = it.esf; let (x, y, z) = (e[0] - c.pos[0], e[1] - c.pos[1], e[2] - c.pos[2]); x * x + y * y + z * z };
        self.transp.sort_by(|&a, &b| d2(&items[b]).partial_cmp(&d2(&items[a])).unwrap_or(std::cmp::Ordering::Equal));
        self.c = Some(c);
    }

    /// un cuadro: la escena (a la escala pedida) en `salida` de w × h
    pub unsafe fn dibujar(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32) {
        self.marca("interfaz_y_cpu");
        self.dibujos = 0; self.poses_n = 0;
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
        for p in [&self.p_luz, &self.p_luz_c, &self.p_cielo] { gl.use_program(Some(p.p)); gl.uniform_3_f32(p.u("uRet"), 1.0 / rw as f32, 1.0 / rh as f32, if self.op.retoque { 1.0 } else { 0.0 }); }
        self.luces(&vp);
        // (el cielo 3D: primero el cielo, la maqueta y lo transparente de ella, y la profundidad borrada; el mapa, siempre adelante)
        // (lo que la última prueba de su caja dio tapado del todo no se dibuja; las cajas se prueban con lo opaco ya dibujado)
        self.n_cuadro += 1; self.oclu_leer();
        let opacos: Vec<usize> = self.opacos.iter().copied().filter(|&i| !self.tapado(i)).collect();
        if self.items.iter().any(|it| it.fl & FL_CIELO != 0) {
            let es = |me: &Self, i: usize| me.items[i].fl & FL_CIELO != 0;
            let (op_c, op_r): (Vec<usize>, Vec<usize>) = opacos.into_iter().partition(|&i| es(self, i));
            let tr_c: Vec<usize> = self.transp.iter().copied().filter(|&i| es(self, i)).collect();
            self.cielo_dibujar(&vp); self.luces(&vp);
            for i in op_c { self.dibujar_item(i); }
            { let gl = &self.gl; gl.enable(glow::BLEND); gl.depth_mask(false); }
            for i in tr_c { let add = self.mats[&self.items[i].mat].add != 0; let gl = &self.gl; if add { gl.blend_func(glow::SRC_ALPHA, glow::ONE); } else { gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); } self.dibujar_item(i); }
            { let gl = &self.gl; gl.disable(glow::BLEND); gl.depth_mask(true); gl.clear(glow::DEPTH_BUFFER_BIT); gl.use_program(Some(self.p_luz.p)); }
            for i in self.de_cerca(&op_r) { self.dibujar_item(i); }
        } else { for i in self.de_cerca(&opacos) { self.dibujar_item(i); } self.cielo_dibujar(&vp); }
        self.oclu_probar(&vp);
        self.marca("opaco_cielo");
        self.marcas(&vp, rw, rh);
        // lo transparente (sin escribir la profundidad), de lo más lejos a lo más cerca
        let gl = &self.gl; gl.enable(glow::BLEND); gl.depth_mask(false); gl.use_program(Some(self.p_luz.p));
        let tr = self.transp.clone();
        for i in tr { if self.items[i].fl & FL_CIELO != 0 { continue; } let add = self.mats[&self.items[i].mat].add != 0; let gl = &self.gl; if add { gl.blend_func(glow::SRC_ALPHA, glow::ONE); } else { gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); } self.dibujar_item(i); }
        // el agua (transparente, después de lo demás)
        if !self.aguas.is_empty() { if let (Some(a), Some(nt)) = (self.agua.clone(), self.agua_n) {
            let gl = &self.gl; let p = &self.p_agua; let c = self.c.as_ref().unwrap(); let l = &c.luz; let s = self.sol();
            gl.use_program(Some(p.p)); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA);
            gl.uniform_matrix_4_f32_slice(p.u("uVP"), false, &vp);
            gl.uniform_4_f32(p.u("uF"), a.fog[0], a.fog[1], a.fog[2], a.fog[3]); gl.uniform_4_f32(p.u("uH"), a.esc, a.fuerza, a.dist, 0.0); gl.uniform_4_f32(p.u("uS"), a.s[0], a.s[1], a.s[2], a.s[3]);
            gl.uniform_3_f32(p.u("uCam"), c.pos[0], c.pos[1], c.pos[2]); gl.uniform_3_f32(p.u("uSol"), s[0], s[1], s[2]); gl.uniform_3_f32(p.u("uSolC"), l.sol_c[0], l.sol_c[1], l.sol_c[2]);
            gl.uniform_3_f32(p.u("uAmbS"), l.amb_s[0], l.amb_s[1], l.amb_s[2]); gl.uniform_3_f32(p.u("uAmbG"), l.amb_g[0], l.amb_g[1], l.amb_g[2]); gl.uniform_1_f32(p.u("uExpo"), l.expo);
            let (top, mid) = self.cielo.as_ref().map(|k| (k.top, k.mid)).unwrap_or(([0.28, 0.64, 1.0], [0.92, 0.92, 0.92]));
            gl.uniform_3_f32(p.u("uTop"), top[0], top[1], top[2]); gl.uniform_3_f32(p.u("uMid"), mid[0], mid[1], mid[2]);
            gl.uniform_1_f32(p.u("uTiempo"), if c.tiempo > 0.0 { c.tiempo } else { 0.0 });
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(nt)); gl.uniform_1_i32(p.u("uN"), 0);
            for &i in &self.aguas.clone() {
                let it = &self.items[i]; let Some(m) = self.mallas.get(&it.m) else { continue }; let gl = &self.gl; let p = &self.p_agua;
                gl.uniform_matrix_4_f32_slice(p.u("uM"), false, &it.mm); gl.uniform_3_f32(p.u("uMn"), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u("uSc"), m.sc[0], m.sc[1], m.sc[2]);
                gl.bind_buffer(glow::ARRAY_BUFFER, Some(m.vb)); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 3, glow::UNSIGNED_SHORT, true, 20, 0);
                for a in 1..4 { gl.disable_vertex_attrib_array(a); }
                gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(m.ib));
                let (tipo, tam) = if m.i32 { (glow::UNSIGNED_INT, 4) } else { (glow::UNSIGNED_SHORT, 2) };
                gl.draw_elements(glow::TRIANGLES, it.sn as i32, tipo, (it.s0 * tam) as i32); self.dibujos += 1;
            }
        } }
        self.marca("transp_agua");
        self.particulas(&vp, rw, rh);
        self.marca("particulas");
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
    /// las marcas (frenadas, quemaduras, agujeros): después de lo opaco, mezcladas, sin escribir la profundidad y despegadas
    /// hacia la cámara (como gpu.rs)
    unsafe fn marcas(&mut self, vp: &M4, rw: i32, rh: i32) {
        let gl = &self.gl;
        if let Some(d) = self.marcas_nuevas.take() { gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.marcas_vb)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32b(&d), glow::DYNAMIC_DRAW); self.marcas_n = (d.len() / 7) as i32; }
        if self.marcas_n == 0 { return; }
        let p = &self.p_lin; gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u("uVP"), false, vp);
        gl.uniform_3_f32(p.u("uRet"), 1.0 / rw as f32, 1.0 / rh as f32, if self.op.retoque { 1.0 } else { 0.0 });
        gl.enable(glow::BLEND); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); gl.depth_mask(false);
        gl.enable(glow::POLYGON_OFFSET_FILL); gl.polygon_offset(-2.0, -4.0);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.marcas_vb));
        gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 3, glow::FLOAT, false, 28, 0);
        gl.enable_vertex_attrib_array(1); gl.vertex_attrib_pointer_f32(1, 4, glow::FLOAT, false, 28, 12);
        for a in 2..4 { gl.disable_vertex_attrib_array(a); }
        gl.draw_arrays(glow::TRIANGLES, 0, self.marcas_n);
        gl.disable(glow::POLYGON_OFFSET_FILL); gl.depth_mask(true); gl.disable(glow::BLEND); self.dibujos += 1;
    }
    /// las partículas del cuadro, armadas en la CPU, en el orden de sus bloques (las de alfa de lejos a cerca, las que suman,
    /// las trazas): un solo búfer y un dibujo por bloque; miran la profundidad sin escribirla
    unsafe fn particulas(&mut self, vp: &M4, rw: i32, rh: i32) {
        let Some(c) = self.c.as_ref() else { return };
        let cam = c.pos; let mut v = std::mem::take(&mut self.part_v); v.clear();
        let mut tandas: Vec<(bool, usize, usize)> = vec![];
        for (t, d) in c.efectos.iter().filter(|e| (e.0 == EF_PART_ALFA || e.0 == EF_PART_SUMA) && e.1.len() > 6) {
            let (der, arr) = ([d[0], d[1], d[2]], [d[3], d[4], d[5]]);
            let desde = v.len() / (4 * PART_V2); let n = ((d.len() - 6) / 16).min(PART_MAX2 - desde); if n == 0 { continue; }
            for k in 0..n { part_vertices(&d[6 + k * 16..6 + k * 16 + 16], der, arr, cam, &mut v); }
            tandas.push((*t == EF_PART_SUMA, desde, n));
        }
        if tandas.is_empty() { self.part_v = v; return; }
        let gl = &self.gl; let total = v.len() / (4 * PART_V2);
        // (los índices: dos triángulos por partícula, como la tabla ESQ de efectos.js; se agrandan cuando no alcanzan)
        if total > self.part_cap {
            let cap = total.next_power_of_two().clamp(256, PART_MAX2 + 1);
            let ix: Vec<u16> = (0..cap as u32).flat_map(|q| { let b = (q * 4) as u16; [b, b + 1, b + 2, b, b + 2, b + 3] }).collect();
            gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(self.part_ib));
            gl.buffer_data_u8_slice(glow::ELEMENT_ARRAY_BUFFER, std::slice::from_raw_parts(ix.as_ptr() as *const u8, ix.len() * 2), glow::STATIC_DRAW);
            self.part_cap = cap;
        }
        let p = &self.p_part; gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u("uVP"), false, vp);
        gl.uniform_3_f32(p.u("uRet"), 1.0 / rw as f32, 1.0 / rh as f32, if self.op.retoque { 1.0 } else { 0.0 });
        gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(self.tex(crate::gpu::TEX_ATLAS))); gl.uniform_1_i32(p.u("uT"), 0);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.part_vb)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32b(&v), glow::STREAM_DRAW);
        gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(self.part_ib));
        let paso = (PART_V2 * 4) as i32;
        for (k, (n, o)) in [(3, 0), (2, 12), (4, 20), (2, 36)].into_iter().enumerate() { gl.enable_vertex_attrib_array(k as u32); gl.vertex_attrib_pointer_f32(k as u32, n, glow::FLOAT, false, paso, o); }
        gl.enable(glow::BLEND); gl.depth_mask(false);
        for &(suma, desde, n) in &tandas {
            gl.blend_func(glow::SRC_ALPHA, if suma { glow::ONE } else { glow::ONE_MINUS_SRC_ALPHA }); gl.uniform_1_f32(p.u("uSuma"), if suma { 1.0 } else { 0.0 });
            gl.draw_elements(glow::TRIANGLES, (n * 6) as i32, glow::UNSIGNED_SHORT, (desde * 6 * 2) as i32);
        }
        gl.depth_mask(true); gl.disable(glow::BLEND);
        self.dibujos += tandas.len() as u32; self.part_v = v;
    }
    unsafe fn luces(&self, vp: &M4) { for p in [&self.p_luz_c, &self.p_luz] { self.luces_en(p, vp); } }
    unsafe fn luces_en(&self, p: &Prog2, vp: &M4) {
        let gl = &self.gl; let c = self.c.as_ref().unwrap(); let l = &c.luz; let s = self.sol();
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
    /// lo opaco de cerca a lejos —lo de atrás se descarta antes de pintarlo— y lo recortado al final (va con su programa)
    fn de_cerca(&self, l: &[usize]) -> Vec<usize> {
        let cp = self.c.as_ref().map_or([0.0; 3], |c| c.pos); let corte = |i: usize| self.mats.get(&self.items[i].mat).map_or(true, |mt| mt.cut != 0);
        let lejos = |i: usize| { let e = self.items[i].esf; ((e[0] - cp[0]).powi(2) + (e[1] - cp[1]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3] };
        let mut orden: Vec<(bool, f32, usize)> = l.iter().map(|&i| (corte(i), lejos(i), i)).collect();
        orden.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.total_cmp(&b.1)));
        orden.into_iter().map(|x| x.2).collect()
    }
    unsafe fn tex(&self, id: i64) -> glow::Texture { self.texs.get(&id).map(|t| t.t).unwrap_or(self.blanca) }
    /// la malla con huesos del item `i` deformada con su pose (una vez por cuadro por malla y pose): búfer y caja
    unsafe fn pose_de(&mut self, i: usize) -> Option<(glow::Buffer, [f32; 3], [f32; 3])> {
        let it = &self.items[i];
        if let Some(e) = self.poses[..self.poses_n].iter().find(|e| e.m == it.m && e.h == it.h) { return Some((e.vb, e.mn, e.sc)); }
        let pc = self.mallas.get(&it.m)?.piel.as_ref()?;
        let (h, nb) = (&it.h, (it.h.len() / 12).min(MAX_HUESOS2));
        // (como VS_LUZ con PIEL: las tres filas de cada hueso sumadas por peso; un hueso que no está no suma)
        let (pp, vv) = (&mut self.pose_p, &mut self.pose_v); pp.clear(); vv.clear(); vv.extend_from_slice(&pc.vv);
        let (mut lo, mut hi) = ([f32::MAX; 3], [f32::MIN; 3]);
        for k in 0..pc.p.len() {
            let mut r = [0f32; 12];
            for q in 0..4 { let (j, w) = (pc.j[k][q] as usize, pc.w[k][q]); if w == 0.0 || j >= nb { continue; } let b = &h[j * 12..j * 12 + 12]; for e in 0..12 { r[e] += b[e] * w; } }
            let (p, n) = (pc.p[k], pc.n[k]);
            let pd = [r[0] * p[0] + r[1] * p[1] + r[2] * p[2] + r[3], r[4] * p[0] + r[5] * p[1] + r[6] * p[2] + r[7], r[8] * p[0] + r[9] * p[1] + r[10] * p[2] + r[11]];
            let mut nd = [r[0] * n[0] + r[1] * n[1] + r[2] * n[2], r[4] * n[0] + r[5] * n[1] + r[6] * n[2], r[8] * n[0] + r[9] * n[1] + r[10] * n[2]];
            let l = (nd[0] * nd[0] + nd[1] * nd[1] + nd[2] * nd[2]).sqrt(); if l > 1e-8 { for e in nd.iter_mut() { *e /= l; } }
            for e in 0..3 { lo[e] = lo[e].min(pd[e]); hi[e] = hi[e].max(pd[e]); vv[k * 20 + 8 + e] = (nd[e] * 127.0).round() as i8 as u8; }
            pp.push(pd);
        }
        let sc = [(hi[0] - lo[0]).max(1e-6), (hi[1] - lo[1]).max(1e-6), (hi[2] - lo[2]).max(1e-6)];
        for (k, p) in pp.iter().enumerate() { for e in 0..3 { let q = (((p[e] - lo[e]) / sc[e]).clamp(0.0, 1.0) * 65535.0).round() as u16; vv[k * 20 + e * 2..k * 20 + e * 2 + 2].copy_from_slice(&q.to_le_bytes()); } }
        let gl = &self.gl;
        if self.poses_n == self.poses.len() { let vb = gl.create_buffer().ok()?; self.poses.push(Pose2 { m: 0, h: vec![], vb, mn: lo, sc }); }
        let e = &mut self.poses[self.poses_n]; self.poses_n += 1;
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(e.vb)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, vv, glow::STREAM_DRAW);
        e.m = it.m; e.h.clear(); e.h.extend_from_slice(h); e.mn = lo; e.sc = sc;
        Some((e.vb, lo, sc))
    }
    unsafe fn dibujar_item(&mut self, i: usize) {
        let pose = if !self.items[i].h.is_empty() && self.mallas.get(&self.items[i].m).map(|m| m.piel.is_some()).unwrap_or(false) { match self.pose_de(i) { Some(x) => Some(x), None => return } } else { None };
        let it = &self.items[i]; let (Some(m), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { return };
        let (vb, mn, sc) = pose.unwrap_or((m.vb, m.mn, m.sc));
        let gl = &self.gl; let p = if mt.cut != 0 { &self.p_luz_c } else { &self.p_luz }; gl.use_program(Some(p.p));
        let lm = self.lms.get(&m.lm_id).map(|t| t.t);
        let mut modo = lm.is_some() as i32 | if mt.cut != 0 { 2 } else { 0 } | if mt.unlit != 0 { 4 } else { 0 } | if mt.fol != 0 { 64 } else { 0 };
        let mut capas = [self.tex(mt.t), self.blanca, self.blanca, self.blanca, lm.unwrap_or(self.blanca)];
        if let Some(tr) = mt.terr.as_ref().filter(|t| t.len() == 3) {
            modo |= 16; for k in 0..3 { capas[1 + k] = self.tex(tr[k].0); }
            gl.uniform_4_f32(p.u("uS1"), tr[0].1, tr[0].2, tr[1].1, tr[1].2); gl.uniform_2_f32(p.u("uS3"), tr[2].1, tr[2].2);
        } else if mt.t2 >= 0 { modo |= 8; capas[1] = self.tex(mt.t2); }
        for (k, t) in capas.iter().enumerate() { gl.active_texture(glow::TEXTURE0 + k as u32); gl.bind_texture(glow::TEXTURE_2D, Some(*t)); }
        gl.uniform_1_f32(p.u("uModo"), modo as f32);
        let b = |k: i32| if modo & k != 0 { 1.0 } else { 0.0 };
        gl.uniform_4_f32(p.u("uBan"), b(16), b(8), b(2), b(4)); gl.uniform_2_f32(p.u("uBan2"), b(1), b(64));
        gl.uniform_matrix_4_f32_slice(p.u("uM"), false, &it.mm);
        gl.uniform_3_f32(p.u("uMn"), mn[0], mn[1], mn[2]); gl.uniform_3_f32(p.u("uSc"), sc[0], sc[1], sc[2]);
        gl.uniform_4_f32(p.u("uSt"), mt.st[0], mt.st[1], mt.st[2], mt.st[3]); gl.uniform_4_f32(p.u("uC"), mt.c[0], mt.c[1], mt.c[2], mt.c[3]);
        gl.uniform_3_f32(p.u("uEm"), mt.em[0], mt.em[1], mt.em[2]); gl.uniform_4_f32_slice(p.u("uTi"), &mt.ti[0..4]); gl.uniform_4_f32_slice(p.u("uTi2"), &mt.ti[4..8]); gl.uniform_4_f32_slice(p.u("uTi3"), &mt.ti[8..12]); gl.uniform_3_f32(p.u("uMat"), mt.pbr[0], mt.pbr[1], mt.pbr[2]);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(vb));
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
    /// la clave de una cosa para la oclusión (como gpu.rs): sin huesos, con al menos 32 triángulos y no pegada a la cámara
    fn oclu_clave(&self, i: usize) -> Option<u64> {
        let it = &self.items[i]; let c = self.c.as_ref()?;
        if !it.h.is_empty() || it.sn < 96 || it.esf[3] < 0.3 || it.fl & FL_CIELO != 0 { return None; }
        let (x, y, z) = (it.esf[0] - c.pos[0], it.esf[1] - c.pos[1], it.esf[2] - c.pos[2]);
        if (x * x + y * y + z * z).sqrt() < it.esf[3] * 1.8 + 1.5 { return None; }
        let q = |v: f32| (v * 4.0).round() as i64 as u64;
        let mut h = (it.m as u64).wrapping_mul(0x9E3779B97F4A7C15) ^ (it.s0 as u64).wrapping_mul(0xC2B2AE3D27D4EB4F) ^ (it.mat as u64).wrapping_mul(0x165667B19E3779F9);
        for v in [q(it.esf[0]), q(it.esf[1]), q(it.esf[2])] { h = (h ^ v).wrapping_mul(0x100000001B3); }
        Some(h)
    }
    fn tapado(&self, i: usize) -> bool { let Some((m, ..)) = self.oclu.as_ref() else { return false }; self.oclu_clave(i).and_then(|k| m.get(&k)).map_or(false, |e| !e.2) }
    /// los resultados que ya llegaron (sin esperar)
    unsafe fn oclu_leer(&mut self) {
        let gl = &self.gl; let Some((m, ..)) = self.oclu.as_mut() else { return };
        for e in m.values_mut() { if e.1 && gl.get_query_parameter_u32(e.0, glow::QUERY_RESULT_AVAILABLE) != 0 { e.2 = gl.get_query_parameter_u32(e.0, glow::QUERY_RESULT) != 0; e.1 = false; } }
    }
    /// prueba la caja de cada candidata contra la profundidad (sin escribir nada); lo visto se vuelve a probar cada 4 cuadros,
    /// lo tapado siempre, lo que ocupa más de un tercio de la pantalla se da por visto; lo que no se prueba hace rato se olvida
    unsafe fn oclu_probar(&mut self, vp: &M4) {
        if self.oclu.is_none() { return; }
        let cand: Vec<(usize, u64)> = self.opacos.iter().filter_map(|&i| self.oclu_clave(i).map(|k| (i, k))).collect();
        let n = self.n_cuadro; let fy = (vp[1] * vp[1] + vp[5] * vp[5] + vp[9] * vp[9]).sqrt();
        let esf: Vec<[f32; 4]> = cand.iter().map(|&(i, _)| self.items[i].esf).collect();
        let gl = &self.gl; let (m, p, vb, ib) = self.oclu.as_mut().unwrap();
        gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u("uVP"), false, vp);
        gl.color_mask(false, false, false, false); gl.depth_mask(false);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(*vb)); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 3, glow::FLOAT, false, 12, 0);
        for a in 1..4 { gl.disable_vertex_attrib_array(a); }
        gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(*ib));
        for (&(_, k), e) in cand.iter().zip(esf) {
            let ent = match m.get_mut(&k) { Some(x) => x, None => { let Ok(q) = gl.create_query() else { continue }; m.entry(k).or_insert((q, false, true, n)) } };
            ent.3 = n; if ent.1 { continue; }
            if ent.2 && (n + (k & 3)) % 4 != 0 { continue; }
            let w = vp[3] * e[0] + vp[7] * e[1] + vp[11] * e[2] + vp[15];
            if w <= 0.0 || e[3] * fy / w > 0.33 { ent.2 = true; continue; }
            let r = e[3] * 1.02 + 0.02;
            gl.uniform_3_f32(p.u("uMn"), e[0] - r, e[1] - r, e[2] - r); gl.uniform_3_f32(p.u("uSc"), 2.0 * r, 2.0 * r, 2.0 * r);
            gl.begin_query(glow::ANY_SAMPLES_PASSED_CONSERVATIVE, ent.0); gl.draw_elements(glow::TRIANGLES, 36, glow::UNSIGNED_SHORT, 0); gl.end_query(glow::ANY_SAMPLES_PASSED_CONSERVATIVE);
            ent.1 = true;
        }
        gl.color_mask(true, true, true, true); gl.depth_mask(true);
        let viejo = n.saturating_sub(300);
        let fuera: Vec<u64> = m.iter().filter(|(_, e)| e.3 < viejo && !e.1).map(|(k, _)| *k).collect();
        for k in fuera { if let Some(e) = m.remove(&k) { gl.delete_query(e.0); } }
    }
    /// (JXM_FASES) termina lo mandado y anota cuánto tardó desde la marca anterior
    pub unsafe fn marca(&mut self, n: &'static str) {
        let Some((t, v)) = self.fases.as_mut() else { return };
        self.gl.finish(); let ms = t.elapsed().as_secs_f64() * 1000.0; *t = std::time::Instant::now();
        match v.iter_mut().find(|x| x.0 == n) { Some(x) => x.1 += ms, None => v.push((n, ms)) }
    }
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
