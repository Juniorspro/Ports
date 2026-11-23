//! El dibujo nativo (GLES 3.0) de lo que manda el juego:
//!  - recursos que llegan de a poco (mallas, texturas, luces horneadas, materiales y el agua), cada uno con su número del
//!    juego, y un cuadro aparte (cámara, sol, luces y la lista de lo que se dibuja con sus matrices y huesos);
//!  - la luz del juego: sol con sombra (dos cascadas en un mapa de profundidad del sol, 3×3 muestras), cielo y suelo, luz horneada de los mapas
//!    de Source, luces puntuales y especiales (linternas), niebla y el tono de pantalla (ACES), como el sombreador de WebGL;
//!  - los personajes con huesos (la piel en la placa, 56 huesos como en WebGL);
//!  - el agua de Half-Life 2: su mapa de normales en dos capas, Fresnel, el reflejo de la escena y lo turbio por lo hondo;
//!  - recorte por lo que ve la cámara (y por lo que ve el sol para la sombra) con la esfera de cada cosa;
//!  - resolución dinámica: la escena a una fracción del tamaño de la pantalla y estirada al final (lo que más pesa en una
//!    placa floja son los píxeles), y la sombra y el reflejo rehechos cada tantos cuadros.
use crate::escena::{Agua, Cielo, Cuadro, Escena, ItemDin, Mat, FL_SIN_SOMBRA, EF_MARCAS, EF_PART_ALFA, EF_PART_SUMA};
use crate::mat::{self, M4};
use glow::HasContext;
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct Opciones {
    /// fracción del tamaño de la pantalla a la que se dibuja la escena (0,5 = la cuarta parte de los píxeles)
    pub escala: f32,
    pub sombras: bool, pub sombra_px: i32, pub sombra_cada: u32, pub sombra_radio: f32,
    pub reflejo: bool, pub reflejo_div: i32, pub reflejo_cada: u32,
    /// oclusión ambiental (lo pegado a paredes y rincones, más oscuro), a media resolución
    pub ao: bool, pub ao_fuerza: f32,
    /// el retoque final de WebGL en Alto: más color, contraste en S y viñeta
    pub retoque: bool,
}
impl Default for Opciones {
    fn default() -> Self { Opciones { escala: 1.0, sombras: true, sombra_px: 2048, sombra_cada: 1, sombra_radio: 45.0, reflejo: true, reflejo_div: 2, reflejo_cada: 1, ao: true, ao_fuerza: 0.6, retoque: true } }
}
impl Opciones {
    /// lo que se elige para un celular de 1 GB con una placa floja: dos tercios de la resolución, sombra de 1024 cada 2
    /// cuadros y reflejo a un cuarto cada 2
    pub fn celular_flojo() -> Self { Opciones { escala: 0.67, sombras: true, sombra_px: 1024, sombra_cada: 2, sombra_radio: 35.0, reflejo: true, reflejo_div: 4, reflejo_cada: 2, ao: false, ao_fuerza: 0.6, retoque: true } }
}

struct MallaGL { vao: glow::VertexArray, bufs: Vec<glow::Buffer>, i32: bool, mn: [f32; 3], sc: [f32; 3], lm: i64, piel: bool, bytes: usize }
struct TexGL { t: glow::Texture, bytes: usize }
struct Destino { fb: glow::Framebuffer, color: glow::Texture, prof: Option<glow::Renderbuffer>, prof_t: Option<glow::Texture>, w: i32, h: i32 }

// los uniformes, por número (buscarlos por nombre en cada dibujo cuesta)
#[derive(Clone, Copy)]
enum U { Mat, NieS, Sesgo, VP, M, SVP, Mn, Sc, St, C, Em, Modo, S1, S3, Sol, SolC, AmbS, AmbG, NieC, Nie, Cam, Expo, Sombra, Clip, B, LP, LC, LD, LN, LE, F, H, S, Bq, D, RefInv, Tiempo, Top, Mid, Bot, Exp, Tinte, Dia, CieloK, TieneCubo, Radio, Inv, Fuerza, Retoque, Der, Arr, RefrOn, RefrK, IVP, SVP2, Sesgo2, Ti, Ti2, Ti3 }
const NU: usize = U::Ti3 as usize + 1;
const NOMBRES: [&str; NU] = ["uMat", "uNieS", "uSesgo", "uVP", "uM", "uSVP", "uMn", "uSc", "uSt", "uC", "uEm", "uModo", "uS1", "uS3", "uSol", "uSolC", "uAmbS", "uAmbG", "uNieC", "uNie", "uCam", "uExpo", "uSombra", "uClip", "uB", "uLP", "uLC", "uLD", "uLN", "uLE", "uF", "uH", "uS", "uBq", "uD", "uRefInv", "uTiempo", "uTop", "uMid", "uBot", "uExp", "uTinte", "uDia", "uCieloK", "uTieneCubo", "uRadio", "uInv", "uFuerza", "uRetoque", "uDer", "uArr", "uRefrOn", "uRefrK", "uIVP", "uSVP2", "uSesgo2", "uTi", "uTi2", "uTi3"];
struct Prog { p: glow::Program, u: Vec<Option<glow::UniformLocation>>, piel: bool }
impl Prog {
    fn u(&self, k: U) -> Option<&glow::UniformLocation> { self.u[k as usize].as_ref() }
}
pub const MAX_HUESOS: usize = 56;
pub const MAX_LUCES: usize = 12;

const VS_LUZ: &str = r#"#version 300 es
layout(location = 0) in vec3 aP; layout(location = 1) in vec4 aN; layout(location = 2) in vec2 aU; layout(location = 5) in vec2 aL;
#ifdef PIEL
layout(location = 3) in vec4 aJ; layout(location = 4) in vec4 aW; uniform vec4 uB[168];
#endif
uniform mat4 uVP, uM, uSVP, uSVP2; uniform vec3 uMn, uSc; uniform vec4 uSt; uniform vec2 uSesgo, uSesgo2;
#ifdef INST
layout(location = 6) in vec4 iM0; layout(location = 7) in vec4 iM1; layout(location = 8) in vec4 iM2; layout(location = 9) in vec4 iM3;
#define MM mat4(iM0, iM1, iM2, iM3)
#else
#define MM uM
#endif
out vec3 vW; out vec3 vN; out vec2 vU; out vec2 vL; out vec4 vS; out vec4 vS2; out float vMz;
void main() {
  vec3 p = uMn + aP * uSc, n = aN.xyz;
#ifdef PIEL
  vec4 r0 = vec4(0.0), r1 = vec4(0.0), r2 = vec4(0.0);
  for (int k = 0; k < 4; k++) { int j = int(aJ[k]) * 3; float w = aW[k]; r0 += uB[j] * w; r1 += uB[j + 1] * w; r2 += uB[j + 2] * w; }
  vec4 q = vec4(p, 1.0); p = vec3(dot(r0, q), dot(r1, q), dot(r2, q)); n = vec3(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n));
