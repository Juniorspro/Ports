//! Los sombreadores de JX Motor en WGSL (wgpu: Vulkan en Android, GLES de respaldo): los mismos que tenía en GLES 3, uno por
//! familia de pasada. Las matrices vienen del juego en la convención de GL (profundidad de -1 a 1): `gl2wg` las pasa a la
//! de wgpu (de 0 a 1) al final de cada vértice. Lo que se lee de una imagen dibujada por el motor con la posición en la
//! pantalla (la sombra, la oclusión, la imagen final) se lee con la Y dada vuelta: en wgpu la primera fila es la de arriba.

/// lo común: la cabecera del cuadro (una por pasada: la cámara, el reflejo y la sombra), y unas cuentas
pub const COMUN: &str = r#"
struct Glob {
  vp: mat4x4<f32>, svp: mat4x4<f32>, ivp: mat4x4<f32>,
  cam: vec4<f32>,    // posición · exposición
  sol: vec4<f32>,    // dirección · con sombra (1)
  sol_c: vec4<f32>,  // color · recorte (el reflejo: sólo lo de arriba del agua)
  amb_s: vec4<f32>,  // cielo · k del cielo
  amb_g: vec4<f32>,  // suelo · tiempo
  nie_c: vec4<f32>,
  nie: vec4<f32>,    // desde, hasta, cuánto tapa como máximo
  nie_s: vec4<f32>,
  sesgo: vec4<f32>,  // sesgo de la sombra (2) · cuántas luces · cuántas son puntuales
  top: vec4<f32>,    // el degradé del cielo · exponente de arriba
  mid: vec4<f32>,    // · exponente de abajo
  bot: vec4<f32>,
  lp: array<vec4<f32>, 12>, lc: array<vec4<f32>, 12>, ld: array<vec4<f32>, 12>,
  tinte: vec4<f32>,  // tinte de la caja del cielo · 0 sin cielo del mapa, 1 degradé, 2 con caja
  extra: vec4<f32>,  // día
  svp2: mat4x4<f32>, // la cascada de lejos de la sombra (svp es la de cerca)
  sesgo2: vec4<f32>,
  ray0: vec4<f32>,   // el rayo de la cámara en la esquina (uv 0,0) · de la profundidad a la distancia (numerador)
  rayx: vec4<f32>,   // lo que cambia el rayo por u · (lo que se resta a la profundidad)
  rayy: vec4<f32>,   // · por v
  ojo: vec4<f32>,    // el ojo exacto de vp
};
fn gl2wg(p: vec4<f32>) -> vec4<f32> { return vec4<f32>(p.x, p.y, (p.z + p.w) * 0.5, p.w); }
fn aces(x: vec3<f32>) -> vec3<f32> { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3<f32>(0.0), vec3<f32>(1.0)); }
fn ign(p: vec2<f32>) -> f32 { return fract(52.9829189 * fract(dot(p, vec2<f32>(0.06711056, 0.00583715)))); }
fn pot3(c: vec3<f32>, e: f32) -> vec3<f32> { return pow(max(c, vec3<f32>(0.0)), vec3<f32>(e)); }
// (x^2,2 y x^(1/2,2) con tres raíces en vez de pow —logaritmo y exponencial—: el mismo color, menos de 0,2 de un nivel de 8 bits)
fn dec3(x0: vec3<f32>) -> vec3<f32> { let x = max(x0, vec3<f32>(0.0)); let a = sqrt(x); let b = sqrt(a); let c = sqrt(b); return x * x * (0.73929934 * b + 0.34228227 * c - 0.0593772 * a - 0.0226474); }
fn enc3(x0: vec3<f32>) -> vec3<f32> { let x = max(x0, vec3<f32>(0.0)); let a = sqrt(x); let b = sqrt(a); let c = sqrt(b); return 0.93020244 * a + 0.14337668 * b - 0.02588437 * c - 0.04836126 * x; }
struct VP { @builtin(position) pos: vec4<f32>, @location(0) p: vec2<f32> };
// (un triángulo que tapa la pantalla, del número de vértice)
@vertex fn vs_pantalla(@builtin(vertex_index) i: u32) -> VP {
  let p = vec2<f32>(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0; var o: VP; o.p = p; o.pos = vec4<f32>(p, 0.0, 1.0); return o;
}
fn uv_de(p: vec2<f32>) -> vec2<f32> { return vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); }
"#;

/// la cabecera del cuadro en el grupo 0 (todos menos el retoque final y la oclusión puesta)
pub const GV: &str = "@group(0) @binding(0) var<uniform> G: Glob;\n";

