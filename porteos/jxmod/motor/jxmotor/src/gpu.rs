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
use crate::escena::{FL_ARMA, Agua, Cielo, Cuadro, Escena, ItemDin, Mat, FL_CIELO, FL_SIN_SOMBRA, EF_GI, EF_GI_DATOS, EF_MARCAS, EF_ONDAS, EF_PART_ALFA, EF_PART_SUMA, EF_FLUIDO, FLU_CAB, FLU_POR, EF_OLAS};
use crate::mat::{self, M4};
use glow::HasContext;
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct Opciones {
    /// fracción del tamaño de la pantalla a la que se dibuja la escena (0,5 = la cuarta parte de los píxeles)
    pub escala: f32,
    pub sombras: bool, pub sombra_px: i32, pub sombra_cada: u32, pub sombra_radio: f32,
    /// cuántas cascadas de sombra: 2 (cerca fina + lejos) o 1 —como Hyper Sandbox: un solo mapa centrado en la cámara que
    /// cubre todo el radio; la mitad de dibujo de sombras—
    pub cascadas: u8,
    /// el cielo Frutiger Aero propio en lugar del del mapa (FRUTIGER_GLSL)
    pub cielo_frutiger: bool,
    pub reflejo: bool, pub reflejo_div: i32, pub reflejo_cada: u32,
    /// la vista que se acostumbra (exposición automática): al entrar a la sombra todo se aclara de a poco; al salir, encandila y
    /// se acomoda
    pub adapta: bool,
    /// oclusión ambiental (lo pegado a paredes y rincones, más oscuro), a media resolución
    pub ao: bool, pub ao_fuerza: f32,
    /// el retoque final de WebGL en Alto: más color, contraste en S y viñeta
    pub retoque: bool,
    /// la pasada de profundidad antes de la de luz (cada píxel se ilumina una vez)
    pub prepaso: bool,
    /// los rayos del sol (Ultra): entre lo que tapa el cielo, hacia el sol de la pantalla
    pub rayos: bool,
    /// el hongo de las nucleares con volumen (hongo.rs): la calidad del juego (0: con carteles)
    pub hongo: u8,
    /// Definitivo (arriba de Ultra): el cielo con nubes y el disco del sol, el resplandor, el color de película y la luz en
    /// el aire a media resolución con más pasos
    pub aaa: bool,
    /// los cuadros intermedios (JX Turbo): guardar lo necesario —la profundidad de la escena— para armar un cuadro corriendo
    /// el último a la cámara nueva sin volver a dibujar el mundo (`intermedio`)
    pub turbo: bool,
    /// la reconstrucción temporal: con la escena a menos píxeles que la pantalla, juntar varios cuadros corridos (pasada_taa)
    pub taa: bool,
    /// el gráfico Simple: el sombreado de luz sin lo caro (FS_LUZ con SIMPLE)
    pub simple: bool,
}
impl Default for Opciones {
    fn default() -> Self { Opciones { escala: 1.0, sombras: true, sombra_px: 2048, sombra_cada: 1, sombra_radio: 45.0, cascadas: 2, cielo_frutiger: false, reflejo: true, reflejo_div: 2, reflejo_cada: 1, adapta: true, ao: true, ao_fuerza: 0.6, retoque: true, prepaso: true, rayos: false, hongo: 3, aaa: false, turbo: false, taa: false, simple: false } }
}
impl Opciones {
    /// lo que se elige para un celular de 1 GB con una placa floja: dos tercios de la resolución, sombra de 1024 cada 2
    /// cuadros y reflejo a un cuarto cada 2
    pub fn celular_flojo() -> Self { Opciones { escala: 0.67, sombras: true, sombra_px: 1024, sombra_cada: 2, sombra_radio: 35.0, cascadas: 2, cielo_frutiger: false, reflejo: true, reflejo_div: 4, reflejo_cada: 2, adapta: true, ao: false, ao_fuerza: 0.6, retoque: true, prepaso: true, rayos: false, hongo: 3, aaa: false, turbo: false, taa: false, simple: false } }
}

struct MallaGL { vao: glow::VertexArray, bufs: Vec<glow::Buffer>, i32: bool, mn: [f32; 3], sc: [f32; 3], lm: i64, piel: bool, bytes: usize }
struct TexGL { t: glow::Texture, bytes: usize }
struct Destino { fb: glow::Framebuffer, color: glow::Texture, prof: Option<glow::Renderbuffer>, prof_t: Option<glow::Texture>, w: i32, h: i32 }

// los uniformes, por número (buscarlos por nombre en cada dibujo cuesta)
#[derive(Clone, Copy)]
enum U { Mat, NieS, Sesgo, VP, M, SVP, Mn, Sc, St, C, Em, Modo, S1, S3, Sol, SolC, AmbS, AmbG, NieC, Nie, Cam, Expo, Sombra, Clip, B, LP, LC, LD, LN, LE, F, H, S, Bq, D, RefInv, Tiempo, Top, Mid, Bot, Exp, Tinte, Dia, CieloK, TieneCubo, Radio, Inv, Fuerza, Retoque, Der, Arr, RefrOn, RefrK, IVP, SVP2, Sesgo2, Ti, Ti2, Ti3, AOk, NC, Ray0, RayX, RayY, Zl, RayP, RayK, Vol, Nubes, BloomK, RP, Adapta, Caus, CausB, Ond, OndN, GIo, GIn, Corte, Ma }
const NU: usize = U::Ma as usize + 1;
const NOMBRES: [&str; NU] = ["uMat", "uNieS", "uSesgo", "uVP", "uM", "uSVP", "uMn", "uSc", "uSt", "uC", "uEm", "uModo", "uS1", "uS3", "uSol", "uSolC", "uAmbS", "uAmbG", "uNieC", "uNie", "uCam", "uExpo", "uSombra", "uClip", "uB", "uLP", "uLC", "uLD", "uLN", "uLE", "uF", "uH", "uS", "uBq", "uD", "uRefInv", "uTiempo", "uTop", "uMid", "uBot", "uExp", "uTinte", "uDia", "uCieloK", "uTieneCubo", "uRadio", "uInv", "uFuerza", "uRetoque", "uDer", "uArr", "uRefrOn", "uRefrK", "uIVP", "uSVP2", "uSesgo2", "uTi", "uTi2", "uTi3", "uAOk", "uNC", "uRay0", "uRayX", "uRayY", "uZl", "uRayP", "uRayK", "uVol", "uNubes", "uBloomK", "uRP", "uAdapta", "uCaus", "uCausB", "uOnd", "uOndN", "uGIo", "uGIn", "uCorte", "uMa"];
struct Prog { p: glow::Program, u: Vec<Option<glow::UniformLocation>>, piel: bool, corte: bool }
#[derive(Default)]
struct Puesto3 { vao: Option<glow::VertexArray>, unidad: Option<u32>, tex: [Option<glow::Texture>; 8], mat: HashMap<glow::Program, (i64, i32)>, pos: HashMap<glow::Program, ([f32; 3], [f32; 3])>, mm: HashMap<glow::Program, [f32; 16]> }
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
out vec3 vW; out vec3 vN; out vec2 vU; out vec2 vL; out float vMz;
#ifndef SOMBRA_PX
out vec3 vS; out vec3 vS2;
#endif
invariant gl_Position;
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
#ifndef SOMBRA_PX
  vec3 nn = normalize(vN + vec3(1e-6));
  // (las matrices de la sombra son ortográficas —w siempre 1— y vienen ya llevadas de −1..1 a 0..1: sin dividir ni corregir
  // en cada píxel, y dos números menos por cascada para repartir)
  vS = (uSVP * vec4(w.xyz + nn * uSesgo.y, 1.0)).xyz; vS2 = (uSVP2 * vec4(w.xyz + nn * uSesgo2.y, 1.0)).xyz;