#endif
  mat4 M = MM; vec4 w = M * vec4(p, 1.0);
  vMz = aN.w; vW = w.xyz; vN = mat3(M) * n; vU = aU * uSt.xy + uSt.zw; vL = aL;
  // (la sombra se lee corrida por la normal un píxel y medio de la sombra: sin acné y sin despegar la sombra de lo que toca)
  vec3 nn = normalize(vN + vec3(1e-6));
  vS = uSVP * vec4(w.xyz + nn * uSesgo.y, 1.0); vS2 = uSVP2 * vec4(w.xyz + nn * uSesgo2.y, 1.0);
  gl_Position = uVP * w;
}"#;
const FS_LUZ: &str = r#"#version 300 es
precision highp float; precision highp sampler2DShadow;
// el sombreado de WebGL (gl.js, LUZ 3, salida LDR): la luz en lineal, el BRDF con la rugosidad y el metal de cada material,
// el reflejo del cielo, las luces puntuales y especiales, la luz horneada, la niebla con el sol y ACES
uniform sampler2D uT, uLM, uT1, uT2, uT3; uniform vec4 uS1; uniform vec2 uS3; uniform sampler2DShadow uSM;
uniform vec4 uC, uTi, uTi2, uTi3; uniform vec3 uSol, uSolC, uAmbS, uAmbG, uNieC, uNieS, uCam, uEm, uMat, uNie; uniform vec2 uSesgo, uSesgo2; uniform float uExpo, uSombra, uClip; uniform int uModo;
uniform vec3 uTop, uMid, uBot; uniform vec2 uExp; uniform float uCieloK;
uniform vec4 uLP[12], uLC[12], uLD[12]; uniform int uLN, uLE;
in vec3 vW; in vec3 vN; in vec2 vU; in vec2 vL; in vec4 vS; in vec4 vS2; in float vMz; out vec4 o;
const float PI = 3.14159265;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 cieloCol(vec3 d) { float y = d.y; vec3 c = y > 0.0 ? mix(uMid, uTop, pow(y, uExp.x)) : mix(uMid, uBot, pow(-y, uExp.y)); return pow(c, vec3(2.2)) * uCieloK; }
vec3 brdf(vec3 n, vec3 v, vec3 l, vec3 dif, vec3 f0, float a) {
  float nl = dot(n, l); if (nl <= 0.0) return vec3(0.0);
  vec3 h = normalize(l + v); float nh = max(dot(n, h), 0.0), nv = max(dot(n, v), 1e-3), lh = max(dot(l, h), 0.0);
  float a2 = a * a, d = nh * nh * (a2 - 1.0) + 1.0, D = a2 / (PI * d * d);
  float k = a * 0.5, V = 0.25 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
  vec3 F = f0 + (1.0 - f0) * pow(1.0 - lh, 5.0);
  return (dif * (1.0 - F) + min(D * V, 40.0) * F * PI) * nl;
}
// la sombra en dos cascadas, una al lado de la otra en el mismo mapa: la de cerca (fina) y la de lejos; en el borde de la de
// cerca se mezclan (sin costura)
float pcf(vec3 q, float k, float b) {
  vec2 t = 1.0 / vec2(textureSize(uSM, 0)); float s = 0.0;
  float x0 = k * 0.5 + 1.5 * t.x, x1 = k * 0.5 + 0.5 - 1.5 * t.x;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s += texture(uSM, vec3(clamp((q.x + k) * 0.5 + float(i) * t.x, x0, x1), q.y + float(j) * t.y, q.z - b));
  return s / 9.0;
}
float sombra(float nd) {
  if (uSombra < 0.5) return 1.0;
  float inc = 1.0 + 2.0 * (1.0 - nd);
  vec3 q0 = vS.xyz / vS.w * 0.5 + 0.5, q1 = vS2.xyz / vS2.w * 0.5 + 0.5;
  float g = max(abs(q0.x - 0.5), abs(q0.y - 0.5)) * 2.0;
  bool lejos = q1.x <= 0.0 || q1.y <= 0.0 || q1.x >= 1.0 || q1.y >= 1.0 || q1.z >= 1.0;
  if (g < 0.97 && q0.z < 1.0) {
    float s0 = pcf(q0, 0.0, uSesgo.x * inc), k = smoothstep(0.8, 0.97, g);
    return k > 0.0 && !lejos ? mix(s0, pcf(q1, 1.0, uSesgo2.x * inc), k) : s0;
  }
  return lejos ? 1.0 : pcf(q1, 1.0, uSesgo2.x * inc);
}
void main() {
  if (vW.y < uClip) discard;   // (el reflejo: sólo lo de arriba del agua)
  vec4 t;
  if ((uModo & 16) != 0) { vec4 kc = texture(uT, vU); t = vec4(texture(uT1, vU * uS1.xy).rgb * kc.r + texture(uT2, vU * uS1.zw).rgb * kc.g + texture(uT3, vU * uS3).rgb * kc.b, 1.0); }   // (terreno: control y tres capas)
  else if ((uModo & 8) != 0) t = mix(texture(uT, vU), texture(uT1, vU), clamp(vMz, 0.0, 1.0));   // (dos texturas mezcladas por vértice)
  else t = texture(uT, vU);
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
  if ((uModo & 2) != 0 && t.a < 0.5) discard;
  vec3 col;
  if ((uModo & 4) != 0) col = pow(t.rgb, vec3(2.2)) * 1.4;   // (sin luz)
  else {
    vec3 alb = pow(t.rgb, vec3(2.2)), ng = normalize(vN); if (!gl_FrontFacing) ng = -ng;
    bool fol = (uModo & 64) != 0, lm = (uModo & 1) != 0;
    vec3 n = fol ? normalize(mix(ng, vec3(0.0, 1.0, 0.0), 0.55)) : ng, v = normalize(uCam - vW);
    float rough = uMat.x, metal = uMat.y, a = max(rough * rough, 0.004), nl = dot(n, uSol), sh = 1.0;
    vec3 dif = alb * (1.0 - metal), f0 = mix(vec3(uMat.z), alb, metal), lmL = vec3(0.0);
    if (lm) { lmL = pow(texture(uLM, vL).rgb, vec3(2.2)) * 4.0; col = dif * lmL; }   // (la luz horneada del mapa, en vez del sol y el cielo)
    else { sh = nl > 0.0 ? sombra(max(nl, 0.0)) : 0.0; col = brdf(n, v, uSol, dif, f0, a) * uSolC * sh; }
    if (fol) col += dif * uSolC * pow(max(dot(-v, uSol), 0.0), 4.0) * 0.6 * sh;   // (luz que atraviesa las hojas)
    for (int i = 0; i < 12; i++) {
      if (i >= uLN) break;
      vec3 L = uLP[i].xyz - vW; float d2 = dot(L, L), r = uLP[i].w;
      if (d2 > r * r) continue;
      float d = sqrt(d2); L /= d;
      bool es = i >= uLE;   // (las especiales —linternas—: caen suave y envuelven un poco)
      float at = es ? pow(1.0 - d / r, 1.2) / (1.0 + 0.012 * d2) : pow(clamp(1.0 - pow(d / r, 4.0), 0.0, 1.0), 2.0) / (d2 + 1.0);
      if (uLD[i].w > -1.0) at *= smoothstep(uLD[i].w, uLD[i].w + (es && uLC[i].w > 0.0 ? uLC[i].w : 0.08), dot(-L, uLD[i].xyz));
      col += (brdf(n, v, L, dif, f0, max(a, 0.05)) + (es ? dif * 0.08 : vec3(0.0))) * uLC[i].rgb * at;
    }
    // luz del cielo: difusa (hemisferio) y reflejo (el cielo en la dirección reflejada, más borroso cuanto más áspero)
    vec3 rf = reflect(-v, n), amb, env; float nv = max(dot(n, v), 1e-3);
    if (lm) { amb = vec3(0.0); env = lmL * 0.5; } else { amb = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5); env = mix(cieloCol(rf), amb, clamp(rough * 1.15, 0.0, 1.0)); }
    float hor = clamp(1.0 + 1.3 * dot(rf, ng), 0.0, 1.0); env *= hor * hor;
    vec3 Fr = f0 + (max(vec3(1.0 - rough), f0) - f0) * pow(1.0 - nv, 5.0);
    col += dif * amb + env * Fr * mix(1.0, sh * 0.6 + 0.4, metal) + uEm * 1.6;
  }
  col += emAc;
  // la niebla (hasta cuánto tapa, la luz del sol en ella mirando para el sol y la de lo lejos y bajo)
  float dist = max(distance(vW, uCam), 1e-3);
  float f = clamp((dist - uNie.x) / max(uNie.y - uNie.x, 0.001), 0.0, 1.0) * uNie.z;
  vec3 vd = (vW - uCam) / dist, nc = uNieC + uNieS * pow(max(dot(vd, uSol), 0.0), 6.0);
  f = 1.0 - (1.0 - f) * exp(-max(0.0, dist - 20.0) * 0.0006 * exp(-max(vW.y - uCam.y + 5.0, 0.0) * 0.02));
  col = mix(col, nc, f);
  o = vec4(pow(aces(col * uExpo), vec3(1.0 / 2.2)) + (ign(gl_FragCoord.xy) - 0.5) / 255.0, t.a);
}"#;
const VS_SOMBRA: &str = r#"#version 300 es
layout(location = 0) in vec3 aP;
#ifdef PIEL
layout(location = 3) in vec4 aJ; layout(location = 4) in vec4 aW; uniform vec4 uB[168];
#endif
uniform mat4 uVP, uM; uniform vec3 uMn, uSc;
#ifdef INST
layout(location = 6) in vec4 iM0; layout(location = 7) in vec4 iM1; layout(location = 8) in vec4 iM2; layout(location = 9) in vec4 iM3;
#define MM mat4(iM0, iM1, iM2, iM3)
#else
#define MM uM
#endif
void main() {
  vec3 p = uMn + aP * uSc;
#ifdef PIEL
  vec4 r0 = vec4(0.0), r1 = vec4(0.0), r2 = vec4(0.0);
  for (int k = 0; k < 4; k++) { int j = int(aJ[k]) * 3; float w = aW[k]; r0 += uB[j] * w; r1 += uB[j + 1] * w; r2 += uB[j + 2] * w; }
  vec4 q = vec4(p, 1.0); p = vec3(dot(r0, q), dot(r1, q), dot(r2, q));
#endif
  gl_Position = uVP * MM * vec4(p, 1.0);
}"#;
const FS_SOMBRA: &str = r#"#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.0); }"#;
const FS_AGUA: &str = r#"#version 300 es
precision highp float;
// el agua de HL2/GMod: tres capas del mapa de normales (dos que corren cruzadas y una chica y rápida: las olitas), el fondo
// visto a través del agua corrido por las olas (refracción, de la copia de la escena), lo turbio por lo hondo, el reflejo
// corrido por las olas, Fresnel y los destellos del sol en cada ola
uniform sampler2D uN, uRef, uP, uRefr; uniform highp sampler2D uRefrP;
uniform vec4 uF, uH, uS, uBq; uniform vec2 uD, uRefInv; uniform float uTiempo, uExpo, uRefrOn, uRefrK;
uniform vec3 uSol, uSolC, uAmbS, uAmbG, uCam;
in vec3 vW; in vec3 vN; in vec2 vU; in vec2 vL; in vec4 vS; in float vMz; out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  float dCam = distance(vW, uCam); vec3 v = normalize(uCam - vW);
  vec2 q = vW.xz * uH.x;
  vec3 n1 = texture(uN, q + uTiempo * uS.xy).rgb * 2.0 - 1.0, n2 = texture(uN, q * 0.71 + vec2(0.37, 0.61) + uTiempo * uS.zw).rgb * 2.0 - 1.0;
  vec3 n3 = texture(uN, q * 2.7 + vec2(0.13, 0.77) + uTiempo * vec2(uS.y, -uS.x) * 2.3).rgb * 2.0 - 1.0;
  float lejos = 1.0 / (1.0 + dCam * 0.012);
  vec2 d = ((n1.xy + n2.xy) * uH.y + n3.xy * uH.y * 0.45 * lejos) * lejos;
  vec3 n = normalize(vec3(d.x, 1.0, d.y));
  float fr = 0.02 + 0.98 * pow(1.0 - abs(dot(n, v)), 5.0);
  vec3 cuerpo = pow(aces(uF.rgb * (mix(uAmbG, uAmbS, 0.8) + uSolC * max(uSol.y, 0.0) * 0.5) * 1.6 * uExpo), vec3(1.0 / 2.2));
  // (como Source: la imagen se corre lo que inclina la normal por $reflectamount y $refractamount; un poco menos a lo lejos)
  vec2 pan = gl_FragCoord.xy * uRefInv, ola = n.xz / (1.0 + dCam * 0.01), onda = ola * uH.z;
  vec3 refl = uH.w > 0.5 ? texture(uRef, pan + onda).rgb : mix(cuerpo, vec3(0.75, 0.82, 0.9), 0.6);
  // (lo hondo de este punto: cuánto agua cruza la mirada hasta el fondo)
  vec2 pb = (vW.xz - uBq.xy) * uBq.zw;
  float prof = (pb.x >= 0.0 && pb.y >= 0.0 && pb.x <= 1.0 && pb.y <= 1.0) ? texture(uP, pb).r * uD.x : uD.x;
  float niebla = 1.0 - exp(-prof / max(abs(v.y), 0.08) / uD.y);
  // (los destellos del sol: con la normal de las olas, más anchos lejos —se ven como un camino de brillos—)
  float rv = max(dot(reflect(-v, n), uSol), 0.0), sp = (pow(rv, mix(900.0, 260.0, 1.0 - lejos)) * 2.2 + pow(rv, 60.0) * 0.08) * step(0.0, uSol.y);
  if (uRefrOn > 0.5) {
    // el fondo corrido por las olas (más corrido cuanto más hondo) y teñido por el agua
    vec2 uvf = pan + ola * uRefrK * (0.35 + 0.65 * min(prof / max(uD.x, 0.1), 1.0));
    if (texture(uRefrP, uvf).r < gl_FragCoord.z) uvf = pan;   // (lo que está delante del agua no se corre: no se ondula)
    vec3 fondo = texture(uRefr, uvf).rgb;
    vec3 abajo = mix(fondo * mix(vec3(1.0), uF.rgb / max(max(uF.r, uF.g), max(uF.b, 1e-3)), 0.35), cuerpo, max(niebla, uF.a * 0.25));
    o = vec4(mix(abajo, refl, fr) + uSolC * sp, 1.0);
  } else {
    o = vec4(mix(cuerpo, refl, fr) + uSolC * sp, mix(max(niebla, uF.a * 0.25), 1.0, fr));
  }
}"#;
const VS_CIELO: &str = r#"#version 300 es
out vec2 vP; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vP = p; gl_Position = vec4(p, 0.9999, 1.0); }"#;
const FS_CIELO: &str = r#"#version 300 es
precision highp float; uniform mat4 uIVP; uniform vec3 uSol, uNieC; uniform float uExpo; in vec2 vP; out vec4 o;
uniform samplerCube uCubo; uniform vec3 uTop, uMid, uBot, uTinte; uniform vec2 uExp; uniform float uDia, uCieloK; uniform int uTieneCubo;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec4 a = uIVP * vec4(vP, -1.0, 1.0), b = uIVP * vec4(vP, 1.0, 1.0); vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  if (uTieneCubo > 0) {
    // (el cielo del mapa, como en WebGL: el degradé y la caja —una imagen ya terminada, sin tono— con su tinte)
    vec3 g = d.y > 0.0 ? mix(uMid, uTop, pow(d.y, uExp.x)) : mix(uMid, uBot, pow(-d.y, uExp.y));
    vec3 c = uTieneCubo > 1 ? mix(g, texture(uCubo, d).rgb * uTinte, uDia) : g;
    c = pow(c, vec3(2.2)) * uCieloK;
    o = vec4(pow(min(c, vec3(1.0)), vec3(1.0 / 2.2)), 1.0); return;
  }
  vec3 cen = vec3(0.16, 0.36, 0.78), hor = vec3(0.62, 0.74, 0.88);
  vec3 c = mix(hor, cen, pow(clamp(d.y, 0.0, 1.0), 0.45)); if (d.y < 0.0) c = mix(hor, uNieC, clamp(-d.y * 4.0, 0.0, 1.0));
  c += vec3(1.0, 0.92, 0.75) * pow(max(dot(d, uSol), 0.0), 600.0) * 6.0;
  o = vec4(pow(aces(c * uExpo * 1.1), vec3(1.0 / 2.2)), 1.0);
}"#;

