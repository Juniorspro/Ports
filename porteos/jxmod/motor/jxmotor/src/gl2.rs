//! El motor para los teléfonos viejos: OpenGL ES 2.0 (GLSL ES 1.00), sólo con lo que ES 2 tiene de fábrica. Dibuja lo
//! mismo que gpu.rs con menos: la luz del juego (sol, cielo y suelo, luz horneada, hasta 4 luces del mapa, niebla y
//! ACES), el terreno de tres capas, las texturas mezcladas, lo recortado, lo transparente y lo que suma, el cielo del mapa
//! (su degradé y el sol), el agua (olas con su mapa de normales, Fresnel con el color del cielo y transparente; sin reflejo)
//! y el HUD. Con la sombra del sol (un mapa ortográfico alrededor de la cámara con la profundidad repartida en RGBA —ES 2 no
//! asegura texturas de profundidad—, cuatro lecturas con mezcla bilineal) y el reflejo del agua (la escena espejada a un
//! tercio, sin lo de abajo del agua); sin oclusión ambiental (una placa vieja no llega), sin instancias (un dibujo por cosa)
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
/// lo que se puede elegir: la fracción de la pantalla, el retoque, la sombra del sol (lado del mapa, cada cuántos cuadros se
/// rehace y su radio alrededor de la cámara), el reflejo del agua y del piso (a 1/`reflejo_div` del lado) y los rayos del sol
pub struct Opciones2 { pub escala: f32, pub retoque: bool, pub sombras: bool, pub sombra_px: i32, pub sombra_cada: u32, pub sombra_radio: f32, pub reflejo: bool, pub reflejo_div: i32, pub reflejo_piso: bool, pub rayos: bool, pub hongo: u8, pub aaa: bool, pub adapta: bool }
impl Default for Opciones2 { fn default() -> Self { Opciones2 { escala: 1.0, retoque: true, sombras: true, sombra_px: 1024, sombra_cada: 2, sombra_radio: 60.0, reflejo: true, reflejo_div: 3, reflejo_piso: true, rayos: false, hongo: 2, aaa: false, adapta: false } } }

struct Malla2 { vb: glow::Buffer, ib: glow::Buffer, lm: Option<glow::Buffer>, i32: bool, mn: [f32; 3], sc: [f32; 3], lm_id: i64, bytes: usize, piel: Option<Box<PielCpu>> }
/// lo que hace falta para deformar una malla con huesos en la CPU: posición y normal sueltas, huesos y pesos por vértice
/// y los vértices armados (para copiar las UV y el byte de la normal que no se toca)
struct PielCpu { p: Vec<[f32; 3]>, n: Vec<[f32; 3]>, j: Vec<[u8; 4]>, w: Vec<[f32; 4]>, vv: Vec<u8> }
/// una malla ya deformada en este cuadro: su id, la pose, el búfer y la caja de sus posiciones
struct Pose2 { m: i64, h: Vec<f32>, vb: glow::Buffer, mn: [f32; 3], sc: [f32; 3] }
struct Tex2 { t: glow::Texture, bytes: usize, tam: [f32; 2] }
struct Prog2 { p: glow::Program, u: HashMap<&'static str, glow::UniformLocation> }
impl Prog2 { fn u(&self, n: &str) -> Option<&glow::UniformLocation> { self.u.get(n) } }

const VS_LUZ: &str = r#"
attribute vec3 aP; attribute vec4 aN; attribute vec2 aU; attribute vec2 aL;
uniform mat4 uVP, uM, uSVP, uSVP2; uniform vec3 uMn, uSc; uniform vec4 uSt, uSomP, uSomP2;
varying vec3 vW; varying vec3 vN; varying vec2 vU; varying vec2 vL; varying float vMz; varying vec4 vS, vS2;
void main() {
  vec4 w = uM * vec4(uMn + aP * uSc, 1.0);
  vW = w.xyz; vN = (uM * vec4(aN.xyz, 0.0)).xyz; vU = aU * uSt.xy + uSt.zw; vL = aL; vMz = aN.w;
  // (la sombra: el punto corrido un poco hacia afuera por su normal —sin el «acné» de la sombra sobre sí misma—)
  vec3 nn = vN * inversesqrt(max(dot(vN, vN), 1e-8));
  vS = uSVP * vec4(w.xyz + nn * uSomP.w, 1.0); vS2 = uSVP2 * vec4(w.xyz + nn * uSomP2.y, 1.0);
  gl_Position = uVP * w;
}"#;
const FS_LUZ: &str = r#"
#if defined(CORTE) && defined(GL_OES_standard_derivatives)
#extension GL_OES_standard_derivatives : enable
#endif
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uT, uT1, uT2, uT3, uLM; uniform vec4 uS1; uniform vec2 uS3;
uniform vec4 uC, uTi, uTi2, uTi3; uniform vec3 uSol, uSolC, uAmbS, uAmbG, uNieC, uNieS, uCam, uEm, uMat, uNie; uniform float uExpo; uniform float uModo;
uniform vec4 uLP[4], uLC[4]; uniform float uLN;
// (las banderas del material ya separadas: terreno, dos texturas, recorte, sin luz · luz horneada, hojas)
uniform vec4 uBan; uniform vec3 uBan2;
varying vec3 vW; varying vec3 vN; varying vec2 vU; varying vec2 vL; varying float vMz; varying vec4 vS, vS2;
// (la sombra del sol: la profundidad del mapa del sol viene en los cuatro canales de una textura común —ES 2 no tiene
// texturas de profundidad seguro—; cuatro muestras y el borde del mapa que se desvanece)
// Dos cascadas una al lado de la otra en el mismo mapa (como OpenGL 3): la de cerca (fina, delante de la cámara) y la de lejos
// (todo el radio); en el borde de la de cerca se mezclan, sin costura, y la de lejos se desvanece en su borde
uniform sampler2D uSom; uniform vec4 uSomP, uSomP2;
float desem(vec4 c) { return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
// (las cuatro comparaciones de los texeles de alrededor, mezcladas según dónde cae el punto entre ellos: el borde suave,
// como la comparación lineal de OpenGL 3, con las mismas cuatro lecturas; k: qué mitad del mapa)
float pcf(vec3 q, float k, float sesgo) {
  float z = q.z - sesgo, d = uSomP.x; vec2 t = q.xy / d - 0.5; vec2 f = fract(t); vec2 b = (floor(t) + 0.5) * d;
  b.x = (b.x + k) * 0.5; float dx = d * 0.5;
  float s00 = step(z, desem(texture2D(uSom, b))), s10 = step(z, desem(texture2D(uSom, b + vec2(dx, 0.0))));
  float s01 = step(z, desem(texture2D(uSom, b + vec2(0.0, d)))), s11 = step(z, desem(texture2D(uSom, b + vec2(dx, d))));
  return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
}
float sombraLejos() {
  vec3 q = vS2.xyz / vS2.w * 0.5 + 0.5; vec2 e = abs(q.xy - 0.5) * 2.0; float borde = smoothstep(0.85, 0.98, max(e.x, e.y));
  if (borde >= 1.0 || q.z >= 1.0) return 1.0;
  return mix(pcf(q, 1.0, uSomP2.x), 1.0, borde);
}
float sombra() {
  if (uSomP.z < 0.5) return 1.0;
  vec3 q = vS.xyz / vS.w * 0.5 + 0.5; vec2 e = abs(q.xy - 0.5) * 2.0; float g = max(e.x, e.y);
  if (g < 0.97 && q.z < 1.0) { float s0 = pcf(q, 0.0, uSomP.y), k = smoothstep(0.8, 0.97, g); return k > 0.0 ? mix(s0, sombraLejos(), k) : s0; }
  return sombraLejos();
}
#ifdef CLIP
// (el reflejo del agua: lo de abajo del agua no se refleja)
uniform vec4 uClip;
#endif
// (el reflejo del piso —como los pisos brillantes de Half-Life 2—: lo de arriba del piso dibujado espejado en otra textura
// (uR); uRP: 1/ancho y 1/alto de la pantalla, si está y la altura del piso. Sólo en lo plano que está a esa altura, más
// fuerte cuanto más liso es el material y cuanto más de costado se mira —el Fresnel—, y borroso si el material es áspero)
uniform sampler2D uR; uniform vec4 uRP; uniform float uAlfaD;
// (el cielo, para su reflejo en todo —como OpenGL 3—)
uniform vec3 uTop, uMid, uBot; uniform vec2 uExp; uniform float uCieloK; uniform vec4 uNubes;
const float PI = 3.14159265;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
// (x^2,2 y x^(1/2,2) con tres raíces en vez de pow: el mismo color —menos de 0,2 de un nivel de 8 bits— y mucho menos trabajo)
vec3 dec(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return x * x * (0.73929934 * b + 0.34228227 * c - 0.0593772 * a - 0.0226474); }
vec3 enc(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return 0.93020244 * a + 0.14337668 * b - 0.02588437 * c - 0.04836126 * x; }
vec3 cieloCol(vec3 d) { bool ar = d.y > 0.0; vec3 c = mix(uMid, ar ? uTop : uBot, pow(abs(d.y), ar ? uExp.x : uExp.y)); return dec(c) * uCieloK; }
// (el BRDF de OpenGL 3: GGX con la rugosidad y el metal de cada material)
vec3 brdf(vec3 n, vec3 v, vec3 l, vec3 dif, vec3 f0, float a) {
  float nl = dot(n, l); if (nl <= 0.0) return vec3(0.0);
  vec3 h = normalize(l + v); float nh = max(dot(n, h), 0.0), nv = max(dot(n, v), 1e-3), lh = max(dot(l, h), 0.0);
  float a2 = a * a, d = nh * nh * (a2 - 1.0) + 1.0, D = a2 / (PI * d * d);
  float k = a * 0.5, V = 0.25 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
  float m1 = max(1.0 - lh, 0.0), m2 = m1 * m1; vec3 F = f0 + (1.0 - f0) * (m2 * m2 * m1);
  return (dif * (1.0 - F) + min(D * V, 40.0) * F * PI) * nl;
}

// (el retoque final de WebGL en Alto —más color, contraste en S y viñeta—, acá mismo: sin otra pasada)
uniform vec3 uRet;
// (Definitivo: la luz horneada del mapa como en un día nublado —el Ravenholm con trazado de rayos—: la mitad de su color
// pasa a un blanco frío, con el mismo brillo; el sol amarillo de muchos mapas de Source no tiñe todo de naranja)
vec3 nublado(vec3 l) { float y = dot(l, vec3(0.2126, 0.7152, 0.0722)); return mix(l, y * vec3(0.9, 1.0, 1.12), 0.5); }
vec3 retoque(vec3 c) {
  if (uRet.z < 0.5) return c;
  c = dec(c); float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, 1.15), 0.0, 1.0); c = max(c - 0.006, 0.0) * 1.006; c = c * c * (3.0 - 2.0 * c) * 0.26 + c * 0.74; c = enc(c);
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
#ifdef CORTE
// (lo recortado —rejas, alambrados, hojas—: cerca, el borde parejo por las derivadas; de lejos, cuando los agujeros de la
// textura son más chicos que un punto de la pantalla, lo que tapa en promedio —el alfa del nivel chico— en un tramado: un
// velo como el de una reja de verdad en vez de rayas; uTam: el tamaño de la textura. Sin derivadas, el corte de siempre)
uniform vec2 uTam;
// (el tramado ordenado de 4×4: de lejos se lee como una malla pareja, no como ruido)
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a) + 0.03125; }
float cobertura(float a, vec2 uv) {
#ifdef GL_OES_standard_derivatives
  vec2 dx = dFdx(uv * uTam), dy = dFdy(uv * uTam);
  float mip = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-8));
  float filo = clamp((a - 0.5) / max(fwidth(a), 1e-4) + 0.5, 0.0, 1.0);
  return mix(filo, a, clamp(mip, 0.0, 1.0));