#endif
  gl_Position = uVP * w;
}"#;
const FS_LUZ: &str = r#"#version 300 es
precision highp float; precision highp sampler2DShadow;
// el sombreado de WebGL (gl.js, LUZ 3, salida LDR): la luz en lineal, el BRDF con la rugosidad y el metal de cada material,
// el reflejo del cielo, las luces puntuales y especiales, la luz horneada, la niebla con el sol y ACES
uniform sampler2D uT, uLM, uT1, uT2, uT3; uniform vec4 uS1; uniform vec2 uS3; uniform sampler2DShadow uSM;
uniform vec4 uC, uTi, uTi2, uTi3; uniform vec3 uSol, uSolC, uAmbS, uAmbG, uNieC, uNieS, uCam, uEm, uMat, uNie; uniform vec2 uSesgo, uSesgo2; uniform float uExpo, uSombra, uClip; uniform int uModo;
uniform vec3 uTop, uMid, uBot; uniform vec2 uExp; uniform float uCieloK; uniform vec4 uNubes;
uniform vec4 uLP[12], uLC[12], uLD[12]; uniform int uLN, uLE;
// la oclusión ambiental (calculada antes, de la pasada de profundidad): x, y el paso de un píxel de la escena; z la fuerza
uniform sampler2D uAO; uniform vec4 uAOk;
in vec3 vW; in vec3 vN; in vec2 vU; in vec2 vL; in float vMz; out vec4 o;
#ifdef SOMBRA_PX
// (las coordenadas de la sombra en cada píxel, del punto y la normal: con triángulos chicos —una ciudad lejos— repartir seis
// números más por triángulo cuesta más que dos productos por píxel)
uniform mat4 uSVP, uSVP2;
#else
in vec3 vS; in vec3 vS2;
#endif
const float PI = 3.14159265;
// (las cuentas de color, en media precisión —fp16, el doble de rápido en la placa del celular, como el float16 de JX Hand—;
// con tope: fp16 llega a 65504 y lo muy brillante desbordaba x²; aces(64) ya es blanco)
precision mediump float;
vec3 aces(vec3 x) { x = min(x, vec3(64.0)); return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
precision highp float;

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
// (Definitivo: la luz horneada del mapa como en un día nublado —el Ravenholm con trazado de rayos—: la mitad de su color
// pasa a un blanco frío, con el mismo brillo; el sol amarillo de muchos mapas de Source no tiñe todo de naranja)
precision mediump float;
vec3 nublado(vec3 l) { float y = dot(l, vec3(0.2126, 0.7152, 0.0722)); return mix(l, y * vec3(0.9, 1.0, 1.12), 0.5); }
precision highp float;
// (lo que está debajo del agua: la luz del sol juntada por las olas —las cáusticas, la red de rayitos que se mueve en el
// piso—. uCaus: x la altura del agua, y la fuerza, z el tiempo; uCausB: el rectángulo del agua en x y z)
uniform vec4 uCaus, uCausB;
// (Definitivo, como con trazado de rayos: el reflejo del piso —lo de arriba espejado en uRef, a media resolución—; uRP: 1/ancho
// y 1/alto de la escena, si está y la altura del piso; más fuerte cuanto más liso y cuanto más de costado se mira, borroso
// si es áspero; los pisos ásperos también, como el hormigón pulido)
uniform sampler2D uRef; uniform vec4 uRP;
// (Definitivo: la luz global —nativo/luz_global.rs—: una grilla de sondas, cada una con el cielo y el rebote de sus seis
// rumbos, en una textura de tres franjas —cielo de los costados, rebote de los costados, arriba y abajo con lo que hay hasta
// el piso—, cada franja con un
// piso al lado del otro; las que no valen ya vienen rellenas con su vecina de cada lado. uGIo: el origen y 1/paso; uGIn: nx,
// ny, nz y si está)
uniform sampler2D uGI; uniform vec4 uGIo, uGIn;
vec4 giT(float f, float y, vec3 g) { float an = uGIn.x * uGIn.y; return texture(uGI, vec2((f * an + y * uGIn.x + g.x + 0.5) / (3.0 * an), (g.z + 0.5) / uGIn.z)); }
// (para una cara con normal n: el cielo que ve —1 afuera— y el rebote que le llega, de los seis rumbos de cada sonda; cada
// rumbo pesa el cuadrado de su parte de la normal, como el cubo de ambiente de Source)
vec2 luzGlobal(vec3 p, vec3 n) {
  vec3 g = (p - uGIo.xyz) * uGIo.w - 0.5;
  if (g.x < -0.5 || g.y < -0.5 || g.z < -0.5 || g.x > uGIn.x - 0.5 || g.y > uGIn.y - 0.5 || g.z > uGIn.z - 0.5) return vec2(1.0, 0.0);
  g = clamp(g, vec3(0.0), uGIn.xyz - 1.0);
  float y0 = floor(g.y), y1 = min(y0 + 1.0, uGIn.y - 1.0), fy = g.y - y0;
  vec4 c1 = giT(2.0, y1, g);
  // (una losa entre las dos alturas de sondas —las de arriba tienen su piso a menos de un paso—: cada punto usa sólo las de
  // su lado, así lo de arriba del techo, al sol, no ilumina las paredes de abajo)
  float hs = y1 - c1.a; fy = mix(fy, smoothstep(hs - 0.07, hs + 0.07, g.y), 1.0 - smoothstep(0.85, 0.95, c1.a));
  vec4 a = mix(giT(0.0, y0, g), giT(0.0, y1, g), fy), b = mix(giT(1.0, y0, g), giT(1.0, y1, g), fy), c = mix(giT(2.0, y0, g), c1, fy);
  vec3 w = n * n;
  // (el cielo de abajo: el promedio del de los costados —lo que llega del piso de alrededor—)
  float s = w.x * (n.x > 0.0 ? a.r : a.g) + w.z * (n.z > 0.0 ? a.b : a.a) + w.y * (n.y > 0.0 ? c.r : dot(a, vec4(0.25)));
  float r = w.x * (n.x > 0.0 ? b.r : b.g) + w.z * (n.z > 0.0 ? b.b : b.a) + w.y * (n.y > 0.0 ? c.g : c.b);
  return vec2(s, r);
}
float causticas(vec2 p, float t) {
  vec2 i = p; float c = 1.0;
  for (int k = 0; k < 4; k++) { float tt = t * (1.0 - 3.5 / float(k + 1)); i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005))); }
  c = 1.17 - pow(c * 0.25, 1.4); return pow(abs(c), 8.0);
}
#ifdef CORTE
// (lo recortado —rejas, alambrados, hojas—: cerca, el borde parejo por las derivadas; de lejos, cuando los agujeros de la
// textura son más chicos que un punto de la pantalla, lo que tapa en promedio —el alfa del nivel chico— en un tramado: un
// velo como el de una reja de verdad en vez de rayas)
// (el tramado ordenado de 4×4: de lejos se lee como una malla pareja, no como ruido)
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a) + 0.03125; }
float cobertura(float a, vec2 uv) {
  vec2 ts = vec2(textureSize(uT, 0)), dx = dFdx(uv * ts), dy = dFdy(uv * ts);
  float mip = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-8));
  float filo = clamp((a - 0.5) / max(fwidth(a), 1e-4) + 0.5, 0.0, 1.0);
  return mix(filo, a, clamp(mip, 0.0, 1.0));
}
#endif
// (x^2,2 y x^(1/2,2) con tres raíces en vez de pow —logaritmo y exponencial—: el mismo color, menos de 0,2 de un nivel de
// 8 bits de diferencia; la raíz es una sola instrucción)
precision mediump float;
#ifdef DBG_POW
vec3 dec(vec3 x) { return pow(max(x, 0.0), vec3(2.2)); }
vec3 enc(vec3 x) { return pow(max(x, 0.0), vec3(1.0 / 2.2)); }
#else
vec3 dec(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return x * x * (0.73929934 * b + 0.34228227 * c - 0.0593772 * a - 0.0226474); }
vec3 enc(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return 0.93020244 * a + 0.14337668 * b - 0.02588437 * c - 0.04836126 * x; }
#endif
precision highp float;
// (una sola potencia: con ?: entre dos expresiones se calculan las dos)
vec3 cieloCol(vec3 d) { bool ar = d.y > 0.0; vec3 c = mix(uMid, ar ? uTop : uBot, pow(abs(d.y), ar ? uExp.x : uExp.y)); return dec(c) * uCieloK; }
// (el BRDF en media precisión: a² no baja del normal más chico de fp16 —si la placa lo volviera cero, 0/0 en el brillo—)
precision mediump float;
vec3 brdf(vec3 n, vec3 v, vec3 l, vec3 dif, vec3 f0, float a) {
  float nl = dot(n, l); if (nl <= 0.0) return vec3(0.0);
  vec3 h = normalize(l + v); float nh = max(dot(n, h), 0.0), nv = max(dot(n, v), 1e-3), lh = max(dot(l, h), 0.0);
  float a2 = max(a * a, 6.2e-5), d = nh * nh * (a2 - 1.0) + 1.0, D = a2 / (PI * d * d);
  float k = a * 0.5, V = 0.25 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
  float m1 = max(1.0 - lh, 0.0), m2 = m1 * m1; vec3 F = f0 + (1.0 - f0) * (m2 * m2 * m1);   // (con la luz pegada a los ojos —la linterna— lh pasa de 1 por redondeo: sin el max, NaN)
  return (dif * (1.0 - F) + min(D * V, 40.0) * F * PI) * nl;
}
precision highp float;
// la sombra en dos cascadas, una al lado de la otra en el mismo mapa: la de cerca (fina) y la de lejos; en el borde de la de
// cerca se mezclan (sin costura)
float pcf(vec3 q, float k, float b) {
  vec2 t = 1.0 / vec2(textureSize(uSM, 0)); float s = 0.0;
  float x0 = k * 0.5 + 1.5 * t.x, x1 = k * 0.5 + 0.5 - 1.5 * t.x;
  // (cuatro lecturas a medio texel: cada una compara y filtra 2 × 2 —la comparación lineal—, en total un filtro de 3 × 3
  // con pesos de carpa, como antes con nueve)
  for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++) s += texture(uSM, vec3(clamp((q.x + k) * 0.5 + (float(i) - 0.5) * t.x, x0, x1), q.y + (float(j) - 0.5) * t.y, q.z - b));
  return s * 0.25;
}
float sombra(float nd) {
  if (uSombra < 0.5) return 1.0;
#ifdef SIMPLE
  // (Simple, como el de Hyper Sandbox: sombra dura —una lectura con comparación— y sólo la cercana)
  { vec3 q = vS; if (max(abs(q.x - 0.5), abs(q.y - 0.5)) >= 0.485 || q.z >= 1.0) return 1.0;
    return texture(uSM, vec3(q.x * 0.5, q.y, q.z - uSesgo.x * (1.0 + 2.0 * (1.0 - nd)))); }
#endif
  float inc = 1.0 + 2.0 * (1.0 - nd);
#ifdef SOMBRA_PX
  vec3 nn = normalize(vN + vec3(1e-6)); vec3 q0 = (uSVP * vec4(vW + nn * uSesgo.y, 1.0)).xyz, q1 = (uSVP2 * vec4(vW + nn * uSesgo2.y, 1.0)).xyz;
#else
  vec3 q0 = vS, q1 = vS2;
#endif
  float g = max(abs(q0.x - 0.5), abs(q0.y - 0.5)) * 2.0;
  bool lejos = q1.x <= 0.0 || q1.y <= 0.0 || q1.x >= 1.0 || q1.y >= 1.0 || q1.z >= 1.0;
  if (g < 0.97 && q0.z < 1.0) {
    float s0 = pcf(q0, 0.0, uSesgo.x * inc), k = smoothstep(0.8, 0.97, g);
    return k > 0.0 && !lejos ? mix(s0, pcf(q1, 1.0, uSesgo2.x * inc), k) : s0;
  }
  return lejos ? 1.0 : pcf(q1, 1.0, uSesgo2.x * inc);
}
void main() {
#ifdef DBG_PLANO
  o = texture(uT, vU); return;
#endif
#ifdef CORTE
  if (vW.y < uClip) discard;   // (el reflejo: sólo lo de arriba del agua)
#endif
  vec4 t; float rk = 0.0, rRough = 1.0, fNie = 0.0; vec2 rOnd = vec2(0.0);
#ifdef DBG_SIN_RAMAS
  t = texture(uT, vU);
#else
  if ((uModo & 16) != 0) { vec4 kc = texture(uT, vU); t = vec4(texture(uT1, vU * uS1.xy).rgb * kc.r + texture(uT2, vU * uS1.zw).rgb * kc.g + texture(uT3, vU * uS3).rgb * kc.b, 1.0); }   // (terreno: control y tres capas)
  else if ((uModo & 8) != 0) t = mix(texture(uT, vU), texture(uT1, vU), clamp(vMz, 0.0, 1.0));   // (dos texturas mezcladas por vértice)
  else t = texture(uT, vU);
#endif
  t *= uC;
  // la pintura en dos tonos (las armas de JXMod, armasjx.js): lo gris de la textura con un color y lo de color (los
  // acentos) con otro, que además brilla; con un solo tono, el brillo de la textura de ese color (Modelo.tinte)
  vec3 emAc = vec3(0.0);
#ifdef DBG_SIN_RAMAS
  if (false) {
#else
  if (uTi2.a > 0.0) {
#endif
    float lu = dot(t.rgb, vec3(0.299, 0.587, 0.114)), sat = max(t.r, max(t.g, t.b)) - min(t.r, min(t.g, t.b));
    float kA = smoothstep(uTi3.a, uTi3.a + 0.16, sat);
    vec3 cu = mix(t.rgb, vec3(lu) * uTi.rgb, uTi.a), ac = mix(t.rgb, vec3(lu) * uTi2.rgb, uTi2.a);
    t.rgb = mix(cu, ac, kA); emAc = ac * kA * uTi3.rgb;
  } else if (uTi.a > 0.0) t.rgb = mix(t.rgb, vec3(dot(t.rgb, vec3(0.299, 0.587, 0.114))) * uTi.rgb, uTi.a);
#ifdef CORTE
  if ((uModo & 2) != 0 && cobertura(t.a, vU) <= bayer4(gl_FragCoord.xy)) discard;
#endif
  vec3 col;
  if ((uModo & 4) != 0) col = dec(t.rgb) * 1.4;   // (sin luz)
  else {
    vec3 alb = dec(t.rgb), ng = normalize(vN); if (!gl_FrontFacing) ng = -ng;
    bool fol = (uModo & 64) != 0, lm = (uModo & 1) != 0;
    vec3 n = fol ? normalize(mix(ng, vec3(0.0, 1.0, 0.0), 0.55)) : ng, v = normalize(uCam - vW);
    float rough = uMat.x, metal = uMat.y, a = max(rough * rough, 0.004), nl = dot(n, uSol), sh = 1.0;
    vec3 dif = alb * (1.0 - metal), f0 = mix(vec3(uMat.z), alb, metal), lmL = vec3(0.0);
    // (la oclusión ambiental oscurece sólo la luz que viene de todos lados —el cielo, la del mapa—: el sol y las luces, no; con
    // el suavizado de cuatro lecturas)
    float aoK = 1.0;
#ifdef DBG_SIN_AO
    if (false) {
#else
    if (uAOk.z > 0.0) {
#endif
      vec2 su = gl_FragCoord.xy * uAOk.xy, tx = 0.75 / vec2(textureSize(uAO, 0));
      aoK = mix(1.0, 0.25 * (texture(uAO, su - tx).r + texture(uAO, su + tx).r + texture(uAO, su + vec2(tx.x, -tx.y)).r + texture(uAO, su + vec2(-tx.x, tx.y)).r), uAOk.z); }
#ifdef VER_AO
    o = vec4(vec3(aoK), 1.0); return;
#endif
    if (lm) { lmL = dec(texture(uLM, vL).rgb) * 4.0; if (uNubes.x > 0.5) lmL = nublado(lmL); col = dif * lmL * aoK; }   // (la luz horneada del mapa, en vez del sol y el cielo)
#ifdef DBG_SIN_SOMBRA
    else { sh = 1.0; col = brdf(n, v, uSol, dif, f0, a) * uSolC * sh; }
#elif defined(DBG_SIN_BRDF)
    else { sh = nl > 0.0 ? sombra(max(nl, 0.0)) : 0.0; col = dif * max(nl, 0.0) * uSolC * sh; }
#else
    else { sh = nl > 0.0 ? sombra(max(nl, 0.0)) : 0.0; col = brdf(n, v, uSol, dif, f0, a) * uSolC * sh; }
#endif
    if (fol) { float tr = max(dot(-v, uSol), 0.0); tr *= tr; col += dif * uSolC * (tr * tr) * 0.6 * sh; }   // (luz que atraviesa las hojas)
#ifndef SIMPLE
    if (uCaus.y > 0.0 && vW.y < uCaus.x && vW.x > uCausB.x && vW.x < uCausB.z && vW.z > uCausB.y && vW.z < uCausB.w && uSol.y > 0.0) {
      float hondo = uCaus.x - vW.y;
      float k = causticas(vW.xz * 1.1 + uSol.xz * hondo * 0.6, uCaus.z * 0.9) * exp(-hondo * 0.18) * smoothstep(0.0, 0.35, hondo) * (0.3 + 0.7 * max(n.y, 0.0)) * uCaus.y;
      col += dif * uSolC * k * (lm ? 0.3 : 0.15 + 0.4 * sh);
    }
#endif
    // (lo plano a esa altura —la normal sin el relieve—; el relieve del material ondula el reflejo, como un piso mojado de HL2)
#ifdef SIMPLE
    if (false) {
#else
    if (uRP.z > 0.5 && ng.y > 0.94 && abs(vW.y - uRP.w) < 0.08) {
#endif
      float fr = 1.0 - max(dot(n, v), 0.0); fr *= fr; rk = smoothstep(0.82, 0.3, min(rough, 0.68)) * mix(0.3, 1.0, fr * fr); rRough = rough; rOnd = (n.xz - ng.xz) * 0.06; }
#ifndef DBG_SIN_LUCES
    for (int i = 0; i < 12; i++) {
      if (i >= uLN) break;
      vec3 L = uLP[i].xyz - vW; float d2 = dot(L, L), r = uLP[i].w;
      if (d2 > r * r) continue;
      float d = sqrt(d2); L /= d;
      bool es = i >= uLE;   // (las especiales —linternas—: caen suave y envuelven un poco)
      float dr = d / r, dr2 = dr * dr, cae = clamp(1.0 - dr2 * dr2, 0.0, 1.0); float at = es ? pow(1.0 - dr, 1.2) / (1.0 + 0.012 * d2) : cae * cae / (d2 + 1.0);
      if (uLD[i].w > -1.0) at *= smoothstep(uLD[i].w, uLD[i].w + (es && uLC[i].w > 0.0 ? uLC[i].w : 0.08), dot(-L, uLD[i].xyz));
      col += (brdf(n, v, L, dif, f0, max(a, 0.05)) + (es ? dif * 0.08 : vec3(0.0))) * uLC[i].rgb * at;
    }
#endif
    // luz del cielo: difusa (hemisferio) y reflejo (el cielo en la dirección reflejada, más borroso cuanto más áspero)
    vec3 rf = reflect(-v, n), amb, env; float nv = max(dot(n, v), 1e-3);
#ifdef DBG_SIN_CIELO
    if (lm) { amb = vec3(0.0); env = lmL * 0.5; } else { amb = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5); env = amb; }
#else
    if (lm) { amb = vec3(0.0); env = lmL * 0.5; } else { amb = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5); env = mix(cieloCol(rf), amb, clamp(rough * 1.15, 0.0, 1.0)); }
#endif
    float hor = clamp(1.0 + 1.3 * dot(rf, ng), 0.0, 1.0); env *= hor * hor;
    // (Definitivo: la luz global —adentro de una casa la luz del cielo se apaga; la del sol que entra rebota y la ilumina—)
#ifdef SIMPLE
    if (false) {
#else
    if (uGIn.w > 0.5 && !lm) {
#endif
      vec2 gi = luzGlobal(vW + ng * 0.6, ng);
      // (el cielo que ve esa cara: adentro, poco —por la puerta, la pared de enfrente—; el rebote del sol y del cielo en lo que
      // está iluminado, del color del sol, un poco más donde el cielo no llega —adentro es la luz principal—)
      amb *= mix(0.16, 1.0, gi.x); env *= mix(0.2, 1.0, gi.x);
      col += dif * uSolC * (gi.y * mix(1.7, 1.0, gi.x)); }
    float q1 = 1.0 - nv, q2 = q1 * q1; vec3 Fr = f0 + (max(vec3(1.0 - rough), f0) - f0) * (q2 * q2 * q1);
    // (la luz de todos lados un poco menos: lo que está a la sombra se nota como sombra —la vista que se acostumbra lo aclara si
    // es todo lo que se mira—)
    col += (dif * amb * 0.82 + env * Fr * mix(1.0, sh * 0.6 + 0.4, metal)) * aoK + uEm * 1.6;
  }
  col += emAc;
#ifndef DBG_SIN_NIEBLA
  // la niebla (hasta cuánto tapa, la luz del sol en ella mirando para el sol y la de lo lejos y bajo)
  float dist = max(distance(vW, uCam), 1e-3);
  float f = clamp((dist - uNie.x) / max(uNie.y - uNie.x, 0.001), 0.0, 1.0) * uNie.z;
  vec3 vd = (vW - uCam) / dist; float sd = max(dot(vd, uSol), 0.0), sd2 = sd * sd; vec3 nc = uNieC + uNieS * (sd2 * sd2 * sd2);
  // (Definitivo: más bruma de distancia, azulada como el cielo de arriba —el aire de película—)
  f = 1.0 - (1.0 - f) * exp(-max(0.0, dist - 20.0) * (0.0006 + 0.0002 * uNubes.x) * exp(-max(vW.y - uCam.y + 5.0, 0.0) * 0.02));
  if (uNubes.x > 0.5) nc = mix(nc, cieloCol(normalize(vec3(vd.x, 0.15, vd.z))), 0.25);
  col = mix(col, nc, f); fNie = f;
#endif
#ifdef DBG_SIN_GAMMA
  o = vec4(aces(col * uExpo), t.a);
#else
  vec3 fin = enc(aces(col * uExpo));
  // (el reflejo del piso: borroso según lo áspero —4 lecturas corridas—, menos donde ya tapa la niebla)
  if (rk > 0.0) { vec2 q = gl_FragCoord.xy * uRP.xy + rOnd, d2 = uRP.xy * (1.5 + 9.0 * rRough);
    vec3 r = 0.25 * (texture(uRef, q + d2).rgb + texture(uRef, q - d2).rgb + texture(uRef, q + vec2(d2.x, -d2.y)).rgb + texture(uRef, q - vec2(d2.x, -d2.y)).rgb);
    fin = mix(fin, r, rk * (1.0 - fNie)); }
  o = vec4(fin + (ign(gl_FragCoord.xy) - 0.5) / 255.0, t.a);
#endif
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
uniform sampler2D uN, uRef, uP, uRefr; uniform highp sampler2D uRefrP; uniform highp sampler2DArray uNA;
uniform vec4 uF, uH, uS, uBq; uniform vec2 uD, uRefInv; uniform float uTiempo, uExpo, uRefrOn, uRefrK, uNC;
uniform vec3 uSol, uSolC, uAmbS, uAmbG, uCam, uNieC, uNie;
// (el agua de Source tal cual su material: uModo 1, uTinte = $refracttint, uEm = $reflecttint)
uniform float uModo; uniform vec3 uTinte, uEm;
// (las olas simuladas: la pendiente del agua cerca de la cámara, olas.rs; uRayK = x0, z0, 1/lado, prendida)
uniform sampler2D uRay; uniform vec4 uRayK;
// (las ondas que dejan el jugador y lo que cae: x, z, cuándo y la fuerza)
uniform vec4 uOnd[8]; uniform float uOndN;
in vec3 vW; in vec3 vN; in vec2 vU; in vec2 vL; in vec3 vS; in float vMz; out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  float dCam = distance(vW, uCam); vec3 v = normalize(uCam - vW);
  vec2 q = vW.xz * uH.x;
  float lejos = 1.0 / (1.0 + dCam * 0.012), alfa = 1.0; vec2 d;
  if (uModo > 0.5) { d = vec2(0.0); } else if (uNC > 0.5) {
    // (como dev/water_normal de HL2: los cuadros a 30 por segundo —mezclados de a dos, sin saltos— y corridos despacio, como su
    // TextureScroll; otra lectura más grande y en otro cuadro para que no se note la repetición; el alfa, cuánto corre)
    float fa = uTiempo * 30.0, k = fract(fa), f0 = mod(floor(fa), uNC), f1 = mod(f0 + 1.0, uNC), g0 = mod(f0 + floor(uNC * 0.5), uNC), g1 = mod(g0 + 1.0, uNC);
    vec2 qa = q + uTiempo * uS.xy * 0.5, qb = q * 0.43 + vec2(0.37, 0.61) + uTiempo * uS.zw * 0.5;
    vec4 a = mix(texture(uNA, vec3(qa, f0)), texture(uNA, vec3(qa, f1)), k), b = mix(texture(uNA, vec3(qb, g0)), texture(uNA, vec3(qb, g1)), k);
    alfa = mix(a.a, b.a, 0.4); d = ((a.rgb * 2.0 - 1.0).xy + (b.rgb * 2.0 - 1.0).xy * 0.6) * uH.y * 1.4 * lejos;
  } else {
    vec3 n1 = texture(uN, q + uTiempo * uS.xy).rgb * 2.0 - 1.0, n2 = texture(uN, q * 0.71 + vec2(0.37, 0.61) + uTiempo * uS.zw).rgb * 2.0 - 1.0;
    vec3 n3 = texture(uN, q * 2.7 + vec2(0.13, 0.77) + uTiempo * vec2(uS.y, -uS.x) * 2.3).rgb * 2.0 - 1.0;
    d = ((n1.xy + n2.xy) * uH.y + n3.xy * uH.y * 0.45 * lejos) * lejos;
  }
  // (las ondas: un anillo que se abre a 1,4 m/s y se apaga en 3 s; la pendiente hacia afuera)
  float anillos = 0.0;
  for (int i = 0; i < 8; i++) { if (float(i) >= uOndN) break; vec4 r = uOnd[i]; float e = uTiempo - r.z; if (e < 0.0 || e > 3.5) continue;
    vec2 dd = vW.xz - r.xy; float dist = length(dd) + 1e-3, x = dist - e * 1.4;
    float an = sin(x * 16.0) * exp(-x * x * 5.0) * exp(-e * 1.1) * r.w / (1.0 + dist * 0.6);
    d += dd / dist * (an * 0.9); anillos += abs(an); }
  if (uRayK.w > 0.5) { vec2 uo = (vW.xz - uRayK.xy) * uRayK.z;
    if (uo.x > 0.0 && uo.y > 0.0 && uo.x < 1.0 && uo.y < 1.0) { vec2 sl = (texture(uRay, uo).rg - 0.5) * 1.275;
      float bo = clamp(min(min(uo.x, uo.y), min(1.0 - uo.x, 1.0 - uo.y)) * 12.0, 0.0, 1.0); d -= sl * bo * 1.6; } }
  vec3 n = normalize(vec3(d.x, 1.0, d.y));
  if (uModo > 0.5 && uCam.y >= vW.y - 0.005 && uRefrOn > 0.5 && uNC > 0.5) {
    // el agua de Source, como su sombreador de agua con reflejo y refracción en tiempo real: el mapa de normales de su
    // material (dev/water_normal de Valve: 29 cuadros a 30 por segundo, corrido por su $bumptransform, un mosaico del tamaño
    // que le da la cara del mapa), el fondo corrido por $refractamount, teñido por $refracttint y con la niebla del agua
    // ($fogcolor, de 0 a $fogend por lo que la mirada cruza abajo del agua), el reflejo de la escena corrido por
    // $reflectamount y teñido por $reflecttint, mezclados por Fresnel
    float fa = uTiempo * 30.0, kf = fract(fa), f0 = mod(floor(fa), uNC), f1 = mod(f0 + 1.0, uNC);
    vec2 qs = vW.xz * uH.x + uTiempo * uS.xy;
    vec3 tn = mix(texture(uNA, vec3(qs, f0)), texture(uNA, vec3(qs, f1)), kf).rgb * 2.0 - 1.0;
    tn.xy += d;   // (las ondas que dejan el jugador y lo que cae)
    vec3 ns = normalize(vec3(tn.x, max(tn.z, 0.2), tn.y));
    float nvs = clamp(dot(ns, v), 0.0, 1.0); float frs = 0.02 + 0.98 * pow(1.0 - nvs, 5.0);
    vec2 pans = gl_FragCoord.xy * uRefInv; float lej = 1.0 / max(dCam * 0.25, 1.0);
    vec3 refls = texture(uRef, clamp(pans + tn.xy * uH.z * lej, 0.002, 0.998)).rgb * uEm;
    vec2 uvf = clamp(pans + tn.xy * uRefrK * lej, 0.002, 0.998);
    if (texture(uRefrP, uvf).r < gl_FragCoord.z) uvf = pans;   // (lo que está delante del agua no se corre)
    vec2 pbs = (vW.xz - uBq.xy) * uBq.zw;
    float profs = (pbs.x >= 0.0 && pbs.y >= 0.0 && pbs.x <= 1.0 && pbs.y <= 1.0) ? texture(uP, pbs).r * uD.x : uD.x;
    float nieb = clamp(profs / max(abs(v.y), 0.12) / max(uD.y, 0.1), 0.0, 1.0);
    vec3 fogc = pow(uF.rgb, vec3(1.0 / 2.2));
    vec3 abajo = mix(texture(uRefr, uvf).rgb * uTinte, fogc, nieb);
    float rvs = max(dot(reflect(-v, ns), uSol), 0.0);
    o = vec4(mix(abajo, refls, frs) + uSolC * pow(rvs, 600.0) * 0.8 * step(0.0, uSol.y), 1.0); return;
  }
  if (uCam.y < vW.y - 0.005) {
    // desde abajo (como HL2 mirando para arriba estando en el agua): adentro de la ventana de Snell —el cono de 48,6° alrededor
    // de la vertical— se ve lo de arriba, corrido por las olas y con el sol; afuera, el agua se refleja a sí misma (reflexión
    // total): su color, más oscuro. Entre el ojo y la superficie, la niebla del agua
    // (el borde de la ventana con la superficie alisada —con las olas enteras se deshace en manchas—; las olas, para correr la
    // imagen)
    vec3 sube = -v, nl = normalize(vec3(d.x * 0.3, 1.0, d.y * 0.3)); vec3 rr = refract(sube, -nl, 1.333); float c = dot(sube, nl);
    float ven = smoothstep(0.6, 0.72, c) * step(0.0001, dot(rr, rr));
    vec2 pan = gl_FragCoord.xy * uRefInv;
    vec3 arriba = texture(uRefr, clamp(pan + d * 1.2 + n.xz * 0.03, 0.002, 0.998)).rgb + uSolC * pow(max(dot(rr, uSol), 0.0), 220.0) * 1.5;
    arriba = mix(arriba, arriba * uF.rgb / max(max(uF.r, uF.g), max(uF.b, 1e-3)), 0.2);
    vec3 cuerpoA = pow(aces(uF.rgb * (mix(uAmbG, uAmbS, 0.8) + uSolC * max(uSol.y, 0.0) * 0.5) * 1.1 * uExpo), vec3(1.0 / 2.2));
    vec3 col = mix(cuerpoA * 0.75, arriba, ven) + vec3(0.9, 1.0, 1.0) * (ven * (1.0 - ven) * 0.5);
    float f = clamp((dCam - uNie.x) / max(uNie.y - uNie.x, 0.001), 0.0, 1.0) * uNie.z;
    o = vec4(mix(col, pow(aces(uNieC * uExpo), vec3(1.0 / 2.2)), f * 0.85), 1.0); return;
  }
  // (el Fresnel de HL2: (1 − N·V)⁵ con la normal de la ola)
  float nv = 1.0 - clamp(dot(n, v), 0.0, 1.0), nv2 = nv * nv; float fr = uNC > 0.5 ? nv2 * nv2 * nv : 0.02 + 0.98 * pow(1.0 - abs(dot(n, v)), 5.0);
  vec3 cuerpo = pow(aces(uF.rgb * (mix(uAmbG, uAmbS, 0.8) + uSolC * max(uSol.y, 0.0) * 0.5) * 1.6 * uExpo), vec3(1.0 / 2.2));
  // (como Source: la imagen se corre lo que inclina la normal por $reflectamount y $refractamount; un poco menos a lo lejos)
  // (HL2: el reflejo y el fondo se corren lo que inclina la ola por el alfa del mapa de normales y por $reflectamount y
  // $refractamount)
  vec2 pan = gl_FragCoord.xy * uRefInv, ola = n.xz * alfa / (1.0 + dCam * 0.01), onda = ola * uH.z;
  vec3 refl = uH.w > 0.5 ? texture(uRef, pan + onda).rgb : mix(cuerpo, vec3(0.75, 0.82, 0.9), 0.6);
  // (lo hondo de este punto: cuánto agua cruza la mirada hasta el fondo)
  vec2 pb = (vW.xz - uBq.xy) * uBq.zw;
  float prof = (pb.x >= 0.0 && pb.y >= 0.0 && pb.x <= 1.0 && pb.y <= 1.0) ? texture(uP, pb).r * uD.x : uD.x;
  // (más clara que antes: como el agua de HL2, se ve el fondo)
  float niebla = 1.0 - exp(-prof / max(abs(v.y), 0.08) / (uD.y * 1.6));
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
  // (los anillos de las ondas: sus caras inclinadas agarran más reflejo del cielo —así se ven en el agua de verdad—)
  if (anillos > 0.0) o.rgb = mix(o.rgb, refl * 1.05 + 0.04, clamp(anillos * 0.7, 0.0, 0.45));
}"#;
const VS_CIELO: &str = r#"#version 300 es
out vec2 vP; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vP = p; gl_Position = vec4(p, 1.0, 1.0); }"#;
const FS_CIELO: &str = r#"#version 300 es
precision highp float; uniform mat4 uIVP; uniform vec3 uSol, uNieC; uniform float uExpo; in vec2 vP; out vec4 o;
uniform samplerCube uCubo; uniform vec3 uTop, uMid, uBot, uTinte, uSolC; uniform vec2 uExp; uniform float uDia, uCieloK; uniform int uTieneCubo; uniform vec4 uNubes;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
// (x^2,2 y x^(1/2,2) con tres raíces en vez de pow —logaritmo y exponencial—: el mismo color, menos de 0,2 de un nivel de
// 8 bits de diferencia; la raíz es una sola instrucción)
#ifdef DBG_POW
vec3 dec(vec3 x) { return pow(max(x, 0.0), vec3(2.2)); }
vec3 enc(vec3 x) { return pow(max(x, 0.0), vec3(1.0 / 2.2)); }
#else
vec3 dec(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return x * x * (0.73929934 * b + 0.34228227 * c - 0.0593772 * a - 0.0226474); }
vec3 enc(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return 0.93020244 * a + 0.14337668 * b - 0.02588437 * c - 0.04836126 * x; }
#endif

@@NUBES@@
void main() {
  vec4 a = uIVP * vec4(vP, -1.0, 1.0), b = uIVP * vec4(vP, 0.5, 1.0); vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  // (el cielo Frutiger propio, en lugar del del mapa)
  if (uNubes.z > 0.5) { vec4 n = nubes(d, uSol, uNubes.y, uSolC, vec3(0.1, 0.5, 1.0)); o = vec4(min(frutiger(d, uSol, uNubes.y, n), vec3(1.0)), 1.0); return; }
  if (uTieneCubo > 0) {
    // (el cielo del mapa, como en WebGL: el degradé y la caja —una imagen ya terminada, sin tono— con su tinte)
    bool ar = d.y > 0.0; vec3 g = mix(uMid, ar ? uTop : uBot, pow(abs(d.y), ar ? uExp.x : uExp.y));
    vec3 c = uTieneCubo > 1 ? mix(g, texture(uCubo, d).rgb * uTinte, uDia) : g;
    // (Definitivo: las nubes encima —sólo si el mapa no trae su caja con nubes: dos capas lo dejaban blanco— y el disco del sol)
    vec4 n = uNubes.x > 0.5 && uTieneCubo < 2 ? nubes(d, uSol, uNubes.y, uSolC, uTop) : vec4(0.0); c = mix(c, n.rgb, n.a);
    c = dec(c) * uCieloK;
    if (uNubes.x > 0.5) c += sol_disco(d, uSol, uSolC) * (1.0 - n.a);
    o = vec4(enc(min(c, vec3(1.0))), 1.0); return;
  }
  vec3 cen = vec3(0.16, 0.36, 0.78), hor = vec3(0.62, 0.74, 0.88);
  vec3 c = mix(hor, cen, pow(clamp(d.y, 0.0, 1.0), 0.45)); if (d.y < 0.0) c = mix(hor, uNieC, clamp(-d.y * 4.0, 0.0, 1.0));
  vec4 n = uNubes.x > 0.5 ? nubes(d, uSol, uNubes.y, uSolC, cen) : vec4(0.0); c = mix(c, n.rgb, n.a);
  c += vec3(1.0, 0.92, 0.75) * pow(max(dot(d, uSol), 0.0), 600.0) * 6.0 * (1.0 - n.a);
  o = vec4(enc(aces(c * uExpo * 1.1)), 1.0);
}"#;

const FS_AO: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uProf; uniform mat4 uVP; uniform vec3 uCam, uRay0, uRayX, uRayY; uniform vec2 uZl; uniform float uRadio; in vec2 vP; out vec4 o;
// (el punto del mundo de un píxel: el rayo de la cámara por ese lugar de la pantalla —cambia en línea con la posición— por lo
// hondo que dice la profundidad; da lo mismo que la inversa de la matriz, con muchas menos cuentas por muestra)
vec3 rayo(vec2 uv) { return uRay0 + uv.x * uRayX + uv.y * uRayY; }
float hondo(float z) { return uZl.x / (z * 2.0 - 1.0 - uZl.y); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
// (la espiral: para cada muestra h = (i + ½) / 8, √(1 − h), √h y cuánto se aleja —0,2 a 1 con h²—, ya calculados)
const float CC[8] = float[8](0.9682458, 0.9013878, 0.8291562, 0.7500000, 0.6614378, 0.5590170, 0.4330127, 0.2500000);
const float SS[8] = float[8](0.2500000, 0.4330127, 0.5590170, 0.6614378, 0.7500000, 0.8291562, 0.9013878, 0.9682458);
const float KK[8] = float[8](0.2031250, 0.2281250, 0.2781250, 0.3531250, 0.4531250, 0.5781250, 0.7281250, 0.9031250);
void main() {
  vec2 uv = vP * 0.5 + 0.5; float z0 = texture(uProf, uv).r;
  if (z0 >= 0.99999) { o = vec4(1.0); return; }   // (el cielo)
  vec3 w = uCam + rayo(uv) * hondo(z0), n = normalize(cross(dFdx(w), dFdy(w)));
  if (dot(n, uCam - w) < 0.0) n = -n;
  vec3 t = normalize(abs(n.y) < 0.9 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0))), b = cross(n, t);
  float a0 = ign(gl_FragCoord.xy) * 6.2831853, r = uRadio * clamp(distance(w, uCam) * 0.1, 0.3, 1.0), occ = 0.0;
  float dc = distance(w, uCam), sesgo = 0.02 + 0.0004 * dc * dc;
  // (el ángulo de cada muestra gira el ángulo de oro desde el anterior: se rota el par coseno-seno en vez de calcularlos)
  vec2 cs = vec2(cos(a0), sin(a0)); const vec2 G = vec2(-0.7373688, 0.6754903);
  for (int i = 0; i < 8; i++) {
    // (una espiral en la media esfera de la normal, cada vez más lejos: 8 muestras con el ruido de cada píxel y el suavizado
    // de 4 de la pasada de poner alcanzan)
    vec3 s = w + (t * (cs.x * SS[i]) + b * (cs.y * SS[i]) + n * CC[i]) * (r * KK[i]);
    cs = vec2(cs.x * G.x - cs.y * G.y, cs.x * G.y + cs.y * G.x);
    vec4 q = uVP * vec4(s, 1.0);
    if (q.w <= 0.0) continue;
    vec2 su = q.xy / q.w * 0.5 + 0.5;
    if (su.x < 0.0 || su.y < 0.0 || su.x > 1.0 || su.y > 1.0) continue;
    vec3 d = uCam + rayo(su) * hondo(texture(uProf, su).r);
    if (distance(d, uCam) < distance(s, uCam) - sesgo) occ += smoothstep(0.0, 1.0, r / max(distance(d, w), 1e-3));
  }
  // (lejos se apaga: ahí un píxel abarca mucho y la normal de las derivadas sale rayada —las fachadas, el horizonte—)
  float ao = 1.0 - occ / 8.0 * (1.0 - smoothstep(22.0, 38.0, dc)) * smoothstep(0.08, 0.3, abs(dot(n, normalize(uCam - w))));
  o = vec4(ao, ao, ao, 1.0);
}"#;
const FS_AO_PONER: &str = r#"#version 300 es
precision mediump float; uniform sampler2D uAO; uniform vec2 uInv; uniform float uFuerza; in vec2 vP; out vec4 o;
void main() {
  vec2 uv = vP * 0.5 + 0.5;
  float a = 0.25 * (texture(uAO, uv + vec2(-uInv.x, -uInv.y)).r + texture(uAO, uv + vec2(uInv.x, -uInv.y)).r + texture(uAO, uv + vec2(-uInv.x, uInv.y)).r + texture(uAO, uv + uInv).r);
  o = vec4(vec3(mix(1.0, a, uFuerza)), 1.0);   // (se multiplica con lo que ya está dibujado)
}"#;