const FS_AO: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uProf; uniform mat4 uIVP, uVP; uniform vec3 uCam; uniform float uRadio; in vec2 vP; out vec4 o;
vec3 mundo(vec2 uv) { vec4 p = uIVP * vec4(uv * 2.0 - 1.0, texture(uProf, uv).r * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 uv = vP * 0.5 + 0.5;
  if (texture(uProf, uv).r >= 0.99999) { o = vec4(1.0); return; }   // (el cielo)
  vec3 w = mundo(uv), n = normalize(cross(dFdx(w), dFdy(w)));
  if (dot(n, uCam - w) < 0.0) n = -n;
  vec3 t = normalize(abs(n.y) < 0.9 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0))), b = cross(n, t);
  float a0 = ign(gl_FragCoord.xy) * 6.2831853, r = uRadio * clamp(distance(w, uCam) * 0.1, 0.3, 1.0), occ = 0.0;
  for (int i = 0; i < 12; i++) {
    // (una espiral en la media esfera de la normal, cada vez más lejos)
    float h = (float(i) + 0.5) / 12.0, ang = a0 + float(i) * 2.3999632, c = sqrt(1.0 - h), sn = sqrt(h);
    vec3 s = w + (t * cos(ang) * sn + b * sin(ang) * sn + n * c) * r * mix(0.2, 1.0, h * h);
    vec4 q = uVP * vec4(s, 1.0); vec2 su = q.xy / q.w * 0.5 + 0.5;
    if (q.w <= 0.0 || su.x < 0.0 || su.y < 0.0 || su.x > 1.0 || su.y > 1.0) continue;
    vec3 d = mundo(su);
    if (distance(d, uCam) < distance(s, uCam) - 0.02) occ += smoothstep(0.0, 1.0, r / max(distance(d, w), 1e-3));
  }
  float ao = 1.0 - occ / 12.0;
  o = vec4(ao, ao, ao, 1.0);
}"#;
const FS_AO_PONER: &str = r#"#version 300 es
precision mediump float; uniform sampler2D uAO; uniform vec2 uInv; uniform float uFuerza; in vec2 vP; out vec4 o;
void main() {
  vec2 uv = vP * 0.5 + 0.5;
  float a = 0.25 * (texture(uAO, uv + vec2(-uInv.x, -uInv.y)).r + texture(uAO, uv + vec2(uInv.x, -uInv.y)).r + texture(uAO, uv + vec2(-uInv.x, uInv.y)).r + texture(uAO, uv + uInv).r);
  o = vec4(vec3(mix(1.0, a, uFuerza)), 1.0);   // (se multiplica con lo que ya está dibujado)
}"#;

const FS_FINAL: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uEsc; uniform float uRetoque; in vec2 vP; out vec4 o;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 uv = vP * 0.5 + 0.5; vec3 c = texture(uEsc, uv).rgb;
  if (uRetoque > 0.5) {
    // (como FS_FINAL de post.js: un toque más de color y de contraste —curva en S suave— y un poco de viñeta)
    c = pow(c, vec3(2.2));
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = clamp(mix(vec3(l), c, 1.18), 0.0, 1.0);
    c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82;
    c = pow(c, vec3(1.0 / 2.2));
    vec2 q = uv - 0.5; c *= 1.0 - dot(q, q) * 0.32;
    c += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  }
  o = vec4(c, 1.0);
}"#;

// las partículas como en efectos.js (VS_PART/FS_PART): carteles que giran, chispas estiradas por su velocidad y ondas planas
// en el piso, del atlas de 4 cuadros; 16 floats por partícula (la fila del primer vértice de efectos.js), dibujadas con instancias.
// El modo 3 (propio del juego nativo: las trazas de las balas) es una línea de aP − aS a aP del mismo ancho en la pantalla: su
// medio ancho es s por la distancia a la cámara, y la textura es la fila del medio del cuadro (borde suave a los costados)
const VS_PART: &str = r#"#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; layout(location=2) in vec3 aE; layout(location=3) in vec3 aX; layout(location=4) in vec3 aS;
uniform mat4 uVP; uniform vec3 uDer, uArr, uCam; out vec4 vC; out vec2 vU; out vec2 vF;
// (una instancia por partícula: la esquina sale del número de vértice, como la tabla ESQ de efectos.js)
const vec2 ESQ[6] = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
void main(){ vC = aC; vec2 e = ESQ[gl_VertexID % 6]; float s = aE.z, c = cos(aX.x), sn = sin(aX.x); vec2 r = vec2(e.x * c - e.y * sn, e.x * sn + e.y * c);
  vec2 uv = aX.z > 2.5 ? vec2(e.x * 0.5 + 0.5, 0.5) : e * 0.5 + 0.5; vU = aX.y < -0.5 ? uv : (vec2(mod(aX.y, 2.0), floor(aX.y * 0.5)) + uv * 0.96 + 0.02) * 0.5;
  vec3 p;
  if (aX.z > 2.5) { vec3 q = e.y < 0.0 ? aP - aS : aP, dn = normalize(aS + vec3(0.000001)), a = normalize(cross(dn, q - uCam) + vec3(0.000001)); p = q + a * (e.x * s * length(q - uCam)); }
  else if (aX.z > 1.5) p = aP + vec3(r.x, 0.0, r.y) * s;
  else if (aX.z > 0.5) { float l = length(aS); vec3 dn = l > 0.00001 ? aS / l : uArr; vec3 a = normalize(cross(dn, aP - uCam) + vec3(0.000001)); p = aP + a * (e.x * s) + dn * (e.y * (l * 0.5 + s)) - aS * 0.5; }
  else p = aP + (uDer * r.x + uArr * r.y) * s;
  vF = aX.z < 0.5 && aS.y > 0.5 ? vec2(p.y - aS.x, s * 0.45) : vec2(1.0, 0.001);
  gl_Position = uVP * vec4(p, 1.0); }"#;
const FS_PART: &str = r#"#version 300 es
precision highp float; in vec4 vC; in vec2 vU; in vec2 vF; uniform sampler2D uT; out vec4 o;
void main(){ vec4 t = texture(uT, vU); o = vec4(vC.rgb * t.rgb, vC.a * t.a * clamp(vF.x / vF.y, 0.0, 1.0)); }"#;
// las marcas de frenada (marcas.js: color por vértice, 7 floats)
const VS_LIN: &str = r#"#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; out vec4 vC; void main(){ vC = aC; gl_Position = uVP * vec4(aP, 1.0); }"#;
const FS_LIN: &str = r#"#version 300 es
precision highp float; in vec4 vC; out vec4 o; void main(){ o = vC; }"#;
/// el número de textura del atlas de las partículas (lo arma el juego: efectosAtlas en la web, jxjuego::efectos::atlas)
pub const TEX_ATLAS: i64 = -1000;

/// (las pruebas en la compu: el motor Vulkan sin ventana —lavapipe— visto igual compile jxmotor con «vk» o sin; sin, `vk_sin_ventana`
/// dice que no está. Así un ejemplo que no pide «vk» igual compila)
pub trait FotoVk {
    unsafe fn cargar(&mut self, e: &Escena) -> Result<(), String>;
    fn poner_cuadro(&mut self, c: Cuadro);
    /// dibuja el cuadro y devuelve la imagen (RGBA, la primera fila arriba)
    unsafe fn foto(&mut self) -> Result<Vec<u8>, String>;
    /// lo que tardó la placa en cada pasada la última vez que se midió
    fn tiempos(&self) -> Option<(f32, String)>;
    fn placa(&self) -> String;
}
/// el motor Vulkan sin ventana, de w × h (si jxmotor se compiló con «vk»)
pub unsafe fn vk_sin_ventana(w: u32, h: u32, op: Opciones) -> Result<Box<dyn FotoVk>, String> {
    #[cfg(feature = "vk")] { Ok(Box::new(crate::vk::Motor::nuevo(None, w, h, op)?)) }
    #[cfg(not(feature = "vk"))] { let _ = (w, h, op); Err("jxmotor sin «vk» (compilar con --features jxmotor/vk)".into()) }
}
/// el atlas de las letras de la interfaz (JXMod nativo: herramientas/atlas_letras.py)
pub const TEX_LETRAS: i64 = -2000;
// la interfaz (JXMod nativo): rectángulos con textura y color, en píxeles de la pantalla (8 floats por vértice: x, y, u, v,
// r, g, b, a), encima de todo
const VS_UI: &str = r#"#version 300 es
layout(location=0) in vec2 aP; layout(location=1) in vec2 aU; layout(location=2) in vec4 aC; uniform vec2 uInv; out vec2 vU; out vec4 vC;
void main(){ vU = aU; vC = aC; gl_Position = vec4(aP.x * uInv.x * 2.0 - 1.0, 1.0 - aP.y * uInv.y * 2.0, 0.0, 1.0); }"#;
const FS_UI: &str = r#"#version 300 es
precision mediump float; in vec2 vU; in vec4 vC; uniform sampler2D uT; out vec4 o; void main(){ o = texture(uT, vU) * vC; }"#;