#else
  return a < 0.5 ? 0.0 : 1.0;
#endif
}
#endif
void main() {
#ifdef CLIP
  if (dot(vec4(vW, 1.0), uClip) < 0.0) discard;
#endif
  vec4 t; float rk = 0.0;
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
  if (uBan.z > 0.5 && cobertura(t.a, vU) <= bayer4(gl_FragCoord.xy)) discard;
#endif
  vec3 col;
  if (uBan.w > 0.5) col = dec(t.rgb) * 1.4;
  else {
    vec3 alb = dec(t.rgb); vec3 ng = normalize(vN); if (!gl_FrontFacing) ng = -ng;
    bool fol = uBan2.y > 0.5, lm = uBan2.x > 0.5;
    vec3 n = fol ? normalize(mix(ng, vec3(0.0, 1.0, 0.0), 0.55)) : ng;
    vec3 v = normalize(uCam - vW); float rough = uMat.x, metal = uMat.y, a = max(rough * rough, 0.004), sh = 1.0;
    vec3 dif = alb * (1.0 - metal), f0 = mix(vec3(uMat.z), alb, metal), lmL = vec3(0.0);
    if (lm) {
      // (la luz horneada del mapa ya trae sus sombras: la del sol sólo oscurece lo que en ella estaba al sol —lo que se
      // mueve, los props—; adentro y a la sombra horneada no se oscurece dos veces)
      lmL = dec(texture2D(uLM, vL).rgb) * 4.0; if (uNubes.x > 0.5) lmL = nublado(lmL); sh = sombra();
      col = dif * lmL * (1.0 - 0.55 * (1.0 - sh) * smoothstep(0.5, 1.4, dot(lmL, vec3(0.2126, 0.7152, 0.0722))));
    } else {
      // (con el sol casi de costado la sombra de una placa sobre sí misma —el «acné»— se ve como pelos: ahí se desvanece)
      float nl = dot(n, uSol);
      sh = nl > 0.0 ? mix(1.0, sombra(), smoothstep(0.05, 0.35, nl)) : 0.0;
      col = brdf(n, v, uSol, dif, f0, a) * uSolC * sh;
      if (fol) { float tr = max(dot(-v, uSol), 0.0); tr *= tr; col += dif * uSolC * (tr * tr) * 0.6 * sh; }
    }
    if (uRP.z > 0.5 && n.y > 0.94 && abs(vW.y - uRP.w) < 0.08) {
      float fr = 1.0 - max(dot(n, v), 0.0); fr *= fr;
      rk = smoothstep(0.82, 0.3, rough) * mix(0.3, 1.0, fr * fr) * uRP.z;
    }
    for (int i = 0; i < 4; i++) {
      if (float(i) >= uLN) break;
      vec3 L = uLP[i].xyz - vW; float d2 = dot(L, L), r = uLP[i].w;
      if (d2 > r * r) continue;
      float d = sqrt(d2), q = d2 / (r * r), cae = clamp(1.0 - q * q, 0.0, 1.0); float at = cae * cae / (d2 + 1.0);
      col += dif * uLC[i].rgb * max(dot(n, L / d), 0.0) * at;
    }
    // la luz del cielo como OpenGL 3: difusa (hemisferio) y el reflejo del cielo, más borroso cuanto más áspero, con Fresnel
    vec3 rf = reflect(-v, n), amb, env; float nv = max(dot(n, v), 1e-3);
    if (lm) { amb = vec3(0.0); env = lmL * 0.5; } else { amb = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5); env = mix(cieloCol(rf), amb, clamp(rough * 1.15, 0.0, 1.0)); }
    float hor = clamp(1.0 + 1.3 * dot(rf, ng), 0.0, 1.0); env *= hor * hor;
    float q1 = 1.0 - nv, q2 = q1 * q1; vec3 Fr = f0 + (max(vec3(1.0 - rough), f0) - f0) * (q2 * q2 * q1);
    col += dif * amb * 0.82 + env * Fr * mix(1.0, sh * 0.6 + 0.4, metal) + uEm * 1.6;
  }
  col += emAc;
  float dist = max(distance(vW, uCam), 1e-3);
  float f = clamp((dist - uNie.x) / max(uNie.y - uNie.x, 0.001), 0.0, 1.0) * uNie.z;
  vec3 vd = (vW - uCam) / dist; float sd = max(dot(vd, uSol), 0.0), sd2 = sd * sd; vec3 nc = uNieC + uNieS * (sd2 * sd2 * sd2);
  // (y la bruma de lo lejos y bajo, como OpenGL 3)
  f = 1.0 - (1.0 - f) * exp(-max(0.0, dist - 20.0) * (0.0006 + 0.0002 * uNubes.x) * exp(-max(vW.y - uCam.y + 5.0, 0.0) * 0.02));
  if (uNubes.x > 0.5) nc = mix(nc, cieloCol(normalize(vec3(vd.x, 0.15, vd.z))), 0.25);
  col = mix(col, nc, f);
  vec3 fin = enc(aces(col * uExpo));
  if (rk > 0.0) {
    vec2 q = gl_FragCoord.xy * uRP.xy, o = uRP.xy * (1.5 + 9.0 * uMat.x);
    vec3 r = (texture2D(uR, q + vec2(o.x, o.y)).rgb + texture2D(uR, q - vec2(o.x, o.y)).rgb + texture2D(uR, q + vec2(o.x, -o.y)).rgb + texture2D(uR, q - vec2(o.x, -o.y)).rgb) * 0.25;
    fin = mix(fin, r, rk * (1.0 - f));
  }
  // (el alfa: lo transparente, el suyo para mezclarse; lo opaco, 1 —o, si la escena va a su textura, la distancia hasta 64 m:
  // es la máscara del cielo de los rayos del sol (el cielo deja 0) y hasta dónde va la luz en el aire—)
  gl_FragColor = vec4(retoque(fin) + (ign(gl_FragCoord.xy) - 0.5) / 255.0, uBan2.z > 0.5 ? t.a : (uAlfaD > 0.5 ? clamp(dist / 64.0, 1.0 / 255.0, 1.0) : 1.0));
#ifdef VER_SOMBRA
  gl_FragColor = vec4(vec3(sombra()), 1.0);