/// lo opaco y lo transparente con la luz del juego (gl.js, LUZ 3): BRDF con rugosidad y metal, reflejo del cielo, luces
/// puntuales y especiales, luz horneada, sombra del sol (dos cascadas, 3×3 muestras), niebla y ACES; con huesos (56) o sin
pub const LUZ: &str = r#"
@group(0) @binding(1) var t_sombra: texture_depth_2d;
@group(0) @binding(2) var s_cmp: sampler_comparison;
struct Obj { mn: vec4<f32>, sc: vec4<f32>, st: vec4<f32>, c: vec4<f32>, em: vec4<f32>, mat: vec4<f32>, s1: vec4<f32>, s3: vec4<f32>, ti: vec4<f32>, ti2: vec4<f32>, ti3: vec4<f32> };
@group(1) @binding(0) var<uniform> O: Obj;
@group(2) @binding(0) var t_t: texture_2d<f32>;
@group(2) @binding(1) var t_1: texture_2d<f32>;
@group(2) @binding(2) var t_2: texture_2d<f32>;
@group(2) @binding(3) var t_3: texture_2d<f32>;
@group(2) @binding(4) var t_lm: texture_2d<f32>;
@group(2) @binding(5) var s_rep: sampler;
@group(2) @binding(6) var s_cla: sampler;
struct Huesos { b: array<vec4<f32>, 168> };
@group(3) @binding(0) var<uniform> H: Huesos;

struct VIn {
  @location(0) p: vec4<f32>, @location(1) n: vec4<f32>, @location(2) u: vec2<f32>, @location(5) l: vec2<f32>,
  @location(6) m0: vec4<f32>, @location(7) m1: vec4<f32>, @location(8) m2: vec4<f32>, @location(9) m3: vec4<f32>,
};
struct VPiel { @location(3) j: vec4<u32>, @location(4) w: vec4<f32> };
struct VOut {
  // (invariante: la pasada de profundidad y la de luz dan exactamente la misma profundidad)
  @builtin(position) @invariant pos: vec4<f32>,
  @location(0) w: vec3<f32>, @location(1) n: vec3<f32>, @location(2) u: vec2<f32>, @location(3) l: vec2<f32>, @location(4) s: vec4<f32>, @location(5) mz: f32, @location(6) s2: vec4<f32>,
};
fn vert(v: VIn, p: vec3<f32>, n: vec3<f32>) -> VOut {
  let M = mat4x4<f32>(v.m0, v.m1, v.m2, v.m3); let w = M * vec4<f32>(p, 1.0);
  var o: VOut;
  o.mz = v.n.w; o.w = w.xyz; o.n = mat3x3<f32>(M[0].xyz, M[1].xyz, M[2].xyz) * n; o.u = v.u * O.st.xy + O.st.zw; o.l = v.l;
  // (la sombra se lee corrida por la normal un píxel y medio de la sombra: sin acné y sin despegarse de lo que toca)
  let nn = normalize(o.n + vec3<f32>(1e-6));
  o.s = G.svp * vec4<f32>(w.xyz + nn * G.sesgo.y, 1.0); o.s2 = G.svp2 * vec4<f32>(w.xyz + nn * G.sesgo2.y, 1.0);
  o.pos = gl2wg(G.vp * w);
  return o;
}
@vertex fn vs_luz(v: VIn) -> VOut { return vert(v, O.mn.xyz + v.p.xyz * O.sc.xyz, v.n.xyz); }
@vertex fn vs_luz_piel(v: VIn, k: VPiel) -> VOut {
  let p = O.mn.xyz + v.p.xyz * O.sc.xyz; let n = v.n.xyz;
  var r0 = vec4<f32>(0.0); var r1 = vec4<f32>(0.0); var r2 = vec4<f32>(0.0);
  for (var i = 0; i < 4; i++) { let j = i32(k.j[i]) * 3; let w = k.w[i]; r0 += H.b[j] * w; r1 += H.b[j + 1] * w; r2 += H.b[j + 2] * w; }
  let q = vec4<f32>(p, 1.0);
  return vert(v, vec3<f32>(dot(r0, q), dot(r1, q), dot(r2, q)), vec3<f32>(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n)));
}