/// la fuente con unas definiciones después de `#version`
fn con_defs(src: &str, defs: &str) -> String { let (a, b) = src.split_once('\n').unwrap(); format!("{a}\n{defs}{b}") }

unsafe fn programa(gl: &glow::Context, vs: &str, fs: &str, defs: &str) -> Result<Prog, String> {
    let p = gl.create_program()?;
    let mut ss = vec![];
    for (t, src) in [(glow::VERTEX_SHADER, con_defs(vs, defs)), (glow::FRAGMENT_SHADER, con_defs(fs, defs))] {
        let s = gl.create_shader(t)?; gl.shader_source(s, &src); gl.compile_shader(s);
        if !gl.get_shader_compile_status(s) { return Err(format!("sombreador ({defs}): {}", gl.get_shader_info_log(s))); }
        gl.attach_shader(p, s); ss.push(s);
    }
    gl.link_program(p);
    if !gl.get_program_link_status(p) { return Err(format!("programa: {}", gl.get_program_info_log(p))); }
    for s in ss { gl.detach_shader(p, s); gl.delete_shader(s); }
    let u = NOMBRES.iter().map(|n| gl.get_uniform_location(p, n)).collect();
    gl.use_program(Some(p));
    for (n, unidad) in [("uT", 0), ("uLM", 1), ("uSM", 2), ("uN", 0), ("uRef", 3), ("uP", 4), ("uT1", 5), ("uT2", 6), ("uT3", 7), ("uCubo", 8), ("uProf", 9), ("uAO", 10), ("uEsc", 11), ("uRefr", 12), ("uRefrP", 13)] { if let Some(l) = gl.get_uniform_location(p, n) { gl.uniform_1_i32(Some(&l), unidad); } }
    Ok(Prog { p, u, piel: defs.contains("PIEL") })
}
unsafe fn textura(gl: &glow::Context, w: u32, h: u32, px: &[u8], repetir: bool, mips: bool) -> glow::Texture {
    let t = gl.create_texture().unwrap(); gl.bind_texture(glow::TEXTURE_2D, Some(t));
    gl.pixel_store_i32(glow::UNPACK_ALIGNMENT, 1);
    gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA8 as i32, w as i32, h as i32, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(px)));
    let w_ = if repetir { glow::REPEAT } else { glow::CLAMP_TO_EDGE } as i32;
    gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_S, w_); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_T, w_);
    gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MAG_FILTER, glow::LINEAR as i32);
    if mips { gl.generate_mipmap(glow::TEXTURE_2D); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR_MIPMAP_LINEAR as i32); }
    else { gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR as i32); }
    t
}
unsafe fn destino(gl: &glow::Context, w: i32, h: i32) -> Destino { destino_con(gl, w, h, false) }
/// un destino de color (RGBA8) y profundidad; con `prof_tex`, la profundidad en una textura que se puede leer (la oclusión)
unsafe fn destino_con(gl: &glow::Context, w: i32, h: i32, prof_tex: bool) -> Destino {
    let color = gl.create_texture().unwrap(); gl.bind_texture(glow::TEXTURE_2D, Some(color));
    gl.tex_storage_2d(glow::TEXTURE_2D, 1, glow::RGBA8, w, h);
    gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MAG_FILTER, glow::LINEAR as i32);
    gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE as i32);
    let fb = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb));
    gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(color), 0);
    let (mut prof, mut prof_t) = (None, None);
    if prof_tex {
        let t = gl.create_texture().unwrap(); gl.bind_texture(glow::TEXTURE_2D, Some(t));
        gl.tex_storage_2d(glow::TEXTURE_2D, 1, glow::DEPTH_COMPONENT24, w, h);
        for (k, v) in [(glow::TEXTURE_MIN_FILTER, glow::NEAREST), (glow::TEXTURE_MAG_FILTER, glow::NEAREST), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, v as i32); }
        gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::TEXTURE_2D, Some(t), 0);
        prof_t = Some(t);
    } else {
        let rb = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(rb)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT24, w, h);
        gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(rb));
        prof = Some(rb);
    }
    Destino { fb, color, prof, prof_t, w, h }
}
unsafe fn borrar_destino(gl: &glow::Context, d: Destino) { gl.delete_framebuffer(d.fb); gl.delete_texture(d.color); if let Some(r) = d.prof { gl.delete_renderbuffer(r); } if let Some(t) = d.prof_t { gl.delete_texture(t); } }

pub struct Motor {
    pub gl: glow::Context,
    pub op: Opciones,
    mallas: HashMap<i64, MallaGL>,
    mats: HashMap<i64, Mat>,
    texs: HashMap<i64, TexGL>,
    lms: HashMap<i64, TexGL>,
    agua: Option<Agua>, agua_n: Option<glow::Texture>, agua_p: Option<glow::Texture>,
    cielo: Option<Cielo>, cubo: Option<glow::Texture>,
    blanca: glow::Texture,
    p_luz: Prog, p_luz_piel: Prog, p_sombra: Prog, p_sombra_piel: Prog, p_agua: Prog, p_cielo: Prog, p_ao: Prog, p_ao_poner: Prog, p_final: Prog, p_part: Prog, p_lin: Prog, p_luz_inst: Prog, p_sombra_inst: Prog, inst_buf: glow::Buffer,
    part: (glow::VertexArray, glow::Buffer), marcas: (glow::VertexArray, glow::Buffer, i32),
    p_ui: Prog, ui: (glow::VertexArray, glow::Buffer),
    ao_rt: Option<Destino>,
    /// la copia de la escena antes del agua (para ver el fondo corrido por las olas)
    refr_rt: Option<Destino>,
    sombra: Option<(glow::Framebuffer, glow::Texture, i32)>,
    reflejo: Option<Destino>,
    escena_rt: Option<Destino>,
    svp: M4,
    sesgo: [f32; 2],
    /// la cascada de lejos (la de cerca es svp/sesgo)
    svp2: M4, sesgo2: [f32; 2],
    /// el cuadro (sin sus cosas, que van en `items`)
    pub c: Option<Cuadro>,
    items: Vec<ItemDin>,
    pub cuadro: u64,
    pub dibujos: u32,
    opacos: Vec<usize>, transp: Vec<usize>, aguas: Vec<usize>,
    /// lo que ocupa en la placa (mallas, texturas y luces horneadas), en bytes
    pub memoria: usize,
    /// los lugares fijos de las cosas (cuadros JXC2)
    pub ranuras: Vec<Option<ItemDin>>,
    /// dibujar con instancias las copias de una misma cosa (se puede apagar para comparar: JXM_SIN_INST)
    pub instancias: bool,
    /// (las variables de las pruebas, leídas una vez al crear el motor: no en cada cuadro)
    dbg: bool, sin_agua: bool,
    pub mapa: String,
}