#endif
}"#;
// la caja de la oclusión: sólo se prueba contra la profundidad
const VS_SOM: &str = r#"
attribute vec3 aP; attribute vec4 aN; attribute vec2 aU;
uniform mat4 uVP, uM; uniform vec3 uMn, uSc; uniform vec4 uSt;
varying vec2 vU;
void main() { vec4 w = uM * vec4(uMn + aP * uSc, 1.0); vU = aU * uSt.xy + uSt.zw; gl_Position = uVP * w; }"#;
const FS_SOM: &str = r#"
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uT; varying vec2 vU;
void main() {
#ifdef CORTE
  if (texture2D(uT, vU).a < 0.5) discard;
#endif
  // (la profundidad repartida en los cuatro canales de 8 bits)
  vec4 e = fract(gl_FragCoord.z * vec4(1.0, 255.0, 65025.0, 16581375.0)); e -= e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  gl_FragColor = e;
}"#;
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
uniform mat4 uIVP; uniform vec3 uSol, uNieC, uTop, uMid, uBot, uTinte, uSolC; uniform vec2 uExp; uniform float uExpo, uTiene, uCieloK, uDia, uCieloA; uniform samplerCube uCubo; uniform vec4 uNubes;
@@NUBES@@
varying vec2 vP;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
// (el retoque final de WebGL en Alto —más color, contraste en S y viñeta—, acá mismo: sin otra pasada)
vec3 dec(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return x * x * (0.73929934 * b + 0.34228227 * c - 0.0593772 * a - 0.0226474); }
vec3 enc(vec3 x) { x = max(x, 0.0); vec3 a = sqrt(x), b = sqrt(a), c = sqrt(b); return 0.93020244 * a + 0.14337668 * b - 0.02588437 * c - 0.04836126 * x; }
uniform vec3 uRet;
vec3 retoque(vec3 c) {
  if (uRet.z < 0.5) return c;
  c = dec(c); float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, 1.15), 0.0, 1.0); c = max(c - 0.006, 0.0) * 1.006; c = c * c * (3.0 - 2.0 * c) * 0.26 + c * 0.74; c = enc(c);
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
void main() {
  vec4 a = uIVP * vec4(vP, -1.0, 1.0), b = uIVP * vec4(vP, 1.0, 1.0); vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  if (uTiene > 0.5) {
    bool ar = d.y > 0.0; vec3 g = mix(uMid, ar ? uTop : uBot, pow(abs(d.y), ar ? uExp.x : uExp.y));
    vec3 cc = g; if (uTiene > 1.5) cc = mix(g, textureCube(uCubo, d).rgb * uTinte, uDia);
    // (Definitivo: las nubes encima y el disco del sol)
    vec4 n = uNubes.x > 0.5 && uTiene < 1.5 ? nubes(d, uSol, uNubes.y, uSolC, uTop) : vec4(0.0); cc = mix(cc, n.rgb, n.a);
    vec3 c = dec(cc) * uCieloK;
    if (uNubes.x > 0.5) c += sol_disco(d, uSol, uSolC) * (1.0 - n.a);
    gl_FragColor = vec4(retoque(enc(min(c, vec3(1.0)))), uCieloA); return;
  }
  vec3 cen = vec3(0.16, 0.36, 0.78), hor = vec3(0.62, 0.74, 0.88);
  vec3 c = d.y >= 0.0 ? mix(hor, cen, pow(clamp(d.y, 0.0, 1.0), 0.45)) : mix(hor, uNieC, clamp(-d.y * 4.0, 0.0, 1.0));
  vec4 n = uNubes.x > 0.5 ? nubes(d, uSol, uNubes.y, uSolC, cen) : vec4(0.0); c = mix(c, n.rgb, n.a);
  c += vec3(1.0, 0.92, 0.75) * pow(max(dot(d, uSol), 0.0), 600.0) * 6.0 * (1.0 - n.a);
  gl_FragColor = vec4(retoque(enc(aces(c * uExpo * 1.1))), uCieloA);
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
uniform sampler2D uN, uR; uniform vec4 uF, uH, uS, uRP; uniform vec3 uCam, uSol, uSolC, uAmbS, uAmbG, uTop, uMid; uniform float uTiempo, uExpo;
varying vec3 vW;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  float dCam = distance(vW, uCam); vec3 v = normalize(uCam - vW); vec2 q = vW.xz * uH.x;
  vec3 n1 = texture2D(uN, q + uTiempo * uS.xy).rgb * 2.0 - 1.0, n2 = texture2D(uN, q * 0.71 + vec2(0.37, 0.61) + uTiempo * uS.zw).rgb * 2.0 - 1.0;
  float lejos = 1.0 / (1.0 + dCam * 0.012); vec2 d = (n1.xy + n2.xy) * uH.y * lejos; vec3 n = normalize(vec3(d.x, 1.0, d.y));
  float fq = 1.0 - abs(dot(n, v)), fq2 = fq * fq; float fr = 0.02 + 0.98 * (fq2 * fq2 * fq);
  vec3 cuerpo = pow(aces(uF.rgb * (mix(uAmbG, uAmbS, 0.8) + uSolC * max(uSol.y, 0.0) * 0.5) * 1.6 * uExpo), vec3(1.0 / 2.2));
  vec3 rf = reflect(-v, n); vec3 cielo = mix(uMid, uTop, pow(clamp(rf.y, 0.0, 1.0), 0.5));
  // (el reflejo de verdad: la escena espejada, movida por las olas)
  if (uRP.z > 0.5) cielo = mix(cielo, texture2D(uR, clamp(gl_FragCoord.xy * uRP.xy + d * 0.6, 0.002, 0.998)).rgb, 0.9);
  float rv = max(dot(rf, uSol), 0.0); float sp = pow(rv, mix(900.0, 260.0, 1.0 - lejos)) * 2.2 * step(0.0, uSol.y);
  gl_FragColor = vec4(mix(cuerpo, cielo, fr) + uSolC * sp, mix(max(uF.a, 0.82), 1.0, fr));
#ifdef VER_REFLEJO
  gl_FragColor = vec4(texture2D(uR, gl_FragCoord.xy * uRP.xy).rgb * uRP.z, 1.0);
#endif
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
// la vista que se acostumbra (como FS_ADAPTA de gpu.rs): el brillo de la escena —12×12 lecturas, el medio pesa más— y la
// exposición, de a poco; en 1×1, rojo y verde (anda con precisión media)
const FS_ADAPTA: &str = r#"
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uEsc, uAd; uniform vec4 uAdapta; varying vec2 vU;
float dec16(vec4 t) { return (floor(t.r * 255.0 + 0.5) + floor(t.g * 255.0 + 0.5) / 256.0) * (4.0 / 255.0); }
vec4 enc16(float k) { float x = clamp(k, 0.0, 4.0) * (255.0 / 4.0); float hi = floor(x); return vec4(hi / 255.0, floor((x - hi) * 256.0) / 255.0, 0.0, 1.0); }
void main() {
  float s = 0.0, w = 0.0;
  for (int y = 0; y < 12; y++) for (int x = 0; x < 12; x++) {
    vec2 uv = (vec2(float(x), float(y)) + 0.5) / 12.0; vec3 c = texture2D(uEsc, uv).rgb; c *= c;
    vec2 q = uv - 0.5; float k = exp(-dot(q, q) * 6.0);
    s += log(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.002)) * k; w += k; }
  float meta = clamp(pow(uAdapta.y / exp(s / w), 0.6), uAdapta.z, uAdapta.w);
  float antes = dec16(texture2D(uAd, vec2(0.5)));
  float d = meta - antes, paso = d * (1.0 - exp(-uAdapta.x / (d > 0.0 ? 1.1 : 0.45)));
  if (uAdapta.x > 0.0 && abs(paso) < 0.004) paso = clamp(d, -0.004, 0.004);
  gl_FragColor = enc16(antes + paso);
}"#;
const FS_COPIA: &str = r#"
precision mediump float; uniform sampler2D uT, uRay, uBlo, uAd; uniform float uRayK, uBloomK; uniform vec4 uAdapta; varying vec2 vU;
float dec16(vec4 t) { return (floor(t.r * 255.0 + 0.5) + floor(t.g * 255.0 + 0.5) / 256.0) * (4.0 / 255.0); }
void main() {
  vec3 c = texture2D(uT, vU).rgb;
  // (los rayos del sol, sumados a la luz; guardados con raíz de v/8)
  if (uRayK > 0.0) { vec3 r = texture2D(uRay, vU).rgb; r = r * r * (8.0 * uRayK); c = sqrt(c * c + 1.0 - exp(-r)); }
  // (Definitivo: el resplandor y el color de película —lo oscuro un poco frío, lo claro apenas cálido—, más color y contraste)
  if (uBloomK > 0.0) {
    vec3 b = texture2D(uBlo, vU).rgb; vec3 l = c * c + b * uBloomK; float y = dot(l, vec3(0.2126, 0.7152, 0.0722));
    l = mix(vec3(y), l, 1.06); l *= mix(vec3(0.92, 0.98, 1.08), vec3(1.01, 1.0, 0.98), smoothstep(0.1, 0.8, y)); l = clamp(l, 0.0, 1.0); l = l * l * (3.0 - 2.0 * l) * 0.28 + l * 0.72;
    c = sqrt(l);
  }
  // (la vista que se acostumbra: la exposición del momento, lo claro aplastado suave)
  if (uAdapta.x > 0.0) { vec3 l = c * c * dec16(texture2D(uAd, vec2(0.5))); vec3 e = max(l - 0.7, 0.0); c = sqrt(min(l, 0.7) + e / (1.0 + e / 0.3)); }
  gl_FragColor = vec4(c, 1.0);
}"#;
// el resplandor de Definitivo (como gpu.rs y post.js): lo brillante a media resolución, bajado en cadena y subido sumando
const FS_BRILLO: &str = r#"
precision mediump float; uniform sampler2D uT; uniform vec2 uInv; varying vec2 vU;
void main() {
  vec3 c = texture2D(uT, vU + uInv * vec2(-1.0, -1.0)).rgb + texture2D(uT, vU + uInv * vec2(1.0, -1.0)).rgb + texture2D(uT, vU + uInv * vec2(-1.0, 1.0)).rgb + texture2D(uT, vU + uInv * vec2(1.0, 1.0)).rgb;
  c *= 0.25; c = c * c; float l = max(c.r, max(c.g, c.b)), k = max(0.0, l - 0.82) / max(l, 1e-4);
  gl_FragColor = vec4(c * k, 1.0);
}"#;
const FS_BAJA: &str = r#"
precision mediump float; uniform sampler2D uBlo; uniform vec2 uInv; varying vec2 vU;
void main() { vec3 c = texture2D(uBlo, vU).rgb * 4.0 + texture2D(uBlo, vU + uInv * vec2(-1.0, -1.0)).rgb + texture2D(uBlo, vU + uInv * vec2(1.0, -1.0)).rgb + texture2D(uBlo, vU + uInv * vec2(-1.0, 1.0)).rgb + texture2D(uBlo, vU + uInv * vec2(1.0, 1.0)).rgb; gl_FragColor = vec4(c / 8.0, 1.0); }"#;
const FS_SUBE: &str = r#"
precision mediump float; uniform sampler2D uBlo; uniform vec2 uInv; varying vec2 vU;
void main() {
  vec3 c = texture2D(uBlo, vU + uInv * vec2(-1.0, 0.0)).rgb + texture2D(uBlo, vU + uInv * vec2(1.0, 0.0)).rgb + texture2D(uBlo, vU + uInv * vec2(0.0, -1.0)).rgb + texture2D(uBlo, vU + uInv * vec2(0.0, 1.0)).rgb;
  c = c * 2.0 + texture2D(uBlo, vU + uInv * vec2(-1.0, -1.0)).rgb + texture2D(uBlo, vU + uInv * vec2(1.0, -1.0)).rgb + texture2D(uBlo, vU + uInv * vec2(-1.0, 1.0)).rgb + texture2D(uBlo, vU + uInv * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 12.0, 1.0);
}"#;
// los rayos del sol (Ultra), como los de WebGL 2 (post.js, gpu.rs): la máscara a un cuarto del lado —el cielo (alfa 0: lo
// opaco escribe 1) cerca del sol, con su brillo y el disco del sol— y el desenfoque radial de 40 lecturas hacia el sol
const FS_RAYMASK: &str = r#"
precision mediump float; uniform sampler2D uT; uniform vec4 uRayP; uniform vec3 uSolC; varying vec2 vU;
void main() {
  vec4 s = texture2D(uT, vU); vec2 v = (vU - uRayP.xy) * vec2(uRayP.z, 1.0); float r2 = dot(v, v);
  vec3 c = s.rgb * s.rgb * 0.45 + uSolC * (2.5 * exp(-r2 * 400.0));
  gl_FragColor = vec4(sqrt(min(c, vec3(8.0)) * (step(s.a, 0.002) * exp(-r2 * 6.0) / 8.0)), 1.0);
}"#;
// la luz en el aire (como gpu.rs): hasta lo que se ve —la distancia viene en el alfa de la escena— por la sombra del sol de
// lejos (16 pasos); más los rayos de la pantalla (uVol.z); sale como v/8 con raíz
const FS_VOL: &str = r#"
precision highp float;
uniform sampler2D uT, uSom, uRay; uniform mat4 uIVP, uSVP2; uniform vec3 uCam, uSol, uSolC; uniform vec4 uVol, uSomP2; varying vec2 vU;
float desem(vec4 c) { return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  float a = texture2D(uT, vU).a, te = a < 0.002 ? uVol.x : min(a * 64.0, uVol.x);
  vec4 f = uIVP * vec4(vU * 2.0 - 1.0, 1.0, 1.0); vec3 d = normalize(f.xyz / f.w - uCam);
  float dt = te / float(PASOS), t = dt * ign(gl_FragCoord.xy), lit = 0.0;
  for (int i = 0; i < PASOS; i++) {
    vec4 q = uSVP2 * vec4(uCam + d * t, 1.0); vec3 s = q.xyz / q.w * 0.5 + 0.5;
    lit += (s.x <= 0.0 || s.y <= 0.0 || s.x >= 1.0 || s.y >= 1.0 || s.z >= 1.0) ? 1.0 : step(s.z - uSomP2.x, desem(texture2D(uSom, vec2((s.x + 1.0) * 0.5, s.y))));
    t += dt;
  }
  float fl = lit / float(PASOS), m = fl * te, c = dot(d, uSol), g = 0.55, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
  vec3 v = uSolC * ((0.1 + 0.2 * hg) * m * (uVol.y + uVol.w * (1.0 - fl)));
  if (uVol.z > 0.0) { vec3 r = texture2D(uRay, vU).rgb; v += r * r * (8.0 * uVol.z); }
  gl_FragColor = vec4(sqrt(min(v, vec3(8.0)) / 8.0), 1.0);
}"#;
const FS_RAYOS: &str = r#"
precision mediump float; uniform sampler2D uRay; uniform vec4 uRayP; varying vec2 vU;
void main() {
  vec2 d = (uRayP.xy - vU) / 40.0, uv = vU; vec3 s = vec3(0.0); float w = 1.0;
  for (int i = 0; i < 40; i++) { vec3 t = texture2D(uRay, uv).rgb; s += t * t * w; w *= 0.975; uv += d; }
  gl_FragColor = vec4(sqrt(s / 40.0), 1.0);
}"#;

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
  c = clamp(mix(vec3(l), c, 1.15), 0.0, 1.0); c = max(c - 0.006, 0.0) * 1.006; c = c * c * (3.0 - 2.0 * c) * 0.26 + c * 0.74; c = enc(c);
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
void main() {
  vec4 t = texture2D(uT, vU); vec4 o = vec4(vC.rgb * t.rgb, vC.a * t.a * clamp(vF.x / vF.y, 0.0, 1.0));
  // (lo que suma, sólo la viñeta: el retoque entero en cada capa —medido— se aparta más de gpu.rs, que lo hace una vez sobre
  // la suma, ya saturada en blanco)
  if (uSuma > 0.5) { if (uRet.z > 0.5) { vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; o.rgb *= 1.0 - dot(q, q) * 0.22; } }
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
  c = clamp(mix(vec3(l), c, 1.15), 0.0, 1.0); c = max(c - 0.006, 0.0) * 1.006; c = c * c * (3.0 - 2.0 * c) * 0.26 + c * 0.74; c = enc(c);
  vec2 q = gl_FragCoord.xy * uRet.xy - 0.5; return c * (1.0 - dot(q, q) * 0.32);
}
void main() { gl_FragColor = vec4(retoque(vC.rgb), vC.a); }"#;
/// los floats de cada vértice de una partícula armada (x, y, z, u, v, r, g, b, a y lo del humo contra el piso)
pub const PART_V2: usize = 11;
/// a lo sumo cuántas partículas por cuadro (los índices son de 16 bits: 4 vértices cada una)
const PART_MAX2: usize = 16383;
/// lo más áspero que todavía refleja el piso (el sombreador lo apaga del todo en 0,82)
const BRILLO_PISO: f32 = 0.72;