const PI = 3.14159265;
fn cielo_col(d: vec3<f32>) -> vec3<f32> {
  var c: vec3<f32>;
  if (d.y > 0.0) { c = mix(G.mid.xyz, G.top.xyz, pow(d.y, G.top.w)); } else { c = mix(G.mid.xyz, G.bot.xyz, pow(-d.y, G.mid.w)); }
  return dec3(c) * G.amb_s.w;
}
fn brdf(n: vec3<f32>, v: vec3<f32>, l: vec3<f32>, dif: vec3<f32>, f0: vec3<f32>, a: f32) -> vec3<f32> {
  let nl = dot(n, l); if (nl <= 0.0) { return vec3<f32>(0.0); }
  let h = normalize(l + v); let nh = max(dot(n, h), 0.0); let nv = max(dot(n, v), 1e-3); let lh = max(dot(l, h), 0.0);
  let a2 = a * a; let d = nh * nh * (a2 - 1.0) + 1.0; let D = a2 / (PI * d * d);
  let k = a * 0.5; let V = 0.25 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k));
  let m1 = max(1.0 - lh, 0.0); let m2 = m1 * m1; let F = f0 + (1.0 - f0) * (m2 * m2 * m1);
  return (dif * (1.0 - F) + min(D * V, 40.0) * F * PI) * nl;
}
// la sombra en dos cascadas, una al lado de la otra en el mismo mapa: la de cerca (fina) y la de lejos; en el borde de la de
// cerca se mezclan (sin costura)
fn pcf(q: vec3<f32>, k: f32, b: f32) -> f32 {
  let t = 1.0 / vec2<f32>(textureDimensions(t_sombra, 0)); var s = 0.0;
  let x0 = k * 0.5 + 1.5 * t.x; let x1 = k * 0.5 + 0.5 - 1.5 * t.x;
  // (cuatro lecturas a medio texel: cada una compara y filtra 2 × 2 —la comparación lineal—: el mismo filtro de 3 × 3 de antes)
  for (var i = 0; i < 2; i++) { for (var j = 0; j < 2; j++) {
    s += textureSampleCompareLevel(t_sombra, s_cmp, vec2<f32>(clamp((q.x + k) * 0.5 + (f32(i) - 0.5) * t.x, x0, x1), q.y + (f32(j) - 0.5) * t.y), q.z - b);
  } }
  return s * 0.25;
}
fn proy(v: vec4<f32>) -> vec3<f32> { let q = v.xyz / v.w; return vec3<f32>(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5, q.z * 0.5 + 0.5); }
fn sombra(nd: f32, vs: vec4<f32>, vs2: vec4<f32>) -> f32 {
  if (G.sol.w < 0.5) { return 1.0; }
  let inc = 1.0 + 2.0 * (1.0 - nd); let q0 = proy(vs); let q1 = proy(vs2);
  let g = max(abs(q0.x - 0.5), abs(q0.y - 0.5)) * 2.0;
  let lejos = q1.x <= 0.0 || q1.y <= 0.0 || q1.x >= 1.0 || q1.y >= 1.0 || q1.z >= 1.0;
  if (g < 0.97 && q0.z < 1.0) {
    let s0 = pcf(q0, 0.0, G.sesgo.x * inc); let k = smoothstep(0.8, 0.97, g);
    if (k > 0.0 && !lejos) { return mix(s0, pcf(q1, 1.0, G.sesgo2.x * inc), k); }
    return s0;
  }
  if (lejos) { return 1.0; }
  return pcf(q1, 1.0, G.sesgo2.x * inc);
}
fn luz_color(i: VOut, ff: bool) -> vec4<f32> {
  // (el modo es del material —igual en todo el dibujo—: las ramas que dependen de él son uniformes y cada píxel lee sólo
  // las texturas que usa ese material, como en GLES; los descartes van al final)
  let modo = i32(O.s3.z);
  var t: vec4<f32>;
  if ((modo & 16) != 0) { let kc = textureSample(t_t, s_rep, i.u); t = vec4<f32>(textureSample(t_1, s_rep, i.u * O.s1.xy).rgb * kc.r + textureSample(t_2, s_rep, i.u * O.s1.zw).rgb * kc.g + textureSample(t_3, s_rep, i.u * O.s3.xy).rgb * kc.b, 1.0); }   // (terreno: control y tres capas)
  else if ((modo & 8) != 0) { t = mix(textureSample(t_t, s_rep, i.u), textureSample(t_1, s_rep, i.u), clamp(i.mz, 0.0, 1.0)); }   // (dos texturas mezcladas por vértice)
  else { t = textureSample(t_t, s_rep, i.u); }
  t = t * O.c;
  // la pintura en dos tonos (las armas de JXMod): lo gris con un color y los acentos con otro, que además brilla
  var emAc = vec3<f32>(0.0);
  if (O.ti2.w > 0.0) {
    let lu = dot(t.rgb, vec3<f32>(0.299, 0.587, 0.114)); let sat = max(t.r, max(t.g, t.b)) - min(t.r, min(t.g, t.b));
    let kA = smoothstep(O.ti3.w, O.ti3.w + 0.16, sat);
    let cu = mix(t.rgb, vec3<f32>(lu) * O.ti.xyz, O.ti.w); let ac = mix(t.rgb, vec3<f32>(lu) * O.ti2.xyz, O.ti2.w);
    t = vec4<f32>(mix(cu, ac, kA), t.a); emAc = ac * kA * O.ti3.xyz;
  } else if (O.ti.w > 0.0) { t = vec4<f32>(mix(t.rgb, vec3<f32>(dot(t.rgb, vec3<f32>(0.299, 0.587, 0.114))) * O.ti.xyz, O.ti.w), t.a); }
  var col: vec3<f32>;
  if ((modo & 4) != 0) { col = dec3(t.rgb) * 1.4; }   // (sin luz)
  else {
    let alb = dec3(t.rgb); var ng = normalize(i.n); if (!ff) { ng = -ng; }
    let fol = (modo & 64) != 0; let lm = (modo & 1) != 0;
    var n = ng; if (fol) { n = normalize(mix(ng, vec3<f32>(0.0, 1.0, 0.0), 0.55)); }
    let v = normalize(G.cam.xyz - i.w);
    let rough = O.mat.x; let metal = O.mat.y; let a = max(rough * rough, 0.004); let nl = dot(n, G.sol.xyz);
    var sh = 1.0;
    let dif = alb * (1.0 - metal); let f0 = mix(vec3<f32>(O.mat.z), alb, metal); var lmL = vec3<f32>(0.0);
    if (lm) { lmL = dec3(textureSample(t_lm, s_cla, i.l).rgb) * 4.0; col = dif * lmL; }   // (la luz horneada del mapa, en vez del sol y el cielo)
    else { if (nl > 0.0) { sh = sombra(max(nl, 0.0), i.s, i.s2); } else { sh = 0.0; } col = brdf(n, v, G.sol.xyz, dif, f0, a) * G.sol_c.xyz * sh; }
    if (fol) { var tr = max(dot(-v, G.sol.xyz), 0.0); tr = tr * tr; col += dif * G.sol_c.xyz * (tr * tr) * 0.6 * sh; }   // (luz que atraviesa las hojas)
    let ln = i32(G.sesgo.z); let le = i32(G.sesgo.w);
    for (var k = 0; k < 12; k++) {
      if (k >= ln) { break; }
      var L = G.lp[k].xyz - i.w; let d2 = dot(L, L); let r = G.lp[k].w;
      if (d2 > r * r) { continue; }
      let d = sqrt(d2); L = L / d;
      let es = k >= le;   // (las especiales —linternas—: caen suave y envuelven un poco)
      var at: f32;
      if (es) { at = pow(max(1.0 - d / r, 0.0), 1.2) / (1.0 + 0.012 * d2); } else { at = pow(clamp(1.0 - pow(d / r, 4.0), 0.0, 1.0), 2.0) / (d2 + 1.0); }
      if (G.ld[k].w > -1.0) { var anc = 0.08; if (es && G.lc[k].w > 0.0) { anc = G.lc[k].w; } at *= smoothstep(G.ld[k].w, G.ld[k].w + anc, dot(-L, G.ld[k].xyz)); }
      var mas = vec3<f32>(0.0); if (es) { mas = dif * 0.08; }
      col += (brdf(n, v, L, dif, f0, max(a, 0.05)) + mas) * G.lc[k].rgb * at;
    }
    // luz del cielo: difusa (hemisferio) y reflejo (el cielo en la dirección reflejada, más borroso cuanto más áspero)
    let rf = reflect(-v, n); let nv = max(dot(n, v), 1e-3);
    var amb: vec3<f32>; var env: vec3<f32>;
    if (lm) { amb = vec3<f32>(0.0); env = lmL * 0.5; } else { amb = mix(G.amb_g.xyz, G.amb_s.xyz, n.y * 0.5 + 0.5); env = mix(cielo_col(rf), amb, clamp(rough * 1.15, 0.0, 1.0)); }
    let hor = clamp(1.0 + 1.3 * dot(rf, ng), 0.0, 1.0); env = env * hor * hor;
    let q1 = 1.0 - nv; let q2 = q1 * q1; let Fr = f0 + (max(vec3<f32>(1.0 - rough), f0) - f0) * (q2 * q2 * q1);
    col += dif * amb + env * Fr * mix(1.0, sh * 0.6 + 0.4, metal) + O.em.xyz * 1.6;
  }
  col += emAc;
  // la niebla (hasta cuánto tapa, la luz del sol en ella mirando para el sol y la de lo lejos y bajo)
  let dist = max(distance(i.w, G.cam.xyz), 1e-3);
  var f = clamp((dist - G.nie.x) / max(G.nie.y - G.nie.x, 0.001), 0.0, 1.0) * G.nie.z;
  let vd = (i.w - G.cam.xyz) / dist; let sd = max(dot(vd, G.sol.xyz), 0.0); let sd2 = sd * sd; let nc = G.nie_c.xyz + G.nie_s.xyz * (sd2 * sd2 * sd2);
  f = 1.0 - (1.0 - f) * exp(-max(0.0, dist - 20.0) * 0.0006 * exp(-max(i.w.y - G.cam.y + 5.0, 0.0) * 0.02));
  col = mix(col, nc, f);
  return vec4<f32>(enc3(aces(col * G.cam.w)) + (ign(i.pos.xy) - 0.5) / 255.0, t.a);
}
// (con descarte —el reflejo: sólo lo de arriba del agua; lo recortado— y sin: un sombreador que puede descartar obliga a
// probar la profundidad después de pintar, y entonces se pinta también lo tapado; lo opaco entero va con fs_luz_op)
@fragment fn fs_luz(i: VOut, @builtin(front_facing) ff: bool) -> @location(0) vec4<f32> {
  let c = luz_color(i, ff);
  if (i.w.y < G.sol_c.w || ((i32(O.s3.z) & 2) != 0 && c.a < 0.5)) { discard; }
  return c;
}
@fragment fn fs_luz_op(i: VOut, @builtin(front_facing) ff: bool) -> @location(0) vec4<f32> { return luz_color(i, ff); }
"#;