impl Motor {
    /// arma los sombreadores; los recursos llegan después con `cargar`
    pub unsafe fn nuevo(gl: glow::Context, op: Opciones) -> Result<Motor, String> {
        let p_luz = programa(&gl, VS_LUZ, FS_LUZ, "")?;
        let p_luz_piel = programa(&gl, VS_LUZ, FS_LUZ, "#define PIEL\n")?;
        let p_sombra = programa(&gl, VS_SOMBRA, FS_SOMBRA, "")?;
        let p_sombra_piel = programa(&gl, VS_SOMBRA, FS_SOMBRA, "#define PIEL\n")?;
        // (muchas copias de una misma cosa —500 cajas iguales—: un solo dibujo con la matriz de cada una)
        let p_luz_inst = programa(&gl, VS_LUZ, FS_LUZ, "#define INST\n")?;
        let p_sombra_inst = programa(&gl, VS_SOMBRA, FS_SOMBRA, "#define INST\n")?;
        let inst_buf = gl.create_buffer()?;
        let p_agua = programa(&gl, VS_LUZ, FS_AGUA, "")?;
        let p_cielo = programa(&gl, VS_CIELO, FS_CIELO, "")?;
        let p_ao = programa(&gl, VS_CIELO, FS_AO, "")?;
        let p_ao_poner = programa(&gl, VS_CIELO, FS_AO_PONER, "")?;
        let p_final = programa(&gl, VS_CIELO, FS_FINAL, "")?;
        let p_part = programa(&gl, VS_PART, FS_PART, "")?;
        let p_lin = programa(&gl, VS_LIN, FS_LIN, "")?;
        let p_ui = programa(&gl, VS_UI, FS_UI, "")?;
        let vbo = |atr: &[(u32, i32, i32)], paso: i32| -> Result<(glow::VertexArray, glow::Buffer), String> {
            let v = gl.create_vertex_array()?; gl.bind_vertex_array(Some(v)); let b = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(b));
            for &(l, n, o) in atr { gl.enable_vertex_attrib_array(l); gl.vertex_attrib_pointer_f32(l, n, glow::FLOAT, false, paso, o); }
            gl.bind_vertex_array(None); Ok((v, b))
        };
        let part = vbo(&[(0, 3, 0), (1, 4, 12), (2, 3, 28), (3, 3, 40), (4, 3, 52)], 64)?;
        gl.bind_vertex_array(Some(part.0)); for l in 0..5 { gl.vertex_attrib_divisor(l, 1); } gl.bind_vertex_array(None);
        let mv = vbo(&[(0, 3, 0), (1, 4, 12)], 28)?; let marcas = (mv.0, mv.1, 0);
        let ui = vbo(&[(0, 2, 0), (1, 2, 8), (2, 4, 16)], 32)?;
        let blanca = textura(&gl, 1, 1, &[255, 255, 255, 255], true, false);
        Ok(Motor { gl, op, mallas: HashMap::new(), mats: HashMap::new(), texs: HashMap::new(), lms: HashMap::new(), agua: None, agua_n: None, agua_p: None, cielo: None, cubo: None, blanca,
            p_luz, p_luz_piel, p_sombra, p_sombra_piel, p_agua, p_cielo, p_ao, p_ao_poner, p_final, p_part, p_lin, p_ui, ui, p_luz_inst, p_sombra_inst, inst_buf, part, marcas, ao_rt: None, refr_rt: None, sombra: None, reflejo: None, escena_rt: None, svp: mat::id(), sesgo: [0.0, 0.0], svp2: mat::id(), sesgo2: [0.0, 0.0], c: None, items: vec![], cuadro: 0, dibujos: 0,
            opacos: vec![], transp: vec![], aguas: vec![], memoria: 0, mapa: String::new(), ranuras: Vec::new(), instancias: std::env::var("JXM_SIN_INST").is_err(),
            dbg: std::env::var("JXM_DBG").is_ok(), sin_agua: std::env::var("JXM_SIN_AGUA").is_ok() })
    }

    /// sube a la placa los recursos nuevos (los que ya estaban con el mismo número se reemplazan)
    pub unsafe fn cargar(&mut self, esc: &Escena) -> Result<(), String> {
        let gl = &self.gl;
        let rango = |o: usize, n: usize| -> Result<&[u8], String> { esc.datos.get(o..o + n).ok_or_else(|| format!("bloque fuera del archivo ({o}+{n} de {})", esc.datos.len())) };
        for m in &esc.c.mallas {
            let vao = gl.create_vertex_array()?; gl.bind_vertex_array(Some(vao));
            let mut bufs = vec![]; let mut bytes = 0;
            let mut subir = |destino: u32, datos: &[u8]| -> Result<glow::Buffer, String> { let b = gl.create_buffer()?; gl.bind_buffer(destino, Some(b)); gl.buffer_data_u8_slice(destino, datos, glow::STATIC_DRAW); bytes += datos.len(); bufs.push(b); Ok(b) };
            subir(glow::ARRAY_BUFFER, rango(m.vo, m.v as usize * 14)?)?;
            gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 3, glow::UNSIGNED_SHORT, true, 14, 0);
            gl.enable_vertex_attrib_array(1); gl.vertex_attrib_pointer_f32(1, 4, glow::BYTE, true, 14, 6);
            gl.enable_vertex_attrib_array(2); gl.vertex_attrib_pointer_f32(2, 2, glow::HALF_FLOAT, false, 14, 10);
            if m.lo >= 0 {
                subir(glow::ARRAY_BUFFER, rango(m.lo as usize, m.v as usize * 4)?)?;
                gl.enable_vertex_attrib_array(5); gl.vertex_attrib_pointer_f32(5, 2, glow::UNSIGNED_SHORT, true, 4, 0);
            }
            if m.so >= 0 {
                subir(glow::ARRAY_BUFFER, rango(m.so as usize, m.v as usize * 8)?)?;
                gl.enable_vertex_attrib_array(3); gl.vertex_attrib_pointer_f32(3, 4, glow::UNSIGNED_BYTE, false, 8, 0);
                gl.enable_vertex_attrib_array(4); gl.vertex_attrib_pointer_f32(4, 4, glow::UNSIGNED_BYTE, true, 8, 4);
            }
            subir(glow::ELEMENT_ARRAY_BUFFER, rango(m.io, m.ni as usize * if m.i32 != 0 { 4 } else { 2 })?)?;
            gl.bind_vertex_array(None);
            if let Some(v) = self.mallas.insert(m.id, MallaGL { vao, bufs, i32: m.i32 != 0, mn: m.mn, sc: m.sc, lm: m.lm, piel: m.so >= 0, bytes }) { self.memoria -= v.bytes; borrar_malla(gl, v); }
            self.memoria += bytes;
        }
        for t in &esc.c.texs {
            let n = (t.w * t.h * 4) as usize; let tx = TexGL { t: textura(gl, t.w, t.h, rango(t.o, n)?, true, true), bytes: n * 4 / 3 };
            self.memoria += tx.bytes;
            if let Some(v) = self.texs.insert(t.id, tx) { self.memoria -= v.bytes; gl.delete_texture(v.t); }
        }
        for t in &esc.c.lms {
            let n = (t.w * t.h * 4) as usize; let tx = TexGL { t: textura(gl, t.w, t.h, rango(t.o, n)?, false, false), bytes: n };
            self.memoria += tx.bytes;
            if let Some(v) = self.lms.insert(t.id, tx) { self.memoria -= v.bytes; gl.delete_texture(v.t); }
        }
        for m in &esc.c.mats { self.mats.insert(m.id, m.clone()); }
        if let Some(a) = &esc.c.agua {
            if let Some(n) = &a.normal { if let Some(v) = self.agua_n.take() { gl.delete_texture(v); } self.agua_n = Some(textura(gl, n.w, n.h, rango(n.o, (n.w * n.h * 4) as usize)?, true, true)); }
            if let Some(p) = a.prof.as_ref().and_then(|p| p.tex.as_ref()) { if let Some(v) = self.agua_p.take() { gl.delete_texture(v); } self.agua_p = Some(textura(gl, p.w, p.h, rango(p.o, (p.w * p.h * 4) as usize)?, false, false)); }
            self.agua = Some(a.clone());
        }
        if let Some(c) = &esc.c.cielo {
            if let Some(cr) = &c.caras {
                if let Some(v) = self.cubo.take() { gl.delete_texture(v); }
                let t = gl.create_texture()?; gl.bind_texture(glow::TEXTURE_CUBE_MAP, Some(t)); gl.pixel_store_i32(glow::UNPACK_ALIGNMENT, 1);
                let n = (cr.l * cr.l * 4) as usize;
                for (f, &o) in cr.o.iter().enumerate().take(6) {
                    gl.tex_image_2d(glow::TEXTURE_CUBE_MAP_POSITIVE_X + f as u32, 0, glow::RGBA8 as i32, cr.l as i32, cr.l as i32, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(rango(o, n)?)));
                }
                for (k, v) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_R, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_CUBE_MAP, k, v as i32); }
                self.cubo = Some(t);
            }
            let mut c2 = c.clone(); c2.caras = None; self.cielo = Some(c2);
        }
        if !esc.c.mapa.is_empty() { self.mapa = esc.c.mapa.clone(); }
        Ok(())
    }

    /// borra todo lo cargado (cambio de mapa)
    pub unsafe fn vaciar(&mut self) {
        let gl = &self.gl;
        for (_, m) in self.mallas.drain() { borrar_malla(gl, m); }
        for (_, t) in self.texs.drain() { gl.delete_texture(t.t); }
        for (_, t) in self.lms.drain() { gl.delete_texture(t.t); }
        if let Some(t) = self.agua_n.take() { gl.delete_texture(t); }
        if let Some(t) = self.agua_p.take() { gl.delete_texture(t); }
        if let Some(t) = self.cubo.take() { gl.delete_texture(t); }
        self.cielo = None;
        self.mats.clear(); self.agua = None; self.memoria = 0; self.c = None; self.items.clear(); self.ranuras.clear();
    }
    /// borra recursos sueltos: tipo 0 mallas, 1 texturas, 2 luces horneadas, 3 materiales
    pub unsafe fn quitar(&mut self, tipo: u8, ids: &[i64]) {
        let gl = &self.gl;
        for id in ids {
            match tipo {
                0 => if let Some(m) = self.mallas.remove(id) { self.memoria -= m.bytes; borrar_malla(gl, m); },
                1 => if let Some(t) = self.texs.remove(id) { self.memoria -= t.bytes; gl.delete_texture(t.t); },
                2 => if let Some(t) = self.lms.remove(id) { self.memoria -= t.bytes; gl.delete_texture(t.t); },
                _ => { self.mats.remove(id); }
            }
        }
    }
    pub fn tiene_malla(&self, id: i64) -> bool { self.mallas.contains_key(&id) }

    /// el cuadro que sigue: qué se ve (recorte por la cámara) y en qué pasada va cada cosa
    pub fn poner_cuadro(&mut self, mut c: Cuadro) {
        let pl = mat::planos(&c.vp);
        self.items = std::mem::take(&mut c.items);
        self.opacos.clear(); self.transp.clear(); self.aguas.clear();
        for (i, it) in self.items.iter().enumerate() {
            let (Some(m), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { continue };
            if !mat::esfera_dentro(&pl, &it.esf) { continue; }
            if mt.agua != 0 { self.aguas.push(i) } else if mt.blend != 0 || mt.add != 0 { self.transp.push(i) } else { let _ = m; self.opacos.push(i) }
        }
        // (lo opaco: primero sin huesos y después con huesos —un programa cada grupo—, y por textura: menos cambios de estado)
        if self.dbg {
            let sin_m: std::collections::BTreeSet<i64> = self.items.iter().filter(|it| !self.mallas.contains_key(&it.m)).map(|it| it.m).collect();
            let sin_t: std::collections::BTreeSet<i64> = self.items.iter().filter(|it| !self.mats.contains_key(&it.mat)).map(|it| it.mat).collect();
            let fuera = self.items.iter().filter(|it| !mat::esfera_dentro(&pl, &it.esf)).count();
            eprintln!("cuadro: {} cosas · sin malla {:?} · sin material {:?} · fuera de cámara {}", self.items.len(), sin_m, sin_t, fuera);
        }
        let (mallas, mats) = (&self.mallas, &self.mats);
        let clave =|it: &ItemDin| (!it.h.is_empty() && mallas[&it.m].piel, mats[&it.mat].t, it.m, it.s0, it.mat);
        let items = &self.items;
        self.opacos.sort_by_key(|&i| clave(&items[i]));
        // (las marcas de frenada llegan sólo cuando cambian: quedan en su búfer)
        if let Some((_, d)) = c.efectos.iter().find(|e| e.0 == EF_MARCAS) {
            let gl = &self.gl; unsafe { gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.marcas.1)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32_bytes(d), glow::DYNAMIC_DRAW); }
            self.marcas.2 = (d.len() / 7) as i32;
        }
        // (lo transparente: de lo más lejos a lo más cerca)
        let d2 = |it: &ItemDin| { let e = it.esf; let (x, y, z) = (e[0] - c.pos[0], e[1] - c.pos[1], e[2] - c.pos[2]); x * x + y * y + z * z };
        self.transp.sort_by(|&a, &b| d2(&items[b]).partial_cmp(&d2(&items[a])).unwrap_or(std::cmp::Ordering::Equal));
        self.c = Some(c);
    }

    fn sol(&self) -> [f32; 3] { mat::norm(self.c.as_ref().map(|c| c.luz.sol).unwrap_or([0.3, 0.8, 0.2])) }

    unsafe fn dibujar_item(&self, p: &Prog, it: &ItemDin, conluz: bool) { self.dibujar_n(p, it, conluz, 1); }
    /// una cosa (n = 1) o n copias de ella con sus matrices en el búfer de instancias (ya armado, desde `it`)
    unsafe fn dibujar_n(&self, p: &Prog, it: &ItemDin, conluz: bool, n: i32) {
        let gl = &self.gl; let Some(m) = self.mallas.get(&it.m) else { return };
        gl.bind_vertex_array(Some(m.vao));
        if n <= 1 { gl.uniform_matrix_4_f32_slice(p.u(U::M), false, &it.mm); }   // (con n > 1 las matrices ya están en el búfer de instancias)
        gl.uniform_3_f32(p.u(U::Mn), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u(U::Sc), m.sc[0], m.sc[1], m.sc[2]);
        if p.piel { let n = it.h.len().min(MAX_HUESOS * 12) / 4 * 4; gl.uniform_4_f32_slice(p.u(U::B), &it.h[..n]); }
        if conluz {
            let Some(mt) = self.mats.get(&it.mat) else { return };
            let tx = |i: i64| self.texs.get(&i).map(|t| t.t).unwrap_or(self.blanca);
            gl.uniform_4_f32(p.u(U::St), mt.st[0], mt.st[1], mt.st[2], mt.st[3]);
            gl.uniform_4_f32(p.u(U::C), mt.c[0], mt.c[1], mt.c[2], mt.c[3]);
            gl.uniform_3_f32(p.u(U::Em), mt.em[0], mt.em[1], mt.em[2]); gl.uniform_4_f32_slice(p.u(U::Ti), &mt.ti[0..4]); gl.uniform_4_f32_slice(p.u(U::Ti2), &mt.ti[4..8]); gl.uniform_4_f32_slice(p.u(U::Ti3), &mt.ti[8..12]); gl.uniform_3_f32(p.u(U::Mat), mt.pbr[0], mt.pbr[1], mt.pbr[2]);
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(tx(mt.t)));
            let lm = self.lms.get(&m.lm);
            if let Some(l) = lm { gl.active_texture(glow::TEXTURE1); gl.bind_texture(glow::TEXTURE_2D, Some(l.t)); }
            let mut modo = (lm.is_some() as i32) | if mt.cut != 0 { 2 } else { 0 } | if mt.unlit != 0 { 4 } else { 0 } | if mt.cut != 0 || mt.blend != 0 { 32 } else { 0 } | if mt.fol != 0 { 64 } else { 0 };
            if let Some(tr) = mt.terr.as_ref().filter(|t| t.len() == 3) {
                for (k, c) in tr.iter().enumerate() { gl.active_texture(glow::TEXTURE5 + k as u32); gl.bind_texture(glow::TEXTURE_2D, Some(tx(c.0))); }
                gl.uniform_4_f32(p.u(U::S1), tr[0].1, tr[0].2, tr[1].1, tr[1].2); gl.uniform_2_f32(p.u(U::S3), tr[2].1, tr[2].2); modo |= 16;
            } else if mt.t2 >= 0 { gl.active_texture(glow::TEXTURE5); gl.bind_texture(glow::TEXTURE_2D, Some(tx(mt.t2))); modo |= 8; }
            gl.uniform_1_i32(p.u(U::Modo), modo);
        }
        let (tipo, off) = (if m.i32 { glow::UNSIGNED_INT } else { glow::UNSIGNED_SHORT }, (it.s0 * if m.i32 { 4 } else { 2 }) as i32);
        if n > 1 {
            gl.draw_elements_instanced(glow::TRIANGLES, it.sn as i32, tipo, off, n);
            for k in 0..4u32 { gl.disable_vertex_attrib_array(6 + k); }
        } else { gl.draw_elements(glow::TRIANGLES, it.sn as i32, tipo, off); }
    }

    /// los uniformes de la pasada (cámara, sol, cielo, niebla, sombra y luces) en un programa
    unsafe fn luces(&self, p: &Prog, vp: &M4, clip: f32) {
        let gl = &self.gl; let c = self.c.as_ref().unwrap(); let l = &c.luz; let s = self.sol(); let cp = &c.pos;
        gl.use_program(Some(p.p));
        gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp); gl.uniform_matrix_4_f32_slice(p.u(U::SVP), false, &self.svp); gl.uniform_matrix_4_f32_slice(p.u(U::SVP2), false, &self.svp2);
        gl.uniform_3_f32(p.u(U::Sol), s[0], s[1], s[2]); gl.uniform_3_f32(p.u(U::SolC), l.sol_c[0], l.sol_c[1], l.sol_c[2]);
        gl.uniform_3_f32(p.u(U::AmbS), l.amb_s[0], l.amb_s[1], l.amb_s[2]); gl.uniform_3_f32(p.u(U::AmbG), l.amb_g[0], l.amb_g[1], l.amb_g[2]);
        gl.uniform_3_f32(p.u(U::NieC), l.nie.c[0], l.nie.c[1], l.nie.c[2]); gl.uniform_3_f32(p.u(U::Nie), l.nie.a, l.nie.b, if l.nie.m > 0.0 { l.nie.m } else { 1.0 });
        gl.uniform_3_f32(p.u(U::NieS), l.nie.s[0], l.nie.s[1], l.nie.s[2]);
        gl.uniform_3_f32(p.u(U::Cam), cp[0], cp[1], cp[2]); gl.uniform_1_f32(p.u(U::Expo), l.expo);
        // (el cielo para el reflejo del cielo en las superficies)
        let (top, mid, bot, ex, k) = self.cielo.as_ref().map(|c| (c.top, c.mid, c.bot, c.exp, c.k)).unwrap_or(([0.28, 0.64, 1.0], [0.92, 0.92, 0.92], [0.53, 0.58, 0.68], [0.5, 0.5], 1.0));
        gl.uniform_3_f32(p.u(U::Top), top[0], top[1], top[2]); gl.uniform_3_f32(p.u(U::Mid), mid[0], mid[1], mid[2]); gl.uniform_3_f32(p.u(U::Bot), bot[0], bot[1], bot[2]);
        gl.uniform_2_f32(p.u(U::Exp), ex[0], ex[1]); gl.uniform_1_f32(p.u(U::CieloK), k);
        gl.uniform_1_f32(p.u(U::Sombra), if self.op.sombras && self.sombra.is_some() { 1.0 } else { 0.0 });
        gl.uniform_1_f32(p.u(U::Clip), clip);
        gl.uniform_2_f32(p.u(U::Sesgo), self.sesgo[0], self.sesgo[1]); gl.uniform_2_f32(p.u(U::Sesgo2), self.sesgo2[0], self.sesgo2[1]);
        if let Some((_, t, _)) = &self.sombra { gl.active_texture(glow::TEXTURE2); gl.bind_texture(glow::TEXTURE_2D, Some(*t)); }
        if p.u(U::LN).is_some() {
            let (nl, ne) = (c.luces.len().min(MAX_LUCES), c.esp.len().min(MAX_LUCES - c.luces.len().min(MAX_LUCES)));
            let mut a = [[0f32; 4 * MAX_LUCES]; 3];
            for (i, q) in c.luces.iter().take(nl).chain(c.esp.iter().take(ne)).enumerate() { for k in 0..3 { a[k][i * 4..i * 4 + 4].copy_from_slice(&q[k * 4..k * 4 + 4]); } }
            gl.uniform_4_f32_slice(p.u(U::LP), &a[0]); gl.uniform_4_f32_slice(p.u(U::LC), &a[1]); gl.uniform_4_f32_slice(p.u(U::LD), &a[2]);
            gl.uniform_1_i32(p.u(U::LN), (nl + ne) as i32); gl.uniform_1_i32(p.u(U::LE), nl as i32);
        }
    }

    unsafe fn cielo(&self, vp: &M4) {
        let gl = &self.gl; let p = &self.p_cielo; let s = self.sol(); let l = &self.c.as_ref().unwrap().luz;
        gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u(U::IVP), false, &mat::inv(vp));
        gl.uniform_3_f32(p.u(U::Sol), s[0], s[1], s[2]); gl.uniform_3_f32(p.u(U::NieC), l.nie.c[0], l.nie.c[1], l.nie.c[2]); gl.uniform_1_f32(p.u(U::Expo), l.expo);
        match &self.cielo {
            Some(c) => {
                let cubo = c.cubo != 0 && self.cubo.is_some();
                gl.uniform_1_i32(p.u(U::TieneCubo), if cubo { 2 } else { 1 });
                gl.uniform_3_f32(p.u(U::Top), c.top[0], c.top[1], c.top[2]); gl.uniform_3_f32(p.u(U::Mid), c.mid[0], c.mid[1], c.mid[2]); gl.uniform_3_f32(p.u(U::Bot), c.bot[0], c.bot[1], c.bot[2]);
                gl.uniform_2_f32(p.u(U::Exp), c.exp[0], c.exp[1]); gl.uniform_3_f32(p.u(U::Tinte), c.tinte[0], c.tinte[1], c.tinte[2]); gl.uniform_1_f32(p.u(U::Dia), c.dia); gl.uniform_1_f32(p.u(U::CieloK), c.k);
                if cubo { gl.active_texture(glow::TEXTURE8); gl.bind_texture(glow::TEXTURE_CUBE_MAP, self.cubo); gl.active_texture(glow::TEXTURE0); }
            }
            None => gl.uniform_1_i32(p.u(U::TieneCubo), 0),
        }
        gl.depth_mask(false); gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3); gl.depth_mask(true);
    }

    /// lo opaco que se ve con otra matriz (el reflejo, la sombra), con y sin huesos
    fn recortar(&self, vp: &M4, sombra: bool) -> Vec<usize> {
        let pl = mat::planos(vp);
        let mut v: Vec<usize> = self.items.iter().enumerate().filter(|(_, it)| {
            let (Some(_), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { return false };
            mt.agua == 0 && mt.blend == 0 && mt.add == 0 && !(sombra && it.fl & FL_SIN_SOMBRA != 0) && mat::esfera_dentro(&pl, &it.esf)
        }).map(|(i, _)| i).collect();
        v.sort_by_key(|&i| { let it = &self.items[i]; (!it.h.is_empty() && self.mallas[&it.m].piel, self.mats[&it.mat].t, it.m, it.s0, it.mat) });
        v
    }
    /// dibuja una lista de lo opaco con el programa de luz (o el de sombra), cambiando al de huesos cuando toca
    unsafe fn dibujar_lista(&self, lista: &[usize], vp: &M4, clip: f32, de_sombra: bool) -> u32 {
        // (las copias de una misma cosa —la misma malla, parte y material, sin huesos— van juntas en la lista: de a 2 o más,
        // un solo dibujo con instancias; sus matrices, todas en un búfer)
        let mismo = |a: &ItemDin, b: &ItemDin| a.m == b.m && a.s0 == b.s0 && a.sn == b.sn && a.mat == b.mat && a.h.is_empty() && b.h.is_empty();
        let mut grupos: Vec<(usize, usize)> = Vec::new(); let mut mats: Vec<f32> = Vec::new();
        let mut k = 0;
        while k < lista.len() {
            let a = &self.items[lista[k]]; let mut e = k + 1;
            while self.instancias && e < lista.len() && mismo(a, &self.items[lista[e]]) { e += 1; }
            if e - k >= 2 { for &i in &lista[k..e] { mats.extend_from_slice(&self.items[i].mm); } }
            grupos.push((k, e)); k = e;
        }
        if !mats.is_empty() { let gl = &self.gl; gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.inst_buf)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32_bytes(&mats), glow::STREAM_DRAW); }
        let mut act: Option<u8> = None; let mut base = 0usize; let mut dibujos = 0;
        for (k, e) in grupos {
            let it = &self.items[lista[k]]; let n = e - k;
            let piel = !it.h.is_empty() && self.mallas.get(&it.m).map(|m| m.piel).unwrap_or(false);
            let tipo: u8 = if n >= 2 { 2 } else if piel { 1 } else { 0 };
            let p = match (de_sombra, tipo) { (false, 0) => &self.p_luz, (false, 1) => &self.p_luz_piel, (false, _) => &self.p_luz_inst, (true, 0) => &self.p_sombra, (true, 1) => &self.p_sombra_piel, (true, _) => &self.p_sombra_inst };
            if act != Some(tipo) {
                act = Some(tipo);
                if de_sombra { self.gl.use_program(Some(p.p)); self.gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp); }
                else { self.luces(p, vp, clip); }
            }
            if n >= 2 {
                // (el búfer de instancias, corrido a las matrices de este grupo)
                let gl = &self.gl; let Some(m) = self.mallas.get(&it.m) else { base += n; continue };
                gl.bind_vertex_array(Some(m.vao)); gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.inst_buf));
                for j in 0..4u32 { gl.enable_vertex_attrib_array(6 + j); gl.vertex_attrib_pointer_f32(6 + j, 4, glow::FLOAT, false, 64, (base * 64 + j as usize * 16) as i32); gl.vertex_attrib_divisor(6 + j, 1); }
                self.dibujar_n(p, it, !de_sombra, n as i32);
                base += n;
            } else { self.dibujar_item(p, it, !de_sombra); }
            dibujos += 1;
        }
        dibujos
    }

    /// la sombra del sol: dos mapas de profundidad ortográficos (cascadas) en una sola textura, uno al lado del otro: el de
    /// cerca (un cuarto del radio, delante de la cámara: ~1 cm por píxel con 2048) y el de lejos (todo el radio), con lo opaco
    unsafe fn pasada_sombra(&mut self) {
        let px = self.op.sombra_px;
        if self.sombra.as_ref().map(|s| s.2 != px).unwrap_or(true) {
            if let Some((f, t, _)) = self.sombra.take() { self.gl.delete_framebuffer(f); self.gl.delete_texture(t); }
            let gl = &self.gl;
            let t = gl.create_texture().unwrap(); gl.bind_texture(glow::TEXTURE_2D, Some(t));
            gl.tex_storage_2d(glow::TEXTURE_2D, 1, glow::DEPTH_COMPONENT24, px * 2, px);
            gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MAG_FILTER, glow::LINEAR as i32);
            gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_COMPARE_MODE, glow::COMPARE_REF_TO_TEXTURE as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_COMPARE_FUNC, glow::LEQUAL as i32);
            gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE as i32);
            let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f));
            gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::TEXTURE_2D, Some(t), 0);
            gl.draw_buffers(&[glow::NONE]);
            self.sombra = Some((f, t, px));
        }
        let (svp0, ses0) = self.cascada(0); let (svp1, ses1) = self.cascada(1);
        self.svp = svp0; self.sesgo = ses0; self.svp2 = svp1; self.sesgo2 = ses1;
        let l0 = self.recortar(&svp0, true); let l1 = self.recortar(&svp1, true);
        if self.dbg && self.cuadro == 0 {
            let piel: Vec<_> = self.items.iter().filter(|it| !it.h.is_empty()).map(|it| (it.m, it.esf, it.fl, it.h.len())).collect();
            eprintln!("sombra: {} + {} cosas, {} con huesos · {:?}", l0.len(), l1.len(), piel.len(), &piel[..piel.len().min(6)]);
        }
        let (f, _, _) = *self.sombra.as_ref().unwrap();
        { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.viewport(0, 0, px * 2, px); gl.clear(glow::DEPTH_BUFFER_BIT); gl.enable(glow::POLYGON_OFFSET_FILL); gl.polygon_offset(1.5, 3.0); }
        self.gl.viewport(0, 0, px, px); self.dibujos += self.dibujar_lista(&l0, &svp0, -1e9, true);
        self.gl.viewport(px, 0, px, px); self.dibujos += self.dibujar_lista(&l1, &svp1, -1e9, true);
        self.gl.disable(glow::POLYGON_OFFSET_FILL);
    }
    fn cascada(&self, k: usize) -> (M4, [f32; 2]) { cascada(self.c.as_ref().unwrap(), self.sol(), &self.op, k) }

    /// el reflejo del agua: la escena espejada en el plano del agua, a una fracción de la resolución
    unsafe fn pasada_reflejo(&mut self, w: i32, h: i32, ay: f32) {
        let (rw, rh) = ((w / self.op.reflejo_div).max(16), (h / self.op.reflejo_div).max(16));
        if self.reflejo.as_ref().map(|d| d.w != rw || d.h != rh).unwrap_or(true) { if let Some(d) = self.reflejo.take() { borrar_destino(&self.gl, d); } self.reflejo = Some(destino(&self.gl, rw, rh)); }
        let vp = mat::mul(&self.c.as_ref().unwrap().vp, &mat::espejo_y(ay));
        let lista = self.recortar(&vp, false);
        { let gl = &self.gl; let d = self.reflejo.as_ref().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(d.fb)); gl.viewport(0, 0, d.w, d.h); gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT); }
        self.cielo(&vp);
        self.dibujos += self.dibujar_lista(&lista, &vp, ay - 0.05, false);
        self.gl.invalidate_framebuffer(glow::FRAMEBUFFER, &[glow::DEPTH_ATTACHMENT]);
    }

    /// las partículas del cuadro: primero las de alfa (de lejos a cerca, ya ordenadas por el juego) y después las que suman
    unsafe fn particulas(&mut self, vp: &M4) {
        let Some(c) = self.c.as_ref() else { return };
        let bloques: Vec<&(u32, Vec<f32>)> = c.efectos.iter().filter(|e| (e.0 == EF_PART_ALFA || e.0 == EF_PART_SUMA) && e.1.len() > 6).collect();
        if bloques.is_empty() { return; }
        let gl = &self.gl; let p = &self.p_part; let cp = c.pos;
        gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp); gl.uniform_3_f32(p.u(U::Cam), cp[0], cp[1], cp[2]);
        gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(self.texs.get(&TEX_ATLAS).map(|t| t.t).unwrap_or(self.blanca)));
        gl.bind_vertex_array(Some(self.part.0)); gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.part.1));
        gl.enable(glow::BLEND); gl.depth_mask(false);
        let mut n = 0;
        for (t, d) in bloques {
            // (los 6 primeros: la derecha y el arriba de la cámara, para girar los carteles hacia ella)
            gl.uniform_3_f32(p.u(U::Der), d[0], d[1], d[2]); gl.uniform_3_f32(p.u(U::Arr), d[3], d[4], d[5]);
            gl.blend_func(glow::SRC_ALPHA, if *t == EF_PART_SUMA { glow::ONE } else { glow::ONE_MINUS_SRC_ALPHA });
            gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32_bytes(&d[6..]), glow::STREAM_DRAW);
            gl.draw_arrays_instanced(glow::TRIANGLES, 0, 6, ((d.len() - 6) / 16) as i32); n += 1;
        }
        gl.depth_mask(true); gl.disable(glow::BLEND); gl.bind_vertex_array(None);
        self.dibujos += n;
    }

    /// la oclusión ambiental: a media resolución desde la profundidad de lo opaco, y multiplicada sobre la escena
    unsafe fn pasada_ao(&mut self, ew: i32, eh: i32, vp: &M4) {
        let (aw, ah) = ((ew / 2).max(8), (eh / 2).max(8));
        if self.ao_rt.as_ref().map(|d| d.w != aw || d.h != ah).unwrap_or(true) { if let Some(d) = self.ao_rt.take() { borrar_destino(&self.gl, d); } self.ao_rt = Some(destino(&self.gl, aw, ah)); }
        let (Some(esc), Some(ao)) = (self.escena_rt.as_ref(), self.ao_rt.as_ref()) else { return };
        let Some(prof) = esc.prof_t else { return };
        let gl = &self.gl; let cp = self.c.as_ref().unwrap().pos;
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(ao.fb)); gl.viewport(0, 0, aw, ah);
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false);
        let p = &self.p_ao; gl.use_program(Some(p.p));
        gl.uniform_matrix_4_f32_slice(p.u(U::IVP), false, &mat::inv(vp)); gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp);
        gl.uniform_3_f32(p.u(U::Cam), cp[0], cp[1], cp[2]); gl.uniform_1_f32(p.u(U::Radio), 0.7);
        gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, Some(prof));
        gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, None);
        // sobre la escena: color × oclusión (suavizada con 4 muestras)
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(esc.fb)); gl.viewport(0, 0, ew, eh);
        gl.enable(glow::BLEND); gl.blend_func(glow::ZERO, glow::SRC_COLOR);
        let q = &self.p_ao_poner; gl.use_program(Some(q.p));
        gl.uniform_2_f32(q.u(U::Inv), 0.75 / aw as f32, 0.75 / ah as f32); gl.uniform_1_f32(q.u(U::Fuerza), self.op.ao_fuerza);
        gl.active_texture(glow::TEXTURE10); gl.bind_texture(glow::TEXTURE_2D, Some(ao.color));
        gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.active_texture(glow::TEXTURE0);
        gl.disable(glow::BLEND); gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        self.dibujos += 2;
    }

    /// un cuadro entero, en el destino `salida` (None = el de la superficie) de w × h
    pub unsafe fn dibujar(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32) {
        self.dibujos = 0;
        if self.c.is_none() { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(0, 0, w, h); gl.clear_color(0.0, 0.0, 0.0, 1.0); gl.clear(glow::COLOR_BUFFER_BIT); return; }
        { let gl = &self.gl; gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::LEQUAL); gl.disable(glow::BLEND); gl.disable(glow::CULL_FACE); }
        if self.op.sombras && (self.sombra.is_none() || self.cuadro % self.op.sombra_cada.max(1) as u64 == 0) { self.pasada_sombra(); }
        let ay = self.c.as_ref().unwrap().agua_y.or(self.agua.as_ref().map(|a| a.y));
        let hay_agua = !self.aguas.is_empty() && self.agua.is_some() && self.agua_n.is_some() && !self.sin_agua;
        let cam_arriba = ay.map(|y| self.c.as_ref().unwrap().pos[1] > y + 0.05).unwrap_or(false);
        if hay_agua && self.op.reflejo && cam_arriba && (self.reflejo.is_none() || self.cuadro % self.op.reflejo_cada.max(1) as u64 == 0) { self.pasada_reflejo(w, h, ay.unwrap()); }
        // la escena, a la resolución elegida
        let (ew, eh) = (((w as f32) * self.op.escala).round().max(16.0) as i32, ((h as f32) * self.op.escala).round().max(16.0) as i32);
        let con_ao = self.op.ao;
        if self.escena_rt.as_ref().map(|d| d.w != ew || d.h != eh || d.prof_t.is_some() != con_ao).unwrap_or(true) { if let Some(d) = self.escena_rt.take() { borrar_destino(&self.gl, d); } self.escena_rt = Some(destino_con(&self.gl, ew, eh, con_ao)); }
        let fb = self.escena_rt.as_ref().unwrap().fb;
        { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.viewport(0, 0, ew, eh); gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT); }
        let vp = self.c.as_ref().unwrap().vp;
        self.cielo(&vp);
        self.dibujos += self.dibujar_lista(&self.opacos, &vp, -1e9, false);
        if con_ao { self.pasada_ao(ew, eh, &vp); }
        if self.marcas.2 > 0 {
            // las marcas de frenada: apenas despegadas del piso, mezcladas y sin escribir profundidad
            let gl = &self.gl; let p = &self.p_lin; gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, &vp);
            gl.enable(glow::BLEND); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); gl.depth_mask(false);
            gl.enable(glow::POLYGON_OFFSET_FILL); gl.polygon_offset(-2.0, -4.0);
            gl.bind_vertex_array(Some(self.marcas.0)); gl.draw_arrays(glow::TRIANGLES, 0, self.marcas.2);
            gl.disable(glow::POLYGON_OFFSET_FILL); gl.depth_mask(true); gl.disable(glow::BLEND); self.dibujos += 1;
        }
        // lo transparente y el agua, mezclados y sin escribir profundidad
        { let gl = &self.gl; gl.enable(glow::BLEND); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); gl.depth_mask(false); }
        let mut act: Option<bool> = None;
        for &i in &self.transp {
            let it = &self.items[i]; let piel = !it.h.is_empty() && self.mallas[&it.m].piel; let p = if piel { &self.p_luz_piel } else { &self.p_luz };
            if act != Some(piel) { act = Some(piel); self.luces(p, &vp, -1e9); }
            let add = self.mats[&it.mat].add != 0;
            if add { self.gl.blend_func(glow::SRC_ALPHA, glow::ONE); }
            self.dibujar_item(p, it, true); self.dibujos += 1;
            if add { self.gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); }
        }
        if hay_agua {
            // la escena hasta acá (lo opaco y lo transparente), copiada: el agua la ve a través de sí, corrida por las olas
            if self.refr_rt.as_ref().map(|d| d.w != ew || d.h != eh).unwrap_or(true) { if let Some(d) = self.refr_rt.take() { borrar_destino(&self.gl, d); } self.refr_rt = Some(destino_con(&self.gl, ew, eh, true)); }
            { let gl = &self.gl; let r = self.refr_rt.as_ref().unwrap();
              gl.bind_framebuffer(glow::READ_FRAMEBUFFER, Some(fb)); gl.bind_framebuffer(glow::DRAW_FRAMEBUFFER, Some(r.fb));
              gl.blit_framebuffer(0, 0, ew, eh, 0, 0, ew, eh, glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT, glow::NEAREST);
              gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); }
            let a = self.agua.as_ref().unwrap(); let p = &self.p_agua;
            self.luces(p, &vp, -1e9);
            let gl = &self.gl;
            gl.uniform_4_f32(p.u(U::F), a.fog[0], a.fog[1], a.fog[2], a.fog[3]);
            let refl_on = self.op.reflejo && cam_arriba && self.reflejo.is_some();
            gl.uniform_4_f32(p.u(U::H), a.esc, a.fuerza, a.dist, if refl_on { 1.0 } else { 0.0 });
            gl.uniform_4_f32(p.u(U::S), a.s[0], a.s[1], a.s[2], a.s[3]);
            let (bx, bz, bw, bh, bd) = a.prof.as_ref().map(|q| (q.x0, q.z0, 1.0 / q.w, 1.0 / q.h, q.d)).unwrap_or((0.0, 0.0, 0.0, 0.0, 20.0));
            gl.uniform_4_f32(p.u(U::Bq), bx, bz, bw, bh); gl.uniform_2_f32(p.u(U::D), bd, a.largo.max(0.5));
            let t = self.c.as_ref().unwrap().tiempo; let t = if t > 0.0 { t } else { self.cuadro as f32 / 60.0 };
            gl.uniform_2_f32(p.u(U::RefInv), 1.0 / ew as f32, 1.0 / eh as f32); gl.uniform_1_f32(p.u(U::Tiempo), t);
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, self.agua_n);
            if let Some(r) = &self.reflejo { gl.active_texture(glow::TEXTURE3); gl.bind_texture(glow::TEXTURE_2D, Some(r.color)); }
            gl.active_texture(glow::TEXTURE4); gl.bind_texture(glow::TEXTURE_2D, Some(self.agua_p.unwrap_or(self.blanca)));
            gl.uniform_1_f32(p.u(U::RefrOn), if cam_arriba { 1.0 } else { 0.0 });
            gl.uniform_1_f32(p.u(U::RefrK), a.refr);
            if let Some(r) = &self.refr_rt { gl.active_texture(glow::TEXTURE12); gl.bind_texture(glow::TEXTURE_2D, Some(r.color)); gl.active_texture(glow::TEXTURE13); gl.bind_texture(glow::TEXTURE_2D, r.prof_t); }
            for &i in &self.aguas {
                let it = &self.items[i]; let m = &self.mallas[&it.m];
                gl.bind_vertex_array(Some(m.vao)); gl.uniform_matrix_4_f32_slice(p.u(U::M), false, &it.mm);
                gl.uniform_3_f32(p.u(U::Mn), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u(U::Sc), m.sc[0], m.sc[1], m.sc[2]); gl.uniform_4_f32(p.u(U::St), 1.0, 1.0, 0.0, 0.0);
                gl.draw_elements(glow::TRIANGLES, it.sn as i32, if m.i32 { glow::UNSIGNED_INT } else { glow::UNSIGNED_SHORT }, (it.s0 * if m.i32 { 4 } else { 2 }) as i32);
                self.dibujos += 1;
            }
        }
        self.particulas(&vp);
        let gl = &self.gl;
        gl.depth_mask(true); gl.disable(glow::BLEND);
        // (la profundidad de la escena ya no se usa: la placa no la guarda en la memoria —en los celulares, por mosaicos, se ahorra
        // escribirla entera en cada cuadro—)
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.invalidate_framebuffer(glow::FRAMEBUFFER, &[glow::DEPTH_ATTACHMENT]);
        // a la pantalla, estirada (la escena a menos píxeles) y con el retoque final; lo de antes en la pantalla no se lee (se pinta
        // entera) y su profundidad no se usa
        let col = self.escena_rt.as_ref().unwrap().color;
        gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(0, 0, w, h);
        let todo: &[u32] = if salida.is_none() { &[glow::COLOR, glow::DEPTH, glow::STENCIL] } else { &[glow::COLOR_ATTACHMENT0, glow::DEPTH_ATTACHMENT] };
        gl.invalidate_framebuffer(glow::FRAMEBUFFER, todo);
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false);
        let p = &self.p_final; gl.use_program(Some(p.p)); gl.uniform_1_f32(p.u(U::Retoque), if self.op.retoque { 1.0 } else { 0.0 });
        gl.active_texture(glow::TEXTURE11); gl.bind_texture(glow::TEXTURE_2D, Some(col));
        gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.bind_texture(glow::TEXTURE_2D, None); gl.active_texture(glow::TEXTURE0);
        gl.invalidate_framebuffer(glow::FRAMEBUFFER, &todo[1..]);
        gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        self.cuadro += 1;
    }

    /// la interfaz encima de la imagen (después de `dibujar`): rectángulos en píxeles con la textura `tex` (el atlas de las
    /// letras: su cuadrado blanco sirve para los rectángulos lisos)
    pub unsafe fn ui(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32, tex: i64, v: &[f32]) {
        if v.len() < 24 { return; }
        let gl = &self.gl;
        gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(0, 0, w, h);
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false); gl.enable(glow::BLEND); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA);
        let p = &self.p_ui; gl.use_program(Some(p.p)); gl.uniform_2_f32(p.u(U::Inv), 1.0 / w as f32, 1.0 / h as f32);
        gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(self.texs.get(&tex).map(|t| t.t).unwrap_or(self.blanca)));
        gl.bind_vertex_array(Some(self.ui.0)); gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.ui.1));
        gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32_bytes(v), glow::STREAM_DRAW);
        gl.draw_arrays(glow::TRIANGLES, 0, (v.len() / 8) as i32);
        gl.bind_vertex_array(None); gl.disable(glow::BLEND); gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        self.dibujos += 1;
    }

    pub fn resumen(&self) -> String {
        let n = self.items.len();
        format!("mapa {} · {} mallas · {} texturas · {} luces horneadas · {} materiales · {:.1} MB en la placa · {} cosas en el cuadro ({} opacas, {} transparentes, {} de agua a la vista)",
            self.mapa, self.mallas.len(), self.texs.len(), self.lms.len(), self.mats.len(), self.memoria as f64 / 1e6, n, self.opacos.len(), self.transp.len(), self.aguas.len())
    }
}