const U_LUZ: [&str; 39] = ["uTam", "uBan", "uBan2", "uTi", "uTi2", "uTi3", "uVP", "uM", "uMn", "uSc", "uSt", "uT", "uT1", "uT2", "uT3", "uLM", "uS1", "uS3", "uC", "uSol", "uSolC", "uAmbS", "uAmbG", "uNieC", "uNieS", "uCam", "uEm", "uMat", "uNie", "uExpo", "uModo", "uLP", "uLC", "uLN", "uIVP", "uTop", "uMid", "uBot", "uExp"];
const U_OTROS: [&str; 34] = ["uEsc", "uAd", "uAdapta", "uNubes", "uBlo", "uBloomK", "uVol", "uAlfaD", "uCieloA", "uRay", "uRayK", "uRayP", "uTiene", "uCieloK", "uInv", "uRet", "uTinte", "uDia", "uCubo", "uN", "uF", "uH", "uS", "uTiempo", "uSolC", "uSuma", "uSVP", "uSom", "uSomP", "uClip", "uR", "uRP", "uSVP2", "uSomP2"];

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

/// una cascada de la sombra (como gpu::cascada): ortográfica desde el sol, de radio `r`; la de cerca, delante de la cámara
/// (hacia uno de 16 rumbos: girando un poco no se mueve y la guardada sigue sirviendo), centrada en múltiplos del texel (no
/// tiembla al caminar). El margen de profundidad y el corrimiento por la normal, más grandes que en OpenGL 3: la profundidad
/// va en 8 bits por canal y sin desplazamiento de polígonos
fn cascada2(c: &Cuadro, s: [f32; 3], r: f32, px: i32, cerca: bool) -> (M4, [f32; 2]) {
    let mut c0 = c.pos;
    if cerca { let f = mat::norm([c.vp[3], c.vp[7], c.vp[11]]); let hz = (f[0] * f[0] + f[2] * f[2]).sqrt();
        if hz > 0.3 { let paso = std::f32::consts::TAU / 16.0; let a = (f[2].atan2(f[0]) / paso).round() * paso; c0[0] += a.cos() * r * 0.6; c0[2] += a.sin() * r * 0.6; } }
    let paso = 2.0 * r / px as f32; let cen = [(c0[0] / paso).round() * paso, (c0[1] / paso).round() * paso, (c0[2] / paso).round() * paso];
    let alto = r + 80.0; let rango = alto + r;
    let ojo = [cen[0] + s[0] * alto, cen[1] + s[1] * alto, cen[2] + s[2] * alto];
    let arriba = if s[1].abs() > 0.95 { [0.0, 0.0, 1.0] } else { [0.0, 1.0, 0.0] };
    (mat::mul(&mat::orto(-r, r, -r, r, 0.5, rango), &mat::mirar(ojo, cen, arriba)), [0.3 / rango, 3.0 * paso])
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
    p_adapta: Prog2, adapta: Option<([(glow::Framebuffer, glow::Texture); 2], usize, f32)>,
    p_luz: Prog2, p_luz_c: Prog2, p_cielo: Prog2, p_ui: Prog2, p_copia: Prog2, p_agua: Prog2, p_part: Prog2, p_lin: Prog2,
    /// los rayos del sol: el programa, su destino (cuadro, textura, ancho, alto) y si van en este cuadro (el sol en la pantalla y su fuerza)
    p_rayos: Prog2, p_rayos2: Prog2, p_vol: Option<Prog2>, p_vol_aaa: Option<Prog2>, vol_ahora: bool, alfa_d: bool,
    /// el resplandor de Definitivo: los programas y la cadena (cuadro, textura, ancho, alto: ½, ¼, ⅛, 1/16)
    p_brillo: Prog2, p_baja: Prog2, p_sube: Prog2, brillo_rt: Vec<(glow::Framebuffer, glow::Texture, i32, i32)>,
    rayos_rt: Option<([(glow::Framebuffer, glow::Texture); 2], i32, i32)>, rayos_ahora: Option<[f32; 3]>,
    /// el hongo de las nucleares con volumen (el ruido en un mosaico 2D: OpenGL ES 2 no tiene texturas 3D)
    pub hongos: crate::hongo::Hongos, alta: bool,
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
    /// la sombra del sol: el destino (cuadro, textura con la profundidad en RGBA, profundidad, lado), su matriz, cuántos
    /// cuadros van, si está lista y el corrimiento por la normal; los programas (y el de lo recortado)
    som: Option<(glow::Framebuffer, glow::Texture, glow::Renderbuffer, i32)>, som_vp: [M4; 2], som_n: u64, som_on: bool, som_off: [[f32; 2]; 2], som_huella: [u64; 2], refl_n: u64,
    p_som: Prog2, p_som_c: Prog2,
    /// el reflejo del agua: su destino (cuadro, textura, profundidad, ancho, alto), si se dibujó en este cuadro y los programas
    /// de la luz con el plano que corta lo de abajo del agua
    refl: Option<(glow::Framebuffer, glow::Texture, glow::Renderbuffer, i32, i32)>, refl_on: bool, refl_activo: bool, p_luz_r: Prog2, p_luz_rc: Prog2,
    /// el reflejo del piso (cuando no hay agua): la altura del piso si se dibujó, 1/ancho y 1/alto de la pantalla; y con qué
    /// cámara y plano se dibujó el último reflejo (si no cambiaron, se usa el de antes un cuadro sí y otro no)
    refl_piso: Option<f32>, refl_px: [f32; 2], refl_ult: (M4, f32),
}