/// la sombra del sol: sólo la profundidad (con huesos o sin)
pub const SOMBRA: &str = r#"
struct Obj { mn: vec4<f32>, sc: vec4<f32>, st: vec4<f32>, c: vec4<f32>, em: vec4<f32>, mat: vec4<f32>, s1: vec4<f32>, s3: vec4<f32>, ti: vec4<f32>, ti2: vec4<f32>, ti3: vec4<f32> };
@group(1) @binding(0) var<uniform> O: Obj;
struct Huesos { b: array<vec4<f32>, 168> };
@group(3) @binding(0) var<uniform> H: Huesos;
struct VIn { @location(0) p: vec4<f32>, @location(6) m0: vec4<f32>, @location(7) m1: vec4<f32>, @location(8) m2: vec4<f32>, @location(9) m3: vec4<f32> };
struct VPiel { @location(3) j: vec4<u32>, @location(4) w: vec4<f32> };
@vertex fn vs_sombra(v: VIn) -> @builtin(position) vec4<f32> { return gl2wg(G.vp * mat4x4<f32>(v.m0, v.m1, v.m2, v.m3) * vec4<f32>(O.mn.xyz + v.p.xyz * O.sc.xyz, 1.0)); }
@vertex fn vs_sombra_piel(v: VIn, k: VPiel) -> @builtin(position) vec4<f32> {
  let p = vec4<f32>(O.mn.xyz + v.p.xyz * O.sc.xyz, 1.0);
  var r0 = vec4<f32>(0.0); var r1 = vec4<f32>(0.0); var r2 = vec4<f32>(0.0);
  for (var i = 0; i < 4; i++) { let j = i32(k.j[i]) * 3; let w = k.w[i]; r0 += H.b[j] * w; r1 += H.b[j + 1] * w; r2 += H.b[j + 2] * w; }
  return gl2wg(G.vp * mat4x4<f32>(v.m0, v.m1, v.m2, v.m3) * vec4<f32>(dot(r0, p), dot(r1, p), dot(r2, p), 1.0));
}
"#;