/// los floats como bytes (para subirlos a la placa)
fn f32_bytes(d: &[f32]) -> &[u8] { unsafe { std::slice::from_raw_parts(d.as_ptr() as *const u8, d.len() * 4) } }

unsafe fn borrar_malla(gl: &glow::Context, m: MallaGL) { gl.delete_vertex_array(m.vao); for b in m.bufs { gl.delete_buffer(b); } }


/// la matriz y los sesgos de una cascada de la sombra del sol (0: la de cerca —un cuarto del radio, corrida hacia donde mira
/// la cámara—, 1: la de lejos —todo el radio—): ortográfica, en pasos de un píxel de la sombra para que no tiemble. La usan
/// los tres motores
pub fn cascada(c: &crate::escena::Cuadro, s: [f32; 3], op: &Opciones, k: usize) -> (M4, [f32; 2]) {
    let px = op.sombra_px;
    let r = if k == 0 { op.sombra_radio * 0.25 } else { op.sombra_radio };
    // (la fila de w de la matriz de la cámara es para adelante)
    let mut c0 = c.pos;
    if k == 0 { let f = mat::norm([c.vp[3], c.vp[7], c.vp[11]]); for i in 0..3 { c0[i] += f[i] * r * 0.6; } }
    let paso = 2.0 * r / px as f32; let cen = [(c0[0] / paso).round() * paso, (c0[1] / paso).round() * paso, (c0[2] / paso).round() * paso];
    // (lo que hay entre el sol y la caja, hasta 80 m más arriba, también tapa; el margen de profundidad, en metros)
    let alto = r + 80.0; let rango = alto + r;
    let ojo = [cen[0] + s[0] * alto, cen[1] + s[1] * alto, cen[2] + s[2] * alto];
    let arriba = if s[1].abs() > 0.95 { [0.0, 0.0, 1.0] } else { [0.0, 1.0, 0.0] };
    (mat::mul(&mat::orto(-r, r, -r, r, 0.5, rango), &mat::mirar(ojo, cen, arriba)), [0.04 / rango, 1.5 * paso])
}