// la vista que se acostumbra (como el ojo o la exposición de una cámara): cuánto brilla la escena —12×12 lecturas, las del
// medio pesan más, el promedio de los logaritmos— y la exposición que le toca, a la que se va de a poco: a lo oscuro despacio
// (al entrar a la sombra todo se va aclarando), a la luz más rápido (al salir encandila y se acomoda). Se guarda en 1×1 con 16
// bits (rojo y verde, sin números grandes: anda con la precisión media de los sombreadores viejos), de 0 a 4. uAdapta: x el tiempo del cuadro, y el brillo de un exterior de día, z y w lo mínimo y lo máximo
const FS_ADAPTA: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uEsc; uniform highp sampler2D uAd; uniform vec4 uAdapta; in vec2 vP; out vec4 o;
float dec16(vec4 t) { return (floor(t.r * 255.0 + 0.5) + floor(t.g * 255.0 + 0.5) / 256.0) * (4.0 / 255.0); }
vec4 enc16(float k) { float x = clamp(k, 0.0, 4.0) * (255.0 / 4.0); float hi = floor(x); return vec4(hi / 255.0, floor((x - hi) * 256.0) / 255.0, 0.0, 1.0); }
void main() {
  float s = 0.0, w = 0.0;
  for (int y = 0; y < 12; y++) for (int x = 0; x < 12; x++) {
    vec2 uv = (vec2(float(x), float(y)) + 0.5) / 12.0; vec3 c = texture(uEsc, uv).rgb; c *= c;
    vec2 q = uv - 0.5; float k = exp(-dot(q, q) * 6.0);
    s += log(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.002)) * k; w += k; }
  float meta = clamp(pow(uAdapta.y / exp(s / w), 0.6), uAdapta.z, uAdapta.w);
  float antes = dec16(texture(uAd, vec2(0.5)));
  // (de a poco; si el paso queda más chico que lo que se guarda, al menos ese mínimo: si no, no llegaría nunca)
  float d = meta - antes, paso = d * (1.0 - exp(-uAdapta.x / (d > 0.0 ? 1.1 : 0.45)));
  if (uAdapta.x > 0.0 && abs(paso) < 0.004) paso = clamp(d, -0.004, 0.004);
  o = enc16(antes + paso);
}"#;
// JX Turbo, el cuadro intermedio: la imagen terminada del último cuadro (con el retoque, sin la interfaz) corrida a la cámara de
// ahora. Para cada punto de la imagen nueva, de dónde viene en la vieja: se adivina (el mismo lugar), con la profundidad de ahí
// se pasa al cuadro nuevo y lo que falta para caer en el punto se corrige, tres veces. Lo del mundo se corre con la cámara (uM:
// la nueva por la vieja al revés); el arma y las manos con
// el movimiento del arma (uMa: además, de su raíz vieja a la de ahora: el vaivén). El arma se reconoce por su franja de la
// profundidad (de 0 a uCorte, FL_ARMA). Al final se comprueba que lo encontrado
// caiga de verdad acá: si no, y es el arma vieja, es fondo que el arma tapaba —no se sabe qué hay—: el primer punto sin arma
// yendo hacia acá (el borde del fondo estirado, en vez de una copia del arma que se va con el mundo: el fantasma)
const FS_REPRO: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uEsc, uProf; uniform highp mat4 uM, uMa; uniform float uCorte; uniform vec2 uInv; in vec2 vP; out vec4 o;
// (el arma está en su franja —de 0 a uCorte—: su profundidad de verdad es la de la franja estirada)
vec2 donde(vec2 q, float d) { bool a = d < uCorte; float z = a ? d / uCorte : d; vec4 n = (a ? uMa : uM) * vec4(q * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); return n.w > 1e-5 ? n.xy / n.w * 0.5 + 0.5 : vec2(-9.0); }
void main() {
  vec2 uv = vP * 0.5 + 0.5, q = uv; float d = texture(uProf, uv).r;
#ifdef VER_CORTE
  o = vec4(d < uCorte ? 1.0 : 0.0, fract(d * 50.0), 0.0, 1.0); return;   // (JXM_VER_CORTE: el arma en rojo)
#endif
  for (int i = 0; i < 3; i++) {
    if (i > 0) d = texture(uProf, q).r;
    vec2 n = donde(q, d); if (n.x < -8.0) break;
    q = clamp(q + (uv - n), vec2(0.0), vec2(1.0));
  }
  d = texture(uProf, q).r;
  if (d < uCorte) {
    vec2 e = (donde(q, d) - uv) / uInv;
    if (dot(e, e) > 2.25) {
      // (y dos píxeles más afuera: el del borde tiene mezclado el color del arma —el contorno que quedaba como fantasma—)
      vec2 dir = uv - q; dir = dot(dir, dir) > 1e-12 ? normalize(dir) * uInv * 2.0 : vec2(0.0);
      for (int k = 1; k <= 4; k++) { vec2 r = mix(q, uv, float(k) * 0.25); if (texture(uProf, r).r >= uCorte) { q = clamp(r + dir, vec2(0.0), vec2(1.0)); break; } }
    }
  }
  o = texture(uEsc, q);
}"#;
// (la imagen guardada a la pantalla, tal cual: una pasada en vez de glBlitFramebuffer, que no anda con todas las ventanas de EGL)
const FS_COPIA: &str = r#"#version 300 es
precision mediump float; uniform sampler2D uEsc; in vec2 vP; out vec4 o;
void main() { o = texture(uEsc, vP * 0.5 + 0.5); }"#;
// la reconstrucción temporal (con la escena a menos píxeles que la pantalla): cada cuadro se dibuja corrido una fracción de
// píxel distinta (uSc, en píxeles de la escena chica) y acá se junta con lo de los cuadros anteriores, a la resolución de la
// pantalla. Lo de antes se busca donde estaba —con la profundidad y las dos cámaras (uM), como JX Turbo; el arma, pegada a la
// cámara, no se corre— y se recorta a los colores de alrededor de ahora (así no quedan fantasmas). Pesa poco lo de este cuadro
// cuando está todo quieto (se juntan unos 12) y más cuando el punto cayó cerca, cuando se mueve o cuando es nuevo (uFuerza)
const FS_TAA: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uEsc, uProf, uHis; uniform highp mat4 uM; uniform vec2 uInv, uSc; uniform float uFuerza, uCorte; in vec2 vP; out vec4 o;
void main() {
  vec2 uv = vP * 0.5 + 0.5; vec2 tam = 1.0 / uInv; vec2 sal = vec2(textureSize(uHis, 0)); float esc = max(sal.x / tam.x, 1.0);
  // (dónde cae este píxel de la pantalla en la escena chica de este cuadro, que se dibujó corrida uSc)
  vec2 p = uv * tam + uSc; vec2 c0 = floor(p) + 0.5;
  // (las 9 muestras de alrededor: cada una pesa según qué tan cerca de este píxel cayó —una campana del ancho de un píxel de la
  // pantalla—; así cada píxel junta, cuadro a cuadro, las muestras que le caen encima: detalle de verdad y no un promedio)
  float sg = 0.7 / esc; float k2 = 0.5 / (sg * sg);
  vec3 cs = vec3(0.0), mn = vec3(1e9), mx = vec3(-1e9), m1 = vec3(0.0), m2 = vec3(0.0); float ws = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = c0 + vec2(float(i), float(j)); vec3 s = texture(uEsc, c * uInv).rgb; vec2 d = c - p; float g = exp(-dot(d, d) * k2);
    cs += s * g; ws += g; mn = min(mn, s); mx = max(mx, s); m1 += s; m2 += s * s;
  }
  vec3 bil = texture(uEsc, p * uInv).rgb;
  vec3 cur = ws > 1e-4 ? mix(bil, cs / ws, clamp(ws * 3.0, 0.0, 1.0)) : bil;
  float z = texture(uProf, uv).r; vec2 uvp = uv;
  if (z >= uCorte) { vec4 q = uM * vec4(vP, z * 2.0 - 1.0, 1.0); uvp = q.xy / max(q.w, 1e-6) * 0.5 + 0.5; }
  bool nuevo = uFuerza > 0.5 || uvp.x < 0.0 || uvp.y < 0.0 || uvp.x > 1.0 || uvp.y > 1.0;
  float mov = length((uvp - uv) * sal);
  // (lo de antes se recorta a los colores de alrededor: quieto, entre el más oscuro y el más claro —deja el detalle chico—;
  // moviéndose, más ajustado —sin fantasmas—)
  m1 /= 9.0; m2 /= 9.0; vec3 sd = sqrt(max(m2 - m1 * m1, 0.0)); float q = clamp(mov * 0.5, 0.0, 1.0);
  vec3 lo = mix(mn, max(m1 - sd * 1.25, mn), q), hi = mix(mx, min(m1 + sd * 1.25, mx), q);
  vec3 h = clamp(texture(uHis, uvp).rgb, lo, hi);
  float a = nuevo ? 1.0 : clamp(ws * 0.5 + mov * 0.08, 0.03, 1.0);
  o = vec4(mix(h, cur, a), 1.0);
}"#;
// la pasada final: la escena a la pantalla con los rayos, el resplandor, la exposición y el retoque
const FS_FINAL: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uEsc; uniform sampler2D uRay, uBlo; uniform highp sampler2D uAd; uniform float uRetoque, uFuerza, uRayK, uBloomK; uniform vec4 uAdapta; uniform vec2 uInv; in vec2 vP; out vec4 o;
float dec16(vec4 t) { return (floor(t.r * 255.0 + 0.5) + floor(t.g * 255.0 + 0.5) / 256.0) * (4.0 / 255.0); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
// el reescalado (la escena a menos píxeles que la pantalla —la resolución de Ajustes, hasta 10 %, o la dinámica—): Catmull-Rom
// en 5 lecturas bilineales (sin las esquinas, que casi no pesan) y recortado entre lo más oscuro y lo más claro que leyó —sin
// halos en los bordes—; mucho más nítido que estirar con el bilineal y sin escalones
vec3 subir(vec2 uv, float borde) {
  vec2 tam = 1.0 / uInv; vec2 p = uv * tam; vec2 tc = floor(p - 0.5) + 0.5; vec2 f = p - tc;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2; vec2 t0 = (tc - 1.0) * uInv, t3 = (tc + 2.0) * uInv, t12 = (tc + w2 / w12) * uInv;
  vec3 a = texture(uEsc, vec2(t12.x, t0.y)).rgb, b = texture(uEsc, vec2(t0.x, t12.y)).rgb, c = texture(uEsc, t12).rgb, d = texture(uEsc, vec2(t3.x, t12.y)).rgb, e = texture(uEsc, vec2(t12.x, t3.y)).rgb;
  float ka = w12.x * w0.y, kb = w0.x * w12.y, kc = w12.x * w12.y, kd = w3.x * w12.y, ke = w12.x * w3.y;
  vec3 r = (a * ka + b * kb + c * kc + d * kd + e * ke) / (ka + kb + kc + kd + ke);
  r = clamp(r, min(min(a, b), min(min(c, d), e)), max(max(a, b), max(max(c, d), e)));
  // (los bordes en escalera de la escena chica: se promedia a lo largo del borde —como FXAA—, más cuanto más chica)
  if (borde > 0.0) { vec3 L = vec3(0.299, 0.587, 0.114); vec2 gr = vec2(dot(d, L) - dot(b, L), dot(e, L) - dot(a, L)); float gm = length(gr);
    if (gm > 0.02) { vec2 dir = vec2(-gr.y, gr.x) / gm * uInv * 1.25; vec3 s = 0.5 * (texture(uEsc, uv + dir).rgb + texture(uEsc, uv - dir).rgb); r = mix(r, 0.5 * (r + s), clamp(gm * 4.0, 0.0, 1.0) * borde * 1.6); } }
  return r;
}
void main() {
  // (texture y no texelFetch aunque la escena sea del tamaño de la pantalla: en llvmpipe texelFetch es más lento)
  vec2 uv = vP * 0.5 + 0.5;
  // (con los ojos bajo el agua, la imagen se ondula apenas, como en HL2)
  if (uAdapta.y > 0.5) uv += vec2(sin(uv.y * 23.0 + uAdapta.z * 2.1), cos(uv.x * 19.0 + uAdapta.z * 1.7)) * 0.0028;
  vec3 c = uAdapta.w > 0.5 ? subir(uv, uAdapta.w - 1.0) : texture(uEsc, uv).rgb;
  // (la escena a menos píxeles —la resolución dinámica—: un poco de nitidez, contra lo de alrededor —dos lecturas a medio
  // píxel en diagonal, cada una el promedio de cuatro—)
  if (uFuerza > 0.0) { vec3 b = 0.5 * (texture(uEsc, uv + uInv * 0.5).rgb + texture(uEsc, uv - uInv * 0.5).rgb); c = clamp(c + (c - b) * uFuerza, 0.0, 1.0); }
  // (los rayos del sol, sumados a la luz —como en post.js, antes del tono—)
  if (uRayK > 0.0) { vec3 r = texture(uRay, uv).rgb; r = r * r * (8.0 * uRayK); c = sqrt(c * c + 1.0 - exp(-r)); }
  // (Definitivo: el resplandor de lo brillante)
  if (uBloomK > 0.0) { vec3 b = texture(uBlo, uv).rgb; c = sqrt(c * c + b * uBloomK); }
  // (la vista que se acostumbra: la exposición del momento; lo que pasa de 0,7 se aplasta suave hasta 1, así al encandilar lo
  // claro se quema de a poco y no de golpe)
  if (uAdapta.x > 0.0) { vec3 l = c * c * dec16(texture(uAd, vec2(0.5))); vec3 e = max(l - 0.7, 0.0); c = sqrt(min(l, 0.7) + e / (1.0 + e / 0.3)); }
  if (uRetoque > 0.5) {
    // (como FS_FINAL de post.js: un toque más de color y de contraste —curva en S— con los negros un poco más hondos —lo
    // sombreado se nota— y un poco de viñeta)
    c = c * c;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = clamp(mix(vec3(l), c, 1.15), 0.0, 1.0);
    c = max(c - 0.006, 0.0) * 1.006;
    c = c * c * (3.0 - 2.0 * c) * 0.26 + c * 0.74;
    // (Definitivo: el color de película —lo oscuro un poco frío, lo claro apenas cálido—, más color y más contraste: nada
    // lavado)
    if (uBloomK > 0.0) { float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = clamp(mix(vec3(l2), c, 1.06), 0.0, 1.0); c *= mix(vec3(0.92, 0.98, 1.08), vec3(1.01, 1.0, 0.98), smoothstep(0.1, 0.8, l2)); c = clamp(c * c * (3.0 - 2.0 * c) * 0.28 + c * 0.72, 0.0, 1.0); }
    c = sqrt(c);
    vec2 q = uv - 0.5; c *= 1.0 - dot(q, q) * 0.32;
    c += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  }
  o = vec4(c, 1.0);
}"#;
// el resplandor de Definitivo (como post.js): lo brillante de la escena a media resolución, bajado en cadena (un cuarto, un
// octavo, un dieciseisavo) y vuelto a subir sumando: el halo ancho y suave alrededor del sol, el cielo y lo que brilla
const FS_BRILLO: &str = r#"#version 300 es
precision mediump float; uniform highp sampler2D uEsc; uniform vec2 uInv; in vec2 vP; out vec4 o;
void main() {
  vec2 uv = vP * 0.5 + 0.5;
  vec3 c = texture(uEsc, uv + uInv * vec2(-1.0, -1.0)).rgb + texture(uEsc, uv + uInv * vec2(1.0, -1.0)).rgb + texture(uEsc, uv + uInv * vec2(-1.0, 1.0)).rgb + texture(uEsc, uv + uInv * vec2(1.0, 1.0)).rgb;
  c *= 0.25; c = c * c; float l = max(c.r, max(c.g, c.b)), k = max(0.0, l - 0.82) / max(l, 1e-4);
  o = vec4(c * k, 1.0);
}"#;
const FS_BAJA: &str = r#"#version 300 es
precision mediump float; uniform sampler2D uBlo; uniform vec2 uInv; in vec2 vP; out vec4 o;
void main() { vec2 uv = vP * 0.5 + 0.5; vec3 c = texture(uBlo, uv).rgb * 4.0 + texture(uBlo, uv + uInv * vec2(-1.0, -1.0)).rgb + texture(uBlo, uv + uInv * vec2(1.0, -1.0)).rgb + texture(uBlo, uv + uInv * vec2(-1.0, 1.0)).rgb + texture(uBlo, uv + uInv * vec2(1.0, 1.0)).rgb; o = vec4(c / 8.0, 1.0); }"#;
const FS_SUBE: &str = r#"#version 300 es
precision mediump float; uniform sampler2D uBlo; uniform vec2 uInv; in vec2 vP; out vec4 o;
void main() {
  vec2 uv = vP * 0.5 + 0.5;
  vec3 c = texture(uBlo, uv + uInv * vec2(-1.0, 0.0)).rgb + texture(uBlo, uv + uInv * vec2(1.0, 0.0)).rgb + texture(uBlo, uv + uInv * vec2(0.0, -1.0)).rgb + texture(uBlo, uv + uInv * vec2(0.0, 1.0)).rgb;
  c = c * 2.0 + texture(uBlo, uv + uInv * vec2(-1.0, -1.0)).rgb + texture(uBlo, uv + uInv * vec2(1.0, -1.0)).rgb + texture(uBlo, uv + uInv * vec2(-1.0, 1.0)).rgb + texture(uBlo, uv + uInv * vec2(1.0, 1.0)).rgb;
  o = vec4(c / 12.0, 1.0);
}"#;
// los rayos del sol (Ultra), como los de WebGL 2 (post.js): 1) la máscara, a un cuarto del lado: dónde se ve el cielo (la
// profundidad en el fondo) cerca del sol, con su brillo —la escena acá ya está en la pantalla: se vuelve a la luz y se le
// suma el disco del sol, que en la web está en el HDR del cielo—; 2) el desenfoque radial hacia el sol: 40 lecturas cada vez
// menos (0,975). Los valores, en 8 bits con raíz (v/8): lo oscuro con más escalones. Suaves: se sienten —el resplandor del sol
// entre lo que lo tapa— más de lo que se ven (lo que se siente es la vista que se acostumbra, FS_ADAPTA)
const FS_RAYMASK: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uEsc, uProf; uniform vec4 uRayP; uniform vec3 uSolC; in vec2 vP; out vec4 o;
void main() {
  vec2 uv = vP * 0.5 + 0.5; vec2 v = (uv - uRayP.xy) * vec2(uRayP.z, 1.0); float r2 = dot(v, v);
  float k = texture(uProf, uv).r >= 0.99999 ? 1.0 : 0.0;
  vec3 c = texture(uEsc, uv).rgb; c = c * c * 0.45 + uSolC * (2.5 * exp(-r2 * 400.0));
  o = vec4(sqrt(min(c, vec3(8.0)) * (k * exp(-r2 * 6.0) / 8.0)), 1.0);
}"#;
// la luz en el aire (luz volumétrica, Ultra): por cada píxel —a un cuarto del lado— se recorre el aire desde la cámara hasta
// lo que se ve (o hasta uVol.x metros) y en cada paso se mira en la sombra del sol (la cascada de lejos) si ahí le da: lo que
// tapa el sol corta el haz (entre los fierros, las hojas, por las ventanas), aunque el sol no esté en la pantalla; el aire al sol
// cuenta más si el mismo rayo cruza sombra (los haces), poco si va todo al sol (la bruma). Más fuerte
// mirando para el sol (Henyey-Greenstein). Se le suman los rayos de la pantalla (uVol.z: su fuerza) y sale como v/8 con raíz
const FS_VOL: &str = r#"#version 300 es
#ifndef PASOS
#define PASOS 20
#endif
precision highp float; precision highp sampler2DShadow;
uniform highp sampler2D uProf; uniform sampler2DShadow uSM; uniform sampler2D uRay;
uniform mat4 uSVP2; uniform vec3 uCam, uRay0, uRayX, uRayY, uSol, uSolC; uniform vec2 uZl, uSesgo2; uniform vec4 uVol; in vec2 vP; out vec4 o;
vec3 rayo(vec2 uv) { return uRay0 + uv.x * uRayX + uv.y * uRayY; }
float hondo(float z) { return uZl.x / (z * 2.0 - 1.0 - uZl.y); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 uv = vP * 0.5 + 0.5; float z = texture(uProf, uv).r; vec3 r = rayo(uv); float lr = length(r);
  float tf = uVol.x / lr, te = z >= 0.99999 ? tf : min(hondo(z), tf);
  const int N = PASOS; float dt = te / float(N), t = dt * ign(gl_FragCoord.xy), lit = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 q = (uSVP2 * vec4(uCam + r * t, 1.0)).xyz;
    lit += (q.x <= 0.0 || q.y <= 0.0 || q.x >= 1.0 || q.y >= 1.0 || q.z >= 1.0) ? 1.0 : texture(uSM, vec3((q.x + 1.0) * 0.5, q.y, q.z - uSesgo2.x));
    t += dt;
  }
  float fl = lit / float(N), m = lit / float(N) * te * lr, c = dot(r / lr, uSol), g = 0.55, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
  vec3 v = uSolC * ((0.1 + 0.2 * hg) * m * (uVol.y + uVol.w * (1.0 - fl)));
  if (uVol.z > 0.0) { vec3 a = texture(uRay, uv).rgb; v += a * a * (8.0 * uVol.z); }
  o = vec4(sqrt(min(v, vec3(8.0)) / 8.0), 1.0);
}"#;
const FS_RAYOS: &str = r#"#version 300 es
precision mediump float; uniform sampler2D uRay; uniform vec4 uRayP; in vec2 vP; out vec4 o;
void main() {
  vec2 uv = vP * 0.5 + 0.5; vec2 d = (uRayP.xy - uv) / 40.0; vec3 s = vec3(0.0); float w = 1.0;
  for (int i = 0; i < 40; i++) { vec3 t = texture(uRay, uv).rgb; s += t * t * w; w *= 0.975; uv += d; }
  o = vec4(sqrt(s / 40.0), 1.0);
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
// el agua de partículas (EF_FLUIDO), como superficie (la técnica pública de «screen-space fluid rendering»): (1) la
// profundidad de cada partícula como esfera, a media resolución; (2) el grosor del agua (todas sumadas); (3) la
// profundidad suavizada (bilateral, 2 vueltas: las esferas se funden en una superficie); (4) el agua sobre la escena: la
// normal sale de la superficie suavizada, el fondo se ve corrido (refracción) y teñido según el grosor, más el reflejo
// del cielo (Fresnel), el brillo del sol y la espuma
const VS_FLU: &str = r#"#version 300 es
layout(location=0) in vec4 aP; uniform mat4 uVP; uniform vec3 uDer, uArr; uniform float uRadio; out vec2 vU; out vec3 vC; out float vE;
const vec2 ESQ[6] = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
void main(){ vec2 e = ESQ[gl_VertexID % 6]; vU = e; vC = aP.xyz; vE = aP.w; gl_Position = uVP * vec4(aP.xyz + (uDer * e.x + uArr * e.y) * uRadio, 1.0); }"#;
const FS_FLU_Z: &str = r#"#version 300 es
precision highp float; in vec2 vU; in vec3 vC; in float vE; uniform mat4 uVP; uniform vec3 uDer, uArr, uCam; uniform float uRadio; out vec4 o;
void main(){ float d2 = dot(vU, vU); if (d2 > 1.0) discard; vec3 f = normalize(uCam - vC);
  vec3 p = vC + (uDer * vU.x + uArr * vU.y + f * sqrt(1.0 - d2)) * uRadio; vec4 c = uVP * vec4(p, 1.0);
  gl_FragDepth = clamp(c.z / c.w * 0.5 + 0.5, 0.0, 1.0); o = vec4(0.0); }"#;
const FS_FLU_G: &str = r#"#version 300 es
precision highp float; in vec2 vU; in vec3 vC; in float vE; uniform float uFuerza; out vec4 o;
void main(){ float d2 = dot(vU, vU); if (d2 > 1.0) discard; float k = 1.0 - d2; o = vec4(uFuerza * k, vE * 0.3 * k, 0.0, 1.0); }"#;
const FS_FLU_BL: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uProf; uniform vec2 uInv, uD, uZl; uniform float uFuerza; in vec2 vP; out vec4 o;
float hondo(float z) { return uZl.x / (z * 2.0 - 1.0 - uZl.y); }
float prof(float w) { return (uZl.x / w + 1.0 + uZl.y) * 0.5; }
void main(){
  vec2 uv = vP * 0.5 + 0.5; float z0 = texture(uProf, uv).r; o = vec4(0.0);
  if (z0 >= 0.99999) { gl_FragDepth = 1.0; return; }
  float w0 = hondo(z0); float paso = clamp(uFuerza / w0, 1.0, 16.0) / 7.0;
  float s = 0.0, ws = 0.0;
  for (int i = -7; i <= 7; i++) {
    float z = texture(uProf, uv + uD * uInv * (float(i) * paso)).r; if (z >= 0.99999) continue;
    float w = hondo(z); float dz = (w - w0) * 14.0; float g = exp(-float(i * i) * 0.045 - dz * dz);
    s += w * g; ws += g;
  }
  gl_FragDepth = clamp(prof(s / max(ws, 1e-6)), 0.0, 0.99998); }"#;
const FS_FLU_C: &str = r#"#version 300 es
precision highp float; uniform highp sampler2D uProf; uniform sampler2D uAO; uniform sampler2D uRefr; uniform highp sampler2D uRefrP;
uniform vec3 uCam, uRay0, uRayX, uRayY, uDer, uArr; uniform vec2 uZl, uInv; uniform vec4 uC, uS, uSol; in vec2 vP; out vec4 o;
vec3 rayo(vec2 uv) { return uRay0 + uv.x * uRayX + uv.y * uRayY; }
float hondo(float z) { return uZl.x / (z * 2.0 - 1.0 - uZl.y); }
vec3 punto(vec2 uv, float z) { return uCam + rayo(uv) * hondo(z); }
void main(){
  vec2 uv = vP * 0.5 + 0.5; vec4 g = texture(uAO, uv); if (g.r < 0.004) discard;
  vec2 ex = vec2(uInv.x, 0.0), ey = vec2(0.0, uInv.y);
  float z = texture(uProf, uv).r;
  float zr = texture(uProf, uv + ex).r, zl = texture(uProf, uv - ex).r, zu = texture(uProf, uv + ey).r, zd = texture(uProf, uv - ey).r;
  // (en el borde, donde la media resolución no llegó: la vecina más cerca; el borde se funde con el grosor)
  if (z >= 0.99999) { z = min(min(zr, zl), min(zu, zd)); if (z >= 0.99999) discard; }
  float w = hondo(z); if (hondo(texture(uRefrP, uv).r) < w - 0.03) discard;
  vec3 P = punto(uv, z);
  vec3 dx = (zl >= 0.99999 || (zr < 0.99999 && abs(zr - z) < abs(z - zl))) ? punto(uv + ex, zr) - P : P - punto(uv - ex, zl);
  vec3 dy = (zd >= 0.99999 || (zu < 0.99999 && abs(zu - z) < abs(z - zd))) ? punto(uv + ey, zu) - P : P - punto(uv - ey, zd);
  vec3 V = normalize(uCam - P); vec3 n = normalize(cross(dx, dy)); if (dot(n, V) < 0.0) n = -n;
  float T = g.r * 0.9; float F = g.g;
  float nv = max(dot(n, V), 0.0); float fr = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  // (el fondo, corrido por la superficie —más cuanto más agua— y teñido: el rojo se apaga primero)
  vec2 off = vec2(dot(n, uDer), dot(n, uArr)) * (0.015 + 0.045 * min(T, 1.0));
  vec3 fondo = texture(uRefr, clamp(uv - off, vec2(0.001), vec2(0.999))).rgb;
  vec3 tr = exp(-T * vec3(1.15, 0.36, 0.24));
  vec3 refr = fondo * tr + uC.rgb * (1.0 - tr);
  vec3 R = reflect(-V, n); vec3 refl = uS.rgb * (0.72 + 0.38 * clamp(R.y, -1.0, 1.0));
  float sp = pow(max(dot(R, uSol.xyz), 0.0), 380.0) * uSol.w * 3.0 + pow(max(dot(R, uSol.xyz), 0.0), 40.0) * uSol.w * 0.12;
  vec3 col = mix(refr, refl, fr * uS.a) + sp;
  col = mix(col, uS.rgb * 0.55 + 0.45, clamp(F * 0.9, 0.0, 0.55));
  o = vec4(col, smoothstep(0.004, 0.06, g.r)); gl_FragDepth = z; }"#;
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
fn con_defs(src: &str, defs: &str) -> String {
    let extra: String = std::env::var(if DEFS_B.load(std::sync::atomic::Ordering::Relaxed) { "JXM_FS_DEFS_B" } else { "JXM_FS_DEFS" }).map(|v| v.split(',').filter(|x| !x.is_empty()).map(|x| format!("#define {x}\n")).collect()).unwrap_or_default();
    let (a, b) = src.split_once('\n').unwrap(); format!("{a}\n{defs}{extra}{b}") }

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
    for (n, unidad) in [("uT", 0), ("uLM", 1), ("uSM", 2), ("uN", 0), ("uRef", 3), ("uP", 4), ("uT1", 5), ("uT2", 6), ("uT3", 7), ("uCubo", 8), ("uProf", 9), ("uAO", 10), ("uEsc", 11), ("uRefr", 12), ("uRefrP", 13), ("uNA", 14), ("uRay", 15), ("uHis", 12), ("uBlo", 10), ("uAd", 13), ("uGI", 14)] { if let Some(l) = gl.get_uniform_location(p, n) { gl.uniform_1_i32(Some(&l), unidad); } }
    Ok(Prog { p, u, piel: defs.contains("PIEL"), corte: defs.contains("CORTE") })
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
/// JX Turbo: la franja de la profundidad del arma (FL_ARMA): de 0 a esto; lo demás, de 0 a 1 (lo del mundo a menos de 8 cm
/// del plano de cerca cae ahí también: nada)
const FRANJA_ARMA: f32 = 0.01;
/// la secuencia de Halton (los corrimientos de la reconstrucción temporal): el número `i` en base `b`, entre 0 y 1
fn halton(mut i: u32, b: u32) -> f32 { let (mut f, mut r) = (1.0f32, 0.0f32); while i > 0 { f /= b as f32; r += f * (i % b) as f32; i /= b; } r }
/// el banco A/B (examples/rendimiento con JXM_AB): los cuadros se alternan entre la forma de siempre (A) y la que se prueba (B),
/// así lo que cambia la máquina entre corridas les toca igual a las dos; el código a probar pregunta `ab()`
pub static AB: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
pub fn ab() -> bool { AB.load(std::sync::atomic::Ordering::Relaxed) }
/// (en un cuadro B, si JXM_PRUEBA nombra esta prueba)
pub fn prueba(n: &str) -> bool { (ab() || std::env::var_os("JXM_PRUEBA_SIEMPRE").is_some()) && std::env::var("JXM_PRUEBA").map_or(false, |v| v.split(',').any(|x| x == n)) }
/// (mientras se arman los programas B: los defines de prueba salen de JXM_FS_DEFS_B)
static DEFS_B: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
/// una matriz de sombra (ortográfica: su w da siempre 1) que en vez de −1..1 da 0..1 —la posición en el mapa de sombras y su
/// profundidad—: cada fila x, y, z pasa a la mitad de ella más la mitad de la fila w
/// una matriz de sombra que deja todo afuera del mapa (x = 5,5 después de a_01): la cascada que no está
const FUERA: M4 = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 10.0, 0.0, 0.0, 1.0];
fn a_01(m: &M4) -> M4 { let mut r = *m; for c in 0..4 { for i in 0..3 { r[c * 4 + i] = 0.5 * m[c * 4 + i] + 0.5 * m[c * 4 + 3]; } } r }
/// el rectángulo de la pantalla (NDC, de −1 a 1) donde está el agua —sus esferas vistas con `v`— más lo que la corren las olas;
/// la pantalla entera si alguna rodea a la cámara
pub(crate) fn rect_agua(v: &M4, esferas: impl Iterator<Item = [f32; 4]>) -> ([f32; 2], [f32; 2]) {
    let (fx, fy) = ((v[0] * v[0] + v[4] * v[4] + v[8] * v[8]).sqrt(), (v[1] * v[1] + v[5] * v[5] + v[9] * v[9]).sqrt());
    let (mut lo, mut hi) = ([1.0f32; 2], [-1.0f32; 2]);
    for e in esferas {
        let w = v[3] * e[0] + v[7] * e[1] + v[11] * e[2] + v[15];
        if w <= e[3] * 1.05 { return ([-1.0; 2], [1.0; 2]); }
        let (x, y) = ((v[0] * e[0] + v[4] * e[1] + v[8] * e[2] + v[12]) / w, (v[1] * e[0] + v[5] * e[1] + v[9] * e[2] + v[13]) / w);
        let (rx, ry) = (e[3] * fx / w, e[3] * fy / w);
        lo = [lo[0].min(x - rx), lo[1].min(y - ry)]; hi = [hi[0].max(x + rx), hi[1].max(y + ry)];
    }
    let m = 0.15; ([(lo[0] - m).max(-1.0), (lo[1] - m).max(-1.0)], [(hi[0] + m).min(1.0), (hi[1] + m).min(1.0)])
}
/// los planos de la vista `vp` recortada al rectángulo r0..r1 (NDC) a los costados, con el cerca y el lejos de siempre
pub(crate) fn planos_rect(vp: &M4, r0: [f32; 2], r1: [f32; 2]) -> [[f32; 4]; 6] {
    let f = |i: usize| [vp[i], vp[4 + i], vp[8 + i], vp[12 + i]]; let (x, y, w) = (f(0), f(1), f(3));
    let pn = |a: [f32; 4], k: f32, b: [f32; 4]| { let q = [a[0] * k + b[0], a[1] * k + b[1], a[2] * k + b[2], a[3] * k + b[3]]; let l = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2]).sqrt().max(1e-12); [q[0] / l, q[1] / l, q[2] / l, q[3] / l] };
    let neg = |a: [f32; 4]| [-a[0], -a[1], -a[2], -a[3]]; let esc = |a: [f32; 4], k: f32| [a[0] * k, a[1] * k, a[2] * k, a[3] * k];
    let base = mat::planos(vp);
    [pn(x, 1.0, esc(w, -r0[0])), pn(neg(x), 1.0, esc(w, r1[0])), pn(y, 1.0, esc(w, -r0[1])), pn(neg(y), 1.0, esc(w, r1[1])), base[4], base[5]]
}
/// para rehacer el mundo desde la profundidad sin la inversa por píxel: el ojo, el rayo por cada punto de la pantalla (uv de
/// 0 a 1: r0 + u·rx + v·ry, medido para que la w de recorte crezca 1 por unidad) y lo que pasa de la profundidad (−1..1) a la
/// distancia por ese rayo: t = zl[0] / (z − zl[1])
/// dónde está el sol en la pantalla (0..1) y con qué fuerza van sus rayos (gpu.rs y gl2.rs), como postTerminar de post.js:
/// nada de noche o con el sol abajo; se apagan cuando el sol sale de la pantalla (del todo a 0,4 pantallas) y cuando no se
/// mira para su lado; como mucho 0,55
/// la luz en el aire: cuánto ilumina (por metro) el aire al sol —la bruma— y cuánto más el de los haces (el aire al sol de
/// un rayo de la vista que también cruza sombra: entre fierros, hojas, ventanas)
// (la mitad que antes: encandilaban y tapaban la vista mirando al sol)
pub(crate) const VOL_DENSIDAD: f32 = 0.0006; pub(crate) const VOL_HACES: f32 = 0.03;
/// las nubes y el disco del sol de Definitivo (para los dos cielos, el de OpenGL 3 y el de 2: sin texturas ni nada de ES 3):
/// una capa de nubes en un plano alto —el ruido de valor en 5 octavas, que se mueve con el viento—, con relieve (más claras del
/// lado del sol), el borde plateado mirando al sol, más finas en el horizonte y del color de la luz del mapa (anaranjadas al
/// atardecer, oscuras de noche)
/// el brillo promedio (de los logaritmos, con el medio pesando más) de un exterior de día: con eso la exposición queda en 1
pub(crate) const ADAPTA_CLAVE: f32 = 0.25;
/// el cielo Frutiger Aero de JXMod (todo propio, hecho con cuentas): azul intenso arriba que baja a un celeste casi blanco en
/// el horizonte, el sol con halo ancho y rayos suaves que giran despacio, nubes de algodón y burbujas de vidrio tornasoladas
/// que suben; de noche se apaga. GLSL que anda en OpenGL 3 y en OpenGL 2. `n`: las nubes de NUBES_GLSL
pub(crate) const FRUTIGER_GLSL: &str = r#"
float fru_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// (una capa de burbujas: el cielo en celdas de ángulo —n alrededor—, una burbuja en algunas, dentro de su celda —así no hay
// cortes—, redonda en pantalla —lo horizontal se achica con la altura— y subiendo con el tiempo)
vec3 fru_burbujas(vec3 c, float a, float e, float t, float n, float vel, float k) {
  float cs = 6.2831853 / n; vec2 p = vec2(a, e - t * vel) / cs; vec2 ce = floor(p); vec2 f = p - ce; ce.x = mod(ce.x, n);
  if (fru_h(ce + k) > 0.3) return c;
  vec2 o = vec2(0.5 + (fru_h(ce + k + 1.3) - 0.5) * 0.24, 0.5 + (fru_h(ce + k + 2.9) - 0.5) * 0.4); float r = 0.08 + 0.08 * fru_h(ce + k + 4.7);
  vec2 v = (f - o) / r; v.x *= cos(e); float dd = length(v);
  if (dd >= 1.0) return c;
  float borde = smoothstep(0.55, 1.0, dd), aa = 1.0 - smoothstep(0.88, 1.0, dd);
  vec3 iri = 0.5 + 0.5 * cos(6.2831853 * (dd * 0.8 + v.y * 0.3 + vec3(0.0, 0.33, 0.67)));
  float br = smoothstep(0.34, 0.0, length(v - vec2(-0.38, 0.42))) + 0.5 * smoothstep(0.18, 0.0, length(v - vec2(0.42, -0.45)));
  vec3 b = c * 1.06 + mix(vec3(0.9, 0.97, 1.0), iri, 0.45) * borde * borde * 0.6 + vec3(br * 0.85);
  return mix(c, min(b, vec3(1.0)), aa * smoothstep(0.03, 0.14, e) * (1.0 - smoothstep(0.75, 0.9, e)));
}
vec3 frutiger(vec3 d, vec3 s, float t, vec4 n) {
  float e = asin(clamp(d.y, -1.0, 1.0)), a = atan(d.z, d.x);
  vec3 cen = vec3(0.0, 0.27, 0.80), med = vec3(0.10, 0.58, 1.0), hor = vec3(0.80, 0.95, 1.0), aba = vec3(0.60, 0.88, 0.82);
  vec3 c = d.y >= 0.0 ? mix(mix(hor, med, smoothstep(0.0, 0.22, d.y)), cen, smoothstep(0.25, 0.95, d.y)) : mix(hor, aba, smoothstep(0.0, 0.25, -d.y));
  float k = max(dot(d, s), 0.0), vis = smoothstep(-0.08, 0.05, s.y);
  c += vec3(1.0, 0.97, 0.86) * vis * (pow(k, 6.0) * 0.30 + pow(k, 48.0) * 0.45);
  // (los rayos: bandas alrededor del sol, finas y anchas mezcladas)
  vec3 ej = normalize(cross(s, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0)); vec3 ek = cross(s, ej);
  float ang = atan(dot(d, ek), dot(d, ej)); float ry = 0.5 + 0.5 * sin(ang * 9.0 + t * 0.04) * sin(ang * 4.0 - t * 0.025 + 1.3); ry *= ry;
  c += vec3(0.86, 0.95, 1.0) * ry * pow(k, 2.5) * 0.30 * vis * smoothstep(-0.05, 0.1, d.y);
  c = mix(c, min(n.rgb * 1.08 + vec3(0.04, 0.05, 0.07), vec3(1.0)), n.a);
  c += vec3(1.0, 0.98, 0.9) * smoothstep(0.9993, 0.9997, k) * 1.4 * vis * (1.0 - n.a * 0.8);
  if (e > 0.0) { c = fru_burbujas(c, a, e, t, 20.0, 0.010, 0.0); c = fru_burbujas(c, a, e, t, 38.0, 0.016, 17.0); }
  float dia = smoothstep(-0.12, 0.12, s.y);
  return mix(c * vec3(0.07, 0.11, 0.24), c, dia);
}
"#;
pub(crate) const NUBES_GLSL: &str = r#"
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vr2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbmN(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vr2(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; } return s; }
vec4 nubes(vec3 d, vec3 sol, float t, vec3 solC, vec3 zen) {
  if (d.y < 0.015) return vec4(0.0);
  vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(t * 0.012, t * 0.005);
  float n = fbmN(uv), cob = smoothstep(0.58, 0.8, n);
  if (cob <= 0.0) return vec4(0.0);
  vec2 hs = sol.xz + vec2(1e-4); float n2 = fbmN(uv + normalize(hs) * 0.12);
  float luz = clamp(0.6 + (n - n2) * 4.0, 0.15, 1.3), sd = max(dot(d, sol), 0.0);
  float k = clamp(dot(solC, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0); vec3 sc = solC / max(max(solC.r, max(solC.g, solC.b)), 1e-3);
  // (la panza gris azulada, arriba blancas del lado del sol; más oscuras donde son más espesas)
  vec3 col = mix(zen * 0.45 + vec3(0.3, 0.32, 0.36), sc * 0.96, clamp(luz * 0.8 - (cob - 0.5) * 0.35, 0.0, 1.0)) * mix(0.3, 1.0, k);
  col += sc * pow(sd, 12.0) * 0.5 * (1.0 - cob) * k;
  return vec4(min(col, vec3(1.0)), cob * smoothstep(0.015, 0.2, d.y));
}
vec3 sol_disco(vec3 d, vec3 sol, vec3 solC) { float sd = max(dot(d, sol), 0.0); return solC * (smoothstep(0.99965, 0.9999, sd) * 6.0 + pow(sd, 400.0) * 0.5); }
"#;
pub(crate) fn sol_en_pantalla(c: &crate::escena::Cuadro, s: [f32; 3]) -> Option<[f32; 3]> {
    if s[1] < -0.05 { return None; }
    let l = &c.luz; let k = l.sol_c[0] * 0.2126 + l.sol_c[1] * 0.7152 + l.sol_c[2] * 0.0722; if k < 0.05 { return None; }
    let v = &c.vp; let (x, y, w) = (v[0] * s[0] + v[4] * s[1] + v[8] * s[2], v[1] * s[0] + v[5] * s[1] + v[9] * s[2], v[3] * s[0] + v[7] * s[1] + v[11] * s[2]);
    if w <= 0.0 { return None; }
    let (su, sv) = (x / w * 0.5 + 0.5, y / w * 0.5 + 0.5); let fuera = ((su - 0.5).abs() - 0.5).max((sv - 0.5).abs() - 0.5).max(0.0);
    let f = mat::norm([v[3], v[7], v[11]]); let rayo = (1.0 - fuera * 2.5).clamp(0.0, 1.0) * (mat::punto(f, s) * 2.0).clamp(0.0, 1.0) * 0.26;
    if rayo <= 0.01 { return None; }
    Some([su, sv, rayo])
}
pub(crate) fn rayos(vp: &M4) -> ([f32; 3], [f32; 3], [f32; 3], [f32; 3], [f32; 2]) {
    let iv = mat::inv(vp);
    let un = |x: f32, y: f32, z: f32| { let v = [iv[0] * x + iv[4] * y + iv[8] * z + iv[12], iv[1] * x + iv[5] * y + iv[9] * z + iv[13], iv[2] * x + iv[6] * y + iv[10] * z + iv[14], iv[3] * x + iv[7] * y + iv[11] * z + iv[15]]; [v[0] / v[3], v[1] / v[3], v[2] / v[3]] };
    let fw = |p: [f32; 3], w: f32| vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15] * w;
    let rayo = |x: f32, y: f32| { let (a, b) = (un(x, y, -1.0), un(x, y, 1.0)); let d = mat::sub(b, a); let k = fw(d, 0.0); ([d[0] / k, d[1] / k, d[2] / k], a) };
    let (r0, a) = rayo(-1.0, -1.0); let (r1, _) = rayo(1.0, -1.0); let (r2, _) = rayo(-1.0, 1.0);
    let s = -fw(a, 1.0); let ojo = [a[0] + r0[0] * s, a[1] + r0[1] * s, a[2] + r0[2] * s];
    let b = vp[2] * ojo[0] + vp[6] * ojo[1] + vp[10] * ojo[2] + vp[14]; let k = vp[2] * r0[0] + vp[6] * r0[1] + vp[10] * r0[2];
    (ojo, r0, mat::sub(r1, r0), mat::sub(r2, r0), [b, k])
}
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
    agua: Option<Agua>, agua_n: Option<glow::Texture>, agua_p: Option<glow::Texture>, /** la animación del agua (capas) y cuántos cuadros */ agua_na: Option<(glow::Texture, u32)>,
    cielo: Option<Cielo>, cubo: Option<glow::Texture>,
    blanca: glow::Texture,
    p_luz: Prog, p_luz_piel: Prog, p_luz_c: Prog, p_luz_piel_c: Prog, p_luz_inst_c: Prog, p_pre: Prog, p_pre_piel: Prog, p_pre_inst: Prog, p_sombra: Prog, p_sombra_piel: Prog, p_agua: Prog, p_cielo: Prog, p_ao: Prog, p_ao_poner: Prog, p_final: Prog, p_part: Prog, p_flu: Prog, p_flu_g: Prog, p_flu_bl: Prog, p_flu_c: Prog, p_lin: Prog, p_luz_inst: Prog, p_sombra_inst: Prog, inst_buf: glow::Buffer,
    part: (glow::VertexArray, glow::Buffer), flu: (glow::VertexArray, glow::Buffer), marcas: (glow::VertexArray, glow::Buffer, i32),
    p_ui: Prog, ui: (glow::VertexArray, glow::Buffer),
    ao_rt: Option<Destino>,
    /// la copia de la escena antes del agua (para ver el fondo corrido por las olas)
    refr_rt: Option<Destino>,
    /// la textura de las olas simuladas (EF_OLAS: la pendiente del agua en cada celda)
    olas_t: Option<glow::Texture>,
    /// el agua de partículas: la profundidad y el grosor, y dos para suavizar (a media resolución)
    flu_rt: [Option<Destino>; 3],
    sombra: Option<(glow::Framebuffer, glow::Texture, i32)>,
    reflejo: Option<Destino>,
    escena_rt: Option<Destino>,
    /// los rayos del sol: el programa y su destino (un cuarto del lado)
    p_rayos: Prog, p_rayos2: Prog, p_vol: Prog, p_vol_aaa: Prog, rayos_rt: Option<(Destino, Destino)>,
    /// el resplandor de Definitivo: los programas y la cadena de destinos (½, ¼, ⅛, 1/16)
    p_brillo: Prog, p_baja: Prog, p_sube: Prog, brillo_rt: Vec<Destino>,
    /// la vista que se acostumbra: el programa y sus dos texturas de 1×1 (una se lee, la otra se escribe), cuál toca y el tiempo
    p_adapta: Prog, adapta: Option<([(glow::Framebuffer, glow::Texture); 2], usize, f32)>,
    /// Definitivo: la altura del piso que se reflejó este cuadro (en `reflejo`, cuando no hay agua)
    refl_piso: Option<f32>, refl_piso_ult: (M4, f32), refl_agua: bool,
    /// la luz global: la textura de las sondas y su versión
    gi_tex: Option<glow::Texture>, gi_ver: f32,
    /// el hongo de las nucleares con volumen
    pub hongos: crate::hongo::Hongos,
    svp: M4,
    sesgo: [f32; 2],
    /// la cascada de lejos (la de cerca es svp/sesgo)
    svp2: M4, sesgo2: [f32; 2],
    /// el cuadro (sin sus cosas, que van en `items`)
    pub c: Option<Cuadro>,
    items: Vec<ItemDin>,
    pub cuadro: u64,
    pub dibujos: u32,
    /// el modo VR: dónde empieza en x la mitad de la pantalla de este ojo (la pasada final va ahí; el otro ojo queda)
    pub vx: i32,
    opacos: Vec<usize>, transp: Vec<usize>, aguas: Vec<usize>,
    /// lo que ocupa en la placa (mallas, texturas y luces horneadas), en bytes
    pub memoria: usize,
    /// los lugares fijos de las cosas (cuadros JXC2)
    pub ranuras: Vec<Option<ItemDin>>,
    /// dibujar con instancias las copias de una misma cosa (se puede apagar para comparar: JXM_SIN_INST)
    pub instancias: bool,
    /// (las variables de las pruebas, leídas una vez al crear el motor: no en cada cuadro)
    dbg: bool, sin_agua: bool,
    /// la oclusión por consultas: por cosa (su clave), la consulta, si espera respuesta, si se vio y el último cuadro en que se
    /// probó; la caja de prueba (un cubo de 0 a 1) y lo que este cuadro no se dibuja por tapado
    oclu: HashMap<u64, (glow::Query, bool, bool, u64)>,
    /// la huella de lo que se dibujó en cada mitad de la sombra (la matriz y cada cosa con su lugar y sus huesos): si no cambió, la mitad se deja como está
    sombra_huella: [u64; 2], cubo_oclu: (glow::VertexArray, glow::Buffer, glow::Buffer), tapados: Vec<bool>,
    /// las luces que ya están puestas en el programa de ahora (para no volver a mandarlas si la cosa siguiente usa las mismas)
    luces_puestas: std::cell::Cell<(u64, u32)>,
    /// JX Turbo: la cámara del último cuadro dibujado, su destino corrido, el programa que lo corre y lo de la pasada final
    vp_ult: Option<M4>, corte_ult: f32, final_rt: Option<Destino>, p_repro: Prog, p_copia: Prog,
    /// la reconstrucción temporal: los dos destinos a la resolución de la pantalla (lo juntado), cuál es el de ahora, la cámara
    /// del cuadro anterior y la de este sin correr, el número de cuadro (Halton) y el corrimiento de este
    taa_rt: [Option<Destino>; 2], taa_i: usize, taa_vp: Option<M4>, taa_vp0: Option<M4>, taa_n: u32, taa_jit: [f32; 2], p_taa: Prog, pub reloj: Option<crate::reloj::Reloj>,
    /// lo puesto en la placa dentro de una tanda de dibujos (dibujar_lista_con): la malla, las texturas, y por programa el
    /// material y la posición —como OpenGL 2: no rehacer lo mismo—; las llamadas hechas y las que se ahorraron
    puesto: std::cell::RefCell<Option<Puesto3>>, pub llamadas: std::cell::Cell<[u32; 2]>,
    /// la oclusión va dentro de la pasada de luz (calculada antes, con la profundidad) y el tamaño de la escena
    ao_luz: bool, esc_wh: (f32, f32),
    /// (JXM_FASES: lo que tarda cada pasada, esperando a la placa en cada una —para medir, no para jugar—)
    pub fases: Option<(std::time::Instant, Vec<(&'static str, f64)>)>,
    /// (las fases de los cuadros B del banco A/B: ver `AB`)
    pub fases_b: Vec<(&'static str, f64)>,
    perfil: Option<std::cell::RefCell<Vec<(bool, bool, i64, i64, u32, u32, f64)>>>,
    /// (los programas de la luz con JXM_FS_DEFS_B, para los cuadros B del banco A/B)
    luz_b: Option<Box<[Prog; 6]>>,
    /// el gráfico Simple: los seis programas de luz con SIMPLE (se arman la primera vez)
    luz_s: Option<Box<[Prog; 6]>>,
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
        // (con CORTE: los que descartan —el recorte del reflejo y lo calado—; los demás no, y así la placa descarta lo tapado
        // antes de pintarlo)
        // (la pasada de profundidad: el mismo sombreado de vértices que la de luz —las mismas posiciones— y nada de color)
        let p_pre = programa(&gl, VS_LUZ, FS_SOMBRA, "")?; let p_pre_piel = programa(&gl, VS_LUZ, FS_SOMBRA, "#define PIEL\n")?; let p_pre_inst = programa(&gl, VS_LUZ, FS_SOMBRA, "#define INST\n")?;
        let luz_b = if std::env::var_os("JXM_FS_DEFS_B").is_some() {
            DEFS_B.store(true, std::sync::atomic::Ordering::Relaxed);
            let r = (|| -> Result<[Prog; 6], String> { Ok([programa(&gl, VS_LUZ, FS_LUZ, "")?, programa(&gl, VS_LUZ, FS_LUZ, "#define PIEL\n")?, programa(&gl, VS_LUZ, FS_LUZ, "#define INST\n")?,
                programa(&gl, VS_LUZ, FS_LUZ, "#define CORTE\n")?, programa(&gl, VS_LUZ, FS_LUZ, "#define PIEL\n#define CORTE\n")?, programa(&gl, VS_LUZ, FS_LUZ, "#define INST\n#define CORTE\n")?]) })();
            DEFS_B.store(false, std::sync::atomic::Ordering::Relaxed); Some(Box::new(r?))
        } else { None };
        let p_luz_c = programa(&gl, VS_LUZ, FS_LUZ, "#define CORTE\n")?; let p_luz_piel_c = programa(&gl, VS_LUZ, FS_LUZ, "#define PIEL\n#define CORTE\n")?; let p_luz_inst_c = programa(&gl, VS_LUZ, FS_LUZ, "#define INST\n#define CORTE\n")?;
        let p_sombra_inst = programa(&gl, VS_SOMBRA, FS_SOMBRA, "#define INST\n")?;
        let inst_buf = gl.create_buffer()?;
        // (la caja de las pruebas de oclusión: un cubo de 0 a 1, con sus 12 triángulos)
        let cubo_oclu = {
            let v: [f32; 24] = [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0];
            let i: [u16; 36] = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
            let vao = gl.create_vertex_array()?; gl.bind_vertex_array(Some(vao));
            let vb = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(vb)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32_bytes(&v), glow::STATIC_DRAW);
            gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 3, glow::FLOAT, false, 12, 0);
            let ib = gl.create_buffer()?; gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(ib));
            gl.buffer_data_u8_slice(glow::ELEMENT_ARRAY_BUFFER, std::slice::from_raw_parts(i.as_ptr() as *const u8, 72), glow::STATIC_DRAW);
            gl.bind_vertex_array(None); (vao, vb, ib)
        };
        let p_agua = programa(&gl, VS_LUZ, FS_AGUA, "")?;
        let p_cielo = programa(&gl, VS_CIELO, &FS_CIELO.replace("@@NUBES@@", &format!("{NUBES_GLSL}\n{FRUTIGER_GLSL}")), "")?;
        let p_ao = programa(&gl, VS_CIELO, FS_AO, "")?;
        let p_ao_poner = programa(&gl, VS_CIELO, FS_AO_PONER, "")?;
        let p_final = programa(&gl, VS_CIELO, FS_FINAL, "")?; let p_taa = programa(&gl, VS_CIELO, FS_TAA, "")?; let p_repro = programa(&gl, VS_CIELO, FS_REPRO, if std::env::var_os("JXM_VER_CORTE").is_some() { "#define VER_CORTE\n" } else { "" })?; let p_copia = programa(&gl, VS_CIELO, FS_COPIA, "")?; let p_adapta = programa(&gl, VS_CIELO, FS_ADAPTA, "")?;
        let p_rayos = programa(&gl, VS_CIELO, FS_RAYMASK, "")?; let p_rayos2 = programa(&gl, VS_CIELO, FS_RAYOS, "")?; let p_vol = programa(&gl, VS_CIELO, FS_VOL, "")?; let p_vol_aaa = programa(&gl, VS_CIELO, FS_VOL, "#define PASOS 24\n")?;
        let p_brillo = programa(&gl, VS_CIELO, FS_BRILLO, "")?; let p_baja = programa(&gl, VS_CIELO, FS_BAJA, "")?; let p_sube = programa(&gl, VS_CIELO, FS_SUBE, "")?;
        let p_part = programa(&gl, VS_PART, FS_PART, "")?;
        let p_flu = programa(&gl, VS_FLU, FS_FLU_Z, "")?; let p_flu_g = programa(&gl, VS_FLU, FS_FLU_G, "")?;
        let p_flu_bl = programa(&gl, VS_CIELO, FS_FLU_BL, "")?; let p_flu_c = programa(&gl, VS_CIELO, FS_FLU_C, "")?;
        let p_lin = programa(&gl, VS_LIN, FS_LIN, "")?;
        let p_ui = programa(&gl, VS_UI, FS_UI, "")?;
        let vbo = |atr: &[(u32, i32, i32)], paso: i32| -> Result<(glow::VertexArray, glow::Buffer), String> {
            let v = gl.create_vertex_array()?; gl.bind_vertex_array(Some(v)); let b = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(b));
            for &(l, n, o) in atr { gl.enable_vertex_attrib_array(l); gl.vertex_attrib_pointer_f32(l, n, glow::FLOAT, false, paso, o); }
            gl.bind_vertex_array(None); Ok((v, b))
        };
        let part = vbo(&[(0, 3, 0), (1, 4, 12), (2, 3, 28), (3, 3, 40), (4, 3, 52)], 64)?;
        gl.bind_vertex_array(Some(part.0)); for l in 0..5 { gl.vertex_attrib_divisor(l, 1); } gl.bind_vertex_array(None);
        let flu = vbo(&[(0, 4, 0)], (FLU_POR * 4) as i32)?; gl.bind_vertex_array(Some(flu.0)); gl.vertex_attrib_divisor(0, 1); gl.bind_vertex_array(None);
        let mv = vbo(&[(0, 3, 0), (1, 4, 12)], 28)?; let marcas = (mv.0, mv.1, 0);
        let ui = vbo(&[(0, 2, 0), (1, 2, 8), (2, 4, 16)], 32)?;
        let blanca = textura(&gl, 1, 1, &[255, 255, 255, 255], true, false);
        let reloj = crate::reloj::Reloj::nuevo(&gl);
        Ok(Motor { vx: 0, gi_tex: None, gi_ver: -1.0, refl_agua: false, refl_piso: None, refl_piso_ult: (mat::id(), f32::NAN), p_adapta, adapta: None, p_rayos, p_rayos2, p_vol, p_vol_aaa, p_brillo, p_baja, p_sube, brillo_rt: vec![], rayos_rt: None, hongos: crate::hongo::Hongos::nuevo(true), gl, op, mallas: HashMap::new(), mats: HashMap::new(), texs: HashMap::new(), lms: HashMap::new(), agua: None, agua_n: None, agua_p: None, agua_na: None, cielo: None, cubo: None, blanca,
            p_luz, p_luz_piel, p_luz_c, p_luz_piel_c, p_luz_inst_c, p_pre, p_pre_piel, p_pre_inst, p_sombra, p_sombra_piel, p_agua, p_cielo, p_ao, p_ao_poner, p_final, p_part, p_flu, p_flu_g, p_flu_bl, p_flu_c, flu_rt: [None, None, None], p_lin, p_ui, ui, p_luz_inst, p_sombra_inst, inst_buf, part, flu, marcas, ao_rt: None, refr_rt: None, olas_t: None, sombra: None, reflejo: None, escena_rt: None, svp: mat::id(), sesgo: [0.0, 0.0], svp2: mat::id(), sesgo2: [0.0, 0.0], c: None, items: vec![], cuadro: 0, dibujos: 0,
            opacos: vec![], transp: vec![], aguas: vec![], memoria: 0, mapa: String::new(), ranuras: Vec::new(), instancias: std::env::var("JXM_SIN_INST").is_err(),
            ao_luz: false, esc_wh: (1.0, 1.0), oclu: HashMap::new(), sombra_huella: [0; 2], cubo_oclu, tapados: vec![], luces_puestas: std::cell::Cell::new((0, u32::MAX)), vp_ult: None, corte_ult: 0.0, final_rt: None, p_repro, p_copia, luz_s: None, taa_rt: [None, None], taa_i: 0, taa_vp: None, taa_vp0: None, taa_n: 0, taa_jit: [0.0; 2], p_taa, reloj, puesto: std::cell::RefCell::new(None), llamadas: std::cell::Cell::new([0; 2]), dbg: std::env::var("JXM_DBG").is_ok(), sin_agua: std::env::var("JXM_SIN_AGUA").is_ok(), fases: std::env::var("JXM_FASES").is_ok().then(|| (std::time::Instant::now(), vec![])), fases_b: vec![], luz_b, perfil: std::env::var_os("JXM_PERFIL").map(|_| std::cell::RefCell::new(vec![])) })
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
            if let Some(n) = &a.normal { if let Some(v) = self.agua_n.take() { gl.delete_texture(v); } self.agua_n = Some(textura(gl, n.w, n.h, rango(n.o, (n.w * n.h * 4) as usize)?, true, true));
                if let Some((v, _)) = self.agua_na.take() { gl.delete_texture(v); }
                // (la animación: los cuadros como capas de una textura, con sus niveles chicos)
                if n.n > 1 { let px = rango(n.o, (n.w * n.h * 4 * n.n) as usize)?; let t = gl.create_texture()?; gl.bind_texture(glow::TEXTURE_2D_ARRAY, Some(t));
                    gl.tex_image_3d(glow::TEXTURE_2D_ARRAY, 0, glow::RGBA8 as i32, n.w as i32, n.h as i32, n.n as i32, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(px)));
                    gl.generate_mipmap(glow::TEXTURE_2D_ARRAY);
                    gl.tex_parameter_i32(glow::TEXTURE_2D_ARRAY, glow::TEXTURE_MIN_FILTER, glow::LINEAR_MIPMAP_LINEAR as i32); gl.tex_parameter_i32(glow::TEXTURE_2D_ARRAY, glow::TEXTURE_MAG_FILTER, glow::LINEAR as i32);
                    gl.tex_parameter_i32(glow::TEXTURE_2D_ARRAY, glow::TEXTURE_WRAP_S, glow::REPEAT as i32); gl.tex_parameter_i32(glow::TEXTURE_2D_ARRAY, glow::TEXTURE_WRAP_T, glow::REPEAT as i32);
                    self.agua_na = Some((t, n.n)); } }
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
        if let Some((t, _)) = self.agua_na.take() { gl.delete_texture(t); }
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
            // (lo que en la pantalla mide menos de medio píxel no se ve: afuera)
            if self.esc_wh.1 > 16.0 && mt.agua == 0 {
                let v = &c.vp; let w = v[3] * it.esf[0] + v[7] * it.esf[1] + v[11] * it.esf[2] + v[15];
                if w > it.esf[3] * 2.0 { let fy = (v[1] * v[1] + v[5] * v[5] + v[9] * v[9]).sqrt(); if it.esf[3] * fy / w * self.esc_wh.1 * 0.5 < 0.5 { continue; } }
            }
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
        // (dentro de una tanda: lo que ya está puesto no se vuelve a poner —se cuenta lo hecho y lo ahorrado—)
        let mut pu = self.puesto.borrow_mut(); let ll = &self.llamadas;
        let cuenta = |n: u32, si: bool| { let mut v = ll.get(); v[1] += n; if si { v[0] += n; } ll.set(v); si };
        let hace = |pu: &Option<Puesto3>, n: u32, cambia: &dyn Fn(&Puesto3) -> bool| cuenta(n, pu.as_ref().map_or(true, |x| cambia(x)));
        if hace(&pu, 1, &|x| x.vao != Some(m.vao)) { gl.bind_vertex_array(Some(m.vao)); if let Some(x) = pu.as_mut() { x.vao = Some(m.vao); } }
        if n <= 1 && hace(&pu, 1, &|x| x.mm.get(&p.p) != Some(&it.mm)) { gl.uniform_matrix_4_f32_slice(p.u(U::M), false, &it.mm); if let Some(x) = pu.as_mut() { x.mm.insert(p.p, it.mm); } }   // (con n > 1 las matrices ya están en el búfer de instancias)
        if hace(&pu, 2, &|x| x.pos.get(&p.p) != Some(&(m.mn, m.sc))) { gl.uniform_3_f32(p.u(U::Mn), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u(U::Sc), m.sc[0], m.sc[1], m.sc[2]); if let Some(x) = pu.as_mut() { x.pos.insert(p.p, (m.mn, m.sc)); } }
        if p.piel { let n = it.h.len().min(MAX_HUESOS * 12) / 4 * 4; gl.uniform_4_f32_slice(p.u(U::B), &it.h[..n]); }
        if conluz {
            let Some(mt) = self.mats.get(&it.mat) else { return };
            let tx = |i: i64| self.texs.get(&i).map(|t| t.t).unwrap_or(self.blanca);
            let lm = self.lms.get(&m.lm);
            let mut modo = (lm.is_some() as i32) | if mt.cut != 0 { 2 } else { 0 } | if mt.unlit != 0 { 4 } else { 0 } | if mt.cut != 0 || mt.blend != 0 { 32 } else { 0 } | if mt.fol != 0 { 64 } else { 0 };
            let terr = mt.terr.as_ref().filter(|t| t.len() == 3);
            if terr.is_some() { modo |= 16; } else if mt.t2 >= 0 { modo |= 8; }
            // (las texturas de cada unidad)
            let poner = |pu: &mut Option<Puesto3>, u: u32, t: glow::Texture| {
                if cuenta(2, pu.as_ref().map_or(true, |x| x.tex[u.min(7) as usize] != Some(t))) {
                    if pu.as_ref().map_or(true, |x| x.unidad != Some(u)) { gl.active_texture(glow::TEXTURE0 + u); }
                    gl.bind_texture(glow::TEXTURE_2D, Some(t)); if let Some(x) = pu.as_mut() { x.unidad = Some(u); x.tex[u.min(7) as usize] = Some(t); } }
            };
            poner(&mut pu, 0, tx(mt.t));
            if let Some(l) = lm { poner(&mut pu, 1, l.t); }
            if let Some(tr) = terr { for (k, c) in tr.iter().enumerate() { poner(&mut pu, 5 + k as u32, tx(c.0)); } } else if mt.t2 >= 0 { poner(&mut pu, 5, tx(mt.t2)); }
            // (lo del material, si este programa no lo tiene puesto)
            if hace(&pu, 8, &|x| x.mat.get(&p.p) != Some(&(it.mat, modo))) {
                gl.uniform_4_f32(p.u(U::St), mt.st[0], mt.st[1], mt.st[2], mt.st[3]);
                gl.uniform_4_f32(p.u(U::C), mt.c[0], mt.c[1], mt.c[2], mt.c[3]);
                gl.uniform_3_f32(p.u(U::Em), mt.em[0], mt.em[1], mt.em[2]); gl.uniform_4_f32_slice(p.u(U::Ti), &mt.ti[0..4]); gl.uniform_4_f32_slice(p.u(U::Ti2), &mt.ti[4..8]); gl.uniform_4_f32_slice(p.u(U::Ti3), &mt.ti[8..12]); gl.uniform_3_f32(p.u(U::Mat), mt.pbr[0], mt.pbr[1], mt.pbr[2]);
                if let Some(tr) = terr { gl.uniform_4_f32(p.u(U::S1), tr[0].1, tr[0].2, tr[1].1, tr[1].2); gl.uniform_2_f32(p.u(U::S3), tr[2].1, tr[2].2); }
                gl.uniform_1_i32(p.u(U::Modo), modo);
                if let Some(x) = pu.as_mut() { x.mat.insert(p.p, (it.mat, modo)); }
            }
        }
        drop(pu); cuenta(1, true);
        let (tipo, off) = (if m.i32 { glow::UNSIGNED_INT } else { glow::UNSIGNED_SHORT }, (it.s0 * if m.i32 { 4 } else { 2 }) as i32);
        if n > 1 {
            gl.draw_elements_instanced(glow::TRIANGLES, it.sn as i32, tipo, off, n);
            for k in 0..4u32 { gl.disable_vertex_attrib_array(6 + k); }
        } else { gl.draw_elements(glow::TRIANGLES, it.sn as i32, tipo, off); }
    }

    /// (lo sumado —haces de luz, brillos— se pierde en la niebla yendo a negro, como en Source: si tomara el color de la
    /// niebla, un haz lejano —el de gm_construct_win7 en su cielo 3D— se vuelve una cuña blanca que tapa el cielo)
    unsafe fn niebla_suma(&self, p: &Prog, suma: bool) {
        let gl = &self.gl; let l = &self.c.as_ref().unwrap().luz;
        if suma { gl.uniform_3_f32(p.u(U::NieC), 0.0, 0.0, 0.0); gl.uniform_3_f32(p.u(U::NieS), 0.0, 0.0, 0.0); gl.uniform_4_f32(p.u(U::Nubes), 0.0, 0.0, 0.0, 0.0); }
        else { gl.uniform_3_f32(p.u(U::NieC), l.nie.c[0], l.nie.c[1], l.nie.c[2]); gl.uniform_3_f32(p.u(U::NieS), l.nie.s[0], l.nie.s[1], l.nie.s[2]); gl.uniform_4_f32(p.u(U::Nubes), if self.op.aaa { 1.0 } else { 0.0 }, 0.0, 0.0, 0.0); }
    }

    /// los uniformes de la pasada (cámara, sol, cielo, niebla, sombra y luces) en un programa
    unsafe fn luces(&self, p: &Prog, vp: &M4, clip: f32) {
        let gl = &self.gl; let c = self.c.as_ref().unwrap(); let l = &c.luz; let s = self.sol(); let cp = &c.pos;
        gl.use_program(Some(p.p));
        gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp); gl.uniform_matrix_4_f32_slice(p.u(U::SVP), false, &a_01(&self.svp)); gl.uniform_matrix_4_f32_slice(p.u(U::SVP2), false, &a_01(&self.svp2));
        gl.uniform_3_f32(p.u(U::Sol), s[0], s[1], s[2]); gl.uniform_3_f32(p.u(U::SolC), l.sol_c[0], l.sol_c[1], l.sol_c[2]);
        gl.uniform_3_f32(p.u(U::AmbS), l.amb_s[0], l.amb_s[1], l.amb_s[2]); gl.uniform_3_f32(p.u(U::AmbG), l.amb_g[0], l.amb_g[1], l.amb_g[2]);
        gl.uniform_3_f32(p.u(U::NieC), l.nie.c[0], l.nie.c[1], l.nie.c[2]); gl.uniform_3_f32(p.u(U::Nie), l.nie.a, l.nie.b, if l.nie.m > 0.0 { l.nie.m } else { 1.0 });
        gl.uniform_3_f32(p.u(U::NieS), l.nie.s[0], l.nie.s[1], l.nie.s[2]);
        gl.uniform_3_f32(p.u(U::Cam), cp[0], cp[1], cp[2]); gl.uniform_1_f32(p.u(U::Expo), l.expo);
        // (el cielo para el reflejo del cielo en las superficies)
        let (top, mid, bot, ex, k) = self.cielo.as_ref().map(|c| (c.top, c.mid, c.bot, c.exp, c.k)).unwrap_or(([0.28, 0.64, 1.0], [0.92, 0.92, 0.92], [0.53, 0.58, 0.68], [0.5, 0.5], 1.0));
        gl.uniform_3_f32(p.u(U::Top), top[0], top[1], top[2]); gl.uniform_3_f32(p.u(U::Mid), mid[0], mid[1], mid[2]); gl.uniform_3_f32(p.u(U::Bot), bot[0], bot[1], bot[2]);
        gl.uniform_2_f32(p.u(U::Exp), ex[0], ex[1]); gl.uniform_1_f32(p.u(U::CieloK), k);
        gl.uniform_4_f32(p.u(U::Nubes), if self.op.aaa { 1.0 } else { 0.0 }, 0.0, 0.0, 0.0);
        gl.uniform_1_f32(p.u(U::Sombra), if self.op.sombras && self.sombra.is_some() { 1.0 } else { 0.0 });
        gl.uniform_1_f32(p.u(U::Clip), clip);
        // (la luz global de las sondas)
        match (c.efectos.iter().find(|e| e.0 == EF_GI).filter(|_| self.op.aaa), self.gi_tex) {
            (Some(e), Some(t)) if e.1.len() >= 8 => { gl.uniform_4_f32(p.u(U::GIo), e.1[0], e.1[1], e.1[2], 1.0 / e.1[3].max(0.01)); gl.uniform_4_f32(p.u(U::GIn), e.1[4], e.1[5], e.1[6], 1.0);
                gl.active_texture(glow::TEXTURE14); gl.bind_texture(glow::TEXTURE_2D, Some(t)); gl.active_texture(glow::TEXTURE0); }
            _ => gl.uniform_4_f32(p.u(U::GIn), 1.0, 1.0, 1.0, 0.0),
        }
        // (el reflejo del piso: en la pasada de la escena —no en la del reflejo mismo—)
        match (self.refl_piso.filter(|_| clip < -1e8), self.reflejo.as_ref()) {
            (Some(y), Some(r)) => { gl.uniform_4_f32(p.u(U::RP), 1.0 / self.esc_wh.0, 1.0 / self.esc_wh.1, 1.0, y); gl.active_texture(glow::TEXTURE3); gl.bind_texture(glow::TEXTURE_2D, Some(r.color)); gl.active_texture(glow::TEXTURE0); }
            _ => gl.uniform_4_f32(p.u(U::RP), 0.0, 0.0, 0.0, 0.0),
        }
        // (las cáusticas debajo del agua: con el retoque, si hay agua en el mapa)
        match (self.agua.as_ref().filter(|a| self.op.retoque && (a.prof.is_some() || !self.aguas.is_empty())), c.agua_y.or(self.agua.as_ref().map(|a| a.y))) {
            (Some(a), Some(ay)) => {
                let (x0, z0, x1, z1) = a.prof.as_ref().map(|q| (q.x0, q.z0, q.x0 + q.w, q.z0 + q.h)).unwrap_or((-1e9, -1e9, 1e9, 1e9));
                gl.uniform_4_f32(p.u(U::Caus), ay, 1.0, c.tiempo, 0.0); gl.uniform_4_f32(p.u(U::CausB), x0, z0, x1, z1);
            }
            _ => gl.uniform_4_f32(p.u(U::Caus), 0.0, 0.0, 0.0, 0.0),
        }
        gl.uniform_2_f32(p.u(U::Sesgo), self.sesgo[0], self.sesgo[1]); gl.uniform_2_f32(p.u(U::Sesgo2), self.sesgo2[0], self.sesgo2[1]);
        // (la oclusión en la luz: en la pasada de la escena, sin el recorte del reflejo y sin lo calado —que no está en la profundidad—)
        let aok = if self.ao_luz && clip < -1e8 && !p.corte { (self.op.ao_fuerza * 1.15).min(1.0) } else { 0.0 };
        gl.uniform_4_f32(p.u(U::AOk), 1.0 / self.esc_wh.0, 1.0 / self.esc_wh.1, aok, 0.0);
        if aok > 0.0 { if let Some(a) = &self.ao_rt { gl.active_texture(glow::TEXTURE10); gl.bind_texture(glow::TEXTURE_2D, Some(a.color)); gl.active_texture(glow::TEXTURE0); } }
        if let Some((_, t, _)) = &self.sombra { gl.active_texture(glow::TEXTURE2); gl.bind_texture(glow::TEXTURE_2D, Some(*t)); }
        if p.u(U::LN).is_some() {
            let (nl, ne) = (c.luces.len().min(MAX_LUCES), c.esp.len().min(MAX_LUCES - c.luces.len().min(MAX_LUCES)));
            let mut a = [[0f32; 4 * MAX_LUCES]; 3];
            for (i, q) in c.luces.iter().take(nl).chain(c.esp.iter().take(ne)).enumerate() { for k in 0..3 { a[k][i * 4..i * 4 + 4].copy_from_slice(&q[k * 4..k * 4 + 4]); } }
            gl.uniform_4_f32_slice(p.u(U::LP), &a[0]); gl.uniform_4_f32_slice(p.u(U::LC), &a[1]); gl.uniform_4_f32_slice(p.u(U::LD), &a[2]);
            gl.uniform_1_i32(p.u(U::LN), (nl + ne) as i32); gl.uniform_1_i32(p.u(U::LE), nl as i32);
            self.luces_puestas.set((p.p.0.get() as u64, if nl + ne >= 32 { u32::MAX } else { (1u32 << (nl + ne)) - 1 }));
        }
    }

    /// la clave de una cosa para la oclusión (su malla, su parte, su material y dónde está), si vale la pena probarla: sin
    /// huesos, con al menos 32 triángulos y no pegada a la cámara (la caja de lo que rodea a la cámara no se puede probar)
    fn oclu_clave(&self, i: usize) -> Option<u64> {
        let it = &self.items[i]; let c = self.c.as_ref()?;
        if !it.h.is_empty() || it.sn < 96 || it.esf[3] < 0.3 { return None; }
        let (x, y, z) = (it.esf[0] - c.pos[0], it.esf[1] - c.pos[1], it.esf[2] - c.pos[2]);
        if (x * x + y * y + z * z).sqrt() < it.esf[3] * 1.8 + 1.5 { return None; }
        let q = |v: f32| (v * 4.0).round() as i64 as u64;
        let mut h = (it.m as u64).wrapping_mul(0x9E3779B97F4A7C15) ^ (it.s0 as u64).wrapping_mul(0xC2B2AE3D27D4EB4F) ^ (it.mat as u64).wrapping_mul(0x165667B19E3779F9);
        for v in [q(it.esf[0]), q(it.esf[1]), q(it.esf[2])] { h = (h ^ v).wrapping_mul(0x100000001B3); }
        Some(h)
    }
    /// los resultados de las pruebas que ya llegaron (sin esperar: la que no llegó sigue como estaba)
    unsafe fn oclu_leer(&mut self) {
        let gl = &self.gl;
        for e in self.oclu.values_mut() { if e.1 && gl.get_query_parameter_u32(e.0, glow::QUERY_RESULT_AVAILABLE) != 0 { e.2 = gl.get_query_parameter_u32(e.0, glow::QUERY_RESULT) != 0; e.1 = false; } }
    }
    /// prueba la caja de cada candidata contra la profundidad (sin escribir nada): si algún píxel de la caja queda adelante, se
    /// ve; si no, la cosa está tapada del todo. Las que no se prueban hace rato se olvidan
    unsafe fn oclu_probar(&mut self, vp: &M4, cand: &[(usize, u64)]) {
        if cand.is_empty() { return; }
        let gl = &self.gl; let p = &self.p_sombra;
        gl.depth_mask(false); gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp); gl.uniform_matrix_4_f32_slice(p.u(U::M), false, &mat::id());
        gl.bind_vertex_array(Some(self.cubo_oclu.0));
        for &(i, k) in cand {
            let e = self.items[i].esf;
            let ent = match self.oclu.get_mut(&k) { Some(x) => x, None => { let Ok(q) = gl.create_query() else { continue }; self.oclu.entry(k).or_insert((q, false, true, self.cuadro)) } };
            ent.3 = self.cuadro; if ent.1 { continue; }
            // (lo que se ve se vuelve a probar cada 4 cuadros —cada una en su turno—; lo tapado, siempre: reaparece enseguida)
            if ent.2 && (self.cuadro + (k & 3)) % 4 != 0 { continue; }
            // (lo que ocupa más de un tercio de la pantalla casi nunca queda tapado del todo y su caja cuesta: se da por visto)
            let w = vp[3] * e[0] + vp[7] * e[1] + vp[11] * e[2] + vp[15]; let fy = (vp[1] * vp[1] + vp[5] * vp[5] + vp[9] * vp[9]).sqrt();
            if w <= 0.0 || e[3] * fy / w > 0.33 { ent.2 = true; continue; }
            let r = e[3] * 1.02 + 0.02;
            gl.uniform_3_f32(p.u(U::Mn), e[0] - r, e[1] - r, e[2] - r); gl.uniform_3_f32(p.u(U::Sc), 2.0 * r, 2.0 * r, 2.0 * r);
            gl.begin_query(glow::ANY_SAMPLES_PASSED_CONSERVATIVE, ent.0); gl.draw_elements(glow::TRIANGLES, 36, glow::UNSIGNED_SHORT, 0); gl.end_query(glow::ANY_SAMPLES_PASSED_CONSERVATIVE);
            ent.1 = true;
        }
        gl.bind_vertex_array(None); gl.depth_mask(true);
        let viejo = self.cuadro.saturating_sub(300);
        let fuera: Vec<u64> = self.oclu.iter().filter(|(_, e)| e.3 < viejo && !e.1).map(|(k, _)| *k).collect();
        for k in fuera { if let Some(e) = self.oclu.remove(&k) { gl.delete_query(e.0); } }
        self.dibujos += cand.len() as u32;
    }

    /// las luces que tocan estas cosas (la esfera de la luz contra la de cada cosa): sólo esas van al programa —el resto no
    /// suma nada y cada píxel deja de recorrerlas—; si son las mismas que ya están puestas, no se mandan de nuevo
    unsafe fn luces_de(&self, p: &Prog, esf: &[[f32; 4]]) {
        if p.u(U::LN).is_none() { return; }
        let Some(c) = self.c.as_ref() else { return };
        let (nl, ne) = (c.luces.len().min(MAX_LUCES), c.esp.len().min(MAX_LUCES - c.luces.len().min(MAX_LUCES)));
        let toca = |q: &crate::escena::LuzP| esf.iter().any(|e| { let (x, y, z) = (q[0] - e[0], q[1] - e[1], q[2] - e[2]); let r = q[3] + e[3]; x * x + y * y + z * z <= r * r });
        let mut mascara = 0u32;
        for (i, q) in c.luces.iter().take(nl).chain(c.esp.iter().take(ne)).enumerate() { if toca(q) { mascara |= 1 << i; } }
        let prog = p.p.0.get() as u64;
        if self.luces_puestas.get() == (prog, mascara) { return; }
        self.luces_puestas.set((prog, mascara));
        let gl = &self.gl; let mut a = [[0f32; 4 * MAX_LUCES]; 3]; let (mut n, mut le) = (0usize, 0i32);
        for (i, q) in c.luces.iter().take(nl).chain(c.esp.iter().take(ne)).enumerate() {
            if mascara & (1 << i) == 0 { continue; }
            for k in 0..3 { a[k][n * 4..n * 4 + 4].copy_from_slice(&q[k * 4..k * 4 + 4]); } if i < nl { le += 1; } n += 1;
        }
        gl.uniform_4_f32_slice(p.u(U::LP), &a[0]); gl.uniform_4_f32_slice(p.u(U::LC), &a[1]); gl.uniform_4_f32_slice(p.u(U::LD), &a[2]);
        gl.uniform_1_i32(p.u(U::LN), n as i32); gl.uniform_1_i32(p.u(U::LE), le);
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
        let t = self.c.as_ref().map_or(0.0, |c| c.tiempo.max(0.0));
        gl.uniform_4_f32(p.u(U::Nubes), if self.op.aaa { 1.0 } else { 0.0 }, t, if self.op.cielo_frutiger { 1.0 } else { 0.0 }, 0.0); gl.uniform_3_f32(p.u(U::SolC), l.sol_c[0], l.sol_c[1], l.sol_c[2]);
        if prueba("sin_cielo") { return; }
        gl.depth_mask(false); gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3); gl.depth_mask(true);
    }

    /// lo opaco que se ve con otra matriz (el reflejo, la sombra), con y sin huesos
    fn recortar(&self, vp: &M4, sombra: bool) -> Vec<usize> {
        let pl = mat::planos(vp);
        // (la sombra es ortográfica: el tamaño en píxeles de la sombra no depende de la distancia)
        let px_por_m = (vp[0] * vp[0] + vp[4] * vp[4] + vp[8] * vp[8]).sqrt() * self.op.sombra_px as f32 * 0.5;
        let mut v: Vec<usize> = self.items.iter().enumerate().filter(|(_, it)| {
            let (Some(_), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { return false };
            mt.agua == 0 && mt.blend == 0 && mt.add == 0 && !(sombra && it.fl & FL_SIN_SOMBRA != 0) && mat::esfera_dentro(&pl, &it.esf) && !(sombra && it.esf[3] * px_por_m < 0.5)
        }).map(|(i, _)| i).collect();
        v.sort_by_key(|&i| { let it = &self.items[i]; (!it.h.is_empty() && self.mallas[&it.m].piel, self.mats[&it.mat].t, it.m, it.s0, it.mat) });
        v
    }
    /// dibuja una lista de lo opaco con el programa de luz (o el de sombra), cambiando al de huesos cuando toca
    unsafe fn dibujar_lista(&self, lista: &[usize], vp: &M4, clip: f32, de_sombra: bool) -> u32 { self.dibujar_lista_con(lista, vp, clip, de_sombra, false) }
    unsafe fn dibujar_lista_con(&self, lista: &[usize], vp: &M4, clip: f32, de_sombra: bool, pre: bool) -> u32 {
        // (las copias de una misma cosa —la misma malla, parte y material, sin huesos— van juntas en la lista: de a 2 o más,
        // un solo dibujo con instancias; sus matrices, todas en un búfer)
        let mismo = |a: &ItemDin, b: &ItemDin| a.m == b.m && a.s0 == b.s0 && a.sn == b.sn && a.mat == b.mat && a.h.is_empty() && b.h.is_empty() && (a.fl & FL_ARMA) == (b.fl & FL_ARMA);
        let recorte = clip > -1e8;
        let mut grupos: Vec<(usize, usize)> = Vec::new(); let mut mats: Vec<f32> = Vec::new();
        let mut k = 0;
        while k < lista.len() {
            let a = &self.items[lista[k]]; let mut e = k + 1;
            while self.instancias && e < lista.len() && mismo(a, &self.items[lista[e]]) { e += 1; }
            if e - k >= 2 { for &i in &lista[k..e] { mats.extend_from_slice(&self.items[i].mm); } }
            grupos.push((k, e)); k = e;
        }
        if !mats.is_empty() { let gl = &self.gl; gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.inst_buf)); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32_bytes(&mats), glow::STREAM_DRAW); }
        let mut act: Option<u8> = None; let mut base = 0usize; let mut dibujos = 0; let mut en_franja = false;
        *self.puesto.borrow_mut() = Some(Puesto3::default());
        for (k, e) in grupos {
            let it = &self.items[lista[k]]; let n = e - k;
            // (el arma en primera persona: en su franja de la profundidad —FL_ARMA—, salvo en las sombras)
            let franja = it.fl & FL_ARMA != 0 && (!de_sombra || pre);
            if franja != en_franja { self.gl.depth_range_f32(0.0, if franja { FRANJA_ARMA } else { 1.0 }); en_franja = franja; }
            let piel = !it.h.is_empty() && self.mallas.get(&it.m).map(|m| m.piel).unwrap_or(false);
            let corta = !de_sombra && (recorte || self.mats.get(&it.mat).map_or(false, |mt| mt.cut != 0));
            let tipo: u8 = (if n >= 2 { 2 } else if piel { 1 } else { 0 }) | if corta { 4 } else { 0 };
            let p = match (de_sombra, tipo) { (false, 0) => &self.p_luz, (false, 1) => &self.p_luz_piel, (false, 2) => &self.p_luz_inst, (false, 4) => &self.p_luz_c, (false, 5) => &self.p_luz_piel_c, (false, _) => &self.p_luz_inst_c,
                (true, 0) if pre => &self.p_pre, (true, 1) if pre => &self.p_pre_piel, (true, _) if pre => &self.p_pre_inst,
                (true, 0) => &self.p_sombra, (true, 1) => &self.p_sombra_piel, (true, _) => &self.p_sombra_inst };
            if act != Some(tipo) {
                act = Some(tipo);
                if de_sombra { self.gl.use_program(Some(p.p)); self.gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp); }
                else { self.luces(p, vp, clip); }
                // (luces puede dejar puesta otra unidad —la de la sombra—: no se sabe cuál)
                if let Some(x) = self.puesto.borrow_mut().as_mut() { x.unidad = None; }
            }
            if !de_sombra { let esf: Vec<[f32; 4]> = lista[k..e].iter().map(|&i| self.items[i].esf).collect(); self.luces_de(p, &esf); }
            if n >= 2 {
                // (el búfer de instancias, corrido a las matrices de este grupo)
                let gl = &self.gl; let Some(m) = self.mallas.get(&it.m) else { base += n; continue };
                gl.bind_vertex_array(Some(m.vao)); gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.inst_buf));
                if let Some(x) = self.puesto.borrow_mut().as_mut() { x.vao = Some(m.vao); }
                for j in 0..4u32 { gl.enable_vertex_attrib_array(6 + j); gl.vertex_attrib_pointer_f32(6 + j, 4, glow::FLOAT, false, 64, (base * 64 + j as usize * 16) as i32); gl.vertex_attrib_divisor(6 + j, 1); }
                let t0 = self.perfil.as_ref().map(|_| { self.gl.finish(); std::time::Instant::now() });
                self.dibujar_n(p, it, !de_sombra, n as i32);
                if let (Some(t0), Some(pf)) = (t0, self.perfil.as_ref()) { self.gl.finish(); pf.borrow_mut().push((de_sombra, pre, it.m, it.mat, n as u32, it.sn / 3, t0.elapsed().as_secs_f64() * 1000.0)); }
                base += n;
            } else {
                let t0 = self.perfil.as_ref().map(|_| { self.gl.finish(); std::time::Instant::now() });
                self.dibujar_item(p, it, !de_sombra);
                if let (Some(t0), Some(pf)) = (t0, self.perfil.as_ref()) { self.gl.finish(); pf.borrow_mut().push((de_sombra, pre, it.m, it.mat, 1, it.sn / 3, t0.elapsed().as_secs_f64() * 1000.0)); }
            }
            dibujos += 1;
        }
        if en_franja { self.gl.depth_range_f32(0.0, 1.0); }
        *self.puesto.borrow_mut() = None;
        dibujos
    }
    /// (JXM_PERFIL: lo que tardó cada dibujo —con la placa esperada antes y después—, sumado por malla y material)
    pub fn perfil_resumen(&self) -> String {
        let Some(pf) = self.perfil.as_ref() else { return String::new() };
        let mut m: HashMap<(bool, bool, i64, i64), (u32, u32, u32, f64)> = HashMap::new();
        for &(s, p, ma, mt, n, t, ms) in pf.borrow().iter() { let e = m.entry((s, p, ma, mt)).or_default(); e.0 += 1; e.1 = n; e.2 = t; e.3 += ms; }
        let mut v: Vec<_> = m.into_iter().collect(); v.sort_by(|a, b| b.1 .3.total_cmp(&a.1 .3));
        let total: f64 = v.iter().filter(|x| !x.0 .0).map(|x| x.1 .3).sum();
        let tp: f64 = v.iter().filter(|x| x.0 .0 && x.0 .1).map(|x| x.1 .3).sum();
        let pre: Vec<String> = v.iter().filter(|x| x.0 .0 && x.0 .1).take(8).map(|((_, _, ma, mt), (veces, n, t, ms))| format!("malla {ma} mat {mt} ×{n} {t} tri: {:.0} ms en total, {:.2} ms/vez ({veces})", ms, ms / *veces as f64)).collect();
        let pre = { let mut p = pre; p.insert(0, format!("total {tp:.0} ms")); p };
        format!("prepaso: {} || luz total {total:.0} ms · ", pre.join(" | ")) + &v.iter().filter(|x| !x.0 .0).take(12).map(|((_, _, ma, mt), (veces, n, t, ms))| format!("malla {ma} mat {mt} ×{n} {t} tri: {:.1} ms/vez ({veces} veces)", ms / *veces as f64)).collect::<Vec<_>>().join(" | ")
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
            self.sombra = Some((f, t, px)); self.svp2 = mat::id(); self.sombra_huella = [0; 2];
        }
        // (la de lejos —todo el radio, píxeles de 4 cm— cambia poco de un cuadro al otro: se dibuja un cuadro sí y uno no, y en
        // el medio se sigue usando con su matriz; la de cerca, siempre)
        // (una sola cascada: la de lejos no se dibuja y su matriz manda todo afuera —el shader la da por «lejos»: sin sombra—)
        let una = self.op.cascadas == 1;
        let lejos = !una && (self.op.sombra_cada > 1 || self.cuadro % 2 == 0 || self.svp2 == mat::id());
        let (svp0, ses0) = self.cascada(0); let (svp1, ses1) = if una { (FUERA, [0.0; 2]) } else if lejos { self.cascada(1) } else { (self.svp2, self.sesgo2) };
        self.svp = svp0; self.sesgo = ses0; self.svp2 = svp1; self.sesgo2 = ses1;
        let l0 = self.recortar(&svp0, true); let l1 = if lejos { self.recortar(&svp1, true) } else { vec![] };
        // (lo que no cambió no se vuelve a dibujar: con todo quieto —o la cámara girando en el lugar— la sombra no cuesta nada)
        let h0 = self.huella(&svp0, &l0); let h1 = if lejos { self.huella(&svp1, &l1) } else { self.sombra_huella[1] };
        let (d0, d1) = (h0 != self.sombra_huella[0], lejos && h1 != self.sombra_huella[1]);
        if !d0 && !d1 { return; }
        self.sombra_huella = [h0, h1];
        if self.dbg && self.cuadro == 0 {
            let piel: Vec<_> = self.items.iter().filter(|it| !it.h.is_empty()).map(|it| (it.m, it.esf, it.fl, it.h.len())).collect();
            eprintln!("sombra: {} + {} cosas, {} con huesos · {:?}", l0.len(), l1.len(), piel.len(), &piel[..piel.len().min(6)]);
        }
        let (f, _, _) = *self.sombra.as_ref().unwrap();
        { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.viewport(0, 0, px * 2, px);
          // (se borra sólo la mitad que se vuelve a dibujar)
          if !(d0 && d1) { gl.enable(glow::SCISSOR_TEST); if d0 { gl.scissor(0, 0, px, px); } else { gl.scissor(px, 0, px, px); } }
          gl.clear(glow::DEPTH_BUFFER_BIT); gl.disable(glow::SCISSOR_TEST); gl.enable(glow::POLYGON_OFFSET_FILL); gl.polygon_offset(1.5, 3.0); }
        if d0 { self.gl.viewport(0, 0, px, px); self.dibujos += self.dibujar_lista(&l0, &svp0, -1e9, true); }
        if d1 { self.gl.viewport(px, 0, px, px); self.dibujos += self.dibujar_lista(&l1, &svp1, -1e9, true); }
        self.gl.disable(glow::POLYGON_OFFSET_FILL);
    }
    /// dónde está el agua en la pantalla (en −1..1, de la cámara de ahora): la caja de sus esferas, más un margen por lo que las
    /// olas corren el reflejo; si alguna rodea a la cámara, la pantalla entera
    fn agua_en_pantalla(&self) -> ([f32; 2], [f32; 2]) {
        let Some(c) = self.c.as_ref() else { return ([-1.0; 2], [1.0; 2]) };
        rect_agua(&c.vp, self.aguas.iter().map(|&i| self.items[i].esf))
    }
    /// la huella de una mitad de la sombra: su matriz y, de cada cosa, la malla, la parte, el material, la matriz y los huesos
    fn huella(&self, svp: &M4, lista: &[usize]) -> u64 {
        let mut h: u64 = 0xcbf29ce484222325; let mut mete = |x: u64| { h ^= x; h = h.wrapping_mul(0x100000001b3); };
        for v in svp { mete(v.to_bits() as u64); }
        for &i in lista { let it = &self.items[i]; mete(it.m as u64); mete(it.s0 as u64); mete(it.mat as u64); for v in &it.mm { mete(v.to_bits() as u64); } for v in &it.h { mete(v.to_bits() as u64); } }
        h.max(1)
    }
    fn cascada(&self, k: usize) -> (M4, [f32; 2]) { cascada(self.c.as_ref().unwrap(), self.sol(), &self.op, k) }

    /// los rayos del sol: de la escena (su color y su profundidad) a una textura de un cuarto del lado; devuelve la textura
    /// los rayos del sol de la pantalla (como post.js) y la luz en el aire (con la sombra del sol), a un cuarto del lado:
    /// devuelve la textura (v/8 con raíz) y por cuánto multiplicarla
    unsafe fn pasada_rayos(&mut self, ew: i32, eh: i32) -> Option<(glow::Texture, f32)> {
        let c = self.c.as_ref()?; let s = self.sol(); let rp = sol_en_pantalla(c, s); let expo = c.luz.expo;
        let l = &c.luz; let luz_sol = l.sol_c[0] * 0.2126 + l.sol_c[1] * 0.7152 + l.sol_c[2] * 0.0722;
        // (la luz en el aire, sólo en Definitivo: en Ultra van los rayos de la pantalla, que cuestan mucho menos)
        let vol = self.op.aaa && self.op.sombras && self.sombra.is_some() && s[1] > 0.03 && luz_sol > 0.05;
        if rp.is_none() && !vol { return None; }
        let (esc, prof) = { let d = self.escena_rt.as_ref()?; (d.color, d.prof_t?) };
        let div = if self.op.aaa { 2 } else { 4 }; let (rw, rh) = ((ew / div).max(8), (eh / div).max(8));
        if self.rayos_rt.as_ref().map(|d| d.0.w != rw || d.0.h != rh).unwrap_or(true) { if let Some((a, b)) = self.rayos_rt.take() { borrar_destino(&self.gl, a); borrar_destino(&self.gl, b); } self.rayos_rt = Some((destino(&self.gl, rw, rh), destino(&self.gl, rw, rh))); }
        let (m_fb, m_t, r_fb, r_t) = { let d = self.rayos_rt.as_ref()?; (d.0.fb, d.0.color, d.1.fb, d.1.color) };
        let vp = c.vp; let (sc, sv2, ses2) = (l.sol_c, a_01(&self.svp2), self.sesgo2); let som_t = self.sombra.as_ref().map(|x| x.1);
        let gl = &self.gl;
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false); gl.disable(glow::BLEND); gl.bind_vertex_array(None); gl.viewport(0, 0, rw, rh);
        if let Some(rp) = rp {
            // 1) la máscara del cielo cerca del sol y 2) el desenfoque hacia el sol
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(m_fb));
            let p = &self.p_rayos; gl.use_program(Some(p.p));
            gl.uniform_4_f32(p.u(U::RayP), rp[0], rp[1], ew as f32 / eh as f32, rp[2]); gl.uniform_3_f32(p.u(U::SolC), sc[0], sc[1], sc[2]);
            gl.active_texture(glow::TEXTURE11); gl.bind_texture(glow::TEXTURE_2D, Some(esc));
            gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, Some(prof));
            gl.draw_arrays(glow::TRIANGLES, 0, 3);
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(r_fb));
            let p = &self.p_rayos2; gl.use_program(Some(p.p)); gl.uniform_4_f32(p.u(U::RayP), rp[0], rp[1], ew as f32 / eh as f32, rp[2]);
            gl.active_texture(glow::TEXTURE15); gl.bind_texture(glow::TEXTURE_2D, Some(m_t)); gl.active_texture(glow::TEXTURE0);
            gl.draw_arrays(glow::TRIANGLES, 0, 3);
        }
        let salida = if vol {
            // 3) la luz en el aire, con los rayos de la pantalla sumados (ya con su fuerza)
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(m_fb));
            let p = if self.op.aaa { &self.p_vol_aaa } else { &self.p_vol }; gl.use_program(Some(p.p));
            let (ojo, r0, rx, ry, zl) = rayos(&vp);
            gl.uniform_3_f32(p.u(U::Cam), ojo[0], ojo[1], ojo[2]); gl.uniform_3_f32(p.u(U::Ray0), r0[0], r0[1], r0[2]); gl.uniform_3_f32(p.u(U::RayX), rx[0], rx[1], rx[2]); gl.uniform_3_f32(p.u(U::RayY), ry[0], ry[1], ry[2]); gl.uniform_2_f32(p.u(U::Zl), zl[0], zl[1]);
            gl.uniform_matrix_4_f32_slice(p.u(U::SVP2), false, &sv2); gl.uniform_2_f32(p.u(U::Sesgo2), ses2[0], ses2[1]);
            gl.uniform_3_f32(p.u(U::Sol), s[0], s[1], s[2]); gl.uniform_3_f32(p.u(U::SolC), sc[0], sc[1], sc[2]);
            gl.uniform_4_f32(p.u(U::Vol), self.op.sombra_radio.min(60.0), VOL_DENSIDAD, rp.map_or(0.0, |r| r[2]), VOL_HACES);
            gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, Some(prof));
            gl.active_texture(glow::TEXTURE2); gl.bind_texture(glow::TEXTURE_2D, som_t);
            gl.active_texture(glow::TEXTURE15); gl.bind_texture(glow::TEXTURE_2D, if rp.is_some() { Some(r_t) } else { Some(self.blanca) }); gl.active_texture(glow::TEXTURE0);
            gl.draw_arrays(glow::TRIANGLES, 0, 3);
            (m_t, expo)
        } else { (r_t, rp.map_or(0.0, |r| r[2]) * expo) };
        gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        self.dibujos += 3; self.marca("rayos");
        Some(salida)
    }
    /// el resplandor (Definitivo): lo brillante a media resolución, bajado en cadena y subido sumando; devuelve la textura
    unsafe fn pasada_brillo(&mut self, ew: i32, eh: i32) -> Option<glow::Texture> {
        let esc = self.escena_rt.as_ref()?.color;
        let tam: Vec<(i32, i32)> = (1..=4).map(|k| ((ew >> k).max(4), (eh >> k).max(4))).collect();
        if self.brillo_rt.len() != 4 || self.brillo_rt.iter().zip(&tam).any(|(d, t)| d.w != t.0 || d.h != t.1) {
            for d in self.brillo_rt.drain(..) { borrar_destino(&self.gl, d); }
            for &(w, h) in &tam { self.brillo_rt.push(destino(&self.gl, w, h)); }
        }
        let gl = &self.gl; let b = &self.brillo_rt;
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false); gl.disable(glow::BLEND); gl.bind_vertex_array(None);
        // (lo brillante)
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(b[0].fb)); gl.viewport(0, 0, b[0].w, b[0].h);
        let p = &self.p_brillo; gl.use_program(Some(p.p)); gl.uniform_2_f32(p.u(U::Inv), 0.5 / ew as f32, 0.5 / eh as f32);
        gl.active_texture(glow::TEXTURE11); gl.bind_texture(glow::TEXTURE_2D, Some(esc)); gl.draw_arrays(glow::TRIANGLES, 0, 3);
        // (bajando)
        let p = &self.p_baja; gl.use_program(Some(p.p)); gl.active_texture(glow::TEXTURE10);
        for i in 1..4 { gl.bind_framebuffer(glow::FRAMEBUFFER, Some(b[i].fb)); gl.viewport(0, 0, b[i].w, b[i].h); gl.bind_texture(glow::TEXTURE_2D, Some(b[i - 1].color)); gl.uniform_2_f32(p.u(U::Inv), 1.0 / b[i - 1].w as f32, 1.0 / b[i - 1].h as f32); gl.draw_arrays(glow::TRIANGLES, 0, 3); }
        // (subiendo y sumando)
        let p = &self.p_sube; gl.use_program(Some(p.p)); gl.enable(glow::BLEND); gl.blend_func(glow::ONE, glow::ONE);
        for i in (1..4).rev() { gl.bind_framebuffer(glow::FRAMEBUFFER, Some(b[i - 1].fb)); gl.viewport(0, 0, b[i - 1].w, b[i - 1].h); gl.bind_texture(glow::TEXTURE_2D, Some(b[i].color)); gl.uniform_2_f32(p.u(U::Inv), 0.5 / b[i].w as f32, 0.5 / b[i].h as f32); gl.draw_arrays(glow::TRIANGLES, 0, 3); }
        gl.disable(glow::BLEND); gl.active_texture(glow::TEXTURE0); gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        let t = b[0].color; self.dibujos += 7; self.marca("resplandor");
        Some(t)
    }
    /// el reflejo del agua: la escena espejada en el plano del agua, a una fracción de la resolución
    unsafe fn pasada_reflejo(&mut self, w: i32, h: i32, ay: f32) { self.pasada_reflejo_de(w, h, ay, false) }
    /// el piso de abajo de la cámara para su reflejo (Definitivo): el que da el juego (`suelo_y`), no muy lejos, si a la vista y
    /// cerca hay algo opaco que lo cruza (cualquier material: el áspero refleja borroso; antes sólo con algo liso a la vista, y
    /// el reflejo se apagaba al mirar para otro lado)
    fn piso_liso(&self) -> Option<f32> {
        let c = self.c.as_ref()?; let y = c.suelo_y.filter(|&y| (0.2..25.0).contains(&(c.pos[1] - y)))?;
        let pl = mat::planos(&c.vp); let cp = c.pos;
        self.opacos.iter().any(|&i| { let it = &self.items[i]; let e = it.esf;
            e[3] > 0.0 && (e[1] - y).abs() < e[3]
                && ((e[0] - cp[0]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3] < 50.0 && mat::esfera_dentro(&pl, &e) }).then_some(y)
    }
    /// el reflejo: del agua (sólo donde está en la pantalla) o, con `piso`, del piso (toda la pantalla; el piso mismo no se
    /// refleja: el corte va 3 cm más arriba)
    unsafe fn pasada_reflejo_de(&mut self, w: i32, h: i32, ay: f32, piso: bool) {
        // (el del piso, borroso, a un tercio alcanza)
        let div = if piso { self.op.reflejo_div.max(3) } else { self.op.reflejo_div };
        let (rw, rh) = ((w / div).max(16), (h / div).max(16));
        if self.reflejo.as_ref().map(|d| d.w != rw || d.h != rh).unwrap_or(true) { if let Some(d) = self.reflejo.take() { borrar_destino(&self.gl, d); } self.reflejo = Some(destino(&self.gl, rw, rh)); }
        let vp = mat::mul(&self.c.as_ref().unwrap().vp, &mat::espejo_y(ay));
        // (el reflejo sólo se mira donde está el agua en la pantalla —más lo que la corren las olas—: ese rectángulo y nada más;
        // lo que no puede caer adentro, afuera)
        let (r0, r1) = if piso { ([-1.0, -1.0], [1.0, 1.0]) } else { self.agua_en_pantalla() };
        let pl = planos_rect(&vp, r0, r1);
        let ay = if piso { ay + 0.03 } else { ay };
        // (lo que está entero debajo del agua no se refleja)
        // (el arma en primera persona no se refleja: está pegada a la cámara)
        let lista: Vec<usize> = self.recortar(&vp, false).into_iter().filter(|&i| { let e = self.items[i].esf; self.items[i].fl & FL_ARMA == 0 && e[1] + e[3] > ay - 0.05 && mat::esfera_dentro(&pl, &e) }).collect();
        { let gl = &self.gl; let d = self.reflejo.as_ref().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(d.fb)); gl.viewport(0, 0, d.w, d.h);
          let (sx0, sy0) = (((r0[0] * 0.5 + 0.5) * d.w as f32).floor() as i32, ((r0[1] * 0.5 + 0.5) * d.h as f32).floor() as i32);
          let (sx1, sy1) = (((r1[0] * 0.5 + 0.5) * d.w as f32).ceil() as i32, ((r1[1] * 0.5 + 0.5) * d.h as f32).ceil() as i32);
          gl.enable(glow::SCISSOR_TEST); gl.scissor(sx0.max(0), sy0.max(0), (sx1 - sx0).max(1), (sy1 - sy0).max(1));
          gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT); }
        // (sólo lo que cruza el agua necesita el corte —que descarta píxeles y así apaga la prueba de profundidad temprana—: lo
        // que está entero arriba va con el programa común, de cerca a lejos; el cielo al final, sólo donde no quedó nada)
        let cp = self.c.as_ref().unwrap().pos;
        let (mut arriba, cruza): (Vec<usize>, Vec<usize>) = lista.iter().partition(|&&i| { let e = self.items[i].esf; e[1] - e[3] > ay });
        let lejos = |i: usize| { let e = self.items[i].esf; ((((e[0] - cp[0]).powi(2) + (e[1] - cp[1]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3]).max(0.0) / 6.0) as u32 };
        arriba.sort_by_key(|&i| { let it = &self.items[i]; (lejos(i), it.m, it.s0, it.mat) });
        if prueba("reflejo_viejo") { self.cielo(&vp); self.dibujos += self.dibujar_lista(&lista, &vp, ay - 0.05, false); }
        else {
            self.dibujos += self.dibujar_lista(&arriba, &vp, -1e9, false);
            self.dibujos += self.dibujar_lista(&cruza, &vp, ay - 0.05, false);
            self.cielo(&vp);
        }
        self.gl.disable(glow::SCISSOR_TEST);
        self.gl.invalidate_framebuffer(glow::FRAMEBUFFER, &[glow::DEPTH_ATTACHMENT]);
    }

    /// la vista que se acostumbra: mide la escena ya dibujada y mueve la exposición hacia la que le toca (FS_ADAPTA); devuelve la
    /// textura de 1×1 con la de este cuadro
    unsafe fn pasada_adapta(&mut self) -> Option<glow::Texture> {
        let t = self.c.as_ref()?.tiempo; let col = self.escena_rt.as_ref()?.color;
        if self.adapta.is_none() {
            // (las dos empiezan en 1: sin cambio)
            let mut par = Vec::new();
            for _ in 0..2 { let tx = textura(&self.gl, 1, 1, &[64, 0, 0, 255], false, false); let gl = &self.gl; let f = gl.create_framebuffer().ok()?;
                gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(tx), 0);
                if gl.check_framebuffer_status(glow::FRAMEBUFFER) != glow::FRAMEBUFFER_COMPLETE { self.op.adapta = false; return None; }
                par.push((f, tx)); }
            self.adapta = Some(([par[0], par[1]], 0, t));
        }
        let (par, i, t0) = *self.adapta.as_ref().unwrap();
        let dt = (t - t0).clamp(0.0, 0.25);
        let gl = &self.gl; let p = &self.p_adapta;
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(par[1 - i].0)); gl.viewport(0, 0, 1, 1); gl.disable(glow::DEPTH_TEST); gl.disable(glow::BLEND);
        gl.use_program(Some(p.p));
        gl.active_texture(glow::TEXTURE11); gl.bind_texture(glow::TEXTURE_2D, Some(col));
        gl.active_texture(glow::TEXTURE13); gl.bind_texture(glow::TEXTURE_2D, Some(par[i].1)); gl.active_texture(glow::TEXTURE0);
        // (el brillo de un exterior de día, medido en las fotos: ahí la exposición queda en 1; a la sombra sube hasta 2,2)
        gl.uniform_4_f32(p.u(U::Adapta), dt, ADAPTA_CLAVE, 0.75, 2.2);
        gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.enable(glow::DEPTH_TEST);
        self.adapta = Some((par, 1 - i, t));
        Some(par[1 - i].1)
    }

    /// las olas simuladas del cuadro (EF_OLAS) a su textura: [x0, z0, 1/lado, 1] para el sombreador del agua (o todo 0)
    unsafe fn olas_subir(&mut self) -> [f32; 4] {
        let Some(b) = self.c.as_ref().and_then(|c| c.efectos.iter().find(|e| e.0 == EF_OLAS)).map(|e| &e.1) else { return [0.0; 4] };
        let n = b.get(3).copied().unwrap_or(0.0) as usize; if n < 4 || b.len() < 8 + n * n * 2 { return [0.0; 4]; }
        let mut px = vec![0u8; n * n * 4];
        for k in 0..n * n { px[k * 4] = (128.0 + b[8 + k * 2] * 200.0).clamp(0.0, 255.0) as u8; px[k * 4 + 1] = (128.0 + b[9 + k * 2] * 200.0).clamp(0.0, 255.0) as u8; px[k * 4 + 2] = 128; px[k * 4 + 3] = 255; }
        let k = [b[0], b[1], 1.0 / b[2].max(1.0), 1.0];
        let gl = &self.gl;
        match self.olas_t {
            Some(t) => { gl.bind_texture(glow::TEXTURE_2D, Some(t)); gl.tex_sub_image_2d(glow::TEXTURE_2D, 0, 0, 0, n as i32, n as i32, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(&px))); }
            None => { let Ok(t) = gl.create_texture() else { return [0.0; 4] }; gl.bind_texture(glow::TEXTURE_2D, Some(t));
                gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA8 as i32, n as i32, n as i32, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(&px)));
                for (q, v) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, q, v as i32); }
                self.olas_t = Some(t); }
        }
        k
    }

    /// el agua de partículas (EF_FLUIDO) como superficie: profundidad y grosor a media resolución, la profundidad suavizada
    /// y el agua sobre la escena (con la escena copiada para verla a través)
    unsafe fn fluido(&mut self, vp: &M4, ew: i32, eh: i32) {
        let Some(c) = self.c.as_ref() else { return };
        let Some((_, d)) = c.efectos.iter().find(|e| e.0 == EF_FLUIDO && e.1.len() > FLU_CAB) else { return };
        let n = ((d.len() - FLU_CAB) / FLU_POR).min(d[1] as usize); if n == 0 { return; }
        let d = d.clone(); let cp = c.pos;
        let Some(fb) = self.escena_rt.as_ref().map(|e| e.fb) else { return };
        let (fw, fh) = ((ew / 2).max(8), (eh / 2).max(8));
        for k in 0..3 { if self.flu_rt[k].as_ref().map_or(true, |r| r.w != fw || r.h != fh) { if let Some(r) = self.flu_rt[k].take() { borrar_destino(&self.gl, r); } self.flu_rt[k] = Some(destino_con(&self.gl, fw, fh, true)); } }
        // (la escena hasta acá, copiada: se ve a través del agua y dice qué la tapa)
        if self.refr_rt.as_ref().map(|r| r.w != ew || r.h != eh).unwrap_or(true) { if let Some(r) = self.refr_rt.take() { borrar_destino(&self.gl, r); } self.refr_rt = Some(destino_con(&self.gl, ew, eh, true)); }
        let gl = &self.gl;
        { let r = self.refr_rt.as_ref().unwrap(); gl.bind_framebuffer(glow::READ_FRAMEBUFFER, Some(fb)); gl.bind_framebuffer(glow::DRAW_FRAMEBUFFER, Some(r.fb));
          gl.blit_framebuffer(0, 0, ew, eh, 0, 0, ew, eh, glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT, glow::NEAREST); }
        let (a, b, cc) = (self.flu_rt[0].as_ref().unwrap(), self.flu_rt[1].as_ref().unwrap(), self.flu_rt[2].as_ref().unwrap());
        let (ojo, r0, rx, ry, zl) = rayos(vp);
        // (lo que mide 1 m a 1 m de la cámara, en píxeles de media resolución: para el radio del suavizado)
        let f = (vp[1] * vp[1] + vp[5] * vp[5] + vp[9] * vp[9]).sqrt(); let px_m = f * fh as f32 * 0.5;
        // 1) la profundidad de las esferas
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(a.fb)); gl.viewport(0, 0, fw, fh);
        gl.depth_mask(true); gl.color_mask(true, true, true, true); gl.clear_color(0.0, 0.0, 0.0, 0.0); gl.clear_depth_f32(1.0); gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT);
        gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::LESS); gl.disable(glow::BLEND); gl.color_mask(false, false, false, false);
        gl.bind_vertex_array(Some(self.flu.0)); gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.flu.1));
        gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, f32_bytes(&d[FLU_CAB..FLU_CAB + n * FLU_POR]), glow::STREAM_DRAW);
        for (p, radio) in [(&self.p_flu, d[0]), (&self.p_flu_g, d[0])] {
            gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp); gl.uniform_3_f32(p.u(U::Cam), cp[0], cp[1], cp[2]);
            gl.uniform_3_f32(p.u(U::Der), d[4], d[5], d[6]); gl.uniform_3_f32(p.u(U::Arr), d[8], d[9], d[10]); gl.uniform_1_f32(p.u(U::Radio), radio);
            gl.uniform_1_f32(p.u(U::Fuerza), 0.075);
            if std::ptr::eq(p, &self.p_flu_g) {
                // 2) el grosor: todas, sumadas, sin mirar la profundidad
                gl.color_mask(true, true, true, true); gl.disable(glow::DEPTH_TEST); gl.depth_mask(false); gl.enable(glow::BLEND); gl.blend_func(glow::ONE, glow::ONE);
            }
            gl.draw_arrays_instanced(glow::TRIANGLES, 0, 6, n as i32);
        }
        gl.disable(glow::BLEND); gl.bind_vertex_array(None);
        // 3) suavizar la profundidad (de a un eje, dos vueltas): las esferas se vuelven una superficie
        gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::ALWAYS); gl.depth_mask(true); gl.color_mask(false, false, false, false);
        let p = &self.p_flu_bl; gl.use_program(Some(p.p));
        gl.uniform_2_f32(p.u(U::Inv), 1.0 / fw as f32, 1.0 / fh as f32); gl.uniform_2_f32(p.u(U::Zl), zl[0], zl[1]); gl.uniform_1_f32(p.u(U::Fuerza), 0.11 * px_m);
        for (de, a_, dir) in [(a, b, (1.0, 0.0)), (b, cc, (0.0, 1.0)), (cc, b, (1.0, 0.0)), (b, cc, (0.0, 1.0))] {
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(a_.fb)); gl.uniform_2_f32(p.u(U::D), dir.0, dir.1);
            gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, de.prof_t); gl.draw_arrays(glow::TRIANGLES, 0, 3);
        }
        gl.color_mask(true, true, true, true);
        // 4) el agua sobre la escena
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.viewport(0, 0, ew, eh);
        gl.enable(glow::BLEND); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA);
        let p = &self.p_flu_c; gl.use_program(Some(p.p));
        gl.uniform_3_f32(p.u(U::Cam), ojo[0], ojo[1], ojo[2]); gl.uniform_3_f32(p.u(U::Ray0), r0[0], r0[1], r0[2]); gl.uniform_3_f32(p.u(U::RayX), rx[0], rx[1], rx[2]); gl.uniform_3_f32(p.u(U::RayY), ry[0], ry[1], ry[2]);
        gl.uniform_2_f32(p.u(U::Zl), zl[0], zl[1]); gl.uniform_2_f32(p.u(U::Inv), 1.0 / fw as f32, 1.0 / fh as f32);
        gl.uniform_3_f32(p.u(U::Der), d[4], d[5], d[6]); gl.uniform_3_f32(p.u(U::Arr), d[8], d[9], d[10]);
        gl.uniform_4_f32(p.u(U::C), d[12], d[13], d[14], d[15]); gl.uniform_4_f32(p.u(U::S), d[16], d[17], d[18], d[19]); gl.uniform_4_f32(p.u(U::Sol), d[20], d[21], d[22], d[23]);
        let r = self.refr_rt.as_ref().unwrap();
        gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, cc.prof_t);
        gl.active_texture(glow::TEXTURE10); gl.bind_texture(glow::TEXTURE_2D, Some(a.color));
        gl.active_texture(glow::TEXTURE12); gl.bind_texture(glow::TEXTURE_2D, Some(r.color));
        gl.active_texture(glow::TEXTURE13); gl.bind_texture(glow::TEXTURE_2D, r.prof_t);
        gl.draw_arrays(glow::TRIANGLES, 0, 3);
        for u in [glow::TEXTURE9, glow::TEXTURE10, glow::TEXTURE12, glow::TEXTURE13] { gl.active_texture(u); gl.bind_texture(glow::TEXTURE_2D, None); }
        gl.active_texture(glow::TEXTURE0);
        gl.disable(glow::BLEND); gl.depth_func(glow::LEQUAL);
        self.dibujos += 7;
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
    unsafe fn pasada_ao(&mut self, ew: i32, eh: i32, vp: &M4) { if self.pasada_ao_calc(ew, eh, vp) { self.pasada_ao_poner(ew, eh); } }
    /// calcula la oclusión (a media resolución, desde la profundidad de la escena); false si no se pudo
    unsafe fn pasada_ao_calc(&mut self, ew: i32, eh: i32, vp: &M4) -> bool {
        let (aw, ah) = ((ew / 2).max(8), (eh / 2).max(8));
        if self.ao_rt.as_ref().map(|d| d.w != aw || d.h != ah).unwrap_or(true) { if let Some(d) = self.ao_rt.take() { borrar_destino(&self.gl, d); } self.ao_rt = Some(destino(&self.gl, aw, ah)); }
        let (Some(esc), Some(ao)) = (self.escena_rt.as_ref(), self.ao_rt.as_ref()) else { return false };
        let Some(prof) = esc.prof_t else { return false };
        let gl = &self.gl; let cp = self.c.as_ref().unwrap().pos;
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(ao.fb)); gl.viewport(0, 0, aw, ah);
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false);
        let p = &self.p_ao; gl.use_program(Some(p.p));
        let (ojo, r0, rx, ry, zl) = rayos(vp); let _ = cp;
        gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp);
        gl.uniform_3_f32(p.u(U::Cam), ojo[0], ojo[1], ojo[2]); gl.uniform_1_f32(p.u(U::Radio), 0.7);
        gl.uniform_3_f32(p.u(U::Ray0), r0[0], r0[1], r0[2]); gl.uniform_3_f32(p.u(U::RayX), rx[0], rx[1], rx[2]); gl.uniform_3_f32(p.u(U::RayY), ry[0], ry[1], ry[2]);
        gl.uniform_2_f32(p.u(U::Zl), zl[0], zl[1]);
        gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, Some(prof));
        gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, None); gl.active_texture(glow::TEXTURE0);
        gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        self.dibujos += 1; true
    }
    /// pone la oclusión sobre la escena ya dibujada (color × oclusión, suavizada con 4 muestras): cuando no va en la luz
    unsafe fn pasada_ao_poner(&mut self, ew: i32, eh: i32) {
        let (Some(esc), Some(ao)) = (self.escena_rt.as_ref(), self.ao_rt.as_ref()) else { return };
        let (aw, ah) = (ao.w, ao.h); let gl = &self.gl;
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false);
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(esc.fb)); gl.viewport(0, 0, ew, eh);
        gl.enable(glow::BLEND); gl.blend_func(glow::ZERO, glow::SRC_COLOR);
        let q = &self.p_ao_poner; gl.use_program(Some(q.p));
        gl.uniform_2_f32(q.u(U::Inv), 0.75 / aw as f32, 0.75 / ah as f32); gl.uniform_1_f32(q.u(U::Fuerza), self.op.ao_fuerza);
        gl.active_texture(glow::TEXTURE10); gl.bind_texture(glow::TEXTURE_2D, Some(ao.color));
        gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.active_texture(glow::TEXTURE0);
        gl.disable(glow::BLEND); gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        self.dibujos += 1;
    }

    /// un cuadro entero, en el destino `salida` (None = el de la superficie) de w × h
    pub unsafe fn dibujar(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32) {
        self.dibujos = 0; self.llamadas.set([0; 2]);
        if self.c.is_none() { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(0, 0, w, h); gl.clear_color(0.0, 0.0, 0.0, 1.0); gl.clear(glow::COLOR_BUFFER_BIT); return; }
        // (el gráfico Simple: los programas de luz con SIMPLE —sin el reflejo del cielo, las luces, la oclusión, las cáusticas ni
        // la luz global, y el sol sin brillo—; se arman la primera vez)
        if self.op.simple && self.luz_s.is_none() {
            const D: &str = "#define SIMPLE\n#define DBG_SIN_BRDF\n#define DBG_SIN_LUCES\n#define DBG_SIN_CIELO\n#define DBG_SIN_AO\n"; let gl = &self.gl;
            let r = (|| -> Result<[Prog; 6], String> { Ok([programa(gl, VS_LUZ, FS_LUZ, D)?, programa(gl, VS_LUZ, FS_LUZ, &format!("{D}#define PIEL\n"))?, programa(gl, VS_LUZ, FS_LUZ, &format!("{D}#define INST\n"))?,
                programa(gl, VS_LUZ, FS_LUZ, &format!("{D}#define CORTE\n"))?, programa(gl, VS_LUZ, FS_LUZ, &format!("{D}#define PIEL\n#define CORTE\n"))?, programa(gl, VS_LUZ, FS_LUZ, &format!("{D}#define INST\n#define CORTE\n"))?]) })();
            match r { Ok(p) => self.luz_s = Some(Box::new(p)), Err(e) => { eprintln!("simple: {e}"); self.op.simple = false; } }
        }
        let simple = self.op.simple && self.luz_s.is_some(); if simple { self.cambiar_luz_s(); }
        let cambiar = ab() && self.luz_b.is_some(); if cambiar { self.cambiar_luz_b(); }
        self.dibujar_escena(salida, w, h);
        if cambiar { self.cambiar_luz_b(); }
        if simple { self.cambiar_luz_s(); }
    }
    fn cambiar_luz_s(&mut self) {
        let Some(b) = self.luz_s.as_mut() else { return };
        std::mem::swap(&mut self.p_luz, &mut b[0]); std::mem::swap(&mut self.p_luz_piel, &mut b[1]); std::mem::swap(&mut self.p_luz_inst, &mut b[2]);
        std::mem::swap(&mut self.p_luz_c, &mut b[3]); std::mem::swap(&mut self.p_luz_piel_c, &mut b[4]); std::mem::swap(&mut self.p_luz_inst_c, &mut b[5]);
    }
    fn cambiar_luz_b(&mut self) {
        let Some(b) = self.luz_b.as_mut() else { return };
        std::mem::swap(&mut self.p_luz, &mut b[0]); std::mem::swap(&mut self.p_luz_piel, &mut b[1]); std::mem::swap(&mut self.p_luz_inst, &mut b[2]);
        std::mem::swap(&mut self.p_luz_c, &mut b[3]); std::mem::swap(&mut self.p_luz_piel_c, &mut b[4]); std::mem::swap(&mut self.p_luz_inst_c, &mut b[5]);
    }
    /// la luz global: si el cuadro trae sondas nuevas (EF_GI_DATOS), a la textura
    unsafe fn subir_gi(&mut self) {
        let Some(c) = self.c.as_ref() else { return };
        let (Some(h), Some(d)) = (c.efectos.iter().find(|e| e.0 == EF_GI), c.efectos.iter().find(|e| e.0 == EF_GI_DATOS)) else { return };
        if h.1.len() < 8 || h.1[7] == self.gi_ver { return; }
        let (w, hh) = ((h.1[4] * h.1[5] * 3.0) as i32, h.1[6] as i32); if (w * hh * 4) as usize != d.1.len() { return; }
        let px: Vec<u8> = d.1.iter().map(|&x| x as u8).collect();
        let gl = &self.gl;
        let t = match self.gi_tex { Some(t) => t, None => { let Ok(t) = gl.create_texture() else { return }; self.gi_tex = Some(t); t } };
        gl.bind_texture(glow::TEXTURE_2D, Some(t));
        gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA8 as i32, w, hh, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(&px)));
        for (k, v) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, v as i32); }
        self.gi_ver = h.1[7];
    }
    unsafe fn dibujar_escena(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32) {
        self.subir_gi();
        { let gl = &self.gl; gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::LEQUAL); gl.disable(glow::BLEND); gl.disable(glow::CULL_FACE); }
        self.marca("antes");
        if self.op.sombras && (self.sombra.is_none() || self.cuadro % self.op.sombra_cada.max(1) as u64 == 0) { self.pasada_sombra(); }
        self.marca("sombra");
        let ay = self.c.as_ref().unwrap().agua_y.or(self.agua.as_ref().map(|a| a.y));
        let hay_agua = !self.aguas.is_empty() && self.agua.is_some() && self.agua_n.is_some() && !self.sin_agua;
        let cam_arriba = ay.map(|y| self.c.as_ref().unwrap().pos[1] > y + 0.05).unwrap_or(false);
        // (Definitivo: el agua a la vista pero lejos —la pileta por la ventana— con un piso de abajo que no es la orilla: el reflejo
        // es del piso y el agua lejos refleja el cielo; si no, al girar y ver el agua el piso dejaba de reflejar)
        let piso = if self.op.aaa && self.op.reflejo { self.piso_liso() } else { None };
        let cp = self.c.as_ref().unwrap().pos;
        let agua_lejos = piso.map_or(false, |y| ay.map_or(true, |a| y > a + 0.3)) && self.aguas.iter().all(|&i| { let e = self.items[i].esf; ((e[0] - cp[0]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3] > 10.0 });
        self.refl_agua = hay_agua && cam_arriba && !agua_lejos;
        if self.refl_agua && self.op.reflejo && (self.reflejo.is_none() || self.cuadro % self.op.reflejo_cada.max(1) as u64 == 0) { self.pasada_reflejo(w, h, ay.unwrap()); }
        // (Definitivo sin agua cerca: el reflejo del piso, como con trazado de rayos)
        self.refl_piso = None;
        if !self.refl_agua { if let Some(y) = piso {
            // (con la cámara quieta, un cuadro sí y otro no se usa el de antes; moviéndose, siempre nuevo)
            let vpc = self.c.as_ref().unwrap().vp; let quieta = self.refl_piso_ult.1 == y && self.refl_piso_ult.0.iter().zip(vpc.iter()).all(|(a, b)| (a - b).abs() < 1e-4);
            if !(quieta && self.cuadro % 2 == 1 && self.reflejo.is_some()) { self.pasada_reflejo_de(w, h, y, true); self.refl_piso_ult = (vpc, y); }
            self.refl_piso = Some(y); } }
        self.marca("reflejo");
        // la escena, a la resolución elegida
        let (ew, eh) = (((w as f32) * self.op.escala).round().max(16.0) as i32, ((h as f32) * self.op.escala).round().max(16.0) as i32);
        // (la reconstrucción temporal: con la escena a menos píxeles, cada cuadro corrido una fracción de píxel distinta —Halton 2 y 3,
        // de a 32—; la cámara sin correr queda guardada para buscar lo de antes y para JX Turbo)
        let taa = self.op.taa && self.vx == 0 && (ew < w - 1 || eh < h - 1);
        if taa { if let Some(c) = self.c.as_mut() {
            self.taa_vp0 = Some(c.vp); let k = self.taa_n % 32 + 1; let (jx, jy) = (halton(k, 2) - 0.5, halton(k, 3) - 0.5); self.taa_jit = [jx, jy];
            let (dx, dy) = (2.0 * jx / ew as f32, 2.0 * jy / eh as f32);
            for col in 0..4 { let wv = c.vp[col * 4 + 3]; c.vp[col * 4] += dx * wv; c.vp[col * 4 + 1] += dy * wv; }
            self.taa_n = self.taa_n.wrapping_add(1);
        } } else { self.taa_vp0 = None; self.taa_vp = None; }
        let con_ao = self.op.ao; let con_prof = con_ao || self.op.rayos || self.op.turbo || taa;
        if self.escena_rt.as_ref().map(|d| d.w != ew || d.h != eh || d.prof_t.is_some() != con_prof).unwrap_or(true) { if let Some(d) = self.escena_rt.take() { borrar_destino(&self.gl, d); } self.escena_rt = Some(destino_con(&self.gl, ew, eh, con_prof)); }
        let fb = self.escena_rt.as_ref().unwrap().fb;
        { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.viewport(0, 0, ew, eh); gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT); }
        let vp = self.c.as_ref().unwrap().vp;
        // (el cielo 3D va primero —el cielo, la maqueta y lo transparente de ella— y después se borra la profundidad: el mapa
        // queda siempre adelante y tiene su pasada de profundidad y su oclusión como cualquier otro)
        let cielo3d = self.items.iter().any(|it| it.fl & FL_CIELO != 0);
        if cielo3d {
            self.cielo(&vp);
            let mut cie: Vec<usize> = self.opacos.iter().copied().filter(|&i| self.items[i].fl & FL_CIELO != 0).collect();
            if prueba("sin_cielo3d") { cie.clear(); }
            self.dibujos += self.dibujar_lista(&cie, &vp, -1e9, false);
            { let gl = &self.gl; gl.enable(glow::BLEND); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); gl.depth_mask(false); }
            let mut act: Option<bool> = None;
            for &i in self.transp.iter().filter(|&&i| self.items[i].fl & FL_CIELO != 0) {
                let it = &self.items[i]; let piel = !it.h.is_empty() && self.mallas[&it.m].piel; let p = if piel { &self.p_luz_piel_c } else { &self.p_luz_c };
                if act != Some(piel) { act = Some(piel); self.luces(p, &vp, -1e9); }
                let add = self.mats[&it.mat].add != 0; if add { self.gl.blend_func(glow::SRC_ALPHA, glow::ONE); self.niebla_suma(p, true); }
                self.dibujar_item(p, it, true); self.dibujos += 1;
                if add { self.gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); self.niebla_suma(p, false); }
            }
            { let gl = &self.gl; gl.disable(glow::BLEND); gl.depth_mask(true); gl.clear(glow::DEPTH_BUFFER_BIT); }
            self.marca("cielo3d");
        }
        let mapa: Vec<usize> = self.opacos.iter().copied().filter(|&i| self.items[i].fl & FL_CIELO == 0).collect();
        let con_pre = self.op.prepaso;
        self.tapados.clear(); self.tapados.resize(self.items.len(), false);
        if con_pre {
            // (la oclusión: lo que la prueba de su caja dio tapado del todo no se dibuja —ni la profundidad ni la luz—)
            self.oclu_leer();
            self.marca("oclu_leer");
            let cand: Vec<(usize, u64)> = mapa.iter().filter_map(|&i| self.oclu_clave(i).map(|k| (i, k))).collect();
            for &(i, k) in &cand { if self.oclu.get(&k).map_or(false, |e| !e.2) { self.tapados[i] = true; } }
            // (la pasada de profundidad: lo opaco que no se cala, sin color, de cerca a lejos —lo de atrás se descarta enseguida—;
            // después la luz sólo pinta lo que se ve —cada píxel una vez— y el cielo sólo donde no quedó nada)
            let cp = self.c.as_ref().unwrap().pos;
            let mut pre: Vec<usize> = mapa.iter().copied().filter(|&i| !self.tapados[i] && self.mats.get(&self.items[i].mat).map_or(false, |mt| mt.cut == 0)).collect();
            let lejos = |i: usize| { let e = self.items[i].esf; ((((e[0] - cp[0]).powi(2) + (e[1] - cp[1]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3]).max(0.0) / 6.0) as u32 };
            pre.sort_by_key(|&i| { let it = &self.items[i]; (!it.h.is_empty(), lejos(i), it.m, it.s0, it.mat) });
            self.gl.color_mask(false, false, false, false);
            self.dibujos += self.dibujar_lista_con(&pre, &vp, -1e9, true, true);
            self.marca("prepaso");
            // (las pruebas de las cajas, contra la profundidad que quedó: el resultado se usa en el cuadro siguiente)
            self.oclu_probar(&vp, &cand);
            self.gl.color_mask(true, true, true, true);
        }
        self.marca("profundidad");
        self.esc_wh = (ew as f32, eh as f32);
        self.ao_luz = con_ao && con_pre && self.pasada_ao_calc(ew, eh, &vp);
        if self.ao_luz { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.viewport(0, 0, ew, eh); }
        self.marca("oclusion");
        if !cielo3d { self.cielo(&vp); }
        let mut vis: Vec<usize> = mapa.iter().copied().filter(|&i| !self.tapados[i]).collect();
        if prueba("sin_corte") { vis.retain(|&i| self.mats.get(&self.items[i].mat).map_or(false, |mt| mt.cut == 0)); }
        if prueba("sin_piel") { vis.retain(|&i| self.items[i].h.is_empty()); }
        self.dibujos += self.dibujar_lista(&vis, &vp, -1e9, false);
        self.marca("luz");
        if con_ao && !self.ao_luz { self.pasada_ao(ew, eh, &vp); self.marca("oclusion"); }
        self.ao_luz = false;
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
            let it = &self.items[i]; if it.fl & FL_CIELO != 0 { continue; } let piel = !it.h.is_empty() && self.mallas[&it.m].piel; let p = if piel { &self.p_luz_piel_c } else { &self.p_luz_c };
            if act != Some(piel) { act = Some(piel); self.luces(p, &vp, -1e9); }
            let add = self.mats[&it.mat].add != 0;
            if add { self.gl.blend_func(glow::SRC_ALPHA, glow::ONE); self.niebla_suma(p, true); }
            // (lo transparente del arma, en su franja de la profundidad como lo demás del arma)
            let franja = it.fl & FL_ARMA != 0; if franja { self.gl.depth_range_f32(0.0, FRANJA_ARMA); }
            self.dibujar_item(p, it, true); self.dibujos += 1;
            if franja { self.gl.depth_range_f32(0.0, 1.0); }
            if add { self.gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); self.niebla_suma(p, false); }
        }
        if hay_agua {
            // la escena hasta acá (lo opaco y lo transparente), copiada: el agua la ve a través de sí, corrida por las olas
            if self.refr_rt.as_ref().map(|d| d.w != ew || d.h != eh).unwrap_or(true) { if let Some(d) = self.refr_rt.take() { borrar_destino(&self.gl, d); } self.refr_rt = Some(destino_con(&self.gl, ew, eh, true)); }
            { let gl = &self.gl; let r = self.refr_rt.as_ref().unwrap();
              gl.bind_framebuffer(glow::READ_FRAMEBUFFER, Some(fb)); gl.bind_framebuffer(glow::DRAW_FRAMEBUFFER, Some(r.fb));
              gl.blit_framebuffer(0, 0, ew, eh, 0, 0, ew, eh, glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT, glow::NEAREST);
              gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); }
            let olas_k = self.olas_subir();
            let a = self.agua.as_ref().unwrap(); let p = &self.p_agua;
            self.luces(p, &vp, -1e9);
            let gl = &self.gl;
            gl.uniform_4_f32(p.u(U::RayK), olas_k[0], olas_k[1], olas_k[2], olas_k[3]);
            if let Some(t) = self.olas_t.filter(|_| olas_k[3] > 0.5) { gl.active_texture(glow::TEXTURE15); gl.bind_texture(glow::TEXTURE_2D, Some(t)); gl.active_texture(glow::TEXTURE0); }
            gl.uniform_4_f32(p.u(U::F), a.fog[0], a.fog[1], a.fog[2], a.fog[3]);
            let refl_on = self.op.reflejo && cam_arriba && self.reflejo.is_some() && self.refl_agua;
            gl.uniform_4_f32(p.u(U::H), a.esc, a.fuerza, a.dist, if refl_on { 1.0 } else { 0.0 });
            gl.uniform_4_f32(p.u(U::S), a.s[0], a.s[1], a.s[2], a.s[3]);
            let (bx, bz, bw, bh, bd) = a.prof.as_ref().map(|q| (q.x0, q.z0, 1.0 / q.w, 1.0 / q.h, q.d)).unwrap_or((0.0, 0.0, 0.0, 0.0, 20.0));
            gl.uniform_4_f32(p.u(U::Bq), bx, bz, bw, bh); gl.uniform_2_f32(p.u(U::D), bd, a.largo.max(0.5));
            let t = self.c.as_ref().unwrap().tiempo; let t = if t > 0.0 { t } else { self.cuadro as f32 / 60.0 };
            gl.uniform_2_f32(p.u(U::RefInv), 1.0 / ew as f32, 1.0 / eh as f32); gl.uniform_1_f32(p.u(U::Tiempo), if std::env::var_os("JXM_TIEMPO_FIJO").is_some() { 3.0 } else { t });
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, self.agua_n);
            gl.uniform_1_f32(p.u(U::NC), self.agua_na.map_or(0.0, |x| x.1 as f32));
            // (las ondas del cuadro: las manda el juego en un bloque EF_ONDAS —primero si los ojos están abajo del agua—)
            let ondas: Vec<f32> = self.c.as_ref().and_then(|c| c.efectos.iter().find(|e| e.0 == EF_ONDAS)).map(|e| e.1.iter().skip(4).copied().take(32).collect()).unwrap_or_default();
            if !ondas.is_empty() { gl.uniform_4_f32_slice(p.u(U::Ond), &ondas); }
            if std::env::var_os("JXM_DBG_ONDAS").is_some() { eprintln!("ondas {:?} t {:.2} loc {:?}", ondas, self.c.as_ref().map_or(0.0, |c| c.tiempo), p.u(U::Ond).is_some()); }
            gl.uniform_1_f32(p.u(U::OndN), (ondas.len() / 4) as f32);
            if let Some((t, _)) = self.agua_na { gl.active_texture(glow::TEXTURE14); gl.bind_texture(glow::TEXTURE_2D_ARRAY, Some(t)); gl.active_texture(glow::TEXTURE0); }
            if let Some(r) = &self.reflejo { gl.active_texture(glow::TEXTURE3); gl.bind_texture(glow::TEXTURE_2D, Some(r.color)); }
            gl.active_texture(glow::TEXTURE4); gl.bind_texture(glow::TEXTURE_2D, Some(self.agua_p.unwrap_or(self.blanca)));
            gl.uniform_1_f32(p.u(U::RefrOn), if cam_arriba { 1.0 } else { 0.0 });
            gl.uniform_1_f32(p.u(U::RefrK), a.refr);
            gl.uniform_1_f32(p.u(U::Modo), a.fuente as f32); gl.uniform_3_f32(p.u(U::Tinte), a.t_refr[0], a.t_refr[1], a.t_refr[2]); gl.uniform_3_f32(p.u(U::Em), a.t_refl[0], a.t_refl[1], a.t_refl[2]);
            if let Some(r) = &self.refr_rt { gl.active_texture(glow::TEXTURE12); gl.bind_texture(glow::TEXTURE_2D, Some(r.color)); gl.active_texture(glow::TEXTURE13); gl.bind_texture(glow::TEXTURE_2D, r.prof_t); }
            for &i in &self.aguas {
                let it = &self.items[i]; let m = &self.mallas[&it.m];
                gl.bind_vertex_array(Some(m.vao)); gl.uniform_matrix_4_f32_slice(p.u(U::M), false, &it.mm);
                gl.uniform_3_f32(p.u(U::Mn), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u(U::Sc), m.sc[0], m.sc[1], m.sc[2]); gl.uniform_4_f32(p.u(U::St), 1.0, 1.0, 0.0, 0.0);
                gl.draw_elements(glow::TRIANGLES, it.sn as i32, if m.i32 { glow::UNSIGNED_INT } else { glow::UNSIGNED_SHORT }, (it.s0 * if m.i32 { 4 } else { 2 }) as i32);
                self.dibujos += 1;
            }
        }
        self.fluido(&vp, ew, eh);
        self.particulas(&vp);
        self.marca("transparente_agua");
        // (los hongos de las nucleares, con la profundidad de la escena)
        if self.op.hongo > 0 { if let Some(c) = self.c.as_ref() { let n = self.hongos.dibujar(&self.gl, c, self.op.hongo, Some(fb), ew, eh); if n > 0 { self.marca("hongos"); } } }
        let rayos = if self.op.rayos { self.pasada_rayos(ew, eh) } else { None };
        let brillo = if self.op.aaa { self.pasada_brillo(ew, eh) } else { None };
        let adapta = if self.op.adapta { self.pasada_adapta() } else { None };
        let gl = &self.gl;
        gl.depth_mask(true); gl.disable(glow::BLEND);
        // (la profundidad de la escena ya no se usa: la placa no la guarda en la memoria —en los celulares, por mosaicos, se ahorra
        // escribirla entera en cada cuadro—)
        // (con JX Turbo la profundidad queda: con ella se arma el cuadro intermedio)
        if !self.op.turbo { gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.invalidate_framebuffer(glow::FRAMEBUFFER, &[glow::DEPTH_ATTACHMENT]); }
        let col = self.escena_rt.as_ref().unwrap().color;
        // (la reconstrucción temporal: lo juntado, a la resolución de la pantalla, pasa a ser la escena; la cámara vuelve a la sin correr)
        let (col, ew, eh) = match self.pasada_taa(w, h, ew, eh, col) { Some(t) => (t, w, h), None => (col, ew, eh) };
        if let (Some(v0), Some(c)) = (self.taa_vp0, self.c.as_mut()) { c.vp = v0; }
        // (JX Turbo: la imagen terminada queda guardada —para los cuadros intermedios— y se copia a la pantalla; con su cámara y la
        // profundidad de 90 cm adelante —lo que está más cerca, el arma, no se corre—)
        if self.op.turbo {
            if self.final_rt.as_ref().map_or(true, |d| d.w != w || d.h != h) { if let Some(d) = self.final_rt.take() { borrar_destino(&self.gl, d); } self.final_rt = Some(destino(&self.gl, w, h)); }
            let ffb = self.final_rt.as_ref().unwrap().fb;
            self.pasada_final(Some(ffb), w, h, ew, eh, col, rayos, brillo, adapta);
            let (gl, fcol) = (&self.gl, self.final_rt.as_ref().unwrap().color);
            gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(0, 0, w, h);
            let todo: &[u32] = if salida.is_none() { &[glow::COLOR, glow::DEPTH, glow::STENCIL] } else { &[glow::COLOR_ATTACHMENT0, glow::DEPTH_ATTACHMENT] };
            gl.invalidate_framebuffer(glow::FRAMEBUFFER, todo); gl.disable(glow::DEPTH_TEST); gl.depth_mask(false);
            gl.use_program(Some(self.p_copia.p)); gl.active_texture(glow::TEXTURE11); gl.bind_texture(glow::TEXTURE_2D, Some(fcol));
            gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3);
            gl.bind_texture(glow::TEXTURE_2D, None); gl.active_texture(glow::TEXTURE0);
            gl.invalidate_framebuffer(glow::FRAMEBUFFER, &todo[1..]); gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
            if let Some(c) = self.c.as_ref() { self.vp_ult = Some(c.vp); self.corte_ult = FRANJA_ARMA; }
        } else {
            if let Some(d) = self.final_rt.take() { borrar_destino(&self.gl, d); } self.vp_ult = None;
            self.pasada_final(salida, w, h, ew, eh, col, rayos, brillo, adapta);
        }
        self.cuadro += 1;
        self.marca("final");
    }

    /// la imagen de la escena (`col`, de ew×eh) a la pantalla, estirada y con el retoque final, los rayos, el resplandor y la
    /// vista que se acostumbra; lo de antes en la pantalla no se lee (se pinta entera) y su profundidad no se usa
    unsafe fn pasada_final(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32, ew: i32, eh: i32, col: glow::Texture, rayos: Option<(glow::Texture, f32)>, brillo: Option<glow::Texture>, adapta: Option<glow::Texture>) {
        let gl = &self.gl;
        gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(self.vx, 0, w, h);
        let todo: &[u32] = if salida.is_none() { &[glow::COLOR, glow::DEPTH, glow::STENCIL] } else { &[glow::COLOR_ATTACHMENT0, glow::DEPTH_ATTACHMENT] };
        // (el segundo ojo del VR no borra lo del primero)
        if self.vx == 0 { gl.invalidate_framebuffer(glow::FRAMEBUFFER, todo); }
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false);
        let p = &self.p_final; gl.use_program(Some(p.p)); gl.uniform_1_f32(p.u(U::Retoque), if self.op.retoque { 1.0 } else { 0.0 });
        // (con la escena a menos píxeles: el reescalado —subir()— y un poco de nitidez encima, más cuanto más chica)
        let sube = ew < w - 1 || eh < h - 1; let nit = if self.op.escala < 0.97 { ((1.0 - self.op.escala) * 0.6).min(0.45) } else { 0.0 };
        gl.uniform_1_f32(p.u(U::Fuerza), nit); gl.uniform_2_f32(p.u(U::Inv), 1.0 / ew as f32, 1.0 / eh as f32);
        gl.active_texture(glow::TEXTURE11); gl.bind_texture(glow::TEXTURE_2D, Some(col));
        gl.uniform_1_f32(p.u(U::RayK), rayos.map_or(0.0, |r| r.1)); gl.uniform_1_f32(p.u(U::BloomK), if brillo.is_some() { 0.45 } else { 0.0 });
        gl.active_texture(glow::TEXTURE10); gl.bind_texture(glow::TEXTURE_2D, Some(brillo.unwrap_or(self.blanca)));
        gl.active_texture(glow::TEXTURE15); gl.bind_texture(glow::TEXTURE_2D, Some(rayos.map_or(self.blanca, |r| r.0)));
        gl.active_texture(glow::TEXTURE13); gl.bind_texture(glow::TEXTURE_2D, Some(adapta.unwrap_or(self.blanca))); let bajo = self.c.as_ref().and_then(|c| c.efectos.iter().find(|e| e.0 == EF_ONDAS)).map_or(false, |e| e.1.first().copied().unwrap_or(0.0) > 0.5);
        gl.uniform_4_f32(p.u(U::Adapta), if adapta.is_some() { 1.0 } else { 0.0 }, if bajo { 1.0 } else { 0.0 }, self.c.as_ref().map_or(0.0, |c| c.tiempo), if sube { 1.0 + ((0.9 - self.op.escala) / 0.4).clamp(0.0, 1.0) } else { 0.0 });
        gl.active_texture(glow::TEXTURE11);
        gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.bind_texture(glow::TEXTURE_2D, None); gl.active_texture(glow::TEXTURE0);
        gl.invalidate_framebuffer(glow::FRAMEBUFFER, &todo[1..]);
        gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
    }

    /// la reconstrucción temporal (FS_TAA): lo de este cuadro junto con lo de los anteriores, a la resolución de la pantalla; None
    /// si no va (la escena del tamaño de la pantalla, sin profundidad o apagada)
    unsafe fn pasada_taa(&mut self, w: i32, h: i32, ew: i32, eh: i32, col: glow::Texture) -> Option<glow::Texture> {
        let v0 = self.taa_vp0?; let prof = self.escena_rt.as_ref()?.prof_t?;
        for k in 0..2 { if self.taa_rt[k].as_ref().map_or(true, |d| d.w != w || d.h != h) { if let Some(d) = self.taa_rt[k].take() { borrar_destino(&self.gl, d); } self.taa_rt[k] = Some(destino(&self.gl, w, h)); self.taa_vp = None; } }
        let (i, j) = (self.taa_i, 1 - self.taa_i); self.taa_i = j;
        let (dst, his) = (self.taa_rt[j].as_ref()?.fb, self.taa_rt[i].as_ref()?.color);
        let nuevo = self.taa_vp.is_none(); let re = self.taa_vp.map(|pv| mat::mul(&pv, &mat::inv(&v0))).unwrap_or(mat::id());
        let gl = &self.gl;
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(dst)); gl.viewport(0, 0, w, h); gl.invalidate_framebuffer(glow::FRAMEBUFFER, &[glow::COLOR_ATTACHMENT0, glow::DEPTH_ATTACHMENT]);
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false); gl.disable(glow::BLEND);
        let p = &self.p_taa; gl.use_program(Some(p.p));
        gl.uniform_matrix_4_f32_slice(p.u(U::M), false, &re); gl.uniform_2_f32(p.u(U::Inv), 1.0 / ew as f32, 1.0 / eh as f32);
        gl.uniform_2_f32(p.u(U::Sc), self.taa_jit[0], self.taa_jit[1]); gl.uniform_1_f32(p.u(U::Fuerza), if nuevo { 1.0 } else { 0.0 }); gl.uniform_1_f32(p.u(U::Corte), FRANJA_ARMA);
        gl.active_texture(glow::TEXTURE11); gl.bind_texture(glow::TEXTURE_2D, Some(col));
        gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, Some(prof));
        gl.active_texture(glow::TEXTURE12); gl.bind_texture(glow::TEXTURE_2D, Some(his));
        gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.bind_texture(glow::TEXTURE_2D, None); gl.active_texture(glow::TEXTURE0);
        gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        self.taa_vp = Some(v0); self.marca("taa");
        self.taa_rt[j].as_ref().map(|d| d.color)
    }
    /// JX Turbo: si hay un cuadro guardado para armar intermedios de este tamaño
    pub fn turbo_listo(&self, w: i32, h: i32) -> bool {
        self.op.turbo && self.vp_ult.is_some() && self.final_rt.as_ref().map_or(false, |d| d.w == w && d.h == h) && self.escena_rt.as_ref().map_or(false, |e| e.prof_t.is_some())
    }
    /// JX Turbo: el cuadro intermedio. La imagen terminada del último cuadro, corrida a la cámara de ahora (`vp`) con su
    /// profundidad —cada punto se vuelve a poner donde cae visto desde acá, como los visores de realidad virtual—: una sola pasada
    /// de pantalla en vez del mundo entero. false si no hay cuadro guardado (falta el turbo, la profundidad o un cuadro de verdad)
    pub unsafe fn intermedio(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32, vp: &M4, arma: Option<&M4>) -> bool {
        if !self.turbo_listo(w, h) { return false; }
        let (Some(vieja), Some(prof), Some(f)) = (self.vp_ult, self.escena_rt.as_ref().and_then(|e| e.prof_t), self.final_rt.as_ref()) else { return false };
        let gl = &self.gl;
        gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(self.vx, 0, w, h);
        let todo: &[u32] = if salida.is_none() { &[glow::COLOR, glow::DEPTH, glow::STENCIL] } else { &[glow::COLOR_ATTACHMENT0, glow::DEPTH_ATTACHMENT] };
        // (el segundo ojo del VR no borra lo del primero)
        if self.vx == 0 { gl.invalidate_framebuffer(glow::FRAMEBUFFER, todo); }
        gl.disable(glow::DEPTH_TEST); gl.depth_mask(false); gl.disable(glow::BLEND);
        let p = &self.p_repro; gl.use_program(Some(p.p));
        let vi = mat::inv(&vieja); let mm = mat::mul(vp, &vi); let ma = arma.map(|a| mat::mul(&mat::mul(vp, a), &vi)).unwrap_or(mm);
        gl.uniform_matrix_4_f32_slice(p.u(U::M), false, &mm); gl.uniform_matrix_4_f32_slice(p.u(U::Ma), false, &ma); gl.uniform_1_f32(p.u(U::Corte), self.corte_ult);
        { let pr = self.escena_rt.as_ref().unwrap(); gl.uniform_2_f32(p.u(U::Inv), 1.0 / pr.w as f32, 1.0 / pr.h as f32); }
        gl.active_texture(glow::TEXTURE11); gl.bind_texture(glow::TEXTURE_2D, Some(f.color));
        gl.active_texture(glow::TEXTURE9); gl.bind_texture(glow::TEXTURE_2D, Some(prof));
        gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3);
        gl.bind_texture(glow::TEXTURE_2D, None); gl.active_texture(glow::TEXTURE11); gl.bind_texture(glow::TEXTURE_2D, None); gl.active_texture(glow::TEXTURE0);
        gl.invalidate_framebuffer(glow::FRAMEBUFFER, &todo[1..]);
        gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        self.dibujos = 1;
        true
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
        if std::env::var_os("JXM_DBG_UI").is_some() && self.cuadro % 100 == 0 {
            let mut area = 0.0f64; for t in v.chunks_exact(24) { let (ax, ay, bx, by, cx, cy) = (t[0], t[1], t[8], t[9], t[16], t[17]); area += (((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) * 0.5).abs() as f64; }
            eprintln!("ui tanda tex {tex}: {} triángulos, área {:.2} pantallas", v.len() / 24, area / (w as f64 * h as f64));
        }
        gl.bind_vertex_array(None); gl.disable(glow::BLEND); gl.enable(glow::DEPTH_TEST); gl.depth_mask(true);
        self.dibujos += 1;
    }

    /// (JXM_FASES) termina lo mandado y anota cuánto tardó desde la marca anterior
    pub unsafe fn marca(&mut self, n: &'static str) {
        let Some((t, v)) = self.fases.as_mut() else { return };
        self.gl.finish(); let ms = t.elapsed().as_secs_f64() * 1000.0; *t = std::time::Instant::now();
        let v = if ab() { &mut self.fases_b } else { v };
        match v.iter_mut().find(|x| x.0 == n) { Some(x) => x.1 += ms, None => v.push((n, ms)) }
    }
    /// la altura del piso que se reflejó en el último cuadro (None: no hubo reflejo del piso)
    pub fn piso_refleja(&self) -> Option<f32> { self.refl_piso }
    pub fn resumen(&self) -> String {
        let corte: Vec<usize> = self.opacos.iter().copied().filter(|&i| self.mats.get(&self.items[i].mat).map_or(false, |mt| mt.cut != 0)).collect();
        let piel: Vec<usize> = self.opacos.iter().copied().filter(|&i| !self.items[i].h.is_empty()).collect();
        let tri = |l: &[usize]| l.iter().map(|&i| self.items[i].sn as u64 / 3).sum::<u64>();
        let extra = format!("recortados: {} ({} triángulos) · con huesos: {} ({} triángulos) · ", corte.len(), tri(&corte), piel.len(), tri(&piel));
        extra + &self.resumen0()
    }
    fn resumen0(&self) -> String {
        let n = self.items.len();
        let tri = |l: &[usize]| l.iter().map(|&i| self.items[i].sn as u64 / 3).sum::<u64>();
        let todos: Vec<usize> = (0..n).collect(); let mut grandes: Vec<(u64, i64)> = self.opacos.iter().map(|&i| (self.items[i].sn as u64 / 3, self.items[i].m)).collect(); grandes.sort(); grandes.reverse(); grandes.truncate(6);
        format!("mapa {} · {} mallas · {} texturas · {} luces horneadas · {} materiales · {:.1} MB en la placa · {} cosas en el cuadro ({} opacas, {} transparentes, {} de agua a la vista) · triángulos: {} a la vista de {} · los más grandes {:?}",
            self.mapa, self.mallas.len(), self.texs.len(), self.lms.len(), self.mats.len(), self.memoria as f64 / 1e6, n, self.opacos.len(), self.transp.len(), self.aguas.len(), tri(&self.opacos), tri(&todos), grandes)
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
    // (con una sola cascada, la de cerca cubre todo el radio y va centrada —el «Stable Fit» de Unity—)
    let una = op.cascadas == 1 && k == 0;
    let r = if una { op.sombra_radio } else if k == 0 { op.sombra_radio * 0.25 } else { op.sombra_radio };
    // (la fila de w de la matriz de la cámara es para adelante)
    let mut c0 = c.pos;
    // (la de cerca va delante de la cámara: hacia uno de 16 rumbos —sin lo vertical—, así girando un poco no se mueve y su
    // sombra guardada sigue sirviendo)
    if k == 0 && !una { let f = mat::norm([c.vp[3], c.vp[7], c.vp[11]]); let hz = (f[0] * f[0] + f[2] * f[2]).sqrt();
        if hz > 0.3 { let paso = std::f32::consts::TAU / 16.0; let a = (f[2].atan2(f[0]) / paso).round() * paso; c0[0] += a.cos() * r * 0.6; c0[2] += a.sin() * r * 0.6; } }
    let paso = 2.0 * r / px as f32; let cen = [(c0[0] / paso).round() * paso, (c0[1] / paso).round() * paso, (c0[2] / paso).round() * paso];
    // (lo que hay entre el sol y la caja, hasta 80 m más arriba, también tapa; el margen de profundidad, en metros)
    let alto = r + 80.0; let rango = alto + r;
    let ojo = [cen[0] + s[0] * alto, cen[1] + s[1] * alto, cen[2] + s[2] * alto];
    let arriba = if s[1].abs() > 0.95 { [0.0, 0.0, 1.0] } else { [0.0, 1.0, 0.0] };
    (mat::mul(&mat::orto(-r, r, -r, r, 0.5, rango), &mat::mirar(ojo, cen, arriba)), [0.04 / rango, 1.5 * paso])
}