/// el agua de HL2/GMod: tres capas del mapa de normales, el fondo corrido por las olas (refracción, de la copia de la
/// escena), lo turbio por lo hondo, el reflejo corrido por las olas, Fresnel y los destellos del sol
pub const AGUA: &str = r#"
struct OA { mn: vec4<f32>, sc: vec4<f32>, f: vec4<f32>, h: vec4<f32>, s: vec4<f32>, bq: vec4<f32>, d: vec4<f32>, rf: vec4<f32> };   // d: hondo, largo, 1/ancho, 1/alto · rf: refracción sí, cuánto, tiempo
@group(1) @binding(0) var<uniform> A: OA;
@group(2) @binding(0) var t_n: texture_2d<f32>;
@group(2) @binding(1) var t_ref: texture_2d<f32>;
@group(2) @binding(2) var t_p: texture_2d<f32>;
@group(2) @binding(3) var t_refr: texture_2d<f32>;
@group(2) @binding(4) var t_refrp: texture_depth_2d;
@group(2) @binding(5) var s_rep: sampler;
@group(2) @binding(6) var s_cla: sampler;
struct VIn { @location(0) p: vec4<f32>, @location(6) m0: vec4<f32>, @location(7) m1: vec4<f32>, @location(8) m2: vec4<f32>, @location(9) m3: vec4<f32> };
struct VOut { @builtin(position) pos: vec4<f32>, @location(0) w: vec3<f32> };
@vertex fn vs_agua(v: VIn) -> VOut { let w = mat4x4<f32>(v.m0, v.m1, v.m2, v.m3) * vec4<f32>(A.mn.xyz + v.p.xyz * A.sc.xyz, 1.0); var o: VOut; o.w = w.xyz; o.pos = gl2wg(G.vp * w); return o; }
@fragment fn fs_agua(i: VOut) -> @location(0) vec4<f32> {
  let dCam = distance(i.w, G.cam.xyz); let v = normalize(G.cam.xyz - i.w);
  let q = i.w.xz * A.h.x; let tt = A.rf.z;
  let n1 = textureSample(t_n, s_rep, q + tt * A.s.xy).rgb * 2.0 - 1.0;
  let n2 = textureSample(t_n, s_rep, q * 0.71 + vec2<f32>(0.37, 0.61) + tt * A.s.zw).rgb * 2.0 - 1.0;
  let n3 = textureSample(t_n, s_rep, q * 2.7 + vec2<f32>(0.13, 0.77) + tt * vec2<f32>(A.s.y, -A.s.x) * 2.3).rgb * 2.0 - 1.0;
  let lejos = 1.0 / (1.0 + dCam * 0.012);
  let d = ((n1.xy + n2.xy) * A.h.y + n3.xy * A.h.y * 0.45 * lejos) * lejos;
  let n = normalize(vec3<f32>(d.x, 1.0, d.y));
  let fr = 0.02 + 0.98 * pow(1.0 - abs(dot(n, v)), 5.0);
  let cuerpo = enc3(aces(A.f.rgb * (mix(G.amb_g.xyz, G.amb_s.xyz, 0.8) + G.sol_c.xyz * max(G.sol.y, 0.0) * 0.5) * 1.6 * G.cam.w));
  // (como Source: la imagen se corre lo que inclina la normal por $reflectamount y $refractamount; un poco menos a lo lejos)
  let pan = i.pos.xy * A.d.zw; let ola = n.xz / (1.0 + dCam * 0.01); let onda = ola * A.h.z;
  let rs = textureSample(t_ref, s_cla, pan + onda).rgb;
  var refl = mix(cuerpo, vec3<f32>(0.75, 0.82, 0.9), 0.6); if (A.h.w > 0.5) { refl = rs; }
  // (lo hondo de este punto: cuánta agua cruza la mirada hasta el fondo)
  let pb = (i.w.xz - A.bq.xy) * A.bq.zw; let ps = textureSample(t_p, s_cla, pb).r;
  var prof = A.d.x; if (pb.x >= 0.0 && pb.y >= 0.0 && pb.x <= 1.0 && pb.y <= 1.0) { prof = ps * A.d.x; }
  let niebla = 1.0 - exp(-prof / max(abs(v.y), 0.08) / A.d.y);
  // (los destellos del sol: con la normal de las olas, más anchos lejos —se ven como un camino de brillos—)
  let rv = max(dot(reflect(-v, n), G.sol.xyz), 0.0); let sp = (pow(rv, mix(900.0, 260.0, 1.0 - lejos)) * 2.2 + pow(rv, 60.0) * 0.08) * step(0.0, G.sol.y);
  // el fondo corrido por las olas (más corrido cuanto más hondo) y teñido por el agua; lo que está delante no se ondula
  var uvf = pan + ola * A.rf.y * (0.35 + 0.65 * min(prof / max(A.d.x, 0.1), 1.0));
  let dims = vec2<f32>(textureDimensions(t_refrp, 0));
  if (textureLoad(t_refrp, vec2<i32>(clamp(uvf, vec2<f32>(0.0), vec2<f32>(0.99999)) * dims), 0) < i.pos.z) { uvf = pan; }
  let fondo = textureSampleLevel(t_refr, s_cla, uvf, 0.0).rgb;
  if (A.rf.x > 0.5) {
    let abajo = mix(fondo * mix(vec3<f32>(1.0), A.f.rgb / max(max(A.f.r, A.f.g), max(A.f.b, 1e-3)), 0.35), cuerpo, max(niebla, A.f.a * 0.25));
    return vec4<f32>(mix(abajo, refl, fr) + G.sol_c.xyz * sp, 1.0);
  }
  return vec4<f32>(mix(cuerpo, refl, fr) + G.sol_c.xyz * sp, mix(max(niebla, A.f.a * 0.25), 1.0, fr));
}
"#;