impl Motor {
    pub unsafe fn nuevo(gl: glow::Context, op: Opciones2) -> Result<Motor, String> {
        let ext = gl.supported_extensions();
        // (la precisión alta en los sombreadores de píxeles: sin ella el hongo no se puede marchar —van los carteles—)
        let alta = gl.get_shader_precision_format(glow::FRAGMENT_SHADER, glow::HIGH_FLOAT).map_or(true, |f| f.precision > 0);
        let uint32 = ext.contains("GL_OES_element_index_uint"); let npot = ext.contains("GL_OES_texture_npot") || ext.contains("GL_ARB_texture_non_power_of_two");
        // (JXM_GL2_VER_SOMBRA: lo opaco pinta sólo cuánto le llega del sol —para revisar la sombra—)
        let ver = if std::env::var_os("JXM_GL2_VER_SOMBRA").is_some() { "#define VER_SOMBRA\n" } else { "" };
        let p_luz = programa(&gl, VS_LUZ, &format!("{ver}{FS_LUZ}"), &["aP", "aN", "aU", "aL"])?;
        // (lo recortado aparte: sólo ese programa puede descartar, así lo demás prueba la profundidad antes de pintar)
        let p_luz_c = programa(&gl, VS_LUZ, &format!("#define CORTE\n{FS_LUZ}"), &["aP", "aN", "aU", "aL"])?;
        let p_luz_r = programa(&gl, VS_LUZ, &format!("#define CLIP\n{FS_LUZ}"), &["aP", "aN", "aU", "aL"])?;
        let p_luz_rc = programa(&gl, VS_LUZ, &format!("#define CLIP\n#define CORTE\n{FS_LUZ}"), &["aP", "aN", "aU", "aL"])?;
        let p_som = programa(&gl, VS_SOM, FS_SOM, &["aP", "aN", "aU"])?;
        let p_som_c = programa(&gl, VS_SOM, &format!("#define CORTE\n{FS_SOM}"), &["aP", "aN", "aU"])?;
        let p_cielo = programa(&gl, VS_CIELO, &FS_CIELO.replace("@@NUBES@@", crate::gpu::NUBES_GLSL), &["aP"])?;
        let p_ui = programa(&gl, VS_UI, FS_UI, &["aP", "aU", "aC"])?;
        let p_copia = programa(&gl, VS_COPIA, FS_COPIA, &["aP"])?; let p_adapta = programa(&gl, VS_COPIA, FS_ADAPTA, &["aP"])?;
        let p_rayos = programa(&gl, VS_COPIA, FS_RAYMASK, &["aP"])?; let p_rayos2 = programa(&gl, VS_COPIA, FS_RAYOS, &["aP"])?;
        // (la luz en el aire necesita precisión alta —la sombra va en 8 bits por canal—)
        let p_vol = if alta { programa(&gl, VS_COPIA, &format!("#define PASOS 16\n{FS_VOL}"), &["aP"]).ok() } else { None };
        let p_vol_aaa = if alta { programa(&gl, VS_COPIA, &format!("#define PASOS 28\n{FS_VOL}"), &["aP"]).ok() } else { None };
        let (p_brillo, p_baja, p_sube) = (programa(&gl, VS_COPIA, FS_BRILLO, &["aP"])?, programa(&gl, VS_COPIA, FS_BAJA, &["aP"])?, programa(&gl, VS_COPIA, FS_SUBE, &["aP"])?);
        let p_agua = programa(&gl, VS_AGUA, &format!("{}{FS_AGUA}", if std::env::var_os("JXM_GL2_VER_REFLEJO").is_some() { "#define VER_REFLEJO\n" } else { "" }), &["aP"])?;
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
        Ok(Motor { p_adapta, adapta: None, hongos: crate::hongo::Hongos::nuevo(false), alta, p_rayos, p_rayos2, p_vol, p_vol_aaa, p_brillo, p_baja, p_sube, brillo_rt: vec![], vol_ahora: false, alfa_d: false, rayos_rt: None, rayos_ahora: None, som: None, som_vp: [mat::id(); 2], som_n: 0, som_on: false, som_off: [[0.0; 2]; 2], som_huella: [0; 2], refl_n: 0, p_som, p_som_c, refl: None, refl_on: false, refl_activo: false, p_luz_r, p_luz_rc, refl_piso: None, refl_px: [0.0; 2], refl_ult: (mat::id(), f32::NAN), oclu, n_cuadro: 0, fases: std::env::var("JXM_FASES").is_ok().then(|| (std::time::Instant::now(), vec![])), gl, op, cubo: None, p_luz, p_luz_c, p_cielo, p_ui, p_copia, p_agua, p_part, p_lin, part_vb, part_ib, part_cap: 0, part_v: Vec::new(), marcas_vb, marcas_n: 0, poses: vec![], poses_n: 0, pose_p: vec![], pose_v: vec![], marcas_nuevas: None, agua: None, agua_n: None, aguas: vec![], tri, ui_buf, blanca, mallas: HashMap::new(), mats: HashMap::new(), texs: HashMap::new(), lms: HashMap::new(), cielo: None,
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
            if let Some(v) = self.texs.insert(t.id, Tex2 { t: tx, bytes: b, tam: [t.w as f32, t.h as f32] }) { self.memoria -= v.bytes; self.gl.delete_texture(v.t); }
            self.memoria += b;
        }
        for t in &esc.c.lms {
            let (tx, b) = self.textura(t.w, t.h, rango(t.o, (t.w * t.h * 4) as usize)?, false)?;
            if let Some(v) = self.lms.insert(t.id, Tex2 { t: tx, bytes: b, tam: [t.w as f32, t.h as f32] }) { self.memoria -= v.bytes; self.gl.delete_texture(v.t); }
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
        self.rayos_ahora = if self.op.rayos { self.rayos_sol() } else { None };
        // (la luz en el aire: con la sombra del sol, de día)
        self.vol_ahora = self.op.rayos && self.op.aaa && self.op.sombras && self.p_vol.is_some() && self.c.as_ref().map_or(false, |c| { let l = &c.luz; self.sol()[1] > 0.03 && l.sol_c[0] * 0.2126 + l.sol_c[1] * 0.7152 + l.sol_c[2] * 0.0722 > 0.05 });
        let escalada = self.op.escala < 0.999 || self.rayos_ahora.is_some() || self.vol_ahora || self.op.aaa || self.op.adapta;
        // (si la escena va a su textura, el alfa lleva la distancia —y el cielo, 0—)
        self.alfa_d = escalada;
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
        // (la sombra del sol y el reflejo del agua, antes: cada una en su destino)
        if self.c.is_some() {
            self.sombras_pasada();
            let (rw, rh) = if escalada { (ew, eh) } else { (w, h) };
            self.refl_on = self.reflejo_pasada(rw, rh);
            self.marca("sombra_reflejo");
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
        // (lo que se mezcla encima no toca el alfa: es la distancia de lo opaco)
        if self.alfa_d { self.gl.color_mask(true, true, true, false); }
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
            match (self.refl_on, self.refl.as_ref()) {
                (true, Some(r)) => { gl.active_texture(glow::TEXTURE1); gl.bind_texture(glow::TEXTURE_2D, Some(r.1)); gl.uniform_1_i32(p.u("uR"), 1); gl.active_texture(glow::TEXTURE0); gl.uniform_4_f32(p.u("uRP"), 1.0 / rw as f32, 1.0 / rh as f32, 1.0, 0.0); }
                _ => gl.uniform_4_f32(p.u("uRP"), 0.0, 0.0, 0.0, 0.0),
            }
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
        // (los hongos de las nucleares —sólo con precisión alta en los sombreadores—)
        if self.op.hongo > 0 && self.alta { if let Some(c) = self.c.as_ref() { if self.hongos.dibujar(&self.gl, c, self.op.hongo, destino, rw, rh) > 0 { self.marca("hongos"); } } }
        let gl = &self.gl; gl.depth_mask(true); gl.disable(glow::BLEND);
        // (los rayos del sol, a un cuarto del lado, de la escena ya dibujada)
        { let gl = &self.gl; gl.color_mask(true, true, true, true); }
        let rayos = if self.rayos_ahora.is_some() || (self.vol_ahora && self.som_on) { self.rayos_pasada(self.rayos_ahora, ew, eh) } else { None };
        let brillo = if self.op.aaa { self.brillo_pasada(ew, eh) } else { None };
        let adapta = if self.op.adapta && escalada { self.adapta_pasada() } else { None };
        let gl = &self.gl;
        // (la escena chica, estirada a la pantalla; con los rayos sumados)
        if escalada {
            let (_, t, _, _, _) = *self.escena_rt.as_ref().unwrap();
            gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(0, 0, w, h); gl.disable(glow::DEPTH_TEST); gl.disable(glow::BLEND);
            gl.use_program(Some(self.p_copia.p)); gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(t));
            gl.uniform_1_i32(self.p_copia.u("uT"), 0); gl.uniform_1_i32(self.p_copia.u("uRay"), 1);
            gl.active_texture(glow::TEXTURE1); gl.bind_texture(glow::TEXTURE_2D, Some(rayos.map_or(self.blanca, |r| r.0))); gl.active_texture(glow::TEXTURE0);
            gl.uniform_1_f32(self.p_copia.u("uRayK"), rayos.map_or(0.0, |r| r.1));
            gl.uniform_1_i32(self.p_copia.u("uBlo"), 2); gl.uniform_1_f32(self.p_copia.u("uBloomK"), if brillo.is_some() { 0.45 } else { 0.0 });
            gl.active_texture(glow::TEXTURE2); gl.bind_texture(glow::TEXTURE_2D, Some(brillo.unwrap_or(self.blanca)));
            gl.uniform_1_i32(self.p_copia.u("uAd"), 3); gl.uniform_4_f32(self.p_copia.u("uAdapta"), if adapta.is_some() { 1.0 } else { 0.0 }, 0.0, 0.0, 0.0);
            gl.active_texture(glow::TEXTURE3); gl.bind_texture(glow::TEXTURE_2D, Some(adapta.unwrap_or(self.blanca))); gl.active_texture(glow::TEXTURE0);
            gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.tri)); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 2, glow::FLOAT, false, 8, 0);
            gl.draw_arrays(glow::TRIANGLES, 0, 3); gl.enable(glow::DEPTH_TEST);
        }
    }

    /// la vista que se acostumbra (como gpu.rs): mide la escena ya dibujada y mueve la exposición; la textura de 1×1 de este cuadro
    unsafe fn adapta_pasada(&mut self) -> Option<glow::Texture> {
        let t = self.c.as_ref()?.tiempo; let (_, col, _, _, _) = *self.escena_rt.as_ref()?;
        if self.adapta.is_none() {
            let mut par = Vec::new();
            for _ in 0..2 { let gl = &self.gl; let tx = gl.create_texture().ok()?; gl.bind_texture(glow::TEXTURE_2D, Some(tx));
                gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, 1, 1, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(&[64, 0, 0, 255])));
                for (k, v) in [(glow::TEXTURE_MIN_FILTER, glow::NEAREST), (glow::TEXTURE_MAG_FILTER, glow::NEAREST), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, v as i32); }
                let f = gl.create_framebuffer().ok()?; gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(tx), 0);
                if gl.check_framebuffer_status(glow::FRAMEBUFFER) != glow::FRAMEBUFFER_COMPLETE { self.op.adapta = false; return None; }
                par.push((f, tx)); }
            self.adapta = Some(([par[0], par[1]], 0, t));
        }
        let (par, i, t0) = *self.adapta.as_ref().unwrap();
        let dt = (t - t0).clamp(0.0, 0.25);
        let gl = &self.gl; let p = &self.p_adapta;
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(par[1 - i].0)); gl.viewport(0, 0, 1, 1); gl.disable(glow::DEPTH_TEST); gl.disable(glow::BLEND);
        gl.use_program(Some(p.p));
        gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(col)); gl.uniform_1_i32(p.u("uEsc"), 0);
        gl.active_texture(glow::TEXTURE1); gl.bind_texture(glow::TEXTURE_2D, Some(par[i].1)); gl.uniform_1_i32(p.u("uAd"), 1); gl.active_texture(glow::TEXTURE0);
        gl.uniform_4_f32(p.u("uAdapta"), dt, crate::gpu::ADAPTA_CLAVE, 0.75, 2.2);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.tri)); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 2, glow::FLOAT, false, 8, 0);
        gl.draw_arrays(glow::TRIANGLES, 0, 3); gl.enable(glow::DEPTH_TEST);
        self.adapta = Some((par, 1 - i, t));
        Some(par[1 - i].1)
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
        // (el cielo, para su reflejo en las superficies —como gpu.rs—)
        let (top, mid, bot, ex, k) = self.cielo.as_ref().map(|c| (c.top, c.mid, c.bot, c.exp, c.k)).unwrap_or(([0.28, 0.64, 1.0], [0.92, 0.92, 0.92], [0.53, 0.58, 0.68], [0.5, 0.5], 1.0));
        gl.uniform_3_f32(p.u("uTop"), top[0], top[1], top[2]); gl.uniform_3_f32(p.u("uMid"), mid[0], mid[1], mid[2]); gl.uniform_3_f32(p.u("uBot"), bot[0], bot[1], bot[2]);
        gl.uniform_2_f32(p.u("uExp"), ex[0], ex[1]); gl.uniform_1_f32(p.u("uCieloK"), k);
        gl.uniform_4_f32(p.u("uNubes"), if self.op.aaa { 1.0 } else { 0.0 }, 0.0, 0.0, 0.0);
        let n = c.luces.len().min(MAX_LUCES2); let (mut lp, mut lc) = ([0f32; 16], [0f32; 16]);
        for (i, q) in c.luces.iter().take(n).enumerate() { lp[i * 4..i * 4 + 4].copy_from_slice(&q[0..4]); lc[i * 4..i * 4 + 4].copy_from_slice(&q[4..8]); }
        gl.uniform_4_f32_slice(p.u("uLP"), &lp); gl.uniform_4_f32_slice(p.u("uLC"), &lc); gl.uniform_1_f32(p.u("uLN"), n as f32);
        for (k, nm) in ["uT", "uT1", "uT2", "uT3", "uLM"].iter().enumerate() { gl.uniform_1_i32(p.u(nm), k as i32); }
        // (la sombra, en la unidad 6: la 5 es la del cielo de cubo)
        gl.uniform_matrix_4_f32_slice(p.u("uSVP"), false, &self.som_vp[0]); gl.uniform_matrix_4_f32_slice(p.u("uSVP2"), false, &self.som_vp[1]); gl.uniform_1_i32(p.u("uSom"), 6);
        let px = self.som.as_ref().map_or(1, |s| s.3);
        gl.uniform_4_f32(p.u("uSomP"), 1.0 / px as f32, self.som_off[0][0], if self.som_on { 1.0 } else { 0.0 }, self.som_off[0][1]);
        gl.uniform_4_f32(p.u("uSomP2"), self.som_off[1][0], self.som_off[1][1], 0.0, 0.0);
        gl.uniform_1_f32(p.u("uAlfaD"), if self.alfa_d && !self.refl_activo { 1.0 } else { 0.0 });
        // (el reflejo del piso, en la unidad 7: no mientras se dibuja el reflejo mismo)
        gl.uniform_1_i32(p.u("uR"), 7);
        match (self.refl_piso, self.refl.as_ref()) {
            (Some(y), Some(r)) if self.refl_on && !self.refl_activo => {
                gl.active_texture(glow::TEXTURE7); gl.bind_texture(glow::TEXTURE_2D, Some(r.1)); gl.active_texture(glow::TEXTURE0);
                gl.uniform_4_f32(p.u("uRP"), self.refl_px[0], self.refl_px[1], 1.0, y);
            }
            _ => gl.uniform_4_f32(p.u("uRP"), 0.0, 0.0, 0.0, 0.0),
        }
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
        let gl = &self.gl; let p = match (self.refl_activo, mt.cut != 0) { (false, false) => &self.p_luz, (false, true) => &self.p_luz_c, (true, false) => &self.p_luz_r, (true, true) => &self.p_luz_rc }; gl.use_program(Some(p.p));
        let lm = self.lms.get(&m.lm_id).map(|t| t.t);
        let mut modo = lm.is_some() as i32 | if mt.cut != 0 { 2 } else { 0 } | if mt.unlit != 0 { 4 } else { 0 } | if mt.fol != 0 { 64 } else { 0 };
        let mut capas = [self.tex(mt.t), self.blanca, self.blanca, self.blanca, lm.unwrap_or(self.blanca)];
        if let Some(tr) = mt.terr.as_ref().filter(|t| t.len() == 3) {
            modo |= 16; for k in 0..3 { capas[1 + k] = self.tex(tr[k].0); }
            gl.uniform_4_f32(p.u("uS1"), tr[0].1, tr[0].2, tr[1].1, tr[1].2); gl.uniform_2_f32(p.u("uS3"), tr[2].1, tr[2].2);
        } else if mt.t2 >= 0 { modo |= 8; capas[1] = self.tex(mt.t2); }
        for (k, t) in capas.iter().enumerate() { gl.active_texture(glow::TEXTURE0 + k as u32); gl.bind_texture(glow::TEXTURE_2D, Some(*t)); }
        gl.uniform_1_f32(p.u("uModo"), modo as f32);
        if mt.cut != 0 { let tam = self.texs.get(&mt.t).map(|t| t.tam).unwrap_or([1.0, 1.0]); gl.uniform_2_f32(p.u("uTam"), tam[0], tam[1]); }
        let b = |k: i32| if modo & k != 0 { 1.0 } else { 0.0 };
        gl.uniform_4_f32(p.u("uBan"), b(16), b(8), b(2), b(4)); gl.uniform_3_f32(p.u("uBan2"), b(1), b(64), if mt.blend != 0 || mt.add != 0 { 1.0 } else { 0.0 });
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
    /// la sombra del sol (como la cascada de lejos de gpu.rs, una sola): un mapa ortográfico de `sombra_radio` alrededor de la
    /// cámara, con la profundidad en RGBA; se rehace cada `sombra_cada` cuadros
    /// la sombra del sol en dos cascadas (como OpenGL 3), una al lado de la otra en el mismo mapa (2 lados × 1): la de cerca
    /// (un poco más de un quinto del radio, delante de la cámara: ~2,5 cm por texel) y la de lejos (todo el radio). La de
    /// cerca se rehace cada `sombra_cada` cuadros y la de lejos la mitad de seguido (en los cuadros del medio); las dos, sólo
    /// si algo cambió (la huella de la matriz y de lo que hay adentro)
    unsafe fn sombras_pasada(&mut self) {
        let s = self.sol();
        if !self.op.sombras || s[1] < 0.05 { self.som_on = false; return; }
        let px = self.op.sombra_px.clamp(256, 1024);
        if self.som.as_ref().map_or(true, |x| x.3 != px) {
            let gl = &self.gl;
            if let Some((f, t, r, _)) = self.som.take() { gl.delete_framebuffer(f); gl.delete_texture(t); gl.delete_renderbuffer(r); }
            let (Ok(t), Ok(r), Ok(f)) = (gl.create_texture(), gl.create_renderbuffer(), gl.create_framebuffer()) else { self.op.sombras = false; return };
            gl.bind_texture(glow::TEXTURE_2D, Some(t));
            gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, px * 2, px, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(None));
            for (k, v) in [(glow::TEXTURE_MIN_FILTER, glow::NEAREST), (glow::TEXTURE_MAG_FILTER, glow::NEAREST), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, v as i32); }
            gl.bind_renderbuffer(glow::RENDERBUFFER, Some(r)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT16, px * 2, px);
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f));
            gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(t), 0);
            gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(r));
            // (si la placa no puede, sin sombra)
            let st = gl.check_framebuffer_status(glow::FRAMEBUFFER);
            if st != glow::FRAMEBUFFER_COMPLETE { eprintln!("gl2: el destino de la sombra no anda ({st:#x})"); gl.delete_framebuffer(f); gl.delete_texture(t); gl.delete_renderbuffer(r); self.op.sombras = false; self.som_on = false; return; }
            self.som = Some((f, t, r, px)); self.som_on = false; self.som_huella = [0; 2];
        }
        self.som_n += 1;
        let cada = self.op.sombra_cada.max(1) as u64; let n = self.som_n;
        let toca = [!self.som_on || n % cada == 0, !self.som_on || n % (2 * cada) == cada / 2];
        let mut hechas = 0;
        for k in 0..2 {
            if !toca[k] { continue; }
            let c = self.c.as_ref().unwrap(); let r = if k == 0 { (self.op.sombra_radio * 0.22).max(6.0) } else { self.op.sombra_radio.max(8.0) };
            let (svp, off) = cascada2(c, s, r, px, k == 0);
            self.som_vp[k] = svp; self.som_off[k] = off;
            let pl = mat::planos(&svp);
            let lista: Vec<usize> = self.opacos.iter().copied().filter(|&i| { let it = &self.items[i]; it.fl & FL_CIELO == 0 && mat::esfera_dentro(&pl, &it.esf) && self.mats.get(&it.mat).map_or(false, |m| m.unlit == 0) }).collect();
            // (si no cambió nada —la misma matriz y lo mismo adentro, en el mismo lugar y pose— la mitad guardada sirve)
            let mut hu: u64 = 0xcbf29ce484222325; let mut mete = |x: u64| { hu ^= x; hu = hu.wrapping_mul(0x100000001b3); };
            for v in &svp { mete(v.to_bits() as u64); }
            for &i in &lista { let it = &self.items[i]; mete(it.m as u64); mete(it.s0 as u64); mete(it.mat as u64); for v in &it.mm { mete(v.to_bits() as u64); } for v in &it.h { mete(v.to_bits() as u64); } }
            let hu = hu.max(1);
            if self.som_on && hu == self.som_huella[k] { continue; }
            self.som_huella[k] = hu;
            let (f, ..) = *self.som.as_ref().unwrap();
            let gl = &self.gl; let x0 = k as i32 * px;
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.viewport(x0, 0, px, px);
            // (se borra y se dibuja sólo esa mitad)
            gl.enable(glow::SCISSOR_TEST); gl.scissor(x0, 0, px, px);
            gl.clear_color(1.0, 1.0, 1.0, 1.0); gl.clear_depth_f32(1.0); gl.depth_mask(true); gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT);
            gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::LEQUAL); gl.disable(glow::BLEND); gl.disable(glow::CULL_FACE);
            for p in [&self.p_som, &self.p_som_c] { gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u("uVP"), false, &svp); gl.uniform_1_i32(p.u("uT"), 0); }
            hechas += lista.len();
            for i in lista { self.dibujar_sombra(i); }
            self.gl.disable(glow::SCISSOR_TEST);
        }
        if std::env::var_os("JXM_GL2_VER_SOMBRA").is_some() && self.som_n < 6 { eprintln!("gl2: sombra con {hechas} cosas, px {px}×2"); }
        self.som_on = true;
        let gl = &self.gl; gl.active_texture(glow::TEXTURE6); gl.bind_texture(glow::TEXTURE_2D, self.som.as_ref().map(|x| x.1)); gl.active_texture(glow::TEXTURE0);
    }
    /// una cosa en el mapa de la sombra
    unsafe fn dibujar_sombra(&mut self, i: usize) {
        let pose = if !self.items[i].h.is_empty() && self.mallas.get(&self.items[i].m).map(|m| m.piel.is_some()).unwrap_or(false) { match self.pose_de(i) { Some(x) => Some(x), None => return } } else { None };
        let it = &self.items[i]; let (Some(m), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { return };
        let (vb, mn, sc) = pose.unwrap_or((m.vb, m.mn, m.sc));
        let gl = &self.gl; let p = if mt.cut != 0 { &self.p_som_c } else { &self.p_som }; gl.use_program(Some(p.p));
        if mt.cut != 0 { gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(self.tex(mt.t))); }
        gl.uniform_matrix_4_f32_slice(p.u("uM"), false, &it.mm);
        gl.uniform_3_f32(p.u("uMn"), mn[0], mn[1], mn[2]); gl.uniform_3_f32(p.u("uSc"), sc[0], sc[1], sc[2]); gl.uniform_4_f32(p.u("uSt"), mt.st[0], mt.st[1], mt.st[2], mt.st[3]);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(vb));
        gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 3, glow::UNSIGNED_SHORT, true, 20, 0);
        gl.disable_vertex_attrib_array(1); gl.enable_vertex_attrib_array(2); gl.vertex_attrib_pointer_f32(2, 2, glow::FLOAT, false, 20, 12); gl.disable_vertex_attrib_array(3);
        gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(m.ib));
        let (tipo, tam) = if m.i32 { (glow::UNSIGNED_INT, 4) } else { (glow::UNSIGNED_SHORT, 2) };
        gl.draw_elements(glow::TRIANGLES, it.sn as i32, tipo, (it.s0 * tam) as i32);
        self.dibujos += 1;
    }
    /// si puede dibujar el hongo de las nucleares con volumen (con precisión alta y el ruido listo)
    pub fn hongo_puede(&self) -> bool { self.alta && self.hongos.listo() }
    fn rayos_sol(&self) -> Option<[f32; 3]> { crate::gpu::sol_en_pantalla(self.c.as_ref()?, self.sol()) }
    /// los rayos del sol: de la escena dibujada (con su alfa: 0 el cielo) a una textura de un cuarto del lado; devuelve la textura
    unsafe fn rayos_pasada(&mut self, rp: Option<[f32; 3]>, ew: i32, eh: i32) -> Option<(glow::Texture, f32)> {
        let div = if self.op.aaa { 2 } else { 4 }; let (rw, rh) = ((ew / div).max(8), (eh / div).max(8));
        if self.rayos_rt.as_ref().map_or(true, |r| r.1 != rw || r.2 != rh) {
            let gl = &self.gl;
            if let Some((v, _, _)) = self.rayos_rt.take() { for (f, t) in v { gl.delete_framebuffer(f); gl.delete_texture(t); } }
            let mut v = vec![];
            for _ in 0..2 {
                let (Ok(t), Ok(f)) = (gl.create_texture(), gl.create_framebuffer()) else { self.op.rayos = false; return None };
                gl.bind_texture(glow::TEXTURE_2D, Some(t));
                gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, rw, rh, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(None));
                for (k, x) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, x as i32); }
                gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(t), 0);
                if gl.check_framebuffer_status(glow::FRAMEBUFFER) != glow::FRAMEBUFFER_COMPLETE { gl.delete_framebuffer(f); gl.delete_texture(t); self.op.rayos = false; return None; }
                v.push((f, t));
            }
            self.rayos_rt = Some(([v[0], v[1]], rw, rh));
        }
        let ([(mf, mt), (rf, rt)], ..) = *self.rayos_rt.as_ref()?; let (_, esc, ..) = *self.escena_rt.as_ref()?;
        let vol = self.vol_ahora && self.som_on;
        let s = self.sol(); let c = self.c.as_ref()?; let l = &c.luz; let (sc, expo, ivp) = (l.sol_c, l.expo, mat::inv(&c.vp)); let cp = c.pos;
        let gl = &self.gl;
        gl.disable(glow::DEPTH_TEST); gl.disable(glow::BLEND); gl.viewport(0, 0, rw, rh);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.tri)); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 2, glow::FLOAT, false, 8, 0);
        for a in 1..4 { gl.disable_vertex_attrib_array(a); }
        if let Some(rp) = rp {
            // 1) la máscara y 2) el desenfoque hacia el sol
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(mf));
            let p = &self.p_rayos; gl.use_program(Some(p.p));
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(esc)); gl.uniform_1_i32(p.u("uT"), 0);
            gl.uniform_4_f32(p.u("uRayP"), rp[0], rp[1], ew as f32 / eh as f32, rp[2]); gl.uniform_3_f32(p.u("uSolC"), sc[0], sc[1], sc[2]);
            gl.draw_arrays(glow::TRIANGLES, 0, 3);
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(rf));
            let p = &self.p_rayos2; gl.use_program(Some(p.p));
            gl.bind_texture(glow::TEXTURE_2D, Some(mt)); gl.uniform_1_i32(p.u("uRay"), 0); gl.uniform_4_f32(p.u("uRayP"), rp[0], rp[1], ew as f32 / eh as f32, rp[2]);
            gl.draw_arrays(glow::TRIANGLES, 0, 3);
        }
        let salida = match (if self.op.aaa && self.p_vol_aaa.is_some() { &self.p_vol_aaa } else { &self.p_vol }, vol) {
            (Some(p), true) => {
                // 3) la luz en el aire, con los rayos de la pantalla sumados
                gl.bind_framebuffer(glow::FRAMEBUFFER, Some(mf)); gl.use_program(Some(p.p));
                gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(esc)); gl.uniform_1_i32(p.u("uT"), 0);
                gl.active_texture(glow::TEXTURE1); gl.bind_texture(glow::TEXTURE_2D, self.som.as_ref().map(|x| x.1)); gl.uniform_1_i32(p.u("uSom"), 1);
                gl.active_texture(glow::TEXTURE2); gl.bind_texture(glow::TEXTURE_2D, Some(if rp.is_some() { rt } else { self.blanca })); gl.uniform_1_i32(p.u("uRay"), 2); gl.active_texture(glow::TEXTURE0);
                gl.uniform_matrix_4_f32_slice(p.u("uIVP"), false, &ivp); gl.uniform_matrix_4_f32_slice(p.u("uSVP2"), false, &self.som_vp[1]);
                gl.uniform_3_f32(p.u("uCam"), cp[0], cp[1], cp[2]); gl.uniform_3_f32(p.u("uSol"), s[0], s[1], s[2]); gl.uniform_3_f32(p.u("uSolC"), sc[0], sc[1], sc[2]);
                gl.uniform_4_f32(p.u("uSomP2"), self.som_off[1][0], self.som_off[1][1], 0.0, 0.0);
                gl.uniform_4_f32(p.u("uVol"), self.op.sombra_radio.min(60.0), crate::gpu::VOL_DENSIDAD, rp.map_or(0.0, |r| r[2]), crate::gpu::VOL_HACES);
                gl.draw_arrays(glow::TRIANGLES, 0, 3);
                (mt, expo)
            }
            _ => { let rp = rp?; (rt, rp[2] * expo) }
        };
        gl.enable(glow::DEPTH_TEST);
        self.dibujos += 3;
        Some(salida)
    }
    /// el resplandor (Definitivo): lo brillante a media resolución, bajado en cadena y subido sumando; devuelve la textura
    unsafe fn brillo_pasada(&mut self, ew: i32, eh: i32) -> Option<glow::Texture> {
        let (_, esc, ..) = *self.escena_rt.as_ref()?;
        let tam: Vec<(i32, i32)> = (1..=4).map(|k| ((ew >> k).max(4), (eh >> k).max(4))).collect();
        if self.brillo_rt.len() != 4 || self.brillo_rt.iter().zip(&tam).any(|(d, t)| d.2 != t.0 || d.3 != t.1) {
            let gl = &self.gl;
            for (f, t, ..) in self.brillo_rt.drain(..) { gl.delete_framebuffer(f); gl.delete_texture(t); }
            for &(w, h) in &tam {
                let (Ok(t), Ok(f)) = (gl.create_texture(), gl.create_framebuffer()) else { self.op.aaa = false; return None };
                gl.bind_texture(glow::TEXTURE_2D, Some(t));
                gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, w, h, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(None));
                for (k, x) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, x as i32); }
                gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(t), 0);
                self.brillo_rt.push((f, t, w, h));
            }
        }
        let gl = &self.gl; let b = &self.brillo_rt;
        gl.disable(glow::DEPTH_TEST); gl.disable(glow::BLEND);
        gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.tri)); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 2, glow::FLOAT, false, 8, 0);
        for a in 1..4 { gl.disable_vertex_attrib_array(a); }
        gl.active_texture(glow::TEXTURE0);
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(b[0].0)); gl.viewport(0, 0, b[0].2, b[0].3);
        let p = &self.p_brillo; gl.use_program(Some(p.p)); gl.bind_texture(glow::TEXTURE_2D, Some(esc)); gl.uniform_1_i32(p.u("uT"), 0); gl.uniform_2_f32(p.u("uInv"), 0.5 / ew as f32, 0.5 / eh as f32);
        gl.draw_arrays(glow::TRIANGLES, 0, 3);
        let p = &self.p_baja; gl.use_program(Some(p.p)); gl.uniform_1_i32(p.u("uBlo"), 0);
        for i in 1..4 { gl.bind_framebuffer(glow::FRAMEBUFFER, Some(b[i].0)); gl.viewport(0, 0, b[i].2, b[i].3); gl.bind_texture(glow::TEXTURE_2D, Some(b[i - 1].1)); gl.uniform_2_f32(p.u("uInv"), 1.0 / b[i - 1].2 as f32, 1.0 / b[i - 1].3 as f32); gl.draw_arrays(glow::TRIANGLES, 0, 3); }
        let p = &self.p_sube; gl.use_program(Some(p.p)); gl.uniform_1_i32(p.u("uBlo"), 0); gl.enable(glow::BLEND); gl.blend_func(glow::ONE, glow::ONE);
        for i in (1..4).rev() { gl.bind_framebuffer(glow::FRAMEBUFFER, Some(b[i - 1].0)); gl.viewport(0, 0, b[i - 1].2, b[i - 1].3); gl.bind_texture(glow::TEXTURE_2D, Some(b[i].1)); gl.uniform_2_f32(p.u("uInv"), 0.5 / b[i].2 as f32, 0.5 / b[i].3 as f32); gl.draw_arrays(glow::TRIANGLES, 0, 3); }
        gl.disable(glow::BLEND); gl.enable(glow::DEPTH_TEST);
        let t = b[0].1; self.dibujos += 7;
        Some(t)
    }
    /// el reflejo del agua (como gpu.rs): la escena espejada en el plano del agua a 1/`reflejo_div` del lado, sin lo
    /// transparente ni lo de abajo del agua; devuelve si se dibujó
    unsafe fn reflejo_pasada(&mut self, rw: i32, rh: i32) -> bool {
        if std::env::var_os("JXM_GL2_VER_REFLEJO").is_some() && self.n_cuadro < 3 { eprintln!("gl2: {} aguas, reflejo {}", self.aguas.len(), self.op.reflejo); }
        self.refl_piso = None;
        if !self.op.reflejo { return false; }
        // (el plano: el agua si la hay y la cámara está arriba; si no, el piso de abajo de la cámara —si no está muy lejos—)
        let c = self.c.as_ref().unwrap();
        let agua = if self.aguas.is_empty() { None } else { c.agua_y.or(self.agua.as_ref().map(|a| a.y)).filter(|&ay| c.pos[1] >= ay + 0.05) };
        let piso = if agua.is_some() || !self.op.reflejo_piso { None } else { c.suelo_y.filter(|&y| (0.2..25.0).contains(&(c.pos[1] - y))) };
        // (y sólo si cerca y a la vista hay algo liso que cruza esa altura —las baldosas, el metal, lo que en Source tiene
        // $envmap o $phong—: en un piso áspero no se vería y no se gasta)
        let piso = piso.filter(|&y| { let pl = mat::planos(&c.vp); let cp = c.pos;
            self.opacos.iter().any(|&i| { let it = &self.items[i]; let e = it.esf;
                e[3] > 0.0 && (e[1] - y).abs() < e[3] && self.mats.get(&it.mat).map_or(false, |m| m.pbr[0] < BRILLO_PISO)
                    && ((e[0] - cp[0]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3] < 50.0 && mat::esfera_dentro(&pl, &e) }) });
        let Some(ay) = agua.or(piso) else { return false };
        self.refl_px = [1.0 / rw as f32, 1.0 / rh as f32];
        let div = self.op.reflejo_div.max(2); let (w, h) = ((rw / div).max(16), (rh / div).max(16));
        if self.refl.as_ref().map_or(true, |r| r.3 != w || r.4 != h) {
            let gl = &self.gl;
            if let Some((f, t, r, _, _)) = self.refl.take() { gl.delete_framebuffer(f); gl.delete_texture(t); gl.delete_renderbuffer(r); }
            let (Ok(t), Ok(r), Ok(f)) = (gl.create_texture(), gl.create_renderbuffer(), gl.create_framebuffer()) else { self.op.reflejo = false; return false };
            gl.bind_texture(glow::TEXTURE_2D, Some(t));
            gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, w, h, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(None));
            for (k, v) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, v as i32); }
            gl.bind_renderbuffer(glow::RENDERBUFFER, Some(r)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT16, w, h);
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f));
            gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(t), 0);
            gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(r));
            if gl.check_framebuffer_status(glow::FRAMEBUFFER) != glow::FRAMEBUFFER_COMPLETE { gl.delete_framebuffer(f); gl.delete_texture(t); gl.delete_renderbuffer(r); self.op.reflejo = false; return false; }
            self.refl = Some((f, t, r, w, h));
        }
        // (si la cámara y el plano no cambiaron, un cuadro sí y otro no se usa el de antes; moviéndose, siempre nuevo: si no,
        // el reflejo del piso se arrastra detrás de la cámara)
        self.refl_n += 1;
        let quieta = self.refl_ult.1 == ay && self.refl_ult.0.iter().zip(c.vp.iter()).all(|(a, b)| (a - b).abs() < 1e-4);
        if self.refl_on && quieta && self.refl_n % 2 == 0 { self.refl_piso = piso; return true; }
        self.refl_ult = (c.vp, ay); self.refl_piso = piso;
        // (el piso mismo no se refleja: el plano que corta va un poco más arriba)
        let corte = if piso.is_some() { ay + 0.03 } else { ay };
        let vp = mat::mul(&c.vp, &mat::espejo_y(ay)); let cp = c.pos;
        let (f, ..) = *self.refl.as_ref().unwrap();
        { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.viewport(0, 0, w, h);
          gl.clear_color(0.0, 0.0, 0.0, 1.0); gl.clear_depth_f32(1.0); gl.depth_mask(true); gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT);
          gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::LEQUAL); gl.disable(glow::BLEND);
          // (lo del piso sin el retoque: se lo pone el piso al mezclarlo; y la unidad 7 sin el reflejo, que es donde se dibuja)
          let ret = self.op.retoque && piso.is_none();
          gl.active_texture(glow::TEXTURE7); gl.bind_texture(glow::TEXTURE_2D, Some(self.blanca)); gl.active_texture(glow::TEXTURE0);
          for p in [&self.p_cielo, &self.p_luz_r, &self.p_luz_rc] { gl.use_program(Some(p.p)); gl.uniform_3_f32(p.u("uRet"), 1.0 / w as f32, 1.0 / h as f32, if ret { 1.0 } else { 0.0 }); } }
        self.cielo_dibujar(&vp);
        self.refl_activo = true;
        for p in [&self.p_luz_r, &self.p_luz_rc] { self.luces_en(p, &vp); self.gl.uniform_4_f32(p.u("uClip"), 0.0, 1.0, 0.0, -corte); }
        let pl = mat::planos(&vp); let lejos = if piso.is_some() { 110.0 } else { 160.0 };
        let lista: Vec<usize> = self.opacos.iter().copied().filter(|&i| { let e = self.items[i].esf; self.items[i].fl & FL_CIELO == 0 && e[1] + e[3] > corte && mat::esfera_dentro(&pl, &e)
            && ((e[0] - cp[0]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3] < lejos }).collect();
        for i in self.de_cerca(&lista) { self.dibujar_item(i); }
        self.refl_activo = false;
        true
    }
    unsafe fn cielo_dibujar(&mut self, vp: &M4) {
        let gl = &self.gl; let p = &self.p_cielo; let s = self.sol(); let l = &self.c.as_ref().unwrap().luz;
        gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u("uIVP"), false, &mat::inv(vp));
        // (con los rayos del sol el cielo deja alfa 0: es la máscara de por dónde pasa la luz; si no, 1 —la pantalla no se transparenta—)
        gl.uniform_1_f32(p.u("uCieloA"), if self.alfa_d && !self.refl_activo { 0.0 } else { 1.0 });
        let t = self.c.as_ref().map_or(0.0, |c| c.tiempo.max(0.0));
        gl.uniform_4_f32(p.u("uNubes"), if self.op.aaa { 1.0 } else { 0.0 }, t, 0.0, 0.0); gl.uniform_3_f32(p.u("uSolC"), l.sol_c[0], l.sol_c[1], l.sol_c[2]);
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