/// el cielo: el del mapa (degradé y caja, como WebGL) o el de siempre (con el sol)
pub const CIELO: &str = r#"
@group(1) @binding(0) var t_cubo: texture_cube<f32>;
@group(1) @binding(1) var s_cla: sampler;
// (el cielo va después de lo opaco, a la profundidad del fondo —1—: sólo se pinta donde no quedó nada; antes se pintaba la
// pantalla entera y lo opaco lo tapaba)
@vertex fn vs_cielo(@builtin(vertex_index) i: u32) -> VP {
  let p = vec2<f32>(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0; var o: VP; o.p = p; o.pos = vec4<f32>(p, 1.0, 1.0); return o;
}
@fragment fn fs_cielo(i: VP) -> @location(0) vec4<f32> {
  let a = G.ivp * vec4<f32>(i.p, -1.0, 1.0); let b = G.ivp * vec4<f32>(i.p, 1.0, 1.0); let d = normalize(b.xyz / b.w - a.xyz / a.w);
  let cubo = textureSample(t_cubo, s_cla, d).rgb; let tc = i32(G.tinte.w);
  if (tc > 0) {
    var g: vec3<f32>;
    if (d.y > 0.0) { g = mix(G.mid.xyz, G.top.xyz, pow(d.y, G.top.w)); } else { g = mix(G.mid.xyz, G.bot.xyz, pow(-d.y, G.mid.w)); }
    var c = g; if (tc > 1) { c = mix(g, cubo * G.tinte.xyz, G.extra.x); }
    c = dec3(c) * G.amb_s.w;
    return vec4<f32>(enc3(min(c, vec3<f32>(1.0))), 1.0);
  }
  let cen = vec3<f32>(0.16, 0.36, 0.78); let hor = vec3<f32>(0.62, 0.74, 0.88);
  var c = mix(hor, cen, pow(clamp(d.y, 0.0, 1.0), 0.45)); if (d.y < 0.0) { c = mix(hor, G.nie_c.xyz, clamp(-d.y * 4.0, 0.0, 1.0)); }
  c += vec3<f32>(1.0, 0.92, 0.75) * pow(max(dot(d, G.sol.xyz), 0.0), 600.0) * 6.0;
  return vec4<f32>(enc3(aces(c * G.cam.w * 1.1)), 1.0);
}
"#;

/// la oclusión ambiental, a media resolución, desde la profundidad de lo opaco
pub const AO: &str = r#"
@group(1) @binding(0) var t_prof: texture_depth_2d;
// (el punto del mundo: el rayo de la cámara por ese lugar de la pantalla por lo hondo que dice la profundidad; da lo mismo
// que la inversa de la matriz con menos cuentas por muestra)
fn rayo(ndc: vec2<f32>) -> vec3<f32> { let uv = ndc * 0.5 + 0.5; return G.ray0.xyz + uv.x * G.rayx.xyz + uv.y * G.rayy.xyz; }
fn hondo(z: f32) -> f32 { return G.ray0.w / (z * 2.0 - 1.0 - G.rayx.w); }
@fragment fn fs_ao(i: VP) -> @location(0) vec4<f32> {
  let dims = vec2<f32>(textureDimensions(t_prof, 0));
  let z0 = textureLoad(t_prof, vec2<i32>(clamp(uv_de(i.p), vec2<f32>(0.0), vec2<f32>(0.99999)) * dims), 0);
  let w = G.ojo.xyz + rayo(i.p) * hondo(z0); var n = normalize(cross(dpdx(w), dpdy(w)));
  if (z0 >= 0.99999) { return vec4<f32>(1.0); }   // (el cielo)
  if (dot(n, G.ojo.xyz - w) < 0.0) { n = -n; }
  var t: vec3<f32>; if (abs(n.y) < 0.9) { t = normalize(cross(n, vec3<f32>(0.0, 1.0, 0.0))); } else { t = normalize(cross(n, vec3<f32>(1.0, 0.0, 0.0))); }
  let b = cross(n, t);
  let a0 = ign(i.pos.xy) * 6.2831853; let r = 0.7 * clamp(distance(w, G.ojo.xyz) * 0.1, 0.3, 1.0); var occ = 0.0;
  // (el ángulo de cada muestra gira el ángulo de oro desde el anterior: se rota el par coseno-seno en vez de calcularlos)
  var cs = vec2<f32>(cos(a0), sin(a0)); let go = vec2<f32>(-0.7373688, 0.6754903);
  for (var k = 0; k < 8; k++) {
    // (una espiral en la media esfera de la normal, cada vez más lejos: 8 muestras con el ruido de cada píxel y el suavizado)
    let h = (f32(k) + 0.5) / 8.0; let c = sqrt(1.0 - h); let sn = sqrt(h);
    let s = w + (t * (cs.x * sn) + b * (cs.y * sn) + n * c) * (r * mix(0.2, 1.0, h * h));
    cs = vec2<f32>(cs.x * go.x - cs.y * go.y, cs.x * go.y + cs.y * go.x);
    let q = G.vp * vec4<f32>(s, 1.0); let su = q.xy / q.w;
    if (q.w <= 0.0 || su.x < -1.0 || su.y < -1.0 || su.x > 1.0 || su.y > 1.0) { continue; }
    let d = G.ojo.xyz + rayo(su) * hondo(textureLoad(t_prof, vec2<i32>(clamp(uv_de(su), vec2<f32>(0.0), vec2<f32>(0.99999)) * dims), 0));
    if (distance(d, G.ojo.xyz) < distance(s, G.ojo.xyz) - 0.02) { occ += smoothstep(0.0, 1.0, r / max(distance(d, w), 1e-3)); }
  }
  let ao = 1.0 - occ / 8.0;
  return vec4<f32>(ao, ao, ao, 1.0);
}
"#;

/// poner la oclusión sobre la escena (suavizada con 4 muestras) y la imagen final (estirada, con el retoque de WebGL)
pub const POST: &str = r#"
struct Post { a: vec4<f32>, b: vec4<f32> };
@group(0) @binding(0) var t_x: texture_2d<f32>;
@group(0) @binding(1) var s_x: sampler;
@group(0) @binding(2) var<uniform> P: Post;
@fragment fn fs_ao_poner(i: VP) -> @location(0) vec4<f32> {
  let uv = uv_de(i.p); let inv = P.a.xy;
  let a = 0.25 * (textureSample(t_x, s_x, uv + vec2<f32>(-inv.x, -inv.y)).r + textureSample(t_x, s_x, uv + vec2<f32>(inv.x, -inv.y)).r + textureSample(t_x, s_x, uv + vec2<f32>(-inv.x, inv.y)).r + textureSample(t_x, s_x, uv + inv).r);
  return vec4<f32>(vec3<f32>(mix(1.0, a, P.a.z)), 1.0);   // (se multiplica con lo que ya está dibujado)
}
// (la imagen final girada en la pantalla: P.b = coseno y seno del giro —Vulkan en Android, con la pantalla de costado: el
// juego gira la imagen en vez de dejárselo al sistema—)
@vertex fn vs_final(@builtin(vertex_index) i: u32) -> VP {
  let p = vec2<f32>(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0; var o: VP; o.p = p;
  o.pos = vec4<f32>(p.x * P.b.x - p.y * P.b.y, p.x * P.b.y + p.y * P.b.x, 0.0, 1.0); return o;
}
@fragment fn fs_final(i: VP) -> @location(0) vec4<f32> {
  let uv = uv_de(i.p); var c = textureSample(t_x, s_x, uv).rgb;
  if (P.a.x > 0.5) {
    // (como FS_FINAL de post.js: un toque más de color y de contraste —curva en S suave— y un poco de viñeta)
    c = dec3(c);
    let l = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
    c = clamp(mix(vec3<f32>(l), c, 1.18), vec3<f32>(0.0), vec3<f32>(1.0));
    c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82;
    c = enc3(c);
    let q = uv - 0.5; c = c * (1.0 - dot(q, q) * 0.32);
    c += (ign(i.pos.xy) - 0.5) / 255.0;
  }
  if (P.a.y > 0.5) { c = dec3(c); }   // (una pantalla sRGB vuelve a poner la curva: se le da lineal)
  return vec4<f32>(c, 1.0);
}
"#;

/// las partículas como en efectos.js: carteles que giran, chispas estiradas por su velocidad y ondas en el piso, del atlas
pub const PART: &str = r#"
struct PU { der: vec4<f32>, arr: vec4<f32> };
@group(1) @binding(0) var t_a: texture_2d<f32>;
@group(1) @binding(1) var s_a: sampler;
@group(1) @binding(2) var<uniform> U: PU;
struct VIn { @location(0) p: vec3<f32>, @location(1) c: vec4<f32>, @location(2) e: vec3<f32>, @location(3) x: vec3<f32>, @location(4) s: vec3<f32> };
struct VOut { @builtin(position) pos: vec4<f32>, @location(0) c: vec4<f32>, @location(1) u: vec2<f32>, @location(2) f: vec2<f32> };
@vertex fn vs_part(v: VIn, @builtin(vertex_index) vi: u32) -> VOut {
  var ESQ = array<vec2<f32>, 6>(vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0));
  let e = ESQ[vi % 6u]; let s = v.e.z; let c = cos(v.x.x); let sn = sin(v.x.x); let r = vec2<f32>(e.x * c - e.y * sn, e.x * sn + e.y * c);
  var uv = e * 0.5 + 0.5; if (v.x.z > 2.5) { uv = vec2<f32>(e.x * 0.5 + 0.5, 0.5); }
  var o: VOut; o.c = v.c;
  if (v.x.y < -0.5) { o.u = uv; } else { o.u = (vec2<f32>(v.x.y - 2.0 * floor(v.x.y * 0.5), floor(v.x.y * 0.5)) + uv * 0.96 + 0.02) * 0.5; }
  var p: vec3<f32>;
  // (modo 3, las trazas de las balas: una línea de p − s a p del mismo ancho en la pantalla, como gpu.rs)
  if (v.x.z > 2.5) {
    var q = v.p; if (e.y < 0.0) { q = v.p - v.s; }
    let dn = normalize(v.s + vec3<f32>(0.000001)); let a = normalize(cross(dn, q - G.cam.xyz) + vec3<f32>(0.000001));
    p = q + a * (e.x * s * length(q - G.cam.xyz));
  } else if (v.x.z > 1.5) { p = v.p + vec3<f32>(r.x, 0.0, r.y) * s; }
  else if (v.x.z > 0.5) {
    let l = length(v.s); var dn = U.arr.xyz; if (l > 0.00001) { dn = v.s / l; }
    let a = normalize(cross(dn, v.p - G.cam.xyz) + vec3<f32>(0.000001)); p = v.p + a * (e.x * s) + dn * (e.y * (l * 0.5 + s)) - v.s * 0.5;
  } else { p = v.p + (U.der.xyz * r.x + U.arr.xyz * r.y) * s; }
  if (v.x.z < 0.5 && v.s.y > 0.5) { o.f = vec2<f32>(p.y - v.s.x, s * 0.45); } else { o.f = vec2<f32>(1.0, 0.001); }
  o.pos = gl2wg(G.vp * vec4<f32>(p, 1.0));
  return o;
}
@fragment fn fs_part(i: VOut) -> @location(0) vec4<f32> { let t = textureSample(t_a, s_a, i.u); return vec4<f32>(i.c.rgb * t.rgb, i.c.a * t.a * clamp(i.f.x / i.f.y, 0.0, 1.0)); }
"#;

/// las marcas de frenada (marcas.js: color por vértice)
pub const LIN: &str = r#"
struct VIn { @location(0) p: vec3<f32>, @location(1) c: vec4<f32> };
struct VOut { @builtin(position) pos: vec4<f32>, @location(0) c: vec4<f32> };
@vertex fn vs_lin(v: VIn) -> VOut { var o: VOut; o.c = v.c; o.pos = gl2wg(G.vp * vec4<f32>(v.p, 1.0)); return o; }
@fragment fn fs_lin(i: VOut) -> @location(0) vec4<f32> { return i.c; }
"#;

/// la interfaz (el HUD, los menús): rectángulos con su parte del atlas de letras y su color, en píxeles de la pantalla; UU.rot
/// gira como la imagen final
pub const UI: &str = r#"
struct UIU { inv: vec4<f32>, rot: vec4<f32> };
@group(0) @binding(0) var t_ui: texture_2d<f32>;
@group(0) @binding(1) var s_ui: sampler;
@group(0) @binding(2) var<uniform> UU: UIU;
struct VIn { @location(0) p: vec2<f32>, @location(1) u: vec2<f32>, @location(2) c: vec4<f32> };
struct VOut { @builtin(position) pos: vec4<f32>, @location(0) u: vec2<f32>, @location(1) c: vec4<f32> };
@vertex fn vs_ui(v: VIn) -> VOut {
  let q = vec2<f32>(v.p.x * UU.inv.x * 2.0 - 1.0, 1.0 - v.p.y * UU.inv.y * 2.0);
  var o: VOut; o.u = v.u; o.c = v.c; o.pos = vec4<f32>(q.x * UU.rot.x - q.y * UU.rot.y, q.x * UU.rot.y + q.y * UU.rot.x, 0.0, 1.0); return o;
}
@fragment fn fs_ui(i: VOut) -> @location(0) vec4<f32> { return textureSample(t_ui, s_ui, i.u) * i.c; }
"#;
